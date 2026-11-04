// The tourney (AN18): every few minutes three knights ride in, each wanting a sword within a
// minute, and joust with what the smithy hands them against a field of three riders. The best of
// the smithy's knights places by its lance (tier, gem and Masterwork), and a win hangs a banner in
// the smithy. Banners are kept across charters and unlock blade finishes, each a lasting bonus.
// Names and blurbs are keys of `i18n/en.ts`, shown with `t`.
import type { TextKey } from '../i18n';
import { isGemmed, isMaster, tierOf } from './items';
import { ORDER_TOP, swordOf } from './swords';

/** Tourneys start once the smithy has made a Knight's Blade, and not in the daily forge. */
export const TOURNEY_TIER = 4;
/** When the first tourney comes after that, and how long after one the next comes. */
export const TOURNEY_FIRST_MS = 90_000;
export const TOURNEY_EVERY_MS = 240_000;
/** How many knights ride in, how long each waits for a sword, and their picture (the knight). */
export const KNIGHTS = 3;
export const KNIGHT_MS = 60_000;
export const KNIGHT_LOOK = 0;
/** What the tourney pays the smithy for its best knight's place, 1st to 3rd, as shares of the sword two tiers above the knights' ask. */
export const PURSE = [1, 0.5, 0.25];

/** How hard a sword hits in the joust: four a tier, two for a gem and three for a Masterwork. */
export const lance = (item: number) => tierOf(item) * 4 + (isGemmed(item) ? 2 : 0) + (isMaster(item) ? 3 : 0);
/** The least sword a tourney's knights take: two tiers under the best made, from an Iron Shortsword up. */
export const tourneyTier = (bestTier: number) => Math.min(ORDER_TOP - 2, Math.max(2, bestTier - 2));
/** The three riders of the field: a champion with a sword two tiers up, then one up with a gem, then one up plain. */
export const field = (wants: number) => [(wants + 2) * 4, (wants + 1) * 4 + 2, (wants + 1) * 4];
/** Where a lance places against the field, 1st to 4th; a tie goes to the smithy's knight. */
export const placeOf = (best: number, wants: number) => 1 + field(wants).filter((f) => f > best).length;
/** What a place pays, or 0 for 4th. */
export const purse = (place: number, wants: number) => (place <= PURSE.length ? Math.floor(swordOf(wants + 2).price * PURSE[place - 1]) : 0);

/** The tourney under way, or the wait for the next: not saved. */
export interface Tourney {
  /** Time until the next tourney, while none runs. */
  inMs: number;
  /** Whether one runs: its knights are riding in or at the counter. */
  on: boolean;
  /** Knights still to ride in, as desks free up. */
  riding: number;
  /** The least sword they take. */
  wants: number;
  /** The lance of each sword handed to a knight. */
  entries: number[];
}
export const freshTourney = (): Tourney => ({ inMs: TOURNEY_FIRST_MS, on: false, riding: 0, wants: 2, entries: [] });

/** Blade finishes, unlocked by tourney banners: each a lasting bonus. */
export type Finish = 'blued' | 'etched' | 'gilded';
export interface FinishRule {
  name: TextKey;
  blurb: TextKey;
  banners: number;
}
export const FINISHES: Record<Finish, FinishRule> = {
  // Knights pay half again for their swords.
  blued: { name: 'bluedName', blurb: 'bluedBlurb', banners: 1 },
  // The streak ring's gold Masterwork window lasts half again as long.
  etched: { name: 'etchedName', blurb: 'etchedBlurb', banners: 3 },
  // Every sale pays a tenth more.
  gilded: { name: 'gildedName', blurb: 'gildedBlurb', banners: 6 },
};
export const FINISH_IDS = Object.keys(FINISHES) as Finish[];
export const BLUED_PAY = 1.5;
export const ETCHED_MASTER = 1.5;
export const GILDED_PRICE = 0.1;
/** Whether the smithy's banners have unlocked a finish. */
export const hasFinish = (banners: number, finish: Finish) => banners >= FINISHES[finish].banners;
/** The finishes unlocked so far, and the next one still to win. */
export const finishesOf = (banners: number) => FINISH_IDS.filter((f) => hasFinish(banners, f));
export const nextFinish = (banners: number) => FINISH_IDS.find((f) => !hasFinish(banners, f)) ?? null;
