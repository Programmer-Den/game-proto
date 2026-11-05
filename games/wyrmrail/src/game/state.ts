import type { TextKey } from '../i18n';
import type { Cargo, Tile, Valley, ValleyKind } from './map';

// Tuning numbers and the shape of a game. The rules that move it on are in sim.ts.

export const START_COINS = 40;
export const START_HEARTS = 3;
/** Most orders on the board at once. */
export const MAX_ORDERS = 3;
/** How often a new order comes in while the board has room. */
export const ORDER_EVERY_MS = 7_000;
/** An order's pay: a base plus so much per tile between the two villages (as the crow flies). */
export const PAY_BASE = 10;
export const PAY_PER_TILE = 3;
/** An order's time on Normal: a base plus so much per tile. Scaled by difficulty. */
export const DEADLINE_BASE_MS = 20_000;
export const DEADLINE_PER_TILE_MS = 5_000;
/** How long the wyrm takes to load cargo at a village. */
export const LOAD_MS = 800;
/** How many orders the wyrm can carry at once: one in each wagon. */
export const WAGONS = 2;
/** How long the wyrm stops to throw a switch, when the switches leave it no way to its stop. */
export const SWITCH_MS = 1_000;
/** The wyrm's belly: full is 1, and each tile it crosses costs this much. */
export const FOOD_PER_TILE = 1 / 36;
/** At or below this, the wyrm flies to the Roost to eat before its next stop. */
export const HUNGRY = 0.3;
/** How long it eats at the Roost, and how much slower it flies on an empty belly. */
export const EAT_MS = 1_200;
export const STARVING_SLOWDOWN = 0.5;
/** A wyrm waits this long at most for the other to clear a junction ahead, then goes on anyway. */
export const JUNCTION_WAIT_MS = 3_000;
/** A workshop's goods pay this many times an ordinary order over the same distance. */
export const WORKSHOP_PAY = 1.6;
/** How often an order whose cargo a workshop takes goes to that workshop. */
export const WORKSHOP_CHANCE = 0.5;
/** The round the second wyrm can be bought in. */
export const SECOND_WYRM_ROUND = 5;
/** The last round: the festival at the last village, after every village has joined. */
export const FESTIVAL_ROUND = 9;
export const FESTIVAL_GOAL = 10;
/** The wyrm's speed in tiles per second, and what each Swift wings level adds. */
export const BASE_SPEED = 2;
export const WINGS_SPEED = 0.6;
/** What each Golden hoard level adds to every order's pay. */
export const HOARD_BONUS = 0.25;
/** The price of each upgrade level; the length is the top level. */
export const UPGRADE_COSTS = { wings: [30, 60, 100], hoard: [40, 80, 140], second: [150] } as const;
export type Upgrade = keyof typeof UPGRADE_COSTS;
/** Village moods (WR6), from `MOOD_ROUND`: how far a mood runs, each way from 0. */
export const MOOD_ROUND = 2;
export const MOOD_MAX = 2;
/** A village with no visit for this long, plus so much for every village on the line, sours by one. */
export const MOOD_GAP_MS = 25_000;
export const MOOD_GAP_PER_VILLAGE_MS = 6_000;
/** What a cheerful (1) and a delighted (2) village's orders pay, times the usual. */
export const MOOD_PAY = [1, 1.25, 1.5];
/** How much time a sulking village's orders allow, times the usual. */
export const MOOD_RUSH = 0.7;
/** Washouts and rockfalls (WR7), from `HAZARD_ROUND`: how often one is warned, and how long the warning lasts. */
export const HAZARD_ROUND = 3;
export const HAZARD_EVERY_MS = 35_000;
export const HAZARD_WARN_MS = 9_000;
/** Round charters (WR9), from this round: one of two, picked at the round's start. */
export const CHARTER_ROUND = 3;
/** Passengers (WR10), from this round: how often an order is passengers, what they pay and how long they wait. */
export const PASSENGER_ROUND = 3;
export const PASSENGER_CHANCE = 0.15;
export const PASSENGER_PAY = 3;
export const PASSENGER_TIME = 0.6;
/** Depots (WR11), from `DEPOT_ROUND`: the first one's price and what each one after it adds. */
export const DEPOT_ROUND = 2;
export const DEPOT_COST = 60;
export const DEPOT_STEP = 30;
/** How fast goods waiting at a depot use up their time, times the usual. */
export const DEPOT_WAIT = 0.5;
/** Courier calls (WR13), once moods count: what the gifts cost. */
export const COURIER_COST = 5;
/** Festival medals (WR14): a gold medal wants every heart and the festival in this time, silver two hearts and this time. */
export const GOLD_MS = 150_000;
export const SILVER_MS = 240_000;
/** How many rounds earlier the second wyrm wakes with the gold medal's Early riser boon. */
export const EARLY_RISER_ROUNDS = 2;
/** The coins the bronze medal's Head start boon adds to the start. */
export const HEAD_START_COINS = 25;
/** A chain of valleys (WR15): what a valley's local goods pay, times the usual. */
export const LOCAL_PAY = 1.3;
/** How much more a wyrm eats per tile in the snowy valley's cold. */
export const COLD_HUNGER = 1.4;
/** How often a canyon's rockfalls come, times the usual. */
export const CANYON_HAZARDS = 0.6;
/** The kind of each valley after the first, in turn: snowy, marsh, canyon, then round again. */
export const CHAIN_KINDS: ValleyKind[] = ['snow', 'marsh', 'canyon'];
/** The valley kind of the `leg`th valley of a chain (1 is the meadow). */
export const kindOfLeg = (leg: number): ValleyKind => (leg <= 1 ? 'meadow' : CHAIN_KINDS[(leg - 2) % CHAIN_KINDS.length]);
/** Each valley kind's name, its banner line on arriving and its hazard, as keys of `i18n/en.ts`. */
export const KIND_TEXT: Record<ValleyKind, { name: TextKey; intro: TextKey }> = {
  meadow: { name: 'meadowName', intro: 'meadowIntro' },
  snow: { name: 'snowName', intro: 'snowIntro' },
  marsh: { name: 'marshName', intro: 'marshIntro' },
  canyon: { name: 'canyonName', intro: 'canyonIntro' },
};

/** Moults (WR16): the rounds the wyrm moults at the start of, offering this many of the traits it lacks. */
export const MOULT_ROUNDS = [4, 7];
export const MOULT_OFFER = 3;
/** The lasting traits a moult can give the wyrms, for the rest of the game and the valleys after it. */
export const TRAITS = ['swift', 'wagon', 'frugal', 'nimble', 'charming'] as const;
export type Trait = (typeof TRAITS)[number];
/** Each trait's name and card text, as keys of `i18n/en.ts`. */
export const TRAIT_TEXT: Record<Trait, { name: TextKey; text: TextKey }> = {
  swift: { name: 'traitSwift', text: 'traitSwiftText' },
  wagon: { name: 'traitWagon', text: 'traitWagonText' },
  frugal: { name: 'traitFrugal', text: 'traitFrugalText' },
  nimble: { name: 'traitNimble', text: 'traitNimbleText' },
  charming: { name: 'traitCharming', text: 'traitCharmingText' },
};
/** Swift's added speed in tiles a second, Frugal's appetite, Nimble's load and switch time and Charming's patience, times the usual. */
export const TRAIT_SPEED = 0.5;
export const FRUGAL_HUNGER = 0.6;
export const NIMBLE_TIME = 0.5;
export const CHARMING_GAP = 1.5;

/** Villages that grow (WR18), from `TOWN_ROUND`: deliveries in time a village needs to grow into a town. */
export const TOWN_ROUND = 2;
export const GROW_AT = 4;
/** A town's orders pay this many times a village's, and are its wares this often. */
export const TOWN_PAY = 1.3;
export const WARES_CHANCE = 0.35;
/** Wares pay this many times the town's own goods. */
export const WARES_PAY = 1.4;
/** A town's warehouse: its price. Goods waiting there that run late go back in store, costing no heart. */
export const WAREHOUSE_COST = 50;
/** Night rounds (WR19): which rounds fly at night, and from when lamps can be hung on the line. */
export const NIGHT_ROUNDS = [5, 8];
export const LAMP_ROUND = 3;
export const LAMP_COST = 4;
/** How fast a wyrm flies over unlit track at night, times the usual. */
export const DARK_SLOWDOWN = 0.5;
/** A rival line (WR20), from `RIVAL_ROUND` until the festival: how often it lays a tile, how long it takes to win an order, and its rest after one. */
export const RIVAL_ROUND = 3;
export const RIVAL_BUILD_MS = 5_000;
export const RIVAL_CLAIM_MS = 9_000;
export const RIVAL_REST_MS = 5_000;
/** Taking over a rival's tile costs this many times the usual track price. */
export const RIVAL_BUYOUT = 3;
/** How long a banner and a floating number stay on screen. */
export const BANNER_MS = 2_800;
export const POP_MS = 1_200;

/** Deliveries needed to finish a round. */
export const roundGoal = (round: number) => (round === 1 ? 1 : round === FESTIVAL_ROUND ? FESTIVAL_GOAL : round + 1);

/** A round's charter: its rule for every order, and the odd one for the track or the belly. */
export interface Charter {
  id: string;
  /** Its name and card text, keys of `i18n/en.ts`; the text's `{cargo}` is the charter's cargo. */
  name: TextKey;
  text: TextKey;
  /** Pay, times the usual, for every order or only for `cargo`. */
  pay: number;
  cargo?: Cargo;
  /** Deadlines, times the usual. */
  time: number;
  /** Track prices, times the usual. */
  track?: number;
  /** New orders come in this many times as often. */
  orders?: number;
  /** The wyrms never grow hungry. */
  fed?: boolean;
}

/** The charters a round can offer; `cargo` ones are filled in with a cargo an open village sends. */
export const CHARTERS: Charter[] = [
  { id: 'fair', name: 'fairName', text: 'fairText', pay: 2, cargo: 'grain', time: 0.75 },
  { id: 'rush', name: 'rushName', text: 'rushText', pay: 1.5, time: 0.67 },
  { id: 'patient', name: 'patientName', text: 'patientText', pay: 0.75, time: 1.5 },
  { id: 'rails', name: 'railsName', text: 'railsText', pay: 0.8, time: 1, track: 0.5 },
  { id: 'busy', name: 'busyName', text: 'busyText', pay: 0.9, time: 1, orders: 2 },
  { id: 'feast', name: 'feastName', text: 'feastText', pay: 0.9, time: 1, fed: true },
];

/** A washout (a bridge) or a rockfall (track under a mountain) about to take a tile's track. */
/** The kinds of hazard: a meadow's washouts and rockfalls, a snowy valley's avalanches and a marsh's sinkholes. */
export type HazardKind = 'washout' | 'rockfall' | 'avalanche' | 'sinkhole';
/** Each hazard's warning banner, its pop when it strikes and its hint, as keys of `i18n/en.ts`. */
export const HAZARD_TEXT: Record<HazardKind, { warning: TextKey; pop: TextKey; hint: TextKey }> = {
  washout: { warning: 'washoutWarning', pop: 'washedOut', hint: 'hintWashout' },
  rockfall: { warning: 'rockfallWarning', pop: 'rockfall', hint: 'hintRockfall' },
  avalanche: { warning: 'avalancheWarning', pop: 'avalanche', hint: 'hintAvalanche' },
  sinkhole: { warning: 'sinkholeWarning', pop: 'sinkhole', hint: 'hintSinkhole' },
};

export interface Hazard {
  tile: Tile;
  kind: HazardKind;
  /** Time left before it hits. */
  ms: number;
}

export type OrderStatus = 'waiting' | 'queued' | 'loading' | 'carrying';

export interface Order {
  id: number;
  cargo: Cargo;
  /** Indexes into VILLAGES. */
  from: number;
  to: number;
  pay: number;
  timeLeftMs: number;
  totalMs: number;
  status: OrderStatus;
  /** The wyrm (index into `wyrms`) fetching or carrying it, once one has set off for it. */
  wyrm: number | null;
  /** Made by a workshop from goods the wyrm brought it. */
  made: boolean;
  /** The sending village's mood when the order was made, which set its pay or its time (0 before moods count). */
  mood: number;
}

/** Passengers fill both wagons: a wyrm carrying them loads nothing else. */
export const isPassengers = (o: Order) => o.cargo === 'passengers';

/** A festival medal, worst to best. */
export const MEDALS = ['bronze', 'silver', 'gold'] as const;
export type Medal = (typeof MEDALS)[number];
/** What each medal unlocks for the next game on its difficulty; a better medal keeps the boons below it too. */
/** Bronze's Head start adds `HEAD_START_COINS`, silver's Swift start gives Swift wings 1 and gold's Early riser wakes the second wyrm `EARLY_RISER_ROUNDS` sooner. */
export const BOONS: Record<Medal, { name: TextKey }> = {
  bronze: { name: 'headStart' },
  silver: { name: 'swiftStart' },
  gold: { name: 'earlyRiser' },
};

/** A stop the wyrm is heading for: an order to fetch or deliver, the Roost to eat, or a village to bring gifts to. */
export type Job = { order: number; leg: 'pickup' | 'drop' } | { leg: 'feed' } | { leg: 'visit'; village: number };

export interface Wyrm {
  /** The tile it last stood on. */
  at: Tile;
  /** The tiles still to cross, next one first. */
  path: Tile[];
  /** How far it is from `at` towards `path[0]`, 0 to 1. */
  progress: number;
  /** The tile it stood on before `at`, so a switch knows which arm it came in by. */
  from: Tile | null;
  /** The stop it is heading for. */
  job: Job | null;
  loadMs: number;
  /** Time left throwing a switch before it can go on. */
  switchMs: number;
  /** Its belly, 0 (starving) to 1 (full). */
  food: number;
  /** Time left eating at the Roost. */
  eatMs: number;
  /** How long it has been waiting for the other wyrm to clear the junction ahead. */
  waitMs: number;
}

export interface Pop {
  id: number;
  text: string;
  x: number;
  y: number;
  color: string;
  ms: number;
}

/** The rival company's line (WR20): its yard, its track, and the order it is racing the wyrm for. */
export interface Rival {
  yard: Tile;
  /** Its track, as "c,r" keys; it never joins the wyrm's line. */
  track: string[];
  buildMs: number;
  /** The waiting order it is about to take, and the time left before it does. */
  claim: { order: number; ms: number } | null;
  restMs: number;
  /** Orders it has taken from the board. */
  taken: number;
}

export interface GameState {
  /** `won` once the festival's goal is met. */
  phase: 'play' | 'over' | 'won';
  /** This game's valley. */
  valley: Valley;
  coins: number;
  hearts: number;
  round: number;
  /** Deliveries made this round. */
  delivered: number;
  /** Deliveries made in the whole game. */
  totalDelivered: number;
  /** Tiles with track, as "c,r" keys. */
  track: string[];
  /** What each track tile cost when it was laid, by its key; taking it up refunds half. */
  paid: Record<string, number>;
  orders: Order[];
  /** Order ids sent to the wyrms that no wyrm has set off to fetch yet, first first. */
  queue: number[];
  /** The switch on each junction (track with three or four arms): its key, and the arm it is set against. */
  switches: Record<string, string>;
  /** Pairs of tiles next to each other on the line whose track is not joined ("c,r|c,r", lower key first). */
  cuts: string[];
  /** Track tiles where two straights cross without joining. */
  crossings: string[];
  /** Each village's mood, by its index: `-MOOD_MAX` (bitter) to `MOOD_MAX` (delighted). */
  moods: number[];
  /** How long each village has gone without a visit. */
  idleMs: number[];
  /** The washout or rockfall under way, if any, and the time until the next is warned. */
  hazard: Hazard | null;
  hazardTimerMs: number;
  /** This round's charter, and the two on offer while the player has yet to pick (the game waits). */
  charter: Charter | null;
  charterOffer: Charter[] | null;
  /** The villages with a depot, by index. */
  depots: number[];
  /** Which valley of the chain this is (1 is the first, the meadow) (WR15). */
  leg: number;
  /** The upgrade kept from the last valley, if any, at the level it had there. */
  kept: { upgrade: Upgrade; level: number } | null;
  /** The wyrms' lasting traits from their moults (WR16), kept through the chain. */
  traits: Trait[];
  /** The traits a moult offers while the player has yet to pick (the game waits). */
  moultOffer: Trait[] | null;
  /** Today's daily valley (WR17): the same seeded valley for everyone, with no boons and no chain. */
  daily: boolean;
  /** Deliveries in time to each village (by index), which grow it into a town at `GROW_AT`. */
  growth: number[];
  /** The villages that have grown into towns, and the towns with a warehouse, by index. */
  towns: number[];
  warehouses: number[];
  /** Track tiles with a lamp (WR19), which lights it and the tiles beside it at night. */
  lamps: string[];
  /** A village that grew into a town with its round's last delivery, for the next round's news (until the charter is picked), else null. */
  grewTown: number | null;
  /** The rival line, once it has set up (null before `RIVAL_ROUND`). */
  rival: Rival | null;
  /** The best medal on this difficulty when the game began: its boons and the ones below it apply. */
  boon: Medal | null;
  /** Game time spent in the festival so far, and the medal it earned once won. */
  festivalMs: number;
  medal: Medal | null;
  /** The wyrms on the line: one, then two once the second is bought. */
  wyrms: Wyrm[];
  upgrades: Record<Upgrade, number>;
  /** Time until the next order comes in. */
  orderTimerMs: number;
  banner: { text: string; ms: number } | null;
  pops: Pop[];
  nextId: number;
}
