import { award } from '../../../../shared/trophies';
import { EXAMS } from '../game/exams';
import { RANKS } from '../game/ranks';
import type { GameState } from '../game/state';
import { UPGRADES, UPGRADE_ORDER } from '../game/upgrades';
import { trophies } from './index';

/** Potions sold for the Busy shop trophy. */
export const FIFTY_SOLD = 50;
/** The stars for the Master Tinker rank. */
const MASTER_STARS = RANKS.find((r) => r.title === 'master')!.stars;

/** Whether each trophy's condition holds in the state. */
const EARNED: Record<string, (s: GameState) => boolean> = {
  firstSale: (s) => s.sold >= 1,
  firstCatalyst: (s) => s.fired > 0,
  firstBloom: (s) => s.bloomsFired > 0,
  threeStars: (s) => s.phase === 'sold' && s.orderStars === 3,
  firstUpgrade: (s) => UPGRADE_ORDER.some((id) => s.upgrades[id] > 0),
  master: (s) => s.stars >= MASTER_STARS,
  fiftySold: (s) => s.sold >= FIFTY_SOLD,
  allUpgrades: (s) => UPGRADE_ORDER.every((id) => s.upgrades[id] >= UPGRADES[id].costs.length),
  royal: (s) => s.royal,
  allSeals: (s) => s.seals >= EXAMS.length,
};

/** False until the first check of the page, which finds what a restored save earned. */
let checked = false;

/**
 * Awards every trophy whose condition holds. `GameScene.update` calls it every frame; the first
 * call after the page loads is quiet, so a loaded save earns its trophies without a toast.
 */
export function checkTrophies(state: GameState) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(state)) award(trophies, trophy.id, { quiet: !checked });
  checked = true;
}
