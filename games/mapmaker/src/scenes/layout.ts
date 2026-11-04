// Where things are drawn in the 960x540 view. The island grid's size is GRID in src/game/state.ts.

export const VIEW = { w: 960, h: 540 };
/** The top-left corner of the island map and the size of a tile, in screen pixels. */
export const MAP = { x: 24, y: 64, tile: 40 };
/** The side panel with the supplies, coins, commission, riddle and the Camp and Return to port buttons. */
export const PANEL = { x: 652, y: 24, w: 284, h: 492 };
/** The panel's bottom row: Camp on the left, Return to port on the right. */
export const CAMP_BUTTON = { x: PANEL.x + 18 + 41, y: 476, w: 82, h: 40 };
export const RETURN_BUTTON = { x: PANEL.x + PANEL.w - 18 - 80, y: 476, w: 160, h: 40 };
/** The chart, Royal Atlas and harbor overlay, centred over the map. */
export const OVERLAY = { x: 324, y: 284, w: 600, h: 470 };
/** The overlay's main button: Sell chart, Keep charting, then Set sail. */
export const OVERLAY_BUTTON = { x: OVERLAY.x, y: OVERLAY.y + OVERLAY.h / 2 - 40 };
/** The harbor's upgrade rows (its left column): the first row's y, the gap between rows, and the Buy buttons' x. */
export const SHOP = { y: 152, gap: 40, buyX: OVERLAY.x - OVERLAY.w / 2 + 34 + 36 + 230 + 48 };
/** The harbor's hand cards (its right column): the first card's centre y, the gap, and their size. */
export const HANDS_COLUMN = { x: OVERLAY.x + OVERLAY.w / 2 - 34 - 150, y: 158, gap: 46, w: 150, h: 40 };
/** The commission board under the upgrades: the first row's centre y and the gap between rows. */
export const BOARD = { y: 370, gap: 24, h: 22 };
/** The village trade card under the hand cards (its column is `HANDS_COLUMN`): its centre y and height. */
export const TRADE_CARD = { y: 308, h: 40 };
export const BUTTON = { w: 200, h: 40 };
export const SMALL_BUTTON = { w: 96, h: 34 };

export const UI_DEPTH = 10_000;
export const FONT = "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/** The screen centre of tile (x, y). */
export const tileCentre = (x: number, y: number) => ({
  x: MAP.x + (x + 0.5) * MAP.tile,
  y: MAP.y + (y + 0.5) * MAP.tile,
});
