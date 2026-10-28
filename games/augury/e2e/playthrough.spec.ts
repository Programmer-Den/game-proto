import { expect, test, type Page } from '@playwright/test';

// Plays the first round of Endless Medley with real inputs: opens the run from the menu, solves
// the first two puzzles the deck deals (whichever kinds the seeded deck picks, each by taps and
// drags like a player's) and checks their points and the streak, then skips the third and checks
// it costs a heart, and that the first solve earned its trophy. Game state is only read, through the `game` object the dev build puts on window.

type KindId = 'nonogram' | 'bridges' | 'code' | 'calc' | 'sums' | 'unjam' | 'flip' | 'link' | 'echo';
interface Card {
  kind: KindId;
  level: number;
}
interface Run {
  mode: string;
  phase: 'playing' | 'between' | 'draft' | 'relic' | 'handover' | 'over';
  hearts: number;
  score: number;
  streak: number;
  dealt: number;
  solved: number;
  current: { card: Card; state: any; timeLeftMs: number | null } | null;
  queue: Card[];
  results: { card: Card; reason: string; points: number }[];
}
type Spot = { x: number; y: number; w: number; h: number };

const VIEW = { w: 960, h: 540 };
/** The rules the first round goes through, from src/game/run.ts. */
const HEARTS_NORMAL = 3;
const QUEUE = 3;
const BETWEEN_MS = 1200;
const POINTS_PER_LEVEL = 100;
const KINDS: KindId[] = ['nonogram', 'bridges', 'code', 'calc', 'sums', 'unjam', 'flip', 'link', 'echo'];

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
    run: () => read<Run>((s) => JSON.parse(JSON.stringify({ ...s.run, events: undefined, progress: undefined }))),
    screen: () => read<string>((s) => s.screen),
    /** Every spot on screen by id: `mode-endless`, `cell-3`, `island-2`, `glyph-1`, `skip`.. */
    buttons: () => read<Record<string, Spot>>((s) => s.buttons),
  };
}

test('plays the first round', async ({ page }, testInfo) => {
  // Seeded like the other games' tests, so the deck deals the same puzzles from run to run.
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
  // animation frame at a time, so puzzle clocks run the same on a slow runner as on a fast one.
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
  await page.goto('/games/augury/');
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
    await play(10_000, () => page.evaluate(() => !!(window as any).game?.scene.getScene('Game')?.buttons?.['mode-endless'])),
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
  /** Taps a spot by its id and lets a frame draw. */
  async function press(id: string) {
    const spot = (await game.buttons())[id];
    expect(spot, `${id} on screen`).toBeTruthy();
    const p = await onPage(spot);
    await page.mouse.click(p.x, p.y);
    await frame();
  }

  /** Solves the puzzle in play with the moves a player would make, reading its answer from the state. */
  async function solve() {
    const run = await game.run();
    const s = run.current!.state;
    switch (run.current!.card.kind) {
      case 'nonogram':
        for (let k = 0; k < s.picture.length; k++) if (s.picture[k]) await press(`cell-${k}`);
        break;
      case 'flip':
        for (let k = 0; k < s.needed.length; k++) if (s.needed[k]) await press(`cell-${k}`);
        break;
      case 'bridges':
        for (const [a, b, n] of s.answer as [number, number, number][]) {
          for (let i = 0; i < n; i++) {
            await press(`island-${a}`);
            await press(`island-${b}`);
          }
        }
        break;
      case 'code':
        for (const glyph of s.code as number[]) await press(`glyph-${glyph}`);
        await press('code-guess');
        break;
      case 'calc':
        for (let k = 0; k < s.solution.length; k++) {
          await press(`cell-${k}`);
          await press(`key-${s.solution[k]}`);
        }
        break;
      case 'sums':
        for (let k = 0; k < s.solution.length; k++) {
          if (!s.open[k]) continue;
          await press(`cell-${k}`);
          await press(`key-${s.solution[k]}`);
        }
        break;
      case 'unjam':
        // Pick the block with a tap, then tap the free cell it should slide over.
        for (const [k, to] of s.solution as [number, number][]) {
          const b = (await game.run()).current!.state.blocks[k];
          await press(`block-${k}`);
          const from = b.across ? b.c : b.r;
          const target = to > from ? to + b.len - 1 : to;
          await press(`cell-${b.across ? b.r * 6 + target : target * 6 + b.c}`);
        }
        break;
      case 'link':
        // Drag along each answer path from one star to the other.
        for (const path of s.answer as number[][]) {
          const spots = await game.buttons();
          const first = await onPage(spots[`cell-${path[0]}`]);
          await page.mouse.move(first.x, first.y);
          await page.mouse.down();
          for (const cell of path.slice(1)) {
            const p = await onPage(spots[`cell-${cell}`]);
            await page.mouse.move(p.x, p.y);
          }
          await page.mouse.up();
          await frame();
        }
        break;
      case 'echo':
        // Answer every card from the back-th on: same when it matches the card that many steps back.
        expect(
          await play(60_000, async () => {
            const cur = (await game.run()).current!.state;
            if (cur.done) return true;
            if (cur.step >= cur.back && cur.answers[cur.step] === null) {
              await press(cur.seq[cur.step] === cur.seq[cur.step - cur.back] ? 'echo-same' : 'echo-diff');
            }
            return false;
          }),
          'memory echo answered',
        ).toBe(true);
        break;
    }
  }

  // The game opens on the menu; Endless Medley deals its first puzzle and three more up next.
  await snap('playthrough-0-menu');
  expect(await game.screen()).toBe('menu');
  await press('mode-endless');
  let run = await game.run();
  expect(run.mode).toBe('endless');
  expect(run.phase).toBe('playing');
  expect(run.hearts).toBe(HEARTS_NORMAL);
  expect(run.queue).toHaveLength(QUEUE);
  expect(KINDS).toContain(run.current!.card.kind);
  expect(run.current!.card.level).toBe(0);
  expect(run.current!.timeLeftMs, 'a timed puzzle').toBeGreaterThan(0);
  await snap('playthrough-1-first-puzzle');

  // Solve the first two puzzles: each scores at least its level's points, and the streak grows.
  for (let n = 1; n <= 2; n++) {
    run = await game.run();
    const kind = run.current!.card.kind;
    const upNext = run.queue[0].kind;
    expect(upNext, 'never the same kind twice in a row').not.toBe(kind);
    await solve();
    run = await game.run();
    expect(run.phase, `${kind} solved`).toBe('between');
    expect(run.results[n - 1].reason).toBe('solved');
    expect(run.results[n - 1].points).toBeGreaterThanOrEqual(POINTS_PER_LEVEL);
    expect(run.streak).toBe(n);
    expect(run.solved).toBe(n);
    if (n === 1) await snap('playthrough-2-solved');
    // The banner shows for a moment, then the card that was up next is dealt.
    expect(
      await play(BETWEEN_MS + 1_000, async () => (await game.run()).phase === 'playing'),
      'next puzzle dealt',
    ).toBe(true);
    run = await game.run();
    expect(run.current!.card.kind).toBe(upNext);
    expect(run.dealt).toBe(n + 1);
    expect(run.queue).toHaveLength(QUEUE);
  }

  // Skipping the third costs a heart and ends the streak; the score stays.
  const score = run.score;
  await snap('playthrough-3-third-puzzle');
  await press('skip');
  run = await game.run();
  expect(run.results[2].reason).toBe('skip');
  expect(run.hearts).toBe(HEARTS_NORMAL - 1);
  expect(run.streak).toBe(0);
  expect(run.score).toBe(score);
  expect(await play(BETWEEN_MS + 1_000, async () => (await game.run()).phase === 'playing'), 'fourth puzzle dealt').toBe(true);

  // The first puzzle solved earns the First sight trophy (src/trophies/), and nothing else yet.
  const trophies = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('augury-trophies') ?? '{}')));
  expect(trophies, 'trophies earned in the first round').toEqual(['firstSight']);

  expect(errors).toEqual([]);
  const seconds = gameMs / 1000;
  console.log(`Played ${seconds.toFixed(0)}s of game time at ${(seconds / ((Date.now() - startedAt) / 1000)).toFixed(1)}x`);
});
