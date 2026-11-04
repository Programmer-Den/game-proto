// Admirals: the player picks one on the picker before a battle. Each gives the fleet an aura (a
// standing bonus) and an active (a button with a cooldown), and gains ranks from battle to battle,
// which strengthen both. Saved under `space-wars-admirals`. No Phaser, no Math.random.

import type { Perks } from './contracts';
import type { TextKey } from '../i18n';

export type AdmiralId = 'warden' | 'navigator' | 'broker';
export const ADMIRAL_IDS: readonly AdmiralId[] = ['warden', 'navigator', 'broker'];

/** The experience each rank needs (rank 1 at 0): a battle fought gives 1, a battle won 2 more. */
export const ADMIRAL_RANKS = [0, 3, 7, 12, 18] as const;
export const MAX_ADMIRAL_RANK = ADMIRAL_RANKS.length;
/** Experience for a battle fought, and on top for a battle won. */
export const ADMIRAL_XP = { fought: 1, won: 2 };

export interface AdmiralDef {
  id: AdmiralId;
  name: TextKey;
  /** The active's name, the aura's line and the active's line (`{n}` and `{s}` filled with the rank's numbers). */
  active: TextKey;
  auraText: TextKey;
  activeText: TextKey;
  /** The aura's share at rank 1, and what each rank adds. */
  aura: number;
  auraStep: number;
  /** The active's cooldown at rank 1, and how much shorter each rank makes it. */
  cooldownMs: number;
  cooldownStep: number;
  /** The active's strength at rank 1 and per rank: Bulwark's seconds, the jump's ships, the windfall's crystal. */
  power: number;
  powerStep: number;
  applyAura: (p: Perks, share: number) => void;
}

export const ADMIRALS: readonly AdmiralDef[] = [
  {
    id: 'warden', name: 'admiralWarden', active: 'activeShield', auraText: 'auraWarden', activeText: 'activeShieldText',
    aura: 0.08, auraStep: 0.03, cooldownMs: 90_000, cooldownStep: 6_000, power: 8, powerStep: 1,
    applyAura: (p, share) => { p.hp *= 1 + share; },
  },
  {
    id: 'navigator', name: 'admiralNavigator', active: 'activeJump', auraText: 'auraNavigator', activeText: 'activeJumpText',
    aura: 0.08, auraStep: 0.03, cooldownMs: 80_000, cooldownStep: 6_000, power: 6, powerStep: 2,
    applyAura: (p, share) => { p.speed *= 1 + share; },
  },
  {
    id: 'broker', name: 'admiralBroker', active: 'activeWindfall', auraText: 'auraBroker', activeText: 'activeWindfallText',
    aura: 0.1, auraStep: 0.04, cooldownMs: 120_000, cooldownStep: 8_000, power: 120, powerStep: 30,
    applyAura: (p, share) => { p.carry *= 1 + share; },
  },
];

export function admiralOf(id: AdmiralId): AdmiralDef {
  return ADMIRALS.find((a) => a.id === id)!;
}

/** An admiral's rank (1 to MAX_ADMIRAL_RANK) for its experience. */
export function admiralRank(xp: number) {
  return ADMIRAL_RANKS.filter((need) => xp >= need).length;
}

/** What an admiral does at a rank: the aura's share, the active's cooldown and strength. */
export function admiralAt(def: AdmiralDef, rank: number) {
  const r = Math.max(1, Math.min(MAX_ADMIRAL_RANK, rank)) - 1;
  return { aura: def.aura + def.auraStep * r, cooldownMs: def.cooldownMs - def.cooldownStep * r, power: def.power + def.powerStep * r };
}

/** The admiral picked for the next battle (null: none) and each admiral's experience. */
export interface Admirals {
  pick: AdmiralId | null;
  xp: Record<AdmiralId, number>;
}

export const ADMIRALS_KEY = 'space-wars-admirals';

export function newAdmirals(): Admirals {
  return { pick: null, xp: { warden: 0, navigator: 0, broker: 0 } };
}

export function loadAdmirals(): Admirals {
  const out = newAdmirals();
  try {
    const raw = JSON.parse(localStorage.getItem(ADMIRALS_KEY) ?? 'null');
    if (raw && typeof raw === 'object') {
      if (ADMIRAL_IDS.includes(raw.pick)) out.pick = raw.pick;
      for (const id of ADMIRAL_IDS) {
        const xp = Number(raw.xp?.[id]);
        if (Number.isFinite(xp) && xp > 0) out.xp[id] = Math.floor(xp);
      }
    }
  } catch {
    // An unreadable save starts afresh.
  }
  return out;
}

export function saveAdmirals(a: Admirals) {
  try {
    localStorage.setItem(ADMIRALS_KEY, JSON.stringify(a));
  } catch {
    // Storage may be full or blocked; the admirals then last only this visit.
  }
}

/** The next choice on the picker: none, then each admiral in turn. */
export function nextAdmiral(a: Admirals): Admirals {
  const k = a.pick ? ADMIRAL_IDS.indexOf(a.pick) : -1;
  return { ...a, pick: k + 1 < ADMIRAL_IDS.length ? ADMIRAL_IDS[k + 1] : null };
}

/** A battle with the admiral in command ended: it gains experience, more for a win. */
export function admiralServed(a: Admirals, id: AdmiralId, won: boolean): Admirals {
  return { ...a, xp: { ...a.xp, [id]: a.xp[id] + ADMIRAL_XP.fought + (won ? ADMIRAL_XP.won : 0) } };
}
