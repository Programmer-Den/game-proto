import type { TextKey } from '../i18n';
import type { CurseKind } from './cards';

// The foes of the dungeon. Each one opens with its first move, then draws its next move at random
// from its list (never the same one twice in a row), shown above its head the turn before it acts,
// so the player can plan around it.

export type EnemyKind =
  | 'slime'
  | 'rat'
  | 'skeleton'
  | 'cultist'
  | 'graveKnight'
  | 'bogWitch'
  | 'boneKing'
  | 'ghoul'
  | 'wraith'
  | 'spider'
  | 'mummy'
  | 'gargoyle'
  | 'hollowQueen'
  | 'boneArcher'
  | 'shade'
  | 'marrowBat'
  | 'ossuary'
  | 'bellRinger'
  | 'marrowTyrant';

/** Weak: deals a quarter less attack damage. Vulnerable: takes half as much again. Poison: loses that much health each turn, then one less. */
export type StatusKind = 'weak' | 'vulnerable' | 'poison';

export type Intent =
  /** Hits the hero; `apply` also puts a status on the hero. */
  | { kind: 'attack'; damage: number; hits?: number; apply?: { status: StatusKind; amount: number } }
  | { kind: 'block'; block: number }
  /** Grows stronger: every attack after deals this much more per hit. */
  | { kind: 'buff'; strength: number }
  /** Puts a status on the hero. */
  | { kind: 'debuff'; status: StatusKind; amount: number }
  /** Adds a curse card to the hero's deck (and discard pile). Only elites do this. */
  | { kind: 'curse'; curse: CurseKind };

export interface EnemyType {
  /** Its name, a key of `i18n/en.ts`. */
  name: TextKey;
  hp: number;
  /** Gold the hero finds once it falls. */
  gold: number;
  /** The moves it draws its intents from; the first is always its opening move. */
  moves: Intent[];
}

export const ENEMIES: Record<EnemyKind, EnemyType> = {
  // The Crypt, act one.
  slime: {
    name: 'slimeFoe',
    hp: 24,
    gold: 12,
    moves: [{ kind: 'attack', damage: 6 }, { kind: 'block', block: 5 }, { kind: 'attack', damage: 8 }],
  },
  rat: {
    name: 'ratFoe',
    hp: 13,
    gold: 7,
    moves: [{ kind: 'attack', damage: 3, hits: 2 }, { kind: 'attack', damage: 4, apply: { status: 'poison', amount: 2 } }],
  },
  skeleton: {
    name: 'skeletonFoe',
    hp: 30,
    gold: 14,
    moves: [{ kind: 'block', block: 6 }, { kind: 'attack', damage: 9 }, { kind: 'attack', damage: 4, hits: 2 }],
  },
  cultist: {
    name: 'cultistFoe',
    hp: 26,
    gold: 14,
    moves: [{ kind: 'buff', strength: 2 }, { kind: 'attack', damage: 6 }, { kind: 'debuff', status: 'weak', amount: 2 }],
  },
  graveKnight: {
    name: 'graveKnightFoe',
    hp: 58,
    gold: 40,
    moves: [{ kind: 'block', block: 10 }, { kind: 'attack', damage: 13 }, { kind: 'attack', damage: 6, hits: 2, apply: { status: 'vulnerable', amount: 2 } }, { kind: 'curse', curse: 'wound' }],
  },
  bogWitch: {
    name: 'bogWitchFoe',
    hp: 46,
    gold: 40,
    moves: [{ kind: 'debuff', status: 'weak', amount: 2 }, { kind: 'attack', damage: 7, apply: { status: 'poison', amount: 3 } }, { kind: 'attack', damage: 11 }, { kind: 'buff', strength: 2 }, { kind: 'curse', curse: 'doubt' }],
  },
  boneKing: {
    name: 'boneKingFoe',
    hp: 90,
    gold: 60,
    moves: [
      { kind: 'attack', damage: 10 },
      { kind: 'block', block: 12 },
      { kind: 'attack', damage: 4, hits: 3 },
      { kind: 'buff', strength: 3 },
      { kind: 'debuff', status: 'vulnerable', amount: 2 },
    ],
  },
  // The Sunken Tombs, act two.
  ghoul: {
    name: 'ghoulFoe',
    hp: 34,
    gold: 16,
    moves: [{ kind: 'attack', damage: 8, apply: { status: 'weak', amount: 1 } }, { kind: 'attack', damage: 12 }, { kind: 'buff', strength: 2 }],
  },
  wraith: {
    name: 'wraithFoe',
    hp: 28,
    gold: 15,
    moves: [{ kind: 'debuff', status: 'vulnerable', amount: 2 }, { kind: 'attack', damage: 5, hits: 2 }, { kind: 'block', block: 8 }],
  },
  spider: {
    name: 'spiderFoe',
    hp: 22,
    gold: 11,
    moves: [{ kind: 'attack', damage: 3, apply: { status: 'poison', amount: 3 } }, { kind: 'attack', damage: 7 }, { kind: 'block', block: 6 }],
  },
  mummy: {
    name: 'mummyFoe',
    hp: 44,
    gold: 18,
    moves: [{ kind: 'block', block: 10 }, { kind: 'attack', damage: 13 }, { kind: 'debuff', status: 'weak', amount: 2 }],
  },
  gargoyle: {
    name: 'gargoyleFoe',
    hp: 82,
    gold: 50,
    moves: [{ kind: 'block', block: 16 }, { kind: 'attack', damage: 17 }, { kind: 'attack', damage: 5, hits: 3 }, { kind: 'curse', curse: 'rust' }],
  },
  hollowQueen: {
    name: 'hollowQueenFoe',
    hp: 130,
    gold: 100,
    moves: [
      { kind: 'debuff', status: 'poison', amount: 4 },
      { kind: 'attack', damage: 15 },
      { kind: 'attack', damage: 6, hits: 3, apply: { status: 'vulnerable', amount: 1 } },
      { kind: 'block', block: 15 },
      { kind: 'buff', strength: 3 },
    ],
  },
  // The Bone Spire, act three, reached only from depth 3.
  boneArcher: {
    name: 'boneArcherFoe',
    hp: 30,
    gold: 16,
    moves: [{ kind: 'attack', damage: 5, hits: 2 }, { kind: 'attack', damage: 9, apply: { status: 'vulnerable', amount: 1 } }, { kind: 'block', block: 8 }],
  },
  shade: {
    name: 'shadeFoe',
    hp: 26,
    gold: 15,
    moves: [{ kind: 'debuff', status: 'weak', amount: 2 }, { kind: 'attack', damage: 7, apply: { status: 'poison', amount: 3 } }, { kind: 'attack', damage: 4, hits: 3 }],
  },
  marrowBat: {
    name: 'marrowBatFoe',
    hp: 16,
    gold: 9,
    moves: [{ kind: 'attack', damage: 3, hits: 3 }, { kind: 'attack', damage: 5, apply: { status: 'weak', amount: 1 } }],
  },
  ossuary: {
    name: 'ossuaryFoe',
    hp: 52,
    gold: 20,
    moves: [{ kind: 'block', block: 12 }, { kind: 'attack', damage: 15 }, { kind: 'buff', strength: 3 }],
  },
  bellRinger: {
    name: 'bellRingerFoe',
    hp: 90,
    gold: 55,
    moves: [{ kind: 'debuff', status: 'vulnerable', amount: 2 }, { kind: 'attack', damage: 18 }, { kind: 'attack', damage: 6, hits: 3 }, { kind: 'curse', curse: 'doubt' }, { kind: 'block', block: 14 }],
  },
  marrowTyrant: {
    name: 'marrowTyrantFoe',
    hp: 170,
    gold: 120,
    moves: [
      { kind: 'buff', strength: 3 },
      { kind: 'attack', damage: 18 },
      { kind: 'attack', damage: 7, hits: 3, apply: { status: 'vulnerable', amount: 1 } },
      { kind: 'block', block: 20 },
      { kind: 'curse', curse: 'wound' },
      { kind: 'debuff', status: 'poison', amount: 5 },
    ],
  },
};
