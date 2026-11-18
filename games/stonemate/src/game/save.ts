import type { Side } from './chess';

/**
 * What Stonemate keeps in the browser: the game under way as its moves (`stonemate-game`, so it
 * can go on later) and the totals the menu and trophies read (`stonemate-stats`).
 */

/** Against the Stone AI, two players, a rival sculptor, or a statue puzzle (never saved). */
export type Mode = 'ai' | 'duo' | 'rival' | 'puzzle';

/** A game's clocks: the minutes each side starts with, the seconds added per move, and what is left (ms). */
export interface Clock {
  minutes: number;
  plus: number;
  w: number;
  b: number;
}

export interface SavedGame {
  mode: Mode;
  /** The side the player has against the AI; White in a two-player game. */
  player: Side;
  /** The Stone AI's level, 1 to 7 (older saves have none and play the menu's level). */
  level?: number;
  /** Every move so far as `e2e4` text. */
  moves: string[];
  /** The start as FEN when it isn't the usual one (a shuffled back row, or a rival's odds). */
  start?: string;
  /** The rival being played, 0 to 7, in a rival game. */
  rival?: number;
  /** The clocks, in a game with them. */
  clock?: Clock;
}

export interface Stats {
  wins: number;
  losses: number;
  draws: number;
  /** Capture pairs seen in play, as `nb` keys. */
  pairs: string[];
  /** Signature scenes seen in play, by id. */
  scenes: string[];
  /** The strongest AI level beaten (0 for none), which opens the level above it. */
  best: number;
}

const GAME_KEY = 'stonemate-game';
const STATS_KEY = 'stonemate-stats';
const RIVALS_KEY = 'stonemate-rivals';
const PUZZLES_KEY = 'stonemate-puzzles';

function read<T>(key: string): T | null {
  try {
    const text = localStorage.getItem(key);
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the game plays on without saving.
  }
}

export function loadGame(): SavedGame | null {
  const g = read<SavedGame>(GAME_KEY);
  return g && Array.isArray(g.moves) && (g.mode === 'ai' || g.mode === 'duo' || (g.mode === 'rival' && typeof g.rival === 'number')) ? g : null;
}
export const saveGame = (g: SavedGame | null) => write(GAME_KEY, g);

export function loadStats(): Stats {
  const s = read<Partial<Stats>>(STATS_KEY) ?? {};
  return { wins: s.wins ?? 0, losses: s.losses ?? 0, draws: s.draws ?? 0, pairs: s.pairs ?? [], scenes: s.scenes ?? [], best: typeof s.best === 'number' ? s.best : 0 };
}
export const saveStats = (s: Stats) => write(STATS_KEY, s);

/** How many rival sculptors are beaten, 0 to 8: the next one to play is this one. */
export function loadRivals(): number {
  const r = read<{ beaten?: unknown }>(RIVALS_KEY);
  return typeof r?.beaten === 'number' ? r.beaten : 0;
}
export const saveRivals = (beaten: number) => write(RIVALS_KEY, { beaten });

/** The ladder puzzles solved, by number. */
export function loadPuzzles(): number[] {
  const p = read<{ solved?: unknown }>(PUZZLES_KEY);
  return Array.isArray(p?.solved) ? p.solved.filter((n): n is number => typeof n === 'number') : [];
}
export const savePuzzles = (solved: number[]) => write(PUZZLES_KEY, { solved });
