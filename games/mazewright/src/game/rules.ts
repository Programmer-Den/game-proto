import { byDifficulty } from '../../../../shared/settings';

// Mazewright's balance: towers, foes and the twenty waves. Positions and speeds are in cells and
// seconds; the scene turns cells into pixels.

/** The grid: 22 cells across, 11 down. */
export const COLS = 22;
export const ROWS = 11;

export const TOWERS = ['hedge', 'bow', 'frost', 'cannon', 'storm', 'crossbow', 'bonfire', 'puffball', 'sunglass', 'beehive', 'apple', 'whirligig', 'swallow', 'nettle', 'toadstool', 'honey', 'snare'] as const;
export type TowerKind = (typeof TOWERS)[number];

/** The pouch: the towers a run can plant. Hedge and bow are always in it, with up to four more. */
export const ALWAYS: TowerKind[] = ['hedge', 'bow'];
export const POUCH_PICKS = 4;
/** Today's four, the pouch of a first game. */
export const DEFAULT_POUCH: TowerKind[] = ['hedge', 'bow', 'frost', 'cannon'];

/**
 * The potting shed: every tower but these free four is bought with seeds (as many as its gold
 * cost), each tower's master level too (twice its cost), and the pouch's fifth and sixth slots.
 */
export const FREE: TowerKind[] = ['hedge', 'bow', 'frost', 'cannon'];
export const towerSeeds = (kind: TowerKind) => TOWER[kind].cost;
export const masterSeeds = (kind: TowerKind) => TOWER[kind].cost * 2;
export const SLOT_SEEDS = [60, 100];
/** Seeds a game pays: a win `win` plus `star` a star, a loss `loss` plus one per `waves` waves held. */
export const SEEDS = { win: 10, star: 5, loss: 2, waves: 4 };

/** What a tower's hits are made of: shells resist some kinds and crack under others. */
export const DAMAGE_KINDS = ['sharp', 'blast', 'heat', 'spark', 'cold', 'poison'] as const;
export type DamageKind = (typeof DAMAGE_KINDS)[number];

/** Foe shells and how much of each damage kind gets through (1 when not listed). */
export const SHELLS = {
  hard: { sharp: 0.5, spark: 1.5 },
  waxy: { heat: 0.5, blast: 1.5 },
  hairy: { blast: 0.5, sharp: 1.5 },
  rubbery: { spark: 0.5, cold: 1.5 },
  ember: { heat: 0 },
} as const satisfies Record<string, Partial<Record<DamageKind, number>>>;
export type ShellKind = keyof typeof SHELLS;
export const shellFactor = (shell: ShellKind | undefined, kind: DamageKind) =>
  (shell && (SHELLS[shell] as Partial<Record<DamageKind, number>>)[kind]) ?? 1;

/** Heat: each sunglass or bonfire hit adds `HEAT.hit`, it cools by `HEAT.cool` a second, and a fully heated foe takes `HEAT.boost` times heat damage. */
export const HEAT = { hit: 0.25, cool: 0.15, boost: 2 };

/** How a tower picks its target among the foes in reach. */
export const AIMS = ['first', 'last', 'strongest', 'weakest', 'fliers'] as const;
export type Aim = (typeof AIMS)[number];

export interface TowerDef {
  cost: number;
  /** What its hits are made of. */
  hits: DamageKind;
  /** Reach in cells; 0 for a tower that never shoots (hedge, beehive, apple tree). */
  range: number;
  /** Damage per shot (frost: per pulse), by level 1 to 3. */
  damage: [number, number, number];
  /** Seconds between shots or pulses, by level. */
  reload: [number, number, number];
  /** Whether it can hit moths, which fly. */
  air: boolean;
  /** Cannon: cells around the hit that take the damage too. */
  splash?: number;
  /** Frost: how fast a chilled foe still walks (0.5 is half speed), by level, and for how long. */
  slow?: [number, number, number];
  slowFor?: number;
  /** Storm rod: how many foes a bolt reaches in all, by level, and how far it jumps between them. */
  chain?: [number, number, number];
  jump?: number;
  /** Bonfire: burn damage per second, by level, and for how long. Puffball: the same for poison. */
  dot?: [number, number, number];
  dotFor?: number;
  /** Bonfire and sunglass point one way (an index into `DIRS`); the bonfire's cone half-width in radians. */
  faces?: boolean;
  cone?: number;
  /** Beehive: how much faster the towers round it reload, by level. */
  boost?: [number, number, number];
  /** Apple tree: gold dropped each time a wave is held, by level. */
  apples?: [number, number, number];
  /** Whirligig: the reload it spins up to, by level, and the seconds of firing it takes. */
  spinTo?: [number, number, number];
  spinUp?: number;
  /** The aim a new tower starts with (First unless set). */
  aim?: Aim;
  /** Swallow nest: it only attacks fliers. */
  airOnly?: boolean;
  /** Nettle patch: how long a sting holds a ground foe still, by level. */
  stun?: [number, number, number];
  /** Toadstool ring: the share of health a shrunk foe keeps. */
  shrink?: number;
  /** A one-use garden trap (honey pot, bramble snare): it lies on the lawn and never blocks. */
  trap?: boolean;
}

export const TOWER: Record<TowerKind, TowerDef> = {
  hedge: { cost: 4, hits: 'sharp', range: 0, damage: [0, 0, 0], reload: [1, 1, 1], air: false },
  bow: { cost: 10, hits: 'sharp', range: 3, damage: [6, 10, 16], reload: [0.6, 0.55, 0.5], air: true },
  frost: { cost: 15, hits: 'cold', range: 2.5, damage: [2, 3, 5], reload: [1, 1, 1], air: true, slow: [0.55, 0.5, 0.42], slowFor: 1.5 },
  cannon: { cost: 25, hits: 'blast', range: 3.5, damage: [16, 26, 40], reload: [1.6, 1.5, 1.4], air: false, splash: 1 },
  storm: { cost: 30, hits: 'spark', range: 3, damage: [14, 22, 34], reload: [1.4, 1.3, 1.2], air: true, chain: [4, 5, 6], jump: 1.5 },
  crossbow: { cost: 35, hits: 'sharp', range: 7, damage: [50, 80, 125], reload: [2.5, 2.3, 2.1], air: true, aim: 'strongest' },
  bonfire: { cost: 25, hits: 'heat', range: 2.2, damage: [4, 7, 11], reload: [0.5, 0.5, 0.5], air: false, dot: [6, 9, 14], dotFor: 2, faces: true, cone: 0.7 },
  puffball: { cost: 20, hits: 'poison', range: 2.5, damage: [0, 0, 0], reload: [1.2, 1.1, 1], air: true, dot: [4, 6, 9], dotFor: 4 },
  sunglass: { cost: 40, hits: 'heat', range: 22, damage: [22, 34, 50], reload: [1.4, 1.3, 1.2], air: true, faces: true },
  beehive: { cost: 30, hits: 'sharp', range: 0, damage: [0, 0, 0], reload: [1, 1, 1], air: false, boost: [0.2, 0.3, 0.4] },
  apple: { cost: 30, hits: 'sharp', range: 0, damage: [0, 0, 0], reload: [1, 1, 1], air: false, apples: [5, 8, 12] },
  whirligig: { cost: 20, hits: 'sharp', range: 2.5, damage: [3, 4, 6], reload: [0.6, 0.6, 0.6], air: true, spinTo: [0.15, 0.13, 0.11], spinUp: 3 },
  swallow: { cost: 15, hits: 'sharp', range: 3.5, damage: [16, 26, 40], reload: [0.7, 0.65, 0.6], air: true, airOnly: true },
  nettle: { cost: 20, hits: 'sharp', range: 1.6, damage: [3, 5, 8], reload: [2.5, 2.3, 2.1], air: false, stun: [0.4, 0.5, 0.6] },
  toadstool: { cost: 30, hits: 'poison', range: 2.5, damage: [0, 0, 0], reload: [4, 3.5, 3], air: false, shrink: 0.75, aim: 'strongest' },
  honey: { cost: 20, hits: 'blast', range: 2.5, damage: [0, 0, 0], reload: [1, 1, 1], air: false, trap: true },
  snare: { cost: 15, hits: 'sharp', range: 0, damage: [0, 0, 0], reload: [1, 1, 1], air: false, trap: true },
};
export type TrapKind = 'honey' | 'snare';
/**
 * Garden traps. A honey pot draws the ground foes within `lure` cells (its reach) to it for `for`
 * seconds once one comes close, then bursts: `damage` to the foes within `burst`, held still for
 * `stun`. A bramble snare holds the first ground foe to step on it for `hold` seconds and pricks it.
 */
export const TRAP = { honey: { lure: 2.5, for: 3, burst: 1.3, damage: 45, stun: 1.5 }, snare: { hold: 3, damage: 12 } };

/** Whether a tower kind shoots or pulses at foes (a hedge, beehive or apple tree doesn't). */
export const attacks = (kind: TowerKind) => TOWER[kind].range > 0 && !TOWER[kind].trap;
/** Whether a tower kind picks one target, so its aim can be set. */
export const aims = (kind: TowerKind) => attacks(kind) && !TOWER[kind].faces && kind !== 'frost' && kind !== 'nettle';
/** Whether a tower kind deals damage of its kind, so the tip names it. */
export const harms = (kind: TowerKind) => kind !== 'hedge' && (TOWER[kind].damage[0] > 0 || !!TOWER[kind].dot);

/** The highest level a tower reaches; hedges stay at 1. Level 4 is the master level, with the numbers of level 3 and a trick of its own. */
export const MAX_LEVEL = 4;
export const MASTER = 4;
/** Which of a tower's by-level numbers a level uses: the master level keeps level 3's. */
export const tier = (level: number) => Math.min(level, 3) - 1;
/** Master tricks: bow and swallow shoot two foes, frost stops newly chilled foes, cannon knocks foes back, storm chains to `stormChain`, crossbow and bonfire go through shells, puffball poisons every foe in reach, sunglass heats twice as fast, beehive boosts `hiveBoost`, apple drops `apples`, whirligig never spins down, nettle stings twice as long, toadstool shrinks two foes. */
export const MASTER_TRICKS = { freeze: 1, knock: 0.6, splash: 1.5, stormChain: 10, hiveBoost: 0.55, apples: 20 };
/** The share of what a tower cost (with its upgrades) that selling it gives back. */
export const SELL_BACK = 0.7;
/** The cost of raising a tower from `level` to the next. */
export const upgradeCost = (kind: TowerKind, level: number) => TOWER[kind].cost * (level < 3 ? level : 4);
/** Arrow and cannon ball speeds, in cells per second. */
export const SHOT_SPEED = { bow: 12, cannon: 7, crossbow: 20, whirligig: 14, swallow: 16 } as const;
export type ShotKind = keyof typeof SHOT_SPEED;
/** Puffball spores jump from a poisoned foe to ground foes this close, once a second. */
export const SPREAD = { reach: 0.9, every: 1 };

export const FOES = ['beetle', 'ladybird', 'stag', 'moth', 'mole', 'weevil', 'woodlouse', 'snail', 'ember', 'earwig', 'queen'] as const;
export type FoeKind = (typeof FOES)[number];

export interface FoeDef {
  hp: number;
  /** Cells per second. */
  speed: number;
  gold: number;
  /** Lives lost when it reaches the cottage. */
  lives: number;
  /** Seconds after it before the next foe of its group comes out. */
  gap: number;
  /** Moths fly straight over the maze. */
  flies?: boolean;
  /** Moles chew through a hedge that stands in the way of a much shorter route. */
  digs?: boolean;
  /** Its shell, which resists some damage kinds (`SHELLS`). */
  shell?: ShellKind;
  /** Woodlice: how many small ones it splits into when beaten. */
  splits?: number;
  /** Snails: the share of its health it heals a second, unless chilled or poisoned. */
  heals?: number;
  /** Its body's radius in cells, for drawing and for cannon splash. */
  size: number;
}

export const FOE: Record<FoeKind, FoeDef> = {
  beetle: { hp: 30, speed: 1.6, gold: 2, lives: 1, gap: 1.1, size: 0.22 },
  ladybird: { hp: 18, speed: 2.6, gold: 2, lives: 1, gap: 0.6, size: 0.17 },
  stag: { hp: 90, speed: 1, gold: 5, lives: 2, gap: 1.6, shell: 'waxy', size: 0.3 },
  moth: { hp: 22, speed: 1.4, gold: 3, lives: 1, gap: 1, flies: true, size: 0.22 },
  mole: { hp: 50, speed: 1.3, gold: 4, lives: 1, gap: 1.4, digs: true, shell: 'hairy', size: 0.26 },
  weevil: { hp: 55, speed: 1.2, gold: 4, lives: 1, gap: 1.2, shell: 'hard', size: 0.24 },
  woodlouse: { hp: 36, speed: 1.4, gold: 2, lives: 1, gap: 1, splits: 2, size: 0.22 },
  snail: { hp: 80, speed: 0.7, gold: 4, lives: 1, gap: 1.6, heals: 0.04, shell: 'rubbery', size: 0.25 },
  ember: { hp: 45, speed: 1.5, gold: 3, lives: 1, gap: 1, shell: 'ember', size: 0.22 },
  earwig: { hp: 60, speed: 3, gold: 4, lives: 1, gap: 0.8, size: 0.2 },
  queen: { hp: 600, speed: 0.8, gold: 40, lives: 5, gap: 2, size: 0.42 },
};

/** Seconds a mole chews before the hedge is gone. */
export const CHEW_TIME = 3;
/** Steps a hedge must save before a mole bothers to chew it. */
export const CHEW_GAIN = 6;

/** A group of one kind of foe in a wave, optionally bigger (`size` 2 or 3) or crowned kings. */
export type Group = [FoeKind, number] | [FoeKind, number, { size?: 2 | 3; king?: boolean }];

/** A bigger beetle: health, gold and lives times these, and its body this much larger, by size. */
export const BIG = { 2: { hp: 3, gold: 2, lives: 2, body: 1.4 }, 3: { hp: 6, gold: 3, lives: 3, body: 1.8 } } as const;
/** A king: health, gold and lives times these, its body this much larger and a bit slower. */
export const KING = { hp: 6, gold: 8, lives: 3, body: 1.6, speed: 0.8 };
/** A king mole chews this many hedges, a king woodlouse splits into this many, and a king moth lets out moths when beaten. */
export const KING_TRICKS = { chews: 3, splits: 4, moths: 3 };
/** The Empress (the last wave's queen) lays a beetle every `egg` seconds and turns her shell every `turn` seconds. */
export const EMPRESS = { egg: 5, turn: 5 };

/**
 * The waves, in order. Each burrow opens on its wave in `GATE_WAVES`, and foes come out of the
 * open ones in turn; before that a burrow is closed, though every route must stay free all game.
 */
export const WAVES: Group[][] = [
  [['beetle', 6]],
  [['beetle', 8], ['ladybird', 3]],
  [['ladybird', 10]],
  [['beetle', 10], ['stag', 2]],
  [['beetle', 8], ['mole', 3], ['beetle', 1, { king: true }]],
  [['beetle', 10], ['woodlouse', 4], ['ladybird', 6]],
  [['stag', 5], ['earwig', 4], ['beetle', 6]],
  [['moth', 8], ['beetle', 6], ['weevil', 4]],
  [['mole', 5], ['snail', 3], ['ladybird', 10]],
  [['beetle', 10], ['stag', 1, { king: true }], ['queen', 1]],
  [['beetle', 10], ['ember', 4], ['weevil', 5], ['moth', 6]],
  [['stag', 8], ['mole', 4], ['beetle', 4, { size: 2 }]],
  [['ladybird', 14], ['earwig', 6]],
  [['moth', 12], ['snail', 4], ['stag', 4]],
  [['mole', 8], ['weevil', 8], ['beetle', 6], ['mole', 1, { king: true }]],
  [['stag', 10], ['woodlouse', 6], ['ladybird', 12]],
  [['moth', 14], ['ember', 6], ['mole', 6]],
  [['beetle', 8, { size: 2 }], ['weevil', 8], ['stag', 8]],
  [['ladybird', 20], ['earwig', 6], ['moth', 10], ['mole', 6]],
  [['stag', 8], ['weevil', 6], ['moth', 8], ['beetle', 2, { size: 3 }], ['queen', 1]],
];
/** After the last wave's queen, a rush of one king of every kind met in the game. */
/** Loose cabbages roll back to the patch at `speed` cells a second; a foe within `reach` of one (plus its body) picks it up. */
export const CABBAGE = { speed: 1.2, reach: 0.3 };
/** Seconds from the last wave's queen to the rush, and between two of its kings. */
export const RUSH = { delay: 16, gap: 3 };
export const RUSH_KINDS: FoeKind[] = ['beetle', 'ladybird', 'stag', 'moth', 'mole', 'weevil', 'woodlouse', 'snail', 'ember', 'earwig'];
/** The wave each of a garden's burrows opens on, in its order: the first from the start. */
export const GATE_WAVES = [1, 6, 10, 13, 15, 17];
export const SECOND_GATE = GATE_WAVES[1];
/** A tower on a raised bank reaches this much further. */
export const BANK_REACH = 1.25;
/**
 * Season weather. Summer: a tower that fires nonstop for `wiltAfter` seconds (with no break over
 * `rest`) wilts and stops for `wiltFor`, unless a frost tower's reach covers it. Winter: every
 * `frostEvery` seconds of a wave, frost freezes a random tower for `frostFor`, unless a bonfire's
 * reach covers it.
 */
export const WEATHER = { wiltAfter: 8, rest: 1.5, wiltFor: 3, frostEvery: 14, frostFor: 4 };
/** Seconds between two groups of a wave. */
export const GROUP_GAP = 2;

/** Foes get tougher each wave: health times this per wave after the first. */
export const HP_PER_WAVE = 0.2;
/** The queen of the last wave is this much tougher again. */
export const FINAL_QUEEN = 1.6;

/** Lives and starting gold, and the difficulty's foe health. */
export const startLives = () => byDifficulty(25, 15, 10);
export const START_GOLD = 90;
export const hpScale = () => byDifficulty(0.8, 1, 1.25);
/** Gold for clearing a wave, and for calling the next one before the field is clear. */
export const waveReward = (wave: number) => 6 + wave;

/**
 * Ways to play a garden: Classic (the 20 waves), Swarm (every wave the moment the last is out, for
 * `SWARM_GOLD` times the gold and a fourth star), Endless (waves never stop) and Sandbox
 * (`SANDBOX_GOLD`, towers grow at once, endless waves, no records).
 */
export const MODES = ['classic', 'swarm', 'endless', 'sandbox'] as const;
export type Mode = (typeof MODES)[number];
export const SWARM_GOLD = 1.25;
export const SANDBOX_GOLD = 10000;
/**
 * Two gardeners on one screen: each has the half of the lawn on their side, their own gold (each
 * starts with the usual amount) and their own tool, against shared waves of foes this much tougher.
 */
export const DUO_TOUGHNESS = 1.3;
/** Stars for a win: three with at least `three` of the cabbages kept, two with `two`, else one. */
export const STARS = { three: 0.9, two: 0.5 };

/** The groups of wave `n` (from 1): the table, and past it waves 11 to 20 again, bigger each round. */
export function waveGroups(n: number): Group[] {
  if (n <= WAVES.length) return WAVES[n - 1];
  const past = n - WAVES.length - 1;
  const round = Math.floor(past / 10) + 1;
  return WAVES[10 + (past % 10)].map(([kind, count, opts]) => [kind, Math.ceil(count * (1 + 0.25 * round)), opts ?? {}] as Group);
}
export const EARLY_BONUS = 5;
/** A tower grows one second for every `GROW_RATE` gold it (or its upgrade) cost, and doesn't fire meanwhile. */
export const GROW_RATE = 10;
/** After wave 1, the next wave comes this many seconds after the last one is all out, unless the game is calm. */
export const WAVE_TIMER = 20;
