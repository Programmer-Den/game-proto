/**
 * The Rift Crusade: four jumps across ten planets, each with its own faction, wave curve and boss.
 * A run starts on the Dune world and ends on the Lava world; between them the space map offers a
 * choice of planets at each jump (`stage`). Also the numbers of the star map between fights
 * (credits, the trader, the elite arena and the events). Names and texts are keys of `i18n/en.ts`,
 * shown with `t`.
 */
import { t, type TextKey } from '../i18n';

export type BossId = 'grinder' | 'bogmother' | 'siege' | 'champion' | 'sporequeen' | 'scrapking' | 'colossus' | 'stormherald' | 'kraken' | 'warden';
/** How a boss fights: each later boss fights like one of the first four, in its own colours. */
export type BossMech = 'grinder' | 'bogmother' | 'siege' | 'champion';
export type PlanetId = 'dune' | 'swamp' | 'ice' | 'lava' | 'spore' | 'scrap' | 'crystal' | 'storm' | 'ocean' | 'ruin';

/** The swarm kinds of each faction, besides the bosses. */
export type FoeKind =
  | 'clanker' | 'rollerbomb' | 'mirerat' | 'toad' | 'linetrooper' | 'walker' | 'acolyte' | 'knight'
  | 'sporeling' | 'puffcap' | 'scrapper' | 'hauler' | 'shardling' | 'prism' | 'wisp' | 'conductor'
  | 'crab' | 'squid' | 'shade' | 'sentinel';

export interface PlanetDef {
  id: PlanetId;
  /** Which jump of the crusade it is on (0 to 3): the space map offers the planets of the next stage. */
  stage: number;
  name: TextKey;
  /** Who lives there, for the map and the end screen. */
  faction: TextKey;
  /** The HUD's kill count ("{n} bots"), and the pop when one of its elites comes. */
  foes: TextKey;
  elite: TextKey;
  /** Bot health, spawn rate and contact damage against the Dune world. */
  hp: number;
  spawn: number;
  dmg: number;
  /** The kind that fills the ring waves, and the kinds an elite can be. */
  swarm: FoeKind;
  elites: readonly FoeKind[];
  boss: BossId;
  /** Ground colours: the field, its grid and the scenery lines. */
  ground: { field: string; grid: string; deco: string };
  /** The space map's one-line hint at what waits there. */
  hint: TextKey;
}

export const PLANETS: readonly PlanetDef[] = [
  {
    id: 'dune', stage: 0, name: 'duneName', faction: 'duneFaction', foes: 'duneFoes', elite: 'duneElite', hp: 1, spawn: 1, dmg: 1,
    swarm: 'clanker', elites: ['clanker', 'rollerbomb'], boss: 'grinder', hint: 'duneHint',
    ground: { field: '#070b16', grid: '#508cff', deco: '#ffb347' },
  },
  {
    id: 'swamp', stage: 1, name: 'swampName', faction: 'swampFaction', foes: 'swampFoes', elite: 'swampElite', hp: 4, spawn: 1.25, dmg: 1.5,
    swarm: 'mirerat', elites: ['toad', 'mirerat'], boss: 'bogmother', hint: 'swampHint',
    ground: { field: '#06130f', grid: '#3ccf8e', deco: '#5fd6a0' },
  },
  {
    id: 'ice', stage: 2, name: 'iceName', faction: 'iceFaction', foes: 'iceFoes', elite: 'iceElite', hp: 7, spawn: 1.35, dmg: 1.7,
    swarm: 'linetrooper', elites: ['walker', 'linetrooper'], boss: 'siege', hint: 'iceHint',
    ground: { field: '#0a1424', grid: '#9fd4ff', deco: '#d6efff' },
  },
  {
    id: 'lava', stage: 3, name: 'lavaName', faction: 'lavaFaction', foes: 'lavaFoes', elite: 'lavaElite', hp: 14, spawn: 1.5, dmg: 2.1,
    swarm: 'acolyte', elites: ['knight', 'acolyte'], boss: 'champion', hint: 'lavaHint',
    ground: { field: '#160807', grid: '#ff6a3c', deco: '#ff8a3c' },
  },
  {
    id: 'spore', stage: 1, name: 'sporeName', faction: 'sporeFaction', foes: 'sporeFoes', elite: 'sporeElite', hp: 4, spawn: 1.2, dmg: 1.4,
    swarm: 'sporeling', elites: ['puffcap', 'sporeling'], boss: 'sporequeen', hint: 'sporeHint',
    ground: { field: '#13071a', grid: '#d36bff', deco: '#ff7ad9' },
  },
  {
    id: 'scrap', stage: 1, name: 'scrapName', faction: 'scrapFaction', foes: 'scrapFoes', elite: 'scrapElite', hp: 3.5, spawn: 1.35, dmg: 1.5,
    swarm: 'scrapper', elites: ['hauler', 'scrapper'], boss: 'scrapking', hint: 'scrapHint',
    ground: { field: '#110d09', grid: '#c98a5a', deco: '#e8b07a' },
  },
  {
    id: 'crystal', stage: 2, name: 'crystalName', faction: 'crystalFaction', foes: 'crystalFoes', elite: 'crystalElite', hp: 6.5, spawn: 1.3, dmg: 1.8,
    swarm: 'shardling', elites: ['prism', 'shardling'], boss: 'colossus', hint: 'crystalHint',
    ground: { field: '#0b0a1e', grid: '#9c7cff', deco: '#7ff5e6' },
  },
  {
    id: 'storm', stage: 2, name: 'stormWorldName', faction: 'stormFaction', foes: 'stormFoes', elite: 'stormElite', hp: 7, spawn: 1.45, dmg: 1.8,
    swarm: 'wisp', elites: ['conductor', 'wisp'], boss: 'stormherald', hint: 'stormHint',
    ground: { field: '#090c14', grid: '#ffe45c', deco: '#fff08a' },
  },
  {
    id: 'ocean', stage: 1, name: 'oceanName', faction: 'oceanFaction', foes: 'oceanFoes', elite: 'oceanElite', hp: 4, spawn: 1.25, dmg: 1.45,
    swarm: 'crab', elites: ['squid', 'crab'], boss: 'kraken', hint: 'oceanHint',
    ground: { field: '#04121c', grid: '#3cc8ff', deco: '#7fe9ff' },
  },
  {
    id: 'ruin', stage: 2, name: 'ruinName', faction: 'ruinFaction', foes: 'ruinFoes', elite: 'ruinElite', hp: 7, spawn: 1.35, dmg: 1.75,
    swarm: 'shade', elites: ['sentinel', 'shade'], boss: 'warden', hint: 'ruinHint',
    ground: { field: '#0f0d0a', grid: '#d8c08a', deco: '#9fffc8' },
  },
];

/** The last jump: the Lava world, where the Hollow Champion waits. */
export const LAST_STAGE = 3;
/** The jumps of a run, counting the first world. */
export const STAGES = LAST_STAGE + 1;

/** The planets (indices into `PLANETS`) of a stage, in the space map's order. */
export const planetsAt = (stage: number) => PLANETS.flatMap((p, i) => (p.stage === stage ? [i] : []));

/** "2/4 Swamp world": the jump and the planet. */
export const planetLabel = (stage: number, i: number, of = STAGES) => t('planetLabel', { n: stage + 1, of, planet: t(PLANETS[i].name) });

export interface BossDef {
  /** Its name ("The Grinder Crawler"), the boss bar's label and the end screen's line when it falls last. */
  name: TextKey;
  bar: TextKey;
  beaten: TextKey;
  r: number;
  hp: number;
  speed: number;
  dmg: number;
  /** Credits it leaves. */
  credits: number;
  /** How it fights, and how hard its shots, shells and blasts hit against the first of that kind. */
  mech: BossMech;
  power: number;
  /** The foe it calls in (the Grinder's and the Bog Mother's way), if not the first boss's own. */
  adds?: FoeKind;
  /** The look of its shots, if not its kind's own. */
  bolt?: 'ink';
}

export const BOSSES: Record<BossId, BossDef> = {
  grinder: { name: 'grinderName', bar: 'grinderBar', beaten: 'grinderBeaten', r: 58, hp: 2600, speed: 42, dmg: 22, credits: 30, mech: 'grinder', power: 1 },
  bogmother: { name: 'bogmotherName', bar: 'bogmotherBar', beaten: 'bogmotherBeaten', r: 60, hp: 17000, speed: 36, dmg: 24, credits: 30, mech: 'bogmother', power: 1 },
  siege: { name: 'siegeName', bar: 'siegeBar', beaten: 'siegeBeaten', r: 62, hp: 15000, speed: 32, dmg: 26, credits: 30, mech: 'siege', power: 1 },
  champion: { name: 'championName', bar: 'championBar', beaten: 'championBeaten', r: 30, hp: 58000, speed: 92, dmg: 26, credits: 0, mech: 'champion', power: 1 },
  sporequeen: {
    name: 'sporequeenName', bar: 'sporequeenBar', beaten: 'sporequeenBeaten', r: 58, hp: 16000, speed: 38, dmg: 22, credits: 30, mech: 'bogmother', power: 0.9, adds: 'sporeling',
  },
  scrapking: {
    name: 'scrapkingName', bar: 'scrapkingBar', beaten: 'scrapkingBeaten', r: 60, hp: 15000, speed: 40, dmg: 24, credits: 30, mech: 'grinder', power: 1.6, adds: 'scrapper',
  },
  colossus: { name: 'colossusName', bar: 'colossusBar', beaten: 'colossusBeaten', r: 60, hp: 14500, speed: 34, dmg: 26, credits: 30, mech: 'siege', power: 1.05 },
  stormherald: { name: 'stormheraldName', bar: 'stormheraldBar', beaten: 'stormheraldBeaten', r: 30, hp: 15000, speed: 84, dmg: 20, credits: 30, mech: 'champion', power: 0.8 },
  kraken: {
    name: 'krakenName', bar: 'krakenBar', beaten: 'krakenBeaten', r: 60, hp: 16000, speed: 40, dmg: 23, credits: 30, mech: 'grinder', power: 1, adds: 'crab', bolt: 'ink',
  },
  warden: { name: 'wardenName', bar: 'wardenBar', beaten: 'wardenBeaten', r: 62, hp: 15000, speed: 30, dmg: 26, credits: 30, mech: 'siege', power: 1.05 },
};

/** The Bog Mother: globs, young and the bog pools she leaves. */
export const BOG = { globMs: 3600, globs: 7, spawnMs: 6500, young: 6, poolMs: 2400, poolR: 62, poolLife: 8000, slow: 0.45 };
/** The Siege Walker: shell volleys, artillery barrages with ground warnings, and stomps. */
export const SIEGE = { volleyMs: 2600, barrageMs: 5200, shells: 6, warnMs: 1200, shellR: 58, shellDmg: 15, stompR: 140, stompWarn: 700, stompDmg: 20, stompMs: 3200 };
/** The Hollow Champion: blade dashes, then rings of fire with gaps below half health. */
export const CHAMPION = { dashEvery: 3000, aimMs: 650, dashSpeed: 820, ringMs: 3800, ringSpeed: 120, ringDmg: 14, ringGaps: 4 };
/** Lava vents: one erupts near the hero every so often on the Lava world, after a warning. */
export const VENT = { minMs: 5000, maxMs: 9000, warnMs: 1300, r: 70, dmg: 14, foeDmg: 40 };
/** Lightning on the Storm world: a strike near the hero every so often, after a warning; conductors call them too. */
export const STRIKE = { minMs: 4500, maxMs: 8000, warnMs: 1000, r: 48, dmg: 11, foeDmg: 30, callMs: 3600, callRange: 320 };

/**
 * The tide on the Ocean world: every `everyMs` (from `firstMs`) the sea comes in over half the
 * field, after a warning: the water's edge runs through a line `inset` px behind the hero, and
 * for `ms` the water slows the hero and speeds up the sea's own foes.
 */
export const TIDE = { firstMs: 40_000, everyMs: 60_000, warnMs: 3500, ms: 15_000, inset: 100, slow: 0.3, foeSpeed: 1.2 };
/**
 * Falling pillars on the Ruin world: every so often a pillar near the hero topples after a
 * warning, hurting what it lands on, and then lies across the way for `lifeMs`, blocking the hero
 * and every foe but the shades (and the Warden, who smashes through).
 */
export const PILLAR = { minMs: 6000, maxMs: 9500, warnMs: 1500, len: 190, r: 16, lifeMs: 24_000, dmg: 15, foeDmg: 40, max: 5 };

/** Credits: dropped by elites, left by bosses, and paid for each planet cleared. */
export const CREDITS = { elite: 6, clear: 12, arena: 20, arenaElite: 6 };

/** The elite arena between planets: this long, with this many elites to beat. */
export const ARENA_MS = 60_000;
export const arenaElites = (stage: number) => (stage >= 1 ? 3 : 2);

/** The trader: what a tier costs (more for one already held) and a reroll. */
export const TRADE = { base: 25, perTier: 10, reroll: 8 };

/** The kinds of node on the star map. */
export type NodeKind = 'trader' | 'elite' | 'rest' | 'event';
export const NODE_INFO: Record<NodeKind, { name: TextKey; text: TextKey; color: string }> = {
  trader: { name: 'traderNode', text: 'traderNodeText', color: '#ffd36b' },
  elite: { name: 'eliteNode', text: 'eliteNodeText', color: '#ff7a8a' },
  rest: { name: 'restNode', text: 'restNodeText', color: '#7dffa0' },
  event: { name: 'eventNode', text: 'eventNodeText', color: '#b48cff' },
};

/** Rest heals this share of max health. */
export const REST_HEAL = 0.5;

/** The ids of the events the star map can roll. */
export type EventId = 'bot' | 'cache' | 'shrine' | 'well';
