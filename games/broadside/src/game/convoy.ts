// Convoy waves: from wave 7, every third wave a merchantman sails with the player for a named
// island while the enemy hunts her, and pays her cargo if she gets there.

import { HAVEN_WAVE, TEMPEST_WAVE } from './waves';

/** The first convoy wave; then every `CONVOY_EVERY` waves, never at the haven or the Tempest (whose wins wait for no merchantman). */
export const CONVOY_WAVE = 7;
export const CONVOY_EVERY = 3;
export const isConvoyWave = (wave: number) => wave >= CONVOY_WAVE && (wave - CONVOY_WAVE) % CONVOY_EVERY === 0 && wave !== HAVEN_WAVE && wave !== TEMPEST_WAVE;

/** What the convoy's cargo pays on arriving, on `wave`. */
export const convoyCargo = (wave: number) => 90 + 6 * wave;
/** The share of a merchantman's speed the laden convoy makes, so the player can keep up and screen her. */
export const CONVOY_SAIL = 0.62;
/** She has arrived once this close to the island's beach (beyond its half-widths). */
export const CONVOY_ARRIVE = 60;
/** Her destination is an island at least this far from where she sets out. */
export const CONVOY_FAR = 500;
