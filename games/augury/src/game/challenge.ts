import { KINDS, type KindId } from './kinds';
import { soloKind, type Run } from './run';

// Challenge codes: a finished Draft Run or Solo Run shares the seed its cards were drawn from and
// its score, as a short code (or a link with `?challenge=<code>`). A friend who plays it gets the
// same cards and sees the score to beat. `D-<seed>-<score>` for a draft, `S<kind>-<seed>-<score>` for
// a Solo Run, with the kind as a letter (A for the first of `KINDS`) and the numbers in base 36.

export interface Challenge {
  mode: 'draft' | 'solo';
  kind?: KindId;
  seed: number;
  score: number;
}

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The code of a Draft Run or Solo Run with a seed, or null for any other run. */
export function challengeCode(run: Run): string | null {
  if (!run.seed || (run.mode !== 'draft' && run.mode !== 'solo')) return null;
  const head = run.mode === 'draft' ? 'D' : `S${LETTERS[KINDS.indexOf(soloKind(run))]}`;
  return `${head}-${run.seed.toString(36)}-${run.score.toString(36)}`.toUpperCase();
}

/** Reads a code (any case, spaces ignored), or null when it is not one. */
export function parseChallenge(text: string | null | undefined): Challenge | null {
  const m = /^(D|S([A-Z]))-([0-9A-Z]{1,7})-([0-9A-Z]{1,7})$/.exec((text ?? '').replace(/\s+/g, '').toUpperCase());
  if (!m) return null;
  const seed = parseInt(m[3], 36);
  const score = parseInt(m[4], 36);
  if (!seed || seed >= 2 ** 31 || score > 10_000_000) return null;
  if (m[1] === 'D') return { mode: 'draft', seed, score };
  const kind = KINDS[LETTERS.indexOf(m[2])];
  return kind ? { mode: 'solo', kind, seed, score } : null;
}

/** The link that opens Augury on a challenge. */
export function challengeLink(code: string, href = location.href) {
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('challenge', code);
  return url.toString();
}
