import { byDifficulty } from '../../../../shared/settings';
import type { TextKey } from '../i18n';
import type { Cell } from './board';
import { KINDS, type Kind } from './kinds';

// The potion orders, one after another. Each asks for so many of a few ingredients within a number
// of moves, and pays its price plus a bonus for every move left.

export type PotionId =
  | 'healingDraught'
  | 'sleepingTonic'
  | 'mandrakeTincture'
  | 'goldenElixir'
  | 'moonlitPhilter'
  | 'amberCordial'
  | 'starlightElixir'
  | 'philosophersDraught';

/** Each potion's name: its key in `i18n/en.ts` is its id. */
export const POTION_NAMES: Record<PotionId, TextKey> = {
  healingDraught: 'healingDraught',
  sleepingTonic: 'sleepingTonic',
  mandrakeTincture: 'mandrakeTincture',
  goldenElixir: 'goldenElixir',
  moonlitPhilter: 'moonlitPhilter',
  amberCordial: 'amberCordial',
  starlightElixir: 'starlightElixir',
  philosophersDraught: 'philosophersDraught',
};

export type Needs = Partial<Record<Kind, number>>;

/** One stage of a royal commission: a potion and what it needs. */
export interface Stage {
  potion: PotionId;
  needs: Needs;
}

export interface Order {
  /** 1 for the first order. */
  number: number;
  /** The potion being brewed: on a royal commission, the stage's; on a twin order, the first customer's. */
  potion: PotionId;
  /** What is still to gather: the stage's needs on a royal commission, both customers' on a twin order. */
  needs: Needs;
  moves: number;
  /** The price, a rush order's bonus and a second customer's price included. */
  price: number;
  /** A rush order: fewer moves, more coins. */
  rush?: boolean;
  /** An ingredient the order forbids: a swap that matches it costs an extra move. */
  forbid?: Kind;
  /** Corked jars, resin-coated tiles and mouldy tiles on the order's board. */
  jars: number;
  resin: number;
  mould: number;
  /** A royal commission: three stages brewed one after the other on one board, the moves carried over. */
  stages?: Stage[];
  /** The crown's last order: filling it makes the tinker Royal Apothecary. */
  last?: boolean;
  /** A second customer sharing the board and the moves: its potion, its own kinds among `needs` and its price. */
  second?: { potion: PotionId; needs: Needs; price: number };
  /** A rich order, picked on the result card: it pays more for fewer moves or more blockers. */
  rich?: Risk;
  /** A guild examination: its index in `EXAMS` (see exams.ts) and the stars it must be sold with. */
  exam?: { index: number; stars: number };
  /** The walls of a town's board shape (see towns.ts): cells with no tile, which tiles fall past. */
  holes?: Cell[];
  /** A town on the journey map: its index in `TOWNS` (see towns.ts). */
  town?: { index: number };
  /** An order of an endless run, after the guild examinations: its place in the run, from 1. */
  endless?: number;
  /** The daily order: the day it is for and the town whose board shape it borrows. */
  daily?: { day: string; town: number };
  /** A town's rare ingredient: it drops in on this board beside the five everyday ones (see towns.ts). */
  rare?: Kind;
  /** A town's guest, after its own order: the town's index and the guest's board rule (see guests.ts). */
  guest?: { index: number; rule: GuestRule };
  /** The weekly order: the week it is for (its Monday) and the town whose board shape it borrows (see weekly.ts). */
  weekly?: { week: string; town: number };
}

/**
 * A town guest's board rule: the witch turns a tile to a toad after every move, the knight wants it
 * all in ten moves and the miser only pays for what cascades gather.
 */
export type GuestRule = 'witch' | 'knight' | 'miser';

/** The ingredients that drop in on an order's board: the five everyday ones, and a town's rare one. */
export const poolOf = (o: Pick<Order, 'rare'>): readonly Kind[] => (o.rare ? [...KINDS, o.rare] : KINDS);

/** What a rich order risks: fewer moves, or more jars, resin and mould. */
export type Risk = 'moves' | 'blockers';

export type Recipe = Omit<Order, 'number' | 'jars' | 'resin' | 'mould'>;

/** Coins for each move left when an order is filled. */
export const MOVE_BONUS = 5;
/** How much each ingredient asked for and the price grow every time the list comes round again. */
const ROUND_NEEDS = 3;
const ROUND_PRICE = 15;
/** A rush order has this many fewer moves and pays this many more coins. */
export const RUSH_MOVES = 3;
export const RUSH_COINS = 20;
/** The fewest moves an order can give. */
const MIN_MOVES = 5;

/** Every fifth order is a royal commission; mould creeps over boards from this order on. */
export const ROYAL_EVERY = 5;
export const MOULD_FROM = 5;
/** A royal commission's stages ask for this share of a recipe's needs, and it pays this share of their prices... */
const ROYAL_SHARE = 0.5;
/** ...plus this, with this many moves on top of the first stage's recipe for the two stages after it. */
export const ROYAL_COINS = 40;
export const ROYAL_MOVES = 12;
/** A twin order's two customers each ask for this share of their recipe's two biggest needs... */
const TWIN_SHARE = 0.6;
/** ...and the one served first pays this many coins on top. From Journeyman on, every fifth order after the second. */
export const TWIN_BONUS = 20;
export const TWIN_AT = 2;
/** The moves a second customer brings, as a share of its recipe's. */
const TWIN_MOVES = 0.5;
/** A rich order pays this share more, for this many fewer moves or this many more of each blocker. */
export const RICH_SHARE = 0.5;
export const RICH_MOVES = 4;
export const RICH_BLOCKERS = 2;

const ORDERS: Recipe[] = [
  { potion: 'healingDraught', needs: { ember: 12, sage: 12 }, moves: 15, price: 30 },
  { potion: 'sleepingTonic', needs: { moonpetal: 15, wheat: 12 }, moves: 16, price: 35 },
  { potion: 'mandrakeTincture', needs: { mandrake: 14, sage: 12, ember: 10 }, moves: 18, price: 45 },
  { potion: 'goldenElixir', needs: { wheat: 16, ember: 14, moonpetal: 12 }, moves: 20, price: 55 },
  { potion: 'moonlitPhilter', needs: { moonpetal: 20, mandrake: 16, sage: 14 }, moves: 20, price: 70 },
];

/** The recipes the tinker ranks unlock (see ranks.ts); each joins the round of orders once earned. */
export const RANK_RECIPES: Partial<Record<PotionId, Recipe>> = {
  amberCordial: { potion: 'amberCordial', needs: { wheat: 14, mandrake: 12, ember: 12 }, moves: 18, price: 60 },
  starlightElixir: { potion: 'starlightElixir', needs: { moonpetal: 16, sage: 14, wheat: 12 }, moves: 19, price: 75 },
  philosophersDraught: { potion: 'philosophersDraught', needs: { ember: 18, moonpetal: 16, mandrake: 16 }, moves: 22, price: 100 },
};

/** Every recipe there is, the five orders' and the three a rank unlocks: the daily order and endless runs draw on them all. */
export const ALL_RECIPES: Recipe[] = [...ORDERS, ...Object.values(RANK_RECIPES)];

/** True on the orders that are royal commissions (5, 10, 15...). */
export const isRoyal = (number: number) => number % ROYAL_EVERY === 0;
/** True on the orders two customers share, once a recipe is unlocked (Journeyman): 7, 12, 17... */
export const isTwin = (number: number, unlocked: PotionId[]) => unlocked.length > 0 && number > ROYAL_EVERY && number % ROYAL_EVERY === TWIN_AT;

/**
 * The twist on order `number`: none on the first two or on a twin order, then a rush order, one that
 * forbids an ingredient it doesn't need (none if it needs every kind), and a plain one, round and round.
 */
export function twistFor(number: number, needs: Needs, unlocked: PotionId[] = []): Pick<Order, 'rush' | 'forbid'> {
  if (number < 3 || isTwin(number, unlocked)) return {};
  if (number % 3 === 0) return { rush: true };
  if (number % 3 === 1) {
    const spare = KINDS.filter((k) => !(k in needs));
    return spare.length > 0 ? { forbid: spare[number % spare.length] } : {};
  }
  return {};
}

/**
 * The corked jars, resin and mould on order `number`'s board: none on the first, then more as orders
 * go by. Mould starts on order 5 with two patches, one more every five orders.
 */
export const blockersFor = (number: number) => ({
  jars: number < 2 ? 0 : Math.min(3 + Math.floor((number - 2) / 3), 8),
  resin: number < 3 ? 0 : Math.min(4 + Math.floor((number - 3) / 3), 10),
  mould: number < MOULD_FROM ? 0 : Math.min(2 + Math.floor((number - MOULD_FROM) / 5), 5),
});

/** What order `number` risks if it is picked rich: fewer moves on even orders, more blockers on odd ones. */
export const riskFor = (number: number): Risk => (number % 2 === 0 ? 'moves' : 'blockers');

/** `needs` with every count scaled by `share` (at least 1). */
const scaled = (needs: Needs, share: number): Needs =>
  Object.fromEntries(Object.entries(needs).map(([kind, n]) => [kind, Math.max(1, Math.round(n * share))]));

/** The two biggest needs of a recipe, the ones a customer on a twin order keeps. */
const biggest = (needs: Needs, keep: number): Needs =>
  Object.fromEntries(Object.entries(needs).sort(([, a], [, b]) => b - a).slice(0, keep));

/** What the tinker has done so far, as far as the orders care. */
export interface Standing {
  /** The recipes unlocked by rank, in the order they were earned (see ranks.ts). */
  unlocked?: PotionId[];
  /** Moves added to every order by the workbench. */
  extraMoves?: number;
  /** The tinker is already Royal Apothecary: no royal commission is the last one any more. */
  royal?: boolean;
  /** The order was picked rich on the result card (never order 1). */
  rich?: boolean;
}

/**
 * Order `number`, given the recipes unlocked so far: the five orders and then the unlocked recipes,
 * round and round. Needs and price grow every five orders, however many recipes are unlocked. Every
 * fifth order is a royal commission of three stages (the last one, once every recipe is unlocked,
 * ends the game), and from Journeyman on every fifth order after the second serves two customers.
 * A rich order (any but the first) pays half as much again for fewer moves or more blockers.
 */
export function orderFor(number: number, standing: Standing | PotionId[] = {}): Order {
  const { unlocked = [], extraMoves = 0, royal = false, rich = false } = Array.isArray(standing) ? { unlocked: standing } : standing;
  const list = [...ORDERS, ...unlocked.flatMap((p) => (RANK_RECIPES[p] ? [RANK_RECIPES[p]] : []))];
  const round = Math.floor((number - 1) / ORDERS.length);
  const grown = (i: number): Recipe => {
    const base = list[i % list.length];
    const needs = Object.fromEntries(Object.entries(base.needs).map(([kind, n]) => [kind, n + round * ROUND_NEEDS]));
    return { ...base, needs, price: base.price + round * ROUND_PRICE };
  };
  const at = (number - 1) % list.length;
  let recipe = grown(at);
  if (isRoyal(number)) {
    // Three recipes in a row, each at half strength, brewed one after the other on the same board.
    const stages = [0, 1, 2].map((k) => grown(at + k)).map((r) => ({ potion: r.potion, needs: scaled(r.needs, ROYAL_SHARE) }));
    const price = Math.round([0, 1, 2].reduce((sum, k) => sum + grown(at + k).price * ROYAL_SHARE, 0)) + ROYAL_COINS;
    recipe = { ...recipe, needs: stages[0].needs, moves: recipe.moves + ROYAL_MOVES, price, stages, last: unlocked.length === Object.keys(RANK_RECIPES).length && !royal };
  } else if (isTwin(number, unlocked)) {
    // Two customers with two needs each, of different ingredients, on one board.
    const first = scaled(biggest(recipe.needs, 2), TWIN_SHARE);
    const other = grown(at + 1);
    const spare = KINDS.filter((k) => !(k in first));
    const wants = Object.entries(biggest(other.needs, 3)).filter(([k]) => !(k in first));
    while (wants.length < 2) wants.push([spare.find((k) => !wants.some(([w]) => w === k))!, Object.values(other.needs)[0]]);
    const needs = scaled(biggest(Object.fromEntries(wants), 2), TWIN_SHARE);
    const price = Math.round(other.price * TWIN_SHARE);
    recipe = {
      ...recipe,
      needs: { ...first, ...needs },
      moves: recipe.moves + Math.round(other.moves * TWIN_MOVES),
      price: Math.round(recipe.price * TWIN_SHARE) + price,
      second: { potion: other.potion, needs, price },
    };
  }
  // A royal commission's forbidden kind must be one none of its stages needs.
  const needed = recipe.stages ? Object.assign({}, ...recipe.stages.map((st) => st.needs)) : recipe.needs;
  const twist = twistFor(number, needed, unlocked);
  const risk = rich && number > 1 ? riskFor(number) : undefined;
  // Easy gives five more moves, Hard three fewer.
  const cut = (twist.rush ? RUSH_MOVES : 0) + (risk === 'moves' ? RICH_MOVES : 0);
  const moves = Math.max(MIN_MOVES, recipe.moves + extraMoves + byDifficulty(5, 0, -3) - cut);
  const base = recipe.price + (twist.rush ? RUSH_COINS : 0);
  const price = risk ? base + Math.round(base * RICH_SHARE) : base;
  const blockers = blockersFor(number);
  if (risk === 'blockers') {
    blockers.jars += RICH_BLOCKERS;
    blockers.resin += RICH_BLOCKERS;
    if (blockers.mould > 0) blockers.mould += 1;
  }
  return { ...recipe, ...twist, ...blockers, number, moves, price, ...(risk ? { rich: risk } : {}) };
}
