// The endless siege: after lifting the siege (wave 30) the hero can hold on past it as long as the
// barricade lasts. From then on every wave grows stronger than the normal climb: its foes have more
// health and come on as elites more often. Each map keeps its own best endless wave.

import { WIN_WAVE } from './heat';

/** Every endless wave's foes have this many times the health of the one before, on top of the usual climb. */
export const ENDLESS_GROWTH = 1.06;
/** Every endless wave adds this to the chance a foe comes on as an elite. */
export const ENDLESS_ELITES = 0.015;

/** How many waves past the siege `wave` is (0 up to wave 30). */
export const endlessWaves = (wave: number) => Math.max(0, wave - WIN_WAVE);

/** What the endless siege adds on `wave` of an endless run: foe health and elite chance. Nothing outside one. */
export function endlessRules(endless: boolean, wave: number) {
  const n = endless ? endlessWaves(wave) : 0;
  return { hp: ENDLESS_GROWTH ** n, elites: ENDLESS_ELITES * n };
}
