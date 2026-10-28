import { GROW_MS, PLANTS, POTION_PRICE, POTIONS, REFINED, type BrewOut, type ItemId, type PlantId, type PotionId, type RefinedId, type SellableId } from './items';
import type { TextKey } from '../i18n';
import { SHOP_IDS, createTown, type Gear, type TownState } from './town';

export interface Plot {
  plant: PlantId;
  /** Milliseconds grown since the last harvest; ripe once it reaches the plant's grow time. */
  grown: number;
  /** Blighted: the bed stops growing and spreads the blight, until the sickle clears it. Missing in older saves. */
  blighted?: boolean;
  /** Milliseconds since this blighted bed last spread the blight; it spreads every `BLIGHT_SPREAD_MS`. */
  blightMs?: number;
}

export interface Refiner {
  queue: PlantId[];
  /** Milliseconds spent on the front of the queue. */
  progress: number;
  output: RefinedId[];
  /**
   * The second pipe, opened by a second craftsman: a plant taken off the queue and worked alongside
   * the front one, with its own progress. Missing in saves from before it, which counts as empty.
   */
  second?: { plant: PlantId; progress: number } | null;
}

export interface Brew {
  /** The potion, or the Panacea, which cures the town the moment it is done. */
  out: BrewOut;
  ms: number;
  progress: number;
}

export interface Cauldron {
  contents: RefinedId[];
  brewing: Brew | null;
  /** The second pipe's brew, opened by a second craftsman. Missing in saves from before it. */
  brewing2?: Brew | null;
  output: PotionId[];
}

/**
 * The last `FINE_SHARE` of a brew is its fine window: a potion taken out of the cauldron by hand
 * then, before it is done, is a Fine potion that sells for `FINE_BONUS` times as much. Craftsmen
 * always leave it in until it is done.
 */
export const FINE_SHARE = 0.25;
export const FINE_BONUS = 1.5;
/** Whether a brew is in its fine window. */
export const inFineWindow = (brew: Brew | null): brew is Brew => !!brew && brew.progress >= brew.ms * (1 - FINE_SHARE) && brew.progress < brew.ms;

/** Potions put out for customers, and the coins they have paid that wait to be picked up. */
export interface Counter {
  shelf: SellableId[];
  till: number;
  /** How far the craftsmen are with handing over the next potion, towards SERVE_MS. */
  serving?: number;
}

export interface Order {
  id: number;
  /** Potions still owed; the customer leaves once this is empty. */
  wants: PotionId[];
  /** What the customer pays for each potion they get, tip included, fixed when they arrive. */
  pay: Partial<Record<PotionId, number>>;
  /** Milliseconds the customer waits at the counter before leaving. */
  patience: number;
  maxPatience: number;
  /**
   * The most the customer tips, paid when their whole order is filled: it shrinks as they wait (see
   * `tipLeft`). Missing on orders saved before tips decayed, which tip nothing.
   */
  tip?: number;
  /** Every potion the customer asked for, served or not; missing on old orders. */
  asked?: PotionId[];
  /** Which townsfolk look the customer has; a returning regular keeps theirs. Missing on old orders, which use their id. */
  face?: number;
  /** A regular, back for the same potions as last time, paying `REGULAR_BONUS` more for each. */
  regular?: boolean;
  /** One of a market day's crowd. */
  rush?: boolean;
}

/** A customer who left happy and will come back for the same potions. */
export interface Regular {
  face: number;
  wants: PotionId[];
}

/**
 * A market day's rush: a crowd of `size` customers comes in at once at midday, and if every one of
 * them is served, `RUSH_BONUS` coins each go into the purse.
 */
export interface Rush {
  /** The day it came on. */
  day: number;
  size: number;
  served: number;
  /** Set once one of the crowd walks off unserved: the bonus is lost. */
  lost: boolean;
  /** Set once the bonus is paid. */
  paid: boolean;
}

/**
 * Today's contract: deliver `need` of one potion to customers before dusk for `reward` coins, paid
 * straight into the purse. A kept or missed contract rolls over to the next day's.
 */
export interface Contract {
  /** Which day it is, from 1. */
  day: number;
  potion: PotionId;
  need: number;
  /** How many of the potion customers have been sold today. */
  made: number;
  reward: number;
  /** Milliseconds until dusk. */
  dayLeft: number;
  /** Contracts kept so far; each one kept asks for one more potion the next day. */
  kept: number;
  /** A second potion asked for with the first, on a bundle day; kept only once both are delivered. */
  bundle?: { potion: PotionId; need: number; made: number };
}

/** The refining tables and cauldrons: one of each on the first production line, and on the second. */
export type RefinerId = 'refiner' | 'refiner2';
export type CauldronId = 'cauldron' | 'cauldron2';
export const REFINERS: RefinerId[] = ['refiner', 'refiner2'];
export const CAULDRONS: CauldronId[] = ['cauldron', 'cauldron2'];
export type StationId = RefinerId | CauldronId | 'counter';

/**
 * Conveyor belts, named after where they start: the gardens to the refining table, the refining
 * table to the cauldron, and the cauldron to the counter. The second line's belts end with a 2; its
 * cauldron belt joins the first line's on the way to the counter.
 */
export type BeltId = 'garden' | 'refiner' | 'cauldron' | 'garden2' | 'refiner2' | 'cauldron2';
export const BELTS: BeltId[] = ['garden', 'refiner', 'cauldron', 'garden2', 'refiner2', 'cauldron2'];

/** An item riding a belt, `at` ms along it. */
export interface BeltItem {
  id: ItemId;
  at: number;
  /** The run it got on at (a garden's feeder, by `GARDEN_RUN`); missing means its kind's own run. */
  run?: number;
}

/** Something bought on its build marker in handfuls of coins, like an upgrade. */
export interface Build {
  built: boolean;
  paid: number;
}

/** A belt is bought like any build, and then carries goods. */
export interface Belt extends Build {
  /** Items on the belt, in the order they got on, so in each lane the one nearest the end first. */
  items: BeltItem[];
}

/**
 * The second production line on the right of the map. The land is bought first; then each of its two
 * fields, its refining table and its cauldron is built on its own.
 */
export interface Expansion {
  land: Build;
  fields: Build[];
  refiner: Build;
  cauldron: Build;
}

/** An upgrade's level and the coins paid so far towards the next one. */
export interface Upgrade {
  level: number;
  paid: number;
}

/**
 * What can be upgraded: every station; the doctor's pack (carry more), boots (walk faster) and
 * sickle (harvest from further away); and at the guild, the gardens' growth, the belts' speed, how
 * much every pallet and shelf holds, the shop's prices, an extra order slot and how often customers
 * come in.
 */
export type UpgradeId = StationId | 'pack' | 'boots' | 'sickle' | 'growth' | 'belts' | 'storage' | 'prices' | 'slots' | 'customers' | 'research' | 'craftOrder' | 'priceSigns' | 'replant' | 'herbalist';
export const DOCTOR_UPGRADES = ['pack', 'boots', 'sickle'] as const;
export const GUILD_UPGRADES = ['growth', 'belts', 'storage', 'prices', 'slots', 'customers', 'herbalist'] as const;

/** Each upgrade's highest level (levels count from 0), its first cost, which doubles per level, and name. */
export const UPGRADES: Record<UpgradeId, { max: number; cost: number; name: TextKey }> = {
  refiner: { max: 4, cost: 20, name: 'refiningTable' },
  cauldron: { max: 4, cost: 20, name: 'cauldron' },
  refiner2: { max: 4, cost: 20, name: 'refiningTable' },
  cauldron2: { max: 4, cost: 20, name: 'cauldron' },
  counter: { max: 4, cost: 20, name: 'counter' },
  pack: { max: 2, cost: 30, name: 'pack' },
  boots: { max: 2, cost: 25, name: 'boots' },
  sickle: { max: 2, cost: 25, name: 'sickle' },
  growth: { max: 2, cost: 20, name: 'growth' },
  belts: { max: 2, cost: 30, name: 'pixies' },
  storage: { max: 3, cost: 25, name: 'storage' },
  prices: { max: 2, cost: 20, name: 'prices' },
  slots: { max: 1, cost: 30, name: 'slots' },
  customers: { max: 2, cost: 25, name: 'customers' },
  // The guild's herbalist tends the beds, so the blight never takes one.
  herbalist: { max: 1, cost: 60, name: 'herbalist' },
  // Each level learns the next recipe in RESEARCH_ORDER.
  research: { max: 4, cost: 30, name: 'study' },
  // Also at the study: learning to choose what each table and cauldron makes first, to price each
  // shelf with its sign, and to replant a garden from its sign.
  craftOrder: { max: 1, cost: 40, name: 'craftOrder' },
  priceSigns: { max: 1, cost: 60, name: 'priceSigns' },
  replant: { max: 1, cost: 30, name: 'replanting' },
};
export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[];
/** Coins needed to take an upgrade from `level` to the next: stations 20, 40, 80, 160. */
export const upgradeCost = (id: UpgradeId, level: number) => UPGRADES[id].cost * 2 ** level;

/**
 * How hard a purple marker pays: each payment is `boost` times its usual size. The scenes raise it
 * the longer the doctor stands on the marker (`payBoost`) and set it back to 1 after paying.
 */
export const payment = { boost: 1 };
/** Paying speeds up the longer the doctor stays on a marker: twice as much a step for every `PAY_DOUBLE_MS`, up to `MAX_PAY_BOOST`. */
export const PAY_DOUBLE_MS = 1_000;
export const MAX_PAY_BOOST = 64;
export const payBoost = (heldMs: number) => Math.min(MAX_PAY_BOOST, 2 ** Math.floor(Math.max(0, heldMs) / PAY_DOUBLE_MS));

/** Every station a craftsman can be hired for. */
export const STATIONS: StationId[] = ['refiner', 'cauldron', 'refiner2', 'cauldron2', 'counter'];
/** The stations that craft, and so have a priority: the refining tables and cauldrons. */
export type CraftingId = RefinerId | CauldronId;
/**
 * What a crafting station makes first whenever it can, chosen by the player: a plant for a refining
 * table to refine, a potion for a cauldron to brew. Null leaves it to the station: a table takes
 * plants in the order they came, a cauldron brews what the shop is shortest of.
 */
export type Priority = { [id in RefinerId]: PlantId | null } & { [id in CauldronId]: PotionId | null };
/**
 * Up to two craftsmen work each station; the first costs 30 coins, the second 60. At a refining
 * table or cauldron the second opens a second pipe, working a second plant or brew alongside the
 * first at the same speed, rather than making the first faster.
 */
export const MAX_CRAFTSMEN = 2;
export const craftsmanCost = (hired: number) => 30 * 2 ** hired;

export interface GameState {
  version: 3;
  /** Which world layout the save was made in; a save from another layout starts the doctor at the start spot. */
  layout: number;
  coins: number;
  carrying: ItemId[];
  player: { x: number; y: number };
  plots: Plot[];
  refiner: Refiner;
  cauldron: Cauldron;
  refiner2: Refiner;
  cauldron2: Cauldron;
  counter: Counter;
  /** Entry to the guild, bought once before any of its upgrades are for sale. */
  guild: Build;
  expansion: Expansion;
  /** The shade gardens where nightshade grows: the first line's, then the second's. */
  shade: Build[];
  upgrades: Record<UpgradeId, Upgrade>;
  /** Craftsmen hired at each station (`level`), and coins paid towards the next one. */
  craftsmen: Record<StationId, Upgrade>;
  belts: Record<BeltId, Belt>;
  priority: Priority;
  orders: Order[];
  nextOrderIn: number;
  nextOrderId: number;
  contract: Contract;
  /** Potions sold to customers, all game long. */
  sold: number;
  /** Tip coins customers have paid, all game long. */
  tips: number;
  /** Wall-clock time (Date.now) the game was last saved, for catching up on the automation while away; 0 for a new game. */
  lastSeen: number;
  /** The street's opinion of the shop, 0 to 100: served customers raise it, ones who walk off lower it. */
  reputation: number;
  /** Customers who will come back for the same potions, oldest first. */
  regulars: Regular[];
  /** The latest market day's rush, or null before the first. */
  rush: Rush | null;
  /** The plague, from `PLAGUE_DAY` on, or null before it. */
  plague: Plague | null;
  /** The price sign on each potion's shelf; a shelf without one is Fair. */
  signs: Partial<Record<PotionId, PriceSign>>;
  /** The rival shop across the street. */
  rival: Rival;
  /** Town seals, one for each season's plague cured; each raises every potion's price. */
  seals: number;
  /** The merchant wagon at the street door on a wagon day, or null before the first. */
  wagon: Wagon | null;
  /** What the herb market's buy marker sells. */
  marketPick: HerbId;
  /** The town's shops bought after the charter, and the doctor's hands in them (see `town.ts`). */
  town: TownState;
}

/**
 * Each garden grows a single kind of plant; the wheat field comes first. The first two gardens are
 * the first line's; the next two are the second line's fields, which grow once built. The shade
 * gardens, where nightshade grows once planted, come last, the first line's and then the second's,
 * so older saves keep their plots.
 */
export const GARDENS: PlantId[] = ['wheat', 'mandrake', 'wheat', 'mandrake', 'nightshade', 'nightshade'];
/** Which production line each garden belongs to: 1 or 2. */
export const GARDEN_LINE = [1, 1, 2, 2, 1, 2];
/** Which run of its line's garden belt each garden's goods get on: the main run, or a feeder. */
export const GARDEN_RUN = [0, 1, 0, 1, 2, 2];
/** The gardens of each line, in the order of the belt's runs. */
export const LINE_GARDENS = (line: number) => GARDENS.map((_, g) => g).filter((g) => GARDEN_LINE[g] === line);
/** What a garden is called while it grows each plant. */
export const GARDEN_NAMES: Record<PlantId, TextKey> = { wheat: 'wheatField', mandrake: 'mandrakePatch', nightshade: 'shadeGarden' };
/** A garden's name inside a sentence, lower case in English. */
export const GARDEN_NAMES_IN: Record<PlantId, TextKey> = { wheat: 'wheatFieldIn', mandrake: 'mandrakePatchIn', nightshade: 'shadeGardenIn' };
/** The plant a garden grows: every bed in a garden grows the same one. */
export const gardenPlant = (state: GameState, garden: number) => state.plots[garden * PLOTS_PER_GARDEN].plant;
/**
 * What a garden's sign can switch its beds to: the plants its line grows already, so nightshade only
 * once the line's shade garden is planted.
 */
export const plantChoices = (state: GameState, garden: number): PlantId[] => {
  const line = GARDEN_LINE[garden];
  return PLANTS.filter((plant) => plant !== 'nightshade' || !!state.shade[line - 1]?.built);
};
/** Each garden has nine plots, three by three. */
export const PLOTS_PER_GARDEN = 9;
/** The second line's fields are gardens LINE2_GARDEN and the one after it. */
export const LINE2_GARDEN = 2;
/** The first line's shade garden; the second line's comes after it. */
export const SHADE_GARDEN = 4;
export const gardenOf = (plot: number) => Math.floor(plot / PLOTS_PER_GARDEN);
/**
 * Whether a garden is there to grow and harvest: the first line's field and patch always, the
 * second line's once built, and a shade garden once planted.
 */
export const gardenBuilt = (state: GameState, garden: number) =>
  garden < LINE2_GARDEN ||
  (garden >= SHADE_GARDEN ? !!state.shade[garden - SHADE_GARDEN]?.built : !!state.expansion.fields[garden - LINE2_GARDEN]?.built);
/** Whether any shade garden grows nightshade, so customers start asking for Shadow Elixirs. */
export const shadeGrown = (state: GameState) => state.shade.some((s) => s.built);
/** Coins to plant each shade garden: the first line's, then the second's, which needs the expansion's land. */
export const SHADE_COST = [80, 60];
/** The recipes the apothecary knows from the start; the others are learned at the study. */
export const KNOWN_RECIPES: readonly PotionId[] = ['healingDraught', 'sleepingTonic'];
/** The order the study teaches the other recipes in, one per level of its `research` upgrade. */
export const RESEARCH_ORDER: readonly PotionId[] = ['vigourTonic', 'shadowElixir', 'moonlightSalve', 'witchsBrew'];
/** Whether the apothecary can brew a potion: known from the start, or learned at the study. */
export const researched = (state: GameState, potion: PotionId) =>
  KNOWN_RECIPES.includes(potion) || RESEARCH_ORDER.indexOf(potion) < state.upgrades.research.level;
/** The study's lessons besides its recipes: one level each. */
export type Lesson = 'craftOrder' | 'priceSigns' | 'replant';
export const LESSONS: readonly Lesson[] = ['craftOrder', 'priceSigns', 'replant'];
/**
 * Whether the study has taught a lesson: the crafting order (the tables' and cauldrons' "First:"
 * signs), the shelves' price signs, or replanting a garden from its sign.
 */
export const studied = (state: GameState, id: Lesson) => state.upgrades[id].level > 0;
/** The potions brewed with nightshade, which customers ask for only once a shade garden grows it. */
export const NEEDS_NIGHTSHADE: readonly PotionId[] = ['shadowElixir', 'moonlightSalve', 'witchsBrew'];
/**
 * The potions customers ask for: those the apothecary has learned, and the ones brewed with
 * nightshade only once a shade garden grows it.
 */
export const orderable = (state: GameState) =>
  POTIONS.filter((p) => researched(state, p) && (!NEEDS_NIGHTSHADE.includes(p) || shadeGrown(state)));
/** Whether a refining table or cauldron stands: always on the first line, once built on the second. */
export const stationBuilt = (state: GameState, id: StationId) =>
  id === 'refiner2' ? state.expansion.refiner.built : id === 'cauldron2' ? state.expansion.cauldron.built : true;

/** Customers who can wait at once: three, and one more with the extra order slot. */
export const MAX_ORDERS = 3;
export const maxOrders = (state: GameState) => MAX_ORDERS + state.upgrades.slots.level;
/** How many more customers than the slots a market day's crowd may bring. */
export const RUSH_EXTRA = 2;
/** The most customers there can ever be, for laying out their places. */
export const MAX_ORDER_SLOTS = MAX_ORDERS + UPGRADES.slots.max + RUSH_EXTRA;
/**
 * Time until the next customer comes in: 12 to 20 seconds, one more time as often per customers
 * level, more often with a good reputation and on a fair day.
 */
export const orderInterval = (state: GameState, roll: number) =>
  ((12_000 + roll * 8_000) * reputationFactor(state.reputation)) / (1 + state.upgrades.customers.level) / WEATHER[weatherFor(state.contract.day)].customers;
/** How fast plants grow: a quarter faster per growth level, and faster in the rain or slower in a drought. */
export const growthSpeed = (state: GameState) => (1 + 0.25 * state.upgrades.growth.level) * WEATHER[weatherFor(state.contract.day)].growth;

/** Reputation starts in the middle; served customers raise it and ones who walk off lower it. */
export const START_REPUTATION = 50;
export const REPUTATION_SERVED = 3;
export const REPUTATION_WALKED_OFF = 8;
/**
 * How much reputation stretches the time between customers: 1 at the start (50), down to half at
 * 100 and up to one and a half at 0.
 */
export const reputationFactor = (reputation: number) => 1.5 - reputation / 100;
/** Changes the reputation by `by`, kept within 0 to 100. */
export const nudgeReputation = (state: GameState, by: number) => {
  state.reputation = Math.max(0, Math.min(100, state.reputation + by));
};
/** A customer whose order is filled with at least this share of their tip left comes back as a regular. */
export const REGULAR_TIP_LEFT = 0.5;
/** How many regulars the town remembers, and the chance a new customer is one of them. */
export const MAX_REGULARS = 4;
export const REGULAR_CHANCE = 0.3;
/** What a regular pays on top of the price for each potion. */
export const REGULAR_BONUS = 3;

/**
 * The weather, one kind a day, from the almanac: rain makes plants grow half again as fast, a
 * drought slows them to 60%, a fair day brings customers half again as often, and a mild day changes
 * nothing.
 */
export type Weather = 'mild' | 'rain' | 'fair' | 'drought';
export const WEATHER: Record<Weather, { name: TextKey; today: TextKey; growth: number; customers: number }> = {
  mild: { name: 'mild', today: 'mildToday', growth: 1, customers: 1 },
  rain: { name: 'rain', today: 'rainToday', growth: 1.5, customers: 1 },
  fair: { name: 'fair', today: 'fairToday', growth: 1, customers: 1.5 },
  drought: { name: 'drought', today: 'droughtToday', growth: 0.6, customers: 1 },
};
/** The almanac's week of weather from the second day on, round and round. */
const FORECAST: Weather[] = ['rain', 'fair', 'drought', 'fair', 'rain', 'mild', 'fair'];
/** The weather on `day`, the same in every game, like an almanac's forecast: the first day is mild. */
export const weatherFor = (day: number): Weather => (day <= 1 ? 'mild' : FORECAST[(day - 2) % FORECAST.length]);

/** Every fourth day is a market day, when a crowd comes in at midday. */
export const MARKET_EVERY = 4;
export const isMarketDay = (day: number) => day % MARKET_EVERY === 0;
/** How many customers a market day's crowd brings, and what each pays into the bonus if all are served. */
export const RUSH_SIZE = 5;
export const RUSH_BONUS = 6;
/** How fast belts run, and so how many items they carry a second: half again per belt level. */
export const beltSpeed = (state: GameState) => 1 + 0.5 * state.upgrades.belts.level;
/** What customers pay for a potion: a quarter more per price level and `SEAL_PRICE` more per town seal, rounded. */
export const potionPrice = (state: GameState, potion: PotionId) =>
  Math.round(POTION_PRICE[potion] * (1 + 0.25 * state.upgrades.prices.level) * (1 + SEAL_PRICE * (state.seals ?? 0)));

/** A shelf can hold this many of a potion before an overstocked shop starts selling it cheaper. */
export const STOCK_FREE = 5;
/** The cut on a potion sold from a full shelf. */
export const MAX_STOCK_CUT = 0.5;
/**
 * What share of a potion's pay a customer gives when `stocked` of its kind (plain or fine, the one
 * sold included) stand on its shelf, which holds `capacity`: full pay up to `STOCK_FREE`, then less
 * in even steps down to `1 - MAX_STOCK_CUT` on a full shelf.
 */
export const stockFactor = (stocked: number, capacity: number) =>
  1 - MAX_STOCK_CUT * Math.min(1, Math.max(0, stocked - STOCK_FREE) / Math.max(1, capacity - STOCK_FREE));

/** What a customer agreed to pay for a potion, lowered by the stock of it in the shop; at least a coin. */
export const stockedPay = (pay: number, stocked: number, capacity: number) => Math.max(1, Math.round(pay * stockFactor(stocked, capacity)));

/** How many items the doctor carries: four, and one more per pack level. */
export const carryCapacity = (state: GameState) => 4 + gearLevel(state, 'pack');
/** The most a pack can hold, for laying out the carry slots: the apothecary's levels and one a town shop. */
export const MAX_CARRY = 4 + UPGRADES.pack.max + SHOP_IDS.length;
/** Walking speed multiplier: a fifth faster per boots level. */
export const walkSpeed = (state: GameState) => 1 + 0.2 * gearLevel(state, 'boots');
/** Harvest reach in character heights: one, and a quarter more per sickle level. */
export const harvestReach = (state: GameState) => 1 + 0.25 * gearLevel(state, 'sickle');
/** A piece of the doctor's gear's level: the apothecary's outfitter's, plus one for each town shop's bought. */
export function gearLevel(state: GameState, gear: Gear) {
  let level = state.upgrades[gear].level;
  for (const id of SHOP_IDS) level += state.town.shops[id]?.outfitter[gear].level ?? 0;
  return level;
}
/**
 * Every station keeps each kind of goods coming in or going out on its own pallet, two by two items
 * on the base, and the shop each potion on its own shelf. A pallet or shelf holds `STORAGE_START` of
 * its kind, and `STORAGE_STEP` more per level of the guild's storage upgrade, up to `PALLET_SIZE`:
 * ten layers high.
 */
export const PALLET_BASE = 4;
export const PALLET_LAYERS = 10;
export const PALLET_SIZE = PALLET_BASE * PALLET_LAYERS;
export const STORAGE_START = 10;
export const STORAGE_STEP = 10;
/** How many of a kind each pallet and shelf holds. */
export const storage = (state: GameState) => Math.min(PALLET_SIZE, STORAGE_START + STORAGE_STEP * state.upgrades.storage.level);
/** Whether the pallet (or shelf) for `item` in a station's tray has room for one more. */
export const palletHasRoom = (state: GameState, tray: readonly ItemId[], item: ItemId) => tray.filter((id) => id === item).length < storage(state);

/** Bumped whenever stations or walls move, so a loaded save doesn't put the doctor inside one. */
export const LAYOUT = 6;
/** The layout from which goods get on a belt at the start of their own run, such as a feeder. */
export const FEEDERS_LAYOUT = 3;
/** The layout from which the map has two columns, with shorter belts. */
export const COLUMNS_LAYOUT = 5;
/** The layout from which the shop stands in the middle and the lines run sideways into it, with shorter routes. */
export const HEART_LAYOUT = 6;

/** Coins needed to build each belt. */
export const BELT_COST: Record<BeltId, number> = { garden: 60, refiner: 100, cauldron: 150, garden2: 60, refiner2: 100, cauldron2: 150 };
/** How long an item takes from one end of each belt to the other in a one-lane belt: about 100 pixels a second. */
export const BELT_MS: Record<BeltId, number> = { garden: 2_500, refiner: 400, cauldron: 540, garden2: 2_500, refiner2: 400, cauldron2: 540 };
/** `BELT_MS` while the map had two columns, for moving goods saved on a belt then. */
export const COLUMNS_BELT_MS: Record<BeltId, number> = { garden: 2_100, refiner: 640, cauldron: 5_900, garden2: 2_100, refiner2: 640, cauldron2: 5_900 };
/** `BELT_MS` before the map went to two columns, for moving goods saved on a belt then. */
export const U_BELT_MS: Record<BeltId, number> = { garden: 3_500, refiner: 1_500, cauldron: 6_000, garden2: 3_500, refiner2: 1_500, cauldron2: 6_000 };
/** The stations a belt joins, which must both stand before it can be built. */
export const BELT_ENDS: Record<BeltId, StationId[]> = {
  garden: ['refiner'],
  refiner: ['refiner', 'cauldron'],
  cauldron: ['cauldron', 'counter'],
  garden2: ['refiner2'],
  refiner2: ['refiner2', 'cauldron2'],
  cauldron2: ['cauldron2', 'counter'],
};
/** Whether any of the second line's fields, its shade garden included, is built, for its garden belt to pick from. */
export const anyFieldBuilt = (state: GameState) => state.expansion.fields.some((f) => f.built) || !!state.shade[1]?.built;
/** The second line's garden belt also needs one of its fields to pick from. */
export const beltBuildable = (state: GameState, id: BeltId) =>
  BELT_ENDS[id].every((station) => stationBuilt(state, station)) && (id !== 'garden2' || anyFieldBuilt(state));
/** Coins for entry to the guild, which puts its upgrades up for sale. */
export const GUILD_COST = 50;

/**
 * Everything bought with coins, as one key each: an upgrade's levels, a station's craftsmen, a belt,
 * the guild's entry and the expansion's land.
 */
export type Unlock = `level-${UpgradeId}` | `hire-${StationId}` | `belt-${BeltId}` | 'guild' | 'land' | 'shade';

/**
 * What must be bought first before each thing goes up for sale. The first steps are one chain, a
 * thing at a time; from the garden belt on, the shop branches out. Unlisted things (the second
 * line's, which wait for their station) are for sale from the start.
 */
export const UNLOCKED_BY: Partial<Record<Unlock, Unlock>> = {
  'level-pack': 'level-refiner',
  'level-cauldron': 'level-pack',
  'hire-counter': 'level-cauldron',
  'belt-garden': 'hire-counter',
  'level-boots': 'belt-garden',
  'level-sickle': 'belt-garden',
  'level-counter': 'belt-garden',
  'hire-refiner': 'belt-garden',
  'hire-cauldron': 'belt-garden',
  'belt-refiner': 'belt-garden',
  guild: 'belt-garden',
  shade: 'belt-garden',
  'belt-cauldron': 'belt-refiner',
  land: 'belt-cauldron',
  'level-growth': 'guild',
  'level-prices': 'guild',
  'level-belts': 'guild',
  'level-storage': 'guild',
  'level-customers': 'level-prices',
  'level-slots': 'level-customers',
  'level-research': 'belt-garden',
  'level-craftOrder': 'belt-garden',
  'level-priceSigns': 'belt-garden',
  'level-replant': 'belt-garden',
  'level-herbalist': 'level-growth',
};

/** The coins paid towards a thing so far, and whether at least its first level or build is done. */
function progress(state: GameState, key: Unlock): { done: boolean; paid: number } {
  if (key === 'guild') return { done: state.guild.built, paid: state.guild.paid };
  if (key === 'land') return { done: state.expansion.land.built, paid: state.expansion.land.paid };
  if (key === 'shade') return { done: state.shade[0].built, paid: state.shade[0].paid };
  const [kind, id] = key.split(/-(.+)/) as [string, string];
  if (kind === 'belt') return { done: state.belts[id as BeltId].built, paid: state.belts[id as BeltId].paid };
  const upgrade = kind === 'hire' ? state.craftsmen[id as StationId] : state.upgrades[id as UpgradeId];
  return { done: upgrade.level > 0, paid: upgrade.paid };
}

/** Whether a thing is for sale: what unlocks it is bought, or it was started before it was locked. */
export function unlocked(state: GameState, key: Unlock): boolean {
  const own = progress(state, key);
  const by = UNLOCKED_BY[key];
  return !by || own.done || own.paid > 0 || progress(state, by).done;
}

/** Coins needed for the expansion's land, each field, the refining table and the cauldron. */
export const EXPANSION_COST = { land: 100, field: 25, refiner: 50, cauldron: 75 };
/** How long a craftsman takes to hand a customer one potion; the doctor hands them over at once. */
export const SERVE_MS = 1_500;

/**
 * Tips decay: a customer tips their whole `tip` when served at once, less the longer they wait at the
 * counter, down to nothing once `TIP_SHARE` of their patience is gone.
 */
export const TIP_SHARE = 0.6;
/** A customer's most generous tip: a coin, and two more per potion in their order. */
export const maxTip = (potions: number) => 1 + 2 * potions;
/** A customer's order as far as tips go, the apothecary's or a town shop's. */
type Tipping = Pick<Order, 'patience' | 'maxPatience' | 'tip'>;
/** How much of its tip an order still pays, from 1 when the customer reaches the counter down to 0. */
export const tipLeft = (order: Tipping) => Math.max(0, Math.min(1, 1 - (order.maxPatience - order.patience) / (order.maxPatience * TIP_SHARE)));
/** The tip an order pays if its last potion is handed over now. */
export const tipNow = (order: Tipping) => Math.round((order.tip ?? 0) * tipLeft(order));

/** A day lasts four minutes of play, dawn to dusk; the contract rolls over at dusk. */
export const DAY_MS = 240_000;
/** The most potions a contract asks for. */
export const MAX_CONTRACT = 12;
/** Rounds to the nearest 5 coins, at least 5. */
const roundFive = (n: number) => Math.max(5, Math.round(n / 5) * 5);

/** From this day contracts draw from every potion customers ask for, not only the two known from the start. */
export const BOOK_CONTRACT_DAY = 3;
/** Every `BUNDLE_EVERY`th day from `BOOK_CONTRACT_DAY` on (days 4, 7, 10, ...) asks for two potions at once. */
export const BUNDLE_EVERY = 3;
/** The share of what the potions sell for a contract pays: more for potions brewed with nightshade. */
export const CONTRACT_SHARE = 0.45;
export const NIGHTSHADE_CONTRACT_SHARE = 0.6;

/**
 * The contract for `day`: three potions and one more for each contract kept before (up to
 * `MAX_CONTRACT`), for a reward of about nine twentieths of what they sell for (three fifths for a
 * nightshade potion): 3 Sleeping Tonics for 20 coins on day one. The first days alternate Sleeping
 * Tonics and Healing Draughts; from `BOOK_CONTRACT_DAY` the potion goes round every one customers
 * ask for, and on a bundle day the potions are split between two of them. It is the same in every
 * game with the same recipes, so it uses no randomness.
 */
export function contractFor(state: GameState, day: number, kept: number): Contract {
  const total = Math.min(MAX_CONTRACT, 3 + kept);
  const book = orderable(state);
  const share = (potion: PotionId) => (NEEDS_NIGHTSHADE.includes(potion) ? NIGHTSHADE_CONTRACT_SHARE : CONTRACT_SHARE);
  if (day < BOOK_CONTRACT_DAY || book.length === 0) {
    const potion: PotionId = day % 2 === 1 ? 'sleepingTonic' : 'healingDraught';
    return { day, potion, need: total, made: 0, reward: roundFive(total * potionPrice(state, potion) * share(potion)), dayLeft: DAY_MS, kept };
  }
  const first = (day * 5 + 3) % book.length;
  const potion = book[first];
  if ((day - BOOK_CONTRACT_DAY) % BUNDLE_EVERY !== 1 || book.length < 2) {
    return { day, potion, need: total, made: 0, reward: roundFive(total * potionPrice(state, potion) * share(potion)), dayLeft: DAY_MS, kept };
  }
  const second = book[(first + 1 + (day % (book.length - 1))) % book.length];
  const need = Math.ceil(total / 2);
  const need2 = total - need;
  const reward = roundFive(need * potionPrice(state, potion) * share(potion) + need2 * potionPrice(state, second) * share(second));
  return { day, potion, need, made: 0, reward, dayLeft: DAY_MS, kept, bundle: { potion: second, need: need2, made: 0 } };
}
/** Whether a potion sold now counts towards today's contract. */
export const contractWants = (contract: Contract, potion: PotionId) =>
  (contract.potion === potion && contract.made < contract.need) || (contract.bundle?.potion === potion && contract.bundle.made < contract.bundle.need);
/**
 * The plague: from `PLAGUE_DAY` a sickness spreads through the town in stages. Each stage asks for
 * `need` potions sold at the counter (any kind on the last stage) within `PLAGUE_STAGE_MS`; a stage
 * met moves the sickness on to the next, a stage missed comes back asking for `PLAGUE_RELAPSE_EXTRA`
 * more and costs reputation. Past the last stage the Panacea is unlocked: brewing it cures the town
 * and wins the game, and trade goes on after.
 */
export interface Plague {
  /** The stage, from 0; `PLAGUE_STAGES.length` once every stage is met and the Panacea is unlocked. */
  stage: number;
  need: number;
  made: number;
  /** Milliseconds left to meet the stage. */
  left: number;
  /** How often a stage was missed and came back worse. */
  relapses: number;
  /** Set once the Panacea is brewed: the town is cured. */
  cured: boolean;
  /** Which outbreak this is: 0 (or missing) for the first, then one more each season after a cure. */
  season?: number;
  /** The day the town was cured; the next season's outbreak comes `SEASON_GAP` days later. */
  curedDay?: number;
  /** False from the cure until the plague card has told it, so a cure brewed in the town is told after a reload too; missing means told. */
  told?: boolean;
}
export const PLAGUE_DAY = 5;
export const PLAGUE_STAGE_MS = 3 * DAY_MS;
export const PLAGUE_STAGES: { potion: PotionId | null; need: number }[] = [
  { potion: 'healingDraught', need: 6 },
  { potion: 'sleepingTonic', need: 6 },
  { potion: null, need: 10 },
];
export const PLAGUE_RELAPSE_EXTRA = 2;
export const PLAGUE_RELAPSE_REPUTATION = 10;
/** The most a relapsed stage asks for. */
export const MAX_PLAGUE_NEED = 16;
/**
 * Seasons of sickness: `SEASON_GAP` days after each cure a new, stronger outbreak comes, asking for
 * the nightshade potions learned at the study, and each needing `SEASON_EXTRA` more per season.
 * Curing one earns a town seal, which raises every potion's price by `SEAL_PRICE`.
 */
export const SEASON_GAP = 5;
export const SEASON_EXTRA = 2;
export const SEAL_PRICE = 0.1;
export const SEASON_STAGES: { potion: PotionId | null; need: number }[] = [
  { potion: 'moonlightSalve', need: 6 },
  { potion: 'witchsBrew', need: 6 },
  { potion: null, need: 12 },
];
/** The stages of an outbreak: the first season's, then the stronger ones of every season after. */
export const stagesFor = (season = 0) =>
  season === 0 ? PLAGUE_STAGES : SEASON_STAGES.map((s) => ({ ...s, need: Math.min(MAX_PLAGUE_NEED, s.need + SEASON_EXTRA * (season - 1)) }));
/**
 * The plague stage at hand, or null before the plague, once the Panacea is unlocked, or after the
 * cure. A stage asking for a potion customers can't get yet takes potions of any kind instead.
 */
export const plagueStage = (state: GameState) => {
  const plague = state.plague;
  if (!plague || plague.cured) return null;
  const stage = stagesFor(plague.season)[plague.stage];
  if (!stage) return null;
  return stage.potion && !orderable(state).includes(stage.potion) ? { ...stage, potion: null } : stage;
};
/** Whether the cauldrons may brew the Panacea: every stage is met and the town is still sick. */
export const panaceaUnlocked = (state: GameState) => !!state.plague && state.plague.stage >= stagesFor(state.plague.season).length && !state.plague.cured;
/** The plague at `stage` of `season`, fresh. */
export const plagueAt = (stage: number, relapses = 0, extra = 0, season = 0): Plague => ({
  stage,
  need: Math.min(MAX_PLAGUE_NEED, (stagesFor(season)[stage]?.need ?? 0) + extra),
  made: 0,
  left: PLAGUE_STAGE_MS,
  relapses,
  cured: false,
  ...(season > 0 ? { season } : {}),
});

/**
 * The merchant wagon: on a wagon day (every `WAGON_EVERY`th day from `WAGON_DAY`) a wagon stops at
 * the street door from mid-morning for `WAGON_MS`, wanting a whole crate of `WAGON_CRATE` of one
 * potion at `WAGON_PREMIUM` times its price each. A tap on it sells the crate from the shelf, if the
 * shelf holds that many; the sale counts for no contract, plague stage or rival.
 */
export interface Wagon {
  day: number;
  potion: PotionId;
  crate: number;
  /** What the wagon pays for each potion of the crate. */
  pay: number;
  /** Milliseconds before it drives off. */
  left: number;
  sold: boolean;
}
export const WAGON_DAY = 6;
export const WAGON_EVERY = 3;
export const WAGON_CRATE = 8;
export const WAGON_PREMIUM = 1.6;
export const WAGON_MS = 90_000;
/** How much of the day is left when the wagon pulls up. */
export const WAGON_ARRIVES = 0.7;
export const isWagonDay = (day: number) => day >= WAGON_DAY && day % WAGON_EVERY === 0;
/** The wagon for `day`: the same in every game, going round what customers ask for. */
export const wagonFor = (state: GameState, day: number): Wagon | null => {
  const potions = orderable(state);
  const potion = potions[(day * 11 + 1) % potions.length];
  if (!potion) return null;
  return { day, potion, crate: WAGON_CRATE, pay: Math.round(potionPrice(state, potion) * WAGON_PREMIUM), left: WAGON_MS, sold: false };
};
/** Whether the wagon waits at the street door now. */
export const wagonHere = (state: GameState) => !!state.wagon && !state.wagon.sold && state.wagon.left > 0 && state.wagon.day === state.contract.day;

/**
 * The herb market at the outfitter: the doctor buys plants and refined goods for coins, or sells
 * them, at prices that move with the day and the weather. Rain makes plants cheap and a drought
 * dear; refined goods follow at half the swing. It opens with the garden pixies.
 */
export type HerbId = PlantId | RefinedId;
export const HERBS: readonly HerbId[] = [...PLANTS, ...REFINED];
export const HERB_PRICE: Record<HerbId, number> = { wheat: 2, mandrake: 3, nightshade: 6, flour: 4, mandrakeSeeds: 5, nightshadeExtract: 9 };
const HERB_WEATHER: Record<Weather, number> = { mild: 1, rain: 0.7, fair: 1, drought: 1.6 };
/** What the market sells a good for today, at least a coin. */
export const herbBuyPrice = (day: number, herb: HerbId) => {
  const plant = (PLANTS as readonly string[]).includes(herb);
  const weather = HERB_WEATHER[weatherFor(day)];
  // A day's swing of up to a fifth either way, the same in every game.
  const swing = 0.8 + 0.4 * (((day * 7 + HERBS.indexOf(herb) * 3) % 11) / 10);
  return Math.max(1, Math.round(HERB_PRICE[herb] * swing * (plant ? weather : 1 + (weather - 1) / 2)));
};
/** What the market pays for a good today: three fifths of what it sells it for, at least a coin. */
export const herbSellPrice = (day: number, herb: HerbId) => Math.max(1, Math.floor(herbBuyPrice(day, herb) * 0.6));
export const marketOpen = (state: GameState) => state.belts.garden.built;

/**
 * Price signs: each shelf sells Cheap, Fair or Dear. A cheap potion pays `SIGN_PAY` of the price,
 * is asked for `SIGN_DEMAND` times as often and makes the street think `SIGN_REPUTATION` better of
 * the shop a sale; a dear one pays about 40% more, but a customer waiting for one loses patience
 * `SIGN_PATIENCE` times as fast.
 */
export type PriceSign = 'cheap' | 'fair' | 'dear';
export const PRICE_SIGNS: PriceSign[] = ['cheap', 'fair', 'dear'];
export const SIGN_NAMES: Record<PriceSign, TextKey> = { cheap: 'cheap', fair: 'fairSign', dear: 'dear' };
/** What a tap on a price sign says, with the potion's name. */
export const SIGN_SET: Record<PriceSign, TextKey> = { cheap: 'cheapSet', fair: 'fairSet', dear: 'dearSet' };
export const SIGN_PAY: Record<PriceSign, number> = { cheap: 0.75, fair: 1, dear: 1.4 };
export const SIGN_DEMAND: Record<PriceSign, number> = { cheap: 2, fair: 1, dear: 1 };
export const SIGN_REPUTATION: Record<PriceSign, number> = { cheap: 2, fair: 0, dear: 0 };
export const SIGN_PATIENCE: Record<PriceSign, number> = { cheap: 1, fair: 1, dear: 1.5 };
/** The sign on a potion's shelf: Fair unless changed. */
export const signOf = (state: GameState, potion: PotionId): PriceSign => (studied(state, 'priceSigns') && state.signs[potion]) || 'fair';
/** How fast an order's patience runs out: faster while any potion it still wants is sold dear. */
export const patienceRate = (state: GameState, order: Order) => Math.max(1, ...order.wants.map((p) => SIGN_PATIENCE[signOf(state, p)]));

/**
 * Blight: from `BLIGHT_DAY`, rain can blight a bed (one about every `BLIGHT_EVERY_MS` on a rainy
 * day). A blighted bed stops growing and blights a neighbour in its garden every `BLIGHT_SPREAD_MS`
 * until the doctor's sickle clears it, after which it grows again from seed. The guild's herbalist
 * makes every bed immune.
 */
export const BLIGHT_DAY = 3;
export const BLIGHT_EVERY_MS = 45_000;
export const BLIGHT_SPREAD_MS = 40_000;
export const blightImmune = (state: GameState) => state.upgrades.herbalist.level > 0;
/** The beds next to a bed in its garden's three by three: above, below, left and right. */
export const plotNeighbours = (plot: number) => {
  const garden = gardenOf(plot), slot = plot % PLOTS_PER_GARDEN;
  const col = slot % 3, row = Math.floor(slot / 3);
  const near: number[] = [];
  if (col > 0) near.push(plot - 1);
  if (col < 2) near.push(plot + 1);
  if (row > 0) near.push(plot - 3);
  if (row < 2) near.push(plot + 3);
  return near.filter((p) => gardenOf(p) === garden);
};

/**
 * The rival shop across the street: from `RIVAL_DAY` it undercuts one potion a day, so customers
 * pay `RIVAL_CUT` less for a plain one (a Fine one beats the cut), and sells `RIVAL_SALES` of it a
 * day itself. Sell more of that potion than the rival each day for `RIVAL_MONTH_DAYS` days running
 * and it closes for good.
 */
export interface Rival {
  open: boolean;
  /** The day its undercut potion was picked for; a new day picks again. */
  day: number;
  /** The potion it undercuts today, or null before `RIVAL_DAY` and once closed. */
  potion: PotionId | null;
  /** How many of that potion the shop has sold today. */
  sold: number;
  /** Days running the shop has outsold the rival. */
  streak: number;
  /** How much of today went by before a kept contract ended it early; unset for a day that runs to dusk. */
  dayShare?: number;
}
export const RIVAL_DAY = 4;
export const RIVAL_CUT = 0.3;
export const RIVAL_SALES = 4;
export const RIVAL_MONTH_DAYS = 10;
/** Whether the rival undercuts a potion today. */
export const rivalUndercuts = (state: GameState, potion: PotionId) => state.rival.open && state.rival.potion === potion;
/** The potion the rival undercuts on `day`: the same in every game, going round what customers ask for. */
export const rivalPotionFor = (state: GameState, day: number): PotionId | null => {
  if (day < RIVAL_DAY) return null;
  const potions = orderable(state);
  return potions[(day * 7 + 2) % potions.length] ?? null;
};

/** Least time between two items in a belt's lane, so they don't overlap. */
export const BELT_GAP_MS = 600;
/**
 * Each belt has a lane for every kind of goods it carries, side by side: plants from the gardens,
 * refined goods from the tables, potions from the cauldrons. Goods in one lane don't wait for the
 * other's.
 */
export const BELT_LANES: Record<BeltId, readonly ItemId[]> = {
  garden: PLANTS,
  refiner: REFINED,
  cauldron: POTIONS,
  garden2: PLANTS,
  refiner2: REFINED,
  cauldron2: POTIONS,
};

/** Work-speed multiplier for the refining table and cauldron. */
export const speedAt = (level: number) => 1 + 0.5 * level;

const unbuilt = (): Build => ({ built: false, paid: 0 });

export function createInitialState(): GameState {
  const ripe = (plant: PlantId): Plot => ({ plant, grown: GROW_MS[plant] });
  const state: GameState = {
    version: 3,
    layout: LAYOUT,
    coins: 0,
    carrying: [],
    // On the forecourt north of the shop (see src/scenes/layout.ts), between the two lines.
    player: { x: 840, y: 150 },
    // Start ripe so the first harvest can happen right away.
    plots: GARDENS.flatMap((plant) => Array.from({ length: PLOTS_PER_GARDEN }, () => ripe(plant))),
    refiner: { queue: [], progress: 0, output: [], second: null },
    cauldron: { contents: [], brewing: null, brewing2: null, output: [] },
    refiner2: { queue: [], progress: 0, output: [], second: null },
    cauldron2: { contents: [], brewing: null, brewing2: null, output: [] },
    counter: { shelf: [], till: 0 },
    guild: unbuilt(),
    expansion: { land: unbuilt(), fields: [unbuilt(), unbuilt()], refiner: unbuilt(), cauldron: unbuilt() },
    shade: [unbuilt(), unbuilt()],
    upgrades: Object.fromEntries(UPGRADE_IDS.map((id) => [id, { level: 0, paid: 0 }])) as Record<UpgradeId, Upgrade>,
    craftsmen: Object.fromEntries(STATIONS.map((id) => [id, { level: 0, paid: 0 }])) as Record<StationId, Upgrade>,
    belts: Object.fromEntries(BELTS.map((id) => [id, { ...unbuilt(), items: [] }])) as unknown as Record<BeltId, Belt>,
    priority: { refiner: null, refiner2: null, cauldron: null, cauldron2: null },
    orders: [],
    nextOrderIn: 3_000,
    nextOrderId: 1,
    // Filled in below, once the state it prices from exists.
    contract: null as unknown as Contract,
    sold: 0,
    tips: 0,
    lastSeen: 0,
    reputation: START_REPUTATION,
    regulars: [],
    rush: null,
    plague: null,
    signs: {},
    rival: { open: true, day: 0, potion: null, sold: 0, streak: 0 },
    seals: 0,
    wagon: null,
    marketPick: 'flour',
    town: createTown(),
  };
  state.contract = contractFor(state, 1, 0);
  return state;
}
