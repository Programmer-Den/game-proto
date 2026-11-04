import { NODES } from './journey';
import { KINDS, LEVELS, type KindId, type Level } from './kinds';

/** What the records screen shows and the save keeps: per kind and per mode. */
export interface KindRecord {
  solved: number;
  lost: number;
  /** The fastest solve without hints at each level, in milliseconds, or 0 for none yet. */
  best: number[];
}

export interface Progress {
  kinds: Record<KindId, KindRecord>;
  /** Best Endless, Blitz and daily scores, and the most puzzles solved in a draft run. */
  best: { endless: number; blitz: number; daily: number; draft: number };
  /** The last daily five played: its date's seed and score. */
  daily: { day: number; score: number } | null;
  /** The weekly league: this week's seed and best score. */
  weekly: { week: number; best: number } | null;
  /** The journey: the stars each step holds, 0 to 3. */
  journey: number[];
  /** The highest Practice trial cleared per kind (0 for none), up to its mastery. */
  trials: Record<KindId, number>;
  /** The daily five that set the best score, as [time into the run, score] after each card: the ghost the next one races. */
  ghost: [number, number][];
  runs: number;
}

/**
 * Mastery per kind, 1 to 10, from its solves in any mode: level n + 1 needs `MASTERY_AT[n]` solves.
 * Each level opens the next Practice trial of that kind, and Endless deals the kinds with the
 * lowest mastery more often.
 */
export const MASTERY_AT = [0, 2, 5, 9, 14, 20, 28, 38, 50, 65] as const;
export const MAX_MASTERY = MASTERY_AT.length;
export const masteryOf = (solved: number) => MASTERY_AT.filter((at) => solved >= at).length;
/** Solves still needed for the next mastery level, or null at the top. */
export const toNextMastery = (solved: number) => {
  const next = MASTERY_AT.find((at) => at > solved);
  return next === undefined ? null : next - solved;
};

export function newProgress(): Progress {
  return {
    kinds: Object.fromEntries(KINDS.map((k) => [k, { solved: 0, lost: 0, best: LEVELS.map(() => 0) }])) as Record<KindId, KindRecord>,
    best: { endless: 0, blitz: 0, daily: 0, draft: 0 },
    daily: null,
    weekly: null,
    journey: Array(NODES).fill(0),
    trials: Object.fromEntries(KINDS.map((k) => [k, 0])) as Record<KindId, number>,
    ghost: [],
    runs: 0,
  };
}

export function recordResult(p: Progress, kind: KindId, level: Level, solved: boolean, ms: number, hints: number) {
  const rec = p.kinds[kind];
  if (!solved) return void rec.lost++;
  rec.solved++;
  if (!hints && (!rec.best[level] || ms < rec.best[level])) rec.best[level] = Math.max(1, Math.round(ms));
}
