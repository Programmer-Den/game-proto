// Where things are drawn in the 960x540 view. The art in src/art is painted in art units, twice these.

export const VIEW = { w: 960, h: 540 };
/** The board: its top left corner, its size in cells, and each cell's size in pixels. */
export const GRID = { x: 24, y: 46, cols: 10, rows: 7, cell: 64 };
/** The walnut tray the board sits in. */
export const TRAY = { x: 18, y: 40, w: 652, h: 460 };
/** The royal decree's sign above the board. */
export const DECREE = { x: 24, y: 6, w: 644, h: 30 };
/** The side panel on the right. */
export const PANEL = { x: 688, y: 24, w: 252, h: 492 };
/** The title plaque at the top of the panel. */
export const TITLE = { x: 697, y: 31, w: 234, h: 32 };
/** The island button at the right of the round line: shows the island and opens the islands card. */
export const ISLAND_BUTTON = { x: 878, y: 82, w: 108, h: 22 };
/** The goal bar under the score. */
export const GOAL_BAR = { x: 704, y: 120, w: 220, h: 16 };
/** The row under the goal bar showing the two gifts on offer for reaching it. */
export const GIFT_ROW = { x: 704, y: 142, h: 22 };
/** The season strip under the gift row: the round's season and its rule. */
export const SEASON = { x: 704, y: 170, w: 220, h: 22 };
/** The tile buttons, by their centres: one per kind in the hand (up to HAND), in BUILDINGS order. */
export const TILE_BUTTONS = { x: 814, w: 228, ys: [228, 290, 352], h: 60 };
/** The pouch line under the tile buttons: what is left to draw, by its top left. */
export const POUCH_LINE = { x: 704, y: 386, w: 220 };
/** The omen strip under the pouch line: what the next round brings, from round 3 on. */
export const OMEN = { x: 704, y: 426, w: 220, h: 22 };
/** The undo button under the omen strip, by its centre. */
export const UNDO_BUTTON = { x: 814, y: 474, w: 228, h: 28 };
/** The market trade card over the board, by its centre: a row of kinds to give two of, a row of gift buildings to take one of, and its two buttons. */
export const TRADE_CARD = { x: 346, y: 270, w: 600, h: 320, chip: { w: 68, h: 58, gap: 4 }, giveY: 130, takeY: 218, buttonY: 290 };
/** The gift choice card over the board, by its centre, and its two buttons. */
export const GIFT_CARD = { x: 346, y: 270, w: 440, h: 220, button: { w: 190, h: 96, dx: 100, dy: 30 } };
export const BUTTON = { w: 200, h: 40 };
/** The islands card over the board: the campaign's levels, the island of the day and a keypad for an island number. */
export const ISLANDS_CARD = {
  x: 346,
  y: 270,
  w: 600,
  h: 432,
  level: { y: 166, w: 62, h: 62, gap: 8 },
  daily: { x: 196, y: 302, w: 236, h: 72 },
  random: { x: 196, y: 384, w: 236, h: 48 },
  code: { x: 500, y: 282, w: 196, h: 34 },
  key: { x: 500, y: 328, w: 58, h: 34, gap: 6 },
  close: { x: 586, y: 82, w: 84, h: 28 },
};

/** The Feats button on the islands card's title line, left of Close, by its centre: opens the feats card. */
export const FEATS_BUTTON = { x: 476, y: 82, w: 108, h: 28 };
/** The feats card over the board: a row per feat with the skin it unlocks, then a swatch per tile skin (the islands card's level plaques). */
export const FEATS_CARD = { x: 346, y: 270, w: 600, h: 432, rowY: 138, rowH: 30, swatchY: 420 };
/** The game-over card and its three buttons' centres, from its middle. */
export const GAME_OVER = { w: 700, h: 260, dx: 226, dy: 88 };

export const UI_DEPTH = 10_000;
export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/** The middle of the cell at (col, row), in view pixels. */
export const cellCentre = (col: number, row: number) => ({
  x: GRID.x + col * GRID.cell + GRID.cell / 2,
  y: GRID.y + row * GRID.cell + GRID.cell / 2,
});
