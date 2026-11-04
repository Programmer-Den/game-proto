import { randomKind, type Kind } from './kinds';

// The 8x8 board of ingredient tiles, as rows from the top. Every tile has an id so the scene can
// follow it as it falls.

export const ROWS = 8;
export const COLS = 8;

export interface Tile {
  id: number;
  kind: Kind;
  /** A Catalyst, brewed by a match of four or more: it matches like its kind and clears its whole row. */
  catalyst?: boolean;
  /** A Bloom, brewed by an L or T of one kind: it matches like its kind and clears the 3x3 around it. */
  bloom?: boolean;
  /** A corked jar holding one of its kind: it never matches or swaps, and a match next to it opens it. */
  jar?: boolean;
  /** Sticky resin: the tile can't be swapped, and the first match it is in only melts the resin. */
  resin?: boolean;
  /** Creeping mould: the tile can't be swapped and never matches; a match next to it scrubs it clean. */
  mould?: boolean;
  /** A wall in a town's board shape: no tile is ever there, nothing matches through it and tiles fall past it. */
  hole?: boolean;
  /** Turned to a toad by a town's witch: it can't be swapped and never matches; a match next to it turns it back. */
  toad?: boolean;
}
export type Board = Tile[][];
export interface Cell {
  row: number;
  col: number;
}
export type NewTile = () => Tile;

export const adjacent = (a: Cell, b: Cell) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
export const inBoard = (c: Cell) => c.row >= 0 && c.row < ROWS && c.col >= 0 && c.col < COLS;
/** What a tile matches as: its kind, or nothing for a corked jar or a mouldy tile. */
export const matchKind = (t: Tile): Kind | null => (t.jar || t.mould || t.hole || t.toad ? null : t.kind);
/** Jars, resin, mould and toads hold their tiles in place, and a wall is no tile at all: they can't be swapped. */
export const stuck = (t: Tile) => !!(t.jar || t.resin || t.mould || t.hole || t.toad);
/** Catalysts and Blooms: the special tiles. */
export const special = (t: Tile) => !!(t.catalyst || t.bloom);

/** A copy of the board with the tiles at `a` and `b` swapped. */
export function swapped(board: Board, a: Cell, b: Cell): Board {
  const next = board.map((row) => [...row]);
  next[a.row][a.col] = board[b.row][b.col];
  next[b.row][b.col] = board[a.row][a.col];
  return next;
}

/** A line of three or more of a kind, across or down, its cells from the left or the top. */
export interface Run {
  kind: Kind;
  cells: Cell[];
}

/** Every row or column of three or more of the same kind, rows first. */
export function findRuns(board: Board): Run[] {
  const runs: Run[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; ) {
      let end = col + 1;
      const kind = matchKind(board[row][col]);
      while (end < COLS && kind && matchKind(board[row][end]) === kind) end++;
      if (kind && end - col >= 3) runs.push({ kind, cells: Array.from({ length: end - col }, (_, i) => ({ row, col: col + i })) });
      col = end;
    }
  }
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; ) {
      let end = row + 1;
      const kind = matchKind(board[row][col]);
      while (end < ROWS && kind && matchKind(board[end][col]) === kind) end++;
      if (kind && end - row >= 3) runs.push({ kind, cells: Array.from({ length: end - row }, (_, i) => ({ row: row + i, col })) });
      row = end;
    }
  }
  return runs;
}

/** Every cell in a row or column of three or more of the same kind. */
export function findMatches(board: Board): Cell[] {
  const hit = new Set<number>();
  for (const run of findRuns(board)) for (const c of run.cells) hit.add(c.row * COLS + c.col);
  return [...hit].sort((a, b) => a - b).map((i) => ({ row: Math.floor(i / COLS), col: i % COLS }));
}

/** True if the tile at `cell` is part of a line of three. */
export function matchesAt(board: Board, { row, col }: Cell): boolean {
  const kind = matchKind(board[row][col]);
  if (!kind) return false;
  const same = (r: number, c: number) => inBoard({ row: r, col: c }) && matchKind(board[r][c]) === kind;
  let across = 1;
  for (let c = col - 1; same(row, c); c--) across++;
  for (let c = col + 1; same(row, c); c++) across++;
  let down = 1;
  for (let r = row - 1; same(r, col); r--) down++;
  for (let r = row + 1; same(r, col); r++) down++;
  return across >= 3 || down >= 3;
}

/** True if swapping `a` and `b` does something: two specials (Catalysts or Blooms) together, or a match. */
export function swapWorks(board: Board, a: Cell, b: Cell): boolean {
  const ta = board[a.row][a.col];
  const tb = board[b.row][b.col];
  if (stuck(ta) || stuck(tb)) return false;
  return (special(ta) && special(tb)) || findMatches(swapped(board, a, b)).length > 0;
}

/** Every swap of neighbours that makes a match (or puts two specials together). */
export function validMoves(board: Board): [Cell, Cell][] {
  const moves: [Cell, Cell][] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const a = { row, col };
      for (const b of [{ row, col: col + 1 }, { row: row + 1, col }]) {
        if (inBoard(b) && swapWorks(board, a, b)) moves.push([a, b]);
      }
    }
  }
  return moves;
}

/**
 * Takes the cleared cells out, lets the tiles above fall and drops new ones in at the top. Resin
 * holds its tile in place and a wall stays where it is: the others fall past both.
 */
export function collapse(board: Board, cleared: Cell[], newTile: NewTile): Board {
  const gone = new Set(cleared.map((c) => c.row * COLS + c.col));
  const next: Board = Array.from({ length: ROWS }, () => new Array<Tile>(COLS));
  for (let col = 0; col < COLS; col++) {
    const held = (r: number) => !gone.has(r * COLS + col) && !!(board[r][col].resin || board[r][col].hole);
    const falling: Tile[] = [];
    for (let r = ROWS - 1; r >= 0; r--) {
      if (held(r)) next[r][col] = board[r][col];
      else if (!gone.has(r * COLS + col)) falling.push(board[r][col]);
    }
    for (let r = ROWS - 1; r >= 0; r--) if (!held(r)) next[r][col] = falling.shift() ?? newTile();
  }
  return next;
}

/** A new board with no matches on it and at least one move to make; `rand` rerolls kinds that would match. */
export function freshBoard(newTile: NewTile, rand: () => number = Math.random): Board {
  for (;;) {
    const board: Board = [];
    for (let row = 0; row < ROWS; row++) {
      board.push([]);
      for (let col = 0; col < COLS; col++) {
        let tile = newTile();
        const left = col >= 2 && board[row][col - 1].kind === board[row][col - 2].kind ? board[row][col - 1].kind : null;
        const up = row >= 2 && board[row - 1][col].kind === board[row - 2][col].kind ? board[row - 1][col].kind : null;
        while (tile.kind === left || tile.kind === up) tile = { ...tile, kind: randomKind(rand) };
        board[row].push(tile);
      }
    }
    if (validMoves(board).length > 0) return board;
  }
}

/**
 * The same tiles in new places, with no matches and at least one move; a fresh board if that fails.
 * Jars and resin-held tiles stay where they are.
 */
export function shuffle(board: Board, newTile: NewTile): Board {
  const free = board.flatMap((row, r) => row.flatMap((t, c) => (stuck(t) ? [] : [{ row: r, col: c }])));
  const tiles = free.map((c) => board[c.row][c.col]);
  for (let attempt = 0; attempt < 100; attempt++) {
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }
    const next = board.map((row) => [...row]);
    free.forEach((c, i) => (next[c.row][c.col] = tiles[i]));
    if (findMatches(next).length === 0 && validMoves(next).length > 0) return next;
  }
  // A town's walls stay where they are on the fresh board.
  const holes = board.flatMap((row, r) => row.flatMap((t, c) => (t.hole ? [{ row: r, col: c }] : [])));
  return layBoard(newTile, holes);
}

/**
 * A new board with walls cut at `holes` (a town's board shape), no matches and a move to make;
 * with no holes it is `freshBoard` itself, so the boards without walls are laid as before.
 */
export function layBoard(newTile: NewTile, holes: Cell[], rand: () => number = Math.random): Board {
  for (;;) {
    const board = freshBoard(newTile, rand);
    if (holes.length === 0) return board;
    for (const h of holes) board[h.row][h.col] = { ...board[h.row][h.col], hole: true };
    if (validMoves(board).length > 0) return board;
  }
}

/** The cells marked `#` in a board shape of eight rows of eight (`.` for a cell, `#` for a wall). */
export const holesOf = (shape: string[]): Cell[] =>
  shape.flatMap((line, row) => [...line].flatMap((ch, col) => (ch === '#' ? [{ row, col }] : [])));

/**
 * Corks `jars` random tiles into jars, coats `resin` others in resin and grows `mould` on others,
 * keeping the board free of matches and with a move left. Leaves the board alone when all are 0.
 * `rand` picks the cells (Math.random unless a guild examination's fixed board is being laid).
 */
export function addBlockers(board: Board, jars: number, resin: number, mould = 0, rand: () => number = Math.random): Board {
  if (jars + resin + mould === 0) return board;
  for (let attempt = 0; attempt < 50; attempt++) {
    const next = board.map((row) => [...row]);
    const pick = (n: number, mark: 'jar' | 'resin' | 'mould') => {
      for (let placed = 0, tries = 0; placed < n && tries < 200; tries++) {
        const row = Math.floor(rand() * ROWS);
        const col = Math.floor(rand() * COLS);
        if (stuck(next[row][col])) continue;
        next[row][col] = { ...next[row][col], [mark]: true };
        placed++;
      }
    };
    pick(jars, 'jar');
    pick(resin, 'resin');
    pick(mould, 'mould');
    if (validMoves(next).length > 0) return next;
  }
  return board;
}

/** The four cells around `c` that are on the board. */
export const neighbours = (c: Cell): Cell[] =>
  [{ row: c.row - 1, col: c.col }, { row: c.row + 1, col: c.col }, { row: c.row, col: c.col - 1 }, { row: c.row, col: c.col + 1 }].filter(inBoard);

/**
 * Mould creeps: one random mouldy tile spreads to a random neighbour that is plain (not held, not a
 * special), leaving a move on the board. Returns the new board and the tile it grew on, or null if
 * it couldn't.
 */
export function spreadMould(board: Board): { board: Board; at: Cell & Tile } | null {
  const mouldy = board.flatMap((row, r) => row.flatMap((t, c) => (t.mould ? [{ row: r, col: c }] : [])));
  if (mouldy.length === 0) return null;
  const spots = mouldy.flatMap((m) => neighbours(m).filter((c) => !stuck(board[c.row][c.col]) && !special(board[c.row][c.col])));
  for (let attempt = 0; attempt < 8 && spots.length > 0; attempt++) {
    const i = Math.floor(Math.random() * spots.length);
    const at = spots[i];
    const next = board.map((row) => [...row]);
    next[at.row][at.col] = { ...board[at.row][at.col], mould: true };
    if (validMoves(next).length > 0) return { board: next, at: { ...at, ...next[at.row][at.col] } };
    spots.splice(i, 1);
  }
  return null;
}

/**
 * The witch's curse: one random plain tile (not held, not a special) turns into a toad, leaving a
 * move on the board, while fewer than `max` toads are on it. Returns the new board and the tile, or
 * null if it couldn't.
 */
export function turnToad(board: Board, max: number): { board: Board; at: Cell & Tile } | null {
  if (board.flat().filter((t) => t.toad).length >= max) return null;
  const spots = board.flatMap((row, r) => row.flatMap((t, c) => (stuck(t) || special(t) ? [] : [{ row: r, col: c }])));
  for (let attempt = 0; attempt < 8 && spots.length > 0; attempt++) {
    const i = Math.floor(Math.random() * spots.length);
    const at = spots[i];
    const next = board.map((row) => [...row]);
    next[at.row][at.col] = { ...board[at.row][at.col], toad: true };
    if (validMoves(next).length > 0) return { board: next, at: { ...at, ...next[at.row][at.col] } };
    spots.splice(i, 1);
  }
  return null;
}
