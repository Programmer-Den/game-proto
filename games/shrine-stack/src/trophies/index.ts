import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import enUS from './i18n/en-US';
import de from './i18n/de';

/**
 * Shrine Stack's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; `check.ts` awards them from the rules' events.
 */
export const trophies = trophySet(
  'shrine-stack',
  [
    { id: 'firstTier', tier: 'bronze', icon: '🧱' },
    { id: 'regrown', tier: 'bronze', icon: '🌱' },
    { id: 'cursed', tier: 'bronze', icon: '💀' },
    { id: 'gilded', tier: 'silver', icon: '🌟' },
    { id: 'crowned', tier: 'silver', icon: '👑' },
    { id: 'flawless', tier: 'gold', icon: '💎' },
    { id: 'skyAltar', tier: 'gold', icon: '☁️', hidden: true },
    { id: 'threeAltars', tier: 'gold', icon: '🌌', hidden: true },
  ],
  { en, 'en-US': enUS, de },
);
