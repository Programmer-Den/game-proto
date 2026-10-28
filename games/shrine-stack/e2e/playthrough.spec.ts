import { expect, test, type Page } from '@playwright/test';

// Plays the first round with real inputs: picks one of the two patrons offered, watches the first
// stone swing, taps to drop each of the first tier's three stones while it is over the stone below,
// checks a tap while a stone falls drops nothing more, checks the break between tiers also offers a
// curse and the favor shop (which it leaves alone), spends favor to reroll the balanced tier's
// blessings, and takes one, which starts tier 2 with a trial.
// Game state is only read, through the `game` object the dev build puts on window.

type BlessingId = 'broad' | 'calm' | 'steady' | 'golden' | 'grace';
type StoneKind = 'normal' | 'heavy' | 'light';
type MaterialId = 'limestone' | 'marble' | 'sandstone' | 'basalt';
type PatronId = 'gilded' | 'hands' | 'patient' | 'storm';
interface Stone { x: number; w: number; tier: number; perfect: boolean; kind: StoneKind; material: MaterialId }
interface GameState {
  phase: 'patron' | 'swinging' | 'falling' | 'blessing' | 'over' | 'crowned';
  stones: Stone[];
  moving: { x: number; w: number; h: number; dir: 1 | -1; vy: number; kind: StoneKind; material: MaterialId };
  tier: number;
  inTier: number;
  wobbly: boolean;
  tiersBuilt: number;
  balancedTiers: number;
  favor: number;
  blessings: BlessingId[];
  offer: BlessingId[];
  speed: number;
  perfectPx: number;
  favorPerStone: number;
  grace: number;
  dropped: number;
  lastDrop: { x: number; w: number; kept: number; share: number; perfect: boolean; missed: boolean } | null;
  best: number;
  nextKind: StoneKind;
  slow: boolean;
  bought: string[];
  trial: { id: 'perfect' | 'keep'; done: number; failed: boolean } | null;
  curseOffer: 'haste' | 'brittle' | 'dim' | null;
  cursed: boolean;
  curse: { id: string; tier: number } | null;
  endless: boolean;
  wind: number;
  lean: number;
  chain: number;
  material: MaterialId;
  reserve: StoneKind | null;
  swapped: boolean;
  patronOffer: PatronId[];
  patron: PatronId | null;
}
type Spot = { x: number; y: number; w: number; h: number };
type Card = Spot & { id: BlessingId };
type PatronCard = Spot & { id: PatronId };

const VIEW = { w: 960, h: 540 };
/** The rules the first round goes through, from src/game/state.ts. */
const TOWER_X = 590;
const PLINTH_W = 260;
const START_W = 200;
const STONE_H = 28;
const SPEED_NORMAL = 230;
const STONES_PER_TIER = 3;
const BALANCE = 0.75;
const PERFECT_FAVOR = 2;
const TIER_FAVOR = 5;
const BROAD_PX = 40;
const CALM = 0.85;
const TIER_SPEEDUP = 0.05;
const STEADY_PX = 6;
const REROLL_COST = 5;
/** What each patron changes in the first round: the swing's pace, favor per stone and for a perfect drop, the blessings offered and the shop. */
const PATRON_RULES: Record<PatronId, { speed: number; perStone: number; perfectFavor: number; offer: number; shop: string[]; perfectPx: number }> = {
  gilded: { speed: 1, perStone: 2, perfectFavor: PERFECT_FAVOR, offer: 3, shop: ['slow', 'wider'], perfectPx: 5 },
  hands: { speed: 1.1, perStone: 1, perfectFavor: PERFECT_FAVOR, offer: 4, shop: ['slow', 'wider', 'grace'], perfectPx: 5 },
  patient: { speed: 0.9, perStone: 1, perfectFavor: 0, offer: 3, shop: ['slow', 'wider', 'grace'], perfectPx: 5 },
  storm: { speed: 1, perStone: 1, perfectFavor: PERFECT_FAVOR, offer: 3, shop: ['slow', 'wider', 'grace'], perfectPx: 8 },
};
/** A tap drops the stone when its middle is this close to the middle of what it lands on. */
const AIM_PX = 12;

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
    state: () => read<GameState>((s) => JSON.parse(JSON.stringify({ ...s.state, events: undefined }))),
    /** Where the patron cards are on screen before the first stone. */
    patrons: () => read<PatronCard[]>((s) => s.patronCards),
    /** Where the blessing cards are on screen while choosing. */
    cards: () => read<Card[]>((s) => s.blessingCards),
    /** Where the reroll button is while choosing. */
    reroll: () => read<Spot | null>((s) => s.rerollButton),
    /** The favor shop's buttons and the curse toggle while choosing. */
    shop: () => read<(Spot & { id: string })[]>((s) => s.shopButtons),
    curse: () => read<Spot | null>((s) => s.curseToggle),
  };
}

test('plays the first round', async ({ page }, testInfo) => {
  // Seeded like the other games' tests, so the blessings on offer repeat from run to run.
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
  // animation frame at a time, so the stones swing and fall the same on a slow runner as on a fast one.
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
  await page.goto('/games/shrine-stack/');
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
    testInfo.attach(name, { body: await page.screenshot({ path: testInfo.outputPath(`${name}.png`) }), contentType: 'image/png' });

  /** Where a point in the 960x540 view is on the page. */
  async function onPage(x: number, y: number) {
    const box = (await canvas.boundingBox())!;
    const scale = box.width / VIEW.w;
    return { x: box.x + x * scale, y: box.y + y * scale };
  }
  /** Taps a point, as a player would. Game time does not move during the tap. */
  async function tap(at: { x: number; y: number }) {
    await page.mouse.click(at.x, at.y);
  }
  /** Anywhere on the sky drops the stone; this spot is clear of the panel and the temple. */
  const sky = () => onPage(860, 200);

  // A new shrine waits for its patron: two are offered, and nothing moves until one is taken. A few
  // frames play first so the screenshot shows the drawn scene.
  await play(STEP_MS, async () => false);
  let s = await game.state();
  expect(s).toMatchObject({ phase: 'patron', tier: 1, inTier: 0, stones: [], favor: 0, blessings: [], tiersBuilt: 0, patron: null });
  expect(new Set(s.patronOffer).size).toBe(2);
  const patronCards = await game.patrons();
  expect(patronCards.map((c) => c.id)).toEqual(s.patronOffer);
  const idle = s.moving.x;
  await play(500, async () => false);
  s = await game.state();
  expect(s.moving.x, 'nothing moves before a patron is chosen').toBe(idle);
  await snap('0-patrons');

  // Taking the first patron sets the run's rule and starts the first stone swinging in from the left.
  await tap(await onPage(patronCards[0].x, patronCards[0].y));
  s = await game.state();
  const patron = PATRON_RULES[patronCards[0].id];
  expect(s).toMatchObject({ phase: 'swinging', patron: patronCards[0].id, patronOffer: [], favorPerStone: patron.perStone, perfectPx: patron.perfectPx });
  expect(s.moving.w).toBe(START_W);
  expect(s.speed).toBeCloseTo(SPEED_NORMAL * patron.speed);
  // The first tier is all ordinary limestone, with no trial, curse, wind, lean or reserve.
  expect(s).toMatchObject({ nextKind: 'normal', trial: null, curse: null, endless: false, wind: 0, slow: false, lean: 0, chain: 0, material: 'limestone', reserve: null });
  expect(s.moving).toMatchObject({ kind: 'normal', material: 'limestone' });
  await play(STEP_MS, async () => false);
  await snap('0-start');

  // The stone swings on its own.
  const x0 = s.moving.x;
  await play(500, async () => false);
  s = await game.state();
  expect(Math.abs(s.moving.x - x0), 'the stone swings').toBeGreaterThan(50);

  // Three drops, each timed for when the stone is over the one below: every stone keeps nearly all
  // of its width, so the tier is balanced.
  let favor = 0;
  for (let i = 0; i < STONES_PER_TIER; i++) {
    const below = i === 0 ? { x: TOWER_X, w: PLINTH_W } : s.stones[i - 1];
    const lined = await play(
      10_000,
      async () => {
        const m = (await game.state()).moving;
        return Math.abs(m.x - below.x) <= AIM_PX;
      },
      FRAME_MS,
    );
    expect(lined, `stone ${i + 1} swings over ${Math.round(below.x)}`).toBe(true);
    await tap(await sky());
    expect((await game.state()).phase, `stone ${i + 1} dropped`).toBe('falling');
    // A second tap while it falls drops nothing more.
    await play(FRAME_MS, async () => false, FRAME_MS);
    await tap(await sky());
    expect(await play(2_000, async () => (await game.state()).stones.length === i + 1, FRAME_MS), `stone ${i + 1} landed`).toBe(true);
    s = await game.state();
    const d = s.lastDrop!;
    expect(d.missed).toBe(false);
    expect(d.share, `stone ${i + 1} kept ${Math.round(d.kept)} of ${d.w}`).toBeGreaterThanOrEqual(BALANCE);
    expect(s.stones[i]).toMatchObject({ tier: 1, perfect: d.perfect, kind: 'normal', material: 'limestone' });
    expect(s.stones[i].w).toBeCloseTo(d.kept);
    expect(s.dropped).toBe(i + 1);
    favor += patron.perStone + (d.perfect ? patron.perfectFavor : 0);
    if (i < STONES_PER_TIER - 1) {
      expect(s).toMatchObject({ phase: 'swinging', tier: 1, inTier: i + 1, favor, wobbly: false });
      // The next stone is as wide as the one it will land on.
      expect(s.moving.w).toBeCloseTo(s.stones[i].w);
      expect(s.moving.h).toBeCloseTo((i + 1) * STONE_H + 120);
    }
    if (i === 0) await snap('1-first-stone');
  }

  // The balanced tier is built: it earns favor and offers different blessings, as many as the patron allows.
  favor += TIER_FAVOR;
  expect(s).toMatchObject({ phase: 'blessing', tier: 2, inTier: 0, tiersBuilt: 1, balancedTiers: 1, best: 1, favor, lean: 0, material: 'limestone' });
  expect(new Set(s.offer).size).toBe(patron.offer);
  expect(await page.evaluate(() => localStorage.getItem('shrine-stack-best'))).toBe('1');
  // The first tier earns the First course trophy (src/trophies/), and nothing else yet.
  const trophies = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('shrine-stack-trophies') ?? '{}')));
  expect(trophies, 'trophies earned in the first round').toEqual(['firstTier']);
  // The stone does not swing while the blessing is being chosen, and a tap on the dim does nothing.
  const waiting = s.moving.x;
  await play(1_000, async () => false);
  await tap(await onPage(480, 520));
  s = await game.state();
  expect(s).toMatchObject({ phase: 'blessing', stones: { length: 3 } });
  expect(s.moving.x).toBe(waiting);
  const cards = await game.cards();
  expect(cards.map((c) => c.id)).toEqual(s.offer);
  // The break also offers a curse to take with the blessing, and the favor shop; the first round
  // takes neither.
  expect(s).toMatchObject({ cursed: false, bought: [] });
  expect(s.curseOffer).not.toBeNull();
  expect(await game.curse()).not.toBeNull();
  expect((await game.shop()).map((b) => b.id)).toEqual(patron.shop);
  await snap('2-blessing');

  // Rerolling spends favor on three new blessings; the cards follow on the next frame.
  const button = (await game.reroll())!;
  expect(button).not.toBeNull();
  expect(favor).toBeGreaterThanOrEqual(REROLL_COST);
  await tap(await onPage(button.x, button.y));
  favor -= REROLL_COST;
  s = await game.state();
  expect(s).toMatchObject({ phase: 'blessing', favor, stones: { length: 3 } });
  expect(new Set(s.offer).size).toBe(patron.offer);
  await play(FRAME_MS * 2, async () => false, FRAME_MS);
  const rerolled = await game.cards();
  expect(rerolled.map((c) => c.id)).toEqual(s.offer);

  // Taking the first blessing applies it and starts tier 2.
  const before = s;
  const card = rerolled[0];
  await tap(await onPage(card.x, card.y));
  s = await game.state();
  expect(s).toMatchObject({ phase: 'swinging', tier: 2, offer: [], blessings: [card.id], curse: null, curseOffer: null, bought: [] });
  // Tier 2 sets a trial for extra favor.
  expect(s.trial).toMatchObject({ done: 0, failed: false });
  const top = before.stones[2];
  switch (card.id) {
    case 'broad':
      expect(s.stones[2].w).toBeCloseTo(Math.min(PLINTH_W, top.w + BROAD_PX));
      expect(s.moving.w).toBeCloseTo(s.stones[2].w);
      break;
    case 'calm':
      expect(s.speed).toBeCloseTo(SPEED_NORMAL * patron.speed * (1 + TIER_SPEEDUP) * CALM);
      break;
    case 'steady':
      expect(s.perfectPx).toBe(before.perfectPx + STEADY_PX);
      break;
    case 'golden':
      expect(s.favorPerStone).toBe(before.favorPerStone + 1);
      break;
    case 'grace':
      expect(s.grace).toBe(1);
      break;
  }
  // Tier 2's stone swings, a little faster than tier 1's. The reserve opens, but is left alone.
  if (card.id !== 'calm') expect(s.speed).toBeCloseTo(SPEED_NORMAL * patron.speed * (1 + TIER_SPEEDUP));
  expect(s).toMatchObject({ reserve: null, swapped: false });
  const x1 = s.moving.x;
  await play(1_000, async () => false);
  expect((await game.state()).moving.x).not.toBe(x1);
  await snap('3-tier-2');

  const speed = gameMs / (Date.now() - startedAt);
  console.log(`Played ${Math.round(gameMs / 1000)}s of game time at ${speed.toFixed(1)}x (target ${SPEED}x).`);
  expect(errors).toEqual([]);
});
