/**
 * The rules of a run: moving, the heroes' weapons and signatures, every upgrade's effect, the
 * bots, pickups and level-ups. Pure state changes, no drawing; randomness comes from `rand`
 * and time from the `dt` the scene hands over, so a run replays exactly from the same inputs.
 */
import { HEROES, isKnight, type HeroId } from './heroes';
import {
  BOSS, DIFF, ELITE, EMBER, ENEMY, HERO_R, KNIGHT, LEASH, LINE, MAX_ENEMIES, MAX_SHARDS, RATS, ROLLER, RUN_MS,
  POWER, POWER_UPS, SCRAP, SHARD, SPAWN_RING, SPORE, TOAD, WALKER, WISP, freshHero, freshState, isStructure, refreshUnlocks, statsOf, xpFor,
  type AllyKind, type PowerUp, type BoltColor, type Bomb, type Bullet, type Enemy, type EnemyKind, type GameState, type Hazard, type Pickup, type Stats,
} from './state';
import {
  contactMod, crush, dashEnd, dashSweep, foeMod, healFactor, knightAbilities, knightAllies, knightAttack, knightGuard,
  knightSignature, moveKnightAlly, onHealed, onHurt, onKill, rescue,
} from './blades';
import {
  droneSpot, hurtFactor, moveSquadAlly, squadAbilities, squadAllies, squadAttack, squadBlock, squadCrit, squadHeal, squadHurt,
  squadKill, squadSignature, squadStart, syncSquad, turnedBonus,
} from './squad';
import { CAPSTONES, CROSSOVERS, FILLER, MAX_TIER, UPGRADES, at, cardCount, rewardChoices, rollChoices } from './upgrades';
import { ARENA_MS, BOG, BOSSES, CHAMPION, CREDITS, PLANETS, SIEGE, STRIKE, VENT, type FoeKind } from './planets';
// `t` is a common local name here (targets, time), so the translator goes by `tr`.
import { t as tr, type TextKey } from '../i18n';
import { cancelObjective, objectives } from './objectives';
import { HEAT, hot } from './heat';
import { PERK, type ArmouryId } from './armoury';
import { MUT, rand, reseed, weekSeed, type MutatorId } from './weekly';

/** What the player is doing this frame: a move direction (length up to 1) and the signature key. */
export interface Input {
  mx: number;
  my: number;
  signature: boolean;
}

/** The longest sim step, ms: a longer frame is split so fast bolts don't skip over bots. */
const STEP_MS = 16;
/** The longest frame the sim takes at once (a hidden tab or a hitch is cut to this). */
const MAX_FRAME_MS = 100;
/** After a hit the hero takes no damage for this long, ms. */
export const HURT_GRACE_MS = 450;
/** Colours of the blast rings. */
const BLAST = { bomb: '#9fe8ff', wreck: '#ffd23f', hero: '#ffb347', bot: '#ff6a4d', frag: '#ffd36b', shield: '#ff9a5a', vent: '#ff6a3c', shell: '#9fd4ff', stomp: '#d6efff', strike: '#fff08a' };

/** The stats for this frame, computed once per tick, and whether the hero is a knight (or Elara Voss or Triad-77). */
let st: Stats = statsOf(freshState());
let knight = false;
let squad = false;
const isSquad = (id: HeroId) => id === 'elara' || id === 'triad';

/** The stats for this frame (for `blades.ts`). */
export const stats = () => st;

/**
 * Works out the stats and hero flags for `s` (every frame, when a run starts, and when a saved run
 * is picked up, so a heal on a panel before the first fight step goes to the right hero).
 */
export function prepare(s: GameState) {
  st = statsOf(s);
  knight = isKnight(s.hero!);
  squad = isSquad(s.hero!);
}

// ---------------------------------------------------------------------------------------------
// Starting and choosing

/** How a run starts besides its hero: its rift heat and the Armoury ranks bought. */
export interface RunSetup {
  heat?: number;
  perks?: Partial<Record<ArmouryId, number>>;
  /** A weekly run: its week and mutators (`rand` is seeded for it). */
  week?: number;
  mutators?: MutatorId[];
}

/** Starts a run with the chosen hero, from a fresh state; `known` are the heroes unlocked before. */
export function startRun(s: GameState, id: HeroId, known: HeroId[] = [], ringOut = 0, setup: RunSetup = {}) {
  Object.assign(s, freshState());
  s.ringOut = ringOut;
  s.heat = setup.heat ?? 0;
  s.perks = { ...setup.perks };
  s.week = setup.week ?? -1;
  s.mutators = [...(setup.mutators ?? [])];
  if (s.week >= 0) reseed(weekSeed(s.week));
  s.maxHpMod = (1 + PERK.rations * (s.perks.rations ?? 0)) * (s.mutators.includes('glass') ? MUT.glassHp : 1);
  s.credits = PERK.purse * (s.perks.purse ?? 0);
  const hero = HEROES[id];
  s.hero = id;
  s.known = [...known];
  s.phase = 'run';
  s.player = freshHero();
  s.player.hp = s.player.maxHp = Math.round(hero.maxHp * s.maxHpMod);
  s.player.r = hero.r ?? HERO_R;
  s.player.fireMs = 300;
  prepare(s);
  if (squad) squadStart(s);
}

/** Takes the card at `index` during a level-up (or a free pick won in the arena). */
export function choose(s: GameState, index: number) {
  if (s.phase !== 'levelup' || !s.choices) return;
  const id = s.choices[index];
  if (!id) return;
  if (id === FILLER.id) heal(s, 0.3 * s.player.maxHp);
  else raise(s, id);
  if (s.rewardPicks > 0) s.rewardPicks -= 1;
  else s.pendingLevels -= 1;
  nextPick(s);
}

/** Shows the next cards (free picks first), or goes where the run is headed when none are left. */
export function nextPick(s: GameState) {
  if (s.rewardPicks > 0) {
    s.phase = 'levelup';
    s.choices = rewardChoices(s.hero!, s.ranks);
  } else if (s.pendingLevels > 0) {
    s.phase = 'levelup';
    // The Armoury's Field Briefing deals a fourth card at the run's first level-up.
    const briefing = (s.perks.briefing ?? 0) > 0 && !s.briefed;
    s.briefed ||= briefing;
    s.choices = rollChoices(s.hero!, s.ranks, Math.min(4, cardCount(s.hero!) + (briefing ? 1 : 0)));
  } else {
    s.choices = null;
    s.phase = s.after;
    s.after = 'run';
  }
}

/** One tier less of an upgrade (the shrine's price); at tier 0 it is gone and frees its slot. */
export function lower(s: GameState, id: string) {
  const rank = (s.ranks[id] ?? 0) - 1;
  if (rank <= 0) delete s.ranks[id];
  else s.ranks[id] = rank;
  refreshUnlocks(s);
  refreshHealth(s);
  syncAllies(s);
}

/** Puts max health back in line with the stats (after the cache's cost or a tier lost). */
export function refreshHealth(s: GameState) {
  st = statsOf(s);
  s.player.maxHp = st.maxHp;
  s.player.hp = Math.min(s.player.hp, st.maxHp);
}

/** One more tier of an upgrade, with what follows from it: health, allies, unlocks. */
export function raise(s: GameState, id: string) {
  const before = statsOf(s).maxHp;
  s.ranks[id] = Math.min(MAX_TIER, (s.ranks[id] ?? 0) + 1);
  for (const fresh of refreshUnlocks(s)) {
    const cap = CAPSTONES.find((c) => c.id === fresh);
    const cross = CROSSOVERS.find((c) => c.id === fresh);
    pop(s, cap ? tr('capstonePop', { name: tr(cap.name) }) : tr('crossoverPop', { name: tr(cross!.name) }), cap ? '#ffe066' : '#b48cff');
  }
  st = statsOf(s);
  const p = s.player;
  p.maxHp = st.maxHp;
  if (st.maxHp > before) p.hp += st.maxHp - before;
  syncAllies(s);
}

// ---------------------------------------------------------------------------------------------
// The frame

export function tick(s: GameState, dtMs: number, input: Input) {
  if (s.phase !== 'run') return;
  prepare(s);
  const dt = Math.min(dtMs, MAX_FRAME_MS);
  if (input.signature) signature(s);
  const steps = Math.max(1, Math.ceil(dt / STEP_MS));
  for (let i = 0; i < steps && s.phase === 'run'; i++) step(s, dt / steps, input);
  // Visual leftovers age once per frame.
  for (const b of s.blasts) b.ms -= dt;
  s.blasts = s.blasts.filter((b) => b.ms > 0);
  for (const p of s.pops) p.ms -= dt;
  s.pops = s.pops.filter((p) => p.ms > 0);
  if (s.slashes.length || s.zaps.length) {
    for (const f of s.slashes) f.ms -= dt;
    s.slashes = s.slashes.filter((f) => f.ms > 0);
    for (const f of s.zaps) f.ms -= dt;
    s.zaps = s.zaps.filter((f) => f.ms > 0);
  }
  // Level-ups, and free picks won by an objective.
  if (s.phase === 'run' && (s.pendingLevels > 0 || s.rewardPicks > 0)) nextPick(s);
}

function step(s: GameState, ms: number, input: Input) {
  const dt = ms / 1000;
  s.time += ms;
  s.runMs += ms;
  buildGrid(s);
  moveHero(s, ms, input);
  director(s, ms);
  objectives(s, ms);
  if (s.lureMs > 0) s.lureMs -= ms;
  if (s.overdriveMs > 0) s.overdriveMs -= ms;
  primary(s, ms);
  abilities(s, ms);
  if (knight) knightAbilities(s, ms);
  if (squad) squadAbilities(s, ms);
  moveAllies(s, ms);
  moveEnemies(s, ms);
  moveBullets(s, ms);
  bombs(s, ms);
  fires(s, dt);
  hazards(s, ms);
  pickups(s, ms);
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  // The arena ends when every elite has fallen, or when its minute is up.
  if (s.arena && s.phase === 'run') {
    const left = s.enemies.some((e) => e.elite);
    if (!left || s.time >= ARENA_MS) {
      s.arenaWon = !left;
      s.phase = 'cleared';
    }
  }
}

// ---------------------------------------------------------------------------------------------
// A grid of the bots, so bolts and blasts only look at the ones nearby.

const CELL = 64;
let grid = new Map<number, Enemy[]>();
const keyOf = (cx: number, cy: number) => cx * 100_003 + cy;

function buildGrid(s: GameState) {
  grid = new Map();
  for (const e of s.enemies) {
    if (e.kind === 'boss' || e.hp <= 0) continue;
    const k = keyOf(Math.floor(e.x / CELL), Math.floor(e.y / CELL));
    const list = grid.get(k);
    if (list) list.push(e);
    else grid.set(k, [e]);
  }
}

/** The widest body a foe other than the boss can have (an elite walker, the objective cache), px. */
const MAX_FOE_R = 32;

/** Calls `fn` for each living bot whose body reaches within `r` of a point, the boss included. */
export function near(s: GameState, x: number, y: number, r: number, fn: (e: Enemy, d: number) => void) {
  const reach = r + MAX_FOE_R;
  const x0 = Math.floor((x - reach) / CELL);
  const x1 = Math.floor((x + reach) / CELL);
  const y0 = Math.floor((y - reach) / CELL);
  const y1 = Math.floor((y + reach) / CELL);
  for (let cx = x0; cx <= x1; cx++) {
    for (let cy = y0; cy <= y1; cy++) {
      const list = grid.get(keyOf(cx, cy));
      if (!list) continue;
      for (const e of list) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - x, e.y - y);
        if (d <= r + e.r) fn(e, d);
      }
    }
  }
  const boss = s.enemies.find((e) => e.kind === 'boss' && e.hp > 0);
  if (boss) {
    const d = Math.hypot(boss.x - x, boss.y - y);
    if (d <= r + boss.r) fn(boss, d);
  }
}

/** The `n` living bots nearest a point within `range`, nearest first (foes turned to the hero's side left out). */
export function nearest(s: GameState, x: number, y: number, n: number, range: number, skip: number[] = []): Enemy[] {
  const found: { e: Enemy; d: number }[] = [];
  for (const e of s.enemies) {
    if (e.hp <= 0 || e.charmMs > 0 || skip.includes(e.id)) continue;
    const d = Math.hypot(e.x - x, e.y - y) - e.r;
    if (d > range) continue;
    if (found.length < n) {
      found.push({ e, d });
      found.sort((a, b) => a.d - b.d);
    } else if (d < found[n - 1].d) {
      found[n - 1] = { e, d };
      found.sort((a, b) => a.d - b.d);
    }
  }
  return found.map((f) => f.e);
}

/** A spot in the thickest swarm near the hero: the bot with the most others around it. */
export function swarmSpot(s: GameState, range: number) {
  const p = s.player;
  const pool = nearest(s, p.x, p.y, 16, range);
  if (!pool.length) {
    return { x: p.x + Math.cos(p.facing) * 140, y: p.y + Math.sin(p.facing) * 140 };
  }
  let best = pool[0];
  let most = -1;
  for (const e of pool) {
    let count = 0;
    near(s, e.x, e.y, 70, () => (count += 1));
    if (count > most) {
      most = count;
      best = e;
    }
  }
  return { x: best.x, y: best.y };
}

// ---------------------------------------------------------------------------------------------
// The hero

function moveHero(s: GameState, ms: number, input: Input) {
  const p = s.player;
  const dt = ms / 1000;
  const len = Math.hypot(input.mx, input.my);
  p.moving = len > 0.05;
  if (p.moving) p.facing = Math.atan2(input.my, input.mx);
  if (p.dashMs > 0 && p.dashKind === 'jet') {
    p.dashMs -= ms;
    p.x += Math.cos(p.dashAngle) * 750 * dt;
    p.y += Math.sin(p.dashAngle) * 750 * dt;
    s.fires.push({ id: s.nextId++, x: p.x, y: p.y, r: 22, ms: 2000, dps: at([12, 12, 20, 20, 26], s.ranks['jump-trooper'] ?? 0, 12) });
    if (p.dashMs <= 0 && s.capstones.includes('skyfall')) explode(s, p.x, p.y, 110, 60, BLAST.frag);
  } else if (p.dashMs > 0) {
    // A knight's dash: a blade dash cuts through, a leap or a hunt homes in on its target.
    p.dashMs -= ms;
    const step = p.dashSpeed * dt;
    const t = p.dashTarget ? s.enemies.find((e) => e.id === p.dashTarget && e.hp > 0) : undefined;
    if (t) {
      const d = Math.hypot(t.x - p.x, t.y - p.y);
      p.dashAngle = Math.atan2(t.y - p.y, t.x - p.x);
      if (d - t.r - p.r <= step) p.dashMs = 0;
    }
    p.x += Math.cos(p.dashAngle) * step;
    p.y += Math.sin(p.dashAngle) * step;
    p.facing = p.dashAngle;
    dashSweep(s);
    if (p.dashMs <= 0) {
      p.dashMs = 0;
      dashEnd(s);
    }
  } else if (p.moving) {
    const k = Math.min(1, len) * st.speed * (p.slowMs > 0 ? 1 - p.slowPct : 1) * dt;
    p.x += (input.mx / len) * k;
    p.y += (input.my / len) * k;
  }
  p.stillMs = p.moving ? 0 : p.stillMs + ms;
  p.sigMs = Math.max(0, p.sigMs - ms);
  p.sigActiveMs = Math.max(0, p.sigActiveMs - ms);
  p.hurtMs = Math.max(0, p.hurtMs - ms);
  p.slowMs = Math.max(0, p.slowMs - ms);
  if (p.slowMs <= 0) p.slowPct = 0;
  if (st.regen > 0 && p.hp < p.maxHp) {
    p.regen += st.regen * dt;
    if (p.regen >= 1) {
      const whole = Math.floor(p.regen);
      p.regen -= whole;
      heal(s, whole);
    }
  }
}

export function heal(s: GameState, amount: number) {
  const p = s.player;
  if (knight) {
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + amount * healFactor(s));
    onHealed(s, p.hp - before);
    return;
  }
  if (squad && squadHeal(s, amount)) return;
  p.hp = Math.min(p.maxHp, p.hp + amount);
}

/** Whether the hero takes no damage right now (Brace, mid-dash, or just hit). */
function untouchable(s: GameState) {
  return (s.hero === 'tr9' && s.player.sigActiveMs > 0) || s.player.dashMs > 0 || s.player.hurtMs > 0;
}

/** A hit on the hero; `x`, `y` say where it came from (Triad-77's nearest bot takes it). */
function hurtHero(s: GameState, dmg: number, x?: number, y?: number) {
  if (untouchable(s) || s.phase !== 'run') return;
  if (hot(s.heat, 'hurt')) dmg *= HEAT.hurt;
  if (s.mutators.includes('fragile')) dmg *= MUT.fragileHurt;
  const p = s.player;
  // The Barrier Emitter takes a hit when charged.
  const barrier = s.ranks.barrier ?? 0;
  if (barrier > 0 && (s.cd.barrier ?? 0) <= 0) {
    s.cd.barrier = at([21000, 18000, 15000, 12000, 9000], barrier, 21000);
    p.hurtMs = HURT_GRACE_MS;
    s.blasts.push({ id: s.nextId++, x: p.x, y: p.y, r: 30, ms: 260, maxMs: 260, color: BLAST.bomb });
    return;
  }
  // A Shield power-up takes the hit.
  if (s.shieldHits > 0) {
    s.shieldHits -= 1;
    p.hurtMs = HURT_GRACE_MS;
    s.blasts.push({ id: s.nextId++, x: p.x, y: p.y, r: 34, ms: 260, maxMs: 260, color: BLAST.shield });
    return;
  }
  if (knight) {
    // Foresight: a chance to dodge; a barrier takes what it can first.
    if (st.dodge > 0 && rand() < st.dodge) {
      p.hurtMs = HURT_GRACE_MS / 2;
      return;
    }
    let taken = dmg * (1 - st.armour);
    const soak = Math.min(p.barrier, taken);
    p.barrier -= soak;
    taken -= soak;
    p.barrierMs = 0;
    p.hp -= taken;
    s.damageTaken += taken;
    p.hurtMs = HURT_GRACE_MS;
    onHurt(s);
    if (p.hp <= 0 && !rescue(s)) {
      p.hp = 0;
      s.phase = 'lost';
    }
    return;
  }
  let taken = dmg * (1 - st.armour);
  if (squad) {
    taken *= hurtFactor(s);
    if (squadHurt(s, taken, x, y)) return;
  }
  p.hp -= taken;
  s.damageTaken += taken;
  // A moment of grace after each hit, so a crowd can't take it all at once.
  p.hurtMs = HURT_GRACE_MS;
  if (p.hp <= 0) {
    p.hp = 0;
    s.phase = 'lost';
  }
}

/** The signature move on Space or its button, when it is ready. */
function signature(s: GameState) {
  const p = s.player;
  if (p.sigMs > 0 || !s.hero) return;
  const hero = HEROES[s.hero];
  if (knight) {
    // A knight's move needs something to act on; without it, nothing is spent.
    if (!knightSignature(s)) return;
    p.sigMs = hero.signature.cooldownMs * st.sigCooldown;
    s.signatures += 1;
    return;
  }
  p.sigMs = hero.signature.cooldownMs * st.sigCooldown;
  s.signatures += 1;
  if (squad) squadSignature(s);
  else if (s.hero === 'rook') p.sigActiveMs = 5000;
  else if (s.hero === 'tr9') {
    p.sigActiveMs = 3000;
    // The bracing pulse throws every bot near back.
    near(s, p.x, p.y, 150, (e) => {
      knock(e, p.x, p.y, 340);
      damage(s, e, 10);
    });
    s.blasts.push({ id: s.nextId++, x: p.x, y: p.y, r: 150, ms: 420, maxMs: 420, color: BLAST.shield });
  } else {
    const tx = p.x + Math.cos(p.facing) * 170;
    const ty = p.y + Math.sin(p.facing) * 170;
    addBomb(s, 'frag', tx, ty, 600, 130, 90, { fromX: p.x, fromY: p.y });
  }
}

// ---------------------------------------------------------------------------------------------
// Weapons

interface BoltOpts {
  speed?: number;
  life?: number;
  pierce?: number;
  bounces?: number;
  color?: BoltColor;
  homing?: number;
  r?: number;
  /** A thrown blade: spins, and comes back after `ret` ms. */
  spin?: boolean;
  ret?: number;
}

export function bolt(s: GameState, x: number, y: number, angle: number, dmg: number, o: BoltOpts = {}) {
  const hero = HEROES[s.hero ?? 'rook'];
  const speed = o.speed ?? hero.boltSpeed;
  const range = hero.range * ((s.ranks.marksman ?? 0) >= 3 ? 1.3 : 1);
  s.bullets.push({
    id: s.nextId++, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, dmg,
    pierce: o.pierce ?? st.pierce, bounces: o.bounces ?? st.bounces,
    lifeMs: o.life ?? (range / speed) * 1000, hostile: false, color: o.color ?? s.hero ?? 'rook',
    hit: [], homing: o.homing ?? 0, bounced: false, r: o.r ?? 4, spin: o.spin ?? false, ret: o.ret ?? 0, back: false, toad: false, bossMs: 0,
  });
}

/** One trigger pull: the hero's pellets, plus Scatter Shot's side bolts. */
export function volley(s: GameState, x: number, y: number, angle: number, dmg: number, o: BoltOpts = {}, extraPellets = 0) {
  const hero = HEROES[s.hero ?? 'rook'];
  const pellets = hero.pellets + extraPellets;
  const spread = pellets > 1 ? hero.spread * (1 + 0.15 * extraPellets) : 0;
  for (let i = 0; i < pellets; i++) {
    const off = pellets > 1 ? -spread + (2 * spread * i) / (pellets - 1) : 0;
    bolt(s, x, y, angle + off + (rand() * 2 - 1) * hero.jitter, dmg, o);
  }
  const scatter = s.ranks.scatter ?? 0;
  if (scatter > 0) {
    const pct = at([0.5, 0.7, 0.85, 0.85, 1], scatter, 0);
    const sides = scatter >= 4 ? [0.28, 0.5] : [0.3];
    for (const a of sides) {
      bolt(s, x, y, angle - a, dmg * pct, o);
      bolt(s, x, y, angle + a, dmg * pct, o);
    }
  }
}

function fireRate(s: GameState) {
  const rally = s.hero === 'rook' && s.player.sigActiveMs > 0 ? 1.5 : 1;
  return st.fireRate * rally;
}

function primary(s: GameState, ms: number) {
  if (knight) {
    knightAttack(s, ms);
    return;
  }
  if (squad) {
    squadAttack(s, ms, fireRate(s));
    return;
  }
  const p = s.player;
  const hero = HEROES[s.hero!];
  p.fireMs -= ms * fireRate(s);
  if (p.fireMs > 0) return;
  // Every weapon aims at the nearest foe (Rook's second gun at the next nearest).
  const targets = nearest(s, p.x, p.y, 2, hero.range);
  if (!targets.length) {
    // Nothing in range: hold the shot until something is.
    p.fireMs = 0;
    return;
  }
  p.fireMs += hero.fireMs;
  p.shots += 1;
  if (hero.aim === 'nearest-two') {
    const twin = s.capstones.includes('twin-storm');
    const sides = twin ? [0, 1] : [p.side];
    p.side = 1 - p.side;
    for (const side of sides) {
      const t = targets[side] ?? targets[0];
      const gx = p.x + (side === 0 ? -11 : 11);
      const gy = p.y + 6;
      const a = Math.atan2(t.y - gy, t.x - gx);
      p.aim = a;
      volley(s, gx, gy, a, hero.damage);
      if ((s.ranks.gunslinger ?? 0) >= 4) volley(s, gx, gy, a + 0.07, hero.damage);
    }
  } else if (s.hero === 'bram') {
    // Bram's carbine: straight bolts at the nearest bot, a heavy round every few with Marksman.
    const t = targets[0];
    const aim = Math.atan2(t.y - p.y, t.x - p.x);
    p.aim = aim;
    const heavyEvery = s.capstones.includes('longshot') ? 2 : (s.ranks.marksman ?? 0) >= 4 ? 4 : 0;
    const heavy = heavyEvery > 0 && p.shots % heavyEvery === 0;
    const o: BoltOpts = heavy ? { pierce: 999, color: 'heavy', r: 6 } : {};
    const dmg = hero.damage * (heavy ? 3 : 1);
    volley(s, p.x, p.y, aim, dmg, o);
    // Brothers in Arms: every brother fires the same shot from where he stands.
    const bro = s.ranks.brothers ?? 0;
    if (bro > 0) {
      const pct = at([0.6, 0.8, 0.8, 1, 1], bro, 0);
      const cone = s.crossovers.includes('shoulder-to-shoulder');
      for (const a of s.allies) {
        if (a.kind !== 'brother') continue;
        a.aim = aim;
        bolt(s, a.x, a.y, aim, dmg * pct, o);
        if (cone) {
          bolt(s, a.x, a.y, aim - 0.22, dmg * pct * 0.7, o);
          bolt(s, a.x, a.y, aim + 0.22, dmg * pct * 0.7, o);
        }
      }
    }
  } else {
    const t = targets[0];
    const a = Math.atan2(t.y - p.y, t.x - p.x);
    p.aim = a;
    const suppressor = s.ranks.suppressor ?? 0;
    volley(s, p.x, p.y, a, hero.damage, {}, (suppressor >= 4 ? 1 : 0) + (s.capstones.includes('hailstorm') ? 2 : 0));
  }
}

/** Counts down an ability's cooldown; true when it goes off (and the next one is set). */
export function ready(s: GameState, name: string, periodMs: number, ms: number) {
  if (s.cd[name] === undefined) s.cd[name] = periodMs * 0.4;
  s.cd[name] -= ms;
  if (s.cd[name] > 0) return false;
  s.cd[name] = periodMs * st.cooldown;
  return true;
}

function abilities(s: GameState, ms: number) {
  const p = s.player;
  const r = (id: string) => s.ranks[id] ?? 0;
  const cap = (id: string) => s.capstones.includes(id);
  // Captain Rook
  const gs = r('gunslinger');
  if (gs >= 3 && ready(s, 'quickdraw', gs >= 5 ? 2000 : 3000, ms)) {
    const targets = nearest(s, p.x, p.y, gs >= 5 ? 10 : 6, 420);
    for (const t of targets) bolt(s, p.x, p.y, Math.atan2(t.y - p.y, t.x - p.x), HEROES.rook.damage, { speed: 700 });
  }
  const demo = r('demolitions');
  if (demo > 0 && ready(s, 'charge', demo >= 5 ? 3000 : 5000, ms)) {
    addBomb(s, 'charge', p.x, p.y, 1200, at([70, 70, 95, 95, 100], demo, 70), at([30, 45, 45, 45, 90], demo, 30), { cluster: demo >= 4 ? 3 : 0 });
  }
  if (cap('carpet-strike') && ready(s, 'carpet', 6000, ms)) {
    const spot = swarmSpot(s, 420);
    const a = Math.atan2(spot.y - p.y, spot.x - p.x);
    for (let i = 0; i < 6; i++) {
      const d = Math.hypot(spot.x - p.x, spot.y - p.y) - 110 + i * 50;
      addBomb(s, 'carpet', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 350 + i * 110, 62, 55);
    }
  }
  // Legionary TR-9
  const sup = r('suppressor');
  if (sup > 0) {
    const len = suppressorLength(s);
    const half = suppressorHalf(s);
    const slow = at([0.3, 0.4, 0.4, 0.45, 0.55], sup, 0.3);
    const dps = at([3, 3, 7, 7, 12], sup, 3);
    near(s, p.x, p.y, len, (e) => {
      const diff = Math.abs(angleDiff(Math.atan2(e.y - p.y, e.x - p.x), p.aim));
      if (diff > half) return;
      e.slowMs = Math.max(e.slowMs, 250);
      e.slowPct = Math.max(e.slowPct, slow);
      damage(s, e, (dps * ms) / 1000, { noCrit: true });
    });
  }
  if (cap('hailstorm') && ready(s, 'hail', 1500, ms)) {
    for (let i = 0; i < 12; i++) bolt(s, p.x, p.y, (i / 12) * Math.PI * 2 + s.time / 900, HEROES.tr9.damage);
  }
  const shield = r('riot-shield');
  if (shield >= 2 && ready(s, 'bash', at([2500, 2500, 2500, 1800, 1200], shield, 2500), ms)) {
    const stun = s.crossovers.includes('stunning-bash');
    const half = shieldHalf(s) + 0.25;
    near(s, p.x, p.y, 95, (e) => {
      if (Math.abs(angleDiff(Math.atan2(e.y - p.y, e.x - p.x), p.facing)) > half) return;
      damage(s, e, shield >= 4 ? 24 : 12);
      knock(e, p.x, p.y, 380);
      if (stun) e.stunMs = Math.max(e.stunMs, 1200);
    });
    s.blasts.push({ id: s.nextId++, x: p.x + Math.cos(p.facing) * 40, y: p.y + Math.sin(p.facing) * 40, r: 60, ms: 260, maxMs: 260, color: BLAST.shield });
  }
  if (cap('phalanx')) {
    for (const spot of phalanxSpots(s)) {
      near(s, spot.x, spot.y, 16, (e) => {
        if (e.bashMs > 0) return;
        e.bashMs = 500;
        damage(s, e, 20);
        knock(e, p.x, p.y, 320);
      });
    }
  }
  // Drop Squad: its troopers come in `syncAllies`.
  const drop = r('drop-doctrine');
  if (drop >= 2 && ready(s, 'supply', 20000, ms)) {
    const spot = swarmSpot(s, 250);
    addBomb(s, 'crate', spot.x, spot.y, 1000, 80, 50, { heal: 15 });
  }
  if (cap('orbital-drop') && ready(s, 'orbital', 8000, ms)) {
    const spot = swarmSpot(s, 380);
    addBomb(s, 'orbital', spot.x, spot.y, 900, 120, 80);
  }
  // Corporal Bram-17
  const jump = r('jump-trooper');
  if (jump > 0) {
    const period = at([5000, 5000, 3500, 3500, 2500], jump, 5000);
    if ((s.cd.dash ?? 0) > 0) s.cd.dash -= ms;
    else if (p.moving && p.dashMs <= 0) {
      p.dashMs = 180;
      p.dashAngle = p.facing;
      s.cd.dash = period * st.cooldown;
    }
    const rockets = at([0, 2, 2, 4, 6], jump, 0) * (cap('skyfall') ? 2 : 1);
    if (rockets > 0 && ready(s, 'rockets', 2000, ms)) {
      for (let i = 0; i < rockets; i++) {
        const a = p.facing + Math.PI + (i - (rockets - 1) / 2) * 0.5;
        bolt(s, p.x, p.y, a, 14, { speed: 380, life: 2600, homing: 6, color: 'rocket', pierce: 0, bounces: 0, r: 5 });
      }
    }
  }
  if (cap('the-batch') && ready(s, 'batch', 6000, ms)) {
    for (const a of s.allies) {
      if (a.kind !== 'brother') continue;
      const t = nearest(s, a.x, a.y, 1, 300)[0];
      if (t) addBomb(s, 'grenade', t.x, t.y, 600, 70, 40, { fromX: a.x, fromY: a.y });
    }
  }
  // The Blaster pool
  const thermal = r('thermal');
  if (thermal > 0 && ready(s, 'thermal', at([4000, 3600, 3200, 2800, 2400], thermal, 4000), ms)) {
    const pool = nearest(s, p.x, p.y, 8, 320);
    const t = pool[Math.floor(rand() * pool.length)];
    if (t) {
      addBomb(s, 'grenade', t.x, t.y, 600, at([55, 60, 70, 70, 85], thermal, 55), at([25, 32, 32, 45, 60], thermal, 25), {
        fromX: p.x, fromY: p.y, cluster: s.crossovers.includes('cluster-grenades') ? 3 : 0,
      });
    } else s.cd.thermal = 300;
  }
  const callin = r('callin');
  if (callin > 0 && ready(s, 'callin', at([30000, 27000, 24000, 21000, 18000], callin, 30000), ms)) {
    const spot = swarmSpot(s, 300);
    addBomb(s, 'crate', spot.x, spot.y, 1000, 90, at([60, 75, 90, 110, 140], callin, 60), { heal: at([15, 20, 25, 30, 35], callin, 15) });
  }
  // Orbital Beacon: a strike from orbit on the thickest crowd.
  const beacon = r('orbital-beacon');
  if (beacon > 0 && ready(s, 'orbital-beacon', at([9000, 8000, 7000, 6000, 5000], beacon, 9000), ms)) {
    if (nearest(s, p.x, p.y, 1, 420).length) {
      const spot = swarmSpot(s, 380);
      addBomb(s, 'orbital', spot.x, spot.y, 900, at([70, 75, 80, 85, 95], beacon, 70), at([40, 50, 60, 75, 90], beacon, 40));
    } else s.cd['orbital-beacon'] = 300;
  }
  // Crescent Wave (Blade): a cutting blast in front of the hero.
  const crescent = r('crescent');
  if (crescent > 0 && ready(s, 'crescent', at([4000, 3600, 3200, 2800, 2400], crescent, 4000), ms)) {
    if (nearest(s, p.x, p.y, 1, 200).length) {
      const t = nearest(s, p.x, p.y, 1, 200)[0];
      const a = Math.atan2(t.y - p.y, t.x - p.x);
      explode(s, p.x + Math.cos(a) * 70, p.y + Math.sin(a) * 70, at([60, 65, 70, 75, 85], crescent, 60), at([20, 26, 32, 40, 50], crescent, 20), BLAST.frag);
    } else s.cd.crescent = 300;
  }
  // Stasis Pulse (Current): every foe close by is slowed hard for a moment.
  const stasis = r('stasis');
  if (stasis > 0 && ready(s, 'stasis', at([7000, 6500, 6000, 5500, 5000], stasis, 7000), ms)) {
    const reach = at([150, 160, 170, 180, 200], stasis, 150);
    const slow = at([0.4, 0.45, 0.5, 0.55, 0.6], stasis, 0.4);
    near(s, p.x, p.y, reach, (e) => {
      e.slowPct = Math.max(e.slowPct, slow);
      e.slowMs = Math.max(e.slowMs, 2500);
    });
    s.blasts.push({ id: s.nextId++, x: p.x, y: p.y, r: reach, ms: 420, maxMs: 420, color: BLAST.bomb });
  }
  // Dark Nova (Hollow): a burst of dark force all round the hero.
  const nova = r('dark-nova');
  if (nova > 0 && ready(s, 'dark-nova', at([6000, 5500, 5000, 4500, 4000], nova, 6000), ms)) {
    const reach = at([90, 100, 110, 120, 140], nova, 90);
    if (nearest(s, p.x, p.y, 1, reach).length) explode(s, p.x, p.y, reach, at([25, 32, 40, 50, 65], nova, 25), '#b65cff');
    else s.cd['dark-nova'] = 300;
  }
  // Barrier Emitter (Gear): recharges while unspent; `hurtHero` spends it.
  if (r('barrier') > 0 && (s.cd.barrier ?? 0) > 0) s.cd.barrier -= ms;
}

/** How far the Suppressor's cone reaches, px (0 without it), and half its angle, radians. */
export function suppressorLength(s: GameState) {
  return at([140, 150, 190, 200, 240], s.ranks.suppressor ?? 0, 0);
}
export function suppressorHalf(s: GameState) {
  return (s.ranks.suppressor ?? 0) >= 3 ? 0.55 : 0.45;
}

/** Half the angle the Riot Shield covers, radians. */
export function shieldHalf(s: GameState) {
  return (s.ranks['riot-shield'] ?? 0) >= 4 ? 1.0 : 0.7;
}

/** Where the three Phalanx shields are around the hero. */
export function phalanxSpots(s: GameState) {
  const p = s.player;
  return [0, 1, 2].map((i) => {
    const a = s.time / 400 + (i * Math.PI * 2) / 3;
    return { x: p.x + Math.cos(a) * 58, y: p.y + Math.sin(a) * 58, a };
  });
}

export function angleDiff(a: number, b: number) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// ---------------------------------------------------------------------------------------------
// Allies: troopers, squad troopers, brothers and drones

/** Adds troopers, brothers and drones to match the upgrades held. */
export function syncAllies(s: GameState) {
  const r = (id: string) => s.ranks[id] ?? 0;
  const squadWant = squadAllies(s);
  const want: Record<(typeof LASTING)[number], number> = {
    trooper: s.capstones.includes('last-company') ? 5 : at([1, 1, 2, 2, 3], r('commander'), 0),
    legionary: s.capstones.includes('orbital-drop') ? 6 : at([1, 1, 2, 2, 3], r('drop-doctrine'), 0),
    brother: s.capstones.includes('the-batch') ? 5 : at([1, 1, 2, 2, 3], r('brothers'), 0),
    ...knightAllies(s),
    ...squadWant,
    drone: at([1, 1, 2, 2, 3], r('drone'), 0) + squadWant.drone,
  };
  syncSquad(s);
  for (const kind of LASTING) {
    const have = s.allies.filter((a) => a.kind === kind);
    for (let i = have.length; i < want[kind]; i++) {
      // TR-9's squad troopers land in a drop pod beside him.
      if (kind === 'legionary') {
        const a = s.player.facing + Math.PI + (i - 1) * 0.8;
        addBomb(s, 'orbital', s.player.x + Math.cos(a) * 44, s.player.y + Math.sin(a) * 44, 700, 60, 25);
      }
      s.allies.push({ id: s.nextId++, kind, x: s.player.x, y: s.player.y, cdMs: 400 + i * 150, lifeMs: 0, slot: i, aim: 0 });
    }
    // A tier given up at the shrine can take an ally with it.
    if (have.length > want[kind]) s.allies = s.allies.filter((a) => a.kind !== kind || a.slot < want[kind]);
  }
}

/** The allies that stay as long as the upgrades that bring them. */
const LASTING = ['trooper', 'legionary', 'brother', 'drone', 'spirit', 'copilot', 'squadron', 'commando', 'medic', 'command'] as const;

function moveAllies(s: GameState, ms: number) {
  const p = s.player;
  const dt = ms / 1000;
  const rally = s.hero === 'rook' && p.sigActiveMs > 0 ? 1.5 : 1;
  const counts: Record<AllyKind, number> = {
    trooper: 0, legionary: 0, brother: 0, drone: 0, escort: 0, fighter: 0, squadron: 0, copilot: 0, spirit: 0, puppet: 0,
    commando: 0, bike: 0, medic: 0, shieldbot: 0, command: 0, spare: 0, thawed: 0,
  };
  for (const a of s.allies) counts[a.kind] += 1;
  for (const a of s.allies) {
    if (KNIGHT_ALLIES.includes(a.kind)) {
      moveKnightAlly(s, a, ms, counts[a.kind]);
      continue;
    }
    if (SQUAD_ALLIES.includes(a.kind)) {
      moveSquadAlly(s, a, ms, counts[a.kind]);
      continue;
    }
    // Troopers thawed out on the Ice world fight for a while.
    if (a.kind === 'thawed') a.lifeMs -= ms;
    {
      // Troopers and brothers keep formation behind the hero; drones circle.
      const n = counts[a.kind];
      // Eyes in the Sky: the extra drones fly over Elara's commandos.
      const over = squad && a.kind === 'drone' ? droneSpot(s, a, at([1, 1, 2, 2, 3], s.ranks.drone ?? 0, 0)) : null;
      const ang = a.kind === 'escort' ? -s.time / 900 : a.kind === 'drone' ? s.time / 550 + (a.slot * Math.PI * 2) / n : p.facing + Math.PI + (a.slot - (n - 1) / 2) * 0.8;
      const dist = a.kind === 'escort' ? 74 : a.kind === 'drone' ? 52 : a.kind === 'brother' ? 50 : 44;
      const tx = p.x + Math.cos(ang) * dist;
      const ty = p.y + Math.sin(ang) * dist;
      const k = a.kind === 'drone' || a.kind === 'escort' ? 1 : Math.min(1, 8 * dt);
      a.x += ((over?.x ?? tx) - a.x) * k;
      a.y += ((over?.y ?? ty) - a.y) * k;
    }
    if (a.kind === 'brother') continue;
    a.cdMs -= ms * (a.kind === 'trooper' ? rally : 1);
    if (a.cdMs > 0) continue;
    const range = a.kind === 'trooper' || a.kind === 'legionary' || a.kind === 'escort' || a.kind === 'thawed' ? 340 : 300;
    const t = nearest(s, a.x, a.y, 1, range)[0];
    if (!t) {
      a.cdMs = 0;
      continue;
    }
    const ang = Math.atan2(t.y - a.y, t.x - a.x);
    a.aim = ang;
    const plain = { pierce: 0, bounces: 0 };
    if (a.kind === 'trooper') {
      const cm = s.ranks.commander ?? 0;
      const dmg = 7 * (cm >= 2 ? 1.3 : 1) * (s.capstones.includes('last-company') ? 1.5 : 1);
      bolt(s, a.x, a.y, ang, dmg, { ...plain, color: 'rook' });
      if (cm >= 4) bolt(s, a.x, a.y, ang + 0.05, dmg, { ...plain, color: 'rook' });
      a.cdMs = 900 * (cm >= 2 ? 0.75 : 1);
    } else if (a.kind === 'thawed') {
      bolt(s, a.x, a.y, ang, 9 + 4 * s.stage, { ...plain, color: 'rook' });
      a.cdMs = 700;
    } else if (a.kind === 'legionary') {
      bolt(s, a.x, a.y, ang, 7 * ((s.ranks['drop-doctrine'] ?? 0) >= 4 ? 1.6 : 1), { ...plain, color: 'tr9' });
      a.cdMs = 900;
    } else if (a.kind === 'escort') {
      // The stranded bot: a little turret that keeps up with the planet's toughness.
      bolt(s, a.x, a.y, ang, 10 + 6 * s.stage, { ...plain, color: 'drone', speed: 620 });
      a.cdMs = 420;
    } else {
      bolt(s, a.x, a.y, ang, 10, { ...plain, color: 'drone', speed: 600 });
      a.cdMs = at([1100, 850, 850, 700, 600], s.ranks.drone ?? 0, 1100);
    }
  }
  s.allies = s.allies.filter((a) => !SHORT_LIVED.includes(a.kind) || a.lifeMs > 0);
}

const KNIGHT_ALLIES: readonly AllyKind[] = ['fighter', 'squadron', 'copilot', 'spirit', 'puppet'];
const SQUAD_ALLIES: readonly AllyKind[] = ['commando', 'bike', 'medic', 'shieldbot', 'command', 'spare'];
/** Allies that last a while and are gone at the end of a fight. */
export const SHORT_LIVED: readonly AllyKind[] = ['fighter', 'puppet', 'bike', 'spare', 'thawed'];

// ---------------------------------------------------------------------------------------------
// The bots

export function spawnAt(s: GameState, kind: EnemyKind, x: number, y: number, elite = false) {
  const planet = PLANETS[s.planet];
  const boss = kind === 'boss' ? BOSSES[planet.boss] : null;
  const spec = boss ?? ENEMY[kind];
  const t = s.time / 1000;
  const hpScale = boss ? DIFF.hp : DIFF.hp * planet.hp * (1 + t / 240);
  const foe = !boss && !isStructure(kind);
  const mut = (id: MutatorId) => s.mutators.includes(id);
  const hp = spec.hp * hpScale * (elite ? ELITE.hp : 1) * (hot(s.heat, 'hp') && !isStructure(kind) ? HEAT.hp : 1) *
    (foe && mut('swarm') ? MUT.swarmHp : 1) * (foe && mut('fragile') ? MUT.fragileHp : 1);
  const speed = spec.speed * (boss ? 1 : 1 + t / 1200) * (elite ? ELITE.speed : 1) * (0.92 + rand() * 0.16) * (mut('haste') ? MUT.haste : 1);
  const e: Enemy = {
    id: s.nextId++, kind, elite, x, y, r: spec.r * (elite ? ELITE.size : 1), hp, maxHp: hp, speed,
    dmg: spec.dmg * (boss ? 1 : planet.dmg) * (elite ? 1.5 : 1), hitMs: 0, slowMs: 0, slowPct: 0, stunMs: 0, flashMs: 0, kx: 0, ky: 0,
    mode: 'walk', modeMs: 0, vx: 0, vy: 0, shellMs: BOSS.shellMs, spawnMs: BOSS.spawnMs, bashMs: 0,
    slot: 0, facing: 0, guardMs: 0, aimX: 0, aimY: 0, phase2: false, phase3: false, gripMs: 0, gripDmg: 0, fleeMs: 0, charmMs: 0, orbitMs: 0,
  };
  if (kind === 'toad') e.shellMs = TOAD.spitMs * 0.5;
  else if (kind === 'walker') e.shellMs = WALKER.burstMs * 0.5;
  else if (kind === 'knight') e.shellMs = KNIGHT.every * 0.5;
  else if (kind === 'linetrooper') e.shellMs = LINE.volleyMs * 0.6;
  else if (kind === 'puffcap') e.shellMs = SPORE.puffMs * 0.5;
  else if (kind === 'prism') e.shellMs = SHARD.lanceMs * 0.5;
  else if (kind === 'conductor') e.shellMs = STRIKE.callMs * 0.5;
  s.enemies.push(e);
  return e;
}

/** A point on the spawn ring around the hero, at `angle` or a random one. */
export function ringPoint(s: GameState, angle = rand() * Math.PI * 2) {
  const d = SPAWN_RING.min + s.ringOut + rand() * (SPAWN_RING.max - SPAWN_RING.min);
  return { x: s.player.x + Math.cos(angle) * d, y: s.player.y + Math.sin(angle) * d };
}

/** Bots per second at a planet time (s), before difficulty and the planet's own pace. */
export function spawnRate(t: number) {
  return 1.4 + t / 75 + (t / 160) ** 2;
}

/** Spawns one group of the planet's swarm on the ring (at most `room`); returns how many came. */
export function spawnGroup(s: GameState, t: number, room: number) {
  const id = PLANETS[s.planet].id;
  const spot = ringPoint(s);
  if (id === 'dune') {
    const rollerChance = t < 35 ? 0 : Math.min(0.28, 0.08 + t / 900);
    spawnAt(s, rand() < rollerChance ? 'rollerbomb' : 'clanker', spot.x, spot.y);
    return 1;
  }
  const roll = rand();
  if (id === 'swamp') {
    if (roll < (t < 30 ? 0 : Math.min(0.22, 0.07 + t / 900))) {
      spawnAt(s, 'toad', spot.x, spot.y);
      return 1;
    }
    // Mire rats run in packs.
    const n = Math.min(room, RATS.pack[0] + Math.floor(rand() * (RATS.pack[1] - RATS.pack[0] + 1)));
    for (let i = 0; i < n; i++) spawnAt(s, 'mirerat', spot.x + (rand() - 0.5) * 50, spot.y + (rand() - 0.5) * 50);
    return n;
  }
  if (id === 'ice') {
    if (roll < (t < 40 ? 0 : Math.min(0.12, 0.04 + t / 1500))) {
      spawnAt(s, 'walker', spot.x, spot.y);
      return 1;
    }
    // A squad of line troopers, side by side across the way to the hero, firing together.
    const n = Math.min(room, LINE.squad);
    const a = Math.atan2(s.player.y - spot.y, s.player.x - spot.x);
    const volley = LINE.volleyMs * (0.5 + rand() * 0.5);
    for (let i = 0; i < n; i++) {
      const slot = (i - (n - 1) / 2) * LINE.gap;
      const e = spawnAt(s, 'linetrooper', spot.x - Math.sin(a) * slot, spot.y + Math.cos(a) * slot);
      e.slot = slot;
      e.shellMs = volley;
    }
    return n;
  }
  if (id === 'spore') {
    if (roll < (t < 30 ? 0 : Math.min(0.14, 0.05 + t / 1100))) {
      spawnAt(s, 'puffcap', spot.x, spot.y);
      return 1;
    }
    // Sporelings drift in clumps.
    const n = Math.min(room, SPORE.clump);
    for (let i = 0; i < n; i++) spawnAt(s, 'sporeling', spot.x + (rand() - 0.5) * 44, spot.y + (rand() - 0.5) * 44);
    return n;
  }
  if (id === 'scrap') {
    if (roll < (t < 35 ? 0 : Math.min(0.12, 0.04 + t / 1200))) {
      spawnAt(s, 'hauler', spot.x, spot.y);
      return 1;
    }
    // Scrappers run in packs, one behind the other.
    const n = Math.min(room, SCRAP.pack);
    const a = Math.atan2(s.player.y - spot.y, s.player.x - spot.x);
    for (let i = 0; i < n; i++) spawnAt(s, 'scrapper', spot.x - Math.cos(a) * i * 22, spot.y - Math.sin(a) * i * 22);
    return n;
  }
  if (id === 'crystal') {
    if (roll < (t < 35 ? 0 : Math.min(0.13, 0.04 + t / 1300))) {
      spawnAt(s, 'prism', spot.x, spot.y);
      return 1;
    }
    const n = Math.min(room, 2);
    for (let i = 0; i < n; i++) spawnAt(s, 'shardling', spot.x + (rand() - 0.5) * 36, spot.y + (rand() - 0.5) * 36);
    return n;
  }
  if (id === 'storm') {
    if (roll < (t < 35 ? 0 : Math.min(0.12, 0.04 + t / 1300))) {
      spawnAt(s, 'conductor', spot.x, spot.y);
      return 1;
    }
    const n = Math.min(room, 4);
    for (let i = 0; i < n; i++) spawnAt(s, 'wisp', spot.x + (rand() - 0.5) * 60, spot.y + (rand() - 0.5) * 60);
    return n;
  }
  if (roll < (t < 35 ? 0 : Math.min(0.16, 0.05 + t / 1100))) {
    spawnAt(s, 'knight', spot.x, spot.y);
    return 1;
  }
  const n = Math.min(room, 3);
  for (let i = 0; i < n; i++) spawnAt(s, 'acolyte', spot.x + (rand() - 0.5) * 40, spot.y + (rand() - 0.5) * 40);
  return n;
}

/** An elite of the planet's faction on the ring (also the arena's). */
export function spawnElite(s: GameState, angle?: number) {
  const planet = PLANETS[s.planet];
  const spot = ringPoint(s, angle);
  let kind: FoeKind;
  if (planet.id === 'dune') kind = s.time > 120_000 && rand() < 0.5 ? 'rollerbomb' : 'clanker';
  else kind = planet.elites[rand() < 0.6 ? 0 : 1];
  return spawnAt(s, kind, spot.x, spot.y, true);
}

function director(s: GameState, ms: number) {
  const planet = PLANETS[s.planet];
  const t = s.time / 1000;
  const living = s.enemies.length;
  // Once the boss is here, no more foes come: only those already on the field (and the boss's own) are left.
  const swarm = s.mutators.includes('swarm') ? MUT.swarmSpawn : 1;
  if (!s.bossSpawned) s.spawnDebt += (spawnRate(t) * DIFF.spawn * planet.spawn * swarm * (s.arena ? 0.4 : 1) * ms) / 1000;
  let made = 0;
  while (!s.bossSpawned && s.spawnDebt >= 1) {
    s.spawnDebt -= 1;
    if (living + made >= MAX_ENEMIES) {
      s.spawnDebt = Math.min(s.spawnDebt, 1);
      break;
    }
    // A pack or squad pays for its others out of what is owed.
    const n = spawnGroup(s, t, MAX_ENEMIES - living - made);
    s.spawnDebt -= n - 1;
    made += n;
  }
  if (s.time >= s.nextElite && !s.bossSpawned) {
    s.nextElite += ELITE.every / (hot(s.heat, 'elites') ? HEAT.elites : 1);
    spawnElite(s);
    pop(s, tr(planet.elite), '#ffe066');
  }
  while (!s.bossSpawned && s.waves.length && s.time >= s.waves[0]) {
    s.waves.shift();
    const n = planet.swarm === 'linetrooper' ? 18 : 26;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      spawnAt(s, planet.swarm, s.player.x + Math.cos(a) * 440, s.player.y + Math.sin(a) * 440);
    }
    pop(s, tr('surround'), '#ff8a6a');
  }
  if (!s.bossSpawned && !s.arena && s.time >= RUN_MS) {
    s.bossSpawned = true;
    cancelObjective(s);
    const spot = ringPoint(s, s.player.facing);
    const e = spawnAt(s, 'boss', spot.x, spot.y);
    const mech = BOSSES[planet.boss].mech;
    if (mech === 'bogmother') {
      e.shellMs = BOG.globMs;
      e.spawnMs = BOG.spawnMs;
      e.modeMs = BOG.poolMs;
    } else if (mech === 'siege') {
      e.shellMs = SIEGE.volleyMs;
      e.spawnMs = SIEGE.barrageMs * 0.5;
      e.modeMs = 0;
    } else if (mech === 'champion') {
      e.shellMs = CHAMPION.dashEvery;
      e.spawnMs = CHAMPION.ringMs;
    }
    pop(s, tr(BOSSES[planet.boss].name), '#ff9a3c');
  }
  // Lava vents: a warning glow near the hero, then an eruption.
  if (planet.id === 'lava' && s.time >= s.nextVent) {
    s.nextVent = s.time + VENT.minMs + rand() * (VENT.maxMs - VENT.minMs);
    const a = rand() * Math.PI * 2;
    const d = 40 + rand() * 200;
    addHazard(s, 'vent', s.player.x + Math.cos(a) * d, s.player.y + Math.sin(a) * d, VENT.r, VENT.warnMs, 450, VENT.dmg);
  }
  // Lightning on the Storm world: a warning ring near the hero, then the strike.
  if (planet.id === 'storm' && s.time >= s.nextVent) {
    s.nextVent = s.time + STRIKE.minMs + rand() * (STRIKE.maxMs - STRIKE.minMs);
    const a = rand() * Math.PI * 2;
    const d = 30 + rand() * 180;
    addHazard(s, 'strike', s.player.x + Math.cos(a) * d, s.player.y + Math.sin(a) * d, STRIKE.r, STRIKE.warnMs, 300, STRIKE.dmg * planet.dmg);
  }
}

export function knock(e: Enemy, fromX: number, fromY: number, power: number) {
  if (e.kind === 'boss' || isStructure(e.kind)) return;
  const a = Math.atan2(e.y - fromY, e.x - fromX);
  e.kx = Math.cos(a) * power;
  e.ky = Math.sin(a) * power;
  if (e.mode === 'rush') e.mode = 'walk';
}

/** A hostile bolt from a bot, beast, trooper or boss. */
function shoot(s: GameState, x: number, y: number, angle: number, speed: number, dmg: number, color: BoltColor, r: number, life = 3800) {
  const b: Bullet = {
    id: s.nextId++, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    dmg, pierce: 0, bounces: 0, lifeMs: life, hostile: true, color, hit: [], homing: 0, bounced: false, r,
    spin: false, ret: 0, back: false, toad: false, bossMs: 0,
  };
  s.bullets.push(b);
  return b;
}

/** Something on the ground: a warning (`warnMs`) then a blast, or a lasting pool or ring. */
export function addHazard(s: GameState, kind: Hazard['kind'], x: number, y: number, r: number, warnMs: number, ms: number, dmg: number, angle = 0) {
  if (s.hazards.length > 90) s.hazards.shift();
  s.hazards.push({ id: s.nextId++, kind, x, y, r, warnMs, ms, maxMs: ms, dmg, angle, hit: false });
}

function moveEnemies(s: GameState, ms: number) {
  const p = s.player;
  const dt = ms / 1000;
  const blockHalf = shieldHalf(s);
  const shield = s.ranks['riot-shield'] ?? 0;
  const harm = PLANETS[s.planet].dmg;
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    // A structure stands where it was built and does nothing.
    if (isStructure(e.kind)) {
      e.flashMs = Math.max(0, e.flashMs - ms);
      e.x = e.aimX;
      e.y = e.aimY;
      e.charmMs = e.gripMs = e.stunMs = 0;
      continue;
    }
    e.hitMs -= ms;
    e.flashMs = Math.max(0, e.flashMs - ms);
    e.bashMs = Math.max(0, e.bashMs - ms);
    e.stunMs = Math.max(0, e.stunMs - ms);
    e.guardMs = Math.max(0, e.guardMs - ms);
    if (e.slowMs > 0) e.slowMs -= ms;
    else e.slowPct = 0;
    if (knight) {
      e.orbitMs -= ms;
      // Held in a Grip: lifted off the ground until it is crushed.
      if (e.gripMs > 0) {
        e.gripMs -= ms;
        if (e.gripMs <= 0) crush(s, e);
        continue;
      }
    }
    // Turned to the hero's side (Persuasion) or confused (the Diplomat).
    if (e.charmMs > 0) {
      turned(s, e, ms);
      continue;
    }
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    // Left far behind: brought back round ahead of the hero.
    if (dist > LEASH && e.kind !== 'boss') {
      const spot = ringPoint(s, p.facing + (rand() - 0.5) * 1.6);
      e.x = spot.x;
      e.y = spot.y;
      e.mode = 'walk';
      continue;
    }
    const resist = e.kind === 'boss' ? 0.3 : 1;
    const slow = 1 - e.slowPct * resist;
    const still = e.stunMs > 0 && e.kind !== 'boss';
    // A boss never falls far behind: out past the view it comes on three times as fast.
    const catchUp = e.kind === 'boss' && dist > 480 && e.mode === 'walk' ? 3 : 1;
    const speed = still ? 0 : e.speed * slow * catchUp;
    let vx = (dx / dist) * speed;
    let vy = (dy / dist) * speed;
    const toHero = Math.atan2(dy, dx);
    if (e.kind === 'rollerbomb') {
      if (e.mode === 'walk' && dist < ROLLER.trigger && !still) {
        e.mode = 'arm';
        e.modeMs = ROLLER.armMs;
      } else if (e.mode === 'arm') {
        vx = vy = 0;
        e.modeMs -= ms;
        if (e.modeMs <= 0) {
          e.mode = 'rush';
          e.modeMs = ROLLER.rushMs;
          e.vx = (dx / dist) * ROLLER.rushSpeed;
          e.vy = (dy / dist) * ROLLER.rushSpeed;
        }
      } else if (e.mode === 'rush') {
        vx = e.vx * slow;
        vy = e.vy * slow;
        e.modeMs -= ms;
        if (e.modeMs <= 0) {
          detonate(s, e, false);
          continue;
        }
      }
    } else if (e.kind === 'mirerat') {
      // Rats weave as they run.
      const weave = Math.sin(s.time / 170 + e.id) * 0.6 * speed;
      vx += (-dy / dist) * weave;
      vy += (dx / dist) * weave;
    } else if (e.kind === 'wisp') {
      // Wisps weave hard, like sparks on the wind.
      const weave = Math.sin(s.time / 140 + e.id * 1.7) * WISP.weave * speed;
      vx += (-dy / dist) * weave;
      vy += (dx / dist) * weave;
    } else if (e.kind === 'puffcap') {
      e.shellMs -= ms;
      if (dist < SPORE.range) {
        vx = vy = 0;
        if (e.shellMs <= 0 && !still) {
          e.shellMs = SPORE.puffMs;
          const n = SPORE.puffs + (e.elite ? 4 : 0);
          for (let i = 0; i < n; i++) shoot(s, e.x, e.y, toHero + (i / n) * Math.PI * 2, SPORE.puffSpeed, SPORE.puffDmg * harm, 'spore', 7, 3000);
        }
      }
    } else if (e.kind === 'prism') {
      e.shellMs -= ms;
      if (dist < SHARD.range) {
        vx = vy = 0;
        if (e.shellMs <= 0 && !still) {
          // A lance: bolts one behind the other along the same line.
          e.shellMs = SHARD.lanceMs;
          const n = SHARD.lance + (e.elite ? 2 : 0);
          for (let i = 0; i < n; i++) {
            shoot(s, e.x - Math.cos(toHero) * i * 16, e.y - Math.sin(toHero) * i * 16, toHero, SHARD.lanceSpeed, SHARD.lanceDmg * harm, 'splinter', 5);
          }
        }
      }
    } else if (e.kind === 'conductor') {
      e.shellMs -= ms;
      if (dist < STRIKE.callRange) {
        vx = vy = 0;
        if (e.shellMs <= 0 && !still) {
          // Calls lightning down where the hero stands.
          e.shellMs = STRIKE.callMs * (e.elite ? 0.7 : 1);
          addHazard(s, 'strike', p.x, p.y, STRIKE.r, STRIKE.warnMs, 300, STRIKE.dmg * harm);
        }
      }
    } else if (e.kind === 'toad') {
      e.shellMs -= ms;
      if (dist < TOAD.range) {
        vx = vy = 0;
        if (e.shellMs <= 0 && !still) {
          e.shellMs = TOAD.spitMs;
          shoot(s, e.x, e.y, toHero, TOAD.globSpeed, TOAD.globDmg * harm, 'glob', 8).toad = true;
        }
      }
    } else if (e.kind === 'linetrooper') {
      // Advance on a spot beside the hero (the squad's line), stop in range and fire with the squad.
      if (dist < LINE.range) vx = vy = 0;
      else {
        const tx = p.x + (dy / dist) * e.slot;
        const ty = p.y - (dx / dist) * e.slot;
        const d2 = Math.hypot(tx - e.x, ty - e.y) || 1;
        vx = ((tx - e.x) / d2) * speed;
        vy = ((ty - e.y) / d2) * speed;
      }
      e.shellMs -= ms;
      if (e.shellMs <= 0) {
        e.shellMs = LINE.volleyMs;
        if (dist < LINE.range + 60 && !still) shoot(s, e.x, e.y, toHero + (rand() - 0.5) * 0.08, LINE.boltSpeed, LINE.dmg * harm, 'volley', 5);
      }
    } else if (e.kind === 'walker') {
      e.shellMs -= ms;
      if (dist < WALKER.range) {
        vx = vy = 0;
        if (e.shellMs <= 0 && !still) {
          e.shellMs = WALKER.burstMs;
          for (let i = 0; i < WALKER.shots; i++) shoot(s, e.x, e.y, toHero + (i - 1) * 0.12, WALKER.speed, WALKER.dmg * harm * (e.elite ? 1.3 : 1), 'slug', 6);
        }
      }
    } else if (e.kind === 'knight') {
      e.shellMs -= ms;
      if (e.mode === 'walk') {
        e.facing = toHero;
        if (dist < KNIGHT.trigger && e.shellMs <= 0 && !still) {
          e.mode = 'arm';
          e.modeMs = KNIGHT.aimMs;
        }
      } else if (e.mode === 'arm') {
        vx = vy = 0;
        e.modeMs -= ms;
        if (e.modeMs <= 0) {
          e.mode = 'rush';
          e.modeMs = KNIGHT.dashMs;
          e.vx = Math.cos(e.facing) * KNIGHT.dashSpeed;
          e.vy = Math.sin(e.facing) * KNIGHT.dashSpeed;
        }
      } else {
        vx = e.vx * slow;
        vy = e.vy * slow;
        e.modeMs -= ms;
        if (e.modeMs <= 0) {
          e.mode = 'walk';
          e.guardMs = KNIGHT.guardMs;
          e.shellMs = KNIGHT.every;
        }
      }
      if (e.mode !== 'walk') e.guardMs = Math.max(e.guardMs, 1);
    } else if (e.kind === 'boss') {
      const v = bossAttacks(s, e, ms, dx / dist, dy / dist, dist);
      if (v) {
        vx = v.vx;
        vy = v.vy;
      }
    }
    // Dread: wounded foes run from the hero.
    if (e.fleeMs > 0) {
      e.fleeMs -= ms;
      vx = -vx;
      vy = -vy;
    }
    e.x += (vx + e.kx) * dt;
    e.y += (vy + e.ky) * dt;
    const fade = Math.exp(-7 * dt);
    e.kx *= fade;
    e.ky *= fade;
    // Keep apart from the bots around, so a swarm spreads into a crowd rather than a dot.
    if (e.kind !== 'boss') {
      const cx = Math.floor(e.x / CELL);
      const cy = Math.floor(e.y / CELL);
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const list = grid.get(keyOf(gx, gy));
          if (!list) continue;
          for (const o of list) {
            if (o === e) continue;
            const ox = e.x - o.x;
            const oy = e.y - o.y;
            const min = e.r + o.r;
            const d2 = ox * ox + oy * oy;
            if (d2 >= min * min || d2 === 0) continue;
            const d = Math.sqrt(d2);
            const push = ((min - d) / d) * 0.3;
            e.x += ox * push;
            e.y += oy * push;
          }
        }
      }
    } else {
      // The boss shoves smaller bots out of its way.
      near(s, e.x, e.y, e.r, (o, d) => {
        if (o === e || d === 0) return;
        const push = (e.r + o.r - d) / d;
        o.x += (o.x - e.x) * push * 0.5;
        o.y += (o.y - e.y) * push * 0.5;
      });
    }
    // Touching the hero.
    const reach = e.r + p.r;
    const ex = p.x - e.x;
    const ey = p.y - e.y;
    if (ex * ex + ey * ey > reach * reach || e.hitMs > 0) continue;
    e.hitMs = 700;
    const from = Math.atan2(e.y - p.y, e.x - p.x);
    const braced = (s.hero === 'tr9' || s.hero === 'corvin') && p.sigActiveMs > 0;
    const blocked = shield > 0 && e.kind !== 'boss' && Math.abs(angleDiff(from, p.facing)) <= blockHalf;
    if (braced || blocked) {
      knock(e, p.x, p.y, braced ? 320 : 220);
      if (blocked && shield >= 3) damage(s, e, 12);
      continue;
    }
    if (e.kind === 'rollerbomb') {
      detonate(s, e, true);
      continue;
    }
    hurtHero(s, knight ? e.dmg * contactMod(s, e) : e.dmg, e.x, e.y);
  }
}

/** A foe turned to the hero's side (Persuasion) or confused (Diplomat): it goes for the nearest other foe and hits it. */
function turned(s: GameState, e: Enemy, ms: number) {
  e.charmMs -= ms;
  // (A knight's step already counts this down.)
  if (squad) e.orbitMs -= ms;
  const t = nearest(s, e.x, e.y, 1, 320, [e.id])[0];
  if (!t) return;
  const d = Math.hypot(t.x - e.x, t.y - e.y) || 1;
  if (d > e.r + t.r + 2) {
    const step = Math.min(d, e.speed * 1.2 * (ms / 1000));
    e.x += ((t.x - e.x) / d) * step;
    e.y += ((t.y - e.y) / d) * step;
  } else if (e.orbitMs <= 0) {
    e.orbitMs = 700;
    damage(s, t, e.dmg * 2 * ((s.ranks.persuasion ?? 0) >= 4 ? 1.5 : 1) * (squad ? turnedBonus(s) : 1), { noCrit: true });
  }
}

/** Whether a fallen knight's shield takes a bolt flying this way (it guards its front). */
function guarded(e: Enemy, vx: number, vy: number) {
  return e.kind === 'knight' && e.mode === 'walk' && e.guardMs <= 0 && Math.abs(angleDiff(Math.atan2(-vy, -vx), e.facing)) < 1.05;
}

/** The planet boss's attacks; returns its own velocity when it moves other than straight at the hero. */
function bossAttacks(s: GameState, e: Enemy, ms: number, ux: number, uy: number, dist: number): { vx: number; vy: number } | null {
  const spec = BOSSES[PLANETS[s.planet].boss];
  const id = spec.mech;
  const power = spec.power;
  const enraged = e.hp < e.maxHp * BOSS.enragedAt;
  const base = Math.atan2(uy, ux);
  // Rift heat 4: low on health, a boss goes into a frenzy, attacking faster.
  if (hot(s.heat, 'frenzy') && !e.phase3 && e.hp < e.maxHp * HEAT.frenzyAt) {
    e.phase3 = true;
    pop(s, tr('bossFrenzy', { name: tr(spec.name) }), '#ff5a3c');
  }
  const pace = e.phase3 ? HEAT.frenzy : 1;
  e.shellMs -= ms * pace;
  e.spawnMs -= ms * pace;
  if (id === 'grinder') {
    if (enraged) e.speed = spec.speed * 1.45 * (e.phase3 ? HEAT.frenzySpeed : 1);
    if (e.shellMs <= 0) {
      e.shellMs = BOSS.shellMs * (enraged ? 0.75 : 1);
      const n = BOSS.shells + (enraged ? 2 : 0);
      for (let i = 0; i < n; i++) {
        shoot(s, e.x + ux * 50, e.y + uy * 50, base + (i - (n - 1) / 2) * 0.24, BOSS.shellSpeed, BOSS.shellDmg * power, 'shell', 7);
      }
    }
    if (e.spawnMs <= 0) {
      e.spawnMs = BOSS.spawnMs;
      for (let i = 0; i < BOSS.adds; i++) {
        const a = Math.atan2(-uy, -ux) + (i - (BOSS.adds - 1) / 2) * 0.4;
        spawnAt(s, spec.adds ?? 'clanker', e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70);
      }
    }
    return null;
  }
  if (id === 'bogmother') {
    if (enraged) e.speed = spec.speed * 1.3 * (e.phase3 ? HEAT.frenzySpeed : 1);
    if (e.shellMs <= 0) {
      e.shellMs = BOG.globMs * (enraged ? 0.75 : 1);
      const n = BOG.globs + (enraged ? 2 : 0);
      for (let i = 0; i < n; i++) shoot(s, e.x + ux * 40, e.y + uy * 40, base + (i - (n - 1) / 2) * 0.22, TOAD.globSpeed, TOAD.globDmg * 1.6 * power, spec.adds === 'sporeling' ? 'spore' : 'glob', 9);
    }
    if (e.spawnMs <= 0) {
      // Her young: a pack of mire rats.
      e.spawnMs = BOG.spawnMs * (enraged ? 0.7 : 1);
      const n = Math.min(BOG.young + (enraged ? 2 : 0), MAX_ENEMIES + 1 - s.enemies.length);
      for (let i = 0; i < n; i++) {
        const a = (i / Math.max(1, n)) * Math.PI * 2;
        spawnAt(s, spec.adds ?? 'mirerat', e.x + Math.cos(a) * 60, e.y + Math.sin(a) * 60);
      }
    }
    e.modeMs -= ms;
    if (e.modeMs <= 0) {
      e.modeMs = BOG.poolMs;
      addHazard(s, spec.adds === 'sporeling' ? 'spore' : 'bog', e.x, e.y, BOG.poolR, 0, BOG.poolLife, 0);
    }
    return null;
  }
  if (id === 'siege') {
    const crystal = spec !== BOSSES.siege;
    if (enraged) e.speed = spec.speed * 1.25 * (e.phase3 ? HEAT.frenzySpeed : 1);
    if (e.shellMs <= 0) {
      e.shellMs = SIEGE.volleyMs;
      for (let i = 0; i < 5; i++) shoot(s, e.x + ux * 50, e.y + uy * 50, base + (i - 2) * 0.16, WALKER.speed, WALKER.dmg * 1.4 * power, crystal ? 'splinter' : 'slug', 7);
    }
    if (e.spawnMs <= 0) {
      // An artillery barrage: one shell on the hero, the rest around, each with a warning ring.
      e.spawnMs = SIEGE.barrageMs * (enraged ? 0.75 : 1);
      const n = SIEGE.shells + (enraged ? 3 : 0);
      const p = s.player;
      for (let i = 0; i < n; i++) {
        const a = rand() * Math.PI * 2;
        const d = i === 0 ? 0 : 60 + rand() * 170;
        addHazard(s, 'shell', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, SIEGE.shellR, SIEGE.warnMs + i * 90, 400, SIEGE.shellDmg * power);
      }
    }
    e.modeMs -= ms;
    if (dist < SIEGE.stompR - 10 && e.modeMs <= 0) {
      e.modeMs = SIEGE.stompMs;
      addHazard(s, 'stomp', e.x, e.y, SIEGE.stompR, SIEGE.stompWarn, 400, SIEGE.stompDmg * power);
    }
    return null;
  }
  // The Hollow Champion: blade dashes; below half health, rings of fire too.
  if (enraged && !e.phase2) {
    e.phase2 = true;
    pop(s, tr(spec === BOSSES.champion ? 'championBurns' : 'heraldCharges'), spec === BOSSES.champion ? '#ff9a3c' : '#fff08a');
  }
  if (e.phase2 && e.spawnMs <= 0) {
    e.spawnMs = CHAMPION.ringMs;
    addHazard(s, 'ring', e.x, e.y, 24, 0, (560 / CHAMPION.ringSpeed) * 1000, CHAMPION.ringDmg * power, rand() * Math.PI * 2);
  }
  if (e.mode === 'walk') {
    if (e.shellMs <= 0 && dist < 520) {
      e.mode = 'arm';
      e.modeMs = CHAMPION.aimMs;
      e.aimX = s.player.x;
      e.aimY = s.player.y;
    }
    return null;
  }
  e.modeMs -= ms;
  if (e.mode === 'arm') {
    if (e.modeMs <= 0) {
      const d = Math.hypot(e.aimX - e.x, e.aimY - e.y);
      const a = Math.atan2(e.aimY - e.y, e.aimX - e.x);
      e.mode = 'rush';
      e.modeMs = ((d + 140) / CHAMPION.dashSpeed) * 1000;
      e.vx = Math.cos(a) * CHAMPION.dashSpeed;
      e.vy = Math.sin(a) * CHAMPION.dashSpeed;
    }
    return { vx: 0, vy: 0 };
  }
  if (e.modeMs <= 0) {
    e.mode = 'walk';
    e.shellMs = CHAMPION.dashEvery * (e.phase2 ? 0.7 : 1);
  }
  return { vx: e.vx, vy: e.vy };
}

/** Whether an angle (from a ring's centre) falls in one of the ring's gaps. */
export function inRingGap(h: Hazard, angle: number) {
  const seg = Math.PI / CHAMPION.ringGaps;
  let rel = (angle - h.angle) % (Math.PI * 2);
  if (rel < 0) rel += Math.PI * 2;
  return Math.floor(rel / seg) % 2 === 1;
}

/** A rollerbomb goes off: on the hero when it touched them, and on every bot around it. */
function detonate(s: GameState, e: Enemy, onHero: boolean) {
  e.hp = 0;
  const p = s.player;
  if (onHero || Math.hypot(p.x - e.x, p.y - e.y) < ROLLER.blastR + p.r) hurtHero(s, e.dmg, e.x, e.y);
  explodeBots(s, e.x, e.y, ROLLER.blastR, ROLLER.hurtOthers, e);
  s.blasts.push({ id: s.nextId++, x: e.x, y: e.y, r: ROLLER.blastR, ms: 380, maxMs: 380, color: BLAST.bot });
}

interface HitOpts {
  noCrit?: boolean;
  slow?: boolean;
  /** A sure critical hit (Joren's Edge). */
  crit?: boolean;
}

/** Hero-side damage to a bot: the Power Cell, crits and Stun Rounds apply. Returns the damage. */
export function damage(s: GameState, e: Enemy, base: number, o: HitOpts = {}) {
  if (e.hp <= 0 || e.charmMs > 0) return 0;
  let dmg = base * st.damage;
  if (knight) dmg *= foeMod(s, e);
  // A boss with no foe left beside it stands exposed.
  if (e.kind === 'boss' && !s.enemies.some((o2) => o2 !== e && o2.hp > 0 && o2.charmMs <= 0)) dmg *= BOSS.alone;
  // Threat Scanner: elites and bosses take more.
  if (e.elite || e.kind === 'boss') dmg *= st.bossDmg;
  // Elara's Sharpshooter makes its own critical hits.
  const sure = squad ? squadCrit(s, e) : 1;
  if (sure > 1) dmg *= sure;
  else if (o.crit || (!o.noCrit && st.crit > 0 && rand() < st.crit)) dmg *= 2;
  e.hp -= dmg;
  e.flashMs = 90;
  s.hits += 1;
  // Executioner Rounds: a foe left this low falls (an elite at half the share; never a boss or structure).
  if (st.execute > 0 && e.hp > 0 && e.kind !== 'boss' && !isStructure(e.kind) && e.hp < e.maxHp * st.execute * (e.elite ? 0.5 : 1)) e.hp = 0;
  if (o.slow && st.slowPct > 0) {
    e.slowPct = Math.max(e.slowPct, st.slowPct);
    e.slowMs = Math.max(e.slowMs, st.slowMs);
  }
  if (e.hp <= 0) kill(s, e);
  return dmg;
}

function kill(s: GameState, e: Enemy) {
  e.hp = 0;
  // A structure breaks: no kill, no shard (its objective counts it).
  if (isStructure(e.kind)) {
    s.blasts.push({ id: s.nextId++, x: e.x, y: e.y, r: e.r * 2.2, ms: 420, maxMs: 420, color: BLAST.shell });
    return;
  }
  s.kills += 1;
  if (s.mutators.includes('vampire')) heal(s, MUT.vampire);
  if (knight) onKill(s, e);
  if (squad) squadKill(s, e);
  if (e.kind === 'boss') {
    // The planet is cleared; the star map (or victory) comes next frame.
    s.phase = 'cleared';
    const credits = BOSSES[PLANETS[s.planet].boss].credits;
    if (credits > 0) {
      s.credits += credits;
      pop(s, tr('plusCredits', { n: credits }), '#ffd36b');
    }
    s.blasts.push({ id: s.nextId++, x: e.x, y: e.y, r: 160, ms: 900, maxMs: 900, color: BLAST.hero });
    for (const o of s.enemies) if (o !== e && o.hp > 0) o.hp = 0;
    return;
  }
  const value = e.elite ? ELITE.xp : ENEMY[e.kind].xp;
  dropShard(s, e.x, e.y, value);
  // Soul Harvest: each kill gives back a little health.
  if (st.harvest > 0) heal(s, st.harvest);
  dropPowerUp(s, e);
  if (e.elite) {
    s.elitesKilled += 1;
    // Arena elites pay in credits and the free pick at the end; others drop a chest too.
    if (!s.arena) s.pickups.push({ id: s.nextId++, kind: 'chest', x: e.x, y: e.y, heal: 0, value: 0 });
    const credits = s.arena ? CREDITS.arenaElite : CREDITS.elite;
    s.pickups.push({ id: s.nextId++, kind: 'credits', x: e.x + 18, y: e.y + 6, heal: 0, value: credits });
  }
  // A rollerbomb shot down still blows up, but only hurts bots.
  if (e.kind === 'rollerbomb') {
    explodeBots(s, e.x, e.y, ROLLER.blastR, ROLLER.hurtOthers, e);
    s.blasts.push({ id: s.nextId++, x: e.x, y: e.y, r: ROLLER.blastR, ms: 380, maxMs: 380, color: BLAST.bot });
  }
  // A sporeling bursts into a cloud of spores, a hauler falls apart into scrappers, a shardling into splinters.
  if (e.kind === 'sporeling') addHazard(s, 'spore', e.x, e.y, SPORE.cloudR * (e.elite ? 1.6 : 1), 0, SPORE.cloudMs, 0);
  else if (e.kind === 'hauler') {
    const n = Math.min(SCRAP.split + (e.elite ? 2 : 0), MAX_ENEMIES + 2 - s.enemies.length);
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      spawnAt(s, 'scrapper', e.x + Math.cos(a) * 18, e.y + Math.sin(a) * 18);
    }
  } else if (e.kind === 'shardling') {
    const a0 = rand() * Math.PI * 2;
    const harm = PLANETS[s.planet].dmg;
    for (let i = 0; i < SHARD.splinters; i++) shoot(s, e.x, e.y, a0 + (i / SHARD.splinters) * Math.PI * 2, SHARD.speed, SHARD.dmg * harm, 'splinter', 4, 900);
  }
  // An ash acolyte bursts into embers.
  if (e.kind === 'acolyte') addHazard(s, 'ember', e.x, e.y, EMBER.r * (e.elite ? 1.6 : 1), 0, EMBER.ms, EMBER.dmg * PLANETS[s.planet].dmg);
}

/** Now and then a power-up, after a world's first minute (so the first minute's draws are as before). */
function dropPowerUp(s: GameState, e: Enemy) {
  if (s.time < POWER.fromMs || s.arena) return;
  if (rand() >= (e.elite ? POWER.eliteChance : POWER.chance)) return;
  if (s.pickups.filter((k) => POWER_UPS.includes(k.kind as PowerUp)).length >= POWER.max) return;
  let roll = rand() * POWER_UPS.reduce((n, k) => n + POWER.weights[k], 0);
  const kind = POWER_UPS.find((k) => (roll -= POWER.weights[k]) < 0) ?? 'bomb';
  s.pickups.push({ id: s.nextId++, kind, x: e.x - 16, y: e.y - 8, heal: 0, value: 0, ms: POWER.lifeMs });
}

function dropShard(s: GameState, x: number, y: number, value: number) {
  if (s.shards.length >= MAX_SHARDS) {
    s.shards[Math.floor(rand() * s.shards.length)].value += value;
    return;
  }
  s.shards.push({ id: s.nextId++, x, y, value, pulled: false });
}

/** Damage to every bot near a point, apart from `skip` (no Power Cell: a bot's own blast). */
function explodeBots(s: GameState, x: number, y: number, r: number, dmg: number, skip: Enemy | null) {
  near(s, x, y, r, (o) => {
    if (o === skip || o.hp <= 0) return;
    o.hp -= dmg;
    o.flashMs = 90;
    if (o.hp <= 0) kill(s, o);
  });
}

/** A hero-side blast: damages and pushes every bot within `r`. */
export function explode(s: GameState, x: number, y: number, r: number, dmg: number, color: string) {
  near(s, x, y, r, (e) => {
    damage(s, e, dmg);
    knock(e, x, y, 160);
  });
  s.blasts.push({ id: s.nextId++, x, y, r, ms: 420, maxMs: 420, color });
}

// ---------------------------------------------------------------------------------------------
// Bolts, bombs, fire and pickups

function moveBullets(s: GameState, ms: number) {
  const dt = ms / 1000;
  const shield = s.ranks['riot-shield'] ?? 0;
  const keep: Bullet[] = [];
  for (const b of s.bullets) {
    b.lifeMs -= ms;
    if (b.lifeMs <= 0) continue;
    if (b.spin && b.ret > 0) {
      // A thrown blade turns at the end of its reach and comes back, cutting again on the way.
      b.ret -= ms;
      if (b.ret <= 0) {
        b.back = true;
        b.hit = [];
      }
    }
    if (b.back) {
      const p = s.player;
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      if (d < 22) continue;
      const speed = Math.hypot(b.vx, b.vy);
      b.vx = ((p.x - b.x) / d) * speed;
      b.vy = ((p.y - b.y) / d) * speed;
    }
    if (b.homing > 0) {
      const t = nearest(s, b.x, b.y, 1, 320)[0];
      if (t) {
        const want = Math.atan2(t.y - b.y, t.x - b.x);
        const have = Math.atan2(b.vy, b.vx);
        const turn = Math.max(-b.homing * dt, Math.min(b.homing * dt, angleDiff(want, have)));
        const speed = Math.hypot(b.vx, b.vy);
        b.vx = Math.cos(have + turn) * speed;
        b.vy = Math.sin(have + turn) * speed;
      }
    }
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.hostile) {
      if (hostileBolt(s, b, shield)) keep.push(b);
      continue;
    }
    let alive = true;
    b.bossMs -= ms;
    near(s, b.x, b.y, b.r, (e) => {
      if (!alive || e.hp <= 0 || e.charmMs > 0) return;
      if (b.spin && e.kind === 'boss') {
        // A thrown blade keeps cutting a boss as it passes through.
        if (b.bossMs > 0) return;
        b.bossMs = 130;
        damage(s, e, b.dmg);
        return;
      }
      if (b.hit.includes(e.id)) return;
      b.hit.push(e.id);
      if (guarded(e, b.vx, b.vy)) {
        // A knight's shield takes most of a bolt from the front, and stops it.
        damage(s, e, b.dmg * KNIGHT.block, { noCrit: true });
        alive = false;
        return;
      }
      damage(s, e, b.dmg, { slow: true });
      if (b.color === 'heavy') knock(e, e.x - b.vx, e.y - b.vy, 60);
      if (b.pierce > 0) {
        b.pierce -= 1;
        return;
      }
      if (b.bounces > 0) {
        b.bounces -= 1;
        if (!b.bounced && (s.ranks.ricochet ?? 0) >= 3) b.dmg *= 1.25;
        b.bounced = true;
        const speed = Math.hypot(b.vx, b.vy);
        const next = st.seek ? nearest(s, b.x, b.y, 1, 240, b.hit)[0] : undefined;
        const a = next ? Math.atan2(next.y - b.y, next.x - b.x) : Math.atan2(b.vy, b.vx) + Math.PI + (rand() - 0.5) * 2.4;
        b.vx = Math.cos(a) * speed;
        b.vy = Math.sin(a) * speed;
        b.lifeMs = Math.max(b.lifeMs, 450);
        return;
      }
      alive = false;
    });
    if (alive) keep.push(b);
  }
  s.bullets = keep;
}

/** A bot shell: blocked or reflected by shields, else it hurts the hero. Returns whether it flies on. */
function hostileBolt(s: GameState, b: Bullet, shield: number) {
  const p = s.player;
  const dx = b.x - p.x;
  const dy = b.y - p.y;
  const d = Math.hypot(dx, dy);
  // The Phalanx shields catch shells around the hero.
  if (s.capstones.includes('phalanx')) {
    for (const spot of phalanxSpots(s)) {
      if (Math.hypot(b.x - spot.x, b.y - spot.y) < 20) return reflect(b);
    }
  }
  if (shield > 0 && d < HERO_R + 18 && Math.abs(angleDiff(Math.atan2(dy, dx), p.facing)) <= shieldHalf(s)) {
    return shield >= 3 ? reflect(b) : false;
  }
  // Corvin's Deflect and Joren's Council Seat send bolts back.
  if (knight && knightGuard(s, d, (dmg, color) => reflect(b, dmg, color), () => Math.atan2(b.vy, b.vx))) return true;
  // Triad-77's rolling shield bots catch bolts.
  const caught = squad ? squadBlock(s, b, () => reflect(b, 20, 'triad')) : null;
  if (caught !== null) return caught;
  if (d < p.r + b.r) {
    // A glob slows as well as hurts.
    if (b.color === 'glob' && !untouchable(s)) {
      p.slowMs = TOAD.slowMs;
      p.slowPct = Math.max(p.slowPct, TOAD.slow);
      if (b.toad) s.globHits += 1;
    }
    hurtHero(s, b.dmg, b.x - b.vx * 0.05, b.y - b.vy * 0.05);
    return false;
  }
  return true;
}

function reflect(b: Bullet, dmg = 30, color: BoltColor = 'tr9') {
  b.hostile = false;
  b.vx = -b.vx * 1.5;
  b.vy = -b.vy * 1.5;
  b.dmg = dmg;
  b.color = color;
  b.lifeMs = 1500;
  return true;
}

export function addBomb(s: GameState, kind: Bomb['kind'], x: number, y: number, ms: number, r: number, dmg: number, o: Partial<Bomb> = {}) {
  s.bombs.push({ id: s.nextId++, kind, x, y, fromX: o.fromX ?? x, fromY: o.fromY ?? y, ms, maxMs: ms, r, dmg, cluster: o.cluster ?? 0, heal: o.heal ?? 0 });
}

function bombs(s: GameState, ms: number) {
  const due = [];
  for (const b of s.bombs) {
    b.ms -= ms;
    if (b.ms <= 0) due.push(b);
  }
  if (!due.length) return;
  s.bombs = s.bombs.filter((b) => b.ms > 0);
  for (const b of due) {
    explode(s, b.x, b.y, b.r, b.dmg, b.kind === 'frag' || b.kind === 'grenade' ? BLAST.frag : b.kind === 'wreck' || b.kind === 'ship' ? BLAST.wreck : BLAST.hero);
    for (let i = 0; i < b.cluster; i++) {
      const a = (i / b.cluster) * Math.PI * 2 + rand();
      addBomb(s, 'bomblet', b.x + Math.cos(a) * 48, b.y + Math.sin(a) * 48, 260 + i * 60, 45, b.dmg * 0.5);
    }
    if (b.heal > 0) s.pickups.push({ id: s.nextId++, kind: 'medkit', x: b.x, y: b.y, heal: b.heal, value: 0 });
  }
}

function fires(s: GameState, dt: number) {
  for (const f of s.fires) {
    f.ms -= dt * 1000;
    near(s, f.x, f.y, f.r, (e) => damage(s, e, f.dps * dt, { noCrit: true }));
  }
  s.fires = s.fires.filter((f) => f.ms > 0);
}

/** Bog pools, lava vents, artillery shells, stomps, rings of fire and embers. */
function hazards(s: GameState, ms: number) {
  const p = s.player;
  const dt = ms / 1000;
  for (const h of s.hazards) {
    const d = Math.hypot(p.x - h.x, p.y - h.y);
    if (h.warnMs > 0) {
      h.warnMs -= ms;
      if (h.warnMs > 0) continue;
      // The warning is over: it goes off.
      if (d < h.r + p.r) hurtHero(s, h.dmg, h.x, h.y);
      if (h.kind === 'vent') explodeBots(s, h.x, h.y, h.r, VENT.foeDmg * PLANETS[s.planet].hp, null);
      else if (h.kind === 'strike') explodeBots(s, h.x, h.y, h.r, STRIKE.foeDmg * PLANETS[s.planet].hp, null);
      const color = h.kind === 'vent' ? BLAST.vent : h.kind === 'shell' ? BLAST.shell : h.kind === 'strike' ? BLAST.strike : BLAST.stomp;
      s.blasts.push({ id: s.nextId++, x: h.x, y: h.y, r: h.r, ms: 420, maxMs: 420, color });
      h.ms = 0;
      continue;
    }
    h.ms -= ms;
    if (h.kind === 'bog' || h.kind === 'spore') {
      if (d < h.r) {
        p.slowMs = Math.max(p.slowMs, 120);
        p.slowPct = Math.max(p.slowPct, h.kind === 'bog' ? BOG.slow : SPORE.slow);
      }
    } else if (h.kind === 'ember') {
      if (d < h.r + p.r * 0.5) hurtHero(s, h.dmg, h.x, h.y);
    } else if (h.kind === 'ring') {
      h.r += CHAMPION.ringSpeed * dt;
      if (!h.hit && Math.abs(d - h.r) < 9 + p.r * 0.6 && !inRingGap(h, Math.atan2(p.y - h.y, p.x - h.x))) {
        h.hit = true;
        hurtHero(s, h.dmg, h.x, h.y);
      }
    }
  }
  s.hazards = s.hazards.filter((h) => h.warnMs > 0 || h.ms > 0);
}

function pickups(s: GameState, ms: number) {
  const p = s.player;
  const dt = ms / 1000;
  const reach = st.pickup;
  const keep = [];
  for (const sh of s.shards) {
    const dx = p.x - sh.x;
    const dy = p.y - sh.y;
    const d = Math.hypot(dx, dy);
    if (d < reach) sh.pulled = true;
    if (sh.pulled) {
      if (d < HERO_R + 6) {
        gainXp(s, sh.value);
        continue;
      }
      const speed = Math.max(260, 900 - d * 2);
      const k = Math.min(1, (speed * dt) / d);
      sh.x += dx * k;
      sh.y += dy * k;
    }
    keep.push(sh);
  }
  s.shards = keep;
  s.pickups = s.pickups.filter((k) => {
    if (k.ms !== undefined && k.ms > 0) {
      k.ms -= ms;
      if (k.ms <= 0) return false;
    }
    const d = Math.hypot(p.x - k.x, p.y - k.y);
    // Credits are pulled in like shards.
    if (k.kind === 'credits' && d < reach && d > 1) {
      const step = Math.min(d, 420 * dt);
      k.x += ((p.x - k.x) / d) * step;
      k.y += ((p.y - k.y) / d) * step;
    }
    if (d > HERO_R + 16) return true;
    take(s, k);
    return false;
  });
}

function take(s: GameState, k: Pickup) {
  if (POWER_UPS.includes(k.kind as PowerUp)) {
    powerUp(s, k.kind as PowerUp);
    return;
  }
  if (k.kind === 'medkit') {
    heal(s, k.heal);
    pop(s, tr('plusHealth', { n: k.heal }), '#7dffa0');
  } else if (k.kind === 'credits') {
    // The Salvage Rig finds more in each chip.
    const value = Math.round(k.value * st.creditMul);
    s.credits += value;
    pop(s, tr('plusCredits', { n: value }), '#ffd36b');
  } else openChest(s);
}

/** At the end of a planet or the arena: every shard, credit and chest left lying is taken. */
export function collectAll(s: GameState) {
  st = statsOf(s);
  for (const sh of s.shards) gainXp(s, sh.value);
  s.shards = [];
  // Power-ups left lying are lost; the rest is taken.
  for (const k of s.pickups) if (!POWER_UPS.includes(k.kind as PowerUp)) take(s, k);
  s.pickups = [];
}

/** A power-up picked up. */
function powerUp(s: GameState, kind: PowerUp) {
  const p = s.player;
  s.powerUps += 1;
  const n = { bomb: 0, magnet: 0, lure: POWER.lureMs / 1000, overdrive: POWER.overdriveMs / 1000, shield: POWER.shieldHits, freeze: POWER.freezeMs / 1000, cache: POWER.cacheCredits }[kind];
  pop(s, tr(`pu_${kind}` as TextKey, { n }), '#7fe3ff');
  if (kind === 'bomb') {
    // Every foe on screen takes most of its health; a boss a little.
    for (const e of s.enemies) {
      if (e.hp <= 0 || e.charmMs > 0 || isStructure(e.kind)) continue;
      if (Math.abs(e.x - p.x) > POWER.bombR || Math.abs(e.y - p.y) > POWER.bombR * 0.6) continue;
      e.hp -= e.maxHp * (e.kind === 'boss' ? POWER.bombBoss : POWER.bombShare);
      e.flashMs = 90;
      if (e.hp <= 0) kill(s, e);
    }
    s.blasts.push({ id: s.nextId++, x: p.x, y: p.y, r: POWER.bombR, ms: 600, maxMs: 600, color: BLAST.bomb });
  } else if (kind === 'magnet') {
    for (const sh of s.shards) sh.pulled = true;
  } else if (kind === 'lure') s.lureMs = POWER.lureMs;
  else if (kind === 'overdrive') s.overdriveMs = POWER.overdriveMs;
  else if (kind === 'shield') s.shieldHits = POWER.shieldHits;
  else if (kind === 'freeze') {
    for (const e of s.enemies) if (e.kind !== 'boss' && !isStructure(e.kind)) e.stunMs = Math.max(e.stunMs, POWER.freezeMs);
  } else {
    s.credits += POWER.cacheCredits;
  }
}

/** XP gained (times the hero's XP bonus, unless `raw`). */
export function gainXp(s: GameState, value: number, raw = false) {
  s.xp += value * (raw ? 1 : st.xp);
  while (s.xp >= s.xpNext) {
    s.xp -= s.xpNext;
    s.level += 1;
    s.xpNext = xpFor(s.level);
    s.pendingLevels += 1;
  }
}

/** An elite's chest: a free tier of something held (which may unlock a capstone) and some health. */
function openChest(s: GameState) {
  s.chests += 1;
  heal(s, 25);
  const held = Object.keys(s.ranks).filter((id) => s.ranks[id] < MAX_TIER);
  if (!held.length) {
    heal(s, 25);
    pop(s, tr('supplyChest', { n: 50 }), '#ffe066');
    return;
  }
  const id = held[Math.floor(rand() * held.length)];
  raise(s, id);
  pop(s, tr('chestPop', { name: tr(UPGRADES[id].name), n: s.ranks[id] }), '#ffe066');
}

export function pop(s: GameState, text: string, color: string) {
  s.pops.push({ id: s.nextId++, x: s.player.x, y: s.player.y - 40 - 18 * (s.pops.length % 3), text, color, ms: 2200 });
  if (s.pops.length > 6) s.pops.shift();
}
