// The tech tree between battles: salvage the player collects in a battle is banked when it ends,
// and buys lasting tech for one faction at a time, which every later battle with that faction
// starts with (sectors, galaxy and scenarios alike). Three branches of two tiers; a second tier
// needs the first of its branch. Saved in the browser under `space-wars-tech`. No Phaser.

import type { Perks } from './contracts';
import type { TextKey } from '../i18n';

export type TechId = 'plating' | 'bulwark' | 'lenses' | 'cores' | 'holds' | 'docks';

export interface Tech {
  id: TechId;
  /** Its branch's column (0 hull, 1 guns, 2 supply) and tier (0 or 1) on the tree. */
  branch: number;
  tier: number;
  /** Banked salvage it costs. */
  cost: number;
  /** Keys of `i18n/en.ts`: its name and what it does. */
  name: TextKey;
  text: TextKey;
  apply: (p: Perks) => void;
}

export const TECHS: readonly Tech[] = [
  { id: 'plating', branch: 0, tier: 0, cost: 120, name: 'techPlating', text: 'techPlatingText', apply: (p) => { p.hp *= 1.08; } },
  { id: 'bulwark', branch: 0, tier: 1, cost: 240, name: 'techBulwark', text: 'techBulwarkText', apply: (p) => { p.hp *= 1.12; p.repair *= 1.25; } },
  { id: 'lenses', branch: 1, tier: 0, cost: 120, name: 'techLenses', text: 'techLensesText', apply: (p) => { p.damage *= 1.08; } },
  { id: 'cores', branch: 1, tier: 1, cost: 240, name: 'techCores', text: 'techCoresText', apply: (p) => { p.damage *= 1.1; p.turretDamage *= 1.15; } },
  { id: 'holds', branch: 2, tier: 0, cost: 120, name: 'techHolds', text: 'techHoldsText', apply: (p) => { p.carry *= 1.15; } },
  { id: 'docks', branch: 2, tier: 1, cost: 240, name: 'techDocks', text: 'techDocksText', apply: (p) => { p.train *= 0.88; p.cost *= 0.94; } },
];

/** The branches' names, by column. */
export const BRANCHES: readonly TextKey[] = ['techHull', 'techGuns', 'techSupply'];

/** Salvage a battle won banks on top of what was collected. */
export const WIN_SALVAGE = 50;

/** The bank and the tech bought, by faction id (its name key). */
export interface TechTree {
  salvage: number;
  bought: Record<string, TechId[]>;
}

export const TECH_KEY = 'space-wars-tech';

export function techOf(id: TechId): Tech {
  return TECHS.find((t) => t.id === id)!;
}

export function loadTech(): TechTree {
  try {
    const raw = JSON.parse(localStorage.getItem(TECH_KEY) ?? 'null');
    if (raw && typeof raw.salvage === 'number' && raw.bought && typeof raw.bought === 'object') {
      const bought: Record<string, TechId[]> = {};
      for (const [faction, list] of Object.entries(raw.bought as Record<string, unknown>)) {
        if (Array.isArray(list)) bought[faction] = TECHS.map((t) => t.id).filter((id) => list.includes(id));
      }
      return { salvage: Math.max(0, Math.round(raw.salvage) || 0), bought };
    }
  } catch {
    // No storage, or a broken save: start over.
  }
  return { salvage: 0, bought: {} };
}

export function saveTech(tree: TechTree) {
  try {
    localStorage.setItem(TECH_KEY, JSON.stringify(tree));
  } catch {
    // Storage full or blocked: the tech lasts this visit only.
  }
}

/** The tech a faction (by its name key) has bought. */
export function techFor(tree: TechTree, faction: string): TechId[] {
  return tree.bought[faction] ?? [];
}

/** Why a tech can't be bought for a faction now, or null: already bought, its branch's first tier missing, or too little salvage. */
export function techProblem(tree: TechTree, faction: string, id: TechId): 'owned' | 'locked' | 'salvage' | null {
  const have = techFor(tree, faction);
  const tech = techOf(id);
  if (have.includes(id)) return 'owned';
  if (tech.tier > 0 && !TECHS.some((t) => t.branch === tech.branch && t.tier === tech.tier - 1 && have.includes(t.id))) return 'locked';
  if (tree.salvage < tech.cost) return 'salvage';
  return null;
}

/** Buys a tech for a faction, or returns the tree as it was when it can't be bought. */
export function buyTech(tree: TechTree, faction: string, id: TechId): TechTree {
  if (techProblem(tree, faction, id)) return tree;
  return { salvage: tree.salvage - techOf(id).cost, bought: { ...tree.bought, [faction]: [...techFor(tree, faction), id] } };
}

/** Banks a battle's salvage, and the bonus for a win. */
export function bankSalvage(tree: TechTree, salvaged: number, won: boolean): TechTree {
  return { ...tree, salvage: tree.salvage + Math.round(salvaged) + (won ? WIN_SALVAGE : 0) };
}
