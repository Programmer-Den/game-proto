// The hero's class: the ranger shoots arrows, and the mage, unlocked by the first legacy (a hero
// retired), casts arcane bolts that burst through shields, with a skill tree of their own (the
// upgrades marked `hero: 'mage'` in upgrades.ts). A new hero picks the class; a hero keeps it.

import type { TextKey } from '../i18n';

export type HeroClass = 'ranger' | 'mage';

export const HERO_CLASSES: HeroClass[] = ['ranger', 'mage'];

export const HEROES: Record<HeroClass, { name: TextKey }> = {
  ranger: { name: 'heroRanger' },
  mage: { name: 'heroMage' },
};

/** Whether a new hero may be this class: the mage once a hero has retired for a legacy. */
export const canClass = (legacy: { retired: number }, hero: HeroClass) => hero === 'ranger' || legacy.retired > 0;

/** The mage's time between two casts, before Focus, and the hit of a bolt, before Potency. */
export const MAGE_CAST_MS = 1_400;
export const MAGE_DAMAGE = 15;
/** Every bolt bursts round the foe it hits: this radius and share of its hit, more with Wide Burst. */
export const MAGE_BURST = { radius: 30, share: 0.35 };
