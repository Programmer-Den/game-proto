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

export type PaneKind = 'glass' | 'thick' | 'lead' | 'bead' | 'heart';

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
  /** 0 to 29, or -1 for the daily window. */
  index: number;
  chapel: number;
  rose: boolean;
  panes: PaneSpec[];
  /** Times the base orb speed. */
  speed: number;
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
  if (index === 0) return { index, chapel, rose, panes: firstWindow(), speed };
  const panes = rose ? roseWindow(chapel, rand) : gridWindow(index, level, rand);
  return { index, chapel, rose, panes, speed };
}

function gridWindow(index: number, level: number, rand: Rand): PaneSpec[] {
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
      const kind: PaneKind =
        roll < lead && r < rows - 2 ? 'lead' : roll < lead + thick ? 'thick' : roll < lead + thick + bead ? 'bead' : 'glass';
      const pane = cell(c, r, kind, (Math.floor(Math.abs(c - 5.5)) + r + colourShift) % 4);
      if (slides) pane.slide = { reach: CELL_W * 0.8, speed: 0.9 + level * 0.15 };
      panes.push(pane);
    }
  }
  return panes;
}

/** The rose window: a ring (two from chapel 3) of panes turning round a heart pane, over a low arch. */
function roseWindow(chapel: number, rand: Rand): PaneSpec[] {
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
  return panes;
}
