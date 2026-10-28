import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Lane Brawl's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; `check.ts` awards them from the match.
 */
export const trophies = trophySet(
  'lane-brawl',
  [
    { id: 'firstKill', tier: 'bronze', icon: '⚔️' },
    { id: 'firstTower', tier: 'bronze', icon: '🏰' },
    { id: 'firstDrake', tier: 'bronze', icon: '🐉' },
    { id: 'quickWin', tier: 'bronze', icon: '⚡' },
    { id: 'spree', tier: 'silver', icon: '🔥' },
    { id: 'beast', tier: 'silver', icon: '👹' },
    { id: 'firstWin', tier: 'silver', icon: '🏆' },
    { id: 'drakeSoul', tier: 'gold', icon: '🐲' },
    { id: 'flawless', tier: 'gold', icon: '🛡️', hidden: true },
    { id: 'fiveClasses', tier: 'gold', icon: '🎖️', hidden: true },
  ],
  { en, de },
);
