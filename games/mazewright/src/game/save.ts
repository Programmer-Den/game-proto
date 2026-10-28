import { MAPS } from './maps';
import { REPLAY_VERSION, type Action, type Replay } from './sim';
import { ALWAYS, DEFAULT_POUCH, FREE, MODES, POUCH_PICKS, SEEDS, SLOT_SEEDS, TOWERS, type Mode, type TowerKind } from './rules';

// Mazewright keeps eight keys: each garden's records (best wave, win, stars, best time, Endless
// best), the towers picked for the pouch, whether waves wait to be started (calm), whether two
// gardeners play (duo), the way of play
// picked (mode), the potting shed (seeds, the towers and master levels bought, extra slots),
// each garden's latest win to watch again (replays) and the game in play, kept at its last break
// between waves as a replay of everything done so far (game). Both replay keys end in `-replays`,
// so progress files carry them and progress codes, too small for them, leave them out.
const KEY = 'mazewright-best';
const POUCH_KEY = 'mazewright-pouch';
const CALM_KEY = 'mazewright-calm';
const DUO_KEY = 'mazewright-duo';
const MODE_KEY = 'mazewright-mode';
const SHED_KEY = 'mazewright-shed';
const REPLAY_KEY = 'mazewright-replays';
const GAME_KEY = 'mazewright-game-replays';

function loadFlag(key: string) {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function saveFlag(key: string, on: boolean) {
  try {
    localStorage.setItem(key, on ? '1' : '0');
  } catch {
    // Storage can be full or blocked; the choice holds until the page is closed.
  }
}

/** Calm: waves come only when started, with no wave timer. */
export const loadCalm = () => loadFlag(CALM_KEY);
export const saveCalm = (calm: boolean) => saveFlag(CALM_KEY, calm);
/** Two gardeners share the screen. */
export const loadDuo = () => loadFlag(DUO_KEY);
export const saveDuo = (duo: boolean) => saveFlag(DUO_KEY, duo);

/**
 * Per garden: the best wave reached and whether it was won (Classic or Swarm), the most stars, the
 * fastest win in seconds of game time (0 for none) and the most waves held in Endless.
 */
export interface GardenRecord {
  wave: number;
  won: boolean;
  stars: number;
  time: number;
  endless: number;
}
export type Records = Record<string, GardenRecord>;

const count = (v: unknown) => (Number.isFinite(v) && (v as number) > 0 ? Math.floor(v as number) : 0);

export function loadRecords(): Records {
  const records: Records = {};
  for (const m of MAPS) records[m.id] = { wave: 0, won: false, stars: 0, time: 0, endless: 0 };
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    for (const m of MAPS) {
      const r = saved?.[m.id];
      if (!r) continue;
      const into = records[m.id];
      into.wave = count(r.wave);
      into.won = r.won === true;
      into.stars = Math.min(4, count(r.stars) || (into.won ? 1 : 0));
      into.time = count(r.time);
      into.endless = count(r.endless);
    }
  } catch {
    // A broken or blocked save starts fresh.
  }
  return records;
}

/** Merges a game's result into a garden's record, keeping the best of each; saves only when something changed. */
export function noteRecord(records: Records, mapId: string, result: Partial<GardenRecord>) {
  const r = records[mapId];
  if (!r) return;
  const before = JSON.stringify(r);
  r.wave = Math.max(r.wave, result.wave ?? 0);
  r.won ||= !!result.won;
  r.stars = Math.max(r.stars, result.stars ?? 0);
  if (result.time) r.time = r.time ? Math.min(r.time, result.time) : result.time;
  r.endless = Math.max(r.endless, result.endless ?? 0);
  if (JSON.stringify(r) === before) return;
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
  } catch {
    // Storage can be full or blocked (private mode); the game keeps running unsaved.
  }
}

/** The way of play picked on the garden picker. */
export function loadMode(): Mode {
  try {
    const saved = localStorage.getItem(MODE_KEY);
    return MODES.includes(saved as Mode) ? (saved as Mode) : 'classic';
  } catch {
    return 'classic';
  }
}

export function saveMode(mode: Mode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Storage can be full or blocked; the choice holds until the page is closed.
  }
}

/** The potting shed: seeds to spend, the towers and master levels bought, and pouch slots bought (0 to 2). */
export interface Shed {
  seeds: number;
  owned: TowerKind[];
  masters: TowerKind[];
  slots: number;
}

const kindsIn = (v: unknown) => (Array.isArray(v) ? TOWERS.filter((k) => v.includes(k)) : []);

/**
 * The shed as saved. A first load (no key yet) credits the gardens already played: what each would
 * have paid, so a player from before the shed starts with seeds for what they have done.
 */
export function loadShed(records: Records): Shed {
  try {
    const saved = JSON.parse(localStorage.getItem(SHED_KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      return { seeds: count(saved.seeds), owned: kindsIn(saved.owned), masters: kindsIn(saved.masters), slots: Math.min(SLOT_SEEDS.length, count(saved.slots)) };
    }
  } catch {
    // A broken or blocked save starts with an empty shed.
  }
  let seeds = 0;
  for (const r of Object.values(records)) {
    if (r.won) seeds += SEEDS.win + SEEDS.star * r.stars;
    else if (r.wave > 0) seeds += SEEDS.loss + Math.floor(r.wave / SEEDS.waves);
  }
  return { seeds, owned: [], masters: [], slots: 0 };
}

export function saveShed(shed: Shed) {
  try {
    localStorage.setItem(SHED_KEY, JSON.stringify(shed));
  } catch {
    // Storage can be full or blocked; the shed holds until the page is closed.
  }
}

/** Whether a tower may go in the pouch: free, or bought. */
export const usable = (shed: Shed, kind: TowerKind) => FREE.includes(kind) || shed.owned.includes(kind);
/** How many towers may be picked besides hedge and bow. */
export const picksOf = (shed: Shed) => POUCH_PICKS + shed.slots;

/** The towers picked for the pouch: hedge and bow, then up to `picksOf(shed)` more, in tower order. */
export function loadPouch(shed: Shed): TowerKind[] {
  try {
    const saved = JSON.parse(localStorage.getItem(POUCH_KEY) ?? 'null');
    if (Array.isArray(saved)) return pouchOf(saved.filter((k): k is TowerKind => TOWERS.includes(k)), shed);
  } catch {
    // A broken or blocked save keeps today's four.
  }
  return [...DEFAULT_POUCH];
}

export function savePouch(pouch: TowerKind[]) {
  try {
    localStorage.setItem(POUCH_KEY, JSON.stringify(pouch));
  } catch {
    // Storage can be full or blocked; the pick still holds until the page is closed.
  }
}

/** A pouch made from a list of kinds: hedge and bow first, then the usable rest in tower order, as many as the shed allows. */
export function pouchOf(kinds: TowerKind[], shed: Shed): TowerKind[] {
  const picks = TOWERS.filter((k) => !ALWAYS.includes(k) && kinds.includes(k) && usable(shed, k)).slice(0, picksOf(shed));
  return [...ALWAYS, ...picks];
}

/** Each garden's latest win (Classic or Swarm), to watch again, by garden. */
export type Replays = Record<string, Replay>;

const ACTIONS: readonly Action['a'][] = ['build', 'upgrade', 'sell', 'turn', 'aim', 'wave'];
const whole = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;
/** Whether a logged action can be played: a known action at a step, on a cell, with a tower that exists. */
const playable = (a: Action) =>
  a && ACTIONS.includes(a.a) && whole(a.s) && (a.c === undefined || whole(a.c)) && (a.k === undefined || TOWERS.includes(a.k));

/** Whether a saved replay is one this version can play: its own rules version, a known way of play and playable actions. */
function valid(r: Replay, map: string) {
  return (
    r && r.v === REPLAY_VERSION && r.map === map && MODES.includes(r.mode) && Array.isArray(r.log) && r.log.every(playable) &&
    Number.isFinite(r.seed) && Number.isFinite(r.steps) && Number.isFinite(r.toughness) && whole(r.lives) && r.lives > 0 &&
    (r.masters === null || (Array.isArray(r.masters) && r.masters.every((k) => TOWERS.includes(k))))
  );
}

export function loadReplays(): Replays {
  const replays: Replays = {};
  try {
    const saved = JSON.parse(localStorage.getItem(REPLAY_KEY) ?? 'null');
    for (const m of MAPS) {
      const r = saved?.[m.id];
      if (valid(r, m.id)) replays[m.id] = r;
    }
  } catch {
    // A broken or blocked save has no replays; one from other rules, or a broken one, is dropped above.
  }
  return replays;
}

/** Keeps `replay` as its garden's latest win. */
export function saveReplay(replays: Replays, replay: Replay) {
  replays[replay.map] = replay;
  try {
    localStorage.setItem(REPLAY_KEY, JSON.stringify(replays));
  } catch {
    // Storage can be full or blocked; the replay holds until the page is closed.
  }
}

/** The game in play, saved in a break between waves: its replay so far, its pouch and the wave it is at. */
export interface SavedGame extends Replay {
  pouch: TowerKind[];
  wave: number;
}

export function loadGame(): SavedGame | null {
  try {
    const saved = JSON.parse(localStorage.getItem(GAME_KEY) ?? 'null');
    if (saved && MAPS.some((m) => m.id === saved.map) && valid(saved, saved.map) && Array.isArray(saved.pouch) && saved.pouch.every((k: TowerKind) => TOWERS.includes(k)) && whole(saved.wave)) return saved;
  } catch {
    // A broken or blocked save, or one from other rules, starts at the garden picker.
  }
  return null;
}

/** Keeps the game in play, or drops it (null) once it is over or another is started. */
export function saveGame(game: SavedGame | null) {
  try {
    if (game) localStorage.setItem(GAME_KEY, JSON.stringify(game));
    else localStorage.removeItem(GAME_KEY);
  } catch {
    // Storage can be full or blocked; the game goes on unsaved.
  }
}
