import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * TinctureTinker's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This
 * file imports nothing else from the game, so the hub can load it; `check.ts` awards them from the state.
 */
export const trophies = trophySet(
  'tincture-tinker',
  [
    { id: 'firstSale', tier: 'bronze', icon: '🧪' },
    { id: 'firstCatalyst', tier: 'bronze', icon: '⚗️' },
    { id: 'firstBloom', tier: 'bronze', icon: '🌸' },
    { id: 'threeStars', tier: 'bronze', icon: '⭐' },
    { id: 'firstUpgrade', tier: 'bronze', icon: '🔧' },
    { id: 'master', tier: 'silver', icon: '🎓' },
    { id: 'fiftySold', tier: 'silver', icon: '📦' },
    { id: 'allUpgrades', tier: 'silver', icon: '🛠️', hidden: true },
    { id: 'royal', tier: 'gold', icon: '👑' },
    { id: 'allSeals', tier: 'gold', icon: '🏅', hidden: true },
  ],
  { en, de },
);
