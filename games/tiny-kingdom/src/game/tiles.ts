// The buildings and the land they go on. How each building scores is in state.ts.
import type { TextKey } from '../i18n';

/**
 * Every building the pouch holds, in the order of the panel's tile buttons. The first three are
 * there from the start; the rest are gifts, and each one's button shows once it is won.
 */
export const BUILDINGS = ['farm', 'house', 'tower', 'windmill', 'market', 'harbor', 'lumber', 'temple', 'lighthouse', 'orchard', 'cathedral', 'granary', 'gardens', 'road'] as const;
export type Building = (typeof BUILDINGS)[number];
/** The buildings won as gifts, in the order they join the panel. */
export const SPECIALS = ['windmill', 'market', 'harbor', 'lumber', 'temple'] as const;
export type Special = (typeof SPECIALS)[number];
/** The buildings found only on the islands of a chain after the first (see `chainMap`): each such island has one. */
export const NATIVES = ['lighthouse', 'orchard'] as const;
export type Native = (typeof NATIVES)[number];
/**
 * The wonders: 2x2 buildings that score big for what stands around them. Each kingdom draws one
 * (`wonderFor`), which joins the pouch as round WONDER_ROUND begins. A wonder fills four cells of
 * the grid with its kind; the top left one (`wonderAnchor`) holds all its points.
 */
export const WONDERS = ['cathedral', 'granary', 'gardens'] as const;
export type Wonder = (typeof WONDERS)[number];
export const isWonder = (cell: Cell | undefined): cell is Wonder => (WONDERS as readonly string[]).includes(cell as string);
/** The four cells a wonder placed at (col, row) covers, as [dcol, drow] from its top left. */
export const WONDER_CELLS = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
] as const;
/** The twelve cells around a wonder, as [dcol, drow] from its top left: what it scores. */
export const WONDER_AROUND = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [2, -1],
  [-1, 0],
  [2, 0],
  [-1, 1],
  [2, 1],
  [-1, 2],
  [0, 2],
  [1, 2],
  [2, 2],
] as const;
/** Whether (col, row) is the top left cell of a wonder, the one that scores it. */
export const wonderAnchor = (grid: readonly (readonly Cell[])[], col: number, row: number) => {
  const cell = grid[row]?.[col];
  return isWonder(cell) && grid[row][col - 1] !== cell && grid[row - 1]?.[col] !== cell;
};
/** The wonder island `island`'s kingdoms draw: the same for every player. */
export const wonderFor = (island: number): Wonder => WONDERS[Math.floor(seeded(island * 17 + 3)() * WONDERS.length)];
/** Everything that can stand on a cell: the pouch's buildings, and the manor two houses merge into. */
export type Structure = Building | 'manor';
/** The land: grass to build on, lakes, woods, the island's castle, which stands from the start, and the sea cut into a chain island's shape. */
export type Terrain = 'grass' | 'lake' | 'forest' | 'castle' | 'sea';
export type Cell = Terrain | Structure;

export interface BuildingInfo {
  name: TextKey;
  /** The rule in a sentence, shown on the tile's button. */
  rule: TextKey;
  /** A count of them, such as "3 farms", for the pouch line, the trade card and the round banner. */
  count: TextKey;
}

/** Each structure's texts, as keys of `i18n/en.ts` shown with `t`. */
export const INFO: Record<Structure, BuildingInfo> = {
  farm: { name: 'farmName', rule: 'farmRule', count: 'farmCount' },
  house: { name: 'houseName', rule: 'houseRule', count: 'houseCount' },
  tower: { name: 'towerName', rule: 'towerRule', count: 'towerCount' },
  windmill: { name: 'windmillName', rule: 'windmillRule', count: 'windmillCount' },
  market: { name: 'marketName', rule: 'marketRule', count: 'marketCount' },
  harbor: { name: 'harborName', rule: 'harborRule', count: 'harborCount' },
  lumber: { name: 'lumberName', rule: 'lumberRule', count: 'lumberCount' },
  temple: { name: 'templeName', rule: 'templeRule', count: 'templeCount' },
  lighthouse: { name: 'lighthouseName', rule: 'lighthouseRule', count: 'lighthouseCount' },
  orchard: { name: 'orchardName', rule: 'orchardRule', count: 'orchardCount' },
  cathedral: { name: 'cathedralName', rule: 'cathedralRule', count: 'cathedralCount' },
  granary: { name: 'granaryName', rule: 'granaryRule', count: 'granaryCount' },
  gardens: { name: 'gardensName', rule: 'gardensRule', count: 'gardensCount' },
  road: { name: 'roadName', rule: 'roadRule', count: 'roadCount' },
  manor: { name: 'manorName', rule: 'manorRule', count: 'manorCount' },
};

const STRUCTURES: readonly string[] = [...BUILDINGS, 'manor'];
export const isBuilding = (cell: Cell): cell is Structure => STRUCTURES.includes(cell);
/** Whether a cell is built on: a building, a manor or a road (what a chain to the castle runs along). */
export const isBuilt = (cell: Cell | undefined) => cell !== undefined && isBuilding(cell);
/** Whether a cell is a building that scores: everything built but roads. */
export const scores = (cell: Cell | undefined): cell is Exclude<Structure, 'road'> => cell !== undefined && isBuilding(cell) && cell !== 'road';
/** Houses and manors: what towers, decrees and other houses count as homes. */
export const isHome = (cell: Cell | undefined) => cell === 'house' || cell === 'manor';

/** The island's size in cells; GRID in src/scenes/layout.ts must match. */
export const MAP_SIZE = { cols: 10, rows: 7 };
/** The highest island number; each kingdom draws one from 1 to this. */
export const ISLANDS = 9999;

/** The four cells sharing an edge, as [dcol, drow]. */
export const SIDES = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;
/** The eight cells around a cell. */
export const AROUND = [...SIDES, [1, 1], [1, -1], [-1, 1], [-1, -1]] as const;

/**
 * Lays out island number `island`, one string per row and one character per cell: '.' grass,
 * '~' lake, 'T' forest, 'C' the castle. The same number always gives the same island. Buildings
 * only go on grass. A layout that fails `fairIsland` is drawn again from the next seed, so every
 * island has a shore for round 1's decree and a castle with room to build a chain from; the
 * islands that pass on the first draw lie as they always did.
 */
export function islandMap(island: number): string[] {
  for (let attempt = 0; ; attempt++) {
    const map = layIsland(island + attempt * (ISLANDS + 1));
    if (fairIsland(map) || attempt >= 20) return map;
  }
}

/** One draw of an island from `seed`: lakes, woods, then the castle. */
function layIsland(seed: number): string[] {
  const rand = seeded(seed);
  const int = (n: number) => Math.floor(rand() * n);
  const { cols, rows } = MAP_SIZE;
  const map = Array.from({ length: rows }, () => Array<string>(cols).fill('.'));
  /** Grows a patch of `size` cells of `char` from a random grass cell, one random side at a time. */
  const patch = (char: string, size: number) => {
    let col = int(cols);
    let row = int(rows);
    while (map[row][col] !== '.') [col, row] = [int(cols), int(rows)];
    const cells = [[col, row]];
    map[row][col] = char;
    for (let tries = 0; cells.length < size && tries < 50; tries++) {
      const [c, r] = cells[int(cells.length)];
      const [dc, dr] = SIDES[int(4)];
      if (map[r + dr]?.[c + dc] !== '.') continue;
      map[r + dr][c + dc] = char;
      cells.push([c + dc, r + dr]);
    }
  };
  // Two or three lakes of 2 to 4 cells, then two or three woods of 1 to 3, like the first island.
  for (let i = 2 + int(2); i > 0; i--) patch('~', 2 + int(3));
  for (let i = 2 + int(2); i > 0; i--) patch('T', 1 + int(3));
  // The castle stands on a random grass cell, drawn last so the lakes and woods lie as they always did.
  let col = int(cols);
  let row = int(rows);
  while (map[row][col] !== '.') [col, row] = [int(cols), int(rows)];
  map[row][col] = 'C';
  return map.map((cells) => cells.join(''));
}

/** How many grass cells the castle's chain could ever reach: the grass joined to it by shared edges. */
const CASTLE_ROOM = 6;
/** How many grass cells round 1's decree needs on one lake's shore (its ask, so it can be met). */
const FIRST_SHORE = 3;

/**
 * Whether a layout can be played as designed: some lake has FIRST_SHORE grass cells on its shore
 * (round 1's decree asks for that many farms there), and the castle is not walled in by lakes and
 * woods, with at least CASTLE_ROOM grass cells joined to it so its chain can grow.
 */
export function fairIsland(map: string[]): boolean {
  const at = (c: number, r: number) => map[r]?.[c];
  const flood = (start: [number, number][], ok: (ch: string | undefined) => boolean) => {
    const seen = new Set(start.map(([c, r]) => `${c},${r}`));
    const todo = [...start];
    const out: [number, number][] = [];
    while (todo.length) {
      const [c, r] = todo.pop()!;
      out.push([c, r]);
      for (const [dc, dr] of SIDES) {
        const k = `${c + dc},${r + dr}`;
        if (!seen.has(k) && ok(at(c + dc, r + dr))) {
          seen.add(k);
          todo.push([c + dc, r + dr]);
        }
      }
    }
    return out;
  };
  const cells = map.flatMap((row, r) => [...row].map((ch, c) => ({ ch, c, r })));
  const castle = cells.find((x) => x.ch === 'C')!;
  const room = flood([[castle.c, castle.r]], (ch) => ch === '.').length - 1;
  if (room < CASTLE_ROOM) return false;
  const seen = new Set<string>();
  for (const { ch, c, r } of cells) {
    if (ch !== '~' || seen.has(`${c},${r}`)) continue;
    const lake = flood([[c, r]], (x) => x === '~');
    lake.forEach(([lc, lr]) => seen.add(`${lc},${lr}`));
    const shore = new Set<string>();
    for (const [lc, lr] of lake) for (const [dc, dr] of SIDES) if (at(lc + dc, lr + dr) === '.') shore.add(`${lc + dc},${lr + dr}`);
    if (shore.size >= FIRST_SHORE) return true;
  }
  return false;
}

/**
 * How many of the four sides of (col, row) face the sea: the board's edge (every island is an
 * island) or a sea cell cut into a chain island. Harbours and lighthouses score them.
 */
export const seaSides = (grid: readonly (readonly Cell[])[], col: number, row: number) =>
  SIDES.filter(([dc, dr]) => {
    const c = grid[row + dr]?.[col + dc];
    return c === undefined || c === 'sea';
  }).length;

/** The next island of a chain after island `island`, for its `link`th island (2 and up): the same for every player. */
export const nextIsland = (island: number, link: number) => 1 + ((island * 7 + link * 1013) % ISLANDS);

/** The building found only on the `link`th island of a chain (2 and up): lighthouses and orchards in turn. */
export const nativeFor = (link: number): Native | null => (link < 2 ? null : NATIVES[link % NATIVES.length]);

/**
 * Island `island` laid out as the `link`th island of a chain: from the second on, the sea cuts
 * into its shape (' ' cells): two corners and a bay along one edge, taken from grass only, so
 * lakes, woods and the castle stay. A cut that would leave the island unfair (`fairIsland`) is
 * made smaller, down to none. The first island (link 1) is `islandMap` as it always was.
 */
export function chainMap(island: number, link = 1): string[] {
  const base = islandMap(island);
  if (link < 2) return base;
  const rand = seeded(island * 31 + link * 977);
  const int = (n: number) => Math.floor(rand() * n);
  const { cols, rows } = MAP_SIZE;
  const corners = [
    [0, 0, 1, 1],
    [cols - 1, 0, -1, 1],
    [0, rows - 1, 1, -1],
    [cols - 1, rows - 1, -1, -1],
  ];
  const first = int(4);
  const picked = [corners[first], corners[(first + 1 + int(3)) % 4]];
  const sizes = picked.map(() => 2 + int(2));
  // A bay along the top or bottom edge, two to four cells long, one deeper in the middle.
  const bayRow = int(2) ? 0 : rows - 1;
  const bayLen = 2 + int(3);
  const bayCol = 3 + int(cols - 6 - bayLen + 2);
  for (let shrink = 0; shrink <= 3; shrink++) {
    const map = base.map((row) => [...row]);
    const cut = (c: number, r: number) => {
      if (map[r]?.[c] === '.') map[r][c] = ' ';
    };
    picked.forEach(([c0, r0, dc, dr], i) => {
      const k = sizes[i] - shrink;
      for (let a = 0; a < k; a++) for (let b = 0; a + b < k; b++) cut(c0 + a * dc, r0 + b * dr);
    });
    if (shrink < 2) {
      for (let i = 0; i < bayLen - shrink; i++) cut(bayCol + i, bayRow);
      cut(bayCol + Math.floor((bayLen - shrink) / 2), bayRow === 0 ? 1 : rows - 2);
    }
    const out = map.map((cells) => cells.join(''));
    if (fairIsland(out)) return out;
  }
  return base;
}

/** A small seeded random generator (mulberry32), so an island number always lays out the same. */
export function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Picks a random island number, from Math.random so the playthrough's seeded runs repeat. */
export const randomIsland = () => 1 + Math.floor(Math.random() * ISLANDS);

const TERRAIN: Record<string, Terrain> = { '.': 'grass', '~': 'lake', T: 'forest', C: 'castle', ' ': 'sea' };

/** The board of island `island` as the `link`th island of a chain (1 for a kingdom of its own). */
export function startingGrid(island: number, link = 1): Cell[][] {
  return chainMap(island, link).map((row) => [...row].map((c) => TERRAIN[c]));
}
