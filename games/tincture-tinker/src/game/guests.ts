import { byDifficulty } from '../../../../shared/settings';
import type { TextKey } from '../i18n';
import { holesOf } from './board';
import type { GuestRule, Needs, Order, PotionId } from './orders';
import { TOWNS } from './towns';

// Town guests: once a town's own order has a star, a demanding guest waits there, on the town's
// board shape, asking for its rare ingredient under a rule of their own. The witch turns a tile to
// a toad after every move, the knight wants it all in ten moves and the miser pays only for what
// cascades gather. A guest is sold for one to three stars, the best kept, like the town.

export interface Guest {
  rule: GuestRule;
  potion: PotionId;
  /** The town's rare ingredient and one everyday one. */
  needs: Needs;
  moves: number;
  jars: number;
  resin: number;
}

/** Each town's guest, in `TOWNS` order. */
export const GUESTS: Guest[] = [
  { rule: 'knight', potion: 'healingDraught', needs: { fern: 6, sage: 7 }, moves: 10, jars: 0, resin: 0 },
  { rule: 'witch', potion: 'sleepingTonic', needs: { honey: 8, moonpetal: 9 }, moves: 16, jars: 0, resin: 0 },
  { rule: 'miser', potion: 'mandrakeTincture', needs: { pearl: 5, mandrake: 5 }, moves: 20, jars: 1, resin: 0 },
  { rule: 'knight', potion: 'goldenElixir', needs: { thistle: 6, wheat: 6 }, moves: 10, jars: 0, resin: 1 },
  { rule: 'witch', potion: 'amberCordial', needs: { acorn: 9, ember: 10 }, moves: 17, jars: 1, resin: 1 },
  { rule: 'miser', potion: 'moonlitPhilter', needs: { larkspur: 5, mandrake: 6 }, moves: 22, jars: 1, resin: 1 },
  { rule: 'knight', potion: 'starlightElixir', needs: { glowcap: 7, sage: 8 }, moves: 10, jars: 1, resin: 1 },
  { rule: 'witch', potion: 'philosophersDraught', needs: { bramble: 10, ember: 11 }, moves: 18, jars: 2, resin: 2 },
];

/** Each rule's guest, as keys of `i18n/en.ts`: their name, the label's line and the caption. */
export const GUEST_TEXTS: Record<GuestRule, { name: TextKey; line: TextKey; caption: TextKey }> = {
  witch: { name: 'guestWitch', line: 'witchLine', caption: 'captionWitch' },
  knight: { name: 'guestKnight', line: 'knightLine', caption: 'captionKnight' },
  miser: { name: 'guestMiser', line: 'miserLine', caption: 'captionMiser' },
};

/** Coins for every star a guest gives that they hadn't given before. */
export const GUEST_STAR_COINS = 30;
/** The most toads the witch keeps on the board at once. */
export const TOAD_MAX = 6;

/** The seed guest `index`'s board is laid from, so it starts the same on every try. */
export const guestSeed = (index: number) => 7919 * (index + 1) + 31;

/** True when town `index`'s guest is waiting: the town's own order has a star. */
export const guestOpen = (towns: number[], index: number) => (towns[index] ?? 0) > 0;

/**
 * Town `index`'s guest as an order on the town's board shape; Easy gives five more moves, Hard three
 * fewer, except for the knight: ten moves already sit close to the shared three-star mark
 * (`STARS_3` moves left), so Hard keeps them and his third star stays in reach.
 */
export function guestOrder(index: number, number: number): Order {
  const guest = GUESTS[index];
  const town = TOWNS[index];
  return {
    number,
    potion: guest.potion,
    needs: { ...guest.needs },
    moves: Math.max(5, guest.moves + byDifficulty(5, 0, guest.rule === 'knight' ? 0 : -3)),
    price: GUEST_STAR_COINS,
    jars: guest.jars,
    resin: guest.resin,
    mould: 0,
    holes: holesOf(town.shape),
    rare: town.rare,
    guest: { index, rule: guest.rule },
  };
}
