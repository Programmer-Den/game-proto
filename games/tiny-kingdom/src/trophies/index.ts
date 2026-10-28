import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';
import enUS from './i18n/en-US';

/**
 * Tiny Kingdom's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This
 * file imports nothing else from the game, so the hub can load it; `check.ts` awards them from the state.
 */
export const trophies = trophySet(
  'tiny-kingdom',
  [
    { id: 'firstCrown', tier: 'bronze', icon: '👑' },
    { id: 'firstManor', tier: 'bronze', icon: '🏡' },
    { id: 'firstTrade', tier: 'bronze', icon: '⚖️' },
    { id: 'allGifts', tier: 'bronze', icon: '🎁' },
    { id: 'roundEight', tier: 'silver', icon: '🌾' },
    { id: 'longChain', tier: 'silver', icon: '🏰' },
    { id: 'tenCrowns', tier: 'silver', icon: '💎' },
    { id: 'bigKingdom', tier: 'gold', icon: '⭐' },
    { id: 'threeStars', tier: 'gold', icon: '🌟' },
    { id: 'campaign', tier: 'gold', icon: '🗺️', hidden: true },
  ],
  { en, 'en-US': enUS, de },
);
