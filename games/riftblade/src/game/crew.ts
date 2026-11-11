/**
 * The crew: Dax Morrow (a heavy pistol whose first shot at each foe is critical, a freighter that
 * flies by, and luck with chests), Grunda (a piercing crossbow, Rage as her health runs out and a
 * stunning Roar), KT-4 "Kettle" (a zap prod that chains, self-repair and Hack, which turns foes to
 * his side) and Cassia Vane (a long rifle, a Cloak the foes lose her in, and marks). Their
 * weapons, signatures and paths. `sim.ts` calls in here only for the crew, so every other hero's
 * run replays exactly as before. Pure state changes, randomness from `rand`, like the rest of the
 * rules. Since then four more: Vesk Drayl (rockets, a Flamer and bounties), Rena Kask (twin cannons
 * that hit harder on the move, a ramming Trench Run and wingmates), Admiral Thessa Orn (a pistol
 * whose Study makes each kind of foe take more, a Blockade of bombs and fleet strikes) and Chief
 * Wikka (a slingshot, rolling Log Traps and a tribe that grows with the kills), and last Boss
 * Gorbul (a spread blaster, Fortune from the credits he holds, and thugs hired with them).
 */
import { t as tr } from '../i18n';
import { HEROES, schemeOf } from './heroes';
import { at } from './upgrades';
import { isStructure, type Ally, type Enemy, type GameState } from './state';
import { HURT_GRACE_MS, addBomb, angleDiff, bolt, damage, explode, gainXp, heal, knock, near, nearest, pop, ready, swarmSpot, syncAllies, volley } from './sim';
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

/** Vesk's rockets, Flamer and bounties. */
export const ROCKET = { burst: 0.6, r: 45, flameMs: 2500, longFlameMs: 3500, flameDmg: 9, reach: 140, longReach: 180, cone: 0.45, wideCone: 0.9, bounty: 10, bigBounty: 15, bountyHeal: 10, bigBountyHeal: 25, bountyXp: 20, range: 380 };
/** Rena's Momentum, Trench Run and wingmates. */
export const RAM = { momentumMs: 2000, momentum: 0.5, bigMomentum: 0.75, ms: 350, longMs: 525, speed: 700, dmg: 40, knock: 200, rollMs: 1500 };
/** Thessa's Study, Blockade and fleet strikes. */
export const FLEET = { per: 10, step: 0.02, cap: 0.3, bigCap: 0.45, ring: 140, bombs: 8, moreBombs: 12, bombR: 60, bombDmg: 50, heal: 20, strikeR: 80, strikeDmg: 45, reach: 400 };
/** Wikka's tribe and Log Traps. */
export const TRIBE = { every: 50, fastEvery: 35, startCap: 2, cap: 3, bigCap: 5, hugeCap: 8, fireMs: 900, fastFireMs: 450, dmg: 8, bigDmg: 12, logs: 3, moreLogs: 4, mostLogs: 6, logSpeed: 320, logMs: 2200, longLogMs: 4400, logDmg: 45, logKnock: 160, stunMs: 300 };

/** Boss Gorbul's Hired Guns and Belly Slam. */
export const THUGS = { cost: 10, n: 3, moreN: 4, lordN: 6, ms: 10_000, longMs: 15_000, fireMs: 600, dmg: 9, slamR: 90, slam: 30, slamEvery: 6000, fastSlam: 3000, slamStunMs: 500, chestCredits: 25 };

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
      // The burst rides the main bolt, the first of the volley (Scatter's side bolts come after it).
      const main = s.bullets.length;
      volley(s, p.x, p.y, ang, hero.damage);
      if (burst > 0) s.bullets[main].burst = burst;
    }
    return;
  }
  if (s.hero === 'vesk') {
    const ar = rank(s, 'arsenal');
    const n = cap(s, 'rocket-swarm') ? 3 : ar >= 5 ? 2 : ar >= 2 && p.shots % 3 === 0 ? 2 : 1;
    for (let i = 0; i < n; i++) rocket(s, a + (i - (n - 1) / 2) * 0.22, hero.damage, ROCKET.r * (ar >= 1 ? 1.2 : 1), ar >= 4 ? 4 : 0);
    return;
  }
  if (s.hero === 'rena') {
    // Twin cannons (three on the Gunship), harder the longer she has been moving.
    const gs = rank(s, 'gunship');
    const dmg = hero.damage * (1 + (rank(s, 'afterburner') >= 2 ? RAM.bigMomentum : RAM.momentum) * ((s.cd.momentum ?? 0) / RAM.momentumMs));
    const side = a + Math.PI / 2;
    for (const off of gs >= 3 ? [-8, 0, 8] : [-8, 8]) volley(s, p.x + Math.cos(side) * off, p.y + Math.sin(side) * off, a, dmg);
    if (gs >= 5 && p.shots % 4 === 0) rocket(s, a, dmg * 2, 50, 3);
    return;
  }
  if (s.hero === 'thessa' || s.hero === 'gorbul') {
    volley(s, p.x, p.y, a, hero.damage);
    return;
  }
  if (s.hero === 'wikka') {
    volley(s, p.x, p.y, a, hero.damage);
    // Slinger 4: a second stone at the next nearest.
    if (rank(s, 'slinger') >= 4) bolt(s, p.x, p.y, targets[1] ? Math.atan2(targets[1].y - p.y, targets[1].x - p.x) : a + 0.1, hero.damage);
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

/** A rocket that bursts where it lands (Vesk's, and Rena's Gunship missile). */
function rocket(s: GameState, a: number, dmg: number, r: number, homing: number) {
  const p = s.player;
  bolt(s, p.x, p.y, a, dmg, { color: 'rocket', homing, pierce: 0, r: 5 });
  const b = s.bullets[s.bullets.length - 1];
  b.burst = dmg * ROCKET.burst;
  b.burstR = r;
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
  if (s.hero === 'vesk') {
    p.sigActiveMs = rank(s, 'scorched-earth') >= 1 ? ROCKET.longFlameMs : ROCKET.flameMs;
    return true;
  }
  if (s.hero === 'rena') {
    trenchRun(s);
    return true;
  }
  if (s.hero === 'thessa') {
    blockade(s);
    return true;
  }
  if (s.hero === 'wikka') {
    logTrap(s);
    return true;
  }
  if (s.hero === 'gorbul') return hireGuns(s);
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
  const pool = nearest(s, p.x, p.y, n + 6, 320).filter((e) => e.kind !== 'boss' && !isStructure(e.kind) && (elites || !e.elite)).slice(0, n);
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

/** Rena's Trench Run: she rams straight ahead, through the foes in her way. */
function trenchRun(s: GameState) {
  const p = s.player;
  const af = rank(s, 'afterburner');
  p.dashKind = 'ram';
  p.dashAngle = p.facing;
  p.dashMs = af >= 4 ? RAM.longMs : RAM.ms;
  p.dashSpeed = RAM.speed;
  p.dashTarget = 0;
  p.dashHit = [];
  // Barrel Roll: no harm for a while after.
  if (cap(s, 'barrel-roll')) p.hurtMs = Math.max(p.hurtMs, p.dashMs + RAM.rollMs);
  // Wingmates 5: the wingmates follow her in with a burst each.
  if (rank(s, 'wingmates') >= 5) {
    for (const w of s.allies) {
      if (w.kind !== 'wingman') continue;
      const t = nearest(s, w.x, w.y, 1, 340)[0];
      if (!t) continue;
      const a = Math.atan2(t.y - w.y, t.x - w.x);
      for (const off of [-0.12, 0, 0.12]) bolt(s, w.x, w.y, a + off, 10, { pierce: 0, bounces: 0, color: 'rena', speed: 820, life: 450 });
    }
  }
}

/** Thessa's Blockade: a ring of bombs around her (and a wider second one with Iron Ring 5). */
function blockade(s: GameState) {
  const p = s.player;
  const ir = rank(s, 'iron-ring');
  const ring = (r: number, delay: number) => {
    const n = ir >= 2 ? FLEET.moreBombs : FLEET.bombs;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      addBomb(s, 'carpet', p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, delay + 500 + (i * 600) / n, FLEET.bombR, FLEET.bombDmg);
    }
  };
  const r = FLEET.ring * (ir >= 1 ? 1.3 : 1);
  ring(r, 0);
  if (ir >= 5) ring(r * 1.5, 1200);
  if (ir >= 4) heal(s, FLEET.heal);
  p.sigActiveMs = 600;
}

/** Wikka's Log Trap: logs roll out ahead of him, knocking down what they meet. */
function logTrap(s: GameState) {
  const p = s.player;
  const lt = rank(s, 'log-traps');
  const n = lt >= 5 ? TRIBE.mostLogs : lt >= 1 ? TRIBE.moreLogs : TRIBE.logs;
  const life = lt >= 4 ? TRIBE.longLogMs : TRIBE.logMs;
  const side = p.facing + Math.PI / 2;
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 30;
    s.allies.push({ id: s.nextId++, kind: 'log', x: p.x + Math.cos(side) * off, y: p.y + Math.sin(side) * off, cdMs: 0, lifeMs: life, slot: i, aim: p.facing, hit: [] });
  }
}

/** Gorbul's Hired Guns: thugs for a while, paid from the run's credits; false (nothing spent) when he can't pay. */
function hireGuns(s: GameState) {
  const p = s.player;
  const pay = rank(s, 'payroll');
  const cost = pay >= 3 ? 0 : THUGS.cost;
  if (s.credits < cost) return false;
  if (cost > 0) {
    s.credits -= cost;
    pop(s, tr('hirePop', { n: cost }), '#ffd36b');
  }
  const n = cap(s, 'crime-lord') ? THUGS.lordN : pay >= 1 ? THUGS.moreN : THUGS.n;
  const life = pay >= 4 ? THUGS.longMs : THUGS.ms;
  // New thugs take the ring's next slots, so they don't stand on those still on the payroll.
  const have = s.allies.reduce((m, a) => (a.kind === 'thug' ? Math.max(m, a.slot + 1) : m), 0);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    s.allies.push({ id: s.nextId++, kind: 'thug', x: p.x + Math.cos(a) * 40, y: p.y + Math.sin(a) * 40, cdMs: 200 + i * 80, lifeMs: life, slot: have + i, aim: a });
  }
  return true;
}

/** Gorbul's Belly Slam (Heavyweight 2): a shockwave round him. */
function bellySlam(s: GameState) {
  const p = s.player;
  const stun = rank(s, 'heavyweight') >= 3;
  near(s, p.x, p.y, THUGS.slamR, (e) => {
    damage(s, e, THUGS.slam);
    if (e.kind === 'boss') return;
    knock(e, p.x, p.y, 180);
    if (stun) e.stunMs = Math.max(e.stunMs, THUGS.slamStunMs);
  });
  s.blasts.push({ id: s.nextId++, x: p.x, y: p.y, r: THUGS.slamR, ms: 350, maxMs: 350, color: HEROES.gorbul.schemes[0].accent });
}

/** Vesk's Flamer, each tenth of a second while it burns: a cone of fire at the nearest foe. */
function flame(s: GameState) {
  const p = s.player;
  const se = rank(s, 'scorched-earth');
  const inferno = cap(s, 'inferno');
  const reach = se >= 2 ? ROCKET.longReach : ROCKET.reach;
  const half = se >= 5 ? ROCKET.wideCone : ROCKET.cone;
  const t = nearest(s, p.x, p.y, 1, reach * 1.5)[0];
  if (t) p.aim = Math.atan2(t.y - p.y, t.x - p.x);
  near(s, p.x, p.y, reach, (e) => {
    if (!inferno && Math.abs(angleDiff(Math.atan2(e.y - p.y, e.x - p.x), p.aim)) > half) return;
    damage(s, e, ROCKET.flameDmg, { noCrit: true });
    if (se >= 3 && e.kind !== 'boss') {
      e.slowPct = Math.max(e.slowPct, 0.3);
      e.slowMs = Math.max(e.slowMs, 300);
    }
  });
  // Flames to see, drawn as fire on the ground; they do no harm of their own (`dps` 0).
  const flames = inferno ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => [(i / 8) * Math.PI * 2, 0.6] as const) : [0.3, 0.55, 0.8].flatMap((k) => [[p.aim - half * 0.5, k], [p.aim + half * 0.5, k]] as const);
  for (const [a, k] of flames) s.fires.push({ id: s.nextId++, x: p.x + Math.cos(a) * reach * k, y: p.y + Math.sin(a) * reach * k, r: 10 + 26 * k, ms: 260, dps: 0 });
}

/** Thessa's fleet: a strike on the thickest swarm in reach (two with Fleet Command 4). */
function strike(s: GameState) {
  const fc = rank(s, 'fleet-command');
  const dmg = FLEET.strikeDmg * (fc >= 2 ? 1.3 : 1);
  const spot = swarmSpot(s, FLEET.reach);
  addBomb(s, 'carpet', spot.x, spot.y, 700, FLEET.strikeR, dmg);
  if (fc >= 4) addBomb(s, 'carpet', spot.x + 70, spot.y - 40, 900, FLEET.strikeR, dmg);
}

/** How much more Thessa's shots hurt a foe of this kind for her Study (0 to the cap). */
export function studied(s: GameState, kind: string) {
  const top = rank(s, 'tactician') >= 3 ? FLEET.bigCap : FLEET.cap;
  const got = Math.min(top, FLEET.step * Math.floor(((s.study ??= {})[kind] ?? 0) / FLEET.per));
  return cap(s, 'grand-strategy') ? Math.max(top / 2, got) : got;
}

/** How many of Wikka's tribe have joined so far: one every 50 kills, up to 2 (more with the Tribe path). */
export function tribeSize(s: GameState) {
  const tb = rank(s, 'tribe');
  const top = tb >= 5 ? TRIBE.hugeCap : tb >= 2 ? TRIBE.bigCap : tb >= 1 ? TRIBE.cap : TRIBE.startCap;
  return Math.min(top, Math.floor(s.kills / (tb >= 1 ? TRIBE.fastEvery : TRIBE.every)));
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
  if (s.hero === 'vesk') {
    if (p.sigActiveMs > 0 && ready(s, 'flame', 100, ms)) flame(s);
    // Bounty: the strongest foe in reach carries a price.
    if (rank(s, 'bounty') > 0) keepMark(s, ROCKET.range, ms);
    return;
  }
  if (s.hero === 'rena') {
    // Momentum builds while she moves and drains twice as fast when she stops.
    s.cd.momentum = Math.max(0, Math.min(RAM.momentumMs, (s.cd.momentum ?? 0) + (p.moving ? ms : -2 * ms)));
    if (p.dashMs > 0 && p.dashKind === 'ram') {
      near(s, p.x, p.y, p.r + 30, (e) => {
        if (p.dashHit.includes(e.id)) return;
        p.dashHit.push(e.id);
        damage(s, e, RAM.dmg * (rank(s, 'afterburner') >= 5 ? 2 : 1));
        if (e.kind !== 'boss') knock(e, p.x, p.y, RAM.knock);
      });
    }
    return;
  }
  if (s.hero === 'thessa') {
    const fc = rank(s, 'fleet-command');
    const every = cap(s, 'orbital-barrage') ? 2000 : fc >= 5 ? 4000 : fc >= 3 ? 6000 : fc >= 1 ? 8000 : 0;
    if (every > 0 && ready(s, 'strike', every, ms)) {
      if (nearest(s, p.x, p.y, 1, FLEET.reach).length) strike(s);
      else s.cd.strike = 300;
    }
    // Perfect Ring: the Blockade goes off on its own every 10 seconds.
    if (cap(s, 'perfect-ring') && ready(s, 'ring', 10_000, ms)) {
      if (nearest(s, p.x, p.y, 1, FLEET.ring * 1.3).length) blockade(s);
      else s.cd.ring = 300;
    }
    return;
  }
  if (s.hero === 'gorbul') {
    const hw = rank(s, 'heavyweight');
    if (hw >= 2 && ready(s, 'slam', hw >= 5 ? THUGS.fastSlam : THUGS.slamEvery, ms)) {
      if (nearest(s, p.x, p.y, 1, THUGS.slamR).length) bellySlam(s);
      else s.cd.slam = 300;
    }
    return;
  }
  if (s.hero === 'wikka') {
    if (s.allies.filter((a) => a.kind === 'tribesman').length < tribeSize(s)) syncAllies(s);
    // Stampede: logs roll on their own every 6 seconds.
    if (cap(s, 'stampede') && ready(s, 'stampede', 6000, ms)) {
      if (nearest(s, p.x, p.y, 1, 300).length) logTrap(s);
      else s.cd.stampede = 300;
    }
    return;
  }
  // Cassia: the Cloak ends; marks are kept on the strongest foes in reach.
  if (p.sigActiveMs <= 0 && s.decoy) s.decoy = null;
  const spy = rank(s, 'spymaster');
  if (spy > 0) keepMark(s, HEROES.cassia.range, ms);
  // Spymaster 4: the marked foe is slowed.
  if (spy >= 4 && s.mark) {
    const m = s.enemies.find((e) => e.id === s.mark);
    if (m) {
      m.slowPct = Math.max(m.slowPct, 0.3);
      m.slowMs = Math.max(m.slowMs, 200);
    }
  }
}

/** Keeps a mark on the strongest foe within `range` (Cassia's marks, Vesk's bounties). */
function keepMark(s: GameState, range: number, ms: number) {
  if ((s.mark === 0 || !s.enemies.some((e) => e.id === s.mark && e.hp > 0)) && ready(s, 'mark', 1000, ms)) {
    s.mark = strongest(s, range)?.id ?? 0;
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
  if (s.hero === 'vesk') return { k: e.id === s.mark && rank(s, 'bounty') >= 3 ? 1.25 : 1, crit: false };
  if (s.hero === 'thessa') return { k: (1 + studied(s, e.kind)) * (e.kind === 'boss' && rank(s, 'tactician') >= 5 ? 1.2 : 1), crit: false };
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
  } else if (s.hero === 'vesk' && (e.id === s.mark || (e.elite && rank(s, 'bounty') >= 4)) && rank(s, 'bounty') > 0) {
    // A bounty is paid: credits and a little health (more on Bounty 2 and 5), XP on Bounty 5, a chest on Big Game.
    const bt = rank(s, 'bounty');
    if (e.id === s.mark) s.mark = 0;
    s.pickups.push({ id: s.nextId++, kind: 'credits', x: e.x, y: e.y, heal: 0, value: bt >= 5 ? ROCKET.bigBounty : ROCKET.bounty });
    heal(s, bt >= 2 ? ROCKET.bigBountyHeal : ROCKET.bountyHeal);
    if (bt >= 5) gainXp(s, ROCKET.bountyXp, true);
    if (cap(s, 'big-game') && !s.arena && e.kind !== 'boss') s.pickups.push({ id: s.nextId++, kind: 'chest', x: e.x - 18, y: e.y + 6, heal: 0, value: 0 });
  } else if (s.hero === 'gorbul' && e.kind !== 'boss') {
    if (rank(s, 'bankroll') >= 2 && rand() < 0.04) s.pickups.push({ id: s.nextId++, kind: 'credits', x: e.x + 10, y: e.y, heal: 0, value: 2 });
  } else if (s.hero === 'thessa') {
    const study = (s.study ??= {});
    study[e.kind] = (study[e.kind] ?? 0) + (rank(s, 'tactician') >= 1 ? 2 : 1) * (e.elite && rank(s, 'tactician') >= 4 ? 10 : 1);
  } else if (s.hero === 'cassia' && e.id === s.mark) {
    s.mark = 0;
    if (rank(s, 'spymaster') >= 3) s.pickups.push({ id: s.nextId++, kind: 'credits', x: e.x, y: e.y, heal: 0, value: CLOAK.markCredits });
    if (cap(s, 'dossier')) gainXp(s, CLOAK.dossierXp, true);
  }
}

/** A chest is opened: Dax's Luck lets every second one raise an upgrade of his choice; Jackpot raises one more. */
export function crewChest(s: GameState, raiseOne: () => void) {
  // Bankroll 5: Gorbul finds credits in every chest.
  if (s.hero === 'gorbul' && rank(s, 'bankroll') >= 5) {
    s.credits += THUGS.chestCredits;
    pop(s, tr('plusCredits', { n: THUGS.chestCredits }), '#ffd36b');
  }
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

/** Healing on a kill: Wild Heart 3 gives Grunda 1 health a kill below half health, Golden Touch Gorbul 1 while he holds 100 credits. */
export function crewKillHeal(s: GameState) {
  const p = s.player;
  if (s.hero === 'gorbul') return cap(s, 'golden-touch') && s.credits >= 100 ? 1 : 0;
  return s.hero === 'grunda' && rank(s, 'wild-heart') >= 3 && p.hp < p.maxHp / 2 ? 1 : 0;
}

/** A crew bolt lands: Grunda's throw the foe back, Wikka's stones stun with Slinger 5, and a bursting bolt blows up there. */
export function crewBoltHit(s: GameState, e: Enemy, b: { vx: number; vy: number; burst?: number; burstR?: number }) {
  if (s.hero === 'grunda') knock(e, e.x - b.vx, e.y - b.vy, rank(s, 'heavy-bolts') >= 2 ? 80 : 35);
  if (s.hero === 'wikka' && rank(s, 'slinger') >= 5 && e.kind !== 'boss') e.stunMs = Math.max(e.stunMs, TRIBE.stunMs);
  if (b.burst) {
    const r = b.burstR ?? ROAR.burstR * (cap(s, 'siege-crossbow') ? 1.5 : 1);
    explode(s, e.x, e.y, r, b.burst, HEROES[s.hero!].schemes[0].bolt);
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
    wingman: s.hero !== 'rena' ? 0 : cap(s, 'flight-leader') ? 4 : at([1, 1, 2, 2, 2], rank(s, 'wingmates'), 0),
    tribesman: s.hero === 'wikka' ? tribeSize(s) : 0,
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
  if (a.kind === 'log') {
    // A rolling log: on along its line, knocking each foe it meets once.
    a.lifeMs -= ms;
    a.x += Math.cos(a.aim) * TRIBE.logSpeed * dt;
    a.y += Math.sin(a.aim) * TRIBE.logSpeed * dt;
    const hit = (a.hit ??= []);
    near(s, a.x, a.y, 24, (e) => {
      if (hit.includes(e.id)) return;
      hit.push(e.id);
      damage(s, e, TRIBE.logDmg * (rank(s, 'log-traps') >= 2 ? 1.5 : 1));
      if (e.kind !== 'boss') knock(e, a.x, a.y, TRIBE.logKnock);
    });
    return;
  }
  if (a.kind === 'thug') {
    // A hired gun: keeps near Gorbul in a ring and shoots the nearest foe, until his pay runs out.
    a.lifeMs -= ms;
    const pay = rank(s, 'payroll');
    const n = Math.max(1, s.allies.filter((o) => o.kind === 'thug').length);
    const ang = (a.slot * Math.PI * 2) / n + s.time / 5000;
    a.x += (p.x + Math.cos(ang) * 56 - a.x) * Math.min(1, 5 * dt);
    a.y += (p.y + Math.sin(ang) * 56 - a.y) * Math.min(1, 5 * dt);
    if (a.cdMs > 0) return;
    const t = nearest(s, a.x, a.y, 1, 300)[0];
    if (!t) {
      a.cdMs = 0;
      return;
    }
    a.aim = Math.atan2(t.y - a.y, t.x - a.x);
    bolt(s, a.x, a.y, a.aim, THUGS.dmg * (pay >= 2 ? 1.5 : 1), { pierce: 0, bounces: 0, color: 'gorbul', speed: 640, life: 480 });
    a.cdMs = THUGS.fireMs * (pay >= 5 ? 0.5 : 1);
    return;
  }
  if (a.kind === 'wingman' || a.kind === 'tribesman') {
    // Wingmates fly in a V behind Rena; the tribe walks in a loose ring around Wikka.
    const wing = a.kind === 'wingman';
    const n = Math.max(1, s.allies.filter((o) => o.kind === a.kind).length);
    const ang = wing ? p.facing + Math.PI + (a.slot % 2 ? 1 : -1) * (0.6 + 0.3 * Math.floor(a.slot / 2)) : (a.slot * Math.PI * 2) / n + s.time / 4000;
    const dist = wing ? 46 + 18 * Math.floor(a.slot / 2) : 48;
    a.x += (p.x + Math.cos(ang) * dist - a.x) * Math.min(1, 6 * dt);
    a.y += (p.y + Math.sin(ang) * dist - a.y) * Math.min(1, 6 * dt);
    if (a.cdMs > 0) return;
    const t = nearest(s, a.x, a.y, 1, 320)[0];
    if (!t) {
      a.cdMs = 0;
      return;
    }
    a.aim = Math.atan2(t.y - a.y, t.x - a.x);
    if (wing) {
      const wm = rank(s, 'wingmates');
      bolt(s, a.x, a.y, a.aim, 8 * (wm >= 2 || cap(s, 'flight-leader') ? 1.5 : 1), { pierce: 0, bounces: 0, color: 'rena', speed: 820, life: 420 });
      a.cdMs = wm >= 4 ? 400 : 800;
    } else {
      const tb = rank(s, 'tribe');
      bolt(s, a.x, a.y, a.aim, tb >= 3 ? TRIBE.bigDmg : TRIBE.dmg, { pierce: 0, bounces: 0, color: 'wikka', speed: 600, life: 550 });
      a.cdMs = tb >= 4 ? TRIBE.fastFireMs : TRIBE.fireMs;
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
