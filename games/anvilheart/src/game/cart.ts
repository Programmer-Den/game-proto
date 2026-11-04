// Ore carts (AN20): once the smithy has made a Steel Sword, a cart passes now and then and stays a
// while, selling two ores for a few minutes of forging each: silver (three times the gems) and
// starmetal (the forge makes Steel Swords, or Steel Bucklers, instead of daggers). Names and blurbs
// are keys of `i18n/en.ts`, shown with `t`.
import type { TextKey } from '../i18n';

export type Ore = 'silver' | 'starmetal';
export const ORE_IDS: Ore[] = ['silver', 'starmetal'];
export const ORES: Record<Ore, { name: TextKey; blurb: TextKey }> = {
  silver: { name: 'silverName', blurb: 'silverBlurb' },
  starmetal: { name: 'starmetalName', blurb: 'starmetalBlurb' },
};

/** Carts come once the smithy has made a Steel Sword. */
export const CART_TIER = 3;
/** When the first cart comes after that, how long after one leaves the next comes, and how long it stays. */
export const CART_FIRST_MS = 60_000;
export const CART_EVERY_MS = 150_000;
export const CART_STAY_MS = 45_000;
/** How long an ore lasts once bought. */
export const ORE_MS = 180_000;
/** Silver multiplies the forge's gem chance by this; starmetal forges blanks of this tier. */
export const SILVER_GEMS = 3;
export const STARMETAL_TIER = 3;

/** What an ore costs: more as the smithy's best sword rises, so it stays a choice. */
export const orePrice = (ore: Ore, bestTier: number) => (ore === 'silver' ? 60 + 30 * bestTier : 100 + 50 * bestTier);

/** The cart: time until it comes, time left while it is here, and which ores it has sold this visit. Not saved. */
export interface Cart {
  inMs: number;
  hereMs: number;
  sold: Record<Ore, boolean>;
}
export const freshCart = (): Cart => ({ inMs: CART_FIRST_MS, hereMs: 0, sold: { silver: false, starmetal: false } });
export const noOres = (): Record<Ore, number> => ({ silver: 0, starmetal: 0 });
