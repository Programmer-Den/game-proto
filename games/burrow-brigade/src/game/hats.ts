/**
 * Hats for your moles, worn on top of the helmet in every match but Watch AI. Each opens once the
 * campaign's stars (both tiers together) reach `stars`. Names are `hat_<id>` in `i18n/`; the look
 * is `drawHat` in `scenes/draw.ts`, which also draws the boss's crown.
 */
export const HATS = [
  { id: 'acorn', stars: 2 },
  { id: 'flower', stars: 6 },
  { id: 'feather', stars: 10 },
  { id: 'party', stars: 15 },
  { id: 'horns', stars: 20 },
  { id: 'tophat', stars: 28 },
  { id: 'laurel', stars: 36 },
] as const;
export type HatId = (typeof HATS)[number]['id'];

export const isHat = (id: unknown): id is HatId => HATS.some((h) => h.id === id);
