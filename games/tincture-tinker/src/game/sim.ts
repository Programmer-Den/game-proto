import type { TextKey } from '../i18n';
import {
  adjacent,
  collapse,
  COLS,
  findRuns,
  findMatches,
  inBoard,
  matchesAt,
  neighbours,
  ROWS,
  shuffle,
  special,
  spreadMould,
  stuck,
  swapped,
  swapWorks,
  turnToad,
  validMoves,
  type Board,
  type Cell,
  type Run,
  type Tile,
} from './board';
import { GUEST_STAR_COINS, TOAD_MAX } from './guests';
import { randomKind, type Kind } from './kinds';
import { MOVE_BONUS, TWIN_BONUS, type PotionId } from './orders';
import { starsFor } from './ranks';
import { drawPantry, filled, firstNeeds, progressOf, startDailyOrder, startEndless, startGuest, startOrder, startTown, startWeeklyOrder, stockPantry, tileMaker, wanted, type GameState } from './state';
import { TOWN_STAR_COINS } from './towns';
import { weeklyStars } from './weekly';

/** One round of a swap's outcome: the tiles matched, then the board once the rest have fallen. */
export interface Step {
  /** Every tile gathered this round: matches, Catalyst rows, Bloom squares and opened jars. */
  cleared: (Cell & Tile)[];
  /** Tiles a match turned into Catalysts (four or more) or Blooms (an L or T); they stay on the board. */
  brewed: (Cell & Tile)[];
  /** Resin-held tiles a match freed, and mouldy tiles a match scrubbed clean; they stay on the board. */
  melted: (Cell & Tile)[];
  scrubbed: (Cell & Tile)[];
  /** The ingredients counted this round: the order's (or stage's) needs at the time. */
  needs: Kind[];
  /** Rows a matched Catalyst (or a Catalyst pair) cleared, and columns a Catalyst pair cleared. */
  rows: number[];
  cols: number[];
  /** The middle of every Bloom that fired: the 3x3 around it was cleared. */
  areas: Cell[];
  /** The middle of a 5x5 two Blooms swapped together cleared. */
  bursts: Cell[];
  /** This round matched the forbidden ingredient, which cost a move. */
  penalty?: boolean;
  board: Board;
  /** The board had no moves left, so its tiles were shuffled. */
  shuffled?: boolean;
  /** Mould crept onto this tile after the move (or, with `toad`, the witch turned it into a toad). */
  spread?: Cell & Tile;
  toad?: boolean;
  /** A royal commission moved on to this stage (from 1): the needs changed and the moves carried over. */
  stage?: number;
  /** A twin order's customer was served this round. */
  served?: PotionId;
}

/** Runs of this length or longer brew a Catalyst. */
export const CATALYST_RUN = 4;

/** Tiles cleared on top of the matches: what two specials swapped together clear, or a tile a Pestle smashed. */
interface Extra {
  cells: Cell[];
  rows?: number[];
  cols?: number[];
  bursts?: Cell[];
  /** Whether a Catalyst or Bloom among `cells` fires. */
  fire: boolean;
}

const rowCells = (row: number): Cell[] => Array.from({ length: COLS }, (_, col) => ({ row, col }));
const colCells = (col: number): Cell[] => Array.from({ length: ROWS }, (_, row) => ({ row, col }));
/** The cells of the square `reach` cells around `c` each way that are on the board. */
const squareCells = (c: Cell, reach: number): Cell[] => {
  const cells: Cell[] = [];
  for (let dr = -reach; dr <= reach; dr++) for (let dc = -reach; dc <= reach; dc++) if (inBoard({ row: c.row + dr, col: c.col + dc })) cells.push({ row: c.row + dr, col: c.col + dc });
  return cells;
};

/**
 * What two specials swapped together clear around `at`, where the moved one lands: two Catalysts
 * its row and column, a Catalyst and a Bloom its row and the rows above and below, two Blooms the
 * 5x5 around it. Undefined unless both tiles are specials.
 */
function mixed(x: Tile, y: Tile, at: Cell): Extra | undefined {
  if (!special(x) || !special(y)) return undefined;
  if (x.catalyst && y.catalyst) return { cells: [...rowCells(at.row), ...colCells(at.col)], rows: [at.row], cols: [at.col], fire: false };
  if (x.bloom && y.bloom) return { cells: squareCells(at, 2), bursts: [at], fire: false };
  const rows = [at.row - 1, at.row, at.row + 1].filter((row) => row >= 0 && row < ROWS);
  return { cells: rows.flatMap(rowCells), rows, fire: false };
}

/**
 * Swaps two neighbouring tiles. A swap that makes no match doesn't count and returns null; one that
 * does spends a move, gathers every match and the cascades after it, and returns them step by step.
 * Two specials swapped together clear more of the board (see `mixed`).
 */
export function trySwap(s: GameState, a: Cell, b: Cell): Step[] | null {
  if (s.phase !== 'play' || !adjacent(a, b) || !swapWorks(s.board, a, b)) return null;
  s.moves--;
  const extra = mixed(s.board[a.row][a.col], s.board[b.row][b.col], b);
  // On the swap's own match a Catalyst is brewed where the player moved a tile to, if it can be.
  const steps = resolve(s, swapped(s.board, a, b), [b, a], extra, true);
  // Mould creeps to a neighbour after every move, unless a match touched some this move.
  if (s.phase === 'play' && !steps.some((st) => st.scrubbed.length > 0)) {
    const grown = spreadMould(s.board);
    if (grown) {
      s.board = grown.board;
      steps.push({ ...emptyStep(s), board: grown.board, spread: grown.at });
    }
  }
  // A town's witch turns a tile into a toad after every move.
  if (s.phase === 'play' && s.current.guest?.rule === 'witch') {
    const cursed = turnToad(s.board, TOAD_MAX);
    if (cursed) {
      s.board = cursed.board;
      s.toads++;
      steps.push({ ...emptyStep(s), board: cursed.board, spread: cursed.at, toad: true });
    }
  }
  return steps;
}

const emptyStep = (s: GameState): Step => ({
  cleared: [],
  brewed: [],
  melted: [],
  scrubbed: [],
  needs: Object.keys(s.current.needs) as Kind[],
  rows: [],
  cols: [],
  areas: [],
  bursts: [],
  board: s.board,
});

/**
 * Plays `board` out: gathers its matches (and `extra`) and every cascade after them, shuffles the
 * board if no move is left, then sells the order once it is filled or fails it when the moves are gone.
 * With `charge` (a swap), a match of the forbidden ingredient in the swap's own step costs a move;
 * cascades and tools never do.
 */
function resolve(s: GameState, board: Board, prefer: Cell[], extra?: Extra, charge = false): Step[] {
  const newTile = tileMaker(s);
  const steps: Step[] = [];
  let penalty = false;
  for (let step = gather(s, board, prefer, 0, extra); step; step = gather(s, board, [], steps.length)) {
    if (!charge || steps.length > 0) step.penalty = false;
    penalty ||= !!step.penalty;
    board = collapse(step.board, step.cleared, newTile);
    steps.push({ ...step, board });
  }
  if (penalty) {
    s.moves = Math.max(0, s.moves - 1);
    s.penalties++;
  }
  if (validMoves(board).length === 0) {
    board = shuffle(board, newTile);
    steps.push({ ...emptyStep(s), board, shuffled: true });
  }
  s.board = board;

  // On a twin order, the customer whose needs are met first is served, with a bonus for speed.
  if (s.current.second) {
    for (const [potion, needs] of [[s.current.potion, firstNeeds(s.current)], [s.current.second.potion, s.current.second.needs]] as const) {
      if (s.served.includes(potion) || !filled(s, needs)) continue;
      s.served.push(potion);
      // The bonus is paid with the sale, so a failed order banks nothing.
      if (!filled(s)) s.speedBonus = TWIN_BONUS;
      steps.push({ ...emptyStep(s), served: potion });
    }
  }
  // A royal commission moves on to its next stage, the moves carried over; the pantry chips in.
  const stages = s.current.stages;
  while (stages && s.stage < stages.length - 1 && filled(s)) {
    stockPantry(s);
    s.stage++;
    s.current = { ...s.current, potion: stages[s.stage].potion, needs: stages[s.stage].needs };
    for (const kind of Object.keys(s.got) as Kind[]) s.got[kind] = 0;
    drawPantry(s);
    steps.push({ ...emptyStep(s), stage: s.stage });
  }

  if (s.current.weekly) {
    // The weekly order never sells: once its moves are played out, the score is what it earned.
    if (s.moves === 0) {
      s.phase = 'sold';
      s.orderStars = weeklyStars(s.score);
    }
  } else if (filled(s) && s.current.guest) {
    // A town's guest pays only for the stars they hadn't given before, and keeps the best.
    s.phase = 'sold';
    s.orderStars = starsFor(s.moves);
    const { index } = s.current.guest;
    const best = s.guests[index] ?? 0;
    s.earned = Math.max(0, s.orderStars - best) * GUEST_STAR_COINS;
    s.guests[index] = Math.max(best, s.orderStars);
    s.coins += s.earned;
  } else if (filled(s) && s.current.exam) {
    // A guild examination pays, and earns its seal, only when sold with the stars it asks for. It
    // leaves the orders, the stars and the pantry as they were.
    s.phase = 'sold';
    s.orderStars = starsFor(s.moves);
    s.passed = s.orderStars >= s.current.exam.stars;
    s.earned = s.passed ? s.current.price + s.moves * MOVE_BONUS : 0;
    s.coins += s.earned;
    if (s.passed) s.seals++;
  } else if (filled(s) && (s.current.town || s.current.endless || s.current.daily)) {
    // A town, an endless run's order or the daily: it pays, and leaves the orders, the stars and the
    // pantry as they were. A town pays only for the stars it hadn't given before, and keeps the best.
    s.phase = 'sold';
    s.orderStars = starsFor(s.moves);
    const town = s.current.town;
    if (town) {
      const best = s.towns[town.index] ?? 0;
      s.earned = Math.max(0, s.orderStars - best) * TOWN_STAR_COINS;
      s.towns[town.index] = Math.max(best, s.orderStars);
    } else {
      s.earned = s.current.price + s.moves * MOVE_BONUS;
    }
    if (s.current.endless) s.endless = Math.max(s.endless, s.current.endless);
    s.coins += s.earned;
  } else if (filled(s)) {
    stockPantry(s);
    s.phase = 'sold';
    s.earned = s.current.price + s.moves * MOVE_BONUS;
    s.coins += s.earned + s.speedBonus;
    s.orderStars = starsFor(s.moves);
    s.stars += s.orderStars;
    s.sold++;
    s.order++;
    // A rich pick is for one order: the next one is modest until the result card picks again.
    s.rich = false;
    if (s.current.last) s.royal = true;
  } else if (s.moves === 0) {
    s.phase = 'failed';
  }
  return steps;
}

/**
 * The matches on `board` (and `extra`), if any: what they gather, with the whole row of every
 * matched Catalyst, the 3x3 around every matched Bloom and the jars beside them, the Catalysts and
 * Blooms they brew and the resin they melt. `board` in the result has the brewed and melted tiles
 * changed but the cleared ones still in place. `depth` is the round's place in the move: 0 for the
 * swap's (or tool's) own match, then 1, 2... for the cascades after it.
 */
function gather(s: GameState, board: Board, prefer: Cell[], depth: number, extra?: Extra): Step | null {
  const runs = findRuns(board);
  if (runs.length === 0 && !extra) return null;
  const key = (c: Cell) => c.row * COLS + c.col;
  const cell = (i: number): Cell => ({ row: Math.floor(i / COLS), col: i % COLS });
  const tile = (i: number) => board[Math.floor(i / COLS)][i % COLS];
  const hit = new Set<number>();
  for (const run of runs) for (const c of run.cells) hit.add(key(c));
  // Matched specials fire: a Catalyst clears its row, a Bloom the 3x3 around it.
  const firing = new Set(hit);
  if (extra?.fire) for (const c of extra.cells) firing.add(key(c));
  const swept = new Set<number>();
  for (const c of extra?.cells ?? []) swept.add(key(c));
  const rows = [...new Set([...firing].filter((i) => tile(i).catalyst).map((i) => cell(i).row))];
  // Potent Catalysts (a workbench upgrade) clear their column as well.
  const cols = s.upgrades.catalyst > 0 ? [...new Set([...firing].filter((i) => tile(i).catalyst).map((i) => cell(i).col))] : [];
  const areas = [...firing].filter((i) => tile(i).bloom).map(cell);
  for (const row of rows) for (const c of rowCells(row)) swept.add(key(c));
  for (const col of cols) for (const c of colCells(col)) swept.add(key(c));
  for (const a of areas) {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (inBoard({ row: a.row + dr, col: a.col + dc })) swept.add(key({ row: a.row + dr, col: a.col + dc }));
  }
  for (const i of swept) hit.add(i);
  // A town's walls are never gathered: a swept row or square passes over them.
  for (const i of [...hit]) if (tile(i).hole) hit.delete(i);
  // Only the Catalysts that fired count, not ones another special swept up.
  s.fired += [...firing].filter((i) => tile(i).catalyst).length;
  s.bloomsFired += areas.length;

  // An L or T of one kind leaves a Bloom where its lines cross; a run of four or more, a Catalyst.
  const next = board.map((row) => [...row]);
  const brewed: (Cell & Tile)[] = [];
  const free = (c: Cell) => hit.has(key(c)) && !swept.has(key(c)) && !special(board[c.row][c.col]) && !stuck(board[c.row][c.col]);
  const brew = (c: Cell, mark: 'catalyst' | 'bloom') => {
    hit.delete(key(c));
    next[c.row][c.col] = { ...board[c.row][c.col], [mark]: true };
    brewed.push({ ...c, ...next[c.row][c.col] });
  };
  const across = (r: Run) => r.cells[0].row === r.cells[1].row;
  const used = new Set<Run>();
  for (const h of runs.filter(across)) {
    for (const v of runs.filter((r) => !across(r) && r.kind === h.kind)) {
      const at = h.cells.find((c) => v.cells.some((d) => key(d) === key(c)));
      if (!at || used.has(h) || used.has(v) || !free(at)) continue;
      brew(at, 'bloom');
      used.add(h).add(v);
    }
  }
  for (const run of runs) {
    if (run.cells.length < CATALYST_RUN || used.has(run)) continue;
    const spots = run.cells.filter(free);
    const at = spots.find((c) => prefer.some((p) => key(p) === key(c))) ?? spots[Math.floor((spots.length - 1) / 2)];
    if (at) brew(at, 'catalyst');
  }
  s.brewed += brewed.filter((t) => t.catalyst).length;
  s.bloomed += brewed.filter((t) => t.bloom).length;

  // Resin melts instead of its tile being gathered; the tile stays where it is.
  const melted: (Cell & Tile)[] = [];
  for (const i of [...hit]) {
    if (!tile(i).resin) continue;
    hit.delete(i);
    next[cell(i).row][cell(i).col] = { ...tile(i), resin: false };
    melted.push({ ...cell(i), ...next[cell(i).row][cell(i).col] });
  }
  s.melted += melted.length;

  // Mould is scrubbed off instead of its tile being gathered, whether hit or next to a match; a toad turns back the same way.
  const touched = new Set([...hit, ...brewed.map(key), ...melted.map(key)]);
  const scrubbed: (Cell & Tile)[] = [];
  const near = (i: number) => neighbours(cell(i));
  for (let i = 0; i < ROWS * COLS; i++) {
    if (!(tile(i).mould || tile(i).toad) || !(hit.has(i) || near(i).some((c) => touched.has(key(c))))) continue;
    hit.delete(i);
    next[cell(i).row][cell(i).col] = { ...tile(i), mould: false, toad: false };
    scrubbed.push({ ...cell(i), ...next[cell(i).row][cell(i).col] });
  }
  s.scrubbed += scrubbed.length;

  // A match next to a corked jar opens it, and its ingredient is gathered too.
  for (let i = 0; i < ROWS * COLS; i++) {
    if (!tile(i).jar || hit.has(i)) continue;
    if (near(i).some((c) => touched.has(key(c)))) hit.add(i);
  }
  s.opened += [...hit].filter((i) => tile(i).jar).length;

  const cleared = [...hit].sort((x, y) => x - y).map((i) => ({ ...cell(i), ...tile(i) }));
  // Only the ingredients the order asks for are counted, and for a town's miser only what a cascade gathers.
  const pays = !(s.current.guest?.rule === 'miser' && depth === 0);
  let count = 0;
  if (pays) for (const { kind } of cleared) if (wanted(s, kind)) (s.got[kind]++, count++);
  // The weekly order's score: each cascade step counts its ingredients once more than the one before.
  if (s.current.weekly) s.score += count * (depth + 1);
  const penalty = !!s.current.forbid && runs.some((r) => r.kind === s.current.forbid);
  return {
    cleared,
    brewed,
    melted,
    scrubbed,
    needs: pays ? (Object.keys(s.current.needs) as Kind[]) : [],
    rows: [...new Set([...rows, ...(extra?.rows ?? [])])],
    cols: [...new Set([...cols, ...(extra?.cols ?? [])])],
    areas,
    bursts: extra?.bursts ?? [],
    penalty,
    board: next,
  };
}

// ---- Bench tools: coins spent during an order ----

export type Tool = 'stir' | 'sift' | 'pestle' | 'funnel';
/** Stir buys moves, Sift rerolls one row, Pestle smashes one tile and Funnel swaps any two. Name and tip are keys of `i18n/en.ts`. */
export const TOOLS: Record<Tool, { cost: number; name: TextKey; tip: TextKey }> = {
  stir: { cost: 40, name: 'stirName', tip: 'stirTip' },
  sift: { cost: 25, name: 'siftName', tip: 'siftTip' },
  pestle: { cost: 30, name: 'pestleName', tip: 'pestleTip' },
  funnel: { cost: 35, name: 'funnelName', tip: 'funnelTip' },
};
export const TOOL_ORDER: Tool[] = ['stir', 'sift', 'pestle', 'funnel'];
export const STIR_MOVES = 3;

/** A tool can be used while an order is played and its price is in hand, but never on the weekly order (its scores stay fair). */
export const canUse = (s: GameState, tool: Tool) => s.phase === 'play' && s.coins >= TOOLS[tool].cost && !s.current.weekly;

/** Stir: three more moves for this order. False if it can't be bought. */
export function stir(s: GameState): boolean {
  if (!canUse(s, 'stir')) return false;
  s.coins -= TOOLS.stir.cost;
  s.moves += STIR_MOVES;
  return true;
}

/**
 * Sift: every tile in `row` but its specials, jars, resin and mould is replaced by a new one, with no match
 * made and a move left on the board. Returns the tiles taken out, or null if it can't be bought or the row
 * has nothing to reroll.
 */
export function sift(s: GameState, row: number): Tile[] | null {
  if (!canUse(s, 'sift') || row < 0 || row >= s.board.length) return null;
  const newTile = tileMaker(s);
  const keep = (t: Tile) => special(t) || stuck(t);
  const old = s.board[row].filter((t) => !keep(t));
  // A row of nothing but kept tiles can't change, so it costs nothing.
  if (old.length === 0) return null;
  let next: Board = s.board;
  for (let attempt = 0; attempt < 30; attempt++) {
    next = s.board.map((r) => [...r]);
    for (let col = 0; col < COLS; col++) {
      if (keep(s.board[row][col])) continue;
      next[row][col] = newTile();
      for (let k = 0; k < 8 && matchesAt(next, { row, col }); k++) next[row][col] = { ...next[row][col], kind: randomKind() };
    }
    if (findMatches(next).length === 0 && validMoves(next).length > 0) break;
  }
  if (findMatches(next).length > 0 || validMoves(next).length === 0) next = shuffle(next, newTile);
  s.coins -= TOOLS.sift.cost;
  s.board = next;
  return old;
}

/**
 * Pestle: smashes the tile at `cell` without spending a move. It is gathered (a jar opens, resin only
 * melts, a Catalyst or Bloom fires) and the board plays out. Null if it can't be bought.
 */
export function pestle(s: GameState, cell: Cell): Step[] | null {
  if (!canUse(s, 'pestle') || !inBoard(cell) || s.board[cell.row][cell.col].hole) return null;
  s.coins -= TOOLS.pestle.cost;
  return resolve(s, s.board, [], { cells: [cell], fire: true });
}

/**
 * Funnel: swaps any two tiles that aren't held by a jar, resin or mould, without spending a move, and
 * plays out whatever they match; two specials go off together as in a swap (see `mixed`). Null if it
 * can't be bought, the tiles can't move or swapping them would change nothing.
 */
export function funnel(s: GameState, a: Cell, b: Cell): Step[] | null {
  if (!canUse(s, 'funnel') || !inBoard(a) || !inBoard(b) || (a.row === b.row && a.col === b.col)) return null;
  const ta = s.board[a.row][a.col];
  const tb = s.board[b.row][b.col];
  if (stuck(ta) || stuck(tb)) return null;
  // Two plain tiles of one kind would only trade places.
  if (!special(ta) && !special(tb) && ta.kind === tb.kind) return null;
  s.coins -= TOOLS.funnel.cost;
  const extra = mixed(ta, tb, b);
  // The tiles may be far apart, so the special left at `a` is used up too, not only the one at `b`.
  if (extra) extra.cells.push(a);
  return resolve(s, swapped(s.board, a, b), [b, a], extra);
}

/** After a sale, the next order; after running out of moves, the same order again. After an examination, back to the orders. */
export const nextOrder = (s: GameState) => startOrder(progressOf(s));
/** The next guild examination (the same one again after a failed try). */
export const nextExam = (s: GameState) => startOrder(progressOf(s), true);
/** Town `index` of the journey map (the same board again on a second try). */
export const nextTown = (s: GameState, index: number) => startTown(progressOf(s), index);
/** Order `step` of an endless run: 1 starts a new run. */
export const nextEndless = (s: GameState, step: number) => startEndless(progressOf(s), step);
/** The daily order for `day`. */
export const nextDaily = (s: GameState, day: string) => startDailyOrder(progressOf(s), day);
/** Town `index`'s guest (the same board again on a second try). */
export const nextGuest = (s: GameState, index: number) => startGuest(progressOf(s), index);
/** The weekly order for `week` (the same board and tiles on every try). */
export const nextWeekly = (s: GameState, week: string) => startWeeklyOrder(progressOf(s), week);
