import { expect, test } from '@playwright/test';

// Plays one round of Colonizer with real inputs (clicks, as a player would): pick a faction, send a
// villager to chop wood and bring it back (its drop-off pops a +10 badge), train a villager, build a
// house and an Academy, research Axes, then advance to Age II, which ticks the first deed for Age III
// and offers the Age II boon, and pick Harvest Rites. Game state is only read, through the `game`
// object the dev build puts on window.

type Point = { x: number; y: number };
interface Unit { id: number; owner: number; type: string; x: number; y: number; order: { t: string } }
interface Deeds { age2: boolean; army: number; raid: boolean }
interface Building { id: number; owner: number; type: string; tx: number; ty: number; built: boolean; queue: { key: string }[] }
interface GameState {
  time: number;
  winner: number | null;
  units: Unit[];
  buildings: Building[];
  players: { res: Record<string, number>; techs: string[]; age: number; deeds: Deeds; boon: string | null; boonPending: boolean }[];
}
interface Hud {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Game time per animation frame, every frame the same length, so a slow runner plays the same as a
 * fast one.
 */
const FRAME_MS = 64;
/** Game time advanced between checks: a few animation frames. */
const STEP_MS = 192;
/**
 * How many times faster than real time the game plays, so the recorded video runs at that speed.
 * CI plays at 4x.
 */
const SPEED = Number(process.env.PLAYTHROUGH_SPEED ?? 4);
const START_WOOD = 200;

test('plays a round of the game loop', async ({ page }, testInfo) => {
  // A seeded Math.random keeps the map and the AI's choices the same from run to run.
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
  // The test owns the clock: game time only moves when the test advances it, one 64ms animation
  // frame at a time, so the match behaves the same on a slow runner as on a fast one.
  const start = new Date('2026-01-01T00:00:00Z');
  await page.clock.install({ time: start });
  await page.clock.pauseAt(new Date(start.getTime() + 1_000));
  await page.addInitScript((frameMs) => {
    // Animation frames come from the test's clock at a fixed step, so each one is FRAME_MS long.
    window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), frameMs);
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
    // Phaser falls back to its canvas renderer. CI has no GPU, and WebGL in software is too slow to
    // play at SPEED; the game, its rules and the pixel art are the same either way.
    const getContext = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, id: string, ...rest: unknown[]) => unknown;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
      return /webgl/i.test(id) ? null : getContext.call(this, id, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  }, FRAME_MS);
  await page.goto('/games/colonizer/');
  const canvas = page.locator('canvas');
  const box = (await canvas.boundingBox())!;
  const scale = box.width / 960;

  /** Game time played since the match started, and the real time when it started. */
  let gameMs = 0;
  let startedAt = 0;

  /**
   * Advances game time in small steps until `done` holds; returns false if `ms` ran out first. Once
   * the match has started, each step waits until real time catches up with game time / SPEED.
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

  /** Reads the match, through the scene's own state. */
  const read = <T>(fn: (g: any) => T) => page.evaluate(`(${fn.toString()})(window.game.scene.getScene('Game'))`) as Promise<T>;
  const state = () =>
    read<GameState>((g) => ({
      time: g.state.time,
      winner: g.state.winner,
      units: [...g.state.units.values()],
      buildings: [...g.state.buildings.values()],
      players: g.state.players,
    }));
  /** Where a world tile sits on the canvas, in page pixels. */
  const pageXY = (tx: number, ty: number) =>
    read<Point>((g) => ({ x: g.cameras.main.worldView.x, y: g.cameras.main.worldView.y })).then((cam) => ({
      x: box.x + (tx * 32 - cam.x) * scale,
      y: box.y + (ty * 32 - cam.y) * scale,
    }));
  /** A panel button by its id (a unit, building or tech id, or an action such as 'build'), so the test plays in any language. */
  const hudButton = (id: string) =>
    read<{ hud: Hud[]; sel: string[] }>((g) => ({ hud: g.hud, sel: [...g.selected].map((id: number) => `${id}:${g.state.buildings.get(id)?.type ?? 'unit'}`) })).then(({ hud, sel }) => {
      const h = hud.find((b) => b.id === id);
      expect(h, `button ${id}; selected ${sel.join(',')}; buttons ${hud.map((b) => `${b.id} (${b.label})`).join(' | ')}`).toBeTruthy();
      return { x: box.x + (h!.x + h!.w / 2) * scale, y: box.y + (h!.y + h!.h / 2) * scale };
    });

  /** Clicks a spot on the canvas, as a player would, then lets the game draw the frame it reacts in. */
  const click = async (at: Point, button: 'left' | 'right' = 'left') => {
    await page.mouse.click(at.x, at.y, { button });
    await page.clock.runFor(STEP_MS);
  };
  const clickTile = async (tx: number, ty: number, button: 'left' | 'right' = 'left') => click(await pageXY(tx + 0.5, ty + 0.5), button);

  /** Waits in game time until `what` holds, failing the test if it takes longer than `ms`. */
  async function until(what: string, check: (s: GameState) => boolean, ms = 240_000) {
    const ok = await play(ms, async () => check(await state()));
    const now = await state();
    const mine = now.units.filter((u) => u.owner === 0).map((u) => `${u.type}:${u.order.t}@${u.x.toFixed(1)},${u.y.toFixed(1)}`);
    const mineB = now.buildings.filter((b) => b.owner === 0).map((b) => `${b.type}:${b.built}`);
    expect(ok, `waited for ${what}; wood ${now.players[0].res.wood}, food ${now.players[0].res.food}; ${mine.join(' ')}; ${mineB.join(' ')}`).toBe(true);
    return state();
  }

  // The menu comes up once the textures are baked; the page may still be loading until then.
  expect(
    await play(10_000, () =>
      page.evaluate(() => !!(window as any).game?.scene.getScene('Menu')?.sys?.isActive()).catch(() => false),
    ),
    'menu started',
  ).toBe(true);
  startedAt = Date.now();

  const snap = async (name: string) =>
    testInfo.attach(name, { body: await page.screenshot({ path: testInfo.outputPath(`${name}.png`) }), contentType: 'image/png' });

  // Pick Ember Legion on the menu: the card's left-hand edge, at (170, 300) in game space.
  await click({ x: box.x + 170 * scale, y: box.y + 300 * scale });
  expect(
    await play(5_000, () =>
      page.evaluate(() => (window as any).game.scene.getScene('Game')?.sys.isActive() === true).catch(() => false),
    ),
    'match started',
  ).toBe(true);
  await snap('match-start');

  const me = (s: GameState) => s.units.filter((u) => u.owner === 0);
  const myBuildings = (s: GameState, type: string) => s.buildings.filter((b) => b.owner === 0 && b.type === type);
  const startVillagers = me(await state()).filter((u) => u.type === 'villager').length;
  expect(startVillagers, 'villagers at the start').toBe(4);
  const town = myBuildings(await state(), 'town')[0];
  // The match opens in Age I with the three deeds for Age III still to do.
  const opening = (await state()).players[0];
  expect(opening.age, 'Age I at the start').toBe(1);
  expect(opening.deeds, 'no deeds done yet').toEqual({ age2: false, army: 0, raid: false });

  // 1. Harvest: a villager gathers wood from the nearest tree and brings it back.
  const s0 = await state();
  const villager = me(s0).find((u) => u.type === 'villager')!;
  await click(await pageXY(villager.x, villager.y));
  const tree = await read<{ id: number; tx: number; ty: number }>((g) => {
    const my = [...g.state.units.values()].find((u: any) => u.owner === 0 && u.type === 'villager');
    let best: any = null;
    for (const n of g.state.nodes.values()) {
      if (n.res !== 'wood') continue;
      const d = Math.hypot(n.tx - my.x, n.ty - my.y);
      if (!best || d < best.d) best = { id: n.id, tx: n.tx, ty: n.ty, d };
    }
    return best;
  });
  await clickTile(tree.tx, tree.ty, 'right');
  await until('wood brought back', (s) => s.players[0].res.wood > START_WOOD);
  expect(await read((g) => [...g.selected].length), 'villager still selected').toBe(1);
  // The drop-off pops a +10 wood badge over the villager.
  expect(await read<string[]>((g) => g.popLog), 'drop-off badge').toContain('+10 wood');
  await snap('harvest');

  // 2. Economy: the Town Center trains a villager.
  await click(await pageXY(town.tx + 2, town.ty + 2));
  await click(await hudButton('villager'));
  await until('a new villager', (s) => me(s).filter((u) => u.type === 'villager').length > startVillagers);

  // 3. Build: a villager puts up a house by the Town Center.
  const houseSpot = await read<{ tx: number; ty: number }>((g) => {
    const t = [...g.state.buildings.values()].find((b: any) => b.owner === 0 && b.type === 'town');
    for (let r = 4; r < 12; r++)
      for (let ty = t.ty - r; ty <= t.ty + r; ty++)
        for (let tx = t.tx - r; tx <= t.tx + r; tx++) {
          const free = [0, 1].every((j) => [0, 1].every((i) => !g.state.solid[(ty + j) * 128 + tx + i]));
          const onUnit = [...g.state.units.values()].some((u: any) => Math.floor(u.x) >= tx && Math.floor(u.x) < tx + 2 && Math.floor(u.y) >= ty && Math.floor(u.y) < ty + 2);
          if (free && !onUnit && tx >= 0 && ty >= 0) return { tx, ty };
        }
    throw new Error('no free house spot near the Town Center');
  });
  const worker = me(await state()).find((u) => u.type === 'villager')!;
  await click(await pageXY(worker.x, worker.y));
  await click(await hudButton('build'));
  await click(await hudButton('house'));
  // A building is placed centred on the tile under the cursor, so aim at the middle of the spot.
  await clickTile(houseSpot.tx + 1, houseSpot.ty + 1);
  await until('the house is built', (s) => myBuildings(s, 'house').some((b) => b.built));
  await snap('house');

  // 4. Research: an Academy, then Axes, which speeds up wood.
  await until('wood and food for an Academy', (s) => s.players[0].res.wood >= 150 && s.players[0].res.food >= 100);
  const academySpot = await read<{ tx: number; ty: number }>((g) => {
    const t = [...g.state.buildings.values()].find((b: any) => b.owner === 0 && b.type === 'town');
    for (let r = 4; r < 14; r++)
      for (let ty = t.ty - r; ty <= t.ty + r; ty++)
        for (let tx = t.tx - r; tx <= t.tx + r; tx++) {
          // South of the Town Center, away from the trees and the workers walking to them.
          const free = [0, 1, 2].every((j) => [0, 1, 2].every((i) => !g.state.solid[(ty + j) * 128 + tx + i]));
          const onUnit = [...g.state.units.values()].some((u: any) => Math.floor(u.x) >= tx - 1 && Math.floor(u.x) <= tx + 3 && Math.floor(u.y) >= ty - 1 && Math.floor(u.y) <= ty + 3);
          if (free && !onUnit && ty >= t.ty + 5 && tx >= 0 && ty >= 0 && tx + 3 < 128 && ty + 3 < 128) return { tx, ty };
        }
    throw new Error('no free Academy spot south of the Town Center');
  });
  const builder = me(await state()).find((u) => u.type === 'villager')!;
  await click(await pageXY(builder.x, builder.y));
  await click(await hudButton('build'));
  await click(await hudButton('academy'));
  await clickTile(academySpot.tx + 1, academySpot.ty + 1);
  await until('the Academy is built', (s) => myBuildings(s, 'academy').some((b) => b.built));
  await until('wood for Axes', (s) => s.players[0].res.wood >= 100);
  await click(await pageXY(academySpot.tx + 1, academySpot.ty + 1));
  await click(await hudButton('axes'));
  await until('Axes researched', (s) => s.players[0].techs.includes('axes'), 60_000);
  await snap('research');

  // 5. Training again: the Town Center makes another villager once the Axes are done.
  const before = me(await state()).filter((u) => u.type === 'villager').length;
  await click(await pageXY(town.tx + 2, town.ty + 2));
  await click(await hudButton('villager'));
  await until('the villager is trained', (s) => me(s).filter((u) => u.type === 'villager').length > before);

  // 6. Age II at the Town Center: the first deed for Age III is done and the boon pick opens.
  await until('food and wood for Age II', (s) => s.players[0].res.food >= 400 && s.players[0].res.wood >= 200);
  await click(await pageXY(town.tx + 2, town.ty + 2));
  await click(await hudButton('age2'));
  const aged = await until('Age II reached', (s) => s.players[0].age === 2, 90_000);
  expect(aged.players[0].deeds.age2, 'the Age II deed is done').toBe(true);
  expect(aged.players[0].boonPending, 'the boon pick is open').toBe(true);
  const cards = await read<string[]>((g) => g.hud.map((h: Hud) => h.id));
  expect(cards, 'the two boon cards replace the buttons').toEqual(['shieldwall', 'harvest']);
  await snap('boon');
  await click(await hudButton('harvest'));
  const picked = await until('Harvest Rites picked', (s) => s.players[0].boon === 'harvest' && !s.players[0].boonPending, 5_000);
  expect(picked.players[0].age, 'still Age II: Age III needs all three deeds').toBe(2);
  // The Town Center now offers Age III, which waits on the other two deeds.
  await click(await hudButton('age3'));
  expect((await state()).buildings.find((b) => b.id === town.id)!.queue.map((q) => q.key), 'Age III is not queued yet').not.toContain('age3');

  // Age II earns the A new age trophy (src/trophies/), and nothing else yet.
  const trophies = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('colonizer-trophies') ?? '{}')));
  expect(trophies, 'trophies earned in the first round').toEqual(['ageTwo']);

  expect(errors, 'page errors').toEqual([]);
  const end = await state();
  expect(end.winner, 'no one has won yet').toBeNull();
  console.log(`Played ${Math.round(gameMs / 1000)}s of game time at ${(gameMs / 1000 / ((Date.now() - startedAt) / 1000)).toFixed(1)}x`);
});
