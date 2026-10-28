/**
 * One match: eight commanders (the player in seat 0 and seven AI rivals), their gold, levels,
 * shops, benches, boards and parts, and the rounds from 1-1 until one commander is left. Fights
 * are run by `battle.ts`; the AI's turns by `ai.ts`. The scene drives the clock (`phaseEnds`) and
 * calls `startFight`, `endFight` and `advance` as phases end.
 */
import { byDifficulty } from '../../../../shared/settings';
import type { TextKey } from '../i18n';
import {
  AUGMENTS, BENCH_SLOTS, RANKS, RARE, RARE_FROM_STAGE, BOARD, ECONOMY, GILDED, ITEM_BENCH, LEVEL_XP, MAX_ITEMS, MAX_LEVEL, PARTS, PLAYER_COMMANDERS,
  PLAYERS, RIVALS, SCRAP_TOKENS_PER_PART, SETS, SHOP_ODDS, SHOP_SLOTS, SURVIVOR_DAMAGE, TERRAIN_TILES, UNIT_BY_ID, comboOf,
  isPart, rosterOf, stageDamage, stageRounds,
  type AugmentId, type CommanderDef, type MonsterId, type OriginId, type PartId, type RoundDef, type SetId, type TerrainId,
  type TraitId,
} from './data';
import { Battle, type FighterSpec, type SideSpec } from './battle';

export interface Owned {
  uid: number;
  defId: string;
  star: number;
  items: string[];
  /** A gilded robot's second origin; gilded robots never merge. */
  gilded: OriginId | null;
}

export interface ShopSlot {
  defId: string;
  gilded: OriginId | null;
}

export interface MeterRow {
  defId: string;
  star: number;
  dealt: number;
  taken: number;
  alive: boolean;
}

/** The player's side of a fight as damage meter rows, most damage dealt first. */
export function meterOf(b: Battle): MeterRow[] {
  return b.units
    .filter((u) => u.team === 0 && u.defId)
    .map((u) => ({ defId: u.defId!, star: u.star, dealt: Math.round(u.dealt), taken: Math.round(u.taken), alive: u.alive }))
    .sort((a, b) => b.dealt - a.dealt);
}

export interface Player {
  seat: number;
  name: TextKey;
  commander: CommanderDef;
  human: boolean;
  hp: number;
  /** The health the commander started with, for the bar in the players list. */
  maxHp: number;
  gold: number;
  level: number;
  xp: number;
  /** Robots on the board by `"col,row"`, rows 4 to 7 (row 4 is the front). */
  board: Record<string, Owned>;
  bench: (Owned | null)[];
  shop: (ShopSlot | null)[];
  items: string[];
  augments: AugmentId[];
  augmentOffer: AugmentId[] | null;
  /** Wins (positive) or losses (negative) in a row. */
  streak: number;
  alive: boolean;
  /** Final place, 1 to 8, once out (or the winner). */
  place: number;
  scrapTokens: number;
  /** Free rerolls left this round (the Lucky Dice card). */
  freeRolls: number;
  /** The shop stays as it is at the next plan phase (a reroll unlocks it). */
  shopLocked: boolean;
  lastOpponent: number;
  /** The last round's outcome, for the list on the right. */
  last: 'win' | 'loss' | 'draw' | null;
}

export type Phase = 'plan' | 'fight' | 'result' | 'draft' | 'won' | 'lost';

export interface Drop {
  /** The monster whose death drops it (a battle unit id), and what it is. */
  monsterId: number;
  kind: 'item' | 'gold';
  item?: string;
  gold?: number;
  dropped: boolean;
}

export interface DraftOption {
  defId: string;
  item: string;
  takenBy: number | null;
}

export interface Draft {
  options: DraftOption[];
  order: number[];
  turn: number;
  turnEnds: number;
}

export interface MatchOptions {
  set: SetId;
  commander: number;
  terrain: boolean;
  /** The AI plays the player's seat too (`?watch`). */
  watch: boolean;
  /** The player's saved rank (`RANKS`), which toughens the rivals; 0 plays as designed. */
  rank: number;
}

export interface Match {
  opts: MatchOptions;
  players: Player[];
  stage: number;
  index: number;
  round: RoundDef;
  phase: Phase;
  /** Match time in seconds; the phase ends at `phaseEnds` (Infinity when untimed). */
  time: number;
  phaseEnds: number;
  battle: Battle | null;
  /** The player's opponent this round: a seat, or -1 for monsters. */
  opponent: number;
  /** Whether the player's opponent is a ghost copy (an odd seat out). */
  ghost: boolean;
  drops: Drop[];
  terrain: Record<string, TerrainId>;
  draft: Draft | null;
  /** A rival's call-out over the board, until `until`. */
  taunt: { seat: number; text: TextKey; until: number } | null;
  /** The last round's outcome for the player, shown in the result phase. */
  result: { outcome: 'win' | 'loss' | 'draw'; damage: number; gold: number } | null;
  /** The player's robots in their last fight, by damage dealt: the damage meter. */
  meter: MeterRow[];
  /** The next robot's `Owned.uid`. */
  nextUid: number;
  roundsPlayed: number;
}

export const ownRows = BOARD.ownRows;
const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)];
const shuffle = <T>(list: T[]) => {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
};

export function newMatch(opts: MatchOptions): Match {
  const players: Player[] = [];
  const startHp = byDifficulty(130, 100, 80);
  for (let seat = 0; seat < PLAYERS; seat++) {
    const commander = seat === 0 ? PLAYER_COMMANDERS[opts.commander] : RIVALS[seat - 1];
    players.push({
      seat, name: seat === 0 ? 'you' : commander.name, commander, human: seat === 0 && !opts.watch,
      hp: seat === 0 ? startHp : 100, maxHp: seat === 0 ? startHp : 100, gold: ECONOMY.startGold, level: 1, xp: 0, board: {}, bench: Array(BENCH_SLOTS).fill(null),
      shop: [], items: [], augments: [], augmentOffer: null, streak: 0, alive: true, place: 0, scrapTokens: 0, freeRolls: 0, shopLocked: false, lastOpponent: -1, last: null,
    });
  }
  const m: Match = {
    opts, players, stage: 1, index: 0, round: stageRounds(1)[0], phase: 'plan', time: 0, phaseEnds: Infinity, battle: null,
    opponent: -1, ghost: false, drops: [], terrain: {}, draft: null, taunt: null, result: null, meter: [], nextUid: 1, roundsPlayed: 0,
  };
  for (const p of players) rollShop(m, p);
  return m;
}

export const player = (m: Match) => m.players[0];
export const roundLabel = (m: Match) => `${m.round.stage}-${m.round.index}`;
export const unitCost = (o: { defId: string; gilded: OriginId | null }) => UNIT_BY_ID[o.defId].cost + (o.gilded ? GILDED.extraCost : 0);
export const sellValue = (o: Owned) => unitCost(o) * 3 ** (o.star - 1) - (o.star > 1 && UNIT_BY_ID[o.defId].cost > 1 ? 1 : 0);
export const boardUnits = (p: Player) => Object.values(p.board);
export const xpToNext = (p: Player) => (p.level >= MAX_LEVEL ? 0 : LEVEL_XP[p.level - 1]);

/** Distinct robots per trait on a board; a gilded robot also counts for its second origin. */
export function countTraits(units: Owned[]): Partial<Record<TraitId, number>> {
  const seen: Record<string, Set<string>> = {};
  const add = (t: TraitId, key: string) => (seen[t] ??= new Set()).add(key);
  for (const o of units) {
    const def = UNIT_BY_ID[o.defId];
    add(def.origin, def.id);
    add(def.cls, def.id);
    if (o.gilded) add(o.gilded, `${def.id}+${o.gilded}`);
  }
  return Object.fromEntries(Object.entries(seen).map(([t, s]) => [t, s.size]));
}

// ---------------------------------------------------------------- shop and economy

export function rollShop(m: Match, p: Player) {
  const roster = rosterOf(m.opts.set);
  const origins = SETS.find((s) => s.id === m.opts.set)!.origins;
  p.shop = Array.from({ length: SHOP_SLOTS }, () => {
    const odds = SHOP_ODDS[Math.min(p.level + (p.seat !== 0 ? RANKS[m.opts.rank].odds : 0), MAX_LEVEL) - 1];
    let roll = Math.random() * 100;
    let cost = 1;
    for (let c = 0; c < 5; c++) {
      if (roll < odds[c]) {
        cost = c + 1;
        break;
      }
      roll -= odds[c];
    }
    const def = pick(roster.filter((d) => d.cost === cost));
    const gildedShop = p.augments.includes('gilded-shop');
    const gilded = (gildedShop || p.level >= GILDED.fromLevel) && Math.random() < (gildedShop ? RARE.gildedChance : GILDED.chance) ? pick(origins.filter((o) => o !== def.origin)) : null;
    return { defId: def.id, gilded };
  });
}

export const rerollCost = (p: Player) => (p.freeRolls > 0 ? 0 : p.augments.includes('recycler') ? 1 : ECONOMY.rerollCost);

export function toggleShopLock(p: Player) {
  p.shopLocked = !p.shopLocked;
}

export function reroll(m: Match, p: Player): boolean {
  const cost = rerollCost(p);
  if (p.gold < cost) return false;
  p.gold -= cost;
  if (p.freeRolls > 0) p.freeRolls--;
  p.shopLocked = false;
  rollShop(m, p);
  return true;
}

export function buyXp(p: Player): boolean {
  if (p.gold < ECONOMY.xpCost || p.level >= MAX_LEVEL) return false;
  p.gold -= ECONOMY.xpCost;
  gainXp(p, ECONOMY.xpBuy);
  return true;
}

export function gainXp(p: Player, xp: number) {
  p.xp += xp;
  while (p.level < MAX_LEVEL && p.xp >= LEVEL_XP[p.level - 1]) {
    p.xp -= LEVEL_XP[p.level - 1];
    p.level++;
  }
  if (p.level >= MAX_LEVEL) p.xp = 0;
}

const freeBench = (p: Player) => p.bench.findIndex((b) => !b);

/** Whether adding a robot of `defId` would complete a set of three. */
function wouldMerge(p: Player, defId: string) {
  return allUnits(p).filter((o) => o.defId === defId && o.star === 1 && !o.gilded).length >= 2;
}

export function allUnits(p: Player): Owned[] {
  return [...boardUnits(p), ...p.bench.filter((b): b is Owned => !!b)];
}

/** Puts a new robot on the bench (merging if it makes three). Returns false if there was no room. */
export function addUnit(m: Match, p: Player, defId: string, gilded: OriginId | null, items: string[] = []): Owned | null {
  const slot = freeBench(p);
  if (slot < 0 && (gilded || !wouldMerge(p, defId))) return null;
  const owned: Owned = { uid: m.nextUid++, defId, star: 1, items: [], gilded };
  if (slot >= 0) p.bench[slot] = owned;
  else p.bench.push(owned);
  owned.items.push(...items.slice(0, MAX_ITEMS));
  merge(p, defId);
  p.bench.length = BENCH_SLOTS;
  for (let i = 0; i < BENCH_SLOTS; i++) p.bench[i] ??= null;
  return owned;
}

export function buy(m: Match, p: Player, slot: number): Owned | null {
  const s = p.shop[slot];
  if (!s) return null;
  const cost = unitCost(s);
  if (p.gold < cost) return null;
  const owned = addUnit(m, p, s.defId, s.gilded);
  if (!owned) return null;
  p.gold -= cost;
  p.shop[slot] = null;
  return owned;
}

/** Folds three copies of a robot at the same star into one a star higher, as often as it can. */
function merge(p: Player, defId: string) {
  for (let star = 1; star <= 2; star++) {
    const copies = allUnits(p).filter((o) => o.defId === defId && o.star === star && !o.gilded);
    if (copies.length < 3) continue;
    const onBoard = copies.find((o) => boardUnits(p).includes(o));
    const keep = onBoard ?? copies[0];
    const rest = copies.filter((o) => o !== keep).slice(0, 2);
    keep.star = star + 1;
    for (const o of rest) {
      for (const item of o.items) {
        if (keep.items.length < MAX_ITEMS) keep.items.push(item);
        else giveItem(p, item);
      }
      removeUnit(p, o);
    }
  }
}

export function removeUnit(p: Player, o: Owned) {
  for (const [k, v] of Object.entries(p.board)) if (v === o) delete p.board[k];
  const i = p.bench.indexOf(o);
  if (i >= 0) p.bench[i] = null;
}

export function sell(p: Player, o: Owned) {
  removeUnit(p, o);
  p.gold += sellValue(o);
  for (const item of o.items) giveItem(p, item);
}

export type Spot = { where: 'bench'; i: number } | { where: 'board'; col: number; row: number };

export function unitAt(p: Player, s: Spot): Owned | null {
  return s.where === 'bench' ? p.bench[s.i] ?? null : p.board[`${s.col},${s.row}`] ?? null;
}

export const boardCount = (p: Player) => boardUnits(p).length;

/** Moves (or swaps) the robot at `from` to `to`; the board holds at most `level` robots. */
export function moveUnit(p: Player, from: Spot, to: Spot): boolean {
  const a = unitAt(p, from);
  if (!a) return false;
  if (to.where === 'board' && !(ownRows as readonly number[]).includes(to.row)) return false;
  const b = unitAt(p, to);
  if (from.where === 'bench' && to.where === 'board' && !b && boardCount(p) >= p.level) return false;
  const put = (s: Spot, o: Owned | null) => {
    if (s.where === 'bench') p.bench[s.i] = o;
    else if (o) p.board[`${s.col},${s.row}`] = o;
    else delete p.board[`${s.col},${s.row}`];
  };
  put(from, b);
  put(to, a);
  return true;
}

/** Bolts the part or item at `index` of the item bench onto `o`; two parts make a finished item. */
/** What bolting part or item `id` onto `o` would give it: the finished item or the part itself, or null if it is full. */
export function equipPreview(id: string, o: Owned): string | null {
  const lone = o.items.find((i) => isPart(i));
  if (isPart(id) && lone) return comboOf(lone as PartId, id).id;
  return o.items.length >= MAX_ITEMS ? null : id;
}

export function equip(p: Player, index: number, o: Owned): boolean {
  const id = p.items[index];
  if (!id) return false;
  const lone = o.items.findIndex((i) => isPart(i));
  if (isPart(id) && lone >= 0) {
    o.items[lone] = comboOf(o.items[lone] as PartId, id).id;
  } else {
    if (o.items.length >= MAX_ITEMS) return false;
    o.items.push(id);
  }
  p.items.splice(index, 1);
  return true;
}

/** Puts a part or item on the player's item bench; returns false (and the item is lost) when its `ITEM_BENCH` slots are full. */
export function giveItem(p: Player, id: string): boolean {
  if (p.items.length >= ITEM_BENCH) return false;
  p.items.push(id);
  return true;
}

const randomPart = () => pick(PARTS);
const randomFinished = () => comboOf(randomPart(), randomPart()).id;

// ---------------------------------------------------------------- power cards

function offerAugments(m: Match, p: Player) {
  const left = AUGMENTS.filter((a) => !p.augments.includes(a.id));
  const rare = m.stage >= RARE_FROM_STAGE ? shuffle(left.filter((a) => a.rare))[0] : undefined;
  const common = shuffle(left.filter((a) => !a.rare)).slice(0, rare ? 2 : 3);
  p.augmentOffer = [...common, ...(rare ? [rare] : [])].map((a) => a.id);
}

export function pickAugment(m: Match, p: Player, choice: number) {
  const id = p.augmentOffer?.[choice];
  if (!id) return;
  p.augmentOffer = null;
  p.augments.push(id);
  if (id === 'spare-parts') {
    giveItem(p, randomPart());
    giveItem(p, randomPart());
  } else if (id === 'overtime') p.gold += 14;
  else if (id === 'level-up') gainXp(p, 10);
  else if (id === 'war-chest') giveItem(p, randomFinished());
  else if (id === 'free-rolls') p.freeRolls = RARE.freeRolls;
  else if (id === 'duplicator') {
    const best = allUnits(p).filter((o) => UNIT_BY_ID[o.defId].cost <= 2).sort((a, b) => b.star - a.star || UNIT_BY_ID[b.defId].cost - UNIT_BY_ID[a.defId].cost)[0];
    const defId = best?.defId ?? pick(rosterOf(m.opts.set).filter((d) => d.cost === 2)).id;
    if (!addUnit(m, p, defId, null)) p.gold += UNIT_BY_ID[defId].cost;
  }
}

// ---------------------------------------------------------------- rounds

/** Starts the plan phase of the current round: income, XP, a fresh shop, terrain and power cards. */
export function startPlan(m: Match, planS: number) {
  m.phase = 'plan';
  m.battle = null;
  m.drops = [];
  m.result = null;
  m.phaseEnds = m.time + planS;
  const first = m.roundsPlayed === 0;
  for (const p of m.players) {
    if (!p.alive) continue;
    if (!first) {
      const interestCap = ECONOMY.interestCap + (p.augments.includes('gold-rush') ? 3 : 0);
      const streak = ECONOMY.streakBonus[Math.min(Math.abs(p.streak), ECONOMY.streakBonus.length - 1)];
      // Hand to Mouth trades interest for a flat sum.
      const interest = p.augments.includes('hand-to-mouth') ? RARE.handToMouthGold : Math.min(Math.floor(p.gold / ECONOMY.interestPer), interestCap);
      p.gold += (m.stage === 1 ? ECONOMY.stageOneIncome : ECONOMY.baseIncome) + interest + streak;
      if (p.seat !== 0) p.gold = Math.max(0, p.gold + byDifficulty(-1, 0, 1) + RANKS[m.opts.rank].gold);
      gainXp(p, ECONOMY.xpPerRound);
      if (!p.shopLocked) rollShop(m, p);
    }
    p.freeRolls = p.augments.includes('free-rolls') ? RARE.freeRolls : 0;
    if (m.round.augment) offerAugments(m, p);
  }
  m.terrain = {};
  if (m.opts.terrain && m.round.kind !== 'draft') {
    const kinds: TerrainId[] = ['oil', 'charger', 'plate', 'furnace'];
    const used = new Set<string>();
    for (let i = 0; i < TERRAIN_TILES; i++) {
      let col: number;
      let row: number;
      do {
        col = Math.floor(Math.random() * BOARD.cols);
        row = 4 + Math.floor(Math.random() * 4);
      } while (used.has(`${col},${row}`));
      used.add(`${col},${row}`);
      const kind = kinds[i % kinds.length];
      m.terrain[`${col},${row}`] = kind;
      m.terrain[`${BOARD.cols - 1 - col},${7 - row}`] = kind;
    }
  }
}

/** Fills empty board places from the bench (front row first) before a fight, like a forgetful commander would want. */
export function autoFill(p: Player) {
  const order: [number, number][] = [];
  for (const row of [4, 5, 6, 7]) for (const col of [3, 4, 2, 5, 1, 6, 0, 7]) order.push([col, row]);
  for (let i = 0; i < BENCH_SLOTS && boardCount(p) < p.level; i++) {
    const o = p.bench[i];
    if (!o) continue;
    const spot = order.find(([c, r]) => !p.board[`${c},${r}`]);
    if (!spot) break;
    p.board[`${spot[0]},${spot[1]}`] = o;
    p.bench[i] = null;
  }
}

function sideOf(m: Match, p: Player, mirrored: boolean): SideSpec {
  const units = boardUnits(p);
  const fighters: FighterSpec[] = Object.entries(p.board).map(([k, o]) => {
    const [col, row] = k.split(',').map(Number);
    return { defId: o.defId, star: o.star, items: o.items, gilded: o.gilded, col: mirrored ? BOARD.cols - 1 - col : col, row: mirrored ? 7 - row : row };
  });
  return { fighters, traits: countTraits(units), augments: p.augments, skill: p.commander.skill, season: m.opts.set };
}

function monsterSide(m: Match, monsters: MonsterId[]): SideSpec {
  const spots: [number, number][] = [[3, 2], [4, 2], [2, 1], [5, 1], [3, 0], [4, 0]];
  return {
    fighters: monsters.map((id, i) => ({ monster: id, star: 1, items: [], gilded: null, col: id === 'rat' ? 3 : spots[i][0], row: id === 'rat' ? 1 : spots[i][1] })),
    traits: {}, augments: [], skill: null, season: m.opts.set,
  };
}

function terrainMap(m: Match) {
  return new Map(Object.entries(m.terrain)) as Map<string, TerrainId>;
}

/** What a neutral round's monsters drop, tied to the monsters that carry it. */
function rollDrops(m: Match, battle: Battle): Drop[] {
  const monsters = battle.alive(1);
  const drops: Drop[] = [];
  const at = (i: number) => monsters[Math.min(i, monsters.length - 1)].id;
  if (m.round.kind === 'rat') return drops;
  if (m.stage === 1) {
    drops.push({ monsterId: at(0), kind: 'item', item: randomPart(), dropped: false });
    if (m.round.index >= 2) drops.push({ monsterId: at(1), kind: 'gold', gold: 2, dropped: false });
    if (m.round.index >= 3) drops.push({ monsterId: at(2), kind: 'item', item: randomPart(), dropped: false });
  } else {
    drops.push({ monsterId: at(0), kind: 'item', item: randomFinished(), dropped: false });
    drops.push({ monsterId: at(1), kind: 'item', item: randomPart(), dropped: false });
    drops.push({ monsterId: at(2), kind: 'gold', gold: 4, dropped: false });
  }
  return drops;
}

interface Pairing {
  a: number;
  b: number;
  ghost: boolean;
  battle: Battle;
  drops: Drop[];
}

let pairings: Pairing[] = [];

/** Starts the round's fights: the player's is kept in `m.battle` to be watched, the rest run to the end now. */
export function startFight(m: Match) {
  for (const p of m.players) if (p.alive) autoFill(p);
  m.phase = 'fight';
  m.phaseEnds = Infinity;
  pairings = [];
  const alive = m.players.filter((p) => p.alive);
  if (m.round.kind === 'pvp') {
    const seats = shuffle(alive.map((p) => p.seat));
    // Try a few shuffles to avoid a rematch of the last round.
    for (let tries = 0; tries < 6; tries++) {
      let bad = false;
      for (let i = 0; i + 1 < seats.length; i += 2) if (m.players[seats[i]].lastOpponent === seats[i + 1]) bad = true;
      if (!bad) break;
      shuffle(seats);
    }
    for (let i = 0; i < seats.length; i += 2) {
      const a = seats[i];
      const ghost = i + 1 >= seats.length;
      const b = ghost ? pick(seats.filter((s) => s !== a)) : seats[i + 1];
      const battle = new Battle(sideOf(m, m.players[a], false), sideOf(m, m.players[b], true), terrainMap(m));
      pairings.push({ a, b, ghost, battle, drops: [] });
    }
  } else {
    for (const p of alive) {
      const battle = new Battle(sideOf(m, p, false), monsterSide(m, m.round.monsters!), terrainMap(m));
      pairings.push({ a: p.seat, b: -1, ghost: false, battle, drops: [] });
    }
    for (const pr of pairings) pr.drops = rollDrops(m, pr.battle);
  }
  const mine = pairings.find((pr) => pr.a === 0) ?? pairings.find((pr) => pr.b === 0 && !pr.ghost);
  // Seat 0 is out (only a headless run of the rivals gets here): every fight runs at once.
  if (!mine) {
    for (const pr of pairings) pr.battle.runToEnd();
    m.battle = null;
    m.opponent = -1;
    return;
  }
  // The player's fight is always seen from the bottom: swap the sides if the player is side 1.
  if (mine.b === 0) {
    mine.battle = new Battle(sideOf(m, m.players[0], false), sideOf(m, m.players[mine.a], true), terrainMap(m));
    [mine.a, mine.b] = [0, mine.a];
    mine.ghost = false;
  }
  m.battle = mine.battle;
  m.opponent = mine.b;
  m.ghost = mine.ghost;
  m.drops = mine.drops;
  for (const pr of pairings) if (pr !== mine) pr.battle.runToEnd();
  if (m.opponent >= 0) {
    const rival = m.players[m.opponent];
    m.taunt = { seat: rival.seat, text: pick(rival.commander.taunts.length ? rival.commander.taunts : ['tauntStart']), until: m.time + 2.5 };
  }
}

/** Marks drops whose monster has died; returns the newly dropped ones. */
export function newDrops(m: Match): Drop[] {
  const out: Drop[] = [];
  for (const d of m.drops) {
    if (d.dropped) continue;
    const mon = m.battle?.get(d.monsterId);
    if (mon && !mon.alive) {
      d.dropped = true;
      out.push(d);
    }
  }
  return out;
}

const survivorDamage = (battle: Battle, team: 0 | 1) =>
  battle.alive(team).reduce((sum, u) => sum + (u.defId ? SURVIVOR_DAMAGE[UNIT_BY_ID[u.defId].cost] : 1), 0);

/** Settles every fight of the round: damage, streaks, gold, drops, scrap tokens and knock-outs. */
export function endFight(m: Match) {
  const settle = (p: Player, won: boolean | null, damage: number, gold: number) => {
    if (won === true) p.streak = p.streak > 0 ? p.streak + 1 : 1;
    else if (won === false) p.streak = p.streak < 0 ? p.streak - 1 : -1;
    p.last = won === null ? 'draw' : won ? 'win' : 'loss';
    const dmg = Math.round(damage * (p.augments.includes('last-stand') ? 0.7 : 1));
    if (won !== true) p.hp -= dmg;
    p.gold += gold + (p.augments.includes('scrap-dividend') ? 2 : 0);
    if (won && m.opts.set === 'scrap' && m.round.kind === 'pvp') {
      p.scrapTokens++;
      if (p.scrapTokens >= SCRAP_TOKENS_PER_PART) {
        p.scrapTokens = 0;
        giveItem(p, randomPart());
      }
    }
    return dmg;
  };
  for (const pr of pairings) {
    const b = pr.battle;
    const a = m.players[pr.a];
    if (pr.b < 0) {
      for (const d of pr.drops) {
        const mon = b.get(d.monsterId);
        if (!mon || mon.alive) continue;
        if (d.kind === 'item') giveItem(a, d.item!);
        else a.gold += d.gold ?? 0;
      }
      const won = m.round.kind === 'rat' ? true : b.winner === 0;
      const dmg = settle(a, won, won ? 0 : 1 + survivorDamage(b, 1), b.gold[0]);
      if (pr.a === 0) m.result = { outcome: won ? 'win' : 'loss', damage: won ? 0 : dmg, gold: b.gold[0] };
      continue;
    }
    const other = m.players[pr.b];
    const base = stageDamage(m.stage);
    const dmgA = b.winner === 0 ? 0 : base + survivorDamage(b, 1);
    const dmgB = b.winner === 1 ? 0 : base + survivorDamage(b, 0);
    const wonA = b.winner === null ? null : b.winner === 0;
    const takenA = settle(a, wonA, dmgA, b.gold[0]);
    if (!pr.ghost) settle(other, wonA === null ? null : !wonA, dmgB, b.gold[1]);
    a.lastOpponent = pr.b;
    if (!pr.ghost) other.lastOpponent = pr.a;
    if (pr.a === 0) {
      m.result = { outcome: wonA === null ? 'draw' : wonA ? 'win' : 'loss', damage: wonA ? 0 : takenA, gold: b.gold[0] };
      const rival = other;
      if (wonA === false) m.taunt = { seat: rival.seat, text: pick(rival.commander.taunts.length ? rival.commander.taunts : ['tauntWin']), until: m.time + 3 };
    }
  }
  if (m.battle) m.meter = meterOf(m.battle);
  knockOuts(m);
  m.phase = 'result';
  m.roundsPlayed++;
}

function knockOuts(m: Match) {
  const out = m.players.filter((p) => p.alive && p.hp <= 0).sort((a, b) => a.hp - b.hp);
  for (const p of out) {
    p.alive = false;
    p.place = m.players.filter((q) => q.alive).length + 1;
  }
  const left = m.players.filter((p) => p.alive);
  if (left.length === 1) left[0].place = 1;
}

/** Whether the match is over for the player: knocked out, or the last one standing. */
export function matchOver(m: Match): 'won' | 'lost' | null {
  const me = player(m);
  // When the last commanders all fall in the same round, the best-placed of them wins.
  if (!me.alive) return me.place === 1 && !m.players.some((p) => p.alive) ? 'won' : 'lost';
  if (m.players.filter((p) => p.alive).length === 1) return 'won';
  return null;
}

/** Moves on to the next round (or stage). */
export function advance(m: Match) {
  m.index++;
  let rounds = stageRounds(m.stage);
  if (m.index >= rounds.length) {
    m.stage++;
    m.index = 0;
    rounds = stageRounds(m.stage);
  }
  m.round = rounds[m.index];
}

// ---------------------------------------------------------------- draft rounds

export function startDraft(m: Match, now: number) {
  m.phase = 'draft';
  m.phaseEnds = Infinity;
  const alive = m.players.filter((p) => p.alive);
  const roster = rosterOf(m.opts.set);
  const maxCost = Math.min(5, m.stage + (m.stage >= 3 ? 1 : 0));
  const options: DraftOption[] = Array.from({ length: alive.length + 1 }, () => {
    const def = pick(roster.filter((d) => d.cost <= Math.max(1, maxCost - 1) && d.cost >= Math.max(1, maxCost - 3)));
    return { defId: def.id, item: m.stage >= 4 && Math.random() < 0.5 ? randomFinished() : randomPart(), takenBy: null };
  });
  const order = shuffle(alive.map((p) => p.seat)).sort((a, b) => m.players[a].hp - m.players[b].hp);
  m.draft = { options, order, turn: 0, turnEnds: now + 1 };
}

export function draftPick(m: Match, seat: number, option: number): boolean {
  const d = m.draft;
  if (!d || d.order[d.turn] !== seat) return false;
  const o = d.options[option];
  if (!o || o.takenBy !== null) return false;
  o.takenBy = seat;
  const p = m.players[seat];
  if (!addUnit(m, p, o.defId, null, [o.item])) {
    p.gold += UNIT_BY_ID[o.defId].cost;
    giveItem(p, o.item);
  }
  d.turn++;
  return true;
}
