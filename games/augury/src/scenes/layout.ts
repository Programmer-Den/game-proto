// Where things are drawn, in two designed frames: 960x540 for a screen wider than it is tall
// (`WIDE`, the stage with a side panel at its right) and 540x960 for an upright one (`TALL`, the
// top bar, the stage, the tools and then the side panel's cards and score under it). A screen of
// another shape grows the view around the frame (`viewFrame`); the backdrop fills the whole view
// and the camera keeps the frame in the middle.

type Point = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };

export type Layout = {
  /** The designed frame. */
  view: { w: number; h: number };
  /** The run screen's bar along the top (top-left), with the mode's name, the middle (hearts, the
   * Blitz clock, the daily five or whose turn it is) and the puzzle's clock bar, by their centres
   * or left ends. */
  top: Rect & { title: Point; mid: Point; clock: Point & { w: number } };
  /** The omen a puzzle offers, a button in the top bar by its centre. */
  omen: Rect;
  /** The Leave button in the top bar, by its centre. */
  leave: Rect;
  /** The stage with the puzzle (top-left) and the board's area inside it. */
  stage: Rect;
  board: Rect;
  /** Undo, Hint and Skip under the stage, clear of the corner buttons at the bottom left. */
  tools: { xs: number[]; y: number; w: number; h: number };
  /** The side panel: its list of cards (top-left), the score box, anchored at its bottom, and the daily five's ghost (top-left). */
  side: { list: Rect; score: { x: number; w: number; bottom: number }; ghost: Rect };
  /** The menu: the title, the mode cards (by their centres, as many across as `xs` has) and the
   * Records button. */
  menu: {
    title: Point;
    tagline: Point & { w: number };
    /** Each card's lines by their offset from its centre: the numeral, icon, name, text and best. */
    cards: { xs: number[]; ys: number[]; w: number; h: number; dy: { numeral: number; icon: number; name: number; text: number; best: number } };
    records: Rect;
    /** With a saved run: the Continue button, and the Records button beside it. */
    resume: Rect;
    recordsAside: Rect;
    line: Point;
  };
  /** The journey map: a row per temple (its name at `label`, its steps from `x0`, `step` apart). */
  journey: { title: Point; rows: number[]; label: { x: number; dy: number }; nodes: { x0: number; step: number; r: number; dy: number }; line: Point };
  /** The practice picker: level buttons (the four levels and Trial) and the thirteen puzzle cards, by their centres (a short last row is centred). */
  practice: {
    title: Point;
    levels: { xs: number[]; ys: number[]; w: number; h: number };
    cards: { xs: number[]; ys: number[]; w: number; h: number };
  };
  /** The records table: its frame, header row, row step, columns (-1 leaves the skill out), the
   * mastery badge's column and the two lines under it. */
  records: { title: Point; frame: Rect; top: number; step: number; cols: number[]; mastery: number; skills: Point; bests: Point & { w: number } };
  back: Rect;
  /** Cards dealt over the stage (a draft, relics), by their centres. */
  deal: { title: Point; xs2: number[]; xs3: number[]; y: number; w: number; h: number };
  /** The end card and its buttons, by their centres. */
  end: Rect;
  endButtons: { xs: number[]; y: number; w: number; h: number };
};

export const WIDE: Layout = {
  view: { w: 960, h: 540 },
  top: { x: 24, y: 14, w: 912, h: 54, title: { x: 42, y: 41 }, mid: { x: 440, y: 41 }, clock: { x: 640, y: 41, w: 150 } },
  omen: { x: 311, y: 41, w: 140, h: 42 },
  leave: { x: 892, y: 41, w: 70, h: 30 },
  stage: { x: 24, y: 80, w: 620, h: 404 },
  board: { x: 44, y: 146, w: 580, h: 330 },
  tools: { xs: [234, 364, 494], y: 507, w: 124, h: 34 },
  side: { list: { x: 660, y: 80, w: 276, h: 306 }, score: { x: 660, w: 276, bottom: 526 }, ghost: { x: 660, y: 368, w: 276, h: 94 } },
  menu: {
    title: { x: 480, y: 64 },
    tagline: { x: 480, y: 108, w: 860 },
    cards: { xs: [126, 362, 598, 834], ys: [218, 386], w: 222, h: 160, dy: { numeral: -64, icon: -32, name: 6, text: 36, best: 66 } },
    records: { x: 480, y: 494, w: 180, h: 36 },
    resume: { x: 365, y: 494, w: 270, h: 36 },
    recordsAside: { x: 605, y: 494, w: 180, h: 36 },
    line: { x: 480, y: 527 },
  },
  journey: {
    title: { x: 480, y: 46 },
    rows: [124, 206, 288, 370, 452],
    label: { x: 40, dy: 0 },
    nodes: { x0: 290, step: 88, r: 25, dy: -6 },
    line: { x: 480, y: 516 },
  },
  practice: {
    title: { x: 480, y: 46 },
    levels: { xs: [192, 336, 480, 624, 768], ys: [104], w: 132, h: 38 },
    cards: { xs: [126, 362, 598, 834], ys: [170, 256, 342, 428], w: 224, h: 80 },
  },
  records: {
    title: { x: 480, y: 46 },
    frame: { x: 36, y: 82, w: 888, h: 362 },
    top: 102,
    step: 24,
    cols: [60, 240, 340, 560, 650, 740, 830],
    mastery: 440,
    skills: { x: 480, y: 466 },
    bests: { x: 480, y: 498, w: 880 },
  },
  back: { x: 84, y: 46, w: 110, h: 36 },
  deal: { title: { x: 480, y: 150 }, xs2: [370, 590], xs3: [260, 480, 700], y: 320, w: 196, h: 260 },
  end: { x: 480, y: 280, w: 520, h: 330 },
  endButtons: { xs: [380, 580], y: 400, w: 170, h: 44 },
};

export const TALL: Layout = {
  view: { w: 540, h: 960 },
  top: { x: 16, y: 14, w: 508, h: 96, title: { x: 34, y: 41 }, mid: { x: 110, y: 86 }, clock: { x: 230, y: 86, w: 210 } },
  omen: { x: 340, y: 41, w: 160, h: 42 },
  leave: { x: 476, y: 41, w: 70, h: 30 },
  stage: { x: 16, y: 122, w: 508, h: 520 },
  board: { x: 26, y: 202, w: 488, h: 430 },
  tools: { xs: [130, 270, 410], y: 668, w: 132, h: 40 },
  side: { list: { x: 16, y: 700, w: 300, h: 210 }, score: { x: 328, w: 196, bottom: 910 }, ghost: { x: 328, y: 700, w: 196, h: 116 } },
  menu: {
    title: { x: 270, y: 96 },
    tagline: { x: 270, y: 150, w: 480 },
    cards: { xs: [97, 270, 443], ys: [300, 486, 672], w: 164, h: 176, dy: { numeral: -70, icon: -38, name: 2, text: 36, best: 72 } },
    records: { x: 270, y: 806, w: 200, h: 44 },
    resume: { x: 190, y: 806, w: 270, h: 44 },
    recordsAside: { x: 420, y: 806, w: 140, h: 44 },
    line: { x: 270, y: 852 },
  },
  journey: {
    title: { x: 270, y: 104 },
    rows: [230, 362, 494, 626, 758],
    label: { x: 30, dy: -50 },
    nodes: { x0: 54, step: 62, r: 22, dy: 6 },
    line: { x: 270, y: 862 },
  },
  practice: {
    title: { x: 300, y: 46 },
    levels: { xs: [97, 270, 443], ys: [106, 152], w: 164, h: 38 },
    cards: { xs: [140, 400], ys: [222, 318, 414, 510, 606, 702, 798], w: 250, h: 88 },
  },
  records: {
    title: { x: 300, y: 46 },
    frame: { x: 16, y: 92, w: 508, h: 470 },
    top: 118,
    step: 32,
    cols: [30, -1, 175, 262, 315, 368, 421],
    mastery: 236,
    skills: { x: 270, y: 600 },
    bests: { x: 270, y: 640, w: 480 },
  },
  back: { x: 74, y: 46, w: 110, h: 36 },
  deal: { title: { x: 270, y: 330 }, xs2: [170, 370], xs3: [100, 270, 440], y: 520, w: 160, h: 260 },
  end: { x: 270, y: 480, w: 500, h: 360 },
  endButtons: { xs: [175, 365], y: 610, w: 170, h: 44 },
};

/** The layout for a view of this shape. */
export function layoutFor(width: number, height: number) {
  return height > width ? TALL : WIDE;
}

/** The designed wide frame, which `main.ts` gives Phaser. */
export const VIEW = WIDE.view;

export const UI_DEPTH = 10;
