import { HUNTER_BRIGS, MERCHANTS, type CourseId } from './courses';
import { BEAST_FLEET_CUT, beastFor } from './beasts';
import type { EnemyKind } from './ships';

/**
 * The ships a wave brings, in the order they come, on the `course` chosen for it: the Merchant
 * lane adds merchantmen, the Hunter patrol more brigs.
 */
export function waveShips(wave: number, course: CourseId | null = null): EnemyKind[] {
  const ships: EnemyKind[] = [];
  // Out in the Storm Reaches the fleets start the size of a home wave `REACHES_FLEET` and grow
  // slowly, while their hulls go on growing with the wave (`hpScale`).
  // A sea beast's wave brings a smaller fleet, with the beast rising first.
  const beast = beastFor(wave);
  const size = Math.max(1, (inReaches(wave) ? REACHES_FLEET + Math.floor(reachWave(wave) / 2) : wave) - (beast ? BEAST_FLEET_CUT : 0));
  const sloops = 1 + size;
  const brigs = (size >= 3 ? Math.floor((size - 1) / 2) : 0) + (course === 'hunter' ? HUNTER_BRIGS : 0);
  const galleons = size >= 5 ? Math.floor((size - 3) / 2) : 0;
  const fireships = size >= 3 ? Math.floor(size / 3) : 0;
  const ketches = size >= 4 ? Math.floor((size - 1) / 3) : 0;
  for (let i = 0; i < sloops; i++) ships.push('sloop');
  // The bigger ships come in among the sloops.
  for (let i = 0; i < brigs; i++) ships.splice(Math.min(ships.length, 1 + i * 2), 0, 'brig');
  for (let i = 0; i < galleons; i++) ships.splice(Math.min(ships.length, 2 + i * 3), 0, 'galleon');
  for (let i = 0; i < fireships; i++) ships.splice(Math.min(ships.length, 2 + i * 3), 0, 'fireship');
  for (let i = 0; i < ketches; i++) ships.splice(Math.min(ships.length, 3 + i * 4), 0, 'ketch');
  if (course === 'merchant') for (let i = 0; i < MERCHANTS; i++) ships.splice(Math.min(ships.length, 1 + i * 3), 0, 'merchant');
  // Every fifth wave the enemy's flagship comes last, once its fleet is engaged; at the pirate
  // haven it is the admiral's own, and at the end of the Storm Reaches the Tempest.
  if (beast) ships.unshift(beast);
  if (wave === HAVEN_WAVE) ships.push('admiral');
  else if (wave === TEMPEST_WAVE) ships.push('tempest');
  else if (wave % 5 === 0) ships.push('flagship');
  return ships;
}

/** The wave of the pirate haven: three shore forts and the admiral. Sinking the admiral wins the campaign. */
export const HAVEN_WAVE = 20;
/** How many waves the Storm Reaches last, and the wave of the Tempest, their last. */
export const REACHES_WAVES = 20;
export const TEMPEST_WAVE = HAVEN_WAVE + REACHES_WAVES;
/** Whether `wave` is out in the Storm Reaches, the second sea: every wave after the haven. */
export const inReaches = (wave: number) => wave > HAVEN_WAVE;
/** The wave's number in the Reaches, 1 to 20 (and on beyond). */
export const reachWave = (wave: number) => wave - HAVEN_WAVE;
/** The fleet of Reaches wave 1 is a home wave this size, and grows by one every second wave. */
export const REACHES_FLEET = 10;

/** The first wave on which an island may carry a shore fort. */
export const FIRST_FORT_WAVE = 6;

/** How many islands carry a shore fort on `wave`: from wave 6 one, from wave 12 two, three at the haven. */
export function fortsFor(wave: number) {
  if (wave === HAVEN_WAVE) return 3;
  if (wave < FIRST_FORT_WAVE) return 0;
  return Math.min(2, 1 + Math.floor((wave - FIRST_FORT_WAVE) / 6));
}

/** Enemy ships get a little tougher every wave. */
export const hpScale = (wave: number) => 1 + 0.12 * (wave - 1);
