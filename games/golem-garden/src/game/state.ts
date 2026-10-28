// The garden's state and the rules that change it. No Phaser: the scene calls these on taps and
// calls `tick` every frame with the game time that passed.
import { GARDENS, cellAt, cellCentre, pathPoint, routeDist, type Garden } from './board';
import {
  BLOOM_GOAL,
  BOON,
  BOSS_EVERY,
  CHEW_PER_BITE,
  COMBO,
  COMPOST,
  EARLY_BONUS,
  FORM_INFO,
  GARDEN_TWISTS,
  GOLEM_INFO,
  HARVEST_WAVE,
  HEDGE,
  LEAN_SAP,
  MAX_LEVEL,
  MOVE_FEE,
  PEST_INFO,
  SLIME,
  START,
  TARGETS,
  THORNY_STARS,
  UPGRADE_COST,
  UPROOT_REFUND,
  boonOffer,
  golemStats,
  harvestStars,
  regrowCost,
  waveBonus,
  waveFor,
  type Boon,
  type FormKind,
  type GolemKind,
  type PestKind,
  type SeedKind,
  type Spawn,
  type Target,
  type Twist,
} from './data';

export interface Golem {
  id: number;
  kind: GolemKind;
  col: number;
  row: number;
  level: number;
  /** Time left until the seed has grown into a golem, in ms; 0 once it has. */
  growMs: number;
  /** Time left until it can throw again, in ms. */
  cooldownMs: number;
  /** Sap spent on it, its seed and its levels; uprooting gives back UPROOT_REFUND of it. */
  spent: number;
  /** The form it took at level MAX_LEVEL, or null below it. */
  form: FormKind | null;
  /** Which pest within reach it throws at. */
  target: Target;
}

/** A hedge on a path cell: pests stop at it and chew until it is gone. */
export interface Hedge {
  id: number;
  col: number;
  row: number;
  hp: number;
  maxHp: number;
  /** Where on each of the garden's routes pests halt at it, in pixels, or null for a route that misses it. */
  stops: (number | null)[];
}

export interface Pest {
  id: number;
  kind: PestKind;
  hp: number;
  maxHp: number;
  /** The wave it came with. */
  wave: number;
  /** Which of the garden's routes it walks (an index into `Garden.routes`). */
  route: number;
  /** How far along its route it has walked, in pixels. */
  dist: number;
  /** Underground in its tunnel (a mole), where no golem can reach it. */
  under: boolean;
  /** Time left on a moss golem's slow, in ms. */
  slowMs: number;
  slowFactor: number;
  /** Time left on its hit flash, in ms. */
  hitMs: number;
}

/** A thrown stone, moss clump or thorn in flight, drawn by the scene; its damage lands when thrown. */
export interface Shot {
  id: number;
  kind: GolemKind;
  from: { x: number; y: number };
  to: { x: number; y: number };
  ms: number;
}

/** A wave called early, still waiting for its last pests to be squashed or get through. */
export interface Called {
  wave: number;
  /** Its Queen Slug was squashed (only a Queen Slug wave whose queen is off the path can be called early). */
  queenSquashed: boolean;
  /** A pest got through to the Heartwood since the call (a leaf boon growing it back doesn't undo it). */
  lost: boolean;
}

/** A wave called early that came to an end. */
export interface Settled {
  wave: number;
  /** The Heartwood lost no leaf between the call and the end (a leaf regrown in between doesn't count). */
  clean: boolean;
}

/** A pest just squashed: where, and the sap it dropped. The scene shows it and then empties the list. */
export interface Pop {
  x: number;
  y: number;
  sap: number;
}

/** A cell slimed by the Queen Slug: golems on it throw slower until it dries. */
export interface Slime {
  col: number;
  row: number;
  ms: number;
}

export interface GameState {
  /** Which garden this is, an index into GARDENS. */
  garden: number;
  /** The wave being fought, or the next one while building. */
  wave: number;
  /** 'build' between waves, 'wave' while pests come, 'over' once the Heartwood is eaten. */
  phase: 'build' | 'wave' | 'over';
  heart: number;
  sap: number;
  /** The seed the next tap on soil (or, for a hedge, on the path) plants. */
  selected: SeedKind;
  golems: Golem[];
  hedges: Hedge[];
  pests: Pest[];
  /** Pests of the current wave still to come in. */
  queue: Spawn[];
  /** Pests come in so far this garden; they take the garden's routes in turn. */
  spawned: number;
  /** Cells the Queen Slug has slimed. */
  slime: Slime[];
  /** The speed button: the game plays FAST times quicker while it is on. */
  fast: boolean;
  /** Time since the current wave started, in ms. */
  waveMs: number;
  waveHpScale: number;
  shots: Shot[];
  kills: number;
  /** Buds open on the Heartwood, one per wave cleared or called early, up to BLOOM_GOAL; kept between gardens. */
  bloom: number;
  /** Pests squashed since the scene last looked. */
  pops: Pop[];
  /** The most waves cleared in any garden, this one included. */
  best: number;
  /** Compost paid when the last wave ended: COMPOST.rate of the sap unspent then, up to COMPOST.cap. */
  compost: number;
  /** Each garden's harvest stars (0 to 3), in GARDENS order; this garden's rises at its harvest. */
  stars: number[];
  /** The stars this garden's harvest earned at wave HARVEST_WAVE, or 0 before it. */
  harvest: number;
  /** Playing the garden's thorny variant, with its twist (`twistOf`). */
  thorny: boolean;
  /** Each garden's laurel (0 or 1), won by harvesting its thorny variant, in GARDENS order. */
  laurels: number[];
  /** Boons taken this garden, one per Queen Slug wave cleared; a boon taken twice counts twice. */
  boons: Boon[];
  /** The rows the Sunny row boons shine on, one per Sunny row taken. */
  sunRows: number[];
  /** The three boons to pick from after a Queen Slug wave, or empty when there is no pick to make. */
  offer: Boon[];
  /** The Queen Slug was squashed this wave (one that got through to the Heartwood earns no boons). */
  queenSquashed: boolean;
  /** Waves called early whose last pests still walk: each is done (bonus, bud, best) once they are gone. */
  called: Called[];
  /** Waves called early that came to an end since the scene last looked. The scene empties it. */
  settled: Settled[];
  /** Leaves regrown this garden; each makes the next one dearer. */
  regrown: number;
  nextId: number;
}

/** The rules run in steps of at most this many ms, so a long frame plays like several short ones. */
const STEP_MS = 16;
/** How far before a hedge cell's centre pests halt to chew on it, in pixels. */
const HEDGE_STOP = 30;
/** How long a throw is in the air, in ms. */
export const SHOT_MS = 160;
/** How long a pest flashes after a hit, in ms. */
const HIT_MS = 120;

export function newGame(best: number, bloom = 0, garden = 0, stars: number[] = [], thorny = false, laurels: number[] = []): GameState {
  const n = GARDENS[garden] ? garden : 0;
  const isThorny = thorny && (stars[n] ?? 0) >= THORNY_STARS;
  return {
    garden: n,
    wave: 1,
    phase: 'build',
    heart: START.heart,
    sap: isThorny && GARDEN_TWISTS[n] === 'sap' ? LEAN_SAP : START.sap,
    selected: 'pebble',
    golems: [],
    hedges: [],
    pests: [],
    queue: [],
    spawned: 0,
    slime: [],
    fast: false,
    waveMs: 0,
    waveHpScale: 1,
    shots: [],
    kills: 0,
    bloom: Math.min(BLOOM_GOAL, bloom),
    pops: [],
    best,
    compost: 0,
    stars: GARDENS.map((_, i) => stars[i] ?? 0),
    harvest: 0,
    thorny: isThorny,
    laurels: GARDENS.map((_, i) => laurels[i] ?? 0),
    boons: [],
    sunRows: [],
    offer: [],
    queenSquashed: false,
    called: [],
    settled: [],
    regrown: 0,
    nextId: 1,
  };
}

export const gardenOf = (s: GameState): Garden => GARDENS[s.garden];

/** Harvest stars earned over every garden; they unlock gardens (`Garden.unlockStars`). */
export const totalStars = (s: GameState) => s.stars.reduce((a, b) => a + b, 0);

/** Whether garden `n` can be planted: enough harvest stars have been earned. */
export const gardenOpen = (s: GameState, n: number) => totalStars(s) >= GARDENS[n].unlockStars;

/** Whether garden `n`'s thorny variant can be planted: it has THORNY_STARS stars. */
export const thornyOpen = (s: GameState, n: number) => s.stars[n] >= THORNY_STARS;

/** The twist this garden is played with: its own in its thorny variant, none otherwise. */
export const twistOf = (s: GameState): Twist | null => (s.thorny ? GARDEN_TWISTS[s.garden] : null);

/** How many times boon `boon` has been taken this garden. */
export const boonCount = (s: GameState, boon: Boon) => s.boons.filter((b) => b === boon).length;

/**
 * Whether this seed can be picked: the Thorn golem only once the Heartwood is in full bloom, the
 * hedge unless the thorny variant's twist took it away.
 */
export const unlocked = (s: GameState, kind: SeedKind) =>
  kind === 'hedge' ? twistOf(s) !== 'hedges' : !GOLEM_INFO[kind].locked || s.bloom >= BLOOM_GOAL;

/** What a seed costs to plant. */
export const seedCost = (kind: SeedKind) => (kind === 'hedge' ? HEDGE.cost : GOLEM_INFO[kind].cost);

export function select(s: GameState, kind: SeedKind) {
  if (!unlocked(s, kind)) return false;
  s.selected = kind;
  return true;
}

export const golemAt = (s: GameState, col: number, row: number) => s.golems.find((g) => g.col === col && g.row === row);
export const hedgeAt = (s: GameState, col: number, row: number) => s.hedges.find((h) => h.col === col && h.row === row);

/** Whether (col, row) is soil with no golem on it. */
export const freeSoil = (s: GameState, col: number, row: number) => gardenOf(s).map[row]?.[col] === 'soil' && !golemAt(s, col, row);

/** Whether (col, row) is a path cell (not the Heartwood's) with no hedge on it. */
export const freePath = (s: GameState, col: number, row: number) => gardenOf(s).map[row]?.[col] === 'path' && !hedgeAt(s, col, row);

/** Whether the selected seed can be planted at (col, row) now: a golem on free soil, a hedge on a free path cell. */
export function canPlant(s: GameState, col: number, row: number) {
  if (s.phase === 'over' || !unlocked(s, s.selected) || s.sap < seedCost(s.selected)) return false;
  return s.selected === 'hedge' ? freePath(s, col, row) : freeSoil(s, col, row);
}

/** Plants the selected seed, if there is sap for it: a golem seed on empty soil, or a hedge on the path. */
export function plant(s: GameState, col: number, row: number) {
  if (!canPlant(s, col, row)) return false;
  s.sap -= seedCost(s.selected);
  if (s.selected === 'hedge') {
    const stops = gardenOf(s).routes.map((route) => {
      const at = routeDist(route, col, row);
      return at === null ? null : at - HEDGE_STOP;
    });
    const hp = HEDGE.hp * (1 + BOON.hedgeHp * boonCount(s, 'hedge'));
    s.hedges.push({ id: s.nextId++, col, row, hp, maxHp: hp, stops });
    return true;
  }
  const info = GOLEM_INFO[s.selected];
  s.golems.push({ id: s.nextId++, kind: s.selected, col, row, level: 1, growMs: info.growMs, cooldownMs: 0, spent: info.cost, form: null, target: 'first' });
  return true;
}

/** Sap to raise this golem a level, or null when it can't be raised (still growing or at the top). */
export function upgradeCost(g: Golem) {
  return g.growMs > 0 || g.level >= MAX_LEVEL ? null : UPGRADE_COST[g.level];
}

/** Whether raising this golem next makes it level MAX_LEVEL, which needs a form picked. */
export const picksForm = (g: Golem) => g.level === MAX_LEVEL - 1;

/**
 * Raises a grown golem a level, if there is sap for it. The raise to MAX_LEVEL needs a `form` of
 * its kind, which it then keeps.
 */
export function upgrade(s: GameState, g: Golem, form: FormKind | null = null) {
  const cost = upgradeCost(g);
  if (s.phase === 'over' || cost === null || s.sap < cost) return false;
  if (picksForm(g)) {
    if (!form || FORM_INFO[form].of !== g.kind) return false;
    g.form = form;
  }
  s.sap -= cost;
  g.spent += cost;
  g.level++;
  return true;
}

/**
 * The stats a golem of `kind` at `level` and `form` throws with on `row` of this garden: its own,
 * with the garden's boons (Sharp rocks, Long moss, Sunny row) folded in.
 */
export function boonedStats(s: GameState, kind: GolemKind, level: number, form: FormKind | null, row: number) {
  const stats = golemStats(kind, level, form);
  if (kind === 'pebble') stats.damage *= 1 + BOON.pebbleDamage * boonCount(s, 'pebble');
  if (stats.slow) stats.slow = { factor: stats.slow.factor, ms: stats.slow.ms * (1 + BOON.mossSlow * boonCount(s, 'moss')) };
  stats.range += BOON.sunReach * s.sunRows.filter((r) => r === row).length;
  return stats;
}

/** The stats this golem throws with now. */
export const statsOf = (s: GameState, g: Golem) => boonedStats(s, g.kind, g.level, g.form, g.row);

/** Sets how a golem picks its target; a golem that hits everything in reach has no pick to make. */
export function setTarget(s: GameState, g: Golem, target: Target) {
  if (!s.golems.includes(g) || statsOf(s, g).area) return false;
  g.target = target;
  return true;
}

/** Steps a golem's targeting to the next mode, round and round. */
export const nextTarget = (g: Golem): Target => TARGETS[(TARGETS.indexOf(g.target) + 1) % TARGETS.length];

/** The sap uprooting this golem gives back. */
export const uprootValue = (g: Golem) => Math.floor(g.spent * UPROOT_REFUND);

/** Pulls a golem up, giving back UPROOT_REFUND of the sap spent on it. */
export function uproot(s: GameState, g: Golem) {
  if (s.phase === 'over' || !s.golems.includes(g)) return false;
  s.sap += uprootValue(g);
  s.golems = s.golems.filter((other) => other !== g);
  return true;
}

/** Whether this golem can move to (col, row) now: free soil, and MOVE_FEE sap. */
export const canMove = (s: GameState, g: Golem, col: number, row: number) =>
  s.phase !== 'over' && s.golems.includes(g) && s.sap >= MOVE_FEE && freeSoil(s, col, row);

/** Moves a golem, as it is (growing or grown, and its level), to another soil cell for MOVE_FEE sap. */
export function move(s: GameState, g: Golem, col: number, row: number) {
  if (!canMove(s, g, col, row)) return false;
  s.sap -= MOVE_FEE;
  g.col = col;
  g.row = row;
  return true;
}

/** The grown golems side by side with (col, row): one cell up, down, left or right. */
export function neighbours(s: GameState, col: number, row: number) {
  return s.golems.filter((o) => o.growMs === 0 && Math.abs(o.col - col) + Math.abs(o.row - row) === 1);
}

/**
 * What combo a golem of `kind` at (col, row) gets from its neighbours: a pebble golem next to a
 * moss golem hits slowed pests harder ('slowed'), a thorn golem next to one pricks twice ('twice').
 */
export function comboAt(s: GameState, kind: GolemKind, col: number, row: number): 'slowed' | 'twice' | null {
  if (kind === 'moss' || !neighbours(s, col, row).some((o) => o.kind === 'moss')) return null;
  return kind === 'pebble' ? 'slowed' : 'twice';
}

/** Whether (col, row) is slimed by the Queen Slug. */
export const slimed = (s: GameState, col: number, row: number) => s.slime.some((c) => c.col === col && c.row === row);

/** Whether a Queen Slug is still on the path. */
export const queenOnPath = (s: GameState) => s.pests.some((p) => PEST_INFO[p.kind].boss);

/**
 * Whether the next wave can be called early: the current one has all come in but is still on the
 * path. The harvest wave can't be called early: its stars count the leaves left once its pests are
 * done. Nor can a wave while its Queen Slug walks: its boons wait to see whether she is squashed.
 */
export const canCallEarly = (s: GameState) => s.phase === 'wave' && s.queue.length === 0 && s.wave !== HARVEST_WAVE && !queenOnPath(s);

/** The wave the wave button would send next. */
export const nextWave = (s: GameState) => (s.phase === 'build' ? s.wave : s.wave + 1);

/** What regrowing a Heartwood leaf costs now. */
export const regrowPrice = (s: GameState) => regrowCost(s.regrown);

/** Whether a leaf can be regrown now: between waves, with a leaf lost and the sap for it. */
export const canRegrow = (s: GameState) => s.phase === 'build' && s.offer.length === 0 && s.heart < START.heart && s.sap >= regrowPrice(s);

/** Regrows one Heartwood leaf for `regrowPrice` sap, which then rises. */
export function regrow(s: GameState) {
  if (!canRegrow(s)) return false;
  s.sap -= regrowPrice(s);
  s.regrown++;
  s.heart++;
  return true;
}

/**
 * The row Sunny row would shine on: the one with the most grown golems (the top one of a tie), or,
 * with none grown, the one with the most golems planted (growing included); with no golem at all,
 * row 0.
 */
export function sunRow(s: GameState) {
  const rows = gardenOf(s).map.length;
  const most = (grownOnly: boolean) => {
    const counts = Array.from({ length: rows }, (_, row) => s.golems.filter((g) => g.row === row && (!grownOnly || g.growMs === 0)).length);
    const max = Math.max(...counts);
    return max > 0 ? counts.indexOf(max) : -1;
  };
  const row = most(true);
  return row >= 0 ? row : Math.max(0, most(false));
}

/** The most compost one wave can pay: COMPOST.cap, raised by each Rich compost boon. */
export const compostCap = (s: GameState) => COMPOST.cap + BOON.compostCap * boonCount(s, 'compost');

/** Takes one of the boons offered after a Queen Slug wave. */
export function takeBoon(s: GameState, boon: Boon) {
  if (!s.offer.includes(boon)) return false;
  s.boons.push(boon);
  if (boon === 'sun') s.sunRows.push(sunRow(s));
  if (boon === 'leaf') s.heart = Math.min(START.heart, s.heart + BOON.leaves);
  s.offer = [];
  return true;
}

function beginWave(s: GameState) {
  const { spawns, hpScale } = waveFor(s.wave, twistOf(s));
  s.phase = 'wave';
  s.queue = spawns;
  s.waveHpScale = hpScale;
  s.waveMs = 0;
  s.queenSquashed = false;
}

/**
 * Counts wave `n` as done: its bonus, compost on the sap unspent (from COMPOST.fromWave), a bud on
 * the Heartwood, the best, after a Queen Slug wave whose queen was squashed three boons to pick from,
 * and at HARVEST_WAVE the garden's harvest stars (and in its thorny variant, its laurel).
 */
function finishWave(s: GameState, n: number, queenSquashed: boolean) {
  s.compost = n >= COMPOST.fromWave ? Math.min(compostCap(s), Math.floor(s.sap * COMPOST.rate)) : 0;
  s.sap += waveBonus(n) + s.compost;
  s.bloom = Math.min(BLOOM_GOAL, s.bloom + 1);
  s.best = Math.max(s.best, n);
  if (n === HARVEST_WAVE) {
    s.harvest = harvestStars(s.heart);
    s.stars[s.garden] = Math.max(s.stars[s.garden], s.harvest);
    if (s.thorny) s.laurels[s.garden] = 1;
  }
  if (n % BOSS_EVERY === 0 && queenSquashed) s.offer = boonOffer(n / BOSS_EVERY, twistOf(s));
}

/**
 * The wave button: between waves it sends the next wave in. During a wave whose pests have all come
 * in, it calls the next wave early: the next wave's pests start coming while the last ones are still
 * walking, and the current wave waits in `called` until those are squashed or get through. Only then
 * is it done, with EARLY_BONUS sap on top of its bonus, so a call early still risks its last pests.
 * Returns what it did.
 */
export function startWave(s: GameState): 'start' | 'early' | null {
  if (s.phase === 'build') {
    beginWave(s);
    return 'start';
  }
  if (!canCallEarly(s)) return null;
  s.called.push({ wave: s.wave, queenSquashed: s.queenSquashed, lost: false });
  s.wave++;
  beginWave(s);
  return 'early';
}

/** Slimes the cells round (col, row), the Queen Slug's cell, afresh. */
function spreadSlime(s: GameState, col: number, row: number) {
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const c = col + dc;
      const r = row + dr;
      const cell = s.slime.find((x) => x.col === c && x.row === r);
      if (cell) cell.ms = SLIME.ms;
      else s.slime.push({ col: c, row: r, ms: SLIME.ms });
    }
  }
}

/**
 * The pest a golem throws at, by its targeting: the one furthest along its route (as a share of
 * it, since a forked garden's routes differ in length), the one with the most or the least health
 * left, or a flying pest first (then the first).
 */
function pickTarget(inReach: Pest[], target: Target, routes: Garden['routes']) {
  const first = (pests: Pest[]) => pests.reduce((a, b) => (b.dist / routes[b.route].length > a.dist / routes[a.route].length ? b : a));
  if (target === 'strongest') return inReach.reduce((a, b) => (b.hp > a.hp ? b : a));
  if (target === 'weakest') return inReach.reduce((a, b) => (b.hp < a.hp ? b : a));
  if (target === 'flyers') {
    const flyers = inReach.filter((p) => PEST_INFO[p.kind].flies);
    return first(flyers.length ? flyers : inReach);
  }
  return first(inReach);
}

/** Plays `dt` ms of game time (twice as much with the speed button on: the scene passes it in). */
export function tick(s: GameState, dt: number) {
  for (let left = dt; left > 0 && s.phase !== 'over'; left -= STEP_MS) step(s, Math.min(STEP_MS, left));
}

function step(s: GameState, dt: number) {
  const { routes } = gardenOf(s);
  for (const shot of s.shots) shot.ms -= dt;
  s.shots = s.shots.filter((shot) => shot.ms > 0);
  for (const cell of s.slime) cell.ms -= dt;
  s.slime = s.slime.filter((cell) => cell.ms > 0);

  if (s.phase === 'wave') {
    s.waveMs += dt;
    while (s.queue.length && s.queue[0].atMs <= s.waveMs) {
      const { kind } = s.queue.shift()!;
      const hp = Math.round(PEST_INFO[kind].hp * s.waveHpScale);
      const route = s.spawned++ % routes.length;
      s.pests.push({ id: s.nextId++, kind, wave: s.wave, hp, maxHp: hp, route, dist: 0, under: false, slowMs: 0, slowFactor: 1, hitMs: 0 });
    }
  }

  // Pests walk on; those reaching the Heartwood take a bite out of it and are gone. A mole is
  // underground in its tunnel; the Queen Slug slimes the cells round the one she is on. A hedge in
  // the way stops a walking pest, which chews on it until it is gone (crows fly over, a mole in its
  // tunnel passes under).
  const gone = (p: Pest) => p.dist >= routes[p.route].length;
  for (const p of s.pests) {
    const info = PEST_INFO[p.kind];
    const slowed = p.slowMs > 0 ? p.slowFactor : 1;
    const length = routes[p.route].length;
    let next = p.dist + (info.speed * slowed * dt) / 1000;
    if (!info.flies && !p.under) {
      for (const hedge of s.hedges) {
        const stop = hedge.stops[p.route];
        if (stop === null || p.dist > stop || next < stop) continue;
        next = stop;
        hedge.hp -= (info.bite * CHEW_PER_BITE * dt) / 1000;
      }
    }
    p.dist = next;
    p.slowMs = Math.max(0, p.slowMs - dt);
    p.hitMs = Math.max(0, p.hitMs - dt);
    p.under = !!info.tunnel && p.dist >= info.tunnel[0] * length && p.dist < info.tunnel[1] * length;
    if (info.slime) {
      const pos = pathPoint(routes[p.route], p.dist);
      const at = cellAt(pos.x, pos.y);
      if (at) spreadSlime(s, at.col, at.row);
    }
    if (gone(p)) {
      s.heart = Math.max(0, s.heart - info.bite);
      for (const c of s.called) c.lost = true;
      p.hp = 0;
    }
  }
  s.pests = s.pests.filter((p) => !gone(p));
  s.hedges = s.hedges.filter((h) => h.hp > 0);
  if (s.heart <= 0) {
    s.phase = 'over';
    return;
  }

  // Seeds grow; grown golems throw at the pest their targeting picks within reach, or a golem that
  // hits all (a thorn golem, a spore form) at every pest within reach.
  for (const g of s.golems) {
    if (g.growMs > 0) {
      g.growMs = Math.max(0, g.growMs - dt);
      continue;
    }
    g.cooldownMs = Math.max(0, g.cooldownMs - dt * (slimed(s, g.col, g.row) ? SLIME.slow : 1));
    if (g.cooldownMs > 0) continue;
    const stats = statsOf(s, g);
    const at = cellCentre(g.col, g.row);
    const where = (p: Pest) => pathPoint(routes[p.route], p.dist);
    const inReach = s.pests.filter((p) => {
      if (p.hp <= 0 || p.under) return false;
      const pos = where(p);
      return Math.hypot(pos.x - at.x, pos.y - at.y) <= stats.range;
    });
    if (!inReach.length) continue;
    const combo = comboAt(s, g.kind, g.col, g.row);
    const pricks = combo === 'twice' ? COMBO.thornPricks : 1;
    const targets = stats.area ? inReach : [pickTarget(inReach, g.target, routes)];
    const hit = (target: Pest, damage: number) => {
      const boost = combo === 'slowed' && target.slowMs > 0 ? COMBO.slowedDamage : 1;
      const armour = stats.pierce ? 0 : (PEST_INFO[target.kind].armour ?? 0);
      target.hp -= pricks * Math.max(1, damage * boost - armour);
      target.hitMs = HIT_MS;
      // A weaker slow never undoes a stronger one still running; an equal one tops it up.
      if (stats.slow) {
        const current = target.slowMs > 0 ? target.slowFactor : 1;
        if (stats.slow.factor < current) {
          target.slowMs = stats.slow.ms;
          target.slowFactor = stats.slow.factor;
        } else if (stats.slow.factor === current) {
          target.slowMs = Math.max(target.slowMs, stats.slow.ms);
        }
      }
    };
    for (const target of targets) {
      hit(target, stats.damage);
      const to = where(target);
      if (stats.splash) {
        // Splash lands on every pest near the target, in the golem's reach or not.
        for (const other of s.pests) {
          if (other === target || other.hp <= 0 || other.under) continue;
          const pos = where(other);
          if (Math.hypot(pos.x - to.x, pos.y - to.y) <= stats.splash) hit(other, stats.damage / 2);
        }
      }
      for (let k = 0; k < pricks; k++) {
        s.shots.push({ id: s.nextId++, kind: g.kind, from: { x: at.x, y: at.y - 14 }, to: { x: to.x, y: to.y }, ms: SHOT_MS + k * SHOT_MS * 0.5 });
      }
    }
    g.cooldownMs = stats.cooldownMs;
  }

  // Squashed pests drop their sap.
  for (const p of s.pests) {
    if (p.hp > 0) continue;
    const bounty = PEST_INFO[p.kind].bounty;
    s.sap += bounty;
    s.kills++;
    if (PEST_INFO[p.kind].boss) s.queenSquashed = true;
    const at = pathPoint(routes[p.route], p.dist);
    s.pops.push({ x: at.x, y: at.y, sap: bounty });
  }
  s.pests = s.pests.filter((p) => p.hp > 0);

  // A wave called early is done once its last pests are gone, oldest first.
  while (s.called.length && !s.pests.some((p) => p.wave === s.called[0].wave)) {
    const done = s.called.shift()!;
    finishWave(s, done.wave, done.queenSquashed);
    s.sap += EARLY_BONUS;
    s.settled.push({ wave: done.wave, clean: !done.lost });
  }
  if (s.phase === 'wave' && !s.queue.length && !s.pests.length) {
    finishWave(s, s.wave, s.queenSquashed);
    s.wave++;
    s.phase = 'build';
  }
}
