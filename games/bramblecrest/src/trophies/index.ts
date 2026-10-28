import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Bramblecrest's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This
 * file imports nothing else from the game, so the hub can load it; `check.ts` awards them.
 */
export const trophies = trophySet(
  'bramblecrest',
  [
    { id: 'blade', tier: 'bronze', icon: '🗡️' },
    { id: 'thornmother', tier: 'bronze', icon: '🌹' },
    { id: 'firstUpgrade', tier: 'bronze', icon: '🥧' },
    { id: 'bellyUp', tier: 'bronze', icon: '🪲' },
    { id: 'bellwraith', tier: 'silver', icon: '🔔' },
    { id: 'allUpgrades', tier: 'silver', icon: '🎒' },
    { id: 'trial', tier: 'silver', icon: '⌛' },
    { id: 'swift', tier: 'gold', icon: '⚡' },
    { id: 'allStones', tier: 'gold', icon: '🌙' },
    { id: 'unbroken', tier: 'gold', icon: '🕯️', hidden: true },
  ],
  { en, de },
);
