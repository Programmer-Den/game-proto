// The player's battle spell and match kind, kept between matches under the save keys
// `lane-brawl-spell` and `lane-brawl-mode` (`lane-brawl-quick` before ranked and event matches).

import { SPELLS, SpellId } from './data';

const KEY = 'lane-brawl-spell';

/** The battle spell the player picked last, or Blink. */
export function loadSpell(): SpellId {
  try {
    const id = localStorage.getItem(KEY);
    if (SPELLS.some((sp) => sp.id === id)) return id as SpellId;
  } catch {
    // Storage blocked: the default it is.
  }
  return 'blink';
}

export function saveSpell(id: SpellId) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // Storage blocked: the pick lasts for this visit only.
  }
}

const QUICK_KEY = 'lane-brawl-quick';

/** Whether the player picked a quick match last time. */
export function loadQuick(): boolean {
  try {
    return localStorage.getItem(QUICK_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveQuick(quick: boolean) {
  try {
    localStorage.setItem(QUICK_KEY, quick ? '1' : '0');
  } catch {
    // Storage blocked: the pick lasts for this visit only.
  }
}

/** The kind of match picked: full, quick, ranked (LB15) or the week's event (LB17). */
export type MatchMode = 'full' | 'quick' | 'ranked' | 'event';
export const MODES: MatchMode[] = ['full', 'quick', 'ranked', 'event'];
const MODE_KEY = 'lane-brawl-mode';

/** The match kind picked last; an older save's quick pick counts. */
export function loadMode(): MatchMode {
  try {
    const m = localStorage.getItem(MODE_KEY) as MatchMode | null;
    if (m && MODES.includes(m)) return m;
  } catch {
    // Storage blocked: fall through to the old key, then a full match.
  }
  return loadQuick() ? 'quick' : 'full';
}

export function saveMode(mode: MatchMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // Storage blocked: the pick lasts for this visit only.
  }
}
