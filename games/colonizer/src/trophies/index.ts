import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Colonizer's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; `check.ts` awards them from the state.
 */
export const trophies = trophySet(
  'colonizer',
  [
    { id: 'ageTwo', tier: 'bronze', icon: '📜' },
    { id: 'relic', tier: 'bronze', icon: '🏺' },
    { id: 'repel', tier: 'bronze', icon: '🛡️' },
    { id: 'veteran', tier: 'silver', icon: '🎖️' },
    { id: 'ageThree', tier: 'silver', icon: '👑' },
    { id: 'champion', tier: 'silver', icon: '🗡️' },
    { id: 'victory', tier: 'silver', icon: '🏆' },
    { id: 'threeWay', tier: 'gold', icon: '⚔️' },
    { id: 'hard', tier: 'gold', icon: '🔥' },
    { id: 'monument', tier: 'gold', icon: '🗿', hidden: true },
  ],
  { en, de },
);
