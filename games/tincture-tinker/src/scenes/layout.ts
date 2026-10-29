// Where things are drawn in the 960x540 view.

export const VIEW = { w: 960, h: 540 };
/** The board's top left corner and the size of a cell. */
export const BOARD = { x: 46, y: 46, cell: 56 };
/** The cream tray the board sits in. */
export const TRAY = { x: 36, y: 36, w: 468, h: 468 };
/** The rank ribbon above the board, and the star bar inside it. */
export const RIBBON = { x: 46, y: 7, w: 458, h: 23, barX: 191, barW: 85 };
/** The order panel on the right. */
export const PANEL = { x: 536, y: 30, w: 394, h: 480 };
/** One row per ingredient the order asks for, from the top; a twin order's four rows sit closer. */
export const NEEDS = { x: 566, y: 236, row: 56, barX: 608, barW: 220, barH: 14, twinY: 230, twinRow: 41 };
/** The pantry's note, right-aligned at the foot of the order panel under the coins. */
export const PANTRY = { x: 906, y: 490 };
/** The four bench tool buttons in the order panel, `gap` apart: Stir, Sift, Pestle and Funnel. */
export const TOOL = { x: 560, y: 393, w: 80, h: 43, gap: 88 };
/**
 * The caption cartouche along the bottom, its right end under the order panel's: it grows to the
 * left, so even the longest caption stays clear of the corner buttons (full screen, pause)
 * in the bottom left.
 */
export const CAPTION = { right: 930, y: 514, h: 21 };
/** The button on the result card. */
export const BUTTON = { w: 200, h: 44 };

export const UI_DEPTH = 10_000;
/** Serif italics on the label; Caladea is Georgia's metric twin on Linux. */
export const SERIF = 'Georgia, Caladea, "DejaVu Serif", "Times New Roman", serif';

export const cellX = (col: number) => BOARD.x + col * BOARD.cell + BOARD.cell / 2;
export const cellY = (row: number) => BOARD.y + row * BOARD.cell + BOARD.cell / 2;
