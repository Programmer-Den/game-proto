import { expect, test, type Page } from '@playwright/test';

// Plays the first quest with real taps: the knight walks to Elder Wren and hears her out, walks to
// the chest by the shed and takes the Old Blade, brings it back to the elder, and cuts the thorns
// over the north gate, which opens the way to the woods. Game state is only read, through the
// `game` object the dev build puts on window.

type Quest = 'start' | 'blade' | 'thorns' | 'shrine' | 'return' | 'done';
interface GameState {
  map: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  items: { sword: boolean; hookvine: boolean; oil: boolean };
  keys: number;
  moonstones: string[];
  flags: string[];
  quest: Quest;
  falls: number;
}

const VIEW = { w: 960, h: 540 };
const TILE = 32;
/** The village, from src/game/maps.ts: the elder, the shed's chest, and the thorns over the north gate. */
const GATE = { x: 19, y: 3 };
/** A spot on the main street below the gate, for walking up before cutting. */
const STREET = { x: 19, y: 7 };
/** Normal difficulty starts with three hearts, counted in halves. */
const START_HP = 6;

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
    /** Who is talking and which line is shown, or null. */
    dialog: () => read<{ speaker: string; i: number; lines: string[] } | null>((s) => (s.dialog ? { speaker: s.dialog.speaker, i: s.dialog.i, lines: s.dialog.lines } : null)),
    walking: () => read<boolean>((s) => !!s.route?.length),
    /** Where a person or chest is, in the world. */
    spot: (kind: 'npc' | 'chest', id: string) =>
      page.evaluate(([k, i]) => (window as any).game.scene.getScene('Game').spot(k, i), [kind, id] as const) as Promise<{ x: number; y: number }>,
    /** Where a point in the world is in the 960x540 view. */
    screenOf: (p: { x: number; y: number }) =>
      page.evaluate((q) => (window as any).game.scene.getScene('Game').screenOf(q.x, q.y), p) as Promise<{ x: number; y: number }>,
  };
}

test('plays the first quest', async ({ page }, testInfo) => {
  // Seeded like the other games' tests, so the foes' wandering repeats from run to run.
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
  // animation frame at a time, so the knight walks the same on a slow runner as on a fast one.
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
  await page.goto('/games/bramblecrest/');
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
    await testInfo.attach(name, { body: await page.screenshot({ path: testInfo.outputPath(`${name}.png`) }), contentType: 'image/png' });

  /** Where a point in the 960x540 view is on the page. */
  async function onPage(p: { x: number; y: number }) {
    const box = (await canvas.boundingBox())!;
    const scale = box.width / VIEW.w;
    return { x: box.x + p.x * scale, y: box.y + p.y * scale };
  }
  /** Taps a point in the world, as a player would; it has to be on screen and clear of the HUD. */
  async function tapWorld(p: { x: number; y: number }, what: string) {
    const v = await game.screenOf(p);
    expect(v.x > 0 && v.x < VIEW.w && v.y > 70 && v.y < VIEW.h, `${what} is on screen at ${Math.round(v.x)},${Math.round(v.y)}`).toBe(true);
    const at = await onPage(v);
    await page.mouse.click(at.x, at.y);
  }
  /** Taps a point and plays until the knight stops walking. */
  async function walkTo(p: { x: number; y: number }, what: string) {
    await tapWorld(p, what);
    expect(await game.walking(), `a way to ${what}`).toBe(true);
    const arrived = await play(15_000, async () => !(await game.walking()));
    const s = await game.state();
    expect(arrived, `walk to ${what} (feet at ${Math.round(s.x)},${Math.round(s.y)})`).toBe(true);
  }
  /** Taps a person or chest, plays until its text opens, then taps through every line. */
  async function talkTo(kind: 'npc' | 'chest', id: string, speaker: string) {
    await tapWorld(await game.spot(kind, id), `${kind} ${id}`);
    const opened = await play(15_000, async () => !!(await game.dialog()));
    const s = await game.state();
    expect(opened, `${kind} ${id} talks (feet at ${Math.round(s.x)},${Math.round(s.y)})`).toBe(true);
    const d = (await game.dialog())!;
    expect(d.speaker).toBe(speaker);
    for (let i = 0; i < d.lines.length; i++) {
      expect((await game.dialog())?.i).toBe(i);
      await play(FRAME_MS * 2, async () => false, FRAME_MS);
      await page.mouse.click((await onPage({ x: 480, y: 300 })).x, (await onPage({ x: 480, y: 300 })).y);
    }
    expect(await game.dialog(), `${kind} ${id} is done talking`).toBeNull();
    return d.lines;
  }

  // A new game starts in the village square at night, with no blade and three hearts.
  await play(STEP_MS * 2, async () => false);
  let s = await game.state();
  expect(s).toMatchObject({ map: 'village', quest: 'start', hp: START_HP, maxHp: START_HP, items: { sword: false, hookvine: false, oil: false }, keys: 0, moonstones: [], flags: [] });
  await snap('0-start');

  // Elder Wren asks for grandfather's blade from the shed.
  const elder = await talkTo('npc', 'elder', 'Elder Wren');
  expect(elder.join(' ')).toContain('blade');
  s = await game.state();
  expect(s.quest).toBe('blade');
  await snap('1-elder');

  // The chest in front of the shed holds the Old Blade.
  const blade = await talkTo('chest', 'blade', '');
  expect(blade[0]).toContain('Old Blade');
  s = await game.state();
  expect(s.items.sword).toBe(true);
  expect(s.flags).toContain('chest-blade');
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('bramblecrest-save')))!)).toMatchObject({ items: { sword: true } });
  await snap('2-blade');

  // Back to the elder, who sends the knight to the north gate.
  await talkTo('npc', 'elder', 'Elder Wren');
  expect((await game.state()).quest).toBe('thorns');

  // Up the main street, then a tap on the thorns walks next to them and swings the blade, which
  // clears both and opens the gate.
  await walkTo({ x: (STREET.x + 0.5) * TILE, y: (STREET.y + 0.5) * TILE }, 'the main street');
  await tapWorld({ x: (GATE.x + 0.5) * TILE, y: (GATE.y + 0.5) * TILE }, 'the gate thorns');
  const cut = await play(10_000, async () => (await game.state()).flags.includes('gate-cut'));
  s = await game.state();
  expect(cut, `thorns cut (feet at ${Math.round(s.x)},${Math.round(s.y)})`).toBe(true);
  expect(s).toMatchObject({ quest: 'shrine', map: 'village', hp: START_HP });
  expect(JSON.parse((await page.evaluate(() => localStorage.getItem('bramblecrest-save')))!)).toMatchObject({ quest: 'shrine' });
  await play(STEP_MS * 3, async () => false);
  await snap('3-gate');

  const speed = gameMs / (Date.now() - startedAt);
  console.log(`Played ${Math.round(gameMs / 1000)}s of game time at ${speed.toFixed(1)}x (target ${SPEED}x).`);
  expect(errors).toEqual([]);
});
