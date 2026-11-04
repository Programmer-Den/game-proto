import type { PuzzleDef } from '../kinds';
import { shuffle, type Rand } from '../rng';

// Pipe Turn: every tile is a piece of pipe; a tap turns it a quarter clockwise. Turn the tiles until
// the water from the well reaches every house. Made from a random tree of pipes over the whole
// board (the well somewhere on it, a house at every dead end), then each tile turned at random, so
// it can always be solved. Any turning that brings water to every house counts.

export const PIPE_SIZES = [4, 5, 6, 7] as const;

/** The four ends of a tile, as bits: north, east, south and west. */
export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
const DIRS = [N, E, S, W] as const;
const OPPOSITE: Record<number, number> = { [N]: S, [E]: W, [S]: N, [W]: E };

export interface PipeState {
  size: number;
  /** Each tile's open ends now, as N | E | S | W bits. */
  tiles: number[];
  /** The ends each tile had when made: one answer. */
  answer: number[];
  well: number;
  houses: number[];
  taps: number;
}

/** A tile's ends turned a quarter clockwise. */
export const turn = (m: number) => ((m << 1) | (m >> 3)) & 15;

/** The cell next to `cell` through end `dir`, or -1 off the board. */
function step(cell: number, dir: number, size: number) {
  const r = Math.floor(cell / size);
  const c = cell % size;
  if (dir === N) return r > 0 ? cell - size : -1;
  if (dir === S) return r < size - 1 ? cell + size : -1;
  if (dir === W) return c > 0 ? cell - 1 : -1;
  return c < size - 1 ? cell + 1 : -1;
}

/** The cells the well's water reaches: through ends that meet an open end next door. */
export function watered(s: PipeState) {
  const wet = new Set<number>([s.well]);
  const todo = [s.well];
  while (todo.length) {
    const cell = todo.pop()!;
    for (const d of DIRS) {
      if (!(s.tiles[cell] & d)) continue;
      const next = step(cell, d, s.size);
      if (next < 0 || wet.has(next) || !(s.tiles[next] & OPPOSITE[d])) continue;
      wet.add(next);
      todo.push(next);
    }
  }
  return wet;
}

export const pipe: PuzzleDef<PipeState> = {
  id: 'pipe',
  undo: true,
  limit: [60, 90, 130, 180],
  make(rand: Rand, level) {
    const size = PIPE_SIZES[level];
    const cells = size * size;
    for (;;) {
      // A random tree over every cell (grown from a random cell, a branch at a time).
      const answer: number[] = Array(cells).fill(0);
      const start = Math.floor(rand() * cells);
      const inTree = new Set([start]);
      const edge = [start];
      while (inTree.size < cells) {
        const from = edge[Math.floor(rand() * edge.length)];
        const free = shuffle(rand, [...DIRS]).find((d) => {
          const to = step(from, d, size);
          return to >= 0 && !inTree.has(to);
        });
        if (free === undefined) {
          edge.splice(edge.indexOf(from), 1);
          continue;
        }
        const to = step(from, free, size);
        answer[from] |= free;
        answer[to] |= OPPOSITE[free];
        inTree.add(to);
        edge.push(to);
      }
      // The well sits on a tile with two or more ends, and a house at every dead end.
      const ends = (m: number) => DIRS.filter((d) => m & d).length;
      const wells = answer.map((m, i) => (ends(m) >= 2 ? i : -1)).filter((i) => i >= 0);
      const well = wells[Math.floor(rand() * wells.length)];
      const houses = answer.map((m, i) => (ends(m) === 1 ? i : -1)).filter((i) => i >= 0);
      const tiles = answer.map((m) => {
        let t = m;
        for (let k = Math.floor(rand() * 4); k > 0; k--) t = turn(t);
        return t;
      });
      const s: PipeState = { size, tiles, answer, well, houses, taps: 0 };
      if (houses.length >= 2 && !pipe.solved(s)) return s;
    }
  },
  solved(s) {
    const wet = watered(s);
    return s.houses.every((h) => wet.has(h));
  },
  hint(s) {
    const cell = s.tiles.findIndex((m, i) => m !== s.answer[i]);
    if (cell < 0) return false;
    s.tiles[cell] = s.answer[cell];
    s.taps++;
    return true;
  },
};

export function pipeTap(s: PipeState, cell: number) {
  if (s.tiles[cell] === 15) return false;
  s.tiles[cell] = turn(s.tiles[cell]);
  s.taps++;
  return true;
}
