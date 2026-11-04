// The bosses' moves, each one boss's own: the Troll King throws rocks that stun a guard, the Ogre
// Warlord calls goblins at half health, and the Frost Giant's roar slows the ranger's shots; on the frozen pass
// the Yeti Chieftain's howl stuns every guard and slows the shots too.

/** The Troll King throws a rock every ROCK_MS once in view (the first one sooner). */
export const ROCK_MS = 7_000;
export const FIRST_ROCK_MS = 2_500;
export const ROCK_SPEED = 300;
/** A rock stuns the guard it hits for this long, or takes this much off the barricade when no guard is hired. */
export const STUN_MS = 4_000;
export const ROCK_DAMAGE = 25;
/** The Ogre Warlord, once below half health, calls this many goblins to its side. */
export const CALL_GOBLINS = 4;
/** The Frost Giant roars every ROAR_MS: the ranger shoots at 1 / ROAR_SLOW of the pace for ROAR_SLOW_MS. */
export const ROAR_MS = 9_000;
export const FIRST_ROAR_MS = 3_000;
export const ROAR_SLOW = 1.7;
export const ROAR_SLOW_MS = 4_000;
/**
 * The Yeti Chieftain, the frozen pass's last boss, howls every HOWL_MS: every hired guard is stunned
 * for STUN_MS and the hero's shots slow as under the Frost Giant's roar.
 */
export const HOWL_MS = 10_000;
export const FIRST_HOWL_MS = 3_500;
