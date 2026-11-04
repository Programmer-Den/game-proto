import { ALCHEMIST_DECK, HEXER_DECK, HUNTER_DECK, STARTER_DECK, type CardId } from './cards';
import type { FlaskId } from './flasks';
import type { TextKey } from '../i18n';

// The heroes to pick from before the first room. The Knight is the game as it was; the Hunter has
// less health and a deck built on poison and dodging; the Hexer, unlocked by beating depth 2 with
// both of the others, curses foes and hits the cursed ones harder, and finds cards of their own;
// the Alchemist, unlocked by beating the Bone Spire with anyone, brews tonics that combine in hand.

export type HeroId = 'knight' | 'hunter' | 'hexer' | 'alchemist';

export interface Hero {
  /** Its name and caption, keys of `i18n/en.ts`; the caption takes the hero's `{hp}`. */
  name: TextKey;
  hp: number;
  deck: CardId[];
  /** The flask the hero sets out with. */
  flask: FlaskId;
  text: TextKey;
}

export const HEROES: Record<HeroId, Hero> = {
  knight: { name: 'knightName', hp: 50, deck: STARTER_DECK, flask: 'block', text: 'knightText' },
  hunter: { name: 'hunterName', hp: 40, deck: HUNTER_DECK, flask: 'poison', text: 'hunterText' },
  hexer: { name: 'hexerName', hp: 44, deck: HEXER_DECK, flask: 'draw', text: 'hexerText' },
  alchemist: { name: 'alchemistName', hp: 42, deck: ALCHEMIST_DECK, flask: 'heal', text: 'alchemistText' },
};

/** The heroes in the order the hero panel shows them. */
export const HERO_IDS: HeroId[] = ['knight', 'hunter', 'hexer', 'alchemist'];

/** The depth the Knight and the Hunter must each beat to unlock the Hexer. */
export const HEXER_UNLOCK_DEPTH = 2;
/** The depth any hero must win at to unlock the Alchemist: from there the run ends atop the Bone Spire (SPIRE_DEPTH in map.ts). */
export const ALCHEMIST_UNLOCK_DEPTH = 3;

/** The deepest depth each hero has beaten the dungeon at; -1 for never. */
export type HeroWins = Record<HeroId, number>;

const KEY = 'catacomb-heroes';

export function loadHeroWins(): HeroWins {
  const wins: HeroWins = { knight: -1, hunter: -1, hexer: -1, alchemist: -1 };
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (saved && typeof saved === 'object') {
      for (const id of HERO_IDS) {
        const n = (saved as Record<string, unknown>)[id];
        if (typeof n === 'number' && Number.isFinite(n)) wins[id] = Math.floor(n);
      }
    }
  } catch {
    // A broken or blocked record starts over.
  }
  return wins;
}

export function saveHeroWins(wins: HeroWins) {
  try {
    localStorage.setItem(KEY, JSON.stringify(wins));
  } catch {
    // Storage can be full or blocked; the game keeps running unsaved.
  }
}

/** Whether this hero can be picked: the Hexer only once the Knight and the Hunter have each beaten depth 2, the Alchemist once anyone has beaten the Bone Spire. */
export function heroUnlocked(wins: HeroWins, hero: HeroId) {
  if (hero === 'hexer') return wins.knight >= HEXER_UNLOCK_DEPTH && wins.hunter >= HEXER_UNLOCK_DEPTH;
  if (hero === 'alchemist') return HERO_IDS.some((id) => wins[id] >= ALCHEMIST_UNLOCK_DEPTH);
  return true;
}
