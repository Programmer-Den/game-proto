// Skirmish: a battle on the picker's Skirmish tab with options of its own: free for all or teams
// (two against two plus one), the map's size, the crystal every faction starts with, and whether
// the map has wormholes. Saved under `space-wars-skirmish`. No Phaser, no Math.random.

import { MAP_SIZES, type MapSize } from './arena';

export type TeamsOption = 'free' | 'teams';
export type CrystalOption = 'low' | 'standard' | 'high';

export interface Skirmish {
  teams: TeamsOption;
  size: MapSize;
  crystal: CrystalOption;
  wormholes: boolean;
}

/** The options' order on the strip, which a tap steps through. */
export type SkirmishOption = keyof Skirmish;
export const SKIRMISH_OPTIONS: readonly SkirmishOption[] = ['teams', 'size', 'crystal', 'wormholes'];
const TEAMS: readonly TeamsOption[] = ['free', 'teams'];
const CRYSTALS: readonly CrystalOption[] = ['low', 'standard', 'high'];

/** What each faction starts with, by option. */
export const START_CRYSTALS: Record<CrystalOption, number> = { low: 60, standard: 120, high: 300 };

/**
 * Teams, by side index (0 is the player's start at the bottom left): the player and the top-left
 * start against the two starts on the right, with the centre on its own.
 */
export const TEAM_OF = [0, 1, 1, 0, 2] as const;

export const SKIRMISH_KEY = 'space-wars-skirmish';

export function newSkirmish(): Skirmish {
  return { teams: 'free', size: 'standard', crystal: 'standard', wormholes: true };
}

export function loadSkirmish(): Skirmish {
  const out = newSkirmish();
  try {
    const raw = JSON.parse(localStorage.getItem(SKIRMISH_KEY) ?? 'null');
    if (raw && typeof raw === 'object') {
      if (TEAMS.includes(raw.teams)) out.teams = raw.teams;
      if (MAP_SIZES.includes(raw.size)) out.size = raw.size;
      if (CRYSTALS.includes(raw.crystal)) out.crystal = raw.crystal;
      if (typeof raw.wormholes === 'boolean') out.wormholes = raw.wormholes;
    }
  } catch {
    // An unreadable save keeps the usual options.
  }
  return out;
}

export function saveSkirmish(s: Skirmish) {
  try {
    localStorage.setItem(SKIRMISH_KEY, JSON.stringify(s));
  } catch {
    // Storage may be full or blocked; the options then last only this visit.
  }
}

/** The options with one stepped on to its next value. */
export function stepSkirmish(s: Skirmish, option: SkirmishOption): Skirmish {
  const next = <T>(list: readonly T[], v: T) => list[(list.indexOf(v) + 1) % list.length];
  switch (option) {
    case 'teams': return { ...s, teams: next(TEAMS, s.teams) };
    case 'size': return { ...s, size: next(MAP_SIZES, s.size) };
    case 'crystal': return { ...s, crystal: next(CRYSTALS, s.crystal) };
    case 'wormholes': return { ...s, wormholes: !s.wormholes };
  }
}
