import { ARENA } from './arena';
import type { Point } from './map';

/** A rock as the map lays it out: a circle that blocks ships. */
export type Rock = Point & { r: number };

/** The pathing grid's cell size, in battlefield pixels. */
export const PATH_CELL = 20;
const COLS = Math.ceil(ARENA.w / PATH_CELL);
const ROWS = Math.ceil(ARENA.h / PATH_CELL);
const DIAGONAL = Math.SQRT2;

/**
 * Ships' pathing round the rocks: a ship keeps `clearance` px between its centre and a rock's
 * centre beyond the rock's radius. `clear` says whether a straight flight is open, and `route`
 * finds the way round on a grid of PATH_CELL cells (A*, eight ways, no cutting corners). Rocks in
 * `ignore` (by index) are left out of both, so a ship can still reach a node or a target among
 * them. No Phaser, no Math.random.
 */
export class Pathing {
  /** For each grid cell, the rocks (by index) that cover its centre. */
  private readonly cover: number[][];

  constructor(readonly rocks: readonly Rock[], readonly clearance: number) {
    this.cover = Array.from({ length: COLS * ROWS }, () => []);
    rocks.forEach((k, i) => {
      const reach = k.r + clearance;
      for (let row = Math.max(0, Math.floor((k.y - reach) / PATH_CELL)); row <= Math.min(ROWS - 1, Math.floor((k.y + reach) / PATH_CELL)); row++) {
        for (let col = Math.max(0, Math.floor((k.x - reach) / PATH_CELL)); col <= Math.min(COLS - 1, Math.floor((k.x + reach) / PATH_CELL)); col++) {
          const c = this.centre(col + row * COLS);
          if (Math.hypot(c.x - k.x, c.y - k.y) < reach) this.cover[col + row * COLS].push(i);
        }
      }
    });
  }

  /** The rocks a point is over (inside a rock's radius plus the clearance), by index. */
  over(p: Point, extra = 0): number[] {
    const out: number[] = [];
    this.rocks.forEach((k, i) => {
      if (Math.hypot(p.x - k.x, p.y - k.y) < k.r + this.clearance + extra) out.push(i);
    });
    return out;
  }

  /** Whether a ship can fly straight from `a` to `b`, past every rock not in `ignore`. */
  clear(a: Point, b: Point, ignore: readonly number[] = []): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    return this.rocks.every((k, i) => {
      if (ignore.includes(i)) return true;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((k.x - a.x) * dx + (k.y - a.y) * dy) / len2));
      return Math.hypot(a.x + dx * t - k.x, a.y + dy * t - k.y) >= k.r + this.clearance;
    });
  }

  /**
   * The waypoints from `a` to `b` round the rocks, `b` last; null when there is no way (the ship
   * then flies straight and slides off what it meets). Cells covered only by rocks in `ignore`
   * count as open, and so does the cell `a` is in.
   */
  route(a: Point, b: Point, ignore: readonly number[] = []): Point[] | null {
    const start = this.cellOf(a);
    const goal = this.cellOf(b);
    const open = (cell: number) => cell === start || cell === goal || this.cover[cell].every((i) => ignore.includes(i));
    const cost = new Float64Array(COLS * ROWS).fill(Infinity);
    const from = new Int32Array(COLS * ROWS).fill(-1);
    const heap: [number, number][] = [];
    const push = (cell: number, f: number) => {
      heap.push([f, cell]);
      for (let i = heap.length - 1; i > 0;) {
        const p = (i - 1) >> 1;
        if (heap[p][0] <= heap[i][0]) break;
        [heap[p], heap[i]] = [heap[i], heap[p]];
        i = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      const last = heap.pop()!;
      if (heap.length) {
        heap[0] = last;
        for (let i = 0; ;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === i) break;
          [heap[m], heap[i]] = [heap[i], heap[m]];
          i = m;
        }
      }
      return top;
    };
    const gx = goal % COLS;
    const gy = Math.floor(goal / COLS);
    const guess = (cell: number) => {
      const dx = Math.abs((cell % COLS) - gx);
      const dy = Math.abs(Math.floor(cell / COLS) - gy);
      return Math.max(dx, dy) + (DIAGONAL - 1) * Math.min(dx, dy);
    };
    cost[start] = 0;
    push(start, guess(start));
    while (heap.length) {
      const [, cell] = pop();
      if (cell === goal) break;
      const cx = cell % COLS;
      const cy = Math.floor(cell / COLS);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
          const next = nx + ny * COLS;
          if (!open(next)) continue;
          // No cutting a corner past a rock.
          if (dx && dy && (!open(cx + dx + cy * COLS) || !open(cx + ny * COLS))) continue;
          const c = cost[cell] + (dx && dy ? DIAGONAL : 1);
          if (c >= cost[next]) continue;
          cost[next] = c;
          from[next] = cell;
          push(next, c + guess(next));
        }
      }
    }
    if (goal !== start && from[goal] < 0) return null;
    const path: Point[] = [{ x: b.x, y: b.y }];
    for (let cell = from[goal]; cell >= 0 && cell !== start; cell = from[cell]) path.unshift(this.centre(cell));
    return path;
  }

  private cellOf(p: Point) {
    const col = Math.max(0, Math.min(COLS - 1, Math.floor(p.x / PATH_CELL)));
    const row = Math.max(0, Math.min(ROWS - 1, Math.floor(p.y / PATH_CELL)));
    return col + row * COLS;
  }

  private centre(cell: number): Point {
    return { x: (cell % COLS) * PATH_CELL + PATH_CELL / 2, y: Math.floor(cell / COLS) * PATH_CELL + PATH_CELL / 2 };
  }
}
