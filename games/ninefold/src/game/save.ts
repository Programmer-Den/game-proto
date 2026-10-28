import { STYLES } from './catalog';
import { newProgress, unlock, type Progress } from './state';

// Ninefold keeps one key: the progress that unlocks the styles, with the style worn. A board in
// play is not saved; a reload starts at the menu.
const KEY = 'ninefold-progress';

export function loadProgress(): Progress {
  const p = newProgress();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (saved && typeof saved === 'object') {
      for (const key of ['solved', 'flawless', 'noHint', 'hard', 'fast', 'bestFloor', 'bosses', 'daily'] as const) {
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
