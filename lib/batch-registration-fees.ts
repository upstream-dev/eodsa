/**
 * Pure helpers for attaching per-event registration onto batch entry lines.
 * Incoming calculatedFee must be the performance price only — never a total that
 * already includes registration (that was the EFT double-charge bug).
 */

import { collectRegistrationKeys } from './event-pricing';

export interface RegistrationCharge {
  eodsaId: string;
  dancerId: string;
}

/** Add per-event registration fee to the first batch line for each dancer not already registered. */
export function enrichBatchEntriesWithRegistrationFees(
  entries: any[],
  registrationFeePerDancer: number,
  alreadyRegistered: Set<string>
): { entries: any[]; newlyCharged: RegistrationCharge[] } {
  if (registrationFeePerDancer <= 0 || !entries.length) {
    return { entries: entries.map((e) => ({ ...e })), newlyCharged: [] };
  }

  const chargedInBatch = new Set<string>();
  const newlyCharged: RegistrationCharge[] = [];
  const result = entries.map((entry) => ({
    ...entry,
    calculatedFee: Number(entry.calculatedFee) || 0,
  }));

  for (const entry of result) {
    for (const key of collectRegistrationKeys(entry)) {
      if (alreadyRegistered.has(key) || chargedInBatch.has(key)) continue;

      entry.calculatedFee += registrationFeePerDancer;
      chargedInBatch.add(key);

      const eodsaId = String(entry.eodsaId || key);
      const dancerId = String(entry.contestantId || entry.eodsaId || key);
      newlyCharged.push({ eodsaId, dancerId });
    }
  }

  return { entries: result, newlyCharged };
}

/**
 * Overwrite each line with the backend performance fee, then add registration
 * once per new dancer. Ignores client-sent calculatedFee so EFT cannot double-charge.
 */
export function applyComputedBatchFees(
  entries: any[],
  performanceFeeByIndex: number[],
  registrationFeePerDancer: number,
  alreadyRegistered: Set<string>
): { entries: any[]; newlyCharged: RegistrationCharge[] } {
  const withPerformance = (Array.isArray(entries) ? entries : []).map((entry, i) => ({
    ...entry,
    calculatedFee: Number(performanceFeeByIndex[i]) || 0,
  }));
  return enrichBatchEntriesWithRegistrationFees(
    withPerformance,
    registrationFeePerDancer,
    alreadyRegistered
  );
}
