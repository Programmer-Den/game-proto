// The ranked ladder (LB15): the player's tier and stars, kept in the browser under
// `lane-brawl-ladder`, and the colours won on it (`SKINS`), the one worn under `lane-brawl-skin`.

import { LADDER, SKINS, SkinId, TIERS } from './data';

const KEY = 'lane-brawl-ladder';
const SKIN_KEY = 'lane-brawl-skin';

export interface Ladder {
  /** The tier now (index into `TIERS`) and its stars, 0 to `LADDER.stars - 1` (the top tier keeps up to `LADDER.stars`). */
  tier: number;
  stars: number;
  /** The highest tier reached, and ranked wins and losses so far. */
  best: number;
  wins: number;
  losses: number;
}

const TOP = TIERS.length - 1;

/** The saved ladder, or a fresh one at Bronze. */
export function loadLadder(): Ladder {
  const fresh: Ladder = { tier: 0, stars: 0, best: 0, wins: 0, losses: 0 };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return fresh;
    const num = (v: unknown, max: number) => (typeof v === 'number' && v >= 0 ? Math.min(Math.floor(v), max) : 0);
    const tier = num(raw.tier, TOP);
    return { tier, stars: num(raw.stars, LADDER.stars), best: Math.max(tier, num(raw.best, TOP)), wins: num(raw.wins, 1e6), losses: num(raw.losses, 1e6) };
  } catch {
    return fresh;
  }
}

/** What one ranked match did to the ladder. */
export interface LadderResult {
  before: Ladder;
  after: Ladder;
  /** The tier went up or down, or stayed. */
  moved: 'up' | 'down' | 'none';
  /** A colour won by this match, if any. */
  skin: SkinId | null;
}

/** The ladder after a ranked win or loss: a star won or lost, a tier up at `LADDER.stars`, or down below none. */
export function climb(l: Ladder, won: boolean): LadderResult {
  const after = { ...l };
  let moved: LadderResult['moved'] = 'none';
  if (won) {
    after.wins++;
    after.stars++;
    if (after.stars >= LADDER.stars && after.tier < TOP) {
      after.tier++;
      after.stars = 0;
      moved = 'up';
    }
    after.stars = Math.min(after.stars, LADDER.stars);
  } else {
    after.losses++;
    if (after.stars > 0) after.stars--;
    else if (after.tier > 0) {
      after.tier--;
      after.stars = LADDER.stars - 1;
      moved = 'down';
    }
  }
  after.best = Math.max(after.best, after.tier);
  const had = skinsWon(l), has = skinsWon(after);
  return { before: l, after, moved, skin: has.find((id) => !had.includes(id)) ?? null };
}

/** Saves a ranked match's result and returns it. */
export function recordRanked(won: boolean): LadderResult {
  const r = climb(loadLadder(), won);
  try {
    localStorage.setItem(KEY, JSON.stringify(r.after));
  } catch {
    // Storage blocked: the result still shows on the end panel, it just isn't kept.
  }
  return r;
}

/** The colours the ladder has won: Bronze's with the first ranked win, then every tier reached. */
export function skinsWon(l: Ladder): SkinId[] {
  return SKINS.filter((sk, i) => sk.id === 'team' || (sk.id === 'bronze' ? l.wins > 0 : i - 1 <= l.best)).map((sk) => sk.id);
}

/** The colours the player's champion wears, if still won; the team's blue by default. */
export function loadSkin(): SkinId {
  try {
    const id = localStorage.getItem(SKIN_KEY) as SkinId | null;
    if (id && skinsWon(loadLadder()).includes(id)) return id;
  } catch {
    // Storage blocked: the default it is.
  }
  return 'team';
}

export function saveSkin(id: SkinId) {
  try {
    localStorage.setItem(SKIN_KEY, id);
  } catch {
    // Storage blocked: the pick lasts for this visit only.
  }
}

/** Stars as text: filled for those held, hollow for the rest. */
export function starText(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(Math.max(0, LADDER.stars - stars));
}
