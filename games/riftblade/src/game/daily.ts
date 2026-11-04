/**
 * The daily run: a shorter run of three worlds, its worlds and mutator the same for every player on
 * the same day, one try a day (`shared/daily.ts` keeps today's score, the best and the streak under
 * `riftblade-daily`). Its hero (one of this save's open heroes, so it can differ between players)
 * and one mutator come from the day; it is fought at heat 0 without the
 * Armoury, and `rand` is seeded from `dailySeed` the way a weekly run's is from `weekSeed`.
 * Imports nothing from the game but tables and types.
 */
import { dailyRand, seedOf } from '../../../../shared/daily';
import type { HeroId } from './heroes';
import { LAST_STAGE } from './planets';
import { MUTATOR_IDS, type MutatorId } from './weekly';

/** The game's name for `shared/daily.ts` (its record is `riftblade-daily`). */
export const DAILY_GAME = 'riftblade';
/** The daily's last jump (0-based): three worlds, ending on one of Ice, Crystal, Storm and Ruin. */
export const DAILY_LAST_STAGE = 2;
/** Score per boss beaten (kills add one each), and the credits banked for today's first win. */
export const DAILY = { boss: 1000, bonus: 40 };

/** The day's hero (from those open) and its one mutator. */
export function dailyOf(day: string, open: readonly HeroId[]): { hero: HeroId; mutators: MutatorId[] } {
  const r = dailyRand(DAILY_GAME, day);
  const hero = open[Math.floor(r() * open.length)] ?? 'tr9';
  return { hero, mutators: [MUTATOR_IDS[Math.floor(r() * MUTATOR_IDS.length)]] };
}

/** The seed of the day's run (`rand` reseeds from it world by world). */
export const dailySeed = (day: string) => seedOf(`${DAILY_GAME}:run:${day}`) >>> 0;

/** The run's last jump: three worlds for a daily, four otherwise. */
export const lastStage = (s: { daily: string }) => (s.daily ? DAILY_LAST_STAGE : LAST_STAGE);
/** How many jumps the run has. */
export const stagesOf = (s: { daily: string }) => lastStage(s) + 1;

/** A daily's score: 1000 per boss beaten plus one per kill. */
export function dailyScore(s: { phase: string; stage: number; arena: boolean; kills: number }) {
  // A run lost in the elite arena has beaten the boss of the world before it too.
  const beaten = s.phase === 'won' || s.arena ? s.stage + 1 : s.stage;
  return beaten * DAILY.boss + s.kills;
}
