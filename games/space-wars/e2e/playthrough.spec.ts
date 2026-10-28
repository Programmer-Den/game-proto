import { expect, test, type Page } from '@playwright/test';

// Plays the first round with real inputs: the crystal harvesters mine and carry crystal home, the
// player raises a Barracks beside the hub (the first contract, which pays its reward and rank
// perk), picks Break the raid from the contract board, trains a wing of three Lancers from it, box-selects them, flies them into the fog of war
// to find the relay beacon and takes it until it pays, fights off the rival picket and collects its
// salvage shard, then attacks the nearest enemy base. The map is bigger than the screen, so the test pans it with the arrow
// keys to reach what it needs to tap. Game state is only read, through the `game` object the dev
// build puts on window.

interface Unit {
  id: number;
  faction: number;
  type: string;
  x: number;
  y: number;
}
interface Building {
  id: number;
  faction: number;
  type: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  done: boolean;
}
interface Side {
  crystal: number;
  alive: boolean;
  def: { name: string };
  perks: { train: number };
}
interface Button {
  kind: 'build' | 'train';
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
interface GameState {
  phase: 'playing' | 'won' | 'lost';
  elapsedMs: number;
  units: Unit[];
  buildings: Building[];
  sides: Side[];
  beacon: { x: number; y: number; owner: number; capture: number; held: boolean; paid: number };
  shards: { id: number; faction: number; x: number; y: number; value: number }[];
  fog: { explored: number };
  contract: { index: number; progress: number; goal: string | null; offer: string[] };
  salvaged: number;
  kills: number;
}

const VIEW = { w: 960, h: 540 };
/** The map's window on screen, between the top and command bars, from src/scenes/layout.ts. */
const MAP_VIEW = { x: 0, y: 34, w: 960, h: 406 };
/** How close to the map's edge a target may sit before the test pans toward it. */
const EDGE = 60;
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
/** The player's faction index, from src/game/world.ts. */
const PLAYER = 0;
/** The Lancer is the first combat unit of the Solar Concord, and the Barracks is 100 crystal. */
const START_CRYSTAL = 120;
const SCOUT_COST = 35;
/** The first contract (raise the Barracks) pays 60 crystal and makes ships train 20% faster. */
const FIRST_REWARD = 60;
/** The relay beacon pays 3 crystal a second; a salvage shard is worth 8. */
const BEACON_PAY = 3;
const SHARD_VALUE = 8;
/** The player trains a wing of three Lancers. */
const WING = 3;

function scene(page: Page) {
  const read = <T>(fn: (s: any) => T) =>
    page.evaluate(`(${fn.toString()})(window.game.scene.getScene('Game'))`) as Promise<T>;
  return {
    state: () => read<GameState>((s) => JSON.parse(JSON.stringify(s.state))),
    buttons: () => read<Button[]>((s) => JSON.parse(JSON.stringify(s.buttons))),
    /** The faction picker's cards, in view pixels. */
    pickCards: () => read<{ x: number; y: number; w: number; h: number; faction: number }[]>((s) =>
      JSON.parse(JSON.stringify(s.pickCards)),
    ),
    /** The contract board's cards while it is up, in view pixels. */
    boardCards: () => read<{ x: number; y: number; w: number; h: number; goal: string }[]>((s) =>
      JSON.parse(JSON.stringify(s.boardCards)),
    ),
    /** The ids of the units the player has selected. */
    selected: () => read<number[]>((s) => [...s.selected]),
    /** Where the map camera is scrolled to, in battlefield pixels. */
    scroll: () => read<{ x: number; y: number }>((s) => ({ x: s.camera.scrollX, y: s.camera.scrollY })),
    /** Where a battlefield point sits in view pixels, from the scene's own conversion. */
    toScreen: (x: number, y: number) =>
      page.evaluate(
        ({ x, y }) => (window as any).game.scene.getScene('Game').toScreen(x, y),
        { x, y },
      ) as Promise<{ x: number; y: number }>,
    /** Whether the player has ever seen a battlefield point, from the fog of war. */
    knows: (x: number, y: number) =>
      page.evaluate(
        ({ x, y }) => (window as any).game.scene.getScene('Game').state.fog.knows({ x, y }) as boolean,
        { x, y },
      ) as Promise<boolean>,
    /** Whether a Barracks can go at (x, y) for the player, from the game's own placement rule. */
    canPlace: (x: number, y: number) =>
      page.evaluate(
        ({ x, y }) => (window as any).game.scene.getScene('Game').state.placementProblem('barracks', x, y) === null,
        { x, y },
      ) as Promise<boolean>,
  };
}

test('plays the first round', async ({ page }, testInfo) => {
  // Seeded like the other games' tests, so the map and the AI repeat from run to run.
  await page.addInitScript(() => {
    let seed = 3456789;
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
    // Phaser falls back to its canvas renderer, as CI has no GPU; the game looks the same either way.
    const getContext = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, id: string, ...rest: unknown[]) => unknown;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
      return /webgl/i.test(id) ? null : getContext.call(this, id, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  }, FRAME_MS);
  await page.goto('/games/space-wars/');
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

  /** Saves a milestone screenshot, with the pointer moved off the map so no tooltip covers it. */
  const snap = async (name: string) => {
    await page.mouse.move(2, 2);
    await play(FRAME_MS, async () => false);
    await testInfo.attach(name, { body: await page.screenshot({ path: testInfo.outputPath(`${name}.png`) }), contentType: 'image/png' });
  };

  /** Where a point in the 960x540 view is on the page. */
  async function onPage(x: number, y: number) {
    const box = (await canvas.boundingBox())!;
    const scale = box.width / VIEW.w;
    return { x: box.x + x * scale, y: box.y + y * scale };
  }
  /** Taps a point in the view, as a player would, then lets a frame play. */
  async function tap(x: number, y: number) {
    const at = await onPage(x, y);
    await page.mouse.click(at.x, at.y);
    await play(FRAME_MS, async () => false);
  }
  const button = async (kind: string, key: string) => {
    const b = (await game.buttons()).find((btn) => btn.kind === kind && btn.key === key)!;
    return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
  };
  /** Whether a battlefield point is on the map's part of the screen, clear of the edges. */
  async function onMap(x: number, y: number) {
    const at = await game.toScreen(x, y);
    return at.x >= EDGE && at.x <= MAP_VIEW.w - EDGE && at.y >= MAP_VIEW.y + EDGE && at.y <= MAP_VIEW.y + MAP_VIEW.h - EDGE;
  }
  /**
   * Pans the map with the arrow keys, as a player would, until a battlefield point is on screen.
   * Stops early at the battlefield's edge, where the view can't go further.
   */
  async function reveal(x: number, y: number) {
    for (let i = 0; i < 60 && !(await onMap(x, y)); i++) {
      const at = await game.toScreen(x, y);
      const keys: string[] = [];
      if (at.x < EDGE) keys.push('ArrowLeft');
      else if (at.x > MAP_VIEW.w - EDGE) keys.push('ArrowRight');
      if (at.y < MAP_VIEW.y + EDGE) keys.push('ArrowUp');
      else if (at.y > MAP_VIEW.y + MAP_VIEW.h - EDGE) keys.push('ArrowDown');
      const before = await game.scroll();
      for (const k of keys) await page.keyboard.down(k);
      await play(FRAME_MS * 4, async () => false);
      for (const k of keys) await page.keyboard.up(k);
      const after = await game.scroll();
      if (after.x === before.x && after.y === before.y) break;
    }
    expect(await onMap(x, y), `(${x}, ${y}) on screen after panning; scroll ${JSON.stringify(await game.scroll())}`).toBe(true);
  }
  /** Taps a battlefield point, panning to it first. */
  async function tapWorld(x: number, y: number) {
    await reveal(x, y);
    const at = await game.toScreen(x, y);
    await tap(at.x, at.y);
  }
  const mine = (s: GameState, type: string) => s.units.filter((u) => u.faction === PLAYER && u.type === type);
  const barracks = (s: GameState) => s.buildings.find((b) => b.faction === PLAYER && b.type === 'barracks');

  // The first frames: two harvesters at the hub, 120 crystal, no Barracks yet.
  let s = await game.state();
  expect(s.phase).toBe('playing');
  expect(s.sides[PLAYER].crystal).toBe(START_CRYSTAL);
  expect(mine(s, 'harvester')).toHaveLength(2);
  // The contract chain starts at its first contract, and the relay beacon is unclaimed.
  expect(s.contract.index).toBe(0);
  expect(s.contract.goal).toBe('barracks');
  expect(s.contract.progress).toBe(0);
  expect(s.beacon.owner).toBe(-1);
  // A dozen frames first, so the start screenshot shows the map drawn.
  await play(FRAME_MS * 12, async () => false);
  await snap('playthrough-0-start');

  // The battle waits on the faction picker: pick the Solar Concord, the first card, as a player would.
  const card = (await game.pickCards())[0];
  await tap(card.x + card.w / 2, card.y + card.h / 2);
  s = await game.state();
  expect(s.sides[PLAYER].def.name, 'the picked faction commands the battle').toBe('solarConcord');
  // The fog of war hides the map beyond what the base sees, the relay beacon included: it has to be found.
  expect(await game.knows(s.beacon.x, s.beacon.y), 'the beacon starts hidden in the fog').toBe(false);
  expect(s.fog.explored, 'only the area round the base is explored').toBeLessThan(0.15);

  // The harvesters mine the nearest crystal and carry it home, so the bank grows past the start.
  await until('crystal harvested and carried home', 60_000, (st) => st.sides[PLAYER].crystal >= START_CRYSTAL + 30);
  s = await game.state();
  await snap('playthrough-1-harvest');

  // Raise a Barracks: arm the button, then tap a spot the game says is clear beside the hub.
  const hub = s.buildings.find((b) => b.faction === PLAYER && b.type === 'hub')!;
  await tap(...(Object.values(await button('build', 'barracks')) as [number, number]));
  let spot: { x: number; y: number } | null = null;
  for (let d = 70; d <= 200 && !spot; d += 10) {
    for (const a of [0, 45, 90, 135, 180, 225, 270, 315]) {
      const x = hub.x + Math.cos((a * Math.PI) / 180) * d;
      const y = hub.y + Math.sin((a * Math.PI) / 180) * d;
      if (await game.canPlace(x, y)) {
        spot = { x, y };
        break;
      }
    }
  }
  expect(spot, 'a clear spot for a Barracks beside the hub').not.toBeNull();
  await tapWorld(spot!.x, spot!.y);
  await until('barracks built', 30_000, (st) => !!barracks(st)?.done);
  // Finishing the Barracks completes the first contract: its reward is paid, the rank perk applies
  // and the contract board offers two contracts for the second, Break the raid first.
  await until('first contract paid', 1_000, (st) => st.contract.index === 1);
  s = await game.state();
  expect(s.sides[PLAYER].perks.train, 'rank I perk: ships train faster').toBeCloseTo(0.8);
  expect(s.sides[PLAYER].crystal).toBeGreaterThanOrEqual(FIRST_REWARD);
  expect(s.contract.goal, 'the board is up').toBeNull();
  expect(s.contract.offer, 'the board offers two contracts').toHaveLength(2);
  expect(s.contract.offer[0], 'the second board always offers Break the raid').toBe('kills');
  await snap('playthrough-2-barracks');
  // Pick Break the raid by tapping its card on the board.
  const raid = (await game.boardCards()).find((c) => c.goal === 'kills')!;
  await tap(raid.x + raid.w / 2, raid.y + raid.h / 2);
  s = await game.state();
  expect(s.contract.goal, 'the picked contract starts').toBe('kills');
  expect(s.contract.progress).toBe(0);

  // Train a wing of three Lancers from the Barracks; with the contract's reward the bank covers them.
  s = await game.state();
  expect(s.sides[PLAYER].crystal).toBeGreaterThanOrEqual(SCOUT_COST * WING);
  for (let i = 0; i < WING; i++) await tap(...(Object.values(await button('train', 'scout')) as [number, number]));
  await until('lancers trained', 30_000, (st) => mine(st, 'scout').length >= WING);
  // The trained Lancers come out of the Barracks, so the production line works.
  s = await game.state();
  expect(mine(s, 'scout')).toHaveLength(WING);

  // Select the wing with a box drawn round the Barracks' launch point, as a player would.
  const wing = mine(s, 'scout');
  const box = { x0: Math.min(...wing.map((u) => u.x)) - 24, y0: Math.min(...wing.map((u) => u.y)) - 24, x1: Math.max(...wing.map((u) => u.x)) + 24, y1: Math.max(...wing.map((u) => u.y)) + 24 };
  await reveal((box.x0 + box.x1) / 2, (box.y0 + box.y1) / 2);
  const from = await onPage(...(Object.values(await game.toScreen(box.x0, box.y0)) as [number, number]));
  const to = await onPage(...(Object.values(await game.toScreen(box.x1, box.y1)) as [number, number]));
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
  await play(FRAME_MS, async () => false);
  expect(await game.selected(), 'the box selects the whole wing').toHaveLength(WING);

  // Fly the wing out to the relay beacon. Alone in its ring the wing captures it, then the beacon
  // pays 3 crystal a second while the wing holds it.
  s = await game.state();
  const explored = s.fog.explored;
  await tapWorld(s.beacon.x, s.beacon.y);
  await until('relay beacon captured', 30_000, (st) => st.beacon.owner === PLAYER);
  expect(await game.knows(s.beacon.x, s.beacon.y), 'the wing found the beacon').toBe(true);
  expect((await game.state()).fog.explored, 'flying out explored more of the map').toBeGreaterThan(explored);
  const bank = (await game.state()).sides[PLAYER].crystal;
  await until('relay beacon pays', 5_000, (st) => st.beacon.paid >= BEACON_PAY * 2);
  s = await game.state();
  expect(s.beacon.held).toBe(true);
  expect(s.sides[PLAYER].crystal, 'the beacon pays into the bank').toBeGreaterThanOrEqual(bank + BEACON_PAY);
  await snap('playthrough-3-beacon');
  // The first contract and the beacon earn their trophies (src/trophies/), and nothing else yet.
  const earned = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('space-wars-trophies') ?? '{}')));
  expect(earned.sort(), 'trophies earned in the first round').toEqual(['beacon', 'firstContract']);

  // The rival nearest the beacon sends a warship to contest it. The wing, holding the ring, fights
  // it off: the wreck leaves a salvage shard that flies to the nearest Lancer and pays 8 crystal,
  // and the kill counts toward the second contract.
  await until('rival picket destroyed', 60_000, (st) => st.kills >= 1);
  s = await game.state();
  expect(s.contract.index, 'still on the second contract').toBe(1);
  expect(s.contract.progress, 'the kill counts toward breaking the raid').toBeGreaterThanOrEqual(1);
  await until('salvage shard collected', 10_000, (st) => st.salvaged >= SHARD_VALUE && !st.shards.some((sh) => sh.faction === PLAYER));
  await snap('playthrough-4-salvage');

  // Then tap the nearest enemy base to attack it.
  s = await game.state();
  expect(mine(s, 'scout').length, 'the wing is still flying').toBeGreaterThan(0);
  const now = mine(s, 'scout')[0];
  const far = (p: { x: number; y: number }, q: { x: number; y: number }) => Math.hypot(p.x - q.x, p.y - q.y);
  const enemyHub = s.buildings
    .filter((b) => b.faction !== PLAYER)
    .reduce((best, b) => (far(b, now) < far(best, now) ? b : best));
  const enemyStart = enemyHub.hp;
  await tapWorld(enemyHub.x, enemyHub.y);
  await until('the enemy base takes damage', 120_000, (st) => {
    const b = st.buildings.find((x) => x.id === enemyHub.id);
    return !b || b.hp < enemyStart;
  });
  await snap('playthrough-5-attack');

  s = await game.state();
  expect(s.phase, `battle still on; state: ${JSON.stringify(s)}`).toBe('playing');
  expect(errors, 'page errors').toEqual([]);
  const speed = gameMs / ((Date.now() - startedAt) || 1);
  console.log(`Played ${(s.elapsedMs / 1000).toFixed(0)}s of game time at ${speed.toFixed(1)}x`);
});
