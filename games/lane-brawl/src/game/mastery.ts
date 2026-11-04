// Class mastery (#292): the player's wins with each class, kept in the browser. Each rank a class
// reaches (`masteryRank`) puts a third upgrade card in one more of its level-up offers.

import { MASTERY_WINS, UNLOCKS } from './data';

const KEY = 'lane-brawl-mastery';

/** Wins per class id, or an empty record when nothing is saved or storage is blocked. */
export function loadMastery(): Record<string, number> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (!raw || typeof raw !== 'object') return {};
    const out: Record<string, number> = {};
    for (const [id, n] of Object.entries(raw)) if (typeof n === 'number' && n > 0) out[id] = Math.floor(n);
    return out;
  } catch {
    return {};
  }
}

/** Counts a win with a class. Returns the class's wins after it. */
export function recordWin(champId: string): number {
  const m = loadMastery();
  m[champId] = (m[champId] ?? 0) + 1;
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    // Storage blocked: the win still shows on the end panel, it just isn't kept.
  }
  return m[champId];
}

/** A class's mastery rank for its wins: 0 to `MASTERY_WINS.length`. */
export const masteryRank = (wins: number) => MASTERY_WINS.filter((w) => wins >= w).length;

/** The mastery ranks summed over every class but `except`. */
export function ranksBesides(m: Record<string, number>, except: string): number {
  return Object.entries(m).reduce((sum, [id, wins]) => sum + (id === except ? 0 : masteryRank(wins)), 0);
}

/** Whether a class can be played (LB16): always, unless `UNLOCKS` asks for mastery ranks on the others. */
export function isUnlocked(id: string, m: Record<string, number>): boolean {
  const need = UNLOCKS[id];
  return !need || ranksBesides(m, id) >= need;
}
