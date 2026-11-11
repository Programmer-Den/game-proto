import { cellIndex, MAPS } from './maps';
import { COLS, MAX_LEVEL, ROWS, TOWER, type TowerKind } from './rules';
import type { Game } from './sim';

// Maze codes: a maze copied as a short text to share, and planted again in Sandbox. A code is
// `<garden>.<hedges>.<towers>`: the garden's id, the hedges as one bit a cell in base64url (trailing
// empty cells left off), and every other tower as three base64url characters (its cell, its kind
// and its level). Traps lie on the lawn for one use, so they are left out. A daily maze's extra rocks
// are written as hedges, since the code names only the garden they were added to.

const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** The kinds by their number in a code: a new kind goes at the end, so older codes still read the same (at most 32). */
const KINDS: TowerKind[] = ['hedge', 'bow', 'frost', 'cannon', 'storm', 'crossbow', 'bonfire', 'puffball', 'sunglass', 'beehive', 'apple', 'whirligig', 'swallow', 'nettle', 'toadstool', 'honey', 'snare', 'lantern'];
const CELLS = COLS * ROWS;

/** A tower in a maze code. */
export interface CodeTower {
  cell: number;
  kind: TowerKind;
  level: number;
}

/** The code of the maze in `g`: its garden, its hedges and its towers. */
export function mazeCode(g: Game) {
  const bits = new Uint8Array(Math.ceil(CELLS / 6) * 6);
  let towers = '';
  for (const t of [...g.towers].sort((a, b) => a.cell - b.cell)) {
    if (t.kind === 'hedge') bits[t.cell] = 1;
    else {
      // 8 bits of cell, 5 of kind and 2 of level make 15 of the 18 bits in three characters.
      const n = (t.cell << 7) | (KINDS.indexOf(t.kind) << 2) | (t.level - 1);
      towers += ABC[(n >> 12) & 63] + ABC[(n >> 6) & 63] + ABC[n & 63];
    }
  }
  // The daily maze's extra rocks are not in its garden, so they go in the code as hedges and the maze keeps its shape.
  if (g.daily) {
    const base = MAPS.find((m) => m.id === g.map.id);
    for (const rock of g.map.rocks) if (!base?.rocks.some((r) => r[0] === rock[0] && r[1] === rock[1])) bits[cellIndex(rock)] = 1;
  }
  let hedges = '';
  for (let i = 0; i < bits.length; i += 6) hedges += ABC[bits.slice(i, i + 6).reduce((n, b, j) => n | (b << j), 0)];
  return `${g.map.id}.${hedges.replace(/A+$/, '')}.${towers}`;
}

/** Reads a maze code: its garden and its towers (hedges first), or null when it isn't one. */
export function readCode(text: string): { map: string; towers: CodeTower[] } | null {
  const parts = text.trim().split('.');
  if (parts.length !== 3) return null;
  const [map, hedges, rest] = parts;
  if (!MAPS.some((m) => m.id === map) || hedges.length > Math.ceil(CELLS / 6) || rest.length % 3) return null;
  const at = (c: string) => ABC.indexOf(c);
  if ([...hedges, ...rest].some((c) => at(c) < 0)) return null;
  const towers: CodeTower[] = [];
  [...hedges].forEach((c, i) => {
    for (let j = 0; j < 6; j++) if ((at(c) >> j) & 1 && i * 6 + j < CELLS) towers.push({ cell: i * 6 + j, kind: 'hedge', level: 1 });
  });
  for (let i = 0; i < rest.length; i += 3) {
    const n = (at(rest[i]) << 12) | (at(rest[i + 1]) << 6) | at(rest[i + 2]);
    const cell = n >> 7;
    const kind = KINDS[(n >> 2) & 31];
    const level = (n & 3) + 1;
    if (cell >= CELLS || !kind || kind === 'hedge' || TOWER[kind].trap || level > MAX_LEVEL) return null;
    towers.push({ cell, kind, level });
  }
  return { map, towers };
}
