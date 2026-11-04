// The places of the three chapters, built in code from rectangles and lines on a grid of
// TILE-pixel tiles: Mossford (the village), Bramble Woods, Glimmer Fen, the Sunken Shrine, the
// Drowned Belfry, the Hollow Peaks and the Glass Caverns.
// Everything that is not ground (houses, lamps, people, foes, chests, posts) is listed beside the
// tiles. Tile coordinates count from the map's top-left corner.

import { t } from '../i18n';

export const TILE = 32;

export type Tile =
  | 'grass'
  | 'path'
  | 'flowers'
  | 'tree'
  | 'faketree'
  | 'bush'
  | 'thorns'
  | 'water'
  | 'reeds'
  | 'wall'
  | 'floor'
  | 'pit'
  | 'ring'
  | 'boulder'
  | 'crack'
  | 'veil';

/**
 * Tiles nothing walks through. `faketree` looks like a tree but is walkable (a secret way). `veil`
 * is a hidden bridge over a chasm: a pit to everyone but a knight carrying the Moonlantern, who can
 * walk it where its light falls (`GameScene.solidTile`).
 */
export const SOLID: ReadonlySet<Tile> = new Set<Tile>(['tree', 'bush', 'thorns', 'water', 'wall', 'pit', 'ring', 'boulder', 'crack', 'veil']);
/** Solid tiles the hookvine flies over. */
export const LOW: ReadonlySet<Tile> = new Set<Tile>(['water', 'pit', 'bush', 'ring', 'veil']);
/** Tiles the sword clears. */
export const CUTTABLE: ReadonlySet<Tile> = new Set<Tile>(['bush', 'thorns']);
/** Tiles a bursting bellseed breaks: boulders outdoors and cracked walls indoors. */
export const BREAKABLE: ReadonlySet<Tile> = new Set<Tile>(['boulder', 'crack']);

export type MapId = 'village' | 'woods' | 'fen' | 'shrine' | 'belfry' | 'peaks' | 'caverns';
export type Theme = MapId;
/** Indoor maps: walls and floors, keys and shut doors, and foes that stay beaten. */
export const DUNGEONS: ReadonlySet<MapId> = new Set<MapId>(['shrine', 'belfry', 'caverns']);
/** Each dungeon's boss, by the flag that beating it sets. */
export const BOSS_FLAG: Partial<Record<MapId, string>> = { shrine: 'boss', belfry: 'wraith', caverns: 'gloam' };
/** Moonstones that only show once a boss is beaten, and the flag that beats it. */
export const AFTER_BOSS: Record<string, string> = { 's-boss': 'boss', 'b-bell': 'wraith', 'c-boss': 'gloam' };
export type Facing = 'up' | 'down' | 'left' | 'right';
export type PropKind = 'house' | 'shed' | 'well' | 'lamp' | 'statue' | 'arch' | 'hut' | 'brazier' | 'shroom' | 'bench' | 'rock' | 'tower' | 'bell' | 'candle' | 'cave' | 'crystal';
export type EnemyKind = 'slug' | 'moth' | 'thornling' | 'frog' | 'beetle' | 'lantern' | 'shade';
export type NpcId = 'elder' | 'pip' | 'baker' | 'cat' | 'hermit' | 'herder';
/** The villagers' requests (`REQUESTS` in `state.ts`). */
export type RequestId = 'lilies' | 'boat' | 'glowcaps' | 'specs' | 'goatbells';

export interface Prop {
  kind: PropKind;
  /** Top-left tile of its footprint. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Which way a statue points, for the fen's riddle. */
  facing?: Facing;
  /** A bell's voice: 0 is the deepest (the biggest bell), 2 the highest. */
  note?: number;
}
export interface Npc { id: NpcId; name: string; x: number; y: number }
export interface Chest { id: string; x: number; y: number; item: ItemId }
export interface Sign { x: number; y: number; text: string }
export interface Exit {
  /** The tiles that lead out. */
  x: number;
  y: number;
  w: number;
  h: number;
  to: MapId;
  /** The tile the player arrives on there, and which way they face. */
  tx: number;
  ty: number;
  facing: Facing;
  /** A flag that must be set before the way opens. */
  flag?: string;
  /** A quest step the story must have reached first (a new game+ knight has the tools early). */
  quest?: 'belfry' | 'peaks';
}
export interface EnemySpawn { kind: EnemyKind; x: number; y: number; room?: string }
export interface Post { x: number; y: number }
/** A door across one or more tiles: `key` needs a small key, `bars` opens on a flag, `shut` closes while its room has foes. */
export interface Door { id: string; x: number; y: number; w: number; h: number; kind: 'key' | 'bars' | 'shut'; flag?: string; room?: string }
/**
 * A moonstone: lying in the open, under a bush (shows once the bush is cut) or buried (a sword swing
 * on the spot digs it up). `chapter` 2 marks the five that count once chapter two starts, 3 the four
 * of chapter three. `glimmer` marks a stone a new game+ moved (`plus.ts`): buried, it glimmers in
 * the knight's light.
 */
export interface Moonstone { id: string; x: number; y: number; hidden?: 'buried'; chapter?: 2 | 3; glimmer?: boolean }
/** A thing a villager asked for, lying somewhere until the request is taken and it is picked up. */
export interface Find { req: RequestId; x: number; y: number }
export interface Room { id: string; x: number; y: number; w: number; h: number }

export type ItemId = 'sword' | 'hookvine' | 'key' | 'heart' | 'oil' | 'seeds' | 'moonlantern';

export interface MapDef {
  id: MapId;
  name: string;
  theme: Theme;
  w: number;
  h: number;
  /** How dark the night is here, 0 to 1. */
  dark: number;
  tiles: Tile[];
  props: Prop[];
  npcs: Npc[];
  chests: Chest[];
  signs: Sign[];
  exits: Exit[];
  enemies: EnemySpawn[];
  posts: Post[];
  doors: Door[];
  stones: Moonstone[];
  finds: Find[];
  rooms: Room[];
  /** Push blocks and the plate one of them opens. */
  blocks: { x: number; y: number }[];
  plates: { x: number; y: number; flag: string }[];
  /** The boss arena's middle, in tiles: the Thornmother's in the shrine, the Bellwraith's in the belfry, the Gloamwing's in the caverns. */
  boss?: { x: number; y: number };
  /** The fen's will-o'-wisp hops between these tiles. */
  wisp?: { x: number; y: number }[];
  /** A dungeon's hourglass, by its entry: once chapter two is done and its boss beaten, it starts the trial (`GameScene.startTrial`). */
  hourglass?: { x: number; y: number };
}

/** A small fixed-seed random number generator, so the maps are the same every time. */
function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

class Builder {
  readonly def: MapDef;
  constructor(id: MapId, name: string, theme: Theme, w: number, h: number, dark: number, ground: Tile) {
    this.def = {
      id, name, theme, w, h, dark,
      tiles: new Array<Tile>(w * h).fill(ground),
      props: [], npcs: [], chests: [], signs: [], exits: [], enemies: [], posts: [], doors: [], stones: [], finds: [], rooms: [], blocks: [], plates: [],
    };
  }
  set(x: number, y: number, t: Tile) {
    if (x >= 0 && y >= 0 && x < this.def.w && y < this.def.h) this.def.tiles[y * this.def.w + x] = t;
    return this;
  }
  get(x: number, y: number): Tile | undefined {
    if (x < 0 || y < 0 || x >= this.def.w || y >= this.def.h) return undefined;
    return this.def.tiles[y * this.def.w + x];
  }
  rect(x: number, y: number, w: number, h: number, t: Tile) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, t);
    return this;
  }
  border(t: Tile, thick: number) {
    const { w, h } = this.def;
    this.rect(0, 0, w, thick, t).rect(0, h - thick, w, thick, t).rect(0, 0, thick, h, t).rect(w - thick, 0, thick, h, t);
    return this;
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, t: Tile) {
    for (let j = Math.floor(cy - ry); j <= Math.ceil(cy + ry); j++)
      for (let i = Math.floor(cx - rx); i <= Math.ceil(cx + rx); i++)
        if (((i - cx) / rx) ** 2 + ((j - cy) / ry) ** 2 <= 1) this.set(i, j, t);
    return this;
  }
  /** Sprinkles `t` over plain ground in an area, keeping `gap` tiles clear of anything else. */
  scatter(t: Tile, n: number, area: { x: number; y: number; w: number; h: number }, seed: number, on: Tile = 'grass', gap = 1) {
    const r = rng(seed);
    for (let k = 0, tries = 0; k < n && tries < n * 40; tries++) {
      const x = area.x + Math.floor(r() * area.w);
      const y = area.y + Math.floor(r() * area.h);
      let clear = true;
      for (let j = -gap; j <= gap && clear; j++) for (let i = -gap; i <= gap && clear; i++) {
        const near = this.get(x + i, y + j);
        if (near !== on && near !== t && near !== 'flowers') clear = false;
      }
      if (!clear || this.get(x, y) !== on || this.occupied(x, y)) continue;
      this.set(x, y, t);
      k++;
    }
    return this;
  }
  /** Whether a prop, person or thing stands on a tile, so scattering leaves it alone. */
  occupied(x: number, y: number) {
    const d = this.def;
    const at = (p: { x: number; y: number }) => Math.abs(p.x - x) <= 1 && Math.abs(p.y - y) <= 1;
    return (
      d.props.some((p) => x >= p.x - 1 && x <= p.x + p.w && y >= p.y - 1 && y <= p.y + p.h) ||
      [...d.npcs, ...d.chests, ...d.signs, ...d.posts, ...d.stones, ...d.finds, ...d.enemies].some(at)
    );
  }
  prop(kind: PropKind, x: number, y: number, w = 1, h = 1, facing?: Facing, note?: number) {
    this.def.props.push({ kind, x, y, w, h, facing, note });
    return this;
  }
  /** A walled room of floor, listed so shut doors and foes know where it is. */
  room(id: string, x: number, y: number, w: number, h: number) {
    this.rect(x, y, w, h, 'floor');
    this.def.rooms.push({ id, x, y, w, h });
    return this;
  }
}

function village(): MapDef {
  const b = new Builder('village', t('village'), 'village', 40, 26, 0.74, 'grass');
  const d = b.def;
  b.border('tree', 2);
  // The main street runs north to the gate, the cross street east to west.
  b.rect(19, 0, 2, 24, 'path').rect(6, 11, 28, 2, 'path').rect(25, 18, 2, 3, 'path');
  // Thorns block the north gate until they are cut, with trees either side so they can't be walked round.
  b.rect(19, 3, 2, 1, 'thorns').rect(17, 2, 2, 2, 'tree').rect(21, 2, 2, 2, 'tree');
  b.ellipse(7, 20, 3.6, 2.4, 'water');
  b.prop('house', 6, 6, 5, 4).prop('house', 23, 14, 5, 4).prop('shed', 30, 6, 3, 3).prop('well', 15, 15, 2, 2);
  b.prop('lamp', 18, 7).prop('lamp', 21, 13).prop('lamp', 17, 19).prop('lamp', 28, 10).prop('lamp', 11, 13);
  b.prop('bench', 33, 19, 2, 1).prop('rock', 36, 10);
  d.npcs.push(
    { id: 'elder', name: t('elderName'), x: 17, y: 13 },
    { id: 'pip', name: t('pipName'), x: 13, y: 16 },
    { id: 'baker', name: t('bakerName'), x: 29, y: 13 },
    { id: 'cat', name: t('catName'), x: 34, y: 20 },
  );
  d.chests.push({ id: 'blade', x: 31, y: 10, item: 'sword' });
  d.signs.push({ x: 21, y: 5, text: t('signGate') });
  d.exits.push({ x: 19, y: 0, w: 2, h: 1, to: 'woods', tx: 24, ty: 28, facing: 'up' });
  // A ring of bushes by the pond hides a moonstone.
  b.rect(12, 20, 3, 3, 'bush').set(13, 21, 'grass');
  d.stones.push({ id: 'v-pond', x: 13, y: 21 }, { id: 'v-cat', x: -1, y: -1 });
  // A nook in the trees behind the shed, closed by a boulder.
  b.rect(33, 2, 5, 4, 'tree').rect(34, 3, 3, 2, 'grass').set(35, 5, 'boulder');
  d.stones.push({ id: 'v-nook', x: 35, y: 3, chapter: 2 });
  b.scatter('tree', 7, { x: 2, y: 2, w: 36, h: 22 }, 11, 'grass', 2);
  b.scatter('bush', 8, { x: 2, y: 2, w: 36, h: 22 }, 12);
  b.scatter('flowers', 30, { x: 2, y: 2, w: 36, h: 22 }, 13, 'grass', 0);
  return d;
}

function woods(): MapDef {
  const b = new Builder('woods', t('woods'), 'woods', 50, 32, 0.8, 'grass');
  const d = b.def;
  b.border('tree', 2);
  // The path from the village gate up to the shrine, with a branch west to the river.
  b.rect(24, 16, 2, 16, 'path').rect(24, 16, 20, 2, 'path').rect(42, 4, 2, 13, 'path').rect(13, 15, 11, 2, 'path');
  // Thorns across the shrine path, hemmed in by trees, with a line of trees from the river to the
  // east border either side, so the north of the woods is reached only by cutting through.
  b.rect(42, 10, 2, 1, 'thorns').rect(41, 9, 1, 3, 'tree').rect(44, 9, 1, 3, 'tree');
  b.rect(12, 10, 30, 1, 'tree').rect(44, 10, 4, 1, 'tree');
  // The river, crossed only on the hookvine, and the way to the fen beyond it.
  b.rect(8, 2, 4, 28, 'water').rect(0, 15, 8, 2, 'path');
  d.posts.push({ x: 7, y: 15 }, { x: 12, y: 15 });
  b.prop('arch', 41, 1, 4, 3);
  d.exits.push(
    { x: 24, y: 31, w: 2, h: 1, to: 'village', tx: 19, ty: 2, facing: 'down' },
    { x: 42, y: 4, w: 2, h: 1, to: 'shrine', tx: 21, ty: 48, facing: 'up' },
    { x: 0, y: 15, w: 1, h: 2, to: 'fen', tx: 33, ty: 12, facing: 'left' },
  );
  d.signs.push({ x: 26, y: 27, text: t('signWoods') });
  // A hidden grove: a ring of trees, entered through two that are not really there.
  b.rect(30, 21, 9, 7, 'tree').rect(32, 23, 5, 3, 'grass').set(30, 24, 'faketree').set(31, 24, 'faketree');
  d.stones.push({ id: 'w-grove', x: 35, y: 24 });
  b.rect(16, 21, 3, 3, 'bush').set(17, 22, 'grass');
  // Past the river, a hollow in the trees with a boulder for a door.
  b.rect(2, 4, 5, 5, 'tree').rect(3, 5, 3, 3, 'grass').set(4, 8, 'boulder');
  d.stones.push({ id: 'w-hollow', x: 4, y: 6, chapter: 2 });
  d.stones.push({ id: 'w-bush', x: 17, y: 22 });
  d.enemies.push(
    { kind: 'slug', x: 26, y: 23 }, { kind: 'slug', x: 30, y: 18 }, { kind: 'slug', x: 37, y: 15 }, { kind: 'slug', x: 19, y: 14 },
    { kind: 'moth', x: 33, y: 9 }, { kind: 'moth', x: 28, y: 11 }, { kind: 'moth', x: 40, y: 24 },
  );
  b.prop('lamp', 26, 29).prop('lamp', 41, 6).prop('shroom', 15, 18).prop('shroom', 4, 10).prop('shroom', 34, 6).prop('rock', 22, 9);
  b.scatter('tree', 70, { x: 2, y: 2, w: 46, h: 28 }, 21, 'grass', 1);
  b.scatter('bush', 16, { x: 12, y: 2, w: 36, h: 28 }, 22);
  b.scatter('flowers', 24, { x: 2, y: 2, w: 46, h: 28 }, 23, 'grass', 0);
  // Added after the scatter, so the trees and bushes it sows stay where they were.
  d.enemies.push({ kind: 'beetle', x: 28, y: 25 }, { kind: 'beetle', x: 38, y: 13 }, { kind: 'lantern', x: 36, y: 6 });
  // Chapter three: the pass north to the Hollow Peaks, cut after the scatter too. Fallen rock
  // closes it until the story gets there (`GameScene.enterMap`).
  b.rect(24, 0, 2, 9, 'path').rect(26, 7, 16, 2, 'path').set(27, 4, 'grass');
  d.exits.push({ x: 24, y: 0, w: 2, h: 1, to: 'peaks', tx: 19, ty: 27, facing: 'up', quest: 'peaks' });
  d.signs.push({ x: 27, y: 4, text: t('signPass') });
  d.finds.push({ req: 'boat', x: 5, y: 24 }, { req: 'glowcaps', x: 35, y: 5 }, { req: 'glowcaps', x: 5, y: 11 });
  return d;
}

function fen(): MapDef {
  const b = new Builder('fen', t('fen'), 'fen', 36, 24, 0.82, 'grass');
  const d = b.def;
  b.border('tree', 2);
  b.rect(34, 12, 2, 2, 'path').rect(20, 12, 14, 2, 'path').rect(10, 8, 2, 6, 'path').rect(10, 12, 10, 2, 'path');
  b.ellipse(25, 6, 4, 2.2, 'water').ellipse(6, 18, 3.5, 2.5, 'water').ellipse(26, 19, 3, 2, 'water').ellipse(15, 19, 2, 1.4, 'water');
  // The top of the drowned bell tower, its door choked by boulders.
  b.rect(30, 4, 2, 8, 'path').set(30, 5, 'boulder').set(31, 5, 'boulder');
  b.rect(29, 4, 1, 2, 'tree').rect(32, 4, 1, 2, 'tree');
  b.prop('tower', 29, 1, 4, 3);
  d.exits.push({ x: 30, y: 4, w: 2, h: 1, to: 'belfry', tx: 17, ty: 37, facing: 'up', quest: 'belfry' });
  b.scatter('reeds', 40, { x: 2, y: 2, w: 32, h: 20 }, 31, 'grass', 0);
  b.prop('hut', 6, 4, 4, 3);
  // Three statues point at one spot; a swing there digs up what they guard.
  b.prop('statue', 4, 12, 1, 1, 'right').prop('statue', 17, 3, 1, 1, 'down').prop('statue', 17, 20, 1, 1, 'up');
  d.stones.push({ id: 'f-statues', x: 17, y: 12, hidden: 'buried' }, { id: 'f-wisp', x: -1, y: -1 });
  d.npcs.push({ id: 'hermit', name: t('hermitName'), x: 11, y: 7 });
  d.exits.push({ x: 35, y: 12, w: 1, h: 2, to: 'woods', tx: 1, ty: 15, facing: 'right' });
  d.wisp = [{ x: 28, y: 9 }, { x: 31, y: 17 }, { x: 22, y: 16 }, { x: 13, y: 16 }];
  d.enemies.push({ kind: 'moth', x: 22, y: 9 }, { kind: 'moth', x: 8, y: 15 }, { kind: 'slug', x: 28, y: 15 });
  b.prop('shroom', 14, 5).prop('shroom', 33, 4).prop('shroom', 21, 21).prop('shroom', 3, 7);
  b.scatter('tree', 18, { x: 2, y: 2, w: 32, h: 20 }, 32, 'grass', 1);
  b.scatter('flowers', 14, { x: 2, y: 2, w: 32, h: 20 }, 33, 'grass', 0);
  d.enemies.push({ kind: 'beetle', x: 21, y: 16 }, { kind: 'lantern', x: 16, y: 10 });
  d.finds.push({ req: 'lilies', x: 20, y: 7 }, { req: 'lilies', x: 30, y: 19 }, { req: 'lilies', x: 3, y: 15 }, { req: 'glowcaps', x: 14, y: 4 });
  return d;
}

function shrine(): MapDef {
  const b = new Builder('shrine', t('shrine'), 'shrine', 44, 52, 0.92, 'wall');
  const d = b.def;
  const room = (id: string, x: number, y: number, w: number, h: number) => b.room(id, x, y, w, h);
  room('boss', 8, 2, 28, 11);
  room('pits', 15, 16, 14, 10);
  room('vine', 31, 16, 10, 10);
  room('alcove', 3, 18, 6, 6);
  room('block', 31, 29, 10, 10);
  room('hall', 15, 29, 14, 10);
  room('entry', 17, 42, 10, 8);
  room('key', 3, 41, 10, 9);
  // Corridors between the rooms.
  b.rect(21, 50, 2, 2, 'floor').rect(13, 45, 4, 2, 'floor').rect(21, 39, 2, 3, 'floor').rect(29, 33, 2, 2, 'floor');
  b.rect(35, 26, 2, 3, 'floor').rect(29, 20, 2, 2, 'floor').rect(16, 13, 2, 3, 'floor').rect(9, 20, 6, 2, 'floor');
  // The pit room: a chasm between two ledges, and a narrower one to the hidden alcove.
  b.rect(20, 16, 5, 10, 'pit').rect(9, 20, 5, 2, 'pit');
  d.posts.push({ x: 19, y: 20 }, { x: 25, y: 20 }, { x: 8, y: 20 }, { x: 14, y: 20 });
  d.doors.push(
    { id: 'key-room', x: 13, y: 45, w: 1, h: 2, kind: 'shut', room: 'key' },
    { id: 'hall-east', x: 30, y: 33, w: 1, h: 2, kind: 'key' },
    { id: 'bars', x: 35, y: 27, w: 2, h: 1, kind: 'bars', flag: 'plate' },
    { id: 'boss-door', x: 16, y: 14, w: 2, h: 1, kind: 'shut', room: 'boss' },
  );
  d.blocks.push({ x: 36, y: 35 });
  d.plates.push({ x: 36, y: 31, flag: 'plate' });
  d.chests.push({ id: 'shrine-key', x: 7, y: 43, item: 'key' }, { id: 'hookvine', x: 36, y: 18, item: 'hookvine' }, { id: 'oil', x: 4, y: 20, item: 'oil' });
  d.stones.push({ id: 's-alcove', x: 6, y: 22 }, { id: 's-boss', x: 21, y: 6 });
  // Behind the entry hall's east wall, a niche the builders walled up.
  b.rect(28, 43, 2, 3, 'floor').set(27, 44, 'crack');
  d.stones.push({ id: 's-niche', x: 29, y: 44, chapter: 2 });
  d.signs.push({ x: 24, y: 46, text: t('signShrine') });
  d.hourglass = { x: 18, y: 47 };
  d.enemies.push(
    { kind: 'thornling', x: 5, y: 47, room: 'key' }, { kind: 'slug', x: 9, y: 45, room: 'key' }, { kind: 'slug', x: 6, y: 44, room: 'key' },
    { kind: 'thornling', x: 26, y: 31, room: 'hall' }, { kind: 'moth', x: 18, y: 35, room: 'hall' },
    { kind: 'thornling', x: 39, y: 37, room: 'block' }, { kind: 'moth', x: 38, y: 21, room: 'vine' },
    // Added later: new kinds go at the end, so the beaten flags (`foe-<i>`) of the first ones keep their index.
    { kind: 'beetle', x: 22, y: 36, room: 'hall' }, { kind: 'lantern', x: 17, y: 18, room: 'pits' },
  );
  b.prop('brazier', 18, 43).prop('brazier', 25, 43).prop('brazier', 16, 30).prop('brazier', 27, 30).prop('brazier', 32, 30);
  b.prop('brazier', 39, 17).prop('brazier', 27, 17).prop('brazier', 10, 3).prop('brazier', 33, 3).prop('brazier', 4, 42);
  b.prop('brazier', 13, 10).prop('brazier', 31, 10);
  // The Thornmother's arena: a ring of thorns no blade can cut, with the queen in the middle.
  d.boss = { x: 22, y: 6.5 };
  for (let j = 2; j <= 11; j++) for (let i = 16; i <= 27; i++) {
    const r = Math.hypot(i + 0.5 - 22, (j + 0.5 - 6.5) * 1.15);
    if (r >= 2.6 && r < 3.6) b.set(i, j, 'ring');
  }
  d.exits.push(
    { x: 21, y: 51, w: 2, h: 1, to: 'woods', tx: 42, ty: 5, facing: 'down' },
    { x: 21, y: 2, w: 2, h: 1, to: 'woods', tx: 42, ty: 5, facing: 'down', flag: 'boss' },
  );
  return d;
}

function belfry(): MapDef {
  const b = new Builder('belfry', t('belfry'), 'belfry', 38, 40, 0.9, 'wall');
  const d = b.def;
  b.room('entry', 13, 30, 10, 8).room('hub', 13, 18, 10, 9).room('bells', 2, 18, 9, 9).room('flood', 25, 18, 9, 9).room('boss', 6, 3, 24, 11);
  // Corridors: down to the fen, entry to hub, hub west to the bells, east to the flood and north to the tower.
  b.rect(17, 38, 2, 2, 'floor').rect(17, 27, 2, 3, 'floor').rect(11, 21, 2, 2, 'floor').rect(23, 21, 2, 2, 'floor').rect(17, 14, 2, 4, 'floor');
  // The way to the bells is walled up; the wall is cracked.
  b.set(11, 21, 'crack').set(11, 22, 'crack');
  // The flooded room: a channel between two ledges, crossed on the hookvine.
  b.rect(26, 18, 5, 9, 'water');
  d.posts.push({ x: 25, y: 22 }, { x: 31, y: 22 });
  // A hollow behind the flooded room's far wall.
  b.rect(35, 23, 2, 2, 'floor').set(34, 24, 'crack');
  d.stones.push({ id: 'b-hollow', x: 36, y: 24, chapter: 2 }, { id: 'b-bell', x: 18, y: 6, chapter: 2 });
  // Three bells to ring in the right order; the bars to the flooded room lift when they are.
  b.prop('bell', 4, 20, 1, 1, undefined, 0).prop('bell', 6, 22, 1, 1, undefined, 2).prop('bell', 8, 20, 1, 1, undefined, 1);
  d.doors.push(
    { id: 'belfry-bars', x: 23, y: 21, w: 1, h: 2, kind: 'bars', flag: 'bells' },
    { id: 'belfry-north', x: 17, y: 15, w: 2, h: 1, kind: 'key' },
    { id: 'boss-door', x: 17, y: 14, w: 2, h: 1, kind: 'shut', room: 'boss' },
    { id: 'bells-door', x: 12, y: 21, w: 1, h: 2, kind: 'shut', room: 'bells' },
  );
  d.hourglass = { x: 14, y: 35 };
  d.chests.push({ id: 'belfry-key', x: 32, y: 22, item: 'key' }, { id: 'belfry-heart', x: 3, y: 25, item: 'heart' });
  d.signs.push(
    { x: 21, y: 32, text: t('signBells') },
    { x: 14, y: 19, text: t('signWages') },
  );
  d.enemies.push(
    { kind: 'frog', x: 15, y: 33, room: 'entry' }, { kind: 'frog', x: 20, y: 35, room: 'entry' },
    { kind: 'moth', x: 18, y: 22, room: 'hub' }, { kind: 'thornling', x: 21, y: 19, room: 'hub' },
    { kind: 'frog', x: 4, y: 24, room: 'bells' }, { kind: 'frog', x: 8, y: 25, room: 'bells' }, { kind: 'slug', x: 9, y: 19, room: 'bells' },
    { kind: 'frog', x: 32, y: 19, room: 'flood' }, { kind: 'moth', x: 28, y: 24, room: 'flood' },
    { kind: 'beetle', x: 16, y: 24, room: 'hub' }, { kind: 'lantern', x: 32, y: 25, room: 'flood' },
  );
  b.prop('candle', 14, 31).prop('candle', 21, 31).prop('candle', 14, 19).prop('candle', 21, 25).prop('candle', 3, 19).prop('candle', 9, 19);
  b.prop('candle', 25, 19).prop('candle', 33, 26).prop('candle', 7, 4).prop('candle', 28, 4).prop('candle', 7, 12).prop('candle', 28, 12);
  // The Bellwraith's hall, where the great bell still swings.
  b.prop('brazier', 9, 8).prop('brazier', 26, 8);
  d.boss = { x: 18, y: 8 };
  d.exits.push({ x: 17, y: 39, w: 2, h: 1, to: 'fen', tx: 30, ty: 6, facing: 'down' });
  d.finds.push({ req: 'specs', x: 33, y: 19 });
  return d;
}

/** A hidden bridge over a chasm, from a tile on, one step (u, d, l or r) at a time. */
function bridge(b: Builder, x: number, y: number, steps: string) {
  b.set(x, y, 'veil');
  for (const s of steps) {
    if (s === 'u') y--;
    else if (s === 'd') y++;
    else if (s === 'l') x--;
    else if (s === 'r') x++;
    b.set(x, y, 'veil');
  }
}

function peaks(): MapDef {
  const b = new Builder('peaks', t('peaks'), 'peaks', 40, 30, 0.84, 'grass');
  const d = b.def;
  b.border('tree', 2);
  // The path up from the woods, across to Tam's hut and east to the watchers' lookout.
  b.rect(19, 13, 2, 17, 'path').rect(8, 20, 27, 2, 'path').rect(32, 19, 3, 1, 'path');
  b.prop('hut', 5, 15, 4, 3).prop('lamp', 12, 18).prop('lamp', 22, 22);
  d.npcs.push({ id: 'herder', name: t('herderName'), x: 11, y: 18 });
  // The lookout: old walls round a flagstone floor, its door sealed by a boulder.
  b.rect(31, 14, 6, 5, 'wall').rect(32, 15, 4, 3, 'floor').set(34, 18, 'boulder');
  d.chests.push({ id: 'moonlantern', x: 33, y: 15, item: 'moonlantern' });
  d.signs.push({ x: 36, y: 20, text: t('signLookout') });
  // The chasm across the peaks, and the bridge only the Moonlantern shows, with branches that lead
  // nowhere, and one that is worth it.
  b.rect(2, 9, 36, 4, 'pit');
  bridge(b, 19, 12, 'ulllulu');
  bridge(b, 19, 11, 'rrrrur');
  bridge(b, 16, 10, 'lll');
  d.stones.push({ id: 'p-veil', x: 24, y: 10, chapter: 3 });
  // North of the chasm: the mouth of the Glass Caverns under the tallest peak.
  b.rect(16, 2, 6, 3, 'path').rect(15, 5, 6, 4, 'path');
  b.prop('cave', 17, 1, 4, 3).prop('crystal', 16, 4).prop('crystal', 21, 4);
  d.exits.push(
    { x: 18, y: 4, w: 2, h: 1, to: 'caverns', tx: 19, ty: 41, facing: 'up' },
    { x: 19, y: 29, w: 2, h: 1, to: 'woods', tx: 24, ty: 1, facing: 'down' },
  );
  // A ring of pines past the chasm, one of them not really there.
  b.rect(3, 3, 5, 5, 'tree').rect(4, 4, 3, 3, 'grass').set(5, 7, 'faketree');
  d.stones.push({ id: 'p-nook', x: 5, y: 5, chapter: 3 });
  b.prop('rock', 28, 25).prop('rock', 9, 25).prop('shroom', 26, 16).prop('shroom', 14, 5).prop('shroom', 32, 4);
  d.enemies.push(
    { kind: 'slug', x: 27, y: 17 }, { kind: 'moth', x: 25, y: 24 }, { kind: 'beetle', x: 14, y: 24 },
    { kind: 'shade', x: 26, y: 6 }, { kind: 'shade', x: 10, y: 5 }, { kind: 'lantern', x: 31, y: 6 },
  );
  b.scatter('tree', 36, { x: 2, y: 13, w: 36, h: 15 }, 41, 'grass', 1);
  b.scatter('tree', 10, { x: 8, y: 2, w: 30, h: 6 }, 42, 'grass', 1);
  b.scatter('flowers', 10, { x: 2, y: 13, w: 36, h: 15 }, 43, 'grass', 0);
  d.finds.push({ req: 'goatbells', x: 4, y: 26 }, { req: 'goatbells', x: 36, y: 24 }, { req: 'goatbells', x: 29, y: 6 });
  return d;
}

function caverns(): MapDef {
  const b = new Builder('caverns', t('caverns'), 'caverns', 40, 44, 0.92, 'wall');
  const d = b.def;
  b.room('entry', 15, 34, 10, 8).room('hub', 14, 22, 12, 9).room('chasm', 2, 20, 10, 12).room('ledges', 28, 20, 10, 12).room('boss', 6, 3, 28, 13);
  // Corridors: down to the peaks, entry to hub, hub west to the chasm, east to the ledges, north to the hall.
  b.rect(19, 42, 2, 2, 'floor').rect(19, 31, 2, 3, 'floor').rect(12, 25, 2, 2, 'floor').rect(26, 25, 2, 2, 'floor').rect(19, 16, 2, 6, 'floor');
  // The way east is walled with cracked ice.
  b.set(26, 25, 'crack').set(26, 26, 'crack');
  // The chasm room: a dark gap with a hidden bridge to the key, and a branch to something else.
  b.rect(4, 20, 6, 12, 'pit');
  bridge(b, 9, 26, 'lulluluul');
  bridge(b, 8, 26, 'ddlld');
  d.stones.push({ id: 'c-veil', x: 6, y: 29, chapter: 3 });
  d.chests.push({ id: 'caverns-key', x: 2, y: 21, item: 'key' });
  // The ledges: a gap crossed on the hookvine, a heart on the far side.
  b.rect(31, 20, 4, 12, 'pit');
  d.posts.push({ x: 30, y: 26 }, { x: 35, y: 26 });
  d.chests.push({ id: 'caverns-heart', x: 36, y: 22, item: 'heart' });
  d.doors.push(
    { id: 'caverns-north', x: 19, y: 18, w: 2, h: 1, kind: 'key' },
    { id: 'boss-door', x: 19, y: 16, w: 2, h: 1, kind: 'shut', room: 'boss' },
    { id: 'chasm-door', x: 13, y: 25, w: 1, h: 2, kind: 'shut', room: 'chasm' },
  );
  d.hourglass = { x: 16, y: 39 };
  d.signs.push({ x: 23, y: 35, text: t('signIce') });
  d.enemies.push(
    { kind: 'shade', x: 17, y: 36, room: 'entry' }, { kind: 'frog', x: 22, y: 38, room: 'entry' },
    { kind: 'beetle', x: 16, y: 24, room: 'hub' }, { kind: 'shade', x: 23, y: 27, room: 'hub' }, { kind: 'frog', x: 18, y: 28, room: 'hub' },
    { kind: 'shade', x: 3, y: 30, room: 'chasm' }, { kind: 'shade', x: 10, y: 22, room: 'chasm' },
    { kind: 'frog', x: 29, y: 22, room: 'ledges' }, { kind: 'lantern', x: 36, y: 29, room: 'ledges' },
  );
  b.prop('crystal', 15, 35).prop('crystal', 24, 35).prop('crystal', 14, 22).prop('crystal', 25, 30).prop('crystal', 2, 31).prop('crystal', 11, 20);
  b.prop('crystal', 28, 31).prop('crystal', 37, 20).prop('crystal', 7, 4).prop('crystal', 32, 4).prop('crystal', 7, 14).prop('crystal', 32, 14);
  // The Gloamwing's hall, the coldest and darkest place in the kingdom.
  d.boss = { x: 20, y: 10 };
  d.stones.push({ id: 'c-boss', x: 20, y: 6, chapter: 3 });
  d.exits.push({ x: 19, y: 43, w: 2, h: 1, to: 'peaks', tx: 18, ty: 5, facing: 'down' });
  return d;
}

const BUILT: Record<MapId, () => MapDef> = { village, woods, fen, shrine, belfry, peaks, caverns };
/** Every map, in the order the moonstone page lists them. */
export const MAP_IDS = Object.keys(BUILT) as MapId[];

/** Whether `id` names a map (a save from another version may not). */
export function isMapId(id: unknown): id is MapId {
  return typeof id === 'string' && Object.hasOwn(BUILT, id);
}

/** A fresh copy of a map's layout. */
export function buildMap(id: MapId): MapDef {
  return BUILT[id]();
}

export function tileAt(map: MapDef, x: number, y: number): Tile {
  if (x < 0 || y < 0 || x >= map.w || y >= map.h) return 'wall';
  return map.tiles[y * map.w + x];
}

export function setTile(map: MapDef, x: number, y: number, t: Tile) {
  if (x >= 0 && y >= 0 && x < map.w && y < map.h) map.tiles[y * map.w + x] = t;
}

/** What lies under a boulder once it is gone: the path it sat on, or grass. */
export function underBoulder(map: MapDef, x: number, y: number): Tile {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => tileAt(map, x + dx, y + dy) === 'path') ? 'path' : 'grass';
}

/** The middle of a tile, in pixels. */
export function centre(t: { x: number; y: number }) {
  return { x: (t.x + 0.5) * TILE, y: (t.y + 0.5) * TILE };
}
