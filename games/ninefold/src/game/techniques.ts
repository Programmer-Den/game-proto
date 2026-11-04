import { peersOf, units, type Shape } from './sudoku';

// Solving by hand: the techniques the school teaches and a hint names. `explain` looks for the
// next digit a player can place by logic alone from the right digits on the board, using singles
// and, where they run out, the eliminations below. It only uses rows, columns, boxes (and the
// diagonals of a Diagonal board), so on a board with an extra rule it may find nothing. No Phaser.

/** The techniques, easiest first; the eliminations follow the two singles. */
export const TECHNIQUES = ['hiddenSingle', 'nakedSingle', 'nakedPair', 'pointingPair', 'xWing'] as const;
export type Technique = (typeof TECHNIQUES)[number];

/** A digit placed by logic: the hardest technique it took, the cell and digit, and the cells that show why. */
export interface Step {
  technique: Technique;
  cell: number;
  digit: number;
  /** For a single, its unit or cell; for an elimination, the pair, the pointing cells or the X-wing's corners. */
  cells: number[];
  /** The eliminations used before the single, in order. */
  used: Technique[];
}

const bits = (m: number) => {
  let n = 0;
  for (let x = m; x; x &= x - 1) n++;
  return n;
};
const lowDigit = (m: number) => 31 - Math.clz32(m & -m);

/** Each empty cell's candidates as a bit per digit, from the digits placed (0 for a filled cell). */
export function candidates(shape: Shape, grid: number[]) {
  const peers = peersOf(shape);
  const full = (1 << (shape.size + 1)) - 2;
  return grid.map((v, i) => {
    if (v) return 0;
    let m = full;
    for (const p of peers[i]) if (grid[p]) m &= ~(1 << grid[p]);
    return m;
  });
}

/**
 * The next digit a player can place by logic from `grid` (right digits only, 0 empty), or null.
 * With `only` set, the step must place that cell. Hidden and naked singles come first; when there
 * are none, one elimination at a time (naked pair, pointing pair, X-wing) thins the candidates and
 * the singles are looked for again.
 */
export function explain(shape: Shape, grid: number[], only = -1): Step | null {
  const { size } = shape;
  const us = units(shape);
  const cand = candidates(shape, grid);
  const used: Technique[] = [];
  let why: number[] = [];
  const step = (technique: Technique, cell: number, digit: number, cells: number[]): Step => {
    const hardest = used.reduce<Technique>((h, u) => (TECHNIQUES.indexOf(u) > TECHNIQUES.indexOf(h) ? u : h), technique);
    return { technique: hardest, cell, digit, cells: used.length ? why : cells, used: [...used] };
  };
  for (let round = 0; round < 60; round++) {
    // Hidden single: a digit with one place left in a unit.
    for (const unit of us) {
      if (only >= 0 && !unit.includes(only)) continue;
      for (let d = 1; d <= size; d++) {
        if (unit.some((c) => grid[c] === d)) continue;
        const spots = unit.filter((c) => cand[c] & (1 << d));
        if (spots.length === 1 && (only < 0 || spots[0] === only)) return step('hiddenSingle', spots[0], d, unit);
      }
    }
    // Naked single: a cell with one candidate left.
    for (let i = 0; i < grid.length; i++) {
      if (only >= 0 && i !== only) continue;
      if (!grid[i] && bits(cand[i]) === 1) return step('nakedSingle', i, lowDigit(cand[i]), [i]);
    }
    const elim = nakedPair(us, cand) ?? pointingPair(shape, us, cand) ?? xWing(size, cand);
    if (!elim) return null;
    used.push(elim.technique);
    why = elim.cells;
  }
  return null;
}

type Elimination = { technique: Technique; cells: number[] };

/** Two cells of a unit with the same two candidates: those digits leave the unit's other cells. */
function nakedPair(us: number[][], cand: number[]): Elimination | null {
  for (const unit of us) {
    for (let x = 0; x < unit.length; x++) {
      const m = cand[unit[x]];
      if (bits(m) !== 2) continue;
      for (let y = x + 1; y < unit.length; y++) {
        if (cand[unit[y]] !== m) continue;
        let removed = false;
        for (const c of unit) {
          if (c === unit[x] || c === unit[y] || !(cand[c] & m)) continue;
          cand[c] &= ~m;
          removed = true;
        }
        if (removed) return { technique: 'nakedPair', cells: [unit[x], unit[y]] };
      }
    }
  }
  return null;
}

/** A digit whose places in a box all lie on one row or column: it leaves the rest of that line. */
function pointingPair(shape: Shape, us: number[][], cand: number[]): Elimination | null {
  const { size } = shape;
  for (let b = 2 * size; b < 3 * size; b++) {
    const box = us[b];
    for (let d = 1; d <= size; d++) {
      const spots = box.filter((c) => cand[c] & (1 << d));
      if (spots.length < 2) continue;
      for (const lineOf of [(c: number) => Math.floor(c / size), (c: number) => size + (c % size)]) {
        const line = lineOf(spots[0]);
        if (!spots.every((c) => lineOf(c) === line)) continue;
        let removed = false;
        for (const c of us[line]) {
          if (box.includes(c) || !(cand[c] & (1 << d))) continue;
          cand[c] &= ~(1 << d);
          removed = true;
        }
        if (removed) return { technique: 'pointingPair', cells: spots };
      }
    }
  }
  return null;
}

/** A digit with exactly two places in each of two rows, in the same two columns: it leaves the rest of those columns (and the same turned round). */
function xWing(size: number, cand: number[]): Elimination | null {
  const at = (line: number, k: number, rows: boolean) => (rows ? line * size + k : k * size + line);
  for (const rows of [true, false]) {
    for (let d = 1; d <= size; d++) {
      const pairs: [number, number[]][] = [];
      for (let line = 0; line < size; line++) {
        const ks: number[] = [];
        for (let k = 0; k < size; k++) if (cand[at(line, k, rows)] & (1 << d)) ks.push(k);
        if (ks.length === 2) pairs.push([line, ks]);
      }
      for (let x = 0; x < pairs.length; x++) {
        for (let y = x + 1; y < pairs.length; y++) {
          const [l1, k1] = pairs[x];
          const [l2, k2] = pairs[y];
          if (k1[0] !== k2[0] || k1[1] !== k2[1]) continue;
          let removed = false;
          for (const k of k1) {
            for (let line = 0; line < size; line++) {
              const c = at(line, k, rows);
              if (line === l1 || line === l2 || !(cand[c] & (1 << d))) continue;
              cand[c] &= ~(1 << d);
              removed = true;
            }
          }
          if (removed) return { technique: 'xWing', cells: [at(l1, k1[0], rows), at(l1, k1[1], rows), at(l2, k2[0], rows), at(l2, k2[1], rows)] };
        }
      }
    }
  }
  return null;
}
