/**
 * Cross-payment duplicate detection for event entries.
 * Same dancer + same item + same event = one entry, regardless of payment_id.
 */

import { getSql } from './database';

function normalizeItemName(name: string): string {
  return (name || '').trim().toLowerCase();
}

export function parseParticipantIds(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.filter(Boolean).map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(Boolean).map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Stable key: item name + sorted participant ids. */
export function batchEntryFingerprint(itemName: string, participantIds: string[]): string {
  const ids = [...participantIds].map(String).filter(Boolean).sort();
  return `${normalizeItemName(itemName)}|${ids.join(',')}`;
}

/** Find an existing entry for this event + item + participants (any payment). */
export async function findExistingEntryIdForLine(
  eventId: string,
  itemName: string,
  participantIds: string[]
): Promise<string | null> {
  const sql = getSql();
  const fingerprint = batchEntryFingerprint(itemName, participantIds);

  const rows = await sql`
    SELECT id, item_name, participant_ids
    FROM event_entries
    WHERE event_id = ${eventId}
  ` as Array<{ id: string; item_name: string; participant_ids: unknown }>;

  for (const row of rows) {
    const ids = parseParticipantIds(row.participant_ids);
    if (batchEntryFingerprint(row.item_name, ids) === fingerprint) {
      return row.id;
    }
  }
  return null;
}

/** Entries already submitted under this EFT invoice for an event. */
export async function countEntriesForEftInvoice(
  eventId: string,
  invoiceNumber: string
): Promise<number> {
  if (!invoiceNumber?.trim()) return 0;
  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS c
    FROM event_entries
    WHERE event_id = ${eventId}
      AND payment_method = 'eft'
      AND payment_reference = ${invoiceNumber.trim()}
  ` as Array<{ c: number }>;
  return rows[0]?.c ?? 0;
}
