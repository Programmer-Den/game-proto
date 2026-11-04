import { namedPlaces, type At } from './decree';
import { AROUND, SIDES, WONDER_CELLS, isHome, isWonder, seeded, wonderAnchor, type Cell } from './tiles';

// Omens: from round OMEN_FROM on, each round warns of what the next round brings, so there is a
// round to prepare. A flood: a lake rises over a named shore cell (grass or a farm) when the next
// round begins. A storm: a tower with no house around it falls when the next round begins, unless
// a house stands by it by then.

/** The first round that gets an omen (it strikes when the round after it begins). */
export const OMEN_FROM = 3;

export type OmenKind = 'flood' | 'storm';

export interface Omen {
  kind: OmenKind;
  /** The threatened cell: the shore cell a flood takes, or the tower a storm topples. */
  at: At;
  /** The rising lake's name (its id, see `namedPlaces`), '' for a storm. The scene words the omen from kind and place. */
  place: string;
}

/** What an omen did when it struck: the cells it changed (the scene's popup over them names the kind). */
export interface Struck {
  kind: OmenKind;
  cells: At[];
}

const lone = (grid: Cell[][], col: number, row: number) => grid[row][col] === 'tower' && !AROUND.some(([dc, dr]) => isHome(grid[row + dr]?.[col + dc]));

/**
 * The omen for the round after `round`, drawn when round `round` begins on the board as it stands:
 * a storm on a tower that has no house around it, or a flood on a grass or farm cell beside a
 * lake, each seeded by island and round. Null before OMEN_FROM or when neither fits.
 */
export function omenFor(island: number, round: number, grid: Cell[][]): Omen | null {
  if (round < OMEN_FROM) return null;
  const rand = seeded(island * 131 + round * 2693);
  const pick = <T>(list: T[]): T | undefined => list[Math.floor(rand() * list.length)];
  const kinds: OmenKind[] = rand() < 0.5 ? ['storm', 'flood'] : ['flood', 'storm'];
  for (const kind of kinds) {
    if (kind === 'storm') {
      const towers: At[] = [];
      grid.forEach((cells, row) => cells.forEach((_, col) => lone(grid, col, row) && towers.push([col, row])));
      const at = pick(towers);
      if (at) return { kind, at, place: '' };
    } else {
      const lakes = namedPlaces(grid, 'lake');
      const shores = lakes.flatMap((lake) => {
        const seen = new Set<string>();
        const out: { at: At; place: string }[] = [];
        for (const [c, r] of lake.cells)
          for (const [dc, dr] of SIDES) {
            const cell = grid[r + dr]?.[c + dc];
            if ((cell !== 'grass' && cell !== 'farm') || seen.has(`${c + dc},${r + dr}`)) continue;
            seen.add(`${c + dc},${r + dr}`);
            out.push({ at: [c + dc, r + dr], place: lake.name });
          }
        return out;
      });
      const shore = pick(shores);
      if (shore) return { kind, at: shore.at, place: shore.place };
    }
  }
  return null;
}

/**
 * Lets `omen` strike `grid` as its round begins. Null when nothing happened (the tower was no longer
 * alone, or gone). A flood on a wonder's cell takes the whole wonder: the cell becomes a lake and the
 * other three grass, so no part of it is left to score as a wonder of its own.
 */
export function strike(grid: Cell[][], omen: Omen): Struck | null {
  const [col, row] = omen.at;
  if (omen.kind === 'flood') {
    const cells: At[] = [omen.at];
    const cell = grid[row][col];
    if (isWonder(cell)) {
      const anchor = WONDER_CELLS.map(([dc, dr]): At => [col - dc, row - dr]).find(
        ([c, r]) => wonderAnchor(grid, c, r) && WONDER_CELLS.every(([dc, dr]) => grid[r + dr]?.[c + dc] === cell),
      );
      if (anchor)
        for (const [dc, dr] of WONDER_CELLS) {
          const [c, r] = [anchor[0] + dc, anchor[1] + dr];
          if (c === col && r === row) continue;
          grid[r][c] = 'grass';
          cells.push([c, r]);
        }
    }
    grid[row][col] = 'lake';
    return { kind: 'flood', cells };
  }
  if (!lone(grid, col, row)) return null;
  grid[row][col] = 'grass';
  return { kind: 'storm', cells: [omen.at] };
}
