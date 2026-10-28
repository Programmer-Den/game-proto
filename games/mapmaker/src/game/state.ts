import { byDifficulty } from '../../../../shared/settings';
import type { TextKey } from '../i18n';
import type { Hand } from './hands';
import type { Island } from './island';
import type { IsleKind } from './kinds';
import type { Terrain } from './terrain';
import type { UpgradeId } from './upgrades';

/** The island grid, in tiles. */
export const GRID = { w: 15, h: 11 };
/** Supplies at the start of every voyage before Provisions; each survey costs one. */
export const BASE_SUPPLIES = byDifficulty(16, 12, 9);
/** Supplies each rank of Provisions adds. */
export const PROVISIONS_STEP = 3;
/** How much each rank of Fine Ink adds to a chart's price. */
export const INK_STEP = 0.25;
/** Coins each unused supply sells back for on Return to port, up to the chart's own tile value. */
export const SELL_BACK = 3;
/**
 * The isle completion goal: how much of the isle has been charted, in percent, pays these once
 * each, on the voyage that reaches them. The last one binds the isle into the atlas.
 */
export const MILESTONES: Milestone[] = [
  { pct: 50, coins: 20, atlas: false },
  { pct: 75, coins: 40, atlas: false },
  { pct: 100, coins: 0, atlas: true },
];

/** Supplies a shipwreck's stores add to the voyage. */
export const WRECK_SUPPLIES = 3;
/** What an artifact from a cave sells for at the port. */
export const ARTIFACT_VALUE = 15;
/** What a base camp costs in supplies, and how far (in steps along the grid) it lets you survey. */
export const CAMP_COST = 3;
export const CAMP_REACH = 2;
/** What digging a charted tile for the riddle's treasure costs, and what the treasure pays. */
export const DIG_COST = 1;
export const TREASURE_VALUE = 60;
/** What charting a whole feature (a river, a road or a wood) pays on top, for each of its tiles. */
export const FEATURE_BONUS = 2;
/** A wood counts as a feature from this many forest tiles. */
export const WOOD_MIN = 3;
/** The rival surveyor lands from this isle on, and charts one tile for every `RIVAL_PACE` surveys. */
export const RIVAL_FROM = 3;
export const RIVAL_PACE = 2;
/** How far the rival walks in one turn, through fog and charted ground alike, to reach a tile to chart. */
export const RIVAL_STEPS = 3;
/** The kinds of isle the Royal Atlas needs one page of each. */
export const ROYAL_KINDS = 4;

export interface Milestone {
  pct: number;
  coins: number;
  atlas: boolean;
}

/** A finished isle, bound into the atlas when its last tile is charted. */
export interface AtlasPage {
  island: number;
  kind: IsleKind;
  /** Voyages it took. */
  voyages: number;
  /** Tiles charted on it. */
  tiles: number;
}

/**
 * What a tile can hide, found when it is charted: a shipwreck's stores (+supplies), a cave with an
 * artifact that sells at the port, or a storm that blocks a tile near it for the rest of the voyage.
 */
export type Find = 'wreck' | 'cave' | 'storm';

export interface Tile {
  terrain: Terrain;
  revealed: boolean;
  find?: Find;
}

/**
 * The isle's treasure riddle: its clues point at one hidden tile. The ruins hold the riddle chart
 * (`known` once they are charted); digging the right charted tile finds the treasure.
 */
export interface Riddle {
  at: Point;
  clues: Clue[];
  known: boolean;
  found: boolean;
  /** True when the rival surveyor dug the treasure up first. */
  rival?: boolean;
}

/**
 * One clue of the riddle, in words by `GameScene`: so many tiles one way from a landmark ("Two tiles
 * west of a peak"), the ground the tile is ("on a meadow"), or what lies beside it ("by the water",
 * "out of sight of the sea", "beside a river").
 */
/** The ground a riddle's tile can be. */
export type Ground = 'grass' | 'forest' | 'beach' | 'hills';

export type Clue =
  | { kind: 'from'; tiles: number; dir: 'north' | 'east' | 'south' | 'west'; mark: 'mountain' | 'village' | 'ruins' | 'port' }
  | { kind: 'ground'; ground: Ground }
  | { kind: 'water' | 'inland' | 'river' };

/**
 * A buyer at the port pays a bonus for charts that show enough of one terrain: on one voyage, or
 * added up over `voyages` voyages for a bigger pay.
 */
export interface Commission {
  terrain: Terrain;
  need: number;
  bonus: number;
  voyages: number;
  /** Tiles counted on earlier voyages, and voyages left including this one. */
  done: number;
  left: number;
}

/** A river, a road or a wood: charting every tile of it pays a named bonus with that chart. */
export interface Feature {
  kind: 'river' | 'road' | 'wood';
  /** Its name, a key of `i18n/en.ts` (so a save shows in any language). */
  name: TextKey;
  tiles: Point[];
  bonus: number;
}

/**
 * The rival surveyor, on the isle from `RIVAL_FROM`: charts one tile for every `RIVAL_PACE` of yours,
 * heading for high ground and ruins. Tiles they `claims` first sell for half.
 */
export interface Rival {
  at: Point;
  claims: Point[];
  /** Surveys of yours since their last turn. */
  due: number;
  /** True once they have charted the ruins and read the riddle. */
  ruins: boolean;
}

/** What a voyage's chart sells for. */
export interface Chart {
  counts: Partial<Record<Terrain, number>>;
  /** The tiles' values added up, before Fine Ink. */
  base: number;
  /** What Fine Ink adds. */
  ink: number;
  /** The commission's bonus, if the chart meets it. */
  bonus: number;
  /** Artifacts brought back from caves, and what they sell for; the riddle's treasure, if dug up. */
  artifacts: number;
  artifactCoins: number;
  treasure: number;
  /** Features charted whole on this voyage, and what they pay together. */
  features: { name: TextKey; bonus: number }[];
  featureCoins: number;
  /** Tiles the rival charted first, and the coins they cost (half of those tiles' value). */
  rivalTiles: number;
  rivalLoss: number;
  /** Supplies left when the voyage ended, and what they sell back for (`SELL_BACK` each, capped at what the tiles pay, `base - rivalLoss`). */
  unused: number;
  sellBack: number;
  /** How many isle milestones this voyage reached, what they pay, and whether it finished the isle. */
  milestones: number;
  milestoneCoins: number;
  atlas: boolean;
  total: number;
}

/**
 * - `survey`: on the island, revealing tiles.
 * - `chart`: back at port with the voyage's chart, not sold yet.
 * - `atlas`: the chart that completed the Royal Atlas is sold; the win page is up.
 * - `harbor`: chart sold; pick a commission and a hand, buy upgrades and set sail.
 */
export type Phase = 'survey' | 'chart' | 'atlas' | 'harbor';

export interface Point {
  x: number;
  y: number;
}

export interface GameState {
  /** The island being charted, from 1; a new one comes once every tile you can reach is charted. */
  island: number;
  kind: IsleKind;
  /**
   * The seed the isle was rolled from (`makeIsland`), so a save keeps it instead of the tiles,
   * port, features and riddle. Unset on an isle loaded from a save made before seeds, which saves in full.
   */
  seed?: number;
  /** Voyages made, from 1. */
  voyage: number;
  phase: Phase;
  /** Row by row, `GRID.w` x `GRID.h`. */
  tiles: Tile[];
  port: Point;
  /** The tile the surveyor stands on. */
  surveyor: Point;
  supplies: number;
  coins: number;
  ranks: Partial<Record<UpgradeId, number>>;
  /** The tiles revealed on this voyage, in order, surveyed or seen from hills and peaks. */
  surveyed: Point[];
  commission: Commission | null;
  /** The commission board at the harbor: up to three to pick from, while no commission runs on. */
  board: Commission[];
  /** The hands offered at the harbor, and the one aboard for this voyage. */
  hands: Hand[];
  hand: Hand | null;
  /** Set on the way back to port. */
  chart: Chart | null;
  /** What the last chart sold for, shown at the harbor. */
  lastSale: number;
  /** How many of `MILESTONES` this isle has paid out. */
  milestones: number;
  /** The voyage this isle was first sailed to. */
  isleStart: number;
  /** Every isle charted to the last tile, in order. */
  atlas: AtlasPage[];
  /** Base camps on this isle: each lets the surveyor survey `CAMP_REACH` tiles out from it. */
  camps: Point[];
  /** Tiles a storm blocks until the voyage ends. */
  storms: Point[];
  /** Artifacts found on this voyage, and the treasure (in coins) dug up on it. */
  artifacts: number;
  treasure: number;
  riddle: Riddle | null;
  /** Charted tiles already dug for the treasure on this isle. */
  dug: Point[];
  /** This isle's rivers, roads and woods, each paying a bonus once charted whole. */
  features: Feature[];
  rival: Rival | null;
  /** Set once the atlas holds a page of every kind of isle: the voyage it was completed on. */
  royal: { voyage: number } | null;
  /** The next isle, rolled by the sale that charted this one in full; `setSail` lands on it. */
  next: Island | null;
}

export const rankOf = (s: GameState, id: UpgradeId) => s.ranks[id] ?? 0;
export const maxSupplies = (s: GameState) => BASE_SUPPLIES + PROVISIONS_STEP * rankOf(s, 'provisions');
export const inkBonus = (s: GameState) => INK_STEP * rankOf(s, 'ink');

export const indexOf = (x: number, y: number) => y * GRID.w + x;
export const inGrid = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID.w && y < GRID.h;
export const tileAt = (s: GameState, x: number, y: number) => (inGrid(x, y) ? s.tiles[indexOf(x, y)] : undefined);

/** The four tiles next to (x, y), in the grid. */
export function neighbours(x: number, y: number): Point[] {
  return [
    { x, y: y - 1 },
    { x: x + 1, y },
    { x, y: y + 1 },
    { x: x - 1, y },
  ].filter((p) => inGrid(p.x, p.y));
}
