/**
 * The game's one source of chance. Everything random in the sim and the match (shops, pairings,
 * terrain, drafts, crits and dodges) draws from `rand`, which is `Math.random` unless a match has
 * set its own: the daily lobby seeds it (`useRand`) so every player gets the same lobby that day.
 * No Phaser.
 */
export type Rand = () => number;

const plain: Rand = () => Math.random();
let current: Rand = plain;

/** A number from 0 (included) to 1, from the current match's source. */
export const rand: Rand = () => current();

/** Sets the source `rand` draws from; null goes back to `Math.random`. */
export function useRand(source: Rand | null) {
  current = source ?? plain;
}
