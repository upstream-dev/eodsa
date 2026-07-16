import { getAgeCategoryFromAge, calculateAgeOnDate } from './types';

/**
 * Official EODSA competition-age rule (confirmed with Gabriel):
 *
 * A dancer's competition age for a season is the age they will be on a
 * permanent fixed date: 1 October of that season year.
 * That age is used for Regional events, Nationals, qualification, age
 * categories, eligibility, and fee lookups — so a dancer stays in one age
 * category for the whole season.
 *
 * Nationals may move by ~a week each year; we do NOT use the actual event
 * weekend for age. Always 1 October.
 */

/** Month is 1-based for readability in config. */
export const NATIONALS_REFERENCE = {
  month: 10, // October
  day: 1,
} as const;

/**
 * End of the October Nationals window — used only to decide which season an
 * event date belongs to (not for age calculation). Events through 31 Oct of
 * year Y use season Y (age as of 1 Oct Y). After that → season Y+1.
 */
export const NATIONALS_SEASON_END = {
  month: 10,
  day: 31,
} as const;

/** Parse YYYY-MM-DD (or Date) as a local calendar date — avoids UTC off-by-one. */
export function parseDateOnly(input: Date | string): Date {
  if (input instanceof Date) {
    return new Date(input.getFullYear(), input.getMonth(), input.getDate());
  }
  const s = String(input).trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${input}`);
  }
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Season year for a given date.
 * Regionals and Nationals through 31 Oct of year Y belong to season Y.
 * Dates after 31 Oct belong to season Y+1.
 */
export function getSeasonYear(asOf: Date | string = new Date()): number {
  const d = parseDateOnly(asOf);
  const year = d.getFullYear();
  const seasonEnd = new Date(year, NATIONALS_SEASON_END.month - 1, NATIONALS_SEASON_END.day);
  return d.getTime() > seasonEnd.getTime() ? year + 1 : year;
}

/** Competition-age reference date for a season year (always 1 October). */
export function getNationalsReferenceDate(seasonYear: number): Date {
  return new Date(seasonYear, NATIONALS_REFERENCE.month - 1, NATIONALS_REFERENCE.day);
}

export type CompetitionAgeContext = {
  /** Event date (or any date in the season) — used to resolve season year. */
  eventDate?: Date | string | null;
  /** Explicit season year override (e.g. 2026). */
  seasonYear?: number | null;
  /** Fallback "as of" date when eventDate is missing (defaults to today). */
  asOf?: Date | string | null;
};

export function resolveSeasonYear(context: CompetitionAgeContext = {}): number {
  if (context.seasonYear != null && Number.isFinite(context.seasonYear)) {
    return Number(context.seasonYear);
  }
  if (context.eventDate) {
    return getSeasonYear(context.eventDate);
  }
  return getSeasonYear(context.asOf ?? new Date());
}

/**
 * Competition age = age the dancer will be on 1 October of that season year.
 */
export function getCompetitionAge(
  dateOfBirth: Date | string,
  context: CompetitionAgeContext = {}
): number {
  const seasonYear = resolveSeasonYear(context);
  const referenceDate = getNationalsReferenceDate(seasonYear);
  return calculateAgeOnDate(parseDateOnly(dateOfBirth), referenceDate);
}

export function getCompetitionAgeCategory(
  dateOfBirth: Date | string,
  context: CompetitionAgeContext = {}
): string {
  return getAgeCategoryFromAge(getCompetitionAge(dateOfBirth, context));
}

/** Chronological (calendar) age as of today — for legal/guardian checks only. */
export function getChronologicalAge(
  dateOfBirth: Date | string,
  asOf: Date | string = new Date()
): number {
  return calculateAgeOnDate(parseDateOnly(dateOfBirth), parseDateOnly(asOf));
}

export function checkAgeEligibility(dancerAge: number, ageCategory: string): boolean {
  switch (ageCategory) {
    case 'All Ages':
    case 'All':
      return true;
    case '4 & Under':
      return dancerAge <= 4;
    case '6 & Under':
      return dancerAge <= 6;
    case '7-9':
      return dancerAge >= 7 && dancerAge <= 9;
    case '10-12':
      return dancerAge >= 10 && dancerAge <= 12;
    case '13-14':
      return dancerAge >= 13 && dancerAge <= 14;
    case '15-17':
      return dancerAge >= 15 && dancerAge <= 17;
    case '18-24':
      return dancerAge >= 18 && dancerAge <= 24;
    case '25-39':
      return dancerAge >= 25 && dancerAge <= 39;
    case '40+':
      return dancerAge >= 40 && dancerAge < 60;
    case '60+':
      return dancerAge >= 60;
    default:
      console.warn(`Unknown age category: ${ageCategory}`);
      return true;
  }
}

/**
 * Attach competition + chronological ages derived from DOB.
 * Prefer competitionAge for eligibility/categories; chronologicalAge for legal UI.
 */
export function withCompetitionAges<T extends { age?: number | null; dateOfBirth?: string | null; date_of_birth?: string | null }>(
  dancer: T,
  context: CompetitionAgeContext = {}
): T & {
  competitionAge: number | null;
  chronologicalAge: number | null;
  competitionAgeCategory: string | null;
  nationalsReferenceDate: string;
  seasonYear: number;
} {
  const dob = dancer.dateOfBirth ?? dancer.date_of_birth ?? null;
  const seasonYear = resolveSeasonYear(context);
  const nationalsReferenceDate = getNationalsReferenceDate(seasonYear);
  const refIso = `${nationalsReferenceDate.getFullYear()}-${String(NATIONALS_REFERENCE.month).padStart(2, '0')}-${String(NATIONALS_REFERENCE.day).padStart(2, '0')}`;

  if (!dob) {
    return {
      ...dancer,
      competitionAge: typeof dancer.age === 'number' ? dancer.age : null,
      chronologicalAge: typeof dancer.age === 'number' ? dancer.age : null,
      competitionAgeCategory: typeof dancer.age === 'number' ? getAgeCategoryFromAge(dancer.age) : null,
      nationalsReferenceDate: refIso,
      seasonYear,
    };
  }

  const competitionAge = getCompetitionAge(dob, { seasonYear });
  const chronologicalAge = getChronologicalAge(dob);

  return {
    ...dancer,
    competitionAge,
    chronologicalAge,
    // Keep stored age as chronological for studio/legal consumers that still read `age`
    age: chronologicalAge,
    competitionAgeCategory: getAgeCategoryFromAge(competitionAge),
    nationalsReferenceDate: refIso,
    seasonYear,
  };
}

/**
 * Average competition age for a group, then map to category.
 * Used for duet/trio/group age categories.
 */
export function getAverageCompetitionAgeCategory(
  datesOfBirth: Array<Date | string | null | undefined>,
  context: CompetitionAgeContext = {}
): string {
  const ages = datesOfBirth
    .filter((d): d is Date | string => d != null && d !== '')
    .map((d) => getCompetitionAge(d, context));

  if (ages.length === 0) return 'N/A';

  const averageAge = Math.round(ages.reduce((sum, a) => sum + a, 0) / ages.length);
  return getAgeCategoryFromAge(averageAge);
}
