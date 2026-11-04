// Fog of war for the player: the battlefield in square cells, each unexplored, explored (seen
// before) or in sight now. The world stamps what the player's ships and buildings see each update.
// No Phaser.

import { ARENA, MAX_ARENA } from './arena';
import type { Point } from './map';

/** The fog's cell size in battlefield pixels. */
export const FOG_CELL = 10;
/** The fog's grid, laid out for the biggest battlefield; a smaller one uses its top-left part (`Fog.cols`, `Fog.rows`). */
export const FOG_COLS = Math.ceil(MAX_ARENA.w / FOG_CELL);
export const FOG_ROWS = Math.ceil(MAX_ARENA.h / FOG_CELL);

export class Fog {
  /** The cells the battlefield covers, from its size when the fog is made. */
  readonly cols = Math.ceil(ARENA.w / FOG_CELL);
  readonly rows = Math.ceil(ARENA.h / FOG_CELL);
  /** 1 where a cell has ever been in sight. */
  readonly explored = new Uint8Array(FOG_COLS * FOG_ROWS);
  /** 1 where a cell is in sight now. */
  readonly visible = new Uint8Array(FOG_COLS * FOG_ROWS);

  /** Clears what is in sight, before the next stamp. */
  clear() {
    this.visible.fill(0);
  }

  /** Marks every cell whose centre lies within `r` of (x, y) as in sight and explored. */
  stamp(x: number, y: number, r: number) {
    const c0 = Math.max(0, Math.floor((x - r) / FOG_CELL));
    const c1 = Math.min(this.cols - 1, Math.floor((x + r) / FOG_CELL));
    const r0 = Math.max(0, Math.floor((y - r) / FOG_CELL));
    const r1 = Math.min(this.rows - 1, Math.floor((y + r) / FOG_CELL));
    const rr = r * r;
    for (let row = r0; row <= r1; row++) {
      const dy = (row + 0.5) * FOG_CELL - y;
      for (let col = c0; col <= c1; col++) {
        const dx = (col + 0.5) * FOG_CELL - x;
        if (dx * dx + dy * dy > rr) continue;
        const i = row * FOG_COLS + col;
        this.visible[i] = 1;
        this.explored[i] = 1;
      }
    }
  }

  private cell(p: Point) {
    const col = Math.min(FOG_COLS - 1, Math.max(0, Math.floor(p.x / FOG_CELL)));
    const row = Math.min(FOG_ROWS - 1, Math.max(0, Math.floor(p.y / FOG_CELL)));
    return row * FOG_COLS + col;
  }

  /** Whether a battlefield point is in the player's sight now. */
  sees(p: Point) {
    return this.visible[this.cell(p)] === 1;
  }

  /** Whether a battlefield point has ever been in the player's sight. */
  knows(p: Point) {
    return this.explored[this.cell(p)] === 1;
  }

  /** The share of the battlefield explored, for the test and the HUD. Keeps the cells out of JSON. */
  toJSON() {
    return { explored: this.explored.reduce((a, b) => a + b, 0) / (this.cols * this.rows) };
  }
}
