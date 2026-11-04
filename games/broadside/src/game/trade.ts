// Trade between waves: the harbor sells cargo that fetches more at the next port. A loaded hold
// makes the ship slower to turn, and raiders come hunting for it.

import type { TextKey } from '../i18n';

export type CargoId = 'rum' | 'silk' | 'spice';

export interface Cargo {
  /** Keys of `i18n/en.ts`. */
  name: TextKey;
  /** A crate costs `base + step * wave` at the harbor of that wave. */
  base: number;
  step: number;
  /** What a crate fetches at the next port, as a share of what was paid for it. */
  markup: number;
}

export const CARGO: Record<CargoId, Cargo> = {
  rum: { name: 'rumName', base: 6, step: 1, markup: 1.5 },
  silk: { name: 'silkName', base: 12, step: 2, markup: 1.6 },
  spice: { name: 'spiceName', base: 20, step: 3, markup: 1.75 },
};

export const CARGO_IDS = Object.keys(CARGO) as CargoId[];

/** A crate in the hold, and what was paid for it. */
export interface Crate {
  good: CargoId;
  paid: number;
}

/** The most crates the hold carries. */
export const HOLD_MAX = 6;
/** A full hold turns the ship this much slower (in between, by how full it is). */
export const HOLD_TURN = 0.3;

/** What a crate of `good` costs at the harbor after `wave`. */
export const cargoPrice = (good: CargoId, wave: number) => CARGO[good].base + CARGO[good].step * wave;
/** What a crate bought for `paid` fetches at the next port. */
export const cargoSale = (good: CargoId, paid: number) => Math.round(paid * CARGO[good].markup);
/** Raiders that come hunting a ship sailing with `crates` in her hold: one for every two crates. */
export const raidersFor = (crates: number) => Math.ceil(crates / 2);
/** From this wave, every second raider is a brig. */
export const RAIDER_BRIG_WAVE = 8;
