import type { TextKey } from '../i18n';
import type { EnemyKind } from './enemies';
import type { EventId } from './events';
import { random } from './rng';
import type { Mutators } from './weekly';

// The dungeon of each act: rooms in seven columns from the entrance on the left to the act's boss
// on the right. Every column between holds two or three rooms, and from each room the paths lead
// on to one or more rooms in the next column. (x, y) is where the room is drawn on the 960x540 map.

export type RoomKind = 'fight' | 'elite' | 'rest' | 'treasure' | 'shop' | 'event' | 'boss';

export interface Room {
  kind: RoomKind;
  col: number;
  x: number;
  y: number;
  /** The rooms in the next column its paths lead to. */
  next: number[];
  /** Who waits inside, for a fight, an elite or the boss, left to right. */
  foes?: EnemyKind[];
  /** Which mystery waits inside an event room. */
  event?: EventId;
}

/** How many columns of rooms an act has, the boss's included. */
export const COLUMNS = 7;
/** How many acts a run has: two, and a third (the Bone Spire) from SPIRE_DEPTH down (see `lastAct` in sim.ts). */
export const ACTS = 2;
/** The depth from which the Hollow Queen's fall leads up the Bone Spire, a third act. */
export const SPIRE_DEPTH = 3;

const colX = (col: number) => 110 + col * 130;
const MID = 290;
/** The rows of a column, by how many rooms it holds. */
const ROWS: Record<number, number[]> = { 1: [MID], 2: [200, 380], 3: [170, 290, 410] };

interface ActFoes {
  /** The act's name, a key of `i18n/en.ts`. */
  name: TextKey;
  first: EnemyKind[];
  early: EnemyKind[][];
  late: EnemyKind[][];
  elites: EnemyKind[][];
  boss: EnemyKind;
  /** The mystery rooms its map draws from. */
  events: EventId[];
}

/** The foes each act's rooms can hold. Act one always opens on a lone slime. */
export const ACT_FOES: ActFoes[] = [
  {
    name: 'cryptAct',
    first: ['slime'],
    early: [['rat', 'rat'], ['skeleton'], ['slime', 'rat'], ['cultist']],
    late: [['cultist', 'rat'], ['skeleton', 'cultist'], ['rat', 'rat', 'slime'], ['skeleton', 'rat'], ['slime', 'slime']],
    elites: [['graveKnight'], ['bogWitch']],
    boss: 'boneKing',
    events: ['altar', 'shrine', 'chest', 'pool'],
  },
  {
    name: 'tombsAct',
    first: ['ghoul'],
    early: [['spider', 'spider'], ['wraith'], ['ghoul'], ['spider', 'wraith']],
    late: [['mummy'], ['ghoul', 'spider'], ['wraith', 'wraith'], ['mummy', 'spider'], ['ghoul', 'wraith']],
    elites: [['gargoyle'], ['bogWitch', 'spider']],
    boss: 'hollowQueen',
    events: ['altar', 'shrine', 'chest', 'pool'],
  },
  {
    name: 'spireAct',
    first: ['boneArcher'],
    early: [['marrowBat', 'marrowBat'], ['shade'], ['boneArcher', 'marrowBat'], ['ossuary']],
    late: [['ossuary', 'shade'], ['boneArcher', 'boneArcher'], ['shade', 'marrowBat', 'marrowBat'], ['ossuary', 'boneArcher'], ['shade', 'shade']],
    elites: [['bellRinger'], ['ossuary', 'shade', 'marrowBat']],
    boss: 'marrowTyrant',
    events: ['brazier', 'reliquary', 'altar', 'pool'],
  },
];

/** The rooms of columns 1 to 5: one that is always there, and one or two more drawn from the rest. */
const COLUMN_KINDS: { must: RoomKind; extra: RoomKind[] }[] = [
  { must: 'fight', extra: ['fight', 'event'] },
  { must: 'event', extra: ['fight', 'shop'] },
  { must: 'rest', extra: ['fight', 'elite'] },
  { must: 'treasure', extra: ['fight', 'event'] },
  { must: 'shop', extra: ['elite', 'fight'] },
];

/**
 * A new map for an act, drawn with `random` (Math.random outside the daily): a lone fight (in act one, always a slime), five
 * columns of two or three rooms each, and the boss. Every column has its own kind of room that is
 * always there (an event, a campfire, a treasure chest, a merchant) and one or two drawn from a
 * few others, in random rows. Each room leads to the rooms facing it in the next column, sometimes
 * to a neighbour too, and every room can be reached. The weekly crypt's `mutators` swap campfires
 * for fights and, from the fourth column on, fights for elites, after the same draws.
 */
export function makeMap(act = 1, mutators?: Mutators): Room[] {
  const foes = ACT_FOES[act - 1];
  const rnd = (n: number) => Math.floor(random() * n);
  const bag = <T>(items: T[]) => {
    let left: T[] = [];
    return () => {
      if (left.length === 0) left = [...items];
      return left.splice(rnd(left.length), 1)[0];
    };
  };
  const early = bag(foes.early);
  const late = bag(foes.late);
  const elite = bag(foes.elites);
  const event = bag(foes.events);

  const columns: RoomKind[][] = [['fight']];
  for (const { must, extra } of COLUMN_KINDS) {
    const kinds = [must, ...extra];
    // Two rooms keep one of the extras, three keep both; then the rows are shuffled.
    if (rnd(2) === 0) kinds.splice(1 + rnd(2), 1);
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = rnd(i + 1);
      [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    columns.push(kinds);
  }
  columns.push(['boss']);
  columns.forEach((kinds, col) => {
    for (let i = 0; i < kinds.length; i++) {
      if (mutators?.noRest && kinds[i] === 'rest') kinds[i] = 'fight';
      if (mutators?.moreElites && col >= 3 && kinds[i] === 'fight') kinds[i] = 'elite';
    }
  });

  const rooms: Room[] = [];
  const index: number[][] = [];
  columns.forEach((kinds, col) => {
    index.push(
      kinds.map((kind, row) => {
        const room: Room = { kind, col, x: colX(col), y: ROWS[kinds.length][row], next: [] };
        if (col === 0) room.foes = foes.first;
        else if (kind === 'fight') room.foes = col <= 2 ? early() : late();
        else if (kind === 'elite') room.foes = elite();
        else if (kind === 'boss') room.foes = [foes.boss];
        else if (kind === 'event') room.event = event();
        rooms.push(room);
        return rooms.length - 1;
      }),
    );
  });

  // Paths: each room leads to the room facing it in the next column, now and then to a neighbour
  // of that room too, and any room left without a way in gets one from the room facing it.
  for (let col = 0; col + 1 < columns.length; col++) {
    const from = index[col];
    const to = index[col + 1];
    const facing = (i: number, n: number, m: number) => (n === 1 ? 0 : Math.round((i * (m - 1)) / (n - 1)));
    from.forEach((r, i) => {
      if (from.length === 1 || to.length === 1) {
        rooms[r].next = [...to];
        return;
      }
      const j = facing(i, from.length, to.length);
      const links = new Set([to[j]]);
      if (rnd(3) === 0) {
        const k = j + (rnd(2) ? 1 : -1);
        if (k >= 0 && k < to.length) links.add(to[k]);
      }
      rooms[r].next = [...links];
    });
    to.forEach((t, j) => {
      if (!from.some((r) => rooms[r].next.includes(t))) rooms[from[facing(j, to.length, from.length)]].next.push(t);
    });
    for (const r of from) rooms[r].next.sort((a, b) => a - b);
  }
  return rooms;
}

/** Where the hero waits before the first room. */
export const ENTRANCE = { x: 30, y: 290 };

/** The rooms the hero can walk into from `at` (null = the entrance). */
export const reachable = (rooms: Room[], at: number | null) =>
  at === null ? rooms.map((r, i) => (r.col === 0 ? i : -1)).filter((i) => i >= 0) : rooms[at].next;
