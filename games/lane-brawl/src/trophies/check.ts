import { award } from '../../../../shared/trophies';
import { DRAKE } from '../game/data';
import type { GameState } from '../game/state';
import { trophies } from './index';

/** Kills in a row without dying for On a roll, and classes won with for Jack of all trades. */
const SPREE = 3;
const CLASSES = 5;

/** Whether each trophy's condition holds in the match, with the wins per class kept in the browser. */
const EARNED: Record<string, (s: GameState, mastery: Record<string, number>) => boolean> = {
  firstKill: (s) => (me(s)?.kills ?? 0) >= 1,
  firstTower: (s) => s.units.some((u) => u.kind === 'tower' && u.side === 'red' && u.dead),
  firstDrake: (s) => s.drakeStacks.blue.length >= 1,
  quickWin: (s) => s.phase === 'won' && s.quick,
  spree: (s) => (me(s)?.killStreak ?? 0) >= SPREE,
  beast: (s) => s.beastBuff.blue > 0 || s.elderBuff.blue > 0,
  firstWin: (s) => s.phase === 'won' && !s.quick,
  drakeSoul: (s) => s.drakeStacks.blue.length >= DRAKE.soul,
  flawless: (s) => s.phase === 'won' && me(s)?.deaths === 0,
  fiveClasses: (_, mastery) => Object.keys(mastery).length >= CLASSES,
};

const me = (s: GameState) => s.units.find((u) => u.id === s.player);

/**
 * Awards every trophy whose condition holds. The scene calls it every frame of a match the player
 * plays (never while watching the AI), after the end panel has counted a win.
 */
export function checkTrophies(s: GameState, mastery: Record<string, number>) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(s, mastery)) award(trophies, trophy.id);
}
