// The solid things on the map that units walk around (LB20): the pines and rocks of the jungle, the
// ruins, the standing stones round the two pits, the stone walls, and the towers, inhibitors,
// Nexuses and watchstones. Each is a circle, or a wall's straight run with round ends;
// `steer` slides a step round them and `settle` pushes a point out.
// The map's art (`art/map.ts`) paints the scenery from the same `SCENERY` list, so what stands in
// the way is what shows.

import { BASE, BEAST, BUSHES, CAMPS, CampSpot, DRAKE, INHIBITORS, LaneId, LANES, MAP_SCALE, MERC, RIVER, TOWERS, Vec, WATCHSTONES, WORLD, at, mirror } from './data';

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

/** A stone wall in the jungle: a straight run from `a` to `b`. */
export interface Wall {
  a: Vec;
  b: Vec;
}
/**
 * Six walls in each team's jungle, mirrored: short and straight, with both ends open, off the
 * lanes, the river, the clearings and the bushes, so a walker slides along one and round its end.
 */
export const WALLS: Wall[] = [
  [1668, 1860, 1473, 1960],
  [1763, 2321, 1571, 2399],
  [602, 2028, 422, 2143],
  [926, 1151, 862, 1350],
  [471, 1389, 416, 1573],
  [695, 2386, 919, 2386],
].flatMap(([ax, ay, bx, by]) => {
  const w = { a: at(ax, ay), b: at(bx, by) };
  return [w, { a: mirror(w.a), b: mirror(w.b) }];
});
/** The distance from a point to a wall's run. */
export const wallDist = (p: Vec, w: Wall) => segDist(p, w.a, w.b);

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

/** The pines and rocks of the jungle, off the lanes, the river, the bases, clearings, ruins, pits and bushes. */
export const SCENERY: SceneryThing[] = (() => {
  const rnd = seeded(20261028);
  const things: SceneryThing[] = [];
  for (let i = 0; i < 4000 * MAP_SCALE ** 2 && things.length < 620 * MAP_SCALE ** 2; i++) {
    const p = { x: 20 + rnd() * (WORLD.w - 40), y: 30 + rnd() * (WORLD.h - 40) };
    if (laneDist(p) < LANE_HALF + 48 || riverDist(p) < RIVER.half + 40) continue;
    if (Math.hypot(p.x - BASE.blue.x, p.y - BASE.blue.y) < 290 || Math.hypot(p.x - BASE.red.x, p.y - BASE.red.y) < 290) continue;
    if (CLEARINGS.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < clearingR(c) + 50)) continue;
    if (RUINS.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < 110)) continue;
    if (WATCHSTONES.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < 140)) continue;
    if (Math.hypot(p.x - BEAST.x, p.y - BEAST.y) < 175 || Math.hypot(p.x - DRAKE.x, p.y - DRAKE.y) < 175) continue;
    if (BUSHES.some((b) => ((p.x - b.x) / (b.rx + 40)) ** 2 + ((p.y - b.y) / (b.ry + 40)) ** 2 < 1)) continue;
    if (WALLS.some((w) => wallDist(p, w) < 70)) continue;
    if (things.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < 46)) continue;
    things.push({ ...p, kind: rnd() < 0.85 ? 'pine' : 'rock', s: 0.8 + rnd() * 0.5, v: Math.floor(rnd() * 4) });
  }
  return things;
})();

/** A solid circle on the map, or a wall: every point within `r` of the run from (x, y) to `to`. */
export interface Obstacle {
  x: number;
  y: number;
  r: number;
  to?: Vec;
  /** A tower's or inhibitor's lane: it only stands in the way while that lane is open (`openLanes`). */
  lane?: LaneId;
}

/**
 * How big each solid thing is to a walker: a pine by its trunk (narrow enough that champions pass
 * between any two), a rock by its size, the rest by their footprint.
 */
export const SOLID = { trunk: 7, rock: 8, ruin: 12, stone: 9, wall: 16, tower: 22, inhibitor: 18, nexus: 44, watchstone: 12 };

export const OBSTACLES: Obstacle[] = [
  ...SCENERY.map((t) => ({ x: t.x, y: t.y, r: t.kind === 'pine' ? SOLID.trunk : SOLID.rock * t.s })),
  ...RUINS.flatMap((c) => ruinPieces(c).map((p) => ({ ...p, r: SOLID.ruin }))),
  ...[BEAST, DRAKE].flatMap((c) => pitStones(c).map((p) => ({ ...p, r: SOLID.stone }))),
  ...TOWERS.map((t) => ({ x: t.x, y: t.y, r: SOLID.tower, lane: t.lane })),
  ...INHIBITORS.map((t) => ({ x: t.x, y: t.y, r: SOLID.inhibitor, lane: t.lane })),
  ...[BASE.blue, BASE.red].map((b) => ({ x: b.x, y: b.y, r: SOLID.nexus })),
  ...WATCHSTONES.map((w) => ({ x: w.x, y: w.y, r: SOLID.watchstone })),
  ...WALLS.map((w) => ({ x: w.a.x, y: w.a.y, to: w.b, r: SOLID.wall })),
];

/** The point of an obstacle nearest to (x, y): its centre, or the nearest point of a wall's run. */
function core(o: Obstacle, x: number, y: number): Vec {
  if (!o.to) return o;
  const dx = o.to.x - o.x, dy = o.to.y - o.y;
  const t = Math.max(0, Math.min(1, ((x - o.x) * dx + (y - o.y) * dy) / (dx * dx + dy * dy)));
  return { x: o.x + dx * t, y: o.y + dy * t };
}

/** The obstacles by cell of a coarse grid, so a step only looks at the few near it. */
const CELL = 100;
const COLS = Math.ceil(WORLD.w / CELL);
const GRID: Obstacle[][] = Array.from({ length: COLS * Math.ceil(WORLD.h / CELL) }, () => []);
for (const o of OBSTACLES) {
  const pad = o.r + 40;
  const x1 = Math.min(o.x, o.to?.x ?? o.x), x2 = Math.max(o.x, o.to?.x ?? o.x);
  const y1 = Math.min(o.y, o.to?.y ?? o.y), y2 = Math.max(o.y, o.to?.y ?? o.y);
  for (let cy = Math.floor((y1 - pad) / CELL); cy <= Math.floor((y2 + pad) / CELL); cy++) {
    for (let cx = Math.floor((x1 - pad) / CELL); cx <= Math.floor((x2 + pad) / CELL); cx++) {
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
    const c = core(o, x, y);
    if ((x - c.x) ** 2 + (y - c.y) ** 2 < (o.r + body) ** 2) return o;
  }
  return null;
}

/** Pushes a point out of any obstacle it stands in, to the nearest edge (a few rounds, for two at once). */
export function settle(p: Vec, body: number): Vec {
  let x = p.x, y = p.y;
  for (let round = 0; round < 4; round++) {
    const o = blockedBy(x, y, body);
    if (!o) break;
    const c = core(o, x, y);
    const d = Math.hypot(x - c.x, y - c.y);
    // Dead on the centre: out to the south; else straight out from it.
    const ux = d < 1 ? 0 : (x - c.x) / d, uy = d < 1 ? 1 : (y - c.y) / d;
    x = c.x + ux * (o.r + body + 0.5);
    y = c.y + uy * (o.r + body + 0.5);
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
  const o = blockedBy(from.x + ux * step, from.y + uy * step, body);
  if (!o) return { x: from.x + ux * step, y: from.y + uy * step };
  // Slide round the obstacle: along its edge, turning the way that keeps closest to the goal. With
  // the goal across a wall, keep going round it one way, by the end that makes the shorter way.
  const c = core(o, from.x, from.y);
  const nx = from.x - c.x, ny = from.y - c.y;
  const nd = Math.hypot(nx, ny) || 1;
  let tx = -ny / nd, ty = nx / nd;
  let wrong = tx * ux + ty * uy < 0;
  if (o.to) {
    const a = { x: o.x, y: o.y }, b = o.to;
    const side = (p: Vec) => Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
    const mine = side(from);
    if (mine !== 0 && mine !== side(to)) {
      const viaA = Math.hypot(from.x - a.x, from.y - a.y) + Math.hypot(to.x - a.x, to.y - a.y);
      const viaB = Math.hypot(from.x - b.x, from.y - b.y) + Math.hypot(to.x - b.x, to.y - b.y);
      const [end, other] = viaA < viaB ? [a, b] : [b, a];
      // Which way round heads for that end, seen from beside the run on this side.
      const wx = b.x - a.x, wy = b.y - a.y;
      const sx = -wy * mine, sy = wx * mine;
      wrong = -sy * (end.x - other.x) + sx * (end.y - other.y) < 0;
    }
  }
  if (wrong) {
    tx = -tx;
    ty = -ty;
  }
  return settle({ x: from.x + tx * step, y: from.y + ty * step }, body);
}
