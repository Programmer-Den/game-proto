import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Stonemate's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; the scene awards them as they are earned.
 */
export const trophies = trophySet(
  'stonemate',
  [
    { id: 'firstCapture', tier: 'bronze', icon: '🪨' },
    { id: 'promotion', tier: 'bronze', icon: '👑' },
    { id: 'joust', tier: 'bronze', icon: '🐴' },
    { id: 'firstWin', tier: 'bronze', icon: '🏛️' },
    { id: 'upset', tier: 'silver', icon: '🗡️' },
    { id: 'quickMate', tier: 'silver', icon: '⚡' },
    { id: 'allScenes', tier: 'silver', icon: '✨' },
    { id: 'hardWin', tier: 'silver', icon: '💎' },
    { id: 'grandmasterWin', tier: 'gold', icon: '🏆' },
    { id: 'allPairs', tier: 'gold', icon: '🗿', hidden: true },
  ],
  { en, de },
);
