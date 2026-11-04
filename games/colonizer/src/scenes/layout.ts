// Where the HUD sits, in game space. The world is drawn between the top bar and the panel.
//
// The game fills the screen's shape (`setupScaling(game, { fill: true })`), so the view can be
// wider or taller than its designed 960x540. `fitLayout` (called once by the BootScene, from
// `viewSize`) moves everything pinned to the right edge by the extra width and the panel down by the
// extra height. At 960x540 every value is the one below.

/** The view's size in game pixels; the designed 960x540 until `fitLayout` runs. */
export let W = 960;
export let H = 540;
export const TOP_H = 30;
export let PANEL_Y = 430;

/** The top bar's slots: icon x, and the x of the slanted bar before each slot. */
export const TOP_SLOTS = {
  wood: 8,
  food: 102,
  ore: 196,
  pop: 284,
  age: 386,
  clock: 492,
  faction: 576,
} as const;
/** Slanted bars between the slots, with their wool colours (in stitch.ts's T names). */
export const TOP_BARS: [number, 'red' | 'sage' | 'ochre' | 'indigo'][] = [
  [92, 'sage'],
  [186, 'ochre'],
  [274, 'indigo'],
  [376, 'red'],
  [482, 'sage'],
  [566, 'ochre'],
  [736, 'indigo'],
  [846, 'red'],
];
/** The top bar's right end, pinned to the view's right edge: the boon and edge icons and two beasts. */
export const TOP_RIGHT = { boon: 722, edge: 752, beasts: [790, 906] };
/** Where the three age pips sit. */
export const AGE_PIPS = { x: 424, y: 15, gap: 16, r: 6.5 };

/** The deeds card under the top bar, at the right. */
export const DEED_CARD = { x: 716, y: 36, w: 236, h: 92 };
/** Under the deeds card: who holds each relic, the rivals' temperaments, and a standing Monument's count. */
export const STATUS_CARD = { x: 716, y: 134, w: 236, h: 50, hMonument: 70 };
/** A campaign scenario's card: its name, goal and progress, at the top left under the top bar. */
export const MISSION_CARD = { x: 8, y: 36, w: 236, h: 62 };
/** The horn toast, centred under the top bar. */
export const TOAST = { x: 480, y: 38, w: 440, h: 24 };

/** Panel parts: the selection at the left, the buttons in the middle and the minimap at the right. */
export const SEL = { x: 12, y: PANEL_Y + 6, w: 276 };
export const BUTTONS = { x: 302, y: PANEL_Y + 7, w: 124, h: 30, dx: 130, dy: 34, cols: 4, rows: 3 };
export const BOON = { x: 302, y: PANEL_Y + 24, w: 252, h: 80, dx: 262 };
export const MINI = { x: 848, y: PANEL_Y + 8, s: 96 };
export const PANEL_BARS = [292, 828];
/** The menu's option rows under the faction cards: the map kind and the number of rivals (in the menu's 960x540 frame). */
export const MENU_OPTS = { y: 438, w: 96, h: 24, gap: 6, kindX: 152, rivalsX: 640 };
/** The menu's mode toggle (skirmish or campaign) over the cards, and the campaign's five scenario tiles in the option rows' place. */
export const MENU_MODE = { y: 156, w: 120, gap: 8 };
export const MENU_SCENARIOS = { y: 438, w: 150, h: 34, gap: 8 };

/**
 * Fits the HUD to a view of `w` x `h` game pixels: the right-hand pieces follow the right edge, the
 * toast stays centred and the panel sits on the bottom edge. Called once, before any HUD is drawn.
 */
let fitted = false;
export function fitLayout(w: number, h: number) {
  if (fitted) return;
  fitted = true;
  const dx = w - 960;
  W = w;
  H = h;
  PANEL_Y = h - 110;
  for (const bar of TOP_BARS) if (bar[0] > 700) bar[0] += dx;
  TOP_RIGHT.boon += dx;
  TOP_RIGHT.edge += dx;
  TOP_RIGHT.beasts = TOP_RIGHT.beasts.map((x) => x + dx);
  DEED_CARD.x += dx;
  STATUS_CARD.x += dx;
  TOAST.x = w / 2;
  SEL.y = PANEL_Y + 6;
  BUTTONS.y = PANEL_Y + 7;
  BOON.y = PANEL_Y + 24;
  MINI.x += dx;
  MINI.y = PANEL_Y + 8;
  PANEL_BARS[1] += dx;
}
