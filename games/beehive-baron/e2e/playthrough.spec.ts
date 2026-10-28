import { expect, test, type Page } from '@playwright/test';

// Plays the first jar of honey with real inputs: build the first comb cell, send the two foragers
// out twice until the cell is full of nectar, let it ripen, harvest the capped cell and sell the
// jar, as a player would with a finger. The first jar is clover honey (the only meadow open) and
// its harvest also gives a piece of wax. Game state is only read, through the `game` object the dev
// build puts on window.

interface Cell {
  type: 'honey' | 'brood';
  nectar: number;
  phase: 'filling' | 'ripening' | 'capped';
  ripenMs: number;
  kind: string | null;
}
interface Bee {
  id: number;
  tripMs: number;
}
interface GameState {
  coins: number;
  cells: (Cell | null)[];
  bees: Bee[];
  jars: Record<string, number>;
  wax: number;
  sold: number;
  spilled: number;
  ranks: Record<string, number>;
  meadows: number;
  forage: string;
}
type Spot = { x: number; y: number };

const VIEW = { w: 960, h: 540 };
/** A cell holds 4 drops, a new hive has 2 bees carrying 1 drop each, and a jar sells for 15: src/game/state.ts. */
const CELL_CAP = 4;
const START_BEES = 2;
const HONEY_PRICE = 15;
const NO_JARS = { clover: 0, lavender: 0, heather: 0 };
/** An empty honey cell, which takes any kind of nectar. */
const EMPTY_CELL = { type: 'honey', nectar: 0, phase: 'filling', ripenMs: 0, kind: null };
/** The comb spot the test builds on: the middle of the second row. */
const SLOT = 7;

/**
 * Game time per animation frame, every frame the same length. Longer frames mean fewer to draw, so
 * the game can play at SPEED on a CI runner without a GPU.
 */
const FRAME_MS = 64;
/** Game time advanced between checks: a few animation frames. */
const STEP_MS = 192;
/**
 * How many times faster than real time the game plays, so the recorded video runs at that speed.
 * CI plays at 4x. A machine that can't keep up plays as fast as it can; the end of the run logs the
 * speed it reached.
 */
const SPEED = Number(process.env.PLAYTHROUGH_SPEED ?? 4);

function scene(page: Page) {
  const read = <T>(fn: (s: any) => T) =>
    page.evaluate(`(${fn.toString()})(window.game.scene.getScene('Game'))`) as Promise<T>;
  return {
    state: () => read<GameState>((s) => JSON.parse(JSON.stringify({ ...s.state, events: undefined }))),
    /** Where the Send and Sell buttons, each comb cell and the shop buttons are on screen. */
    spots: () => read<{ send: Spot; sell: Spot; cells: Spot[] }>((s) => s.spots()),
  };
}

test('plays the first jar of honey', async ({ page }, testInfo) => {
  // A seeded Math.random keeps the flowers the bees pick the same from run to run.
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
  // animation frame at a time, so the hive plays the same on a slow runner as on a fast one.
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
  await page.goto('/games/beehive-baron/');
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
  const wait = (ms: number) => play(ms, async () => false);

  expect(
    await play(10_000, () => page.evaluate(() => !!(window as any).game?.scene.getScene('Game')?.state)),
    'game started',
  ).toBe(true);
  startedAt = Date.now();

  const snap = async (name: string) =>
    testInfo.attach(name, { body: await page.screenshot({ path: testInfo.outputPath(`${name}.png`) }), contentType: 'image/png' });

  /** Plays on until `check` holds, for up to `ms` of game time. */
  async function until(what: string, check: (s: GameState) => boolean, ms = 30_000) {
    let state = await game.state();
    const ok = await play(ms, async () => check((state = await game.state())));
    if (!ok) throw new Error(`Timed out after ${ms}ms of game time waiting for: ${what}\nState ${JSON.stringify(state)}`);
    return state;
  }

  /** From a point in the 960x540 view to the page, wherever the canvas is scaled to. */
  async function toPage(spot: Spot) {
    const box = (await canvas.boundingBox())!;
    const scale = box.width / VIEW.w;
    return { x: box.x + spot.x * scale, y: box.y + spot.y * scale };
  }

  async function tap(spot: Spot) {
    const p = await toPage(spot);
    await page.mouse.click(p.x, p.y);
    await wait(STEP_MS);
  }

  const home = (s: GameState) => s.bees.every((b) => b.tripMs === 0);

  // A new hive: no coins, jars or wax, no comb yet, no meadow unlocked, so the bees forage clover,
  // and two bees resting at the entrance.
  let s = await game.state();
  expect(s).toMatchObject({ coins: 0, jars: NO_JARS, wax: 0, sold: 0, spilled: 0, meadows: 0, forage: 'clover' });
  expect(s.cells.every((c) => c === null)).toBe(true);
  expect(s.bees).toHaveLength(START_BEES);
  expect(home(s)).toBe(true);
  const spots = await game.spots();

  // With no comb there is nowhere to put nectar, so the foragers stay home.
  await tap(spots.send);
  expect(home(await game.state()), 'no foraging without a cell').toBe(true);

  // Tapping an empty spot builds the first cell, for free.
  await tap(spots.cells[SLOT]);
  s = await game.state();
  expect(s.cells[SLOT]).toEqual(EMPTY_CELL);
  expect(s.coins).toBe(0);
  await snap('0-built');

  // Send the foragers: they fly to the flowers and each brings a drop home.
  await tap(spots.send);
  s = await game.state();
  expect(s.bees.every((b) => b.tripMs > 0), 'both bees out').toBe(true);
  await wait(1_200);
  await snap('1-foraging');
  s = await until('the foragers are home', home, 10_000);
  expect(s.cells[SLOT]).toMatchObject({ nectar: START_BEES, phase: 'filling', kind: 'clover' });

  // A second trip fills the cell, which then ripens into honey and is capped.
  await tap(spots.send);
  s = await until('the cell is full', (s) => s.cells[SLOT]?.phase === 'ripening', 10_000);
  expect(s.cells[SLOT]!.nectar).toBe(CELL_CAP);
  expect(s.spilled).toBe(0);
  s = await until('the honey is capped', (s) => s.cells[SLOT]?.phase === 'capped', 10_000);
  await wait(400);
  await snap('2-capped');

  // Tapping the capped cell harvests a jar of clover honey and a piece of wax, and the cell starts over.
  await tap(spots.cells[SLOT]);
  s = await game.state();
  expect(s.jars).toEqual({ ...NO_JARS, clover: 1 });
  expect(s.wax).toBe(1);
  expect(s.cells[SLOT]).toEqual(EMPTY_CELL);
  await wait(400);
  await snap('3-harvested');

  // Selling the jar pays its price: a lone cell shares no edges, so there is no comb bonus, and one
  // jar sold is still short of the first goal (10 jars), so no meadow unlocks yet.
  await tap(spots.sell);
  s = await game.state();
  expect(s).toMatchObject({ coins: HONEY_PRICE, jars: NO_JARS, wax: 1, sold: 1, spilled: 0, meadows: 0 });
  await wait(400);
  await snap('4-sold');
  // The first jar sold earns the First jar trophy (src/trophies/), and nothing else yet.
  const trophies = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('beehive-baron-trophies') ?? '{}')));
  expect(trophies, 'trophies earned in the first round').toEqual(['firstJar']);

  const speed = gameMs / (Date.now() - startedAt);
  console.log(`Played ${Math.round(gameMs / 1000)}s of game time at ${speed.toFixed(1)}x (target ${SPEED}x).`);
  expect(errors).toEqual([]);
});
