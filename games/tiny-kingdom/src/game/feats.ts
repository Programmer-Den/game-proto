import type { TextKey } from '../i18n';
import { cellParts, ownGrid, templeWorth, type GameState } from './state';
import { AROUND, SIDES, scores, type Cell } from './tiles';

// Kingdom feats: goals on the board that last from kingdom to kingdom, each unlocking a tile skin
// (a paint for the grass, picked on the feats card). They are checked after every change, from the
// board as it stands (the player's own buildings, when a rival lord shares it), and saved once
// won (`tiny-kingdom-feats`).

/** The tile skins, in the order of the feats card's swatches: '' is the classic paint, the rest are won by a feat. */
export const SKINS = ['', 'spring', 'autumn', 'heather', 'snow', 'sand', 'moss', 'dusk'] as const;
export type Skin = (typeof SKINS)[number];

export interface Feat {
  id: string;
  /** What earns it, a key of `i18n/en.ts`. */
  text: TextKey;
  /** The skin it unlocks. */
  skin: Exclude<Skin, ''>;
  /** Whether the kingdom has done it. */
  done: (s: GameState) => boolean;
}

/** Whether some cell holding `kind` satisfies `test`. */
const any = (grid: Cell[][], kind: Cell, test: (col: number, row: number) => boolean) =>
  grid.some((cells, row) => cells.some((cell, col) => cell === kind && test(col, row)));
/** How many of the cells in `dirs` from (col, row) `count` accepts. */
const near = (grid: Cell[][], col: number, row: number, dirs: readonly (readonly [number, number])[], count: (c: Cell | undefined) => boolean) =>
  dirs.filter(([dc, dr]) => count(grid[row + dr]?.[col + dc])).length;

export const FEATS: Feat[] = [
  { id: 'lakeFarm', text: 'featLakeFarm', skin: 'spring', done: (s) => any(ownGrid(s), 'farm', (c, r) => near(ownGrid(s), c, r, SIDES, (x) => x === 'lake') >= 3) },
  { id: 'tallWatch', text: 'featTallWatch', skin: 'autumn', done: (s) => any(ownGrid(s), 'tower', (c, r) => cellParts(ownGrid(s), c, r).from.length >= 6) },
  { id: 'richManor', text: 'featRichManor', skin: 'heather', done: (s) => any(ownGrid(s), 'manor', (c, r) => near(ownGrid(s), c, r, SIDES, (x) => x === 'farm') >= 3) },
  // A temple's worth counts every tower on the island, the rival's included, as its score does.
  { id: 'quietTemple', text: 'featQuietTemple', skin: 'snow', done: (s) => any(ownGrid(s), 'temple', (c, r) => templeWorth(s.grid, c, r) >= 4 && s.grid.some((cells) => cells.includes('tower'))) },
  {
    id: 'busyMarket',
    text: 'featBusyMarket',
    skin: 'sand',
    done: (s) => any(ownGrid(s), 'market', (c, r) => new Set(AROUND.map(([dc, dr]) => ownGrid(s)[r + dr]?.[c + dc]).filter(scores)).size >= 5),
  },
  { id: 'harbourLight', text: 'featHarbourLight', skin: 'moss', done: (s) => any(ownGrid(s), 'lighthouse', (c, r) => near(ownGrid(s), c, r, AROUND, (x) => x === 'harbor') >= 2) },
  { id: 'thirdIsle', text: 'featThirdIsle', skin: 'dusk', done: (s) => s.link >= 3 },
];

/** The feats `s` has done that `won` does not hold yet. */
export const newFeats = (s: GameState, won: readonly string[]) => FEATS.filter((f) => !won.includes(f.id) && f.done(s));

/** Whether skin `skin` can be picked, given the feats won. */
export const skinOpen = (skin: Skin, won: readonly string[]) => skin === '' || FEATS.some((f) => f.skin === skin && won.includes(f.id));
