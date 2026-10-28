import { award } from '../../../../shared/trophies';
import { rankOf, tileAt, type GameState } from '../game/state';
import { UPGRADES, UPGRADE_IDS } from '../game/upgrades';
import { trophies } from './index';

/** Coins at once for the Full purse trophy. */
export const FULL_PURSE = 300;

/** Whether the riddle's treasure on this isle was dug up by the player, not the rival. */
const ownTreasure = (s: GameState) => !!s.riddle?.found && !s.riddle.rival;

/** Whether each trophy's condition holds in the state. */
const EARNED: Record<string, (s: GameState) => boolean> = {
  firstChart: (s) => s.voyage > 1 || s.phase === 'harbor' || s.phase === 'atlas',
  firstFeature: (s) => s.features.some((f) => f.tiles.every((p) => tileAt(s, p.x, p.y)?.revealed)),
  firstArtefact: (s) => s.artifacts > 0,
  firstUpgrade: (s) => UPGRADE_IDS.some((id) => rankOf(s, id) > 0),
  treasure: ownTreasure,
  fullPurse: (s) => s.coins >= FULL_PURSE,
  firstPage: (s) => s.atlas.length > 0,
  royal: (s) => !!s.royal,
  beatRival: (s) => !!s.rival && ownTreasure(s),
  allUpgrades: (s) => UPGRADE_IDS.every((id) => rankOf(s, id) >= UPGRADES[id].costs.length),
};

/** False until the first check of the page, which finds what a restored save earned. */
let checked = false;

/**
 * Awards every trophy whose condition holds. `GameScene` calls it every frame; the first call after
 * the page loads is quiet, so a loaded save earns its trophies without a toast.
 */
export function checkTrophies(state: GameState) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(state)) award(trophies, trophy.id, { quiet: !checked });
  checked = true;
}
