/**
 * What lasts between matches, saved under `scrapyard-titans-stats`: matches played, wins, the best
 * place, the deeds done, which unlock commanders (`CommanderDef.unlock`), and the rank points
 * (`RANKS`), this week's best place in the weekly season and the campaign lobbies cleared. The
 * saved winning squads, which come back as ghosts, sit under `scrapyard-titans-squads`. Watched
 * matches never count. No Phaser.
 */
import {
  CAMPAIGN, GHOST, ITEMS, MAX_LEVEL, ORIGIN_COLOR, PLAYER_COMMANDERS, RANKS, RANK_POINTS, SETS, TRAITS, UNIT_BY_ID, WEEKLY_ROTATION,
  AUGMENT_BY_ID, type AugmentId, type CommanderDef, type DeedId, type OriginId,
} from './game/data';
import { allUnits, boardUnits, countTraits, type Match, type SavedSquad } from './game/match';

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
  /** Campaign lobbies cleared, 0 to 10: the next one to play is `CAMPAIGN[campaign]`. */
  campaign: number;
}

export function loadProgress(): Progress {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}');
    const deeds = Array.isArray(s.deeds) ? DEEDS.filter((d) => s.deeds.includes(d)) : [];
    const weekly = s.weekly && Number.isFinite(s.weekly.week) && Number(s.weekly.best) > 0 ? { week: Number(s.weekly.week), best: Number(s.weekly.best) } : null;
    const campaign = Math.min(CAMPAIGN.length, Math.max(0, Math.floor(Number(s.campaign) || 0)));
    return { played: Number(s.played) || 0, wins: Number(s.wins) || 0, best: Number(s.best) || 0, deeds, points: Math.max(0, Number(s.points) || 0), weekly, campaign };
  } catch {
    return { played: 0, wins: 0, best: 0, deeds: [], points: 0, weekly: null, campaign: 0 };
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

// ---------------------------------------------------------------- the junkyard campaign

/** The lobby the campaign card plays: the next one, or the last once all ten are cleared. */
export const nextLobby = (p: Progress) => Math.min(p.campaign, CAMPAIGN.length - 1);

/** What the player starts a campaign lobby with: every cleared lobby's reward. */
export const campaignKit = (p: Progress) => CAMPAIGN.slice(0, p.campaign).map((l) => l.reward);

/**
 * Whether a finished campaign match clears its lobby: the place is the lobby's goal or better, and
 * every boss in it fell before the player did (a boss still standing hasn't).
 */
export function lobbyCleared(m: Match, place: number): boolean {
  if (m.opts.lobby == null) return false;
  const bosses = m.players.filter((p) => p.commander.boss);
  return place <= CAMPAIGN[m.opts.lobby].goal && bosses.every((b) => !b.alive && b.place > place);
}

/** Saves a cleared lobby; returns the reward it added to the kit, or null if it was cleared before. */
export function clearLobby(p: Progress, lobby: number): string | null {
  if (lobby !== p.campaign) return null;
  p.campaign++;
  saveProgress(p);
  return CAMPAIGN[lobby].reward;
}

// ---------------------------------------------------------------- squad replays

const SQUADS_KEY = 'scrapyard-titans-squads';

/** Keeps a saved squad only if every robot, part and card in it still exists. */
function validSquad(s: unknown): s is SavedSquad {
  const q = s as SavedSquad;
  if (!q || !Array.isArray(q.fighters) || !q.fighters.length || !Array.isArray(q.augments)) return false;
  if (!SETS.some((x) => x.id === q.set) || !PLAYER_COMMANDERS[q.commander]) return false;
  if (!q.augments.every((a: AugmentId) => AUGMENT_BY_ID[a])) return false;
  const tiles = new Set<string>();
  return q.fighters.every((f) => {
    const tile = `${f.col},${f.row}`;
    const ok = !!UNIT_BY_ID[f.defId] && [1, 2, 3].includes(f.star) && Array.isArray(f.items) && f.items.length <= 3 && f.items.every((i) => ITEMS[i])
      && (f.gilded === null || f.gilded in ORIGIN_COLOR) && Number.isInteger(f.col) && f.col >= 0 && f.col <= 7 && [4, 5, 6, 7].includes(f.row) && !tiles.has(tile);
    tiles.add(tile);
    return ok;
  });
}

/** The saved winning squads, oldest first. */
export function loadSquads(): SavedSquad[] {
  try {
    const list = JSON.parse(localStorage.getItem(SQUADS_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter(validSquad).slice(-GHOST.keep) : [];
  } catch {
    return [];
  }
}

/** Saves a won match's final board, keeping the newest `GHOST.keep`. Returns false for an empty board. */
export function saveSquad(squad: SavedSquad): boolean {
  if (!squad.fighters.length) return false;
  const list = [...loadSquads(), squad].slice(-GHOST.keep);
  try {
    localStorage.setItem(SQUADS_KEY, JSON.stringify(list));
  } catch {
    // Blocked storage: the squad is lost with the page.
  }
  return true;
}

/** A saved squad to fight as a ghost, picked at random, or null with none saved. */
export function pickSquad(): SavedSquad | null {
  const list = loadSquads();
  return list.length ? list[Math.floor(Math.random() * list.length)] : null;
}

