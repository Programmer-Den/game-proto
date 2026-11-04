// Sea beasts: on a rare wave a kraken or a sea serpent rises among the fleet. It stays under the
// sea, raising tentacles round the player's ship to dodge, and only shows its head for a moment,
// abeam the ship where a broadside can reach it. Each one sunk hangs on the harbor wall for good.

export type BeastKind = 'kraken' | 'serpent';
export const BEAST_KINDS: BeastKind[] = ['kraken', 'serpent'];

export const isBeast = (kind: string): kind is BeastKind => kind === 'kraken' || kind === 'serpent';

/** The first beast wave, and how many waves apart they come after it: 9, 17, 25... */
export const FIRST_BEAST_WAVE = 9;
export const BEAST_EVERY = 8;
/** The beast `wave` brings, or null: the serpent first, then the kraken, and so on by turns. */
export function beastFor(wave: number): BeastKind | null {
  if (wave < FIRST_BEAST_WAVE || (wave - FIRST_BEAST_WAVE) % BEAST_EVERY) return null;
  return ((wave - FIRST_BEAST_WAVE) / BEAST_EVERY) % 2 === 0 ? 'serpent' : 'kraken';
}
/** A beast wave's fleet is the size of a wave this many earlier. */
export const BEAST_FLEET_CUT = 3;

/** How long the head stays up, how long the beast stays under between, and before the first time. */
export const HEAD_MS = 3000;
export const DIVE_MS = 3500;
export const FIRST_DIVE_MS = 2500;
/** How far abeam of the player the head comes up, inside an uncharged broadside's reach. */
export const SURFACE_AT = 150;

/** How long a tentacle's ripple shows before it rises, how far its blow reaches and how far off it can rise. */
export const TENTACLE_MS = 1400;
export const TENTACLE_R = 32;
export const TENTACLE_SPREAD = 40;

/** A tentacle about to rise where its ripple shows on the sea. */
export interface Tentacle {
  id: number;
  x: number;
  y: number;
  ms: number;
  total: number;
  damage: number;
  /** Whose arm it is, for its colour. */
  beast: BeastKind;
}

/** The harbor wall: how many of each beast have ever been sunk. */
export type Wall = Record<BeastKind, number>;
export const emptyWall = (): Wall => ({ kraken: 0, serpent: 0 });
