// Where things are drawn in the view, laid out for the designed 960x540 and moved by `fitLayout`
// once the view's real size is known. The sea itself is WORLD in src/game/state.ts, and the camera
// follows the player's ship across it.

/** The designed size, which the game is created at. */
export const DESIGN = { w: 960, h: 540 } as const;
/** The view's size in game pixels: `DESIGN` until `fitLayout`, then the screen's shape. */
export const VIEW: { w: number; h: number } = { w: DESIGN.w, h: DESIGN.h };
export const HUD_HEIGHT = 40;
/**
 * The two helm buttons, held to turn: port (left) and starboard (right), by their centres. They sit
 * high enough to keep clear of the shared corner buttons (full screen, pause) at the bottom left.
 */
export const HELM = { port: { x: 86, y: 420 }, starboard: { x: 874, y: 420 }, r: 62 };
/**
 * The two fire controls, held to aim and charge a broadside and let go to fire it: each above the
 * helm wheel on its own side, clear of it, so one thumb can steer while the other fires.
 */
export const FIRE = { port: { x: 86, y: 286 }, starboard: { x: 874, y: 286 }, r: 44 };
/** The captain's order card under the top bar, by its top-left corner. */
export const ORDER_CARD = { x: 16, y: 50 };
/** The harbor panel between waves, by its centre, with one row per thing to buy. */
export const HARBOR = { x: 480, y: 272, w: 660, h: 510, rowW: 600, rowH: 34, firstRowY: 132, rowGap: 36, loadY: 440 };
/** The two sail buttons that replace "Set sail" when the harbor offers a choice of course, each `w` by `h`. */
export const COURSE = { w: 292, h: 46, gap: 12 };
/** The prize draft at the harbor: three (after a Hunter patrol four) cards side by side, centred, by the middle card's centre, each `w` by `h` and `gap` apart. */
export const DRAFT = { x: 480, y: 300, w: 196, h: 250, gap: 16, titleY: 118 };
/** The game-over panel, by its centre: the ship choice (`shipY`, `shipW` buttons) above the Admiralty's rewards as rows. */
export const OVER = { x: 480, y: 290, w: 620, h: 460, rowW: 520, rowH: 30, firstRowY: 290, rowGap: 35, shipY: 248, shipW: 164 };
/** The wind rose under the top bar on the right, by its centre. */
export const WIND = { x: 904, y: 98, r: 34 };
/** The Admiralty's bounty for the wave, written under the captain's order card, by its left edge. */
export const BOUNTY = { x: 18, y: 128 };
/** The convoy's line on convoy waves, under the bounty (or in its place), by its left edge. */
export const CONVOY = { x: 18, y: 146 };
/** The button to scuttle a prize, under the bounty and the convoy, by its centre. */
export const SCUTTLE = { x: 166, y: 184, w: 300, h: 36 };
export const BUTTON = { w: 200, h: 42 };
/** The wave banner's title and the line under it, by their centres' heights. */
export const BANNER = { title: 168, sub: 212 };

export const UI_DEPTH = 10_000;
export const FONT = "Georgia, 'Times New Roman', Times, serif";

const designed = structuredClone({ HELM, FIRE, HARBOR, DRAFT, OVER, WIND, BANNER });

/**
 * Lays everything out for a view of `w` x `h` (`viewSize`, picked once when the game starts): the
 * top bar and the order card stay at the top left, the wind rose and the starboard controls move
 * with the right edge, the helm and fire controls with the bottom, and the banner and the harbor,
 * draft and end panels stay centred. At the designed 960x540 nothing moves.
 */
export function fitLayout(w: number, h: number) {
  VIEW.w = w;
  VIEW.h = h;
  const dx = w - DESIGN.w;
  const dy = h - DESIGN.h;
  const d = designed;
  for (const [now, was] of [[HELM, d.HELM], [FIRE, d.FIRE]] as const) {
    now.port.y = was.port.y + dy;
    now.starboard.x = was.starboard.x + dx;
    now.starboard.y = was.starboard.y + dy;
  }
  WIND.x = d.WIND.x + dx;
  for (const [now, was] of [[HARBOR, d.HARBOR], [DRAFT, d.DRAFT], [OVER, d.OVER]] as const) {
    now.x = was.x + dx / 2;
    now.y = was.y + dy / 2;
  }
  HARBOR.firstRowY = d.HARBOR.firstRowY + dy / 2;
  HARBOR.loadY = d.HARBOR.loadY + dy / 2;
  DRAFT.titleY = d.DRAFT.titleY + dy / 2;
  OVER.firstRowY = d.OVER.firstRowY + dy / 2;
  OVER.shipY = d.OVER.shipY + dy / 2;
  BANNER.title = d.BANNER.title + dy / 2;
  BANNER.sub = d.BANNER.sub + dy / 2;
}
