import { award } from '../../../../shared/trophies';
import { joinedCount } from '../game/castle';
import { LEVELS, starsFor } from '../game/islands';
import { loadStars } from '../game/save';
import type { GameState } from '../game/state';
import { SPECIALS } from '../game/tiles';
import { trophies } from './index';

/** The round a kingdom must reach for Eighth harvest. */
const ROUND = 8;
/** Buildings joined to the castle at once for All roads lead home (a greedy player joins about 50 by the end). */
const CHAIN = 40;
/** Crowns won in all for Crown jewels. */
const CROWNS = 10;
/** A finished kingdom's score for Golden age (a greedy player finishes with 210 to 340). */
const BIG = 350;

/** Whether each trophy's condition holds in the state; the campaign's read the saved stars. */
const EARNED: Record<string, (s: GameState, stars: number[]) => boolean> = {
  firstCrown: (s) => s.crowns >= 1,
  firstManor: (s) => s.grid.some((cells) => cells.includes('manor')),
  firstTrade: (s) => s.tradedIn > 0,
  allGifts: (s) => SPECIALS.every((b) => s.unlocked.includes(b)),
  roundEight: (s) => s.round >= ROUND,
  longChain: (s) => joinedCount(s.grid) >= CHAIN,
  tenCrowns: (s) => s.crowns >= CROWNS,
  bigKingdom: (s) => s.phase === 'over' && s.score >= BIG,
  threeStars: (_, stars) => stars.some((n) => n >= 3),
  campaign: (_, stars) => LEVELS.every((_, i) => (stars[i] ?? 0) > 0),
};

/** False until the first check of the page, which finds what the saved crowns and stars already earned. */
let checked = false;

/**
 * Awards every trophy whose condition holds. The scene calls it after every change (`refresh`); the
 * first call after the page loads is quiet, so crowns and stars won before trophies existed earn
 * theirs without a toast.
 */
export function checkTrophies(s: GameState) {
  const stars = loadStars();
  // Fold in the kingdom just finished, so the stars count even when storage is blocked.
  if (s.phase === 'over' && s.mode === 'campaign')
    stars[s.level - 1] = Math.max(stars[s.level - 1] ?? 0, starsFor(s.level, s.score));
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(s, stars)) award(trophies, trophy.id, { quiet: !checked });
  checked = true;
}
