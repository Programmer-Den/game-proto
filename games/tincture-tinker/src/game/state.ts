import { dailyRand } from '../../../../shared/daily';
import { addBlockers, freshBoard, layBoard, stuck, type Board, type Cell, type Tile } from './board';
import { endlessOrder } from './endless';
import { EXAMS, examOrder, examSeed, seeded } from './exams';
import { guestOrder, guestSeed } from './guests';
import { ALL_KINDS, randomKind, type Kind } from './kinds';
import { orderFor, poolOf, type Needs, type Order, type PotionId } from './orders';
import { unlockedRecipes } from './ranks';
import { dailyOrder, TOWNS, townOrder, townSeed } from './towns';
import { freshUpgrades, type Upgrades } from './upgrades';
import { weeklyOrder, weeklyRand } from './weekly';

/** What carries over between orders, and is saved. */
export interface Progress {
  /** The order to play, 1 for the first; it moves on as soon as one is sold. */
  order: number;
  coins: number;
  /** Potions sold so far. */
  sold: number;
  /** Stars earned over every order sold; they set the tinker's rank (see ranks.ts). */
  stars: number;
  /** Ingredients gathered over what an order needed, up to `PANTRY_MAX` a kind, kept for the next order that needs them. */
  pantry: Needs;
  /** The workbench upgrades bought so far (see upgrades.ts). */
  upgrades: Upgrades;
  /** True once the crown's last order is filled: the tinker is Royal Apothecary. */
  royal: boolean;
  /** Guild examinations passed, one seal each; the next one to sit is `EXAMS[seals]`. */
  seals: number;
  /** The next order was picked rich on the result card. */
  rich: boolean;
  /** The best stars each town on the journey map was sold with, 0 for one not sold yet (see towns.ts). */
  towns: number[];
  /** The longest endless run so far: orders sold in a row (see endless.ts). */
  endless: number;
  /** The best stars each town's guest was sold with, 0 for one not sold yet (see guests.ts). */
  guests: number[];
}

/** The game's name for the shared daily (`shared/daily.ts`): its record is kept under `tincture-tinker-daily`. */
export const GAME = 'tincture-tinker';

export interface GameState extends Progress {
  current: Order;
  /** Ingredients gathered for this order; only the kinds it needs count. */
  got: Record<Kind, number>;
  moves: number;
  /** `sold` once the order is filled, `failed` when the moves ran out first. */
  phase: 'play' | 'sold' | 'failed';
  /** Coins the last filled order paid, bonus included. */
  earned: number;
  /** Stars the order earned when it sold (1 to 3), 0 until then. */
  orderStars: number;
  /** Catalysts brewed by matches of four or more this order, and how many were matched (fired). */
  brewed: number;
  fired: number;
  /** Blooms brewed by L and T matches this order, and how many were matched. */
  bloomed: number;
  bloomsFired: number;
  /** Jars opened, resin melted and mould scrubbed off this order. */
  opened: number;
  melted: number;
  scrubbed: number;
  /** Extra moves spent matching the forbidden ingredient this order. */
  penalties: number;
  /** The stage of a royal commission being brewed, from 0. */
  stage: number;
  /** On a twin order, the customers served so far, first first. */
  served: PotionId[];
  /** The coins the customer served first paid on top, 0 until then. */
  speedBonus: number;
  /** What the pantry put towards this order (or stage) when it started, and what the last sale put in it. */
  fromPantry: Needs;
  toPantry: Needs;
  /** The pantry as the order found it: what is saved (and given back) until the order sells. */
  startPantry: Needs;
  /** On a guild examination, whether the sale earned the stars it asked for. */
  passed: boolean;
  /** On the weekly order, the score so far: its ingredients gathered, each cascade step counting once more. */
  score: number;
  /** Toads the witch made this order (a guest's rule; see guests.ts). */
  toads: number;
  board: Board;
  nextId: number;
  /** Where new tiles' kinds come from on the daily order (today's seeded source); Math.random otherwise. Never saved. */
  rand?: () => number;
}

/** The most of one kind the pantry keeps. */
export const PANTRY_MAX = 5;
/** What the herbalist charges for one ingredient put in the pantry between orders. */
export const HERB_COST = 8;

export const freshProgress = (): Progress => ({ order: 1, coins: 0, sold: 0, stars: 0, pantry: {}, upgrades: freshUpgrades(), royal: false, seals: 0, rich: false, towns: TOWNS.map(() => 0), endless: 0, guests: TOWNS.map(() => 0) });
/** The progress to save or carry on with. Until the order sells, its pantry draws are given back. */
export const progressOf = ({ order, coins, sold, stars, pantry, startPantry, phase, upgrades, royal, seals, rich, towns, endless, guests }: GameState): Progress => ({
  order,
  coins,
  sold,
  stars,
  pantry: { ...heldPantry({ pantry, startPantry, phase }) },
  upgrades: { ...upgrades },
  royal,
  seals,
  rich,
  towns: [...towns],
  endless,
  guests: [...guests],
});

/** The pantry as it stands between orders: after a sale what it holds, otherwise what the order found. */
export const heldPantry = (s: Pick<GameState, 'pantry' | 'startPantry' | 'phase'>): Needs => (s.phase === 'sold' ? s.pantry : s.startPantry);

/** True when there is a guild examination to sit: the tinker is Royal Apothecary and has seals still to earn. */
export const examOpen = (p: Progress) => p.royal && p.seals < EXAMS.length;
/** True once every guild examination is passed: endless runs are open. */
export const endlessOpen = (p: Progress) => p.seals >= EXAMS.length;

/**
 * The herbalist, between orders: one `kind` into the pantry for `HERB_COST` coins, up to `PANTRY_MAX`.
 * False while an order is being played, when it can't be afforded or the pantry is full of it.
 */
export function buyHerb(s: GameState, kind: Kind): boolean {
  const store = heldPantry(s);
  if (s.phase === 'play' || s.coins < HERB_COST || (store[kind] ?? 0) >= PANTRY_MAX) return false;
  s.coins -= HERB_COST;
  store[kind] = (store[kind] ?? 0) + 1;
  return true;
}

/** New tiles for the board: from the order's pool (a town's rare ingredient too), drawn from `s.rand` when set. */
export const tileMaker = (s: GameState) => (): Tile => ({ id: s.nextId++, kind: randomKind(s.rand, poolOf(s.current)) });

/** The orders' view of the progress: the recipes unlocked, the workbench's moves, the royal title and a rich pick. */
export const standingOf = (p: Progress) => ({ unlocked: unlockedRecipes(p.stars), extraMoves: p.upgrades.hands, royal: p.royal, rich: p.rich });

/**
 * Starts the order `progress.order` on a new board with all its moves, or with `exam` the next guild
 * examination on its fixed board (no Bloom starter, no pantry).
 */
export function startOrder(progress: Progress, exam = false): GameState {
  if (exam) return startAside(progress, examOrder(progress.seals, progress.order), seeded(examSeed(progress.seals)));
  const s = blankState(progress, orderFor(progress.order, standingOf(progress)));
  const current = s.current;
  s.board = addBlockers(freshBoard(tileMaker(s)), current.jars, current.resin, current.mould);
  if (s.upgrades.bloom > 0) s.board = withBloom(s.board);
  drawPantry(s);
  return s;
}

/** Town `index` of the journey map on its own fixed board, cut to the town's shape. */
export const startTown = (progress: Progress, index: number) => startAside(progress, townOrder(index, progress.order), seeded(townSeed(index)));
/** Order `step` of an endless run, on a new board. */
export const startEndless = (progress: Progress, step: number) => startAside(progress, endlessOrder(step, progress.order));
/** Today's daily order: the order, its board and every tile that drops in come from today's seed. */
export function startDailyOrder(progress: Progress, day: string): GameState {
  const rand = dailyRand(GAME, day);
  return startAside(progress, dailyOrder(rand, day, progress.order), rand, true);
}

/** Town `index`'s guest on the town's board shape, laid from the guest's own seed. */
export const startGuest = (progress: Progress, index: number) => startAside(progress, guestOrder(index, progress.order), seeded(guestSeed(index)));
/** The week's order: the order, its board and every tile that drops in come from the week's seed. */
export function startWeeklyOrder(progress: Progress, week: string): GameState {
  const rand = weeklyRand(week);
  return startAside(progress, weeklyOrder(rand, week, progress.order), rand, true);
}

/**
 * An order outside the round (an examination, a town, an endless run's or the daily) on a board laid
 * from `rand`, with walls cut where the order has `holes`: no Bloom starter and no pantry. With
 * `refills`, the tiles that drop in come from `rand` too.
 */
function startAside(progress: Progress, current: Order, rand: () => number = Math.random, refills = false): GameState {
  const s = blankState(progress, current);
  if (refills) s.rand = rand;
  const make = () => ({ id: s.nextId++, kind: randomKind(rand, poolOf(current)) });
  s.board = addBlockers(layBoard(make, current.holes ?? [], rand), current.jars, current.resin, current.mould, rand);
  return s;
}

/** A state for `current` with all its moves and nothing gathered yet; its board is laid by the caller. */
function blankState(progress: Progress, current: Order): GameState {
  return {
    ...progress,
    pantry: { ...progress.pantry },
    upgrades: { ...progress.upgrades },
    towns: [...progress.towns],
    guests: [...progress.guests],
    current,
    got: Object.fromEntries(ALL_KINDS.map((k) => [k, 0])) as Record<Kind, number>,
    moves: current.moves,
    phase: 'play',
    earned: 0,
    orderStars: 0,
    brewed: 0,
    fired: 0,
    bloomed: 0,
    bloomsFired: 0,
    opened: 0,
    melted: 0,
    scrubbed: 0,
    penalties: 0,
    stage: 0,
    served: [],
    speedBonus: 0,
    fromPantry: {},
    toPantry: {},
    startPantry: { ...progress.pantry },
    passed: false,
    score: 0,
    toads: 0,
    board: [],
    nextId: 1,
  };
}

/** The Bloom starter's Bloom, on a random tile that is free to move (the board matches no more than before). */
function withBloom(board: Board): Board {
  const free: Cell[] = board.flatMap((row, r) => row.flatMap((t, c) => (stuck(t) ? [] : [{ row: r, col: c }])));
  if (free.length === 0) return board;
  const at = free[Math.floor(Math.random() * free.length)];
  const next = board.map((row) => [...row]);
  next[at.row][at.col] = { ...board[at.row][at.col], bloom: true };
  return next;
}

/** True if the order counts `kind`: only the ingredients it asks for are gathered towards it. */
export const wanted = (s: GameState, kind: Kind) => kind in s.current.needs;

/** True once every ingredient in `needs` (the order's, by default) has been gathered. */
export const filled = (s: GameState, needs: Needs = s.current.needs) =>
  Object.entries(needs).every(([kind, n]) => s.got[kind as Kind] >= n);

/** The first customer's needs on a twin order: the order's without the second customer's. */
export const firstNeeds = (o: Order): Needs =>
  o.second ? Object.fromEntries(Object.entries(o.needs).filter(([k]) => !(k in o.second!.needs))) : o.needs;

/** Puts what the pantry holds of the order's needs towards it, short of filling any by one, and notes what it gave. */
export function drawPantry(s: GameState) {
  s.fromPantry = {};
  for (const [kind, n] of Object.entries(s.current.needs) as [Kind, number][]) {
    const give = Math.min(s.pantry[kind] ?? 0, n - 1 - s.got[kind]);
    if (give <= 0) continue;
    s.got[kind] += give;
    s.pantry[kind] = (s.pantry[kind] ?? 0) - give;
    if (s.pantry[kind] === 0) delete s.pantry[kind];
    s.fromPantry[kind] = give;
  }
}

/** Keeps what was gathered over the order's needs, up to `PANTRY_MAX` a kind, and notes what went in. */
export function stockPantry(s: GameState) {
  s.toPantry = {};
  for (const [kind, n] of Object.entries(s.current.needs) as [Kind, number][]) {
    const spare = Math.min(s.got[kind] - n, PANTRY_MAX - (s.pantry[kind] ?? 0));
    if (spare <= 0) continue;
    s.pantry[kind] = (s.pantry[kind] ?? 0) + spare;
    s.toPantry[kind] = spare;
  }
}
