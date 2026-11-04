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
  runs: number;
}

export function newProgress(): Progress {
  return {
    kinds: Object.fromEntries(KINDS.map((k) => [k, { solved: 0, lost: 0, best: LEVELS.map(() => 0) }])) as Record<KindId, KindRecord>,
    best: { endless: 0, blitz: 0, daily: 0, draft: 0 },
    daily: null,
    weekly: null,
    journey: Array(NODES).fill(0),
    runs: 0,
  };
}

export function recordResult(p: Progress, kind: KindId, level: Level, solved: boolean, ms: number, hints: number) {
  const rec = p.kinds[kind];
  if (!solved) return void rec.lost++;
  rec.solved++;
  if (!hints && (!rec.best[level] || ms < rec.best[level])) rec.best[level] = Math.max(1, Math.round(ms));
}
