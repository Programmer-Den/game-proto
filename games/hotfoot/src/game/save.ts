import { ARMOURY_IDS, ARMOURY, noArmoury, type Armoury } from './armoury';
import { BOON_IDS, type BoonId } from './boons';
import type { Ghost } from './ghost';
import { KNIGHT_IDS, type KnightId } from './knights';

// Progress kept between runs, in the browser's local storage: the best distance, the coins banked,
// the boon bought for the next run, the armoury's levels and the daily course's best. Every key is
// prefixed with the game's name, since every game shares the hub's origin, and the crown from the
// Dragon's Keep, the knights unlocked and ridden with their own bests, and each knight's ghost.
// Storage can be blocked or full, so every access is wrapped.

const BEST = 'hotfoot-best';
const BANK = 'hotfoot-bank';
const PENDING = 'hotfoot-start';
const ARMOURY_KEY = 'hotfoot-armoury';
const DAILY = 'hotfoot-daily';
const CROWN = 'hotfoot-crown';
const KNIGHTS_KEY = 'hotfoot-knights';
/** The ghosts: `-replays`, so they go into a progress file but never into a progress code (too big for a QR code). */
const GHOSTS = 'hotfoot-replays';

export interface Progress {
  best: number;
  bank: number;
  pending: BoonId | null;
  armoury: Armoury;
  /** The best distance on the last daily course run, and its date (`YYYY-MM-DD`). */
  daily: { date: string; best: number } | null;
  /** Whether the dragon of the Dragon's Keep has ever been beaten. */
  crown: boolean;
  /** The knights unlocked (the knight always), who rides the next ordinary run, and the squire's and heavy knight's bests (the knight's is `best`). */
  knights: { unlocked: KnightId[]; ride: KnightId; best: Partial<Record<KnightId, number>> };
}

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function parse(raw: string | null): unknown {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function loadProgress(): Progress {
  const pending = read(PENDING);
  const rawArmoury = parse(read(ARMOURY_KEY)) as Partial<Record<string, unknown>> | null;
  const armoury = noArmoury();
  for (const id of ARMOURY_IDS) {
    const level = Number(rawArmoury?.[id]);
    if (Number.isInteger(level)) armoury[id] = Math.max(0, Math.min(ARMOURY[id].prices.length, level));
  }
  const rawDaily = parse(read(DAILY)) as { date?: unknown; best?: unknown } | null;
  const daily = typeof rawDaily?.date === 'string' && Number.isFinite(Number(rawDaily.best)) ? { date: rawDaily.date, best: Number(rawDaily.best) } : null;
  return {
    best: Number(read(BEST)) || 0,
    bank: Number(read(BANK)) || 0,
    pending: BOON_IDS.find((id) => id === pending) ?? null,
    armoury,
    daily,
    crown: read(CROWN) === '1',
    knights: loadKnights(),
  };
}

function loadKnights(): Progress['knights'] {
  const raw = parse(read(KNIGHTS_KEY)) as { unlocked?: unknown; ride?: unknown; best?: Partial<Record<string, unknown>> } | null;
  const unlocked = KNIGHT_IDS.filter((id) => id === 'knight' || (Array.isArray(raw?.unlocked) && raw.unlocked.includes(id)));
  const ride = unlocked.find((id) => id === raw?.ride) ?? 'knight';
  const best: Partial<Record<KnightId, number>> = {};
  for (const id of KNIGHT_IDS) {
    const m = Number(raw?.best?.[id]);
    if (id !== 'knight' && Number.isFinite(m) && m > 0) best[id] = m;
  }
  return { unlocked, ride, best };
}

/** Each knight's ghost: the samples of their best ordinary run since ghosts were kept. */
export function loadGhosts(): Partial<Record<KnightId, Ghost>> {
  const raw = parse(read(GHOSTS)) as Partial<Record<string, { m?: unknown; at?: unknown }>> | null;
  const ghosts: Partial<Record<KnightId, Ghost>> = {};
  for (const id of KNIGHT_IDS) {
    const g = raw?.[id];
    if (g && Number.isFinite(Number(g.m)) && Array.isArray(g.at) && g.at.length % 3 === 0 && g.at.every((n) => typeof n === 'number')) ghosts[id] = { m: Number(g.m), at: g.at as number[] };
  }
  return ghosts;
}

export function saveGhosts(ghosts: Partial<Record<KnightId, Ghost>>) {
  try {
    localStorage.setItem(GHOSTS, JSON.stringify(ghosts));
  } catch {
    // Too big or blocked: the ghosts just aren't kept.
  }
}

export function saveProgress({ best, bank, pending, armoury, daily, crown, knights }: Progress) {
  try {
    localStorage.setItem(BEST, String(best));
    localStorage.setItem(BANK, String(bank));
    if (pending) localStorage.setItem(PENDING, pending);
    else localStorage.removeItem(PENDING);
    localStorage.setItem(ARMOURY_KEY, JSON.stringify(armoury));
    if (daily) localStorage.setItem(DAILY, JSON.stringify(daily));
    if (crown) localStorage.setItem(CROWN, '1');
    localStorage.setItem(KNIGHTS_KEY, JSON.stringify(knights));
  } catch {
    // Storage can be full or blocked (private mode); the game keeps running unsaved.
  }
}
