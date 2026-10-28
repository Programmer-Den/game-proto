import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Palisade's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; `check.ts` awards them from the state.
 */
export const trophies = trophySet(
  'palisade',
  [
    { id: 'firstWave', tier: 'bronze', icon: '🛡️' },
    { id: 'firstRain', tier: 'bronze', icon: '🏹' },
    { id: 'firstGuard', tier: 'bronze', icon: '💂' },
    { id: 'streak', tier: 'silver', icon: '🔥' },
    { id: 'firstBoss', tier: 'silver', icon: '👹' },
    { id: 'relicSet', tier: 'silver', icon: '💍' },
    { id: 'retired', tier: 'silver', icon: '📜', hidden: true },
    { id: 'allSkills', tier: 'gold', icon: '📖' },
    { id: 'siegeLifted', tier: 'gold', icon: '🏰' },
    { id: 'topHeat', tier: 'gold', icon: '🌋', hidden: true },
  ],
  { en, de },
);
