import type { TextKey } from '../i18n';
import { SPECIALS, seeded, type Building, type Special } from './tiles';

// Royal gifts: reaching a round's goal offers a choice of two, shown in the panel all round long.
// The windmill, the market, the harbor, the lumber camp and the temple are won this way: each is a new tile.

export const GIFTS = ['towers', 'houses', 'farms', 'windmill', 'windmills', 'market', 'markets', 'harbor', 'harbors', 'lumber', 'lumbers', 'temple', 'temples'] as const;
export type Gift = (typeof GIFTS)[number];

export interface GiftInfo {
  /** The short label on the panel's chip and the choice button, a key of `i18n/en.ts`. */
  label: TextKey;
  /** The building drawn on its chip. */
  icon: Building;
  /** One line on the choice button, a key of `i18n/en.ts`. */
  desc: TextKey;
  /** Tiles it adds to the pouch. */
  tiles: Partial<Record<Building, number>>;
}

export const GIFT_INFO: Record<Gift, GiftInfo> = {
  towers: { label: 'towersGift', icon: 'tower', desc: 'towersDesc', tiles: { tower: 2 } },
  houses: { label: 'housesGift', icon: 'house', desc: 'housesDesc', tiles: { house: 3 } },
  farms: { label: 'farmsGift', icon: 'farm', desc: 'farmsDesc', tiles: { farm: 3 } },
  windmill: { label: 'windmillGift', icon: 'windmill', desc: 'windmillDesc', tiles: { windmill: 2 } },
  windmills: { label: 'windmillsGift', icon: 'windmill', desc: 'windmillsDesc', tiles: { windmill: 2 } },
  market: { label: 'marketGift', icon: 'market', desc: 'marketDesc', tiles: { market: 2 } },
  markets: { label: 'marketsGift', icon: 'market', desc: 'marketsDesc', tiles: { market: 2 } },
  harbor: { label: 'harborGift', icon: 'harbor', desc: 'harborDesc', tiles: { harbor: 2 } },
  harbors: { label: 'harborsGift', icon: 'harbor', desc: 'harborsDesc', tiles: { harbor: 2 } },
  lumber: { label: 'lumberGift', icon: 'lumber', desc: 'lumberDesc', tiles: { lumber: 2 } },
  lumbers: { label: 'lumbersGift', icon: 'lumber', desc: 'lumbersDesc', tiles: { lumber: 2 } },
  temple: { label: 'templeGift', icon: 'temple', desc: 'templeDesc', tiles: { temple: 2 } },
  temples: { label: 'templesGift', icon: 'temple', desc: 'templesDesc', tiles: { temple: 2 } },
};

/** The gift that first brings each special building, and the one that brings more of it. */
const NEW: Record<Special, Gift> = { windmill: 'windmill', market: 'market', harbor: 'harbor', lumber: 'lumber', temple: 'temple' };
const MORE: Record<Special, Gift> = { windmill: 'windmills', market: 'markets', harbor: 'harbors', lumber: 'lumbers', temple: 'temples' };

/**
 * The two gifts offered for reaching round `round`'s goal on island `island`, with `unlocked` the
 * special buildings already won. Round 1 always offers +2 Towers or the Windmill. Later rounds
 * offer one special not yet won (in the order of SPECIALS) beside a plain tile pack, until all
 * are won; then two of the tile packs and more of the specials. Seeded by island and round, so a
 * kingdom's gifts never touch Math.random.
 */
export function giftsFor(island: number, round: number, unlocked: readonly Special[]): [Gift, Gift] {
  if (round === 1 && unlocked.length === 0) return ['towers', 'windmill'];
  const rand = seeded(island * 7919 + round * 104729);
  const pick = <T>(list: T[]) => list.splice(Math.floor(rand() * list.length), 1)[0];
  const plain: Gift[] = ['towers', 'houses', 'farms'];
  const next = SPECIALS.find((b) => !unlocked.includes(b));
  if (next) return [pick(plain), NEW[next]];
  const pool: Gift[] = [...plain, ...SPECIALS.map((b) => MORE[b])];
  return [pick(pool), pick(pool)];
}

/** The special building a gift brings for the first time, if it is one of those. */
export const newSpecial = (gift: Gift) => SPECIALS.find((b) => NEW[b] === gift) ?? null;
