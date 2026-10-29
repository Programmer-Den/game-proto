// Where things are drawn in the 960x540 view. The rules' own positions (field, barricade face, hero,
// bow) are in src/game/state.ts.

export const VIEW = { w: 960, h: 540 };
export const HUD_HEIGHT = 40;
/** Where the hero's feet stand, on the road behind the barricade. */
export const HERO_FEET = { x: 66, y: 418 };
/** The barricade texture's top left corner (its log stands at x 182, from y 264 down). */
export const BARRICADE = { x: 112, y: 250 };
/**
 * The experience bar along the bottom, with the level at its left end. It starts right of the corner
 * buttons (full screen, pause), which take the bottom left up to x 114 on a 960x540 window.
 */
export const XP_BAR = { x: 132, y: 514, w: 732, h: 16 };
/** The 1x/2x speed switch, right of the experience bar, by its centre. */
export const SPEED = { x: 908, y: 522, w: 60, h: 22 };
/** The barricade's health bar in the top bar (its fill, inside a 3px frame, 14px tall at y 13). */
export const BARRICADE_BAR = { x: 232, w: 198 };
/** Width of the tooltip shown under the barricade's bar while it is hovered. */
export const BARRICADE_TIP_W = 250;
/** The boss's stacked health bars, by their top centre, right of the wave track. */
export const BOSS_BAR = { x: 640, y: 66, w: 400, h: 14 };
/** The wave track under the top bar: its panel, and the first of its ten marks and their spacing. */
export const TRACK = { x: 12, y: 46, w: 344, h: 46, markX: 22, markY: 77, step: 27 };
/** The Arrow Rain button above the ranger, by its centre, and its radius for taps and drags. */
export const RAIN = { x: 66, y: 308, r: 26 };
/** The caltrops button, above the Arrow Rain button, by its centre, and its radius for taps and drags. */
export const CALTROPS = { x: 66, y: 196, r: 22 };
/** The aim priority toggle ("Aim: Nearest"), above the caltrops button, by its centre. */
export const AIM = { x: 66, y: 134, w: 110, h: 22 };
/** The "Fortify" button under the wave track, by its centre, and the panel it opens. */
export const FORTIFY = { x: 66, y: 108, w: 110, h: 22, panel: { w: 460, h: 270 } };
/** The "Repair" button right of the Fortify button, by its centre. */
export const REPAIR = { x: 190, y: 108, w: 124, h: 22 };
/** The omen card during a break from wave 4, by its centre. */
export const OMEN = { x: 480, y: 330, w: 440, h: 130 };
/** The chip naming an accepted omen during its wave, over the ranger, by its centre. */
export const OMEN_CHIP = { x: 300, y: 210, w: 150, h: 20 };
/** The three legacy cards when the hero retires, by their centres. */
export const LEGACY = { xs: [230, 480, 730], y: 268, w: 230, h: 190 };
/** The forced march row ("Start at") on the game-over panel: its buttons' size and spacing. */
export const MARCH = { w: 150, h: 26, step: 160 };
/** The heat chip right of the wave track, by its centre. */
export const HEAT = { x: 398, y: 58, w: 68, h: 20 };
/** The "Chilled bow" chip over the hero while the Frost Giant's roar slows the shots, by its centre. */
export const ROAR_CHIP = { x: 300, y: 236, w: 150, h: 20 };
/**
 * The tap area of each guard slot on the barricade, round the guard's feet (`GUARD_SLOTS` in
 * state.ts), reaching `below` under them. The slots stand 60 apart in height, so no taller, or the
 * third slot's area would cover the feet of the other two.
 */
export const GUARD_HIT = { w: 56, h: 60, below: 8 };
/** The hire panel beside a slot: its size and how far right of the slot its centre is. */
export const HIRE = { w: 320, h: 212, dx: 200 };
/** The two road cards after a boss, by their centres. */
export const ROAD_CARDS = { xs: [330, 630], y: 352, w: 280, h: 150 };
/** The "Drag onto the horde" hint over the field while Arrow Rain is charged. */
export const RAIN_HINT = { x: 715, y: 220 };
/** The kill streak chip over the experience bar, by its centre. */
export const STREAK = { x: 650, y: 499, w: 168, h: 21 };
/** The three upgrade cards on a level-up, by their centres. */
export const CARDS = { xs: [240, 480, 720], y: 300, w: 220, h: 250 };
/** The auto-pick countdown under the cards: its text's centre, and the width and height of its bar. */
export const COUNTDOWN = { x: 480, y: 450, w: 160, h: 6 };
/** The auto-pick checkbox right of the countdown: its box's centre and size. */
export const AUTO_TOGGLE = { x: 600, y: 462, size: 18 };
/** The "Skill book" button in the top bar, and the book it opens: its size and the grid of slots. */
export const SKILL_BOOK = {
  button: { x: 520, y: 20, w: 150, h: 26 },
  panel: { w: 900, h: 500 },
  cols: 4,
  colW: 218,
  rowH: 54,
  /** The top of the first row. */
  top: 92,
};
export const BUTTON = { w: 180, h: 40 };

/**
 * The part of the world the view shows. The camera keeps the designed 960x540 in the middle of a
 * view that fills a screen of another shape (`setupScaling(game, { fill: true })`), so the world
 * keeps its coordinates and this runs from (-frame.x, -frame.y). Set by `placeHud`.
 */
export const SEEN = { x: 0, y: 0, w: VIEW.w, h: VIEW.h };

type Box = { x: number; y?: number; w?: number };
/** HUD boxes pinned to the view's edges, with their designed positions: left or right, top or bottom, or stretched across. */
const TRACK_MARK_Y = TRACK.markY;
const PINS: [Box, 'left' | 'right' | 'stretch', 'top' | 'bottom', Box][] = (
  [
    [BARRICADE_BAR, 'left', 'top'],
    [TRACK, 'left', 'top'],
    [HEAT, 'left', 'top'],
    [BOSS_BAR, 'left', 'top'],
    [FORTIFY, 'left', 'top'],
    [REPAIR, 'left', 'top'],
    [SKILL_BOOK.button, 'left', 'top'],
    [XP_BAR, 'stretch', 'bottom'],
    [SPEED, 'right', 'bottom'],
    [STREAK, 'right', 'bottom'],
  ] as [Box, 'left' | 'right' | 'stretch', 'top' | 'bottom'][]
).map(([box, h, v]) => [box, h, v, { ...box }]);

/**
 * Sets `SEEN` for a view with the designed size at `frame` in its middle (`viewFrame`), and pins
 * the HUD's boxes to the view's edges. With no margins (exactly 960x540) nothing moves.
 */
export function placeHud(frame: { x: number; y: number }) {
  Object.assign(SEEN, { x: -frame.x, y: -frame.y, w: VIEW.w + 2 * frame.x, h: VIEW.h + 2 * frame.y });
  for (const [box, h, v, design] of PINS) {
    box.x = design.x + (h === 'right' ? frame.x : -frame.x);
    if (h === 'stretch') box.w = design.w! + 2 * frame.x;
    if (design.y !== undefined) box.y = design.y + (v === 'bottom' ? frame.y : -frame.y);
  }
  // The track's marks ride in its panel.
  TRACK.markY = TRACK_MARK_Y - frame.y;
}

export const UI_DEPTH = 10_000;
export const FONT = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
