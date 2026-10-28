import { award } from '../../../../shared/trophies';
import { SETS, setComplete, type SetId } from '../game/relics';
import { offerable, type GameState } from '../game/state';
import { trophies } from './index';

/** The kill streak for the On a roll trophy. */
export const STREAK = 10;
/** The Troll King's wave, the first boss, and the top heat. */
const FIRST_BOSS_WAVE = 10;
const TOP_HEAT = 3;

/** Whether each trophy's condition holds in the state. */
const EARNED: Record<string, (s: GameState) => boolean> = {
  firstWave: (s) => s.bestWave >= 1,
  firstRain: (s) => s.rain.volleys.length > 0,
  firstGuard: (s) => s.guards.some((g) => g !== null),
  streak: (s) => s.streak.best >= STREAK,
  firstBoss: (s) => s.bestWave >= FIRST_BOSS_WAVE,
  relicSet: (s) => (Object.keys(SETS) as SetId[]).some((set) => setComplete(s.relics, set)),
  retired: (s) => s.legacy.retired > 0,
  allSkills: (s) => offerable(s).length === 0,
  siegeLifted: (s) => s.won || s.heatUnlocked > 0,
  topHeat: (s) => s.won && s.heat >= TOP_HEAT,
};

/** False until the first check of the page, which finds what a restored save earned. */
let checked = false;

/**
 * Awards every trophy whose condition holds. `GameScene.update` calls it every frame after the tick;
 * the first call after the page loads is quiet, so a loaded hero earns theirs without a toast.
 */
export function checkTrophies(state: GameState) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(state)) award(trophies, trophy.id, { quiet: !checked });
  checked = true;
}
