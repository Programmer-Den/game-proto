import { byDifficulty } from '../../../../shared/settings';
import { CHARMS, GENERAL_RELICS, RELICS, isCharm, type Mode, type RelicId } from './catalog';
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
  /** Earlier states, for Undo. */
  history: string[];
}

export type EndReason = 'solved' | 'failed' | 'timeout' | 'skip';

export interface Result {
  card: Card;
  reason: EndReason;
  ms: number;
  points: number;
}

export type Phase = 'playing' | 'between' | 'draft' | 'relic' | 'handover' | 'over';

export type RunEvent =
  | { type: 'start'; kind: KindId }
  | { type: 'end'; reason: EndReason; points: number }
  | { type: 'heart' }
  | { type: 'hint' }
  | { type: 'warn' }
  | { type: 'relic'; relic: RelicId }
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

/** Starts a run of a mode. Practice needs its kind and level. */
export function startRun(mode: Mode, progress: Progress, opts: { kind?: KindId; level?: Level; date?: Date } = {}): Run {
  const run = newRun(mode, progress);
  switch (mode) {
    case 'endless':
    case 'blitz': {
      let last: KindId[] = [];
      for (let i = 0; i < QUEUE + 1; i++) {
        const card = randomCard(mode === 'blitz' ? 0 : endlessLevel(i), last);
        last = [card.kind];
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
  return DEFS[card.kind].limit[card.level] * 1000 * (1 + HOURGLASS * hourglasses);
}

/** Whether the run holds the charm of a kind. */
export const holdsCharm = (run: Run, kind: KindId) => run.relics.includes(CHARMS[kind]);

/** Makes a card's puzzle, fresh from its seed, with its time and its charm's help. */
export function makeCurrent(run: Run, card: Card): Current {
  const time = timeFor(run, card);
  const state = DEFS[card.kind].make(seeded(card.seed), card.level);
  const charm = holdsCharm(run, card.kind);
  if (charm && card.kind === 'echo') state.stepMs = Math.round(state.stepMs * CHARM_ECHO_SLOW);
  return { card, state, timeLeftMs: time, timeTotalMs: time ?? 0, elapsedMs: 0, hintsUsed: 0, freeHints: charm && card.kind !== 'echo' ? 1 : 0, freeUsed: 0, history: [] };
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
  const last = run.results.length ? [run.results[run.results.length - 1].card.kind] : [];
  const offer: Card[] = [];
  for (let i = 0; i < Math.min(count, DRAFT_MAX); i++) offer.push(randomCard(level, [...last, ...offer.map((c) => c.kind)]));
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
  offerDraft(run);
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
export const canUndo = (run: Run) => run.phase === 'playing' && !!run.current?.history.length;

export function undo(run: Run) {
  const cur = run.current;
  if (!canUndo(run) || !cur) return false;
  cur.state = JSON.parse(cur.history.pop()!);
  DEFS[cur.card.kind].afterUndo?.(cur.state);
  return true;
}

export const canHint = (run: Run) =>
  run.phase === 'playing' && !!run.current && (run.hints > 0 || run.current.freeHints > 0) && run.current.card.kind !== 'echo' && DEFS[run.current.card.kind].canHint?.(run.current.state) !== false;

export function hint(run: Run) {
  const cur = run.current;
  if (!canHint(run) || !cur) return false;
  const before = JSON.stringify(cur.state);
  if (!DEFS[cur.card.kind].hint(cur.state)) return false;
  if (DEFS[cur.card.kind].undo) cur.history.push(before);
  if (cur.freeHints > 0) cur.freeHints--, cur.freeUsed++;
  else run.hints--;
  cur.hintsUsed++;
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
  if (def.solved(cur.state)) end(run, 'solved');
  else if (def.failed?.(cur.state)) end(run, 'failed');
}

function pointsFor(run: Run, cur: Current) {
  const base = POINTS_PER_LEVEL * (cur.card.level + 1) + (cur.timeLeftMs ? Math.floor(cur.timeLeftMs / 1000) * POINTS_PER_SECOND : 0);
  const afterHints = Math.max(MIN_POINTS, base - HINT_COST * (cur.hintsUsed - cur.freeUsed));
  const charm = holdsCharm(run, cur.card.kind) ? CHARM_POINTS : 1;
  return Math.round(afterHints * charm * (1 + STREAK_STEP * Math.min(run.streak, STREAK_CAP)));
}

function end(run: Run, reason: EndReason) {
  const cur = run.current!;
  const solved = reason === 'solved';
  const points = solved && run.mode !== 'practice' && run.mode !== 'duel' ? pointsFor(run, cur) : 0;
  const result: Result = { card: cur.card, reason, ms: cur.elapsedMs, points };
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
    run.hearts--;
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
      const card = run.queue.shift()!;
      const after = run.queue[run.queue.length - 1]?.kind ?? card.kind;
      run.queue.push(randomCard(run.mode === 'blitz' ? blitzLevel(run.solved) : endlessLevel(run.dealt + QUEUE), [after]));
      deal(run, card);
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
      if (run.last?.reason === 'solved' && run.solved % RELIC_EVERY === 0) {
        run.relicOffer = offerRelics(run);
        run.phase = 'relic';
      } else offerDraft(run);
      return true;
    case 'practice':
      deal(run, { ...run.current!.card, seed: newSeed() });
      return true;
  }
}

/**
 * The relics offered: one charm the run doesn't hold yet (while any is left) and general relics
 * for the rest. A second Crystal Ball would do nothing (`DRAFT_MAX`), so it is offered once.
 */
export function offerRelics(run: Run): RelicId[] {
  const charms = RELICS.filter((r) => isCharm(r) && !run.relics.includes(r));
  const general = GENERAL_RELICS.filter((r) => r !== 'crystal' || !run.relics.includes('crystal'));
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

