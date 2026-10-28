import type { KindId } from './kinds';

/** The modes, in the order the menu deals them as cards. */
export const MODES = ['endless', 'daily', 'blitz', 'draft', 'duel', 'practice'] as const;
export type Mode = (typeof MODES)[number];

/** The relics a draft run offers after every few puzzles; each can be taken again. */
export const GENERAL_RELICS = ['lantern', 'heartstone', 'hourglass', 'crystal'] as const;

/**
 * One kind relic (a charm) per kind, each taken once: its kind's puzzles come with a free hint
 * (Memory Echo, which has no hints, turns its cards slower instead) and pay `CHARM_POINTS` times
 * the points.
 */
export const CHARMS = {
  nonogram: 'inkwell',
  bridges: 'bridgewright',
  code: 'cipher',
  calc: 'abacus',
  sums: 'tally',
  unjam: 'gear',
  flip: 'mirror',
  link: 'spool',
  echo: 'shell',
} as const satisfies Record<KindId, string>;
export type CharmId = (typeof CHARMS)[KindId];
export const CHARM_KIND = Object.fromEntries(Object.entries(CHARMS).map(([k, c]) => [c, k])) as Record<CharmId, KindId>;

export const RELICS = [...GENERAL_RELICS, ...Object.values(CHARMS)] as const;
export type RelicId = (typeof GENERAL_RELICS)[number] | CharmId;
export const isCharm = (r: RelicId): r is CharmId => r in CHARM_KIND;

/** Each kind's colour on its card and icon. */
export const KIND_COLOR: Record<KindId, number> = {
  nonogram: 0x9be7ff,
  bridges: 0xf2cf73,
  code: 0xff8fc7,
  calc: 0xb9a4ff,
  sums: 0x8fe3b0,
  unjam: 0xffb36b,
  flip: 0x7fb8ff,
  link: 0xe6a4ff,
  echo: 0xfff0a8,
};

export const RELIC_COLOR: Record<RelicId, number> = {
  lantern: 0xf2cf73,
  heartstone: 0xff8fc7,
  hourglass: 0x9be7ff,
  crystal: 0xb9a4ff,
  ...(Object.fromEntries(Object.entries(CHARMS).map(([k, c]) => [c, KIND_COLOR[k as KindId]])) as Record<CharmId, number>),
};

/**
 * Omens a puzzle of Endless or Draft offers before its first move, for `OMEN_POINTS` times the
 * points: half the time, no undo and no hints, or two hearts for a loss.
 */
export const OMENS = ['haste', 'silence', 'peril'] as const;
export type OmenId = (typeof OMENS)[number];
