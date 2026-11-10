import type { WeaponId } from './weapons';

/** What Burrow Brigade keeps on the device, under keys starting with the game's folder name. */
const STATS_KEY = 'burrow-brigade-stats';
const PREFS_KEY = 'burrow-brigade-prefs';

export interface Stats {
  /** Matches started (not counting Watch AI). */
  games: number;
  /** Matches won against the Burrow AI. */
  wins: number;
  /** Every weapon the player has used at least once. */
  used: WeaponId[];
}

export interface Prefs {
  /** Moles per team, 2 to 5. */
  size: number;
}

function read<T>(key: string, fallback: T): T {
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(key) ?? '{}') };
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be blocked; progress then lasts until the page closes.
  }
}

export const loadStats = (): Stats => read<Stats>(STATS_KEY, { games: 0, wins: 0, used: [] });
export const saveStats = (s: Stats) => write(STATS_KEY, s);
export const loadPrefs = (): Prefs => {
  const p = read<Prefs>(PREFS_KEY, { size: 3 });
  return { size: Math.max(2, Math.min(5, Math.round(p.size) || 3)) };
};
export const savePrefs = (p: Prefs) => write(PREFS_KEY, p);
