// The weekly road: one seeded run for the whole week, the same for every player, that starts with
// two set boons drawn from the week's seed. It is run bare otherwise (no armoury, bought boon or
// companion), as often as you like, and keeps its own best distance for the week.
import { BOONS, BOON_IDS, type BoonId } from './boons';
import { rand, seedOf } from './state';

/** The week of a date as `YYYY-Www` (ISO 8601 weeks, from Monday), in the player's own time zone. */
export function weekOf(now = new Date()) {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  // Thursday of this week decides the year.
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day + 3);
  const year = d.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** The weekly road's seed key: its week, tagged so it never matches a daily course's date. */
export const weeklyKey = (week: string) => `weekly:${week}`;

/** The two boons the week's road starts with: two different ones that can be sold (no Field Dressing, no curse). */
export function weeklyBoons(week: string): BoonId[] {
  const s = { daily: weeklyKey(week), seed: seedOf(`${weeklyKey(week)}:boons`) };
  const pool = BOON_IDS.filter((id) => !BOONS[id].filler && !BOONS[id].cursed);
  const picks: BoonId[] = [];
  while (picks.length < 2) picks.push(pool.splice(Math.floor(rand(s) * pool.length), 1)[0]);
  return picks;
}
