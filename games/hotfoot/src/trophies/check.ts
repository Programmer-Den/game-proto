import { award } from '../../../../shared/trophies';
import { ARMOURY, ARMOURY_IDS } from '../game/armoury';
import { pairsOf } from '../game/pairs';
import { STREAK, metres, streakMax, streakMult, type GameState } from '../game/state';
import { trophies } from './index';

/** Foes stomped in one run for the Heavy boots trophy. */
const STOMPS = 10;
/** Metres run in one run for the Long road trophy. */
const DISTANCE = 1000;

/** Whether each trophy's condition holds in the state. */
const EARNED: Record<string, (state: GameState) => boolean> = {
  checkpoint: (s) => s.stage > 1 || s.phase === 'checkpoint',
  stomps: (s) => s.stomps >= STOMPS,
  shrine: (s) => s.shrines.some((sh) => sh.used),
  streak: (s) => streakMult(s.streak, streakMax(s.road)) >= STREAK.max,
  pair: (s) => pairsOf(s.ranks).length > 0,
  dare: (s) => !!s.dare?.done,
  gatekeeper: (s) => s.bosses > 0,
  distance: (s) => metres(s.distance) >= DISTANCE,
  armoury: (s) => ARMOURY_IDS.every((id) => s.armoury[id] >= ARMOURY[id].prices.length),
  dragon: (s) => s.dragonBeaten || s.crown,
};

/** False until the first check of the page, which finds what a restored save earned. */
let checked = false;

/**
 * Awards every trophy whose condition holds. `GameScene.update` calls it every frame, after the
 * tick; the first call after the page loads is quiet, so a loaded save earns its trophies without
 * a toast.
 */
export function checkTrophies(state: GameState) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(state)) award(trophies, trophy.id, { quiet: !checked });
  checked = true;
}
