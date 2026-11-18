// Consort orders: what the player's prizes and consorts do in a fight, set with the fleet button.

import type { TextKey } from '../i18n';

/**
 * `hunt`: go after the nearest enemy near the player (the old way, and the start of every run);
 * `follow`: keep station and fire only at what comes by; `attack`: all go after the player's
 * target (the enemy her last broadside was aimed at, else the nearest); `screen`: keep by the
 * convoy and go after any enemy that comes near her (only while a convoy sails).
 */
export type FleetOrder = 'hunt' | 'follow' | 'attack' | 'screen';
export const FLEET_ORDERS: FleetOrder[] = ['hunt', 'follow', 'attack', 'screen'];
/** Each order's name, a key of `i18n/en.ts`. */
export const FLEET_NAMES: Record<FleetOrder, TextKey> = { hunt: 'fleetHunt', follow: 'fleetFollow', attack: 'fleetAttack', screen: 'fleetScreen' };
/** Screening, the prizes go after enemies this close to the convoy. */
export const SCREEN_R = 260;

/** The order after `order`, skipping `screen` without a convoy at sea. */
export function nextFleetOrder(order: FleetOrder, convoy: boolean): FleetOrder {
  const i = FLEET_ORDERS.indexOf(order);
  for (let k = 1; k <= FLEET_ORDERS.length; k++) {
    const next = FLEET_ORDERS[(i + k) % FLEET_ORDERS.length];
    if (next !== 'screen' || convoy) return next;
  }
  return 'hunt';
}
