import { BISHOP, KING, KNIGHT, PAWN, QUEEN, ROOK, type Move, type Position, sideOf } from './chess';

/**
 * The Stone AI: a small alpha-beta search over material and piece-square tables, with a capture
 * search at the leaves so it doesn't stop counting in the middle of a trade. The hub's difficulty
 * sets how deep it looks and how loosely it picks among good moves (`LEVELS` in `rules.ts`, levels 1 to 4; the top three use `deep.ts`).
 */

const VALUE = [0, 100, 320, 330, 500, 900, 0];

// Bonuses by square from White's side (row 0 is the far row, rank 8); Black reads them mirrored.
const PST: Record<number, number[]> = {
  [PAWN]: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  [KNIGHT]: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  [BISHOP]: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20,
  ],
  [ROOK]: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0,
  ],
  [QUEEN]: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20,
  ],
  [KING]: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

const MATE = 100_000;

/** The score of the position for the side to move. */
export function evaluate(pos: Position) {
  let score = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = pos.board[sq];
    if (!p) continue;
    const kind = p & 7;
    const white = sideOf(p) === 'w';
    const v = VALUE[kind] + PST[kind][white ? sq : 56 - (sq & 56) + (sq & 7)];
    score += white ? v : -v;
  }
  return pos.turn === 'w' ? score : -score;
}

/** Captures first, the biggest prize by the smallest piece; promotions next. */
function order(moves: Move[]) {
  const rank = (m: Move) => (m.captured ? 10 * VALUE[m.captured & 7] - VALUE[m.piece & 7] + 10_000 : 0) + (m.promo ? 8000 : 0);
  return moves.sort((a, b) => rank(b) - rank(a));
}

interface Search {
  nodes: number;
  limit: number;
}

function quiesce(pos: Position, alpha: number, beta: number, s: Search, depth = 0): number {
  s.nodes++;
  const stand = evaluate(pos);
  if (stand >= beta) return beta;
  if (alpha < stand) alpha = stand;
  if (depth > 4 || s.nodes > s.limit) return alpha;
  for (const m of order(pos.legalMoves(true))) {
    pos.make(m);
    const score = -quiesce(pos, -beta, -alpha, s, depth + 1);
    pos.unmake();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(pos: Position, depth: number, alpha: number, beta: number, ply: number, s: Search): number {
  if (depth === 0) return quiesce(pos, alpha, beta, s);
  s.nodes++;
  const moves = pos.legalMoves();
  if (moves.length === 0) return pos.inCheck() ? -MATE + ply : 0;
  if (pos.halfmove >= 100) return 0;
  for (const m of order(moves)) {
    pos.make(m);
    const score = -negamax(pos, depth - 1, -beta, -alpha, ply + 1, s);
    pos.unmake();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

export interface AiLevel {
  /** Plies searched before the capture search. */
  depth: number;
  /** Moves this many points (a pawn is 100) short of the best are picked too, at random. */
  slack: number;
}

/** The AI's move for the side to move, or undefined when it has none. Randomness goes through Math.random. */
export function chooseMove(pos: Position, level: AiLevel): Move | undefined {
  const moves = pos.legalMoves();
  if (moves.length === 0) return undefined;
  const s: Search = { nodes: 0, limit: 60_000 };
  const scored = order(moves).map((m) => {
    pos.make(m);
    // A move that repeats a position twice seen is scored as a draw.
    const repeats = pos.keys.filter((k) => k === pos.keys[pos.keys.length - 1]).length >= 3;
    const score = repeats ? 0 : -negamax(pos, level.depth - 1, -MATE, MATE, 1, s);
    pos.unmake();
    return { m, score };
  });
  const best = Math.max(...scored.map((x) => x.score));
  // Never throw away a mate, or walk into one, for the sake of variety.
  const slack = Math.abs(best) > MATE / 2 ? 0 : level.slack;
  const good = scored.filter((x) => x.score >= best - slack);
  return good[Math.floor(Math.random() * good.length)].m;
}
