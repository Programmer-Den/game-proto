import { expect, test, type Page } from '@playwright/test';

// Plays the first wave with real inputs: the helm buttons are held down to steer, as a thumb would
// on a phone, and a fire control is held to aim and charge a broadside and let go to fire it once
// an enemy is off that side. Sunk ships leave loot to sail over, and the harbor opens once the
// wave is beaten, where a perk is picked from the prize draft, one upgrade is bought and a side's
// guns loaded with chain shot before setting sail for wave 2.
// Game state is only read, through the `game` object the dev build puts on window.

type Side = 'port' | 'starboard';
interface Ship {
  id: number;
  kind: string;
  x: number;
  y: number;
  heading: number;
  hp: number;
  maxHp: number;
  reload: Record<Side, number>;
  slowMs: number;
}
interface GameState {
  phase: 'break' | 'fighting' | 'harbor' | 'over' | 'won';
  hull: string;
  wave: number;
  toSpawn: string[];
  player: Ship;
  helm: number;
  aim: Record<Side, boolean>;
  charge: Record<Side, number | null>;
  order: string;
  wind: number;
  loadout: Record<Side, string>;
  enemies: Ship[];
  balls: { fromPlayer: boolean; shot: string }[];
  loot: { x: number; y: number; gold: number }[];
  gold: number;
  plundered: number;
  sunk: number;
  ranks: Record<string, number>;
  perks: string[];
  draft: string[];
  bounty: string | null;
  bestWave: number;
}
type Button = { id: string; x: number; y: number; w: number; h: number };

const VIEW = { w: 960, h: 540 };
/** The size of the sea, from src/game/state.ts; it wraps around at its edges. */
const WORLD = { w: 1920, h: 1200 };
/** The helm buttons' and fire controls' centres, from src/scenes/layout.ts. */
const HELM = { port: { x: 86, y: 420 }, starboard: { x: 874, y: 420 } };
const FIRE = { port: { x: 86, y: 286 }, starboard: { x: 874, y: 286 } };
/** Wave 1 is two sloops, from src/game/waves.ts; each leaves 10 gold, from src/game/ships.ts. */
const WAVE_1 = ['sloop', 'sloop'];
const SLOOP_LOOT = 10;
/** The player's hull and Heavy Shot's first price, from src/game/state.ts and upgrades.ts. */
const HULL = 120;
const HEAVY_SHOT = 15;
/** How close to sail to an enemy before turning side-on, from HULLS.frigate.range in hulls.ts, less a margin. */
const CLOSE_IN = 220;
/**
 * A fully charged broadside reaches HULLS.frigate.range (260); fire at enemies a little inside it, and
 * within ARC (32 degrees, from state.ts) of straight out from the side, less a margin.
 */
const FIRE_WITHIN = 210;
const RANGE = 260;
const REACH_MIN = 0.65;
const ARC = (28 * Math.PI) / 180;
/** Start aiming only when an enemy is this close to straight out from the side. */
const AIM_ARC = (12 * Math.PI) / 180;
/** The first wave's captain's order, from FIRST_ORDER in src/game/state.ts. */
const FIRST_ORDER = 'chain';
/** The first wave's wind, blowing toward the east, from FIRST_WIND in src/game/state.ts. */
const FIRST_WIND = 0;
/** The first run's ship, from FIRST_HULL in src/game/hulls.ts. */
const FIRST_HULL = 'frigate';
/** The first wave's prize draft, from FIRST_DRAFT in src/game/perks.ts; the test keeps the first card. */
const FIRST_DRAFT = ['salvage', 'ricochet', 'mortar'];
const SIDES: Side[] = ['port', 'starboard'];

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

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/** The shortest way from one point to another; the sea wraps at its edges, like a globe. */
function offset(from: { x: number; y: number }, to: { x: number; y: number }) {
  const across = (d: number, size: number) => d - size * Math.round(d / size);
  return { dx: across(to.x - from.x, WORLD.w), dy: across(to.y - from.y, WORLD.h) };
}
const bearing = (from: { x: number; y: number }, to: { x: number; y: number }) => {
  const { dx, dy } = offset(from, to);
  return Math.atan2(dy, dx);
};
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const { dx, dy } = offset(a, b);
  return Math.hypot(dx, dy);
};
const nearest = <T extends { x: number; y: number }>(from: { x: number; y: number }, items: T[]) =>
  [...items].sort((a, b) => distance(from, a) - distance(from, b))[0];

/**
 * Where to point the bow: sail at the nearest enemy, then turn side-on to it so a broadside bears,
 * whichever side is the shorter turn. With no enemy left, sail for the nearest loot.
 */
function course(s: GameState): number | null {
  const p = s.player;
  const enemy = nearest(p, s.enemies);
  if (enemy) {
    const b = bearing(p, enemy);
    if (distance(p, enemy) > CLOSE_IN) return b;
    const starboard = b - Math.PI / 2;
    const port = b + Math.PI / 2;
    return Math.abs(wrap(starboard - p.heading)) < Math.abs(wrap(port - p.heading)) ? starboard : port;
  }
  const loot = nearest(p, s.loot);
  return loot ? bearing(p, loot) : null;
}

/**
 * The enemies off one side of the player's ship: in reach of a full charge and within `arc` of
 * straight out from that side.
 */
function offSide(s: GameState, side: Side, arc = ARC) {
  const p = s.player;
  const out = p.heading + (side === 'starboard' ? Math.PI / 2 : -Math.PI / 2);
  return s.enemies.filter((e) => distance(p, e) <= FIRE_WITHIN && Math.abs(wrap(bearing(p, e) - out)) < arc);
}

/**
 * The side of the player's ship, if any, with an enemy right off it, near the middle of the arc,
 * so it stays in the arc while the broadside charges.
 */
const sideToFire = (s: GameState): Side | null => SIDES.find((side) => offSide(s, side, AIM_ARC).length > 0) ?? null;

/**
 * Enough charge for a broadside to reach the nearest enemy off that side, with a margin: an
 * uncharged one reaches REACH_MIN of RANGE, a full one all of it (from state.ts).
 */
function chargeNeeded(s: GameState, side: Side) {
  const d = Math.min(...offSide(s, side).map((e) => distance(s.player, e)));
  return Math.min(1, Math.max(0, ((d + 30) / RANGE - REACH_MIN) / (1 - REACH_MIN)));
}

function scene(page: Page) {
  const read = <T>(fn: (s: any) => T) =>
    page.evaluate(`(${fn.toString()})(window.game.scene.getScene('Game'))`) as Promise<T>;
  return {
    state: () => read<GameState>((s) => JSON.parse(JSON.stringify(s.state))),
    /** Where the harbor's buttons are on screen, and what each does. */
    harbor: () => read<Button[]>((s) => s.harbor.buttons),
  };
}

test('plays the first wave', async ({ page }, testInfo) => {
  // A seeded Math.random keeps where the enemy ships appear the same from run to run.
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
  // animation frame at a time, so the battle plays the same on a slow runner as on a fast one.
  const start = new Date('2026-01-01T00:00:00Z');
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1_000));
  await page.addInitScript((frameMs) => {
    window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), frameMs);
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
    // Phaser falls back to its canvas renderer. CI has no GPU, and WebGL in software is too slow to
    // play at SPEED; the game, its rules and the art are the same either way.
    const getContext = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, id: string, ...rest: unknown[]) => unknown;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
      return /webgl/i.test(id) ? null : getContext.call(this, id, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  }, FRAME_MS);
  await page.goto('/games/broadside/');
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

  /** A point in the game's 960x540 view, on the page. */
  async function onPage(x: number, y: number) {
    const box = (await canvas.boundingBox())!;
    const scale = box.width / VIEW.w;
    return { x: box.x + x * scale, y: box.y + y * scale };
  }

  /**
   * Holds down one control with the mouse (or lets go of it, for null), as a thumb on a phone
   * would: a helm button or a fire control. Letting go of a fire control fires its broadside.
   */
  type Control = `helm-${Side}` | `fire-${Side}` | null;
  let held: Control = null;
  async function hold(control: Control) {
    if (control === held) return;
    if (held) await page.mouse.up();
    held = control;
    if (!control) return;
    const [kind, side] = control.split('-') as ['helm' | 'fire', Side];
    const at = await onPage(...(Object.values((kind === 'helm' ? HELM : FIRE)[side]) as [number, number]));
    await page.mouse.move(at.x, at.y);
    await page.mouse.down();
  }
  const helm = (dir: -1 | 0 | 1) => hold(dir < 0 ? 'helm-port' : dir > 0 ? 'helm-starboard' : null);

  /** Puts the helm over toward the heading `want`, or lets it go once on course. */
  async function steerFor(s: GameState, want: number | null) {
    if (want === null) return helm(0);
    const diff = wrap(want - s.player.heading);
    return helm(Math.abs(diff) < 0.12 ? 0 : diff < 0 ? -1 : 1);
  }

  /** Sails along `course`, steering by the helm buttons. */
  const sail = (s: GameState) => steerFor(s, course(s));

  /** Whether to let go of a held fire control: charged enough to reach, or the enemy got away. */
  const letGo = (s: GameState, side: Side) => !offSide(s, side).length || (s.charge[side] ?? 0) >= chargeNeeded(s, side);

  /**
   * Fights: holds a fire control while an enemy is off that side, lets go to fire once the
   * broadside is charged enough to reach it, and otherwise sails along `course` to close in and
   * turn side-on.
   */
  async function fight(s: GameState) {
    for (const side of SIDES) {
      if (held !== `fire-${side}`) continue;
      if (s.charge[side] !== null && letGo(s, side)) await hold(null);
      return;
    }
    const side = sideToFire(s);
    if (side && s.player.reload[side] <= 0) return hold(`fire-${side}`);
    return sail(s);
  }

  /**
   * Plays on until `check` holds, for up to `ms` of game time, doing `act` (steering, firing) at
   * every step when given it.
   */
  async function until(what: string, check: (s: GameState) => boolean, ms = 30_000, act?: (s: GameState) => Promise<unknown>) {
    let state = await game.state();
    const ok = await play(ms, async () => {
      state = await game.state();
      if (check(state)) return true;
      if (act) await act(state);
      return false;
    });
    if (!ok) {
      const { enemies, player, ...rest } = state;
      throw new Error(`Timed out after ${ms}ms of game time waiting for: ${what}\n` +
        `Player ${JSON.stringify(player)}, enemies ${JSON.stringify(enemies.map((e) => [e.kind, Math.round(e.x), Math.round(e.y), e.hp]))}, state ${JSON.stringify(rest)}`);
    }
    return state;
  }

  /** Taps a harbor button, as a player would. */
  async function tap(button: Button) {
    const at = await onPage(button.x, button.y);
    await page.mouse.click(at.x, at.y);
    await play(STEP_MS, async () => false);
  }

  // A new voyage: wave 1 of two sloops on its way, a sound hull and an empty hold.
  let s = await game.state();
  expect(s).toMatchObject({ phase: 'break', wave: 1, gold: 0, sunk: 0, ranks: {}, helm: 0, enemies: [], charge: { port: null, starboard: null } });
  // The captain's order for the first wave is always chain shot.
  expect(s.order).toBe(FIRST_ORDER);
  // The first wave's wind is always the same, and both sides start loaded with round shot (the
  // order's chain shot overrides it for the wave).
  expect(s.wind).toBe(FIRST_WIND);
  expect(s.loadout).toEqual({ port: 'round', starboard: 'round' });
  // The first run sails the Frigate, with no perks yet and no bounty on the first wave.
  expect(s.hull).toBe(FIRST_HULL);
  expect(s.perks).toEqual([]);
  expect(s.bounty).toBeNull();
  expect(s.toSpawn).toEqual(WAVE_1);
  expect(s.player.hp).toBe(HULL);

  // Holding the starboard button turns the ship to the right, letting go sails straight on, and
  // the port button turns it back to the left.
  const heading0 = s.player.heading;
  await helm(1);
  s = await until('turning to starboard', (s) => wrap(s.player.heading - heading0) > 0.5, 2_000);
  expect(s.helm).toBe(1);
  await helm(0);
  await play(STEP_MS, async () => false);
  s = await game.state();
  expect(s.helm).toBe(0);
  const heading1 = s.player.heading;
  await play(STEP_MS * 2, async () => false);
  expect((await game.state()).player.heading, 'straight on with the helm let go').toBeCloseTo(heading1, 5);
  await helm(-1);
  s = await until('turning to port', (s) => wrap(s.player.heading - heading1) < -0.5, 2_000);
  await helm(0);

  // The first enemy sloop comes over the horizon; close on it and turn side-on so it is off one
  // side, in reach of a full charge.
  s = await until('the first sloop sighted', (s) => s.phase === 'fighting' && s.enemies.length > 0, 5_000);
  expect(s.enemies[0]).toMatchObject({ kind: 'sloop' });
  s = await until('a sloop off a loaded side', (s) => sideToFire(s) !== null, 30_000, sail);
  const side = sideToFire(s)!;

  // Holding that side's fire control charges its broadside without firing it.
  await hold(`fire-${side}`);
  s = await until('the broadside half charged', (s) => (s.charge[side] ?? 0) >= 0.5, 2_000);
  expect(s.aim[side], 'the fire control is held').toBe(true);
  expect(s.balls.filter((b) => b.fromPlayer), 'nothing fired while held').toEqual([]);
  await snap('0-aim');
  s = await until('charged enough to reach the sloop', (s) => letGo(s, side), 2_000);

  // Letting go fires it: chain shot, under this wave's order, and the side starts to reload.
  await hold(null);
  s = await until('a broadside fired', (s) => s.balls.some((b) => b.fromPlayer), 1_000);
  expect(s.charge[side]).toBeNull();
  expect(s.player.reload[side]).toBeGreaterThan(0);
  expect(s.balls.filter((b) => b.fromPlayer).map((b) => b.shot)).toEqual(['chain', 'chain']);
  await snap('1-broadside');

  // A chain shot hit slows the sloop. Keep fighting until a broadside hits.
  s = await until('a sloop hit', (s) => s.enemies.some((e) => e.hp < e.maxHp) || s.sunk > 0, 30_000, fight);
  expect(s.enemies.some((e) => e.hp < e.maxHp && e.slowMs > 0), 'the sloop hit is slowed').toBe(true);

  // A sunk ship leaves a barrel of loot floating behind; sailing over it adds its gold to the hold.
  s = await until('a sloop sunk', (s) => s.sunk > 0, 60_000, fight);
  expect(s.loot.length + s.gold / SLOOP_LOOT).toBe(1);
  await snap('2-loot');

  // Sink the other. Once the last ship of the wave goes down, the crew hauls in every barrel still
  // afloat and the harbor opens.
  s = await until('wave 1 beaten', (s) => s.phase === 'harbor', 90_000, fight);
  await hold(null);
  expect(s).toMatchObject({ wave: 1, sunk: 2, gold: 2 * SLOOP_LOOT, plundered: 2 * SLOOP_LOOT, bestWave: 1, enemies: [], loot: [] });
  expect(s.player.hp).toBeGreaterThan(0);
  await play(STEP_MS, async () => false);

  // The harbor first offers the prize draft: three perks, always the same ones after wave 1.
  // Tapping a card keeps that perk for the run, at no cost, and opens the ledger.
  expect(s.draft).toEqual(FIRST_DRAFT);
  await snap('3-draft');
  const cards = await game.harbor();
  expect(cards.map((b) => b.id)).toEqual(FIRST_DRAFT.map((id) => `draft-${id}`));
  await tap(cards[0]);
  s = await game.state();
  expect(s.perks).toEqual([FIRST_DRAFT[0]]);
  expect(s.draft).toEqual([]);
  expect(s.gold).toBe(2 * SLOOP_LOOT);
  await snap('4-harbor');

  // At the harbor, buy Heavy Shot with the plunder, then set sail for wave 2.
  const buttons = await game.harbor();
  await tap(buttons.find((b) => b.id === 'shot')!);
  s = await game.state();
  expect(s.ranks).toEqual({ shot: 1 });
  expect(s.gold).toBe(2 * SLOOP_LOOT - HEAVY_SHOT);
  // Loading the guns is free: a tap on the starboard row loads chain shot into that side.
  await tap(buttons.find((b) => b.id === 'load-starboard')!);
  s = await game.state();
  expect(s.loadout).toEqual({ port: 'round', starboard: 'chain' });
  expect(s.gold).toBe(2 * SLOOP_LOOT - HEAVY_SHOT);
  await snap('5-loadout');
  await tap(buttons.find((b) => b.id === 'sail')!);
  s = await game.state();
  expect(s).toMatchObject({ phase: 'break', wave: 2 });
  expect(s.toSpawn.length).toBeGreaterThan(WAVE_1.length);
  // Sinking the sloops earns the First blood trophy (src/trophies/), and nothing else yet.
  const trophies = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('broadside-trophies') ?? '{}')));
  expect(trophies, 'trophies earned in the first round').toEqual(['firstSink']);

  const speed = gameMs / (Date.now() - startedAt);
  console.log(`Played ${Math.round(gameMs / 1000)}s of game time at ${speed.toFixed(1)}x (target ${SPEED}x).`);
  expect(errors).toEqual([]);
});
