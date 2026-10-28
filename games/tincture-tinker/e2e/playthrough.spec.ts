import { expect, test, type Page } from '@playwright/test';

// Plays the first order with real inputs: a swap that makes no match slides back for free, a tap on
// Stir with no coins buys nothing, then matches are made by tapping one tile and then its
// neighbour, as on a phone, until the order's ingredients are gathered and the potion is sold for
// its price and its stars.
// Game state is only read, through the `game` object the dev build puts on window.

type Kind = 'wheat' | 'mandrake' | 'sage' | 'ember' | 'moonpetal';
interface Tile { id: number; kind: Kind; catalyst?: boolean; bloom?: boolean; jar?: boolean; resin?: boolean }
interface Cell { row: number; col: number }
interface GameState {
  order: number;
  coins: number;
  sold: number;
  current: { number: number; potion: string; needs: Partial<Record<Kind, number>>; moves: number; price: number; jars: number; resin: number; rush?: boolean; forbid?: Kind };
  got: Record<Kind, number>;
  moves: number;
  phase: 'play' | 'sold' | 'failed';
  earned: number;
  stars: number;
  orderStars: number;
  brewed: number;
  fired: number;
  bloomed: number;
  bloomsFired: number;
  board: Tile[][];
}
interface Scene { state: GameState; busy: boolean; selected: Cell | null }

/** The first order, from src/game/orders.ts, and the bonus for each move left. */
const ORDER_1 = { potion: 'healingDraught', needs: { ember: 12, sage: 12 }, moves: 15, price: 30 };
const MOVE_BONUS = 5;
/** Stars for the moves left at a sale, from src/game/ranks.ts. */
const starsFor = (movesLeft: number) => (movesLeft >= 8 ? 3 : movesLeft >= 4 ? 2 : 1);
/** The Stir bench tool's button and price, from src/scenes/layout.ts (TOOL) and src/game/sim.ts. */
const STIR = { x: 560, y: 393, w: 80, h: 43, cost: 40 };
/** The board and its cells, from src/scenes/layout.ts. */
const VIEW = { w: 960, h: 540 };
const BOARD = { x: 46, y: 46, cell: 56, size: 8 };

/** Game time per animation frame, every frame the same length. */
const FRAME_MS = 64;
/** Game time advanced between checks: a few animation frames. */
const STEP_MS = 192;
/**
 * How many times faster than real time the game plays, so the recorded video runs at that speed.
 * CI plays at 4x. A machine that can't keep up plays as fast as it can; the end of the run logs the
 * speed it reached.
 */
const SPEED = Number(process.env.PLAYTHROUGH_SPEED ?? 4);

const kinds = (board: Tile[][]) => board.map((row) => row.map((t) => t.kind));

function swapKinds(grid: Kind[][], a: Cell, b: Cell) {
  const next = grid.map((row) => [...row]);
  [next[a.row][a.col], next[b.row][b.col]] = [grid[b.row][b.col], grid[a.row][a.col]];
  return next;
}

/** Every row or column of three or more of a kind, as its cells. */
function runs(grid: Kind[][]): Cell[][] {
  const found: Cell[][] = [];
  const n = BOARD.size;
  for (let i = 0; i < n; i++) {
    for (const line of [grid[i].map((_, j) => ({ row: i, col: j })), grid.map((_, j) => ({ row: j, col: i }))]) {
      for (let start = 0; start < n; ) {
        let end = start + 1;
        const kind = (c: Cell) => grid[c.row][c.col];
        while (end < n && kind(line[end]) === kind(line[start])) end++;
        if (end - start >= 3) found.push(line.slice(start, end));
        start = end;
      }
    }
  }
  return found;
}

/** The cells in a row or column of three or more of a kind: what a swap would match first. */
function matched(grid: Kind[][]): Cell[] {
  const hit = new Map<string, Cell>();
  for (const run of runs(grid)) run.forEach((c) => hit.set(`${c.row},${c.col}`, c));
  return [...hit.values()];
}

/** The swap that gathers the most of what the order still needs, by its first match. */
function bestSwap(s: GameState) {
  const grid = kinds(s.board);
  const wanted = (k: Kind) => (s.got[k] < (s.current.needs[k] ?? 0) ? 1 : 0);
  let best: { a: Cell; b: Cell; cells: (Cell & { kind: Kind })[]; long: Kind[]; blooms: Kind[]; catalyst: boolean; score: number } | null = null;
  for (let row = 0; row < BOARD.size; row++) {
    for (let col = 0; col < BOARD.size; col++) {
      const a = { row, col };
      for (const b of [{ row, col: col + 1 }, { row: row + 1, col }]) {
        if (b.row >= BOARD.size || b.col >= BOARD.size) continue;
        const after = swapKinds(grid, a, b);
        const cells = matched(after);
        const score = cells.reduce((sum, c) => sum + 10 * wanted(after[c.row][c.col]) + 1, 0);
        if (cells.length > 0 && (!best || score > best.score)) {
          // An L or T of one kind keeps the tile where its lines cross as a Bloom, and any other run
          // of four or more keeps one of its tiles as a Catalyst, instead of gathering it.
          const found = runs(after);
          const crossed = new Set<Cell[]>();
          const blooms: Kind[] = [];
          for (const h of found.filter((r) => r[0].row === r[1].row)) {
            for (const v of found.filter((r) => r[0].col === r[1].col)) {
              if (crossed.has(h) || crossed.has(v) || after[h[0].row][h[0].col] !== after[v[0].row][v[0].col]) continue;
              if (!h.some((c) => v.some((d) => d.row === c.row && d.col === c.col))) continue;
              crossed.add(h).add(v);
              blooms.push(after[h[0].row][h[0].col]);
            }
          }
          const long = found.filter((run) => run.length >= 4 && !crossed.has(run)).map((run) => after[run[0].row][run[0].col]);
          // A Catalyst in the match clears its row as well; swapping moves a tile, so look where each one lands.
          const tileAt = (c: Cell) => (c.row === a.row && c.col === a.col ? s.board[b.row][b.col] : c.row === b.row && c.col === b.col ? s.board[a.row][a.col] : s.board[c.row][c.col]);
          const catalyst = cells.some((c) => tileAt(c).catalyst || tileAt(c).bloom);
          best = { a, b, cells: cells.map((c) => ({ ...c, kind: after[c.row][c.col] })), long, blooms, catalyst, score };
        }
      }
    }
  }
  return best;
}

/** Two neighbours of different kinds that make no match when swapped. */
function deadSwap(s: GameState) {
  const grid = kinds(s.board);
  for (let row = 0; row < BOARD.size; row++) {
    for (let col = 0; col + 1 < BOARD.size; col++) {
      const a = { row, col };
      const b = { row, col: col + 1 };
      if (grid[row][col] !== grid[row][col + 1] && matched(swapKinds(grid, a, b)).length === 0) return { a, b };
    }
  }
  throw new Error('No swap without a match');
}

function scene(page: Page) {
  const read = <T>(fn: (s: any) => T) =>
    page.evaluate(`(${fn.toString()})(window.game.scene.getScene('Game'))`) as Promise<T>;
  return {
    get: () => read<Scene>((s) => JSON.parse(JSON.stringify({ state: s.state, busy: s.busy, selected: s.selected }))),
  };
}

test('sells the first potion', async ({ page }, testInfo) => {
  // A seeded Math.random keeps the board and the tiles that drop in the same from run to run.
  await page.addInitScript(() => {
    let seed = 1234567;
    Math.random = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));

  if (process.env.CPU_THROTTLE) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(process.env.CPU_THROTTLE) });
  }
  // The test owns the clock: game time only moves when the test advances it, one FRAME_MS
  // animation frame at a time, so the board plays the same on a slow runner as on a fast one.
  const start = new Date('2026-01-01T00:00:00Z');
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1_000));
  await page.addInitScript((frameMs) => {
    window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), frameMs);
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
    // Phaser falls back to its canvas renderer. CI has no GPU, and WebGL in software is too slow to
    // play at SPEED; the game, its rules and the pixel art are the same either way.
    const getContext = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, id: string, ...rest: unknown[]) => unknown;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
      return /webgl/i.test(id) ? null : getContext.call(this, id, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  }, FRAME_MS);
  await page.goto('/games/tincture-tinker/');
  const game = scene(page);
  const canvas = page.locator('canvas');

  let gameMs = 0;
  let startedAt = 0;

  /**
   * Advances game time in small steps until `done` holds; returns false if `ms` ran out first. Once
   * the game has started, each step waits until real time catches up with game time / SPEED.
   */
  async function play(ms: number, done: () => Promise<boolean>) {
    for (let t = 0; t <= ms; t += STEP_MS) {
      if (await done()) return true;
      await page.clock.runFor(STEP_MS);
      if (!startedAt) continue;
      gameMs += STEP_MS;
      const ahead = gameMs / SPEED - (Date.now() - startedAt);
      if (ahead > 0) await new Promise((r) => setTimeout(r, ahead));
    }
    return done();
  }

  expect(
    await play(10_000, () => page.evaluate(() => !!(window as any).game?.scene.getScene('Game')?.state)),
    'game started',
  ).toBe(true);
  startedAt = Date.now();

  const snap = async (name: string) =>
    testInfo.attach(name, { body: await page.screenshot({ path: testInfo.outputPath(`${name}.png`) }), contentType: 'image/png' });

  /** Plays on until the swap on the board has played out. */
  async function settled(what: string) {
    let g = await game.get();
    const ok = await play(5_000, async () => !(g = await game.get()).busy);
    if (!ok) throw new Error(`Timed out waiting for ${what} to play out; state ${JSON.stringify({ ...g.state, board: kinds(g.state.board) })}`);
    return g.state;
  }

  /** Taps the middle of a cell, as a player would. */
  async function tap(cell: Cell) {
    const box = (await canvas.boundingBox())!;
    const scale = box.width / VIEW.w;
    const x = BOARD.x + (cell.col + 0.5) * BOARD.cell;
    const y = BOARD.y + (cell.row + 0.5) * BOARD.cell;
    await page.mouse.click(box.x + x * scale, box.y + y * scale);
    await play(STEP_MS, async () => false);
  }

  // The first order: a Healing Draught, nothing gathered yet, all its moves and no coins.
  let s = (await game.get()).state;
  expect(s).toMatchObject({ order: 1, coins: 0, sold: 0, moves: ORDER_1.moves, phase: 'play' });
  // The first order is plain: no rush, no forbidden ingredient, no jars or resin on its board.
  expect(s.current).toMatchObject({ number: 1, ...ORDER_1, jars: 0, resin: 0 });
  expect(s.current.rush).toBeFalsy();
  expect(s.current.forbid).toBeFalsy();
  expect(s.board.flat().some((t) => t.jar || t.resin), 'no blockers on the first board').toBe(false);
  expect(Object.values(s.got).every((n) => n === 0)).toBe(true);
  expect(s.board.length).toBe(BOARD.size);
  expect(matched(kinds(s.board)), 'no matches on a new board').toEqual([]);
  await snap('0-order');

  // A swap that makes no match slides back and costs no move.
  const dead = deadSwap(s);
  await tap(dead.a);
  expect((await game.get()).selected, 'the first tap picks the tile').toEqual(dead.a);
  await tap(dead.b);
  let after = await settled('a swap without a match');
  expect(kinds(after.board)).toEqual(kinds(s.board));
  expect(after.moves).toBe(ORDER_1.moves);
  expect((await game.get()).selected).toBeNull();

  // The Stir bench tool costs coins the first order hasn't earned yet: a tap on it buys nothing.
  {
    const box = (await canvas.boundingBox())!;
    const scale = box.width / VIEW.w;
    expect(after.coins).toBeLessThan(STIR.cost);
    await page.mouse.click(box.x + (STIR.x + STIR.w / 2) * scale, box.y + (STIR.y + STIR.h / 2) * scale);
    await play(STEP_MS, async () => false);
    const g = await game.get();
    expect(g.state, 'Stir without the coins').toMatchObject({ moves: ORDER_1.moves, coins: 0, phase: 'play' });
    expect(g.selected, 'a tap on a tool picks no tile').toBeNull();
  }

  // Swaps that match gather the matched ingredients (and any cascade after), a move each.
  for (let move = 1; s.phase === 'play'; move++) {
    expect(move, 'moves for the first order').toBeLessThanOrEqual(ORDER_1.moves);
    s = (await game.get()).state;
    const swap = bestSwap(s);
    expect(swap, 'a swap to make').not.toBeNull();
    await tap(swap!.a);
    await tap(swap!.b);
    if (move === 1) await snap('1-match');
    after = await settled(`swap ${move}`);
    expect(after.moves).toBe(s.moves - 1);
    // Only the ingredients the order needs are counted; the others are gathered but not kept.
    for (const kind of Object.keys(s.got) as Kind[]) {
      if (!(kind in ORDER_1.needs)) {
        expect(after.got[kind], `${kind} isn't wanted`).toBe(0);
        continue;
      }
      const kept = swap!.long.filter((k) => k === kind).length + swap!.blooms.filter((k) => k === kind).length;
      const first = swap!.cells.filter((c) => c.kind === kind).length - kept;
      expect(after.got[kind], `${kind} gathered on swap ${move}`).toBeGreaterThanOrEqual(s.got[kind] + first);
    }
    // A match of four or more brews a Catalyst and an L or T a Bloom (unless a special in it clears
    // the row or square they lie on).
    if (!swap!.catalyst) {
      expect(after.brewed, `catalysts brewed on swap ${move}`).toBeGreaterThanOrEqual(s.brewed + swap!.long.length);
      expect(after.bloomed, `blooms brewed on swap ${move}`).toBeGreaterThanOrEqual(s.bloomed + swap!.blooms.length);
    }
    if (swap!.long.length + swap!.blooms.length > 0) {
      console.log(`Swap ${move} brewed a special (${after.brewed} Catalysts and ${after.bloomed} Blooms brewed, ${after.fired} Catalysts fired so far).`);
    }
    s = after;
  }

  // The order is filled before the moves run out, and the potion sells for its price plus the bonus.
  expect(s.phase).toBe('sold');
  expect(s.got.ember).toBeGreaterThanOrEqual(ORDER_1.needs.ember);
  expect(s.got.sage).toBeGreaterThanOrEqual(ORDER_1.needs.sage);
  expect(s.moves).toBeGreaterThan(0);
  expect(s.earned).toBe(ORDER_1.price + s.moves * MOVE_BONUS);
  expect(s).toMatchObject({ coins: s.earned, sold: 1, order: 2 });
  // The sale earns one to three stars by the moves left, the first towards the tinker's rank.
  expect(s.orderStars).toBe(starsFor(s.moves));
  expect(s.stars).toBe(s.orderStars);
  await play(1_000, async () => false);
  await snap('2-sold');
  // The sale earns First tincture (src/trophies/), with Chain reaction for a Catalyst fired, In full
  // bloom for a Bloom fired and Flawless for three stars, and nothing else yet.
  const trophies = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('tincture-tinker-trophies') ?? '{}')));
  const expected = [
    'firstSale',
    ...(s.fired > 0 ? ['firstCatalyst'] : []),
    ...(s.bloomsFired > 0 ? ['firstBloom'] : []),
    ...(s.orderStars === 3 ? ['threeStars'] : []),
  ];
  expect(trophies.sort(), 'trophies earned in the first round').toEqual(expected.sort());

  const speed = gameMs / (Date.now() - startedAt);
  console.log(`Played ${Math.round(gameMs / 1000)}s of game time at ${speed.toFixed(1)}x (target ${SPEED}x).`);
  expect(errors).toEqual([]);
});
