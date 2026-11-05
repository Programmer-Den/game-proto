import type { TextKey } from '../i18n';
import { ARMOURY_EACH, nextPrice, noArmoury, type Armoury, type ArmouryId } from './armoury';
import { BOONS, BOON_IDS, CURSE, forSale, type BoonId } from './boons';
import { MISSILES, bossOf, bossStands, moveBoss } from './boss';
import { CHALLENGES } from './challenges';
import { buildStage, nextStage, roadChoiceDue } from './course';
import { KNIGHTS, type KnightId } from './knights';
import { PAIRS, pairsOf } from './pairs';
import { nextPetPrice, noPets, type PetId, type PetLevels } from './pets';
import {
  AWAKE,
  BOON_PRICE,
  CLOUD,
  COIN_REACH,
  DARE,
  DROP_V,
  FOES,
  GRAVITY,
  GUST,
  ICE,
  ROCK,
  RUNNER,
  SHRINE,
  TRAP_SPAN,
  canTake,
  flameOf,
  floorAt,
  freshState,
  gustOf,
  metres,
  rand,
  seedOf,
  speedOf,
  stats,
  streakMax,
  streakMult,
  type DareKind,
  type GameState,
  type Mode,
  type Road,
  type Trap,
  type TrapKind,
  WIND,
} from './state';

// Moves the run on: the knight runs, jumps, slides and lands, climbs onto ledges and drops off
// them, goblins and bats move and can be stomped on, traps hurt, coins are picked up (worth more
// on a streak), wayside shrines trade coins for a heart, the stage's ground bends the rules (ice,
// fen, wind), a Gatekeeper is fought on every fifth stage and the dragon at the Dragon's Keep (for
// a lasting crown; the run then goes on harder), a rockfall chases the knight on every seventh
// stage, the herald's dare is kept or lost, boon pairs give their hidden bonuses, and each
// checkpoint stops the run on a choice of two boons (three after a met dare), sometimes a cursed
// one, and then, from stage 3, of the next road. Beyond the dragon the Sky Road's gusts carry the
// knight on and its clouds fall away once stood on, and the heavy knight smashes the foes he runs
// into. Between runs the bank buys the missed boon, the armoury's lasting upgrades or a knight.

/** A pulled coin's speed towards the knight. */
const PULL_SPEED = 700;
/** How far behind the knight traps, ledges and coins are dropped. */
const BEHIND = 600;
/** A stomp: how far below a foe's top the feet may have been last frame, and the bounce off it. */
const STOMP_REACH = 8;
const STOMP_BOUNCE = 0.65;
/** Feet this little below a ledge's top as the knight reaches it still climb up it unhurt. */
const STEP_UP = 16;
/** Falcon's Glide: the share of gravity that pulls on the knight while they fall. */
const GLIDE = 0.5;
/** Goblin's Hoard: coins a stomped foe bursts into besides the one it always drops. */
const HOARD = 2;
/** Bulwark: how far ahead of the knight a blocked hit knocks the foes away. */
const BULWARK_REACH = 220;

/** What a new run carries over from the runs before it. */
export interface Carry {
  /** The best distance this run chases: the overall best, or the daily course's. */
  best: number;
  bank: number;
  pending: BoonId | null;
  armoury: Armoury;
  /** The lasting crown from the Dragon's Keep. */
  crown: boolean;
  /** Who rides this run (a daily course always takes the knight), and the knights unlocked. */
  knight: KnightId;
  knights: KnightId[];
  /** The companion chosen to run along on ordinary runs, and each companion's level. */
  pet: PetId | null;
  pets: PetLevels;
}

/** A seeded run's kind (the daily course by default), the challenge course it runs, and the boons it starts with (the weekly road's). */
export interface RunKind {
  mode?: Mode;
  challenge?: number;
  boons?: BoonId[];
}

/**
 * A new run: an ordinary one, or a seeded one with the key given: the daily course of a date, the
 * weekly road (with its two boons) or a challenge course. A boon bought at the last game over
 * starts an ordinary run with one rank of that boon, and the armoury's levels and the companion
 * apply. A seeded run starts bare, so every player runs it alike; the bought boon waits for the
 * next ordinary run.
 */
export function newRun(
  { best, bank, pending, armoury, crown, knight, knights, pet, pets }: Carry = {
    best: 0,
    bank: 0,
    pending: null,
    armoury: noArmoury(),
    crown: false,
    knight: 'knight',
    knights: ['knight'],
    pet: null,
    pets: noPets(),
  },
  daily: string | null = null,
  kind: RunKind = {},
): GameState {
  const s = freshState(best, bank, armoury, daily, crown, daily ? 'knight' : knight, knights);
  s.mode = daily ? (kind.mode ?? 'daily') : 'run';
  s.pets = { ...pets };
  s.pet = daily || !pet || pets[pet] <= 0 ? null : pet;
  if (daily && kind.challenge !== undefined) {
    s.challenge = { index: kind.challenge, coins: 0, got: 0, done: false };
    s.stage = CHALLENGES[kind.challenge].stage;
  }
  if (daily) s.pending = pending;
  else if (pending) s.ranks[pending] = 1;
  for (const id of kind.boons ?? []) s.ranks[id] = 1;
  const st = stats(s);
  s.hearts = st.maxHearts;
  s.shields = st.shields;
  s.foxGuard = st.fox;
  s.purse = daily ? 0 : armoury.purse * ARMOURY_EACH.purse;
  s.coins = s.purse;
  buildStage(s);
  return s;
}

/** Height of the ground under the knight's feet. */
const floorOf = (s: GameState) => floorAt(s, s.distance - RUNNER.w / 2, s.distance + RUNNER.w / 2);
const grounded = (s: GameState) => s.runner.h <= floorOf(s) && s.runner.vh <= 0;

/** Jump: off the ground, or again in the air with Second Leap. A jump ends a slide. On ice, a jump during a landing's skid waits for it to end. */
export function jump(s: GameState) {
  if (s.phase !== 'running') return false;
  const r = s.runner;
  if (r.skidMs > 0 && grounded(s)) {
    r.jumpQueued = true;
    return true;
  }
  if (r.jumps <= 0) return false;
  r.jumps -= 1;
  r.vh = stats(s).jumpV;
  r.h = Math.max(r.h, floorOf(s) + 0.01);
  r.slideMs = 0;
  r.slideQueued = false;
  return true;
}

/** Slide under a blade; in the air, drop fast and slide on landing. */
export function slide(s: GameState) {
  if (s.phase !== 'running') return false;
  const r = s.runner;
  if (grounded(s)) {
    r.slideMs = stats(s).slideMs;
  } else {
    r.vh = Math.min(r.vh, -DROP_V);
    r.slideQueued = true;
  }
  return true;
}

/** The knight's box this moment: x along the course, and heights from feet to head. */
export function runnerBox(s: GameState) {
  const tall = s.runner.slideMs > 0 ? RUNNER.slideH : RUNNER.h;
  return { x0: s.distance - RUNNER.w / 2, x1: s.distance + RUNNER.w / 2, lo: s.runner.h, hi: s.runner.h + tall };
}

function touches(s: GameState, t: Trap) {
  const box = runnerBox(s);
  if (t.kind === 'pit') {
    // The knight falls in when standing on the road over the middle of the pit (not on a cloud over it).
    return grounded(s) && s.runner.h <= 0 && s.distance > t.x + 8 && s.distance < t.x + t.w - 8;
  }
  if (t.kind === 'flames' && flameOf(s, t) !== 'lit') return false;
  const span = TRAP_SPAN[t.kind];
  return box.x1 > t.x && box.x0 < t.x + t.w && box.hi > t.h + span.lo && box.lo < t.h + span.hi;
}

/** Walks goblins back and forth and flies bats on, once they are close enough to wake. */
function moveFoes(s: GameState, sec: number) {
  for (const t of s.traps) {
    if (t.vx === 0 || t.x - s.distance > AWAKE) continue;
    t.x += t.vx * sec;
    if (t.kind !== 'goblin') continue;
    if (t.from !== undefined && t.x <= t.from) {
      t.x = t.from;
      t.vx = Math.abs(t.vx);
    }
    if (t.to !== undefined && t.x + t.w >= t.to) {
      t.x = t.to - t.w;
      t.vx = -Math.abs(t.vx);
    }
  }
}

/** Landing on a goblin or bat from above knocks it out and bounces the knight back up. */
function stomp(s: GameState, prevH: number) {
  const r = s.runner;
  if (r.h >= prevH) return;
  const box = runnerBox(s);
  const foe = s.traps.find((t) => {
    if (!FOES.includes(t.kind) || box.x1 <= t.x || box.x0 >= t.x + t.w) return false;
    const top = t.h + TRAP_SPAN[t.kind as Exclude<TrapKind, 'pit'>].hi;
    return prevH >= top - STOMP_REACH && r.h <= top;
  });
  if (!foe) return;
  const st = stats(s);
  const top = knockOut(s, foe);
  r.h = Math.max(r.h, top);
  r.vh = st.jumpV * STOMP_BOUNCE;
  r.jumps = st.jumps;
  r.slideMs = 0;
  r.slideQueued = false;
}

/**
 * A goblin or bat knocked out, by a stomp or by the heavy knight running into it: it counts as a
 * stomp, drops a coin (more with Goblin's Hoard) and leaves a puff. Returns the height of its top.
 */
function knockOut(s: GameState, foe: Trap) {
  const top = foe.h + TRAP_SPAN[foe.kind as Exclude<TrapKind, 'pit'>].hi;
  s.traps = s.traps.filter((t) => t !== foe);
  s.stomps += 1;
  dared(s, 'stomp', 1);
  gainCoin(s, foe.x + foe.w / 2, top);
  effect(s, 'stomp', foe.x + foe.w / 2, top, 450);
  // Goblin's Hoard: the foe bursts into more coins, which fly to the knight.
  if (stats(s).hoard) for (let i = 0; i < HOARD; i++) s.course.push({ id: s.nextId++, x: foe.x + foe.w / 2 + (i ? 30 : -30), h: top + 30, pulled: true });
  return top;
}

/**
 * The Sky Road's clouds: one the knight has landed on holds for `CLOUD.sink` ms, then falls away
 * faster and faster, carrying the knight down with it if they are still on it. A cloud that has
 * fallen to the road is gone, leaving the gap under it open.
 */
function moveClouds(s: GameState, sec: number) {
  const r = s.runner;
  const box = { x0: s.distance - RUNNER.w / 2, x1: s.distance + RUNNER.w / 2 };
  for (const l of s.ledges) {
    if (!l.cloud || l.sinkMs === undefined) continue;
    if (l.sinkMs > 0) {
      l.sinkMs = Math.max(0, l.sinkMs - sec * 1000);
      continue;
    }
    const on = box.x1 > l.x && box.x0 < l.x + l.w && Math.abs(r.h - l.h) < 0.5 && r.vh <= 0;
    l.fallV = (l.fallV ?? 0) + CLOUD.fall * sec;
    l.h = Math.max(0, l.h - l.fallV * sec);
    if (on) r.h = Math.max(l.h, floorAt({ ledges: s.ledges.filter((o) => o !== l) }, box.x0, box.x1));
  }
  s.ledges = s.ledges.filter((l) => !l.cloud || l.h > 0);
}

function effect(s: GameState, kind: GameState['effects'][number]['kind'], x: number, h: number, total: number, text?: TextKey, n?: number) {
  s.effects.push({ id: s.nextId++, kind, x, h, ms: total, total, ...(text ? { text } : {}), ...(n !== undefined ? { n } : {}) });
}

/**
 * One coin taken (picked up, or knocked out of a stomped foe): worth its value times the streak's
 * multiplier, and one more on the streak. A coin worth more than one pops its value over the knight.
 */
function gainCoin(s: GameState, x: number, h: number) {
  const value = stats(s).coinValue * streakMult(s.streak, streakMax(s.road));
  s.streak += 1;
  s.coins += value;
  if (value > 1) effect(s, 'pop', x, h + 40, 700, 'coinPop', value);
  dared(s, 'coins', 1);
  dared(s, 'streak', streakMult(s.streak, streakMax(s.road)));
}

/**
 * Moves the stage's dare on: a stomp or a coin counts one more, a streak dare records the
 * multiplier reached. Met, it pays its reward at once (a no-hit dare is met at the checkpoint).
 */
function dared(s: GameState, kind: DareKind, n: number) {
  const d = s.dare;
  if (!d || d.kind !== kind || d.done || d.failed) return;
  d.progress = kind === 'streak' ? Math.max(d.progress, n) : d.progress + n;
  if (d.progress >= d.goal) meetDare(s);
}

function meetDare(s: GameState) {
  const d = s.dare;
  if (!d || d.done) return;
  d.done = true;
  s.coins += DARE.reward;
  effect(s, 'pop', s.distance + 420, RUNNER.h + 100, 1600, 'dareMetPop', DARE.reward);
}

/**
 * Sliding into a wayside shrine trades `SHRINE.price` coins for a heart, if the knight has the
 * coins and is hurt; otherwise it says why not, once.
 */
function visitShrines(s: GameState) {
  const r = s.runner;
  if (r.slideMs <= 0 || !grounded(s) || r.h > 0) return;
  const box = runnerBox(s);
  for (const sh of s.shrines) {
    if (sh.used || sh.tried || box.x1 <= sh.x || box.x0 >= sh.x + sh.w) continue;
    const max = stats(s).maxHearts;
    if (s.hearts < max && s.coins >= SHRINE.price) {
      s.coins -= SHRINE.price;
      s.hearts += 1;
      sh.used = true;
      effect(s, 'heal', sh.x + sh.w / 2, 60, 900);
    } else {
      sh.tried = true;
      if (s.hearts >= max) effect(s, 'refuse', sh.x + sh.w / 2, 90, 1100, 'heartsFull');
      else effect(s, 'refuse', sh.x + sh.w / 2, 90, 1100, 'needsCoins', SHRINE.price);
    }
  }
}

/** A hit from a trap, from running into the side of a ledge (`'wall'`), from running into a boss, or from the rockfall. */
function hurt(s: GameState, kind: TrapKind | 'wall' | 'boss' | 'rock') {
  const st = stats(s);
  const r = s.runner;
  if (kind === 'pit') {
    // Thrown back up out of the pit, high enough to clear it. A knight still unhurtable from the
    // last hit falls and is thrown out all the same, but loses nothing more.
    r.vh = st.jumpV;
    r.h = 0.01;
    r.slideMs = 0;
    r.jumps = st.jumps - 1;
    if (r.hurtMs > 0) {
      // A puff from the pit marks the fall, so the throw-out doesn't pass for a jump.
      effect(s, 'fall', s.distance, 0, 400);
      return;
    }
  }
  s.hits += 1;
  r.hurtMs = st.hurtMs;
  // A no-hit dare is lost to any hit, a blocked one included.
  if (s.dare?.kind === 'nohit' && !s.dare.done) s.dare.failed = true;
  // The fox leaps in and takes the hit, once a stage (twice at its last level); from its second
  // level the streak survives it.
  if (s.shields <= 0 && s.foxGuard > 0) {
    s.foxGuard -= 1;
    if (!st.foxStreak) s.streak = 0;
    effect(s, 'fox', s.distance - 50, 30, 600);
    return;
  }
  s.streak = 0;
  if (s.shields > 0) {
    s.shields -= 1;
    effect(s, 'block', s.distance, r.h + RUNNER.h / 2, 500);
    // Bulwark: the block knocks every foe and missile just ahead off the road.
    if (st.bulwark) {
      const gone = s.traps.filter((t) => (FOES.includes(t.kind) || MISSILES.includes(t.kind)) && t.x + t.w > s.distance - RUNNER.w && t.x < s.distance + BULWARK_REACH);
      for (const t of gone) effect(s, 'stomp', t.x + t.w / 2, t.h + TRAP_SPAN[t.kind as Exclude<TrapKind, 'pit'>].hi, 450);
      s.traps = s.traps.filter((t) => !gone.includes(t));
    }
    return;
  }
  s.hearts -= 1;
  effect(s, 'hit', s.distance, r.h + RUNNER.h / 2, 500);
  if (s.hearts <= 0) {
    s.hearts = 0;
    s.phase = 'over';
    // A challenge course keeps stars, not a best distance.
    if (!s.challenge) s.best = Math.max(s.best, metres(s.distance));
    // The Squire's Purse's coins are for the road, not the bank, so dying early can't farm them.
    // A challenge course banks nothing: it is run for its stars.
    if (!s.challenge) s.bank += Math.max(0, s.coins - s.purse);
  }
}

/** Moves the run on by `dt` milliseconds. Nothing moves at a checkpoint or after a fall. */
export function tick(s: GameState, dt: number) {
  for (const e of s.effects) e.ms -= dt;
  s.effects = s.effects.filter((e) => e.ms > 0);
  if (s.phase !== 'running') return;
  const sec = dt / 1000;
  const st = stats(s);
  const r = s.runner;
  s.time += dt;
  moveFoes(s, sec);
  // The hound barks at the traps coming up and marks them, once each.
  if (st.bark > 0) {
    let barked = false;
    for (const t of s.traps) {
      if (t.barked || t.x <= s.distance || t.x - s.distance > st.bark) continue;
      t.barked = true;
      barked = true;
    }
    if (barked) effect(s, 'bark', s.distance - 64, 40, 600);
  }
  // The checkpoint stays out of reach while the boss stands.
  if (s.boss && bossStands(s)) s.checkpointX = Math.max(s.checkpointX, Math.round(s.distance + bossOf(s.boss).holdBack));

  // In the windy pass a headwind slows the knight while they are off the ground; on the Sky Road a
  // gust at their back speeds them on.
  const gust = gustOf(s) === 'blow';
  const pace = (s.terrain === 'wind' && !grounded(s) ? WIND.air : 1) * (gust ? GUST.speed : 1);
  const from = s.distance;
  s.distance = Math.min(s.checkpointX, s.distance + s.speed * pace * sec);
  // The rockfall keeps the knight's pace and creeps up a little; hits and skids let it gain.
  const rock = s.rockfall;
  if (rock) rock.x += s.distance - from + ROCK.creep * sec;
  const hitsBefore = s.hits;
  moveBoss(s, dt);
  moveClouds(s, sec);
  // Running into the side of a ledge hurts, and the knight scrambles up onto it. A jump that only
  // just falls short climbs up unhurt.
  const floor = floorOf(s);
  if (r.h < floor) {
    if (r.hurtMs <= 0 && floor - r.h > STEP_UP) hurt(s, 'wall');
    r.h = floor;
    r.vh = Math.max(0, r.vh);
    // A fall ends the step: nothing is stomped or picked up after it.
    if (s.phase !== 'running') return;
  }
  const prevH = r.h;
  if (r.h > floor || r.vh > 0) {
    // Falcon's Glide: the knight falls at half the pull. A gust lets the knight float.
    r.vh -= GRAVITY * (r.vh < 0 && st.glide ? GLIDE : 1) * (gust ? GUST.lift : 1) * sec;
    r.h += r.vh * sec;
    if (r.h <= floor) {
      r.h = floor;
      r.vh = 0;
      effect(s, 'dust', s.distance, floor, 300);
      if (r.slideQueued) r.slideMs = st.slideMs;
      r.slideQueued = false;
      // On ice a landing skids: a jump has to wait it out.
      if (s.terrain === 'ice') {
        r.skidMs = ICE.skidMs;
        effect(s, 'skid', s.distance, floor, ICE.skidMs + 120);
        if (rock) rock.x += ROCK.skid;
      }
    }
  }
  // Landing on a cloud starts it sinking.
  if (r.vh <= 0) {
    for (const l of s.ledges) {
      if (l.cloud && l.sinkMs === undefined && Math.abs(r.h - l.h) < 0.5 && s.distance + RUNNER.w / 2 > l.x && s.distance - RUNNER.w / 2 < l.x + l.w) l.sinkMs = CLOUD.sink;
    }
  }
  stomp(s, prevH);
  bossContact(s, prevH);
  if (s.phase !== 'running') return;
  if (grounded(s)) r.jumps = st.jumps;
  r.slideMs = Math.max(0, r.slideMs - dt);
  r.hurtMs = Math.max(0, r.hurtMs - dt);
  if (r.skidMs > 0) {
    r.skidMs = Math.max(0, r.skidMs - dt);
    // The queued jump comes as the skid ends, in the air too (as the first jump, or Second Leap)
    // when the knight has walked off a ledge meanwhile.
    if (r.skidMs === 0 && r.jumpQueued) {
      r.jumpQueued = false;
      jump(s);
    }
  }

  // One trap hit a frame, and none while unhurtable, except a pit: a fall is not a contact hit,
  // so nothing holds the knight up over one.
  if (s.phase === 'running') {
    const hit = s.traps.find((t) => (t.kind === 'pit' || r.hurtMs <= 0) && touches(s, t));
    // The heavy knight smashes a goblin or bat he runs into.
    if (hit && st.smash && FOES.includes(hit.kind)) knockOut(s, hit);
    else if (hit) hurt(s, hit.kind);
    if (s.phase !== 'running') return;
  }
  if (rock && s.phase === 'running') {
    if (s.hits > hitsBefore) rock.x += ROCK.hit;
    // Caught: a heart lost, and the rocks fall back to where they started. A knight still
    // unhurtable from the last hit is only kept at their heels until they can be hurt.
    const back = s.distance - RUNNER.w / 2;
    if (rock.x >= back) {
      if (r.hurtMs <= 0) {
        hurt(s, 'rock');
        effect(s, 'stomp', back, 20, 500);
        rock.x = back - ROCK.start;
      } else rock.x = back;
    }
    if (s.phase !== 'running') return;
  }
  visitShrines(s);

  // Coins: picked up on touch, and drawn in from further off with a lodestone.
  const box = runnerBox(s);
  const midH = (box.lo + box.hi) / 2;
  for (const c of s.course) {
    const dx = Math.max(box.x0 - c.x, 0, c.x - box.x1);
    const dh = Math.max(box.lo - c.h, 0, c.h - box.hi);
    const near = Math.hypot(dx, dh);
    if (near < COIN_REACH) {
      c.x = Number.NaN;
      if (s.challenge) s.challenge.got += 1;
      gainCoin(s, s.distance, midH);
      effect(s, 'coin', s.distance, midH, 400);
      continue;
    }
    if (near < st.reach) c.pulled = true;
    // The owl swoops on a coin the knight is passing out of reach, above or below.
    if (!c.pulled && st.owl > 0 && c.x <= box.x1 && c.x >= box.x0 - 30 && dh <= st.owl) {
      c.pulled = true;
      effect(s, 'owl', c.x, c.h, 450);
    }
    if (c.pulled) {
      const tx = s.distance - c.x;
      const th = midH - c.h;
      const len = Math.hypot(tx, th) || 1;
      const step = Math.min(len, PULL_SPEED * sec);
      c.x += (tx / len) * step;
      c.h += (th / len) * step;
    }
  }
  s.course = s.course.filter((c) => !Number.isNaN(c.x) && c.x > s.distance - BEHIND);
  s.traps = s.traps.filter((t) => t.x + t.w > s.distance - BEHIND);
  s.ledges = s.ledges.filter((l) => l.x + l.w > s.distance - BEHIND);
  s.shrines = s.shrines.filter((sh) => sh.x + sh.w > s.distance - BEHIND);
  if (s.boss && !bossStands(s) && s.boss.x + s.boss.w < s.distance - BEHIND) s.boss = null;

  // A challenge course ends at its banner: the run is over, and its stars are counted.
  if (s.phase === 'running' && s.challenge && s.distance >= s.checkpointX) {
    s.challenge.done = true;
    s.phase = 'over';
    r.slideMs = 0;
    r.slideQueued = false;
    r.jumpQueued = false;
    return;
  }
  if (s.phase === 'running' && s.distance >= s.checkpointX) {
    s.phase = 'checkpoint';
    s.banners.push(metres(s.checkpointX));
    s.best = Math.max(s.best, metres(s.distance));
    // A no-hit dare is met by reaching the banner unhurt.
    if (s.dare?.kind === 'nohit' && !s.dare.failed) meetDare(s);
    s.choices = rollChoices(s);
    // Nothing tapped on the way in carries over to the next stage.
    r.slideMs = 0;
    r.skidMs = 0;
    r.jumpQueued = false;
    r.slideQueued = false;
  }
}

/**
 * Two different boons the knight can still take (three when the stage's dare was met); one Field
 * Dressing fills in when few are left, so a run that has taken every boon is dealt fewer cards.
 * From the second checkpoint, a cursed boon may take the second card. (The first checkpoint draws no curse, so its draws are the same as before curses
 * were added.)
 */
export function rollChoices(s: GameState): BoonId[] {
  // On a daily course the cards have a seed of their own, so a third draw after a met dare, or a
  // curse draw, can't shift the next stage's layout for one player and not another.
  if (s.daily) s.seed = seedOf(`${s.daily}:cards:${s.stage}`);
  const pool = BOON_IDS.filter((id) => !BOONS[id].filler && !BOONS[id].cursed && canTake(s, id));
  const picks: BoonId[] = [];
  const want = s.dare?.done ? 3 : 2;
  while (picks.length < want && pool.length > 0) picks.push(pool.splice(Math.floor(rand(s) * pool.length), 1)[0]);
  // One Field Dressing at most: two of the same card would be no choice.
  if (picks.length < want) picks.push('mend');
  const curses = BOON_IDS.filter((id) => BOONS[id].cursed && canTake(s, id));
  if (s.stage >= CURSE.from && curses.length > 0 && rand(s) < CURSE.chance) picks[1] = curses[Math.floor(rand(s) * curses.length)];
  return picks;
}

/**
 * Takes a boon at a checkpoint, then starts the next stage, or, from stage 3, offers the two roads
 * it can run on first (`pickRoad`). A pair completed is announced.
 */
export function pick(s: GameState, id: BoonId) {
  if (s.phase !== 'checkpoint' || !s.choices?.includes(id)) return false;
  // The boon passed up, one the shop can sell when there is one (a curse can sit between two cards).
  s.missed = s.choices.find((c) => c !== id && forSale(c)) ?? s.choices.find((c) => c !== id) ?? null;
  const before = pairsOf(s.ranks);
  s.ranks[id] = (s.ranks[id] ?? 0) + 1;
  const st = stats(s);
  if (id === 'heart') s.hearts = Math.min(st.maxHearts, s.hearts + 1);
  if (id === 'mend') s.hearts = Math.min(st.maxHearts, s.hearts + 2);
  // Cursed Gold takes a heart away.
  s.hearts = Math.max(1, Math.min(st.maxHearts, s.hearts));
  s.choices = null;
  s.shields = st.shields;
  for (const pid of pairsOf(s.ranks)) {
    if (!before.includes(pid)) effect(s, 'pop', s.distance + 480, RUNNER.h + 120, 2400, PAIRS.find((p) => p.id === pid)!.pop);
  }
  if (roadChoiceDue(s)) {
    s.roads = ['high', 'low'];
    return true;
  }
  s.phase = 'running';
  nextStage(s);
  return true;
}

/** Picks the road the next stage runs on, once the boon is taken, and starts it. */
export function pickRoad(s: GameState, road: Road) {
  if (s.phase !== 'checkpoint' || !s.roads?.includes(road)) return false;
  s.road = road;
  s.roads = null;
  s.phase = 'running';
  nextStage(s);
  return true;
}

/** Landing on a boss's head stomps it; running into it hurts. Either way it flees ahead. */
function bossContact(s: GameState, prevH: number) {
  const b = s.boss;
  const r = s.runner;
  // Waiting, it is still out of reach; fleeing, it runs on past the knight without a blow.
  if (!b || !bossStands(s) || b.mode === 'wait' || b.mode === 'flee') return;
  const n = bossOf(b);
  const box = runnerBox(s);
  if (box.x1 <= b.x || box.x0 >= b.x + b.w || box.lo >= n.h) return;
  const st = stats(s);
  if (r.h < prevH && prevH >= n.h - STOMP_REACH && b.hurtMs <= 0) {
    b.hp -= 1;
    b.hurtMs = n.hurtMs;
    s.stomps += 1;
    effect(s, 'stomp', b.x + b.w / 2, n.h, 450);
    r.h = n.h;
    r.vh = st.jumpV * STOMP_BOUNCE;
    r.jumps = st.jumps;
    r.slideMs = 0;
    r.slideQueued = false;
    if (b.hp > 0) {
      b.mode = 'flee';
      return;
    }
    // Beaten: it falls where it stands, pays out, and the checkpoint comes up a little way on. The
    // dragon beaten wins the lasting crown, and the run goes on harder.
    b.mode = 'down';
    s.coins += n.reward;
    if (b.kind === 'dragon') {
      s.dragonBeaten = true;
      s.crown = true;
      s.speed = speedOf(s.stage, true);
      effect(s, 'pop', s.distance + 300, n.h + 150, 2600, 'dragonBeaten', n.reward);
    } else {
      s.bosses += 1;
      effect(s, 'pop', s.distance + 300, n.h + 150, 1400, 'gateBeaten', n.reward);
    }
    s.checkpointX = Math.round(s.distance + n.after);
    for (let i = 0; i < 6; i++) s.course.push({ id: s.nextId++, x: s.distance + 500 + i * 40, h: 12, pulled: false });
    return;
  }
  if (r.hurtMs <= 0) hurt(s, 'boss');
  if (s.phase === 'running') b.mode = 'flee';
}

/**
 * At the game-over screen, buys the boon missed at the last checkpoint for `BOON_PRICE` coins, so
 * the next run starts with it. One purchase at a time; Field Dressing is never for sale.
 */
export function buyMissed(s: GameState) {
  const id = s.missed;
  if (s.phase !== 'over' || !id || !forSale(id) || s.pending || s.bank < BOON_PRICE) return false;
  s.bank -= BOON_PRICE;
  s.pending = id;
  return true;
}

/** At the game-over screen, buys the next level of an armoury item with banked coins, for every run after. */
export function buyArmoury(s: GameState, id: ArmouryId) {
  const price = nextPrice(s.armoury, id);
  if (s.phase !== 'over' || price === null || s.bank < price) return false;
  s.bank -= price;
  s.armoury[id] += 1;
  return true;
}

/** At the game-over screen, unlocks a knight with banked coins, to ride from the next run on. */
export function buyKnight(s: GameState, id: KnightId) {
  const price = KNIGHTS[id].price;
  if (s.phase !== 'over' || s.knights.includes(id) || s.bank < price) return false;
  s.bank -= price;
  s.knights.push(id);
  return true;
}

/** At the game-over screen, buys a companion or its next level with banked coins, for the ordinary runs after. */
export function buyPet(s: GameState, id: PetId) {
  const price = nextPetPrice(s.pets, id);
  if (s.phase !== 'over' || price === null || s.bank < price) return false;
  s.bank -= price;
  s.pets[id] += 1;
  return true;
}
