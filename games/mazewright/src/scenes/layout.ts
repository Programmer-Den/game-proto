import { COLS, ROWS } from '../game/rules';

// Where things are drawn. The game is designed at 960x540 (`VIEW`); a screen of another shape grows
// the view around that frame (`viewFrame`). The lawn fills the whole view, the bars are pinned to
// its top and bottom edges, and the grid sits in the middle of the frame.

export const VIEW = { w: 960, h: 540 };
/** One cell, in pixels. */
export const CELL = 40;
/** The grid's top-left corner inside the 960x540 frame. */
export const GRID = { x: 40, y: 50, w: COLS * CELL, h: ROWS * CELL };
/** The bars along the top and the bottom of the view. */
export const BAR_H = 44;
/** The pouch's tool buttons in the bottom bar (up to six), from this far in from the left, clear of the corner buttons. */
export const TOOLS = { x: 176, w: 84, h: 34, gap: 6 };
/** Where the picked tool's use is told, in the top bar. */
export const TIP_X = 520;
/** The Start wave and speed buttons, from the right edge of the bottom bar. */
export const WAVE_BUTTON = { w: 172, h: 34 };
export const SPEED_BUTTON = { w: 52, h: 34 };
/** The Gardens button, at the right of the top bar. */
export const BACK_BUTTON = { w: 104, h: 30 };
/** The panel that opens over a picked tower; one more row for the Aim or Turn button. */
export const PANEL = { w: 172, h: 98, row: 32, trick: 34 };
/** The garden cards on the picker, by their centres in the frame. */
export const CARDS = { xs: [190, 480, 770], y: 262, w: 260, h: 232 };
/** The pouch's tower chips under the cards, in rows of up to `perRow`, centred in the frame and clear of the corner buttons. */
export const CHIPS = { y: 442, w: 84, h: 32, gap: 6, perRow: 8, labelY: 430 };

export const DEPTH = { lawn: 0, board: 1, fx: 2, hud: 5, panel: 6, overlay: 8 };
