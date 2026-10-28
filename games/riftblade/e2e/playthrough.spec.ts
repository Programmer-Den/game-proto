import { expect, test, type Page } from '@playwright/test';

// Plays the first minute of a run with real inputs: on the hero select screen, where only
// Legionary TR-9 is open and the eleven other heroes still locked, waits for the game to settle,
// taps a locked card (no Fight button), then TR-9's card and Fight. Then walks him in a wide circle
// by holding the mouse down at a point that turns around him, as a thumb on a phone would, while
// his spread rifle fires on its own. Bots die and drop lumen shards he picks up, the first
// level-up pauses the run on three cards, and the test taps the first one and checks the upgrade
// was taken. It fires the signature move (Brace) from its round button, then plays on to the
// one-minute mark, taking the first card at each later level-up.
// Game state is only read, through the `game` object the dev build puts on window.

interface GameState {
  phase: 'select' | 'run' | 'levelup' | 'won' | 'lost';
  hero: string | null;
  time: number;
  player: { x: number; y: number; hp: number; maxHp: number; sigMs: number; sigActiveMs: number };
  level: number;
  xp: number;
  xpNext: number;
  ranks: Record<string, number>;
  choices: string[] | null;
  /** How many bots and shards are on the field. */
  enemies: number;
  shards: number;
  kills: number;
  signatures: number;
  damageTaken: number;
}
type Spot = { id: string; x: number; y: number; w: number; h: number; locked?: boolean };

const VIEW = { w: 960, h: 540 };
/** The hero stands in the middle of the view (layout.ts CENTER). */
const CENTER = { x: 480, y: 270 };
/** The round signature button, bottom right (layout.ts SIG_BUTTON). */
const SIG_BUTTON = { x: 890, y: 470 };
/** The heroes on the select screen, in order; on a fresh save only TR-9 is open. */
const HEROES = ['rook', 'tr9', 'bram', 'kael', 'vharn', 'oom', 'corvin', 'veyl', 'kresh', 'joren', 'elara', 'triad'];
/** Legionary TR-9's health and paths (heroes.ts) and how long his Brace lasts (sim.ts). */
const TR9 = { hp: 150, braceMs: 3000, paths: ['suppressor', 'riot-shield', 'drop-doctrine'] };
/** Where the test holds the mouse: this far from the hero, turning once every `turnMs` of game time. */
const WALK = { reach: 150, turnMs: 25_000 };
/** How long the test plays in all, ms of game time. */
const PLAY_MS = 60_000;

/**
 * Game time per animation frame, every frame the same length. Longer frames mean fewer to draw, so
 * the game can play at SPEED on a CI runner without a GPU.
 */
const FRAME_MS = 64;
/**
 * How many frames Phaser takes to settle after starting: it cuts each step short for its first 120
 * frames (`panicMax`), then averages steps over the last 10. A few more for good measure.
 */
const STARTUP_FRAMES = 140;
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
    /** The state, with only counts of the bots and shards (it is read every frame). */
    state: () =>
      read<GameState>((s) => {
        const { enemies, shards, player, ranks, choices } = s.state;
        const plain = Object.fromEntries(Object.entries(s.state).filter(([, v]) => typeof v !== 'object' || v === null));
        return { ...plain, player: { ...player }, ranks: { ...ranks }, choices: choices && [...choices], enemies: enemies.length, shards: shards.length } as GameState;
      }),
    /** The tappable cards of the panel showing (hero select or level-up). */
    spots: () => read<Spot[]>((s) => (s.panel ? s.panel.spots : [])),
  };
}

test('plays the first minute', async ({ page }, testInfo) => {
  // A seeded Math.random keeps the bots, drops and cards the same from run to run.
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
    // Animation frames fall on a fixed grid of frameMs steps of game time. The fake clock's timers
    // can fire a little late when a frame takes long in real time; aiming each frame at the next
    // grid point, and stamping it with that point, keeps every step the same length.
    let origin: number | null = null;
    window.requestAnimationFrame = (cb) => {
      const now = performance.now();
      origin ??= now;
      const due = origin + (Math.floor((now - origin) / frameMs) + 1) * frameMs;
      return window.setTimeout(() => cb(due), due - now);
    };
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
    // Phaser falls back to its canvas renderer. CI has no GPU, and WebGL in software is too slow to
    // play at SPEED; the game and its rules are the same either way.
    const getContext = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, id: string, ...rest: unknown[]) => unknown;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
      return /webgl/i.test(id) ? null : getContext.call(this, id, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  }, FRAME_MS);
  await page.goto('/games/riftblade/');
  const game = scene(page);
  const canvas = page.locator('canvas');

  let gameMs = 0;
  let startedAt = 0;

  /**
   * Advances game time a frame at a time until `done` holds; returns false if `ms` ran out first.
   * Once the game has started, each frame waits until real time catches up with game time / SPEED.
   */
  async function play(ms: number, done: () => Promise<boolean>) {
    for (let t = 0; t <= ms; t += FRAME_MS) {
      if (await done()) return true;
      await page.clock.runFor(FRAME_MS);
      if (!startedAt) continue;
      gameMs += FRAME_MS;
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

  /** Where a point in game pixels is on the page. */
  async function onPage(at: { x: number; y: number }) {
    const box = (await canvas.boundingBox())!;
    const scale = box.width / VIEW.w;
    return { x: box.x + at.x * scale, y: box.y + at.y * scale };
  }
  /** Taps the screen at a point in game pixels, as a player would. */
  async function tap(at: { x: number; y: number }) {
    const p = await onPage(at);
    await page.mouse.click(p.x, p.y);
  }
  const middle = (r: Spot) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

  // The hero select screen: twelve heroes and the Fight button, and no run yet. On a fresh save
  // only TR-9 is open; the others are locked behind their deeds. The test waits here
  // until Phaser's start-up easing is over (its first STARTUP_FRAMES steps are cut short), so the
  // run always starts at full step length, however long the page took to load.
  await play(STARTUP_FRAMES * FRAME_MS, async () => false);
  let s = await game.state();
  expect(s).toMatchObject({ phase: 'select', hero: null, level: 1, kills: 0 });
  let spots = await game.spots();
  expect(spots.map((c) => c.id)).toEqual([...HEROES, 'fight']);
  expect(spots.filter((c) => c.locked).map((c) => c.id), 'all but TR-9 start locked').toEqual(HEROES.filter((id) => id !== 'tr9'));
  await snap('0-select');

  // A locked card (Captain Rook's) shows only its placeholder: no Fight button.
  await tap(middle(spots[0]));
  await play(FRAME_MS, async () => false);
  expect((await game.spots()).some((c) => c.id === 'fight'), 'no Fight for a locked hero').toBe(false);

  // Tapping TR-9's card chooses him; it does not start the run yet.
  await tap(middle(spots[1]));
  await play(FRAME_MS, async () => false);
  s = await game.state();
  expect(s.phase, 'still choosing').toBe('select');
  expect(await page.evaluate(() => (window as any).game.scene.getScene('Game').chosen)).toBe('tr9');

  // Tapping Fight starts the run as TR-9.
  spots = await game.spots();
  const fight = spots.find((c) => c.id === 'fight')!;
  expect(fight, 'a Fight button').toBeTruthy();
  await tap(middle(fight));
  await play(FRAME_MS, async () => false);
  s = await game.state();
  expect(s).toMatchObject({ phase: 'run', hero: 'tr9', level: 1, ranks: {}, choices: null });
  expect(s.player.hp).toBe(TR9.hp);

  /** Holds the mouse down at the point of the walking circle for the current game time. */
  let held = false;
  let aimedAt = -Infinity;
  async function steer(time: number) {
    // The point turns slowly, so the mouse only needs moving every quarter second or so.
    if (held && time - aimedAt < 250) return;
    aimedAt = time;
    const a = time / (WALK.turnMs / (Math.PI * 2));
    const p = await onPage({ x: CENTER.x + Math.cos(a) * WALK.reach, y: CENTER.y + Math.sin(a) * WALK.reach });
    await page.mouse.move(p.x, p.y);
    if (!held) {
      await page.mouse.down();
      held = true;
    }
  }
  async function letGo() {
    if (held) await page.mouse.up();
    held = false;
  }

  // Walk the circle until the first level-up. Bots come; TR-9's rifle shoots them down on its
  // own, and the shards they drop are picked up on the way.
  let walked = 0;
  const ok = await play(PLAY_MS, async () => {
    s = await game.state();
    walked = Math.max(walked, Math.hypot(s.player.x, s.player.y));
    if (s.phase !== 'run') return true;
    await steer(s.time);
    return false;
  });
  await letGo();
  expect(ok, `reached a level-up; state ${JSON.stringify(s)}`).toBe(true);
  expect(s.phase).toBe('levelup');
  expect(walked, 'TR-9 walked away from where he started').toBeGreaterThan(100);
  expect(s.kills, 'bots shot down').toBeGreaterThan(0);
  expect(s.level).toBe(2);
  expect(s.player.hp).toBeGreaterThan(0);

  // The level-up waits on three different cards, at least one from TR-9's own paths.
  expect(s.choices).toHaveLength(3);
  expect(new Set(s.choices).size).toBe(3);
  expect(s.choices!.some((id) => TR9.paths.includes(id)), 'a path of his own on offer').toBe(true);
  spots = await game.spots();
  expect(spots.map((c) => c.id)).toEqual(s.choices);
  const paused = s.time;
  await play(1_000, async () => false);
  expect((await game.state()).time, 'the run waits for the pick').toBe(paused);
  await snap('1-level-up');

  // Tapping the first card takes that upgrade at tier 1, and the run goes on.
  const picked = spots[0].id;
  await tap(middle(spots[0]));
  await play(FRAME_MS * 2, async () => false);
  s = await game.state();
  expect(s.ranks).toEqual({ [picked]: 1 });
  expect(s.phase).toBe('run');
  expect(s.time, 'running again').toBeGreaterThan(paused);

  // The signature button fires Brace.
  await tap(SIG_BUTTON);
  await play(FRAME_MS * 2, async () => false);
  s = await game.state();
  expect(s.signatures).toBe(1);
  expect(s.player.sigActiveMs, 'Brace is on').toBeGreaterThan(TR9.braceMs - 500);
  expect(s.player.sigMs, 'and recharging').toBeGreaterThan(0);

  // Play on to the minute mark, taking the first card at any later level-up.
  let levelUps = 1;
  let snapped = false;
  const lasted = await play(PLAY_MS, async () => {
    s = await game.state();
    if (s.phase === 'lost' || s.time >= PLAY_MS) return true;
    if (s.phase === 'levelup') {
      await letGo();
      const cards = await game.spots();
      await tap(middle(cards[0]));
      levelUps += 1;
      return false;
    }
    await steer(s.time);
    if (!snapped && s.time > 45_000) {
      snapped = true;
      await snap('2-run');
    }
    return false;
  });
  await letGo();
  expect(lasted, 'played to the minute mark').toBe(true);
  s = await game.state();
  expect(s.phase, `alive after a minute; state ${JSON.stringify(s)}`).toBe('run');
  expect(s.time).toBeGreaterThanOrEqual(PLAY_MS);
  expect(s.player.hp).toBeGreaterThan(0);
  expect(s.level, 'more level-ups on the way').toBeGreaterThan(2);
  expect(Object.values(s.ranks).reduce((a, b) => a + b, 0), 'an upgrade tier for each card taken').toBeGreaterThanOrEqual(levelUps);
  expect(levelUps).toBeGreaterThan(1);
  expect(s.enemies, 'bots keep coming').toBeGreaterThan(0);
  // The run is saved only between worlds, so none is saved in the first one.
  expect(await page.evaluate(() => localStorage.getItem('riftblade-run')), 'no save mid-world').toBeNull();

  const speed = gameMs / (Date.now() - startedAt);
  console.log(`Played ${Math.round(gameMs / 1000)}s of game time at ${speed.toFixed(1)}x (target ${SPEED}x).`);
  expect(errors).toEqual([]);
});
