// The royal warrant: once the Baron has won three fair golds, the crown asks for a gift of graded
// honey every autumn. A gift given before winter keeps the warrant for another year, and every year
// it is kept raises what every jar sells for; a gift missed loses it, and the next autumn starts
// the count again.

import type { Kind } from './honey';

/** The crown's first ask comes the autumn after this many fair golds. */
export const WARRANT_GOLDS = 3;
/** Each year the warrant is kept adds this share to every price, up to `WARRANT_MAX`. */
export const WARRANT_STEP = 0.1;
export const WARRANT_MAX = 0.5;

/** The crown's ask: pure jars or pieces of comb of one kind, as a gift (no coins). */
export interface RoyalAsk {
  grade: 'pure' | 'comb';
  kind: Kind;
  count: number;
  done: boolean;
}

/** This autumn's ask: pure jars in even years and comb in odd ones, heather and clover by turns, more for every year kept. */
export function royalAsk(years: number, kept: number): RoyalAsk {
  const grade = years % 2 === 0 ? 'pure' : 'comb';
  const kind: Kind = Math.floor(years / 2) % 2 === 0 ? 'heather' : 'clover';
  const count = grade === 'pure' ? Math.min(12, 6 + 2 * kept) : Math.min(6, 3 + kept);
  return { grade, kind, count, done: false };
}

/** The share every price rises by with the warrant kept `kept` years. */
export const warrantBonus = (kept: number) => Math.min(WARRANT_MAX, WARRANT_STEP * kept);
