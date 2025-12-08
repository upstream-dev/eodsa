/**
 * Payment Validation Helpers
 * 
 * Functions to validate payment amounts against computed incremental fees
 * and create transaction records for payment tracking.
 */

import { computeIncrementalFee, markRegistrationCharged } from './incremental-fee-calculator';
import { createTransactionRecord } from './transaction-records';
import { getSql } from './database';

/**
 * Get the correct EODSA ID (starts with 'E', e.g., E387083)
 * If the provided ID is an internal ID, look it up from the database
 */
async function getCorrectEodsaId(providedId: string | undefined | null, dancerId?: string): Promise<string | null> {
  if (!providedId) return null;
  
  // If it already looks like an EODSA ID (starts with 'E' and is short), use it
  if (providedId.startsWith('E') && providedId.length <= 10) {
    return providedId;
  }
  
  // Otherwise, it's likely an internal ID - look up the EODSA ID from database
  const sql = getSql();
  try {
    // Try to find dancer by internal ID
    const dancerResult = await sql`
      SELECT eodsa_id FROM dancers WHERE id = ${providedId} LIMIT 1
    ` as any[];
    
    if (dancerResult && dancerResult.length > 0 && dancerResult[0].eodsa_id) {
      return dancerResult[0].eodsa_id;
    }
    
    // Also try by dancerId if provided
    if (dancerId && dancerId !== providedId) {
      const dancerResult2 = await sql`
        SELECT eodsa_id FROM dancers WHERE id = ${dancerId} LIMIT 1
      ` as any[];
      
      if (dancerResult2 && dancerResult2.length > 0 && dancerResult2[0].eodsa_id) {
        return dancerResult2[0].eodsa_id;
      }
    }
    
    // If not found, return null (caller should handle)
    return null;
  } catch (error) {
    console.warn(`Could not look up EODSA ID for ${providedId}:`, error);
    return null;
  }
}

export interface EntryFeeValidation {
  entryIndex: number;
  entry: any;
  computedFee: number;
  clientSentFee: number;
  registrationFee: number;
  entryFee: number;
  registrationCharged: boolean;
  registrationWasAlreadyCharged: boolean;
  entryCount: number;
  breakdown: string;
  warnings: string[];
  isValid: boolean;
  mismatchDetected: boolean;
  mismatchReason?: string;
}

export interface BatchValidationResult {
  totalComputedFee: number;
  totalClientSentFee: number;
  validations: EntryFeeValidation[];
  allValid: boolean;
  mismatchDetected: boolean;
  mismatchReason?: string;
}

/**
 * Validate fees for a batch of entries
 */
export async function validateBatchEntryFees(
  entries: any[],
  eventId: string,
  clientSentTotal: number
): Promise<BatchValidationResult> {
  const validations: EntryFeeValidation[] = [];
  let totalComputedFee = 0;

  // Track solo counts per dancer as we process entries
  // This is critical for batch additions where multiple solos are added at once
  const soloCountTracker: Map<string, number> = new Map(); // Map<eodsaId, currentSoloCount>
  
  // Track registration charged status per dancer to ensure it's only charged once
  const registrationChargedTracker: Map<string, boolean> = new Map(); // Map<eodsaId, registrationCharged>

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    try {
      // For solo entries, we need to track the solo count as we process entries in the batch
      // This ensures that if 3 solos are added at once, they get solo numbers 1, 2, 3
      let existingSoloCount = 0;
      let batchSoloCount = 0; // Store this to check if it's the first solo in batch
      let soloEodsaId: string | undefined;
      
      if (entry.performanceType === 'Solo') {
        // Get the correct EODSA ID (must start with 'E', e.g., E387083)
        // entry.eodsaId might be an internal ID, so we need to look it up
        const providedEodsaId = entry.eodsaId || (entry.participantIds && entry.participantIds[0]);
        const correctEodsaId = await getCorrectEodsaId(providedEodsaId, entry.contestantId) || providedEodsaId;
        
        soloEodsaId = correctEodsaId;
        
        if (soloEodsaId) {
          // Get existing count from database using computeIncrementalFee
          // Pass the correctEodsaId to ensure registration checks use the right ID
          const initialFeeResult = await computeIncrementalFee({
            eventId,
            dancerId: entry.contestantId || providedEodsaId,
            eodsaId: correctEodsaId, // Use correct EODSA ID
            performanceType: 'Solo',
            participantIds: Array.isArray(entry.participantIds) ? entry.participantIds : [entry.participantIds],
            masteryLevel: entry.mastery
          });
          
          existingSoloCount = initialFeeResult.entryCount;
          
          // Store the registration status from computeIncrementalFee for later use
          // Use correctEodsaId as the key to ensure consistency
          if (!registrationChargedTracker.has(correctEodsaId)) {
            registrationChargedTracker.set(correctEodsaId, initialFeeResult.registrationWasAlreadyCharged);
            console.log(`💾 Stored registration status for ${correctEodsaId}:`, {
              providedEodsaId,
              correctEodsaId,
              registrationWasAlreadyCharged: initialFeeResult.registrationWasAlreadyCharged,
              registrationFee: initialFeeResult.registrationFee,
              totalFee: initialFeeResult.totalFee,
              entryCount: initialFeeResult.entryCount
            });
          }
          
          // Add count from entries already processed in this batch
          // Use correctEodsaId as the key
          batchSoloCount = soloCountTracker.get(correctEodsaId) || 0;
          existingSoloCount += batchSoloCount;
          
          // Update tracker for next entry (do this AFTER we've used batchSoloCount)
          soloCountTracker.set(correctEodsaId, batchSoloCount + 1);
        }
      }

      // Compute incremental fee for this entry
      // For solo entries, we need to manually calculate based on the tracked solo count
      let feeResult;
      if (entry.performanceType === 'Solo') {
        // Ensure soloEodsaId is set
        if (!soloEodsaId) {
          soloEodsaId = entry.eodsaId || (entry.participantIds && entry.participantIds[0]);
        }
        
        if (!soloEodsaId) {
          throw new Error(`Solo entry ${i + 1} (${entry.itemName}) missing eodsaId and participantIds`);
        }
        
        // Manually calculate solo fee using the tracked count
        const { getSql } = await import('./database');
        const sql = getSql();
        
        // Get event config
        const eventResult = await sql`
          SELECT 
            registration_fee_per_dancer, solo_1_fee, solo_2_fee, solo_3_fee, solo_additional_fee,
            duo_trio_fee_per_dancer, group_fee_per_dancer, large_group_fee_per_dancer, currency
          FROM events
          WHERE id = ${eventId}
        ` as any[];

        if (!eventResult || eventResult.length === 0) {
          throw new Error(`Event ${eventId} not found`);
        }

        const event = eventResult[0];
        const eventConfig = {
          registrationFeePerDancer: parseFloat(event.registration_fee_per_dancer) || 300,
          solo1Fee: parseFloat(event.solo_1_fee) || 400,
          solo2Fee: parseFloat(event.solo_2_fee) || 200,
          solo3Fee: parseFloat(event.solo_3_fee) || 100,
          soloAdditionalFee: parseFloat(event.solo_additional_fee) || 100,
          duoTrioFeePerDancer: parseFloat(event.duo_trio_fee_per_dancer) || 280,
          groupFeePerDancer: parseFloat(event.group_fee_per_dancer) || 220,
          largeGroupFeePerDancer: parseFloat(event.large_group_fee_per_dancer) || 190,
          currency: event.currency || 'ZAR'
        };

        // Check registration charged status (only check once per dancer)
        // Ensure we're using the correct EODSA ID (starts with 'E')
        // soloEodsaId should already be the correct EODSA ID from above, but verify
        const correctEodsaIdForCheck = soloEodsaId && soloEodsaId.startsWith('E') 
          ? soloEodsaId 
          : await getCorrectEodsaId(soloEodsaId, entry.contestantId) || soloEodsaId;
        
        // Use the registration status from computeIncrementalFee which was already called above
        // Use correctEodsaIdForCheck as the key
        let registrationCharged = registrationChargedTracker.get(correctEodsaIdForCheck);
        
        // If not in tracker yet, it should have been set above when we called computeIncrementalFee
        if (registrationCharged === undefined) {
          // Fallback: query directly using correctEodsaIdForCheck
          const sql = getSql();
          const registrationChargedResult = await sql`
            SELECT COUNT(*) as count
            FROM registration_charged_flags
            WHERE event_id = ${eventId}
            AND eodsa_id = ${correctEodsaIdForCheck}
          ` as any[];
          
          registrationCharged = registrationChargedResult && registrationChargedResult[0]?.count > 0;
          registrationChargedTracker.set(correctEodsaIdForCheck, registrationCharged);
          
          console.warn(`⚠️ Registration status not found in tracker for ${correctEodsaIdForCheck}, queried directly: ${registrationCharged}`);
        }

        // Calculate solo fee using CUMULATIVE PACKAGE PRICING (same logic as calculateSmartEODSAFee)
        // solo1Fee, solo2Fee, solo3Fee are CUMULATIVE package totals, not individual fees
        const solo1Package = eventConfig.solo1Fee || 550;
        const solo2Package = eventConfig.solo2Fee || 942;
        const solo3Package = eventConfig.solo3Fee || 1256;
        const additionalSoloFee = eventConfig.soloAdditionalFee || 349;
        
        // Calculate previous package total (what they should have paid for existing solos)
        let previousPackageTotal = 0;
        if (existingSoloCount === 0) {
          previousPackageTotal = 0;
        } else if (existingSoloCount === 1) {
          previousPackageTotal = solo1Package;
        } else if (existingSoloCount === 2) {
          previousPackageTotal = solo2Package;
        } else if (existingSoloCount === 3) {
          previousPackageTotal = solo3Package;
        } else {
          // 4+ solos: 3-solo package + additional solos
          previousPackageTotal = solo3Package + ((existingSoloCount - 3) * additionalSoloFee);
        }
        
        // Calculate new package total (what they should pay for new total count)
        const newTotalSoloCount = existingSoloCount + 1;
        let newPackageTotal = 0;
        if (newTotalSoloCount === 1) {
          newPackageTotal = solo1Package;
        } else if (newTotalSoloCount === 2) {
          newPackageTotal = solo2Package;
        } else if (newTotalSoloCount === 3) {
          newPackageTotal = solo3Package;
        } else {
          // 4+ solos: 3-solo package + additional solos
          newPackageTotal = solo3Package + ((newTotalSoloCount - 3) * additionalSoloFee);
        }
        
        // Entry fee is the INCREMENTAL difference (new package - previous package)
        const entryFee = Math.max(0, newPackageTotal - previousPackageTotal);
        
        // Registration fee: only charge if not already charged AND this is the first solo for this dancer in this batch
        // Use batchSoloCount (value BEFORE incrementing) to check if it's the first solo in batch
        const isFirstSoloInBatch = batchSoloCount === 0;
        const registrationFee = (!registrationCharged && isFirstSoloInBatch) ? eventConfig.registrationFeePerDancer : 0;
        const totalFee = entryFee + registrationFee;
        
        // Debug logging for registration fee calculation
        console.log(`🔍 Solo entry ${i + 1} fee calculation:`, {
          entryIndex: i,
          itemName: entry.itemName,
          soloEodsaId,
          existingSoloCount,
          batchSoloCount,
          isFirstSoloInBatch,
          registrationCharged,
          entryFee,
          registrationFee,
          totalFee,
          registrationFeePerDancer: eventConfig.registrationFeePerDancer
        });
        
        // Mark registration as charged in tracker after first solo
        // Use correctEodsaIdForCheck as the key
        if (!registrationCharged && isFirstSoloInBatch) {
          registrationChargedTracker.set(correctEodsaIdForCheck, true);
        }

        feeResult = {
          registrationFee,
          entryFee,
          totalFee,
          registrationCharged: !registrationCharged && registrationFee > 0,
          registrationWasAlreadyCharged: registrationCharged,
          entryCount: existingSoloCount,
          breakdown: `Solo Package (${newTotalSoloCount} solos total): ${eventConfig.currency}${newPackageTotal} - Previous: ${eventConfig.currency}${previousPackageTotal} = ${eventConfig.currency}${entryFee}${registrationFee > 0 ? ` + Registration: ${eventConfig.currency}${registrationFee}` : ' (Registration already charged)'}`,
          warnings: []
        };
      } else {
        // For non-solo entries, use the standard computeIncrementalFee
        feeResult = await computeIncrementalFee({
          eventId,
          dancerId: entry.contestantId || entry.eodsaId,
          eodsaId: entry.eodsaId,
          performanceType: entry.performanceType as 'Solo' | 'Duet' | 'Trio' | 'Group',
          participantIds: Array.isArray(entry.participantIds) ? entry.participantIds : [entry.participantIds],
          masteryLevel: entry.mastery
        });
      }

      const clientSentFee = entry.calculatedFee || 0;
      const mismatchDetected = Math.abs(clientSentFee - feeResult.totalFee) > 0.01;
      const mismatchReason = mismatchDetected 
        ? `Entry ${i + 1}: Client sent ${clientSentFee}, computed ${feeResult.totalFee}, difference: ${Math.abs(clientSentFee - feeResult.totalFee)}`
        : undefined;

      validations.push({
        entryIndex: i,
        entry,
        computedFee: feeResult.totalFee,
        clientSentFee,
        registrationFee: feeResult.registrationFee,
        entryFee: feeResult.entryFee,
        registrationCharged: feeResult.registrationCharged,
        registrationWasAlreadyCharged: feeResult.registrationWasAlreadyCharged,
        entryCount: feeResult.entryCount,
        breakdown: feeResult.breakdown,
        warnings: feeResult.warnings,
        isValid: !mismatchDetected,
        mismatchDetected,
        mismatchReason
      });

      totalComputedFee += feeResult.totalFee;
    } catch (error: any) {
      console.error(`Error validating entry ${i + 1}:`, error);
      validations.push({
        entryIndex: i,
        entry,
        computedFee: 0,
        clientSentFee: entry.calculatedFee || 0,
        registrationFee: 0,
        entryFee: 0,
        registrationCharged: false,
        registrationWasAlreadyCharged: false,
        entryCount: 0,
        breakdown: '',
        warnings: [`Error computing fee: ${error.message}`],
        isValid: false,
        mismatchDetected: true,
        mismatchReason: `Error computing fee for entry ${i + 1}: ${error.message}`
      });
    }
  }

  // Check total mismatch
  const totalMismatchDetected = Math.abs(clientSentTotal - totalComputedFee) > 0.01;
  const totalMismatchReason = totalMismatchDetected
    ? `Total mismatch: Client sent ${clientSentTotal}, computed ${totalComputedFee}, difference: ${Math.abs(clientSentTotal - totalComputedFee)}`
    : undefined;
  
  // Debug logging for total
  console.log(`📊 Batch validation summary:`, {
    entriesCount: entries.length,
    clientSentTotal,
    totalComputedFee,
    mismatchDetected: totalMismatchDetected,
    mismatchReason: totalMismatchReason,
    validations: validations.map(v => ({
      index: v.entryIndex,
      itemName: v.entry.itemName,
      performanceType: v.entry.performanceType,
      clientSent: v.clientSentFee,
      computed: v.computedFee,
      entryFee: v.entryFee,
      registrationFee: v.registrationFee,
      registrationCharged: v.registrationCharged,
      registrationWasAlreadyCharged: v.registrationWasAlreadyCharged,
      mismatch: v.mismatchDetected,
      breakdown: v.breakdown
    }))
  });

  return {
    totalComputedFee,
    totalClientSentFee: clientSentTotal,
    validations,
    allValid: validations.every(v => v.isValid) && !totalMismatchDetected,
    mismatchDetected: totalMismatchDetected || validations.some(v => v.mismatchDetected),
    mismatchReason: totalMismatchReason || validations.find(v => v.mismatchDetected)?.mismatchReason
  };
}

/**
 * Create transaction records for batch entries and mark registration as charged
 */
export async function createBatchTransactionRecords(
  entries: any[],
  eventId: string,
  paymentId: string,
  paymentMethod: 'payfast' | 'eft',
  clientSentTotal: number,
  computedTotal: number
): Promise<string[]> {
  const transactionIds: string[] = [];
  const sql = getSql();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    
    try {
      // Get the correct EODSA ID (must start with 'E')
      const providedEodsaId = entry.eodsaId || (entry.participantIds && entry.participantIds[0]);
      const correctEodsaId = await getCorrectEodsaId(providedEodsaId, entry.contestantId) || providedEodsaId;
      
      // Compute fee to get registration charged status - use correctEodsaId
      const feeResult = await computeIncrementalFee({
        eventId,
        dancerId: entry.contestantId || providedEodsaId,
        eodsaId: correctEodsaId, // Use correct EODSA ID
        performanceType: entry.performanceType as 'Solo' | 'Duet' | 'Trio' | 'Group',
        participantIds: Array.isArray(entry.participantIds) ? entry.participantIds : [entry.participantIds],
        masteryLevel: entry.mastery
      });

      // Mark registration as charged if this entry charges registration - use correctEodsaId
      if (feeResult.registrationCharged) {
        await markRegistrationCharged(
          eventId,
          entry.contestantId || providedEodsaId,
          correctEodsaId // Use correct EODSA ID
        );
      }

      // Create transaction record (entry_id will be set later when entry is created)
      // Use correctEodsaId
      const transactionId = await createTransactionRecord({
        entryId: undefined, // Will be set when entry is created
        eventId,
        dancerId: entry.contestantId || providedEodsaId,
        eodsaId: correctEodsaId, // Use correct EODSA ID
        expectedAmount: feeResult.totalFee,
        amountPaid: 0, // Will be updated when payment completes
        registrationPaidFlag: false, // Will be updated when payment completes
        registrationChargedFlag: feeResult.registrationCharged,
        status: 'pending',
        paymentMethod,
        paymentReference: paymentId,
        clientSentTotal: entry.calculatedFee,
        computedTotal: feeResult.totalFee,
        mismatchDetected: Math.abs((entry.calculatedFee || 0) - feeResult.totalFee) > 0.01,
        mismatchReason: Math.abs((entry.calculatedFee || 0) - feeResult.totalFee) > 0.01
          ? `Entry ${i + 1}: Client sent ${entry.calculatedFee}, computed ${feeResult.totalFee}`
          : undefined
      });

      transactionIds.push(transactionId);
    } catch (error: any) {
      console.error(`Error creating transaction record for entry ${i + 1}:`, error);
    }
  }

  return transactionIds;
}

/**
 * Update transaction record with entry ID after entry is created
 */
export async function updateTransactionWithEntryId(
  transactionId: string,
  entryId: string
): Promise<void> {
  const sql = getSql();
  
  await sql`
    UPDATE transaction_records
    SET entry_id = ${entryId}
    WHERE id = ${transactionId}
  `;
}

