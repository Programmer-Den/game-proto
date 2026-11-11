import type { Theme } from './terrain';
import type { WeaponId } from './weapons';

/**
 * The campaign: eight battles against rival burrows, each on a set theme with its own team sizes,
 * a habit (a weapon the rival carries more of and reaches for first) and sometimes a twist (strong
 * or calm wind, early sudden death). Each battle gives up to three stars: the win, a win within
 * `par` turns, and a win losing no mole. A battle opens once the one before it is won. Names and
 * twists are in `i18n/` as `c_<id>` and `cd_<id>`.
 */

export type BattleId = 'rusk' | 'hazel' | 'frost' | 'wasps' | 'storm' | 'bramble' | 'tide' | 'dusk';

export interface Battle {
  id: BattleId;
  theme: Theme['id'];
  /** Moles on your side and on the rival's. */
  mine: number;
  foes: number;
  /** The AI's aim error is multiplied by this (above 1 is sloppier). */
  aim: number;
  /** Extra uses of these weapons for the rival at the start. */
  bonus: Partial<Record<WeaponId, number>>;
  /** The weapon the rival reaches for first when it can. */
  habit: WeaponId | null;
  wind: 'normal' | 'strong' | 'calm';
  /** The water starts rising from this turn. */
  suddenDeath: number;
  /** Win within this many turns (both teams' turns) for the second star. */
  par: number;
}

const b = (id: BattleId, theme: Theme['id'], mine: number, foes: number, aim: number, habit: WeaponId | null, bonus: Battle['bonus'], par: number, extra: Partial<Battle> = {}): Battle => ({
  id, theme, mine, foes, aim, habit, bonus, par, wind: 'normal', suddenDeath: 24, ...extra,
});

export const BATTLES: Battle[] = [
  b('rusk', 'meadow', 3, 2, 1.8, null, {}, 10),
  b('hazel', 'autumn', 3, 3, 1.3, 'cluster', { cluster: 3 }, 12),
  b('frost', 'frost', 3, 3, 1.2, 'skyrain', { skyrain: 3 }, 12, { wind: 'strong' }),
  b('wasps', 'meadow', 3, 4, 1.1, 'seeker', { seeker: 3, beehive: 2 }, 14),
  b('storm', 'canyon', 3, 3, 1, 'bolt', { bolt: 4 }, 12, { wind: 'strong' }),
  b('bramble', 'frost', 4, 4, 0.9, 'heavy', { heavy: 3, dynamite: 1 }, 14, { wind: 'calm' }),
  b('tide', 'meadow', 4, 5, 0.85, 'roller', { roller: 3, quake: 1 }, 14, { suddenDeath: 8 }),
  b('dusk', 'ember', 4, 5, 0.7, 'splitter', { splitter: 3, heavy: 2, bolt: 2 }, 16),
];

/** Stars for a won battle: the win, within par, and no mole lost. */
export function starsFor(battle: Battle, turns: number, lostMole: boolean) {
  return 1 + (turns <= battle.par ? 1 : 0) + (lostMole ? 0 : 1);
}

/** Whether battle `i` can be played: the first always, the rest once the one before is won. */
export const isOpen = (stars: number[], i: number) => i === 0 || (stars[i - 1] ?? 0) > 0;
