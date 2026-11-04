import type { PuzzleDef } from '../kinds';
import type { Rand } from '../rng';

// Mirror Maze: a beam of light shines in from one edge of the board. Place mirrors (a tap on a cell
// cycles empty, / and \) so the beam passes through every crystal; only so many mirrors are given.
// Made by walking a beam that never crosses itself, turning at a mirror now and then, with
// crystals on its way (one after the first mirror and one after the last, so a straight beam never
// solves it), so it can always be solved. Any mirrors that light every crystal count.

export const BEAM_SIZES = [5, 6, 7, 8] as const;
const MIRRORS = [2, 3, 4, 5] as const;
const CRYSTALS = [2, 3, 4, 5] as const;

/** Directions: north, east, south, west. */
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
/** Where a beam heading each way goes after a / mirror (1) and a \ mirror (2). */
const BOUNCE: Record<number, number[]> = { 1: [1, 0, 3, 2], 2: [3, 2, 1, 0] };

export interface BeamState {
  size: number;
  /** The cell the beam enters first, and the way it heads. */
  entry: number;
  dir: number;
  /** 1 a crystal. */
  crystals: number[];
  /** The player's mirrors: 0 none, 1 /, 2 \. */
  mirrors: number[];
  /** The mirrors it was made with: one answer. */
  answer: number[];
  /** Mirrors given. */
  limit: number;
}

/** The beam's way through the board: each cell it crosses, in order, and the crystals it lights. */
export function trace(s: BeamState) {
  const cells: number[] = [];
  const lit = new Set<number>();
  const seen = new Set<number>();
  let cell = s.entry;
  let dir = s.dir;
  for (;;) {
    // A beam caught in a loop of mirrors stops where it would go round again.
    if (seen.has(cell * 4 + dir)) break;
    seen.add(cell * 4 + dir);
    cells.push(cell);
    if (s.crystals[cell]) lit.add(cell);
    const m = s.mirrors[cell];
    if (m) dir = BOUNCE[m][dir];
    const c = (cell % s.size) + DX[dir];
    const r = Math.floor(cell / s.size) + DY[dir];
    if (c < 0 || r < 0 || c >= s.size || r >= s.size) break;
    cell = r * s.size + c;
  }
  return { cells, lit, exit: dir };
}

export const mirrorsLeft = (s: BeamState) => s.limit - s.mirrors.filter(Boolean).length;

export const beam: PuzzleDef<BeamState> = {
  id: 'beam',
  undo: true,
  limit: [60, 90, 120, 160],
  make(rand: Rand, level) {
    const size = BEAM_SIZES[level];
    const turns = MIRRORS[level];
    for (;;) {
      // In from a random edge, heading across the board.
      const side = Math.floor(rand() * 4);
      const along = Math.floor(rand() * size);
      const dir = (side + 2) % 4;
      const r0 = side === 0 ? 0 : side === 2 ? size - 1 : along;
      const c0 = side === 3 ? 0 : side === 1 ? size - 1 : along;
      const entry = r0 * size + c0;
      const answer: number[] = Array(size * size).fill(0);
      const path: number[] = [];
      /** The path's index where each straight run starts (after the entry, after each mirror). */
      const runs: number[] = [0];
      const seen = new Set<number>();
      let r = r0;
      let c = c0;
      let d = dir;
      let left = turns;
      let run = 0;
      let ok = true;
      while (r >= 0 && c >= 0 && r < size && c < size) {
        const cell = r * size + c;
        if (seen.has(cell)) {
          ok = false;
          break;
        }
        seen.add(cell);
        path.push(cell);
        if (left > 0 && run >= 1 && rand() < 0.4) {
          const nd = (d + (rand() < 0.5 ? 1 : 3)) % 4;
          answer[cell] = BOUNCE[1][d] === nd ? 1 : 2;
          d = nd;
          left--;
          run = 0;
          runs.push(path.length);
        } else run++;
        r += DY[d];
        c += DX[d];
      }
      if (!ok || left > 0 || run < 1) continue;
      // Crystals: one on the run after the first mirror, one on the last run, the rest anywhere
      // the beam passes that holds no mirror.
      const plain = (from: number, to: number) => path.slice(from, to).filter((k) => !answer[k]);
      const first = plain(runs[1], runs[2] ?? path.length);
      const last = plain(runs[runs.length - 1], path.length);
      const crystals: number[] = Array(size * size).fill(0);
      const put = (from: number[]) => {
        const free = from.filter((k) => !crystals[k] && k !== entry);
        if (!free.length) return false;
        crystals[free[Math.floor(rand() * free.length)]] = 1;
        return true;
      };
      if (!put(first) || !put(last)) continue;
      const rest = plain(0, path.length);
      for (let n = 2; n < CRYSTALS[level]; n++) if (!put(rest)) break;
      const s: BeamState = { size, entry, dir, crystals, mirrors: Array(size * size).fill(0), answer, limit: turns };
      if (!beam.solved(s)) return s;
    }
  },
  solved(s) {
    const { lit } = trace(s);
    return s.crystals.every((v, k) => !v || lit.has(k));
  },
  hint(s) {
    // Takes away a mirror the answer doesn't have, else places one it does.
    const wrong = s.mirrors.findIndex((m, k) => m && m !== s.answer[k]);
    if (wrong >= 0) {
      s.mirrors[wrong] = 0;
      return true;
    }
    const missing = s.answer.findIndex((m, k) => m && s.mirrors[k] !== m);
    if (missing < 0) return false;
    s.mirrors[missing] = s.answer[missing];
    return true;
  },
};

/** Cycles a cell's mirror: none, /, \, none. A crystal cell takes none; with none left, only a mirror there can turn or go. */
export function beamTap(s: BeamState, cell: number) {
  if (s.crystals[cell]) return false;
  const m = s.mirrors[cell];
  if (!m && mirrorsLeft(s) <= 0) return false;
  s.mirrors[cell] = (m + 1) % 3;
  return true;
}
