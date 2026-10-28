// What a playthrough of Bramblecrest knows: where the knight is, their hearts and things, the
// moonstones found, the quest they are on and every flag the world has set. Saved to the browser
// whenever the knight changes place or the quest moves on.

import { byDifficulty } from '../../../../shared/settings';
import { isMapId, type Facing, type ItemId, type MapId } from './maps';
import type { TextKey } from '../i18n';
import { formatNumber } from '../../../../shared/i18n';

export const SAVE_KEY = 'bramblecrest-save';

/** Health is counted in half hearts. */
export const START_HEARTS = byDifficulty(5, 3, 2);
/** Moonstones hidden in the first chapter, and in the first two together. */
export const CHAPTER_ONE_STONES = 8;
export const MOONSTONES = 13;
/** The most bellseeds the knight can carry. */
export const MAX_SEEDS = 10;

/** The quest line of the first two chapters, in order. */
export const QUESTS = ['start', 'blade', 'thorns', 'shrine', 'return', 'done', 'bell', 'belfry', 'home', 'end'] as const;
export type Quest = (typeof QUESTS)[number];

/** A time on the clock as m:ss.t, with the language's decimal mark. */
export function clock(ms: number) {
  const tenths = Math.floor(ms / 100);
  const m = Math.floor(tenths / 600);
  const sec = (tenths % 600) / 10;
  return `${m}:${formatNumber(sec, { minimumIntegerDigits: 2, minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

/** The text the journal line shows for each step of the quest. */
export const OBJECTIVES: Record<Quest, TextKey> = {
  start: 'objStart',
  blade: 'objBlade',
  thorns: 'objThorns',
  shrine: 'objShrine',
  return: 'objReturn',
  done: 'objDone',
  bell: 'objBell',
  belfry: 'objBelfry',
  home: 'objHome',
  end: 'objEnd',
};

/** Whether the quest has reached `q`. */
export function reached(s: GameState, q: Quest) {
  return QUESTS.indexOf(s.quest) >= QUESTS.indexOf(q);
}

/** How many moonstones there are to find so far: the second chapter's show up once it starts. */
export function stonesToFind(s: GameState) {
  return reached(s, 'bell') ? MOONSTONES : CHAPTER_ONE_STONES;
}

export interface GameState {
  map: MapId;
  /** Where the knight is, in pixels, and which way they face. */
  x: number;
  y: number;
  facing: Facing;
  /** Where the knight wakes after a fall: the tile they last entered this map on. */
  spawn: { map: MapId; x: number; y: number; facing: Facing };
  hp: number;
  maxHp: number;
  items: { sword: boolean; hookvine: boolean; oil: boolean; seeds: boolean };
  keys: number;
  /** Bellseeds carried. */
  seeds: number;
  moonstones: string[];
  flags: string[];
  quest: Quest;
  /** Times the knight has fallen. */
  falls: number;
  /** Foes beaten, for the chapter's end card. */
  beaten: number;
  /** The best time of each dungeon's hourglass trial, in ms of play. */
  trials: Partial<Record<MapId, number>>;
}

export function newState(): GameState {
  const spawn = { map: 'village' as MapId, x: 25.5 * 32, y: 19.5 * 32, facing: 'down' as Facing };
  return {
    map: spawn.map,
    x: spawn.x,
    y: spawn.y,
    facing: spawn.facing,
    spawn,
    hp: START_HEARTS * 2,
    maxHp: START_HEARTS * 2,
    items: { sword: false, hookvine: false, oil: false, seeds: false },
    keys: 0,
    seeds: 0,
    moonstones: [],
    flags: [],
    quest: 'start',
    falls: 0,
    beaten: 0,
    trials: {},
  };
}

export function hasFlag(s: GameState, flag: string) {
  return s.flags.includes(flag);
}

export function setFlag(s: GameState, flag: string) {
  if (!s.flags.includes(flag)) s.flags.push(flag);
}

/** Moves the quest on to `q`, never back. */
export function advance(s: GameState, q: Quest) {
  if (QUESTS.indexOf(q) > QUESTS.indexOf(s.quest)) s.quest = q;
}

/** Gives the knight a thing found in a chest. */
export function give(s: GameState, item: ItemId) {
  if (item === 'sword') s.items.sword = true;
  else if (item === 'hookvine') s.items.hookvine = true;
  else if (item === 'oil') s.items.oil = true;
  else if (item === 'key') s.keys++;
  else if (item === 'seeds') {
    s.items.seeds = true;
    s.seeds = MAX_SEEDS;
  }
  else if (item === 'heart') {
    s.maxHp += 2;
    s.hp = s.maxHp;
  }
}

export function save(s: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    // Storage can be blocked (private mode); the run lasts until the page closes.
  }
}

/** Whether a saved place is on a map that exists, at a real position. */
function placeOk(p: { map?: unknown; x?: unknown; y?: unknown } | undefined) {
  return !!p && isMapId(p.map) && Number.isFinite(p.x) && Number.isFinite(p.y);
}

/** The saved playthrough, or a new one when there is none (or it can't be read). */
export function load(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<GameState>;
      const fresh = newState();
      if (saved && QUESTS.includes(saved.quest as Quest) && placeOk(saved) && placeOk(saved.spawn ?? fresh.spawn)) return { ...fresh, ...saved, items: { ...fresh.items, ...saved.items } };
    }
  } catch {
    // A broken save starts over.
  }
  return newState();
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
