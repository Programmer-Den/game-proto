import { expect, test, type Page } from '@playwright/test';

// Plays the first round with real inputs: picks Play White on the menu, opens with the king's pawn,
// and keeps developing until White can take a piece, then takes it and watches the capture scene
// play out, and the Stone AI answer. Captures are preferred as soon as one is legal, so the round
// ends at White's first capture; that earns the First blow trophy.
// Game state is only read, through the `game` object the dev build puts on window.

interface State {
  screen: 'menu' | 'play' | 'gallery';
  turn: 'w' | 'b';
  plies: number;
  busy: boolean;
  selected: number;
  result: unknown;
  captures: number;
  lastCapture: { pair: string; scene: string | null } | null;
  legal: string[];
}
type Spot = { x: number; y: number; w: number; h: number };

const VIEW = { w: 960, h: 540 };
/** White's opening plan, played in order while no capture is on; the first legal one is played. */
const PLAN = ['e2e4', 'g1f3', 'd2d4', 'b1c3', 'f1c4', 'c1e3', 'd1d2', 'a2a3', 'h2h3', 'b2b3', 'g2g3'];
/** Give up if White has found no capture after this many of its moves. */
const MAX_MOVES = 20;

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

const squareIndex = (name: string) => (8 - Number(name[1])) * 8 + 'abcdefgh'.indexOf(name[0]);

function scene(page: Page) {
  const read = <T>(fn: (s: any) => T) =>
    page.evaluate(`(${fn.toString()})(window.game.scene.getScene('Game'))`) as Promise<T>;
  return {
    state: () => read<State>((s) => s.state),
    /** Every button on screen by id: `play-white`, `undo`. */
    buttons: () => read<Record<string, Spot>>((s) => s.buttons),
    /** The board's top-left corner and square size in view pixels, and whether it is turned round. */
    board: () => read<{ x: number; y: number; size: number; flip: boolean }>((s) => s.board),
  };
}

test('plays the first round', async ({ page }, testInfo) => {
  // Seeded like the other games' tests, so the Stone AI's choices among equal moves repeat.
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
  // animation frame at a time, so the round plays the same on a slow runner as on a fast one.
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
  await page.goto('/games/stonemate/');
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
    // The menu's buttons are made before its first frame is drawn; the loading screen goes once it is.
    await play(10_000, () =>
      page.evaluate(() => !!(window as any).game?.scene.getScene('Game')?.buttons?.['play-white'] && !!document.querySelector('.game-overlay')?.hasAttribute('hidden')),
    ),
    'menu drawn',
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
  async function press(id: string) {
    const spot = (await game.buttons())[id];
    expect(spot, `${id} on screen`).toBeTruthy();
    const p = await onPage(spot);
    await page.mouse.click(p.x, p.y);
    await frame();
  }
  /** Taps a square by its name, like `e2`. */
  async function tapSquare(name: string) {
    const b = await game.board();
    const sq = squareIndex(name);
    const r = b.flip ? 7 - (sq >> 3) : sq >> 3;
    const c = b.flip ? 7 - (sq & 7) : sq & 7;
    const p = await onPage({ x: b.x + (c + 0.5) * b.size, y: b.y + (r + 0.5) * b.size });
    await page.mouse.click(p.x, p.y);
    await frame();
  }

  // The menu; Play White starts a game against the Stone AI with White to move.
  await snap('playthrough-0-menu');
  expect((await game.state()).screen).toBe('menu');
  await press('play-white');
  let s = await game.state();
  expect(s.screen).toBe('play');
  expect(s.turn).toBe('w');
  expect(s.plies).toBe(0);
  expect(s.legal, 'twenty opening moves').toHaveLength(20);

  // Picking up the king's pawn shows where it can go.
  await tapSquare('e2');
  s = await game.state();
  expect(s.selected).toBe(squareIndex('e2'));
  await snap('playthrough-1-pick');

  let moves = 0;
  let captured: string | null = null;
  /** White's capture as attacker and victim, like `pp`. */
  let pair = '';
  const kindAt = (board: number[], sq: string) => 'pnbrqk'[(board[squareIndex(sq)] & 7) - 1];
  while (!captured) {
    expect(moves, 'White found a capture').toBeLessThan(MAX_MOVES);
    s = await game.state();
    // Take a piece as soon as one can be taken, else play the next move of the plan.
    const board = await page.evaluate(() => (window as any).game.scene.getScene('Game').pos.board as number[]);
    const capture = s.legal.find((m) => board[squareIndex(m.slice(2, 4))] !== 0);
    const move = capture ?? PLAN.find((m) => s.legal.includes(m)) ?? s.legal[0];
    if (s.selected >= 0 && s.selected !== squareIndex(move.slice(0, 2))) await tapSquare(move.slice(0, 2));
    if (s.selected < 0) await tapSquare(move.slice(0, 2));
    await tapSquare(move.slice(2, 4));
    moves++;
    const plies = s.plies;
    if (capture) {
      // The capture scene plays: the attacker strikes, the victim breaks.
      expect(await play(1_500, async () => (await game.state()).busy), 'capture under way').toBe(true);
      await play(900, async () => false);
      await snap('playthrough-2-capture');
      captured = capture;
      pair = kindAt(board, capture.slice(0, 2)) + kindAt(board, capture.slice(2, 4));
    }
    // White's move is made, and the Stone AI answers.
    expect(
      await play(30_000, async () => {
        const now = await game.state();
        return now.plies >= plies + 2 && !now.busy && now.turn === 'w';
      }),
      `move ${move} and the reply`,
    ).toBe(true);
    s = await game.state();
    expect(s.result, 'the game goes on').toBeNull();
  }

  s = await game.state();
  expect(s.captures, 'at least White’s capture').toBeGreaterThanOrEqual(1);
  // White's capture is recorded as a pair seen, attacker first.
  const stats = await page.evaluate(() => JSON.parse(localStorage.getItem('stonemate-stats') ?? '{}'));
  expect(stats.pairs, 'White’s capture pair seen').toContain(pair);
  // The game is saved for later, move by move.
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('stonemate-game') ?? 'null'));
  expect(saved.moves).toHaveLength(s.plies);
  expect(saved.moves[0]).toBe('e2e4');
  await frame();
  await snap('playthrough-3-reply');

  // Taking a piece earns the First blow trophy (src/trophies/), and nothing else yet.
  const trophies = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('stonemate-trophies') ?? '{}')));
  expect(trophies, 'trophies earned in the first round').toEqual(['firstCapture']);

  expect(errors).toEqual([]);
  const seconds = gameMs / 1000;
  console.log(`Played ${seconds.toFixed(0)}s of game time at ${(seconds / ((Date.now() - startedAt) / 1000)).toFixed(1)}x, ${moves} White moves to the first capture (${captured})`);
});
