/** The run's state and the numbers that shape it. The rules that change it are in `sim.ts`. */
import { byDifficulty } from '../../../../shared/settings';
import { HEROES, isKnight, type HeroId } from './heroes';
import { DRILLS, DRILL_STEPS, at, capstonesOf, crossoversOf } from './upgrades';
import type { EventId, FoeKind, NodeKind } from './planets';
import type { TextKey } from '../i18n';
import { PERK, type ArmouryId } from './armoury';
import { MUT, type MutatorId } from './weekly';

/** Each planet lasts this long before its boss comes, ms. */
export const RUN_MS = 5 * 60_000;
/** The most bots on the field at once (the boss not counted). */
export const MAX_ENEMIES = 250;
/** The most lumen shards lying about; past it, new ones merge into old ones. */
export const MAX_SHARDS = 300;
/** The hero's body radius and base shard pickup radius, px. */
export const HERO_R = 13;
export const PICKUP_R = 60;
/**
 * How far from the hero new bots appear: just past the corners of the view. The numbers fit
 * 960x540; a larger view moves the whole ring out by `GameState.ringOut`.
 */
export const SPAWN_RING = { min: 570, max: 640 };
/** Bots further than this from the hero are brought back around to the spawn ring. */
export const LEASH = 900;

/** Difficulty: bot health and how fast they come. Normal is the game as designed. */
export const DIFF = {
  hp: byDifficulty(0.75, 1, 1.35),
  spawn: byDifficulty(0.75, 1, 1.25),
};

/**
 * Things a side objective puts on the field to break: relay beacons, spore nests, a scrap
 * crawler's cache and a monolith. They stand still, deal no harm and drop nothing; every attack
 * hits them like a foe (see `objectives.ts`).
 */
export type StructureKind = 'beacon' | 'nest' | 'cache' | 'monolith';
export const STRUCTURES: readonly StructureKind[] = ['beacon', 'nest', 'cache', 'monolith'];
export const isStructure = (kind: EnemyKind): kind is StructureKind => (STRUCTURES as readonly string[]).includes(kind);

/** A swarm kind of one of the four factions, the planet's boss (see `BOSSES` in planets.ts) or a structure. */
export type EnemyKind = FoeKind | 'boss' | StructureKind;

export interface EnemySpec {
  r: number;
  hp: number;
  speed: number;
  dmg: number;
  xp: number;
}

export const ENEMY: Record<EnemyKind, EnemySpec> = {
  clanker: { r: 11, hp: 10, speed: 62, dmg: 6, xp: 1 },
  rollerbomb: { r: 12, hp: 16, speed: 48, dmg: 10, xp: 3 },
  mirerat: { r: 8, hp: 6, speed: 98, dmg: 5, xp: 1 },
  toad: { r: 13, hp: 26, speed: 46, dmg: 8, xp: 3 },
  linetrooper: { r: 11, hp: 14, speed: 50, dmg: 7, xp: 1 },
  walker: { r: 18, hp: 70, speed: 34, dmg: 12, xp: 5 },
  acolyte: { r: 10, hp: 9, speed: 74, dmg: 6, xp: 1 },
  knight: { r: 15, hp: 55, speed: 56, dmg: 12, xp: 4 },
  sporeling: { r: 10, hp: 9, speed: 56, dmg: 6, xp: 1 },
  puffcap: { r: 15, hp: 40, speed: 40, dmg: 9, xp: 4 },
  scrapper: { r: 9, hp: 7, speed: 90, dmg: 5, xp: 1 },
  hauler: { r: 18, hp: 64, speed: 38, dmg: 11, xp: 4 },
  shardling: { r: 10, hp: 12, speed: 60, dmg: 7, xp: 1 },
  prism: { r: 15, hp: 50, speed: 42, dmg: 10, xp: 4 },
  wisp: { r: 8, hp: 7, speed: 100, dmg: 5, xp: 1 },
  conductor: { r: 14, hp: 46, speed: 46, dmg: 9, xp: 4 },
  boss: { r: 58, hp: 2600, speed: 42, dmg: 22, xp: 0 },
  beacon: { r: 16, hp: 110, speed: 0, dmg: 0, xp: 0 },
  nest: { r: 17, hp: 80, speed: 0, dmg: 0, xp: 0 },
  cache: { r: 30, hp: 520, speed: 0, dmg: 0, xp: 0 },
  monolith: { r: 26, hp: 700, speed: 0, dmg: 0, xp: 0 },
};
/** An elite has this many times the health and is this much bigger; it drops a chest. */
export const ELITE = { hp: 9, size: 1.6, speed: 0.85, xp: 10, every: 50_000, first: 50_000 };
/** A rollerbomb's rush: starts this close, arms for `armMs`, then rolls straight. */
export const ROLLER = { trigger: 190, armMs: 600, rushSpeed: 245, rushMs: 950, blastR: 58, hurtOthers: 30 };
/** Mire rats come in packs; a spitter toad stops in range and spits slowing globs. */
export const RATS = { pack: [4, 6] as const };
export const TOAD = { range: 250, spitMs: 2400, globSpeed: 170, globDmg: 7, slow: 0.4, slowMs: 1600 };
/** Line troopers come in squads that advance in a line and fire volleys together. */
export const LINE = { squad: 5, gap: 26, range: 270, volleyMs: 2800, boltSpeed: 230, dmg: 6 };
/** A walker gunner stops in range and fires heavy bursts. */
export const WALKER = { range: 300, burstMs: 3300, shots: 3, speed: 250, dmg: 9 };
/** An ash acolyte bursts into embers that burn the hero for a moment. */
export const EMBER = { r: 24, ms: 1300, dmg: 3 };
/** A fallen knight blocks bolts from the front, and dashes (its guard drops while it does). */
export const KNIGHT = { trigger: 230, aimMs: 550, dashSpeed: 420, dashMs: 420, guardMs: 900, every: 3800, block: 0.25 };
/** Sporelings leave a slowing cloud of spores where they burst; a puffcap stops in range and puffs a ring of spores. */
export const SPORE = { cloudR: 34, cloudMs: 2600, slow: 0.35, range: 240, puffMs: 3000, puffs: 6, puffSpeed: 120, puffDmg: 6, clump: 3 };
/** Scrappers run in packs of three; a hauler falls apart into scrappers. */
export const SCRAP = { pack: 3, split: 3 };
/** A shardling bursts into splinters that fly out; a prism stops in range and fires a lance of bolts in a line. */
export const SHARD = { splinters: 3, speed: 210, dmg: 5, range: 290, lanceMs: 3200, lance: 4, lanceSpeed: 330, lanceDmg: 7 };
/** Wisps weave hard as they come. */
export const WISP = { weave: 1.1 };
/** The Grinder Crawler's attacks. */
export const BOSS = { shellMs: 3500, shells: 5, shellSpeed: 210, shellDmg: 12, spawnMs: 8000, adds: 5, enragedAt: 0.5, alone: 2 };

export interface Enemy {
  id: number;
  kind: EnemyKind;
  elite: boolean;
  x: number;
  y: number;
  r: number;
  hp: number;
  maxHp: number;
  speed: number;
  dmg: number;
  /** Ms until it can hurt the hero again. */
  hitMs: number;
  slowMs: number;
  slowPct: number;
  stunMs: number;
  /** Ms of the hit flash (a quick swell), and the knockback velocity, px/s. */
  flashMs: number;
  kx: number;
  ky: number;
  /** A rollerbomb's rush: 'walk', 'arm', 'rush'; its rush heading and ms left. */
  mode: 'walk' | 'arm' | 'rush';
  modeMs: number;
  vx: number;
  vy: number;
  /** The boss's attack timers, ms. */
  shellMs: number;
  spawnMs: number;
  /** Ms before the Phalanx shields can bash it again. */
  bashMs: number;
  /** A line trooper's place in its squad's line (px across the way it walks). */
  slot: number;
  /** The way it faces (a knight's shield), and ms its guard stays down after a dash. */
  facing: number;
  guardMs: number;
  /** Where a dash is aimed (the Hollow Champion), and whether a boss is in its second phase. */
  aimX: number;
  aimY: number;
  phase2: boolean;
  /** A boss's frenzy at heat 4 and up, below a quarter of its health (see `heat.ts`). */
  phase3: boolean;
  /** Held in a knight's Grip: ms until it is crushed, and for how much. */
  gripMs: number;
  gripDmg: number;
  /** Ms it runs from the hero (Dread), or fights on the hero's side (Persuasion). */
  fleeMs: number;
  charmMs: number;
  /** Ms before an orbiting blade or a turned foe can hit it again. */
  orbitMs: number;
}

/**
 * A bolt's look: a hero's own bolt colour (from its scheme), a drone or escort bolt, a heavy round
 * or a mini rocket; or a hostile one: a bot shell, a slowing glob, a trooper's volley bolt or a
 * walker's slug.
 */
export type BoltColor = HeroId | 'drone' | 'shell' | 'heavy' | 'rocket' | 'glob' | 'volley' | 'slug' | 'fallen' | 'spore' | 'splinter';

export interface Bullet {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  /** Bots it can still pass through, and bounces left. */
  pierce: number;
  bounces: number;
  lifeMs: number;
  /** A bot's shell (hurts the hero) rather than a hero's bolt. */
  hostile: boolean;
  color: BoltColor;
  /** Ids already hit, so a piercing bolt hits each bot once. */
  hit: number[];
  /** Homing turn rate (rad/s) for mini rockets; 0 for a straight bolt. */
  homing: number;
  /** A bolt that has bounced: Ricochet's tier 3 makes it hit harder. */
  bounced: boolean;
  r: number;
  /** A thrown blade: drawn spinning, flies out for `ret` ms, then comes `back` to the hero. */
  spin: boolean;
  ret: number;
  back: boolean;
  /** A spitter toad's glob (counted for Master Oom's deed). */
  toad: boolean;
  /** Ms before a thrown blade can cut the boss it is passing through again. */
  bossMs: number;
}

/** A blade's swing on screen: an arc (a full ring when `half` is pi) that fades. */
export interface Slash {
  id: number;
  x: number;
  y: number;
  r: number;
  a: number;
  half: number;
  color: string;
  ms: number;
  maxMs: number;
}

/** A bolt of lightning on screen, through these points (x, y pairs). */
export interface Zap {
  id: number;
  pts: number[];
  color: string;
  ms: number;
  maxMs: number;
}

export interface Shard {
  id: number;
  x: number;
  y: number;
  value: number;
  /** Pulled toward the hero once inside the pickup radius. */
  pulled: boolean;
}

/** A blast ring on screen (its damage was dealt when it went off). */
export interface Blast {
  id: number;
  x: number;
  y: number;
  r: number;
  ms: number;
  maxMs: number;
  color: string;
}

/** Something that goes off later: a timed charge, a thrown grenade, a falling crate. */
export interface Bomb {
  id: number;
  kind: 'charge' | 'grenade' | 'frag' | 'crate' | 'orbital' | 'bomblet' | 'carpet' | 'wreck' | 'ship';
  x: number;
  y: number;
  /** Where a thrown bomb flies from (for drawing its arc). */
  fromX: number;
  fromY: number;
  ms: number;
  maxMs: number;
  r: number;
  dmg: number;
  /** Throws `cluster` bomblets when it goes off. */
  cluster: number;
  /** Leaves a medkit healing this much (crates). */
  heal: number;
}

/** A burning patch left by a jet dash. */
export interface Fire {
  id: number;
  x: number;
  y: number;
  r: number;
  ms: number;
  dps: number;
}

/**
 * Allies; the escort is the stranded bot of the event, for one planet. The knights': Kael's
 * strafing starfighter, his Squadron Run fighters and bot co-pilot, Oom's spirits and Veyl's
 * puppets. Elara Voss's rebel commandos, speeder bike and medic; Triad-77's rolling shield bots,
 * command bot and spare battle bots (`spare`, for a while).
 */
export type AllyKind =
  | 'trooper' | 'legionary' | 'brother' | 'drone' | 'escort' | 'fighter' | 'squadron' | 'copilot' | 'spirit' | 'puppet'
  | 'commando' | 'bike' | 'medic' | 'shieldbot' | 'command' | 'spare' | 'thawed';

export interface Ally {
  id: number;
  kind: AllyKind;
  x: number;
  y: number;
  /** Ms until it fires again; the ms of life left of one that lasts a while; its place in formation. */
  cdMs: number;
  lifeMs: number;
  slot: number;
  /** Aim angle, for drawing (a strafing fighter's heading). */
  aim: number;
  /** A puppet risen from an elite (Court of Puppets) hits harder. */
  elite?: boolean;
  /** Foes a speeder bike's run already hit. */
  hit?: number[];
}

/** One of Triad-77's battle bots: its health (0 while down) and most health, ms until it is rebuilt, where it stands and aims. */
export interface Bot {
  hp: number;
  max: number;
  rebuildMs: number;
  x: number;
  y: number;
  aim: number;
}

/** Elara Voss's signal flag: where it stands and ms it has left. */
export interface Flag {
  x: number;
  y: number;
  ms: number;
  maxMs: number;
}

/** Power-ups: dropped now and then by foes after a world's first minute, each with its own effect. */
export type PowerUp = 'bomb' | 'magnet' | 'lure' | 'overdrive' | 'shield' | 'freeze' | 'cache';
export const POWER_UPS: readonly PowerUp[] = ['bomb', 'magnet', 'lure', 'overdrive', 'shield', 'freeze', 'cache'];
/**
 * Power-up numbers: the drop chance per kill (once `fromMs` of a world has passed, at most `max`
 * lying about, each gone after `lifeMs`), an elite's chance, the weight of each kind, and their
 * effects (bomb: share of a foe's health, a boss's; lure: pickup range factor; overdrive: fire
 * rate factor; shield: hits; cache: credits).
 */
export const POWER = {
  chance: 0.003, eliteChance: 0.5, fromMs: 60_000, max: 3, lifeMs: 25_000,
  weights: { bomb: 3, magnet: 3, lure: 2, overdrive: 2, shield: 2, freeze: 2, cache: 2 } as Record<PowerUp, number>,
  bombShare: 0.65, bombBoss: 0.04, bombR: 620,
  lureMs: 30_000, lure: 2.2, overdriveMs: 10_000, overdrive: 1.5, shieldHits: 3, freezeMs: 5000, cacheCredits: 20,
};

export interface Pickup {
  id: number;
  kind: 'medkit' | 'chest' | 'credits' | PowerUp;
  /** Ms a power-up has left on the ground (0 for the others, which stay). */
  ms?: number;
  x: number;
  y: number;
  heal: number;
  /** Credits in it (credits only). */
  value: number;
}

/**
 * Something on the ground that hurts or slows the hero: a bog pool, a lava vent or artillery shell
 * (a warning, then a blast), a stomp, an expanding ring of fire with gaps, or embers.
 */
export interface Hazard {
  id: number;
  kind: 'bog' | 'vent' | 'shell' | 'stomp' | 'ring' | 'ember' | 'spore' | 'strike';
  x: number;
  y: number;
  r: number;
  /** Ms of warning left before it goes off (blasts), and ms it lasts after. */
  warnMs: number;
  ms: number;
  maxMs: number;
  dmg: number;
  /** A ring's turn, for where its gaps are; whether it already hit the hero. */
  angle: number;
  hit: boolean;
}

/** Floating text: damage numbers are left out, names of unlocks and level-ups are shown. */
export interface Pop {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  ms: number;
}

/**
 * `cleared` (a boss or the arena is done) and `travel` (on to the next planet) only last until the
 * next frame (the scene settles `travel` from a panel at once); `chart` is the space map (where to
 * jump next), `map` the star map on the way there, `trader` and `event` its nodes.
 */
export type Phase = 'select' | 'run' | 'levelup' | 'cleared' | 'chart' | 'map' | 'trader' | 'event' | 'travel' | 'won' | 'lost';

/** An event on offer: its id, its two options and, for the shrine, the tier it takes and the one it raises twice. */
export interface EventState {
  id: EventId;
  /** Keys of `i18n/en.ts`; the shrine's trade text names `lose` and `gain` with `{lose}` and `{gain}`. */
  title: TextKey;
  text: TextKey;
  options: { label: TextKey; text: TextKey }[];
  lose?: string;
  gain?: string;
}

export interface Hero {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** The way the hero last moved (radians); Bram fires this way, the Riot Shield faces it. */
  facing: number;
  /** The way the primary weapon last fired, for drawing. */
  aim: number;
  moving: boolean;
  /** Signature cooldown left and how long its effect still lasts, ms. */
  sigMs: number;
  sigActiveMs: number;
  /** Primary weapon cooldown, and which pistol fires next (Rook). */
  fireMs: number;
  side: number;
  /** Primary shots fired, for every 4th heavy round. */
  shots: number;
  /** A jet dash in progress: ms left and its heading. */
  dashMs: number;
  dashAngle: number;
  /** Ms of the hurt flash. */
  hurtMs: number;
  /** Health regenerated but not yet whole. */
  regen: number;
  /** Slowed (by a glob or a bog pool): ms left and how much. */
  slowMs: number;
  slowPct: number;
  /** Body radius, px. */
  r: number;
  /** A dash: 'jet' (Bram), 'blade' (cuts through foes), 'leap' and 'hunt' (onto `dashTarget`). */
  dashKind: 'jet' | 'blade' | 'leap' | 'hunt';
  dashSpeed: number;
  dashDmg: number;
  dashTarget: number;
  /** Foes this dash (and its chained hops) already cut, and hops left. */
  dashHit: number[];
  chain: number;
  /** Kael's Temper, 0 to 100. */
  temper: number;
  /** A barrier that takes hits first (Life Support, the Council ward); ms since the last hit. */
  barrier: number;
  barrierMs: number;
  /** Hits landed (Joren's Edge), ms standing still (Stillness, Vantage) and ms of Oom's push charged. */
  hits: number;
  stillMs: number;
  charge: number;
  /** Kael's kill streak (Perfect Form): kills, ms since the last, and ms of form left. */
  streak: number;
  streakMs: number;
  formMs: number;
  /** Kresh: times risen (Rebuilt) and ms of his kill speed boost. */
  rises: number;
  hasteMs: number;
  /** Unbreakable used on this planet. */
  saved: boolean;
}

export interface GameState {
  phase: Phase;
  hero: HeroId | null;
  /** The run's rift heat, 0 (as designed) to `MAX_HEAT` (see `heat.ts`). */
  heat: number;
  /** The Armoury ranks the run started with (see `armoury.ts`). */
  perks: Partial<Record<ArmouryId, number>>;
  /** Whether the Field Briefing's fourth card has been dealt, and whether this trader's reroll is free (Spare Reroll). */
  briefed: boolean;
  freeReroll: boolean;
  /** The weekly run's week (-1 for any other run) and its mutators (see `weekly.ts`). */
  week: number;
  mutators: MutatorId[];
  /** Where the weekly run's seeded `Math.random` stood when the run was saved (`rngAt`, -1 for none). */
  rng: number;
  /**
   * The planet (an index into `PLANETS`: 0 Dune, 1 Swamp, 2 Ice, 3 Lava, then the later ones) and
   * the jump of the crusade it is (`stage`, 0 to 3), and whether this is the elite arena after it.
   */
  planet: number;
  stage: number;
  /** The planets visited so far, in order, and the one chosen on the space map for the next jump. */
  route: number[];
  next: number;
  arena: boolean;
  /** Planet (or arena) time in ms; the boss comes at RUN_MS. */
  time: number;
  /** The whole run's time, every planet and arena, ms. */
  runMs: number;
  player: Hero;
  level: number;
  xp: number;
  xpNext: number;
  /** Level-ups earned but not yet chosen, and free picks won (the arena), chosen first. */
  pendingLevels: number;
  rewardPicks: number;
  /** Where the run goes once the cards are chosen. */
  after: 'run' | 'chart' | 'map' | 'travel';
  /** Tiers of each held upgrade, by id (paths, pool skills and gear). */
  ranks: Record<string, number>;
  /** Unlocked capstones and completed crossovers, by id. */
  capstones: string[];
  crossovers: string[];
  /** The cards on offer during a level-up (upgrade ids, or the filler). */
  choices: string[] | null;
  /** Cooldowns of the abilities, ms, by name. */
  cd: Record<string, number>;
  enemies: Enemy[];
  bullets: Bullet[];
  shards: Shard[];
  blasts: Blast[];
  bombs: Bomb[];
  fires: Fire[];
  allies: Ally[];
  pickups: Pickup[];
  hazards: Hazard[];
  pops: Pop[];
  /** Spawning: fractional bots owed, the next elite and ring wave times. */
  spawnDebt: number;
  nextElite: number;
  waves: number[];
  bossSpawned: boolean;
  /** When the next lava vent erupts (Lava world) or lightning strikes (Storm world). */
  nextVent: number;
  /** Credits to spend at a trader. */
  credits: number;
  /** The star map's nodes, the trader's offers (null once sold) and the event on offer. */
  nodes: NodeKind[];
  offers: (string | null)[];
  event: EventState | null;
  /** The stranded bot flies with the hero on the next planet. */
  escort: boolean;
  /** Max health kept after the cache's cost (1 = all of it). */
  maxHpMod: number;
  /** How much further the view's corners reach than 960x540's, px, set at `startRun`; the spawn ring moves out by it. */
  ringOut: number;
  /** Whether every arena elite fell. */
  arenaWon: boolean;
  /** Counts for the end screen and the test. */
  kills: number;
  elitesKilled: number;
  chests: number;
  damageTaken: number;
  /** Signature uses this run. */
  signatures: number;
  nextId: number;
  /** The knights' swings and lightning on screen. */
  slashes: Slash[];
  zaps: Zap[];
  /** The foe Kresh hunts (its id, 0 for none). */
  mark: number;
  /** Corvin's raised platform (Vantage). */
  platform: { x: number; y: number; r: number } | null;
  /** Hits taken from spitter toad globs on this planet, and whether the Swamp was cleared with few. */
  globHits: number;
  cleanSwamp: boolean;
  /** Elite arenas won this run. */
  arenaWins: number;
  /** Heroes unlocked before this run, and the ones whose deeds this run did. */
  known: HeroId[];
  deeds: HeroId[];
  /** Elara Voss's signal flag, and the planet her last Uprising supply drop fell on (-1 none). */
  flag: Flag | null;
  supplyWorld: number;
  /** The side objective under way, when the next one starts (ms of world time), how many this world has had, and the shared ones seen this run. */
  objective: Objective | null;
  objectiveAt: number;
  objectiveSlot: number;
  sharedSeen: ObjectiveId[];
  objectivesDone: number;
  /** Hits dealt this run (some hero objectives count them). */
  hits: number;
  /** Power-ups running: ms of Lure and Overdrive left, hits the shield still blocks. */
  lureMs: number;
  overdriveMs: number;
  shieldHits: number;
  /** Power-ups picked up this run. */
  powerUps: number;
  /** Triad-77: its bots, their formation, and scrap gathered from kills (Factory). */
  bots: Bot[];
  formation: 'spread' | 'column';
  scrap: number;
}

export function freshHero(): Hero {
  return {
    x: 0, y: 0, hp: 100, maxHp: 100, facing: 0, aim: 0, moving: false,
    sigMs: 0, sigActiveMs: 0, fireMs: 400, side: 0, shots: 0, dashMs: 0, dashAngle: 0, hurtMs: 0, regen: 0,
    slowMs: 0, slowPct: 0, r: HERO_R, dashKind: 'jet', dashSpeed: 750, dashDmg: 0, dashTarget: 0, dashHit: [], chain: 0,
    temper: 0, barrier: 0, barrierMs: 0, hits: 0, stillMs: 0, charge: 0, streak: 0, streakMs: 0, formMs: 0, rises: 0, hasteMs: 0,
    saved: false,
  };
}

/** When a ring of bots closes in, on every planet, ms. */
export const WAVES = [90_000, 180_000, 255_000];

/** The hero select screen: no run yet. */
export function freshState(): GameState {
  return {
    phase: 'select',
    hero: null,
    heat: 0,
    perks: {},
    briefed: false,
    freeReroll: false,
    week: -1,
    mutators: [],
    rng: -1,
    planet: 0,
    stage: 0,
    route: [0],
    next: -1,
    arena: false,
    time: 0,
    runMs: 0,
    player: freshHero(),
    level: 1,
    xp: 0,
    xpNext: xpFor(1),
    pendingLevels: 0,
    rewardPicks: 0,
    after: 'run',
    ranks: {},
    capstones: [],
    crossovers: [],
    choices: null,
    cd: {},
    enemies: [],
    bullets: [],
    shards: [],
    blasts: [],
    bombs: [],
    fires: [],
    allies: [],
    pickups: [],
    hazards: [],
    pops: [],
    spawnDebt: 0,
    nextElite: ELITE.first,
    waves: [...WAVES],
    bossSpawned: false,
    nextVent: 0,
    credits: 0,
    nodes: [],
    offers: [],
    event: null,
    escort: false,
    maxHpMod: 1,
    ringOut: 0,
    arenaWon: false,
    kills: 0,
    elitesKilled: 0,
    chests: 0,
    damageTaken: 0,
    signatures: 0,
    nextId: 1,
    slashes: [],
    zaps: [],
    mark: 0,
    platform: null,
    globHits: 0,
    cleanSwamp: false,
    arenaWins: 0,
    known: [],
    deeds: [],
    flag: null,
    supplyWorld: -1,
    objective: null,
    objectiveAt: OBJECTIVE_AT[0],
    objectiveSlot: 0,
    sharedSeen: [],
    objectivesDone: 0,
    hits: 0,
    lureMs: 0,
    overdriveMs: 0,
    shieldHits: 0,
    powerUps: 0,
    bots: [],
    formation: 'spread',
    scrap: 0,
  };
}

/** XP needed to go from `level` to the next. */
export function xpFor(level: number) {
  return 5 + 2 * level + Math.floor((level * level) / 3);
}

/** The hero's numbers from their base and the upgrades held. */
export interface Stats {
  speed: number;
  pickup: number;
  armour: number;
  maxHp: number;
  regen: number;
  cooldown: number;
  damage: number;
  xp: number;
  crit: number;
  fireRate: number;
  pierce: number;
  bounces: number;
  seek: boolean;
  slowPct: number;
  slowMs: number;
  /** How far the knights' attacks reach (1 = as drawn), dodge chance and the signature's cooldown factor. */
  reach: number;
  dodge: number;
  sigCooldown: number;
  /** Threat Scanner: damage to elites and bosses. Executioner: foes left under this share of health fall. */
  bossDmg: number;
  execute: number;
  /** Health back for each kill (Soul Harvest) and the share of credits picked up (Salvage Rig). */
  harvest: number;
  creditMul: number;
}

/** Whether the hero stands on Corvin's raised platform. */
export function onPlatform(s: GameState) {
  const pl = s.platform;
  return !!pl && Math.hypot(s.player.x - pl.x, s.player.y - pl.y) <= pl.r;
}

/** Kael's Temper is full. */
export const fullTemper = (s: GameState) => s.hero === 'kael' && s.player.temper >= 100;

export function statsOf(s: GameState): Stats {
  const hero = HEROES[s.hero ?? 'rook'];
  const r = (id: string) => s.ranks[id] ?? 0;
  const cap = (id: string) => s.capstones.includes(id);
  const cross = (id: string) => s.crossovers.includes(id);
  let fireRate = 1 + at([0.1, 0.2, 0.3, 0.4, 0.55], r('reload'), 0) + (r('gunslinger') >= 1 ? 0.15 : 0);
  if (cap('twin-storm')) fireRate += 0.3;
  const overdrive = s.overdriveMs > 0 ? POWER.overdrive : 1;
  let pierce = at([1, 1, 2, 2, 3], r('overcharge'), 0) + at([1, 1, 3, 3, 5], r('marksman'), 0);
  if (cap('longshot')) pierce = 999;
  const bounces = at([1, 2, 2, 3, 4], r('ricochet'), 0) + (r('gunslinger') >= 2 ? 1 : 0) + (r('gunslinger') >= 5 ? 1 : 0);
  const k = s.hero ? knightMods(s) : NO_MODS;
  const q = squadMods(s);
  const d = drillMods(s);
  fireRate += q.fireRate + d.fireRate;
  if (pierce < 999) pierce += q.pierce;
  // Adrenal Stim: faster and harder while health is low.
  const p = s.player;
  const stim = p.maxHp > 0 && p.hp < p.maxHp * 0.4 ? at([0.1, 0.15, 0.2, 0.25, 0.3], r('stim'), 0) : 0;
  const mut = (id: MutatorId) => s.mutators.includes(id);
  return {
    speed: hero.speed * (1 + 0.08 * r('boots')) * k.speed * (1 + d.speed + stim) * (mut('haste') ? MUT.haste : 1),
    pickup: PICKUP_R * (1 + 0.3 * r('magnet') + PERK.lens * (s.perks.lens ?? 0)) * (s.lureMs > 0 ? POWER.lure : 1),
    armour: 0.08 * r('armour') + k.armour + d.armour,
    maxHp: s.hero === 'triad' ? botMax(s) * botCount(s) : Math.round((hero.maxHp + 10 * r('armour') + k.hp + d.hp) * s.maxHpMod),
    regen: mut('vampire') ? 0 : 0.5 * r('medpack') + k.regen + d.regen,
    cooldown: 1 - 0.07 * r('overclock'),
    damage:
      (1 + 0.1 * r('cell')) * (1 + at([0, 0.1, 0.1, 0.2, 0.2], r('overcharge'), 0)) * (1 + at([0, 0.25, 0.25, 0.25, 0.75], r('marksman'), 0)) * k.damage * q.damage *
      (1 + d.damage) * (1 + stim) * (mut('glass') ? MUT.glassDmg : 1),
    xp: 1 + 0.1 * r('lens'),
    crit: 0.06 * r('chip') + k.crit + d.crit,
    fireRate: fireRate * overdrive,
    pierce,
    bounces,
    seek: cross('seeking-ricochets'),
    slowPct: at([0.25, 0.3, 0.35, 0.4, 0.5], r('stun'), 0),
    slowMs: r('stun') >= 3 ? 2000 : 1500,
    reach: k.reach,
    dodge: k.dodge,
    sigCooldown: (1 - 0.07 * r('overclock')) * k.sig * q.sig * (1 - d.sig) * (mut('overcharged') ? MUT.overcharged : 1),
    bossDmg: 1 + 0.1 * r('scanner'),
    execute: at([0.08, 0.1, 0.12, 0.15, 0.18], r('executioner'), 0),
    harvest: at([0.4, 0.6, 0.8, 1, 1.3], r('soul-harvest'), 0),
    creditMul: 1 + 0.2 * r('salvager'),
  };
}

/** What the hero's drill (its fourth path) adds so far: the sum of its steps up to its tier. */
function drillMods(s: GameState) {
  const out = { damage: 0, hp: 0, armour: 0, speed: 0, crit: 0, regen: 0, sig: 0, fireRate: 0 };
  if (!s.hero) return out;
  const drill = DRILLS[s.hero];
  const tier = s.ranks[drill.id] ?? 0;
  for (let i = 0; i < tier; i++) {
    const step = DRILL_STEPS[drill.steps[i]];
    for (const key of Object.keys(step) as (keyof typeof out)[]) out[key] += step[key] ?? 0;
  }
  return out;
}

/** How many battle bots Triad-77 fields: three, more on the Firing Line, eight with Endless Ranks. */
export function botCount(s: GameState) {
  if (s.capstones.includes('endless-ranks')) return 8;
  const fl = s.ranks['firing-line'] ?? 0;
  return 3 + (fl >= 2 ? 1 : 0) + (fl >= 4 ? 1 : 0);
}

/** Each of Triad-77's bots' health: a third of the hero's, and a third of each armour tier's. */
export function botMax(s: GameState) {
  return Math.round(((HEROES.triad.maxHp + 10 * (s.ranks.armour ?? 0)) / 3) * s.maxHpMod);
}

/** What Elara Voss's and Triad-77's paths add to the stats (all neutral for anyone else). */
function squadMods(s: GameState) {
  const r = (id: string) => s.ranks[id] ?? 0;
  const mods = { fireRate: 0, pierce: 0, damage: 1, sig: 1 };
  if (s.hero === 'elara') {
    mods.pierce += (r('sharpshooter') >= 2 ? 1 : 0) + (r('sharpshooter') >= 5 ? 2 : 0);
    mods.fireRate += r('sharpshooter') >= 5 ? 0.25 : 0;
    mods.sig *= r('diplomat') >= 3 ? 0.8 : 1;
  } else if (s.hero === 'triad') {
    mods.fireRate += at([0.2, 0.2, 0.2, 0.2, 0.45], r('firing-line'), 0) + (r('uplink') >= 1 ? 0.15 : 0);
    mods.pierce += r('firing-line') >= 3 ? 1 : 0;
    mods.damage *= r('uplink') >= 4 ? 1.25 : 1;
  }
  return mods;
}

const NO_MODS = { speed: 1, armour: 0, hp: 0, regen: 0, damage: 1, crit: 0, reach: 1, dodge: 0, sig: 1 };

/** What the knights' pools and paths add to the stats (all neutral for a soldier). */
function knightMods(s: GameState) {
  if (!isKnight(s.hero!)) return NO_MODS;
  const hero = HEROES[s.hero!];
  const p = s.player;
  const r = (id: string) => s.ranks[id] ?? 0;
  const cap = (id: string) => s.capstones.includes(id);
  const low = p.maxHp > 0 && p.hp < p.maxHp * 0.3;
  // Battle Trance: quicker on the feet.
  let speed = 1 + at([0.05, 0.08, 0.11, 0.14, 0.18], r('battle-trance'), 0);
  let damage = 1 + (r('wide-arc') >= 5 ? 0.2 : 0);
  let reach = 1 + at([0.15, 0.3, 0.45, 0.6, 0.8], r('wide-arc'), 0);
  let sig = 1 - 0.1 * r('calm-mind');
  // Rage: up to its bonus as health runs out (all of it at full Temper with Fury Unbound).
  const missing = p.maxHp > 0 ? Math.max(0, 1 - p.hp / p.maxHp) : 0;
  const rage = s.crossovers.includes('fury-unbound') && fullTemper(s) ? 1 : missing;
  damage *= 1 + at([0.15, 0.3, 0.45, 0.6, 0.75], r('rage'), 0) * rage;
  if (s.hero === 'kael') {
    reach += r('prodigy') >= 1 ? 0.25 : 0;
    if (r('the-fall') >= 4) speed *= 1.15;
    if (cap('hollow-rebirth')) speed *= 0.85;
    // Temper: up to +25% damage, or double at full Temper on The Fall.
    damage *= fullTemper(s) && r('the-fall') >= 2 ? 2 : 1 + 0.25 * (p.temper / 100);
  } else if (s.hero === 'vharn') {
    if (low) damage *= 1 + at([0, 0, 0.4, 0.4, 0.8], r('life-support'), 0);
  } else if (s.hero === 'oom') {
    if (r('whirlwind') >= 4) sig *= 0.7;
  } else if (s.hero === 'corvin') {
    if (onPlatform(s)) {
      damage *= 1 + at([0.2, 0.2, 0.4, 0.4, 0.6], r('vantage'), 0);
      reach += at([0, 0.2, 0.2, 0.2, 0.4], r('vantage'), 0);
    }
  } else if (s.hero === 'veyl') {
    damage *= 1 + at([0.3, 0.3, 0.5, 0.5, 0.8], r('dark-bargain'), 0);
    if (r('storm') >= 4) damage *= 1.3;
  } else if (s.hero === 'kresh') {
    if (p.rises > 0) speed *= r('rebuilt') >= 5 ? 1.25 : 1.2;
    if (p.hasteMs > 0) speed *= 1.15;
    if (r('stalker') >= 4) sig *= 0.7;
    if (cap('steel-strider')) damage *= 1 + 0.25 * p.rises;
  } else if (s.hero === 'joren') {
    if (r('breaker') >= 5) sig *= 0.6;
  }
  return {
    speed,
    armour: (hero.armour ?? 0) + (cap('hollow-rebirth') ? 0.3 : 0) + at([0.04, 0.08, 0.12, 0.16, 0.2], r('iron-skin'), 0),
    hp: (r('rebuilt') >= 2 ? 20 : 0) + (cap('hollow-rebirth') ? 60 : 0) + at([10, 20, 30, 40, 60], r('iron-skin'), 0),
    regen: at([0.6, 1.2, 1.8, 2.4, 3], r('mending'), 0) + (s.hero === 'vharn' && low && r('life-support') >= 5 ? 2 : 0),
    damage,
    crit: 0.05 * r('focus'),
    reach,
    dodge: 0.06 * r('foresight') + at([0.03, 0.05, 0.07, 0.09, 0.12], r('battle-trance'), 0),
    sig,
  };
}

/** Recomputes the capstones and crossovers after a pick; returns the ones just unlocked. */
export function refreshUnlocks(s: GameState) {
  const caps = capstonesOf(s.ranks).filter((c) => c.hero === s.hero).map((c) => c.id);
  const crosses = crossoversOf(s.ranks).map((c) => c.id);
  const fresh = [...caps.filter((id) => !s.capstones.includes(id)), ...crosses.filter((id) => !s.crossovers.includes(id))];
  s.capstones = caps;
  s.crossovers = crosses;
  return fresh;
}

/** "m:ss" for a time in ms. */
export function clock(ms: number) {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------------------------
// Side objectives (see objectives.ts)

/**
 * Side objectives: four shared by every world, one per world and one per hero. Each world has
 * three, one after the other: a shared one at 1:00, the world's own at 2:15 and the hero's own at
 * 3:30, each with a time limit, and none once the boss is up.
 */
export type ObjectiveId =
  | 'defend' | 'escort' | 'beacons' | 'zone'
  | 'cache' | 'nests' | 'thaw' | 'seal'
  | 'quickdraw' | 'dropzone' | 'recon' | 'duel' | 'unbroken' | 'lift' | 'pilgrim' | 'storm' | 'bloodtrail' | 'monolith'
  | 'signal' | 'salvage';
export const SHARED_OBJECTIVES: readonly ObjectiveId[] = ['defend', 'escort', 'beacons', 'zone'];
/** Each planet's own objective, by planet index (Dune, Swamp, Ice, Lava, Spore, Scrap, Crystal, Storm). */
export const WORLD_OBJECTIVES: readonly ObjectiveId[] = ['cache', 'nests', 'thaw', 'seal', 'nests', 'cache', 'cache', 'seal'];
export const HERO_OBJECTIVES: Record<HeroId, ObjectiveId> = {
  rook: 'quickdraw', tr9: 'dropzone', bram: 'recon', kael: 'duel', vharn: 'unbroken', oom: 'lift', corvin: 'pilgrim',
  veyl: 'storm', kresh: 'bloodtrail', joren: 'monolith', elara: 'signal', triad: 'salvage',
};
/** When each of a world's three objectives starts (ms of world time). */
export const OBJECTIVE_AT = [60_000, 135_000, 210_000] as const;

export interface Objective {
  id: ObjectiveId;
  /** Where its marker is (the zone, the cache, the bot to escort), and the zone's radius (0: no marker). */
  x: number;
  y: number;
  r: number;
  /** Ms left, and the time limit. */
  ms: number;
  maxMs: number;
  /** Progress toward `goal` (held ms, a count, points reached), and a count at the start (kills, hits). */
  done: number;
  goal: number;
  base: number;
  /** A count it watches for changes (signatures used, damage taken). */
  seen: number;
  /** Spots to reach or stand at (recon, salvage, frozen troopers, vents), with ms stood there so far. */
  points: { x: number; y: number; ms: number }[];
  /** A bot to escort or a pilgrim to keep safe: where it is and its health. */
  ward: { x: number; y: number; hp: number; maxHp: number } | null;
  /** The escorted bot's goal. */
  toX: number;
  toY: number;
  /** A timer for what it does now and then (foes pushing in, vents erupting). */
  tickMs: number;
  /** The structures or the marked elite it put on the field (foe ids). */
  ids: number[];
}
