// The rules of a match: movement, combat, abilities, vision, the AI of every champion and minion,
// the jungle and the shop. Free of Phaser, so the rules can be read without the view.

import {
  type LaneId,
  ABILITY_KEYS,
  AbilityDef,
  AbilityKey,
  BASE,
  BuffDef,
  BUFFS,
  CAMP_KINDS,
  CHAMP_AGGRO,
  ITEMS,
  ELIXIR,
  ELIXIR_COLOR,
  AI_ELIXIR,
  ASSIST,
  KILL,
  SPELL_AI,
  spellById,
  MERC,
  RUNE,
  RUNES,
  RUNE_ORDER,
  BODY,
  STUCK,
  PLATING,
  FIRST_BLOOD,
  COMEBACK,
  SURRENDER,
  DRAKE,
  DRAKES,
  DRAKE_ORDER,
  RECAP,
  PING,
  PINGS,
  PingKind,
  MINION,
  RESPAWN_BASE_MS,
  RESPAWN_PER_LEVEL_MS,
  SHOP_RANGE,
  FOUNTAIN,
  SIGHT,
  DAYNIGHT,
  MAX_LEVEL,
  TOWER,
  Vec,
  WORLD,
  XP_RANGE,
  GOLD_PER_SEC,
  SIDE_COLOR,
  LAST_HIT_LOOK,
  OBJECTIVES,
  OBJECTIVE_GAP_MS,
  SIEGE,
  STREAK,
  TOWERS,
  upgradeById,
  upgradePairAt,
  offerFor,
  UPGRADE_LEVELS,
  ultRank,
  ULT_RANK,
  ULT_RANK_LEVELS,
  ACTIVES,
  ActiveId,
  BEAST,
  BEAST_BUFF,
  ELDER,
  BEAST_CONTESTERS,
  BUSH_REVEAL,
  GANK,
  INHIBITOR,
  ItemDef,
  JUNGLE,
  MAX_ITEMS,
  RETREAT,
  REVEAL_MS,
  Team,
  UpgradeDef,
  WATCH,
  bushAt,
  AI_BUILDS,
  AI_BUILD_FOR,
  BUYBACK,
  RECALL,
  WARD,
  WARD_AI,
  WARD_SPOTS,
  bountyOf,
} from './data';
import { DeathRecap, GameState, HitHow, ObjectiveTitle, RecapRow, SoundId, Unit, dist, getUnit, laneNear, levelFor, refreshStats, spawnMercs, spawnWard, spawnWave } from './state';
import { shortName } from './names';
import { settle, steer } from './terrain';
import { aiLog } from '../../../../shared/watch';
import { english, t as text, type TextKey } from '../i18n';

const TEAMS: Team[] = ['blue', 'red'];

/** How long a shield lasts, in ms. */
const SHIELD_MS = 3000;
/** A champion that has not attacked or cast for this long lands its next attack as an ambush. */
const LULL_MS = 2000;
/** A ranged AI champion (this reach or more) backs off a melee one this close past its reach between shots. */
const KITE = { range: 300, margin: 70, minCd: 250 };
/** Ability cooldowns never get shorter than this share of their length. */
const MIN_CD = 0.55;

/** Advances the match by `dt` ms of game time. */
export function tick(s: GameState, dt: number) {
  if (s.phase !== 'playing') return;
  s.time += dt;
  if (s.time >= s.nextWave) {
    spawnWave(s);
    sound(s, 'wave');
  }
  updateVision(s);
  updateWatchstones(s, dt);
  updateContesters(s);
  updateGanks(s);
  updateJungle(s);
  updateRunes(s);
  if (!s.platesGone && s.time >= PLATING.until) {
    s.platesGone = true;
    for (const u of s.units) u.plates = 0;
    notice(s, text('noticePlatesGone'), '#f2c14e');
  }
  updateSurrender(s);
  const night = nightness(s.time) >= 0.5;
  if (night !== s.night) {
    s.night = night;
    notice(s, text(night ? 'noticeNightfall' : 'noticeDaybreak'), night ? '#9fb4ff' : '#f2c14e');
    sound(s, night ? 'nightfall' : 'daybreak');
  }
  if (s.pings.length && s.time - s.pings[0].at > PING.showMs) s.pings = s.pings.filter((p) => s.time - p.at <= PING.showMs);
  for (const u of [...s.units]) updateUnit(s, u, dt);
  separate(s);
  updateProjectiles(s, dt);
  updateZones(s, dt);
  // Dead minions and wards are gone for good; their slots are cleaned up here.
  s.units = s.units.filter((u) => !(u.dead && (u.kind === 'minion' || u.kind === 'ward')));
  if (s.phase !== 'playing') return;
  // Objectives are the player's errands, so a watched match runs none.
  if (!s.watch) updateObjective(s);
  updateLastHitMark(s);
}

/** An ability as the champion casts it now: its definition with the upgrades it chose and the R's ranks applied. */
export function abilityFor(u: Unit, key: AbilityKey): AbilityDef | undefined {
  const base = u.champ?.abilities.find((a) => a.key === key);
  const ranks = key === 'R' ? ultRank(u.level) : 0;
  if (!base || (u.upgrades.length === 0 && ranks === 0)) return base;
  const ab: AbilityDef = { ...base };
  const pct = (v: number | undefined, p: number | undefined) => (v === undefined || !p ? v : v * (1 + p / 100));
  for (let r = 0; r < ranks; r++) {
    ab.damage = pct(ab.damage, ULT_RANK.damage);
    ab.dps = pct(ab.dps, ULT_RANK.damage);
    ab.heal = pct(ab.heal, ULT_RANK.heal);
    ab.shield = pct(ab.shield, ULT_RANK.shield);
    ab.cd *= 1 + ULT_RANK.cd / 100;
  }
  for (const id of u.upgrades) {
    const up = upgradeById(id);
    if (!up || up.key !== key) continue;
    ab.radius = pct(ab.radius, up.radius);
    ab.damage = pct(ab.damage, up.damage);
    ab.dps = pct(ab.dps, up.damage);
    ab.heal = pct(ab.heal, up.heal);
    ab.shield = pct(ab.shield, up.shield);
    ab.ms = pct(ab.ms, up.ms);
    ab.range = pct(ab.range, up.range) ?? ab.range;
    if (up.cd) ab.cd *= 1 + up.cd / 100;
    if (up.stun) ab.stun = (ab.stun ?? 0) + up.stun;
    if (up.slow) ab.slow = Math.max(ab.slow ?? 0, up.slow);
    if (up.count) ab.count = (ab.count ?? 1) + up.count;
  }
  return ab;
}

/** The player keeps one of the upgrades on offer (0, 1, or 2 on a third card). Returns false if there is no such option. */
export function chooseUpgrade(s: GameState, choice: number): boolean {
  const p = getUnit(s, s.player);
  const offer = s.upgradeOffers[0];
  if (!p || !offer || !(choice >= 0 && choice < offer.options.length)) return false;
  // An offer can borrow a card another level offers; one already kept is not kept twice.
  if (!p.upgrades.includes(offer.options[choice])) p.upgrades.push(offer.options[choice]);
  s.upgradeOffers.shift();
  // The offers still queued are drawn again, so none shows the card just kept.
  if (p.champ) {
    const id = p.champ.id;
    const rest = s.upgradeOffers.map((o) => ({ level: o.level, options: offerFor(id, o.level, p.upgrades, UPGRADE_LEVELS.indexOf(o.level) < s.mastery ? 3 : 2) }));
    s.upgradeOffers = rest.filter((o) => o.options.length);
  }
  return true;
}

// ---------------------------------------------------------------------------------------------
// Stats as buffs and passives change them.

/** The sum of one field over a unit's buffs, its team's drake bonus counted in. */
function buffSum(u: Unit, key: Exclude<keyof BuffDef, 'stealth'>): number {
  let n = u.drake?.[key] ?? 0;
  for (const b of u.buffs) n += b.def[key] ?? 0;
  return n;
}

/** Whether a unit is in stealth now. */
export function stealthed(u: Unit): boolean {
  return u.buffs.some((b) => b.def.stealth);
}

function armorOf(u: Unit): number {
  return u.armor + buffSum(u, 'armor');
}

function attackMsOf(u: Unit): number {
  return u.attackMs / (1 + buffSum(u, 'atk') / 100);
}

/** Walking speed now: slowed by half, faster with a haste or a buff. */
export function speedOf(u: Unit): number {
  const haste = u.hasteMs > 0 ? (u.champ?.passive.haste ?? 0) : 0;
  return u.speed * (u.slowMs > 0 ? 0.5 : 1) * (1 + (buffSum(u, 'speed') + haste) / 100);
}

/** Gives a unit a buff, or renews it if it already has one of that id. */
export function addBuff(u: Unit, id: string, def: BuffDef, ms: number, color: string, look?: string) {
  const had = u.buffs.find((b) => b.id === id);
  if (had) {
    had.ms = Math.max(had.ms, ms);
    had.def = def;
  } else u.buffs.push({ id, ms, def, color, look });
}

/** An ability's look, which the view draws its effects, bolts, zone and buff in. */
export function lookOf(u: Unit, key: AbilityKey): string {
  return `${u.champ?.id ?? 'none'}.${key}`;
}

/** Ends a unit's stealth: attacking or casting shows it. */
function breakStealth(u: Unit) {
  if (u.buffs.some((b) => b.def.stealth)) u.buffs = u.buffs.filter((b) => !b.def.stealth);
}

// ---------------------------------------------------------------------------------------------
// Objectives and last hits.

/** The title of a red tower's objective, by its lane. */
const TOWER_TITLE: Record<LaneId, TextKey> = { top: 'objTowerTop', mid: 'objTowerMid', bottom: 'objTowerBottom' };
/** A lane's name, for notices. */
const LANE_NAME: Record<LaneId, TextKey> = { top: 'laneTop', mid: 'laneMid', bottom: 'laneBottom' };

/** Starts the next objective when it is due, and settles the current one when it is done or late. */
function updateObjective(s: GameState) {
  const o = s.objective;
  if (o) {
    let t = getUnit(s, o.target);
    // A wolf pack is cleared only when its pups are down too: the goal moves on to one still up.
    if (o.kind === 'camp' && t?.dead) {
      const left = s.units.find((m) => m.kind === 'camp' && !m.dead && m.group === t!.group);
      if (left) {
        o.target = left.id;
        t = left;
      }
    }
    const gone = !t || t.dead;
    // The beast only counts when blue slew it: its kill sets blue's buff (it outlasts no respawn).
    // Slain by red, it is missed at once rather than standing until its time runs out.
    const done = gone && (o.kind !== 'beast' || s.beastBuff.blue > s.time);
    if (!gone && s.time < o.endsAt) return;
    const p = getUnit(s, s.player);
    if (done && p) {
      p.gold += o.gold;
      if (o.banner === 'siege') s.siegeUntil = s.time + SIEGE.ms;
      s.objectivesDone++;
      if (t) s.fx.push({ kind: 'ring', x: t.x, y: t.y, r: 80, color: '#f2c14e', ms: 700 });
    }
    sound(s, done ? 'objective' : 'objectiveMissed');
    s.lastObjective = { title: o.title, done, gold: o.gold, at: s.time };
    s.objective = null;
    s.nextObjectiveAt = s.time + OBJECTIVE_GAP_MS;
    return;
  }
  if (s.time < s.nextObjectiveAt) return;
  const p = getUnit(s, s.player);
  const from = p && !p.dead ? p : BASE.blue;
  for (let n = 0; n < OBJECTIVES.length; n++) {
    const def = OBJECTIVES[(s.objectiveIndex + n) % OBJECTIVES.length];
    let target: Unit | null = null;
    let title: ObjectiveTitle = { key: 'objBeast' };
    if (def.kind === 'tower') {
      // The red tower closest to the blue Nexus: the next one in the way.
      target = closest(s.units.filter((u) => u.kind === 'tower' && u.side === 'red' && !u.dead), BASE.blue);
      const spot = target && TOWERS.find((t) => t.x === target!.x && t.y === target!.y);
      title = { key: spot ? TOWER_TITLE[spot.lane] : 'objTower' };
    } else if (def.kind === 'camp') {
      // The nearest boar or wolf pack (its alpha) on blue's half of the jungle: the brutes are a
      // fight of their own, and red's half is red's to defend.
      target = closest(s.units.filter((u) => u.kind === 'camp' && !u.dead && (u.campKind === 'boar' || u.campKind === 'wolf') && ownHalf('blue', u)), from);
      title = { key: target?.campKind === 'wolf' ? 'objCampWolf' : 'objCampBoar' };
    } else if (def.kind === 'champion') {
      target = closest(s.units.filter((u) => u.kind === 'champion' && u.side === 'red' && !u.dead && !hiddenFrom(s, 'blue', u)), from);
      title = target?.champ ? { key: 'objChampion', name: target.champ.hero } : { key: 'objChampionAny' };
    } else {
      const beast = getUnit(s, s.beast);
      target = beast && !beast.dead ? beast : null;
    }
    if (!target) continue;
    s.objective = { kind: def.kind, target: target.id, title, gold: def.gold, banner: def.banner ?? null, startAt: s.time, endsAt: s.time + def.ms };
    s.objectiveIndex = (s.objectiveIndex + n + 1) % OBJECTIVES.length;
    return;
  }
  s.nextObjectiveAt = s.time + OBJECTIVE_GAP_MS;
}

function closest(units: Unit[], to: Vec): Unit | null {
  let best: Unit | null = null;
  for (const u of units) if (!best || dist(u, to) < dist(best, to)) best = u;
  return best;
}

/** Marks the nearest enemy minion near the player that the player's next hit would kill. */
function updateLastHitMark(s: GameState) {
  s.lastHitMark = null;
  const p = getUnit(s, s.player);
  if (!p || p.dead) return;
  let bestD = Infinity;
  for (const e of s.units) {
    if (e.dead || e.kind !== 'minion' || e.side === p.side) continue;
    const d = dist(p, e) - e.radius;
    if (d > p.range + LAST_HIT_LOOK || d >= bestD) continue;
    const hit = ((p.dmg * (1 + buffSum(p, 'dmg') / 100) * 100) / (100 + armorOf(e))) * takenMult(s, e);
    if (e.hp + e.shield > hit) continue;
    s.lastHitMark = e.id;
    bestD = d;
  }
}

// ---------------------------------------------------------------------------------------------
// The player's commands, the shop and abilities.

/** Sends a player's champion to a point on the ground. */
export function commandMove(s: GameState, point: Vec) {
  const p = getUnit(s, s.player);
  if (!p || p.dead) return;
  // A point inside a rock or a tower is moved to the nearest spot a champion can stand on.
  p.moveTo = settle(clampWorld(point), bodyOf(p));
  p.moveStuckMs = 0;
  p.lastMoveDist = Infinity;
  p.target = null;
  p.recallMs = 0;
}

/** Sends a player's champion to attack an enemy unit. */
export function commandAttack(s: GameState, id: number) {
  const p = getUnit(s, s.player);
  if (!p || p.dead) return;
  p.target = id;
  p.moveTo = null;
  p.recallMs = 0;
}

/** What an item costs a champion: its price less the parts it builds from that the champion owns. */
export function priceFor(u: Unit, item: ItemDef): number {
  const parts = (item.from ?? []).filter((id) => u.items.includes(id));
  return item.cost - parts.reduce((n, id) => n + (ITEMS.find((i) => i.id === id)?.cost ?? 0), 0);
}

/**
 * Buys an item for a champion that stands near its Nexus. Parts it builds from are used up. A
 * Vision Ward adds to the wards carried instead of the bag.
 */
export function buy(u: Unit, id: string): boolean {
  const item = ITEMS.find((i) => i.id === id);
  if (!item || u.side === 'neutral' || (!item.ward && u.items.includes(id))) return false;
  // A champion shops at its Nexus, or anywhere while it waits to respawn.
  if (!u.dead && !atShop(u)) return false;
  if (item.elixir) {
    if (u.gold < item.cost) return false;
    u.gold -= item.cost;
    u.buffs = u.buffs.filter((b) => !b.elixir);
    u.buffs.push({ id: item.name, ms: ELIXIR.ms, def: item.elixir, color: ELIXIR_COLOR[item.id] ?? '#c49bff', elixir: true });
    refreshStats(u);
    return true;
  }
  if (item.ward) {
    if (u.wards >= WARD.carry || u.gold < item.cost) return false;
    u.gold -= item.cost;
    u.wards++;
    return true;
  }
  const parts = (item.from ?? []).filter((p) => u.items.includes(p));
  const price = priceFor(u, item);
  if (u.gold < price || u.items.length - parts.length >= MAX_ITEMS) return false;
  u.gold -= price;
  u.items = u.items.filter((i) => !parts.includes(i));
  u.items.push(id);
  refreshStats(u);
  return true;
}

/** Whether a champion stands near enough to its Nexus to shop. */
export function atShop(u: Unit): boolean {
  return u.side !== 'neutral' && dist(u, BASE[u.side]) <= SHOP_RANGE;
}

/** Whether a champion stands in its Nexus's healing ground. */
export function atFountain(u: Unit): boolean {
  return u.side !== 'neutral' && dist(u, BASE[u.side]) <= FOUNTAIN.radius;
}

/** Uses an item's active (a short dash, a drink from the healing flask, or planting a ward). */
export function useActive(s: GameState, u: Unit, id: ActiveId, aim: Vec): boolean {
  const def = ACTIVES.find((a) => a.id === id);
  if (!def || s.phase !== 'playing' || u.dead || u.stunMs > 0 || (u.activeCds[id] ?? 0) > 0) return false;
  if (id === 'ward') return plantWard(s, u, aim);
  if (!u.items.some((i) => ITEMS.find((d) => d.id === i)?.active === id)) return false;
  u.activeCds[id] = def.cd;
  u.recallMs = 0;
  if (id === 'dash') {
    const to = towards(u, aim, def.range ?? 0);
    s.fx.push({ kind: 'line', x: u.x, y: u.y, x2: to.x, y2: to.y, color: '#7fb6ff', ms: 250 });
    if (u.id === s.player) sound(s, 'blink', u, true);
    if (dist(u, to) > 1) u.facing = Math.atan2(to.y - u.y, to.x - u.x);
    place(u, to);
    u.moveTo = null;
  } else {
    u.hp = Math.min(u.maxHp, u.hp + (def.heal ?? 0));
    s.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 34, color: '#62d86f', ms: 500 });
    if (u.id === s.player) sound(s, 'flask', u, true);
  }
  return true;
}

/** Casts a champion's battle spell toward `aim`. Returns false if it can't now (cooldown, no target). */
export function castSpell(s: GameState, u: Unit, aim: Vec): boolean {
  if (s.phase !== 'playing' || u.dead || !u.champ || !u.spell || u.stunMs > 0 || u.spellCd > 0 || u.side === 'neutral') return false;
  const def = spellById(u.spell);
  const amount = (def.base ?? 0) + (def.perLevel ?? 0) * u.level;
  const side = u.side;
  switch (def.id) {
    case 'blink': {
      const to = towards(u, aim, def.range ?? 0);
      s.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 26, color: def.color, ms: 350 }, { kind: 'line', x: u.x, y: u.y, x2: to.x, y2: to.y, color: def.color, ms: 250 });
      if (dist(u, to) > 1) u.facing = Math.atan2(to.y - u.y, to.x - u.x);
      place(u, to);
      u.moveTo = null;
      s.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 26, color: def.color, ms: 350 });
      break;
    }
    case 'firebrand': {
      const foe = closest(
        s.units.filter((e) => e.kind === 'champion' && !e.dead && e.side !== side && !hiddenFrom(s, side, e) && dist(e, u) <= (def.range ?? 0) && dist(e, aim) <= (def.aim ?? 0)),
        aim,
      );
      if (!foe) return false;
      damage(s, foe, dealt(s, u, amount), u.id, 'spell');
      u.facing = Math.atan2(foe.y - u.y, foe.x - u.x);
      s.fx.push({ kind: 'line', x: u.x, y: u.y, x2: foe.x, y2: foe.y, color: def.color, ms: 300 }, { kind: 'ring', x: foe.x, y: foe.y, r: 36, color: def.color, ms: 500 });
      break;
    }
    case 'mend': {
      const hurt = s.units
        .filter((a) => a !== u && a.kind === 'champion' && !a.dead && a.side === side && dist(a, u) <= (def.range ?? 0))
        .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      for (const a of hurt ? [u, hurt] : [u]) {
        a.hp = Math.min(a.maxHp, a.hp + amount);
        s.fx.push({ kind: 'ring', x: a.x, y: a.y, r: 34, color: def.color, ms: 500 });
      }
      break;
    }
    case 'barrier':
      u.shield = Math.max(u.shield, amount);
      u.shieldMs = Math.max(u.shieldMs, def.ms ?? 0);
      s.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 32, color: def.color, ms: 500 });
      break;
  }
  u.spellCd = def.cd;
  u.recallMs = 0;
  u.castMs = 300;
  if (u.id === s.player) sound(s, 'spell', u, true);
  if (!u.player) aiLog(side, `${shortName(u.name)} casts ${english(def.name)}`);
  return true;
}

/** An AI champion's battle spell: a shield, heal or blink away when low with a foe near, a firebrand to finish one. */
function aiSpell(s: GameState, u: Unit) {
  if (!u.spell || u.spellCd > 0 || u.dead || s.time < SPELL_AI.from) return;
  const foe = nearest(s, u, SPELL_AI.look, (e) => e.kind === 'champion');
  if (!foe) return;
  const low = u.hp < u.maxHp * SPELL_AI.low;
  switch (u.spell) {
    case 'blink':
      if (low) castSpell(s, u, fallbackPoint(s, u));
      break;
    case 'barrier':
      if (low) castSpell(s, u, u);
      break;
    case 'mend': {
      const ally = s.units.some((a) => a !== u && a.kind === 'champion' && !a.dead && a.side === u.side && a.hp < a.maxHp * SPELL_AI.low && dist(a, u) <= (spellById('mend').range ?? 0));
      if (low || ally) castSpell(s, u, u);
      break;
    }
    case 'firebrand': {
      const def = spellById('firebrand');
      const prey = nearest(s, u, def.range ?? 0, (e) => e.kind === 'champion' && e.hp < Math.max(e.maxHp * SPELL_AI.finish, (def.base ?? 0) + (def.perLevel ?? 0) * u.level));
      if (prey) castSpell(s, u, prey);
      break;
    }
  }
}

/** Plants one of a champion's wards within `WARD.range` of it, toward `aim`. */
/**
 * The player pings a point for the AI allies (see `PING`): `attack` sends the nearest free ones
 * there, onto the enemy under the ping if there is one; `gather` has the free ones near it wait
 * there; `danger` has the ones near it fall back. Returns the allies that answered, or null when
 * the ping is refused (too soon after the last one, or the match is over).
 */
export function sendPing(s: GameState, u: Unit, kind: PingKind, at: Vec): Unit[] | null {
  if (s.phase !== 'playing' || u.side === 'neutral' || s.time - s.lastPingAt < PING.cd) return null;
  s.lastPingAt = s.time;
  const side = u.side;
  const p = clampWorld(at);
  s.pings.push({ kind, x: p.x, y: p.y, side, at: s.time });
  const allies = s.units.filter((a) => a !== u && a.kind === 'champion' && !a.player && !a.dead && a.side === side);
  let answer: Unit[];
  if (kind === 'danger') {
    answer = allies.filter((a) => dist(a, p) <= PING.near);
    for (const a of answer) {
      a.retreatUntil = s.time + RETREAT.ms;
      a.gankTarget = a.jungleTarget = a.pingGoal = a.pingTarget = null;
    }
  } else {
    const foe = kind === 'attack'
      ? closest(s.units.filter((e) => !e.dead && e.side !== side && e.kind !== 'ward' && e.kind !== 'watchstone' && !hiddenFrom(s, side, e) && dist(e, p) <= e.radius + PING.pick), p)
      : null;
    const ready = allies.filter((a) => a.recallMs <= 0 && a.hp >= a.maxHp * PING.minHp && s.time >= a.retreatUntil);
    answer = kind === 'attack'
      ? ready.filter((a) => dist(a, p) <= PING.reach).sort((a, b) => dist(a, p) - dist(b, p) || a.id - b.id).slice(0, PING.answer)
      : ready.filter((a) => dist(a, p) <= PING.near);
    for (const a of answer) {
      a.pingGoal = { x: p.x, y: p.y };
      a.pingTarget = foe ? foe.id : null;
      a.pingUntil = s.time + PING.ms;
      a.gankTarget = a.jungleTarget = null;
    }
    s.contesters = s.contesters.filter((id) => !answer.some((a) => a.id === id));
  }
  if (u.player) {
    sound(s, 'ping', p, true);
    const names = answer.map((a) => shortName(a.name)).join(', ');
    const key: TextKey = !answer.length ? 'noticePingNobody' : kind === 'attack' ? 'noticePingAttack' : kind === 'gather' ? 'noticePingGather' : 'noticePingDanger';
    notice(s, text(key, { names }), PINGS[kind].color);
  }
  aiLog(side, `${shortName(u.name)} pings ${english(PINGS[kind].name)}${answer.length ? `, ${answer.map((a) => shortName(a.name)).join(' and ')} answer` : ''}`);
  return answer;
}

export function plantWard(s: GameState, u: Unit, aim: Vec): boolean {
  if (s.phase !== 'playing' || u.dead || u.wards <= 0 || u.side === 'neutral') return false;
  const at = towards(u, aim, WARD.range);
  spawnWard(s, u.side, at.x, at.y);
  u.wards--;
  u.recallMs = 0;
  if (dist(u, at) > 1) u.facing = Math.atan2(at.y - u.y, at.x - u.x);
  u.castMs = 300;
  s.fx.push({ kind: 'ring', x: at.x, y: at.y, r: 30, color: SIDE_COLOR[u.side], ms: 500 });
  if (u.id === s.player) sound(s, 'ward', at, true);
  return true;
}

/**
 * Starts a recall: the champion stands still for `RECALL.ms` and then appears at its Nexus. Damage,
 * a move, an attack or a cast cancels it. Returns false if it can't recall now.
 */
export function startRecall(s: GameState, u: Unit): boolean {
  if (s.phase !== 'playing' || u.dead || !u.champ || u.recallMs > 0 || u.stunMs > 0 || atFountain(u)) return false;
  u.recallMs = RECALL.ms;
  u.lastRecallAt = s.time;
  u.moveTo = null;
  u.target = null;
  return true;
}

function finishRecall(s: GameState, u: Unit) {
  s.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 40, color: '#9fd8ff', ms: 500 });
  u.x = u.spawnX;
  u.y = u.spawnY;
  u.target = null;
  u.moveTo = null;
  if (u.path) u.wp = 1;
  s.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 40, color: '#9fd8ff', ms: 500 });
  if (u.id === s.player) sound(s, 'recallHome', u, true);
  if (!u.player) aiLog(u.side, `${shortName(u.name)} recalls home`);
}

/** What a dead champion pays to respawn at once. */
export function buybackCost(u: Unit): number {
  return BUYBACK.base + u.level * BUYBACK.perLevel;
}

/** Pays for a dead champion to respawn at once, once per `BUYBACK.cd`. Returns false if it can't. */
export function buyBack(s: GameState, u: Unit): boolean {
  if (s.phase !== 'playing' || !u.dead || !u.champ || s.time < u.buybackReadyAt) return false;
  const cost = buybackCost(u);
  if (u.gold < cost) return false;
  u.gold -= cost;
  u.buybackReadyAt = s.time + BUYBACK.cd;
  revive(u);
  s.fx.push({ kind: 'ring', x: u.x, y: u.y, r: 50, color: '#f2c14e', ms: 600 });
  if (u.player) {
    notice(s, text('noticeBoughtBack', { gold: cost }), '#f2c14e');
    sound(s, 'buyBack', undefined, true);
  }
  else aiLog(u.side, `${shortName(u.name)} buys back for ${cost} gold`);
  return true;
}

/** Whether a unit can be hit by attacks and abilities at all (watchstones can't). */
function hittable(e: Unit): boolean {
  return e.kind !== 'watchstone';
}

/** An ability's damage as its caster deals it: the passive's spell power, buffs and the difficulty. */
function abilityDamage(s: GameState, caster: Unit, base: number): number {
  const sp = caster.champ?.passive.spellpower ?? 0;
  return dealt(s, caster, base * (1 + sp / 100) * (1 + buffSum(caster, 'dmg') / 100));
}

/** Hurts an enemy with an ability: double damage below an execute threshold, then the stun and slow. */
function abilityHit(s: GameState, caster: Unit, e: Unit, amount: number, ab: { stun?: number; slow?: number; executeBelow?: number }, how: HitHow) {
  if (amount > 0) damage(s, e, ab.executeBelow && e.hp < e.maxHp * ab.executeBelow ? amount * 2 : amount, caster.id, how);
  if (e.kind === 'champion' || e.kind === 'minion') {
    if (ab.slow) e.slowMs = Math.max(e.slowMs, ab.slow);
    if (ab.stun) e.stunMs = Math.max(e.stunMs, ab.stun);
  }
}

/** Casts an ability at a point. Returns false if it is not ready or not yet learned. */
export function cast(s: GameState, caster: Unit, key: AbilityKey, aim: Vec): boolean {
  if (s.phase !== 'playing' || caster.dead || !caster.champ || caster.stunMs > 0) return false;
  const ab = abilityFor(caster, key);
  if (!ab || caster.level < ab.level || caster.cds[key] > 0) return false;
  caster.cds[key] = ab.cd * Math.max(MIN_CD, 1 - (caster.cdr + buffSum(caster, 'cdr')) / 100);
  caster.cdFull[key] = caster.cds[key];
  caster.castMs = 300;
  caster.recallMs = 0;
  caster.revealMs = REVEAL_MS;
  caster.lullMs = 0;
  breakStealth(caster);
  if (dist(caster, aim) > 1) caster.facing = Math.atan2(aim.y - caster.y, aim.x - caster.x);
  const color = caster.champ.color;
  const dmg = abilityDamage(s, caster, ab.damage ?? 0);
  const look = lookOf(caster, key);
  const shot = (at: Vec, r: number) => s.fx.push({ kind: 'skill', look, x: at.x, y: at.y, x2: caster.x, y2: caster.y, r, a: caster.facing, color, ms: 600 });
  // One sound per cast, by the ability's kind, however many bolts it throws; only the player's.
  if (caster.id === s.player) sound(s, ab.kind, caster, true);

  switch (ab.kind) {
    case 'burst': {
      const c = ab.range > 0 ? towards(caster, aim, ab.range) : { x: caster.x, y: caster.y };
      const r = ab.radius ?? 0;
      shot(c, r);
      for (const e of [...s.units]) {
        if (e.dead || e.side === caster.side || !hittable(e) || dist(e, c) > r + e.radius) continue;
        abilityHit(s, caster, e, dmg, ab, key);
        // A knock pushes champions and minions away from the centre.
        if (ab.knock && !e.dead && (e.kind === 'champion' || e.kind === 'minion')) {
          const d = Math.max(dist(e, c), 1);
          const to = clampWorld({ x: e.x + ((e.x - c.x) / d) * ab.knock, y: e.y + ((e.y - c.y) / d) * ab.knock });
          place(e, to);
        }
      }
      break;
    }
    case 'bolt': {
      const d = Math.max(dist(caster, aim), 1);
      const dir = { x: (aim.x - caster.x) / d, y: (aim.y - caster.y) / d };
      const count = ab.count ?? 1;
      const spread = ab.spread ?? 0;
      const speed = (ab.speed ?? 700) / 1000;
      for (let i = 0; i < count; i++) {
        const a = (i - (count - 1) / 2) * spread;
        const vx = Math.cos(a) * dir.x - Math.sin(a) * dir.y;
        const vy = Math.sin(a) * dir.x + Math.cos(a) * dir.y;
        s.projectiles.push({
          x: caster.x,
          y: caster.y,
          vx: vx * speed,
          vy: vy * speed,
          left: ab.range,
          side: caster.side,
          owner: caster.id,
          damage: dmg,
          width: ab.width ?? 24,
          pierce: !!ab.pierce,
          hit: [],
          color,
          stun: ab.stun ?? 0,
          slow: ab.slow ?? 0,
          pull: !!ab.pull,
          executeBelow: ab.executeBelow ?? 0,
          look,
        });
      }
      shot(caster, 0);
      break;
    }
    case 'dash': {
      const to = towards(caster, aim, ab.range);
      shot(to, ab.radius ?? 0);
      place(caster, to);
      if (ab.damage) {
        for (const e of [...s.units]) {
          if (e.dead || e.side === caster.side || !hittable(e) || dist(e, to) > (ab.radius ?? 0) + e.radius) continue;
          abilityHit(s, caster, e, dmg, ab, key);
        }
      }
      break;
    }
    case 'ally': {
      const c = ab.range > 0 ? towards(caster, aim, ab.range) : { x: caster.x, y: caster.y };
      const r = ab.radius ?? 0;
      shot(c, r);
      for (const e of s.units) {
        if (e.dead || e.kind !== 'champion' || e.side !== caster.side || dist(e, c) > r + e.radius) continue;
        if (ab.heal) e.hp = Math.min(e.maxHp, e.hp + ab.heal);
        if (ab.shield) {
          e.shield += ab.shield;
          e.shieldMs = Math.max(SHIELD_MS, ab.ms ?? 0);
        }
        if (ab.buff) addBuff(e, ab.name, ab.buff, ab.ms ?? SHIELD_MS, color, look);
      }
      break;
    }
    case 'buff': {
      if (ab.buff) addBuff(caster, ab.name, ab.buff, ab.ms ?? 3000, color, look);
      if (ab.heal) caster.hp = Math.min(caster.maxHp, caster.hp + ab.heal);
      if (ab.shield) {
        caster.shield += ab.shield;
        caster.shieldMs = Math.max(SHIELD_MS, ab.ms ?? 0);
      }
      shot(caster, 46);
      break;
    }
    case 'zone': {
      const c = towards(caster, aim, ab.range);
      const ms = ab.ms ?? 3000;
      s.zones.push({ x: c.x, y: c.y, r: ab.radius ?? 100, side: caster.side as Team, owner: caster.id, dps: abilityDamage(s, caster, ab.dps ?? 0), slow: ab.slow ?? 0, left: ms, ms, color, look });
      shot(c, ab.radius ?? 100);
      break;
    }
  }
  return true;
}

/**
 * A jungle camp is only hurt by a champion that goes for it or that it is already fighting:
 * splash, bursts and stray bolts from a fight near by pass it by (a bolt flies on through it).
 */
function campSpares(s: GameState, sourceId: number, t: Unit): boolean {
  if (t.kind !== 'camp') return false;
  const src = getUnit(s, sourceId);
  return !!src && src.kind === 'champion' && src.target !== t.id && t.lastHitBy !== sourceId;
}

/** Hurts a unit after its armor and any shield. A unit reduced to 0 health dies. Returns the health it lost. */
export function damage(s: GameState, t: Unit, amount: number, sourceId: number, how: HitHow = 'attack'): number {
  if (t.dead || amount <= 0 || !hittable(t) || invulnerable(s, t)) return 0;
  // A ward falls to a fixed number of hits, whatever they are.
  if (t.kind === 'ward') {
    t.hp -= 1;
    t.flash = 120;
    t.lastHitBy = sourceId;
    if (t.hp <= 0) kill(s, t, sourceId);
    return 1;
  }
  if (campSpares(s, sourceId, t)) return 0;
  // The siege banner, an objective's reward, makes the player's champion hit structures harder.
  if (sourceId === s.player && s.time < s.siegeUntil && (t.kind === 'tower' || t.kind === 'nexus')) amount *= SIEGE.mult;
  // The elder's blessing: its team's champions hit structures harder.
  const blessed = elderBlessed(s, getUnit(s, sourceId));
  if (blessed && (t.kind === 'tower' || t.kind === 'inhibitor' || t.kind === 'nexus')) amount *= ELDER.structMult;
  // Morrow's grudge: the Whaler hits the beast that sank his ship harder.
  if (t.kind === 'beast') amount *= 1 + (getUnit(s, sourceId)?.champ?.perk?.beastDmg ?? 0) / 100;
  let rest = ((amount * 100) / (100 + Math.max(0, armorOf(t)))) * takenMult(s, t);
  if (t.champ?.passive.tough) rest *= 1 - t.champ.passive.tough / 100;
  if (t.shield > 0) {
    const soak = Math.min(t.shield, rest);
    t.shield -= soak;
    rest -= soak;
  }
  const lost = Math.min(Math.max(0, t.hp), rest);
  t.hp -= rest;
  if (t.plates > 0 && s.time < PLATING.until) breakPlates(s, t);
  // The player's champion keeps what hurt it lately, for the death recap.
  if (t.id === s.player && lost > 0) {
    s.playerHits.push({ at: s.time, src: sourceId, how, amount: lost });
    if (s.playerHits[0].at < s.time - RECAP.windowMs) s.playerHits = s.playerHits.filter((h) => h.at >= s.time - RECAP.windowMs);
  }
  // ...and finish an enemy champion they leave nearly dead.
  if (blessed && t.kind === 'champion' && t.hp > 0 && t.hp < t.maxHp * ELDER.execute) {
    t.hp = 0;
    s.fx.push({ kind: 'ring', x: t.x, y: t.y, r: 60, color: '#ffc93d', ms: 600 });
  }
  t.flash = 120;
  t.lastHitBy = sourceId;
  // Hurting a champion draws the fire of that champion's towers, and breaks its recall.
  if (t.kind === 'champion') {
    t.recallMs = 0;
    const src = getUnit(s, sourceId);
    if (src && src.kind === 'champion') {
      src.aggroMs = TOWER.aggroMs;
      if (src.side !== t.side) t.hurtBy[src.id] = s.time;
    }
  }
  // A jungle monster that is hit wakes its whole pack.
  if (t.kind === 'camp') {
    for (const m of s.units) if (m.kind === 'camp' && m.group === t.group && !m.dead && m.lastHitBy === null) m.lastHitBy = sourceId;
  }
  if (t.hp <= 0) kill(s, t, sourceId);
  return lost;
}

/** An outer tower that lost a share of its health drops a plate for each, paying the enemy champions near it. */
function breakPlates(s: GameState, t: Unit) {
  const left = Math.max(0, Math.ceil((t.hp / t.maxHp) * PLATING.count - 1e-6));
  while (t.plates > left) {
    t.plates--;
    const near = s.units.filter((c) => c.kind === 'champion' && !c.dead && c.side !== t.side && c.side !== 'neutral' && dist(c, t) <= PLATING.share);
    s.fx.push({ kind: 'ring', x: t.x, y: t.y - 30, r: 40, color: '#f2c14e', ms: 400 });
    if (!near.length) continue;
    const gold = Math.round(PLATING.gold / near.length);
    for (const c of near) {
      c.gold += gold;
      if (c.player) s.fx.push({ kind: 'coin', x: t.x, y: t.y - 40, gold, color: '#f2c14e', ms: 900 });
    }
    sound(s, 'plate', t, near.some((c) => c.player));
    aiLog(near[0].side as Team, `breaks a plate off the ${t.lane} tower for ${gold} gold each`);
  }
}

/** Which hit an ability's look (`${championId}.${key}`) stands for: the key, or a plain attack without one. */
function hitHowOf(look: string | undefined): HitHow {
  const key = look?.split('.')[1];
  return (ABILITY_KEYS as string[]).includes(key ?? '') ? (key as AbilityKey) : 'attack';
}

/**
 * The death recap: what hurt the player's champion in its last `RECAP.windowMs`, summed by
 * attacker and hit (all minions as one), the biggest first, at most `RECAP.rows` of them.
 */
function deathRecap(s: GameState, killerId: number): DeathRecap {
  const rows: RecapRow[] = [];
  for (const h of s.playerHits) {
    if (h.at < s.time - RECAP.windowMs) continue;
    const src = getUnit(s, h.src);
    const minion = src?.kind === 'minion';
    const row = rows.find((r) => (minion ? r.kind === 'minion' : r.src === h.src) && r.how === h.how);
    if (row) row.amount += h.amount;
    else rows.push({ src: minion ? -1 : h.src, kind: src?.kind ?? 'minion', how: h.how, amount: h.amount });
  }
  rows.sort((a, b) => b.amount - a.amount);
  const total = rows.reduce((n, r) => n + r.amount, 0);
  s.playerHits = [];
  return { at: s.time, killer: killerId, total, rows: rows.slice(0, RECAP.rows) };
}

/**
 * A champion slew the river drake: its team keeps a stack of the drake's element (until it has its
 * soul), every champion of the team gets the new bonus, and the next drake is of the next element.
 */
function slayDrake(s: GameState, killer: Unit) {
  const team = killer.side as Team;
  const element = s.drakeElement;
  const stacks = s.drakeStacks[team];
  const def = DRAKES[element];
  s.drakeRounds++;
  s.drakeElement = DRAKE_ORDER[s.drakeRounds % DRAKE_ORDER.length];
  if (stacks.length >= DRAKE.soul) {
    aiLog(team, `${shortName(killer.name)} slays the ${english(def.name).toLowerCase()}`);
    return;
  }
  stacks.push(element);
  const soul = stacks.length >= DRAKE.soul;
  const bonus: BuffDef = {};
  for (const e of stacks) {
    for (const [k, v] of Object.entries(DRAKES[e].bonus) as [keyof BuffDef, number][]) (bonus as Record<string, number>)[k] = ((bonus as Record<string, number>)[k] ?? 0) + v * (soul ? 2 : 1);
  }
  for (const c of s.units) if (c.kind === 'champion' && c.side === team) c.drake = bonus;
  s.fx.push({ kind: 'ring', x: DRAKE.x, y: DRAKE.y, r: 90, color: def.color, ms: 800 });
  sound(s, 'drake', DRAKE, killer.player);
  aiLog(team, `${shortName(killer.name)} slays the ${english(def.name).toLowerCase()}${soul ? ', the team has its drake soul' : ''}`);
  const vars = { drake: text(def.name), n: stacks.length };
  notice(s, text(soul ? (team === 'blue' ? 'noticeSoulBlue' : 'noticeSoulRed') : team === 'blue' ? 'noticeDrakeBlue' : 'noticeDrakeRed', vars), def.color);
}

/** Whether a unit is a champion whose team has the elder's blessing now. */
function elderBlessed(s: GameState, u: Unit | undefined | null): boolean {
  return !!u && u.kind === 'champion' && u.side !== 'neutral' && s.elderBuff[u.side] > s.time;
}

/** Damage a unit takes is scaled by this: minions empowered by the beast take less. */
function takenMult(s: GameState, t: Unit): number {
  return t.kind === 'minion' && t.side !== 'neutral' && s.beastBuff[t.side] > s.time ? BEAST_BUFF.taken : 1;
}

/**
 * A structure that can't be hurt yet: an inhibitor while a tower of its lane stands, a Nexus while
 * all of its inhibitors stand.
 */
export function invulnerable(s: GameState, u: Unit): boolean {
  if (u.kind === 'inhibitor') return s.units.some((t) => t.kind === 'tower' && !t.dead && t.side === u.side && t.lane === u.lane);
  if (u.kind === 'nexus') return !s.units.some((t) => t.kind === 'inhibitor' && t.dead && t.side === u.side);
  return false;
}

/** Whether a team can't see a unit this tick: in the fog, in a bush or in stealth. */
export function hiddenFrom(_s: GameState, team: Unit['side'], u: Unit): boolean {
  return team !== 'neutral' && u.hidden[team];
}

/** Red's units hit harder or softer on Hard and Easy. */
function dealt(s: GameState, u: Unit, amount: number): number {
  return u.side === 'red' ? amount * s.enemyDamage : amount;
}

// ---------------------------------------------------------------------------------------------
// Each unit's turn.

/** The per-tick countdowns of a unit: swing, flash, control effects, shield, buffs and a champion's cooldowns and gold. */
function countDown(u: Unit, dt: number) {
  u.attackCd = Math.max(0, u.attackCd - dt);
  u.swing = Math.max(0, u.swing - dt);
  u.flash = Math.max(0, u.flash - dt);
  u.slowMs = Math.max(0, u.slowMs - dt);
  u.castMs = Math.max(0, u.castMs - dt);
  u.stunMs = Math.max(0, u.stunMs - dt);
  if (u.shieldMs > 0) {
    u.shieldMs -= dt;
    if (u.shieldMs <= 0) u.shield = 0;
  }
  if (u.buffs.length) {
    for (const b of u.buffs) b.ms -= dt;
    u.buffs = u.buffs.filter((b) => b.ms > 0);
  }
  if (!u.champ) return;
  for (const k of ABILITY_KEYS) u.cds[k] = Math.max(0, u.cds[k] - dt);
  for (const k of Object.keys(u.activeCds)) u.activeCds[k] = Math.max(0, u.activeCds[k] - dt);
  u.spellCd = Math.max(0, u.spellCd - dt);
  u.revealMs = Math.max(0, u.revealMs - dt);
  u.aggroMs = Math.max(0, u.aggroMs - dt);
  u.aiCastMs = Math.max(0, u.aiCastMs - dt);
  u.hasteMs = Math.max(0, u.hasteMs - dt);
  u.lullMs += dt;
  u.gold += (GOLD_PER_SEC * dt) / 1000;
}

function updateUnit(s: GameState, u: Unit, dt: number) {
  if (u.kind === 'watchstone') return;
  if (u.kind === 'ward') {
    // A ward burns out on its own in the end.
    if (!u.dead && s.time >= u.expiresAt) {
      u.dead = true;
      u.hp = 0;
    }
    u.flash = Math.max(0, u.flash - dt);
    return;
  }
  // Every countdown runs dead or alive, so a champion comes back with its cooldowns, item actives
  // and buffs run down and its passive gold earned (only a recall needs it standing).
  countDown(u, dt);
  if (u.dead) {
    if ((u.kind === 'champion' || u.kind === 'camp' || u.kind === 'beast') && s.time >= u.respawnAt) {
      if (u.kind === 'beast' && s.time >= ELDER.at && !s.beastElder) makeElder(s, u);
      revive(u);
      if (u.kind === 'beast') {
        notice(s, text(s.beastElder ? 'noticeElderAwake' : 'noticeBeastAwake'), '#f2c14e');
        sound(s, 'growl');
      }
      if (u.id === s.drake) {
        const def = DRAKES[s.drakeElement];
        notice(s, text('noticeDrakeAwake', { drake: text(def.name) }), def.color);
        sound(s, 'drakeWakes');
      }
      if (u.player) sound(s, 'respawn', undefined, true);
    } else if (u.kind === 'champion' && !u.player) {
      // A dead AI champion spends its wait at the shop, and buys back when its base is in danger.
      aiShop(u);
      aiBuyBack(s, u);
    }
    return;
  }
  if (u.champ) {
    if (u.recallMs > 0) {
      u.recallMs -= dt;
      if (u.recallMs <= 0) {
        u.recallMs = 0;
        finishRecall(s, u);
      }
    }
    if (!u.player) aiShop(u);
    const p = u.champ.passive;
    const regen = (p.regen ?? 0) + buffSum(u, 'regen');
    if (regen) u.hp = Math.min(u.maxHp, u.hp + (regen * dt) / 1000);
    // Its own Nexus heals a champion that comes home.
    if (atFountain(u)) u.hp = Math.min(u.maxHp, u.hp + (u.maxHp * FOUNTAIN.share * dt) / 1000);
    if (p.aura) {
      for (const a of s.units) {
        if (a.kind === 'champion' && !a.dead && a.side === u.side && dist(a, u) <= (p.auraRadius ?? 0)) a.hp = Math.min(a.maxHp, a.hp + (p.aura * dt) / 1000);
      }
    }
  }
  // A stunned champion or minion stands still and holds its attack.
  if (u.stunMs > 0) return;
  switch (u.kind) {
    case 'nexus':
    case 'inhibitor':
      return;
    case 'beast':
      return beastAct(s, u, dt);
    case 'tower': {
      if (u.attackCd > 0) return;
      // A tower shoots a champion who just hurt one of its own, then minions, then any champion.
      const foe =
        nearest(s, u, u.range, (e) => e.kind === 'champion' && e.aggroMs > 0) ??
        nearest(s, u, u.range, (e) => e.kind === 'minion') ??
        nearest(s, u, u.range, (e) => e.kind === 'champion');
      if (foe) attack(s, u, foe);
      return;
    }
    case 'camp': {
      const who = getUnit(s, u.lastHitBy);
      if (!who || who.dead || dist(u, who) > 500) {
        // Left alone, a monster licks its wounds.
        u.lastHitBy = null;
        u.hp = Math.min(u.maxHp, u.hp + (u.maxHp * 0.05 * dt) / 1000);
        return;
      }
      if (who.kind !== 'champion' || !stealthed(who)) {
        u.facing = Math.atan2(who.y - u.y, who.x - u.x);
        if (inRange(u, who)) attack(s, u, who);
      }
      return;
    }
  }
  if (u.player) return playerAct(s, u, dt);
  aiAct(s, u, dt);
}

function revive(u: Unit) {
  u.dead = false;
  u.hp = u.maxHp;
  u.x = u.spawnX;
  u.y = u.spawnY;
  u.target = null;
  u.moveTo = null;
  u.slowMs = 0;
  u.stunMs = 0;
  u.shield = 0;
  u.buffs = u.buffs.filter((b) => b.elixir);
  u.lastHitBy = null;
  u.hasteMs = 0;
  u.recallMs = 0;
  if (u.path) u.wp = 1;
}

function kill(s: GameState, t: Unit, killerId: number) {
  t.hp = 0;
  t.dead = true;
  t.target = null;
  t.moveTo = null;
  t.buffs = t.buffs.filter((b) => b.elixir);
  if (t.id === s.player) s.recap = deathRecap(s, killerId);
  const killer = getUnit(s, killerId);
  const champKiller = killer && killer.kind === 'champion' ? killer : null;
  switch (t.kind) {
    case 'minion':
      if (champKiller && champKiller.player) {
        // A last hit by the player: the streak grows, and a long one pays more.
        s.streak++;
        s.lastHits++;
        s.bestStreak = Math.max(s.bestStreak, s.streak);
        const gold = Math.round(MINION.gold * (s.streak >= STREAK.at ? 1 + STREAK.bonus : 1));
        champKiller.gold += gold;
        s.fx.push({ kind: 'coin', x: t.x, y: t.y, gold, color: '#f2c14e', ms: 900 });
        sound(s, 'lastHit', t, true);
        champKiller.cs++;
      } else {
        if (champKiller) {
          champKiller.gold += MINION.gold;
          champKiller.cs++;
        }
        // The minion the player could have finished fell to someone else: the streak breaks.
        if (s.lastHitMark === t.id) s.streak = 0;
      }
      for (const c of s.units) {
        if (c.kind === 'champion' && !c.dead && c.side !== t.side && c.side !== 'neutral' && dist(c, t) <= XP_RANGE) {
          gainXp(s, c, MINION.xp);
        }
      }
      break;
    case 'camp': {
      const def = CAMP_KINDS[t.campKind ?? 'boar'];
      t.respawnAt = s.time + def.respawnMs;
      if (champKiller) {
        champKiller.gold += def.gold;
        champKiller.cs++;
        gainXp(s, champKiller, def.xp);
        // A brute's slayer carries its buff.
        if (def.buff) {
          const b = BUFFS[def.buff];
          addBuff(champKiller, def.buff, b.buff, b.ms, b.color);
          s.fx.push({ kind: 'ring', x: champKiller.x, y: champKiller.y, r: 60, color: b.color, ms: 700 });
          sound(s, 'brute', champKiller, champKiller.player);
          if (champKiller.side === 'blue') notice(s, champKiller.player ? text('noticeYouTakeBuff', { buff: text(b.name) }) : text('noticeTakesBuff', { name: shortName(champKiller.name), buff: text(b.name) }), b.color);
        }
        if (t.campKind === 'drake' && champKiller.side !== 'neutral') slayDrake(s, champKiller);
        // The last of a mercenary band down: it marches for the slayer's team.
        if (t.campKind === 'merc' && champKiller.side !== 'neutral' && !s.units.some((m) => m.kind === 'camp' && !m.dead && m.group === t.group)) {
          const team = champKiller.side;
          const camp = MERC.spots.reduce((a, b) => (dist(a, t) <= dist(b, t) ? a : b));
          const lane = spawnMercs(s, team, camp);
          aiLog(team, `${shortName(champKiller.name)} hires the mercenaries, who march on the ${lane} lane`);
          notice(s, text(team === 'blue' ? 'noticeMercsBlue' : 'noticeMercsRed', { lane: text(LANE_NAME[lane]) }), SIDE_COLOR[team]);
          s.fx.push({ kind: 'ring', x: camp.x, y: camp.y, r: 80, color: SIDE_COLOR[team], ms: 700 });
          sound(s, 'mercs', camp, champKiller.player);
        }
      }
      break;
    }
    case 'beast':
      t.respawnAt = s.time + BEAST.respawnMs;
      if (champKiller && champKiller.side !== 'neutral') {
        const team = champKiller.side;
        s.beastBuff[team] = s.time + BEAST.buffMs;
        s.beastKills[team]++;
        champKiller.gold += BEAST.gold;
        gainXp(s, champKiller, BEAST.xp);
        const secs = Math.round(BEAST.buffMs / 1000);
        if (s.beastElder) {
          // The elder blesses the slayers' whole team: siege damage and an execute.
          s.elderBuff[team] = s.time + ELDER.buffMs;
          champKiller.gold += ELDER.gold;
          aiLog(team, `${shortName(champKiller.name)} slays the Elder Guardian`);
          notice(s, text(team === 'blue' ? 'noticeElderBlue' : 'noticeElderRed', { s: ELDER.buffMs / 1000 }), SIDE_COLOR[team]);
        } else {
          aiLog(team, `${shortName(champKiller.name)} slays the guardian beast`);
          notice(s, text(team === 'blue' ? 'noticeBeastBlue' : 'noticeBeastRed', { s: secs }), SIDE_COLOR[team]);
        }
      }
      s.fx.push({ kind: 'ring', x: t.x, y: t.y, r: 90, color: '#c79bff', ms: 800 });
      sound(s, 'beastSlain');
      break;
    case 'inhibitor': {
      if (champKiller) champKiller.gold += INHIBITOR.gold;
      const foe = t.side === 'blue' ? 'red' : 'blue';
      aiLog(foe, `breaks the ${t.lane} inhibitor`);
      notice(s, text(t.side === 'red' ? 'noticeRedInhibitor' : 'noticeBlueInhibitor', { lane: t.lane ? text(LANE_NAME[t.lane]) : '' }), SIDE_COLOR[foe]);
      s.fx.push({ kind: 'ring', x: t.x, y: t.y, r: 70, color: SIDE_COLOR[t.side], ms: 700 });
      sound(s, 'crash', t);
      break;
    }
    case 'ward': {
      if (champKiller) champKiller.gold += WARD.gold;
      const foe = t.side === 'blue' ? 'red' : 'blue';
      aiLog(foe, 'destroys a ward');
      if (t.side === 'blue' && !s.watch) notice(s, text('noticeWardLost'), SIDE_COLOR.red);
      s.fx.push({ kind: 'ring', x: t.x, y: t.y, r: 24, color: SIDE_COLOR[t.side], ms: 400 });
      sound(s, 'wardBreak', t);
      break;
    }
    case 'tower':
      if (champKiller) champKiller.gold += TOWER.gold;
      aiLog(t.side === 'blue' ? 'red' : 'blue', `takes a ${t.lane} tower`);
      s.fx.push({ kind: 'ring', x: t.x, y: t.y, r: 60, color: SIDE_COLOR[t.side], ms: 600 });
      sound(s, 'crash', t);
      break;
    case 'nexus':
      sound(s, 'nexus');
      s.phase = t.side === 'blue' ? 'lost' : 'won';
      s.winner = t.side === 'blue' ? 'red' : 'blue';
      break;
    case 'champion': {
      t.deaths++;
      t.recallMs = 0;
      const streak = t.killStreak;
      t.killStreak = 0;
      if (champKiller && champKiller.side !== t.side) {
        // Rook, the bounty hunter, gets more for a head with a price on it.
        const bounty = Math.round(bountyOf(streak) * (1 + (champKiller.champ?.perk?.bountyGold ?? 0) / 100));
        champKiller.gold += KILL.gold + bounty;
        // A team that is behind gets more for each kill, to climb back.
        const comeback = behind(s, champKiller.side as Team, COMEBACK.gap);
        if (comeback) {
          champKiller.gold += COMEBACK.gold;
          gainXp(s, champKiller, COMEBACK.xp);
          aiLog(champKiller.side as Team, `${shortName(champKiller.name)} earns a comeback bounty`);
          if (champKiller.player) {
            notice(s, text('noticeComeback', { gold: COMEBACK.gold }), '#9fd8ff');
            sound(s, 'comeback', undefined, true);
          }
        }
        // The first kill of the match pays extra.
        const first = !s.firstBlood;
        if (first) {
          s.firstBlood = true;
          champKiller.gold += FIRST_BLOOD.gold;
          sound(s, 'firstBlood', undefined, champKiller.player);
          aiLog(champKiller.side as Team, `${shortName(champKiller.name)} draws first blood`);
        }
        champKiller.kills++;
        champKiller.killStreak++;
        gainXp(s, champKiller, KILL.xp);
        const side = champKiller.side as Team;
        aiLog(side, `${shortName(champKiller.name)} slays ${shortName(t.name)}${bounty ? ` and claims a ${bounty} gold bounty` : ''}`);
        const slain = champKiller.player
          ? text('noticeYouSlew', { victim: shortName(t.name) })
          : t.player
            ? text('noticeSlewYou', { killer: shortName(champKiller.name) })
            : text('noticeSlew', { killer: shortName(champKiller.name), victim: shortName(t.name) });
        notice(s, bounty ? text('noticeBountyClaimed', { line: slain, gold: bounty }) : slain, SIDE_COLOR[side]);
        if (first) notice(s, text('noticeFirstBlood', { line: slain, gold: FIRST_BLOOD.gold }), '#f2c14e');
        // Three kills in a row put a price on the killer's head, and every kill after raises it.
        const price = bountyOf(champKiller.killStreak);
        if (price || bounty) sound(s, 'streak', undefined, champKiller.player);
        if (price) {
          aiLog(side, `${shortName(champKiller.name)} is on a ${champKiller.killStreak} kill streak: a ${price} gold bounty`);
          notice(s, champKiller.player ? text('noticeYourStreak', { n: champKiller.killStreak, gold: price }) : text('noticeStreak', { name: shortName(champKiller.name), n: champKiller.killStreak, gold: price }), '#f2c14e');
        }
      }
      // Every other enemy champion that hurt it lately gets an assist.
      for (const [id, at] of Object.entries(t.hurtBy)) {
        const helper = getUnit(s, Number(id));
        if (!helper || helper === champKiller || helper.side === t.side || s.time - at > ASSIST.windowMs) continue;
        helper.assists++;
        helper.gold += ASSIST.gold;
        if (helper.player) s.fx.push({ kind: 'coin', x: t.x, y: t.y - 24, gold: ASSIST.gold, color: '#9fd8ff', ms: 900 });
      }
      t.hurtBy = {};
      t.respawnAt = s.time + RESPAWN_BASE_MS + t.level * RESPAWN_PER_LEVEL_MS;
      s.fx.push({ kind: 'ring', x: t.x, y: t.y, r: 50, color: SIDE_COLOR[t.side], ms: 500 });
      if (t.player) sound(s, 'youDie', undefined, true);
      else sound(s, 'slain', t, champKiller?.player);
      break;
    }
  }
}

function gainXp(s: GameState, c: Unit, amount: number) {
  c.xp += amount;
  const level = Math.min(levelFor(c.xp), MAX_LEVEL);
  if (level > c.level) {
    for (let l = c.level + 1; l <= level && c.champ; l++) {
      if (ULT_RANK_LEVELS.includes(l)) {
        const r = c.champ.abilities.find((a) => a.key === 'R')!;
        if (c.player) notice(s, text('noticeRankUp', { level: l, ability: text(r.name) }), '#f2c14e');
        aiLog(c.side, `${shortName(c.name)} ranks up ${english(r.name)} at level ${l}`);
        continue;
      }
      const pair = upgradePairAt(c.champ.id, l);
      if (!pair) continue;
      // The player chooses on the cards (a third one where its class's mastery reaches this
      // level); an AI champion takes the one it rates higher.
      if (c.player) {
        const third = UPGRADE_LEVELS.indexOf(l) < s.mastery;
        const options = offerFor(c.champ.id, l, c.upgrades, third ? 3 : 2);
        if (options.length) s.upgradeOffers.push({ level: l, options });
      } else {
        const up = aiRate(pair[1]) > aiRate(pair[0]) ? pair[1] : pair[0];
        c.upgrades.push(up.id);
        aiLog(c.side, `${shortName(c.name)} takes ${english(up.name)} at level ${l}`);
      }
    }
    c.level = level;
    refreshStats(c);
    s.fx.push({ kind: 'ring', x: c.x, y: c.y, r: 40, color: '#ffffff', ms: 500 });
    if (c.player) sound(s, 'levelUp', undefined, true);
  }
}

/** How much an AI champion likes an upgrade: stuns and damage first, then the rest. */
function aiRate(u: UpgradeDef): number {
  return (u.damage ?? 0) + (u.heal ?? 0) + (u.shield ?? 0) + (u.stun ? 45 : 0) + (u.slow ? 25 : 0) + (u.count ? 35 : 0) + (u.radius ?? 0) * 0.8 + (u.range ?? 0) * 0.5 + (u.ms ?? 0) * 0.6 - (u.cd ?? 0);
}

/** Raises a sound for the view. Capped, so a match run with no view to drain it never grows it. */
function sound(s: GameState, id: SoundId, at?: Vec, mine = false) {
  if (s.sounds.length >= 64) return;
  s.sounds.push(at ? { id, x: at.x, y: at.y, mine } : { id, mine });
}

function notice(s: GameState, text: string, color: string) {
  s.notices.push({ text, color, at: s.time });
  if (s.notices.length > 3) s.notices.shift();
}

/** Plays a player's champion: walk to a point, attack a clicked unit, or hit whatever is in reach. */
function playerAct(s: GameState, u: Unit, dt: number) {
  // A recalling champion stands and waits; a click breaks the channel.
  if (u.recallMs > 0) return;
  if (u.moveTo) {
    const d = dist(u, u.moveTo);
    // Walkers can crowd the spot: a champion that gets no closer for a while near it stops there.
    u.moveStuckMs = d > u.lastMoveDist - (speedOf(u) * dt) / 4000 ? u.moveStuckMs + dt : 0;
    u.lastMoveDist = d;
    if (d < 4 || (u.moveStuckMs > STUCK.ms && d < STUCK.near)) u.moveTo = null;
    else {
      moveToward(u, u.moveTo, dt);
      return;
    }
  }
  const t = getUnit(s, u.target);
  // A target that slipped into a bush or the fog is lost.
  if (t && !t.dead && t.side !== u.side && !hiddenFrom(s, u.side, t)) {
    if (inRange(u, t)) attack(s, u, t);
    else moveToward(u, t, dt);
    return;
  }
  u.target = null;
  // Standing in stealth, the player's champion waits for a click before it strikes.
  if (stealthed(u)) return;
  const near = nearest(s, u, u.range, (e) => e.kind !== 'camp' && e.kind !== 'beast');
  if (near) attack(s, u, near);
}

/** The AI for allies, enemies and minions: fight what is in reach, otherwise walk the lane. */
function aiAct(s: GameState, u: Unit, dt: number) {
  if (u.kind === 'champion') {
    // A hurt champion drinks its flask, and one carrying a ward plants it at a spot it passes.
    if (u.hp < u.maxHp * 0.4) useActive(s, u, 'flask', u);
    aiWard(s, u);
    aiSpell(s, u);
    if (championPlan(s, u, dt)) return;
  }
  const reach = u.kind === 'champion' ? CHAMP_AGGRO : MINION.aggro;
  const t =
    nearest(s, u, reach, (e) => e.kind === 'champion') ??
    nearest(s, u, reach, (e) => e.kind === 'minion') ??
    nearest(s, u, u.range, (e) => e.kind === 'tower' || e.kind === 'nexus' || e.kind === 'inhibitor') ??
    // An enemy ward in the way is knocked down.
    (u.kind === 'champion' ? nearest(s, u, 220, (e) => e.kind === 'ward') : null);
  u.target = t ? t.id : null;
  if (t && u.kind === 'champion') castAi(s, u, t);
  // A ranged champion steps back from a melee champion between its shots.
  if (t && u.kind === 'champion' && u.range >= KITE.range && t.kind === 'champion' && t.range < KITE.range && u.attackCd > KITE.minCd && dist(u, t) < t.range + KITE.margin) {
    const d = Math.max(dist(u, t), 1);
    moveToward(u, clampWorld({ x: u.x + ((u.x - t.x) / d) * 60, y: u.y + ((u.y - t.y) / d) * 60 }), dt);
    return;
  }
  if (t) {
    if (inRange(u, t)) attack(s, u, t);
    else moveToward(u, t, dt);
    return;
  }
  moveToward(u, nextWaypoint(u), dt);
}

/**
 * An AI champion's plan beyond its lane, before the lane fight: fall back with its allies when hurt
 * or outnumbered, fight over the guardian beast, roam to gang up on a weak enemy, or go into the
 * jungle for a buff or a watchstone. Returns true when the plan moved the champion this tick.
 */
function championPlan(s: GameState, u: Unit, dt: number): boolean {
  // Recalling: stand still until it goes through, or damage breaks it.
  if (u.recallMs > 0) {
    u.target = null;
    return true;
  }
  const home = BASE[u.side as Team];
  const foeNear = (r: number) => nearest(s, u, r, (e) => e.kind === 'champion');
  // Home and hurt: heal up at the fountain (the shop happens on its own) before walking out again.
  if (atFountain(u) && u.hp < u.maxHp * 0.9 && !foeNear(CHAMP_AGGRO)) {
    u.target = null;
    return true;
  }
  if (s.time < u.retreatUntil) {
    u.target = null;
    moveToward(u, fallbackPoint(s, u), dt);
    return true;
  }
  if (nearest(s, u, RETREAT.look, (e) => e.kind === 'champion')) {
    const foes = s.units.filter((e) => e.kind === 'champion' && !e.dead && e.side !== u.side && !hiddenFrom(s, u.side, e) && dist(e, u) <= RETREAT.look).length;
    const friends = s.units.filter((a) => a.kind === 'champion' && !a.dead && a.side === u.side && dist(a, u) <= RETREAT.look).length;
    const low = u.hp < u.maxHp * RETREAT.hp;
    const outnumbered = foes >= friends + RETREAT.outnumber;
    if (low || outnumbered) {
      // Hurt allies near by (or all of them, when outnumbered) fall back with it.
      u.retreatUntil = s.time + RETREAT.ms;
      if (outnumbered) aiLog(u.side, `${shortName(u.name)} calls a retreat, ${foes} against ${friends}`);
      // On blue's side the call shows on the map, so the player sees the danger too.
      if (outnumbered && u.side === 'blue' && !s.pings.some((p) => p.kind === 'danger' && dist(p, u) < PING.near && s.time - p.at < PING.showMs)) {
        s.pings.push({ kind: 'danger', x: u.x, y: u.y, side: 'blue', at: s.time });
        sound(s, 'ping', u);
      }
      for (const a of s.units) {
        if (a === u || a.kind !== 'champion' || a.player || a.dead || a.side !== u.side || dist(a, u) > RETREAT.call) continue;
        if (outnumbered || a.hp < a.maxHp * 0.5) a.retreatUntil = s.time + RETREAT.ms;
      }
      u.target = null;
      // A champion with an escape uses it on the way out.
      for (const key of ABILITY_KEYS) {
        const ab = abilityFor(u, key);
        if (!ab || u.cds[key] > 0 || u.level < ab.level) continue;
        if ((ab.kind === 'dash' && !ab.damage) || (ab.kind === 'buff' && ab.buff?.stealth)) {
          const home = fallbackPoint(s, u);
          if (cast(s, u, key, home)) break;
        }
      }
      moveToward(u, fallbackPoint(s, u), dt);
      return true;
    }
  }
  // Far from home with no enemy about, a champion that is low, or rich with something to buy, goes home.
  if (s.time - u.lastRecallAt >= RECALL.aiEvery && u.pingGoal === null && !s.contesters.includes(u.id) && dist(u, home) > FOUNTAIN.radius + 300 && !foeNear(RECALL.aiLook)) {
    const low = u.hp < u.maxHp * RECALL.aiLow;
    const next = nextBuy(u);
    const rich = next !== null && u.gold >= Math.max(RECALL.rich, priceFor(u, next));
    if ((low || rich) && startRecall(s, u)) {
      aiLog(u.side, `${shortName(u.name)} recalls, ${low ? 'hurt' : `to buy the ${english(next!.name)}`}`);
      return true;
    }
  }
  // A ping's errand: hit the enemy it marked, else walk to its point and wait there.
  if (u.pingGoal !== null) {
    const mark = u.pingTarget !== null ? getUnit(s, u.pingTarget) : null;
    if (s.time >= u.pingUntil || (u.pingTarget !== null && (!mark || mark.dead || hiddenFrom(s, u.side, mark)))) {
      u.pingGoal = null;
      u.pingTarget = null;
    } else if (mark && !invulnerable(s, mark)) {
      u.target = mark.id;
      castAi(s, u, mark);
      if (inRange(u, mark)) attack(s, u, mark);
      else moveToward(u, mark, dt);
      return true;
    } else if (!foeNear(CHAMP_AGGRO)) {
      u.target = null;
      if (dist(u, u.pingGoal) > 60) moveToward(u, u.pingGoal, dt);
      return true;
    }
  }
  // An enemy champion in reach: the lane fight below handles it.
  if (foeNear(CHAMP_AGGRO)) return false;
  const rune = runeFor(s, u);
  if (rune) {
    u.target = null;
    moveToward(u, rune, dt);
    return true;
  }
  const beast = s.contesters.includes(u.id) ? getUnit(s, s.beast) : null;
  if (beast && !beast.dead) {
    u.target = beast.id;
    castAi(s, u, beast);
    if (inRange(u, beast)) attack(s, u, beast);
    else moveToward(u, beast, dt);
    return true;
  }
  if (u.gankTarget !== null) {
    const prey = getUnit(s, u.gankTarget);
    if (!prey || prey.dead || s.time >= u.gankUntil || hiddenFrom(s, u.side, prey)) u.gankTarget = null;
    else {
      u.target = null;
      moveToward(u, prey, dt);
      return true;
    }
  }
  if (u.jungleTarget !== null) {
    const goal = getUnit(s, u.jungleTarget);
    const done = !goal || s.time >= u.jungleUntil || (goal.kind === 'camp' ? goal.dead : goal.side === u.side);
    if (done) u.jungleTarget = null;
    else if (goal.kind === 'camp') {
      // A pack fights as one: hit whichever of it is nearest, the leader last.
      const pack = s.units.filter((m) => m.kind === 'camp' && !m.dead && m.group === goal.group);
      const t = pack.sort((a, b) => dist(a, u) - dist(b, u))[0] ?? goal;
      u.target = t.id;
      castAi(s, u, t);
      if (inRange(u, t)) attack(s, u, t);
      else moveToward(u, t, dt);
      return true;
    } else {
      u.target = null;
      if (dist(u, goal) > WATCH.radius * 0.6) moveToward(u, goal, dt);
      return true;
    }
  }
  return false;
}

/** Where a falling-back champion heads: the nearest of its own towers behind it, or its Nexus. */
function fallbackPoint(s: GameState, u: Unit): Vec {
  const home = BASE[u.side as Team];
  const behind = s.units.filter((t) => t.kind === 'tower' && !t.dead && t.side === u.side && dist(t, home) < dist(u, home) - 60);
  return closest(behind, u) ?? home;
}

/** Whether an AI champion is free for a team plan: healthy, not falling back, not on another plan. */
function free(s: GameState, u: Unit, minHp: number): boolean {
  return u.kind === 'champion' && !u.player && !u.dead && u.recallMs <= 0 && u.hp >= u.maxHp * minHp && s.time >= u.retreatUntil && u.gankTarget === null && u.jungleTarget === null && u.pingGoal === null;
}

/** The next item on an AI champion's build that it doesn't own yet, or null when the build is done. */
function nextBuy(u: Unit): ItemDef | null {
  const plan = AI_BUILDS[(u.champ && AI_BUILD_FOR[u.champ.role]) ?? 'fighter'];
  for (const id of plan) {
    if (u.items.includes(id)) continue;
    // A part is done with once the item it builds into is owned.
    if (ITEMS.some((it) => it.from?.includes(id) && u.items.includes(it.id))) continue;
    return ITEMS.find((it) => it.id === id) ?? null;
  }
  return null;
}

/** An AI champion at home or dead buys the next item of its build it can pay for, else an elixir once the build is done, else a ward when it carries none. */
function aiShop(u: Unit) {
  if (!u.champ || u.player || (!u.dead && !atShop(u))) return;
  const next = nextBuy(u);
  if (next && u.gold >= priceFor(u, next) && buy(u, next.id)) {
    aiLog(u.side, `${shortName(u.name)} buys the ${english(next.name)}`);
    return;
  }
  // With the build done, spare gold goes on an elixir for the next push.
  const elixir = ITEMS.find((it) => it.id === AI_ELIXIR[(u.champ && AI_BUILD_FOR[u.champ.role]) ?? 'fighter']);
  if (!next && elixir && !u.buffs.some((b) => b.elixir) && u.gold >= elixir.cost + ELIXIR.aiSpare && buy(u, elixir.id)) {
    aiLog(u.side, `${shortName(u.name)} drinks a ${english(elixir.name)}`);
    return;
  }
  if (u.wards === 0 && buy(u, 'ward')) aiLog(u.side, `${shortName(u.name)} buys a ward`);
}

/** A dead AI champion buys back when an enemy champion stands near its Nexus and it has time left to wait. */
function aiBuyBack(s: GameState, u: Unit) {
  if (s.time < u.buybackReadyAt || u.gold < buybackCost(u) || u.respawnAt - s.time < 3000) return;
  const home = BASE[u.side as Team];
  const threat = s.units.some((e) => e.kind === 'champion' && !e.dead && e.side !== u.side && e.side !== 'neutral' && dist(e, home) <= BUYBACK.aiThreat);
  if (threat) buyBack(s, u);
}

/** An AI champion carrying a ward plants it at a spot it passes that its team has no ward at. */
function aiWard(s: GameState, u: Unit) {
  if (u.wards <= 0 || u.recallMs > 0) return;
  for (const spot of WARD_SPOTS) {
    if (dist(u, spot) > WARD_AI.reach) continue;
    if (s.units.some((w) => w.kind === 'ward' && !w.dead && w.side === u.side && dist(w, spot) < WARD_AI.taken)) continue;
    if (plantWard(s, u, spot)) aiLog(u.side, `${shortName(u.name)} wards ${spot.x === BEAST.x && spot.y === BEAST.y ? "the beast's pit" : 'the river'}`);
    return;
  }
}

/** Each tick, picks the AI champions of each team that go for the beast while it is awake. */
function updateContesters(s: GameState) {
  const beast = getUnit(s, s.beast);
  if (!beast || beast.dead) {
    s.contesters = [];
    return;
  }
  const next: number[] = [];
  for (const team of TEAMS) {
    // Those already on their way stay on it until badly hurt; the nearest healthy ones fill up.
    const mine = s.contesters.map((id) => getUnit(s, id)).filter((u): u is Unit => !!u && u.side === team && free(s, u, 0.3));
    const fresh = s.units
      .filter((u) => u.side === team && free(s, u, 0.5) && !mine.includes(u))
      .sort((a, b) => dist(a, beast) - dist(b, beast) || a.id - b.id);
    next.push(...[...mine, ...fresh].slice(0, BEAST_CONTESTERS).map((u) => u.id));
  }
  s.contesters = next;
}

/** Now and then each team sends one AI champion from another lane to gang up on the weakest enemy. */
function updateGanks(s: GameState) {
  if (s.time < s.nextGank) return;
  // While a champion carries a bounty, the hunts come twice as often.
  const hunted = s.units.some((u) => u.kind === 'champion' && !u.dead && bountyOf(u.killStreak) > 0);
  s.nextGank = s.time + (hunted ? GANK.every / 2 : GANK.every);
  for (const team of TEAMS) {
    // The biggest bounty in sight first, then the weakest.
    const prey = s.units
      .filter((u) => u.kind === 'champion' && !u.dead && u.side !== team && !hiddenFrom(s, team, u))
      .sort((a, b) => bountyOf(b.killStreak) - bountyOf(a.killStreak) || a.hp / a.maxHp - b.hp / b.maxHp || a.id - b.id)[0];
    if (!prey) continue;
    const hunter = s.units
      .filter((u) => u.side === team && free(s, u, GANK.minHp) && !s.contesters.includes(u.id) && dist(u, prey) > GANK.from)
      .sort((a, b) => dist(a, prey) - dist(b, prey) || a.id - b.id)[0];
    if (!hunter) continue;
    hunter.gankTarget = prey.id;
    hunter.gankUntil = s.time + GANK.ms;
    const lane = laneNear(prey);
    const price = bountyOf(prey.killStreak);
    aiLog(team, `${shortName(hunter.name)} roams to the ${lane} lane after ${shortName(prey.name)}${price ? ` and its ${price} gold bounty` : ''}`);
    const roams = { name: shortName(hunter.name), lane: text(LANE_NAME[lane]) };
    if (team === 'red') notice(s, prey.player ? text('noticeComingForYou', roams) : text('noticeRedRoams', roams), SIDE_COLOR.red);
    else notice(s, text('noticeBlueRoams', roams), SIDE_COLOR.blue);
  }
}

/** Whether a point is on a team's half of the map (the river splits the halves). */
function ownHalf(team: Team, p: Vec): boolean {
  return team === 'blue' ? p.y > p.x : p.y < p.x;
}

/** River runes: new ones every `RUNE.every`, taken by the first champion to reach one. */
function updateRunes(s: GameState) {
  if (s.time >= s.nextRune) {
    s.nextRune = s.time + RUNE.every;
    const round = s.runeRounds++;
    s.runes = RUNE.spots.map((p, i) => ({ kind: RUNE_ORDER[(round + i * 2) % RUNE_ORDER.length], x: p.x, y: p.y }));
    aiLog('blue', `runes appear: ${s.runes.map((r) => r!.kind).join(' and ')}`);
    notice(s, text('noticeRunes'), '#9fd8ff');
    sound(s, 'rune');
  }
  s.runes.forEach((r, i) => {
    if (!r) return;
    const taker = s.units.find((u) => u.kind === 'champion' && !u.dead && dist(u, r) <= RUNE.pick);
    if (!taker) return;
    s.runes[i] = null;
    const def = RUNES[r.kind];
    if (def.buff && def.ms) addBuff(taker, def.name, def.buff, def.ms, def.color);
    if (def.gold) {
      taker.gold += def.gold;
      for (const a of s.units) if (a !== taker && a.kind === 'champion' && a.side === taker.side) a.gold += def.teamGold ?? 0;
      if (taker.player) s.fx.push({ kind: 'coin', x: r.x, y: r.y, gold: def.gold, color: def.color, ms: 900 });
    }
    s.fx.push({ kind: 'ring', x: r.x, y: r.y, r: 50, color: def.color, ms: 600 });
    sound(s, 'runeTaken', r, taker.player);
    aiLog(taker.side as Team, `${shortName(taker.name)} takes the ${r.kind} rune`);
    const rune = text(def.name);
    if (taker.player) notice(s, text('noticeRuneYou', { rune }), def.color);
    else if (taker.side === 'blue') notice(s, text('noticeRuneAlly', { name: shortName(taker.name), rune }), def.color);
    else if (!hiddenFrom(s, 'blue', taker)) notice(s, text('noticeRuneRed', { name: shortName(taker.name), rune }), SIDE_COLOR.red);
  });
}

/** The rune an AI champion goes for: one within reach that it is its team's nearest AI champion to. */
function runeFor(s: GameState, u: Unit): Vec | null {
  if (u.player || u.hp < u.maxHp * RUNE.aiMinHp) return null;
  for (const r of s.runes) {
    if (!r || dist(u, r) > RUNE.aiReach) continue;
    const closer = s.units.some((a) => a !== u && a.kind === 'champion' && !a.player && !a.dead && a.side === u.side && dist(a, r) < dist(u, r));
    if (!closer) return r;
  }
  return null;
}

/** Now and then each team sends one AI champion for a jungle buff on its half, or a watchstone it lacks. */
function updateJungle(s: GameState) {
  if (s.time < s.nextJungle) return;
  s.nextJungle = s.time + JUNGLE.every;
  const drake = getUnit(s, s.drake);
  for (const team of TEAMS) {
    // An awake drake draws a pair of champions from each team that can still stack it.
    if (drake && !drake.dead && s.drakeStacks[team].length < DRAKE.soul) {
      const hunters = s.units
        .filter((u) => u.side === team && free(s, u, DRAKE.aiMinHp) && !s.contesters.includes(u.id))
        .sort((a, b) => dist(a, drake) - dist(b, drake) || a.id - b.id)
        .slice(0, DRAKE.ai);
      for (const u of hunters) {
        u.jungleTarget = drake.id;
        u.jungleUntil = s.time + JUNGLE.ms;
      }
      if (hunters.length) {
        aiLog(team, `${hunters.map((u) => shortName(u.name)).join(' and ')} go for the ${english(DRAKES[s.drakeElement].name).toLowerCase()}`);
        continue;
      }
    }
    const buffs = s.units.filter((u) => u.kind === 'camp' && !u.dead && (u.campKind === 'ember' || u.campKind === 'moss') && ownHalf(team, u));
    const stones = s.units.filter((u) => u.kind === 'watchstone' && u.side !== team);
    // A mercenary band on the team's own half is worth the trip as much as a buff.
    const mercs = s.units.filter((u) => u.kind === 'camp' && !u.dead && u.campKind === 'merc' && u.group === u.id && ownHalf(team, u));
    const goals = buffs.length || mercs.length ? [...buffs, ...mercs] : stones;
    let best: { u: Unit; goal: Unit; d: number } | null = null;
    for (const u of s.units) {
      if (u.side !== team || !free(s, u, JUNGLE.minHp) || s.contesters.includes(u.id)) continue;
      for (const goal of goals) {
        const d = dist(u, goal);
        if (!best || d < best.d) best = { u, goal, d };
      }
    }
    if (!best) continue;
    best.u.jungleTarget = best.goal.id;
    best.u.jungleUntil = s.time + JUNGLE.ms;
    const goal = best.goal;
    aiLog(team, `${shortName(best.u.name)} heads into the jungle for ${goal.kind === 'camp' ? `the ${english(CAMP_KINDS[goal.campKind ?? 'boar'].name).toLowerCase()}` : 'a watchstone'}`);
  }
}

/** Champions standing by a watchstone take it for their team when no enemy champion stands there too. */
function updateWatchstones(s: GameState, dt: number) {
  for (const w of s.units) {
    if (w.kind !== 'watchstone') continue;
    const near = new Set<Team>();
    // Kaida, a watchstone keeper, takes one faster: the fastest champion there sets the pace.
    let rate = 1;
    for (const c of s.units) {
      if (c.kind !== 'champion' || c.dead || dist(c, w) > WATCH.radius) continue;
      near.add(c.side as Team);
      rate = Math.max(rate, 1 + (c.champ?.perk?.captureRate ?? 0) / 100);
    }
    if (near.size !== 1) {
      // Nobody there drops the progress; both teams there hold it where it is.
      if (near.size === 0) w.capture = null;
      continue;
    }
    const team = [...near][0];
    if (w.side === team) {
      w.capture = null;
      continue;
    }
    if (!w.capture || w.capture.team !== team) w.capture = { team, ms: 0 };
    w.capture.ms += dt * rate;
    if (w.capture.ms >= WATCH.captureMs) {
      w.side = team;
      w.capture = null;
      s.fx.push({ kind: 'ring', x: w.x, y: w.y, r: 90, color: SIDE_COLOR[team], ms: 700 });
      notice(s, text(team === 'blue' ? 'noticeWatchstoneBlue' : 'noticeWatchstoneRed'), SIDE_COLOR[team]);
      sound(s, 'watchstone');
      aiLog(team, 'takes a watchstone');
    }
  }
}

/** The XP of a team's champions together. */
function teamXp(s: GameState, team: Team): number {
  return s.units.reduce((n, u) => (u.kind === 'champion' && u.side === team ? n + u.xp : n), 0);
}
/** Whether a team's champions have `gap` (a share) less XP between them than the other team's. */
export function behind(s: GameState, team: Team, gap: number): boolean {
  return teamXp(s, team) < teamXp(s, team === 'blue' ? 'red' : 'blue') * (1 - gap);
}
/** How many more towers and inhibitors a team has lost than the other. */
function structsBehind(s: GameState, team: Team): number {
  let n = 0;
  for (const u of s.units) if (u.dead && (u.kind === 'tower' || u.kind === 'inhibitor')) n += u.side === team ? 1 : -1;
  return n;
}
/** Whether an AI champion votes to give up: its team is behind on XP or on structures. */
function votesYes(s: GameState, team: Team): boolean {
  return behind(s, team, COMEBACK.gap) || structsBehind(s, team) >= SURRENDER.structs;
}

/** A team gives up: the other wins, as if the Nexus fell. */
function surrender(s: GameState, team: Team) {
  s.surrendered = team;
  s.phase = team === 'blue' ? 'lost' : 'won';
  s.winner = team === 'blue' ? 'red' : 'blue';
  aiLog(team, 'surrenders');
  sound(s, 'nexus');
}

/**
 * The player calls a surrender vote for blue. Returns false when it is too early or a vote was
 * called lately. Each ally votes by `votesYes`; the player votes yes.
 */
export function callSurrender(s: GameState): boolean {
  if (s.phase !== 'playing' || s.watch || s.time < s.voteReadyAt) return false;
  const allies = s.units.filter((u) => u.kind === 'champion' && u.side === 'blue' && u.id !== s.player);
  const yes = 1 + (votesYes(s, 'blue') ? allies.length : 0);
  const of = allies.length + 1;
  s.vote = { yes, of, at: s.time };
  s.voteReadyAt = s.time + SURRENDER.cd;
  sound(s, 'vote', undefined, true);
  if (yes / of >= SURRENDER.pass) surrender(s, 'blue');
  else notice(s, text('noticeVoteFails', { yes, of }), '#f2c14e');
  return true;
}

/** From the surrender time on, every `SURRENDER.cd` each AI team that is far behind gives up. */
function updateSurrender(s: GameState) {
  if (s.time < s.nextSurrender) return;
  s.nextSurrender = s.time + SURRENDER.cd;
  for (const team of (s.watch ? TEAMS : ['red']) as Team[]) {
    if (s.phase !== 'playing') return;
    if (behind(s, team, SURRENDER.aiGap) && structsBehind(s, team) >= SURRENDER.structs) surrender(s, team);
  }
}

/**
 * How dark it is at a time of the match: 0 by day, 1 at full night, in between at dusk and dawn
 * (the last `DAYNIGHT.fade` of the day and of the night).
 */
export function nightness(time: number): number {
  const { day, night, fade } = DAYNIGHT;
  const p = time % (day + night);
  if (p < day - fade) return 0;
  if (p < day) return (p - (day - fade)) / fade;
  if (p < day + night - fade) return 1;
  return 1 - (p - (day + night - fade)) / fade;
}

/** How far a unit sees at `dark` (from `nightness`), or 0 if it gives its team no sight. */
function sightOf(u: Unit, dark: number): number {
  switch (u.kind) {
    case 'champion':
      return SIGHT.champion * (1 - (1 - DAYNIGHT.sight) * dark);
    case 'minion':
    case 'tower':
    case 'inhibitor':
    case 'nexus':
    case 'ward':
      return SIGHT[u.kind];
    case 'watchstone':
      return u.side === 'neutral' ? 0 : SIGHT.watchstone;
    default:
      return 0;
  }
}

/** The units that give a team sight, with how far each sees. */
export function viewers(s: GameState, team: Team): { x: number; y: number; r: number }[] {
  const out: { x: number; y: number; r: number }[] = [];
  const dark = nightness(s.time);
  for (const v of s.units) {
    if (v.dead || v.side !== team) continue;
    const r = sightOf(v, dark);
    if (r > 0) out.push({ x: v.x, y: v.y, r });
  }
  return out;
}

/**
 * Works out what each team can't see: units outside the sight of all of its units (the fog of
 * war), champions in a bush with no enemy in or by it, and champions in stealth with no enemy right
 * next to them. Structures and watchstones are always seen.
 */
function updateVision(s: GameState) {
  for (const team of TEAMS) {
    const eyes = viewers(s, team);
    const close = s.units.filter((v) => !v.dead && v.side === team && (v.kind === 'champion' || v.kind === 'minion' || v.kind === 'tower'));
    const wards = s.units.filter((v) => !v.dead && v.side === team && v.kind === 'ward');
    for (const c of s.units) {
      if (c.dead || c.side === team || c.kind === 'tower' || c.kind === 'inhibitor' || c.kind === 'nexus' || c.kind === 'watchstone') {
        c.hidden[team] = false;
        continue;
      }
      let seen = eyes.some((v) => (v.x - c.x) ** 2 + (v.y - c.y) ** 2 <= v.r * v.r);
      if (seen && c.kind === 'champion') {
        if (stealthed(c)) seen = close.some((v) => dist(v, c) <= BUSH_REVEAL);
        else if (c.revealMs <= 0) {
          const bush = bushAt(c);
          // A ward's eye sees into the grass.
          if (bush >= 0) seen = close.some((v) => dist(v, c) <= BUSH_REVEAL || bushAt(v) === bush) || wards.some((w) => dist(w, c) <= SIGHT.ward);
        }
      }
      c.hidden[team] = !seen;
    }
  }
}

/** The beast's elder form, for good: more health and harder blows. */
function makeElder(s: GameState, u: Unit) {
  s.beastElder = true;
  u.maxHp = BEAST.hp * ELDER.hpMult;
  u.dmg = BEAST.dmg * ELDER.dmgMult;
  aiLog('blue', 'The guardian beast is now the Elder Guardian');
}

/** The guardian beast: claws whoever hurt it last (and those beside them), hurls rocks at range, and heals when left alone. */
function beastAct(s: GameState, u: Unit, dt: number) {
  // An awake beast that nobody is fighting grows into the elder form when its time comes.
  if (!s.beastElder && s.time >= ELDER.at && u.lastHitBy === null && u.hp >= u.maxHp) {
    makeElder(s, u);
    u.hp = u.maxHp;
    notice(s, text('noticeElderGrows'), '#f2c14e');
    sound(s, 'growl');
  }
  const who = getUnit(s, u.lastHitBy);
  if (!who || who.dead || dist(who, u) > BEAST.leash) {
    u.lastHitBy = null;
    u.hp = Math.min(u.maxHp, u.hp + (BEAST.regenPerSec * dt) / 1000);
    return;
  }
  if (u.attackCd > 0) return;
  if (inRange(u, who)) {
    attack(s, u, who);
    for (const e of s.units) {
      if (e === who || e.dead || e.side === 'neutral' || (e.kind !== 'champion' && e.kind !== 'minion') || dist(e, who) > BEAST.splash) continue;
      damage(s, e, u.dmg * 0.6, u.id);
    }
    s.fx.push({ kind: 'ring', x: who.x, y: who.y, r: BEAST.splash, color: '#c79bff', ms: 300 });
    return;
  }
  // Out of reach: a hurled rock.
  u.attackCd = u.attackMs;
  u.swing = 180;
  u.facing = Math.atan2(who.y - u.y, who.x - u.x);
  const d = Math.max(dist(u, who), 1);
  const speed = 0.6;
  s.projectiles.push({
    x: u.x,
    y: u.y,
    vx: ((who.x - u.x) / d) * speed,
    vy: ((who.y - u.y) / d) * speed,
    left: d + 40,
    side: 'neutral',
    owner: u.id,
    damage: u.dmg,
    width: 28,
    pierce: false,
    hit: [],
    color: '#b98a5a',
    stun: 0,
    slow: 0,
    pull: false,
    executeBelow: 0,
  });
}

/** How long an AI champion waits between two abilities, in ms. */
const AI_CAST_GAP = 800;

/** An AI champion uses an ability when it has a clear use for it. */
function castAi(s: GameState, u: Unit, t: Unit) {
  // One ability at a time, as a player would, rather than all four in the same instant.
  if (u.aiCastMs > 0) return;
  for (const key of ABILITY_KEYS) {
    const ab = abilityFor(u, key);
    if (!ab || u.cds[ab.key] > 0 || u.level < ab.level) continue;
    // Ultimates are kept for champions and the beast.
    if (ab.level >= 3 && t.kind !== 'champion' && t.kind !== 'beast') continue;
    const aim = aimFor(s, u, t, ab);
    if (aim && cast(s, u, ab.key, aim)) {
      u.aiCastMs = AI_CAST_GAP;
      return;
    }
  }
}

function aimFor(s: GameState, u: Unit, t: Unit, ab: AbilityDef): Vec | null {
  const d = Math.max(dist(u, t), 1);
  switch (ab.kind) {
    case 'ally': {
      const allies = s.units.filter((a) => a.kind === 'champion' && !a.dead && a.side === u.side && dist(a, u) <= ab.range + (ab.radius ?? 0));
      const low = allies.reduce<Unit | null>((best, a) => (!best || a.hp / a.maxHp < best.hp / best.maxHp ? a : best), null);
      const fight = t.kind === 'champion' && dist(t, u) < 400;
      if (ab.range === 0) return fight || (low && low.hp < low.maxHp * 0.6 && dist(low, u) <= (ab.radius ?? 0)) ? { x: u.x, y: u.y } : null;
      if (low && (low.hp < low.maxHp * 0.8 || fight)) return { x: low.x, y: low.y };
      return null;
    }
    case 'burst':
      if (ab.range === 0) return dist(t, u) - t.radius <= (ab.radius ?? 0) * 0.8 ? { x: t.x, y: t.y } : null;
      return dist(t, u) <= ab.range ? { x: t.x, y: t.y } : null;
    case 'zone':
      return dist(t, u) <= ab.range + (ab.radius ?? 0) * 0.5 ? { x: t.x, y: t.y } : null;
    case 'bolt':
      // A harpoon is kept for champions.
      if (ab.pull && t.kind !== 'champion') return null;
      return dist(t, u) - t.radius <= ab.range ? { x: t.x, y: t.y } : null;
    case 'buff': {
      if (ab.buff?.stealth) return t.kind === 'champion' && d < 520 && d > u.range ? { x: u.x, y: u.y } : null;
      const near = d - t.radius <= u.range + 60;
      return near && (t.kind === 'champion' || t.kind === 'beast' || (ab.buff?.atk && t.kind !== 'minion')) ? { x: t.x, y: t.y } : null;
    }
    case 'dash':
      if (ab.damage) {
        return t.kind === 'champion' && dist(t, u) - t.radius <= ab.range + 80 && dist(t, u) > u.range ? { x: t.x, y: t.y } : null;
      }
      // A blink with no damage is an escape: it takes the caster away from the enemy.
      return u.hp < u.maxHp * 0.4 && d < 300 ? clampWorld({ x: u.x + ((u.x - t.x) / d) * ab.range, y: u.y + ((u.y - t.y) / d) * ab.range }) : null;
  }
  return null;
}

/** One attack: its passive and buffs shape the damage, then lifesteal, splash and slows follow. */
function attack(s: GameState, u: Unit, t: Unit) {
  if (u.attackCd > 0 || t.dead) return;
  u.attackCd = attackMsOf(u);
  u.swing = 180;
  u.facing = Math.atan2(t.y - u.y, t.x - u.x);
  let amount = u.dmg;
  let crit = false;
  const p = u.champ?.passive;
  if (u.kind === 'champion' && p) {
    amount *= 1 + buffSum(u, 'dmg') / 100;
    u.attackCount++;
    if (p.critEvery && u.attackCount % p.critEvery === 0) {
      amount *= p.critMult ?? 1.5;
      crit = true;
      s.fx.push({ kind: 'ring', x: t.x, y: t.y, r: 22, color: u.champ!.color, ms: 220 });
    }
    if (p.ambush && (u.lullMs >= LULL_MS || stealthed(u))) {
      amount *= p.ambush;
      crit = true;
      s.fx.push({ kind: 'ring', x: t.x, y: t.y, r: 28, color: u.champ!.color, ms: 300 });
    }
    if (p.hasteMs) u.hasteMs = p.hasteMs;
    u.revealMs = REVEAL_MS;
    u.lullMs = 0;
    breakStealth(u);
  }
  if (u.range > 80) {
    s.fx.push({ kind: 'line', x: u.x, y: u.y, x2: t.x, y2: t.y, color: SIDE_COLOR[u.side], ms: 160 });
    s.fx.push({ kind: 'ring', x: t.x, y: t.y, r: 10, color: '#ffffff', ms: 120 });
  } else {
    s.fx.push({ kind: 'arc', x: u.x, y: u.y, r: u.radius + 14, a: u.facing, color: '#ffffff', ms: 180 });
    s.fx.push({ kind: 'ring', x: t.x, y: t.y, r: 12, color: '#ffffff', ms: 120 });
  }
  // Minions and camps fight too often to be heard; towers, the beast and the player's champion are
  // (the AI champions share this code, so theirs stay silent).
  if (u.kind === 'champion') {
    if (u.id === s.player) sound(s, crit ? 'crit' : u.range > 80 ? 'shot' : 'swing', u, true);
  } else if (u.kind === 'tower') sound(s, 'towerShot', u);
  else if (u.kind === 'beast') sound(s, 'beastClaw', u);
  // Minions of the team that slew the beast hit harder while its buff lasts.
  const empowered = u.kind === 'minion' && u.side !== 'neutral' && s.beastBuff[u.side] > s.time;
  const hit = dealt(s, u, amount) * (empowered ? BEAST_BUFF.dmg : 1);
  const lost = damage(s, t, hit, u.id);
  if (u.kind !== 'champion' || !p) return;
  const steal = (p.lifesteal ?? 0) + buffSum(u, 'lifesteal');
  if (steal && lost > 0) u.hp = Math.min(u.maxHp, u.hp + (lost * steal) / 100);
  const slow = Math.max(p.slowHit ?? 0, buffSum(u, 'slowHit'));
  if (slow && (t.kind === 'champion' || t.kind === 'minion')) t.slowMs = Math.max(t.slowMs, slow);
  if (p.splash) {
    for (const e of [...s.units]) {
      if (e === t || e.dead || e.side === u.side || !hittable(e) || (e.kind !== 'champion' && e.kind !== 'minion' && e.kind !== 'camp') || dist(e, t) > (p.splashRadius ?? 0) + e.radius) continue;
      damage(s, e, (hit * p.splash) / 100, u.id);
    }
  }
}

/** Whether `u` is close enough to `t` to hit it. Distances count from the edge of the target. */
function inRange(u: Unit, t: Unit): boolean {
  return dist(u, t) - t.radius <= u.range;
}

/** The nearest unit an enemy of `u` within `within` pixels of its edge, passing `filter`. */
function nearest(s: GameState, u: Unit, within: number, filter: (e: Unit) => boolean): Unit | null {
  let best: Unit | null = null;
  let bestD = Infinity;
  for (const e of s.units) {
    if (e.dead || e.side === u.side || !hittable(e) || !filter(e) || hiddenFrom(s, u.side, e) || invulnerable(s, e)) continue;
    const d = dist(u, e) - e.radius;
    if (d <= within && d < bestD) {
      best = e;
      bestD = d;
    }
  }
  return best;
}

function moveToward(u: Unit, goal: Vec, dt: number) {
  const d = dist(u, goal);
  if (d < 0.5) return;
  const step = Math.min(d, (speedOf(u) * dt) / 1000);
  // Round the trees, rocks and structures in the way (`steer`), facing the way it walks.
  const to = steer(u, goal, step, bodyOf(u));
  if (Math.abs(to.x - u.x) + Math.abs(to.y - u.y) > 1e-6) u.facing = Math.atan2(to.y - u.y, to.x - u.x);
  u.walk += Math.hypot(to.x - u.x, to.y - u.y);
  u.x = to.x;
  u.y = to.y;
}

/** How wide a unit is to the things it walks round and to other walkers (0 for what never moves). */
export function bodyOf(u: Unit): number {
  return u.kind === 'champion' ? BODY.champion : u.kind === 'minion' ? BODY.minion : u.kind === 'camp' ? u.radius * BODY.camp : u.kind === 'beast' ? BODY.beast : 0;
}

/** Puts a unit that was moved at once (a dash, a blink, a knock, a pull) at the point, or at the nearest free spot by it. */
function place(u: Unit, to: Vec) {
  const p = settle(clampWorld(to), bodyOf(u));
  u.x = p.x;
  u.y = p.y;
}

/**
 * Walkers don't stand in each other: each pair of living champions and minions that overlap is
 * pushed apart, half each, and a camp or the beast pushes them off itself, never the other way.
 */
function separate(s: GameState) {
  const walkers = s.units.filter((u) => !u.dead && (u.kind === 'champion' || u.kind === 'minion'));
  const fixed = s.units.filter((u) => !u.dead && (u.kind === 'camp' || u.kind === 'beast'));
  for (let i = 0; i < walkers.length; i++) {
    const a = walkers[i];
    const ra = bodyOf(a);
    for (let j = i + 1; j < walkers.length; j++) {
      const b = walkers[j];
      const r = ra + bodyOf(b);
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) >= r || Math.abs(dy) >= r) continue;
      const d = Math.hypot(dx, dy);
      if (d >= r) continue;
      // Two on the very same spot part along a fixed slant, by id, so it plays the same every time.
      const ux = d > 1e-3 ? dx / d : 0.6, uy = d > 1e-3 ? dy / d : 0.8;
      const push = ((r - d) / 2) * BODY.give;
      a.x -= ux * push;
      a.y -= uy * push;
      b.x += ux * push;
      b.y += uy * push;
    }
    for (const f of fixed) {
      const r = ra + bodyOf(f);
      const d = dist(a, f);
      if (d >= r || d < 1e-3) continue;
      a.x = f.x + ((a.x - f.x) / d) * r;
      a.y = f.y + ((a.y - f.y) / d) * r;
    }
  }
  for (const u of walkers) {
    const p = settle(u, bodyOf(u));
    u.x = p.x;
    u.y = p.y;
  }
}

/** The next point on a lane walk; the last point is the enemy Nexus. */
function nextWaypoint(u: Unit): Vec {
  if (!u.path) return u;
  while (u.wp < u.path.length - 1 && dist(u, u.path[u.wp]) < 14) u.wp++;
  return u.path[u.wp];
}

/** `aim`, or the point along the way to it that is `range` pixels from `from`. */
function towards(from: Vec, aim: Vec, range: number): Vec {
  const d = dist(from, aim);
  if (d <= range || d === 0) return clampWorld(aim);
  return clampWorld({ x: from.x + ((aim.x - from.x) * range) / d, y: from.y + ((aim.y - from.y) * range) / d });
}

function clampWorld(p: Vec): Vec {
  return { x: Math.min(WORLD.w, Math.max(0, p.x)), y: Math.min(WORLD.h, Math.max(0, p.y)) };
}

function updateProjectiles(s: GameState, dt: number) {
  for (const p of s.projectiles) {
    const step = Math.hypot(p.vx, p.vy) * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.left -= step;
    for (const e of s.units) {
      if (e.dead || e.side === p.side || !hittable(e) || e.kind === 'ward' || p.hit.includes(e.id)) continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) > p.width + e.radius) continue;
      if (campSpares(s, p.owner, e)) continue;
      p.hit.push(e.id);
      const owner = getUnit(s, p.owner);
      if (p.look) {
        s.fx.push({ kind: 'skill', look: `${p.look}>hit`, x: e.x, y: e.y, x2: p.x, y2: p.y, r: 0, a: Math.atan2(p.vy, p.vx), color: p.color, ms: 400 });
        if (owner && owner.id === s.player) sound(s, 'impact', e, true);
      }
      if (owner && owner.kind === 'champion') abilityHit(s, owner, e, p.damage, p, hitHowOf(p.look));
      else damage(s, e, p.damage, p.owner);
      // A harpoon drags what it caught to the thrower.
      if (p.pull && owner && !e.dead && (e.kind === 'champion' || e.kind === 'minion')) {
        const d = Math.max(dist(owner, e), 1);
        const stop = owner.radius + e.radius + 20;
        if (!p.look) s.fx.push({ kind: 'line', x: owner.x, y: owner.y, x2: e.x, y2: e.y, color: p.color, ms: 300 });
        place(e, { x: owner.x + ((e.x - owner.x) / d) * stop, y: owner.y + ((e.y - owner.y) / d) * stop });
      }
      if (!p.pierce) {
        p.left = 0;
        break;
      }
    }
  }
  s.projectiles = s.projectiles.filter((p) => p.left > 0);
}

/** Zones hurt and slow the other team's units inside them, then fade. */
function updateZones(s: GameState, dt: number) {
  for (const z of s.zones) {
    z.left -= dt;
    for (const e of s.units) {
      if (e.dead || e.side === z.side || !hittable(e) || e.kind === 'tower' || e.kind === 'inhibitor' || e.kind === 'nexus' || e.kind === 'ward') continue;
      if ((e.x - z.x) ** 2 + (e.y - z.y) ** 2 > (z.r + e.radius) ** 2) continue;
      damage(s, e, (z.dps * dt) / 1000, z.owner, hitHowOf(z.look));
      if (z.slow && (e.kind === 'champion' || e.kind === 'minion')) e.slowMs = Math.max(e.slowMs, Math.min(z.slow, 400));
    }
  }
  s.zones = s.zones.filter((z) => z.left > 0);
}
