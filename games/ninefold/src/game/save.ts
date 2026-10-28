import { STYLES } from './catalog';
import { newProgress, unlock, type GameState, type Progress } from './state';

// Ninefold keeps two keys: the progress that unlocks the styles, with the style worn, and the
// board in play (with a Delve run's relics, or its relic offer between floors), so a reload goes
// on where it stood.
const KEY = 'ninefold-progress';
const BOARD_KEY = 'ninefold-board';

/** The parts of `GameState` a reload restores: everything but the progress and the events. */
const BOARD_FIELDS = [
  'phase', 'mode', 'level', 'puzzle', 'values', 'notes', 'selected', 'notesMode', 'mistakes', 'hintsLeft', 'hintsUsed',
  'timeMs', 'hearts', 'maxHearts', 'floor', 'plan', 'upcoming', 'dailyDate', 'relics', 'relicOffer', 'warded', 'streak',
  'keyHealed', 'undo', 'doneUnits',
] as const;

export function loadProgress(): Progress {
  const p = newProgress();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      for (const key of ['solved', 'flawless', 'noHint', 'hard', 'fast', 'bestFloor', 'bosses', 'daily', 'dailyStreak', 'bestStreak'] as const) {
        if (Number.isFinite(saved[key])) p[key] = saved[key];
      }
      if (Array.isArray(saved.unlocked)) p.unlocked = STYLES.filter((s) => s === 'paper' || saved.unlocked.includes(s));
      if (p.unlocked.includes(saved.style)) p.style = saved.style;
    }
  } catch {
    // A broken or blocked save starts fresh.
  }
  unlock(p);
  return p;
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage can be full or blocked (private mode); the game keeps running unsaved.
  }
}

/** Saves the board in play, or clears the save when there is none to come back to. */
export function saveBoard(s: GameState) {
  try {
    if (s.phase === 'playing' || s.phase === 'relic') {
      localStorage.setItem(BOARD_KEY, JSON.stringify(Object.fromEntries(BOARD_FIELDS.map((k) => [k, s[k]]))));
    } else localStorage.removeItem(BOARD_KEY);
  } catch {
    // Storage can be full or blocked; the board just isn't kept.
  }
}

/** Puts a saved board back into the state; false (and nothing changed) when there is none or it doesn't fit. */
export function loadBoard(s: GameState) {
  try {
    const saved = JSON.parse(localStorage.getItem(BOARD_KEY) ?? 'null');
    const p = saved?.puzzle;
    const n = p?.size * p?.size;
    const ok = (saved?.phase === 'playing' || saved?.phase === 'relic') && [4, 6, 9].includes(p?.size)
      && [p.solution, p.givens, saved.values, saved.notes].every((a) => Array.isArray(a) && a.length === n)
      && BOARD_FIELDS.every((k) => k in saved);
    if (!ok) return false;
    Object.assign(s, Object.fromEntries(BOARD_FIELDS.map((k) => [k, saved[k]])));
    s.events.push({ type: 'board' });
    return true;
  } catch {
    return false;
  }
}
