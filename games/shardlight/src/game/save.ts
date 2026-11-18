import { WINDOWS } from './levels';

/**
 * Shardlight's progress, saved under `shardlight-progress`: the stars of every window (0 until it
 * is restored), the lead to spend in the workshop, the upgrades bought and a few counts the
 * trophies read.
 */

export const PROGRESS_KEY = 'shardlight-progress';

export type UpgradeId = 'wide' | 'orb' | 'magnet' | 'charm';
export const UPGRADES: readonly { id: UpgradeId; costs: readonly number[] }[] = [
  { id: 'wide', costs: [40, 90, 160] },
  { id: 'orb', costs: [80, 200] },
  { id: 'magnet', costs: [60, 140] },
  { id: 'charm', costs: [50, 120] },
];

/**
 * The stained glass the bar can wear, bought with seals from window feats; `brass` is the plain bar.
 * Each costs seals, never spent: a glass needs that many seals earned to put on, so all are free once
 * every feat is done.
 */
export type GlassId = 'brass' | 'ruby' | 'sapphire' | 'emerald' | 'amber' | 'rose';
export const GLASSES: readonly { id: GlassId; seals: number }[] = [
  { id: 'brass', seals: 0 },
  { id: 'ruby', seals: 2 },
  { id: 'sapphire', seals: 5 },
  { id: 'emerald', seals: 9 },
  { id: 'amber', seals: 14 },
  { id: 'rose', seals: 20 },
];

export interface Progress {
  stars: number[];
  /** Best score of each window. */
  best: number[];
  lead: number;
  upgrades: Record<UpgradeId, number>;
  beads: number;
  /** 1 for each window whose feat is done (its seal earned). */
  feats: number[];
  /** The bar's glass. */
  glass: GlassId;
  /** Most clerestory windows restored in one run. */
  endlessBest: number;
}

/** Seals earned: one a feat. */
export const sealCount = (p: Progress) => p.feats.reduce((a, b) => a + b, 0);
/** Whether every window is restored, which opens the endless clerestory. */
export const allRestored = (p: Progress) => p.stars.every((s) => s > 0);

export function emptyProgress(): Progress {
  return {
    stars: Array(WINDOWS).fill(0),
    best: Array(WINDOWS).fill(0),
    lead: 0,
    upgrades: { wide: 0, orb: 0, magnet: 0, charm: 0 },
    beads: 0,
    feats: Array(WINDOWS).fill(0),
    glass: 'brass',
    endlessBest: 0,
  };
}

const count = (v: unknown, max = Infinity) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);

export function loadProgress(): Progress {
  const p = emptyProgress();
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}') as Partial<Progress> | null;
    if (!raw || typeof raw !== 'object') return p;
    if (Array.isArray(raw.stars)) p.stars = p.stars.map((_, i) => count(raw.stars![i], 3));
    if (Array.isArray(raw.best)) p.best = p.best.map((_, i) => count(raw.best![i]));
    p.lead = count(raw.lead);
    p.beads = count(raw.beads);
    if (Array.isArray(raw.feats)) p.feats = p.feats.map((_, i) => count(raw.feats![i], 1));
    const glass = GLASSES.find((g) => g.id === raw.glass);
    if (glass && glass.seals <= sealCount(p)) p.glass = glass.id;
    p.endlessBest = count(raw.endlessBest);
    for (const u of UPGRADES) p.upgrades[u.id] = count(raw.upgrades?.[u.id], u.costs.length);
  } catch {
    // Unreadable: start afresh.
  }
  return p;
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    // Storage can be blocked; the game still plays.
  }
}

/** Whether a window may be played: the first, and each one after a restored window. */
export const isOpen = (p: Progress, index: number) => index === 0 || p.stars[index - 1] > 0;
