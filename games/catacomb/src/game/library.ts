import { CARDS, baseOf, isCurse, type BaseId, type CardId } from './cards';
import { HERO_IDS, type HeroId } from './heroes';

// Each hero's library: every card that hero has ever added to a deck (a reward or a purchase), kept
// across runs. Before a run of one's own, up to LIBRARY_SWAPS starting cards can be swapped for
// library cards, one copy of each.

/** How many starting cards can be swapped for library cards before a run. */
export const LIBRARY_SWAPS = 3;

/** The cards each hero has added to a deck, in the order first found; never a curse, never tempered. */
export type Library = Record<HeroId, BaseId[]>;

const KEY = 'catacomb-library';

/** A card id this build knows and a library may hold: an id from another version (a progress code from a newer build) or a curse is dropped. */
const known = (c: unknown): c is BaseId => typeof c === 'string' && Object.hasOwn(CARDS, c) && !isCurse(c as BaseId);

export function loadLibrary(): Library {
  const lib = Object.fromEntries(HERO_IDS.map((id) => [id, [] as BaseId[]])) as Library;
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (saved && typeof saved === 'object') {
      for (const id of HERO_IDS) {
        const cards = (saved as Record<string, unknown>)[id];
        if (Array.isArray(cards)) lib[id] = [...new Set(cards.filter(known))];
      }
    }
  } catch {
    // A broken or blocked record starts over.
  }
  return lib;
}

function saveLibrary(lib: Library) {
  try {
    localStorage.setItem(KEY, JSON.stringify(lib));
  } catch {
    // Storage can be full or blocked; the game keeps running unsaved.
  }
}

/** Puts a card the hero just added to their deck into their library (once), and saves it. */
export function addToLibrary(lib: Library, hero: HeroId, id: CardId) {
  const base = baseOf(id);
  if (isCurse(base) || lib[hero].includes(base)) return;
  lib[hero] = [...lib[hero], base];
  saveLibrary(lib);
}
