import type { AimMode } from './aim';
import type { DailyPlan } from './daily';
import type { FrontierId } from './frontier';
import { MAGE_BURST, MAGE_CAST_MS, MAGE_DAMAGE, type HeroClass } from './hero';
import type { Trait } from './elites';
import type { EnemyKind } from './enemies';
import type { FortId } from './forts';
import { FIRST_BREAK_MS } from './waves';
import type { GuardKind } from './guards';
import { heatRules } from './heat';
import { QUICK_RAIN, freshLegacy, type Legacy } from './legacy';
import { marchCoins } from './march';
import type { OmenId } from './omens';
import { setComplete, type RelicId } from './relics';
import type { RoadId } from './roads';
import { UPGRADES, UPGRADE_IDS, learns, type UpgradeId } from './upgrades';

// The battlefield, in the 960x540 view. Foes walk in from the right towards the barricade, and past
// it to the hero once it falls.
export const FIELD = { top: 286, bottom: 488 };
export const SPAWN_X = 1_000;
/** Where arrows leave the hero's bow. */
export const BOW = { x: 88, y: 382 };
/** A foe whose front reaches this far left has got to the hero, and the run is over. */
export const HERO_FRONT = 96;
/** The barricade's face towards the foes. */
export const BARRICADE_FRONT = 214;
/**
 * Where hired guards stand on the barricade, by their feet: one high, one low, and a third between
 * them for a hero with the Third guard slot legacy.
 */
export const GUARD_SLOTS = [
  { x: 158, y: 350 },
  { x: 158, y: 470 },
  { x: 176, y: 410 },
];
/** Guard slots every hero has; the legacy adds the third. */
export const BASE_GUARD_SLOTS = 2;

/** Experience needed to go up from `level` to the next. */
export const xpToNext = (level: number) => 8 + 6 * (level - 1);

export interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  /** Bosses only: how many health bars `maxHp` is split over. */
  bars: number;
  /** Chilled: walks and hits at (1 - slow) of its speed until `slowMs` runs out. */
  slow: number;
  slowMs: number;
  /** Burning: takes `burnDps` a second until `burnMs` runs out. */
  burnDps: number;
  burnMs: number;
  /** Whether it stands at the barricade, hitting it. */
  attacking: boolean;
  /** Counts down after each hit, for the flash. */
  hitMs: number;
  /** Shamans: time until the next healing. Bosses: time until their next move. */
  castMs: number;
  /** An elite's trait, or null for a plain foe. */
  trait: Trait | null;
  /** Bosses: whether a once-only move (the Ogre Warlord's goblin call) has been made. */
  moved?: boolean;
}

/**
 * The ranger's arrows and fireballs, the mage hero's `spell` bolts (and fire orbs, which fly as
 * fireballs), the hired mage's arcane bolts and the Troll King's rocks.
 */
export type MissileKind = 'arrow' | 'spell' | 'fireball' | 'magic' | 'rock';

export interface Missile {
  id: number;
  kind: MissileKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** The foe it homes in on, or null to fly straight on. */
  target: number | null;
  /** Foes it has hit, so a piercing arrow doesn't hit the same one twice. */
  hit: number[];
  /** How many more foes an arrow passes through, or a spell leaps on to. */
  pierce: number;
  /** Arcane bolts: the damage of their burst. */
  damage?: number;
  /** Rocks: where they were thrown from and come down, and the guard slot they are thrown at (none when no guard is hired). */
  from?: { x: number; y: number };
  to?: { x: number; y: number };
  slot?: number;
}

/**
 * Short-lived things drawn on the field: bursts, lightning, hits and deaths, an Arrow Rain landing,
 * and for each kill an "+N XP" pop (`xp`) and the experience orbs flying into the bar (`orb`). Also
 * an arrow glancing off a shield (`block`), a shaman's healing (`heal`, with the healed foes in
 * `points`), a spearman's thrust (`stab`, from the guard to the foe) and an arcane burst (`arcane`).
 */
export interface Effect {
  id: number;
  kind: 'blast' | 'fireblast' | 'bolt' | 'death' | 'crit' | 'rain' | 'xp' | 'orb' | 'block' | 'heal' | 'stab' | 'arcane' | 'rockHit' | 'call' | 'roar' | 'howl' | 'split' | 'autoPick';
  x: number;
  y: number;
  /** Blast radius, or the lightning's path (the healed foes, the thrust's two ends). */
  radius?: number;
  points?: { x: number; y: number }[];
  /** `xp` and `orb`: the experience the kill gave. `xp`: the kill streak it was part of. */
  amount?: number;
  streak?: number;
  /** `autoPick`: the upgrade the countdown took. */
  upgrade?: UpgradeId;
  ms: number;
  total: number;
}

/** An Arrow Rain volley in the air, landing on the ring around (x, y) when `ms` runs out. */
export interface Volley {
  id: number;
  x: number;
  y: number;
  ms: number;
}

/**
 * A patch of caltrops on the road, slowing and hurting foes that walk on it; `ms` is how long it
 * has lain there and `waves` how many more waves it lasts (counting the one under way).
 */
export interface Patch {
  id: number;
  x: number;
  y: number;
  ms: number;
  waves: number;
}

/**
 * A hired guard on one of the barricade's slots: its kind, level (1 to 3), time to its next attack
 * and how much longer a Troll King's rock keeps it stunned.
 */
export interface Guard {
  kind: GuardKind;
  level: number;
  cd: number;
  stunMs: number;
}

/** The fortifications bought in the breaks: see forts.ts. */
export interface Forts {
  /** The stake line's health left behind the barricade, 0 for none. */
  stakeHp: number;
  /** Whether an oil pot waits for the next foe to reach the barricade. */
  oil: boolean;
  /** Waves the lookout still widens Arrow Rain for. */
  lookout: number;
  /** The wave whose break a fortification was bought in, so each break sells one. */
  boughtWave: number;
  /** A fortification bought during a wave, set up when the next break starts. */
  queued: FortId | null;
}

/** `'won'` is the pause on the victory panel after wave 30; "Keep fighting" goes back to `'break'`. */
export type Phase = 'break' | 'fighting' | 'over' | 'won';

export interface GameState {
  // Kept from run to run: the hero's level, experience and upgrades.
  level: number;
  xp: number;
  ranks: Partial<Record<UpgradeId, number>>;
  /** Level-ups still to be picked. */
  levelUps: number;
  /** The highest wave ever cleared, and how many runs have been played. */
  bestWave: number;
  runs: number;
  /** Relics won from the relic chests after the bosses, with how many of each. */
  relics: Partial<Record<RelicId, number>>;
  /**
   * Every skill learned and a level-up taken after that: from then on the level-ups offer the base
   * skills (`BASE_SKILLS`), and the skill book counts every filler as found.
   */
  mastered: boolean;
  /** The heat this run plays at (0 to MAX_HEAT), and the highest one unlocked by lifting the siege. */
  heat: number;
  heatUnlocked: number;
  /** What retired heroes left to this one (see legacy.ts). */
  legacy: Legacy;
  /** The hero's class (see hero.ts): the ranger, or the mage once a hero has retired. */
  hero: HeroClass;
  /** The map this run is on: the vale, or the frozen pass once the siege is lifted (see frontier.ts). */
  frontier: FrontierId;
  /** The highest wave cleared on the frozen pass, and whether its wave 30 has been cleared (the pass won). */
  passBest: number;
  passWon: boolean;

  // This run.
  wave: number;
  phase: Phase;
  /** Time left in the break before the wave comes on. */
  breakMs: number;
  /** Foes of this wave still to come on, and the time until the next one does. */
  toSpawn: EnemyKind[];
  spawnMs: number;
  barricade: { hp: number; max: number };
  enemies: Enemy[];
  missiles: Missile[];
  effects: Effect[];
  /** Time until each weapon shoots again. */
  cooldown: { arrow: number; fireball: number; storm: number };
  /** The three upgrades offered for the next level-up; the battle waits until one is picked. */
  choices: UpgradeId[] | null;
  /** Time left before one of `choices` is taken at random, if none is tapped. */
  pickMs: number;
  kills: number;
  /** Arrow Rain: kills charge it up to `need`; then it can be dragged onto the field and loosed. */
  rain: { charge: number; need: number; volleys: Volley[] };
  /**
   * The kill streak: `count` kills in quick succession, each within `ms` of the last; `best` is
   * the run's longest. `bonusXp` is all the extra experience streaks gave this run.
   */
  streak: { count: number; ms: number; best: number; bonusXp: number };
  /** Caltrops: kills charge them up to `need`; then they are dragged onto the road like Arrow Rain. */
  caltrops: { charge: number; need: number; patches: Patch[] };
  /** Coins from kills this run, spent on hired guards. */
  coins: number;
  /** The guards on the barricade's two slots, or null for an empty slot. */
  guards: (Guard | null)[];
  /** The twist of the road of ten waves the hero is on; null on the first road. */
  road: RoadId | null;
  /** The two roads offered after a boss; the break waits until one is picked. */
  roadChoices: RoadId[] | null;
  /** Time left before one of `roadChoices` is taken at random. */
  roadMs: number;
  /** The relics the last boss's chest gave (two on a Hardened Road), shown during the break after it; null otherwise. */
  relicFound: RelicId[] | null;
  /** Who the ranger shoots first; kept in its own storage key, like the speed. */
  aimMode: AimMode;
  /** How much longer the Frost Giant's roar slows the ranger's shots. */
  roarMs: number;
  /** The fortifications bought in the breaks. */
  forts: Forts;
  /** The day's set run when this is the daily siege (see daily.ts), or null for the hero's own run. */
  daily: DailyPlan | null;
  /** Whether this run has lifted the siege (cleared wave 30), so going on past it never wins again. */
  won: boolean;
  /** Paid repairs bought this run; each costs more than the last. */
  repairs: number;
  /** The omen named for the coming (or current) wave, and whether it was accepted; null for none. */
  omen: { id: OmenId; accepted: boolean } | null;
  nextId: number;
}

/** Kills that charge Arrow Rain on wave 1; later waves need more (see `rainNeed` in sim.ts). */
export const RAIN_KILLS = 4;
/** Kills that charge the caltrops. */
export const CALTROP_KILLS = 6;
export const BASE_BARRICADE_HP = 200;

export const rank = (state: Pick<GameState, 'ranks'>, id: UpgradeId) => state.ranks[id] ?? 0;

/** Experience bonus of a kill streak: 5% per kill in it from two kills on, up to 50%. */
export const streakBonus = (count: number) => (count >= 2 ? Math.min(0.5, 0.05 * count) : 0);
/** How long a kill streak waits for the next kill before it ends. */
export const STREAK_MS = 2_500;

/** Everything the upgrades and relics change, worked out from their ranks and counts. */
export function stats(state: Pick<GameState, 'ranks' | 'relics' | 'heat'> & Partial<Pick<GameState, 'legacy' | 'hero'>>) {
  const r = (id: UpgradeId) => rank(state, id);
  const relic = (id: RelicId) => state.relics?.[id] ?? 0;
  const relics = state.relics ?? {};
  const heat = heatRules(state.heat ?? 0);
  // The mage's skills work like the ranger's that match them (a hero only ever has one class's), so
  // each stat adds both: Focus to Swift Draw, Ember Bolt to Fire Arrows, and so on.
  const mage = state.hero === 'mage';
  const deep = r('deepFreeze') + r('glacier');
  const pyro = r('pyromancy') + r('orbMastery');
  const fork = r('forked') + r('arc');
  return {
    /** Milliseconds between two shots of the bow (or casts of the mage's bolt). */
    shotMs: (mage ? MAGE_CAST_MS : 1_000) / (1 + 0.2 * (r('swift') + r('focus'))) / (1 + 0.1 * relic('drum')),
    damage: (mage ? MAGE_DAMAGE : 10) * (1 + 0.25 * (r('sharp') + r('potency'))) * (1 + 0.15 * relic('feather')),
    arrows: 1 + r('volley') + r('twin'),
    pierce: r('pierce'),
    /** Chain Spark: how many more foes a mage's bolt leaps on to. */
    chain: r('chain'),
    critChance: 0.1 * r('crit') + (setComplete(relics, 'warlord') ? 0.1 : 0),
    burn: r('fire') || r('ember') ? { dps: 5 * (1 + 0.5 * (r('wildfire') + r('inferno'))), ms: 3_000 } : null,
    chill: r('frost') || r('frostbolt') ? { slow: 0.35 + 0.1 * deep, ms: 1_500 + 500 * deep } : null,
    burst: r('blast')
      ? { radius: 45 + 15 * r('bigBlast'), share: 0.4 + 0.15 * r('bigBlast') }
      : mage
        ? { radius: MAGE_BURST.radius + 12 * r('nova'), share: MAGE_BURST.share + 0.1 * r('nova') }
        : null,
    fireball: r('fireball') || r('orb') ? { ms: 3_000 * 0.85 ** pyro, damage: 30 * (1 + 0.4 * pyro), radius: 70 } : null,
    storm: r('storm') || r('tempest') ? { ms: 3_500, damage: 20 * (1 + 0.25 * fork), leaps: 3 + fork } : null,
    barricadeMax: Math.round(BASE_BARRICADE_HP * (1 + 0.25 * r('timber')) * (1 + 0.3 * relic('oakheart'))),
    xpGain: (1 + 0.2 * r('lore')) * (1 + 0.15 * relic('crown')),
    /** Arrow Rain's kills to charge, as a share of the wave's (see `rainNeed` in sim.ts). */
    rainCharge: 0.8 ** relic('quiver') * (state.legacy?.rain ? QUICK_RAIN : 1),
    /** Arrow Rain hits every foe in its ring for this many times an arrow's damage. */
    rainDamage: 4 * (setComplete(relics, 'hunter') ? 1.5 : 1) * (1 + 0.25 * r('cloudburst')),
    /** Share of the barricade mended after each wave (half as much from Heat 3). */
    repair: (setComplete(relics, 'warden') ? 0.2 : 0.1) * heat.mending,
    /** Share of the barricade Mend the Barricade repairs (half as much from Heat 3). */
    mend: 0.5 * heat.mending,
    streakMs: STREAK_MS + 1_000 * relic('banner'),
    /** Shatter: arrows deal this many times their damage to a chilled foe. */
    chilledDamage: 1 + 0.2 * r('shatter'),
    /** Finishing Shot: arrows deal double damage to a foe below this share of its health. */
    finisher: 0.15 * r('finisher'),
    /** Giant Slayer: arrows and Arrow Rain deal this many times their damage to a boss. */
    bossDamage: 1 + 0.3 * (r('slayer') + r('hex')),
    /** Cloudburst: how many times wider (and taller) Arrow Rain's ring is. */
    rainRing: 1 + 0.15 * r('cloudburst'),
    /** Caltrops: the share foes on them are slowed by, and how many times an arrow's damage they take a second. */
    caltropSlow: 0.4 + 0.1 * r('barbs'),
    caltropDps: 0.8 * (1 + 0.5 * r('barbs')),
    /** Spiked Stakes: damage a second to every foe hacking at the barricade, through armour. */
    stakes: 6 * r('stakes'),
    /** Bounty Hunter: coins every kill pays on top. */
    bounty: r('bounty'),
    /** Drill Sergeant: how many times faster hired guards attack. */
    guardSpeed: 1 + 0.2 * r('drill'),
  };
}

export type Stats = ReturnType<typeof stats>;

/** Kills Arrow Rain needs to charge on a wave: four on wave 1, one more every other wave. */
export const rainNeed = (wave: number, s: Stats) => Math.max(2, Math.round((RAIN_KILLS + Math.floor((wave - 1) / 2)) * s.rainCharge));

/** The hero's level and upgrades, kept from one run to the next. */
export type Progress = Pick<
  GameState,
  'level' | 'xp' | 'ranks' | 'levelUps' | 'bestWave' | 'runs' | 'relics' | 'mastered' | 'heat' | 'heatUnlocked' | 'legacy' | 'hero' | 'frontier' | 'passBest' | 'passWon' | 'choices'
>;

/** A hero from scratch, of this class, with what retired heroes left: their first relics among the relics. */
export function freshProgress(legacy: Legacy = freshLegacy(), hero: HeroClass = 'ranger'): Progress {
  const relics: Progress['relics'] = {};
  for (const id of legacy.relics) relics[id] = (relics[id] ?? 0) + 1;
  return {
    level: 1, xp: 0, ranks: {}, levelUps: 0, bestWave: 0, runs: 0, relics, mastered: false, heat: 0, heatUnlocked: 0, legacy,
    hero, frontier: 'vale', passBest: 0, passWon: false, choices: null,
  };
}

/** The best wave the hero has cleared on a map: the vale's `bestWave`, or the frozen pass's `passBest`. */
export const bestOn = (state: Pick<GameState, 'bestWave' | 'passBest'>, frontier: FrontierId) => (frontier === 'pass' ? state.passBest : state.bestWave);

export const freshForts = (): Forts => ({ stakeHp: 0, oil: false, lookout: 0, boughtWave: 0, queued: null });

/**
 * A new run from wave 1 (or a forced march's start, with its coins), with the hero's progress kept,
 * on the map in `progress.frontier`. With a daily plan it is the daily siege's run (see daily.ts).
 */
export function newRun(progress: Progress, aimMode: AimMode = 'nearest', start = 1, daily: DailyPlan | null = null): GameState {
  const s = stats(progress);
  const barricadeMax = s.barricadeMax;
  return {
    ...progress,
    ranks: { ...progress.ranks },
    relics: { ...progress.relics },
    legacy: { ...progress.legacy, relics: [...progress.legacy.relics] },
    wave: start,
    phase: 'break',
    breakMs: FIRST_BREAK_MS,
    toSpawn: [],
    spawnMs: 0,
    barricade: { hp: barricadeMax, max: barricadeMax },
    enemies: [],
    missiles: [],
    effects: [],
    cooldown: { arrow: 0, fireball: 0, storm: 0 },
    choices: null,
    pickMs: 0,
    kills: 0,
    rain: { charge: 0, need: rainNeed(start, s), volleys: [] },
    caltrops: { charge: 0, need: CALTROP_KILLS, patches: [] },
    coins: marchCoins(start),
    guards: GUARD_SLOTS.slice(0, BASE_GUARD_SLOTS + (progress.legacy.slot ? 1 : 0)).map(() => null),
    road: null,
    roadChoices: null,
    roadMs: 0,
    streak: { count: 0, ms: 0, best: 0, bonusXp: 0 },
    relicFound: null,
    aimMode,
    roarMs: 0,
    forts: freshForts(),
    won: false,
    repairs: 0,
    omen: null,
    daily,
    nextId: 1,
  };
}

export function progressOf(state: GameState): Progress {
  const { level, xp, ranks, levelUps, bestWave, runs, relics, mastered, heat, heatUnlocked, legacy, hero, frontier, passBest, passWon, choices } = state;
  // The cards up for a pending level-up are kept too, so a reload shows the same three.
  return {
    level, xp, ranks: { ...ranks }, levelUps, bestWave, runs, relics: { ...relics }, mastered, heat, heatUnlocked,
    legacy: { ...legacy, relics: [...legacy.relics] }, hero, frontier, passBest, passWon, choices: choices && [...choices],
  };
}

/** Upgrades that can still be offered: the hero's class's, not maxed, and with what they build on already picked. */
export const offerable = (state: Pick<GameState, 'ranks'> & Partial<Pick<GameState, 'hero'>>) =>
  UPGRADE_IDS.filter((id) => {
    const u = UPGRADES[id];
    return !u.filler && learns(id, state.hero) && rank(state, id) < u.maxRank && (!u.requires || rank(state, u.requires) > 0);
  });
