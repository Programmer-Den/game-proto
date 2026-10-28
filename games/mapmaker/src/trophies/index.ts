import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import enUS from './i18n/en-US';
import de from './i18n/de';

/**
 * Mapmaker's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; `check.ts` awards them from the state.
 */
export const trophies = trophySet(
  'mapmaker',
  [
    { id: 'firstChart', tier: 'bronze', icon: '🗺️' },
    { id: 'firstFeature', tier: 'bronze', icon: '🏞️' },
    { id: 'firstArtefact', tier: 'bronze', icon: '🏺' },
    { id: 'firstUpgrade', tier: 'bronze', icon: '🧭' },
    { id: 'treasure', tier: 'silver', icon: '💎' },
    { id: 'fullPurse', tier: 'silver', icon: '💰' },
    { id: 'firstPage', tier: 'silver', icon: '📖' },
    { id: 'royal', tier: 'gold', icon: '👑' },
    { id: 'beatRival', tier: 'gold', icon: '🏴', hidden: true },
    { id: 'allUpgrades', tier: 'gold', icon: '🔭', hidden: true },
  ],
  { en, 'en-US': enUS, de },
);
