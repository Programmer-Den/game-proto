// The captain's log: five named enemy captains, each sailing first on her own wave. A named captain
// runs for it once her hull is low, and one who gets away comes back a few waves later in a
// sturdier ship with a bounty on her head. Sinking (or taking) all five, over any number of runs,
// fills the log, which earns the lasting Renown.

import type { TextKey } from '../i18n';
import type { EnemyKind } from './ships';

export type CaptainId = 'maren' | 'hask' | 'tull' | 'corra' | 'ansel';

export interface Captain {
  /** A key of `i18n/en.ts`. */
  name: TextKey;
  /** The kind of ship she sails. */
  kind: EnemyKind;
  /** The wave she first sails on. */
  wave: number;
}

export const CAPTAINS: Record<CaptainId, Captain> = {
  maren: { name: 'marenName', kind: 'brig', wave: 4 },
  hask: { name: 'haskName', kind: 'galleon', wave: 7 },
  tull: { name: 'tullName', kind: 'ketch', wave: 9 },
  corra: { name: 'corraName', kind: 'brig', wave: 12 },
  ansel: { name: 'anselName', kind: 'galleon', wave: 15 },
};

export const CAPTAIN_IDS = Object.keys(CAPTAINS) as CaptainId[];

/** A named captain's ship is this much sturdier than others of her kind. */
export const CAPTAIN_HP = 1.5;
/** And this much more again each time she has got away. */
export const RETURN_HP = 0.3;
/** She runs for it once her hull is down to this share. */
export const FLEE_HP = 0.35;
/** How long she must run to get clean away, and how much faster she sails while running. */
export const FLEE_MS = 9000;
export const FLEE_SPEED = 1.2;
/** How many waves later a captain who got away sails again. */
export const RETURN_WAVES = 3;
/** The bounty on a captain's head for each time she has got away. */
export const CAPTAIN_BOUNTY = 40;
/** What sinking her pays on top of her loot. */
export const captainBounty = (escapes: number) => CAPTAIN_BOUNTY * escapes;
/** With Renown (the log filled) an enemy ship can be boarded at this share of her hull, not a fifth. */
export const RENOWN_BOARD_HP = 0.25;

/** One captain in this run: still to sail, at sea, got away (and `due` back) or sunk. */
export interface CaptainRun {
  state: 'waiting' | 'sailing' | 'escaped' | 'sunk';
  /** The wave she sails on next. */
  due: number;
  escapes: number;
}

/** Every captain waiting for her first wave, as a run starts. */
export function newCaptains(): Record<CaptainId, CaptainRun> {
  const run = {} as Record<CaptainId, CaptainRun>;
  for (const id of CAPTAIN_IDS) run[id] = { state: 'waiting', due: CAPTAINS[id].wave, escapes: 0 };
  return run;
}

/** Whether the lasting log holds every captain. */
export const logFull = (log: CaptainId[]) => CAPTAIN_IDS.every((id) => log.includes(id));
