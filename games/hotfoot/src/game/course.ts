import { BOSS } from './boss';
import {
  AWAKE,
  CLOUD,
  DARE,
  DRAGON_AT,
  FLAMES,
  HARDER,
  LEAD_IN,
  ROAD,
  ROCK,
  SHRINE,
  STAGE_LEN,
  dareOf,
  isBossStage,
  isRockStage,
  metres,
  rand,
  seedOf,
  speedOf,
  terrainOf,
  type BossKind,
  type GameState,
  type Road,
  type TrapKind,
} from './state';

// Lays out a stage's obstacles and coins between its start and its checkpoint: traps, goblins and
// bats, and raised ledges to climb, and from stage 2 a wayside shrine in the gap nearest the
// stage's middle (not on the High Road). New kinds join on later stages, and obstacles come closer
// together: closer still on the High Road, which also has more foes and more coins, and further
// apart on the Low Road. Every fifth stage is the Gatekeeper's instead, and the first stage past
// 1500 m the dragon's: a clear road with the boss waiting on it. Past the dragon the ordinary stages
// run on the Sky Road, with gaps in the clouds crossed on falling clouds. Every seventh stage a rockfall
// rolls in behind the knight. Every random pick goes through `rand` (Math.random, or the daily
// course's seed) so a seeded run repeats (the shrine, the bosses, the roads' extra coins, the dare
// and the rockfall take no random draws). A daily stage reseeds from the date and the stage, so
// the draws taken before it (a checkpoint's cards, an earlier stage) can't shift its layout.

/** No obstacle this close before the checkpoint, so the knight lands before reaching it. */
const CLEAR_BEFORE_CHECKPOINT = 420;
/** Half the knight's width, so the rockfall starts its distance behind the knight's back. */
const RUNNER_BACK = 14;

/** One obstacle on the course: a trap, a foe, or a ledge or flight of steps to climb. */
export type Piece = Exclude<TrapKind, 'barrel' | 'axe' | 'fire' | 'tail'> | 'ledge' | 'steps' | 'cloud';

/**
 * What can turn up on a stage. Spikes come up most often; fire vents and bats join on stage 2, steps
 * on stage 3. The High Road adds another goblin and bat to the pool. The Sky Road beyond the Keep
 * has no stone ledges, pits or fire vents: its gaps in the clouds are crossed on falling clouds.
 */
export function piecesOf(stage: number, road: Road | null = null, sky = false): Piece[] {
  const pool: Piece[] = sky ? ['spikes', 'spikes', 'blade', 'goblin', 'bat', 'bat', 'cloud', 'cloud'] : ['spikes', 'spikes', 'blade', 'pit', 'goblin', 'ledge'];
  if (stage >= 2 && !sky) pool.push('flames', 'bat');
  if (stage >= 3 && !sky) pool.push('steps', 'goblin');
  if (road === 'high') pool.push('goblin', 'bat');
  return pool;
}

/** The first stage shows these once each, in this order, before mixing them up. */
export const OPENING: Piece[] = ['spikes', 'blade', 'goblin', 'ledge'];

const pickOf = <T>(s: GameState, items: T[]) => items[Math.floor(rand(s) * items.length)];

/**
 * Room between one obstacle and the next on a stage: at least the length of a jump and a landing.
 * The High Road packs them closer, the Low Road spreads them out, and the run after the dragon is
 * beaten packs them closer still.
 */
export function gapsOf(stage: number, road: Road | null = null, hard = false) {
  const base = Math.max(300, 440 - 25 * (stage - 1));
  const min = Math.max(240, base + (road === 'high' ? ROAD.highGap : road === 'low' ? ROAD.lowGap : 0) + (hard ? HARDER.gap : 0));
  return { min, max: min + 200 };
}

/** How long a goblin's beat is, and how fast it walks it. */
const GOBLIN = { w: 24, beat: 160, speed: (stage: number) => Math.min(100, 50 + 10 * stage) };
/** A bat's size, its height over the road (too low to run under) and its speed. */
const BAT = { w: 34, h: 34, speed: (stage: number) => Math.min(160, 80 + 15 * stage) };
/** Ledge heights: a low step, and a tall one from stage 3. */
const LEDGE_H = { low: 48, high: 80 };
/** The Sky Road's gaps in the clouds (each width has a baked `pit-<w>`), and how far in from each edge the cloud over one floats. */
export const SKY_GAPS = [560, 620, 680];
const CLOUD_INSET = 60;

interface Plan {
  /** Course length the piece takes up from where it starts. */
  span: number;
  place: (x: number) => void;
}

function planOf(s: GameState, piece: Piece): Plan {
  const id = () => s.nextId++;
  const coin = (x: number, h: number) => s.course.push({ id: id(), x, h, pulled: false });
  const high = s.road === 'high';
  /** An arc of coins over a jump, on ground of height `base`; two more on the High Road. */
  const arc = (mid: number, base = 0) => {
    for (const [dx, h] of [[-44, 70], [0, 104], [44, 70]]) coin(mid + dx, base + h);
    if (high) for (const [dx, h] of [[-76, 36], [76, 36]]) coin(mid + dx, base + h);
  };
  /** Low coins along the ground, picked up on a slide; two more on the High Road. */
  const low = (mid: number) => {
    for (const dx of [-30, 0, 30]) coin(mid + dx, 10);
    if (high) for (const dx of [-60, 60]) coin(mid + dx, 10);
  };
  const trap = (kind: TrapKind, x: number, w: number, extra: Partial<GameState['traps'][number]> = {}) =>
    s.traps.push({ id: id(), kind, x, w, h: 0, vx: 0, ...extra });

  switch (piece) {
    case 'spikes': {
      const w = 36 + 12 * Math.floor(rand(s) * 3);
      return { span: w, place: (x) => (trap('spikes', x, w), arc(x + w / 2)) };
    }
    case 'pit': {
      const w = 80 + 16 * Math.floor(rand(s) * 3);
      return { span: w, place: (x) => (trap('pit', x, w), arc(x + w / 2)) };
    }
    case 'blade':
      return { span: 26, place: (x) => (trap('blade', x, 26), low(x + 13)) };
    case 'flames': {
      // Each vent starts somewhere in its burn, so they don't all flare together.
      const phase = Math.floor(rand(s) * FLAMES.cycle);
      return { span: 32, place: (x) => (trap('flames', x, 32, { phase }), arc(x + 16)) };
    }
    case 'goblin': {
      // A goblin walks a beat of road, starting at its far end and heading for the knight.
      const vx = -GOBLIN.speed(s.stage);
      return {
        span: GOBLIN.beat,
        place: (x) => {
          trap('goblin', x + GOBLIN.beat - GOBLIN.w, GOBLIN.w, { vx, from: x, to: x + GOBLIN.beat });
          for (const dx of [40, 80, 120]) coin(x + dx, 120);
        },
      };
    }
    case 'bat': {
      // A bat flies at the knight once awake; it starts far enough out to meet them at `x`.
      const v = BAT.speed(s.stage);
      const ahead = (v * AWAKE) / (s.speed + v);
      return { span: BAT.w + 40, place: (x) => (trap('bat', x + ahead, BAT.w, { h: BAT.h, vx: -v }), low(x + 13)) };
    }
    case 'ledge': {
      // A raised stretch to jump up onto, with coins along its top and a drop off its far end.
      const h = s.stage >= 3 && rand(s) < 0.5 ? LEDGE_H.high : LEDGE_H.low;
      const w = 280 + 40 * Math.floor(rand(s) * 4);
      return {
        span: w,
        place: (x) => {
          s.ledges.push({ id: id(), x, w, h });
          for (let cx = x + 140; cx < x + w - 20; cx += 40) coin(cx, h + 12);
        },
      };
    }
    case 'steps': {
      // Two steps up, one after the other, then a drop from the top back to the road. Each step is
      // long enough to land a jump on and jump again before the next, at the stage's speed.
      const w = Math.max(240, 40 * Math.ceil(s.speed / 40));
      return {
        span: 2 * w,
        place: (x) => {
          s.ledges.push({ id: id(), x, w, h: LEDGE_H.low }, { id: id(), x: x + w, w, h: LEDGE_H.high });
          arc(x + w, LEDGE_H.low);
          for (let cx = x + w + 140; cx < x + 2 * w - 20; cx += 40) coin(cx, LEDGE_H.high + 12);
        },
      };
    }
    case 'cloud': {
      // A gap in the clouds too wide for one jump (but not for one carried by a gust), and a cloud
      // floating over it to land on and leap off
      // before it falls away. Its coins sit along the cloud.
      const w = SKY_GAPS[Math.floor(rand(s) * SKY_GAPS.length)];
      return {
        span: w,
        place: (x) => {
          trap('pit', x, w);
          s.ledges.push({ id: id(), x: x + CLOUD_INSET, w: w - 2 * CLOUD_INSET, h: CLOUD.h, cloud: true });
          for (let cx = x + CLOUD_INSET + 30; cx < x + w - CLOUD_INSET - 10; cx += 40) coin(cx, CLOUD.h + 12);
        },
      };
    }
  }
}

/** Whether this stage is the dragon's: the first to start at or past `DRAGON_AT` metres, until it is beaten. */
export const dragonStage = (s: Pick<GameState, 'stageStart' | 'dragonBeaten'>) => !s.dragonBeaten && metres(s.stageStart) >= DRAGON_AT;

export function buildStage(s: GameState) {
  if (s.daily) s.seed = seedOf(`${s.daily}:${s.stage}`);
  if (dragonStage(s)) return buildBossStage(s, 'dragon');
  if (isBossStage(s.stage)) return buildBossStage(s, 'gate');
  if (isRockStage(s.stage)) s.rockfall = { x: s.distance - RUNNER_BACK - ROCK.start };
  if (s.stage >= DARE.from) s.dare = dareOf(s.stage);
  const end = s.checkpointX - CLEAR_BEFORE_CHECKPOINT;
  const { min, max } = gapsOf(s.stage, s.road, s.dragonBeaten);
  let x = s.stageStart + LEAD_IN;
  let last: Piece | null = null;
  const opening = s.stage === 1 ? [...OPENING] : [];
  // A row of coins on the clear run, to show the way; a longer one on the High Road.
  for (let i = 0; i < (s.road === 'high' ? 8 : 5); i++) s.course.push({ id: s.nextId++, x: s.stageStart + 300 + i * 40, h: 12, pulled: false });
  /** The open road between one piece and the next, where a shrine can stand. */
  const gaps: [number, number][] = [];
  let lastEnd: number | null = null;
  while (x < end) {
    // Nothing but spikes comes twice in a row. The opening is evenly spaced, so it always fits.
    const first = opening.shift();
    const piece = first ?? pickOf(s, piecesOf(s.stage, s.road, s.terrain === 'sky').filter((p) => p === 'spikes' || p !== last));
    const plan = planOf(s, piece);
    if (x + plan.span > end) break;
    plan.place(x);
    if (lastEnd !== null) gaps.push([lastEnd, x]);
    lastEnd = x + plan.span;
    last = piece;
    x += plan.span + (first ? min : min + rand(s) * (max - min));
  }
  if (s.stage >= SHRINE.from && s.road !== 'high') placeShrine(s, gaps);
}


/** Stands the stage's shrine in the middle of the gap nearest the middle of the stage. */
function placeShrine(s: GameState, gaps: [number, number][]) {
  const mid = (s.stageStart + s.checkpointX) / 2;
  const centre = ([a, b]: [number, number]) => (a + b) / 2;
  const fits = gaps.filter(([a, b]) => b - a >= SHRINE.w + 160);
  if (fits.length === 0) return;
  const gap = fits.reduce((best, g) => (Math.abs(centre(g) - mid) < Math.abs(centre(best) - mid) ? g : best));
  s.shrines.push({ id: s.nextId++, x: Math.round(centre(gap) - SHRINE.w / 2), w: SHRINE.w, used: false, tried: false });
}

/**
 * A boss's stage: a row of coins on the lead-in, then the Gatekeeper or the dragon waiting on the
 * open road. Its checkpoint is pushed on ahead of the knight until it is beaten (see `boss.ts`).
 */
function buildBossStage(s: GameState, kind: BossKind) {
  const n = BOSS[kind];
  for (let i = 0; i < 5; i++) s.course.push({ id: s.nextId++, x: s.stageStart + 300 + i * 40, h: 12, pulled: false });
  s.boss = { kind, x: s.stageStart + LEAD_IN + n.station, w: n.w, hp: n.hp, mode: 'wait', ms: 0, thrown: 0, hurtMs: 0 };
  s.road = null;
  s.terrain = 'road';
}

/** Starts the stage after a checkpoint, right where the last one ended. */
export function nextStage(s: GameState) {
  s.stage += 1;
  s.terrain = terrainOf(s.stage, s.dragonBeaten);
  s.speed = speedOf(s.stage, s.dragonBeaten);
  s.boss = null;
  s.rockfall = null;
  s.dare = null;
  s.stageStart = s.checkpointX;
  s.checkpointX = s.stageStart + STAGE_LEN;
  buildStage(s);
}

/** Whether the checkpoint at `checkpointX` asks for a road: the next stage is an ordinary one from stage `ROAD.from`. */
export function roadChoiceDue(s: Pick<GameState, 'stage' | 'checkpointX' | 'dragonBeaten'>) {
  const next = s.stage + 1;
  return next >= ROAD.from && !isBossStage(next) && !dragonStage({ stageStart: s.checkpointX, dragonBeaten: s.dragonBeaten });
}
