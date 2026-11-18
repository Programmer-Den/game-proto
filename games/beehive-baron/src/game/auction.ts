// The honey auction: from `AUCTION_FROM` jars sold, as each season ends a buyer comes to bid on up
// to `AUCTION_JARS` jars of the dearest honey on the shelf. The bid starts at what the jars sell for
// and rises for `BID_RISE_MS`, but the buyer walks off at a time the player can't see (between
// `WALK_MIN` and `WALK_MAX`): accept in time or get nothing.

import type { Kind } from './honey';

export interface Auction {
  /** The buyer's town, by `CITIES` index. */
  city: number;
  kind: Kind;
  jars: number;
  /** What one jar sold for as the buyer came, which the bid multiplies. */
  base: number;
  /** Game time since the buyer came, and when they walk off. */
  ms: number;
  walkMs: number;
}

export const AUCTION_FROM = 10;
export const AUCTION_JARS = 3;
/** The bid per jar runs from `BID_FROM` to `BID_TOP` times the jar's price over `BID_RISE_MS`. */
export const BID_FROM = 1;
export const BID_TOP = 4;
export const BID_RISE_MS = 12_000;
/** The buyer walks off at a time picked between these. */
export const WALK_MIN = 3000;
export const WALK_MAX = 12_000;

/** The bid now, a jar. */
export const bidMult = (a: Auction) => BID_FROM + (BID_TOP - BID_FROM) * Math.min(1, a.ms / BID_RISE_MS);
export const bid = (a: Auction) => Math.round(a.base * bidMult(a));
