import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Augury's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; `check.ts` awards them from the run
 * and the records.
 */
export const trophies = trophySet(
  'augury',
  [
    { id: 'firstSight', tier: 'bronze', icon: '🔮' },
    { id: 'omen', tier: 'bronze', icon: '🌑' },
    { id: 'charm', tier: 'bronze', icon: '🧿' },
    { id: 'fullDeck', tier: 'silver', icon: '🃏' },
    { id: 'boss', tier: 'silver', icon: '🐉' },
    { id: 'perfectDay', tier: 'silver', icon: '☀️' },
    { id: 'oracle', tier: 'gold', icon: '👁️' },
    { id: 'streak', tier: 'gold', icon: '🔥' },
    { id: 'charmed', tier: 'gold', icon: '✨' },
    { id: 'tempted', tier: 'gold', icon: '🌒', hidden: true },
  ],
  { en, de },
);
