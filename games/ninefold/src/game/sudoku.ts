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
  /** Killer cages: groups of cells whose digits differ and add up to `sum`. */
  cages?: Cage[];
  /** Thermometers: lines of cells, bulb first, whose digits rise along the line. */
  thermos?: number[][];
}

export interface Cage {
  cells: number[];
  sum: number;
}

/** The extra rules a board can carry, beyond rows, columns, boxes (and diagonals). */
export interface Rules {
  even?: boolean[];
  cages?: Cage[];
  thermos?: number[][];
}

/** Which kind of extra rule a new puzzle gets: Parity marks, Killer cages or Thermometer lines. */
export type Extra = 'parity' | 'killer' | 'thermo';

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

/** The rules worked out per cell once, so the search checks each candidate quickly. */
interface Checker {
  even?: boolean[];
  /** Each cell's cage index, -1 for none, and the cages. */
  cageOf: number[];
  cages: Cage[];
  /** Each cell's places on thermometers: the line and its position on it. */
  thermoAt: [number, number][][];
  thermos: number[][];
}

function checker(shape: Shape, rules: Rules = {}): Checker {
  const n = shape.size * shape.size;
  const cageOf = new Array<number>(n).fill(-1);
  (rules.cages ?? []).forEach((c, k) => c.cells.forEach((i) => (cageOf[i] = k)));
  const thermoAt: [number, number][][] = Array.from({ length: n }, () => []);
  (rules.thermos ?? []).forEach((line, k) => line.forEach((i, pos) => thermoAt[i].push([k, pos])));
  return { even: rules.even, cageOf, cages: rules.cages ?? [], thermoAt, thermos: rules.thermos ?? [] };
}

/** Whether digit `d` may go in empty cell `i` under the board's extra rules. */
function allowed(shape: Shape, ck: Checker, grid: number[], i: number, d: number) {
  if (ck.even && ck.even[i] !== (d % 2 === 0)) return false;
  const k = ck.cageOf[i];
  if (k >= 0) {
    const cage = ck.cages[k];
    let sum = d;
    let open = 0;
    for (const c of cage.cells) {
      if (c === i) continue;
      if (grid[c] === d) return false;
      if (grid[c]) sum += grid[c];
      else open++;
    }
    // The open cells left must be able to make up the rest: at least 1+2+.., at most size+(size-1)+...
    const rest = cage.sum - sum;
    const least = (open * (open + 1)) / 2;
    const most = open * shape.size - (open * (open - 1)) / 2;
    if (rest < least || rest > most) return false;
  }
  for (const [line, pos] of ck.thermoAt[i]) {
    const cells = ck.thermos[line];
    // Room below and above along the line, then every filled cell on it.
    if (d < pos + 1 || d > shape.size - (cells.length - 1 - pos)) return false;
    for (let j = 0; j < cells.length; j++) {
      const v = grid[cells[j]];
      if (!v || j === pos) continue;
      if (j < pos && d < v + (pos - j)) return false;
      if (j > pos && d > v - (j - pos)) return false;
    }
  }
  return true;
}

/**
 * Counts the board's solutions, stopping at `limit`; when `random` is given, tries digits in a
 * random order and leaves the first solution found in `grid`. Picks the cell with the fewest
 * candidates each step, which keeps 9x9 boards fast.
 */
function search(shape: Shape, grid: number[], peers: number[][], limit: number, random?: Random, ck?: Checker): number {
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
    for (let d = 1; d <= size; d++) if (!(used & (1 << d)) && (!ck || allowed(shape, ck, grid, i, d))) (mask |= 1 << d), count++;
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
    found += search(shape, grid, peers, limit - found, random, ck);
    if (found >= limit) {
      if (random) return found;
      break;
    }
  }
  if (!(random && found)) grid[best] = 0;
  return found;
}

/** How many solutions a board has under its extra rules, counting no further than `limit`. */
export function countSolutions(shape: Shape, grid: number[], limit = 2, rules: Rules = {}) {
  return search(shape, grid.slice(), peersOf(shape), limit, undefined, rules.even || rules.cages || rules.thermos ? checker(shape, rules) : undefined);
}

/** The cells next to a cell, left, right, up and down. */
function neighbours(size: number, cell: number) {
  const r = Math.floor(cell / size);
  const c = cell % size;
  const out: number[] = [];
  if (r > 0) out.push(cell - size);
  if (r < size - 1) out.push(cell + size);
  if (c > 0) out.push(cell - 1);
  if (c < size - 1) out.push(cell + 1);
  return out;
}

/** Cuts a solved board into Killer cages of 1 to 4 cells (mostly 2 and 3), no digit twice in a cage. */
export function makeCages(shape: Shape, solution: number[], random: Random): Cage[] {
  const { size } = shape;
  const n = size * size;
  const cageOf = new Array<number>(n).fill(-1);
  const cages: number[][] = [];
  for (const start of shuffle(Array.from({ length: n }, (_, i) => i), random)) {
    if (cageOf[start] >= 0) continue;
    const want = 2 + Math.floor(random() * 3);
    const cells = [start];
    cageOf[start] = cages.length;
    while (cells.length < want) {
      const digits = new Set(cells.map((c) => solution[c]));
      const next = shuffle(cells.flatMap((c) => neighbours(size, c)), random).find((q) => cageOf[q] < 0 && !digits.has(solution[q]));
      if (next === undefined) break;
      cageOf[next] = cages.length;
      cells.push(next);
    }
    cages.push(cells);
  }
  // A lone cell joins a neighbouring cage that is still small and lacks its digit.
  for (let k = 0; k < cages.length; k++) {
    if (cages[k].length !== 1) continue;
    const cell = cages[k][0];
    const into = shuffle(neighbours(size, cell), random)
      .map((q) => cageOf[q])
      .find((j) => j !== k && cages[j].length < 4 && !cages[j].some((c) => solution[c] === solution[cell]));
    if (into === undefined) continue;
    cages[into].push(cell);
    cageOf[cell] = into;
    cages[k] = [];
  }
  return cages.filter((c) => c.length).map((cells) => ({ cells: cells.sort((a, b) => a - b), sum: cells.reduce((t, c) => t + solution[c], 0) }));
}

/**
 * Draws Thermometer lines on a solved board: up to `count` paths of 3 to 6 cells, each step to a
 * cell beside or diagonal to the last whose digit is higher. No cell is on two lines.
 */
export function makeThermos(shape: Shape, solution: number[], random: Random, count = 6): number[][] {
  const { size } = shape;
  const used = new Set<number>();
  const lines: number[][] = [];
  // Diagonal steps taken, as "a-b" both ways, so no step crosses another one.
  const steps = new Set<string>();
  const crosses = (a: number, b: number) => {
    const ra = Math.floor(a / size);
    const rb = Math.floor(b / size);
    if (ra === rb || a % size === b % size) return false;
    return steps.has(`${ra * size + (b % size)}-${rb * size + (a % size)}`);
  };
  const around = (cell: number) => {
    const r = Math.floor(cell / size);
    const c = cell % size;
    const out: number[] = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const rr = r + dr;
      const cc = c + dc;
      if ((dr || dc) && rr >= 0 && cc >= 0 && rr < size && cc < size) out.push(rr * size + cc);
    }
    return out;
  };
  for (const start of shuffle(Array.from({ length: size * size }, (_, i) => i), random)) {
    if (lines.length >= count) break;
    if (used.has(start) || solution[start] > size - 2) continue;
    const line = [start];
    const want = 3 + Math.floor(random() * 4);
    while (line.length < want) {
      const last = line[line.length - 1];
      const ups = around(last).filter((q) => !used.has(q) && !line.includes(q) && solution[q] > solution[last] && !crosses(last, q));
      if (!ups.length) break;
      // The smallest step up keeps the line going longest.
      ups.sort((a, b) => solution[a] - solution[b]);
      const next = ups[Math.floor(random() * Math.min(2, ups.length))];
      steps.add(`${last}-${next}`).add(`${next}-${last}`);
      line.push(next);
    }
    if (line.length < 3) {
      for (let k = 1; k < line.length; k++) steps.delete(`${line[k - 1]}-${line[k]}`), steps.delete(`${line[k]}-${line[k - 1]}`);
      continue;
    }
    for (const c of line) used.add(c);
    lines.push(line);
  }
  return lines;
}

/**
 * Makes a puzzle with exactly one solution and about `givens` cells filled in: a random full
 * board, then cells emptied in a random order while the solution stays unique. A board that can't
 * lose another cell keeps a few more givens. With an `extra` rule, the board also marks its even
 * cells, draws Killer cages or Thermometer lines, and the solution only has to be unique with them.
 */
export function makePuzzle(shape: Shape, givens: number, random: Random, extra?: Extra): Puzzle {
  const peers = peersOf(shape);
  const n = shape.size * shape.size;
  const solution = new Array<number>(n).fill(0);
  search(shape, solution, peers, 1, random);
  const rules: Rules = {};
  if (extra === 'parity') rules.even = solution.map((d) => d % 2 === 0);
  if (extra === 'killer') rules.cages = makeCages(shape, solution, random);
  if (extra === 'thermo') rules.thermos = makeThermos(shape, solution, random);
  const ck = extra ? checker(shape, rules) : undefined;
  const grid = solution.slice();
  let filled = n;
  for (const cell of shuffle(Array.from({ length: n }, (_, i) => i), random)) {
    if (filled <= givens) break;
    const keep = grid[cell];
    grid[cell] = 0;
    if (search(shape, grid.slice(), peers, 2, undefined, ck) === 1) filled--;
    else grid[cell] = keep;
  }
  return { ...shape, solution, givens: grid.map((v) => v !== 0), ...rules };
}
