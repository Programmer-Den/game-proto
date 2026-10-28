import { expect, test, type Page } from '@playwright/test';

// Plays the first round on the island the seeded Math.random picks, with real inputs: taps a tile
// button to pick a building from the hand of three drawn from the pouch, hovers a cell to see what
// it would score, which neighbours pay into it and whether it joins the castle, taps cells to place
// houses, farms and a road, fulfils the royal decree, reaches the round's goal and takes a gift,
// which brings round 2 and its tiles.
// Game state is only read, through the `game` object the dev build puts on window.

type Building = 'farm' | 'house' | 'tower' | 'windmill' | 'market' | 'harbor' | 'lumber' | 'road';
type Cell = 'grass' | 'lake' | 'forest' | 'castle' | Building | 'manor';
type Gift = 'towers' | 'houses' | 'farms' | 'windmill' | 'windmills' | 'market' | 'markets' | 'harbor' | 'harbors' | 'lumber' | 'lumbers';
interface Decree {
  kind: 'shore' | 'wood' | 'watch';
  place: string;
  need: number;
  done: boolean;
}
interface GameState {
  round: number;
  goal: number;
  score: number;
  bonus: number;
  pouch: Record<Building, number>;
  hand: Building[];
  draws: number;
  selected: Building | null;
  grid: Cell[][];
  placed: number;
  phase: 'playing' | 'gift' | 'over';
  best: number;
  crowns: number;
  island: number;
  decree: Decree | null;
  gifts: [Gift, Gift];
  giftsDue: number;
  unlocked: Building[];
  omen: { kind: 'flood' | 'storm' } | null;
  tradedIn: number;
  castle: number;
}
type Box = { x: number; y: number; w: number; h: number };
type Share = { col: number; row: number; pts: number };
type Preview = { col: number; row: number; gained: number; base: number; links: Share[]; season: number; joins: number };

const VIEW = { w: 960, h: 540 };
/** The board, from src/scenes/layout.ts. */
const GRID = { x: 24, y: 46, cols: 10, rows: 7, cell: 64 };
/** The first round's tiles and goal, and what round 2 adds and asks, from src/game/state.ts. */
const FIRST_POUCH = { farm: 4, house: 4, tower: 2, windmill: 0, market: 0, harbor: 0, lumber: 0, road: 1 };
const ROUND_POUCH = { farm: 3, house: 3, tower: 2, windmill: 0, market: 0, harbor: 0, lumber: 0, road: 1 };
/** How many tiles each turn draws from the pouch. */
const HAND = 3;
const GOALS = [20, 45];
/** What a fulfilled decree pays, from src/game/decree.ts. */
const DECREE_BONUS = 8;
/** Round 1's gifts and what the windmill gift adds, from src/game/gifts.ts. */
const FIRST_GIFTS = ['towers', 'windmill'];
const WINDMILLS = 2;

/**
 * The island the seeded Math.random below picks, as islandMap in src/game/tiles.ts lays it out:
 * '.' grass, '~' lake, 'T' forest, 'C' the castle. Islands are random; the seed makes this run's
 * the same each time. Its lakes are named by where they lie: Westmere (0,2), Eastmere (5..7,4 and
 * 6,5) and Southmere (3..4,5 and 3,6). Eastmere has the most open shore, so round 1's decree asks
 * for 3 farms on it. The castle stands at (1,5).
 */
const ISLAND = 1990;
const MAP = [
  '.......TT.',
  '........T.',
  '~~...T....',
  '.~...T....',
  'TT...~~~..',
  '.C.~~.~...',
  '...~......',
];
const TERRAIN: Record<string, Cell> = { '.': 'grass', '~': 'lake', T: 'forest', C: 'castle' };
const FIRST_DECREE = { kind: 'shore', place: 'Eastmere', need: 3, done: false };

/**
 * The first round's plan, as (col, row) cells on MAP, with what each placement adds to the board
 * under the rules in src/game/state.ts: a farm scores 1 and 1 per lake beside it; a house 2 per
 * farm, 1 per house or forest beside it; a road nothing. `hand` is the three tiles the turn
 * draws from the pouch (seeded by the island and the draws so far, so they repeat every run; the
 * hand only depends on which kinds were placed, not where), `joins` how many more buildings the
 * castle's chain reaches, and `decree` marks the placement that fulfils the decree (and adds
 * DECREE_BONUS on top).
 */
const PLAN: { kind: Building; col: number; row: number; gained: number; hand: Building[]; joins: number; why: string; decree?: boolean }[] = [
  { kind: 'house', col: 0, row: 5, gained: 1, hand: ['house', 'house', 'tower'], joins: 1, why: 'the forest beside it; beside the castle, so it joins the chain' },
  { kind: 'farm', col: 2, row: 5, gained: 2, hand: ['farm', 'house', 'road'], joins: 1, why: 'the lake beside it, on the shore of Southmere; beside the castle' },
  { kind: 'farm', col: 5, row: 5, gained: 4, hand: ['farm', 'house', 'tower'], joins: 0, why: 'three lakes beside it, on the shore of Eastmere and Southmere' },
  { kind: 'farm', col: 4, row: 4, gained: 3, hand: ['farm', 'house', 'tower'], joins: 0, why: 'two lakes beside it, on the shore of Eastmere' },
  { kind: 'house', col: 4, row: 3, gained: 3, hand: ['house', 'house', 'tower'], joins: 0, why: 'the farm beside it pays 2 and the forest 1' },
  { kind: 'road', col: 2, row: 4, gained: 0, hand: ['house', 'tower', 'road'], joins: 0, why: 'a road scores nothing; it runs on from the farm by the castle' },
  { kind: 'farm', col: 7, row: 5, gained: 3, hand: ['farm', 'house', 'tower'], joins: 0, why: 'two lakes beside it, the third farm on the shore of Eastmere', decree: true },
];
/** The hand drawn once round 2's tiles are in the pouch. */
const ROUND_2_HAND: Building[] = ['house', 'tower', 'tower'];
/** Before the second house goes down, hovering its cell links the forest (+1) and the farm (+2) to it. */
const LINKED = { step: 4, links: [{ col: 5, row: 3, pts: 1 }, { col: 4, row: 4, pts: 2 }] };

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
    /** The cell the pointer is over, what the selected building would add there, and each neighbour's share. */
    preview: () => read<Preview | null>((s) => JSON.parse(JSON.stringify(s.preview))),
    /** Where the tile buttons are on screen. */
    buttons: () => read<(Box & { kind: Building })[]>((s) => s.tileButtons),
    /** Where the undo button is on screen. */
    undoButton: () => read<Box>((s) => s.undoButton),
    /** Where the gift card's buttons are while a gift is due. */
    giftButtons: () => read<(Box & { gift: Gift })[]>((s) => s.giftButtons),
  };
}

test('plays the first round', async ({ page }, testInfo) => {
  // Seeded like the other games' tests, so the game picks the same island (ISLAND) on every run.
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
  // animation frame at a time, so the popups play the same on a slow runner as on a fast one.
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
  await page.goto('/games/tiny-kingdom/');
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

  /** Where a point in the 960x540 view is on the page. */
  async function onPage(x: number, y: number) {
    const box = (await canvas.boundingBox())!;
    const scale = box.width / VIEW.w;
    return { x: box.x + x * scale, y: box.y + y * scale };
  }
  const cellPoint = (col: number, row: number) => onPage(GRID.x + (col + 0.5) * GRID.cell, GRID.y + (row + 0.5) * GRID.cell);

  /** Taps a point, as a player would, then lets a few frames play. */
  async function tap(at: { x: number; y: number }) {
    await page.mouse.click(at.x, at.y);
    await play(STEP_MS, async () => false);
  }
  async function pick(kind: Building) {
    const button = (await game.buttons()).find((b) => b.kind === kind)!;
    await tap(await onPage(button.x, button.y));
    expect((await game.state()).selected, `${kind} picked`).toBe(kind);
  }
  async function hover(col: number, row: number) {
    const at = await cellPoint(col, row);
    await page.mouse.move(at.x, at.y);
    await play(STEP_MS, async () => false);
  }
  const sorted = (links: Share[]) => [...links].sort((a, b) => a.col - b.col || a.row - b.row);

  /** The kinds in a hand, each once, in the order of the tile buttons. */
  const kinds = (hand: Building[]) => [...new Set(hand)];

  // A new kingdom on a random island: round 1, no score, the first round's tiles with the first
  // hand drawn from them, nothing built yet, no omen yet, a decree to fulfil and the two gifts on
  // offer for reaching the goal.
  let s = await game.state();
  expect(s).toMatchObject({ round: 1, goal: GOALS[0], score: 0, bonus: 0, pouch: FIRST_POUCH, hand: PLAN[0].hand, draws: 1, selected: null, placed: 0, phase: 'playing', omen: null, tradedIn: 0, castle: 0 });
  expect(s.hand, `a hand of ${HAND}`).toHaveLength(HAND);
  expect(s.island, 'the island the seeded Math.random picks').toBe(ISLAND);
  expect(s.grid, `island ${ISLAND} laid out as MAP`).toEqual(MAP.map((row) => [...row].map((c) => TERRAIN[c])));
  expect(s.decree, 'round 1 decree').toMatchObject(FIRST_DECREE);
  expect(s, 'the gifts for goal 1').toMatchObject({ gifts: FIRST_GIFTS, giftsDue: 0, unlocked: [], crowns: 0 });
  expect((await game.buttons()).map((b) => b.kind), 'one tile button per kind in the hand').toEqual(kinds(PLAN[0].hand));
  await snap('0-start');

  // Picking the house and hovering a cell beside the castle shows what it would score there,
  // without placing it: a link from the forest beside it, and that it joins the castle's chain.
  const first = PLAN[0];
  await pick(first.kind);
  await hover(first.col, first.row);
  const firstPreview = (await game.preview())!;
  expect(firstPreview, 'preview of the first house').toMatchObject({ col: first.col, row: first.row, gained: first.gained, base: 0, joins: first.joins });
  expect(sorted(firstPreview.links), 'the forest links +1').toEqual(sorted([{ col: 0, row: 4, pts: 1 }]));
  expect((await game.state()).score).toBe(0);
  await snap('1-preview');

  // Buildings only go on grass: a tap on the castle or a lake places nothing.
  for (const [col, row, cell] of [[1, 5, 'castle'], [0, 2, 'lake']] as const) {
    await tap(await cellPoint(col, row));
    s = await game.state();
    expect(s.grid[row][col]).toBe(cell);
    expect(s).toMatchObject({ score: 0, placed: 0, pouch: FIRST_POUCH, hand: first.hand });
  }

  // Each placement adds what its neighbours are worth, takes a tile from the pouch and draws the
  // next hand; a tile not in the hand has no button to pick.
  let score = 0;
  const pouch = { ...FIRST_POUCH };
  for (const [i, step] of PLAN.entries()) {
    s = await game.state();
    expect(s.hand, `the hand before placement ${i + 1}`).toEqual(step.hand);
    expect(s.draws, 'one draw per placement').toBe(i + 1);
    expect((await game.buttons()).map((b) => b.kind), `the tile buttons before placement ${i + 1}`).toEqual(kinds(step.hand));
    if (s.selected !== step.kind) await pick(step.kind);
    if (i === LINKED.step) {
      // Neighbour links: the house would gain 2 from the farm beside it and 1 from the forest.
      await hover(step.col, step.row);
      const p = (await game.preview())!;
      expect(p, 'preview of the house').toMatchObject({ col: step.col, row: step.row, gained: step.gained, base: 0, joins: 0 });
      expect(sorted(p.links), 'the forest links +1 and the farm +2').toEqual(sorted(LINKED.links));
      expect(p.links.reduce((t, l) => t + l.pts, p.base + p.season), 'the links add up to the preview').toBe(p.gained);
      await snap('3-links');
    }
    if (step.kind === 'road') {
      // A road scores nothing, so its preview shows +0 and no links; it only runs the chain on.
      await hover(step.col, step.row);
      expect(await game.preview(), 'preview of the road').toMatchObject({ col: step.col, row: step.row, gained: 0, base: 0, links: [], joins: 0 });
    }
    await tap(await cellPoint(step.col, step.row));
    s = await game.state();
    score += step.gained + (step.decree ? DECREE_BONUS : 0);
    pouch[step.kind]--;
    expect(s.grid[step.row][step.col], `placement ${i + 1}`).toBe(step.kind);
    expect(s.score, `score after the ${step.kind} at ${step.col},${step.row}: ${step.why}`).toBe(score);
    expect(s.placed).toBe(i + 1);
    if (score < GOALS[0]) expect(s).toMatchObject({ round: 1, pouch, phase: 'playing' });

    // One undo per round: after the farm by the castle it takes that farm back, with the hand it
    // was drawn from, and a second undo in the same round does nothing. Placing the farm again
    // then restores the score the plan expects and draws the same hand again.
    if (i === 1) {
      const undoAt = async () => {
        const b = await game.undoButton();
        return onPage(b.x, b.y);
      };
      await tap(await undoAt());
      s = await game.state();
      expect(s.grid[step.row][step.col], 'the undone farm is gone').toBe('grass');
      expect(s, 'undo takes back the farm and its hand').toMatchObject({
        score: score - step.gained,
        placed: 1,
        selected: step.kind,
        hand: step.hand,
        draws: i + 1,
        pouch: { ...pouch, [step.kind]: pouch[step.kind] + 1 },
      });
      await tap(await undoAt());
      expect(await game.state(), 'a second undo in the same round does nothing').toEqual(s);
      await tap(await cellPoint(step.col, step.row));
      s = await game.state();
      expect(s, 'the farm placed again').toMatchObject({ score, placed: i + 1, pouch, hand: PLAN[i + 1].hand });
      expect(s.grid[step.row][step.col]).toBe(step.kind);
    }

    // The third farm on Eastmere's shore fulfils the decree: +8 and a crown, saved in the browser.
    // (That farm also reaches the goal, so the decree on show is already round 2's.)
    if (step.decree) {
      expect(s).toMatchObject({ bonus: DECREE_BONUS, crowns: 1 });
      expect(await page.evaluate(() => localStorage.getItem('tiny-kingdom-crowns')), 'the crown is saved').toBe('1');
      // The crown earns the By royal decree trophy (src/trophies/), and nothing else yet.
      const trophies = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('tiny-kingdom-trophies') ?? '{}')));
      expect(trophies, 'trophies earned in the first round').toEqual(['firstCrown']);
      await snap('2-decree');
    } else expect(s.decree?.done, 'decree not yet fulfilled').toBe(false);
  }

  // The last farm reached the goal: round 2 begins with a higher goal and its tiles added to what
  // is left, a new hand drawn from them, and the gift for goal 1 waits to be chosen. Nothing can be
  // placed meanwhile. Omens only begin in round 3.
  expect(score).toBeGreaterThanOrEqual(GOALS[0]);
  const roundPouch = { ...pouch };
  for (const b of Object.keys(ROUND_POUCH) as Building[]) roundPouch[b] += ROUND_POUCH[b];
  expect(s).toMatchObject({ round: 2, goal: GOALS[1], phase: 'gift', giftsDue: 1, gifts: FIRST_GIFTS, pouch: roundPouch, hand: ROUND_2_HAND, omen: null });
  const offered = await game.giftButtons();
  expect(offered.map((b) => b.gift), 'the gift card offers the two gifts').toEqual(FIRST_GIFTS);
  await tap(await cellPoint(9, 6));
  expect((await game.state()).grid[6][9], 'no placing while the gift waits').toBe('grass');
  await snap('4-gift');

  // Taking the windmill adds its tiles to the pouch (the hand stays as drawn), and play goes on in round 2 with a new decree.
  const windmill = offered.find((b) => b.gift === 'windmill')!;
  await tap(await onPage(windmill.x, windmill.y));
  s = await game.state();
  expect(s).toMatchObject({ round: 2, goal: GOALS[1], phase: 'playing', giftsDue: 0, unlocked: ['windmill'], score, pouch: { ...roundPouch, windmill: WINDMILLS }, hand: ROUND_2_HAND });
  expect(s.gifts, 'round 2 offers two new gifts, not the windmill again').not.toContain('windmill');
  expect(s.decree, 'round 2 has a decree of its own').toMatchObject({ done: false });
  expect({ kind: s.decree!.kind, place: s.decree!.place }, 'not the same decree again').not.toEqual({ kind: FIRST_DECREE.kind, place: FIRST_DECREE.place });
  expect((await game.buttons()).map((b) => b.kind), 'the tile buttons show the new hand').toEqual(kinds(ROUND_2_HAND));
  // Let the round's banner fade (BANNER_MS) before the screenshot.
  await play(2_600, async () => false);
  await snap('5-round-2');

  const speed = gameMs / (Date.now() - startedAt);
  console.log(`Played ${Math.round(gameMs / 1000)}s of game time at ${speed.toFixed(1)}x (target ${SPEED}x).`);
  expect(errors).toEqual([]);
});
