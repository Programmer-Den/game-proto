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

/**
 * Awards every trophy whose condition holds. `GameScene` calls it once a move has played out and
 * after a purchase, each right after saving, and quietly once a save is loaded, so a restored save
 * earns its trophies without a toast.
 */
export function checkTrophies(state: GameState, quiet = false) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(state)) award(trophies, trophy.id, { quiet });
}
