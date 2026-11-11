// The rules of Colonizer, free of Phaser: economy, production, research, pathing, combat and fog.
// The scene and the planner change the world only through `issue`, `placeBuilding`, `train` and
// `research`; `tick` moves everything forward.
import {
  AGE3_DAMAGE,
  AGE4_DAMAGE,
  ARMY_DEED,
  VETERAN_RANK,
  WONDER_CREW,
  AURA_DMG,
  AURA_RANGE,
  BELL_RANGE,
  BUILDINGS,
  BUILDING_TOP,
  CARRY,
  CLAIM_RANGE,
  DOCK_FOOD,
  DOCK_MS,
  FORGE_COST,
  GARRISON_ARROW,
  HEAL_HP,
  HEAL_MS,
  HEAL_RANGE,
  MARKET_BASE,
  MARKET_DRIFT,
  MARKET_LOT,
  MARKET_RATE_MAX,
  MARKET_RATE_MIN,
  MARKET_SELL,
  MARKET_STEP,
  RANK_DMG,
  RANK_HP,
  RANK_KILLS,
  TRADE_ORE,
  ASK_MS,
  BREAK_MOOD,
  LANDING,
  PACKS,
  STRIDE_RANGE,
  STRIDE_SPEED,
  TRANSPORT_CAP,
  TRIBUTE,
  earnsRanks,
  isNaval,
  isSoldier,
  GROVE_MS,
  GROVE_RANGE,
  GROVE_TREES,
  HARVEST_RITES,
  LEASH,
  MONUMENT_MS,
  ASSAULT_CLEAR,
  ASSAULT_MIN,
  FACTIONS,
  MASONRY_HP,
  MUSTER_SPEED,
  TEMPERAMENTS,
  type EdgeId,
  type TemperamentId,
  RELIC_DAMAGE,
  RELIC_GATHER,
  RELIC_SPEED,
  UNIT_GAP,
  RELICS,
  type RelicId,
  STIRRUPS_SPEED,
  SHIELDWALL_TAKEN,
  type BoonId,
  GATHER_MS,
  START,
  START_VILLAGERS,
  TECHS,
  UNITS,
  MAP_SIZE,
  TILE,
  takesRally,
  type BuildingId,
  type Cost,
  type FactionId,
  type Resource,
  type UnitDef,
} from './data';
import { AMOUNT, WATER, ROCK, SHALLOW, idx, inMap, sailable, type MapData, type Node, type PostSpot } from './map';
import { t, type TextKey } from '../i18n';

export type Order =
  | { t: 'idle' }
  | { t: 'move'; x: number; y: number }
  | { t: 'attackMove'; x: number; y: number }
  | { t: 'attack'; target: number; resume: { x: number; y: number } | null }
  | { t: 'gather'; node: number }
  | { t: 'build'; b: number }
  | { t: 'return' }
  /** A villager runs to shelter in a building (the town bell). */
  | { t: 'garrison'; b: number }
  /** A trade cart drives to the nearest trading post. */
  | { t: 'trade' }
  /** A villager or soldier walks to the shore by a transport and goes aboard. */
  | { t: 'board'; ship: number }
  /** A transport sails to a shore and puts its cargo on land there. */
  | { t: 'unload'; x: number; y: number };

export interface Unit {
  id: number;
  owner: number;
  type: string;
  x: number;
  y: number;
  hp: number;
  order: Order;
  path: { x: number; y: number }[];
  repath: number;
  cool: number;
  /** The resource this villager carries, and how many. */
  carry: Resource | null;
  amount: number;
  /** Progress towards the next unit gathered. */
  gatherMs: number;
  /** The node a villager goes back to after dropping off. */
  home: number | null;
  /** The resource this villager last gathered, so it can find more when its node runs out. */
  lastRes: Resource | null;
  /** The building site a villager left when the bell rang, to go back to building once it is released. */
  site: number | null;
  /** What the unit did this tick, for its animation: idle, walk, gather, build or fight. */
  act: 'idle' | 'walk' | 'gather' | 'build' | 'fight';
  /** Which way it faces: 1 right, -1 left. */
  face: 1 | -1;
  /** Game time of its last blow or shot. */
  struck: number;
  /** A camp guard's post: it never strays more than LEASH tiles from it. */
  post: { x: number; y: number } | null;
  /** Kills, and the veteran rank (0 to 3) they have earned (RANK_KILLS). */
  kills: number;
  rank: number;
  /** A champion's timer towards its next heal. */
  pulse: number;
  /** A transport's passengers, as whole `Unit`s taken out of `units` until they land. */
  cargo: Unit[];
  /** A wagon's packed camp (the Steppe Horde): its building type and health, as a share of full. */
  packed: { type: BuildingId; hp: number } | null;
}

/** Things that happened this tick, for the scene's effects; the scene empties the list each frame. */
export type SimEvent =
  | { t: 'hit'; x: number; y: number; fromX: number; fromY: number; dmg: number; ranged: boolean; owner: number; victim: number; target: number; tower?: boolean }
  | { t: 'drop'; x: number; y: number; res: Resource; n: number; owner: number }
  | { t: 'grow'; x: number; y: number };

/** A raid: the AI's army sent at the player, at a goal the planner picks. Repelling it is a deed for Age III. */
export interface Raid {
  /** Counts up with each raid, so the scene can tell a new one. */
  n: number;
  by: number;
  target: number;
  ids: number[];
  size: number;
  /** Raiders killed so far. */
  routed: number;
  /** Where the raiders are now: the middle of the living ones. */
  x: number;
  y: number;
  /** Compass point it comes from, seen from the target's Town Center, as a text key such as 'southEast'. */
  from: TextKey;
  started: number;
}

/**
 * What a side's planner is raiding for: the enemy's outlying economy (a camp, farm or the faction's
 * building), a relic the enemy holds, or its Town Center. `b` is the building aimed at, if any.
 */
export interface RaidGoal {
  kind: 'economy' | 'relic' | 'town';
  x: number;
  y: number;
  b: number | null;
  camp: number | null;
}

/** A side's planner memory for raids: the earliest time of the next, and the one under way. */
export interface AiRaid {
  next: number;
  /** The side the raid under way (or the last one) went for. */
  foe: number;
  /** Raids launched so far, which picks the next goal. */
  count: number;
  goal: RaidGoal | null;
  party: number[];
  started: number;
}

export type QueueItem = { kind: 'unit'; key: string; left: number } | { kind: 'tech'; key: string; left: number };

export interface Building {
  id: number;
  owner: number;
  type: BuildingId;
  tx: number;
  ty: number;
  hp: number;
  built: boolean;
  /** Time still to build, counted down by builders. */
  buildLeft: number;
  queue: QueueItem[];
  cool: number;
  /** Where new units walk to (a rally flag); on a resource node, new villagers gather it. */
  rally: { x: number; y: number } | null;
  /** Game time it was finished (the Monument counts from it); -1 while unfinished. */
  doneAt: number;
  /** Time towards the next catch or sapling, for the Dock and the Grove. */
  workMs: number;
  /** Villagers sheltering inside since the bell rang; each adds an arrow to the building's volleys. */
  garrison: Unit[];
  /** Builders who worked on it at game time `crewAt` (a Wonder takes at most WONDER_CREW at once). */
  crew: number;
  crewAt: number;
}

/** A neutral camp: a cache to take once, or a relic to hold. Its guards are units of NEUTRAL. */
export interface Camp {
  id: number;
  kind: 'cache' | 'relic';
  tx: number;
  ty: number;
  res: Resource | null;
  amount: number;
  relic: RelicId | null;
  /** The side holding the relic, or that took the cache; null while nobody has. */
  holder: number | null;
  /** A cache that was taken: it is gone from the map. */
  claimed: boolean;
  guards: number[];
}

export interface Player {
  id: number;
  faction: FactionId;
  res: Record<Resource, number>;
  techs: string[];
  age: 1 | 2 | 3 | 4;
  /** Multiplies how fast a player gathers; the AI's depends on difficulty. */
  gatherMul: number;
  /** Progress on the deeds for Age III: Age II reached, most soldiers alive at once, a raid repelled. */
  deeds: { age2: boolean; army: number; raid: boolean };
  /** Progress on the deeds for Age IV (DEEDS4), counted from Age III: a relic held, the champion raised, a soldier at VETERAN_RANK. */
  deeds4: { relic: boolean; champion: boolean; veteran: boolean };
  /** The Age II boon, once picked; `boonPending` while the pick is open. */
  boon: BoonId | null;
  boonPending: boolean;
  /** The town bell is ringing: villagers near a shelter are inside it until it is released. */
  bell: boolean;
  /** The Market's rates for wood and food, in ore; 1 is the base price. */
  rates: { wood: number; food: number };
  /** The Age III pick, once made; `edgePending` while the pick is open. */
  edge: EdgeId | null;
  edgePending: boolean;
  /** An AI side's temperament for this match (null for the player's side when the player plays it). */
  temperament: TemperamentId | null;
  /** The player has seen this side's Town Center, which reveals its temperament. */
  scouted: boolean;
  /** This side's Town Center fell in a three-way match: it is out, and everything of it is gone. */
  out: boolean;
  /** Units and buildings (not palisade pieces) this side has lost, for a scenario's stars. */
  lost: number;
  razed: number;
  /** Faction mastery has unlocked this side's second unique unit (`eliteFor`). */
  elite: boolean;
}

/**
 * The player's standing with an AI in a three-way match (`GameState.pacts`, by the AI's index): a
 * truce or alliance until a game time, the AI's goodwill towards the player, and the time before
 * which it won't hear another ask after a refusal.
 */
export interface Pact {
  truceUntil: number;
  allyUntil: number;
  mood: number;
  askAt: number;
}

/** One side of a match: its faction, how fast it gathers (the difficulty, for the AI) and its temperament. */
export interface SideSetup {
  faction: FactionId;
  gatherMul: number;
  temperament: TemperamentId | null;
  /** The faction's second unique unit is unlocked (faction mastery). */
  elite?: boolean;
}

/**
 * A campaign scenario's goal, besides the usual wins: hold out until `ms` with the Town Center
 * standing, bring the supply cart home with ore `trips` times, hold a relic for `ms` in a row, be the
 * last side standing, or finish a Wonder.
 */
export type Goal =
  | { t: 'survive'; ms: number }
  | { t: 'escort'; trips: number }
  | { t: 'hold'; relic: RelicId; ms: number }
  | { t: 'conquest' }
  | { t: 'wonder' };

/** What `createGame` needs for a scenario: its goal and its one new rule. */
export interface MissionSetup {
  goal: Goal;
  /** Nobody may build a Monument. */
  noMonument?: boolean;
  /** Wild guards hold the trading posts. */
  guardPosts?: boolean;
  /** Every side starts in this age, with these resources (its Age II and III picks open). */
  startAge?: 2 | 3;
  startRes?: Partial<Record<Resource, number>>;
  /** Only the rivals start in this age. */
  rivalAge?: 2 | 3;
  /** The rivals' first raid and the rest between raids, instead of their temperaments'. */
  raids?: { first: number; rest: number };
}

/** A scenario under way: its setup, and how far the goal has come. */
export interface Mission extends MissionSetup {
  /** The supply cart to escort (an escort goal), and its trips home with ore. */
  cart: number | null;
  trips: number;
  /** When the player last took the goal's relic, while they hold it. */
  heldSince: number | null;
}

export interface GameState {
  time: number;
  winner: number | null;
  terrain: Uint8Array;
  /** 1 where a tile is blocked for walking: terrain, buildings, camps and nodes. */
  solid: Uint8Array;
  /** The owner of a finished gate on a tile (only its owner walks through), or -1. */
  gates: Int8Array;
  camps: Camp[];
  /** The neutral trading posts, where trade carts load ore. */
  posts: PostSpot[];
  /** 0 unseen, 1 explored, 2 in sight of the player right now. */
  sight: Uint8Array;
  nodes: Map<number, Node>;
  units: Map<number, Unit>;
  buildings: Map<number, Building>;
  players: Player[];
  nextId: number;
  notice: string;
  noticeMs: number;
  /** Each side's planner clock (the player's runs only in watch mode). */
  aiClock: number[];
  /** Each side's planner memory for raids (`next` starts at the first raid's time gate). */
  aiRaid: AiRaid[];
  /** The raid under way, if any, and how many raids have been launched and repelled. */
  raid: Raid | null;
  raids: number;
  repelled: number;
  /**
   * Per AI side, by its index: the soldiers of other sides that have come at its Town Center, while
   * they are about (see `updateAssault`), or null.
   */
  assault: (number[] | null)[];
  /** Play on until one side is left, even after the player's side falls (watch mode). */
  toLast: boolean;
  events: SimEvent[];
  /**
   * How the match was won: the enemy Town Center fell, a Monument stood long enough, a Wonder was
   * finished, a scenario's goal was reached (`goal`) or its supply cart fell (`cart`, a loss).
   */
  winBy: 'town' | 'monument' | 'wonder' | 'goal' | 'cart' | null;
  /** The campaign scenario being played, or null in a skirmish. */
  mission: Mission | null;
  /** A map of islands (`MapData.naval`): the AI builds a Harbour and warships. */
  naval: boolean;
  /** The player's truces and alliances with each AI, by the AI's index (see `Pact`). */
  pacts: Pact[];
}

export type Command =
  | { t: 'move'; x: number; y: number }
  | { t: 'attackMove'; x: number; y: number }
  | { t: 'attack'; target: number }
  | { t: 'gather'; node: number }
  | { t: 'build'; b: number }
  | { t: 'trade' }
  | { t: 'board'; ship: number }
  | { t: 'unload'; x: number; y: number }
  | { t: 'stop' };

export const PLAYER = 0;
export const AI = 1;
/** The wild guards of the neutral camps: everyone's enemy, and nobody's to command. */
export const NEUTRAL = 2;
/** The second AI, in a three-way match. */
export const AI2 = 3;
/** The sides of a match in setup order: the player, the AI, and the second AI in a three-way match. */
export const SIDES = [PLAYER, AI, AI2] as const;

/**
 * Starts a match: `sides` in setup order (the player, the AI and, for a three-way match, the second
 * AI) on `map`, whose `starts` has a corner for each. An AI side's `gatherMul` is the difficulty's
 * number; 1 is the game as designed.
 */
export function createGame(sides: SideSetup[], map: MapData, toLast = false, mission: MissionSetup | null = null): GameState {
  const player = (id: number, side: SideSetup): Player => ({
    id,
    faction: side.faction,
    res: { ...START },
    techs: [],
    age: 1,
    gatherMul: side.gatherMul,
    deeds: { age2: false, army: 0, raid: false },
    deeds4: { relic: false, champion: false, veteran: false },
    boon: null,
    boonPending: false,
    bell: false,
    rates: { wood: 1, food: 1 },
    edge: null,
    edgePending: false,
    temperament: side.temperament,
    scouted: false,
    out: false,
    lost: 0,
    razed: 0,
    elite: side.elite ?? false,
  });
  // The camp guards' side. Its faction is only a placeholder: wild units have their own colours.
  const wild = { ...player(NEUTRAL, sides[0]), res: { wood: 0, food: 0, ore: 0 }, temperament: null };
  const players = [player(PLAYER, sides[0]), player(AI, sides[1]), wild];
  if (sides[2]) players.push(player(AI2, sides[2]));
  const s: GameState = {
    time: 0,
    winner: null,
    terrain: map.terrain,
    solid: new Uint8Array(MAP_SIZE * MAP_SIZE),
    gates: new Int8Array(MAP_SIZE * MAP_SIZE).fill(-1),
    camps: [],
    posts: map.posts,
    sight: new Uint8Array(MAP_SIZE * MAP_SIZE),
    nodes: new Map(),
    units: new Map(),
    buildings: new Map(),
    players,
    nextId: 1000,
    notice: '',
    noticeMs: 0,
    aiClock: players.map(() => 0),
    // Each side's first raid waits for its temperament's time gate.
    aiRaid: players.map((p) => ({ next: mission?.raids?.first ?? TEMPERAMENTS[p.temperament ?? 'builder'].firstRaid, foe: p.id === PLAYER ? AI : PLAYER, count: 0, goal: null, party: [], started: 0 })),
    raid: null,
    raids: 0,
    repelled: 0,
    assault: players.map(() => null),
    toLast,
    events: [],
    winBy: null,
    mission: mission ? { ...mission, cart: null, trips: 0, heldSince: null } : null,
    naval: map.naval ?? false,
    pacts: players.map(() => ({ truceUntil: 0, allyUntil: 0, mood: 0, askAt: 0 })),
  };
  for (const n of map.nodes) s.nodes.set(n.id, n);
  // Node ids come from the map, so units and buildings count on from the largest of them.
  s.nextId = Math.max(s.nextId, ...[...s.nodes.keys()]) + 1;
  for (const spot of map.camps) {
    s.camps.push({ id: s.nextId++, kind: spot.kind, tx: spot.tx, ty: spot.ty, res: spot.res ?? null, amount: spot.amount ?? 0, relic: spot.relic ?? null, holder: null, claimed: false, guards: [] });
  }
  map.starts.forEach((start, k) => {
    addBuilding(s, SIDES[k], 'town', start.tx, start.ty, true);
  });
  rebuildSolid(s);
  // The guards stand around their camp, spread over the free tiles next to it.
  s.camps.forEach((camp, k) => {
    const spots = ringAround(s, camp.tx, camp.ty, 2, 2);
    map.camps[k].guards.forEach((type, i) => {
      const at = spots[Math.floor((i * spots.length) / map.camps[k].guards.length)];
      if (!at) return;
      const u = spawnAt(s, NEUTRAL, type, at.x, at.y);
      u.post = { x: at.x, y: at.y };
      camp.guards.push(u.id);
    });
  });
  map.starts.forEach((_, k) => {
    const owner = SIDES[k];
    const town = [...s.buildings.values()].find((b) => b.owner === owner && b.type === 'town');
    if (!town) return;
    // The starting villagers go straight to work: two on wood, the rest on the berry bushes.
    for (let i = 0; i < START_VILLAGERS; i++) {
      const u = spawnUnit(s, owner, 'villager', town);
      const src = u && nearestSource(s, owner, i < 2 ? 'wood' : 'food', u.x, u.y);
      if (u && src) {
        u.home = src.id;
        u.order = { t: 'gather', node: src.id };
      }
    }
  });
  if (s.mission) startMission(s, s.mission, map);
  updateSight(s);
  return s;
}

/**
 * A scenario's start: every side's (or only the rivals') age with its picks open, the resources, the
 * supply cart beside the player's Town Center and the guards at the trading posts.
 */
function startMission(s: GameState, m: Mission, map: MapData) {
  for (const p of s.players) {
    if (p.id === NEUTRAL) continue;
    const age = p.id === PLAYER ? m.startAge : (m.rivalAge ?? m.startAge);
    if (age) {
      p.age = age;
      p.boonPending = true;
      if (age === 3) {
        p.edgePending = true;
        p.deeds = { age2: true, army: ARMY_DEED, raid: false };
      }
    }
    if (m.startRes) Object.assign(p.res, m.startRes);
  }
  if (m.goal.t === 'escort') {
    const town = [...s.buildings.values()].find((b) => b.owner === PLAYER && b.type === 'town');
    const cart = town && spawnUnit(s, PLAYER, 'cart', town);
    if (cart) m.cart = cart.id;
  }
  if (m.guardPosts) {
    for (const post of map.posts) {
      const spots = ringAround(s, post.tx, post.ty, 2, 2);
      POST_GUARDS.forEach((type, i) => {
        const at = spots[Math.floor((i * spots.length) / POST_GUARDS.length)];
        if (!at) return;
        spawnAt(s, NEUTRAL, type, at.x, at.y).post = { x: at.x, y: at.y };
      });
    }
  }
}
/** The guards at each trading post when a scenario puts brigands on the road. */
const POST_GUARDS = ['wild-brigand', 'wild-brigand', 'wild-brigand', 'wild-poacher', 'wild-poacher'];

// ---------------------------------------------------------------- helpers

export function affordable(p: Player, cost: Cost) {
  return (Object.keys(cost) as Resource[]).every((r) => p.res[r] >= (cost[r] ?? 0));
}

function pay(p: Player, cost: Cost) {
  for (const r of Object.keys(cost) as Resource[]) p.res[r] -= cost[r] ?? 0;
}

/** What a unit costs a player: soldiers are cheaper with a finished Forge (Ember Legion). */
export function unitCost(s: GameState, owner: number, def: UnitDef): Cost {
  if (!isSoldier(def.role) || !hasBuilt(s, owner, 'forge')) return def.cost;
  const out: Cost = {};
  for (const r of Object.keys(def.cost) as Resource[]) out[r] = Math.round((def.cost[r] ?? 0) * FORGE_COST);
  return out;
}

/** The sides still in the match other than `owner` (never the camp guards). */
export function rivalsOf(s: GameState, owner: number): number[] {
  return s.players.filter((p) => p.id !== NEUTRAL && p.id !== owner && !p.out).map((p) => p.id);
}

/** Whether the match has a second AI. */
export const threeWay = (s: GameState) => s.players.length > AI2;

/** Whether the player and an AI are under a truce or an alliance right now. */
export function atPeace(s: GameState, a: number, b: number) {
  const ai = a === PLAYER ? b : b === PLAYER ? a : -1;
  if (ai < 0 || ai === NEUTRAL) return false;
  const p = s.pacts[ai];
  return !!p && (p.truceUntil > s.time || p.allyUntil > s.time);
}

/** Whether two sides fight: different sides, not at peace. */
export const hostile = (s: GameState, a: number, b: number) => a !== b && !atPeace(s, a, b);

/** The rivals still in that a side fights now (`rivalsOf` less those at peace with it). */
export function foesOf(s: GameState, owner: number) {
  return rivalsOf(s, owner).filter((r) => hostile(s, owner, r));
}

/** Whether a unit is a ship. */
export const isShip = (u: Unit) => isNaval(UNITS[u.type].role);

/** Whether a ship can sail a tile. */
export const seaAt = (s: GameState, x: number, y: number) => inMap(x, y) && sailable(s.terrain[idx(x, y)]);

/** A building's full health: its kind's, and 30% more under Masonry. */
export function buildingHp(s: GameState, b: Building) {
  const hp = BUILDINGS[b.type].hp;
  return s.players[b.owner].edge === 'masonry' ? Math.round(hp * MASONRY_HP) : hp;
}

/** Whether a side holds a relic. */
export function holds(s: GameState, owner: number, relic: RelicId) {
  return s.camps.some((c) => c.relic === relic && c.holder === owner);
}

/** Why a player may not place a building at all (not its faction's, too early, or at its limit), or null. */
export function notAllowed(s: GameState, owner: number, type: BuildingId): string | null {
  const def = BUILDINGS[type];
  const p = s.players[owner];
  if (def.faction && def.faction !== p.faction) return t('notYourFaction');
  if (type === 'monument' && s.mission?.noMonument) return t('noMonumentHere');
  if (def.age && p.age < def.age) return t('needsAge', { age: t(ageKey(def.age)) });
  if (def.limit !== undefined) {
    let n = 0;
    for (const b of s.buildings.values()) if (b.owner === owner && b.type === type) n++;
    // A camp packed on a wagon still counts.
    for (const u of s.units.values()) {
      if (u.owner !== owner) continue;
      if (u.packed?.type === type) n++;
      // A wagon aboard a transport too.
      for (const c of u.cargo) if (c.packed?.type === type) n++;
    }
    if (n >= def.limit) return def.limit === 1 ? t('haveOne') : t('atMost', { n: def.limit });
  }
  return null;
}

/** The text key naming an age. */
export const ageKey = (age: 2 | 3 | 4): TextKey => (age === 4 ? 'age4' : age === 3 ? 'age3' : 'age2');

function footprint(e: Unit | Building | Node): { x0: number; y0: number; x1: number; y1: number } {
  if ('kind' in e) return { x0: e.tx, y0: e.ty, x1: e.tx + e.w, y1: e.ty + e.h };
  if ('queue' in e) {
    const def = BUILDINGS[e.type];
    return { x0: e.tx, y0: e.ty, x1: e.tx + def.w, y1: e.ty + def.h };
  }
  return { x0: e.x - 0.3, y0: e.y - 0.3, x1: e.x + 0.3, y1: e.y + 0.3 };
}

/** Distance from a point to the nearest edge of a footprint; 0 inside it. */
function gap(px: number, py: number, f: { x0: number; y0: number; x1: number; y1: number }) {
  const dx = Math.max(f.x0 - px, 0, px - f.x1);
  const dy = Math.max(f.y0 - py, 0, py - f.y1);
  return Math.hypot(dx, dy);
}

export function unitDef(u: Unit): UnitDef {
  return UNITS[u.type];
}

export function getEntity(s: GameState, id: number): Unit | Building | undefined {
  return s.units.get(id) ?? s.buildings.get(id);
}

/** The tiles an entity covers: a unit, building or resource node. */
export function footprintOf(s: GameState, id: number) {
  const e = s.nodes.get(id) ?? getEntity(s, id);
  return e ? footprint(e) : null;
}

/**
 * The entity under a tile or point. A unit counts within 0.6 tiles of its feet, or anywhere on its
 * figure up to `figureTall` above them unless the point is on a tree, bush, mine or farm (so a
 * gather order behind a figure still reaches the node); then buildings, their roof included
 * (`BUILDING_TOP` above the footprint), then nodes. Among units the nearest wins (feet before
 * bodies), or with `prefer` the nearest of that side's when one is there. With `orders` (the side
 * giving a right click, an order tap or a rally flag) the body of one of that side's own figures
 * also gives way to any building's footprint, so an order on a site, an enemy building or a camp
 * with its own units in front still reaches it, while an enemy standing in front of a building (a
 * raider at the player's house) still catches the click on its body. With `fog` (the player's
 * clicks and taps) a unit of another side that the player can't see doesn't count, nor does a
 * building of another side or a node on land the player has never explored (the test the scene's
 * sprites use, `seenBuilding` and `explored`), so a hidden enemy neither takes the click nor gives
 * itself away.
 */
export function entityAt(
  s: GameState,
  x: number,
  y: number,
  prefer?: number,
  orders?: number,
  fog = false,
): { kind: 'unit' | 'building' | 'node'; id: number; owner: number } | null {
  const within = (tx: number, ty: number, w: number, h: number) => x >= tx && y >= ty && x < tx + w && y < ty + h;
  const node = [...s.nodes.values()].find((n) => within(n.tx, n.ty, n.w, n.h) && (!fog || explored(s, n.tx, n.ty)));
  const buildings = [...s.buildings.values()].filter((b) => !fog || seenBuilding(s, b));
  const onFarm = buildings.some((b) => BUILDINGS[b.type].farm && within(b.tx, b.ty, BUILDINGS[b.type].w, BUILDINGS[b.type].h));
  const onBuilding = orders !== undefined && buildings.some((b) => within(b.tx, b.ty, BUILDINGS[b.type].w, BUILDINGS[b.type].h));
  let best: { kind: 'unit' | 'building' | 'node'; id: number; owner: number; d: number } | null = null;
  for (const u of s.units.values()) {
    if (fog && u.owner !== PLAYER && !visible(s, Math.floor(u.x), Math.floor(u.y))) continue;
    const tall = figureTall(UNITS[u.type]);
    const feet = Math.hypot(u.x - x, u.y - y);
    const under = onFarm || (onBuilding && u.owner === orders);
    const body = !node && !under && Math.abs(u.x - x) <= 0.45 && y <= u.y && y >= u.y - tall;
    if (feet > 0.6 && !body) continue;
    const d = feet <= 0.6 ? feet : 1 + Math.hypot(u.x - x, u.y - tall / 2 - y);
    const mine = u.owner === prefer;
    const bestMine = best?.owner === prefer;
    if (!best || (mine && !bestMine) || (mine === bestMine && d < best.d)) best = { kind: 'unit', id: u.id, owner: u.owner, d };
  }
  if (best) return best;
  let roofOf: Building | undefined;
  for (const b of buildings) {
    const def = BUILDINGS[b.type];
    if (within(b.tx, b.ty, def.w, def.h)) return { kind: 'building', id: b.id, owner: b.owner };
    if (!roofOf && within(b.tx, b.ty - BUILDING_TOP / TILE, def.w, BUILDING_TOP / TILE)) roofOf = b;
  }
  if (node) return { kind: 'node', id: node.id, owner: -1 };
  if (roofOf) return { kind: 'building', id: roofOf.id, owner: roofOf.owner };
  return null;
}

/** How tall a unit's figure stands above its feet, in tiles (its health thread hangs there). */
export function figureTall(def: UnitDef) {
  return (def.role === 'cavalry' ? 48 : def.role === 'siege' || def.role === 'warship' ? 44 : 40) / TILE;
}

export function popUsed(s: GameState, owner: number) {
  let used = 0;
  for (const u of s.units.values()) if (u.owner === owner) used += 1 + u.cargo.length;
  for (const b of s.buildings.values()) {
    if (b.owner !== owner) continue;
    used += b.garrison.length;
    for (const q of b.queue) if (q.kind === 'unit') used++;
  }
  return used;
}

/** A unit's full health: its kind's, plus RANK_HP for each veteran rank. */
export function maxHp(u: Unit) {
  return UNITS[u.type].hp + u.rank * RANK_HP;
}

/** How many of a kind of unit a player has alive, sheltering or in training (the champion's limit). */
export function unitCount(s: GameState, owner: number, type: string) {
  let n = 0;
  for (const u of s.units.values()) {
    if (u.owner !== owner) continue;
    if (u.type === type) n++;
    for (const c of u.cargo) if (c.type === type) n++;
  }
  for (const b of s.buildings.values()) {
    if (b.owner !== owner) continue;
    for (const g of b.garrison) if (g.type === type) n++;
    for (const q of b.queue) if (q.kind === 'unit' && q.key === type) n++;
  }
  return n;
}

/** The trading post whose footprint covers a point, if any; with `fog`, only one the player has explored. */
export function postAt(s: GameState, x: number, y: number, fog = false): PostSpot | null {
  for (const p of s.posts) if (x >= p.tx && y >= p.ty && x < p.tx + 2 && y < p.ty + 2 && (!fog || explored(s, p.tx, p.ty))) return p;
  return null;
}

export function popCap(s: GameState, owner: number) {
  let cap = 0;
  for (const b of s.buildings.values()) if (b.owner === owner && b.built) cap += BUILDINGS[b.type].pop ?? 0;
  return cap;
}

export function hasBuilt(s: GameState, owner: number, type: BuildingId) {
  for (const b of s.buildings.values()) if (b.owner === owner && b.type === type && b.built) return true;
  return false;
}

export function hasBuildingFor(s: GameState, owner: number, type: BuildingId) {
  for (const b of s.buildings.values()) if (b.owner === owner && b.type === type) return true;
  return false;
}

export function visible(s: GameState, x: number, y: number) {
  return inMap(x, y) && s.sight[idx(x, y)] === 2;
}

/** Whether the player has ever seen a tile (it is explored or in sight now). */
export function explored(s: GameState, x: number, y: number) {
  return inMap(x, y) && s.sight[idx(x, y)] >= 1;
}

/** Whether the player knows of a building: their own, a Monument or Wonder (seen by everyone) or one on explored land. */
export function seenBuilding(s: GameState, b: Building) {
  return b.owner === PLAYER || b.type === 'monument' || b.type === 'wonder' || explored(s, b.tx, b.ty);
}

// ---------------------------------------------------------------- map state

function addBuilding(s: GameState, owner: number, type: BuildingId, tx: number, ty: number, built: boolean): Building {
  const def = BUILDINGS[type];
  const b: Building = {
    id: s.nextId++,
    owner,
    type,
    tx,
    ty,
    hp: built ? def.hp : Math.round(def.hp * 0.1),
    built,
    buildLeft: def.time,
    queue: [],
    cool: 0,
    rally: null,
    doneAt: built ? s.time : -1,
    workMs: 0,
    garrison: [],
    crew: 0,
    crewAt: -1,
  };
  s.buildings.set(b.id, b);
  return b;
}

function spawnUnit(s: GameState, owner: number, type: string, near: Building): Unit | null {
  // Ships come out on the water beside the Harbour.
  const spot = isNaval(UNITS[type].role) ? waterSpotNear(s, near) : freeSpotNear(s, near);
  if (!spot) return null;
  return spawnAt(s, owner, type, spot.x, spot.y);
}

function spawnAt(s: GameState, owner: number, type: string, x: number, y: number): Unit {
  const def = UNITS[type];
  const u: Unit = {
    id: s.nextId++,
    owner,
    type,
    x,
    y,
    hp: def.hp,
    order: { t: 'idle' },
    path: [],
    repath: 0,
    cool: 0,
    carry: null,
    amount: 0,
    gatherMs: 0,
    home: null,
    lastRes: null,
    site: null,
    act: 'idle',
    face: owner === PLAYER ? 1 : -1,
    struck: -1e9,
    post: null,
    kills: 0,
    rank: 0,
    pulse: 0,
    cargo: [],
    packed: null,
  };
  s.units.set(u.id, u);
  return u;
}

/** A tile a ship can sail next to a building (the Harbour), nearest first. */
function waterSpotNear(s: GameState, b: Building): { x: number; y: number } | null {
  const def = BUILDINGS[b.type];
  for (let r = 1; r <= 4; r++) {
    for (let y = b.ty - r; y < b.ty + def.h + r; y++)
      for (let x = b.tx - r; x < b.tx + def.w + r; x++) {
        const edge = x < b.tx || y < b.ty || x >= b.tx + def.w || y >= b.ty + def.h;
        if (edge && seaAt(s, x, y)) return { x: x + 0.5, y: y + 0.5 };
      }
  }
  return null;
}

/** A walkable tile next to a building, nearest first; the building's own tiles are not walkable. */
function freeSpotNear(s: GameState, b: Building): { x: number; y: number } | null {
  const def = BUILDINGS[b.type];
  for (let r = 1; r <= 4; r++) {
    for (let y = b.ty - r; y < b.ty + def.h + r; y++)
      for (let x = b.tx - r; x < b.tx + def.w + r; x++) {
        const edge = x < b.tx || y < b.ty || x >= b.tx + def.w || y >= b.ty + def.h;
        if (!edge || !inMap(x, y) || blocked(s, x, y, b.owner)) continue;
        return { x: x + 0.5, y: y + 0.5 };
      }
  }
  return null;
}

/** The free tile centres in a ring `r` tiles out from a w x h footprint, clockwise from the top-left. */
function ringAround(s: GameState, tx: number, ty: number, w: number, h: number, r = 1): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const x0 = tx - r;
  const y0 = ty - r;
  const x1 = tx + w - 1 + r;
  const y1 = ty + h - 1 + r;
  const push = (x: number, y: number) => {
    if (inMap(x, y) && !s.solid[idx(x, y)]) out.push({ x: x + 0.5, y: y + 0.5 });
  };
  for (let x = x0; x < x1; x++) push(x, y0);
  for (let y = y0; y < y1; y++) push(x1, y);
  for (let x = x1; x > x0; x--) push(x, y1);
  for (let y = y1; y > y0; y--) push(x0, y);
  return out;
}

const isBlocked = (s: GameState, x: number, y: number, owner: number) => blocked(s, x, y, owner);

/** Whether a tile stops a unit of `owner`: solid ground, or a gate that isn't its own. */
export function blocked(s: GameState, x: number, y: number, owner: number) {
  if (!inMap(x, y)) return true;
  const i = idx(x, y);
  return s.solid[i] === 1 || (s.gates[i] >= 0 && s.gates[i] !== owner);
}

/**
 * Marks every blocked tile: terrain, buildings (even unfinished ones), camps and nodes. A finished
 * gate is not solid: it goes in `gates`, so only its owner's units walk through it.
 */
export function rebuildSolid(s: GameState) {
  for (let i = 0; i < s.solid.length; i++) s.solid[i] = s.terrain[i] === WATER || s.terrain[i] === ROCK ? 1 : 0;
  s.gates.fill(-1);
  const mark = (tx: number, ty: number, w: number, h: number) => {
    for (let y = ty; y < ty + h; y++) for (let x = tx; x < tx + w; x++) if (inMap(x, y)) s.solid[idx(x, y)] = 1;
  };
  for (const n of s.nodes.values()) mark(n.tx, n.ty, n.w, n.h);
  for (const c of s.camps) if (!c.claimed) mark(c.tx, c.ty, 2, 2);
  for (const p of s.posts) mark(p.tx, p.ty, 2, 2);
  for (const b of s.buildings.values()) {
    const def = BUILDINGS[b.type];
    if (b.type === 'gate' && b.built) s.gates[idx(b.tx, b.ty)] = b.owner;
    else mark(b.tx, b.ty, def.w, def.h);
  }
}

/** Recomputes what the player sees: sight circles of every own unit and building. */
export function updateSight(s: GameState) {
  for (let i = 0; i < s.sight.length; i++) if (s.sight[i] === 2) s.sight[i] = 1;
  const reveal = (cx: number, cy: number, r: number) => {
    for (let y = Math.floor(cy - r); y <= Math.floor(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.floor(cx + r); x++) {
        if (!inMap(x, y) || Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r) continue;
        s.sight[idx(x, y)] = 2;
      }
  };
  for (const u of s.units.values()) if (u.owner === PLAYER) reveal(u.x, u.y, unitDef(u).sight);
  for (const b of s.buildings.values()) {
    if (b.owner !== PLAYER) continue;
    const def = BUILDINGS[b.type];
    reveal(b.tx + def.w / 2, b.ty + def.h / 2, def.sight);
  }
  // Seeing a rival's Town Center reveals its temperament.
  for (const b of s.buildings.values()) {
    if (b.type !== 'town' || b.owner === PLAYER || s.players[b.owner].scouted) continue;
    for (let y = b.ty; y < b.ty + 4; y++) for (let x = b.tx; x < b.tx + 4; x++) if (s.sight[idx(x, y)] === 2) s.players[b.owner].scouted = true;
  }
}

// ---------------------------------------------------------------- pathing

const visited = new Int32Array(MAP_SIZE * MAP_SIZE);
const parent = new Int32Array(MAP_SIZE * MAP_SIZE);
const queue = new Int32Array(MAP_SIZE * MAP_SIZE);
let stamp = 0;
const NEIGHBOURS = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
] as const;

/**
 * Breadth-first search from a point to the nearest tile that `goal` accepts. Returns the tile
 * centres to walk through (empty if the start already qualifies), or null when nothing is reachable.
 */
export function findPath(s: GameState, sx: number, sy: number, goal: (tx: number, ty: number) => boolean, owner = -1, naval = false) {
  // Ships sail water and shallows; everyone else walks where nothing blocks them.
  const blocked = naval ? (x: number, y: number) => !seaAt(s, x, y) : (x: number, y: number, o: number) => isBlocked(s, x, y, o);
  const startX = Math.floor(sx);
  const startY = Math.floor(sy);
  if (goal(startX, startY)) return [];
  stamp++;
  let head = 0;
  let tail = 0;
  const start = idx(startX, startY);
  visited[start] = stamp;
  queue[tail++] = start;
  while (head < tail) {
    const cur = queue[head++];
    const cx = cur % MAP_SIZE;
    const cy = (cur - cx) / MAP_SIZE;
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inMap(nx, ny)) continue;
      const ni = idx(nx, ny);
      if (visited[ni] === stamp || blocked(nx, ny, owner)) continue;
      // A diagonal step needs both straight neighbours free, so units never squeeze past a corner
      // (and a diagonal palisade has no gaps).
      if (dx && dy && (blocked(cx + dx, cy, owner) || blocked(cx, cy + dy, owner))) continue;
      visited[ni] = stamp;
      parent[ni] = cur;
      if (goal(nx, ny)) {
        const path: { x: number; y: number }[] = [];
        let at = ni;
        while (at !== start) {
          path.push({ x: (at % MAP_SIZE) + 0.5, y: Math.floor(at / MAP_SIZE) + 0.5 });
          at = parent[at];
        }
        return path.reverse();
      }
      queue[tail++] = ni;
    }
  }
  return null;
}

function stepAlong(u: Unit, speed: number, dt: number) {
  const next = u.path[0];
  if (!next) return;
  const dx = next.x - u.x;
  const dy = next.y - u.y;
  const d = Math.hypot(dx, dy);
  const step = (speed * dt) / 1000;
  if (d > 0.001) u.act = 'walk';
  faceTo(u, next.x);
  if (d <= step) {
    u.x = next.x;
    u.y = next.y;
    u.path.shift();
  } else {
    u.x += (dx / d) * step;
    u.y += (dy / d) * step;
  }
}

/** Walks towards a goal tile set, repathing now and then. Returns false if the goal can't be reached. */
function pursue(s: GameState, u: Unit, speed: number, dt: number, goal: (tx: number, ty: number) => boolean): boolean {
  u.repath -= dt;
  if (u.path.length === 0 || u.repath <= 0) {
    const path = findPath(s, u.x, u.y, goal, u.owner, isShip(u));
    if (path === null) return false;
    // Already on a qualifying tile: still walk to its centre, so the unit is in reach of the goal.
    u.path = path.length > 0 ? path : [{ x: Math.floor(u.x) + 0.5, y: Math.floor(u.y) + 0.5 }];
    u.repath = 700;
  }
  stepAlong(u, speed, dt);
  return true;
}

// ---------------------------------------------------------------- orders

/** Gives a command to some of a player's units. Buildings are ignored; only villagers can build. */
export function issue(s: GameState, owner: number, ids: number[], cmd: Command) {
  for (const id of ids) {
    const u = s.units.get(id);
    if (!u || u.owner !== owner) continue;
    const role = unitDef(u).role;
    u.path = [];
    u.repath = 0;
    switch (cmd.t) {
      case 'move':
        u.order = { t: 'move', x: cmd.x, y: cmd.y };
        break;
      case 'attackMove':
        if (isSoldier(role)) u.order = { t: 'attackMove', x: cmd.x, y: cmd.y };
        break;
      case 'attack': {
        const target = getEntity(s, cmd.target);
        // The player attacking a side it is at peace with breaks the pact.
        if (target && owner === PLAYER && atPeace(s, owner, target.owner)) breakPact(s, target.owner);
        // A ram can't hurt a unit: sent at one, it walks there instead.
        if (target && role === 'siege' && 'order' in target) u.order = { t: 'move', x: target.x, y: target.y };
        else if (target && target.owner !== owner && isSoldier(role)) u.order = { t: 'attack', target: cmd.target, resume: null };
        break;
      }
      case 'trade':
        if (role === 'cart') u.order = { t: 'trade' };
        break;
      case 'board': {
        // Every land unit can go aboard one of its side's transports.
        const ship = s.units.get(cmd.ship);
        if (!isNaval(role) && ship && ship.owner === owner && UNITS[ship.type].role === 'transport') u.order = { t: 'board', ship: ship.id };
        break;
      }
      case 'unload':
        if (role === 'transport') u.order = { t: 'unload', x: cmd.x, y: cmd.y };
        break;
      case 'gather':
        if (role === 'villager') {
          u.home = cmd.node;
          u.order = { t: 'gather', node: cmd.node };
        }
        break;
      case 'build':
        if (role === 'villager') u.order = { t: 'build', b: cmd.b };
        break;
      case 'stop':
        u.order = { t: 'idle' };
        break;
    }
  }
}

/**
 * Places a building if the owner may build it, the footprint is free and the owner can pay. Returns
 * its id, or null. A gate placed on the owner's own palisade replaces that piece of wall.
 */
export function placeBuilding(s: GameState, owner: number, type: BuildingId, tx: number, ty: number): number | null {
  const def = BUILDINGS[type];
  const p = s.players[owner];
  if (notAllowed(s, owner, type) || !affordable(p, def.cost)) return null;
  if (!canPlace(s, type, tx, ty, owner)) return null;
  pay(p, def.cost);
  const old = type === 'gate' ? wallAt(s, owner, tx, ty) : null;
  if (old) s.buildings.delete(old.id);
  const b = addBuilding(s, owner, type, tx, ty, false);
  // Whoever was building the replaced stake (or left it for the bell) builds the gate instead of going idle.
  if (old) {
    const sheltering = [...s.buildings.values()].flatMap((h) => h.garrison);
    for (const u of [...s.units.values(), ...sheltering]) {
      if (u.order.t === 'build' && u.order.b === old.id) u.order = { t: 'build', b: b.id };
      if (u.site === old.id) u.site = b.id;
    }
  }
  rebuildSolid(s);
  // Everyone hears of a Wonder's site: it wins once finished.
  if (type === 'wonder') say(s, owner === PLAYER ? t('wonderBegunOwn') : t('wonderBegunFoe', { faction: t(FACTIONS[p.faction].name) }));
  return b.id;
}

/** The owner's palisade piece on a tile, if any. */
function wallAt(s: GameState, owner: number, tx: number, ty: number): Building | null {
  for (const b of s.buildings.values()) if (b.owner === owner && b.type === 'wall' && b.tx === tx && b.ty === ty) return b;
  return null;
}

/**
 * Whether a building fits: free ground, with no unit standing on any of its tiles, that a builder can
 * reach. A Dock must also touch water, and a gate may go on the owner's own palisade.
 */
export function canPlace(s: GameState, type: BuildingId, tx: number, ty: number, owner = PLAYER) {
  const def = BUILDINGS[type];
  const onWall = type === 'gate' && wallAt(s, owner, tx, ty) !== null;
  if (!onWall)
    for (let y = ty; y < ty + def.h; y++)
      for (let x = tx; x < tx + def.w; x++) if (!inMap(x, y) || s.solid[idx(x, y)] || s.gates[idx(x, y)] >= 0 || s.terrain[idx(x, y)] === SHALLOW) return false;
  for (const u of s.units.values()) {
    const ux = Math.floor(u.x);
    const uy = Math.floor(u.y);
    if (ux >= tx && ux < tx + def.w && uy >= ty && uy < ty + def.h) return false;
  }
  if (def.shore && !nearWater(s, tx, ty, def.w, def.h)) return false;
  // Someone has to be able to reach it to build it.
  return touchable(s, { x0: tx, y0: ty, x1: tx + def.w, y1: ty + def.h });
}

/** Whether water touches a footprint's edge (the Dock's shore). */
export function nearWater(s: GameState, tx: number, ty: number, w: number, h: number) {
  for (let y = ty - 1; y <= ty + h; y++)
    for (let x = tx - 1; x <= tx + w; x++) if (inMap(x, y) && s.terrain[idx(x, y)] === WATER) return true;
  return false;
}

/** The tiles of a palisade line from one tile to another, as a player drags it out (no gaps on diagonals). */
export function wallLine(x0: number, y0: number, x1: number, y1: number): { tx: number; ty: number }[] {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  const out: { tx: number; ty: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    out.push({ tx: Math.round(x0 + (x1 - x0) * t), ty: Math.round(y0 + (y1 - y0) * t) });
  }
  return out.slice(0, 40);
}

/** Places a line of palisade, as many pieces as fit and the owner can pay for. Returns their ids. */
export function placeWall(s: GameState, owner: number, tiles: { tx: number; ty: number }[]): number[] {
  const ids: number[] = [];
  for (const t of tiles) {
    const id = placeBuilding(s, owner, 'wall', t.tx, t.ty);
    if (id !== null) ids.push(id);
  }
  return ids;
}

/** Sets where a production building's new units go. */
export function setRally(s: GameState, owner: number, bid: number, x: number, y: number): boolean {
  const b = s.buildings.get(bid);
  if (!b || b.owner !== owner || !takesRally(b.type)) return false;
  b.rally = { x, y };
  return true;
}

/** Takes a production building's rally flag down, so its new units go to work on their own again. */
export function clearRally(s: GameState, owner: number, bid: number): boolean {
  const b = s.buildings.get(bid);
  if (!b || b.owner !== owner || !b.rally) return false;
  b.rally = null;
  return true;
}

/** Queues a unit at a finished building the owner controls. */
export function train(s: GameState, owner: number, bid: number, type: string): boolean {
  const b = s.buildings.get(bid);
  const def = UNITS[type];
  if (!b || b.owner !== owner || !b.built || !def) return false;
  if (!BUILDINGS[b.type].trains?.includes(def.role)) return false;
  const p = s.players[owner];
  if (def.age && p.age < def.age) return false;
  if (def.faction !== 'neutral' && def.faction !== p.faction) return false;
  if (def.elite && !p.elite) return false;
  if (def.limit !== undefined && unitCount(s, owner, type) >= def.limit) return false;
  const cost = unitCost(s, owner, def);
  if (!affordable(p, cost) || popUsed(s, owner) + 1 > popCap(s, owner)) return false;
  pay(p, cost);
  b.queue.push({ kind: 'unit', key: type, left: def.time });
  return true;
}

/** Queues research at a building that teaches it, once its prerequisites are met. */
export function research(s: GameState, owner: number, bid: number, techId: string): boolean {
  const b = s.buildings.get(bid);
  const tech = TECHS[techId];
  const p = s.players[owner];
  if (!b || !tech || b.owner !== owner || !b.built || b.type !== (tech.at === 'town' ? 'town' : 'academy')) return false;
  if (tech.age2 && p.age < 2) return false;
  if (tech.advance && p.age !== tech.advance - 1) return false;
  if (tech.advance === 3 && !deedsDone(p)) return false;
  if (tech.advance === 4 && !deeds4Done(p)) return false;
  if (p.techs.includes(techId) || techQueued(s, owner, techId)) return false;
  if (!affordable(p, tech.cost)) return false;
  pay(p, tech.cost);
  b.queue.push({ kind: 'tech', key: techId, left: tech.time });
  return true;
}

/** Whether a tech is already queued at any of the owner's buildings (a second Academy counts). */
export function techQueued(s: GameState, owner: number, techId: string) {
  for (const b of s.buildings.values()) if (b.owner === owner && b.queue.some((q) => q.key === techId)) return true;
  return false;
}

/** How many of the three Age III deeds a player has done. */
export function deedCount(p: Player) {
  return (p.deeds.age2 ? 1 : 0) + (p.deeds.army >= ARMY_DEED ? 1 : 0) + (p.deeds.raid ? 1 : 0);
}
export const deedsDone = (p: Player) => deedCount(p) === 3;
/** How many of the three Age IV deeds a player has done. */
export function deed4Count(p: Player) {
  return (p.deeds4.relic ? 1 : 0) + (p.deeds4.champion ? 1 : 0) + (p.deeds4.veteran ? 1 : 0);
}
export const deeds4Done = (p: Player) => deed4Count(p) === 3;

/** Takes the Age II boon a player was offered. */
export function chooseBoon(s: GameState, owner: number, boon: BoonId): boolean {
  const p = s.players[owner];
  if (!p.boonPending) return false;
  p.boon = boon;
  p.boonPending = false;
  return true;
}

/** Takes the Age III pick a player was offered; Masonry raises the health of what already stands. */
export function chooseEdge(s: GameState, owner: number, edge: EdgeId): boolean {
  const p = s.players[owner];
  if (!p.edgePending) return false;
  p.edge = edge;
  p.edgePending = false;
  if (edge === 'masonry') for (const b of s.buildings.values()) if (b.owner === owner) b.hp *= MASONRY_HP;
  return true;
}

/** Soldiers a player has alive. */
export function soldierCount(s: GameState, owner: number) {
  let n = 0;
  for (const u of s.units.values()) if (u.owner === owner && u.hp > 0 && isSoldier(unitDef(u).role)) n++;
  return n;
}

/** The buildings a player's villagers may shelter in: the Town Center and finished Watchtowers. */
export function shelters(s: GameState, owner: number): Building[] {
  return [...s.buildings.values()].filter((b) => b.owner === owner && b.built && b.hp > 0 && BUILDINGS[b.type].shelter);
}

/**
 * Rings the town bell: every villager within BELL_RANGE of a shelter runs to the nearest one with room
 * (its `shelter`, counting those already on their way), and gathering stops until `releaseBell`.
 * Returns how many were sent.
 */
export function ringBell(s: GameState, owner: number): number {
  const p = s.players[owner];
  const homes = shelters(s, owner);
  if (homes.length === 0) return 0;
  const room = new Map<number, number>();
  for (const b of homes) room.set(b.id, (BUILDINGS[b.type].shelter ?? 0) - b.garrison.length);
  for (const u of s.units.values()) if (u.owner === owner && u.order.t === 'garrison') room.set(u.order.b, (room.get(u.order.b) ?? 0) - 1);
  let sent = 0;
  const villagers = [...s.units.values()].filter((u) => u.owner === owner && unitDef(u).role === 'villager' && u.order.t !== 'garrison');
  for (const u of villagers) {
    let best: { b: Building; d: number } | null = null;
    for (const b of homes) {
      if ((room.get(b.id) ?? 0) <= 0) continue;
      const d = gap(u.x, u.y, footprint(b));
      if (d <= BELL_RANGE && (!best || d < best.d)) best = { b, d };
    }
    if (!best) continue;
    room.set(best.b.id, (room.get(best.b.id) ?? 0) - 1);
    u.path = [];
    u.repath = 0;
    u.site = u.order.t === 'build' ? u.order.b : null;
    u.order = { t: 'garrison', b: best.b.id };
    sent++;
  }
  // The bell only counts as rung once someone is on their way in.
  if (sent > 0) p.bell = true;
  if (owner === PLAYER) say(s, sent > 0 ? t('bellRings', { n: sent }) : t('bellNobody'));
  return sent;
}

/** Sends every sheltering villager back to work, and those still running for shelter too. */
export function releaseBell(s: GameState, owner: number): number {
  const p = s.players[owner];
  p.bell = false;
  let out = 0;
  for (const b of s.buildings.values()) if (b.owner === owner) out += ungarrison(s, b);
  for (const u of s.units.values()) if (u.owner === owner && u.order.t === 'garrison') backToWork(s, u);
  if (owner === PLAYER) say(s, out > 0 ? t('backToWorkNotice') : t('nobodySheltering'));
  return out;
}

/** Lets a building's garrison out onto the free tiles round it, back to the work they left. */
function ungarrison(s: GameState, b: Building): number {
  let out = 0;
  for (const u of [...b.garrison]) {
    const spot = freeSpotNear(s, b);
    if (!spot) break;
    b.garrison.splice(b.garrison.indexOf(u), 1);
    u.x = spot.x;
    u.y = spot.y;
    s.units.set(u.id, u);
    backToWork(s, u);
    out++;
  }
  return out;
}

/** A villager out of shelter goes back to the site it was building or the node it was working, or stands by. */
function backToWork(s: GameState, u: Unit) {
  u.path = [];
  u.repath = 0;
  // A builder called in by the bell goes back to its site while it still stands unfinished.
  const site = u.site !== null ? s.buildings.get(u.site) : undefined;
  u.site = null;
  if (site && site.owner === u.owner && !site.built) return void (u.order = { t: 'build', b: site.id });
  const home = u.home !== null ? s.nodes.get(u.home) ?? s.buildings.get(u.home) : undefined;
  const again = home && ('amount' in home ? home.amount > 0 : true) ? home : u.lastRes ? nearestSource(s, u.owner, u.lastRes, u.x, u.y) : null;
  u.order = u.amount > 0 ? { t: 'return' } : again ? { t: 'gather', node: again.id } : { t: 'idle' };
  u.home = again ? again.id : null;
}

/** Villagers a player has sheltering, in every building. */
export function garrisoned(s: GameState, owner: number) {
  let n = 0;
  for (const b of s.buildings.values()) if (b.owner === owner) n += b.garrison.length;
  return n;
}

/** What a lot of wood or food costs in ore at the Market now, or what selling one pays. */
export function marketPrice(s: GameState, owner: number, res: 'wood' | 'food', dir: 'buy' | 'sell') {
  const rate = s.players[owner].rates[res];
  return dir === 'buy' ? Math.ceil(MARKET_BASE * rate) : Math.floor(MARKET_BASE * rate * MARKET_SELL);
}

/** Buys or sells a lot of wood or food for ore at a finished Market; the rate moves with each trade. */
export function trade(s: GameState, owner: number, res: 'wood' | 'food', dir: 'buy' | 'sell'): boolean {
  if (!hasBuilt(s, owner, 'market')) return false;
  const p = s.players[owner];
  const price = marketPrice(s, owner, res, dir);
  if (dir === 'buy') {
    if (p.res.ore < price) return false;
    p.res.ore -= price;
    p.res[res] += MARKET_LOT;
    p.rates[res] = Math.min(MARKET_RATE_MAX, p.rates[res] + MARKET_STEP);
  } else {
    if (p.res[res] < MARKET_LOT) return false;
    p.res[res] -= MARKET_LOT;
    p.res.ore += price;
    p.rates[res] = Math.max(MARKET_RATE_MIN, p.rates[res] - MARKET_STEP);
  }
  return true;
}

/** Market rates drift back towards the base price. */
function updateMarkets(s: GameState, dt: number) {
  for (const p of s.players) {
    for (const res of ['wood', 'food'] as const) {
      const r = p.rates[res];
      const step = (MARKET_DRIFT * dt) / 1000;
      p.rates[res] = r > 1 ? Math.max(1, r - step) : Math.min(1, r + step);
    }
  }
}

const COMPASS: TextKey[] = ['east', 'southEast', 'south', 'southWest', 'west', 'northWest', 'north', 'northEast'];

/** Records a raid: `ids` sent by `by` at `target`. One raid is tracked at a time. */
export function startRaid(s: GameState, by: number, target: number, ids: number[]) {
  if (s.raid || ids.length === 0) return;
  // In a three-way match only raids on the player are tracked (the AIs' raids on each other count
  // through `updateAssault`), so one between them never hides one coming for the player.
  if (threeWay(s) && target !== PLAYER) return;
  const town = [...s.buildings.values()].find((b) => b.owner === target && b.type === 'town');
  const live = ids.map((id) => s.units.get(id)).filter((u): u is Unit => !!u);
  const x = live.reduce((a, u) => a + u.x, 0) / Math.max(1, live.length);
  const y = live.reduce((a, u) => a + u.y, 0) / Math.max(1, live.length);
  const cx = town ? town.tx + 2 : x;
  const cy = town ? town.ty + 2 : y;
  const a = Math.atan2(y - cy, x - cx);
  const from = COMPASS[(Math.round(a / (Math.PI / 4)) + 8) % 8];
  s.raids++;
  s.raid = { n: s.raids, by, target, ids: [...ids], size: ids.length, routed: 0, x, y, from, started: s.time };
}

/**
 * Ends `by`'s raid with raiders still alive: turned back by losses, which counts as repelled (and
 * does the deed), or withdrawn with its goal done.
 */
export function endRaid(s: GameState, by: number, repelled: boolean) {
  const r = s.raid;
  if (!r || r.by !== by) return;
  s.raid = null;
  if (repelled) {
    s.players[r.target].deeds.raid = true;
    s.repelled++;
  }
  if (r.target === PLAYER) say(s, repelled ? t('raidRepelled') : t('raidersWithdraw'));
}

/** Keeps the raid's count and position, and marks the deed when every raider has fallen. */
function updateRaid(s: GameState) {
  const r = s.raid;
  if (!r) return;
  let alive = 0;
  let sx = 0;
  let sy = 0;
  for (const id of r.ids) {
    const u = s.units.get(id);
    if (!u || u.hp <= 0) continue;
    alive++;
    sx += u.x;
    sy += u.y;
  }
  r.routed = r.size - alive;
  if (alive > 0) {
    r.x = sx / alive;
    r.y = sy / alive;
    return;
  }
  s.players[r.target].deeds.raid = true;
  s.repelled++;
  s.raid = null;
  if (r.target === PLAYER) say(s, t('raidRepelled'));
}

/**
 * Attacks on an AI's base that no tracked raid covers (the player's, and in a three-way match the
 * other AI's): ASSAULT_MIN soldiers of other sides near its Town Center start one, any more that come
 * join it, and once none is left within ASSAULT_CLEAR tiles it ends, repelled (that AI's raid deed)
 * if half of them fell.
 */
function updateAssault(s: GameState) {
  const tracked = new Set(s.raid ? s.raid.ids : []);
  for (const p of s.players) {
    if (p.id === PLAYER || p.id === NEUTRAL) continue;
    const town = [...s.buildings.values()].find((b) => b.owner === p.id && b.type === 'town');
    if (!town) {
      s.assault[p.id] = null;
      continue;
    }
    const cx = town.tx + 2;
    const cy = town.ty + 2;
    const near = (u: Unit, range: number) => Math.hypot(u.x - cx, u.y - cy) <= range;
    const attackers = [...s.units.values()].filter((u) => hostile(s, u.owner, p.id) && u.owner !== NEUTRAL && u.hp > 0 && isSoldier(unitDef(u).role) && !tracked.has(u.id) && near(u, BELL_RANGE));
    const ids = s.assault[p.id];
    if (!ids) {
      if (attackers.length >= ASSAULT_MIN) s.assault[p.id] = attackers.map((u) => u.id);
      continue;
    }
    for (const u of attackers) if (!ids.includes(u.id)) ids.push(u.id);
    const alive = ids.map((id) => s.units.get(id)).filter((u): u is Unit => !!u && u.hp > 0);
    if (alive.some((u) => near(u, ASSAULT_CLEAR))) continue;
    // One that went back aboard a transport has left, not fallen.
    const aboard = new Set<number>();
    for (const u of s.units.values()) for (const c of u.cargo) aboard.add(c.id);
    const fell = ids.filter((id) => {
      const u = s.units.get(id);
      return u ? u.hp <= 0 : !aboard.has(id);
    }).length;
    if (fell * 2 >= ids.length) p.deeds.raid = true;
    s.assault[p.id] = null;
  }
}

function updateDeeds(s: GameState) {
  for (const p of s.players) {
    if (p.id === NEUTRAL || p.out) continue;
    if (p.age >= 2) p.deeds.age2 = true;
    p.deeds.army = Math.max(p.deeds.army, soldierCount(s, p.id));
    // The Age IV deeds count from Age III on.
    if (p.age < 3) continue;
    const d = p.deeds4;
    if (!d.relic && s.camps.some((c) => c.relic && c.holder === p.id)) d.relic = true;
    if (!d.champion || !d.veteran) {
      for (const u of s.units.values()) {
        if (u.owner !== p.id || u.hp <= 0) continue;
        if (UNITS[u.type].role === 'champion') d.champion = true;
        if (u.rank >= VETERAN_RANK) d.veteran = true;
      }
    }
  }
}

function emit(s: GameState, e: SimEvent) {
  s.events.push(e);
  // Nobody may be draining the list (a test reading the sim without a scene): keep it short.
  if (s.events.length > 400) s.events.splice(0, s.events.length - 400);
}

function centre(f: { x0: number; y0: number; x1: number; y1: number }) {
  return { x: (f.x0 + f.x1) / 2, y: (f.y0 + f.y1) / 2 };
}

/** Turns a unit towards a point. */
function faceTo(u: Unit, x: number) {
  if (Math.abs(x - u.x) > 0.05) u.face = x > u.x ? 1 : -1;
}

export function say(s: GameState, text: string) {
  s.notice = text;
  s.noticeMs = 2500;
}

// ---------------------------------------------------------------- time

export function tick(s: GameState, dt: number) {
  if (s.winner !== null) return;
  s.time += dt;
  s.noticeMs = Math.max(0, s.noticeMs - dt);
  for (const b of [...s.buildings.values()]) updateBuilding(s, b, dt);
  for (const u of [...s.units.values()]) if (u.hp > 0) updateUnit(s, u, dt);
  separate(s, dt);
  updateMarkets(s, dt);
  reap(s);
  updateCamps(s);
  updateDeeds(s);
  updateRaid(s);
  updateAssault(s);
  updatePacts(s);
  updateSight(s);
  checkWinner(s);
}

function updateBuilding(s: GameState, b: Building, dt: number) {
  if (b.hp <= 0 || !b.built) return;
  const def = BUILDINGS[b.type];
  if (b.type === 'dock') fish(s, b, dt);
  if (b.type === 'grove') grow(s, b, dt);
  if (def.tower) {
    b.cool -= dt;
    if (b.cool <= 0) {
      const target = nearestEnemy(s, b.owner, b.tx + 0.5 * def.w, b.ty + 0.5 * def.h, def.tower.range);
      if (target) {
        // Each villager sheltering inside looses an arrow with the volley.
        const dmg = takenBy(s, target, def.tower.dmg + b.garrison.length * GARRISON_ARROW);
        target.hp -= dmg;
        b.cool = def.tower.cooldown;
        const at = centre(footprint(target));
        emit(s, { t: 'hit', x: at.x, y: at.y, fromX: b.tx + def.w / 2, fromY: b.ty + 0.5, dmg, ranged: true, owner: b.owner, victim: target.owner, target: target.id, tower: true });
      }
    }
  }
  const head = b.queue[0];
  if (!head) return;
  const p = s.players[b.owner];
  // Muster, the Age III pick, trains soldiers faster.
  head.left -= head.kind === 'unit' && isSoldier(UNITS[head.key].role) && p.edge === 'muster' ? dt * MUSTER_SPEED : dt;
  if (head.left > 0) return;
  if (head.kind === 'tech') {
    b.queue.shift();
    const advance = TECHS[head.key].advance;
    if (advance) {
      p.age = advance;
      // Reaching Age II opens the one-time boon pick, and Age III the pick of an edge.
      if (advance === 2 && !p.boon) p.boonPending = true;
      if (advance === 3 && !p.edge) p.edgePending = true;
      if (advance === 4) say(s, b.owner === PLAYER ? t('age4Own') : t('age4Foe', { faction: t(FACTIONS[p.faction].name) }));
    } else p.techs.push(head.key);
    return;
  }
  // A unit that can't leave yet (no room around the building) waits in the queue.
  const unit = spawnUnit(s, b.owner, head.key, b);
  if (!unit) {
    head.left = 0;
    return;
  }
  b.queue.shift();
  // A new trade cart sets off for the trading post at once.
  if (UNITS[unit.type].role === 'cart') return void (unit.order = { t: 'trade' });
  if (b.rally) return sendToRally(s, b, unit);
  // A new villager goes to work on whichever of wood and food is short.
  if (UNITS[unit.type].role === 'villager') {
    const res: Resource = s.players[b.owner].res.food < s.players[b.owner].res.wood ? 'food' : 'wood';
    const src = nearestSource(s, b.owner, res, unit.x, unit.y);
    if (src) {
      unit.home = src.id;
      unit.order = { t: 'gather', node: src.id };
    }
  }
}

/**
 * A new unit walks to its building's rally flag. A villager whose flag is on a tree, bush, mine or
 * farm gathers there, and one whose flag is on an own Lumber or Mining Camp gathers the nearest wood
 * or ore to it.
 */
function sendToRally(s: GameState, b: Building, u: Unit) {
  const r = b.rally!;
  const role = UNITS[u.type].role;
  if (role === 'villager') {
    const hit = entityAt(s, r.x, r.y, undefined, b.owner, b.owner === PLAYER);
    const own = hit?.kind === 'building' ? s.buildings.get(hit.id) : undefined;
    const mine = own && own.owner === b.owner && own.built ? own : undefined;
    const drops = mine ? BUILDINGS[mine.type].drops : undefined;
    const src =
      hit?.kind === 'node' || (mine && BUILDINGS[mine.type].farm)
        ? { id: hit!.id }
        : mine && Array.isArray(drops) && drops.length === 1
          ? nearestSource(s, b.owner, drops[0], mine.tx + BUILDINGS[mine.type].w / 2, mine.ty + BUILDINGS[mine.type].h / 2)
          : null;
    if (src) {
      u.home = src.id;
      u.order = { t: 'gather', node: src.id };
      return;
    }
  }
  // Each newcomer takes the next spot on a ring round the flag, so they don't stack on it.
  const k = s.units.size % RALLY_SPOTS.length;
  const [ox, oy] = RALLY_SPOTS[k];
  u.order = { t: 'move', x: r.x + ox, y: r.y + oy };
}

const RALLY_SPOTS: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [-1, -1], [1, -1], [2, 0], [0, 2], [-2, 0], [0, -2]];

/** The Dock (Tide Coven) lands a catch of food every DOCK_MS. */
function fish(s: GameState, b: Building, dt: number) {
  b.workMs += dt;
  if (b.workMs < DOCK_MS) return;
  b.workMs -= DOCK_MS;
  s.players[b.owner].res.food += DOCK_FOOD;
  emit(s, { t: 'drop', x: b.tx + 1, y: b.ty + 0.5, res: 'food', n: DOCK_FOOD, owner: b.owner });
}

/**
 * The Grove (Thorn Grove) plants a tree every GROVE_MS on a free tile within GROVE_RANGE of it, until
 * GROVE_TREES stand around it. A sapling never goes next to a building, so nothing gets boxed in.
 */
function grow(s: GameState, b: Building, dt: number) {
  b.workMs += dt;
  if (b.workMs < GROVE_MS) return;
  b.workMs -= GROVE_MS;
  const cx = b.tx + 1;
  const cy = b.ty + 1;
  let trees = 0;
  for (const n of s.nodes.values()) if (n.kind === 'tree' && Math.hypot(n.tx + 0.5 - cx, n.ty + 0.5 - cy) <= GROVE_RANGE + 1) trees++;
  if (trees >= GROVE_TREES) return;
  const free: { x: number; y: number; d: number }[] = [];
  for (let y = cy - GROVE_RANGE; y < cy + GROVE_RANGE; y++)
    for (let x = cx - GROVE_RANGE; x < cx + GROVE_RANGE; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > GROVE_RANGE || !inMap(x, y) || s.solid[idx(x, y)] || s.gates[idx(x, y)] >= 0) continue;
      if ([...s.units.values()].some((u) => Math.floor(u.x) === x && Math.floor(u.y) === y)) continue;
      if (nextToBuilding(s, x, y)) continue;
      free.push({ x, y, d });
    }
  if (free.length === 0) return;
  // The same order every time, so a run repeats: the next tile round the circle from the last.
  free.sort((p, q) => ((p.x * 7 + p.y * 13) % 17) - ((q.x * 7 + q.y * 13) % 17) || p.d - q.d);
  const at = free[Math.floor(s.time / GROVE_MS) % free.length];
  const tree: Node = { id: s.nextId++, kind: 'tree', res: 'wood', tx: at.x, ty: at.y, w: 1, h: 1, amount: AMOUNT.tree };
  s.nodes.set(tree.id, tree);
  rebuildSolid(s);
  emit(s, { t: 'grow', x: at.x + 0.5, y: at.y + 0.5 });
}

function nextToBuilding(s: GameState, x: number, y: number) {
  for (const b of s.buildings.values()) {
    const def = BUILDINGS[b.type];
    if (x >= b.tx - 1 && x <= b.tx + def.w && y >= b.ty - 1 && y <= b.ty + def.h) return true;
  }
  return false;
}

function updateUnit(s: GameState, u: Unit, dt: number) {
  const def = unitDef(u);
  u.cool = Math.max(0, u.cool - dt);
  u.act = 'idle';
  if (u.order.t === 'board') boardUpdate(s, u, def, dt);
  else if (isNaval(def.role)) shipUpdate(s, u, def, dt);
  else if (def.role === 'villager') villagerUpdate(s, u, def, dt);
  else if (def.role === 'cart' || def.role === 'wagon') cartUpdate(s, u, def, dt);
  else militaryUpdate(s, u, def, dt);
  if (def.gift === 'heal') heal(s, u, dt);
}

/** A villager or soldier walking to its transport: on the shore beside it, it goes aboard while there is room. */
function boardUpdate(s: GameState, u: Unit, def: UnitDef, dt: number) {
  const o = u.order as Extract<Order, { t: 'board' }>;
  const ship = s.units.get(o.ship);
  if (!ship || ship.hp <= 0 || ship.owner !== u.owner) return void (u.order = { t: 'idle' });
  if (ship.cargo.length >= TRANSPORT_CAP) {
    if (u.owner === PLAYER) say(s, t('transportFull', { n: TRANSPORT_CAP }));
    return void (u.order = { t: 'idle' });
  }
  if (Math.hypot(u.x - ship.x, u.y - ship.y) <= 1.7) {
    u.path = [];
    u.order = { t: 'idle' };
    s.units.delete(u.id);
    ship.cargo.push(u);
    return;
  }
  if (!pursue(s, u, speedOf(s, u, def), dt, (tx, ty) => !s.solid[idx(tx, ty)] && Math.hypot(tx + 0.5 - ship.x, ty + 0.5 - ship.y) <= 1.6)) u.order = { t: 'idle' };
}

/**
 * A ship: it sails to a point (on land, to the water within LANDING of it, where a transport puts its
 * cargo ashore for an `unload`), and a warship fights what comes within its range on its own, at sea
 * or on the shore. A ship that finds no way stands still a moment before it looks again.
 */
function shipUpdate(s: GameState, u: Unit, def: UnitDef, dt: number) {
  const o = u.order;
  const warship = def.role === 'warship';
  const sea = (cond: (tx: number, ty: number) => boolean) => (tx: number, ty: number) => seaAt(s, tx, ty) && cond(tx, ty);
  const landing = (x: number, y: number) => {
    if (seaAt(s, Math.floor(x), Math.floor(y))) return sea((tx, ty) => Math.hypot(tx + 0.5 - x, ty + 0.5 - y) <= 0.75);
    // Inland: the water nearest the point, so a click deep on an island lands on its nearest shore.
    const shore = seaNear(s, x, y) ?? { x, y };
    const r = Math.max(LANDING, Math.hypot(shore.x - x, shore.y - y) + 0.6);
    return sea((tx, ty) => Math.hypot(tx + 0.5 - x, ty + 0.5 - y) <= r);
  };
  const stuck = () => {
    u.order = { t: 'idle' };
    u.cool = 1500;
  };
  if (o.t === 'idle') {
    if (!warship || u.cool > 0) return;
    const foe = nearestEnemy(s, u.owner, u.x, u.y, def.range + 1.5);
    if (foe) u.order = { t: 'attack', target: foe.id, resume: null };
    return;
  }
  if (o.t === 'move' || o.t === 'unload') {
    const goal = landing(o.x, o.y);
    if (u.path.length === 0 && goal(Math.floor(u.x), Math.floor(u.y))) {
      if (o.t === 'unload' && dropCargo(s, u) === 0 && u.owner === PLAYER) say(s, t('noLanding'));
      u.order = { t: 'idle' };
      return;
    }
    if (!pursue(s, u, def.speed, dt, goal)) stuck();
    return;
  }
  if (o.t === 'attackMove') {
    const foe = nearestEnemy(s, u.owner, u.x, u.y, def.range + 1.5);
    if (foe) return void (u.order = { t: 'attack', target: foe.id, resume: { x: o.x, y: o.y } });
    const goal = landing(o.x, o.y);
    if (u.path.length === 0 && goal(Math.floor(u.x), Math.floor(u.y))) return void (u.order = { t: 'idle' });
    if (!pursue(s, u, def.speed, dt, goal)) stuck();
    return;
  }
  if (o.t === 'attack') {
    const target = getEntity(s, o.target);
    if (!target || target.hp <= 0 || !hostile(s, u.owner, target.owner)) {
      u.order = o.resume ? { t: 'attackMove', ...o.resume } : { t: 'idle' };
      return;
    }
    const f = footprintOf(s, o.target);
    if (!f) return;
    if (gap(u.x, u.y, f) <= def.range + 0.5) {
      u.path = [];
      u.act = 'fight';
      faceTo(u, centre(f).x);
      if (u.cool <= 0) {
        strike(s, u, def, target);
        u.cool = def.cooldown;
      }
      return;
    }
    if (!pursue(s, u, def.speed, dt, sea((tx, ty) => gap(tx + 0.5, ty + 0.5, f) <= def.range))) stuck();
    return;
  }
  u.order = { t: 'idle' };
}

/** The middle of the sea tile nearest a point, up to 24 tiles away, or null. */
function seaNear(s: GameState, x: number, y: number): { x: number; y: number } | null {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let best: { x: number; y: number } | null = null;
  let bestD = Infinity;
  for (let r = 0; r <= 24 && !best; r++)
    for (let ty = cy - r; ty <= cy + r; ty++)
      for (let tx = cx - r; tx <= cx + r; tx++) {
        if (Math.max(Math.abs(tx - cx), Math.abs(ty - cy)) !== r || !seaAt(s, tx, ty)) continue;
        const d = Math.hypot(tx + 0.5 - x, ty + 0.5 - y);
        if (d < bestD) {
          bestD = d;
          best = { x: tx + 0.5, y: ty + 0.5 };
        }
      }
  return best;
}

/** Puts a transport's cargo ashore on the free land round it, as many as find room. Returns how many landed. */
export function dropCargo(s: GameState, ship: Unit): number {
  let landed = 0;
  for (const c of [...ship.cargo]) {
    let spot: { x: number; y: number } | null = null;
    const cx = Math.floor(ship.x);
    const cy = Math.floor(ship.y);
    for (let r = 1; r <= Math.ceil(LANDING) + 1 && !spot; r++)
      for (let y = cy - r; y <= cy + r && !spot; y++)
        for (let x = cx - r; x <= cx + r && !spot; x++) {
          if (Math.max(Math.abs(x - cx), Math.abs(y - cy)) !== r || blocked(s, x, y, c.owner)) continue;
          if ([...s.units.values()].some((o) => Math.floor(o.x) === x && Math.floor(o.y) === y)) continue;
          spot = { x: x + 0.5, y: y + 0.5 };
        }
    if (!spot) break;
    ship.cargo.splice(ship.cargo.indexOf(c), 1);
    c.x = spot.x;
    c.y = spot.y;
    c.path = [];
    c.order = { t: 'idle' };
    s.units.set(c.id, c);
    landed++;
  }
  return landed;
}

/** The Druid mends every own unit within HEAL_RANGE by HEAL_HP every HEAL_MS. */
function heal(s: GameState, u: Unit, dt: number) {
  u.pulse += dt;
  if (u.pulse < HEAL_MS) return;
  u.pulse -= HEAL_MS;
  for (const o of s.units.values()) {
    if (o.owner !== u.owner || o.hp <= 0 || Math.hypot(o.x - u.x, o.y - u.y) > HEAL_RANGE) continue;
    const max = maxHp(o);
    if (o.hp < max) o.hp = Math.min(max, o.hp + HEAL_HP);
  }
}

/**
 * A trade cart: drives to the nearest trading post, loads TRADE_ORE there, brings it to the nearest
 * drop-off that takes ore, and sets off again.
 */
function cartUpdate(s: GameState, u: Unit, def: UnitDef, dt: number) {
  const o = u.order;
  if (o.t === 'idle') {
    if (u.amount > 0) u.order = { t: 'return' };
    return;
  }
  if (o.t === 'move') {
    if (u.path.length === 0 && Math.hypot(u.x - o.x, u.y - o.y) < 0.9) return void (u.order = { t: 'idle' });
    if (!pursue(s, u, speedOf(s, u, def), dt, goalNear(s, o.x, o.y))) u.order = { t: 'idle' };
    return;
  }
  if (o.t === 'trade') {
    if (u.amount > 0) return void (u.order = { t: 'return' });
    let best: { p: PostSpot; d: number } | null = null;
    for (const p of s.posts) {
      const d = gap(u.x, u.y, { x0: p.tx, y0: p.ty, x1: p.tx + 2, y1: p.ty + 2 });
      if (!best || d < best.d) best = { p, d };
    }
    if (!best) return void (u.order = { t: 'idle' });
    const f = { x0: best.p.tx, y0: best.p.ty, x1: best.p.tx + 2, y1: best.p.ty + 2 };
    if (gap(u.x, u.y, f) <= 0.6) {
      u.path = [];
      u.carry = 'ore';
      u.amount = TRADE_ORE;
      u.order = { t: 'return' };
      return;
    }
    if (!pursue(s, u, speedOf(s, u, def), dt, (tx, ty) => !s.solid[idx(tx, ty)] && gap(tx + 0.5, ty + 0.5, f) <= 0.5)) u.order = { t: 'idle' };
    return;
  }
  if (o.t === 'return') {
    const drop = nearestDropoff(s, u.owner, 'ore', u.x, u.y);
    if (!drop) return void (u.order = { t: 'idle' });
    const f = footprintOf(s, drop.id);
    if (!f) return;
    if (gap(u.x, u.y, f) <= 0.6) {
      u.path = [];
      s.players[u.owner].res.ore += u.amount;
      if (u.amount > 0) emit(s, { t: 'drop', x: u.x, y: u.y, res: 'ore', n: u.amount, owner: u.owner });
      // The scenario's supply cart is home with its ore.
      if (u.amount > 0 && s.mission?.cart === u.id) s.mission.trips++;
      u.amount = 0;
      u.carry = null;
      u.order = { t: 'trade' };
      return;
    }
    if (!pursue(s, u, speedOf(s, u, def), dt, (tx, ty) => !s.solid[idx(tx, ty)] && gap(tx + 0.5, ty + 0.5, f) <= 0.5)) u.order = { t: 'idle' };
  }
}

function militaryUpdate(s: GameState, u: Unit, def: UnitDef, dt: number) {
  if (u.post) return guardUpdate(s, u, def, dt);
  const o = u.order;
  // A ram only ever goes for buildings, palisades and gates included.
  const pick = def.role === 'siege' ? 'structures' : 'auto';
  // A soldier on land only goes for a ship close enough to the shore to hit.
  const reach = def.range;
  if (o.t === 'idle') {
    const t = nearestEnemy(s, u.owner, u.x, u.y, def.sight, pick, reach);
    if (t) u.order = { t: 'attack', target: t.id, resume: null };
    return;
  }
  if (o.t === 'move') {
    if (u.path.length === 0 && Math.hypot(u.x - o.x, u.y - o.y) < 0.9) return void (u.order = { t: 'idle' });
    const goal = goalNear(s, o.x, o.y);
    if (!pursue(s, u, speedOf(s, u, def), dt, goal)) u.order = { t: 'idle' };
    return;
  }
  if (o.t === 'attackMove') {
    const t = nearestEnemy(s, u.owner, u.x, u.y, def.sight, pick, reach);
    if (t) {
      u.order = { t: 'attack', target: t.id, resume: { x: o.x, y: o.y } };
      return;
    }
    if (u.path.length === 0 && Math.hypot(u.x - o.x, u.y - o.y) < 0.9) return void (u.order = { t: 'idle' });
    // Walled off: break through the nearest enemy palisade or gate instead.
    if (!pursue(s, u, speedOf(s, u, def), dt, goalNear(s, o.x, o.y)) && !breach(s, u, { x: o.x, y: o.y })) u.order = { t: 'idle' };
    return;
  }
  if (o.t === 'attack') {
    const target = getEntity(s, o.target);
    // A truce or alliance called off the fight.
    if (!target || target.hp <= 0 || !hostile(s, u.owner, target.owner)) {
      u.order = o.resume ? { t: 'attackMove', ...o.resume } : { t: 'idle' };
      return;
    }
    const f = footprintOf(s, o.target);
    if (!f) return;
    if (gap(u.x, u.y, f) <= def.range + 0.5) {
      u.path = [];
      u.act = 'fight';
      faceTo(u, centre(f).x);
      if (u.cool <= 0) {
        strike(s, u, def, target);
        u.cool = def.cooldown;
      }
      return;
    }
    const range = def.range;
    if (!pursue(s, u, speedOf(s, u, def), dt, (tx, ty) => !s.solid[idx(tx, ty)] && gap(tx + 0.5, ty + 0.5, f) <= range)) {
      // A ship out of reach is let go; a wall in the way is broken through.
      const isWall = 'queue' in target && BUILDINGS[target.type].palisade;
      const atSea = 'order' in target && isShip(target);
      if (isWall || atSea || !breach(s, u, o.resume ?? centre(f))) u.order = o.resume ? { t: 'attackMove', ...o.resume } : { t: 'idle' };
    }
    return;
  }
}

/** A soldier that can't reach where it is going attacks the nearest enemy palisade or gate, then goes on. */
function breach(s: GameState, u: Unit, resume: { x: number; y: number }): boolean {
  const wall = nearestEnemy(s, u.owner, u.x, u.y, 30, 'palisade');
  if (wall) u.order = { t: 'attack', target: wall.id, resume };
  return !!wall;
}

/**
 * A camp guard: fights anything that comes within its sight of its post, chases it no further than
 * LEASH tiles from the post, then walks back.
 */
function guardUpdate(s: GameState, u: Unit, def: UnitDef, dt: number) {
  const post = u.post!;
  const o = u.order;
  const away = Math.hypot(u.x - post.x, u.y - post.y);
  if (o.t === 'attack') {
    const target = getEntity(s, o.target);
    if (!target || target.hp <= 0 || away > LEASH) return void (u.order = { t: 'move', x: post.x, y: post.y });
    const f = footprint(target);
    if (gap(u.x, u.y, f) <= def.range + 0.5) {
      u.path = [];
      u.act = 'fight';
      faceTo(u, centre(f).x);
      if (u.cool <= 0) {
        strike(s, u, def, target);
        u.cool = def.cooldown;
      }
      return;
    }
    const range = def.range;
    if (!pursue(s, u, def.speed, dt, (tx, ty) => !s.solid[idx(tx, ty)] && gap(tx + 0.5, ty + 0.5, f) <= range)) u.order = { t: 'move', x: post.x, y: post.y };
    return;
  }
  const t = nearestEnemy(s, u.owner, post.x, post.y, def.sight, 'units', def.range);
  if (t && away <= LEASH) return void (u.order = { t: 'attack', target: t.id, resume: null });
  if (o.t === 'move') {
    if (u.path.length === 0 && Math.hypot(u.x - o.x, u.y - o.y) < 0.9) return void (u.order = { t: 'idle' });
    if (!pursue(s, u, def.speed, dt, goalNear(s, o.x, o.y))) u.order = { t: 'idle' };
    return;
  }
  if (away > 1.5) u.order = { t: 'move', x: post.x, y: post.y };
}

/**
 * A builder whose site is finished (by its own work or a fellow builder's) goes on to work the new
 * farm, or the next unfinished building close by (the rest of a palisade line), or else the nearest wood.
 */
function afterBuild(s: GameState, u: Unit, b: Building) {
  const unbuilt = BUILDINGS[b.type].farm ? null : nearestUnbuilt(s, u.owner, u.x, u.y, 6);
  if (unbuilt) {
    u.order = { t: 'build', b: unbuilt.id };
    return;
  }
  const next = BUILDINGS[b.type].farm ? { id: b.id } : nearestSource(s, u.owner, 'wood', u.x, u.y);
  u.order = next ? { t: 'gather', node: next.id } : { t: 'idle' };
  u.home = next ? next.id : null;
}

function villagerUpdate(s: GameState, u: Unit, def: UnitDef, dt: number) {
  const o = u.order;
  if (o.t === 'idle') {
    if (u.amount > 0) u.order = { t: 'return' };
    return;
  }
  if (o.t === 'move') {
    if (u.path.length === 0 && Math.hypot(u.x - o.x, u.y - o.y) < 0.9) return void (u.order = { t: 'idle' });
    if (!pursue(s, u, speedOf(s, u, def), dt, goalNear(s, o.x, o.y))) u.order = { t: 'idle' };
    return;
  }
  if (o.t === 'garrison') {
    const b = s.buildings.get(o.b);
    const def2 = b ? BUILDINGS[b.type] : null;
    if (!b || !def2?.shelter || b.hp <= 0 || !s.players[u.owner].bell) return void backToWork(s, u);
    const f = footprintOf(s, b.id);
    if (!f) return;
    if (gap(u.x, u.y, f) <= 0.6) {
      if (b.garrison.length >= def2.shelter) return void backToWork(s, u);
      // Inside: off the map until the bell is released or the building falls.
      u.path = [];
      u.order = { t: 'idle' };
      s.units.delete(u.id);
      b.garrison.push(u);
      return;
    }
    if (!pursue(s, u, speedOf(s, u, def), dt, (tx, ty) => !s.solid[idx(tx, ty)] && gap(tx + 0.5, ty + 0.5, f) <= 0.5)) backToWork(s, u);
    return;
  }
  if (o.t === 'build') {
    const b = s.buildings.get(o.b);
    if (b?.built && b.hp > 0) return void afterBuild(s, u, b);
    if (!b || b.hp <= 0) return void (u.order = { t: 'idle' });
    const f = footprintOf(s, b.id);
    if (!f) return;
    if (gap(u.x, u.y, f) <= 0.6) {
      u.path = [];
      u.act = 'build';
      faceTo(u, centre(f).x);
      // A Wonder takes at most WONDER_CREW builders a tick; the rest stand by at the site.
      if (b.type === 'wonder') {
        if (b.crewAt !== s.time) {
          b.crewAt = s.time;
          b.crew = 0;
        }
        if (++b.crew > WONDER_CREW) return;
      }
      b.buildLeft -= dt;
      b.hp = Math.min(buildingHp(s, b), b.hp + (buildingHp(s, b) * dt) / BUILDINGS[b.type].time);
      if (b.buildLeft <= 0) {
        finish(s, b);
        afterBuild(s, u, b);
      }
      return;
    }
    if (!pursue(s, u, speedOf(s, u, def), dt, (tx, ty) => !s.solid[idx(tx, ty)] && gap(tx + 0.5, ty + 0.5, f) <= 0.5)) {
      u.order = { t: 'idle' };
    }
    return;
  }
  if (o.t === 'gather') {
    const node = s.nodes.get(o.node);
    const farm = s.buildings.get(o.node);
    const src = node ?? (farm && BUILDINGS[farm.type].farm && farm.built ? farm : null);
    if (!src || (node && node.amount <= 0)) {
      // Depleted: go to the nearest node of the same resource, or stop.
      const next = nearestSource(s, u.owner, u.lastRes ?? 'wood', u.x, u.y);
      if (next && u.amount === 0) {
        u.home = next.id;
        u.order = { t: 'gather', node: next.id };
      } else u.order = u.amount > 0 ? { t: 'return' } : { t: 'idle' };
      return;
    }
    if (u.amount >= CARRY) return void (u.order = { t: 'return' });
    const f = footprintOf(s, src.id);
    if (!f) return;
    if (gap(u.x, u.y, f) <= 0.6) {
      u.path = [];
      const res: Resource = node ? node.res : 'food';
      if (u.carry && u.carry !== res) return void (u.order = { t: 'return' });
      u.carry = res;
      u.lastRes = res;
      u.act = 'gather';
      faceTo(u, centre(f).x);
      // Harvest Rites, the Age II boon, speeds up work on farms.
      const rites = !node && s.players[u.owner].boon === 'harvest' ? HARVEST_RITES : 1;
      const relic = holds(s, u.owner, 'plenty') ? RELIC_GATHER : 1;
      u.gatherMs += dt * gatherBonus(s, u.owner, res) * s.players[u.owner].gatherMul * rites * relic;
      if (u.gatherMs >= GATHER_MS[res]) {
        u.gatherMs -= GATHER_MS[res];
        u.amount++;
        if (node) {
          node.amount--;
          if (node.amount <= 0) {
            s.nodes.delete(node.id);
            rebuildSolid(s);
          }
        }
      }
      return;
    }
    if (!pursue(s, u, speedOf(s, u, def), dt, (tx, ty) => !s.solid[idx(tx, ty)] && gap(tx + 0.5, ty + 0.5, f) <= 0.5)) {
      // Boxed in by other trees or buildings: try the nearest source that can be reached instead.
      const other = nearestSource(s, u.owner, node ? node.res : 'food', u.x, u.y, src.id);
      u.order = other ? { t: 'gather', node: other.id } : { t: 'idle' };
      u.home = other ? other.id : null;
    }
    return;
  }
  if (o.t === 'return') {
    const drop = nearestDropoff(s, u.owner, u.carry, u.x, u.y);
    if (!drop) {
      u.order = { t: 'idle' };
      return;
    }
    const f = footprintOf(s, drop.id);
    if (!f) return;
    if (gap(u.x, u.y, f) <= 0.6) {
      u.path = [];
      const p = s.players[u.owner];
      if (u.carry) p.res[u.carry] += u.amount;
      if (u.carry && u.amount > 0) emit(s, { t: 'drop', x: u.x, y: u.y, res: u.carry, n: u.amount, owner: u.owner });
      u.amount = 0;
      u.carry = null;
      u.gatherMs = 0;
      // Back to the same node if it still has wood or food, else the nearest of the same kind.
      const res = u.lastRes ?? 'wood';
      const home = u.home !== null ? s.nodes.get(u.home) ?? s.buildings.get(u.home) : undefined;
      const again = home && ('amount' in home ? home.amount > 0 : true) ? home : nearestSource(s, u.owner, res, u.x, u.y);
      u.order = again ? { t: 'gather', node: again.id } : { t: 'idle' };
      u.home = again ? again.id : null;
      return;
    }
    if (!pursue(s, u, speedOf(s, u, def), dt, (tx, ty) => !s.solid[idx(tx, ty)] && gap(tx + 0.5, ty + 0.5, f) <= 0.5)) {
      u.order = { t: 'idle' };
    }
  }
}

/** A building is done: full health, and a gate opens to its owner; a finished Monument starts its count. */
function finish(s: GameState, b: Building) {
  b.built = true;
  b.hp = buildingHp(s, b);
  b.doneAt = s.time;
  if (b.type === 'gate') rebuildSolid(s);
  if (b.type === 'monument') say(s, b.owner === PLAYER ? t('monumentStandsOwn') : t('monumentStandsFoe'));
  // A finished Wonder wins the match at once.
  if (b.type === 'wonder' && s.winner === null) {
    s.winner = b.owner;
    s.winBy = 'wonder';
  }
}

function nearestUnbuilt(s: GameState, owner: number, x: number, y: number, range: number): Building | null {
  let best: { b: Building; d: number } | null = null;
  for (const b of s.buildings.values()) {
    if (b.owner !== owner || b.built || b.hp <= 0) continue;
    const def = BUILDINGS[b.type];
    const d = gap(x, y, { x0: b.tx, y0: b.ty, x1: b.tx + def.w, y1: b.ty + def.h });
    if (d <= range && (!best || d < best.d)) best = { b, d };
  }
  return best?.b ?? null;
}

/** Move speed: cavalry go faster under Stirrups, everyone with the Relic of Haste and near the Chieftain. */
function speedOf(s: GameState, u: Unit, def: UnitDef) {
  const stirrups = def.role === 'cavalry' && s.players[u.owner].techs.includes('stirrups');
  const haste = holds(s, u.owner, 'haste') ? RELIC_SPEED : 1;
  const stride = inStride(s, u) ? STRIDE_SPEED : 1;
  return (stirrups ? def.speed * STIRRUPS_SPEED : def.speed) * haste * stride;
}

/** Whether an own champion with the stride gift (the Steppe Horde's Chieftain) stands within STRIDE_RANGE of a unit, itself included. */
export function inStride(s: GameState, u: Unit) {
  if (s.players[u.owner].faction !== 'steppe') return false;
  for (const o of s.units.values()) if (o.owner === u.owner && o.hp > 0 && UNITS[o.type].gift === 'stride' && Math.hypot(o.x - u.x, o.y - u.y) <= STRIDE_RANGE) return true;
  return false;
}

/** Gather speed from researched techs. */
function gatherBonus(s: GameState, owner: number, res: Resource) {
  const techs = s.players[owner].techs;
  const tech = res === 'wood' ? 'axes' : res === 'food' ? 'baskets' : 'picks';
  return techs.includes(tech) ? 1.25 : 1;
}

function goalNear(s: GameState, x: number, y: number) {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const blocked = s.solid[idx(tx, ty)] === 1 && inMap(tx, ty);
  // A point inside a building is reached from the nearest free tile around it, a few tiles off.
  return (gx: number, gy: number) => !s.solid[idx(gx, gy)] && Math.hypot(gx + 0.5 - x, gy + 0.5 - y) <= (blocked ? 4.5 : 0.6);
}

/** Whether some free tile touches a footprint, so a villager can stand next to it. */
export function touchable(s: GameState, f: { x0: number; y0: number; x1: number; y1: number }) {
  for (let x = f.x0; x < f.x1; x++) {
    if (!s.solid[idx(x, f.y0 - 1)] && inMap(x, f.y0 - 1)) return true;
    if (!s.solid[idx(x, f.y1)] && inMap(x, f.y1)) return true;
  }
  for (let y = f.y0; y < f.y1; y++) {
    if (!s.solid[idx(f.x0 - 1, y)] && inMap(f.x0 - 1, y)) return true;
    if (!s.solid[idx(f.x1, y)] && inMap(f.x1, y)) return true;
  }
  return false;
}

/** The nearest node of a resource a villager can reach, or a finished farm for food. */
function nearestSource(s: GameState, owner: number, res: Resource, x: number, y: number, skip = -1): { id: number } | null {
  let best: { id: number; d: number } | null = null;
  for (const n of s.nodes.values()) {
    if (n.res !== res || n.amount <= 0 || n.id === skip) continue;
    const f = { x0: n.tx, y0: n.ty, x1: n.tx + n.w, y1: n.ty + n.h };
    if (!touchable(s, f)) continue;
    const d = gap(x, y, f);
    if (!best || d < best.d) best = { id: n.id, d };
  }
  if (res === 'food') {
    for (const b of s.buildings.values()) {
      if (b.owner !== owner || !b.built || !BUILDINGS[b.type].farm || b.id === skip) continue;
      const f = { x0: b.tx, y0: b.ty, x1: b.tx + 2, y1: b.ty + 2 };
      const d = gap(x, y, f);
      if (!best || d < best.d) best = { id: b.id, d };
    }
  }
  return best;
}

function nearestDropoff(s: GameState, owner: number, res: Resource | null, x: number, y: number): Building | null {
  let best: { b: Building; d: number } | null = null;
  for (const b of s.buildings.values()) {
    if (b.owner !== owner || !b.built) continue;
    const def = BUILDINGS[b.type];
    const drops = def.drops;
    if (!drops) continue;
    if (drops !== 'all' && (!res || !drops.includes(res))) continue;
    const d = gap(x, y, { x0: b.tx, y0: b.ty, x1: b.tx + def.w, y1: b.ty + def.h });
    if (!best || d < best.d) best = { b, d };
  }
  return best?.b ?? null;
}

/**
 * The closest living enemy within `range` tiles of a point. `auto` (what soldiers and towers pick on
 * their own) skips palisades and gates, `palisade` looks only at those, `units` only at units, and
 * `structures` (what a ram goes for) at every building, palisades and gates included.
 */
function nearestEnemy(s: GameState, owner: number, x: number, y: number, range: number, pick: 'auto' | 'palisade' | 'units' | 'structures' = 'auto', shipReach = Infinity): Unit | Building | null {
  const foes: (Unit | Building)[] = pick === 'palisade' || pick === 'structures' ? [...s.buildings.values()] : pick === 'units' ? [...s.units.values()] : [...s.units.values(), ...s.buildings.values()];
  let best: Unit | Building | null = null;
  let bestD = Infinity;
  for (const e of foes) {
    if (e.hp <= 0 || !hostile(s, owner, e.owner)) continue;
    if (pick !== 'structures' && 'queue' in e && !!BUILDINGS[e.type].palisade !== (pick === 'palisade')) continue;
    const d = gap(x, y, footprint(e));
    if (d > range || d >= bestD) continue;
    // `shipReach`: a soldier on land leaves alone a ship it can't hit from any land tile.
    if (shipReach !== Infinity && 'order' in e && isShip(e) && !shoreWithin(s, e, shipReach)) continue;
    best = e;
    bestD = d;
  }
  return best;
}

/** Whether some land tile lies within `reach` tiles of a ship: the tiles a soldier chasing it walks to. */
function shoreWithin(s: GameState, ship: Unit, reach: number): boolean {
  const f = footprint(ship);
  for (let ty = Math.floor(ship.y - reach - 1); ty <= Math.ceil(ship.y + reach + 1); ty++) {
    for (let tx = Math.floor(ship.x - reach - 1); tx <= Math.ceil(ship.x + reach + 1); tx++) {
      if (inMap(tx, ty) && !s.solid[idx(tx, ty)] && gap(tx + 0.5, ty + 0.5, f) <= reach) return true;
    }
  }
  return false;
}

function strike(s: GameState, u: Unit, def: UnitDef, target: Unit | Building) {
  // A ram's beam does nothing to a unit.
  if (def.role === 'siege' && 'order' in target) return;
  let dmg = def.dmg + ownBonus(s, u, def);
  if (def.vsCavalry && 'order' in target && UNITS[target.type].role === 'cavalry') dmg *= def.vsCavalry;
  if (def.vsBuildings && !('order' in target)) dmg *= def.vsBuildings;
  dmg = takenBy(s, target, dmg);
  const alive = target.hp > 0;
  target.hp -= dmg;
  u.struck = s.time;
  // A kill counts towards the veteran ranks: each adds health and damage.
  if (alive && target.hp <= 0 && 'order' in target && earnsRanks(def.role)) {
    u.kills++;
    const rank = RANK_KILLS.filter((k) => u.kills >= k).length;
    if (rank > u.rank) {
      u.hp += (rank - u.rank) * RANK_HP;
      u.rank = rank;
    }
  }
  const at = centre(footprint(target));
  emit(s, { t: 'hit', x: at.x, y: at.y, fromX: u.x, fromY: u.y, dmg, ranged: def.range > 1, owner: u.owner, victim: target.owner, target: target.id });
}

/** The damage a target really takes: Shieldwall, the Age II boon, shields melee infantry. */
function takenBy(s: GameState, target: Unit | Building, dmg: number) {
  if ('order' in target && UNITS[target.type].role === 'melee' && s.players[target.owner].boon === 'shieldwall') return dmg * SHIELDWALL_TAKEN;
  return dmg;
}

function ownBonus(s: GameState, u: Unit, def: UnitDef) {
  const techs = s.players[u.owner].techs;
  let bonus = 0;
  if (def.role === 'melee' && techs.includes('ironworks')) bonus += 2;
  if (def.role === 'ranged' && techs.includes('fletching')) bonus += 2;
  if (def.role === 'ranged' && techs.includes('bodkin')) bonus += 2;
  if (isSoldier(def.role) && s.players[u.owner].age >= 3) bonus += AGE3_DAMAGE;
  if (isSoldier(def.role) && s.players[u.owner].age >= 4) bonus += AGE4_DAMAGE;
  if (isSoldier(def.role) && holds(s, u.owner, 'valor')) bonus += RELIC_DAMAGE;
  bonus += u.rank * RANK_DMG;
  // The Warlord's aura: own soldiers close to it hit harder (not the Warlord itself).
  if (isSoldier(def.role) && def.gift !== 'aura' && inAura(s, u)) bonus += AURA_DMG;
  return bonus;
}

/** Whether an own champion with the damage aura stands within AURA_RANGE of a unit. */
export function inAura(s: GameState, u: Unit) {
  for (const o of s.units.values()) if (o.owner === u.owner && o.hp > 0 && UNITS[o.type].gift === 'aura' && Math.hypot(o.x - u.x, o.y - u.y) <= AURA_RANGE) return true;
  return false;
}

function reap(s: GameState) {
  let changed = false;
  for (const u of [...s.units.values()]) {
    if (u.hp > 0) continue;
    s.units.delete(u.id);
    // A sunk transport takes its passengers down with it.
    s.players[u.owner].lost += 1 + u.cargo.length;
    u.cargo = [];
    changed = true;
  }
  for (const b of [...s.buildings.values()]) {
    if (b.hp > 0) continue;
    if (!BUILDINGS[b.type].palisade) s.players[b.owner].razed++;
    // A fallen shelter spills its garrison out; whoever finds no room is lost with it.
    if (b.garrison.length > 0) ungarrison(s, b);
    s.buildings.delete(b.id);
    changed = true;
  }
  if (changed) rebuildSolid(s);
}

function checkWinner(s: GameState) {
  // A side whose Town Center has fallen is out.
  const fallen = s.players.filter((p) => p.id !== NEUTRAL && !p.out && !hasBuildingFor(s, p.id, 'town'));
  for (const p of fallen) p.out = true;
  // The match ends with one side left, or once the player's side is out (unless it plays on to the last).
  const left = s.players.filter((p) => p.id !== NEUTRAL && !p.out);
  if (left.length <= 1 || (s.players[PLAYER].out && !s.toLast)) {
    s.winner = left.find((p) => p.id !== PLAYER)?.id ?? left[0]?.id ?? AI;
    s.winBy = 'town';
    return;
  }
  // In a three-way match the others play on, and everything of a fallen side falls with it.
  for (const p of fallen) {
    for (const u of s.units.values()) if (u.owner === p.id) u.hp = 0;
    // Its sheltering villagers fall with their shelters rather than walking out of them.
    for (const b of s.buildings.values()) {
      if (b.owner !== p.id) continue;
      b.garrison = [];
      b.hp = 0;
    }
    // A raid it was leading ends here, with no credit to its target for raiders it never fought.
    if (s.raid?.by === p.id) s.raid = null;
    for (const c of s.camps) if (c.relic && c.holder === p.id) c.holder = null;
    say(s, p.id === PLAYER ? t('townFallen') : t('sideFallen', { faction: t(FACTIONS[p.faction].name) }));
  }
  if (fallen.length > 0) reap(s);
  if (s.mission && missionOver(s, s.mission)) return;
  // A Monument that has stood MONUMENT_MS since it was finished wins the match for its owner.
  for (const b of s.buildings.values()) {
    if (b.type === 'monument' && b.built && b.hp > 0 && s.time - b.doneAt >= MONUMENT_MS) {
      s.winner = b.owner;
      s.winBy = 'monument';
      return;
    }
  }
}

/** Ends the match when a scenario's goal is reached, or its supply cart has fallen. */
function missionOver(s: GameState, m: Mission) {
  const end = (winner: number, by: 'goal' | 'cart') => {
    s.winner = winner;
    s.winBy = by;
    return true;
  };
  const g = m.goal;
  if (g.t === 'survive' && s.time >= g.ms) return end(PLAYER, 'goal');
  if (g.t === 'escort') {
    if (m.trips >= g.trips) return end(PLAYER, 'goal');
    // A cart aboard a transport is still there; one that sinks with it is not (`reap` drops the cargo).
    const cart = m.cart;
    const aboard = cart !== null && [...s.units.values()].some((u) => u.cargo.some((c) => c.id === cart));
    if (cart !== null && !s.units.has(cart) && !aboard) return end(rivalsOf(s, PLAYER)[0] ?? AI, 'cart');
  }
  if (g.t === 'hold') {
    if (!holds(s, PLAYER, g.relic)) m.heldSince = null;
    else if (m.heldSince === null) m.heldSince = s.time;
    else if (s.time - m.heldSince >= g.ms) return end(PLAYER, 'goal');
  }
  return false;
}

/** Time left, in ms, before a side's standing Monument wins, or null if it has none finished. */
export function monumentLeft(s: GameState, owner: number): number | null {
  for (const b of s.buildings.values()) if (b.type === 'monument' && b.owner === owner && b.built && b.hp > 0) return Math.max(0, MONUMENT_MS - (s.time - b.doneAt));
  return null;
}

/**
 * Pushes units apart where they stand closer than UNIT_GAP, a little each tick, so a group spreads
 * out instead of stacking on one spot. Villagers at work hold their place and only push others.
 */
function separate(s: GameState, dt: number) {
  const grid = new Map<number, Unit[]>();
  for (const u of s.units.values()) {
    const k = idx(Math.floor(u.x), Math.floor(u.y));
    const cell = grid.get(k);
    if (cell) cell.push(u);
    else grid.set(k, [u]);
  }
  const maxStep = (1.5 * dt) / 1000;
  const anchored = (u: Unit) => u.act === 'gather' || u.act === 'build';
  for (const u of s.units.values()) {
    if (anchored(u) || u.hp <= 0) continue;
    // Ships push apart on the water, everyone else on land.
    const ship = isShip(u);
    const free = (x: number, y: number) => (ship ? seaAt(s, x, y) : !blocked(s, x, y, u.owner));
    let px = 0;
    let py = 0;
    const cx = Math.floor(u.x);
    const cy = Math.floor(u.y);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const cell = grid.get(idx(cx + dx, cy + dy));
        if (!cell || !inMap(cx + dx, cy + dy)) continue;
        for (const o of cell) {
          if (o === u || isShip(o) !== ship) continue;
          const ox = u.x - o.x;
          const oy = u.y - o.y;
          const d = Math.hypot(ox, oy);
          if (d >= UNIT_GAP) continue;
          // Two units on the very same point split along a direction fixed by their ids.
          const a = d < 1e-4 ? ((u.id * 2.39996) % (Math.PI * 2)) : Math.atan2(oy, ox);
          const share = anchored(o) ? 1 : 0.5;
          px += Math.cos(a) * (UNIT_GAP - d) * share;
          py += Math.sin(a) * (UNIT_GAP - d) * share;
        }
      }
    const len = Math.hypot(px, py);
    if (len < 1e-4) continue;
    const k = Math.min(1, maxStep / len);
    const nx = u.x + px * k;
    const ny = u.y + py * k;
    if (free(Math.floor(nx), Math.floor(u.y))) u.x = nx;
    if (free(Math.floor(u.x), Math.floor(ny))) u.y = ny;
  }
}

/**
 * Neutral camps: once a camp's guards are all dead, a side that has units at it, with none of the
 * other side's, takes the cache (once) or holds the relic (until the other side takes it the same way).
 */
function updateCamps(s: GameState) {
  for (const c of s.camps) {
    if (c.claimed || c.guards.some((id) => s.units.has(id))) continue;
    const cx = c.tx + 1;
    const cy = c.ty + 1;
    const present = new Set<number>();
    for (const u of s.units.values()) if (u.owner !== NEUTRAL && u.hp > 0 && !isShip(u) && Math.hypot(u.x - cx, u.y - cy) <= CLAIM_RANGE) present.add(u.owner);
    if (present.size !== 1) continue;
    const who = [...present][0];
    if (c.kind === 'cache' && c.res) {
      s.players[who].res[c.res] += c.amount;
      c.holder = who;
      c.claimed = true;
      rebuildSolid(s);
      emit(s, { t: 'drop', x: cx, y: cy - 0.5, res: c.res, n: c.amount, owner: who });
      if (who === PLAYER) say(s, t('cacheGives', { n: c.amount, res: t(c.res) }));
      continue;
    }
    if (c.holder === who || !c.relic) continue;
    const had = c.holder;
    c.holder = who;
    const relic = t(RELICS[c.relic].name);
    if (who === PLAYER) say(s, t('relicHeld', { relic, effect: t(RELICS[c.relic].text) }));
    else if (had === PLAYER) say(s, t('relicTaken', { relic }));
  }
}

/** The free tiles next to a camp, where units stand to claim it. */
export function campSpots(s: GameState, c: Camp) {
  return ringAround(s, c.tx, c.ty, 2, 2);
}

/** The camp whose footprint covers a point, if any is still on the map; with `fog`, only one the player has explored. */
export function campAt(s: GameState, x: number, y: number, fog = false): Camp | null {
  for (const c of s.camps) if (!c.claimed && x >= c.tx && y >= c.ty && x < c.tx + 2 && y < c.ty + 2 && (!fog || explored(s, c.tx, c.ty))) return c;
  return null;
}


// ---------------------------------------------------------------- diplomacy

/** What the player can offer an AI in a three-way match. */
export type Offer = 'truce' | 'tribute' | 'ally';

/**
 * The player offers an AI a truce, sends it a tribute, or asks it to join against the other AI. The
 * AI's temperament (`Temperament.diplomacy`) decides from its goodwill (`Pact.mood`), which a tribute
 * raises; a refusal makes it deaf to asks for ASK_MS. Says the answer, and returns whether it was taken.
 */
export function offer(s: GameState, ai: number, what: Offer): boolean {
  const p = s.players[ai];
  const pact = s.pacts[ai];
  if (!threeWay(s) || ai === PLAYER || ai === NEUTRAL || !p || p.out || !pact) return false;
  const d = TEMPERAMENTS[p.temperament ?? 'builder'].diplomacy;
  const faction = t(FACTIONS[p.faction].name);
  if (what === 'tribute') {
    const me = s.players[PLAYER];
    if (!affordable(me, TRIBUTE)) {
      say(s, t('notEnoughResources'));
      return false;
    }
    pay(me, TRIBUTE);
    for (const r of Object.keys(TRIBUTE) as Resource[]) p.res[r] += TRIBUTE[r] ?? 0;
    pact.mood += d.tribute;
    say(s, t('tributeSent', { faction }));
    return true;
  }
  const other = rivalsOf(s, PLAYER).find((r) => r !== ai);
  if (what === 'ally' && (other === undefined || pact.allyUntil > s.time)) {
    say(s, t(other === undefined ? 'allyNoFoe' : 'pactAlready', { faction }));
    return false;
  }
  if (what === 'truce' && atPeace(s, PLAYER, ai)) {
    say(s, t('pactAlready', { faction }));
    return false;
  }
  if (s.time < pact.askAt) {
    say(s, t('pactWait', { faction, s: Math.ceil((pact.askAt - s.time) / 1000) }));
    return false;
  }
  const need = what === 'truce' ? d.truce : d.ally;
  if (pact.mood < need) {
    pact.askAt = s.time + ASK_MS;
    say(s, t(what === 'truce' ? 'truceRefused' : 'allyRefused', { faction }));
    return false;
  }
  const ms = what === 'truce' ? d.truceMs : d.allyMs;
  const min = Math.round(ms / 60000);
  if (what === 'truce') pact.truceUntil = s.time + ms;
  else {
    pact.allyUntil = s.time + ms;
    pact.truceUntil = Math.max(pact.truceUntil, pact.allyUntil);
    // An ally goes for the common foe soon, once its army is ready.
    s.aiRaid[ai].next = Math.min(s.aiRaid[ai].next, s.time + 20000);
  }
  // Its raid on the player is called off.
  if (s.raid?.by === ai && s.raid.target === PLAYER) endRaid(s, ai, false);
  say(s, t(what === 'truce' ? 'truceTaken' : 'allyTaken', { faction, n: min }));
  return true;
}

/** The player broke a pact with an attack: it ends at once, and the AI's goodwill falls. */
function breakPact(s: GameState, ai: number) {
  const pact = s.pacts[ai];
  if (!pact) return;
  pact.truceUntil = 0;
  pact.allyUntil = 0;
  pact.mood -= BREAK_MOOD;
  say(s, t('pactBroken', { faction: t(FACTIONS[s.players[ai].faction].name) }));
}

/** Ends truces and alliances whose time is up, and an alliance whose common foe has fallen. */
function updatePacts(s: GameState) {
  if (!threeWay(s)) return;
  for (const ai of [AI, AI2]) {
    const pact = s.pacts[ai];
    const p = s.players[ai];
    if (!pact || p.out) continue;
    const faction = t(FACTIONS[p.faction].name);
    // An alliance ends when its time is up or the common foe has fallen; the truce under it with it.
    if (pact.allyUntil > 0 && (pact.allyUntil <= s.time || rivalsOf(s, PLAYER).length < 2)) {
      if (pact.truceUntil <= pact.allyUntil) pact.truceUntil = 0;
      pact.allyUntil = 0;
      say(s, t('allyOver', { faction }));
    }
    if (pact.truceUntil > 0 && pact.truceUntil <= s.time) {
      pact.truceUntil = 0;
      say(s, t('truceOver', { faction }));
    }
  }
}

// ---------------------------------------------------------------- the Steppe Horde's camps

/** Whether a building can pack onto a wagon: a finished, idle Yurt, Lumber or Mining Camp of the Steppe Horde. */
export function canPack(s: GameState, b: Building) {
  return b.built && b.hp > 0 && PACKS.includes(b.type) && s.players[b.owner].faction === 'steppe' && b.queue.length === 0 && b.garrison.length === 0;
}

/** Packs a camp onto a wagon standing where it stood. Returns the wagon's id, or null. */
export function packUp(s: GameState, owner: number, bid: number): number | null {
  const b = s.buildings.get(bid);
  if (!b || b.owner !== owner || !canPack(s, b)) return null;
  const def = BUILDINGS[b.type];
  const hp = b.hp / buildingHp(s, b);
  s.buildings.delete(b.id);
  rebuildSolid(s);
  const u = spawnAt(s, owner, 'wagon', b.tx + Math.floor(def.w / 2) + 0.5, b.ty + Math.floor(def.h / 2) + 0.5);
  u.packed = { type: b.type, hp };
  return u.id;
}

/** Pitches a wagon's camp again where the wagon stands, if it fits there. Returns the building's id, or null. */
export function pitch(s: GameState, owner: number, uid: number): number | null {
  const u = s.units.get(uid);
  if (!u || u.owner !== owner || !u.packed) return null;
  const type = u.packed.type;
  const def = BUILDINGS[type];
  const ox = Math.floor(u.x) - Math.floor(def.w / 2);
  const oy = Math.floor(u.y) - Math.floor(def.h / 2);
  // The wagon itself doesn't stand in the way of its own camp.
  s.units.delete(u.id);
  if (!canPlace(s, type, ox, oy, owner)) {
    s.units.set(u.id, u);
    return null;
  }
  const b = addBuilding(s, owner, type, ox, oy, true);
  b.hp = Math.max(1, u.packed.hp * buildingHp(s, b));
  rebuildSolid(s);
  return b.id;
}
