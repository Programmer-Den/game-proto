// The map, champions, items and balance numbers of Lane Brawl. Plain data, free of Phaser. Names and
// texts are keys of `i18n/en.ts`, which the scene shows with `t`.

import type { TextKey } from '../i18n';

export type Team = 'blue' | 'red';
export type LaneId = 'top' | 'mid' | 'bottom';
export interface Vec {
  x: number;
  y: number;
}

/** The map is a square. Everything on red's half is blue's turned 180 degrees round the middle. */
export const WORLD = { w: 2800, h: 2800 };
/** A point turned 180 degrees round the middle of the map: where red's copy of a blue spot sits. */
export const mirror = (p: Vec): Vec => ({ x: WORLD.w - p.x, y: WORLD.h - p.y });
/** Blue spots and their red copies, in that order. */
const both = <T extends Vec>(spots: T[]): T[] => [...spots, ...spots.map((p) => ({ ...p, ...mirror(p) }))];

/** The two Nexuses: the blue team (the player's) bottom-left, the red team top-right. */
export const BASE: Record<Team, Vec> = { blue: { x: 300, y: 2500 }, red: { x: 2500, y: 300 } };

/** Each lane runs from the blue Nexus to the red one. Red walks the same lane backwards. */
export const LANES: Record<LaneId, Vec[]> = {
  top: [BASE.blue, { x: 300, y: 300 }, BASE.red],
  mid: [BASE.blue, BASE.red],
  bottom: [BASE.blue, { x: 2500, y: 2500 }, BASE.red],
};

/**
 * The river runs from the top-left corner to the bottom-right one, across the middle lane, and
 * splits each team's jungle in two. It is only scenery: units cross it at full speed.
 */
export const RIVER = { from: { x: 420, y: 420 }, to: { x: 2380, y: 2380 }, half: 62 };

export interface TowerSpot {
  team: Team;
  lane: LaneId;
  x: number;
  y: number;
}
/** Two towers per team on each lane, the blue ones closest to the blue Nexus. */
export const TOWERS: TowerSpot[] = both<TowerSpot>([
  { team: 'blue', lane: 'top', x: 300, y: 1950 },
  { team: 'blue', lane: 'top', x: 300, y: 1300 },
  { team: 'blue', lane: 'mid', x: 689, y: 2111 },
  { team: 'blue', lane: 'mid', x: 1007, y: 1793 },
  { team: 'blue', lane: 'bottom', x: 850, y: 2500 },
  { team: 'blue', lane: 'bottom', x: 1500, y: 2500 },
]).map((t, i) => (i < 6 ? t : { ...t, team: 'red', lane: t.lane === 'top' ? 'bottom' : t.lane === 'bottom' ? 'top' : 'mid' }));

// ---------------------------------------------------------------------------------------------
// The jungle: neutral camps of three kinds in each of the four quarters between the lanes and the
// river. Boars stand alone, wolves come as a pack, and the two brutes give their slayer a buff.

export type CampKind = 'boar' | 'wolf' | 'pup' | 'ember' | 'moss';
export interface CampDef {
  kind: CampKind;
  name: TextKey;
  hp: number;
  dmg: number;
  attackMs: number;
  range: number;
  radius: number;
  armor: number;
  gold: number;
  xp: number;
  respawnMs: number;
  /** The buff its slayer gets (see `BUFFS`). */
  buff?: 'ember' | 'moss';
}
export const CAMP_KINDS: Record<CampKind, CampDef> = {
  boar: { kind: 'boar', name: 'campBoar', hp: 600, dmg: 28, attackMs: 1200, range: 150, radius: 26, armor: 0, gold: 80, xp: 120, respawnMs: 60_000 },
  wolf: { kind: 'wolf', name: 'campWolf', hp: 460, dmg: 24, attackMs: 1000, range: 120, radius: 22, armor: 0, gold: 60, xp: 90, respawnMs: 60_000 },
  pup: { kind: 'pup', name: 'campPup', hp: 200, dmg: 12, attackMs: 900, range: 100, radius: 16, armor: 0, gold: 20, xp: 30, respawnMs: 60_000 },
  ember: { kind: 'ember', name: 'campEmber', hp: 1150, dmg: 40, attackMs: 1300, range: 150, radius: 30, armor: 8, gold: 100, xp: 170, respawnMs: 90_000, buff: 'ember' },
  moss: { kind: 'moss', name: 'campMoss', hp: 1150, dmg: 40, attackMs: 1300, range: 150, radius: 30, armor: 8, gold: 100, xp: 170, respawnMs: 90_000, buff: 'moss' },
};
export interface CampSpot extends Vec {
  /** The camp's kind: a wolf pack is an alpha and two pups. */
  kind: 'boar' | 'wolf' | 'ember' | 'moss';
}
/** Six camps per team's half: blue's first, then their red copies. */
export const CAMPS: CampSpot[] = both<CampSpot>([
  { kind: 'ember', x: 640, y: 1300 },
  { kind: 'boar', x: 900, y: 1520 },
  { kind: 'wolf', x: 620, y: 1850 },
  { kind: 'moss', x: 1500, y: 2160 },
  { kind: 'boar', x: 1280, y: 1900 },
  { kind: 'wolf', x: 950, y: 2180 },
]);
/** Where a wolf pack's two pups stand, from the alpha. */
export const PUPS: Vec[] = [
  { x: -46, y: 26 },
  { x: 46, y: 26 },
];

export const NEXUS_HP = 3000;
export const NEXUS_RADIUS = 48;
export const TOWER = { hp: 1400, dmg: 55, attackMs: 1000, range: 300, radius: 26, gold: 150, aggroMs: 2500 };
export const MINION = { hp: 260, dmg: 12, attackMs: 1000, range: 40, radius: 12, speed: 90, aggro: 200, gold: 19, xp: 30 };
/** Minions of a team leave their Nexus every wave, 3 per lane. */
export const WAVE_MS = 25_000;

export const START_GOLD = 400;
/** Gold every champion earns just by being alive. */
export const GOLD_PER_SEC = 1.5;
/** Champion kills pay gold and XP to the killer. */
export const KILL = { gold: 300, xp: 200 };
/** An assist: an enemy champion that hurt the slain champion within `windowMs` of its death, but did not land the kill, gets `gold`. */
export const ASSIST = { windowMs: 10_000, gold: 120 };
/** XP needed to reach each level: index 0 is level 1. */
export const XP_FOR_LEVEL = [0, 280, 660, 1140, 1720, 2600, 3700, 5000];
export const MAX_LEVEL = XP_FOR_LEVEL.length;
/** Minion and camp XP reaches champions within this distance. */
export const XP_RANGE = 900;

/** How far a champion looks for an enemy to fight, and how far a minion does. */
export const CHAMP_AGGRO = 360;
export const RESPAWN_BASE_MS = 6000;
export const RESPAWN_PER_LEVEL_MS = 1000;

// ---------------------------------------------------------------------------------------------
// Fog of war: each team sees only what lies within sight of one of its own units. Structures are
// always seen; champions, minions and the jungle are hidden anywhere else.

export const SIGHT = { champion: 360, minion: 240, tower: 440, inhibitor: 260, nexus: 520, watchstone: 560, ward: 420 } as const;

/**
 * Watchstones: standing stones on the river. A team whose champions stand by one with no enemy
 * champion near takes it after a few seconds, and then sees far around it.
 */
export const WATCHSTONES: Vec[] = [
  { x: 850, y: 850 },
  { x: 1200, y: 1200 },
  { x: 1600, y: 1600 },
];
export const WATCH = { radius: 150, captureMs: 3000 };

// ---------------------------------------------------------------------------------------------
// Champions: fifteen classes, each with a passive and four abilities.

export type AbilityKey = 'Q' | 'W' | 'E' | 'R';
export const ABILITY_KEYS: AbilityKey[] = ['Q', 'W', 'E', 'R'];
/**
 * How an ability works. `burst` hits enemies around a point (or around the caster when its range is
 * 0), `bolt` fires projectiles, `dash` moves the caster and hits around where it lands, `ally`
 * heals, shields and buffs allied champions around a point, `buff` strengthens the caster for a
 * while, and `zone` leaves a patch on the ground that hurts enemies standing in it.
 */
export type AbilityKind = 'burst' | 'bolt' | 'dash' | 'ally' | 'buff' | 'zone';

/** A stat change that lasts a while, from an ability, a passive or a jungle buff. Percents unless noted. */
export interface BuffDef {
  /** Faster attacks. */
  atk?: number;
  /** More damage from attacks and abilities. */
  dmg?: number;
  /** Faster walking. */
  speed?: number;
  /** Health back from attack damage dealt. */
  lifesteal?: number;
  /** Flat armor. */
  armor?: number;
  /** Shorter ability cooldowns. */
  cdr?: number;
  /** Health back per second, flat. */
  regen?: number;
  /** Attacks slow what they hit for this many ms. */
  slowHit?: number;
  /** Unseen by enemies that are not right next to it; attacking or casting ends it. */
  stealth?: boolean;
}

export interface AbilityDef {
  key: AbilityKey;
  name: TextKey;
  kind: AbilityKind;
  /** Cooldown in ms. */
  cd: number;
  /** burst, ally and zone: how far the centre may be from the caster (0 centres on the caster). bolt and dash: distance. */
  range: number;
  /** Pixels around the centre (burst, ally, zone) or where a dash lands (dash). */
  radius?: number;
  damage?: number;
  heal?: number;
  shield?: number;
  /** Slow in ms for champions and minions hit. */
  slow?: number;
  /** Stun in ms for champions and minions hit. */
  stun?: number;
  /** Bolt speed in pixels per second. */
  speed?: number;
  /** Hit distance around a bolt. */
  width?: number;
  /** A bolt goes through every enemy on its way. */
  pierce?: boolean;
  /** Bolts fired at once, spread over `spread` radians. */
  count?: number;
  spread?: number;
  /** A bolt drags the first champion or minion it hits to the caster. */
  pull?: boolean;
  /** A burst pushes what it hits this many pixels away from its centre. */
  knock?: number;
  /** Double damage to a target below this share of its health. */
  executeBelow?: number;
  /** zone: damage per second to enemies inside. */
  dps?: number;
  /** buff and zone: how long it lasts, in ms (ally: how long its buff lasts). */
  ms?: number;
  /** buff and ally: the stat change it gives. */
  buff?: BuffDef;
  /** Champion level needed to cast. */
  level: number;
}

/** What a champion always has. */
export interface PassiveDef {
  name: TextKey;
  desc: TextKey;
  /** Percent less damage taken. */
  tough?: number;
  /** Every Nth attack hits for `critMult` times its damage. */
  critEvery?: number;
  critMult?: number;
  /** Percent faster walking for `hasteMs` after each attack. */
  haste?: number;
  hasteMs?: number;
  /** Percent more ability damage. */
  spellpower?: number;
  /** Allied champions within `auraRadius` (and the caster) heal this much per second. */
  aura?: number;
  auraRadius?: number;
  /** Percent of attack damage dealt healed back. */
  lifesteal?: number;
  /** Flat health back per second. */
  regen?: number;
  /** Attacks slow what they hit for this many ms. */
  slowHit?: number;
  /** The first attack after a while out of a fight hits for this many times its damage. */
  ambush?: number;
  /** Attacks also hit enemies within `splashRadius` of the target for this percent. */
  splash?: number;
  splashRadius?: number;
}

/** A small edge from a champion's story, on top of the class's passive. Percents. */
export interface StoryPerk {
  /** One line for the pick screen. */
  desc: TextKey;
  /** More damage to the guardian beast. */
  beastDmg?: number;
  /** Takes watchstones this much faster. */
  captureRate?: number;
  /** More gold from a bounty this champion claims. */
  bountyGold?: number;
}

export interface ChampionDef {
  id: string;
  /** The class's name: Warden, Blade... */
  name: TextKey;
  role: TextKey;
  /** The champion who plays the class: one character, the same in every match. Its key is the unit's `name`. */
  hero: TextKey;
  /** The first name, for the portrait, notices and labels over the head. */
  short: string;
  /** What the bards call them, for the pick screen. */
  title: TextKey;
  /** Why they fight in Kessmoor, one line for the pick screen (90 characters at most). */
  motive: TextKey;
  /** One line on how the class plays, after the class's name under the pick cards (lower case). */
  blurb: TextKey;
  perk?: StoryPerk;
  color: string;
  hp: number;
  hpPerLevel: number;
  dmg: number;
  dmgPerLevel: number;
  armor: number;
  range: number;
  speed: number;
  attackMs: number;
  passive: PassiveDef;
  /** Q, W, E, R in that order. */
  abilities: AbilityDef[];
}

export const CHAMPIONS: ChampionDef[] = [
  {
    id: 'warden',
    name: 'wardenName',
    role: 'roleTank',
    hero: 'wardenHero',
    short: 'Hald',
    title: 'wardenTitle',
    motive: 'wardenMotive',
    blurb: 'wardenBlurb',
    color: '#c98b3b',
    hp: 640,
    hpPerLevel: 95,
    dmg: 48,
    dmgPerLevel: 3.5,
    armor: 6,
    range: 110,
    speed: 120,
    attackMs: 900,
    passive: { name: 'wardenPassive', desc: 'wardenPassiveDesc', tough: 15 },
    abilities: [
      { key: 'Q', name: 'wardenQ', kind: 'burst', cd: 6000, range: 0, radius: 170, damage: 80, slow: 1500, level: 1 },
      { key: 'W', name: 'wardenW', kind: 'ally', cd: 10000, range: 350, radius: 120, shield: 130, level: 1 },
      { key: 'E', name: 'wardenE', kind: 'dash', cd: 9000, range: 280, radius: 110, damage: 60, stun: 400, level: 1 },
      { key: 'R', name: 'wardenR', kind: 'burst', cd: 60000, range: 0, radius: 240, damage: 160, slow: 2000, level: 3 },
    ],
  },
  {
    id: 'blade',
    name: 'bladeName',
    role: 'roleAssassin',
    hero: 'bladeHero',
    short: 'Vesna',
    title: 'bladeTitle',
    motive: 'bladeMotive',
    blurb: 'bladeBlurb',
    color: '#8e6cf0',
    hp: 570,
    hpPerLevel: 80,
    dmg: 60,
    dmgPerLevel: 4,
    armor: 3,
    range: 120,
    speed: 150,
    attackMs: 700,
    passive: { name: 'bladePassive', desc: 'bladePassiveDesc', critEvery: 3, critMult: 2 },
    abilities: [
      { key: 'Q', name: 'bladeQ', kind: 'dash', cd: 5000, range: 260, radius: 90, damage: 85, level: 1 },
      { key: 'W', name: 'bladeW', kind: 'burst', cd: 8000, range: 0, radius: 130, damage: 70, level: 1 },
      { key: 'E', name: 'bladeE', kind: 'dash', cd: 12000, range: 240, level: 1 },
      { key: 'R', name: 'bladeR', kind: 'burst', cd: 60000, range: 280, radius: 60, damage: 190, executeBelow: 0.4, level: 3 },
    ],
  },
  {
    id: 'archer',
    name: 'archerName',
    role: 'roleMarksman',
    hero: 'archerHero',
    short: 'Tamsin',
    title: 'archerTitle',
    motive: 'archerMotive',
    blurb: 'archerBlurb',
    color: '#e6c03a',
    hp: 490,
    hpPerLevel: 72,
    dmg: 56,
    dmgPerLevel: 4,
    armor: 2,
    range: 420,
    speed: 135,
    attackMs: 800,
    passive: { name: 'archerPassive', desc: 'archerPassiveDesc', haste: 30, hasteMs: 1500 },
    abilities: [
      { key: 'Q', name: 'archerQ', kind: 'bolt', cd: 4500, range: 700, speed: 900, width: 26, damage: 80, pierce: true, level: 1 },
      { key: 'W', name: 'archerW', kind: 'bolt', cd: 9000, range: 600, speed: 800, width: 24, damage: 45, count: 3, spread: 0.2, level: 1 },
      { key: 'E', name: 'archerE', kind: 'dash', cd: 10000, range: 180, level: 1 },
      { key: 'R', name: 'archerR', kind: 'zone', cd: 60000, range: 650, radius: 230, dps: 75, ms: 2500, slow: 800, level: 3 },
    ],
  },
  {
    id: 'mage',
    name: 'mageName',
    role: 'roleBurst',
    hero: 'mageHero',
    short: 'Elowen',
    title: 'mageTitle',
    motive: 'mageMotive',
    blurb: 'mageBlurb',
    color: '#3fd0d9',
    hp: 480,
    hpPerLevel: 66,
    dmg: 44,
    dmgPerLevel: 3,
    armor: 2,
    range: 400,
    speed: 130,
    attackMs: 900,
    passive: { name: 'magePassive', desc: 'magePassiveDesc', spellpower: 20 },
    abilities: [
      { key: 'Q', name: 'mageQ', kind: 'bolt', cd: 4000, range: 650, speed: 750, width: 30, damage: 95, level: 1 },
      { key: 'W', name: 'mageW', kind: 'burst', cd: 9000, range: 0, radius: 170, damage: 65, slow: 1800, level: 1 },
      { key: 'E', name: 'mageE', kind: 'dash', cd: 12000, range: 230, level: 1 },
      { key: 'R', name: 'mageR', kind: 'burst', cd: 60000, range: 600, radius: 220, damage: 210, level: 3 },
    ],
  },
  {
    id: 'priest',
    name: 'priestName',
    role: 'roleSupport',
    hero: 'priestHero',
    short: 'Maren',
    title: 'priestTitle',
    motive: 'priestMotive',
    blurb: 'priestBlurb',
    color: '#6fe07f',
    hp: 480,
    hpPerLevel: 68,
    dmg: 32,
    dmgPerLevel: 2.5,
    armor: 2,
    range: 380,
    speed: 135,
    attackMs: 1000,
    passive: { name: 'priestPassive', desc: 'priestPassiveDesc', aura: 2, auraRadius: 320 },
    abilities: [
      { key: 'Q', name: 'priestQ', kind: 'bolt', cd: 4000, range: 600, speed: 800, width: 26, damage: 60, level: 1 },
      { key: 'W', name: 'priestW', kind: 'ally', cd: 7000, range: 500, radius: 160, heal: 80, level: 1 },
      { key: 'E', name: 'priestE', kind: 'ally', cd: 10000, range: 500, radius: 120, shield: 90, level: 1 },
      { key: 'R', name: 'priestR', kind: 'ally', cd: 60000, range: 400, radius: 280, heal: 70, shield: 60, level: 3 },
    ],
  },
  {
    id: 'berserker',
    name: 'berserkerName',
    role: 'roleFighter',
    hero: 'berserkerHero',
    short: 'Torvik',
    title: 'berserkerTitle',
    motive: 'berserkerMotive',
    blurb: 'berserkerBlurb',
    color: '#ff8a3d',
    hp: 570,
    hpPerLevel: 85,
    dmg: 52,
    dmgPerLevel: 4.5,
    armor: 3,
    range: 115,
    speed: 125,
    attackMs: 850,
    passive: { name: 'berserkerPassive', desc: 'berserkerPassiveDesc', lifesteal: 10 },
    abilities: [
      { key: 'Q', name: 'berserkerQ', kind: 'burst', cd: 6000, range: 0, radius: 150, damage: 75, level: 1 },
      { key: 'W', name: 'berserkerW', kind: 'buff', cd: 12000, range: 0, ms: 4000, buff: { atk: 45 }, level: 1 },
      { key: 'E', name: 'berserkerE', kind: 'dash', cd: 10000, range: 300, radius: 100, damage: 60, slow: 1200, level: 1 },
      { key: 'R', name: 'berserkerR', kind: 'buff', cd: 60000, range: 0, ms: 6000, buff: { dmg: 30, lifesteal: 20, speed: 20 }, level: 3 },
    ],
  },
  {
    id: 'harpooner',
    name: 'harpoonerName',
    role: 'roleCatcher',
    hero: 'harpoonerHero',
    short: 'Morrow',
    title: 'harpoonerTitle',
    motive: 'harpoonerMotive',
    blurb: 'harpoonerBlurb',
    perk: { desc: 'harpoonerPerk', beastDmg: 25 },
    color: '#2fb39a',
    hp: 580,
    hpPerLevel: 88,
    dmg: 48,
    dmgPerLevel: 4,
    armor: 5,
    range: 140,
    speed: 120,
    attackMs: 950,
    passive: { name: 'harpoonerPassive', desc: 'harpoonerPassiveDesc', regen: 4 },
    abilities: [
      { key: 'Q', name: 'harpoonerQ', kind: 'bolt', cd: 9000, range: 620, speed: 950, width: 26, damage: 70, pull: true, stun: 400, level: 1 },
      { key: 'W', name: 'harpoonerW', kind: 'burst', cd: 8000, range: 0, radius: 160, damage: 60, knock: 120, level: 1 },
      { key: 'E', name: 'harpoonerE', kind: 'buff', cd: 12000, range: 0, ms: 3000, shield: 120, buff: { armor: 20 }, level: 1 },
      { key: 'R', name: 'harpoonerR', kind: 'zone', cd: 60000, range: 500, radius: 200, dps: 70, ms: 3000, slow: 1000, level: 3 },
    ],
  },
  {
    id: 'witch',
    name: 'witchName',
    role: 'roleController',
    hero: 'witchHero',
    short: 'Gwyth',
    title: 'witchTitle',
    motive: 'witchMotive',
    blurb: 'witchBlurb',
    color: '#c55fae',
    hp: 460,
    hpPerLevel: 64,
    dmg: 40,
    dmgPerLevel: 3,
    armor: 1,
    range: 400,
    speed: 128,
    attackMs: 950,
    passive: { name: 'witchPassive', desc: 'witchPassiveDesc', slowHit: 600 },
    abilities: [
      { key: 'Q', name: 'witchQ', kind: 'bolt', cd: 4500, range: 620, speed: 750, width: 28, damage: 70, slow: 1500, level: 1 },
      { key: 'W', name: 'witchW', kind: 'zone', cd: 9000, range: 550, radius: 120, dps: 45, ms: 3500, level: 1 },
      { key: 'E', name: 'witchE', kind: 'burst', cd: 12000, range: 500, radius: 90, damage: 40, stun: 1100, level: 1 },
      { key: 'R', name: 'witchR', kind: 'zone', cd: 60000, range: 600, radius: 240, dps: 70, ms: 4000, slow: 1500, level: 3 },
    ],
  },
  {
    id: 'stalker',
    name: 'stalkerName',
    role: 'roleAmbusher',
    hero: 'stalkerHero',
    short: 'Kaida',
    title: 'stalkerTitle',
    motive: 'stalkerMotive',
    blurb: 'stalkerBlurb',
    perk: { desc: 'stalkerPerk', captureRate: 100 },
    color: '#8fa0b8',
    hp: 520,
    hpPerLevel: 78,
    dmg: 58,
    dmgPerLevel: 4.5,
    armor: 3,
    range: 115,
    speed: 145,
    attackMs: 750,
    passive: { name: 'stalkerPassive', desc: 'stalkerPassiveDesc', ambush: 2.3 },
    abilities: [
      { key: 'Q', name: 'stalkerQ', kind: 'bolt', cd: 5000, range: 520, speed: 950, width: 22, damage: 50, count: 3, spread: 0.25, level: 1 },
      { key: 'W', name: 'stalkerW', kind: 'buff', cd: 14000, range: 0, ms: 3000, buff: { stealth: true, speed: 30 }, level: 1 },
      { key: 'E', name: 'stalkerE', kind: 'dash', cd: 9000, range: 260, radius: 80, damage: 70, stun: 500, level: 1 },
      { key: 'R', name: 'stalkerR', kind: 'bolt', cd: 60000, range: 700, speed: 1100, width: 30, damage: 200, executeBelow: 0.4, level: 3 },
    ],
  },
  {
    id: 'lancer',
    name: 'lancerName',
    role: 'roleBruiser',
    hero: 'lancerHero',
    short: 'Liora',
    title: 'lancerTitle',
    motive: 'lancerMotive',
    blurb: 'lancerBlurb',
    color: '#d8cfb4',
    hp: 610,
    hpPerLevel: 90,
    dmg: 56,
    dmgPerLevel: 4.5,
    armor: 5,
    range: 170,
    speed: 122,
    attackMs: 900,
    passive: { name: 'lancerPassive', desc: 'lancerPassiveDesc', splash: 40, splashRadius: 80 },
    abilities: [
      { key: 'Q', name: 'lancerQ', kind: 'bolt', cd: 5000, range: 380, speed: 1100, width: 30, damage: 90, pierce: true, level: 1 },
      { key: 'W', name: 'lancerW', kind: 'burst', cd: 8000, range: 0, radius: 190, damage: 55, knock: 90, level: 1 },
      { key: 'E', name: 'lancerE', kind: 'dash', cd: 10000, range: 260, radius: 90, damage: 50, stun: 300, level: 1 },
      { key: 'R', name: 'lancerR', kind: 'ally', cd: 60000, range: 0, radius: 260, shield: 150, ms: 6000, buff: { armor: 15 }, level: 3 },
    ],
  },
  {
    id: 'gunslinger',
    name: 'gunslingerName',
    role: 'roleMarksman',
    hero: 'gunslingerHero',
    short: 'Rook',
    title: 'gunslingerTitle',
    motive: 'gunslingerMotive',
    blurb: 'gunslingerBlurb',
    perk: { desc: 'gunslingerPerk', bountyGold: 50 },
    color: '#c9925a',
    hp: 480,
    hpPerLevel: 72,
    dmg: 54,
    dmgPerLevel: 4.5,
    armor: 2,
    range: 400,
    speed: 128,
    attackMs: 850,
    passive: { name: 'gunslingerPassive', desc: 'gunslingerPassiveDesc', splash: 35, splashRadius: 90 },
    abilities: [
      { key: 'Q', name: 'gunslingerQ', kind: 'bolt', cd: 5000, range: 560, speed: 1300, width: 20, damage: 42, count: 3, spread: 0.12, level: 1 },
      { key: 'W', name: 'gunslingerW', kind: 'zone', cd: 11000, range: 450, radius: 130, dps: 15, ms: 3000, slow: 1000, level: 1 },
      { key: 'E', name: 'gunslingerE', kind: 'dash', cd: 9000, range: 200, level: 1 },
      { key: 'R', name: 'gunslingerR', kind: 'bolt', cd: 60000, range: 900, speed: 1500, width: 26, damage: 230, executeBelow: 0.3, level: 3 },
    ],
  },
  {
    id: 'automaton',
    name: 'automatonName',
    role: 'roleTank',
    hero: 'automatonHero',
    short: 'AX-9',
    title: 'automatonTitle',
    motive: 'automatonMotive',
    blurb: 'automatonBlurb',
    color: '#d8a24a',
    hp: 700,
    hpPerLevel: 100,
    dmg: 46,
    dmgPerLevel: 3.5,
    armor: 8,
    range: 110,
    speed: 112,
    attackMs: 1000,
    passive: { name: 'automatonPassive', desc: 'automatonPassiveDesc', tough: 12 },
    abilities: [
      { key: 'Q', name: 'automatonQ', kind: 'burst', cd: 7000, range: 0, radius: 160, damage: 65, slow: 1200, level: 1 },
      { key: 'W', name: 'automatonW', kind: 'buff', cd: 13000, range: 0, ms: 4000, buff: { atk: 40, armor: 15 }, level: 1 },
      { key: 'E', name: 'automatonE', kind: 'bolt', cd: 11000, range: 520, speed: 1000, width: 28, damage: 60, pull: true, stun: 500, level: 1 },
      { key: 'R', name: 'automatonR', kind: 'burst', cd: 60000, range: 0, radius: 250, damage: 160, stun: 800, level: 3 },
    ],
  },
  {
    id: 'tinker',
    name: 'tinkerName',
    role: 'roleController',
    hero: 'tinkerHero',
    short: 'Winnie',
    title: 'tinkerTitle',
    motive: 'tinkerMotive',
    blurb: 'tinkerBlurb',
    color: '#5fd3f0',
    hp: 480,
    hpPerLevel: 72,
    dmg: 48,
    dmgPerLevel: 3.5,
    armor: 2,
    range: 430,
    speed: 122,
    attackMs: 1000,
    passive: { name: 'tinkerPassive', desc: 'tinkerPassiveDesc', spellpower: 15 },
    abilities: [
      { key: 'Q', name: 'tinkerQ', kind: 'bolt', cd: 4500, range: 620, speed: 900, width: 26, damage: 75, stun: 300, level: 1 },
      { key: 'W', name: 'tinkerW', kind: 'zone', cd: 9000, range: 520, radius: 130, dps: 50, ms: 3500, slow: 800, level: 1 },
      { key: 'E', name: 'tinkerE', kind: 'dash', cd: 11000, range: 300, level: 1 },
      { key: 'R', name: 'tinkerR', kind: 'zone', cd: 60000, range: 600, radius: 250, dps: 80, ms: 3000, slow: 1200, level: 3 },
    ],
  },
  {
    id: 'wolfkin',
    name: 'wolfkinName',
    role: 'roleHunter',
    hero: 'wolfkinHero',
    short: 'Fenra',
    title: 'wolfkinTitle',
    motive: 'wolfkinMotive',
    blurb: 'wolfkinBlurb',
    color: '#9aa3ad',
    hp: 560,
    hpPerLevel: 84,
    dmg: 55,
    dmgPerLevel: 4.5,
    armor: 3,
    range: 110,
    speed: 135,
    attackMs: 780,
    passive: { name: 'wolfkinPassive', desc: 'wolfkinPassiveDesc', lifesteal: 12 },
    abilities: [
      { key: 'Q', name: 'wolfkinQ', kind: 'dash', cd: 6000, range: 260, radius: 90, damage: 70, slow: 1000, level: 1 },
      { key: 'W', name: 'wolfkinW', kind: 'buff', cd: 12000, range: 0, ms: 4000, buff: { atk: 30, speed: 20 }, level: 1 },
      { key: 'E', name: 'wolfkinE', kind: 'burst', cd: 8000, range: 0, radius: 130, damage: 65, slow: 1000, level: 1 },
      { key: 'R', name: 'wolfkinR', kind: 'buff', cd: 60000, range: 0, ms: 6000, buff: { dmg: 25, lifesteal: 25, speed: 25 }, level: 3 },
    ],
  },
  {
    id: 'bruin',
    name: 'bruinName',
    role: 'roleBrawler',
    hero: 'bruinHero',
    short: 'Grumm',
    title: 'bruinTitle',
    motive: 'bruinMotive',
    blurb: 'bruinBlurb',
    color: '#a0683a',
    hp: 680,
    hpPerLevel: 98,
    dmg: 50,
    dmgPerLevel: 4,
    armor: 6,
    range: 110,
    speed: 116,
    attackMs: 950,
    passive: { name: 'bruinPassive', desc: 'bruinPassiveDesc', regen: 6 },
    abilities: [
      { key: 'Q', name: 'bruinQ', kind: 'burst', cd: 6000, range: 0, radius: 130, damage: 80, level: 1 },
      { key: 'W', name: 'bruinW', kind: 'burst', cd: 10000, range: 0, radius: 220, damage: 30, slow: 1500, level: 1 },
      { key: 'E', name: 'bruinE', kind: 'dash', cd: 10000, range: 300, radius: 100, damage: 60, stun: 500, level: 1 },
      { key: 'R', name: 'bruinR', kind: 'buff', cd: 60000, range: 0, ms: 6000, shield: 150, buff: { dmg: 25, atk: 30, armor: 15 }, level: 3 },
    ],
  },
];

export interface ItemDef {
  id: string;
  name: TextKey;
  /** The full price. A recipe item costs less by the parts it builds from that the buyer owns. */
  cost: number;
  /** Flat bonuses to a champion's stats. */
  dmg?: number;
  armor?: number;
  hp?: number;
  speed?: number;
  /** Percent faster attacks. */
  atk?: number;
  /** Percent shorter ability cooldowns. */
  cdr?: number;
  /** The parts this item builds from: owned ones are used up and knocked off the price. */
  from?: string[];
  /** An active the item adds, cast with its key (see `ACTIVES`). */
  active?: ActiveId;
  /** A consumable: buying it adds one to the champion's wards (`WARD.carry` at most) and takes no bag slot. */
  ward?: boolean;
  /** An elixir: buying it gives this buff for `ELIXIR.ms`, through death, and takes no bag slot. */
  elixir?: BuffDef;
}

/**
 * Bought at the shop by a champion standing near its Nexus. Each item can be owned once. The first
 * seven are parts (cheap, and the flask), the next five build from them, the Vision Ward is a
 * consumable (see `WARD`), and the three elixirs are timed buffs, one at a time (see `ELIXIR`).
 */
export const ITEMS: ItemDef[] = [
  { id: 'sword', name: 'itemSword', cost: 350, dmg: 12 },
  { id: 'dagger', name: 'itemDagger', cost: 300, atk: 15 },
  { id: 'cloth', name: 'itemCloth', cost: 300, armor: 6 },
  { id: 'ruby', name: 'itemRuby', cost: 300, hp: 100 },
  { id: 'boots', name: 'itemBoots', cost: 300, speed: 25 },
  { id: 'sapphire', name: 'itemSapphire', cost: 300, cdr: 8 },
  { id: 'flask', name: 'itemFlask', cost: 150, active: 'flask' },
  { id: 'blade', name: 'itemBlade', cost: 950, dmg: 30, atk: 20, from: ['sword', 'dagger'] },
  { id: 'thorns', name: 'itemThorns', cost: 900, armor: 16, hp: 180, from: ['cloth', 'ruby'] },
  { id: 'phase', name: 'itemPhase', cost: 600, speed: 40, active: 'dash', from: ['boots'] },
  { id: 'cloak', name: 'itemCloak', cost: 900, cdr: 20, hp: 120, from: ['sapphire', 'ruby'] },
  { id: 'belt', name: 'itemBelt', cost: 700, hp: 320, from: ['ruby'] },
  { id: 'ward', name: 'itemWard', cost: 75, ward: true },
  { id: 'wrath', name: 'itemWrath', cost: 400, elixir: { dmg: 20 } },
  { id: 'iron', name: 'itemIron', cost: 400, elixir: { armor: 15, regen: 4 } },
  { id: 'swift', name: 'itemSwift', cost: 400, elixir: { speed: 15, atk: 20 } },
];
/**
 * Elixirs last three minutes, through death; a new one replaces the one a champion has. An AI
 * champion buys one (`AI_ELIXIR` for its build) once its build is done and it has this much gold
 * to spare on top of the price.
 */
export const ELIXIR = { ms: 180_000, aiSpare: 300 };
export const AI_ELIXIR: Record<string, string> = { tank: 'iron', fighter: 'wrath', caster: 'swift' };
/** Each elixir's colour, for its buff chip and its gem in the shop. */
export const ELIXIR_COLOR: Record<string, string> = { wrath: '#ff5c4d', iron: '#b9c3cf', swift: '#5ce0c8' };
/** A champion carries at most this many items. */
export const MAX_ITEMS = 6;

export type ActiveId = 'dash' | 'flask' | 'ward';
export interface ActiveDef {
  id: ActiveId;
  /** The key that casts it, and the button's label. */
  key: 'D' | 'H' | 'V';
  cd: number;
  /** dash: how far it goes. */
  range?: number;
  /** flask: health restored. */
  heal?: number;
}
/** The item actives, each on its own key and button. */
export const ACTIVES: ActiveDef[] = [
  { id: 'dash', key: 'D', cd: 18_000, range: 220 },
  { id: 'flask', key: 'H', cd: 40_000, heal: 220 },
  { id: 'ward', key: 'V', cd: 0, range: 600 },
];

/**
 * Vision wards (LB6): a champion carries up to `carry` of them and plants one within `range` of
 * itself; it gives its team `SIGHT.ward` of sight there, bushes included, for `ms`, and dies to
 * `hits` hits of any kind. Its killer takes `gold`. The AI plants its wards at `WARD_SPOTS`.
 */
export const WARD = { carry: 2, range: 600, ms: 90_000, hits: 3, gold: 20, radius: 10 };
/** Where the AI likes its wards: the beast's pit and the three river islands; a team wards a spot once at a time. */
export const WARD_SPOTS: Vec[] = [{ x: 1950, y: 1950 }, { x: 850, y: 850 }, { x: 1200, y: 1200 }, { x: 1600, y: 1600 }];
/** An AI champion's ward goes at a spot this close to it that has no live ward of its team within `taken` px. */
export const WARD_AI = { reach: 600, taken: 320 };

/**
 * Recall (LB7): a champion channels `ms` standing still to go home to its Nexus. Taking damage,
 * moving, attacking or casting cancels it. An AI champion recalls when it is low with no enemy
 * about, or when it carries `rich` gold and something to spend it on.
 */
export const RECALL = { ms: 4000, aiLow: 0.35, aiLook: 700, rich: 900, aiEvery: 60_000 };

/**
 * Buy back (LB10): a dead champion pays `base` plus `perLevel` per level to respawn at once, then
 * waits `cd` before it may again. An AI champion buys back when an enemy champion stands within
 * `aiThreat` of its Nexus.
 */
export const BUYBACK = { base: 100, perLevel: 50, cd: 150_000, aiThreat: 800 };

/**
 * Kill streak bounties (LB8): a champion that has slain `streak` champions without dying carries a
 * bounty of `base` gold, `step` more per further kill up to `max`, paid to whoever slays it on top
 * of the kill gold. The AI's ganks go after the biggest bounty it can see, and twice as often.
 */
export const BOUNTY = { streak: 3, base: 100, step: 50, max: 300 };
/** The bounty a champion carries now, or 0. */
export function bountyOf(killStreak: number): number {
  return killStreak >= BOUNTY.streak ? Math.min(BOUNTY.max, BOUNTY.base + (killStreak - BOUNTY.streak) * BOUNTY.step) : 0;
}

/**
 * AI shopping (LB9): what an AI champion buys, in order, by its class's role, whenever it is home or
 * dead and can pay. A part is skipped once the item it builds into is owned; each build fills the
 * six slots. Roles not listed shop like a fighter.
 */
export const AI_BUILDS: Record<string, string[]> = {
  tank: ['flask', 'cloth', 'ruby', 'thorns', 'boots', 'belt', 'sword', 'phase', 'dagger', 'blade', 'sapphire'],
  fighter: ['flask', 'sword', 'dagger', 'blade', 'boots', 'phase', 'ruby', 'belt', 'cloth', 'thorns', 'sapphire'],
  caster: ['flask', 'sapphire', 'ruby', 'cloak', 'boots', 'sword', 'belt', 'phase', 'dagger', 'blade', 'cloth'],
};
export const AI_BUILD_FOR: Partial<Record<TextKey, keyof typeof AI_BUILDS>> = {
  roleTank: 'tank',
  roleBruiser: 'tank',
  roleBrawler: 'tank',
  roleCatcher: 'tank',
  roleBurst: 'caster',
  roleSupport: 'caster',
  roleController: 'caster',
};

/** How close a champion must stand to its Nexus to shop. */
export const SHOP_RANGE = 700;
/** A champion within `radius` of its own Nexus heals `share` of its health a second. */
export const FOUNTAIN = { radius: 420, share: 0.12 };

/** Which lane each AI champion walks, in roster order without the player's champion. */
export const ALLY_LANES: LaneId[] = ['top', 'mid', 'bottom', 'mid'];
export const ENEMY_LANES: LaneId[] = ['top', 'mid', 'bottom', 'mid', 'top'];

/** The colour of each side's rings, bolts and lines. */
export const SIDE_COLOR = { blue: '#3d8bfd', red: '#e0553f', neutral: '#f4d35e' } as const;

/** The jungle buffs: the slayer of an ember or moss brute carries one until it dies or it runs out. */
export const BUFFS: Record<'ember' | 'moss', { name: TextKey; ms: number; color: string; buff: BuffDef }> = {
  ember: { name: 'buffEmber', ms: 60_000, color: '#ff8a3d', buff: { dmg: 15, slowHit: 800 } },
  moss: { name: 'buffMoss', ms: 60_000, color: '#7fe08a', buff: { cdr: 20, regen: 8 } },
};

// ---------------------------------------------------------------------------------------------
// Match objectives: one goal at a time for the player's team, with a time limit and a reward.

export type ObjectiveKind = 'tower' | 'camp' | 'champion' | 'beast';
export interface ObjectiveDef {
  kind: ObjectiveKind;
  /** Time to finish it, in ms. */
  ms: number;
  /** Gold paid to the player's champion when it is done. */
  gold: number;
  /** A perk that comes with it: the siege banner adds damage against towers and the Nexus for a while. */
  banner?: 'siege';
}
/** The goals in the order they come; the list repeats. */
export const OBJECTIVES: ObjectiveDef[] = [
  { kind: 'tower', ms: 150_000, gold: 200, banner: 'siege' },
  { kind: 'camp', ms: 90_000, gold: 120 },
  { kind: 'champion', ms: 120_000, gold: 150 },
  { kind: 'beast', ms: 120_000, gold: 250 },
];
/** The pause between one objective ending and the next one starting. */
export const OBJECTIVE_GAP_MS = 4000;
/** The siege banner: the player's champion deals this much more damage to towers and the Nexus. */
export const SIEGE = { mult: 1.25, ms: 60_000 };

// ---------------------------------------------------------------------------------------------
// Upgrades: each new level offers the player two upgrades to its abilities, and it keeps one.

export interface UpgradeDef {
  id: string;
  key: AbilityKey;
  name: TextKey;
  /** Percent changes to the ability's numbers (cd is negative for a shorter cooldown). */
  radius?: number;
  /** Also scales a zone's damage per second. */
  damage?: number;
  range?: number;
  heal?: number;
  shield?: number;
  cd?: number;
  /** How long a buff or a zone lasts. */
  ms?: number;
  /** Stun in ms for champions and minions hit. */
  stun?: number;
  /** Slow in ms for champions and minions hit. */
  slow?: number;
  /** More bolts. */
  count?: number;
}

/** The levels that offer an upgrade pair; the others past 1 rank up the R (`ULT_RANK_LEVELS`). */
export const UPGRADE_LEVELS = [2, 3, 4, 5, 7];
/** Levels 6 and 8 rank up the R: each rank adds `ULT_RANK`'s percents to its numbers. */
export const ULT_RANK_LEVELS = [6, 8];
export const ULT_RANK = { damage: 20, heal: 20, shield: 20, cd: -15 };

/** How many ranks the R has at a level (0 to 2). */
export const ultRank = (level: number) => ULT_RANK_LEVELS.filter((l) => level >= l).length;

/** An upgrade; the scene words what it does from its one effect (`upgradeText` in `GameScene.ts`). */
const up = (id: string, key: AbilityKey, name: TextKey, fx: Partial<UpgradeDef>): UpgradeDef => ({ ...fx, id, key, name });

/** Per champion, the two upgrades offered at each of `UPGRADE_LEVELS`, in order. */
export const UPGRADES: Record<string, [UpgradeDef, UpgradeDef][]> = {
  warden: [
    [up('wide-slam', 'Q', 'upWideSlam', { radius: 30 }), up('stun-slam', 'Q', 'upStunSlam', { stun: 600 })],
    [up('iron-bulwark', 'W', 'upIronBulwark', { shield: 40 }), up('long-charge', 'E', 'upLongCharge', { range: 30 })],
    [up('titan-stand', 'R', 'upTitanStand', { damage: 25 }), up('quick-slam', 'Q', 'upQuickSlam', { cd: -25 })],
    [up('crushing-charge', 'E', 'upCrushingCharge', { damage: 40 }), up('wide-bulwark', 'W', 'upWideBulwark', { radius: 40 })],
    [up('quick-oath', 'W', 'upQuickOath', { cd: -30 }), up('gatebreaker', 'E', 'upGatebreaker', { stun: 400 })],
  ],
  blade: [
    [up('deep-strike', 'Q', 'upDeepStrike', { range: 30 }), up('keen-strike', 'Q', 'upKeenStrike', { damage: 30 })],
    [up('wide-whirl', 'W', 'upWideWhirl', { radius: 30 }), up('quick-step', 'E', 'upQuickStep', { cd: -30 })],
    [up('brutal-execute', 'R', 'upBrutalExecute', { damage: 25 }), up('crippling-whirl', 'W', 'upCripplingWhirl', { slow: 1200 })],
    [up('swift-strike', 'Q', 'upSwiftStrike', { cd: -25 }), up('long-step', 'E', 'upLongStep', { range: 30 })],
    [up('debt-collected', 'R', 'upDebtCollected', { cd: -30 }), up('twin-wind', 'W', 'upTwinWind', { damage: 40 })],
  ],
  archer: [
    [up('heavy-arrow', 'Q', 'upHeavyArrow', { damage: 30 }), up('wide-volley', 'W', 'upWideVolley', { count: 2 })],
    [up('long-roll', 'E', 'upLongRoll', { range: 40 }), up('quick-arrow', 'Q', 'upQuickArrow', { cd: -25 })],
    [up('wide-rain', 'R', 'upWideRain', { radius: 30 }), up('hard-volley', 'W', 'upHardVolley', { damage: 30 })],
    [up('pinning-arrow', 'Q', 'upPinningArrow', { stun: 500 }), up('heavy-rain', 'R', 'upHeavyRain', { damage: 25 })],
    [up('long-hail', 'R', 'upLongHail', { ms: 40 }), up('quick-tumble', 'E', 'upQuickTumble', { cd: -30 })],
  ],
  mage: [
    [up('big-fireball', 'Q', 'upBigFireball', { damage: 30 }), up('swift-fireball', 'Q', 'upSwiftFireball', { cd: -25 })],
    [up('deep-freeze', 'W', 'upDeepFreeze', { stun: 600 }), up('far-blink', 'E', 'upFarBlink', { range: 30 })],
    [up('huge-meteor', 'R', 'upHugeMeteor', { radius: 30 }), up('wide-nova', 'W', 'upWideNova', { radius: 30 })],
    [up('long-fireball', 'Q', 'upLongFireball', { range: 30 }), up('heavy-meteor', 'R', 'upHeavyMeteor', { damage: 25 })],
    [up('quick-fold', 'E', 'upQuickFold', { cd: -30 }), up('hard-rime', 'W', 'upHardRime', { damage: 40 })],
  ],
  priest: [
    [up('deep-mend', 'W', 'upDeepMend', { heal: 30 }), up('wide-mend', 'W', 'upWideMend', { radius: 30 })],
    [up('holy-smite', 'Q', 'upHolySmite', { damage: 30 }), up('strong-ward', 'E', 'upStrongWard', { shield: 40 })],
    [up('wide-sanctuary', 'R', 'upWideSanctuary', { radius: 25 }), up('quick-ward', 'E', 'upQuickWard', { cd: -25 })],
    [up('binding-smite', 'Q', 'upBindingSmite', { stun: 500 }), up('quick-mend', 'W', 'upQuickMend', { cd: -25 })],
    [up('bright-bell', 'R', 'upBrightBell', { heal: 40 }), up('long-lance', 'Q', 'upLongLance', { range: 30 })],
  ],
  berserker: [
    [up('wide-cleave', 'Q', 'upWideCleave', { radius: 30 }), up('savage-cleave', 'Q', 'upSavageCleave', { damage: 30 })],
    [up('long-frenzy', 'W', 'upLongFrenzy', { ms: 50 }), up('far-leap', 'E', 'upFarLeap', { range: 30 })],
    [up('endless-rampage', 'R', 'upEndlessRampage', { ms: 40 }), up('crushing-leap', 'E', 'upCrushingLeap', { stun: 500 })],
    [up('quick-cleave', 'Q', 'upQuickCleave', { cd: -25 }), up('quick-frenzy', 'W', 'upQuickFrenzy', { cd: -30 })],
    [up('quick-skyfall', 'E', 'upQuickSkyfall', { cd: -30 }), up('quick-chains', 'R', 'upQuickChains', { cd: -30 })],
  ],
  harpooner: [
    [up('long-harpoon', 'Q', 'upLongHarpoon', { range: 25 }), up('barbed-harpoon', 'Q', 'upBarbedHarpoon', { damage: 40 })],
    [up('deep-undertow', 'W', 'upDeepUndertow', { radius: 30 }), up('iron-brace', 'E', 'upIronBrace', { shield: 50 })],
    [up('wide-maelstrom', 'R', 'upWideMaelstrom', { radius: 25 }), up('quick-harpoon', 'Q', 'upQuickHarpoon', { cd: -25 })],
    [up('stunning-undertow', 'W', 'upStunningUndertow', { stun: 500 }), up('raging-maelstrom', 'R', 'upRagingMaelstrom', { damage: 30 })],
    [up('long-maelstrom', 'R', 'upLongMaelstrom', { ms: 40 }), up('quick-hold', 'E', 'upQuickHold', { cd: -30 })],
  ],
  witch: [
    [up('cruel-hex', 'Q', 'upCruelHex', { damage: 30 }), up('lasting-blight', 'W', 'upLastingBlight', { ms: 40 })],
    [up('wide-snare', 'E', 'upWideSnare', { radius: 40 }), up('quick-hex', 'Q', 'upQuickHex', { cd: -25 })],
    [up('wide-plague', 'R', 'upWidePlague', { radius: 25 }), up('foul-blight', 'W', 'upFoulBlight', { damage: 35 })],
    [up('deep-roots', 'E', 'upDeepRoots', { stun: 500 }), up('long-plague', 'R', 'upLongPlague', { ms: 30 })],
    [up('wide-rot', 'W', 'upWideRot', { radius: 30 }), up('quick-snare', 'E', 'upQuickSnare', { cd: -30 })],
  ],
  stalker: [
    [up('sharp-shuriken', 'Q', 'upSharpShuriken', { damage: 30 }), up('wide-fan', 'Q', 'upWideFan', { count: 2 })],
    [up('long-vanish', 'W', 'upLongVanish', { ms: 50 }), up('far-pounce', 'E', 'upFarPounce', { range: 30 })],
    [up('deadly-mark', 'R', 'upDeadlyMark', { damage: 25 }), up('quick-vanish', 'W', 'upQuickVanish', { cd: -30 })],
    [up('stunning-pounce', 'E', 'upStunningPounce', { stun: 400 }), up('quick-shuriken', 'Q', 'upQuickShuriken', { cd: -25 })],
    [up('quick-pounce', 'E', 'upQuickPounce', { cd: -30 }), up('long-stars', 'Q', 'upLongStars', { range: 30 })],
  ],
  lancer: [
    [up('long-thrust', 'Q', 'upLongThrust', { range: 30 }), up('hard-thrust', 'Q', 'upHardThrust', { damage: 30 })],
    [up('wide-sweep', 'W', 'upWideSweep', { radius: 25 }), up('high-vault', 'E', 'upHighVault', { range: 30 })],
    [up('iron-phalanx', 'R', 'upIronPhalanx', { shield: 40 }), up('crippling-sweep', 'W', 'upCripplingSweep', { slow: 1200 })],
    [up('stunning-vault', 'E', 'upStunningVault', { stun: 400 }), up('quick-thrust', 'Q', 'upQuickThrust', { cd: -25 })],
    [up('quick-rally', 'R', 'upQuickRally', { cd: -30 }), up('hard-sweep', 'W', 'upHardSweep', { damage: 40 })],
  ],
  gunslinger: [
    [up('more-hammer', 'Q', 'upMoreHammer', { count: 2 }), up('hot-lead', 'Q', 'upHotLead', { damage: 30 })],
    [up('thick-smoke', 'W', 'upThickSmoke', { radius: 30 }), up('quick-roll', 'E', 'upQuickRoll', { cd: -30 })],
    [up('steady-aim', 'R', 'upSteadyAim', { damage: 25 }), up('long-smoke', 'W', 'upLongSmoke', { ms: 40 })],
    [up('stunning-shot', 'Q', 'upStunningShot', { stun: 300 }), up('quick-hammer', 'Q', 'upQuickHammer', { cd: -25 })],
    [up('quick-draw', 'R', 'upQuickDraw', { cd: -30 }), up('far-roll', 'E', 'upFarRoll', { range: 30 })],
  ],
  automaton: [
    [up('wide-vent', 'Q', 'upWideVent', { radius: 30 }), up('scalding-vent', 'Q', 'upScaldingVent', { damage: 30 })],
    [up('long-overclock', 'W', 'upLongOverclock', { ms: 50 }), up('long-fist', 'E', 'upLongFist', { range: 25 })],
    [up('big-overload', 'R', 'upBigOverload', { radius: 25 }), up('quick-vent', 'Q', 'upQuickVent', { cd: -25 })],
    [up('heavy-fist', 'E', 'upHeavyFist', { damage: 40 }), up('quick-overclock', 'W', 'upQuickOverclock', { cd: -30 })],
    [up('quick-fist', 'E', 'upQuickFist', { cd: -30 }), up('hot-heart', 'R', 'upHotHeart', { damage: 30 })],
  ],
  tinker: [
    [up('hot-spark', 'Q', 'upHotSpark', { damage: 30 }), up('quick-spark', 'Q', 'upQuickSpark', { cd: -25 })],
    [up('wide-field', 'W', 'upWideField', { radius: 30 }), up('long-jet', 'E', 'upLongJet', { range: 30 })],
    [up('wide-storm', 'R', 'upWideStorm', { radius: 25 }), up('strong-field', 'W', 'upStrongField', { damage: 35 })],
    [up('stunning-spark', 'Q', 'upStunningSpark', { stun: 400 }), up('long-storm', 'R', 'upLongStorm', { ms: 30 })],
    [up('quick-coil', 'W', 'upQuickCoil', { cd: -30 }), up('long-spark', 'Q', 'upLongSpark', { range: 30 })],
  ],
  wolfkin: [
    [up('far-lunge', 'Q', 'upFarLunge', { range: 30 }), up('savage-lunge', 'Q', 'upSavageLunge', { damage: 30 })],
    [up('long-howl', 'W', 'upLongHowl', { ms: 50 }), up('wide-rend', 'E', 'upWideRend', { radius: 30 })],
    [up('long-moon', 'R', 'upLongMoon', { ms: 40 }), up('quick-lunge', 'Q', 'upQuickLunge', { cd: -25 })],
    [up('deep-rend', 'E', 'upDeepRend', { damage: 40 }), up('quick-howl', 'W', 'upQuickHowl', { cd: -30 })],
    [up('quick-rend', 'E', 'upQuickRend', { cd: -30 }), up('red-moon', 'R', 'upRedMoon', { cd: -30 })],
  ],
  bruin: [
    [up('wide-maul', 'Q', 'upWideMaul', { radius: 30 }), up('heavy-maul', 'Q', 'upHeavyMaul', { damage: 30 })],
    [up('loud-roar', 'W', 'upLoudRoar', { radius: 25 }), up('long-rush', 'E', 'upLongRush', { range: 30 })],
    [up('long-wrath', 'R', 'upLongWrath', { ms: 40 }), up('quick-maul', 'Q', 'upQuickMaul', { cd: -25 })],
    [up('stunning-roar', 'W', 'upStunningRoar', { stun: 500 }), up('crushing-rush', 'E', 'upCrushingRush', { damage: 40 })],
    [up('quick-roar', 'W', 'upQuickRoar', { cd: -30 }), up('quick-wrath', 'R', 'upQuickWrath', { cd: -30 })],
  ],
};

/**
 * Class mastery: the player's wins with a class (saved in `mastery.ts`) that reach each rank. At
 * rank r the offers at the first r of `UPGRADE_LEVELS` get a third card.
 */
export const MASTERY_WINS = [1, 2, 4, 6, 9];

/**
 * The upgrades a level offers a champion: its pair less any it owns, topped up to `count` from its
 * other pairs (the later ones first) with upgrades it doesn't own yet. Empty on a level with none.
 */
export function offerFor(champId: string, level: number, owned: string[], count: number): string[] {
  const i = UPGRADE_LEVELS.indexOf(level);
  const pairs = UPGRADES[champId] ?? [];
  if (i < 0 || !pairs[i]) return [];
  const opts = pairs[i].map((u) => u.id).filter((id) => !owned.includes(id));
  for (const u of [...pairs.slice(i + 1), ...pairs.slice(0, i)].flat()) {
    if (opts.length >= count) break;
    if (!owned.includes(u.id) && !opts.includes(u.id)) opts.push(u.id);
  }
  return opts;
}

/** The upgrade pair a level offers a champion, or undefined (a rank-up level, or none left). */
export function upgradePairAt(champId: string, level: number): [UpgradeDef, UpgradeDef] | undefined {
  const i = UPGRADE_LEVELS.indexOf(level);
  return i < 0 ? undefined : UPGRADES[champId]?.[i];
}

export function upgradeById(id: string): UpgradeDef | undefined {
  for (const pairs of Object.values(UPGRADES)) for (const pair of pairs) for (const u of pair) if (u.id === id) return u;
  return undefined;
}

// ---------------------------------------------------------------------------------------------
// Last hits: the player's unbroken run of last hits on minions pays more from this streak on.

export const STREAK = { at: 4, bonus: 0.25 };
/** How far past its reach the player's champion looks for a minion its next hit would kill. */
export const LAST_HIT_LOOK = 140;

// ---------------------------------------------------------------------------------------------
// The guardian beast: a big neutral monster in a pit on the river between the middle and bottom
// lanes, the same distance from both Nexuses. The team that slays it gets stronger minions for a while.

export const BEAST = {
  x: 1950,
  y: 1950,
  hp: 3200,
  dmg: 48,
  attackMs: 1400,
  /** Its claws reach this far; past that, up to `leash`, it hurls rocks. */
  range: 150,
  radius: 38,
  /** Units this close to what it strikes take the blow too. */
  splash: 110,
  /** It gives up on an attacker this far from its pit, and heals while nobody fights it. */
  leash: 520,
  regenPerSec: 160,
  /** It first wakes at this game time, then this long after it falls. */
  firstAt: 90_000,
  respawnMs: 150_000,
  gold: 150,
  xp: 250,
  /** How long the slayers' minions stay empowered. */
  buffMs: 90_000,
};
/** Empowered minions deal this much more damage and take this much of what they would. */
export const BEAST_BUFF = { dmg: 1.5, taken: 0.65 };
/**
 * The elder beast: from `at` the beast wakes (or, if awake and unhurt, grows) into the Elder
 * Guardian, tougher and harder-hitting. Its slayers' whole team gets `buffMs` of the elder's
 * blessing: champions deal `structMult` times damage to towers, inhibitors and the Nexus, and an
 * enemy champion they leave under `execute` of its health dies. The usual beast rewards come too.
 */
export const ELDER = { at: 14 * 60_000, hpMult: 1.6, dmgMult: 1.4, buffMs: 60_000, structMult: 1.5, execute: 0.15, gold: 150 };

/** How many AI champions of each team go to fight over the beast while it is awake. */
export const BEAST_CONTESTERS = 2;

// ---------------------------------------------------------------------------------------------
// Inhibitors: one per lane per team, behind the lane's towers. It can only be hurt once both of its
// lane's towers are down; when it falls, the other team's minions on that lane come out as super
// minions. The Nexus can only be hurt once one of its inhibitors has fallen.

export interface InhibitorSpot {
  team: Team;
  lane: LaneId;
  x: number;
  y: number;
}
export const INHIBITORS: InhibitorSpot[] = both<InhibitorSpot>([
  { team: 'blue', lane: 'top', x: 300, y: 2250 },
  { team: 'blue', lane: 'mid', x: 477, y: 2323 },
  { team: 'blue', lane: 'bottom', x: 550, y: 2500 },
]).map((t, i) => (i < 3 ? t : { ...t, team: 'red', lane: t.lane === 'top' ? 'bottom' : t.lane === 'bottom' ? 'top' : 'mid' }));
export const INHIBITOR = { hp: 1600, radius: 24, gold: 120 };
/** Super minions have this much more health and damage. */
export const SUPER_MINION = 1.6;

// ---------------------------------------------------------------------------------------------
// Bushes: patches of tall grass. A champion inside one can't be seen or targeted by enemies unless
// one of them stands in the same patch or right next to it. Attacking or casting shows it briefly.

export interface Bush {
  x: number;
  y: number;
  rx: number;
  ry: number;
}
/** Nine pairs, each mirrored under the map's 180-degree turn: by the lanes, in the jungle and on the river banks. */
export const BUSHES: Bush[] = both<Bush>([
  { x: 1150, y: 1450, rx: 78, ry: 48 },
  { x: 1750, y: 2100, rx: 70, ry: 50 },
  { x: 780, y: 1680, rx: 72, ry: 52 },
  { x: 1120, y: 2050, rx: 72, ry: 52 },
  { x: 440, y: 900, rx: 60, ry: 62 },
  { x: 1900, y: 2360, rx: 70, ry: 50 },
  { x: 520, y: 1100, rx: 60, ry: 60 },
  { x: 1300, y: 2300, rx: 70, ry: 50 },
  { x: 700, y: 980, rx: 70, ry: 50 },
]);
/** An enemy this close sees into a bush, and through stealth. */
export const BUSH_REVEAL = 90;
/** How long attacking or casting from a bush shows the champion, in ms. */
export const REVEAL_MS = 1500;

/** The bush a point is in, or -1. */
export function bushAt(p: Vec): number {
  return BUSHES.findIndex((b) => ((p.x - b.x) / b.rx) ** 2 + ((p.y - b.y) / b.ry) ** 2 <= 1);
}

// ---------------------------------------------------------------------------------------------
// Team plans for the AI: now and then a champion leaves its lane to gang up on a weak enemy, takes a
// jungle buff or a watchstone, and champions that are hurt or outnumbered fall back together.

export const GANK = { firstAt: 100_000, every: 70_000, ms: 24_000, minHp: 0.6, from: 650 };
/** Each team sends a champion into the jungle for a buff or a watchstone this often, from `firstAt`. */
/**
 * River runes (LB13): every `every` ms from `firstAt` a rune appears at each of the two river
 * `spots` (one replaces any not taken), the kinds taking turns by `RUNE_ORDER`. A champion that
 * walks within `pick` takes it. The AI champion of a team nearest a rune within `aiReach`, with
 * at least `aiMinHp` of its health and no enemy champion near, walks to it.
 */
export type RuneKind = 'might' | 'haste' | 'fortune' | 'mending';
export const RUNES: Record<RuneKind, { name: TextKey; color: string; buff?: BuffDef; ms?: number; gold?: number; teamGold?: number }> = {
  might: { name: 'runeMight', color: '#ff8a3d', buff: { dmg: 30 }, ms: 30_000 },
  haste: { name: 'runeHaste', color: '#9fd8ff', buff: { speed: 40 }, ms: 25_000 },
  fortune: { name: 'runeFortune', color: '#f2c14e', gold: 120, teamGold: 40 },
  mending: { name: 'runeMending', color: '#7fe08a', buff: { regen: 25 }, ms: 20_000 },
};
export const RUNE_ORDER: RuneKind[] = ['might', 'haste', 'fortune', 'mending'];
export const RUNE = {
  spots: [{ x: 1025, y: 1025 }, { x: 1775, y: 1775 }] as Vec[],
  firstAt: 120_000,
  every: 120_000,
  pick: 46,
  aiReach: 750,
  aiMinHp: 0.5,
};

export const JUNGLE = { firstAt: 120_000, every: 45_000, ms: 30_000, minHp: 0.6 };
export const RETREAT = {
  /** Health ratio under which a champion with an enemy champion near falls back. */
  hp: 0.25,
  /** Enemy champions are counted this close. */
  look: 480,
  /** Fall back when the enemies outnumber the allies near by this many. */
  outnumber: 2,
  /** Allied AI champions this close fall back too. */
  call: 420,
  ms: 3500,
};
