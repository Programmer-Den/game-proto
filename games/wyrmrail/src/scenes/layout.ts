import type { Tile } from '../game/map';

// Where things are drawn in the 960x540 view. The villages' places on the grid are in
// src/game/map.ts. The game fills screens of other shapes (`setupScaling` with `fill`), so the
// view can be wider or taller: `placeBoard` then stretches `BOARD`, centres the grid in it (`ISO`)
// and pins the panel to the right edge (`PANEL`). At 960x540 nothing moves.

/** The designed view. A filling view is at least this big; read its real size with `viewSize`. */
export const VIEW = { w: 960, h: 540 };
export const HUD_HEIGHT = 44;

/** The board: the part of the view left of the panel, between the HUD and the hint line. Set by `placeBoard`. */
export const BOARD = { x: 0, y: 48, w: 768, h: 448 };
/** The board's size in the designed view. */
export const DESIGN_BOARD = { w: BOARD.w, h: BOARD.h };

/**
 * The valley seen isometrically: a tile is a diamond `tw` wide and `th` tall, and (`ox`, `oy`) is
 * the screen point of the grid's top corner (column 0, row 0). Columns run down to the right, rows
 * down to the left. `depth` is how deep the blocks under the tiles are.
 */
export const ISO = { ox: 288, oy: 84, tw: 76, th: 38, depth: 15 };
/** Where the grid's top corner is in the designed view, before `placeBoard` centres it in a bigger board. */
const ISO_ORIGIN = { x: ISO.ox, y: ISO.oy };

/** The screen point of a spot on the valley floor (`u` along columns, `v` along rows, in tiles), `z` pixels up. */
export const iso = (u: number, v: number, z = 0) => ({ x: ISO.ox + ((u - v) * ISO.tw) / 2, y: ISO.oy + ((u + v) * ISO.th) / 2 - z });

/** The centre of a tile on screen, on the valley floor. */
export const tileCenter = (t: Tile) => iso(t.c + 0.5, t.r + 0.5);

/** The tile under a screen point (it may be off the grid). */
export function tileAt(x: number, y: number): Tile {
  const a = (x - ISO.ox) / (ISO.tw / 2);
  const b = (y - ISO.oy) / (ISO.th / 2);
  return { c: Math.floor((a + b) / 2), r: Math.floor((b - a) / 2) };
}

/** Draw order for things standing on the valley: further down the screen is in front. */
export const groundDepth = (y: number) => 100 + y;

/** The orders and upgrades panel on the right, by its centre line. Set by `placeBoard`. */
export const PANEL = { x: 864, w: 176, top: 48 };
/** The room the panel takes at the view's right edge, its border included. */
const PANEL_ROOM = VIEW.w - (PANEL.x - PANEL.w / 2 - 8);
/** The hint bar's height under the board. */
const HINT_BAR = VIEW.h - BOARD.y - BOARD.h;

/**
 * Lays the board out for a view of `width` x `height` (at least the designed 960x540): the board
 * fills everything left of the panel between the HUD and the hint bar, the grid sits in its
 * middle and the panel hugs the right edge.
 */
export function placeBoard(width: number, height: number) {
  BOARD.w = width - PANEL_ROOM;
  BOARD.h = height - BOARD.y - HINT_BAR;
  ISO.ox = ISO_ORIGIN.x + Math.round((BOARD.w - DESIGN_BOARD.w) / 2);
  ISO.oy = ISO_ORIGIN.y + Math.round((BOARD.h - DESIGN_BOARD.h) / 2);
  PANEL.x = width - PANEL_ROOM + 8 + PANEL.w / 2;
}
/** The order cards, by their centres: room for four, three orders and a workshop's goods. */
export const ORDER_CARD = { y: 106, h: 62, gap: 6 };
/** The Upgrades heading, the upgrade buttons (moved down with the view's bottom edge in a taller view), the Depot toggle and the Remove and Plain track toggles (side by side, `half` wide), by their centres. */
export const UPGRADES_Y = 353;
export const BUTTONS = { wings: 377, hoard: 411, second: 445, depot: 479, remove: 513, h: 30, half: (PANEL.w - 6) / 2 };
/** The charter cards on the board at a round's start: two side by side, by their centres. */
export const CHARTER_CARD = { y: 250, w: 300, h: 110, gap: 20 };
/** The hint line, up from the view's bottom edge. */
export const HINT_BOTTOM = 22;
/** The end panel's buttons, in the designed view (centred in a bigger board): the last row's centre line, each button's size, the room between two and between rows. */
export const END_BUTTON = { y: 330, w: 200, h: 44, gap: 12, step: 54 };
/** A moult's trait cards on the board, side by side, by their centres (WR16). */
export const MOULT_CARD = { y: 250, w: 220, h: 120, gap: 16 };
/** The daily valley's link in the board's top left corner (WR17). */
export const DAILY_LINK = { x: 14, y: 10 };

/** How far behind the head each of the wyrm's parts rides along the track, in pixels: three coils, then two wagons and the third a moult can give it. */
export const SEGMENT_GAPS = [0, 17, 31, 44, 68, 96, 124];

export const UI_DEPTH = 10_000;
export const FONT = 'monospace';
