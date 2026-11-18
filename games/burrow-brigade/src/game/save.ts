import type { Levels } from './depot';
import { isHat, type HatId } from './hats';
import { isTrade, type TradeId } from './modes';
import { cleanOptions, type Options } from './options';
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
  /** The hat your moles wear, or null. */
  hat: HatId | null;
  /** The Options panel's choices. */
  options: Options;
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

export const loadStats = (): Stats => {
  // An imported or hand-edited save may hold anything: keep only well-formed fields.
  const s = read<Partial<Stats>>(STATS_KEY, {});
  const count = (n: unknown) => (Number.isFinite(n) && (n as number) >= 0 ? Math.floor(n as number) : 0);
  return { games: count(s.games), wins: count(s.wins), used: Array.isArray(s.used) ? s.used.filter((id) => typeof id === 'string') : [] };
};
export const saveStats = (s: Stats) => write(STATS_KEY, s);
export const loadPrefs = (): Prefs => {
  const p = read<Partial<Prefs>>(PREFS_KEY, { size: 3 });
  return {
    size: Math.max(2, Math.min(5, Math.round(Number(p.size)) || 3)),
    hat: isHat(p.hat) ? p.hat : null,
    options: cleanOptions(p.options ?? {}),
  };
};
export const savePrefs = (p: Prefs) => write(PREFS_KEY, p);

export interface Campaign {
  /** The best stars won in each battle, by its place in `BATTLES` (0 for not won yet). */
  stars: number[];
  /** The same for the Veteran tier, opened by winning the last battle. */
  vstars: number[];
  /** Acorns to spend at the Quartermaster. */
  acorns: number;
  /** The Quartermaster's upgrades bought, by id. */
  levels: Levels;
  /** The trades last picked for your moles, by their place in the battle's line-up. */
  trades: TradeId[];
}

export const loadCampaign = (): Campaign => {
  const c = read<Campaign>(CAMPAIGN_KEY, { stars: [], vstars: [], acorns: 0, levels: {}, trades: [] });
  const stars = (a: unknown) => (Array.isArray(a) ? a.map((n) => Math.max(0, Math.min(3, Math.round(Number(n)) || 0))) : []);
  return {
    stars: stars(c.stars),
    vstars: stars(c.vstars),
    acorns: Math.max(0, Math.round(Number(c.acorns)) || 0),
    levels: c.levels && typeof c.levels === 'object' ? c.levels : {},
    trades: Array.isArray(c.trades) ? c.trades.filter(isTrade) : [],
  };
};
export const saveCampaign = (c: Campaign) => write(CAMPAIGN_KEY, c);
