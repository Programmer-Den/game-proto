// Where things are drawn in the 960x560 view. The board itself is `GRID` in src/game/board.ts.
export { GRID, cellCentre } from '../game/board';

/**
 * The designed view. The HUD, board and panel fill its top 540 pixels; the 20 below them keep the
 * shared corner buttons (full screen and pause, in the bottom left) off the board's bottom row.
 */
export const VIEW = { w: 960, h: 560 };
/**
 * The clay strip across the top: its centre line, the title and the garden tag under it (which
 * opens the garden picker), and the x of each tag's icon and number.
 */
export const HUD = {
  y: 32,
  title: { x: 16, y: 22 },
  garden: { x: 95, y: 45, w: 158, h: 18 },
  wave: { x: 235, w: 105 },
  leaf: { x: 370, w: 75, icon: 392, text: 410 },
  sap: { x: 490, w: 80, icon: 512, text: 528 },
  bloom: { x: 583, w: 232, flowers: 603, gap: 17, text: 684 },
  /** The best wave, right-aligned at x. */
  best: { x: 878 },
};
/** The speed button, at the right end of the HUD strip. */
export const SPEED_BUTTON = { x: 914, y: 32, w: 54, h: 32 };
/** The menu a tapped golem opens, above or below it: Raise, Aim, Move and Uproot (or, raising to level 3, its two forms and Back). */
export const GOLEM_MENU = { w: 270, h: 50, chip: { w: 60, h: 38, gap: 6 } };
/** The garden picker's cards, side by side. */
export const GARDEN_CARD = { y: 318, w: 236, h: 196, gap: 20 };
/** The side panel right of the board. */
export const PANEL = { x: 800, y: 64, w: 148, h: 448 };
/** The seed cards, by their centres, in the order of SEEDS: two tall golem cards, the shorter thorn card and the hedge strip. */
export const SEED_BUTTONS = { x: 874, ys: [120, 204, 276, 330], hs: [76, 76, 52, 40], w: 136 };
/** The next wave's preview, above the wave button. */
export const PREVIEW = { x: 808, y: 358, w: 132, h: 60 };
/** The one-line hint between the preview and the wave button. */
export const HINT = { y: 432 };
/** The button that sends the next wave, or calls it early. */
export const WAVE_BUTTON = { x: 874, y: 470, w: 136, h: 48 };
export const BUTTON = { w: 200, h: 44 };

export const UI_DEPTH = 10_000;
export const FONT = '"DejaVu Sans", "Trebuchet MS", Verdana, system-ui, sans-serif';
