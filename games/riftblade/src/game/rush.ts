/**
 * The boss rush: every boss met so far (the codex's bosses), one after the other with a set kit,
 * for a best time. The planets come in the crusade's order; between bosses the hero heals a little.
 * Imports nothing from the game but tables.
 */
import { PLANETS } from './planets';

/**
 * The set kit: the hero starts at `level` with each of its three paths at `tiers` and its drill at
 * `drill`; it gains no XP. Its bosses have `bossHp` of their health, and between them it heals
 * `heal` of its own. A rush opens once `minBosses` have been met.
 */
export const RUSH = { level: 12, tiers: 3, drill: 2, heal: 0.35, bossHp: 0.5, minBosses: 2, firstTideMs: 6000, firstPillarMs: 4000 };

/** The planets (indices into `PLANETS`) whose bosses `seen` (codex entry ids) holds, in the crusade's order. */
export function rushPlanets(seen: readonly string[]): number[] {
  return PLANETS.map((p, i) => ({ p, i }))
    .filter(({ p }) => seen.includes(`boss:${p.boss}`))
    .sort((a, b) => a.p.stage - b.p.stage || a.i - b.i)
    .map(({ i }) => i);
}

/** The best rush kept in the save: the most bosses beaten in one, and the fastest time for that many. */
export interface RushRecord {
  bosses: number;
  ms: number;
}

/** Whether a finished rush (`bosses` beaten in `ms`) beats the record. */
export const beatsRush = (best: RushRecord | null, bosses: number, ms: number) =>
  bosses > 0 && (!best || bosses > best.bosses || (bosses === best.bosses && ms < best.ms));
