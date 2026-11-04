import { byDifficulty } from '../../../../shared/settings';
import { BOARD_TWISTS, MAX_ASCENT, PALETTE_STYLES, PRESSING_TWISTS, RELICS, STYLES, TWISTS, UNIQUE_RELICS, type Level, type RelicId, type StyleId, type Twist } from './catalog';
import { LESSONS, lessonPuzzle } from './lessons';
import { dailySeed, EXTRAS, makePuzzle, nextDay, peersOf, seeded, SHAPES, shuffle, units, type Extra, type Puzzle, type Random } from './sudoku';
import { candidates, explain, TECHNIQUES, type Technique } from './techniques';

// Ninefold's rules: Classic (a daily puzzle, the weekly gauntlet and free play at eight levels),
// Delve (a run of ever bigger puzzles with hearts and relics, at up to five ascensions), the
// technique school's lessons, and the progress that unlocks the art styles and stamps the calendar.
// The scene calls the actions below and reads `GameState`; nothing here knows about Phaser.

/** Givens on a Classic 9x9 board at each level. */
export const CLASSIC_GIVENS: Record<Level, number> = { easy: 40, normal: 32, hard: 26, killer: 16, thermo: 24, arrow: 18, kropki: 14, sandwich: 20 };
/** The extra rule a Classic level's boards carry. */
export const LEVEL_EXTRA: Partial<Record<Level, Extra>> = { killer: 'killer', thermo: 'thermo', arrow: 'arrow', kropki: 'kropki', sandwich: 'sandwich' };
/** How long the panel names the technique a hint used, in game time. */
export const HINT_NOTE_MS = 6_000;
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
/** Right digits in a row (no mistake between) for each Gambler's Die to pay a hint. */
export const GAMBLER_STREAK = 8;
/** A floor cleared within this much game time heals a heart per Sandglass. */
export const SANDGLASS_MS = 4 * 60_000;
/** Hearts the Iron Vow adds (up to `MAX_HEARTS`); it takes every hint. */
export const VOW_HEARTS = 2;
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
export const TWIST_GIVENS: Record<Twist, number> = { diagonal: 2, parity: 6, killer: 14, thermo: 6, arrow: 8, kropki: 14, sandwich: 6, clock: 0, sealed: 0 };
/** On a Clock floor a heart is lost every this much game time. */
export const CLOCK_MS = 3 * 60_000;
/** Clearing this Delve floor at the highest ascension open opens the next one. */
export const ASCEND_FLOOR = 10;
/** Givens every floor loses from Ascension 3. */
export const ASCENT_GIVENS = 2;
/** The ascension each rule starts at (`ASCENSION_RULES` in `catalog.ts`). */
export const ASCENT = { hearts: 1, hint: 2, givens: 3, notes: 4, offer: 5 } as const;

/**
 * The weekly gauntlet: one 9x9 board for each day of the week, Monday first, the same for every
 * player that week. Each scores once, on the day it is dealt, and the week's scores add up.
 */
export const GAUNTLET: { givens: number; twist?: (typeof BOARD_TWISTS)[number] }[] = [
  { givens: 40 },
  { givens: 30, twist: 'diagonal' },
  { givens: 24, twist: 'thermo' },
  { givens: 26, twist: 'parity' },
  { givens: 16, twist: 'killer' },
  { givens: 26 },
  { givens: 12, twist: 'killer' },
];
/** A gauntlet board's score: this much, less per mistake, per hint and per second taken, but at least the floor. */
export const GAUNTLET_SCORE = { base: 1000, mistake: 100, hint: 150, perSecond: 1 / 6, floor: 100 };

/** A gauntlet board's score from its mistakes, hints and time. */
export function gauntletScore(mistakes: number, hints: number, timeMs: number) {
  const g = GAUNTLET_SCORE;
  return Math.max(g.floor, Math.round(g.base - g.mistake * mistakes - g.hint * hints - g.perSecond * Math.floor(timeMs / 1000)));
}

/** The day of the week, Monday 0 to Sunday 6. */
export const weekDay = (date: Date) => (date.getDay() + 6) % 7;
/** The week's seed: the `dailySeed` of its Monday. */
export const weekSeed = (date: Date) => dailySeed(new Date(date.getFullYear(), date.getMonth(), date.getDate() - weekDay(date)));

/** This week's gauntlet scores as they stand on a date: -1 for a day not played. */
export function weekScores(p: Progress, date: Date) {
  return p.week === weekSeed(date) ? p.weekScores : GAUNTLET.map(() => -1);
}

/** What a Delve floor will be: its board size, givens, twists and whether it is a boss floor. */
export interface FloorPlan {
  floor: number;
  size: 4 | 6 | 9;
  givens: number;
  twists: Twist[];
  boss: boolean;
}

/** Plans a floor. Floors before `TWIST_FLOOR` use no randomness, so the first floors deal as before. */
export function planFloor(floor: number, random: Random, ascent = 0): FloorPlan {
  const spec = floorSpec(floor);
  const deeper = Math.max(0, Math.floor((floor - FLOORS.length) / DEEPER_EVERY));
  let givens = Math.max(MIN_GIVENS, spec.givens - deeper);
  if (spec.size !== 9) givens = spec.givens;
  if (ascent >= ASCENT.givens) givens -= ASCENT_GIVENS;
  const boss = floor % BOSS_EVERY === 0;
  let twists: Twist[] = [];
  if (floor >= TWIST_FLOOR) {
    if (boss) {
      // One twist on the board's rules and one that presses the player.
      twists = [pick(BOARD_TWISTS, random), pick(PRESSING_TWISTS, random)];
      givens -= BOSS_GIVENS;
    } else twists = [pick(TWISTS, random)];
  }
  for (const tw of twists) givens -= TWIST_GIVENS[tw];
  return { floor, size: spec.size, givens, twists, boss };
}

const pick = <T>(items: readonly T[], random: Random) => items[Math.floor(random() * items.length)];

export type Mode = 'classic' | 'daily' | 'weekly' | 'delve' | 'lesson';
/** `lesson` is a lesson's opening card, over its board, before play starts. */
export type Phase = 'menu' | 'lesson' | 'playing' | 'solved' | 'relic' | 'over';

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
  /** Daily puzzles solved on days in a row, ending with `daily`, and the longest such run. */
  dailyStreak: number;
  bestStreak: number;
  /** One more than the highest ascension whose floor `ASCEND_FLOOR` was cleared (0: none yet). */
  climbed: number;
  /** The week (`weekSeed`) `weekScores` are for, each day's gauntlet score (-1 not played), and the best week's total. */
  week: number;
  weekScores: number[];
  bestWeek: number;
  /** Every daily solved, by the date it was dealt for (`dailySeed`), oldest first: the calendar's stamps. */
  dailyDays: number[];
  /** The school's lessons stamped. */
  lessons: Technique[];
  style: StyleId;
  unlocked: StyleId[];
}

export const newProgress = (): Progress => ({ solved: 0, flawless: 0, noHint: 0, hard: 0, fast: 0, bestFloor: 0, bosses: 0, daily: 0, dailyStreak: 0, bestStreak: 0, climbed: 0, week: 0, weekScores: GAUNTLET.map(() => -1), bestWeek: 0, dailyDays: [], lessons: [], style: 'paper', unlocked: ['paper'] });

/** The highest Delve ascension open. */
export const ascensionOpen = (p: Progress) => Math.min(MAX_ASCENT, p.climbed);

/** When each style unlocks, from the progress. Stained Glass waits for every other one but the Almanac. */
export const UNLOCKS: Record<StyleId, (p: Progress) => boolean> = {
  paper: () => true,
  garden: (p) => p.solved >= 3,
  chalk: (p) => p.flawless >= 1,
  parchment: (p) => p.solved >= 10,
  pixel: (p) => p.noHint >= 1,
  stars: (p) => p.hard >= 1,
  stone: (p) => p.solved >= 25,
  neon: (p) => p.fast >= 1,
  glass: (p) => PALETTE_STYLES.every((s) => s === 'glass' || p.unlocked.includes(s)),
  almanac: (p) => fullMonths(p.dailyDays) >= 1,
};

/** How many days a month has (`month` from 0). */
export const daysIn = (year: number, month: number) => new Date(year, month + 1, 0).getDate();

/** How many calendar months have every day's daily solved. */
export function fullMonths(days: number[]) {
  const perMonth = new Map<number, number>();
  for (const d of days) {
    const month = Math.floor(d / 100);
    perMonth.set(month, (perMonth.get(month) ?? 0) + 1);
  }
  let full = 0;
  for (const [month, n] of perMonth) if (n >= daysIn(Math.floor(month / 100), (month % 100) - 1)) full++;
  return full;
}

/** The days of a month (`month` from 0) whose daily was solved, by day of the month. */
export const stampedDays = (p: Progress, year: number, month: number) =>
  new Set(p.dailyDays.filter((d) => Math.floor(d / 100) === year * 100 + month + 1).map((d) => d % 100));

export type GameEvent =
  | { type: 'board' }
  | { type: 'placed'; cell: number }
  | { type: 'wrong'; cell: number; heart: boolean; warded: boolean }
  | { type: 'clock' }
  | { type: 'phoenix' }
  | { type: 'heal' }
  | { type: 'gift' }
  | { type: 'unit'; cells: number[] }
  | { type: 'solved' }
  | { type: 'ascended'; ascent: number }
  | { type: 'over' }
  | { type: 'unlocked'; style: StyleId }
  | { type: 'relic'; relic: RelicId }
  | { type: 'hint'; cell: number }
  | { type: 'learned'; lesson: Technique };

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
  /** The gauntlet board in play: its week (`weekSeed`) and day (Monday 0). */
  week: number;
  weekDay: number;
  /** The last gauntlet board's score, and the week's total with it. */
  score: number;
  weekTotal: number;
  /** The Delve run's ascension (0 for none), and the one its last cleared floor opened (0 if none). */
  ascent: number;
  ascended: number;
  relics: RelicId[];
  relicOffer: RelicId[];
  /** The Ward has caught a mistake on this floor already. */
  warded: boolean;
  /** Right digits written since the last mistake, for the Gambler's Die. */
  streak: number;
  /** Hearts the Keystone has given back on this floor. */
  keyHealed: number;
  /** What Undo can take back, newest last: a cell's digit and notes before a note, a wrong digit or an erase. */
  undo: { cell: number; value: number; notes: number }[];
  /** Units (as indexes into `units`) already complete, so each one is celebrated once. */
  doneUnits: number[];
  /** Styles unlocked by the last board solved. */
  newStyles: StyleId[];
  /** The lesson in play (an index into `LESSONS`), -1 for none. */
  lesson: number;
  /** The technique the last hint used (`revealed` when none found it), and the board time it was given at. */
  hintNote: Technique | 'revealed' | null;
  hintAt: number;
  progress: Progress;
  events: GameEvent[];
}

export function newGame(progress: Progress): GameState {
  return {
    phase: 'menu', mode: 'classic', level: 'easy', puzzle: null, values: [], notes: [], selected: -1, notesMode: false,
    mistakes: 0, hintsLeft: 0, hintsUsed: 0, timeMs: 0, hearts: 0, maxHearts: 0, floor: 0, plan: null, upcoming: null, dailyDate: 0, week: 0, weekDay: 0, score: 0, weekTotal: 0, ascent: 0, ascended: 0, relics: [], relicOffer: [],
    warded: false, streak: 0, keyHealed: 0, undo: [], doneUnits: [], newStyles: [], lesson: -1, hintNote: null, hintAt: 0, progress, events: [],
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
  s.keyHealed = 0;
  s.undo = [];
  s.newStyles = [];
  s.lesson = -1;
  s.hintNote = null;
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
  load(s, makePuzzle(SHAPES[9], CLASSIC_GIVENS[level], random, LEVEL_EXTRA[level]));
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

/**
 * Starts today's gauntlet board, if it hasn't been played: the same board for everyone on that
 * day of that week. Starting it uses up the day's try, scored 0 until it is solved.
 */
export function startWeekly(s: GameState, date: Date) {
  const p = s.progress;
  const day = weekDay(date);
  if (weekScores(p, date)[day] >= 0) return false;
  if (p.week !== weekSeed(date)) {
    p.week = weekSeed(date);
    p.weekScores = GAUNTLET.map(() => -1);
  }
  p.weekScores[day] = 0;
  const g = GAUNTLET[day];
  s.mode = 'weekly';
  s.level = 'normal';
  s.plan = s.upcoming = null;
  s.dailyDate = 0;
  s.week = p.week;
  s.weekDay = day;
  const shape = { ...SHAPES[9], ...(g.twist === 'diagonal' ? { diagonal: true } : {}) };
  load(s, makePuzzle(shape, g.givens, seeded(p.week * 10 + day), extraOf(g.twist ? [g.twist] : [])));
  s.hintsLeft = classicHints();
  return true;
}

/** The extra board rule among a floor's twists, if any. */
const extraOf = (twists: readonly Twist[]): Extra | undefined => twists.find((tw): tw is Extra => (EXTRAS as readonly string[]).includes(tw));

/**
 * Opens a lesson of the technique school: its board with every empty cell's candidates noted,
 * under the card that explains the technique (`phase` `lesson`; `beginLesson` starts play).
 */
export function startLesson(s: GameState, index: number) {
  const lesson = LESSONS[index];
  if (!lesson) return false;
  s.mode = 'lesson';
  s.level = 'normal';
  s.dailyDate = 0;
  s.plan = s.upcoming = null;
  load(s, lessonPuzzle(lesson));
  s.lesson = index;
  s.hintsLeft = 1;
  s.notes = candidates(s.puzzle!, s.values);
  s.phase = 'lesson';
  return true;
}

/** Leaves a lesson's opening card for its board. */
export function beginLesson(s: GameState) {
  if (s.phase === 'lesson') s.phase = 'playing';
}

/** The lesson in play, if any. */
export const lessonOf = (s: GameState) => (s.mode === 'lesson' ? LESSONS[s.lesson] : undefined);

/** Starts a Delve run on floor 1, at an ascension that is open (0 for none). */
export function startDelve(s: GameState, ascent = 0) {
  s.mode = 'delve';
  s.dailyDate = 0;
  s.floor = 0;
  s.relics = [];
  s.streak = 0;
  s.ascent = Math.max(0, Math.min(ascent, ascensionOpen(s.progress)));
  s.ascended = 0;
  s.maxHearts = s.hearts = Math.max(1, delveHearts() - (s.ascent >= ASCENT.hearts ? 1 : 0));
  s.hintsLeft = s.ascent >= ASCENT.hint ? 0 : DELVE_HINTS;
  s.upcoming = planFloor(1, Math.random, s.ascent);
  nextFloor(s);
}

function nextFloor(s: GameState) {
  const plan = s.upcoming ?? planFloor(s.floor + 1, Math.random, s.ascent);
  s.floor = plan.floor;
  s.plan = plan;
  s.upcoming = null;
  s.relicOffer = [];
  const shape = { ...SHAPES[plan.size], ...(plan.twists.includes('diagonal') ? { diagonal: true } : {}) };
  load(s, makePuzzle(shape, plan.givens, Math.random, extraOf(plan.twists)));
  // Each Seer's Eye fills in a few cells, picked at random, before play starts.
  const seers = s.relics.filter((r) => r === 'seer').length * SEER_CELLS;
  const empty = s.values.flatMap((v, i) => (v ? [] : [i]));
  for (let k = 0; k < seers && empty.length > 1; k++) {
    const cell = empty.splice(Math.floor(Math.random() * empty.length), 1)[0];
    fill(s, cell);
  }
  // The Seer's cells are givens for the player, so a unit they complete is not celebrated.
  markDone(s);
  // Twin Sight pencils in every empty cell's candidates.
  if (s.relics.includes('twin')) {
    const peers = peersOf(s.puzzle!);
    s.values.forEach((v, i) => {
      if (v) return;
      let used = 0;
      for (const q of peers[i]) if (isRight(s, q)) used |= 1 << s.values[q];
      for (let d = 1; d <= s.puzzle!.size; d++) if (!(used & (1 << d))) s.notes[i] |= 1 << d;
    });
  }
}

const count = (s: GameState, relic: RelicId) => s.relics.filter((r) => r === relic).length;

/** Heals up to `n` hearts, no higher than the run's most. */
function heal(s: GameState, n: number) {
  const before = s.hearts;
  s.hearts = Math.min(s.maxHearts, s.hearts + n);
  if (s.hearts > before) s.events.push({ type: 'heal' });
}

/** Takes hearts; at none a Phoenix Feather, if held, burns for one, or the run ends. */
function loseHearts(s: GameState, n: number) {
  s.hearts -= n;
  if (s.hearts > 0) return;
  const feather = s.relics.indexOf('phoenix');
  if (feather >= 0) {
    s.relics.splice(feather, 1);
    s.hearts = 1;
    s.events.push({ type: 'phoenix' });
  } else runOver(s);
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

/** Whether notes are locked: a Delve run at Ascension 4 or higher. */
export const notesLocked = (s: GameState) => s.mode === 'delve' && s.ascent >= ASCENT.notes;

/** Switches notes mode; false when notes are locked. */
export function toggleNotes(s: GameState) {
  if (s.phase !== 'playing' || notesLocked(s)) return false;
  s.notesMode = !s.notesMode;
  return true;
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
    remember(s, cell);
    s.notes[cell] ^= 1 << digit;
    return true;
  }
  if (digit === p.solution[cell]) {
    fill(s, cell);
    s.events.push({ type: 'placed', cell });
    s.streak++;
    const dice = count(s, 'gambler');
    if (s.mode === 'delve' && dice && s.streak % GAMBLER_STREAK === 0) {
      s.hintsLeft += dice;
      s.events.push({ type: 'gift' });
    }
    afterFill(s);
    return true;
  }
  if (s.values[cell] === digit) return false;
  remember(s, cell);
  s.values[cell] = digit;
  s.mistakes++;
  s.streak = 0;
  let heart = false;
  let warded = false;
  if (s.mode === 'delve') {
    if (s.relics.includes('ward') && !s.warded) s.warded = warded = true;
    else heart = true;
  }
  s.events.push({ type: 'wrong', cell, heart, warded });
  // Each Gambler's Die makes a mistake that costs a heart cost one more.
  if (heart) loseHearts(s, 1 + count(s, 'gambler'));
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
  if (!s.values[cell] && !s.notes[cell]) return false;
  remember(s, cell);
  if (s.values[cell]) s.values[cell] = 0;
  else s.notes[cell] = 0;
  return true;
}

/** The most steps Undo keeps. */
const UNDO_STEPS = 200;

function remember(s: GameState, cell: number) {
  s.undo.push({ cell, value: s.values[cell], notes: s.notes[cell] });
  if (s.undo.length > UNDO_STEPS) s.undo.shift();
}

/** Whether Undo has a step to take back: one whose cell isn't right by now. */
export const canUndo = (s: GameState) => s.phase === 'playing' && s.undo.some((u) => !isRight(s, u.cell));

/**
 * Takes back the latest note, wrong digit or erase, restoring that cell's digit and notes. A
 * right digit stays (it is right), so steps on cells filled since are skipped; a mistake still
 * counts and its heart stays lost.
 */
export function undoMove(s: GameState) {
  if (s.phase !== 'playing') return false;
  while (s.undo.length) {
    const u = s.undo.pop()!;
    if (isRight(s, u.cell)) continue;
    s.values[u.cell] = u.value;
    s.notes[u.cell] = u.notes;
    s.selected = u.cell;
    return true;
  }
  return false;
}

/** The daily streak as it stands today: kept while the last daily solved was today or yesterday. */
export function dailyStreakNow(p: Progress, today: number) {
  return p.daily === today || nextDay(p.daily) === today ? p.dailyStreak : 0;
}

/**
 * Fills in the selected cell (or, with none picked, the easiest cell to place by logic, else the
 * first open one) with its digit, using up a hint, and names the technique that places it
 * (`hintNote`; `revealed` when no technique in `TECHNIQUES` gets there).
 */
export function hint(s: GameState) {
  const p = s.puzzle;
  if (!p || s.phase !== 'playing' || s.hintsLeft <= 0 || hasTwist(s, 'sealed')) return false;
  const open = (c: number) => c >= 0 && !p.givens[c] && s.values[c] !== p.solution[c];
  const grid = s.values.map((v, i) => (v === p.solution[i] ? v : 0));
  const picked = open(s.selected) ? s.selected : -1;
  const step = explain(p, grid, picked);
  const cell = picked >= 0 ? picked : step ? step.cell : s.values.findIndex((_, c) => open(c));
  if (cell < 0) return false;
  s.hintsLeft--;
  s.hintsUsed++;
  fill(s, cell);
  s.selected = cell;
  s.hintNote = step ? step.technique : 'revealed';
  s.hintAt = s.timeMs;
  s.events.push({ type: 'hint', cell });
  afterFill(s);
  return true;
}

function afterFill(s: GameState) {
  const p = s.puzzle!;
  // A lesson ends once its target cell holds its digit.
  const lesson = lessonOf(s);
  if (lesson && isRight(s, lesson.target)) return learned(s, lesson.id);
  units(p).forEach((u, i) => {
    if (!s.doneUnits.includes(i) && u.every((c) => s.values[c] === p.solution[c])) {
      s.doneUnits.push(i);
      s.events.push({ type: 'unit', cells: u });
      // Each Keystone gives back a heart for one finished box a floor (boxes follow the rows and columns).
      const box = i >= 2 * p.size && i < 3 * p.size;
      if (box && s.mode === 'delve' && s.keyHealed < count(s, 'keystone')) {
        s.keyHealed++;
        heal(s, 1);
      }
    }
  });
  if (s.values.every((v, i) => v === p.solution[i])) solved(s);
}

/** Stamps a lesson in the school and shows its card. */
function learned(s: GameState, lesson: Technique) {
  const p = s.progress;
  if (!p.lessons.includes(lesson)) p.lessons = TECHNIQUES.filter((t) => t === lesson || p.lessons.includes(t));
  s.selected = -1;
  s.phase = 'solved';
  s.events.push({ type: 'learned', lesson });
}

function solved(s: GameState) {
  const p = s.progress;
  p.solved++;
  if (s.mistakes === 0) p.flawless++;
  if (s.hintsUsed === 0) p.noHint++;
  if ((s.mode === 'classic' && s.level === 'hard') || (s.mode === 'delve' && s.floor >= HARD_FLOOR)) p.hard++;
  if (s.puzzle!.size === 9 && s.timeMs <= FAST_MS) p.fast++;
  if (s.mode === 'daily') {
    p.dailyStreak = p.daily && nextDay(p.daily) === s.dailyDate ? p.dailyStreak + 1 : 1;
    p.bestStreak = Math.max(p.bestStreak, p.dailyStreak);
    p.daily = s.dailyDate;
    // The calendar's stamp for the day.
    if (!p.dailyDays.includes(s.dailyDate)) p.dailyDays = [...p.dailyDays, s.dailyDate].sort((a, b) => a - b);
  }
  if (s.mode === 'weekly') {
    s.score = gauntletScore(s.mistakes, s.hintsUsed, s.timeMs);
    // A board finished after its week ended still counts for its own week, if that is the one kept.
    if (p.week === s.week) {
      p.weekScores[s.weekDay] = s.score;
      s.weekTotal = p.weekScores.reduce((t, v) => t + Math.max(0, v), 0);
      p.bestWeek = Math.max(p.bestWeek, s.weekTotal);
    } else s.weekTotal = s.score;
  }
  if (s.mode === 'delve') p.bestFloor = Math.max(p.bestFloor, s.floor);
  s.ascended = 0;
  if (s.mode === 'delve' && s.floor === ASCEND_FLOOR && s.ascent >= p.climbed) {
    p.climbed = s.ascent + 1;
    if (p.climbed <= MAX_ASCENT) {
      s.ascended = p.climbed;
      s.events.push({ type: 'ascended', ascent: p.climbed });
    }
  }
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
    if (s.timeMs <= SANDGLASS_MS) heal(s, count(s, 'sandglass'));
    s.upcoming = planFloor(s.floor + 1, Math.random, s.ascent);
    s.phase = 'relic';
    // Twin Sight's notes are no use once notes are locked.
    const pool = RELICS.filter((r) => !(UNIQUE_RELICS.includes(r) && s.relics.includes(r)) && !(r === 'twin' && notesLocked(s)));
    s.relicOffer = shuffle(pool, Math.random).slice(0, s.ascent >= ASCENT.offer ? RELIC_OFFER - 1 : RELIC_OFFER);
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
  if (relic === 'twin') {
    s.maxHearts = Math.max(1, s.maxHearts - 1);
    s.hearts = Math.min(s.maxHearts, s.hearts);
  }
  if (relic === 'vow') {
    s.maxHearts = Math.min(MAX_HEARTS, s.maxHearts + VOW_HEARTS);
    s.hearts = Math.min(s.maxHearts, s.hearts + VOW_HEARTS);
    s.hintsLeft = 0;
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
    s.events.push({ type: 'clock' });
    loseHearts(s, 1);
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

