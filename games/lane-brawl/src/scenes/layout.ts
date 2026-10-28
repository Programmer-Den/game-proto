// Where things sit on the screen. The positions below are for the designed 960x540 view; `fitLayout`
// moves them once at start for the view the screen's shape picked (`setupScaling` with `fill`): bars
// stretch to its width and keep to its top and bottom, the minimap, chips and red's Nexus keep to its
// right, and the pick screen, shop and end panel stay centred. The map is in world pixels and scrolls.

/** The designed size of the game. */
export const VIEW = { w: 960, h: 540 };
/** The view the game shows, at least `VIEW` and wider or taller to fill the screen (`fitLayout`). */
export const SCREEN = { w: VIEW.w, h: VIEW.h };
/** Where the designed 960x540 rectangle sits in the middle of the view (the pick screen and panels). */
export const FRAME = { x: 0, y: 0 };
export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const TOP_BAR = { x: 0, y: 0, w: VIEW.w, h: 34 };
export const BOTTOM_BAR = { x: 0, y: 412, w: VIEW.w, h: 128 };

/** The champion's portrait, health and experience at the bottom left. */
export const PORTRAIT = { x: 12, y: 420, w: 214, h: 112 };

/** Q, W, E and R, in a row. */
export const ABILITY_BOX = { x0: 240, y: 428, size: 58, gap: 8 };
export function abilityBox(i: number) {
  return { x: ABILITY_BOX.x0 + i * (ABILITY_BOX.size + ABILITY_BOX.gap), y: ABILITY_BOX.y, w: ABILITY_BOX.size, h: ABILITY_BOX.size };
}

export const SHOP_BUTTON = { x: 508, y: 428, w: 96, h: 58 };
/** The minimap, showing the whole square map in the bottom right corner. */
export const MINIMAP = { x: 826, y: 420, w: 112, h: 112 };

/** The objective card under the top bar, at the top left of the map. It blocks clicks. */
export const OBJECTIVE_CARD = { x: 10, y: 42, w: 236, h: 62 };
/** The last-hit streak chip, right of the gold counter. */
export const STREAK_CHIP = { x: 96, y: 6, w: 118, h: 22 };

/** The upgrade choice in the bottom bar, between the shop button and the minimap: two cards, or three slimmer ones. */
export const UPGRADE_PANEL = { x: 614, y: 420, w: 168, h: 112 };
export function upgradeCard(i: number, n = 2) {
  if (n === 3) return { x: UPGRADE_PANEL.x + 6, y: UPGRADE_PANEL.y + 19 + i * 31, w: UPGRADE_PANEL.w - 12, h: 29 };
  return { x: UPGRADE_PANEL.x + 6, y: UPGRADE_PANEL.y + 20 + i * 46, w: UPGRADE_PANEL.w - 12, h: 42 };
}

/** The item actives (D, H and the ward on V), three buttons under the shop button. */
export function activeButton(i: number) {
  return { x: SHOP_BUTTON.x + i * 33, y: SHOP_BUTTON.y + 64, w: 30, h: 38 };
}

/** The recall button in the top bar, right of the clock; while the champion is dead it is the buy back button. */
export const RECALL_BUTTON = { x: 530, y: 4, w: 118, h: 26 };

/** The kill score in the top bar, left of the clock; a tap opens the scoreboard. */
export const SCORE_CHIP = { x: 380, y: 4, w: 56, h: 26 };

/** The shop panel, opened with the button or the B key: sixteen item cards in four columns. */
export const SHOP_PANEL = { x: 100, y: 38, w: 760, h: 368 };
const SHOP_COL_W = (SHOP_PANEL.w - 28 - 30) / 4;
export function shopRow(i: number) {
  const col = i % 4;
  const row = Math.floor(i / 4);
  return { x: SHOP_PANEL.x + 14 + col * (SHOP_COL_W + 10), y: SHOP_PANEL.y + 48 + row * 80, w: SHOP_COL_W, h: 74 };
}

/** The scoreboard, held open with Tab or opened from the kill score, over the same space as the shop. */
export const SCORE_PANEL = { x: 100, y: 38, w: 760, h: 368 };

/** The empowered-minion chips at the top right, under the top bar, one per team with the buff. */
export function buffChip(i: number) {
  return { x: SCREEN.w - 222, y: 40 + i * 24, w: 212, h: 20 };
}

/** The fifteen champion cards on the pick screen, in three rows of five. */
export const PICK_CARD = { w: 168, h: 114, gap: 8, y: 76 };
export function pickCard(i: number) {
  const total = 5 * PICK_CARD.w + 4 * PICK_CARD.gap;
  const col = i % 5;
  const row = Math.floor(i / 5);
  return { x: (SCREEN.w - total) / 2 + col * (PICK_CARD.w + PICK_CARD.gap), y: FRAME.y + PICK_CARD.y + row * (PICK_CARD.h + PICK_CARD.gap), w: PICK_CARD.w, h: PICK_CARD.h };
}
/** The buffs the player's champion carries, as chips in a row above the portrait. */
export function buffStrip(i: number) {
  return { x: 12 + i * 92, y: PORTRAIT.y - 32, w: 88, h: 18 };
}

/** The panel and button shown when a match is won or lost. */
export const END_PANEL = { x: 280, y: 150, w: 400, h: 200 };
export const PLAY_AGAIN = { x: 380, y: 290, w: 200, h: 44 };

/**
 * Lays the screen out for a view of `w` x `h` (at least 960x540), once at start. At 960x540 nothing
 * moves; wider or taller, the bottom bar and what is in it keep to the bottom, the minimap to the
 * bottom right, the recall button by the centred clock, and the panels stay in the middle.
 */
export function fitLayout(w: number, h: number) {
  const dx = w - VIEW.w, dy = h - VIEW.h;
  SCREEN.w = w;
  SCREEN.h = h;
  FRAME.x = dx / 2;
  FRAME.y = dy / 2;
  TOP_BAR.w = w;
  Object.assign(BOTTOM_BAR, { y: 412 + dy, w });
  PORTRAIT.y = 420 + dy;
  ABILITY_BOX.y = 428 + dy;
  SHOP_BUTTON.y = 428 + dy;
  UPGRADE_PANEL.y = 420 + dy;
  Object.assign(MINIMAP, { x: 826 + dx, y: 420 + dy });
  RECALL_BUTTON.x = 530 + dx / 2;
  SCORE_CHIP.x = 380 + dx / 2;
  Object.assign(SCORE_PANEL, { x: 100 + dx / 2, y: 38 + dy / 2 });
  Object.assign(SHOP_PANEL, { x: 100 + dx / 2, y: 38 + dy / 2 });
  Object.assign(END_PANEL, { x: 280 + dx / 2, y: 150 + dy / 2 });
  Object.assign(PLAY_AGAIN, { x: 380 + dx / 2, y: 290 + dy / 2 });
}
