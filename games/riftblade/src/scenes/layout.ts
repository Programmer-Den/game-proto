/**
 * Screen layout, in game pixels. The game is designed at 960x540 (`VIEW`) and fills the screen's
 * shape (`setupScaling(game, { fill: true })`): `fitLayout` sets `SCREEN` to the real view and pins
 * the HUD below to its edges, and the panels (laid out for `VIEW`) are moved into `FRAME`, the
 * designed-size rectangle in the middle of the view. The world itself is open and endless.
 */

export const VIEW = { w: 960, h: 540 };
/** The view the game shows, in game pixels: `VIEW` grown to the screen's shape. */
export const SCREEN = { w: VIEW.w, h: VIEW.h };
/** Where the designed 960x540 rectangle sits in the view; the panels are moved there. */
export const FRAME = { x: 0, y: 0 };
/** The hero always stands in the middle of the view; the camera follows. */
export const CENTER = { x: VIEW.w / 2, y: VIEW.h / 2 };

export const FONT = 'system-ui, "Segoe UI", Roboto, sans-serif';

/** The XP bar across the top edge. */
export const XP_BAR = { x: 0, y: 0, w: VIEW.w, h: 8 };
/** The health bar, top left, and the list of upgrades held under it. */
export const HP_BAR = { x: 16, y: 18, w: 220, h: 12 };
export const KIT = { x: 16, y: 58, row: 15 };
/** The run clock (top middle), the level (top right) and the boss's health bar. */
export const TIMER = { x: VIEW.w / 2, y: 30 };
export const LEVEL = { x: VIEW.w - 16, y: 22 };
/** The planet ("2/4 Swamp world") and the credits, under the level. */
export const PLANET_TAG = { x: VIEW.w - 16, y: 44 };
export const CREDITS_TAG = { x: VIEW.w - 16, y: 63 };
export const BOSS_BAR = { x: VIEW.w / 2 - 160, y: 56, w: 320, h: 10 };
/** The side objective's lines under the clock (where the boss bar goes; the two never show together). */
export const OBJECTIVE_HUD = { x: VIEW.w / 2, y: 52 };
/** The round signature button, bottom right. */
export const SIG_BUTTON = { x: VIEW.w - 70, y: VIEW.h - 70, r: 42 };
/** The floating touch stick: rim radius (full speed there), knob radius and dead zone. */
export const STICK = { r: 60, knob: 24, dead: 6 };

/**
 * The hero select screen: two rows of six small cards on the left (the soldiers first, then the
 * knights, then Elara Voss and Triad-77), and the chosen hero's details on the right with the Fight
 * button.
 */
/** The hero select's cards: 8 a row, 3 rows (24 heroes), left of the detail panel. */
export const HERO_CARD = { w: 72, h: 128, top: 84, gap: 6, cols: 8, left: 14 };
export function heroCardRect(i: number) {
  const col = i % HERO_CARD.cols;
  const row = Math.floor(i / HERO_CARD.cols);
  return { x: HERO_CARD.left + col * (HERO_CARD.w + HERO_CARD.gap), y: HERO_CARD.top + row * (HERO_CARD.h + HERO_CARD.gap), w: HERO_CARD.w, h: HERO_CARD.h };
}
export const HERO_DETAIL = { x: 642, y: 84, w: 304, h: 400 };
export const FIGHT = { x: 658, y: 416, w: 272, h: 50 };
/** Once a boss rush is open, Fight makes room for its button beside it. */
export const FIGHT_SHORT = { x: 658, y: 416, w: 178, h: 50 };
export const RUSH_BUTTON = { x: 844, y: 416, w: 86, h: 50 };
/** The hero's mastery row (once it has mastery XP), just above the Heat row or Fight; its colours toggle at the right. */
export const MASTERY_ROW = { x: 658, w: 272, h: 24, colourW: 96 };
/** The rift heat row above Fight, shown once the hero has won: a lower and a higher arrow. */
export const HEAT_ROW = { x: 658, y: 366, w: 272, h: 42 };
export const HEAT_DOWN = { x: HEAT_ROW.x, y: HEAT_ROW.y + 3, w: 36, h: 36 };
export const HEAT_UP = { x: HEAT_ROW.x + HEAT_ROW.w - 36, y: HEAT_ROW.y + 3, w: 36, h: 36 };

/**
 * The hero select's top buttons, each shown once it has something: the Armoury and the Codex top
 * left, the Daily and Weekly runs top right (the title sits between them). The Armoury's cards and
 * Back button follow.
 */
export const ARMOURY_BUTTON = { x: 14, y: 14, w: 170, h: 40 };
export const CODEX_BUTTON = { x: 192, y: 14, w: 170, h: 40 };
export const ARMOURY_CARD = { w: 172, h: 250, y: 150, gap: 182 };
export function armouryCardRect(i: number, n: number) {
  const cx = VIEW.w / 2 + (i - (n - 1) / 2) * ARMOURY_CARD.gap;
  return { x: cx - ARMOURY_CARD.w / 2, y: ARMOURY_CARD.y, w: ARMOURY_CARD.w, h: ARMOURY_CARD.h };
}
export const BACK = { x: VIEW.w / 2 - 110, y: 430, w: 220, h: 50 };

/** The hero select's Weekly run button (top right, after a first run) and the weekly panel's mutator cards and buttons. */
export const WEEKLY_BUTTON = { x: VIEW.w - 184, y: 14, w: 170, h: 40 };
export const DAILY_BUTTON = { x: VIEW.w - 362, y: 14, w: 170, h: 40 };
export const MUTATOR_CARD = { x: 400, y: 140, w: 250, h: 150, gap: 270 };
export const WEEKLY_START = { x: VIEW.w / 2 + 10, y: 430, w: 220, h: 50 };
export const WEEKLY_BACK = { x: VIEW.w / 2 - 230, y: 430, w: 220, h: 50 };

/** The codex: a tab per page, its entries in four columns below. */
export const CODEX_TAB = { y: 104, w: 172, h: 54, gap: 180 };
export function codexTabRect(i: number, n: number) {
  const cx = VIEW.w / 2 + (i - (n - 1) / 2) * CODEX_TAB.gap;
  return { x: cx - CODEX_TAB.w / 2, y: CODEX_TAB.y, w: CODEX_TAB.w, h: CODEX_TAB.h };
}
export const CODEX_GRID = { x: 70, y: 176, col: 214, row: 18.5, cols: 4 };
/** The codex's Back and its Skill overview button, side by side. */
export const CODEX_BACK = { x: VIEW.w / 2 - 230, y: 430, w: 220, h: 50 };
export const SKILLS_BUTTON = { x: VIEW.w / 2 + 10, y: 430, w: 220, h: 50 };

/** The skill overview: a tab per page, the page's names on the left, the one picked described on the right. */
export const SKILL_TAB = { y: 100, w: 106, h: 44, gap: 112 };
export function skillTabRect(i: number, n: number) {
  const cx = VIEW.w / 2 + (i - (n - 1) / 2) * SKILL_TAB.gap;
  return { x: cx - SKILL_TAB.w / 2, y: SKILL_TAB.y, w: SKILL_TAB.w, h: SKILL_TAB.h };
}
export const SKILL_LIST = { x: 36, y: 160, w: 530, h: 258 };
export const SKILL_DETAIL = { x: 584, y: 156, w: 344, h: 262 };

/** The new-hero panel shown mid-run, and its Continue button. */
export const UNLOCK = { x: VIEW.w / 2 - 200, y: 96, w: 400, h: 340 };
export const CONTINUE = { x: VIEW.w / 2 - 110, y: 362, w: 220, h: 48 };

/** The level-up cards: three, or four narrower and taller ones (Elara Voss's Hope). */
export const LEVEL_CARD = { w: 254, h: 290, y: 296, gap: 276 };
export const LEVEL_CARD4 = { w: 214, h: 316, y: 300, gap: 228 };
export function levelCardRect(i: number, n = 3) {
  const c = n > 3 ? LEVEL_CARD4 : LEVEL_CARD;
  const cx = VIEW.w / 2 + (i - (n - 1) / 2) * c.gap;
  return { x: cx - c.w / 2, y: c.y - c.h / 2, w: c.w, h: c.h };
}

/** The star map: the planet just cleared (left), the next one (right) and the nodes between. */
export const MAP = { from: { x: 120, y: 290 }, to: { x: 840, y: 290 }, node: { x: 400, r: 34, w: 300, h: 92 } };
export function mapNodeRect(i: number, n: number) {
  const cy = 290 + (i - (n - 1) / 2) * 118;
  return { x: MAP.node.x - 50, y: cy - MAP.node.h / 2, w: MAP.node.w, h: MAP.node.h };
}
/** Where a node's round icon sits. */
export function mapNodeSpot(i: number, n: number) {
  const r = mapNodeRect(i, n);
  return { x: MAP.node.x, y: r.y + r.h / 2 };
}

/** The space map: one column per jump, its planets stacked; the next jump's planets are cards to tap. */
export const CHART = { cols: [130, 370, 610, 850], pitch: 130, w: 204, h: 124, r: 20 };
/** A column of four planets: closer together, with lower cards (the disc beside the name). */
export const CHART4 = { pitch: 106, w: 216, h: 98, r: 14 };
/** The centre of planet `i` of `n` in column `col`. */
export function chartSpot(col: number, i: number, n: number) {
  return { x: CHART.cols[col], y: 290 + (i - (n - 1) / 2) * (n > 3 ? CHART4.pitch : CHART.pitch) };
}
/** The card around a planet of the next jump. */
export function chartRect(col: number, i: number, n: number) {
  const c = chartSpot(col, i, n);
  if (n > 3) return { x: c.x - CHART4.w / 2, y: c.y - CHART4.h / 2, w: CHART4.w, h: CHART4.h };
  return { x: c.x - CHART.w / 2, y: c.y - 46, w: CHART.w, h: CHART.h };
}

/** The trader's three offers and its two buttons. */
export const TRADE_CARD = { w: 236, h: 236, y: 268, gap: 256 };
export function tradeCardRect(i: number) {
  const cx = VIEW.w / 2 + (i - 1) * TRADE_CARD.gap;
  return { x: cx - TRADE_CARD.w / 2, y: TRADE_CARD.y - TRADE_CARD.h / 2, w: TRADE_CARD.w, h: TRADE_CARD.h };
}
export const REROLL = { x: VIEW.w / 2 - 250, y: 424, w: 230, h: 48 };
export const LEAVE = { x: VIEW.w / 2 + 20, y: 424, w: 230, h: 48 };

/** An event's two options. */
export function eventOptionRect(i: number) {
  return { x: VIEW.w / 2 - 300, y: 290 + i * 92, w: 600, h: 76 };
}

/** The end screen's "Run again" button, and beside it after a won crusade the endless rift's. */
export const AGAIN = { x: VIEW.w / 2 - 110, y: 380, w: 220, h: 50 };
export const AGAIN_SIDE = { x: VIEW.w / 2 + 10, y: 380, w: 220, h: 50 };
export const ENDLESS_BUTTON = { x: VIEW.w / 2 - 230, y: 380, w: 220, h: 50 };

/**
 * Fits the layout to a view of `w` x `h` with the designed frame at `fx`, `fy`: the XP bar spans
 * the top, the clock and boss bar stay centred, the level, planet and credits keep to the right
 * edge and the signature button to the bottom right corner. Called once, before the HUD is made.
 */
export function fitLayout(w: number, h: number, fx: number, fy: number) {
  Object.assign(SCREEN, { w, h });
  Object.assign(FRAME, { x: fx, y: fy });
  Object.assign(CENTER, { x: w / 2, y: h / 2 });
  XP_BAR.w = w;
  TIMER.x = w / 2;
  LEVEL.x = w - 16;
  PLANET_TAG.x = w - 16;
  CREDITS_TAG.x = w - 16;
  BOSS_BAR.x = w / 2 - BOSS_BAR.w / 2;
  OBJECTIVE_HUD.x = w / 2;
  Object.assign(SIG_BUTTON, { x: w - 70, y: h - 70 });
}

/** Draw order. */
export const DEPTH = { ground: 0, under: 1, pickups: 2, enemies: 3, allies: 4, hero: 5, bolts: 6, over: 7, pops: 8, hud: 20, overlay: 30 };

export type Rect = { x: number; y: number; w: number; h: number };
export const inside = (p: { x: number; y: number }, r: Rect) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
