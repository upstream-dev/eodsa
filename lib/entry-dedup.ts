/**
 * Duplicate detection for event entries.
 * Same cart line (clientLineId) or same content (name + style + choreographer + type + dancers)
 * — not name + dancer alone, so two solos can share a title.
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

export interface EntryLineExtras {
  clientLineId?: string | null;
  itemStyle?: string | null;
  choreographer?: string | null;
  performanceType?: string | null;
  storedLineKey?: string | null;
}

/** Stable key for one cart/payment line. Prefers clientLineId so same titles stay distinct. */
export function batchEntryFingerprint(
  itemName: string,
  participantIds: string[],
  extras: EntryLineExtras = {}
): string {
  if (extras.storedLineKey) return String(extras.storedLineKey);
  if (extras.clientLineId && String(extras.clientLineId).trim()) {
    return `line:${String(extras.clientLineId).trim()}`;
  }
  const ids = [...participantIds].map(String).filter(Boolean).sort();
  const style = (extras.itemStyle || '').trim().toLowerCase();
  const choreo = (extras.choreographer || '').trim().toLowerCase();
  const type = (extras.performanceType || '').trim().toLowerCase();
  return `content:${normalizeItemName(itemName)}|${style}|${choreo}|${type}|${ids.join(',')}`;
}

/** Find an existing entry for this event + this line (any payment). */
export async function findExistingEntryIdForLine(
  eventId: string,
  itemName: string,
  participantIds: string[],
  extras: EntryLineExtras = {}
): Promise<string | null> {
  const sql = getSql();
  const fingerprint = batchEntryFingerprint(itemName, participantIds, extras);

  const rows = await sql`
    SELECT id, item_name, participant_ids, item_style, choreographer, performance_type, entry_line_key
    FROM event_entries
    WHERE event_id = ${eventId}
  ` as Array<{
    id: string;
    item_name: string;
    participant_ids: unknown;
    item_style?: string | null;
    choreographer?: string | null;
    performance_type?: string | null;
    entry_line_key?: string | null;
  }>;

  for (const row of rows) {
    const ids = parseParticipantIds(row.participant_ids);
    const rowKey = batchEntryFingerprint(row.item_name, ids, {
      storedLineKey: row.entry_line_key,
      itemStyle: row.item_style,
      choreographer: row.choreographer,
      performanceType: row.performance_type,
    });
    if (rowKey === fingerprint) {
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
