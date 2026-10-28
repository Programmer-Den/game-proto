import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Golem Garden's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; `check.ts` awards them from the state.
 */
export const trophies = trophySet(
  'golem-garden',
  [
    { id: 'firstWave', tier: 'bronze', icon: '🌱' },
    { id: 'combo', tier: 'bronze', icon: '🌿' },
    { id: 'form', tier: 'bronze', icon: '🗿' },
    { id: 'boldCall', tier: 'bronze', icon: '📯' },
    { id: 'bloom', tier: 'silver', icon: '🌸' },
    { id: 'queen', tier: 'silver', icon: '👑' },
    { id: 'harvest', tier: 'silver', icon: '🧺' },
    { id: 'perfectHarvest', tier: 'gold', icon: '🌟' },
    { id: 'allGardens', tier: 'gold', icon: '🗺️' },
    { id: 'laurel', tier: 'gold', icon: '🏅', hidden: true },
  ],
  { en, de },
);
