/**
 * The games' saved progress, for the hub. Every game keeps its saves in `localStorage` under keys
 * that start with its folder name (`apothecary-save`, `tiny-kingdom-best`), so a game's progress is
 * every key that is its name or starts with `<name>-`. The hub also remembers which games were
 * played last (`setupGame` calls `markPlayed`), for its Continue playing row. Deleting a game's
 * progress also forgets its time played (`playTime.ts`); its star on the hub stays.
 */
import { clearPlayTime } from './playTime';

export const RECENT_KEY = 'hub-recent';

function keys(): string[] {
  try {
    return Object.keys(localStorage);
  } catch {
    // Storage is blocked, so nothing was saved.
    return [];
  }
}

/** The storage keys that hold a game's progress. */
export function progressKeys(game: string) {
  return keys().filter((key) => key === game || key.startsWith(`${game}-`));
}

/** Whether a game has anything saved: a run, best scores, unlocks or its own options. */
export function hasProgress(game: string) {
  return progressKeys(game).length > 0;
}

/** Deletes one game's progress and time played, and drops it from the recently played games. */
export function clearProgress(game: string) {
  try {
    for (const key of progressKeys(game)) localStorage.removeItem(key);
    localStorage.setItem(RECENT_KEY, JSON.stringify(recentlyPlayed().filter((g) => g !== game)));
    clearPlayTime([game]);
  } catch {
    // Storage is blocked, so nothing was saved.
  }
}

/**
 * Deletes the progress and time played of every game in `games` (their folder names) and the
 * recently played games, keeping the settings and favourites. Other keys are left alone: on a host like GitHub Pages other sites
 * of the same owner share the origin, and so its storage.
 */
export function clearAllProgress(games: string[]) {
  try {
    for (const key of games.flatMap(progressKeys)) localStorage.removeItem(key);
    localStorage.removeItem(RECENT_KEY);
    clearPlayTime(games);
  } catch {
    // Storage is blocked, so nothing was saved.
  }
}

/** The games played on this device, the last one played first. */
export function recentlyPlayed(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((g): g is string => typeof g === 'string') : [];
  } catch {
    return [];
  }
}

/** Moves a game to the front of the recently played games. */
export function markPlayed(game: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([game, ...recentlyPlayed().filter((g) => g !== game)]));
  } catch {
    // Storage can be blocked; the hub then has no Continue playing row.
  }
}
