import { byDifficulty } from '../../../../shared/settings';
import { t as tr } from '../i18n';
import {
  CARGO_NAMES,
  LOCAL_GOODS,
  ROOST,
  VALLEY_KINDS,
  WORKSHOPS,
  generateValley,
  terrainCost,
  key,
  manhattan,
  neighbours,
  opposite,
  sameTile,
  terrainAt,
  inGrid,
  type Cargo,
  type Tile,
  type Village,
} from './map';
import {
  BANNER_MS,
  BASE_SPEED,
  BOONS,
  CANYON_HAZARDS,
  CHARMING_GAP,
  CHARTERS,
  COLD_HUNGER,
  FRUGAL_HUNGER,
  HAZARD_TEXT,
  KIND_TEXT,
  LOCAL_PAY,
  MOULT_OFFER,
  MOULT_ROUNDS,
  NIMBLE_TIME,
  TRAITS,
  TRAIT_SPEED,
  TRAIT_TEXT,
  kindOfLeg,
  CHARTER_ROUND,
  COURIER_COST,
  DEPOT_COST,
  DEPOT_ROUND,
  DEPOT_STEP,
  DEPOT_WAIT,
  EARLY_RISER_ROUNDS,
  GOLD_MS,
  HEAD_START_COINS,
  MEDALS,
  SILVER_MS,
  DEADLINE_BASE_MS,
  DEADLINE_PER_TILE_MS,
  EAT_MS,
  FESTIVAL_GOAL,
  FESTIVAL_ROUND,
  FOOD_PER_TILE,
  HAZARD_EVERY_MS,
  HAZARD_ROUND,
  HAZARD_WARN_MS,
  HOARD_BONUS,
  HUNGRY,
  JUNCTION_WAIT_MS,
  LOAD_MS,
  MAX_ORDERS,
  MOOD_GAP_MS,
  MOOD_GAP_PER_VILLAGE_MS,
  MOOD_MAX,
  MOOD_PAY,
  MOOD_ROUND,
  MOOD_RUSH,
  ORDER_EVERY_MS,
  PASSENGER_CHANCE,
  PASSENGER_PAY,
  PASSENGER_ROUND,
  PASSENGER_TIME,
  PAY_BASE,
  PAY_PER_TILE,
  POP_MS,
  SECOND_WYRM_ROUND,
  STARVING_SLOWDOWN,
  START_COINS,
  START_HEARTS,
  SWITCH_MS,
  UPGRADE_COSTS,
  WAGONS,
  WINGS_SPEED,
  WORKSHOP_CHANCE,
  WORKSHOP_PAY,
  DARK_SLOWDOWN,
  GROW_AT,
  LAMP_COST,
  LAMP_ROUND,
  NIGHT_ROUNDS,
  RIVAL_BUILD_MS,
  RIVAL_BUYOUT,
  RIVAL_CLAIM_MS,
  RIVAL_REST_MS,
  RIVAL_ROUND,
  TOWN_PAY,
  TOWN_ROUND,
  WAREHOUSE_COST,
  WARES_CHANCE,
  WARES_PAY,
  isPassengers,
  roundGoal,
  type Charter,
  type GameState,
  type HazardKind,
  type Job,
  type Medal,
  type Order,
  type Trait,
  type Rival,
  type Upgrade,
  type Wyrm,
} from './state';

// All the rules. Only this file changes the game state; the scene reads it and calls these.

const newWyrm = (): Wyrm => ({ at: { ...ROOST }, path: [], progress: 0, from: null, job: null, loadMs: 0, switchMs: 0, food: 1, eatMs: 0, waitMs: 0 });

/** The names of the boons a medal brings: its own and the ones of the medals below it. */
export const boonNames = (m: Medal) => MEDALS.slice(0, MEDALS.indexOf(m) + 1).map((b) => tr(BOONS[b].name));

/** Whether a medal's boons apply: `boon` (the best medal on this difficulty) is it or a better one. */
export const hasBoon = (s: GameState, m: Medal) => s.boon !== null && MEDALS.indexOf(s.boon) >= MEDALS.indexOf(m);

/** Where a game stands in a chain of valleys: which valley, the upgrade kept and the traits, and whether it is the daily valley. */
export interface Journey {
  leg: number;
  kept: { upgrade: Upgrade; level: number } | null;
  traits: Trait[];
  daily: boolean;
}

/**
 * A new game; `boon` is the best festival medal won on this difficulty, whose boons the first
 * valley starts with. `journey` carries a chain of valleys on (WR15): the next valley's kind, the
 * one upgrade kept and the moults' traits. The daily valley (WR17) is picked with `rand`, today's
 * seed, and has no boons.
 */
export function newGame(boon: Medal | null = null, journey: Partial<Journey> = {}, rand: () => number = Math.random): GameState {
  const leg = journey.leg ?? 1;
  const daily = journey.daily ?? false;
  const kind = daily ? VALLEY_KINDS[Math.floor(rand() * VALLEY_KINDS.length)] : kindOfLeg(leg);
  const valley = generateValley(rand, kind);
  if (daily || leg > 1) boon = null;
  const kept = journey.kept ?? null;
  const s: GameState = {
    phase: 'play',
    valley,
    coins: START_COINS,
    hearts: START_HEARTS,
    round: 1,
    delivered: 0,
    totalDelivered: 0,
    track: [],
    paid: {},
    orders: [],
    queue: [],
    switches: {},
    cuts: [],
    crossings: [],
    moods: valley.villages.map(() => 0),
    idleMs: valley.villages.map(() => 0),
    hazard: null,
    hazardTimerMs: HAZARD_EVERY_MS,
    charter: null,
    charterOffer: null,
    depots: [],
    leg,
    kept,
    traits: [...(journey.traits ?? [])],
    moultOffer: null,
    daily,
    growth: valley.villages.map(() => 0),
    towns: [],
    warehouses: [],
    lamps: [],
    rival: null,
    boon,
    festivalMs: 0,
    medal: null,
    wyrms: [newWyrm()],
    upgrades: { wings: 0, hoard: 0, second: 0 },
    orderTimerMs: ORDER_EVERY_MS,
    banner: null,
    pops: [],
    nextId: 1,
  };
  if (hasBoon(s, 'bronze')) s.coins += HEAD_START_COINS;
  if (hasBoon(s, 'silver')) s.upgrades.wings = 1;
  // The upgrade kept from the last valley, at its level there: a kept second wyrm flies on too.
  if (kept) s.upgrades[kept.upgrade] = Math.max(s.upgrades[kept.upgrade], kept.level);
  if (s.upgrades.second) s.wyrms.push(newWyrm());
  const [a, b] = valley.villages;
  const lines = [tr('startBanner', { a: a.name, b: b.name })];
  if (daily || leg > 1) lines.unshift(tr(daily ? 'dailyBanner' : 'valleyBanner', { n: leg, valley: tr(KIND_TEXT[kind].name) }), tr(KIND_TEXT[kind].intro));
  if (kept) lines.push(tr('keptBanner', { upgrade: tr(UPGRADE_NAMES[kept.upgrade]) }));
  if (boon) lines.push(tr('medalBoons', { boons: boonNames(boon).join(', ') }));
  s.banner = { text: lines.join('\n'), ms: BANNER_MS * (lines.length > 1 ? 2 : 1.5) };
  // The first order is always grain from Millbrook to Ashford.
  addOrder(s, 0, 1);
  return s;
}

/** Every village of this game's valley, open or not; orders index into it. */
export const villages = (s: GameState): readonly Village[] => s.valley.villages;

/** The villages on the line this round. */
export const openVillages = (s: GameState) => villages(s).filter((v) => v.round <= s.round);

/** The village the festival is held at in the last round: the last to join the line. */
export const festivalHost = (s: GameState) => villages(s).length - 1;

/** The workshop of a village, if it has one. */
export const workshopOf = (v: Village) => WORKSHOPS[v.id] ?? null;

/** Each upgrade's name, as a key of `i18n/en.ts`, for the upgrade kept on a flight to the next valley. */
export const UPGRADE_NAMES = { wings: 'wingsName', hoard: 'hoardName', second: 'secondName' } as const;

/** Whether the wyrms have a trait from a moult. */
export const hasTrait = (s: GameState, t: Trait) => s.traits.includes(t);

/** How many orders a wyrm carries at once: one a wagon, and a third wagon from a moult. */
export const wagons = (s: GameState) => WAGONS + (hasTrait(s, 'wagon') ? 1 : 0);

/** The game waits for a pick: a moult's traits or the round's charters are on offer. */
export const choosing = (s: GameState) => !!(s.charterOffer || s.moultOffer);

/** A station: the Roost or a village that has joined the line. */
function isStation(s: GameState, t: Tile) {
  return sameTile(t, ROOST) || openVillages(s).some((v) => sameTile(v, t));
}

/** A tile the wyrm can stand on: track or a station. */
export function onLine(s: GameState, t: Tile) {
  return s.track.includes(key(t)) || isStation(s, t);
}

/** What a piece of track on `t` would cost, or null if none can go there. */
export function trackCost(s: GameState, t: Tile): number | null {
  const terrain = terrainAt(s.valley, t);
  if (s.track.includes(key(t))) return null;
  // A tile under a warned hazard can't take new track until the hazard has struck.
  if (s.hazard && sameTile(s.hazard.tile, t)) return null;
  if (sameTile(t, ROOST) || villages(s).some((v) => sameTile(v, t))) return null;
  // Track grows from the line: next to track, the Roost or an open village.
  if (!neighbours(t).some((n) => onLine(s, n))) return null;
  if (s.rival && sameTile(s.rival.yard, t)) return null;
  // A rival's tile can be taken over, at a price.
  const buyout = s.rival?.track.includes(key(t)) ? RIVAL_BUYOUT : 1;
  return Math.max(1, Math.round(terrainCost(s.valley.kind, terrain) * (s.charter?.track ?? 1) * buyout));
}

export function canBuild(s: GameState, t: Tile) {
  const cost = trackCost(s, t);
  return s.phase === 'play' && !choosing(s) && cost !== null && cost <= s.coins;
}

/**
 * Lays track on `t`. By default it joins every neighbour on the line. Laid plain, it joins only the
 * piece it continues (`from`, the tile the drag came from, else its first neighbour on the line)
 * and the tile straight across from that; with track on all four sides it is a crossing, two
 * straights that don't join.
 */
export function buildTrack(s: GameState, t: Tile, plain = false, from: Tile | null = null) {
  if (!canBuild(s, t)) return false;
  const cost = trackCost(s, t)!;
  s.coins -= cost;
  if (plain) {
    const line = neighbours(t).filter((n) => onLine(s, n));
    if (line.length === 4) s.crossings.push(key(t));
    else {
      const origin = from && line.some((n) => sameTile(n, from)) ? from : line[0];
      const across = opposite(t, origin);
      for (const n of line) if (!sameTile(n, origin) && !sameTile(n, across)) s.cuts.push(cutKey(t, n));
    }
  }
  if (s.rival) s.rival.track = s.rival.track.filter((k) => k !== key(t));
  s.track.push(key(t));
  s.paid[key(t)] = cost;
  syncSwitches(s, t);
  pop(s, `-${cost}`, t, '#f0c070');
  return true;
}

const cutKey = (a: Tile, b: Tile) => [key(a), key(b)].sort().join('|');
/** Whether two tiles next to each other on the line are not joined. */
export const isCut = (s: GameState, a: Tile, b: Tile) => s.cuts.includes(cutKey(a, b));
/** A crossing: track where two straights cross without joining, so the wyrm can only go straight over it. */
export const isCrossing = (s: GameState, t: Tile) => s.crossings.includes(key(t));
const tileOf = (k: string): Tile => {
  const [c, r] = k.split(',').map(Number);
  return { c, r };
};

/** Track can be taken up for half its cost, unless the wyrm stands on it or is about to cross it. */
export function canRemove(s: GameState, t: Tile) {
  if (s.phase !== 'play' || choosing(s) || !s.track.includes(key(t))) return false;
  return s.wyrms.every((w) => !sameTile(w.at, t) && !w.path.some((p) => sameTile(p, t)));
}

export function removeTrack(s: GameState, t: Tile) {
  if (!canRemove(s, t)) return false;
  s.track = s.track.filter((k) => k !== key(t));
  s.lamps = s.lamps.filter((k) => k !== key(t));
  syncSwitches(s);
  // Half of what the tile cost when it was laid (a charter may have changed the price since).
  const refund = Math.floor(s.paid[key(t)] / 2);
  delete s.paid[key(t)];
  s.coins += refund;
  pop(s, `+${refund}`, t, '#f3c64e');
  return true;
}

/** The tiles next to `t` that are on the line and joined to it. */
export function arms(s: GameState, t: Tile) {
  return neighbours(t).filter((n) => onLine(s, n) && !isCut(s, t, n));
}

/**
 * Gives every junction (track with three or four arms) a switch and drops the switches that are no
 * longer on one. A new switch is set against `newest` when that is one of its arms (the branch just
 * laid), else against its last arm.
 */
function syncSwitches(s: GameState, newest?: Tile) {
  // A cut goes with the track on either side of it; a crossing with fewer than four arms is plain track.
  s.cuts = s.cuts.filter((c) => c.split('|').every((k) => onLine(s, tileOf(k))));
  s.crossings = s.crossings.filter((k) => s.track.includes(k) && arms(s, tileOf(k)).length === 4);
  const next: Record<string, string> = {};
  for (const k of s.track) {
    if (s.crossings.includes(k)) continue;
    const a = arms(s, tileOf(k)).map(key);
    if (a.length < 3) continue;
    const old = s.switches[k];
    next[k] = old && a.includes(old) ? old : newest && a.includes(key(newest)) ? key(newest) : a[a.length - 1];
  }
  s.switches = next;
}

/** Throws the switch on a junction: it is set against the next of its arms. */
export function throwSwitch(s: GameState, t: Tile) {
  const closed = s.switches[key(t)];
  if (s.phase !== 'play' || choosing(s) || !closed) return false;
  const a = arms(s, t).map(key);
  s.switches[key(t)] = a[(a.indexOf(closed) + 1) % a.length];
  return true;
}

/** Whether going from `at` to `next`, having come in from `from`, uses the arm the switch on `at` is set against. */
function againstSwitch(s: GameState, from: Tile | null, at: Tile, next: Tile) {
  const closed = s.switches[key(at)];
  return !!closed && (closed === key(next) || (!!from && closed === key(from)));
}

/** A wyrm throws the switch on `at` itself: set against an arm this move doesn't use. */
function setSwitchFor(s: GameState, from: Tile | null, at: Tile, next: Tile) {
  const used = [key(next), from ? key(from) : ''];
  const free = arms(s, at).map(key).filter((k) => !used.includes(k));
  if (s.switches[key(at)] && free.length) s.switches[key(at)] = free[0];
}

/**
 * A way along the line from `a` to `b`, without `a`, for a wyrm that came to `a` from `from`; null
 * if there is none. It searches (tile, came-from) pairs: it goes straight over a crossing (any way
 * from one it starts on with no `from`), and it only turns back at a station, at the end of a line,
 * or where it starts with no `from`. Loose, it is the shortest
 * such way, switches or not. Strict, it is the shortest way the switches leave open: it never uses a
 * junction's barred arm.
 */
export function route(s: GameState, a: Tile, b: Tile, from: Tile | null = null, strict = false): Tile[] | null {
  type Step = { t: Tile; prev: Tile | null; back: Step | null };
  const seen = new Set<string>();
  const id = (t: Tile, prev: Tile | null) => `${key(t)}<${prev ? key(prev) : ''}`;
  const queue: Step[] = [{ t: a, prev: from, back: null }];
  seen.add(id(a, from));
  while (queue.length) {
    const step = queue.shift()!;
    if (sameTile(step.t, b)) {
      const path: Tile[] = [];
      for (let at: Step | null = step; at?.back; at = at.back) path.unshift(at.t);
      return path;
    }
    const closed = s.switches[key(step.t)];
    const out = arms(s, step.t);
    const crossing = step.prev && isCrossing(s, step.t) ? opposite(step.t, step.prev) : null;
    for (const n of out) {
      if (seen.has(id(n, step.t))) continue;
      if (crossing && !sameTile(n, crossing)) continue;
      const back = step.prev && sameTile(n, step.prev);
      if (back && out.length > 1 && !isStation(s, step.t)) continue;
      if (strict && closed && (closed === key(n) || (step.prev && closed === key(step.prev)))) continue;
      seen.add(id(n, step.t));
      queue.push({ t: n, prev: step.t, back: step });
    }
  }
  return null;
}

/** The way a wyrm takes to `b`: the way the switches are set if there is one, else the shortest way, throwing switches as it goes. */
function planRoute(s: GameState, w: Wyrm, b: Tile) {
  return route(s, w.at, b, w.from, true) ?? route(s, w.at, b, w.from);
}

/**
 * Whether a wyrm could fetch and deliver this order along the track laid so far; for an order
 * already aboard (or loading), whether its wyrm can still reach the drop.
 */
export function routable(s: GameState, o: Order) {
  if (o.wyrm !== null && (o.status === 'loading' || o.status === 'carrying')) {
    const w = s.wyrms[o.wyrm];
    return route(s, w.at, villages(s)[o.to], w.from) !== null;
  }
  const from = villages(s)[o.from];
  return s.wyrms.some((w) => route(s, w.at, from, w.from) !== null) && route(s, from, villages(s)[o.to]) !== null;
}

/** Sends the wyrms for a waiting order; they fetch and deliver sent orders nearest stop first. */
export function dispatch(s: GameState, id: number) {
  const o = s.orders.find((o) => o.id === id);
  if (s.phase !== 'play' || !o || o.status !== 'waiting' || !routable(s, o)) return false;
  o.status = 'queued';
  s.queue.push(id);
  return true;
}

/** The round the second wyrm can be woken from: earlier with the gold medal's Early riser boon. */
export const secondWyrmRound = (s: GameState) => SECOND_WYRM_ROUND - (hasBoon(s, 'gold') ? EARLY_RISER_ROUNDS : 0);

/** Why an upgrade can't be bought yet, whatever the coins: the second wyrm comes late in the game. */
export const upgradeLocked = (s: GameState, u: Upgrade) => u === 'second' && s.round < secondWyrmRound(s);

export const upgradeCost = (s: GameState, u: Upgrade): number | null => (UPGRADE_COSTS[u] as readonly number[])[s.upgrades[u]] ?? null;

export function buyUpgrade(s: GameState, u: Upgrade) {
  const cost = upgradeCost(s, u);
  if (s.phase !== 'play' || cost === null || cost > s.coins || upgradeLocked(s, u)) return false;
  s.coins -= cost;
  s.upgrades[u]++;
  if (u === 'second') {
    s.wyrms.push(newWyrm());
    s.banner = { text: tr('secondWyrmWakes'), ms: BANNER_MS };
  }
  return true;
}

/** A wyrm's speed in tiles a second: Swift wings make it faster, an empty belly or unlit track at night slower. */
export const wyrmSpeed = (s: GameState, w: Wyrm) =>
  (BASE_SPEED + WINGS_SPEED * s.upgrades.wings + (hasTrait(s, 'swift') ? TRAIT_SPEED : 0)) *
  (w.food <= 0 ? STARVING_SLOWDOWN : 1) *
  (isNight(s) && w.path.length && !isLit(s, w.path[0]) ? DARK_SLOWDOWN : 1);

/** What each tile costs a wyrm's belly: more in the snowy valley's cold, less once it has moulted Frugal. */
const foodPerTile = (s: GameState) => FOOD_PER_TILE * (s.valley.kind === 'snow' ? COLD_HUNGER : 1) * (hasTrait(s, 'frugal') ? FRUGAL_HUNGER : 1);

/** Loading and throwing a switch take half as long once the wyrm has moulted Nimble. */
const nimble = (s: GameState, ms: number) => ms * (hasTrait(s, 'nimble') ? NIMBLE_TIME : 1);

/** Whether this round flies at night (WR19). */
export const isNight = (s: GameState) => NIGHT_ROUNDS.includes(s.round);

/** Whether a tile is lit at night: a station, or a lamp on it or beside it. */
export const isLit = (s: GameState, t: Tile) => isStation(s, t) || [t, ...neighbours(t)].some((n) => s.lamps.includes(key(n)));

/** Whether a lamp can be hung on `t`: track without one, once lamps are sold, and paid for. */
export function canBuyLamp(s: GameState, t: Tile) {
  return s.phase === 'play' && !choosing(s) && s.round >= LAMP_ROUND && s.track.includes(key(t)) && !s.lamps.includes(key(t)) && s.coins >= LAMP_COST;
}

/** Hangs a lamp on a track tile: at night it lights it and the tiles beside it, so the wyrm flies on at full speed. */
export function buyLamp(s: GameState, t: Tile) {
  if (!canBuyLamp(s, t)) return false;
  s.coins -= LAMP_COST;
  s.lamps.push(key(t));
  pop(s, tr('lampPop', { n: LAMP_COST }), t, '#f0c070');
  return true;
}

/** Whether a warehouse can go at village `v`: a town with a depot and no warehouse yet, paid for. */
export function canBuyWarehouse(s: GameState, v: number) {
  return s.phase === 'play' && !choosing(s) && s.towns.includes(v) && s.depots.includes(v) && !s.warehouses.includes(v) && s.coins >= WAREHOUSE_COST;
}

/** Builds a town's warehouse (WR18): its goods that run late while still waiting go back in store, costing no heart. */
export function buyWarehouse(s: GameState, v: number) {
  if (!canBuyWarehouse(s, v)) return false;
  s.coins -= WAREHOUSE_COST;
  s.warehouses.push(v);
  pop(s, tr('warehousePop', { n: WAREHOUSE_COST }), villages(s)[v], '#f0c070');
  return true;
}

/** What delivering an order pays, with the Golden hoard. */
export const orderPay = (s: GameState, o: Order) => Math.round(o.pay * (1 + HOARD_BONUS * s.upgrades.hoard));

/** The order a job is for, if any. */
export const jobOrder = (job: Job | null) => (job && 'order' in job ? job.order : null);

/** Where a job takes the wyrm, or null if its order is gone. */
function jobTarget(s: GameState, job: Job): Tile | null {
  if (job.leg === 'feed') return ROOST;
  if (job.leg === 'visit') return villages(s)[job.village];
  const o = s.orders.find((o) => o.id === job.order);
  return o ? villages(s)[job.leg === 'pickup' ? o.from : o.to] : null;
}

/** Picks one of the two charters on offer for the round; the game goes on. */
export function pickCharter(s: GameState, i: number) {
  const charter = s.charterOffer?.[i];
  if (s.phase !== 'play' || s.moultOffer || !charter) return false;
  s.charter = charter;
  s.charterOffer = null;
  const news = roundNews(s);
  s.banner = { text: [tr('charterBanner', { name: tr(charter.name) }), ...news].join('\n'), ms: BANNER_MS * (news.length ? 1.5 : 1) };
  return true;
}

/** Picks one of the traits a moult offers (WR16): the wyrms keep it for the game and the valleys after it. */
export function pickMoult(s: GameState, i: number) {
  const trait = s.moultOffer?.[i];
  if (s.phase !== 'play' || !trait) return false;
  s.traits.push(trait);
  s.moultOffer = null;
  s.banner = { text: tr('moultBanner', { name: tr(TRAIT_TEXT[trait].name) }), ms: BANNER_MS };
  return true;
}

/** What is new this round, for its banner (again under the charter's, since the charter cards hide the first): the rival, lamps and night. */
function roundNews(s: GameState) {
  const news: string[] = [];
  if (s.round === RIVAL_ROUND && s.rival) news.push(tr('rivalBanner'));
  if (s.round === LAMP_ROUND) news.push(tr('lampsBanner'));
  if (isNight(s)) news.push(tr('nightBanner'));
  return news;
}

/** What the next depot costs: each one costs more than the last. */
export const depotCost = (s: GameState) => DEPOT_COST + DEPOT_STEP * s.depots.length;

/** Whether depots can be built yet. */
export const depotLocked = (s: GameState) => s.round < DEPOT_ROUND;

/** Whether a depot can go at village `v`: an open village without one, once depots are unlocked and paid for. */
export function canBuyDepot(s: GameState, v: number) {
  return (
    s.phase === 'play' && !choosing(s) && !depotLocked(s) && openIndexes(s).includes(v) && !s.depots.includes(v) && depotCost(s) <= s.coins
  );
}

/** Builds a depot at village `v` (WR11): goods waiting there use up their time at half speed and load at once. */
export function buyDepot(s: GameState, v: number) {
  if (!canBuyDepot(s, v)) return false;
  const cost = depotCost(s);
  s.coins -= cost;
  s.depots.push(v);
  pop(s, tr('depotPop', { n: cost }), villages(s)[v], '#f0c070');
  return true;
}

/** The village index at a tile, if an open village stands there. */
export const villageAt = (s: GameState, t: Tile) => openIndexes(s).find((i) => sameTile(villages(s)[i], t)) ?? null;

/** A wyrm free for a courier call: not heading anywhere, not busy at a stop, and carrying nothing. */
const idleWyrm = (s: GameState, i: number) => {
  const w = s.wyrms[i];
  return !w.job && !w.path.length && w.loadMs <= 0 && w.eatMs <= 0 && w.switchMs <= 0 && !s.orders.some((o) => o.wyrm === i);
};

/** The wyrm a courier call to village `v` would send: the free one nearest it along the line, with its way there. */
function courierFor(s: GameState, v: number) {
  let best: { i: number; path: Tile[] } | null = null;
  s.wyrms.forEach((w, i) => {
    if (!idleWyrm(s, i)) return;
    const path = planRoute(s, w, villages(s)[v]);
    if (path && (!best || path.length < best.path.length)) best = { i, path };
  });
  return best as { i: number; path: Tile[] } | null;
}

/** Whether a courier call can go to village `v`: moods count, it isn't delighted already, the gifts are paid for, and a free wyrm can reach it. */
export function canSendCourier(s: GameState, v: number) {
  if (s.phase !== 'play' || choosing(s) || s.round < MOOD_ROUND || s.coins < COURIER_COST) return false;
  if (!openIndexes(s).includes(v) || s.moods[v] >= MOOD_MAX) return false;
  if (s.wyrms.some((w) => w.job?.leg === 'visit' && w.job.village === v)) return false;
  return courierFor(s, v) !== null;
}

/** A courier call (WR13): a free wyrm flies to village `v` with gifts, which reset its wait and cheer it by one. */
export function sendCourier(s: GameState, v: number) {
  if (!canSendCourier(s, v)) return false;
  const { i, path } = courierFor(s, v)!;
  s.coins -= COURIER_COST;
  const w = s.wyrms[i];
  w.job = { leg: 'visit', village: v };
  w.path = path;
  pop(s, tr('giftsCost', { n: COURIER_COST }), villages(s)[v], '#f0c070');
  if (!path.length) arrive(s, i);
  return true;
}

/** A charter's pay for this cargo, times the usual: its `pay` for every cargo, or only for its own. */
const charterPay = (s: GameState, cargo: Cargo) => (s.charter && (!s.charter.cargo || s.charter.cargo === cargo) ? s.charter.pay : 1);

/** Moves the game on by `dt` milliseconds of game time. The game waits while a charter or a moult is on offer. */
export function tick(s: GameState, dt: number) {
  for (const p of s.pops) p.ms -= dt;
  s.pops = s.pops.filter((p) => p.ms > 0);
  if (s.banner && (s.banner.ms -= dt) <= 0) s.banner = null;
  if (s.phase !== 'play' || choosing(s)) return;

  if (s.orders.length < MAX_ORDERS && (s.orderTimerMs -= dt * (s.charter?.orders ?? 1)) <= 0) {
    s.orderTimerMs = ORDER_EVERY_MS;
    randomOrder(s);
  }
  if (s.round === FESTIVAL_ROUND) s.festivalMs += dt;
  for (const o of [...s.orders]) {
    // Goods waiting at a depot keep longer.
    const wait = o.status !== 'carrying' && s.depots.includes(o.from) ? DEPOT_WAIT : 1;
    if ((o.timeLeftMs -= dt * wait) <= 0) failOrder(s, o);
    if (s.phase !== 'play') return;
  }
  tickMoods(s, dt);
  tickHazard(s, dt);
  tickRival(s, dt);
  for (let i = 0; i < s.wyrms.length && s.phase === 'play'; i++) moveWyrm(s, i, dt);
}

/** A village's mood, as the orders it sends feel it: nothing before `MOOD_ROUND`. */
export const moodOf = (s: GameState, v: number) => (s.round >= MOOD_ROUND ? s.moods[v] : 0);

/** Cheers (`by` > 0) or sours a village. At rock bottom it loses faith in the line: a heart goes, and it sulks on. */
function cheer(s: GameState, v: number, by: number) {
  if (s.round < MOOD_ROUND) return;
  s.moods[v] = Math.max(-MOOD_MAX, Math.min(MOOD_MAX, s.moods[v] + by));
  if (s.moods[v] > -MOOD_MAX) return;
  s.moods[v] = 1 - MOOD_MAX;
  s.hearts--;
  pop(s, tr('losesFaith', { village: villages(s)[v].name }), villages(s)[v], '#f08a6a');
  if (s.hearts <= 0) s.phase = 'over';
}

/**
 * Every open village waits for a visit; one that waits too long sours. The wait allowed grows with the
 * villages on the line. In the festival every order goes to the host, so nobody waits for a visit.
 */
function tickMoods(s: GameState, dt: number) {
  if (s.round < MOOD_ROUND || s.round === FESTIVAL_ROUND) return;
  const open = openIndexes(s);
  const gap = (MOOD_GAP_MS + MOOD_GAP_PER_VILLAGE_MS * open.length) * (hasTrait(s, 'charming') ? CHARMING_GAP : 1);
  for (const v of open) {
    if ((s.idleMs[v] += dt) < gap) continue;
    s.idleMs[v] = 0;
    pop(s, tr('feelsForgotten', { village: villages(s)[v].name }), villages(s)[v], '#d8c7a6');
    cheer(s, v, -1);
    if (s.phase !== 'play') return;
  }
}

/**
 * The hazard that could take the track on `t`, by the valley's kind: a washout (a bridge) or a
 * rockfall (track beside a mountain, not a tunnel through one) in the meadow and the canyon; an
 * avalanche beside a mountain in the snowy valley, whose frozen river takes no bridge; a washout
 * or a sinkhole (track on the bank beside the water) in the marsh.
 */
export function hazardKind(s: GameState, t: Tile): HazardKind | null {
  const terrain = terrainAt(s.valley, t);
  const kind = s.valley.kind;
  if (terrain === 'river') return kind === 'snow' ? null : 'washout';
  // A tunnel runs inside the mountain, safe from the stones coming down its sides.
  if (terrain === 'mountain') return null;
  const beside = (x: string) => neighbours(t).some((n) => terrainAt(s.valley, n) === x);
  if (kind === 'marsh') return beside('river') ? 'sinkhole' : null;
  if (!beside('mountain')) return null;
  return kind === 'snow' ? 'avalanche' : 'rockfall';
}

/** From `HAZARD_ROUND`, a washout or a rockfall is warned every so often and takes a tile's track when its time is up. */
function tickHazard(s: GameState, dt: number) {
  if (s.round < HAZARD_ROUND) return;
  if (s.hazard) {
    if ((s.hazard.ms -= dt) <= 0) strikeHazard(s);
    return;
  }
  if ((s.hazardTimerMs -= dt) > 0) return;
  s.hazardTimerMs = HAZARD_EVERY_MS * (s.valley.kind === 'canyon' ? CANYON_HAZARDS : 1);
  // Never under a wyrm: one standing there could be cut off from every way off the tile.
  const spots = s.track.map(tileOf).filter((t) => hazardKind(s, t) && !s.wyrms.some((w) => sameTile(w.at, t)));
  if (!spots.length) return;
  const tile = spots[Math.floor(Math.random() * spots.length)];
  const kind = hazardKind(s, tile)!;
  s.hazard = { tile, kind, ms: HAZARD_WARN_MS };
  s.banner = { text: tr(HAZARD_TEXT[kind].warning), ms: BANNER_MS };
}

/** The hazard takes its tile's track, once no wyrm is on it or about to cross it; the wyrms heading over it stop short and think again. */
function strikeHazard(s: GameState) {
  const h = s.hazard!;
  // A wyrm idling on the tile, waiting for its next job, steps off it so the hazard can strike.
  for (const w of s.wyrms) if (sameTile(w.at, h.tile) && !w.job && !w.path.length && w.progress === 0) stepOff(s, w);
  // A wyrm stranded on the tile, with no track left beside it, can't step off: the hazard blows over.
  if (s.wyrms.some((w) => sameTile(w.at, h.tile) && !w.path.length && w.progress === 0 && !arms(s, w.at).length)) {
    s.hazard = null;
    return;
  }
  if (s.wyrms.some((w) => sameTile(w.at, h.tile) || (w.progress > 0 && w.path.length && sameTile(w.path[0], h.tile)))) {
    h.ms = 500;
    return;
  }
  s.hazard = null;
  s.track = s.track.filter((k) => k !== key(h.tile));
  s.lamps = s.lamps.filter((k) => k !== key(h.tile));
  delete s.paid[key(h.tile)];
  syncSwitches(s);
  pop(s, tr(HAZARD_TEXT[h.kind].pop), h.tile, '#f08a6a');
  for (const w of s.wyrms) {
    const i = w.path.findIndex((t) => sameTile(t, h.tile));
    if (i < 0) continue;
    w.path = w.path.slice(0, i);
    if (!w.path.length) stopWaiting(w);
    dropJob(s, w);
  }
}

/** An idle wyrm moves one tile on, straight ahead if it can, else back the way it came, else any way. */
function stepOff(s: GameState, w: Wyrm) {
  const out = arms(s, w.at);
  const ahead = w.from && out.find((n) => sameTile(n, opposite(w.at, w.from!)));
  const back = w.from && out.find((n) => sameTile(n, w.from!));
  const next = ahead || back || out[0];
  if (next) w.path = [next];
}

/** A wyrm that has nowhere left to go stops waiting at a junction or a switch. */
function stopWaiting(w: Wyrm) {
  w.waitMs = 0;
  w.switchMs = 0;
}

/** A wyrm gives up the stop it was heading for: a pickup goes back to the queue, cargo stays aboard. */
function dropJob(s: GameState, w: Wyrm) {
  const o = s.orders.find((o) => o.id === jobOrder(w.job));
  if (o && w.job?.leg === 'pickup') {
    o.wyrm = null;
    s.queue.unshift(o.id);
  }
  w.job = null;
}

function moveWyrm(s: GameState, i: number, dt: number) {
  const w = s.wyrms[i];
  if (w.switchMs > 0) {
    if ((w.switchMs -= dt) > 0) return;
    w.switchMs = 0;
    if (w.path.length) setSwitchFor(s, w.from, w.at, w.path[0]);
  }
  if (w.loadMs > 0) {
    if ((w.loadMs -= dt) > 0) return;
    w.loadMs = 0;
    const o = s.orders.find((o) => o.id === jobOrder(w.job));
    if (o) o.status = 'carrying';
    w.job = null;
  }
  if (w.eatMs > 0) {
    if ((w.eatMs -= dt) > 0) return;
    w.eatMs = 0;
    w.food = 1;
    w.job = null;
  }
  // A new stop is picked once the wyrm stands still on a tile.
  if (!w.job && !w.path.length) nextStop(s, i);
  if (w.path.length) {
    if (w.progress === 0) {
      if (againstSwitch(s, w.from, w.at, w.path[0])) return void stopForSwitch(s, w);
      if (waitForOther(s, i, dt)) return;
    }
    w.progress += (wyrmSpeed(s, w) * dt) / 1000;
    while (w.progress >= 1 && w.path.length) {
      w.from = w.at;
      w.at = w.path.shift()!;
      w.progress -= 1;
      if (!s.charter?.fed) w.food = Math.max(0, w.food - foodPerTile(s));
      // On every tile it looks again at the switches ahead, so a switch thrown on the fly steers it.
      const target = w.job && w.path.length ? jobTarget(s, w.job) : null;
      if (target) w.path = planRoute(s, w, target) ?? w.path;
      if (!w.path.length) break;
      if (againstSwitch(s, w.from, w.at, w.path[0])) return void stopForSwitch(s, w);
      if (waitForOther(s, i, 0)) return void (w.progress = 0);
    }
    if (w.path.length) return;
    w.progress = 0;
  }
  if (w.job) arrive(s, i);
}

/** The switch ahead is set against the wyrm and no open way is left: it stops on the junction to throw it. */
function stopForSwitch(s: GameState, w: Wyrm) {
  w.progress = 0;
  w.switchMs = nimble(s, SWITCH_MS);
  pop(s, tr('switchPop'), w.at, '#f0c070');
}

/**
 * Whether a wyrm about to move on has to wait: the tile ahead is a junction the other wyrm is on or
 * moving into (one waiting before it doesn't count, so of two wyrms meeting there one goes first).
 * It waits `JUNCTION_WAIT_MS` at most, so two wyrms never block each other for good.
 */
function waitForOther(s: GameState, i: number, dt: number) {
  const w = s.wyrms[i];
  const next = w.path[0];
  const held =
    !!s.switches[key(next)] &&
    s.wyrms.some((o, j) => j !== i && (sameTile(o.at, next) || (o.progress > 0 && o.path.length > 0 && sameTile(o.path[0], next))));
  if (!held || w.waitMs >= JUNCTION_WAIT_MS) {
    w.waitMs = 0;
    return false;
  }
  w.waitMs += dt;
  return true;
}

/**
 * Picks a wyrm's next stop. A hungry wyrm flies to the Roost to eat first. Otherwise it is the
 * nearest of the villages its cargo is going to and, while a wagon is free, the villages with sent
 * orders to fetch.
 */
function nextStop(s: GameState, i: number) {
  const w = s.wyrms[i];
  if (w.food <= HUNGRY) {
    const path = planRoute(s, w, ROOST);
    if (path) {
      w.job = { leg: 'feed' };
      w.path = path;
      // Already on the Roost: `moveWyrm` has it arrive, like any stop.
      return;
    }
  }
  const carrying = s.orders.filter((o) => o.status === 'carrying' && o.wyrm === i);
  const stops: { order: Order; leg: 'pickup' | 'drop' }[] = carrying.map((order) => ({ order, leg: 'drop' }));
  // Passengers take both wagons: a wyrm fetches them only when empty, and loads nothing else with them.
  if (carrying.length < wagons(s) && !carrying.some(isPassengers)) {
    for (const id of s.queue) {
      const order = s.orders.find((o) => o.id === id);
      if (order && !(isPassengers(order) && carrying.length)) stops.push({ order, leg: 'pickup' });
    }
  }
  let best: { order: Order; leg: 'pickup' | 'drop'; path: Tile[] } | null = null;
  for (const stop of stops) {
    const path = planRoute(s, w, villages(s)[stop.leg === 'pickup' ? stop.order.from : stop.order.to]);
    if (path && (!best || path.length < best.path.length)) best = { ...stop, path };
  }
  if (!best) return;
  if (best.leg === 'pickup') {
    s.queue = s.queue.filter((id) => id !== best.order.id);
    best.order.wyrm = i;
  }
  w.job = { order: best.order.id, leg: best.leg };
  w.path = best.path;
}

/** A wyrm has reached the end of its path. */
function arrive(s: GameState, i: number) {
  const w = s.wyrms[i];
  if (w.job?.leg === 'feed') {
    w.eatMs = EAT_MS;
    pop(s, tr('munch'), ROOST, '#c9e8c0');
    return;
  }
  if (w.job?.leg === 'visit') {
    // The gifts: the village is visited and cheered.
    const v = w.job.village;
    w.job = null;
    s.idleMs[v] = 0;
    cheer(s, v, 1);
    pop(s, tr('gifts'), { c: villages(s)[v].c, r: villages(s)[v].r - 1 }, '#9be883');
    return;
  }
  const o = s.orders.find((o) => o.id === jobOrder(w.job));
  if (!o) return void (w.job = null);
  if (w.job!.leg === 'pickup') {
    s.idleMs[o.from] = 0;
    // A depot has the goods ready on the platform: they are aboard at once.
    if (s.depots.includes(o.from)) {
      o.status = 'carrying';
      w.job = null;
      return;
    }
    o.status = 'loading';
    w.loadMs = nimble(s, LOAD_MS);
    return;
  }
  // Delivered, in time: the village is visited and cheered.
  const pay = orderPay(s, o);
  s.coins += pay;
  s.orders = s.orders.filter((x) => x !== o);
  w.job = null;
  s.delivered++;
  s.totalDelivered++;
  s.idleMs[o.to] = 0;
  cheer(s, o.to, 1);
  pop(s, `+${pay}`, villages(s)[o.to], '#f3c64e');
  grow(s, o.to);
  const shop = workshopOf(villages(s)[o.to]);
  if (shop && shop.takes === o.cargo) makeGoods(s, o.to);
  if (s.delivered < roundGoal(s.round)) return;
  if (s.round === FESTIVAL_ROUND) {
    s.phase = 'won';
    s.medal = festivalMedal(s);
    s.banner = null;
  } else nextRound(s);
}

/**
 * The festival's medal (WR14), by its time and the hearts left: gold for every heart in `GOLD_MS`,
 * silver for two hearts in `SILVER_MS`, else bronze.
 */
export function festivalMedal(s: GameState): Medal {
  if (s.hearts >= START_HEARTS && s.festivalMs <= GOLD_MS) return 'gold';
  if (s.hearts >= START_HEARTS - 1 && s.festivalMs <= SILVER_MS) return 'silver';
  return 'bronze';
}

/** A workshop turns the goods just brought into better ones, and sends them on as a new order. */
function makeGoods(s: GameState, at: number) {
  if (s.orders.length > MAX_ORDERS) return;
  const open = openIndexes(s).filter((i) => i !== at);
  const host = festivalHost(s);
  const to = s.round === FESTIVAL_ROUND && host !== at ? host : open[Math.floor(Math.random() * open.length)];
  if (to === undefined) return;
  addOrder(s, at, to, true);
  const v = villages(s)[at];
  pop(s, `${tr(CARGO_NAMES[workshopOf(v)!.makes].name)}!`, { c: v.c, r: v.r - 1 }, '#f3e9d2');
}

function nextRound(s: GameState) {
  s.round++;
  s.delivered = 0;
  syncSwitches(s);
  const joining = villages(s).find((v) => v.round === s.round);
  if (joining) s.idleMs[villages(s).indexOf(joining)] = 0;
  s.charter = null;
  if (s.round >= CHARTER_ROUND) s.charterOffer = offerCharters(s);
  // A moult: the wyrm sheds its skin and the player picks a lasting trait, before the round's charter.
  const lacking = TRAITS.filter((t) => !hasTrait(s, t));
  if (MOULT_ROUNDS.includes(s.round) && lacking.length) {
    const offer: Trait[] = [];
    while (offer.length < MOULT_OFFER && lacking.length) offer.push(lacking.splice(Math.floor(Math.random() * lacking.length), 1)[0]);
    s.moultOffer = offer;
  }
  if (s.round === RIVAL_ROUND && !s.rival) s.rival = newRival(s);
  if (s.rival && s.round === FESTIVAL_ROUND) s.rival.claim = null;
  const news = roundNews(s);
  s.banner = {
    text: [
      s.round === FESTIVAL_ROUND
        ? tr('festivalBanner', { village: villages(s)[festivalHost(s)].name, n: FESTIVAL_GOAL })
        : joining
          ? tr('roundJoins', { round: s.round, village: joining.name })
          : tr('roundBanner', { round: s.round }),
      ...news,
    ].join('\n'),
    ms: BANNER_MS * (s.round === FESTIVAL_ROUND || news.length ? 1.5 : 1),
  };
}

/**
 * Two charters for the round to choose from, no two alike. A cargo charter is for a cargo an open
 * village sends.
 */
function offerCharters(s: GameState): Charter[] {
  const pool = [...CHARTERS];
  const offer: Charter[] = [];
  while (offer.length < 2 && pool.length) {
    const c = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    if (!c.cargo) {
      offer.push(c);
      continue;
    }
    const cargos = [...new Set(openIndexes(s).map((i) => villages(s)[i].cargo))];
    const cargo = cargos[Math.floor(Math.random() * cargos.length)];
    offer.push({ ...c, cargo });
  }
  return offer;
}

/** The order ran out of time: it leaves the board, the village that waited for it sours, and the line loses a heart. */
function failOrder(s: GameState, o: Order) {
  s.orders = s.orders.filter((x) => x !== o);
  s.queue = s.queue.filter((id) => id !== o.id);
  // Goods still waiting at a town's warehouse go back in store: no heart lost, nobody sours.
  const stored = o.status !== 'carrying' && s.warehouses.includes(o.from);
  for (const w of s.wyrms) {
    if (jobOrder(w.job) !== o.id) continue;
    w.job = null;
    w.loadMs = 0;
    // It stops at the next tile it reaches.
    w.path = w.progress > 0 ? w.path.slice(0, 1) : [];
    if (!w.path.length) stopWaiting(w);
  }
  if (stored) return void pop(s, tr('backInStore'), villages(s)[o.from], '#d8c7a6');
  s.hearts--;
  pop(s, tr('late', { cargo: tr(CARGO_NAMES[o.cargo].name) }), villages(s)[o.to], '#f08a6a');
  if (s.hearts <= 0) return void (s.phase = 'over');
  cheer(s, o.to, -1);
}

/**
 * A new order from one village to another: ordinary goods, a workshop's goods, or passengers. The
 * sending village's mood sets its pay (cheerful or delighted) or its time (sulking); the round's
 * charter and passengers scale both.
 */
function addOrder(s: GameState, from: number, to: number, made = false, passengers = false, wares = false) {
  const vs = villages(s);
  const dist = manhattan(vs[from], vs[to]);
  const cargo: Cargo = passengers ? 'passengers' : wares ? 'wares' : made ? workshopOf(vs[from])!.makes : vs[from].cargo;
  const mood = moodOf(s, from);
  const charter = s.charter;
  const time = (mood < 0 ? MOOD_RUSH : 1) * (passengers ? PASSENGER_TIME : 1) * (charter?.time ?? 1);
  const totalMs = Math.round((DEADLINE_BASE_MS + DEADLINE_PER_TILE_MS * dist) * byDifficulty(1.5, 1, 0.7) * time);
  const local = cargo === LOCAL_GOODS[s.valley.kind] ? LOCAL_PAY : 1;
  const town = (s.towns.includes(from) ? TOWN_PAY : 1) * (wares ? WARES_PAY : 1);
  const pay = local * (made ? WORKSHOP_PAY : 1) * MOOD_PAY[Math.max(0, mood)] * (passengers ? PASSENGER_PAY : 1) * charterPay(s, cargo) * town;
  s.orders.push({
    id: s.nextId++,
    cargo,
    from,
    to,
    pay: Math.round((PAY_BASE + PAY_PER_TILE * dist) * pay),
    timeLeftMs: totalMs,
    totalMs,
    status: 'waiting',
    wyrm: null,
    made,
    mood,
  });
}

const openIndexes = (s: GameState) => villages(s).map((_, i) => i).filter((i) => villages(s)[i].round <= s.round);

/**
 * A new order between two open villages, picked with Math.random. Goods a workshop takes often go
 * to that workshop; from `PASSENGER_ROUND` now and then the order is passengers; in the festival
 * every order goes to the festival.
 */
function randomOrder(s: GameState) {
  const open = openIndexes(s);
  const pick = (list: number[]) => list[Math.floor(Math.random() * list.length)];
  const host = festivalHost(s);
  const passengers = s.round >= PASSENGER_ROUND && Math.random() < PASSENGER_CHANCE;
  if (s.round === FESTIVAL_ROUND) return addOrder(s, pick(open.filter((i) => i !== host)), host, false, passengers);
  const from = pick(open);
  const others = open.filter((i) => i !== from);
  if (passengers) return addOrder(s, from, pick(others), false, true);
  // A town also sends its wares, anywhere on the line.
  if (s.towns.includes(from) && Math.random() < WARES_CHANCE) return addOrder(s, from, pick(others), false, false, true);
  const shops = others.filter((i) => workshopOf(villages(s)[i])?.takes === villages(s)[from].cargo);
  addOrder(s, from, shops.length && Math.random() < WORKSHOP_CHANCE ? pick(shops) : pick(others));
}

/** A village fed well grows (WR18): enough deliveries in time from `TOWN_ROUND` and it is a town. */
function grow(s: GameState, v: number) {
  if (s.round < TOWN_ROUND || s.towns.includes(v)) return;
  if (++s.growth[v] < GROW_AT) return;
  s.towns.push(v);
  s.banner = { text: tr('townBanner', { village: villages(s)[v].name }), ms: BANNER_MS * 1.5 };
}

/** A tile the rival can lay track on: open ground off the wyrm's line, away from every village, the Roost and the hazard. */
function rivalFree(s: GameState, r: Rival, t: Tile) {
  if (!inGrid(t) || terrainAt(s.valley, t) === 'mountain') return false;
  if (sameTile(t, ROOST) || sameTile(t, r.yard) || villages(s).some((v) => sameTile(v, t))) return false;
  if (s.hazard && sameTile(s.hazard.tile, t)) return false;
  return !s.track.includes(key(t)) && !r.track.includes(key(t));
}

/** How many open villages a rival line from `yard` could reach. */
function rivalReach(s: GameState, probe: Rival, yard: Tile) {
  const free = (t: Tile) => rivalFree(s, probe, t);
  const seen = new Set([key(yard)]);
  const queue = [yard];
  for (let i = 0; i < queue.length; i++) {
    for (const n of rivalSteps(s, queue[i], free)) {
      if (seen.has(key(n))) continue;
      seen.add(key(n));
      queue.push(n);
    }
  }
  return openIndexes(s).filter((v) => queue.some((t) => manhattan(t, villages(s)[v]) === 1)).length;
}

/**
 * The rival sets up its yard on open grass from where its line can reach the most villages, as far
 * from the Roost as it can; null if there is no room.
 */
function newRival(s: GameState): Rival | null {
  const probe: Rival = { yard: ROOST, track: [], buildMs: RIVAL_BUILD_MS, claim: null, restMs: RIVAL_REST_MS, taken: 0 };
  let best: { t: Tile; score: number } | null = null;
  for (let r = 0; r < s.valley.terrain.length; r++) {
    for (let c = 0; c < s.valley.terrain[0].length; c++) {
      const t = { c, r };
      if (terrainAt(s.valley, t) !== 'grass' || !rivalFree(s, probe, t)) continue;
      const score = rivalReach(s, probe, t) * 100 + manhattan(t, ROOST);
      if (!best || score > best.score) best = { t, score };
    }
  }
  return best && best.score >= 200 ? { ...probe, yard: best.t } : null;
}

/**
 * Where the rival line goes on from `t`: to its free neighbours, and straight over a tile of the
 * wyrm's track to the one beyond (on a flyover), never through a station. `ok` says which tiles count.
 */
function rivalSteps(s: GameState, t: Tile, ok: (n: Tile) => boolean): Tile[] {
  const out: Tile[] = [];
  for (const n of neighbours(t)) {
    if (ok(n)) out.push(n);
    else if (s.track.includes(key(n))) {
      const beyond = opposite(n, t);
      if (inGrid(beyond) && ok(beyond)) out.push(beyond);
    }
  }
  return out;
}

/** The rival's line: its yard and the track joined to it, over flyovers (a tile the wyrm's line took over can cut it). */
function rivalNetwork(s: GameState, r: Rival): Tile[] {
  const seen = new Set([key(r.yard)]);
  const out = [r.yard];
  for (let i = 0; i < out.length; i++) {
    for (const n of rivalSteps(s, out[i], (t) => r.track.includes(key(t)))) {
      if (seen.has(key(n))) continue;
      seen.add(key(n));
      out.push(n);
    }
  }
  return out;
}

/** The wyrm's track tiles the rival line flies over: a rival tile on each side, straight across. */
export function rivalFlyovers(s: GameState): Tile[] {
  const r = s.rival;
  if (!r) return [];
  const own = (t: Tile) => sameTile(t, r.yard) || r.track.includes(key(t));
  return s.track.map(tileOf).filter((t) => (own({ c: t.c - 1, r: t.r }) && own({ c: t.c + 1, r: t.r })) || (own({ c: t.c, r: t.r - 1 }) && own({ c: t.c, r: t.r + 1 })));
}

/** The open villages the rival's line reaches: next to its yard or its joined track. */
export function rivalServes(s: GameState): number[] {
  if (!s.rival) return [];
  const net = rivalNetwork(s, s.rival);
  return openIndexes(s).filter((i) => net.some((t) => manhattan(t, villages(s)[i]) === 1));
}

/** The rival lays its next tile towards the nearest open village its line doesn't reach yet. */
function rivalBuild(s: GameState, r: Rival) {
  const served = rivalServes(s);
  const wanted = openIndexes(s).filter((i) => !served.includes(i)).map((i) => villages(s)[i]);
  if (!wanted.length) return;
  const net = rivalNetwork(s, r);
  const free = (t: Tile) => rivalFree(s, r, t);
  const first = new Map<string, Tile>();
  const queue: Tile[] = [];
  for (const t of net) for (const n of rivalSteps(s, t, free)) {
    if (first.has(key(n))) continue;
    first.set(key(n), n);
    queue.push(n);
  }
  for (let i = 0; i < queue.length; i++) {
    const t = queue[i];
    if (wanted.some((v) => manhattan(t, v) === 1)) return void r.track.push(key(first.get(key(t))!));
    for (const n of rivalSteps(s, t, free)) {
      if (first.has(key(n))) continue;
      first.set(key(n), first.get(key(t))!);
      queue.push(n);
    }
  }
}

/**
 * The rival line (WR20): it lays a tile now and then, and races the wyrm for waiting orders between
 * villages it reaches. An order it has its eye on goes to the rival unless the wyrm is sent for it
 * first. It closes for the festival.
 */
function tickRival(s: GameState, dt: number) {
  const r = s.rival;
  if (!r || s.round === FESTIVAL_ROUND) return;
  if ((r.buildMs -= dt) <= 0) {
    r.buildMs = RIVAL_BUILD_MS;
    rivalBuild(s, r);
  }
  if (r.claim) {
    const o = s.orders.find((o) => o.id === r.claim!.order);
    if (!o || o.status !== 'waiting') {
      if (o) pop(s, tr('beatRival'), villages(s)[o.from], '#9be883');
      r.claim = null;
      r.restMs = RIVAL_REST_MS;
      return;
    }
    if ((r.claim.ms -= dt) > 0) return;
    s.orders = s.orders.filter((x) => x !== o);
    r.claim = null;
    r.restMs = RIVAL_REST_MS;
    r.taken++;
    pop(s, tr('rivalTook', { cargo: tr(CARGO_NAMES[o.cargo].name) }), villages(s)[o.from], '#c7a0e8');
    return;
  }
  if ((r.restMs -= dt) > 0) return;
  const served = rivalServes(s);
  const prize = s.orders
    .filter((o) => o.status === 'waiting' && served.includes(o.from) && served.includes(o.to))
    .sort((a, b) => b.pay - a.pay)[0];
  if (prize) r.claim = { order: prize.id, ms: RIVAL_CLAIM_MS };
}

function pop(s: GameState, text: string, t: Tile, color: string) {
  s.pops.push({ id: s.nextId++, text, x: t.c, y: t.r, color, ms: POP_MS });
}
