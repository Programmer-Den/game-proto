import { expect, test, type Page } from '@playwright/test';

// Plays the first round with real inputs: opens a Delve run from the menu, pencils a note into a
// cell, writes a wrong digit (which costs a heart) and erases it, then fills in every open cell of
// floor 1's 4x4 board with its digit from the number pad, takes the first relic offered and checks
// floor 2's 6x6 board starts with that relic's effect.
// Game state is only read, through the `game` object the dev build puts on window.

type RelicId = 'lantern' | 'heartstone' | 'seer' | 'ward' | 'twin' | 'gambler' | 'phoenix' | 'sandglass' | 'vow' | 'keystone';
interface GameState {
  phase: 'menu' | 'playing' | 'solved' | 'relic' | 'over';
  mode: 'classic' | 'daily' | 'delve';
  puzzle: { size: number; boxW: number; boxH: number; solution: number[]; givens: boolean[] } | null;
  values: number[];
  notes: number[];
  selected: number;
  notesMode: boolean;
  mistakes: number;
  hintsLeft: number;
  hintsUsed: number;
  hearts: number;
  maxHearts: number;
  floor: number;
  relics: RelicId[];
  relicOffer: RelicId[];
  progress: { solved: number; flawless: number; noHint: number; bestFloor: number; style: string; unlocked: string[] };
}
type Spot = { x: number; y: number; w: number; h: number };

const VIEW = { w: 960, h: 540 };
/** The rules the first round goes through, from src/game/state.ts. */
const HEARTS_NORMAL = 3;
const DELVE_HINTS = 1;
const MAX_HEARTS = 5;
const RELIC_OFFER = 3;
const SEER_CELLS = 2;
const FLOOR_1 = { size: 4, givens: 7 };
const FLOOR_2 = { size: 6, givens: 18 };

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
    state: () => read<GameState>((s) => JSON.parse(JSON.stringify({ ...s.state, events: undefined }))),
    screen: () => read<string>((s) => s.screen),
    /** Where each cell of the board is on screen, by its index. */
    cells: () => read<(Spot & { cell: number })[]>((s) => s.cellSpots),
    /** Every button on screen by id: `delve`, `key-1`..`key-9`, `notes`, `erase`, `relic-0`.. */
    buttons: () => read<Record<string, Spot>>((s) => s.buttons),
  };
}

test('plays the first round', async ({ page }, testInfo) => {
  // Seeded like the other games' tests, so the boards and relic offers repeat from run to run.
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
  // animation frame at a time, so the board's clock runs the same on a slow runner as on a fast one.
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
  await page.goto('/games/ninefold/');
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
    await play(10_000, () => page.evaluate(() => !!(window as any).game?.scene.getScene('Game')?.state)),
    'game started',
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
  /** Taps a point and lets a frame draw, as a player would. */
  async function tap(at: { x: number; y: number }) {
    const p = await onPage(at);
    await page.mouse.click(p.x, p.y);
    await play(FRAME_MS, async () => false, FRAME_MS);
  }
  async function press(id: string) {
    const spot = (await game.buttons())[id];
    expect(spot, `button ${id} on screen`).toBeTruthy();
    await tap(spot);
  }
  async function tapCell(cell: number) {
    await tap((await game.cells())[cell]);
    expect((await game.state()).selected, `cell ${cell} picked`).toBe(cell);
  }

  // The game opens on the menu, with only Paper Cut-out unlocked and nothing solved.
  await play(STEP_MS, async () => false);
  let s = await game.state();
  expect(await game.screen()).toBe('menu');
  expect(s).toMatchObject({ phase: 'menu', puzzle: null });
  expect(s.progress).toMatchObject({ solved: 0, style: 'paper', unlocked: ['paper'] });
  await snap('0-menu');

  // Delve starts on floor 1: a 4x4 board, with hearts and one hint.
  await press('delve');
  s = await game.state();
  expect(await game.screen()).toBe('board');
  expect(s).toMatchObject({ phase: 'playing', mode: 'delve', floor: 1, hearts: HEARTS_NORMAL, maxHearts: HEARTS_NORMAL, hintsLeft: DELVE_HINTS, relics: [], mistakes: 0 });
  const p = s.puzzle!;
  expect(p).toMatchObject({ size: FLOOR_1.size, boxW: 2, boxH: 2 });
  expect(p.givens.filter(Boolean).length).toBeGreaterThanOrEqual(FLOOR_1.givens);
  expect(s.values.every((v, i) => (p.givens[i] ? v === p.solution[i] : v === 0)), 'only the givens are filled').toBe(true);
  // The pad offers only 1 to 4 on a 4x4 board.
  expect(Object.keys(await game.buttons())).toEqual(expect.arrayContaining(['key-1', 'key-4', 'notes', 'erase', 'hint', 'menu']));
  await snap('1-floor-1');
  const open = p.givens.flatMap((g, i) => (g ? [] : [i]));

  // A note: in notes mode a digit is pencilled in, not written.
  const first = open[0];
  await tapCell(first);
  await press('notes');
  expect((await game.state()).notesMode).toBe(true);
  await press(`key-${p.solution[first]}`);
  s = await game.state();
  expect(s.values[first]).toBe(0);
  expect(s.notes[first]).toBe(1 << p.solution[first]);
  await press('notes');
  expect((await game.state()).notesMode).toBe(false);

  // A wrong digit stays on the board, counts a mistake and costs a heart; Erase clears it.
  const second = open[1];
  const wrong = (p.solution[second] % FLOOR_1.size) + 1;
  await tapCell(second);
  await press(`key-${wrong}`);
  s = await game.state();
  expect(s).toMatchObject({ mistakes: 1, hearts: HEARTS_NORMAL - 1, phase: 'playing' });
  expect(s.values[second]).toBe(wrong);
  await snap('2-mistake');
  await press('erase');
  expect((await game.state()).values[second]).toBe(0);

  // Every open cell gets its digit from the pad; the note goes when its cell is filled.
  for (const cell of open) {
    await tapCell(cell);
    await press(`key-${p.solution[cell]}`);
    s = await game.state();
    expect(s.values[cell], `cell ${cell} filled`).toBe(p.solution[cell]);
    expect(s.notes[cell]).toBe(0);
  }

  // The floor is cleared: it counts as solved (with a mistake, without hints), unlocks Cosy Pixel
  // and offers three different relics.
  s = await game.state();
  expect(s).toMatchObject({ phase: 'relic', floor: 1, mistakes: 1, hintsUsed: 0, hearts: HEARTS_NORMAL - 1 });
  expect(s.progress).toMatchObject({ solved: 1, flawless: 0, noHint: 1, bestFloor: 1 });
  expect(s.progress.unlocked).toEqual(['paper', 'pixel']);
  expect(new Set(s.relicOffer).size).toBe(RELIC_OFFER);
  await play(STEP_MS, async () => false);
  const saved = JSON.parse((await page.evaluate(() => localStorage.getItem('ninefold-progress')))!);
  expect(saved).toMatchObject({ solved: 1, bestFloor: 1, unlocked: ['paper', 'pixel'] });
  // The first solve earns the First fill trophy (src/trophies/), and nothing else yet: it had a mistake.
  const earned = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ninefold-trophies') ?? '{}')));
  expect(earned, 'trophies earned in the first round').toEqual(['firstSolve']);
  await snap('3-relics');

  // Taking the first relic goes down to floor 2, a 6x6 board, with the relic's effect.
  const relic = s.relicOffer[0];
  const before = s;
  await press('relic-0');
  s = await game.state();
  expect(s).toMatchObject({ phase: 'playing', floor: 2, relics: [relic], relicOffer: [], mistakes: 0 });
  const p2 = s.puzzle!;
  expect(p2).toMatchObject({ size: FLOOR_2.size, boxW: 3, boxH: 2 });
  expect(p2.givens.filter(Boolean).length).toBeGreaterThanOrEqual(FLOOR_2.givens);
  const revealed = s.values.filter((v, i) => v && !p2.givens[i]).length;
  switch (relic) {
    case 'lantern':
      expect(s.hintsLeft).toBe(before.hintsLeft + 1);
      break;
    case 'heartstone':
      expect(s.maxHearts).toBe(Math.min(MAX_HEARTS, before.maxHearts + 1));
      expect(s.hearts).toBe(before.hearts + 1);
      break;
    case 'seer':
      expect(revealed).toBe(SEER_CELLS);
      break;
    case 'twin':
      expect(s.maxHearts).toBe(before.maxHearts - 1);
      expect(s.notes.some((n, i) => n && !s.values[i]), 'candidates noted').toBe(true);
      break;
    case 'vow':
      expect(s.maxHearts).toBe(Math.min(MAX_HEARTS, before.maxHearts + 2));
      expect(s.hearts).toBe(before.hearts + 2);
      expect(s.hintsLeft).toBe(0);
      break;
    case 'ward':
    case 'gambler':
    case 'phoenix':
    case 'sandglass':
    case 'keystone':
      // These act later (on a mistake, a streak, a fast clear or a finished box).
      break;
  }
  if (relic !== 'seer') expect(revealed).toBe(0);
  if (relic !== 'heartstone' && relic !== 'vow') expect(s.hearts).toBe(Math.min(s.maxHearts, before.hearts));
  await play(1_000, async () => false);
  expect((await game.state()).puzzle!.size).toBe(FLOOR_2.size);
  await snap('4-floor-2');

  const speed = gameMs / (Date.now() - startedAt);
  console.log(`Played ${Math.round(gameMs / 1000)}s of game time at ${speed.toFixed(1)}x (target ${SPEED}x).`);
  expect(errors).toEqual([]);
});
