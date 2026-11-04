import { CITIES, GRADES, type Ask, type Grade } from './book';
import { BREED_MAX, TRAITS } from './breeds';
import { CONTRACT_MS } from './contracts';
import { ESTATE_HIVES } from './estate';
import { KINDS, type Kind } from './honey';
import { CASK_MS, MAX_CASKS, type Cask } from './mead';
import { MEADOWS } from './meadows';
import { WINTER_EAT_MS, YEAR_MS } from './seasons';
import { freshProgress, type Progress } from './state';
import { FAIR_CLASSES } from './fair';
import { QUEEN_IDS, type Queen } from './swarm';
import { UPGRADES, UPGRADE_IDS } from './upgrades';

// The comb, the coins, the jars, the wax, the bees, the upgrades, the meadows unlocked, where the
// bees forage, the season and years, the time to the bees' next winter meal, the casks, the hives and the queen, the fair entries and fairs held,
// the tired meadows, the traits bred in, the comb honey cut, this season's buyer's book, the bees lent to the orchard and when the hive was last seen are saved; bees out foraging come home on load, and
// wasps, the market, village orders, contract offers and a swarm start afresh.
const KEY = 'beehive-baron-progress';

export function loadProgress(): Progress {
  const fresh = freshProgress();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const saved = JSON.parse(raw) as Partial<Progress>;
    const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback);
    return {
      coins: num(saved.coins, fresh.coins),
      cells: Array.isArray(saved.cells) ? saved.cells : fresh.cells,
      bees: num(saved.bees, fresh.bees),
      // Saves from before honey kinds hold one number of jars, all clover.
      jars:
        typeof saved.jars === 'number'
          ? { ...fresh.jars, clover: num(saved.jars, 0) }
          : (Object.fromEntries(KINDS.map((k) => [k, num((saved.jars as Partial<Record<Kind, unknown>> | undefined)?.[k], 0)])) as Progress['jars']),
      wax: num(saved.wax, fresh.wax),
      sold: num(saved.sold, fresh.sold),
      ranks: Object.fromEntries(
        UPGRADE_IDS.map((id) => [id, Math.min(UPGRADES[id].prices.length, num(saved.ranks?.[id], 0))]),
      ) as Progress['ranks'],
      meadows: Math.min(MEADOWS.length, num(saved.meadows, fresh.meadows)),
      forage: KINDS.includes(saved.forage as Kind) ? (saved.forage as Kind) : fresh.forage,
      seasonMs: Math.min(YEAR_MS - 1, num(saved.seasonMs, fresh.seasonMs)),
      eatIn: Math.max(1, Math.min(WINTER_EAT_MS, num(saved.eatIn, fresh.eatIn))),
      years: num(saved.years, fresh.years),
      casks: (Array.isArray(saved.casks) ? saved.casks : []).flatMap((c: Partial<Cask>) =>
        KINDS.includes(c?.kind as Kind) ? [{ kind: c.kind as Kind, agingMs: Math.min(CASK_MS, num(c.agingMs, 0)), value: num(c.value, 0) }] : [],
      ).slice(0, MAX_CASKS),
      hives: Math.max(1, Math.min(ESTATE_HIVES, num(saved.hives, fresh.hives))),
      queen: QUEEN_IDS.includes(saved.queen as Queen) ? (saved.queen as Queen) : null,
      queenBees: num(saved.queenBees, fresh.queenBees),
      // Saves from before the estate count only the second hive's bees, in `queenBees`.
      hiveBees: Array.isArray(saved.hiveBees) ? saved.hiveBees.slice(0, ESTATE_HIVES).map((n) => num(n, 0)) : [],
      fair: Object.fromEntries(FAIR_CLASSES.map((k) => [k, typeof saved.fair?.[k] === 'number' ? num(saved.fair[k], 0) : null])) as Progress['fair'],
      // Saves from before the yearly fair count a Baron's fair as held and won.
      fairs: num(saved.fairs, saved.baron === true ? 1 : 0),
      golds: num(saved.golds, saved.baron === true ? 1 : 0),
      baron: saved.baron === true,
      tired: Object.fromEntries(KINDS.map((k) => [k, num(saved.tired?.[k], 0)])) as Progress['tired'],
      wilted: Object.fromEntries(KINDS.map((k) => [k, saved.wilted?.[k] === true])) as Progress['wilted'],
      breeds: Object.fromEntries(TRAITS.map((k) => [k, Math.min(BREED_MAX, num(saved.breeds?.[k], 0))])) as Progress['breeds'],
      breedPending: Math.min(TRAITS.length * BREED_MAX, num(saved.breedPending, 0)),
      combs: Object.fromEntries(KINDS.map((k) => [k, num(saved.combs?.[k], 0)])) as Progress['combs'],
      book: (Array.isArray(saved.book) ? saved.book : []).flatMap((a: Partial<Ask>) =>
        GRADES.includes(a?.grade as Grade) && KINDS.includes(a?.kind as Kind) && num(a.count, 0) > 0
          ? [{ city: Math.min(CITIES.length - 1, num(a.city, 0)), grade: a.grade as Grade, kind: a.kind as Kind, count: num(a.count, 1), price: num(a.price, 0), done: a.done === true }]
          : [],
      ).slice(0, GRADES.length),
      lent:
        saved.lent && typeof saved.lent === 'object' && num(saved.lent.bees, 0) > 0
          ? { bees: num(saved.lent.bees, 0), leftMs: Math.min(CONTRACT_MS, num(saved.lent.leftMs, CONTRACT_MS)) }
          : null,
      seen: num(saved.seen, fresh.seen),
    };
  } catch {
    return fresh;
  }
}

export function saveProgress(progress: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage can be full or blocked (private mode); the game keeps running unsaved.
  }
}

export function clearProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
