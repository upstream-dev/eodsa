/**
 * Find and resolve duplicate event_entries for an event.
 */

import { getSql } from './database';
import { batchEntryFingerprint, parseParticipantIds } from './entry-dedup';

export interface DuplicateEntryRow {
  id: string;
  itemName: string;
  paymentStatus: string;
  paymentMethod: string | null;
  paymentId: string | null;
  paymentReference: string | null;
  calculatedFee: number;
  submittedAt: string | null;
  itemNumber: number | null;
  approved: boolean;
  hasPerformance: boolean;
  hasMusic: boolean;
}

export interface DuplicateGroup {
  fingerprint: string;
  itemName: string;
  participantIds: string[];
  keepEntryId: string;
  deleteEntryIds: string[];
  likelyDoubleCharge: boolean;
  entries: DuplicateEntryRow[];
}

function scoreEntryForKeep(row: DuplicateEntryRow): number {
  let score = 0;
  if (row.itemNumber != null && row.itemNumber > 0) score += 100;
  if (row.hasMusic) score += 50;
  if (row.hasPerformance) score += 20;
  if (row.approved) score += 10;
  if (row.paymentStatus === 'paid') score += 5;
  if (row.paymentId) score += 3;
  // Prefer earlier submission (stable tie-break)
  if (row.submittedAt) {
    score -= new Date(row.submittedAt).getTime() / 1e15;
  }
  return score;
}

export function pickEntryToKeep(rows: DuplicateEntryRow[]): { keepId: string; deleteIds: string[] } {
  const sorted = [...rows].sort((a, b) => scoreEntryForKeep(b) - scoreEntryForKeep(a));
  const keepId = sorted[0].id;
  const deleteIds = sorted.slice(1).map((r) => r.id);
  return { keepId, deleteIds };
}

export async function findDuplicateGroupsForEvent(eventId: string): Promise<DuplicateGroup[]> {
  const sql = getSql();

  const rows = await sql`
    SELECT
      ee.id,
      ee.item_name,
      ee.participant_ids,
      ee.payment_status,
      ee.payment_method,
      ee.payment_id,
      ee.payment_reference,
      ee.calculated_fee,
      ee.submitted_at,
      ee.item_number,
      ee.approved,
      EXISTS (SELECT 1 FROM performances p WHERE p.event_entry_id = ee.id) AS has_performance,
      (
        (ee.music_file_url IS NOT NULL AND ee.music_file_url != '')
        OR EXISTS (
          SELECT 1 FROM performances p
          WHERE p.event_entry_id = ee.id
            AND p.music_file_url IS NOT NULL AND p.music_file_url != ''
        )
      ) AS has_music
    FROM event_entries ee
    WHERE ee.event_id = ${eventId}
  ` as Array<{
    id: string;
    item_name: string;
    participant_ids: unknown;
    payment_status: string;
    payment_method: string | null;
    payment_id: string | null;
    payment_reference: string | null;
    calculated_fee: string | number;
    submitted_at: string | null;
    item_number: number | null;
    approved: boolean;
    has_performance: boolean;
    has_music: boolean;
  }>;

  const groups = new Map<string, DuplicateEntryRow[]>();

  for (const row of rows) {
    const participantIds = parseParticipantIds(row.participant_ids);
    const fp = batchEntryFingerprint(row.item_name, participantIds);
    const entry: DuplicateEntryRow = {
      id: row.id,
      itemName: row.item_name,
      paymentStatus: row.payment_status,
      paymentMethod: row.payment_method,
      paymentId: row.payment_id,
      paymentReference: row.payment_reference,
      calculatedFee: parseFloat(String(row.calculated_fee)) || 0,
      submittedAt: row.submitted_at,
      itemNumber: row.item_number,
      approved: row.approved,
      hasPerformance: row.has_performance,
      hasMusic: row.has_music,
    };
    if (!groups.has(fp)) groups.set(fp, []);
    groups.get(fp)!.push(entry);
  }

  const duplicateGroups: DuplicateGroup[] = [];

  for (const [fingerprint, entries] of groups) {
    if (entries.length < 2) continue;
    const { keepId, deleteIds } = pickEntryToKeep(entries);
    const paymentIds = new Set(entries.map((e) => e.paymentId).filter(Boolean));
    const paidCount = entries.filter((e) => e.paymentStatus === 'paid').length;

    const rawRow = rows.find((r) => r.id === keepId);
    duplicateGroups.push({
      fingerprint,
      itemName: entries[0].itemName,
      participantIds: parseParticipantIds(rawRow?.participant_ids),
      keepEntryId: keepId,
      deleteEntryIds: deleteIds,
      likelyDoubleCharge: paymentIds.size > 1 && paidCount > 1,
      entries,
    });
  }

  duplicateGroups.sort((a, b) => a.itemName.localeCompare(b.itemName));
  return duplicateGroups;
}
