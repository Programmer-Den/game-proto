import { DIRS, distances, nextStep, route, UNREACHABLE } from './grid';
import { cellIndex, cellOf, inGrid, MAPS, type MapDef } from './maps';
import {
  AIMS, attacks, BIG, CABBAGE, RUSH, CHEW_GAIN, EMPRESS, HEAT, KING, KING_TRICKS, RUSH_KINDS, shellFactor, CHEW_TIME, COLS, EARLY_BONUS, FINAL_QUEEN, FOE, GROUP_GAP, HP_PER_WAVE, hpScale, MAX_LEVEL, ROWS,
  GROW_RATE, SEEDS, SANDBOX_GOLD, STARS, SWARM_GOLD, waveGroups, type Mode, TRAP, type TrapKind, MASTER, MASTER_TRICKS, tier, GATE_WAVES, BANK_REACH, WEATHER, DUO_TOUGHNESS, SELL_BACK, WAVE_TIMER, SHOT_SPEED, SPREAD, START_GOLD, startLives, TOWER, upgradeCost, WAVES, waveReward,
  type Aim, type DamageKind, type FoeKind, type ShellKind, type ShotKind, type TowerKind,
} from './rules';

// A game of Mazewright, with no Phaser: the grid, the towers, the foes, the shots and the waves.
// The scene calls the actions (`build`, `upgrade`, `sell`, `startWave`) and `step` with fixed
// time steps, and drains `events` for sound and effects. Positions are in cells: (0.5, 0.5) is
// the middle of the top-left cell.

export interface Tower {
  id: number;
  kind: TowerKind;
  cell: number;
  level: number;
  /** Gold paid for it and its upgrades, for selling. */
  spent: number;
  /** Gold paid for it and its upgrades in this break between waves, which selling gives back in full until the next wave starts. */
  fresh: number;
  /** Seconds until it can fire again. */
  cooldown: number;
  /** Which way it last aimed, in radians, for drawing. */
  aim: number;
  /** Bonfire and sunglass: the way it points, an index into `DIRS`. */
  face: number;
  /** Whirligig: how far it has spun up (0 to 1), and the seconds since its last shot. */
  spin: number;
  idle: number;
  /** How it picks a target (`AIMS`). */
  target: Aim;
  /** Seconds it still grows (built or upgraded), out of `growFull`; it doesn't fire while it grows. */
  grow: number;
  growFull: number;
  /** Season weather: when it last fired, the seconds it has fired nonstop, and wilted or frozen (not firing) until these times. */
  lastShot: number;
  busy: number;
  wiltUntil: number;
  frozenUntil: number;
}

export interface Foe {
  id: number;
  kind: FoeKind;
  hp: number;
  maxHp: number;
  /** The burrow it came out of (an index into `Game.gates`). */
  gate: number;
  /** Its position, in cells. */
  x: number;
  y: number;
  /** On the ground: the cell it left, the cell it is walking to and how far along (0 to 1). */
  from: number;
  to: number;
  t: number;
  /** The direction it last stepped in (an index into `DIRS`). */
  heading: number;
  /** Which way it faces, in radians, for drawing. */
  angle: number;
  /** Chilled by frost until this time, walking at `slowFactor` of its speed. */
  slowUntil: number;
  slowFactor: number;
  /** Set alight by a bonfire, or poisoned by a puffball, until these times, taking this much a second. */
  burnUntil: number;
  burnDps: number;
  poisonUntil: number;
  poisonDps: number;
  /** The honey pot drawing it in, by id, or 0. */
  lure: number;
  /** Stung still by a nettle (or a master frost) until this time; shrunk by a toadstool ring. */
  stunUntil: number;
  shrunk: boolean;
  /** Puffball poison spreads to foes walking close; spores caught that way spread no further. */
  spreads: boolean;
  spreadAt: number;
  /** Sunglass and bonfire heat, 0 to 1; a fully heated foe takes double heat damage. */
  heat: number;
  /** Set alight by a master bonfire, whose blue flame burns through shells. */
  blueFlame: boolean;
  /** A mole chewing a hedge: the hedge's cell and the seconds left. */
  chew: { cell: number; left: number } | null;
  /** Hedges a mole may still chew: one, or three for a king. */
  chews: number;
  /** A crowned king, and a bigger beetle's size (1, 2 or 3). */
  king: boolean;
  big: 1 | 2 | 3;
  /** Its body's radius in cells. */
  body: number;
  /** Gold when beaten and lives when it gets in. */
  gold: number;
  lives: number;
  /** Woodlice it splits into when beaten. */
  splits: number;
  /** Its shell now: its kind's, or the Empress's latest. */
  shell: ShellKind | undefined;
  /** Cabbages it carries off; once it has some (or found the patch empty) it walks home to its burrow. */
  carry: number;
  home: boolean;
  /** The Empress: when she next lays a beetle and turns her shell, and the damage she took since. */
  empress: { eggAt: number; turnAt: number; taken: Partial<Record<DamageKind, number>> } | null;
  dead: boolean;
}

/** A garden trap on the lawn. A honey pot, once sprung, lures foes along `field` until `until`. */
export interface Trap {
  id: number;
  kind: TrapKind;
  cell: number;
  sprung: boolean;
  until: number;
  field: Int16Array | null;
}

/** Cabbages dropped by a beaten foe, rolling back to the patch until a foe picks them up. */
export interface Loose {
  id: number;
  n: number;
  x: number;
  y: number;
  /** On the ground like a foe: the cell it left, the cell it rolls to and how far along. In the air (off a moth) `from` is -1 and it rolls straight. */
  from: number;
  to: number;
  t: number;
}

export interface Shot {
  kind: ShotKind;
  x: number;
  y: number;
  target: number;
  /** Where the target was last seen, so a shot whose target died still lands. */
  tx: number;
  ty: number;
  damage: number;
  splash: number;
  hits: DamageKind;
  /** A master crossbow's bolt goes through shells; a master cannon's ball knocks foes back. */
  pierce?: boolean;
  knock?: boolean;
}

export type GameEvent =
  | { type: 'built'; kind: TowerKind; cell: number; gold: number }
  | { type: 'refused'; cell: number; reason: Refusal }
  | { type: 'upgraded'; cell: number; gold: number }
  | { type: 'sold'; cell: number; gold: number }
  | { type: 'shot'; kind: TowerKind }
  | { type: 'bolt'; points: { x: number; y: number }[] }
  | { type: 'flame'; x: number; y: number; angle: number; r: number; cone: number }
  | { type: 'beam'; x: number; y: number; x2: number; y2: number }
  | { type: 'puff'; x: number; y: number }
  | { type: 'apples'; cell: number; gold: number }
  | { type: 'pulse'; x: number; y: number; r: number }
  | { type: 'sting'; x: number; y: number; r: number }
  | { type: 'shrink'; x: number; y: number }
  | { type: 'lured'; x: number; y: number }
  | { type: 'burst'; x: number; y: number; r: number }
  | { type: 'snared'; x: number; y: number }
  | { type: 'boom'; x: number; y: number; r: number }
  | { type: 'hit'; x: number; y: number }
  | { type: 'kill'; kind: FoeKind; x: number; y: number; gold: number }
  | { type: 'grab'; kind: FoeKind; n: number }
  | { type: 'leak'; kind: FoeKind; lives: number }
  | { type: 'drop'; x: number; y: number; n: number }
  | { type: 'pickup'; x: number; y: number }
  | { type: 'saved'; n: number }
  | { type: 'chewing'; cell: number }
  | { type: 'chewed'; cell: number }
  | { type: 'king'; kind: FoeKind }
  | { type: 'rush' }
  | { type: 'split'; x: number; y: number }
  | { type: 'egg'; x: number; y: number }
  | { type: 'shell'; shell: ShellKind }
  | { type: 'wilt'; cell: number }
  | { type: 'frozen'; cell: number }
  | { type: 'wave'; wave: number; early: boolean }
  | { type: 'cleared'; wave: number; gold: number }
  | { type: 'won' }
  | { type: 'lost' };

/** Why a tile can't be built on. */
export type Refusal = 'blocks' | 'gold' | 'foe' | 'taken' | 'reserved';

export type Phase = 'build' | 'wave' | 'won' | 'lost';

/** A foe still to come out of a burrow. */
export interface Spawn {
  kind: FoeKind;
  gate: number;
  at: number;
  wave: number;
  big?: 2 | 3;
  king?: boolean;
  /** The first king of the last wave's rush. */
  rush?: boolean;
}

export interface Game {
  map: MapDef;
  phase: Phase;
  /** The wave in play or last played, from 1; 0 before the first. */
  wave: number;
  /** The last wave whose reward has been paid. */
  paid: number;
  /** The gold of the (left-hand) gardener, and with two gardeners the right-hand one's (`gold2`). */
  gold: number;
  gold2: number;
  /** Two gardeners, each building on their half of the lawn (`sideOf`) with their own gold. */
  duo: boolean;
  /** Cabbages in the patch by the cottage (the lives), and how many it started with. */
  lives: number;
  maxLives: number;
  /** Cabbages lying loose on the lawn. */
  loose: Loose[];
  /** Garden traps waiting on the lawn, or sprung. */
  traps: Trap[];
  /**
   * Per cell: 0 free (in a path garden, the path), 1 a rock, 2 a tower, 3 water, 4 a path garden's
   * lawn (walkers keep off it, towers go on it). `ground` is the same without the towers.
   */
  blocked: Uint8Array;
  ground: Uint8Array;
  /** Per cell: 1 on a raised bank. */
  banks: Uint8Array;
  towers: Tower[];
  /** The steps from every cell to the cottage, and to each burrow for foes carrying cabbages home. */
  dist: Int16Array;
  homeDist: Int16Array[];
  gates: number[];
  goal: number;
  foes: Foe[];
  shots: Shot[];
  /** Foes still to come out, by the time they do. */
  spawns: Spawn[];
  /** The way the garden is played (`MODES`). */
  mode: Mode;
  /** The towers whose master level has been bought in the potting shed; null for all of them. */
  masters: readonly TowerKind[] | null;
  /** Calm: waves come only when started. Otherwise, after wave 1, the next comes by itself at `nextAt`. */
  calm: boolean;
  nextAt: number | null;
  /** Winter: when frost next freezes a tower, while a wave is in play. */
  frostAt: number | null;
  /** The seed of its random numbers and their state now, and the foes' health scale (the difficulty). */
  seed: number;
  rng: number;
  toughness: number;
  /** Fixed steps played, and the player's actions so far, for a replay. */
  steps: number;
  log: Action[];
  /** Seconds of play so far. */
  clock: number;
  kills: number;
  leaks: number;
  /** How many placements were refused, for the test. */
  refusals: number;
  events: GameEvent[];
  nextId: number;
}

/** `blocked` values: water, and a path garden's lawn. */
const WATER = 3;
export const LAWN = 4;

/** A player's action, at the step it was taken: what a replay plays back. */
export interface Action {
  /** Steps of play before it (`Game.steps`). */
  s: number;
  a: 'build' | 'upgrade' | 'sell' | 'turn' | 'aim' | 'wave';
  c?: number;
  k?: TowerKind;
}

/** What makes a game play the same again: the numbers drawn at its start. */
export interface Fixed {
  seed: number;
  toughness: number;
  lives: number;
}

/**
 * The version of the rules a replay was played under. Raise it with any change that makes the same
 * actions play out differently (a tower's, foe's or wave's numbers, a new rule): replays of another
 * version are dropped when they load, since they would no longer play out as they did.
 */
export const REPLAY_VERSION = 5;

/** A game kept to watch again: how it began, and every action taken in it. */
export interface Replay extends Fixed {
  /** The rules version it was played under (`REPLAY_VERSION`). */
  v: number;
  map: string;
  calm: boolean;
  duo?: boolean;
  mode: Mode;
  masters: TowerKind[] | null;
  log: Action[];
  /** Steps it lasted, and its stars and time. */
  steps: number;
  stars: number;
  time: number;
}

/** A small seeded random number generator (mulberry32), so a replay draws the same numbers. */
function rand(g: Game) {
  let t = (g.rng = (g.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const note = (g: Game, a: Action['a'], c?: number, k?: TowerKind) => g.log.push(k ? { s: g.steps, a, c, k } : c === undefined ? { s: g.steps, a } : { s: g.steps, a, c });

export function newGame(mapId: string, calm = false, mode: Mode = 'classic', masters: readonly TowerKind[] | null = null, fixed?: Fixed, duo = false): Game {
  const map = MAPS.find((m) => m.id === mapId) ?? MAPS[0];
  const blocked = new Uint8Array(COLS * ROWS);
  const goal = cellIndex(map.goal);
  const gates = map.gates.map(cellIndex);
  if (map.path) {
    blocked.fill(LAWN);
    for (const c of [...map.path, map.goal, ...map.gates]) blocked[cellIndex(c)] = 0;
  }
  for (const rock of map.rocks) blocked[cellIndex(rock)] = 1;
  for (const pond of map.ponds ?? []) blocked[cellIndex(pond)] = WATER;
  const banks = new Uint8Array(COLS * ROWS);
  for (const bank of map.banks ?? []) banks[cellIndex(bank)] = 1;
  const lives = fixed?.lives ?? map.lives ?? startLives();
  const seed = fixed?.seed ?? Math.floor(Math.random() * 4294967296);
  return {
    map,
    phase: 'build',
    wave: 0,
    paid: 0,
    gold: mode === 'sandbox' ? SANDBOX_GOLD : (map.gold ?? START_GOLD),
    gold2: !duo ? 0 : mode === 'sandbox' ? SANDBOX_GOLD : (map.gold ?? START_GOLD),
    duo,
    lives,
    maxLives: lives,
    loose: [],
    traps: [],
    blocked,
    ground: blocked.slice(),
    banks,
    towers: [],
    dist: distances(blocked, goal),
    homeDist: gates.map((gate) => distances(blocked, gate)),
    gates,
    goal,
    foes: [],
    shots: [],
    spawns: [],
    mode,
    masters,
    calm,
    nextAt: null,
    frostAt: null,
    seed,
    rng: seed,
    toughness: fixed?.toughness ?? hpScale() * (duo ? DUO_TOUGHNESS : 1),
    steps: 0,
    log: [],
    clock: 0,
    kills: 0,
    leaks: 0,
    refusals: 0,
    events: [],
    nextId: 1,
  };
}

export const towerAt = (g: Game, cell: number) => g.towers.find((t) => t.cell === cell);
const centre = (cell: number) => {
  const [x, y] = cellOf(cell);
  return { x: x + 0.5, y: y + 0.5 };
};
const over = (g: Game) => g.phase === 'won' || g.phase === 'lost';

/** Whose half of the lawn a cell is on: 0 the left (or the only gardener), 1 the right. */
export const sideOf = (g: Game, cell: number) => (g.duo && cell % COLS >= COLS / 2 ? 1 : 0);
/** The gold of the gardener whose half `cell` is on. */
export const goldAt = (g: Game, cell: number) => (sideOf(g, cell) ? g.gold2 : g.gold);
function addGold(g: Game, side: number, gold: number) {
  if (side) g.gold2 += gold;
  else g.gold += gold;
}
/** Pays both gardeners: half each, the odd coin to the poorer one. */
function share(g: Game, gold: number) {
  if (!g.duo) return void (g.gold += gold);
  const half = Math.floor(gold / 2);
  const odd = gold - 2 * half;
  const left = g.gold <= g.gold2;
  g.gold += half + (left ? odd : 0);
  g.gold2 += half + (left ? 0 : odd);
}

/** Makes the walking fields again after a cell was blocked or freed. */
function refield(g: Game) {
  g.dist = distances(g.blocked, g.goal);
  g.homeDist = g.gates.map((gate) => distances(g.blocked, gate));
  for (const trap of g.traps) if (trap.field) trap.field = distances(g.blocked, trap.cell);
}

/** All the cabbages still in the game: in the patch, carried and loose. */
export const cabbagesLeft = (g: Game) => g.lives + g.foes.reduce((n, f) => n + (f.dead ? 0 : f.carry), 0) + g.loose.reduce((n, c) => n + c.n, 0);

/** Whether a field leaves every burrow, every foe on the ground and every cabbage rolling on it a way to the cottage. */
function open(g: Game, dist: Int16Array) {
  if (g.gates.some((gate) => dist[gate] === UNREACHABLE)) return false;
  if (!g.foes.every((f) => f.dead || FOE[f.kind].flies || dist[f.to] !== UNREACHABLE)) return false;
  // A loose cabbage walled in would never roll home, and still count as kept.
  return g.loose.every((c) => c.from < 0 || dist[c.to] !== UNREACHABLE);
}

/** Whether a `kind` tower can go on `cell` right now, and if not why. */
export function canBuild(g: Game, cell: number, kind: TowerKind): Refusal | null {
  if (cell === g.goal || g.gates.includes(cell)) return 'reserved';
  if (g.traps.some((t) => t.cell === cell)) return 'taken';
  // A trap never blocks, so it may go under foes and needs no way kept open, but only where foes walk.
  if (TOWER[kind].trap) return g.blocked[cell] ? 'taken' : goldAt(g, cell) < TOWER[kind].cost ? 'gold' : null;
  // A tower may take a hedge's place, for its cost less what the hedge sells for; the cell stays a wall.
  const hedge = hedgeUnder(g, cell, kind);
  if (hedge) return goldAt(g, cell) < costOn(g, cell, kind) ? 'gold' : null;
  // A path garden's lawn is off the way already, and its path is kept for the foes.
  if (g.blocked[cell] === LAWN) return goldAt(g, cell) < TOWER[kind].cost ? 'gold' : null;
  if (g.blocked[cell]) return 'taken';
  if (g.map.path) return 'reserved';
  if (g.foes.some((f) => !f.dead && !FOE[f.kind].flies && (f.from === cell || f.to === cell))) return 'foe';
  if (g.loose.some((c) => c.from === cell || c.to === cell)) return 'foe';
  if (wouldBlock(g, cell)) return 'blocks';
  if (goldAt(g, cell) < TOWER[kind].cost) return 'gold';
  return null;
}

/** The hedge a `kind` tower would take the place of on `cell`, if any. */
export function hedgeUnder(g: Game, cell: number, kind: TowerKind) {
  if (kind === 'hedge' || TOWER[kind].trap) return undefined;
  const tower = towerAt(g, cell);
  return tower?.kind === 'hedge' ? tower : undefined;
}

/** What planting a `kind` tower on `cell` costs: less the hedge's sell value when it takes a hedge's place. */
export function costOn(g: Game, cell: number, kind: TowerKind) {
  const hedge = hedgeUnder(g, cell, kind);
  return TOWER[kind].cost - (hedge ? sellValue(hedge) : 0);
}

/** Whether blocking `cell` would cut every way from a burrow, a foe or a loose cabbage to the cottage. */
export function wouldBlock(g: Game, cell: number) {
  if (g.blocked[cell]) return false;
  const blocked = g.blocked.slice();
  blocked[cell] = 2;
  return !open(g, distances(blocked, g.goal));
}

export function build(g: Game, cell: number, kind: TowerKind): Refusal | null {
  if (over(g)) return 'taken';
  const refusal = canBuild(g, cell, kind);
  if (refusal) {
    if (refusal !== 'taken') g.refusals++;
    g.events.push({ type: 'refused', cell, reason: refusal });
    return refusal;
  }
  const hedge = hedgeUnder(g, cell, kind);
  const cost = costOn(g, cell, kind);
  addGold(g, sideOf(g, cell), -cost);
  // The hedge makes way; the cell stays blocked, so the routes don't change.
  if (hedge) {
    g.towers.splice(g.towers.indexOf(hedge), 1);
    // A mole at it finds a tower now, which it can't chew.
    for (const f of g.foes) if (f.chew?.cell === cell) f.chew = null;
  }
  if (TOWER[kind].trap) {
    g.traps.push({ id: g.nextId++, kind: kind as TrapKind, cell, sprung: false, until: 0, field: null });
    g.events.push({ type: 'built', kind, cell, gold: cost });
    note(g, 'build', cell, kind);
    return null;
  }
  const face = TOWER[kind].faces ? bestFace(g, cell, kind) : 0;
  g.towers.push({ id: g.nextId++, kind, cell, level: 1, spent: TOWER[kind].cost, fresh: g.phase === 'build' ? TOWER[kind].cost : 0, cooldown: 0, aim: Math.atan2(DIRS[face][1], DIRS[face][0]), face, spin: 0, idle: 0, target: TOWER[kind].aim ?? 'first', grow: 0, growFull: 0, lastShot: -Infinity, busy: 0, wiltUntil: 0, frozenUntil: 0 });
  growFor(g.towers[g.towers.length - 1], TOWER[kind].cost, g);
  g.blocked[cell] = 2;
  refield(g);
  g.events.push({ type: 'built', kind, cell, gold: cost });
  note(g, 'build', cell, kind);
  return null;
}

/** A tower starts growing for what it cost. */
function growFor(tower: Tower, cost: number, g: Game) {
  tower.grow = tower.growFull = g.mode === 'sandbox' ? 0 : cost / GROW_RATE;
}

/** The route cells foes walk now, from every burrow. */
function routeCells(g: Game) {
  return new Set(g.gates.flatMap((gate) => route(g.dist, gate)));
}

/** The cells a sunglass on `cell` facing `face` shines over: up to the first rock or tower (it crosses water). */
export function beamCells(g: Game, cell: number, face: number) {
  const cells: number[] = [];
  let [x, y] = cellOf(cell);
  const [dx, dy] = DIRS[face];
  const stops = (v: number) => v === 1 || v === 2;
  for (x += dx, y += dy; inGrid(x, y) && !stops(g.blocked[y * COLS + x]); x += dx, y += dy) cells.push(y * COLS + x);
  return cells;
}

/** How far a `kind` tower on `cell` reaches: further on a raised bank. */
export const reachOf = (g: Game, cell: number, kind: TowerKind) => TOWER[kind].range * (g.banks[cell] ? BANK_REACH : 1);

/** Whether a point (in cells) is in a bonfire's cone from `cell` facing `face`, `range` long, within `extra` of its reach. */
export function inCone(cell: number, face: number, px: number, py: number, extra = 0, range = TOWER.bonfire.range) {
  const { x, y } = centre(cell);
  const d = Math.hypot(px - x, py - y);
  if (d > range + extra || d < 0.01) return false;
  const off = Math.atan2(py - y, px - x) - Math.atan2(DIRS[face][1], DIRS[face][0]);
  return Math.abs(Math.atan2(Math.sin(off), Math.cos(off))) <= TOWER.bonfire.cone!;
}

/** The way a new bonfire or sunglass first points: where it covers the most of today's route. */
export function bestFace(g: Game, cell: number, kind: TowerKind) {
  const path = routeCells(g);
  let best = 0;
  let most = -1;
  DIRS.forEach((_, face) => {
    let n = 0;
    if (kind === 'sunglass') for (const c of beamCells(g, cell, face)) n += path.has(c) ? 1 : 0;
    else for (const c of path) {
      const m = centre(c);
      if (inCone(cell, face, m.x, m.y)) n++;
    }
    if (n > most) (most = n), (best = face);
  });
  return best;
}

/** Moves a tower's aim on to the next way of picking a target. */
export function setAim(g: Game, cell: number) {
  const tower = towerAt(g, cell);
  if (!tower || over(g)) return false;
  tower.target = AIMS[(AIMS.indexOf(tower.target) + 1) % AIMS.length];
  note(g, 'aim', cell);
  return true;
}

/** Turns a bonfire or sunglass a quarter round, clockwise. */
export function turn(g: Game, cell: number) {
  const tower = towerAt(g, cell);
  if (!tower || !TOWER[tower.kind].faces || over(g)) return false;
  tower.face = [1, 3, 0, 2][tower.face];
  tower.aim = Math.atan2(DIRS[tower.face][1], DIRS[tower.face][0]);
  note(g, 'turn', cell);
  return true;
}

/** The gold an upgrade of `tower` costs, or null when it can't go higher (the master level waits for the potting shed). */
export function nextUpgrade(tower: Tower, g?: Game) {
  if (tower.kind === 'hedge' || tower.level >= MAX_LEVEL || TOWER[tower.kind].trap) return null;
  if (tower.level === MASTER - 1 && !masterOpen(g, tower.kind)) return null;
  return upgradeCost(tower.kind, tower.level);
}

/** Whether a kind's master level has been bought. */
export const masterOpen = (g: Game | undefined, kind: TowerKind) => !g?.masters || g.masters.includes(kind);

/** Seeds a finished game pays, by its result; none in Sandbox. */
export function seedsFor(g: Game) {
  if (g.mode === 'sandbox') return 0;
  if (g.phase === 'won') return SEEDS.win + SEEDS.star * stars(g) + (g.mode === 'challenge' ? SEEDS.challenge : 0);
  return SEEDS.loss + Math.floor(Math.max(0, g.wave - 1) / SEEDS.waves);
}

export function upgrade(g: Game, cell: number) {
  const tower = towerAt(g, cell);
  const cost = tower && nextUpgrade(tower, g);
  if (!tower || cost === null || cost === undefined || goldAt(g, cell) < cost || over(g)) return false;
  addGold(g, sideOf(g, cell), -cost);
  tower.spent += cost;
  if (g.phase === 'build') tower.fresh += cost;
  tower.level++;
  growFor(tower, cost, g);
  g.events.push({ type: 'upgraded', cell, gold: cost });
  note(g, 'upgrade', cell);
  return true;
}

/**
 * What selling gives back: 70% of what the tower cost, but all of what was paid for it in this break
 * between waves, and all of what its growth still under way cost (the whole price of a tower still growing).
 */
export function sellValue(tower: Tower) {
  const growing = tower.grow > 0 ? Math.round(tower.growFull * GROW_RATE) : 0;
  // The growth under way is the last buy, so it is either part of this break's buys or came after them in a wave.
  const full = Math.max(tower.fresh, growing);
  return full + Math.floor((tower.spent - full) * SELL_BACK);
}

/** Sells a tower; freeing a cell never closes a route, so it is always allowed. */
export function sell(g: Game, cell: number) {
  const tower = towerAt(g, cell);
  if (!tower || over(g)) return false;
  const gold = sellValue(tower);
  addGold(g, sideOf(g, cell), gold);
  removeTower(g, tower);
  g.events.push({ type: 'sold', cell, gold });
  note(g, 'sell', cell);
  return true;
}

function removeTower(g: Game, tower: Tower) {
  g.towers.splice(g.towers.indexOf(tower), 1);
  g.blocked[tower.cell] = g.ground[tower.cell];
  refield(g);
}

/** Whether the next wave can be started: between waves, or once the wave in play is all out. */
export const canStartWave = (g: Game) => !over(g) && g.wave < totalWaves(g) && g.spawns.length === 0;

/** How many waves the game has: 20, or no end in Endless and Sandbox. */
export const totalWaves = (g: Game) => (g.mode === 'endless' || g.mode === 'sandbox' ? Infinity : WAVES.length);

/** Gold paid for beating foes and holding waves: more in Swarm. */
const pay = (g: Game, gold: number) => (g.mode === 'swarm' ? Math.round(gold * SWARM_GOLD) : gold);

/** Stars for a won game: by cabbages kept, and a fourth for a Swarm won without losing one. */
export function stars(g: Game) {
  if (g.phase !== 'won') return 0;
  const kept = cabbagesLeft(g);
  if (g.mode === 'swarm' && kept >= g.maxLives) return 4;
  return kept >= g.maxLives * STARS.three ? 3 : kept >= g.maxLives * STARS.two ? 2 : 1;
}

/** Starts the next wave by the player's hand; called while foes are still out, it pays a small bonus. */
export function startWave(g: Game) {
  if (!beginWave(g, true)) return false;
  note(g, 'wave');
  return true;
}

/** Starts the next wave, by hand or by the wave timer; only a wave sent early by hand pays the bonus. */
function beginWave(g: Game, byHand = false) {
  if (!canStartWave(g)) return false;
  const early = byHand && g.foes.length > 0;
  if (early) share(g, EARLY_BONUS);
  g.nextAt = null;
  g.wave++;
  g.phase = 'wave';
  // What was planted in the break is the maze now: it sells for 70% from here on.
  for (const tower of g.towers) tower.fresh = 0;
  let at = g.clock + 0.5;
  let turn = 0;
  const open = openGates(g);
  const gateFor = () => turn++ % open;
  for (const [kind, count, opts] of waveGroups(g.wave)) {
    for (let i = 0; i < count; i++) {
      g.spawns.push({ kind, gate: gateFor(), at, wave: g.wave, big: opts?.size, king: opts?.king });
      at += FOE[kind].gap * (opts?.king ? 2 : 1);
    }
    at += GROUP_GAP - FOE[kind].gap;
  }
  if (g.wave === WAVES.length) {
    // The rush: one king of every kind, a while after the queen is out.
    at += RUSH.delay;
    RUSH_KINDS.forEach((kind, i) => {
      g.spawns.push({ kind, gate: gateFor(), at, wave: g.wave, king: true, rush: i === 0 });
      at += RUSH.gap;
    });
  }
  g.events.push({ type: 'wave', wave: g.wave, early });
  return true;
}

/** How many of the garden's burrows are open in the wave in play (they open in order). */
export const openGates = (g: Game) => Math.max(1, GATE_WAVES.slice(0, g.gates.length).filter((w) => g.wave >= w).length);

function spawn(g: Game, sp: Spawn) {
  const { kind, wave } = sp;
  const def = FOE[kind];
  const plain = { hp: 1, gold: 1, lives: 1, body: 1 };
  const sized = sp.big ? BIG[sp.big] : plain;
  const king = sp.king ? KING : plain;
  const empress = kind === 'queen' && wave === WAVES.length;
  const hp = Math.round(def.hp * (1 + HP_PER_WAVE * (wave - 1)) * g.toughness * (empress ? FINAL_QUEEN : 1) * sized.hp * king.hp);
  const cell = g.gates[sp.gate];
  const { x, y } = centre(cell);
  const f = makeFoe(g, kind, hp, sp.gate, x, y, cell);
  f.king = !!sp.king;
  f.big = sp.big ?? 1;
  f.body = def.size * sized.body * king.body;
  f.gold = def.gold * sized.gold * king.gold;
  f.lives = def.lives * sized.lives * king.lives;
  if (f.king) {
    f.chews = def.digs ? KING_TRICKS.chews : 0;
    f.splits = def.splits ? KING_TRICKS.splits : 0;
    g.events.push({ type: 'king', kind });
  }
  if (empress) f.empress = { eggAt: g.clock + EMPRESS.egg, turnAt: g.clock + EMPRESS.turn, taken: {} };
  if (sp.rush) g.events.push({ type: 'rush' });
}

/** A new foe of `kind` with `hp` at a point, standing on `cell`. */
function makeFoe(g: Game, kind: FoeKind, hp: number, gate: number, x: number, y: number, cell: number): Foe {
  const def = FOE[kind];
  const f: Foe = {
    id: g.nextId++, kind, hp, maxHp: hp, gate, x, y, from: cell, to: cell, t: 1, heading: 0, angle: 0,
    slowUntil: 0, slowFactor: 1, lure: 0, stunUntil: 0, shrunk: false, blueFlame: false, burnUntil: 0, burnDps: 0, poisonUntil: 0, poisonDps: 0, spreads: false, spreadAt: 0, heat: 0,
    chew: null, chews: def.digs ? 1 : 0, king: false, big: 1, body: def.size, gold: def.gold, lives: def.lives,
    splits: def.splits ?? 0, shell: def.shell, carry: 0, home: false, empress: null, dead: false,
  };
  g.foes.push(f);
  return f;
}

/** A foe born from another (a split woodlouse, an egg, a king moth's moths), walking on from where it was. */
function offspring(g: Game, parent: Foe, kind: FoeKind, hp: number, lag: number) {
  const f = makeFoe(g, kind, hp, parent.gate, parent.x, parent.y, parent.from);
  if (!FOE[kind].flies && !FOE[parent.kind].flies) {
    f.from = parent.from;
    f.to = parent.to;
    f.t = Math.max(0, parent.t - lag);
    f.heading = parent.heading;
  } else if (!FOE[kind].flies) {
    // Off a flier, onto the cell under it.
    const cell = Math.floor(parent.y) * COLS + Math.floor(parent.x);
    f.from = f.to = g.blocked[cell] ? parent.from : cell;
  }
  f.angle = parent.angle;
  return f;
}

/** How far a foe still has to go, in cells: what towers aim by (the closest to the cottage first). */
export function remaining(g: Game, f: Foe) {
  if (f.home) {
    // On its way out, a foe is as close as its way home is short.
    if (FOE[f.kind].flies) {
      const gate = centre(g.gates[f.gate]);
      return Math.hypot(gate.x - f.x, gate.y - f.y);
    }
    return g.homeDist[f.gate][f.to] + (1 - f.t);
  }
  if (FOE[f.kind].flies) {
    const goal = centre(g.goal);
    return Math.hypot(goal.x - f.x, goal.y - f.y);
  }
  if (f.chew) return g.dist[f.from];
  return g.dist[f.to] + (1 - f.t);
}

/** A hedge next to `from` whose removal would save a mole at least `CHEW_GAIN` steps, or -1. */
function hedgeToChew(g: Game, from: number) {
  const here = g.dist[from];
  const [x, y] = cellOf(from);
  let best = -1;
  let bestGain = CHEW_GAIN - 1;
  for (const [dx, dy] of [[1, 0], [0, 1], [0, -1], [-1, 0]]) {
    const hx = x + dx;
    const hy = y + dy;
    if (hx < 0 || hy < 0 || hx >= COLS || hy >= ROWS) continue;
    const hedge = hy * COLS + hx;
    if (towerAt(g, hedge)?.kind !== 'hedge') continue;
    // The best cell past the hedge, two steps from here.
    for (const [ex, ey] of [[1, 0], [0, 1], [0, -1], [-1, 0]]) {
      const nx = hx + ex;
      const ny = hy + ey;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) continue;
      const past = g.dist[ny * COLS + nx];
      if (past === UNREACHABLE) continue;
      const gain = here - (past + 2);
      if (gain > bestGain) (bestGain = gain), (best = hedge);
    }
  }
  return best;
}

/** Takes `damage` of a kind off a foe: its shell lets some of it through, and heat doubles on a glowing foe. */
function hurt(g: Game, f: Foe, damage: number, kind: DamageKind, pierce = false) {
  if (f.dead) return;
  let dealt = damage * (pierce ? 1 : shellFactor(f.shell, kind));
  if (kind === 'heat' && f.heat >= 1) dealt *= HEAT.boost;
  f.hp -= dealt;
  if (f.empress) f.empress.taken[kind] = (f.empress.taken[kind] ?? 0) + dealt;
  if (f.hp > 0) return;
  f.dead = true;
  // With two gardeners, a foe pays the one on whose half it was beaten.
  const gold = pay(g, f.gold);
  addGold(g, g.duo && f.x >= COLS / 2 ? 1 : 0, gold);
  g.kills++;
  g.events.push({ type: 'kill', kind: f.kind, x: f.x, y: f.y, gold });
  if (f.carry > 0) drop(g, f);
  if (f.splits > 0) {
    // A woodlouse falls apart into smaller ones, which split no further.
    for (let i = 0; i < f.splits; i++) {
      const child = offspring(g, f, 'woodlouse', Math.round(f.maxHp * (f.king ? 0.2 : 0.35)), i * 0.3);
      child.body = FOE.woodlouse.size * 0.65;
      child.gold = 1;
      child.splits = 0;
    }
    g.events.push({ type: 'split', x: f.x, y: f.y });
  }
  if (f.king && f.kind === 'moth') {
    const hp = Math.round(FOE.moth.hp * (1 + HP_PER_WAVE * (g.wave - 1)) * g.toughness);
    for (let i = 0; i < KING_TRICKS.moths; i++) offspring(g, f, 'moth', hp, 0);
  }
}

function moveFoe(g: Game, f: Foe, dt: number) {
  const def = FOE[f.kind];
  const speed = def.speed * (f.king ? KING.speed : 1) * (g.clock < f.slowUntil ? f.slowFactor : 1);
  if (def.flies) {
    const goal = centre(f.home ? g.gates[f.gate] : g.goal);
    const dx = goal.x - f.x;
    const dy = goal.y - f.y;
    const d = Math.hypot(dx, dy);
    f.angle = Math.atan2(dy, dx);
    if (d <= speed * dt) return f.home ? leak(g, f) : grab(g, f);
    f.x += (dx / d) * speed * dt;
    f.y += (dy / d) * speed * dt;
    return;
  }
  if (g.clock < f.stunUntil) return;
  if (f.chew) {
    f.chew.left -= dt;
    if (f.chew.left > 0) return;
    const hedge = towerAt(g, f.chew.cell);
    if (hedge?.kind === 'hedge') {
      removeTower(g, hedge);
      g.events.push({ type: 'chewed', cell: f.chew.cell });
    }
    f.chew = null;
    f.chews--;
  }
  f.t += speed * dt;
  while (f.t >= 1) {
    f.t -= 1;
    f.from = f.to;
    if (f.home ? f.from === g.gates[f.gate] : f.from === g.goal) {
      if (f.home) return leak(g, f);
      grab(g, f);
      if (f.dead) return;
    }
    if (f.chews > 0 && !f.home && !f.lure) {
      const hedge = hedgeToChew(g, f.from);
      if (hedge >= 0) {
        f.chew = { cell: hedge, left: CHEW_TIME };
        f.t = 0;
        const [hx, hy] = cellOf(hedge);
        const [x, y] = cellOf(f.from);
        f.angle = Math.atan2(hy - y, hx - x);
        g.events.push({ type: 'chewing', cell: hedge });
        break;
      }
    }
    const lure = f.lure ? g.traps.find((t) => t.id === f.lure)?.field : null;
    const step = nextStep(lure ?? (f.home ? g.homeDist[f.gate] : g.dist), f.from, f.heading);
    if (!step) {
      f.t = 0;
      break;
    }
    f.to = step.cell;
    f.heading = step.dir;
  }
  const a = centre(f.from);
  const b = centre(f.to);
  f.x = a.x + (b.x - a.x) * f.t;
  f.y = a.y + (b.y - a.y) * f.t;
  if (f.to !== f.from) f.angle = Math.atan2(b.y - a.y, b.x - a.x);
}

/** A foe reaches the patch: it takes its share of cabbages (`lives`) and turns for home. */
function grab(g: Game, f: Foe) {
  g.leaks++;
  const n = Math.min(f.lives, g.lives);
  g.lives -= n;
  f.carry = n;
  f.home = true;
  f.chew = null;
  // An empty patch: it has nothing to take, and is gone.
  if (n === 0) f.dead = true;
  else g.events.push({ type: 'grab', kind: f.kind, n });
}

/** A foe gets back into its burrow, and the cabbages it carries are lost. */
function leak(g: Game, f: Foe) {
  f.dead = true;
  const lives = f.carry;
  f.carry = 0;
  g.events.push({ type: 'leak', kind: f.kind, lives });
}

/** A beaten foe drops its cabbages where it fell. */
function drop(g: Game, f: Foe) {
  const flier = FOE[f.kind].flies;
  g.loose.push({ id: g.nextId++, n: f.carry, x: f.x, y: f.y, from: flier ? -1 : f.from, to: flier ? -1 : f.to, t: flier ? 0 : f.t });
  g.events.push({ type: 'drop', x: f.x, y: f.y, n: f.carry });
  f.carry = 0;
}

/** Loose cabbages roll back to the patch, and a passing foe with free hands picks them up. */
function roll(g: Game, c: Loose, dt: number) {
  for (const f of g.foes) {
    if (f.dead || f.carry > 0 || Math.hypot(f.x - c.x, f.y - c.y) > CABBAGE.reach + f.body) continue;
    f.carry = c.n;
    f.home = true;
    f.chew = null;
    g.events.push({ type: 'pickup', x: c.x, y: c.y });
    return true;
  }
  const move = CABBAGE.speed * dt;
  if (c.from < 0) {
    const goal = centre(g.goal);
    const d = Math.hypot(goal.x - c.x, goal.y - c.y);
    if (d > move) {
      c.x += ((goal.x - c.x) / d) * move;
      c.y += ((goal.y - c.y) / d) * move;
      return false;
    }
  } else {
    c.t += move;
    while (c.t >= 1 && c.to !== g.goal) {
      c.t -= 1;
      c.from = c.to;
      const step = nextStep(g.dist, c.from);
      if (!step) break;
      c.to = step.cell;
    }
    if (c.to !== g.goal || c.t < 1) {
      c.t = Math.min(c.t, 1);
      const a = centre(c.from);
      const b = centre(c.to);
      c.x = a.x + (b.x - a.x) * c.t;
      c.y = a.y + (b.y - a.y) * c.t;
      return false;
    }
  }
  g.lives += c.n;
  g.events.push({ type: 'saved', n: c.n });
  return true;
}

/** Burning and poison, and poison spreading to the foes walking close. */
function afflict(g: Game, f: Foe, dt: number) {
  f.heat = Math.max(0, f.heat - HEAT.cool * dt);
  const heals = FOE[f.kind].heals;
  if (heals && g.clock >= f.slowUntil && g.clock >= f.poisonUntil) f.hp = Math.min(f.maxHp, f.hp + heals * f.maxHp * dt);
  if (f.empress) empress(g, f);
  if (g.clock < f.burnUntil) hurt(g, f, f.burnDps * dt, 'heat', f.blueFlame);
  if (g.clock >= f.poisonUntil) return;
  hurt(g, f, f.poisonDps * dt, 'poison');
  if (!f.spreads || g.clock < f.spreadAt) return;
  f.spreadAt = g.clock + SPREAD.every;
  for (const o of g.foes) {
    if (o === f || o.dead || FOE[o.kind].flies || Math.hypot(o.x - f.x, o.y - f.y) > SPREAD.reach || o.poisonUntil > g.clock) continue;
    o.poisonUntil = g.clock + 2;
    o.poisonDps = f.poisonDps;
    o.spreads = false;
  }
}

/** The shell that halves each damage kind, for the Empress to turn to. */
const RESISTS: Partial<Record<DamageKind, ShellKind>> = { sharp: 'hard', heat: 'waxy', blast: 'hairy', spark: 'rubbery' };

/** The Empress lays a beetle now and then, and turns her shell against what hurt her most. */
function empress(g: Game, f: Foe) {
  const e = f.empress!;
  if (g.clock >= e.eggAt && !FOE[f.kind].flies) {
    e.eggAt += EMPRESS.egg;
    offspring(g, f, 'beetle', Math.round(FOE.beetle.hp * (1 + HP_PER_WAVE * (g.wave - 1)) * g.toughness), 0.5);
    g.events.push({ type: 'egg', x: f.x, y: f.y });
  }
  if (g.clock < e.turnAt) return;
  e.turnAt += EMPRESS.turn;
  let top: DamageKind | undefined;
  for (const [kind, dealt] of Object.entries(e.taken) as [DamageKind, number][]) if (RESISTS[kind] && dealt > (e.taken[top!] ?? 0)) top = kind;
  e.taken = {};
  const shell = top && RESISTS[top];
  if (shell && shell !== f.shell) {
    f.shell = shell;
    g.events.push({ type: 'shell', shell });
  }
}

/** Whether a tower is wilted or frozen, so it neither reloads nor fires. */
export const stopped = (g: Game, t: Tower) => g.clock < t.wiltUntil || g.clock < t.frozenUntil;

/** Whether a grown `kind` tower's reach covers `cell`: a frost tower cools, a bonfire warms. */
function covered(g: Game, cell: number, kind: TowerKind) {
  const at = centre(cell);
  return g.towers.some((o) => o.kind === kind && o.grow <= 0 && o.cell !== cell && Math.hypot(centre(o.cell).x - at.x, centre(o.cell).y - at.y) <= reachOf(g, o.cell, kind));
}

/** Summer: a tower firing nonstop for too long wilts for a while, unless a frost tower cools it. */
function wilt(g: Game, t: Tower, dt: number) {
  if (!attacks(t.kind) || t.kind === 'frost') return;
  t.busy = g.clock - t.lastShot <= WEATHER.rest ? t.busy + dt : 0;
  if (t.busy < WEATHER.wiltAfter) return;
  t.busy = 0;
  if (covered(g, t.cell, 'frost')) return;
  t.wiltUntil = g.clock + WEATHER.wiltFor;
  g.events.push({ type: 'wilt', cell: t.cell });
}

/** Winter: now and then during a wave, frost freezes a tower that no bonfire warms. */
function frost(g: Game) {
  if (g.phase !== 'wave') {
    g.frostAt = null;
    return;
  }
  g.frostAt ??= g.clock + WEATHER.frostEvery;
  if (g.clock < g.frostAt) return;
  g.frostAt += WEATHER.frostEvery;
  const cold = g.towers.filter((t) => attacks(t.kind) && t.kind !== 'bonfire' && t.grow <= 0 && !stopped(g, t) && !covered(g, t.cell, 'bonfire'));
  if (cold.length === 0) return;
  const t = cold[Math.floor(rand(g) * cold.length)];
  t.frozenUntil = g.clock + WEATHER.frostFor;
  g.events.push({ type: 'frozen', cell: t.cell });
}

/** How much faster each tower reloads, from the beehives round it (the best one counts). */
function boosts(g: Game) {
  const out = new Map<number, number>();
  for (const hive of g.towers) {
    if (hive.kind !== 'beehive' || hive.grow > 0) continue;
    const [hx, hy] = cellOf(hive.cell);
    const boost = hive.level === MASTER ? MASTER_TRICKS.hiveBoost : TOWER.beehive.boost![tier(hive.level)];
    for (const t of g.towers) {
      const [x, y] = cellOf(t.cell);
      if (t !== hive && Math.abs(x - hx) <= 1 && Math.abs(y - hy) <= 1) out.set(t.id, Math.max(out.get(t.id) ?? 0, boost));
    }
  }
  return out;
}

/** The foe a tower aims at among `foes`, by its aim. */
function pick(g: Game, foes: Foe[], aim: Aim = 'first') {
  if (aim === 'fliers') {
    const fliers = foes.filter((f) => FOE[f.kind].flies);
    if (fliers.length) foes = fliers;
    aim = 'first';
  }
  const score = (f: Foe) => (aim === 'first' ? -remaining(g, f) : aim === 'last' ? remaining(g, f) : aim === 'strongest' ? f.hp : -f.hp);
  let target = foes[0];
  for (const f of foes) if (score(f) > score(target)) target = f;
  return target;
}

/** A sunglass or bonfire hit: heat damage, and heat that builds up on the foe. */
function scorch(g: Game, f: Foe, damage: number, pierce = false) {
  hurt(g, f, damage, 'heat', pierce);
  f.heat = Math.min(1, f.heat + HEAT.hit);
}

function fire(g: Game, tower: Tower, dt: number, boost: number) {
  const def = TOWER[tower.kind];
  if (tower.grow > 0) {
    tower.grow = Math.max(0, tower.grow - dt);
    return;
  }
  tower.cooldown = Math.max(0, tower.cooldown - dt * (1 + boost));
  if (!attacks(tower.kind)) return;
  const master = tower.level === MASTER;
  if (tower.kind === 'whirligig' && !master && (tower.idle += dt) > 1) tower.spin = Math.max(0, tower.spin - dt / def.spinUp!);
  if (tower.cooldown > 0) return;
  const { x, y } = centre(tower.cell);
  const lvl = tier(tower.level);
  const range = reachOf(g, tower.cell, tower.kind);
  const reaches = (f: Foe) => !f.dead && (def.air || !FOE[f.kind].flies) && (!def.airOnly || !!FOE[f.kind].flies);
  if (tower.kind === 'sunglass') {
    const cells = beamCells(g, tower.cell, tower.face);
    const lit = new Set(cells);
    const hit = g.foes.filter((f) => reaches(f) && lit.has(Math.floor(f.y) * COLS + Math.floor(f.x)));
    if (hit.length === 0) return;
    tower.cooldown = def.reload[lvl];
    tower.lastShot = g.clock;
    for (const f of hit) {
      scorch(g, f, def.damage[lvl]);
      // A master sunglass heats twice as fast.
      if (master) f.heat = Math.min(1, f.heat + HEAT.hit);
    }
    const end = cells.length ? centre(cells[cells.length - 1]) : { x, y };
    const [dx, dy] = DIRS[tower.face];
    g.events.push({ type: 'beam', x, y, x2: end.x + dx * 0.5, y2: end.y + dy * 0.5 }, { type: 'shot', kind: 'sunglass' });
    return;
  }
  if (tower.kind === 'bonfire') {
    const hit = g.foes.filter((f) => reaches(f) && inCone(tower.cell, tower.face, f.x, f.y, f.body, range));
    if (hit.length === 0) return;
    tower.cooldown = def.reload[lvl];
    tower.lastShot = g.clock;
    for (const f of hit) {
      scorch(g, f, def.damage[lvl], master);
      f.burnUntil = g.clock + def.dotFor!;
      f.burnDps = def.dot![lvl];
      f.blueFlame = master;
    }
    g.events.push({ type: 'flame', x, y, angle: tower.aim, r: range, cone: def.cone! }, { type: 'shot', kind: 'bonfire' });
    return;
  }
  const inRange = g.foes.filter((f) => reaches(f) && Math.hypot(f.x - x, f.y - y) <= range);
  if (inRange.length === 0) return;
  if (tower.kind === 'toadstool') {
    // Shrinks the foes in reach not shrunk yet: one, or two at master level.
    let shrunk = 0;
    while (shrunk < (master ? 2 : 1)) {
      const big = inRange.filter((f) => !f.shrunk);
      if (big.length === 0) break;
      const f = pick(g, big, tower.target);
      shrunk++;
      f.shrunk = true;
      f.hp *= def.shrink!;
      f.maxHp *= def.shrink!;
      f.body *= 0.8;
      f.lives = Math.max(1, f.lives - 1);
      g.events.push({ type: 'shrink', x: f.x, y: f.y });
    }
    // Nothing left to shrink: look again soon rather than waiting a whole reload. That isn't a shot, so it never counts towards wilting.
    if (shrunk === 0) return void (tower.cooldown = 0.3);
    tower.cooldown = def.reload[lvl];
    tower.lastShot = g.clock;
    g.events.push({ type: 'shot', kind: 'toadstool' });
    return;
  }
  tower.cooldown = def.reload[lvl];
  tower.lastShot = g.clock;
  if (tower.kind === 'frost') {
    for (const f of inRange) {
      // A master frost stops a foe it newly chills, for a moment.
      if (master && f.slowUntil <= g.clock && !FOE[f.kind].flies) f.stunUntil = g.clock + MASTER_TRICKS.freeze;
      f.slowUntil = g.clock + def.slowFor!;
      f.slowFactor = def.slow![lvl];
      hurt(g, f, def.damage[lvl], 'cold');
    }
    g.events.push({ type: 'pulse', x, y, r: range });
    return;
  }
  if (tower.kind === 'nettle') {
    // Stings every ground foe in reach still for a moment (twice as long at master level).
    for (const f of inRange) {
      f.stunUntil = Math.max(f.stunUntil, g.clock + def.stun![lvl] * (master ? 2 : 1));
      hurt(g, f, def.damage[lvl], 'sharp');
    }
    g.events.push({ type: 'sting', x, y, r: range }, { type: 'shot', kind: 'nettle' });
    return;
  }
  if (tower.kind === 'storm') {
    // The bolt strikes the foe closest to the cottage, then jumps on to the nearest foe not yet struck.
    const struck = [pick(g, inRange, tower.target)];
    while (struck.length < (master ? MASTER_TRICKS.stormChain : def.chain![lvl])) {
      const last = struck[struck.length - 1];
      let next: Foe | undefined;
      let best = def.jump!;
      for (const f of g.foes) {
        const d = Math.hypot(f.x - last.x, f.y - last.y);
        if (reaches(f) && !struck.includes(f) && d <= best) (best = d), (next = f);
      }
      if (!next) break;
      struck.push(next);
    }
    const points = [{ x, y }, ...struck.map((f) => ({ x: f.x, y: f.y }))];
    for (const f of struck) hurt(g, f, def.damage[lvl], 'spark');
    tower.aim = Math.atan2(points[1].y - y, points[1].x - x);
    g.events.push({ type: 'bolt', points }, { type: 'shot', kind: 'storm' });
    return;
  }
  if (tower.kind === 'puffball') {
    // Spores for a foe not yet poisoned, if there is one.
    const clean = inRange.filter((f) => f.poisonUntil <= g.clock);
    // A master puffball's spore cloud poisons every foe in reach at once.
    const targets = master ? inRange : [pick(g, clean.length ? clean : inRange, tower.target)];
    for (const target of targets) {
      target.poisonUntil = g.clock + def.dotFor!;
      target.poisonDps = def.dot![lvl];
      target.spreads = true;
      g.events.push({ type: 'puff', x: target.x, y: target.y });
    }
    g.events.push({ type: 'shot', kind: 'puffball' });
    return;
  }
  const target = pick(g, inRange, tower.target);
  tower.aim = Math.atan2(target.y - y, target.x - x);
  if (tower.kind === 'whirligig') {
    tower.cooldown = def.reload[lvl] + (def.spinTo![lvl] - def.reload[lvl]) * tower.spin;
    tower.spin = Math.min(1, tower.spin + tower.cooldown / def.spinUp!);
    tower.idle = 0;
  }
  const kind = tower.kind as ShotKind;
  const masterCannon = master && kind === 'cannon';
  const shot = { kind, x, y, damage: def.damage[lvl], splash: masterCannon ? MASTER_TRICKS.splash : def.splash ?? 0, hits: def.hits, pierce: master && kind === 'crossbow', knock: masterCannon };
  g.shots.push({ ...shot, target: target.id, tx: target.x, ty: target.y });
  // A master bow or swallow nest looses a second shot at another foe.
  const second = master && (kind === 'bow' || kind === 'swallow') && inRange.length > 1 ? pick(g, inRange.filter((f) => f !== target), tower.target) : undefined;
  if (second) g.shots.push({ ...shot, target: second.id, tx: second.x, ty: second.y });
  g.events.push({ type: 'shot', kind: tower.kind });
}

function moveShot(g: Game, s: Shot, dt: number) {
  const target = g.foes.find((f) => f.id === s.target && !f.dead);
  if (target) (s.tx = target.x), (s.ty = target.y);
  const dx = s.tx - s.x;
  const dy = s.ty - s.y;
  const d = Math.hypot(dx, dy);
  const travel = SHOT_SPEED[s.kind] * dt;
  if (d > travel) {
    s.x += (dx / d) * travel;
    s.y += (dy / d) * travel;
    return false;
  }
  if (s.kind !== 'cannon') {
    if (target) {
      hurt(g, target, s.damage, s.hits, s.pierce);
      g.events.push({ type: 'hit', x: s.tx, y: s.ty });
    }
  } else {
    for (const f of g.foes) {
      if (f.dead || FOE[f.kind].flies || Math.hypot(f.x - s.tx, f.y - s.ty) > s.splash + f.body) continue;
      hurt(g, f, s.damage, s.hits);
      // A master cannon's thunderclap knocks foes back along their way.
      if (s.knock && !f.chew) f.t = Math.max(0, f.t - MASTER_TRICKS.knock);
    }
    g.events.push({ type: 'boom', x: s.tx, y: s.ty, r: s.splash });
  }
  return true;
}

/** Honey pots lure and burst, and bramble snares catch the first foe to step on them. */
function springTraps(g: Game) {
  const ground = g.foes.filter((f) => !f.dead && !FOE[f.kind].flies);
  for (const trap of g.traps) {
    const at = centre(trap.cell);
    if (trap.kind === 'snare') {
      const caught = ground.find((f) => f.from === trap.cell);
      if (!caught) continue;
      caught.stunUntil = Math.max(caught.stunUntil, g.clock + TRAP.snare.hold);
      hurt(g, caught, TRAP.snare.damage, 'sharp');
      trap.until = -1;
      g.events.push({ type: 'snared', x: at.x, y: at.y });
      continue;
    }
    const near = ground.filter((f) => Math.hypot(f.x - at.x, f.y - at.y) <= TRAP.honey.lure);
    if (!trap.sprung) {
      if (near.length === 0) continue;
      trap.sprung = true;
      trap.until = g.clock + TRAP.honey.for;
      trap.field = distances(g.blocked, trap.cell);
      g.events.push({ type: 'lured', x: at.x, y: at.y });
    }
    if (g.clock < trap.until) {
      for (const f of near) if (!f.lure) (f.lure = trap.id), (f.chew = null);
      continue;
    }
    // It bursts: a blast round the pot, and the foes in it held still a moment.
    for (const f of ground) {
      if (f.lure === trap.id) f.lure = 0;
      if (f.dead || Math.hypot(f.x - at.x, f.y - at.y) > TRAP.honey.burst + f.body) continue;
      hurt(g, f, TRAP.honey.damage, 'blast');
      f.stunUntil = Math.max(f.stunUntil, g.clock + TRAP.honey.stun);
    }
    trap.until = -1;
    g.events.push({ type: 'burst', x: at.x, y: at.y, r: TRAP.honey.burst });
  }
  g.traps = g.traps.filter((t) => t.until !== -1);
}

/** Plays `dt` seconds. */
export function step(g: Game, dt: number) {
  if (over(g)) return;
  g.clock += dt;
  g.steps++;
  if (g.nextAt !== null && g.clock >= g.nextAt) beginWave(g);
  while (g.spawns.length && g.spawns[0].at <= g.clock) {
    const s = g.spawns.shift()!;
    spawn(g, s);
  }
  for (const f of g.foes) if (!f.dead) moveFoe(g, f, dt);
  for (const f of g.foes) if (!f.dead) afflict(g, f, dt);
  springTraps(g);
  g.loose = g.loose.filter((c) => !roll(g, c, dt));
  const boost = boosts(g);
  for (const t of g.towers) {
    if (stopped(g, t)) continue;
    fire(g, t, dt, boost.get(t.id) ?? 0);
    if (g.map.season === 'summer') wilt(g, t, dt);
  }
  if (g.map.season === 'winter') frost(g);
  g.shots = g.shots.filter((s) => !moveShot(g, s, dt));
  g.foes = g.foes.filter((f) => !f.dead);
  if (cabbagesLeft(g) <= 0) {
    g.phase = 'lost';
    g.events.push({ type: 'lost' });
    return;
  }
  if (g.phase === 'wave' && g.spawns.length === 0 && g.foes.length === 0) {
    let gold = 0;
    for (; g.paid < g.wave; g.paid++) gold += pay(g, waveReward(g.paid + 1));
    share(g, gold);
    for (const t of g.towers) {
      if (t.kind !== 'apple') continue;
      const apples = t.level === MASTER ? MASTER_TRICKS.apples : TOWER.apple.apples![tier(t.level)];
      addGold(g, sideOf(g, t.cell), apples);
      g.events.push({ type: 'apples', cell: t.cell, gold: apples });
    }
    g.shots = [];
    g.events.push({ type: 'cleared', wave: g.wave, gold });
    if (g.wave >= totalWaves(g)) {
      g.phase = 'won';
      g.events.push({ type: 'won' });
    } else g.phase = 'build';
  }
  // The wave timer starts once the last wave is all out.
  // In Swarm it sends the next at once, whatever Calm says.
  if ((!g.calm || g.mode === 'swarm') && g.nextAt === null && g.wave >= 1 && canStartWave(g)) g.nextAt = g.clock + (g.mode === 'swarm' ? 0 : WAVE_TIMER);
}

/** The cells of the route from a burrow to the cottage, as foes would walk it now. */
export function routeLength(g: Game, gate: number) {
  return g.dist[g.gates[gate]];
}

/** A new game that plays `replay` back: call `replayStep` before each `step`. */
export const replayGame = (r: Replay) => newGame(r.map, r.calm, r.mode, r.masters, r, r.duo);

/** Takes the replay's actions due before the next step, in order, from `from`; returns where it got to. */
export function replayStep(g: Game, r: Replay, from: number) {
  let i = from;
  for (; i < r.log.length && r.log[i].s <= g.steps; i++) {
    const { a, c = -1, k } = r.log[i];
    if (a === 'build') build(g, c, k!);
    else if (a === 'upgrade') upgrade(g, c);
    else if (a === 'sell') sell(g, c);
    else if (a === 'turn') turn(g, c);
    else if (a === 'aim') setAim(g, c);
    else startWave(g);
  }
  return i;
}

/**
 * A saved game played back quietly to the step it was saved at, `dt` a step, with each step's
 * events handed to `events` and dropped: the same game as it was then, ready to go on.
 */
export function resumeGame(r: Replay, dt: number, events: (e: GameEvent[]) => void) {
  const g = replayGame(r);
  let i = 0;
  while (g.steps < r.steps && !over(g)) {
    i = replayStep(g, r, i);
    step(g, dt);
    events(g.events);
    g.events.length = 0;
  }
  // The actions taken after its last step, in the break it was saved in.
  replayStep(g, r, i);
  g.events.length = 0;
  return g;
}

/** What to keep of a finished game to watch it again. */
export const replayOf = (g: Game): Replay => ({
  v: REPLAY_VERSION, map: g.map.id, calm: g.calm, duo: g.duo, mode: g.mode, masters: g.masters ? [...g.masters] : null, seed: g.seed, toughness: g.toughness, lives: g.maxLives,
  log: g.log, steps: g.steps, stars: stars(g), time: Math.round(g.clock),
});
