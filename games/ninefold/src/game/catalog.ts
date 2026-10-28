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
