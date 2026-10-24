import { award } from '../../../../shared/trophies';
import { townIsCity } from '../game/districts';
import { RESEARCH_ORDER, type GameState } from '../game/state';
import { trophies } from './index';

/** Coins in the purse at once for the Full purse trophy. */
const FULL_PURSE = 1000;
/** Potions sold for the Busy counter trophy. */
const HUNDRED_SOLD = 100;

/** Whether each trophy's condition holds in the state. */
const EARNED: Record<string, (state: GameState) => boolean> = {
  firstSale: (s) => s.sold >= 1,
  firstUpgrade: (s) => Object.values(s.upgrades).some((u) => u.level > 0),
  firstCraftsman: (s) => Object.values(s.craftsmen).some((c) => c.level > 0),
  firstPixie: (s) => Object.values(s.belts).some((b) => b.built),
  hundredSold: (s) => s.sold >= HUNDRED_SOLD,
  fullPurse: (s) => s.coins >= FULL_PURSE,
  allRecipes: (s) => s.upgrades.research.level >= RESEARCH_ORDER.length,
  cure: (s) => s.seals > 0 || !!s.plague?.cured,
  firstShop: (s) => Object.keys(s.town.shops).length > 0,
  city: (s) => townIsCity(s.town.districts),
};

/** False until the first check of the page, which finds what a restored save or the time away earned. */
let checked = false;

/**
 * Awards every trophy whose condition holds. The scenes call it every frame; the first call after
 * the page loads is quiet, so a loaded save and the autopilot's catch-up earn theirs without a toast.
 */
export function checkTrophies(state: GameState) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(state)) award(trophies, trophy.id, { quiet: !checked });
  checked = true;
}
