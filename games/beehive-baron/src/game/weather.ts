// Weather spells: from `WEATHER_FROM` jars sold every day of the year (`DAY_MS`, four a season) has
// its weather, drawn as it comes into the forecast `FORECAST - 1` days ahead. A rainy day keeps the
// foragers home (the bees out finish their trip), a warm day doubles the nectar each bee brings, and
// winter's days are frost, when the bees stay in anyway.

import { SEASONS, SEASON_MS, YEAR_MS, type Season } from './seasons';

export type Weather = 'fair' | 'rain' | 'warm' | 'frost';
export const WEATHERS: Weather[] = ['fair', 'rain', 'warm', 'frost'];
/** A day's length; a season is four days. */
export const DAY_MS = 30_000;
export const DAYS = YEAR_MS / DAY_MS;
/** How many days the forecast shows: today and the three after it. */
export const FORECAST = 4;
/** Weather comes once this many jars are sold (the Lavender Field's goal), well after the first round. */
export const WEATHER_FROM = 10;
/** A warm day multiplies the nectar each bee brings home by this. */
export const WARM_NECTAR = 2;
/** The chance of a rainy and of a warm day, by season (winter is always frost). */
export const CHANCES: Record<Exclude<Season, 'winter'>, { rain: number; warm: number }> = {
  spring: { rain: 0.3, warm: 0.1 },
  summer: { rain: 0.1, warm: 0.35 },
  autumn: { rain: 0.35, warm: 0.1 },
};

/** The day of the year (0 to `DAYS - 1`) a game time into the year falls on. */
export const dayOf = (seasonMs: number) => Math.floor(seasonMs / DAY_MS);
/** The season a day of the year (any whole number, wrapping round the year) is in. */
export const daySeason = (day: number): Season => SEASONS[Math.floor(((((day % DAYS) + DAYS) % DAYS) * DAY_MS) / SEASON_MS)];
/** A day's weather before weather comes: fair, and frost in winter. */
export const calm = (day: number): Weather => (daySeason(day) === 'winter' ? 'frost' : 'fair');
/** A day's weather drawn by chance for its season. */
export function draw(day: number, roll: number): Weather {
  const season = daySeason(day);
  if (season === 'winter') return 'frost';
  const c = CHANCES[season];
  return roll < c.rain ? 'rain' : roll < c.rain + c.warm ? 'warm' : 'fair';
}
/** The calm forecast from a day on, before weather comes. */
export const calmForecast = (day: number) => [...Array(FORECAST).keys()].map((i) => calm(day + i));
