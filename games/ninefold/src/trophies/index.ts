import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Ninefold's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; `check.ts` awards them from the progress.
 */
export const trophies = trophySet(
  'ninefold',
  [
    { id: 'firstSolve', tier: 'bronze', icon: '🔢' },
    { id: 'flawless', tier: 'bronze', icon: '✨' },
    { id: 'fast', tier: 'bronze', icon: '⏱️' },
    { id: 'streak3', tier: 'silver', icon: '📅' },
    { id: 'firstBoss', tier: 'silver', icon: '👑' },
    { id: 'floor10', tier: 'silver', icon: '⛏️' },
    { id: 'allStyles', tier: 'gold', icon: '🎨' },
    { id: 'streak7', tier: 'gold', icon: '🔥', hidden: true },
    { id: 'floor20', tier: 'gold', icon: '🕳️', hidden: true },
  ],
  { en, de },
);
