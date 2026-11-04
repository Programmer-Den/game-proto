import { seeded, seedOf, type Rand } from '../../../../shared/daily';

// Every random draw of the rules goes through `random()`. Normally that is `Math.random`, read at
// each call so the playthrough's seeded `Math.random` still drives it draw for draw; the daily
// crypt swaps in the day's seeded source instead (`setRandom`), and `withRandom` lends a source for
// one draw, so the daily's card offers in a room come out the same whatever happened before.

let source: Rand | null = null;

/** A number from 0 (included) to 1: the daily's source while one is set, Math.random otherwise. */
export const random = () => (source ? source() : Math.random());

/** Draws from `rand` from now on, or from Math.random again with null. */
export function setRandom(rand: Rand | null) {
  source = rand;
}

/** Runs `fn` with `rand` as the source, then puts the old one back. */
export function withRandom<T>(rand: Rand, fn: () => T): T {
  const before = source;
  source = rand;
  try {
    return fn();
  } finally {
    source = before;
  }
}

/** A source for one key of the day's daily: the same for every player on that day. */
export const keyedRand = (key: string) => seeded(seedOf(`catacomb:${key}`));
