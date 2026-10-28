import { expect, test, type Page } from '@playwright/test';

// Plays the first wave with real inputs: picks the pebble seed, checks the Thorn golem's card is
// still locked, taps soil to plant two seeds, waits for them to grow into golems, checks a tap on
// the path plants nothing, sends wave 1 in, sees the wave button offer to call wave 2 early once
// every beetle is in, and lets the golems squash every beetle before it reaches the Heartwood,
// which opens the Heartwood's first bud.
// Game state is only read, through the `game` object the dev build puts on window.

type GolemKind = 'pebble' | 'moss' | 'thorn';
interface Golem { id: number; kind: GolemKind; col: number; row: number; level: number; growMs: number }
interface GameState {
  wave: number;
  phase: 'build' | 'wave' | 'over';
  heart: number;
  sap: number;
  selected: GolemKind;
  golems: Golem[];
  pests: { kind: string; hp: number }[];
  queue: unknown[];
  kills: number;
  bloom: number;
}
type Rect = { x: number; y: number; w: number; h: number };

/** The board, from src/game/board.ts. */
const GRID = { x: 16, y: 64, cols: 12, rows: 7, cell: 64 };
/** What a garden starts with, the pebble seed's cost and growing time, from src/game/data.ts. */
const START = { sap: 60, heart: 10 };
const PEBBLE = { cost: 30, growMs: 3000 };
/** Wave 1: eight beetles worth 5 sap each, and 15 sap for clearing it. */
const WAVE_1 = { beetles: 8, bounty: 5, bonus: 15 };
/** Sap for calling the next wave early, from src/game/data.ts (EARLY_BONUS). */
const EARLY_BONUS = 15;
/**
 * Where the two pebble golems go: soil cells inside the path's bends, so each reaches two stretches
 * of it. The path runs along row 1, down column 3, along row 5 and up column 7.
 */
const PLANTS = [
  { col: 4, row: 4 },
  { col: 6, row: 4 },
];
/** A path cell, where nothing can be planted. */
const PATH_CELL = { col: 3, row: 3 };

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
    state: () => read<GameState>((s) => JSON.parse(JSON.stringify(s.state))),
    seedButtons: () => read<(Rect & { kind: GolemKind })[]>((s) => s.seedButtons),
    waveButton: () => read<Rect>((s) => s.waveButton),
    waveLabel: () => read<string>((s) => s.waveLabel),
    /** The view's width and the designed frame's offset in it, in view pixels. */
    view: () => read<{ w: number; x: number; y: number }>((s) => ({ w: s.cameras.main.width / s.cameras.main.zoom, x: s.frame.x, y: s.frame.y })),
  };
}

test('plays the first wave', async ({ page }, testInfo) => {
  // Seeded like the other games' tests, so any randomness added later repeats from run to run.
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
  await page.goto('/games/golem-garden/');
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

  // The view takes the window's shape around the designed 960x560 frame the board is laid out in.
  const view = await game.view();
  /** Where a point in the view is on the page. */
  async function onPage(x: number, y: number) {
    const box = (await canvas.boundingBox())!;
    const scale = box.width / view.w;
    return { x: box.x + x * scale, y: box.y + y * scale };
  }
  const cellPoint = (col: number, row: number) =>
    onPage(view.x + GRID.x + (col + 0.5) * GRID.cell, view.y + GRID.y + (row + 0.5) * GRID.cell);

  /** Taps a point, as a player would, then lets a few frames play. */
  async function tap(at: { x: number; y: number }) {
    await page.mouse.click(at.x, at.y);
    await play(STEP_MS, async () => false);
  }
  /** Plays until `done` holds, failing with the game state if it never does. */
  async function waitFor(name: string, ms: number, done: (s: GameState) => boolean) {
    const ok = await play(ms, async () => done(await game.state()));
    expect(ok, `${name}; state: ${JSON.stringify(await game.state())}`).toBe(true);
  }

  // A new garden: wave 1 waiting, the starting sap and a whole Heartwood, nothing planted.
  let s = await game.state();
  expect(s).toMatchObject({ wave: 1, phase: 'build', heart: START.heart, sap: START.sap, golems: [], pests: [], kills: 0, bloom: 0 });
  expect(await game.waveLabel()).toBe('Start wave 1');
  await snap('0-start');

  // Pick the pebble seed (picked already in a new garden, so tap the moss seed first and back).
  const buttons = await game.seedButtons();
  const button = (kind: GolemKind) => buttons.find((b) => b.kind === kind)!;
  await tap(await onPage(button('moss').x, button('moss').y));
  expect((await game.state()).selected).toBe('moss');
  await tap(await onPage(button('pebble').x, button('pebble').y));
  expect((await game.state()).selected).toBe('pebble');
  // The Thorn golem's seed stays locked until the Heartwood has bloomed: tapping its card picks nothing.
  await tap(await onPage(button('thorn').x, button('thorn').y));
  expect((await game.state()).selected).toBe('pebble');

  // Seeds only go on soil: a tap on the path plants nothing.
  await tap(await cellPoint(PATH_CELL.col, PATH_CELL.row));
  s = await game.state();
  expect(s).toMatchObject({ sap: START.sap, golems: [] });

  // Planting takes the seed's sap and starts a sprout growing.
  await tap(await cellPoint(PLANTS[0].col, PLANTS[0].row));
  s = await game.state();
  expect(s.sap).toBe(START.sap - PEBBLE.cost);
  expect(s.golems).toHaveLength(1);
  expect(s.golems[0]).toMatchObject({ kind: 'pebble', ...PLANTS[0], level: 1 });
  expect(s.golems[0].growMs).toBeGreaterThan(0);
  await snap('1-sprout');

  await tap(await cellPoint(PLANTS[1].col, PLANTS[1].row));
  s = await game.state();
  expect(s.sap).toBe(START.sap - 2 * PEBBLE.cost);
  expect(s.golems.map((g) => ({ col: g.col, row: g.row }))).toEqual(PLANTS);

  // The seeds grow into golems.
  await waitFor('golems grown', PEBBLE.growMs + 1000, (s) => s.golems.every((g) => g.growMs === 0));

  // Wave 1: the beetles come down the path and the golems squash every one of them.
  const wave = await game.waveButton();
  await tap(await onPage(wave.x, wave.y));
  expect((await game.state()).phase).toBe('wave');
  await waitFor('beetles in the garden', 5_000, (s) => s.pests.length >= 3);
  await snap('2-wave');
  // Once all of wave 1 has come in, the wave button offers to call wave 2 early (not taken here).
  await waitFor('all of wave 1 in', 15_000, (s) => s.queue.length === 0 && s.pests.length > 0);
  expect(await game.waveLabel()).toBe(`Call wave 2 now, +${EARLY_BONUS} early`);
  await waitFor('wave 1 cleared', 60_000, (s) => s.phase === 'build' && s.wave === 2);

  // No beetle reached the Heartwood; each one dropped its sap, and clearing the wave adds a bonus.
  s = await game.state();
  expect(s).toMatchObject({
    wave: 2,
    phase: 'build',
    heart: START.heart,
    kills: WAVE_1.beetles,
    sap: START.sap - 2 * PEBBLE.cost + WAVE_1.beetles * WAVE_1.bounty + WAVE_1.bonus,
    pests: [],
    bloom: 1,
  });
  expect(await game.waveLabel()).toBe('Start wave 2');
  // Clearing wave 1 earns the Green thumb trophy (src/trophies/), and nothing else yet.
  const trophies = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('golem-garden-trophies') ?? '{}')));
  expect(trophies, 'trophies earned in the first round').toEqual(['firstWave']);
  await snap('3-cleared');

  const speed = gameMs / (Date.now() - startedAt);
  console.log(`Played ${Math.round(gameMs / 1000)}s of game time at ${speed.toFixed(1)}x (target ${SPEED}x).`);
  expect(errors).toEqual([]);
});
