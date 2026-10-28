/**
 * The last two blaster heroes: Commander Elara Voss (a pistol on the nearest foe, a signal flag
 * that calls in a bombardment, and four cards a level-up) and Triad-77 (three battle bots
 * moving as one unit, each shooting the foe nearest to it). Their weapons, signatures and paths. `sim.ts`
 * calls in here only for these two, so every other hero's run replays exactly as before. Pure
 * state changes, randomness from `rand`, like the rest of the rules.
 */
import { t as tr } from '../i18n';
import { HEROES } from './heroes';
import { at } from './upgrades';
import { botCount, botMax, type Ally, type Bullet, type Bot, type Enemy, type GameState } from './state';
import { HURT_GRACE_MS, addBomb, bolt, damage, explode, heal, knock, near, nearest, pop, ready, stats, swarmSpot, volley } from './sim';
import { rand } from './weekly';

const rank = (s: GameState, id: string) => s.ranks[id] ?? 0;
const cap = (s: GameState, id: string) => s.capstones.includes(id);
const cross = (s: GameState, id: string) => s.crossovers.includes(id);

/** Elara Voss's numbers: the bombardment, the flag and its bubble, the bike and the medic. */
export const AID = { flagMs: 6000, longFlagMs: 9000, shells: 12, spread: 160, shellR: 60, shellDmg: 24, every: 380 };
export const BUBBLE = { r: 110, cut: 0.25, confuseR: 140, confuseMs: 2000, every: 3000 };
const BIKE = { speed: 560, lifeMs: 1100, r: 22 };
/** Triad-77's numbers: a fallen bot's rebuild time, how far its bots stand apart, scrap per shield bot. */
export const TRIAD = { rebuildMs: 10_000, gap: 20, colGap: 15, scrap: 40, spareMs: 12_000, spares: 6 };

// ---------------------------------------------------------------------------------------------
// Starting and Triad-77's bots

/** A run starts: Triad-77 builds its bots. */
export function squadStart(s: GameState) {
  if (s.hero === 'triad') syncSquad(s);
}

/**
 * Brings Triad-77's bots in line with the upgrades (more bots on the Firing Line, more health
 * with armour) and its health with theirs: its health is the sum of its bots'.
 */
export function syncSquad(s: GameState) {
  if (s.hero !== 'triad') return;
  const p = s.player;
  const max = botMax(s);
  const n = botCount(s);
  while (s.bots.length < n) s.bots.push({ hp: max, max, rebuildMs: 0, x: p.x, y: p.y, aim: 0 });
  if (s.bots.length > n) s.bots.length = n;
  for (const d of s.bots) {
    if (d.max !== max) {
      if (d.hp > 0) d.hp = Math.max(1, Math.min(max, d.hp + max - d.max));
      d.max = max;
    }
  }
  p.maxHp = max * n;
  p.hp = s.bots.reduce((sum, d) => sum + d.hp, 0);
}

const alive = (s: GameState) => s.bots.filter((d) => d.hp > 0);

/** Where each bot stands: a wide ring round the unit (Spread) or one behind another (Column). */
export function botSpots(s: GameState) {
  const p = s.player;
  const n = s.bots.length;
  return s.bots.map((_, i) => {
    if (s.formation === 'column') {
      const off = ((n - 1) / 2 - i) * TRIAD.colGap;
      return { x: p.x + Math.cos(p.aim) * off, y: p.y + Math.sin(p.aim) * off, dir: p.aim };
    }
    const dir = p.facing + (i * Math.PI * 2) / n;
    const r = n <= 3 ? TRIAD.gap : n <= 5 ? TRIAD.gap + 5 : TRIAD.gap + 12;
    return { x: p.x + Math.cos(dir) * r, y: p.y + Math.sin(dir) * r, dir };
  });
}

/** How long a fallen bot takes to be rebuilt, ms. */
export const rebuildTime = (s: GameState) => at([7000, 7000, 5000, 5000, 3500], rank(s, 'factory'), TRIAD.rebuildMs);

/** A hit on Triad-77: the bot nearest where it came from takes it (all of them share it with Uplink). */
function hurtBots(s: GameState, taken: number, x?: number, y?: number) {
  const up = alive(s);
  if (!up.length) return;
  const fall = (d: Bot) => {
    if (d.hp > 0) return;
    d.hp = 0;
    d.rebuildMs = rebuildTime(s);
  };
  if (rank(s, 'uplink') >= 3) {
    for (const d of up) {
      d.hp -= taken / up.length;
      fall(d);
    }
  } else {
    let hit = up[0];
    if (x !== undefined && y !== undefined) {
      let best = Infinity;
      for (const d of up) {
        const dist = Math.hypot(d.x - x, d.y - y);
        if (dist < best) {
          best = dist;
          hit = d;
        }
      }
    }
    hit.hp -= taken;
    fall(hit);
  }
  s.player.hp = s.bots.reduce((sum, d) => sum + Math.max(0, d.hp), 0);
}

// ---------------------------------------------------------------------------------------------
// Hooks from the sim

/**
 * Damage taken, after armour. Returns whether this module dealt with it (Triad-77's bots take
 * it; the run ends only when every bot is down). For Elara Voss the bubble takes some off and
 * the sim does the rest.
 */
export function squadHurt(s: GameState, taken: number, x?: number, y?: number) {
  if (s.hero !== 'triad') return false;
  hurtBots(s, taken, x, y);
  s.damageTaken += taken;
  s.player.hurtMs = HURT_GRACE_MS;
  if (!alive(s).length) {
    s.player.hp = 0;
    s.phase = 'lost';
  }
  return true;
}

/** How much of a hit gets through: inside Elara's shield bubble, less. */
export function hurtFactor(s: GameState) {
  const b = bubble(s);
  return b && Math.hypot(s.player.x - b.x, s.player.y - b.y) <= b.r ? 1 - BUBBLE.cut : 1;
}

/** Healing for Triad-77: to the most worn bots first (a fallen one waits to be rebuilt). */
export function squadHeal(s: GameState, amount: number) {
  if (s.hero !== 'triad') return false;
  let left = amount;
  const up = alive(s).sort((a, b) => a.hp / a.max - b.hp / b.max);
  for (const d of up) {
    if (left <= 0) break;
    const add = Math.min(left, d.max - d.hp);
    d.hp += add;
    left -= add;
  }
  s.player.hp = s.bots.reduce((sum, d) => sum + d.hp, 0);
  return true;
}

/** Elara's Sharpshooter: hits on worn foes are critical (every hit with Never Miss), never on a boss. 1 for none. */
export function squadCrit(s: GameState, e: Enemy) {
  if (s.hero !== 'elara') return 1;
  const sh = rank(s, 'sharpshooter');
  // A boss is too big to find a weak spot in.
  if (sh <= 0 || e.kind === 'boss') return 1;
  const mult = 2;
  if (cap(s, 'never-miss')) return mult;
  return e.hp < e.maxHp * (sh >= 4 ? 0.5 : 0.3) ? mult : 1;
}

/** Foes confused by the Diplomat hit their own half as hard as Persuasion's turned foes (as hard at tier 5). */
export const turnedBonus = (s: GameState) => (s.hero !== 'elara' ? 1 : rank(s, 'diplomat') >= 5 ? 1 : 0.5);

/** A foe falls: Never Miss fires on, Triad-77 gathers scrap and, with Endless Ranks, spare bots. */
export function squadKill(s: GameState, e: Enemy) {
  const p = s.player;
  if (s.hero === 'elara' && cap(s, 'never-miss') && e.kind !== 'boss') {
    const t = nearest(s, p.x, p.y, 1, HEROES.elara.range, [e.id])[0];
    if (t) bolt(s, p.x, p.y, Math.atan2(t.y - p.y, t.x - p.x), HEROES.elara.damage);
  }
  if (s.hero !== 'triad' || e.kind === 'boss') return;
  if (cap(s, 'endless-ranks') && s.kills % 15 === 0) spare(s, e.x, e.y, 4);
  const fac = rank(s, 'factory');
  if (fac < 2) return;
  s.scrap += 1;
  const need = cap(s, 'assembly-line') ? 20 : fac >= 4 ? 30 : TRIAD.scrap;
  if (s.scrap < need) return;
  s.scrap -= need;
  const bots = s.allies.filter((a) => a.kind === 'shieldbot').length;
  if (bots < shieldbots(s)) {
    s.allies.push({ id: s.nextId++, kind: 'shieldbot', x: e.x, y: e.y, cdMs: 0, lifeMs: 0, slot: bots, aim: 0 });
    pop(s, tr('shieldbotPop'), HEROES.triad.schemes[0].accent);
  } else if (cap(s, 'assembly-line')) spare(s, e.x, e.y, TRIAD.spares);
}

/** A spare battle bot for a while, up to `max` of them. */
function spare(s: GameState, x: number, y: number, max: number) {
  const have = s.allies.filter((a) => a.kind === 'spare');
  if (have.length >= max) return;
  s.allies.push({ id: s.nextId++, kind: 'spare', x, y, cdMs: 200, lifeMs: TRIAD.spareMs, slot: have.length, aim: 0 });
}

const shieldbots = (s: GameState) => (cap(s, 'assembly-line') ? 3 : at([0, 1, 1, 2, 2], rank(s, 'factory'), 0));

/**
 * A foe bolt near Triad-77's rolling shield bots: caught (or sent back, with Assembly Line).
 * Returns null when no shield bot is in the way, else whether the bolt flies on.
 */
export function squadBlock(s: GameState, b: Bullet, reflect: () => boolean) {
  if (s.hero !== 'triad') return null;
  for (const a of s.allies) {
    if (a.kind !== 'shieldbot' || Math.hypot(b.x - a.x, b.y - a.y) > 16) continue;
    return cap(s, 'assembly-line') ? reflect() : false;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Weapons

/** The primary weapon of Elara Voss or Triad-77, called each step in place of the soldiers'. */
export function squadAttack(s: GameState, ms: number, rate: number) {
  const p = s.player;
  const hero = HEROES[s.hero!];
  p.fireMs -= ms * rate;
  if (p.fireMs > 0) return;
  if (s.hero === 'elara') {
    const twin = rank(s, 'sharpshooter') >= 3;
    // The nearest foe; the second pistol takes the next nearest.
    const targets = nearest(s, p.x, p.y, twin ? 2 : 1, hero.range);
    if (!targets.length) {
      p.fireMs = 0;
      return;
    }
    p.fireMs += hero.fireMs;
    p.shots += 1;
    targets.forEach((t, i) => {
      const gx = p.x + (i === 0 ? 10 : -10);
      const gy = p.y + 6;
      const a = Math.atan2(t.y - gy, t.x - gx);
      if (i === 0) p.aim = a;
      volley(s, gx, gy, a, hero.damage);
    });
    return;
  }
  triadVolley(s, hero.fireMs, hero.damage, hero.range);
}

/** Every standing bot fires at the foe nearest to it (Spread), or all at the unit's nearest (Column). */
function triadVolley(s: GameState, fireMs: number, dmg: number, range: number) {
  const p = s.player;
  const first = nearest(s, p.x, p.y, 1, range)[0];
  if (!first) {
    p.fireMs = 0;
    return;
  }
  p.fireMs += fireMs;
  p.shots += 1;
  p.aim = Math.atan2(first.y - p.y, first.x - p.x);
  const linked = rank(s, 'uplink') >= 2;
  const cone = cross(s, 'crossfire');
  const taken: number[] = [];
  s.bots.forEach((d, i) => {
    if (d.hp <= 0) return;
    let t: Enemy = first;
    if (s.formation === 'spread') {
      // Linked aim (Uplink): each bot takes the nearest foe no other bot has taken.
      t = nearest(s, d.x, d.y, 1, range, linked ? taken : [])[0] ?? first;
      taken.push(t.id);
    }
    const a = Math.atan2(t.y - d.y, t.x - d.x);
    d.aim = a;
    // Scatter Shot's side bolts come from the first bot only; with Crossfire from every one.
    if (i === 0 || cone) volley(s, d.x, d.y, a, dmg);
    else bolt(s, d.x, d.y, a + (rand() * 2 - 1) * HEROES.triad.jitter, dmg);
    if (rank(s, 'uplink') >= 5) bolt(s, d.x, d.y, a + 0.09, dmg * 0.6);
  });
}

// ---------------------------------------------------------------------------------------------
// Signatures

/** Call for Aid (Elara) or Formation Shift (Triad-77); the sim has set the cooldown. */
export function squadSignature(s: GameState) {
  const p = s.player;
  if (s.hero === 'elara') {
    const dip = rank(s, 'diplomat');
    const ms = dip >= 3 ? AID.longFlagMs : AID.flagMs;
    s.flag = { x: p.x, y: p.y, ms, maxMs: ms };
    p.sigActiveMs = 600;
    for (let i = 0; i < AID.shells; i++) {
      const a = rand() * Math.PI * 2;
      const d = 30 + rand() * AID.spread;
      addBomb(s, 'carpet', p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 500 + i * AID.every, AID.shellR, AID.shellDmg);
    }
    if (dip >= 2) confuse(s, p.x, p.y, cap(s, 'rallying-cry') ? 300 : BUBBLE.confuseR);
    return;
  }
  s.formation = s.formation === 'spread' ? 'column' : 'spread';
  pop(s, tr(s.formation === 'spread' ? 'formationSpread' : 'formationColumn'), HEROES.triad.schemes[0].accent);
  if (cap(s, 'hive-signal')) {
    for (const d of alive(s)) {
      for (let i = 0; i < 10; i++) bolt(s, d.x, d.y, (i / 10) * Math.PI * 2 + s.time / 700, HEROES.triad.damage * 1.5);
    }
  }
}

/** Foes near a point are confused for a while and fight each other (elites too at Diplomat 5; never a boss). */
function confuse(s: GameState, x: number, y: number, r: number) {
  const elites = rank(s, 'diplomat') >= 5;
  near(s, x, y, r, (e) => {
    if (e.kind === 'boss' || (e.elite && !elites)) return;
    e.charmMs = Math.max(e.charmMs, BUBBLE.confuseMs);
  });
}

/** Elara's shield bubble: at the flag while it stands (Diplomat), round her always with Rallying Cry. */
export function bubble(s: GameState) {
  if (s.hero !== 'elara') return null;
  if (cap(s, 'rallying-cry')) return { x: s.player.x, y: s.player.y, r: BUBBLE.r };
  if (rank(s, 'diplomat') >= 1 && s.flag) return { x: s.flag.x, y: s.flag.y, r: BUBBLE.r };
  return null;
}

// ---------------------------------------------------------------------------------------------
// Each step

export function squadAbilities(s: GameState, ms: number) {
  const p = s.player;
  if (s.hero === 'elara') {
    if (s.flag) {
      s.flag.ms -= ms;
      if (s.flag.ms <= 0) s.flag = null;
    }
    const dip = rank(s, 'diplomat');
    const b = bubble(s);
    // While the flag stands, foes coming near it are confused too.
    if (dip >= 2 && s.flag && ready(s, 'confuse', BUBBLE.every, ms)) confuse(s, s.flag.x, s.flag.y, BUBBLE.confuseR);
    if (dip >= 4 && b && Math.hypot(p.x - b.x, p.y - b.y) <= b.r && p.hp < p.maxHp) heal(s, (1.5 * ms) / 1000);
    const net = rank(s, 'rebel-network');
    if (net >= 3 && ready(s, 'bike', net >= 5 ? 4000 : 6000, ms)) {
      // The speeder bike comes in from behind Elara and runs straight through the thickest swarm.
      const spot = swarmSpot(s, 380);
      const a = Math.atan2(spot.y - p.y, spot.x - p.x);
      s.allies.push({ id: s.nextId++, kind: 'bike', x: p.x - Math.cos(a) * 60, y: p.y - Math.sin(a) * 60, cdMs: 0, lifeMs: BIKE.lifeMs, slot: 0, aim: a, hit: [] });
    }
    if (cap(s, 'the-uprising') && s.supplyWorld !== s.planet && !s.arena) {
      // A supply drop at the start of each world: a crate of health and a chest beside it.
      s.supplyWorld = s.planet;
      const x = p.x + 70;
      addBomb(s, 'crate', x, p.y, 1000, 80, 60, { heal: 30 });
      s.pickups.push({ id: s.nextId++, kind: 'chest', x: x + 26, y: p.y + 10, heal: 0, value: 0 });
      pop(s, tr('supplyDropPop'), '#ffd36b');
    }
    return;
  }
  // Triad-77: bots walk to their spots, fallen ones are rebuilt.
  syncSquad(s);
  const spots = botSpots(s);
  const k = Math.min(1, 14 * (ms / 1000));
  s.bots.forEach((d, i) => {
    d.x += (spots[i].x - d.x) * k;
    d.y += (spots[i].y - d.y) * k;
    if (d.hp > 0) return;
    d.rebuildMs -= ms;
    if (d.rebuildMs > 0) return;
    d.hp = rank(s, 'factory') >= 3 ? d.max : d.max * 0.5;
    pop(s, tr('botRebuilt'), HEROES.triad.schemes[0].accent);
    if (rank(s, 'factory') >= 5) explode(s, d.x, d.y, 90, 30, '#eef2ff');
  });
  p.hp = s.bots.reduce((sum, d) => sum + d.hp, 0);
}

/** How many of Elara's and Triad-77's lasting allies the upgrades call for. */
export function squadAllies(s: GameState) {
  const net = rank(s, 'rebel-network');
  const commando = cap(s, 'the-uprising') ? 8 : at([1, 2, 2, 2, 3], net, 0);
  return {
    commando,
    medic: net >= 4 ? 1 : 0,
    command: rank(s, 'uplink') >= 1 ? 1 : 0,
    // Eyes in the Sky: a drone over each commando.
    drone: cross(s, 'eyes-in-the-sky') ? commando : 0,
  };
}

/** Where a Covering Drone flies: over its commando with Eyes in the Sky (past the pool's own drones). */
export function droneSpot(s: GameState, a: Ally, own: number) {
  if (!cross(s, 'eyes-in-the-sky') || a.slot < own) return null;
  const c = s.allies.find((o) => o.kind === 'commando' && o.slot === a.slot - own);
  return c ? { x: c.x + Math.cos(s.time / 300 + a.slot) * 10, y: c.y - 30 } : null;
}

/** Commandos, the bike, the medic, shield bots, the command bot and spare bots, each step. */
export function moveSquadAlly(s: GameState, a: Ally, ms: number, count: number) {
  const p = s.player;
  const dt = ms / 1000;
  a.cdMs -= ms;
  if (a.kind === 'bike') {
    a.lifeMs -= ms;
    a.x += Math.cos(a.aim) * BIKE.speed * dt;
    a.y += Math.sin(a.aim) * BIKE.speed * dt;
    const dmg = rank(s, 'rebel-network') >= 5 ? 45 : 30;
    near(s, a.x, a.y, BIKE.r, (e) => {
      if (a.hit!.includes(e.id)) return;
      a.hit!.push(e.id);
      damage(s, e, dmg);
      knock(e, a.x, a.y, 260);
    });
    return;
  }
  if (a.kind === 'medic') {
    a.x += (p.x + 28 - a.x) * Math.min(1, 8 * dt);
    a.y += (p.y + 30 - a.y) * Math.min(1, 8 * dt);
    a.aim = p.facing;
    if (a.cdMs <= 0) {
      a.cdMs = 5000;
      if (p.hp < p.maxHp) {
        const n = cap(s, 'the-uprising') ? 10 : 6;
        heal(s, n);
        pop(s, tr('plusHealth', { n }), '#7dffa0');
      }
    }
    return;
  }
  if (a.kind === 'shieldbot') {
    // Rolls round the unit, bumping foes away (and hurting them at Factory 4).
    const ang = s.time / 650 + (a.slot * Math.PI * 2) / Math.max(1, count);
    a.x += (p.x + Math.cos(ang) * 50 - a.x) * Math.min(1, 10 * dt);
    a.y += (p.y + Math.sin(ang) * 50 - a.y) * Math.min(1, 10 * dt);
    a.aim = ang + Math.PI / 2;
    near(s, a.x, a.y, 14, (e) => {
      if (e.bashMs > 0) return;
      e.bashMs = 500;
      knock(e, a.x, a.y, 300);
      if (rank(s, 'factory') >= 4) damage(s, e, 15);
    });
    return;
  }
  if (a.kind === 'command') {
    a.x += (p.x - Math.cos(p.facing) * 40 - a.x) * Math.min(1, 6 * dt);
    a.y += (p.y - Math.sin(p.facing) * 40 - 14 - a.y) * Math.min(1, 6 * dt);
    if (rank(s, 'uplink') < 2 || a.cdMs > 0) return;
    const t = nearest(s, a.x, a.y, 1, 320)[0];
    if (!t) {
      a.cdMs = 0;
      return;
    }
    a.cdMs = 700;
    a.aim = Math.atan2(t.y - a.y, t.x - a.x);
    bolt(s, a.x, a.y, a.aim, 9, { pierce: 0, bounces: 0, color: 'triad' });
    return;
  }
  // A commando (in formation behind Elara, a ring of them with the Uprising) or a spare bot.
  if (a.kind === 'spare') a.lifeMs -= ms;
  const ring = count > 4 || a.kind === 'spare';
  const ang = ring ? (a.slot * Math.PI * 2) / Math.max(1, count) + (a.kind === 'spare' ? s.time / 1500 : 0) : p.facing + Math.PI + (a.slot - (count - 1) / 2) * 0.8;
  const dist = a.kind === 'spare' ? 64 : ring ? 58 : 46;
  a.x += (p.x + Math.cos(ang) * dist - a.x) * Math.min(1, 8 * dt);
  a.y += (p.y + Math.sin(ang) * dist - a.y) * Math.min(1, 8 * dt);
  if (a.cdMs > 0) return;
  const t = nearest(s, a.x, a.y, 1, 330)[0];
  if (!t) {
    a.cdMs = 0;
    return;
  }
  a.aim = Math.atan2(t.y - a.y, t.x - a.x);
  if (a.kind === 'spare') {
    a.cdMs = HEROES.triad.fireMs / stats().fireRate;
    bolt(s, a.x, a.y, a.aim, HEROES.triad.damage, { pierce: 0, bounces: 0, color: 'triad' });
    return;
  }
  const net = rank(s, 'rebel-network');
  a.cdMs = 900 * (net >= 2 ? 0.75 : 1);
  bolt(s, a.x, a.y, a.aim, 6, { pierce: 0, bounces: 0, color: 'elara' });
}
