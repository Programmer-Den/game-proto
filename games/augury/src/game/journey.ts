import type { Card } from './run';
import type { KindId, Level } from './kinds';

// The Oracle's journey: forty set puzzles in five temples of eight steps, each temple teaching a
// few kinds and ending in a boss. A step earns up to three stars; a temple opens once the one
// before it holds `TEMPLE_STARS`. No Phaser.

export const TEMPLES = 5;
export const STEPS = 8;
export const NODES = TEMPLES * STEPS;
/** Stars a temple needs before the next one opens (of 24). */
export const TEMPLE_STARS = 12;
/** A solve keeps 3 stars with this share of its time left, 2 with `STAR_SHARES[1]`, else 1; each paid hint takes one (down to 1). */
export const STAR_SHARES = [0.5, 0.25] as const;

/** The kinds each temple teaches, dealt in turn; its boss pairs the first two. */
export const TEMPLE_KINDS: KindId[][] = [
  ['nonogram', 'flip'],
  ['bridges', 'sums'],
  ['code', 'calc'],
  ['unjam', 'link', 'echo'],
  ['slide', 'series'],
];

export const templeOf = (node: number) => Math.floor(node / STEPS);
export const isBossNode = (node: number) => node % STEPS === STEPS - 1;

/** The fixed card of a step: the same puzzle for every player. */
export function journeyCard(node: number): Card {
  const temple = templeOf(node);
  const step = node % STEPS;
  const kinds = TEMPLE_KINDS[temple];
  const level = Math.min(3, Math.floor(temple / 2) + (step >= 4 ? 1 : 0)) as Level;
  const seed = (node + 1) * 104_729 + 7;
  if (isBossNode(node)) return { kind: kinds[0], level, seed, boss: { kind: kinds[1], level, seed: seed + 1 } };
  return { kind: kinds[step % kinds.length], level, seed };
}

/** Stars for a step: 0 unsolved, else by the time left and the paid hints. */
export function starsFor(solved: boolean, timeShare: number, paidHints: number) {
  if (!solved) return 0;
  const byTime = timeShare >= STAR_SHARES[0] ? 3 : timeShare >= STAR_SHARES[1] ? 2 : 1;
  return Math.max(1, byTime - paidHints);
}

export const templeStars = (stars: number[], temple: number) => stars.slice(temple * STEPS, (temple + 1) * STEPS).reduce((a, b) => a + b, 0);
export const totalStars = (stars: number[]) => stars.reduce((a, b) => a + b, 0);
export const templeOpen = (stars: number[], temple: number) => temple === 0 || templeStars(stars, temple - 1) >= TEMPLE_STARS;
/** A step opens once its temple is open and the step before it has a star. */
export const nodeOpen = (stars: number[], node: number) =>
  node >= 0 && node < NODES && templeOpen(stars, templeOf(node)) && (node % STEPS === 0 || stars[node - 1] > 0);
