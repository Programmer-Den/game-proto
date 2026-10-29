import { BARREL as BARREL_PLACE, DESKS, GRID, MAX_DESKS } from '../game/state';

// Where things are drawn in the 960x540 view: the forge on the left, the anvils in the middle and
// the counter with the adventurers on the right.

export const VIEW = { w: 960, h: 540 };
export const HUD_HEIGHT = 40;

/** The furnace's flame window (its texture's top left corner and size), and the Forge button with its heat bar below it. */
export const FURNACE_WINDOW = { x: 80, y: 160, w: 100, h: 130 };
/**
 * The column of buttons under the furnace (mode, Forge, heat bar, upgrades) spans x 54 to 226 and
 * ends at y 492, so it stays clear of the shared corner buttons (full screen, pause) in the
 * bottom left on a 16:9 screen and on a sideways phone.
 */
const COLUMN = { x: 140, w: 172 };
export const FORGE_BUTTON = { x: COLUMN.x, y: 342, w: COLUMN.w, h: 44 };
export const HEAT_BAR = { x: COLUMN.x - COLUMN.w / 2, y: 370, w: COLUMN.w, h: 10 };
/** The royal commission's banner in the top bar, by its top left corner. Swords are delivered by dropping them on it. */
export const BANNER = { x: 316, y: 4, w: 330, h: 32 };
export const onBanner = (x: number, y: number) => x >= BANNER.x && x < BANNER.x + BANNER.w && y >= 0 && y < BANNER.y + BANNER.h + 6;
/** The guild reputation meter, top left above the furnace, by its top left corner. */
export const REPUTATION = { x: 30, y: 50, w: 200, h: 46, segments: 10 };
/** The switch between forging swords and bucklers, by its centre, between the furnace and the Forge button. */
export const MODE_BUTTON = { x: COLUMN.x, y: 304, w: 160, h: 26 };
/** The charter's edict, written over the lancet under the reputation meter, by its centre. */
export const EDICT_PLAQUE = { x: 130, y: 122 };
/** The wide buttons of the guild perk and edict windows. */
export const WIDE_BUTTON = { w: 360, h: 42 };
/** The upgrade buttons, by their centres. */
export const UPGRADE_BUTTONS = { x: COLUMN.x, ys: [401, 438, 475], w: COLUMN.w, h: 34 };

/** The anvil board (five rows, the last one bought): its top left corner and the size of each cell. */
export const BOARD = { x: 244, y: 50, cell: 86 };
/** How big a sword or anvil is drawn on the board, against the 100px cell it was painted for. */
export const CELL_SCALE = BOARD.cell / 100;
/** The fifth row's box while it is not bought yet, with its build button. */
export const ROW_BOX = { x: BOARD.x, y: BOARD.y + GRID.rows * BOARD.cell, w: GRID.cols * BOARD.cell, h: BOARD.cell };
export const ROW_BUTTON = { x: BOARD.x + (GRID.cols * BOARD.cell) / 2, y: ROW_BOX.y + 56, w: 250, h: 36 };
/** The quench barrel beside the board, by its centre. */
export const BARREL = { x: 636, y: 428, w: 72, h: 92 };
/** The scrap bin above the barrel, by its centre: a sword, buckler or gem dropped on it is thrown away. */
export const SCRAP = { x: 636, y: 322, w: 64, h: 64 };
export const onScrap = (x: number, y: number) => Math.abs(x - SCRAP.x) <= SCRAP.w / 2 && Math.abs(y - SCRAP.y) <= SCRAP.h / 2;
export const slotCentre =(slot: number) => ({
  x: BOARD.x + (slot % GRID.cols) * BOARD.cell + BOARD.cell / 2,
  y: BOARD.y + Math.floor(slot / GRID.cols) * BOARD.cell + BOARD.cell / 2,
});
/** The anvil under a point, or null. */
export function slotAt(x: number, y: number) {
  const col = Math.floor((x - BOARD.x) / BOARD.cell);
  const row = Math.floor((y - BOARD.y) / BOARD.cell);
  if (col < 0 || row < 0 || col >= GRID.cols || row >= GRID.maxRows) return null;
  return row * GRID.cols + col;
}
/** The anvil or the barrel (`BARREL_PLACE`) under a point, or null. */
export function placeAt(x: number, y: number) {
  if (Math.abs(x - BARREL.x) <= BARREL.w / 2 && Math.abs(y - BARREL.y) <= BARREL.h / 2) return BARREL_PLACE;
  return slotAt(x, y);
}

/** The row of swords discovered so far, under the board: one frame per tier, by its centre. */
export const DISCOVERED = { y: 507, size: 36, gap: 40 };
export const discoveredCentre = (tier: number, tiers: number) => ({
  x: BOARD.x + (GRID.cols * BOARD.cell) / 2 + (tier - 1 - (tiers - 1) / 2) * DISCOVERED.gap,
  y: DISCOVERED.y,
});

/**
 * The spots at the counter, from the top: each is a box with the adventurer and their order. With
 * a fourth desk every desk is drawn smaller, by `deskScale`, to fit the same column.
 */
export const DESK = { x: 682, y: 54, w: 262, h: 152, gap: 4 };
const COLUMN_H = DESKS * DESK.h + (DESKS - 1) * DESK.gap;
export const deskScale = (desks = DESKS) => (desks <= DESKS ? 1 : (COLUMN_H - (desks - 1) * DESK.gap) / (desks * DESK.h));
export const deskBox = (desk: number, desks = DESKS) => {
  const k = deskScale(desks);
  const w = DESK.w * k;
  const h = DESK.h * k;
  return { x: DESK.x + (DESK.w - w) / 2, y: DESK.y + desk * (h + DESK.gap), w, h };
};
export const deskCentre = (desk: number, desks = DESKS) => {
  const b = deskBox(desk, desks);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
};
export function deskAt(x: number, y: number, desks = DESKS) {
  const first = deskBox(0, desks);
  if (x < first.x || x >= first.x + first.w) return null;
  const desk = Math.floor((y - DESK.y) / (first.h + DESK.gap));
  return desk >= 0 && desk < Math.min(desks, MAX_DESKS) && y - deskBox(desk, desks).y < first.h ? desk : null;
}

/** Inside a desk, relative to its top left corner: the order card, its patience bar and the fit tag. */
export const ORDER = { x: 89, y: 8, w: 162, h: 100 };
export const PATIENCE = { x: 89, y: 125, w: 162, h: 12, segments: 12 };
export const TAG = { x: 9, y: 9, w: 75, h: 33 };

/** The bottom-right link to the guild perks, left of "New smithy". */
export const PERK_LINK = { x: 700, y: 527 };

/** The window shown when the Crown Blade is delivered (and the other windows), by its centre. */
export const WIN = { x: 480, y: 270, w: 440, h: 230, tallH: 310 };

export const UI_DEPTH = 10_000;
export const FONT = 'Georgia, "Times New Roman", serif';
