/**
 * Ensure an approved event_entry has a performances row linked to the correct event.
 * Used by dashboard loaders and item-number assignment so entries don't silently
 * disappear from backstage / judge / announcer when performance creation fails.
 */

import { getSql } from './database';

export type EntryLikeForPerformance = {
  id: string;
  event_id: string;
  item_name?: string | null;
  contestant_id?: string | null;
  participant_ids?: unknown;
  choreographer?: string | null;
  mastery?: string | null;
  item_style?: string | null;
  estimated_duration?: number | null;
  item_number?: number | null;
  entry_type?: string | null;
  music_file_url?: string | null;
  music_file_name?: string | null;
  video_external_url?: string | null;
  video_external_type?: string | null;
};

function parseParticipantIds(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function ensureContestantRowForDancer(
  sqlClient: ReturnType<typeof getSql>,
  dancerIdOrEodsa: string
): Promise<string | null> {
  const dancers = await sqlClient`
    SELECT id, eodsa_id, name, email, phone, date_of_birth
    FROM dancers
    WHERE id = ${dancerIdOrEodsa} OR eodsa_id = ${dancerIdOrEodsa}
    LIMIT 1
  ` as Array<{
    id: string;
    eodsa_id: string;
    name: string;
    email: string | null;
    phone: string | null;
    date_of_birth: string | null;
  }>;

  if (dancers.length === 0) return null;
  const dancer = dancers[0];

  const existing = await sqlClient`
    SELECT id FROM contestants WHERE id = ${dancer.id} LIMIT 1
  ` as Array<{ id: string }>;
  if (existing.length > 0) return existing[0].id;

  await sqlClient`
    INSERT INTO contestants (id, eodsa_id, name, email, phone, type, date_of_birth, registration_date)
    VALUES (
      ${dancer.id},
      ${dancer.eodsa_id},
      ${dancer.name},
      ${dancer.email || `temp-${dancer.id}@example.com`},
      ${dancer.phone || '0000000000'},
      'private',
      ${dancer.date_of_birth},
      ${new Date().toISOString()}
    )
    ON CONFLICT (id) DO NOTHING
  `;

  return dancer.id;
}

async function resolveContestantId(
  sqlClient: ReturnType<typeof getSql>,
  contestantId: string | null | undefined,
  participantIds: string[]
): Promise<string> {
  if (contestantId) {
    const contestantCheck = await sqlClient`
      SELECT id FROM contestants WHERE id = ${contestantId} LIMIT 1
    ` as Array<{ id: string }>;
    if (contestantCheck.length > 0) return contestantCheck[0].id;

    const fromDancer = await ensureContestantRowForDancer(sqlClient, contestantId);
    if (fromDancer) return fromDancer;
  }

  for (const pid of participantIds) {
    const fromParticipant = await ensureContestantRowForDancer(sqlClient, pid);
    if (fromParticipant) return fromParticipant;
  }

  throw new Error(`No valid contestant/dancer found for entry (contestant_id=${contestantId || 'null'})`);
}

async function resolveParticipantNames(
  sqlClient: ReturnType<typeof getSql>,
  participantIds: string[]
): Promise<string[]> {
  const names: string[] = [];
  for (let i = 0; i < participantIds.length; i++) {
    const pid = participantIds[i];
    try {
      const dancerResult = await sqlClient`
        SELECT name FROM dancers WHERE id = ${pid} OR eodsa_id = ${pid} LIMIT 1
      ` as Array<{ name: string }>;
      if (dancerResult.length > 0 && dancerResult[0].name) {
        names.push(dancerResult[0].name);
        continue;
      }
    } catch {
      // fall through
    }
    names.push(`Participant ${i + 1}`);
  }
  return names.length > 0 ? names : ['Participant 1'];
}

/**
 * Create or repair the performance row for a single event entry.
 * Returns the performance id, or null if skipped/failed.
 */
export async function ensurePerformanceForEntry(
  entry: EntryLikeForPerformance,
  options?: { itemNumberOverride?: number | null }
): Promise<{ performanceId: string; created: boolean; repairedEventId: boolean } | null> {
  const sqlClient = getSql();
  const entryId = entry.id;
  const eventId = entry.event_id;

  if (!entryId || !eventId) return null;

  const existing = await sqlClient`
    SELECT id, event_id, item_number FROM performances WHERE event_entry_id = ${entryId} LIMIT 1
  ` as Array<{ id: string; event_id: string; item_number: number | null }>;

  const desiredItemNumber =
    options?.itemNumberOverride != null
      ? options.itemNumberOverride
      : entry.item_number != null
        ? entry.item_number
        : null;

  if (existing.length > 0) {
    const perf = existing[0];
    let repairedEventId = false;

    if (perf.event_id !== eventId) {
      await sqlClient`
        UPDATE performances SET event_id = ${eventId} WHERE id = ${perf.id}
      `;
      repairedEventId = true;
      console.log(`🔧 Repaired performance ${perf.id} event_id ${perf.event_id} → ${eventId}`);
    }

    if (desiredItemNumber != null && perf.item_number !== desiredItemNumber) {
      await sqlClient`
        UPDATE performances SET item_number = ${desiredItemNumber} WHERE id = ${perf.id}
      `;
    }

    return { performanceId: perf.id, created: false, repairedEventId };
  }

  const participantIds = parseParticipantIds(entry.participant_ids);
  const contestantId = await resolveContestantId(sqlClient, entry.contestant_id, participantIds);
  const participantNames = await resolveParticipantNames(sqlClient, participantIds);
  const performanceId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  try {
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS music_cue TEXT`;
    await sqlClient`ALTER TABLE performances ADD COLUMN IF NOT EXISTS age_category TEXT`;
  } catch {
    // ignore migration noise
  }

  await sqlClient`
    INSERT INTO performances (
      id, event_id, event_entry_id, contestant_id, title, participant_names, duration,
      choreographer, mastery, item_style, scheduled_time, status, item_number, music_cue,
      entry_type, video_external_url, video_external_type, music_file_url, music_file_name
    )
    VALUES (
      ${performanceId},
      ${eventId},
      ${entryId},
      ${contestantId},
      ${entry.item_name || 'Untitled Performance'},
      ${JSON.stringify(participantNames)},
      ${entry.estimated_duration || 0},
      ${entry.choreographer || ''},
      ${entry.mastery || 'Water (Competitive)'},
      ${entry.item_style || ''},
      NULL,
      'scheduled',
      ${desiredItemNumber},
      NULL,
      ${entry.entry_type || 'live'},
      ${entry.video_external_url || null},
      ${entry.video_external_type || null},
      ${entry.music_file_url || null},
      ${entry.music_file_name || null}
    )
  `;

  console.log(`✅ Created performance ${performanceId} for entry ${entryId} (${entry.item_name})`);
  return { performanceId, created: true, repairedEventId: false };
}

/**
 * For a given event, repair wrong event_ids and create any missing performances
 * for approved entries (paid preferred; also approved+item_number for admin-assigned programs).
 */
export async function ensurePerformancesForEvent(eventId: string): Promise<{
  created: number;
  repaired: number;
  failed: number;
}> {
  const sqlClient = getSql();
  let created = 0;
  let repaired = 0;
  let failed = 0;

  // Repair performances linked to this event's entries but pointing at another event
  try {
    const mismatched = await sqlClient`
      UPDATE performances p
      SET event_id = ee.event_id
      FROM event_entries ee
      WHERE p.event_entry_id = ee.id
        AND ee.event_id = ${eventId}
        AND p.event_id IS DISTINCT FROM ee.event_id
      RETURNING p.id
    ` as Array<{ id: string }>;
    repaired += mismatched.length;
    if (mismatched.length > 0) {
      console.log(`🔧 Repaired ${mismatched.length} performance event_id mismatch(es) for event ${eventId}`);
    }
  } catch (err) {
    console.error('Error repairing performance event_ids:', err);
  }

  // Create missing performances for approved entries that should appear on dashboards
  const missing = await sqlClient`
    SELECT
      ee.id, ee.event_id, ee.item_name, ee.contestant_id, ee.participant_ids,
      ee.choreographer, ee.mastery, ee.item_style, ee.estimated_duration, ee.item_number,
      ee.entry_type, ee.music_file_url, ee.music_file_name,
      ee.video_external_url, ee.video_external_type, ee.payment_status, ee.approved
    FROM event_entries ee
    WHERE ee.event_id = ${eventId}
      AND ee.approved = true
      AND (
        ee.payment_status = 'paid'
        OR ee.item_number IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM performances p WHERE p.event_entry_id = ee.id
      )
  ` as EntryLikeForPerformance[];

  for (const entry of missing) {
    try {
      const result = await ensurePerformanceForEntry(entry);
      if (result?.created) created += 1;
      else if (result?.repairedEventId) repaired += 1;
    } catch (err) {
      failed += 1;
      console.error(`⚠️ Failed to ensure performance for entry ${entry.id} (${entry.item_name}):`, err);
    }
  }

  return { created, repaired, failed };
}
