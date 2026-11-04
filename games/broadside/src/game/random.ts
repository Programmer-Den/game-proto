// The sim's one source of randomness. A normal run draws from `Math.random` (which the playthrough
// seeds); the daily voyage swaps in the day's seeded source, so every player sails the same sea.

import type { Rand } from '../../../../shared/daily';

let source: Rand = () => Math.random();

/** A number from 0 (included) to 1, from the run's source. */
export const random = () => source();

/** Draws the run's numbers from `rand` (the daily's seeded source), or from `Math.random` again without one. */
export function useRandom(rand?: Rand) {
  source = rand ?? (() => Math.random());
}
