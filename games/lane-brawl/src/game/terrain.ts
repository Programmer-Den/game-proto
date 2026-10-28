// The solid things on the map that units walk around (LB20): the pines and rocks of the jungle, the
// ruins, the standing stones round the two pits, and the towers, inhibitors, Nexuses and
// watchstones. Each is a circle; `steer` slides a step round them and `settle` pushes a point out.
// The map's art (`art/map.ts`) paints the scenery from the same `SCENERY` list, so what stands in
// the way is what shows.

import { BASE, BEAST, BUSHES, CAMPS, CampSpot, DRAKE, INHIBITORS, LaneId, LANES, MERC, RIVER, TOWERS, Vec, WATCHSTONES, WORLD } from './data';

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
export const RUINS: Vec[] = [{ x: 560, y: 1560 }, { x: 1240, y: 2240 }, { x: 2240, y: 1240 }, { x: 1560, y: 560 }];
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
  for (let i = 0; i < 4000 && things.length < 620; i++) {
    const p = { x: 20 + rnd() * (WORLD.w - 40), y: 30 + rnd() * (WORLD.h - 40) };
    if (laneDist(p) < LANE_HALF + 48 || riverDist(p) < RIVER.half + 40) continue;
    if (Math.hypot(p.x - BASE.blue.x, p.y - BASE.blue.y) < 290 || Math.hypot(p.x - BASE.red.x, p.y - BASE.red.y) < 290) continue;
    if (CLEARINGS.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < clearingR(c) + 50)) continue;
    if (RUINS.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < 110)) continue;
    if (WATCHSTONES.some((c) => Math.hypot(p.x - c.x, p.y - c.y) < 140)) continue;
    if (Math.hypot(p.x - BEAST.x, p.y - BEAST.y) < 175 || Math.hypot(p.x - DRAKE.x, p.y - DRAKE.y) < 175) continue;
    if (BUSHES.some((b) => ((p.x - b.x) / (b.rx + 40)) ** 2 + ((p.y - b.y) / (b.ry + 40)) ** 2 < 1)) continue;
    if (things.some((t) => Math.hypot(t.x - p.x, t.y - p.y) < 46)) continue;
    things.push({ ...p, kind: rnd() < 0.85 ? 'pine' : 'rock', s: 0.8 + rnd() * 0.5, v: Math.floor(rnd() * 4) });
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

/**
 * How big each solid thing is to a walker: a pine by its trunk (narrow enough that champions pass
 * between any two), a rock by its size, the rest by their footprint.
 */
export const SOLID = { trunk: 7, rock: 8, ruin: 12, stone: 9, tower: 22, inhibitor: 18, nexus: 44, watchstone: 12 };

export const OBSTACLES: Obstacle[] = [
  ...SCENERY.map((t) => ({ x: t.x, y: t.y, r: t.kind === 'pine' ? SOLID.trunk : SOLID.rock * t.s })),
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
  for (const o of near(x, y)) if ((!o.lane || open.has(o.lane)) && (x - o.x) ** 2 + (y - o.y) ** 2 < (o.r + body) ** 2) return o;
  return null;
}

/** Pushes a point out of any obstacle it stands in, to the nearest edge (a few rounds, for two at once). */
export function settle(p: Vec, body: number): Vec {
  let x = p.x, y = p.y;
  for (let round = 0; round < 4; round++) {
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
  const o = blockedBy(from.x + ux * step, from.y + uy * step, body);
  if (!o) return { x: from.x + ux * step, y: from.y + uy * step };
  // Slide round the obstacle: along its edge, turning the way that keeps closest to the goal.
  const nx = from.x - o.x, ny = from.y - o.y;
  const nd = Math.hypot(nx, ny) || 1;
  let tx = -ny / nd, ty = nx / nd;
  if (tx * ux + ty * uy < 0) {
    tx = -tx;
    ty = -ty;
  }
  return settle({ x: from.x + tx * step, y: from.y + ty * step }, body);
}
