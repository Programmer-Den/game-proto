// The flower garden: after the fair's first gold the Baron can plant flower beds on the estate.
// Two beds side by side (or one above the other) cross-pollinate, and some pairs of flowers give a
// rare bloom whose honey no meadow gives: it sells at a premium with the jars and is entered at the
// fair as a class of its own.

import type { TextKey } from '../i18n';

/** What a bed can grow: the meadows' flowers. */
export type Bloom = 'clover' | 'lavender' | 'heather' | 'sunflower';
export const BLOOMS: Bloom[] = ['clover', 'lavender', 'heather', 'sunflower'];

/** The garden: `BED_COLS` beds a row, two rows; beds touch left, right, above and below. */
export const BED_COLS = 4;
export const BEDS = BED_COLS * 2;
/** The garden opens with this many fair golds, and a bed costs this much to plant (or replant). */
export const GARDEN_GOLDS = 1;
export const BED_PRICE = 120;

/** The rare honeys of cross-pollinated beds. */
export type Rare = 'blossom' | 'sunburst' | 'mountain';
export const RARE_KINDS: Rare[] = ['blossom', 'sunburst', 'mountain'];
export interface RareHoney {
  /** Its name's text (`i18n/en.ts`). */
  name: TextKey;
  /** The two flowers whose beds side by side give it. */
  pair: [Bloom, Bloom];
  /** A jar sells for this many times a heather jar before the market's demand. */
  mult: number;
  /** What a jar scores at the fair's rare class. */
  points: number;
}
export const RARES: Record<Rare, RareHoney> = {
  blossom: { name: 'blossomHoney', pair: ['clover', 'lavender'], mult: 1.4, points: 5 },
  sunburst: { name: 'sunburstHoney', pair: ['clover', 'sunflower'], mult: 1.6, points: 6 },
  mountain: { name: 'mountainHoney', pair: ['lavender', 'heather'], mult: 2, points: 7 },
};
/** Every rare pair of beds gives a jar this often (not in winter), and the garden keeps at most this many jars of rare honey. */
export const GARDEN_MS = 60_000;
export const RARE_CAP = 12;

export const noRare = (): Record<Rare, number> => ({ blossom: 0, sunburst: 0, mountain: 0 });
export const noBeds = (): (Bloom | null)[] => new Array<Bloom | null>(BEDS).fill(null);

/** Every pair of beds that touch, lower bed first. */
export const BED_PAIRS: [number, number][] = [...Array(BEDS).keys()].flatMap((a) => {
  const out: [number, number][] = [];
  if (a % BED_COLS < BED_COLS - 1) out.push([a, a + 1]);
  if (a + BED_COLS < BEDS) out.push([a, a + BED_COLS]);
  return out;
});

/** The rare honey two flowers give side by side, or null. */
export function rareOf(a: Bloom | null, b: Bloom | null): Rare | null {
  if (!a || !b || a === b) return null;
  return RARE_KINDS.find((r) => RARES[r].pair.includes(a) && RARES[r].pair.includes(b)) ?? null;
}

/** The garden's rare blooms: each touching pair of beds that cross-pollinates, with its honey. */
export const rarePairs = (beds: (Bloom | null)[]) =>
  BED_PAIRS.flatMap(([a, b]) => {
    const rare = rareOf(beds[a], beds[b]);
    return rare ? [{ a, b, rare }] : [];
  });
