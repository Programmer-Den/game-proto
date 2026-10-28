import { expect, test, type Page } from '@playwright/test';

// Plays the first wave on the Meadow with real inputs: picks the garden, drags a line of hedges
// across the lawn, tries to plant the one tile that would close the last way through (and checks
// it is refused), sets three bows by the gap, sends wave 1 and waits until every beetle is beaten,
// which earns the first trophy.
// Game state is only read, through the `game` object the dev build puts on window.

interface State {
  screen: 'menu' | 'play';
  phase: 'build' | 'wave' | 'won' | 'lost';
  wave: number;
  gold: number;
  /** Cabbages in the patch, and loose on the lawn. */
  lives: number;
  loose: number;
  kills: number;
  leaks: number;
  refusals: number;
  towers: { kind: string; cell: number }[];
  /** Towers still growing. */
  growing: number;
  foes: number;
  /** Steps from the first burrow to the cottage. */
  route: number;
}
type Spot = { x: number; y: number; w: number; h: number };

const VIEW = { w: 960, h: 540 };
const COLS = 22;
/** The rules the first wave goes through, from src/game/rules.ts. */
const START_GOLD = 90;
const LIVES_NORMAL = 15;
const COST = { hedge: 4, bow: 10 };
const WAVE_1 = 6;
const BEETLE_GOLD = 2;
const WAVE_1_REWARD = 7;

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

function scene(page: Page) {
  const read = <T>(fn: (s: any) => T) =>
    page.evaluate(`(${fn.toString()})(window.game.scene.getScene('Game'))`) as Promise<T>;
  return {
    state: () =>
      read<State>((s) => ({
        screen: s.screen,
        phase: s.state?.phase,
        wave: s.state?.wave,
        gold: s.state?.gold,
        lives: s.state?.lives,
        loose: s.state?.loose.length,
        kills: s.state?.kills,
        leaks: s.state?.leaks,
        refusals: s.state?.refusals,
        towers: (s.state?.towers ?? []).map((t: any) => ({ kind: t.kind, cell: t.cell })),
        growing: (s.state?.towers ?? []).filter((t: any) => t.grow > 0).length,
        foes: s.state?.foes.length,
        route: s.state?.dist[s.state.gates[0]],
      })),
    /** Every button on screen by id: `map-meadow`, `tool-bow`, `wave`. */
    buttons: () => read<Record<string, Spot>>((s) => s.buttons),
    /** The grid's top-left corner and cell size in view pixels. */
    grid: () => read<{ x: number; y: number; cell: number }>((s) => s.grid),
  };
}

test('plays the first round', async ({ page }, testInfo) => {
  // Seeded like the other games' tests, so any randomness repeats from run to run.
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
  // animation frame at a time, so the wave plays the same on a slow runner as on a fast one.
  const start = new Date('2026-01-01T00:00:00Z');
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1_000));
  await page.addInitScript((frameMs) => {
    window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), frameMs);
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
    // Phaser falls back to its canvas renderer, as CI has no GPU; the game looks the same either way.
    const getContext = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, id: string, ...rest: unknown[]) => unknown;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
      return /webgl/i.test(id) ? null : getContext.call(this, id, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  }, FRAME_MS);
  await page.goto('/games/mazewright/');
  const game = scene(page);
  const canvas = page.locator('canvas');

  let gameMs = 0;
  let startedAt = 0;

  /**
   * Advances game time in steps of `step` until `done` holds; returns false if `ms` ran out first. Once
   * the game has started, each step waits until real time catches up with game time / SPEED.
   */
  async function play(ms: number, done: () => Promise<boolean>, step = STEP_MS) {
    for (let t = 0; t <= ms; t += step) {
      if (await done()) return true;
      await page.clock.runFor(step);
      if (!startedAt) continue;
      gameMs += step;
      const ahead = gameMs / SPEED - (Date.now() - startedAt);
      if (ahead > 0) await new Promise((r) => setTimeout(r, ahead));
    }
    return done();
  }

  expect(
    await play(10_000, () => page.evaluate(() => !!(window as any).game?.scene.getScene('Game')?.buttons?.['map-meadow'])),
    'garden picker drawn',
  ).toBe(true);
  startedAt = Date.now();

  const snap = async (name: string) =>
    testInfo.attach(name, { body: await page.screenshot({ path: testInfo.outputPath(`${name}.png`) }), contentType: 'image/png' });

  /** Where a point in the 960x540 view is on the page. */
  async function onPage(at: { x: number; y: number }) {
    const box = (await canvas.boundingBox())!;
    const scale = box.width / VIEW.w;
    return { x: box.x + at.x * scale, y: box.y + at.y * scale };
  }
  /** Lets a frame draw, as a player's next tap would. */
  const frame = () => play(FRAME_MS, async () => false, FRAME_MS);
  /** Taps a button by its id and lets a frame draw. */
  async function press(id: string) {
    const spot = (await game.buttons())[id];
    expect(spot, `${id} on screen`).toBeTruthy();
    const p = await onPage(spot);
    await page.mouse.click(p.x, p.y);
    await frame();
  }
  /** The middle of a grid cell, on the page. */
  async function cellOnPage(col: number, row: number) {
    const g = await game.grid();
    return onPage({ x: g.x + (col + 0.5) * g.cell, y: g.y + (row + 0.5) * g.cell });
  }
  /** Taps a cell of the lawn and lets a frame draw. */
  async function tapCell(col: number, row: number) {
    const p = await cellOnPage(col, row);
    await page.mouse.click(p.x, p.y);
    await frame();
  }
  const cell = (col: number, row: number) => row * COLS + col;

  // The garden picker; the Meadow opens with an empty lawn, the gold and cabbages of Normal.
  await snap('playthrough-0-gardens');
  expect((await game.state()).screen).toBe('menu');
  await press('map-meadow');
  let s = await game.state();
  expect(s.screen).toBe('play');
  expect(s.phase).toBe('build');
  expect(s.wave).toBe(0);
  expect(s.gold).toBe(START_GOLD);
  expect(s.lives).toBe(LIVES_NORMAL);
  expect(s.towers).toHaveLength(0);
  const openRoute = s.route;

  // Drag a line of hedges down column 4, from the top to one tile above the bottom: each one is a
  // wall, so the beetles' route has to go round the gap at the bottom and gets longer.
  const top = await cellOnPage(4, 0);
  await page.mouse.move(top.x, top.y);
  await page.mouse.down();
  for (let row = 1; row <= 9; row++) {
    const p = await cellOnPage(4, row);
    await page.mouse.move(p.x, p.y, { steps: 2 });
    await frame();
  }
  await page.mouse.up();
  await frame();
  s = await game.state();
  expect(s.towers.filter((t) => t.kind === 'hedge').map((t) => t.cell).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((r) => cell(4, r)));
  expect(s.gold).toBe(START_GOLD - 10 * COST.hedge);
  expect(s.route, 'the route goes round the hedges').toBeGreaterThan(openRoute);
  await snap('playthrough-1-hedges');

  // The last tile of the column would close every way through: it is refused, and costs nothing.
  const gold = s.gold;
  await tapCell(4, 10);
  s = await game.state();
  expect(s.refusals, 'the closing tile is refused').toBe(1);
  expect(s.towers).toHaveLength(10);
  expect(s.gold).toBe(gold);
  await snap('playthrough-2-refused');

  // Three bows by the gap, where the route bends round the hedges.
  await press('tool-bow');
  for (const [col, row] of [[3, 9], [5, 9], [5, 7]]) await tapCell(col, row);
  s = await game.state();
  expect(s.towers.filter((t) => t.kind === 'bow').map((t) => t.cell).sort((a, b) => a - b)).toEqual([cell(5, 7), cell(3, 9), cell(5, 9)]);
  const goldBefore = START_GOLD - 10 * COST.hedge - 3 * COST.bow;
  expect(s.gold).toBe(goldBefore);
  expect(s.refusals).toBe(1);

  // A new tower grows a second per 10 gold before it fires: let the bows grow before the wave.
  expect(s.growing, 'the bows are still growing').toBeGreaterThan(0);
  expect(await play(5_000, async () => (await game.state()).growing === 0), 'bows grown').toBe(true);

  // Wave 1: six beetles walk the maze past the bows, and every one of them is beaten.
  await press('wave');
  s = await game.state();
  expect(s.phase).toBe('wave');
  expect(s.wave).toBe(1);
  expect(await play(15_000, async () => (await game.state()).kills >= 2), 'first beetles beaten').toBe(true);
  await snap('playthrough-3-wave');
  expect(await play(90_000, async () => (await game.state()).phase === 'build'), 'wave 1 held').toBe(true);
  s = await game.state();
  expect(s.wave).toBe(1);
  expect(s.kills).toBe(WAVE_1);
  expect(s.leaks).toBe(0);
  expect(s.lives, 'every cabbage still in the patch').toBe(LIVES_NORMAL);
  expect(s.loose).toBe(0);
  expect(s.foes).toBe(0);
  expect(s.gold).toBe(goldBefore + WAVE_1 * BEETLE_GOLD + WAVE_1_REWARD);
  await snap('playthrough-4-held');

  // Holding wave 1 earns the First hedge row trophy (src/trophies/), and nothing else yet.
  const trophies = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mazewright-trophies') ?? '{}')));
  expect(trophies, 'trophies earned in the first round').toEqual(['firstHold']);

  expect(errors).toEqual([]);
  const seconds = gameMs / 1000;
  console.log(`Played ${seconds.toFixed(0)}s of game time at ${(seconds / ((Date.now() - startedAt) / 1000)).toFixed(1)}x`);
});
