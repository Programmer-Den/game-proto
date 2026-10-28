import { expect, test, type Page } from '@playwright/test';

// Plays the first round of a match with real inputs: starts a match with the first commander,
// buys the first robot in the shop, taps it on the bench and then a tile on the board, presses
// FIGHT and watches the robot beat round 1-1's two scrap mites. The win keeps the commander at
// full health, drops a part, fills the damage meter and earns the First spark trophy, and round 1-2's plan phase starts. Game state is only read,
// through the `game` object the dev build puts on window.

interface Owned { uid: number; defId: string; star: number; items: string[] }
interface Player {
  seat: number;
  hp: number;
  gold: number;
  level: number;
  board: Record<string, Owned>;
  bench: (Owned | null)[];
  shop: ({ defId: string } | null)[];
  items: string[];
  streak: number;
}
interface MatchView {
  phase: 'plan' | 'fight' | 'result' | 'draft' | 'won' | 'lost';
  round: { stage: number; index: number; kind: string };
  result: { outcome: 'win' | 'loss' | 'draw'; damage: number; gold: number } | null;
  meter: { defId: string; dealt: number; taken: number }[];
  me: Player;
}

const VIEW = { w: 960, h: 540 };
/** The menu's START MATCH button (GameScene's menu, its centre). */
const START_BUTTON = { x: 635, y: 404 };
/** The first shop card (layout.ts shopCardX(0) plus half a card, SHOP.y plus half its height). */
const SHOP_CARD_1 = { x: 172 + 58, y: 482 };
/** The first bench slot (layout.ts benchX(0), BENCH.y). */
const BENCH_SLOT_1 = { x: 256, y: 394 };
/** Tile (3,4), the middle of the player's front row (layout.ts project(3, 4)). */
const FRONT_TILE = { x: 452, y: 231, key: '3,4' };
/** The FIGHT button (layout.ts BUTTONS.fight, its centre). */
const FIGHT_BUTTON = { x: 875, y: 464 };
/** Gold at the start (data.ts ECONOMY.startGold) and stage 1's income on the next round. */
const START_GOLD = 3;
/** Game time the round may take before the test gives up. */
const ROUND_LIMIT_MS = 90_000;

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

/** The parts of the match the test reads, copied out of the scene. */
function view(page: Page) {
  return page.evaluate(() => {
    const s = (window as any).game.scene.getScene('Game');
    const m = s.state;
    if (!m) return null;
    const copy = (x: unknown) => JSON.parse(JSON.stringify(x));
    return { phase: m.phase, round: copy(m.round), result: copy(m.result), meter: copy(m.meter), me: copy(m.players[0]) } as MatchView;
  });
}

test('plays the first round', async ({ page }, testInfo) => {
  // Seeded like the other games' tests, so the shops and rival boards repeat.
  await page.addInitScript(() => {
    let seed = 20261017;
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
  // animation frame at a time, so a match plays the same on a slow runner as on a fast one.
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
  await page.goto('/games/scrapyard-titans/');
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
  /** Plays a little game time, letting the match and any pending clicks run. */
  const tick = (ms: number) => play(ms, async () => false);

  expect(
    // The menu takes clicks once the scene has drawn and the loading screen is gone.
    await play(10_000, () =>
      page.evaluate(() => !!(window as any).game?.scene.getScene('Game')?.sys.isActive() && !document.querySelector('.game-overlay.loading')),
    ),
    'game started',
  ).toBe(true);
  startedAt = Date.now();

  const snap = async (name: string) =>
    testInfo.attach(name, { body: await page.screenshot({ path: testInfo.outputPath(`${name}.png`) }), contentType: 'image/png' });

  /** A point in the 960x540 view, on the page. */
  async function onPage(x: number, y: number) {
    const b = (await canvas.boundingBox())!;
    const scale = b.width / VIEW.w;
    return { x: b.x + x * scale, y: b.y + y * scale };
  }
  async function clickView(x: number, y: number) {
    const at = await onPage(x, y);
    await page.mouse.click(at.x, at.y);
    await tick(FRAME_MS * 2);
  }
  const state = async () => (await view(page))!;

  // The menu: the first commander and the first season are picked already, so START MATCH begins.
  await tick(FRAME_MS * 8);
  await snap('0-menu');
  await clickView(START_BUTTON.x, START_BUTTON.y);
  let s = await state();
  expect(s.phase, 'plan phase').toBe('plan');
  expect(s.round, 'round 1-1').toMatchObject({ stage: 1, index: 1 });
  expect(s.me.gold, 'starting gold').toBe(START_GOLD);
  expect(s.me.hp, 'full health on Normal').toBe(100);

  // Buy the first robot in the shop: it lands on the bench and its cost comes off the gold.
  const bought = s.me.shop[0]!.defId;
  await clickView(SHOP_CARD_1.x, SHOP_CARD_1.y);
  s = await state();
  expect(s.me.bench[0]?.defId, 'bought robot on the bench').toBe(bought);
  expect(s.me.shop[0], 'shop slot emptied').toBeNull();
  const goldAfterBuy = s.me.gold;
  expect(goldAfterBuy, 'gold spent').toBeLessThan(START_GOLD);
  await snap('1-bought');

  // Tap it on the bench, then tap a front-row tile: it moves onto the board.
  await clickView(BENCH_SLOT_1.x, BENCH_SLOT_1.y);
  await clickView(FRONT_TILE.x, FRONT_TILE.y);
  s = await state();
  expect(s.me.board[FRONT_TILE.key]?.defId, 'robot on tile 3,4').toBe(bought);
  expect(s.me.bench.every((b) => b === null), 'bench empty').toBe(true);

  // FIGHT: the robot takes on round 1-1's scrap mites.
  await clickView(FIGHT_BUTTON.x, FIGHT_BUTTON.y);
  s = await state();
  expect(s.phase, 'fight started').toBe('fight');
  await tick(1_500);
  await snap('2-fight');

  const toResult = await play(ROUND_LIMIT_MS, async () => (await state()).phase === 'result');
  s = await state();
  expect(toResult, `fight over; state: ${JSON.stringify(s)}`).toBe(true);
  expect(s.result?.outcome, 'round 1-1 won').toBe('win');
  expect(s.me.hp, 'no damage taken').toBe(100);
  expect(s.me.items.length, 'a part dropped').toBeGreaterThanOrEqual(1);
  // The damage meter in the info panel credits the robot with the fight's damage.
  expect(s.meter.map((r) => r.defId), 'damage meter rows').toEqual([bought]);
  expect(s.meter[0].dealt, 'damage dealt').toBeGreaterThan(0);
  // Winning the fight earns the First spark trophy (shared/trophies.ts saves it under the game's key).
  const earned = await page.evaluate(() => JSON.parse(localStorage.getItem('scrapyard-titans-trophies') ?? '{}'));
  expect(Object.keys(earned), 'First spark trophy').toContain('firstWin');
  await snap('3-result');

  // The next round's plan phase starts on its own, with the robot back on its tile.
  const toPlan = await play(ROUND_LIMIT_MS, async () => (await state()).phase === 'plan');
  s = await state();
  expect(toPlan, 'next plan phase').toBe(true);
  expect(s.round, 'round 1-2').toMatchObject({ stage: 1, index: 2 });
  expect(s.me.board[FRONT_TILE.key]?.defId, 'robot still placed').toBe(bought);
  expect(s.me.gold, 'income paid').toBeGreaterThan(goldAfterBuy);

  const speed = gameMs / (Date.now() - startedAt);
  console.log(`Played ${Math.round(gameMs / 1000)}s of game time at ${speed.toFixed(1)}x (target ${SPEED}x).`);
  expect(errors).toEqual([]);
});
