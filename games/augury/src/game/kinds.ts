import type { Rand } from './rng';
import { nonogram } from './puzzles/nonogram';
import { code } from './puzzles/code';
import { unjam } from './puzzles/unjam';
import { bridges } from './puzzles/bridges';
import { flip } from './puzzles/flip';
import { calc } from './puzzles/calc';
import { sums } from './puzzles/sums';
import { echo } from './puzzles/echo';
import { link } from './puzzles/link';
import { slide } from './puzzles/slide';
import { series } from './puzzles/series';

/** The four levels a puzzle comes in, 0 the easiest. */
export const LEVELS = [0, 1, 2, 3] as const;
export type Level = (typeof LEVELS)[number];

/**
 * One kind of puzzle: how to make one from a random source at a level, and its rules. Each kind's
 * state is plain data (cloned for Undo); its moves are functions next to it in `puzzles/`. No Phaser.
 */
export interface PuzzleDef<S = unknown> {
  id: KindId;
  make(rand: Rand, level: Level): S;
  solved(s: S): boolean;
  /** Lost for good: out of guesses (Code Breaker) or too few right answers (Memory Echo). */
  failed?(s: S): boolean;
  /** Makes one step towards an answer; false when it can't help. */
  hint(s: S): boolean;
  /** Whether a hint could still help, when that is known without trying one (Code Breaker). */
  canHint?(s: S): boolean;
  /** Clears what an Undo should not bring back, like a picked island (Bridges). */
  afterUndo?(s: S): void;
  /** Runs the puzzle's own clock (Memory Echo). */
  tick?(s: S, dt: number): void;
  /** Whether Undo steps back through its moves. */
  undo: boolean;
  /** The seconds a timed mode gives it, by level. */
  limit: readonly number[];
}

/** Every kind, in the order the practice screen lists them. */
export const KINDS = ['nonogram', 'bridges', 'code', 'calc', 'sums', 'unjam', 'flip', 'link', 'slide', 'series', 'echo'] as const;
export type KindId = (typeof KINDS)[number];

/** The four skills the records sort the kinds into. */
export const SKILLS = ['logic', 'numbers', 'spatial', 'memory'] as const;
export type Skill = (typeof SKILLS)[number];

export const SKILL_OF: Record<KindId, Skill> = {
  nonogram: 'logic',
  bridges: 'logic',
  code: 'memory',
  calc: 'numbers',
  sums: 'numbers',
  unjam: 'spatial',
  flip: 'spatial',
  link: 'spatial',
  slide: 'spatial',
  series: 'numbers',
  echo: 'memory',
};

export const DEFS: Record<KindId, PuzzleDef<any>> = { nonogram, code, unjam, bridges, flip, calc, sums, echo, link, slide, series };
