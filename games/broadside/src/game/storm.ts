// The Storm Reaches' weather and waters: squalls that swing the wind mid-wave and reefs that wreck
// a careless ship. Which waves are out in the Reaches is in `waves.ts`.

/** Fighting time between squalls, how long a squall is seen coming, and how long its rain lasts. */
export const SQUALL_EVERY = 20_000;
export const SQUALL_WARN = 3000;
export const SQUALL_MS = 6000;
/** The first squall of a wave comes this soon. */
export const FIRST_SQUALL = 12_000;

/** Reefs on the sea each Reaches wave, their radius, and what striking one costs a hull. */
export const REEFS = 4;
export const REEF_R = 18;
export const REEF_DAMAGE = 30;
/** How far from the player, from a beach and from each other reefs are laid. */
export const REEF_CLEAR = { player: 240, island: 90, reef: 160 };

/** Medals the Admiralty adds for sinking the Tempest. */
export const TEMPEST_MEDALS = 8;
/** The share of her hull at which the Tempest calls a squall down at once, each time. */
export const TEMPEST_CALLS = [2 / 3, 1 / 3];

/** A reef: rocks just awash, with breakers round them. */
export interface Reef {
  id: number;
  x: number;
  y: number;
  r: number;
}
