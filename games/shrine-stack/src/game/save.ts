// What lasts between temples: the best height on each site (the hill's under its old key), the
// sites open and the one picked last, each patron's rank and the pilgrims' village. Every game starts
// on a bare plinth.
import { BUILDINGS, BUILDING_INFO, PATRONS, SITES, nextSite, type BuildingId, type PatronId, type SiteId } from './catalog';

const KEY = 'shrine-stack-best';
const SITES_KEY = 'shrine-stack-sites';
const RANKS_KEY = 'shrine-stack-patrons';
const VILLAGE_KEY = 'shrine-stack-village';

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

/** The pilgrims' village: how many pilgrims have settled, the favour they brought that is still to spend, and what is built. */
export interface Village {
  pilgrims: number;
  favour: number;
  built: BuildingId[];
}

const count = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

export function loadVillage(): Village {
  const raw = read(VILLAGE_KEY) as Partial<Village> | null;
  const built = BUILDINGS.filter((id) => Array.isArray(raw?.built) && raw.built.includes(id));
  return { pilgrims: count(raw?.pilgrims), favour: count(raw?.favour), built };
}

const saveVillage = (village: Village) => write(VILLAGE_KEY, JSON.stringify(village));

/** A crown brings `pilgrims` to the village, with `favour` as their offering. */
export function welcomePilgrims(pilgrims: number, favour: number) {
  const village = loadVillage();
  village.pilgrims += pilgrims;
  village.favour += Math.max(0, Math.floor(favour));
  saveVillage(village);
  return village;
}

/** Whether a building can go up: not built yet, and the village has the favour for it. */
export function canBuild(village: Village, id: BuildingId) {
  return !village.built.includes(id) && village.favour >= BUILDING_INFO[id].cost;
}

/** Spends the village's favour on a building. Returns the village after, or null when it can't be built. */
export function build(id: BuildingId): Village | null {
  const village = loadVillage();
  if (!canBuild(village, id)) return null;
  village.favour -= BUILDING_INFO[id].cost;
  village.built.push(id);
  saveVillage(village);
  return village;
}
