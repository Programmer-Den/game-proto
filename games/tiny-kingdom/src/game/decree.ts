import type { Pouch } from './state';
import { AROUND, MAP_SIZE, SIDES, isHome, seeded, type Cell } from './tiles';

// Royal decrees: each round's side goal, such as "3 farms on the shore of Eastmere". Fulfilling it
// pays DECREE_BONUS points and a crown. Progress is always counted from the board, so undo and the
// scene never have to track it. A decree is only offered when the board has room for it and the
// pouch holds the tiles it asks for, so every decree can be met.

/** Points a fulfilled decree adds to the score. */
export const DECREE_BONUS = 8;

export type DecreeKind = 'shore' | 'wood' | 'watch';
export type At = [col: number, row: number];

export interface Decree {
  kind: DecreeKind;
  /** The lake or wood it names, by its English name as an id ('' for a watch decree); the scene words the decree from kind, place and need. */
  place: string;
  /** The named lake's or wood's cells when the decree was drawn; `decreeRegion` keeps those still standing. */
  cells: At[];
  /** How many it asks for: farms or houses on the place's edge, or houses around one tower. */
  need: number;
  /** Set once fulfilled; its bonus and crown are paid once. */
  done: boolean;
}

/** Where a decree stands on a board: how far along it is and what the board should mark. */
export interface DecreeMarks {
  have: number;
  /** Buildings that count towards it. */
  counted: At[];
  /** Grass cells where the next one could go. */
  spots: At[];
  /** The tower being judged, for a watch decree. */
  tower: At | null;
}

const key = ([c, r]: At) => `${c},${r}`;

/** The connected patches (by shared edges) of `kind` on the grid. */
export function regions(grid: Cell[][], kind: Cell): At[][] {
  const seen = new Set<string>();
  const out: At[][] = [];
  grid.forEach((cells, row) =>
    cells.forEach((cell, col) => {
      if (cell !== kind || seen.has(key([col, row]))) return;
      const patch: At[] = [];
      const todo: At[] = [[col, row]];
      seen.add(key([col, row]));
      while (todo.length) {
        const at = todo.pop()!;
        patch.push(at);
        for (const [dc, dr] of SIDES) {
          const next: At = [at[0] + dc, at[1] + dr];
          if (grid[next[1]]?.[next[0]] === kind && !seen.has(key(next))) {
            seen.add(key(next));
            todo.push(next);
          }
        }
      }
      out.push(patch.sort((a, b) => a[1] - b[1] || a[0] - b[0]));
    }),
  );
  return out;
}

/** Cells sharing an edge with the patch, outside it. */
function edge(cells: At[]): At[] {
  const inside = new Set(cells.map(key));
  const out = new Map<string, At>();
  for (const [c, r] of cells)
    for (const [dc, dr] of SIDES) {
      const at: At = [c + dc, r + dr];
      if (at[0] < 0 || at[1] < 0 || at[0] >= MAP_SIZE.cols || at[1] >= MAP_SIZE.rows || inside.has(key(at))) continue;
      out.set(key(at), at);
    }
  return [...out.values()].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

/** Which way a patch lies from the island's middle: North, South, East, West or Mid. */
function compass(cells: At[]) {
  const dx = cells.reduce((t, [c]) => t + c, 0) / cells.length - (MAP_SIZE.cols - 1) / 2;
  const dy = cells.reduce((t, [, r]) => t + r, 0) / cells.length - (MAP_SIZE.rows - 1) / 2;
  if (Math.abs(dx) < 1.5 && Math.abs(dy) < 1) return 'Mid';
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'East' : 'West';
  return dy > 0 ? 'South' : 'North';
}

/** Every lake or wood with a name from where it lies: Eastmere, Westpool, Northwood, ... The English name is its id; `placeName` in `i18n.ts` shows it in the hub's language. */
export function namedPlaces(grid: Cell[][], kind: 'lake' | 'forest') {
  const endings = kind === 'lake' ? ['mere', 'pool', 'tarn', 'water'] : ['wood', 'grove', 'holt', 'shaw'];
  const used = new Map<string, number>();
  return regions(grid, kind).map((cells) => {
    const dir = compass(cells);
    const n = used.get(dir) ?? 0;
    used.set(dir, n + 1);
    return { name: dir + endings[n % endings.length], cells };
  });
}

/** How many houses (manors included) stand in the eight cells around (col, row). */
function housesAround(grid: Cell[][], col: number, row: number) {
  return AROUND.filter(([dc, dr]) => isHome(grid[row + dr]?.[col + dc])).length;
}

/**
 * The decree's lake or wood as it stands on `grid`: its cells that are still lake or forest, so a
 * wood cell a lumber camp cleared no longer counts as inside it. Empty for a watch decree.
 */
export const decreeRegion = (grid: Cell[][], decree: Decree): At[] =>
  decree.cells.filter(([c, r]) => grid[r]?.[c] === (decree.kind === 'shore' ? 'lake' : 'forest'));

/** Where `decree` stands on `grid`. */
export function decreeMarks(grid: Cell[][], decree: Decree): DecreeMarks {
  if (decree.kind === 'watch') {
    let best: At | null = null;
    let have = 0;
    grid.forEach((cells, row) =>
      cells.forEach((cell, col) => {
        if (cell !== 'tower') return;
        const n = housesAround(grid, col, row);
        if (!best || n > have) [best, have] = [[col, row], n];
      }),
    );
    const counted = best ? AROUND.map(([dc, dr]): At => [best![0] + dc, best![1] + dr]).filter(([c, r]) => isHome(grid[r]?.[c])) : [];
    const spots = best ? AROUND.map(([dc, dr]): At => [best![0] + dc, best![1] + dr]).filter(([c, r]) => grid[r]?.[c] === 'grass') : [];
    return { have, counted, spots, tower: best };
  }
  // A manor counts as a house.
  const counts = (cell: Cell) => (decree.kind === 'shore' ? cell === 'farm' : isHome(cell));
  const around = edge(decreeRegion(grid, decree));
  const counted = around.filter(([c, r]) => counts(grid[r][c]));
  return { have: counted.length, counted, spots: around.filter(([c, r]) => grid[r][c] === 'grass'), tower: null };
}

/** How many more a new decree asks for than the board already has. */
const ASK = { shore: 3, wood: 2, watch: 3 };

/**
 * The fewest houses a watch decree would still need: around a tower standing with room enough, or
 * around a new one on a grass cell when the pouch holds a tower. Null when no tower could ever get
 * ASK.watch homes around it.
 */
function watchShort(grid: Cell[][], pouch: Pouch): number | null {
  let fewest: number | null = null;
  grid.forEach((cells, row) =>
    cells.forEach((cell, col) => {
      if (cell !== 'tower' && !(cell === 'grass' && pouch.tower > 0)) return;
      const around = AROUND.map(([dc, dr]) => grid[row + dr]?.[col + dc]);
      const short = ASK.watch - around.filter(isHome).length;
      if (around.filter((c) => c === 'grass').length >= short && (fewest === null || short < fewest)) fewest = short;
    }),
  );
  return fewest;
}

function makeDecree(grid: Cell[][], pouch: Pouch, kind: DecreeKind, place: string, cells: At[]): Decree | null {
  const draft: Decree = { kind, place, cells, need: 0, done: false };
  const now = decreeMarks(grid, draft);
  if (kind === 'watch') {
    // One tower with three houses around it; offered only while no tower has three yet, and only
    // when a tower has (or could have) room for them and the pouch holds the houses.
    if (now.have >= ASK.watch) return null;
    const short = watchShort(grid, pouch);
    if (short === null || pouch.house < short) return null;
    return { ...draft, need: ASK.watch };
  }
  // Enough open spots on the edge, and the farms or houses to fill them in the pouch.
  if (now.spots.length < ASK[kind] || pouch[kind === 'shore' ? 'farm' : 'house'] < ASK[kind]) return null;
  return { ...draft, need: now.have + ASK[kind] };
}

/**
 * The decree for round `round` on the board as it stands when the round begins. Round 1 always
 * asks for farms on the shore of the lake with the most open shore; later rounds draw a kind and a
 * place from a generator seeded by island and round, never the same as `last` (the round before's).
 * `pouch` is the tiles the round starts with; a decree it lacks the tiles for is never offered.
 * Null when nothing fits.
 */
export function decreeFor(island: number, round: number, grid: Cell[][], pouch: Pouch, last: Decree | null = null): Decree | null {
  const lakes = namedPlaces(grid, 'lake');
  if (round === 1) {
    const open = (cells: At[]) => edge(cells).filter(([c, r]) => grid[r][c] === 'grass').length;
    const lake = [...lakes].sort((a, b) => open(b.cells) - open(a.cells))[0];
    const decree = lake && makeDecree(grid, pouch, 'shore', lake.name, lake.cells);
    if (decree) return decree;
  }
  const rand = seeded(island * 31 + round * 7907);
  const shuffle = <T>(list: T[]) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };
  const woods = namedPlaces(grid, 'forest');
  for (const kind of shuffle<DecreeKind>(['shore', 'wood', 'watch'])) {
    if (kind === 'watch') {
      if (last?.kind === 'watch') continue;
      const decree = makeDecree(grid, pouch, 'watch', '', []);
      if (decree) return decree;
      continue;
    }
    for (const place of shuffle(kind === 'shore' ? [...lakes] : [...woods])) {
      if (last?.kind === kind && last.place === place.name) continue;
      const decree = makeDecree(grid, pouch, kind, place.name, place.cells);
      if (decree) return decree;
    }
  }
  return null;
}
