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
  /** Arrows: the digits on each arrow's cells add up to the digit in its circle. */
  arrows?: Arrow[];
  /** Kropki dots between side-by-side cells (white: one apart, black: one double the other); no dot, neither. */
  dots?: Dot[];
  /** Sandwich sums: per row and per column, the digits between the 1 and the board's highest digit add up to this. */
  sandwich?: { rows: number[]; cols: number[] };
}

export interface Arrow {
  circle: number;
  /** The arrow's cells, from the circle out. */
  cells: number[];
}

export interface Dot {
  /** Two side-by-side cells, the lower index first. */
  a: number;
  b: number;
  black: boolean;
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
  arrows?: Arrow[];
  dots?: Dot[];
  sandwich?: { rows: number[]; cols: number[] };
}

/** Which kind of extra rule a new puzzle gets: Parity marks, Killer cages, Thermometer lines, Arrows, Kropki dots or Sandwich sums. */
export const EXTRAS = ['parity', 'killer', 'thermo', 'arrow', 'kropki', 'sandwich'] as const;
export type Extra = (typeof EXTRAS)[number];

const hasRules = (r: Rules) => !!(r.even || r.cages || r.thermos || r.arrows || r.dots || r.sandwich);

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
  /** Each cell's arrow (-1 for none), and whether it is that arrow's circle. */
  arrowOf: number[];
  arrows: Arrow[];
  /** Each cell's side-by-side neighbours with the dot between them: 0 none, 1 white, 2 black (only with Kropki). */
  dotsAt?: [number, number][][];
  sandwich?: { rows: number[]; cols: number[] };
  /** Each row's and column's cells, for Sandwich. */
  lines?: { rows: number[][]; cols: number[][] };
}

function checker(shape: Shape, rules: Rules = {}): Checker {
  const n = shape.size * shape.size;
  const cageOf = new Array<number>(n).fill(-1);
  (rules.cages ?? []).forEach((c, k) => c.cells.forEach((i) => (cageOf[i] = k)));
  const thermoAt: [number, number][][] = Array.from({ length: n }, () => []);
  (rules.thermos ?? []).forEach((line, k) => line.forEach((i, pos) => thermoAt[i].push([k, pos])));
  const arrowOf = new Array<number>(n).fill(-1);
  (rules.arrows ?? []).forEach((a, k) => [a.circle, ...a.cells].forEach((i) => (arrowOf[i] = k)));
  let dotsAt: [number, number][][] | undefined;
  if (rules.dots) {
    const kind = new Map(rules.dots.map((d) => [`${d.a}-${d.b}`, d.black ? 2 : 1]));
    dotsAt = Array.from({ length: n }, (_, i) => neighbours(shape.size, i).map((q): [number, number] => [q, kind.get(`${Math.min(i, q)}-${Math.max(i, q)}`) ?? 0]));
  }
  return { even: rules.even, cageOf, cages: rules.cages ?? [], thermoAt, thermos: rules.thermos ?? [], arrowOf, arrows: rules.arrows ?? [], dotsAt, sandwich: rules.sandwich, lines: rules.sandwich ? lines(shape.size) : undefined };
}

/** A board's rows and columns, each as its cells in order. */
function lines(size: number) {
  const span = <T>(f: (k: number) => T) => Array.from({ length: size }, (_, k) => f(k));
  return { rows: span((r) => span((k) => r * size + k)), cols: span((c) => span((k) => k * size + c)) };
}

/** Whether two digits fit the Kropki dot between them (0 none, 1 white, 2 black). */
export function dotFits(kind: number, a: number, b: number) {
  const apart = Math.abs(a - b) === 1;
  const double = a === 2 * b || b === 2 * a;
  return kind === 1 ? apart : kind === 2 ? double : !apart && !double;
}

/** Whether a row or column (its cells in order) can still make its sandwich sum with `d` in cell `i`. */
function sandwichFits(size: number, grid: number[], line: number[], i: number, d: number, clue: number) {
  let lo = -1;
  let hi = -1;
  line.forEach((c, k) => {
    const v = c === i ? d : grid[c];
    if (v === 1) lo = k;
    if (v === size) hi = k;
  });
  if (lo < 0 || hi < 0) return true;
  let sum = 0;
  let open = 0;
  for (let k = Math.min(lo, hi) + 1; k < Math.max(lo, hi); k++) {
    const v = line[k] === i ? d : grid[line[k]];
    if (v) sum += v;
    else open++;
  }
  return clue >= sum + 2 * open && clue <= sum + (size - 1) * open;
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
  const a = ck.arrowOf[i];
  if (a >= 0) {
    const arrow = ck.arrows[a];
    const circle = arrow.circle === i ? d : grid[arrow.circle];
    let sum = 0;
    let open = 0;
    for (const c of arrow.cells) {
      const v = c === i ? d : grid[c];
      if (v) sum += v;
      else open++;
    }
    if (circle) {
      if (sum + open > circle || sum + open * shape.size < circle) return false;
    } else if (sum + open + 1 > shape.size) return false;
  }
  if (ck.dotsAt) for (const [q, kind] of ck.dotsAt[i]) if (grid[q] && !dotFits(kind, d, grid[q])) return false;
  if (ck.sandwich && ck.lines) {
    const { size } = shape;
    const r = Math.floor(i / size);
    const c = i % size;
    if (!sandwichFits(size, grid, ck.lines.rows[r], i, d, ck.sandwich.rows[r]) || !sandwichFits(size, grid, ck.lines.cols[c], i, d, ck.sandwich.cols[c])) return false;
  }
  return true;
}

/**
 * Counts the board's solutions, stopping at `limit`; when `random` is given, tries digits in a
 * random order and leaves the first solution found in `grid`. Picks the cell with the fewest
 * candidates each step, which keeps 9x9 boards fast.
 */
function search(shape: Shape, grid: number[], peers: number[][], limit: number, random?: Random, ck?: Checker, budget?: { left: number }): number {
  // Out of steps: report "too many" so the caller keeps the board as it was.
  if (budget && --budget.left < 0) return limit;
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
    found += search(shape, grid, peers, limit - found, random, ck, budget);
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
  return search(shape, grid.slice(), peersOf(shape), limit, undefined, hasRules(rules) ? checker(shape, rules) : undefined);
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

/** The cells around a cell: beside it and diagonal to it. */
function aroundOf(size: number, cell: number) {
  const r = Math.floor(cell / size);
  const c = cell % size;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const rr = r + dr;
    const cc = c + dc;
    if ((dr || dc) && rr >= 0 && cc >= 0 && rr < size && cc < size) out.push(rr * size + cc);
  }
  return out;
}

/** Whether the step from `a` to `b` is diagonal and crosses a diagonal step already taken (kept as "a-b" both ways). */
function crossesStep(size: number, steps: Set<string>, a: number, b: number) {
  const ra = Math.floor(a / size);
  const rb = Math.floor(b / size);
  if (ra === rb || a % size === b % size) return false;
  return steps.has(`${ra * size + (b % size)}-${rb * size + (a % size)}`);
}

/**
 * Draws Arrows on a solved board: up to `count` circles, each with an arrow of 2 to 4 cells
 * (each beside or diagonal to the last) whose digits add up to the circle's. No cell is on two arrows.
 */
export function makeArrows(shape: Shape, solution: number[], random: Random, count = 8): Arrow[] {
  const { size } = shape;
  const used = new Set<number>();
  const steps = new Set<string>();
  const arrows: Arrow[] = [];
  for (const circle of shuffle(Array.from({ length: size * size }, (_, i) => i), random)) {
    if (arrows.length >= count) break;
    if (used.has(circle) || solution[circle] < 3) continue;
    // A few random walks out of the circle; the first that adds up exactly is kept.
    for (let tries = 0; tries < 12; tries++) {
      const path = [circle];
      let sum = 0;
      while (sum < solution[circle] && path.length < 5) {
        const last = path[path.length - 1];
        const next = shuffle(aroundOf(size, last), random).find((q) => !used.has(q) && !path.includes(q) && sum + solution[q] <= solution[circle] && !crossesStep(size, steps, last, q));
        if (next === undefined) break;
        path.push(next);
        sum += solution[next];
      }
      if (sum !== solution[circle] || path.length < 3) continue;
      for (let k = 1; k < path.length; k++) steps.add(`${path[k - 1]}-${path[k]}`).add(`${path[k]}-${path[k - 1]}`);
      for (const c of path) used.add(c);
      arrows.push({ circle, cells: path.slice(1) });
      break;
    }
  }
  return arrows;
}

/** Puts a Kropki dot between every two side-by-side cells one apart (white) or one double the other (black; 1 and 2 get black). */
export function makeDots(shape: Shape, solution: number[]): Dot[] {
  const { size } = shape;
  const dots: Dot[] = [];
  for (let a = 0; a < size * size; a++) {
    for (const b of [a + 1, a + size]) {
      if (b >= size * size || (b === a + 1 && b % size === 0)) continue;
      const x = solution[a];
      const y = solution[b];
      if (x === 2 * y || y === 2 * x) dots.push({ a, b, black: true });
      else if (Math.abs(x - y) === 1) dots.push({ a, b, black: false });
    }
  }
  return dots;
}

/** The sandwich sums of a solved board: per row and column, the digits between its 1 and its highest digit. */
export function makeSandwich(shape: Shape, solution: number[]) {
  const { size } = shape;
  const sum = (line: number[]) => {
    const vals = line.map((c) => solution[c]);
    const lo = vals.indexOf(1);
    const hi = vals.indexOf(size);
    return vals.slice(Math.min(lo, hi) + 1, Math.max(lo, hi)).reduce((t, v) => t + v, 0);
  };
  const { rows, cols } = lines(size);
  return { rows: rows.map(sum), cols: cols.map(sum) };
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
  const crosses = (a: number, b: number) => crossesStep(size, steps, a, b);
  const around = (cell: number) => aroundOf(size, cell);
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

/** The most search steps one uniqueness check may take on a board with an extra rule (a few ms). */
const CHECK_STEPS = 4000;

/**
 * Makes a puzzle with exactly one solution and about `givens` cells filled in: a random full
 * board, then cells emptied in a random order while the solution stays unique. A board that can't
 * lose another cell keeps a few more givens. With an `extra` rule, the board also marks its even
 * cells, draws Killer cages, Thermometer lines or Arrows, puts Kropki dots between cells or sums
 * up its Sandwiches, and the solution only has to be unique with them.
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
  if (extra === 'arrow') rules.arrows = makeArrows(shape, solution, random);
  if (extra === 'kropki') rules.dots = makeDots(shape, solution);
  if (extra === 'sandwich') rules.sandwich = makeSandwich(shape, solution);
  const ck = extra ? checker(shape, rules) : undefined;
  const grid = solution.slice();
  let filled = n;
  for (const cell of shuffle(Array.from({ length: n }, (_, i) => i), random)) {
    if (filled <= givens) break;
    const keep = grid[cell];
    grid[cell] = 0;
    // A board with an extra rule gives each check a budget of steps: a check that runs out keeps the cell.
    if (search(shape, grid.slice(), peers, 2, undefined, ck, ck ? { left: CHECK_STEPS } : undefined) === 1) filled--;
    else grid[cell] = keep;
  }
  return { ...shape, solution, givens: grid.map((v) => v !== 0), ...rules };
}
