// Where the HUD and panels are drawn in the 960x540 view. The lanterns and the jar are placed by
// src/game/places.ts, since the rules move moths between them.

export const VIEW = { w: 960, h: 540 };
/** The bar across the top: night, hearths and coins on the left, dusk in the middle, lanterns lit on the right. */
export const HUD = { h: 40 };
/** The dusk bar, which empties as night comes. */
export const DUSK_BAR = { x: 330, y: 12, w: 300, h: 16 };
/** The panel shown between nights, with the night's tally and the upgrades. */
export const NIGHT_PANEL = { x: 480, y: 280, w: 600, h: 460 };
/**
 * The upgrade buttons in that panel, by their centres: the UPGRADE_IDS, then the cask and the
 * hearth, three by three.
 */
export const SHOP = { xs: [288, 480, 672], ys: [254, 314, 374], w: 184, h: 52 };
/** The panel's "Next dusk" button, and the game-over "New keep" button. */
export const NEXT_BUTTON = { x: 480, y: 448 };
/** The game-over and Great Festival panels, centred on the view. */
export const SMALL_PANEL = { w: 520, h: 240 };
export const BUTTON = { w: 200, h: 40 };
/** The herald's order card, pinned under the HUD on the left. */
export const ORDER = { x: 12, y: 50, w: 256, h: 58 };
/** The night's kind plaque, pinned under the HUD on the right. */
export const KIND_TAG = { x: 738, y: 50, w: 210, h: 40 };
/** The gust warning plaque, beside the lantern the gust is coming for; the owl's warning plaque is the same size. */
export const GUST_TAG = { w: 132, h: 40 };
/** The window-call plaque, beside the lantern a window asks for. */
export const CALL_TAG = { w: 150, h: 40 };
/** The panel of a fifth nightfall's choice of district, centred on the view; the curses' panel is the same. */
export const MOVE_PANEL = { w: 600, h: 330 };
/**
 * The district cards in that panel, by their centres, in the order of MOVE_IDS (two by two); the
 * Harbour Festival's three boon cards use the first row and the middle of the second.
 */
export const MOVE_CARDS = { xs: [335, 625], ys: [236, 316], w: 280, h: 62 };
/** Where the HUD shows the oil cask: its icon and the fills beside it. */
export const CASK_HUD = { x: 296, y: 20 };
/** The tap area around each lantern, and around a bat. */
export const LANTERN_HIT = { w: 64, h: 72 };
export const BAT_HIT = { w: 64, h: 52 };
/** The tap area around a moth resting on a jar, to swap it to the other jar. */
export const MOTH_HIT = { w: 28, h: 36 };

export const UI_DEPTH = 10_000;
/** A system serif stack (no web fonts): the lettering of a carved puppet-theatre plaque. */
export const FONT = 'Georgia, "DejaVu Serif", "Times New Roman", serif';
