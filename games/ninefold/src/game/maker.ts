import { countWithin, SHAPES, solve, units, type Shape } from './sudoku';
import { explain, TECHNIQUES, type Technique } from './techniques';

// The puzzle maker's rules: which boards it can set up (a size and a variant), checking that the
// givens set have exactly one solution, rating that solution by the techniques it takes, and the
// share code that carries a puzzle from one player to another. No Phaser.

/** The board kinds the maker sets up: plain boxes, both diagonals as units too, or Jigsaw regions. */
export const VARIANTS = ['classic', 'diagonal', 'jigsaw'] as const;
export type Variant = (typeof VARIANTS)[number];
export const MAKER_SIZES = [9, 4, 6] as const;

export const variantOf = (shape: Shape): Variant => (shape.regions ? 'jigsaw' : shape.diagonal ? 'diagonal' : 'classic');

/** How hard a puzzle is, by the hardest technique the solve takes; `expert` needs more than the school teaches. */
export const RATINGS = ['easy', 'medium', 'hard', 'expert'] as const;
export type Rating = (typeof RATINGS)[number];
const RATING_OF: Record<Technique, Rating> = { hiddenSingle: 'easy', nakedSingle: 'easy', nakedPair: 'medium', pointingPair: 'medium', xWing: 'hard' };

/** The search steps a uniqueness check may take before it gives up (a near-empty or broken board can take long). */
export const CHECK_LIMIT = 300_000;

/** What a check found: a clash, no solution, more than one, too much to tell, or one, rated. */
export type MakerCheck =
  | { result: 'clash' | 'none' | 'many' | 'unclear'; givens: number }
  | { result: 'unique'; givens: number; rating: Rating; hardest: Technique | null; solution: number[] };

/** The cells whose digit stands twice in one of their units. */
export function clashes(shape: Shape, grid: number[]) {
  const out = new Set<number>();
  for (const unit of units(shape)) {
    for (const a of unit) for (const b of unit) if (a < b && grid[a] && grid[a] === grid[b]) out.add(a).add(b);
  }
  return out;
}

/**
 * Rates a unique puzzle by solving it the way a player would: `explain` places one digit at a
 * time, and the hardest technique any placement took sets the rating. A board `explain` can't
 * finish needs more than the school teaches: `expert`.
 */
export function rate(shape: Shape, grid: number[]): { rating: Rating; hardest: Technique | null } {
  const work = grid.slice();
  let hardest: Technique | null = null;
  while (work.includes(0)) {
    const step = explain(shape, work);
    if (!step) return { rating: 'expert', hardest };
    work[step.cell] = step.digit;
    if (!hardest || TECHNIQUES.indexOf(step.technique) > TECHNIQUES.indexOf(hardest)) hardest = step.technique;
  }
  return { rating: hardest ? RATING_OF[hardest] : 'easy', hardest };
}

/** Checks the givens set: a clash, how many solutions, and for exactly one, its rating. */
export function check(shape: Shape, grid: number[]): MakerCheck {
  const givens = grid.filter(Boolean).length;
  if (clashes(shape, grid).size) return { result: 'clash', givens };
  const n = countWithin(shape, grid, CHECK_LIMIT);
  if (n < 0) return { result: 'unclear', givens };
  if (n === 0) return { result: 'none', givens };
  if (n > 1) return { result: 'many', givens };
  const solution = solve(shape, grid)!;
  return { result: 'unique', givens, solution, ...rate(shape, grid) };
}

// Share codes: the size, a letter for the variant, the givens row by row with each run of empty
// cells written as one letter (a = 1 empty, b = 2, ... z = 26), and for Jigsaw a dot and each
// cell's region. For example `9Cc8a1...`. Letters, digits and the dot are safe in a link.

const VARIANT_LETTER: Record<Variant, string> = { classic: 'C', diagonal: 'D', jigsaw: 'J' };

export function encode(shape: Shape, grid: number[]) {
  let body = '';
  let gap = 0;
  const flush = () => {
    while (gap > 0) {
      const run = Math.min(26, gap);
      body += String.fromCharCode(96 + run);
      gap -= run;
    }
  };
  for (const v of grid) {
    if (v) {
      flush();
      body += String(v);
    } else gap++;
  }
  flush();
  const regions = shape.regions ? `.${shape.regions.join('')}` : '';
  return `${shape.size}${VARIANT_LETTER[variantOf(shape)]}${body}${regions}`;
}

/** Reads a share code, or a link that carries one as `?puzzle=`; null when it isn't a board. */
export function decode(text: string): { shape: Shape; grid: number[] } | null {
  let code = text.trim();
  const at = code.indexOf('puzzle=');
  if (at >= 0) code = code.slice(at + 7).split(/[&#\s]/)[0];
  const m = /^([469])([CDJ])([1-9a-z]*)(?:\.([0-8]+))?$/.exec(code);
  if (!m) return null;
  const size = Number(m[1]) as 4 | 6 | 9;
  const grid: number[] = [];
  for (const ch of m[3]) {
    if (ch >= 'a') for (let k = 0; k < ch.charCodeAt(0) - 96; k++) grid.push(0);
    else grid.push(Number(ch));
  }
  if (grid.length !== size * size || grid.some((v) => v > size)) return null;
  const shape: Shape = { ...SHAPES[size] };
  if (m[2] === 'D') shape.diagonal = true;
  if (m[2] === 'J') {
    const regions = [...(m[4] ?? '')].map(Number);
    if (regions.length !== size * size || !Array.from({ length: size }, (_, r) => regions.filter((x) => x === r).length).every((c) => c === size)) return null;
    shape.regions = regions;
  } else if (m[4]) return null;
  return { shape, grid };
}

/** Whether a decoded board makes a fair puzzle: no clash and exactly one solution. */
export function playable(shape: Shape, grid: number[]) {
  return !clashes(shape, grid).size && countWithin(shape, grid, CHECK_LIMIT) === 1;
}

