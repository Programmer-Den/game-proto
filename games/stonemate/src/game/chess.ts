/**
 * The rules of chess: a mutable position with make and unmake, legal moves (castling, en passant
 * and promotion included), check, checkmate and the draws (stalemate, too little material, fifty
 * moves, threefold repetition). Free of Phaser and sound, so the AI and the scene share it.
 *
 * Squares are 0 to 63, row by row from the top of the board as White sees it: 0 is a8, 7 is h8,
 * 56 is a1 and 63 is h1. A piece is its kind (`PAWN` to `KING`) plus `BLACK` for Black's.
 */

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;
export const BLACK = 8;

export type Side = 'w' | 'b';
/** A piece kind by its letter, as the texts and the capture animations know it. */
export type Kind = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export const KINDS: readonly Kind[] = ['p', 'n', 'b', 'r', 'q', 'k'];
/** The kinds that can be captured: every one but the king. */
export const VICTIMS: readonly Kind[] = ['p', 'n', 'b', 'r', 'q'];

export const kindOf = (piece: number): Kind => KINDS[(piece & 7) - 1];
export const sideOf = (piece: number): Side => (piece & BLACK ? 'b' : 'w');
export const pieceOf = (kind: Kind, side: Side) => KINDS.indexOf(kind) + 1 + (side === 'b' ? BLACK : 0);

/** How a move is special. */
export const Flag = { None: 0, Double: 1, EnPassant: 2, CastleKing: 3, CastleQueen: 4 } as const;
export type Flag = (typeof Flag)[keyof typeof Flag];

export interface Move {
  from: number;
  to: number;
  /** The piece that moves. */
  piece: number;
  /** The piece taken, or 0. */
  captured: number;
  /** Where the taken piece stood: `to`, except for en passant. */
  capturedAt: number;
  /** The kind a pawn turns into on the last row, or 0. */
  promo: number;
  flag: Flag;
}

interface Undo {
  move: Move;
  castling: number;
  ep: number;
  halfmove: number;
}

export type Result = { kind: 'mate'; winner: Side } | { kind: 'draw'; reason: 'stalemate' | 'material' | 'fifty' | 'repetition' } | null;

const row = (sq: number) => sq >> 3;
const col = (sq: number) => sq & 7;
const on = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

const KNIGHT_STEPS = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING_STEPS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const STRAIGHT = [[-1, 0], [1, 0], [0, -1], [0, 1]];

// Castling rights as bits.
const WK = 1;
const WQ = 2;
const BK = 4;
const BQ = 8;
/** Rights kept when a piece leaves or lands on a square: a king or rook moving, or a rook taken. */
const KEEP = new Array<number>(64).fill(15);
KEEP[60] = 15 & ~(WK | WQ);
KEEP[63] = 15 & ~WK;
KEEP[56] = 15 & ~WQ;
KEEP[4] = 15 & ~(BK | BQ);
KEEP[7] = 15 & ~BK;
KEEP[0] = 15 & ~BQ;

/** The square's name, like `e4`. */
export const squareName = (sq: number) => 'abcdefgh'[col(sq)] + String(8 - row(sq));
export const squareAt = (name: string) => (8 - Number(name[1])) * 8 + 'abcdefgh'.indexOf(name[0]);

/** A move as `e2e4` (with the promotion letter, `e7e8q`), how saves keep it. */
export const moveText = (m: Move) => squareName(m.from) + squareName(m.to) + (m.promo ? kindOf(m.promo) : '');

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

export class Position {
  board = new Array<number>(64).fill(0);
  turn: Side = 'w';
  castling = 15;
  /** The square a pawn can take en passant, or -1. */
  ep = -1;
  /** Plies since the last capture or pawn move, for the fifty-move rule. */
  halfmove = 0;
  /** The moves made, for undo. */
  history: Undo[] = [];
  /** A key for each position reached, for threefold repetition. */
  keys: string[] = [];

  constructor() {
    let sq = 0;
    for (const ch of START) {
      if (ch === '/') continue;
      if (/\d/.test(ch)) sq += Number(ch);
      else {
        const kind = ch.toLowerCase() as Kind;
        this.board[sq++] = pieceOf(kind, ch === kind ? 'b' : 'w');
      }
    }
    this.keys.push(this.key());
  }

  /** The position as text for repetition and the deep search's table: pieces, side to move, castling and en passant. */
  key() {
    return String.fromCharCode(...this.board) + this.turn + this.castling + ',' + this.ep;
  }

  kingSquare(side: Side) {
    return this.board.indexOf(KING + (side === 'b' ? BLACK : 0));
  }

  /** Whether `by` attacks `sq`. */
  attacked(sq: number, by: Side): boolean {
    const b = this.board;
    const own = by === 'b' ? BLACK : 0;
    const r = row(sq);
    const c = col(sq);
    // A pawn of `by` attacks from the row behind it as it moves.
    const pr = by === 'w' ? r + 1 : r - 1;
    for (const dc of [-1, 1]) if (on(pr, c + dc) && b[pr * 8 + c + dc] === PAWN + own) return true;
    for (const [dr, dc] of KNIGHT_STEPS) if (on(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === KNIGHT + own) return true;
    for (const [dr, dc] of KING_STEPS) if (on(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === KING + own) return true;
    for (const [dirs, a, q] of [[DIAG, BISHOP, QUEEN], [STRAIGHT, ROOK, QUEEN]] as const) {
      for (const [dr, dc] of dirs) {
        let rr = r + dr;
        let cc = c + dc;
        while (on(rr, cc)) {
          const p = b[rr * 8 + cc];
          if (p) {
            if (p === a + own || p === q + own) return true;
            break;
          }
          rr += dr;
          cc += dc;
        }
      }
    }
    return false;
  }

  inCheck(side: Side = this.turn) {
    return this.attacked(this.kingSquare(side), side === 'w' ? 'b' : 'w');
  }

  /** Every move of the side to move that may leave its king in check. */
  pseudoMoves(capturesOnly = false): Move[] {
    const moves: Move[] = [];
    const b = this.board;
    const side = this.turn;
    const own = side === 'b' ? BLACK : 0;
    const enemy = side === 'w' ? 'b' : 'w';
    const add = (from: number, to: number, flag: Flag = Flag.None, capturedAt = to) => {
      const piece = b[from];
      const captured = b[capturedAt];
      if (capturesOnly && !captured) return;
      if ((piece & 7) === PAWN && (row(to) === 0 || row(to) === 7)) {
        for (const kind of [QUEEN, KNIGHT, ROOK, BISHOP]) moves.push({ from, to, piece, captured, capturedAt, promo: kind + own, flag });
      } else moves.push({ from, to, piece, captured, capturedAt, promo: 0, flag });
    };
    const isEnemy = (sq: number) => b[sq] !== 0 && sideOf(b[sq]) === enemy;
    for (let from = 0; from < 64; from++) {
      const p = b[from];
      if (!p || sideOf(p) !== side) continue;
      const r = row(from);
      const c = col(from);
      switch (p & 7) {
        case PAWN: {
          const dir = side === 'w' ? -1 : 1;
          const one = from + dir * 8;
          if (on(r + dir, c) && !b[one]) {
            add(from, one);
            const startRow = side === 'w' ? 6 : 1;
            if (r === startRow && !b[one + dir * 8]) add(from, one + dir * 8, Flag.Double);
          }
          for (const dc of [-1, 1]) {
            if (!on(r + dir, c + dc)) continue;
            const to = (r + dir) * 8 + c + dc;
            if (isEnemy(to)) add(from, to);
            else if (to === this.ep) add(from, to, Flag.EnPassant, r * 8 + c + dc);
          }
          break;
        }
        case KNIGHT:
        case KING:
          for (const [dr, dc] of (p & 7) === KNIGHT ? KNIGHT_STEPS : KING_STEPS) {
            if (!on(r + dr, c + dc)) continue;
            const to = (r + dr) * 8 + c + dc;
            if (!b[to] || isEnemy(to)) add(from, to);
          }
          if ((p & 7) === KING && !capturesOnly) this.castles(from, side, moves);
          break;
        default: {
          const kind = p & 7;
          const dirs = kind === BISHOP ? DIAG : kind === ROOK ? STRAIGHT : [...DIAG, ...STRAIGHT];
          for (const [dr, dc] of dirs) {
            let rr = r + dr;
            let cc = c + dc;
            while (on(rr, cc)) {
              const to = rr * 8 + cc;
              if (b[to]) {
                if (isEnemy(to)) add(from, to);
                break;
              }
              add(from, to);
              rr += dr;
              cc += dc;
            }
          }
        }
      }
    }
    return moves;
  }

  private castles(from: number, side: Side, moves: Move[]) {
    const b = this.board;
    const enemy = side === 'w' ? 'b' : 'w';
    const home = side === 'w' ? 60 : 4;
    if (from !== home || this.attacked(home, enemy)) return;
    const [kRight, qRight] = side === 'w' ? [WK, WQ] : [BK, BQ];
    const piece = b[from];
    if (this.castling & kRight && !b[home + 1] && !b[home + 2] && !this.attacked(home + 1, enemy) && !this.attacked(home + 2, enemy)) {
      moves.push({ from, to: home + 2, piece, captured: 0, capturedAt: home + 2, promo: 0, flag: Flag.CastleKing });
    }
    if (this.castling & qRight && !b[home - 1] && !b[home - 2] && !b[home - 3] && !this.attacked(home - 1, enemy) && !this.attacked(home - 2, enemy)) {
      moves.push({ from, to: home - 2, piece, captured: 0, capturedAt: home - 2, promo: 0, flag: Flag.CastleQueen });
    }
  }

  make(m: Move) {
    const b = this.board;
    this.history.push({ move: m, castling: this.castling, ep: this.ep, halfmove: this.halfmove });
    if (m.captured) b[m.capturedAt] = 0;
    b[m.from] = 0;
    b[m.to] = m.promo || m.piece;
    if (m.flag === Flag.CastleKing) {
      b[m.to - 1] = b[m.to + 1];
      b[m.to + 1] = 0;
    } else if (m.flag === Flag.CastleQueen) {
      b[m.to + 1] = b[m.to - 2];
      b[m.to - 2] = 0;
    }
    this.castling &= KEEP[m.from] & KEEP[m.to];
    this.ep = m.flag === Flag.Double ? (m.from + m.to) / 2 : -1;
    this.halfmove = m.captured || (m.piece & 7) === PAWN ? 0 : this.halfmove + 1;
    this.turn = this.turn === 'w' ? 'b' : 'w';
    this.keys.push(this.key());
  }

  unmake() {
    const u = this.history.pop();
    if (!u) return;
    const { move: m } = u;
    const b = this.board;
    this.keys.pop();
    this.turn = this.turn === 'w' ? 'b' : 'w';
    this.castling = u.castling;
    this.ep = u.ep;
    this.halfmove = u.halfmove;
    b[m.from] = m.piece;
    b[m.to] = 0;
    if (m.captured) b[m.capturedAt] = m.captured;
    if (m.flag === Flag.CastleKing) {
      b[m.to + 1] = b[m.to - 1];
      b[m.to - 1] = 0;
    } else if (m.flag === Flag.CastleQueen) {
      b[m.to - 2] = b[m.to + 1];
      b[m.to + 1] = 0;
    }
  }

  /** The legal moves of the side to move. */
  legalMoves(capturesOnly = false): Move[] {
    const side = this.turn;
    return this.pseudoMoves(capturesOnly).filter((m) => {
      this.make(m);
      const ok = !this.inCheck(side);
      this.unmake();
      return ok;
    });
  }

  /** The legal move matching `e2e4`-style text, if there is one. */
  findMove(text: string): Move | undefined {
    return this.legalMoves().find((m) => moveText(m) === text || (moveText(m) === text + 'q' && text.length === 4));
  }

  /** How the game stands: checkmate, a draw, or still on (null). */
  result(): Result {
    if (this.legalMoves().length === 0) {
      return this.inCheck() ? { kind: 'mate', winner: this.turn === 'w' ? 'b' : 'w' } : { kind: 'draw', reason: 'stalemate' };
    }
    if (this.tooLittle()) return { kind: 'draw', reason: 'material' };
    if (this.halfmove >= 100) return { kind: 'draw', reason: 'fifty' };
    const now = this.keys[this.keys.length - 1];
    if (this.keys.filter((k) => k === now).length >= 3) return { kind: 'draw', reason: 'repetition' };
    return null;
  }

  /** Neither side can mate: kings alone, or a king with one bishop or knight against a lone king. */
  private tooLittle() {
    const rest = this.board.filter((p) => p && (p & 7) !== KING);
    return rest.length === 0 || (rest.length === 1 && [KNIGHT, BISHOP].includes(rest[0] & 7));
  }
}
