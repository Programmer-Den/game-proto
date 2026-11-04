// Where things are drawn, laid out for the designed 960x540 view. The game fills every screen shape
// (`setupScaling(game, { fill: true })`), so `fitLayout` moves these to the view picked at start,
// before anything is painted: the world gets wider and its sky taller, the HUD's middle and right
// stay pinned, and the margin under the road keeps to the bottom edge. At 960x540 nothing moves.
// The rules' own sizes (the knight's box, jump and trap heights) are in src/game/state.ts.

/** The designed view. */
export const DESIGN = { w: 960, h: 540 };
/** The view the game runs in: the designed size grown to the screen's shape (see `fitLayout`). */
export const VIEW = { ...DESIGN };
/** The road's top in the designed view. */
export const DESIGN_GROUND_Y = 430;
export const HUD_HEIGHT = 40;
/** The top of the road, where the knight's feet run; lower on a taller view, under a taller sky. */
export let GROUND_Y = DESIGN_GROUND_Y;
/** Where the knight runs across the screen; the course scrolls past. Further right on a wider view. */
export let RUNNER_X = 220;
/** Taps above this line jump, taps below it slide. */
export let TAP_SPLIT_Y = VIEW.h / 2;
/** How far the HUD's middle items (the stage's name, streak chip, run track) and its right-hand items moved from the designed view. */
export const HUD_SHIFT = { mid: 0, right: 0 };
/** The miniature's gold frame: the painted scene sits inside it, the vellum margin round it. */
export const FRAME = { x: 7, y: 42, w: 946, bottom: GROUND_Y + 11 };
/** The run track under the HUD: its vellum strip, and the ruled line from 0 m to its end. */
export const TRACK = { left: 220, right: 710, x0: 320, x1: 640, y: 54, h: 22 };
/** The stage's tag right of the run track: its ground and road, or the boss's stomps left. */
export const TAG = { x: 718, y: 43, w: 232, h: 22 };
/** The herald's dare under the tag, with its progress. */
export const DARE_TAG = { x: 718, y: 69, w: 232, h: 20 };
/** The stage's title, shown as it begins: its name and its rule. */
export const STAGE_TITLE = { x: 560, y: 150 };
/** The armoury panel's rows, by their centres' y, the knights' row under them (its heading and cells by their centres), and the panel's size. */
export const ARMOURY_PANEL = { w: 640, h: 500, rowY: [-128, -58, 12], knightsY: 70, knightX: [-205, 0, 205], knightCellY: 120 };
/** The streak chip in the HUD. */
export const STREAK_CHIP = { x: 565, y: 8, w: 98, h: 24 };
/**
 * The scrollwork in the margin under the road, and the rubric caption: centred at `captionX` and
 * at most `captionW` wide, so it stays clear of the shared corner buttons in the bottom left (on a
 * small phone they reach about 165 px in) and of the touch Slide and Jump buttons on the right.
 */
export const MARGIN = { scrollY: 487, captionX: 458, captionY: 525, captionW: 540 };
/** The boon cards at a checkpoint, by their centres: two of them, or three after a met dare (one once only Field Dressing is left). The road cards use the two. */
export const CARDS = { xs: { 1: [480], 2: [330, 630], 3: [205, 480, 755] } as Record<number, number[]>, y: 300, w: 250, h: 260 };
export const BUTTON = { w: 180, h: 40 };
/** The round Slide and Jump buttons in the margin's bottom right, shown on touch screens: their centres and radius. */
export const ACTION_BUTTONS = { y: 490, r: 40, slideX: 780, jumpX: 890 };

export const UI_DEPTH = 10_000;
export const FONT = 'Georgia, "Times New Roman", "DejaVu Serif", serif';

/**
 * Moves the layout to a view of `w` x `h` game pixels (`viewSize`), at least the designed size:
 * `dx` more wide puts the knight and the HUD's middle `dx / 2` right and its right-hand items `dx`
 * right; `dy` more tall lowers the road and everything under it by `dy`, so the sky above grows.
 * Overlays centre in the view. Called once by `BootScene`, before any art is painted.
 */
export function fitLayout(w: number, h: number) {
  const dx = Math.max(0, Math.round(w - DESIGN.w));
  const dy = Math.max(0, Math.round(h - DESIGN.h));
  if (VIEW.w !== DESIGN.w || VIEW.h !== DESIGN.h || (dx === 0 && dy === 0)) return;
  const mid = Math.round(dx / 2);
  VIEW.w += dx;
  VIEW.h += dy;
  GROUND_Y += dy;
  RUNNER_X += mid;
  TAP_SPLIT_Y = VIEW.h / 2;
  HUD_SHIFT.mid = mid;
  HUD_SHIFT.right = dx;
  FRAME.w += dx;
  FRAME.bottom += dy;
  for (const k of ['left', 'right', 'x0', 'x1'] as const) TRACK[k] += mid;
  TAG.x += dx;
  DARE_TAG.x += dx;
  STAGE_TITLE.x += mid;
  STAGE_TITLE.y += Math.round(dy / 2);
  STREAK_CHIP.x += mid;
  MARGIN.scrollY += dy;
  MARGIN.captionX += mid;
  MARGIN.captionY += dy;
  for (const xs of Object.values(CARDS.xs)) xs.forEach((x, i) => (xs[i] = x + mid));
  CARDS.y += Math.round(dy / 2);
  ACTION_BUTTONS.y += dy;
  ACTION_BUTTONS.slideX += dx;
  ACTION_BUTTONS.jumpX += dx;
}
