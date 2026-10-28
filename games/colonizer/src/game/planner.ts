// The AI opponent's planner. Every few seconds it reads the state of its own side and gives the
// same commands a player would (train, place, research, gather, attack), in priority order: keep
// villagers coming, keep houses ahead of the population cap, feed and wood up, build the production
// line, research, then train and send the army. Only the AI's own units and buildings are touched.
// It plays the AI's side (both AIs in a three-way match), and in watch mode (`?watch`) the player's
// side too: `think` takes the side. Each side's temperament (TEMPERAMENTS) sets its build, research,
// soldiers, raid timing and picks.
import {
  BELL_RANGE,
  BOONS,
  BUILDINGS,
  EDGES,
  FACTIONS,
  RAID_MAX_MS,
  RAID_TOWN_FROM,
  RELICS,
  TECHS,
  TEMPERAMENTS,
  UNIQUE,
  UNITS,
  type BuildingId,
  type Resource,
  type Temperament,
  isSoldier,
  takesRally,
  unitFor,
} from './data';
import {
  AI,
  PLAYER,
  affordable,
  campSpots,
  canPlace,
  chooseBoon,
  chooseEdge,
  endRaid,
  garrisoned,
  hasBuilt,
  hasBuildingFor,
  holds,
  issue,
  monumentLeft,
  NEUTRAL,
  notAllowed,
  placeBuilding,
  placeWall,
  popCap,
  popUsed,
  releaseBell,
  research,
  ringBell,
  rivalsOf,
  setRally,
  startRaid,
  trade,
  train,
  unitCost,
  unitCount,
  type Building,
  type GameState,
  type RaidGoal,
  type Unit,
} from './sim';
import { WATER, inMap, idx, type Node } from './map';
import { aiLog } from '../../../../shared/watch';
import { t } from '../i18n';

/**
 * The AI plays at a human pace: it looks at its side every THINK_MS and gives at most
 * ACTIONS_PER_THINK commands each time (30 a minute), in priority order, so villagers can stand idle
 * and production can stall for a while, as they do for a player with one mouse.
 */
const THINK_MS = 4000;
const ACTIONS_PER_THINK = 2;
const TARGET_VILLAGERS = 18;
/** What an economy raid goes for, and how far from the enemy Town Center it must stand. */
const RAID_ECONOMY: BuildingId[] = ['lumber', 'mine', 'farm', 'dock', 'grove', 'market'];
const RAID_CLEAR = 8;
const ARMY_CAP = 40;
/** Trade carts the AI keeps on the road once it has a Market, and rams it keeps with its army in Age II. */
const AI_CARTS = 3;
const AI_RAMS = 2;
/** Market swaps: sell a lot when a resource piles up this high while ore is short, buy one when it runs this low. */
const SWAP_HIGH = 600;
const SWAP_LOW = 60;
/** The AI's palisade: a short diagonal line this far from its Town Center, towards its foe, with a gate in the middle. */
const WALL_OFFSET = 9;
/** The army goes for an unheld relic once it has this many soldiers, between raids. */
const ARMY_FOR_RELIC = 8;

/** The side the planner is thinking for, the side it plays against and its temperament; set by `think`. */
let ME = AI;
let FOE = PLAYER;
let T: Temperament = TEMPERAMENTS.builder;

/** Runs the planner for one side (the AI's unless told) once every THINK_MS of game time. */
export function think(s: GameState, dt: number, side = AI) {
  if (s.winner !== null || s.players[side].out) return;
  s.aiClock[side] += dt;
  if (s.aiClock[side] < THINK_MS) return;
  s.aiClock[side] = 0;
  ME = side;
  FOE = foeFor(s, side);
  T = TEMPERAMENTS[s.players[side].temperament ?? 'builder'];
  plan(s);
}

/**
 * The rival a side plays against this think: the one its raid under way goes for, else a rival with
 * a standing Monument, else the next rival in turn by raids launched, so in a three-way match an AI
 * raids each of the others by turns.
 */
function foeFor(s: GameState, side: number) {
  const rivals = rivalsOf(s, side);
  const raid = s.aiRaid[side];
  if (rivals.length === 0) return raid.foe;
  if (raid.goal && rivals.includes(raid.foe)) return raid.foe;
  const monument = rivals.find((r) => [...s.buildings.values()].some((b) => b.owner === r && b.type === 'monument'));
  return monument ?? rivals[raid.count % rivals.length];
}

/** Writes a decision to the watch log (`?watch` only), naming the building or unit's display name. */
const log = (text: string) => aiLog(String(ME), text);

/** Commands left in this think. */
let budget = 0;
/** Runs one command if the budget allows; a command that does nothing costs nothing. */
function act(fn: () => boolean): boolean {
  if (budget <= 0) return false;
  const done = fn();
  if (done) budget--;
  return done;
}

function plan(s: GameState) {
  budget = ACTIONS_PER_THINK;
  const town = [...s.buildings.values()].find((b) => b.owner === ME && b.type === 'town' && b.built);
  if (!town) return;
  const p = s.players[ME];
  const villagers = [...s.units.values()].filter((u) => u.owner === ME && UNITS[u.type].role === 'villager');
  const idleVillagers = villagers.filter((u) => u.order.t === 'idle');
  const military = [...s.units.values()].filter((u) => u.owner === ME && isSoldier(UNITS[u.type].role));

  // 0a. The town bell: enemy soldiers near the base send the villagers to shelter in the Town Center
  // and the towers, and once the base is clear again they go back to work.
  const threat = [...s.units.values()].some((u) => u.owner !== ME && u.owner !== NEUTRAL && u.hp > 0 && isSoldier(UNITS[u.type].role) && Math.hypot(u.x - town.tx - 2, u.y - town.ty - 2) <= BELL_RANGE);
  if (threat && !p.bell) {
    if (act(() => ringBell(s, ME) > 0)) log(t('logRingBell'));
  } else if (!threat && p.bell) {
    if (act(() => (releaseBell(s, ME), true))) log(t('logReleaseBell'));
  }

  // 0. Every unfinished building gets a builder, so none is left waiting for one. A palisade gets one
  // builder for the whole line: a builder goes on to the next piece by itself.
  const onWall = [...s.units.values()].some((u) => u.owner === ME && u.order.t === 'build' && BUILDINGS[s.buildings.get(u.order.b)?.type ?? 'house'].palisade);
  for (const b of s.buildings.values()) {
    if (b.owner !== ME || b.built) continue;
    if (BUILDINGS[b.type].palisade && onWall) continue;
    const working = [...s.units.values()].some((u) => u.owner === ME && u.order.t === 'build' && u.order.b === b.id);
    if (working) continue;
    const builder = nearestUnit(idleVillagers, b.tx, b.ty) ?? nearestVillager(s, ME, b.tx, b.ty);
    if (builder) act(() => (issue(s, ME, [builder.id], { t: 'build', b: b.id }), true));
  }

  // 1. Economy: villagers from the Town Center until the target, when it's idle.
  if (town.queue.length === 0 && villagers.length + garrisoned(s, ME) < TARGET_VILLAGERS && affordable(p, UNITS.villager.cost)) {
    if (act(() => train(s, ME, town.id, 'villager'))) log(t('logTrain', { unit: t('villager') }));
  }

  // 2. Population: a house before the cap is hit.
  const houseQueued = [...s.buildings.values()].some((b) => b.owner === ME && b.type === 'house' && !b.built);
  if (popUsed(s, ME) >= popCap(s, ME) - 3 && !houseQueued) {
    act(() => buildNear(s, ME, 'house', town, idleVillagers));
  }

  // 3. Buildings in plan order, one at a time, as soon as the AI can pay for each.
  const under = [...s.buildings.values()].some((b) => b.owner === ME && !b.built && !BUILDINGS[b.type].palisade);
  if (!under && budget > 0) {
    for (const step of T.plan) {
      const type = step === 'unique' ? UNIQUE[p.faction] : step;
      // Four farms, the temperament's towers, one of everything else.
      if (count(s, type) >= (type === 'farm' ? 4 : type === 'watchtower' ? T.towers : 1)) continue;
      if (notAllowed(s, ME, type)) continue;
      if (!affordable(p, BUILDINGS[type].cost)) break;
      if (type === 'lumber' || type === 'mine') {
        if (act(() => buildAtResource(s, type === 'lumber' ? 'wood' : 'ore', idleVillagers))) break;
        continue;
      }
      if (type === 'dock') {
        if (act(() => buildAtShore(s, town, idleVillagers))) break;
        continue;
      }
      if (act(() => buildNear(s, ME, type, town, idleVillagers))) break;
    }
  }

  // 3b. A palisade with a gate across the side its foe comes from, from the temperament's age.
  if (T.wall && p.age >= T.wall.age && hasBuilt(s, ME, 'barracks') && !hasBuildingFor(s, ME, 'gate') && p.res.wood >= 60 + T.wall.half * 15) {
    if (act(() => buildWall(s, town))) log(t('logWall'));
  }

  // 3c. Rally flags: each production building sends its soldiers to a spot in front of the base.
  for (const b of s.buildings.values()) {
    if (b.owner !== ME || !b.built || b.rally || b.type === 'town' || !takesRally(b.type)) continue;
    const front = frontOf(s, town, 6);
    act(() => setRally(s, ME, b.id, front.x, front.y));
  }

  // 4. Research at the Academy and the Town Center, in the temperament's research order (`T.research`).
  for (const b of s.buildings.values()) {
    if (b.owner !== ME || !b.built || b.queue.length > 0) continue;
    if (b.type !== 'academy' && b.type !== 'town') continue;
    const at = b.type === 'town' ? 'town' : 'academy';
    const tech = T.research.find((id) => {
      const def = TECHS[id];
      const done = id === 'age2' ? p.age >= 2 : p.techs.includes(id);
      return def.at === at && !done && (!def.age2 || p.age >= 2) && affordable(p, def.cost);
    });
    if (tech && act(() => research(s, ME, b.id, tech))) log(t('logResearch', { tech: t(TECHS[tech].name) }));
  }

  // 5. Military: train from each production building in turn, while the army is under the cap. In
  // Age II a couple of rams join the army, in Age III the faction's champion.
  // The temperament says which come first.
  if (military.length < ARMY_CAP) {
    for (const role of T.roles) {
      const def = unitFor(s.players[ME].faction, role);
      if (def.age && p.age < def.age) continue;
      if (role === 'siege' && unitCount(s, ME, def.id) >= AI_RAMS) continue;
      if (def.limit !== undefined && unitCount(s, ME, def.id) >= def.limit) continue;
      const producer = [...s.buildings.values()].find((b) => b.owner === ME && b.built && b.queue.length === 0 && BUILDINGS[b.type].trains?.includes(role));
      if (!producer) continue;
      const cost = unitCost(s, ME, def);
      if (!affordable(p, cost)) continue;
      if (act(() => train(s, ME, producer.id, def.id))) log(t('logTrain', { unit: t(def.name) }));
    }
  }

  // 5b. The Market: a few trade carts on the road, and swaps when one resource piles up or runs out.
  const market = [...s.buildings.values()].find((b) => b.owner === ME && b.type === 'market' && b.built);
  if (market) {
    if (market.queue.length === 0 && unitCount(s, ME, 'cart') < AI_CARTS && affordable(p, UNITS.cart.cost)) {
      if (act(() => train(s, ME, market.id, 'cart'))) log(t('logTrain', { unit: t('cart') }));
    }
    for (const res of ['wood', 'food'] as const) {
      if (p.res.ore < 100 && p.res[res] >= SWAP_HIGH) {
        if (act(() => trade(s, ME, res, 'sell'))) log(t('logSell', { res: t(res) }));
      } else if (p.res[res] < SWAP_LOW && p.res.ore >= 250) {
        if (act(() => trade(s, ME, res, 'buy'))) log(t('logBuy', { res: t(res) }));
      }
    }
  }

  // 6. Raids, ahead of idle villagers, as a player would. A standing enemy Monument draws everything
  // the AI has, at once. Otherwise a raid waits for its time gate and a big enough army, goes for one
  // goal (the enemy's outlying economy, a relic it holds, later its Town Center) and comes home when
  // the goal is done, half the party has fallen or it has dragged on, then the army rests a while.
  const army = military.filter((u) => u.hp > 0);
  const idleArmy = army.filter((u) => u.order.t === 'idle');
  // Soldiers not in a fight: idle, or walking (a crowd at a rally flag can jostle on its way for good).
  const ready = army.filter((u) => u.order.t === 'idle' || u.order.t === 'move');
  const raid = s.aiRaid[ME];
  const monument = [...s.buildings.values()].find((b) => b.owner === FOE && b.type === 'monument');
  if (monument && monumentLeft(s, FOE) !== null && army.length > 0) {
    if (idleArmy.length > 0 && act(() => true)) {
      const half = BUILDINGS.monument.w / 2;
      const ids = army.map((u) => u.id);
      issue(s, ME, ids, { t: 'attackMove', x: monument.tx + half, y: monument.ty + half });
      // The rush is a raid on the Monument, so `pressRaid` ends it (and the raid it records) once
      // the Monument falls, instead of leaving the record open and every later raid unrecorded.
      if (raid.goal?.b !== monument.id) {
        Object.assign(raid, { goal: { kind: 'town', x: monument.tx + half, y: monument.ty + half, b: monument.id, camp: null }, foe: FOE, party: ids, started: s.time, count: raid.count + 1 });
      }
      startRaid(s, ME, FOE, ids);
      log(t('logMonumentRush', { n: army.length }));
    }
  } else if (raid.goal) {
    pressRaid(s, town);
  } else if (s.time >= raid.next && army.length >= T.army && ready.length >= army.length / 2) {
    const goal = raidGoal(s);
    if (goal && act(() => true)) {
      // An economy or relic raid takes a party, nearest the goal first; the Town Center gets everyone.
      const party = goal.kind === 'town' ? army : [...army].sort((a, b) => Math.hypot(a.x - goal.x, a.y - goal.y) - Math.hypot(b.x - goal.x, b.y - goal.y)).slice(0, T.party);
      const ids = party.map((u) => u.id);
      Object.assign(raid, { goal, foe: FOE, party: ids, started: s.time, count: raid.count + 1 });
      issue(s, ME, ids, { t: 'attackMove', x: goal.x, y: goal.y });
      // The player is told about each new raid.
      startRaid(s, ME, FOE, ids);
      log(t('logRaid', { faction: t(FACTIONS[s.players[FOE].faction].name), goal: goalName(s, goal), n: ids.length }));
    }
  } else if (army.length >= ARMY_FOR_RELIC && ready.length >= army.length / 2) {
    // 6b. Between raids, a fair-sized army goes to take the nearest relic the AI doesn't hold.
    const relic = s.camps
      .filter((c) => c.kind === 'relic' && !holds(s, ME, c.relic!))
      .sort((a, b) => Math.hypot(a.tx - town.tx, a.ty - town.ty) - Math.hypot(b.tx - town.tx, b.ty - town.ty))[0];
    const spot = relic ? campSpots(s, relic)[0] : undefined;
    if (spot && act(() => (issue(s, ME, army.map((u) => u.id), { t: 'attackMove', x: spot.x, y: spot.y }), true))) {
      log(t('logRelic', { n: army.length, relic: t(RELICS[relic.relic!].name) }));
    }
  }

  // 7. Gather: idle villagers go to the resource the AI is shortest of.
  for (const u of idleVillagers) {
    const res = neediest(s);
    const src = nearestNode(s, res, u);
    if (src) act(() => (issue(s, ME, [u.id], { t: 'gather', node: src }), true));
  }

  // 8. The Age II boon and the Age III edge, as the temperament likes them.
  if (p.boonPending && chooseBoon(s, ME, T.boon)) log(t('logBoon', { boon: t(BOONS[T.boon].name) }));
  if (p.edgePending && chooseEdge(s, ME, T.edge)) log(t('logEdge', { edge: t(EDGES[T.edge].name) }));
}

/**
 * The goal for the next raid. The first goes for the enemy's outlying economy, the second for a relic
 * it holds (each falling back on the other), and from RAID_TOWN_FROM on, or in Age III, the Town
 * Center. An unfinished or standing Monument is always the goal.
 */
function raidGoal(s: GameState): RaidGoal | null {
  const mine = [...s.buildings.values()].find((b) => b.owner === ME && b.type === 'town');
  const foeTown = [...s.buildings.values()].find((b) => b.owner === FOE && b.type === 'town');
  if (!mine || !foeTown) return null;
  const at = (b: Building, kind: RaidGoal['kind']): RaidGoal => ({ kind, x: b.tx + BUILDINGS[b.type].w / 2, y: b.ty + BUILDINGS[b.type].h / 2, b: b.id, camp: null });
  const monument = [...s.buildings.values()].find((b) => b.owner === FOE && b.type === 'monument');
  if (monument) return at(monument, 'town');
  const raid = s.aiRaid[ME];
  if (raid.count + 1 >= RAID_TOWN_FROM || s.players[ME].age >= 3) return at(foeTown, 'town');
  // Economy: the enemy's camp, farm, Dock or Grove farthest from its Town Center, out of its arrows,
  // or failing those any other outlying building of its (not a palisade).
  const fx = foeTown.tx + 2;
  const fy = foeTown.ty + 2;
  const away = [...s.buildings.values()]
    .filter((b) => b.owner === FOE && !BUILDINGS[b.type].palisade && Math.hypot(b.tx - fx, b.ty - fy) >= RAID_CLEAR)
    .sort((a, b) => Math.hypot(b.tx - fx, b.ty - fy) - Math.hypot(a.tx - fx, a.ty - fy));
  const outlying = away.find((b) => RAID_ECONOMY.includes(b.type)) ?? away[0];
  const economy = outlying ? at(outlying, 'economy') : null;
  // Relic: one the enemy holds, nearest the AI's own Town Center.
  const camp = s.camps
    .filter((c) => c.kind === 'relic' && c.holder === FOE)
    .sort((a, b) => Math.hypot(a.tx - mine.tx, a.ty - mine.ty) - Math.hypot(b.tx - mine.tx, b.ty - mine.ty))[0];
  const spot = camp ? campSpots(s, camp)[0] : undefined;
  const relic: RaidGoal | null = camp && spot ? { kind: 'relic', x: spot.x, y: spot.y, b: null, camp: camp.id } : null;
  const order = raid.count === 0 ? [economy, relic] : [relic, economy];
  return order.find((g) => g !== null) ?? at(foeTown, 'town');
}

/** How a goal reads in the watch log. */
function goalName(s: GameState, g: RaidGoal) {
  if (g.camp !== null) return t(RELICS[s.camps.find((c) => c.id === g.camp)!.relic!].name);
  return t(BUILDINGS[s.buildings.get(g.b!)!.type].name);
}

/**
 * Keeps the raid under way going: idle raiders go at the goal, and once it is done, half the party
 * has fallen or an economy or relic raid has dragged on, the party walks home and the army rests.
 */
function pressRaid(s: GameState, town: Building) {
  const raid = s.aiRaid[ME];
  const goal = raid.goal!;
  const party = raid.party.map((id) => s.units.get(id)).filter((u): u is Unit => !!u && u.hp > 0);
  const done = goal.b !== null ? !s.buildings.has(goal.b) : s.camps.find((c) => c.id === goal.camp)?.holder !== FOE;
  const bled = party.length < raid.party.length / 2;
  const late = goal.kind !== 'town' && s.time - raid.started > RAID_MAX_MS;
  if (done || bled || late) {
    if (party.length > 0) {
      if (!act(() => true)) return;
      const home = frontOf(s, town, 6);
      issue(s, ME, party.map((u) => u.id), { t: 'move', x: home.x, y: home.y });
    }
    // Every raider fallen is repelled by the sim already; one turned back by losses is repelled too.
    endRaid(s, ME, bled && !done);
    log(t(bled && !done ? 'logRaidBack' : done ? 'logRaidDone' : 'logRaidOff'));
    Object.assign(raid, { goal: null, party: [], next: s.time + T.rest });
    return;
  }
  const idle = party.filter((u) => u.order.t === 'idle');
  if (idle.length === 0) return;
  const ids = idle.map((u) => u.id);
  act(() => (issue(s, ME, ids, goal.b !== null ? { t: 'attack', target: goal.b } : { t: 'attackMove', x: goal.x, y: goal.y }), true));
}

function count(s: GameState, type: BuildingId) {
  let n = 0;
  for (const b of s.buildings.values()) if (b.owner === ME && b.type === type) n++;
  return n;
}

/** The resource with the least income-relevant stock, weighted to keep food and wood up. */
function neediest(s: GameState): Resource {
  const r = s.players[ME].res;
  if (r.food < 100) return 'food';
  if (r.wood < 150) return 'wood';
  return r.ore < 100 ? 'ore' : r.wood <= r.food ? 'wood' : 'food';
}

function nearestNode(s: GameState, res: Resource, u: Unit): number | null {
  let best: { id: number; d: number } | null = null;
  for (const n of s.nodes.values()) {
    if (n.res !== res || n.amount <= 0) continue;
    const d = Math.hypot(n.tx + 0.5 - u.x, n.ty + 0.5 - u.y);
    if (!best || d < best.d) best = { id: n.id, d };
  }
  if (res === 'food') {
    for (const b of s.buildings.values()) {
      if (b.owner !== ME || !b.built || b.type !== 'farm') continue;
      const d = Math.hypot(b.tx + 1 - u.x, b.ty + 1 - u.y);
      if (!best || d < best.d) best = { id: b.id, d };
    }
  }
  return best?.id ?? null;
}

/** Places a building near the Town Center, sent to the nearest idle villager to build. */
function buildNear(s: GameState, owner: number, type: BuildingId, town: Building, idle: Unit[]): boolean {
  const def = BUILDINGS[type];
  const spot = findSpot(s, town.tx + 2, town.ty + 2, 4, 11, def.w, def.h);
  if (!spot) return false;
  return startBuild(s, owner, type, spot, idle);
}

/** Places a camp beside the nearest node of a resource, so the villagers drop off close by. */
function buildAtResource(s: GameState, res: Resource, idle: Unit[]): boolean {
  const town = [...s.buildings.values()].find((b) => b.owner === ME && b.type === 'town');
  if (!town) return false;
  let best: Node | null = null;
  for (const n of s.nodes.values()) {
    if (n.res !== res || n.amount <= 0) continue;
    if (!best || Math.hypot(n.tx - town.tx, n.ty - town.ty) < Math.hypot(best.tx - town.tx, best.ty - town.ty)) best = n;
  }
  if (!best) return false;
  const camp = type2(res);
  const spot = findSpot(s, best.tx, best.ty, 2, 5, BUILDINGS[camp].w, BUILDINGS[camp].h);
  if (!spot) return false;
  return startBuild(s, ME, camp, spot, idle);
}

const type2 = (res: Resource): BuildingId => (res === 'wood' ? 'lumber' : 'mine');

/** A point `d` tiles from the Town Center's middle, towards the player's side of the map. */
function frontOf(s: GameState, town: Building, d: number) {
  const foe = [...s.buildings.values()].find((b) => b.owner === FOE && b.type === 'town');
  const cx = town.tx + 2;
  const cy = town.ty + 2;
  const ang = foe ? Math.atan2(foe.ty - town.ty, foe.tx - town.tx) : -Math.PI * 0.75;
  return { x: cx + Math.cos(ang) * d, y: cy + Math.sin(ang) * d };
}

/** Places a Dock on the shore nearest the Town Center (Tide Coven). */
function buildAtShore(s: GameState, town: Building, idle: Unit[]): boolean {
  let best: { x: number; y: number; d: number } | null = null;
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      if (s.terrain[idx(x, y)] !== WATER) continue;
      const d = Math.hypot(x - town.tx - 2, y - town.ty - 2);
      if (d < 30 && (!best || d < best.d)) best = { x, y, d };
    }
  if (!best) return false;
  const spot = findSpot(s, best.x, best.y, 1, 4, 2, 2, (tx, ty) => canPlace(s, 'dock', tx, ty, ME));
  if (!spot) return false;
  return startBuild(s, ME, 'dock', spot, idle);
}

/** Lays the palisade line across the front of the base, then turns its middle piece into a gate. */
function buildWall(s: GameState, town: Building): boolean {
  const mid = frontOf(s, town, WALL_OFFSET);
  const mx = Math.round(mid.x);
  const my = Math.round(mid.y);
  // Across the line to the player: for a diagonal approach, the other diagonal.
  const foe = [...s.buildings.values()].find((b) => b.owner === FOE && b.type === 'town');
  const sx = foe && Math.sign(foe.tx - town.tx) === Math.sign(foe.ty - town.ty) ? 1 : -1;
  const tiles: { tx: number; ty: number }[] = [];
  const half = T.wall?.half ?? 4;
  for (let k = -half; k <= half; k++) tiles.push({ tx: mx + k, ty: my - k * sx });
  const ids = placeWall(s, ME, tiles);
  // The gate goes on the middle piece, or the piece of the line nearest it.
  const pieces = [...s.buildings.values()]
    .filter((b) => b.owner === ME && b.type === 'wall' && tiles.some((t) => t.tx === b.tx && t.ty === b.ty))
    .sort((a, b) => Math.hypot(a.tx - mx, a.ty - my) - Math.hypot(b.tx - mx, b.ty - my));
  const gate = pieces[0] ? placeBuilding(s, ME, 'gate', pieces[0].tx, pieces[0].ty) : null;
  if (ids.length === 0 && gate === null) return false;
  const builder = nearestVillager(s, ME, mx, my);
  const first = [...s.buildings.values()].find((b) => b.owner === ME && !b.built && BUILDINGS[b.type].palisade);
  if (builder && first) issue(s, ME, [builder.id], { t: 'build', b: first.id });
  return true;
}

function startBuild(s: GameState, owner: number, type: BuildingId, spot: { tx: number; ty: number }, idle: Unit[]) {
  const id = placeBuilding(s, owner, type, spot.tx, spot.ty);
  if (id === null) return false;
  log(t('logBuild', { building: t(BUILDINGS[type].name) }));
  const builder = nearestUnit(idle, spot.tx, spot.ty) ?? nearestVillager(s, owner, spot.tx, spot.ty);
  if (builder) issue(s, owner, [builder.id], { t: 'build', b: id });
  return true;
}

/** The unit of `list` nearest to (x, y), in tiles. */
export function nearestUnit(list: Unit[], x: number, y: number): Unit | null {
  let best: Unit | null = null;
  for (const u of list) if (!best || Math.hypot(u.x - x, u.y - y) < Math.hypot(best.x - x, best.y - y)) best = u;
  return best;
}

function nearestVillager(s: GameState, owner: number, x: number, y: number): Unit | null {
  const list = [...s.units.values()].filter((u) => u.owner === owner && UNITS[u.type].role === 'villager');
  return nearestUnit(list, x, y);
}

/**
 * A free spot for a footprint `w` x `h`, between `min` and `max` tiles from (x, y), with each ring
 * tried in random order so the AI doesn't build in a neat row.
 */
function findSpot(s: GameState, x: number, y: number, min: number, max: number, w: number, h: number, ok?: (tx: number, ty: number) => boolean): { tx: number; ty: number } | null {
  for (let r = min; r <= max; r++) {
    const candidates: { tx: number; ty: number }[] = [];
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        candidates.push({ tx: Math.round(x + dx), ty: Math.round(y + dy) });
      }
    candidates.sort(() => Math.random() - 0.5);
    for (const c of candidates) if (fits(s, c.tx, c.ty, w, h) && (!ok || ok(c.tx, c.ty))) return c;
  }
  return null;
}

function fits(s: GameState, tx: number, ty: number, w: number, h: number) {
  for (let y = ty; y < ty + h; y++)
    for (let x = tx; x < tx + w; x++) if (!inMap(x, y) || s.solid[idx(x, y)]) return false;
  return true;
}
