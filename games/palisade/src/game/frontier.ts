// New frontiers: lifting the siege opens a second map, the frozen pass, which the same hero marches
// on to. It has its own 30 waves, with frost wolves and ice wisps among the foes and the Yeti
// Chieftain as its last boss, and foes as tough as ten waves further on in the vale. Clearing its
// wave 30 wins the pass.

import type { TextKey } from '../i18n';
import type { EnemyKind } from './enemies';

export type FrontierId = 'vale' | 'pass';

export interface Frontier {
  /** Its name, a key of `i18n/en.ts`. */
  name: TextKey;
  /** The bosses at the end of each road of ten waves, in turn. */
  bosses: EnemyKind[];
  /** Foes have the health they would have this many waves further on in the vale. */
  hpWaves: number;
  /** Experience and coins for every kill, times this. */
  reward: number;
}

export const FRONTIERS: Record<FrontierId, Frontier> = {
  vale: { name: 'frontierVale', bosses: ['troll', 'ogre', 'giant'], hpWaves: 0, reward: 1 },
  pass: { name: 'frontierPass', bosses: ['giant', 'troll', 'chieftain'], hpWaves: 10, reward: 1.25 },
};

export const FRONTIER_IDS = Object.keys(FRONTIERS) as FrontierId[];

/** Whether the hero may march to the frozen pass: the siege lifted once (a heat unlocked). */
export const canFrontier = (state: { heatUnlocked: number }, id: FrontierId) => id === 'vale' || state.heatUnlocked > 0;
