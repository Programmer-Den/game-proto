import { expect, test, type Page } from '@playwright/test';

// Plays the first round with real inputs: picks Play the Burrow AI on the menu, walks the first mole
// a little with the ▶ button, aims an Acorn Rocket with a slingshot drag back from the mole, lets go
// to fire it over the hills, watches the blast dig a crater, then waits while the Burrow AI takes
// its turn, until the next blue mole is up.
// Game state is only read, through the `game` object the dev build puts on window.

interface State {
  screen: 'menu' | 'play' | 'over';
  phase: 'aim' | 'retreat' | 'settle' | 'over';
  mode: string;
  turn: number;
  turns: number;
  wind: number;
  weapon: string | null;
  active: { id: number; team: number; x: number; y: number; hp: number; alive: boolean } | null;
  craters: number;
  shots: number;
  busy: boolean;
  teams: { alive: number; hp: number }[];
  winner: number | null;
  view: { w: number; h: number };
}
type Spot = { x: number; y: number; w: number; h: number };

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
    state: () => read<State>((s) => s.state),
    /** Every button on screen by id: `play-ai`, `right`, `fire`. */
    buttons: () => read<Record<string, Spot>>((s) => s.buttons),
  };
}

test('plays the first round', async ({ page }, testInfo) => {
  // Seeded like the other games' tests, so the map, the wind and the AI's choices repeat.
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
  await page.goto('/games/burrow-brigade/');
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
      page.evaluate(() => !!(window as any).game?.scene.getScene('Game')?.buttons?.['play-ai'] && !!document.querySelector('.game-overlay')?.hasAttribute('hidden')),
    ),
    'menu drawn',
  ).toBe(true);
  startedAt = Date.now();

  const snap = async (name: string) =>
    testInfo.attach(name, { body: await page.screenshot({ path: testInfo.outputPath(`${name}.png`) }), contentType: 'image/png' });

  /** Where a point in the game's view is on the page. */
  async function onPage(at: { x: number; y: number }) {
    const box = (await canvas.boundingBox())!;
    const { view } = await game.state();
    const scale = box.width / view.w;
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

  // The menu; Play the Burrow AI starts a match with Blue Burrow, the player's team, to move.
  await snap('playthrough-0-menu');
  expect((await game.state()).screen).toBe('menu');
  await press('play-ai');
  let s = await game.state();
  expect(s.screen).toBe('play');
  expect(s.mode).toBe('ai');
  expect(s.turn, 'Blue Burrow goes first').toBe(0);
  expect(s.phase).toBe('aim');
  expect(s.weapon, 'the Acorn Rocket is ready').toBe('rocket');
  expect(s.teams.map((t) => t.alive), 'three moles a team').toEqual([3, 3]);
  const first = s.active!;
  expect(first.team).toBe(0);

  // Hold ▶ for a moment: the mole walks right.
  const right = await onPage((await game.buttons()).right);
  await page.mouse.move(right.x, right.y);
  await page.mouse.down();
  await play(600, async () => false, FRAME_MS);
  await page.mouse.up();
  await frame();
  s = await game.state();
  expect(s.active!.x, 'the mole walked right').toBeGreaterThan(first.x);

  // Aim: press on the mole and pull back down and to the left, like a slingshot, so the rocket
  // flies up and to the right over the hills.
  const mole = s.active!;
  const from = await onPage({ x: mole.x, y: mole.y - 10 });
  const to = await onPage({ x: mole.x - 90, y: mole.y - 10 + 64 });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await frame();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 6, from.y + ((to.y - from.y) * i) / 6);
    await frame();
  }
  await snap('playthrough-1-aim');
  await page.mouse.up();
  await frame();
  s = await game.state();
  expect(s.shots, 'the rocket is fired').toBe(1);
  expect(s.phase, 'a moment to scramble away').toBe('retreat');

  // The rocket bursts and digs a crater.
  expect(await play(8_000, async () => (await game.state()).craters >= 1), 'the rocket goes off').toBe(true);
  await play(200, async () => false, FRAME_MS);
  await snap('playthrough-2-blast');

  // The Burrow AI takes its turn with an Amber Burrow mole and fires.
  expect(
    await play(20_000, async () => {
      const now = await game.state();
      return now.turn === 1 && now.phase === 'aim';
    }),
    'Amber Burrow’s turn',
  ).toBe(true);
  s = await game.state();
  expect(s.active!.team).toBe(1);
  expect(await play(30_000, async () => (await game.state()).shots >= 2), 'the Burrow AI fires').toBe(true);
  await play(600, async () => false, FRAME_MS);
  await snap('playthrough-3-ai');

  // Then the next blue mole is up.
  expect(
    await play(30_000, async () => {
      const now = await game.state();
      return now.turn === 0 && now.phase === 'aim';
    }),
    'back to Blue Burrow',
  ).toBe(true);
  s = await game.state();
  expect(s.turns).toBe(2);
  expect(s.screen).toBe('play');
  expect(s.active!.id, 'the next mole in the rotation').not.toBe(first.id);

  // The match and the weapon used are saved for the menu's line.
  const stats = await page.evaluate(() => JSON.parse(localStorage.getItem('burrow-brigade-stats') ?? '{}'));
  expect(stats.games).toBe(1);
  expect(stats.used).toEqual(['rocket']);

  expect(errors).toEqual([]);
  const seconds = gameMs / 1000;
  console.log(`Played ${seconds.toFixed(0)}s of game time at ${(seconds / ((Date.now() - startedAt) / 1000)).toFixed(1)}x, ${s.craters} craters, health ${s.teams.map((t) => t.hp).join(' to ')}`);
});
