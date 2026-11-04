// The candle workshop: from `WORKSHOP_FROM` jars sold, spare wax is dipped into candles or mixed
// into polish, a second line of goods that only the church and the manor buy. Each season both
// write a commission for a few of them at a price set by what honey is worth; the church pays more
// for candles in winter.

export type Ware = 'candle' | 'polish';
export const WARES: Ware[] = ['candle', 'polish'];
/** What a ware takes and fetches; the church buys candles, the manor polish. */
export interface WareDef {
  /** The wax one takes to make. */
  wax: number;
  /** One sells for this many times a clover jar's worth before the market's demand. */
  mult: number;
  /** How many a commission asks for: the least and the most. */
  count: [number, number];
}
export const WARE: Record<Ware, WareDef> = {
  candle: { wax: 2, mult: 0.9, count: [3, 6] },
  polish: { wax: 3, mult: 1.5, count: [2, 4] },
};
/** The workshop opens once this many jars are sold, well after the first round. */
export const WORKSHOP_FROM = 50;
/** The church pays this many times as much for candles in winter. */
export const WINTER_CANDLES = 1.5;

/** A patron's commission for the season. */
export interface Commission {
  ware: Ware;
  count: number;
  /** Coins paid for each. */
  price: number;
  done: boolean;
}

export const noWares = (): Record<Ware, number> => ({ candle: 0, polish: 0 });
