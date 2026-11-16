import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Burrow Brigade's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This
 * file imports nothing else from the game, so the hub can load it; the scene awards them as they
 * are earned.
 */
export const trophies = trophySet(
  'burrow-brigade',
  [
    { id: 'firstHit', tier: 'bronze', icon: '💥' },
    { id: 'crate', tier: 'bronze', icon: '📦' },
    { id: 'splash', tier: 'bronze', icon: '💦' },
    { id: 'firstWin', tier: 'bronze', icon: '🎖️' },
    { id: 'triple', tier: 'silver', icon: '🎯' },
    { id: 'longShot', tier: 'silver', icon: '🚀' },
    { id: 'arsenal', tier: 'silver', icon: '🧰' },
    { id: 'flawless', tier: 'gold', icon: '🛡️' },
    { id: 'hardWin', tier: 'gold', icon: '👑' },
    { id: 'allWeapons', tier: 'gold', icon: '🌟', hidden: true },
  ],
  { en, de },
);
