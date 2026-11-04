import type { TextKey } from '../i18n';
import type { PotionId } from './items';
import type { GoodId } from './town';

// The town's households, by district: the reason to open shops. Each district's homes ask for
// goods every supply round and take them from the shelves of the shop that sells them (potions
// from the apothecary's), paying into its till. A district supplied well grows a home each few
// rounds, and once full its cottages grow into houses, which ask for more kinds of goods; one left
// short loses homes again. Each district opens once the one before has grown into houses. No
// randomness: who asks for what follows the round. Phaser-free; the rules are in `townSim.ts`.

/** What a household asks for: a town shop's good or one of the apothecary's potions. */
export type Need = GoodId | PotionId;

export type DistrictId = 'marketRow' | 'riverside' | 'hilltop';

export const DISTRICTS: { id: DistrictId; name: TextKey }[] = [
  { id: 'marketRow', name: 'marketRow' },
  { id: 'riverside', name: 'riverside' },
  { id: 'hilltop', name: 'hilltop' },
];

/** The homes a district grows into, from cottages; each asks for what the one before did and more. */
export const HOME_TIERS: { name: TextKey; needs: Need[] }[] = [
  { name: 'cottageCount', needs: ['bread', 'healingDraught'] },
  { name: 'houseCount', needs: ['bread', 'healingDraught', 'honeyCake', 'sleepingTonic'] },
  { name: 'manorCount', needs: ['bread', 'healingDraught', 'honeyCake', 'sleepingTonic', 'candle', 'taper'] },
  { name: 'mansionCount', needs: ['bread', 'healingDraught', 'honeyCake', 'sleepingTonic', 'candle', 'taper', 'cloth', 'cloak'] },
  { name: 'palaceCount', needs: ['bread', 'healingDraught', 'honeyCake', 'sleepingTonic', 'candle', 'taper', 'cloth', 'cloak', 'horseshoe', 'pot'] },
  { name: 'castleCount', needs: ['bread', 'healingDraught', 'honeyCake', 'sleepingTonic', 'candle', 'taper', 'cloth', 'cloak', 'horseshoe', 'pot', 'ale', 'stout'] },
];

/** Homes a district starts with when it opens, and the most it holds. */
export const START_HOMES = 3;
export const MAX_HOMES = 8;
/** Milliseconds between supply rounds: each home asks for one good a round. */
export const SUPPLY_MS = 30_000;
/** How far happiness moves towards a round's share supplied (0 to 100). */
export const HAPPY_PULL = 0.5;
/** A round ending at least this happy counts towards a new home; at most `UNHAPPY` towards losing one. */
export const HAPPY = 80;
export const UNHAPPY = 30;
/** Rounds in a row it takes to gain or lose a home (or grow into the next tier). */
export const GROW_ROUNDS = 4;

export interface DistrictState {
  open: boolean;
  homes: number;
  /** The `HOME_TIERS` index its homes have grown to. */
  tier: number;
  /** 0 to 100. */
  happiness: number;
  /** Good rounds in a row (above 0) or bad ones (below 0). */
  growth: number;
  /** Milliseconds to the next supply round. */
  next: number;
  /** Supply rounds so far, which picks what each home asks for. */
  rounds: number;
  /** What its homes asked for last round and couldn't get. */
  short: Need[];
}

export const createDistrict = (open: boolean): DistrictState => ({
  open,
  homes: START_HOMES,
  tier: 0,
  happiness: 50,
  growth: 0,
  next: SUPPLY_MS,
  rounds: 0,
  short: [],
});

export const createDistricts = (): DistrictState[] => DISTRICTS.map((_, i) => createDistrict(i === 0));

/** What a district's homes ask for this round, one need each, taking turns through their tier's list. */
export function districtAsks(district: DistrictState): Need[] {
  const needs = HOME_TIERS[district.tier].needs;
  return Array.from({ length: district.homes }, (_, h) => needs[(district.rounds + h) % needs.length]);
}

/** Whether a district has grown as far as it can: every home built at the last tier. */
export const districtFull = (d: DistrictState) => d.homes >= MAX_HOMES && d.tier >= HOME_TIERS.length - 1;

/**
 * The towns down the road (AP15): once a town is a city, the next is founded with fresh districts.
 * The first town has no name of its own; later ones go round `NEXT_TOWNS`. Each later town's homes
 * pay `CITY_PAY` more per city made, and take one more happy round per city to grow (up to three).
 */
export const NEXT_TOWNS: TextKey[] = ['marshgate', 'highcrag', 'saltmere'];
export const CITY_PAY = 0.25;
export const townName = (cities: number): TextKey | null => (cities === 0 ? null : NEXT_TOWNS[(cities - 1) % NEXT_TOWNS.length]);
export const cityPay = (cities: number) => 1 + CITY_PAY * cities;
export const growRounds = (cities: number) => GROW_ROUNDS + Math.min(3, cities);

/** The town's second ending: every district grown as far as it can, and the town is a city. */
export const townIsCity = (districts: DistrictState[]) => districts.every(districtFull);
