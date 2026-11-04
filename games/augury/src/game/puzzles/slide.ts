import type { PuzzleDef } from '../kinds';
import { neighbours, type Rand } from '../rng';

// Star Slide: numbered tiles in a frame with one gap; a tap slides a tile next to the gap into it.
// Put the tiles in order with the gap last. Made by sliding tiles at random from the solved board,
// so it can always be solved. `trail` keeps the gap's way back home: the cells it came from, with a
// step straight back taking one off, so a hint (and the playthrough) slides the tile at its end.

export const SLIDE_SIZES = [3, 3, 4, 4] as const;
const SHUFFLE = [8, 18, 30, 50] as const;

export interface SlideState {
  size: number;
  /** The tile on each cell, 1 up; 0 the gap. */
  tiles: number[];
  /** Where the gap was, oldest first; sliding the tile on the last cell takes the gap one step home. */
  trail: number[];
  moves: number;
}

/** Slides the tile on `cell` into the gap next to it, keeping the gap's trail. */
function move(s: SlideState, cell: number) {
  const gap = s.tiles.indexOf(0);
  if (!neighbours(gap, s.size, s.size).includes(cell)) return false;
  s.tiles[gap] = s.tiles[cell];
  s.tiles[cell] = 0;
  if (s.trail[s.trail.length - 1] === cell) s.trail.pop();
  else s.trail.push(gap);
  return true;
}

export const slide: PuzzleDef<SlideState> = {
  id: 'slide',
  undo: true,
  limit: [60, 90, 150, 210],
  make(rand: Rand, level) {
    const size = SLIDE_SIZES[level];
    const n = size * size;
    for (;;) {
      const s: SlideState = { size, tiles: Array.from({ length: n }, (_, i) => (i + 1) % n), trail: [], moves: 0 };
      let last = -1;
      for (let k = 0; k < SHUFFLE[level]; k++) {
        const gap = s.tiles.indexOf(0);
        const options = neighbours(gap, size, size).filter((c) => c !== last);
        const cell = options[Math.floor(rand() * options.length)];
        last = gap;
        move(s, cell);
      }
      if (!slide.solved(s)) return s;
    }
  },
  solved: (s) => s.tiles.every((v, i) => v === (i + 1) % s.tiles.length),
  hint(s) {
    const cell = s.trail[s.trail.length - 1];
    if (cell === undefined) return false;
    return slideTap(s, cell);
  },
};

/** Taps a tile: it slides into the gap if it lies next to it. */
export function slideTap(s: SlideState, cell: number) {
  if (!move(s, cell)) return false;
  s.moves++;
  return true;
}
