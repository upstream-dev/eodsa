/**
 * Tests for EFT/PayFast registration fee assignment.
 * Run: npx --yes tsx --test lib/__tests__/batch-registration-fees.test.ts
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyComputedBatchFees,
  enrichBatchEntriesWithRegistrationFees,
} from '../batch-registration-fees';
import {
  collectRegistrationKeys,
  countNewRegistrantsOnEntry,
  getExpectedFlatLineFees,
} from '../event-pricing';

const nationals = {
  soloPrice: 320,
  duetPrice: 0,
  groupPrice: 0,
  registrationFee: 250,
};

describe('collectRegistrationKeys', () => {
  it('uses participant IDs only and does not treat studio eodsaId as a second dancer', () => {
    const keys = collectRegistrationKeys({
      performanceType: 'Solo',
      participantIds: ['dancer-uuid-1'],
      eodsaId: 'STUDIO-REG-99',
    });
    assert.deepEqual(keys, ['dancer-uuid-1']);
  });

  it('falls back to eodsaId when there are no participants', () => {
    const keys = collectRegistrationKeys({
      performanceType: 'Solo',
      eodsaId: 'E123456',
    });
    assert.deepEqual(keys, ['E123456']);
  });
});

describe('EFT double-charge regression (R820 bug)', () => {
  it('does not add registration on top of a client total that already includes it', () => {
    // Old EFT path: validate-fee returned 570, then enrich added another 250 → 820
    const clientAlreadyIncludedRegistration = [
      {
        itemName: 'Roxanne solo',
        performanceType: 'Solo',
        participantIds: ['dancer-1'],
        eodsaId: 'dancer-1',
        contestantId: 'studio-1',
        calculatedFee: 570,
      },
    ];

    const naive = enrichBatchEntriesWithRegistrationFees(
      clientAlreadyIncludedRegistration,
      250,
      new Set()
    );
    assert.equal(naive.entries[0].calculatedFee, 820, 'documents the old bug: 570 + 250');

    const fixed = applyComputedBatchFees(
      clientAlreadyIncludedRegistration,
      [320],
      250,
      new Set()
    );
    assert.equal(fixed.entries[0].calculatedFee, 570);
    assert.equal(fixed.newlyCharged.length, 1);
  });

  it('charges registration once across two solos for the same dancer in one batch', () => {
    const entries = [
      {
        itemName: 'Something going down',
        performanceType: 'Solo',
        participantIds: ['charmone'],
        eodsaId: 'charmone',
        calculatedFee: 999,
      },
      {
        itemName: "He's watching u",
        performanceType: 'Solo',
        participantIds: ['charmone'],
        eodsaId: 'charmone',
        calculatedFee: 999,
      },
    ];

    const result = applyComputedBatchFees(entries, [320, 320], 250, new Set());
    assert.equal(result.entries[0].calculatedFee, 570);
    assert.equal(result.entries[1].calculatedFee, 320);
    assert.equal(result.newlyCharged.length, 1);
  });

  it('does not charge registration again when the dancer already has an entry in this event', () => {
    const entries = [
      {
        itemName: 'Second solo',
        performanceType: 'Solo',
        participantIds: ['dancer-1'],
        eodsaId: 'dancer-1',
        calculatedFee: 320,
      },
    ];
    const result = applyComputedBatchFees(entries, [320], 250, new Set(['dancer-1']));
    assert.equal(result.entries[0].calculatedFee, 320);
    assert.equal(result.newlyCharged.length, 0);
  });
});

describe('getExpectedFlatLineFees', () => {
  it('shows registration + solo for a first nationals entry', () => {
    const fees = getExpectedFlatLineFees(
      { performanceType: 'Solo', participantIds: ['dancer-1'] },
      nationals,
      1
    );
    assert.equal(fees.performanceFee, 320);
    assert.equal(fees.registrationFee, 250);
    assert.equal(fees.totalFee, 570);
  });

  it('shows performance only for a later entry by the same dancer', () => {
    const fees = getExpectedFlatLineFees(
      { performanceType: 'Solo', participantIds: ['dancer-1'] },
      nationals,
      0
    );
    assert.equal(fees.performanceFee, 320);
    assert.equal(fees.registrationFee, 0);
    assert.equal(fees.totalFee, 320);
  });
});

describe('countNewRegistrantsOnEntry', () => {
  it('charges registration for nationals even if the dancer competed at regionals (different event)', () => {
    const nationalsEntry = {
      performanceType: 'Solo',
      participantIds: ['dancer-1'],
      eodsaId: 'dancer-1',
    };
    // Prior entries must be scoped to the same event by the caller.
    // Regional entries are not passed in, so registration is still due.
    assert.equal(countNewRegistrantsOnEntry(nationalsEntry, []), 1);
  });
});
