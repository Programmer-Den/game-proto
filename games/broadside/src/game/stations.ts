// Crew stations: the player splits the hands between the guns, the sails and the pumps, in
// sixths, mid-wave. An even split (two sixths each) sails exactly as the ship always has.

import type { TextKey } from '../i18n';

export type Station = 'guns' | 'sails' | 'pumps';
export const STATION_IDS: Station[] = ['guns', 'sails', 'pumps'];
/** Each station's name on its button, a key of `i18n/en.ts`. */
export const STATION_NAMES: Record<Station, TextKey> = { guns: 'stationGuns', sails: 'stationSails', pumps: 'stationPumps' };
/** The crew split into this many shares, each station holding between `MIN_HANDS` and `MAX_HANDS`. */
export const HANDS = 6;
export const EVEN_HANDS = 2;
export const MIN_HANDS = 1;
export const MAX_HANDS = 4;
export type Stations = Record<Station, number>;
export const evenStations = (): Stations => ({ guns: EVEN_HANDS, sails: EVEN_HANDS, pumps: EVEN_HANDS });

/**
 * How much more than an even share a station holds: -0.5 at one share, 0 at two (even), 0.5 at
 * three and 1 at four.
 */
export const lift = (hands: number) => hands / EVEN_HANDS - 1;
/** Each extra share on the guns quickens the reload by this much (and one taken off slows it). */
export const GUNS_PACE = 0.3;
/** Each extra share on the sails quickens the turn by this much (and one taken off slows it). */
export const SAILS_TURN = 0.3;
/** Hull the pumps mend a second with two extra shares on them (half with one), while fighting. */
export const PUMP_HP = 0.8;

/**
 * A station's multiplier on its stat (`k` per share above even). The gain from extra hands shrinks
 * with the crew lost (`crewShare`, sailors aboard of a full crew), so losses hurt where the hands
 * stand; a station left short is short whatever the crew.
 */
export function stationFactor(hands: number, crewShare: number, k: number) {
  const d = lift(hands);
  return 1 + k * d * (d > 0 ? crewShare : 1);
}

/** Hull the pumps mend a second with `hands` on them. */
export const pumpRate = (hands: number, crewShare: number) => PUMP_HP * Math.max(0, lift(hands)) * crewShare;

/**
 * Moves a share of the crew to `to`, taken from the other station holding the most (the later one
 * of a tie). Returns the new split, or null when `to` already holds `MAX_HANDS`.
 */
export function manStation(stations: Stations, to: Station): Stations | null {
  if (stations[to] >= MAX_HANDS) return null;
  const from = STATION_IDS.filter((id) => id !== to && stations[id] > MIN_HANDS).reduce<Station | null>((best, id) => (!best || stations[id] >= stations[best] ? id : best), null);
  if (!from) return null;
  return { ...stations, [to]: stations[to] + 1, [from]: stations[from] - 1 };
}
