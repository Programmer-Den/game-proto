import { COLS, ROWS } from './rules';

/** A cell as [column, row]. */
export type Cell = [number, number];

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];
/** The stars won across all gardens that open each season's gardens. */
export const SEASON_STARS: Record<Season, number> = { spring: 0, summer: 4, autumn: 10, winter: 18 };

export interface MapDef {
  id: string;
  season: Season;
  /** The burrows the foes come out of (one to six), in the order they open (`GATE_WAVES`). */
  gates: Cell[];
  /** The cottage they walk to. */
  goal: Cell;
  /** Boulders that block for good: nothing is built on them. */
  rocks: Cell[];
  /** Water: walkers go round it, moths and sunglass beams cross it, and nothing is built on it. */
  ponds?: Cell[];
  /** Raised banks: a tower on one reaches further (`BANK_REACH`). */
  banks?: Cell[];
  /** A path garden's gravel path: foes walk only on it, and towers go only on the lawn beside it. */
  path?: Cell[];
  /** Cabbages in the patch, for a garden that sets its own. */
  lives?: number;
}

/** The cells of a line through `points`, each turn on a straight row or column. */
function line(...points: Cell[]): Cell[] {
  const cells: Cell[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    let [x, y] = points[i - 1];
    const [tx, ty] = points[i];
    while (x !== tx || y !== ty) {
      x += Math.sign(tx - x);
      y += Math.sign(ty - y);
      cells.push([x, y]);
    }
  }
  return cells;
}

/** Every cell of the rectangle from (x, y), w wide and h tall. */
function block(x: number, y: number, w: number, h: number): Cell[] {
  const cells: Cell[] = [];
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) cells.push([i, j]);
  return cells;
}

/** The twelve gardens, three a season, each with its own rocks, water and burrows. */
export const MAPS: MapDef[] = [
  {
    id: 'meadow',
    season: 'spring',
    gates: [[0, 2], [0, 8]],
    goal: [21, 5],
    rocks: [[9, 2], [12, 8], [16, 3], [18, 7], [10, 5]],
  },
  {
    id: 'orchard',
    season: 'spring',
    gates: [[0, 1], [0, 9]],
    goal: [21, 5],
    rocks: [[6, 3], [6, 7], [10, 1], [10, 5], [10, 9], [14, 3], [14, 7], [18, 5]],
  },
  {
    id: 'millpond',
    season: 'spring',
    gates: [[0, 5], [11, 0]],
    goal: [21, 10],
    rocks: [[14, 6], [15, 6], [14, 7], [17, 2], [4, 9]],
    ponds: block(7, 4, 2, 2),
  },
  {
    id: 'brook',
    season: 'summer',
    gates: [[0, 2], [0, 8]],
    goal: [21, 5],
    rocks: [[5, 4], [5, 6], [17, 2], [17, 8]],
    // A brook down the middle with two fords, and banks along it.
    ponds: [...block(11, 0, 1, 2), ...block(11, 3, 1, 5), ...block(11, 9, 1, 2)],
    banks: [[10, 1], [12, 1], [10, 5], [12, 5], [10, 9], [12, 9]],
  },
  {
    id: 'warren',
    season: 'summer',
    gates: [[0, 1], [0, 9], [0, 5]],
    goal: [21, 5],
    rocks: [[7, 2], [7, 8], [12, 4], [12, 6], [16, 1], [16, 9], [19, 3], [19, 7]],
  },
  {
    id: 'gravel',
    season: 'summer',
    gates: [[0, 2], [0, 8]],
    goal: [21, 8],
    rocks: [],
    path: [...line([0, 2], [17, 2], [17, 5], [4, 5], [4, 8], [21, 8]), ...line([0, 8], [3, 8])],
    banks: [[10, 3], [10, 4], [9, 7]],
  },
  {
    id: 'hillside',
    season: 'autumn',
    gates: [[0, 4], [0, 9]],
    goal: [21, 1],
    rocks: [[6, 6], [9, 3], [12, 7], [15, 4], [18, 8], [3, 2]],
    // A raised terrace along the top.
    banks: block(4, 0, 15, 2),
  },
  {
    id: 'crossroads',
    season: 'autumn',
    gates: [[0, 5], [21, 5], [11, 0], [11, 10]],
    goal: [11, 5],
    rocks: [[5, 2], [5, 8], [16, 2], [16, 8], [8, 5], [14, 5]],
    ponds: [[9, 3], [13, 3], [9, 7], [13, 7]],
  },
  {
    id: 'leafwalk',
    season: 'autumn',
    gates: [[0, 1], [21, 5]],
    goal: [21, 9],
    rocks: [],
    path: [...line([0, 1], [20, 1], [20, 5], [1, 5], [1, 9], [21, 9]), [21, 5]],
    ponds: block(8, 3, 4, 1),
    banks: [[10, 7], [15, 7], [5, 3]],
  },
  {
    id: 'icepond',
    season: 'winter',
    gates: [[0, 2], [0, 8], [11, 0]],
    goal: [21, 5],
    rocks: [[4, 5], [17, 1], [17, 9]],
    ponds: [...block(8, 4, 6, 3), [9, 3], [12, 3], [9, 7], [12, 7]],
    banks: [[7, 3], [14, 3], [7, 7], [14, 7]],
  },
  {
    id: 'lastcabbage',
    season: 'winter',
    gates: [[0, 1], [0, 9], [0, 5], [7, 0], [7, 10], [14, 0]],
    goal: [21, 5],
    rocks: [[10, 3], [10, 7], [15, 5], [18, 2], [18, 8]],
    lives: 1,
  },
  {
    id: 'snowpath',
    season: 'winter',
    gates: [[0, 5], [11, 0]],
    goal: [21, 5],
    rocks: [[8, 3], [13, 7], [19, 6]],
    path: [...line([0, 5], [5, 5], [5, 1], [16, 1], [16, 8], [21, 8], [21, 5]), [11, 0]],
    banks: [[6, 3], [14, 3], [17, 6], [10, 2]],
  },
];

export const cellIndex = ([x, y]: Cell) => y * COLS + x;
export const cellOf = (i: number): Cell => [i % COLS, Math.floor(i / COLS)];
export const inGrid = (x: number, y: number) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
