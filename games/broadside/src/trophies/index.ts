import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';
import enUS from './i18n/en-US';

/**
 * Broadside's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; `check.ts` awards them from the state.
 */
export const trophies = trophySet(
  'broadside',
  [
    { id: 'firstSink', tier: 'bronze', icon: '💥' },
    { id: 'firstPrize', tier: 'bronze', icon: '⚓' },
    { id: 'bounty', tier: 'bronze', icon: '📜' },
    { id: 'convoy', tier: 'bronze', icon: '🛳️' },
    { id: 'consort', tier: 'silver', icon: '⛵' },
    { id: 'flagship', tier: 'silver', icon: '🚩' },
    { id: 'waveTen', tier: 'silver', icon: '🌊' },
    { id: 'admiral', tier: 'gold', icon: '👑' },
    { id: 'hardAdmiral', tier: 'gold', icon: '🌟', hidden: true },
  ],
  { en, 'en-US': enUS, de },
);
