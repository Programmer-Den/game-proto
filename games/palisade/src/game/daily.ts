// The daily siege: one seeded run a day, the same for every player. A fresh ranger (level 1, no
// upgrades, legacy or heat) starts on wave 1 of the vale with two set relics, and every road, omen,
// boss chest, weather and wayside event is set by the day's seed instead of rolled, so everyone
// meets the same ones. One try a day; the score is the waves cleared before the hero falls (shared/daily.ts keeps it).

import type { Rand } from '../../../../shared/daily';
import { OMEN_IDS, type OmenId } from './omens';
import { RELIC_IDS, type RelicId } from './relics';
import { ROAD_IDS, type RoadId } from './roads';
import { eventWave, rollEvent, type WaysideEvent } from './wayside';
import { rollWeather, type WeatherId } from './weather';

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
  /** The weather of each wave (null for clear), by wave. */
  weather: (WeatherId | null)[];
  /** The wayside event of the break before each wave that can have one (null for none), by wave. */
  events: (WaysideEvent | null)[];
}

/** The day's plan from its random source (`dailyRand(DAILY_GAME)`). */
export function dailyPlan(rand: Rand, day: string): DailyPlan {
  const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)];
  const relics = Array.from({ length: DAILY_RELICS }, () => pick(RELIC_IDS));
  const roads = Array.from({ length: PLAN_WAVES / 10 }, () => pick(ROAD_IDS));
  const omens = Array.from({ length: PLAN_WAVES + 1 }, () => pick(OMEN_IDS));
  const chests = Array.from({ length: PLAN_WAVES / 10 }, () => [pick(RELIC_IDS), pick(RELIC_IDS)]);
  // Drawn after the rest, so the relics, roads, omens and chests of a day stay as they were.
  const weather = Array.from({ length: PLAN_WAVES + 1 }, (_, wave) => rollWeather(wave, rand));
  const events = Array.from({ length: PLAN_WAVES + 1 }, (_, wave) => (eventWave(wave) ? rollEvent(rand) : null));
  return { day, relics, roads, omens, chests, weather, events };
}

/** The plan's entry for the road after a boss, or the omen of a wave, wrapping round past its end. */
export const planned = <T>(list: T[], i: number) => list[((i % list.length) + list.length) % list.length];
