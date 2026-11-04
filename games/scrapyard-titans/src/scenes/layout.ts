/**
 * Where everything sits, laid out for the designed 960x540 view and moved by `placeLayout` to the
 * view the game actually has (it fills the screen's shape, see `setupScaling`'s `fill`): the board,
 * bench, shop and draft ring sit in the designed-size frame in the middle of the view, the left
 * column is pinned to the view's left edge, the right column to its right edge, and the bottom row
 * of buttons and panels to its bottom edge. At exactly 960x540 nothing moves. Also and the board's fake 3D: an 8x8 grid tilted away from
 * the viewer, far rows narrower and shorter than near ones. `project` turns a (fractional) tile
 * position into a screen point and a scale; `tileAt` turns a screen point back into a tile.
 */
import { watching } from '../../../../shared/watch';

export const VIEW = { w: 960, h: 540 };
/** The view the game has (at least `VIEW`), and the offset of the designed-size frame in its middle. */
export const VIEWPORT = { w: VIEW.w, h: VIEW.h, fx: 0, fy: 0 };

export const BOARD_VIEW = { topY: 92, bottomY: 362, topW: 380, bottomW: 512, cx: 480 };

/** The screen y of the board line `z` rows down (0 is the far edge, 8 the near edge). */
function rowY(z: number) {
  const t = z / 8;
  return BOARD_VIEW.topY + (BOARD_VIEW.bottomY - BOARD_VIEW.topY) * (t * 0.8 + t * t * 0.2);
}

const rowW = (z: number) => BOARD_VIEW.topW + (BOARD_VIEW.bottomW - BOARD_VIEW.topW) * (z / 8);

/** A corner or point of the board: `col` 0 to 8 across, `z` 0 to 8 down. */
export function boardPoint(col: number, z: number) {
  return { x: BOARD_VIEW.cx + (col / 8 - 0.5) * rowW(z), y: rowY(z) };
}

/** The centre of a (fractional) tile and how big things there are drawn (1 at the near edge). */
export function project(col: number, row: number) {
  const p = boardPoint(col + 0.5, row + 0.5);
  return { x: p.x, y: p.y, s: rowW(row + 0.5) / BOARD_VIEW.bottomW };
}

/** The tile under a screen point, or null off the board. */
export function tileAt(x: number, y: number): { col: number; row: number } | null {
  if (y < BOARD_VIEW.topY || y > BOARD_VIEW.bottomY) return null;
  let lo = 0;
  let hi = 8;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (rowY(mid) < y) lo = mid;
    else hi = mid;
  }
  const z = lo;
  const left = boardPoint(0, z).x;
  const width = rowW(z);
  const col = Math.floor(((x - left) / width) * 8);
  const row = Math.floor(z);
  if (col < 0 || col > 7 || row < 0 || row > 7) return null;
  return { col, row };
}

/** Units are drawn at this times the tile scale. */
export const UNIT_SCALE = 1.45;

export const BENCH = { y: 394, w: 50, h: 46, gap: 6, count: 9 };
export const benchX = (i: number) => BOARD_VIEW.cx - (BENCH.count * BENCH.w + (BENCH.count - 1) * BENCH.gap) / 2 + BENCH.w / 2 + i * (BENCH.w + BENCH.gap);

export const SHOP = { y: 432, h: 100, cardW: 116, x0: 172, gap: 8 };
export const shopCardX = (i: number) => SHOP.x0 + i * (SHOP.cardW + SHOP.gap);
/** The zone a robot is dropped on to sell it: the whole shop row. */
export const SELL_ZONE = { x: SHOP.x0, y: SHOP.y, w: 5 * SHOP.cardW + 4 * SHOP.gap, h: SHOP.h };

/** The gold, level and buttons panel at the bottom left. */
export const LEFT_BOTTOM = { x: 8, y: 426 };
/** Where the terrain legend sits, over the shop's left end. */
export const TERRAIN_LEGEND = { x: 170, y: 412 };
export const BUTTONS = {
  reroll: { x: 12, y: 464, w: 70, h: 28 },
  xp: { x: 88, y: 464, w: 70, h: 28 },
  sell: { x: 76, y: 500, w: 82, h: 30 },

  fight: { x: 800, y: 440, w: 150, h: 48 },
  speed: { x: 800, y: 496, w: 72, h: 30 },
  skill: { x: 800, y: 440, w: 150, h: 48 },
  /** Right of the bench: keeps the shop for the next round. */
  lock: { x: 736, y: 380, w: 62, h: 26 },
  /** Left of the bench in duo mode: pass the selected robot, or give gold, to the partner. */
  pass: { x: 162, y: 380, w: 62, h: 26 },
};

export const TRAITS_PANEL = { x: 8, y: 38, rowH: 21, maxRows: 9 };
export const ITEMS_PANEL = { x: 12, y: 264, size: 26, cols: 5 };
/** Under ?watch the watch panel takes the top right corner, so the list of players moves down. */
export const PLAYERS_PANEL = { x: 808, y: watching ? 76 : 38, w: 144, rowH: 30 };
export const INFO_PANEL = watching ? { x: 808, y: 322, w: 144, h: 102 } : { x: 808, y: 286, w: 144, h: 138 };

export const COMMANDER_HOME = { x: 196, y: 352 };
export const RIVAL_HOME = { x: 754, y: 104 };

export const DRAFT_RING = { cx: 480, cy: 226, rx: 180, ry: 72 };

/** The designed places, which `placeLayout` moves from. */
const DESIGN = structuredClone({ BOARD_VIEW, BENCH, SHOP, BUTTONS, INFO_PANEL, PLAYERS_PANEL, COMMANDER_HOME, RIVAL_HOME, DRAFT_RING, LEFT_BOTTOM, TERRAIN_LEGEND });

type Spot = { x: number; y: number };
const move = (r: Spot, from: Spot, dx: number, dy: number) => {
  r.x = from.x + dx;
  r.y = from.y + dy;
};

/**
 * Lays everything out for a `w` x `h` view whose designed-size frame starts at `fx`, `fy` (from
 * `viewFrame`). Call it once the view is known, before drawing.
 */
export function placeLayout(w: number, h: number, fx: number, fy: number) {
  const D = DESIGN;
  Object.assign(VIEWPORT, { w, h, fx, fy });
  const right = w - VIEW.w;
  const bottom = h - VIEW.h;
  BOARD_VIEW.cx = D.BOARD_VIEW.cx + fx;
  BOARD_VIEW.topY = D.BOARD_VIEW.topY + fy;
  BOARD_VIEW.bottomY = D.BOARD_VIEW.bottomY + fy;
  BENCH.y = D.BENCH.y + fy;
  SHOP.x0 = D.SHOP.x0 + fx;
  SHOP.y = D.SHOP.y + bottom;
  SELL_ZONE.x = SHOP.x0;
  SELL_ZONE.y = SHOP.y;
  for (const k of ['reroll', 'xp', 'sell'] as const) move(BUTTONS[k], D.BUTTONS[k], 0, bottom);
  for (const k of ['fight', 'speed', 'skill'] as const) move(BUTTONS[k], D.BUTTONS[k], right, bottom);
  move(BUTTONS.lock, D.BUTTONS.lock, fx, fy);
  move(BUTTONS.pass, D.BUTTONS.pass, fx, fy);
  move(LEFT_BOTTOM, D.LEFT_BOTTOM, 0, bottom);
  move(INFO_PANEL, D.INFO_PANEL, right, bottom);
  move(PLAYERS_PANEL, D.PLAYERS_PANEL, right, 0);
  move(COMMANDER_HOME, D.COMMANDER_HOME, fx, fy);
  move(RIVAL_HOME, D.RIVAL_HOME, fx, fy);
  move(TERRAIN_LEGEND, D.TERRAIN_LEGEND, fx, bottom);
  DRAFT_RING.cx = D.DRAFT_RING.cx + fx;
  DRAFT_RING.cy = D.DRAFT_RING.cy + fy;
}
