// Night waves: some waves sail in the dark. Enemy ships show only by their lanterns and the flash
// of their guns, the player's crews can only train on what they can see, and a flare lights the
// whole sea for a few seconds.

import { beastFor } from './beasts';
import { HAVEN_WAVE, TEMPEST_WAVE } from './waves';

/** The first night wave, and how many waves apart they come: 4, 8, 12... */
export const FIRST_NIGHT_WAVE = 4;
export const NIGHT_EVERY = 4;
/** Whether `wave` sails at night: never the haven, the Tempest or a beast's wave. */
export const isNightWave = (wave: number) =>
  wave >= FIRST_NIGHT_WAVE && (wave - FIRST_NIGHT_WAVE) % NIGHT_EVERY === 0 && wave !== HAVEN_WAVE && wave !== TEMPEST_WAVE && !beastFor(wave);

/** Flares aboard for each night wave, and how long one lights the sea. */
export const FLARES = 3;
export const FLARE_MS = 6000;
/** How far round the player's ship her own lanterns light the sea. */
export const NIGHT_SIGHT = 170;
/** How long a ship stays lit by the flash of her guns. */
export const FLASH_MS = 900;
