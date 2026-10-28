import { trophySet } from '../../../../shared/trophies';
import en from './i18n/en';
import de from './i18n/de';

/**
 * Catacomb's trophies (`shared/trophies.ts`), handed to `setupGame` and read by the hub. This file
 * imports nothing else from the game, so the hub can load it; `check.ts` awards them from the state.
 */
export const trophies = trophySet(
  'catacomb',
  [
    { id: 'firstFight', tier: 'bronze', icon: '⚔️' },
    { id: 'tempered', tier: 'bronze', icon: '🔥' },
    { id: 'elite', tier: 'bronze', icon: '💀' },
    { id: 'boneKing', tier: 'silver', icon: '🦴' },
    { id: 'relics', tier: 'silver', icon: '💍' },
    { id: 'hunter', tier: 'silver', icon: '🏹' },
    { id: 'hollowQueen', tier: 'gold', icon: '👑' },
    { id: 'depthThree', tier: 'gold', icon: '⛓️' },
    { id: 'depthFive', tier: 'gold', icon: '🌑', hidden: true },
  ],
  { en, de },
);
