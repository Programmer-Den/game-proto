import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Beehive Baron's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This
 * file imports nothing else from the game, so the hub can load it; `check.ts` awards them from the
 * state.
 */
export const trophies = trophySet(
  'beehive-baron',
  [
    { id: 'firstJar', tier: 'bronze', icon: '🍯' },
    { id: 'lavender', tier: 'bronze', icon: '💜' },
    { id: 'swatter', tier: 'bronze', icon: '🪰' },
    { id: 'orchard', tier: 'bronze', icon: '🍎' },
    { id: 'mead', tier: 'bronze', icon: '🛢️' },
    { id: 'secondHive', tier: 'silver', icon: '🐝' },
    { id: 'allMeadows', tier: 'silver', icon: '🌻' },
    { id: 'hundredJars', tier: 'silver', icon: '📦' },
    { id: 'baron', tier: 'gold', icon: '👑' },
    { id: 'threeGolds', tier: 'gold', icon: '🏅', hidden: true },
  ],
  { en, de },
);
