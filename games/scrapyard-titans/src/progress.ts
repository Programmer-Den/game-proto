/**
 * What lasts between matches, saved under `scrapyard-titans-stats`: matches played, wins, the best
 * place, the deeds done, which unlock commanders (`CommanderDef.unlock`), and the rank points
 * (`RANKS`), this week's best place in the weekly season and the campaign lobbies cleared. The
 * saved winning squads, which come back as ghosts, sit under `scrapyard-titans-squads`, the
 * workshop's robots under `scrapyard-titans-workshop` and the daily lobby's record under
 * `scrapyard-titans-daily` (`shared/daily.ts`). Watched matches never count. No Phaser.
 */
import { dailyRand, finishDaily, loadDaily, seedOf, seeded, startDaily, today } from '../../../shared/daily';
import {
  BOSSES, CAMPAIGN, CHASSIS, CUSTOM, DAILY, GHOST, ITEMS, MAX_LEVEL, NAME_PARTS, ORIGIN_COLOR, PLAYER_COMMANDERS, RANKS, RANK_POINTS, RIVALS, SETS, TRAITS, UNIT_BY_ID,
  WEAPONS, WEEKLY_ROTATION, WORKSHOP, WORKSHOP_UNLOCKS,
  AUGMENT_BY_ID, type AugmentId, type ClassId, type CommanderDef, type DeedId, type OriginId, type SetId, type UnitDef,
} from './game/data';
import type { Rand } from './game/rng';
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


// ---------------------------------------------------------------- the robot workshop

const WORKSHOP_KEY = 'scrapyard-titans-workshop';

/** A robot built in the workshop: a chassis (origin), a weapon (class) and the name the player gave it. */
export interface Build {
  id: string;
  name: string;
  origin: OriginId;
  cls: ClassId;
}

/** The chassis and weapons the cleared campaign lobbies have unlocked. */
export const workshopParts = (p: Progress) => new Set<string>(WORKSHOP_UNLOCKS.slice(0, p.campaign).flat());
/** The campaign lobby (index) whose first clear unlocks a chassis or weapon. */
export const unlockedBy = (piece: string) => WORKSHOP_UNLOCKS.findIndex((l) => (l as string[]).includes(piece));

/** A build as a robot the shop can sell, the cost every workshop robot has. */
export const buildDef = (b: Build): UnitDef => ({ id: b.id, name: 'customRobot', label: b.name, cost: WORKSHOP.cost, origin: b.origin, cls: b.cls, custom: true });

/** Puts the builds into `CUSTOM` and `UNIT_BY_ID`, so matches, saved squads and the painter find them. */
function register(builds: Build[]) {
  for (const d of CUSTOM) delete UNIT_BY_ID[d.id];
  CUSTOM.length = 0;
  for (const b of builds) {
    const def = buildDef(b);
    CUSTOM.push(def);
    UNIT_BY_ID[def.id] = def;
  }
}

/** Cleans a typed name: one line, no longer than `WORKSHOP.nameMax`. */
export const cleanName = (name: string) => name.replace(/\s+/g, ' ').trim().slice(0, WORKSHOP.nameMax);

/** The builds kept in memory once saving them failed (storage blocked or full), so they last until the page closes. */
let unsaved: Build[] | null = null;

/** The saved builds (registered as robots as they load). */
export function loadBuilds(): Build[] {
  if (unsaved) {
    register(unsaved);
    return unsaved;
  }
  let builds: Build[] = [];
  try {
    const list = JSON.parse(localStorage.getItem(WORKSHOP_KEY) ?? '[]');
    if (Array.isArray(list)) {
      builds = list
        .filter((b) => b && typeof b.id === 'string' && /^w-[a-z0-9]+$/.test(b.id) && typeof b.name === 'string' && cleanName(b.name) && CHASSIS.includes(b.origin) && WEAPONS.includes(b.cls))
        .map((b) => ({ id: b.id, name: cleanName(b.name), origin: b.origin, cls: b.cls }))
        .slice(0, WORKSHOP.slots);
    }
  } catch {
    // A broken or blocked save: an empty workshop.
  }
  register(builds);
  return builds;
}

function saveBuilds(builds: Build[]) {
  register(builds);
  try {
    localStorage.setItem(WORKSHOP_KEY, JSON.stringify(builds));
    unsaved = null;
  } catch {
    // Blocked or full storage: the builds last in memory until the page closes.
    unsaved = builds;
  }
}

/** Builds a robot; null when the workshop is full, a piece is still locked or the name is empty. */
export function addBuild(p: Progress, name: string, origin: OriginId, cls: ClassId): Build | null {
  const builds = loadBuilds();
  const parts = workshopParts(p);
  const clean = cleanName(name);
  if (builds.length >= WORKSHOP.slots || !parts.has(origin) || !parts.has(cls) || !clean) return null;
  const build = { id: `w-${Date.now().toString(36)}${builds.length}`, name: clean, origin, cls };
  saveBuilds([...builds, build]);
  return build;
}

/** Scraps a build: it leaves the shop pool (and saved squads with it no longer come back). */
export function scrapBuild(id: string) {
  saveBuilds(loadBuilds().filter((b) => b.id !== id));
}

/** A name to suggest for a new build. */
export const suggestName = () => `${NAME_PARTS.first[Math.floor(Math.random() * NAME_PARTS.first.length)]} ${NAME_PARTS.last[Math.floor(Math.random() * NAME_PARTS.last.length)]}`;

// ---------------------------------------------------------------- the daily lobby

const GAME = 'scrapyard-titans';

/** The daily lobby's rules, the same for every player on the day. */
export interface DailyRules {
  day: string;
  set: SetId;
  terrain: boolean;
  /** Index into `PLAYER_COMMANDERS`: the day lends one, locked or not. */
  commander: number;
  rivals: CommanderDef[];
}

export function dailyRules(day = today()): DailyRules {
  const r = seeded(seedOf(`${GAME}:${day}:rules`));
  const pick = (n: number) => Math.floor(r() * n);
  const set: SetId = r() < 0.5 ? 'scrap' : 'neon';
  const terrain = r() < 0.5;
  const commander = pick(PLAYER_COMMANDERS.length);
  const rivals = [...RIVALS];
  for (let i = rivals.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [rivals[i], rivals[j]] = [rivals[j], rivals[i]];
  }
  if (r() < DAILY.bossChance) rivals[pick(rivals.length)] = BOSSES[pick(BOSSES.length)];
  return { day, set, terrain, commander, rivals };
}

/** The daily lobby's random source for everything but the shops. */
export const dailyMatchRand = (day: string): Rand => dailyRand(GAME, day);
/** Today's daily record: whether it was played, today's place and the best one, and the streak. */
export function dailyRecord(day = today()) {
  const d = loadDaily(GAME, day);
  // Scores are 9 - place, so the higher the better as `shared/daily.ts` keeps them.
  return { played: d.played, place: d.score !== null ? 9 - d.score : 0, best: d.best ? 9 - d.best : 0, streak: d.streak };
}
/** Uses up the day's try. */
export const startDailyTry = (day: string) => startDaily(GAME, day);
/** Saves the day's place. */
export const finishDailyTry = (day: string, place: number) => finishDaily(GAME, 9 - place, day);
