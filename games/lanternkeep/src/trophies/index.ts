import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';
import enUS from './i18n/en-US';

/**
 * Lanternkeep's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; `check.ts` awards them from the state.
 */
export const trophies = trophySet(
  'lanternkeep',
  [
    { id: 'closeCall', tier: 'bronze', icon: '💧' },
    { id: 'firstNight', tier: 'bronze', icon: '🏮' },
    { id: 'bat', tier: 'bronze', icon: '🦇' },
    { id: 'window', tier: 'bronze', icon: '🪟' },
    { id: 'chain', tier: 'silver', icon: '🔗' },
    { id: 'fiveNights', tier: 'silver', icon: '🌙' },
    { id: 'district', tier: 'silver', icon: '🗺️' },
    { id: 'festival', tier: 'gold', icon: '🎆' },
    { id: 'curses', tier: 'gold', icon: '🎭' },
    { id: 'twentyNights', tier: 'gold', icon: '🌌', hidden: true },
  ],
  { en, 'en-US': enUS, de },
);
