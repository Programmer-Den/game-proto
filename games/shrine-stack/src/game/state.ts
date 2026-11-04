// The rules of Shrine Stack, in plain TypeScript with no Phaser. A stone swings above the temple;
// a tap drops it. What hangs over the stone below breaks off, so the temple narrows unless the
// drops line up. Every three stones make a tier, and a tier whose stones all landed well is
// balanced and offers a blessing, which favor can reroll. Between tiers favor also buys a slow drop,
// a wider stone or Mason's Grace, and a curse can be taken with a blessing for double favor. From
// tier 2 stones come heavy or light, each tier sets a trial, and a stone can be held in reserve. From
// tier 3 the temple leans with every off-centre drop (too far and the top tier topples), a chain of
// perfect drops grows the stone back, and each break picks the next tier's material. Tier 10 is gilded
// for double favor, and finishing tier 12 crowns the shrine and wins the run; after that the player
// can keep building into the endless sky, where gusts push the falling stone and every tenth tier
// is a sky altar: double favor and a blessing whether it balanced or not. Every temple starts
// under one of two patrons offered, whose rule holds for the whole run. A crown opens the next
// site (a windy cliff, a bobbing lake), each with its own crown height, raises the patron's rank, which
// strengthens their boon, and the daily shrine gives every player the same patron and stones. Crowns
// also bring pilgrims whose favour builds a village (an inn, a well, a mason's yard) that gives later
// temples a head start, later runs can bring rain or snow for more favour, and two players can race
// two temples side by side.

import { byDifficulty } from '../../../../shared/settings';
import type { Rand } from '../../../../shared/daily';
import { BLESSINGS, type BlessingId } from './blessings';
import {
  CHEAPEST,
  CURSES,
  PATRONS,
  SHOP,
  SHOP_INFO,
  TRIALS,
  type CurseId,
  type MaterialId,
  SITE_INFO,
  type PatronId,
  type ShopId,
  type SiteId,
  type StoneKind,
  type TrialId,
  type BuildingId,
  type WeatherId,
} from './catalog';

/** The middle of the temple, in view pixels. */
export const TOWER_X = 590;
/** The plinth the first stone rests on. */
export const PLINTH_W = 260;
/** The width of the first stone. */
export const START_W = 200;
export const STONE_H = 28;
/** How far above the temple's top the next stone swings, from its bottom edge. */
export const DROP_GAP = 120;
/** How far either side of `TOWER_X` the swinging stone's middle travels. */
export const SWING = 250;
/** How fast stones swing on the first tier on Normal, in pixels per second. */
export const BASE_SPEED = 230;
/** Each tier after the first swings this much faster. */
export const TIER_SPEEDUP = 0.05;
/** How much slower each Calm Winds makes the swing. */
export const CALM = 0.85;
/** How fast a dropped stone gains speed, in pixels per second squared. */
export const GRAVITY = 2600;
/** A drop this close to the stone below snaps onto it whole. */
export const PERFECT_PX = 5;
export const STEADY_PX = 6;
export const BROAD_PX = 40;
export const STONES_PER_TIER = 3;
/** A tier is balanced when each of its stones kept at least this share of its width. */
export const BALANCE = 0.75;
/** Favor for a perfect drop on top of the stone's own, and for a balanced tier. */
export const PERFECT_FAVOR = 2;
export const TIER_FAVOR = 5;
/** How many blessings a balanced tier offers. */
export const OFFER_SIZE = 3;
/** A stone that would keep less than this is lost instead. */
export const MIN_W = 6;
/** What a new set of three blessings costs, in favor. */
export const REROLL_COST = 5;
/** The tier whose stones, and whose balance, earn double favor, on the hill: `GILDED_BELOW` tiers under the crown on every site. */
export const GILDED_TIER = 10;
export const GILDED_MULT = 2;
export const GILDED_BELOW = 2;
/** Finishing this tier crowns the shrine on the hill and wins the run; each site has its own (`SITE_INFO`). */
export const GOAL_TIER = 12;
/** Sky altars: every `ALTAR_EVERY`th tier past the crown (22, 32, ...) earns `ALTAR_MULT` times the favor and offers a blessing even when wobbly. */
export const ALTAR_EVERY = 10;
export const ALTAR_MULT = 2;

/** Slow drop: the stone in hand swings this much slower. Wider stone: the top stone grows this much. */
export const SLOW_MULT = 0.5;
export const WIDER_PX = 20;
/** Stone kinds start on this tier; before it every stone is ordinary. */
export const KINDS_FROM_TIER = 2;
/** How likely each stone is heavy, and light; the rest are ordinary. */
export const HEAVY_CHANCE = 0.25;
export const LIGHT_CHANCE = 0.25;
/** How fast each kind swings, against an ordinary stone. */
export const KIND_SPEED: Record<StoneKind, number> = { normal: 1, heavy: 0.75, light: 1.3 };
/** What a heavy stone cracks off on top of the overhang when it does not land perfectly. */
export const HEAVY_CRACK = 6;
/** The extra favor a light stone earns. */
export const LIGHT_FAVOR = 1;
/** Trials start on this tier. The keep trial needs every stone to keep this share of its width. */
export const TRIALS_FROM_TIER = 2;
export const TRIAL_KEEP = 0.8;
export const TRIAL_FAVOR = 6;
/** A curse doubles the favor of the tier it is taken for. Haste and Brittle's effects. */
export const CURSE_MULT = 2;
export const HASTE = 1.3;
export const BRITTLE_CRACK = 6;
/** Endless sky: how likely a stone meets a gust, and how strong gusts get, in pixels per second while falling. */
export const GUST_CHANCE = 0.6;
export const WIND_BASE = 40;
export const WIND_PER_TIER = 8;
export const WIND_MAX = 120;

/** The temple leans (SS6): from this tier each stone's offset from the one below adds to `lean`, past `LEAN_MAX` the top tier topples, and a finished tier settles to this share of its lean. */
export const LEAN_FROM_TIER = 3;
export const LEAN_MAX = 60;
export const LEAN_SETTLE = 0.5;
/** Perfect chains (SS7): from `CHAIN_FROM_TIER`, the `CHAIN_LEN`th perfect drop in a row, and each one after, grows the stone back `REGROW_PX`. */
export const CHAIN_FROM_TIER = 3;
export const CHAIN_LEN = 3;
export const REGROW_PX = 12;
/** Materials (SS8): from this tier a break picks the next tier's stone. Marble's and Sandstone's perfect window and favor, Basalt's speed, crack and trial favor. */
export const MATERIAL_FROM_TIER = 3;
export const MARBLE_PERFECT = 0.5;
export const MARBLE_MULT = 2;
export const SANDSTONE_PERFECT = 2;
export const SANDSTONE_MULT = 0.5;
export const BASALT_SPEED = 0.75;
export const BASALT_CRACK = 6;
export const BASALT_TRIAL_MULT = 2;
/** Reserve (SS9): from this tier a stone can be held back and swapped in, once per tier. */
export const RESERVE_FROM_TIER = 2;
/** Patrons (SS10): how many are offered, the Gilded Hand's favor, the Many-Handed's offer and speed, the Patient Mason's speed, the Storm Caller's leeway and first gusty tier. */
export const PATRON_OFFER = 2;
export const PATRON_FAVOR = 1;
export const HANDS_OFFER = 4;
export const HANDS_SPEED = 1.1;
export const PATIENT_SPEED = 0.9;
export const STORM_PERFECT = 3;
export const STORM_FROM_TIER = 6;
/**
 * Patron favour (SS12): a crown raises the patron's rank, up to `RANK_MAX`, and each rank strengthens the
 * boon: the Gilded Hand's balanced tiers earn `GILDED_RANK_FAVOR` more, the Many-Handed gets a free
 * reroll per rank, the Patient Mason swings `PATIENT_RANK` slower and the Storm Caller's perfect window
 * grows `STORM_RANK_PX`.
 */
export const RANK_MAX = 3;
export const GILDED_RANK_FAVOR = 2;
export const PATIENT_RANK = 0.03;
export const STORM_RANK_PX = 1;
/** The cliff (SS11): from `CLIFF_FROM_TIER` every stone meets a wind off the sea, blowing left, from `CLIFF_WIND` up `CLIFF_PER_TIER` a tier to `CLIFF_MAX`. */
export const CLIFF_FROM_TIER = 2;
export const CLIFF_WIND = 30;
export const CLIFF_PER_TIER = 5;
export const CLIFF_MAX = 80;
/** The lake (SS11): the raft bobs side to side `LAKE_BOB` pixels (and `LAKE_PER_TIER` more a tier, up to `LAKE_MAX`), once every `LAKE_PERIOD` ms of play. */
export const LAKE_BOB = 10;
export const LAKE_PER_TIER = 1.5;
export const LAKE_MAX = 24;
export const LAKE_PERIOD = 3000;
/**
 * Weather (SS15): once any shrine is crowned, a run brings rain or snow half the time (`WEATHER_CHANCE`),
 * for `WEATHER_MULT` times the favour. Rain slides a stone that isn't perfect `RAIN_SLIDE` pixels further
 * off as it lands; snow sways the swing `SNOW_SWAY` slower and faster, once every `SNOW_PERIOD` ms.
 */
export const WEATHER_CHANCE = 0.5;
export const WEATHER_MULT = 1.5;
export const RAIN_SLIDE = 6;
export const SNOW_SWAY = 0.4;
export const SNOW_PERIOD = 2400;
/** The pilgrims' village (SS14): pilgrims a crown brings, the well's favour at the start and the mason's yard's wider first stone. */
export const PILGRIMS_PER_CROWN = 5;
export const WELL_FAVOR = 10;
export const YARD_PX = 20;

/**
 * `patron` is the pick of a patron before the first stone. `blessing` is the break between tiers: after
 * a balanced tier (blessings on offer) or a wobbly one the player can buy from or pick a material for
 * (no offer, just the shop). `crowned` is the win: the goal tier is finished.
 */
export type Phase = 'patron' | 'swinging' | 'falling' | 'blessing' | 'over' | 'crowned';

/** A stone in the temple, by its middle and width. `tier` counts from 1. */
export interface Stone {
  x: number;
  w: number;
  tier: number;
  perfect: boolean;
  kind: StoneKind;
  material: MaterialId;
}

/** The stone in play: swinging above the temple, then falling. `h` is its bottom's height above the plinth. */
export interface Moving {
  x: number;
  w: number;
  h: number;
  dir: 1 | -1;
  vy: number;
  kind: StoneKind;
  material: MaterialId;
}

/** This tier's trial: how many stones have met it so far, and whether one has failed it. */
export interface Trial {
  id: TrialId;
  done: number;
  failed: boolean;
}

/** What the last drop did. `kept` is the width left on the temple, `share` of the stone's width. */
export interface Drop {
  x: number;
  w: number;
  kept: number;
  share: number;
  perfect: boolean;
  missed: boolean;
  caught: boolean;
}

/** Something for the scene to show once: a stone landing or falling, or a tier finished. */
export type GameEvent =
  | { type: 'placed'; drop: Drop; stone: Stone; row: number; cut: { x: number; w: number }[]; favor: number }
  | { type: 'missed'; drop: Drop; tier: number; kind: StoneKind; material: MaterialId }
  | { type: 'tier'; tier: number; balanced: boolean; cursed: boolean }
  | { type: 'trial'; tier: number; passed: boolean; favor: number }
  | { type: 'rerolled'; cost: number }
  | { type: 'bought'; item: ShopId }
  | { type: 'toppled'; count: number; lean: number; favor: number }
  | { type: 'regrown'; px: number }
  | { type: 'swapped'; kind: StoneKind }
  | { type: 'patron'; patron: PatronId; gift: BlessingId | null }
  | { type: 'altar'; tier: number }
  | { type: 'crowned'; site: SiteId; patron: PatronId | null; daily: boolean };

export interface GameState {
  phase: Phase;
  stones: Stone[];
  moving: Moving;
  /** The tier being built, from 1, and how many of its stones are placed. */
  tier: number;
  inTier: number;
  /** Whether a stone of this tier kept less than `BALANCE` of its width. */
  wobbly: boolean;
  tiersBuilt: number;
  balancedTiers: number;
  favor: number;
  /** The favor the stones of the tier being built have earned so far, taken back if it topples. */
  tierFavor: number;
  /** Blessings kept, in the order chosen, and the ones on offer while choosing. */
  blessings: BlessingId[];
  offer: BlessingId[];
  /** Swing speed in pixels per second, the perfect window, favor per stone and spare stones. */
  speed: number;
  perfectPx: number;
  favorPerStone: number;
  grace: number;
  /** Stones dropped so far, missed ones included. */
  dropped: number;
  lastDrop: Drop | null;
  /** The best number of tiers built in one temple, kept between games. */
  best: number;
  /** The kind of the stone after the one in hand. */
  nextKind: StoneKind;
  /** Whether the stone in hand swings slowly (bought), and what was bought this break. */
  slow: boolean;
  bought: ShopId[];
  /** This tier's trial, or null. */
  trial: Trial | null;
  /** The curse on offer this break, whether the player has chosen to take it, and the curse in force (for one tier). */
  curseOffer: CurseId | null;
  cursed: boolean;
  curse: { id: CurseId; tier: number } | null;
  /** Building past the crown, and the gust on the stone in hand in pixels per second (+ pushes right). */
  endless: boolean;
  wind: number;
  /** Sky altars finished this run. */
  altars: number;
  /** How far the temple leans, in pixels (+ right): the offsets of its stones from the ones below, from `LEAN_FROM_TIER`. */
  lean: number;
  /** Perfect drops in a row. */
  chain: number;
  /** The material of the tier being built, picked in the break before it. */
  material: MaterialId;
  /** The stone held in reserve, and whether this tier's swap is spent. */
  reserve: StoneKind | null;
  swapped: boolean;
  /** The patrons offered before the first stone, and the one chosen for the run. */
  patronOffer: PatronId[];
  patron: PatronId | null;
  /** Where the temple stands, and the sites open to pick before the first stone. */
  site: SiteId;
  sites: SiteId[];
  /** Each patron's rank, earned by crowns, and the chosen patron's rank for this run (0 in the daily). */
  ranks: Record<PatronId, number>;
  rank: number;
  /** Rerolls left that cost no favor (the Many-Handed's rank). */
  freeRerolls: number;
  /** Game time spent stacking, in ms: the lake's bob follows it. */
  clock: number;
  /** The daily shrine: the same patron and stones for everyone today. */
  daily: boolean;
  /** One side of a two-player race (SS16): no patron, no breaks, the first crown or the last miss wins. */
  race: boolean;
  /** This run's weather, shown before the first stone. */
  weather: WeatherId;
  /** The village's buildings this temple starts with (none in the daily or a race), the first stone's width and the inn's free blessing. */
  village: BuildingId[];
  startW: number;
  gift: BlessingId | null;
  /** Where the run's chances come from: `kindRand` draws only the stone kinds, so the daily's stones come in the same order whatever else happens; `rand` everything else. */
  rand: Rand;
  kindRand: Rand;
  events: GameEvent[];
}

/** How a new temple starts: its best, the site and the sites open, the patrons' ranks, and the daily's random sources and patron. */
export interface NewGame {
  best?: number;
  site?: SiteId;
  sites?: SiteId[];
  ranks?: Partial<Record<PatronId, number>>;
  daily?: { rand: Rand; kindRand: Rand };
  /** One side of a race, with its random sources (the same seed on both sides, so both get the same stones). */
  race?: { rand: Rand; kindRand: Rand };
  /** Whether this run can bring weather: once a shrine has been crowned. The daily always can. */
  weather?: boolean;
  /** The village's buildings. */
  village?: BuildingId[];
}

/** The tier that crowns the shrine where the temple stands, and its gilded tier. */
export const goalOf = (s: Pick<GameState, 'site'>) => SITE_INFO[s.site].goal;
export const gildedOf = (s: Pick<GameState, 'site'>) => goalOf(s) - GILDED_BELOW;

/** How much faster or slower a patron makes every stone swing. */
export const patronSpeed = (patron: PatronId | null, rank = 0) =>
  patron === 'hands' ? HANDS_SPEED : patron === 'patient' ? PATIENT_SPEED - PATIENT_RANK * rank : 1;

/** The swing speed for a tier, with the difficulty, the Calm Winds kept and the patron's pace. */
export function speedFor(tier: number, calm: number, patron: PatronId | null = null, rank = 0) {
  return BASE_SPEED * byDifficulty(0.8, 1, 1.25) * (1 + TIER_SPEEDUP * (tier - 1)) * CALM ** calm * patronSpeed(patron, rank);
}

/** The swing speed for the tier being built, with the blessings kept. */
const tierSpeed = (s: GameState) => speedFor(s.tier, s.blessings.filter((b) => b === 'calm').length, s.patron, s.rank);

const NO_RANKS: Record<PatronId, number> = { gilded: 0, hands: 0, patient: 0, storm: 0 };

/**
 * A new temple, waiting for its patron to be chosen from `patronOffer`. The daily shrine offers one
 * patron, drawn from its own random source, and takes it straight away.
 */
export function newGame(opts: NewGame = {}): GameState {
  const seededBy = opts.daily ?? opts.race;
  const rand = seededBy?.rand ?? (() => Math.random());
  const plain = !opts.daily && !opts.race;
  const village = plain ? [...(opts.village ?? [])] : [];
  const startW = Math.min(PLINTH_W, START_W + (village.includes('yard') ? YARD_PX : 0));
  const s: GameState = {
    phase: 'patron',
    stones: [],
    moving: { x: 0, w: startW, h: 0, dir: 1, vy: 0, kind: 'normal', material: 'limestone' },
    tier: 1,
    inTier: 0,
    wobbly: false,
    tiersBuilt: 0,
    balancedTiers: 0,
    favor: village.includes('well') ? WELL_FAVOR : 0,
    tierFavor: 0,
    blessings: [],
    offer: [],
    speed: speedFor(1, 0),
    perfectPx: PERFECT_PX,
    favorPerStone: 1,
    grace: 0,
    dropped: 0,
    lastDrop: null,
    best: opts.best ?? 0,
    nextKind: 'normal',
    slow: false,
    bought: [],
    trial: null,
    curseOffer: null,
    cursed: false,
    curse: null,
    endless: false,
    wind: 0,
    altars: 0,
    lean: 0,
    chain: 0,
    material: 'limestone',
    reserve: null,
    swapped: false,
    patronOffer: opts.race ? [] : pickPatrons(rand, opts.daily ? 1 : PATRON_OFFER),
    patron: null,
    site: plain ? (opts.site ?? 'hill') : 'hill',
    sites: plain ? (opts.sites ?? ['hill']) : ['hill'],
    ranks: { ...NO_RANKS, ...(plain ? opts.ranks : {}) },
    rank: 0,
    freeRerolls: 0,
    clock: 0,
    daily: !!opts.daily,
    race: !!opts.race,
    weather: 'clear',
    village,
    startW,
    gift: null,
    rand,
    kindRand: seededBy?.kindRand ?? (() => Math.random()),
    events: [],
  };
  // Drawn after the patrons, and only when weather can come, so a first temple draws as it always did.
  if (opts.daily || (plain && opts.weather)) s.weather = rollWeather(rand);
  spawn(s);
  if (s.daily) choosePatron(s, s.patronOffer[0]);
  // A race starts swinging at once, with no patron.
  if (s.race) s.phase = 'swinging';
  return s;
}

/** Clear skies, rain or snow: weather half the time, rain or snow alike. */
function rollWeather(rand: Rand): WeatherId {
  if (rand() >= WEATHER_CHANCE) return 'clear';
  return rand() < 0.5 ? 'rain' : 'snow';
}

/** `n` different patrons to choose from. */
function pickPatrons(rand: Rand, n: number) {
  const pool = [...PATRONS];
  const offer: PatronId[] = [];
  while (offer.length < n) offer.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  return offer;
}

/** Takes one of the offered patrons: its rule holds for the run, and the first stone starts swinging. */
export function choosePatron(s: GameState, id: PatronId) {
  if (s.phase !== 'patron' || !s.patronOffer.includes(id)) return false;
  s.patron = id;
  s.patronOffer = [];
  s.rank = Math.min(RANK_MAX, s.ranks[id]);
  if (id === 'gilded') s.favorPerStone += PATRON_FAVOR;
  else if (id === 'storm') s.perfectPx += STORM_PERFECT + STORM_RANK_PX * s.rank;
  else if (id === 'hands') s.freeRerolls = s.rank;
  // The village's inn sends the temple off with a free blessing, drawn from those the patron allows.
  if (s.village.includes('inn')) {
    const pool = blessingsFor(s);
    s.gift = pool[Math.floor(s.rand() * pool.length)];
    s.blessings.push(s.gift);
    applyBlessing(s, s.gift);
  }
  s.speed = tierSpeed(s);
  s.phase = 'swinging';
  s.events.push({ type: 'patron', patron: id, gift: s.gift });
  return true;
}

/** How many blessings a balanced tier offers: four under the Many-Handed. */
export const offerSize = (s: GameState) => (s.patron === 'hands' ? HANDS_OFFER : OFFER_SIZE);

/** The blessings that can be offered: the Gilded Hand allows no Mason's Grace. */
export const blessingsFor = (s: GameState): BlessingId[] => (s.patron === 'gilded' ? BLESSINGS.filter((b) => b !== 'grace') : [...BLESSINGS]);

/** The shop's items, in order: the Gilded Hand allows no Mason's Grace. */
export const shopFor = (s: GameState): ShopId[] => (s.patron === 'gilded' ? SHOP.filter((i) => i !== 'grace') : [...SHOP]);

/** The temple's height above the plinth. */
export const stackHeight = (s: GameState) => s.stones.length * STONE_H;

/** What the next stone lands on: the top stone, or the plinth. */
export function topOf(s: GameState) {
  return s.stones.at(-1) ?? { x: TOWER_X, w: PLINTH_W };
}

/** Hands out the next stone, as wide as the top one, swinging in from alternate sides. */
function spawn(s: GameState) {
  const dir = s.dropped % 2 === 0 ? 1 : -1;
  const w = s.stones.length ? topOf(s).w : s.startW;
  s.moving = { x: TOWER_X - dir * SWING, w, h: stackHeight(s) + DROP_GAP, dir, vy: 0, kind: s.nextKind, material: s.material };
  s.nextKind = kindFor(s, s.stones.length + 1);
  s.wind = cliffWind(s) + gustFor(s);
}

/** Whether a wind can blow on the tier being built: a gusty one, or on the cliff from `CLIFF_FROM_TIER`. */
export const windy = (s: GameState) => gusty(s) || (s.site === 'cliff' && s.tier >= CLIFF_FROM_TIER);

/** The cliff's wind off the sea on a new stone: always from the right, stronger each tier, give or take a fifth. */
function cliffWind(s: GameState) {
  if (s.site !== 'cliff' || s.tier < CLIFF_FROM_TIER) return 0;
  const strength = Math.min(CLIFF_MAX, CLIFF_WIND + CLIFF_PER_TIER * (s.tier - CLIFF_FROM_TIER));
  return -Math.round(strength * (0.8 + 0.4 * s.rand()));
}

/** How far the lake's raft has bobbed from the middle, in pixels (+ right); 0 on solid ground. */
export function drift(s: GameState) {
  if (s.site !== 'lake') return 0;
  const reach = Math.min(LAKE_MAX, LAKE_BOB + LAKE_PER_TIER * (s.tier - 1));
  return reach * Math.sin((2 * Math.PI * s.clock) / LAKE_PERIOD);
}

/** Whether gusts can blow on the tier being built: in the endless sky, or from `STORM_FROM_TIER` under the Storm Caller. */
export const gusty = (s: GameState) => s.endless || (s.patron === 'storm' && s.tier >= STORM_FROM_TIER);

/** The gust on a new stone, when the tier is `gusty`: the Storm Caller's ladder climbs on into the sky. */
function gustFor(s: GameState) {
  if (!gusty(s)) return 0;
  return gust(s, s.patron === 'storm' ? STORM_FROM_TIER - 1 : goalOf(s));
}

/** The kind of the stone that will be the temple's `n`th from the bottom (from 0): ordinary on the first tiers. */
function kindFor(s: GameState, n: number): StoneKind {
  if (n < STONES_PER_TIER * (KINDS_FROM_TIER - 1)) return 'normal';
  const r = s.kindRand();
  return r < HEAVY_CHANCE ? 'heavy' : r < HEAVY_CHANCE + LIGHT_CHANCE ? 'light' : 'normal';
}

/** A gust for a stone on `tier`, or calm air; `WIND_BASE` on the first gusty tier after `from`, stronger each tier after. */
function gust(s: GameState, from: number) {
  if (s.rand() >= GUST_CHANCE) return 0;
  const strength = Math.min(WIND_MAX, WIND_BASE + WIND_PER_TIER * Math.max(0, s.tier - from - 1));
  const side = s.rand() < 0.5 ? -1 : 1;
  return Math.round(side * strength * (0.6 + 0.4 * s.rand()));
}

/** The curse in force on the tier being built, if any. */
export const curseNow = (s: GameState) => (s.curse && s.curse.tier === s.tier ? s.curse.id : null);

/** Snow's sway on the swing: slower, then faster, over `SNOW_PERIOD` ms of play; 1 in any other weather. */
export const snowSway = (s: GameState) => (s.weather === 'snow' ? 1 + SNOW_SWAY * Math.sin((2 * Math.PI * s.clock) / SNOW_PERIOD) : 1);

/** How fast the stone in hand swings: the tier's speed, its kind and material, a slow drop, Haste and snow. */
export function swingSpeed(s: GameState) {
  const basalt = s.moving.material === 'basalt' ? BASALT_SPEED : 1;
  return s.speed * KIND_SPEED[s.moving.kind] * basalt * (s.slow ? SLOW_MULT : 1) * (curseNow(s) === 'haste' ? HASTE : 1) * snowSway(s);
}

/** How close to the stone below a drop must be to be perfect: the blessings' window, scaled by the material. */
export function perfectWindow(s: GameState) {
  return s.perfectPx * (s.material === 'marble' ? MARBLE_PERFECT : s.material === 'sandstone' ? SANDSTONE_PERFECT : 1);
}

/** Whether the stone in hand can go to the reserve, or swap with the stone held there. */
export function canSwap(s: GameState) {
  return s.phase === 'swinging' && s.tier >= RESERVE_FROM_TIER && (s.reserve === null || !s.swapped);
}

/**
 * Puts the stone in hand in reserve and takes the next one (free while the reserve is empty), or swaps it
 * with the one held, once per tier. The stone keeps swinging from where it is.
 */
export function swapReserve(s: GameState) {
  if (!canSwap(s)) return false;
  const held = s.reserve;
  s.reserve = s.moving.kind;
  if (held === null) {
    s.moving.kind = s.nextKind;
    s.nextKind = kindFor(s, s.stones.length + 1);
  } else {
    s.moving.kind = held;
    s.swapped = true;
  }
  s.events.push({ type: 'swapped', kind: s.moving.kind });
  return true;
}

/** Moves the swinging or falling stone on by `dt` milliseconds. */
export function tick(s: GameState, dt: number) {
  const m = s.moving;
  if (s.phase === 'swinging' || s.phase === 'falling') s.clock += dt;
  if (s.phase === 'swinging') {
    m.x += (m.dir * swingSpeed(s) * dt) / 1000;
    // Bounce off either end of the swing, keeping the distance travelled past it.
    const lo = TOWER_X - SWING;
    const hi = TOWER_X + SWING;
    while (m.x < lo || m.x > hi) {
      if (m.x > hi) m.x = 2 * hi - m.x;
      else m.x = 2 * lo - m.x;
      m.dir = m.dir === 1 ? -1 : 1;
    }
  } else if (s.phase === 'falling') {
    m.vy += (GRAVITY * dt) / 1000;
    m.h -= (m.vy * dt) / 1000;
    // Gusts in the endless sky push the falling stone sideways.
    m.x += (s.wind * dt) / 1000;
    if (m.h <= stackHeight(s)) land(s);
  }
}

/** Drops the swinging stone where it is. Returns false when no stone is swinging. */
export function drop(s: GameState) {
  if (s.phase !== 'swinging') return false;
  s.phase = 'falling';
  s.moving.vy = 0;
  return true;
}

function land(s: GameState) {
  const m = s.moving;
  // On the lake the stone lands on the raft where it has bobbed to; stones are kept in the raft's own place.
  const bob = drift(s);
  const below = topOf(s);
  const top = { x: below.x + bob, w: below.w };
  s.dropped++;
  s.slow = false;
  let x = m.x;
  let kept: number;
  // Only a drop that would also overlap enough to stand counts as perfect, so a wide window
  // can't save a narrow stone that misses.
  const perfect = Math.abs(m.x - top.x) <= Math.min(perfectWindow(s), (top.w + m.w) / 2 - MIN_W);
  const cut: { x: number; w: number }[] = [];
  // In the rain a stone that isn't perfect slides a little further off as it lands.
  const mx = !perfect && s.weather === 'rain' ? m.x + Math.sign(m.x - top.x) * RAIN_SLIDE : m.x;
  if (perfect) {
    x = top.x;
    kept = Math.min(m.w, top.w);
  } else {
    const left = Math.max(mx - m.w / 2, top.x - top.w / 2);
    const right = Math.min(mx + m.w / 2, top.x + top.w / 2);
    kept = Math.max(0, right - left);
    x = (left + right) / 2;
    if (left > mx - m.w / 2) cut.push({ x: (mx - m.w / 2 + left) / 2, w: left - (mx - m.w / 2) });
    if (right < mx + m.w / 2) cut.push({ x: (right + mx + m.w / 2) / 2, w: mx + m.w / 2 - right });
    // Heavy stones, Basalt and the Brittle curse crack a little more off either side.
    const crack = (m.kind === 'heavy' ? HEAVY_CRACK : 0) + (m.material === 'basalt' ? BASALT_CRACK : 0) + (curseNow(s) === 'brittle' ? BRITTLE_CRACK : 0);
    if (crack && kept >= MIN_W) {
      const c = Math.min(crack, kept) / 2;
      cut.push({ x: left + c / 2, w: c }, { x: right - c / 2, w: c });
      kept -= 2 * c;
    }
  }

  if (kept < MIN_W) {
    const caught = s.grace > 0;
    const d: Drop = { x: mx, w: m.w, kept: 0, share: 0, perfect: false, missed: true, caught };
    s.lastDrop = d;
    s.chain = 0;
    s.events.push({ type: 'missed', drop: d, tier: s.tier, kind: m.kind, material: m.material });
    if (caught) {
      s.grace--;
      // The caught stone kept nothing, so the tier is wobbly and a keep trial is failed.
      s.wobbly = true;
      if (s.trial && !s.trial.failed) {
        s.trial.failed = true;
        s.events.push({ type: 'trial', tier: s.tier, passed: false, favor: 0 });
      }
      s.phase = 'swinging';
      spawn(s);
    } else {
      s.phase = 'over';
    }
    return;
  }

  const share = kept / m.w;
  const d: Drop = { x, w: m.w, kept, share, perfect, missed: false, caught: false };
  s.lastDrop = d;
  const stone: Stone = { x: x - bob, w: kept, tier: s.tier, perfect, kind: m.kind, material: m.material };
  s.stones.push(stone);
  const favor = stoneFavor(s, perfect, m.kind);
  s.favor += favor;
  s.tierFavor += favor;
  if (share < BALANCE) s.wobbly = true;
  s.inTier++;
  s.chain = perfect ? s.chain + 1 : 0;
  // A copy, as the rules may still widen the stone or topple it before the scene draws the event.
  s.events.push({ type: 'placed', drop: d, stone: { ...stone }, row: s.stones.length - 1, cut, favor });
  s.phase = 'swinging';
  // A chain of perfect drops grows the stone back a little, from the third in a row.
  if (perfect && s.tier >= CHAIN_FROM_TIER && s.chain >= CHAIN_LEN && kept < PLINTH_W) {
    widenTop(s, REGROW_PX);
    s.events.push({ type: 'regrown', px: s.stones.at(-1)!.w - kept });
  }
  // From tier 3 every off-centre stone leans the temple; too far and the tier being built topples.
  if (s.tier >= LEAN_FROM_TIER) {
    s.lean += x - top.x;
    if (Math.abs(s.lean) > LEAN_MAX) {
      topple(s);
      spawn(s);
      return;
    }
  }
  const trial = s.trial;
  if (trial && !trial.failed) {
    if (trial.id === 'perfect' ? perfect : share >= TRIAL_KEEP) trial.done++;
    else {
      trial.failed = true;
      s.events.push({ type: 'trial', tier: s.tier, passed: false, favor: 0 });
    }
  }

  if (s.inTier === STONES_PER_TIER) {
    const balanced = !s.wobbly;
    const done = s.tier;
    s.events.push({ type: 'tier', tier: done, balanced, cursed: curseNow(s) !== null });
    if (trial && !trial.failed) {
      const bonus = Math.ceil(TRIAL_FAVOR * favorMult(s, done) * (s.material === 'basalt' ? BASALT_TRIAL_MULT : 1));
      s.favor += bonus;
      s.events.push({ type: 'trial', tier: done, passed: true, favor: bonus });
    }
    if (balanced) {
      s.balancedTiers++;
      // The Gilded Hand's rank adds to every balanced tier.
      const ranked = s.patron === 'gilded' ? GILDED_RANK_FAVOR * s.rank : 0;
      s.favor += Math.ceil((TIER_FAVOR + ranked) * favorMult(s, done));
    }
    s.tiersBuilt++;
    s.best = Math.max(s.best, s.tiersBuilt);
    s.tier++;
    s.inTier = 0;
    s.tierFavor = 0;
    s.wobbly = false;
    s.curse = null;
    s.swapped = false;
    s.material = 'limestone';
    // A finished tier settles: the temple keeps half its lean.
    s.lean = Math.trunc(s.lean * LEAN_SETTLE);
    s.speed = tierSpeed(s);
    s.trial = s.tier >= TRIALS_FROM_TIER ? { id: TRIALS[Math.floor(s.rand() * TRIALS.length)], done: 0, failed: false } : null;
    // A sky altar blesses the tier whether it balanced or not.
    const altar = isAltar(done, goalOf(s));
    if (altar) {
      s.altars++;
      s.events.push({ type: 'altar', tier: done });
    }
    // A race has no breaks: the temples climb straight on.
    const blessed = !s.race && (balanced || altar);
    if (blessed) {
      s.offer = pickOffer(s);
      s.curseOffer = pickCurse(s);
    }
    if (s.tiersBuilt === goalOf(s) && !s.endless) {
      // A balanced crowning tier keeps its offer for the break "Keep building" opens.
      s.phase = 'crowned';
      s.events.push({ type: 'crowned', site: s.site, patron: s.patron, daily: s.daily });
      return;
    }
    if (blessed) {
      s.phase = 'blessing';
    } else if (!s.race && (s.favor >= CHEAPEST || s.tier >= MATERIAL_FROM_TIER)) {
      // A wobbly tier earns no blessing, but the break still opens when favor can buy something or
      // a material is to be picked.
      s.offer = [];
      s.curseOffer = null;
      s.phase = 'blessing';
    }
  }
  spawn(s);
}

/** The tier being built falls off the temple: its stones go, and their favor, the lean is gone with them and the tier starts over. */
function topple(s: GameState) {
  const count = s.inTier;
  s.stones.splice(s.stones.length - count, count);
  const favor = Math.min(s.tierFavor, s.favor);
  s.favor -= favor;
  s.events.push({ type: 'toppled', count, lean: s.lean, favor });
  s.inTier = 0;
  s.tierFavor = 0;
  s.wobbly = false;
  s.lean = 0;
  s.chain = 0;
  if (s.trial) s.trial = { id: s.trial.id, done: 0, failed: false };
}

/** Whether a material can be picked now: in a break, from `MATERIAL_FROM_TIER`. */
export const canPickMaterial = (s: GameState) => s.phase === 'blessing' && s.tier >= MATERIAL_FROM_TIER;

/** Picks what the tier about to be built is cut from; picking the same one again goes back to limestone. */
export function chooseMaterial(s: GameState, id: MaterialId) {
  if (!canPickMaterial(s)) return false;
  s.material = s.material === id ? 'limestone' : id;
  s.moving.material = s.material;
  return true;
}

/** Whether a tier is a sky altar: every `ALTAR_EVERY`th tier past the crown at `goal`. */
export const isAltar = (tier: number, goal = GOAL_TIER) => tier > goal && (tier - goal) % ALTAR_EVERY === 0;

/** The first sky altar at or above `tier`. */
export const nextAltar = (tier: number, goal = GOAL_TIER) => goal + ALTAR_EVERY * Math.max(1, Math.ceil((tier - goal) / ALTAR_EVERY));

/** How much a tier's favor is multiplied by: double on the gilded tier and on a sky altar, for a crown at `goal`. */
export const gild = (tier: number, goal = GOAL_TIER) => (tier === goal - GILDED_BELOW ? GILDED_MULT : isAltar(tier, goal) ? ALTAR_MULT : 1);

/** What a material does to its tier's favor. */
export const materialMult = (material: MaterialId) => (material === 'marble' ? MARBLE_MULT : material === 'sandstone' ? SANDSTONE_MULT : 1);

/**
 * The gilded tier's or a sky altar's multiplier, doubled again while a curse is in force on that tier, times the tier's
 * material (known only for the tier being built). Favor is rounded up after it.
 */
export const favorMult = (s: GameState, tier: number) =>
  gild(tier, goalOf(s)) *
  (s.curse && s.curse.tier === tier ? CURSE_MULT : 1) *
  (tier === s.tier ? materialMult(s.material) : 1) *
  (s.weather === 'clear' ? 1 : WEATHER_MULT);

/** The favor a stone placed now earns; the Patient Mason's perfect drops earn nothing extra. */
export const stoneFavor = (s: GameState, perfect: boolean, kind: StoneKind = 'normal') =>
  Math.ceil((s.favorPerStone + (perfect && s.patron !== 'patient' ? PERFECT_FAVOR : 0) + (kind === 'light' ? LIGHT_FAVOR : 0)) * favorMult(s, s.tier));

/** What the next reroll costs: nothing while the Many-Handed's free rerolls last. */
export const rerollCost = (s: GameState) => (s.freeRerolls > 0 ? 0 : REROLL_COST);

/** Whether the blessings on offer can be swapped for three new ones. */
export const canReroll = (s: GameState) => s.phase === 'blessing' && s.offer.length > 0 && s.favor >= rerollCost(s);

/** Spends `REROLL_COST` favor (or a free reroll) on a new offer of three blessings, and a new curse. */
export function reroll(s: GameState) {
  if (!canReroll(s)) return false;
  const cost = rerollCost(s);
  if (cost) s.favor -= cost;
  else s.freeRerolls--;
  s.offer = pickOffer(s);
  s.curseOffer = pickCurse(s);
  // The new curse is a different one, so it starts untaken.
  s.cursed = false;
  s.events.push({ type: 'rerolled', cost });
  return true;
}

/** A random curse to offer with the blessings. */
function pickCurse(s: GameState) {
  return CURSES[Math.floor(s.rand() * CURSES.length)];
}

/** Whether a shop item can be bought now: between tiers, once per break, with the favor for it. */
export function canBuy(s: GameState, item: ShopId) {
  if (s.phase !== 'blessing' || !shopFor(s).includes(item) || s.bought.includes(item) || s.favor < SHOP_INFO[item].cost) return false;
  return item !== 'wider' || topOf(s).w < PLINTH_W;
}

/** Spends favor on a one-time help for the next stones. */
export function buy(s: GameState, item: ShopId) {
  if (!canBuy(s, item)) return false;
  s.favor -= SHOP_INFO[item].cost;
  s.bought.push(item);
  if (item === 'slow') s.slow = true;
  else if (item === 'grace') s.grace++;
  else widenTop(s, WIDER_PX);
  s.events.push({ type: 'bought', item });
  return true;
}

/** Grows the top stone by `px`, up to the plinth, and the stone in hand with it. */
function widenTop(s: GameState, px: number) {
  const top = s.stones.at(-1)!;
  top.w = Math.min(PLINTH_W, top.w + px);
  s.moving.w = top.w;
}

/** Takes or leaves the curse on offer; it comes with the blessing chosen next. */
export function toggleCurse(s: GameState) {
  if (s.phase !== 'blessing' || !s.curseOffer) return false;
  s.cursed = !s.cursed;
  return true;
}

/** Ends a break that offered no blessing (after a wobbly tier) and goes back to stacking. */
export function buildOn(s: GameState) {
  if (s.phase !== 'blessing' || s.offer.length) return false;
  endBreak(s);
  return true;
}

function endBreak(s: GameState) {
  s.offer = [];
  s.curseOffer = null;
  s.cursed = false;
  s.bought = [];
  s.phase = 'swinging';
}

/**
 * After the crown: keep building into the endless sky, where gusts push the falling stone, after a break
 * to pick the first sky tier's material and, when the crowning tier was balanced, its blessing.
 */
export function keepBuilding(s: GameState) {
  if (s.phase !== 'crowned') return false;
  s.endless = true;
  s.phase = 'blessing';
  spawn(s);
  return true;
}

/** Different blessings, as many as the patron allows. */
function pickOffer(s: GameState) {
  const pool = blessingsFor(s);
  const offer: BlessingId[] = [];
  while (offer.length < offerSize(s)) offer.push(pool.splice(Math.floor(s.rand() * pool.length), 1)[0]);
  return offer;
}

/** Keeps one of the offered blessings and goes back to stacking. */
export function chooseBlessing(s: GameState, id: BlessingId) {
  if (s.phase !== 'blessing' || !s.offer.includes(id)) return false;
  s.blessings.push(id);
  if (s.cursed && s.curseOffer) s.curse = { id: s.curseOffer, tier: s.tier };
  endBreak(s);
  applyBlessing(s, id);
  return true;
}

/** What a blessing does as it is kept. Broad Stones before the first stone widens the first stone instead. */
function applyBlessing(s: GameState, id: BlessingId) {
  switch (id) {
    case 'broad':
      if (s.stones.length) widenTop(s, BROAD_PX);
      else s.moving.w = s.startW = Math.min(PLINTH_W, s.startW + BROAD_PX);
      break;
    case 'calm':
      s.speed = tierSpeed(s);
      break;
    case 'steady':
      s.perfectPx += STEADY_PX;
      break;
    case 'golden':
      s.favorPerStone++;
      break;
    case 'grace':
      s.grace++;
      break;
  }
}
