// The buyer's book: from `BOOK_FROM` jars sold, three town buyers each season ask for a grade of
// honey at a premium: mixed (any jars), pure (jars of one kind) or comb honey (cut straight from a
// capped cell, with no jar and no wax). Their prices are set as the season turns.

import type { TextKey } from '../i18n';
import type { Kind } from './honey';

export type Grade = 'mixed' | 'pure' | 'comb';
export const GRADES: Grade[] = ['mixed', 'pure', 'comb'];

export interface Ask {
  /** The town, by `CITIES` index. */
  city: number;
  grade: Grade;
  /** The kind it wants (mixed takes any kind, and is priced as clover). */
  kind: Kind;
  count: number;
  /** Coins paid for each jar or piece of comb. */
  price: number;
  done: boolean;
}

/** The town buyers, by their name's text. */
export const CITIES: TextKey[] = ['ashby', 'brookmere', 'kingsford', 'millhaven', 'thornbury', 'wexley'];
/** The book opens once this many jars are sold, well after the first round. */
export const BOOK_FROM = 20;
/** Each grade's price, as a multiple of what a jar of its kind is worth before the market's demand. */
export const GRADE_MULT: Record<Grade, number> = { mixed: 1.25, pure: 1.6, comb: 2.4 };
/** How many each grade asks for: the least and the most. */
export const GRADE_COUNT: Record<Grade, [number, number]> = { mixed: [6, 8], pure: [3, 5], comb: [2, 3] };
/** A season's prices swing between these multiples. */
export const SWING: [number, number] = [0.85, 1.25];
