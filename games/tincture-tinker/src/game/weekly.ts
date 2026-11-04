import { seeded, seedOf, today, type Rand } from '../../../../shared/daily';
import { byDifficulty } from '../../../../shared/settings';
import { holesOf } from './board';
import { ALL_RECIPES, type Order } from './orders';
import { TOWNS } from './towns';

// The weekly order: one seeded board for the whole week (the same order, board and every tile that
// drops in for everyone), played as often as you like. It never sells: the moves are played out and
// the score is what was gathered of its recipe's ingredients, each cascade step counting one more
// time than the one before. The best score of the week is kept under `tincture-tinker-weekly`.

/** The moves the weekly order is played with on Normal. */
export const WEEKLY_MOVES = 20;
/** The score for one, two and three stars on the result card. */
export const WEEKLY_STARS = [50, 100, 150];

/** The week `day` (`YYYY-MM-DD`, the player's own time zone) falls in, named by its Monday. */
export function weekOf(day = today()) {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  // Sunday is 0: count back to the Monday of the week.
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return today(date);
}

/** The week's random source: the same for every player in the same week. */
export const weeklyRand = (week: string) => seeded(seedOf(`tincture-tinker:week:${week}`));

/** Stars for a weekly score, 0 to 3. */
export const weeklyStars = (score: number) => WEEKLY_STARS.filter((n) => score >= n).length;

/**
 * The weekly order for `week`, drawn from `rand`: one of every recipe, a town's board shape and a
 * few blockers. The same `rand` goes on to lay the board and drop the tiles in.
 */
export function weeklyOrder(rand: Rand, week: string, number: number): Order {
  const recipe = ALL_RECIPES[Math.floor(rand() * ALL_RECIPES.length)];
  const town = Math.floor(rand() * TOWNS.length);
  return {
    number,
    potion: recipe.potion,
    needs: { ...recipe.needs },
    moves: Math.max(5, WEEKLY_MOVES + byDifficulty(5, 0, -3)),
    price: 0,
    jars: 1 + Math.floor(rand() * 2),
    resin: 1 + Math.floor(rand() * 2),
    mould: 0,
    holes: holesOf(TOWNS[town].shape),
    weekly: { week, town },
  };
}

/** What the game remembers about the weekly order: the week, its best score and how many tries it had. */
export interface WeeklyRecord {
  week: string;
  best: number;
  tries: number;
}

const KEY = 'tincture-tinker-weekly';

/** The record for `week`: a new week starts with no best and no tries. */
export function loadWeekly(week = weekOf()): WeeklyRecord {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (saved && typeof saved === 'object' && (saved as WeeklyRecord).week === week) {
      const { best, tries } = saved as WeeklyRecord;
      const ok = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0;
      return { week, best: ok(best) ? best : 0, tries: ok(tries) ? tries : 0 };
    }
  } catch {
    // A broken or blocked record starts over.
  }
  return { week, best: 0, tries: 0 };
}

/** Counts a finished try of `week`'s order with `score`, keeping the best; returns the record. */
export function finishWeekly(week: string, score: number): WeeklyRecord {
  const record = loadWeekly(week);
  const next = { week, best: Math.max(record.best, score), tries: record.tries + 1 };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage can be full or blocked; the try still counts on screen.
  }
  return next;
}
