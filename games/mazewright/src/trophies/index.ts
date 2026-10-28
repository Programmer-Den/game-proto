import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Mazewright's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; the scene awards them as they are earned.
 */
export const trophies = trophySet(
  'mazewright',
  [
    { id: 'firstHold', tier: 'bronze', icon: '🌱' },
    { id: 'longMaze', tier: 'bronze', icon: '🌿' },
    { id: 'firstWin', tier: 'bronze', icon: '🏡' },
    { id: 'master', tier: 'bronze', icon: '🧑‍🌾' },
    { id: 'firstChallenge', tier: 'silver', icon: '✨' },
    { id: 'everyCabbage', tier: 'silver', icon: '🥬' },
    { id: 'winter', tier: 'silver', icon: '❄️' },
    { id: 'lastCabbage', tier: 'gold', icon: '🛡️' },
    { id: 'allChallenges', tier: 'gold', icon: '🏆' },
    { id: 'endless', tier: 'gold', icon: '♾️', hidden: true },
  ],
  { en, de },
);
