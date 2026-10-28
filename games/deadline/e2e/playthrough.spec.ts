import { expect, test, type Page } from '@playwright/test';

// Plays the first wave with real inputs (a tap to move, as on a phone): the art style switch is
// tapped to night vision and back, the horde comes down its lanes and the hero moves under it to shoot it down while the progress strip
// fills, the hero moves under the wave's pickup and shoots it open for an upgrade, then under the
// wave's fuel drum and blows it up among the horde, and the wave is cleared without the horde
// reaching the hero. Kills in quick succession build the frenzy streak along the way, and every kill
// earns scrap, banked when the wave is cleared.
// Game state is only read, through the `game` object the dev build puts on window.

type Point = { x: number; y: number };
type UpgradeKind = 'rate' | 'damage' | 'companion' | 'pierce';
interface Stats { damage: number; fireInterval: number; companions: number; pierce: number }
interface GameState {
  wave: number;
  phase: 'wave' | 'break' | 'supply' | 'role' | 'over';
  kills: number;
  stats: Stats;
  collected: Record<UpgradeKind, number>;
  best: number;
  fallen: number;
  waveTotal: number;
  streak: number;
  frenzyMs: number;
  frenzies: number;
  drumsBlown: number;
  lastBlast: { caught: number; killed: number } | null;
  scrap: number;
  bank: number;
  startKit: string[];
  sandbags: number;
}
interface Pickup { id: number; upgrade: UpgradeKind; hp: number; maxHp: number; x: number; y: number }
interface Drum { id: number; hp: number; maxHp: number; x: number; y: number; caught: number }

// From src/game/rules.ts: the 540x960 portrait view, the hero's line, wave 1's size.
const VIEW = { w: 540, h: 960 };
const HERO_Y = 880;
const WAVE_1_ENEMIES = 12;
/** From SCRAP in src/game/rules.ts: scrap for a grunt, wave 1's only zombie. */
const GRUNT_SCRAP = 1;
/** The art style switch in the top bar (STYLE_SWITCH in src/scenes/Hud.ts): its two halves. */
const SWITCH = { comic: { x: 456, y: 42 }, nv: { x: 506, y: 42 } };
/** From FRENZY in src/game/rules.ts: kills this close together build the streak. */
const STREAK_GAP_MS = 1500;
/** While no zombie is lower than this, the test may leave the front to shoot a drum. */
const FRONT_SAFE_Y = 600;
const BASE_STATS: Stats = { damage: 1, fireInterval: 340, companions: 0, pierce: 0 };
/** What each pickup does to the hero's starting stats. */
const UPGRADED: Record<UpgradeKind, Stats> = {
  rate: { ...BASE_STATS, fireInterval: 272 },
  damage: { ...BASE_STATS, damage: 2 },
  companion: { ...BASE_STATS, companions: 1 },
  pierce: { ...BASE_STATS, pierce: 1 },
};

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
    state: () => read<GameState>((s) => JSON.parse(JSON.stringify(s.state))),
    hero: () => read<{ x: number; y: number; moving: boolean }>((s) => ({ x: s.player.x, y: s.player.y, moving: s.pointerTarget !== null })),
    enemies: () => read<{ id: number; kind: string; x: number; y: number }[]>((s) => s.liveEnemies()),
    pickups: () => read<Pickup[]>((s) => s.livePickups()),
    drums: () => read<Drum[]>((s) => s.liveDrums()),
    style: () => read<string>((s) => s.style),
  };
}

test('plays the first wave', async ({ page }, testInfo) => {
  // A seeded Math.random keeps the waves the same from run to run.
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
  // The test owns the clock: game time only moves when the test advances it, one FRAME_MS animation
  // frame at a time, so the horde behaves the same on a slow runner as on a fast one.
  const start = new Date('2026-01-01T00:00:00Z');
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1_000));
  await page.addInitScript((frameMs) => {
    window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), frameMs);
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
    // Phaser falls back to its canvas renderer: CI has no GPU, and WebGL in software is too slow to
    // play at SPEED. The game and its rules are the same either way.
    const getContext = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, id: string, ...rest: unknown[]) => unknown;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
      return /webgl/i.test(id) ? null : getContext.call(this, id, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  }, FRAME_MS);
  await page.goto('/games/deadline/');
  const game = scene(page);
  // The game's canvas; the page behind it has a canvas of its own for the side panels.
  const canvas = page.locator('#game canvas');

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

  /**
   * Plays on until `check` holds, for up to `ms` of game time; the horde must never get through.
   * `act` gets a turn between checks, to play the game.
   */
  async function until(what: string, check: (s: GameState) => boolean, ms = 30_000, act?: () => Promise<void>) {
    let state = await game.state();
    const ok = await play(ms, async () => {
      state = await game.state();
      if (state.phase === 'over' || check(state)) return true;
      await act?.();
      return false;
    });
    if (!ok || state.phase === 'over') {
      throw new Error(`${state.phase === 'over' ? 'The horde reached the hero' : `Timed out after ${ms}ms of game time`} waiting for: ${what}\n` +
        `Hero at ${JSON.stringify(await game.hero())}, state ${JSON.stringify(state)}, enemies ${JSON.stringify(await game.enemies())}`);
    }
    return state;
  }

  const snap = async (name: string) =>
    testInfo.attach(name, { body: await page.screenshot({ path: testInfo.outputPath(`${name}.png`) }), contentType: 'image/png' });

  /** Taps a spot on the battlefield, as a player would. */
  async function tap(to: Point) {
    const box = (await canvas.boundingBox())!;
    const scale = box.width / VIEW.w;
    await page.mouse.click(box.x + to.x * scale, box.y + to.y * scale);
  }

  /** Taps a spot and waits for the hero to get below it. */
  async function tapAndMove(to: Point) {
    await tap(to);
    let hero = await game.hero();
    const arrived = await play(5_000, async () => {
      hero = await game.hero();
      return !hero.moving && Math.abs(hero.x - to.x) < 1;
    });
    expect(arrived, `move to x ${to.x}; the hero is at ${JSON.stringify(hero)}`).toBe(true);
  }

  expect(
    await play(10_000, () => page.evaluate(() => !!(window as any).game?.scene.getScene('Game')?.player)),
    'game started',
  ).toBe(true);
  startedAt = Date.now();

  // Wave 1 starts at once, with the hero in the middle of their line and the starting stats. It is
  // the best wave reached so far (nothing was saved before), and the record is saved at once.
  let s = await game.state();
  expect(s).toMatchObject({ wave: 1, phase: 'wave', kills: 0, stats: BASE_STATS, best: 1, fallen: 0, waveTotal: WAVE_1_ENEMIES, streak: 0, frenzies: 0, drumsBlown: 0 });
  // A first run has no scrap banked, so it starts without starting crates or sandbags.
  expect(s).toMatchObject({ scrap: 0, bank: 0, startKit: [], sandbags: 0 });
  expect(await game.hero()).toEqual({ x: VIEW.w / 2, y: HERO_Y, moving: false });
  expect(await page.evaluate(() => localStorage.getItem('deadline-best'))).toBe('1');

  // The game is drawn as a comic by default. Tapping the switch in the top bar changes it to the
  // night-vision feed (saved), without moving the hero; tapping it again changes it back.
  expect(await game.style()).toBe('comic');
  await tap(SWITCH.nv);
  await play(300, async () => false);
  expect(await game.style()).toBe('nv');
  expect(await page.evaluate(() => localStorage.getItem('deadline-style'))).toBe('nv');
  expect(await game.hero()).toEqual({ x: VIEW.w / 2, y: HERO_Y, moving: false });
  await snap('0-night-vision');
  await tap(SWITCH.comic);
  await play(300, async () => false);
  expect(await game.style()).toBe('comic');
  expect(await page.evaluate(() => localStorage.getItem('deadline-style'))).toBe('comic');
  expect((await game.hero()).moving).toBe(false);

  // The horde comes in at the top and walks down; the hero shoots on their own.
  let enemies = await game.enemies();
  expect(await play(5_000, async () => (enemies = await game.enemies()).length >= 3), 'the horde came in').toBe(true);
  expect(enemies.every((e) => e.kind === 'grunt' && e.y < HERO_Y)).toBe(true);
  await snap('1-horde');
  // The zombies keep to the middle of their lanes and never come after the hero, so the hero moves
  // below the one closest to their line, as a player would.
  const aimAtFront = async () => {
    const [hero, enemies] = [await game.hero(), await game.enemies()];
    if (hero.moving || enemies.length === 0) return;
    const front = enemies.reduce((a, b) => (b.y > a.y ? b : a));
    if (Math.abs(front.x - hero.x) > 8) await tap({ x: Math.round(front.x), y: VIEW.h / 2 });
  };
  s = await until('the first kill', (s) => s.kills > 0, 30_000, aimAtFront);
  // The progress strip counts the wave's zombies down as they fall.
  expect(s.fallen).toBe(s.kills);
  expect(s.streak).toBeGreaterThan(0);
  // Every kill earns scrap.
  expect(s.scrap).toBe(s.kills * GRUNT_SCRAP);

  // A fuel drum rolls down among the horde, its ring showing how many zombies its blast would catch.
  let drums = await game.drums();
  expect(await play(10_000, async () => (drums = await game.drums()).length > 0), 'a drum came in').toBe(true);
  expect(drums[0].hp).toBe(drums[0].maxHp);
  // Play on as a player would: stay below the zombie closest to the line, but once the drum's ring
  // has caught some of the horde and the front is not too close, stand below the drum instead.
  // Shooting it open blows it up, and every zombie in the ring goes down with it.
  let underDrum = false;
  const aimAtDrum = async () => {
    const [hero, enemies] = [await game.hero(), await game.enemies()];
    drums = await game.drums();
    if (hero.moving || enemies.length === 0) return;
    const front = enemies.reduce((a, b) => (b.y > a.y ? b : a));
    const drum = drums.find((d) => d.caught > 0);
    const target = drum && front.y < FRONT_SAFE_Y ? drum : front;
    if (Math.abs(target.x - hero.x) > 8) {
      await tap({ x: Math.round(target.x), y: VIEW.h / 2 });
      if (target === drum && !underDrum) {
        underDrum = true;
        await play(600, async () => false);
        await snap('2-drum');
      }
    }
  };
  const before = await game.state();
  s = await until('the drum blown up', (s) => s.drumsBlown === 1, 30_000, aimAtDrum);
  expect(underDrum, 'the hero went below the drum').toBe(true);
  expect(await game.drums()).toEqual([]);
  expect(s.lastBlast!.caught).toBeGreaterThan(0);
  // On wave 1 the blast is far stronger than a grunt: everyone it caught went down.
  expect(s.lastBlast!.killed).toBe(s.lastBlast!.caught);
  expect(s.kills).toBeGreaterThanOrEqual(before.kills + s.lastBlast!.killed);
  expect(s.fallen).toBe(s.kills);
  // A blast's kills come all at once, so they count towards the frenzy streak together.
  expect(s.streak).toBeGreaterThanOrEqual(s.lastBlast!.killed);
  await play(300, async () => false);
  await snap('3-blast');

  // A pickup came in among the enemies too. Tap above it: the hero moves along their line below it.
  let pickups = await game.pickups();
  expect(await play(10_000, async () => (pickups = await game.pickups()).length > 0), 'a pickup came in').toBe(true);
  const pickup = pickups[0];
  const heroX = Math.round(pickup.x);
  await tapAndMove({ x: heroX, y: VIEW.h / 2 });
  expect((await game.hero()).y).toBe(HERO_Y);
  await play(1_000, async () => false);
  await snap('4-pickup');

  // Shooting the crate open collects its upgrade.
  s = await until(`the ${pickup.upgrade} pickup opened`, (s) => s.collected[pickup.upgrade] === 1);
  expect(s.stats).toEqual(UPGRADED[pickup.upgrade]);
  expect((await game.pickups()).find((p) => p.id === pickup.id)).toBeUndefined();
  await snap('5-upgrade');

  // Play the rest of the wave the same way: whenever the hero is not below the enemy closest to
  // their line, tap above it. Every enemy falls before any reaches the hero, and the wave is cleared.
  s = await until('wave 1 cleared', (s) => s.phase === 'break', 60_000, aimAtFront);
  expect(s).toMatchObject({ wave: 1, kills: WAVE_1_ENEMIES, fallen: WAVE_1_ENEMIES, waveTotal: WAVE_1_ENEMIES });
  expect(await game.enemies()).toEqual([]);
  // The wave's scrap is banked as it is cleared, for starting crates on a later run.
  expect(s.scrap).toBe(WAVE_1_ENEMIES * GRUNT_SCRAP);
  expect(await page.evaluate(() => localStorage.getItem('deadline-scrap'))).toBe(String(WAVE_1_ENEMIES * GRUNT_SCRAP));
  await snap('6-cleared');
  // Clearing wave 1 earns the First night trophy (src/trophies/), and nothing else yet.
  const trophies = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('deadline-trophies') ?? '{}')));
  expect(trophies, 'trophies earned in the first round').toEqual(['firstWave']);
  s = await until('wave 2 started', (s) => s.wave === 2 && s.phase === 'wave', 5_000);
  // A new wave starts the strip again, and reaching it is a new best wave, saved.
  expect(s).toMatchObject({ best: 2, fallen: 0 });
  expect(await page.evaluate(() => localStorage.getItem('deadline-best'))).toBe('2');
  // A streak breaks once no kill comes for a moment.
  s = await until('the streak broken', (s) => s.streak === 0, STREAK_GAP_MS + 1_000);

  const speed = gameMs / (Date.now() - startedAt);
  console.log(`Played ${Math.round(gameMs / 1000)}s of game time at ${speed.toFixed(1)}x (target ${SPEED}x).`);
  expect(errors).toEqual([]);
});
