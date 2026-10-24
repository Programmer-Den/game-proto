/**
 * The games starred on the hub, as one list of game folders under a `hub-` key, so they stay on
 * this device and never travel with a game's progress export, QR code or link. The hub's card order
 * (Name, Last played or Most played) is kept here too.
 */
export const FAVOURITES_KEY = 'hub-favourites';
export const SORT_KEY = 'hub-sort';

export const SORTS = ['name', 'recent', 'most'] as const;
export type Sort = (typeof SORTS)[number];

/** The starred games' folders. */
export function favourites(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(FAVOURITES_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((g): g is string => typeof g === 'string') : [];
  } catch {
    return [];
  }
}

/** Stars a game, or takes its star away; returns whether it is starred now. */
export function toggleFavourite(game: string) {
  const list = favourites();
  const starred = !list.includes(game);
  const next = starred ? [...list, game] : list.filter((g) => g !== game);
  try {
    if (next.length) localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
    else localStorage.removeItem(FAVOURITES_KEY);
  } catch {
    // Storage can be blocked; the star then lasts until the page is left.
  }
  return starred;
}

/** The card order picked last on this device, Name at first. */
export function savedSort(): Sort {
  try {
    const sort = localStorage.getItem(SORT_KEY);
    return SORTS.find((s) => s === sort) ?? 'name';
  } catch {
    return 'name';
  }
}

export function saveSort(sort: Sort) {
  try {
    if (sort === 'name') localStorage.removeItem(SORT_KEY);
    else localStorage.setItem(SORT_KEY, sort);
  } catch {
    // Storage can be blocked; the order then lasts until the page is left.
  }
}
