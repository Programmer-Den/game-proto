/**
 * The crew: Dax Morrow (a heavy pistol whose first shot at each foe is critical, a freighter that
 * flies by, and luck with chests), Grunda (a piercing crossbow, Rage as her health runs out and a
 * stunning Roar), KT-4 "Kettle" (a zap prod that chains, self-repair and Hack, which turns foes to
 * his side) and Cassia Vane (a long rifle, a Cloak the foes lose her in, and marks). Their
 * weapons, signatures and paths. `sim.ts` calls in here only for the crew, so every other hero's
 * run replays exactly as before. Pure state changes, randomness from `rand`, like the rest of the
 * rules.
 */
import { t as tr } from '../i18n';
import { HEROES, schemeOf } from './heroes';
import { at } from './upgrades';
import { type Ally, type Enemy, type GameState } from './state';
import { HURT_GRACE_MS, addBomb, bolt, damage, explode, gainXp, heal, knock, near, nearest, pop, ready, swarmSpot, volley } from './sim';
import { rand } from './weekly';

const rank = (s: GameState, id: string) => s.ranks[id] ?? 0;
const cap = (s: GameState, id: string) => s.capstones.includes(id);

/** Dax's freighter: how fast it flies, how long, how often it fires and how hard. */
export const FLYBY = { speed: 620, lifeMs: 1500, fireMs: 90, dmg: 13, reach: 210, every: 10_000, throttle: 5000 };
/** Grunda's Roar: its reach, how long foes are stunned, the burst of her heavy bolts. */
export const ROAR = { r: 200, wideR: 260, stunMs: 1200, fleeMs: 2500, dmg: 35, heal: 25, every: 8000, burstR: 60, burst: 22 };
/** Kettle's zap and Hack. */
export const ZAP = { jump: 110, stunMs: 400, hack: 3, wideHack: 5, hackMs: 6000, longHackMs: 9000, botnet: 25 };
/** Cassia's Cloak and marks. */
export const CLOAK = { ms: 4000, longMs: 6000, heal: 15, vanishMs: 2000, vanishEvery: 8000, mark: 0.3, bigMark: 0.6, markCredits: 8, dossierXp: 10 };

const color = (s: GameState) => schemeOf(s.hero!).bolt;

// ---------------------------------------------------------------------------------------------
// Weapons

/** The crew hero's primary weapon, called each step in place of the soldiers'. */
export function crewAttack(s: GameState, ms: number, rate: number) {
  const p = s.player;
  const hero = HEROES[s.hero!];
  p.fireMs -= ms * rate;
  if (p.fireMs > 0) return;
  const range = hero.range * (s.hero === 'kettle' && rank(s, 'prod') >= 3 ? 180 / 140 : 1);
  const targets = nearest(s, p.x, p.y, 2, range);
  if (!targets.length) {
    // Nothing in range: hold the shot until something is.
    p.fireMs = 0;
    return;
  }
  p.fireMs += hero.fireMs;
  p.shots += 1;
  const t = targets[0];
  const a = Math.atan2(t.y - p.y, t.x - p.x);
  p.aim = a;
  if (s.hero === 'kettle') {
    zap(s, t);
    return;
  }
  if (s.hero === 'dax') {
    const fh = rank(s, 'fast-hands');
    volley(s, p.x, p.y, a, hero.damage);
    // A second bolt at the next nearest (every 6th shot, every shot with Fan the Hammer), and a double tap every 3rd.
    const second = targets[1] && (cap(s, 'fan-the-hammer') || (fh >= 2 && p.shots % 6 === 0));
    if (second) bolt(s, p.x, p.y, Math.atan2(targets[1].y - p.y, targets[1].x - p.x), hero.damage);
    if (fh >= 5 && p.shots % 3 === 0) bolt(s, p.x, p.y, a + 0.05, hero.damage);
    return;
  }
  if (s.hero === 'grunda') {
    const hb = rank(s, 'heavy-bolts');
    const siege = cap(s, 'siege-crossbow');
    const burst = siege || (hb >= 5) || (hb >= 3 && p.shots % 4 === 0) ? ROAR.burst * (siege ? 1.5 : 1) : 0;
    const angles = hb >= 4 ? [a - 0.1, a + 0.1] : [a];
    for (const ang of angles) {
      volley(s, p.x, p.y, ang, hero.damage);
      if (burst > 0) s.bullets[s.bullets.length - 1].burst = burst;
    }
    return;
  }
  // Cassia: one long shot; out of the Cloak (or every shot in it, with Ghost 5) it hits three times as hard.
  const cloaked = p.sigActiveMs > 0;
  let dmg = hero.damage;
  if (p.charge > 0 || (cloaked && rank(s, 'ghost') >= 5)) {
    dmg *= 3;
    p.charge = 0;
  }
  if (cap(s, 'clean-shot') && p.shots % 3 === 0) dmg *= 2;
  volley(s, p.x, p.y, a, dmg);
}

/** Kettle's zap: the nearest foe, then on to the next one close by (more with the Prod). */
function zap(s: GameState, first: Enemy) {
  const p = s.player;
  const prod = rank(s, 'prod');
  const welder = cap(s, 'arc-welder');
  const jumps = welder ? 8 : at([2, 2, 2, 4, 4], prod, 1);
  const dmg = HEROES.kettle.damage;
  const done = [first.id];
  const pts = [p.x, p.y, first.x, first.y];
  const strike = (e: Enemy) => {
    damage(s, e, dmg);
    if (prod >= 5 && e.kind !== 'boss') e.stunMs = Math.max(e.stunMs, ZAP.stunMs);
  };
  strike(first);
  let cur = first;
  for (let i = 0; i < jumps; i++) {
    const next = nearest(s, cur.x, cur.y, 1, ZAP.jump, done)[0];
    if (!next) break;
    done.push(next.id);
    strike(next);
    pts.push(next.x, next.y);
    cur = next;
  }
  zapFx(s, pts, color(s));
  if (welder && p.shots % 5 === 0) explode(s, first.x, first.y, 70, 30, color(s));
}

function zapFx(s: GameState, pts: number[], c: string, ms = 170) {
  s.zaps.push({ id: s.nextId++, pts, color: c, ms, maxMs: ms });
  if (s.zaps.length > 60) s.zaps.shift();
}

// ---------------------------------------------------------------------------------------------
// Signatures

/** The crew hero's signature move; false (and no cooldown spent) when there is nothing to use it on. */
export function crewSignature(s: GameState) {
  const p = s.player;
  if (s.hero === 'dax') {
    flyBy(s, rank(s, 'smugglers-run') >= 4);
    return true;
  }
  if (s.hero === 'grunda') {
    roar(s);
    return true;
  }
  if (s.hero === 'kettle') {
    const n = rank(s, 'hacker') >= 1 ? ZAP.wideHack : ZAP.hack;
    if (!hack(s, n)) return false;
    zapFx(s, [p.x, p.y, p.x, p.y - 30], color(s), 300);
    return true;
  }
  cloak(s, rank(s, 'ghost') >= 1 ? CLOAK.longMs : CLOAK.ms);
  if (rank(s, 'ghost') >= 2) heal(s, CLOAK.heal);
  return true;
}

/** Dax's freighter flies in over the thickest swarm and strafes it (and comes back with `back`). */
function flyBy(s: GameState, back: boolean) {
  const p = s.player;
  const spot = swarmSpot(s, 380);
  const a = Math.atan2(spot.y - p.y, spot.x - p.x) + Math.PI / 2;
  const span = (FLYBY.speed * FLYBY.lifeMs) / 2000;
  s.allies.push({ id: s.nextId++, kind: 'freighter', x: spot.x - Math.cos(a) * span, y: spot.y - Math.sin(a) * span, cdMs: 0, lifeMs: FLYBY.lifeMs, slot: 0, aim: a });
  if (back) s.allies.push({ id: s.nextId++, kind: 'freighter', x: spot.x + Math.cos(a) * span, y: spot.y + Math.sin(a) * span, cdMs: 400, lifeMs: FLYBY.lifeMs + 400, slot: 1, aim: a + Math.PI });
  // Smuggler's Run 2: it drops charges along its line.
  if (rank(s, 'smugglers-run') >= 2) {
    for (let i = -1; i <= 1; i++) addBomb(s, 'carpet', spot.x + Math.cos(a) * i * 110, spot.y + Math.sin(a) * i * 110, 700 + (i + 1) * 180, 60, 40);
  }
}

/** Grunda's Roar: every foe near is stunned and thrown back (a boss only slowed); Warcry adds harm, flight and healing. */
function roar(s: GameState) {
  const p = s.player;
  const wc = rank(s, 'warcry');
  const r = wc >= 1 ? ROAR.wideR : ROAR.r;
  near(s, p.x, p.y, r, (e) => {
    if (wc >= 2) damage(s, e, ROAR.dmg);
    if (e.kind === 'boss') {
      e.slowPct = Math.max(e.slowPct, 0.5);
      e.slowMs = Math.max(e.slowMs, 2000);
      return;
    }
    e.stunMs = Math.max(e.stunMs, ROAR.stunMs);
    knock(e, p.x, p.y, 220);
    // Warcry 4: once the stun wears off they run.
    if (wc >= 4 && !e.elite) e.fleeMs = ROAR.stunMs + ROAR.fleeMs;
  });
  if (wc >= 5) heal(s, ROAR.heal);
  p.sigActiveMs = 500;
  s.blasts.push({ id: s.nextId++, x: p.x, y: p.y, r, ms: 500, maxMs: 500, color: HEROES.grunda.schemes[0].accent });
}

/** Kettle's Hack: the `n` nearest foes fight for him a while (elites too with Hacker 3; never a boss). */
function hack(s: GameState, n: number) {
  const p = s.player;
  const elites = rank(s, 'hacker') >= 3;
  const ms = rank(s, 'hacker') >= 2 ? ZAP.longHackMs : ZAP.hackMs;
  const pool = nearest(s, p.x, p.y, n + 6, 320).filter((e) => e.kind !== 'boss' && (elites || !e.elite)).slice(0, n);
  for (const e of pool) {
    e.charmMs = ms;
    zapFx(s, [p.x, p.y, e.x, e.y], color(s), 260);
  }
  return pool.length;
}

/** Cassia vanishes: foes lose her and go for where she stood; her next shot hits three times as hard. */
function cloak(s: GameState, ms: number) {
  const p = s.player;
  p.sigActiveMs = Math.max(p.sigActiveMs, ms);
  p.charge = 1;
  s.decoy = { x: p.x, y: p.y };
}

// ---------------------------------------------------------------------------------------------
// Each step

export function crewAbilities(s: GameState, ms: number) {
  const p = s.player;
  if (s.hero === 'dax') {
    // Smuggler's Run 5: the freighter flies by on its own (more often at Full Throttle).
    const auto = cap(s, 'full-throttle') ? FLYBY.throttle : rank(s, 'smugglers-run') >= 5 ? FLYBY.every : 0;
    if (auto > 0 && ready(s, 'flyby', auto, ms)) {
      if (nearest(s, p.x, p.y, 1, 420).length) flyBy(s, false);
      else s.cd.flyby = 300;
    }
    return;
  }
  if (s.hero === 'grunda') {
    if (cap(s, 'thunder-lungs') && ready(s, 'roar', ROAR.every, ms)) {
      if (nearest(s, p.x, p.y, 1, ROAR.wideR).length) roar(s);
      else s.cd.roar = 300;
    }
    return;
  }
  if (s.hero === 'kettle') {
    if (cap(s, 'botnet') && s.kills >= (s.cd.botnet ?? ZAP.botnet)) {
      s.cd.botnet = s.kills + ZAP.botnet;
      hack(s, 3);
    }
    return;
  }
  // Cassia: the Cloak ends; marks are kept on the strongest foes in reach.
  if (p.sigActiveMs <= 0 && s.decoy) s.decoy = null;
  const spy = rank(s, 'spymaster');
  if (spy > 0 && (s.mark === 0 || !s.enemies.some((e) => e.id === s.mark && e.hp > 0)) && ready(s, 'mark', 1000, ms)) {
    s.mark = strongest(s, HEROES.cassia.range)?.id ?? 0;
  }
  // Spymaster 4: the marked foe is slowed.
  if (spy >= 4 && s.mark) {
    const m = s.enemies.find((e) => e.id === s.mark);
    if (m) {
      m.slowPct = Math.max(m.slowPct, 0.3);
      m.slowMs = Math.max(m.slowMs, 200);
    }
  }
}

/** The strongest foe within `range`: the boss if it is there, else the one with the most health. */
function strongest(s: GameState, range: number) {
  const p = s.player;
  let best: Enemy | null = null;
  for (const e of s.enemies) {
    if (e.hp <= 0 || e.charmMs > 0) continue;
    if (Math.hypot(e.x - p.x, e.y - p.y) - e.r > range) continue;
    const score = e.kind === 'boss' ? Infinity : e.hp;
    if (!best || score > (best.kind === 'boss' ? Infinity : best.hp)) best = e;
  }
  return best;
}

// ---------------------------------------------------------------------------------------------
// Hooks from the sim

/**
 * The crew's own share on a hit: Dax's first shot at a foe is critical (triple with Fast Hands 3),
 * and Cassia's marked foe takes more. Returns the factor and whether it counts as a critical hit.
 */
export function crewHit(s: GameState, e: Enemy): { k: number; crit: boolean } {
  if (s.hero === 'dax') {
    // A boss is too big to catch off guard.
    if (e.kind !== 'boss' && e.hp >= e.maxHp) return { k: rank(s, 'fast-hands') >= 3 ? 3 : 2, crit: true };
    return { k: 1, crit: false };
  }
  if (s.hero === 'cassia') {
    let k = 1;
    if (rank(s, 'deadeye') >= 2 && e.hp > e.maxHp / 2) k *= 1.25;
    if (e.id === s.mark) k *= 1 + (rank(s, 'spymaster') >= 5 && (e.elite || e.kind === 'boss') ? CLOAK.bigMark : CLOAK.mark);
    return { k, crit: false };
  }
  return { k: 1, crit: false };
}

/** How far the crew hero's bolts fly (1 = the hero's range): Deadeye 4 lengthens Cassia's. */
export const crewRange = (s: GameState) => (s.hero === 'cassia' && rank(s, 'deadeye') >= 4 ? 1.2 : 1);

/** Whether the crew hero takes no damage right now: Cassia in her Cloak. */
export const crewUntouchable = (s: GameState) => s.hero === 'cassia' && s.player.sigActiveMs > 0;

/** Where the foes go: for the decoy while Cassia is cloaked, else for the hero. */
export function crewTarget(s: GameState) {
  return s.hero === 'cassia' && s.decoy && s.player.sigActiveMs > 0 ? s.decoy : null;
}

/** Hacked foes hit twice as hard with Hacker 4. */
export const crewTurned = (s: GameState) => (s.hero === 'kettle' && rank(s, 'hacker') >= 4 ? 2 : 1);

/** A foe falls: Lucky Streak's credits and second chests, Cassia's marks. */
export function crewKill(s: GameState, e: Enemy) {
  if (s.hero === 'dax' && e.kind !== 'boss') {
    const ls = rank(s, 'lucky-streak');
    if (ls >= 2 && rand() < 0.03) s.pickups.push({ id: s.nextId++, kind: 'credits', x: e.x + 10, y: e.y, heal: 0, value: 3 });
    if (ls >= 4 && e.elite && !s.arena) s.pickups.push({ id: s.nextId++, kind: 'chest', x: e.x - 18, y: e.y + 6, heal: 0, value: 0 });
  } else if (s.hero === 'cassia' && e.id === s.mark) {
    s.mark = 0;
    if (rank(s, 'spymaster') >= 3) s.pickups.push({ id: s.nextId++, kind: 'credits', x: e.x, y: e.y, heal: 0, value: CLOAK.markCredits });
    if (cap(s, 'dossier')) gainXp(s, CLOAK.dossierXp, true);
  }
}

/** A chest is opened: Dax's Luck lets every second one raise an upgrade of his choice; Jackpot raises one more. */
export function crewChest(s: GameState, raiseOne: () => void) {
  if (s.hero !== 'dax') return;
  if (cap(s, 'jackpot')) raiseOne();
  if (s.chests % 2 === 0) {
    s.rewardPicks += 1;
    pop(s, tr('luckPop'), HEROES.dax.schemes[0].accent);
  }
}

/** The hero took a hit: Spare Parts 5 shocks the foes around Kettle, Vanish cloaks Cassia. */
export function crewHurt(s: GameState) {
  const p = s.player;
  if (s.hero === 'kettle' && rank(s, 'spare-parts') >= 5 && rand() < 0.25) {
    near(s, p.x, p.y, 90, (e) => damage(s, e, 25));
    s.blasts.push({ id: s.nextId++, x: p.x, y: p.y, r: 90, ms: 300, maxMs: 300, color: color(s) });
  } else if (s.hero === 'cassia' && cap(s, 'vanish') && p.sigActiveMs <= 0 && s.runMs >= (s.cd.vanish ?? 0)) {
    // At most once every `vanishEvery` ms of the run (`cd.vanish` holds when it is ready again).
    s.cd.vanish = s.runMs + CLOAK.vanishEvery;
    cloak(s, CLOAK.vanishMs);
  }
}

/** A killing blow: Grunda's Second Wind and Kettle's Reboot keep them up, once a world. */
export function crewRescue(s: GameState) {
  const p = s.player;
  const save = (s.hero === 'grunda' && cap(s, 'second-wind')) || (s.hero === 'kettle' && cap(s, 'reboot'));
  if (!save || p.saved) return false;
  p.saved = true;
  p.hp = p.maxHp * (s.hero === 'grunda' ? 0.4 : 0.5);
  p.hurtMs = HURT_GRACE_MS * 4;
  pop(s, tr(s.hero === 'grunda' ? 'secondWindName' : 'rebootName'), schemeOf(s.hero!).accent);
  return true;
}

/** Healing on a kill: Wild Heart 3 gives Grunda 1 health a kill below half health. */
export function crewKillHeal(s: GameState) {
  const p = s.player;
  return s.hero === 'grunda' && rank(s, 'wild-heart') >= 3 && p.hp < p.maxHp / 2 ? 1 : 0;
}

/** A bolt of Grunda's lands: it throws the foe back, and a bursting bolt blows up there. */
export function crewBoltHit(s: GameState, e: Enemy, b: { vx: number; vy: number; burst?: number }) {
  if (s.hero !== 'grunda') return;
  knock(e, e.x - b.vx, e.y - b.vy, rank(s, 'heavy-bolts') >= 2 ? 80 : 35);
  if (b.burst) {
    const r = ROAR.burstR * (cap(s, 'siege-crossbow') ? 1.5 : 1);
    explode(s, e.x, e.y, r, b.burst, HEROES.grunda.schemes[0].bolt);
    b.burst = 0;
  }
}

// ---------------------------------------------------------------------------------------------
// Allies

/** How many of the crew's lasting allies the upgrades call for. */
export function crewAllies(s: GameState) {
  return {
    patch: s.hero === 'kettle' && rank(s, 'spare-parts') >= 3 ? 1 : 0,
    spydrone: s.hero === 'cassia' && rank(s, 'spymaster') >= 2 ? 1 : 0,
  };
}

/** Dax's freighter, Kettle's repair drone and Cassia's spy drone, each step. */
export function moveCrewAlly(s: GameState, a: Ally, ms: number) {
  const p = s.player;
  const dt = ms / 1000;
  a.cdMs -= ms;
  if (a.kind === 'freighter') {
    // A strafing run: straight across the swarm, firing down at whatever is under it.
    a.lifeMs -= ms;
    a.x += Math.cos(a.aim) * FLYBY.speed * dt;
    a.y += Math.sin(a.aim) * FLYBY.speed * dt;
    if (a.cdMs > 0) return;
    a.cdMs = FLYBY.fireMs;
    const t = nearest(s, a.x, a.y, 1, FLYBY.reach)[0];
    if (!t) return;
    const dmg = FLYBY.dmg * (rank(s, 'smugglers-run') >= 1 ? 1.3 : 1);
    bolt(s, a.x, a.y, Math.atan2(t.y - a.y, t.x - a.x), dmg, { pierce: 0, bounces: 0, color: 'dax', speed: 760, life: 420 });
    return;
  }
  if (a.kind === 'patch') {
    // Kettle's repair drone: hovers by him and patches him up.
    a.x += (p.x - 24 - a.x) * Math.min(1, 8 * dt);
    a.y += (p.y - 30 - a.y) * Math.min(1, 8 * dt);
    a.aim = p.facing;
    if (a.cdMs <= 0) {
      a.cdMs = 4000;
      if (p.hp < p.maxHp) heal(s, 4);
    }
    return;
  }
  // Cassia's spy drone: circles her and fires at her mark.
  const ang = s.time / 600;
  a.x += (p.x + Math.cos(ang) * 46 - a.x) * Math.min(1, 8 * dt);
  a.y += (p.y + Math.sin(ang) * 46 - 10 - a.y) * Math.min(1, 8 * dt);
  if (a.cdMs > 0) return;
  const t = s.enemies.find((e) => e.id === s.mark && e.hp > 0) ?? nearest(s, a.x, a.y, 1, 300)[0];
  if (!t || Math.hypot(t.x - a.x, t.y - a.y) > 420) {
    a.cdMs = 0;
    return;
  }
  a.cdMs = 700;
  a.aim = Math.atan2(t.y - a.y, t.x - a.x);
  bolt(s, a.x, a.y, a.aim, 10, { pierce: 0, bounces: 0, color: 'cassia', speed: 900, life: 500 });
}
