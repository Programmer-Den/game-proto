// The county honey fair, held every year in the last minute of summer once the Heather Moor is
// open. Enter one jar of each class straight from a capped cell (or a ready cask, for mead): a jar
// scores the capped cells of its kind its cell touches, so honey from a well-joined comb scores
// higher. Enough points in all take gold; the first gold makes the player the Beehive Baron, and
// every fair after it asks for more points and adds a class, a ladder after the ending.

import { KINDS, type Kind } from './honey';

/**
 * What can be entered: a jar of each kind, then a cask of mead, then a jar from a cell filled this
 * season, and a jar of rare honey from the garden while it has a rare bloom.
 */
export type FairClass = Kind | 'mead' | 'fresh' | 'rare';
const LADDER: FairClass[] = [...KINDS, 'mead', 'fresh'];
export const FAIR_CLASSES: FairClass[] = [...LADDER, 'rare'];

/**
 * The classes a fair judges, by how many fairs were held before it: mead joins at the second, fresh
 * honey at the third, and rare honey whenever the garden has a rare bloom (`rare`).
 */
export const classesFor = (fairs: number, rare = false): FairClass[] => [...LADDER.slice(0, Math.min(LADDER.length, KINDS.length + fairs)), ...(rare ? (['rare'] as const) : [])];

/** Points in all that win gold at the first fair, how many more each fair after it needs, and the most it ever needs. */
export const FAIR_GOLD = 14;
export const FAIR_STEP = 3;
export const FAIR_MAX = 28;
export const fairGold = (fairs: number) => Math.min(FAIR_MAX, FAIR_GOLD + FAIR_STEP * fairs);

/** The fair is on for this long at the end of every summer. */
export const FAIR_MS = 60_000;
/** What a cask of mead scores, by its honey. */
export const MEAD_POINTS: Record<Kind, number> = { clover: 4, lavender: 5, heather: 6 };

/** The best entry of each class at this year's fair, as its points, or null while none is entered. */
export type FairEntries = Record<FairClass, number | null>;
export const noEntries = (): FairEntries => ({ clover: null, lavender: null, heather: null, mead: null, fresh: null, rare: null });
