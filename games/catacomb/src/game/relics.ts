// Relics: passive bonuses that last the rest of the run. The merchant sells them, a mystery room
// or a vault can hold one, and an act's boss leaves a choice of three boss relics, each strong and
// each with a cost (or a plain relic for none). Each is owned at most once; `sim.ts` applies them
// where their text says.

/** The plain relics: sold, found and granted at random. */
export type PlainRelicId = 'oakWard' | 'whetstone' | 'emberLantern' | 'mendingMoss' | 'goldenIdol' | 'boneCharm' | 'venomGland';
/** The boss relics: only ever offered after an act's boss, three at a time. */
export type BossRelicId = 'emberCrown' | 'seerEye' | 'twinBlade' | 'bloodChalice' | 'warMask';
export type RelicId = PlainRelicId | BossRelicId;

import { t, type TextKey } from '../i18n';

export interface Relic {
  /** Its name and text, keys of `i18n/en.ts`; the text takes the relic's number as `{n}`. */
  name: TextKey;
  text: TextKey;
  n?: number;
}

/** Each relic's number: Oak Ward's block, the Whetstone's damage, the Ember Lantern's energy, the Mending Moss's healing, the Bone Charm's Vulnerable and the Venom Gland's poison. */
export const OAK_WARD_BLOCK = 3;
export const WHETSTONE_DAMAGE = 2;
export const EMBER_LANTERN_ENERGY = 1;
export const MENDING_MOSS_HEAL = 5;
export const GOLDEN_IDOL_GOLD = 1.5;
export const BONE_CHARM_VULNERABLE = 2;
export const VENOM_GLAND_POISON = 2;
/** The boss relics' numbers: the Ember Crown's energy, the Seer's Eye's cards and price, the Twin Blade's Weak, the Blood Chalice's health and the War Mask's strength (the hero's, then each foe's). */
export const EMBER_CROWN_ENERGY = 1;
export const SEER_EYE_DRAW = 1;
export const SEER_EYE_PRICE = 2;
export const TWIN_BLADE_WEAK = 2;
export const BLOOD_CHALICE_HP = 20;
export const WAR_MASK_STRENGTH = 2;
export const WAR_MASK_FOE_STRENGTH = 1;

export const RELICS: Record<RelicId, Relic> = {
  oakWard: { name: 'oakWardName', text: 'oakWardText', n: OAK_WARD_BLOCK },
  whetstone: { name: 'whetstoneName', text: 'whetstoneText', n: WHETSTONE_DAMAGE },
  emberLantern: { name: 'emberLanternName', text: 'emberLanternText', n: EMBER_LANTERN_ENERGY },
  mendingMoss: { name: 'mendingMossName', text: 'mendingMossText', n: MENDING_MOSS_HEAL },
  goldenIdol: { name: 'goldenIdolName', text: 'goldenIdolText' },
  boneCharm: { name: 'boneCharmName', text: 'boneCharmText', n: BONE_CHARM_VULNERABLE },
  venomGland: { name: 'venomGlandName', text: 'venomGlandText', n: VENOM_GLAND_POISON },
  emberCrown: { name: 'emberCrownName', text: 'emberCrownText', n: EMBER_CROWN_ENERGY },
  seerEye: { name: 'seerEyeName', text: 'seerEyeText', n: SEER_EYE_DRAW },
  twinBlade: { name: 'twinBladeName', text: 'twinBladeText', n: TWIN_BLADE_WEAK },
  bloodChalice: { name: 'bloodChaliceName', text: 'bloodChaliceText', n: BLOOD_CHALICE_HP },
  warMask: { name: 'warMaskName', text: 'warMaskText', n: WAR_MASK_STRENGTH },
};

/** A relic's shown text, with its number filled in. */
export const relicText = (id: RelicId) => t(RELICS[id].text, { n: RELICS[id].n ?? 0 });

/** The boss relics, offered three at a time after an act's boss. */
export const BOSS_RELIC_IDS: BossRelicId[] = ['emberCrown', 'seerEye', 'twinBlade', 'bloodChalice', 'warMask'];
/** How many boss relics an act's boss offers. */
export const BOSS_RELIC_CHOICES = 3;
export const isBossRelic = (id: RelicId) => (BOSS_RELIC_IDS as RelicId[]).includes(id);
/** The plain relics: the merchant's, the mystery rooms', the vaults' and a boss's when no boss relic is taken. */
export const RELIC_IDS = (Object.keys(RELICS) as RelicId[]).filter((id) => !isBossRelic(id)) as PlainRelicId[];
