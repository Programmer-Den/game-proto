// The best final score, the crowns won from decrees, the island of the day's best, the
// campaign's stars, the best island chain, the feats won and the tile skin picked are saved; the
// board is never saved.
const BEST_KEY = 'tiny-kingdom-best';
const CROWNS_KEY = 'tiny-kingdom-crowns';
const DAILY_KEY = 'tiny-kingdom-daily';
const STARS_KEY = 'tiny-kingdom-stars';
const CHAIN_KEY = 'tiny-kingdom-chain';
const FEATS_KEY = 'tiny-kingdom-feats';
const SKIN_KEY = 'tiny-kingdom-skin';

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage can be full or blocked (private mode); the game keeps running unsaved.
  }
}

const load = (key: string) => Number(read(key)) || 0;

export const loadBest = () => load(BEST_KEY);
export const saveBest = (best: number) => save(BEST_KEY, String(best));
export const loadCrowns = () => load(CROWNS_KEY);
export const saveCrowns = (crowns: number) => save(CROWNS_KEY, String(crowns));

/** The best final score on the island of the day `day`, 0 if it has not been finished yet. */
export function loadDailyBest(day: string) {
  try {
    const saved = JSON.parse(read(DAILY_KEY) ?? 'null');
    return saved?.day === day ? Number(saved.best) || 0 : 0;
  } catch {
    return 0;
  }
}
/** Keeps `best` as the island of the day's best for `day`, replacing any earlier day's. */
export const saveDailyBest = (day: string, best: number) => save(DAILY_KEY, JSON.stringify({ day, best }));

/** The best stars won on each campaign level, by level index. */
export function loadStars(): number[] {
  try {
    const saved = JSON.parse(read(STARS_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.map((n) => Math.max(0, Math.min(3, Number(n) || 0))) : [];
  } catch {
    return [];
  }
}
export const saveStars = (stars: number[]) => save(STARS_KEY, JSON.stringify(stars));

/** The best island chain finished: how many islands it had and their final scores in all. */
export interface BestChain {
  links: number;
  total: number;
}
export function loadChain(): BestChain {
  try {
    const saved = JSON.parse(read(CHAIN_KEY) ?? 'null');
    return { links: Number(saved?.links) || 0, total: Number(saved?.total) || 0 };
  } catch {
    return { links: 0, total: 0 };
  }
}
export const saveChain = (chain: BestChain) => save(CHAIN_KEY, JSON.stringify(chain));

/** The ids of the kingdom feats won (see `feats.ts`). */
export function loadFeats(): string[] {
  try {
    const saved = JSON.parse(read(FEATS_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}
export const saveFeats = (feats: string[]) => save(FEATS_KEY, JSON.stringify(feats));

/** The tile skin picked on the feats card, or '' for the painted classic set. */
export const loadSkin = () => read(SKIN_KEY) ?? '';
export const saveSkin = (skin: string) => save(SKIN_KEY, skin);
