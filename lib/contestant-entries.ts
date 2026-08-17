import { db, unifiedDb } from '@/lib/database';

type ContestantEntry = {
  id: string;
  eodsaId?: string;
  contestantId?: string;
  participantIds?: string[];
  eventId?: string;
  nationalsEventId?: string;
  entryType?: string;
  [key: string]: unknown;
};

export async function getDancerInternalId(eodsaId: string): Promise<string | null> {
  try {
    const dancer = await unifiedDb.getDancerByEodsaId(eodsaId);
    return dancer?.id ?? null;
  } catch {
    return null;
  }
}

export function entryBelongsToDancer(
  entry: ContestantEntry,
  eodsaId: string,
  dancerInternalId: string | null
): boolean {
  if (entry.eodsaId === eodsaId) {
    return true;
  }

  if (entry.participantIds && Array.isArray(entry.participantIds)) {
    const isParticipantByEodsaId = entry.participantIds.includes(eodsaId);
    const isParticipantByInternalId =
      dancerInternalId !== null && entry.participantIds.includes(dancerInternalId);

    if (isParticipantByEodsaId || isParticipantByInternalId) {
      return true;
    }
  }

  if (
    dancerInternalId &&
    (entry.contestantId === dancerInternalId || entry.contestantId === eodsaId)
  ) {
    return true;
  }

  return false;
}

export async function getAllContestantEntriesForDancer(eodsaId: string): Promise<ContestantEntry[]> {
  const [regularEntries, nationalsEntries, dancerInternalId] = await Promise.all([
    db.getAllEventEntries(),
    db.getAllNationalsEventEntries(),
    getDancerInternalId(eodsaId),
  ]);

  const allEntries = [...regularEntries, ...nationalsEntries] as ContestantEntry[];

  return allEntries.filter((entry) => entryBelongsToDancer(entry, eodsaId, dancerInternalId));
}

export function normalizeEntryEventId(entry: ContestantEntry): string | undefined {
  return entry.eventId || entry.nationalsEventId;
}

export function isVirtualEntry(entry: ContestantEntry): boolean {
  return entry.entryType === 'virtual' || Boolean(entry.nationalsEventId);
}
