import { byDifficulty } from '../../../../shared/settings';
import type { AiLevel } from './ai';
import type { Kind } from './chess';
import type { DeepLevel } from './deep';

export type LevelId = 'beginner' | 'novice' | 'casual' | 'club' | 'expert' | 'master' | 'grandmaster';

/**
 * The Stone AI's seven levels, weakest first; the menu picks one by its number (1 to 7). The lower
 * four use the small search in `ai.ts` (how deep it looks, and how loosely it picks among good
 * moves), the top three the deep search in `deep.ts` (its deepest iteration and node budget). Each
 * level beat the one below it in AI-against-AI matches.
 */
export const LEVELS: readonly { id: LevelId; shallow?: AiLevel; deep?: DeepLevel }[] = [
  { id: 'beginner', shallow: { depth: 1, slack: 250 } },
  { id: 'novice', shallow: { depth: 1, slack: 90 } },
  { id: 'casual', shallow: { depth: 2, slack: 15 } },
  { id: 'club', shallow: { depth: 3, slack: 0 } },
  { id: 'expert', deep: { depth: 3, nodes: 30_000 } },
  { id: 'master', deep: { depth: 5, nodes: 200_000 } },
  { id: 'grandmaster', deep: { depth: 12, nodes: 700_000 } },
];

/** The level a player starts on before picking one: the hub's difficulty. Normal is Casual, as designed. */
export const defaultLevel = () => byDifficulty(2, 3, 4);

/** Clamps a stored level number to 1 to 7. */
export const clampLevel = (n: unknown) => (typeof n === 'number' && Number.isInteger(n) ? Math.min(LEVELS.length, Math.max(1, n)) : defaultLevel());

/** Beating this level or a stronger one earns `hardWin` (Club player, the old Hard). */
export const HARD_LEVEL = 4;

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
