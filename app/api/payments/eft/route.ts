import { NextRequest, NextResponse } from 'next/server';
import { getSql, db } from '@/lib/database';
import { validateBatchEntryFees, createBatchTransactionRecords } from '@/lib/payment-validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      eventId,
      userId,
      userEmail,
      userName,
      eodsaId,
      amount,
      invoiceNumber,
      itemDescription,
      entries,
      submitImmediately
    } = body;

    console.log('🏦 Processing EFT payment submission:', {
      userName,
      userEmail,
      eodsaId,
      amount,
      invoiceNumber,
      entriesCount: entries?.length
    });

    const sqlClient = getSql();

    // SAFETY CHECK: Validate fees before processing
    let computedTotal = amount || 0;
    let validationResult = null;
    
    if (entries && entries.length > 0) {
      // Validate each entry's fee against computed incremental fee
      validationResult = await validateBatchEntryFees(
        entries,
        eventId,
        amount || 0
      );

      computedTotal = validationResult.totalComputedFee;

      // Check for mismatch - log warning but use backend's computed total (source of truth)
      if (validationResult.mismatchDetected) {
        console.warn('⚠️ Fee mismatch detected - using backend computed total:', {
          clientSentTotal: amount,
          computedTotal: validationResult.totalComputedFee,
          mismatchReason: validationResult.mismatchReason,
          validations: validationResult.validations.map(v => ({
            entryIndex: v.entryIndex,
            itemName: v.entry.itemName,
            clientSent: v.clientSentFee,
            computed: v.computedFee,
            registrationFee: v.registrationFee,
            entryFee: v.entryFee,
            mismatch: v.mismatchDetected
          }))
        });
        
        // Use backend's computed total (source of truth)
        // This handles cases where registration was already charged or entry fees differ
        computedTotal = validationResult.totalComputedFee;
      } else {
        // Use computed total instead of client-sent amount
        computedTotal = validationResult.totalComputedFee;
      }
    }

    // Create transaction records BEFORE creating entries
    let transactionIds: string[] = [];
    if (entries && entries.length > 0) {
      try {
        const paymentReference = invoiceNumber || `EFT_${Date.now()}`;
        transactionIds = await createBatchTransactionRecords(
          entries,
          eventId,
          paymentReference,
          'eft',
          amount || 0,
          computedTotal
        );
        console.log(`✅ Created ${transactionIds.length} transaction records for EFT payment`);
      } catch (error) {
        console.error('⚠️ Failed to create transaction records, but continuing with EFT submission:', error);
      }
    }

    if (submitImmediately && entries && entries.length > 0) {
      // Submit all entries to the database immediately with pending payment status
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const entryId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

        // Option C: Enforce qualification before creating (Water/Fire only; Air/Earth never qualify)
        const primaryDancerId = entry.participantIds?.[0];
        if (primaryDancerId && entry.eventId) {
          const { allowed, error } = await db.checkEventEntryQualification(entry.eventId, primaryDancerId);
          if (!allowed) {
            throw new Error(error || `Entry "${entry.itemName}" failed qualification check`);
          }
        }

        try {
          await sqlClient`
            INSERT INTO event_entries (
              id, event_id, contestant_id, eodsa_id, participant_ids, calculated_fee, 
              payment_status, payment_method, payment_reference, submitted_at, 
              approved, qualified_for_nationals, item_number, item_name, choreographer, mastery, 
              item_style, estimated_duration, entry_type, music_file_url, music_file_name, 
              video_file_url, video_file_name, video_external_url, video_external_type, performance_type
            )
            VALUES (
              ${entryId}, ${entry.eventId}, ${entry.contestantId}, ${entry.eodsaId}, 
              ${JSON.stringify(entry.participantIds)}, ${entry.calculatedFee}, 
              'pending', 'eft', ${invoiceNumber}, ${new Date().toISOString()}, 
              false, true, ${entry.itemNumber || null}, ${entry.itemName}, ${entry.choreographer}, ${entry.mastery}, 
              ${entry.itemStyle}, ${entry.estimatedDuration}, ${entry.entryType || 'live'}, 
              ${entry.musicFileUrl || null}, ${entry.musicFileName || null}, 
              ${entry.videoFileUrl || null}, ${entry.videoFileName || null},
              ${entry.videoExternalUrl || null}, ${entry.videoExternalType || null},
              ${entry.performanceType || null}
            )
          `;

          // Update transaction record with entry ID
          if (transactionIds[i]) {
            await sqlClient`
              UPDATE transaction_records
              SET entry_id = ${entryId}
              WHERE id = ${transactionIds[i]}
            `;
          }

          console.log(`✅ Entry ${entryId} created successfully for EFT payment`);
        } catch (dbError: any) {
          console.error(`❌ Failed to create entry ${entryId}:`, dbError);
          throw new Error(`Failed to submit entry: ${entry.itemName}`);
        }
      }
    }

    // Log the EFT payment attempt
    const paymentLogId = Date.now().toString();
    try {
      // Determine registration_paid status - for EFT, it's only paid after admin verification
      // But we can check if registration was charged
      const registrationCharged = validationResult?.validations.some(v => v.registrationCharged) || false;
      
      await sqlClient`
        INSERT INTO eft_payment_logs (
          id, user_id, user_email, user_name, eodsa_id, amount, 
          invoice_number, item_description, entries_count, submitted_at, status,
          registration_paid
        )
        VALUES (
          ${paymentLogId}, ${userId}, ${userEmail}, ${userName}, ${eodsaId}, 
          ${computedTotal}, ${invoiceNumber}, ${itemDescription}, ${entries?.length || 0}, 
          ${new Date().toISOString()}, 'pending_verification',
          false
        )
      `;
    } catch (logError) {
      console.warn('Failed to log EFT payment, but continuing:', logError);
      // Don't fail the main process if logging fails
    }

    console.log('✅ EFT payment processed successfully');

    return NextResponse.json({
      success: true,
      message: 'EFT payment submitted successfully. Entries are now pending payment verification.',
      paymentId: paymentLogId,
      entriesSubmitted: entries?.length || 0,
      computedTotal: computedTotal, // Return computed total for frontend display
      clientSentTotal: amount // Return original client-sent total for reference
    });

  } catch (error: any) {
    console.error('❌ EFT payment processing error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to process EFT payment submission' 
      },
      { status: 500 }
    );
  }
}
