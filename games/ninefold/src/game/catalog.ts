import type { TextKey } from '../i18n';

/**
 * The art styles, in the order they unlock. Paper Cut-out is the default; each other one unlocks
 * once its `UNLOCKS` goal in `state.ts` is met. Almanac, the calendar's own, comes last and stands
 * apart: Stained Glass and the Full palette trophy only wait for the nine before it
 * (`PALETTE_STYLES`). The scene draws them from `THEMES`.
 */
export const STYLES = ['paper', 'garden', 'chalk', 'parchment', 'pixel', 'stars', 'stone', 'neon', 'glass', 'almanac'] as const;
export type StyleId = (typeof STYLES)[number];
/** The style a full month of dailies on the calendar earns. */
export const MONTH_STYLE: StyleId = 'almanac';
/** The nine styles earned by solving, which Stained Glass and the Full palette trophy wait for. */
export const PALETTE_STYLES = STYLES.filter((s) => s !== MONTH_STYLE);

export const STYLE_INFO: Record<StyleId, { name: TextKey; goal: TextKey }> = {
  paper: { name: 'paperName', goal: 'paperGoal' },
  garden: { name: 'gardenName', goal: 'gardenGoal' },
  chalk: { name: 'chalkName', goal: 'chalkGoal' },
  parchment: { name: 'parchmentName', goal: 'parchmentGoal' },
  pixel: { name: 'pixelName', goal: 'pixelGoal' },
  stars: { name: 'starsName', goal: 'starsGoal' },
  stone: { name: 'stoneName', goal: 'stoneGoal' },
  neon: { name: 'neonName', goal: 'neonGoal' },
  glass: { name: 'glassName', goal: 'glassGoal' },
  almanac: { name: 'almanacName', goal: 'almanacGoal' },
};

/**
 * The relics a cleared Delve floor offers, three at a time; each can be taken more than once,
 * except those in `UNIQUE_RELICS`. The last six trade something away for what they give.
 */
export const RELICS = ['lantern', 'heartstone', 'seer', 'ward', 'twin', 'gambler', 'phoenix', 'sandglass', 'vow', 'keystone'] as const;
export type RelicId = (typeof RELICS)[number];

export const RELIC_INFO: Record<RelicId, { name: TextKey; text: TextKey; color: number }> = {
  lantern: { name: 'lanternName', text: 'lanternText', color: 0xf2b84b },
  heartstone: { name: 'heartstoneName', text: 'heartstoneText', color: 0xe2607a },
  seer: { name: 'seerName', text: 'seerText', color: 0x6fb7e8 },
  ward: { name: 'wardName', text: 'wardText', color: 0x8fcf7a },
  twin: { name: 'twinName', text: 'twinText', color: 0xb58ce8 },
  gambler: { name: 'gamblerName', text: 'gamblerText', color: 0xe8e0d0 },
  phoenix: { name: 'phoenixName', text: 'phoenixText', color: 0xf08a3c },
  sandglass: { name: 'sandglassName', text: 'sandglassText', color: 0xe0c27a },
  vow: { name: 'vowName', text: 'vowText', color: 0x9aa4b4 },
  keystone: { name: 'keystoneName', text: 'keystoneText', color: 0x5fc4b0 },
};

/** Relics a run holds at most once, so they leave the offers once taken. */
export const UNIQUE_RELICS: readonly RelicId[] = ['twin'];

/**
 * Delve twists, drawn from floor 4 on: Diagonal (both long diagonals hold each digit once),
 * Parity (shaded cells hold even digits, the rest odd), Killer (dashed cages add up to their
 * sums), Thermo (digits rise along each thermometer from its bulb), Arrow (the digits on an arrow
 * add up to its circle), Kropki (dots join digits one apart or one double the other; no dot,
 * neither), Sandwich (the sums outside the board add up the digits between the 1 and the highest
 * digit), Clock (a heart is lost every 3 minutes) and Sealed (no hints on the floor; clearing it
 * gives one back). All but the last two change the board's rules (`BOARD_TWISTS`); those two press
 * the player.
 */
export const TWISTS = ['diagonal', 'parity', 'killer', 'thermo', 'arrow', 'kropki', 'sandwich', 'clock', 'sealed'] as const;
export type Twist = (typeof TWISTS)[number];

export const TWIST_INFO: Record<Twist, { name: TextKey; rule: TextKey }> = {
  diagonal: { name: 'diagonalName', rule: 'diagonalRule' },
  parity: { name: 'parityName', rule: 'parityRule' },
  clock: { name: 'clockName', rule: 'clockRule' },
  killer: { name: 'killer', rule: 'killerRule' },
  thermo: { name: 'thermo', rule: 'thermoRule' },
  arrow: { name: 'arrow', rule: 'arrowRule' },
  kropki: { name: 'kropki', rule: 'kropkiRule' },
  sandwich: { name: 'sandwich', rule: 'sandwichRule' },
  sealed: { name: 'sealedName', rule: 'sealedRule' },
};

export const BOARD_TWISTS = ['diagonal', 'parity', 'killer', 'thermo', 'arrow', 'kropki', 'sandwich'] as const satisfies readonly Twist[];
export const PRESSING_TWISTS = ['clock', 'sealed'] as const satisfies readonly Twist[];

/**
 * Delve ascensions: clearing floor `ASCEND_FLOOR` at one opens the next, up to five. Each adds
 * one rule to those below it: one heart fewer, no starting hint, fewer givens, no notes, and two
 * relics offered instead of three.
 */
export const ASCENSION_RULES = ['ascentHearts', 'ascentHint', 'ascentGivens', 'ascentNotes', 'ascentOffer'] as const satisfies readonly TextKey[];
export const MAX_ASCENT = ASCENSION_RULES.length;

/** Classic's puzzle levels: three by givens, then a board for each extra rule. */
export const LEVELS = ['easy', 'normal', 'hard', 'killer', 'thermo', 'arrow', 'kropki', 'sandwich'] as const;
export type Level = (typeof LEVELS)[number];
