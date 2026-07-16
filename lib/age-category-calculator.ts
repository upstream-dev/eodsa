import { getAverageCompetitionAgeCategory, getCompetitionAge } from './competition-age';
import { unifiedDb } from './database';

/**
 * Calculate age category for an entry from participants' competition ages.
 *
 * Official rule: competition age = age on 1 October of the season year
 * (permanent fixed date). Same category for the whole season
 * (regionals + nationals).
 */
export async function calculateAgeCategoryForEntry(
  participantIds: string[],
  eventDate: string,
  sqlClient: any
): Promise<string> {
  try {
    if (!participantIds || participantIds.length === 0) {
      return 'N/A';
    }

    const context = { eventDate };
    const datesOfBirth: Array<string | null> = await Promise.all(
      participantIds.map(async (participantId: string) => {
        try {
          const dancer = await unifiedDb.getDancerById(participantId);
          if (dancer?.dateOfBirth) {
            return dancer.dateOfBirth;
          }

          const result = await sqlClient`
            SELECT date_of_birth FROM dancers
            WHERE id = ${participantId} OR eodsa_id = ${participantId}
            LIMIT 1
          ` as any[];

          if (result.length > 0 && result[0].date_of_birth) {
            return result[0].date_of_birth as string;
          }
          return null;
        } catch (error) {
          console.warn(`Could not get DOB for participant ${participantId}:`, error);
          return null;
        }
      })
    );

    const ages = datesOfBirth
      .filter((d): d is string => !!d)
      .map((dob) => getCompetitionAge(dob, context));

    if (ages.length === 0) {
      return 'N/A';
    }

    const category = getAverageCompetitionAgeCategory(datesOfBirth, context);

    console.log(
      `✅ Competition age category: ${category} (ages on Nationals ref: ${ages.join(', ')}; eventDate=${eventDate})`
    );

    return category;
  } catch (error) {
    console.error('Error calculating age category:', error);
    return 'N/A';
  }
}

/**
 * Batch calculate age categories for multiple entries
 */
export async function calculateAgeCategoriesForEntries(
  entries: Array<{ participantIds: string[]; eventDate: string }>,
  sqlClient: any
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (const entry of entries) {
    const entryKey = entry.participantIds.sort().join(',');
    const category = await calculateAgeCategoryForEntry(
      entry.participantIds,
      entry.eventDate,
      sqlClient
    );
    results.set(entryKey, category);
  }

  return results;
}
