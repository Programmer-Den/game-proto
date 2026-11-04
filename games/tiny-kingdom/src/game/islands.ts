import { byDifficulty } from '../../../../shared/settings';
import { ISLANDS, type Building } from './tiles';

// Where a kingdom is built: a random island, one typed in by its number, the island of the day,
// a campaign level, or the next island of a chain. The island itself always follows from its
// number (islandMap), and on a chain from its place in the chain too (chainMap).

export type Mode = 'random' | 'code' | 'daily' | 'campaign' | 'chain' | 'puzzle' | 'rival';

/**
 * How a new kingdom is chosen. `level` is the campaign level (1 and up), `day` the daily island's
 * date. A chain island (`mode` 'chain') has its `link` in the chain (2 and up), the final scores
 * of the islands before it (`chainScore`) and the `cargo` the last island's harbours shipped.
 */
export interface Kingdom {
  mode: Mode;
  level?: number;
  /** The puzzle island (1 and up) for mode 'puzzle'. */
  puzzle?: number;
  day?: string;
  link?: number;
  chainScore?: number;
  cargo?: Partial<Record<Building, number>>;
}

/** A campaign level: its island and the final scores that earn one, two and three stars. */
export interface Level {
  island: number;
  stars: [number, number, number];
}

/**
 * The campaign: eight islands, from roomy ones with plenty of shore to cramped ones. Each level
 * needs a star on the one before it. The star scores were set from a greedy player's final score
 * (drawing hands of three, the castle bonus included) on each island on Normal: one star at three
 * quarters of it, two at nine tenths, three above it.
 */
export const LEVELS: Level[] = [
  { island: 75, stars: [230, 270, 320] },
  { island: 324, stars: [230, 280, 320] },
  { island: 1990, stars: [200, 230, 270] },
  { island: 4242, stars: [210, 250, 300] },
  { island: 6772, stars: [190, 230, 270] },
  { island: 2718, stars: [190, 220, 260] },
  { island: 9473, stars: [180, 210, 250] },
  { island: 5810, stars: [170, 200, 230] },
];

/**
 * The scores that earn one, two and three stars on campaign level `level` (1 and up) at the chosen
 * difficulty. `LEVELS` holds Normal's; the same greedy player's mean final score over 300 islands
 * is 1% higher on Easy and 6% lower on Hard, so the stars move with it.
 */
export const starScores = (level: number) => LEVELS[level - 1].stars.map((s) => Math.round(s * byDifficulty(1.01, 1, 0.94))) as Level['stars'];

/** Stars a final score earns on campaign level `level` (1 and up): 0 to 3. */
export const starsFor = (level: number, score: number) => starScores(level).filter((s) => score >= s).length;

/** Whether level `level` can be played, given the best stars won on each level so far. */
export const levelOpen = (level: number, stars: readonly number[]) => level === 1 || (stars[level - 2] ?? 0) > 0;

/**
 * A puzzle island: a fixed island, a set pouch (nothing more comes: no rounds, gifts, decrees,
 * omens or seasons) and the final scores that earn one, two and three stars. The kingdom ends when
 * the pouch is empty, and the castle still pays for what it joins.
 */
export interface Puzzle {
  island: number;
  pouch: Partial<Record<Building, number>>;
  stars: [number, number, number];
}

/**
 * The thirty puzzle islands, from a handful of farms and houses to pouches with gift buildings and
 * a wonder. Each needs a star on the one before it. The star scores were set by a script that
 * plays each pouch with the game's own hands: one star at 85% of a greedy player's final score, two
 * at the greedy score, three at the best a beam search (40 boards) found, so three stars can be won.
 */
export const PUZZLES: Puzzle[] = [
  { island: 4417, pouch: { farm: 3, house: 5 }, stars: [26, 30, 34] },
  { island: 2382, pouch: { farm: 5, house: 3 }, stars: [19, 22, 34] },
  { island: 1752, pouch: { farm: 5, house: 3 }, stars: [24, 28, 34] },
  { island: 7921, pouch: { farm: 3, house: 6 }, stars: [23, 27, 38] },
  { island: 646, pouch: { farm: 2, house: 7 }, stars: [24, 28, 39] },
  { island: 2711, pouch: { farm: 3, house: 3, tower: 3 }, stars: [23, 27, 33] },
  { island: 2730, pouch: { farm: 4, house: 4, tower: 2 }, stars: [27, 32, 45] },
  { island: 17, pouch: { farm: 4, house: 3, tower: 3 }, stars: [28, 33, 42] },
  { island: 4075, pouch: { farm: 2, house: 5, tower: 3 }, stars: [38, 45, 48] },
  { island: 9454, pouch: { farm: 6, house: 3, tower: 2 }, stars: [30, 35, 46] },
  { island: 2056, pouch: { farm: 5, house: 2, windmill: 3, road: 1 }, stars: [36, 42, 43] },
  { island: 5495, pouch: { farm: 4, house: 2, tower: 4, windmill: 1 }, stars: [24, 28, 42] },
  { island: 4066, pouch: { farm: 3, house: 5, tower: 1, windmill: 3 }, stars: [44, 52, 53] },
  { island: 5888, pouch: { farm: 3, house: 2, tower: 5, windmill: 2 }, stars: [29, 34, 44] },
  { island: 4294, pouch: { farm: 6, house: 2, tower: 2, windmill: 2 }, stars: [37, 43, 50] },
  { island: 3848, pouch: { farm: 3, house: 3, tower: 2, windmill: 1, market: 1, harbor: 3 }, stars: [31, 36, 56] },
  { island: 5451, pouch: { farm: 2, house: 2, tower: 2, windmill: 1, market: 2, harbor: 3, road: 1 }, stars: [41, 48, 50] },
  { island: 6317, pouch: { farm: 3, house: 2, tower: 1, windmill: 1, market: 3, harbor: 2, road: 1 }, stars: [31, 37, 44] },
  { island: 260, pouch: { farm: 5, house: 2, tower: 1, windmill: 2, harbor: 2, road: 2 }, stars: [45, 53, 56] },
  { island: 9021, pouch: { farm: 4, house: 4, tower: 2, windmill: 2, market: 1, harbor: 1 }, stars: [48, 57, 63] },
  { island: 4384, pouch: { farm: 2, house: 4, tower: 3, market: 3, cathedral: 1, road: 2 }, stars: [44, 52, 64] },
  { island: 7590, pouch: { farm: 2, house: 3, tower: 1, market: 2, harbor: 4, temple: 1, road: 2 }, stars: [40, 47, 55] },
  { island: 3698, pouch: { farm: 3, house: 5, market: 2, harbor: 1, lumber: 2, granary: 1, road: 2 }, stars: [58, 68, 69] },
  { island: 6399, pouch: { farm: 3, house: 5, tower: 2, lumber: 1, temple: 1, road: 3 }, stars: [35, 41, 43] },
  { island: 9956, pouch: { farm: 3, house: 3, tower: 4, market: 2, lumber: 1, temple: 1, gardens: 1, road: 2 }, stars: [61, 72, 80] },
  { island: 7370, pouch: { farm: 4, house: 3, tower: 4, market: 1, harbor: 1, lumber: 1, road: 2 }, stars: [42, 49, 59] },
  { island: 377, pouch: { farm: 3, house: 4, tower: 1, market: 1, harbor: 2, lumber: 3, temple: 1, cathedral: 1, road: 1 }, stars: [56, 66, 74] },
  { island: 184, pouch: { farm: 2, house: 5, windmill: 2, market: 2, harbor: 3, lumber: 1, temple: 2 }, stars: [53, 62, 69] },
  { island: 8187, pouch: { farm: 5, house: 2, tower: 4, windmill: 1, harbor: 2, lumber: 3, granary: 1 }, stars: [54, 64, 80] },
  { island: 7481, pouch: { farm: 2, house: 2, tower: 1, windmill: 2, market: 1, harbor: 1, lumber: 3, temple: 3, road: 2 }, stars: [42, 49, 56] },
];

/**
 * The scores that earn one, two and three stars on puzzle `n` (1 and up) at the chosen difficulty: a
 * little lower on Easy, higher on Hard but never above the best score found, so three stars stay reachable
 * (and the first two stay just below it, so two stars stay a step of their own).
 */
export const puzzleStars = (n: number) => {
  const stars = PUZZLES[n - 1].stars;
  return stars.map((s, i) =>
    Math.min(Math.round(s * byDifficulty(0.9, 1, 1.05)), i < 2 ? stars[2] - 1 : stars[2]),
  ) as Puzzle['stars'];
};

/** Stars a final score earns on puzzle `n` (1 and up): 0 to 3. */
export const puzzleStarsFor = (n: number, score: number) => puzzleStars(n).filter((s) => score >= s).length;

/** Today's date as YYYY-MM-DD, in the player's own time zone. */
export function today(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The island of the day for date `day` (YYYY-MM-DD): the same for every player that day. */
export function dailyIsland(day: string) {
  let h = 2166136261;
  for (const ch of day) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return 1 + ((h >>> 0) % ISLANDS);
}

/** A typed island number, or null unless it is a whole number from 1 to ISLANDS. */
export function parseIsland(text: string) {
  const n = Number(text);
  return /^\d+$/.test(text) && n >= 1 && n <= ISLANDS ? n : null;
}
