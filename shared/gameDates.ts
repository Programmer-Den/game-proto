/**
 * When each game was added and last changed, from git at build time (`scripts/gameDates.ts`), for
 * the Last updated line in a game's settings on the hub and the New and Updated badges on its card.
 * The hub remembers per device, under `hub-seen`, the last updated date of each game as it was
 * when it was last opened (`setupGame` calls `markSeen`), and nothing is sent anywhere:
 *
 * - **New:** added in the last `NEW_DAYS` days and never opened on this device.
 * - **Updated:** changed since it was last opened on this device.
 *
 * A game the device has never opened that isn't new counts as seen as it is (`markKnown`), so a
 * first visit shows no Updated badges.
 */
declare const __GAME_DATES__: Record<string, { added: string; updated: string }>;

export const GAME_DATES = __GAME_DATES__;
export const SEEN_KEY = 'hub-seen';
const NEW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** A `YYYY-MM-DD` date as midnight of that day in local time. */
export function parseDay(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function seen(): Record<string, string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SEEN_KEY) ?? '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function save(list: Record<string, string>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(list));
  } catch {
    // Storage can be blocked; the hub then shows only New badges.
  }
}

const isNew = (game: string, now: number) => {
  const dates = GAME_DATES[game];
  return !!dates && now - parseDay(dates.added).getTime() < NEW_DAYS * DAY_MS;
};

/** Notes that this game was opened as it is now, which clears its badge. */
export function markSeen(game: string) {
  const dates = GAME_DATES[game];
  if (dates) save({ ...seen(), [game]: dates.updated });
}

/** Counts every game in `games` that this device never opened and that isn't new as seen. */
export function markKnown(games: string[], now = Date.now()) {
  const list = seen();
  const unknown = games.filter((g) => GAME_DATES[g] && !list[g] && !isNew(g, now));
  if (unknown.length) save({ ...list, ...Object.fromEntries(unknown.map((g) => [g, GAME_DATES[g].updated])) });
}

/** The badge a game's card shows on this device, if any. */
export function badge(game: string, now = Date.now()): 'new' | 'updated' | undefined {
  const dates = GAME_DATES[game];
  if (!dates) return undefined;
  const last = seen()[game];
  if (!last) return isNew(game, now) ? 'new' : undefined;
  return dates.updated > last ? 'updated' : undefined;
}
