import { award } from '../../../../shared/trophies';
import type { GameState } from '../game/state';
import { trophies } from './index';

/** Nights kept in one game for the Night watch and Keeper of the flame trophies. */
const NIGHT_WATCH = 5;
const KEEPER = 20;
/** Curses taken for the Tempting fate trophy. */
const CURSES = 4;

/** Whether each trophy's condition holds in the state. */
const EARNED: Record<string, (state: GameState) => boolean> = {
  closeCall: (s) => s.closeCalls > 0,
  firstNight: (s) => s.kept >= 1,
  bat: (s) => s.chased > 0,
  window: (s) => s.callsKept > 0,
  chain: (s) => (s.report?.chains ?? 0) > 0,
  fiveNights: (s) => s.kept >= NIGHT_WATCH,
  district: (s) => s.district !== 'keep',
  festival: (s) => s.festival,
  curses: (s) => Object.values(s.curses).reduce((a, b) => a + b, 0) >= CURSES,
  twentyNights: (s) => s.kept >= KEEPER,
};

/** Awards every trophy whose condition holds. `GameScene.update` calls it every frame, after the tick. */
export function checkTrophies(state: GameState) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(state)) award(trophies, trophy.id);
}
