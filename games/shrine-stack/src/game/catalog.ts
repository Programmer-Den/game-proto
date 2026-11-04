// What favor buys between tiers, the kinds of stone, the tier trials and the curses: their names,
// texts and colours. Names and texts are keys of `i18n/en.ts`, shown with `t`. Their effects live
// in state.ts.
import type { TextKey } from '../i18n';

/** One-time buys between tiers, each at most once per break. */
export const SHOP = ['slow', 'wider', 'grace'] as const;
export type ShopId = (typeof SHOP)[number];

export const SHOP_INFO: Record<ShopId, { name: TextKey; cost: number; color: number }> = {
  slow: { name: 'slowName', cost: 4, color: 0x7fc8e8 },
  wider: { name: 'widerName', cost: 6, color: 0xd9a066 },
  grace: { name: 'graceName', cost: 8, color: 0xc9a0e8 },
};

/** The cheapest buy: a wobbly tier opens the shop only when the player can afford something. */
export const CHEAPEST = Math.min(...SHOP.map((id) => SHOP_INFO[id].cost));

export const KINDS = ['normal', 'heavy', 'light'] as const;
export type StoneKind = (typeof KINDS)[number];

export const KIND_INFO: Record<StoneKind, { name: TextKey; short: TextKey; color: string }> = {
  normal: { name: 'normalName', short: 'normalShort', color: '#f3e9d2' },
  heavy: { name: 'heavyName', short: 'heavyShort', color: '#b9c3cc' },
  light: { name: 'lightName', short: 'lightShort', color: '#9ad46a' },
};

export const TRIALS = ['perfect', 'keep'] as const;
export type TrialId = (typeof TRIALS)[number];

export const TRIAL_INFO: Record<TrialId, { short: TextKey }> = {
  perfect: { short: 'perfectTrial' },
  keep: { short: 'keepTrial' },
};

export const CURSES = ['haste', 'brittle', 'dim'] as const;
export type CurseId = (typeof CURSES)[number];

export const CURSE_INFO: Record<CurseId, { name: TextKey; text: TextKey }> = {
  haste: { name: 'hasteName', text: 'hasteText' },
  brittle: { name: 'brittleName', text: 'brittleText' },
  dim: { name: 'dimName', text: 'dimText' },
};

/** What a tier's stones are cut from, picked between tiers from `MATERIAL_FROM_TIER`. Limestone is the plain stone. */
export const MATERIALS = ['limestone', 'marble', 'sandstone', 'basalt'] as const;
export type MaterialId = (typeof MATERIALS)[number];

export const MATERIAL_INFO: Record<MaterialId, { name: TextKey; short: TextKey; color: number }> = {
  limestone: { name: 'limestoneName', short: 'limestoneShort', color: 0xd8b58a },
  marble: { name: 'marbleName', short: 'marbleShort', color: 0xf0ecf4 },
  sandstone: { name: 'sandstoneName', short: 'sandstoneShort', color: 0xe0a060 },
  basalt: { name: 'basaltName', short: 'basaltShort', color: 0x6a7080 },
};

/** The materials a break offers to pick from (limestone is the default, never on a button). */
export const MATERIAL_PICKS = ['marble', 'sandstone', 'basalt'] as const satisfies readonly MaterialId[];

/** The patrons a new temple picks one of; each sets a rule for the whole run, a boon and a bane. */
export const PATRONS = ['gilded', 'hands', 'patient', 'storm'] as const;
export type PatronId = (typeof PATRONS)[number];

export const PATRON_INFO: Record<PatronId, { name: TextKey; boon: TextKey; bane: TextKey; color: number }> = {
  gilded: { name: 'gildedName', boon: 'gildedBoon', bane: 'gildedBane', color: 0xf3c64e },
  hands: { name: 'handsName', boon: 'handsBoon', bane: 'handsBane', color: 0xc9a0e8 },
  patient: { name: 'patientName', boon: 'patientBoon', bane: 'patientBane', color: 0x7fc8e8 },
  storm: { name: 'stormName', boon: 'stormBoon', bane: 'stormBane', color: 0x9ad46a },
};

/**
 * Shrine sites (SS11): the hill is open from the start, and crowning a shrine opens the next site. Each
 * has its own crown height (`goal`, the gilded tier two below it) and its own best. The cliff blows a
 * steady wind off the sea; on the lake the temple stands on a raft that bobs side to side.
 */
export const SITES = ['hill', 'cliff', 'lake'] as const;
export type SiteId = (typeof SITES)[number];

export const SITE_INFO: Record<SiteId, { name: TextKey; text: TextKey; goal: number }> = {
  hill: { name: 'hillName', text: 'hillText', goal: 12 },
  cliff: { name: 'cliffName', text: 'cliffText', goal: 10 },
  lake: { name: 'lakeName', text: 'lakeText', goal: 11 },
};

/** The site a crown here opens, or null after the last. */
export const nextSite = (site: SiteId): SiteId | null => SITES[SITES.indexOf(site) + 1] ?? null;
