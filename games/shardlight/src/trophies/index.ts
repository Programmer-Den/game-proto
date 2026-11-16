import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Shardlight's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; the scene awards them as they are earned.
 */
export const trophies = trophySet(
  'shardlight',
  [
    { id: 'firstPane', tier: 'bronze', icon: '🔹' },
    { id: 'firstWindow', tier: 'bronze', icon: '🪟' },
    { id: 'beads', tier: 'bronze', icon: '🔮' },
    { id: 'flawless', tier: 'silver', icon: '✨' },
    { id: 'triple', tier: 'silver', icon: '🔆' },
    { id: 'chain', tier: 'silver', icon: '⛓️' },
    { id: 'firstChapel', tier: 'silver', icon: '🌹' },
    { id: 'allStars', tier: 'gold', icon: '🌟', hidden: true },
    { id: 'allChapels', tier: 'gold', icon: '⛪' },
  ],
  { en, de },
);
