import type { Levels } from './depot';
import type { WeaponId } from './weapons';

/** What Burrow Brigade keeps on the device, under keys starting with the game's folder name. */
const STATS_KEY = 'burrow-brigade-stats';
const PREFS_KEY = 'burrow-brigade-prefs';
const CAMPAIGN_KEY = 'burrow-brigade-campaign';

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

export interface Campaign {
  /** The best stars won in each battle, by its place in `BATTLES` (0 for not won yet). */
  stars: number[];
  /** Acorns to spend at the Quartermaster. */
  acorns: number;
  /** The Quartermaster's upgrades bought, by id. */
  levels: Levels;
}

export const loadCampaign = (): Campaign => {
  const c = read<Campaign>(CAMPAIGN_KEY, { stars: [], acorns: 0, levels: {} });
  return {
    stars: Array.isArray(c.stars) ? c.stars.map((n) => Math.max(0, Math.min(3, Math.round(Number(n)) || 0))) : [],
    acorns: Math.max(0, Math.round(Number(c.acorns)) || 0),
    levels: c.levels && typeof c.levels === 'object' ? c.levels : {},
  };
};
export const saveCampaign = (c: Campaign) => write(CAMPAIGN_KEY, c);
