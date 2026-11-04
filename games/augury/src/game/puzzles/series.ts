import type { PuzzleDef } from '../kinds';
import { between, shuffle, type Rand } from '../rng';

// Star Series: a row of numbers follows a rule; pick the number that comes next from four. Three
// rows make a puzzle, each harder than the last within its level. A third wrong pick fails it; a
// hint strikes out one wrong option.

export const SERIES_ROWS = 3;
export const SERIES_TERMS = 5;
export const SERIES_WRONG = 3;

export interface SeriesRow {
  terms: number[];
  answer: number;
  options: number[];
}

export interface SeriesState {
  rows: SeriesRow[];
  /** The row being answered. */
  at: number;
  wrong: number;
  /** Options of the current row struck out, by a wrong pick or a hint. */
  struck: number[];
}

type Rule = (rand: Rand) => number[];

/** A row of `SERIES_TERMS + 1` numbers by a rule; the last is the answer. */
const RULES: Rule[][] = [
  // Novice: adding or taking a step.
  [
    (r) => step(between(r, 1, 20), between(r, 2, 9)),
    (r) => step(between(r, 40, 80), -between(r, 2, 8)),
  ],
  // Adept: two steps in turn, or a growing step.
  [
    (r) => alternate(between(r, 1, 15), between(r, 2, 9), -between(r, 1, 4)),
    (r) => growing(between(r, 1, 10), between(r, 1, 4), 1),
  ],
  // Mystic: doubling or tripling, or a step that grows by two.
  [
    (r) => times(between(r, 1, 5), between(r, 2, 3)),
    (r) => growing(between(r, 1, 10), between(r, 1, 5), 2),
  ],
  // Oracle: each the sum of the two before, squares, or times-and-add.
  [
    (r) => fibonacci(between(r, 1, 5), between(r, 1, 6)),
    (r) => squares(between(r, 1, 4)),
    (r) => timesAdd(between(r, 1, 4), 2, between(r, 1, 3)),
  ],
];

function step(start: number, d: number) {
  return Array.from({ length: SERIES_TERMS + 1 }, (_, i) => start + i * d);
}
function alternate(start: number, a: number, b: number) {
  const out = [start];
  for (let i = 1; i <= SERIES_TERMS; i++) out.push(out[i - 1] + (i % 2 ? a : b));
  return out;
}
function growing(start: number, d: number, grow: number) {
  const out = [start];
  for (let i = 1; i <= SERIES_TERMS; i++) out.push(out[i - 1] + d + (i - 1) * grow);
  return out;
}
function times(start: number, k: number) {
  return Array.from({ length: SERIES_TERMS + 1 }, (_, i) => start * k ** i);
}
function fibonacci(a: number, b: number) {
  const out = [a, b];
  while (out.length < SERIES_TERMS + 1) out.push(out[out.length - 1] + out[out.length - 2]);
  return out;
}
function squares(from: number) {
  return Array.from({ length: SERIES_TERMS + 1 }, (_, i) => (from + i) ** 2);
}
function timesAdd(start: number, k: number, add: number) {
  const out = [start];
  for (let i = 1; i <= SERIES_TERMS; i++) out.push(out[i - 1] * k + add);
  return out;
}

function makeRow(rand: Rand, level: number): SeriesRow {
  const rules = RULES[level];
  const all = rules[Math.floor(rand() * rules.length)](rand);
  const answer = all[SERIES_TERMS];
  const terms = all.slice(0, SERIES_TERMS);
  // Three near misses: the answer off by the last step, by one, or by the step twice.
  const last = answer - terms[SERIES_TERMS - 1];
  const near = [answer + 1, answer - 1, answer + Math.max(1, Math.abs(last)), answer - Math.max(1, Math.abs(last)), answer + 2, answer * 2];
  const options = [answer];
  for (const n of shuffle(rand, near)) if (!options.includes(n) && options.length < 4) options.push(n);
  return { terms, answer, options: shuffle(rand, options) };
}

export const series: PuzzleDef<SeriesState> = {
  id: 'series',
  undo: false,
  limit: [60, 75, 90, 120],
  make(rand: Rand, level) {
    return { rows: Array.from({ length: SERIES_ROWS }, () => makeRow(rand, level)), at: 0, wrong: 0, struck: [] };
  },
  solved: (s) => s.at >= s.rows.length,
  failed: (s) => s.wrong >= SERIES_WRONG,
  canHint: (s) => s.at < s.rows.length && s.rows[s.at].options.filter((o, i) => o !== s.rows[s.at].answer && !s.struck.includes(i)).length > 0,
  hint(s) {
    const row = s.rows[s.at];
    if (!row) return false;
    const i = row.options.findIndex((o, k) => o !== row.answer && !s.struck.includes(k));
    if (i < 0) return false;
    s.struck.push(i);
    return true;
  },
};

/** Picks option `i` for the current row: the right one moves on, a wrong one counts and is struck out. */
export function seriesPick(s: SeriesState, i: number) {
  const row = s.rows[s.at];
  if (!row || s.struck.includes(i) || row.options[i] === undefined) return false;
  if (row.options[i] === row.answer) {
    s.at++;
    s.struck = [];
  } else {
    s.wrong++;
    s.struck.push(i);
  }
  return true;
}
