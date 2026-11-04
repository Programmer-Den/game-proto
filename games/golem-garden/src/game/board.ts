// The gardens: a grid of soil cells with dirt paths the pests walk along to the Heartwood.
// Plain TypeScript with no Phaser, so the rules can use the same geometry the scene draws.
import type { TextKey } from '../i18n';

/** The board: its top left corner in view pixels, its size in cells, and each cell's size. */
export const GRID = { x: 16, y: 64, cols: 12, rows: 7, cell: 64 };

/** What a cell is; grass (only in a plot you draw) grows nothing. */
export type Cell = 'soil' | 'path' | 'heart' | 'grass';

/** One way through a garden, from where pests come in (off the left edge) to the Heartwood. */
export interface Route {
  /** The route's corners as (col, row) cells; straight runs only, starting at col -1. */
  corners: readonly [number, number][];
  /** The corners' centres in view pixels. */
  points: { x: number; y: number }[];
  /** The length of each run between corners, in pixels. */
  segments: number[];
  /** How far a pest walks on this route, in pixels. */
  length: number;
}

export interface Garden {
  /** Its name, a key of `i18n/en.ts`. */
  name: TextKey;
  /** What sets it apart, shown on its card (a key of `i18n/en.ts`). */
  blurb: TextKey;
  /** How many harvest stars, over every garden, unlock it. */
  unlockStars: number;
  /** The ways through it; a forked garden has more than one, and pests take them in turn. */
  routes: Route[];
  /** What every cell is, indexed `[row][col]`. */
  map: Cell[][];
  /** The Heartwood's cell, where every route ends. */
  heart: { col: number; row: number };
}

/** The middle of the cell at (col, row), in view pixels. */
export const cellCentre = (col: number, row: number) => ({
  x: GRID.x + col * GRID.cell + GRID.cell / 2,
  y: GRID.y + row * GRID.cell + GRID.cell / 2,
});

/** The cell under a point in view pixels, or null off the board. */
export function cellAt(x: number, y: number) {
  const col = Math.floor((x - GRID.x) / GRID.cell);
  const row = Math.floor((y - GRID.y) / GRID.cell);
  if (col < 0 || row < 0 || col >= GRID.cols || row >= GRID.rows) return null;
  return { col, row };
}

function route(corners: readonly [number, number][]): Route {
  const points = corners.map(([c, r]) => cellCentre(c, r));
  const segments = points.slice(1).map((p, i) => Math.hypot(p.x - points[i].x, p.y - points[i].y));
  return { corners, points, segments, length: segments.reduce((a, b) => a + b, 0) };
}

function garden(name: TextKey, blurb: TextKey, unlockStars: number, routes: (readonly [number, number][])[], fill: Cell = 'soil'): Garden {
  const map: Cell[][] = Array.from({ length: GRID.rows }, () => Array<Cell>(GRID.cols).fill(fill));
  for (const corners of routes) {
    for (let i = 1; i < corners.length; i++) {
      const [c0, r0] = corners[i - 1];
      const [c1, r1] = corners[i];
      const steps = Math.max(Math.abs(c1 - c0), Math.abs(r1 - r0));
      for (let s = 0; s <= steps; s++) {
        const col = c0 + Math.sign(c1 - c0) * s;
        const row = r0 + Math.sign(r1 - r0) * s;
        if (col >= 0) map[row][col] = 'path';
      }
    }
  }
  const [hc, hr] = routes[0][routes[0].length - 1];
  map[hr][hc] = 'heart';
  return { name, blurb, unlockStars, routes: routes.map(route), map, heart: { col: hc, row: hr } };
}

/**
 * Every garden, in the order they unlock. The Meadow is the first garden and the one a new player
 * (and the playthrough) starts in.
 */
export const GARDENS: Garden[] = [
  garden('meadowName', 'meadowBlurb', 0, [
    [[-1, 1], [3, 1], [3, 5], [7, 5], [7, 2], [11, 2]],
  ]),
  garden('forkedBrookName', 'forkedBrookBlurb', 1, [
    [[-1, 3], [2, 3], [2, 1], [8, 1], [8, 3], [11, 3]],
    [[-1, 3], [2, 3], [2, 5], [8, 5], [8, 3], [11, 3]],
  ]),
  garden('twoGatesName', 'twoGatesBlurb', 3, [
    [[-1, 1], [5, 1], [5, 3], [9, 3], [9, 1], [11, 1]],
    [[-1, 5], [5, 5], [5, 3], [9, 3], [9, 1], [11, 1]],
  ]),
];

/** How far along `route` the centre of the cell (col, row) is, in pixels, or null if the route misses it. */
export function routeDist(route: Route, col: number, row: number) {
  const { points, segments } = route;
  const at = cellCentre(col, row);
  let before = 0;
  for (let i = 0; i < segments.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const along = a.x === b.x ? (at.y - a.y) / (b.y - a.y) : (at.x - a.x) / (b.x - a.x);
    const across = a.x === b.x ? at.x - a.x : at.y - a.y;
    if (across === 0 && along >= 0 && along <= 1) return before + along * segments[i];
    before += segments[i];
  }
  return null;
}

/** Where a pest `dist` pixels along `route` stands, and which way it faces (-1 left, 1 right). */
export function pathPoint(route: Route, dist: number) {
  const { points, segments } = route;
  let left = Math.max(0, dist);
  for (let i = 0; i < segments.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (left <= segments[i] || i === segments.length - 1) {
      const t = Math.min(1, left / segments[i]);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, facing: b.x < a.x ? -1 : 1 };
    }
    left -= segments[i];
  }
  return { ...points[points.length - 1], facing: 1 };
}

/** A plot drawn in the garden editor (GG18): its path, cell by cell from the left edge to the Heartwood, and its soil beds. */
export interface Drawing {
  path: [number, number][];
  soil: [number, number][];
}

const onBoard = ([c, r]: [number, number]) => c >= 0 && r >= 0 && c < GRID.cols && r < GRID.rows;
const same = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1];

/**
 * Whether a drawing can be planted: a path of at least `minPath` cells on the board, starting in the
 * first column, each cell beside the one before and none twice, and from 1 to `maxSoil` soil beds
 * off the path.
 */
export function drawingOk(d: Drawing, minPath: number, maxSoil: number) {
  const { path, soil } = d;
  if (path.length < minPath || path[0][0] !== 0 || !path.every(onBoard)) return false;
  for (let i = 1; i < path.length; i++) {
    if (Math.abs(path[i][0] - path[i - 1][0]) + Math.abs(path[i][1] - path[i - 1][1]) !== 1) return false;
    if (path.slice(0, i).some((c) => same(c, path[i]))) return false;
  }
  return soil.length >= 1 && soil.length <= maxSoil && soil.every(onBoard) && !soil.some((c) => path.some((p) => same(p, c)));
}

/**
 * The garden a drawing plants: one route along its path (in at the left edge, turning where the
 * path turns), the Heartwood on its last cell, soil on its beds and grass everywhere else.
 */
export function drawnGarden(d: Drawing): Garden {
  const { path } = d;
  const corners: [number, number][] = [[-1, path[0][1]]];
  for (let i = 1; i < path.length - 1; i++) {
    const [a, b, c] = [path[i - 1], path[i], path[i + 1]];
    // A corner where the path turns.
    if (b[0] - a[0] !== c[0] - b[0] || b[1] - a[1] !== c[1] - b[1]) corners.push(b);
  }
  // The first cell is a corner too when the path turns there, off the straight run in from the edge.
  if (path.length > 1 && path[1][1] !== path[0][1]) corners.splice(1, 0, path[0]);
  corners.push(path[path.length - 1]);
  const g = garden('plotName', 'plotBlurb', 0, [corners], 'grass');
  for (const [c, r] of d.soil) if (g.map[r][c] === 'grass') g.map[r][c] = 'soil';
  return g;
}

/**
 * One tap of the garden editor on (col, row), with the path or the soil tool; returns whether it
 * changed the drawing. Path: the first cell must be in the first column; then a cell beside the
 * last one, not on the path yet, adds it (and clears its soil bed); a tap on the last cell takes it
 * back, and on an earlier one cuts the path back to it. Soil: a tap off the path lays a bed (up to
 * `maxSoil`) or clears one.
 */
export function editDrawing(d: Drawing, tool: 'path' | 'soil', col: number, row: number, maxSoil: number) {
  const at: [number, number] = [col, row];
  if (!onBoard(at)) return false;
  const i = d.path.findIndex((c) => same(c, at));
  if (tool === 'soil') {
    if (i >= 0) return false;
    const bed = d.soil.findIndex((c) => same(c, at));
    if (bed >= 0) d.soil.splice(bed, 1);
    else if (d.soil.length < maxSoil) d.soil.push(at);
    else return false;
    return true;
  }
  if (i >= 0) {
    // The last cell is taken back; an earlier one cuts the path back to it.
    d.path.length = i === d.path.length - 1 ? i : i + 1;
    return true;
  }
  const last = d.path[d.path.length - 1];
  if (last ? Math.abs(last[0] - col) + Math.abs(last[1] - row) !== 1 : col !== 0) return false;
  d.path.push(at);
  d.soil = d.soil.filter((c) => !same(c, at));
  return true;
}
