import { byDifficulty } from '../../../../shared/settings';
import { ISLANDS, type Building } from './tiles';

// Where a kingdom is built: a random island, one typed in by its number, the island of the day,
// a campaign level, or the next island of a chain. The island itself always follows from its
// number (islandMap), and on a chain from its place in the chain too (chainMap).

export type Mode = 'random' | 'code' | 'daily' | 'campaign' | 'chain';

/**
 * How a new kingdom is chosen. `level` is the campaign level (1 and up), `day` the daily island's
 * date. A chain island (`mode` 'chain') has its `link` in the chain (2 and up), the final scores
 * of the islands before it (`chainScore`) and the `cargo` the last island's harbours shipped.
 */
export interface Kingdom {
  mode: Mode;
  level?: number;
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
