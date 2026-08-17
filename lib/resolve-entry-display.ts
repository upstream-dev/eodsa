import { db, getSql, unifiedDb } from '@/lib/database';

type EntryLike = {
  id?: string;
  contestantId?: string;
  eodsaId?: string;
  participantIds?: string[];
};

export type ResolvedEntryDisplay = {
  contestantName: string;
  participantNames: string[];
  studioName: string;
  displayEodsaId: string;
};

async function lookupPersonById(id: string): Promise<{
  name: string | null;
  eodsaId: string | null;
  dancerInternalId: string | null;
}> {
  const sqlClient = getSql();

  const dancerRows = (await sqlClient`
    SELECT id, name, eodsa_id FROM dancers
    WHERE id = ${id} OR eodsa_id = ${id}
    LIMIT 1
  `) as Array<{ id: string; name: string; eodsa_id: string }>;

  if (dancerRows.length > 0) {
    return {
      name: dancerRows[0].name,
      eodsaId: dancerRows[0].eodsa_id,
      dancerInternalId: dancerRows[0].id,
    };
  }

  const contestantRows = (await sqlClient`
    SELECT id, name, eodsa_id FROM contestants
    WHERE id = ${id} OR eodsa_id = ${id}
    LIMIT 1
  `) as Array<{ id: string; name: string; eodsa_id: string }>;

  if (contestantRows.length > 0) {
    return {
      name: contestantRows[0].name,
      eodsaId: contestantRows[0].eodsa_id,
      dancerInternalId: null,
    };
  }

  return { name: null, eodsaId: null, dancerInternalId: null };
}

async function lookupStudioForDancer(dancerInternalId: string): Promise<string | null> {
  const sqlClient = getSql();
  const rows = (await sqlClient`
    SELECT s.name as studio_name
    FROM studio_applications sa
    JOIN studios s ON sa.studio_id = s.id
    WHERE sa.dancer_id = ${dancerInternalId} AND sa.status = 'accepted'
    LIMIT 1
  `) as Array<{ studio_name: string }>;

  return rows[0]?.studio_name ?? null;
}

export async function resolveEntryDisplay(entry: EntryLike): Promise<ResolvedEntryDisplay> {
  const participantIds = Array.isArray(entry.participantIds) ? entry.participantIds : [];
  const participantNames: string[] = [];
  let displayEodsaId = entry.eodsaId || '';
  let studioName = 'Independent';
  const dancerIdsForStudio: string[] = [];

  for (let i = 0; i < participantIds.length; i++) {
    const person = await lookupPersonById(participantIds[i]);
    participantNames.push(person.name || `Participant ${i + 1}`);
    if (person.eodsaId && !displayEodsaId.match(/^E\d/i)) {
      displayEodsaId = person.eodsaId;
    }
    if (person.dancerInternalId) {
      dancerIdsForStudio.push(person.dancerInternalId);
    }
  }

  if (participantNames.length === 0 && entry.contestantId) {
    const contestantPerson = await lookupPersonById(entry.contestantId);
    if (contestantPerson.name) {
      participantNames.push(contestantPerson.name);
    }
    if (contestantPerson.eodsaId && !displayEodsaId.match(/^E\d/i)) {
      displayEodsaId = contestantPerson.eodsaId;
    }
    if (contestantPerson.dancerInternalId) {
      dancerIdsForStudio.push(contestantPerson.dancerInternalId);
    }
  }

  if (participantNames.length === 0 && entry.eodsaId) {
    const ownerPerson = await lookupPersonById(entry.eodsaId);
    if (ownerPerson.name) {
      participantNames.push(ownerPerson.name);
    }
    if (ownerPerson.eodsaId && !displayEodsaId.match(/^E\d/i)) {
      displayEodsaId = ownerPerson.eodsaId;
    }
    if (ownerPerson.dancerInternalId) {
      dancerIdsForStudio.push(ownerPerson.dancerInternalId);
    }
  }

  for (const dancerId of dancerIdsForStudio) {
    const studio = await lookupStudioForDancer(dancerId);
    if (studio) {
      studioName = studio;
      break;
    }
  }

  if (studioName === 'Independent' && entry.contestantId) {
    try {
      const contestant = await db.getContestantById(entry.contestantId);
      if (contestant?.studioName) {
        studioName = contestant.studioName;
      } else if (contestant?.type === 'studio' && contestant.name) {
        studioName = contestant.name;
      }
    } catch {
      // ignore
    }
  }

  if (studioName === 'Independent' && entry.eodsaId) {
    try {
      const studios = await unifiedDb.getAllStudios?.();
      const matchedStudio = Array.isArray(studios)
        ? studios.find((s: { registrationNumber?: string; name?: string }) => s.registrationNumber === entry.eodsaId)
        : null;
      if (matchedStudio?.name) {
        studioName = matchedStudio.name;
      }
    } catch {
      // ignore
    }
  }

  const contestantName =
    participantNames.length > 0 ? participantNames.join(', ') : displayEodsaId || 'Unknown Contestant';

  return {
    contestantName,
    participantNames: participantNames.length > 0 ? participantNames : ['Unknown Contestant'],
    studioName,
    displayEodsaId: displayEodsaId || entry.eodsaId || 'Unknown',
  };
}
