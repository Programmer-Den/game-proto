import { award } from '../../../../shared/trophies';
import { SECTORS } from '../game/campaign';
import { CONTRACT_STEPS } from '../game/contracts';
import { PLAYER, VETERAN_RANKS, type World } from '../game/world';
import { trophies } from './index';

/** Whether each trophy's condition holds in the battle. */
const EARNED: Record<string, (w: World) => boolean> = {
  firstContract: (w) => w.contract.done.length >= 1,
  beacon: (w) => w.beacon.owner === PLAYER,
  // Only the player makes truces, so a rival under one has accepted the player's.
  truce: (w) => w.sides.some((s) => s.index !== PLAYER && s.truceMs > 0),
  ace: (w) => w.units.some((u) => u.faction === PLAYER && u.kills >= VETERAN_RANKS[VETERAN_RANKS.length - 1]),
  derelicts: (w) => w.derelicts.length > 0 && w.derelicts.every((d) => d.owner === PLAYER),
  flagship: (w) => w.sides[PLAYER].flagship.state === 'out',
  victory: (w) => w.phase === 'won',
  outpaced: (w) => w.contract.done.length >= CONTRACT_STEPS && w.sides.every((s) => s.index === PLAYER || s.deal.step < CONTRACT_STEPS),
  campaign: (w) => w.phase === 'won' && w.sector === SECTORS.length - 1,
};

/** Awards every trophy whose condition holds; the scene calls it every frame of a battle, never while watching. */
export function checkTrophies(w: World) {
  if (w.watch) return;
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(w)) award(trophies, trophy.id);
}
