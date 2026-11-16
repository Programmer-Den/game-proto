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

export interface Progress {
  stars: number[];
  /** Best score of each window. */
  best: number[];
  lead: number;
  upgrades: Record<UpgradeId, number>;
  beads: number;
}

export function emptyProgress(): Progress {
  return {
    stars: Array(WINDOWS).fill(0),
    best: Array(WINDOWS).fill(0),
    lead: 0,
    upgrades: { wide: 0, orb: 0, magnet: 0, charm: 0 },
    beads: 0,
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
