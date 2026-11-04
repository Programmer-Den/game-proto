// The best wave reached, the Admiralty's medals, the ship last chosen, the captain's log, the
// best Storm Reaches wave and the harbor wall of sea beasts are kept; every run starts afresh at wave 1.
import { BEAST_KINDS, emptyWall, type Wall } from './beasts';
import { CAPTAIN_IDS, type CaptainId } from './captains';
import { FIRST_HULL, HULLS, type HullId } from './hulls';
import { REACHES_WAVES } from './waves';

const KEY = 'broadside-best-wave';
const MEDALS_KEY = 'broadside-medals';
const HULL_KEY = 'broadside-ship';
const LOG_KEY = 'broadside-log';
const REACHES_KEY = 'broadside-reaches-best';
const WALL_KEY = 'broadside-beasts';

/** A stored count, or 0 for anything missing, hand-edited or broken. */
function load(key: string) {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function save(key: string, n: number) {
  try {
    localStorage.setItem(key, String(n));
  } catch {
    // Storage can be full or blocked (private mode); the game keeps running unsaved.
  }
}

export const loadBestWave = () => load(KEY);
export const saveBestWave = (wave: number) => save(KEY, wave);
export const loadMedals = () => load(MEDALS_KEY);
/** The best Storm Reaches wave, at most their last (a record saved past it after sailing on reads as the Tempest's). */
export const loadReachesBest = () => Math.min(REACHES_WAVES, load(REACHES_KEY));
export const saveReachesBest = (wave: number) => save(REACHES_KEY, wave);
export const saveMedals = (medals: number) => save(MEDALS_KEY, medals);

/** The ship chosen last, or the Frigate for anything missing or unknown. */
export function loadHull(): HullId {
  try {
    const id = localStorage.getItem(HULL_KEY);
    // Own keys only: `in` would also accept 'constructor' or 'toString' from Object.prototype.
    return id !== null && Object.hasOwn(HULLS, id) ? (id as HullId) : FIRST_HULL;
  } catch {
    return FIRST_HULL;
  }
}
export function saveHull(id: HullId) {
  try {
    localStorage.setItem(HULL_KEY, id);
  } catch {
    // Unsaved, as above.
  }
}

/** The captain's log: the named captains ever sunk or taken. Anything unknown or broken is left out. */
export function loadLog(): CaptainId[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]');
    return Array.isArray(value) ? CAPTAIN_IDS.filter((id) => value.includes(id)) : [];
  } catch {
    return [];
  }
}
export function saveLog(log: CaptainId[]) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    // Unsaved, as above.
  }
}

/** The harbor wall: how many of each sea beast were ever sunk. Anything missing or broken counts 0. */
export function loadWall(): Wall {
  const wall = emptyWall();
  try {
    const value: unknown = JSON.parse(localStorage.getItem(WALL_KEY) ?? '{}');
    if (value && typeof value === 'object') {
      for (const kind of BEAST_KINDS) {
        const n = Number((value as Record<string, unknown>)[kind]);
        wall[kind] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
      }
    }
  } catch {
    // A broken record counts as an empty wall.
  }
  return wall;
}
export function saveWall(wall: Wall) {
  try {
    localStorage.setItem(WALL_KEY, JSON.stringify(wall));
  } catch {
    // Unsaved, as above.
  }
}
