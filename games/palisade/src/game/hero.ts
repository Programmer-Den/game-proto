// The hero's class: the ranger shoots arrows, the mage, unlocked by the first legacy (a hero
// retired), casts arcane bolts that burst through shields, and the warden, unlocked by the second
// legacy, holds foes back at the barricade with shield slams and a hound instead of shooting. Each
// has a skill tree of their own (the upgrades marked `hero: 'mage'` or `hero: 'warden'` in
// upgrades.ts). A new hero picks the class; a hero keeps it.

import type { TextKey } from '../i18n';

export type HeroClass = 'ranger' | 'mage' | 'warden';

export const HERO_CLASSES: HeroClass[] = ['ranger', 'mage', 'warden'];

export const HEROES: Record<HeroClass, { name: TextKey }> = {
  ranger: { name: 'heroRanger' },
  mage: { name: 'heroMage' },
  warden: { name: 'heroWarden' },
};

/** Heroes that must have retired before a new hero may be this class. */
const RETIRED_FOR: Record<HeroClass, number> = { ranger: 0, mage: 1, warden: 2 };

/** Whether a new hero may be this class: the mage once a hero has retired, the warden once two have. */
export const canClass = (legacy: { retired: number }, hero: HeroClass) => legacy.retired >= RETIRED_FOR[hero];

/** The mage's time between two casts, before Focus, and the hit of a bolt, before Potency. */
export const MAGE_CAST_MS = 1_400;
export const MAGE_DAMAGE = 15;
/** Every bolt bursts round the foe it hits: this radius and share of its hit, more with Wide Burst. */
export const MAGE_BURST = { radius: 30, share: 0.35 };

/** The warden's time between two shield slams, before Vigilance, and a slam's hit, before Heavy Shield. */
export const WARDEN_SLAM_MS = 1_200;
export const WARDEN_DAMAGE = 14;
/** How far in front of the barricade's face a slam reaches, and how far it shoves the foes it hits back. */
export const WARDEN_REACH = 60;
export const WARDEN_PUSH = 16;
/** The hound: how fast it runs, the time between two bites, the bite's share of a slam's hit and how long it holds a foe. */
export const HOUND_SPEED = 240;
export const HOUND_MS = 1_000;
export const HOUND_BITE = 0.5;
export const HOUND_HOLD = { slow: 0.6, ms: 700 };
/** Where the hounds wait behind the barricade (the second one higher up). */
export const HOUND_HOMES = [
  { x: 112, y: 474 },
  { x: 112, y: 344 },
];
