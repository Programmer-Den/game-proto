import { byDifficulty } from '../../../../shared/settings';
import { CHARMS, GENERAL_RELICS, OMENS, RELICS, isCharm, type Mode, type OmenId, type RelicId } from './catalog';
import { DEFS, KINDS, type KindId, type Level } from './kinds';
import { dailySeed, newSeed, seeded, shuffle } from './rng';
import { newProgress, recordResult, type Progress } from './progress';

// The rules of a run: which puzzle comes next, hearts, hints, clocks, score, draft picks and
// relics, for every mode. Only this file changes a `Run`. The scene turns taps into moves on the
// current puzzle through `act`, and drains `events` for sound and saving. No Phaser.

/** Puzzles waiting in an Endless or Blitz run's queue, shown as "up next". */
export const QUEUE = 3;
/** How long the result banner shows between puzzles. */
export const BETWEEN_MS = 1200;
/** Hints a run starts with, by mode (Practice has as many as it wants). */
export const START_HINTS: Record<Mode, number> = { endless: 2, daily: 1, blitz: 1, draft: 1, duel: 3, practice: Infinity };
/** Hearts in Endless and Draft. Keep Normal at 3: the playthrough expects it. */
export const startHearts = () => byDifficulty(4, 3, 2);
export const MAX_HEARTS = 5;
/** Blitz's clock, and what a solve gives back and a skip or a loss takes. */
export const blitzSeconds = () => byDifficulty(240, 180, 150);
export const BLITZ_SOLVE_S = [10, 15, 20, 25] as const;
export const BLITZ_PENALTY_S = 10;
/** The daily five's levels. */
export const DAILY_LEVELS: Level[] = [0, 1, 1, 2, 3];
/** Pass and play: the puzzles each player plays, their levels, and the seconds added per skip, loss or hint. */
export const DUEL_LEVELS: Level[] = [0, 1, 2];
export const DUEL_FAIL_S = 30;
export const DUEL_HINT_S = 15;
/** Puzzles solved between relic offers in a draft run, and how many are offered. */
export const RELIC_EVERY = 3;
export const RELIC_OFFER = 3;
/** Cards a draft deals at most: the deal layout has three slots, so Crystal Ball is offered once. */
export const DRAFT_MAX = 3;
/** Extra time per Hourglass, as a share of each puzzle's time. */
export const HOURGLASS = 0.25;
/** A charm's kind: the points it pays, times, and how much slower Memory Echo turns its cards. */
export const CHARM_POINTS = 1.5;
export const CHARM_ECHO_SLOW = 1.35;
/** An omen taken: the points it pays, times, and the hearts a loss under Peril costs. */
export const OMEN_POINTS = 2;
export const PERIL_HEARTS = 2;
/**
 * Every `BOSS_EVERY`th puzzle of Endless and Draft is a boss: two puzzles of two kinds played back
 * to back on one clock (`BOSS_TIME` times their two limits), worth `BOSS_POINTS` times the points
 * and a relic pick.
 */
export const BOSS_EVERY = 5;
export const BOSS_TIME = 0.8;
export const BOSS_POINTS = 2;
/** Points: per level, per second left, taken per hint (down to a floor), and the streak bonus. */
export const POINTS_PER_LEVEL = 100;
export const POINTS_PER_SECOND = 2;
export const HINT_COST = 40;
export const MIN_POINTS = 20;
export const STREAK_STEP = 0.1;
export const STREAK_CAP = 10;

/** One puzzle a run deals: its kind, level and the seed it is made from. */
export interface Card {
  kind: KindId;
  level: Level;
  seed: number;
  /** A boss: the second puzzle, played straight after this one on the same clock. */
  boss?: Card;
}

export interface Current {
  card: Card;
  /** The puzzle's own state (see `puzzles/`). */
  state: any;
  /** Time left on a timed puzzle, or null, and the time it started with. */
  timeLeftMs: number | null;
  timeTotalMs: number;
  elapsedMs: number;
  hintsUsed: number;
  /** Free hints left (a charm gives one), and how many of the hints used were free. */
  freeHints: number;
  freeUsed: number;
  /** The omen taken for this puzzle, or null, and whether a move or hint has been made yet. */
  omen: OmenId | null;
  touched: boolean;
  /** The second half of a boss: the boss's card (whose first half is done), else null. */
  pair: Card | null;
  /** Earlier states, for Undo. */
  history: string[];
}

export type EndReason = 'solved' | 'failed' | 'timeout' | 'skip';

export interface Result {
  card: Card;
  reason: EndReason;
  ms: number;
  points: number;
  /** The omen it was played under. */
  omen?: OmenId;
  /** A boss (`card` is its first half). */
  boss?: boolean;
}

export type Phase = 'playing' | 'between' | 'draft' | 'relic' | 'handover' | 'over';

export type RunEvent =
  | { type: 'start'; kind: KindId }
  | { type: 'end'; reason: EndReason; points: number }
  | { type: 'heart' }
  | { type: 'hint' }
  | { type: 'warn' }
  | { type: 'relic'; relic: RelicId }
  | { type: 'omen'; omen: OmenId }
  | { type: 'half' }
  | { type: 'over' };

export interface Run {
  mode: Mode;
  phase: Phase;
  hearts: number;
  maxHearts: number;
  hints: number;
  score: number;
  streak: number;
  /** Puzzles dealt so far. */
  dealt: number;
  solved: number;
  current: Current | null;
  /** Endless and Blitz: the cards after this one. Daily and pass and play: the whole set. */
  queue: Card[];
  results: Result[];
  /** The last puzzle's result, shown between puzzles. */
  last: Result | null;
  betweenMs: number;
  /** Blitz: time left on the run's clock. */
  clockMs: number;
  relics: RelicId[];
  relicOffer: RelicId[];
  draftOffer: Card[];
  /** Pass and play: whose turn it is and each player's total time with penalties. */
  player: 0 | 1;
  totals: [number, number];
  /** Pass and play: puzzles each player solved. */
  duelSolved: [number, number];
  /** Daily: the date's seed. */
  day: number;
  progress: Progress;
  /** A new best this run set, for the end card. */
  newBest: boolean;
  events: RunEvent[];
}

export function newRun(mode: Mode, progress: Progress = newProgress()): Run {
  return {
    mode,
    phase: 'playing',
    hearts: mode === 'endless' || mode === 'draft' ? startHearts() : 0,
    maxHearts: MAX_HEARTS,
    hints: START_HINTS[mode],
    score: 0,
    streak: 0,
    dealt: 0,
    solved: 0,
    current: null,
    queue: [],
    results: [],
    last: null,
    betweenMs: 0,
    clockMs: mode === 'blitz' ? blitzSeconds() * 1000 : 0,
    relics: [],
    relicOffer: [],
    draftOffer: [],
    player: 0,
    totals: [0, 0],
    duelSolved: [0, 0],
    day: 0,
    progress,
    newBest: false,
    events: [],
  };
}

/** The level of the `n`th puzzle (from 0) of an Endless or Draft run, or of Blitz by solves. */
export const endlessLevel = (n: number) => Math.min(3, Math.floor(n / 3)) as Level;
const blitzLevel = (solved: number) => Math.min(3, Math.floor(solved / 2)) as Level;

/** A random card of a kind other than `not`. */
function randomCard(level: Level, not: KindId[] = []): Card {
  const kinds = KINDS.filter((k) => !not.includes(k));
  return { kind: kinds[Math.floor(Math.random() * kinds.length)], level, seed: newSeed() };
}

/** Whether the `n`th puzzle (from 0) of an Endless or Draft run is a boss. */
export const isBossTurn = (n: number) => (n + 1) % BOSS_EVERY === 0;

/** A random boss: two cards of two kinds other than `not`, at one level. */
function bossCard(level: Level, not: KindId[] = []): Card {
  const first = randomCard(level, not);
  return { ...first, boss: randomCard(level, [...not, first.kind]) };
}

/** The `n`th card of an Endless run, of a kind other than `not`: a boss on a boss turn. */
const endlessCard = (n: number, not: KindId[]) => (isBossTurn(n) ? bossCard : randomCard)(endlessLevel(n), not);
/** The kind a card ends on, which the next card must not repeat. */
const lastKind = (card: Card) => card.boss?.kind ?? card.kind;

/** Starts a run of a mode. Practice needs its kind and level. */
export function startRun(mode: Mode, progress: Progress, opts: { kind?: KindId; level?: Level; date?: Date } = {}): Run {
  const run = newRun(mode, progress);
  switch (mode) {
    case 'endless':
    case 'blitz': {
      let last: KindId[] = [];
      for (let i = 0; i < QUEUE + 1; i++) {
        const card = mode === 'blitz' ? randomCard(0, last) : endlessCard(i, last);
        last = [lastKind(card)];
        run.queue.push(card);
      }
      deal(run, run.queue.shift()!);
      break;
    }
    case 'daily': {
      run.day = dailySeed(opts.date ?? new Date());
      const rand = seeded(run.day);
      const kinds = shuffle(rand, [...KINDS]).slice(0, DAILY_LEVELS.length);
      run.queue = kinds.map((kind, i) => ({ kind, level: DAILY_LEVELS[i], seed: Math.floor(rand() * 2 ** 31) }));
      // One try a day: the day, and the run, count as played from its first card.
      progress.daily = { day: run.day, score: 0 };
      progress.runs++;
      deal(run, run.queue[0]);
      break;
    }
    case 'duel': {
      const kinds = shuffle(Math.random, [...KINDS]).slice(0, DUEL_LEVELS.length);
      run.queue = kinds.map((kind, i) => ({ kind, level: DUEL_LEVELS[i], seed: newSeed() }));
      deal(run, run.queue[0]);
      break;
    }
    case 'practice':
      deal(run, { kind: opts.kind ?? 'nonogram', level: opts.level ?? 0, seed: newSeed() });
      break;
    case 'draft':
      offerDraft(run);
      break;
  }
  return run;
}

function timeFor(run: Run, card: Card) {
  if (run.mode === 'practice' || run.mode === 'blitz') return null;
  const hourglasses = run.relics.filter((r) => r === 'hourglass').length;
  const limit = (c: Card) => DEFS[c.kind].limit[c.level];
  const seconds = card.boss ? (limit(card) + limit(card.boss)) * BOSS_TIME : limit(card);
  return seconds * 1000 * (1 + HOURGLASS * hourglasses);
}

/** Whether the run holds the charm of a kind. */
export const holdsCharm = (run: Run, kind: KindId) => run.relics.includes(CHARMS[kind]);

/** Makes a card's puzzle, fresh from its seed, with its time and its charm's help. */
export function makeCurrent(run: Run, card: Card): Current {
  const time = timeFor(run, card);
  const state = DEFS[card.kind].make(seeded(card.seed), card.level);
  const charm = holdsCharm(run, card.kind);
  if (charm && card.kind === 'echo') state.stepMs = Math.round(state.stepMs * CHARM_ECHO_SLOW);
  return { card, state, timeLeftMs: time, timeTotalMs: time ?? 0, elapsedMs: 0, hintsUsed: 0, freeHints: charm && card.kind !== 'echo' ? 1 : 0, freeUsed: 0, omen: null, touched: false, pair: null, history: [] };
}

/** A boss's first half is solved: its second is dealt on the same clock, with its hints and omen. */
function secondHalf(run: Run) {
  const cur = run.current!;
  const pair = cur.card;
  recordResult(run.progress, pair.kind, pair.level, true, cur.elapsedMs, cur.hintsUsed);
  const next = makeCurrent(run, pair.boss!);
  run.current = {
    ...next,
    timeLeftMs: cur.timeLeftMs,
    timeTotalMs: cur.timeTotalMs,
    elapsedMs: cur.elapsedMs,
    hintsUsed: cur.hintsUsed,
    freeUsed: cur.freeUsed,
    omen: cur.omen,
    touched: true,
    pair,
  };
  run.events.push({ type: 'half' }, { type: 'start', kind: next.card.kind });
}

/**
 * The omen a card offers, from its seed (no draw from `Math.random`, so the deck deals as before):
 * Memory Echo, with no hints, undo or clock of its own to cut, only offers Peril.
 */
export const omenFor = (card: Card): OmenId => (card.kind === 'echo' ? 'peril' : OMENS[(card.seed >>> 4) % OMENS.length]);

/** Whether the puzzle in play can still take its omen: Endless or Draft, before its first move. */
export const canTakeOmen = (run: Run) =>
  run.phase === 'playing' && (run.mode === 'endless' || run.mode === 'draft') && !!run.current && !run.current.omen && !run.current.touched;

/** Takes the puzzle's omen: Haste halves its time; Silence and Peril change Undo, hints and losses. */
export function takeOmen(run: Run) {
  const cur = run.current;
  if (!canTakeOmen(run) || !cur) return false;
  cur.omen = omenFor(cur.card);
  if (cur.omen === 'haste' && cur.timeLeftMs !== null) {
    cur.timeTotalMs = Math.round(cur.timeTotalMs / 2);
    cur.timeLeftMs = Math.min(cur.timeLeftMs, cur.timeTotalMs);
  }
  run.events.push({ type: 'omen', omen: cur.omen });
  return true;
}

/** Makes a card's puzzle and puts it in play. */
function deal(run: Run, card: Card) {
  run.current = makeCurrent(run, card);
  run.dealt++;
  run.phase = 'playing';
  run.events.push({ type: 'start', kind: card.kind });
}

function offerDraft(run: Run) {
  const level = endlessLevel(run.dealt);
  const count = 2 + run.relics.filter((r) => r === 'crystal').length;
  const last = run.results.length ? [lastKind(run.results[run.results.length - 1].card)] : [];
  const offer: Card[] = [];
  // A boss turn deals only bosses to choose from.
  const make = isBossTurn(run.dealt) ? bossCard : randomCard;
  for (let i = 0; i < Math.min(count, DRAFT_MAX); i++) offer.push(make(level, [...last, ...offer.map((c) => c.kind)]));
  run.draftOffer = offer;
  run.phase = 'draft';
}

/** Takes one of a draft run's offered cards. */
export function draftPick(run: Run, index: number) {
  if (run.phase !== 'draft' || !run.draftOffer[index]) return false;
  deal(run, run.draftOffer[index]);
  run.draftOffer = [];
  return true;
}

/** Takes one of the offered relics. */
export function takeRelic(run: Run, index: number) {
  const relic = run.relicOffer[index];
  if (run.phase !== 'relic' || !relic) return false;
  run.relics.push(relic);
  if (relic === 'lantern') run.hints++;
  if (relic === 'heartstone') run.hearts = Math.min(run.maxHearts, run.hearts + 1);
  run.relicOffer = [];
  run.events.push({ type: 'relic', relic });
  if (run.mode === 'draft') offerDraft(run);
  else dealQueued(run);
  return true;
}

/**
 * Makes a move on the current puzzle: `change` changes its state and says whether it did. A
 * change is kept for Undo, and a solved or lost puzzle ends.
 */
export function act(run: Run, change: (state: any) => boolean, before?: string) {
  const cur = run.current;
  if (run.phase !== 'playing' || !cur) return false;
  // A drag that changes nothing at its start passes the state from before it began.
  before ??= JSON.stringify(cur.state);
  if (!change(cur.state)) return false;
  cur.touched = true;
  if (DEFS[cur.card.kind].undo) cur.history.push(before);
  check(run);
  return true;
}

/** A step of a drag: changes the state like `act`, with no Undo step (the drag's start made one). */
export function drag(run: Run, change: (state: any) => boolean) {
  const cur = run.current;
  if (run.phase !== 'playing' || !cur) return false;
  if (!change(cur.state)) return false;
  check(run);
  return true;
}

/** Whether Undo has a move to take back. */
export const canUndo = (run: Run) => run.phase === 'playing' && !!run.current?.history.length && run.current.omen !== 'silence';

export function undo(run: Run) {
  const cur = run.current;
  if (!canUndo(run) || !cur) return false;
  cur.state = JSON.parse(cur.history.pop()!);
  DEFS[cur.card.kind].afterUndo?.(cur.state);
  return true;
}

export const canHint = (run: Run) =>
  run.phase === 'playing' && !!run.current && run.current.omen !== 'silence' && (run.hints > 0 || run.current.freeHints > 0) && run.current.card.kind !== 'echo' && DEFS[run.current.card.kind].canHint?.(run.current.state) !== false;

export function hint(run: Run) {
  const cur = run.current;
  if (!canHint(run) || !cur) return false;
  const before = JSON.stringify(cur.state);
  if (!DEFS[cur.card.kind].hint(cur.state)) return false;
  if (DEFS[cur.card.kind].undo) cur.history.push(before);
  if (cur.freeHints > 0) cur.freeHints--, cur.freeUsed++;
  else run.hints--;
  cur.hintsUsed++;
  cur.touched = true;
  run.events.push({ type: 'hint' });
  check(run);
  return true;
}

/**
 * Gives up on the current puzzle: a heart in Endless and Draft, time in Blitz and pass and play.
 * Practice just deals a new puzzle of the same kind and level, with nothing recorded.
 */
export function skip(run: Run) {
  if (run.phase !== 'playing' || !run.current) return false;
  if (run.mode === 'practice') deal(run, { ...run.current.card, seed: newSeed() });
  else end(run, 'skip');
  return true;
}

function check(run: Run) {
  const cur = run.current!;
  const def = DEFS[cur.card.kind];
  if (def.solved(cur.state)) cur.card.boss ? secondHalf(run) : end(run, 'solved');
  else if (def.failed?.(cur.state)) end(run, 'failed');
}

function pointsFor(run: Run, cur: Current) {
  const base = POINTS_PER_LEVEL * (cur.card.level + 1) + (cur.timeLeftMs ? Math.floor(cur.timeLeftMs / 1000) * POINTS_PER_SECOND : 0);
  const afterHints = Math.max(MIN_POINTS, base - HINT_COST * (cur.hintsUsed - cur.freeUsed));
  const charm = holdsCharm(run, cur.card.kind) ? CHARM_POINTS : 1;
  const omen = cur.omen ? OMEN_POINTS : 1;
  const boss = cur.pair ? BOSS_POINTS : 1;
  return Math.round(afterHints * charm * omen * boss * (1 + STREAK_STEP * Math.min(run.streak, STREAK_CAP)));
}

function end(run: Run, reason: EndReason) {
  const cur = run.current!;
  const solved = reason === 'solved';
  const points = solved && run.mode !== 'practice' && run.mode !== 'duel' ? pointsFor(run, cur) : 0;
  const boss = cur.pair ?? (cur.card.boss ? cur.card : null);
  const result: Result = { card: boss ?? cur.card, reason, ms: cur.elapsedMs, points, ...(cur.omen ? { omen: cur.omen } : {}), ...(boss ? { boss: true } : {}) };
  run.results.push(result);
  run.last = result;
  recordResult(run.progress, cur.card.kind, cur.card.level, solved, cur.elapsedMs, cur.hintsUsed);
  run.score += points;
  // The day's score so far, and the daily best, so a reload or a crash keeps the points of the
  // cards played.
  if (run.mode === 'daily') {
    run.progress.daily = { day: run.day, score: run.score };
    if (run.score > run.progress.best.daily) (run.progress.best.daily = run.score), (run.newBest = true);
  }
  if (solved) {
    run.solved++;
    run.streak++;
  } else run.streak = 0;
  run.events.push({ type: 'end', reason, points });
  if (!solved && (run.mode === 'endless' || run.mode === 'draft')) {
    run.hearts = Math.max(0, run.hearts - (cur.omen === 'peril' ? PERIL_HEARTS : 1));
    run.events.push({ type: 'heart' });
  }
  if (run.mode === 'blitz') {
    run.clockMs = solved ? run.clockMs + BLITZ_SOLVE_S[cur.card.level] * 1000 : Math.max(0, run.clockMs - BLITZ_PENALTY_S * 1000);
    // The level rises with solves, so the queue shows what will be dealt.
    for (const card of run.queue) card.level = blitzLevel(run.solved);
  }
  if (run.mode === 'duel') {
    run.totals[run.player] += cur.elapsedMs + (solved ? 0 : DUEL_FAIL_S * 1000) + cur.hintsUsed * DUEL_HINT_S * 1000;
    if (solved) run.duelSolved[run.player]++;
  }
  run.phase = 'between';
  run.betweenMs = BETWEEN_MS;
}

/** Moves on from the result banner: the next puzzle, a draft, relics, the hand-over or the end. */
export function next(run: Run) {
  if (run.phase !== 'between') return false;
  const done = run.results.length;
  switch (run.mode) {
    case 'endless':
    case 'blitz': {
      if ((run.mode === 'endless' && run.hearts <= 0) || (run.mode === 'blitz' && run.clockMs <= 0)) return finish(run), true;
      // A boss beaten in Endless offers relics before the next card.
      if (run.mode === 'endless' && run.last?.boss && run.last.reason === 'solved') {
        run.relicOffer = offerRelics(run);
        run.phase = 'relic';
        return true;
      }
      dealQueued(run);
      return true;
    }
    case 'daily':
      if (done >= run.queue.length) return finish(run), true;
      deal(run, run.queue[done]);
      return true;
    case 'duel': {
      const mine = done - run.player * run.queue.length;
      if (mine < run.queue.length) deal(run, run.queue[mine]);
      else if (run.player === 0) run.phase = 'handover';
      else finish(run);
      return true;
    }
    case 'draft':
      if (run.hearts <= 0) return finish(run), true;
      if (run.last?.reason === 'solved' && (run.solved % RELIC_EVERY === 0 || run.last.boss)) {
        run.relicOffer = offerRelics(run);
        run.phase = 'relic';
      } else offerDraft(run);
      return true;
    case 'practice':
      deal(run, { ...run.current!.card, seed: newSeed() });
      return true;
  }
}

/** Deals the next card of an Endless or Blitz queue, and queues another. */
function dealQueued(run: Run) {
  const card = run.queue.shift()!;
  const after = lastKind(run.queue[run.queue.length - 1] ?? card);
  run.queue.push(run.mode === 'blitz' ? randomCard(blitzLevel(run.solved), [after]) : endlessCard(run.dealt + QUEUE, [after]));
  deal(run, card);
}

/**
 * The relics offered: one charm the run doesn't hold yet (while any is left) and general relics
 * for the rest. A second Crystal Ball would do nothing (`DRAFT_MAX`), so it is offered once, and
 * never in Endless, which deals no drafts.
 */
export function offerRelics(run: Run): RelicId[] {
  const charms = RELICS.filter((r) => isCharm(r) && !run.relics.includes(r));
  const general = GENERAL_RELICS.filter((r) => r !== 'crystal' || (run.mode === 'draft' && !run.relics.includes('crystal')));
  const offer: RelicId[] = shuffle(Math.random, charms).slice(0, 1);
  return [...shuffle(Math.random, [...general]).slice(0, RELIC_OFFER - offer.length), ...offer];
}

/** Pass and play: the second player starts on the same puzzles. */
export function startSecondPlayer(run: Run) {
  if (run.phase !== 'handover') return false;
  run.player = 1;
  run.hints = START_HINTS.duel;
  deal(run, run.queue[0]);
  return true;
}

function finish(run: Run) {
  run.phase = 'over';
  const best = run.progress.best;
  const mode = run.mode;
  if (mode === 'endless' || mode === 'blitz') {
    if (run.score > best[mode]) (best[mode] = run.score), (run.newBest = true);
  }
  if (mode === 'draft' && run.solved > best.draft) (best.draft = run.solved), (run.newBest = true);
  // The daily five records its score and best after every card (`end`) and counts its run when it
  // starts, so a reload keeps them.
  if (mode !== 'daily') run.progress.runs++;
  run.events.push({ type: 'over' });
}

/**
 * Leaves a run before it is over (the Leave button): it ends there, recording its bests, the daily
 * five's score and the run like a run that ended by its rules. Practice records nothing.
 */
export function quit(run: Run) {
  if (run.phase === 'over' || run.mode === 'practice') return false;
  finish(run);
  return true;
}

/** Advances the run's clocks by `dt` milliseconds of game time. */
export function tick(run: Run, dt: number) {
  const cur = run.current;
  if (run.phase === 'between') {
    // Practice waits for a tap; the other modes move on by themselves.
    if (run.mode !== 'practice' && (run.betweenMs -= dt) <= 0) next(run);
    return;
  }
  if (run.phase !== 'playing' || !cur) return;
  cur.elapsedMs += dt;
  const def = DEFS[cur.card.kind];
  if (def.tick) {
    def.tick(cur.state, dt);
    check(run);
    if (run.phase !== 'playing') return;
  }
  if (cur.timeLeftMs !== null) {
    const before = cur.timeLeftMs;
    cur.timeLeftMs = Math.max(0, cur.timeLeftMs - dt);
    if (Math.ceil(cur.timeLeftMs / 1000) < Math.ceil(before / 1000) && cur.timeLeftMs <= 5000 && cur.timeLeftMs > 0) run.events.push({ type: 'warn' });
    if (cur.timeLeftMs <= 0) end(run, 'timeout');
  }
  if (run.mode === 'blitz') {
    const before = run.clockMs;
    run.clockMs = Math.max(0, run.clockMs - dt);
    if (Math.ceil(run.clockMs / 1000) < Math.ceil(before / 1000) && run.clockMs <= 5000 && run.clockMs > 0) run.events.push({ type: 'warn' });
    // The run ends where the clock runs out; the puzzle it cut off counts neither way.
    if (run.clockMs <= 0) finish(run);
  }
}

/** Whether today's daily five has been played. */
export const dailyDone = (progress: Progress, date = new Date()) => progress.daily?.day === dailySeed(date);

