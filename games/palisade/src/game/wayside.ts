// Wayside events: from wave 6 some breaks bring an event with a choice instead of an omen. A
// wounded scout (tend him for a free guard, or send him on to scout the next wave), a peddler (a
// relic for half the coins) or a shrine (a blessing and a curse together, for a few waves).
// Left alone until the break ends, the event passes by.

import type { TextKey } from '../i18n';
import { RELIC_IDS, type RelicId } from './relics';

export type EventId = 'scout' | 'peddler' | 'shrine';
export type BlessingId = 'might' | 'swift' | 'fortune';
export type CurseId = 'restless' | 'brittle' | 'dim';

export const EVENTS: Record<EventId, { name: TextKey; take: TextKey; leave: TextKey }> = {
  scout: { name: 'scoutName', take: 'scoutTake', leave: 'scoutLeave' },
  peddler: { name: 'peddlerName', take: 'peddlerTake', leave: 'passBy' },
  shrine: { name: 'shrineName', take: 'shrineTake', leave: 'passBy' },
};
export const EVENT_IDS = Object.keys(EVENTS) as EventId[];

export const BLESSINGS: Record<BlessingId, { name: TextKey; text: TextKey }> = {
  might: { name: 'mightName', text: 'mightText' },
  swift: { name: 'swiftBlessName', text: 'swiftBlessText' },
  fortune: { name: 'fortuneName', text: 'fortuneText' },
};
export const BLESSING_IDS = Object.keys(BLESSINGS) as BlessingId[];

export const CURSES: Record<CurseId, { name: TextKey; text: TextKey }> = {
  restless: { name: 'restlessName', text: 'restlessText' },
  brittle: { name: 'brittleName', text: 'brittleText' },
  dim: { name: 'dimName', text: 'dimText' },
};
export const CURSE_IDS = Object.keys(CURSES) as CurseId[];

/** Events come in the breaks that would name an omen, from this wave's break on. */
export const EVENT_FROM_WAVE = 6;
/** The chance such a break brings an event instead of an omen. */
export const EVENT_CHANCE = 0.35;
/** Sent on, the scout's word takes this share off the next wave's foes' health. */
export const SCOUT_WEAKEN = 0.85;
/** Tended, with every slot full and every guard trained, the scout leaves these coins instead. */
export const SCOUT_COINS = 30;
/** The peddler only stops for a hero with at least these coins; the relic costs half of them. */
export const PEDDLER_MIN = 20;
/** A shrine's blessing and curse last this many waves, the coming one included. */
export const SHRINE_WAVES = 5;
/** Might: damage times this. Swift Hands: shots come this many times as often. Fortune: coins times this. */
export const MIGHT = 1.25;
export const SWIFT = 1.2;
export const FORTUNE = 1.4;
/** Restless: foes walk and hack this many times as fast. Brittle: the barricade takes this many times the damage. Dim: experience times this. */
export const RESTLESS = 1.15;
export const BRITTLE = 1.3;
export const DIM = 0.75;

/** An event named for a break: the peddler's relic and the shrine's pair are rolled with it, so they are shown before the choice. */
export interface WaysideEvent {
  id: EventId;
  relic: RelicId;
  blessing: BlessingId;
  curse: CurseId;
}

/** A shrine's blessing and curse while they last. */
export interface Shrine {
  blessing: BlessingId;
  curse: CurseId;
  /** Waves left, the current one included. */
  waves: number;
}

/** Whether the break before `wave` can bring an event (it is one that would name an omen). */
export const eventWave = (wave: number) => wave >= EVENT_FROM_WAVE;

/** Rolls whether this break brings an event and which, from a random source: one draw, then three more for an event. */
export function rollEvent(rand: () => number): WaysideEvent | null {
  const r = rand();
  if (r >= EVENT_CHANCE) return null;
  const pick = <T>(list: readonly T[]) => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];
  const id = EVENT_IDS[Math.min(EVENT_IDS.length - 1, Math.floor((r / EVENT_CHANCE) * EVENT_IDS.length))];
  return { id, relic: pick(RELIC_IDS), blessing: pick(BLESSING_IDS), curse: pick(CURSE_IDS) };
}

/** What a shrine's blessing and curse change while they last; none changes nothing. */
export function shrineEffects(shrine: Shrine | null) {
  const b = shrine?.blessing;
  const c = shrine?.curse;
  return {
    damage: b === 'might' ? MIGHT : 1,
    shots: b === 'swift' ? SWIFT : 1,
    coins: b === 'fortune' ? FORTUNE : 1,
    pace: c === 'restless' ? RESTLESS : 1,
    hack: c === 'brittle' ? BRITTLE : 1,
    xp: c === 'dim' ? DIM : 1,
  };
}

/** The peddler's price: half the coins, rounded down. */
export const peddlerPrice = (coins: number) => Math.floor(coins / 2);
