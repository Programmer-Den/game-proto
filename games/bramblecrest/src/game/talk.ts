// What each person says, by where the quest stands, and what talking to them does.

import type { NpcId } from './maps';
import { hasFlag, maxSeeds, reached, type GameState } from './state';
import { t } from '../i18n';

/** What a talk does once its last line is read. */
export type TalkEffect = 'quest-blade' | 'quest-thorns' | 'finish' | 'cat-pet' | 'cat-stone' | 'quest-bell' | 'seeds' | 'refill' | 'finish-two' | 'trial' | 'shop-baker' | 'shop-hermit';

export interface Talk {
  lines: string[];
  then?: TalkEffect;
}

export function talk(id: NpcId, s: GameState): Talk {
  switch (id) {
    case 'elder':
      return elder(s);
    case 'pip':
      if (reached(s, 'bell') && !s.moonstones.includes('v-nook'))
        return { lines: [t('pipNook1'), t('pipNook2')] };
      return {
        lines: s.moonstones.includes('v-pond')
          ? [t('pipThanks')]
          : [t('pipPond1'), t('pipPond2')],
      };
    case 'baker':
      // Once the knight can cut bushes for coins, Marla sells her wares after the hint.
      return s.quest === 'start' || s.quest === 'blade'
        ? { lines: [t('bakerBread')] }
        : { lines: [t('bakerTrees1'), t('bakerTrees2'), t('bakerShop')], then: 'shop-baker' };
    case 'cat': {
      if (hasFlag(s, 'cat-3')) return { lines: [t('catAsleep')] };
      if (hasFlag(s, 'cat-2')) return { lines: [t('catGift')], then: 'cat-stone' };
      if (hasFlag(s, 'cat-1')) return { lines: [t('catStretch')], then: 'cat-pet' };
      return { lines: [t('catPurr')], then: 'cat-pet' };
    }
    case 'hermit':
      return hermit(s);
  }
}

function hermit(s: GameState): Talk {
  if (s.quest === 'bell')
    return {
      lines: [
        t('hermitBell1'),
        t('hermitBell2'),
        t('hermitBell3'),
      ],
      then: 'seeds',
    };
  // Once he has given bellseeds, Sedge refills them and then sells his wares.
  if (reached(s, 'belfry')) {
    if (s.seeds < maxSeeds(s)) return { lines: [t('hermitRefill')], then: 'refill' };
    return {
      lines: [...(reached(s, 'home') ? [t('hermitQuiet1'), t('hermitQuiet2')] : [t('hermitRingers1'), t('hermitRingers2')]), t('hermitShop')],
      then: 'shop-hermit',
    };
  }
  return {
    lines: [
      t('hermitHello1'),
      t('hermitHello2'),
      t('hermitHello3'),
    ],
  };
}

function elder(s: GameState): Talk {
  switch (s.quest) {
    case 'start':
      return {
        lines: [
          t('elderStart1'),
          t('elderStart2'),
        ],
        then: 'quest-blade',
      };
    case 'blade':
      return s.items.sword
        ? {
            lines: [
              t('elderBlade1'),
              t('elderBlade2'),
            ],
            then: 'quest-thorns',
          }
        : { lines: [t('elderShed')] };
    case 'thorns':
      return { lines: [t('elderThorns')] };
    case 'shrine':
      return { lines: [t('elderShrine')] };
    case 'return':
      return {
        lines: [
          t('elderReturn1'),
          t('elderReturn2'),
          t('elderReturn3'),
        ],
        then: 'finish',
      };
    case 'done':
      return {
        lines: [
          t('elderDone1'),
          t('elderDone2'),
          t('elderDone3'),
        ],
        then: 'quest-bell',
      };
    case 'bell':
      return { lines: [t('elderBell')] };
    case 'belfry':
      return { lines: [t('elderBelfry')] };
    case 'home':
      return {
        lines: [
          t('elderHome1'),
          t('elderHome2'),
          t('elderHome3'),
        ],
        then: 'finish-two',
      };
    case 'end':
      return { lines: [t('elderEnd'), t('elderTrials')] };
  }
}
