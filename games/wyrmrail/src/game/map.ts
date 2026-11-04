// The valley the line is built in: a grid of terrain tiles, the Roost where the wyrm sleeps and
// the villages that join the line round by round. Every game makes a new valley with
// `generateValley`. Screen positions are in src/scenes/layout.ts.

import type { TextKey } from '../i18n';

export const COLS = 12;
export const ROWS = 7;

export type Terrain = 'grass' | 'forest' | 'river' | 'mountain';

/**
 * The kinds of valley the wyrm flies through (WR15): the green meadow it starts in, then a chain of
 * snowy, marsh and canyon valleys, each with its own ground, hazards and local goods.
 */
export const VALLEY_KINDS = ['meadow', 'snow', 'marsh', 'canyon'] as const;
export type ValleyKind = (typeof VALLEY_KINDS)[number];

/** What a piece of track costs on each terrain; a river needs a bridge and a mountain a tunnel (WR12). */
export const TRACK_COST: Record<Terrain, number> = { grass: 2, forest: 4, river: 6, mountain: 20 };

/** What a valley kind changes about track prices: an ice bridge over a frozen river is cheap, a bridge over a gorge dear. */
export const KIND_COST: Record<ValleyKind, Partial<Record<Terrain, number>>> = {
  meadow: {},
  snow: { river: 3 },
  marsh: {},
  canyon: { river: 10 },
};

/** A track tile's price on a terrain in a kind of valley, before any charter. */
export const terrainCost = (kind: ValleyKind, t: Terrain) => KIND_COST[kind][t] ?? TRACK_COST[t];

/** Goods a village sends, and the better goods its workshops make from them. */
export type Cargo = 'grain' | 'tools' | 'timber' | 'ore' | 'fish' | 'flour' | 'planks' | 'iron' | 'wool' | 'peat' | 'salt' | 'wares' | 'passengers';

/** The local goods of each valley kind after the meadow, sent by the villages that send fish in the meadow (WR15). */
export const LOCAL_GOODS: Record<ValleyKind, Cargo | null> = { meadow: null, snow: 'wool', marsh: 'peat', canyon: 'salt' };

export interface Tile {
  c: number;
  r: number;
}

export interface Village extends Tile {
  /** The village's place in the line-up, the same in every valley: its art and its workshop go by it. */
  id: string;
  /** Its name in this valley (the id in the meadow). */
  name: string;
  /** What the village sends down the line. */
  cargo: Cargo;
  /** The round it joins the line in. */
  round: number;
}

/** A valley: its terrain, row by row, and where each village stands in it. */
export interface Valley {
  kind: ValleyKind;
  terrain: Terrain[][];
  villages: Village[];
}

/** Where the wyrm sleeps, and starts from. */
export const ROOST: Tile = { c: 1, r: 3 };

/**
 * The villages, in the order they join the line. The first two always stand where the first round
 * expects them; the others get a place in each new valley.
 */
const VILLAGE_LIST: (Omit<Village, 'c' | 'r' | 'id'> & Partial<Tile>)[] = [
  { name: 'Millbrook', cargo: 'grain', c: 4, r: 1, round: 1 },
  { name: 'Ashford', cargo: 'tools', c: 4, r: 5, round: 1 },
  { name: 'Fernhollow', cargo: 'timber', round: 2 },
  { name: 'Stonereach', cargo: 'ore', round: 3 },
  { name: 'Saltmere', cargo: 'fish', round: 4 },
  { name: 'Brackenly', cargo: 'timber', round: 5 },
  { name: 'Dunmoor', cargo: 'grain', round: 6 },
  { name: 'Wyndle', cargo: 'fish', round: 7 },
  { name: 'Kettlecross', cargo: 'tools', round: 8 },
];
export const VILLAGE_NAMES = VILLAGE_LIST.map((v) => v.name);

/** The villages' names in each valley kind after the meadow, in the same order as `VILLAGE_LIST`. */
const KIND_NAMES: Record<ValleyKind, string[]> = {
  meadow: VILLAGE_NAMES,
  snow: ['Frostmill', 'Icehold', 'Pinecold', 'Whitecrag', 'Rimewater', 'Snowbury', 'Hailmoor', 'Sleetby', 'Wintercross'],
  marsh: ['Reedmill', 'Mossford', 'Fenhollow', 'Mirestone', 'Eelmere', 'Rushby', 'Bogmoor', 'Mistle', 'Marshcross'],
  canyon: ['Dustmill', 'Redford', 'Sandhollow', 'Cragreach', 'Saltpan', 'Mesaby', 'Duneholm', 'Gulchwater', 'Rimcross'],
};

/** How each kind of valley is laid out: mountains (and from which column), forests and bog pools. */
const KIND_SHAPE: Record<ValleyKind, { mountains: [number, number]; mountainCol: number; forests: [number, number]; pools: number }> = {
  meadow: { mountains: [4, 3], mountainCol: 8, forests: [9, 5], pools: 0 },
  snow: { mountains: [7, 3], mountainCol: 6, forests: [6, 4], pools: 0 },
  marsh: { mountains: [0, 1], mountainCol: 8, forests: [7, 4], pools: 6 },
  canyon: { mountains: [8, 3], mountainCol: 5, forests: [0, 2], pools: 0 },
};
/** Villages with a workshop: it turns one cargo brought to it into a better one, which it sends on. */
export const WORKSHOPS: Record<string, { kind: string; takes: Cargo; makes: Cargo }> = {
  Ashford: { kind: 'forge', takes: 'ore', makes: 'iron' },
  Fernhollow: { kind: 'mill', takes: 'grain', makes: 'flour' },
  Stonereach: { kind: 'sawmill', takes: 'timber', makes: 'planks' },
};

/** Each cargo's name (on an order card) and the same word inside a sentence, as keys of `i18n/en.ts`. */
export const CARGO_NAMES: Record<Cargo, { name: TextKey; lower: TextKey }> = {
  grain: { name: 'grain', lower: 'grainLower' },
  tools: { name: 'tools', lower: 'toolsLower' },
  timber: { name: 'timber', lower: 'timberLower' },
  ore: { name: 'ore', lower: 'oreLower' },
  wool: { name: 'wool', lower: 'woolLower' },
  peat: { name: 'peat', lower: 'peatLower' },
  salt: { name: 'salt', lower: 'saltLower' },
  fish: { name: 'fish', lower: 'fishLower' },
  flour: { name: 'flour', lower: 'flourLower' },
  planks: { name: 'planks', lower: 'planksLower' },
  iron: { name: 'iron', lower: 'ironLower' },
  wares: { name: 'wares', lower: 'waresLower' },
  passengers: { name: 'passengers', lower: 'passengersLower' },
};

export const key = (t: Tile) => `${t.c},${t.r}`;
export const sameTile = (a: Tile, b: Tile) => a.c === b.c && a.r === b.r;
export const manhattan = (a: Tile, b: Tile) => Math.abs(a.c - b.c) + Math.abs(a.r - b.r);
/** The tile across `t` from `n`, the straight way on. */
export const opposite = (t: Tile, n: Tile): Tile => ({ c: 2 * t.c - n.c, r: 2 * t.r - n.r });
export const inGrid = (t: Tile) => t.c >= 0 && t.r >= 0 && t.c < COLS && t.r < ROWS;

/** The four tiles next to `t` that are on the grid. */
export function neighbours(t: Tile): Tile[] {
  return [
    { c: t.c + 1, r: t.r },
    { c: t.c - 1, r: t.r },
    { c: t.c, r: t.r + 1 },
    { c: t.c, r: t.r - 1 },
  ].filter(inGrid);
}

export const terrainAt = (valley: Valley, t: Tile) => valley.terrain[t.r][t.c];

/** The first round's ground, between the Roost and the first two villages: always open grass. */
const isHome = (t: Tile) => t.c >= 2 && t.c <= 4 && t.r >= 1 && t.r <= 5;

/**
 * A new valley of a kind, picked with `rand` (Math.random in the game, today's seed for the daily
 * valley): a river winding down the middle that the line has to bridge, a few mountains in the
 * east, scattered forest, and a place for each village that joins after the first round, spread
 * apart and all reachable from the Roost. A snowy valley has more mountains, a marsh bog pools and
 * no mountains to speak of, a canyon mountains on both sides of its gorge and hardly a tree.
 */
export function generateValley(rand: () => number = Math.random, kind: ValleyKind = 'meadow'): Valley {
  for (;;) {
    const valley = tryValley(rand, kind);
    if (valley) return valley;
  }
}

function tryValley(rand: () => number, kind: ValleyKind): Valley | null {
  const shape = KIND_SHAPE[kind];
  const pick = <T>(list: T[]) => list[Math.floor(rand() * list.length)];
  const terrain: Terrain[][] = Array.from({ length: ROWS }, () => Array<Terrain>(COLS).fill('grass'));
  // The river: one tile a row, stepping a column east or west now and then, between columns 6 and 8.
  let rc = 6 + Math.floor(rand() * 2);
  for (let r = 0; r < ROWS; r++) {
    terrain[r][rc] = 'river';
    const next = Math.min(8, Math.max(6, rc + pick([-1, 0, 0, 1])));
    if (r < ROWS - 1 && next !== rc) {
      // A bend: the river runs along the row before it turns down again.
      terrain[r][next] = 'river';
      rc = next;
    }
  }
  const all: Tile[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) all.push({ c, r });
  const free = (t: Tile) => terrain[t.r][t.c] === 'grass' && !isHome(t) && !sameTile(t, ROOST);
  // Mountains east of the river, bog pools in a marsh, and forest anywhere off the first round's ground.
  const mountains = shape.mountains[0] + Math.floor(rand() * shape.mountains[1]);
  for (let i = 0; i < mountains; i++) {
    const t = pick(all.filter((t) => t.c >= shape.mountainCol && free(t)));
    terrain[t.r][t.c] = 'mountain';
  }
  for (let i = 0; i < shape.pools; i++) {
    const t = pick(all.filter(free));
    terrain[t.r][t.c] = 'river';
  }
  const forests = shape.forests[0] + Math.floor(rand() * shape.forests[1]);
  for (let i = 0; i < forests; i++) {
    const t = pick(all.filter(free));
    terrain[t.r][t.c] = 'forest';
  }
  // The villages that join later: on land, three or more tiles from the Roost and every other village.
  const villages: Village[] = [];
  const local = LOCAL_GOODS[kind];
  for (const [i, entry] of VILLAGE_LIST.entries()) {
    const v = { ...entry, id: entry.name, name: KIND_NAMES[kind][i], cargo: local && entry.cargo === 'fish' ? local : entry.cargo };
    if (v.c !== undefined && v.r !== undefined) {
      villages.push({ ...v, c: v.c, r: v.r });
      continue;
    }
    const spots = all.filter(
      (t) =>
        !isHome(t) &&
        (terrain[t.r][t.c] === 'grass' || terrain[t.r][t.c] === 'forest') &&
        manhattan(t, ROOST) >= 3 &&
        villages.every((o) => manhattan(t, o) >= 3),
    );
    if (!spots.length) return null;
    const t = pick(spots);
    terrain[t.r][t.c] = 'grass';
    villages.push({ ...v, c: t.c, r: t.r });
  }
  // Every village must be reachable from the Roost around the mountains.
  const seen = new Set([key(ROOST)]);
  const queue = [ROOST];
  while (queue.length) {
    for (const n of neighbours(queue.shift()!)) {
      if (seen.has(key(n)) || terrain[n.r][n.c] === 'mountain') continue;
      seen.add(key(n));
      queue.push(n);
    }
  }
  return villages.every((v) => seen.has(key(v))) ? { kind, terrain, villages } : null;
}
