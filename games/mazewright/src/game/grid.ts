import { COLS, ROWS } from './rules';

// The walking field: every cell's number of steps to the cottage, found by a breadth-first search
// out from the cottage over the free cells (up, down, left and right; no corners cut). A foe on the
// ground always steps to a neighbour one step closer, so it follows a shortest route, and the
// field is made again whenever a cell is blocked or freed.

/** Steps to the cottage for a cell that can't reach it. */
export const UNREACHABLE = -1;

/** Right, down, up, left: the order a foe prefers when two ways are equally short. */
export const DIRS: [number, number][] = [[1, 0], [0, 1], [0, -1], [-1, 0]];

/** The steps from every cell to `goal`, walking only where `blocked` is 0. */
export function distances(blocked: Uint8Array, goal: number): Int16Array {
  const dist = new Int16Array(COLS * ROWS).fill(UNREACHABLE);
  const queue = new Int16Array(COLS * ROWS);
  let head = 0;
  let tail = 0;
  dist[goal] = 0;
  queue[tail++] = goal;
  while (head < tail) {
    const i = queue[head++];
    const x = i % COLS;
    const y = (i - x) / COLS;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const n = ny * COLS + nx;
      if (blocked[n] || dist[n] !== UNREACHABLE) continue;
      dist[n] = dist[i] + 1;
      queue[tail++] = n;
    }
  }
  return dist;
}

/**
 * The neighbour of `from` one step closer to the cottage, or -1 at the cottage or where no way
 * leads on. `heading` is the direction the foe last stepped in (an index into `DIRS`), which it
 * keeps when that way is as short as any, so it walks straight lines rather than zigzags.
 */
export function nextStep(dist: Int16Array, from: number, heading = 0): { cell: number; dir: number } | null {
  const d = dist[from];
  if (d <= 0) return null;
  const x = from % COLS;
  const y = (from - x) / COLS;
  for (const dir of [heading, 0, 1, 2, 3]) {
    const [dx, dy] = DIRS[dir];
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
    const n = ny * COLS + nx;
    if (dist[n] === d - 1) return { cell: n, dir };
  }
  return null;
}

/** The cells a foe walks from `start` to the cottage, both ends included; empty if it can't. */
export function route(dist: Int16Array, start: number): number[] {
  if (dist[start] === UNREACHABLE) return [];
  const cells = [start];
  let heading = 0;
  let at = start;
  for (let step = nextStep(dist, at, heading); step; step = nextStep(dist, at, heading)) {
    at = step.cell;
    heading = step.dir;
    cells.push(at);
  }
  return cells;
}
