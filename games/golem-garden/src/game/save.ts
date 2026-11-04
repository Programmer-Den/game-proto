// What outlives a garden: the most waves ever cleared, the Heartwood's bloom (kept from garden to
// garden), each garden's harvest stars and laurels, and the garden last picked (and whether in its
// thorny variant), each garden's best wild wave and the grafts bought. The garden's golems and pests
// are never saved. The daily plot keeps its own record under `golem-garden-daily` (`shared/daily.ts`);
// the weekly garden its week's best wave, and each drawn plot its drawing and best wave.
import { GARDENS, GRID, type Drawing } from './board';
import { GRAFTS, PLOT, type Graft } from './data';

const BEST = 'golem-garden-best';
const BLOOM = 'golem-garden-bloom';
const GARDEN = 'golem-garden-garden';
const STARS = 'golem-garden-stars';
const LAURELS = 'golem-garden-laurels';
const THORNY = 'golem-garden-thorny';
const WILD = 'golem-garden-wild';
const GRAFTED = 'golem-garden-grafts';
const WEEKLY = 'golem-garden-weekly';
const PLOTS = 'golem-garden-plots';

function load(key: string) {
  try {
    return Number(localStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function save(key: string, value: string | number) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage can be full or blocked (private mode); the game keeps running unsaved.
  }
}

export const loadBest = () => load(BEST);
export const saveBest = (best: number) => save(BEST, best);
export const loadBloom = () => load(BLOOM);
export const saveBloom = (bloom: number) => save(BLOOM, bloom);
export const loadGarden = () => load(GARDEN);
export const saveGarden = (garden: number) => save(GARDEN, garden);
export const loadThorny = () => load(THORNY) === 1;
export const saveThorny = (thorny: boolean) => save(THORNY, thorny ? 1 : 0);

/** One number per garden, `0` to `max`, in GARDENS order, stored comma-separated. */
function loadList(key: string, max: number): number[] {
  let raw = '';
  try {
    raw = localStorage.getItem(key) ?? '';
  } catch {
    // Unsaved: every garden starts at 0.
  }
  const parts = raw.split(',').map((n) => Math.max(0, Math.min(max, Number(n) || 0)));
  return GARDENS.map((_, i) => parts[i] ?? 0);
}

/** Each garden's harvest stars (0 to 3). */
export const loadStars = () => loadList(STARS, 3);
export const saveStars = (stars: number[]) => save(STARS, stars.join(','));
/** Each garden's laurel (0 or 1), won by harvesting its thorny variant. */
export const loadLaurels = () => loadList(LAURELS, 1);
export const saveLaurels = (laurels: number[]) => save(LAURELS, laurels.join(','));
/** Each garden's best wave cleared in the wild garden, past the harvest (0 until then). */
export const loadWild = () => loadList(WILD, 99999);
export const saveWild = (wild: number[]) => save(WILD, wild.join(','));

/** The golem grafts bought with laurels, comma-separated ids. */
export function loadGrafts(): Graft[] {
  let raw = '';
  try {
    raw = localStorage.getItem(GRAFTED) ?? '';
  } catch {
    // Unsaved: no grafts.
  }
  return GRAFTS.filter((graft) => raw.split(',').includes(graft));
}
export const saveGrafts = (grafts: Graft[]) => save(GRAFTED, grafts.join(','));

/** The best wave cleared in week `week`'s weekly garden, or 0 (a best from another week doesn't count). */
export function loadWeekly(week: number) {
  let raw = '';
  try {
    raw = localStorage.getItem(WEEKLY) ?? '';
  } catch {
    // Unsaved: nothing cleared this week.
  }
  const [w, best] = raw.split(':').map(Number);
  return w === week ? Math.max(0, best || 0) : 0;
}
/** Keeps week `week`'s best wave, as `<week>:<best>`. */
export const saveWeekly = (week: number, best: number) => save(WEEKLY, `${week}:${best}`);

/** A drawn plot as saved: its drawing and the best wave cleared on it. */
export interface SavedPlot extends Drawing {
  best: number;
}

/** A list of cells on the board, from saved JSON. */
const cells = (raw: unknown): [number, number][] =>
  (Array.isArray(raw) ? raw : [])
    .filter((c): c is [number, number] => Array.isArray(c) && Number.isInteger(c[0]) && Number.isInteger(c[1]))
    .filter(([c, r]) => c >= 0 && r >= 0 && c < GRID.cols && r < GRID.rows)
    .map(([c, r]) => [c, r]);

/** The PLOT.slots drawn plots, null for an empty slot. */
export function loadPlots(): (SavedPlot | null)[] {
  let raw: unknown = [];
  try {
    raw = JSON.parse(localStorage.getItem(PLOTS) ?? '[]');
  } catch {
    // Unsaved or unreadable: every slot empty.
  }
  const list = Array.isArray(raw) ? raw : [];
  return Array.from({ length: PLOT.slots }, (_, i) => {
    const p = list[i];
    if (!p || typeof p !== 'object') return null;
    return { path: cells(p.path), soil: cells(p.soil), best: Math.max(0, Number(p.best) || 0) };
  });
}
export const savePlots = (plots: (SavedPlot | null)[]) => save(PLOTS, JSON.stringify(plots));
