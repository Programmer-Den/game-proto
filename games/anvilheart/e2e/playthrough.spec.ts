import { expect, test, type Page } from '@playwright/test';

// Plays the first sale with real inputs: the first adventurer comes in for an Iron Shortsword, the
// forge makes two Rusty Daggers, one is dragged onto the other to merge them into a Shortsword,
// and the Shortsword is dragged onto the adventurer to sell it, as a player would with a finger.
// The merge starts a hammer streak; two more daggers are forged and merged in the streak ring's
// last second, which chains the streak and strikes a Masterwork Shortsword. That one is sold: it is
// exactly what was asked for, so it pays a tip and the Masterwork's half again, and raises the
// guild's reputation. The royal commission stands in the top bar throughout, untouched by the
// first round.
// Game state is only read, through the `game` object the dev build puts on window.

interface Adventurer {
  id: number;
  desk: number;
  wants: number;
  gem: boolean;
  patienceMs: number;
}
interface GameState {
  coins: number;
  slots: (number | null)[];
  adventurers: Adventurer[];
  heatMs: number;
  sold: number;
  walkedOff: number;
  bestTier: number;
  ranks: Record<string, number>;
  commission: { level: number; made: number };
  stars: number;
  reputation: number;
  streak: number;
  streakSlot: number;
  streakMs: number;
}
type Spot = { x: number; y: number };

const VIEW = { w: 960, h: 540 };
/** The first adventurer always wants an Iron Shortsword (tier 2), worth 10 coins: src/game/state.ts and swords.ts. */
const FIRST_ORDER = 2;
const SHORTSWORD_PRICE = 10;
/** The exact sword asked for pays 50% on top, rounded down (`EXACT_TIP`): 15 coins for the Shortsword. */
const EXACT_FIT_PAY = Math.floor(SHORTSWORD_PRICE * 1.5);
/** How long after a merge the next one still chains into a hammer streak (`STREAK_MS`). */
const STREAK_MS = 4000;
/** Guild reputation starts at 50 (`REP_START`) and an exact fit raises it by 5 (`REP_EXACT`). */
const REP_START = 50;
const REP_EXACT = 5;
/** A merge in the streak ring's last second (`MASTER_MS`) strikes a Masterwork, flagged by adding `MASTER` to the sword. */
const MASTER_MS = 1000;
const MASTER = 400;
/** A Masterwork pays half again (`MASTER_PAY`), rounded down: 22 coins for the exact-fit Shortsword. */
const MASTER_FIT_PAY = Math.floor(EXACT_FIT_PAY * 1.5);
/** A second merge in a streak pays 5 coins times its length (`STREAK_COINS`): 10 coins. */
const STREAK_PAY = 10;

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
    /** Where the Forge button, each anvil's sword and each adventurer are on screen. */
    spots: () => read<{ forge: Spot; slots: Spot[]; desks: Spot[] }>((s) => s.spots()),
  };
}

test('plays the first sale', async ({ page }, testInfo) => {
  // A seeded Math.random keeps the adventurers and their orders the same from run to run.
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
  // animation frame at a time, so the shop plays the same on a slow runner as on a fast one.
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
  await page.goto('/games/anvilheart/');
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

  /** Presses on `from`, slides over to `to` a frame at a time and lets go, like a finger. */
  async function drag(from: Spot, to: Spot, midway?: () => Promise<unknown>) {
    const a = await toPage(from);
    const b = await toPage(to);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await wait(STEP_MS);
    for (let i = 1; i <= 8; i++) {
      await page.mouse.move(a.x + ((b.x - a.x) * i) / 8, a.y + ((b.y - a.y) * i) / 8);
      await wait(FRAME_MS);
      if (i === 6) await midway?.();
    }
    await page.mouse.up();
    await wait(STEP_MS);
  }

  // A new smithy: no coins, every anvil empty, nobody at the counter yet.
  let s = await game.state();
  expect(s).toMatchObject({ coins: 0, sold: 0, bestTier: 0, adventurers: [] });
  expect(s.slots).toHaveLength(16);
  expect(s.slots.every((t) => t === null)).toBe(true);
  // The first royal commission (a Golden Claymore) stands from the start, with no stars and no streak.
  expect(s).toMatchObject({ commission: { level: 0, made: 0 }, stars: 0, streak: 0, streakMs: 0 });
  // The guild's reputation starts in the middle of its meter.
  expect(s.reputation).toBe(REP_START);
  const spots = await game.spots();

  // The first adventurer walks up to the counter and asks for an Iron Shortsword.
  s = await until('the first adventurer', (s) => s.adventurers.length > 0, 5_000);
  const buyer = s.adventurers[0];
  expect(buyer).toMatchObject({ desk: 0, wants: FIRST_ORDER, gem: false });

  // Tapping Forge makes a Rusty Dagger on the first anvil; the forge then has to heat up again.
  await tap(spots.forge);
  s = await game.state();
  expect(s.slots[0]).toBe(1);
  expect(s.heatMs).toBeGreaterThan(0);
  await tap(spots.forge);
  expect((await game.state()).slots[1], 'no second sword while the forge heats').toBeNull();
  // Three more, each once the forge is hot again: four daggers for two Shortswords.
  for (let n = 2; n <= 4; n++) {
    await until('the forge is hot again', (s) => s.heatMs === 0, 5_000);
    await tap(spots.forge);
  }
  s = await game.state();
  expect(s.slots.slice(0, 5)).toEqual([1, 1, 1, 1, null]);
  await wait(500);
  await snap('0-forged');

  // Dragging one dagger onto another merges them into an Iron Shortsword.
  await drag(spots.slots[1], spots.slots[0], () => snap('1-dragging'));
  s = await game.state();
  expect(s.slots.slice(0, 4)).toEqual([FIRST_ORDER, null, 1, 1]);
  expect(s.bestTier).toBe(FIRST_ORDER);
  // The merge starts a hammer streak on that anvil; a lone merge pays no bonus and, with no ring
  // running before it, is no Masterwork.
  expect(s).toMatchObject({ streak: 1, streakSlot: 0, coins: 0 });
  expect(s.streakMs).toBeGreaterThan(0);
  expect(s.streakMs).toBeLessThanOrEqual(STREAK_MS);
  await wait(500);
  await snap('2-merged');

  // Merging the other two in the streak ring's last second chains the streak, which pays its
  // bonus, and strikes a Masterwork Shortsword. The drag is started early enough for its release
  // to land in that second: `play` moves game time in whole STEP_MS steps, so a drag takes two
  // steps for the press and one per move before it lets go.
  const dragMs = (2 + 8) * STEP_MS;
  s = await until('the streak ring nears its last second', (s) => s.streakMs <= MASTER_MS + dragMs - STEP_MS, STREAK_MS);
  expect(s.streak).toBe(1);
  expect(s.streakMs).toBeGreaterThan(dragMs);
  await drag(spots.slots[3], spots.slots[2]);
  s = await game.state();
  expect(s.slots.slice(0, 4)).toEqual([FIRST_ORDER, null, FIRST_ORDER + MASTER, null]);
  expect(s).toMatchObject({ streak: 2, streakSlot: 2, coins: STREAK_PAY });
  await wait(300);
  await snap('3-masterwork');

  // Dragging the Masterwork onto the adventurer sells it: it is exactly what they asked for, so they
  // pay its price, a 50% tip and half again for the Masterwork, and leave, and the guild's
  // reputation rises. Midway the adventurer's tag shows the price.
  await drag(spots.slots[2], spots.desks[buyer.desk], () => snap('4-exact-fit'));
  s = await game.state();
  expect(s.slots.slice(0, 3)).toEqual([FIRST_ORDER, null, null]);
  expect(s).toMatchObject({ coins: STREAK_PAY + MASTER_FIT_PAY, sold: 1, walkedOff: 0, reputation: REP_START + REP_EXACT });
  expect(s.adventurers.some((a) => a.id === buyer.id)).toBe(false);
  await wait(400);
  await snap('5-sold');
  // The Masterwork and the first sale earn their trophies (src/trophies/), and nothing else yet.
  const trophies = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('anvilheart-trophies') ?? '{}')));
  expect(trophies.sort(), 'trophies earned in the first round').toEqual(['firstSale', 'masterwork']);

  // With no third merge the streak runs out, and the commission is still the first one.
  s = await until('the hammer streak runs out', (s) => s.streak === 0, STREAK_MS + 1_000);
  expect(s).toMatchObject({ streakMs: 0, coins: STREAK_PAY + MASTER_FIT_PAY, commission: { level: 0, made: 0 }, stars: 0 });

  const speed = gameMs / (Date.now() - startedAt);
  console.log(`Played ${Math.round(gameMs / 1000)}s of game time at ${speed.toFixed(1)}x (target ${SPEED}x).`);
  expect(errors).toEqual([]);
});
