import { expect, test, type Page } from '@playwright/test';

// Plays the first night with real inputs: taps a lantern so a moth flies out and lights it, sends a
// moth to sit on it when a gust is coming for it (shielding it), saves it with a close-call refill
// when its oil is nearly gone, then lights the rest late in the dusk so they are all lit when night
// falls, which keeps the herald's order, pays coins and opens the night panel.
// Game state is only read, through the `game` object the dev build puts on window.

interface Lantern {
  x: number;
  y: number;
  lit: boolean;
  oilMs: number;
  oilMaxMs: number;
  claimed: boolean;
}
interface Moth {
  kind: 'fast' | 'slow' | 'heavy';
  x: number;
  y: number;
  task: 'idle' | 'out' | 'lighting' | 'guard' | 'home';
  target: number;
}
interface GameState {
  night: number;
  phase: 'dusk' | 'night' | 'over';
  duskMs: number;
  coins: number;
  lives: number;
  lanterns: Lantern[];
  moths: Moth[];
  queue: number[];
  report: {
    lit: number;
    count: number;
    required: number;
    earned: number;
    lostHearth: boolean;
    orderMet: boolean;
    chains: number;
    festival: boolean;
  } | null;
  kept: number;
  order: { text: string; goal: { kind: string; lanterns?: number[] }; reward: number };
  gusts: number[];
  gust: { target: number; atMs: number } | null;
  closeCalls: number;
  shields: number;
  kind: string;
  batTimes: number[];
  bats: unknown[];
}

const VIEW = { w: 960, h: 540 };
/** The first night's numbers, from src/game/state.ts (on Normal). */
const DUSK_MS = 45_000;
const LANTERNS = 5;
const REQUIRED = 3;
const MOTHS = 3;
const LIVES = 3;
const BURN_MS = 20_000;
/** Night 1's herald's order: both towers and the keep (lanterns 0, 1 and 2) lit at nightfall, for 15. */
const ORDER_LANTERNS = [0, 1, 2];
const ORDER_REWARD = 15;
/** Every lantern lit pays 5 coins each and a 10 coin bonus, and the order its reward. */
const NIGHTFALL_PAY = LANTERNS * 5 + 10 + ORDER_REWARD;
/** Night 1's one gust hits with 34s of dusk left, warned 5s before. */
const GUST_AT_MS = 34_000;
const GUST_WARN_MS = 5_000;
/** A refill of a lantern with under 15% of its oil left is a close call and pays 2 at once. */
const CLOSE_CALL = 0.15;
const CLOSE_CALL_PAY = 2;

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
    /** True once the night panel is showing. */
    panelOpen: () => read<boolean>((s) => s.panelOpen),
  };
}

test('plays the first night', async ({ page }, testInfo) => {
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
  // animation frame at a time, so the dusk plays the same on a slow runner as on a fast one.
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
  await page.goto('/games/lanternkeep/');
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
  /** Plays until `done` holds on the game state, failing with `what` and the state if it never does. */
  async function until(what: string, ms: number, done: (s: GameState) => boolean) {
    const ok = await play(ms, async () => done(await game.state()));
    expect(ok, `${what}; state: ${JSON.stringify(await game.state())}`).toBe(true);
  }

  expect(
    await play(10_000, () => page.evaluate(() => !!(window as any).game?.scene.getScene('Game')?.state)),
    'game started',
  ).toBe(true);
  startedAt = Date.now();

  const snap = async (name: string) =>
    testInfo.attach(name, { body: await page.screenshot({ path: testInfo.outputPath(`${name}.png`) }), contentType: 'image/png' });

  /** Where a point in the 960x540 view is on the page. */
  async function onPage(x: number, y: number) {
    const box = (await canvas.boundingBox())!;
    const scale = box.width / VIEW.w;
    return { x: box.x + x * scale, y: box.y + y * scale };
  }
  /** Taps lantern `i`, as a player would, then lets a frame play. */
  async function tapLantern(i: number) {
    const l = (await game.state()).lanterns[i];
    const at = await onPage(l.x, l.y);
    await page.mouse.click(at.x, at.y);
    await play(FRAME_MS, async () => false);
  }
  const busy = (s: GameState) => s.moths.filter((m) => m.task !== 'idle').length;

  // The first dusk: a clear night with five dark lanterns, three moths in the jar, three hearths and
  // no coins, the herald's order and one gust to come, and no bats.
  let s = await game.state();
  expect(s).toMatchObject({ night: 1, phase: 'dusk', coins: 0, lives: LIVES, kept: 0, closeCalls: 0, shields: 0, gust: null, kind: 'clear' });
  expect(s.batTimes).toEqual([]);
  expect(s.duskMs).toBeGreaterThan(DUSK_MS - 1_000);
  expect(s.lanterns).toHaveLength(LANTERNS);
  expect(s.lanterns.every((l) => !l.lit)).toBe(true);
  expect(s.moths).toHaveLength(MOTHS);
  expect(s.moths.map((m) => m.kind)).toEqual(['fast', 'slow', 'heavy']);
  expect(s.queue).toEqual([]);
  expect(busy(s)).toBe(0);
  expect(s.order.goal).toEqual({ kind: 'lit', lanterns: ORDER_LANTERNS });
  expect(s.order.reward).toBe(ORDER_REWARD);
  expect(s.gusts).toEqual([GUST_AT_MS]);
  await snap('0-dusk');

  // A tap on a lantern sends one moth; a second tap on it sends no other.
  await tapLantern(0);
  s = await game.state();
  expect(busy(s), 'one moth sent').toBe(1);
  expect(s.lanterns[0].claimed).toBe(true);
  await tapLantern(0);
  expect(busy(await game.state()), 'still one moth').toBe(1);
  await until('moth lights lantern 0', 10_000, (s) => s.lanterns[0].lit);
  s = await game.state();
  expect(s.lanterns[0].oilMs).toBeGreaterThan(BURN_MS - 1_000);
  await snap('1-first-lantern');
  await until('moth flies home', 10_000, (s) => busy(s) === 0);

  // A gust is warned for the only lit lantern. A moth sent to it stays sitting on it until the gust
  // has passed, so it shields the lantern, then flies home.
  await until('gust warned', DUSK_MS, (s) => s.gust !== null);
  s = await game.state();
  expect(s.gust).toEqual({ target: 0, atMs: GUST_AT_MS });
  expect(s.duskMs).toBeGreaterThan(GUST_AT_MS + GUST_WARN_MS - 500);
  await tapLantern(0);
  await until('moth guards lantern 0', GUST_WARN_MS, (s) => s.moths.some((m) => m.task === 'guard' && m.target === 0));
  s = await game.state();
  expect(s.gust, 'gust still coming').not.toBeNull();
  await snap('2-gust-shield');
  await until('gust passes', GUST_WARN_MS, (s) => s.gust === null);
  s = await game.state();
  expect(s.shields, 'gust shielded').toBe(1);
  expect(s.lanterns[0].lit, 'lantern 0 still lit').toBe(true);
  await until('guard flies home', 10_000, (s) => busy(s) === 0);

  // Its oil runs low: a refill now is a close call, which pays at once.
  await until('lantern 0 nearly dry', BURN_MS, (s) => s.lanterns[0].oilMs < s.lanterns[0].oilMaxMs * CLOSE_CALL);
  s = await game.state();
  expect(s.lanterns[0].lit).toBe(true);
  const coins = s.coins;

  // Late in the dusk, light them all so they still burn at nightfall: three moths go at once, the
  // first to save lantern 0. The taps for lanterns 3 and 4 find every moth busy, so they wait in
  // the queue, and a moth takes each one as it comes home. A tap on a lantern a moth is already
  // flying to is ignored.
  for (const i of [0, 1, 2]) await tapLantern(i);
  expect(busy(await game.state()), 'every moth out').toBe(MOTHS);
  await tapLantern(3);
  s = await game.state();
  expect(s.queue, 'tap kept in the queue').toEqual([3]);
  expect(s.lanterns[3].claimed, 'not claimed until a moth takes it').toBe(false);
  await tapLantern(4);
  expect((await game.state()).queue, 'second tap kept').toEqual([3, 4]);
  await tapLantern(2);
  expect((await game.state()).queue, 'tap on a claimed lantern ignored').toEqual([3, 4]);
  await until('close call paid', 5_000, (s) => s.closeCalls === 1);
  s = await game.state();
  expect(s.coins, 'close call pays at once').toBe(coins + CLOSE_CALL_PAY);
  expect(s.lanterns[0].oilMs, 'lantern 0 refilled').toBeGreaterThan(BURN_MS - 1_000);
  await until('every lantern lit', 12_000, (s) => s.lanterns.every((l) => l.lit));
  s = await game.state();
  expect(s.queue, 'queue emptied').toEqual([]);
  expect(s.phase).toBe('dusk');
  await snap('3-all-lit');

  // Night falls with every lantern lit: they pay, the bonus and the herald's order too, and no
  // hearth goes out.
  await until('night falls', 20_000, (s) => s.phase === 'night');
  s = await game.state();
  // The first night has no lantern chain (each needs a lantern from a later night).
  expect(s.report).toEqual({
    lit: LANTERNS,
    count: LANTERNS,
    required: REQUIRED,
    earned: NIGHTFALL_PAY,
    lostHearth: false,
    orderMet: true,
    chains: 0,
    festival: false,
  });
  expect(s).toMatchObject({ coins: NIGHTFALL_PAY + CLOSE_CALL_PAY, lives: LIVES, kept: 1 });
  expect(await play(3_000, () => game.panelOpen()), 'night panel opens').toBe(true);
  await snap('4-night');
  // The close call earned Just in time and the night kept First light (src/trophies/), and nothing else yet.
  const trophies = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('lanternkeep-trophies') ?? '{}')));
  expect(trophies, 'trophies earned in the first round').toEqual(['closeCall', 'firstNight']);

  const speed = gameMs / (Date.now() - startedAt);
  console.log(`Played ${Math.round(gameMs / 1000)}s of game time at ${speed.toFixed(1)}x (target ${SPEED}x).`);
  expect(errors).toEqual([]);
});
