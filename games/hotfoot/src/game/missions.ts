// The run missions: three standing goals for an ordinary run ("slide under 8 logs in one run",
// "stomp 3 bats in one run"), each paying banked coins the moment it is met. A met mission is
// replaced at once by the next one in turn, a step harder each time round, so every run has a goal
// of its own. Progress counts within one run: it starts from 0 when a run starts (and when a
// mission is dealt mid-run). Texts are keys of `i18n/en.ts`, filled in with the goal as `n`.
import type { TextKey } from '../i18n';

export type MissionKind = 'logs' | 'coins' | 'bats' | 'smash' | 'row' | 'metres' | 'high' | 'dares';

/**
 * Each kind's text, its goal on the first time round (`base`) and how much it grows each time round
 * after (`step`). A `max` kind keeps the most reached (a row of stomps, metres run), not a count.
 */
export const MISSIONS: Record<MissionKind, { text: TextKey; base: number; step: number; max?: boolean }> = {
  logs: { text: 'missionLogs', base: 8, step: 4 },
  coins: { text: 'missionCoins', base: 120, step: 60 },
  bats: { text: 'missionBats', base: 3, step: 2 },
  smash: { text: 'missionSmash', base: 3, step: 2 },
  row: { text: 'missionRow', base: 3, step: 1, max: true },
  metres: { text: 'missionMetres', base: 250, step: 150, max: true },
  high: { text: 'missionHigh', base: 15, step: 10 },
  dares: { text: 'missionDares', base: 1, step: 1 },
};
/** The order missions are dealt in, round and round. */
export const MISSION_ORDER: MissionKind[] = ['logs', 'coins', 'bats', 'smash', 'row', 'metres', 'high', 'dares'];
/** How many missions stand at once. */
export const MISSION_SLOTS = 3;

export interface Mission {
  kind: MissionKind;
  /** How many times round the order this mission is (1 the first time): sets its goal and reward. */
  tier: number;
  /** How far it has come this run. */
  progress: number;
  /** For metres: the metre it was dealt at, which it counts from. */
  from: number;
}

/** The three missions standing, and how many have been dealt so far (where the order goes on). */
export interface MissionBoard {
  slots: Mission[];
  dealt: number;
}

export const goalOf = (m: Pick<Mission, 'kind' | 'tier'>) => MISSIONS[m.kind].base + MISSIONS[m.kind].step * (m.tier - 1);
/** Banked coins a mission pays: 20, then 10 more each time round, up to 60. */
export const rewardOf = (m: Pick<Mission, 'tier'>) => Math.min(60, 20 + 10 * (m.tier - 1));

/** The next mission in turn whose kind isn't standing already (the slot `replacing` aside), at the tier of its time round. */
export function dealMission(board: MissionBoard, replacing = -1): Mission {
  const standing = board.slots.filter((_, i) => i !== replacing).map((m) => m.kind);
  for (let i = board.dealt; ; i++) {
    const kind = MISSION_ORDER[i % MISSION_ORDER.length];
    if (standing.includes(kind)) continue;
    board.dealt = i + 1;
    return { kind, tier: 1 + Math.floor(i / MISSION_ORDER.length), progress: 0, from: 0 };
  }
}

/** The first three missions. */
export function freshBoard(): MissionBoard {
  const board: MissionBoard = { slots: [], dealt: 0 };
  while (board.slots.length < MISSION_SLOTS) board.slots.push(dealMission(board));
  return board;
}

/** The board as a new run starts it: the same missions, each from 0. */
export const boardForRun = (b: MissionBoard): MissionBoard => ({ dealt: b.dealt, slots: b.slots.map((m) => ({ ...m, progress: 0, from: 0 })) });
