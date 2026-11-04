import { CODEX, CODEX_KINDS, LEADER_KINDS, LOYALTY, NO_OUTPOST, type Codex, type LeaderKind, OPERATION_KINDS, OUTPOST_KINDS, OUTPOST_MAX, ROLE_KINDS, type OperationKind, type Outpost, type UpgradeKind, type Veteran, UPGRADE_KINDS } from './rules';

// What Deadline keeps between visits: the best wave reached, the chosen art style, the scrap banked
// from kills, the starting crates and outpost upgrades bought with it, the operation picked for the
// next run, each operation's best, the squad's veterans, the squad leaders and the zombie codex. Every game shares the hub's
// origin, so every key starts with the game's name.

export const BEST_KEY = 'deadline-best';
export const STYLE_KEY = 'deadline-style';
export const SCRAP_KEY = 'deadline-scrap';
export const KIT_KEY = 'deadline-kit';
export const OUTPOST_KEY = 'deadline-outpost';
export const OPERATION_KEY = 'deadline-operation';
export const OPERATION_BEST_KEY = 'deadline-operation-best';
export const ROSTER_KEY = 'deadline-roster';
export const LEADERS_KEY = 'deadline-leaders';
export const CODEX_KEY = 'deadline-codex';

/** The two looks the game can be drawn in: a pulp horror comic, or a night-vision camera feed. */
export type ArtStyle = 'comic' | 'nv';
export const ART_STYLES: readonly ArtStyle[] = ['comic', 'nv'];

/** The highest wave any run has reached, or 0 when none is saved (or it was broken). */
export function loadBest() {
  try {
    const wave = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(wave) && wave > 0 ? Math.floor(wave) : 0;
  } catch {
    return 0;
  }
}

export function saveBest(wave: number) {
  try {
    localStorage.setItem(BEST_KEY, String(wave));
  } catch {
    // Storage can be full or blocked (private mode); the game keeps running unsaved.
  }
}

/** The saved art style; the comic when none is saved. */
export function loadStyle(): ArtStyle {
  try {
    const style = localStorage.getItem(STYLE_KEY);
    return style === 'nv' ? 'nv' : 'comic';
  } catch {
    return 'comic';
  }
}

export function saveStyle(style: ArtStyle) {
  try {
    localStorage.setItem(STYLE_KEY, style);
  } catch {
    // As above: unsaved is fine.
  }
}

/** The scrap banked from every run's kills, or 0 when none is saved (or it was broken). */
export function loadScrap() {
  try {
    const n = Number(localStorage.getItem(SCRAP_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function saveScrap(n: number) {
  try {
    localStorage.setItem(SCRAP_KEY, String(n));
  } catch {
    // As above.
  }
}

/** The starting crates bought for the next run, each kind at most once; anything unknown is dropped. */
export function loadKit(): UpgradeKind[] {
  try {
    const kit: unknown = JSON.parse(localStorage.getItem(KIT_KEY) ?? '[]');
    return Array.isArray(kit) ? UPGRADE_KINDS.filter((k) => kit.includes(k)) : [];
  } catch {
    return [];
  }
}

export function saveKit(kit: UpgradeKind[]) {
  try {
    if (kit.length) localStorage.setItem(KIT_KEY, JSON.stringify(kit));
    else localStorage.removeItem(KIT_KEY);
  } catch {
    // As above.
  }
}

/** Reads a saved JSON object, or null when there is none (or it was broken). */
function loadObject(key: string): Record<string, unknown> | null {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function saveObject(key: string, v: object) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    // As above.
  }
}

/** A whole number from 0 to `max`, or 0 for anything else. */
const level = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.floor(v))) : 0);

/** The outpost upgrades' levels; every one at 0 on a fresh save, and anything broken loads as 0. */
export function loadOutpost(): Outpost {
  const o = loadObject(OUTPOST_KEY) ?? {};
  return Object.fromEntries(OUTPOST_KINDS.map((k) => [k, level(o[k], OUTPOST_MAX)])) as Outpost;
}

export function saveOutpost(outpost: Outpost) {
  saveObject(OUTPOST_KEY, { ...NO_OUTPOST, ...outpost });
}

/** The operation the next run plays; the Open Road when none (or an unknown one) is saved. */
export function loadOperation(): OperationKind {
  try {
    const op = localStorage.getItem(OPERATION_KEY);
    return OPERATION_KINDS.find((k) => k === op) ?? 'road';
  } catch {
    return 'road';
  }
}

export function saveOperation(op: OperationKind) {
  try {
    localStorage.setItem(OPERATION_KEY, op);
  } catch {
    // As above.
  }
}

/** Each operation's best: the most of its waves a run has cleared (0 when none is saved). */
export function loadOperationBests(): Record<OperationKind, number> {
  const o = loadObject(OPERATION_BEST_KEY) ?? {};
  return Object.fromEntries(OPERATION_KINDS.map((k) => [k, level(o[k], 1000)])) as Record<OperationKind, number>;
}

export function saveOperationBests(bests: Record<OperationKind, number>) {
  saveObject(OPERATION_BEST_KEY, bests);
}

/** The veterans on the roster, and the two (at most) picked to start the next run. */
export interface Roster {
  vets: Veteran[];
  picked: number[];
}

/** The roster; empty on a fresh save. Broken veterans are dropped, and so are picks that point nowhere. */
export function loadRoster(): Roster {
  const o = loadObject(ROSTER_KEY) ?? {};
  const vets = (Array.isArray(o.vets) ? o.vets : [])
    .filter((v): v is Veteran => !!v && typeof v === 'object' && typeof v.name === 'string' && ROLE_KINDS.includes(v.role))
    .slice(0, LOYALTY.size)
    .map((v) => ({ name: v.name.slice(0, 16), role: v.role, rank: Math.max(1, level(v.rank, LOYALTY.maxRank)) }));
  const picked = (Array.isArray(o.picked) ? o.picked : [])
    .filter((i, k, all): i is number => typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < vets.length && all.indexOf(i) === k)
    .slice(0, LOYALTY.picks);
  return { vets, picked };
}

export function saveRoster(roster: Roster) {
  saveObject(ROSTER_KEY, roster);
}

/** The squad leaders: the one picked to lead the next run (null for none) and each one's xp. */
export interface Leaders {
  picked: LeaderKind | null;
  xp: Record<LeaderKind, number>;
}

/** The leaders; none picked and no xp on a fresh save, and anything broken loads as that. */
export function loadLeaders(): Leaders {
  const o = loadObject(LEADERS_KEY) ?? {};
  const xp = (o.xp && typeof o.xp === 'object' ? o.xp : {}) as Record<string, unknown>;
  return {
    picked: LEADER_KINDS.find((k) => k === o.picked) ?? null,
    xp: Object.fromEntries(LEADER_KINDS.map((k) => [k, level(xp[k], 100000)])) as Record<LeaderKind, number>,
  };
}

export function saveLeaders(leaders: Leaders) {
  saveObject(LEADERS_KEY, leaders);
}

/** The zombie codex: kills of each kind, up to its full page; all 0 on a fresh save. */
export function loadCodex(): Codex {
  const o = loadObject(CODEX_KEY) ?? {};
  return Object.fromEntries(CODEX_KINDS.map((k) => [k, level(o[k], CODEX.pages[k])])) as Codex;
}

export function saveCodex(codex: Codex) {
  saveObject(CODEX_KEY, codex);
}
