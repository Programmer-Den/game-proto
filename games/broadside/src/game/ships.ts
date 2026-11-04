// The enemy ships. Names are keys of `i18n/en.ts`, shown with `t`. Speeds are pixels per second, turning radians per second, times milliseconds.

import type { TextKey } from '../i18n';

export type EnemyKind = 'sloop' | 'brig' | 'galleon' | 'fireship' | 'ketch' | 'flagship' | 'admiral' | 'tempest' | 'merchant' | 'kraken' | 'serpent';

export interface ShipType {
  name: TextKey;
  /** How a sentence names her, like "Keep the sloop". */
  called: TextKey;
  hp: number;
  /** Collision radius. */
  radius: number;
  speed: number;
  turn: number;
  /** Cannons on each side; a broadside fires them all. */
  guns: number;
  damage: number;
  reloadMs: number;
  range: number;
  /** Gold in the loot it drops when sunk. */
  loot: number;
  /**
   * How it fights, when not with broadsides: a fireship sails straight at you and blows up on
   * touching (or when sunk); a mortar ketch keeps its distance and lobs shells (`damage` each,
   * every `reloadMs`, up to `range` away) that land where it marked; a merchantman carries no guns
   * and runs from the player (on the Merchant lane), or sails for her island (a convoy). A sea
   * beast (`beasts.ts`) never sails: it stays under, raising a tentacle (`damage`) every
   * `reloadMs` near the player, and only shows its head now and then.
   */
  role?: 'fireship' | 'mortar' | 'merchant' | 'beast';
  /** Sailors aboard with a full crew; a prize needs half of them from the player's crew. */
  crew: number;
  /** Loads grapeshot when within `GRAPE_RANGE` of its target, which kills sailors on a hit. */
  grape?: boolean;
}

export const ENEMIES: Record<EnemyKind, ShipType> = {
  sloop: { name: 'sloopName', called: 'sloopCalled', hp: 30, radius: 20, speed: 70, turn: 1.1, guns: 1, damage: 5, reloadMs: 2800, range: 220, loot: 10, crew: 8 },
  brig: { name: 'brigName', called: 'brigCalled', hp: 70, radius: 25, speed: 58, turn: 0.9, guns: 2, damage: 6, reloadMs: 3000, range: 240, loot: 25, crew: 16, grape: true },
  galleon: { name: 'galleonName', called: 'galleonCalled', hp: 160, radius: 32, speed: 44, turn: 0.6, guns: 3, damage: 8, reloadMs: 3400, range: 260, loot: 60, crew: 24, grape: true },
  fireship: { name: 'fireshipName', called: 'fireshipCalled', hp: 24, radius: 20, speed: 104, turn: 1.25, guns: 0, damage: 26, reloadMs: 0, range: 0, loot: 12, role: 'fireship', crew: 4 },
  ketch: { name: 'ketchName', called: 'ketchCalled', hp: 45, radius: 22, speed: 52, turn: 0.9, guns: 0, damage: 20, reloadMs: 4200, range: 380, loot: 30, role: 'mortar', crew: 10 },
  flagship: { name: 'flagshipName', called: 'flagshipCalled', hp: 300, radius: 38, speed: 42, turn: 0.55, guns: 4, damage: 9, reloadMs: 3000, range: 280, loot: 150, crew: 32, grape: true },
  admiral: { name: 'admiralName', called: 'admiralCalled', hp: 440, radius: 40, speed: 40, turn: 0.5, guns: 5, damage: 10, reloadMs: 2800, range: 290, loot: 300, crew: 40, grape: true },
  // The storm-lord's man-of-war at the end of the Storm Reaches: she calls squalls down as she is hurt.
  tempest: { name: 'tempestName', called: 'tempestCalled', hp: 520, radius: 42, speed: 44, turn: 0.55, guns: 5, damage: 11, reloadMs: 2600, range: 300, loot: 400, crew: 44, grape: true },
  // Sea beasts, on a rare wave (`beastFor`): no guns, no sails and no crew to board.
  kraken: { name: 'krakenName', called: 'krakenCalled', hp: 120, radius: 30, speed: 0, turn: 1, guns: 0, damage: 14, reloadMs: 1500, range: 0, loot: 150, role: 'beast', crew: 1 },
  serpent: { name: 'serpentName', called: 'serpentCalled', hp: 90, radius: 26, speed: 0, turn: 1, guns: 0, damage: 12, reloadMs: 1200, range: 0, loot: 120, role: 'beast', crew: 1 },
  merchant: { name: 'merchantName', called: 'merchantCalled', hp: 50, radius: 24, speed: 74, turn: 0.9, guns: 0, damage: 0, reloadMs: 0, range: 0, loot: 40, role: 'merchant', crew: 10 },
};

/** Ships that carry grapeshot load it against a target this close, raking its deck. */
export const GRAPE_RANGE = 130;
