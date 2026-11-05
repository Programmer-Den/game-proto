import { type AimMode, sortTargets } from './aim';
import { CALL_GOBLINS, FIRST_HOWL_MS, FIRST_ROAR_MS, FIRST_ROCK_MS, HOWL_MS, ROAR_MS, ROAR_SLOW, ROAR_SLOW_MS, ROCK_DAMAGE, ROCK_MS, ROCK_SPEED, STUN_MS } from './bosses';
import { planned, type DailyPlan } from './daily';
import { FRONTIERS, canFrontier, type FrontierId } from './frontier';
import { HOUND_HOMES, HOUND_MS, HOUND_SPEED, canClass, type HeroClass } from './hero';
import { ENGINES, ENGINE_RANKS, ENGINE_SPOT, LANCE_SPEED, STONE_FLIGHT_MS, engineRank, engineStats, engineUpgradeCost, nextEngineAim, type EngineKind, type EngineUpgradeId } from './engines';
import { endlessRules } from './endless';
import { ELITE_COINS, ELITE_HP, ELITE_XP, ENRAGE_PACE, SPLIT_HP, SPLIT_INTO, TRAIT_IDS, eliteChance } from './elites';
import { ENEMIES } from './enemies';
import { FORTS, LOOKOUT_RING, LOOKOUT_WAVES, OIL_DPS, OIL_HIT, OIL_MS, OIL_RADIUS, REPAIR_SHARE, STAKE_FRONT, STAKE_HP, repairCost, type FortId } from './forts';
import { MAX_HEAT, WIN_WAVE } from './heat';
import { canKeep, type LegacyId } from './legacy';
import { canMarch } from './march';
import { OMEN_BREAK_MS, OMEN_IDS, omenEffects, omenWave } from './omens';
import {
  BOW,
  FIELD,
  SPAWN_X,
  HERO_FRONT,
  BARRICADE_FRONT,
  GUARD_SLOTS,
  bestOn,
  freshProgress,
  offerable,
  progressOf,
  newRun,
  rainNeed,
  stats,
  streakBonus,
  xpToNext,
  type Effect,
  type Enemy,
  type GameState,
  type Stats,
} from './state';
import type { Trait } from './elites';
import type { EnemyKind } from './enemies';
import { ARCANE_RADIUS, GUARDS, MAX_GUARD_LEVEL, SPEAR_REACH, guardDamage, trainCost, type GuardKind } from './guards';
import { RELIC_IDS, type RelicId } from './relics';
import { ROAD_IDS, roadEffects, type RoadId } from './roads';
import { FILLERS, PURSE_COINS, baseSkills, type UpgradeId } from './upgrades';
import { BREAK_MS, bossBars, foeHp, isBossWave, spawnInterval, waveFoes } from './waves';

// The rules of a run, in plain TypeScript: `tick` moves the battle on, `pick` takes an upgrade.

/** Longest step simulated at once, so fast arrows can't skip past a foe. */
const SUBSTEP_MS = 16;
export const ARROW_SPEED = 720;
/** How fast the mage hero's bolts fly. */
const SPELL_SPEED = 560;
const FIREBALL_SPEED = 400;
const MAGIC_SPEED = 380;
/** How far lightning leaps from one foe to the next. */
const LEAP_RANGE = 170;
const HIT_FLASH_MS = 90;
/** Foes are shot once their middle has come into the 960px view. */
const VIEW_RIGHT = 950;
/** How long each kind of effect plays, in milliseconds. */
const EFFECT_MS = {
  blast: 260, fireblast: 360, bolt: 220, death: 320, crit: 400, rain: 520, xp: 900, orb: 750, block: 260, heal: 700, stab: 200, arcane: 360,
  rockHit: 400, call: 900, roar: 1_000, howl: 1_100, split: 400, autoPick: 2_400, slam: 320, bite: 260,
} as const;
/** How long an Arrow Rain volley takes to come down after it is loosed. */
export const RAIN_FALL_MS = 450;
/** The ring Arrow Rain lands on: half its width and height (it lies flat on the road). */
export const RAIN_RING = { rx: 80, ry: 50 };
/** The patch caltrops are strewn over: half its width and height. */
export const CALTROP_PATCH = { rx: 66, ry: 34 };
/** Caltrops stay on the road for this many waves, the one they were strewn in included. */
export const CALTROP_WAVES = 5;
/** Strewing more patches than this lifts the oldest. */
export const MAX_PATCHES = 3;
/** A shield takes this share of an arrow's hit off. */
export const SHIELD_BLOCK = 0.75;
/** A shaman heals the foes within this range every HEAL_MS by a share of their health (less for a boss). */
const HEAL_MS = 2_500;
const FIRST_HEAL_MS = 1_000;
const HEAL_RANGE = 120;
const HEAL_SHARE = 0.12;
const BOSS_HEAL_SHARE = 0.03;
/** How long a level-up waits for a tap before it takes one of the offered upgrades at random. */
export const AUTO_PICK_MS = 10_000;
/** Where the pop-up naming an auto-picked upgrade shows: over the battle, under the wave banner. */
const AUTO_PICK_POP = { x: 480, y: 250 };

/** Whether the run is held still: over, or paused on the victory panel. */
export const held = (state: Pick<GameState, 'phase'>) => state.phase === 'over' || state.phase === 'won';

/**
 * Runs the game for `ms`. With `autoPick` off (the level-up's checkbox) the countdown to a random
 * pick halts, so a level-up waits for a tap however long it takes.
 */
export function tick(state: GameState, ms: number, autoPick = true) {
  while (ms > 0 && !held(state)) {
    if (state.choices && !autoPick) {
      ageEffects(state, ms);
      ms = 0;
      continue;
    }
    if (state.choices) {
      // The battle waits while the hero picks an upgrade, until the time to pick runs out.
      const dt = Math.min(ms, state.pickMs);
      state.pickMs -= dt;
      ageEffects(state, dt);
      ms -= dt;
      if (state.pickMs <= 0) {
        // Time is up: one card is taken at random, and a pop-up names it.
        const id = state.choices[Math.floor(Math.random() * state.choices.length)];
        pick(state, id);
        addEffect(state, { kind: 'autoPick', x: AUTO_PICK_POP.x, y: AUTO_PICK_POP.y, upgrade: id });
      }
      continue;
    }
    const dt = Math.min(ms, SUBSTEP_MS);
    step(state, dt);
    ms -= dt;
  }
  // Effects still play out once the run is over.
  if (ms > 0) ageEffects(state, ms);
}

function step(state: GameState, dt: number) {
  const s = stats(state);
  ageEffects(state, dt);
  // A streak ends when no kill follows in time.
  const streak = state.streak;
  if (streak.ms > 0) {
    streak.ms = Math.max(0, streak.ms - dt);
    if (streak.ms === 0) streak.count = 0;
  }
  state.rain.need = rainNeed(state.wave, s);
  state.rain.charge = Math.min(state.rain.charge, state.rain.need);
  state.roarMs = Math.max(0, state.roarMs - dt);
  landVolleys(state, s, dt);
  for (const p of state.caltrops.patches) p.ms += dt;
  if (state.phase === 'break') {
    if (state.roadChoices) {
      // After a boss the break waits on the choice of the next road, taking one at random in time.
      state.roadMs -= dt;
      if (state.roadMs <= 0) pickRoad(state, state.roadChoices[Math.floor(Math.random() * state.roadChoices.length)]);
    } else state.breakMs -= dt;
    if (state.breakMs <= 0) {
      state.phase = 'fighting';
      state.relicFound = null;
      // An omen left alone until the break ends is refused.
      if (state.omen && !state.omen.accepted) state.omen = null;
      state.toSpawn = waveFoes(state.wave, state.road, state.frontier);
      state.spawnMs = 0;
    }
  } else {
    spawn(state, dt);
  }
  shoot(state, s, dt);
  guardsAct(state, s, dt);
  houndsAct(state, s, dt);
  engineAct(state, s, dt);
  moveMissiles(state, s, dt);
  bossMoves(state, dt);
  moveEnemies(state, s, dt);
  if (state.phase === 'fighting' && state.toSpawn.length === 0 && state.enemies.length === 0) clearWave(state);
}

function spawn(state: GameState, dt: number) {
  state.spawnMs -= dt;
  if (state.spawnMs > 0 || state.toSpawn.length === 0) return;
  const kind = state.toSpawn.shift()!;
  const type = ENEMIES[kind];
  // Bosses walk down the middle of the field, the rest anywhere on it, and flyers above its far edge.
  const margin = type.radius / 2;
  const y = type.boss
    ? (FIELD.top + FIELD.bottom) / 2
    : type.flying
      ? FIELD.top - 50 + Math.random() * 70
      : FIELD.top + margin + Math.random() * (FIELD.bottom - FIELD.top - 2 * margin);
  // From wave 4 some foes come on as elites with a trait (never a boss); the rolls only start then,
  // so the first waves' random sequence stays as it was.
  // A Blood Moon doubles the chance, and every wave of the endless siege adds to it.
  const chance = Math.min(1, (eliteChance(state.wave) + endlessRules(state.endless, state.wave).elites) * omenEffects(state.omen).elites);
  const elite = !type.boss && chance > 0 && Math.random() < chance;
  const trait = elite ? TRAIT_IDS[Math.floor(Math.random() * TRAIT_IDS.length)] : null;
  addFoe(state, kind, SPAWN_X + type.radius, y, Math.round(hpOf(state, kind) * (trait ? ELITE_HP : 1)), trait);
  state.spawnMs = spawnInterval(state.wave, state.heat);
}

/** A foe's full health on this run's wave, road, heat and map, and past wave 30 of an endless siege. */
const hpOf = (state: GameState, kind: EnemyKind) => {
  const hp = foeHp(kind, state.wave, state.road, state.heat, state.frontier);
  return state.endless ? Math.round(hp * endlessRules(true, state.wave).hp) : hp;
};

/** Puts a foe on the field with this much health; a boss's move timer or a shaman's healing timer starts. */
function addFoe(state: GameState, kind: EnemyKind, x: number, y: number, hp: number, trait: Trait | null) {
  const type = ENEMIES[kind];
  state.enemies.push({
    id: state.nextId++,
    kind,
    x,
    y,
    hp,
    maxHp: hp,
    bars: type.boss ? bossBars(state.wave, state.heat) : 1,
    slow: 0,
    slowMs: 0,
    burnDps: 0,
    burnMs: 0,
    attacking: false,
    hitMs: 0,
    // A shaman heals for the first time soon after coming into view, then every HEAL_MS; the Troll
    // King's first rock and the Frost Giant's first roar come soon after they come into view too.
    castMs: kind === 'troll' ? FIRST_ROCK_MS : kind === 'giant' ? FIRST_ROAR_MS : kind === 'chieftain' ? FIRST_HOWL_MS : FIRST_HEAL_MS,
    trait,
  });
}

/**
 * Foes that have come into view, in the order the aim priority shoots them (nearest first by
 * default). On a Night wave only those past mid-field are seen.
 */
function targets(state: GameState, mode: AimMode = state.aimMode) {
  const sight = sightOf(state);
  return sortTargets(state.enemies.filter((e) => e.x < sight), mode);
}

/** How far right foes can be seen and struck: the view's edge, or mid-field on a Night wave. */
export function sightOf(state: GameState) {
  return Math.min(VIEW_RIGHT, omenEffects(state.omen).sight);
}

function shoot(state: GameState, s: Stats, dt: number) {
  const cd = state.cooldown;
  cd.arrow = Math.max(0, cd.arrow - dt);
  cd.fireball = Math.max(0, cd.fireball - dt);
  cd.storm = Math.max(0, cd.storm - dt);
  // The warden shoots nothing: a shield slam at the barricade instead, on the bow's timer.
  if (s.slam) {
    if (cd.arrow === 0) slam(state, s);
    return;
  }
  const foes = targets(state);
  if (foes.length === 0) return;

  if (cd.arrow === 0) {
    // Each arrow of a volley (or the mage's bolt, with Twin Bolt) goes at a different foe while there are enough of them.
    const kind = state.hero === 'mage' ? 'spell' : 'arrow';
    const pierce = kind === 'spell' ? s.chain : s.pierce;
    for (let i = 0; i < s.arrows; i++) launch(state, kind, foes[i % foes.length], pierce, i, s.arrows);
    // The Frost Giant's roar slows the ranger's shots for a while.
    cd.arrow = s.shotMs * (state.roarMs > 0 ? ROAR_SLOW : 1);
  }
  if (s.fireball && cd.fireball === 0) {
    // Fireballs go where the foes are thickest: at the one with the most others around it.
    const crowd = (e: Enemy) => foes.filter((o) => Math.hypot(o.x - e.x, o.y - e.y) < s.fireball!.radius).length;
    const target = foes.reduce((best, e) => (crowd(e) > crowd(best) ? e : best), foes[0]);
    launch(state, 'fireball', target, 0, 0, 1);
    cd.fireball = s.fireball.ms;
  }
  if (s.storm && cd.storm === 0) {
    lightning(state, s, foes[0]);
    cd.storm = s.storm.ms;
  }
}

/**
 * The warden's shield slam: every seen foe within reach of the barricade's face (or past it, once it
 * is down) is hit, shoved back (a boss a third as far) and, with Daze, slowed for a moment. It waits
 * until a foe is in reach.
 */
function slam(state: GameState, s: Stats) {
  const slam = s.slam!;
  const sight = sightOf(state);
  const struck = state.enemies.filter((e) => e.x < sight && e.x - ENEMIES[e.kind].radius <= BARRICADE_FRONT + slam.reach);
  if (struck.length === 0) return;
  for (const e of struck) {
    const type = ENEMIES[e.kind];
    hurt(e, s.damage * (type.boss ? s.bossDamage : 1), true);
    e.x = Math.min(SPAWN_X, e.x + (type.boss ? slam.push / 3 : slam.push));
    e.attacking = false;
    if (slam.daze) {
      e.slow = Math.max(e.slow, slam.daze.slow);
      e.slowMs = Math.max(e.slowMs, slam.daze.ms);
    }
  }
  const y = struck.reduce((sum, e) => sum + e.y, 0) / struck.length;
  addEffect(state, { kind: 'slam', x: BARRICADE_FRONT, y: Math.round(y), radius: slam.reach });
  // The Frost Giant's roar slows the slams as it does the bow.
  state.cooldown.arrow = s.shotMs * (state.roarMs > 0 ? ROAR_SLOW : 1);
  removeDead(state);
}

/**
 * The warden's hounds: each runs at a seen foe on the road (in the aim priority's order, one foe a
 * hound while there are enough), bites it and holds it (slows it, a boss half as much) for a while,
 * and runs home behind the barricade when there is none.
 */
function houndsAct(state: GameState, s: Stats, dt: number) {
  const h = s.hound;
  if (!h) return;
  while (state.hounds.length < h.count) {
    const home = HOUND_HOMES[state.hounds.length];
    state.hounds.push({ id: state.nextId++, x: home.x, y: home.y, target: null, cd: 0, face: 1 });
  }
  const sight = sightOf(state);
  state.hounds.forEach((d, i) => {
    d.cd = Math.max(0, d.cd - dt);
    let foe = state.enemies.find((e) => e.id === d.target && e.x < sight);
    // A foe an earlier hound also holds is given up, so the pick below takes a free one if there is.
    if (foe && state.hounds.some((o, j) => j < i && o.target === foe!.id)) foe = undefined;
    if (!foe) {
      const taken = new Set(state.hounds.filter((o) => o !== d).map((o) => o.target));
      const free = targets(state).filter((e) => !ENEMIES[e.kind].flying);
      foe = free.find((e) => !taken.has(e.id)) ?? free[0];
      d.target = foe?.id ?? null;
    }
    // A hound stands just in front of its foe, on its side of the road.
    const to = foe ? { x: foe.x - ENEMIES[foe.kind].radius - 8, y: foe.y + 4 } : HOUND_HOMES[i];
    const dist = Math.hypot(to.x - d.x, to.y - d.y);
    const run = (HOUND_SPEED * dt) / 1000;
    if (dist > run) {
      d.face = to.x >= d.x ? 1 : -1;
      d.x += ((to.x - d.x) / dist) * run;
      d.y += ((to.y - d.y) / dist) * run;
    } else {
      d.x = to.x;
      d.y = to.y;
      d.face = 1;
    }
    if (!foe || dist > 12 + run || d.cd > 0) return;
    const boss = !!ENEMIES[foe.kind].boss;
    hurt(foe, s.damage * h.share * (boss ? s.bossDamage : 1), true);
    foe.slow = Math.max(foe.slow, boss ? h.slow / 2 : h.slow);
    foe.slowMs = Math.max(foe.slowMs, h.ms);
    addEffect(state, { kind: 'bite', x: Math.round(foe.x - ENEMIES[foe.kind].radius / 2), y: Math.round(foe.y - 6) });
    d.cd = HOUND_MS;
  });
  removeDead(state);
}

/**
 * The siege engine on the barricade, while it stands: the ballista shoots a lance straight at the
 * first foe of its aim, through every foe on its line; the catapult lobs a stone at the back ranks
 * (or the thickest crowd) on the road, where the foe will be when it lands.
 */
function engineAct(state: GameState, s: Stats, dt: number) {
  const engine = state.engine;
  if (!engine) return;
  engine.cd = Math.max(0, engine.cd - dt);
  if (engine.cd > 0 || state.barricade.hp <= 0) return;
  const es = engineStats(engine, state.wave);
  if (engine.kind === 'ballista') {
    const foe = targets(state, engine.aim === 'strongest' || engine.aim === 'flyers' ? engine.aim : 'nearest')[0];
    if (!foe) return;
    const from = { x: ENGINE_SPOT.x + 18, y: ENGINE_SPOT.y - 10 };
    const angle = Math.atan2(foe.y - from.y, foe.x - from.x);
    state.missiles.push({
      id: state.nextId++,
      kind: 'lance',
      x: from.x,
      y: from.y,
      vx: Math.cos(angle) * LANCE_SPEED,
      vy: Math.sin(angle) * LANCE_SPEED,
      target: null,
      hit: [],
      pierce: 0,
      damage: es.damage,
    });
  } else {
    // Only foes walking the road in front of the barricade: a stone never comes down on the wall.
    const foes = targets(state, 'nearest').filter((e) => !ENEMIES[e.kind].flying && e.x > BARRICADE_FRONT + 40);
    if (foes.length === 0) return;
    const crowd = (e: Enemy) => foes.filter((o) => Math.hypot(o.x - e.x, o.y - e.y) < es.radius).length;
    const foe = engine.aim === 'back' ? foes[foes.length - 1] : foes.reduce((best, e) => (crowd(e) > crowd(best) ? e : best), foes[0]);
    const lead = foe.attacking ? 0 : (ENEMIES[foe.kind].speed * paceOf(state, s, foe) * STONE_FLIGHT_MS) / 1000;
    const from = { x: ENGINE_SPOT.x, y: ENGINE_SPOT.y - 24 };
    const to = { x: Math.round(Math.max(BARRICADE_FRONT + 40, foe.x - lead)), y: Math.round(foe.y) };
    const speed = Math.hypot(to.x - from.x, to.y - from.y) / (STONE_FLIGHT_MS / 1000);
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    state.missiles.push({
      id: state.nextId++,
      kind: 'stone',
      x: from.x,
      y: from.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      target: null,
      hit: [],
      pierce: 0,
      damage: es.damage,
      radius: es.radius,
      burn: es.burn,
      from,
      to,
    });
  }
  engine.cd = es.ms;
}

/** A catapult's stone comes down: every foe on the road within its radius is crushed (armour counts) and, with pitch, set alight. */
function landStone(state: GameState, m: GameState['missiles'][number]) {
  const radius = m.radius ?? 0;
  addEffect(state, { kind: 'rockHit', x: m.to!.x, y: m.to!.y, radius });
  for (const e of state.enemies) {
    if (ENEMIES[e.kind].flying || Math.hypot(e.x - m.to!.x, (e.y - m.to!.y) * 1.4) > radius + ENEMIES[e.kind].radius) continue;
    hurt(e, m.damage ?? 0, true);
    if (m.burn) ignite(e, m.burn.dps, m.burn.ms);
  }
}

/** Whether an engine can be built or upgraded now: during a break, with no level-up up. */
export const canBuild = (state: GameState) => state.phase === 'break' && !state.choices && !held(state);

/** Builds a siege engine on the barricade, if none stands yet and the coins are there. Returns whether it did. */
export function buildEngine(state: GameState, kind: EngineKind) {
  if (!canBuild(state) || state.engine || state.coins < ENGINES[kind].cost) return false;
  state.coins -= ENGINES[kind].cost;
  state.engine = { kind, ranks: {}, aim: ENGINES[kind].aims[0], cd: 0 };
  return true;
}

/** Whether the engine's upgrade can be bought now (in a break, below its top rank, with the coins). */
export function canUpgradeEngine(state: GameState, id: EngineUpgradeId) {
  const e = state.engine;
  if (!e || !canBuild(state) || !ENGINES[e.kind].upgrades.includes(id)) return false;
  const rank = engineRank(e, id);
  return rank < ENGINE_RANKS && state.coins >= engineUpgradeCost(rank);
}

/** Buys the engine's next rank of an upgrade of its own. Returns whether it did. */
export function upgradeEngine(state: GameState, id: EngineUpgradeId) {
  if (!canUpgradeEngine(state, id)) return false;
  const e = state.engine!;
  const rank = engineRank(e, id);
  state.coins -= engineUpgradeCost(rank);
  e.ranks[id] = rank + 1;
  return true;
}

/** Switches the engine's aim to the next of its kind's, at any time. Returns whether there is an engine. */
export function cycleEngineAim(state: GameState) {
  const e = state.engine;
  if (!e) return false;
  e.aim = nextEngineAim(e.kind, e.aim);
  return true;
}

function launch(state: GameState, kind: 'arrow' | 'spell' | 'fireball', target: Enemy, pierce: number, i: number, of: number) {
  const speed = missileSpeed(kind);
  // A volley fans out a little before the arrows turn towards their foes.
  const fan = of > 1 ? (i / (of - 1) - 0.5) * 0.5 : 0;
  const angle = Math.atan2(target.y - BOW.y, target.x - BOW.x) + fan;
  state.missiles.push({
    id: state.nextId++,
    kind,
    x: BOW.x,
    y: BOW.y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    target: target.id,
    hit: [],
    pierce,
  });
}

function moveMissiles(state: GameState, s: Stats, dt: number) {
  const gone = new Set<number>();
  for (const m of state.missiles) {
    if (m.kind === 'rock' || m.kind === 'stone') {
      // The Troll King's rock and the catapult's stone fly over the foes and come down where they were thrown.
      const left = Math.hypot(m.to!.x - m.x, m.to!.y - m.y);
      if (left > (Math.hypot(m.vx, m.vy) * dt) / 1000) {
        m.x += (m.vx * dt) / 1000;
        m.y += (m.vy * dt) / 1000;
        continue;
      }
      if (m.kind === 'rock') landRock(state, m.to!, m.slot);
      else landStone(state, m);
      gone.add(m.id);
      continue;
    }
    if (m.kind === 'lance') {
      // The ballista's lance flies straight on, through every seen foe in its way, shields and all.
      m.x += (m.vx * dt) / 1000;
      m.y += (m.vy * dt) / 1000;
      if (m.x < -40 || m.x > SPAWN_X + 80 || m.y < 0 || m.y > 560) {
        gone.add(m.id);
        continue;
      }
      const sight = sightOf(state);
      for (const e of state.enemies) {
        if (e.x >= sight || m.hit.includes(e.id) || Math.hypot(e.x - m.x, e.y - m.y) >= ENEMIES[e.kind].radius + 6) continue;
        hurt(e, m.damage ?? 0, true);
        m.hit.push(e.id);
      }
      continue;
    }
    const speed = missileSpeed(m.kind);
    let target = state.enemies.find((e) => e.id === m.target);
    // A foe that fell before the arrow got there, or none was left to turn to: turn to the nearest
    // seen one not yet hit. An arrow that has pierced a foe never turns back: it only takes one ahead.
    if (!target) {
      target = nearest(
        targets(state, 'nearest').filter((e) => !m.hit.includes(e.id) && (m.hit.length === 0 || e.x > m.x - 20)),
        m.x,
        m.y,
      );
      m.target = target?.id ?? null;
    }
    if (target) {
      // Homing: turn fully towards the foe each step.
      const a = Math.atan2(target.y - m.y, target.x - m.x);
      m.vx = Math.cos(a) * speed;
      m.vy = Math.sin(a) * speed;
    }
    m.x += (m.vx * dt) / 1000;
    m.y += (m.vy * dt) / 1000;
    if (m.x < -40 || m.x > SPAWN_X + 80 || m.y < 0 || m.y > 560) {
      gone.add(m.id);
      continue;
    }
    // Only seen foes are struck: an arrow flying on into the dark of a Night wave misses.
    const sight = sightOf(state);
    const struck = state.enemies.find(
      (e) => e.x < sight && !m.hit.includes(e.id) && Math.hypot(e.x - m.x, e.y - m.y) < ENEMIES[e.kind].radius + 4,
    );
    if (!struck) continue;
    if (m.kind === 'fireball') {
      explode(state, m.x, m.y, s.fireball!.radius, s.fireball!.damage, 'fireblast', s);
      gone.add(m.id);
      continue;
    }
    if (m.kind === 'magic') {
      // An arcane burst: magic, so armour and shields don't stop it.
      addEffect(state, { kind: 'arcane', x: m.x, y: m.y, radius: ARCANE_RADIUS });
      for (const e of state.enemies) {
        if (Math.hypot(e.x - m.x, e.y - m.y) <= ARCANE_RADIUS + ENEMIES[e.kind].radius) hurt(e, m.damage ?? 0, false);
      }
      gone.add(m.id);
      continue;
    }
    if (m.kind === 'spell') {
      spellHit(state, s, struck, m.x, m.y);
      m.hit.push(struck.id);
      // Chain Spark: the bolt leaps on to the nearest seen foe it has not struck, within a leap.
      const next = m.pierce > 0 ? nearest(targets(state, 'nearest').filter((e) => !m.hit.includes(e.id) && e.hp > 0 && Math.hypot(e.x - struck.x, e.y - struck.y) < LEAP_RANGE), m.x, m.y) : undefined;
      if (next) {
        m.pierce--;
        m.target = next.id;
      } else gone.add(m.id);
      continue;
    }
    const blocked = arrowHit(state, s, struck, m.x, m.y);
    m.hit.push(struck.id);
    // An arrow that glances off a shield goes no further.
    if (m.pierce > 0 && !blocked) {
      m.pierce--;
      const next = nearest(targets(state, 'nearest').filter((e) => !m.hit.includes(e.id) && e.x > m.x - 20), m.x, m.y);
      m.target = next?.id ?? null;
    } else gone.add(m.id);
  }
  state.missiles = state.missiles.filter((m) => !gone.has(m.id));
  removeDead(state);
}

const missileSpeed = (kind: string) => (kind === 'lance' ? LANCE_SPEED : kind === 'arrow' ? ARROW_SPEED : kind === 'spell' ? SPELL_SPEED : kind === 'magic' ? MAGIC_SPEED : FIREBALL_SPEED);

/**
 * The mage hero's bolt strikes a foe: magic, so a shield does not stop it (armour still counts),
 * then it bursts round the foe (wider with Wide Burst) and burns or chills like the ranger's arrows.
 */
function spellHit(state: GameState, s: Stats, foe: Enemy, x: number, y: number) {
  const crit = Math.random() < s.critChance;
  const damage = s.damage * (crit ? 2 : 1);
  const type = ENEMIES[foe.kind];
  hurt(foe, damage * (type.boss ? s.bossDamage : 1), true);
  if (crit) addEffect(state, { kind: 'crit', x: foe.x, y: foe.y - type.radius });
  if (s.burn) ignite(foe, s.burn.dps, s.burn.ms);
  if (s.chill) chill(foe, s.chill.slow, s.chill.ms);
  if (s.burst) {
    addEffect(state, { kind: 'arcane', x, y, radius: s.burst.radius });
    for (const e of state.enemies) {
      if (e.id === foe.id || Math.hypot(e.x - x, e.y - y) > s.burst.radius + ENEMIES[e.kind].radius) continue;
      hurt(e, damage * s.burst.share, true);
    }
  }
}

/** Chills a foe, unless it is Warded or made of frost. */
function chill(foe: Enemy, slow: number, ms: number) {
  if (foe.trait === 'warded' || ENEMIES[foe.kind].cold) return;
  foe.slow = Math.max(foe.slow, slow);
  foe.slowMs = ms;
}

/**
 * An arrow strikes a foe: a crit, burning, chill and a burst. A shield bearer's shield takes most
 * of the hit and all of the burning and chill, though a burst still gets through. Returns whether
 * the shield blocked it.
 */
function arrowHit(state: GameState, s: Stats, foe: Enemy, x: number, y: number) {
  const crit = Math.random() < s.critChance;
  const damage = s.damage * (crit ? 2 : 1);
  const type = ENEMIES[foe.kind];
  const shield = !!type.shield;
  // Shatter, Finishing Shot and Giant Slayer make the arrow itself hit harder, not its burst.
  const mult =
    (foe.slowMs > 0 ? s.chilledDamage : 1) * (foe.hp < foe.maxHp * s.finisher ? 2 : 1) * (type.boss ? s.bossDamage : 1);
  hurt(foe, (shield ? damage * (1 - SHIELD_BLOCK) : damage) * mult, true);
  if (shield) {
    addEffect(state, { kind: 'block', x: foe.x - ENEMIES[foe.kind].radius, y: foe.y - 10 });
    if (s.burst) explode(state, x, y, s.burst.radius, damage * s.burst.share, 'blast', s);
    return true;
  }
  if (crit) addEffect(state, { kind: 'crit', x: foe.x, y: foe.y - ENEMIES[foe.kind].radius });
  if (s.burn) ignite(foe, s.burn.dps, s.burn.ms);
  // A Warded elite (or a foe made of frost) shrugs off burning and chill alike.
  if (s.chill) chill(foe, s.chill.slow, s.chill.ms);
  if (s.burst) explode(state, x, y, s.burst.radius, damage * s.burst.share, 'blast', s, foe.id);
  return false;
}

/** Hurts every foe within `radius`, except `spare` (the one the arrow already hit). */
function explode(state: GameState, x: number, y: number, radius: number, damage: number, kind: 'blast' | 'fireblast', s: Stats, spare?: number) {
  addEffect(state, { kind, x, y, radius });
  for (const e of state.enemies) {
    if (e.id === spare || Math.hypot(e.x - x, e.y - y) > radius + ENEMIES[e.kind].radius) continue;
    hurt(e, damage, true);
    // Fireballs set foes alight when the arrows burn.
    if (kind === 'fireblast' && s.burn) ignite(e, s.burn.dps, s.burn.ms);
  }
}

/** Sets a foe alight, unless it is Warded or made of frost. */
function ignite(foe: Enemy, dps: number, ms: number) {
  if (foe.trait === 'warded' || ENEMIES[foe.kind].cold) return;
  foe.burnDps = Math.max(foe.burnDps, dps);
  foe.burnMs = ms;
}

/** Lightning strikes the foe nearest the barricade and leaps on to the nearest seen foe it has not struck. */
function lightning(state: GameState, s: Stats, first: Enemy) {
  const struck: Enemy[] = [first];
  const sight = sightOf(state);
  while (struck.length < s.storm!.leaps) {
    const last = struck[struck.length - 1];
    const next = nearest(state.enemies.filter((e) => !struck.includes(e) && e.x < sight && Math.hypot(e.x - last.x, e.y - last.y) < LEAP_RANGE), last.x, last.y);
    if (!next) break;
    struck.push(next);
  }
  for (const e of struck) hurt(e, s.storm!.damage, false);
  addEffect(state, { kind: 'bolt', x: first.x, y: first.y, points: struck.map((e) => ({ x: Math.round(e.x), y: Math.round(e.y) })) });
  removeDead(state);
}

function hurt(foe: Enemy, damage: number, armored: boolean) {
  foe.hp -= armored ? Math.max(1, damage - ENEMIES[foe.kind].armor) : damage;
  foe.hitMs = HIT_FLASH_MS;
}

function moveEnemies(state: GameState, s: Stats, dt: number) {
  const barricadeUp = state.barricade.hp > 0;
  // A bought stake line behind the barricade is what foes hack at once it is down, or once they
  // are past its face (the barricade was mended while they stood at the stakes).
  const stakesUp = state.forts.stakeHp > 0;
  // A Golden Road and Rich Plunder both hurry the foes.
  const roadSpeed = roadEffects(state.road).speed * omenEffects(state.omen).speed;
  for (const e of state.enemies) {
    const type = ENEMIES[e.kind];
    e.hitMs = Math.max(0, e.hitMs - dt);
    if (e.burnMs > 0) {
      e.hp -= (e.burnDps * Math.min(dt, e.burnMs)) / 1000;
      e.burnMs = Math.max(0, e.burnMs - dt);
      if (e.burnMs === 0) e.burnDps = 0;
    }
    // Caltrops slow and prick every foe walking on them; flyers pass over.
    const pricked = !type.flying && onCaltrops(state, e);
    if (pricked) e.hp -= (s.damage * s.caltropDps * dt) / 1000;
    const rage = rageOf(e);
    const pace = paceOf(state, s, e);
    if (e.slowMs > 0) {
      e.slowMs = Math.max(0, e.slowMs - dt);
      if (e.slowMs === 0) e.slow = 0;
    }
    if (type.healer && e.x < VIEW_RIGHT) heal(state, e, dt);
    // Only a foe at the barricade's face hacks at it: one that got behind it while it was down
    // (and was then repaired) goes on to the stake line, or to the hero when there is none. A foe
    // walking up oversteps a face by at most one substep's walk, so that is how far behind it still
    // counts as at the face.
    const overstep = (type.speed * roadSpeed * rage * SUBSTEP_MS) / 1000;
    const atBarricade = barricadeUp && e.x >= BARRICADE_FRONT + type.radius - overstep;
    // Flyers go over the barricade (and the stake line), straight at the hero.
    const wall = type.flying ? null : atBarricade ? BARRICADE_FRONT : stakesUp ? STAKE_FRONT : null;
    const stop = (wall ?? HERO_FRONT) + type.radius;
    const arrived = e.x <= stop && e.x >= stop - overstep;
    e.attacking = wall !== null && arrived;
    if (e.attacking) {
      e.x = stop;
      const hacksBarricade = wall === BARRICADE_FRONT;
      // An oil pot bursts over the first foe to reach the barricade.
      if (hacksBarricade && state.forts.oil) burstOil(state, e);
      // Bulwark (the warden's) makes every blow count for less.
      if (hacksBarricade) state.barricade.hp = Math.max(0, state.barricade.hp - (type.dps * pace * s.hack * dt) / 1000);
      else state.forts.stakeHp = Math.max(0, state.forts.stakeHp - (type.dps * pace * s.hack * dt) / 1000);
      // Spiked Stakes prick every foe hacking at the barricade.
      e.hp -= (s.stakes * dt) / 1000;
    } else {
      e.x -= (type.speed * pace * dt) / 1000;
    }
    if (e.hp > 0 && e.x - type.radius <= HERO_FRONT) {
      gameOver(state);
      return;
    }
  }
  removeDead(state);
}

/** The oil pot: every foe near the one that reached the barricade is hurt and set alight. */
function burstOil(state: GameState, at: Enemy) {
  state.forts.oil = false;
  addEffect(state, { kind: 'fireblast', x: at.x, y: at.y, radius: OIL_RADIUS });
  for (const e of state.enemies) {
    if (Math.hypot(e.x - at.x, e.y - at.y) > OIL_RADIUS + ENEMIES[e.kind].radius) continue;
    hurt(e, OIL_HIT, false);
    ignite(e, OIL_DPS, OIL_MS);
  }
}

/**
 * The bosses' moves, once in view: the Troll King throws a rock at a hired guard (at the barricade
 * when none is hired), the Ogre Warlord calls goblins to its side once below half health, and the
 * Frost Giant roars, slowing the ranger's shots. On the frozen pass the Yeti Chieftain howls,
 * stunning every guard and slowing the shots too.
 */
function bossMoves(state: GameState, dt: number) {
  for (const boss of state.enemies.filter((e) => ENEMIES[e.kind].boss && e.x < VIEW_RIGHT)) {
    if (boss.kind === 'ogre') {
      if (boss.moved || boss.hp >= boss.maxHp / 2) continue;
      boss.moved = true;
      addEffect(state, { kind: 'call', x: boss.x, y: boss.y, radius: ENEMIES.ogre.radius });
      const hp = Math.round(hpOf(state, 'goblin'));
      for (let i = 0; i < CALL_GOBLINS; i++) {
        const y = FIELD.top + 12 + ((i + 0.5) / CALL_GOBLINS) * (FIELD.bottom - FIELD.top - 24);
        addFoe(state, 'goblin', Math.min(SPAWN_X, boss.x + 30 + (i % 2) * 24), y, hp, null);
      }
      continue;
    }
    boss.castMs -= dt;
    if (boss.castMs > 0) continue;
    if (boss.kind === 'troll') {
      boss.castMs = ROCK_MS;
      const hired = state.guards.map((g, i) => (g ? i : -1)).filter((i) => i >= 0);
      if (hired.length === 0 && state.barricade.hp <= 0) continue;
      const slot = hired.length > 0 ? hired[Math.floor(Math.random() * hired.length)] : undefined;
      const to = slot === undefined ? { x: BARRICADE_FRONT + 6, y: boss.y } : { x: GUARD_SLOTS[slot].x, y: GUARD_SLOTS[slot].y - 24 };
      const from = { x: boss.x - 20, y: boss.y - 50 };
      const angle = Math.atan2(to.y - from.y, to.x - from.x);
      state.missiles.push({
        id: state.nextId++,
        kind: 'rock',
        x: from.x,
        y: from.y,
        vx: Math.cos(angle) * ROCK_SPEED,
        vy: Math.sin(angle) * ROCK_SPEED,
        target: null,
        hit: [],
        pierce: 0,
        from,
        to,
        slot,
      });
    } else if (boss.kind === 'giant') {
      boss.castMs = ROAR_MS;
      state.roarMs = ROAR_SLOW_MS;
      addEffect(state, { kind: 'roar', x: boss.x, y: boss.y - 40, radius: 160 });
    } else if (boss.kind === 'chieftain') {
      // The Yeti Chieftain's howl: every hired guard is stunned and the hero's shots slow.
      boss.castMs = HOWL_MS;
      state.roarMs = ROAR_SLOW_MS;
      for (const g of state.guards) if (g) g.stunMs = STUN_MS;
      addEffect(state, { kind: 'howl', x: boss.x, y: boss.y - 50, radius: 220 });
    }
  }
}

/** A rock comes down: the guard on its slot is stunned, or the barricade takes the blow. */
function landRock(state: GameState, to: { x: number; y: number }, slot: number | undefined) {
  addEffect(state, { kind: 'rockHit', x: to.x, y: to.y, radius: 22 });
  const guard = slot === undefined ? null : state.guards[slot];
  if (guard) guard.stunMs = STUN_MS;
  else state.barricade.hp = Math.max(0, state.barricade.hp - ROCK_DAMAGE);
}

/** An Enraged elite below half health walks and hits faster. */
const rageOf = (e: Enemy) => (e.trait === 'enraged' && e.hp < e.maxHp / 2 ? ENRAGE_PACE : 1);

/**
 * How much faster (or slower) than its kind's pace a foe walks and hacks right now: chill,
 * caltrops (flyers pass over), a Golden Road and Rich Plunder, and an Enraged elite's rage.
 */
function paceOf(state: GameState, s: Stats, e: Enemy) {
  const pricked = !ENEMIES[e.kind].flying && onCaltrops(state, e);
  return (e.slowMs > 0 ? 1 - e.slow : 1) * (pricked ? 1 - s.caltropSlow : 1) * (roadEffects(state.road).speed * omenEffects(state.omen).speed) * rageOf(e);
}

/** Whether a foe stands on a patch of caltrops. */
const onCaltrops = (state: GameState, e: Enemy) =>
  state.caltrops.patches.some(
    (p) => ((e.x - p.x) / (CALTROP_PATCH.rx + ENEMIES[e.kind].radius / 2)) ** 2 + ((e.y - p.y) / (CALTROP_PATCH.ry + ENEMIES[e.kind].radius / 2)) ** 2 <= 1,
  );

/** A shaman's healing: every HEAL_MS it mends the hurt foes around it (itself too). */
function heal(state: GameState, shaman: Enemy, dt: number) {
  shaman.castMs -= dt;
  if (shaman.castMs > 0) return;
  shaman.castMs = HEAL_MS;
  const hurtFoes = state.enemies.filter((o) => o.hp > 0 && o.hp < o.maxHp && Math.hypot(o.x - shaman.x, o.y - shaman.y) <= HEAL_RANGE);
  if (hurtFoes.length === 0) return;
  for (const o of hurtFoes) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * (ENEMIES[o.kind].boss ? BOSS_HEAL_SHARE : HEAL_SHARE));
  addEffect(state, {
    kind: 'heal',
    x: shaman.x,
    y: shaman.y,
    radius: HEAL_RANGE,
    points: hurtFoes.map((o) => ({ x: Math.round(o.x), y: Math.round(o.y) })),
  });
}

/**
 * The hired guards: a spearman stabs the foe at the barricade nearest his slot, a mage throws an
 * arcane bolt at the foe nearest the barricade.
 */
function guardsAct(state: GameState, s: Stats, dt: number) {
  state.guards.forEach((g, i) => {
    if (!g) return;
    // A guard stunned by the Troll King's rock stands dazed for a while.
    if (g.stunMs > 0) {
      g.stunMs = Math.max(0, g.stunMs - dt);
      return;
    }
    g.cd = Math.max(0, g.cd - dt);
    if (g.cd > 0) return;
    const slot = GUARD_SLOTS[i];
    const damage = guardDamage(g.kind, g.level);
    if (g.kind === 'spear') {
      const near = state.enemies.filter((e) => e.x - ENEMIES[e.kind].radius <= BARRICADE_FRONT + SPEAR_REACH);
      const foe = near.sort((a, b) => Math.abs(a.y - slot.y) - Math.abs(b.y - slot.y))[0];
      if (!foe) return;
      hurt(foe, damage, true);
      addEffect(state, { kind: 'stab', x: foe.x, y: foe.y, points: [{ x: slot.x + 10, y: slot.y - 30 }, { x: Math.round(foe.x), y: Math.round(foe.y) }] });
    } else {
      const foe = targets(state, 'nearest')[0];
      if (!foe) return;
      const from = { x: slot.x + 14, y: slot.y - 44 };
      const angle = Math.atan2(foe.y - from.y, foe.x - from.x);
      state.missiles.push({
        id: state.nextId++,
        kind: 'magic',
        x: from.x,
        y: from.y,
        vx: Math.cos(angle) * MAGIC_SPEED,
        vy: Math.sin(angle) * MAGIC_SPEED,
        target: foe.id,
        hit: [],
        pierce: 0,
        damage,
      });
    }
    g.cd = GUARDS[g.kind].ms / s.guardSpeed;
  });
  removeDead(state);
}

/** Hires a guard of this kind on an empty slot, if the coins are there. Returns whether it did. */
export function hire(state: GameState, slot: number, kind: GuardKind) {
  if (held(state) || state.choices || state.guards[slot] !== null || state.coins < GUARDS[kind].cost) return false;
  state.coins -= GUARDS[kind].cost;
  state.guards[slot] = { kind, level: 1, cd: 0, stunMs: 0 };
  return true;
}

/**
 * Buys a fortification, if the coins are there: during a break it is set up at once, one per
 * break; during a wave it is paid now and queued, and set up when the next break starts (as that
 * break's one). Returns whether it was bought.
 */
export function fortify(state: GameState, id: FortId) {
  const f = state.forts;
  if (!canBuyFort(state, id) || state.coins < FORTS[id].cost) return false;
  state.coins -= FORTS[id].cost;
  if (state.phase === 'break') setUpFort(state, id);
  else f.queued = id;
  return true;
}

/** A stake line is set up anew (or mended to full), an oil pot is armed, a lookout starts its waves over. */
function setUpFort(state: GameState, id: FortId) {
  const f = state.forts;
  f.boughtWave = state.wave;
  if (id === 'stakes') f.stakeHp = STAKE_HP;
  else if (id === 'oil') f.oil = true;
  else f.lookout = LOOKOUT_WAVES;
}

/** Whether a fortification can still be bought: one a break, or one queued during a wave. */
export const canFortify = (state: GameState) =>
  !held(state) && !state.choices && (state.phase === 'break' ? state.forts.boughtWave !== state.wave : state.forts.queued === null);

/** Whether this fortification can be bought now: an oil pot only when none is armed. */
export const canBuyFort = (state: GameState, id: FortId) => canFortify(state) && !(id === 'oil' && state.forts.oil);

/** Whether a paid repair can be bought now: during a break, with the barricade hurt and the coins there. */
export const canRepair = (state: GameState) =>
  state.phase === 'break' && !state.choices && state.barricade.hp < state.barricade.max && state.coins >= repairCost(state.repairs);

/** Paid repairs: mends REPAIR_SHARE of the barricade for coins, each repair of the run costing more. Returns whether it did. */
export function repair(state: GameState) {
  if (!canRepair(state)) return false;
  state.coins -= repairCost(state.repairs);
  state.repairs++;
  state.barricade.hp = Math.min(state.barricade.max, state.barricade.hp + state.barricade.max * REPAIR_SHARE);
  return true;
}

/** Accepts (or refuses) the omen named for the coming wave; either way the break is cut short. Returns whether it did. */
export function decideOmen(state: GameState, accept: boolean) {
  if (state.phase !== 'break' || state.choices || !state.omen || state.omen.accepted) return false;
  if (accept) state.omen.accepted = true;
  else state.omen = null;
  state.breakMs = Math.min(state.breakMs, BREAK_MS);
  return true;
}

/** Sets who the ranger shoots first. */
export function setAim(state: GameState, mode: AimMode) {
  state.aimMode = mode;
}

/** Trains the guard on a slot to the next level, if the coins are there. Returns whether it did. */
export function train(state: GameState, slot: number) {
  const g = state.guards[slot];
  if (held(state) || state.choices || !g || g.level >= MAX_GUARD_LEVEL) return false;
  const cost = trainCost(g.kind, g.level);
  if (state.coins < cost) return false;
  state.coins -= cost;
  g.level++;
  return true;
}

function removeDead(state: GameState) {
  const dead = state.enemies.filter((e) => e.hp <= 0);
  if (dead.length === 0) return;
  state.enemies = state.enemies.filter((e) => e.hp > 0);
  for (const e of dead) {
    const s = stats(state);
    state.kills++;
    const road = roadEffects(state.road);
    const omen = omenEffects(state.omen);
    const elite = e.trait ? ELITE_COINS : 1;
    // The frozen pass pays more for every kill, in coins and experience.
    const reward = FRONTIERS[state.frontier].reward;
    state.coins += Math.round((ENEMIES[e.kind].coins * elite + s.bounty) * road.coins * omen.coins * reward);
    // Each kill charges Arrow Rain and the caltrops and carries the streak on (or starts a new one).
    state.rain.charge = Math.min(state.rain.need, state.rain.charge + 1);
    state.caltrops.charge = Math.min(state.caltrops.need, state.caltrops.charge + 1);
    const streak = state.streak;
    streak.count = streak.ms > 0 ? streak.count + 1 : 1;
    streak.ms = s.streakMs;
    streak.best = Math.max(streak.best, streak.count);
    const base = ENEMIES[e.kind].xp * s.xpGain * road.xp * omen.xp * (e.trait ? ELITE_XP : 1) * reward;
    const bonus = base * streakBonus(streak.count);
    streak.bonusXp += bonus;
    const radius = ENEMIES[e.kind].radius;
    addEffect(state, { kind: 'death', x: e.x, y: e.y, radius });
    // A Splitting elite falls apart into goblins, on the road even if it flew.
    if (e.trait === 'splitting') {
      const y = Math.min(FIELD.bottom - 8, Math.max(FIELD.top + 8, e.y));
      addEffect(state, { kind: 'split', x: e.x, y, radius });
      const hp = Math.max(1, Math.round(hpOf(state, 'goblin') * SPLIT_HP));
      // They land on the road's side of a standing barricade (or stake line), so one that flew over
      // it does not drop goblins behind it, where nothing stops them reaching the hero.
      const front = state.barricade.hp > 0 ? BARRICADE_FRONT : state.forts.stakeHp > 0 ? STAKE_FRONT : null;
      const x = Math.max(front === null ? HERO_FRONT + 20 : front + ENEMIES.goblin.radius, e.x + 10);
      for (let i = 0; i < SPLIT_INTO; i++) addFoe(state, 'goblin', x, y + (i - (SPLIT_INTO - 1) / 2) * 22, hp, null);
    }
    addEffect(state, { kind: 'xp', x: e.x, y: e.y - radius * 1.6, amount: base + bonus, streak: streak.count });
    addEffect(state, { kind: 'orb', x: e.x, y: e.y - radius, amount: base + bonus });
    gainXp(state, base + bonus);
  }
}

/**
 * Where a volley or a patch aimed at (x, y) lands: on the seen road in front of the barricade
 * (short of mid-field on a Night wave). The scene draws its aiming ring there too.
 */
export function fieldSpot(state: GameState, x: number, y: number) {
  return {
    x: Math.round(Math.min(sightOf(state) - 10, Math.max(BARRICADE_FRONT + 30, x))),
    y: Math.round(Math.min(FIELD.bottom, Math.max(FIELD.top, y))),
  };
}

/**
 * Looses Arrow Rain on the ring around (x, y), kept on the seen road in front of the barricade
 * (short of mid-field on a Night wave), once kills have charged it. Returns whether it was loosed.
 */
export function loose(state: GameState, x: number, y: number) {
  if (held(state) || state.choices || state.rain.charge < state.rain.need) return false;
  state.rain.charge = 0;
  state.rain.volleys.push({
    id: state.nextId++,
    ...fieldSpot(state, x, y),
    ms: RAIN_FALL_MS,
  });
  return true;
}

/**
 * Strews caltrops over the patch around (x, y), kept on the seen road in front of the barricade
 * (short of mid-field on a Night wave), once kills have charged them. Returns whether they were dropped.
 */
export function strew(state: GameState, x: number, y: number) {
  const c = state.caltrops;
  if (held(state) || state.choices || c.charge < c.need) return false;
  c.charge = 0;
  c.patches.push({
    id: state.nextId++,
    ...fieldSpot(state, x, y),
    ms: 0,
    waves: CALTROP_WAVES,
  });
  if (c.patches.length > MAX_PATCHES) c.patches.shift();
  return true;
}

/** Whether a foe at (x, y) with this radius stands in the Arrow Rain ring around (cx, cy), `k` times as wide (Cloudburst). */
export const inRing = (cx: number, cy: number, x: number, y: number, radius: number, k = 1) =>
  ((x - cx) / (RAIN_RING.rx * k + radius / 2)) ** 2 + ((y - cy) / (RAIN_RING.ry * k + radius / 2)) ** 2 <= 1;

/** How many times wider Arrow Rain's ring is: Cloudburst, and a lookout while its waves last. */
export const rainRingOf = (state: Pick<GameState, 'ranks' | 'relics' | 'heat' | 'forts'>) => stats(state).rainRing * (state.forts.lookout > 0 ? LOOKOUT_RING : 1);

/** Where Arrow Rain hits the most foes in view: on the one with the most others in its ring. */
export function crowdSpot(state: GameState) {
  const foes = targets(state, 'nearest');
  if (foes.length === 0) return null;
  const k = rainRingOf(state);
  const crowd = (e: Enemy) => foes.filter((o) => inRing(e.x, e.y, o.x, o.y, ENEMIES[o.kind].radius, k)).length;
  const best = foes.reduce((a, e) => (crowd(e) > crowd(a) ? e : a), foes[0]);
  return { x: best.x, y: best.y };
}

/** Brings Arrow Rain volleys down: each hurts every foe in its ring when it lands. */
function landVolleys(state: GameState, s: Stats, dt: number) {
  const volleys = state.rain.volleys;
  if (volleys.length === 0) return;
  for (const v of volleys) {
    v.ms -= dt;
    if (v.ms > 0) continue;
    addEffect(state, { kind: 'rain', x: v.x, y: v.y });
    const k = rainRingOf(state);
    for (const e of state.enemies) {
      if (inRing(v.x, v.y, e.x, e.y, ENEMIES[e.kind].radius, k)) hurt(e, s.damage * s.rainDamage * (ENEMIES[e.kind].boss ? s.bossDamage : 1), true);
    }
  }
  state.rain.volleys = volleys.filter((v) => v.ms > 0);
  removeDead(state);
}

function gainXp(state: GameState, xp: number) {
  state.xp += xp;
  while (state.xp >= xpToNext(state.level)) {
    state.xp -= xpToNext(state.level);
    state.level++;
    state.levelUps++;
  }
  if (state.levelUps > 0 && !state.choices) offer(state);
}

/** Puts three upgrades up for the next pending level-up and starts the time to pick one. */
export function offer(state: GameState) {
  state.choices = rollChoices(state);
  state.pickMs = AUTO_PICK_MS;
}

/**
 * Puts the cards back up for a pending level-up, with the full time to pick: the same ones when they
 * are kept (from the last run, or from the save on a reload), else new ones.
 */
export function reoffer(state: GameState, choices: UpgradeId[] | null) {
  if (state.levelUps === 0) return;
  if (!choices) return offer(state);
  state.choices = choices;
  state.pickMs = AUTO_PICK_MS;
}

/** Mend the Barricade: repairs half of it (a quarter from Heat 3), counted in `ranks` for the skill book. */
function mend(state: GameState) {
  state.ranks.mend = (state.ranks.mend ?? 0) + 1;
  state.barricade.hp = Math.min(state.barricade.max, state.barricade.hp + state.barricade.max * stats(state).mend);
}

/**
 * Three different upgrades to choose from: fillers take the cards no upgrade is left for. With two
 * upgrades left the third card is Mend the Barricade, and with one left War Chest and Second Wind
 * take the other two, so every filler is offered on the way to the last skill. Once every skill is
 * learned, every level-up offers the base skills, with no cap on their ranks.
 */
export function rollChoices(state: GameState): UpgradeId[] {
  const pool = offerable(state);
  if (pool.length === 0) return [...baseSkills(state.hero)];
  const picks: UpgradeId[] = [];
  while (picks.length < 3 && pool.length > 0) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  if (picks.length === 2) picks.push(FILLERS[0]);
  else if (picks.length === 1) picks.push(...FILLERS.slice(1));
  return picks;
}

/** Takes one of the offered upgrades; the battle goes on once no level-ups are left to pick. */
export function pick(state: GameState, id: UpgradeId) {
  if (!state.choices?.includes(id)) return false;
  // Every skill learned: from now on the level-ups offer the base skills (and the skill book is full).
  if (offerable(state).length === 0) state.mastered = true;
  // Fillers count too, so the skill book can show how often the barricade was mended.
  if (id === 'mend') mend(state);
  else state.ranks[id] = (state.ranks[id] ?? 0) + 1;
  const barricadeMax = stats(state).barricadeMax;
  if (id === 'timber') state.barricade = { hp: barricadeMax, max: barricadeMax };
  if (id === 'purse') state.coins += PURSE_COINS;
  if (id === 'wind') {
    state.rain.charge = state.rain.need;
    state.caltrops.charge = state.caltrops.need;
  }
  state.levelUps--;
  state.choices = null;
  if (state.levelUps > 0) offer(state);
  return true;
}

function clearWave(state: GameState) {
  if (state.frontier === 'pass') state.passBest = Math.max(state.passBest, state.wave);
  else state.bestWave = Math.max(state.bestWave, state.wave);
  // The endless siege keeps each map's best wave of its own.
  if (state.endless) state.endlessBest[state.frontier] = Math.max(state.endlessBest[state.frontier], state.wave);
  const plan = state.daily;
  // The relic chest at the end of the road: a lasting bonus for beating the boss (two after a
  // Hardened Road). Then the hero picks the next road from two. On the daily siege the day's plan
  // sets both: the chest's relics and the one road taken.
  if (isBossWave(state.wave)) {
    state.relicFound = [];
    const road = state.wave / 10 - 1;
    for (let i = 0; i < roadEffects(state.road).relics; i++) {
      const id = plan ? planned(planned(plan.chests, road), i) : RELIC_IDS[Math.floor(Math.random() * RELIC_IDS.length)];
      state.relics[id] = (state.relics[id] ?? 0) + 1;
      state.relicFound.push(id);
    }
    if (plan) state.road = planned(plan.roads, road);
    else {
      const roads = [...ROAD_IDS];
      state.roadChoices = [0, 1].map(() => roads.splice(Math.floor(Math.random() * roads.length), 1)[0]);
      state.roadMs = AUTO_PICK_MS;
    }
  }
  // Caltrops wear off once they have lain for CALTROP_WAVES waves, and the lookout after its waves.
  for (const p of state.caltrops.patches) p.waves--;
  state.caltrops.patches = state.caltrops.patches.filter((p) => p.waves > 0);
  if (state.forts.lookout > 0) state.forts.lookout--;
  // Clearing the third boss's wave lifts the siege (or wins the frozen pass): the run is won and the
  // next heat unlocked. The victory panel holds everything until "Keep fighting" (or a new run at a
  // heat). The daily siege has no victory panel: it fights on until the hero falls.
  const won = state.wave === WIN_WAVE && !state.won && !plan;
  if (won) {
    state.won = true;
    if (state.frontier === 'pass') state.passWon = true;
    state.heatUnlocked = Math.max(state.heatUnlocked, Math.min(MAX_HEAT, state.heat + 1));
  }
  state.wave++;
  state.phase = 'break';
  // From wave 4 the break names the next wave's omen (not after a boss), and lasts long enough to
  // read it; on the daily siege it is the day's omen for that wave.
  const omen = omenWave(state.wave) ? (plan ? planned(plan.omens, state.wave) : OMEN_IDS[Math.floor(Math.random() * OMEN_IDS.length)]) : null;
  state.omen = omen ? { id: omen, accepted: false } : null;
  state.breakMs = state.omen ? OMEN_BREAK_MS : BREAK_MS;
  state.missiles = [];
  // An Oakheart Charm from the chest makes the barricade bigger at once.
  const s = stats(state);
  const max = s.barricadeMax;
  if (max > state.barricade.max) state.barricade = { hp: state.barricade.hp + max - state.barricade.max, max };
  state.barricade.hp = Math.min(state.barricade.max, state.barricade.hp + state.barricade.max * s.repair);
  // A fortification bought during the wave is set up now, as this break's one.
  if (state.forts.queued) {
    setUpFort(state, state.forts.queued);
    state.forts.queued = null;
  }
  if (won) state.phase = 'won';
}

/**
 * From the victory panel: the siege is lifted, and the hero holds on past wave 30 at this heat in the
 * endless siege, every wave stronger than the last (see endless.ts).
 */
export function keepFighting(state: GameState) {
  if (state.phase !== 'won') return false;
  state.phase = 'break';
  state.endless = true;
  return true;
}

/**
 * A new run at this heat (one that is unlocked), from wave 1 (or a forced march's start) with the
 * hero kept, on this map (the frozen pass once the siege is lifted, else the vale).
 */
export function startHeat(state: GameState, heat: number, start = 1, frontier: FrontierId = state.frontier): GameState {
  const progress = progressOf(state);
  progress.heat = Math.max(0, Math.min(progress.heatUnlocked, heat));
  progress.frontier = canFrontier(progress, frontier) ? frontier : 'vale';
  // Leaving a won run for a new heat ends it, so it counts like a fall does (which counted already).
  if (state.phase !== 'over') progress.runs++;
  const next = newRun(progress, state.aimMode, canMarch(bestOn(progress, progress.frontier), start) ? start : 1);
  reoffer(next, state.choices);
  return next;
}

/** From the victory panel after lifting the siege: the hero marches on to wave 1 of the frozen pass, at the same heat. */
export const marchOn = (state: GameState) => startHeat(state, state.heat, 1, 'pass');

/** Takes one of the two roads offered after a boss; the break then counts down to its first wave. */
export function pickRoad(state: GameState, road: RoadId) {
  if (!state.roadChoices?.includes(road)) return false;
  state.road = road;
  state.roadChoices = null;
  state.breakMs = BREAK_MS;
  return true;
}

function gameOver(state: GameState) {
  state.phase = 'over';
  state.runs++;
  state.missiles = [];
}

/**
 * After a fall, a new run with the hero's level and upgrades kept: from wave 1, or on a forced
 * march from the first wave of a road whose boss the hero has beaten (wave 11 or 21).
 */
export function fightAgain(state: GameState, start = 1, frontier: FrontierId = state.frontier): GameState {
  const progress = progressOf(state);
  progress.frontier = canFrontier(progress, frontier) ? frontier : 'vale';
  const next = newRun(progress, state.aimMode, canMarch(bestOn(progress, progress.frontier), start) ? start : 1);
  reoffer(next, state.choices);
  return next;
}

/**
 * The daily siege's run: a fresh ranger on wave 1 of the vale, with the day's two relics and its
 * plan of roads, omens and chests (see daily.ts). Its progress is never saved.
 */
export function dailyRun(plan: DailyPlan, aimMode: AimMode): GameState {
  const progress = freshProgress();
  for (const id of plan.relics) progress.relics[id] = (progress.relics[id] ?? 0) + 1;
  return newRun(progress, aimMode, 1, plan);
}

/** Whether the hero may retire for a legacy: every skill learned, or the siege lifted (a heat unlocked). */
export const canRetire = (state: GameState) => !state.daily && (offerable(state).length === 0 || state.heatUnlocked > 0);

/** The relic the "A first relic" legacy would keep, rolled when the retire panel opens. */
export const rollLegacyRelic = (): RelicId => RELIC_IDS[Math.floor(Math.random() * RELIC_IDS.length)];

/**
 * Retires the hero (after a fall or from the victory panel) for this legacy perk, with `relic` the
 * first relic when that is the one kept. The next hero, of class `hero` (the mage is open from this
 * first legacy on), starts from scratch on wave 1 of the vale, with every legacy the retired heroes
 * left. Returns null when the hero cannot retire or the perk is kept already.
 */
export function retire(state: GameState, id: LegacyId, relic: RelicId, hero: HeroClass = 'ranger'): GameState | null {
  if ((state.phase !== 'over' && state.phase !== 'won') || !canRetire(state) || !canKeep(state.legacy, id)) return null;
  const legacy = { ...state.legacy, relics: [...state.legacy.relics], retired: state.legacy.retired + 1 };
  if (id === 'relic') legacy.relics.push(relic);
  else legacy[id] = true;
  return newRun(freshProgress(legacy, canClass(legacy, hero) ? hero : 'ranger'), state.aimMode);
}

function nearest(foes: Enemy[], x: number, y: number) {
  let best: Enemy | undefined;
  let bestD = Infinity;
  for (const e of foes) {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bestD) [best, bestD] = [e, d];
  }
  return best;
}

function addEffect(state: GameState, e: Omit<Effect, 'id' | 'ms' | 'total'>) {
  const total = EFFECT_MS[e.kind];
  state.effects.push({ ...e, id: state.nextId++, ms: total, total });
}

function ageEffects(state: GameState, dt: number) {
  for (const e of state.effects) e.ms -= dt;
  state.effects = state.effects.filter((e) => e.ms > 0);
}
