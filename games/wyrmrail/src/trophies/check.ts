import { award } from '../../../../shared/trophies';
import { terrainAt } from '../game/map';
import { MOOD_MAX, MOOD_ROUND, type GameState, type Upgrade } from '../game/state';
import { trophies } from './index';

/** Orders delivered in one game for the Busy line trophy. */
export const BUSY_LINE = 25;

/** A tile from a track key (`c,r`). */
const tileOf = (k: string) => {
  const [c, r] = k.split(',').map(Number);
  return { c, r };
};

/** Whether each trophy's condition holds in the state. */
const EARNED: Record<string, (s: GameState) => boolean> = {
  firstDelivery: (s) => s.totalDelivered >= 1,
  firstSwitch: (s) => Object.keys(s.switches).length > 0,
  firstUpgrade: (s) => (Object.keys(s.upgrades) as Upgrade[]).some((id) => s.upgrades[id] > 0),
  firstTunnel: (s) => s.track.some((k) => terrainAt(s.valley, tileOf(k)) === 'mountain'),
  delighted: (s) => s.round >= MOOD_ROUND && s.moods.some((m) => m >= MOOD_MAX),
  depot: (s) => s.depots.length > 0,
  secondWyrm: (s) => s.wyrms.length >= 2,
  busyLine: (s) => s.totalDelivered >= BUSY_LINE,
  festival: (s) => s.phase === 'won',
  goldMedal: (s) => s.medal === 'gold',
};

/**
 * Awards every trophy whose condition holds. `GameScene.update` calls it every frame after the tick.
 * Nothing but the medals is saved, so there is no restored game to award quietly.
 */
export function checkTrophies(state: GameState) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(state)) award(trophies, trophy.id);
}
