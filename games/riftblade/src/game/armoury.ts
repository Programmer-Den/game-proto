/**
 * The Armoury: small lasting upgrades bought between runs with credits banked at the end of each
 * run (what was left unspent, plus salvage per world reached). Each piece has a few ranks; a run
 * starts with the ranks bought (`GameState.perks`).
 */
import type { TextKey } from '../i18n';

export type ArmouryId = 'rations' | 'purse' | 'lens' | 'briefing' | 'reroll';

export interface ArmouryDef {
  id: ArmouryId;
  name: TextKey;
  /** What one rank does, with `{n}` the total at the next rank (or at the top one, when maxed). */
  text: TextKey;
  /** The price of each rank, in banked credits; its length is the number of ranks. */
  prices: readonly number[];
}

/** In the Armoury's order (keys 1-5). */
export const ARMOURY: readonly ArmouryDef[] = [
  { id: 'rations', name: 'arm_rations', text: 'arm_rations_text', prices: [60, 120, 180] },
  { id: 'purse', name: 'arm_purse', text: 'arm_purse_text', prices: [50, 100, 150] },
  { id: 'lens', name: 'arm_lens', text: 'arm_lens_text', prices: [80, 160] },
  { id: 'briefing', name: 'arm_briefing', text: 'arm_briefing_text', prices: [150] },
  { id: 'reroll', name: 'arm_reroll', text: 'arm_reroll_text', prices: [120] },
];
export const ARMOURY_IDS: readonly ArmouryId[] = ARMOURY.map((a) => a.id);

/** The numbers each rank gives. */
export const PERK = {
  /** Max health per rank of Field Rations (a share). */
  rations: 0.05,
  /** Credits to start with per rank of War Chest. */
  purse: 15,
  /** Shard pickup radius per rank of Lumen Lens (a share). */
  lens: 0.1,
};

/** Credits banked at a run's end: those left unspent, plus this much per world reached. */
export const SALVAGE_PER_WORLD = 10;
export const salvage = (credits: number, worlds: number) => Math.max(0, Math.floor(credits)) + SALVAGE_PER_WORLD * worlds;

/** The total a piece gives at `rank` (for its `{n}`). */
export function perkAmount(id: ArmouryId, rank: number) {
  if (id === 'rations') return Math.round(PERK.rations * 100 * rank);
  if (id === 'purse') return PERK.purse * rank;
  if (id === 'lens') return Math.round(PERK.lens * 100 * rank);
  return rank;
}

/** The price of the next rank, or null once maxed. */
export function nextPrice(id: ArmouryId, rank: number) {
  const def = ARMOURY.find((a) => a.id === id)!;
  return rank < def.prices.length ? def.prices[rank] : null;
}
