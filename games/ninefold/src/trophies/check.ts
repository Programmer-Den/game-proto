import { award } from '../../../../shared/trophies';
import { STYLES } from '../game/catalog';
import type { Progress } from '../game/state';
import { trophies } from './index';

/** Whether each trophy's condition holds in the progress. */
const EARNED: Record<string, (p: Progress) => boolean> = {
  firstSolve: (p) => p.solved >= 1,
  flawless: (p) => p.flawless >= 1,
  fast: (p) => p.fast >= 1,
  streak3: (p) => p.bestStreak >= 3,
  firstBoss: (p) => p.bosses >= 1,
  floor10: (p) => p.bestFloor >= 10,
  allStyles: (p) => STYLES.every((s) => p.unlocked.includes(s)),
  streak7: (p) => p.bestStreak >= 7,
  floor20: (p) => p.bestFloor >= 20,
};

/** False until the first check of the page, which finds what a saved progress already earned. */
let checked = false;

/** Awards every trophy whose condition holds; the first call after the page loads is quiet. */
export function checkTrophies(p: Progress) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(p)) award(trophies, trophy.id, { quiet: !checked });
  checked = true;
}
