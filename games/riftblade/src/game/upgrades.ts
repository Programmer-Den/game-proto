/**
 * Every upgrade a level-up card can offer: the heroes' own paths, the class and side pools (Blaster,
 * Blade, Current, Hollow) and the Gear deck, each with five tiers of its own and two more from the
 * specialisation it branches into at tier 5, plus the capstones (a path at tier 5 and its gear
 * piece), the crossovers (a pool skill held with a fitting path) and the fusions (two skills at
 * tier 3 fused into a third that locks out its rivals). Names and texts are keys of `i18n/en.ts`,
 * shown with `t`.
 */
import { HEROES, type HeroId, type PoolId } from './heroes';
import type { TextKey } from '../i18n';
import { rand } from './weekly';

export type UpgradeKind = 'path' | 'pool' | 'gear';

export interface UpgradeDef {
  id: string;
  kind: UpgradeKind;
  name: TextKey;
  /** The hero whose path this is (paths only). */
  hero?: HeroId;
  /** The pool a pool skill belongs to (pool skills only). */
  pool?: PoolId;
  /** What the upgrade does, one short line. */
  blurb: TextKey;
  /** What each of the five tiers adds, in order. */
  tiers: readonly [TextKey, TextKey, TextKey, TextKey, TextKey];
}

/** The tiers an upgrade's own card gives; tiers 6 and 7 come from one of its specialisations. */
export const BASE_TIER = 5;
/** An upgrade's last tier: its five own tiers and two of the specialisation picked at tier 5. */
export const MAX_TIER = 7;
/** A run holds at most this many abilities (paths and pool skills) and this many gear pieces. */
export const MAX_ABILITIES = 7;
export const MAX_GEAR = 5;

/** What one tier of a drill adds; `drillMods` in state.ts sums them into the stats. */
export type DrillStep = 'damage' | 'damageBig' | 'health' | 'healthBig' | 'armour' | 'speed' | 'crit' | 'regen' | 'regenBig' | 'sig' | 'fire';
/** Each step's numbers: damage and fire rate as a share, health in points, armour and crit as a share, regen per second. */
export const DRILL_STEPS: Record<DrillStep, { damage?: number; hp?: number; armour?: number; speed?: number; crit?: number; regen?: number; sig?: number; fireRate?: number }> = {
  damage: { damage: 0.08 },
  damageBig: { damage: 0.15 },
  health: { hp: 20 },
  healthBig: { hp: 30 },
  armour: { armour: 0.06 },
  speed: { speed: 0.06 },
  crit: { crit: 0.06 },
  regen: { regen: 0.5 },
  regenBig: { regen: 1 },
  sig: { sig: 0.15 },
  fire: { fireRate: 0.15 },
};
/** The tier line of each step. */
const DRILL_TEXT: Record<DrillStep, TextKey> = {
  damage: 'drillDamage', damageBig: 'drillDamageBig', health: 'drillHealth', healthBig: 'drillHealthBig', armour: 'drillArmour',
  speed: 'drillSpeed', crit: 'drillCrit', regen: 'drillRegen', regenBig: 'drillRegenBig', sig: 'drillSig', fire: 'drillFire',
};

/** Each hero's drill: a fourth path of plain gains, five steps in order. */
export const DRILLS: Record<HeroId, { id: string; name: TextKey; blurb: TextKey; steps: readonly [DrillStep, DrillStep, DrillStep, DrillStep, DrillStep] }> = {
  rook: { id: 'old-soldier', name: 'oldSoldierName', blurb: 'oldSoldierBlurb', steps: ['health', 'regen', 'damage', 'regenBig', 'fire'] },
  tr9: { id: 'garrison', name: 'garrisonName', blurb: 'garrisonBlurb', steps: ['damage', 'regen', 'damage', 'sig', 'fire'] },
  bram: { id: 'field-kit', name: 'fieldKitName', blurb: 'fieldKitBlurb', steps: ['regen', 'damage', 'health', 'regenBig', 'fire'] },
  kael: { id: 'momentum', name: 'momentumName', blurb: 'momentumBlurb', steps: ['health', 'damage', 'regen', 'speed', 'damageBig'] },
  vharn: { id: 'juggernaut', name: 'juggernautName', blurb: 'juggernautBlurb', steps: ['healthBig', 'damage', 'armour', 'healthBig', 'damageBig'] },
  oom: { id: 'inner-calm', name: 'innerCalmName', blurb: 'innerCalmBlurb', steps: ['health', 'regen', 'sig', 'healthBig', 'regenBig'] },
  corvin: { id: 'old-guard', name: 'oldGuardName', blurb: 'oldGuardBlurb', steps: ['health', 'armour', 'damage', 'regenBig', 'damageBig'] },
  veyl: { id: 'cold-ambition', name: 'coldAmbitionName', blurb: 'coldAmbitionBlurb', steps: ['damage', 'crit', 'damage', 'sig', 'damageBig'] },
  kresh: { id: 'scavenger', name: 'scavengerName', blurb: 'scavengerBlurb', steps: ['health', 'regen', 'damage', 'healthBig', 'regenBig'] },
  joren: { id: 'swordmaster', name: 'swordmasterName', blurb: 'swordmasterBlurb', steps: ['health', 'regen', 'damage', 'healthBig', 'regenBig'] },
  elara: { id: 'resistance-cell', name: 'resistanceCellName', blurb: 'resistanceCellBlurb', steps: ['damage', 'health', 'sig', 'fire', 'damageBig'] },
  triad: { id: 'hardened-chassis', name: 'hardenedChassisName', blurb: 'hardenedChassisBlurb', steps: ['armour', 'damage', 'armour', 'fire', 'damageBig'] },
  dax: { id: 'old-hand', name: 'oldHandName', blurb: 'oldHandBlurb', steps: ['damage', 'fire', 'health', 'crit', 'damageBig'] },
  grunda: { id: 'thick-fur', name: 'thickFurName', blurb: 'thickFurBlurb', steps: ['healthBig', 'armour', 'damage', 'regenBig', 'damageBig'] },
  kettle: { id: 'self-repair', name: 'selfRepairName', blurb: 'selfRepairBlurb', steps: ['health', 'regen', 'speed', 'regenBig', 'damageBig'] },
  cassia: { id: 'tradecraft', name: 'tradecraftName', blurb: 'tradecraftBlurb', steps: ['damage', 'crit', 'speed', 'damage', 'damageBig'] },
  vesk: { id: 'hunters-code', name: 'huntersCodeName', blurb: 'huntersCodeBlurb', steps: ['health', 'armour', 'damage', 'healthBig', 'damageBig'] },
  rena: { id: 'flight-hours', name: 'flightHoursName', blurb: 'flightHoursBlurb', steps: ['speed', 'damage', 'health', 'fire', 'damageBig'] },
  thessa: { id: 'chain-of-command', name: 'chainOfCommandName', blurb: 'chainOfCommandBlurb', steps: ['damage', 'sig', 'health', 'crit', 'damageBig'] },
  wikka: { id: 'forest-born', name: 'forestBornName', blurb: 'forestBornBlurb', steps: ['speed', 'health', 'regen', 'damage', 'damageBig'] },
};

function drillDefs(): UpgradeDef[] {
  return (Object.keys(DRILLS) as HeroId[]).map((hero) => {
    const d = DRILLS[hero];
    const tiers = d.steps.map((step) => DRILL_TEXT[step]) as unknown as UpgradeDef['tiers'];
    return { id: d.id, kind: 'path', hero, name: d.name, blurb: d.blurb, tiers };
  });
}

const defs: UpgradeDef[] = [
  // Captain Rook
  {
    id: 'gunslinger', kind: 'path', hero: 'rook', name: 'gunslingerName', blurb: 'gunslingerBlurb',
    tiers: ['gunslinger1', 'gunslinger2', 'gunslinger3', 'gunslinger4', 'gunslinger5'],
  },
  {
    id: 'commander', kind: 'path', hero: 'rook', name: 'commanderName', blurb: 'commanderBlurb',
    tiers: ['commander1', 'commander2', 'commander3', 'commander4', 'commander5'],
  },
  {
    id: 'demolitions', kind: 'path', hero: 'rook', name: 'demolitionsName', blurb: 'demolitionsBlurb',
    tiers: ['demolitions1', 'demolitions2', 'demolitions3', 'demolitions4', 'demolitions5'],
  },
  // Legionary TR-9
  {
    id: 'suppressor', kind: 'path', hero: 'tr9', name: 'suppressorName', blurb: 'suppressorBlurb',
    tiers: ['suppressor1', 'suppressor2', 'suppressor3', 'suppressor4', 'suppressor5'],
  },
  {
    id: 'riot-shield', kind: 'path', hero: 'tr9', name: 'riotShieldName', blurb: 'riotShieldBlurb',
    tiers: ['riotShield1', 'riotShield2', 'riotShield3', 'riotShield4', 'riotShield5'],
  },
  {
    id: 'drop-doctrine', kind: 'path', hero: 'tr9', name: 'dropDoctrineName', blurb: 'dropDoctrineBlurb',
    tiers: ['dropDoctrine1', 'dropDoctrine2', 'dropDoctrine3', 'dropDoctrine4', 'dropDoctrine5'],
  },
  // Corporal Bram-17
  {
    id: 'marksman', kind: 'path', hero: 'bram', name: 'marksmanName', blurb: 'marksmanBlurb',
    tiers: ['marksman1', 'marksman2', 'marksman3', 'marksman4', 'marksman5'],
  },
  {
    id: 'jump-trooper', kind: 'path', hero: 'bram', name: 'jumpTrooperName', blurb: 'jumpTrooperBlurb',
    tiers: ['jumpTrooper1', 'jumpTrooper2', 'jumpTrooper3', 'jumpTrooper4', 'jumpTrooper5'],
  },
  {
    id: 'brothers', kind: 'path', hero: 'bram', name: 'brothersName', blurb: 'brothersBlurb',
    tiers: ['brothers1', 'brothers2', 'brothers3', 'brothers4', 'brothers5'],
  },
  // Commander Elara Voss
  {
    id: 'sharpshooter', kind: 'path', hero: 'elara', name: 'sharpshooterName', blurb: 'sharpshooterBlurb',
    tiers: ['sharpshooter1', 'sharpshooter2', 'sharpshooter3', 'sharpshooter4', 'sharpshooter5'],
  },
  {
    id: 'rebel-network', kind: 'path', hero: 'elara', name: 'rebelNetworkName', blurb: 'rebelNetworkBlurb',
    tiers: ['rebelNetwork1', 'rebelNetwork2', 'rebelNetwork3', 'rebelNetwork4', 'rebelNetwork5'],
  },
  {
    id: 'diplomat', kind: 'path', hero: 'elara', name: 'diplomatName', blurb: 'diplomatBlurb',
    tiers: ['diplomat1', 'diplomat2', 'diplomat3', 'diplomat4', 'diplomat5'],
  },
  // Triad-77
  {
    id: 'firing-line', kind: 'path', hero: 'triad', name: 'firingLineName', blurb: 'firingLineBlurb',
    tiers: ['firingLine1', 'firingLine2', 'firingLine3', 'firingLine4', 'firingLine5'],
  },
  {
    id: 'factory', kind: 'path', hero: 'triad', name: 'factoryName', blurb: 'factoryBlurb',
    tiers: ['factory1', 'factory2', 'factory3', 'factory4', 'factory5'],
  },
  {
    id: 'uplink', kind: 'path', hero: 'triad', name: 'uplinkName', blurb: 'uplinkBlurb',
    tiers: ['uplink1', 'uplink2', 'uplink3', 'uplink4', 'uplink5'],
  },
  // Dax Morrow
  {
    id: 'fast-hands', kind: 'path', hero: 'dax', name: 'fastHandsName', blurb: 'fastHandsBlurb',
    tiers: ['fastHands1', 'fastHands2', 'fastHands3', 'fastHands4', 'fastHands5'],
  },
  {
    id: 'smugglers-run', kind: 'path', hero: 'dax', name: 'smugglersRunName', blurb: 'smugglersRunBlurb',
    tiers: ['smugglersRun1', 'smugglersRun2', 'smugglersRun3', 'smugglersRun4', 'smugglersRun5'],
  },
  {
    id: 'lucky-streak', kind: 'path', hero: 'dax', name: 'luckyStreakName', blurb: 'luckyStreakBlurb',
    tiers: ['luckyStreak1', 'luckyStreak2', 'luckyStreak3', 'luckyStreak4', 'luckyStreak5'],
  },
  // Grunda
  {
    id: 'heavy-bolts', kind: 'path', hero: 'grunda', name: 'heavyBoltsName', blurb: 'heavyBoltsBlurb',
    tiers: ['heavyBolts1', 'heavyBolts2', 'heavyBolts3', 'heavyBolts4', 'heavyBolts5'],
  },
  {
    id: 'wild-heart', kind: 'path', hero: 'grunda', name: 'wildHeartName', blurb: 'wildHeartBlurb',
    tiers: ['wildHeart1', 'wildHeart2', 'wildHeart3', 'wildHeart4', 'wildHeart5'],
  },
  {
    id: 'warcry', kind: 'path', hero: 'grunda', name: 'warcryName', blurb: 'warcryBlurb',
    tiers: ['warcry1', 'warcry2', 'warcry3', 'warcry4', 'warcry5'],
  },
  // KT-4 "Kettle"
  {
    id: 'prod', kind: 'path', hero: 'kettle', name: 'prodName', blurb: 'prodBlurb',
    tiers: ['prod1', 'prod2', 'prod3', 'prod4', 'prod5'],
  },
  {
    id: 'hacker', kind: 'path', hero: 'kettle', name: 'hackerName', blurb: 'hackerBlurb',
    tiers: ['hacker1', 'hacker2', 'hacker3', 'hacker4', 'hacker5'],
  },
  {
    id: 'spare-parts', kind: 'path', hero: 'kettle', name: 'sparePartsName', blurb: 'sparePartsBlurb',
    tiers: ['spareParts1', 'spareParts2', 'spareParts3', 'spareParts4', 'spareParts5'],
  },
  // Cassia Vane
  {
    id: 'deadeye', kind: 'path', hero: 'cassia', name: 'deadeyeName', blurb: 'deadeyeBlurb',
    tiers: ['deadeye1', 'deadeye2', 'deadeye3', 'deadeye4', 'deadeye5'],
  },
  {
    id: 'ghost', kind: 'path', hero: 'cassia', name: 'ghostName', blurb: 'ghostBlurb',
    tiers: ['ghost1', 'ghost2', 'ghost3', 'ghost4', 'ghost5'],
  },
  {
    id: 'spymaster', kind: 'path', hero: 'cassia', name: 'spymasterName', blurb: 'spymasterBlurb',
    tiers: ['spymaster1', 'spymaster2', 'spymaster3', 'spymaster4', 'spymaster5'],
  },
  // Vesk Drayl
  {
    id: 'arsenal', kind: 'path', hero: 'vesk', name: 'arsenalName', blurb: 'arsenalBlurb',
    tiers: ['arsenal1', 'arsenal2', 'arsenal3', 'arsenal4', 'arsenal5'],
  },
  {
    id: 'scorched-earth', kind: 'path', hero: 'vesk', name: 'scorchedEarthName', blurb: 'scorchedEarthBlurb',
    tiers: ['scorchedEarth1', 'scorchedEarth2', 'scorchedEarth3', 'scorchedEarth4', 'scorchedEarth5'],
  },
  {
    id: 'bounty', kind: 'path', hero: 'vesk', name: 'bountyName', blurb: 'bountyBlurb',
    tiers: ['bounty1', 'bounty2', 'bounty3', 'bounty4', 'bounty5'],
  },
  // Rena Kask
  {
    id: 'afterburner', kind: 'path', hero: 'rena', name: 'afterburnerName', blurb: 'afterburnerBlurb',
    tiers: ['afterburner1', 'afterburner2', 'afterburner3', 'afterburner4', 'afterburner5'],
  },
  {
    id: 'gunship', kind: 'path', hero: 'rena', name: 'gunshipName', blurb: 'gunshipBlurb',
    tiers: ['gunship1', 'gunship2', 'gunship3', 'gunship4', 'gunship5'],
  },
  {
    id: 'wingmates', kind: 'path', hero: 'rena', name: 'wingmatesName', blurb: 'wingmatesBlurb',
    tiers: ['wingmates1', 'wingmates2', 'wingmates3', 'wingmates4', 'wingmates5'],
  },
  // Admiral Thessa Orn
  {
    id: 'fleet-command', kind: 'path', hero: 'thessa', name: 'fleetCommandName', blurb: 'fleetCommandBlurb',
    tiers: ['fleetCommand1', 'fleetCommand2', 'fleetCommand3', 'fleetCommand4', 'fleetCommand5'],
  },
  {
    id: 'iron-ring', kind: 'path', hero: 'thessa', name: 'ironRingName', blurb: 'ironRingBlurb',
    tiers: ['ironRing1', 'ironRing2', 'ironRing3', 'ironRing4', 'ironRing5'],
  },
  {
    id: 'tactician', kind: 'path', hero: 'thessa', name: 'tacticianName', blurb: 'tacticianBlurb',
    tiers: ['tactician1', 'tactician2', 'tactician3', 'tactician4', 'tactician5'],
  },
  // Chief Wikka
  {
    id: 'slinger', kind: 'path', hero: 'wikka', name: 'slingerName', blurb: 'slingerBlurb',
    tiers: ['slinger1', 'slinger2', 'slinger3', 'slinger4', 'slinger5'],
  },
  {
    id: 'log-traps', kind: 'path', hero: 'wikka', name: 'logTrapsName', blurb: 'logTrapsBlurb',
    tiers: ['logTraps1', 'logTraps2', 'logTraps3', 'logTraps4', 'logTraps5'],
  },
  {
    id: 'tribe', kind: 'path', hero: 'wikka', name: 'tribeName', blurb: 'tribeBlurb',
    tiers: ['tribe1', 'tribe2', 'tribe3', 'tribe4', 'tribe5'],
  },
  // The Blaster pool
  {
    id: 'ricochet', kind: 'pool', pool: 'blaster', name: 'ricochetName', blurb: 'ricochetBlurb',
    tiers: ['ricochet1', 'ricochet2', 'ricochet3', 'ricochet4', 'ricochet5'],
  },
  {
    id: 'overcharge', kind: 'pool', pool: 'blaster', name: 'overchargeName', blurb: 'overchargeBlurb',
    tiers: ['overcharge1', 'overcharge2', 'overcharge3', 'overcharge4', 'overcharge5'],
  },
  {
    id: 'thermal', kind: 'pool', pool: 'blaster', name: 'thermalName', blurb: 'thermalBlurb',
    tiers: ['thermal1', 'thermal2', 'thermal3', 'thermal4', 'thermal5'],
  },
  {
    id: 'stun', kind: 'pool', pool: 'blaster', name: 'stunName', blurb: 'stunBlurb',
    tiers: ['stun1', 'stun2', 'stun3', 'stun4', 'stun5'],
  },
  {
    id: 'reload', kind: 'pool', pool: 'blaster', name: 'reloadName', blurb: 'reloadBlurb',
    tiers: ['reload1', 'reload2', 'reload3', 'reload4', 'reload5'],
  },
  {
    id: 'drone', kind: 'pool', pool: 'blaster', name: 'droneName', blurb: 'droneBlurb',
    tiers: ['drone1', 'drone2', 'drone3', 'drone4', 'drone5'],
  },
  {
    id: 'scatter', kind: 'pool', pool: 'blaster', name: 'scatterName', blurb: 'scatterBlurb',
    tiers: ['scatter1', 'scatter2', 'scatter3', 'scatter4', 'scatter5'],
  },
  {
    id: 'callin', kind: 'pool', pool: 'blaster', name: 'callinName', blurb: 'callinBlurb',
    tiers: ['callin1', 'callin2', 'callin3', 'callin4', 'callin5'],
  },

  {
    id: 'orbital-beacon', kind: 'pool', pool: 'blaster', name: 'orbitalBeaconName', blurb: 'orbitalBeaconBlurb',
    tiers: ['orbitalBeacon1', 'orbitalBeacon2', 'orbitalBeacon3', 'orbitalBeacon4', 'orbitalBeacon5'],
  },
  {
    id: 'executioner', kind: 'pool', pool: 'blaster', name: 'executionerName', blurb: 'executionerBlurb',
    tiers: ['executioner1', 'executioner2', 'executioner3', 'executioner4', 'executioner5'],
  },

  // Kael Varro
  {
    id: 'prodigy', kind: 'path', hero: 'kael', name: 'prodigyName', blurb: 'prodigyBlurb',
    tiers: ['prodigy1', 'prodigy2', 'prodigy3', 'prodigy4', 'prodigy5'],
  },
  {
    id: 'ace-pilot', kind: 'path', hero: 'kael', name: 'acePilotName', blurb: 'acePilotBlurb',
    tiers: ['acePilot1', 'acePilot2', 'acePilot3', 'acePilot4', 'acePilot5'],
  },
  {
    id: 'the-fall', kind: 'path', hero: 'kael', name: 'theFallName', blurb: 'theFallBlurb',
    tiers: ['theFall1', 'theFall2', 'theFall3', 'theFall4', 'theFall5'],
  },
  // Lord Vharn
  {
    id: 'dread', kind: 'path', hero: 'vharn', name: 'dreadName', blurb: 'dreadBlurb',
    tiers: ['dread1', 'dread2', 'dread3', 'dread4', 'dread5'],
  },
  {
    id: 'iron-grip', kind: 'path', hero: 'vharn', name: 'ironGripName', blurb: 'ironGripBlurb',
    tiers: ['ironGrip1', 'ironGrip2', 'ironGrip3', 'ironGrip4', 'ironGrip5'],
  },
  {
    id: 'life-support', kind: 'path', hero: 'vharn', name: 'lifeSupportName', blurb: 'lifeSupportBlurb',
    tiers: ['lifeSupport1', 'lifeSupport2', 'lifeSupport3', 'lifeSupport4', 'lifeSupport5'],
  },
  // Master Oom
  {
    id: 'stillness', kind: 'path', hero: 'oom', name: 'stillnessName', blurb: 'stillnessBlurb',
    tiers: ['stillness1', 'stillness2', 'stillness3', 'stillness4', 'stillness5'],
  },
  {
    id: 'whirlwind', kind: 'path', hero: 'oom', name: 'whirlwindName', blurb: 'whirlwindBlurb',
    tiers: ['whirlwind1', 'whirlwind2', 'whirlwind3', 'whirlwind4', 'whirlwind5'],
  },
  {
    id: 'old-teacher', kind: 'path', hero: 'oom', name: 'oldTeacherName', blurb: 'oldTeacherBlurb',
    tiers: ['oldTeacher1', 'oldTeacher2', 'oldTeacher3', 'oldTeacher4', 'oldTeacher5'],
  },
  // Elder Corvin Hale
  {
    id: 'bulwark', kind: 'path', hero: 'corvin', name: 'bulwarkName', blurb: 'bulwarkBlurb',
    tiers: ['bulwark1', 'bulwark2', 'bulwark3', 'bulwark4', 'bulwark5'],
  },
  {
    id: 'persuasion', kind: 'path', hero: 'corvin', name: 'persuasionName', blurb: 'persuasionBlurb',
    tiers: ['persuasion1', 'persuasion2', 'persuasion3', 'persuasion4', 'persuasion5'],
  },
  {
    id: 'vantage', kind: 'path', hero: 'corvin', name: 'vantageName', blurb: 'vantageBlurb',
    tiers: ['vantage1', 'vantage2', 'vantage3', 'vantage4', 'vantage5'],
  },
  // Regent Veyl
  {
    id: 'storm', kind: 'path', hero: 'veyl', name: 'stormName', blurb: 'stormBlurb',
    tiers: ['storm1', 'storm2', 'storm3', 'storm4', 'storm5'],
  },
  {
    id: 'puppet-master', kind: 'path', hero: 'veyl', name: 'puppetMasterName', blurb: 'puppetMasterBlurb',
    tiers: ['puppetMaster1', 'puppetMaster2', 'puppetMaster3', 'puppetMaster4', 'puppetMaster5'],
  },
  {
    id: 'dark-bargain', kind: 'path', hero: 'veyl', name: 'darkBargainName', blurb: 'darkBargainBlurb',
    tiers: ['darkBargain1', 'darkBargain2', 'darkBargain3', 'darkBargain4', 'darkBargain5'],
  },
  // Kresh the Twinblade
  {
    id: 'dervish', kind: 'path', hero: 'kresh', name: 'dervishName', blurb: 'dervishBlurb',
    tiers: ['dervish1', 'dervish2', 'dervish3', 'dervish4', 'dervish5'],
  },
  {
    id: 'stalker', kind: 'path', hero: 'kresh', name: 'stalkerName', blurb: 'stalkerBlurb',
    tiers: ['stalker1', 'stalker2', 'stalker3', 'stalker4', 'stalker5'],
  },
  {
    id: 'rebuilt', kind: 'path', hero: 'kresh', name: 'rebuiltName', blurb: 'rebuiltBlurb',
    tiers: ['rebuilt1', 'rebuilt2', 'rebuilt3', 'rebuilt4', 'rebuilt5'],
  },
  // Master Joren Vask
  {
    id: 'duelist', kind: 'path', hero: 'joren', name: 'duelistName', blurb: 'duelistBlurb',
    tiers: ['duelist1', 'duelist2', 'duelist3', 'duelist4', 'duelist5'],
  },
  {
    id: 'breaker', kind: 'path', hero: 'joren', name: 'breakerName', blurb: 'breakerBlurb',
    tiers: ['breaker1', 'breaker2', 'breaker3', 'breaker4', 'breaker5'],
  },
  {
    id: 'council-seat', kind: 'path', hero: 'joren', name: 'councilSeatName', blurb: 'councilSeatBlurb',
    tiers: ['councilSeat1', 'councilSeat2', 'councilSeat3', 'councilSeat4', 'councilSeat5'],
  },
  // The Blade pool
  {
    id: 'blade-throw', kind: 'pool', pool: 'blade', name: 'bladeThrowName', blurb: 'bladeThrowBlurb',
    tiers: ['bladeThrow1', 'bladeThrow2', 'bladeThrow3', 'bladeThrow4', 'bladeThrow5'],
  },
  {
    id: 'wide-arc', kind: 'pool', pool: 'blade', name: 'wideArcName', blurb: 'wideArcBlurb',
    tiers: ['wideArc1', 'wideArc2', 'wideArc3', 'wideArc4', 'wideArc5'],
  },
  {
    id: 'riposte', kind: 'pool', pool: 'blade', name: 'riposteName', blurb: 'riposteBlurb',
    tiers: ['riposte1', 'riposte2', 'riposte3', 'riposte4', 'riposte5'],
  },
  {
    id: 'blade-dash', kind: 'pool', pool: 'blade', name: 'bladeDashName', blurb: 'bladeDashBlurb',
    tiers: ['bladeDash1', 'bladeDash2', 'bladeDash3', 'bladeDash4', 'bladeDash5'],
  },
  {
    id: 'spinning-guard', kind: 'pool', pool: 'blade', name: 'spinningGuardName', blurb: 'spinningGuardBlurb',
    tiers: ['spinningGuard1', 'spinningGuard2', 'spinningGuard3', 'spinningGuard4', 'spinningGuard5'],
  },
  {
    id: 'focus', kind: 'pool', pool: 'blade', name: 'focusName', blurb: 'focusBlurb',
    tiers: ['focus1', 'focus2', 'focus3', 'focus4', 'focus5'],
  },
  {
    id: 'crescent', kind: 'pool', pool: 'blade', name: 'crescentName', blurb: 'crescentBlurb',
    tiers: ['crescent1', 'crescent2', 'crescent3', 'crescent4', 'crescent5'],
  },
  {
    id: 'iron-skin', kind: 'pool', pool: 'blade', name: 'ironSkinName', blurb: 'ironSkinBlurb',
    tiers: ['ironSkin1', 'ironSkin2', 'ironSkin3', 'ironSkin4', 'ironSkin5'],
  },
  // The Current pool
  {
    id: 'push-wave', kind: 'pool', pool: 'current', name: 'pushWaveName', blurb: 'pushWaveBlurb',
    tiers: ['pushWave1', 'pushWave2', 'pushWave3', 'pushWave4', 'pushWave5'],
  },
  {
    id: 'mending', kind: 'pool', pool: 'current', name: 'mendingName', blurb: 'mendingBlurb',
    tiers: ['mending1', 'mending2', 'mending3', 'mending4', 'mending5'],
  },
  {
    id: 'foresight', kind: 'pool', pool: 'current', name: 'foresightName', blurb: 'foresightBlurb',
    tiers: ['foresight1', 'foresight2', 'foresight3', 'foresight4', 'foresight5'],
  },
  {
    id: 'calm-mind', kind: 'pool', pool: 'current', name: 'calmMindName', blurb: 'calmMindBlurb',
    tiers: ['calmMind1', 'calmMind2', 'calmMind3', 'calmMind4', 'calmMind5'],
  },
  {
    id: 'stasis', kind: 'pool', pool: 'current', name: 'stasisName', blurb: 'stasisBlurb',
    tiers: ['stasis1', 'stasis2', 'stasis3', 'stasis4', 'stasis5'],
  },
  {
    id: 'battle-trance', kind: 'pool', pool: 'current', name: 'battleTranceName', blurb: 'battleTranceBlurb',
    tiers: ['battleTrance1', 'battleTrance2', 'battleTrance3', 'battleTrance4', 'battleTrance5'],
  },
  // The Hollow pool
  {
    id: 'lightning-arc', kind: 'pool', pool: 'hollow', name: 'lightningArcName', blurb: 'lightningArcBlurb',
    tiers: ['lightningArc1', 'lightningArc2', 'lightningArc3', 'lightningArc4', 'lightningArc5'],
  },
  {
    id: 'grip', kind: 'pool', pool: 'hollow', name: 'gripName', blurb: 'gripBlurb',
    tiers: ['grip1', 'grip2', 'grip3', 'grip4', 'grip5'],
  },
  {
    id: 'rage', kind: 'pool', pool: 'hollow', name: 'rageName', blurb: 'rageBlurb',
    tiers: ['rage1', 'rage2', 'rage3', 'rage4', 'rage5'],
  },
  {
    id: 'drain', kind: 'pool', pool: 'hollow', name: 'drainName', blurb: 'drainBlurb',
    tiers: ['drain1', 'drain2', 'drain3', 'drain4', 'drain5'],
  },
  {
    id: 'dark-nova', kind: 'pool', pool: 'hollow', name: 'darkNovaName', blurb: 'darkNovaBlurb',
    tiers: ['darkNova1', 'darkNova2', 'darkNova3', 'darkNova4', 'darkNova5'],
  },
  {
    id: 'soul-harvest', kind: 'pool', pool: 'hollow', name: 'soulHarvestName', blurb: 'soulHarvestBlurb',
    tiers: ['soulHarvest1', 'soulHarvest2', 'soulHarvest3', 'soulHarvest4', 'soulHarvest5'],
  },
  // The Gear deck
  { id: 'boots', kind: 'gear', name: 'bootsName', blurb: 'bootsBlurb', tiers: ['boots1', 'boots2', 'boots3', 'boots4', 'boots5'] },
  { id: 'magnet', kind: 'gear', name: 'magnetName', blurb: 'magnetBlurb', tiers: ['magnet1', 'magnet2', 'magnet3', 'magnet4', 'magnet5'] },
  { id: 'armour', kind: 'gear', name: 'armourName', blurb: 'armourBlurb', tiers: ['armour1', 'armour2', 'armour3', 'armour4', 'armour5'] },
  { id: 'overclock', kind: 'gear', name: 'overclockName', blurb: 'overclockBlurb', tiers: ['overclock1', 'overclock2', 'overclock3', 'overclock4', 'overclock5'] },
  { id: 'medpack', kind: 'gear', name: 'medpackName', blurb: 'medpackBlurb', tiers: ['medpack1', 'medpack2', 'medpack3', 'medpack4', 'medpack5'] },
  { id: 'cell', kind: 'gear', name: 'cellName', blurb: 'cellBlurb', tiers: ['cell1', 'cell2', 'cell3', 'cell4', 'cell5'] },
  { id: 'lens', kind: 'gear', name: 'lensName', blurb: 'lensBlurb', tiers: ['lens1', 'lens2', 'lens3', 'lens4', 'lens5'] },
  { id: 'chip', kind: 'gear', name: 'chipName', blurb: 'chipBlurb', tiers: ['chip1', 'chip2', 'chip3', 'chip4', 'chip5'] },
  { id: 'scanner', kind: 'gear', name: 'scannerName', blurb: 'scannerBlurb', tiers: ['scanner1', 'scanner2', 'scanner3', 'scanner4', 'scanner5'] },
  { id: 'salvager', kind: 'gear', name: 'salvagerName', blurb: 'salvagerBlurb', tiers: ['salvager1', 'salvager2', 'salvager3', 'salvager4', 'salvager5'] },
  { id: 'barrier', kind: 'gear', name: 'barrierName', blurb: 'barrierBlurb', tiers: ['barrier1', 'barrier2', 'barrier3', 'barrier4', 'barrier5'] },
  { id: 'stim', kind: 'gear', name: 'stimName', blurb: 'stimBlurb', tiers: ['stim1', 'stim2', 'stim3', 'stim4', 'stim5'] },
  // Each hero's fourth path, its drill: plain numbers per tier (`DRILLS`), read by `statsOf`.
  ...drillDefs(),
];

export const UPGRADES: Record<string, UpgradeDef> = Object.fromEntries(defs.map((d) => [d.id, d]));
export const UPGRADE_IDS = defs.map((d) => d.id);

/** The card taken when nothing else is left to offer. */
export const FILLER: { id: 'ration'; name: TextKey; text: TextKey } = { id: 'ration', name: 'rationName', text: 'rationText' };

export interface CapstoneDef {
  id: string;
  name: TextKey;
  hero: HeroId;
  path: string;
  gear: string;
  text: TextKey;
}

/** A path at tier 5 together with its gear piece (any tier) unlocks the path's capstone at once. */
export const CAPSTONES: readonly CapstoneDef[] = [
  { id: 'twin-storm', name: 'twinStormName', hero: 'rook', path: 'gunslinger', gear: 'overclock', text: 'twinStormText' },
  { id: 'last-company', name: 'lastCompanyName', hero: 'rook', path: 'commander', gear: 'armour', text: 'lastCompanyText' },
  { id: 'carpet-strike', name: 'carpetStrikeName', hero: 'rook', path: 'demolitions', gear: 'magnet', text: 'carpetStrikeText' },
  { id: 'hailstorm', name: 'hailstormName', hero: 'tr9', path: 'suppressor', gear: 'overclock', text: 'hailstormText' },
  { id: 'phalanx', name: 'phalanxName', hero: 'tr9', path: 'riot-shield', gear: 'armour', text: 'phalanxText' },
  { id: 'orbital-drop', name: 'orbitalDropName', hero: 'tr9', path: 'drop-doctrine', gear: 'boots', text: 'orbitalDropText' },
  { id: 'longshot', name: 'longshotName', hero: 'bram', path: 'marksman', gear: 'magnet', text: 'longshotText' },
  { id: 'skyfall', name: 'skyfallName', hero: 'bram', path: 'jump-trooper', gear: 'boots', text: 'skyfallText' },
  { id: 'the-batch', name: 'theBatchName', hero: 'bram', path: 'brothers', gear: 'medpack', text: 'theBatchText' },
  { id: 'perfect-form', name: 'perfectFormName', hero: 'kael', path: 'prodigy', gear: 'overclock', text: 'perfectFormText' },
  { id: 'squadron-run', name: 'squadronRunName', hero: 'kael', path: 'ace-pilot', gear: 'boots', text: 'squadronRunText' },
  { id: 'hollow-rebirth', name: 'hollowRebirthName', hero: 'kael', path: 'the-fall', gear: 'armour', text: 'hollowRebirthText' },
  { id: 'terror', name: 'terrorName', hero: 'vharn', path: 'dread', gear: 'magnet', text: 'terrorText' },
  { id: 'crushing-will', name: 'crushingWillName', hero: 'vharn', path: 'iron-grip', gear: 'overclock', text: 'crushingWillText' },
  { id: 'unbreakable', name: 'unbreakableName', hero: 'vharn', path: 'life-support', gear: 'medpack', text: 'unbreakableText' },
  { id: 'lift-the-ship', name: 'liftTheShipName', hero: 'oom', path: 'stillness', gear: 'armour', text: 'liftTheShipText' },
  { id: 'golden-cyclone', name: 'goldenCycloneName', hero: 'oom', path: 'whirlwind', gear: 'boots', text: 'goldenCycloneText' },
  { id: 'council-of-spirits', name: 'councilOfSpiritsName', hero: 'oom', path: 'old-teacher', gear: 'medpack', text: 'councilOfSpiritsText' },
  { id: 'perfect-guard', name: 'perfectGuardName', hero: 'corvin', path: 'bulwark', gear: 'armour', text: 'perfectGuardText' },
  { id: 'silver-tongue', name: 'silverTongueName', hero: 'corvin', path: 'persuasion', gear: 'overclock', text: 'silverTongueText' },
  { id: 'unassailable', name: 'unassailableName', hero: 'corvin', path: 'vantage', gear: 'boots', text: 'unassailableText' },
  { id: 'tempest', name: 'tempestName', hero: 'veyl', path: 'storm', gear: 'overclock', text: 'tempestText' },
  { id: 'court-of-puppets', name: 'courtOfPuppetsName', hero: 'veyl', path: 'puppet-master', gear: 'magnet', text: 'courtOfPuppetsText' },
  { id: 'eternal-regent', name: 'eternalRegentName', hero: 'veyl', path: 'dark-bargain', gear: 'medpack', text: 'eternalRegentText' },
  { id: 'violet-tornado', name: 'violetTornadoName', hero: 'kresh', path: 'dervish', gear: 'overclock', text: 'violetTornadoText' },
  { id: 'apex-predator', name: 'apexPredatorName', hero: 'kresh', path: 'stalker', gear: 'boots', text: 'apexPredatorText' },
  { id: 'steel-strider', name: 'steelStriderName', hero: 'kresh', path: 'rebuilt', gear: 'armour', text: 'steelStriderText' },
  { id: 'royal-fury', name: 'royalFuryName', hero: 'joren', path: 'duelist', gear: 'overclock', text: 'royalFuryText' },
  { id: 'shattering-blow', name: 'shatteringBlowName', hero: 'joren', path: 'breaker', gear: 'magnet', text: 'shatteringBlowText' },
  { id: 'master-of-the-order', name: 'masterOfTheOrderName', hero: 'joren', path: 'council-seat', gear: 'armour', text: 'masterOfTheOrderText' },
  { id: 'never-miss', name: 'neverMissName', hero: 'elara', path: 'sharpshooter', gear: 'overclock', text: 'neverMissText' },
  { id: 'the-uprising', name: 'theUprisingName', hero: 'elara', path: 'rebel-network', gear: 'medpack', text: 'theUprisingText' },
  { id: 'rallying-cry', name: 'rallyingCryName', hero: 'elara', path: 'diplomat', gear: 'armour', text: 'rallyingCryText' },
  { id: 'endless-ranks', name: 'endlessRanksName', hero: 'triad', path: 'firing-line', gear: 'overclock', text: 'endlessRanksText' },
  { id: 'assembly-line', name: 'assemblyLineName', hero: 'triad', path: 'factory', gear: 'magnet', text: 'assemblyLineText' },
  { id: 'hive-signal', name: 'hiveSignalName', hero: 'triad', path: 'uplink', gear: 'boots', text: 'hiveSignalText' },
  { id: 'fan-the-hammer', name: 'fanTheHammerName', hero: 'dax', path: 'fast-hands', gear: 'overclock', text: 'fanTheHammerText' },
  { id: 'full-throttle', name: 'fullThrottleName', hero: 'dax', path: 'smugglers-run', gear: 'boots', text: 'fullThrottleText' },
  { id: 'jackpot', name: 'jackpotName', hero: 'dax', path: 'lucky-streak', gear: 'magnet', text: 'jackpotText' },
  { id: 'siege-crossbow', name: 'siegeCrossbowName', hero: 'grunda', path: 'heavy-bolts', gear: 'overclock', text: 'siegeCrossbowText' },
  { id: 'second-wind', name: 'secondWindName', hero: 'grunda', path: 'wild-heart', gear: 'medpack', text: 'secondWindText' },
  { id: 'thunder-lungs', name: 'thunderLungsName', hero: 'grunda', path: 'warcry', gear: 'armour', text: 'thunderLungsText' },
  { id: 'arc-welder', name: 'arcWelderName', hero: 'kettle', path: 'prod', gear: 'overclock', text: 'arcWelderText' },
  { id: 'botnet', name: 'botnetName', hero: 'kettle', path: 'hacker', gear: 'magnet', text: 'botnetText' },
  { id: 'reboot', name: 'rebootName', hero: 'kettle', path: 'spare-parts', gear: 'armour', text: 'rebootText' },
  { id: 'clean-shot', name: 'cleanShotName', hero: 'cassia', path: 'deadeye', gear: 'overclock', text: 'cleanShotText' },
  { id: 'vanish', name: 'vanishName', hero: 'cassia', path: 'ghost', gear: 'boots', text: 'vanishText' },
  { id: 'dossier', name: 'dossierName', hero: 'cassia', path: 'spymaster', gear: 'magnet', text: 'dossierText' },
  { id: 'rocket-swarm', name: 'rocketSwarmName', hero: 'vesk', path: 'arsenal', gear: 'overclock', text: 'rocketSwarmText' },
  { id: 'inferno', name: 'infernoName', hero: 'vesk', path: 'scorched-earth', gear: 'armour', text: 'infernoText' },
  { id: 'big-game', name: 'bigGameName', hero: 'vesk', path: 'bounty', gear: 'magnet', text: 'bigGameText' },
  { id: 'barrel-roll', name: 'barrelRollName', hero: 'rena', path: 'afterburner', gear: 'boots', text: 'barrelRollText' },
  { id: 'strafing-run', name: 'strafingRunName', hero: 'rena', path: 'gunship', gear: 'overclock', text: 'strafingRunText' },
  { id: 'flight-leader', name: 'flightLeaderName', hero: 'rena', path: 'wingmates', gear: 'magnet', text: 'flightLeaderText' },
  { id: 'orbital-barrage', name: 'orbitalBarrageName', hero: 'thessa', path: 'fleet-command', gear: 'overclock', text: 'orbitalBarrageText' },
  { id: 'perfect-ring', name: 'perfectRingName', hero: 'thessa', path: 'iron-ring', gear: 'armour', text: 'perfectRingText' },
  { id: 'grand-strategy', name: 'grandStrategyName', hero: 'thessa', path: 'tactician', gear: 'magnet', text: 'grandStrategyText' },
  { id: 'eagle-eye', name: 'eagleEyeName', hero: 'wikka', path: 'slinger', gear: 'overclock', text: 'eagleEyeText' },
  { id: 'stampede', name: 'stampedeName', hero: 'wikka', path: 'log-traps', gear: 'boots', text: 'stampedeText' },
  { id: 'war-drums', name: 'warDrumsName', hero: 'wikka', path: 'tribe', gear: 'armour', text: 'warDrumsText' },
];

export interface CrossoverDef {
  id: string;
  name: TextKey;
  path: string;
  pool: string;
  text: TextKey;
}

/** A pool skill held with a fitting path (any tiers) gives a bonus. */
export const CROSSOVERS: readonly CrossoverDef[] = [
  { id: 'seeking-ricochets', name: 'seekingRicochetsName', path: 'gunslinger', pool: 'ricochet', text: 'seekingRicochetsText' },
  { id: 'stunning-bash', name: 'stunningBashName', path: 'riot-shield', pool: 'stun', text: 'stunningBashText' },
  { id: 'shoulder-to-shoulder', name: 'shoulderToShoulderName', path: 'brothers', pool: 'scatter', text: 'shoulderToShoulderText' },
  { id: 'cluster-grenades', name: 'clusterGrenadesName', path: 'demolitions', pool: 'thermal', text: 'clusterGrenadesText' },
  { id: 'fury-unbound', name: 'furyUnboundName', path: 'the-fall', pool: 'rage', text: 'furyUnboundText' },
  { id: 'iron-reach', name: 'ironReachName', path: 'iron-grip', pool: 'blade-throw', text: 'ironReachText' },
  { id: 'lifting-wave', name: 'liftingWaveName', path: 'stillness', pool: 'push-wave', text: 'liftingWaveText' },
  { id: 'returning-steel', name: 'returningSteelName', path: 'bulwark', pool: 'blade-throw', text: 'returningSteelText' },
  { id: 'loyal-dead', name: 'loyalDeadName', path: 'puppet-master', pool: 'drain', text: 'loyalDeadText' },
  { id: 'double-ring', name: 'doubleRingName', path: 'dervish', pool: 'spinning-guard', text: 'doubleRingText' },
  { id: 'royal-lightning', name: 'royalLightningName', path: 'council-seat', pool: 'lightning-arc', text: 'royalLightningText' },
  { id: 'eyes-in-the-sky', name: 'eyesInTheSkyName', path: 'rebel-network', pool: 'drone', text: 'eyesInTheSkyText' },
  { id: 'crossfire', name: 'crossfireName', path: 'firing-line', pool: 'scatter', text: 'crossfireText' },
];

/** The capstones a run's tiers and gear unlock. */
export function capstonesOf(ranks: Record<string, number>): CapstoneDef[] {
  return CAPSTONES.filter((c) => (ranks[c.path] ?? 0) >= BASE_TIER && (ranks[c.gear] ?? 0) > 0);
}

/** The crossovers a run's upgrades complete. */
export function crossoversOf(ranks: Record<string, number>): CrossoverDef[] {
  return CROSSOVERS.filter((c) => (ranks[c.path] ?? 0) > 0 && (ranks[c.pool] ?? 0) > 0);
}

/** The crossover an upgrade would complete (or does) for this hero, for the card hint. */
export function crossoverFor(id: string, hero: HeroId): CrossoverDef | undefined {
  return CROSSOVERS.find((c) => (c.path === id || c.pool === id) && UPGRADES[c.path].hero === hero);
}

/**
 * The pools a hero draws from now: their class and side. Kael Varro turns to the Hollow once he
 * takes The Fall.
 */
export function poolsOf(hero: HeroId, ranks: Record<string, number>): readonly PoolId[] {
  if (hero === 'kael' && (ranks['the-fall'] ?? 0) > 0) return ['blade', 'hollow'];
  return HEROES[hero].pools;
}

/** What a pool is called on a card. */
export const POOL_NAMES: Record<PoolId, TextKey> = { blaster: 'poolKind', blade: 'bladePoolKind', current: 'currentPoolKind', hollow: 'hollowPoolKind' };

/** The capstone an upgrade leads to, for the card hint. */
export function capstoneFor(id: string, hero: HeroId): CapstoneDef | undefined {
  return CAPSTONES.find((c) => c.hero === hero && (c.path === id || c.gear === id));
}

/** A level's per-tier value: `table[tier - 1]`, or `none` at tier 0. */
export function at<T>(table: readonly T[], tier: number, none: T): T {
  return tier <= 0 ? none : table[Math.min(tier, table.length) - 1];
}

export function countKinds(ranks: Record<string, number>) {
  let abilities = 0;
  let gear = 0;
  for (const id of Object.keys(ranks)) {
    if (UPGRADES[id]?.kind === 'gear') gear += 1;
    else if (UPGRADES[id]) abilities += 1;
  }
  return { abilities, gear };
}

/** Whether a card for this upgrade can be offered now. */
export function canOffer(id: string, hero: HeroId, ranks: Record<string, number>, locked?: ReadonlySet<string>) {
  const def = UPGRADES[id];
  if (!def) return false;
  if (def.kind === 'path' && def.hero !== hero) return false;
  const rank = ranks[id] ?? 0;
  if (rank >= BASE_TIER || locked?.has(id)) return false;
  // A skill already held can always go up, even from a pool the hero has turned away from.
  if (rank > 0) return true;
  if (def.kind === 'pool' && !poolsOf(hero, ranks).includes(def.pool!) && !HEROES[hero].extra?.includes(id)) return false;
  const { abilities, gear } = countKinds(ranks);
  return def.kind === 'gear' ? gear < MAX_GEAR : abilities < MAX_ABILITIES;
}

/**
 * Different cards for a level-up (three, or four for Elara Voss), at least one from the hero's own
 * paths while any can be offered; the Field Ration fills in when fewer upgrades are left. Besides
 * the upgrades themselves, the cards can be a specialisation of an upgrade at tier 5 or a fusion.
 */
export function rollChoices(hero: HeroId, kit: Kit, count = 3): string[] {
  const { ranks } = kit;
  const locked = lockedOf(kit);
  const open = UPGRADE_IDS.filter((id) => canOffer(id, hero, ranks, locked));
  // Specialisation and fusion cards join after the upgrades, and only once one is open, so a run's
  // first cards (and the playthrough's seeded rolls) come out as they always did.
  const extra = extraChoices(kit, locked);
  const all = [...open, ...extra];
  let own = open.filter((id) => UPGRADES[id].kind === 'path');
  if (!own.length) own = extra.filter((id) => UPGRADES[parseCard(id)?.id ?? '']?.kind === 'path');
  const picks: string[] = [];
  const take = (pool: string[]) => {
    // Upgrades already held come up a little more often, so a build can be finished.
    const weights = pool.map((id) => (id.startsWith(FUSION_PREFIX) ? 2 : id.includes(BRANCH_SEP) ? 1.2 : (ranks[id] ?? 0) > 0 ? 1.6 : 1));
    let r = rand() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i];
      if (r <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  };
  if (own.length) picks.push(take(own));
  while (picks.length < count) {
    const rest = all.filter((id) => !picks.includes(id));
    if (!rest.length) break;
    picks.push(take(rest));
  }
  if (picks.length < count) picks.push(FILLER.id);
  return picks;
}

/** How many cards a level-up offers: Elara Voss's Hope makes it four. */
export const cardCount = (hero: HeroId) => (hero === 'elara' ? 4 : 3);

/**
 * A free pick (the arena's reward): up to three cards that raise something already held, filled
 * with a level-up's cards when fewer are held.
 */
export function rewardChoices(hero: HeroId, kit: Kit): string[] {
  const held = raisable(kit);
  const picks: string[] = [];
  while (picks.length < 3 && held.length) picks.push(held.splice(Math.floor(rand() * held.length), 1)[0]);
  for (const id of rollChoices(hero, kit)) {
    if (picks.length >= 3) break;
    if (!picks.includes(id) && (id !== FILLER.id || !picks.length)) picks.push(id);
  }
  return picks;
}

// ---------------------------------------------------------------------------------------------
// Specialisations and fusions

/** A stat a specialisation or fusion tier raises (shares, except health, regen and the counts). */
export type Stat =
  | 'damage' | 'fireRate' | 'hp' | 'armour' | 'speed' | 'crit' | 'regen' | 'sig' | 'cooldown' | 'dodge' | 'reach'
  | 'pickup' | 'xp' | 'credits' | 'boss' | 'harvest' | 'pierce' | 'bounces' | 'execute' | 'slow';
export type Gains = Partial<Record<Stat, number>>;
/** The order a tier's gains are listed in on a card. */
export const STATS: readonly Stat[] = [
  'damage', 'fireRate', 'crit', 'boss', 'execute', 'pierce', 'bounces', 'slow', 'reach', 'cooldown', 'sig',
  'hp', 'armour', 'regen', 'dodge', 'harvest', 'speed', 'pickup', 'xp', 'credits',
];

/** The upgrades, specialisations and fusions a run holds. */
export interface Kit {
  ranks: Record<string, number>;
  /** The specialisation picked for an upgrade at tier 5, and how many of its two tiers are held. */
  branches: Record<string, { b: BranchId; n: number }>;
  /** Fusions held, by id, with their tier. */
  fusions: Record<string, number>;
}

export type BranchId = 'power' | 'tempo' | 'guard' | 'hunt' | 'fortune';
export const BRANCH_IDS: readonly BranchId[] = ['power', 'tempo', 'guard', 'hunt', 'fortune'];

/**
 * The specialisations: at tier 5 an upgrade branches, and the first one taken is the only one it
 * can have; its two tiers are the upgrade's tiers 6 and 7.
 */
export const BRANCHES: Record<BranchId, { name: TextKey; tiers: readonly [Gains, Gains] }> = {
  power: { name: 'branchPower', tiers: [{ damage: 0.1 }, { damage: 0.1, crit: 0.05 }] },
  tempo: { name: 'branchTempo', tiers: [{ fireRate: 0.1, cooldown: 0.05 }, { fireRate: 0.1, cooldown: 0.05 }] },
  guard: { name: 'branchGuard', tiers: [{ hp: 20, regen: 0.5 }, { armour: 0.05, dodge: 0.04 }] },
  hunt: { name: 'branchHunt', tiers: [{ boss: 0.15, speed: 0.05 }, { boss: 0.15, crit: 0.04 }] },
  fortune: { name: 'branchFortune', tiers: [{ xp: 0.1, pickup: 0.25 }, { xp: 0.1, credits: 0.25 }] },
};

/** Upgrades that keep the hero standing: they branch into guard first. */
const GUARD_FIRST = new Set([
  'riot-shield', 'life-support', 'stillness', 'bulwark', 'council-seat', 'rebuilt', 'diplomat', 'factory',
  'wild-heart', 'spare-parts', 'ghost', 'afterburner', 'iron-ring',
  'riposte', 'iron-skin', 'mending', 'foresight', 'calm-mind', 'battle-trance', 'drain', 'soul-harvest',
  'armour', 'medpack', 'barrier', 'boots', 'stim',
  ...Object.values(DRILLS).map((d) => d.id),
]);
/** Gear that finds things: it branches into fortune. */
const FORTUNE_FIRST = new Set(['magnet', 'lens', 'salvager', 'scanner']);

/** The three specialisations an upgrade branches into at tier 5. */
export function branchesOf(id: string): readonly BranchId[] {
  if (FORTUNE_FIRST.has(id)) return ['fortune', 'hunt', 'guard'];
  if (GUARD_FIRST.has(id)) return ['guard', 'tempo', 'power'];
  return ['power', 'tempo', 'hunt'];
}

export interface FusionDef {
  id: string;
  name: TextKey;
  blurb: TextKey;
  /** The two upgrades it fuses, each held at `FUSION_NEEDS` or more. */
  needs: readonly [string, string];
  /** Upgrades it shuts out: they are offered no more, and stop rising if held. */
  locks: readonly string[];
  tiers: readonly [Gains, Gains, Gains];
}

/** The tier both halves of a fusion must reach before it is offered, and a fusion's tiers. */
export const FUSION_NEEDS = 3;
export const FUSION_TIERS = 3;
/** How a fusion's card id starts, and what joins an upgrade's id to a specialisation's. */
export const FUSION_PREFIX = 'fusion:';
export const BRANCH_SEP = '>';

/**
 * The fusions: two upgrades held at tier 3 or more fuse into a third. Taking one shuts out the
 * fusions that share one of its halves and the upgrades it `locks`.
 */
export const FUSIONS: readonly FusionDef[] = [
  // The Blaster pool
  { id: 'chain-reaction', name: 'chainReactionName', blurb: 'chainReactionBlurb', needs: ['ricochet', 'thermal'], locks: ['overcharge'],
    tiers: [{ bounces: 1, damage: 0.1 }, { damage: 0.12 }, { bounces: 1, damage: 0.12 }] },
  { id: 'railgun', name: 'railgunName', blurb: 'railgunBlurb', needs: ['overcharge', 'reload'], locks: ['scatter'],
    tiers: [{ pierce: 2, damage: 0.1 }, { damage: 0.15 }, { pierce: 2, damage: 0.15 }] },
  { id: 'bullet-storm', name: 'bulletStormName', blurb: 'bulletStormBlurb', needs: ['scatter', 'reload'], locks: ['overcharge'],
    tiers: [{ fireRate: 0.15 }, { fireRate: 0.1, damage: 0.1 }, { fireRate: 0.15 }] },
  { id: 'kill-order', name: 'killOrderName', blurb: 'killOrderBlurb', needs: ['executioner', 'drone'], locks: ['stun'],
    tiers: [{ execute: 0.04, crit: 0.05 }, { execute: 0.03, crit: 0.05 }, { execute: 0.03, crit: 0.05 }] },
  { id: 'shock-and-awe', name: 'shockAndAweName', blurb: 'shockAndAweBlurb', needs: ['stun', 'orbital-beacon'], locks: ['thermal'],
    tiers: [{ slow: 0.1, boss: 0.15 }, { boss: 0.15 }, { slow: 0.1, boss: 0.2 }] },
  { id: 'air-support', name: 'airSupportName', blurb: 'airSupportBlurb', needs: ['callin', 'drone'], locks: ['executioner'],
    tiers: [{ cooldown: 0.08, damage: 0.08 }, { cooldown: 0.08 }, { cooldown: 0.08, damage: 0.12 }] },
  // The Blade pool
  { id: 'thousand-cuts', name: 'thousandCutsName', blurb: 'thousandCutsBlurb', needs: ['focus', 'wide-arc'], locks: ['iron-skin'],
    tiers: [{ crit: 0.06, reach: 0.1 }, { crit: 0.06 }, { crit: 0.08, reach: 0.1 }] },
  { id: 'iron-fortress', name: 'ironFortressName', blurb: 'ironFortressBlurb', needs: ['iron-skin', 'riposte'], locks: ['blade-dash'],
    tiers: [{ armour: 0.05, hp: 20 }, { hp: 20 }, { armour: 0.05, hp: 30 }] },
  { id: 'steel-cyclone', name: 'steelCycloneName', blurb: 'steelCycloneBlurb', needs: ['spinning-guard', 'blade-throw'], locks: ['focus'],
    tiers: [{ damage: 0.12 }, { cooldown: 0.08 }, { damage: 0.15, cooldown: 0.07 }] },
  { id: 'crescent-rush', name: 'crescentRushName', blurb: 'crescentRushBlurb', needs: ['crescent', 'blade-dash'], locks: ['riposte'],
    tiers: [{ speed: 0.06, cooldown: 0.08 }, { damage: 0.12 }, { speed: 0.06, cooldown: 0.08 }] },
  // The Current pool
  { id: 'clear-water', name: 'clearWaterName', blurb: 'clearWaterBlurb', needs: ['mending', 'calm-mind'], locks: ['battle-trance'],
    tiers: [{ regen: 0.8, sig: 0.1 }, { regen: 0.8 }, { regen: 1, sig: 0.1 }] },
  { id: 'prescience', name: 'prescienceName', blurb: 'prescienceBlurb', needs: ['foresight', 'battle-trance'], locks: ['mending'],
    tiers: [{ dodge: 0.05, speed: 0.05 }, { dodge: 0.05 }, { dodge: 0.05, speed: 0.06 }] },
  { id: 'frozen-moment', name: 'frozenMomentName', blurb: 'frozenMomentBlurb', needs: ['stasis', 'push-wave'], locks: ['foresight'],
    tiers: [{ cooldown: 0.1 }, { damage: 0.12 }, { cooldown: 0.1, damage: 0.1 }] },
  // The Hollow pool
  { id: 'blood-pact', name: 'bloodPactName', blurb: 'bloodPactBlurb', needs: ['rage', 'drain'], locks: ['soul-harvest'],
    tiers: [{ harvest: 0.3, damage: 0.1 }, { damage: 0.1 }, { harvest: 0.4, damage: 0.12 }] },
  { id: 'abyssal-storm', name: 'abyssalStormName', blurb: 'abyssalStormBlurb', needs: ['lightning-arc', 'dark-nova'], locks: ['grip'],
    tiers: [{ cooldown: 0.1, damage: 0.08 }, { damage: 0.12 }, { cooldown: 0.1, damage: 0.1 }] },
  { id: 'reaper', name: 'reaperName', blurb: 'reaperBlurb', needs: ['soul-harvest', 'grip'], locks: ['drain'],
    tiers: [{ harvest: 0.3, boss: 0.1 }, { boss: 0.15 }, { harvest: 0.4, boss: 0.15 }] },
  // The Gear deck, for everyone
  { id: 'juggernaut-plating', name: 'juggernautPlatingName', blurb: 'juggernautPlatingBlurb', needs: ['armour', 'medpack'], locks: ['boots'],
    tiers: [{ armour: 0.04, regen: 0.6 }, { hp: 25 }, { armour: 0.04, regen: 0.8 }] },
  { id: 'overdrive-core', name: 'overdriveCoreName', blurb: 'overdriveCoreBlurb', needs: ['overclock', 'cell'], locks: ['barrier'],
    tiers: [{ cooldown: 0.08, damage: 0.08 }, { damage: 0.1 }, { cooldown: 0.08, damage: 0.1 }] },
  { id: 'hunter-kit', name: 'hunterKitName', blurb: 'hunterKitBlurb', needs: ['scanner', 'chip'], locks: ['lens'],
    tiers: [{ boss: 0.2, crit: 0.04 }, { boss: 0.15 }, { boss: 0.2, crit: 0.05 }] },
  { id: 'treasure-hunter', name: 'treasureHunterName', blurb: 'treasureHunterBlurb', needs: ['magnet', 'salvager'], locks: ['scanner'],
    tiers: [{ pickup: 0.5, credits: 0.3 }, { xp: 0.1 }, { pickup: 0.5, credits: 0.4 }] },
];
export const FUSION_BY_ID: Record<string, FusionDef> = Object.fromEntries(FUSIONS.map((f) => [f.id, f]));

/** What a card id stands for: an upgrade's next tier, a specialisation's, a fusion's, or the ration. */
export type Card =
  | { kind: 'upgrade'; id: string }
  | { kind: 'branch'; id: string; branch: BranchId }
  | { kind: 'fusion'; id: string }
  | { kind: 'filler'; id: string };

export function parseCard(card: string): Card | null {
  if (card === FILLER.id) return { kind: 'filler', id: card };
  if (card.startsWith(FUSION_PREFIX)) {
    const id = card.slice(FUSION_PREFIX.length);
    return FUSION_BY_ID[id] ? { kind: 'fusion', id } : null;
  }
  const [id, branch] = card.split(BRANCH_SEP);
  if (!UPGRADES[id]) return null;
  if (branch === undefined) return { kind: 'upgrade', id };
  return BRANCH_IDS.includes(branch as BranchId) && branchesOf(id).includes(branch as BranchId) ? { kind: 'branch', id, branch: branch as BranchId } : null;
}

/** The card for a specialisation, and for a fusion. */
export const branchCard = (id: string, b: BranchId) => `${id}${BRANCH_SEP}${b}`;
export const fusionCard = (id: string) => `${FUSION_PREFIX}${id}`;

/** An upgrade's tier counting its specialisation's (0 to 7). */
export const tierOf = (kit: Kit, id: string) => (kit.ranks[id] ?? 0) + (kit.branches[id]?.n ?? 0);

/** The tiers a card's line of pips shows, and how many of them are held. */
export function cardTiers(kit: Kit, card: Card): { held: number; max: number } {
  if (card.kind === 'fusion') return { held: kit.fusions[card.id] ?? 0, max: FUSION_TIERS };
  return { held: tierOf(kit, card.id), max: MAX_TIER };
}

/** Whether a fusion's two halves are both held at tier 3 or more. */
const fusionReady = (f: FusionDef, kit: Kit) => f.needs.every((id) => (kit.ranks[id] ?? 0) >= FUSION_NEEDS);

/**
 * What the fusions held shut out: the upgrades they lock, and (as `fusion:<id>`) every other fusion
 * that shares a half with one held or would fuse an upgrade a held fusion locks.
 */
export function lockedOf(kit: Kit): Set<string> {
  const out = new Set<string>();
  const held = FUSIONS.filter((f) => (kit.fusions[f.id] ?? 0) > 0);
  for (const f of held) for (const id of f.locks) out.add(id);
  for (const f of FUSIONS) {
    if ((kit.fusions[f.id] ?? 0) > 0) continue;
    if (held.some((h) => h.needs.some((id) => f.needs.includes(id))) || f.needs.some((id) => out.has(id))) out.add(fusionCard(f.id));
  }
  return out;
}

/** What a fusion would shut out if taken now: its locks and the rival fusions open to this hero. */
export function fusionShuts(f: FusionDef, hero: HeroId, kit: Kit): { upgrades: string[]; fusions: string[] } {
  const rivals = FUSIONS.filter((o) => o.id !== f.id && fusionFits(o, hero, kit) && (o.needs.some((id) => f.needs.includes(id)) || o.needs.some((id) => f.locks.includes(id))));
  return { upgrades: [...f.locks], fusions: rivals.map((o) => o.id) };
}

/** Whether this hero could ever hold both halves of a fusion. */
function fusionFits(f: FusionDef, hero: HeroId, kit: Kit) {
  return f.needs.every((id) => {
    const def = UPGRADES[id];
    if ((kit.ranks[id] ?? 0) > 0 || def.kind === 'gear') return true;
    if (def.kind === 'path') return def.hero === hero;
    return poolsOf(hero, kit.ranks).includes(def.pool!) || !!HEROES[hero].extra?.includes(id);
  });
}

/** The specialisation and fusion cards open now. */
export function extraChoices(kit: Kit, locked = lockedOf(kit)): string[] {
  const out: string[] = [];
  for (const id of Object.keys(kit.ranks)) {
    if (kit.ranks[id] < BASE_TIER || locked.has(id) || !UPGRADES[id]) continue;
    const had = kit.branches[id];
    if (!had) out.push(...branchesOf(id).map((b) => branchCard(id, b)));
    else if (had.n < BRANCHES[had.b].tiers.length) out.push(branchCard(id, had.b));
  }
  for (const f of FUSIONS) {
    const n = kit.fusions[f.id] ?? 0;
    if (n >= FUSION_TIERS || locked.has(fusionCard(f.id))) continue;
    if (n > 0 || fusionReady(f, kit)) out.push(fusionCard(f.id));
  }
  return out;
}

/** The cards that raise something already held (a chest's or the arena's free tier). */
export function raisable(kit: Kit): string[] {
  const locked = lockedOf(kit);
  const out = Object.keys(kit.ranks).filter((id) => kit.ranks[id] < BASE_TIER && !locked.has(id));
  for (const id of Object.keys(kit.branches)) {
    const had = kit.branches[id];
    if (had.n < BRANCHES[had.b].tiers.length && !locked.has(id)) out.push(branchCard(id, had.b));
  }
  for (const id of Object.keys(kit.fusions)) if (kit.fusions[id] < FUSION_TIERS) out.push(fusionCard(id));
  return out;
}

/** The gains of a card's next tier (specialisations and fusions; upgrades have their own text). */
export function gainsOf(kit: Kit, card: Card): Gains | null {
  if (card.kind === 'branch') {
    const n = kit.branches[card.id]?.b === card.branch ? kit.branches[card.id].n : 0;
    return BRANCHES[card.branch].tiers[Math.min(n, 1)];
  }
  if (card.kind === 'fusion') return FUSION_BY_ID[card.id].tiers[Math.min(kit.fusions[card.id] ?? 0, FUSION_TIERS - 1)];
  return null;
}

/** Everything the specialisations and fusions held add up to. */
export function kitGains(kit: Kit): Gains {
  const out: Gains = {};
  const add = (g: Gains) => {
    for (const k of Object.keys(g) as Stat[]) out[k] = (out[k] ?? 0) + g[k]!;
  };
  for (const id of Object.keys(kit.branches)) {
    const { b, n } = kit.branches[id];
    BRANCHES[b].tiers.slice(0, n).forEach(add);
  }
  for (const id of Object.keys(kit.fusions)) FUSION_BY_ID[id]?.tiers.slice(0, kit.fusions[id]).forEach(add);
  return out;
}
