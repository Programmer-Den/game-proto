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
  /** The earlier deductions it relied on (eliminations, and singles placed elsewhere on the way to a picked cell), in order. */
  used: Technique[];
}

/**
 * One deduction on the way: what it removed (each as cell * 16 + digit; a placed digit takes all
 * its cell's candidates and that digit from its peers) and what it relied on (per cell, a mask of
 * the digits whose removal there it needed).
 */
interface Deduction {
  technique: Technique;
  cells: number[];
  removed: number[];
  needs: [number, number][];
}

/** A single found: the deduction, and the cell and digit it places. */
type Single = Deduction & { cell: number; digit: number };

const bits = (m: number) => {
  let n = 0;
  for (let x = m; x; x &= x - 1) n++;
  return n;
};
const lowDigit = (m: number) => 31 - Math.clz32(m & -m);
const harder = (a: Technique, b: Technique) => (TECHNIQUES.indexOf(b) > TECHNIQUES.indexOf(a) ? b : a);

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
 * Hidden and naked singles come first; when there are none, one elimination at a time (naked pair,
 * pointing pair, X-wing) thins the candidates and the singles are looked for again. With `only`
 * set, the step must place that cell: singles found elsewhere are placed on the way, as a player
 * would, until one lands on it. The step's technique is the hardest of its single and the earlier
 * deductions it relied on; a deduction that removed nothing it (or a deduction it relied on) needed
 * is left out.
 */
export function explain(shape: Shape, grid: number[], only = -1): Step | null {
  const { size } = shape;
  const us = units(shape);
  const peers = peersOf(shape);
  const full = (1 << (size + 1)) - 2;
  const work = grid.slice();
  const cand = candidates(shape, work);
  const done: Deduction[] = [];
  // A single at cell `at`, or anywhere when `at` is -1.
  const single = (at: number): Single | null => {
    // Hidden single: a digit with one place left in a unit.
    for (const unit of us) {
      if (at >= 0 && !unit.includes(at)) continue;
      for (let d = 1; d <= size; d++) {
        if (unit.some((c) => work[c] === d)) continue;
        const spots = unit.filter((c) => cand[c] & (1 << d));
        if (spots.length !== 1 || (at >= 0 && spots[0] !== at)) continue;
        const needs = unit.filter((c) => c !== spots[0]).map((c): [number, number] => [c, 1 << d]);
        return { technique: 'hiddenSingle', cell: spots[0], digit: d, cells: unit, removed: [], needs };
      }
    }
    // Naked single: a cell with one candidate left.
    for (let i = 0; i < work.length; i++) {
      if ((at >= 0 && i !== at) || work[i] || bits(cand[i]) !== 1) continue;
      const d = lowDigit(cand[i]);
      return { technique: 'nakedSingle', cell: i, digit: d, cells: [i], removed: [], needs: [[i, full & ~(1 << d)]] };
    }
    return null;
  };
  // Every round places a digit or removes a candidate, so this ends well before the cap.
  for (let round = 0; round < 1000; round++) {
    const found = single(only) ?? (only >= 0 ? single(-1) : null);
    if (found && (only < 0 || found.cell === only)) return finish(found, done, work.length);
    if (found) {
      // A single elsewhere: place it and look again.
      const removed: number[] = [];
      for (let d = 1; d <= size; d++) if (cand[found.cell] & (1 << d)) removed.push(found.cell * 16 + d);
      work[found.cell] = found.digit;
      cand[found.cell] = 0;
      for (const p of peers[found.cell]) {
        if (!(cand[p] & (1 << found.digit))) continue;
        cand[p] &= ~(1 << found.digit);
        removed.push(p * 16 + found.digit);
      }
      done.push({ ...found, removed });
      continue;
    }
    const before = cand.slice();
    const elim = nakedPair(us, cand, full) ?? pointingPair(shape, us, cand) ?? xWing(size, cand);
    if (!elim) return null;
    const removed: number[] = [];
    cand.forEach((m, c) => {
      for (let d = 1; d <= size; d++) if (before[c] & ~m & (1 << d)) removed.push(c * 16 + d);
    });
    done.push({ ...elim, removed });
  }
  return null;
}

/** The step for a single: walking back from it, keeps each earlier deduction that removed something needed. */
function finish(found: Single, done: Deduction[], n: number): Step {
  const need = new Array<number>(n).fill(0);
  const add = (needs: [number, number][]) => needs.forEach(([c, m]) => (need[c] |= m));
  add(found.needs);
  const kept: Deduction[] = [];
  for (let k = done.length - 1; k >= 0; k--) {
    const e = done[k];
    if (!e.removed.some((code) => need[code >> 4] & (1 << (code & 15)))) continue;
    kept.unshift(e);
    add(e.needs);
  }
  const technique = kept.reduce<Technique>((h, e) => harder(h, e.technique), found.technique);
  const shows = [...kept].reverse().find((e) => e.technique === technique) ?? found;
  return { technique, cell: found.cell, digit: found.digit, cells: shows.cells, used: kept.map((e) => e.technique) };
}

/** An elimination found and applied to the candidates, with what it relied on (as in `Deduction`). */
type Elimination = { technique: Technique; cells: number[]; needs: [number, number][] };

/** Two cells of a unit with the same two candidates: those digits leave the unit's other cells. */
function nakedPair(us: number[][], cand: number[], full: number): Elimination | null {
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
        // The pair's other digits had to leave both cells.
        if (removed) return { technique: 'nakedPair', cells: [unit[x], unit[y]], needs: [[unit[x], full & ~m], [unit[y], full & ~m]] };
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
        // The digit had to leave the rest of the box.
        if (removed) return { technique: 'pointingPair', cells: spots, needs: box.filter((c) => !spots.includes(c)).map((c): [number, number] => [c, 1 << d]) };
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
          if (!removed) continue;
          // The digit had to leave the rest of the two base lines.
          const needs: [number, number][] = [];
          for (const line of [l1, l2]) for (let k = 0; k < size; k++) if (!k1.includes(k)) needs.push([at(line, k, rows), 1 << d]);
          return { technique: 'xWing', cells: [at(l1, k1[0], rows), at(l1, k1[1], rows), at(l2, k2[0], rows), at(l2, k2[1], rows)], needs };
        }
      }
    }
  }
  return null;
}
