import type { BaseId, CardId } from './cards';
import type { EnemyKind, Intent, StatusKind } from './enemies';
import type { FlaskId } from './flasks';
import type { DailyRecord } from '../../../../shared/daily';
import type { HeroId, HeroWins } from './heroes';
import type { Library } from './library';
import type { WeeklyRecord } from './weekly';
import type { Room } from './map';
import type { RelicId } from './relics';

// Everything about a run, as plain data: the hero, the deck, where on the map they are, and the
// fight in progress. The playthrough test reads it through `window.game`.

export const ENERGY = 3;
export const HAND_SIZE = 5;
/** Resting at a campfire heals this share of the hero's health. */
export const REST_HEAL = 0.3;
/** A campfire can only take a card out of a deck bigger than this. */
export const MIN_DECK = 5;
/** How many cards a reward offers. */
export const REWARD_CHOICES = 3;

/** Gold at the start of a run. */
export const START_GOLD = 0;
/** What the merchant asks for a card, by rarity, a relic and taking a card out of the deck. */
export const CARD_PRICE = { common: 30, rare: 65 };
export const RELIC_PRICE = 80;
export const REMOVE_PRICE = 40;
/** How many cards of each rarity, how many relics and how many flasks the merchant lays out. */
export const SHOP_CARDS = { common: 2, rare: 1 };
export const SHOP_RELICS = 2;
export const SHOP_FLASKS = 2;
/** Gold found instead of a relic once every relic is owned. */
export const RELIC_GOLD = 50;
/** An attack by someone Weak, and an attack on someone Vulnerable, has its damage multiplied by these (rounded down). */
export const WEAK_MULT = 0.75;
export const VULNERABLE_MULT = 1.5;

/** Game time, in milliseconds, between one foe's action and the next on their turn. */
export const ENEMY_ACT_MS = 600;
/** The pause after the last foe falls, before the reward. */
export const CLEARED_MS = 900;
/** How long the hero takes to walk from one room to the next on the map. */
export const WALK_MS = 700;
/** How long a hit flash and a floating number last. */
export const HIT_MS = 300;
export const POP_MS = 900;

export type Phase =
  /** Choosing the hero (and the depth) before the first room. */
  | 'hero'
  /** Swapping starting cards for library cards, once the hero has a library. */
  | 'library'
  /** Choosing the next room on the map. */
  | 'map'
  /** Walking to the room picked. */
  | 'walk'
  /** The hero's turn in a fight: play cards, then end the turn. */
  | 'player'
  /** The foes act, one after another. */
  | 'enemy'
  /** The last foe fell; the reward comes up shortly. */
  | 'cleared'
  /** Picking a card to add to the deck, after a fight or in a treasure room. */
  | 'reward'
  /** At a campfire: rest to heal, temper a card or take a card out of the deck. */
  | 'rest'
  /** At the merchant's: buy cards, relics or a card's removal, then leave. */
  | 'shop'
  /** In a mystery room: pick one of two choices. */
  | 'event'
  /** The first act's boss fell: descend to the next act. */
  | 'descend'
  | 'over'
  | 'won';

/** Statuses on the hero or a foe, in turns (Weak, Vulnerable) or in damage (Poison); 0 is none. */
export type Status = Record<StatusKind, number>;

export const noStatus = (): Status => ({ weak: 0, vulnerable: 0, poison: 0 });

/** One of the merchant's wares and whether it is sold. */
export interface Ware<T> {
  id: T;
  price: number;
  sold: boolean;
}

export interface Shop {
  cards: Ware<BaseId>[];
  relics: Ware<RelicId>[];
  flasks: Ware<FlaskId>[];
  removePrice: number;
  /** The merchant takes one card out of the deck per visit. */
  removed: boolean;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  block: number;
  /** Added to the damage of each of its hits. */
  strength: number;
  status: Status;
  /** How many times it has acted. */
  step: number;
  /** What it will do when it next acts, shown over its head. */
  intent: Intent;
  hitMs: number;
  /** Counts down while it lunges at the hero. */
  actMs: number;
}

export interface Fight {
  draw: CardId[];
  hand: CardId[];
  discard: CardId[];
  energy: number;
  block: number;
  turn: number;
  /** Left to right; the first is in front and takes single-target attacks. */
  enemies: Enemy[];
  /** How many foes have acted so far on their turn. */
  acted: number;
  /** The hero's statuses. */
  status: Status;
  /** Added to the damage of each of the hero's hits (Battle Rage). */
  strength: number;
  /** The power cards played this fight; they stay in play and leave no pile. */
  powers: CardId[];
  /** How many cards the hero has played this turn (Doubt makes the first dearer). */
  played: number;
  /** How many cards have been drawn this fight (the draw sound listens to it). */
  drawn: number;
  /** How many pairs of tonics have combined in hand this fight (the brew sound listens to it). */
  brewed: number;
  /** Whether the hero was Vulnerable when the turn ended: Vulnerable put on during the foes' turn starts wearing off the round after. */
  wasVulnerable: boolean;
  /** The gold the foes leave behind once they all fall. */
  gold: number;
}

/** A number that floats up from the hero or a foe: damage, block or healing. */
export interface Pop {
  id: number;
  /** A foe's id, or 'hero'. */
  on: number | 'hero';
  text: string;
  kind: 'damage' | 'block' | 'heal' | 'status';
  ms: number;
}

export interface GameState {
  phase: Phase;
  /** Which hero is played. */
  hero: HeroId;
  /** How deep the run goes: 0 is the game as designed, each depth adds a rule (see `depth.ts`). */
  depth: number;
  /** The deepest depth unlocked so far, saved in the browser. */
  bestDepth: number;
  /** The deepest depth each hero has beaten, saved in the browser; it unlocks the Hexer. */
  heroWins: HeroWins;
  /** The day (`YYYY-MM-DD`) when this run is that day's daily crypt, or null for a run of one's own. */
  daily: string | null;
  /** Today's daily crypt as saved: whether it was tried, its score, the best and the streak. */
  dailyRecord: DailyRecord;
  /** The week (its Monday, `YYYY-MM-DD`) when this run is that week's weekly crypt, or null. */
  weekly: string | null;
  /** This week's weekly crypt as saved: the best score and the tries. */
  weeklyRecord: WeeklyRecord;
  /** The daily's or the weekly's score once it ends, null before. */
  dailyScore: number | null;
  /** Each hero's library, saved in the browser: every card they have added to a deck. */
  library: Library;
  /** The starting cards swapped for library cards before this run: where in the deck, and what was there. */
  swaps: { at: number; was: CardId }[];
  /** The flasks held, up to FLASK_SLOTS. */
  flasks: FlaskId[];
  /** Which act the hero is in, from 1. */
  act: number;
  /** This act's map, drawn by makeMap. */
  rooms: Room[];
  hp: number;
  maxHp: number;
  /** Every card the hero owns; each fight shuffles a copy into the draw pile. */
  deck: CardId[];
  gold: number;
  /** The relics owned, in the order found. */
  relics: RelicId[];
  /** The room the hero is in, or null at the entrance. */
  at: number | null;
  /** Rooms done, in the order visited. */
  cleared: number[];
  walk: { from: number | null; to: number; ms: number } | null;
  fight: Fight | null;
  /** The cards offered, while picking a reward. */
  reward: CardId[] | null;
  /** Whether the reward offers rare cards (a treasure chest, an elite or the altar) or common ones. */
  rewardRare: boolean;
  /** The gold the last fight left behind, shown with its reward. */
  goldWon: number;
  /** The flask the last elite left behind, shown with its reward. */
  flaskWon: FlaskId | null;
  /** The merchant's wares, while in a shop. */
  shop: Shop | null;
  /** What the last event, purchase or descent did, shown on the map until the hero walks on. */
  notice: string;
  /** Counts down the foes' turn and the pause after a fight. */
  timerMs: number;
  heroHitMs: number;
  /** How much the last rest healed. */
  healed: number;
  pops: Pop[];
  nextId: number;
}
