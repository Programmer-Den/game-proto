import { HAND_IDS, HANDS_OFFERED, type Hand } from './hands';
import { makeIsland } from './island';
import { KINDS } from './kinds';
import {
  ARTIFACT_VALUE,
  CAMP_COST,
  CAMP_REACH,
  DIG_COST,
  GRID,
  RIVAL_FROM,
  RIVAL_PACE,
  RIVAL_STEPS,
  ROYAL_KINDS,
  TREASURE_VALUE,
  WRECK_SUPPLIES,
  indexOf,
  inkBonus,
  maxSupplies,
  MILESTONES,
  SELL_BACK,
  neighbours,
  rankOf,
  tileAt,
  type Chart,
  type Commission,
  type Feature,
  type GameState,
  type Point,
  type Rival,
  type Tile,
} from './state';
import { CHART_ORDER, TERRAIN, type Terrain } from './terrain';
import { nextCost, type UpgradeId } from './upgrades';

/** What a commission can ask for on one voyage: how many tiles of a terrain, and the bonus it pays. */
const COMMISSIONS: Omit<Commission, 'voyages' | 'done' | 'left'>[] = [
  { terrain: 'beach', need: 3, bonus: 10 },
  { terrain: 'grass', need: 3, bonus: 10 },
  { terrain: 'forest', need: 3, bonus: 12 },
  { terrain: 'hills', need: 2, bonus: 14 },
  { terrain: 'sea', need: 4, bonus: 8 },
  { terrain: 'village', need: 1, bonus: 15 },
];
/** How many commissions the board offers, and how much more a long one pays for each of its voyages. */
const BOARD_SIZE = 3;
const LONG_PAY = 1.5;

/** A new game: the first island, the first voyage under way from its port. */
export function newGame(): GameState {
  const { kind, tiles, port, riddle, features, seed } = makeIsland(1);
  const s: GameState = {
    island: 1,
    kind,
    seed,
    voyage: 1,
    phase: 'survey',
    tiles,
    port,
    surveyor: { ...port },
    supplies: 0,
    coins: 0,
    ranks: {},
    surveyed: [],
    commission: null,
    board: [],
    hands: [],
    hand: null,
    chart: null,
    lastSale: 0,
    milestones: 0,
    isleStart: 1,
    atlas: [],
    camps: [],
    storms: [],
    artifacts: 0,
    treasure: 0,
    riddle,
    dug: [],
    features,
    rival: null,
    royal: null,
    next: null,
  };
  s.supplies = maxSupplies(s);
  s.commission = rollCommission(fogged(s.tiles));
  return s;
}

const dist = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const has = (list: Point[], x: number, y: number) => list.some((p) => p.x === x && p.y === y);

/** Land, or sea beside land: the tiles that count toward the isle and that a camp can reach. */
function isChartable(s: GameState, x: number, y: number) {
  const t = tileAt(s, x, y);
  return !!t && (t.terrain !== 'sea' || neighbours(x, y).some((n) => tileAt(s, n.x, n.y)!.terrain !== 'sea'));
}

/**
 * A fogged tile can be surveyed from a charted land tile next to it (sea leads nowhere, unless a
 * Boatman is aboard), or from a base camp up to `CAMP_REACH` steps away; never while a storm sits
 * on it.
 */
export function canSurvey(s: GameState, x: number, y: number) {
  const tile = tileAt(s, x, y);
  if (!tile || tile.revealed || has(s.storms, x, y)) return false;
  const bySea = s.hand === 'boatman' && isChartable(s, x, y);
  const beside = neighbours(x, y).some((n) => {
    const t = tileAt(s, n.x, n.y)!;
    return t.revealed && (t.terrain !== 'sea' || bySea);
  });
  return beside || (isChartable(s, x, y) && s.camps.some((c) => dist(c, { x, y }) <= CAMP_REACH));
}

/** Every tile that can be surveyed now, whatever it costs. */
export function frontier(s: GameState): Point[] {
  const out: Point[] = [];
  for (let y = 0; y < GRID.h; y++) for (let x = 0; x < GRID.w; x++) if (canSurvey(s, x, y)) out.push({ x, y });
  return out;
}

/**
 * Supplies it costs to survey a tile: 2 for forests and peaks, nothing for rivers and roads. A
 * Woodsman makes forests 1, a Climber peaks 1, and a Boatman the sea free.
 */
export function costOf(s: GameState, x: number, y: number) {
  const t = tileAt(s, x, y)!.terrain;
  if (t === 'forest' && s.hand === 'woodsman') return 1;
  if (t === 'mountain' && s.hand === 'climber') return 1;
  if (t === 'sea' && s.hand === 'boatman') return 0;
  return TERRAIN[t].cost;
}

/** True while a survey can still be paid for. */
export const canAfford = (s: GameState, p: Point) => costOf(s, p.x, p.y) <= s.supplies;

/** How far and in what shape the surveyor sees from a tile, with the Spyglass and a Climber. */
export function sightOf(s: GameState, terrain: Terrain) {
  const info = TERRAIN[terrain];
  const extra = rankOf(s, 'spyglass') + (s.hand === 'climber' ? 1 : 0);
  return { range: info.sight > 0 ? info.sight + extra : 0, shape: info.shape };
}

/**
 * Surveys the fogged tile (x, y) for its cost: reveals it, walks the surveyor there (or to the
 * shore beside it, for sea), and from hills and peaks also reveals the tiles in sight for free.
 * Finds under the revealed tiles turn up at once. Every `RIVAL_PACE` surveys the rival takes a
 * turn. The voyage ends when nothing more can be done. Returns false when the tile can't be surveyed,
 * else the storms it `settled` (which may have ended the voyage, clearing `storms`) and the storm
 * finds that found no fogged tile to settle on (they `passed`).
 */
export function survey(s: GameState, x: number, y: number): { settled: Point[]; passed: Point[] } | false {
  if (s.phase !== 'survey' || !canSurvey(s, x, y) || !canAfford(s, { x, y })) return false;
  s.supplies -= costOf(s, x, y);
  const tile = tileAt(s, x, y)!;
  const storms: Point[] = [];
  reveal(s, x, y, storms);
  if (tile.terrain === 'sea' && s.hand !== 'boatman') {
    const shore = neighbours(x, y).filter((n) => {
      const t = tileAt(s, n.x, n.y)!;
      return t.revealed && t.terrain !== 'sea';
    });
    // Surveyed from a camp out of reach of the shore: the surveyor stays at the camp.
    const from = shore.length ? shore : s.camps.filter((c) => dist(c, { x, y }) <= CAMP_REACH);
    from.sort((a, b) => dist(a, s.surveyor) - dist(b, s.surveyor));
    if (from.length) s.surveyor = { ...from[0] };
  } else {
    // A Boatman rows the surveyor onto the sea tile itself.
    s.surveyor = { x, y };
  }

  const { range, shape } = sightOf(s, tile.terrain);
  for (let dy = -range; dy <= range; dy++) {
    for (let dx = -range; dx <= range; dx++) {
      const inSight = shape === 'ring' ? true : Math.abs(dx) + Math.abs(dy) <= range;
      if (inSight) reveal(s, x + dx, y + dy, storms);
    }
  }
  // Each storm settles on the nearest fogged tile within two steps, once the lookout has seen what
  // it can.
  const settled: Point[] = [];
  const passed: Point[] = [];
  for (const p of storms) {
    const near: Point[] = [];
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const q = { x: p.x + dx, y: p.y + dy };
        const t = tileAt(s, q.x, q.y);
        if (t && !t.revealed && dist(p, q) <= 2 && isChartable(s, q.x, q.y) && !has(s.storms, q.x, q.y)) near.push(q);
      }
    }
    near.sort((a, b) => dist(a, p) - dist(b, p));
    if (near.length) {
      s.storms.push(near[0]);
      settled.push(near[0]);
    } else passed.push(p);
  }

  if (s.rival && ++s.rival.due >= RIVAL_PACE) {
    s.rival.due = 0;
    rivalTurn(s);
  }
  endIfDone(s);
  return { settled, passed };
}

/**
 * Charts a tile, and turns up what it hides: stores from a wreck, an artifact, the riddle chart. A
 * storm's tile goes on `storms`, for `survey` to settle it beside.
 */
function reveal(s: GameState, x: number, y: number, storms: Point[]) {
  const tile = tileAt(s, x, y);
  if (!tile || tile.revealed) return;
  tile.revealed = true;
  s.surveyed.push({ x, y });
  if (tile.terrain === 'ruins' && s.riddle) s.riddle.known = true;
  if (tile.find === 'wreck') s.supplies += WRECK_SUPPLIES;
  if (tile.find === 'cave') s.artifacts += 1;
  if (tile.find === 'storm') storms.push({ x, y });
}

/** True while the surveyor can still survey something they can pay for, or dig for the treasure. */
export const canAct = (s: GameState) => frontier(s).some((p) => canAfford(s, p)) || diggable(s).length > 0;

function endIfDone(s: GameState) {
  if (!canAct(s)) returnToPort(s);
}

/** A base camp can go on the surveyor's tile (not the port, not twice) for `CAMP_COST` supplies. */
export function canCamp(s: GameState) {
  const t = tileAt(s, s.surveyor.x, s.surveyor.y)!;
  return s.phase === 'survey' && s.supplies >= CAMP_COST && t.terrain !== 'port' && t.terrain !== 'sea' && !has(s.camps, s.surveyor.x, s.surveyor.y);
}

/** Pitches a base camp where the surveyor stands; it lasts as long as the isle. */
export function pitchCamp(s: GameState) {
  if (!canCamp(s)) return false;
  s.supplies -= CAMP_COST;
  s.camps.push({ ...s.surveyor });
  endIfDone(s);
  return true;
}

/** The charted tiles that can still be dug for the riddle's treasure, once the riddle is known. */
export function diggable(s: GameState): Point[] {
  const r = s.riddle;
  if (s.phase !== 'survey' || !r || !r.known || r.found || s.supplies < DIG_COST) return [];
  const out: Point[] = [];
  for (let y = 0; y < GRID.h; y++) {
    for (let x = 0; x < GRID.w; x++) {
      const t = tileAt(s, x, y)!;
      if (t.revealed && t.terrain !== 'sea' && t.terrain !== 'port' && !has(s.dug, x, y)) out.push({ x, y });
    }
  }
  return out;
}

/** Digs a charted tile for `DIG_COST`: on the riddle's tile, the treasure goes on this voyage's chart. */
export function dig(s: GameState, x: number, y: number) {
  if (!has(diggable(s), x, y)) return false;
  s.supplies -= DIG_COST;
  s.dug.push({ x, y });
  s.surveyor = { x, y };
  const r = s.riddle!;
  if (r.at.x === x && r.at.y === y) {
    r.found = true;
    s.treasure += TREASURE_VALUE;
  }
  endIfDone(s);
  return true;
}

// ---- The rival surveyor.

/** True when the rival charted the tile before you did. */
export const claimed = (s: GameState, x: number, y: number) => !!s.rival && has(s.rival.claims, x, y);

/** The rival lands on the beach farthest from the port, and claims it. */
function landRival(s: GameState): Rival | null {
  if (s.island < RIVAL_FROM) return null;
  let at: Point | null = null;
  for (let y = 0; y < GRID.h; y++) {
    for (let x = 0; x < GRID.w; x++) {
      if (tileAt(s, x, y)!.terrain === 'beach' && (!at || dist({ x, y }, s.port) > dist(at, s.port))) at = { x, y };
    }
  }
  return at ? { at, claims: [at], due: 0, ruins: false } : null;
}

/**
 * The rival's turn: they head over land for the nearest tile still blank on both charts, drawn to
 * ruins, peaks and hills (and to the treasure, once they have read the riddle), walk up to
 * `RIVAL_STEPS` steps that way and chart the first blank tile they reach.
 */
function rivalTurn(s: GameState) {
  const r = s.rival!;
  const land = (p: Point) => {
    const t = tileAt(s, p.x, p.y);
    return !!t && t.terrain !== 'sea';
  };
  const blank = (p: Point) => !tileAt(s, p.x, p.y)!.revealed && !has(r.claims, p.x, p.y) && tileAt(s, p.x, p.y)!.terrain !== 'port';
  // Breadth-first over land from where the rival stands.
  const from = new Map<number, number>([[indexOf(r.at.x, r.at.y), -1]]);
  const steps = new Map<number, number>([[indexOf(r.at.x, r.at.y), 0]]);
  const queue = [r.at];
  for (let q = 0; q < queue.length; q++) {
    const p = queue[q];
    for (const n of neighbours(p.x, p.y)) {
      const j = indexOf(n.x, n.y);
      if (from.has(j) || !land(n)) continue;
      from.set(j, indexOf(p.x, p.y));
      steps.set(j, steps.get(indexOf(p.x, p.y))! + 1);
      queue.push(n);
    }
  }
  const treasure = r.ruins && s.riddle && !s.riddle.found ? s.riddle.at : null;
  let best: Point | null = null;
  let bestScore = Infinity;
  for (const p of queue) {
    const d = steps.get(indexOf(p.x, p.y))!;
    if (d === 0) continue;
    const t = tileAt(s, p.x, p.y)!.terrain;
    const digHere = treasure && treasure.x === p.x && treasure.y === p.y;
    if (!blank(p) && !digHere) continue;
    const pull = digHere ? 8 : t === 'ruins' ? 6 : t === 'mountain' ? 3 : t === 'hills' ? 2 : 0;
    const score = d - pull;
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  if (!best) return;
  const path: Point[] = [];
  for (let i = indexOf(best.x, best.y); from.get(i)! >= 0; i = from.get(i)!) path.unshift({ x: i % GRID.w, y: Math.floor(i / GRID.w) });
  for (const p of path.slice(0, RIVAL_STEPS)) {
    r.at = { ...p };
    const tile = tileAt(s, p.x, p.y)!;
    if (treasure && treasure.x === p.x && treasure.y === p.y) {
      s.riddle!.found = true;
      s.riddle!.rival = true;
      break;
    }
    if (blank(p)) {
      r.claims.push({ ...p });
      if (tile.terrain === 'ruins') r.ruins = true;
      break;
    }
  }
}

/** What a list of revealed tiles adds to the chart, before Fine Ink: a lookout's tally. */
export const valueOf = (s: GameState, tiles: Point[]) =>
  tiles.reduce((sum, p) => sum + TERRAIN[s.tiles[indexOf(p.x, p.y)].terrain].value, 0);

/**
 * Ends the voyage: the surveyor sails home and the voyage's tiles are drawn into a chart. Supplies
 * left over sell back with it (see `sellBackOf`).
 */
export function returnToPort(s: GameState) {
  if (s.phase !== 'survey') return false;
  s.chart = chartOf(s);
  s.phase = 'chart';
  s.storms = [];
  // Once this isle is charted in full (storms cleared, so they hide nothing), the next one is
  // rolled now, so the chart can tell whether a long commission carries over to it, and the sale
  // lays the board out for it.
  if (islandCharted(s)) s.next = makeIsland(s.island + 1);
  return true;
}

/** The features every tile of which is charted, the last of them on this voyage: they pay with this chart. */
export function featuresDone(s: GameState): Feature[] {
  return s.features.filter((f) => f.tiles.every((p) => tileAt(s, p.x, p.y)!.revealed) && f.tiles.some((p) => has(s.surveyed, p.x, p.y)));
}

/** The feature that charting (x, y) would finish, if any. */
export function featureAt(s: GameState, x: number, y: number): Feature | null {
  return s.features.find((f) => has(f.tiles, x, y) && f.tiles.every((p) => (p.x === x && p.y === y) || tileAt(s, p.x, p.y)!.revealed)) ?? null;
}

/** What a tile of a terrain pays as an artifact: double with a Naturalist aboard. */
export const artifactValue = (s: GameState) => ARTIFACT_VALUE * (s.hand === 'naturalist' ? 2 : 1);

/**
 * How many tiles of each terrain the voyage revealed, and what the chart sells for: the tiles (half
 * for those the rival charted first), Fine Ink, features charted whole, the commission, artifacts
 * and treasure, the unused supplies sold back and any isle milestones reached.
 */
export function chartOf(s: GameState): Chart {
  const counts: Partial<Record<Terrain, number>> = {};
  let rivalTiles = 0;
  let rivalLoss = 0;
  for (const p of s.surveyed) {
    const t = s.tiles[indexOf(p.x, p.y)].terrain;
    counts[t] = (counts[t] ?? 0) + 1;
    if (claimed(s, p.x, p.y)) {
      rivalTiles += 1;
      rivalLoss += Math.floor(TERRAIN[t].value / 2);
    }
  }
  const base = CHART_ORDER.reduce((sum, t) => sum + (counts[t] ?? 0) * TERRAIN[t].value, 0);
  const ink = Math.round((base - rivalLoss) * inkBonus(s));
  const done = featuresDone(s).map((f) => ({ name: f.name, bonus: f.bonus }));
  const featureCoins = done.reduce((sum, f) => sum + f.bonus, 0);
  const c = s.commission;
  const bonus = c && c.done + (counts[c.terrain] ?? 0) >= c.need ? c.bonus : 0;
  const unused = s.supplies;
  const sellBack = sellBackOf(s, base - rivalLoss);
  const due = milestonesDue(s);
  const milestoneCoins = due.reduce((sum, m) => sum + m.coins, 0);
  const atlas = due.some((m) => m.atlas);
  const artifactCoins = s.artifacts * artifactValue(s);
  return {
    counts,
    base,
    ink,
    bonus,
    artifacts: s.artifacts,
    artifactCoins,
    treasure: s.treasure,
    features: done,
    featureCoins,
    rivalTiles,
    rivalLoss,
    unused,
    sellBack,
    milestones: due.length,
    milestoneCoins,
    atlas,
    total: base - rivalLoss + ink + featureCoins + bonus + artifactCoins + s.treasure + sellBack + milestoneCoins,
  };
}

/**
 * What the unused supplies sell back for: `SELL_BACK` each, never more than the chart's tiles pay
 * (`worth`: their value less the rival's share).
 */
export function sellBackOf(s: GameState, worth: number) {
  return Math.min(s.supplies * SELL_BACK, worth);
}

/**
 * The tiles of this isle that can ever be charted: every land tile (the land is one patch the
 * surveyor can walk) and every sea tile beside land.
 */
export function chartable(s: GameState): Point[] {
  const out: Point[] = [];
  for (let y = 0; y < GRID.h; y++) for (let x = 0; x < GRID.w; x++) if (isChartable(s, x, y)) out.push({ x, y });
  return out;
}

/** How much of the isle is charted: tiles done, out of how many, and the whole percent (100 only when all are). */
export function isleProgress(s: GameState) {
  const all = chartable(s);
  const done = all.filter((p) => tileAt(s, p.x, p.y)!.revealed).length;
  const pct = done === all.length ? 100 : Math.min(99, Math.floor((100 * done) / all.length));
  return { done, total: all.length, pct };
}

/** The isle milestones reached but not paid yet. */
export function milestonesDue(s: GameState) {
  const { pct } = isleProgress(s);
  return MILESTONES.slice(s.milestones).filter((m) => pct >= m.pct);
}

/** The kinds of isle the atlas holds a page of; the Royal Atlas is complete with one of each. */
export const atlasKinds = (s: GameState) => new Set(s.atlas.map((p) => p.kind));
export const royalComplete = (s: GameState) => atlasKinds(s).size >= Math.min(ROYAL_KINDS, Object.keys(KINDS).length);

/**
 * Sells the chart at the port for its total and opens the harbor: a running commission carries its
 * count over or ends, the board and the hands for the next voyage are laid out, and the chart that
 * completes the Royal Atlas opens its page first.
 */
export function sellChart(s: GameState) {
  if (s.phase !== 'chart' || !s.chart) return false;
  s.coins += s.chart.total;
  s.lastSale = s.chart.total;
  s.milestones += s.chart.milestones;
  if (s.chart.atlas) s.atlas.push({ island: s.island, kind: s.kind, voyages: s.voyage - s.isleStart + 1, tiles: isleProgress(s).total });
  // A save from before the next isle was rolled at the port rolls it now.
  if (islandCharted(s)) s.next ??= makeIsland(s.island + 1);
  const c = s.commission;
  if (c) {
    if (!carriesOver(s, s.chart)) s.commission = null;
    else {
      c.done += s.chart.counts[c.terrain] ?? 0;
      c.left -= 1;
    }
  }
  s.chart = null;
  s.surveyed = [];
  s.artifacts = 0;
  s.treasure = 0;
  s.hand = null;
  s.hands = rollHands();
  const fog = fogged(s.next?.tiles ?? s.tiles);
  if (s.commission) s.board = [];
  else {
    s.board = rollBoard(fog);
    s.commission = s.board.length ? { ...s.board[0] } : null;
  }
  const royal = !s.royal && royalComplete(s);
  if (royal) s.royal = { voyage: s.voyage };
  s.phase = royal ? 'atlas' : 'harbor';
  return true;
}

/**
 * True when the running commission goes on after this chart is sold: it isn't paid, has a voyage
 * left, and on a new isle (once this one is charted in full) that isle's fog can still fill it.
 */
export function carriesOver(s: GameState, chart: Chart) {
  const c = s.commission;
  if (!c || chart.bonus > 0 || c.left <= 1) return false;
  if (!s.next) return true;
  const done = c.done + (chart.counts[c.terrain] ?? 0);
  return (fogged(s.next.tiles)[c.terrain] ?? 0) >= c.need - done;
}

/** Closes the Royal Atlas page and opens the harbor. */
export function closeAtlas(s: GameState) {
  if (s.phase !== 'atlas') return false;
  s.phase = 'harbor';
  return true;
}

/** Picks the n-th commission off the board for the coming voyage. */
export function pickCommission(s: GameState, n: number) {
  if (s.phase !== 'harbor' || !s.board[n]) return false;
  s.commission = { ...s.board[n] };
  return true;
}

/** True when the board's n-th commission is the one picked. */
export function isPicked(s: GameState, n: number) {
  const b = s.board[n];
  const c = s.commission;
  return !!b && !!c && b.terrain === c.terrain && b.need === c.need && b.voyages === c.voyages;
}

/** Takes one of the offered hands aboard for the coming voyage, or none. */
export function hire(s: GameState, hand: Hand | null) {
  if (s.phase !== 'harbor' || (hand && !s.hands.includes(hand))) return false;
  s.hand = hand;
  return true;
}

/** Buys the next rank of an upgrade at the harbor. */
export function buy(s: GameState, id: UpgradeId) {
  const cost = nextCost(id, rankOf(s, id));
  if (s.phase !== 'harbor' || cost === null || s.coins < cost) return false;
  s.coins -= cost;
  s.ranks[id] = rankOf(s, id) + 1;
  return true;
}

/** True once every tile that can be reached on this island is charted. */
export const islandCharted = (s: GameState) => frontier(s).length === 0;

/**
 * Sets out on the next voyage with full supplies, to a new island once this one is charted (the
 * one `sellChart` rolled), where the rival lands too from `RIVAL_FROM`.
 */
export function setSail(s: GameState) {
  if (s.phase !== 'harbor') return false;
  if (islandCharted(s)) {
    s.island += 1;
    const { kind, tiles, port, riddle, features, seed } = s.next ?? makeIsland(s.island);
    s.next = null;
    s.kind = kind;
    s.seed = seed;
    s.tiles = tiles;
    s.port = port;
    s.riddle = riddle;
    s.features = features;
    s.camps = [];
    s.dug = [];
    s.milestones = 0;
    s.isleStart = s.voyage + 1;
    s.rival = landRival(s);
  }
  s.voyage += 1;
  s.surveyor = { ...s.port };
  s.supplies = maxSupplies(s);
  // Only a save from before the next isle was rolled at the sale can sail with no commission the
  // fog could fill; it gets a one-voyage one, as the first voyage does.
  if (!s.commission) s.commission = rollCommission(fogged(s.tiles));
  s.phase = 'survey';
  return true;
}

/** How many tiles of each terrain the fog still hides; for sea, only sea beside land, since open sea can't be surveyed. */
function fogged(tiles: Tile[]) {
  const out: Partial<Record<Terrain, number>> = {};
  for (let y = 0; y < GRID.h; y++) {
    for (let x = 0; x < GRID.w; x++) {
      const t = tiles[indexOf(x, y)];
      if (t.revealed) continue;
      if (t.terrain === 'sea' && !neighbours(x, y).some((n) => tiles[indexOf(n.x, n.y)].terrain !== 'sea')) continue;
      out[t.terrain] = (out[t.terrain] ?? 0) + 1;
    }
  }
  return out;
}

/** Picks one commission the fogged part of the island can still fill, for one voyage. */
function rollCommission(fog: Partial<Record<Terrain, number>>): Commission | null {
  const open = COMMISSIONS.filter((c) => (fog[c.terrain] ?? 0) >= c.need);
  if (open.length === 0) return null;
  return { ...open[Math.floor(Math.random() * open.length)], voyages: 1, done: 0, left: 1 };
}

/**
 * Lays out the board: up to `BOARD_SIZE` commissions the fog can still fill, the last of them a long
 * one over two or three voyages, asking for that many times the tiles for `LONG_PAY` times the pay a
 * voyage, when the fog holds enough.
 */
function rollBoard(fog: Partial<Record<Terrain, number>>): Commission[] {
  const open = COMMISSIONS.filter((c) => (fog[c.terrain] ?? 0) >= c.need);
  for (let i = open.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [open[i], open[j]] = [open[j], open[i]];
  }
  const board = open.slice(0, BOARD_SIZE).map((c): Commission => ({ ...c, voyages: 1, done: 0, left: 1 }));
  if (board.length >= 2) {
    const last = board[board.length - 1];
    const voyages = 2 + Math.floor(Math.random() * 2);
    const need = last.need * voyages + 1;
    if ((fog[last.terrain] ?? 0) >= need) {
      board[board.length - 1] = { ...last, need, bonus: Math.round(last.bonus * voyages * LONG_PAY), voyages, left: voyages };
    }
  }
  return board;
}

/** Three of the four hands, in a fresh order, for the harbor to offer. */
function rollHands(): Hand[] {
  const ids = [...HAND_IDS];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, HANDS_OFFERED);
}
