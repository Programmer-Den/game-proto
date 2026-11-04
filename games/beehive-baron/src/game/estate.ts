// The apiary estate: once the fair's first gold is won, a baron with two hives can buy plots for a
// third and a fourth, each in a meadow region of its own with its own season quirks. Every hive has
// its own comb; they share the market, the jars and the coins.

import type { TextKey } from '../i18n';

/** The plots the estate can buy, in order: the first is the third hive, the second the fourth. */
export type PlotId = 'orchard' | 'riverside';
export interface Plot {
  id: PlotId;
  /** Its name's text and its season quirks' text (`i18n/en.ts`). */
  name: TextKey;
  quirk: TextKey;
  price: number;
}
export const PLOTS: Plot[] = [
  { id: 'orchard', name: 'orchardHollow', quirk: 'orchardQuirk', price: 500 },
  { id: 'riverside', name: 'riversideMeadow', quirk: 'riversideQuirk', price: 900 },
];
/** The first hive a plot holds (the first two are the home hive and the caught swarm's), and the most hives an estate keeps. */
export const FIRST_PLOT = 2;
export const ESTATE_HIVES = FIRST_PLOT + PLOTS.length;
/** The plot a hive stands on, or null for the home hive and the swarm's. */
export const plotOf = (hive: number): Plot | null => PLOTS[hive - FIRST_PLOT] ?? null;
/** A new plot comes with this many bees of its own. */
export const PLOT_BEES = 2;

/** Orchard Hollow: its bees bring this much more nectar a trip in spring, and eat this many times as much in winter. */
export const ORCHARD_SPRING_NECTAR = 2;
export const ORCHARD_WINTER_APPETITE = 2;
/** Riverside Meadow: its honey ripens this many times as fast in summer, and its bees eat this share in winter. */
export const RIVERSIDE_SUMMER_RIPEN = 2;
export const RIVERSIDE_WINTER_APPETITE = 0.5;
