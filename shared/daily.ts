/**
 * A daily challenge: the same seeded run for every player on the same day, one try a day, with
 * today's score and the best ever kept on this device. A game keeps its record under
 * `<game>-daily` (so it goes with the game's progress), seeds its run with `dailyRand(game)` and
 * calls `startDaily` when the run begins and `finishDaily` with the score when it ends. A finish
 * with no day closes the try that was started, under the day it was started on, so a run that
 * crosses midnight still counts for the day it began.
 *
 * Hotfoot, Augury, Ninefold and Tiny Kingdom keep their own older dailies.
 */

/** A source of numbers from 0 (included) to 1. */
export type Rand = () => number;

/** Today's date as `YYYY-MM-DD`, in the player's own time zone: the daily's key. */
export function today(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** A whole-number seed from a text (FNV-1a). */
export function seedOf(key: string) {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h | 0;
}

/** A repeatable random source (mulberry32) from a whole number. */
export function seeded(seed: number): Rand {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Today's random source for a game's daily: the same for every player on the same day. */
export const dailyRand = (game: string, day = today()) => seeded(seedOf(`${game}:${day}`));

/** What a game remembers about its daily. `score` is today's, null until today's try ends. */
export interface DailyRecord {
  day: string;
  /** Today's try was started, so it can't be started again. */
  played: boolean;
  score: number | null;
  best: number;
  /** Days in a row with a finished try, ending today or yesterday. */
  streak: number;
  /** The last day a try was finished. */
  last: string | null;
}

const key = (game: string) => `${game}-daily`;

function yesterday(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return today(new Date(y, m - 1, d - 1));
}

/** The game's daily record as saved, not rolled over. */
function stored(game: string): Partial<DailyRecord> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key(game)) ?? '{}');
    if (value && typeof value === 'object' && !Array.isArray(value)) return value as Partial<DailyRecord>;
  } catch {
    // A broken or blocked record starts over.
  }
  return {};
}

/** The day of a try that was started and not yet finished, if there is one. */
function startedDay(game: string) {
  const s = stored(game);
  return s.played === true && s.score === null && typeof s.day === 'string' ? s.day : undefined;
}

/** The game's daily record, rolled over to `day`: a new day clears `played` and `score`. */
export function loadDaily(game: string, day = today()): DailyRecord {
  const saved = stored(game);
  const best = typeof saved.best === 'number' && Number.isFinite(saved.best) ? saved.best : 0;
  const last = typeof saved.last === 'string' ? saved.last : null;
  const alive = last === day || last === yesterday(day);
  const streak = alive && typeof saved.streak === 'number' ? Math.max(0, Math.floor(saved.streak)) : 0;
  if (saved.day !== day) return { day, played: false, score: null, best, streak, last };
  return {
    day,
    played: saved.played === true,
    score: typeof saved.score === 'number' ? saved.score : null,
    best,
    streak,
    last,
  };
}

function save(game: string, record: DailyRecord) {
  try {
    localStorage.setItem(key(game), JSON.stringify(record));
  } catch {
    // Storage can be blocked; the daily still plays.
  }
}

/** Marks today's try as started, so leaving it half way still uses it up. */
export function startDaily(game: string, day = today()): DailyRecord {
  const record = { ...loadDaily(game, day), played: true };
  save(game, record);
  return record;
}

/**
 * Ends the started try with `score`, raising the best and the streak. Only the first finish counts.
 * With no `day` it closes the try under the day it was started on (today if none is open).
 */
export function finishDaily(game: string, score: number, day = startedDay(game) ?? today()): DailyRecord {
  const record = loadDaily(game, day);
  if (record.score !== null) return record;
  const streak = record.last === yesterday(day) ? record.streak + 1 : record.last === day ? record.streak : 1;
  const done = { ...record, played: true, score, best: Math.max(record.best, score), streak, last: day };
  save(game, done);
  return done;
}
