import { MODES, RELICS } from './catalog';
import { KINDS, LEVELS } from './kinds';
import { newProgress, type Progress } from './progress';
import { makeCurrent, type Card, type Run } from './run';

// Augury keeps two keys: the records (per kind and per mode) and the last daily five, and the run
// in play (not Practice), saved whenever it moves on between puzzles.
const KEY = 'augury-progress';
const RUN_KEY = 'augury-run';

const count = (v: unknown) => (Number.isFinite(v) && (v as number) >= 0 ? Math.floor(v as number) : 0);

export function loadProgress(): Progress {
  const p = newProgress();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!saved || typeof saved !== 'object') return p;
    for (const k of KINDS) {
      const rec = saved.kinds?.[k];
      if (!rec) continue;
      p.kinds[k].solved = count(rec.solved);
      p.kinds[k].lost = count(rec.lost);
      if (Array.isArray(rec.best)) p.kinds[k].best = LEVELS.map((l) => count(rec.best[l]));
    }
    for (const key of ['endless', 'blitz', 'daily', 'draft'] as const) p.best[key] = count(saved.best?.[key]);
    if (saved.daily && Number.isFinite(saved.daily.day)) p.daily = { day: saved.daily.day, score: count(saved.daily.score) };
    p.runs = count(saved.runs);
  } catch {
    // A broken or blocked save starts fresh.
  }
  return p;
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage can be full or blocked (private mode); the game keeps running unsaved.
  }
}

/** Saves the run in play as it stands, without its records (they have their own key) or events. */
export function saveRun(run: Run) {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify({ ...run, progress: undefined, events: undefined }));
  } catch {
    // As above: the run goes on unsaved.
  }
}

export function clearRun() {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch {
    // Nothing to clear.
  }
}

const PHASES = ['playing', 'between', 'draft', 'relic', 'handover'];
const isCard = (c: any): c is Card => !!c && (KINDS as readonly string[]).includes(c.kind) && (LEVELS as readonly number[]).includes(c.level) && Number.isFinite(c.seed);

/**
 * The saved run, or null for none (or a broken one, which is dropped). A puzzle in play is dealt
 * again from its card, as it was when it started: the save is made between puzzles.
 */
export function loadRun(progress: Progress): Run | null {
  try {
    const run = JSON.parse(localStorage.getItem(RUN_KEY) ?? 'null');
    if (!run || typeof run !== 'object') return null;
    const ok =
      (MODES as readonly string[]).includes(run.mode) &&
      run.mode !== 'practice' &&
      PHASES.includes(run.phase) &&
      [run.hearts, run.hints, run.score, run.streak, run.dealt, run.solved, run.clockMs].every(Number.isFinite) &&
      Array.isArray(run.queue) && run.queue.every(isCard) &&
      Array.isArray(run.results) && run.results.every((r: any) => isCard(r?.card)) &&
      Array.isArray(run.draftOffer) && run.draftOffer.every(isCard) &&
      Array.isArray(run.relics) && [...run.relics, ...(run.relicOffer ?? [])].every((r: string) => (RELICS as readonly string[]).includes(r)) &&
      (run.phase !== 'playing' || isCard(run.current?.card));
    if (!ok) return clearRun(), null;
    run.current = isCard(run.current?.card) ? makeCurrent(run, run.current.card) : null;
    return { ...run, progress, events: [] };
  } catch {
    clearRun();
    return null;
  }
}
