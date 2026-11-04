import { metres, type GameState } from './state';

// The ghost runner: each knight's best ordinary run is kept as a list of samples of where they
// were (distance and height along the course, and whether sliding) every `GHOST.every` ms of
// running time, and plays back as a faint ghost beside the knight on the next runs, so the player
// races their own best. Time only runs while the run does, so a checkpoint's rest never puts the
// ghost out of step. Nothing here changes the run: `GameScene` records and draws it.

/** One sample every this many ms of running, and at most this many samples (about 30 minutes). */
export const GHOST = { every: 100, most: 18000 };

/** A recorded run: how far it got, in metres, and its samples, three numbers each: x, h, sliding (1) or not (0). */
export interface Ghost {
  m: number;
  at: number[];
}

/** Adds the samples due since the last one, while the run is running. */
export function record(samples: number[], s: GameState) {
  if (s.phase !== 'running') return;
  const box = s.runner.slideMs > 0 ? 1 : 0;
  while (samples.length / 3 <= s.time / GHOST.every && samples.length / 3 < GHOST.most) samples.push(Math.round(s.distance), Math.round(s.runner.h), box);
}

/** The finished run as a ghost, or null when it got no further than the ghost it would replace. */
export function ghostOf(samples: number[], s: GameState, old: Ghost | null): Ghost | null {
  const m = metres(s.distance);
  if (samples.length < 6 || (old && old.m >= m)) return null;
  return { m, at: samples.slice() };
}

/** Where the ghost is after `time` ms of running: its x, height and pose, or null once its run has ended. */
export function ghostAt(g: Ghost, time: number): { x: number; h: number; slide: boolean; rising: boolean; air: boolean } | null {
  const n = g.at.length / 3;
  const f = time / GHOST.every;
  const i = Math.floor(f);
  if (i >= n - 1) return null;
  const k = f - i;
  const a = i * 3;
  const b = a + 3;
  const x = g.at[a] + (g.at[b] - g.at[a]) * k;
  const h = g.at[a + 1] + (g.at[b + 1] - g.at[a + 1]) * k;
  const dh = g.at[b + 1] - g.at[a + 1];
  return { x, h, slide: g.at[a + 2] === 1, rising: dh > 0.5, air: Math.abs(dh) > 0.5 };
}
