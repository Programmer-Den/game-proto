import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Anvilheart's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; `check.ts` awards them from the state.
 */
export const trophies = trophySet(
  'anvilheart',
  [
    { id: 'firstSale', tier: 'bronze', icon: '🗡️' },
    { id: 'masterwork', tier: 'bronze', icon: '✨' },
    { id: 'hammerOn', tier: 'bronze', icon: '🔨' },
    { id: 'firstCommission', tier: 'bronze', icon: '📜' },
    { id: 'hundredSold', tier: 'silver', icon: '📦' },
    { id: 'renowned', tier: 'silver', icon: '⭐' },
    { id: 'dragonslayer', tier: 'silver', icon: '🐉' },
    { id: 'crownBlade', tier: 'gold', icon: '👑' },
    { id: 'dynasty', tier: 'gold', icon: '🏛️', hidden: true },
  ],
  { en, de },
);
