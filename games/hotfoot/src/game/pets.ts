// The companions: a small pet that runs with the knight, bought and levelled with banked coins in
// the armoury's Companions panel. One runs along at a time, on ordinary runs only (a daily course,
// the weekly road and the challenge courses are run bare). The owl grabs coins the knight passes
// out of reach, the hound barks at the traps coming up and marks them, and the fox takes a hit for
// the knight once a stage. Their numbers are applied in `stats` in state.ts and in `tick` and
// `hurt` in sim.ts; names and texts are keys of `i18n/en.ts`, shown with `t`.
import type { TextKey } from '../i18n';

export type PetId = 'owl' | 'hound' | 'fox';

export interface Pet {
  name: TextKey;
  text: TextKey;
  /** What each level adds, shown under the level line. */
  levels: TextKey;
  /** The price of each level, in banked coins (the first buys the pet); the pet is full after the last. */
  prices: number[];
}

export const PETS: Record<PetId, Pet> = {
  owl: { name: 'owlName', text: 'owlText', levels: 'owlLevels', prices: [50, 100, 160] },
  hound: { name: 'houndName', text: 'houndText', levels: 'houndLevels', prices: [40, 80, 130] },
  fox: { name: 'foxName', text: 'foxText', levels: 'foxLevels', prices: [70, 130, 200] },
};

export const PET_IDS = Object.keys(PETS) as PetId[];

/** Each pet's level, 0 until bought. */
export type PetLevels = Record<PetId, number>;
export const noPets = (): PetLevels => ({ owl: 0, hound: 0, fox: 0 });

/**
 * What each level does, by level (index 0 is not bought): how far past the knight's box (up or
 * down) the owl grabs a coin, how far ahead the hound barks at a trap, and how many hits a stage
 * the fox takes (from level 2 the streak survives its hit too).
 */
export const PET_EACH = {
  owl: [0, 50, 90, 140],
  hound: [0, 380, 500, 640],
  fox: [0, 1, 1, 2],
  /** The fox's hit keeps the coin streak from this level. */
  foxStreak: 2,
};

/** The price of the next level (or of the pet itself), or null once it is full. */
export const nextPetPrice = (levels: PetLevels, id: PetId) => PETS[id].prices[levels[id]] ?? null;
