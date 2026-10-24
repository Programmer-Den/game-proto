import { expect, test, type Page } from '@playwright/test';

// Plays one round of the loop with real inputs (clicks to walk, as on a phone): open and close the
// recipes, watch the first customer walk in, harvest both gardens, refine, brew, take one potion out
// in its fine window, sell potions to a customer, with the tip they have left, towards the day's
// contract, and collect the coins.
// Game state is only read, through the `game` object the dev build puts on window.

type Point = { x: number; y: number };
type ItemId = string;
interface Order {
  id: number;
  wants: ItemId[];
  pay: Record<string, number>;
  patience: number;
  maxPatience: number;
  tip: number;
}
interface GameState {
  coins: number;
  carrying: ItemId[];
  plots: { plant: string; grown: number }[];
  refiner: { queue: ItemId[]; output: ItemId[] };
  cauldron: { contents: ItemId[]; brewing: { out: ItemId; ms: number; progress: number } | null; output: ItemId[] };
  refiner2: { queue: ItemId[]; output: ItemId[] };
  cauldron2: { contents: ItemId[]; brewing: { out: ItemId } | null; output: ItemId[] };
  expansion: Record<'land' | 'refiner' | 'cauldron', { built: boolean; paid: number }> & { fields: { built: boolean; paid: number }[] };
  counter: { shelf: ItemId[]; till: number };
  upgrades: Record<string, { level: number; paid: number }>;
  craftsmen: Record<string, { level: number; paid: number }>;
  orders: Order[];
  nextOrderId: number;
  contract: { day: number; potion: ItemId; need: number; made: number; reward: number; dayLeft: number; kept: number };
  sold: number;
  tips: number;
  lastSeen: number;
  reputation: number;
  shade: { built: boolean; paid: number }[];
  belts: Record<string, { built: boolean; paid: number; items: { id: ItemId; at: number }[] }>;
}

// Floor spots in the 1680x900 world, from src/scenes/layout.ts. Walking targets the doctor's feet.
// The world is bigger than the 960x540 view; the camera follows the doctor.
const VIEW = { w: 960, h: 540, hud: 44 };
/**
 * Each garden has three rows of three beds edge to edge, and the gardens stand one above the other.
 * The sickle reaches 72px from the doctor's middle, 28.5px above the feet. Walking left along the
 * line midway between the wheat field's bottom row (beds at y 212) and the mandrake patch's top row
 * (y 316), it reaches beds of both rows alike, and only those: first the right-hand column's (x 180),
 * then the middle one's (x 124), and the hands are full.
 */
const BESIDE_GARDENS = { x: 260, y: 292 };
const BETWEEN_GARDENS = { x: 152, y: 292 };
/** The beds cut on the way, by plot index: the right-hand and middle ones of each row. */
const WHEAT_CUT = [7, 8];
const MANDRAKE_CUT = [10, 11];
/** How long wheat and mandrake take to grow, from src/game/items.ts. */
const GROW_MS = { wheat: 24_000, mandrake: 30_000 };
/** Each station's drop and pick-up markers stand in a row north of it, its work spot just above it. */
const REFINER = { drop: { x: 290, y: 250 }, work: { x: 350, y: 288 }, pickUp: { x: 414, y: 250 } };
const CAULDRON = { drop: { x: 492, y: 250 }, work: { x: 552, y: 288 }, pickUp: { x: 624, y: 250 } };
/** Off the counter's work spot, so no customer pays in on the way to the coins. */
const LEAVE_SHOP = { x: 790, y: 380 };
/**
 * The counter's markers: the drop-off outside the shop's north door, work right behind the counter
 * and the coins beside it.
 */
const COUNTER = { drop: { x: 840, y: 180 }, work: { x: 840, y: 416 }, coins: { x: 892, y: 416 } };
/** The Recipes button in the top bar, on screen rather than in the world. */
const RECIPES_BUTTON = { x: 219, y: 22 };
/** Customers come in from the street door in the shop's south wall and line up below the counter. */
const STREET = { x: 840, y: 884 };
const FIRST_CUSTOMER = { x: 728, y: 560 };

const POTION_PRICE: Record<string, number> = { healingDraught: 8, sleepingTonic: 15, shadowElixir: 24 };
/**
 * A potion picked up in the last quarter of its brew comes out fine, and sells for half again as
 * much; from src/game/state.ts and src/game/items.ts.
 */
const FINE_SHARE = 0.25;
const FINE_BONUS = 1.5;
const FINE: Record<string, string> = { healingDraught: 'fineHealingDraught', sleepingTonic: 'fineSleepingTonic', shadowElixir: 'fineShadowElixir' };
const plain = (id: ItemId) => Object.keys(FINE).find((p) => FINE[p] === id) ?? id;
/** The street's reputation: a new game starts at 50, each filled order adds 3 and each customer who walks off takes 8. */
const START_REPUTATION = 50;
const REPUTATION_SERVED = 3;
const REPUTATION_WALKED_OFF = 8;
/** A day, dawn to dusk, and the first day's contract, from src/game/state.ts. */
const DAY_MS = 240_000;
const FIRST_CONTRACT = { day: 1, potion: 'sleepingTonic', need: 3, made: 0, reward: 20, kept: 0 };
/** A customer's tip: a coin and two per potion, shrinking to nothing once 60% of their patience is gone. */
const maxTip = (potions: number) => 1 + 2 * potions;
const TIP_SHARE = 0.6;
const tipNow = (o: Order, patience = o.patience) =>
  Math.round(o.tip * Math.max(0, Math.min(1, 1 - (o.maxPatience - patience) / (o.maxPatience * TIP_SHARE))));

/**
 * Game time per animation frame, every frame the same length. Longer frames mean fewer to draw, so
 * the game can play at SPEED on a CI runner without a GPU.
 */
const FRAME_MS = 64;
/** Game time advanced between checks: a few animation frames. */
const STEP_MS = 192;
/** The doctor's walking speed in pixels per second, from GameScene. */
const WALK_SPEED = 160;
/** The doctor stops within 4px of a tapped spot, but the last frame's step can carry the feet past it. */
const ARRIVED_PX = 4 + (WALK_SPEED * FRAME_MS) / 1000 + 2;
/**
 * How many times faster than real time the game plays, so the recorded video runs at that speed.
 * CI plays at 4x. A machine that can't keep up plays as fast as it can; the end of the run logs the
 * speed it reached.
 */
const SPEED = Number(process.env.PLAYTHROUGH_SPEED ?? 4);

/** What a customer coming in now pays for a potion: its price with the guild's upgrade, and a tip. */
const potionPay = (s: GameState, potion: string) =>
  Math.round(POTION_PRICE[potion] * (1 + 0.25 * s.upgrades.prices.level)) + 2 * (s.upgrades.counter.level + 1);

const count = (items: ItemId[]) =>
  items.reduce<Record<string, number>>((acc, id) => ({ ...acc, [id]: (acc[id] ?? 0) + 1 }), {});

function scene(page: Page) {
  const read = <T>(fn: (s: any) => T) =>
    page.evaluate(`(${fn.toString()})(window.game.scene.getScene('Game'))`) as Promise<T>;
  return {
    state: () => read<GameState>((s) => JSON.parse(JSON.stringify(s.state))),
    feet: () => read<Point & { moving: boolean }>((s) => ({ x: s.player.body.center.x, y: s.player.body.center.y, moving: !!s.pointerTarget })),
    /** Where the doctor walks to: the tapped spot, or the edge of a station tapped inside it. */
    target: () => read<Point | null>((s) => s.pointerTarget && { x: s.pointerTarget.x, y: s.pointerTarget.y }),
    /** The top-left corner of the view in the world, which moves as the camera follows the doctor. */
    view: () => read<Point>((s) => ({ x: s.cameras.main.worldView.x, y: s.cameras.main.worldView.y })),
    /** How many items each of a station's pallets shows, by item, for goods coming in and going out. */
    pallets: (station: string) =>
      page.evaluate(
        (id) => {
          const p = (window as any).game.scene.getScene('Game').pallets[id];
          const shown = (row: { item: string; count: number }[]) => Object.fromEntries(row.map((x) => [x.item, x.count]));
          return { in: shown(p.in), out: shown(p.out) };
        },
        station,
      ) as Promise<{ in: Record<string, number>; out: Record<string, number> }>,
    /** Whether the recipe overview is open, and its lines. */
    recipes: () => read<{ open: boolean; lines: string[] }>((s) => ({ open: s.recipes.visible, lines: s.recipes.lines })),
    /** The away summary chip's numbers, or null when it isn't shown. */
    away: () => read<unknown>((s) => s.away),
    /** Where each customer in the shop stands, and whether they have reached their spot at the counter. */
    customers: () => read<{ id: number; x: number; y: number; arrived: boolean }[]>((s) => s.customers),
    /**
     * Whether the first customer in the shop has reached the counter, and their own order's patience,
     * in one look; null while there is no such customer with an order.
     */
    firstCustomer: () =>
      read<{ arrived: boolean; patience: number; maxPatience: number } | null>((s) => {
        const customer = s.customers[0];
        const order = customer && s.state.orders.find((o: { id: number }) => o.id === customer.id);
        return order ? { arrived: customer.arrived, patience: order.patience, maxPatience: order.maxPatience } : null;
      }),
  };
}

test('plays a round of the game loop', async ({ page }, testInfo) => {
  // A seeded Math.random keeps customer orders the same from run to run.
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
  // frame at a time, so walking, timers and customers behave the same on a slow runner as on a fast
  // one, and waiting on a timer costs no real time.
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
  await page.goto('/games/apothecary/');
  const game = scene(page);
  const canvas = page.locator('canvas');

  /** Game time played since the game started, and the real time when it started. */
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
    await play(10_000, () => page.evaluate(() => !!(window as any).game?.scene.getScene('Game')?.player)),
    'game started',
  ).toBe(true);
  startedAt = Date.now();

  const snap = async (name: string) =>
    testInfo.attach(name, { body: await page.screenshot({ path: testInfo.outputPath(`${name}.png`) }), contentType: 'image/png' });

  /**
   * Taps a spot on screen, as a player would, and waits for the doctor's feet to arrive there. A hop
   * on the way to a spot can land inside a station, so it waits for where the game walks to instead.
   */
  async function tapAndWalk(tapped: Point, hop = false) {
    const box = (await canvas.boundingBox())!;
    const scale = box.width / VIEW.w;
    const view = await game.view();
    await page.mouse.click(box.x + (tapped.x - view.x) * scale, box.y + (tapped.y - view.y) * scale);
    const to = (hop && (await game.target())) || tapped;
    let at = await game.feet();
    const arrived = await play(15_000, async () => {
      at = await game.feet();
      return !at.moving && Math.hypot(at.x - to.x, at.y - to.y) < ARRIVED_PX;
    });
    expect(arrived, `walk to ${to.x},${to.y}; the doctor's feet are at ${JSON.stringify(at)}`).toBe(true);
  }

  /**
   * Walks to each spot in turn. A spot outside the view is reached in hops: tap the farthest point
   * towards it that is on screen, let the camera follow, and tap again.
   */
  async function walkTo(...route: Point[]) {
    const margin = 40;
    for (const to of route) {
      for (let hop = 0; ; hop++) {
        expect(hop, `hops to reach ${to.x},${to.y}`).toBeLessThan(6);
        const view = await game.view();
        const left = view.x + margin, right = view.x + VIEW.w - margin;
        const top = view.y + VIEW.hud + margin, bottom = view.y + VIEW.h - margin;
        if (to.x >= left && to.x <= right && to.y >= top && to.y <= bottom) {
          await tapAndWalk(to);
          break;
        }
        // The farthest point on the straight line towards the spot that is still on screen.
        const from = await game.feet();
        const dx = to.x - from.x, dy = to.y - from.y;
        let t = 1;
        if (dx > 0) t = Math.min(t, (right - from.x) / dx);
        if (dx < 0) t = Math.min(t, (left - from.x) / dx);
        if (dy > 0) t = Math.min(t, (bottom - from.y) / dy);
        if (dy < 0) t = Math.min(t, (top - from.y) / dy);
        await tapAndWalk({ x: Math.round(from.x + dx * t), y: Math.round(from.y + dy * t) }, true);
      }
    }
  }

  /** Plays on until `check` holds, for up to `ms` of game time. */
  async function until(what: string, check: (s: GameState) => boolean, ms = 30_000) {
    let state = await game.state();
    const ok = await play(ms, async () => check((state = await game.state())));
    if (!ok) {
      // Name where the doctor stood and what the world looked like when it gave up.
      const { orders, plots, ...rest } = state;
      throw new Error(`Timed out after ${ms}ms of game time waiting for: ${what}\n` +
        `Doctor at ${JSON.stringify(await game.feet())}, state ${JSON.stringify(rest)}`);
    }
    return state;
  }

  const fresh = await game.state();
  const freshAt = gameMs;
  expect(fresh.coins).toBe(0);
  expect(fresh.carrying).toEqual([]);
  // The first day's contract, with dusk still to come; a new game has been away nowhere, so there is
  // no away summary.
  expect(fresh.contract).toMatchObject(FIRST_CONTRACT);
  expect(fresh.contract.dayLeft).toBeGreaterThan(DAY_MS - 5_000);
  expect(fresh.contract.dayLeft).toBeLessThanOrEqual(DAY_MS);
  expect(fresh.sold).toBe(0);
  expect(await game.away()).toBeNull();

  // The Recipes button opens an overview of what each station makes from what; tapping it closes it.
  // Neither tap walks the doctor.
  const box = (await canvas.boundingBox())!;
  const tapScreen = (p: Point) => page.mouse.click(box.x + (p.x * box.width) / VIEW.w, box.y + (p.y * box.width) / VIEW.w);
  await tapScreen(RECIPES_BUTTON);
  await play(STEP_MS, async () => false);
  // British English is the default language, so the Vigour Tonic is spelled the British way.
  expect(await game.recipes()).toEqual({
    open: true,
    lines: [
      'Wheat = Wheat Flour',
      'Mandrake = Mandrake Seeds',
      'Nightshade = Nightshade Extract',
      "Nightshade Extract + Nightshade Extract = Witch's Brew",
      'Nightshade Extract + Mandrake Seeds = Shadow Elixir',
      'Nightshade Extract + Wheat Flour = Moonlight Salve',
      'Mandrake Seeds + Mandrake Seeds = Sleeping Tonic',
      'Wheat Flour + Mandrake Seeds = Vigour Tonic',
      'Wheat Flour + Wheat Flour = Healing Draught',
    ],
  });
  await snap('0-recipes');
  await tapScreen({ x: VIEW.w / 2, y: VIEW.h / 2 });
  await play(STEP_MS, async () => false);
  expect((await game.recipes()).open).toBe(false);
  expect((await game.feet()).moving).toBe(false);

  // The first customer comes in by the street door and walks up to their spot at the counter.
  let customers = await game.customers();
  expect(await play(10_000, async () => (customers = await game.customers()).length > 0), 'a customer came in').toBe(true);
  expect(customers[0]).toMatchObject({ x: STREET.x, arrived: false });
  expect(customers[0].y).toBeGreaterThan(FIRST_CUSTOMER.y);
  // All the way to the counter, they don't lose patience.
  let patient = true;
  const reached = await play(10_000, async () => {
    const first = await game.firstCustomer();
    if (first && !first.arrived && first.patience < first.maxPatience) patient = false;
    return !!first?.arrived;
  });
  expect(reached, 'the customer reached the counter').toBe(true);
  expect(patient, 'full patience while walking in').toBe(true);
  customers = await game.customers();
  expect(customers[0]).toMatchObject(FIRST_CUSTOMER);
  const waiting = await play(STEP_MS, async () => {
    const first = await game.firstCustomer();
    return !!first && first.patience < first.maxPatience;
  });
  expect(waiting, 'patience counts down once at the counter').toBe(true);
  // Their order carries a tip for quick service: a coin and two per potion.
  const firstOrder = (await game.state()).orders.find((o) => o.id === customers[0].id)!;
  expect(firstOrder.tip).toBe(maxTip(firstOrder.wants.length));

  // One round of the loop: harvest, refine, brew, sell and collect the coins.
  // Gardens: walk left along the line between the wheat field and the mandrake patch, where the
  // sickle cuts the beds either side until both hands are full.
  let s = await game.state();
  expect(s.plots.length, 'nine beds in each of six gardens').toBe(54);
  expect(s.plots.slice(0, 9).every((p) => p.plant === 'wheat') && s.plots.slice(9, 18).every((p) => p.plant === 'mandrake')).toBe(true);
  // A new game starts every bed ripe.
  for (const i of WHEAT_CUT) expect(s.plots[i].grown).toBe(GROW_MS.wheat);
  for (const i of MANDRAKE_CUT) expect(s.plots[i].grown).toBe(GROW_MS.mandrake);
  await walkTo(BESIDE_GARDENS, BETWEEN_GARDENS);
  s = await until('two wheat and two mandrakes harvested', (s) => s.carrying.length === 4);
  expect(count(s.carrying)).toEqual({ wheat: 2, mandrake: 2 });
  // Just those four beds were cut, and grow again from nothing.
  s.plots.slice(0, 18).forEach((p, i) => expect(p.grown >= GROW_MS[p.plant as 'wheat' | 'mandrake'], `bed ${i} ripe`).toBe(![...WHEAT_CUT, ...MANDRAKE_CUT].includes(i)));
  // The camera followed the doctor up to the gardens, at the top-left corner of the world.
  expect(await game.view()).toEqual({ x: 0, y: 0 });
  await snap('1-harvested');

  // Refining table: drop the plants, work until they are refined, pick the goods up.
  await walkTo(REFINER.drop);
  s = await until('plants dropped at the refining table', (s) => s.carrying.length === 0);
  expect(s.refiner.queue.length + s.refiner.output.length).toBe(4);
  // Each kind of plant goes on its own pallet left of the table. Nightshade's pallets aren't there
  // until a shade garden grows it.
  expect(await game.pallets('refiner')).toEqual({ in: { wheat: 2, mandrake: 2 }, out: { flour: 0, mandrakeSeeds: 0 } });
  await walkTo(REFINER.work);
  await snap('2-refining');
  await until('plants refined', (s) => s.refiner.output.length === 4);
  expect(await game.pallets('refiner')).toEqual({ in: { wheat: 0, mandrake: 0 }, out: { flour: 2, mandrakeSeeds: 2 } });
  await walkTo(REFINER.pickUp);
  s = await until('refined goods picked up', (s) => s.carrying.length === 4);
  expect(count(s.carrying)).toEqual({ flour: 2, mandrakeSeeds: 2 });
  // The hands take a mix, a flour and a seed in turn, rather than all of one kind first.
  expect(count(s.carrying.slice(0, 2))).toEqual({ flour: 1, mandrakeSeeds: 1 });

  // Cauldron: two seeds brew a Sleeping Tonic, two flour a Healing Draught. The other potions are
  // still to be learned at the study.
  await walkTo(CAULDRON.drop);
  await until('goods in the cauldron', (s) => s.carrying.length === 0);
  // The cauldron picks its recipe when work starts: the potion with the fewest on its output
  // pallets, Sleeping Tonic on a tie. Two flour and two seeds could make either first, and both
  // pallets are empty.
  s = await game.state();
  expect(s.cauldron.brewing).toBeNull();
  expect(s.cauldron.output).toEqual([]);
  await walkTo(CAULDRON.work);
  s = await until('a brew started', (s) => s.cauldron.brewing !== null);
  expect(s.cauldron.brewing!.out).toBe('sleepingTonic');
  await snap('3-brewing');
  const first = s.cauldron.brewing!.out;
  const second = first === 'sleepingTonic' ? 'healingDraught' : 'sleepingTonic';
  // The last quarter of a brew is its fine window: step off the work spot then, which stops the
  // brew where it is, and pick the potion up, and it comes out fine.
  s = await until('the brew in its fine window', (s) => !!s.cauldron.brewing && s.cauldron.brewing.progress >= s.cauldron.brewing.ms * (1 - FINE_SHARE));
  expect(s.cauldron.brewing!.progress).toBeLessThan(s.cauldron.brewing!.ms);
  await walkTo(CAULDRON.pickUp);
  s = await until('a fine potion picked up', (s) => s.carrying.length === 1);
  expect(s.carrying).toEqual([FINE[first]]);
  expect(s.cauldron.output).toEqual([]);
  await snap('3-fine');
  // Back on the work spot, the other brew runs to its end and comes out plain, onto its pallet. Only
  // the two potions known from the start have pallets.
  await walkTo(CAULDRON.work);
  await until('the second potion brewed', (s) => s.cauldron.output.length === 1);
  expect(await game.pallets('cauldron')).toEqual({
    in: { flour: 0, mandrakeSeeds: 0 },
    out: { healingDraught: 0, sleepingTonic: 0, [second]: 1 },
  });
  await walkTo(CAULDRON.pickUp);
  s = await until('potions picked up', (s) => s.carrying.length === 2);
  // Over at the cauldron, the view has scrolled along the line with the doctor.
  expect((await game.view()).x).toBeGreaterThan(0);
  expect(count(s.carrying)).toEqual({ [FINE[first]]: 1, [second]: 1 });

  // Storefront: stock the shelves from the drop-off outside the door, serve customers until one has
  // paid, then take the coins.
  await walkTo(COUNTER.drop);
  s = await until('potions on the shelf', (s) => s.carrying.length === 0);
  // The potions stand on the shelves along the shop's walls, one shelf for each potion learned, a
  // fine one on its plain potion's.
  const shelf = count(s.counter.shelf.map(plain));
  expect((await game.pallets('counter')).in).toEqual({
    healingDraught: shelf.healingDraught ?? 0,
    sleepingTonic: shelf.sleepingTonic ?? 0,
  });
  // One of each potion: a customer pays less for a potion while more of its kind stay stocked,
  // so with no others left behind each one sells at full pay.
  expect(Math.max(...Object.values(shelf)), 'no stock to lower the pay').toBe(1);
  // A tap straight at the counter: the shop's walls are solid, so the doctor finds the way in by the door.
  await walkTo(COUNTER.work);
  await snap('4-serving');
  // Each customer pays for every potion they get, at the price they came in with. A customer who
  // came in and was served between two looks pays today's price. A customer whose order is filled
  // also tips what is left of their tip, which shrank while they waited: between what it was at the
  // last look and what it was at this one. The day and the waiting customers' patience run on the
  // same clock. Every Sleeping Tonic sold counts towards the contract. A fine potion goes first and
  // pays half again as much. Each order filled raises the street's reputation; each customer who
  // walks off lowers it.
  let prev = s;
  let owed = s.counter.till;
  let tonics = 0;
  let filled = 0;
  let walkedOff = 0;
  const contractBefore = s.contract.made;
  const reputationBefore = s.reputation;
  const finePay = (pay: number) => Math.round(pay * FINE_BONUS);
  s = await until(
    'customers served',
    (s) => {
      const tipped = s.tips - prev.tips;
      const passed = prev.contract.dayLeft - s.contract.dayLeft;
      let tipLow = 0, tipHigh = 0;
      const served = count(prev.counter.shelf);
      for (const [p, n] of Object.entries(count(s.counter.shelf))) served[p] -= n;
      for (const order of prev.orders) {
        const now = s.orders.find((o) => o.id === order.id);
        // An order that is gone was filled, unless the customer ran out of patience.
        if (!now && order.patience < 5_000) {
          walkedOff++;
          continue;
        }
        if (!now) {
          filled++;
          tipLow += tipNow(order, order.patience - passed);
          tipHigh += tipNow(order);
        }
        // A customer already waiting at the counter loses as much patience as the day goes by.
        if (now && order.patience < order.maxPatience) expect(order.patience - now.patience, `patience of order ${order.id}`).toBeCloseTo(passed, 6);
        const left = [...(now?.wants ?? [])];
        for (const want of order.wants) {
          const i = left.indexOf(want);
          if (i >= 0) left.splice(i, 1);
          else if (served[FINE[want]] > 0) {
            owed += finePay(order.pay[want]);
            served[FINE[want]]--;
          } else {
            owed += order.pay[want];
            served[want]--;
          }
        }
      }
      for (const [p, n] of Object.entries(served)) owed += n * (p === plain(p) ? potionPay(s, p) : finePay(potionPay(s, plain(p))));
      tonics += (count(prev.counter.shelf.map(plain)).sleepingTonic ?? 0) - (count(s.counter.shelf.map(plain)).sleepingTonic ?? 0);
      expect(tipped, `tips paid between looks, from ${JSON.stringify(prev.orders)}`).toBeGreaterThanOrEqual(tipLow);
      expect(tipped, `tips paid between looks, from ${JSON.stringify(prev.orders)}`).toBeLessThanOrEqual(tipHigh);
      owed += tipped;
      prev = s;
      return s.counter.shelf.length === 0 || s.counter.till > 0;
    },
    45_000,
  );
  expect(s.counter.till, 'a customer paid').toBeGreaterThan(0);
  expect(s.counter.till, 'paid per potion, and tips').toBe(owed);
  // The Sleeping Tonics sold count towards today's contract, which needs more than one round's worth.
  expect(s.contract).toMatchObject({ ...FIRST_CONTRACT, made: contractBefore + tonics });
  expect(s.sold).toBe(2 - s.counter.shelf.length);
  // The first potion sold earns the First customer trophy (src/trophies/), and nothing else yet.
  const trophies = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('apothecary-trophies') ?? '{}')));
  expect(trophies, 'trophies earned in the first round').toEqual(['firstSale']);
  expect(filled, 'an order filled').toBeGreaterThan(0);
  expect(s.reputation, `${filled} orders filled, ${walkedOff} walked off`).toBe(
    Math.max(0, Math.min(100, reputationBefore + REPUTATION_SERVED * filled - REPUTATION_WALKED_OFF * walkedOff)),
  );
  expect(reputationBefore).toBe(START_REPUTATION);
  // Step off the work spot first, so no customer pays in while the doctor heads for the coins.
  await walkTo(LEAVE_SHOP);
  s = await game.state();
  const earned = s.counter.till;
  await walkTo(COUNTER.coins);
  s = await until('coins collected', (s) => s.counter.till === 0);
  expect(s.coins).toBe(earned);
  // Nothing was bought along the way; no walk clipped a purple marker.
  for (const level of [...Object.values(s.upgrades), ...Object.values(s.craftsmen)]) expect(level).toEqual({ level: 0, paid: 0 });
  for (const garden of s.shade) expect(garden).toEqual({ built: false, paid: 0 });
  // The day went by, still short of dusk: the contract is the first day's.
  expect(s.contract.day).toBe(1);
  expect(s.contract.dayLeft).toBeLessThan(fresh.contract.dayLeft - (gameMs - freshAt) / 2);

  const speed = gameMs / (Date.now() - startedAt);
  console.log(`Played ${Math.round(gameMs / 1000)}s of game time at ${speed.toFixed(1)}x (target ${SPEED}x).`);
  expect(errors).toEqual([]);
});
