import { expect, test, type Page } from '@playwright/test';

// Plays the first room with real inputs: picks the Knight on the hero panel, taps the first room on
// the map, fights the slime by tapping cards in the hand and the End turn button, as on a phone,
// picks up the slime's gold, then takes a card from the reward and is back on the map with the
// next rooms open.
// Game state is only read, through the `game` object the dev build puts on window.

type CardId = string;
type Intent = { kind: 'attack'; damage: number; hits?: number } | { kind: 'block'; block: number } | { kind: 'buff'; strength: number };
interface Enemy { id: number; kind: string; hp: number; maxHp: number; block: number; strength: number; step: number; intent: Intent }
interface Fight { draw: CardId[]; hand: CardId[]; discard: CardId[]; energy: number; block: number; turn: number; enemies: Enemy[] }
interface GameState {
  phase: 'hero' | 'map' | 'walk' | 'player' | 'enemy' | 'cleared' | 'reward' | 'rest' | 'over' | 'won';
  hero: 'knight' | 'hunter';
  depth: number;
  flasks: string[];
  hp: number;
  maxHp: number;
  deck: CardId[];
  gold: number;
  relics: string[];
  at: number | null;
  cleared: number[];
  fight: Fight | null;
  reward: CardId[] | null;
}
type Spot = { id: CardId; x: number; y: number; w: number; h: number };

const VIEW = { w: 960, h: 540 };
/** The Knight's button on the hero panel (the first of EVENT_BUTTONS), the first room on the map and the End turn button, from src/scenes/layout.ts and src/game/map.ts. */
const KNIGHT_BUTTON = { x: 480, y: 324 };
const FIRST_ROOM = { x: 110, y: 290 };
const END_TURN = { x: 884, y: 420 };
/** The starter deck's cards, from src/game/cards.ts. */
const STARTER: Record<string, { cost: number; damage?: number; block?: number }> = {
  strike: { cost: 1, damage: 6 },
  defend: { cost: 1, block: 5 },
  bash: { cost: 2, damage: 10 },
};
const STARTER_DECK = { strike: 5, defend: 4, bash: 1 };
/** The slime in the first room and what it does each turn, from src/game/enemies.ts. */
/** The slime's health on Normal, the gold it leaves and its moves: it opens with the first, then draws one of the others at random. */
const SLIME = { hp: 24, gold: 12, moves: [{ kind: 'attack', damage: 6 }, { kind: 'block', block: 5 }, { kind: 'attack', damage: 8 }] as Intent[] };

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

const count = (items: string[]) =>
  items.reduce<Record<string, number>>((acc, id) => ({ ...acc, [id]: (acc[id] ?? 0) + 1 }), {});

function scene(page: Page) {
  const read = <T>(fn: (s: any) => T) =>
    page.evaluate(`(${fn.toString()})(window.game.scene.getScene('Game'))`) as Promise<T>;
  return {
    state: () => read<GameState>((s) => JSON.parse(JSON.stringify(s.state))),
    /** Where the cards in hand are on screen. */
    hand: () => read<Spot[]>((s) => s.hand),
    /** Where the reward cards are on screen. */
    rewards: () => read<Spot[]>((s) => s.rewards),
  };
}

test('plays the first room', async ({ page }, testInfo) => {
  // A seeded Math.random keeps the shuffles and the rewards the same from run to run.
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
    window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(performance.now()), frameMs);
    window.cancelAnimationFrame = (id) => window.clearTimeout(id);
    // Phaser falls back to its canvas renderer. CI has no GPU, and WebGL in software is too slow to
    // play at SPEED; the game, its rules and the pixel art are the same either way.
    const getContext = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, id: string, ...rest: unknown[]) => unknown;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
      return /webgl/i.test(id) ? null : getContext.call(this, id, ...rest);
    } as typeof HTMLCanvasElement.prototype.getContext;
  }, FRAME_MS);
  await page.goto('/games/catacomb/');
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

  /** Plays on until `check` holds, for up to `ms` of game time. */
  async function until(what: string, check: (s: GameState) => boolean, ms = 10_000) {
    let state = await game.state();
    const ok = await play(ms, async () => check((state = await game.state())));
    if (!ok) throw new Error(`Timed out after ${ms}ms of game time waiting for: ${what}\nState ${JSON.stringify(state)}`);
    return state;
  }

  /** Taps a point of the 960x540 view, as a player would. */
  async function tap(p: { x: number; y: number }) {
    const box = (await canvas.boundingBox())!;
    const scale = box.width / VIEW.w;
    await page.mouse.click(box.x + p.x * scale, box.y + p.y * scale);
    await play(STEP_MS, async () => false);
  }

  // A new run opens on the hero panel, at depth 0 (nothing is saved in a fresh browser). Tapping
  // the Knight gives full health, the starter deck, a flask and no gold or relics, at the dungeon's
  // entrance.
  let s = await until('the hero choice', (s) => s.phase === 'hero');
  expect(s).toMatchObject({ depth: 0, at: null, cleared: [], fight: null });
  await play(400, async () => false);
  await snap('0-heroes');
  await tap(KNIGHT_BUTTON);
  s = await until('the map', (s) => s.phase === 'map');
  expect(s).toMatchObject({ hero: 'knight', hp: 50, maxHp: 50, gold: 0, relics: [], at: null, cleared: [], fight: null });
  expect(s.flasks).toHaveLength(1);
  expect(count(s.deck)).toEqual(STARTER_DECK);
  await play(600, async () => false);
  await snap('0-map');

  // Tapping the first room walks the hero there, and the fight with the slime starts: the deck is
  // shuffled into the draw pile and five cards are drawn, with three energy.
  await tap(FIRST_ROOM);
  s = await until('walking to the first room', (s) => s.phase === 'walk' || s.phase === 'player', 2_000);
  s = await until('the first fight', (s) => s.phase === 'player', 3_000);
  expect(s.at).toBe(0);
  let f = s.fight!;
  expect(f.enemies.map((e) => [e.kind, e.hp])).toEqual([['slime', SLIME.hp]]);
  expect(f).toMatchObject({ energy: 3, block: 0, turn: 1, discard: [] });
  expect(f.hand).toHaveLength(5);
  expect(count([...f.hand, ...f.draw])).toEqual(STARTER_DECK);
  await play(400, async () => false);
  let shotFight = false;

  // Fight until the slime falls: play attacks while there is energy for them, then defends, then
  // end the turn. Each card and each of the slime's turns is checked against the rules.
  for (let turns = 0; s.phase === 'player'; ) {
    f = s.fight!;
    const hand = await game.hand();
    expect(hand.map((c) => c.id)).toEqual(f.hand);
    const playable = (kind: 'damage' | 'block') => f.hand.findIndex((id) => STARTER[id][kind] && STARTER[id].cost <= f.energy);
    const i = playable('damage') >= 0 ? playable('damage') : playable('block');
    if (i >= 0) {
      const id = f.hand[i];
      const rule = STARTER[id];
      const slime = f.enemies[0];
      await tap(hand[i]);
      s = await game.state();
      const after = s.fight;
      if (s.phase === 'cleared') {
        expect(slime.hp + slime.block, 'the last blow fells the slime').toBeLessThanOrEqual(rule.damage ?? 0);
        break;
      }
      expect(after!.energy, `${id} costs ${rule.cost}`).toBe(f.energy - rule.cost);
      expect(after!.hand).toHaveLength(f.hand.length - 1);
      expect(after!.discard).toEqual([...f.discard, id]);
      if (rule.damage) {
        const blocked = Math.min(slime.block, rule.damage);
        expect(after!.enemies[0], `${id} hits the slime`).toMatchObject({ hp: slime.hp - (rule.damage - blocked), block: slime.block - blocked });
      }
      if (rule.block) expect(after!.block, `${id} gives block`).toBe(f.block + rule.block);
      if (!shotFight && rule.damage) {
        await play(200, async () => false);
        await snap('1-fight');
        shotFight = true;
      }
      continue;
    }

    // Out of energy or cards: end the turn, and the slime does what its intent said.
    expect(++turns, 'turns to fell the slime').toBeLessThan(8);
    const slime = f.enemies[0];
    // The intent shown over the slime is what it does; it opens with its first move.
    const intent = slime.intent;
    expect(SLIME.moves, 'the slime only makes its own moves').toContainEqual(intent);
    if (slime.step === 0) expect(intent).toEqual(SLIME.moves[0]);
    const attack = intent.kind === 'attack' ? intent.damage : 0;
    const block = intent.kind === 'block' ? intent.block : 0;
    const hpBefore = s.hp;
    await tap(END_TURN);
    s = await until('the slime acted', (s) => s.phase === 'player' || s.phase === 'over', 5_000);
    expect(s.phase, 'the hero survives the slime').toBe('player');
    expect(s.hp, 'the slime hits through block').toBe(hpBefore - Math.max(0, attack - f.block));
    const next = s.fight!;
    expect(next.enemies[0]).toMatchObject({ hp: slime.hp, step: slime.step + 1, block });
    expect(next.enemies[0].intent, 'the slime never makes the same move twice in a row').not.toEqual(intent);
    expect(next).toMatchObject({ turn: f.turn + 1, energy: 3, block: 0 });
    expect(next.hand).toHaveLength(5);
    expect(count([...next.hand, ...next.draw, ...next.discard])).toEqual(STARTER_DECK);
  }
  expect(shotFight, 'an attack was played').toBe(true);

  // The slime fell and left its gold. Three different cards are offered; tapping one adds it to the deck.
  s = await until('the reward', (s) => s.phase === 'reward', 3_000);
  expect(s.fight).toBeNull();
  expect(s.gold, 'the slime drops its gold').toBe(SLIME.gold);
  expect(new Set(s.reward).size).toBe(3);
  const rewards = await game.rewards();
  expect(rewards.map((c) => c.id)).toEqual(s.reward);
  await play(200, async () => false);
  await snap('2-reward');
  const hp = s.hp;
  await tap(rewards[0]);
  s = await game.state();
  expect(s).toMatchObject({ phase: 'map', at: 0, cleared: [0], reward: null, hp, gold: SLIME.gold });
  expect(count(s.deck)).toEqual(count([...Object.entries(STARTER_DECK).flatMap(([id, n]) => Array(n).fill(id)), rewards[0].id]));
  await play(600, async () => false);
  await snap('3-next-room');
  // The room cleared earns the Into the dark trophy (src/trophies/), and nothing else yet.
  const trophies = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('catacomb-trophies') ?? '{}')));
  expect(trophies, 'trophies earned in the first round').toEqual(['firstFight']);

  const speed = gameMs / (Date.now() - startedAt);
  console.log(`Played ${Math.round(gameMs / 1000)}s of game time at ${speed.toFixed(1)}x (target ${SPEED}x).`);
  expect(errors).toEqual([]);
});
