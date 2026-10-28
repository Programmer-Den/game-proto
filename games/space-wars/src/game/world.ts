import { byDifficulty } from '../../../../shared/settings';
import { aiLog } from '../../../../shared/watch';
import { ARENA, BUILD_RANGE, NODE_AMOUNT, NODE_CLEARANCE } from './arena';
import { COMBAT_UNITS, FACTIONS, type Ability, type Faction, type Role, type UnitId } from './factions';
import { beaconNode, localRandom, type DerelictKind, type MapLayout, type Point } from './map';
import {
  BOARD_MS, CONTRACT_POOL, CONTRACT_STEPS, FLAGSHIP_STEP, NO_PERKS, RANKS, boardOffer, contractOf, type Contract, type Goal, type Perks,
} from './contracts';
import { SECTORS, type Sector } from './campaign';
import { Fog } from './fog';
import { PATH_CELL, Pathing } from './pathing';
import { t, type TextKey } from '../i18n';
import { locale } from '../../../../shared/i18n';
import {
  RESEARCH_COSTS, RESEARCH_LEVELS, RESEARCH_MS, RESEARCH_STEP, TRACKS, TRACK_DEFS, noResearch, researchBonus,
  type Research, type Track,
} from './research';

/** The faction the player commands. */
export const PLAYER = 0;
/** Crystal every faction starts with. */
const START_CRYSTAL = 120;
/** How many units a building can have queued. */
const MAX_QUEUE = 5;
/** How many harvesters an AI faction keeps working. */
const AI_HARVESTERS = 4;
/** How often an AI faction spends and decides, in ms. */
const AI_THINK_MS = 1000;
/** How often an AI faction sends its army at the nearest enemy building, in ms. */
const AI_ATTACK_MS = 12000;
/** No AI faction attacks before this much game time, so every economy gets going first. */
const AI_GRACE_MS = 75000;
/** After this much game time, the rival nearest the relay beacon sends one warship (a picket) to contest it. */
const AI_PICKET_MS = 30000;
/** Game time a harvester takes to mine one crystal, in ms. */
const MINE_MS = 500;
const UNIT_RADIUS = 10;
/**
 * Simple pathing (`game/pathing.ts`): a ship flies straight where it can and round the rocks where
 * it can't, never more than ROCK_OVERLAP px over a rock's edge, and finds its way again every
 * ROUTE_MS or once its destination moves a cell. Ships closer than SPREAD px drift apart at up to
 * SPREAD_SPEED px a second. A rock round the ship's destination is left out, so a node or target
 * among the rocks can still be reached. A ship on a move order is never pushed, so it always arrives.
 */
const ROCK_OVERLAP = 4;
const ROUTE_MS = 1000;
export const SPREAD = 18;
const SPREAD_SPEED = 40;
/** A destination this close to a rock (past its edge) can be reached over it; a ship stopping further off a target than this finds another spot on its ring. */
const REACH = 14;
const BEAM_MS = 140;
const BOOM_MS = 450;
/** The relay beacon: how close a ship must be to hold it, how long a lone faction takes to capture it, and its pay. */
export const BEACON_RADIUS = 70;
export const CAPTURE_MS = 5000;
export const BEACON_PAY = 3;
const BEACON_PAY_MS = 1000;
/**
 * Nebulae: a ship inside one is hidden from enemies unless one of them is within NEBULA_SPOT px
 * (or their sensors cover it), shows for NEBULA_REVEAL_MS after it fires, and flies at NEBULA_SLOW
 * of its speed.
 */
export const NEBULA_SPOT = 70;
const NEBULA_REVEAL_MS = 1500;
export const NEBULA_SLOW = 0.7;
/** Veteran ranks: the kills that earn each one, what each adds to a ship's damage and hit points, and their names. */
export const VETERAN_RANKS = [3, 8] as const;
export const VETERAN_STEP = 0.15;
export const VETERAN_NAMES = ['rankVeteran', 'rankAce'] as const satisfies readonly TextKey[];
/** Repair: a ship within REPAIR_RANGE px of a finished hub, outpost or Depot of its faction gets back this share of its hit points a second. */
export const REPAIR_RANGE = 120;
export const REPAIR_RATE = 0.03;
/** How far short of the repair point a ship falling back stops. */
const FALL_BACK_STOP = 30;
/** The AI pulls a warship home to repair below this share of its hit points. */
const AI_FALL_BACK_HP = 0.3;
/** Derelict stations: the ring to hold, how long a lone faction takes to claim one, and what each kind gives. */
export const DERELICT_RADIUS = 60;
export const CLAIM_MS = 10000;
export const SENSOR_RANGE = 280;
export const DERELICT_GUN = { damage: 14, range: 170, cooldownMs: 1000 };
/** The AI goes for derelicts from this much game time, those within this far of its hub, once it has this many warships. */
const AI_CLAIM_MS = 60000;
const AI_CLAIM_REACH = 600;
const AI_CLAIM_ARMY = 3;
/** Truces: how long one lasts, the tribute a rival pays for one, how long its offer stays open and the pause before it offers again. */
export const TRUCE_MS = 90000;
export const TRUCE_TRIBUTE = 40;
export const OFFER_MS = 25000;
const OFFER_COOLDOWN_MS = 120000;
/** A rival holding a grudge against the player offers a truce under pressure: its hub under this share of its hit points, or this many ships lost to the player lately. */
const PRESSURE_HUB = 0.75;
const PRESSURE_LOSSES = 3;
const PRESSURE_DECAY_MS = 10000;
/** Tribute: what turning a rival's grudge onto another faction costs the player, and how long that grudge holds. */
export const BRIBE_COST = 60;
export const BRIBE_MS = 60000;
/** Salvage: what a shard is worth, how far a ship pulls it in from, how fast it flies, and how long it lasts. */
export const SHARD_VALUE = 8;
export const SHARD_MAGNET = 260;
const SHARD_SPEED = 220;
const SHARD_LIFE_MS = 45000;
/** How long a floating number (+8, +3) shows, in ms. */
export const POP_MS = 1400;
/**
 * Fog of war: how far the player's ships and buildings see. A ship sees a share beyond its weapon
 * sight, a scout furthest of all, so scouts are the ones to send out; a harvester sees a little.
 */
const SCOUT_VISION = 1.6;
const SHIP_VISION = 1.2;
const HARVESTER_VISION = 80;
const HUB_VISION = 175;
/** A building other than a hub sees this far past its own edge. */
const BUILDING_VISION = 110;
/** How close a player ship must be to spot a rival's hidden mine. */
export const MINE_SPOT = 60;
/**
 * Expansions: a second hub at a far crystal field. Its cost and build time, its hit points as a
 * share of the main hub's, how close to a crystal node it must go and how far from the faction's
 * other hubs.
 */
export const EXPANSION_COST = 250;
const EXPANSION_MS = 18000;
const EXPANSION_HP = 0.6;
export const EXPANSION_NEAR = 120;
export const EXPANSION_GAP = 400;
/** The AI expands after this much game time, to a field at least this far from every other faction's hubs. */
const AI_EXPAND_MS = 150000;
const AI_EXPAND_RIVAL_GAP = 300;
/** Harvesters an AI faction adds for each expansion. */
const AI_EXPANSION_HARVESTERS = 3;
/** The AI starts research after this much game time. */
const AI_RESEARCH_MS = 120000;
/** How many rivals contest the beacon, and how much later each one after the nearest joins in. */
const AI_PICKETS = 2;
const AI_PICKET_STAGGER_MS = 90000;
/** The most warships an AI keeps; past it, it saves its crystal. */
const AI_MAX_ARMY = 20;
/** Warships an AI keeps home when it attacks, nearest its hub first. */
const AI_HOME_GUARD = 2;
/**
 * Rival contracts: from AI_DEAL_MS on, each AI faction works through a chain of its own (steps 1
 * to 4 of the board, with the same targets, rewards and perks as the player's), picking from
 * AI_GOALS. One it hasn't finished in AI_DEAL_LIMIT_MS is dropped for another. A raid contract
 * (`kills`, `razes`, `hubs`) sends the army out with AI_DEAL_EAGER fewer ships, `hold` keeps a
 * picket on the beacon whoever is nearest, and `derelicts` claims stations anywhere with a smaller army.
 */
export const AI_DEAL_MS = 90000;
const AI_DEAL_LIMIT_MS = 180000;
export const AI_GOALS: readonly Goal[] = ['kills', 'hold', 'derelicts', 'razes', 'hubs'];
const AI_DEAL_EAGER = 2;
const AI_DEAL_CLAIM_ARMY = 2;
/** How far an idle AI warship goes to fetch its faction's salvage shard. */
const AI_SALVAGE_REACH = 360;
/**
 * The flagship the third contract unlocks, one per battle: what it costs and takes to build at the
 * hub, and how it scales its faction's heavy's hit points, damage, speed and range.
 */
export const FLAGSHIP_COST = 400;
export const FLAGSHIP_MS = 25000;
export const FLAGSHIP_HP = 3;
export const FLAGSHIP_DAMAGE = 1.6;
export const FLAGSHIP_SPEED = 0.7;
export const FLAGSHIP_RANGE = 20;
/** The convoy contract: how many harvesters fly, how far off their field lies, and how many raiders the nearest rival sends at them. */
export const CONVOY_SIZE = 3;
const CONVOY_NEAR = 420;
const CONVOY_FAR = 820;
const CONVOY_DIST = 600;
const CONVOY_RAIDERS = 3;
/**
 * The last-stand pact: once only two rivals are left, or the player holds more than this share of
 * the finished hubs, the rivals make peace with each other, get some crystal, and raid the player
 * together when the countdown runs out, then again every PACT_WAVE_MS.
 */
export const PACT_MS = 60000;
export const PACT_WAVE_MS = 45000;
const PACT_FUNDS = 100;
const PACT_HUB_SHARE = 1 / 3;
const PACT_RIVALS = 2;

/**
 * The spots round a rally point that new ships fly to, in turn, so a wing fans out rather than
 * stacking on one point: the point itself, a ring of 6 at 24 px and a ring of 12 at 46 px.
 */
export const RALLY_SPOTS: readonly Point[] = [
  { x: 0, y: 0 },
  ...Array.from({ length: 6 }, (_, k) => ({ x: Math.cos((k * Math.PI) / 3) * 24, y: Math.sin((k * Math.PI) / 3) * 24 })),
  ...Array.from({ length: 12 }, (_, k) => ({ x: Math.cos(((k + 0.5) * Math.PI) / 6) * 46, y: Math.sin(((k + 0.5) * Math.PI) / 6) * 46 })),
];

/**
 * Where a unit is going: a point to move to, or an entity to attack. A player's attack on a rival
 * building under the fog carries `seen`, the spot and owner it was last seen with: while that spot
 * is out of sight and the building is gone, the ships fly there to look rather than give up.
 */
export type Order =
  | { kind: 'move'; x: number; y: number }
  | { kind: 'attack'; id: number; auto: boolean; seen?: { x: number; y: number; faction: number } };

export interface Mining {
  node: number;
  phase: 'seek' | 'mine' | 'return';
  timer: number;
}

export interface Unit {
  kind: 'unit';
  id: number;
  faction: number;
  type: UnitId;
  x: number;
  y: number;
  angle: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  order: Order | null;
  mining: Mining | null;
  carry: number;
  /** Counts toward an ability's cadence (a brood or a decoy), in ms. */
  timer: number;
  /** Time left before a shot shows a cloaked unit again, in ms. */
  revealMs: number;
  /** For a decoy: the time it has left, in ms; null for everything else. */
  decoyMs: number | null;
  /** The faction whose shot hit it last, or -1: who gets the kill. */
  lastHit: number;
  /** The ship whose shot hit it last (by id, -1 for a turret, mine or none): who gets the veteran credit. */
  lastHitBy: number;
  /** For a harvester: the hub (main or expansion) whose crystal it works, by id; -1 for the rest. */
  home: number;
  /** Enemy ships it has destroyed; VETERAN_RANKS of them earn a rank. */
  kills: number;
  /** Whether it is inside a nebula this update. */
  nebula: boolean;
  /** Whether it got repair this update, beside a hub or Depot. */
  repairing: boolean;
  /** The player's flagship: its faction's heavy, scaled up, with the flagship's ability. */
  flagship: boolean;
  /** A convoy harvester still flying to the convoy's field. */
  convoy: boolean;
}

/** What a faction can build: the buildings beside a hub, and an expansion (a second hub) at a far crystal field. */
export type Build = Exclude<Role, 'hub'> | 'expansion';

export interface Building {
  kind: 'building';
  id: number;
  faction: number;
  type: Role;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  done: boolean;
  buildLeft: number;
  queue: UnitId[];
  trainLeft: number;
  cooldown: number;
  /** Time a hack has left before a turret fires again, in ms. */
  disabledMs: number;
  /** Hack hits landed while it was dark; enough of them take it over. */
  hacks: number;
  /** Counts toward the next mine a Mine Lattice lays, in ms. */
  layMs: number;
  /** The faction whose shot hit it last, or -1. */
  lastHit: number;
  /** A hub built at a far crystal field: it trains harvesters and takes crystal, but its fall does not end the faction. */
  expansion: boolean;
  /** Game time the whole construction takes, in ms. */
  buildMs: number;
}

/** A rival building as the player last saw it: drawn from this while it is under the fog. */
export interface SeenBuilding {
  id: number;
  faction: number;
  type: Role;
  x: number;
  y: number;
  done: boolean;
  expansion: boolean;
}

/** A hidden mine a Mine Lattice laid; an enemy ship that comes close sets it off. */
export interface Mine extends Point {
  id: number;
  faction: number;
  /** The lattice that laid it. */
  from: number;
}

export interface Node extends Point {
  id: number;
  amount: number;
}

/**
 * A derelict station out in the fog. A faction alone in its ring with warships fills `claim` in
 * CLAIM_MS (draining a rival's first) and owns it until another takes it: wide sensors see
 * SENSOR_RANGE round it, a shipyard trains the owner's combat units, a gun platform shoots for it.
 */
export interface Derelict extends Point {
  kind: 'derelict';
  id: number;
  perk: DerelictKind;
  owner: number;
  /** Who the claim progress belongs to, or -1. */
  capturer: number;
  claim: number;
  /** For a shipyard: the owner's units queued here. */
  queue: UnitId[];
  trainLeft: number;
  /** For a gun platform: time until its next shot. */
  cooldown: number;
}

/** What a derelict of each kind is called and does, as keys of `i18n/en.ts` (see `derelictText`). */
export const DERELICT_DEFS: Record<DerelictKind, { name: TextKey; text: TextKey }> = {
  sensors: { name: 'sensorsName', text: 'sensorsText' },
  shipyard: { name: 'shipyardName', text: 'shipyardText' },
  gun: { name: 'gunName', text: 'gunText' },
};

/** What a derelict station gives its owner, in a sentence with its numbers. */
export function derelictText(kind: DerelictKind): string {
  return t(DERELICT_DEFS[kind].text, { range: kind === 'sensors' ? SENSOR_RANGE : DERELICT_GUN.range, damage: DERELICT_GUN.damage });
}

/** A derelict station's name in the hub's language. */
function derelictName(kind: DerelictKind): string {
  return t(DERELICT_DEFS[kind].name);
}

/** A short-lived shot (a beam from x, y to x2, y2) or wreck (a ring of radius r at x, y). */
export interface Effect extends Point {
  color: number;
  life: number;
  x2?: number;
  y2?: number;
  r?: number;
  /** `rank` marks a rank-up's gold ring, which is no explosion and makes no boom. */
  kind?: 'rank';
}

export interface Side {
  index: number;
  def: Faction;
  crystal: number;
  alive: boolean;
  thinkMs: number;
  attackMs: number;
  /** Rank perks from finished contracts: the player's, and a rival's from its own (`deal`). */
  perks: Perks;
  /** A rival's own contract chain (see AI_DEAL_MS); the player's side keeps it empty unless watching. */
  deal: Deal;
  /** The warship this rival has sent to contest the relay beacon, or -1. */
  picket: number;
  /** Hull, weapons and engines research, bought at the hub. */
  research: Research;
  /** The faction that hit this one last, or -1: an AI sends its army after it. */
  grudge: number;
  /** While above 0, tribute holds the grudge where it is: hits don't change it. */
  grudgeLockMs: number;
  /** Time left on this rival's truce with the player, or 0. */
  truceMs: number;
  /** Time left on this rival's open truce offer to the player, or 0. */
  offerMs: number;
  /** Time before this rival offers a truce again. */
  offerCooldownMs: number;
  /** Ships lost to the player lately; it fades, and enough of it makes a rival sue for peace. */
  pressure: number;
  /** The warship this rival has sent to claim a derelict station, or -1. */
  claimer: number;
  /** The flagship (the player's only): locked until the third contract, then ready, building, out, or lost for good. */
  flagship: { state: 'locked' | 'ready' | 'building' | 'out' | 'lost'; left: number };
  /** The rally point (the player's only): new warships from its Barracks and shipyard fly there, or null. */
  rally: Point | null;
  /** The next of RALLY_SPOTS a new warship takes round the rally point. */
  rallyNext: number;
}

/**
 * A rival's own contract chain: the board step it is on (1 to CONTRACT_STEPS), the contract it
 * works on (null between two, and once the chain is done), its progress, how long it has worked
 * on it, and the goals finished.
 */
export interface Deal {
  step: number;
  goal: Goal | null;
  progress: number;
  ms: number;
  done: Goal[];
}

/**
 * The relay beacon, on a crystal node in mid-map. A faction alone in its ring fills `capture`
 * (draining a rival's first); at 1 it owns the beacon, which pays BEACON_PAY crystal a second
 * while one of its ships is in the ring (`held`).
 */
export interface Beacon extends Point {
  owner: number;
  /** Who the capture progress belongs to, or -1. */
  capturer: number;
  capture: number;
  held: boolean;
  payMs: number;
  /** Crystal the beacon has paid the player so far. */
  paid: number;
}

/** A glowing salvage shard left by a destroyed ship for the faction that destroyed it; its nearest ship pulls it in. */
export interface Shard extends Point {
  id: number;
  /** The faction the shard pays. */
  faction: number;
  value: number;
  life: number;
}

/** A floating number over the map (+8 salvage, +3 relay), for the scene to show. */
export interface Pop extends Point {
  text: string;
  color: number;
  life: number;
}

/**
 * The contract chain: `index` is the step (0 for the first contract, CONTRACT_STEPS once all are
 * done), `goal` the contract being worked on (null while the board is up), `offer` the board's
 * cards and `boardMs` the time left before it takes the first, `done` and `taken` the goals
 * finished and picked so far (a failed one is taken but not done).
 */
export interface ContractState {
  index: number;
  progress: number;
  goal: Goal | null;
  offer: Goal[];
  boardMs: number;
  done: Goal[];
  taken: Goal[];
}

/** The last-stand pact once signed: time to the next raid, and the raids so far. */
export interface Pact {
  ms: number;
  waves: number;
}

/** What a rival hit, for an attack alert: a harvester, a warship or a building. */
export type Struck = 'harvester' | 'ship' | 'building';

/**
 * Things the scene shows once: a notice on the command bar, crystal gained (flashed by the count),
 * or a rival's hit on one of the player's units or buildings (an attack alert, never in watch mode).
 */
export type WorldEvent =
  | { kind: 'notice'; text: string }
  | { kind: 'gain'; amount: number }
  | { kind: 'hit'; x: number; y: number; struck: Struck }
  | { kind: 'cue'; cue: Cue; x?: number; y?: number };

/**
 * Something the scene plays a sound for (the world has no audio of its own). All are the player's,
 * except `hubFalls`, which comes with the hub's spot for any faction.
 */
export type Cue =
  | 'built' | 'warpIn' | 'researchDone' | 'rankUp' | 'contractStarted' | 'contractDone' | 'contractFailed'
  | 'won' | 'lost' | 'truceOffered' | 'truceMade' | 'truceBroken' | 'tribute' | 'klaxon'
  | 'flagshipReady' | 'flagshipLaunched' | 'flagshipLost' | 'hubFalls';

/** Anything that can fire a shot. */
type Shooter = Unit | Building | Derelict;

export interface Target {
  kind: 'unit' | 'building';
  id: number;
  faction: number;
}

/** How big an AI army gets before it attacks: the difficulty's balance number. */
const AI_ARMY_TO_ATTACK = byDifficulty(9, 6, 4);

/** A unit's numbers in its faction, with the faction's multipliers applied. */
export function unitStats(side: Side, type: UnitId) {
  const d = side.def.units[type];
  const tune = side.def.tune;
  const p = side.perks;
  const r = side.research;
  return {
    name: t(d.name),
    cost: Math.round(d.cost * tune.cost * p.cost),
    trainMs: Math.round(d.trainMs * p.train),
    hp: Math.round(d.hp * tune.hp * p.hp * researchBonus(r, 'hull')),
    speed: d.speed * tune.speed * p.speed * researchBonus(r, 'engines'),
    sight: Math.round(d.sight * p.sight),
    weapon: d.weapon && {
      damage: Math.round(d.weapon.damage * tune.damage * p.damage * researchBonus(r, 'weapons')),
      range: d.weapon.range,
      cooldownMs: d.weapon.cooldownMs,
    },
  };
}

/** A building's numbers in its faction, with the faction's multipliers applied. */
export function buildingStats(side: Side, role: Role) {
  const d = side.def.buildings[role];
  const tune = side.def.tune;
  return {
    name: t(d.name),
    cost: Math.round(d.cost * tune.cost),
    hp: Math.round(d.hp * tune.hp),
    radius: d.radius,
    weapon: d.weapon && {
      damage: Math.round(d.weapon.damage * tune.damage * side.perks.turretDamage),
      range: Math.round(d.weapon.range * side.perks.turretRange),
      cooldownMs: d.weapon.cooldownMs,
    },
  };
}

/** The flagship's numbers in a faction: its heavy's, scaled up into a slow capital ship. */
export function flagshipStats(side: Side) {
  const heavy = unitStats(side, 'heavy');
  return {
    ...heavy,
    name: t(side.def.flagship.name),
    cost: Math.round(FLAGSHIP_COST * side.def.tune.cost * side.perks.cost),
    trainMs: FLAGSHIP_MS,
    hp: Math.round(heavy.hp * FLAGSHIP_HP),
    speed: heavy.speed * FLAGSHIP_SPEED,
    weapon: heavy.weapon && { ...heavy.weapon, damage: Math.round(heavy.weapon.damage * FLAGSHIP_DAMAGE), range: heavy.weapon.range + FLAGSHIP_RANGE },
  };
}

/** An expansion's numbers in a faction: a smaller copy of its hub. */
export function expansionStats(side: Side) {
  const hub = buildingStats(side, 'hub');
  return {
    name: t(side.def.outpost),
    cost: Math.round(EXPANSION_COST * side.def.tune.cost),
    hp: Math.round(hub.hp * EXPANSION_HP),
    radius: hub.radius,
    buildMs: EXPANSION_MS,
  };
}

/** What something on the build buttons costs and is called in a faction. */
export function buildInfo(side: Side, what: Build) {
  if (what === 'expansion') return expansionStats(side);
  const s = buildingStats(side, what);
  return { ...s, buildMs: side.def.buildings[what].buildMs };
}

/** What the next level of a research track costs a faction (the last level's cost once it is maxed). */
export function researchCost(side: Side, track: Track) {
  const level = Math.min(side.research.levels[track], RESEARCH_LEVELS - 1);
  return Math.round(RESEARCH_COSTS[level] * side.def.tune.cost);
}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * The battle on one map: crystal, the factions' bases and armies, and the rules that move them.
 * It has no Phaser in it; the scene draws `World` each frame and sends it the player's commands.
 */
export class World {
  readonly sides: Side[];
  readonly nodes: Node[];
  units: Unit[] = [];
  buildings: Building[] = [];
  beams: Effect[] = [];
  booms: Effect[] = [];
  phase: 'playing' | 'won' | 'lost' = 'playing';
  elapsedMs = 0;
  readonly beacon: Beacon;
  /** The derelict stations, claimed by holding them. */
  readonly derelicts: Derelict[];
  shards: Shard[] = [];
  mines: Mine[] = [];
  pops: Pop[] = [];
  /** What the player can see: cells in sight now and cells explored before. */
  readonly fog = new Fog();
  /**
   * Rival buildings the player has seen, by id, as last seen: under the fog they stay drawn from
   * this (even once fallen, taken or finished), until their spot is in sight again.
   */
  readonly known = new Map<number, SeenBuilding>();
  /** The contract chain's place: which contract is current or on the board, and how far along it is. */
  contract: ContractState = { index: 0, progress: 0, goal: 'barracks', offer: [], boardMs: 0, done: [], taken: ['barracks'] };
  /** Where the convoy contract's harvesters are flying (a crystal node), while one is under way. */
  convoyTo: (Point & { node: number }) | null = null;
  /** The last-stand pact, once the rivals have signed it. */
  pact: Pact | null = null;
  /** The campaign sector this battle is in (an index into SECTORS). */
  readonly sector: number;
  /** Crystal the player has collected from salvage shards. */
  salvaged = 0;
  /** Enemy ships the player has destroyed. */
  kills = 0;
  /** One-off things for the scene to show; it empties the list as it reads them. */
  events: WorldEvent[] = [];
  private nextId = 1;

  /** The last faction standing in a watched battle (a side index), or -1. */
  winner = -1;
  /** Which factions can see each ship hiding in a nebula this update (by unit id), from `updateCover`. */
  private spotted = new Map<number, Set<number>>();
  /** The board's own generator, so drawing contracts leaves the battle's Math.random as it was. */
  private readonly rng: () => number;
  /** The rivals' own generator for picking their contracts, so neither the board's draws nor Math.random move. */
  private readonly dealRng: () => number;
  /** Ships' way round the rocks. */
  readonly pathing: Pathing;
  /** Each ship's way round the rocks while its straight flight is blocked: the waypoints, where to, and when it was found. */
  private readonly routes = new WeakMap<Unit, { path: Point[]; to: Point; at: number }>();

  /**
   * `pick` is the faction the player commands, an index into `FACTIONS`. It takes the player's start
   * point (slot 0); the other factions fill the rest in their usual order. With `watch` the AI plays
   * slot 0 too, nothing is fogged, and the battle ends when one faction is left (`winner`). `sector`
   * is the campaign sector (its rivals start stronger) and `kept` the perks the campaign carries in.
   */
  constructor(readonly layout: MapLayout, pick = 0, readonly watch = false, sector = 0, kept: readonly Goal[] = []) {
    this.sector = sector;
    const order = [pick, ...FACTIONS.map((_, i) => i).filter((i) => i !== pick)];
    this.sides = order.map((f, index) => ({
      index, def: FACTIONS[f], crystal: START_CRYSTAL, alive: true, thinkMs: 0, attackMs: 0, perks: { ...NO_PERKS }, picket: -1,
      research: noResearch(), grudge: -1, grudgeLockMs: 0, truceMs: 0, offerMs: 0, offerCooldownMs: 0, pressure: 0, claimer: -1,
      flagship: { state: 'locked', left: 0 }, rally: null, rallyNext: 0, deal: { step: 1, goal: null, progress: 0, ms: 0, done: [] },
    }));
    for (const goal of kept) contractOf(goal).apply(this.sides[PLAYER].perks);
    this.rng = localRandom((layout.homes[0].x * 3.7 + layout.homes[0].y) % 1);
    this.dealRng = localRandom((layout.homes[0].y * 5.3 + layout.homes[0].x) % 1);
    this.pathing = new Pathing(layout.rocks, UNIT_RADIUS - ROCK_OVERLAP);
    const nodes = layout.nodes.map((n) => ({ id: this.id(), x: n.x, y: n.y, amount: n.amount }));
    // One loose crystal node partway to the centre becomes the relay beacon and is no longer mined.
    const spot = nodes[beaconNode(layout.homes, layout.nodes)];
    this.nodes = nodes.filter((n) => n !== spot);
    this.beacon = { x: spot.x, y: spot.y, owner: -1, capturer: -1, capture: 0, held: false, payMs: 0, paid: 0 };
    this.derelicts = layout.derelicts.map((d) => ({
      kind: 'derelict', id: this.id(), perk: d.kind, x: d.x, y: d.y, owner: -1, capturer: -1, claim: 0, queue: [], trainLeft: 0, cooldown: 0,
    }));
    this.sides.forEach((side, index) => {
      const home = layout.homes[index];
      const hp = buildingStats(side, 'hub').hp;
      const hub: Building = {
        kind: 'building', id: this.id(), faction: index, type: 'hub', x: home.x, y: home.y,
        hp, maxHp: hp, done: true, buildLeft: 0, queue: [], trainLeft: 0, cooldown: 0, disabledMs: 0, hacks: 0, layMs: 0,
        lastHit: -1, expansion: false, buildMs: 0,
      };
      this.buildings.push(hub);
      this.spawn(index, 'harvester', home.x - 30, home.y + 34).home = hub.id;
      this.spawn(index, 'harvester', home.x + 30, home.y + 34).home = hub.id;
    });
    // A harder campaign sector: rivals start richer, further researched, and some with an outpost.
    const setup: Sector = SECTORS[sector] ?? SECTORS[0];
    this.sides.forEach((side, index) => {
      if (index === PLAYER) return;
      side.crystal += setup.rivalCrystal;
      for (const t of TRACKS) side.research.levels[t] = setup.rivalResearch;
      if (index <= setup.outposts) this.seedOutpost(index);
    });
    this.updateFog();
  }

  private id() {
    return this.nextId++;
  }

  unit(id: number) {
    return this.units.find((u) => u.id === id);
  }

  building(id: number) {
    return this.buildings.find((b) => b.id === id);
  }

  /** A faction's main hub: the one it started with, whose fall ends it. */
  hubOf(faction: number) {
    return this.buildings.find((b) => b.faction === faction && b.type === 'hub' && !b.expansion);
  }

  /** A faction's hubs, main and expansions; `done` leaves out expansions still being built. */
  hubsOf(faction: number, done = false) {
    return this.buildings.filter((b) => b.faction === faction && b.type === 'hub' && (!done || b.done));
  }

  /** Whether the player sees a unit now: its own, or a rival's in sight and not hidden (cloaked or in a nebula). Watching, every ship shows. */
  seesUnit(u: Unit) {
    return u.faction === PLAYER || this.watch || (this.fog.sees(u) && !this.hidden(u, PLAYER));
  }

  /** Whether a point is inside a nebula. */
  inNebula(p: Point) {
    return this.layout.nebulae.some((n) => dist(n, p) <= n.r);
  }

  /** The derelict station whose ring is under (x, y), if the player knows of it. */
  derelictAt(x: number, y: number): Derelict | null {
    return this.derelicts.find((d) => dist(d, { x, y }) <= DERELICT_RADIUS && (this.watch || this.fog.knows(d))) ?? null;
  }

  /** Whether two factions are under a truce (the player with one rival), or both rivals in the last-stand pact. */
  atPeace(a: number, b: number) {
    if (a === b) return false;
    if (this.pact && a !== PLAYER && b !== PLAYER) return true;
    return (a === PLAYER && this.sides[b].truceMs > 0) || (b === PLAYER && this.sides[a].truceMs > 0);
  }

  /** The contract being worked on, or null while the board is up or once the chain is done. */
  currentContract(): Contract | null {
    return this.contract.goal ? contractOf(this.contract.goal) : null;
  }

  /** The player picks one of the board's two contracts; it starts at once. */
  pickContract(goal: Goal): string | null {
    if (this.phase !== 'playing') return t('battleOver');
    if (this.contract.goal || !this.contract.offer.includes(goal)) return t('notOnBoard');
    this.startContract(goal);
    return null;
  }

  /** Starts building the flagship at the player's hub, once the third contract has unlocked it. One per battle. */
  buildFlagship(): string | null {
    if (this.phase !== 'playing') return t('battleOver');
    const side = this.sides[PLAYER];
    const f = side.flagship;
    if (f.state === 'locked') return t('flagshipLocked', { n: FLAGSHIP_STEP });
    if (f.state === 'building') return t('flagshipBuilding');
    if (f.state === 'out') return t('flagshipOut');
    if (f.state === 'lost') return t('flagshipGone');
    if (!this.hubOf(PLAYER)) return t('noHub');
    const cost = flagshipStats(side).cost;
    if (side.crystal < cost) return t('notEnoughCrystal');
    side.crystal -= cost;
    f.state = 'building';
    f.left = FLAGSHIP_MS;
    return null;
  }

  /** A ship's veteran rank: how many of VETERAN_RANKS its kills have reached. */
  rankOf(u: Unit) {
    return VETERAN_RANKS.filter((k) => u.kills >= k).length;
  }

  /** What a ship's rank multiplies its damage and hit points by. */
  veteranBonus(u: Unit) {
    return 1 + VETERAN_STEP * this.rankOf(u);
  }

  /** Whether the player sees a mine: its own, or a rival's in sight with a player ship close by. */
  seesMine(m: Mine) {
    if (m.faction === PLAYER) return true;
    return this.fog.sees(m) && this.units.some((u) => u.faction === PLAYER && dist(u, m) <= MINE_SPOT);
  }

  /** How many units of a faction are alive, or of one type. */
  count(faction: number, type?: UnitId) {
    return this.units.filter((u) => u.faction === faction && (!type || u.type === type)).length;
  }

  /**
   * Why a building of `role` can't go at (x, y) for `faction`, or null when it can. Buildings go
   * within BUILD_RANGE of one of the faction's finished hubs; an expansion goes beside a crystal
   * node far from them. The player can only build where it has explored.
   */
  placementProblem(role: Build, x: number, y: number, faction = PLAYER): string | null {
    const side = this.sides[faction];
    const r = buildInfo(side, role).radius;
    if (x < ARENA.x + r || x > ARENA.x + ARENA.w - r || y < ARENA.y + r || y > ARENA.y + ARENA.h - r) {
      return t('offMap');
    }
    if (faction === PLAYER && !this.fog.knows({ x, y })) return t('scoutFirst');
    if (!this.hubOf(faction)) return t('noHub');
    if (role === 'expansion') {
      if (this.hubsOf(faction).some((h) => dist(h, { x, y }) < EXPANSION_GAP)) return t('tooCloseHubs');
      if (!this.nodes.some((n) => n.amount > 0 && dist(n, { x, y }) <= EXPANSION_NEAR)) return t('besideField');
    } else if (!this.hubsOf(faction, true).some((h) => dist(h, { x, y }) <= BUILD_RANGE)) {
      return t('tooFarHub');
    }
    if (this.buildings.some((b) => dist(b, { x, y }) < buildingStats(this.sides[b.faction], b.type).radius + r + 6)) {
      return t('tooCloseBuilding');
    }
    if (this.layout.rocks.some((k) => dist(k, { x, y }) < k.r + r + 4)) return t('blockedRocks');
    if (this.nodes.some((n) => n.amount > 0 && dist(n, { x, y }) < NODE_CLEARANCE + r)) return t('tooCloseCrystal');
    if (dist(this.beacon, { x, y }) < NODE_CLEARANCE + r + 10) return t('tooCloseBeacon');
    if (this.derelicts.some((d) => dist(d, { x, y }) < DERELICT_RADIUS + r)) return t('tooCloseDerelict');
    return null;
  }

  /** Starts a building for `faction` at (x, y), paying for it. Returns why not, or null when it started. */
  build(role: Build, x: number, y: number, faction = PLAYER): string | null {
    if (this.phase !== 'playing') return t('battleOver');
    const problem = this.placementProblem(role, x, y, faction);
    if (problem) return problem;
    const side = this.sides[faction];
    const stats = buildInfo(side, role);
    if (side.crystal < stats.cost) return t('notEnoughCrystal');
    side.crystal -= stats.cost;
    this.buildings.push({
      kind: 'building', id: this.id(), faction, type: role === 'expansion' ? 'hub' : role, x, y, hp: stats.hp, maxHp: stats.hp,
      done: false, buildLeft: stats.buildMs, queue: [], trainLeft: 0, cooldown: 0, disabledMs: 0, hacks: 0, layMs: 0,
      lastHit: -1, expansion: role === 'expansion', buildMs: stats.buildMs,
    });
    return null;
  }

  /** Starts the next level of a research track at `faction`'s hub, paying for it. Returns why not, or null. */
  research(track: Track, faction = PLAYER): string | null {
    if (this.phase !== 'playing') return t('battleOver');
    const side = this.sides[faction];
    if (!this.hubOf(faction)) return t('noHub');
    const r = side.research;
    if (r.current) return t('alreadyResearching', { track: t(TRACK_DEFS[r.current.track].name) });
    if (r.levels[track] >= RESEARCH_LEVELS) return t('fullyResearched', { track: t(TRACK_DEFS[track].name) });
    const cost = researchCost(side, track);
    if (side.crystal < cost) return t('notEnoughCrystal');
    side.crystal -= cost;
    r.current = { track, left: RESEARCH_MS };
    return null;
  }

  /** Queues a unit for `faction`, paying for it: harvesters at the hub, the rest at a barracks. */
  train(type: UnitId, faction = PLAYER): string | null {
    if (this.phase !== 'playing') return t('battleOver');
    const side = this.sides[faction];
    const cost = unitStats(side, type).cost;
    if (side.crystal < cost) return t('notEnoughCrystal');
    // Harvesters come from a hub, combat units from a Barracks or a claimed derelict shipyard.
    const producers: { queue: UnitId[] }[] = this.buildings.filter(
      (b) => b.faction === faction && b.done && b.type === (type === 'harvester' ? 'hub' : 'barracks'),
    );
    if (type !== 'harvester') producers.push(...this.derelicts.filter((d) => d.perk === 'shipyard' && d.owner === faction));
    if (!producers.length) {
      return type === 'harvester' ? t('noHub') : t('buildBarracksFirst', { barracks: t(side.def.buildings.barracks.name) });
    }
    const producer = producers.reduce((a, b) => (b.queue.length < a.queue.length ? b : a));
    if (producer.queue.length >= MAX_QUEUE) return t('queueFull');
    side.crystal -= cost;
    producer.queue.push(type);
    // The player hears when a ship goes to the derelict shipyard rather than their own Barracks.
    const yard = this.derelicts.find((d) => d === producer);
    if (faction === PLAYER && yard) this.events.push({ kind: 'notice', text: t('queuedAtDerelict', { unit: t(side.def.units[type].name), derelict: derelictName(yard.perk) }) });
    return null;
  }

  /**
   * The player's order to the selected combat units: attack what is at (x, y) when it is an enemy,
   * otherwise move there. Harvesters are not commanded.
   */
  command(ids: number[], x: number, y: number): boolean {
    if (this.phase !== 'playing') return false;
    const target = this.entityAt(x, y);
    // A rival building under the fog is attacked as last seen, whether it still stands or has fallen.
    const known = target?.kind === 'building' ? this.known.get(target.id) : undefined;
    const seen = known && !this.fog.sees(known) ? known : undefined;
    const units = ids.map((id) => this.unit(id)).filter((u): u is Unit => !!u && this.commandable(u));
    // An attack on a rival under truce breaks the truce.
    if (units.length && target && target.faction !== PLAYER && this.atPeace(PLAYER, target.faction)) {
      const side = this.sides[target.faction];
      side.truceMs = 0;
      side.grudge = PLAYER;
      this.cue('truceBroken');
      this.events.push({ kind: 'notice', text: t('truceBroken', { faction: t(side.def.name) }) });
    }
    // A wing sent to one point fans out round it (RALLY_SPOTS) rather than stacking on it.
    units.forEach((u, k) => {
      const spot = units.length > 1 ? RALLY_SPOTS[k % RALLY_SPOTS.length] : { x: 0, y: 0 };
      u.order = target && target.faction !== PLAYER
        ? { kind: 'attack', id: target.id, auto: false, seen: seen ? { x: seen.x, y: seen.y, faction: seen.faction } : undefined }
        : {
          kind: 'move',
          x: Math.min(ARENA.x + ARENA.w - 8, Math.max(ARENA.x + 8, x + spot.x)),
          y: Math.min(ARENA.y + ARENA.h - 8, Math.max(ARENA.y + 8, y + spot.y)),
        };
    });
    return units.length > 0;
  }

  /**
   * Plants the player's rally point at (x, y): from now on every new warship from a Barracks or a
   * held shipyard flies there, each to the next spot round it. Ships already flying are not moved.
   */
  setRally(x: number, y: number) {
    const side = this.sides[PLAYER];
    side.rally = {
      x: Math.min(ARENA.x + ARENA.w - 8, Math.max(ARENA.x + 8, x)),
      y: Math.min(ARENA.y + ARENA.h - 8, Math.max(ARENA.y + 8, y)),
    };
    side.rallyNext = 0;
  }

  /** Takes the player's rally point down: new warships wait by the building again. */
  clearRally() {
    this.sides[PLAYER].rally = null;
  }

  /** A new warship of a faction with a rally point flies to the next free spot round it. */
  private toRally(u: Unit) {
    const side = this.sides[u.faction];
    if (!side.rally || u.type === 'harvester') return;
    const spot = RALLY_SPOTS[side.rallyNext % RALLY_SPOTS.length];
    side.rallyNext += 1;
    u.order = {
      kind: 'move',
      x: Math.min(ARENA.x + ARENA.w - 8, Math.max(ARENA.x + 8, side.rally.x + spot.x)),
      y: Math.min(ARENA.y + ARENA.h - 8, Math.max(ARENA.y + 8, side.rally.y + spot.y)),
    };
  }

  /** The player's order to fall back: the selected ships fly home to the nearest hub or Depot, where ships repair. */
  fallBack(ids: number[]): boolean {
    if (this.phase !== 'playing') return false;
    const units = ids.map((id) => this.unit(id)).filter((u): u is Unit => !!u && this.commandable(u));
    let sent = 0;
    for (const u of units) if (this.sendHome(u)) sent += 1;
    return sent > 0;
  }

  /** Accepts a rival's truce offer: peace for TRUCE_MS, and its tribute paid into the player's bank. */
  acceptTruce(faction: number): string | null {
    const side = this.sides[faction];
    if (faction === PLAYER || !side.alive) return t('noRival');
    if (side.offerMs <= 0) return t('noTruceOffer', { faction: t(side.def.name) });
    const tribute = Math.min(TRUCE_TRIBUTE, side.crystal);
    side.crystal -= tribute;
    this.sides[PLAYER].crystal += tribute;
    side.offerMs = 0;
    side.offerCooldownMs = OFFER_COOLDOWN_MS;
    side.truceMs = TRUCE_MS;
    side.grudge = -1;
    side.pressure = 0;
    // Both sides call off the ships already sent at each other.
    for (const u of this.units) {
      if (u.order?.kind !== 'attack') continue;
      const target = this.unit(u.order.id) ?? this.building(u.order.id);
      if (target && this.atPeace(u.faction, target.faction)) u.order = null;
    }
    this.events.push({ kind: 'gain', amount: tribute });
    this.cue('truceMade');
    this.events.push({ kind: 'notice', text: t('truceMade', { faction: t(side.def.name), s: TRUCE_MS / 1000, n: tribute }) });
    return null;
  }

  /** Turns a rival's truce offer down; it waits a while before offering again. */
  declineTruce(faction: number): string | null {
    const side = this.sides[faction];
    if (faction === PLAYER || side.offerMs <= 0) return t('noOffer');
    side.offerMs = 0;
    side.offerCooldownMs = OFFER_COOLDOWN_MS / 2;
    return null;
  }

  /** The faction a bribed rival turns on: the living faction nearest its hub, other than the player and itself. */
  bribeTarget(faction: number): Side | null {
    const hub = this.hubOf(faction);
    if (!hub || this.pact) return null;
    return this.sides
      .filter((s) => s.alive && s.index !== faction && s.index !== PLAYER && this.hubOf(s.index))
      .reduce<Side | null>((best, s) => (!best || dist(this.hubOf(s.index)!, hub) < dist(this.hubOf(best.index)!, hub) ? s : best), null);
  }

  /** Pays a rival tribute to turn its grudge onto another faction for BRIBE_MS; its next raids go there. */
  bribe(faction: number): string | null {
    if (this.phase !== 'playing') return t('battleOver');
    const side = this.sides[faction];
    if (faction === PLAYER || !side.alive) return t('noRival');
    if (this.pact) return t('inPact');
    const target = this.bribeTarget(faction);
    if (!target) return t('noTarget');
    const me = this.sides[PLAYER];
    if (me.crystal < BRIBE_COST) return t('notEnoughCrystal');
    me.crystal -= BRIBE_COST;
    side.crystal += BRIBE_COST;
    side.grudge = target.index;
    side.grudgeLockMs = BRIBE_MS;
    side.pressure = 0;
    // Its ships already on their way at the player turn on the new foe instead.
    const hub = this.hubOf(target.index);
    for (const u of this.units) {
      if (u.faction !== faction || u.order?.kind !== 'attack' || u.order.auto) continue;
      const t = this.unit(u.order.id) ?? this.building(u.order.id);
      if (t?.faction === PLAYER && hub) u.order = { kind: 'attack', id: hub.id, auto: false };
    }
    this.cue('tribute');
    this.events.push({ kind: 'notice', text: t('tributePaid', { faction: t(side.def.name), target: t(target.def.name), s: BRIBE_MS / 1000 }) });
    return null;
  }

  /**
   * Sends a ship home to repair: a move order to the nearest finished hub, outpost or Depot of its
   * faction, stopping just short of it. False when the faction has nowhere to go.
   */
  private sendHome(u: Unit): boolean {
    const spot = this.repairSpots(u.faction).reduce<Building | null>((best, b) => (!best || dist(b, u) < dist(best, u) ? b : best), null);
    if (!spot) return false;
    const d = dist(u, spot);
    const stop = buildingStats(this.sides[u.faction], spot.type).radius + FALL_BACK_STOP;
    const k = d > 1 ? stop / d : 0;
    u.order = { kind: 'move', x: spot.x + (u.x - spot.x) * k, y: spot.y + (u.y - spot.y) * k + (d > 1 ? 0 : stop) };
    return true;
  }

  /** Where a faction's ships repair: its finished hubs, outposts and Depots. */
  private repairSpots(faction: number) {
    return this.buildings.filter((b) => b.faction === faction && b.done && (b.type === 'hub' || b.type === 'depot'));
  }

  /** The player's combat units inside a box, for box selection. */
  selectableIn(x0: number, y0: number, x1: number, y1: number): number[] {
    const left = Math.min(x0, x1), right = Math.max(x0, x1), top = Math.min(y0, y1), bottom = Math.max(y0, y1);
    return this.units
      .filter((u) => this.commandable(u) && u.x >= left && u.x <= right && u.y >= top && u.y <= bottom)
      .map((u) => u.id);
  }

  /** Every combat unit the player can command, for selecting the whole fleet. */
  fleet(): number[] {
    return this.units.filter((u) => this.commandable(u)).map((u) => u.id);
  }

  /** Whether a click on this unit selects it: only the player's combat units. */
  selectable(id: number): boolean {
    const u = this.unit(id);
    return !!u && this.commandable(u);
  }

  /**
   * The nearest unit or building under (x, y), units first, as the player's map shows them: units
   * in sight, the player's own buildings, and rivals' as last seen (`known`), even one that has
   * fallen under the fog since, whose id then names no building.
   */
  entityAt(x: number, y: number): Target | null {
    let best: Target | null = null;
    let bestD = Infinity;
    for (const u of this.units) {
      const d = dist(u, { x, y });
      if (d < UNIT_RADIUS + 2 && d < bestD && this.seesUnit(u)) {
        best = { kind: 'unit', id: u.id, faction: u.faction };
        bestD = d;
      }
    }
    if (best) return best;
    const shown: (Building | SeenBuilding)[] = [...this.buildings.filter((b) => b.faction === PLAYER), ...this.known.values()];
    for (const b of shown) {
      const d = dist(b, { x, y });
      const r = buildingStats(this.sides[b.faction], b.type).radius + 4;
      if (d < r && d < bestD) {
        best = { kind: 'building', id: b.id, faction: b.faction };
        bestD = d;
      }
    }
    return best;
  }

  private commandable(u: Unit) {
    return u.faction === PLAYER && u.type !== 'harvester' && u.decoyMs === null;
  }

  /** Advances the battle by `dt` milliseconds of game time. */
  update(dt: number) {
    this.beams = this.beams.filter((b) => (b.life -= dt) > 0);
    this.booms = this.booms.filter((b) => (b.life -= dt) > 0);
    this.pops = this.pops.filter((p) => (p.life -= dt) > 0);
    if (this.phase !== 'playing') return;
    this.elapsedMs += dt;

    this.updateCover();
    for (const b of [...this.buildings]) this.updateBuilding(b, dt);
    for (const d of this.derelicts) this.updateDerelict(d, dt);
    for (const u of [...this.units]) this.updateUnit(u, dt);
    this.spread(dt);
    for (const side of this.sides) {
      if (!side.alive || (side.index === PLAYER && !this.watch)) continue;
      this.updateTruce(side, dt);
      side.thinkMs += dt;
      if (side.thinkMs >= AI_THINK_MS) {
        side.thinkMs = 0;
        this.think(side);
      }
    }
    this.updatePact(dt);
    this.updateMines();
    this.removeDead();
    this.updateResearch(dt);
    this.updateFlagship(dt);
    this.updateBeacon(dt);
    this.updateShards(dt);
    // The player's own contracts; a watched battle runs every side's rival chain instead (updateDeals).
    if (!this.watch) this.updateContract(dt);
    this.updateDeals(dt);
    this.updateFog();
    if (this.watch) {
      const left = this.sides.filter((s) => s.alive);
      if (left.length <= 1) {
        this.winner = left[0]?.index ?? -1;
        this.phase = 'won';
      }
    } else if (!this.sides[PLAYER].alive) this.phase = 'lost';
    else if (this.sides.every((s) => s.index === PLAYER || !s.alive)) this.phase = 'won';
  }

  private updateBuilding(b: Building, dt: number) {
    if (!b.done) {
      b.buildLeft -= dt;
      if (b.buildLeft <= 0) {
        b.done = true;
        if (b.faction === PLAYER) this.cue('built');
      }
      return;
    }
    const side = this.sides[b.faction];
    if (b.queue.length) {
      if (b.trainLeft <= 0) b.trainLeft = unitStats(side, b.queue[0]).trainMs;
      b.trainLeft -= dt;
      if (b.trainLeft <= 0) {
        const type = b.queue.shift()!;
        b.trainLeft = 0;
        const unit = this.spawn(b.faction, type, b.x, b.y + buildingStats(side, b.type).radius + 14);
        if (type === 'harvester') unit.home = b.id;
        else this.toRally(unit);
        if (b.faction === PLAYER) this.cue('warpIn');
      }
    }
    if (b.disabledMs > 0) {
      b.disabledMs = Math.max(0, b.disabledMs - dt);
      // A hack that runs out before the takeover leaves the turret as it was.
      if (b.disabledMs <= 0) b.hacks = 0;
    }
    const ability = this.abilityOf(b);
    if (ability?.kind === 'mines' && b.disabledMs <= 0) {
      b.layMs += dt;
      if (b.layMs >= ability.everyMs) {
        b.layMs = 0;
        this.layMine(b, ability.reach, ability.cap);
      }
    }
    const weapon = buildingStats(side, b.type).weapon;
    if (!weapon) return;
    b.cooldown -= dt;
    if (b.cooldown > 0 || b.disabledMs > 0) return;
    const target = this.nearestEnemy(b, b.faction, weapon.range);
    if (target) {
      this.shoot(b, weapon.damage, target);
      b.cooldown = weapon.cooldownMs;
    }
  }

  /** A unit's numbers: its type's in its faction, or the flagship's. */
  private statsOf(u: Unit) {
    const side = this.sides[u.faction];
    return u.flagship ? flagshipStats(side) : unitStats(side, u.type);
  }

  private updateUnit(u: Unit, dt: number) {
    const stats = this.statsOf(u);
    const ability = this.abilityOf(u);
    u.cooldown -= dt;
    u.revealMs = Math.max(0, u.revealMs - dt);
    u.repairing = false;
    if (u.decoyMs !== null) {
      // A decoy only draws fire: it never acts, and it fades when its time runs out.
      u.decoyMs -= dt;
      if (u.decoyMs <= 0) u.hp = 0;
      return;
    }
    // A nebula slows every ship inside it.
    const speed = u.nebula ? stats.speed * NEBULA_SLOW : stats.speed;
    // Beside a hub or Depot of its own, a ship slowly repairs.
    if (u.hp < u.maxHp && this.repairSpots(u.faction).some((b) => dist(b, u) <= REPAIR_RANGE)) {
      u.hp = Math.min(u.maxHp, u.hp + (u.maxHp * REPAIR_RATE * this.sides[u.faction].perks.repair * dt) / 1000);
      u.repairing = true;
    }
    if (ability?.kind === 'decoy' || ability?.kind === 'brood') {
      u.timer += dt;
      if (u.timer >= ability.everyMs) {
        u.timer = 0;
        this.ability(u, ability);
      }
    }
    if (u.convoy) {
      this.escort(u, dt, speed);
      return;
    }
    if (u.type === 'harvester') {
      this.harvest(u, dt, speed);
      return;
    }
    if (!u.order) this.acquire(u, stats.sight);
    const order = u.order;
    if (!order) return;
    if (order.kind === 'move') {
      // A move onto a rock stops at its edge.
      this.offRocks(order, -1, -1, 0);
      if (this.approach(u, order.x, order.y, 2, dt, speed)) u.order = null;
      return;
    }
    const target = this.unit(order.id) ?? this.building(order.id);
    // A building attacked under the fog that has fallen since: fly to where it was last seen until
    // that spot is in sight (when the player forgets it), then take up targets there.
    const seen = order.seen;
    if (!target && seen && !this.fog.sees(seen) && !this.atPeace(u.faction, seen.faction)) {
      this.approach(u, seen.x, seen.y, 2, dt, speed);
      return;
    }
    // A target can change sides when a hack takes it over, slip into a nebula, or come under a truce.
    if (!target || target.hp <= 0 || target.faction === u.faction || this.hidden(target, u.faction) || this.atPeace(u.faction, target.faction)) {
      u.order = null;
      return;
    }
    if (order.auto && dist(u, target) > stats.sight * 1.6) {
      u.order = null;
      return;
    }
    if (!stats.weapon) return;
    const stop = stats.weapon.range + this.radiusOf(target) - 4;
    // Same slack as `approach`, so a unit that stopped at its range can always fire.
    if (dist(u, target) <= stop + 0.5) {
      if (u.cooldown <= 0) {
        this.shoot(u, Math.round(stats.weapon.damage * this.veteranBonus(u)), target);
        u.cooldown = stats.weapon.cooldownMs;
      }
    } else {
      this.approach(u, target.x, target.y, stop, dt, speed);
    }
  }

  /** The ability a unit or building carries, from its faction's definition; a flagship carries the faction's flagship ability. */
  abilityOf(e: Shooter): Ability | undefined {
    if (e.kind === 'derelict') return undefined;
    const def = this.sides[e.faction].def;
    if (e.kind === 'building') return def.buildings[e.type].ability;
    return e.flagship ? def.flagship.ability : def.units[e.type].ability;
  }

  /**
   * Whether `e` is hidden from `faction`: a cloaked unit that has not fired lately, or a ship in a
   * nebula that has not fired lately and that none of `faction`'s ships, buildings or sensors is close to.
   */
  hidden(e: Unit | Building, faction: number) {
    if (e.faction === faction || e.kind !== 'unit' || e.revealMs > 0) return false;
    if (this.abilityOf(e)?.kind === 'cloak') return true;
    return e.nebula && !this.spotted.get(e.id)?.has(faction);
  }

  /**
   * Works out, once an update, which ships are in a nebula and who can see each of them: a faction
   * with a ship within NEBULA_SPOT, a building within NEBULA_SPOT of its edge, or sensors it owns in range.
   */
  private updateCover() {
    this.spotted.clear();
    const covered: Unit[] = [];
    for (const u of this.units) {
      u.nebula = this.inNebula(u);
      if (u.nebula) covered.push(u);
    }
    if (!covered.length) return;
    const sensors = this.derelicts.filter((d) => d.perk === 'sensors' && d.owner >= 0);
    for (const u of covered) {
      const by = new Set<number>();
      for (const v of this.units) if (v.faction !== u.faction && dist(v, u) <= NEBULA_SPOT) by.add(v.faction);
      for (const b of this.buildings) {
        if (b.faction !== u.faction && dist(b, u) <= NEBULA_SPOT + buildingStats(this.sides[b.faction], b.type).radius) by.add(b.faction);
      }
      for (const d of sensors) if (d.owner !== u.faction && dist(d, u) <= SENSOR_RANGE) by.add(d.owner);
      this.spotted.set(u.id, by);
    }
  }

  /**
   * A derelict station: a faction alone in its ring claims it (draining a rival's claim first); the
   * owner's shipyard trains and its gun platform fires.
   */
  private updateDerelict(d: Derelict, dt: number) {
    const present = new Set<number>();
    for (const u of this.units) {
      if (u.type !== 'harvester' && u.decoyMs === null && dist(u, d) <= DERELICT_RADIUS) present.add(u.faction);
    }
    if (d.owner >= 0 && !this.sides[d.owner].alive) this.loseDerelict(d);
    if (present.size === 1) {
      const f = [...present][0];
      const step = dt / CLAIM_MS;
      if (d.capturer === f || d.capturer < 0) {
        d.capturer = f;
        d.claim = Math.min(1, d.claim + step);
        if (d.claim >= 1 && d.owner !== f) {
          if (d.owner === PLAYER) this.cue('lost');
          if (d.owner === PLAYER) this.events.push({ kind: 'notice', text: t('derelictTaken', { derelict: derelictName(d.perk), faction: t(this.sides[f].def.name) }) });
          this.refundQueue(d);
          d.owner = f;
          if (f === PLAYER) this.cue('won');
          if (f === PLAYER) this.events.push({ kind: 'notice', text: t('derelictClaimed', { derelict: derelictName(d.perk), text: derelictText(d.perk) }) });
          else aiLog(String(f), t('aiClaims', { derelict: derelictName(d.perk) }));
        }
      } else {
        d.claim = Math.max(0, d.claim - step);
        if (d.claim <= 0) {
          if (d.owner >= 0) this.loseDerelict(d);
          d.capturer = f;
        }
      }
    }
    const side = d.owner >= 0 ? this.sides[d.owner] : null;
    if (!side) return;
    if (d.perk === 'shipyard' && d.queue.length) {
      if (d.trainLeft <= 0) d.trainLeft = unitStats(side, d.queue[0]).trainMs;
      d.trainLeft -= dt;
      if (d.trainLeft <= 0) {
        const type = d.queue.shift()!;
        d.trainLeft = 0;
        this.toRally(this.spawn(d.owner, type, d.x, d.y + DERELICT_RADIUS * 0.6));
        if (d.owner === PLAYER) this.cue('warpIn');
      }
    }
    if (d.perk === 'gun') {
      d.cooldown -= dt;
      if (d.cooldown > 0) return;
      const target = this.nearestEnemy(d, d.owner, DERELICT_GUN.range);
      if (target) {
        this.shoot(d, DERELICT_GUN.damage, target);
        d.cooldown = DERELICT_GUN.cooldownMs;
      }
    }
  }

  /** A derelict goes back to nobody: its owner fell or was drained out. */
  private loseDerelict(d: Derelict) {
    if (d.owner === PLAYER) this.cue('lost');
    if (d.owner === PLAYER) this.events.push({ kind: 'notice', text: t('derelictLost', { derelict: derelictName(d.perk) }) });
    this.refundQueue(d);
    d.owner = -1;
    d.capturer = -1;
    d.claim = 0;
  }

  /** Ships still queued at a derelict shipyard that changes hands are paid back to its owner. */
  private refundQueue(d: Derelict) {
    if (d.owner >= 0 && d.queue.length) {
      const side = this.sides[d.owner];
      const back = d.queue.reduce((sum, type) => sum + unitStats(side, type).cost, 0);
      side.crystal += back;
      if (d.owner === PLAYER) this.events.push({ kind: 'notice', text: t('derelictRefund', { derelict: derelictName(d.perk), n: back }) });
    }
    d.queue = [];
    d.trainLeft = 0;
  }

  /** A rival's truce, offer, tribute lock and pressure run down with time. */
  private updateTruce(side: Side, dt: number) {
    if (side.truceMs > 0) {
      side.truceMs = Math.max(0, side.truceMs - dt);
      if (side.truceMs <= 0) this.cue('lost');
      if (side.truceMs <= 0) this.events.push({ kind: 'notice', text: t('truceEnded', { faction: t(side.def.name) }) });
    }
    if (side.offerMs > 0) side.offerMs = Math.max(0, side.offerMs - dt);
    side.offerCooldownMs = Math.max(0, side.offerCooldownMs - dt);
    side.grudgeLockMs = Math.max(0, side.grudgeLockMs - dt);
    side.pressure = Math.max(0, side.pressure - dt / PRESSURE_DECAY_MS);
  }

  /** A rival holding a grudge against the player sues for peace when it is under pressure. */
  private considerTruce(side: Side) {
    if (this.watch || this.pact || side.grudge !== PLAYER || side.truceMs > 0 || side.offerMs > 0 || side.offerCooldownMs > 0) return;
    if (side.crystal < TRUCE_TRIBUTE) return;
    const hub = this.hubOf(side.index);
    const pressed = (hub && hub.hp < hub.maxHp * PRESSURE_HUB) || side.pressure >= PRESSURE_LOSSES;
    if (!pressed) return;
    side.offerMs = OFFER_MS;
    this.cue('truceOffered');
    this.events.push({
      kind: 'notice',
      text: t('truceOffered', { faction: t(side.def.name), s: TRUCE_MS / 1000, n: TRUCE_TRIBUTE }),
    });
  }

  /** Carries out a unit's cadenced ability: a decoy copy of itself, or a scout from a brood carrier. */
  private ability(u: Unit, ability: Ability) {
    if (ability.kind === 'decoy') {
      const copy = this.spawn(u.faction, u.type, u.x + 14, u.y + 14, ability.lifeMs);
      copy.hp = Math.round(copy.maxHp / 2);
      copy.maxHp = copy.hp;
    } else if (ability.kind === 'brood' && this.count(u.faction, 'scout') < ability.cap) {
      this.spawn(u.faction, 'scout', u.x, u.y + 16);
    }
  }

  /** Units with no order pick the nearest enemy in sight. */
  private acquire(u: Unit, sight: number) {
    if (sight <= 0) return;
    const target = this.nearestEnemy(u, u.faction, sight);
    if (target) u.order = { kind: 'attack', id: target.id, auto: true };
  }

  /** The nearest enemy unit within range, or else the nearest enemy building. */
  private nearestEnemy(from: Point, faction: number, range: number): Unit | Building | null {
    for (const pool of [this.units, this.buildings] as (Unit | Building)[][]) {
      let best: Unit | Building | null = null;
      let bestD = range;
      for (const e of pool) {
        if (e.faction === faction || this.hidden(e, faction) || this.atPeace(faction, e.faction)) continue;
        const d = dist(from, e);
        if (d <= bestD) {
          best = e;
          bestD = d;
        }
      }
      if (best) return best;
    }
    return null;
  }

  /** One shot from `from` at `target`: shields soak part of it, and the shot's own ability acts. */
  private shoot(from: Shooter, damage: number, target: Unit | Building) {
    const faction = from.kind === 'derelict' ? from.owner : from.faction;
    const dealt = Math.round(damage * this.shieldShare(target));
    target.hp -= dealt;
    target.lastHit = faction;
    if (target.kind === 'unit') target.lastHitBy = from.kind === 'unit' ? from.id : -1;
    this.alarm(target, faction);
    this.beams.push({ x: from.x, y: from.y, x2: target.x, y2: target.y, color: this.sides[faction].def.color, life: BEAM_MS });
    if (from.kind === 'unit') {
      const ability = this.abilityOf(from);
      if (ability?.kind === 'cloak') from.revealMs = ability.revealMs;
      // A shot out of a nebula gives the ship away for a moment.
      if (from.nebula) from.revealMs = Math.max(from.revealMs, NEBULA_REVEAL_MS);
    }
    // Whoever is hit holds a grudge: an AI sends its next attack at that faction, unless tribute holds it elsewhere.
    if (faction !== target.faction && this.sides[target.faction].grudgeLockMs <= 0) this.sides[target.faction].grudge = faction;
    const ability = this.abilityOf(from);
    if (ability?.kind === 'hack' && target.kind === 'building' && this.sides[target.faction].def.buildings[target.type].weapon) {
      target.disabledMs = ability.disableMs;
      target.hacks += 1;
      if (target.hacks >= ability.takeover && target.hp > 0) this.takeOver(target, faction);
    }
    if (ability?.kind === 'splash') {
      this.booms.push({ x: target.x, y: target.y, color: this.sides[faction].def.color, life: BOOM_MS, r: ability.radius });
      for (const e of [...this.units, ...this.buildings]) {
        if (e === target || e.faction === faction || this.atPeace(faction, e.faction) || dist(e, target) > ability.radius) continue;
        e.hp -= Math.round(damage * ability.share);
        e.lastHit = faction;
        if (e.kind === 'unit') e.lastHitBy = from.kind === 'unit' ? from.id : -1;
        this.alarm(e, faction);
      }
    }
  }

  /** A rival's hit on one of the player's units or buildings (not a decoy) raises an attack alert for the scene. */
  private alarm(target: Unit | Building, faction: number) {
    if (this.watch || target.faction !== PLAYER || faction === PLAYER) return;
    if (target.kind === 'unit' && target.decoyMs !== null) return;
    const struck: Struck = target.kind === 'building' ? 'building' : target.type === 'harvester' ? 'harvester' : 'ship';
    this.events.push({ kind: 'hit', x: target.x, y: target.y, struck });
  }

  /** A sound cue for the scene. */
  private cue(cue: Cue, at?: Point) {
    this.events.push({ kind: 'cue', cue, x: at?.x, y: at?.y });
  }

  /** A hacked turret changes sides: it becomes the hacker's own turret, as damaged as it was. */
  private takeOver(b: Building, faction: number) {
    const from = b.faction;
    const was = t(this.sides[from].def.buildings[b.type].name);
    const stats = buildingStats(this.sides[faction], b.type);
    b.faction = faction;
    b.hp = Math.max(1, Math.round((stats.hp * b.hp) / b.maxHp));
    b.maxHp = stats.hp;
    b.hacks = 0;
    b.disabledMs = 0;
    b.cooldown = 0;
    b.layMs = 0;
    b.lastHit = -1;
    this.booms.push({ x: b.x, y: b.y, color: this.sides[faction].def.color, life: BOOM_MS, r: stats.radius + 10 });
    if (faction === PLAYER) this.events.push({ kind: 'notice', text: t('hackedYours', { building: was }) });
    else if (from === PLAYER) this.events.push({ kind: 'notice', text: t('hackedLost', { building: was }) });
    if (faction === PLAYER || from === PLAYER) this.cue(faction === PLAYER ? 'won' : 'lost');
  }

  /** A Mine Lattice lays a mine at a random spot in its reach, while it has fewer than `cap` out. */
  private layMine(b: Building, reach: number, cap: number) {
    if (this.mines.filter((m) => m.from === b.id).length >= cap) return;
    const angle = Math.random() * Math.PI * 2;
    const d = 40 + Math.random() * (reach - 40);
    this.mines.push({
      id: this.id(), faction: b.faction, from: b.id,
      x: Math.min(ARENA.x + ARENA.w - 8, Math.max(ARENA.x + 8, b.x + Math.cos(angle) * d)),
      y: Math.min(ARENA.y + ARENA.h - 8, Math.max(ARENA.y + 8, b.y + Math.sin(angle) * d)),
    });
  }

  /** A mine goes off when an enemy ship comes close: it hurts every enemy ship in its blast. */
  private updateMines() {
    this.mines = this.mines.filter((m) => {
      const def = this.sides[m.faction].def.buildings.turret.ability;
      if (def?.kind !== 'mines' || !this.sides[m.faction].alive) return false;
      if (!this.units.some((u) => u.faction !== m.faction && !this.atPeace(m.faction, u.faction) && u.hp > 0 && dist(u, m) <= def.trigger)) return true;
      for (const u of this.units) {
        if (u.faction === m.faction || this.atPeace(m.faction, u.faction) || dist(u, m) > def.radius) continue;
        u.hp -= Math.round(def.damage * this.shieldShare(u));
        u.lastHit = m.faction;
        u.lastHitBy = -1;
        this.alarm(u, m.faction);
      }
      this.booms.push({ x: m.x, y: m.y, color: this.sides[m.faction].def.color, life: BOOM_MS, r: def.radius });
      return false;
    });
  }

  /** Research under way at each hub: when a level is done, it applies to every ship of the faction. */
  private updateResearch(dt: number) {
    for (const side of this.sides) {
      const cur = side.research.current;
      if (!side.alive || !cur) continue;
      cur.left -= dt;
      if (cur.left > 0) continue;
      const before = researchBonus(side.research, cur.track);
      side.research.levels[cur.track] += 1;
      side.research.current = null;
      if (cur.track === 'hull') {
        // Ships already flying get the new plating too, keeping their share of hit points.
        const k = researchBonus(side.research, 'hull') / before;
        for (const u of this.units) {
          if (u.faction !== side.index || u.decoyMs !== null) continue;
          u.maxHp = Math.round(u.maxHp * k);
          u.hp = Math.min(u.maxHp, u.hp * k);
        }
      }
      if (side.index === PLAYER) {
        this.cue('researchDone');
        this.events.push({
          kind: 'notice',
          text: t('researchDone', {
            track: t(TRACK_DEFS[cur.track].name),
            level: side.research.levels[cur.track],
            pct: Math.round(RESEARCH_STEP * 100),
            effect: t(TRACK_DEFS[cur.track].effect),
          }),
        });
      }
    }
  }

  /** What the player sees this update: everything within sight of its ships and buildings. */
  private updateFog() {
    const fog = this.fog;
    if (this.watch) {
      // Watching, the whole battlefield is in sight.
      fog.visible.fill(1);
      fog.explored.fill(1);
    } else {
      this.stampFog();
    }
    // A rival building in sight is remembered as it is now; under the fog it stays as last seen.
    const known = this.known;
    for (const b of this.buildings) {
      if (b.faction === PLAYER || !fog.sees(b)) continue;
      const seen = known.get(b.id);
      if (seen) {
        seen.faction = b.faction;
        seen.done = b.done;
      } else {
        known.set(b.id, { id: b.id, faction: b.faction, type: b.type, x: b.x, y: b.y, done: b.done, expansion: b.expansion });
      }
    }
    // One whose spot is in sight but that is no longer there as a rival's (fallen, or taken by the player) is forgotten.
    for (const [id, seen] of known) {
      if (!fog.sees(seen)) continue;
      const b = this.building(id);
      if (!b || b.faction === PLAYER) known.delete(id);
    }
  }

  /** Stamps the player's sight into the fog: its ships, its buildings and claimed sensors. */
  private stampFog() {
    const fog = this.fog;
    fog.clear();
    for (const u of this.units) {
      if (u.faction !== PLAYER) continue;
      const sight = this.statsOf(u).sight;
      fog.stamp(u.x, u.y, u.type === 'harvester' ? HARVESTER_VISION : sight * (u.type === 'scout' ? SCOUT_VISION : SHIP_VISION));
    }
    for (const b of this.buildings) {
      if (b.faction !== PLAYER) continue;
      fog.stamp(b.x, b.y, b.type === 'hub' ? HUB_VISION : buildingStats(this.sides[PLAYER], b.type).radius + BUILDING_VISION);
    }
    for (const d of this.derelicts) if (d.perk === 'sensors' && d.owner === PLAYER) fog.stamp(d.x, d.y, SENSOR_RANGE);
  }

  /** The share of a shot that reaches a unit: a Halo Cruiser's shield lets through half, from friends in range. */
  private shieldShare(target: Unit | Building) {
    if (target.kind !== 'unit') return 1;
    for (const s of this.units) {
      const ability = this.abilityOf(s);
      if (s.faction === target.faction && ability?.kind === 'shield' && dist(s, target) <= ability.range) return ability.share;
    }
    return 1;
  }

  private radiusOf(e: Unit | Building) {
    return e.kind === 'building' ? buildingStats(this.sides[e.faction], e.type).radius : UNIT_RADIUS;
  }

  /**
   * Moves `u` toward (x, y) at `speed`, stopping `stop` short of the point. Returns true once it is
   * there; the half pixel of slack lets a unit that stops at exactly `stop` count as arrived.
   */
  private approach(u: Unit, x: number, y: number, stop: number, dt: number, speed: number) {
    const d = Math.hypot(x - u.x, y - u.y);
    if (d <= stop + 0.5) return true;
    const step = Math.min(d - stop, (speed * dt) / 1000);
    const heading = this.steer(u, x, y, stop);
    if (heading === null) {
      u.x += ((x - u.x) / d) * step;
      u.y += ((y - u.y) / d) * step;
      u.angle = Math.atan2(y - u.y, x - u.x);
    } else {
      u.x += Math.cos(heading) * step;
      u.y += Math.sin(heading) * step;
      u.angle = heading;
    }
    this.offRocks(u, x, y, stop);
    return false;
  }

  /**
   * The heading that takes ship `u` round the rocks toward (x, y), or null when it can fly
   * straight there. Rocks round the destination (`stop` short of it) and rocks the ship is already
   * over are left out, for `offRocks` to slide it off.
   */
  private steer(u: Unit, x: number, y: number, stop: number): number | null {
    const to = { x, y };
    const ignore = [...this.pathing.over(to, Math.min(stop, REACH)), ...this.pathing.over(u)];
    if (this.pathing.clear(u, to, ignore)) {
      this.routes.delete(u);
      return null;
    }
    let route = this.routes.get(u);
    if (!route || dist(route.to, to) > PATH_CELL || this.elapsedMs - route.at > ROUTE_MS) {
      const path = this.pathing.route(u, to, ignore);
      if (!path) {
        this.routes.delete(u);
        return null;
      }
      route = { path, to, at: this.elapsedMs };
      this.routes.set(u, route);
    }
    // Head for the furthest waypoint in a straight line, so the flight cuts the grid's corners.
    const path = route.path;
    while (path.length > 1 && (dist(u, path[0]) < 4 || this.pathing.clear(u, path[1], ignore))) path.shift();
    return Math.atan2(path[0].y - u.y, path[0].x - u.x);
  }

  /** Slides a ship off any rock it has flown too far over, except a rock round its destination (x, y) `stop` short. */
  private offRocks(u: Point, x: number, y: number, stop: number) {
    for (const k of this.layout.rocks) {
      const keep = k.r + UNIT_RADIUS - ROCK_OVERLAP;
      const d = dist(u, k);
      if (d >= keep || d === 0 || dist(k, { x, y }) < keep + Math.min(stop, REACH)) continue;
      u.x = k.x + ((u.x - k.x) / d) * keep;
      u.y = k.y + ((u.y - k.y) / d) * keep;
    }
  }

  /**
   * Ships (harvesters left out, as they share their nodes) closer than SPREAD drift apart, so a
   * fresh wing or a stack at one spot fans out. A ship flying a move order holds its course and the
   * other gives way; a drift that would put a ship over a rock is undone.
   */
  private spread(dt: number) {
    const ships = this.units.filter((u) => u.type !== 'harvester' && !u.convoy && u.hp > 0);
    const most = (SPREAD_SPEED * dt) / 1000;
    // An idle ship left over a rock (after a fight among them) drifts off it.
    for (const u of ships) {
      if (u.order) continue;
      const k = this.layout.rocks.find((r) => dist(r, u) < r.r + UNIT_RADIUS - ROCK_OVERLAP && dist(r, u) > 0);
      if (k) this.nudge(u, ((u.x - k.x) / dist(k, u)) * most, ((u.y - k.y) / dist(k, u)) * most, true);
    }
    for (let i = 0; i < ships.length; i++) {
      for (let j = i + 1; j < ships.length; j++) {
        const a = ships[i];
        const b = ships[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        if (d >= SPREAD) continue;
        if (d < 0.01) {
          // Two ships on one spot: part them along an angle picked from their ids.
          const angle = (a.id * 2.399 + b.id) % (Math.PI * 2);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
        } else {
          dx /= d;
          dy /= d;
        }
        const holdA = a.order?.kind === 'move';
        const holdB = b.order?.kind === 'move';
        if (holdA && holdB) continue;
        const push = Math.min(holdA || holdB ? SPREAD - d : (SPREAD - d) / 2, most);
        if (!holdA) this.nudge(a, -dx * push, -dy * push);
        if (!holdB) this.nudge(b, dx * push, dy * push);
      }
    }
  }

  /** Moves a ship by (dx, dy) on the battlefield, unless that puts it over a rock (or, `off`, deeper over one). */
  private nudge(u: Unit, dx: number, dy: number, off = false) {
    const x = Math.max(0, Math.min(ARENA.w, u.x + dx));
    const y = Math.max(0, Math.min(ARENA.h, u.y + dy));
    const deeper = (k: Point & { r: number }) => dist(k, { x, y }) < k.r + UNIT_RADIUS - ROCK_OVERLAP && (!off || dist(k, { x, y }) < dist(k, u));
    if (this.layout.rocks.some(deeper)) return;
    u.x = x;
    u.y = y;
  }

  /** Harvesters work on their own: seek a node, mine until full, carry the crystal to a drop-off. */
  private harvest(u: Unit, dt: number, speed: number) {
    const side = this.sides[u.faction];
    const m = u.mining ?? (u.mining = { node: -1, phase: 'seek', timer: 0 });
    if (m.phase === 'seek') {
      // Work the crystal nearest the hub first, so harvesters stay close to home and out of enemy range.
      const home = this.building(u.home) ?? this.hubOf(u.faction) ?? u;
      const node = this.nodes.filter((n) => n.amount > 0).reduce<Node | null>(
        (best, n) => (!best || dist(n, home) < dist(best, home) ? n : best),
        null,
      );
      if (!node) return;
      m.node = node.id;
      m.phase = 'mine';
      m.timer = 0;
    }
    if (m.phase === 'mine') {
      const node = this.nodes.find((n) => n.id === m.node);
      if (!node || node.amount <= 0) {
        m.phase = u.carry > 0 ? 'return' : 'seek';
        return;
      }
      if (!this.approach(u, node.x, node.y, 12, dt, speed)) return;
      m.timer += dt;
      while (m.timer >= MINE_MS && node.amount > 0) {
        m.timer -= MINE_MS;
        node.amount -= 1;
        u.carry += 1;
        if (u.carry >= Math.round(side.def.tune.carry * side.perks.carry)) {
          m.phase = 'return';
          break;
        }
      }
      return;
    }
    const drops = this.buildings.filter((b) => b.faction === u.faction && b.done && (b.type === 'hub' || b.type === 'depot'));
    const drop = drops.reduce<Building | null>((best, b) => (!best || dist(b, u) < dist(best, u) ? b : best), null);
    if (!drop) return;
    const stop = buildingStats(side, drop.type).radius + 8;
    if (this.approach(u, drop.x, drop.y, stop, dt, speed)) {
      side.crystal += u.carry;
      u.carry = 0;
      m.phase = 'seek';
      m.timer = 0;
    }
  }

  /** Makes a unit of `faction` at (x, y), kept on the field; a decoy when `decoyMs` is given, the flagship (a heavy) with `flagship`. */
  private spawn(faction: number, type: UnitId, x: number, y: number, decoyMs: number | null = null, flagship = false): Unit {
    const stats = flagship ? flagshipStats(this.sides[faction]) : unitStats(this.sides[faction], type);
    const unit: Unit = {
      kind: 'unit', id: this.id(), faction, type,
      x: Math.min(ARENA.x + ARENA.w - 12, Math.max(ARENA.x + 12, x)),
      y: Math.min(ARENA.y + ARENA.h - 12, Math.max(ARENA.y + 12, y)),
      angle: -Math.PI / 2, hp: stats.hp, maxHp: stats.hp, cooldown: 0, order: null, mining: null, carry: 0,
      timer: 0, revealMs: 0, decoyMs, lastHit: -1, lastHitBy: -1, home: -1, kills: 0, nebula: false, repairing: false,
      flagship, convoy: false,
    };
    unit.nebula = this.inNebula(unit);
    this.units.push(unit);
    return unit;
  }

  /**
   * One AI round: keep harvesting, raise a base, expand and research once the economy is going,
   * train an army, fetch salvage, contest the beacon, and send the army at the faction that hit it
   * last (or else the nearest enemy building).
   */
  private think(side: Side) {
    const f = side.index;
    const hub = this.hubOf(f);
    if (!hub) return;
    const has = (role: Role) => this.buildings.some((b) => b.faction === f && b.type === role);
    const expansions = this.hubsOf(f).length - 1;
    if (this.count(f, 'harvester') < AI_HARVESTERS + expansions * AI_EXPANSION_HARVESTERS) this.train('harvester', f);
    if (!has('depot')) this.placeNear('depot', f);
    if (!has('barracks')) this.placeNear('barracks', f);
    const turrets = this.buildings.filter((b) => b.faction === f && b.type === 'turret').length;
    if (turrets < 2 && side.crystal >= buildingStats(side, 'turret').cost + 40) this.placeNear('turret', f);
    const army = this.units.filter((u) => u.faction === f && u.type !== 'harvester' && u.decoyMs === null);
    // Once the opening is over, an AI with a fair army saves up to expand and to research.
    let saving = false;
    if (this.elapsedMs >= AI_EXPAND_MS && expansions === 0) {
      if (side.crystal >= expansionStats(side).cost) {
        if (this.expand(f)) aiLog(String(f), t('aiOutpost'));
      }
      else saving = true;
    }
    if (this.elapsedMs >= AI_RESEARCH_MS && !side.research.current && has('barracks')) {
      // The lowest track next, picked at random among equals.
      const open = TRACKS.filter((t) => side.research.levels[t] < RESEARCH_LEVELS);
      const low = open.filter((t) => side.research.levels[t] === Math.min(...open.map((o) => side.research.levels[o])));
      const track = low[Math.floor(Math.random() * low.length)];
      if (track && side.crystal >= researchCost(side, track) && this.research(track, f) === null) {
        aiLog(String(f), t('aiResearches', { track: t(TRACK_DEFS[track].name), level: side.research.levels[track] + 1 }));
      }
      else if (track) saving = true;
    }
    if (army.length < AI_MAX_ARMY && !(saving && army.length >= AI_ARMY_TO_ATTACK)) {
      for (const type of [...COMBAT_UNITS].sort(() => Math.random() - 0.5)) {
        if (this.train(type, f) === null) break;
      }
    }
    this.contestBeacon(side);
    this.contestDerelicts(side, army);
    this.fetchSalvage(side);
    this.considerTruce(side);
    // A badly hurt warship that is not on a raid falls back to repair.
    for (const u of army) {
      if (u.hp < u.maxHp * AI_FALL_BACK_HP && !u.repairing && u.id !== side.picket && (!u.order || (u.order.kind === 'attack' && u.order.auto))) {
        this.sendHome(u);
      }
    }
    side.attackMs += AI_THINK_MS;
    // A raid contract sends the army out sooner.
    const raiding = side.deal.goal === 'kills' || side.deal.goal === 'razes' || side.deal.goal === 'hubs';
    const need = raiding ? Math.max(2, AI_ARMY_TO_ATTACK - AI_DEAL_EAGER) : AI_ARMY_TO_ATTACK;
    if (this.elapsedMs < AI_GRACE_MS || army.length < need || side.attackMs < AI_ATTACK_MS) return;
    side.attackMs = 0;
    const foe = side.grudge >= 0 && this.sides[side.grudge].alive && !this.atPeace(f, side.grudge) ? side.grudge : -1;
    // A hub contract goes straight for the nearest main hub it may attack, the grudge's while tribute holds it.
    const target = (side.deal.goal === 'hubs' ? this.nearestEnemyHub(hub, f, side.grudgeLockMs > 0 ? foe : -1) : null)
      ?? this.nearestEnemyBuilding(hub, f, foe);
    if (!target) return;
    // The picket stays on the beacon, the claimer at its derelict, the hurt stay to repair and a few ships stay home; the rest go.
    const raid = army.filter((u) => u.id !== side.picket && u.id !== side.claimer && !u.repairing && u.hp >= u.maxHp * AI_FALL_BACK_HP)
      .sort((a, b) => dist(b, hub) - dist(a, hub));
    const sent = raid.slice(0, Math.max(0, raid.length - AI_HOME_GUARD));
    for (const u of sent) u.order = { kind: 'attack', id: target.id, auto: false };
    if (sent.length > 0) {
      const at = this.sides[target.faction];
      aiLog(String(f), t('aiAttacks', { n: sent.length, faction: t(at.def.name), building: t(at.def.buildings[target.type].name) }));
    }
  }

  /** Idle AI warships go to fetch their faction's salvage shards when one lies within reach. */
  private fetchSalvage(side: Side) {
    const f = side.index;
    for (const s of this.shards) {
      if (s.faction !== f) continue;
      const idle = this.units.find((u) => u.faction === f && u.type !== 'harvester' && u.decoyMs === null && !u.order
        && u.id !== side.picket && u.id !== side.claimer && dist(u, s) <= AI_SALVAGE_REACH);
      if (idle) idle.order = { kind: 'move', x: s.x, y: s.y };
    }
  }

  /**
   * A rival with a fair army sends one idle warship (its claimer) to the nearest derelict station it
   * does not own within reach of its hub, once the opening is over. Once the station is its, the
   * ship is free again; a lost station is contested again.
   */
  private contestDerelicts(side: Side, army: Unit[]) {
    const f = side.index;
    // A derelicts contract claims stations anywhere, with a smaller army.
    const keen = side.deal.goal === 'derelicts';
    if (this.elapsedMs < AI_CLAIM_MS || army.length < (keen ? AI_DEAL_CLAIM_ARMY : AI_CLAIM_ARMY)) return;
    const hub = this.hubOf(f)!;
    const open = this.derelicts.filter((d) => d.owner !== f && (keen || dist(d, hub) <= AI_CLAIM_REACH)).sort((a, b) => dist(a, hub) - dist(b, hub));
    const target = open[0];
    const current = this.unit(side.claimer);
    if (current && current.faction === f) {
      const at = this.derelicts.reduce((a, b) => (dist(b, current) < dist(a, current) ? b : a));
      if (!target || (at.owner === f && dist(at, current) <= DERELICT_RADIUS)) side.claimer = -1;
      // A chase or a trip home for repairs pulls the claimer away: once idle, it heads back.
      else if (!current.order && !current.repairing && dist(target, current) > DERELICT_RADIUS / 2) {
        current.order = { kind: 'move', x: target.x, y: target.y };
      }
      return;
    }
    side.claimer = -1;
    if (!target) return;
    const idle = this.units.find((u) => u.faction === f && u.type !== 'harvester' && u.decoyMs === null && !u.order && u.id !== side.picket);
    if (!idle) return;
    side.claimer = idle.id;
    idle.order = { kind: 'move', x: target.x, y: target.y };
    aiLog(String(f), t('aiClaimer', { derelict: derelictName(target.perk) }));
  }

  /** An AI expansion: a second hub beside the richest-looking crystal field away from everyone. */
  private expand(f: number): boolean {
    const spot = this.expansionSpot(f);
    return !!spot && this.build('expansion', spot.x, spot.y, f) === null;
  }

  /** A harder campaign sector starts a rival with an outpost already standing, built for free, at any field that fits. */
  private seedOutpost(f: number) {
    const spot = this.expansionSpot(f, AI_EXPAND_RIVAL_GAP, Infinity) ?? this.expansionSpot(f, AI_EXPAND_RIVAL_GAP / 2, Infinity);
    if (!spot) return;
    const stats = expansionStats(this.sides[f]);
    this.buildings.push({
      kind: 'building', id: this.id(), faction: f, type: 'hub', x: spot.x, y: spot.y, hp: stats.hp, maxHp: stats.hp,
      done: true, buildLeft: 0, queue: [], trainLeft: 0, cooldown: 0, disabledMs: 0, hacks: 0, layMs: 0,
      lastHit: -1, expansion: true, buildMs: stats.buildMs,
    });
  }

  /**
   * Where an AI expansion goes: a clear spot beside one of the `fields` nearest rich crystal fields
   * at least `rivalGap` from every other faction's hubs, or null.
   */
  private expansionSpot(f: number, rivalGap = AI_EXPAND_RIVAL_GAP, fields = 3): Point | null {
    const hub = this.hubOf(f)!;
    const others = this.buildings.filter((b) => b.type === 'hub' && b.faction !== f);
    const sites = this.nodes
      .filter((n) => n.amount > NODE_AMOUNT / 3 && dist(n, hub) >= EXPANSION_GAP && dist(n, this.beacon) >= 150
        && others.every((o) => dist(o, n) >= rivalGap))
      .sort((a, b) => dist(a, hub) - dist(b, hub));
    for (const n of sites.slice(0, fields)) {
      for (let tries = 0; tries < 8; tries++) {
        const angle = Math.random() * Math.PI * 2;
        const d = 50 + Math.random() * 50;
        const x = n.x + Math.cos(angle) * d;
        const y = n.y + Math.sin(angle) * d;
        if (this.placementProblem('expansion', x, y, f) === null) return { x, y };
      }
    }
    return null;
  }

  /**
   * The rivals nearest the relay beacon each keep one idle warship on it (a picket): the nearest
   * once the opening is over, the next one AI_PICKET_STAGGER_MS later. A lost picket is replaced.
   */
  private contestBeacon(side: Side) {
    const f = side.index;
    const bc = this.beacon;
    if (this.elapsedMs < AI_PICKET_MS) return;
    const rank = this.sides
      .filter((s) => (s.index !== PLAYER || this.watch) && s.alive && this.hubOf(s.index))
      .sort((a, b) => dist(this.hubOf(a.index)!, bc) - dist(this.hubOf(b.index)!, bc))
      .findIndex((s) => s.index === f);
    // A hold contract keeps a picket on the beacon however far the rival's hub is.
    const keen = side.deal.goal === 'hold';
    if (!keen && (rank < 0 || rank >= AI_PICKETS || this.elapsedMs < AI_PICKET_MS + rank * AI_PICKET_STAGGER_MS)) return;
    const current = this.unit(side.picket);
    if (current && current.faction === f) {
      // A picket that chased a target off the beacon heads back once it is idle.
      if (!current.order && dist(current, bc) > BEACON_RADIUS / 2) current.order = { kind: 'move', x: bc.x, y: bc.y };
      return;
    }
    const idle = this.units.find((u) => u.faction === f && u.type !== 'harvester' && u.decoyMs === null && !u.order && u.id !== side.claimer);
    if (!idle) return;
    side.picket = idle.id;
    idle.order = { kind: 'move', x: bc.x, y: bc.y };
  }

  private placeNear(role: Exclude<Role, 'hub'>, faction: number) {
    const hub = this.hubOf(faction);
    if (!hub) return;
    for (let tries = 0; tries < 16; tries++) {
      const angle = Math.random() * Math.PI * 2;
      const d = 60 + Math.random() * 90;
      const x = hub.x + Math.cos(angle) * d;
      const y = hub.y + Math.sin(angle) * d;
      if (this.placementProblem(role, x, y, faction) === null) {
        if (this.build(role, x, y, faction) === null) aiLog(String(faction), t('aiBuilds', { building: buildInfo(this.sides[faction], role).name }));
        return;
      }
    }
  }

  /** The nearest main hub of another faction not at peace with `faction` (of `only` when it is given), or null. */
  private nearestEnemyHub(from: Point, faction: number, only = -1): Building | null {
    const hubs = this.buildings.filter((b) => b.type === 'hub' && !b.expansion && b.faction !== faction
      && (only < 0 || b.faction === only) && !this.atPeace(faction, b.faction));
    return hubs.reduce<Building | null>((best, b) => (!best || dist(b, from) < dist(best, from) ? b : best), null);
  }

  /** The nearest building of another faction, of `only` when it is given and has any. */
  private nearestEnemyBuilding(from: Point, faction: number, only = -1): Building | null {
    let best: Building | null = null;
    for (const b of this.buildings) {
      if (b.faction === faction || (only >= 0 && b.faction !== only) || this.atPeace(faction, b.faction)) continue;
      if (!best || dist(b, from) < dist(best, from)) best = b;
    }
    return best ?? (only >= 0 ? this.nearestEnemyBuilding(from, faction) : null);
  }

  /** Removes what has run out of hit points; a fallen hub takes its whole faction with it. */
  private removeDead() {
    const fallen = new Set<number>();
    const razedByPlayer = new Set<number>();
    for (const b of this.buildings) {
      if (b.hp > 0) continue;
      this.wreck(b);
      const main = b.type === 'hub' && !b.expansion;
      if (main) {
        fallen.add(b.faction);
        this.cue('hubFalls', b);
      }
      if (b.lastHit >= 0 && b.lastHit !== b.faction) {
        this.dealScore(b.lastHit, 'razes');
        if (main) this.dealScore(b.lastHit, 'hubs');
      }
      if (b.faction !== PLAYER && b.lastHit === PLAYER) {
        this.scoreRaze(b);
        if (main) {
          this.score('hubs');
          razedByPlayer.add(b.faction);
        }
      }
    }
    for (const u of this.units) {
      if (u.hp > 0) continue;
      this.salvage(u);
      this.wreck(u);
      // A lost flagship is gone for the rest of the battle.
      if (u.flagship && u.faction === PLAYER) {
        this.sides[PLAYER].flagship.state = 'lost';
        this.cue('flagshipLost');
        this.events.push({ kind: 'notice', text: t('flagshipLost', { name: t(this.sides[PLAYER].def.flagship.name) }) });
      }
      // A destroyed ship leaves a salvage shard for whoever destroyed it; the player's count as kills.
      if (u.decoyMs !== null || u.lastHit < 0 || u.lastHit === u.faction) continue;
      this.shards.push({ id: this.id(), faction: u.lastHit, x: u.x, y: u.y, value: SHARD_VALUE, life: SHARD_LIFE_MS });
      this.dealScore(u.lastHit, 'kills');
      const killer = this.unit(u.lastHitBy);
      if (killer && killer.hp > 0 && killer.faction === u.lastHit && killer.decoyMs === null) this.credit(killer);
      if (u.lastHit === PLAYER) {
        this.kills += 1;
        this.score('kills');
        if (u.faction !== PLAYER) this.sides[u.faction].pressure += 1;
      }
    }
    // The rest of a fallen faction's ships and buildings go up with its hub.
    // The buildings swept away with a hub the player razed count as the player's razes too.
    for (const b of this.buildings) {
      if (!fallen.has(b.faction) || b.hp <= 0) continue;
      this.wreck(b);
      if (razedByPlayer.has(b.faction)) this.scoreRaze(b);
    }
    for (const u of this.units) if (fallen.has(u.faction) && u.hp > 0) this.wreck(u);
    this.buildings = this.buildings.filter((b) => b.hp > 0 && !fallen.has(b.faction));
    this.units = this.units.filter((u) => u.hp > 0 && !fallen.has(u.faction));
    for (const f of fallen) {
      this.sides[f].alive = false;
      this.sides[f].crystal = 0;
    }
    this.shards = this.shards.filter((s) => this.sides[s.faction].alive);
  }

  /** A kill for a ship; at VETERAN_RANKS kills it ranks up, with more damage and a stronger hull. */
  private credit(u: Unit) {
    const before = this.veteranBonus(u);
    u.kills += 1;
    const after = this.veteranBonus(u);
    if (after === before) return;
    const k = after / before;
    u.maxHp = Math.round(u.maxHp * k);
    u.hp = Math.min(u.maxHp, u.hp * k);
    const rank = VETERAN_NAMES[this.rankOf(u) - 1];
    const name = t(rank);
    this.booms.push({ x: u.x, y: u.y, color: 0xffd36a, life: BOOM_MS, r: 14, kind: 'rank' });
    if (u.faction === PLAYER) {
      this.pops.push({ x: u.x, y: u.y - 20, text: name.toUpperCase(), color: 0xffd36a, life: POP_MS });
      this.cue('rankUp');
      this.events.push({ kind: 'notice', text: t(rank === 'rankAce' ? 'rankUpAce' : 'rankUp', { unit: t(u.flagship ? this.sides[PLAYER].def.flagship.name : this.sides[PLAYER].def.units[u.type].name), rank: name, pct: Math.round(VETERAN_STEP * 100) }),
      });
    }
  }

  /** A salvage yard (or a salvage flagship) pays its faction for each enemy unit destroyed within its range. */
  private salvage(u: Unit) {
    if (u.decoyMs !== null) return;
    for (const e of [...this.buildings, ...this.units]) {
      const ability = this.abilityOf(e);
      if ((e.kind === 'unit' ? e.hp > 0 : e.done) && e.faction !== u.faction && ability?.kind === 'salvage' && dist(e, u) <= ability.range) {
        this.sides[e.faction].crystal += ability.pay;
      }
    }
  }

  /** Scores a rival building the player razed: a raze, and a Mine Lattice for the lattice contract. */
  private scoreRaze(b: Building) {
    this.score('razes');
    if (this.abilityOf(b)?.kind === 'mines') this.score('lattice');
  }

  /** Counts one more toward the current contract when it is of `goal`. */
  private score(goal: 'kills' | 'razes' | 'hubs' | 'lattice' | 'convoy') {
    if (this.contract.goal === goal) this.contract.progress += 1;
  }

  /**
   * The relay beacon: a faction alone in the ring fills its capture (after draining a rival's),
   * owns the beacon once full, and is paid every second it keeps a ship in the ring.
   */
  private updateBeacon(dt: number) {
    const bc = this.beacon;
    const present = new Set<number>();
    for (const u of this.units) {
      if (u.type !== 'harvester' && u.decoyMs === null && dist(u, bc) <= BEACON_RADIUS) present.add(u.faction);
    }
    if (bc.owner >= 0 && !this.sides[bc.owner].alive) {
      bc.owner = -1;
      bc.capturer = -1;
      bc.capture = 0;
    }
    if (present.size === 1) {
      const f = [...present][0];
      const step = dt / CAPTURE_MS;
      if (bc.capturer === f || bc.capturer < 0) {
        bc.capturer = f;
        bc.capture = Math.min(1, bc.capture + step);
        if (bc.capture >= 1 && bc.owner !== f) {
          bc.owner = f;
          if (f === PLAYER) this.cue('won');
          if (f === PLAYER) this.events.push({ kind: 'notice', text: t('beaconCaptured', { n: BEACON_PAY }) });
        }
      } else {
        bc.capture = Math.max(0, bc.capture - step);
        if (bc.capture <= 0) {
          if (bc.owner === PLAYER) this.cue('lost');
          if (bc.owner === PLAYER) this.events.push({ kind: 'notice', text: t('beaconLost') });
          bc.owner = -1;
          bc.capturer = f;
        }
      }
    }
    bc.held = bc.owner >= 0 && present.has(bc.owner);
    if (!bc.held) {
      bc.payMs = 0;
      return;
    }
    if (bc.owner === PLAYER && this.contract.goal === 'hold') this.contract.progress += dt / 1000;
    this.dealScore(bc.owner, 'hold', dt / 1000);
    bc.payMs += dt;
    while (bc.payMs >= BEACON_PAY_MS) {
      bc.payMs -= BEACON_PAY_MS;
      this.sides[bc.owner].crystal += BEACON_PAY;
      if (bc.owner === PLAYER) {
        bc.paid += BEACON_PAY;
        this.pops.push({ x: bc.x, y: bc.y - 30, text: `+${BEACON_PAY}`, color: 0xffd36a, life: POP_MS });
      }
    }
  }

  /** Salvage shards drift to the nearest ship of their faction in reach and pay out when it picks them up. */
  private updateShards(dt: number) {
    this.shards = this.shards.filter((s) => {
      s.life -= dt;
      let near: Unit | null = null;
      for (const u of this.units) {
        if (u.faction !== s.faction || u.decoyMs !== null) continue;
        if (!near || dist(u, s) < dist(near, s)) near = u;
      }
      if (near && dist(near, s) <= SHARD_MAGNET) {
        const d = dist(near, s);
        if (d <= 8) {
          this.sides[s.faction].crystal += s.value;
          if (s.faction === PLAYER) {
            this.salvaged += s.value;
            this.pops.push({ x: s.x, y: s.y - 12, text: `+${s.value}`, color: 0x8dff9a, life: POP_MS });
            this.events.push({ kind: 'gain', amount: s.value });
          }
          return false;
        }
        const step = Math.min(d, (SHARD_SPEED * dt) / 1000);
        s.x += ((near.x - s.x) / d) * step;
        s.y += ((near.y - s.y) / d) * step;
      }
      return s.life > 0;
    });
  }

  /**
   * Runs the board's countdown while it is up (taking the first card when it runs out), counts the
   * current contract, fails a convoy that can no longer arrive or a lattice hunt with no Lattice
   * faction left, and when the contract is met pays its
   * reward and perk, unlocks the flagship after the third, and puts up the board for the next.
   */
  private updateContract(dt: number) {
    const state = this.contract;
    if (!state.goal) {
      if (!state.offer.length) return;
      state.boardMs -= dt;
      if (state.boardMs <= 0) this.startContract(state.offer[0]);
      return;
    }
    const c = contractOf(state.goal);
    if (c.goal === 'barracks') {
      state.progress = this.buildings.some((b) => b.faction === PLAYER && b.type === 'barracks' && b.done) ? 1 : 0;
    } else if (c.goal === 'derelicts') {
      state.progress = this.derelicts.filter((d) => d.owner === PLAYER).length;
    } else if (c.goal === 'nebula') {
      if (this.nebulaHeld()) state.progress += dt / 1000;
    } else if (c.goal === 'survive') {
      state.progress += dt / 1000;
    } else if (c.goal === 'convoy' && state.progress + this.units.filter((u) => u.convoy).length < c.target) {
      this.failContract(t('convoyLost'));
      return;
    } else if (c.goal === 'lattice' && state.progress < c.target && !this.contractOpen('lattice')) {
      this.failContract(t('latticeGone'));
      return;
    }
    if (state.progress < c.target) return;
    const side = this.sides[PLAYER];
    side.crystal += c.reward;
    c.apply(side.perks);
    this.events.push({ kind: 'gain', amount: c.reward });
    const rank = RANKS[state.index];
    state.done.push(c.goal);
    state.index += 1;
    this.endConvoy();
    let text = t('contractDone', { n: c.reward, rank, perk: c.perk(side.def) });
    if (state.index === FLAGSHIP_STEP && side.flagship.state === 'locked') {
      side.flagship.state = 'ready';
      this.cue('flagshipReady');
      text += t('flagshipUnlocked', { name: t(side.def.flagship.name) });
    }
    this.cue('contractDone');
    this.events.push({ kind: 'notice', text });
    this.openBoard();
  }

  /**
   * The rivals' own contracts (see AI_DEAL_MS): each AI faction picks one from AI_GOALS open at its
   * step, counts it (`dealScore`, and derelicts held here), drops it after AI_DEAL_LIMIT_MS, and once
   * it is met takes its reward and perk; the player hears of each one finished.
   */
  private updateDeals(dt: number) {
    if (this.elapsedMs < AI_DEAL_MS) return;
    for (const side of this.sides) {
      if (!side.alive || (side.index === PLAYER && !this.watch)) continue;
      const deal = side.deal;
      if (!deal.goal) {
        if (deal.step >= CONTRACT_STEPS) continue;
        const pool = CONTRACT_POOL.filter((c) => AI_GOALS.includes(c.goal) && c.from <= deal.step && !deal.done.includes(c.goal));
        // Like the player's board, no derelicts contract for a side that already holds two.
        const held = this.derelicts.filter((d) => d.owner === side.index).length;
        const open = pool.filter((c) => c.goal !== 'derelicts' || held < 2);
        if (!open.length) {
          if (!pool.length) deal.step = CONTRACT_STEPS;
          continue;
        }
        const c = open[Math.floor(this.dealRng() * open.length)];
        deal.goal = c.goal;
        deal.progress = 0;
        deal.ms = 0;
        aiLog(String(side.index), t('aiDeal', { rank: RANKS[deal.step], title: c.title(side.def) }));
        continue;
      }
      const c = contractOf(deal.goal);
      deal.ms += dt;
      if (deal.goal === 'derelicts') deal.progress = this.derelicts.filter((d) => d.owner === side.index).length;
      if (deal.progress >= c.target) {
        side.crystal += c.reward;
        c.apply(side.perks);
        deal.done.push(c.goal);
        aiLog(String(side.index), t('aiDealDone', { title: c.title(side.def), perk: c.perk(side.def) }));
        if (side.index !== PLAYER && !this.watch) {
          this.events.push({ kind: 'notice', text: t('rivalDealDone', { faction: t(side.def.name), title: c.title(side.def), perk: c.perk(side.def) }) });
        }
        deal.step += 1;
        deal.goal = null;
      } else if (deal.ms >= AI_DEAL_LIMIT_MS) {
        // Dropped, not failed for good: the rival picks again at the same step, this one included.
        deal.goal = null;
      }
    }
  }

  /** Counts `n` toward faction `f`'s own contract when it is an AI faction working on `goal`. */
  private dealScore(f: number, goal: Goal, n = 1) {
    if (f < 0 || (f === PLAYER && !this.watch) || this.elapsedMs < AI_DEAL_MS) return;
    const deal = this.sides[f].deal;
    if (deal.goal === goal) deal.progress += n;
  }

  /** Puts up the board for the next contract: two cards from the pool, or the chain's end. */
  private openBoard() {
    const state = this.contract;
    state.goal = null;
    state.progress = 0;
    state.offer = state.index < CONTRACT_STEPS ? boardOffer(state.index, state.taken, (g) => this.contractOpen(g), this.rng) : [];
    state.boardMs = BOARD_MS;
    if (!state.offer.length) state.index = CONTRACT_STEPS;
  }

  /** Starts a contract from the board: a convoy sets off, a raid comes. */
  private startContract(goal: Goal) {
    const state = this.contract;
    // With every rival at peace or held by tribute since the board went up, no raid would come.
    if (goal === 'survive' && !this.contractOpen('survive')) {
      this.failContract(t('noRaiders'));
      return;
    }
    state.goal = goal;
    state.offer = [];
    state.boardMs = 0;
    state.progress = 0;
    state.taken.push(goal);
    if (goal === 'convoy') this.launchConvoy();
    if (goal === 'survive') this.raidPlayer();
    this.cue(goal === 'survive' ? 'klaxon' : 'contractStarted');
    this.events.push({ kind: 'notice', text: t('contractStarted', { rank: RANKS[state.index], brief: contractOf(goal).brief(this.sides[PLAYER].def) }) });
  }

  /** A contract that can no longer be met: the board offers the next two in its place. */
  private failContract(why: string) {
    this.endConvoy();
    this.cue('contractFailed');
    this.events.push({ kind: 'notice', text: t('contractFailed', { why }) });
    this.openBoard();
  }

  /** Whether a contract from the pool can be played in this battle as it stands. */
  private contractOpen(goal: Goal) {
    const rivals = this.sides.filter((s) => s.index !== PLAYER && s.alive);
    if (goal === 'lattice') return rivals.some((s) => s.def.buildings.turret.ability?.kind === 'mines');
    if (goal === 'convoy') return !!this.convoyField();
    if (goal === 'derelicts') return this.derelicts.filter((d) => d.owner === PLAYER).length < 2;
    // The raid needs a rival that can come: one not under truce and not held by tribute.
    if (goal === 'survive') return rivals.some((s) => !this.atPeace(PLAYER, s.index) && s.grudgeLockMs <= 0);
    return rivals.length > 0;
  }

  /** Whether a player warship holds a nebula: it is inside one that no enemy warship is in. */
  private nebulaHeld() {
    return this.layout.nebulae.some((n) => {
      let mine = false;
      for (const u of this.units) {
        if (u.type === 'harvester' || u.decoyMs !== null || dist(u, n) > n.r) continue;
        if (u.faction !== PLAYER) return false;
        mine = true;
      }
      return mine;
    });
  }

  /** The convoy's field: a crystal node between CONVOY_NEAR and CONVOY_FAR from the player's hub, nearest CONVOY_DIST. */
  private convoyField(): Node | null {
    const hub = this.hubOf(PLAYER);
    if (!hub) return null;
    const off = (n: Node) => Math.abs(dist(n, hub) - CONVOY_DIST);
    return this.nodes
      .filter((n) => n.amount > NODE_AMOUNT / 3 && dist(n, hub) >= CONVOY_NEAR && dist(n, hub) <= CONVOY_FAR)
      .reduce<Node | null>((best, n) => (!best || off(n) < off(best) ? n : best), null);
  }

  /**
   * The convoy contract: CONVOY_SIZE harvesters leave the hub for a far field, and the rival whose
   * hub is nearest that field sends a few warships to hunt them.
   */
  private launchConvoy() {
    const hub = this.hubOf(PLAYER);
    const field = this.convoyField();
    if (!hub || !field) return;
    this.convoyTo = { x: field.x, y: field.y, node: field.id };
    const r = buildingStats(this.sides[PLAYER], 'hub').radius + 14;
    const convoy: Unit[] = [];
    for (let i = 0; i < CONVOY_SIZE; i++) {
      const u = this.spawn(PLAYER, 'harvester', hub.x + (i - 1) * 18, hub.y + r);
      u.convoy = true;
      u.home = hub.id;
      convoy.push(u);
    }
    const hunter = this.sides
      .filter((s) => s.index !== PLAYER && s.alive && this.hubOf(s.index) && !this.atPeace(PLAYER, s.index))
      .reduce<Side | null>((best, s) => (!best || dist(this.hubOf(s.index)!, field) < dist(this.hubOf(best.index)!, field) ? s : best), null);
    if (!hunter) return;
    const raiders = this.units
      .filter((u) => u.faction === hunter.index && u.type !== 'harvester' && u.decoyMs === null && u.id !== hunter.picket && u.id !== hunter.claimer)
      .sort((a, b) => dist(a, field) - dist(b, field))
      .slice(0, CONVOY_RAIDERS);
    raiders.forEach((u, k) => { u.order = { kind: 'attack', id: convoy[k % convoy.length].id, auto: false }; });
    if (raiders.length) this.cue('klaxon');
    if (raiders.length) this.events.push({ kind: 'notice', text: t('convoyHunted', { faction: t(hunter.def.name), n: raiders.length }) });
  }

  /** A convoy harvester flies to the far field; once there it starts mining it like any harvester. */
  private escort(u: Unit, dt: number, speed: number) {
    const to = this.convoyTo;
    if (to && !this.approach(u, to.x, to.y, 14, dt, speed)) return;
    u.convoy = false;
    if (!to) return;
    u.mining = { node: to.node, phase: 'mine', timer: 0 };
    this.score('convoy');
  }

  /** The convoy contract is over: harvesters still flying go back to plain harvesting. */
  private endConvoy() {
    this.convoyTo = null;
    for (const u of this.units) u.convoy = false;
  }

  /**
   * Every rival not under truce or held by tribute (`grudgeLockMs`) turns on the player and sends its
   * fleet, less its picket and claimer, at the player's hub. The pact clears the locks first.
   */
  private raidPlayer() {
    const hub = this.hubOf(PLAYER);
    if (!hub) return;
    for (const side of this.sides) {
      if (side.index === PLAYER || !side.alive || this.atPeace(PLAYER, side.index) || side.grudgeLockMs > 0) continue;
      side.grudge = PLAYER;
      side.attackMs = 0;
      for (const u of this.units) {
        if (u.faction !== side.index || u.type === 'harvester' || u.decoyMs !== null || u.id === side.picket || u.id === side.claimer) continue;
        u.order = { kind: 'attack', id: hub.id, auto: false };
      }
    }
  }

  /**
   * The last-stand pact: signed once only PACT_RIVALS rivals are left, or the player holds more than
   * PACT_HUB_SHARE of the finished hubs (after the opening). Then the rivals raid together on a countdown.
   */
  private updatePact(dt: number) {
    if (this.watch || this.elapsedMs < AI_GRACE_MS) return;
    if (!this.pact) {
      const rivals = this.sides.filter((s) => s.index !== PLAYER && s.alive);
      const hubs = this.buildings.filter((b) => b.type === 'hub' && b.done);
      const mine = hubs.filter((b) => b.faction === PLAYER).length;
      if (!rivals.length || (rivals.length > PACT_RIVALS && mine <= hubs.length * PACT_HUB_SHARE)) return;
      this.signPact(rivals);
      return;
    }
    this.pact.ms -= dt;
    if (this.pact.ms > 0) return;
    this.pact.waves += 1;
    this.pact.ms = PACT_WAVE_MS;
    this.raidPlayer();
    this.cue('klaxon');
    this.events.push({ kind: 'notice', text: t('pactRaids', { s: PACT_WAVE_MS / 1000 }) });
  }

  /** The rivals sign the pact: truces end, their grudges turn on the player, they get crystal, and they stop fighting each other. */
  private signPact(rivals: Side[]) {
    this.pact = { ms: PACT_MS, waves: 0 };
    for (const s of rivals) {
      s.truceMs = 0;
      s.offerMs = 0;
      s.grudge = PLAYER;
      s.grudgeLockMs = 0;
      s.crystal += PACT_FUNDS;
    }
    // Ships already sent at each other are called off.
    for (const u of this.units) {
      if (u.order?.kind !== 'attack') continue;
      const target = this.unit(u.order.id) ?? this.building(u.order.id);
      if (target && this.atPeace(u.faction, target.faction)) u.order = null;
    }
    const who = new Intl.ListFormat(locale(), { type: 'conjunction' }).format(rivals.map((s) => t('theFaction', { faction: t(s.def.name) })));
    this.cue('klaxon');
    this.events.push({ kind: 'notice', text: t('pactSigned', { who, s: PACT_MS / 1000 }) });
  }

  /** The flagship being built at the hub: when it is done it launches beside the hub. */
  private updateFlagship(dt: number) {
    const side = this.sides[PLAYER];
    const f = side.flagship;
    if (f.state !== 'building') return;
    f.left -= dt;
    const hub = this.hubOf(PLAYER);
    if (f.left > 0 || !hub) return;
    this.spawn(PLAYER, 'heavy', hub.x, hub.y + buildingStats(side, 'hub').radius + 24, null, true);
    f.state = 'out';
    this.cue('flagshipLaunched');
    this.events.push({ kind: 'notice', text: t('flagshipLaunched', { name: t(side.def.flagship.name) }) });
  }

  private wreck(e: Unit | Building) {
    this.booms.push({ x: e.x, y: e.y, color: this.sides[e.faction].def.color, life: BOOM_MS, r: this.radiusOf(e) });
  }
}
