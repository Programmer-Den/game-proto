// The foes that march on the barricade. Numbers are for wave 1; later waves scale health up (see waves.ts).

import type { TextKey } from '../i18n';

export type EnemyKind = 'goblin' | 'orc' | 'knight' | 'harpy' | 'bearer' | 'shaman' | 'wolf' | 'wisp' | 'troll' | 'ogre' | 'giant' | 'chieftain';

export interface EnemyType {
  /** Its name, a key of `i18n/en.ts`. */
  name: TextKey;
  /** Health at wave 1. A boss splits it over `bars` health bars, each this big. */
  hp: number;
  /** Walking speed in pixels per second. */
  speed: number;
  /** Damage a second dealt to the barricade while it stands in front of it. */
  dps: number;
  /** Flat damage taken off every arrow and fireball hit; burning and lightning ignore it. */
  armor: number;
  /** Experience for the kill. */
  xp: number;
  /** Hit radius in pixels, also how far its front stands from the barricade. */
  radius: number;
  /** Coins for the kill, spent on hired guards. */
  coins: number;
  /** Bosses have several health bars, from the boss's wave count; others have one. */
  boss?: boolean;
  /** Flies over the barricade straight at the hero, and over caltrops. */
  flying?: boolean;
  /** Carries a shield that blocks most of an arrow's hit from the front (blasts, volleys and lightning get through). */
  shield?: boolean;
  /** Heals the foes around it every few seconds. */
  healer?: boolean;
  /** Made of frost: shrugs off burning and chill, like a Warded elite. */
  cold?: boolean;
}

export const ENEMIES: Record<EnemyKind, EnemyType> = {
  goblin: { name: 'goblinName', hp: 14, speed: 78, dps: 5, armor: 0, xp: 2, radius: 14, coins: 1 },
  orc: { name: 'orcName', hp: 34, speed: 42, dps: 10, armor: 0, xp: 4, radius: 18, coins: 2 },
  knight: { name: 'knightName', hp: 90, speed: 28, dps: 18, armor: 5, xp: 10, radius: 20, coins: 4 },
  harpy: { name: 'harpyName', hp: 16, speed: 44, dps: 0, armor: 0, xp: 3, radius: 14, coins: 2, flying: true },
  bearer: { name: 'bearerName', hp: 40, speed: 34, dps: 10, armor: 0, xp: 5, radius: 18, coins: 3, shield: true },
  shaman: { name: 'shamanName', hp: 30, speed: 30, dps: 6, armor: 0, xp: 6, radius: 16, coins: 4, healer: true },
  // The frozen pass's own foes (see frontier.ts): wolves that run in fast, and wisps of frost that fly.
  wolf: { name: 'wolfName', hp: 18, speed: 100, dps: 7, armor: 0, xp: 3, radius: 15, coins: 2 },
  wisp: { name: 'wispName', hp: 24, speed: 40, dps: 0, armor: 0, xp: 4, radius: 14, coins: 3, flying: true, cold: true },
  // The bosses at the end of each road of ten waves, in turn: wave 10, 20, 30, then round again.
  troll: { name: 'trollName', hp: 300, speed: 16, dps: 45, armor: 2, xp: 60, radius: 40, coins: 30, boss: true },
  ogre: { name: 'ogreName', hp: 330, speed: 18, dps: 50, armor: 4, xp: 70, radius: 40, coins: 30, boss: true },
  giant: { name: 'giantName', hp: 380, speed: 14, dps: 55, armor: 3, xp: 80, radius: 42, coins: 30, boss: true },
  // The frozen pass's last boss, on its wave 30.
  chieftain: { name: 'chieftainName', hp: 420, speed: 14, dps: 60, armor: 4, xp: 100, radius: 42, coins: 40, boss: true, cold: true },
};
