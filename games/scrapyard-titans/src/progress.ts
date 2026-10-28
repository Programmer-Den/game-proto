/**
 * What lasts between matches, saved under `scrapyard-titans-stats`: matches played, wins, the best
 * place, the deeds done, which unlock commanders (`CommanderDef.unlock`), and the rank points
 * (`RANKS`) and this week's best place in the weekly season. Watched matches never count. No
 * Phaser.
 */
import { MAX_LEVEL, PLAYER_COMMANDERS, RANKS, RANK_POINTS, TRAITS, WEEKLY_ROTATION, type CommanderDef, type DeedId, type OriginId } from './game/data';
import { allUnits, boardUnits, countTraits, type Match } from './game/match';

const STORE_KEY = 'scrapyard-titans-stats';
const DEEDS: DeedId[] = ['topFour', 'threeStar', 'fullOrigin', 'maxLevel', 'champion'];

export interface Progress {
  played: number;
  wins: number;
  best: number;
  deeds: DeedId[];
  /** Rank points, from top-four finishes; they never go down. */
  points: number;
  /** The best place in the weekly season, for the week it was played (`weekOf`). */
  weekly: { week: number; best: number } | null;
}

export function loadProgress(): Progress {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}');
    const deeds = Array.isArray(s.deeds) ? DEEDS.filter((d) => s.deeds.includes(d)) : [];
    const weekly = s.weekly && Number.isFinite(s.weekly.week) && Number(s.weekly.best) > 0 ? { week: Number(s.weekly.week), best: Number(s.weekly.best) } : null;
    return { played: Number(s.played) || 0, wins: Number(s.wins) || 0, best: Number(s.best) || 0, deeds, points: Math.max(0, Number(s.points) || 0), weekly };
  } catch {
    return { played: 0, wins: 0, best: 0, deeds: [], points: 0, weekly: null };
  }
}

export function saveProgress(p: Progress) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(p));
  } catch {
    // Blocked storage: the progress lasts until the page closes.
  }
}

/** The rank (index into `RANKS`) a number of rank points earns. */
export function rankOf(points: number): number {
  let r = 0;
  while (r + 1 < RANKS.length && points >= RANKS[r + 1].points) r++;
  return r;
}

/** Adds a finished match's rank points; returns the points won and the rank before and after. */
export function addRankPoints(p: Progress, place: number) {
  const before = rankOf(p.points);
  const gained = RANK_POINTS[place] ?? 0;
  p.points += gained;
  return { gained, before, after: rankOf(p.points) };
}

const WEEK_MS = 7 * 24 * 3600 * 1000;
/** Monday 5 January 1970, the start of week 0, in UTC. */
const FIRST_MONDAY = Date.UTC(1970, 0, 5);

/** The number of the week (Monday to Sunday, UTC) a time falls in. */
export const weekOf = (now: number) => Math.floor((now - FIRST_MONDAY) / WEEK_MS);
/** The Monday a week starts on. */
export const weekStart = (week: number) => FIRST_MONDAY + week * WEEK_MS;
/** The weekly season's rules for a week. */
export const weeklyRules = (week: number) => WEEKLY_ROTATION[((week % WEEKLY_ROTATION.length) + WEEKLY_ROTATION.length) % WEEKLY_ROTATION.length];
/** This week's best weekly place, or 0 if it hasn't been played this week. */
export const weeklyBest = (p: Progress, week: number) => (p.weekly?.week === week ? p.weekly.best : 0);

/** Keeps a weekly match's place if it is this week's best. */
export function recordWeekly(p: Progress, week: number, place: number) {
  const best = weeklyBest(p, week);
  p.weekly = { week, best: best ? Math.min(best, place) : place };
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
