import { BOOK_FROM, type Ask } from './book';
import { FAR_NECTAR, WARDEN_STEAL, noBreeds, type Trait } from './breeds';
import { CONTRACT_GAP_MS, CONTRACT_MS, type Contract } from './contracts';
import { FAIR_MS, classesFor, fairGold, noEntries, type FairClass, type FairEntries } from './fair';
import { DEMAND, HONEY, KINDS, MARKET_MS, noJars, type Kind } from './honey';
import { CASK_MS, type Cask } from './mead';
import { MEADOWS, SUNFLOWER_COINS } from './meadows';
import { ORDER_GAP_MS, type Order } from './orders';
import { SEASONS, SEASON_MS, SUMMER_NECTAR, WINTER_EAT_MS, YEAR_MS, type Season } from './seasons';
import { ESTATE_HIVES, ORCHARD_SPRING_NECTAR, RIVERSIDE_SUMMER_RIPEN, plotOf } from './estate';
import { BUSY_NECTAR, MAX_HIVES, QUEEN_IDS, SWARM_MS, type Queen } from './swarm';
import { RARES, RARE_KINDS, noBeds, noRare, rarePairs, type Bloom, type Rare } from './garden';
import { rested, unwilted } from './tired';
import { WORKSHOP_FROM, noWares, type Commission, type Ware } from './workshop';
import { warrantBonus, type RoyalAsk } from './warrant';
import type { UpgradeId } from './upgrades';
import { WASP_GAP, WASP_STEAL_MS, type Wasp } from './wasps';

/**
 * Each hive's comb: a hex grid of 5 x 4 spots, numbered row by row from the top left. Each further
 * hive's spots follow the one before's (`SLOTS` to `2 * SLOTS - 1` for the second, and so on);
 * `hiveOf` and `localSlot` split a spot into its hive and its place on that comb.
 */
export const GRID = { cols: 5, rows: 4 };
export const SLOTS = GRID.cols * GRID.rows;
export const hiveOf = (slot: number) => Math.floor(slot / SLOTS);
export const localSlot = (slot: number) => slot % SLOTS;
/** How many drops of nectar fill a cell, and how long a full cell takes to ripen into honey. */
export const CELL_CAP = 4;
export const RIPEN_MS = 2500;
/** How long a forager's trip to the flowers and back takes, before any clover. */
export const TRIP_MS = 3000;
/** Each jar of clover honey sells for this many coins, before the market, the comb bonus and the Sunflower Ridge. */
export const HONEY_PRICE = HONEY.clover.price;
/** A new hive starts with this many bees, and its brood cells can raise it to `MAX_BEES` per hive. */
export const START_BEES = 2;
export const MAX_BEES = 12;
/** A brood cell hatches a bee this often, and costs this much more than a honey cell. */
export const BROOD_MS = 45_000;
export const BROOD_EXTRA = 30;
/** Each piece of wax pays this many coins of a new cell's price, for up to half of it. */
export const WAX_COINS = 3;
/** How many flowers the bees can fly to. */
export const FLOWERS = 6;
/**
 * Nectar gathered while the page is closed: each bee brings one drop per `AWAY_MS_PER_DROP` away,
 * up to `AWAY_CAP` drops a visit (and never more than the filling cells have room for).
 */
export const AWAY_MS_PER_DROP = 30_000;
export const AWAY_CAP = 20;

/** A honey cell: filling with one kind of nectar, ripening once full, then capped honey ready to harvest. */
export interface HoneyCell {
  type: 'honey';
  nectar: number;
  phase: 'filling' | 'ripening' | 'capped';
  /** Time left until a ripening cell is capped. */
  ripenMs: number;
  /** The nectar it holds, or null while it is empty and takes any kind. */
  kind: Kind | null;
  /** The season (`seasonNo`) its first drop came home in, for the fair's fresh class; unset while empty. */
  since?: number;
}

/** A brood cell: holds no nectar, but hatches a new bee every `BROOD_MS` while the hive has room. */
export interface BroodCell {
  type: 'brood';
  /** Time left until the next bee hatches. */
  hatchMs: number;
}

export type Cell = HoneyCell | BroodCell;

export interface Bee {
  id: number;
  /** Time left on the current trip; 0 while the bee is home. */
  tripMs: number;
  /** The whole trip's length, to know how far along it is. */
  trip: number;
  /** The flower it flies to. */
  flower: number;
  /** The nectar it is fetching. */
  kind: Kind;
  /** Whether it is away at the orchard on a contract (home, but not foraging). */
  lent: boolean;
  /**
   * The hive it belongs to: 1 for the caught swarm's bees and the ones its brood hatches, which have
   * its queen; 2 and 3 for the estate's plots, whose bees come with the plot or hatch from its brood.
   */
  hive: number;
}

export interface GameState {
  coins: number;
  /** The cell on each spot of the comb, or null where none is built yet. */
  cells: (Cell | null)[];
  bees: Bee[];
  /** Jars of honey of each kind harvested and not sold yet. */
  jars: Record<Kind, number>;
  /** Wax from the harvests, which pays part of a new cell's price. */
  wax: number;
  /** Jars sold so far, and drops of nectar that came home to a full comb. */
  sold: number;
  spilled: number;
  ranks: Record<UpgradeId, number>;
  /** How many meadows of `MEADOWS` are unlocked, in order; each goal reached unlocks the next. */
  meadows: number;
  /** Where the foragers are sent: the kind of nectar they fetch. */
  forage: Kind;
  /** Game time the market has run, which sets the kind in demand. */
  marketMs: number;
  /** Wasps raiding the hive, and the game time until the next one comes (counted once raids start). */
  wasps: Wasp[];
  waspIn: number;
  /** The village order on the card, or null between orders, and the game time until the next one. */
  order: Order | null;
  orderIn: number;
  /** Game time into the year (sets the season) and the years the hive has come through. */
  seasonMs: number;
  years: number;
  /** In winter: game time until the bees eat again. */
  eatIn: number;
  /** The mead casks in the cellar, aging or ready. */
  casks: Cask[];
  /** Hives kept (1 to `ESTATE_HIVES`); each hive's comb is the next `SLOTS` of `cells`. */
  hives: number;
  /** Game time until a crowded hive swarms; `SWARM_MS` while it is not crowded. */
  swarmIn: number;
  /** The orchard contract on the card (an offer, or bees away), or null, and the game time until the next offer. */
  contract: Contract | null;
  contractIn: number;
  /** The second hive's queen, picked when the swarm is caught; null with one hive. */
  queen: Queen | null;
  /** This year's county fair: the best entry of each class; the fairs held before it, the golds won, and whether gold has made the player Baron. */
  fair: FairEntries;
  fairs: number;
  golds: number;
  baron: boolean;
  /** How long each kind's meadow has been foraged without a break, and whether it has wilted until the season turns. */
  tired: Record<Kind, number>;
  wilted: Record<Kind, boolean>;
  /** The traits bred into the queen line (ranks), and how many fair golds still wait to breed one. */
  breeds: Record<Trait, number>;
  breedPending: number;
  /** Pieces of comb honey cut from capped cells, by kind, which only the buyer's book takes. */
  combs: Record<Kind, number>;
  /** This season's buyer's book: the towns' asks, or empty before `BOOK_FROM` jars are sold. */
  book: Ask[];
  /** The garden's beds (`BEDS`), each with its flower or empty, and the game time since its rare pairs last gave honey. */
  garden: (Bloom | null)[];
  gardenMs: number;
  /** Jars of the garden's rare honey, by kind, sold with the jars. */
  rare: Record<Rare, number>;
  /** Candles and tins of polish made in the workshop, and this season's commissions from the church and the manor. */
  wares: Record<Ware, number>;
  commissions: Commission[];
  /** Years the royal warrant has been kept in a row, and this autumn's ask from the crown (null outside autumn). */
  warrant: number;
  royal: RoyalAsk | null;
  nextId: number;
  /** Things that just happened, for the scene to animate; it empties the list as it draws them. */
  events: GameEvent[];
}

export type GameEvent =
  | { kind: 'built'; slot: number; touching: number; wax: number }
  | { kind: 'nectar'; slot: number }
  | { kind: 'capped'; slot: number }
  | { kind: 'harvested'; slot: number }
  | { kind: 'spilled'; drops: number }
  | { kind: 'sold'; jars: number; coins: number }
  | { kind: 'hatched'; slot: number; id: number }
  | { kind: 'unlocked'; meadow: number }
  | { kind: 'demand'; honey: Kind }
  | { kind: 'wasp'; id: number }
  | { kind: 'stolen'; slot: number }
  | { kind: 'swatted'; id: number }
  | { kind: 'guarded'; id: number }
  | { kind: 'order'; order: Order }
  | { kind: 'order-done'; premium: number }
  | { kind: 'order-failed' }
  | { kind: 'season'; season: Season }
  | { kind: 'year'; years: number }
  | { kind: 'ate'; what: 'jar' | 'cell' | 'bee'; slot: number | null }
  | { kind: 'casked'; honey: Kind }
  | { kind: 'mead'; cask: number }
  | { kind: 'swarm-ready' }
  | { kind: 'caught' }
  | { kind: 'swarmed'; lost: number }
  | { kind: 'contract'; contract: Contract }
  | { kind: 'lent'; bees: number; coins: number }
  | { kind: 'returned'; bees: number }
  | { kind: 'contract-lapsed' }
  | { kind: 'entered'; classes: FairClass[]; score: number }
  | { kind: 'judged'; total: number; gold: number }
  | { kind: 'fair-open' }
  | { kind: 'gold'; total: number; golds: number }
  | { kind: 'fair-closed'; total: number | null; gold: number; won: boolean }
  | { kind: 'baron' }
  | { kind: 'wilted'; honey: Kind }
  | { kind: 'plot'; hive: number }
  | { kind: 'breed-ready' }
  | { kind: 'bred'; trait: Trait; rank: number }
  | { kind: 'cut'; slot: number }
  | { kind: 'book' }
  | { kind: 'supplied'; ask: number; coins: number }
  | { kind: 'planted'; bed: number; bloom: Bloom }
  | { kind: 'bloomed'; jars: number }
  | { kind: 'made'; ware: Ware }
  | { kind: 'commissions' }
  | { kind: 'fulfilled'; ware: Ware; coins: number }
  | { kind: 'royal' }
  | { kind: 'warranted'; years: number }
  | { kind: 'warrant-lost' };

/** What is kept between visits: the comb, the coins, the jars, the wax, the bees, the upgrades and the meadows. */
export interface Progress {
  coins: number;
  cells: (Cell | null)[];
  bees: number;
  jars: Record<Kind, number>;
  wax: number;
  sold: number;
  ranks: Record<UpgradeId, number>;
  meadows: number;
  forage: Kind;
  seasonMs: number;
  /** Game time until the bees' next winter meal, so a reload can't put it off. */
  eatIn: number;
  years: number;
  casks: Cask[];
  hives: number;
  queen: Queen | null;
  /** How many bees belong to the second hive. */
  queenBees: number;
  /** How many bees belong to each hive, by hive (saves from before the estate have only `queenBees`). */
  hiveBees: number[];
  fair: FairEntries;
  fairs: number;
  golds: number;
  baron: boolean;
  tired: Record<Kind, number>;
  wilted: Record<Kind, boolean>;
  breeds: Record<Trait, number>;
  breedPending: number;
  combs: Record<Kind, number>;
  book: Ask[];
  garden: (Bloom | null)[];
  rare: Record<Rare, number>;
  wares: Record<Ware, number>;
  commissions: Commission[];
  warrant: number;
  royal: RoyalAsk | null;
  /** The orchard contract whose bees are away (paid up front), so a reload can't bring them home early; null if none. */
  lent: { bees: number; leftMs: number } | null;
  /** When the hive was last seen (`Date.now()`), for the nectar gathered while away; 0 if never. */
  seen: number;
}

export const freshProgress = (): Progress => ({
  coins: 0,
  cells: new Array(SLOTS).fill(null),
  bees: START_BEES,
  jars: noJars(),
  wax: 0,
  sold: 0,
  ranks: { baskets: 0, clover: 0, dance: 0, guards: 0 },
  meadows: 0,
  forage: 'clover',
  seasonMs: 0,
  eatIn: WINTER_EAT_MS,
  years: 0,
  casks: [],
  hives: 1,
  queen: null,
  queenBees: 0,
  hiveBees: [START_BEES],
  fair: noEntries(),
  fairs: 0,
  golds: 0,
  baron: false,
  tired: rested(),
  wilted: unwilted(),
  breeds: noBreeds(),
  breedPending: 0,
  combs: noJars(),
  book: [],
  garden: noBeds(),
  rare: noRare(),
  wares: noWares(),
  commissions: [],
  warrant: 0,
  royal: null,
  lent: null,
  seen: 0,
});

/** A new, empty honey cell. */
export const emptyCell = (): HoneyCell => ({ type: 'honey', nectar: 0, phase: 'filling', ripenMs: 0, kind: null });

/** A saved cell, checked, or null if it is not a valid one. Saves from before brood cells and honey kinds hold clover. */
function cellOf(saved: unknown): Cell | null {
  if (!saved || typeof saved !== 'object') return null;
  const c = saved as Partial<HoneyCell> & Partial<BroodCell>;
  if (c.type === 'brood') {
    const hatchMs = typeof c.hatchMs === 'number' && c.hatchMs >= 0 ? Math.min(BROOD_MS, c.hatchMs) : BROOD_MS;
    return { type: 'brood', hatchMs };
  }
  const nectar = typeof c.nectar === 'number' ? Math.max(0, Math.min(CELL_CAP, Math.floor(c.nectar))) : 0;
  let phase: HoneyCell['phase'] = c.phase === 'ripening' || c.phase === 'capped' ? c.phase : 'filling';
  let ripenMs = phase === 'ripening' && typeof c.ripenMs === 'number' ? Math.max(0, Math.min(RIPEN_MS, c.ripenMs)) : 0;
  // A full cell still marked filling has no room left, so it starts ripening.
  if (phase === 'filling' && nectar >= CELL_CAP) [phase, ripenMs] = ['ripening', RIPEN_MS];
  const full = phase === 'filling' ? nectar : CELL_CAP;
  const kind = full === 0 ? null : KINDS.includes(c.kind as Kind) ? (c.kind as Kind) : 'clover';
  const cell: HoneyCell = { type: 'honey', nectar: full, phase, ripenMs, kind };
  if (kind && typeof c.since === 'number' && c.since >= 0) cell.since = Math.floor(c.since);
  return cell;
}

export function newHive(progress: Progress): GameState {
  const hives = Math.max(1, Math.min(ESTATE_HIVES, Math.floor(progress.hives) || 1));
  const count = Math.max(1, Math.min(MAX_BEES * hives, Math.floor(progress.bees) || START_BEES));
  const meadows = Math.max(0, Math.min(MEADOWS.length, Math.floor(progress.meadows) || 0));
  const s: GameState = {
    coins: progress.coins,
    cells: new Array(SLOTS * hives).fill(null).map((_, i) => cellOf(progress.cells[i])),
    // The home hive's bees come first, then each other hive's in turn.
    bees: [...Array(count).keys()].map((i) => ({ id: i + 1, tripMs: 0, trip: 0, flower: 0, kind: 'clover', lent: false, hive: beeHive(progress, hives, count, i) })),
    jars: { ...noJars(), ...progress.jars },
    wax: progress.wax,
    sold: progress.sold,
    spilled: 0,
    ranks: { ...progress.ranks },
    meadows,
    forage: 'clover',
    marketMs: 0,
    wasps: [],
    waspIn: WASP_GAP,
    order: null,
    orderIn: ORDER_GAP_MS,
    seasonMs: Math.max(0, Math.min(YEAR_MS - 1, Math.floor(progress.seasonMs) || 0)),
    years: Math.max(0, Math.floor(progress.years) || 0),
    eatIn: Math.max(1, Math.min(WINTER_EAT_MS, Math.floor(progress.eatIn) || WINTER_EAT_MS)),
    casks: progress.casks.map((c) => ({ ...c })),
    hives,
    swarmIn: SWARM_MS,
    contract: null,
    contractIn: CONTRACT_GAP_MS,
    queen: hives > 1 && QUEEN_IDS.includes(progress.queen as Queen) ? progress.queen : null,
    fair: { ...noEntries(), ...progress.fair },
    fairs: Math.max(0, Math.floor(progress.fairs) || 0),
    golds: Math.max(0, Math.floor(progress.golds) || 0),
    baron: progress.baron,
    tired: { ...rested(), ...progress.tired },
    wilted: { ...unwilted(), ...progress.wilted },
    breeds: { ...noBreeds(), ...progress.breeds },
    breedPending: Math.max(0, Math.floor(progress.breedPending) || 0),
    combs: { ...noJars(), ...progress.combs },
    book: progress.sold >= BOOK_FROM ? progress.book.map((a) => ({ ...a })) : [],
    garden: noBeds().map((_, i) => progress.garden[i] ?? null),
    gardenMs: 0,
    rare: { ...noRare(), ...progress.rare },
    wares: { ...noWares(), ...progress.wares },
    commissions: progress.sold >= WORKSHOP_FROM ? progress.commissions.map((c) => ({ ...c })) : [],
    warrant: Math.max(0, Math.floor(progress.warrant) || 0),
    royal: progress.royal ? { ...progress.royal } : null,
    nextId: count + 1,
    events: [],
  };
  if (isOpen(s, progress.forage)) s.forage = progress.forage;
  // Entries only stand while the fair is on.
  if (!fairOn(s)) s.fair = noEntries();
  // Bees lent to the orchard stay lent until their contract ends; the farmer paid for them already.
  const lent = progress.lent && Math.min(progress.lent.bees, count - 1);
  if (progress.lent && lent && lent > 0) {
    for (const b of s.bees.slice(0, lent)) b.lent = true;
    s.contract = { bees: lent, pay: 0, phase: 'lent', leftMs: Math.max(1, Math.min(CONTRACT_MS, progress.lent.leftMs)) };
  }
  return s;
}

/** The hive of the `i`th of `count` saved bees: each hive past the first takes its count from the end, the later hives last. */
function beeHive(progress: Progress, hives: number, count: number, i: number) {
  const counts = [...Array(hives).keys()].map((h) => (h === 0 ? 0 : Math.max(0, Math.floor(progress.hiveBees[h] ?? (h === 1 ? progress.queenBees : 0)) || 0)));
  let end = count;
  for (let h = hives - 1; h >= 1; h--) {
    const from = Math.max(0, end - counts[h]);
    if (i >= from && i < end) return h;
    end = from;
  }
  return 0;
}

export const progressOf = (s: GameState): Progress => ({
  coins: s.coins,
  cells: s.cells.map((c) => (c ? { ...c } : null)),
  bees: s.bees.length,
  jars: { ...s.jars },
  wax: s.wax,
  sold: s.sold,
  ranks: { ...s.ranks },
  meadows: s.meadows,
  forage: s.forage,
  seasonMs: s.seasonMs,
  eatIn: s.eatIn,
  years: s.years,
  casks: s.casks.map((c) => ({ ...c })),
  hives: s.hives,
  queen: s.queen,
  queenBees: s.bees.filter((b) => b.hive === 1).length,
  hiveBees: [...Array(s.hives).keys()].map((h) => s.bees.filter((b) => b.hive === h).length),
  fair: { ...s.fair },
  fairs: s.fairs,
  golds: s.golds,
  baron: s.baron,
  tired: { ...s.tired },
  wilted: { ...s.wilted },
  breeds: { ...s.breeds },
  breedPending: s.breedPending,
  combs: { ...s.combs },
  book: s.book.map((a) => ({ ...a })),
  garden: [...s.garden],
  rare: { ...s.rare },
  wares: { ...s.wares },
  commissions: s.commissions.map((c) => ({ ...c })),
  warrant: s.warrant,
  royal: s.royal ? { ...s.royal } : null,
  lent: s.contract?.phase === 'lent' ? { bees: s.contract.bees, leftMs: s.contract.leftMs } : null,
  seen: Date.now(),
});

/** The season now, how long it has left, and whether the bees are shut in for winter. */
export const season = (s: GameState): Season => SEASONS[Math.floor(s.seasonMs / SEASON_MS) % SEASONS.length];
export const seasonLeft = (s: GameState) => SEASON_MS - (s.seasonMs % SEASON_MS);
export const isWinter = (s: GameState) => season(s) === 'winter';
/** The seasons since the hive began, counting the one now, so a cell's `since` can be told from this season. */
export const seasonNo = (s: GameState) => s.years * SEASONS.length + Math.floor(s.seasonMs / SEASON_MS);
/** How many bees the hives can hold: `MAX_BEES` each. */
export const maxBees = (s: GameState) => MAX_BEES * s.hives;
/** A bee at home and free to forage: not out on a trip and not lent to the orchard. */
export const atHome = (b: Bee) => b.tripMs === 0 && !b.lent;
/** Whether the hives are crowded enough to swarm: every spot built and the bees at their most, with one hive (`MAX_HIVES` is the swarm's two). */
export const crowded = (s: GameState) => s.hives < MAX_HIVES && s.bees.length >= maxBees(s) && s.cells.every((c) => c !== null);
/** What mead sells for: a kind's multiple of what its jars would sell for now. */
export const meadValue = (s: GameState, kind: Kind, jars: number, mult: number) => Math.round(jars * jarPrice(s, kind) * mult);
/** What the casks of ready mead sell for now. */
export const meadReady = (s: GameState) => s.casks.filter((c) => c.agingMs === 0);
export const cellarValue = (s: GameState) => meadReady(s).reduce((n, c) => n + c.value, 0);
/** Whether a cask is still aging, and how far along it is. */
export const caskDone = (c: Cask) => 1 - c.agingMs / CASK_MS;
/** This year's fair's points, over the classes it judges; null while a class is missing. */
export function fairTotal(s: GameState) {
  const classes = fairClasses(s);
  return classes.every((k) => s.fair[k] !== null) ? classes.reduce((n, k) => n + (s.fair[k] ?? 0), 0) : null;
}
/** The classes this year's fair judges: `classesFor` its number, and rare honey while the garden has a rare bloom. */
export const fairClasses = (s: GameState) => classesFor(s.fairs, rarePairs(s.garden).length > 0);
/** Whether the county fair is held: every meadow is open. */
export const fairOpen = (s: GameState) => s.meadows >= MEADOWS.length;
/** The summer game time the fair opens at: `FAIR_MS` before autumn. */
const FAIR_FROM = SEASONS.indexOf('autumn') * SEASON_MS - FAIR_MS;
/** Whether this year's fair is on now (the end of summer), and the game time until it opens next. */
export const fairOn = (s: GameState) => fairOpen(s) && s.seasonMs >= FAIR_FROM && season(s) === 'summer';
export const fairIn = (s: GameState) => (FAIR_FROM - s.seasonMs + YEAR_MS) % YEAR_MS;
/** Whether this year's fair is won: every class entered and gold's points reached. */
export const fairWon = (s: GameState) => (fairTotal(s) ?? -1) >= fairGold(s.fairs);

export const isHoney = (c: Cell | null): c is HoneyCell => c?.type === 'honey';
export const isBrood = (c: Cell | null): c is BroodCell => c?.type === 'brood';

/** Whether the bees can forage a kind now: its meadow is open, and the Lavender Field shuts for autumn. */
export const isOpen = (s: GameState, kind: Kind) => s.meadows >= HONEY[kind].meadows && !(kind === 'lavender' && season(s) === 'autumn');
export const openKinds = (s: GameState) => KINDS.filter((k) => isOpen(s, k));
/** Game time until a kind's meadow shuts (only lavender shuts, in autumn): 0 while shut, Infinity if it never does. */
export function openLeft(s: GameState, kind: Kind) {
  if (!isOpen(s, kind)) return 0;
  if (kind !== 'lavender') return Infinity;
  return (SEASONS.indexOf('autumn') * SEASON_MS - s.seasonMs + YEAR_MS) % YEAR_MS;
}
/** The kind the market wants now, or null while only one kind is open. Each holds for `MARKET_MS`. */
export function demand(s: GameState): Kind | null {
  const open = openKinds(s);
  if (open.length < 2) return null;
  return open[Math.floor(s.marketMs / MARKET_MS) % open.length];
}
/** Game time until the market moves on to the next kind. */
export const marketLeft = (s: GameState) => MARKET_MS - (s.marketMs % MARKET_MS);

/** How many drops each forager brings home: one, plus the baskets, plus one with the Lavender Field, plus one in summer. */
export const carry = (s: GameState) => 1 + s.ranks.baskets + (s.meadows >= 1 ? 1 : 0) + (season(s) === 'summer' ? SUMMER_NECTAR : 0);
/**
 * What one bee brings home: `carry`, one more from a Busy queen's hive, more with the Far flyers
 * bred in, more from Orchard Hollow in spring, and half of it (rounded up) from a wilted meadow.
 */
export function beeCarry(s: GameState, b: Bee) {
  const orchard = plotOf(b.hive)?.id === 'orchard' && season(s) === 'spring' ? ORCHARD_SPRING_NECTAR : 0;
  const drops = carry(s) + (b.hive === 1 && s.queen === 'busy' ? BUSY_NECTAR : 0) + s.breeds.far * FAR_NECTAR + orchard;
  return s.wilted[b.kind] ? Math.ceil(drops / 2) : drops;
}
/** How long a full cell takes to ripen: half as long once the Heather Moor is unlocked, and faster on Riverside Meadow in summer. */
export function ripenTime(s: GameState, slot = 0) {
  const base = s.meadows >= 3 ? RIPEN_MS / 2 : RIPEN_MS;
  return plotOf(hiveOf(slot))?.id === 'riverside' && season(s) === 'summer' ? base / RIVERSIDE_SUMMER_RIPEN : base;
}
/** The spots of one hive's comb. */
export const hiveSlots = (hive: number) => [...Array(SLOTS).keys()].map((i) => hive * SLOTS + i);
/** The price of the next honey cell on a hive: its first is free, then each costs more. Brood cells count as built. */
export const cellPrice = (s: GameState, hive = 0) => {
  const built = hiveSlots(hive).filter((i) => s.cells[i] !== null).length;
  return built === 0 ? 0 : Math.round(12 * Math.pow(1.25, built - 1));
};
/** The price of a brood cell: a honey cell's and `BROOD_EXTRA` more. */
export const broodPrice = (s: GameState, hive = 0) => cellPrice(s, hive) + BROOD_EXTRA;
/** How much of a price the wax pays: the pieces used and the coins still to pay. */
export function withWax(s: GameState, price: number) {
  const wax = Math.min(s.wax, Math.floor(price / 2 / WAX_COINS));
  return { wax, coins: price - wax * WAX_COINS };
}
/** Drops of a kind of nectar the comb can still take: empty cells and cells of that kind still filling. */
export const room = (s: GameState, kind: Kind = s.forage) =>
  s.cells.reduce((n, c) => n + (isHoney(c) && c.phase === 'filling' && (c.kind === null || c.kind === kind) ? CELL_CAP - c.nectar : 0), 0);
/** What a jar of a kind is worth before the market's demand: its price, the Sunflower Ridge and the comb bonus; the buyer's book prices from it. */
export const basePrice = (s: GameState, kind: Kind) => Math.round((HONEY[kind].price + (s.meadows >= 2 ? SUNFLOWER_COINS : 0) + combBonus(s)) * (1 + warrantBonus(s.warrant)));
/** How long a wasp sits on a cell before its honey is gone: longer with the Wasp wardens bred in. */
export const stealMs = (s: GameState) => WASP_STEAL_MS * (1 + WARDEN_STEAL * s.breeds.wardens);
/** Every jar on the shelf, of any kind. */
export const jarCount = (s: GameState) => KINDS.reduce((n, k) => n + s.jars[k], 0);

/** The spots next to a spot on its comb (odd rows sit half a cell to the right); combs never touch. */
export function neighbours(slot: number) {
  const base = hiveOf(slot) * SLOTS;
  const local = localSlot(slot);
  const col = local % GRID.cols;
  const row = Math.floor(local / GRID.cols);
  const out: number[] = [];
  const add = (c: number, r: number) => {
    if (c >= 0 && c < GRID.cols && r >= 0 && r < GRID.rows) out.push(base + r * GRID.cols + c);
  };
  add(col - 1, row);
  add(col + 1, row);
  const shift = row % 2 ? [0, 1] : [-1, 0];
  for (const r of [row - 1, row + 1]) for (const k of shift) add(col + k, r);
  return out;
}
/** How many built cells a spot shares an edge with. */
export const touching = (s: GameState, slot: number) => neighbours(slot).filter((n) => s.cells[n] !== null).length;
/** What a capped cell's honey scores at the fair: one point per neighbour capped with honey of its kind, up to 6. */
export function fairScore(s: GameState, slot: number) {
  const c = s.cells[slot];
  if (!isHoney(c) || c.phase !== 'capped') return 0;
  return neighbours(slot).filter((n) => {
    const o = s.cells[n];
    return isHoney(o) && o.phase === 'capped' && o.kind === c.kind;
  }).length;
}
/** Every edge two built cells share, as pairs of spots (lower spot first). Brood cells count too. */
export const sharedEdges = (s: GameState) =>
  s.cells.flatMap((c, a) => (c ? neighbours(a).filter((b) => b > a && s.cells[b] !== null).map((b) => [a, b] as const) : []));
/** The comb bonus: one coin more a jar for every edge two built cells share. */
export const combBonus = (s: GameState) => sharedEdges(s).length;
/**
 * What one jar of a kind sells for now: its price (half again while the market wants it), plus the
 * Sunflower Ridge, plus the comb bonus, all raised by the royal warrant's years.
 */
export const jarPrice = (s: GameState, kind: Kind = 'clover') =>
  Math.round((HONEY[kind].price * (demand(s) === kind ? DEMAND : 1) + (s.meadows >= 2 ? SUNFLOWER_COINS : 0) + combBonus(s)) * (1 + warrantBonus(s.warrant)));
/** What a jar of the garden's rare honey sells for: its multiple of a heather jar's worth before the market. */
export const rarePrice = (s: GameState, rare: Rare) => Math.round(basePrice(s, 'heather') * RARES[rare].mult);
/** Jars of rare honey kept, of every kind. */
export const rareCount = (s: GameState) => RARE_KINDS.reduce((n, r) => n + s.rare[r], 0);
/** What every jar on the shelf, every jar of rare honey and every cask of ready mead sells for now. */
export const shelfValue = (s: GameState) =>
  KINDS.reduce((n, k) => n + s.jars[k] * jarPrice(s, k), 0) + RARE_KINDS.reduce((n, r) => n + s.rare[r] * rarePrice(s, r), 0) + cellarValue(s);
