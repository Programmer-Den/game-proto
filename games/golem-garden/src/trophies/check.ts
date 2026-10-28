import { award } from '../../../../shared/trophies';
import { BLOOM_GOAL, STAR_LEAVES } from '../game/data';
import { comboAt, type GameState } from '../game/state';
import { trophies } from './index';

/** Whether each trophy's condition holds in the state. Bold call is awarded by the scene, as a called wave ends. */
const EARNED: Record<string, (state: GameState) => boolean> = {
  firstWave: (s) => s.best >= 1,
  combo: (s) => s.golems.some((g) => g.growMs === 0 && comboAt(s, g.kind, g.col, g.row) !== null),
  form: (s) => s.golems.some((g) => g.form !== null),
  bloom: (s) => s.bloom >= BLOOM_GOAL,
  queen: (s) => s.queenSquashed,
  harvest: (s) => s.stars.some((n) => n > 0),
  perfectHarvest: (s) => s.stars.some((n) => n >= STAR_LEAVES.length),
  allGardens: (s) => s.stars.every((n) => n > 0),
  laurel: (s) => s.laurels.some((n) => n > 0),
};

/** False until the first check of the page, which finds what the saved best, bloom and stars earned. */
let checked = false;

/**
 * Awards every trophy whose condition holds. The scene calls it every frame; the first call after
 * the page loads is quiet, so progress saved before trophies came earns them without a toast.
 */
export function checkTrophies(state: GameState) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(state)) award(trophies, trophy.id, { quiet: !checked });
  checked = true;
}
