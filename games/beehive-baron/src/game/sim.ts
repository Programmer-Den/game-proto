import { byDifficulty } from '../../../../shared/settings';
import { BOOK_FROM, CITIES, GRADES, GRADE_COUNT, GRADE_MULT, SWING, type Ask } from './book';
import { BREED_MAX, FAR_TRIP, HARDY_BEES, TRAITS, type Trait } from './breeds';
import { ESTATE_HIVES, ORCHARD_WINTER_APPETITE, PLOT_BEES, RIVERSIDE_WINTER_APPETITE, plotOf } from './estate';
import { CONTRACTS_FROM, CONTRACT_BEES, CONTRACT_COINS_PER_BEE, CONTRACT_GAP_MS, CONTRACT_MS, OFFER_MS } from './contracts';
import { MEAD_POINTS, fairGold, noEntries, type FairClass } from './fair';
import { BEDS, BED_PRICE, GARDEN_GOLDS, GARDEN_MS, RARES, RARE_CAP, RARE_KINDS, rarePairs, type Bloom } from './garden';
import { WARE, WARES, WINTER_CANDLES, WORKSHOP_FROM, type Ware } from './workshop';
import { WARRANT_GOLDS, royalAsk } from './warrant';
import { HONEY, KINDS, type Kind } from './honey';
import { REST_RATE, TIRE_MS, rested, unwilted } from './tired';
import { CASK_JARS, CASK_MS, MAX_CASKS, MEAD_MULT } from './mead';
import { MEADOWS } from './meadows';
import { ORDERS_FROM, ORDER_COINS_PER_JAR, ORDER_GAP_MS, ORDER_MIN_MS, ORDER_MS } from './orders';
import { BEES_PER_MEAL, EAT_ORDER, WINTER_EAT_MS, YEAR_MS } from './seasons';
import {
  AWAY_CAP,
  AWAY_MS_PER_DROP,
  BROOD_MS,
  CELL_CAP,
  FLOWERS,
  SLOTS,
  TRIP_MS,
  atHome,
  basePrice,
  beeCarry,
  broodPrice,
  cellPrice,
  crowded,
  demand,
  emptyCell,
  fairClasses,
  fairOn,
  fairTotal,
  fairWon,
  hiveOf,
  isBrood,
  isHoney,
  isOpen,
  isWinter,
  jarCount,
  jarPrice,
  maxBees,
  meadReady,
  meadValue,
  openKinds,
  openLeft,
  fairScore,
  rareCount,
  rarePrice,
  ripenTime,
  room,
  season,
  seasonNo,
  stealMs,
  touching,
  withWax,
  type Bee,
  type Cell,
  type GameState,
} from './state';
import { CATCH_PRICE, MAX_HIVES, SWARM_MS, type Queen } from './swarm';
import { nextPrice, type UpgradeId } from './upgrades';
import { WASPS_FROM, WASP_GAP, WASP_GAP_SPREAD, WASP_IN_MS, WASP_OUT_MS, type Wasp } from './wasps';

/** A forager's trip time with the clover planted so far, longer with the Far flyers bred in. Easier difficulties have the flowers closer. */
export const tripMs = (s: GameState) => Math.round(TRIP_MS * Math.pow(0.8, s.ranks.clover) * (1 + FAR_TRIP * s.breeds.far) * byDifficulty(0.75, 1, 1.3));

/**
 * Moves the hive on by `dt` milliseconds: the year turns, foragers fly and bring nectar home, full
 * cells ripen, brood cells hatch bees, casks age, the market moves, wasps raid, village orders and
 * orchard contracts come and go, a crowded hive swarms, the buyer's book opens, in winter the bees
 * eat, meadows tire and rest, and with the Waggle Dance bees set off by themselves.
 */
export function tick(s: GameState, dt: number) {
  // Sampled before the year turns, since a meadow that shuts or opens with the season moves the demand too.
  const wanted = demand(s);
  turn(s, dt);
  tire(s, dt);
  for (const b of s.bees) {
    if (b.tripMs <= 0) continue;
    b.tripMs = Math.max(0, b.tripMs - dt);
    if (b.tripMs === 0) deliver(s, beeCarry(s, b), b.kind);
  }
  s.cells.forEach((c, slot) => {
    if (isBrood(c)) return hatch(s, c, slot, dt);
    if (c?.phase !== 'ripening') return;
    c.ripenMs = Math.max(0, c.ripenMs - dt);
    if (c.ripenMs > 0) return;
    c.phase = 'capped';
    s.events.push({ kind: 'capped', slot });
  });
  s.marketMs += dt;
  const now = demand(s);
  if (now && now !== wanted) s.events.push({ kind: 'demand', honey: now });
  for (const [i, c] of s.casks.entries()) {
    if (c.agingMs === 0) continue;
    c.agingMs = Math.max(0, c.agingMs - dt);
    if (c.agingMs === 0) s.events.push({ kind: 'mead', cask: i });
  }
  raid(s, dt);
  orders(s, dt);
  contracts(s, dt);
  swarm(s, dt);
  // The buyer's book opens once `BOOK_FROM` jars are sold (a new season writes it again).
  if (s.sold >= BOOK_FROM && s.book.length === 0) newBook(s);
  // So do the church's and the manor's commissions, once the workshop opens.
  if (s.sold >= WORKSHOP_FROM && s.commissions.length === 0) newCommissions(s);
  garden(s, dt);
  if (s.ranks.dance > 0) dance(s);
}

/**
 * The year turns: a new season every `SEASON_MS` (which rests every meadow), the fair opens at the
 * end of summer and is judged as autumn comes, and in winter the bees eat. The foragers leave a
 * meadow that shuts.
 */
function turn(s: GameState, dt: number) {
  const before = season(s);
  const fair = fairOn(s);
  s.seasonMs += dt;
  if (s.seasonMs >= YEAR_MS) {
    s.seasonMs -= YEAR_MS;
    s.years++;
    s.events.push({ kind: 'year', years: s.years });
  }
  const now = season(s);
  if (now !== before) {
    s.events.push({ kind: 'season', season: now });
    s.eatIn = WINTER_EAT_MS;
    s.tired = rested();
    s.wilted = unwilted();
    // The towns write new asks into the buyer's book, at the new season's prices.
    if (s.sold >= BOOK_FROM) newBook(s);
    if (s.sold >= WORKSHOP_FROM) newCommissions(s);
    royal(s, now);
  }
  if (!fair && fairOn(s)) openFair(s);
  if (fair && !fairOn(s)) closeFair(s);
  if (!isOpen(s, s.forage)) s.forage = 'clover';
  if (now !== 'winter') return;
  s.eatIn -= dt;
  if (s.eatIn > 0) return;
  s.eatIn = WINTER_EAT_MS;
  // One meal for every `BEES_PER_MEAL` bees (at least one, and more bees a meal when Frost-hardy is
  // bred in), so a big hive needs a big larder; bees that eat less or more are counted apart.
  const perMeal = BEES_PER_MEAL + HARDY_BEES * s.breeds.hardy;
  const groups = new Map<number, number>();
  for (const b of s.bees) groups.set(appetite(s, b), (groups.get(appetite(s, b)) ?? 0) + 1);
  let meals = 0;
  for (const [share, bees] of groups) meals += Math.ceil((bees * share) / perMeal);
  for (let n = Math.max(1, meals); n > 0; n--) eat(s);
}

/** How much a bee eats in winter: half for a Hardy queen's bees and Riverside Meadow's, double for Orchard Hollow's. */
function appetite(s: GameState, b: Bee) {
  if (b.hive === 1 && s.queen === 'hardy') return 0.5;
  const plot = plotOf(b.hive)?.id;
  return plot === 'orchard' ? ORCHARD_WINTER_APPETITE : plot === 'riverside' ? RIVERSIDE_WINTER_APPETITE : 1;
}

/**
 * Meadows tire while the bees have another kind to go for: each kind's strain grows while a bee is
 * out on it and falls `REST_RATE` times as fast while none is, and at `TIRE_MS` the meadow wilts
 * until the season turns.
 */
function tire(s: GameState, dt: number) {
  const rotate = openKinds(s).length > 1;
  for (const k of KINDS) {
    if (s.wilted[k]) continue;
    const busy = rotate && s.bees.some((b) => b.tripMs > 0 && b.kind === k);
    s.tired[k] = busy ? s.tired[k] + dt : Math.max(0, s.tired[k] - dt * REST_RATE);
    if (s.tired[k] < TIRE_MS) continue;
    s.tired[k] = 0;
    s.wilted[k] = true;
    s.events.push({ kind: 'wilted', honey: k });
  }
}

/** The bees eat: a jar of the cheapest kind on the shelf, else the honey of a capped cell, else a bee starves (the last one never). */
function eat(s: GameState) {
  const jar = EAT_ORDER.find((k) => s.jars[k] > 0);
  if (jar) {
    s.jars[jar]--;
    return s.events.push({ kind: 'ate', what: 'jar', slot: null });
  }
  const slot = s.cells.findIndex((c) => isHoney(c) && c.phase === 'capped');
  if (slot >= 0) {
    s.cells[slot] = emptyCell();
    return s.events.push({ kind: 'ate', what: 'cell', slot });
  }
  if (s.bees.length <= 1) return;
  // Bees at home starve first, then foragers out, and bees lent to the orchard last.
  const gone = [...s.bees].sort((a, b) => busy(a) - busy(b))[0];
  s.bees = s.bees.filter((b) => b !== gone);
  recountLent(s);
  s.events.push({ kind: 'ate', what: 'bee', slot: null });
}

/** How busy a bee is: 2 lent to the orchard, 1 out foraging, 0 at home. */
const busy = (b: Bee) => (b.lent ? 2 : atHome(b) ? 0 : 1);

/** A contract's bee count follows its lent bees when some are lost, and a contract with none left ends. */
function recountLent(s: GameState) {
  const c = s.contract;
  if (c?.phase !== 'lent') return;
  c.bees = s.bees.filter((b) => b.lent).length;
  if (c.bees > 0) return;
  s.contract = null;
  s.contractIn = CONTRACT_GAP_MS;
}

/** A brood cell counts down to its next bee while the hive has room for one; brood rests in winter. */
function hatch(s: GameState, c: Extract<Cell, { type: 'brood' }>, slot: number, dt: number) {
  if (s.bees.length >= maxBees(s) || isWinter(s)) return;
  c.hatchMs = Math.max(0, c.hatchMs - dt);
  if (c.hatchMs > 0) return;
  c.hatchMs = BROOD_MS;
  const id = s.nextId++;
  s.bees.push({ id, tripMs: 0, trip: 0, flower: 0, kind: s.forage, lent: false, hive: hiveOf(slot) });
  s.events.push({ kind: 'hatched', slot, id });
}

/** A forager is home: its drops go into the empty cells and the cells of its kind in turn, and what doesn't fit is lost. */
function deliver(s: GameState, drops: number, kind: Kind) {
  for (let slot = 0; slot < s.cells.length && drops > 0; slot++) {
    const c = s.cells[slot];
    if (!isHoney(c) || c.phase !== 'filling' || (c.kind !== null && c.kind !== kind)) continue;
    const take = Math.min(drops, CELL_CAP - c.nectar);
    if (c.nectar === 0) c.since = seasonNo(s);
    c.nectar += take;
    c.kind = kind;
    drops -= take;
    s.events.push({ kind: 'nectar', slot });
    if (c.nectar === CELL_CAP) {
      c.phase = 'ripening';
      c.ripenMs = ripenTime(s, slot);
    }
  }
  if (drops > 0) {
    s.spilled += drops;
    s.events.push({ kind: 'spilled', drops });
  }
}

/** Pays for a new cell, with wax first, and puts it on the spot. */
function place(s: GameState, slot: number, price: number, cell: Cell) {
  // Also refuses a slot off the comb, which reads as undefined.
  if (s.cells[slot] !== null) return false;
  const pay = withWax(s, price);
  if (s.coins < pay.coins) return false;
  s.coins -= pay.coins;
  s.wax -= pay.wax;
  s.cells[slot] = cell;
  s.events.push({ kind: 'built', slot, touching: touching(s, slot), wax: pay.wax });
  return true;
}

/** Builds a honey cell on an empty spot, if there are coins (and wax) enough; a hive's first is free. */
export const build = (s: GameState, slot: number) => place(s, slot, cellPrice(s, hiveOf(slot)), emptyCell());

/** Builds a brood cell on an empty spot, which hatches a bee every `BROOD_MS`. */
export const buildBrood = (s: GameState, slot: number) => place(s, slot, broodPrice(s, hiveOf(slot)), { type: 'brood', hatchMs: BROOD_MS });

/** Whether there are coins and wax enough for a cell at this price. */
export const canPay = (s: GameState, price: number) => s.coins >= withWax(s, price).coins;

/** Sends every bee at home out for the nectar they forage now, if the comb has room for it. In winter they stay in. */
export function send(s: GameState) {
  if (room(s) === 0 || isWinter(s)) return false;
  const home = s.bees.filter(atHome);
  if (home.length === 0) return false;
  for (const b of home) fly(s, b);
  return true;
}

/**
 * The Waggle Dance: bees at home set off by themselves, but only as many as the comb has room for
 * beyond what the foragers out already carry, and while the farmer's offer stands enough of them
 * stay home to take it. In winter they stay in.
 */
function dance(s: GameState) {
  if (isWinter(s)) return;
  let free = room(s) - s.bees.reduce((n, b) => n + (b.tripMs > 0 ? beeCarry(s, b) : 0), 0);
  const stay = s.contract?.phase === 'offer' ? s.contract.bees : 0;
  for (const b of s.bees.filter(atHome).slice(stay)) {
    if (free <= 0) return;
    fly(s, b);
    free -= beeCarry(s, b);
  }
}

/** One bee sets off for the nectar the hive forages now, to a flower picked at random. */
function fly(s: GameState, b: Bee) {
  const trip = tripMs(s);
  b.trip = trip;
  b.tripMs = trip;
  b.kind = s.forage;
  b.flower = Math.floor(Math.random() * FLOWERS);
}

/** Chooses where the foragers go next: a kind whose meadow is open. Bees already out finish their trip. */
export function forage(s: GameState, kind: Kind) {
  if (!isOpen(s, kind) || s.forage === kind) return false;
  s.forage = kind;
  return true;
}

/** Takes the honey out of a capped cell into a jar of its kind, plus a piece of wax; the cell starts filling again. */
export function harvest(s: GameState, slot: number) {
  const c = s.cells[slot];
  if (!isHoney(c) || c.phase !== 'capped') return false;
  s.jars[c.kind ?? 'clover']++;
  s.wax++;
  s.cells[slot] = emptyCell();
  s.events.push({ kind: 'harvested', slot });
  return true;
}

/**
 * Sells every jar of honey at its kind's `jarPrice`, fills the village order if it now has its jars,
 * and unlocks each meadow whose goal that reaches.
 */
export function sell(s: GameState) {
  const fair = fairOn(s);
  const mead = meadReady(s);
  const jars = jarCount(s) + rareCount(s) + mead.length * CASK_JARS;
  if (jars === 0) return false;
  // A meadow this sale unlocks opens a kind, which can start or move the demand between two ticks.
  const wanted = demand(s);
  let coins = 0;
  for (const k of Object.keys(s.jars) as Kind[]) coins += s.jars[k] * jarPrice(s, k);
  for (const r of RARE_KINDS) coins += s.rare[r] * rarePrice(s, r);
  for (const c of mead) coins += c.value;
  for (const r of RARE_KINDS) s.rare[r] = 0;
  s.casks = s.casks.filter((c) => c.agingMs > 0);
  s.events.push({ kind: 'sold', jars, coins });
  s.coins += coins;
  s.sold += jars;
  const o = s.order;
  if (o) {
    o.done = Math.min(o.count, o.done + s.jars[o.kind]);
    if (o.done >= o.count) {
      s.coins += o.premium;
      s.events.push({ kind: 'order-done', premium: o.premium });
      s.order = null;
      s.orderIn = ORDER_GAP_MS;
    }
  }
  for (const k of Object.keys(s.jars) as Kind[]) s.jars[k] = 0;
  afterSale(s, wanted, fair);
  return true;
}

/**
 * After jars are sold: each meadow whose goal the new `sold` reaches unlocks, and the market and
 * the fair follow it.
 */
function afterSale(s: GameState, wanted: Kind | null, fair: boolean) {
  while (s.meadows < MEADOWS.length && s.sold >= MEADOWS[s.meadows].need) {
    s.events.push({ kind: 'unlocked', meadow: s.meadows });
    s.meadows++;
  }
  const now = demand(s);
  if (now && now !== wanted) s.events.push({ kind: 'demand', honey: now });
  // The meadow that opens the fair can come during its last minute of summer, between two ticks.
  if (!fair && fairOn(s)) openFair(s);
}

/**
 * The nectar the bees gathered while the page was closed for `awayMs`: one drop per bee not lent
 * to the orchard per `AWAY_MS_PER_DROP`, at most `AWAY_CAP` and never more than the comb has room
 * for, delivered into the filling cells like a forager's, of the kind they forage. Returns the drops added.
 */
export function gatherAway(s: GameState, awayMs: number) {
  if (!(awayMs > 0) || isWinter(s)) return 0;
  const foragers = s.bees.filter((b) => !b.lent).length;
  const drops = Math.min(AWAY_CAP, room(s), Math.floor((awayMs * foragers) / AWAY_MS_PER_DROP));
  if (drops > 0) deliver(s, drops, s.forage);
  return drops;
}

/** Buys the next rank of an upgrade, if there are coins enough and ranks left. */
export function buy(s: GameState, id: UpgradeId) {
  const price = nextPrice(id, s.ranks[id]);
  if (price === null || s.coins < price) return false;
  s.coins -= price;
  s.ranks[id]++;
  return true;
}

const capped = (s: GameState) => s.cells.flatMap((c, slot) => (isHoney(c) && c.phase === 'capped' ? [slot] : []));

/**
 * Wasp raids, once the hive has sold `WASPS_FROM` jars: every so often a wasp flies in to a capped
 * cell, sits on it for `WASP_STEAL_MS` and flies off with its honey. Guard Bees drive it off as it
 * lands; a wasp whose cell is harvested first leaves empty-handed.
 */
function raid(s: GameState, dt: number) {
  for (const w of s.wasps) {
    w.ms += dt;
    const target = s.cells[w.slot];
    const ready = isHoney(target) && target.phase === 'capped';
    if (w.phase === 'in') {
      if (!ready) leave(w, Math.min(1, w.ms / WASP_IN_MS));
      else if (w.ms >= WASP_IN_MS) {
        if (s.ranks.guards > 0) {
          leave(w, 1);
          s.events.push({ kind: 'guarded', id: w.id });
        } else [w.phase, w.ms] = ['steal', 0];
      }
    } else if (w.phase === 'steal') {
      if (!ready) leave(w, 1);
      else if (w.ms >= stealMs(s)) {
        s.cells[w.slot] = emptyCell();
        s.events.push({ kind: 'stolen', slot: w.slot });
        leave(w, 1);
      }
    }
  }
  s.wasps = s.wasps.filter((w) => w.phase !== 'out' || w.ms < WASP_OUT_MS);

  if (s.sold < WASPS_FROM) return;
  // A Gentle queen's comb is left alone.
  const targets = capped(s).filter((slot) => !(s.queen === 'gentle' && hiveOf(slot) === 1));
  if (targets.length === 0 || s.wasps.some((w) => w.phase !== 'out')) return;
  s.waspIn -= dt;
  if (s.waspIn > 0) return;
  s.waspIn = WASP_GAP + Math.random() * WASP_GAP_SPREAD;
  const wasp: Wasp = { id: s.nextId++, slot: targets[Math.floor(Math.random() * targets.length)], phase: 'in', ms: 0, turned: 0 };
  s.wasps.push(wasp);
  s.events.push({ kind: 'wasp', id: wasp.id });
}

function leave(w: Wasp, turned: number) {
  w.phase = 'out';
  w.ms = 0;
  w.turned = turned;
}

/** A tap on a wasp chases it off before it steals anything. */
export function swat(s: GameState, id: number) {
  const w = s.wasps.find((w) => w.id === id);
  if (!w || w.phase === 'out') return false;
  leave(w, w.phase === 'in' ? Math.min(1, w.ms / WASP_IN_MS) : 1);
  s.events.push({ kind: 'swatted', id });
  return true;
}

/**
 * Village orders, once the hive has sold `ORDERS_FROM` jars: a new one comes `ORDER_GAP_MS` after
 * the last ended, for 3 to 5 jars of an open kind, and lapses after `ORDER_MS`. `sell` fills it.
 */
function orders(s: GameState, dt: number) {
  const o = s.order;
  if (o) {
    o.leftMs = Math.max(0, o.leftMs - dt);
    if (o.leftMs > 0) return;
    s.order = null;
    s.orderIn = ORDER_GAP_MS;
    s.events.push({ kind: 'order-failed' });
    return;
  }
  if (s.sold < ORDERS_FROM) return;
  s.orderIn -= dt;
  if (s.orderIn > 0) return;
  // Only kinds whose meadow stays open long enough to forage for the order; it lapses when its meadow shuts.
  const open = openKinds(s).filter((k) => openLeft(s, k) >= ORDER_MIN_MS);
  const kind = open[Math.floor(Math.random() * open.length)];
  const count = 3 + Math.floor(Math.random() * 3);
  s.order = { kind, count, done: 0, leftMs: Math.min(ORDER_MS, openLeft(s, kind)), premium: count * ORDER_COINS_PER_JAR };
  s.events.push({ kind: 'order', order: s.order });
}


/** The kind a cask would take now: the kind with the most jars (the dearest on a tie), or null with none to spare. */
export function caskKind(s: GameState): Kind | null {
  if (s.casks.length >= MAX_CASKS) return null;
  const best = [...KINDS].reverse().sort((a, b) => s.jars[b] - s.jars[a])[0];
  return s.jars[best] >= CASK_JARS ? best : null;
}

/** Puts `CASK_JARS` jars of one kind into a cask to age into mead, worth `MEAD_MULT` times what they would sell for now. */
export function cask(s: GameState) {
  const kind = caskKind(s);
  if (!kind) return false;
  s.casks.push({ kind, agingMs: CASK_MS, value: meadValue(s, kind, CASK_JARS, MEAD_MULT[kind]) });
  s.jars[kind] -= CASK_JARS;
  s.events.push({ kind: 'casked', honey: kind });
  return true;
}

/**
 * A crowded hive (every spot built, the bees at their most, one hive) gets ready to swarm, and
 * `SWARM_MS` later half its bees leave unless the swarm is caught into a second hive first.
 */
function swarm(s: GameState, dt: number) {
  if (!crowded(s)) {
    s.swarmIn = SWARM_MS;
    return;
  }
  if (s.swarmIn === SWARM_MS && dt > 0) s.events.push({ kind: 'swarm-ready' });
  s.swarmIn = Math.max(0, s.swarmIn - dt);
  if (s.swarmIn > 0) return;
  s.swarmIn = SWARM_MS;
  const keep = Math.ceil(s.bees.length / 2);
  // The bees at home leave first; bees lent and then foragers out finish what they do.
  const stay = [...s.bees].sort((a, b) => busy(b) - busy(a)).slice(0, keep);
  const lost = s.bees.length - keep;
  s.bees = s.bees.filter((b) => stay.includes(b));
  recountLent(s);
  s.events.push({ kind: 'swarmed', lost });
}

/**
 * Pays `CATCH_PRICE` to catch the swarm into a second hive with its own, empty comb and the queen
 * picked: the half of the bees that would have left (those at home first) move in with her.
 */
export function catchSwarm(s: GameState, queen: Queen) {
  if (!crowded(s) || s.hives >= MAX_HIVES || s.coins < CATCH_PRICE) return false;
  s.coins -= CATCH_PRICE;
  s.hives++;
  s.queen = queen;
  const swarm = [...s.bees].sort((a, b) => Number(atHome(b)) - Number(atHome(a))).slice(0, Math.floor(s.bees.length / 2));
  for (const b of swarm) b.hive = 1;
  s.cells.push(...new Array<null>(SLOTS).fill(null));
  s.swarmIn = SWARM_MS;
  s.events.push({ kind: 'caught' });
  return true;
}

/**
 * Orchard contracts, once the hive has sold `CONTRACTS_FROM` jars: a farmer offers to borrow 2 to
 * 6 bees (never the last one) for `CONTRACT_MS`, and the offer stands for `OFFER_MS`. No offers
 * come in winter. `acceptContract` takes it; the bees come home when it ends.
 */
function contracts(s: GameState, dt: number) {
  const c = s.contract;
  if (c) {
    c.leftMs = Math.max(0, c.leftMs - dt);
    if (c.leftMs > 0) return;
    s.contract = null;
    s.contractIn = CONTRACT_GAP_MS;
    if (c.phase === 'offer') return s.events.push({ kind: 'contract-lapsed' });
    for (const b of s.bees) b.lent = false;
    s.events.push({ kind: 'returned', bees: c.bees });
    return;
  }
  if (s.sold < CONTRACTS_FROM || isWinter(s) || s.bees.length <= CONTRACT_BEES.min) return;
  s.contractIn -= dt;
  if (s.contractIn > 0) return;
  const most = Math.min(CONTRACT_BEES.max, s.bees.length - 1);
  const bees = CONTRACT_BEES.min + Math.floor(Math.random() * (most - CONTRACT_BEES.min + 1));
  s.contract = { bees, pay: bees * CONTRACT_COINS_PER_BEE, phase: 'offer', leftMs: OFFER_MS };
  s.events.push({ kind: 'contract', contract: s.contract });
}

/** Takes the orchard's offer: that many bees at home go to the orchard for `CONTRACT_MS`, paid up front. */
export function acceptContract(s: GameState) {
  const c = s.contract;
  if (!c || c.phase !== 'offer') return false;
  const home = s.bees.filter(atHome);
  if (home.length < c.bees) return false;
  for (const b of home.slice(0, c.bees)) b.lent = true;
  c.phase = 'lent';
  c.leftMs = CONTRACT_MS;
  s.coins += c.pay;
  s.events.push({ kind: 'lent', bees: c.bees, coins: c.pay });
  return true;
}

/**
 * Enters a capped cell's honey in this year's fair (on at the end of every summer once every
 * meadow is open): it scores its neighbours capped with honey of its kind (`fairScore`) and counts
 * for its kind's class, and for the fresh class too if its first drop came home this season, each
 * replacing a lower entry. The cell gives its wax and starts over.
 */
export function enterFair(s: GameState, slot: number) {
  const c = s.cells[slot];
  if (!fairOn(s) || fairWon(s) || !isHoney(c) || c.phase !== 'capped') return false;
  const honey = c.kind ?? 'clover';
  const fresh = fairClasses(s).includes('fresh') && c.since === seasonNo(s);
  const score = fairScore(s, slot);
  s.wax++;
  s.cells[slot] = emptyCell();
  enter(s, fresh ? [honey, 'fresh'] : [honey], score);
  return true;
}

/** Enters a cask of ready mead in the fair (from the second fair on): it scores `MEAD_POINTS` for its honey. */
export function enterMead(s: GameState, i: number) {
  const c = s.casks[i];
  if (!fairOn(s) || fairWon(s) || !fairClasses(s).includes('mead') || !c || c.agingMs > 0) return false;
  s.casks.splice(i, 1);
  enter(s, ['mead'], MEAD_POINTS[c.kind]);
  return true;
}

/** Keeps an entry's points for its classes, then judges: with every class in, gold's points win gold (and the first gold makes the Baron). */
function enter(s: GameState, classes: FairClass[], score: number) {
  for (const k of classes) s.fair[k] = Math.max(s.fair[k] ?? -1, score);
  s.events.push({ kind: 'entered', classes, score });
  const total = fairTotal(s);
  if (total === null) return;
  const gold = fairGold(s.fairs);
  if (total < gold) return s.events.push({ kind: 'judged', total, gold });
  s.golds++;
  s.events.push({ kind: 'gold', total, golds: s.golds });
  // Every gold breeds a trait into the queen line, while one is left to breed.
  if (s.breedPending < TRAITS.reduce((n, k) => n + BREED_MAX - s.breeds[k], 0)) {
    s.breedPending++;
    s.events.push({ kind: 'breed-ready' });
  }
  if (s.baron) return;
  s.baron = true;
  s.events.push({ kind: 'baron' });
}

/** The fair opens: its classes are held for its minute, rare honey among them if the garden has a rare bloom now. */
function openFair(s: GameState) {
  s.fairRare = rarePairs(s.garden).length > 0;
  s.events.push({ kind: 'fair-open' });
}

/** Autumn closes the fair: its result over the classes it held is told, the next fair asks for more, and the entries are cleared. */
function closeFair(s: GameState) {
  s.events.push({ kind: 'fair-closed', total: fairTotal(s, true), gold: fairGold(s.fairs), won: fairWon(s, true) });
  s.fairs++;
  s.fair = noEntries();
}

/**
 * Buys the estate's next plot, once the fair's first gold is won and the swarm is caught: a hive
 * with its own, empty comb and `PLOT_BEES` bees of its own, on a plot with its own season quirks.
 */
export function buyPlot(s: GameState) {
  const plot = plotOf(s.hives);
  if (!plot || s.golds < 1 || s.hives < MAX_HIVES || s.hives >= ESTATE_HIVES || s.coins < plot.price) return false;
  s.coins -= plot.price;
  const hive = s.hives++;
  s.cells.push(...new Array<null>(SLOTS).fill(null));
  for (let n = 0; n < PLOT_BEES; n++) s.bees.push({ id: s.nextId++, tripMs: 0, trip: 0, flower: 0, kind: s.forage, lent: false, hive });
  s.events.push({ kind: 'plot', hive });
  return true;
}

/** Breeds a trait into the queen line with a fair gold waiting to be spent: one more rank, up to `BREED_MAX`. */
export function breed(s: GameState, trait: Trait) {
  if (s.breedPending <= 0 || s.breeds[trait] >= BREED_MAX) return false;
  s.breeds[trait]++;
  s.breedPending--;
  s.events.push({ kind: 'bred', trait, rank: s.breeds[trait] });
  return true;
}

/** Cuts a capped cell's honey out as a piece of comb honey of its kind: no jar and no wax, for the buyer's book. */
export function cutComb(s: GameState, slot: number) {
  const c = s.cells[slot];
  if (s.book.length === 0 || !isHoney(c) || c.phase !== 'capped') return false;
  s.combs[c.kind ?? 'clover']++;
  s.cells[slot] = emptyCell();
  s.events.push({ kind: 'cut', slot });
  return true;
}

/** Whether there are goods enough on hand for an ask: any jars for mixed, jars of its kind for pure, comb of its kind for comb. */
export function canSupply(s: GameState, a: Ask) {
  if (a.done) return false;
  if (a.grade === 'mixed') return jarCount(s) >= a.count;
  return (a.grade === 'pure' ? s.jars[a.kind] : s.combs[a.kind]) >= a.count;
}

/** Supplies an ask in the buyer's book: its goods go (mixed takes the cheapest jars first), it pays its price for each, and they count as sold. */
export function supply(s: GameState, i: number) {
  const a = s.book[i];
  if (!a || !canSupply(s, a)) return false;
  const fair = fairOn(s);
  const wanted = demand(s);
  if (a.grade === 'mixed') {
    let left = a.count;
    for (const k of EAT_ORDER) {
      const take = Math.min(left, s.jars[k]);
      s.jars[k] -= take;
      left -= take;
    }
  } else if (a.grade === 'pure') s.jars[a.kind] -= a.count;
  else s.combs[a.kind] -= a.count;
  a.done = true;
  const coins = a.count * a.price;
  s.coins += coins;
  s.sold += a.count;
  s.events.push({ kind: 'supplied', ask: i, coins });
  afterSale(s, wanted, fair);
  return true;
}

/**
 * The season's buyer's book: three towns, one asking for each grade, pure and comb honey of a kind
 * whose meadow is unlocked, at a premium on what a jar is worth now, swung by the season.
 */
function newBook(s: GameState) {
  const towns = [...CITIES.keys()];
  const kinds = KINDS.filter((k) => s.meadows >= HONEY[k].meadows);
  const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];
  s.book = GRADES.map((grade) => {
    const city = towns.splice(Math.floor(Math.random() * towns.length), 1)[0];
    const kind: Kind = grade === 'mixed' ? 'clover' : pick(kinds);
    const [least, most] = GRADE_COUNT[grade];
    const count = least + Math.floor(Math.random() * (most - least + 1));
    const swing = SWING[0] + Math.random() * (SWING[1] - SWING[0]);
    return { city, grade, kind, count, price: Math.round(basePrice(s, kind) * GRADE_MULT[grade] * swing), done: false };
  });
  s.events.push({ kind: 'book' });
}

/**
 * The garden's rare pairs of beds each give a jar of their rare honey every `GARDEN_MS`, while the
 * garden keeps fewer than `RARE_CAP`; nothing grows in winter.
 */
function garden(s: GameState, dt: number) {
  const pairs = rarePairs(s.garden);
  if (pairs.length === 0 || isWinter(s)) return;
  s.gardenMs += dt;
  if (s.gardenMs < GARDEN_MS) return;
  s.gardenMs -= GARDEN_MS;
  let jars = 0;
  for (const p of pairs) {
    if (rareCount(s) >= RARE_CAP) break;
    s.rare[p.rare]++;
    jars++;
  }
  if (jars > 0) s.events.push({ kind: 'bloomed', jars });
}

/** Plants a flower in a garden bed (or replants it with another), once the garden is open, for `BED_PRICE`. */
export function plant(s: GameState, bed: number, bloom: Bloom) {
  if (s.golds < GARDEN_GOLDS || bed < 0 || bed >= BEDS || s.garden[bed] === bloom || s.coins < BED_PRICE) return false;
  s.coins -= BED_PRICE;
  s.garden[bed] = bloom;
  s.events.push({ kind: 'planted', bed, bloom });
  return true;
}

/** Enters the best jar of rare honey kept in this year's fair's rare class (open while the garden has a rare bloom). */
export function enterRare(s: GameState) {
  if (!fairOn(s) || fairWon(s) || !fairClasses(s).includes('rare')) return false;
  const best = [...RARE_KINDS].sort((a, b) => RARES[b].points - RARES[a].points).find((r) => s.rare[r] > 0);
  if (!best) return false;
  s.rare[best]--;
  enter(s, ['rare'], RARES[best].points);
  return true;
}

/** Makes a candle or a tin of polish in the workshop from its wax. */
export function make(s: GameState, ware: Ware) {
  if (s.sold < WORKSHOP_FROM || s.wax < WARE[ware].wax) return false;
  s.wax -= WARE[ware].wax;
  s.wares[ware]++;
  s.events.push({ kind: 'made', ware });
  return true;
}

/** Fills a commission from the church or the manor with goods made, for its price each (not counted as jars sold). */
export function fulfil(s: GameState, i: number) {
  const c = s.commissions[i];
  if (!c || c.done || s.wares[c.ware] < c.count) return false;
  s.wares[c.ware] -= c.count;
  c.done = true;
  const coins = c.count * c.price;
  s.coins += coins;
  s.events.push({ kind: 'fulfilled', ware: c.ware, coins });
  return true;
}

/**
 * The season's commissions: the church for candles and the manor for polish, priced from what a
 * clover jar is worth before the market and swung by the season; candles fetch more in winter.
 */
function newCommissions(s: GameState) {
  s.commissions = WARES.map((ware) => {
    const [least, most] = WARE[ware].count;
    const count = least + Math.floor(Math.random() * (most - least + 1));
    const swing = SWING[0] + Math.random() * (SWING[1] - SWING[0]);
    const winter = ware === 'candle' && isWinter(s) ? WINTER_CANDLES : 1;
    return { ware, count, price: Math.round(basePrice(s, 'clover') * WARE[ware].mult * swing * winter), done: false };
  });
  s.events.push({ kind: 'commissions' });
}

/**
 * The royal warrant as the season turns: from `WARRANT_GOLDS` golds the crown asks for a gift each
 * autumn, and winter takes the warrant away if the gift was not given.
 */
function royal(s: GameState, now: string) {
  if (now === 'autumn' && s.golds >= WARRANT_GOLDS) {
    s.royal = royalAsk(s.years, s.warrant);
    s.events.push({ kind: 'royal' });
  } else if (now === 'winter' && s.royal) {
    if (!s.royal.done && s.warrant > 0) s.events.push({ kind: 'warrant-lost' });
    if (!s.royal.done) s.warrant = 0;
    s.royal = null;
  }
}

/** Whether there are goods enough for the crown's ask: pure jars or pieces of comb of its kind. */
export const canGift = (s: GameState) => !!s.royal && !s.royal.done && (s.royal.grade === 'pure' ? s.jars : s.combs)[s.royal.kind] >= s.royal.count;

/** Gives the crown its gift: the goods go for no coins, and the warrant is kept another year. */
export function giveRoyal(s: GameState) {
  const r = s.royal;
  if (!r || !canGift(s)) return false;
  (r.grade === 'pure' ? s.jars : s.combs)[r.kind] -= r.count;
  r.done = true;
  s.warrant++;
  s.events.push({ kind: 'warranted', years: s.warrant });
  return true;
}
