import { MAP_SIZE, type MapKind, type RelicId, type Resource } from './data';

export const GRASS = 0;
export const WATER = 1;
export const ROCK = 2;
export const DIRT = 3;
/** Shallows, the fords between islands: land units wade them and ships sail them, but nothing is built there. */
export const SHALLOW = 4;
/** Whether a ship can sail a terrain tile. */
export const sailable = (k: number) => k === WATER || k === SHALLOW;

export interface Node {
  id: number;
  kind: 'tree' | 'bush' | 'mine';
  res: Resource;
  tx: number;
  ty: number;
  w: number;
  h: number;
  amount: number;
}

/** A neutral camp's spot: a 2x2 footprint, what it holds, and the wild guards around it. */
export interface CampSpot {
  kind: 'cache' | 'relic';
  tx: number;
  ty: number;
  /** A cache's pile. */
  res?: Resource;
  amount?: number;
  relic?: RelicId;
  guards: string[];
}

/** A neutral trading post: a 2x2 hall where trade carts load ore. */
export interface PostSpot {
  tx: number;
  ty: number;
}

export interface MapData {
  terrain: Uint8Array;
  nodes: Node[];
  camps: CampSpot[];
  posts: PostSpot[];
  /** Each side's Town Center corner, in side order: the player, the AI and, in a three-way match, the second AI. */
  starts: { tx: number; ty: number }[];
  /** A map of islands, where the AI builds a Harbour and warships. */
  naval?: boolean;
}

const B = 'wild-brigand';
const PO = 'wild-poacher';
/**
 * The camps of the first side, by top-left tile; generateMap adds each one's point mirror (with the
 * mirror's own relic, for the flank pair). The middle relic is its own mirror. Each sits in a patch
 * cleared of trees, water and rock, so the map around it stays as generated.
 */
const CAMP_PLAN: (CampSpot & { mirrorRelic?: RelicId })[] = [
  { kind: 'relic', tx: MAP_SIZE / 2 - 1, ty: MAP_SIZE / 2 - 1, relic: 'valor', guards: [B, B, B, B, PO, PO] },
  { kind: 'relic', tx: 100, ty: 26, relic: 'plenty', mirrorRelic: 'haste', guards: [B, B, PO, PO] },
  { kind: 'cache', tx: 38, ty: 18, res: 'ore', amount: 250, guards: [B, B, B] },
  { kind: 'cache', tx: 16, ty: 40, res: 'food', amount: 300, guards: [B, B, B] },
];
/** Tiles cleared around a camp's footprint, so its guards and visitors can stand there. */
const CAMP_CLEAR = 3;
/**
 * A three-way match's extra caches, near the top-right corner where the second AI starts; their
 * mirrors lie by the free bottom-left corner.
 */
const THIRD_CAMPS: typeof CAMP_PLAN = [
  { kind: 'cache', tx: MAP_SIZE - 40, ty: 18, res: 'ore', amount: 250, guards: [B, B, B] },
  { kind: 'cache', tx: MAP_SIZE - 18, ty: 40, res: 'food', amount: 300, guards: [B, B, B] },
];
/**
 * The first trading post; the second is its point mirror. Both lie on the line across the middle of
 * the map that is the same distance from either Town Center, so a cart's trip is as long for both sides.
 */
const POST_PLAN: PostSpot = { tx: MAP_SIZE / 2 - 9, ty: MAP_SIZE / 2 + 7 };

/** Top-left tile of each side's Town Center; the second side is the point mirror of the first. */
export const START_TILES = [
  { tx: 13, ty: 13 },
  { tx: MAP_SIZE - 17, ty: MAP_SIZE - 17 },
];
/**
 * In a three-way match the second AI starts in the top-right corner. The bottom-left corner, its
 * point mirror, gets the same trees, bushes and mine but no Town Center: free land to expand to.
 */
export const THIRD_START = { tx: MAP_SIZE - 17, ty: 13 };
const FOURTH_CORNER = { tx: MAP_SIZE - THIRD_START.tx - 4, ty: MAP_SIZE - THIRD_START.ty - 4 };
/** Where Highlands' two long ridges cross each side's half of the map (tiles with x + y on these lines), and their passes. */
const HIGH_RIDGE = 88;
const HIGH_PASSES = [20, 44, 68];
/**
 * Islands: the land discs of the first side (centre and radius; each is mirrored) and the fords of
 * shallows between them (from, to), three tiles wide. A home island under each start, a middle island
 * for the Relic of Valour and the trading posts, and a flank island for each flank relic, each linked
 * to its side's home and to the middle. In a three-way match the other two corners get islands too.
 */
const ISLANDS: [number, number, number][] = [[18, 18, 25], [64, 64, 17], [100, 26, 10]];
const THIRD_ISLAND: [number, number, number] = [108, 20, 22];
const FORDS: [number, number, number, number][] = [[34, 34, 52, 52], [20, 40, 25, 93], [54, 74, 32, 95]];

export const idx = (x: number, y: number) => y * MAP_SIZE + x;
export const inMap = (x: number, y: number) => x >= 0 && y >= 0 && x < MAP_SIZE && y < MAP_SIZE;

export const AMOUNT = { tree: 120, bush: 150, mine: 900 } as const;
const RESOURCE = { tree: 'wood', bush: 'food', mine: 'ore' } as const;

/**
 * Builds a fair random map of a kind: lakes, rock ridges, forests, berry bushes and gold mines are
 * drawn in the whole map and each one is copied to its point mirror, plus each side's starting trees,
 * bushes and mine. Uses Math.random, so a seeded run gives the same map. A map whose water and rock
 * cut a Town Center, camp or trading post off from the rest is drawn again.
 */
export function generateMap(kind: MapKind = 'lowlands', sides: 2 | 3 = 2): MapData {
  let map = drawMap(kind, sides);
  for (let tries = 1; tries < 30 && !connected(map); tries++) map = drawMap(kind, sides);
  return map;
}

/** Whether every Town Center corner, camp and trading post can be walked to from the first side's start. */
function connected(map: MapData) {
  const seen = new Uint8Array(MAP_SIZE * MAP_SIZE);
  const open = (x: number, y: number) => inMap(x, y) && map.terrain[idx(x, y)] !== WATER && map.terrain[idx(x, y)] !== ROCK;
  const from = map.starts[0];
  const todo = [idx(from.tx + 4, from.ty + 1)];
  seen[todo[0]] = 1;
  while (todo.length > 0) {
    const i = todo.pop()!;
    const x = i % MAP_SIZE;
    const y = (i - x) / MAP_SIZE;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (!open(nx, ny) || seen[idx(nx, ny)]) continue;
      seen[idx(nx, ny)] = 1;
      todo.push(idx(nx, ny));
    }
  }
  const spots = [...map.starts.map((t) => ({ x: t.tx + 4, y: t.ty + 1 })), ...map.camps.map((c) => ({ x: c.tx - 1, y: c.ty })), ...map.posts.map((p) => ({ x: p.tx - 1, y: p.ty }))];
  return spots.every((p) => inMap(p.x, p.y) && seen[idx(p.x, p.y)] === 1);
}

function drawMap(kind: MapKind, sides: 2 | 3): MapData {
  const terrain = new Uint8Array(MAP_SIZE * MAP_SIZE);
  const taken = new Uint8Array(MAP_SIZE * MAP_SIZE);
  const nodes: Node[] = [];
  const rand = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
  // Every corner with a Town Center (or, in a three-way match, the free fourth corner) stays clear.
  const corners = sides === 3 ? [...START_TILES, THIRD_START, FOURTH_CORNER] : START_TILES;
  const nearStart = (x: number, y: number) =>
    corners.some((s) => Math.hypot(x - s.tx - 1.5, y - s.ty - 1.5) < 11);

  /** Whether every tile of a footprint and its mirror is free and clear of the starts. */
  const free = (tiles: { x: number; y: number }[]) =>
    tiles.every((t) => inMap(t.x, t.y) && !taken[idx(t.x, t.y)] && !nearStart(t.x, t.y));

  const mirrorTile = (t: { x: number; y: number }, size = 1) => ({ x: MAP_SIZE - t.x - size, y: MAP_SIZE - t.y - size });
  /** The left-right mirror of a tile, from the first side's corner to the second AI's. */
  const flipTile = (t: { x: number; y: number }, size = 1) => ({ x: MAP_SIZE - t.x - size, y: t.y });

  /** Terrain: every tile of a shape, and of its mirror. */
  function shape(tiles: { x: number; y: number }[], kind: typeof WATER | typeof ROCK) {
    const all = tiles.concat(tiles.map((t) => mirrorTile(t)));
    if (!free(all)) return;
    for (const t of all) {
      taken[idx(t.x, t.y)] = 1;
      terrain[idx(t.x, t.y)] = kind;
    }
  }

  /** A round lake with ragged edges, and its mirror. */
  function lake(cx: number, cy: number, r: number) {
    const tiles: { x: number; y: number }[] = [];
    for (let y = cy - r - 1; y <= cy + r + 1; y++)
      for (let x = cx - r - 1; x <= cx + r + 1; x++)
        if (Math.hypot(x - cx, y - cy) <= r + (Math.random() < 0.3 ? 0.9 : 0)) tiles.push({ x, y });
    shape(tiles, WATER);
  }

  /** A resource node of `size` x `size` tiles at `origin`, and the mirrored one. */
  function node(origin: { x: number; y: number }, kind: Node['kind'], size = 1) {
    const m = mirrorTile(origin, size);
    const tiles = [];
    for (const o of [origin, m]) for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) tiles.push({ x: o.x + i, y: o.y + j });
    if (!free(tiles)) return;
    for (const t of tiles) taken[idx(t.x, t.y)] = 1;
    for (const o of [origin, m]) {
      nodes.push({
        id: nodes.length + 1,
        kind,
        res: RESOURCE[kind],
        tx: o.x,
        ty: o.y,
        w: size,
        h: size,
        amount: AMOUNT[kind],
      });
    }
  }

  if (kind === 'highlands') {
    // Two long ridges, one across each side's half of the map, each broken by three narrow passes;
    // the passes and the ground either side of them are kept free of rock, water and trees.
    const ridge: { x: number; y: number }[] = [];
    for (const sum of [HIGH_RIDGE, HIGH_RIDGE + 1])
      for (let x = 0; x <= sum; x++) if (!HIGH_PASSES.some((p) => x >= p - 2 && x <= p + 1)) ridge.push({ x, y: sum - x });
    shape(ridge, ROCK);
    for (const p of HIGH_PASSES)
      for (let y = HIGH_RIDGE - p - 4; y <= HIGH_RIDGE - p + 5; y++)
        for (let x = p - 4; x <= p + 4; x++)
          for (const t of [{ x, y }, mirrorTile({ x, y })]) if (inMap(t.x, t.y) && terrain[idx(t.x, t.y)] !== ROCK) taken[idx(t.x, t.y)] = 1;
  }
  if (kind === 'islands') {
    // The sea everywhere, then the islands carved out of it and the fords laid across. Water stays
    // taken, so trees, bushes, mines and ridges only go on land.
    terrain.fill(WATER);
    taken.fill(1);
    const discs = sides === 3 ? [...ISLANDS, THIRD_ISLAND] : ISLANDS;
    for (const [cx, cy, r] of discs)
      for (let y = cy - r - 1; y <= cy + r + 1; y++)
        for (let x = cx - r - 1; x <= cx + r + 1; x++) {
          if (Math.hypot(x - cx, y - cy) > r + (Math.random() < 0.3 ? 0.9 : 0)) continue;
          for (const t of [{ x, y }, mirrorTile({ x, y })]) {
            if (!inMap(t.x, t.y)) continue;
            terrain[idx(t.x, t.y)] = GRASS;
            taken[idx(t.x, t.y)] = 0;
          }
        }
    for (const [x0, y0, x1, y1] of FORDS) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) {
        const fx = Math.round(x0 + ((x1 - x0) * i) / n);
        const fy = Math.round(y0 + ((y1 - y0) * i) / n);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            for (const t of [{ x: fx + dx, y: fy + dy }, mirrorTile({ x: fx + dx, y: fy + dy })]) {
              if (inMap(t.x, t.y) && terrain[idx(t.x, t.y)] === WATER) terrain[idx(t.x, t.y)] = SHALLOW;
            }
      }
    }
    // Puddles of sea cut off by an island at the map's edge become land, so no Harbour is built
    // where its ships could never leave.
    const seen = new Uint8Array(MAP_SIZE * MAP_SIZE);
    for (let i = 0; i < seen.length; i++) {
      if (seen[i] || !sailable(terrain[i])) continue;
      const pool = [i];
      seen[i] = 1;
      for (let k = 0; k < pool.length; k++) {
        const x = pool[k] % MAP_SIZE;
        const y = Math.floor(pool[k] / MAP_SIZE);
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (!inMap(nx, ny) || seen[idx(nx, ny)] || !sailable(terrain[idx(nx, ny)])) continue;
          seen[idx(nx, ny)] = 1;
          pool.push(idx(nx, ny));
        }
      }
      if (pool.length < 400)
        for (const j of pool) {
          terrain[j] = GRASS;
          taken[j] = 0;
        }
    }
  }
  if (kind === 'lakes') {
    // Two wide lakes either side of the middle, so the way across runs between waters, and a pond by
    // each start for the Dock.
    lake(44, 64, 6);
    lake(64, 44, 6);
    lake(28, 24, 3);
    if (sides === 3) lake(MAP_SIZE - 29, 24, 3);
  }

  // Lakes: round blobs with ragged edges.
  const lakes = kind === 'lakes' ? { n: 12, lo: 3, hi: 6 } : kind === 'highlands' ? { n: 4, lo: 2, hi: 4 } : kind === 'islands' ? { n: 0, lo: 0, hi: 0 } : { n: 7, lo: 2, hi: 4 };
  for (let n = 0; n < lakes.n; n++) {
    const cx = rand(8, 60);
    const cy = rand(8, 60);
    lake(cx, cy, rand(lakes.lo, lakes.hi));
  }

  // Rock ridges: short two-tile-thick lines.
  for (let n = 0; n < (kind === 'highlands' ? 9 : kind === 'lakes' || kind === 'islands' ? 3 : 6); n++) {
    const x0 = rand(6, 56);
    const y0 = rand(6, 56);
    const horizontal = Math.random() < 0.5;
    const len = rand(5, 9);
    const tiles: { x: number; y: number }[] = [];
    for (let i = 0; i < len; i++) {
      tiles.push(horizontal ? { x: x0 + i, y: y0 } : { x: x0, y: y0 + i });
      tiles.push(horizontal ? { x: x0 + i, y: y0 + 1 } : { x: x0 + 1, y: y0 + i });
    }
    shape(tiles, ROCK);
  }

  // Forests: a cluster of single-tile trees.
  for (let n = 0; n < 26; n++) {
    const cx = rand(6, 58);
    const cy = rand(6, 58);
    for (let i = 0; i < 12; i++) node({ x: cx + rand(-3, 3), y: cy + rand(-3, 3) }, 'tree');
  }

  // Berry bushes, clumps of food for the early game.
  for (let n = 0; n < 10; n++) node({ x: rand(6, 58), y: rand(6, 58) }, 'bush');

  // Gold mines, two tiles square.
  for (let n = 0; n < 6; n++) node({ x: rand(6, 58), y: rand(6, 58) }, 'mine', 2);

  // Each side's start: trees and bushes beside the Town Center and a mine a few tiles away. The
  // second side is the mirror of the first, so both start the same.
  const s = START_TILES[0];
  for (const [dx, dy] of [[7, -2], [8, -2], [7, -3], [8, -3], [9, -3], [9, -2], [10, -3], [10, -2], [9, -4], [10, -4]])
    startNode({ x: s.tx + dx, y: s.ty + dy }, 'tree');
  for (const [dx, dy] of [[-3, 0], [-3, 1], [-4, 0], [-4, 1], [-3, -2]]) startNode({ x: s.tx + dx, y: s.ty + dy }, 'bush');
  startNode({ x: s.tx - 4, y: s.ty + 6 }, 'mine', 2);

  function startNode(origin: { x: number; y: number }, kind: Node['kind'], size = 1) {
    // In a three-way match the top-right and bottom-left corners get the same, flipped left to right.
    const flip = flipTile(origin, size);
    const all = sides === 3 ? [origin, flip] : [origin];
    for (const o of all.flatMap((t) => [t, mirrorTile(t, size)])) {
      for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) taken[idx(o.x + i, o.y + j)] = 1;
      nodes.push({ id: nodes.length + 1, kind, res: RESOURCE[kind], tx: o.x, ty: o.y, w: size, h: size, amount: AMOUNT[kind] });
    }
  }

  // Neutral camps: each gets a clear patch (trees, water and rock removed), mirrored like the rest.
  // This uses no Math.random, so the rest of the map is the same as without camps.
  const camps: CampSpot[] = [];
  const cleared = new Uint8Array(MAP_SIZE * MAP_SIZE);
  for (const plan of sides === 3 ? [...CAMP_PLAN, ...THIRD_CAMPS] : CAMP_PLAN) {
    const { mirrorRelic, ...spot } = plan;
    const m = mirrorTile({ x: spot.tx, y: spot.ty }, 2);
    const spots = m.x === spot.tx && m.y === spot.ty ? [spot] : [spot, { ...spot, tx: m.x, ty: m.y, relic: mirrorRelic ?? spot.relic }];
    for (const c of spots) {
      camps.push(c);
      for (let y = c.ty - CAMP_CLEAR; y < c.ty + 2 + CAMP_CLEAR; y++)
        for (let x = c.tx - CAMP_CLEAR; x < c.tx + 2 + CAMP_CLEAR; x++) {
          if (!inMap(x, y)) continue;
          terrain[idx(x, y)] = GRASS;
          cleared[idx(x, y)] = 1;
          taken[idx(x, y)] = 1;
        }
    }
  }
  const posts: PostSpot[] = [POST_PLAN, { tx: MAP_SIZE - POST_PLAN.tx - 2, ty: MAP_SIZE - POST_PLAN.ty - 2 }];
  for (const c of posts)
    for (let y = c.ty - CAMP_CLEAR; y < c.ty + 2 + CAMP_CLEAR; y++)
      for (let x = c.tx - CAMP_CLEAR; x < c.tx + 2 + CAMP_CLEAR; x++) {
        if (!inMap(x, y)) continue;
        terrain[idx(x, y)] = GRASS;
        cleared[idx(x, y)] = 1;
        taken[idx(x, y)] = 1;
      }
  const kept = nodes.filter((n) => {
    for (let j = 0; j < n.h; j++) for (let i = 0; i < n.w; i++) if (cleared[idx(n.tx + i, n.ty + j)]) return false;
    return true;
  });

  // Dirt patches are decoration only.
  for (let n = 0; n < 60; n++) {
    const x = rand(0, MAP_SIZE - 1);
    const y = rand(0, MAP_SIZE - 1);
    if (terrain[idx(x, y)] === GRASS && !taken[idx(x, y)]) terrain[idx(x, y)] = DIRT;
  }

  const starts = sides === 3 ? [...START_TILES, THIRD_START] : [...START_TILES];
  return { terrain, nodes: kept, camps, posts, starts, naval: kind === 'islands' };
}
