import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { batchEntryFingerprint } from '../entry-dedup';

describe('batchEntryFingerprint', () => {
  it('keeps two same-titled solos distinct when they have different cart line ids', () => {
    const a = batchEntryFingerprint('Hallelujah', ['dancer-1'], { clientLineId: 'entry-1' });
    const b = batchEntryFingerprint('Hallelujah', ['dancer-1'], { clientLineId: 'entry-2' });
    assert.notEqual(a, b);
  });

  it('treats webhook retry of the same cart line as the same entry', () => {
    const first = batchEntryFingerprint('Hallelujah', ['dancer-1'], { clientLineId: 'entry-1' });
    const retry = batchEntryFingerprint('Hallelujah', ['dancer-1'], { clientLineId: 'entry-1' });
    assert.equal(first, retry);
  });

  it('keeps same title distinct by style when no cart line id is present', () => {
    const lyrical = batchEntryFingerprint('Hallelujah', ['dancer-1'], {
      itemStyle: 'Lyrical',
      choreographer: 'Ann',
      performanceType: 'Solo',
    });
    const contemporary = batchEntryFingerprint('Hallelujah', ['dancer-1'], {
      itemStyle: 'Contemporary',
      choreographer: 'Ann',
      performanceType: 'Solo',
    });
    assert.notEqual(lyrical, contemporary);
  });
});
