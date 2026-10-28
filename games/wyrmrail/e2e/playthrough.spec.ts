import { expect, test, type Page } from '@playwright/test';

// Plays the first round with real inputs: lays track from the Roost to Millbrook and Ashford by
// tapping tiles, as on a phone, taps the first order on the panel to send the wyrm, and watches it
// fetch the grain from Millbrook. The branch to Ashford makes a junction with a switch; the test
// taps the switch over so the wyrm can go on without stopping, and watches it deliver the grain to
// Ashford, which finishes the round.
// Game state is only read, through the `game` object the dev build puts on window.

type Tile = { c: number; r: number };
interface Order { id: number; cargo: string; from: number; to: number; pay: number; status: 'waiting' | 'queued' | 'loading' | 'carrying' }
interface GameState {
  phase: 'play' | 'over';
  coins: number;
  hearts: number;
  round: number;
  delivered: number;
  totalDelivered: number;
  track: string[];
  orders: Order[];
  queue: number[];
  switches: Record<string, string>;
  wyrms: { at: Tile; path: Tile[]; job: { order: number; leg: 'pickup' | 'drop' } | { leg: 'feed' } | null; switchMs: number }[];
}
type Spot = { id: number; x: number; y: number };

const VIEW = { w: 960, h: 540 };
/** The isometric grid, from src/scenes/layout.ts: the screen point of its top corner and a tile's diamond. */
const ISO = { ox: 288, oy: 84, tw: 76, th: 38 };
const center = (t: Tile) => ({ x: ISO.ox + ((t.c - t.r) * ISO.tw) / 2, y: ISO.oy + ((t.c + t.r + 1) * ISO.th) / 2 });
/** The Roost and the first two villages, from src/game/map.ts. */
const ROOST = { c: 1, r: 3 };
const MILLBROOK = { c: 4, r: 1 };
const ASHFORD = { c: 4, r: 5 };
/**
 * The track the test lays, all on grass: east from the Roost, then up to Millbrook and down to
 * Ashford. Laying the last piece makes (4,3) a junction, its switch set against the new branch.
 */
const TRACK: Tile[] = [
  { c: 2, r: 3 },
  { c: 3, r: 3 },
  { c: 4, r: 3 },
  { c: 4, r: 2 },
  { c: 4, r: 4 },
];
/** From src/game/state.ts and src/game/map.ts: starting coins, a grass tile's cost, the first order's pay. */
const START_COINS = 40;
const GRASS_COST = 2;
const FIRST_PAY = 22;
const JUNCTION = { c: 4, r: 3 };

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
    /** Where the order cards are on the panel. */
    orderSpots: () => read<Spot[]>((s) => s.orderSpots),
  };
}

test('plays the first round', async ({ page }, testInfo) => {
  // A seeded Math.random keeps the orders that come in the same from run to run.
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
  // animation frame at a time, so the run plays the same on a slow runner as on a fast one.
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
  await page.goto('/games/wyrmrail/');
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

  /** Plays on until `check` holds, for up to `ms` of game time. */
  async function until(what: string, check: (s: GameState) => boolean, ms = 10_000) {
    let state = await game.state();
    const ok = await play(ms, async () => check((state = await game.state())));
    if (!ok) throw new Error(`Timed out after ${ms}ms of game time waiting for: ${what}\nState ${JSON.stringify(state)}`);
    return state;
  }


  /** Taps a point of the 960x540 view, as a player would. */
  async function tap(p: { x: number; y: number }) {
    const box = (await canvas.boundingBox())!;
    const scale = box.width / VIEW.w;
    await page.mouse.click(box.x + p.x * scale, box.y + p.y * scale);
    await play(STEP_MS, async () => false);
  }
  const tapOrder = async (id: number) => {
    const spot = (await game.orderSpots()).find((o) => o.id === id);
    expect(spot, `order ${id} on the panel`).toBeTruthy();
    await tap(spot!);
  };

  // A new game: coins, three hearts, round 1, no track, and the first order: grain from Millbrook
  // to Ashford.
  let s = await until('the valley', () => true);
  expect(s).toMatchObject({ phase: 'play', coins: START_COINS, hearts: 3, round: 1, delivered: 0, track: [], queue: [] });
  expect(s.wyrms[0].at).toEqual(ROOST);
  expect(s.orders[0]).toMatchObject({ id: 1, cargo: 'grain', from: 0, to: 1, pay: FIRST_PAY, status: 'waiting' });
  await play(600, async () => false);
  await snap('0-valley');

  // With no track yet the wyrm can't reach Millbrook, so tapping the order does nothing.
  await tapOrder(1);
  s = await game.state();
  expect(s.orders[0].status, 'no track, no dispatch').toBe('waiting');
  expect(s.queue).toEqual([]);

  // Lay the track tile by tile; each piece on grass costs two coins.
  let coins = s.coins;
  for (const t of TRACK) {
    await tap(center(t));
    s = await game.state();
    expect(s.track, `track at ${t.c},${t.r}`).toContain(`${t.c},${t.r}`);
    expect(s.coins, `track at ${t.c},${t.r} costs ${GRASS_COST}`).toBe(coins - GRASS_COST);
    coins = s.coins;
  }
  expect(s.track).toHaveLength(TRACK.length);
  // The junction's switch is set against the branch just laid, towards Ashford.
  expect(s.switches).toEqual({ '4,3': '4,4' });
  // A tap on a tile away from the line lays nothing.
  await tap(center({ c: 0, r: 6 }));
  s = await game.state();
  expect(s.track).toHaveLength(TRACK.length);
  expect(s.coins).toBe(coins);
  await snap('1-track');

  // Send the wyrm: it flies along the track to Millbrook and loads the grain.
  await tapOrder(1);
  s = await game.state();
  expect(s.wyrms[0].job ?? { order: s.queue[0] }, 'the wyrm takes the order').toMatchObject({ order: 1 });
  s = await until('the wyrm loads grain at Millbrook', (s) => s.orders.find((o) => o.id === 1)?.status === 'loading', 6_000);
  expect(s.wyrms[0].at).toEqual(MILLBROOK);
  await play(300, async () => false);
  await snap('2-loading');

  // Set the junction's switch against the Roost's arm, so the way from Millbrook down to Ashford is
  // open: each tap sets it against the next arm.
  for (let taps = 0; s.switches['4,3'] !== '3,3'; taps++) {
    expect(taps, 'the switch comes round to the Roost arm').toBeLessThan(3);
    const before = s.switches['4,3'];
    await tap(center(JUNCTION));
    s = await game.state();
    expect(s.switches['4,3'], 'a tap throws the switch').not.toBe(before);
    expect(s.track, 'a tap on the junction lays nothing').toHaveLength(TRACK.length);
  }

  // It carries the grain down to Ashford.
  s = await until('the wyrm carries the grain', (s) => s.orders.find((o) => o.id === 1)?.status === 'carrying', 2_000);
  expect(s.wyrms[0].job).toMatchObject({ order: 1, leg: 'drop' });

  // Delivered: the order pays and leaves the board, and the round's one delivery finishes round 1.
  let stopped = false;
  s = await until('the grain delivered to Ashford', (s) => ((stopped ||= s.wyrms[0].switchMs > 0), !s.orders.some((o) => o.id === 1)), 6_000);
  expect(stopped, 'the switch was set for the wyrm, so it never stopped').toBe(false);
  expect(s.wyrms[0].at).toEqual(ASHFORD);
  expect(s).toMatchObject({ phase: 'play', coins: coins + FIRST_PAY, hearts: 3, round: 2, delivered: 0, totalDelivered: 1 });
  expect(s.wyrms[0].job).toBeNull();
  // The junction earned Points to set and the delivery First delivery (src/trophies/), and nothing else.
  const trophies = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('wyrmrail-trophies') ?? '{}')));
  expect(trophies.sort(), 'trophies earned in the first round').toEqual(['firstDelivery', 'firstSwitch']);
  await play(400, async () => false);
  await snap('3-delivered');

  const speed = gameMs / (Date.now() - startedAt);
  console.log(`Played ${Math.round(gameMs / 1000)}s of game time at ${speed.toFixed(1)}x (target ${SPEED}x).`);
  expect(errors).toEqual([]);
});
