// Weather by wave: from wave 5 a wave may come on in rain, wind or fog, named a wave ahead (the
// chip over the ranger says what the next wave brings while this one is fought). Each changes the
// fight a little, with a catch and a small gain; clear weather changes nothing.

import type { TextKey } from '../i18n';

export type WeatherId = 'rain' | 'wind' | 'fog';

export const WEATHERS: Record<WeatherId, { name: TextKey; text: TextKey }> = {
  rain: { name: 'weatherRainName', text: 'weatherRainText' },
  wind: { name: 'weatherWindName', text: 'weatherWindText' },
  fog: { name: 'weatherFogName', text: 'weatherFogText' },
};

export const WEATHER_IDS = Object.keys(WEATHERS) as WeatherId[];

/** The first wave that can have weather. */
export const WEATHER_FROM_WAVE = 5;
/** The chance a wave from WEATHER_FROM_WAVE on has weather at all. */
export const WEATHER_CHANCE = 0.5;
/** Rain: burning lasts this share as long. */
export const RAIN_BURN = 0.5;
/** Rain: the mud slows every foe on foot to this share of its pace. */
export const RAIN_MUD = 0.9;
/** Wind: arrows, bolts and fireballs fly at this share of their speed. */
export const WIND_SHOTS = 0.75;
/** Wind: Arrow Rain lands this far back towards the barricade from where it was aimed, on a wider ring. */
export const WIND_DRIFT = 45;
export const WIND_RING = 1.25;
/** Fog: foes right of this line are hidden and cannot be aimed at. */
export const FOG_X = 720;
/** Fog: every kill pays this many times the coins (the fallen drop their purses in the murk). */
export const FOG_COINS = 1.25;

/**
 * The weather of a wave that can have it, from one draw of a random source: clear weather below
 * WEATHER_CHANCE's complement, else one of WEATHER_IDS.
 */
export function rollWeather(wave: number, rand: () => number): WeatherId | null {
  if (wave < WEATHER_FROM_WAVE) return null;
  const r = rand();
  return r < WEATHER_CHANCE ? WEATHER_IDS[Math.min(WEATHER_IDS.length - 1, Math.floor((r / WEATHER_CHANCE) * WEATHER_IDS.length))] : null;
}

/** What the weather changes; clear weather (null) changes nothing. */
export function weatherEffects(id: WeatherId | null) {
  return {
    burn: id === 'rain' ? RAIN_BURN : 1,
    mud: id === 'rain' ? RAIN_MUD : 1,
    shots: id === 'wind' ? WIND_SHOTS : 1,
    drift: id === 'wind' ? WIND_DRIFT : 0,
    ring: id === 'wind' ? WIND_RING : 1,
    sight: id === 'fog' ? FOG_X : Infinity,
    coins: id === 'fog' ? FOG_COINS : 1,
  };
}
