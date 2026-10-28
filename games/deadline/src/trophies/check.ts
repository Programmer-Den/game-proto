import { award } from '../../../../shared/trophies';
import { MAX_COMPANIONS, OUTPOST_KINDS, OUTPOST_MAX, isBossWave } from '../game/rules';
import type { GameState } from '../scenes/GameScene';
import { trophies } from './index';

/** Zombies one drum's blast has to kill for the Big bang trophy. */
const DRUM_KILLS = 5;

/** Whether each trophy's condition holds in the state. */
const EARNED: Record<string, (state: GameState) => boolean> = {
  // A break or a supply drop follows a cleared wave, and a later wave needs one cleared.
  firstWave: (s) => s.wave > 1 || s.phase === 'break' || s.phase === 'supply',
  frenzy: (s) => s.frenzies > 0,
  drum: (s) => (s.lastBlast?.killed ?? 0) >= DRUM_KILLS,
  survivor: (s) => s.survivorsSaved > 0,
  perk: (s) => s.perks.length > 0,
  // A boss wave cleared opens the supply drop, or ends an operation as a win.
  boss: (s) => s.phase === 'supply' || (s.extracted && isBossWave(s.wave)),
  fullSquad: (s) => s.stats.companions >= MAX_COMPANIONS,
  extract: (s) => s.extracted && s.operation === 'road',
  operation: (s) => s.extracted && s.operation !== 'road',
  outpost: (s) => OUTPOST_KINDS.every((k) => s.outpost[k] >= OUTPOST_MAX),
};

/** Awards every trophy whose condition holds. `GameScene.update` calls it every frame. */
export function checkTrophies(state: GameState) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(state)) award(trophies, trophy.id);
}
