import { BLACK, KNIGHT, type Kind, type Move, PAWN, type Position, QUEEN, ROOK, BISHOP, START, type Side } from './chess';

/**
 * Rival sculptors: a ladder of eight Stone AI opponents, each on one of the AI's levels with a
 * style of its own, a bias it adds to its moves at the top of its search. The early ones give odds
 * and start without a knight or two. Beating one opens the next (`stonemate-rivals`). Free of
 * Phaser and of `shared/`, as the deep search's worker imports it.
 */

export type Style = 'pawns' | 'captures' | 'knights' | 'rooks' | 'bishops' | 'keepQueen' | 'queen' | 'none';

export interface Rival {
  id: string;
  /** The Stone AI level it thinks with, 1 to 7. */
  level: number;
  style: Style;
  /** The squares its own pieces are missing from at the start, as White would have them (`b1`). */
  odds: string[];
  /** Its favourite statue, which breaks in its defeat scene. */
  emblem: Kind;
  /** How that statue breaks: as the fall of this kind. */
  breaks: Exclude<Kind, 'k'>;
}

export const RIVALS: readonly Rival[] = [
  { id: 'pebble', level: 1, style: 'pawns', odds: ['b1', 'g1'], emblem: 'p', breaks: 'p' },
  { id: 'flint', level: 2, style: 'captures', odds: ['b1'], emblem: 'r', breaks: 'n' },
  { id: 'slate', level: 3, style: 'knights', odds: ['g1'], emblem: 'n', breaks: 'n' },
  { id: 'basalt', level: 3, style: 'rooks', odds: [], emblem: 'r', breaks: 'r' },
  { id: 'chalk', level: 4, style: 'bishops', odds: [], emblem: 'b', breaks: 'b' },
  { id: 'granite', level: 5, style: 'keepQueen', odds: [], emblem: 'q', breaks: 'r' },
  { id: 'jasper', level: 6, style: 'queen', odds: [], emblem: 'q', breaks: 'q' },
  { id: 'sculptor', level: 7, style: 'none', odds: [], emblem: 'k', breaks: 'q' },
];

/** The side the player takes against rival `i`: White against the even ones, Black against the odd. */
export const rivalPlayer = (i: number): Side => (i % 2 === 0 ? 'w' : 'b');

/** The start against rival `i`, as FEN: the usual one, less the rival's odds. */
export function rivalStart(i: number): string {
  const r = RIVALS[i];
  if (!r.odds.length) return START;
  const rows = ['rnbqkbnr', 'pppppppp', '8', '8', '8', '8', 'PPPPPPPP', 'RNBQKBNR'];
  const aiWhite = rivalPlayer(i) === 'b';
  const grid = rows.map((row) => row.replace(/\d/g, (n) => '.'.repeat(Number(n))).split(''));
  for (const sq of r.odds) {
    const col = 'abcdefgh'.indexOf(sq[0]);
    grid[aiWhite ? 7 : 0][col] = '.';
  }
  const pack = (cells: string[]) => cells.join('').replace(/\.+/g, (dots) => String(dots.length));
  return `${grid.map(pack).join('/')} w KQkq -`;
}

/**
 * How much rival style `style` likes `m` in `pos` (in points, a pawn being 100), added to the move's
 * score at the root of its search, so it leans its own way among moves that are close.
 */
export function styleBias(style: Style, pos: Position, m: Move): number {
  const kind = m.piece & 7;
  switch (style) {
    case 'pawns':
      return kind === PAWN ? 30 : 0;
    case 'captures':
      return m.captured ? 40 : 0;
    case 'knights':
      return kind === KNIGHT ? 30 : 0;
    case 'rooks':
      return kind === ROOK ? 25 : 0;
    case 'bishops':
      return kind === BISHOP ? 25 : 0;
    case 'queen':
      return kind === QUEEN ? 25 : 0;
    case 'keepQueen': {
      // Never trades queens: shy of taking the queen with its own, or of leaving it where theirs can take it.
      if (kind === QUEEN && (m.captured & 7) === QUEEN) return -400;
      const own = QUEEN + (pos.turn === 'b' ? BLACK : 0);
      const theirs = QUEEN + (pos.turn === 'b' ? 0 : BLACK);
      pos.make(m);
      const trade = pos.pseudoMoves(true).some((r) => r.piece === theirs && r.captured === own);
      pos.unmake();
      return trade ? -400 : 0;
    }
    default:
      return 0;
  }
}
