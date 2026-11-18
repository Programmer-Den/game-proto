import { seeded, type Rand } from '../../../../shared/daily';

/**
 * The windows to restore: 5 chapels of 6 windows, the last of each a turning rose window. A window's
 * panes are made from its number by a seeded pattern, so the same window is always the same.
 * Everything here is in field pixels: the field is `FIELD_W` wide, with (0, 0) at its top left.
 */

export const FIELD_W = 768;
export const COLS = 12;
export const CELL_W = FIELD_W / COLS;
export const CELL_H = 28;
export const PANE_W = CELL_W - 4;
export const PANE_H = CELL_H - 4;
/** The top of the first row of panes. */
export const ROWS_TOP = 40;

export const CHAPELS = 5;
export const WINDOWS_PER_CHAPEL = 6;
export const WINDOWS = CHAPELS * WINDOWS_PER_CHAPEL;

/** The chapels' ids, in the order the map walks them; their names are texts (`chapel-<id>`). */
export const CHAPEL_IDS = ['dawn', 'sea', 'forest', 'moon', 'sun'] as const;
export type ChapelId = (typeof CHAPEL_IDS)[number];

export type PaneKind = 'glass' | 'thick' | 'lead' | 'bead' | 'heart' | 'mirror' | 'prism' | 'bell' | 'gargoyle' | 'owl';
/** The rose windows' guardians: the heart takes no harm while one stands. */
export const GUARDIANS = new Set<PaneKind>(['gargoyle', 'owl']);

export interface PaneSpec {
  /** Top left, in field pixels, before any sliding or turning. */
  x: number;
  y: number;
  w: number;
  h: number;
  kind: PaneKind;
  /** An index into the pane colours (`PANE_COLOURS` in `scenes/art.ts`). */
  colour: number;
  /** A row that slides from side to side: how far each way, and how fast (radians a second). */
  slide?: { reach: number; speed: number };
  /** A pane of a rose window, turning round `centre` at `radius`. */
  orbit?: { cx: number; cy: number; radius: number; angle: number; speed: number };
}

export interface WindowSpec {
  /** 0 to 29, -1 for the daily window, or 30 and on for the endless clerestory. */
  index: number;
  chapel: number;
  rose: boolean;
  panes: PaneSpec[];
  /** Times the base orb speed. */
  speed: number;
  /** The feat that pays a seal (none for the daily and the clerestory). */
  feat: FeatId | null;
}

/**
 * Each window's feat, which pays a seal once: break the rose's heart in one chain, catch no beads,
 * a chain of `featChain` panes, or restore it in under `QUICK_SECONDS`.
 */
export type FeatId = 'heart' | 'noBeads' | 'chain' | 'quick';
export const QUICK_SECONDS = 60;
export const featChain = (index: number) => 6 + chapelOf(index);
export function featOf(index: number): FeatId | null {
  if (index < 0 || index >= WINDOWS) return null;
  if (isRose(index)) return 'heart';
  return (['quick', 'noBeads', 'chain'] as const)[index % 3];
}

export const chapelOf = (index: number) => Math.floor(index / WINDOWS_PER_CHAPEL);
export const isRose = (index: number) => index % WINDOWS_PER_CHAPEL === WINDOWS_PER_CHAPEL - 1;

/** Which cells of a grid a pattern fills: `(col, row, rows) => filled`. */
type Pattern = (c: number, r: number, rows: number) => boolean;

const PATTERNS: Pattern[] = [
  // Full rows.
  () => true,
  // A pointed arch: the top rows narrow to a point.
  (c, r) => Math.abs(c - 5.5) <= 1.5 + r * 1.2,
  // A diamond.
  (c, r, rows) => Math.abs(c - 5.5) + Math.abs(r - (rows - 1) / 2) * 1.6 <= 5.6,
  // A chequer board.
  (c, r) => (c + r) % 2 === 0,
  // Pillars, two wide.
  (c) => c % 4 !== 2 && c % 4 !== 3,
  // A frame round an empty middle.
  (c, r, rows) => c <= 1 || c >= 10 || r === 0 || r === rows - 1 || (r % 2 === 1 && c >= 4 && c <= 7),
  // A chevron pointing down.
  (c, r) => Math.abs(Math.abs(c - 5.5) - r * 1.1) < 1.7,
  // Stripes, every other row.
  (_c, r) => r % 2 === 0,
  // Two lancets side by side.
  (c, r) => (c >= 1 && c <= 4 && r >= Math.abs(c - 2.5) - 0.5) || (c >= 7 && c <= 10 && r >= Math.abs(c - 8.5) - 0.5),
];

/** The first window: a small, plain block of 24 panes, so a first round is short. */
function firstWindow(): PaneSpec[] {
  const panes: PaneSpec[] = [];
  for (let r = 0; r < 3; r++)
    for (let c = 2; c < 10; c++) panes.push(cell(c, r + 1, 'glass', (c + r) % 4));
  return panes;
}

function cell(c: number, r: number, kind: PaneKind, colour: number): PaneSpec {
  return { x: c * CELL_W + 2, y: ROWS_TOP + r * CELL_H + 2, w: PANE_W, h: PANE_H, kind, colour };
}

/** How hard a window is, 0 for the first and rising by about 1 a chapel. */
const stage = (index: number) => index / WINDOWS_PER_CHAPEL;

/** A window's panes, from its number (0 to 29); the daily passes its own `rand` and a chapel. */
export function windowSpec(index: number, rand: Rand = seeded(9001 + index * 7919), chapelForDaily = 2): WindowSpec {
  const daily = index < 0;
  const chapel = daily ? chapelForDaily : chapelOf(index);
  const level = daily ? chapel + 0.5 : stage(index);
  const rose = !daily && isRose(index);
  const speed = 1 + chapel * 0.05;
  const feat = featOf(index);
  if (index === 0) return { index, chapel, rose, panes: firstWindow(), speed, feat };
  const panes = rose ? roseWindow(chapel, rand) : gridWindow(index, level, rand, chapel);
  return { index, chapel, rose, panes, speed, feat };
}

/**
 * The `n`th window of the endless clerestory (from 0), which opens once all 30 are restored: the
 * chapels' looks in turn, every 6th a rose window, as hard as the Sun Cathedral and a little
 * faster with each window, up to 1.8 times the base speed.
 */
export function endlessSpec(n: number): WindowSpec {
  const rand = seeded(4241 + n * 6151);
  const chapel = n % CHAPELS;
  const rose = n % WINDOWS_PER_CHAPEL === WINDOWS_PER_CHAPEL - 1;
  const level = Math.min(5, 4 + n * 0.1);
  const speed = Math.min(1.8, 1.2 + n * 0.03);
  const panes = rose ? roseWindow(Math.max(2, chapel), rand, chapel) : gridWindow(WINDOWS + n, level, rand, CHAPELS - 1);
  return { index: WINDOWS + n, chapel, rose, panes, speed, feat: null };
}

/** The chapel each new pane comes in at: mirrors in the Fishers', bells in the Forest, prisms in the Moon. */
const NEW_PANES: { kind: PaneKind; from: number }[] = [
  { kind: 'mirror', from: 1 },
  { kind: 'bell', from: 2 },
  { kind: 'prism', from: 3 },
];

function gridWindow(index: number, level: number, rand: Rand, chapel: number): PaneSpec[] {
  const rows = Math.min(9, 4 + Math.floor(level * 1.2 + rand() * 1.5));
  const pattern = index > 0 && index < 3 ? PATTERNS[index] : PATTERNS[Math.floor(rand() * PATTERNS.length)];
  const thick = 0.06 + level * 0.06;
  const lead = index < 3 && index >= 0 ? 0 : 0.03 + level * 0.015;
  const bead = 0.07;
  const sliding = level >= 2 ? new Set([1, 3, 5].slice(0, Math.floor(level - 1))) : new Set<number>();
  const colourShift = Math.floor(rand() * 4);
  const panes: PaneSpec[] = [];
  for (let r = 0; r < rows; r++) {
    const slides = sliding.has(r);
    for (let c = 0; c < COLS; c++) {
      if (!pattern(c, r, rows)) continue;
      // A sliding row keeps clear of the walls.
      if (slides && (c === 0 || c === COLS - 1)) continue;
      const roll = rand();
      // Lead panes sit only in the upper rows, so they never wall the orb in.
      let kind: PaneKind =
        roll < lead && r < rows - 2 ? 'lead' : roll < lead + thick ? 'thick' : roll < lead + thick + bead ? 'bead' : 'glass';
      // A few of the new panes, each from its own chapel on (a bell only where rows slide).
      const kinds = NEW_PANES.filter((k) => chapel >= k.from && (k.kind !== 'bell' || sliding.size > 0));
      if (kind === 'glass' && kinds.length) {
        const extra = rand();
        if (extra < kinds.length * 0.045) kind = kinds[Math.floor(extra / 0.045)].kind;
      }
      const pane = cell(c, r, kind, (Math.floor(Math.abs(c - 5.5)) + r + colourShift) % 4);
      if (slides) pane.slide = { reach: CELL_W * 0.8, speed: 0.9 + level * 0.15 };
      panes.push(pane);
    }
  }
  return panes;
}

/**
 * The rose window: a ring (two from chapel 3) of panes turning round a heart pane, with shoulders
 * of plain panes, and the chapel's guardians: a gargoyle drifting along the top, a stone owl
 * swaying under the heart (Dawn and the Forest a gargoyle, the Fishers' and the Moon an owl, the
 * Sun Cathedral both). `look` picks the guardians in the clerestory.
 */
function roseWindow(chapel: number, rand: Rand, look = chapel): PaneSpec[] {
  const cx = FIELD_W / 2;
  const cy = ROWS_TOP + 130;
  const panes: PaneSpec[] = [];
  const heart: PaneSpec = { x: cx - 26, y: cy - 16, w: 52, h: 32, kind: 'heart', colour: 4 };
  panes.push(heart);
  const rings = chapel >= 2 ? [{ radius: 78, n: 10, speed: -0.5 - chapel * 0.08 }, { radius: 128, n: 16, speed: 0.35 + chapel * 0.08 }] : [{ radius: 104, n: 14, speed: 0.4 + chapel * 0.1 }];
  rings.forEach((ring, k) => {
    for (let i = 0; i < ring.n; i++) {
      const thick = rand() < 0.15 + chapel * 0.08;
      panes.push({
        x: 0,
        y: 0,
        w: 30,
        h: 22,
        kind: thick ? 'thick' : 'glass',
        colour: (i + k) % 4,
        orbit: { cx, cy, radius: ring.radius, angle: (i / ring.n) * Math.PI * 2, speed: ring.speed },
      });
    }
  });
  // Shoulders of plain panes on each side, so there is always something to break on the way in.
  for (let r = 0; r < 2 + Math.min(2, chapel); r++)
    for (const c of [0, 1, 10, 11]) panes.push(cell(c, r + 5, rand() < 0.2 ? 'bead' : 'glass', (c + r) % 4));
  // From the Forest a bell in each shoulder stops the rings for a while.
  if (chapel >= 2) for (const c of [1, 10]) panes.push(cell(c, 4, 'bell', 0));
  const gargoyle = look % 2 === 0;
  const owl = look % 2 === 1 || look === CHAPELS - 1;
  const guardSpeed = 0.7 + chapel * 0.12;
  if (gargoyle)
    panes.push({ x: cx - 30, y: 6, w: 60, h: 24, kind: 'gargoyle', colour: 0, slide: { reach: FIELD_W / 2 - 50, speed: guardSpeed } });
  if (owl)
    panes.push({ x: cx - 22, y: cy + 24, w: 44, h: 34, kind: 'owl', colour: 0, slide: { reach: 34, speed: guardSpeed * 1.4 } });
  return panes;
}
