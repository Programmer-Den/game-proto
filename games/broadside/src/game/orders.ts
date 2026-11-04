// The captain's orders: one bonus for a whole wave, named on a card under the top bar.

import { random } from './random';
import type { TextKey } from '../i18n';
import type { ShotKind } from './shot';

export type OrderId = 'chain' | 'grape' | 'powder' | 'wind' | 'crew';

export interface Order {
  /** Keys of `i18n/en.ts`. */
  title: TextKey;
  desc: TextKey;
  /** Multipliers on the player's stats while the order stands. */
  damage?: number;
  range?: number;
  reload?: number;
  sails?: number;
  /** Loads both sides with this shot for the wave, whatever was loaded at the harbor. */
  load?: ShotKind;
  /** Double powder: round shot shows a powder flash. */
  powder?: boolean;
}

export const ORDERS: Record<OrderId, Order> = {
  chain: { title: 'chainOrder', desc: 'chainOrderDesc', load: 'chain' },
  grape: { title: 'grapeOrder', desc: 'grapeOrderDesc', load: 'grape' },
  powder: { title: 'powderOrder', desc: 'powderOrderDesc', range: 1.3, damage: 1.3, powder: true },
  wind: { title: 'windOrder', desc: 'windOrderDesc', sails: 1.25 },
  crew: { title: 'crewOrder', desc: 'crewOrderDesc', reload: 0.7 },
};

export const ORDER_IDS = Object.keys(ORDERS) as OrderId[];

/** A new order for the next wave, never the same as the last one. Uses random() once. */
export function drawOrder(last: OrderId): OrderId {
  const choices = ORDER_IDS.filter((id) => id !== last);
  return choices[Math.floor(random() * choices.length)];
}
