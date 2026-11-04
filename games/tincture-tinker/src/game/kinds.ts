import type { TextKey } from '../i18n';

// The ingredients on the board. Matching three or more of a kind gathers them for the order.

/** The five everyday ingredients, on every board. */
export const KINDS = ['wheat', 'mandrake', 'sage', 'ember', 'moonpetal'] as const;
/** The rare ingredients, one only found in each town of the journey map (in `TOWNS` order). */
export const RARES = ['fern', 'honey', 'pearl', 'thistle', 'acorn', 'larkspur', 'glowcap', 'bramble'] as const;
/** Every ingredient: the everyday ones, then the rare ones. */
export const ALL_KINDS = [...KINDS, ...RARES] as const;
export type BaseKind = (typeof KINDS)[number];
export type RareKind = (typeof RARES)[number];
export type Kind = BaseKind | RareKind;

/** Each ingredient's name, and a count of it in a sentence, as keys of `i18n/en.ts`. */
export const KIND_NAMES: Record<Kind, TextKey> = {
  wheat: 'wheatName',
  mandrake: 'mandrakeName',
  sage: 'sageName',
  ember: 'emberName',
  moonpetal: 'moonpetalName',
  fern: 'fernName',
  honey: 'honeyName',
  pearl: 'pearlName',
  thistle: 'thistleName',
  acorn: 'acornName',
  larkspur: 'larkspurName',
  glowcap: 'glowcapName',
  bramble: 'brambleName',
};
export const KIND_COUNTS: Record<Kind, TextKey> = {
  wheat: 'wheatCount',
  mandrake: 'mandrakeCount',
  sage: 'sageCount',
  ember: 'emberCount',
  moonpetal: 'moonpetalCount',
  fern: 'fernCount',
  honey: 'honeyCount',
  pearl: 'pearlCount',
  thistle: 'thistleCount',
  acorn: 'acornCount',
  larkspur: 'larkspurCount',
  glowcap: 'glowcapCount',
  bramble: 'brambleCount',
};

/** True for a rare ingredient: it never goes into the pantry and the herbalist doesn't sell it. */
export const isRare = (kind: Kind): kind is RareKind => (RARES as readonly Kind[]).includes(kind);

/**
 * A random ingredient from `pool` (the five everyday ones unless a town adds its rare one), drawn
 * from `rand` (Math.random unless a fixed board is being laid).
 */
export const randomKind = (rand: () => number = Math.random, pool: readonly Kind[] = KINDS): Kind => pool[Math.floor(rand() * pool.length)];
