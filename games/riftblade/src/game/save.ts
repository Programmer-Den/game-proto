/** Lasting progress, in local storage under a key prefixed with the game's name. */
import { HEROES, HERO_IDS, type HeroId } from './heroes';
import { LAST_STAGE, NODE_INFO, PLANETS } from './planets';
import { freshHero, freshState, type GameState, type Phase } from './state';
import { FUSION_BY_ID, branchCard, parseCard } from './upgrades';
import { MAX_HEAT } from './heat';
import { ARMOURY_IDS, nextPrice, type ArmouryId } from './armoury';
import { MUTATOR_IDS, WEEKLY_BONUS, weekSeed } from './weekly';
import { SKILL_ENTRIES } from './skills';
import { CODEX_ENTRIES, CODEX_PAGES, pageDone, type CodexPageId } from './codex';
import { beatsRush, type RushRecord } from './rush';

export const SAVE_KEY = 'riftblade-progress';
/** The run under way, so closing the game mid-run and opening it again carries on with it. */
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
  /** Credits banked for the Armoury, and the ranks bought there. Saves from before it have none. */
  bank: number;
  armoury: Partial<Record<ArmouryId, number>>;
  /** The latest week a weekly run was played: its number, the furthest jump (1 to 4) and whether it was won. */
  weekly: { week: number; best: number; won: boolean } | null;
  /** The most worlds cleared in the endless rift after a win (0 before any). */
  endless: number;
  /** The codex: every foe, boss and card seen (`codex.ts` ids), and the full pages already paid for. */
  codex: { seen: string[]; paid: CodexPageId[] };
  /** The skill overview: every path, pool skill, gear piece, specialisation and fusion a run has taken (`skills.ts` ids). */
  skills: string[];
  /** Mastery XP by hero (see `mastery.ts`), and the heroes set to their usual colours rather than their mastery ones. */
  mastery: Partial<Record<HeroId, number>>;
  plain: HeroId[];
  /** The best boss rush: the most bosses beaten in one and the fastest time for that many (null before any). */
  rush: RushRecord | null;
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
    const armoury: Partial<Record<ArmouryId, number>> = {};
    if (typeof saved.armoury === 'object' && saved.armoury) {
      for (const id of ARMOURY_IDS) {
        const n = saved.armoury[id];
        if (Number.isInteger(n) && n > 0) armoury[id] = n;
      }
    }
    return {
      bestMs: typeof saved.bestMs === 'number' ? saved.bestMs : 0,
      wins,
      heat,
      weekly:
        typeof saved.weekly === 'object' && saved.weekly && Number.isInteger(saved.weekly.week) && typeof saved.weekly.best === 'number'
          ? { week: saved.weekly.week, best: saved.weekly.best, won: saved.weekly.won === true }
          : null,
      bank: typeof saved.bank === 'number' && Number.isFinite(saved.bank) ? Math.max(0, Math.floor(saved.bank)) : 0,
      armoury,
      furthest: perHero(saved.furthest),
      endless: Number.isInteger(saved.endless) && saved.endless > 0 ? saved.endless : 0,
      codex: {
        seen: Array.isArray(saved.codex?.seen) ? saved.codex.seen.filter((id: unknown) => CODEX_ENTRIES.has(id as string)) : [],
        paid: Array.isArray(saved.codex?.paid) ? saved.codex.paid.filter((id: unknown) => CODEX_PAGES.some((pg) => pg.id === id)) : [],
      },
      skills: Array.isArray(saved.skills) ? saved.skills.filter((id: unknown) => SKILL_ENTRIES.has(id as string)) : [],
      unlocked: Array.isArray(saved.unlocked) ? saved.unlocked.filter((id: unknown) => HERO_IDS.includes(id as HeroId)) : [],
      charted: Array.isArray(saved.charted) ? saved.charted.filter((id: unknown) => typeof id === 'string') : [],
      mastery: Object.fromEntries(Object.entries(perHero(saved.mastery)).filter(([, n]) => n! > 0).map(([id, n]) => [id, Math.floor(n!)])),
      plain: Array.isArray(saved.plain) ? saved.plain.filter((id: unknown) => HERO_IDS.includes(id as HeroId)) : [],
      rush:
        typeof saved.rush === 'object' && saved.rush && Number.isInteger(saved.rush.bosses) && saved.rush.bosses > 0 && typeof saved.rush.ms === 'number' && Number.isFinite(saved.rush.ms)
          ? { bosses: saved.rush.bosses, ms: saved.rush.ms }
          : null,
    };
  } catch {
    return {
      bestMs: 0, wins: {}, heat: {}, bank: 0, armoury: {}, weekly: null, endless: 0, codex: { seen: [], paid: [] }, skills: [], furthest: {}, unlocked: [], charted: [],
      mastery: {}, plain: [], rush: null,
    };
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
 * `heat` its rift heat, `banked` the credits it adds to the Armoury's bank, `xp` the hero's
 * mastery XP) and returns the updated progress.
 */
export function recordRun(hero: HeroId, ms: number, won: boolean, stage: number, route: readonly string[] = [], heat = 0, banked = 0, xp = 0): Progress {
  const progress = loadProgress();
  progress.bank += banked;
  if (xp > 0) progress.mastery[hero] = (progress.mastery[hero] ?? 0) + xp;
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

/**
 * Records a weekly run's end (`stage` the jump reached, 1 to 4); its first win of the week banks
 * `WEEKLY_BONUS`. Returns the updated progress and the bonus banked.
 */
export function recordWeekly(week: number, stage: number, won: boolean): { progress: Progress; bonus: number } {
  const progress = loadProgress();
  const before = progress.weekly?.week === week ? progress.weekly : { week, best: 0, won: false };
  const bonus = won && !before.won ? WEEKLY_BONUS : 0;
  progress.weekly = { week, best: Math.max(before.best, stage), won: before.won || won };
  progress.bank += bonus;
  saveProgress(progress);
  return { progress, bonus };
}

/** Records the worlds an endless rift cleared (keeping the best) and banks `credits`; the updated progress. */
export function recordEndless(cleared: number, credits = 0): Progress {
  const progress = loadProgress();
  progress.endless = Math.max(progress.endless, cleared);
  progress.bank += credits;
  saveProgress(progress);
  return progress;
}

/** Records a finished boss rush (`bosses` beaten in `ms`), keeping the best; the updated progress and whether it is a new best. */
export function recordRush(bosses: number, ms: number): { progress: Progress; best: boolean } {
  const progress = loadProgress();
  const best = beatsRush(progress.rush, bosses, ms);
  if (best) {
    progress.rush = { bosses, ms };
    saveProgress(progress);
  }
  return { progress, best };
}

/** Switches a hero between its mastery colours and its usual ones; the updated progress. */
export function togglePlain(hero: HeroId): Progress {
  const progress = loadProgress();
  progress.plain = progress.plain.includes(hero) ? progress.plain.filter((id) => id !== hero) : [...progress.plain, hero];
  saveProgress(progress);
  return progress;
}

/** Banks credits for the Armoury (a daily's first win); the updated progress. */
export function bankCredits(credits: number): Progress {
  const progress = loadProgress();
  progress.bank += credits;
  saveProgress(progress);
  return progress;
}

/** Adds skills a run has taken to the overview; returns the updated progress. */
export function recordSkills(ids: readonly string[]): Progress {
  const progress = loadProgress();
  for (const id of ids) if (SKILL_ENTRIES.has(id) && !progress.skills.includes(id)) progress.skills.push(id);
  saveProgress(progress);
  return progress;
}

/**
 * Adds codex entries seen in a run; every page this fills for the first time pays its credits into
 * the bank. Returns the updated progress and the pages just paid for.
 */
export function recordCodex(ids: readonly string[]): { progress: Progress; paid: CodexPageId[] } {
  const progress = loadProgress();
  for (const id of ids) if (CODEX_ENTRIES.has(id) && !progress.codex.seen.includes(id)) progress.codex.seen.push(id);
  const seen = new Set(progress.codex.seen);
  const paid: CodexPageId[] = [];
  for (const page of CODEX_PAGES) {
    if (progress.codex.paid.includes(page.id) || !pageDone(page, seen)) continue;
    progress.codex.paid.push(page.id);
    progress.bank += page.pay;
    paid.push(page.id);
  }
  saveProgress(progress);
  return { progress, paid };
}

/** Buys the next rank of an Armoury piece with banked credits; the updated progress, or null if it can't. */
export function buyArmoury(id: ArmouryId): Progress | null {
  const progress = loadProgress();
  const rank = progress.armoury[id] ?? 0;
  const price = nextPrice(id, rank);
  if (price === null || progress.bank < price) return null;
  progress.bank -= price;
  progress.armoury[id] = rank + 1;
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

/** The phases a run can be saved in and picked up from (`cleared` and `travel` pass within a frame). */
const RESUMABLE: readonly Phase[] = ['run', 'levelup', 'chart', 'map', 'trader', 'event'];
export const isResumable = (s: GameState) => s.hero !== null && RESUMABLE.includes(s.phase);

/** JSON has no Infinity (`nextElite` and `objectiveAt` once none are left), so it is kept as text. */
const keepInfinity = (_key: string, v: unknown) => (typeof v === 'number' && !Number.isFinite(v) ? String(v) : v);
const readInfinity = (_key: string, v: unknown) => (v === 'Infinity' ? Infinity : v === '-Infinity' ? -Infinity : v);

/** Saves the run under way (the whole state: it is plain data). */
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
    const known = (id: unknown) => typeof id === 'string' && parseCard(id) !== null;
    if (!Number.isInteger(s.stage) || s.stage < 0 || s.stage > LAST_STAGE) return null;
    if (!Number.isInteger(s.heat) || s.heat < 0 || s.heat > MAX_HEAT) return null;
    if (!Number.isInteger(s.week) || !Array.isArray(s.mutators) || !s.mutators.every((m) => MUTATOR_IDS.includes(m))) return null;
    if (typeof s.daily !== 'string' || typeof s.endless !== 'boolean' || !Number.isInteger(s.loop) || s.loop < 0) return null;
    if (!Number.isInteger(s.endlessCleared) || s.endlessCleared < 0) return null;
    // A weekly run saved before runs kept their seed reseeds from its week.
    if (!Number.isInteger(s.seed) || s.seed < -1 || s.seed > 0xffffffff) return null;
    if (s.week >= 0 && s.seed < 0) s.seed = weekSeed(s.week);
    // A position that isn't one falls back to reseeding from the stage (as saves from before it do).
    if (!Number.isInteger(s.rng) || s.rng < 0 || s.rng > 0xffffffff) s.rng = -1;
    if (s.next !== -1 && !PLANETS[s.next]) return null;
    if (!Array.isArray(s.nodes) || !s.nodes.every((k) => k in NODE_INFO)) return null;
    if (!Array.isArray(s.offers) || !s.offers.every((id) => id === null || known(id))) return null;
    // Runs saved before specialisations and fusions have none.
    if (typeof s.branches !== 'object' || !s.branches || typeof s.fusions !== 'object' || !s.fusions) return null;
    if (!Object.entries(s.branches).every(([id, v]) => parseCard(branchCard(id, v?.b)) !== null && Number.isInteger(v.n))) return null;
    if (!Object.keys(s.fusions).every((id) => FUSION_BY_ID[id] && Number.isInteger(s.fusions[id]))) return null;
    if (s.choices !== null && (!Array.isArray(s.choices) || !s.choices.every(known))) return null;
    if (s.event !== null && (typeof s.event !== 'object' || !Array.isArray(s.event.options))) return null;
    if (typeof s.rush !== 'boolean' || !s.rushQueue.every((i) => Number.isInteger(i) && PLANETS[i])) return null;
    if (!Number.isInteger(s.rushTotal) || !Number.isInteger(s.rushBeaten) || !Number.isInteger(s.mastery) || typeof s.colour !== 'boolean') return null;
    if (s.tide !== null && (typeof s.tide !== 'object' || typeof s.tide.angle !== 'number')) return null;
    if (!s.pillars.every((pl) => typeof pl === 'object' && pl && typeof pl.x1 === 'number')) return null;
    return s;
  } catch {
    return null;
  }
}
