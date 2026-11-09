import type { Side } from './chess';

/**
 * What Stonemate keeps in the browser: the game under way as its moves (`stonemate-game`, so it
 * can go on later) and the totals the menu and trophies read (`stonemate-stats`).
 */

export type Mode = 'ai' | 'duo';

export interface SavedGame {
  mode: Mode;
  /** The side the player has against the AI; White in a two-player game. */
  player: Side;
  /** The Stone AI's level, 1 to 7 (older saves have none and play the menu's level). */
  level?: number;
  /** Every move so far as `e2e4` text. */
  moves: string[];
}

export interface Stats {
  wins: number;
  losses: number;
  draws: number;
  /** Capture pairs seen in play, as `nb` keys. */
  pairs: string[];
  /** Signature scenes seen in play, by id. */
  scenes: string[];
}

const GAME_KEY = 'stonemate-game';
const STATS_KEY = 'stonemate-stats';

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
  return g && Array.isArray(g.moves) && (g.mode === 'ai' || g.mode === 'duo') ? g : null;
}
export const saveGame = (g: SavedGame | null) => write(GAME_KEY, g);

export function loadStats(): Stats {
  const s = read<Partial<Stats>>(STATS_KEY) ?? {};
  return { wins: s.wins ?? 0, losses: s.losses ?? 0, draws: s.draws ?? 0, pairs: s.pairs ?? [], scenes: s.scenes ?? [] };
}
export const saveStats = (s: Stats) => write(STATS_KEY, s);
