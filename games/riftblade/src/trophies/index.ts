import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';
import enUS from './i18n/en-US';

/**
 * Riftblade's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; `check.ts` awards them.
 */
export const trophies = trophySet(
  'riftblade',
  [
    { id: 'firstBoss', tier: 'bronze', icon: '🤖' },
    { id: 'capstone', tier: 'bronze', icon: '🔶' },
    { id: 'newHero', tier: 'bronze', icon: '🔓' },
    { id: 'firstPiece', tier: 'bronze', icon: '⚒️' },
    { id: 'crusade', tier: 'silver', icon: '🏆' },
    { id: 'weekly', tier: 'silver', icon: '📅' },
    { id: 'heat3', tier: 'silver', icon: '🔥' },
    { id: 'heat5', tier: 'gold', icon: '🌋' },
    { id: 'armouryFull', tier: 'gold', icon: '🛡️' },
    { id: 'allHeroes', tier: 'gold', icon: '👑', hidden: true },
  ],
  { en, 'en-US': enUS, de },
);
