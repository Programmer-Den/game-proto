// The daily voyage: the same seeded run for every player on the same day, one try a day
// (`shared/daily.ts`). It sails a set ship with three perks already taken, ends at the haven or
// when the ship goes down, and scores by waves beaten and gold plundered.

import type { Rand } from '../../../../shared/daily';
import { HULL_IDS, type HullId } from './hulls';
import { PERK_IDS, type PerkId } from './perks';
import type { GameState } from './state';

/** The name the daily keeps its record under (`broadside-daily`). */
export const DAILY_GAME = 'broadside';
/** How many perks the voyage starts with. */
export const VOYAGE_PERKS = 3;
/** Points for each wave beaten; each gold plundered is one more. */
export const WAVE_POINTS = 100;

/** The day's ship and perks, drawn from the day's random source (which the run goes on drawing from). */
export function drawVoyage(rand: Rand): { hull: HullId; perks: PerkId[] } {
  const hull = HULL_IDS[Math.floor(rand() * HULL_IDS.length)];
  const left = [...PERK_IDS];
  const perks: PerkId[] = [];
  while (perks.length < VOYAGE_PERKS) perks.push(left.splice(Math.floor(rand() * left.length), 1)[0]);
  return { hull, perks };
}

/** The waves a run has beaten so far: the wave in harbor or won, else the one before. */
export const wavesBeaten = (s: GameState) => (s.phase === 'harbor' || s.phase === 'won' ? s.wave : s.wave - 1);

/** The voyage's score: points for the waves beaten and the gold plundered. */
export const voyageScore = (s: GameState) => WAVE_POINTS * Math.max(0, wavesBeaten(s)) + s.plundered;
