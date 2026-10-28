/**
 * Every rule and number of Scrapyard Titans: the robots, their traits, the parts and items, the
 * power cards, the commanders, the neutral monsters and the round schedule. The sim (`battle.ts`)
 * and the match (`match.ts`) read these; nothing here changes during a match. Names and texts are
 * keys of `i18n/en.ts`, shown with `t`.
 */
import type { TextKey } from '../i18n';

export type SetId = 'scrap' | 'neon';
export type OriginId = 'heavy' | 'drone' | 'sparker' | 'magnet' | 'salvager' | 'neon' | 'hacker';
export type ClassId = 'guardian' | 'brawler' | 'gunner' | 'sniper' | 'saboteur' | 'mechanic';
export type TraitId = OriginId | ClassId;
export type AbilityKind = 'shield' | 'slam' | 'barrage' | 'snipe' | 'backstab' | 'repair';

export interface UnitDef {
  id: string;
  name: TextKey;
  cost: 1 | 2 | 3 | 4 | 5;
  origin: OriginId;
  cls: ClassId;
}

export interface SetDef {
  id: SetId;
  name: TextKey;
  /** One line for the menu: the season's twist. */
  blurb: TextKey;
  origins: OriginId[];
}

/** Two seasons, each a roster of 30 robots: three origins are shared, two are the season's own. */
export const SETS: SetDef[] = [
  {
    id: 'scrap',
    name: 'scrapSet',
    blurb: 'scrapBlurb',
    origins: ['heavy', 'drone', 'sparker', 'magnet', 'salvager'],
  },
  {
    id: 'neon',
    name: 'neonSet',
    blurb: 'neonBlurb',
    origins: ['heavy', 'drone', 'sparker', 'neon', 'hacker'],
  },
];

/** Scrap tokens a Scrap Rush win pays, and how many build a part. */
export const SCRAP_TOKENS_PER_PART = 3;
/** Extra starting charge every robot gets in the Overcharge season. */
export const OVERCHARGE_MANA = 20;

const u = (id: string, name: TextKey, cost: UnitDef['cost'], origin: OriginId, cls: ClassId): UnitDef => ({ id, name, cost, origin, cls });

export const UNITS: UnitDef[] = [
  // Heavy: scrap iron and rivets.
  u('rustbucket', 'rustbucket', 1, 'heavy', 'guardian'),
  u('piston-pete', 'pistonPete', 2, 'heavy', 'brawler'),
  u('demo-drill', 'demoDrill', 2, 'heavy', 'saboteur'),
  u('boomer-box', 'boomerBox', 3, 'heavy', 'gunner'),
  u('long-tom', 'longTom', 4, 'heavy', 'sniper'),
  u('forge-mother', 'forgeMother', 5, 'heavy', 'mechanic'),
  // Drone: rotors instead of legs.
  u('zip-drone', 'zipDrone', 1, 'drone', 'saboteur'),
  u('buzz-hover', 'buzzHover', 1, 'drone', 'gunner'),
  u('kite-eye', 'kiteEye', 2, 'drone', 'sniper'),
  u('swarm-mother', 'swarmMother', 3, 'drone', 'mechanic'),
  u('hover-bulwark', 'hoverBulwark', 4, 'drone', 'guardian'),
  u('talon-prime', 'talonPrime', 5, 'drone', 'brawler'),
  // Sparker: coils and lightning.
  u('coil-kid', 'coilKid', 1, 'sparker', 'mechanic'),
  u('static-fist', 'staticFist', 1, 'sparker', 'brawler'),
  u('ohm-wall', 'ohmWall', 2, 'sparker', 'guardian'),
  u('arc-lancer', 'arcLancer', 3, 'sparker', 'sniper'),
  u('jolt-jackal', 'joltJackal', 3, 'sparker', 'saboteur'),
  u('thunderhead', 'thunderhead', 5, 'sparker', 'gunner'),
  // Magnet (Scrap Rush): horseshoe heads that bend armour.
  u('clamp-jaw', 'clampJaw', 1, 'magnet', 'brawler'),
  u('crane-claw', 'craneClaw', 2, 'magnet', 'mechanic'),
  u('polar-pair', 'polarPair', 2, 'magnet', 'gunner'),
  u('lodestone', 'lodestone', 3, 'magnet', 'guardian'),
  u('snap-trap', 'snapTrap', 4, 'magnet', 'saboteur'),
  u('field-marshal', 'fieldMarshal', 5, 'magnet', 'sniper'),
  // Salvager (Scrap Rush): patched together from the fallen.
  u('tin-scrounger', 'tinScrounger', 1, 'salvager', 'saboteur'),
  u('heap-hulk', 'heapHulk', 2, 'salvager', 'guardian'),
  u('rust-eye', 'rustEye', 3, 'salvager', 'sniper'),
  u('patchwork', 'patchwork', 4, 'salvager', 'mechanic'),
  u('rivet-gunner', 'rivetGunner', 4, 'salvager', 'gunner'),
  u('wreck-king', 'wreckKing', 5, 'salvager', 'brawler'),
  // Neon (Overcharge): glowing tubes, bigger abilities.
  u('glow-grunt', 'glowGrunt', 1, 'neon', 'guardian'),
  u('laser-lily', 'laserLily', 1, 'neon', 'gunner'),
  u('neon-knuckles', 'neonKnuckles', 2, 'neon', 'brawler'),
  u('flicker', 'flicker', 3, 'neon', 'saboteur'),
  u('prism-eye', 'prismEye', 4, 'neon', 'sniper'),
  u('lumen-fixer', 'lumenFixer', 5, 'neon', 'mechanic'),
  // Hacker (Overcharge): screens for faces, drain enemy charge.
  u('glitch-fist', 'glitchFist', 1, 'hacker', 'brawler'),
  u('packet', 'packet', 2, 'hacker', 'gunner'),
  u('patch-bot', 'patchBot', 2, 'hacker', 'mechanic'),
  u('firewall', 'firewall', 3, 'hacker', 'guardian'),
  u('trojan', 'trojan', 4, 'hacker', 'saboteur'),
  u('kernel', 'kernel', 5, 'hacker', 'sniper'),
];

export const UNIT_BY_ID: Record<string, UnitDef> = Object.fromEntries(UNITS.map((d) => [d.id, d]));

export function rosterOf(set: SetId): UnitDef[] {
  const origins = SETS.find((s) => s.id === set)!.origins;
  return UNITS.filter((d) => origins.includes(d.origin));
}

export interface ClassStats {
  hp: number;
  atk: number;
  /** Attacks per second. */
  as: number;
  /** In tiles; 1 is melee (the eight tiles around). */
  range: number;
  armor: number;
  mana: number;
  startMana: number;
  ability: AbilityKind;
  /** The ability's strength at cost 1 and 1 star: shield, damage or heal. */
  power: number;
  abilityName: TextKey;
}

export const CLASS_STATS: Record<ClassId, ClassStats> = {
  guardian: { hp: 760, atk: 45, as: 0.6, range: 1, armor: 40, mana: 80, startMana: 30, ability: 'shield', power: 380, abilityName: 'guardianAbility' },
  brawler: { hp: 720, atk: 55, as: 0.65, range: 1, armor: 25, mana: 70, startMana: 20, ability: 'slam', power: 170, abilityName: 'brawlerAbility' },
  gunner: { hp: 520, atk: 48, as: 0.75, range: 3, armor: 15, mana: 60, startMana: 0, ability: 'barrage', power: 75, abilityName: 'gunnerAbility' },
  sniper: { hp: 460, atk: 62, as: 0.6, range: 4, armor: 10, mana: 70, startMana: 10, ability: 'snipe', power: 330, abilityName: 'sniperAbility' },
  saboteur: { hp: 560, atk: 60, as: 0.8, range: 1, armor: 15, mana: 60, startMana: 0, ability: 'backstab', power: 260, abilityName: 'saboteurAbility' },
  mechanic: { hp: 560, atk: 40, as: 0.6, range: 2, armor: 20, mana: 70, startMana: 20, ability: 'repair', power: 250, abilityName: 'mechanicAbility' },
};

/** Health and attack multiply by this for each star above one. */
export const STAR_STAT = 1.8;
/** Ability power by star. */
export const STAR_POWER = [1, 1.6, 2.6];
/** Each cost step above 1 raises health, attack and ability power by these fractions. */
export const COST_SCALE = { hp: 0.22, atk: 0.2, power: 0.35 };
/** Five-cost robots hit a wider area or fire more shells. */
export const BIG_ABILITY_COST = 5;

export interface TraitDef {
  id: TraitId;
  name: TextKey;
  /** Units needed for each tier. */
  tiers: number[];
  /** The bonus at each tier, used by the sim as the trait reads it. */
  values: number[];
  /** What the bonus does, with {v} for the tier's value. */
  text: TextKey;
  kind: 'origin' | 'class';
}

export const TRAITS: Record<TraitId, TraitDef> = {
  heavy: { id: 'heavy', name: 'heavyTrait', kind: 'origin', tiers: [2, 4, 6], values: [25, 50, 90], text: 'heavyTraitText' },
  drone: { id: 'drone', name: 'droneTrait', kind: 'origin', tiers: [2, 4, 6], values: [20, 35, 55], text: 'droneTraitText' },
  sparker: { id: 'sparker', name: 'sparkerTrait', kind: 'origin', tiers: [2, 4, 6], values: [80, 170, 300], text: 'sparkerTraitText' },
  magnet: { id: 'magnet', name: 'magnetTrait', kind: 'origin', tiers: [2, 4, 6], values: [15, 30, 50], text: 'magnetTraitText' },
  salvager: { id: 'salvager', name: 'salvagerTrait', kind: 'origin', tiers: [2, 4, 6], values: [8, 16, 28], text: 'salvagerTraitText' },
  neon: { id: 'neon', name: 'neonTrait', kind: 'origin', tiers: [2, 4, 6], values: [30, 65, 115], text: 'neonTraitText' },
  hacker: { id: 'hacker', name: 'hackerTrait', kind: 'origin', tiers: [2, 4, 6], values: [20, 35, 55], text: 'hackerTraitText' },
  guardian: { id: 'guardian', name: 'guardianTrait', kind: 'class', tiers: [2, 4], values: [25, 55], text: 'guardianTraitText' },
  brawler: { id: 'brawler', name: 'brawlerTrait', kind: 'class', tiers: [2, 4], values: [250, 550], text: 'brawlerTraitText' },
  gunner: { id: 'gunner', name: 'gunnerTrait', kind: 'class', tiers: [2, 4], values: [20, 50], text: 'gunnerTraitText' },
  sniper: { id: 'sniper', name: 'sniperTrait', kind: 'class', tiers: [2, 4], values: [20, 50], text: 'sniperTraitText' },
  saboteur: { id: 'saboteur', name: 'saboteurTrait', kind: 'class', tiers: [2, 4], values: [15, 30], text: 'saboteurTraitText' },
  mechanic: { id: 'mechanic', name: 'mechanicTrait', kind: 'class', tiers: [2, 4], values: [15, 40], text: 'mechanicTraitText' },
};

export const ORIGIN_COLOR: Record<OriginId, number> = {
  heavy: 0xd9822b,
  drone: 0x4fc3f7,
  sparker: 0xffd34d,
  magnet: 0xe0566a,
  salvager: 0x8bbf5a,
  neon: 0xff5cf0,
  hacker: 0x39e58c,
};

/** Cost colours on cards and pips: grey, green, blue, purple, gold. */
export const COST_COLOR = [0, 0xa8b2c8, 0x4ccf6a, 0x5aa9ff, 0xc78bff, 0xffd166];

// ---------------------------------------------------------------- parts and items

export type PartId = 'saw' | 'servo' | 'plate' | 'cell' | 'cap' | 'scope';
export const PARTS: PartId[] = ['saw', 'servo', 'plate', 'cell', 'cap', 'scope'];

export interface Stats {
  atk?: number;
  /** Attack speed, as a fraction (0.15 = 15% faster). */
  as?: number;
  armor?: number;
  hp?: number;
  mana?: number;
  crit?: number;
}

export type Special =
  | 'dmgPct' | 'cleave' | 'thorns' | 'lifesteal' | 'manaOnHit' | 'critDmg' | 'rampAS' | 'dodge' | 'regen'
  | 'manaRegen' | 'range' | 'shieldStart' | 'hpPct' | 'abilityResist' | 'ccImmune' | 'revive' | 'healOnCast'
  | 'goldOnKill' | 'spellPower' | 'spellCrit' | 'execute';

export interface ItemDef {
  id: string;
  name: TextKey;
  /** The two parts it is built from; empty for a part. */
  from: PartId[];
  stats: Stats;
  special?: { kind: Special; value: number };
  text: TextKey;
}

const PART_DEFS: Record<PartId, ItemDef> = {
  saw: { id: 'saw', name: 'sawName', from: [], stats: { atk: 15 }, text: 'sawText' },
  servo: { id: 'servo', name: 'servoName', from: [], stats: { as: 0.15 }, text: 'servoText' },
  plate: { id: 'plate', name: 'plateName', from: [], stats: { armor: 25 }, text: 'plateText' },
  cell: { id: 'cell', name: 'cellName', from: [], stats: { hp: 180 }, text: 'cellText' },
  cap: { id: 'cap', name: 'capName', from: [], stats: { mana: 15 }, text: 'capText' },
  scope: { id: 'scope', name: 'scopeName', from: [], stats: { crit: 0.12 }, text: 'scopeText' },
};

const combo = (a: PartId, b: PartId, id: string, name: TextKey, special: Special, value: number, text: TextKey): ItemDef => {
  const stats: Stats = {};
  for (const p of [a, b]) for (const [k, v] of Object.entries(PART_DEFS[p].stats)) stats[k as keyof Stats] = (stats[k as keyof Stats] ?? 0) + v;
  return { id, name, from: [a, b], stats, special: { kind: special, value }, text };
};

const COMBOS: ItemDef[] = [
  combo('saw', 'saw', 'twin-saw', 'twinSawName', 'dmgPct', 0.25, 'twinSawText'),
  combo('saw', 'servo', 'chain-saw', 'chainSawName', 'cleave', 0.4, 'chainSawText'),
  combo('saw', 'plate', 'spiked-hull', 'spikedHullName', 'thorns', 0.3, 'spikedHullText'),
  combo('saw', 'cell', 'blood-pump', 'oilPumpName', 'lifesteal', 0.25, 'oilPumpText'),
  combo('saw', 'cap', 'arc-blade', 'arcBladeName', 'manaOnHit', 6, 'arcBladeText'),
  combo('saw', 'scope', 'laser-edge', 'laserEdgeName', 'critDmg', 0.4, 'laserEdgeText'),
  combo('servo', 'servo', 'overclocker', 'overclockerName', 'rampAS', 0.05, 'overclockerText'),
  combo('servo', 'plate', 'shock-absorber', 'shockAbsorberName', 'dodge', 0.2, 'shockAbsorberText'),
  combo('servo', 'cell', 'turbo-tank', 'turboTankName', 'regen', 0.02, 'turboTankText'),
  combo('servo', 'cap', 'rapid-charger', 'rapidChargerName', 'manaRegen', 5, 'rapidChargerText'),
  combo('servo', 'scope', 'range-finder', 'rangeFinderName', 'range', 1, 'rangeFinderText'),
  combo('plate', 'plate', 'fortress-plate', 'fortressPlateName', 'shieldStart', 300, 'fortressPlateText'),
  combo('plate', 'cell', 'bulkhead', 'bulkheadName', 'hpPct', 0.2, 'bulkheadText'),
  combo('plate', 'cap', 'ion-shield', 'ionShieldName', 'abilityResist', 0.35, 'ionShieldText'),
  combo('plate', 'scope', 'mirror-plating', 'mirrorPlatingName', 'ccImmune', 1, 'mirrorPlatingText'),
  combo('cell', 'cell', 'reactor-core', 'reactorCoreName', 'revive', 0.3, 'reactorCoreText'),
  combo('cell', 'cap', 'spare-battery', 'spareBatteryName', 'healOnCast', 160, 'spareBatteryText'),
  combo('cell', 'scope', 'salvage-scanner', 'salvageScannerName', 'goldOnKill', 1, 'salvageScannerText'),
  combo('cap', 'cap', 'power-cell', 'powerCellName', 'spellPower', 0.4, 'powerCellText'),
  combo('cap', 'scope', 'targeting-chip', 'targetingChipName', 'spellCrit', 1, 'targetingChipText'),
  combo('scope', 'scope', 'eagle-optics', 'eagleOpticsName', 'execute', 0.15, 'eagleOpticsText'),
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries([...Object.values(PART_DEFS), ...COMBOS].map((i) => [i.id, i]));

/** The finished item two parts build, whichever order they come in. */
export function comboOf(a: PartId, b: PartId): ItemDef {
  return COMBOS.find((c) => (c.from[0] === a && c.from[1] === b) || (c.from[0] === b && c.from[1] === a))!;
}

export function isPart(id: string): id is PartId {
  return (PARTS as string[]).includes(id);
}

/** Items a robot can carry. */
export const MAX_ITEMS = 3;
/** Parts and items waiting to be bolted on. */
export const ITEM_BENCH = 10;

// ---------------------------------------------------------------- power cards

export type AugmentId =
  | 'spare-parts' | 'front-plates' | 'overtime' | 'hot-wiring' | 'level-up' | 'recycler' | 'thick-hull'
  | 'rapid-fire' | 'last-stand' | 'lucky-bolt' | 'gold-rush' | 'duplicator' | 'scrap-dividend' | 'big-battery' | 'war-chest';

export interface AugmentDef {
  id: AugmentId;
  name: TextKey;
  text: TextKey;
}

export const AUGMENTS: AugmentDef[] = [
  { id: 'spare-parts', name: 'sparePartsName', text: 'sparePartsText' },
  { id: 'front-plates', name: 'frontPlatesName', text: 'frontPlatesText' },
  { id: 'overtime', name: 'overtimeName', text: 'overtimeText' },
  { id: 'hot-wiring', name: 'hotWiringName', text: 'hotWiringText' },
  { id: 'level-up', name: 'levelUpName', text: 'levelUpText' },
  { id: 'recycler', name: 'recyclerName', text: 'recyclerText' },
  { id: 'thick-hull', name: 'thickHullName', text: 'thickHullText' },
  { id: 'rapid-fire', name: 'rapidFireName', text: 'rapidFireText' },
  { id: 'last-stand', name: 'lastStandName', text: 'lastStandText' },
  { id: 'lucky-bolt', name: 'luckyBoltName', text: 'luckyBoltText' },
  { id: 'gold-rush', name: 'goldRushName', text: 'goldRushText' },
  { id: 'duplicator', name: 'duplicatorName', text: 'duplicatorText' },
  { id: 'scrap-dividend', name: 'scrapDividendName', text: 'scrapDividendText' },
  { id: 'big-battery', name: 'bigBatteryName', text: 'bigBatteryText' },
  { id: 'war-chest', name: 'warChestName', text: 'warChestText' },
];

export const AUGMENT_BY_ID: Record<string, AugmentDef> = Object.fromEntries(AUGMENTS.map((a) => [a.id, a]));

// ---------------------------------------------------------------- commanders

export type SkillId = 'overclock' | 'zap' | 'bulwark' | 'mend' | 'surge' | 'emp' | 'rally' | 'airstrike';

export interface SkillDef {
  id: SkillId;
  name: TextKey;
  text: TextKey;
}

/** What each skill does in a fight (`Battle.useSkill`); the skill texts in `i18n/` repeat these. */
export const SKILL_POWER = {
  /** Attack speed factor and how long it lasts. */
  overclock: { speed: 1.4, seconds: 5 },
  /** Damage to the toughest enemy and its stun. */
  zap: { damage: 260, stunS: 1.5 },
  /** Shield on every ally and how long it lasts. */
  bulwark: { shield: 180, seconds: 5 },
  /** Health given back to every ally. */
  mend: { heal: 220 },
  /** Every ally's charge is filled (no numbers). */
  surge: {},
  /** Every enemy loses its charge and is stunned this long. */
  emp: { stunS: 0.8 },
  /** Attack damage factor for allies and how long it lasts. */
  rally: { damage: 1.35, seconds: 6 },
  /** Damage to every enemy. */
  airstrike: { damage: 140 },
};

export const SKILLS: Record<SkillId, SkillDef> = {
  overclock: { id: 'overclock', name: 'overclockSkill', text: 'overclockText' },
  zap: { id: 'zap', name: 'zapSkill', text: 'zapText' },
  bulwark: { id: 'bulwark', name: 'bulwarkSkill', text: 'bulwarkText' },
  mend: { id: 'mend', name: 'mendSkill', text: 'mendText' },
  surge: { id: 'surge', name: 'surgeSkill', text: 'surgeText' },
  emp: { id: 'emp', name: 'empSkill', text: 'empText' },
  rally: { id: 'rally', name: 'rallySkill', text: 'rallyText' },
  airstrike: { id: 'airstrike', name: 'airstrikeSkill', text: 'airstrikeText' },
};

/**
 * Deeds a commander's unlock asks for, saved once done (`progress.ts`): finish in the top four, a
 * robot at three stars, a won fight with six robots of one origin, level 9, a won match.
 */
export type DeedId = 'topFour' | 'threeStar' | 'fullOrigin' | 'maxLevel' | 'champion';

export interface CommanderDef {
  name: TextKey;
  skill: SkillId;
  /** Body and trim colours of the avatar. */
  color: number;
  trim: number;
  /** Lines it calls out at the start and end of a fight (rivals only). */
  taunts: TextKey[];
  /** The deed that unlocks it (player commanders only); open from the start without one. */
  unlock?: DeedId;
}

/** The commanders the player picks from: three open from the start, five unlocked by deeds. */
export const PLAYER_COMMANDERS: CommanderDef[] = [
  { name: 'grit', skill: 'overclock', color: 0xffb703, trim: 0x2b2d42, taunts: [] },
  { name: 'sparks', skill: 'zap', color: 0x7cf3ff, trim: 0x3a2a8a, taunts: [] },
  { name: 'magna', skill: 'bulwark', color: 0xe0566a, trim: 0xf2f2f2, taunts: [] },
  { name: 'rosa', skill: 'mend', color: 0x4ccf6a, trim: 0xffffff, taunts: [], unlock: 'topFour' },
  { name: 'volt', skill: 'surge', color: 0x5aa9ff, trim: 0xffd166, taunts: [], unlock: 'threeStar' },
  { name: 'hexa', skill: 'emp', color: 0x9b5cff, trim: 0x39e58c, taunts: [], unlock: 'fullOrigin' },
  { name: 'ironside', skill: 'rally', color: 0x8a8f9e, trim: 0xd9822b, taunts: [], unlock: 'maxLevel' },
  { name: 'nova', skill: 'airstrike', color: 0xff8a2a, trim: 0x1a1030, taunts: [], unlock: 'champion' },
];

/** The seven rivals, in seat order. */
export const RIVALS: CommanderDef[] = [
  { name: 'baronBolt', skill: 'zap', color: 0x9b7be0, trim: 0xffd166, taunts: ['baronBolt1', 'baronBolt2', 'baronBolt3'] },
  { name: 'maRivet', skill: 'bulwark', color: 0x8bbf5a, trim: 0x5a3a1a, taunts: ['maRivet1', 'maRivet2', 'maRivet3'] },
  { name: 'captainCog', skill: 'overclock', color: 0x4fc3f7, trim: 0xffffff, taunts: ['captainCog1', 'captainCog2', 'captainCog3'] },
  { name: 'duchessDynamo', skill: 'zap', color: 0xff5cf0, trim: 0x1a1030, taunts: ['duchessDynamo1', 'duchessDynamo2', 'duchessDynamo3'] },
  { name: 'sirSprocket', skill: 'overclock', color: 0xd9822b, trim: 0x2b2d42, taunts: ['sirSprocket1', 'sirSprocket2', 'sirSprocket3'] },
  { name: 'widowWrench', skill: 'bulwark', color: 0x6b7a99, trim: 0xd0d8e8, taunts: ['widowWrench1', 'widowWrench2', 'widowWrench3'] },
  { name: 'tinpotTess', skill: 'zap', color: 0x39e58c, trim: 0x123a2a, taunts: ['tinpotTess1', 'tinpotTess2', 'tinpotTess3'] },
];

// ---------------------------------------------------------------- neutral monsters

export type MonsterId = 'mite' | 'hound' | 'crab' | 'golem' | 'crusher' | 'rat';

export interface MonsterDef {
  id: MonsterId;
  name: TextKey;
  hp: number;
  atk: number;
  as: number;
  range: number;
  armor: number;
  color: number;
}

export const MONSTERS: Record<MonsterId, MonsterDef> = {
  mite: { id: 'mite', name: 'mite', hp: 170, atk: 18, as: 0.6, range: 1, armor: 0, color: 0x8a8a9a },
  hound: { id: 'hound', name: 'hound', hp: 520, atk: 38, as: 0.7, range: 1, armor: 10, color: 0xb07a4a },
  crab: { id: 'crab', name: 'crab', hp: 780, atk: 40, as: 0.5, range: 1, armor: 45, color: 0xc0603a },
  golem: { id: 'golem', name: 'golem', hp: 1700, atk: 80, as: 0.55, range: 1, armor: 40, color: 0x7a8a6a },
  crusher: { id: 'crusher', name: 'crusher', hp: 5200, atk: 140, as: 0.5, range: 1, armor: 60, color: 0x5a5a6a },
  rat: { id: 'rat', name: 'rat', hp: 1400, atk: 0, as: 0, range: 0, armor: 20, color: 0xd0b060 },
};

/** How long the Scrap Rat runs before it escapes, in seconds, and the gold each hit on it shakes loose. */
export const RAT = { escapeS: 18, goldPerHit: 1, maxGold: 12, zapDamage: 60, zapCooldownS: 0.8 };

// ---------------------------------------------------------------- the match

export const BOARD = { cols: 8, rows: 8, ownRows: [4, 5, 6, 7] as const };
export const BENCH_SLOTS = 9;
export const SHOP_SLOTS = 5;
export const PLAYERS = 8;

export const ECONOMY = {
  startGold: 3,
  baseIncome: 5,
  /** Income in stage 1, where the rounds are short. */
  stageOneIncome: 3,
  interestPer: 10,
  interestCap: 5,
  rerollCost: 2,
  xpCost: 4,
  xpBuy: 4,
  xpPerRound: 2,
  /** Win or loss streak bonus by streak length (index), capped at the last. */
  streakBonus: [0, 0, 1, 1, 2, 3],
};

/** XP to go from level n to n + 1 (index n - 1). */
export const LEVEL_XP = [2, 6, 10, 20, 36, 56, 80, 100];
export const MAX_LEVEL = 9;

/** Shop odds in percent for costs 1 to 5, by level (index level - 1). */
export const SHOP_ODDS = [
  [100, 0, 0, 0, 0],
  [100, 0, 0, 0, 0],
  [75, 25, 0, 0, 0],
  [55, 30, 15, 0, 0],
  [45, 33, 20, 2, 0],
  [30, 40, 25, 5, 0],
  [19, 30, 35, 15, 1],
  [16, 20, 35, 25, 4],
  [9, 15, 30, 30, 16],
];

/** The chance each shop slot holds a gilded robot (two origins), from this level on. */
export const GILDED = { chance: 0.03, fromLevel: 5, extraCost: 2 };

/** Plan time per round in seconds, and how long the fight may last before both sides lose. */
export const PLAN_S = 30;
export const FIGHT_LIMIT_S = 40;
/** Seconds each seat gets to pick in a draft round. */
export const DRAFT_PICK_S = 8;

export type RoundKind = 'pvp' | 'neutral' | 'draft' | 'rat';

export interface RoundDef {
  stage: number;
  index: number;
  kind: RoundKind;
  monsters?: MonsterId[];
  /** A power card pick opens this round's plan phase. */
  augment?: boolean;
}

/** The rounds of stage `stage`; stage 1 is neutral, later stages repeat with tougher monsters. */
export function stageRounds(stage: number): RoundDef[] {
  if (stage === 1) {
    return [
      { stage, index: 1, kind: 'neutral', monsters: ['mite', 'mite'] },
      { stage, index: 2, kind: 'neutral', monsters: ['mite', 'mite', 'mite'] },
      { stage, index: 3, kind: 'neutral', monsters: ['hound', 'hound', 'crab'] },
      { stage, index: 4, kind: 'draft' },
    ];
  }
  const augmentAt = stage === 2 ? 1 : stage === 3 || stage === 4 ? 2 : 0;
  const last: RoundDef =
    stage === 2
      ? { stage, index: 7, kind: 'rat', monsters: ['rat'] }
      : { stage, index: 7, kind: 'neutral', monsters: stage === 3 ? ['golem', 'golem', 'crab', 'crab'] : stage === 4 ? ['crusher', 'golem', 'golem'] : ['crusher', 'crusher', 'golem', 'golem'] };
  return [1, 2, 3, 4, 5, 6].map((index): RoundDef => (index === 4 ? { stage, index, kind: 'draft' } : { stage, index, kind: 'pvp', augment: index === augmentAt })).concat(last);
}

/** Base damage a lost fight costs a commander by stage, plus this much per surviving robot by its cost. */
export function stageDamage(stage: number) {
  return Math.min(3 + Math.max(0, stage - 2) * 3, 15);
}
export const SURVIVOR_DAMAGE = [0, 1, 1, 2, 2, 3];

// ---------------------------------------------------------------- rank ladder

export interface RankDef {
  name: TextKey;
  /** What the rank changes for the rivals. */
  text: TextKey;
  /** Rank points needed. */
  points: number;
  /** Extra gold each rival gets a round. */
  gold: number;
  /** Rivals' shops roll as if they were this many levels higher. */
  odds: number;
  /** Rivals reroll for copies from this stage on, while they hold more than `rollAbove` gold. */
  rollFrom: number;
  rollAbove: number;
}

/** The saved rank ladder: points come from top-four finishes and never go down. Rust is the game as designed. */
export const RANKS: RankDef[] = [
  { name: 'rankRust', text: 'rankRustText', points: 0, gold: 0, odds: 0, rollFrom: 4, rollAbove: 50 },
  { name: 'rankIron', text: 'rankIronText', points: 100, gold: 0, odds: 0, rollFrom: 3, rollAbove: 40 },
  { name: 'rankSteel', text: 'rankSteelText', points: 250, gold: 1, odds: 0, rollFrom: 3, rollAbove: 36 },
  { name: 'rankChrome', text: 'rankChromeText', points: 450, gold: 1, odds: 1, rollFrom: 3, rollAbove: 32 },
  { name: 'rankTitan', text: 'rankTitanText', points: 700, gold: 2, odds: 1, rollFrom: 2, rollAbove: 28 },
];

/** Rank points by final place (index place; 1st to 4th score). */
export const RANK_POINTS = [0, 50, 35, 25, 15, 0, 0, 0, 0];

// ---------------------------------------------------------------- terrain

export type TerrainId = 'oil' | 'charger' | 'plate' | 'furnace';

export const TERRAIN: Record<TerrainId, { name: TextKey; text: TextKey; color: number }> = {
  oil: { name: 'oilName', text: 'oilText', color: 0x2a2a3a },
  charger: { name: 'chargerName', text: 'chargerText', color: 0x39e58c },
  plate: { name: 'steelName', text: 'steelText', color: 0xa8b2c8 },
  furnace: { name: 'furnaceName', text: 'furnaceText', color: 0xff8a2a },
};
/** Terrain tiles laid on each half of the board in terrain mode. */
export const TERRAIN_TILES = 4;
