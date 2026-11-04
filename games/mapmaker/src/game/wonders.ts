// The isles' hidden wonders (MM12): each isle hides one, on a tile picked from its terrain without
// any random draws (so it never moves a seeded isle). It shows once the tile and the four next to it
// are charted, and the first of each kind goes into the wonder gallery.
import type { TextKey } from '../i18n';
import type { IsleKind } from './kinds';
import { GRID, indexOf, neighbours, tileAt, type GameState, type Point, type Tile } from './state';
import type { Terrain } from './terrain';

export type WonderKind = 'waterfall' | 'stones' | 'arch' | 'lagoon' | 'volcano' | 'springs' | 'tree' | 'temple';

export interface WonderInfo {
  /** Its name and a line about it, as keys of `i18n/en.ts`. */
  name: TextKey;
  text: TextKey;
  /** The kind of isle it is found on. */
  isle: IsleKind;
  /** The ground it hides under, best first; `beside` asks for a tile of that terrain next to it too. */
  on: Terrain[];
  beside?: Terrain[];
}

/** Two wonders for each kind of isle: the first round of isles has the first, the next round the second. */
export const WONDERS: Record<WonderKind, WonderInfo> = {
  waterfall: { name: 'waterfallName', text: 'waterfallText', isle: 'green', on: ['river'], beside: ['hills', 'mountain'] },
  arch: { name: 'archName', text: 'archText', isle: 'archipelago', on: ['beach'], beside: ['sea'] },
  volcano: { name: 'volcanoName', text: 'volcanoText', isle: 'volcanic', on: ['mountain'] },
  tree: { name: 'treeName', text: 'treeText', isle: 'jungle', on: ['forest'], beside: ['forest'] },
  stones: { name: 'stonesName', text: 'stonesText', isle: 'green', on: ['hills', 'grass'] },
  lagoon: { name: 'lagoonName', text: 'lagoonText', isle: 'archipelago', on: ['beach'], beside: ['sea'] },
  springs: { name: 'springsName', text: 'springsText', isle: 'volcanic', on: ['hills'] },
  temple: { name: 'templeName', text: 'templeText', isle: 'jungle', on: ['forest'], beside: ['river', 'ruins'] },
};
/** The gallery's order: the first round's four, then the second round's. */
export const WONDER_IDS = Object.keys(WONDERS) as WonderKind[];

export interface Wonder {
  at: Point;
  kind: WonderKind;
  /** True once the tile and its neighbours are charted. */
  seen: boolean;
}

/** The wonder of the n-th isle of a kind: green isles 1 and 5 have different ones, and so on. */
export function wonderKind(island: number, kind: IsleKind): WonderKind {
  const two = WONDER_IDS.filter((w) => WONDERS[w].isle === kind);
  return two[Math.floor((island - 1) / 4) % two.length];
}

/**
 * Places the isle's wonder: on a tile of its ground (with its `beside` terrain next to it when one
 * has), else any of its ground, else any land but the port; picked from the island number alone.
 */
export function placeWonder(tiles: Tile[], island: number, kind: IsleKind): Wonder | null {
  const wonder = wonderKind(island, kind);
  const info = WONDERS[wonder];
  const at = (x: number, y: number) => tiles[indexOf(x, y)].terrain;
  const spots = (fit: (x: number, y: number) => boolean) => {
    const out: Point[] = [];
    for (let y = 0; y < GRID.h; y++) for (let x = 0; x < GRID.w; x++) if (fit(x, y)) out.push({ x, y });
    return out;
  };
  const lists = [
    spots((x, y) => info.on.includes(at(x, y)) && (!info.beside || neighbours(x, y).some((n) => info.beside!.includes(at(n.x, n.y))))),
    spots((x, y) => info.on.includes(at(x, y))),
    spots((x, y) => at(x, y) !== 'sea' && at(x, y) !== 'port'),
  ];
  const list = lists.find((l) => l.length > 0);
  if (!list) return null;
  // A whole-number hash of the island number, so the pick is spread over the isle.
  const pick = Math.imul(island + 7, 2654435761) >>> 0;
  return { at: list[pick % list.length], kind: wonder, seen: false };
}

/** True when the wonder's tile and every tile next to it are charted. */
export function wonderInSight(s: GameState) {
  const w = s.wonder;
  if (!w) return false;
  return [w.at, ...neighbours(w.at.x, w.at.y)].every((p) => tileAt(s, p.x, p.y)!.revealed);
}

/**
 * Marks the wonder seen once it is in sight, and adds it to the gallery when it is the first of its
 * kind. Returns true when it came into sight just now.
 */
export function spotWonder(s: GameState) {
  const w = s.wonder;
  if (!w || w.seen || !wonderInSight(s)) return false;
  w.seen = true;
  if (!s.wonders.some((g) => g.kind === w.kind)) s.wonders.push({ kind: w.kind, island: s.island });
  return true;
}
