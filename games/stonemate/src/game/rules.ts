import { byDifficulty, settings } from '../../../../shared/settings';
import type { AiLevel } from './ai';
import type { Kind } from './chess';

/** How deep the Stone AI looks, and how loosely it picks: the hub's difficulty. Normal is as designed. */
export const aiLevel = (): AiLevel => byDifficulty({ depth: 1, slack: 90 }, { depth: 2, slack: 15 }, { depth: 3, slack: 0 });

export const isHard = () => settings.difficulty === 'hard';

/** A win in this many of the player's own moves or fewer earns the quick-mate trophy. */
export const QUICK_MATE = 25;

/** The pairs with a hand-made capture scene of their own, keyed attacker then victim (`nn`). */
export const SIGNATURES: Record<string, string> = {
  pp: 'scuffle',
  pq: 'upset',
  nn: 'joust',
  nr: 'vault',
  bb: 'runeDuel',
  rr: 'siege',
  qq: 'royalDuel',
  kq: 'decree',
};

/** The key of a capture pair, attacker then victim: `nb` is a knight taking a bishop. */
export const pairKey = (attacker: Kind, victim: Kind) => attacker + victim;

/** There are 6 attackers and 5 victims (a king is never taken). */
export const PAIR_COUNT = 30;
