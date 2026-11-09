import { BISHOP, BLACK, KING, KNIGHT, PAWN, QUEEN, ROOK, type Move, type Position } from './chess';

/**
 * The Stone AI's deep search, for its top three levels (Expert, Master and Grandmaster). The lower
 * levels keep the small search in `ai.ts`. This one searches deeper in the same node budget:
 * iterative deepening, a transposition table, principal variation search, null-move pruning, late
 * move reductions, killer and history move ordering, a check extension, and an evaluation that also
 * knows pawn structure, the bishop pair, rooks on open files and the king's walk in the endgame.
 * It counts nodes, never time, so it plays the same on a slow machine as on a fast one; it runs in a
 * web worker (`aiWorker.ts`) so the statues keep moving while it thinks.
 */

const VALUE = [0, 100, 320, 330, 500, 900, 0];
const MATE = 100_000;
const INF = 1_000_000;

// Bonuses by square from White's side (index 0 is a8); Black reads them mirrored.
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
/** The king in the endgame walks to the middle. */
const KING_END = [
  -50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30,
  -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50,
];
/** A passed pawn's bonus by how many rows it has walked (0 on its home row). */
const PASSED = [0, 10, 15, 25, 45, 75, 120, 0];

/** The score of the position for the side to move. */
export function evaluateDeep(pos: Position) {
  const b = pos.board;
  // Pawns per file for each side, and the most advanced and rearmost rows, for passed pawns.
  const pawns = [new Array<number>(8).fill(0), new Array<number>(8).fill(0)];
  let phase = 0;
  const bishops = [0, 0];
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!p) continue;
    const kind = p & 7;
    const s = p & BLACK ? 1 : 0;
    if (kind === PAWN) pawns[s][sq & 7]++;
    else if (kind === BISHOP) bishops[s]++;
    if (kind === KNIGHT || kind === BISHOP) phase += 1;
    else if (kind === ROOK) phase += 2;
    else if (kind === QUEEN) phase += 4;
  }
  // 24 is the full set of pieces (the middlegame), 0 bare kings and pawns (the endgame).
  const mid = Math.min(phase, 24) / 24;
  let score = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!p) continue;
    const kind = p & 7;
    const white = !(p & BLACK);
    const s = white ? 0 : 1;
    const idx = white ? sq : 56 - (sq & 56) + (sq & 7);
    const r = sq >> 3;
    const c = sq & 7;
    let v = VALUE[kind];
    if (kind === KING) v += mid * PST[KING][idx] + (1 - mid) * KING_END[idx];
    else v += PST[kind][idx];
    if (kind === PAWN) {
      const own = pawns[s];
      if (own[c] > 1) v -= 12;
      if ((c === 0 || !own[c - 1]) && (c === 7 || !own[c + 1])) v -= 12;
      // Passed: no enemy pawn ahead on its own or a next file.
      let passed = true;
      for (let rr = white ? r - 1 : r + 1; passed && rr >= 0 && rr < 8; rr += white ? -1 : 1) {
        for (let cc = Math.max(0, c - 1); cc <= Math.min(7, c + 1); cc++) {
          if (b[rr * 8 + cc] === PAWN + (white ? BLACK : 0)) passed = false;
        }
      }
      if (passed) v += PASSED[white ? 6 - r + 1 : r] * (1.4 - 0.6 * mid);
    } else if (kind === ROOK) {
      if (!pawns[s][c]) v += pawns[1 - s][c] ? 8 : 18;
    }
    score += white ? v : -v;
  }
  if (bishops[0] >= 2) score += 30;
  if (bishops[1] >= 2) score -= 30;
  return Math.round(pos.turn === 'w' ? score : -score);
}

const moveId = (m: Move) => m.from | (m.to << 6) | ((m.promo & 7) << 12);

interface Entry {
  depth: number;
  score: number;
  /** 0 exact, 1 at least (a cut), 2 at most. */
  bound: 0 | 1 | 2;
  move: number;
}

class Search {
  nodes = 0;
  stopped = false;
  tt = new Map<string, Entry>();
  killers: number[][] = [];
  history = new Int32Array(4096);
  constructor(
    readonly pos: Position,
    readonly limit: number,
  ) {}

  private order(moves: Move[], ttMove: number, ply: number) {
    const k = this.killers[ply] ?? [];
    const rank = (m: Move) => {
      const id = moveId(m);
      if (id === ttMove) return 10_000_000;
      if (m.captured) return 1_000_000 + 10 * VALUE[m.captured & 7] - VALUE[m.piece & 7];
      if (m.promo) return 900_000;
      if (id === k[0]) return 800_000;
      if (id === k[1]) return 700_000;
      return this.history[id & 4095];
    };
    const keyed = moves.map((m) => ({ m, r: rank(m) }));
    keyed.sort((a, b) => b.r - a.r);
    return keyed.map((x) => x.m);
  }

  /** Whether the position now on the board was seen before since the last capture or pawn move. */
  private repeated() {
    const keys = this.pos.keys;
    const now = keys[keys.length - 1];
    const from = Math.max(0, keys.length - 1 - this.pos.halfmove);
    for (let i = keys.length - 3; i >= from; i -= 2) if (keys[i] === now) return true;
    return false;
  }

  private quiesce(alpha: number, beta: number, qdepth: number): number {
    this.nodes++;
    const stand = evaluateDeep(this.pos);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (qdepth > 6) return alpha;
    const caps = this.pos.pseudoMoves(true);
    const side = this.pos.turn;
    caps.sort((a, b) => 10 * VALUE[b.captured & 7] - VALUE[b.piece & 7] + (b.promo ? 800 : 0) - (10 * VALUE[a.captured & 7] - VALUE[a.piece & 7] + (a.promo ? 800 : 0)));
    for (const m of caps) {
      // Delta pruning: even winning this piece cannot lift the score to alpha.
      if (!m.promo && stand + VALUE[m.captured & 7] + 200 < alpha) continue;
      this.pos.make(m);
      if (this.pos.inCheck(side)) {
        this.pos.unmake();
        continue;
      }
      const score = -this.quiesce(-beta, -alpha, qdepth + 1);
      this.pos.unmake();
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  private hasPieces() {
    const own = this.pos.turn === 'b' ? BLACK : 0;
    for (const p of this.pos.board) if (p && (p & BLACK) === own && (p & 7) !== PAWN && (p & 7) !== KING) return true;
    return false;
  }

  search(depth: number, alpha: number, beta: number, ply: number, allowNull: boolean): number {
    const pos = this.pos;
    if (this.nodes > this.limit) this.stopped = true;
    if (this.stopped) return 0;
    if (ply > 0 && (pos.halfmove >= 100 || this.repeated())) return 0;
    const inCheck = pos.inCheck();
    if (inCheck && ply < 40) depth++;
    if (depth <= 0) return this.quiesce(alpha, beta, 0);
    this.nodes++;
    const key = pos.keys[pos.keys.length - 1];
    const hit = this.tt.get(key);
    let ttMove = -1;
    if (hit) {
      ttMove = hit.move;
      if (ply > 0 && hit.depth >= depth) {
        let s = hit.score;
        if (s > MATE / 2) s -= ply;
        else if (s < -MATE / 2) s += ply;
        if (hit.bound === 0 || (hit.bound === 1 && s >= beta) || (hit.bound === 2 && s <= alpha)) return s;
      }
    }
    const pv = beta - alpha > 1;
    // Null move: if passing still holds beta, a real move will too (not in check, nor in a pawn ending).
    if (allowNull && !pv && !inCheck && depth >= 3 && this.hasPieces() && evaluateDeep(pos) >= beta) {
      const ep = pos.ep;
      pos.ep = -1;
      pos.turn = pos.turn === 'w' ? 'b' : 'w';
      pos.keys.push(pos.key());
      const score = -this.search(depth - 3, -beta, -beta + 1, ply + 1, false);
      pos.keys.pop();
      pos.turn = pos.turn === 'w' ? 'b' : 'w';
      pos.ep = ep;
      if (this.stopped) return 0;
      if (score >= beta) return beta;
    }
    // Pseudo-legal moves, each checked for leaving the king in check as it is made.
    const moves = pos.pseudoMoves();
    const side = pos.turn;
    let best = -INF;
    let bestMove = -1;
    const start = alpha;
    let i = 0;
    for (const m of this.order(moves, ttMove, ply)) {
      pos.make(m);
      if (pos.inCheck(side)) {
        pos.unmake();
        continue;
      }
      const quiet = !m.captured && !m.promo;
      let score: number;
      if (i === 0) score = -this.search(depth - 1, -beta, -alpha, ply + 1, true);
      else {
        // Late quiet moves are searched a ply shallower first, with a null window.
        const reduce = quiet && !inCheck && depth >= 3 && i >= 3 && !pos.inCheck() ? (i >= 8 ? 2 : 1) : 0;
        score = -this.search(depth - 1 - reduce, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && reduce) score = -this.search(depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (score > alpha && score < beta) score = -this.search(depth - 1, -beta, -alpha, ply + 1, true);
      }
      pos.unmake();
      if (this.stopped) return 0;
      i++;
      if (score > best) {
        best = score;
        bestMove = moveId(m);
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (quiet) {
          const k = (this.killers[ply] ??= []);
          if (k[0] !== bestMove) {
            k[1] = k[0];
            k[0] = bestMove;
          }
          this.history[bestMove & 4095] += depth * depth;
        }
        break;
      }
    }
    if (i === 0) return inCheck ? -MATE + ply : 0;
    let stored = best;
    if (stored > MATE / 2) stored += ply;
    else if (stored < -MATE / 2) stored -= ply;
    this.tt.set(key, { depth, score: stored, bound: best >= beta ? 1 : best <= start ? 2 : 0, move: bestMove });
    return best;
  }

  /** Searches every root move at `depth`, best first, and returns their order with the best score. */
  root(moves: Move[], depth: number): { move: Move; score: number } | null {
    let alpha = -INF;
    let best: { move: Move; score: number } | null = null;
    for (const m of moves) {
      this.pos.make(m);
      let score: number;
      if (!best) score = -this.search(depth - 1, -INF, INF, 1, true);
      else {
        score = -this.search(depth - 1, -alpha - 1, -alpha, 1, true);
        if (score > alpha && !this.stopped) score = -this.search(depth - 1, -INF, -alpha, 1, true);
      }
      this.pos.unmake();
      if (this.stopped) break;
      if (!best || score > best.score) best = { move: m, score };
      if (score > alpha) alpha = score;
    }
    return best;
  }
}

export interface DeepLevel {
  /** The deepest iteration, in plies. */
  depth: number;
  /** Positions searched before it stops and plays the best move of its last full iteration. */
  nodes: number;
}

/**
 * The deep search's move for the side to move, or undefined when it has none. `random` (0 to 1,
 * from the caller's Math.random) shuffles the root moves first, so equal moves vary from game to game.
 */
export function chooseMoveDeep(pos: Position, level: DeepLevel, random: () => number): Move | undefined {
  let moves = pos.legalMoves();
  if (moves.length <= 1) return moves[0];
  for (let i = moves.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [moves[i], moves[j]] = [moves[j], moves[i]];
  }
  const s = new Search(pos, level.nodes);
  let chosen = moves[0];
  for (let depth = 1; depth <= level.depth; depth++) {
    const found = s.root(moves, depth);
    // A cut-off iteration still counts once its first move (the last best) was searched in full:
    // a move that beat it in full is better still.
    if (found) chosen = found.move;
    if (s.stopped || (found && Math.abs(found.score) > MATE / 2)) break;
    moves = [chosen, ...moves.filter((m) => m !== chosen)];
  }
  return chosen;
}
