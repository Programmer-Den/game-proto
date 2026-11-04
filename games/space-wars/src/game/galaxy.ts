// Galaxy conquest: a star map of twelve sectors held by the five factions. The player picks a
// faction and attacks a rival sector beside one of theirs; winning its battle takes the sector,
// losing it costs the player a sector beside it to the defender. Between battles a rival may take
// a sector from another rival. Holding every sector wins the galaxy; losing the last ends it.
// Saved in the browser under `space-wars-galaxy`. No Phaser.

import { FACTIONS } from './factions';
import { SECTORS } from './campaign';
import type { TextKey } from '../i18n';

export interface GalaxySector {
  /** A key of `i18n/en.ts`. */
  name: TextKey;
  /** Where it sits on the star map, as shares of the map's width and height. */
  x: number;
  y: number;
}

export const GALAXY: readonly GalaxySector[] = [
  { name: 'galaxyCradle', x: 0.05, y: 0.72 },
  { name: 'galaxyVane', x: 0.22, y: 0.36 },
  { name: 'galaxyHarbour', x: 0.24, y: 0.86 },
  { name: 'galaxySaffron', x: 0.4, y: 0.56 },
  { name: 'galaxySpire', x: 0.42, y: 0.12 },
  { name: 'galaxyTidewell', x: 0.57, y: 0.86 },
  { name: 'galaxyKnot', x: 0.6, y: 0.4 },
  { name: 'galaxyLantern', x: 0.76, y: 0.12 },
  { name: 'galaxyCopper', x: 0.78, y: 0.62 },
  { name: 'galaxyLastLight', x: 0.94, y: 0.34 },
  { name: 'galaxyRust', x: 0.95, y: 0.86 },
  { name: 'galaxyNorthgate', x: 0.08, y: 0.1 },
];

/** The lanes between sectors: a battle can only be fought for a sector beside one of the player's. */
export const LANES: readonly (readonly [number, number])[] = [
  [0, 1], [0, 2], [1, 11], [1, 3], [1, 4], [2, 3], [2, 5], [3, 6], [3, 5], [4, 11], [4, 6], [4, 7],
  [5, 8], [6, 7], [6, 8], [7, 9], [8, 9], [8, 10], [9, 10],
];

/** Each slot's home sector: the player's first, then the rivals' in their usual order. */
const HOMES = [0, 11, 7, 10, 6];

/** Crystal the defending faction starts a battle with, for each sector it holds. */
export const DEFENDER_CRYSTAL = 40;

/** The galaxy so far: the player's faction and the faction holding each sector (indices into FACTIONS). */
export interface Galaxy {
  faction: number;
  owners: number[];
  battles: number;
  /** What happened between the last two battles: a rival that took a sector from another, or null. */
  news: { faction: number; sector: number } | null;
}

export const GALAXY_KEY = 'space-wars-galaxy';

export function neighbours(sector: number): number[] {
  return LANES.filter((l) => l.includes(sector)).map(([a, b]) => (a === sector ? b : a));
}

/**
 * A new galaxy for the player's faction: each faction starts on its home sector, and every other
 * sector goes to the faction whose home is fewest lanes away (a tie to the rival first in order).
 */
export function newGalaxy(faction: number): Galaxy {
  const order = [faction, ...FACTIONS.map((_, i) => i).filter((i) => i !== faction)];
  const far = HOMES.map((home) => {
    const d = GALAXY.map(() => Infinity);
    d[home] = 0;
    const queue = [home];
    while (queue.length) {
      const s = queue.shift()!;
      for (const n of neighbours(s)) if (d[n] > d[s] + 1) { d[n] = d[s] + 1; queue.push(n); }
    }
    return d;
  });
  const owners = GALAXY.map((_, s) => {
    const best = Math.min(...far.map((d) => d[s]));
    const slots = far.map((_, slot) => slot).filter((slot) => far[slot][s] === best);
    const slot = slots.find((k) => k > 0) ?? 0;
    return order[slots.length === 1 ? slots[0] : slot];
  });
  return { faction, owners, battles: 0, news: null };
}

export function loadGalaxy(): Galaxy | null {
  try {
    const raw = JSON.parse(localStorage.getItem(GALAXY_KEY) ?? 'null');
    const valid = (f: unknown) => typeof f === 'number' && Number.isInteger(f) && f >= 0 && f < FACTIONS.length;
    if (raw && valid(raw.faction) && Array.isArray(raw.owners) && raw.owners.length === GALAXY.length && raw.owners.every(valid)) {
      const news = raw.news && valid(raw.news.faction) && Number.isInteger(raw.news.sector) && raw.news.sector >= 0 && raw.news.sector < GALAXY.length
        ? { faction: raw.news.faction as number, sector: raw.news.sector as number } : null;
      const g: Galaxy = { faction: raw.faction, owners: [...raw.owners], battles: Math.max(0, Math.round(raw.battles) || 0), news };
      if (held(g) > 0) return g;
    }
  } catch {
    // No storage, or a broken save: no galaxy under way.
  }
  return null;
}

/** Saves the galaxy, or clears it when it is over (null). */
export function saveGalaxy(g: Galaxy | null) {
  try {
    if (g) localStorage.setItem(GALAXY_KEY, JSON.stringify(g));
    else localStorage.removeItem(GALAXY_KEY);
  } catch {
    // Storage full or blocked: the galaxy lasts this visit only.
  }
}

/** How many sectors a faction holds (the player's by default). */
export function held(g: Galaxy, faction = g.faction): number {
  return g.owners.filter((o) => o === faction).length;
}

/** The rival sectors the player can attack: those beside one of theirs. */
export function targets(g: Galaxy): number[] {
  return GALAXY.map((_, s) => s).filter((s) => g.owners[s] !== g.faction && neighbours(s).some((n) => g.owners[n] === g.faction));
}

/** How hard the galaxy's battles are, as a campaign sector's setup: harder the more the player holds. */
export function galaxyTier(g: Galaxy): number {
  return Math.max(0, Math.min(SECTORS.length - 1, Math.floor((held(g) - 2) / 2)));
}

/** The factions with no sector left: they sit the galaxy's battles out. */
export function outOfGalaxy(g: Galaxy): number[] {
  return FACTIONS.map((_, f) => f).filter((f) => f !== g.faction && held(g, f) === 0);
}

export function conquered(g: Galaxy): boolean {
  return g.owners.every((o) => o === g.faction);
}

/**
 * A battle for `target` is over. Won, the sector is the player's. Lost, its defender takes the
 * player's sector beside it (the one with the fewest of the player's sectors beside it, so the
 * player's front gives way first). Then a rival may move. Returns the new galaxy and the sector
 * the player lost, or -1.
 */
export function afterBattle(g: Galaxy, target: number, won: boolean, rand = Math.random): { galaxy: Galaxy; lost: number } {
  const owners = [...g.owners];
  let lost = -1;
  if (won) owners[target] = g.faction;
  else {
    const mine = (s: number) => neighbours(s).filter((n) => owners[n] === g.faction).length;
    const front = neighbours(target).filter((n) => owners[n] === g.faction).sort((a, b) => mine(a) - mine(b) || a - b);
    lost = front[0] ?? -1;
    if (lost >= 0) owners[lost] = owners[target];
  }
  const next: Galaxy = { faction: g.faction, owners, battles: g.battles + 1, news: null };
  return { galaxy: rivalsMove(next, rand), lost };
}

/** Half the time, one rival takes a sector beside it from another rival (never from the player). */
function rivalsMove(g: Galaxy, rand: () => number): Galaxy {
  if (rand() >= 0.5) return g;
  const moves: { faction: number; sector: number }[] = [];
  g.owners.forEach((o, s) => {
    if (o === g.faction) return;
    for (const n of neighbours(s)) if (g.owners[n] !== g.faction && g.owners[n] !== o) moves.push({ faction: g.owners[n], sector: s });
  });
  if (!moves.length) return g;
  const move = moves[Math.floor(rand() * moves.length)];
  const owners = [...g.owners];
  owners[move.sector] = move.faction;
  return { ...g, owners, news: move };
}
