import { BOON_IDS, BUILDING_IDS, type BoonId, type Village } from './state';

// The most nights kept, the best peril multiplier, the moths' flights, the harbour's boon and the village are saved;
// every game starts at the first dusk.
const KEY = 'lanternkeep-best';
const PERIL_KEY = 'lanternkeep-best-peril';

function load(key: string, floor: number) {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) && value > floor ? value : floor;
  } catch {
    return floor;
  }
}

function save(key: string, value: number | string) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage can be full or blocked (private mode); the game keeps running unsaved.
  }
}

export const loadBest = () => Math.floor(load(KEY, 0));
export const saveBest = (best: number) => save(KEY, best);
/** The best pay multiplier reached with curses taken after the Festival (1 when none). */
export const loadBestPeril = () => load(PERIL_KEY, 1);
export const saveBestPeril = (mult: number) => save(PERIL_KEY, mult);

const FLOWN_KEY = 'lanternkeep-moths';
const BOON_KEY = 'lanternkeep-boon';

/** The flights each place in the jar has ever flown (LK16), kept from game to game. */
export function loadFlown(): number[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(FLOWN_KEY) ?? '[]');
    return Array.isArray(value) ? value.map((n) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)) : [];
  } catch {
    return [];
  }
}
export const saveFlown = (flown: readonly number[]) => {
  try {
    localStorage.setItem(FLOWN_KEY, JSON.stringify(flown));
  } catch {
    // Storage can be blocked; the moths keep their flights for this game only.
  }
};

/** The Harbour Festival's boon (LK15), kept for every later game, or null. */
export function loadBoon(): BoonId | null {
  try {
    const value = localStorage.getItem(BOON_KEY);
    return BOON_IDS.find((id) => id === value) ?? null;
  } catch {
    return null;
  }
}
export const saveBoon = (boon: BoonId) => save(BOON_KEY, boon);

const VILLAGE_KEY = 'lanternkeep-village';

/** The village below the keep (LK18): its houses and buildings, kept from game to game. */
export function loadVillage(): Village {
  try {
    const value = JSON.parse(localStorage.getItem(VILLAGE_KEY) ?? '{}') as { houses?: unknown; built?: unknown };
    const houses = typeof value.houses === 'number' && Number.isFinite(value.houses) && value.houses > 0 ? Math.floor(value.houses) : 0;
    const built = Array.isArray(value.built) ? BUILDING_IDS.filter((id) => (value.built as unknown[]).includes(id)) : [];
    return { houses, built };
  } catch {
    return { houses: 0, built: [] };
  }
}
export const saveVillage = (village: Village) => save(VILLAGE_KEY, JSON.stringify(village));
