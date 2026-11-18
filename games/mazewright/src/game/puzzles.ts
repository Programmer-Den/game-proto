import type { Cell, MapDef } from './maps';
import type { Group, TowerKind } from './rules';

// Puzzle lawns: small set gardens with their own gold, their own towers and their own few waves, the
// same for everyone (their own foe health whatever the difficulty, a fixed seed, Calm). Each is won
// for one to three stars by the cabbages kept (`stars`), and each opens once the one before it has a
// star. `e2e/bot.ts` with PUZZLES=1 plays them: a plain greedy bot should fall short of three stars,
// and the best of a spread of bots should reach them.

export interface Puzzle {
  id: string;
  /** The lawn, with its own `gold` and `lives`; its season gives its look (and summer or winter its weather). */
  map: MapDef & { gold: number; lives: number };
  /** The towers lent, in tool bar order (the wicket gate comes with every run besides). */
  kit: TowerKind[];
  /** The waves, in order: started by hand, as in Calm. */
  waves: Group[][];
  /** The foes' health scale, whatever the difficulty. */
  tough: number;
}

/** A row or column of cells from `a` to `b`, both included. */
function run([ax, ay]: Cell, [bx, by]: Cell): Cell[] {
  const cells: Cell[] = [];
  for (let x = ax, y = ay; ; x += Math.sign(bx - ax), y += Math.sign(by - ay)) {
    cells.push([x, y]);
    if (x === bx && y === by) return cells;
  }
}

const lawn = (id: string, season: MapDef['season'], gold: number, lives: number, def: Omit<MapDef, 'id' | 'season' | 'challenge' | 'gold' | 'lives'>) => ({ id, season, gold, lives, challenge: [], ...def });

export const PUZZLES: Puzzle[] = [
  {
    // A first puzzle: a straight lawn and a short purse, so every hedge has to count.
    id: 'hedgerow',
    map: lawn('hedgerow', 'spring', 80, 10, { gates: [[0, 5]], goal: [21, 5], rocks: [[6, 2], [6, 8], [15, 2], [15, 8]] }),
    kit: ['hedge', 'bow'],
    tough: 3,
    waves: [[['beetle', 8]], [['ladybird', 10]], [['beetle', 10], ['stag', 2]], [['beetle', 8], ['ladybird', 10]]],
  },
  {
    // A long wall with one gap in the middle: a wicket gate there sends foes round the far end, or back.
    id: 'wicketwalk',
    map: lawn('wicketwalk', 'spring', 70, 10, { gates: [[0, 2]], goal: [0, 8], rocks: [...run([0, 5], [9, 5]), ...run([11, 5], [19, 5])] }),
    kit: ['hedge', 'bow', 'frost'],
    tough: 3,
    waves: [[['beetle', 10]], [['ladybird', 12]], [['beetle', 12], ['earwig', 3]], [['earwig', 8], ['stag', 3]], [['beetle', 14], ['earwig', 6]]],
  },
  {
    // Two burrows and a sky of moths: the maze slows the walkers, only the nests stop the fliers.
    id: 'mothmeadow',
    map: lawn('mothmeadow', 'autumn', 90, 10, { gates: [[0, 1], [0, 9]], goal: [21, 5], rocks: [[8, 5], [14, 5], [11, 2], [11, 8]] }),
    kit: ['hedge', 'bow', 'swallow'],
    tough: 1.7,
    waves: [[['beetle', 8], ['moth', 4]], [['moth', 10]], [['ladybird', 10], ['moth', 8]], [['moth', 16], ['beetle', 8]]],
  },
  {
    // Water down the middle and banks beside it: frost and cannon, against foes that split and heal.
    id: 'lilypond',
    map: lawn('lilypond', 'spring', 100, 10, {
      gates: [[0, 5]], goal: [21, 5], rocks: [[4, 1], [4, 9], [17, 1], [17, 9]],
      ponds: [...run([9, 3], [12, 3]), ...run([9, 4], [12, 4]), ...run([9, 6], [12, 6]), ...run([9, 7], [12, 7])],
      banks: [[8, 2], [13, 2], [8, 8], [13, 8], [10, 5], [11, 5]],
    }),
    kit: ['hedge', 'frost', 'cannon'],
    tough: 1.55,
    waves: [[['woodlouse', 6]], [['snail', 4], ['beetle', 8]], [['woodlouse', 8], ['snail', 4]], [['beetle', 6, { size: 2 }], ['woodlouse', 6]]],
  },
  {
    // Moles chew through a hedge that saves them a long way round: hold them still or snare them first.
    id: 'molehill',
    map: lawn('molehill', 'autumn', 90, 10, { gates: [[0, 5]], goal: [21, 5], rocks: [[5, 3], [5, 7], [10, 0], [10, 10], [16, 3], [16, 7]] }),
    kit: ['hedge', 'bow', 'nettle', 'snare'],
    tough: 2.3,
    waves: [[['mole', 4]], [['beetle', 8], ['mole', 4]], [['mole', 8]], [['mole', 6], ['weevil', 6]], [['mole', 10], ['mole', 1, { king: true }]]],
  },
  {
    // A thin purse and a bounty foe leading every wave: catch it early, or the towers you need never come.
    id: 'bountyhunt',
    map: lawn('bountyhunt', 'autumn', 55, 10, { gates: [[0, 5]], goal: [21, 5], rocks: [[3, 4], [3, 6], [9, 1], [9, 9], [18, 4], [18, 6]] }),
    kit: ['hedge', 'bow', 'crossbow'],
    tough: 2,
    waves: [
      [['beetle', 1, { bounty: true }], ['beetle', 8]],
      [['ladybird', 1, { bounty: true }], ['ladybird', 12]],
      [['stag', 1, { bounty: true }], ['beetle', 12]],
      [['earwig', 1, { bounty: true }], ['stag', 4], ['earwig', 4]],
      [['stag', 1, { bounty: true }], ['weevil', 8], ['stag', 4]],
      [['earwig', 1, { bounty: true }], ['earwig', 8], ['stag', 6]],
    ],
  },
];
