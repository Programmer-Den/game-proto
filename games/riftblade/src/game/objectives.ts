/**
 * Side objectives: three a world, one after the other (a shared one, the world's own and the
 * hero's own, see `OBJECTIVE_AT`), each with a time limit and a reward of credits, a level or a
 * free upgrade card. Called from `sim.ts` once a step; none in the arena or once the boss is up.
 * Randomness only through `rand`, and only from a world's first objective on (1:00), so a
 * world's first minute plays exactly as it did before objectives came.
 */
import { t as tr, type TextKey } from '../i18n';
import { PLANETS } from './planets';
import {
  HERO_OBJECTIVES, OBJECTIVE_AT, SHARED_OBJECTIVES, WORLD_OBJECTIVES, isStructure,
  type GameState, type Objective, type ObjectiveId, type StructureKind,
} from './state';
import { addHazard, explode, gainXp, near, pop, spawnAt, spawnElite, spawnGroup } from './sim';
import { rand } from './weekly';

type Reward = { credits: number } | { level: true } | { card: true };

/** Each objective's numbers: time limit (ms), goal, zone radius and reward. */
export const OBJ: Record<ObjectiveId, { ms: number; goal: number; r: number; reward: Reward }> = {
  defend: { ms: 40_000, goal: 15_000, r: 90, reward: { card: true } },
  escort: { ms: 60_000, goal: 1, r: 0, reward: { credits: 30 } },
  beacons: { ms: 45_000, goal: 3, r: 0, reward: { level: true } },
  zone: { ms: 30_000, goal: 30_000, r: 380, reward: { credits: 25 } },
  cache: { ms: 50_000, goal: 1, r: 0, reward: { credits: 45 } },
  nests: { ms: 50_000, goal: 4, r: 0, reward: { card: true } },
  thaw: { ms: 60_000, goal: 3, r: 60, reward: { level: true } },
  seal: { ms: 50_000, goal: 3, r: 50, reward: { card: true } },
  quickdraw: { ms: 30_000, goal: 70, r: 0, reward: { credits: 30 } },
  dropzone: { ms: 35_000, goal: 8000, r: 90, reward: { card: true } },
  recon: { ms: 40_000, goal: 4, r: 34, reward: { credits: 30 } },
  duel: { ms: 40_000, goal: 1, r: 0, reward: { card: true } },
  unbroken: { ms: 40_000, goal: 60, r: 0, reward: { level: true } },
  lift: { ms: 40_000, goal: 4000, r: 60, reward: { credits: 25 } },
  pilgrim: { ms: 30_000, goal: 30_000, r: 0, reward: { card: true } },
  storm: { ms: 25_000, goal: 220, r: 0, reward: { level: true } },
  bloodtrail: { ms: 60_000, goal: 30, r: 0, reward: { card: true } },
  monolith: { ms: 35_000, goal: 1, r: 0, reward: { card: true } },
  signal: { ms: 45_000, goal: 1, r: 80, reward: { credits: 40 } },
  salvage: { ms: 45_000, goal: 3, r: 50, reward: { credits: 35 } },
};
/** Other numbers: foes pushing in on a held zone, the escort, the pilgrim, nests, vents, the zone's end size and the wreck. */
export const OBJ_MISC = {
  pushMs: 3500, dropPushMs: 2500, escortSpeed: 55, escortNear: 170, escortTrip: 900, wardHp: 120, pilgrimHp: 140, wardHurt: 0.8,
  nestMs: 4500, ventMs: 2500, zoneEnd: 170, zoneOutMs: 4000, standMs: { thaw: 1500, seal: 1500, recon: 0, salvage: 1200 } as Record<string, number>,
  wreckR: 240, wreckDmg: 140, thawedMs: 40_000,
};

/** The text keys of an objective: its name and its one-line hint. */
export const objectiveName = (id: ObjectiveId) => `obj_${id}` as TextKey;
export const objectiveHint = (id: ObjectiveId) => `obj_${id}_hint` as TextKey;

/** A point `d` px from the hero at angle `a`. */
function around(s: GameState, a: number, d: number) {
  return { x: s.player.x + Math.cos(a) * d, y: s.player.y + Math.sin(a) * d };
}

/** Puts a structure on the field. */
function build(s: GameState, kind: StructureKind, x: number, y: number) {
  const e = spawnAt(s, kind, x, y);
  e.speed = 0;
  e.aimX = x;
  e.aimY = y;
  return e;
}

/** Called each step of a fight: starts, runs and ends the objectives. */
export function objectives(s: GameState, ms: number) {
  if (s.arena) return;
  const o = s.objective;
  if (!o) {
    if (!s.bossSpawned && s.objectiveSlot < OBJECTIVE_AT.length && s.time >= s.objectiveAt) start(s);
    return;
  }
  o.ms -= ms;
  run(s, o, ms);
  if (s.objective !== o) return;
  if (o.done >= o.goal) finish(s, true);
  else if (o.ms <= 0) finish(s, o.id === 'zone' || o.id === 'pilgrim' || o.id === 'unbroken');
}

/** Which objective a world's slot brings: shared (one not seen this run, if any is left), the world's own, the hero's own. */
function pick(s: GameState): ObjectiveId {
  if (s.objectiveSlot === 1) return WORLD_OBJECTIVES[PLANETS[s.planet] ? s.planet : 0];
  if (s.objectiveSlot === 2) return HERO_OBJECTIVES[s.hero!];
  let pool = SHARED_OBJECTIVES.filter((id) => !s.sharedSeen.includes(id));
  if (!pool.length) {
    s.sharedSeen = [];
    pool = [...SHARED_OBJECTIVES];
  }
  const id = pool[Math.floor(rand() * pool.length)];
  s.sharedSeen.push(id);
  return id;
}

function start(s: GameState) {
  const id = pick(s);
  s.objectiveSlot += 1;
  s.objectiveAt = OBJECTIVE_AT[s.objectiveSlot] ?? Infinity;
  const spec = OBJ[id];
  const p = s.player;
  const a = rand() * Math.PI * 2;
  const o: Objective = {
    id, x: p.x, y: p.y, r: spec.r, ms: spec.ms, maxMs: spec.ms, done: 0, goal: spec.goal, base: 0, seen: 0,
    points: [], ward: null, toX: 0, toY: 0, tickMs: 0, ids: [],
  };
  const at = around(s, a, 260);
  switch (id) {
    case 'defend':
    case 'dropzone':
    case 'lift':
    case 'signal':
      Object.assign(o, at);
      if (id === 'signal') o.seen = s.signatures;
      break;
    case 'escort': {
      const w = around(s, a, 200);
      o.ward = { ...w, hp: OBJ_MISC.wardHp, maxHp: OBJ_MISC.wardHp };
      o.x = w.x;
      o.y = w.y;
      o.toX = w.x + Math.cos(a) * OBJ_MISC.escortTrip;
      o.toY = w.y + Math.sin(a) * OBJ_MISC.escortTrip;
      break;
    }
    case 'pilgrim': {
      const w = around(s, a, 220);
      o.ward = { ...w, hp: OBJ_MISC.pilgrimHp, maxHp: OBJ_MISC.pilgrimHp };
      Object.assign(o, w);
      break;
    }
    case 'zone':
      break;
    case 'beacons':
    case 'nests': {
      const n = spec.goal;
      for (let i = 0; i < n; i++) {
        const q = around(s, a + (i / n) * Math.PI * 2, 300 + rand() * 140);
        o.ids.push(build(s, id === 'beacons' ? 'beacon' : 'nest', q.x, q.y).id);
      }
      break;
    }
    case 'cache':
    case 'monolith': {
      const q = around(s, a, 380);
      o.ids.push(build(s, id === 'cache' ? 'cache' : 'monolith', q.x, q.y).id);
      Object.assign(o, q);
      // The scrap crawler's cache has a guard.
      if (id === 'cache') {
        const g = spawnAt(s, PLANETS[s.planet].elites[0], q.x + 50, q.y, true);
        g.x = q.x + 50;
      }
      break;
    }
    case 'duel': {
      const e = spawnElite(s, a);
      o.ids.push(e.id);
      break;
    }
    case 'thaw':
    case 'seal':
    case 'recon':
    case 'salvage': {
      const n = id === 'recon' ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const q = around(s, a + (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.6, (id === 'recon' ? 340 : 200) + rand() * 130);
        o.points.push({ ...q, ms: 0 });
      }
      break;
    }
    case 'quickdraw':
    case 'bloodtrail':
      o.base = s.kills;
      o.seen = s.damageTaken;
      break;
    case 'storm':
      o.base = s.hits;
      break;
    case 'unbroken':
      o.base = s.damageTaken;
      break;
  }
  s.objective = o;
  pop(s, tr('objNew', { name: tr(objectiveName(id)) }), '#7fe3ff');
}

const inside = (s: GameState, x: number, y: number, r: number) => Math.hypot(s.player.x - x, s.player.y - y) <= r;

function run(s: GameState, o: Objective, ms: number) {
  const dt = ms / 1000;
  const p = s.player;
  const t = s.time / 1000;
  switch (o.id) {
    case 'defend':
    case 'dropzone':
      if (inside(s, o.x, o.y, o.r)) {
        o.done += ms;
        // Foes push in on the held zone.
        o.tickMs -= ms;
        if (o.tickMs <= 0) {
          o.tickMs = o.id === 'dropzone' ? OBJ_MISC.dropPushMs : OBJ_MISC.pushMs;
          spawnGroup(s, t, 6);
        }
      }
      break;
    case 'lift':
      if (inside(s, o.x, o.y, o.r)) o.done += ms;
      break;
    case 'signal':
      if (s.signatures > o.seen) {
        if (inside(s, o.x, o.y, o.r)) o.done = 1;
        o.seen = s.signatures;
      }
      break;
    case 'escort': {
      const w = o.ward!;
      hurtWard(s, w, dt);
      const near = Math.hypot(p.x - w.x, p.y - w.y) <= OBJ_MISC.escortNear;
      const d = Math.hypot(o.toX - w.x, o.toY - w.y);
      if (near && d > 1) {
        const step = Math.min(d, OBJ_MISC.escortSpeed * dt);
        w.x += ((o.toX - w.x) / d) * step;
        w.y += ((o.toY - w.y) / d) * step;
      }
      o.x = w.x;
      o.y = w.y;
      if (d < 30) o.done = 1;
      if (w.hp <= 0) finish(s, false);
      break;
    }
    case 'pilgrim': {
      const w = o.ward!;
      hurtWard(s, w, dt);
      o.done += ms;
      if (w.hp <= 0) finish(s, false);
      break;
    }
    case 'zone': {
      o.done += ms;
      o.r = OBJ.zone.r + (OBJ_MISC.zoneEnd - OBJ.zone.r) * Math.min(1, o.done / o.goal);
      if (!inside(s, o.x, o.y, o.r)) {
        o.tickMs += ms;
        if (o.tickMs >= OBJ_MISC.zoneOutMs) finish(s, false);
      }
      break;
    }
    case 'beacons':
    case 'nests':
    case 'cache':
    case 'monolith':
    case 'duel': {
      const left = s.enemies.filter((e) => o.ids.includes(e.id) && e.hp > 0);
      o.done = o.goal - left.length;
      const target = left[0];
      if (target) {
        o.x = target.x;
        o.y = target.y;
      }
      // Living nests breed the planet's swarm (mire rats on the Swamp world).
      if (o.id === 'nests') {
        o.tickMs -= ms;
        if (o.tickMs <= 0) {
          o.tickMs = OBJ_MISC.nestMs;
          for (const n of left) for (let i = 0; i < 2; i++) spawnAt(s, PLANETS[s.planet].swarm, n.x + (rand() - 0.5) * 40, n.y + 24);
        }
      }
      break;
    }
    case 'thaw':
    case 'seal':
    case 'recon':
    case 'salvage': {
      const need = OBJ_MISC.standMs[o.id];
      const open = (q: { ms: number }) => (need === 0 ? q.ms <= 0 : q.ms <= need);
      for (const q of o.points) {
        if (!open(q) || !inside(s, q.x, q.y, o.r)) continue;
        q.ms += ms;
        if (open(q)) continue;
        o.done += 1;
        if (o.id === 'thaw') thawed(s, q.x, q.y);
      }
      // The marker stays on one spot until it is done, then moves to the nearest one left.
      let cur = o.points[o.base];
      if (!cur || !open(cur)) {
        let best = Infinity;
        o.points.forEach((q, i) => {
          const d = Math.hypot(p.x - q.x, p.y - q.y);
          if (open(q) && d < best) {
            best = d;
            o.base = i;
          }
        });
        cur = o.points[o.base];
      }
      if (cur) {
        o.x = cur.x;
        o.y = cur.y;
      }
      // Unsealed vents erupt now and then.
      if (o.id === 'seal') {
        o.tickMs -= ms;
        if (o.tickMs <= 0) {
          o.tickMs = OBJ_MISC.ventMs;
          const left = o.points.filter(open);
          const q = left[Math.floor(rand() * left.length)];
          if (q) addHazard(s, 'vent', q.x + (rand() - 0.5) * 120, q.y + (rand() - 0.5) * 120, 54, 1100, 450, 14);
        }
      }
      break;
    }
    case 'quickdraw':
      o.done = s.kills - o.base;
      break;
    case 'bloodtrail':
      // A hit starts the count again.
      if (s.damageTaken > o.seen) {
        o.seen = s.damageTaken;
        o.base = s.kills;
      }
      o.done = s.kills - o.base;
      break;
    case 'storm':
      o.done = s.hits - o.base;
      break;
    case 'unbroken':
      if (s.damageTaken - o.base > o.goal) finish(s, false);
      o.done = 0;
      break;
  }
}

/** Foes touching the escorted bot or the pilgrim wear it down. */
function hurtWard(s: GameState, w: { x: number; y: number; hp: number }, dt: number) {
  near(s, w.x, w.y, 14, (e) => {
    if (e.kind === 'boss' || isStructure(e.kind) || e.charmMs > 0) return;
    w.hp -= e.dmg * OBJ_MISC.wardHurt * dt;
  });
}

/** A frozen trooper thawed: it fights beside the hero for a while. */
function thawed(s: GameState, x: number, y: number) {
  const n = s.allies.filter((a) => a.kind === 'thawed').length;
  s.allies.push({ id: s.nextId++, kind: 'thawed', x, y, cdMs: 300, lifeMs: OBJ_MISC.thawedMs, slot: n, aim: 0 });
}

/** The objective ends, won or lost: the reward, and whatever it left on the field goes. */
export function finish(s: GameState, won: boolean) {
  const o = s.objective;
  if (!o) return;
  s.objective = null;
  for (const e of s.enemies) if (o.ids.includes(e.id) && isStructure(e.kind)) e.hp = 0;
  if (!won) {
    pop(s, tr('objFailed'), '#ff8a6a');
    return;
  }
  s.objectivesDone += 1;
  if (o.id === 'lift') explode(s, o.x, o.y, OBJ_MISC.wreckR, OBJ_MISC.wreckDmg * PLANETS[s.planet].hp, '#9fd8ff');
  const reward = OBJ[o.id].reward;
  if ('credits' in reward) {
    s.credits += reward.credits;
    pop(s, tr('objDoneCredits', { n: reward.credits }), '#ffd36b');
  } else if ('level' in reward) {
    pop(s, tr('objDoneLevel'), '#7fe3ff');
    gainXp(s, s.xpNext - s.xp, true);
  } else {
    pop(s, tr('objDoneCard'), '#ffe066');
    s.rewardPicks += 1;
  }
}

/** The boss comes: an objective under way is called off (no reward, no failure). */
export function cancelObjective(s: GameState) {
  const o = s.objective;
  if (!o) return;
  s.objective = null;
  for (const e of s.enemies) if (o.ids.includes(e.id) && isStructure(e.kind)) e.hp = 0;
}
