// The player's battle spell and match kind, kept between matches under the save keys
// `lane-brawl-spell` and `lane-brawl-quick`.

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
