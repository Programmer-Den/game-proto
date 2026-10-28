// The player's battle spell, kept between matches under the save key `lane-brawl-spell`.

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
