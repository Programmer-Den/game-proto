import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Apothecary's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; `check.ts` awards them from the state.
 */
export const trophies = trophySet(
  'apothecary',
  [
    { id: 'firstSale', tier: 'bronze', icon: '🧪' },
    { id: 'firstUpgrade', tier: 'bronze', icon: '⚒️' },
    { id: 'firstCraftsman', tier: 'bronze', icon: '🧑‍🔧' },
    { id: 'firstPixie', tier: 'bronze', icon: '🧚' },
    { id: 'hundredSold', tier: 'silver', icon: '📦' },
    { id: 'fullPurse', tier: 'silver', icon: '💰' },
    { id: 'allRecipes', tier: 'silver', icon: '📜' },
    { id: 'cure', tier: 'gold', icon: '🌿' },
    { id: 'firstShop', tier: 'gold', icon: '🏪', hidden: true },
    { id: 'city', tier: 'gold', icon: '🏰', hidden: true },
  ],
  { en, de },
);
