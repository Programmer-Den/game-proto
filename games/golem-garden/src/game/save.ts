// What outlives a garden: the most waves ever cleared, the Heartwood's bloom (kept from garden to
// garden), each garden's harvest stars and laurels, and the garden last picked (and whether in its
// thorny variant), each garden's best wild wave and the grafts bought. The garden's golems and pests
// are never saved. The daily plot keeps its own record under `golem-garden-daily` (`shared/daily.ts`).
import { GARDENS } from './board';
import { GRAFTS, type Graft } from './data';

const BEST = 'golem-garden-best';
const BLOOM = 'golem-garden-bloom';
const GARDEN = 'golem-garden-garden';
const STARS = 'golem-garden-stars';
const LAURELS = 'golem-garden-laurels';
const THORNY = 'golem-garden-thorny';
const WILD = 'golem-garden-wild';
const GRAFTED = 'golem-garden-grafts';

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
