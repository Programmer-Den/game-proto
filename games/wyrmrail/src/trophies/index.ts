import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Wyrmrail's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; `check.ts` awards them from the state.
 */
export const trophies = trophySet(
  'wyrmrail',
  [
    { id: 'firstDelivery', tier: 'bronze', icon: '📦' },
    { id: 'firstSwitch', tier: 'bronze', icon: '🔀' },
    { id: 'firstUpgrade', tier: 'bronze', icon: '🛠️' },
    { id: 'firstTunnel', tier: 'bronze', icon: '⛰️' },
    { id: 'delighted', tier: 'silver', icon: '😊' },
    { id: 'depot', tier: 'silver', icon: '🏠' },
    { id: 'secondWyrm', tier: 'silver', icon: '🐉' },
    { id: 'busyLine', tier: 'silver', icon: '🚂' },
    { id: 'festival', tier: 'gold', icon: '🎉' },
    { id: 'goldMedal', tier: 'gold', icon: '🥇', hidden: true },
  ],
  { en, de },
);
