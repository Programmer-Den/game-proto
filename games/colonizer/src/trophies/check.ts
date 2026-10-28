import { award } from '../../../../shared/trophies';
import { settings } from '../../../../shared/settings';
import { RANK_KILLS, UNITS } from '../game/data';
import { PLAYER, threeWay, type GameState } from '../game/sim';
import { trophies } from './index';

/** Whether the player has won the match in the state. */
const won = (s: GameState) => s.winner === PLAYER;

/** Whether each trophy's condition holds in the state. */
const EARNED: Record<string, (state: GameState) => boolean> = {
  ageTwo: (s) => s.players[PLAYER].age >= 2,
  relic: (s) => s.camps.some((c) => c.relic && c.holder === PLAYER),
  repel: (s) => s.players[PLAYER].deeds.raid,
  veteran: (s) => [...s.units.values()].some((u) => u.owner === PLAYER && u.rank >= RANK_KILLS.length),
  ageThree: (s) => s.players[PLAYER].age >= 3,
  champion: (s) => [...s.units.values()].some((u) => u.owner === PLAYER && UNITS[u.type].role === 'champion'),
  victory: won,
  threeWay: (s) => won(s) && threeWay(s),
  hard: (s) => won(s) && settings.difficulty === 'hard',
  monument: (s) => won(s) && s.winBy === 'monument',
};

/**
 * Awards every trophy whose condition holds. `GameScene` calls it every frame of a match the player
 * plays (never while watching the AI).
 */
export function checkTrophies(state: GameState) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(state)) award(trophies, trophy.id);
}
