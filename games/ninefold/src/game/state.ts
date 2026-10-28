import { byDifficulty } from '../../../../shared/settings';
import { RELICS, STYLES, TWISTS, type Level, type RelicId, type StyleId, type Twist } from './catalog';
import { dailySeed, makePuzzle, peersOf, seeded, SHAPES, shuffle, units, type Puzzle, type Random } from './sudoku';

// Ninefold's rules: Classic (a daily puzzle and free play at three levels) and Delve (a run of
// ever bigger puzzles with hearts and relics), and the progress that unlocks the art styles.
// The scene calls the actions below and reads `GameState`; nothing here knows about Phaser.

/** Givens on a Classic 9x9 board at each level. */
export const CLASSIC_GIVENS: Record<Level, number> = { easy: 40, normal: 32, hard: 26 };
/** The daily puzzle is a Normal board. */
export const DAILY_LEVEL: Level = 'normal';
/** Hints a Classic board starts with (hub difficulty: Easy, Normal, Hard). */
export const classicHints = () => byDifficulty(5, 3, 2);
/** Hearts a Delve run starts with (hub difficulty: Easy, Normal, Hard). */
export const delveHearts = () => byDifficulty(4, 3, 2);
/** Hints a Delve run starts with; the Lantern adds more. */
export const DELVE_HINTS = 1;
/** The most hearts the Heartstone can raise a run to. */
export const MAX_HEARTS = 5;
/** Relics offered after a cleared floor. */
export const RELIC_OFFER = 3;
/** Cells each Seer's Eye fills in at the start of a floor. */
export const SEER_CELLS = 2;
/** A 9x9 solved within this much game time unlocks Neon Arcade. */
export const FAST_MS = 10 * 60_000;
/** Delve floors from this one count as hard puzzles. */
export const HARD_FLOOR = 6;

/** The board size and givens of each Delve floor; from floor 6 on every floor is the last row's. */
export const FLOORS: { size: 4 | 6 | 9; givens: number }[] = [
  { size: 4, givens: 7 },
  { size: 6, givens: 18 },
  { size: 6, givens: 15 },
  { size: 9, givens: 38 },
  { size: 9, givens: 33 },
  { size: 9, givens: 28 },
];
export const floorSpec = (floor: number) => FLOORS[Math.min(floor, FLOORS.length) - 1];
/** Past the last row of `FLOORS`, a floor loses one more given every this many floors, down to `MIN_GIVENS`. */
export const DEEPER_EVERY = 3;
export const MIN_GIVENS = 24;
/** Floors from this one draw a twist (`TWISTS`). */
export const TWIST_FLOOR = 4;
/** Every this many floors is a boss floor: two twists, fewer givens, and clearing it restores every heart. */
export const BOSS_EVERY = 5;
export const BOSS_GIVENS = 3;
/** Givens a twist takes away, since its rule tells the solver more. */
export const TWIST_GIVENS: Record<Twist, number> = { diagonal: 2, parity: 6, clock: 0, sealed: 0 };
/** On a Clock floor a heart is lost every this much game time. */
export const CLOCK_MS = 3 * 60_000;

/** What a Delve floor will be: its board size, givens, twists and whether it is a boss floor. */
export interface FloorPlan {
  floor: number;
  size: 4 | 6 | 9;
  givens: number;
  twists: Twist[];
  boss: boolean;
}

/** Plans a floor. Floors before `TWIST_FLOOR` use no randomness, so the first floors deal as before. */
export function planFloor(floor: number, random: Random): FloorPlan {
  const spec = floorSpec(floor);
  const deeper = Math.max(0, Math.floor((floor - FLOORS.length) / DEEPER_EVERY));
  let givens = Math.max(MIN_GIVENS, spec.givens - deeper);
  if (spec.size !== 9) givens = spec.givens;
  const boss = floor % BOSS_EVERY === 0;
  let twists: Twist[] = [];
  if (floor >= TWIST_FLOOR) {
    if (boss) {
      // One twist on the board's rules and one that presses the player.
      twists = [pick(['diagonal', 'parity'] as const, random), pick(['clock', 'sealed'] as const, random)];
      givens -= BOSS_GIVENS;
    } else twists = [pick(TWISTS, random)];
  }
  for (const tw of twists) givens -= TWIST_GIVENS[tw];
  return { floor, size: spec.size, givens, twists, boss };
}

const pick = <T>(items: readonly T[], random: Random) => items[Math.floor(random() * items.length)];

export type Mode = 'classic' | 'daily' | 'delve';
export type Phase = 'menu' | 'playing' | 'solved' | 'relic' | 'over';

/** What a player has done across every board, saved by `save.ts`. */
export interface Progress {
  solved: number;
  flawless: number;
  noHint: number;
  hard: number;
  fast: number;
  bestFloor: number;
  /** Delve boss floors cleared. */
  bosses: number;
  /** The date (`dailySeed`) of the last daily puzzle solved. */
  daily: number;
  style: StyleId;
  unlocked: StyleId[];
}

export const newProgress = (): Progress => ({ solved: 0, flawless: 0, noHint: 0, hard: 0, fast: 0, bestFloor: 0, bosses: 0, daily: 0, style: 'paper', unlocked: ['paper'] });

/** When each style unlocks, from the progress. Stained Glass waits for every other one. */
export const UNLOCKS: Record<StyleId, (p: Progress) => boolean> = {
  paper: () => true,
  garden: (p) => p.solved >= 3,
  chalk: (p) => p.flawless >= 1,
  parchment: (p) => p.solved >= 10,
  pixel: (p) => p.noHint >= 1,
  stars: (p) => p.hard >= 1,
  stone: (p) => p.solved >= 25,
  neon: (p) => p.fast >= 1,
  glass: (p) => STYLES.every((s) => s === 'glass' || p.unlocked.includes(s)),
};

export type GameEvent =
  | { type: 'board' }
  | { type: 'placed'; cell: number }
  | { type: 'wrong'; cell: number; heart: boolean; warded: boolean }
  | { type: 'clock' }
  | { type: 'unit'; cells: number[] }
  | { type: 'solved' }
  | { type: 'over' }
  | { type: 'unlocked'; style: StyleId }
  | { type: 'relic'; relic: RelicId }
  | { type: 'hint'; cell: number };

export interface GameState {
  phase: Phase;
  mode: Mode;
  level: Level;
  puzzle: Puzzle | null;
  /** What is in each cell: the givens, then what the player entered (right or wrong), 0 if empty. */
  values: number[];
  /** Pencil marks per cell, as a bit per digit (bit d for digit d). */
  notes: number[];
  selected: number;
  notesMode: boolean;
  mistakes: number;
  hintsLeft: number;
  hintsUsed: number;
  /** Game time spent on this board, in ms. */
  timeMs: number;
  hearts: number;
  maxHearts: number;
  floor: number;
  /** The Delve floor in play (or, between floors, the one just cleared). */
  plan: FloorPlan | null;
  /** The next Delve floor, planned when a floor is cleared so its card can name it. */
  upcoming: FloorPlan | null;
  /** The date (`dailySeed`) the daily board in play was dealt for, 0 for any other board. */
  dailyDate: number;
  relics: RelicId[];
  relicOffer: RelicId[];
  /** The Ward has caught a mistake on this floor already. */
  warded: boolean;
  /** Units (as indexes into `units`) already complete, so each one is celebrated once. */
  doneUnits: number[];
  /** Styles unlocked by the last board solved. */
  newStyles: StyleId[];
  progress: Progress;
  events: GameEvent[];
}

export function newGame(progress: Progress): GameState {
  return {
    phase: 'menu', mode: 'classic', level: 'easy', puzzle: null, values: [], notes: [], selected: -1, notesMode: false,
    mistakes: 0, hintsLeft: 0, hintsUsed: 0, timeMs: 0, hearts: 0, maxHearts: 0, floor: 0, plan: null, upcoming: null, dailyDate: 0, relics: [], relicOffer: [],
    warded: false, doneUnits: [], newStyles: [], progress, events: [],
  };
}

function load(s: GameState, puzzle: Puzzle) {
  s.puzzle = puzzle;
  s.values = puzzle.solution.map((v, i) => (puzzle.givens[i] ? v : 0));
  s.notes = s.values.map(() => 0);
  s.selected = -1;
  s.notesMode = false;
  s.mistakes = 0;
  s.hintsUsed = 0;
  s.timeMs = 0;
  s.warded = false;
  s.newStyles = [];
  markDone(s);
  s.phase = 'playing';
  s.events.push({ type: 'board' });
}

/** Starts a Classic board at a level. */
export function startClassic(s: GameState, level: Level, random: Random = Math.random) {
  s.mode = 'classic';
  s.level = level;
  s.dailyDate = 0;
  s.plan = s.upcoming = null;
  load(s, makePuzzle(SHAPES[9], CLASSIC_GIVENS[level], random));
  s.hintsLeft = classicHints();
}

/** Starts today's daily puzzle: the same board for everyone on that date. */
export function startDaily(s: GameState, date: Date) {
  s.mode = 'daily';
  s.level = DAILY_LEVEL;
  s.plan = s.upcoming = null;
  s.dailyDate = dailySeed(date);
  load(s, makePuzzle(SHAPES[9], CLASSIC_GIVENS[DAILY_LEVEL], seeded(s.dailyDate)));
  s.hintsLeft = classicHints();
}

/** Starts a Delve run on floor 1. */
export function startDelve(s: GameState) {
  s.mode = 'delve';
  s.dailyDate = 0;
  s.floor = 0;
  s.relics = [];
  s.maxHearts = s.hearts = delveHearts();
  s.hintsLeft = DELVE_HINTS;
  s.upcoming = planFloor(1, Math.random);
  nextFloor(s);
}

function nextFloor(s: GameState) {
  const plan = s.upcoming ?? planFloor(s.floor + 1, Math.random);
  s.floor = plan.floor;
  s.plan = plan;
  s.upcoming = null;
  s.relicOffer = [];
  const shape = { ...SHAPES[plan.size], ...(plan.twists.includes('diagonal') ? { diagonal: true } : {}) };
  load(s, makePuzzle(shape, plan.givens, Math.random, plan.twists.includes('parity')));
  // Each Seer's Eye fills in a few cells, picked at random, before play starts.
  const seers = s.relics.filter((r) => r === 'seer').length * SEER_CELLS;
  const empty = s.values.flatMap((v, i) => (v ? [] : [i]));
  for (let k = 0; k < seers && empty.length > 1; k++) {
    const cell = empty.splice(Math.floor(Math.random() * empty.length), 1)[0];
    fill(s, cell);
  }
  // The Seer's cells are givens for the player, so a unit they complete is not celebrated.
  markDone(s);
}

/** Records every unit that is already complete, without celebrating it. */
function markDone(s: GameState) {
  const p = s.puzzle!;
  s.doneUnits = units(p).flatMap((u, i) => (u.every((c) => s.values[c] === p.solution[c]) ? [i] : []));
}

/** Picks a cell, or none with -1. */
export function select(s: GameState, cell: number) {
  if (s.phase !== 'playing') return;
  s.selected = cell;
}

export function toggleNotes(s: GameState) {
  if (s.phase === 'playing') s.notesMode = !s.notesMode;
}

/** Whether the selected cell can take a digit: empty, or holding a wrong one. */
export function canEnter(s: GameState) {
  const p = s.puzzle;
  return s.phase === 'playing' && !!p && s.selected >= 0 && !p.givens[s.selected] && s.values[s.selected] !== p.solution[s.selected];
}

/** Puts the right digit in a cell, clears its notes and that digit from its peers' notes. */
function fill(s: GameState, cell: number) {
  const p = s.puzzle!;
  const d = p.solution[cell];
  s.values[cell] = d;
  s.notes[cell] = 0;
  for (const q of peersOf(p)[cell]) s.notes[q] &= ~(1 << d);
}

/**
 * Enters a digit in the selected cell, or toggles it as a note in notes mode. A wrong digit
 * stays, shown wrong, and counts a mistake; in Delve it costs a heart unless the Ward catches it.
 */
export function enter(s: GameState, digit: number) {
  const p = s.puzzle;
  if (!p || !canEnter(s) || digit < 1 || digit > p.size) return false;
  const cell = s.selected;
  if (s.notesMode) {
    if (s.values[cell]) return false;
    s.notes[cell] ^= 1 << digit;
    return true;
  }
  if (digit === p.solution[cell]) {
    fill(s, cell);
    s.events.push({ type: 'placed', cell });
    afterFill(s);
    return true;
  }
  if (s.values[cell] === digit) return false;
  s.values[cell] = digit;
  s.mistakes++;
  let heart = false;
  let warded = false;
  if (s.mode === 'delve') {
    if (s.relics.includes('ward') && !s.warded) s.warded = warded = true;
    else (s.hearts--, (heart = true));
  }
  s.events.push({ type: 'wrong', cell, heart, warded });
  if (s.mode === 'delve' && s.hearts <= 0) runOver(s);
  return true;
}

function runOver(s: GameState) {
  s.phase = 'over';
  s.progress.bestFloor = Math.max(s.progress.bestFloor, s.floor - 1);
  s.events.push({ type: 'over' });
}

/** Whether a Delve twist is on the floor in play. */
export const hasTwist = (s: GameState, twist: Twist) => s.mode === 'delve' && !!s.plan?.twists.includes(twist);

/** Game time left on a Clock floor before the next heart is lost. */
export const clockLeft = (s: GameState) => CLOCK_MS - (s.timeMs % CLOCK_MS);

/** Clears a wrong digit from the selected cell, or, if it holds none, its notes; false if there was nothing to clear. */
export function erase(s: GameState) {
  if (!canEnter(s)) return false;
  const cell = s.selected;
  if (s.values[cell]) s.values[cell] = 0;
  else if (s.notes[cell]) s.notes[cell] = 0;
  else return false;
  return true;
}

/** Fills in the selected cell (or the first open one) with its digit, using up a hint. */
export function hint(s: GameState) {
  const p = s.puzzle;
  if (!p || s.phase !== 'playing' || s.hintsLeft <= 0 || hasTwist(s, 'sealed')) return false;
  const open = (c: number) => c >= 0 && !p.givens[c] && s.values[c] !== p.solution[c];
  const cell = open(s.selected) ? s.selected : s.values.findIndex((_, c) => open(c));
  if (cell < 0) return false;
  s.hintsLeft--;
  s.hintsUsed++;
  fill(s, cell);
  s.selected = cell;
  s.events.push({ type: 'hint', cell });
  afterFill(s);
  return true;
}

function afterFill(s: GameState) {
  const p = s.puzzle!;
  units(p).forEach((u, i) => {
    if (!s.doneUnits.includes(i) && u.every((c) => s.values[c] === p.solution[c])) {
      s.doneUnits.push(i);
      s.events.push({ type: 'unit', cells: u });
    }
  });
  if (s.values.every((v, i) => v === p.solution[i])) solved(s);
}

function solved(s: GameState) {
  const p = s.progress;
  p.solved++;
  if (s.mistakes === 0) p.flawless++;
  if (s.hintsUsed === 0) p.noHint++;
  if ((s.mode === 'classic' && s.level === 'hard') || (s.mode === 'delve' && s.floor >= HARD_FLOOR)) p.hard++;
  if (s.puzzle!.size === 9 && s.timeMs <= FAST_MS) p.fast++;
  if (s.mode === 'daily') p.daily = s.dailyDate;
  if (s.mode === 'delve') p.bestFloor = Math.max(p.bestFloor, s.floor);
  s.selected = -1;
  s.events.push({ type: 'solved' });
  s.newStyles = unlock(p);
  for (const style of s.newStyles) s.events.push({ type: 'unlocked', style });
  if (s.mode === 'delve') {
    // A Sealed floor pays back a hint, and a boss floor restores every heart.
    if (hasTwist(s, 'sealed')) s.hintsLeft++;
    if (s.plan?.boss) {
      p.bosses++;
      s.hearts = s.maxHearts;
    }
    s.upcoming = planFloor(s.floor + 1, Math.random);
    s.phase = 'relic';
    s.relicOffer = shuffle([...RELICS], Math.random).slice(0, RELIC_OFFER);
  } else s.phase = 'solved';
}

/** Unlocks every style whose goal is now met, in order (Stained Glass last), and returns them. */
export function unlock(p: Progress) {
  const fresh: StyleId[] = [];
  for (const style of STYLES) {
    if (!p.unlocked.includes(style) && UNLOCKS[style](p)) {
      p.unlocked.push(style);
      fresh.push(style);
    }
  }
  return fresh;
}

/** Takes a relic after a cleared Delve floor and goes down to the next floor. */
export function takeRelic(s: GameState, relic: RelicId) {
  if (s.phase !== 'relic' || !s.relicOffer.includes(relic)) return;
  s.relics.push(relic);
  if (relic === 'lantern') s.hintsLeft++;
  if (relic === 'heartstone') {
    s.maxHearts = Math.min(MAX_HEARTS, s.maxHearts + 1);
    s.hearts = Math.min(s.maxHearts, s.hearts + 1);
  }
  s.events.push({ type: 'relic', relic });
  nextFloor(s);
}

/** Wears a style, if it is unlocked. */
export function chooseStyle(s: GameState, style: StyleId) {
  if (!s.progress.unlocked.includes(style)) return false;
  s.progress.style = style;
  return true;
}

export function toMenu(s: GameState) {
  s.phase = 'menu';
  s.puzzle = null;
  s.selected = -1;
}

/** Moves the board's clock on while a board is being played. */
export function tick(s: GameState, dt: number) {
  if (s.phase !== 'playing') return;
  const before = Math.floor(s.timeMs / CLOCK_MS);
  s.timeMs += dt;
  if (hasTwist(s, 'clock') && Math.floor(s.timeMs / CLOCK_MS) > before) {
    s.hearts--;
    s.events.push({ type: 'clock' });
    if (s.hearts <= 0) runOver(s);
  }
}

/** Whether a cell is right: a given or a correct entry. */
export const isRight = (s: GameState, cell: number) => !!s.puzzle && s.values[cell] === s.puzzle.solution[cell];

/** How many of each digit are placed right, to grey out the number pad's finished digits. */
export function digitsLeft(s: GameState) {
  const p = s.puzzle;
  if (!p) return [];
  const left = Array.from({ length: p.size + 1 }, () => p.size);
  s.values.forEach((v, i) => v === p.solution[i] && left[v]--);
  return left;
}

