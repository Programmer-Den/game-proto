// Where things are drawn in the 960x540 view. The temple itself is placed by `TOWER_X` and the
// sizes in src/game/state.ts.

export const VIEW = { w: 960, h: 540 };
/** The y of the plinth's top in the world; the camera scrolls up from here as the temple grows. */
export const PLINTH_Y = 468;
/** The camera keeps the temple's top at or below this height on screen. */
export const TOP_SCREEN_Y = 300;
/** The side panel on the left. */
export const PANEL = { x: 16, y: 16, w: 214, h: 508 };
/** The blessing cards, by their centres: three across, or four narrower ones under the Many-Handed. */
export const CARDS = { xs: [350, 590, 830], y: 226, w: 220, h: 170 };
export const CARDS_FOUR = { xs: [333, 511, 689, 867], y: 226, w: 168, h: 170 };
/** The two patron cards before the first stone, and their title. */
export const PATRON_TITLE = { x: 590, y: 100 };
export const PATRON_CARDS = { xs: [470, 710], y: 262, w: 220, h: 214 };
/** Under the patron cards: the row of shrine sites, and below it the daily shrine's, the village's and the race's buttons, by their centres. */
export const SITE_ROW = { xs: [420, 590, 760], y: 400, w: 158, h: 40 };
export const BOTTOM_ROW = { xs: [360, 590, 820], y: 452, w: 220, h: 40 };
/** The pilgrims' village, in place of the patron cards: its three buildings and the Back button, by their centres. */
export const VILLAGE_CARDS = { xs: [360, 590, 820], y: 266, w: 220, h: 200 };
export const VILLAGE_BACK = { x: 590, y: 452, w: 200, h: 40 };
export const BUTTON = { w: 200, h: 40 };
/** The offer's title, and the reroll button beside it, by their centres. */
export const OFFER_TITLE = { x: 520, y: 96 };
export const REROLL = { x: 842, y: 96, w: 156, h: 36 };
/** The material row under the cards: its title and its three buttons, by their centres. */
export const MATERIAL_TITLE = { x: 590, y: 320 };
export const MATERIAL_ROW = { xs: [372, 590, 808], y: 346, w: 200, h: 34 };
/** The curse toggle under the material row, by its centre. */
export const CURSE = { x: 590, y: 390, w: 700, h: 36 };
/** The shop's title and its row of buttons, by their centres. */
export const SHOP_TITLE = { x: 590, y: 426 };
export const SHOP_ROW = { xs: [372, 590, 808], y: 460, w: 200, h: 36 };
/** The button that ends a break with no blessing, where the cards would be. */
export const BUILD_ON = { x: 590, y: 226, w: 240, h: 52 };
/** The reserve's swap button in the side panel, by its centre. */
export const RESERVE_BUTTON = { x: 194, y: 190, w: 60, h: 18 };
/** The lean meter in the side panel: its top-left, width and height. */
export const LEAN_BAR = { x: 66, y: 238, w: 148, h: 10 };
/** The goal box in the side panel: its top, and the size and gap of its tier pips. */
export const GOAL = { y: 356, pip: 13, gap: 2 };

export const UI_DEPTH = 10_000;
export const FONT = 'monospace';
