/**
 * The knights (the first seven, then Sable Rhee, General Krull and Mother Ysolde): their attacks,
 * signature moves and paths, and the Blade, Current and Hollow
 * pools any knight can draw from. `sim.ts` calls in here each step for a knight (and never for a
 * soldier, so the soldiers' runs replay exactly as before). Pure state changes, randomness from
 * `rand`, like the rest of the rules.
 */
import { t as tr } from '../i18n';
import { HEROES, isKnight, schemeOf, type HeroId } from './heroes';
import { at } from './upgrades';
import { fullTemper, isStructure, onPlatform, type Ally, type Enemy, type GameState } from './state';
import { addBomb, angleDiff, bolt, damage, explode, gainXp, heal, knock, near, nearest, pop, ready, stats, swarmSpot } from './sim';
import { rand } from './weekly';

const rank = (s: GameState, id: string) => s.ranks[id] ?? 0;
const cap = (s: GameState, id: string) => s.capstones.includes(id);
const cross = (s: GameState, id: string) => s.crossovers.includes(id);

/** Kael Varro is drawn in his Fallen colours (Lord Vharn's teal blade) once he takes The Fall. */
export function heroVariant(s: GameState) {
  return s.hero === 'kael' && rank(s, 'the-fall') > 0 ? 1 : 0;
}

/** The colour of the hero's blade, lightning and swings. */
export function bladeColor(s: GameState) {
  return schemeOf(s.hero!, heroVariant(s)).bolt;
}

// ---------------------------------------------------------------------------------------------
// Effects on screen

function slashFx(s: GameState, x: number, y: number, r: number, a: number, half: number, color: string, ms = 200) {
  s.slashes.push({ id: s.nextId++, x, y, r, a, half, color, ms, maxMs: ms });
  if (s.slashes.length > 80) s.slashes.shift();
}

function zapFx(s: GameState, pts: number[], color: string, ms = 170) {
  s.zaps.push({ id: s.nextId++, pts, color, ms, maxMs: ms });
  if (s.zaps.length > 60) s.zaps.shift();
}

// ---------------------------------------------------------------------------------------------
// Hits

/**
 * A knight's own hit on a foe. Joren's Edge makes every 10th a critical hit (every 5th with Royal
 * Fury, whose crits also chain to two foes near).
 */
function hit(s: GameState, e: Enemy, dmg: number) {
  if (s.hero === 'joren') {
    const p = s.player;
    p.hits += 1;
    const fury = cap(s, 'royal-fury');
    if (p.hits % (fury ? 5 : 10) === 0) {
      damage(s, e, dmg, { crit: true });
      if (fury) {
        for (const o of nearest(s, e.x, e.y, 2, 150, [e.id])) {
          damage(s, o, dmg * 2, { noCrit: true });
          zapFx(s, [e.x, e.y, o.x, o.y], bladeColor(s), 140);
        }
      }
      return;
    }
  }
  damage(s, e, dmg);
}

/**
 * Cuts every foe within `r` of a point inside the arc `a` +- `half` (all round when `half` is pi),
 * each once; returns how many it hit.
 */
function cut(s: GameState, x: number, y: number, r: number, a: number, half: number, dmg: number, push = 0, onHit?: (e: Enemy) => void) {
  let n = 0;
  near(s, x, y, r, (e) => {
    if (half < Math.PI && Math.hypot(e.x - x, e.y - y) > e.r + 6 && Math.abs(angleDiff(Math.atan2(e.y - y, e.x - x), a)) > half) return;
    hit(s, e, dmg);
    if (push) knock(e, x, y, push);
    onHit?.(e);
    n += 1;
  });
  return n;
}

/** Throws a blade that flies out, turns and comes back to the hero, cutting every foe it passes. */
function throwBlade(s: GameState, x: number, y: number, angle: number, dmg: number, reach = 260) {
  const speed = 430;
  bolt(s, x, y, angle, dmg, { speed, life: 3200, pierce: 999, bounces: 0, color: s.hero!, r: 11, spin: true, ret: (reach / speed) * 1000 });
}

/** Lightning from a point to `first`, then on from foe to foe; `fork` also hits one more per jump. */
function lightning(s: GameState, x: number, y: number, first: Enemy, jumps: number, dmg: number, color: string, fork = false) {
  const done = [first.id];
  const pts = [x, y, first.x, first.y];
  hit(s, first, dmg);
  let cur = first;
  for (let i = 0; i < jumps; i++) {
    const next = nearest(s, cur.x, cur.y, fork ? 2 : 1, 150, done);
    if (!next.length) break;
    if (next[1]) {
      done.push(next[1].id);
      hit(s, next[1], dmg * 0.7);
      zapFx(s, [cur.x, cur.y, next[1].x, next[1].y], color, 140);
    }
    done.push(next[0].id);
    hit(s, next[0], dmg);
    pts.push(next[0].x, next[0].y);
    cur = next[0];
  }
  zapFx(s, pts, color);
}

/** The strongest foe within `range`: the boss if it is there, else the one with the most health. */
function strongest(s: GameState, range: number, skip: number[] = []) {
  const p = s.player;
  let best: Enemy | null = null;
  for (const e of s.enemies) {
    if (e.hp <= 0 || e.charmMs > 0 || skip.includes(e.id)) continue;
    if (Math.hypot(e.x - p.x, e.y - p.y) - e.r > range) continue;
    const score = e.kind === 'boss' ? Infinity : e.hp;
    if (!best || score > (best.kind === 'boss' ? Infinity : best.hp)) best = e;
  }
  return best;
}

/** Lifts the `n` nearest foes (never a boss); they are crushed when the grip ends. */
function grip(s: GameState, n: number, dmg: number) {
  const p = s.player;
  const pool = nearest(s, p.x, p.y, n + 4, 320).filter((e) => e.kind !== 'boss' && e.gripMs <= 0 && e.charmMs <= 0).slice(0, n);
  for (const e of pool) {
    e.gripMs = 700;
    e.gripDmg = dmg;
    e.stunMs = Math.max(e.stunMs, 700);
    // Iron Reach: the thrown blade flies at every gripped foe.
    if (cross(s, 'iron-reach')) throwBlade(s, p.x, p.y, Math.atan2(e.y - p.y, e.x - p.x), 20, Math.hypot(e.x - p.x, e.y - p.y) + 20);
  }
  return pool.length;
}

/** A gripped foe is crushed; with Iron Grip's tier 4 it is thrown and bursts on those near. */
export function crush(s: GameState, e: Enemy) {
  damage(s, e, e.gripDmg);
  if (s.hero === 'vharn' && rank(s, 'iron-grip') >= 4) explode(s, e.x, e.y, 60, 25, bladeColor(s));
}

/** A dash: `kind` 'blade' cuts what it passes; 'leap' and 'hunt' home in on `target`. */
function dash(s: GameState, kind: 'blade' | 'leap' | 'hunt', angle: number, ms: number, speed: number, dmg: number, target?: Enemy) {
  const p = s.player;
  p.dashKind = kind;
  p.dashAngle = angle;
  p.dashMs = ms;
  p.dashSpeed = speed;
  p.dashDmg = dmg;
  p.dashTarget = target?.id ?? 0;
}

// ---------------------------------------------------------------------------------------------
// The primary attacks

/** How fast the knight's attack comes round (1 = as listed). */
function attackRate(s: GameState) {
  const p = s.player;
  let rate = stats().fireRate;
  if (p.formMs > 0) rate *= 2;
  if (s.hero === 'corvin' && p.sigActiveMs > 0 && rank(s, 'bulwark') >= 5) rate *= 2;
  if (s.hero === 'joren' && rank(s, 'duelist') >= 5) rate *= 1.3;
  if (s.hero === 'sable') rate *= (rank(s, 'scrapper') >= 1 ? 1.15 : 1) * (cap(s, 'whirling-edge') ? 1.4 : 1);
  return rate;
}

/** The knight's attack each step; Kresh's orbit cuts all the time, the rest strike in beats. */
export function knightAttack(s: GameState, ms: number) {
  const p = s.player;
  const hero = HEROES[s.hero!];
  if (hero.aim === 'orbit') orbitHits(s);
  p.fireMs -= ms * attackRate(s);
  if (p.fireMs > 0) return;
  const struck =
    hero.aim === 'slash' ? slash(s)
    : hero.aim === 'throw' ? throwAttack(s)
    : hero.aim === 'ripple' ? ripple(s)
    : hero.aim === 'spin' ? spin(s)
    : hero.aim === 'chain' ? chain(s)
    : hero.aim === 'flurry' ? flurry(s)
    : hero.aim === 'sweep' ? sweep(s)
    : hero.aim === 'cleave' ? cleave(s)
    : hero.aim === 'hex' ? hexAttack(s)
    : true;
  // Nothing in reach: hold the swing until something is.
  if (struck) p.fireMs += hero.fireMs;
  else p.fireMs = 0;
}

/** Kael: a slash in front; Prodigy combos cut all round, and at full Temper The Fall throws a wave. */
function slash(s: GameState) {
  const p = s.player;
  const R = HEROES.kael.range * stats().reach;
  const t = nearest(s, p.x, p.y, 1, R)[0];
  if (!t) return false;
  const a = Math.atan2(t.y - p.y, t.x - p.x);
  p.aim = a;
  p.shots += 1;
  const prodigy = rank(s, 'prodigy');
  const fall = rank(s, 'the-fall');
  const dmg = HEROES.kael.damage * (prodigy >= 3 ? 1.3 : 1) * (fall >= 4 ? 1.2 : 1) * (cap(s, 'hollow-rebirth') ? 2 : 1);
  const every = p.formMs > 0 ? 1 : prodigy >= 5 ? 2 : prodigy >= 2 ? 3 : 0;
  const color = bladeColor(s);
  if (every > 0 && p.shots % every === 0) {
    cut(s, p.x, p.y, R * 1.1, a, Math.PI, dmg * 1.2, 120);
    slashFx(s, p.x, p.y, R * 1.1, a, Math.PI, color);
  } else {
    cut(s, p.x, p.y, R, a, 1.05, dmg, 60);
    slashFx(s, p.x, p.y, R, a, 1.05, color);
  }
  if (fall >= 5 && fullTemper(s)) bolt(s, p.x, p.y, a, dmg, { speed: 520, life: 750, pierce: 6, bounces: 0, color: 'fallen', r: 9 });
  return true;
}

/** Vharn: throws his blade at the nearest foe; it flies out and comes back. */
function throwAttack(s: GameState) {
  const p = s.player;
  const R = HEROES.vharn.range * stats().reach;
  const t = nearest(s, p.x, p.y, 1, R)[0];
  if (!t) return false;
  p.aim = Math.atan2(t.y - p.y, t.x - p.x);
  throwBlade(s, p.x, p.y, p.aim, HEROES.vharn.damage, R);
  return true;
}

/** Oom: a Current push ripples out all round; standing still charges it (Stillness). */
function ripple(s: GameState) {
  const p = s.player;
  const still = rank(s, 'stillness');
  const charge = still > 0 ? Math.min(1, p.charge / (still >= 4 ? 1000 : 1500)) * (still >= 2 ? 1 : 0.6) : 0;
  const R = HEROES.oom.range * stats().reach * (1 + charge * 0.6);
  if (!nearest(s, p.x, p.y, 1, R).length) return false;
  cut(s, p.x, p.y, R, 0, Math.PI, HEROES.oom.damage * (1 + charge), 220);
  slashFx(s, p.x, p.y, R, 0, Math.PI, bladeColor(s), 260);
  p.charge = 0;
  return true;
}

/** Corvin: a defensive spin that cuts every foe close by; Persuasion may turn some. */
function spin(s: GameState) {
  const p = s.player;
  const R = HEROES.corvin.range * stats().reach;
  if (!nearest(s, p.x, p.y, 1, R).length) return false;
  const pers = rank(s, 'persuasion');
  const chance = at([0.1, 0.1, 0.2, 0.2, 0.25], pers, 0);
  const ms = at([6000, 9000, 9000, 9000, 12000], pers, 0);
  cut(s, p.x, p.y, R, 0, Math.PI, HEROES.corvin.damage, 120, (e) => {
    if (pers > 0 && e.hp > 0 && !e.elite && e.kind !== 'boss' && rand() < chance) e.charmMs = ms;
  });
  slashFx(s, p.x, p.y, R, s.time / 120, Math.PI, bladeColor(s));
  return true;
}

/** Veyl: lightning to the nearest foe that chains on (Storm makes it jump further and fork). */
function chain(s: GameState) {
  const p = s.player;
  const t = nearest(s, p.x, p.y, 1, HEROES.veyl.range * stats().reach)[0];
  if (!t) return false;
  p.aim = Math.atan2(t.y - p.y, t.x - p.x);
  const storm = rank(s, 'storm');
  lightning(s, p.x, p.y, t, storm > 0 ? at([3, 3, 6, 6, 10], storm, 2) : 2, HEROES.veyl.damage, bladeColor(s), storm >= 2);
  // Dark Bargain: each cast costs health (never the last point).
  const cost = at([0.5, 0.5, 0.5, 0.5, 1], rank(s, 'dark-bargain'), 0);
  if (cost > 0) p.hp = Math.max(1, p.hp - cost);
  return true;
}

/** Joren: a flurry that strikes in four directions (6 or 8 ways with Duelist Form), turning each time. */
function flurry(s: GameState) {
  const p = s.player;
  const R = HEROES.joren.range * stats().reach;
  if (!nearest(s, p.x, p.y, 1, R).length) return false;
  const duel = rank(s, 'duelist');
  const ways = duel >= 4 ? 8 : duel >= 1 ? 6 : 4;
  const turn = ((p.shots++ % 2) * Math.PI) / ways;
  const half = (Math.PI / ways) * 0.75;
  const color = bladeColor(s);
  near(s, p.x, p.y, R, (e) => {
    const a = Math.atan2(e.y - p.y, e.x - p.x) - turn;
    const off = Math.abs(angleDiff(a, Math.round(a / ((Math.PI * 2) / ways)) * ((Math.PI * 2) / ways)));
    if (off > half && Math.hypot(e.x - p.x, e.y - p.y) > e.r + p.r + 6) return;
    hit(s, e, HEROES.joren.damage);
    knock(e, p.x, p.y, 90);
  });
  for (let i = 0; i < ways; i++) slashFx(s, p.x, p.y, R, turn + (i * Math.PI * 2) / ways, half * 0.6, color, 150);
  return true;
}

/** Sable: a wide sweep in front, all the way round every third swing; Awakening 3 adds a push wave. */
function sweep(s: GameState) {
  const p = s.player;
  const R = HEROES.sable.range * stats().reach;
  const t = nearest(s, p.x, p.y, 1, R)[0];
  if (!t) return false;
  const a = Math.atan2(t.y - p.y, t.x - p.x);
  p.aim = a;
  p.shots += 1;
  const sc = rank(s, 'scrapper');
  const half = sc >= 5 || p.shots % 3 === 0 ? Math.PI : 1.2;
  const color = bladeColor(s);
  cut(s, p.x, p.y, R, a, half, HEROES.sable.damage, sc >= 4 ? 160 : 80);
  slashFx(s, p.x, p.y, R, a, half, color);
  if (rank(s, 'awakening') >= 3 && p.shots % 4 === 0) {
    cut(s, p.x, p.y, R * 1.8, a, 0.6, HEROES.sable.damage * 0.8, 220);
    slashFx(s, p.x, p.y, R * 1.8, a, 0.6, '#8fd0ff', 280);
  }
  return true;
}

/** Krull: a slow, heavy cleave in front that throws foes back (wider on Warlord 4). */
function cleave(s: GameState) {
  const p = s.player;
  const R = HEROES.krull.range * stats().reach * (rank(s, 'warlord') >= 4 ? 1.3 : 1);
  const t = nearest(s, p.x, p.y, 1, R)[0];
  if (!t) return false;
  const a = Math.atan2(t.y - p.y, t.x - p.x);
  const half = rank(s, 'warlord') >= 4 ? 1.2 : 0.8;
  p.aim = a;
  cut(s, p.x, p.y, R, a, half, HEROES.krull.damage, 220);
  slashFx(s, p.x, p.y, R, a, half, bladeColor(s), 280);
  return true;
}

/** Ysolde: curses the nearest foe not cursed yet (or the nearest); a curse hurts it a while. */
function hexAttack(s: GameState) {
  const p = s.player;
  const R = HEROES.ysolde.range * stats().reach;
  const pool = nearest(s, p.x, p.y, 6, R);
  const t = pool.find((e) => !(e.hexMs! > 0)) ?? pool[0];
  if (!t) return false;
  p.aim = Math.atan2(t.y - p.y, t.x - p.x);
  curse(s, t);
  // Withering: every foe close to it is cursed too.
  if (cap(s, 'withering')) near(s, t.x, t.y, 120, (e) => curse(s, e));
  zapFx(s, [p.x, p.y, t.x, t.y], bladeColor(s), 200);
  return true;
}

/** Puts Ysolde's curse on a foe (5 s on Blood Rites 2, else 3 s). */
function curse(s: GameState, e: Enemy) {
  if (e.hp <= 0 || e.charmMs > 0 || isStructure(e.kind)) return;
  e.hexMs = Math.max(e.hexMs ?? 0, rank(s, 'blood-rites') >= 2 ? CURSE.longMs : CURSE.ms);
}

/** Ysolde's curse, Sable's Pull and Krull's Shield Wall. */
export const CURSE = { ms: 3000, longMs: 5000, tickMs: 500, spread: 2, wideSpread: 3, riseMax: 8 };
export const PULL = { r: 260, wideR: 340, dmg: 30, bigDmg: 60, stunMs: 800, heal: 4, every: 6000 };
export const WALL = { ms: 4000, longMs: 6000, heal: 25, dmg: 20, bigDmg: 40, every: 10_000 };

/** Sable's Pull: draws the foes near in to her and stuns them (a boss is only slowed). */
function pull(s: GameState) {
  const p = s.player;
  const aw = rank(s, 'awakening');
  const pool = nearest(s, p.x, p.y, 12, aw >= 1 ? PULL.wideR : PULL.r);
  if (!pool.length) return false;
  const color = bladeColor(s);
  for (const e of pool) {
    zapFx(s, [p.x, p.y, e.x, e.y], color, 220);
    if (e.kind === 'boss') {
      e.slowPct = Math.max(e.slowPct, 0.5);
      e.slowMs = Math.max(e.slowMs, 2000);
    } else if (!isStructure(e.kind)) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      const keep = Math.max(e.r + p.r + 14, d * 0.35);
      e.x = p.x + ((e.x - p.x) / Math.max(1, d)) * keep;
      e.y = p.y + ((e.y - p.y) / Math.max(1, d)) * keep;
      e.stunMs = Math.max(e.stunMs, PULL.stunMs);
    }
    hit(s, e, aw >= 2 ? PULL.bigDmg : PULL.dmg);
  }
  if (aw >= 5) heal(s, PULL.heal * pool.length);
  slashFx(s, p.x, p.y, 70, 0, Math.PI, color, 320);
  return true;
}

/** Ysolde raises the dead to fight for her a while. */
function raise(s: GameState, n: number, x: number, y: number) {
  const coven = rank(s, 'coven');
  for (let i = 0; i < n; i++) {
    const a = (i / Math.max(1, n)) * Math.PI * 2 + s.time / 1000;
    s.allies.push({ id: s.nextId++, kind: 'puppet', x: x + Math.cos(a) * 30, y: y + Math.sin(a) * 30, cdMs: 300, lifeMs: coven >= 2 ? 15000 : 10000, slot: i, aim: a });
  }
}

/** The blades orbiting the hero: Kresh's staff (and the second one, and the outer ring) and Spinning Guard. */
export function orbitBlades(s: GameState) {
  const p = s.player;
  const out: { x1: number; y1: number; x2: number; y2: number; color: string; dmg: number }[] = [];
  const t = s.time / 1000;
  const color = bladeColor(s);
  if (s.hero === 'kresh') {
    const der = rank(s, 'dervish');
    const R = HEROES.kresh.range * stats().reach * (der >= 1 ? 1.25 : 1) * (der >= 5 ? 1.15 : 1);
    const w = 4.2 * (der >= 5 ? 1.7 : der >= 2 ? 1.4 : 1);
    const dmg = HEROES.kresh.damage * (der >= 3 ? 1.4 : 1);
    const staff = (a: number, r0: number, r1: number) => {
      for (const h of [a, a + Math.PI]) {
        out.push({ x1: p.x + Math.cos(h) * r0, y1: p.y + Math.sin(h) * r0, x2: p.x + Math.cos(h) * r1, y2: p.y + Math.sin(h) * r1, color, dmg });
      }
    };
    staff(t * w, 8, R);
    if (cap(s, 'violet-tornado')) staff(-t * w + Math.PI / 2, 8, R);
    if (cross(s, 'double-ring')) staff(t * w * 0.8 + Math.PI / 4, R * 1.2, R * 1.7);
  }
  const guard = rank(s, 'spinning-guard');
  if (guard > 0) {
    const n = at([1, 1, 2, 2, 3], guard, 1);
    for (let i = 0; i < n; i++) {
      const a = t * 3 + (i * Math.PI * 2) / n;
      out.push({ x1: p.x + Math.cos(a) * 58, y1: p.y + Math.sin(a) * 58, x2: p.x + Math.cos(a) * 88, y2: p.y + Math.sin(a) * 88, color, dmg: at([8, 10, 10, 13, 16], guard, 8) });
    }
  }
  return out;
}

/** Each orbiting blade cuts the foes it passes, each at most every 350 ms. */
function orbitHits(s: GameState) {
  const p = s.player;
  for (const b of orbitBlades(s)) {
    for (const k of [0.35, 0.7, 1]) {
      near(s, b.x1 + (b.x2 - b.x1) * k, b.y1 + (b.y2 - b.y1) * k, 12, (e) => {
        if (e.orbitMs > 0) return;
        e.orbitMs = 350;
        hit(s, e, b.dmg);
        knock(e, p.x, p.y, 90);
      });
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Signature moves

/** The knight's signature move; false (and no cooldown spent) when there is nothing to use it on. */
export function knightSignature(s: GameState) {
  const p = s.player;
  const color = bladeColor(s);
  if (s.hero === 'kael') {
    // Leap Strike: onto the strongest foe, then a slash all round where he lands.
    const t = strongest(s, 450);
    if (!t) return false;
    const d = Math.hypot(t.x - p.x, t.y - p.y);
    p.dashHit = [];
    dash(s, 'leap', Math.atan2(t.y - p.y, t.x - p.x), Math.min(600, (d / 900) * 1000 + 60), 900, 0, t);
    return true;
  }
  if (s.hero === 'vharn') {
    const ig = rank(s, 'iron-grip');
    const n = ig >= 3 ? 12 : ig >= 1 ? 8 : 5;
    if (!grip(s, n, 45 * (ig >= 2 ? 1.5 : 1) * (ig >= 5 ? 2 : 1))) return false;
    slashFx(s, p.x, p.y, 120, 0, Math.PI, color, 400);
    return true;
  }
  if (s.hero === 'oom') {
    // Somersault: a spinning leap the way he walks (at the nearest foe when standing).
    const ww = rank(s, 'whirlwind');
    const t = nearest(s, p.x, p.y, 1, 300)[0];
    const a = p.moving || !t ? p.facing : Math.atan2(t.y - p.y, t.x - p.x);
    p.dashHit = [];
    p.chain = at([3, 3, 6, 6, 10], ww, 0);
    dash(s, 'blade', a, 300, 800, 35 * (ww >= 2 ? 1.4 : 1));
    return true;
  }
  if (s.hero === 'corvin') {
    const bul = rank(s, 'bulwark');
    p.sigActiveMs = bul >= 4 ? 6000 : bul >= 1 ? 4500 : 3000;
    return true;
  }
  if (s.hero === 'veyl') {
    p.sigActiveMs = cap(s, 'eternal-regent') ? 5000 : 3000;
    return true;
  }
  if (s.hero === 'kresh') {
    // Hunt: mark the strongest foe and dash in.
    const t = strongest(s, 480);
    if (!t) return false;
    s.mark = t.id;
    p.dashHit = [];
    p.chain = at([1, 1, 2, 2, 4], rank(s, 'stalker'), 0);
    huntDash(s, t, 75);
    return true;
  }
  if (s.hero === 'sable') return pull(s);
  if (s.hero === 'krull') {
    const sw = rank(s, 'shield-wall');
    p.sigActiveMs = sw >= 1 ? WALL.longMs : WALL.ms;
    if (sw >= 2) heal(s, WALL.heal);
    slashFx(s, p.x, p.y, p.r + 26, 0, Math.PI, color, 400);
    return true;
  }
  if (s.hero === 'ysolde') {
    raise(s, cap(s, 'night-mother') ? 10 : rank(s, 'coven') >= 1 ? 6 : 4, p.x, p.y);
    slashFx(s, p.x, p.y, 80, 0, Math.PI, color, 400);
    return true;
  }
  // Joren's Breaking Point: one huge strike that stuns the strongest foe (every elite near with Shattering Blow).
  const t = strongest(s, 480);
  if (!t) return false;
  const dmg = 160 * (rank(s, 'breaker') >= 3 ? 2 : 1);
  const targets = [t];
  if (cap(s, 'shattering-blow')) for (const e of s.enemies) if (e.elite && e !== t && e.hp > 0 && Math.hypot(e.x - p.x, e.y - p.y) < 480) targets.push(e);
  for (const e of targets) {
    hit(s, e, dmg);
    e.stunMs = Math.max(e.stunMs, 2500);
    zapFx(s, [p.x, p.y, e.x, e.y], color, 260);
    slashFx(s, e.x, e.y, e.r + 22, 0, Math.PI, color, 400);
  }
  return true;
}

function huntDash(s: GameState, t: Enemy, dmg: number) {
  const p = s.player;
  const d = Math.hypot(t.x - p.x, t.y - p.y);
  dash(s, 'hunt', Math.atan2(t.y - p.y, t.x - p.x), Math.min(700, (d / 1000) * 1000 + 80), 1000, dmg, t);
}

/** A blade dash cuts each foe it passes once. */
export function dashSweep(s: GameState) {
  const p = s.player;
  if (p.dashKind !== 'blade') return;
  near(s, p.x, p.y, p.r + 16, (e) => {
    if (p.dashHit.includes(e.id)) return;
    p.dashHit.push(e.id);
    hit(s, e, p.dashDmg);
    knock(e, p.x, p.y, 200);
  });
}

/** Where a dash lands: Leap Strike's slash, the Hunt's strike, and the hops of a chained dash. */
export function dashEnd(s: GameState) {
  const p = s.player;
  const color = bladeColor(s);
  const R = stats().reach;
  if (p.dashKind === 'leap') {
    cut(s, p.x, p.y, 95 * R, 0, Math.PI, 50, 260);
    slashFx(s, p.x, p.y, 95 * R, 0, Math.PI, color, 320);
  } else if (p.dashKind === 'hunt') {
    const t = s.enemies.find((e) => e.id === p.dashTarget && e.hp > 0);
    if (t && Math.hypot(t.x - p.x, t.y - p.y) < t.r + p.r + 30) {
      p.dashHit.push(t.id);
      hit(s, t, p.dashDmg);
      slashFx(s, t.x, t.y, t.r + 16, 0, Math.PI, color, 300);
    }
    cut(s, p.x, p.y, 55, 0, Math.PI, 20, 200);
    if (p.chain > 0) {
      const next = strongest(s, 350, p.dashHit);
      if (next) {
        p.chain -= 1;
        s.mark = next.id;
        huntDash(s, next, rank(s, 'stalker') >= 5 ? 75 : 25);
      }
    }
  } else if (p.dashKind === 'blade' && s.hero === 'oom' && p.chain > 0) {
    // Whirlwind: the Somersault bounces on to the next foe.
    const next = nearest(s, p.x, p.y, 1, 260, p.dashHit)[0];
    if (next) {
      p.chain -= 1;
      const d = Math.hypot(next.x - p.x, next.y - p.y);
      dash(s, 'blade', Math.atan2(next.y - p.y, next.x - p.x), (d / 800) * 1000 + 60, 800, p.dashDmg, next);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Paths and pools, each step

/** The barrier a knight's plates or ward give, and how long after a hit it regrows (ms). */
function barrierOf(s: GameState) {
  if (s.hero === 'vharn') {
    const ls = rank(s, 'life-support');
    return { max: at([20, 35, 35, 50, 50], ls, 0), regrow: ls >= 4 ? 4000 : 6000 };
  }
  if (s.hero === 'joren') return { max: at([0, 15, 15, 30, 30], rank(s, 'council-seat'), 0), regrow: 6000 };
  return { max: 0, regrow: 0 };
}

/** The radius of Vharn's Dread aura (0 without it). */
export function dreadRadius(s: GameState) {
  return s.hero === 'vharn' ? at([110, 140, 140, 140, 180], rank(s, 'dread'), 0) : 0;
}

export function knightAbilities(s: GameState, ms: number) {
  const p = s.player;
  const color = bladeColor(s);
  p.formMs = Math.max(0, p.formMs - ms);
  p.hasteMs = Math.max(0, p.hasteMs - ms);
  p.streakMs += ms;
  if (p.streakMs > 3000) p.streak = 0;
  p.charge = p.moving ? 0 : p.charge + ms;
  const bar = barrierOf(s);
  if (bar.max > 0) {
    p.barrierMs += ms;
    if (p.barrierMs >= bar.regrow) p.barrier = bar.max;
  } else p.barrier = 0;

  if (s.hero === 'kael') {
    const prodigy = rank(s, 'prodigy');
    if (prodigy >= 4 && ready(s, 'kael-throw', prodigy >= 5 ? 2000 : 3000, ms)) {
      const t = nearest(s, p.x, p.y, 1, 320)[0];
      if (t) throwBlade(s, p.x, p.y, Math.atan2(t.y - p.y, t.x - p.x), 18, 280);
    }
    const ace = rank(s, 'ace-pilot');
    if (ace > 0 && ready(s, 'strafe', ace >= 4 ? 5000 : 8000, ms)) {
      // A starfighter flies in over the thickest swarm and strafes it.
      const spot = swarmSpot(s, 360);
      const a = Math.atan2(spot.y - p.y, spot.x - p.x) + Math.PI / 2;
      s.allies.push({ id: s.nextId++, kind: 'fighter', x: spot.x - Math.cos(a) * 460, y: spot.y - Math.sin(a) * 460, cdMs: 0, lifeMs: 1500, slot: 0, aim: a });
    }
  } else if (s.hero === 'vharn') {
    const R = dreadRadius(s);
    if (R > 0) {
      const dread = rank(s, 'dread');
      const slow = at([0.2, 0.3, 0.3, 0.3, 0.4], dread, 0);
      near(s, p.x, p.y, R, (e) => {
        e.slowPct = Math.max(e.slowPct, slow);
        e.slowMs = Math.max(e.slowMs, 250);
        if (dread >= 3 && !e.elite && e.kind !== 'boss' && e.hp < e.maxHp * 0.5) e.fleeMs = 1200;
      });
      if (cap(s, 'terror') && ready(s, 'terror', 4000, ms)) {
        near(s, p.x, p.y, R, (e) => {
          if (e.kind !== 'boss') e.stunMs = Math.max(e.stunMs, 1000);
        });
        slashFx(s, p.x, p.y, R, 0, Math.PI, color, 400);
      }
    }
    if (cap(s, 'crushing-will') && ready(s, 'crush', 4000, ms)) {
      const ig = rank(s, 'iron-grip');
      grip(s, ig >= 3 ? 12 : 8, 45 * 1.5 * (ig >= 5 ? 2 : 1));
    }
  } else if (s.hero === 'oom') {
    const still = rank(s, 'stillness');
    if (still >= 3 && p.stillMs >= 2000 && ready(s, 'wreck', 3000, ms)) {
      const spot = swarmSpot(s, 320);
      addBomb(s, 'wreck', spot.x, spot.y, 700, still >= 5 ? 95 : 70, still >= 5 ? 120 : 60, { fromX: p.x, fromY: p.y });
    }
    if (cap(s, 'lift-the-ship') && ready(s, 'ship', 12000, ms)) {
      const spot = swarmSpot(s, 400);
      addBomb(s, 'ship', spot.x, spot.y, 1400, 190, 240);
    }
    if (cap(s, 'golden-cyclone') && p.moving && ready(s, 'cyclone', 300, ms)) {
      cut(s, p.x, p.y, 90, 0, Math.PI, 9, 80);
      slashFx(s, p.x, p.y, 90, s.time / 80, Math.PI, color, 260);
    }
  } else if (s.hero === 'corvin') {
    const van = rank(s, 'vantage');
    if (van > 0) {
      const r = van >= 4 ? 60 : 46;
      if (cap(s, 'unassailable')) s.platform = { x: p.x, y: p.y, r };
      else if (s.platform && !onPlatform(s)) s.platform = null;
      else if (!s.platform && p.stillMs >= (van >= 4 ? 500 : 1000)) s.platform = { x: p.x, y: p.y, r };
      const pl = s.platform;
      if (pl && van >= 5 && ready(s, 'rim', 600, ms)) {
        near(s, pl.x, pl.y, pl.r + 16, (e) => {
          hit(s, e, 10);
          knock(e, pl.x, pl.y, 260);
        });
      }
    } else s.platform = null;
    if (cap(s, 'silver-tongue') && ready(s, 'silver', 10000, ms)) {
      const weak = s.enemies
        .filter((e) => e.hp > 0 && e.kind !== 'boss' && e.charmMs <= 0 && Math.hypot(e.x - p.x, e.y - p.y) < 480)
        .sort((a, b) => a.hp - b.hp)
        .slice(0, 8);
      for (const e of weak) e.charmMs = 12000;
      if (weak.length) pop(s, tr('silverTongueName'), color);
    }
  } else if (s.hero === 'veyl') {
    if (p.sigActiveMs > 0 && ready(s, 'overload', 160, ms)) {
      // Overload: lightning in every direction.
      const pool = nearest(s, p.x, p.y, 14, 320);
      for (let i = 0; i < 4 && pool.length; i++) {
        const t = pool.splice(Math.floor(rand() * pool.length), 1)[0];
        hit(s, t, 14);
        zapFx(s, [p.x, p.y, t.x, t.y], color, 140);
      }
    }
    if (cap(s, 'tempest') && ready(s, 'tempest', 1000, ms)) {
      const pool = nearest(s, p.x, p.y, 30, 460);
      for (let i = 0; i < 6 && pool.length; i++) {
        const t = pool.splice(Math.floor(rand() * pool.length), 1)[0];
        hit(s, t, 30);
        zapFx(s, [t.x + 30, t.y - 260, t.x - 10, t.y - 120, t.x, t.y], color, 220);
      }
    }
  } else if (s.hero === 'kresh') {
    const der = rank(s, 'dervish');
    if (der >= 4 && ready(s, 'staff', der >= 5 ? 2500 : 4000, ms)) {
      const t = nearest(s, p.x, p.y, 1, 300)[0];
      if (t) throwBlade(s, p.x, p.y, Math.atan2(t.y - p.y, t.x - p.x), 22, 280);
    }
    const reb = rank(s, 'rebuilt');
    if (p.rises > 0 && reb >= 3 && ready(s, 'kick', 2000, ms)) {
      cut(s, p.x, p.y, 70, 0, Math.PI, 18 * (reb >= 5 ? 2 : 1), 220);
      slashFx(s, p.x, p.y, 70, 0, Math.PI, '#c9ccd6', 220);
    }
    if (s.mark && !s.enemies.some((e) => e.id === s.mark && e.hp > 0)) s.mark = 0;
  } else if (s.hero === 'sable') {
    if (cap(s, 'first-light') && ready(s, 'first-light', PULL.every, ms)) {
      if (!pull(s)) s.cd['first-light'] = 300;
    }
  } else if (s.hero === 'krull') {
    if (p.sigActiveMs > 0 && ready(s, 'wall', 300, ms)) {
      // The Shield Wall throws back and hurts whatever touches him.
      near(s, p.x, p.y, p.r + 26, (e) => {
        hit(s, e, rank(s, 'shield-wall') >= 4 ? WALL.bigDmg : WALL.dmg);
        knock(e, p.x, p.y, rank(s, 'shield-wall') >= 4 ? 320 : 220);
      });
    }
    if (cap(s, 'fortress') && p.sigActiveMs <= 0 && ready(s, 'fortress', WALL.every, ms)) {
      if (nearest(s, p.x, p.y, 1, 150).length) p.sigActiveMs = WALL.ms;
      else s.cd.fortress = 300;
    }
  } else if (s.hero === 'ysolde') {
    // The curse: every tick, each cursed foe takes harm (and is slowed on Blood Rites 5).
    const br = rank(s, 'blood-rites');
    s.cd.hexTick = (s.cd.hexTick ?? CURSE.tickMs) - ms;
    const tick = s.cd.hexTick <= 0;
    if (tick) s.cd.hexTick += CURSE.tickMs;
    for (const e of s.enemies) {
      if (!(e.hexMs! > 0) || e.hp <= 0) continue;
      e.hexMs! -= ms;
      if (br >= 5) {
        e.slowPct = Math.max(e.slowPct, 0.3);
        e.slowMs = Math.max(e.slowMs, 200);
      }
      if (tick) hit(s, e, HEROES.ysolde.damage * (br >= 1 ? 1.3 : 1));
    }
  } else if (s.hero === 'joren') {
    const duel = rank(s, 'duelist');
    if (duel >= 2 && ready(s, 'lunge', duel >= 5 ? 1500 : 3000, ms)) {
      const t = nearest(s, p.x, p.y, 1, 200)[0];
      if (t && p.dashMs <= 0) {
        const d = Math.hypot(t.x - p.x, t.y - p.y);
        p.dashHit = [];
        p.chain = 0;
        dash(s, 'blade', Math.atan2(t.y - p.y, t.x - p.x), (d / 900) * 1000 + 40, 900, 20);
      }
    }
    if (cap(s, 'master-of-the-order') && ready(s, 'order', 8000, ms)) {
      const taken = s.bullets.filter((b) => b.hostile && Math.hypot(b.x - p.x, b.y - p.y) < 560);
      if (taken.length) {
        s.bullets = s.bullets.filter((b) => !taken.includes(b));
        const spot = swarmSpot(s, 400);
        explode(s, spot.x, spot.y, 120, 30 + 12 * taken.length, color);
        zapFx(s, [p.x, p.y, spot.x, spot.y], color, 260);
      }
    }
  }

  // The Blade pool.
  const bt = rank(s, 'blade-throw');
  if (bt > 0 && ready(s, 'blade-throw', bt >= 4 ? 2000 : 3000, ms)) {
    for (const t of nearest(s, p.x, p.y, at([1, 1, 2, 2, 3], bt, 1), 320)) {
      throwBlade(s, p.x, p.y, Math.atan2(t.y - p.y, t.x - p.x), at([16, 21, 21, 21, 24], bt, 16), 280);
    }
  }
  const bd = rank(s, 'blade-dash');
  if (bd > 0) {
    if ((s.cd['blade-dash'] ?? 0) > 0) s.cd['blade-dash'] -= ms;
    else if (p.moving && p.dashMs <= 0) {
      p.dashHit = [];
      p.chain = 0;
      dash(s, 'blade', p.facing, 250, 800, at([25, 30, 40, 45, 60], bd, 25));
      s.cd['blade-dash'] = at([5000, 4500, 4000, 3500, 2500], bd, 5000) * stats().cooldown;
    }
  }
  if (s.hero !== 'kresh' && rank(s, 'spinning-guard') > 0) orbitHits(s);
  // The Current pool.
  const pw = rank(s, 'push-wave');
  if (pw > 0 && ready(s, 'push-wave', at([5000, 4500, 4000, 3500, 3000], pw, 5000), ms)) {
    const R = at([110, 120, 130, 140, 160], pw, 110) * stats().reach;
    const lift = cross(s, 'lifting-wave');
    if (!nearest(s, p.x, p.y, 1, R).length) s.cd['push-wave'] = 300;
    else {
      cut(s, p.x, p.y, R, 0, Math.PI, at([12, 15, 18, 22, 28], pw, 12), lift ? 760 : 380, (e) => {
        if (lift && e.kind !== 'boss') e.stunMs = Math.max(e.stunMs, 1000);
      });
      slashFx(s, p.x, p.y, R, 0, Math.PI, '#8fd0ff', 360);
    }
  }
  // The Hollow pool.
  const la = rank(s, 'lightning-arc');
  if (la > 0 && ready(s, 'lightning-arc', at([2500, 2200, 1900, 1600, 1300], la, 2500), ms)) {
    const t = nearest(s, p.x, p.y, 1, 260)[0];
    if (t) lightning(s, p.x, p.y, t, at([3, 4, 4, 5, 6], la, 3), at([14, 16, 20, 22, 26], la, 14), color);
    else s.cd['lightning-arc'] = 300;
  }
  const gr = rank(s, 'grip');
  if (gr > 0 && ready(s, 'grip', at([7000, 6500, 6000, 5500, 4500], gr, 7000), ms)) {
    if (!grip(s, at([2, 3, 3, 4, 5], gr, 2), at([25, 30, 40, 45, 60], gr, 25))) s.cd.grip = 300;
  }
}

// ---------------------------------------------------------------------------------------------
// Hooks from the sim

/** A foe falls: Temper, kill streaks, Drain, Dark Bargain, puppets and the Stalker's speed. */
export function onKill(s: GameState, e: Enemy) {
  const p = s.player;
  if (s.hero === 'kael') {
    p.temper = Math.min(100, p.temper + 3 * (rank(s, 'the-fall') >= 1 ? 1.5 : 1));
    p.streak += 1;
    p.streakMs = 0;
    if (cap(s, 'perfect-form') && p.streak >= 12) {
      p.streak = 0;
      p.formMs = 10_000;
      pop(s, tr('perfectFormName'), bladeColor(s));
    }
  }
  const drain = at([0.3, 0.45, 0.6, 0.8, 1], rank(s, 'drain'), 0) + (s.hero === 'veyl' ? at([0, 0.5, 0.5, 1, 1], rank(s, 'dark-bargain'), 0) : 0);
  if (drain > 0) heal(s, drain);
  if (s.hero === 'veyl' && e.kind !== 'boss') {
    const pm = rank(s, 'puppet-master');
    const court = cap(s, 'court-of-puppets');
    if (pm > 0 && (s.kills % at([6, 6, 4, 4, 3], pm, 6) === 0 || (court && e.elite))) {
      const max = court ? 20 : at([3, 5, 8, 8, 12], pm, 3);
      if (s.allies.filter((a) => a.kind === 'puppet').length < max) {
        s.allies.push({ id: s.nextId++, kind: 'puppet', x: e.x, y: e.y, cdMs: 300, lifeMs: pm >= 4 ? 20000 : 15000, slot: 0, aim: 0, elite: e.elite });
      }
    }
  }
  if (s.hero === 'kresh') {
    if (rank(s, 'stalker') >= 2) p.hasteMs = 2000;
    if (e.id === s.mark) s.mark = 0;
  }
  if (s.hero === 'sable' && e.kind !== 'boss' && rank(s, 'scrapper') >= 2 && rand() < 0.05) {
    s.pickups.push({ id: s.nextId++, kind: 'credits', x: e.x, y: e.y, heal: 0, value: 1 });
  }
  if (s.hero === 'krull' && e.elite) {
    if (rank(s, 'warlord') >= 2) heal(s, 20);
    if (rank(s, 'warlord') >= 5) gainXp(s, 15, true);
  }
  if (s.hero === 'ysolde' && e.hexMs! > 0 && e.kind !== 'boss') {
    // A cursed foe passes its curse on as it falls, and rises again on Coven 3.
    for (const o of nearest(s, e.x, e.y, rank(s, 'blood-rites') >= 3 ? CURSE.wideSpread : CURSE.spread, 150, [e.id])) {
      curse(s, o);
      zapFx(s, [e.x, e.y, o.x, o.y], bladeColor(s), 160);
    }
    if (rank(s, 'coven') >= 3 && s.allies.filter((a) => a.kind === 'puppet').length < CURSE.riseMax) raise(s, 1, e.x, e.y);
    e.hexMs = 0;
  }
}

/** The hero heals: The Fall halves it at full Temper, and healing drains Kael's Temper. */
export function healFactor(s: GameState) {
  return fullTemper(s) && rank(s, 'the-fall') >= 2 ? 0.5 : 1;
}

export function onHealed(s: GameState, gained: number) {
  if (s.hero === 'kael' && rank(s, 'the-fall') < 3) s.player.temper = Math.max(0, s.player.temper - gained);
}

/** The hero took a hit: Riposte and the Duelist's counter strike back. */
export function onHurt(s: GameState) {
  const p = s.player;
  const rip = rank(s, 'riposte');
  if (rip > 0) {
    const R = at([80, 85, 90, 100, 120], rip, 80) * stats().reach;
    cut(s, p.x, p.y, R, 0, Math.PI, at([30, 40, 55, 70, 100], rip, 30), 260);
    slashFx(s, p.x, p.y, R, 0, Math.PI, bladeColor(s), 260);
  }
  if (s.hero === 'joren' && rank(s, 'duelist') >= 3) {
    cut(s, p.x, p.y, 70, 0, Math.PI, 25, 200);
    slashFx(s, p.x, p.y, 70, 0, Math.PI, bladeColor(s), 220);
  }
  // Mist Veil 4: a hit on Ysolde curses the foes around her.
  if (s.hero === 'ysolde' && rank(s, 'mist-veil') >= 4) near(s, p.x, p.y, 100, (e) => curse(s, e));
}

/** A killing blow: Rebuilt, Unbreakable or the Eternal Regent can keep the hero up. */
export function rescue(s: GameState) {
  const p = s.player;
  if (s.hero === 'kresh' && rank(s, 'rebuilt') > 0 && p.rises < (cap(s, 'steel-strider') ? 2 : 1)) {
    p.rises += 1;
    p.hp = p.maxHp * at([0.5, 0.5, 0.5, 0.75, 1], rank(s, 'rebuilt'), 0.5);
    p.hurtMs = 2000;
    pop(s, tr('rebuiltPop'), '#c9ccd6');
    return true;
  }
  if (s.hero === 'vharn' && cap(s, 'unbreakable') && !p.saved) {
    p.saved = true;
    p.hp = 1;
    p.hurtMs = 3000;
    pop(s, tr('unbreakableName'), bladeColor(s));
    return true;
  }
  if (s.hero === 'veyl' && cap(s, 'eternal-regent') && p.sigActiveMs > 0) {
    p.hp = 1;
    return true;
  }
  return false;
}

/**
 * A foe bolt reaching a knight. Corvin's Deflect (or Perfect Guard while walking) sends it back;
 * the Council Seat turns some back. Returns the bolt's fate: 'fly' (it was turned) or null.
 */
export function knightGuard(s: GameState, dist: number, reflect: (dmg: number, color: HeroId) => void, heading: () => number) {
  const p = s.player;
  if (s.hero === 'corvin' && dist < p.r + 34 && (p.sigActiveMs > 0 || (cap(s, 'perfect-guard') && p.moving))) {
    const bul = rank(s, 'bulwark');
    const dmg = 30 * (bul >= 2 ? 2 : 1);
    reflect(dmg, 'corvin');
    const a = heading();
    if (bul >= 3) for (const off of [-0.3, 0.3]) bolt(s, p.x, p.y, a + off, dmg, { speed: 450, life: 1500, pierce: 0, bounces: 0, color: 'corvin', r: 5 });
    if (cross(s, 'returning-steel')) throwBlade(s, p.x, p.y, a, 24, 260);
    return true;
  }
  const council = s.hero === 'joren' ? rank(s, 'council-seat') : 0;
  if (council > 0 && dist < p.r + 8 && rand() < at([0.15, 0.15, 0.3, 0.3, 0.5], council, 0)) {
    reflect(25 * (council >= 5 ? 2 : 1), 'joren');
    if (cross(s, 'royal-lightning')) {
      const t = nearest(s, p.x, p.y, 1, 260)[0];
      if (t) lightning(s, p.x, p.y, t, 3, 18, bladeColor(s));
    }
    return true;
  }
  return false;
}

/** Kael's starfighters, his co-pilot, Oom's spirits and Veyl's puppets, each step. */
export function moveKnightAlly(s: GameState, a: Ally, ms: number, count: number) {
  const p = s.player;
  const dt = ms / 1000;
  const color = bladeColor(s);
  const ace = rank(s, 'ace-pilot');
  a.cdMs -= ms;
  if (a.kind === 'fighter') {
    // A strafing run: straight across the swarm, firing down at whatever is under it.
    a.lifeMs -= ms;
    a.x += Math.cos(a.aim) * 620 * dt;
    a.y += Math.sin(a.aim) * 620 * dt;
    if (a.cdMs <= 0) {
      a.cdMs = 110;
      const t = nearest(s, a.x, a.y, 1, 200)[0];
      if (t) {
        const ang = Math.atan2(t.y - a.y, t.x - a.x);
        const dmg = 9 * (ace >= 2 ? 1.4 : 1);
        bolt(s, a.x, a.y, ang, dmg, { pierce: 0, bounces: 0, color: 'kael', speed: 700, life: 450 });
        if (ace >= 5) bolt(s, a.x, a.y, ang + 0.08, dmg, { pierce: 0, bounces: 0, color: 'kael', speed: 700, life: 450 });
      }
    }
    return;
  }
  if (a.kind === 'squadron') {
    const ang = s.time / 700 + (a.slot * Math.PI * 2) / Math.max(1, count);
    a.x = p.x + Math.cos(ang) * 120;
    a.y = p.y + Math.sin(ang) * 120;
    a.aim = ang + Math.PI / 2;
    if (a.cdMs <= 0) {
      a.cdMs = 400;
      const t = nearest(s, a.x, a.y, 1, 260)[0];
      if (t) bolt(s, a.x, a.y, Math.atan2(t.y - a.y, t.x - a.x), 12, { pierce: 0, bounces: 0, color: 'kael', speed: 700, life: 600 });
    }
    return;
  }
  if (a.kind === 'copilot') {
    a.x += (p.x - 26 - a.x) * Math.min(1, 8 * dt);
    a.y += (p.y - 34 - a.y) * Math.min(1, 8 * dt);
    if (a.cdMs <= 0) {
      a.cdMs = ace >= 5 ? 4000 : 5000;
      if (p.hp < p.maxHp) heal(s, ace >= 5 ? 8 : 4);
    }
    return;
  }
  if (a.kind === 'spirit') {
    // Spirit pupils hover round Oom and strike what comes near; the Council's masters each in their own way.
    const ang = s.time / 1300 + (a.slot * Math.PI * 2) / Math.max(1, count);
    a.x += (p.x + Math.cos(ang) * 58 - a.x) * Math.min(1, 6 * dt);
    a.y += (p.y + Math.sin(ang) * 58 - a.y) * Math.min(1, 6 * dt);
    if (a.cdMs > 0) return;
    const old = rank(s, 'old-teacher');
    const council = cap(s, 'council-of-spirits');
    const t = nearest(s, a.x, a.y, 1, council ? 200 : 150)[0];
    if (!t) {
      a.cdMs = 0;
      return;
    }
    a.cdMs = old >= 4 ? 650 : 900;
    const dmg = 12 * (old >= 2 ? 1.4 : 1) * (council ? 2 : 1);
    const ta = Math.atan2(t.y - a.y, t.x - a.x);
    a.aim = ta;
    const style = council ? a.slot % 4 : 0;
    if (style === 0) {
      cut(s, a.x, a.y, 60, ta, 1, dmg, 80);
      slashFx(s, a.x, a.y, 60, ta, 1, color, 180);
    } else if (style === 1) {
      cut(s, a.x, a.y, 80, 0, Math.PI, dmg, 180);
      slashFx(s, a.x, a.y, 80, 0, Math.PI, color, 220);
    } else if (style === 2) throwBlade(s, a.x, a.y, ta, dmg, 220);
    else lightning(s, a.x, a.y, t, 3, dmg, color);
    return;
  }
  if (a.kind === 'guard') {
    // Krull's Hollow guards: stand in a ring round him and cut whatever comes close.
    const ang = (a.slot * Math.PI * 2) / Math.max(1, count) + s.time / 3000;
    a.x += (p.x + Math.cos(ang) * 52 - a.x) * Math.min(1, 6 * dt);
    a.y += (p.y + Math.sin(ang) * 52 - a.y) * Math.min(1, 6 * dt);
    if (a.cdMs > 0) return;
    const t = nearest(s, a.x, a.y, 1, 60)[0];
    if (!t) {
      a.cdMs = 0;
      return;
    }
    const il = rank(s, 'iron-legion');
    a.cdMs = 700;
    a.aim = Math.atan2(t.y - a.y, t.x - a.x);
    cut(s, a.x, a.y, 60, a.aim, 1, 14 * (il >= 2 ? 1.5 : 1), il >= 4 ? 240 : 120);
    slashFx(s, a.x, a.y, 60, a.aim, 1, color, 180);
    return;
  }
  // A puppet: walks at the nearest foe and claws it; Loyal Dead heals Veyl with each hit.
  a.lifeMs -= ms;
  const t = nearest(s, a.x, a.y, 1, 320)[0];
  const tx = t ? t.x : p.x + Math.cos(a.slot) * 60;
  const ty = t ? t.y : p.y + Math.sin(a.slot) * 60;
  const d = Math.hypot(tx - a.x, ty - a.y);
  a.aim = Math.atan2(ty - a.y, tx - a.x);
  if (d > (t ? t.r + 8 : 20)) {
    const step = Math.min(d, 150 * dt);
    a.x += ((tx - a.x) / d) * step;
    a.y += ((ty - a.y) / d) * step;
  } else if (t && a.cdMs <= 0) {
    a.cdMs = 600;
    damage(s, t, 8 * (rank(s, 'puppet-master') >= 2 ? 1.4 : 1) * (a.elite ? 3 : 1) * (s.hero === 'ysolde' && rank(s, 'coven') >= 4 ? 2 : 1));
    if (cross(s, 'loyal-dead')) heal(s, 0.25);
  }
}

/** How many of each knight's lasting allies the upgrades call for. */
export function knightAllies(s: GameState) {
  return {
    spirit: cap(s, 'council-of-spirits') ? 4 : at([1, 1, 2, 2, 3], rank(s, 'old-teacher'), 0),
    copilot: rank(s, 'ace-pilot') >= 3 ? 1 : 0,
    squadron: cap(s, 'squadron-run') ? 3 : 0,
    guard: s.hero !== 'krull' ? 0 : cap(s, 'grand-army') ? 5 : at([1, 1, 2, 2, 3], rank(s, 'iron-legion'), 0),
  };
}

/** Extra damage a knight deals to this foe: Breaker against elites and bosses, the Dread aura, Apex Predator's marks. */
export function foeMod(s: GameState, e: Enemy) {
  let k = 1;
  const big = e.elite || e.kind === 'boss';
  if (s.hero === 'joren' && big) k *= 1 + at([0.1, 0.25, 0.25, 0.4, 0.4], rank(s, 'breaker'), 0);
  else if (s.hero === 'vharn' && rank(s, 'dread') >= 4 && Math.hypot(e.x - s.player.x, e.y - s.player.y) < dreadRadius(s)) k *= 1.15;
  else if (s.hero === 'kresh' && big && cap(s, 'apex-predator')) k *= 1.5;
  else if (s.hero === 'krull' && big && rank(s, 'warlord') >= 1) k *= 1.2;
  return k;
}

/** Foes in the Terror aura deal half damage. */
export function contactMod(s: GameState, e: Enemy) {
  if (!cap(s, 'terror')) return 1;
  return Math.hypot(e.x - s.player.x, e.y - s.player.y) < dreadRadius(s) ? 0.5 : 1;
}

/** The deeds that unlock heroes, done this run, into `state.deeds` (each once). */
export function checkDeeds(s: GameState) {
  // The game pauses on each new hero to show it (see GameScene).
  const done = (id: HeroId, ok: boolean) => {
    if (!ok || s.known.includes(id) || s.deeds.includes(id)) return;
    s.deeds.push(id);
  };
  // The soldiers' chain: TR-9's Drop Squad unlocks Bram-17, Bram-17's Brothers in Arms unlocks Rook.
  done('bram', s.hero === 'tr9' && rank(s, 'drop-doctrine') >= 5);
  done('rook', s.hero === 'bram' && rank(s, 'brothers') >= 5);
  done('kael', s.stage >= 1);
  done('oom', s.cleanSwamp);
  done('corvin', s.arenaWins > 0);
  done('veyl', s.stage >= 2);
  done('kresh', s.elitesKilled >= 10);
  done('joren', s.stage >= 3);
  done('vharn', s.hero === 'kael' && rank(s, 'the-fall') >= 5);
  done('elara', s.credits >= DEEDS.credits);
  done('triad', s.kills >= DEEDS.kills);
  done('dax', s.chests >= DEEDS.chests);
  done('grunda', s.hero === 'dax' && rank(s, 'smugglers-run') >= 5);
  done('kettle', s.powerUps >= DEEDS.powerUps);
  done('cassia', s.objectivesDone >= DEEDS.objectives);
  done('vesk', s.elitesKilled >= DEEDS.elites);
  done('rena', s.hero === 'kael' && rank(s, 'ace-pilot') >= 5);
  done('thessa', s.arenaWins >= DEEDS.arenas);
  done('wikka', s.level >= DEEDS.level);
  done('gorbul', s.credits >= DEEDS.fortune);
  done('sable', s.stage >= 3 && !isKnight(s.hero!));
  done('krull', s.hero === 'vharn' && rank(s, 'iron-grip') >= 5);
  done('ysolde', s.hero === 'veyl' && rank(s, 'puppet-master') >= 5);
}

/**
 * Elara Voss's deed (credits held at once), Triad-77's (foes defeated in one run), Dax Morrow's
 * (chests opened), Kettle's (power-ups taken), Cassia Vane's (side objectives done), Vesk Drayl's
 * (elites defeated), Admiral Thessa Orn's (arenas won), Chief Wikka's (the level reached), Boss
 * Gorbul's (credits held at once) and Sable Rhee's (the Lava world reached without a blade), all in one run.
 */
export const DEEDS = { credits: 100, kills: 2500, chests: 6, powerUps: 8, objectives: 6, elites: 25, arenas: 2, level: 25, fortune: 250 };
