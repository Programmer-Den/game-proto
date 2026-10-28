import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Deadline's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; `check.ts` awards them from the state.
 */
export const trophies = trophySet(
  'deadline',
  [
    { id: 'firstWave', tier: 'bronze', icon: '🧟' },
    { id: 'frenzy', tier: 'bronze', icon: '⚡' },
    { id: 'drum', tier: 'bronze', icon: '🛢️' },
    { id: 'survivor', tier: 'bronze', icon: '🙋' },
    { id: 'perk', tier: 'silver', icon: '⭐' },
    { id: 'boss', tier: 'silver', icon: '💀' },
    { id: 'fullSquad', tier: 'silver', icon: '👥' },
    { id: 'extract', tier: 'gold', icon: '🚁' },
    { id: 'operation', tier: 'gold', icon: '🎖️' },
    { id: 'outpost', tier: 'gold', icon: '🏰', hidden: true },
  ],
  { en, de },
);
