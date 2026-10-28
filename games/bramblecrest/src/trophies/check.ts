import { award } from '../../../../shared/trophies';
import { MOONSTONES, reached, UPGRADES, type GameState } from '../game/state';
import { trophies } from './index';

/** The hourglass trials' times for the Swifter than sand trophy, in ms. */
export const PAR = { shrine: 150000, belfry: 120000 };

/** Whether each trophy's condition holds in the state. Belly up is awarded when it happens (`GameScene.hitFoe`). */
const EARNED: Record<string, (s: GameState) => boolean> = {
  blade: (s) => s.items.sword,
  thornmother: (s) => s.flags.includes('boss'),
  firstUpgrade: (s) => s.upgrades.length > 0,
  bellwraith: (s) => s.flags.includes('wraith'),
  allUpgrades: (s) => UPGRADES.every((u) => s.upgrades.includes(u.id)),
  trial: (s) => Object.keys(s.trials).length > 0,
  swift: (s) => (s.trials.shrine ?? Infinity) < PAR.shrine && (s.trials.belfry ?? Infinity) < PAR.belfry,
  allStones: (s) => s.moonstones.length >= MOONSTONES,
  unbroken: (s) => reached(s, 'end') && s.falls === 0,
};

/** False until the first check of the page, which finds what a restored save earned. */
let checked = false;

/**
 * Awards every trophy whose condition holds. The scene calls it every frame; the first call after
 * the page loads is quiet, so a loaded save earns its trophies without a toast.
 */
export function checkTrophies(state: GameState) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(state)) award(trophies, trophy.id, { quiet: !checked });
  checked = true;
}

/** Awards a trophy earned by something that happens rather than by the state (Belly up). */
export function awardNow(id: string) {
  award(trophies, id);
}
