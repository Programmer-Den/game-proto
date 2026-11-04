// The weekly league: one seeded Draft Run for every player all week, played as often as they like,
// with the week's best score and the rank band it reaches. No Phaser.

/** The week's number (weeks start on Monday, local time), its seed. */
export function weekOf(date = new Date()) {
  const days = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
  // 1 January 1970 was a Thursday: shifting by 3 starts each week on a Monday.
  return Math.floor((days + 3) / 7);
}

/** The rank bands, from the lowest, and the score each starts at. */
export const RANKS = ['novice', 'adept', 'mystic', 'oracle', 'seer'] as const;
export type Rank = (typeof RANKS)[number];
export const RANK_AT = [0, 1000, 3000, 6000, 10000] as const;

export function rankOf(score: number): Rank {
  let r = 0;
  RANK_AT.forEach((at, i) => score >= at && (r = i));
  return RANKS[r];
}

/** The score the next band starts at, or null at the top. */
export function nextRankAt(score: number) {
  return RANK_AT.find((at) => at > score) ?? null;
}
