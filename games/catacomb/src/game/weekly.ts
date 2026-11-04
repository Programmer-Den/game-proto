import { seeded, seedOf, today } from '../../../../shared/daily';

// The weekly crypt: one seeded run from Monday to Sunday, the same for everyone, with two
// mutators (more elites, no campfires; see `makeMap`), played as often as you like for the
// week's best score, kept under `catacomb-weekly`.

/** What changes the weekly crypt's maps: no campfires (they become fights) and more elites (fights from the fourth column on become elites). */
export interface Mutators {
  noRest: boolean;
  moreElites: boolean;
}

export const WEEKLY_MUTATORS: Mutators = { noRest: true, moreElites: true };

/** The week's key: its Monday as `YYYY-MM-DD`, in the player's own time zone. */
export function weekOf(day = today()) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return today(new Date(y, m - 1, d - ((date.getDay() + 6) % 7)));
}

/** The week's random source: the same for every player in the same week. */
export const weeklyRand = (week: string) => seeded(seedOf(`catacomb:week:${week}`));

/** This week's record: the best score and how many tries; a new week starts both over. */
export interface WeeklyRecord {
  week: string;
  best: number;
  tries: number;
}

const KEY = 'catacomb-weekly';

export function loadWeekly(week = weekOf()): WeeklyRecord {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (saved && typeof saved === 'object' && (saved as WeeklyRecord).week === week) {
      const { best, tries } = saved as Partial<WeeklyRecord>;
      return {
        week,
        best: typeof best === 'number' && Number.isFinite(best) ? best : 0,
        tries: typeof tries === 'number' && Number.isFinite(tries) ? Math.max(0, Math.floor(tries)) : 0,
      };
    }
  } catch {
    // A broken or blocked record starts over.
  }
  return { week, best: 0, tries: 0 };
}

export function saveWeekly(record: WeeklyRecord) {
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Storage can be full or blocked; the game keeps running unsaved.
  }
}
