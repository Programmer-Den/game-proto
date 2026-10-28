import { KINDS, kindOf, type IsleKind, type KindInfo } from './kinds';
import type { TextKey } from '../i18n';
import { FEATURE_BONUS, GRID, WOOD_MIN, inGrid, indexOf, neighbours, type Clue, type Feature, type Find, type Ground, type Point, type Riddle, type Tile } from './state';
import type { Terrain } from './terrain';

/** How many of each find an isle hides, and the tiles each can hide under. */
const FINDS: { find: Find; count: number; on: Terrain[]; distance: number }[] = [
  { find: 'wreck', count: 2, on: ['beach', 'sea'], distance: 2 },
  { find: 'cave', count: 2, on: ['hills', 'mountain', 'forest'], distance: 3 },
  { find: 'storm', count: 2, on: ['grass', 'forest', 'beach', 'hills'], distance: 2 },
];

export interface Island {
  kind: IsleKind;
  tiles: Tile[];
  port: Point;
  riddle: Riddle | null;
  features: Feature[];
  /** The seed it was rolled from: `makeIsland(number, seed)` rolls the same isle again, so a save keeps only this. */
  seed: number;
}

/**
 * Rolls an island on the grid: one stretch of land, ringed by beaches, with hills and peaks on its
 * high ground, forests and meadows elsewhere, rivers down to the sea, villages and ruins away from
 * the port and a road to the nearest village, finds hidden under some tiles and a treasure riddle.
 * Every tile starts under fog except the port on the south coast. Later islands have more
 * landmarks, and each kind of isle (`kindOf`) has its own mix. All of it comes from `seed`, so the
 * same number and seed always roll the same isle (which is how a save rebuilds it).
 */
export function makeIsland(number: number, seed = newSeed()): Island {
  const kind = kindOf(number);
  const random = seeded(seed);
  for (;;) {
    const island = tryIsland(number, kind, KINDS[kind], random);
    if (island) return { ...island, seed };
  }
}

/** A fresh isle seed, a whole number below 2^32, from `Math.random` (which the playthrough seeds). */
export const newSeed = () => Math.floor(Math.random() * 2 ** 32);

/** A small seeded random in [0, 1) (mulberry32), so an isle rolls the same from the same seed. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tryIsland(number: number, kind: IsleKind, k: KindInfo, random: () => number): Omit<Island, 'seed'> | null {
  const { w, h } = GRID;
  const heightNoise = valueNoise(k.cell, random);
  const woodNoise = valueNoise(3, random);
  const reliefNoise = valueNoise(3, random);
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  const height = (x: number, y: number) => {
    const dx = (x - cx) / (w / 2 - 0.5);
    const dy = (y - cy) / (h / 2 - 0.5);
    return 1 - Math.hypot(dx, dy) * 0.9 + (heightNoise[indexOf(x, y)] - 0.5) * k.rough;
  };

  const land = new Array<boolean>(w * h).fill(false);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) land[indexOf(x, y)] = height(x, y) > k.shore;

  // An archipelago's islets are joined by sandbars, so the surveyor can walk to all of them.
  if (kind === 'archipelago') joinIslets(land);
  // Keep only the biggest stretch of land, so every land tile can be walked to from the port.
  const biggest = largestPatch(land);
  if (biggest.length < k.minLand) return null;
  const keep = new Set(biggest.map((p) => indexOf(p.x, p.y)));

  const terrain = new Array<Terrain>(w * h).fill('sea');
  const relief = new Array<number>(w * h).fill(0);
  for (const p of biggest) {
    const i = indexOf(p.x, p.y);
    const coast = neighbours(p.x, p.y).some((n) => !keep.has(indexOf(n.x, n.y)));
    // High ground rises where the island is tall and the relief is rough.
    const z = (0.35 + k.lift) * height(p.x, p.y) + 0.75 * reliefNoise[i] - 0.1;
    relief[i] = z;
    terrain[i] = coast ? 'beach' : z > k.peakAt ? 'mountain' : z > k.hillsAt ? 'hills' : woodNoise[i] > k.woods ? 'forest' : 'grass';
  }

  // The port: the southernmost beach, nearest the middle.
  const beaches = biggest.filter((p) => terrain[indexOf(p.x, p.y)] === 'beach');
  beaches.sort((a, b) => b.y - a.y || Math.abs(a.x - cx) - Math.abs(b.x - cx));
  const port = beaches[0];
  terrain[indexOf(port.x, port.y)] = 'port';

  addRivers(terrain, relief, biggest, k.rivers, port);

  const far = (p: Point, d: number) => Math.abs(p.x - port.x) + Math.abs(p.y - port.y) >= d;
  const place = (kind: Terrain, count: number, on: Terrain[], distance: number) => {
    for (let n = 0; n < count; n++) {
      let spots = biggest.filter((p) => on.includes(terrain[indexOf(p.x, p.y)]) && far(p, distance));
      if (spots.length === 0) spots = biggest.filter((p) => ['grass', 'forest', 'beach'].includes(terrain[indexOf(p.x, p.y)]) && far(p, 2));
      if (spots.length === 0) return;
      const p = spots[Math.floor(random() * spots.length)];
      terrain[indexOf(p.x, p.y)] = kind;
    }
  };
  place('village', Math.min(2 + Math.floor((number - 1) / 2), 4), ['grass'], 3);
  if (k.roads > 0) addRoad(terrain, port);
  place('ruins', Math.min(1 + Math.floor((number - 1) / 2), 3), ['forest', 'hills'], 4);

  const tiles: Tile[] = terrain.map((t) => ({ terrain: t, revealed: t === 'port' }));

  // Finds, each on its own tile.
  const coastal = (p: Point) => neighbours(p.x, p.y).some((n) => terrain[indexOf(n.x, n.y)] !== 'sea');
  for (const f of FINDS) {
    for (let n = 0; n < f.count; n++) {
      const spots: Point[] = [];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const t = tiles[indexOf(x, y)];
          if (t.find || !f.on.includes(t.terrain) || !far({ x, y }, f.distance)) continue;
          if (t.terrain === 'sea' && !coastal({ x, y })) continue;
          spots.push({ x, y });
        }
      }
      if (spots.length === 0) break;
      const p = spots[Math.floor(random() * spots.length)];
      tiles[indexOf(p.x, p.y)].find = f.find;
    }
  }

  return { kind, tiles, port: { x: port.x, y: port.y }, riddle: makeRiddle(tiles, port, random), features: findFeatures(terrain, number) };
}

// ---- Features: the rivers, roads and woods that pay a bonus once charted whole.

// Keys of `i18n/en.ts`: the state keeps the key, and the scene shows it with `t`.
const RIVER_NAMES: TextKey[] = ['otterBrook', 'heronWater', 'millStream', 'alderBurn', 'kestrelRun', 'foxBeck'];
const ROAD_NAMES: TextKey[] = ['portRoad', 'oldRoad', 'droversWay', 'saltRoad'];
const WOOD_NAMES: TextKey[] = ['thornwood', 'ashgrove', 'elderWood', 'blackthorn', 'hazelHolt', 'rookWood'];

/**
 * Finds the island's features in its terrain: each stretch of river, road or forest joined side to
 * side (a wood needs `WOOD_MIN` tiles), named from the island number, in reading order. Each pays
 * `FEATURE_BONUS` a tile once every tile of it is charted. Worked out from the tiles alone, so a save
 * from before features can have them too.
 */
export function findFeatures(terrain: Terrain[], island: number): Feature[] {
  const out: Feature[] = [];
  const seen = new Set<number>();
  const counts = { river: 0, road: 0, wood: 0 };
  for (let y = 0; y < GRID.h; y++) {
    for (let x = 0; x < GRID.w; x++) {
      const t = terrain[indexOf(x, y)];
      const kind = t === 'river' ? 'river' : t === 'road' ? 'road' : t === 'forest' ? 'wood' : null;
      if (!kind || seen.has(indexOf(x, y))) continue;
      const tiles: Point[] = [];
      const queue: Point[] = [{ x, y }];
      seen.add(indexOf(x, y));
      while (queue.length > 0) {
        const p = queue.pop()!;
        tiles.push(p);
        for (const n of neighbours(p.x, p.y)) {
          const i = indexOf(n.x, n.y);
          if (terrain[i] === t && !seen.has(i)) {
            seen.add(i);
            queue.push(n);
          }
        }
      }
      if (kind === 'wood' && tiles.length < WOOD_MIN) continue;
      const names = kind === 'river' ? RIVER_NAMES : kind === 'road' ? ROAD_NAMES : WOOD_NAMES;
      const name = names[(island * 2 + counts[kind]++) % names.length];
      tiles.sort((a, b) => a.y - b.y || a.x - b.x);
      out.push({ kind, name, tiles, bonus: FEATURE_BONUS * tiles.length });
    }
  }
  return out;
}

/** Joins every islet to the biggest one with a straight-ish sandbar of land, nearest first. */
function joinIslets(land: boolean[]) {
  for (let guard = 0; guard < 12; guard++) {
    const main = largestPatch(land);
    const inMain = new Set(main.map((p) => indexOf(p.x, p.y)));
    if (land.every((l, i) => !l || inMain.has(i))) return;
    // Breadth-first over the sea from the main islet to the nearest other land.
    const from = new Map<number, number>();
    const queue = main.map((p) => indexOf(p.x, p.y));
    for (const i of queue) from.set(i, -1);
    let hit = -1;
    for (let q = 0; q < queue.length && hit < 0; q++) {
      const i = queue[q];
      for (const n of neighbours(i % GRID.w, Math.floor(i / GRID.w))) {
        const j = indexOf(n.x, n.y);
        if (from.has(j) || n.x === 0 || n.y === 0 || n.x === GRID.w - 1 || n.y === GRID.h - 1) continue;
        from.set(j, i);
        if (land[j]) {
          hit = j;
          break;
        }
        queue.push(j);
      }
    }
    if (hit < 0) return;
    for (let i = from.get(hit)!; i >= 0 && !inMain.has(i); i = from.get(i)!) land[i] = true;
  }
}

/**
 * Runs rivers from the highest ground down to the sea: each step goes to the neighbour nearest the
 * coast, so every river reaches the water. Rivers don't run through peaks, the port or each other.
 */
function addRivers(terrain: Terrain[], relief: number[], land: Point[], count: number, port: Point) {
  if (count <= 0) return;
  // Steps to the sea from every land tile.
  const toSea = new Map<number, number>();
  const queue: Point[] = [];
  for (const p of land) {
    if (neighbours(p.x, p.y).some((n) => terrain[indexOf(n.x, n.y)] === 'sea')) {
      toSea.set(indexOf(p.x, p.y), 0);
      queue.push(p);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const p = queue[q];
    for (const n of neighbours(p.x, p.y)) {
      const j = indexOf(n.x, n.y);
      if (terrain[j] === 'sea' || toSea.has(j)) continue;
      toSea.set(j, toSea.get(indexOf(p.x, p.y))! + 1);
      queue.push(n);
    }
  }
  const sources = land
    .filter((p) => (toSea.get(indexOf(p.x, p.y)) ?? 0) >= 2)
    .sort((a, b) => relief[indexOf(b.x, b.y)] - relief[indexOf(a.x, a.y)]);
  const near = (p: Point, q: Point, d: number) => Math.abs(p.x - q.x) + Math.abs(p.y - q.y) <= d;
  let made = 0;
  for (const src of sources) {
    if (made >= count) return;
    if (land.some((p) => terrain[indexOf(p.x, p.y)] === 'river' && near(p, src, 3))) continue;
    const path: Point[] = [];
    let p = src;
    for (;;) {
      path.push(p);
      const d = toSea.get(indexOf(p.x, p.y))!;
      if (d === 0) break;
      const next = neighbours(p.x, p.y)
        .filter((n) => toSea.get(indexOf(n.x, n.y)) === d - 1)
        .sort((a, b) => relief[indexOf(a.x, a.y)] - relief[indexOf(b.x, b.y)])[0];
      p = next;
    }
    // The spring stays a lookout; the river runs from the tile below it.
    const run = terrain[indexOf(src.x, src.y)] === 'mountain' || terrain[indexOf(src.x, src.y)] === 'hills' ? path.slice(1) : path;
    if (run.length < 2) continue;
    if (run.some((q) => ['mountain', 'river', 'port'].includes(terrain[indexOf(q.x, q.y)]) || near(q, port, 1))) continue;
    for (const q of run) terrain[indexOf(q.x, q.y)] = 'river';
    made++;
  }
}

/** Lays a road from beside the port to beside the nearest village, round peaks and rivers. */
function addRoad(terrain: Terrain[], port: Point) {
  const from = new Map<number, number>([[indexOf(port.x, port.y), -1]]);
  const queue = [indexOf(port.x, port.y)];
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    for (const n of neighbours(i % GRID.w, Math.floor(i / GRID.w))) {
      const j = indexOf(n.x, n.y);
      if (from.has(j)) continue;
      const t = terrain[j];
      if (t === 'village') {
        for (let k = i; from.get(k)! >= 0; k = from.get(k)!) terrain[k] = 'road';
        return;
      }
      if (t === 'sea' || t === 'mountain' || t === 'river' || t === 'ruins') continue;
      from.set(j, i);
      queue.push(j);
    }
  }
}

// ---- The treasure riddle.

/** A clue, and whether a tile at (x, y) fits it. */
interface Candidate {
  clue: Clue;
  holds: (x: number, y: number) => boolean;
}

const DIRS: { dir: 'north' | 'east' | 'south' | 'west'; dx: number; dy: number }[] = [
  { dir: 'north', dx: 0, dy: -1 },
  { dir: 'east', dx: 1, dy: 0 },
  { dir: 'south', dx: 0, dy: 1 },
  { dir: 'west', dx: -1, dy: 0 },
];
const MARKS: ('mountain' | 'village' | 'ruins' | 'port')[] = ['mountain', 'village', 'ruins', 'port'];
const GROUND: Ground[] = ['grass', 'forest', 'beach', 'hills'];
/**
 * The order the landmark clues are tried in, each list best first: two tiles off reads better than
 * three, and three better than one. (It is the order of their English wording, from Z to A, which
 * picked the clues before they were translated, so every island keeps its riddle.)
 */
const TILES_ORDER = [2, 3, 1];
const DIR_ORDER = ['west', 'south', 'north', 'east'];
const MARK_ORDER = ['ruins', 'port', 'village', 'mountain'];

/**
 * Picks a hidden tile and two or three clues that point at it and at no other tile you could dig
 * ("Two tiles west of a peak, by the water"). Null when no tile can be told apart.
 */
function makeRiddle(tiles: Tile[], port: Point, random: () => number): Riddle | null {
  const T = (x: number, y: number): Terrain => (inGrid(x, y) ? tiles[indexOf(x, y)].terrain : 'sea');
  const diggable: Point[] = [];
  for (let y = 0; y < GRID.h; y++) for (let x = 0; x < GRID.w; x++) if (T(x, y) !== 'sea' && T(x, y) !== 'port') diggable.push({ x, y });
  const spots = diggable.filter(
    (p) => GROUND.includes(T(p.x, p.y) as Ground) && !tiles[indexOf(p.x, p.y)].find && Math.abs(p.x - port.x) + Math.abs(p.y - port.y) >= 4,
  );
  const by = (x: number, y: number, t: Terrain) => neighbours(x, y).some((n) => T(n.x, n.y) === t);
  const start = spots.length ? Math.floor(random() * spots.length) : 0;
  for (let k = 0; k < spots.length; k++) {
    const at = spots[(start + k) % spots.length];
    const ground = T(at.x, at.y) as Ground;
    const placed: Candidate[] = [];
    for (const mark of MARKS) {
      for (const d of DIRS) {
        for (let n = 1; n <= 3; n++) {
          const holds = (x: number, y: number) => T(x - n * d.dx, y - n * d.dy) === mark;
          if (holds(at.x, at.y)) placed.push({ clue: { kind: 'from', tiles: n, dir: d.dir, mark }, holds });
        }
      }
    }
    const traits: Candidate[] = [{ clue: { kind: 'ground', ground }, holds: (x, y) => T(x, y) === ground }];
    if (by(at.x, at.y, 'sea')) traits.push({ clue: { kind: 'water' }, holds: (x, y) => by(x, y, 'sea') });
    else traits.push({ clue: { kind: 'inland' }, holds: (x, y) => !by(x, y, 'sea') });
    if (by(at.x, at.y, 'river')) traits.push({ clue: { kind: 'river' }, holds: (x, y) => by(x, y, 'river') });
    // Landmark clues are tried in the order above; the fewest clues that leave one tile win.
    const rank = (c: Clue) =>
      c.kind === 'from' ? TILES_ORDER.indexOf(c.tiles) * 100 + DIR_ORDER.indexOf(c.dir) * 10 + MARK_ORDER.indexOf(c.mark) : 0;
    placed.sort((a, b) => rank(a.clue) - rank(b.clue));
    const unique = (cs: Candidate[]) => diggable.filter((p) => cs.every((c) => c.holds(p.x, p.y))).length === 1;
    const sets: Candidate[][] = [];
    for (const p of placed) for (const t of traits) sets.push([p, t]);
    for (const p of placed) for (let i = 0; i < traits.length; i++) for (let j = i + 1; j < traits.length; j++) sets.push([p, traits[i], traits[j]]);
    const set = sets.find(unique);
    if (set) return { at, clues: set.map((c) => c.clue), known: false, found: false };
  }
  return null;
}

/** Smooth noise in [0, 1) over the grid: random values every `cell` tiles, blended between. */
function valueNoise(cell: number, random: () => number) {
  const { w, h } = GRID;
  const lw = Math.ceil(w / cell) + 2;
  const lh = Math.ceil(h / cell) + 2;
  const lattice = Array.from({ length: lw * lh }, () => random());
  const at = (i: number, j: number) => lattice[j * lw + i];
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const out: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = x / cell;
      const gy = y / cell;
      const i = Math.floor(gx);
      const j = Math.floor(gy);
      const tx = smooth(gx - i);
      const ty = smooth(gy - j);
      const top = at(i, j) + (at(i + 1, j) - at(i, j)) * tx;
      const bottom = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * tx;
      out.push(top + (bottom - top) * ty);
    }
  }
  return out;
}

/** The biggest group of `true` tiles joined side to side. */
function largestPatch(cells: boolean[]): Point[] {
  const seen = new Set<number>();
  let best: Point[] = [];
  for (let y = 0; y < GRID.h; y++) {
    for (let x = 0; x < GRID.w; x++) {
      if (!cells[indexOf(x, y)] || seen.has(indexOf(x, y))) continue;
      const patch: Point[] = [];
      const queue: Point[] = [{ x, y }];
      seen.add(indexOf(x, y));
      while (queue.length > 0) {
        const p = queue.pop()!;
        patch.push(p);
        for (const n of neighbours(p.x, p.y)) {
          const i = indexOf(n.x, n.y);
          if (cells[i] && !seen.has(i)) {
            seen.add(i);
            queue.push(n);
          }
        }
      }
      if (patch.length > best.length) best = patch;
    }
  }
  return best;
}
