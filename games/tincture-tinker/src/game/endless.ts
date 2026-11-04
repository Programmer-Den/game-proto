import { byDifficulty } from '../../../../shared/settings';
import { ALL_RECIPES, type Order } from './orders';

// Endless orders, once every guild examination is passed: one order after another, each asking for
// more with fewer moves, until one runs out of moves. The longest run is kept as the best streak.

/** Each order of a run asks for this many more of every ingredient than the one before... */
export const ENDLESS_NEEDS = 2;
/** ...with one fewer move every this many orders, down to `ENDLESS_MIN_MOVES`. */
export const ENDLESS_SLOWER = 2;
const ENDLESS_MIN_MOVES = 10;
/** Coins the first order of a run pays, and how much more each after it pays. */
const ENDLESS_PRICE = 40;
const ENDLESS_RAISE = 10;

/** Order `step` of an endless run (from 1), numbered like the order it interrupts. */
export function endlessOrder(step: number, number: number): Order {
  const recipe = ALL_RECIPES[(step - 1) % ALL_RECIPES.length];
  const k = step - 1;
  const needs = Object.fromEntries(Object.entries(recipe.needs).map(([kind, n]) => [kind, n + k * ENDLESS_NEEDS]));
  const moves = Math.max(ENDLESS_MIN_MOVES, recipe.moves + 2 - Math.floor(k / ENDLESS_SLOWER)) + byDifficulty(5, 0, -3);
  return {
    number,
    potion: recipe.potion,
    needs,
    moves: Math.max(5, moves),
    price: ENDLESS_PRICE + k * ENDLESS_RAISE,
    jars: Math.min(2 + Math.floor(k / 2), 8),
    resin: Math.min(2 + Math.floor(k / 2), 10),
    mould: k < 2 ? 0 : Math.min(1 + Math.floor((k - 2) / 3), 4),
    endless: step,
  };
}
