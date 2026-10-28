import type { TextKey } from '../i18n';

/**
 * The nine art styles, in the order they unlock. Paper Cut-out is the default; each other one
 * unlocks once its `UNLOCKS` goal in `state.ts` is met. The scene draws them from `THEMES`.
 */
export const STYLES = ['paper', 'garden', 'chalk', 'parchment', 'pixel', 'stars', 'stone', 'neon', 'glass'] as const;
export type StyleId = (typeof STYLES)[number];

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
};

/** The relics a cleared Delve floor offers, three at a time; each can be taken more than once. */
export const RELICS = ['lantern', 'heartstone', 'seer', 'ward'] as const;
export type RelicId = (typeof RELICS)[number];

export const RELIC_INFO: Record<RelicId, { name: TextKey; text: TextKey; color: number }> = {
  lantern: { name: 'lanternName', text: 'lanternText', color: 0xf2b84b },
  heartstone: { name: 'heartstoneName', text: 'heartstoneText', color: 0xe2607a },
  seer: { name: 'seerName', text: 'seerText', color: 0x6fb7e8 },
  ward: { name: 'wardName', text: 'wardText', color: 0x8fcf7a },
};

/**
 * Delve twists, drawn from floor 4 on: Diagonal (both long diagonals hold each digit once),
 * Parity (shaded cells hold even digits, the rest odd), Clock (a heart is lost every 3 minutes)
 * and Sealed (no hints on the floor; clearing it gives one back).
 */
export const TWISTS = ['diagonal', 'parity', 'clock', 'sealed'] as const;
export type Twist = (typeof TWISTS)[number];

export const TWIST_INFO: Record<Twist, { name: TextKey; rule: TextKey }> = {
  diagonal: { name: 'diagonalName', rule: 'diagonalRule' },
  parity: { name: 'parityName', rule: 'parityRule' },
  clock: { name: 'clockName', rule: 'clockRule' },
  sealed: { name: 'sealedName', rule: 'sealedRule' },
};

/** Classic's three puzzle levels. */
export const LEVELS = ['easy', 'normal', 'hard'] as const;
export type Level = (typeof LEVELS)[number];
