// The sector campaign: a chain of battles across five sectors. Winning a sector unlocks the next,
// harder one and keeps one of the contract perks earned in it for every later sector. Saved in the
// browser under `space-wars-campaign`. No Phaser.

import { contractOf, type Goal } from './contracts';
import { t, type TextKey } from '../i18n';

/** What makes a sector harder: rival outposts at the start, fewer loose crystal nodes, rival crystal and research. */
export interface Sector {
  /** A key of `i18n/en.ts`. */
  name: TextKey;
  /** How many rivals start with an outpost already built. */
  outposts: number;
  /** Loose crystal nodes across the map (the first sector has the usual 16). */
  loose: number;
  /** Crystal each rival starts with on top of the usual. */
  rivalCrystal: number;
  /** Research levels each rival starts with in every track. */
  rivalResearch: number;
}

export const SECTORS: readonly Sector[] = [
  { name: 'sectorDrift', outposts: 0, loose: 16, rivalCrystal: 0, rivalResearch: 0 },
  { name: 'sectorEmber', outposts: 2, loose: 13, rivalCrystal: 40, rivalResearch: 0 },
  { name: 'sectorGlass', outposts: 4, loose: 11, rivalCrystal: 80, rivalResearch: 0 },
  { name: 'sectorAsh', outposts: 4, loose: 9, rivalCrystal: 120, rivalResearch: 1 },
  { name: 'sectorCrown', outposts: 4, loose: 7, rivalCrystal: 160, rivalResearch: 1 },
];

/** The campaign so far: how many sectors are open, and the perk kept from each sector won (by index). */
export interface Campaign {
  unlocked: number;
  kept: (Goal | null)[];
}

export const CAMPAIGN_KEY = 'space-wars-campaign';

export function newCampaign(): Campaign {
  return { unlocked: 1, kept: [] };
}

export function loadCampaign(): Campaign {
  try {
    const raw = JSON.parse(localStorage.getItem(CAMPAIGN_KEY) ?? 'null');
    if (raw && typeof raw.unlocked === 'number' && Array.isArray(raw.kept)) {
      // An old or hand-edited save: a whole number of sectors, and only perks of goals the game still knows.
      const unlocked = Math.max(1, Math.min(SECTORS.length, Math.round(raw.unlocked) || 1));
      const kept = (raw.kept as unknown[]).slice(0, SECTORS.length).map((g) => (typeof g === 'string' && contractOf(g as Goal) ? (g as Goal) : null));
      return { unlocked, kept };
    }
  } catch {
    // No storage, or a broken save: start over.
  }
  return newCampaign();
}

export function saveCampaign(c: Campaign) {
  try {
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(c));
  } catch {
    // Storage full or blocked: the campaign lasts this visit only.
  }
}

/** The perks that carry into a battle in `sector`: those kept from every sector before it. */
export function keptFor(c: Campaign, sector: number): Goal[] {
  return c.kept.slice(0, sector).filter((g): g is Goal => !!g);
}

/** Records a win in `sector`, keeping `perk` from it (or, with none, the perk kept from an earlier win there), and opens the next sector. */
export function winSector(c: Campaign, sector: number, perk: Goal | null): Campaign {
  const kept = [...c.kept];
  while (kept.length < sector) kept.push(null);
  kept[sector] = perk ?? kept[sector] ?? null;
  return { unlocked: Math.min(SECTORS.length, Math.max(c.unlocked, sector + 2)), kept };
}

/** What sets a sector apart, in a line for the picker. */
export function sectorText(s: Sector): string {
  if (!s.outposts && !s.rivalCrystal && !s.rivalResearch) return t('sectorUsual', { loose: s.loose });
  const parts = [t('sectorOutposts', { n: s.outposts }), t('sectorCrystal', { n: s.rivalCrystal })];
  if (s.rivalResearch) parts.push(t('sectorResearch', { n: s.rivalResearch }));
  parts.push(t('sectorLoose', { n: s.loose }));
  return parts.join(' · ');
}
