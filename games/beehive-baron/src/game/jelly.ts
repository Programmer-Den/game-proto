// Royal jelly: an empty honey cell ringed by six capped cells turns into a jelly cell, which makes a
// royal jelly while the ring holds. Jelly sells dear, or is fed to the queens for a season of brood
// that hatches twice as fast. Only the comb's inner spots have six neighbours, so the comb's shape
// decides where a jelly cell can go.

import { SEASON_MS } from './seasons';

/** A jelly cell: makes one royal jelly in `JELLY_MS` while it is ringed by six capped cells. */
export interface JellyCell {
  type: 'jelly';
  /** Time left until its royal jelly is ready to take; 0 once it is. */
  jellyMs: number;
}

/** How long a ringed jelly cell takes to make its royal jelly (the clock stops while the ring is broken). */
export const JELLY_MS = 60_000;
/** A jar of royal jelly sells for this many times a heather jar's worth before the market. */
export const JELLY_MULT = 3;
/** Fed to the queens, a royal jelly makes every brood cell hatch `FED_BROOD` times as fast for `FED_MS` (a season). */
export const FED_MS = SEASON_MS;
export const FED_BROOD = 2;
/** The neighbours a cell needs capped around it: all six. */
export const RING = 6;
