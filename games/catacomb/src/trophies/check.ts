import { award } from '../../../../shared/trophies';
import { isTempered } from '../game/cards';
import type { GameState } from '../game/state';
import { trophies } from './index';

/** Relics held at once for the Relic hoard trophy. */
const RELIC_HOARD = 5;

/** Whether the Hollow Queen fell at `depth` or deeper in this run. */
const wonAt = (s: GameState, depth: number) => s.phase === 'won' && s.depth >= depth;

/** Whether each trophy's condition holds in the state. */
const EARNED: Record<string, (state: GameState) => boolean> = {
  firstFight: (s) => s.cleared.some((i) => ['fight', 'elite', 'boss'].includes(s.rooms[i]?.kind)),
  tempered: (s) => s.deck.some(isTempered),
  elite: (s) => s.cleared.some((i) => s.rooms[i]?.kind === 'elite'),
  boneKing: (s) => s.act >= 2,
  relics: (s) => s.relics.length >= RELIC_HOARD,
  hunter: (s) => s.phase === 'won' && s.hero === 'hunter',
  hollowQueen: (s) => wonAt(s, 0),
  depthThree: (s) => wonAt(s, 3),
  depthFive: (s) => wonAt(s, 5),
};

/**
 * Awards every trophy whose condition holds. The scene calls it every frame after the tick. A run
 * is never saved, so every condition reads the run in play and a new page earns nothing on its own.
 */
export function checkTrophies(state: GameState) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(state)) award(trophies, trophy.id);
}
