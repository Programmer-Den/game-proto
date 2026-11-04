// Bee breeds: every gold at the county fair lets the baron breed a trait into the queen line, kept
// from year to year. Each trait has a few ranks and helps every bee of every hive.

import type { TextKey } from '../i18n';

export type Trait = 'far' | 'wardens' | 'hardy';
export const BREEDS: Record<Trait, { name: TextKey; blurb: TextKey }> = {
  far: { name: 'farFlyers', blurb: 'farBlurb' },
  wardens: { name: 'waspWardens', blurb: 'wardensBlurb' },
  hardy: { name: 'frostHardy', blurb: 'hardyBlurb' },
};
export const TRAITS = Object.keys(BREEDS) as Trait[];
/** How many times each trait can be bred in. */
export const BREED_MAX = 3;
export const noBreeds = (): Record<Trait, number> => ({ far: 0, wardens: 0, hardy: 0 });

/** Far flyers: each rank brings one more drop a trip, and makes every trip this share longer. */
export const FAR_NECTAR = 1;
export const FAR_TRIP = 0.15;
/** Wasp wardens: each rank makes a raiding wasp take this share longer to steal a cell. */
export const WARDEN_STEAL = 0.5;
/** Frost-hardy: each rank lets this many more bees share one winter meal. */
export const HARDY_BEES = 2;
