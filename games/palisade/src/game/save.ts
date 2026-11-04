import { AIM_MODES, type AimMode } from './aim';
import { canClass } from './hero';
import { freshLegacy, type Legacy } from './legacy';
import { freshProgress, type Progress } from './state';
import { RELICS } from './relics';
import { UPGRADES, type UpgradeId } from './upgrades';

// Only the hero's progress is saved: level, experience, upgrades, relics and what retired heroes
// left. A reload always starts a run at wave 1.
const KEY = 'palisade-progress';

export function loadProgress(): Progress {
  const fresh = freshProgress();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const saved = JSON.parse(raw) as Partial<Progress>;
    // Ranks of upgrades that no longer exist are dropped, so the skill book never counts them.
    const ranks = Object.fromEntries(
      Object.entries(saved.ranks ?? {}).filter(([id]) => id in UPGRADES),
    ) as Progress['ranks'];
    // Relics came later: an older save has none, and unknown ones are dropped too.
    const relics = Object.fromEntries(
      Object.entries(saved.relics ?? {}).filter(([id]) => id in RELICS),
    ) as Progress['relics'];
    // The cards a level-up had up: kept only if they are still three known upgrades and a level-up
    // is pending, otherwise new ones are rolled.
    const choices = Array.isArray(saved.choices) && saved.choices.length === 3 && saved.choices.every((id) => id in UPGRADES) && (saved.levelUps ?? 0) > 0 ? saved.choices : null;
    // What retired heroes left came later too: an older save has none, and unknown relics are dropped.
    const kept: Partial<Legacy> = saved.legacy ?? {};
    const legacy: Legacy = {
      ...freshLegacy(),
      relics: Array.isArray(kept.relics) ? kept.relics.filter((id) => id in RELICS) : [],
      slot: kept.slot === true,
      rain: kept.rain === true,
      retired: typeof kept.retired === 'number' ? kept.retired : 0,
    };
    // The class and the frozen pass came later still: an older save is a ranger in the vale.
    const hero: Progress['hero'] = (saved.hero === 'mage' || saved.hero === 'warden') && canClass(legacy, saved.hero) ? saved.hero : 'ranger';
    const frontier: Progress['frontier'] = saved.frontier === 'pass' && (saved.heatUnlocked ?? 0) > 0 ? 'pass' : 'vale';
    const passBest = typeof saved.passBest === 'number' && Number.isFinite(saved.passBest) ? Math.max(0, saved.passBest) : 0;
    // The endless siege's bests came later still: an older save has none.
    const best = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? Math.max(0, n) : 0);
    const endlessBest = { vale: best(saved.endlessBest?.vale), pass: best(saved.endlessBest?.pass) };
    return { ...fresh, ...saved, ranks, relics, legacy, hero, frontier, passBest, passWon: saved.passWon === true, endlessBest, choices };
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

// The battle speed (1 or 2) is a setting, kept apart from the hero so "New hero" keeps it.
const SPEED_KEY = 'palisade-speed';

export function loadSpeed(): number {
  try {
    return localStorage.getItem(SPEED_KEY) === '2' ? 2 : 1;
  } catch {
    return 1;
  }
}

export function saveSpeed(speed: number) {
  try {
    localStorage.setItem(SPEED_KEY, String(speed));
  } catch {
    // Storage can be blocked; the speed then only lasts until a reload.
  }
}

// The skill book: every upgrade a level-up has offered at least once. Like the speed, it is kept
// apart from the hero, so "New hero" starts a new hero with the book still filled in.
const FOUND_KEY = 'palisade-skill-book';

export function loadFound(): UpgradeId[] {
  try {
    const saved = JSON.parse(localStorage.getItem(FOUND_KEY) ?? '[]') as unknown;
    return Array.isArray(saved) ? saved.filter((id): id is UpgradeId => id in UPGRADES) : [];
  } catch {
    return [];
  }
}

export function saveFound(found: UpgradeId[]) {
  try {
    localStorage.setItem(FOUND_KEY, JSON.stringify(found));
  } catch {
    // Storage can be blocked; the book then only lasts until a reload.
  }
}

// The aim priority is a setting too, kept apart from the hero like the speed.
const AIM_KEY = 'palisade-aim';

export function loadAim(): AimMode {
  try {
    const saved = localStorage.getItem(AIM_KEY);
    return AIM_MODES.find((m) => m === saved) ?? 'nearest';
  } catch {
    return 'nearest';
  }
}

export function saveAim(mode: AimMode) {
  try {
    localStorage.setItem(AIM_KEY, mode);
  } catch {
    // Storage can be blocked; the choice then only lasts until a reload.
  }
}

const AUTO_PICK_KEY = 'palisade-auto-pick';

/** Whether a level-up takes a card at random once its countdown runs out (on unless turned off). */
export function loadAutoPick(): boolean {
  try {
    return localStorage.getItem(AUTO_PICK_KEY) !== '0';
  } catch {
    return true;
  }
}

export function saveAutoPick(on: boolean) {
  try {
    localStorage.setItem(AUTO_PICK_KEY, on ? '1' : '0');
  } catch {
    // Storage can be blocked; the choice then only lasts until a reload.
  }
}
