/** Lasting progress, in local storage under a key prefixed with the game's name. */
import { HEROES, HERO_IDS, type HeroId } from './heroes';
import { LAST_STAGE, NODE_INFO, PLANETS } from './planets';
import { freshHero, freshState, type GameState, type Phase } from './state';
import { UPGRADES } from './upgrades';
import { MAX_HEAT } from './heat';

export const SAVE_KEY = 'riftblade-progress';
/**
 * The run under way as it stood after the last world cleared, so closing the game and opening it
 * again carries on from there.
 */
export const RUN_KEY = 'riftblade-run';

export interface Progress {
  /** The longest run survived, ms over every planet (a win counts its full time). */
  bestMs: number;
  /** Runs won (the Hollow Champion beaten on the Lava world), by hero. */
  wins: Partial<Record<HeroId, number>>;
  /** The furthest jump reached (1 to 4), by hero. Saves from before the star map have none. */
  furthest: Partial<Record<HeroId, number>>;
  /** The planets (`PlanetId`s) ever landed on: the space map names a faction only once charted. */
  charted: string[];
  /** Heroes whose deed is done. Saves from before the knights have none. */
  unlocked: HeroId[];
  /**
   * The highest rift heat won at (0 to `MAX_HEAT`), by hero: the next one up is open. Saves from
   * before rift heat count a hero's wins as heat 0.
   */
  heat: Partial<Record<HeroId, number>>;
}

/** A saved count per hero, keeping only known heroes with a finite number. */
const perHero = (v: unknown): Partial<Record<HeroId, number>> => {
  const out: Partial<Record<HeroId, number>> = {};
  if (typeof v !== 'object' || !v) return out;
  for (const [id, n] of Object.entries(v)) {
    if (HERO_IDS.includes(id as HeroId) && typeof n === 'number' && Number.isFinite(n)) out[id as HeroId] = n;
  }
  return out;
};

export function loadProgress(): Progress {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}') ?? {};
    const wins = perHero(saved.wins);
    const heat = perHero(saved.heat);
    for (const id of HERO_IDS) {
      if (heat[id] !== undefined) heat[id] = Math.max(0, Math.min(MAX_HEAT, Math.floor(heat[id]!)));
      else if ((wins[id] ?? 0) > 0) heat[id] = 0;
    }
    return {
      bestMs: typeof saved.bestMs === 'number' ? saved.bestMs : 0,
      wins,
      heat,
      furthest: perHero(saved.furthest),
      unlocked: Array.isArray(saved.unlocked) ? saved.unlocked.filter((id: unknown) => HERO_IDS.includes(id as HeroId)) : [],
      charted: Array.isArray(saved.charted) ? saved.charted.filter((id: unknown) => typeof id === 'string') : [],
    };
  } catch {
    return { bestMs: 0, wins: {}, heat: {}, furthest: {}, unlocked: [], charted: [] };
  }
}

export function saveProgress(progress: Progress) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be blocked (private mode); progress then lasts until the page closes.
  }
}

/**
 * Records a finished run (`stage` is the jump reached, 1 to 4, `route` the planets landed on,
 * `heat` its rift heat) and returns the updated progress.
 */
export function recordRun(hero: HeroId, ms: number, won: boolean, stage: number, route: readonly string[] = [], heat = 0): Progress {
  const progress = loadProgress();
  progress.bestMs = Math.max(progress.bestMs, ms);
  if (won) {
    progress.wins[hero] = (progress.wins[hero] ?? 0) + 1;
    progress.heat[hero] = Math.max(progress.heat[hero] ?? 0, heat);
  }
  progress.furthest[hero] = Math.max(progress.furthest[hero] ?? 0, stage);
  for (const id of route) if (!progress.charted.includes(id)) progress.charted.push(id);
  saveProgress(progress);
  return progress;
}

/** Records a planet landed on, so the space map shows its faction from now on. */
export function recordCharted(id: string): Progress {
  const progress = loadProgress();
  if (!progress.charted.includes(id)) {
    progress.charted.push(id);
    saveProgress(progress);
  }
  return progress;
}

/** Records heroes unlocked by deeds done in a run and returns the updated progress. */
export function recordUnlocks(ids: readonly HeroId[]): Progress {
  const progress = loadProgress();
  for (const id of ids) if (!progress.unlocked.includes(id)) progress.unlocked.push(id);
  saveProgress(progress);
  return progress;
}

/**
 * Whether a hero can be picked: Legionary TR-9 always, every other hero once its deed is done. A
 * hero an older save shows as played (a world reached) stays open, and so do the deeds of reaching
 * a world, counted from the furthest world saved before the knights came.
 */
export function isUnlocked(progress: Progress, id: HeroId) {
  if (!HEROES[id].locked || progress.unlocked.includes(id) || (progress.furthest[id] ?? 0) > 0) return true;
  const furthest = Math.max(0, ...Object.values(progress.furthest).map((n) => n ?? 0));
  const reach: Partial<Record<HeroId, number>> = { kael: 2, veyl: 3, joren: 4 };
  return reach[id] !== undefined && furthest >= reach[id]!;
}

/** The heroes open to pick. */
export const unlockedHeroes = (progress: Progress) => HERO_IDS.filter((id) => isUnlocked(progress, id));

/**
 * The phases a saved run can be picked up from (`cleared` and `travel` pass within a frame). Saves
 * from before runs were saved only between worlds can still be in the middle of one.
 */
const RESUMABLE: readonly Phase[] = ['run', 'levelup', 'chart', 'map', 'trader', 'event'];
export const isResumable = (s: GameState) => s.hero !== null && RESUMABLE.includes(s.phase);

/**
 * Whether the run is between worlds, the only time it is saved: the cards after a clear, the space
 * and star maps, the trader and events. The field is empty then, so the save stays small; closing
 * the game in a fight (an elite arena too) picks up again before it.
 */
const BETWEEN: readonly Phase[] = ['chart', 'map', 'trader', 'event'];
export const isBetweenWorlds = (s: GameState) =>
  s.hero !== null && (BETWEEN.includes(s.phase) || (s.phase === 'levelup' && s.after !== 'run'));

/** JSON has no Infinity (`nextElite` and `objectiveAt` once none are left), so it is kept as text. */
const keepInfinity = (_key: string, v: unknown) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v);
const readInfinity = (_key: string, v: unknown) => (v === 'Infinity' ? Infinity : v === '-Infinity' ? -Infinity : v);

/** Saves the run between worlds (the whole state: it is plain data). */
export function saveRun(s: GameState) {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(s, keepInfinity));
  } catch {
    // Blocked or full storage: the run then lasts until the page closes.
  }
}

export function clearRun() {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch {
    // Blocked storage holds no run to clear.
  }
}

/**
 * The saved run, or null for none (or one that no longer fits the game). Fields added to the state
 * since it was saved take their fresh values.
 */
export function loadRun(): GameState | null {
  try {
    const saved = JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null', readInfinity);
    if (typeof saved !== 'object' || !saved || typeof saved.player !== 'object' || !saved.player) return null;
    const fresh = freshState();
    const s: GameState = { ...fresh, ...saved, player: { ...freshHero(), ...saved.player } };
    // A run saved mid-fight is stepped from its first frame: every list the sim walks must be one.
    const lists = (a: object, b: object) =>
      Object.entries(a).every(([k, v]) => !Array.isArray(v) || Array.isArray((b as Record<string, unknown>)[k]));
    if (!lists(fresh, s) || !lists(fresh.player, s.player)) return null;
    if (!HERO_IDS.includes(s.hero as HeroId) || !isResumable(s) || !PLANETS[s.planet]) return null;
    // The panels read these as they open, so a run they would throw on is dropped here.
    const known = (id: unknown) => typeof id === 'string' && id in UPGRADES;
    if (!Number.isInteger(s.stage) || s.stage < 0 || s.stage > LAST_STAGE) return null;
    if (!Number.isInteger(s.heat) || s.heat < 0 || s.heat > MAX_HEAT) return null;
    if (s.next !== -1 && !PLANETS[s.next]) return null;
    if (!Array.isArray(s.nodes) || !s.nodes.every((k) => k in NODE_INFO)) return null;
    if (!Array.isArray(s.offers) || !s.offers.every((id) => id === null || known(id))) return null;
    if (s.choices !== null && (!Array.isArray(s.choices) || !s.choices.every(known))) return null;
    if (s.event !== null && (typeof s.event !== 'object' || !Array.isArray(s.event.options))) return null;
    return s;
  } catch {
    return null;
  }
}
