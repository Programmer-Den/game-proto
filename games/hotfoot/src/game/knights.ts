// The knights who can run the road: the knight everyone starts with, and two more unlocked with
// banked coins in the armoury. The squire jumps twice but has a heart fewer; the heavy knight
// smashes the goblins and bats he runs into but jumps lower. Each keeps their own best distance and
// their own ghost. Their numbers are applied in `stats` in state.ts and in `tick` in sim.ts; names
// and texts are keys of `i18n/en.ts`, shown with `t`.
import type { TextKey } from '../i18n';

export type KnightId = 'knight' | 'squire' | 'heavy';

export interface Knight {
  name: TextKey;
  text: TextKey;
  /** Banked coins to unlock; 0 for the knight everyone starts with. */
  price: number;
}

export const KNIGHTS: Record<KnightId, Knight> = {
  knight: { name: 'knightName', text: 'knightText', price: 0 },
  squire: { name: 'squireName', text: 'squireText', price: 120 },
  heavy: { name: 'heavyName', text: 'heavyText', price: 160 },
};

export const KNIGHT_IDS = Object.keys(KNIGHTS) as KnightId[];

/**
 * What each knight changes: jumps more before touching the ground, hearts more (or fewer), the
 * share of the jump's height, and whether goblins and bats run into are smashed instead of hurting.
 */
export const KNIGHT_EACH: Record<KnightId, { jumps: number; hearts: number; height: number; smash: boolean }> = {
  knight: { jumps: 0, hearts: 0, height: 1, smash: false },
  squire: { jumps: 1, hearts: -1, height: 1, smash: false },
  heavy: { jumps: 0, hearts: 0, height: 0.8, smash: true },
};
