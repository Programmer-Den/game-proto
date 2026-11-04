import { byDifficulty } from '../../../../shared/settings';
import { joinedCount, type Owns } from './castle';
import { DECREE_BONUS, decreeFor, decreeMarks, type Decree } from './decree';
import { GIFT_INFO, giftsFor, newSpecial, type Gift } from './gifts';
import { PUZZLES, puzzleStars, type Kingdom, type Mode } from './islands';
import { omenFor, strike, type Omen, type Struck } from './omens';
import { seasonBonus, seasonFor, type Season } from './seasons';
import {
  AROUND,
  BUILDINGS,
  SIDES,
  SPECIALS,
  WONDER_AROUND,
  WONDER_CELLS,
  isBuilding,
  isHome,
  isWonder,
  nativeFor,
  nextIsland,
  randomIsland,
  scores,
  seaSides,
  seeded,
  startingGrid,
  wonderAnchor,
  wonderFor,
  type Building,
  type Cell,
  type Native,
  type Special,
  type Wonder,
} from './tiles';

// The rules in plain TypeScript, with no Phaser. The score is the whole board's score plus the
// bonuses won (decrees and seasons): each building's points depend on its neighbours, so a
// placement can also raise the buildings next to it. Each turn draws HAND tiles from the pouch;
// one is placed and the others go back.

export type Pouch = Record<Building, number>;

/**
 * The rival lord sharing the island (mode 'rival'): after each of the player's placements, clearings
 * and merges it places one tile of its own, drawn from a pouch of its own. Its buildings score
 * against every neighbour, the player's too, and the player's score against its; each side only
 * counts its own buildings, and the castle's chain only runs along a side's own cells.
 */
export interface Rival {
  /** Which cells hold the rival's buildings, by row, then column. */
  cells: boolean[][];
  pouch: Pouch;
  /** How many hands the rival has drawn; with the island, it seeds the next. */
  draws: number;
  /** What the rival's buildings score plus its `bonus`, its castle bonus included once the kingdom is finished. */
  score: number;
  /** What the seasons added for the rival's buildings, as they do for the player's. */
  bonus: number;
  /** The rival's castle bonus, paid at the end like the player's; 0 before. */
  castle: number;
  placed: number;
  /** The rival's last placement, for the board's mark. */
  last: { col: number; row: number; kind: Building } | null;
}

export interface GameState {
  round: number;
  /** The score that ends this round and brings the next round's tiles and a gift. */
  goal: number;
  /** `boardScore(grid)` plus `bonus`. */
  score: number;
  /** Points won from fulfilled decrees and from seasons' doubled buildings. */
  bonus: number;
  /** Tiles left to place, the ones in the hand included. */
  pouch: Pouch;
  /** The tiles drawn from the pouch this turn: one of these is placed next, the rest go back. */
  hand: Building[];
  /** How many hands have been drawn; with the island, it seeds the next draw. */
  draws: number;
  /** The building the next tap places, if any; always one in the hand. */
  selected: Building | null;
  /** Which island this kingdom is built on; `islandMap` lays it out. */
  island: number;
  /** How the island was chosen: at random, typed in, the island of the day or a campaign level. */
  mode: Mode;
  /** The campaign level being played (1 and up), or 0 outside the campaign. */
  level: number;
  /** The puzzle island being played (1 and up), or 0 outside the puzzles. */
  puzzle: number;
  /** The wonder this kingdom drew: it joins the pouch as round WONDER_ROUND begins. */
  wonder: Wonder;
  /** The rival lord sharing the island, or null outside mode 'rival'. */
  rival: Rival | null;
  /** The island of the day's date (YYYY-MM-DD), or '' for any other kingdom. */
  day: string;
  /** The board by row, then column. */
  grid: Cell[][];
  placed: number;
  /** 'gift' while a reached goal's gift waits to be chosen; nothing can be placed then. */
  phase: 'playing' | 'gift' | 'over';
  /** The best final score of any finished game, saved in the browser. */
  best: number;
  /** Crowns won from decrees, in every kingdom so far; saved in the browser. */
  crowns: number;
  /** This round's royal decree, or null when no side goal fits the board. */
  decree: Decree | null;
  /** The two gifts on offer for reaching `goal` (or, in the 'gift' phase, the goal just reached). */
  gifts: [Gift, Gift];
  /** Gifts still to choose: one per goal reached. */
  giftsDue: number;
  /** The gift buildings won so far, in the order they were won. */
  unlocked: Special[];
  /** The omen for the next round, from round OMEN_FROM on, or null. */
  omen: Omen | null;
  /** The round in which a market trade was last made; 0 for none. One trade per round. */
  tradedIn: number;
  /** The castle bonus paid when the kingdom was finished: one point per building joined to the castle. 0 before. */
  castle: number;
  /** Which island of a chain this is: 1 for a kingdom of its own (or a chain's first), 2 and up for the islands sailed on to. */
  link: number;
  /** The building found only on this chain island (from link 2), or null. */
  native: Native | null;
  /** The final scores of the chain's islands before this one; 0 on a first island. */
  chainScore: number;
  /** How many tiles the last island's harbours shipped here as cargo; 0 on a first island. */
  cargo: number;
  /** The trade bonus paid when a chain island was finished: TRADE_BONUS per harbour. 0 before. */
  trade: number;
  /** The board as it was before the last placement, if that placement can be undone. */
  undo: Snapshot | null;
  /** The round in which the undo was last used; 0 if none yet. One undo per round. */
  undoneIn: number;
}

/** What `undo` puts back: everything a placement or merge changes, as it stood before it. */
export interface Snapshot {
  grid: Cell[][];
  pouch: Pouch;
  hand: Building[];
  draws: number;
  score: number;
  bonus: number;
  selected: Building | null;
  placed: number;
  rival: Rival | null;
}

/** The first round's tiles. */
export const FIRST_POUCH: Pouch = { farm: 4, house: 4, tower: 2, windmill: 0, market: 0, harbor: 0, lumber: 0, temple: 0, lighthouse: 0, orchard: 0, cathedral: 0, granary: 0, gardens: 0, road: 1 };
/** The tiles each later round adds to whatever is left. */
export const ROUND_POUCH: Pouch = { farm: 3, house: 3, tower: 2, windmill: 0, market: 0, harbor: 0, lumber: 0, temple: 0, lighthouse: 0, orchard: 0, cathedral: 0, granary: 0, gardens: 0, road: 1 };
/** The round whose start puts the kingdom's wonder in the pouch. */
export const WONDER_ROUND = 3;
/** What a wonder is worth on its own, before what stands around it. */
export const WONDER_BASE = 4;
/** What each wonder scores per cell around it. */
const WONDER_COUNT: Record<Wonder, (c: Cell) => number> = {
  cathedral: (c) => (isHome(c) ? 3 : 0),
  granary: (c) => (c === 'farm' ? 2 : c === 'windmill' ? 3 : 0),
  gardens: (c) => (c === 'lake' || c === 'forest' ? 2 : c === 'temple' ? 3 : 0),
};
/**
 * How much the rival lord weighs the points its placement takes from the player against its own:
 * none on Easy (it only builds its own), half on Normal, as much as its own on Hard.
 */
const rivalSpite = () => byDifficulty(0, 0.5, 1);
/** How many tiles the rival lord draws each turn to pick one from. */
const RIVAL_HAND = 4;
/** How much the rival weighs a building more joined to the castle (each pays +1 at the end). */
const RIVAL_JOIN = 1;
/** A chain island's own building: how many its first pouch holds, and how many each later round adds. */
export const NATIVE_FIRST = 2;
export const NATIVE_ROUND = 1;
/** On a chain island, each harbour pays this at the end: trade with the islands behind it. */
export const TRADE_BONUS = 2;
/** The most cargo tiles the last island's harbours ship to the next one (one per harbour). */
export const CARGO_MAX = 4;
/** What a temple is worth at most: one per cell between it and the nearest tower. */
export const TEMPLE_MAX = 4;
/** How many tiles a turn draws from the pouch. */
export const HAND = 3;
/** A market trade gives this many tiles of one kind for one gift building. */
export const TRADE_GIVE = 2;

/**
 * The score that ends round `round`: 20, 45, 75, 110, ... (each round asks 5 more than the last),
 * a fifth lower on Easy and a fifth higher on Hard.
 */
export const goalFor = (round: number) => Math.round(((5 * round * round + 35 * round) / 2) * byDifficulty(0.8, 1, 1.2));

/** The season of the round being played. */
export const season = (s: GameState): Season => seasonFor(s.round);

/** A new kingdom on island `island` (a random one unless given), chosen as `kingdom` says. */
export function newGame(best = 0, crowns = 0, island = randomIsland(), kingdom: Kingdom = { mode: 'random' }): GameState {
  const link = kingdom.link ?? 1;
  const grid = startingGrid(island, link);
  const native = nativeFor(link);
  const puzzle = kingdom.mode === 'puzzle' ? (kingdom.puzzle ?? 1) : 0;
  const pouch = puzzle ? emptyPouch() : { ...FIRST_POUCH };
  if (puzzle) for (const b of BUILDINGS) pouch[b] = PUZZLES[puzzle - 1].pouch[b] ?? 0;
  if (native) pouch[native] += NATIVE_FIRST;
  let cargo = 0;
  for (const b of BUILDINGS) {
    pouch[b] += kingdom.cargo?.[b] ?? 0;
    cargo += kingdom.cargo?.[b] ?? 0;
  }
  const rival: Rival | null =
    kingdom.mode === 'rival' ? { cells: grid.map((cells) => cells.map(() => false)), pouch: { ...FIRST_POUCH }, draws: 0, score: 0, bonus: 0, castle: 0, placed: 0, last: null } : null;
  const s: GameState = {
    round: 1,
    goal: puzzle ? puzzleStars(puzzle)[2] : goalFor(1),
    score: 0,
    bonus: 0,
    pouch,
    hand: [],
    draws: 0,
    selected: null,
    island,
    mode: kingdom.mode,
    level: kingdom.level ?? 0,
    puzzle,
    wonder: wonderFor(island),
    rival,
    day: kingdom.day ?? '',
    grid,
    placed: 0,
    phase: 'playing',
    best,
    crowns,
    decree: puzzle ? null : decreeFor(island, 1, grid, pouch),
    gifts: giftsFor(island, 1, []),
    giftsDue: 0,
    unlocked: puzzle ? SPECIALS.filter((b) => pouch[b] > 0) : [],
    omen: null,
    tradedIn: 0,
    castle: 0,
    link,
    native,
    chainScore: kingdom.chainScore ?? 0,
    cargo,
    trade: 0,
    undo: null,
    undoneIn: 0,
  };
  drawHand(s);
  return s;
}

/** A pouch with no tiles. */
const emptyPouch = () => Object.fromEntries(BUILDINGS.map((b) => [b, 0])) as Pouch;

/**
 * Whether `kind` could go at (col, row) on `grid`, whatever the phase: on grass, a harbor by a lake
 * or the sea, a lighthouse on the coast, a lumber camp by a forest, a wonder with (col, row) as the
 * top left of four grass cells.
 */
function fits(grid: Cell[][], col: number, row: number, kind: Building) {
  if (grid[row]?.[col] !== 'grass') return false;
  if (isWonder(kind)) return WONDER_CELLS.every(([dc, dr]) => grid[row + dr]?.[col + dc] === 'grass');
  if (kind === 'harbor') return beside(grid, col, row, 'lake') || seaSides(grid, col, row) > 0;
  if (kind === 'lighthouse') return seaSides(grid, col, row) > 0;
  if (kind === 'lumber') return beside(grid, col, row, 'forest');
  return true;
}

const fitsAnywhere = (grid: Cell[][], kind: Building) => grid.some((cells, row) => cells.some((_, col) => fits(grid, col, row, kind)));

/** Whether some wood stands beside a lumber camp, so a lumber camp tile could clear it, whatever the phase. */
const woodClearable = (grid: Cell[][]) => grid.some((cells, row) => cells.some((cell, col) => cell === 'forest' && beside(grid, col, row, 'lumber')));

/** Whether a tile of `kind` has a use on `grid`: a cell to go on, or for a lumber camp, a wood to clear. */
const playable = (grid: Cell[][], kind: Building) => fitsAnywhere(grid, kind) || (kind === 'lumber' && woodClearable(grid));

/** Whether any tile left in the pouch has a use on `grid` (see `playable`). */
const pouchPlayable = (s: GameState) => BUILDINGS.some((b) => s.pouch[b] > 0 && playable(s.grid, b));

/**
 * Draws the next hand: HAND tiles from the pouch, seeded by the island and the number of draws so
 * far, so a kingdom's hands never touch Math.random and an undone placement redraws the same hand.
 * When no drawn tile has room (or a wood to clear) but one in the pouch has, the first is swapped for one that has.
 */
function drawHand(s: GameState) {
  const rand = seeded(s.island * 7 + s.draws * 48271 + 11);
  s.draws++;
  const bag = BUILDINGS.flatMap((b) => Array<Building>(s.pouch[b]).fill(b));
  const hand: Building[] = [];
  while (hand.length < HAND && bag.length) hand.push(bag.splice(Math.floor(rand() * bag.length), 1)[0]);
  if (hand.length && !hand.some((b) => playable(s.grid, b))) {
    const fitting = BUILDINGS.filter((b) => s.pouch[b] > 0 && playable(s.grid, b));
    if (fitting.length) hand[0] = fitting[Math.floor(rand() * fitting.length)];
  }
  s.hand = hand.sort((a, b) => BUILDINGS.indexOf(a) - BUILDINGS.indexOf(b));
  if (s.selected && !s.hand.includes(s.selected)) s.selected = s.hand[0] ?? null;
}

/**
 * Redraws the hand when none of it has room but a tile in the pouch has: a merge frees a cell
 * and a gift adds tiles without a new hand, and either can leave the hand stuck while `finish`
 * still refuses. A hand that has room is kept, so a merge is never a free redraw.
 */
function keepHandPlayable(s: GameState) {
  if (s.phase === 'playing' && !s.hand.some((b) => playable(s.grid, b)) && pouchPlayable(s)) drawHand(s);
}

/** Whether a tile of `kind` is in the hand, ready to place. */
export const inHand = (s: GameState, kind: Building) => s.hand.includes(kind);

/** One neighbour's share of a building's points. */
export interface Share {
  col: number;
  row: number;
  pts: number;
}

/**
 * What the building at (col, row) is worth, split into a base and each neighbour's share; empty
 * for land. `cellScore` is their sum, so the hover's neighbour links always add up.
 */
export function cellParts(grid: Cell[][], col: number, row: number): { base: number; from: Share[] } {
  const cell = grid[row][col];
  const from: Share[] = [];
  /** Adds `pts` from each cell in `dirs` that `count` accepts. */
  const add = (dirs: readonly (readonly [number, number])[], count: (c: Cell) => number) => {
    for (const [dc, dr] of dirs) {
      const c = grid[row + dr]?.[col + dc];
      const pts = c === undefined ? 0 : count(c);
      if (pts) from.push({ col: col + dc, row: row + dr, pts });
    }
  };
  if (isWonder(cell)) {
    // A wonder's four cells share one building: its top left cell scores what stands around all of them.
    if (!wonderAnchor(grid, col, row)) return { base: 0, from };
    add(WONDER_AROUND, WONDER_COUNT[cell]);
    return { base: WONDER_BASE, from };
  }
  switch (cell) {
    case 'farm':
      add(SIDES, (c) => (c === 'lake' || c === 'windmill' ? 1 : 0));
      return { base: 1, from };
    case 'house':
      add(SIDES, (c) => (c === 'farm' ? 2 : isHome(c) || c === 'forest' || c === 'lumber' ? 1 : 0));
      return { base: 0, from };
    case 'manor':
      add(SIDES, (c) => (c === 'farm' ? 3 : isHome(c) || c === 'forest' ? 1 : 0));
      return { base: 4, from };
    case 'tower':
      if (SIDES.some(([dc, dr]) => grid[row + dr]?.[col + dc] === 'tower')) return { base: 0, from };
      add(AROUND, (c) => (isHome(c) ? 2 : 0));
      return { base: 0, from };
    case 'windmill':
      add(AROUND, (c) => (c === 'farm' ? 1 : 0));
      return { base: 0, from };
    case 'market': {
      // +1 for each kind of building around it, credited to the first one of that kind.
      const seen = new Set<Cell>();
      add(AROUND, (c) => (scores(c) && !seen.has(c) ? (seen.add(c), 1) : 0));
      return { base: 0, from };
    }
    case 'harbor':
      // The sea scores in the base: its sides are off the board, or sea cells with no building.
      add(SIDES, (c) => (c === 'lake' ? 2 : isHome(c) ? 1 : 0));
      return { base: seaSides(grid, col, row), from };
    case 'lighthouse':
      add(AROUND, (c) => (c === 'harbor' ? 2 : 0));
      return { base: seaSides(grid, col, row), from };
    case 'orchard':
      add(AROUND, (c) => (c === 'farm' || c === 'forest' || c === 'windmill' ? 1 : 0));
      return { base: 0, from };
    case 'temple':
      // A quiet place: its worth is its distance from the nearest tower, so it all sits in the base.
      return { base: templeWorth(grid, col, row), from };
    case 'lumber':
      add(SIDES, (c) => (c === 'forest' ? 2 : 0));
      return { base: 0, from };
    default:
      return { base: 0, from };
  }
}

/**
 * What a temple at (col, row) is worth: one per cell between it and the nearest tower (counting
 * diagonal steps as one), up to TEMPLE_MAX, which it is also worth with no tower on the island.
 */
export function templeWorth(grid: Cell[][], col: number, row: number) {
  let near = TEMPLE_MAX + 1;
  grid.forEach((cells, r) => cells.forEach((cell, c) => cell === 'tower' && (near = Math.min(near, Math.max(Math.abs(c - col), Math.abs(r - row))))));
  return Math.min(TEMPLE_MAX, near - 1);
}

/** What the building at (col, row) is worth where it stands; 0 for land. */
export function cellScore(grid: Cell[][], col: number, row: number) {
  const { base, from } = cellParts(grid, col, row);
  return from.reduce((t, s) => t + s.pts, base);
}

/** What the buildings on `grid` score; with `owns`, only one side's (see `Rival`). */
export function boardScore(grid: Cell[][], owns?: Owns) {
  let total = 0;
  grid.forEach((cells, row) => cells.forEach((_, col) => (!owns || owns(col, row)) && (total += cellScore(grid, col, row))));
  return total;
}

/** The player's own cells while a rival lord shares the island; undefined (every cell) otherwise. */
export const mine = (s: GameState): Owns | undefined => (s.rival ? (col, row) => !s.rival!.cells[row][col] : undefined);
/** The rival lord's cells. */
const theirs = (r: Rival): Owns => (col, row) => r.cells[row][col];
/** Whether the cell at (col, row) is the rival lord's. */
export const rivalAt = (s: GameState, col: number, row: number) => !!s.rival?.cells[row]?.[col];

/**
 * The board as the player's decrees, merges and feats see it: with a rival lord, its buildings are
 * left out (shown as open water, which none of them count). Without one, the board itself.
 */
export const ownGrid = (s: GameState): Cell[][] => (s.rival ? s.grid.map((cells, r) => cells.map((cell, c) => (s.rival!.cells[r][c] ? 'sea' : cell))) : s.grid);

/** Puts `kind` on `grid` at (col, row): one cell, or a wonder's four. */
function build(grid: Cell[][], col: number, row: number, kind: Building) {
  if (isWonder(kind)) for (const [dc, dr] of WONDER_CELLS) grid[row + dr][col + dc] = kind;
  else grid[row][col] = kind;
}

/** What the season adds for placing `kind` worth `pts`: nothing on a puzzle island, which has no seasons. */
const seasonal = (s: GameState, kind: Building, pts: number) => (s.puzzle ? 0 : seasonBonus(season(s), kind, pts));

const beside = (grid: Cell[][], col: number, row: number, cell: Cell) => SIDES.some(([dc, dr]) => grid[row + dr]?.[col + dc] === cell);

/**
 * Whether `kind` can go at (col, row): on grass while playing, a harbor only on a lake's shore and
 * a lumber camp only beside a forest. Without a kind, whether anything could go there.
 */
export function canPlace(s: GameState, col: number, row: number, kind: Building | null = null) {
  if (s.phase !== 'playing' || s.grid[row]?.[col] !== 'grass') return false;
  return kind ? fits(s.grid, col, row, kind) : true;
}

/** What placing a building would bring: points in all, its own base, each neighbour's share, the season's bonus and the castle's chain. */
export interface Preview {
  gained: number;
  base: number;
  /** One link per neighbour whose share is not 0: what it adds to the new building plus what it gains itself. */
  links: Share[];
  /** What the season adds for this building, 0 if the season does not double it. */
  season: number;
  /** How many more buildings the castle's chain would reach (the castle bonus at the end grows by this). */
  joins: number;
}

/** What placing `kind` at (col, row) would add to the score, split by neighbour, or null where it can't go or the hand lacks it. */
export function previewPlacement(s: GameState, kind: Building, col: number, row: number): Preview | null {
  if (!canPlace(s, col, row, kind) || !inHand(s, kind)) return null;
  const grid = s.grid.map((cells) => [...cells]);
  build(grid, col, row, kind);
  const owns = mine(s);
  const own = cellParts(grid, col, row);
  const shares = new Map<string, Share>();
  const give = (c: number, r: number, pts: number) => {
    const k = `${c},${r}`;
    const share = shares.get(k) ?? { col: c, row: r, pts: 0 };
    share.pts += pts;
    shares.set(k, share);
  };
  for (const f of own.from) give(f.col, f.row, f.pts);
  // Every other building whose worth changes: the eight around, and a temple further off when a tower goes up near it.
  grid.forEach((cells, r) =>
    cells.forEach((cell, c) => {
      if ((c === col && r === row) || !isBuilding(cell) || (owns && !owns(c, r))) return;
      const change = cellScore(grid, c, r) - cellScore(s.grid, c, r);
      if (change) give(c, r, change);
    }),
  );
  const links = [...shares.values()].filter((l) => l.pts !== 0);
  const bonus = seasonal(s, kind, cellScore(grid, col, row));
  return { gained: boardScore(grid, owns) - boardScore(s.grid, owns) + bonus, base: own.base, links, season: bonus, joins: joinedCount(grid, owns) - joinedCount(s.grid, owns) };
}

export function select(s: GameState, kind: Building) {
  if (s.phase !== 'playing' || !inHand(s, kind)) return false;
  s.selected = kind;
  return true;
}

export interface Placed {
  /** Points gained, in all, the decree's and the season's bonus included. */
  gained: number;
  /** What each building whose worth changed gained (the new one with the season's bonus); a merged-away house shows its loss. */
  changes: { col: number; row: number; gained: number }[];
  /** True when the placement fulfilled the round's decree. */
  decree: boolean;
  /** True when the placement reached the goal: a new round began and a gift waits. */
  newRound: boolean;
  /** What the season added. */
  season: number;
  /** What the pending omen did as the new round began, if it struck. */
  struck: Struck | null;
  /** The rival lord's answer: where it built, what, and what its buildings gained. Null without a rival or when it could not build. */
  rival: { col: number; row: number; kind: Building; gained: number } | null;
}

/** Whether the last placement can be taken back: once per round, and not one that began a round or fulfilled a decree. */
export const canUndo = (s: GameState) => s.phase === 'playing' && s.undo !== null && s.undoneIn !== s.round;

/** Takes back the last placement or merge, once per round. Returns false if that is not allowed now. */
export function undo(s: GameState) {
  if (!s.undo || !canUndo(s)) return false;
  Object.assign(s, s.undo, { undo: null, undoneIn: s.round });
  return true;
}

/** Whether a lumber camp tile in the pouch could clear a wood beside a camp. */
export const canClearAny = (s: GameState) => s.pouch.lumber > 0 && woodClearable(s.grid);

/** Whether any tile left in the pouch has somewhere to go. */
export function anyPlace(s: GameState) {
  return BUILDINGS.some((b) => s.pouch[b] > 0 && s.grid.some((cells, row) => cells.some((_, col) => canPlace(s, col, row, b))));
}

/** How many harbours stand on `grid`: what a chain island's trade pays for, and the cargo the next island gets. */
export const harbourCount = (grid: Cell[][]) => grid.reduce((n, cells) => n + cells.filter((c) => c === 'harbor').length, 0);

/**
 * Finishes the kingdom: the castle pays a point per building its chain reaches, a chain island's
 * harbours pay their trade, and the best score is kept.
 */
function end(s: GameState) {
  s.castle = joinedCount(s.grid, mine(s));
  if (s.rival) {
    s.rival.castle = joinedCount(s.grid, theirs(s.rival));
    s.rival.score = boardScore(s.grid, theirs(s.rival)) + s.rival.bonus + s.rival.castle;
  }
  s.trade = s.link > 1 ? TRADE_BONUS * harbourCount(s.grid) : 0;
  s.bonus += s.castle + s.trade;
  s.score += s.castle + s.trade;
  s.phase = 'over';
  s.best = Math.max(s.best, s.score);
}

/** Ends the kingdom when no tiles are left, or none can go anywhere and no merge or cleared wood would make room. */
function checkEnd(s: GameState) {
  const tilesLeft = BUILDINGS.some((b) => s.pouch[b] > 0);
  if (!tilesLeft || (!pouchPlayable(s) && !housesCanMerge(ownGrid(s)))) end(s);
}

/**
 * Ends the kingdom by the player's choice when no tile has room left but two houses could still
 * merge, or a lumber camp clear a wood, to make some. Returns false while a tile can still be placed.
 */
export function finish(s: GameState) {
  if (s.phase !== 'playing' || anyPlace(s)) return false;
  end(s);
  return true;
}

const snapshot = (s: GameState): Snapshot => ({
  grid: s.grid.map((cells) => [...cells]),
  pouch: { ...s.pouch },
  hand: [...s.hand],
  draws: s.draws,
  score: s.score,
  bonus: s.bonus,
  selected: s.selected,
  placed: s.placed,
  rival: s.rival ? { ...s.rival, cells: s.rival.cells.map((cells) => [...cells]), pouch: { ...s.rival.pouch }, last: s.rival.last && { ...s.rival.last } } : null,
});

/**
 * The rival lord's turn: it draws HAND tiles from its own pouch (seeded by the island and its
 * draws) and places the one, on the cell, that gains it the most, counting the castle joins it
 * would make and, by `rivalSpite`, the points it takes from the player. Its other tiles go back.
 */
function rivalTurn(s: GameState): Placed['rival'] {
  const r = s.rival;
  if (!r) return null;
  const rand = seeded(s.island * 13 + r.draws * 7919 + 5);
  r.draws++;
  const bag = BUILDINGS.flatMap((b) => Array<Building>(r.pouch[b]).fill(b));
  const hand: Building[] = [];
  while (hand.length < RIVAL_HAND && bag.length) hand.push(bag.splice(Math.floor(rand() * bag.length), 1)[0]);
  const owns = theirs(r);
  const my = mine(s);
  const before = boardScore(s.grid, owns);
  const joins = joinedCount(s.grid, owns);
  const mineBefore = boardScore(s.grid, my);
  const spite = rivalSpite();
  let best: { col: number; row: number; kind: Building; value: number } | null = null;
  for (const kind of new Set(hand)) {
    if (isWonder(kind)) continue;
    for (let row = 0; row < s.grid.length; row++)
      for (let col = 0; col < s.grid[row].length; col++) {
        if (!fits(s.grid, col, row, kind)) continue;
        const grid = s.grid.map((c) => [...c]);
        grid[row][col] = kind;
        r.cells[row][col] = true;
        const value =
          boardScore(grid, owns) - before + seasonal(s, kind, cellScore(grid, col, row)) + RIVAL_JOIN * (joinedCount(grid, owns) - joins) + spite * (mineBefore - boardScore(grid, my));
        r.cells[row][col] = false;
        if (!best || value > best.value) best = { col, row, kind, value };
      }
  }
  if (!best) return null;
  const { col, row, kind } = best as { col: number; row: number; kind: Building };
  s.grid[row][col] = kind;
  r.cells[row][col] = true;
  r.pouch[kind]--;
  r.placed++;
  r.last = { col, row, kind };
  const bonus = seasonal(s, kind, cellScore(s.grid, col, row));
  r.bonus += bonus;
  const was = r.score;
  r.score = boardScore(s.grid, owns) + r.bonus;
  return { col, row, kind, gained: r.score - was };
}

/**
 * Settles a change already made to the grid: popups, the season's bonus, the decree, rounds, undo
 * and the end. `prior` is the state before the change and `at` the cell that was built on.
 */
function settle(s: GameState, prior: Snapshot, at: { col: number; row: number }, seasonPts: number): Placed {
  // With a rival lord, it answers before the board is scored, so its building counts for the decree and the goal.
  const rival = rivalTurn(s);
  if (s.rival) s.rival.score = boardScore(s.grid, theirs(s.rival)) + s.rival.bonus;
  const owns = mine(s);
  const changes: Placed['changes'] = [];
  s.grid.forEach((cells, r) =>
    cells.forEach((cell, c) => {
      if (owns && !owns(c, r)) return;
      const main = c === at.col && r === at.row;
      const gained = cellScore(s.grid, c, r) - cellScore(prior.grid, c, r) + (main ? seasonPts : 0);
      if ((isBuilding(cell) || isBuilding(prior.grid[r][c])) && (gained !== 0 || main)) changes.push({ col: c, row: r, gained });
    }),
  );
  s.bonus += seasonPts;

  // The decree pays once, the first time the board fulfils it.
  let decree = false;
  if (s.decree && !s.decree.done && decreeMarks(ownGrid(s), s.decree).have >= s.decree.need) {
    s.decree.done = true;
    s.bonus += DECREE_BONUS;
    s.crowns++;
    decree = true;
  }
  s.score = boardScore(s.grid, owns) + s.bonus;

  let newRound = false;
  let struck: Struck | null = null;
  // A puzzle island has no rounds: its pouch is all there is.
  while (!s.puzzle && s.score >= s.goal) {
    s.round++;
    s.goal = goalFor(s.round);
    for (const b of BUILDINGS) s.pouch[b] += ROUND_POUCH[b];
    if (s.native) s.pouch[s.native] += NATIVE_ROUND;
    if (s.round === WONDER_ROUND) s.pouch[s.wonder]++;
    if (s.rival) for (const b of BUILDINGS) s.rival.pouch[b] += ROUND_POUCH[b];
    s.giftsDue++;
    newRound = true;
  }
  if (newRound) {
    // The omen warned of strikes as the round begins, then the decree and the next omen are drawn on the board as it stands.
    if (s.omen) struck = strike(s.grid, s.omen);
    if (struck && s.rival) {
      const r = s.rival;
      r.cells = r.cells.map((cells, row) => cells.map((on, col) => on && isBuilding(s.grid[row][col])));
      r.score = boardScore(s.grid, theirs(r)) + r.bonus;
    }
    if (struck) s.score = boardScore(s.grid, owns) + s.bonus;
    s.decree = decreeFor(s.island, s.round, ownGrid(s), s.pouch, s.decree);
    s.omen = omenFor(s.island, s.round, s.grid);
    s.phase = 'gift';
  }
  // A change that began a round or won a crown is kept: undoing it would hand back what was paid.
  s.undo = newRound || decree ? null : prior;
  // A goal reached carries on to its gift, even with the pouch empty, unless the island is full
  // and no two houses could merge, nor a lumber camp tile clear a wood, to make room.
  if (s.phase === 'gift' && !s.grid.some((cells) => cells.includes('grass')) && !housesCanMerge(ownGrid(s)) && !canClearAny(s)) s.giftsDue = 0;
  if (s.phase === 'playing' || s.giftsDue === 0) checkEnd(s);
  return { gained: s.score - prior.score, changes, decree, newRound, season: seasonPts, struck, rival };
}

/** Places the selected building at (col, row) and draws the next hand; null if it can't go there. */
export function place(s: GameState, col: number, row: number): Placed | null {
  const kind = s.selected;
  if (!kind || !canPlace(s, col, row, kind) || !inHand(s, kind)) return null;
  const prior = snapshot(s);
  build(s.grid, col, row, kind);
  s.pouch[kind]--;
  s.placed++;
  const placed = settle(s, prior, { col, row }, seasonal(s, kind, cellScore(s.grid, col, row)));
  drawHand(s);
  return placed;
}

/** Whether the wood at (col, row) can be cleared: a lumber camp tile in the hand is spent on a forest beside a lumber camp. */
export function canClear(s: GameState, col: number, row: number) {
  return s.phase === 'playing' && s.selected === 'lumber' && inHand(s, 'lumber') && s.grid[row]?.[col] === 'forest' && beside(s.grid, col, row, 'lumber');
}

/** What clearing the wood at (col, row) would add to the score (usually a loss: the camp and houses beside it lose the forest), or null. */
export function previewClear(s: GameState, col: number, row: number) {
  if (!canClear(s, col, row)) return null;
  const grid = s.grid.map((cells) => [...cells]);
  grid[row][col] = 'grass';
  return boardScore(grid, mine(s)) - boardScore(s.grid, mine(s));
}

/**
 * Clears the wood at (col, row) to grass, spending the lumber camp tile from the hand: points for
 * room. It counts like a placement for the decree, the goal and the undo. Null if it can't be done.
 */
export function clear(s: GameState, col: number, row: number): Placed | null {
  if (!canClear(s, col, row)) return null;
  const prior = snapshot(s);
  s.grid[row][col] = 'grass';
  s.pouch.lumber--;
  const placed = settle(s, prior, { col, row }, 0);
  drawHand(s);
  return placed;
}

/** Whether a market trade can be made now: a market stands, none was made this round, and the pouch has two of a kind to give for a different gift building already won that has a use on the board. */
export function canTrade(s: GameState) {
  return s.phase === 'playing' && s.tradedIn !== s.round && s.grid.some((cells) => cells.includes('market')) && tradeGives(s).some((g) => tradeTakes(s).some((t) => t !== g));
}

/** The kinds the pouch could give two of in a trade. */
export const tradeGives = (s: GameState) => BUILDINGS.filter((b) => s.pouch[b] >= TRADE_GIVE);

/** The gift buildings won that a trade could take: those with a use on the board (room, or a wood to clear). */
export const tradeTakes = (s: GameState) => s.unlocked.filter((b) => playable(s.grid, b));

/**
 * A market trade, once per round: gives TRADE_GIVE tiles of `give` from the pouch for one tile of
 * `take`, a gift building already won with a use on the board, then draws a new hand and checks for
 * the end. It cannot be undone. False if not allowed.
 */
export function trade(s: GameState, give: Building, take: Special) {
  if (!canTrade(s) || s.pouch[give] < TRADE_GIVE || !tradeTakes(s).includes(take) || give === take) return false;
  s.pouch[give] -= TRADE_GIVE;
  s.pouch[take]++;
  s.tradedIn = s.round;
  s.undo = null;
  drawHand(s);
  checkEnd(s);
  return true;
}

/** Whether the house at `from` can merge into the house beside it at `to`. */
export function canMerge(s: GameState, from: { col: number; row: number }, to: { col: number; row: number }) {
  if (s.phase !== 'playing' || s.grid[from.row]?.[from.col] !== 'house' || s.grid[to.row]?.[to.col] !== 'house') return false;
  if (rivalAt(s, from.col, from.row) || rivalAt(s, to.col, to.row)) return false;
  return Math.abs(from.col - to.col) + Math.abs(from.row - to.row) === 1;
}

/** Whether the house at (col, row) has a house beside it to merge with. */
export const mergeable = (s: GameState, col: number, row: number) =>
  SIDES.some(([dc, dr]) => canMerge(s, { col, row }, { col: col + dc, row: row + dr }));

/** Whether any two houses on `grid` stand side by side, so they could merge, whatever the phase. */
export const housesCanMerge = (grid: Cell[][]) =>
  grid.some((cells, row) => cells.some((cell, col) => cell === 'house' && (cells[col + 1] === 'house' || grid[row + 1]?.[col] === 'house')));

/** What merging the house at `from` into the one at `to` would add to the score (it can be negative), or null. */
export function previewMerge(s: GameState, from: { col: number; row: number }, to: { col: number; row: number }) {
  if (!canMerge(s, from, to)) return null;
  const grid = s.grid.map((cells) => [...cells]);
  grid[to.row][to.col] = 'manor';
  grid[from.row][from.col] = 'grass';
  return boardScore(grid, mine(s)) - boardScore(s.grid, mine(s));
}

/**
 * Merges the house at `from` into the house beside it at `to`: `to` becomes a manor and `from`
 * is grass again, free to build on. It takes no tile and counts like a placement for the decree,
 * the goal and the undo. Null if the two can't merge.
 */
export function merge(s: GameState, from: { col: number; row: number }, to: { col: number; row: number }): Placed | null {
  if (!canMerge(s, from, to)) return null;
  const prior = snapshot(s);
  s.grid[to.row][to.col] = 'manor';
  s.grid[from.row][from.col] = 'grass';
  const placed = settle(s, prior, to, 0);
  keepHandPlayable(s);
  return placed;
}

/** Takes one of the gifts on offer while one is due. Returns false if that is not allowed now. */
export function chooseGift(s: GameState, gift: Gift) {
  if (s.phase !== 'gift' || s.giftsDue <= 0 || !s.gifts.includes(gift)) return false;
  const tiles = GIFT_INFO[gift].tiles;
  for (const b of BUILDINGS) s.pouch[b] += tiles[b] ?? 0;
  // A rival lord takes the gift left over.
  const other = GIFT_INFO[s.gifts[0] === gift ? s.gifts[1] : s.gifts[0]].tiles;
  if (s.rival) for (const b of BUILDINGS) s.rival.pouch[b] += other[b] ?? 0;
  const won = newSpecial(gift);
  if (won && !s.unlocked.includes(won)) s.unlocked.push(won);
  s.giftsDue--;
  // The next offer is for the goal ahead (or the next one still due).
  s.gifts = giftsFor(s.island, s.round - s.giftsDue, s.unlocked);
  if (s.giftsDue === 0) {
    s.phase = 'playing';
    keepHandPlayable(s);
    checkEnd(s);
  }
  return true;
}

/** The buildings with a tile button: each kind in the hand, once, in BUILDINGS order. */
export const shownKinds = (s: GameState): Building[] => BUILDINGS.filter((b) => s.hand.includes(b));
/** How many tiles of `kind` the hand holds. */
export const handCount = (s: GameState, kind: Building) => s.hand.filter((b) => b === kind).length;

/**
 * The island a finished kingdom sails on to: the next island of its chain, with the chain's score so
 * far and the cargo its harbours ship, one tile per harbour (up to CARGO_MAX) of the gift buildings
 * won on it, in the order they were won (farms when none were won).
 */
export function nextKingdom(s: GameState): { island: number; kingdom: Kingdom } {
  const link = s.link + 1;
  const kinds: Building[] = s.unlocked.length ? [...s.unlocked] : ['farm'];
  const cargo: Partial<Pouch> = {};
  for (let i = 0; i < Math.min(CARGO_MAX, harbourCount(s.grid)); i++) {
    const b = kinds[i % kinds.length];
    cargo[b] = (cargo[b] ?? 0) + 1;
  }
  return { island: nextIsland(s.island, link), kingdom: { mode: 'chain', link, chainScore: s.chainScore + s.score, cargo } };
}
