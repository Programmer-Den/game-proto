import type { Rand } from '../../../../shared/daily';
import { byDifficulty } from '../../../../shared/settings';
import type { TextKey } from '../i18n';
import { holesOf } from './board';
import type { RareKind } from './kinds';
import { ALL_RECIPES, type Needs, type Order, type PotionId } from './orders';

// The journey map: towns along a road, each sending one order on a board of its own shape (walls
// where no tile goes) with its own blockers. A town is sold for one to three stars, the best kept,
// and the next town opens once it has a star. Each town grows one rare ingredient only found there,
// which its order and its guest ask for (see guests.ts). The daily order borrows a town's shape.

export interface Town {
  /** Its name, a key of `i18n/en.ts`. */
  name: TextKey;
  potion: PotionId;
  /** What the town's order needs: everyday ingredients and the town's rare one. */
  needs: Needs;
  /** The ingredient only found in this town: it drops in on its boards (and its guest's) beside the five everyday ones. */
  rare: RareKind;
  moves: number;
  jars: number;
  resin: number;
  mould: number;
  /** Eight rows of eight: `.` a cell, `#` a wall. */
  shape: string[];
}

export const TOWNS: Town[] = [
  {
    name: 'townFernbrook',
    potion: 'healingDraught',
    needs: { ember: 10, sage: 10, fern: 6 },
    rare: 'fern',
    moves: 16,
    jars: 0,
    resin: 0,
    mould: 0,
    shape: ['##....##', '#......#', '........', '........', '........', '........', '#......#', '##....##'],
  },
  {
    name: 'townMillhollow',
    potion: 'sleepingTonic',
    needs: { moonpetal: 11, wheat: 10, honey: 7 },
    rare: 'honey',
    moves: 17,
    jars: 2,
    resin: 0,
    mould: 0,
    shape: ['........', '........', '........', '...##...', '...##...', '........', '........', '........'],
  },
  {
    name: 'townSaltmere',
    potion: 'mandrakeTincture',
    needs: { mandrake: 10, sage: 9, pearl: 7 },
    rare: 'pearl',
    moves: 18,
    jars: 2,
    resin: 2,
    mould: 0,
    shape: ['........', '#......#', '##....##', '###..###', '###..###', '##....##', '#......#', '........'],
  },
  {
    name: 'townThistlecombe',
    potion: 'goldenElixir',
    needs: { wheat: 11, ember: 10, thistle: 8 },
    rare: 'thistle',
    moves: 20,
    jars: 0,
    resin: 3,
    mould: 0,
    shape: ['###..###', '##....##', '#......#', '........', '........', '#......#', '##....##', '###..###'],
  },
  {
    name: 'townAshbyWold',
    potion: 'amberCordial',
    needs: { wheat: 12, mandrake: 11, acorn: 8 },
    rare: 'acorn',
    moves: 17,
    jars: 3,
    resin: 2,
    mould: 1,
    shape: ['........', '.#....#.', '.#....#.', '........', '........', '.#....#.', '.#....#.', '........'],
  },
  {
    name: 'townLarkspurFord',
    potion: 'moonlitPhilter',
    needs: { moonpetal: 13, mandrake: 12, larkspur: 9 },
    rare: 'larkspur',
    moves: 23,
    jars: 2,
    resin: 3,
    mould: 2,
    shape: ['........', '........', '##......', '..##....', '....##..', '......##', '........', '........'],
  },
  {
    name: 'townGloamwick',
    potion: 'starlightElixir',
    needs: { moonpetal: 12, sage: 11, glowcap: 9 },
    rare: 'glowcap',
    moves: 22,
    jars: 3,
    resin: 3,
    mould: 2,
    shape: ['........', '........', '..####..', '..#..#..', '..#..#..', '..####..', '........', '........'],
  },
  {
    name: 'townBriarcross',
    potion: 'philosophersDraught',
    needs: { ember: 15, moonpetal: 14, bramble: 10 },
    rare: 'bramble',
    moves: 20,
    jars: 4,
    resin: 4,
    mould: 3,
    shape: ['#.#..#.#', '........', '........', '#......#', '#......#', '........', '........', '#.#..#.#'],
  },
];

/** Coins for every star a town gives that it hadn't given before. */
export const TOWN_STAR_COINS = 20;

/** The seed town `index`'s board is laid from, so it starts the same on every try. */
export const townSeed = (index: number) => 104729 * (index + 1);

/** True when town `index` can be visited: the first always, each after it once the one before has a star. */
export const townOpen = (towns: number[], index: number) => index === 0 || (towns[index - 1] ?? 0) > 0;

/** Town `index` as an order (numbered like the order it interrupts); Easy gives five more moves, Hard three fewer. */
export function townOrder(index: number, number: number): Order {
  const town = TOWNS[index];
  return {
    number,
    potion: town.potion,
    needs: { ...town.needs },
    moves: Math.max(5, town.moves + byDifficulty(5, 0, -3)),
    price: TOWN_STAR_COINS,
    jars: town.jars,
    resin: town.resin,
    mould: town.mould,
    holes: holesOf(town.shape),
    rare: town.rare,
    town: { index },
  };
}

/** Coins the daily order pays on top of its recipe's price, with the bonus for each move left. */
export const DAILY_COINS = 20;

/**
 * The daily order for `day`, drawn from `rand` (today's, the same for everyone): one of every
 * recipe, a little more of each ingredient, a town's board shape and a few blockers. The same
 * `rand` goes on to lay the board and drop the tiles in.
 */
export function dailyOrder(rand: Rand, day: string, number: number): Order {
  const recipe = ALL_RECIPES[Math.floor(rand() * ALL_RECIPES.length)];
  const town = Math.floor(rand() * TOWNS.length);
  const needs = Object.fromEntries(Object.entries(recipe.needs).map(([kind, n]) => [kind, n - 2]));
  return {
    number,
    potion: recipe.potion,
    needs,
    moves: Math.max(5, recipe.moves + 1 + byDifficulty(5, 0, -3)),
    price: recipe.price + DAILY_COINS,
    jars: 1 + Math.floor(rand() * 3),
    resin: 1 + Math.floor(rand() * 3),
    mould: Math.floor(rand() * 3),
    holes: holesOf(TOWNS[town].shape),
    daily: { day, town },
  };
}
