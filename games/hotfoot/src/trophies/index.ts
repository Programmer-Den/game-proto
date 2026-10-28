import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import enUS from './i18n/en-US';
import de from './i18n/de';

/**
 * Hotfoot's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; `check.ts` awards them from the state.
 */
export const trophies = trophySet(
  'hotfoot',
  [
    { id: 'checkpoint', tier: 'bronze', icon: '🚩' },
    { id: 'stomps', tier: 'bronze', icon: '👢' },
    { id: 'shrine', tier: 'bronze', icon: '🕯️' },
    { id: 'streak', tier: 'silver', icon: '✨' },
    { id: 'pair', tier: 'silver', icon: '🔗' },
    { id: 'dare', tier: 'silver', icon: '📯' },
    { id: 'gatekeeper', tier: 'silver', icon: '👹' },
    { id: 'distance', tier: 'gold', icon: '🏁' },
    { id: 'armoury', tier: 'gold', icon: '🛡️' },
    { id: 'dragon', tier: 'gold', icon: '🐉', hidden: true },
  ],
  { en, 'en-US': enUS, de },
);
