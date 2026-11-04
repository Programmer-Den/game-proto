// The daily siege: one seeded run a day, the same for every player. A fresh ranger (level 1, no
// upgrades, legacy or heat) starts on wave 1 of the vale with two set relics, and every road, omen
// and boss chest is set by the day's seed instead of rolled, so everyone meets the same ones. One
// try a day; the score is the waves cleared before the hero falls (shared/daily.ts keeps it).

import type { Rand } from '../../../../shared/daily';
import { OMEN_IDS, type OmenId } from './omens';
import { RELIC_IDS, type RelicId } from './relics';
import { ROAD_IDS, type RoadId } from './roads';

/** The storage name the shared daily keeps its record under (`palisade-daily`). */
export const DAILY_GAME = 'palisade';
/** Relics the daily hero starts with. */
export const DAILY_RELICS = 2;
/** Waves the plan covers; past them it starts over (no daily hero gets that far). */
const PLAN_WAVES = 100;

/** The day's set run: what would otherwise be rolled (the starting relics, roads, omens and chests). */
export interface DailyPlan {
  day: string;
  /** The relics the hero starts with. */
  relics: RelicId[];
  /** The road taken after each boss: `roads[0]` after wave 10, `roads[1]` after wave 20, and so on. */
  roads: RoadId[];
  /** The omen named for each wave that has one (`omenWave`), by wave. */
  omens: OmenId[];
  /** Each boss's chest: `chests[0]` after wave 10, and so on (two relics, for a Hardened Road). */
  chests: RelicId[][];
}

/** The day's plan from its random source (`dailyRand(DAILY_GAME)`). */
export function dailyPlan(rand: Rand, day: string): DailyPlan {
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const relics = Array.from({ length: DAILY_RELICS }, () => pick(RELIC_IDS));
  const roads = Array.from({ length: PLAN_WAVES / 10 }, () => pick(ROAD_IDS));
  const omens = Array.from({ length: PLAN_WAVES + 1 }, () => pick(OMEN_IDS));
  const chests = Array.from({ length: PLAN_WAVES / 10 }, () => [pick(RELIC_IDS), pick(RELIC_IDS)]);
  return { day, relics, roads, omens, chests };
}

/** The plan's entry for the road after a boss, or the omen of a wave, wrapping round past its end. */
export const planned = <T>(list: T[], i: number) => list[((i % list.length) + list.length) % list.length];
