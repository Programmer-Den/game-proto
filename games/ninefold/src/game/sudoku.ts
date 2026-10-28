// Puzzle making and solving for every board size Ninefold plays: 4x4 (2x2 boxes), 6x6 (boxes two
// rows tall and three cells wide) and 9x9 (3x3 boxes). Cells are indexed row by row from 0, a
// value of 0 is empty and digits run from 1 to `size`. No Phaser.

/** A board's shape: its side and the width and height of its boxes. */
export interface Shape {
  size: number;
  boxW: number;
  boxH: number;
  /** Both long diagonals are units too (a Delve twist). */
  diagonal?: boolean;
}

export const SHAPES: Record<4 | 6 | 9, Shape> = {
  4: { size: 4, boxW: 2, boxH: 2 },
  6: { size: 6, boxW: 3, boxH: 2 },
  9: { size: 9, boxW: 3, boxH: 3 },
};

export interface Puzzle extends Shape {
  /** The finished board. */
  solution: number[];
  /** Which cells start filled in. */
  givens: boolean[];
  /** Cells marked to hold an even digit (a Delve twist); every other cell holds an odd one. */
  even?: boolean[];
}

/** A source of numbers from 0 (included) to 1: `Math.random`, or `seeded` for the daily puzzle. */
export type Random = () => number;

/** A repeatable random source (mulberry32) from a whole number. */
export function seeded(seed: number): Random {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The seed of the daily puzzle for a date, from its year, month and day (local time). */
export function dailySeed(date: Date) {
  return date.getFullYear() * 10_000 + (date.getMonth() + 1) * 100 + date.getDate();
}

/** The daily seed of the day after the one given. */
export function nextDay(seed: number) {
  const y = Math.floor(seed / 10_000);
  const m = Math.floor(seed / 100) % 100;
  const d = seed % 100;
  return dailySeed(new Date(y, m - 1, d + 1));
}

/** The box a cell is in, numbered row by row. */
export function boxOf(shape: Shape, cell: number) {
  const r = Math.floor(cell / shape.size);
  const c = cell % shape.size;
  return Math.floor(r / shape.boxH) * (shape.size / shape.boxW) + Math.floor(c / shape.boxW);
}

/** Every unit of a board (its rows, then columns, then boxes), each as its cells. */
export function units(shape: Shape): number[][] {
  const { size } = shape;
  const out: number[][] = [];
  for (let r = 0; r < size; r++) out.push(Array.from({ length: size }, (_, c) => r * size + c));
  for (let c = 0; c < size; c++) out.push(Array.from({ length: size }, (_, r) => r * size + c));
  const boxes: number[][] = Array.from({ length: size }, () => []);
  for (let i = 0; i < size * size; i++) boxes[boxOf(shape, i)].push(i);
  if (shape.diagonal) {
    boxes.push(Array.from({ length: size }, (_, k) => k * size + k));
    boxes.push(Array.from({ length: size }, (_, k) => k * size + size - 1 - k));
  }
  return out.concat(boxes);
}

/** The cells that share a row, column or box with each cell, itself left out. */
export function peersOf(shape: Shape): number[][] {
  const n = shape.size * shape.size;
  const sets = Array.from({ length: n }, () => new Set<number>());
  for (const unit of units(shape)) for (const a of unit) for (const b of unit) if (a !== b) sets[a].add(b);
  return sets.map((s) => [...s]);
}

/** Shuffles the items in place (Fisher-Yates) and returns them. */
export function shuffle<T>(items: T[], random: Random) {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * Counts the board's solutions, stopping at `limit`; when `random` is given, tries digits in a
 * random order and leaves the first solution found in `grid`. Picks the cell with the fewest
 * candidates each step, which keeps 9x9 boards fast.
 */
function search(shape: Shape, grid: number[], peers: number[][], limit: number, random?: Random, even?: boolean[]): number {
  const { size } = shape;
  let best = -1;
  let bestMask = 0;
  let bestCount = size + 1;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i]) continue;
    let used = 0;
    for (const p of peers[i]) if (grid[p]) used |= 1 << grid[p];
    let count = 0;
    let mask = 0;
    for (let d = 1; d <= size; d++) if (!(used & (1 << d)) && (!even || even[i] === (d % 2 === 0))) (mask |= 1 << d), count++;
    if (count < bestCount) {
      best = i;
      bestMask = mask;
      bestCount = count;
      if (count <= 1) break;
    }
  }
  if (best < 0) return 1;
  if (bestCount === 0) return 0;
  const digits: number[] = [];
  for (let d = 1; d <= size; d++) if (bestMask & (1 << d)) digits.push(d);
  if (random) shuffle(digits, random);
  let found = 0;
  for (const d of digits) {
    grid[best] = d;
    found += search(shape, grid, peers, limit - found, random, even);
    if (found >= limit) {
      if (random) return found;
      break;
    }
  }
  if (!(random && found)) grid[best] = 0;
  return found;
}

/** How many solutions a board has, counting no further than `limit`; `even` marks cells that must hold an even digit. */
export function countSolutions(shape: Shape, grid: number[], limit = 2, even?: boolean[]) {
  return search(shape, grid.slice(), peersOf(shape), limit, undefined, even);
}

/**
 * Makes a puzzle with exactly one solution and about `givens` cells filled in: a random full
 * board, then cells emptied in a random order while the solution stays unique. A board that can't
 * lose another cell keeps a few more givens. With `parity`, the board marks its even cells and the
 * solution only has to be unique with that marking.
 */
export function makePuzzle(shape: Shape, givens: number, random: Random, parity = false): Puzzle {
  const peers = peersOf(shape);
  const n = shape.size * shape.size;
  const solution = new Array<number>(n).fill(0);
  search(shape, solution, peers, 1, random);
  const even = parity ? solution.map((d) => d % 2 === 0) : undefined;
  const grid = solution.slice();
  let filled = n;
  for (const cell of shuffle(Array.from({ length: n }, (_, i) => i), random)) {
    if (filled <= givens) break;
    const keep = grid[cell];
    grid[cell] = 0;
    if (search(shape, grid.slice(), peers, 2, undefined, even) === 1) filled--;
    else grid[cell] = keep;
  }
  return { ...shape, solution, givens: grid.map((v) => v !== 0), ...(even ? { even } : {}) };
}
