import { award } from '../../../../shared/trophies';
import { settings } from '../../../../shared/settings';
import type { GameState } from '../game/state';
import { trophies } from './index';

/** The wave to come through to the harbor for the Old salt trophy. */
const OLD_SALT_WAVE = 10;

/** Whether each trophy's condition holds in the state. */
const EARNED: Record<string, (state: GameState) => boolean> = {
  firstSink: (s) => s.sunk >= 1,
  firstPrize: (s) => s.taken >= 1,
  bounty: (s) => (s.bountyPaid ?? 0) > 0,
  convoy: (s) => s.convoy?.state === 'arrived',
  consort: (s) => s.consorts.length > 0,
  flagship: (s) => s.waveSunk.includes('flagship') || s.waveSunk.includes('admiral'),
  waveTen: (s) => s.phase === 'harbor' && s.wave >= OLD_SALT_WAVE,
  admiral: (s) => s.won,
  hardAdmiral: (s) => s.won && settings.difficulty === 'hard',
};

/**
 * Awards every trophy whose condition holds. The scene calls it every frame after the tick. A run
 * is never saved, so every condition reads the run in play and a new page earns nothing on its own.
 */
export function checkTrophies(state: GameState) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(state)) award(trophies, trophy.id);
}
