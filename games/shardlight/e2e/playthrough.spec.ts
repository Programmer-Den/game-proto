import { expect, test, type Page } from '@playwright/test';

// Plays the first round with real inputs: picks the first window on the map, launches the orb with a
// click and steers the bar with the mouse, breaking panes until the window is restored. The bar is
// put where the lowest orb will come down, off-centre so the orb flies back at the nearest pane
// still standing, as a player aims. On its first return the bar sweeps in under the orb, a spin shot
// that curves the orb's flight. Then back on the map the second window is open.
// Game state is only read, through the `game` object the dev build puts on window.

interface Orb {
  x: number;
  y: number;
  vx: number;
  vy: number;
  held: boolean;
  /** The bar spin it carries, -1 to 1. */
  spin: number;
}
interface Play {
  left: number;
  score: number;
  lives: number;
  result: 'won' | 'over' | null;
  barX: number;
  barY: number;
  barW: number;
  orbs: Orb[];
  /** Bar hits that gave the orb a spin. */
  spins: number;
  panes: { x: number; y: number; w: number; h: number }[];
}
interface State {
  screen: 'map' | 'play';
  window: number;
  stars: number[];
  lead: number;
  /** 1 for each window whose feat is done. */
  feats: number[];
  play: Play | null;
}
type Spot = { x: number; y: number; w: number; h: number };

const VIEW = { w: 960, h: 540 };
const ORB_R = 7;
/** The steepest an orb leaves the bar, from straight up (`MAX_BOUNCE` in `src/game/sim.ts`). */
const MAX_BOUNCE = (60 * Math.PI) / 180;
const FIELD_W = 768;

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
    /** Every button on screen by id: `window-0`, `result-map`. */
    buttons: () => read<Record<string, Spot>>((s) => s.buttons),
    /** The field's top left and size in view pixels. */
    field: () => read<Spot>((s) => s.field),
  };
}

/** Where an orb moving down crosses the line `y`, bouncing off the side walls on the way. */
function landing(orb: Orb, y: number) {
  const t = (y - orb.y) / orb.vy;
  let x = orb.x + orb.vx * t;
  const lo = ORB_R;
  const span = FIELD_W - 2 * ORB_R;
  x = (((x - lo) % (2 * span)) + 2 * span) % (2 * span);
  return lo + (x > span ? 2 * span - x : x);
}

test('plays the first round', async ({ page }, testInfo) => {
  // Seeded like the other games' tests, so the beads that drop and the shards repeat.
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
  await page.goto('/games/shardlight/');
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
    // The map's buttons are made before its first frame is drawn; the loading screen goes once it is.
    await play(10_000, () =>
      page.evaluate(() => !!(window as any).game?.scene.getScene('Game')?.buttons?.['window-0'] && !!document.querySelector('.game-overlay')?.hasAttribute('hidden')),
    ),
    'map drawn',
  ).toBe(true);
  startedAt = Date.now();

  const snap = async (name: string) =>
    await testInfo.attach(name, { body: await page.screenshot({ path: testInfo.outputPath(`${name}.png`) }), contentType: 'image/png' });

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

  // The map: only the first window is open, and nothing is restored yet.
  await snap('playthrough-0-map');
  let s = await game.state();
  expect(s.screen).toBe('map');
  expect(s.stars.every((n) => n === 0)).toBe(true);
  expect(Object.keys(await game.buttons())).not.toContain('window-1');

  await press('window-0');
  s = await game.state();
  expect(s.screen).toBe('play');
  expect(s.window).toBe(0);
  const field = await game.field();
  const first = s.play!;
  expect(first.left, 'the first window’s panes').toBe(24);
  expect(first.orbs).toHaveLength(1);
  expect(first.orbs[0].held, 'the orb waits on the bar').toBe(true);

  // A click on the field launches the orb.
  let p = await onPage({ x: field.x + first.barX, y: field.y + first.barY });
  await page.mouse.click(p.x, p.y);
  await frame();
  s = await game.state();
  expect(s.play!.orbs[0].held, 'the orb is launched').toBe(false);
  expect(s.play!.orbs[0].vy).toBeLessThan(0);

  /**
   * The spin shot: the frame before the orb comes down for the first time, the bar waits 40 to the
   * right of its spot, then sweeps left onto it in the last frame, so it is moving as it hits the orb (`SPIN_MIN` in
   * `src/game/sim.ts`). `spin` goes from wait to armed to swept, and to done once checked.
   */
  let spin: 'wait' | 'armed' | 'swept' | 'done' = 'wait';
  const SWEEP = 40;
  /** Puts the bar under the lowest falling orb, aimed back at the pane nearest the bar. */
  let lastX = -1;
  async function steer(state: Play) {
    if (spin === 'swept' && state.orbs.some((o) => o.vy < 0)) {
      // The orb is off the moving bar with a spin, turning it left, the way the bar swept.
      expect(state.spins, 'a spin shot').toBe(1);
      expect(state.orbs[0].spin, 'the orb spins the way the bar moved').toBeLessThan(-0.3);
      spin = 'done';
    }
    const falling = state.orbs.filter((o) => !o.held && o.vy > 0);
    if (!falling.length) return;
    const top = state.barY - ORB_R;
    // The orb that reaches the bar first.
    const orb = falling.reduce((a, b) => ((top - a.y) / a.vy <= (top - b.y) / b.vy ? a : b));
    const x = landing(orb, top);
    // The lowest pane, nearest the landing spot.
    const target = state.panes.reduce((a, b) => (b.y > a.y + 1 || (Math.abs(b.y - a.y) <= 1 && Math.abs(b.x - x) < Math.abs(a.x - x)) ? b : a), state.panes[0]);
    let barX = x;
    if (target) {
      const angle = Math.atan2(target.x + target.w / 2 - x, top - (target.y + target.h / 2));
      const k = Math.max(-0.85, Math.min(0.85, angle / MAX_BOUNCE));
      barX = x - (k * state.barW) / 2;
    }
    barX = Math.round(barX);
    const due = ((top - orb.y) / orb.vy) * 1000;
    if (spin === 'wait' && due > FRAME_MS && due <= 2 * FRAME_MS) spin = 'armed';
    if (spin === 'armed') {
      if (due > FRAME_MS) barX += SWEEP;
      else spin = 'swept';
    }
    if (barX === lastX) return;
    lastX = barX;
    p = await onPage({ x: field.x + barX, y: field.y + state.barY + 4 });
    await page.mouse.move(p.x, p.y);
  }

  let shot = false;
  const won = await play(
    240_000,
    async () => {
      const now = (await game.state()).play!;
      if (now.result) return true;
      if (!shot && now.left <= 12) {
        shot = true;
        await snap('playthrough-1-breaking');
      }
      await steer(now);
      return false;
    },
    FRAME_MS,
  );
  expect(won, 'window played out').toBe(true);
  expect(spin, 'the spin shot was played and checked').toBe('done');
  s = await game.state();
  expect(s.play!.result, 'the window is restored').toBe('won');
  expect(s.play!.left).toBe(0);
  expect(s.play!.score).toBeGreaterThan(0);
  expect(s.stars[0], 'stars for the first window').toBeGreaterThan(0);
  expect(s.lead, 'lead earned').toBeGreaterThan(0);

  // The result box comes up over the lit window.
  expect(await play(3_000, async () => !!(await game.buttons())['result-map']), 'result shown').toBe(true);
  await frame();
  await snap('playthrough-2-restored');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('shardlight-progress') ?? '{}'));
  expect(saved.stars[0]).toBe(s.stars[0]);
  // The first window's feat, restoring it in under a minute, pays its seal (`featOf` in src/game/levels.ts).
  expect(s.feats[0], 'the first window’s feat').toBe(1);
  expect(saved.feats[0]).toBe(1);

  // Back on the map, the second window is open.
  await press('result-map');
  s = await game.state();
  expect(s.screen).toBe('map');
  expect(Object.keys(await game.buttons())).toContain('window-1');
  await snap('playthrough-3-map');

  // Breaking a pane, restoring a window and losing no orb on the way earn their trophies (src/trophies/).
  const trophies = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('shardlight-trophies') ?? '{}')));
  expect(trophies.sort(), 'trophies earned in the first round').toEqual(['firstPane', 'firstWindow', 'flawless']);
  expect(s.stars[0], 'no orb lost: three stars').toBe(3);

  expect(errors).toEqual([]);
  const seconds = gameMs / 1000;
  console.log(`Played ${seconds.toFixed(0)}s of game time at ${(seconds / ((Date.now() - startedAt) / 1000)).toFixed(1)}x, ${s.stars[0]} stars, trophies ${trophies.join(', ')}`);
});
