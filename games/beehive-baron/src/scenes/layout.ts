import Phaser from 'phaser';
import { smooth } from '../art/paper';
import type { Kind } from '../game/honey';
import { FLOWERS, GRID, MAX_BEES, localSlot } from '../game/state';
import { viewFrame, viewSize } from '../../../../shared/scaling';

// Where things are drawn in the 960x540 view: the hive with its comb on the left, the meadow the
// bees fly to on the top right, and the buttons on a board below the meadow.

export const VIEW = { w: 960, h: 540 };

/**
 * The whole view in layout coordinates. The game fills the screen's shape, so the view can be
 * wider or taller than `VIEW`; the camera scrolls so `VIEW` sits in its middle (`viewFrame`), and
 * the scenery and the HUD stretch out to these edges. At 960x540 it is exactly `VIEW`.
 */
export function viewEdges(scene: Phaser.Scene) {
  const frame = viewFrame(scene);
  const { width, height } = viewSize(scene);
  const x = -frame.x;
  const y = -frame.y;
  return { x, y, w: width, h: height, right: x + width, bottom: y + height };
}
export const HUD_HEIGHT = 40;

/** The comb: the centre of the top left cell and each hexagon's radius (pointy side up). Both hives' combs draw in the same place. */
export const COMB = { x: 104, y: 132, r: 34 };
const HEX_W = Math.sqrt(3) * COMB.r;
const ROW_H = 1.5 * COMB.r;
export const cellCentre = (slot: number) => {
  const col = localSlot(slot) % GRID.cols;
  const row = Math.floor(localSlot(slot) / GRID.cols);
  return { x: COMB.x + col * HEX_W + (row % 2) * (HEX_W / 2), y: COMB.y + row * ROW_H };
};
/** The six corners of a cell's hexagon, `inset` pixels in from its edge. */
export function hexPoints(slot: number, inset = 0) {
  const c = cellCentre(slot);
  const r = COMB.r - inset;
  return [...Array(6).keys()].map((i) => {
    const a = ((60 * i - 90) * Math.PI) / 180;
    return new Phaser.Math.Vector2(c.x + r * Math.cos(a), c.y + r * Math.sin(a));
  });
}
/** The comb spot under a point (on the comb shown), or null: the nearest centre, if the point is inside its hexagon. */
export function cellAt(x: number, y: number) {
  let best: number | null = null;
  let bestD = Infinity;
  for (let slot = 0; slot < GRID.cols * GRID.rows; slot++) {
    const c = cellCentre(slot);
    const d = Math.hypot(x - c.x, y - c.y);
    if (d < bestD) [best, bestD] = [slot, d];
  }
  return bestD <= HEX_W / 2 ? best : null;
}

/**
 * The hive box: the area its texture covers (roof, frame, the recess the comb sits in, the entrance
 * slit and the landing board), the plaque on its roof that shows the comb bonus, and the entrance
 * the bees fly in and out of.
 */
export const HIVE = { x: 36, y: 46, w: 388, h: 336 };
export const PLAQUE = { x: 324, y: 68, w: 148, h: 18 };
/** The tabs on the roof that switch between the hives' combs once the swarm is caught, by hive: room for the estate's four, left of the plaque. */
export const HIVE_TAB = { w: 44, h: 18 };
export const hiveTab = (hive: number) => ({ x: 82 + hive * (HIVE_TAB.w + 4), y: 68 });
export const ENTRANCE = { x: 233, y: 338 };
/**
 * Where the bees at home rest: a hive's worth (`MAX_BEES`) side by side along the entrance, and a
 * second hive's on the landing board in front of them, so no bee ever sits over the comb. With the
 * estate's third and fourth hives, the rows show the pair of hives the comb shown belongs to.
 */
export const homeSpot = (i: number) => ({ x: ENTRANCE.x - 132 + (i % MAX_BEES) * 24, y: ENTRANCE.y + 6 + Math.floor(i / MAX_BEES) * 24 });

/** The flowers in the meadow the foragers visit (the head's centre), and the ground their stems stand on. */
export const flowerSpot = (i: number) => ({ x: 590 + (i % FLOWERS) * 66, y: i % 2 ? 196 : 160 });
export const FLOWER_GROUND = 274;

/** The far hill's ridge, which the goal meadows lie along, and its height at x. */
export const FAR_RIDGE = smooth([[-10, 260], [430, 235], [500, 210], [580, 220], [665, 190], [750, 165], [840, 145], [900, 135], [970, 142]]);
export function farY(x: number) {
  for (let i = 0; i < FAR_RIDGE.length - 1; i++) {
    const [a, b] = [FAR_RIDGE[i], FAR_RIDGE[i + 1]];
    if (x >= a[0] && x <= b[0]) return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0] || 1);
  }
  return FAR_RIDGE[FAR_RIDGE.length - 1][1];
}

/** The goal card on the top right, naming the next meadow and how far along its goal is. */
export const GOAL = { x: 530, y: 50, w: 410, h: 50 };
/**
 * The meadows the goals unlock, on the far hill, by `MEADOWS` index: the strip's left and right
 * ends and the tag that names it while it is the next one locked.
 */
export const MEADOW_SPOTS = [
  { x0: 762, x1: 960, tag: { x: 878, y: 128 } },
  { x0: 598, x1: 762, tag: { x: 680, y: 122 } },
  { x0: 428, x1: 598, tag: { x: 498, y: 188 } },
];
export const MEADOW_TAG = { w: 128, h: 22 };
/** The meadow strip each kind of nectar comes from, by `MEADOW_SPOTS` index (clover grows by the hive). */
const KIND_MEADOW: Record<Exclude<Kind, 'clover'>, number> = { lavender: 0, heather: 2 };
/** Where a forager gathers its nectar: a flower by the hive for clover, else a spot along that kind's meadow. */
export function forageSpot(kind: Kind, flower: number) {
  if (kind === 'clover') {
    const f = flowerSpot(flower);
    return { x: f.x, y: f.y - 16 };
  }
  const m = MEADOW_SPOTS[KIND_MEADOW[kind]];
  const x = m.x0 + 24 + (flower / (FLOWERS - 1)) * (m.x1 - m.x0 - 48);
  return { x, y: farY(x) + 18 };
}

/** The chip under the hive that says how much nectar the bees gathered while the page was closed. */
export const AWAY = { x: 56, y: 384, w: 359, h: 38 };
/**
 * The swarm chip while a crowded hive gets ready to swarm (tap it to catch the swarm): over the
 * meadow's foot, just above the button board, so the market under the hive stays in reach.
 */
export const SWARM = { x: 530, y: 250, w: 410, h: 38 };
/** The buyer's book chip on the near hill left of the button board, once the first jar is sold (tap it to open the book). */
export const BOOK = { x: 432, y: 250, w: 92, h: 38 };
/** The buyer's book card over everything, with a row per ask. */
export const BOOK_CARD = { x: VIEW.w / 2, y: VIEW.h / 2, w: 470, h: 276 };
/**
 * Under the book chip, in a column on the near hill left of the button board: the garden chip
 * (after the first gold), the candle workshop's (from 50 jars sold) and the royal warrant's (after
 * three golds). Each opens a card the size of the book's.
 */
export const GARDEN = { ...BOOK, y: 296 };
export const WORKSHOP = { ...BOOK, y: 342 };
export const WARRANT = { ...BOOK, y: 388 };
/** The card those chips open, over everything: a little bigger than the book's, for the garden's beds. */
export const ESTATE_CARD = { x: VIEW.w / 2, y: VIEW.h / 2, w: 520, h: 300 };
/** The hint line for a new player, in the same place (it hides while the chip shows). */
export const HINT = { x: 233, y: 403 };
/**
 * The market board, in the same place once the first jar is sold: a title column of `MARKET.label`
 * and an entry per kind of honey, `MARKET.entry` wide, that sends the foragers there when tapped.
 */
export const MARKET = { ...AWAY, label: 66, entry: 97 };
export const marketEntry = (i: number) => ({ x: MARKET.x + MARKET.label + i * MARKET.entry, y: MARKET.y, w: MARKET.entry - 2, h: MARKET.h });

/** The shelf of honey jars waiting to be sold, under the hive, and the mead casks at its right end. */
export const SHELF = { x: 80, y: 468, jarGap: 34, jars: 7 };
export const CASK = { x: 330, y: 468, gap: 36, w: 28, h: 30 };
export const caskSpot = (i: number) => ({ x: CASK.x + i * CASK.gap, y: CASK.y });

/** The board under the meadow with the buttons, by their centres. */
export const BOARD = { x: 530, y: 294, w: 420, h: 212 };
export const SEND_BUTTON = { x: 635, y: 322, w: 190, h: 44 };
export const SELL_BUTTON = { x: 845, y: 322, w: 190, h: 44 };
/** The shop: two columns of four rows, filled row by row; the last two spots hold the village order and the orchard contract cards. */
export const SHOP_BUTTONS = { xs: [635, 845], ys: [364, 402, 440, 478], w: 190, h: 34 };
export const shopSpot = (i: number) => ({ x: SHOP_BUTTONS.xs[i % 2], y: SHOP_BUTTONS.ys[Math.floor(i / 2)] });
export const ORDER = { ...shopSpot(6), w: SHOP_BUTTONS.w, h: SHOP_BUTTONS.h };
export const CONTRACT = { ...shopSpot(7), w: SHOP_BUTTONS.w, h: SHOP_BUTTONS.h };
/** The end card over everything once the fair's gold makes the player the Baron. */
export const END_CARD = { x: VIEW.w / 2, y: VIEW.h / 2, w: 420, h: 190 };

/** Where raiding wasps come in from and fly off to, beyond the right edge. */
export const WASP_FROM = { x: VIEW.w + 30, y: 150 };
export const WASP_TO = { x: VIEW.w + 40, y: 70 };

export const UI_DEPTH = 10_000;
/** A system font stack (no web fonts), drawn bold like the cut-paper lettering of the mockup. */
export const FONT = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
