// What Colonizer keeps between matches, in the browser's storage: the campaign's stars per scenario
// (`colonizer-campaign`) and the wins with each faction for faction mastery (`colonizer-mastery`).
// Both are kept under the game's prefix, so the hub's progress file and reset carry them.
import { FACTION_IDS, MASTERY_WINS, type FactionId } from './game/data';
import { SCENARIOS } from './game/campaign';

const CAMPAIGN_KEY = 'colonizer-campaign';
const MASTERY_KEY = 'colonizer-mastery';

function read<T extends object>(key: string): Partial<T> {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

function write(key: string, value: object) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be full or blocked; the match itself is unaffected.
  }
}

/** The best stars won in each scenario, by its id (0 if never won). */
export function loadStars(): Record<string, number> {
  const saved = read<Record<string, number>>(CAMPAIGN_KEY);
  return Object.fromEntries(SCENARIOS.map((sc) => [sc.id, Math.max(0, Math.min(3, Number(saved[sc.id]) || 0))]));
}

/** Keeps a scenario's stars if they beat the best so far; returns the best. */
export function saveStars(id: string, stars: number) {
  const all = loadStars();
  all[id] = Math.max(all[id] ?? 0, stars);
  write(CAMPAIGN_KEY, all);
  return all[id];
}

/** Whether a scenario is open: the first always, each other once the one before it has been won. */
export function scenarioOpen(index: number, stars = loadStars()) {
  return index === 0 || (stars[SCENARIOS[index - 1].id] ?? 0) > 0;
}

/** Wins with each faction (any match won as it, skirmish or scenario). */
export function loadMastery(): Record<FactionId, number> {
  const saved = read<Record<FactionId, number>>(MASTERY_KEY);
  return Object.fromEntries(FACTION_IDS.map((f) => [f, Math.max(0, Number(saved[f]) || 0)])) as Record<FactionId, number>;
}

/** Counts a win with a faction; returns its wins now. */
export function addWin(faction: FactionId) {
  const all = loadMastery();
  all[faction] += 1;
  write(MASTERY_KEY, all);
  return all[faction];
}

/** Whether a faction's second unique unit is unlocked. */
export const mastered = (faction: FactionId, wins = loadMastery()) => wins[faction] >= MASTERY_WINS;
