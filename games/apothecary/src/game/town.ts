import type { TextKey } from '../i18n';
import { createDistricts, type DistrictState } from './districts';
import type { PriceSign, Upgrade } from './state';

// The town past the apothecary: once the plague is first cured the town grants a charter, and the
// doctor can buy more shops on the town map, each with its own yard of gardens, stations and a
// counter, run like the apothecary. Each shop costs ten times the one before (a sink for the coins
// a grown apothecary makes), and its stations, workers and pixies cost `TIER_STEP` times as much
// as the shop before's, while its goods sell for about as much more. Phaser-free, like `state.ts`.

/** What a town shop grows, makes and sells. The apothecary's wheat and flour are painted the same. */
export type GoodId = 'wheat' | 'honeycomb' | 'flour' | 'bread' | 'honeyCake' | 'flax' | 'wax' | 'wick' | 'candle' | 'taper' | 'woad' | 'linen' | 'dye' | 'cloth' | 'cloak' | 'ore' | 'timber' | 'charcoal' | 'iron' | 'horseshoe' | 'pot' | 'barley' | 'hops' | 'malt' | 'driedHops' | 'ale' | 'stout' | 'apple' | 'appleTart' | 'fruitCake' | 'lavender' | 'scentedCandle' | 'soap' | 'madder' | 'redDye' | 'redCloth' | 'gown' | 'copper' | 'copperPot' | 'lantern' | 'cider' | 'appleAle';

export const GOODS: Record<GoodId, { color: number }> = {
  wheat: { color: 0xd9b24a },
  honeycomb: { color: 0xe0a83a },
  flour: { color: 0xf1e8d0 },
  bread: { color: 0xb8783a },
  honeyCake: { color: 0xd8944a },
  flax: { color: 0x7a8fc8 },
  wax: { color: 0xe8d070 },
  wick: { color: 0xe8e0c8 },
  candle: { color: 0xf0e2a8 },
  taper: { color: 0xf4e8c0 },
  woad: { color: 0x6a9a4a },
  linen: { color: 0xe6dcc0 },
  dye: { color: 0x3a5aa8 },
  cloth: { color: 0x4a6ab8 },
  cloak: { color: 0x34508e },
  ore: { color: 0x8a5a4a },
  timber: { color: 0x9a6a3a },
  charcoal: { color: 0x2e2a2a },
  iron: { color: 0x6a707a },
  horseshoe: { color: 0x7a808a },
  pot: { color: 0x3a3d48 },
  barley: { color: 0xd8c070 },
  hops: { color: 0x8ab84a },
  malt: { color: 0xb08a4a },
  driedHops: { color: 0x9aa05a },
  ale: { color: 0xd89a3a },
  stout: { color: 0x3a2618 },
  apple: { color: 0xb8443a },
  appleTart: { color: 0xc88a48 },
  fruitCake: { color: 0x8a5a36 },
  lavender: { color: 0x9a82c8 },
  scentedCandle: { color: 0xc8b4e0 },
  soap: { color: 0xd8cce8 },
  madder: { color: 0x8a4a3a },
  redDye: { color: 0xa83a32 },
  redCloth: { color: 0xa8443a },
  gown: { color: 0x8a3a5a },
  copper: { color: 0xc07a48 },
  copperPot: { color: 0xc8804a },
  lantern: { color: 0xe0b04a },
  cider: { color: 0xe0c060 },
  appleAle: { color: 0xc8883a },
};

/** The shops on the town map besides the apothecary, in the order they are bought. */
export type ShopId = 'bakery' | 'chandlery' | 'dyeHouse' | 'smithy' | 'tavern';

export interface Recipe {
  inputs: GoodId[];
  out: GoodId;
  ms: number;
}

export interface GardenDef {
  good: GoodId;
  /** Milliseconds a bed takes to ripen. */
  grow: number;
  name: TextKey;
}

export interface StationDef {
  id: string;
  name: TextKey;
  /** The painted station (see `art/town.ts`). */
  texture: string;
  recipes: Recipe[];
}

/** Where a pixie route carries goods from and to. */
export type RouteEnd = { garden: number } | { station: string } | 'shelf';

export interface RouteDef {
  id: string;
  from: Exclude<RouteEnd, 'shelf'>;
  to: Exclude<RouteEnd, { garden: number }>;
  /** Its cost in the apothecary's coins, before the shop's `tierCost`. */
  cost: number;
}

export interface ShopDef {
  id: ShopId;
  name: TextKey;
  /** One line on the town map: what it sells. */
  makes: TextKey;
  /** 1 for the first shop bought after the apothecary, 2 for the next, and so on. */
  tier: number;
  gardens: GardenDef[];
  /** In the order goods go through them, left to right. */
  stations: StationDef[];
  routes: RouteDef[];
  /** What customers buy, and its price. */
  sells: Partial<Record<GoodId, number>>;
  /**
   * The products its study teaches, one a level of `ShopState.recipes`, in order; the others are
   * known from the start. A station doesn't make, and customers don't ask for, one not learned yet.
   */
  research: GoodId[];
  /** What a hired hand at a station is called on its marker. */
  worker: TextKey;
}

export const SHOPS: Record<ShopId, ShopDef> = {
  bakery: {
    id: 'bakery',
    name: 'bakery',
    makes: 'bakeryMakes',
    tier: 1,
    gardens: [
      { good: 'wheat', grow: 24_000, name: 'wheatField' },
      { good: 'honeycomb', grow: 30_000, name: 'beehives' },
      { good: 'apple', grow: 32_000, name: 'orchard' },
    ],
    stations: [
      { id: 'mill', name: 'mill', texture: 'mill', recipes: [{ inputs: ['wheat'], out: 'flour', ms: 2_500 }] },
      {
        id: 'oven',
        name: 'oven',
        texture: 'oven',
        recipes: [
          { inputs: ['flour', 'flour'], out: 'bread', ms: 5_000 },
          { inputs: ['flour', 'honeycomb'], out: 'honeyCake', ms: 6_000 },
          { inputs: ['flour', 'apple'], out: 'appleTart', ms: 6_500 },
          { inputs: ['flour', 'honeycomb', 'apple'], out: 'fruitCake', ms: 8_000 },
        ],
      },
    ],
    routes: [
      { id: 'field', from: { garden: 0 }, to: { station: 'mill' }, cost: 60 },
      { id: 'hives', from: { garden: 1 }, to: { station: 'oven' }, cost: 60 },
      { id: 'orchard', from: { garden: 2 }, to: { station: 'oven' }, cost: 60 },
      { id: 'mill', from: { station: 'mill' }, to: { station: 'oven' }, cost: 100 },
      { id: 'oven', from: { station: 'oven' }, to: 'shelf', cost: 150 },
    ],
    sells: { bread: 24, honeyCake: 39, appleTart: 45, fruitCake: 66 },
    research: ['appleTart', 'fruitCake'],
    worker: 'baker',
  },
  chandlery: {
    id: 'chandlery',
    name: 'chandlery',
    makes: 'chandleryMakes',
    tier: 2,
    gardens: [
      { good: 'honeycomb', grow: 30_000, name: 'beehives' },
      { good: 'flax', grow: 26_000, name: 'flaxField' },
      { good: 'lavender', grow: 30_000, name: 'lavenderField' },
    ],
    stations: [
      { id: 'press', name: 'press', texture: 'press', recipes: [{ inputs: ['honeycomb'], out: 'wax', ms: 3_000 }] },
      { id: 'wheel', name: 'wheel', texture: 'wheel', recipes: [{ inputs: ['flax'], out: 'wick', ms: 2_500 }] },
      {
        id: 'vat',
        name: 'vat',
        texture: 'vat',
        recipes: [
          { inputs: ['wax', 'wick'], out: 'candle', ms: 5_000 },
          { inputs: ['wax', 'wax', 'wick'], out: 'taper', ms: 7_000 },
          { inputs: ['wax', 'lavender'], out: 'soap', ms: 6_000 },
          { inputs: ['wax', 'wick', 'lavender'], out: 'scentedCandle', ms: 8_000 },
        ],
      },
    ],
    routes: [
      { id: 'hives', from: { garden: 0 }, to: { station: 'press' }, cost: 60 },
      { id: 'flax', from: { garden: 1 }, to: { station: 'wheel' }, cost: 60 },
      { id: 'lavender', from: { garden: 2 }, to: { station: 'vat' }, cost: 60 },
      { id: 'press', from: { station: 'press' }, to: { station: 'vat' }, cost: 100 },
      { id: 'wheel', from: { station: 'wheel' }, to: { station: 'vat' }, cost: 100 },
      { id: 'vat', from: { station: 'vat' }, to: 'shelf', cost: 150 },
    ],
    sells: { candle: 72, taper: 117, soap: 135, scentedCandle: 198 },
    research: ['soap', 'scentedCandle'],
    worker: 'chandler',
  },
  dyeHouse: {
    id: 'dyeHouse',
    name: 'dyeHouse',
    makes: 'dyeHouseMakes',
    tier: 3,
    gardens: [
      { good: 'flax', grow: 26_000, name: 'flaxField' },
      { good: 'woad', grow: 32_000, name: 'woadField' },
      { good: 'madder', grow: 34_000, name: 'madderField' },
    ],
    stations: [
      { id: 'loom', name: 'loom', texture: 'loom', recipes: [{ inputs: ['flax', 'flax'], out: 'linen', ms: 4_000 }] },
      {
        id: 'grinder',
        name: 'grinder',
        texture: 'grinder',
        recipes: [
          { inputs: ['woad'], out: 'dye', ms: 3_000 },
          { inputs: ['madder'], out: 'redDye', ms: 3_500 },
        ],
      },
      {
        id: 'dyeVat',
        name: 'dyeVat',
        texture: 'dyeVat',
        recipes: [
          { inputs: ['linen', 'dye'], out: 'cloth', ms: 6_000 },
          { inputs: ['linen', 'linen', 'dye'], out: 'cloak', ms: 8_000 },
          { inputs: ['linen', 'redDye'], out: 'redCloth', ms: 6_500 },
          { inputs: ['linen', 'linen', 'dye', 'redDye'], out: 'gown', ms: 10_000 },
        ],
      },
    ],
    routes: [
      { id: 'flax', from: { garden: 0 }, to: { station: 'loom' }, cost: 60 },
      { id: 'woad', from: { garden: 1 }, to: { station: 'grinder' }, cost: 60 },
      { id: 'madder', from: { garden: 2 }, to: { station: 'grinder' }, cost: 60 },
      { id: 'loom', from: { station: 'loom' }, to: { station: 'dyeVat' }, cost: 100 },
      { id: 'grinder', from: { station: 'grinder' }, to: { station: 'dyeVat' }, cost: 100 },
      { id: 'dyeVat', from: { station: 'dyeVat' }, to: 'shelf', cost: 150 },
    ],
    sells: { cloth: 216, cloak: 351, redCloth: 405, gown: 594 },
    research: ['redCloth', 'gown'],
    worker: 'dyer',
  },
  smithy: {
    id: 'smithy',
    name: 'smithy',
    makes: 'smithyMakes',
    tier: 4,
    gardens: [
      { good: 'timber', grow: 34_000, name: 'coppice' },
      { good: 'ore', grow: 36_000, name: 'orePit' },
      { good: 'copper', grow: 38_000, name: 'copperPit' },
    ],
    stations: [
      { id: 'kiln', name: 'kiln', texture: 'kiln', recipes: [{ inputs: ['timber'], out: 'charcoal', ms: 3_500 }] },
      { id: 'bloomery', name: 'bloomery', texture: 'bloomery', recipes: [{ inputs: ['ore', 'charcoal'], out: 'iron', ms: 5_000 }] },
      {
        id: 'anvil',
        name: 'anvil',
        texture: 'anvil',
        recipes: [
          { inputs: ['iron'], out: 'horseshoe', ms: 6_000 },
          { inputs: ['iron', 'iron'], out: 'pot', ms: 8_000 },
          { inputs: ['copper', 'copper'], out: 'copperPot', ms: 8_000 },
          { inputs: ['iron', 'copper'], out: 'lantern', ms: 9_000 },
        ],
      },
    ],
    routes: [
      { id: 'timber', from: { garden: 0 }, to: { station: 'kiln' }, cost: 60 },
      { id: 'ore', from: { garden: 1 }, to: { station: 'bloomery' }, cost: 60 },
      { id: 'copper', from: { garden: 2 }, to: { station: 'anvil' }, cost: 60 },
      { id: 'kiln', from: { station: 'kiln' }, to: { station: 'bloomery' }, cost: 100 },
      { id: 'bloomery', from: { station: 'bloomery' }, to: { station: 'anvil' }, cost: 100 },
      { id: 'anvil', from: { station: 'anvil' }, to: 'shelf', cost: 150 },
    ],
    sells: { horseshoe: 648, pot: 1_053, copperPot: 1_215, lantern: 1_782 },
    research: ['copperPot', 'lantern'],
    worker: 'smith',
  },
  tavern: {
    id: 'tavern',
    name: 'tavern',
    makes: 'tavernMakes',
    tier: 5,
    gardens: [
      { good: 'barley', grow: 28_000, name: 'barleyField' },
      { good: 'hops', grow: 34_000, name: 'hopGarden' },
      { good: 'apple', grow: 32_000, name: 'orchard' },
    ],
    stations: [
      { id: 'maltings', name: 'maltings', texture: 'maltings', recipes: [{ inputs: ['barley'], out: 'malt', ms: 3_500 }] },
      { id: 'oast', name: 'oast', texture: 'oast', recipes: [{ inputs: ['hops'], out: 'driedHops', ms: 3_000 }] },
      {
        id: 'kettle',
        name: 'kettle',
        texture: 'kettle',
        recipes: [
          { inputs: ['malt', 'driedHops'], out: 'ale', ms: 6_000 },
          { inputs: ['malt', 'malt', 'driedHops'], out: 'stout', ms: 8_000 },
          { inputs: ['apple', 'apple'], out: 'cider', ms: 6_500 },
          { inputs: ['malt', 'driedHops', 'apple'], out: 'appleAle', ms: 9_000 },
        ],
      },
    ],
    routes: [
      { id: 'barley', from: { garden: 0 }, to: { station: 'maltings' }, cost: 60 },
      { id: 'hops', from: { garden: 1 }, to: { station: 'oast' }, cost: 60 },
      { id: 'orchard', from: { garden: 2 }, to: { station: 'kettle' }, cost: 60 },
      { id: 'maltings', from: { station: 'maltings' }, to: { station: 'kettle' }, cost: 100 },
      { id: 'oast', from: { station: 'oast' }, to: { station: 'kettle' }, cost: 100 },
      { id: 'kettle', from: { station: 'kettle' }, to: 'shelf', cost: 150 },
    ],
    sells: { ale: 1_944, stout: 3_159, cider: 3_645, appleAle: 5_346 },
    research: ['cider', 'appleAle'],
    worker: 'brewer',
  },
};
export const SHOP_IDS = Object.keys(SHOPS) as ShopId[];

/**
 * A shop's second line: a copy of each of its stations (`<id>2`) in a row below the first, with
 * its own pixie routes (`<route>2`, from the same gardens and to the same shelves), bought once at
 * its marker for `LINE2_COST`, like the apothecary's expansion. Its stations level, hire and set
 * their crafting order apart from the first line's.
 */
export const LINE2_COST = 500;
export const line2Cost = (id: ShopId) => tierCost(id, LINE2_COST);
export const line2Id = (id: string) => `${id}2`;
/** Whether a station or route id is the second line's. The first line's ids hold no digits. */
export const isLine2 = (id: string) => id.endsWith('2');
/** A second-line id's first-line twin. */
export const line1Id = (id: string) => (isLine2(id) ? id.slice(0, -1) : id);
const toLine2 = <E extends RouteEnd>(e: E): E => (typeof e === 'object' && 'station' in e ? { station: line2Id(e.station) } : e) as E;
const STATIONS_OF = Object.fromEntries(
  SHOP_IDS.map((id) => [id, [...SHOPS[id].stations, ...SHOPS[id].stations.map((s) => ({ ...s, id: line2Id(s.id) }))]]),
) as Record<ShopId, StationDef[]>;
const ROUTES_OF = Object.fromEntries(
  SHOP_IDS.map((id) => [id, [...SHOPS[id].routes, ...SHOPS[id].routes.map((r) => ({ ...r, id: line2Id(r.id), from: toLine2(r.from), to: toLine2(r.to) }))]]),
) as Record<ShopId, RouteDef[]>;
/** Every station of a shop, both lines', first line first. */
export const shopStations = (def: ShopDef) => STATIONS_OF[def.id];
/** Every pixie route of a shop, both lines'. */
export const shopRoutes = (def: ShopDef) => ROUTES_OF[def.id];
export const stationDef = (def: ShopDef, id: string) => shopStations(def).find((s) => s.id === id)!;
export const routeDef = (def: ShopDef, id: string) => shopRoutes(def).find((r) => r.id === id)!;
/** Whether a shop's station or route stands yet: the first line's always, the second's once bought. */
export const lineOpen = (shop: ShopState, id: string) => !isLine2(id) || shop.line2.level > 0;

/** What the first shop after the apothecary costs; each next one costs `SHOP_COST_STEP` times as much. */
export const SHOP_BASE_COST = 1_000;
export const SHOP_COST_STEP = 10;
export const shopCost = (id: ShopId) => SHOP_BASE_COST * SHOP_COST_STEP ** (SHOPS[id].tier - 1);
/** How much more a shop's stations, workers and pixies cost than the shop before's. */
export const TIER_STEP = 3;
export const tierCost = (id: ShopId, base: number) => base * TIER_STEP ** SHOPS[id].tier;

/** A station's or the counter's level costs this, doubling each level, up to `MAX_LEVEL`. */
export const LEVEL_COST = 20;
export const MAX_LEVEL = 4;
export const levelCost = (id: ShopId, level: number) => tierCost(id, LEVEL_COST) * 2 ** level;
/** A worker costs this, doubling for the second; a station takes `MAX_WORKERS`, the counter `MAX_SHOPKEEPERS`. */
export const WORKER_COST = 30;
export const MAX_WORKERS = 2;
export const MAX_SHOPKEEPERS = 2;
export const workerCost = (id: ShopId, hired: number) => tierCost(id, WORKER_COST) * 2 ** hired;
export const routeCost = (id: ShopId, route: RouteDef) => tierCost(id, route.cost);

/**
 * Each shop's outfitter sells one more level of the doctor's pack, boots and sickle, on top of the
 * apothecary's two; each counts everywhere. Its first cost, before the shop's `tierCost`.
 */
export const OUTFITTER_GEAR = ['pack', 'boots', 'sickle'] as const;
export type Gear = (typeof OUTFITTER_GEAR)[number];
export const GEAR_COST: Record<Gear, number> = { pack: 120, boots: 100, sickle: 100 };
export const gearCost = (id: ShopId, gear: Gear) => tierCost(id, GEAR_COST[gear]);
/**
 * Each shop's study teaches its own crafting order (a "First:" sign at each station with more than
 * one recipe) and price signs (Cheap, Fair or Dear on each shelf), like the apothecary's.
 */
export const LESSONS = ['craftOrder', 'priceSigns'] as const;
export type Lesson = (typeof LESSONS)[number];
export const LESSON_COST: Record<Lesson, number> = { craftOrder: 40, priceSigns: 60 };
export const lessonCost = (id: ShopId, lesson: Lesson) => tierCost(id, LESSON_COST[lesson]);
/** A recipe at a shop's study costs this, doubling for the next, before the shop's `tierCost`. */
export const RECIPE_COST = 60;
export const recipeCost = (id: ShopId, level: number) => tierCost(id, RECIPE_COST) * 2 ** level;

/**
 * A shop's guild, joined once for `GUILD_JOIN_COST`, then selling its upgrades like the
 * apothecary's guild: faster beds, faster pixies, more room on every pallet and shelf, dearer
 * prices, another place at the counter, customers coming in more often and a herbalist who keeps
 * its beds clear of blight.
 */
export const SHOP_GUILD = ['growth', 'belts', 'storage', 'prices', 'slots', 'customers', 'herbalist'] as const;
export type ShopGuild = (typeof SHOP_GUILD)[number];
/** Each guild upgrade's levels, and its first cost, doubling a level, before the shop's `tierCost`. */
export const SHOP_GUILD_UPGRADES: Record<ShopGuild, { max: number; cost: number }> = {
  growth: { max: 2, cost: 60 },
  belts: { max: 2, cost: 90 },
  storage: { max: 3, cost: 75 },
  prices: { max: 2, cost: 60 },
  slots: { max: 1, cost: 90 },
  customers: { max: 2, cost: 75 },
  herbalist: { max: 1, cost: 120 },
};
export const GUILD_JOIN_COST = 150;
export const guildJoinCost = (id: ShopId) => tierCost(id, GUILD_JOIN_COST);
export const guildCost = (id: ShopId, upgrade: ShopGuild, level: number) => tierCost(id, SHOP_GUILD_UPGRADES[upgrade].cost) * 2 ** level;

/** Beds in each garden, four by four. */
export const BEDS = 16;
/** Beds a garden had before, three by three; `normalizeTown` spreads a save's onto the bigger gardens. */
const OLD_BEDS = 9;
/** What each station's in and out pallets, and the shelf, hold of each good. */
export const SHOP_STORAGE = 12;
/** Customers at the counter at once, and with the guild's slots. */
export const SHOP_PLACES = 3;
export const MAX_SHOP_PLACES = SHOP_PLACES + SHOP_GUILD_UPGRADES.slots.max;
/** How long a customer takes to walk from the street to the counter. */
export const WALK_IN_MS = 3_000;
export const SHOP_PATIENCE = 40_000;
/** How many looks customers come in, as `CUSTOMER_LOOKS` in `art/townsfolk.ts`. */
export const CUSTOMER_FACES = 5;
/** How long a shopkeeper takes to hand over one good; the doctor hands everything over at once. */
export const SHOP_SERVE_MS = 1_500;
/** Each counter level adds this share to what customers pay. */
export const COUNTER_PAY = 0.15;
/**
 * A shop's customers tip like the apothecary's (see `tipLeft`): this share of what their order
 * pays, shrinking while they wait at the counter.
 */
export const SHOP_TIP = 0.25;
/** What a regular pays on top of a good's price, as a share of it. */
export const SHOP_REGULAR_BONUS = 0.2;
/** A market day's crowd, served to the last one, pays this share of what its goods sell for on top, into the till. */
export const SHOP_RUSH_BONUS = 0.5;
/** A pixie sets off at most this often on a route. */
export const ROUTE_GAP_MS = 700;
/** Pixies fly this many pixels a second. */
export const ROUTE_SPEED = 100;

export interface StationState {
  /** Goods dropped off, waiting to be worked. */
  queue: GoodId[];
  work: { out: GoodId; ms: number; progress: number } | null;
  output: GoodId[];
  level: Upgrade;
  /** Workers hired: `level` is how many. */
  hired: Upgrade;
}

export interface RouteState {
  built: boolean;
  paid: number;
  /** Goods on their way, each `at` milliseconds along the route. */
  items: { good: GoodId; at: number }[];
  /** Milliseconds until the next pixie may set off. */
  next: number;
}

/**
 * A fine good: a shop's product taken off its station by hand in the last `FINE_SHARE` of its
 * work, like the apothecary's fine potions, worth `FINE_BONUS` times as much. It goes on the same
 * shelf as its plain good and is sold first.
 */
export type FineGood = `${GoodId}-fine`;
/** What the doctor's hands and a shop's shelf hold: a good, or a fine one. */
export type Held = GoodId | FineGood;
export const fineOf = (good: GoodId): FineGood => `${good}-fine`;
export const isFineGood = (held: Held): held is FineGood => held.endsWith('-fine');
export const plainGood = (held: Held): GoodId => (isFineGood(held) ? held.slice(0, -'-fine'.length) : held) as GoodId;

/**
 * A shop's contract for the day: `need` of one good it sells handed over at its counter before
 * the apothecary's day (`GameState.contract.day`) ends, for `reward` coins into its till.
 */
export interface ShopContract {
  day: number;
  good: GoodId;
  need: number;
  made: number;
  reward: number;
  /** On a bundle day, a second good wanted as well (see `BUNDLE_EVERY`). */
  bundle?: { good: GoodId; need: number; made: number };
}
/** A shop's contracts ask for this many, one more for each kept, up to `MAX_SHOP_CONTRACT`. */
export const SHOP_CONTRACT_START = 4;
export const MAX_SHOP_CONTRACT = 12;
/** A contract pays this share of what its goods sell for at their base price. */
export const SHOP_CONTRACT_SHARE = 0.45;

export interface ShopOrder {
  id: number;
  wants: GoodId[];
  pay: Partial<Record<GoodId, number>>;
  /** Milliseconds until the customer reaches the counter; patience only runs once there. */
  walk: number;
  patience: number;
  maxPatience: number;
  face: number;
  /** Which place at the counter they stand at, from 0. */
  spot: number;
  /** The most the customer tips once their order is filled (see `SHOP_TIP`); missing on older orders, which tip nothing. */
  tip?: number;
  /** Every good the customer asked for, served or not. */
  asked?: GoodId[];
  /** A regular, back for the same goods as last time, paying `SHOP_REGULAR_BONUS` more for each. */
  regular?: boolean;
  /** One of a market day's crowd. */
  rush?: boolean;
}

/** A customer who left a shop happy and will come back for the same goods. */
export interface ShopRegular {
  face: number;
  wants: GoodId[];
}

/**
 * A market day's crowd at a shop: `size` customers come at midday, filling every free place at the
 * counter while the rest wait in the street (`waiting`) for one. Served to the last one with none
 * walking off, `bonus` goes into the till.
 */
export interface ShopRush {
  day: number;
  size: number;
  waiting: number;
  served: number;
  lost: boolean;
  paid: boolean;
  bonus: number;
}

export interface ShopState {
  /** Milliseconds grown, per bed, `BEDS` per garden in garden order. */
  beds: number[];
  stations: Record<string, StationState>;
  routes: Record<string, RouteState>;
  shelf: Held[];
  till: number;
  /** How far a shopkeeper is with handing over the next good, towards `SHOP_SERVE_MS`. */
  serving: number;
  counter: { level: Upgrade; hired: Upgrade };
  orders: ShopOrder[];
  nextOrderIn: number;
  nextOrderId: number;
  /** Goods handed over, ever. */
  sold: number;
  /** The levels bought at this shop's outfitter, one at most of each. */
  outfitter: Record<Gear, Upgrade>;
  /** The lessons learned at this shop's study. */
  study: Record<Lesson, Upgrade>;
  /** The recipes learned at this shop's study: `level` of its `research`, in order. */
  recipes: Upgrade;
  /** The shop's guild: `join` once, then its upgrades. */
  guild: Record<'join' | ShopGuild, Upgrade>;
  /** What each station makes first once the crafting order is learned, or null for its own order. */
  priority: Record<string, GoodId | null>;
  /** Each shelf's price sign once the price signs are learned; Fair unless set. */
  signs: Partial<Record<GoodId, PriceSign>>;
  /** Today's contract, or null before its first day; `kept` counts those kept, ever. */
  contract: ShopContract | null;
  kept: number;
  /** The second line: `level` 1 once bought. */
  line2: Upgrade;
  /** What the street thinks of the shop, 0 to 100, as the apothecary's `reputation`. */
  reputation: number;
  /** Customers who left happy, oldest first, up to `MAX_REGULARS`. */
  regulars: ShopRegular[];
  /** The last market day's crowd, or null before the first. */
  rush: ShopRush | null;
  /** The blighted beds, each with how long since it last spread the blight. */
  blight: { bed: number; ms: number }[];
}

export interface TownState {
  shops: Partial<Record<ShopId, ShopState>>;
  /** What the doctor carries in the town's shops, kept apart from the apothecary's hands. */
  hands: Held[];
  /** The households of each of `DISTRICTS`, in order. */
  districts: DistrictState[];
  /** Towns grown into cities and left behind for the next (AP15): 0 in the first town. Missing in older saves. */
  cities?: number;
}

export const createTown = (): TownState => ({ shops: {}, hands: [], districts: createDistricts() });

const none = (): Upgrade => ({ level: 0, paid: 0 });

/** A shop as bought: every bed ripe, stations and counter at level 0, no workers or pixies. */
export function createShop(id: ShopId): ShopState {
  const def = SHOPS[id];
  return {
    beds: def.gardens.flatMap((g) => Array.from({ length: BEDS }, () => g.grow)),
    stations: Object.fromEntries(shopStations(def).map((s) => [s.id, { queue: [], work: null, output: [], level: none(), hired: none() }])),
    routes: Object.fromEntries(shopRoutes(def).map((r) => [r.id, { built: false, paid: 0, items: [], next: 0 }])),
    shelf: [],
    till: 0,
    serving: 0,
    counter: { level: none(), hired: none() },
    orders: [],
    nextOrderIn: WALK_IN_MS,
    nextOrderId: 1,
    sold: 0,
    outfitter: { pack: none(), boots: none(), sickle: none() },
    study: { craftOrder: none(), priceSigns: none() },
    recipes: none(),
    guild: { join: none(), growth: none(), belts: none(), storage: none(), prices: none(), slots: none(), customers: none(), herbalist: none() },
    priority: Object.fromEntries(shopStations(def).map((s) => [s.id, null])),
    signs: {},
    contract: null,
    kept: 0,
    line2: none(),
    // In the middle, as the apothecary's `START_REPUTATION`.
    reputation: 50,
    regulars: [],
    rush: null,
    blight: [],
  };
}

/**
 * A saved town with anything added since filled in: a shop's new beds, stations and routes take
 * their defaults, so saves keep working as shops grow.
 */
export function normalizeTown(saved: Partial<TownState> | undefined): TownState {
  const districts = createDistricts().map((d, i) => ({ ...d, ...saved?.districts?.[i] }));
  const town: TownState = { shops: {}, hands: saved?.hands ?? [], districts, cities: Math.max(0, Math.floor(Number(saved?.cities) || 0)) };
  for (const id of SHOP_IDS) {
    const shop = saved?.shops?.[id];
    if (!shop) continue;
    const fresh = createShop(id);
    town.shops[id] = {
      ...fresh,
      ...shop,
      beds: shop.beds.length % BEDS === 0 ? [...shop.beds, ...fresh.beds.slice(shop.beds.length)] : fresh.beds.map((ripe, b) => (b % BEDS < OLD_BEDS ? shop.beds[gardenOfBed(b) * OLD_BEDS + (b % BEDS)] : undefined) ?? ripe),
      stations: { ...fresh.stations, ...shop.stations },
      routes: { ...fresh.routes, ...shop.routes },
      counter: { ...fresh.counter, ...shop.counter },
      outfitter: { ...fresh.outfitter, ...shop.outfitter },
      study: { ...fresh.study, ...shop.study },
      recipes: shop.recipes ?? fresh.recipes,
      guild: { ...fresh.guild, ...shop.guild },
      priority: { ...fresh.priority, ...shop.priority },
    };
  }
  return town;
}

/** Whether the town map is open: the town grants its charter with the first seal, the plague's first cure. */
export const townOpen = (seals: number) => seals > 0;

/** The garden a bed is in. */
export const gardenOfBed = (bed: number) => Math.floor(bed / BEDS);
/** Beds a garden row holds. */
const BED_ROW = 4;
/** The beds next to a bed in its garden's four by four: above, below, left and right. */
export const bedNeighbours = (bed: number) => {
  const slot = bed % BEDS, col = slot % BED_ROW, row = Math.floor(slot / BED_ROW);
  const near: number[] = [];
  if (col > 0) near.push(bed - 1);
  if (col < BED_ROW - 1) near.push(bed + 1);
  if (row > 0) near.push(bed - BED_ROW);
  if (row < BEDS / BED_ROW - 1) near.push(bed + BED_ROW);
  return near;
};
/** Whether a shop's bed is blighted. */
export const isBlightedBed = (shop: ShopState, bed: number) => shop.blight.some((b) => b.bed === bed);

/** Whether a station takes a good: it is an input of one of its recipes. */
export const takes = (station: StationDef, good: GoodId) => station.recipes.some((r) => r.inputs.includes(good));

/** A shop guild upgrade's level. */
const guildLevel = (shop: ShopState, upgrade: ShopGuild) => shop.guild[upgrade].level;
/** What each pallet and shelf of a shop holds of a good: 6 more a level of its guild's storage. */
export const shopStorage = (shop: ShopState) => SHOP_STORAGE + 6 * guildLevel(shop, 'storage');
/** Customers at a shop's counter at once. */
export const shopPlaces = (shop: ShopState) => SHOP_PLACES + guildLevel(shop, 'slots');
/** How fast a shop's beds grow: a quarter faster a level of its guild's growth. */
export const shopGrowth = (shop: ShopState) => 1 + 0.25 * guildLevel(shop, 'growth');
/** How fast a shop's pixies fly: half again as fast a level. */
export const shopRouteSpeed = (shop: ShopState) => ROUTE_SPEED * (1 + 0.5 * guildLevel(shop, 'belts'));
/** What a shop's prices are multiplied by: a quarter more a level. */
export const shopPriceBoost = (shop: ShopState) => 1 + 0.25 * guildLevel(shop, 'prices');
/** How much more often customers come in: once more as often a level. */
export const shopFootfall = (shop: ShopState) => 1 + guildLevel(shop, 'customers');
/** Whether a shop's herbalist keeps its beds clear of blight. */
export const shopBlightImmune = (shop: ShopState) => guildLevel(shop, 'herbalist') > 0;

/** Whether a shop's study has taught a lesson. */
export const shopStudied = (shop: ShopState, lesson: Lesson) => shop.study[lesson].level > 0;
/** The goods a station can put first: its recipes' products, when it has more than one. */
export const priorityChoices = (station: StationDef, knows: (good: GoodId) => boolean = () => true): GoodId[] => {
  const outs = station.recipes.map((r) => r.out).filter(knows);
  return outs.length > 1 ? outs : [];
};
/** The sign on a good's shelf: Fair unless set, and always Fair before the price signs are learned. */
export const shopSignOf = (shop: ShopState, good: GoodId): PriceSign => (shopStudied(shop, 'priceSigns') && shop.signs[good]) || 'fair';

/** Whether a shop makes a product yet: known from the start, or learned at its study. */
export const shopKnows = (shop: ShopState, def: ShopDef, good: GoodId) => {
  const at = def.research.indexOf(good);
  return at < 0 || at < shop.recipes.level;
};
/** Whether a shop makes or uses a good yet: one it knows that a recipe it knows takes, or that none takes. */
export const shopMakes = (shop: ShopState, def: ShopDef, good: GoodId) => {
  const takers = def.stations.flatMap((s) => s.recipes).filter((r) => r.inputs.includes(good));
  return shopKnows(shop, def, good) && (takers.length === 0 || takers.some((r) => shopKnows(shop, def, r.out)));
};
/** The goods customers ask for at a shop: what it sells and knows. */
export const shopSells = (shop: ShopState, def: ShopDef) => (Object.keys(def.sells) as GoodId[]).filter((g) => shopKnows(shop, def, g));

/** The gardens a shop starts with; the next opens with its first recipe learned at the study. */
export const OPEN_GARDENS = 2;
/** Whether a shop's garden grows yet. */
export const gardenOpen = (shop: ShopState, g: number) => g < OPEN_GARDENS || shop.recipes.level > 0;

/** Whether customers buy a good at this shop. */
export const sellsGood = (def: ShopDef, good: GoodId) => def.sells[good] !== undefined;
