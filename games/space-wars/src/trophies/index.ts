import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Space Wars' trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; `check.ts` awards them from the battle.
 */
export const trophies = trophySet(
  'space-wars',
  [
    { id: 'firstContract', tier: 'bronze', icon: '📜' },
    { id: 'beacon', tier: 'bronze', icon: '📡' },
    { id: 'truce', tier: 'bronze', icon: '🤝' },
    { id: 'ace', tier: 'silver', icon: '🎖️' },
    { id: 'derelicts', tier: 'silver', icon: '🛰️' },
    { id: 'flagship', tier: 'silver', icon: '🚀' },
    { id: 'victory', tier: 'silver', icon: '🏆' },
    { id: 'outpaced', tier: 'gold', icon: '🏁' },
    { id: 'campaign', tier: 'gold', icon: '🌌', hidden: true },
  ],
  { en, de },
);
