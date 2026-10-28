import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Scrapyard Titans' trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This
 * file imports nothing else from the game, so the hub can load it; `GameScene` awards them.
 */
export const trophies = trophySet(
  'scrapyard-titans',
  [
    { id: 'firstWin', tier: 'bronze', icon: '🔧' },
    { id: 'topFour', tier: 'bronze', icon: '🏅' },
    { id: 'threeStar', tier: 'bronze', icon: '⭐' },
    { id: 'rareCard', tier: 'silver', icon: '🃏' },
    { id: 'fullOrigin', tier: 'silver', icon: '🔗' },
    { id: 'maxLevel', tier: 'silver', icon: '🚀' },
    { id: 'champion', tier: 'gold', icon: '🏆' },
    { id: 'allCommanders', tier: 'gold', icon: '🤖' },
    { id: 'titanRank', tier: 'gold', icon: '👑', hidden: true },
    { id: 'weeklyWin', tier: 'gold', icon: '📅', hidden: true },
  ],
  { en, de },
);
