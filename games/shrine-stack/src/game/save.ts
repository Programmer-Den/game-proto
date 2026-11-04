// What lasts between temples: the best height on each site (the hill's under its old key), the
// sites open and the one picked last, and each patron's rank. Every game starts on a bare plinth.
import { PATRONS, SITES, nextSite, type PatronId, type SiteId } from './catalog';

const KEY = 'shrine-stack-best';
const SITES_KEY = 'shrine-stack-sites';
const RANKS_KEY = 'shrine-stack-patrons';

function read(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be full or blocked (private mode); the game keeps running unsaved.
  }
}

export function loadBest() {
  try {
    return Number(localStorage.getItem(KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(best: number) {
  write(KEY, String(best));
}

/** The sites open (the hill always), the one to build on next and the best height on the cliff and the lake. */
export interface Sites {
  open: SiteId[];
  current: SiteId;
  best: Partial<Record<SiteId, number>>;
}

const isSite = (v: unknown): v is SiteId => SITES.includes(v as SiteId);

export function loadSites(): Sites {
  const raw = read(SITES_KEY) as Partial<Sites> | null;
  const open = SITES.filter((id) => id === 'hill' || (Array.isArray(raw?.open) && raw.open.includes(id)));
  const current = isSite(raw?.current) && open.includes(raw.current) ? raw.current : 'hill';
  const best: Sites['best'] = {};
  for (const id of SITES) {
    const n = Number((raw?.best as Record<string, unknown> | undefined)?.[id]);
    if (id !== 'hill' && Number.isFinite(n) && n > 0) best[id] = n;
  }
  return { open, current, best };
}

const saveSites = (sites: Sites) => write(SITES_KEY, JSON.stringify(sites));

/** The best height on a site. */
export const bestOn = (site: SiteId) => (site === 'hill' ? loadBest() : (loadSites().best[site] ?? 0));

/** Keeps a new best height on a site. */
export function saveBestOn(site: SiteId, best: number) {
  if (site === 'hill') return saveBest(best);
  const sites = loadSites();
  sites.best[site] = Math.max(best, sites.best[site] ?? 0);
  saveSites(sites);
}

/** Picks the site the next temple goes up on. */
export function pickSite(site: SiteId) {
  const sites = loadSites();
  if (!sites.open.includes(site)) return;
  sites.current = site;
  saveSites(sites);
}

/** After a crown on `site`: opens the next site and moves there. Returns it if it was not open yet. */
export function openNextSite(site: SiteId): SiteId | null {
  const next = nextSite(site);
  const sites = loadSites();
  if (!next || sites.open.includes(next)) return null;
  sites.open.push(next);
  sites.current = next;
  saveSites(sites);
  return next;
}

export function loadRanks(): Record<PatronId, number> {
  const raw = read(RANKS_KEY) as Record<string, unknown> | null;
  const ranks = {} as Record<PatronId, number>;
  for (const id of PATRONS) {
    const n = Number(raw?.[id]);
    ranks[id] = Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }
  return ranks;
}

/** A crown with `patron` raises their rank, up to `max`. Returns the new rank, or null when already at the top. */
export function raiseRank(patron: PatronId, max: number): number | null {
  const ranks = loadRanks();
  if (ranks[patron] >= max) return null;
  ranks[patron]++;
  write(RANKS_KEY, JSON.stringify(ranks));
  return ranks[patron];
}
