// Where things are drawn in the 960x540 view. The rooms' places on the map are in
// src/game/map.ts.

export const VIEW = { w: 960, h: 540 };
export const HUD_HEIGHT = 40;

/** Where the hero's feet stand in a fight. */
export const HERO_FEET = { x: 230, y: 330 };
/** Where the foes' feet stand, by how many there are. */
export const FOE_XS: Record<number, number[]> = { 1: [700], 2: [610, 800], 3: [560, 710, 860] };
export const FOE_FEET_Y = 330;
export const HP_BAR = { w: 112, h: 18, dy: 8 };

/** The hand, fanned along the bottom, by the cards' centres. */
export const HAND = { x: 480, y: 450, w: 124, h: 172, gap: 130, span: 540 };
/** The energy orb, bottom left. */
export const ENERGY_ORB = { x: 72, y: 430, r: 36 };
/** The End turn button, narrower than other buttons so it stays inside the view's right edge. */
export const END_TURN = { x: 884, y: 420, w: 140 };
/** The discard pile's count under End turn (the draw pile's sits over the energy orb). */
export const PILES_Y = 492;

/** The reward cards, by their centres, and the button to take none. */
export const REWARD = { xs: [300, 480, 660], y: 290, scale: 1.25 };
export const SKIP = { x: 480, y: 476 };
/** The button on the rest, defeat and victory panels. */
export const PANEL_BUTTON = { x: 480, y: 360 };

export const BUTTON = { w: 160, h: 44 };
/** At the campfire, Rest, Temper and Remove a card sit in a row across the middle. */
export const REST_BUTTONS = { dx: 182, w: 172 };
/** A mystery room's two choices, one above the other. */
export const EVENT_BUTTONS = { y: 324, gap: 52, w: 440 };
/**
 * The hero panel, a taller box than the other panels: its title, the depth row's arrows and label
 * with the depth's rules under it, the four heroes standing in a row (by their feet) with a
 * button and a caption under each, and the daily and weekly crypts' buttons side by side under the box.
 */
export const HERO_PANEL = {
  box: { w: 780, h: 380 },
  titleY: 108,
  depthY: 152,
  depthDx: 90,
  rulesY: 192,
  rulesH: 40,
  xs: [255, 405, 555, 705],
  feetY: 352,
  buttonY: 384,
  buttonW: 140,
  captionY: 412,
  dailyY: 496,
  dailyXs: [295, 665],
  dailyW: 360,
};
/**
 * The library, before a run: the starting deck in a row along the top, the library's cards in up
 * to two rows under it, by the cards' centres, and Back and Set out along the bottom.
 */
export const LIBRARY = {
  titleY: 64,
  hintY: 96,
  deck: { y: 180, gap: 78, scale: 0.55 },
  shelfY: 282,
  cards: { y: 340, rowGap: 92, gap: 68, perRow: 13, scale: 0.48 },
  back: { x: 300, y: 500 },
  go: { x: 660, y: 500 },
};
/** The flask slots down the left of a fight, by their centres. */
export const FLASKS = { x: 60, y: 120, gap: 58, r: 24 };
/** The powers in play, in a row under the flasks, left of the hero: one ring per kind (four at most), so the row ends clear of the hero. */
export const POWERS = { x: 44, y: 296, gap: 36, r: 15 };
/** The deck laid out to pick a card to burn, temper or sell, by the cards' centres: roomier while it fits in two rows, tight up to three, packed (four rows of 15, room for every card and its tempered copy) beyond. */
export const PICKER = {
  roomy: { y: 210, rowGap: 170, gap: 120, perRow: 7, scale: 0.8 },
  tight: { y: 180, rowGap: 128, gap: 86, perRow: 10, scale: 0.58 },
  packed: { y: 160, rowGap: 96, gap: 60, perRow: 15, scale: 0.42 },
  back: { x: 860, y: 80 },
};
/** The merchant's wares: cards by their centres with prices under them, two flasks under those, and relics and the removal in boxes on the right. */
export const SHOP = {
  cardXs: [150, 300, 450],
  cardY: 220,
  priceDy: 104,
  flasks: { xs: [205, 445], y: 404, w: 220, h: 60 },
  box: { x: 720, w: 340, h: 76, ys: [170, 262, 354] },
  leave: { x: 480, y: 476 },
};
/** The top bar: health, deck, gold and the relics in a row. */
export const HUD = { deckX: 128, coinX: 262, goldX: 278, relicX: 344, relicGap: 28 };
/** The width given to each status on the row over a fighter's head. */
export const STATUS_GAP = 46;
export const ROOM_RADIUS = 32;

export const UI_DEPTH = 10_000;
export const FONT = 'Georgia, "Times New Roman", serif';
