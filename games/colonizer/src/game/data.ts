// Balance numbers and rosters for Colonizer. Times are in milliseconds, speeds in tiles per second,
// ranges and sight in tiles. Only this file and the other files in src/game/ know the numbers. Names
// and texts are keys of `i18n/en.ts`, shown with `t`.
import type { TextKey } from '../i18n';

export const TILE = 32;
export const MAP_SIZE = 128;
/** Room above a building's footprint for roofs, domes and flags, in px: drawn there, and clickable. */
export const BUILDING_TOP = 22;

export const RESOURCES = ['wood', 'food', 'ore'] as const;
export type Resource = (typeof RESOURCES)[number];
export type Cost = Partial<Record<Resource, number>>;

export const FACTION_IDS = ['ember', 'tide', 'thorn', 'steppe'] as const;
export type FactionId = (typeof FACTION_IDS)[number];

export interface Faction {
  id: FactionId;
  name: TextKey;
  blurb: TextKey;
  cloth: number;
  clothDark: number;
  trim: number;
  horse: number;
}

export const FACTIONS: Record<FactionId, Faction> = {
  ember: {
    id: 'ember',
    name: 'emberName',
    blurb: 'emberBlurb',
    cloth: 0xb8432f,
    clothDark: 0x7a2a1d,
    trim: 0xf0a040,
    horse: 0x8b5a2b,
  },
  tide: {
    id: 'tide',
    name: 'tideName',
    blurb: 'tideBlurb',
    cloth: 0x2f6fb0,
    clothDark: 0x1d4672,
    trim: 0x9fd3f0,
    horse: 0xc9d6e3,
  },
  thorn: {
    id: 'thorn',
    name: 'thornName',
    blurb: 'thornBlurb',
    cloth: 0x3f8a3a,
    clothDark: 0x25552a,
    trim: 0xc7e07a,
    horse: 0x4a3526,
  },
  // The nomads: they pack up their camps and move them to fresh ground.
  steppe: {
    id: 'steppe',
    name: 'steppeName',
    blurb: 'steppeBlurb',
    cloth: 0x7e4f76,
    clothDark: 0x50304b,
    trim: 0xc99a3a,
    horse: 0xb8955e,
  },
};

/**
 * Villagers, trade carts, the Steppe Horde's packed camps (wagons) and transports are civil; melee,
 * ranged, cavalry, siege (the ram), the faction's champion and the warship are soldiers. `isSoldier`
 * and `isCivil` are the two sides of that line. Transports and warships sail (`isNaval`).
 */
export type Role = 'villager' | 'melee' | 'ranged' | 'cavalry' | 'cart' | 'siege' | 'champion' | 'wagon' | 'transport' | 'warship';
export const isCivil = (role: Role) => role === 'villager' || role === 'cart' || role === 'wagon' || role === 'transport';
export const isSoldier = (role: Role) => !isCivil(role);
/** Ships: they move on water and shallows only, and are built at a Harbour. */
export const isNaval = (role: Role) => role === 'transport' || role === 'warship';
/** Soldiers that earn veteran ranks by kills: every soldier but the ram. */
export const earnsRanks = (role: Role) => isSoldier(role) && role !== 'siege';

export type BuildingId =
  | 'town'
  | 'house'
  | 'farm'
  | 'lumber'
  | 'mine'
  | 'barracks'
  | 'range'
  | 'stable'
  | 'academy'
  | 'watchtower'
  | 'forge'
  | 'dock'
  | 'grove'
  | 'wall'
  | 'gate'
  | 'market'
  | 'monument'
  | 'wonder'
  | 'harbour'
  | 'yurt';

export interface UnitDef {
  id: string;
  /** `neutral` units (villagers) belong to every faction; `wild` ones guard the neutral camps. */
  faction: FactionId | 'neutral' | 'wild';
  role: Role;
  name: TextKey;
  cost: Cost;
  time: number;
  hp: number;
  dmg: number;
  range: number;
  speed: number;
  sight: number;
  cooldown: number;
  trainer: BuildingId;
  /** Extra damage against cavalry, for units that counter riders. */
  vsCavalry?: number;
  /** Damage against buildings is multiplied by this (the Torchbearer). */
  vsBuildings?: number;
  /** The age a player needs before training it. */
  age?: 2 | 3;
  /** A faction's second unique unit, unlocked by faction mastery (MASTERY_WINS wins with it). */
  elite?: boolean;
  /** At most this many alive or in training per player (the champion). */
  limit?: number;
  /** A champion's gift: a damage aura for nearby soldiers, far sight, healing nearby units, or a quicker stride for them. */
  gift?: 'aura' | 'sight' | 'heal' | 'stride';
}

export const UNITS: Record<string, UnitDef> = {
  villager: {
    id: 'villager', faction: 'neutral', role: 'villager', name: 'villager',
    cost: { food: 50 }, time: 8000, hp: 25, dmg: 2, range: 1, speed: 2.2, sight: 5, cooldown: 1200, trainer: 'town',
  },
  'ember-militia': {
    id: 'ember-militia', faction: 'ember', role: 'melee', name: 'militia',
    cost: { food: 50, wood: 30 }, time: 9000, hp: 60, dmg: 6, range: 1, speed: 2, sight: 5, cooldown: 1000, trainer: 'barracks',
  },
  'ember-archer': {
    id: 'ember-archer', faction: 'ember', role: 'ranged', name: 'archer',
    cost: { food: 30, wood: 50 }, time: 10000, hp: 35, dmg: 6, range: 4.5, speed: 2.1, sight: 6, cooldown: 1200, trainer: 'range',
  },
  'ember-knight': {
    id: 'ember-knight', faction: 'ember', role: 'cavalry', name: 'knight',
    cost: { food: 70, ore: 40 }, time: 14000, hp: 90, dmg: 8, range: 1, speed: 3.2, sight: 6, cooldown: 1100, trainer: 'stable',
  },
  'tide-spearman': {
    id: 'tide-spearman', faction: 'tide', role: 'melee', name: 'spearman',
    cost: { food: 50, wood: 35 }, time: 9000, hp: 55, dmg: 6, range: 1, speed: 2, sight: 5, cooldown: 1000, trainer: 'barracks',
    vsCavalry: 2,
  },
  'tide-slinger': {
    id: 'tide-slinger', faction: 'tide', role: 'ranged', name: 'slinger',
    cost: { food: 30, wood: 50 }, time: 10000, hp: 30, dmg: 6, range: 5, speed: 2.1, sight: 6, cooldown: 1100, trainer: 'range',
  },
  'tide-rider': {
    id: 'tide-rider', faction: 'tide', role: 'cavalry', name: 'rider',
    cost: { food: 60, ore: 30 }, time: 13000, hp: 70, dmg: 7, range: 1, speed: 3.6, sight: 6, cooldown: 1100, trainer: 'stable',
  },
  'thorn-brute': {
    id: 'thorn-brute', faction: 'thorn', role: 'melee', name: 'brute',
    cost: { food: 60, wood: 40 }, time: 11000, hp: 85, dmg: 5, range: 1, speed: 1.7, sight: 5, cooldown: 1100, trainer: 'barracks',
  },
  'thorn-hunter': {
    id: 'thorn-hunter', faction: 'thorn', role: 'ranged', name: 'hunter',
    cost: { food: 30, wood: 60 }, time: 10000, hp: 30, dmg: 7, range: 6, speed: 2.2, sight: 7, cooldown: 1300, trainer: 'range',
  },
  'thorn-stalker': {
    id: 'thorn-stalker', faction: 'thorn', role: 'cavalry', name: 'stalker',
    cost: { food: 60, ore: 30 }, time: 13000, hp: 60, dmg: 8, range: 1, speed: 3.4, sight: 6, cooldown: 1000, trainer: 'stable',
  },
  // Trained at the Market (Age II): drives to a trading post in the middle of the map and back for ore.
  cart: {
    id: 'cart', faction: 'neutral', role: 'cart', name: 'cart',
    cost: { wood: 80, food: 40 }, time: 12000, hp: 45, dmg: 0, range: 1, speed: 1.9, sight: 4, cooldown: 1000, trainer: 'market',
  },
  // The siege ram (Age II, Barracks): slow, smashes buildings, walls and gates, and can't hurt a unit.
  ram: {
    id: 'ram', faction: 'neutral', role: 'siege', name: 'ram',
    cost: { wood: 160, ore: 60 }, time: 22000, hp: 220, dmg: 32, range: 1, speed: 1.05, sight: 4, cooldown: 2200, trainer: 'barracks', age: 2,
  },
  // Each faction's champion (Age III, Town Center, one at a time).
  'ember-warlord': {
    id: 'ember-warlord', faction: 'ember', role: 'champion', name: 'warlord',
    cost: { food: 200, ore: 150 }, time: 30000, hp: 170, dmg: 11, range: 1, speed: 2.1, sight: 7, cooldown: 1100, trainer: 'town', age: 3, limit: 1, gift: 'aura',
  },
  'tide-seer': {
    id: 'tide-seer', faction: 'tide', role: 'champion', name: 'seer',
    cost: { food: 200, ore: 150 }, time: 30000, hp: 90, dmg: 6, range: 5, speed: 2.2, sight: 14, cooldown: 1200, trainer: 'town', age: 3, limit: 1, gift: 'sight',
  },
  'thorn-druid': {
    id: 'thorn-druid', faction: 'thorn', role: 'champion', name: 'druid',
    cost: { food: 200, ore: 150 }, time: 30000, hp: 130, dmg: 5, range: 1, speed: 2.1, sight: 7, cooldown: 1200, trainer: 'town', age: 3, limit: 1, gift: 'heal',
  },
  // Each faction's second unique unit (Age II), unlocked by MASTERY_WINS wins with the faction. Each
  // shares a role with a unit of its faction, so `unitFor` keeps finding the first; `eliteFor` finds it.
  'ember-torchbearer': {
    id: 'ember-torchbearer', faction: 'ember', role: 'melee', name: 'torchbearer',
    cost: { food: 60, wood: 40, ore: 20 }, time: 11000, hp: 65, dmg: 6, range: 1, speed: 2.1, sight: 5, cooldown: 1100, trainer: 'barracks', age: 2, elite: true,
    vsBuildings: 3,
  },
  'tide-harpooner': {
    id: 'tide-harpooner', faction: 'tide', role: 'ranged', name: 'harpooner',
    cost: { food: 50, wood: 60, ore: 20 }, time: 12000, hp: 45, dmg: 9, range: 6, speed: 2, sight: 7, cooldown: 1600, trainer: 'range', age: 2, elite: true,
    vsCavalry: 2,
  },
  'thorn-warden': {
    id: 'thorn-warden', faction: 'thorn', role: 'melee', name: 'briarWarden',
    cost: { food: 80, wood: 50, ore: 30 }, time: 14000, hp: 150, dmg: 7, range: 1, speed: 1.6, sight: 5, cooldown: 1300, trainer: 'barracks', age: 2, elite: true,
  },
  // The Steppe Horde: light, quick footmen and riders.
  'steppe-clansman': {
    id: 'steppe-clansman', faction: 'steppe', role: 'melee', name: 'clansman',
    cost: { food: 45, wood: 25 }, time: 8000, hp: 50, dmg: 6, range: 1, speed: 2.4, sight: 5, cooldown: 1000, trainer: 'barracks',
  },
  'steppe-bowman': {
    id: 'steppe-bowman', faction: 'steppe', role: 'ranged', name: 'bowman',
    cost: { food: 35, wood: 45 }, time: 9000, hp: 32, dmg: 5, range: 4.5, speed: 2.4, sight: 6, cooldown: 1100, trainer: 'range',
  },
  'steppe-outrider': {
    id: 'steppe-outrider', faction: 'steppe', role: 'cavalry', name: 'outrider',
    cost: { food: 60, ore: 25 }, time: 12000, hp: 65, dmg: 7, range: 1, speed: 3.8, sight: 7, cooldown: 1000, trainer: 'stable',
  },
  'steppe-chieftain': {
    id: 'steppe-chieftain', faction: 'steppe', role: 'champion', name: 'chieftain',
    cost: { food: 200, ore: 150 }, time: 30000, hp: 150, dmg: 9, range: 1, speed: 2.4, sight: 8, cooldown: 1100, trainer: 'town', age: 3, limit: 1, gift: 'stride',
  },
  // The Steppe Horde's mastery unit: a rider who shoots from the saddle.
  'steppe-horsebow': {
    id: 'steppe-horsebow', faction: 'steppe', role: 'cavalry', name: 'horseArcher',
    cost: { food: 70, wood: 40, ore: 20 }, time: 13000, hp: 60, dmg: 6, range: 4.5, speed: 3.4, sight: 7, cooldown: 1300, trainer: 'stable', age: 2, elite: true,
  },
  // A Steppe Horde camp packed onto a wagon (`packUp`); it pitches again where it stands (`pitch`).
  wagon: {
    id: 'wagon', faction: 'neutral', role: 'wagon', name: 'wagon',
    cost: {}, time: 0, hp: 120, dmg: 0, range: 1, speed: 1.8, sight: 4, cooldown: 1000, trainer: 'town',
  },
  // Ships, built at a Harbour: a transport ferries TRANSPORT_CAP villagers or soldiers, a warship
  // fights at sea and shells the shore.
  transport: {
    id: 'transport', faction: 'neutral', role: 'transport', name: 'transport',
    cost: { wood: 120 }, time: 14000, hp: 160, dmg: 0, range: 1, speed: 2.6, sight: 6, cooldown: 1000, trainer: 'harbour',
  },
  warship: {
    id: 'warship', faction: 'neutral', role: 'warship', name: 'warship',
    cost: { wood: 160, ore: 60 }, time: 20000, hp: 220, dmg: 12, range: 6, speed: 2.4, sight: 8, cooldown: 2200, trainer: 'harbour', age: 2,
  },
  // The guards of the neutral camps (see CAMPS); nobody trains them.
  'wild-brigand': {
    id: 'wild-brigand', faction: 'wild', role: 'melee', name: 'brigand',
    cost: {}, time: 0, hp: 60, dmg: 5, range: 1, speed: 1.9, sight: 5, cooldown: 1100, trainer: 'town',
  },
  'wild-poacher': {
    id: 'wild-poacher', faction: 'wild', role: 'ranged', name: 'poacher',
    cost: {}, time: 0, hp: 35, dmg: 5, range: 4.5, speed: 2, sight: 6, cooldown: 1300, trainer: 'town',
  },
};

/** Faction mastery: this many wins with a faction unlock its second unique unit (`eliteFor`). */
export const MASTERY_WINS = 2;
/** A faction's second unique unit, unlocked by mastery. */
export function eliteFor(faction: FactionId): UnitDef {
  return Object.values(UNITS).find((u) => u.faction === faction && u.elite)!;
}

/** The unit a faction trains for each role; villagers, carts and rams are shared by every faction. */
export function unitFor(faction: FactionId, role: Role): UnitDef {
  const def = Object.values(UNITS).find((u) => (u.faction === faction || u.faction === 'neutral') && u.role === role && !u.elite);
  if (!def) throw new Error(`no ${role} for ${faction}`);
  return def;
}

export interface BuildingDef {
  id: BuildingId;
  name: TextKey;
  cost: Cost;
  /** Build time for one builder, in ms. */
  time: number;
  w: number;
  h: number;
  hp: number;
  sight: number;
  /** Population this building adds once it is finished. */
  pop?: number;
  /** Resources a villager can drop off here. */
  drops?: Resource[] | 'all';
  /** Roles this building trains. */
  trains?: Role[];
  research?: boolean;
  /** A farm: an endless food source a villager can gather from. */
  farm?: boolean;
  tower?: { dmg: number; range: number; cooldown: number };
  /** Only this faction can build it: each faction has one unique building. */
  faction?: FactionId;
  /** The age a player needs before placing it. */
  age?: 2 | 3 | 4;
  /** Must touch water (the Dock). */
  shore?: boolean;
  /** At most this many per player. */
  limit?: number;
  /** Ships come out on the water beside it (the Harbour). */
  naval?: boolean;
  /** A palisade piece, placed by dragging a line; walls and gates are never auto-targeted. */
  palisade?: boolean;
  /** Villagers shelter inside when the town bell rings, up to this many; each adds an arrow to its volleys. */
  shelter?: number;
  /** Swaps wood and food for ore at a moving rate, and trains trade carts. */
  market?: boolean;
}

export const BUILDINGS: Record<BuildingId, BuildingDef> = {
  town: { id: 'town', name: 'town', cost: {}, time: 0, w: 4, h: 4, hp: 2000, sight: 8, pop: 10, drops: 'all', trains: ['villager', 'champion'], tower: { dmg: 10, range: 6, cooldown: 1500 }, shelter: 12 },
  house: { id: 'house', name: 'house', cost: { wood: 50 }, time: 25000, w: 2, h: 2, hp: 400, sight: 3, pop: 6 },
  farm: { id: 'farm', name: 'farm', cost: { wood: 60 }, time: 15000, w: 2, h: 2, hp: 300, sight: 2, farm: true },
  lumber: { id: 'lumber', name: 'lumber', cost: { wood: 80 }, time: 20000, w: 2, h: 2, hp: 300, sight: 3, drops: ['wood'] },
  mine: { id: 'mine', name: 'mine', cost: { wood: 80 }, time: 20000, w: 2, h: 2, hp: 300, sight: 3, drops: ['ore'] },
  barracks: { id: 'barracks', name: 'barracks', cost: { wood: 150 }, time: 40000, w: 3, h: 3, hp: 700, sight: 4, trains: ['melee', 'siege'] },
  range: { id: 'range', name: 'range', cost: { wood: 170 }, time: 40000, w: 3, h: 3, hp: 650, sight: 4, trains: ['ranged'] },
  stable: { id: 'stable', name: 'stable', cost: { wood: 180 }, time: 45000, w: 3, h: 3, hp: 650, sight: 4, trains: ['cavalry'] },
  academy: { id: 'academy', name: 'academy', cost: { wood: 150, food: 100 }, time: 40000, w: 3, h: 3, hp: 700, sight: 4, research: true },
  watchtower: { id: 'watchtower', name: 'watchtower', cost: { wood: 125, ore: 50 }, time: 30000, w: 2, h: 2, hp: 900, sight: 7, tower: { dmg: 12, range: 7, cooldown: 1500 }, shelter: 5 },
  forge: { id: 'forge', name: 'forge', cost: { wood: 150, ore: 50 }, time: 35000, w: 3, h: 3, hp: 700, sight: 4, faction: 'ember', limit: 1 },
  dock: { id: 'dock', name: 'dock', cost: { wood: 140 }, time: 30000, w: 2, h: 2, hp: 500, sight: 5, faction: 'tide', shore: true, limit: 3 },
  grove: { id: 'grove', name: 'grove', cost: { wood: 100, food: 50 }, time: 30000, w: 2, h: 2, hp: 500, sight: 4, drops: ['wood'], faction: 'thorn', limit: 2 },
  wall: { id: 'wall', name: 'wall', cost: { wood: 4 }, time: 2500, w: 1, h: 1, hp: 250, sight: 1, palisade: true },
  gate: { id: 'gate', name: 'gate', cost: { wood: 25 }, time: 8000, w: 1, h: 1, hp: 450, sight: 2, palisade: true },
  market: { id: 'market', name: 'market', cost: { wood: 150, food: 50 }, time: 35000, w: 3, h: 3, hp: 600, sight: 4, age: 2, limit: 1, drops: ['ore'], trains: ['cart'], market: true },
  monument: { id: 'monument', name: 'monument', cost: { wood: 500, food: 300, ore: 400 }, time: 90000, w: 3, h: 3, hp: 2500, sight: 5, age: 3, limit: 1 },
  // Age IV: finishing it wins at once, but only WONDER_CREW builders can work on it at a time.
  wonder: { id: 'wonder', name: 'wonder', cost: { wood: 1000, food: 800, ore: 800 }, time: 480000, w: 4, h: 4, hp: 4000, sight: 6, age: 4, limit: 1 },
  // On a shore, like the Dock: trains transports and (from Age II) warships, which come out on the water.
  harbour: { id: 'harbour', name: 'harbour', cost: { wood: 160 }, time: 35000, w: 3, h: 3, hp: 700, sight: 6, shore: true, limit: 2, trains: ['transport', 'warship'], naval: true },
  // The Steppe Horde's own: a felt tent that takes every resource and houses a few; it packs up and moves.
  yurt: { id: 'yurt', name: 'yurt', cost: { wood: 70, food: 30 }, time: 18000, w: 2, h: 2, hp: 350, sight: 4, pop: 4, drops: 'all', faction: 'steppe', limit: 4 },
};
/** Builders who can work on a Wonder at once; more stand by. 480 s of work takes four of them two minutes. */
export const WONDER_CREW = 4;

/** Whether a building takes a rally flag: it trains something besides trade carts, which set off trading at once. */
export function takesRally(type: BuildingId) {
  return BUILDINGS[type].trains?.some((role) => role !== 'cart') ?? false;
}

/** The build list's first page; the faction's own building comes after these. */
export const BUILD_ORDER: BuildingId[] = ['house', 'farm', 'lumber', 'mine', 'barracks', 'range', 'stable', 'academy', 'watchtower'];
/** The build list's second page. */
export const BUILD_MORE: BuildingId[] = ['wall', 'gate', 'market', 'harbour', 'monument', 'wonder'];
/** Each faction's unique building. */
export const UNIQUE: Record<FactionId, BuildingId> = { ember: 'forge', tide: 'dock', thorn: 'grove', steppe: 'yurt' };
/** What each unique building does, for the menu and the panel. */
export const UNIQUE_EFFECT: Record<FactionId, TextKey> = { ember: 'forgeEffect', tide: 'dockEffect', thorn: 'groveEffect', steppe: 'yurtEffect' };
/** The Steppe Horde's camps that pack onto a wagon and pitch again elsewhere (`packUp`, `pitch`). */
export const PACKS: BuildingId[] = ['yurt', 'lumber', 'mine'];
/** Villagers or soldiers a transport carries at once. */
export const TRANSPORT_CAP = 8;
/** How far from a point, in tiles, a ship stops when it can't sail onto it (a landing on the shore). */
export const LANDING = 2.5;
/** Soldier costs with a finished Forge (Ember Legion). */
export const FORGE_COST = 0.8;
/** A finished Dock lands this much food every DOCK_MS (Tide Coven). */
export const DOCK_FOOD = 10;
export const DOCK_MS = 12000;
/** A finished Grove plants a tree within GROVE_RANGE tiles every GROVE_MS, up to GROVE_TREES around it (Thorn Grove). */
export const GROVE_MS = 15000;
export const GROVE_RANGE = 4;
export const GROVE_TREES = 14;

export interface TechDef {
  id: string;
  name: TextKey;
  /** Which building researches it: the Academy, or the Town Center for the Age II upgrade. */
  at: 'academy' | 'town';
  cost: Cost;
  time: number;
  /** Needs Age II first. */
  age2?: boolean;
  /** An age advance: Age II needs nothing more, Age III the three deeds (DEEDS), Age IV the three more (DEEDS4). */
  advance?: 2 | 3 | 4;
}

export const TECHS: Record<string, TechDef> = {
  axes: { id: 'axes', name: 'axes', at: 'academy', cost: { wood: 100, food: 50 }, time: 30000 },
  baskets: { id: 'baskets', name: 'baskets', at: 'academy', cost: { food: 120, wood: 50 }, time: 30000 },
  picks: { id: 'picks', name: 'picks', at: 'academy', cost: { wood: 150, food: 100 }, time: 30000 },
  ironworks: { id: 'ironworks', name: 'ironworks', at: 'academy', cost: { food: 150, ore: 50 }, time: 35000 },
  fletching: { id: 'fletching', name: 'fletching', at: 'academy', cost: { food: 100, wood: 100 }, time: 35000 },
  age2: { id: 'age2', name: 'age2', at: 'town', cost: { food: 400, wood: 200 }, time: 50000, advance: 2 },
  age3: { id: 'age3', name: 'age3', at: 'town', cost: { food: 500, wood: 300, ore: 200 }, time: 60000, advance: 3 },
  age4: { id: 'age4', name: 'age4', at: 'town', cost: { food: 800, wood: 500, ore: 500 }, time: 70000, advance: 4 },
  stirrups: { id: 'stirrups', name: 'stirrups', at: 'academy', cost: { ore: 100, food: 100 }, time: 40000, age2: true },
  bodkin: { id: 'bodkin', name: 'bodkin', at: 'academy', cost: { wood: 150, ore: 50 }, time: 40000, age2: true },
};

/** Game time for a unit to gather one resource, in ms. */
export const GATHER_MS: Record<Resource, number> = { wood: 1000, food: 1000, ore: 1300 };
export const CARRY = 10;

export const START = { wood: 200, food: 200, ore: 100 } as const;
export const START_VILLAGERS = 4;

/**
 * Age III is earned, not only bought: the Town Center can research it once these three deeds are
 * done. The sim keeps each player's progress in `Player.deeds`.
 */
export const DEEDS = [
  { id: 'age2', name: 'deedAge2' },
  { id: 'army', name: 'deedArmy' },
  { id: 'raid', name: 'deedRaid' },
] as const satisfies readonly { id: string; name: TextKey }[];
export type DeedId = (typeof DEEDS)[number]['id'];
/** Soldiers alive at once for the army deed (the AI raids with as many). */
export const ARMY_DEED = 14;
/** What Age III gives: extra damage for every soldier. */
export const AGE3_DAMAGE = 2;

/**
 * Age IV, the Imperial age, takes three more deeds once in Age III: hold a relic, raise the
 * faction's champion and have a soldier reach VETERAN_RANK. The sim keeps them in `Player.deeds4`.
 */
export const DEEDS4 = [
  { id: 'relic', name: 'deedRelic' },
  { id: 'champion', name: 'deedChampion' },
  { id: 'veteran', name: 'deedVeteran' },
] as const satisfies readonly { id: string; name: TextKey }[];
export type Deed4Id = (typeof DEEDS4)[number]['id'];
/** The rank a soldier must reach for the veteran deed (rank II, Veteran). */
export const VETERAN_RANK = 2;
/** What Age IV gives on top of Age III: more damage for every soldier, and the Wonder. */
export const AGE4_DAMAGE = 2;

/** The one-time pick offered when a player reaches Age II. */
export const BOONS = {
  shieldwall: { id: 'shieldwall', name: 'shieldwallName', text: 'shieldwallText' },
  harvest: { id: 'harvest', name: 'harvestName', text: 'harvestText' },
} as const;
export type BoonId = keyof typeof BOONS;
/** Move speed for cavalry under Stirrups (Academy tech, after Age II). */
export const STIRRUPS_SPEED = 1.2;
/** Damage a melee unit takes under Shieldwall. */
export const SHIELDWALL_TAKEN = 0.8;
/** Gather speed on farms under Harvest Rites. */
export const HARVEST_RITES = 1.2;

/** Units closer than this, in tiles, push each other apart, so armies don't stack on one spot. */
export const UNIT_GAP = 0.55;

/**
 * Neutral camps, guarded by wild Brigands and Poachers. A cache gives its pile once to the first side
 * that stands at it with its guards dead; a relic gives a small lasting bonus to whichever side holds
 * it, and changes hands when the other side stands at it alone.
 */
export const RELICS = {
  plenty: { id: 'plenty', name: 'plentyName', text: 'plentyText' },
  valor: { id: 'valor', name: 'valorName', text: 'valorText' },
  haste: { id: 'haste', name: 'hasteName', text: 'hasteText' },
} as const;
export type RelicId = keyof typeof RELICS;
export const RELIC_GATHER = 1.1;
export const RELIC_DAMAGE = 1;
export const RELIC_SPEED = 1.1;
/** How close, in tiles from a camp's middle, a unit must stand to claim it. */
export const CLAIM_RANGE = 2.6;
/** A guard walks back to its camp when it strays this far from it. */
export const LEASH = 7;

/**
 * The town bell: villagers within BELL_RANGE tiles of a shelter (the Town Center or a finished
 * Watchtower, up to its `shelter`) run inside, and each adds an arrow of GARRISON_ARROW damage to
 * its volleys until they are sent back to work.
 */
export const BELL_RANGE = 14;
export const GARRISON_ARROW = 3;

/**
 * Veteran ranks: a soldier earns rank I, II and III at these kills, each adding RANK_HP health and
 * RANK_DMG damage.
 */
export const RANK_KILLS = [2, 5, 9] as const;
export const RANK_HP = 10;
export const RANK_DMG = 1;
/** The name of rank r is RANK_NAMES[r - 1]. */
export const RANK_NAMES: TextKey[] = ['rankSeasoned', 'rankVeteran', 'rankChampion'];

/**
 * The Market (Age II) swaps MARKET_LOT wood or food for ore. Buying a lot costs MARKET_BASE ore
 * times the resource's rate, selling one pays MARKET_SELL of that; every buy raises the rate by
 * MARKET_STEP and every sale lowers it, and rates drift back towards 1 by MARKET_DRIFT a second.
 * Trade carts drive to a trading post in the middle of the map and bring TRADE_ORE back each trip.
 */
export const MARKET_LOT = 100;
export const MARKET_BASE = 70;
export const MARKET_SELL = 0.6;
export const MARKET_STEP = 0.12;
export const MARKET_RATE_MIN = 0.4;
export const MARKET_RATE_MAX = 3;
export const MARKET_DRIFT = 0.005;
export const TRADE_ORE = 40;

/** The champions' gifts: the Warlord's aura, the Druid's healing. The Seer's gift is its sight. */
export const AURA_RANGE = 6;
export const AURA_DMG = 2;
export const HEAL_RANGE = 5;
export const HEAL_HP = 3;
export const HEAL_MS = 1500;
/** The Chieftain's stride: own units within STRIDE_RANGE move STRIDE_SPEED times as fast. */
export const STRIDE_RANGE = 6;
export const STRIDE_SPEED = 1.25;

/** The Monument (Age III): if it stands this long once built, its owner wins. */
export const MONUMENT_MS = 180000;

/**
 * The AI's raids. Each temperament (TEMPERAMENTS, below) sets when the first may start, the rest
 * between the end of one and the start of the next, the army it waits for and the party it sends.
 * A raid has a goal: the first ones go for the player's outlying economy, later ones for a relic the
 * player holds, and from RAID_TOWN_FROM on (or in Age III) for the Town Center. An economy or relic
 * raid sends a party and keeps the rest home; it turns back when half the party has fallen, when its
 * goal is done, or after RAID_MAX_MS.
 */
export const RAID_TOWN_FROM = 3;
export const RAID_MAX_MS = 150000;
/**
 * The player's attacks on the AI's base count as raids too: ASSAULT_MIN or more of the player's
 * soldiers within BELL_RANGE of the AI's Town Center start one, and it is repelled (the AI's raid
 * deed) when they are all gone from ASSAULT_CLEAR tiles of it and at least half of them fell.
 */
export const ASSAULT_MIN = 3;
export const ASSAULT_CLEAR = 20;

/** The one-time pick offered when a player reaches Age III, like the Age II boon. */
export const EDGES = {
  masonry: { id: 'masonry', name: 'masonryName', text: 'masonryText' },
  muster: { id: 'muster', name: 'musterName', text: 'musterText' },
} as const;
export type EdgeId = keyof typeof EDGES;
/** Building health under Masonry. */
export const MASONRY_HP = 1.3;
/** Soldier training speed under Muster. */
export const MUSTER_SPEED = 1.25;

/** The map kinds picked on the menu. Lowlands is the map as first designed. */
export const MAP_KINDS = {
  lowlands: { id: 'lowlands', name: 'lowlandsName', text: 'lowlandsText' },
  lakes: { id: 'lakes', name: 'lakesName', text: 'lakesText' },
  highlands: { id: 'highlands', name: 'highlandsName', text: 'highlandsText' },
  islands: { id: 'islands', name: 'islandsName', text: 'islandsText' },
} as const;
export type MapKind = keyof typeof MAP_KINDS;
export const MAP_KIND_IDS = Object.keys(MAP_KINDS) as MapKind[];

/**
 * Each AI side draws a temperament per match, which sets its build, raid timing and picks. The player
 * learns which once they have seen the AI's Town Center.
 */
export interface Temperament {
  id: 'raider' | 'builder' | 'warden';
  name: TextKey;
  text: TextKey;
  /** The earliest first raid, the rest after each, the army it waits for and the party it sends. */
  firstRaid: number;
  rest: number;
  army: number;
  party: number;
  /** The soldiers it trains, in order of preference. */
  roles: Role[];
  /** Its buildings in order; `unique` stands for the faction's own building. */
  plan: (BuildingId | 'unique')[];
  research: string[];
  /** Watchtowers it keeps. */
  towers: number;
  /** Its palisade across the front of the base: from which age, and how many stakes each side of the gate. */
  wall: { age: 1 | 2; half: number } | null;
  boon: BoonId;
  edge: EdgeId;
  /**
   * How it treats the player's offers in a three-way match: the goodwill it needs to take a truce
   * or join an alliance against the other AI, how long it keeps each (ms), and the goodwill a
   * tribute (TRIBUTE) earns.
   */
  diplomacy: { truce: number; truceMs: number; ally: number; allyMs: number; tribute: number };
}

export const TEMPERAMENTS: Record<Temperament['id'], Temperament> = {
  raider: {
    id: 'raider', name: 'raiderName', text: 'raiderText',
    firstRaid: 360000, rest: 120000, army: 8, party: 6,
    roles: ['cavalry', 'melee', 'siege', 'champion', 'ranged'],
    plan: ['farm', 'lumber', 'mine', 'barracks', 'stable', 'unique', 'academy', 'range', 'market', 'watchtower', 'monument', 'wonder'],
    research: ['axes', 'baskets', 'age2', 'stirrups', 'ironworks', 'picks', 'fletching', 'bodkin', 'age3', 'age4'],
    towers: 1, wall: null, boon: 'shieldwall', edge: 'muster',
    diplomacy: { truce: 2, truceMs: 120000, ally: 0, allyMs: 240000, tribute: 1 },
  },
  builder: {
    id: 'builder', name: 'builderName', text: 'builderText',
    firstRaid: 840000, rest: 240000, army: 20, party: 14,
    roles: ['siege', 'melee', 'ranged', 'cavalry', 'champion'],
    plan: ['monument', 'farm', 'lumber', 'mine', 'unique', 'academy', 'barracks', 'range', 'stable', 'market', 'watchtower', 'wonder'],
    research: ['axes', 'baskets', 'picks', 'age2', 'ironworks', 'fletching', 'bodkin', 'stirrups', 'age3', 'age4'],
    towers: 1, wall: { age: 2, half: 4 }, boon: 'shieldwall', edge: 'masonry',
    diplomacy: { truce: 0, truceMs: 300000, ally: 2, allyMs: 180000, tribute: 2 },
  },
  warden: {
    id: 'warden', name: 'wardenName', text: 'wardenText',
    firstRaid: 720000, rest: 180000, army: 14, party: 10,
    roles: ['ranged', 'melee', 'siege', 'cavalry', 'champion'],
    plan: ['farm', 'lumber', 'mine', 'barracks', 'watchtower', 'academy', 'unique', 'range', 'stable', 'market', 'monument', 'wonder'],
    research: ['axes', 'baskets', 'fletching', 'age2', 'bodkin', 'ironworks', 'picks', 'stirrups', 'age3', 'age4'],
    towers: 3, wall: { age: 1, half: 6 }, boon: 'harvest', edge: 'masonry',
    diplomacy: { truce: 1, truceMs: 420000, ally: 3, allyMs: 240000, tribute: 1 },
  },
};
export type TemperamentId = Temperament['id'];
export const TEMPERAMENT_IDS = Object.keys(TEMPERAMENTS) as TemperamentId[];

/**
 * Diplomacy in a three-way match: the player may offer each AI a truce, send it a TRIBUTE, or ask it
 * to join against the other AI. Its temperament decides (see `Temperament.diplomacy`). Breaking a
 * pact with an attack costs BREAK_MOOD goodwill; after a refusal it won't hear another ask for ASK_MS.
 */
export const TRIBUTE: Cost = { food: 100, wood: 100 };
export const BREAK_MOOD = 3;
export const ASK_MS = 45000;
