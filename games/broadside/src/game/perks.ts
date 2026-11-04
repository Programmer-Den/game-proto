// The prize draft: after each wave the harbor offers three perks, and one is kept for the run.
// Once few new perks are left, a draft also offers the second rank of a perk already held.

import { random } from './random';
import type { TextKey } from '../i18n';

export type PerkId = 'ricochet' | 'salvage' | 'gunners' | 'mortar' | 'grapnels' | 'swivels' | 'carronades';

export interface Perk {
  /** Keys of `i18n/en.ts`. */
  name: TextKey;
  desc: TextKey;
  /** What its second rank does, for the card that offers it. */
  desc2: TextKey;
}

export const PERKS: Record<PerkId, Perk> = {
  ricochet: { name: 'ricochetName', desc: 'ricochetDesc', desc2: 'ricochetDesc2' },
  salvage: { name: 'salvageName', desc: 'salvageDesc', desc2: 'salvageDesc2' },
  gunners: { name: 'gunnersName', desc: 'gunnersDesc', desc2: 'gunnersDesc2' },
  mortar: { name: 'mortarName', desc: 'mortarDesc', desc2: 'mortarDesc2' },
  grapnels: { name: 'grapnelsName', desc: 'grapnelsDesc', desc2: 'grapnelsDesc2' },
  swivels: { name: 'swivelsName', desc: 'swivelsDesc', desc2: 'swivelsDesc2' },
  carronades: { name: 'carronadesName', desc: 'carronadesDesc', desc2: 'carronadesDesc2' },
};

export const PERK_IDS = Object.keys(PERKS) as PerkId[];

/** How many perks a draft offers. */
export const DRAFT_SIZE = 3;

/** The first wave's draft, so the first round plays the same every time. */
export const FIRST_DRAFT: PerkId[] = ['salvage', 'ricochet', 'mortar'];

/** The highest rank of a perk. */
export const MAX_PERK_RANK = 2;

/** How many times a perk has been taken: 0, 1 or 2 (`taken` lists a perk once per rank). */
export const perkRank = (taken: PerkId[], id: PerkId) => taken.filter((t) => t === id).length;

/**
 * Up to `size` perks in a random order: new ones first, and, once fewer new ones are left than
 * the draft has cards, the second rank of perks already held to fill it. Uses random() once per pick.
 */
export function drawDraft(taken: PerkId[], size = DRAFT_SIZE): PerkId[] {
  const draft: PerkId[] = [];
  const pick = (left: PerkId[]) => {
    while (left.length && draft.length < size) draft.push(left.splice(Math.floor(random() * left.length), 1)[0]);
  };
  pick(PERK_IDS.filter((id) => perkRank(taken, id) === 0));
  pick(PERK_IDS.filter((id) => perkRank(taken, id) > 0 && perkRank(taken, id) < MAX_PERK_RANK));
  return draft;
}

// Each perk's numbers by rank: index 0 is rank 1, index 1 rank 2.

/** How much hull a sunk ship patches with Salvage. */
export const SALVAGE_HULL = [6, 12];
/** A ball with Bouncing shot flies this share of its range again after each skip. */
export const RICOCHET_FLIGHT = 0.5;
/** The player's own mortar: how often it fires (by rank), how far it reaches and what its shell does. */
export const OWN_MORTAR = { reloadMs: [6000, 4000], range: 360, damage: 22 };
/** How much faster prizes reload with Prize gun crews. */
export const GUNNERS_PACE = [2, 3];
/** The share of the boarding time and of the prize crew Grapnels leave. */
export const GRAPNELS = [0.5, 0.25];
/** How much wider the broadsides train with Swivel guns. */
export const SWIVEL_ARC = [1.5, 2];
/** How much harder carronades hit a ship inside half the reach. */
export const CARRONADE_DAMAGE = [1.5, 1.75];
