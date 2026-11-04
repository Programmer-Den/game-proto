import { EXAMS } from './exams';
import { KINDS, type Kind } from './kinds';
import { freshProgress, PANTRY_MAX, type Progress } from './state';
import { UPGRADE_ORDER, UPGRADES } from './upgrades';

// Only the progress between orders is saved: which order is next, the coins, potions sold, stars,
// the pantry, the workbench upgrades, whether the tinker is Royal Apothecary, the guild seals and
// whether the next order was picked rich, the stars of every town on the journey map and the best
// endless streak and the stars of every town's guest. The daily order keeps its own record under
// `tincture-tinker-daily` (shared/daily.ts), the weekly order under `tincture-tinker-weekly` (weekly.ts).
const KEY = 'tincture-tinker-progress';

export function loadProgress(): Progress {
  const fresh = freshProgress();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const saved: Progress = { ...fresh, ...(JSON.parse(raw) as Partial<Progress>) };
    // A save edited by hand or from a broken build falls back to the defaults field by field.
    const ok = (n: unknown, min: number) => typeof n === 'number' && Number.isFinite(n) && n >= min;
    if (!ok(saved.order, 1) || !Number.isInteger(saved.order)) saved.order = fresh.order;
    if (!ok(saved.coins, 0)) saved.coins = fresh.coins;
    if (!ok(saved.sold, 0)) saved.sold = fresh.sold;
    if (!ok(saved.stars, 0) || !Number.isInteger(saved.stars)) saved.stars = fresh.stars;
    const pantry = typeof saved.pantry === 'object' && saved.pantry ? saved.pantry : {};
    saved.pantry = {};
    for (const kind of KINDS) {
      const n = (pantry as Partial<Record<Kind, unknown>>)[kind];
      if (ok(n, 1) && Number.isInteger(n)) saved.pantry[kind] = Math.min(n as number, PANTRY_MAX);
    }
    const upgrades = typeof saved.upgrades === 'object' && saved.upgrades ? saved.upgrades : {};
    saved.upgrades = fresh.upgrades;
    for (const id of UPGRADE_ORDER) {
      const level = (upgrades as Partial<Record<string, unknown>>)[id];
      if (ok(level, 0) && Number.isInteger(level)) saved.upgrades[id] = Math.min(level as number, UPGRADES[id].costs.length);
    }
    saved.royal = saved.royal === true;
    if (!ok(saved.seals, 0) || !Number.isInteger(saved.seals)) saved.seals = fresh.seals;
    saved.seals = Math.min(saved.seals, EXAMS.length);
    // The first order is never rich.
    saved.rich = saved.rich === true && saved.order > 1;
    // A town's best stars, 0 to 3; a save from before the journey map starts it fresh.
    const towns: unknown[] = Array.isArray(saved.towns) ? saved.towns : [];
    saved.towns = fresh.towns.map((_, i) => (ok(towns[i], 0) && Number.isInteger(towns[i]) ? Math.min(towns[i] as number, 3) : 0));
    // A town guest's best stars, the same way.
    const guests: unknown[] = Array.isArray(saved.guests) ? saved.guests : [];
    saved.guests = fresh.guests.map((_, i) => (ok(guests[i], 0) && Number.isInteger(guests[i]) ? Math.min(guests[i] as number, 3) : 0));
    if (!ok(saved.endless, 0) || !Number.isInteger(saved.endless)) saved.endless = fresh.endless;
    return saved;
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
