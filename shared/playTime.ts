import type Phaser from 'phaser';
import { t } from './i18n';

/**
 * How long each game has been played on this device, in seconds per game folder, kept under one
 * `hub-` key so it never travels with a game's progress export, QR code or link
 * (`saveFile.ts` carries only keys with the game's prefix). Nothing is sent anywhere.
 *
 * `setupGame` calls `trackPlayTime`, which adds up game time only while the game is actually
 * running: not on the start or pause screen, not with the tab hidden and not while the turn-phone
 * hint holds the game (`game.pause()`, which stops its steps). It saves every 30 seconds and when the
 * tab is left. Browser automation (the playthroughs and other e2e tests) and `?watch` matches are
 * not counted, unless the test sets `window.countPlayTime`.
 */
export const PLAY_TIME_KEY = 'hub-playtime';

/** Played time is saved once this much of it has piled up, and when the tab is left. */
const SAVE_EVERY_MS = 30_000;
/** A longer step (a hitch, a tab coming back) counts as this much, so a gap never counts in full. */
const MAX_STEP_MS = 1000;

/** The seconds played per game folder on this device. */
export function playTimes(): Record<string, number> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PLAY_TIME_KEY) ?? '{}');
    if (!saved || typeof saved !== 'object') return {};
    return Object.fromEntries(
      Object.entries(saved).filter((e): e is [string, number] => typeof e[1] === 'number' && e[1] > 0),
    );
  } catch {
    return {};
  }
}

/** Forgets the time played of every game in `games` (folder names), and the key once it is empty. */
export function clearPlayTime(games: string[]) {
  const times = playTimes();
  for (const game of games) delete times[game];
  try {
    if (Object.keys(times).length) localStorage.setItem(PLAY_TIME_KEY, JSON.stringify(times));
    else localStorage.removeItem(PLAY_TIME_KEY);
  } catch {
    // Storage is blocked, so nothing was saved.
  }
}

/** A time played like "3 h 20 min" or "45 min", or undefined under a minute. */
export function formatPlayTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return undefined;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? t('durationHours', { h, m }) : t('durationMinutes', { m });
}

/** Adds up the time `game` runs while `playing()` says its start and pause screens are down. */
export function trackPlayTime(game: Phaser.Game, name: string, playing: () => boolean) {
  if (navigator.webdriver && !(window as { countPlayTime?: boolean }).countPlayTime) return;
  if (new URLSearchParams(location.search).has('watch')) return;
  let unsaved = 0;
  const save = () => {
    const seconds = Math.floor(unsaved / 1000);
    if (seconds < 1) return;
    unsaved -= seconds * 1000;
    // Read again first: another tab may have saved its own game's time meanwhile.
    const times = playTimes();
    times[name] = (times[name] ?? 0) + seconds;
    try {
      localStorage.setItem(PLAY_TIME_KEY, JSON.stringify(times));
    } catch {
      // Storage can be blocked; then no time is kept.
    }
  };
  // Phaser.Core.Events.STEP, by name: the hub reads these times too and doesn't load Phaser.
  game.events.on('step', (_time: number, delta: number) => {
    if (!playing() || document.hidden) return;
    unsaved += Math.min(delta, MAX_STEP_MS);
    if (unsaved >= SAVE_EVERY_MS) save();
  });
  document.addEventListener('visibilitychange', () => document.hidden && save());
  window.addEventListener('pagehide', save);
}
