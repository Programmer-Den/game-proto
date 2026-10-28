import { award } from '../../../../shared/trophies';
import { REP_MAX, type GameState } from '../game/state';
import { trophies } from './index';

/** Merges chained in one hammer streak for the Ringing anvils trophy. */
const LONG_STREAK = 5;
/** Swords sold for the Busy counter trophy. */
const HUNDRED_SOLD = 100;
/** The Dragonslayer's tier (`SWORDS`). */
const DRAGONSLAYER = 8;
/** New smithies founded after a win for the Smithing dynasty trophy. */
const DYNASTY = 3;

/** Whether each trophy's condition holds in the state, with the events not yet drawn. */
const EARNED: Record<string, (state: GameState) => boolean> = {
  firstSale: (s) => s.sold >= 1,
  masterwork: (s) => s.events.some((e) => e.kind === 'merged' && e.master),
  hammerOn: (s) => s.streak >= LONG_STREAK,
  firstCommission: (s) => s.stars >= 1,
  hundredSold: (s) => s.sold >= HUNDRED_SOLD,
  renowned: (s) => s.reputation >= REP_MAX,
  dragonslayer: (s) => s.bestTier >= DRAGONSLAYER,
  crownBlade: (s) => s.won || s.charter > 0,
  dynasty: (s) => s.charter >= DYNASTY,
};

/** False until the first check of the page, which finds what a restored save earned. */
let checked = false;

/**
 * Awards every trophy whose condition holds. The scene calls it every frame after the tick and
 * before it draws (and so empties) the events; the first call after the page loads is quiet, so a
 * loaded save earns its trophies without a toast.
 */
export function checkTrophies(state: GameState) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(state)) award(trophies, trophy.id, { quiet: !checked });
  checked = true;
}
