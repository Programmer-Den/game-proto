// Where things sit on the 960x540 screen, and how the knight moves and fights.

export const VIEW = { w: 960, h: 540 };

/** The knight's walking speed, in pixels a second. */
export const WALK_SPEED = 130;
/** A roll: how far and fast it goes, and how long before the next. */
export const ROLL_SPEED = 300;
export const ROLL_MS = 280;
export const ROLL_COOLDOWN_MS = 700;
/** Marla's light boots: a roll this much longer, and a cooldown this much shorter. */
export const BOOTS = { roll: 1.35, cooldown: 0.7 };
/** A sword swing: how long it shows, how long before the next, and how far it reaches. */
export const SWING_MS = 220;
export const SWING_COOLDOWN_MS = 330;
export const SWING_REACH = 24;
export const SWING_RADIUS = 20;
/** The hookvine: its reach, and how fast it flies, comes back and pulls. */
export const VINE_RANGE = 228;
export const VINE_SPEED = 560;
export const PULL_SPEED = 400;
/** Sedge's long vine reaches this much farther. */
export const LONG_VINE = 1.4;
/** After a hit, how long the knight can't be hurt again, and how much longer with Sedge's moon charm. */
export const HURT_MS = 1000;
export const CHARM = 1.6;
/** Pip's whetstone: the sword reaches this much farther. */
export const WHETSTONE = 1.3;
/** How close (in pixels) the knight's feet must be to pick something up. */
export const PICKUP_PX = 18;
/** The lantern the knight carries, and with the lantern oil from the shrine. */
export const LANTERN = 120;
export const LANTERN_OIL = 175;
/** How far the Moonlantern's light shows hidden bridges (and lets the knight walk them), and how close a moved moonstone glimmers. */
export const VEIL_PX = 100;
export const GLIMMER_PX = 110;

/**
 * The floating touch stick: rim and knob radius, the dead zone, how far a finger drags before a
 * touch steers instead of tapping, and how close to an axis (dy / dx) a drag snaps onto it.
 */
export const STICK = { r: 60, knob: 24, dead: 8, drag: 14, snap: 0.4 };

/** Touch buttons, bottom right: sword, roll, hookvine, bellseeds and the gust horn. */
export const BUTTONS = {
  sword: { x: 880, y: 456, r: 34 },
  roll: { x: 800, y: 490, r: 28 },
  vine: { x: 812, y: 410, r: 28 },
  seed: { x: 728, y: 468, r: 26 },
  horn: { x: 740, y: 394, r: 26 },
};

/**
 * The gust horn's blast: how far it reaches in front of the knight, how wide (it widens by `spread`
 * of the distance), how far it shoves foes, how long they reel, and how long before the next blast.
 */
export const GUST = { range: 130, width: 26, spread: 0.3, push: 64, stunMs: 900, cooldownMs: 900 };

/** Fishing: how long before a bite (a random time between the two), and how long a bite lasts. */
export const FISH_WAIT_MS = [1200, 3200] as const;
export const BITE_MS = 900;
/** The meals' effects: eel skewers roll this much faster and sooner, bream chowder this much more vine. */
export const SKEWER = { speed: 1.25, cooldown: 0.6 };
export const CHOWDER = 1.35;
/** Where a bellseed is planted: this far in front of the knight's feet. */
export const PLANT_REACH = 22;
