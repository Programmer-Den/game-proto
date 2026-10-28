import { award } from '../../../../shared/trophies';
import { ARMOURY } from '../game/armoury';
import { HERO_IDS } from '../game/heroes';
import { unlockedHeroes, type Progress } from '../game/save';
import type { GameState } from '../game/state';
import { trophies } from './index';

const best = (n: Partial<Record<string, number>>) => Math.max(0, ...Object.values(n).map((v) => v ?? 0));

/** Whether each trophy's condition holds in the run under way or the saved progress. */
const EARNED: Record<string, (s: GameState, p: Progress) => boolean> = {
  firstBoss: (s, p) => (s.hero !== null && (s.stage > 0 || s.phase === 'cleared' || s.phase === 'won')) || best(p.furthest) >= 2,
  capstone: (s) => s.capstones.length > 0,
  newHero: (_s, p) => unlockedHeroes(p).length >= 2,
  firstPiece: (_s, p) => Object.values(p.armoury).some((n) => (n ?? 0) > 0),
  crusade: (_s, p) => best(p.wins) > 0,
  weekly: (_s, p) => p.weekly?.won === true,
  heat3: (_s, p) => best(p.heat) >= 3,
  heat5: (_s, p) => best(p.heat) >= 5,
  armouryFull: (_s, p) => ARMOURY.every((a) => (p.armoury[a.id] ?? 0) >= a.prices.length),
  allHeroes: (_s, p) => unlockedHeroes(p).length === HERO_IDS.length,
};

/** False until the first check of the page, which finds what an older save already earned. */
let checked = false;

/**
 * Awards every trophy whose condition holds. `GameScene` calls it every frame; the first call after
 * the page loads is quiet, so a save from before trophies earns its own without a toast.
 */
export function checkTrophies(s: GameState, progress: Progress) {
  for (const trophy of trophies.list) if (EARNED[trophy.id]?.(s, progress)) award(trophies, trophy.id, { quiet: !checked });
  checked = true;
}
