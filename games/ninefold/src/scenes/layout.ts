// Where things are drawn, in two designed frames: 960x540 for a screen wider than it is tall
// (`WIDE`, the board with a panel at its right) and 540x960 for an upright one (`TALL`, a header,
// the board and a row of digit keys under it). A screen of another shape grows the view around the
// frame (`viewFrame`), and the camera keeps the frame in the middle.

type Point = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };

export type Layout = {
  /** The designed frame. */
  view: { w: number; h: number };
  /** The board: its top-left corner and side. */
  board: { x: number; y: number; size: number };
  /** The panel with the mode, hearts, clock and Menu button (and, when wide, the pad); top-left. */
  panel: Rect;
  /** How far down the panel its rows sit: the mode, the heading, hearts and clock, and the relics. */
  rows: { kicker: number; heading: number; status: number; relics: number };
  /** A box behind the pad and tools when they sit outside the panel; top-left. */
  dock?: Rect;
  /** The number pad: its top-left key's corner, key size, gap and keys per row. */
  pad: { x: number; y: number; w: number; h: number; gap: number; cols: number };
  /** The Notes, Erase, Undo and Hint buttons, by their centres, and their captions' size. */
  tools: { xs: number[]; y: number; w: number; h: number; font: number };
  /** The line naming the keyboard keys, by its centre. */
  keysHint: Point;
  /** The Menu button at the panel's top right, by its centre. */
  menuButton: Rect;
  /** The menu's title, box (top-left) and buttons, by their centres. */
  menu: {
    title: Point;
    box: Rect;
    daily: Rect;
    weekly: Rect;
    /** The caption size of the daily and weekly buttons. */
    topFont: number;
    /** The Classic levels, as many across as `xs` has, in rows at `ys`. */
    levels: { xs: number[]; ys: number[]; w: number; h: number; font: number };
    delve: Rect;
    /** The buttons either side of Delve that pick its ascension, by their centres. */
    ascentDown: Rect;
    ascentUp: Rect;
    /** The bottom row: the technique school, the styles and the calendar, and their captions' size. */
    school: Rect;
    styles: Rect;
    calendar: Rect;
    bottomFont: number;
    stats: Point;
  };
  /** The technique school: its title, its line, the lesson cards by their centres. */
  school: { title: Point; line: Point; cards: { xs: number[]; ys: number[]; w: number; h: number } };
  /** The calendar: its title, the month's name between its arrows, the grid (top-left, a cell's size; the weekdays head it) and two lines under it. */
  calendar: { title: Point; month: Point; prev: Rect; next: Rect; grid: { x: number; y: number; w: number; h: number }; line: Point; goal: Point };
  /** The style picker's title, its cards (as many across as `xs` has) and the Back button. */
  stylesTitle: Point;
  styleCards: { xs: number[]; ys: number[]; w: number; h: number; cell: number };
  back: Rect;
  /** The end-of-board card and its buttons, by their centres. */
  end: Rect;
  endButtons: { xs: number[]; y: number; w: number; h: number };
  /** The cleared-floor card (top-left), its title, its line, the next floor's line, and the relic cards by their centres. */
  relicBox: Rect & { title: number; line: number; next: number };
  relicCards: { xs: number[]; y: number; w: number; h: number };
};

const WIDE_PANEL = { x: 540, y: 22, w: 386, h: 470 };

export const WIDE: Layout = {
  view: { w: 960, h: 540 },
  board: { x: 40, y: 22, size: 460 },
  panel: WIDE_PANEL,
  rows: { kicker: 26, heading: 56, status: 100, relics: 128 },
  pad: { x: WIDE_PANEL.x + 24, y: WIDE_PANEL.y + 148, w: 104, h: 62, gap: 13, cols: 3 },
  tools: { xs: [WIDE_PANEL.x + 64, WIDE_PANEL.x + 150, WIDE_PANEL.x + 236, WIDE_PANEL.x + 322], y: WIDE_PANEL.y + 394, w: 80, h: 40, font: 13 },
  keysHint: { x: WIDE_PANEL.x + WIDE_PANEL.w / 2, y: WIDE_PANEL.y + WIDE_PANEL.h - 22 },
  menuButton: { x: WIDE_PANEL.x + WIDE_PANEL.w - 58, y: WIDE_PANEL.y + 34, w: 92, h: 32 },
  menu: {
    title: { x: 480, y: 62 },
    box: { x: 120, y: 132, w: 720, h: 384 },
    daily: { x: 310, y: 186, w: 300, h: 56 },
    weekly: { x: 650, y: 186, w: 300, h: 56 },
    topFont: 18,
    levels: { xs: [179, 265, 351, 437, 523, 609, 695, 781], ys: [270], w: 80, h: 54, font: 15 },
    delve: { x: 480, y: 352, w: 330, h: 54 },
    ascentDown: { x: 282, y: 352, w: 50, h: 54 },
    ascentUp: { x: 678, y: 352, w: 50, h: 54 },
    school: { x: 262, y: 430, w: 196, h: 50 },
    styles: { x: 480, y: 430, w: 220, h: 50 },
    calendar: { x: 698, y: 430, w: 196, h: 50 },
    bottomFont: 17,
    stats: { x: 480, y: 490 },
  },
  school: { title: { x: 480, y: 50 }, line: { x: 480, y: 98 }, cards: { xs: [300, 660], ys: [214, 392], w: 340, h: 150 } },
  calendar: {
    title: { x: 480, y: 50 }, month: { x: 480, y: 102 }, prev: { x: 300, y: 102, w: 48, h: 40 }, next: { x: 660, y: 102, w: 48, h: 40 },
    grid: { x: 256, y: 136, w: 64, h: 46 }, line: { x: 480, y: 470 }, goal: { x: 480, y: 504 },
  },
  stylesTitle: { x: 480, y: 50 },
  styleCards: { xs: [138, 366, 594, 822], ys: [146, 284, 422], w: 216, h: 122, cell: 24 },
  back: { x: 90, y: 50, w: 120, h: 40 },
  end: { x: 480, y: 270, w: 460, h: 280 },
  endButtons: { xs: [380, 580], y: 360, w: 170, h: 46 },
  relicBox: { x: 120, y: 60, w: 720, h: 440, title: 98, line: 134, next: 176 },
  relicCards: { xs: [270, 480, 690], y: 330, w: 190, h: 200 },
};

const TALL_PANEL = { x: 20, y: 20, w: 500, h: 152 };

export const TALL: Layout = {
  view: { w: 540, h: 960 },
  board: { x: 30, y: 192, size: 480 },
  panel: TALL_PANEL,
  rows: { kicker: 26, heading: 58, status: 104, relics: 134 },
  dock: { x: 20, y: 690, w: 500, h: 172 },
  pad: { x: 30, y: 704, w: 50, h: 70, gap: 3.75, cols: 9 },
  tools: { xs: [87, 209, 331, 453], y: 818, w: 114, h: 50, font: 15 },
  keysHint: { x: 270, y: 886 },
  menuButton: { x: TALL_PANEL.x + TALL_PANEL.w - 58, y: TALL_PANEL.y + 34, w: 92, h: 32 },
  menu: {
    title: { x: 270, y: 110 },
    box: { x: 40, y: 220, w: 460, h: 560 },
    daily: { x: 157, y: 290, w: 214, h: 66 },
    weekly: { x: 383, y: 290, w: 214, h: 66 },
    topFont: 15,
    levels: { xs: [100, 213, 327, 440], ys: [400, 466], w: 104, h: 56, font: 15 },
    delve: { x: 270, y: 562, w: 300, h: 60 },
    ascentDown: { x: 84, y: 562, w: 52, h: 60 },
    ascentUp: { x: 456, y: 562, w: 52, h: 60 },
    school: { x: 117, y: 682, w: 142, h: 56 },
    styles: { x: 270, y: 682, w: 152, h: 56 },
    calendar: { x: 423, y: 682, w: 142, h: 56 },
    bottomFont: 14,
    stats: { x: 270, y: 748 },
  },
  school: { title: { x: 300, y: 50 }, line: { x: 270, y: 112 }, cards: { xs: [270], ys: [240, 410, 580, 750], w: 460, h: 150 } },
  calendar: {
    title: { x: 300, y: 50 }, month: { x: 270, y: 140 }, prev: { x: 84, y: 140, w: 56, h: 50 }, next: { x: 456, y: 140, w: 56, h: 50 },
    grid: { x: 39, y: 190, w: 66, h: 72 }, line: { x: 270, y: 690 }, goal: { x: 270, y: 736 },
  },
  stylesTitle: { x: 300, y: 50 },
  styleCards: { xs: [143, 397], ys: [170, 320, 470, 620, 770], w: 244, h: 136, cell: 24 },
  back: { x: 90, y: 50, w: 120, h: 40 },
  end: { x: 270, y: 480, w: 460, h: 300 },
  endButtons: { xs: [170, 370], y: 580, w: 180, h: 50 },
  relicBox: { x: 20, y: 220, w: 500, h: 510, title: 266, line: 306, next: 360 },
  relicCards: { xs: [107, 270, 433], y: 560, w: 156, h: 260 },
};

/** The layout for a view of this size: upright views get `TALL`. */
export function layoutFor(width: number, height: number) {
  return height > width ? TALL : WIDE;
}

/** The designed wide frame, which `main.ts` gives Phaser. */
export const VIEW = WIDE.view;

export const UI_DEPTH = 1000;
