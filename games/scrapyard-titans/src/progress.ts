/**
 * What lasts between matches, saved under `scrapyard-titans-stats`: matches played, wins, the best
 * place and the deeds done, which unlock commanders (`CommanderDef.unlock`). Watched matches never
 * count. No Phaser.
 */
import { MAX_LEVEL, PLAYER_COMMANDERS, TRAITS, type CommanderDef, type DeedId, type OriginId } from './game/data';
import { allUnits, boardUnits, countTraits, type Match } from './game/match';

const STORE_KEY = 'scrapyard-titans-stats';
const DEEDS: DeedId[] = ['topFour', 'threeStar', 'fullOrigin', 'maxLevel', 'champion'];

export interface Progress {
  played: number;
  wins: number;
  best: number;
  deeds: DeedId[];
}

export function loadProgress(): Progress {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}');
    const deeds = Array.isArray(s.deeds) ? DEEDS.filter((d) => s.deeds.includes(d)) : [];
    return { played: Number(s.played) || 0, wins: Number(s.wins) || 0, best: Number(s.best) || 0, deeds };
  } catch {
    return { played: 0, wins: 0, best: 0, deeds: [] };
  }
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(p));
  } catch {
    // Blocked storage: the progress lasts until the page closes.
  }
}

export const isUnlocked = (p: Progress, c: CommanderDef) => !c.unlock || p.deeds.includes(c.unlock);

/** Marks deeds done; returns the commanders they unlock. */
export function doDeeds(p: Progress, deeds: DeedId[]): CommanderDef[] {
  const fresh = deeds.filter((d) => !p.deeds.includes(d));
  if (!fresh.length) return [];
  p.deeds.push(...fresh);
  saveProgress(p);
  return PLAYER_COMMANDERS.filter((c) => c.unlock && fresh.includes(c.unlock));
}

/** The deeds the player's seat has done right now: a three-star robot and level 9. */
export function planDeeds(m: Match): DeedId[] {
  const me = m.players[0];
  const out: DeedId[] = [];
  if (allUnits(me).some((o) => o.star >= 3)) out.push('threeStar');
  if (me.level >= MAX_LEVEL) out.push('maxLevel');
  return out;
}

/** Whether the player's board has six robots of one origin (its top tier). */
export function fullOrigin(m: Match): boolean {
  const traits = countTraits(boardUnits(m.players[0]));
  return Object.entries(traits).some(([id, n]) => TRAITS[id as OriginId].kind === 'origin' && (n ?? 0) >= 6);
}
