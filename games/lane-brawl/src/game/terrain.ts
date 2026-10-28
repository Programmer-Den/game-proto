// The solid things on the map that units walk around (LB20). The jungle is thick forest that no one
// walks through: stone walls line both sides of every lane, with gaps where the jungle's paths
// come out, and the paths join the gaps to the camps, the bushes, the ruins and the river. That
// forest is the terrain, kept as a distance field (`clearance`); on top of it stand solid circles:
// the ruins' pillars, the standing stones round the two pits, and the towers, inhibitors, Nexuses
// and watchstones. `steer` slides a step round both, `settle` pushes a point out, and `route`
// finds a way along the paths. The map's art (`art/map.ts`) paints the same paths and walls.

import { BASE, BEAST, BUSHES, CAMPS, CampSpot, DRAKE, INHIBITORS, LaneId, LANES, MAP_SCALE, MERC, RIVER, RUNE, TOWERS, Vec, WARD_SPOTS, WATCHSTONES, WORLD, at, mirror } from './data';

/** Half the width of a lane's paving, in pixels. */
export const LANE_HALF = 50;

function segDist(p: Vec, a: Vec, b: Vec) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}
/** The distance from a point to the nearest lane's centre line. */
export function laneDist(p: Vec): number {
  let best = Infinity;
  for (const lane of Object.values(LANES)) {
    for (let i = 0; i < lane.length - 1; i++) best = Math.min(best, segDist(p, lane[i], lane[i + 1]));
  }
  return best;
}
/** The distance from a point to the river's centre line. */
export function riverDist(p: Vec): number {
  return segDist(p, RIVER.from, RIVER.to);
}

/** Every camp's clearing: the jungle camps and the two mercenary camps. */
export const CLEARINGS: CampSpot[] = [...CAMPS, ...MERC.spots.map((p) => ({ ...p, kind: 'merc' as const }))];
export const clearingR = (c: CampSpot) => (c.kind === 'ember' || c.kind === 'moss' ? 128 : c.kind === 'wolf' ? 112 : 100);
/** Where the ruins stand: one in each quarter of the jungle, mirrored. */
export const RUINS: Vec[] = [at(560, 1560), at(1240, 2240), at(2240, 1240), at(1560, 560)];
/** The four broken pillars of a ruin, round its centre. */
export function ruinPieces(c: Vec): Vec[] {
  return Array.from({ length: 4 }, (_, i) => {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    return { x: c.x + Math.cos(a) * 52, y: c.y + Math.sin(a) * 32 };
  });
}
/** The eight standing stones round a pit. */
export function pitStones(c: Vec): Vec[] {
  return Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    return { x: c.x + Math.cos(a) * 126, y: c.y + Math.sin(a) * 101 };
  });
}

/**
 * The jungle's paths in the quarter between the top lane, the river and the middle lane, written
 * at the first layout's size: from the gaps in the lane walls to the camps, bushes and ruin, and on
 * to the river. The quarter by the bottom lane has the same paths turned over the middle lane
 * (`turn`), and red's two quarters are blue's mirrored.
 */
const WEST_PATHS: [number, number][][] = [
  [[370, 1650], [620, 1850], [830, 1970]],
  [[620, 1850], [560, 1560], [640, 1300]],
  [[560, 1560], [780, 1680], [900, 1520], [1150, 1450], [1330, 1470]],
  [[370, 1000], [520, 1100], [640, 1300]],
  [[520, 1100], [440, 900], [520, 700]],
  [[640, 1300], [700, 980], [860, 940]],
  [[900, 1520], [1080, 1180]],
];
/** A first-layout point turned over the middle lane, from the top lane's quarter to the bottom lane's. */
const turn = ([x, y]: [number, number]): [number, number] => [2800 - y, 2800 - x];
/** Every path on the map, as a line of points. */
export const JUNGLE_PATHS: Vec[][] = [...WEST_PATHS, ...WEST_PATHS.map((l) => l.map(turn))]
  .map((l) => l.map(([x, y]) => at(x, y)))
  .flatMap((l) => [l, l.map(mirror)]);
/** Half a path's width, and how far past a lane's paving and the river's water one can walk. */
export const PATH_HALF = 44;
export const LANE_WALK = LANE_HALF + 30;
const RIVER_WALK = RIVER.half + 36;

function pathDist(p: Vec, paths: Vec[][]): number {
  let best = Infinity;
  for (const l of paths) for (let i = 0; i < l.length - 1; i++) best = Math.min(best, segDist(p, l[i], l[i + 1]));
  return best;
}
/** The places off the lanes a walker must reach: camps, bushes, ruins, pits, runes and ward spots. */
const PLACES: Vec[] = [...CLEARINGS, ...BUSHES, ...RUINS, BEAST, mirror(BEAST), DRAKE, mirror(DRAKE), ...RUNE.spots, ...WARD_SPOTS];

/** Whether a point is open ground: a lane, the river, a base, a clearing, pit, ruin or bush, or a path. */
function openGround(p: Vec, paths: Vec[][]): boolean {
  if (p.x < 6 || p.y < 6 || p.x > WORLD.w - 6 || p.y > WORLD.h - 6) return false;
  if (laneDist(p) < LANE_WALK || riverDist(p) < RIVER_WALK) return true;
  if (Math.hypot(p.x - BASE.blue.x, p.y - BASE.blue.y) < 270 || Math.hypot(p.x - BASE.red.x, p.y - BASE.red.y) < 270) return true;
  if (CLEARINGS.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < clearingR(c) + 30)) return true;
  if ([BEAST, mirror(BEAST), DRAKE, mirror(DRAKE)].some((c) => Math.hypot(p.x - c.x, p.y - c.y) < 175)) return true;
  if (RUINS.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < 105)) return true;
  if (BUSHES.some((b) => ((p.x - b.x) / (b.rx + 22)) ** 2 + ((p.y - b.y) / (b.ry + 22)) ** 2 < 1)) return true;
  return pathDist(p, paths) < PATH_HALF;
}

/** The terrain grid: `FIELD` px cells, each with how far it is to the nearest forest, in px. */
const FIELD = 10;
const FW = Math.ceil(WORLD.w / FIELD) + 1, FH = Math.ceil(WORLD.h / FIELD) + 1;

/** Exact distances to the nearest solid cell, by Felzenszwalb's two passes of 1-D lower envelopes. */
function distanceField(solid: Uint8Array): Float64Array {
  const INF = 1e12;
  const g = new Float64Array(FW * FH);
  for (let i = 0; i < g.length; i++) g[i] = solid[i] ? 0 : INF;
  const n = Math.max(FW, FH);
  const f = new Float64Array(n), d = new Float64Array(n), z = new Float64Array(n + 1);
  const v = new Int32Array(n);
  const pass = (len: number, get: (i: number) => number, put: (i: number, x: number) => void) => {
    for (let i = 0; i < len; i++) f[i] = get(i);
    let k = 0;
    v[0] = 0;
    z[0] = -INF;
    z[1] = INF;
    for (let q = 1; q < len; q++) {
      let sp = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (sp <= z[k]) {
        k--;
        sp = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      }
      k++;
      v[k] = q;
      z[k] = sp;
      z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) {
      while (z[k + 1] < q) k++;
      d[q] = (q - v[k]) ** 2 + f[v[k]];
    }
    for (let i = 0; i < len; i++) put(i, d[i]);
  };
  for (let x = 0; x < FW; x++) pass(FH, (i) => g[i * FW + x], (i, val) => (g[i * FW + x] = val));
  for (let y = 0; y < FH; y++) pass(FW, (i) => g[y * FW + i], (i, val) => (g[y * FW + i] = val));
  return g;
}

/** How far each cell is from the forest's edge: out to it from open ground, negative in from it inside. */
function signedField(solid: Uint8Array): Float32Array {
  const toSolid = distanceField(solid);
  const toOpen = distanceField(solid.map((v) => 1 - v));
  const out = new Float32Array(FW * FH);
  for (let i = 0; i < out.length; i++) out[i] = solid[i] ? FIELD / 2 - Math.sqrt(toOpen[i]) * FIELD : Math.sqrt(toSolid[i]) * FIELD - FIELD / 2;
  return out;
}

/** The pathfinding grid: `NAV` px cells. */
const NAV = 25;
const NW = Math.ceil(WORLD.w / NAV), NH = Math.ceil(WORLD.h / NAV);

/** The cells a champion can stand in that the blue Nexus reaches, flood-filled over `field`. */
function reached(field: Float32Array, body: number): Uint8Array {
  const seen = new Uint8Array(NW * NH);
  const start = Math.floor(BASE.blue.y / NAV) * NW + Math.floor(BASE.blue.x / NAV);
  const queue = [start];
  seen[start] = 1;
  while (queue.length) {
    const c = queue.pop()!;
    const cx = c % NW, cy = (c - cx) / NW;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= NW || y >= NH || seen[y * NW + x]) continue;
      if (sample(field, (x + 0.5) * NAV, (y + 0.5) * NAV) < body) continue;
      seen[y * NW + x] = 1;
      queue.push(y * NW + x);
    }
  }
  return seen;
}

function sample(field: Float32Array, x: number, y: number): number {
  const fx = Math.max(0, Math.min(FW - 1.001, x / FIELD)), fy = Math.max(0, Math.min(FH - 1.001, y / FIELD));
  const ix = Math.floor(fx), iy = Math.floor(fy), tx = fx - ix, ty = fy - iy;
  const i = iy * FW + ix;
  return (field[i] * (1 - tx) + field[i + 1] * tx) * (1 - ty) + (field[i + FW] * (1 - tx) + field[i + FW + 1] * tx) * ty;
}

/**
 * The paths, the forest and the clearance field. Any place a champion could not reach along the
 * written paths gets one more straight path to the nearest ground it can, so nothing is shut in.
 */
const TERRAIN = (() => {
  const paths = [...JUNGLE_PATHS];
  const build = () => {
    const solid = new Uint8Array(FW * FH);
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) solid[y * FW + x] = openGround({ x: x * FIELD, y: y * FIELD }, paths) ? 0 : 1;
    return signedField(solid);
  };
  let field = build();
  for (let round = 0; round < 3; round++) {
    const seen = reached(field, 16);
    const at = (p: Vec) => seen[Math.floor(p.y / NAV) * NW + Math.floor(p.x / NAV)];
    const shut = PLACES.filter((p) => !at(p));
    if (!shut.length) break;
    for (const p of shut) {
      let best: Vec | null = null, bestD = Infinity;
      for (let c = 0; c < seen.length; c++) {
        if (!seen[c]) continue;
        const q = { x: ((c % NW) + 0.5) * NAV, y: (Math.floor(c / NW) + 0.5) * NAV };
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d < bestD) (best = q), (bestD = d);
      }
      if (best) paths.push([p, best]);
    }
    field = build();
  }
  return { paths, field };
})();
/** Every path on the map, the written ones and any added to reach a shut-in place. */
export const PATHS = TERRAIN.paths;
/** How far a point is from the forest, in px (negative inside it). */
export const clearance = (p: Vec) => sample(TERRAIN.field, p.x, p.y);
/** Whether a point is in the forest, for the art. */
export const inForest = (p: Vec) => clearance(p) < 0;

/** A small seeded random source, so the scenery is the same in every match and on every device. */
function seeded(seed: number) {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) | 0;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SceneryThing {
  x: number;
  y: number;
  kind: 'pine' | 'rock';
  /** Size, and which of the model's variants. */
  s: number;
  v: number;
}

/**
 * The pines and rocks of the forest, close together, a little way in from its edge so they stand
 * behind the lane walls and line the paths. They are only art: the forest itself is what is solid.
 */
export const SCENERY: SceneryThing[] = (() => {
  const rnd = seeded(20261028);
  const things: SceneryThing[] = [];
  const cell = 60;
  const taken = new Map<number, SceneryThing[]>();
  const key = (x: number, y: number) => Math.floor(y / cell) * 1000 + Math.floor(x / cell);
  for (let i = 0; i < 9000 * MAP_SCALE ** 2 && things.length < 2400 * MAP_SCALE ** 2; i++) {
    const p = { x: 10 + rnd() * (WORLD.w - 20), y: 20 + rnd() * (WORLD.h - 20) };
    if (clearance(p) > -14) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) {
      for (let dx = -1; dx <= 1 && !near; dx++) near = (taken.get(key(p.x + dx * cell, p.y + dy * cell)) ?? []).some((t) => Math.hypot(t.x - p.x, t.y - p.y) < 40);
    }
    if (near) continue;
    const t: SceneryThing = { ...p, kind: rnd() < 0.88 ? 'pine' : 'rock', s: 0.85 + rnd() * 0.5, v: Math.floor(rnd() * 4) };
    things.push(t);
    const k = key(p.x, p.y);
    taken.set(k, [...(taken.get(k) ?? []), t]);
  }
  return things;
})();

/** A solid circle on the map. */
export interface Obstacle {
  x: number;
  y: number;
  r: number;
  /** A tower's or inhibitor's lane: it only stands in the way while that lane is open (`openLanes`). */
  lane?: LaneId;
}

/** How big each solid thing is to a walker, by its footprint. */
export const SOLID = { ruin: 12, stone: 9, tower: 22, inhibitor: 18, nexus: 44, watchstone: 12 };

export const OBSTACLES: Obstacle[] = [
  ...RUINS.flatMap((c) => ruinPieces(c).map((p) => ({ ...p, r: SOLID.ruin }))),
  ...[BEAST, DRAKE].flatMap((c) => pitStones(c).map((p) => ({ ...p, r: SOLID.stone }))),
  ...TOWERS.map((t) => ({ x: t.x, y: t.y, r: SOLID.tower, lane: t.lane })),
  ...INHIBITORS.map((t) => ({ x: t.x, y: t.y, r: SOLID.inhibitor, lane: t.lane })),
  ...[BASE.blue, BASE.red].map((b) => ({ x: b.x, y: b.y, r: SOLID.nexus })),
  ...WATCHSTONES.map((w) => ({ x: w.x, y: w.y, r: SOLID.watchstone })),
];

/** The obstacles by cell of a coarse grid, so a step only looks at the few near it. */
const CELL = 100;
const COLS = Math.ceil(WORLD.w / CELL);
const GRID: Obstacle[][] = Array.from({ length: COLS * Math.ceil(WORLD.h / CELL) }, () => []);
for (const o of OBSTACLES) {
  const pad = o.r + 40;
  for (let cy = Math.floor((o.y - pad) / CELL); cy <= Math.floor((o.y + pad) / CELL); cy++) {
    for (let cx = Math.floor((o.x - pad) / CELL); cx <= Math.floor((o.x + pad) / CELL); cx++) {
      if (cx >= 0 && cy >= 0 && cx < COLS && cy * COLS + cx < GRID.length) GRID[cy * COLS + cx].push(o);
    }
  }
}
function near(x: number, y: number): Obstacle[] {
  const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
  return cx < 0 || cy < 0 || cx >= COLS ? [] : GRID[cy * COLS + cx] ?? [];
}

/** The lanes the match plays on: a quick match has no towers or inhibitors on the others. */
let open = new Set<LaneId>(['top', 'mid', 'bottom']);
/** Sets the lanes whose towers and inhibitors stand in the way, at the start of a match. */
export function openLanes(lanes: LaneId[]) {
  open = new Set(lanes);
}

/** The first obstacle a walker of radius `body` at (x, y) would stand in, if any. */
export function blockedBy(x: number, y: number, body: number): Obstacle | null {
  for (const o of near(x, y)) {
    if (o.lane && !open.has(o.lane)) continue;
    if ((x - o.x) ** 2 + (y - o.y) ** 2 < (o.r + body) ** 2) return o;
  }
  return null;
}

/** Which way is out of the forest from a point: the clearance field's slope, as a unit vector. */
function outward(x: number, y: number): Vec {
  const gx = clearance({ x: x + 4, y }) - clearance({ x: x - 4, y });
  const gy = clearance({ x, y: y + 4 }) - clearance({ x, y: y - 4 });
  const g = Math.hypot(gx, gy);
  return g < 1e-6 ? { x: 0, y: 1 } : { x: gx / g, y: gy / g };
}

/** Pushes a point out of the forest and out of any obstacle it stands in, to the nearest edge (a few rounds, for two at once). */
export function settle(p: Vec, body: number): Vec {
  let x = p.x, y = p.y;
  for (let round = 0; round < 8; round++) {
    const c = clearance({ x, y });
    if (c < body) {
      const n = outward(x, y);
      const by = body - c + 0.5;
      x += n.x * by;
      y += n.y * by;
      continue;
    }
    const o = blockedBy(x, y, body);
    if (!o) break;
    const d = Math.hypot(x - o.x, y - o.y);
    // Dead on the centre: out to the south; else straight out from it.
    const ux = d < 1 ? 0 : (x - o.x) / d, uy = d < 1 ? 1 : (y - o.y) / d;
    x = o.x + ux * (o.r + body + 0.5);
    y = o.y + uy * (o.r + body + 0.5);
  }
  return { x: Math.max(0, Math.min(WORLD.w, x)), y: Math.max(0, Math.min(WORLD.h, y)) };
}

/**
 * One step of `step` px from `from` toward `to` for a walker of radius `body`: straight on when the
 * way is clear, else along the edge of what is in the way, on the side nearer the goal.
 */
export function steer(from: Vec, to: Vec, step: number, body: number): Vec {
  const d = Math.hypot(to.x - from.x, to.y - from.y);
  if (d < 1e-6) return { x: from.x, y: from.y };
  const ux = (to.x - from.x) / d, uy = (to.y - from.y) / d;
  const nx0 = from.x + ux * step, ny0 = from.y + uy * step;
  const o = blockedBy(nx0, ny0, body);
  const inside = clearance({ x: nx0, y: ny0 }) < body;
  if (!o && !inside) return { x: nx0, y: ny0 };
  // Slide along the edge of what is in the way, turning the way that keeps closest to the goal.
  let nx: number, ny: number;
  if (o) {
    nx = from.x - o.x;
    ny = from.y - o.y;
    const nd = Math.hypot(nx, ny) || 1;
    nx /= nd;
    ny /= nd;
  } else ({ x: nx, y: ny } = outward(from.x, from.y));
  let tx = -ny, ty = nx;
  if (tx * ux + ty * uy < 0) {
    tx = -tx;
    ty = -ty;
  }
  return settle({ x: from.x + tx * step, y: from.y + ty * step }, body);
}

/** Whether a walker of radius `body` can go straight from `a` to `b` without touching the forest. */
export function clearLine(a: Vec, b: Vec, body: number): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.ceil(d / 8);
  for (let i = 1; i <= n; i++) {
    if (clearance({ x: a.x + ((b.x - a.x) * i) / n, y: a.y + ((b.y - a.y) * i) / n }) < body) return false;
  }
  return true;
}

/** The nearest pathfinding cell to `c` whose centre a walker of radius `body` fits in, by a widening search. */
function nearestFree(c: number, body: number): number {
  const cx = c % NW, cy = Math.floor(c / NW);
  for (let r = 0; r < 30; r++) {
    let best = -1, bestD = Infinity;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r || x < 0 || y < 0 || x >= NW || y >= NH) continue;
        if (clearance({ x: (x + 0.5) * NAV, y: (y + 0.5) * NAV }) < body) continue;
        const d = (x - cx) ** 2 + (y - cy) ** 2;
        if (d < bestD) (best = y * NW + x), (bestD = d);
      }
    }
    if (best >= 0) return best;
  }
  return c;
}

/**
 * A way from `from` to `to` through the forest's gaps for a walker of radius `body`: A* over the
 * pathfinding grid, then pulled tight so it only turns where the forest makes it. The last point
 * is `to`, or the nearest place to it the walker fits.
 */
export function route(from: Vec, to: Vec, body: number): Vec[] {
  const cell = (p: Vec) => Math.max(0, Math.min(NH - 1, Math.floor(p.y / NAV))) * NW + Math.max(0, Math.min(NW - 1, Math.floor(p.x / NAV)));
  const fits = (c: number) => clearance({ x: ((c % NW) + 0.5) * NAV, y: (Math.floor(c / NW) + 0.5) * NAV }) >= body;
  const start = nearestFree(cell(from), body), goal = nearestFree(cell(to), body);
  const gx = goal % NW, gy = Math.floor(goal / NW);
  const h = (c: number) => {
    const dx = Math.abs((c % NW) - gx), dy = Math.abs(Math.floor(c / NW) - gy);
    return Math.max(dx, dy) + 0.41421 * Math.min(dx, dy);
  };
  const cost = new Float32Array(NW * NH).fill(Infinity);
  const prev = new Int32Array(NW * NH).fill(-1);
  const done = new Uint8Array(NW * NH);
  // A binary heap of cells by cost plus estimate.
  const heap: number[] = [], key: number[] = [];
  const push = (c: number, k: number) => {
    heap.push(c);
    key.push(k);
    let i = heap.length - 1;
    while (i > 0) {
      const pi = (i - 1) >> 1;
      if (key[pi] <= key[i]) break;
      [heap[pi], heap[i]] = [heap[i], heap[pi]];
      [key[pi], key[i]] = [key[i], key[pi]];
      i = pi;
    }
  };
  const pop = () => {
    const top = heap[0];
    const lastC = heap.pop()!, lastK = key.pop()!;
    if (heap.length) {
      heap[0] = lastC;
      key[0] = lastK;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && key[l] < key[m]) m = l;
        if (r < heap.length && key[r] < key[m]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        [key[m], key[i]] = [key[i], key[m]];
        i = m;
      }
    }
    return top;
  };
  cost[start] = 0;
  push(start, h(start));
  while (heap.length) {
    const c = pop();
    if (done[c]) continue;
    done[c] = 1;
    if (c === goal) break;
    const cx = c % NW, cy = Math.floor(c / NW);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= NW || y >= NH) continue;
        const n = y * NW + x;
        if (done[n] || !fits(n)) continue;
        // No cutting a corner between two cells it does not fit in.
        if (dx && dy && (!fits(cy * NW + x) || !fits(y * NW + cx))) continue;
        const nc = cost[c] + (dx && dy ? 1.41421 : 1);
        if (nc < cost[n]) {
          cost[n] = nc;
          prev[n] = c;
          push(n, nc + h(n));
        }
      }
    }
  }
  if (!done[goal]) return [to];
  const cells: Vec[] = [];
  for (let c = goal; c !== start && c >= 0; c = prev[c]) cells.push({ x: ((c % NW) + 0.5) * NAV, y: (Math.floor(c / NW) + 0.5) * NAV });
  cells.reverse();
  const end = clearance(to) >= body ? to : cells[cells.length - 1] ?? to;
  if (cells.length) cells[cells.length - 1] = end;
  else cells.push(end);
  // Pull it tight: from each point, go straight to the furthest later point in a clear line.
  const out: Vec[] = [];
  let here = from;
  let i = 0;
  while (i < cells.length) {
    let j = cells.length - 1;
    while (j > i && !clearLine(here, cells[j], body)) j--;
    out.push(cells[j]);
    here = cells[j];
    i = j + 1;
  }
  return out;
}
