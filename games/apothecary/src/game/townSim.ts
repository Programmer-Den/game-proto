import { byDifficulty } from '../../../../shared/settings';
import { t } from '../i18n';
import { routeMs } from '../scenes/shopLayout';
import { DISTRICTS, GROW_ROUNDS, HAPPY, HAPPY_PULL, HOME_TIERS, MAX_HOMES, START_HOMES, SUPPLY_MS, UNHAPPY, districtAsks, type DistrictState, type Need } from './districts';
import { FINE, isFine, type PotionId } from './items';
import type { Feedback } from './sim';
import {
  BLIGHT_DAY,
  BLIGHT_EVERY_MS,
  BLIGHT_SPREAD_MS,
  BOOK_CONTRACT_DAY,
  BUNDLE_EVERY,
  DAY_MS,
  FINE_BONUS,
  FINE_SHARE,
  MAX_REGULARS,
  PRICE_SIGNS,
  REGULAR_CHANCE,
  REGULAR_TIP_LEFT,
  REPUTATION_SERVED,
  REPUTATION_WALKED_OFF,
  RUSH_SIZE,
  SIGN_DEMAND,
  SIGN_PATIENCE,
  SIGN_PAY,
  SIGN_REPUTATION,
  SIGN_SET,
  WEATHER,
  carryCapacity,
  gearLevel,
  isMarketDay,
  payment,
  potionPrice,
  reputationFactor,
  signOf,
  speedAt,
  stockedPay,
  tipLeft,
  tipNow,
  UPGRADES,
  weatherFor,
  type GameState,
  type Upgrade,
} from './state';
import {
  BEDS,
  COUNTER_PAY,
  CUSTOMER_FACES,
  GOODS,
  MAX_LEVEL,
  MAX_SHOPKEEPERS,
  MAX_WORKERS,
  ROUTE_GAP_MS,
  SHOPS,
  SHOP_IDS,
  SHOP_PATIENCE,
  SHOP_SERVE_MS,
  WALK_IN_MS,
  createShop,
  line2Cost,
  lineOpen,
  routeDef,
  shopRoutes,
  shopStations,
  stationDef,
  gardenOpen,
  gearCost,
  recipeCost,
  guildCost,
  guildJoinCost,
  shopFootfall,
  shopGrowth,
  fineOf,
  isFineGood,
  plainGood,
  MAX_SHOP_CONTRACT,
  SHOP_CONTRACT_SHARE,
  SHOP_CONTRACT_START,
  SHOP_REGULAR_BONUS,
  SHOP_RUSH_BONUS,
  SHOP_TIP,
  bedNeighbours,
  isBlightedBed,
  shopBlightImmune,
  type Held,
  type ShopContract,
  type ShopOrder,
  shopKnows,
  shopMakes,
  shopPlaces,
  shopPriceBoost,
  shopRouteSpeed,
  shopStorage,
  SHOP_GUILD_UPGRADES,
  type ShopGuild,
  shopSells,
  lessonCost,
  priorityChoices,
  shopSignOf,
  shopStudied,
  gardenOfBed,
  levelCost,
  routeCost,
  sellsGood,
  shopCost,
  takes,
  townOpen,
  workerCost,
  type Gear,
  type GoodId,
  type Lesson,
  type RouteDef,
  type ShopDef,
  type ShopId,
  type ShopState,
  type StationDef,
  type StationState,
} from './town';

// The town shops' rules, free of Phaser like `sim.ts`. `tickTown` runs every shop bought, whichever
// scene is on screen, and the marker actions below change one shop and return `Feedback` lines.

/** Where the doctor is working in the town this frame: which shop, and the station or counter whose work spot holds the feet. */
export interface Working {
  shop: ShopId;
  at: string | 'counter' | null;
}

export const goodName = (held: Held) => (isFineGood(held) ? t('fineGood', { item: t(plainGood(held)) }) : t(held));

const count = <T>(list: T[], good: T) => list.reduce((n, g) => n + (g === good ? 1 : 0), 0);
/** How many of a good a shelf or the hands hold, plain and fine together. */
const countBoth = (list: Held[], good: GoodId) => list.reduce((n, h) => n + (plainGood(h) === good ? 1 : 0), 0);

/** Goods of one kind on their way to a station's queue or the shelf, so a route doesn't overfill it. */
function inFlight(shop: ShopState, def: ShopDef, to: RouteDef['to'], good: GoodId) {
  let n = 0;
  for (const r of shopRoutes(def)) {
    const same = r.to === 'shelf' ? to === 'shelf' : to !== 'shelf' && r.to.station === to.station;
    if (same) n += shop.routes[r.id].items.filter((i) => i.good === good).length;
  }
  return n;
}

const queueRoom = (shop: ShopState, station: string, good: GoodId) => count(shop.stations[station].queue, good) < shopStorage(shop);
export const shelfRoom = (shop: ShopState, good: GoodId) => countBoth(shop.shelf, good) < shopStorage(shop);

/**
 * The recipe a station starts next: one whose inputs are in and whose product has room; its
 * priority's when that is ready, otherwise what is shortest of on its pallets and the shelf.
 */
function nextRecipe(shop: ShopState, shopDef: ShopDef, def: StationDef, station: StationState) {
  const ready = def.recipes.filter((r) => {
    if (!shopKnows(shop, shopDef, r.out)) return false;
    const queue = [...station.queue];
    for (const input of r.inputs) {
      const at = queue.indexOf(input);
      if (at < 0) return false;
      queue.splice(at, 1);
    }
    return count(station.output, r.out) < shopStorage(shop);
  });
  const first = shopStudied(shop, 'craftOrder') ? shop.priority[def.id] : null;
  const preferred = first && ready.find((r) => r.out === first);
  if (preferred) return preferred;
  const stocked = (good: GoodId) => count(station.output, good) + countBoth(shop.shelf, good);
  return ready.reduce<(typeof ready)[number] | null>((best, r) => (!best || stocked(r.out) < stocked(best.out) ? r : best), null);
}

function runStation(shop: ShopState, shopDef: ShopDef, def: StationDef, dt: number, doctor: boolean) {
  const station = shop.stations[def.id];
  const crew = station.hired.level + (doctor ? 1 : 0);
  if (crew === 0) return;
  let left = dt * speedAt(station.level.level) * crew;
  while (left > 0) {
    if (!station.work) {
      const recipe = nextRecipe(shop, shopDef, def, station);
      if (!recipe) return;
      for (const input of recipe.inputs) station.queue.splice(station.queue.indexOf(input), 1);
      station.work = { out: recipe.out, ms: recipe.ms, progress: 0 };
    }
    const work = station.work;
    const step = Math.min(left, work.ms - work.progress);
    work.progress += step;
    left -= step;
    if (work.progress < work.ms) return;
    // Done: it waits on the station while its pallet is full.
    if (count(station.output, work.out) >= shopStorage(shop)) return;
    station.output.push(work.out);
    station.work = null;
  }
}

/** Takes one good for a route from its source, or null when there is nothing it can carry. */
function takeForRoute(shop: ShopState, def: ShopDef, route: RouteDef): GoodId | null {
  const accepts = (good: GoodId) => {
    if (route.to === 'shelf') return sellsGood(def, good) && countBoth(shop.shelf, good) + inFlight(shop, def, 'shelf', good) < shopStorage(shop);
    const station = stationDef(def, (route.to as { station: string }).station);
    return takes(station, good) && count(shop.stations[station.id].queue, good) + inFlight(shop, def, route.to, good) < shopStorage(shop);
  };
  if ('garden' in route.from) {
    const garden = def.gardens[route.from.garden];
    if (!gardenOpen(shop, route.from.garden) || !accepts(garden.good)) return null;
    const from = route.from.garden * BEDS;
    for (let b = from; b < from + BEDS; b++) {
      if (shop.beds[b] >= garden.grow && !isBlightedBed(shop, b)) {
        shop.beds[b] = 0;
        return garden.good;
      }
    }
    return null;
  }
  const output = shop.stations[route.from.station].output;
  // The kind it holds most of first, so a route carries a mix.
  const goods = [...new Set(output)].filter(accepts).sort((a, b) => count(output, b) - count(output, a));
  if (goods.length === 0) return null;
  output.splice(output.indexOf(goods[0]), 1);
  return goods[0];
}

function runRoute(id: ShopId, shop: ShopState, def: ShopDef, route: RouteDef, dt: number) {
  const state = shop.routes[route.id];
  if (!state.built) return;
  const ms = routeMs(id, route, shopRouteSpeed(shop));
  for (const item of state.items) item.at = Math.min(ms, item.at + dt);
  // Goods at the end land on their station's queue or the shelf, or wait there for room.
  state.items = state.items.filter((item) => {
    if (item.at < ms) return true;
    if (route.to === 'shelf') {
      shop.shelf.push(item.good);
      return false;
    }
    shop.stations[route.to.station].queue.push(item.good);
    return false;
  });
  state.next -= dt;
  if (state.next > 0) return;
  const good = takeForRoute(shop, def, route);
  if (!good) return;
  state.items.push({ good, at: 0 });
  state.next = ROUTE_GAP_MS;
}

/** What a customer pays for a good now: its price, the counter's level and the shelf's sign. */
export const shopPrice = (shop: ShopState, def: ShopDef, good: GoodId) =>
  Math.round((def.sells[good] ?? 0) * (1 + COUNTER_PAY * shop.counter.level.level) * shopPriceBoost(shop) * SIGN_PAY[shopSignOf(shop, good)]);

/** The orders at the counter, walked in and waiting. */
export const arrived = (shop: ShopState) => shop.orders.filter((o) => o.walk <= 0);

/** Where a good stands on a shelf, `first` (fine or plain) before the other, or -1. */
function shelfIndex(shelf: Held[], good: GoodId, fineFirst: boolean) {
  const [a, b] = fineFirst ? [fineOf(good), good] : [good, fineOf(good)];
  return shelf.includes(a) ? shelf.indexOf(a) : shelf.indexOf(b);
}

/** Whether a good handed over now counts towards a shop's contract: its good, or its bundle's, still short. */
export const shopContractWants = (c: ShopContract, good: GoodId) => (c.good === good && c.made < c.need) || (c.bundle?.good === good && c.bundle.made < c.bundle.need);
/** Whether a shop's contract is kept: both its parts met. */
export const shopContractKept = (c: ShopContract) => c.made >= c.need && (!c.bundle || c.bundle.made >= c.bundle.need);

/** Counts a good handed over at the counter towards the shop's contract, paying its reward into the till once met. */
function deliverForShopContract(shop: ShopState, good: GoodId) {
  const c = shop.contract;
  if (!c || !shopContractWants(c, good)) return;
  if (c.good === good && c.made < c.need) c.made++;
  else c.bundle!.made++;
  if (!shopContractKept(c)) return;
  shop.till += c.reward;
  shop.kept++;
}

/**
 * Today's contract at a shop: the goods it sells taking turns by the day, one more wanted for each
 * kept. On a bundle day, as at the apothecary (every `BUNDLE_EVERY`th from `BOOK_CONTRACT_DAY`), the
 * goods are split between two of them.
 */
function shopContractFor(shop: ShopState, def: ShopDef, day: number): ShopContract {
  const goods = shopSells(shop, def);
  const at = (day + shop.kept) % goods.length;
  const good = goods[at];
  const total = Math.min(MAX_SHOP_CONTRACT, SHOP_CONTRACT_START + shop.kept);
  const worth = (g: GoodId, n: number) => (def.sells[g] ?? 0) * n * SHOP_CONTRACT_SHARE;
  const roundFive = (n: number) => Math.max(5, Math.round(n / 5) * 5);
  if ((day - BOOK_CONTRACT_DAY) % BUNDLE_EVERY !== 1 || goods.length < 2) return { day, good, need: total, made: 0, reward: roundFive(worth(good, total)) };
  const second = goods[(at + 1 + (day % (goods.length - 1))) % goods.length];
  const need = Math.ceil(total / 2), need2 = total - need;
  return { day, good, need, made: 0, reward: roundFive(worth(good, need) + worth(second, need2)), bundle: { good: second, need: need2, made: 0 } };
}

/** Changes a shop's reputation by `by`, kept within 0 to 100. */
const nudge = (shop: ShopState, by: number) => {
  shop.reputation = Math.max(0, Math.min(100, shop.reputation + by));
};

/**
 * A customer leaves a shop served: the street thinks better of it, one served quickly comes back
 * as a regular, and one of a market day's crowd counts towards the crowd's bonus.
 */
function orderFilled(shop: ShopState, order: ShopOrder) {
  nudge(shop, REPUTATION_SERVED);
  if (tipLeft(order) >= REGULAR_TIP_LEFT) {
    if (shop.regulars.length >= MAX_REGULARS) shop.regulars.shift();
    shop.regulars.push({ face: order.face, wants: order.asked ?? (Object.keys(order.pay) as GoodId[]) });
  }
  const rush = shop.rush;
  if (!order.rush || !rush) return;
  rush.served++;
  if (rush.served >= rush.size && !rush.lost && !rush.paid) {
    rush.paid = true;
    shop.till += rush.bonus;
  }
}

/** What the next one of a good sold off a shop's shelf pays: less past `STOCK_FREE` on the shelf, as at the apothecary. */
export const shopStockedPay = (shop: ShopState, good: GoodId, pay: number) => stockedPay(pay, countBoth(shop.shelf, good), shopStorage(shop));

/**
 * Hands one good from the shelf to the first customer at the counter who wants one, a fine one
 * first, which pays `FINE_BONUS` times as much, less for each of the good still stocked (the
 * overstock cut). A customer whose order is filled tips what is left of their tip. Returns whether
 * it handed one over.
 */
function serveOne(shop: ShopState) {
  for (const order of arrived(shop)) {
    const want = order.wants.find((w) => shelfIndex(shop.shelf, w, true) >= 0);
    if (!want) continue;
    const pay = Math.round((order.pay[want] ?? 0) * (isFineGood(shop.shelf[shelfIndex(shop.shelf, want, true)]) ? FINE_BONUS : 1));
    // The cut counts the goods of the kind on the shelf, this one included.
    shop.till += shopStockedPay(shop, want, pay);
    shop.shelf.splice(shelfIndex(shop.shelf, want, true), 1);
    order.wants.splice(order.wants.indexOf(want), 1);
    shop.sold++;
    nudge(shop, SIGN_REPUTATION[shopSignOf(shop, want)]);
    deliverForShopContract(shop, want);
    if (order.wants.length === 0) {
      shop.till += tipNow(order);
      orderFilled(shop, order);
      shop.orders.splice(shop.orders.indexOf(order), 1);
    }
    return true;
  }
  return false;
}

function runCounter(shop: ShopState, dt: number, doctor: boolean) {
  if (doctor) {
    while (serveOne(shop));
    shop.serving = 0;
    return;
  }
  const hired = shop.counter.hired.level;
  if (hired === 0) return;
  shop.serving += dt * hired;
  while (shop.serving >= SHOP_SERVE_MS) {
    if (!serveOne(shop)) {
      shop.serving = 0;
      return;
    }
    shop.serving -= SHOP_SERVE_MS;
  }
}

/** A free place at a shop's counter, or undefined when every one is taken. */
function freeSpot(shop: ShopState) {
  const taken = new Set(shop.orders.map((o) => o.spot));
  return [...Array(shopPlaces(shop)).keys()].find((s) => !taken.has(s));
}

/**
 * A new customer at a shop, for `spot`: now and then (only once there are any, and not with a
 * market crowd) a regular back for the same goods, paying `SHOP_REGULAR_BONUS` more for each;
 * otherwise one or two goods drawn from a hat with each good in it as often as its sign draws
 * customers, twice when cheap. Their tip is `SHOP_TIP` of what the order pays.
 */
function newShopOrder(shop: ShopState, def: ShopDef, spot: number, rand: () => number, regulars: boolean): ShopOrder {
  const goods = shopSells(shop, def);
  const regular = regulars && shop.regulars.length > 0 && rand() < REGULAR_CHANCE ? shop.regulars.shift()! : null;
  const theirs = regular?.wants.filter((g) => goods.includes(g)) ?? [];
  let wants: GoodId[];
  if (theirs.length > 0) wants = theirs;
  else {
    const hat = goods.flatMap((g) => Array<GoodId>(SIGN_DEMAND[shopSignOf(shop, g)]).fill(g));
    const size = rand() < 0.35 ? 2 : 1;
    wants = Array.from({ length: size }, () => hat[Math.floor(rand() * hat.length)]);
  }
  const back = theirs.length > 0;
  const pay = Object.fromEntries(wants.map((w) => [w, Math.round(shopPrice(shop, def, w) * (back ? 1 + SHOP_REGULAR_BONUS : 1))]));
  const patience = SHOP_PATIENCE * byDifficulty(1.5, 1, 0.7);
  const tip = Math.round(SHOP_TIP * wants.reduce((n, w) => n + (pay[w] ?? 0), 0));
  const face = back ? regular!.face : Math.floor(rand() * CUSTOMER_FACES);
  return { id: shop.nextOrderId++, wants, asked: [...wants], pay, walk: WALK_IN_MS, patience, maxPatience: patience, face, spot, tip, ...(back ? { regular: true } : {}) };
}

function runOrders(shop: ShopState, def: ShopDef, day: number, dt: number, rand: () => number) {
  for (const order of shop.orders) {
    if (order.walk > 0) order.walk = Math.max(0, order.walk - dt);
    // Patience runs out faster while a good it still wants is sold dear.
    else order.patience -= dt * Math.max(1, ...order.wants.map((w) => SIGN_PATIENCE[shopSignOf(shop, w)]));
  }
  // A customer who runs out of patience walks off, and the street thinks less of the shop; one of a
  // market crowd walking off loses the crowd's bonus.
  for (const order of shop.orders) {
    if (order.patience > 0) continue;
    nudge(shop, -REPUTATION_WALKED_OFF);
    if (order.rush && shop.rush) shop.rush.lost = true;
  }
  shop.orders = shop.orders.filter((o) => o.patience > 0);
  // The market crowd steps up to every place that comes free, before anyone else.
  const rush = shop.rush;
  for (let spot = freeSpot(shop); rush && rush.waiting > 0 && spot !== undefined; spot = freeSpot(shop)) {
    rush.waiting--;
    const order = { ...newShopOrder(shop, def, spot, rand, false), rush: true };
    rush.bonus += Math.round(SHOP_RUSH_BONUS * order.wants.reduce((n, w) => n + (def.sells[w] ?? 0), 0));
    shop.orders.push(order);
  }
  shop.nextOrderIn -= dt;
  if (shop.nextOrderIn > 0) return;
  const spot = freeSpot(shop);
  if (spot === undefined) {
    shop.nextOrderIn = 1_000;
    return;
  }
  shop.orders.push(newShopOrder(shop, def, spot, rand, true));
  // Customers come more often with a good name and on a fair day, as at the apothecary.
  shop.nextOrderIn = ((7_000 + rand() * 5_000) * reputationFactor(shop.reputation)) / shopFootfall(shop) / WEATHER[weatherFor(day)].customers;
}

/**
 * A market day's crowd at midday (`isMarketDay`, as at the apothecary): `RUSH_SIZE` customers, who
 * take every free place at the counter and wait in the street for the rest. Those still waiting at
 * dusk go home, and the bonus with them.
 */
function runRush(shop: ShopState, day: number, dayLeft: number) {
  const rush = shop.rush;
  if (rush && rush.day !== day && rush.waiting > 0) {
    rush.waiting = 0;
    rush.lost = true;
  }
  if (isMarketDay(day) && dayLeft <= DAY_MS / 2 && rush?.day !== day) shop.rush = { day, size: RUSH_SIZE, waiting: RUSH_SIZE, served: 0, lost: false, paid: false, bonus: 0 };
}

/**
 * The blight at a shop, as at the apothecary: on a rainy day from `BLIGHT_DAY` now and then a bed
 * in a garden that grows is blighted, and every blighted bed blights a neighbour every
 * `BLIGHT_SPREAD_MS` until the sickle clears it. The shop guild's herbalist keeps every bed clear.
 * `rand` is only rolled when the blight can strike or spread.
 */
function spreadShopBlight(shop: ShopState, day: number, dt: number, rand: () => number) {
  if (shopBlightImmune(shop)) {
    shop.blight = [];
    return;
  }
  if (day >= BLIGHT_DAY && weatherFor(day) === 'rain' && rand() < dt / BLIGHT_EVERY_MS) {
    const clear = shop.beds.map((_, b) => b).filter((b) => gardenOpen(shop, gardenOfBed(b)) && !isBlightedBed(shop, b));
    if (clear.length > 0) shop.blight.push({ bed: clear[Math.floor(rand() * clear.length)], ms: 0 });
  }
  for (const spot of [...shop.blight]) {
    spot.ms += dt;
    if (spot.ms < BLIGHT_SPREAD_MS) continue;
    spot.ms -= BLIGHT_SPREAD_MS;
    const near = bedNeighbours(spot.bed).filter((b) => !isBlightedBed(shop, b));
    if (near.length > 0) shop.blight.push({ bed: near[Math.floor(rand() * near.length)], ms: 0 });
  }
}

/**
 * Advances every shop bought by `dt` milliseconds: beds grow, stations with someone at them work,
 * pixies fly, the counter serves and customers come and go. `working` is where the doctor stands in
 * the town, or null outside it. Shops not bought yet do nothing, and roll no randomness.
 */
export function tickTown(state: GameState, dt: number, working: Working | null, rand: () => number = Math.random) {
  for (const id of SHOP_IDS) {
    const shop = state.town.shops[id];
    if (!shop) continue;
    const def = SHOPS[id];
    const here = working?.shop === id ? working.at : null;
    const day = state.contract.day;
    if (shop.contract?.day !== day) shop.contract = shopContractFor(shop, def, day);
    // Beds grow faster in the rain and slower in a drought; a blighted one stands still.
    const growth = shopGrowth(shop) * WEATHER[weatherFor(day)].growth;
    const blighted = new Set(shop.blight.map((b) => b.bed));
    shop.beds.forEach((grown, b) => gardenOpen(shop, gardenOfBed(b)) && !blighted.has(b) && (shop.beds[b] = Math.min(grown + dt * growth, def.gardens[gardenOfBed(b)].grow)));
    for (const station of shopStations(def)) runStation(shop, def, station, dt, here === station.id);
    for (const route of shopRoutes(def)) runRoute(id, shop, def, route, dt);
    runCounter(shop, dt, here === 'counter');
    runRush(shop, day, state.contract.dayLeft);
    runOrders(shop, def, day, dt, rand);
    spreadShopBlight(shop, day, dt, rand);
  }
  if (townOpen(state.seals)) state.town.districts.forEach((d, i) => runDistrict(state, d, i, dt));
}

const isGood = (need: Need): need is GoodId => need in GOODS;

/**
 * Hands one of a need to a household: a good off the shelf of a shop bought that sells it, or a
 * potion off the apothecary's shelf (a plain one first), paid into that shop's till. False when
 * nobody has one on the shelf.
 */
function supplyNeed(state: GameState, need: Need): boolean {
  if (isGood(need)) {
    for (const id of SHOP_IDS) {
      const shop = state.town.shops[id];
      const price = SHOPS[id].sells[need];
      const at = shop ? shelfIndex(shop.shelf, need, false) : -1;
      if (!shop || price === undefined || at < 0) continue;
      const [held] = shop.shelf.splice(at, 1);
      // The shelf's sign scales the price and a fine one pays more, as for a customer.
      const sign = SIGN_PAY[shopSignOf(shop, need)];
      shop.till += Math.round(price * (1 + COUNTER_PAY * shop.counter.level.level) * shopPriceBoost(shop) * sign * (isFineGood(held) ? FINE_BONUS : 1));
      return true;
    }
    return false;
  }
  const shelf = state.counter.shelf;
  const at = shelf.includes(need) ? shelf.indexOf(need) : shelf.indexOf(FINE[need as PotionId]);
  if (at < 0) return false;
  const [held] = shelf.splice(at, 1);
  // The shelf's sign scales the price and a fine one pays more, as for a customer.
  state.counter.till += Math.round(potionPrice(state, need) * SIGN_PAY[signOf(state, need)] * (isFine(held) ? FINE_BONUS : 1));
  return true;
}

/**
 * A district's supply round every `SUPPLY_MS`: each home asks for one need and pays for it from the
 * shelves; happiness moves towards the share supplied, and `GROW_ROUNDS` happy rounds in a row add
 * a home (or, once full, grow every home into the next tier) while as many unhappy ones take one
 * away. A closed district opens once the one before it has grown into its second tier.
 */
function runDistrict(state: GameState, d: DistrictState, i: number, dt: number) {
  if (!d.open) {
    const before = state.town.districts[i - 1];
    if (before && before.tier > 0) d.open = true;
    return;
  }
  d.next -= dt;
  while (d.next <= 0) {
    d.next += SUPPLY_MS;
    const asks = districtAsks(d);
    const short = asks.filter((need) => !supplyNeed(state, need));
    d.short = [...new Set(short)];
    d.rounds++;
    const share = asks.length ? 1 - short.length / asks.length : 1;
    d.happiness = Math.round(d.happiness + (share * 100 - d.happiness) * HAPPY_PULL);
    if (d.happiness >= HAPPY) d.growth = Math.max(0, d.growth) + 1;
    else if (d.happiness <= UNHAPPY) d.growth = Math.min(0, d.growth) - 1;
    else d.growth = 0;
    if (d.growth >= GROW_ROUNDS) {
      d.growth = 0;
      if (d.homes < MAX_HOMES) d.homes++;
      else if (d.tier < HOME_TIERS.length - 1) d.tier++;
    } else if (d.growth <= -GROW_ROUNDS) {
      d.growth = 0;
      d.homes = Math.max(START_HOMES, d.homes - 1);
    }
  }
}

/** The districts open so far, with their defs. */
export const openDistricts = (state: GameState) => DISTRICTS.map((def, i) => ({ def, d: state.town.districts[i] })).filter(({ d }) => d.open);

/** Whether anything in the town works without the doctor: a worker, a shopkeeper or a pixie route. */
export const townAutomated = (state: GameState) =>
  SHOP_IDS.some((id) => {
    const shop = state.town.shops[id];
    return !!shop && (Object.values(shop.stations).some((s) => s.hired.level > 0) || shop.counter.hired.level > 0 || Object.values(shop.routes).some((r) => r.built));
  });

const freeHands = (state: GameState) => carryCapacity(state) - state.town.hands.length;

/** Buys a shop on the town map, all at once. */
export function buyShop(state: GameState, id: ShopId): Feedback | null {
  if (!townOpen(state.seals) || state.town.shops[id]) return null;
  const cost = shopCost(id);
  if (state.coins < cost) return null;
  state.coins -= cost;
  state.town.shops[id] = createShop(id);
  return [t('shopBought', { shop: t(SHOPS[id].name) })];
}

export function isRipeBed(state: GameState, id: ShopId, bed: number) {
  const shop = state.town.shops[id];
  return !!shop && gardenOpen(shop, gardenOfBed(bed)) && !isBlightedBed(shop, bed) && shop.beds[bed] >= SHOPS[id].gardens[gardenOfBed(bed)].grow;
}

/** The sickle clears a blighted bed, which then grows again from seed. */
export function clearShopBlight(state: GameState, id: ShopId, bed: number): Feedback | null {
  const shop = state.town.shops[id]!;
  if (!isBlightedBed(shop, bed)) return null;
  shop.blight = shop.blight.filter((b) => b.bed !== bed);
  shop.beds[bed] = 0;
  return [t('blightCleared')];
}

export function harvestBed(state: GameState, id: ShopId, bed: number): Feedback | null {
  const shop = state.town.shops[id]!;
  if (!isRipeBed(state, id, bed) || freeHands(state) === 0) return null;
  shop.beds[bed] = 0;
  const good = SHOPS[id].gardens[gardenOfBed(bed)].good;
  state.town.hands.push(good);
  return [t('gained', { item: goodName(good) })];
}

/** Drops one good from the hands that the station takes, the top one first. */
export function dropAtStation(state: GameState, id: ShopId, station: string): Feedback | null {
  const shop = state.town.shops[id]!;
  if (!lineOpen(shop, station)) return null;
  const def = stationDef(SHOPS[id], station);
  const hands = state.town.hands;
  for (let i = hands.length - 1; i >= 0; i--) {
    const good = hands[i];
    if (isFineGood(good) || !takes(def, good) || !queueRoom(shop, station, good)) continue;
    hands.splice(i, 1);
    shop.stations[station].queue.push(good);
    return [t('handedOver', { item: goodName(good) })];
  }
  return null;
}

/** Whether a station's work is in its fine window: a good the shop sells, in the last `FINE_SHARE` of it. */
export function inShopFineWindow(def: ShopDef, station: StationState) {
  const work = station.work;
  return !!work && sellsGood(def, work.out) && work.progress >= work.ms * (1 - FINE_SHARE) && work.progress < work.ms;
}

/**
 * Picks one good off a station: the work in its fine window first, taken out as a fine good, else
 * one off its out pallets, the kind the hands hold fewest of, then the one most waiting.
 */
export function pickUpFromStation(state: GameState, id: ShopId, station: string): Feedback | null {
  const s = state.town.shops[id]!.stations[station];
  const output = s.output;
  if (freeHands(state) === 0) return null;
  const hands = state.town.hands;
  if (inShopFineWindow(SHOPS[id], s)) {
    const fine = fineOf(s.work!.out);
    s.work = null;
    hands.push(fine);
    return [t('gainedFine', { item: goodName(fine) })];
  }
  if (output.length === 0) return null;
  const kinds = [...new Set(output)].sort((a, b) => countBoth(hands, a) - countBoth(hands, b) || count(output, b) - count(output, a));
  output.splice(output.indexOf(kinds[0]), 1);
  hands.push(kinds[0]);
  return [t('gained', { item: goodName(kinds[0]) })];
}

/** Puts one good the shop sells from the hands onto its shelf. */
export function stockShopShelf(state: GameState, id: ShopId): Feedback | null {
  const shop = state.town.shops[id]!;
  const hands = state.town.hands;
  for (let i = hands.length - 1; i >= 0; i--) {
    const good = hands[i];
    if (!sellsGood(SHOPS[id], plainGood(good)) || !shelfRoom(shop, plainGood(good))) continue;
    hands.splice(i, 1);
    shop.shelf.push(good);
    return [t('handedOver', { item: goodName(good) })];
  }
  return null;
}

export function collectShopTill(state: GameState, id: ShopId): Feedback | null {
  const shop = state.town.shops[id]!;
  if (shop.till === 0) return null;
  const n = shop.till;
  state.coins += n;
  shop.till = 0;
  return [t('coinsGained', { n })];
}

export function tossGood(state: GameState, slot: number): Feedback | null {
  const good = state.town.hands[slot];
  if (!good) return null;
  state.town.hands.splice(slot, 1);
  return [t('droppedItem', { item: goodName(good) })];
}

/**
 * Pays towards `cost`: about a twelfth of it at a time (at least 5 coins), so even the dearest
 * shop's upgrades fill in a couple of seconds on the marker, and more the longer the doctor stays
 * (see `payment`).
 */
function payTowards(state: GameState, toward: { paid: number }, cost: number): number {
  const coins = Math.min(Math.max(5, Math.ceil(cost / 12)) * payment.boost, state.coins, cost - toward.paid);
  if (coins <= 0) return 0;
  state.coins -= coins;
  toward.paid += coins;
  return coins;
}

function payLevel(state: GameState, upgrade: Upgrade, cost: number, max: number, done: () => string): Feedback | null {
  if (upgrade.level >= max) return null;
  const coins = payTowards(state, upgrade, cost);
  if (!coins) return null;
  if (upgrade.paid < cost) return [t('coinsPaid', { n: coins })];
  upgrade.level++;
  upgrade.paid = 0;
  return [done()];
}

export function payStationLevel(state: GameState, id: ShopId, station: string): Feedback | null {
  const s = state.town.shops[id]!.stations[station];
  const name = t(stationDef(SHOPS[id], station).name);
  return payLevel(state, s.level, levelCost(id, s.level.level), MAX_LEVEL, () => t('levelUp', { name, level: s.level.level + 1 }));
}

export function payWorker(state: GameState, id: ShopId, station: string): Feedback | null {
  const s = state.town.shops[id]!.stations[station];
  return payLevel(state, s.hired, workerCost(id, s.hired.level), MAX_WORKERS, () => t('workerHired', { worker: t(SHOPS[id].worker) }));
}

export function payCounterLevel(state: GameState, id: ShopId): Feedback | null {
  const c = state.town.shops[id]!.counter;
  return payLevel(state, c.level, levelCost(id, c.level.level), MAX_LEVEL, () => t('levelUp', { name: t('counter'), level: c.level.level + 1 }));
}

export function payShopkeeper(state: GameState, id: ShopId): Feedback | null {
  const c = state.town.shops[id]!.counter;
  return payLevel(state, c.hired, workerCost(id, c.hired.level), MAX_SHOPKEEPERS, () => t('shopkeeperHired'));
}

export function payRoute(state: GameState, id: ShopId, route: string): Feedback | null {
  const r = state.town.shops[id]!.routes[route];
  if (r.built || !lineOpen(state.town.shops[id]!, route)) return null;
  const cost = routeCost(id, routeDef(SHOPS[id], route));
  const coins = payTowards(state, r, cost);
  if (!coins) return null;
  if (r.paid < cost) return [t('coinsPaid', { n: coins })];
  r.built = true;
  return [t('pixiesFly')];
}

/** Pays towards a shop's outfitter's level of the doctor's pack, boots or sickle. */
export function payGear(state: GameState, id: ShopId, gear: Gear): Feedback | null {
  const upgrade = state.town.shops[id]!.outfitter[gear];
  return payLevel(state, upgrade, gearCost(id, gear), 1, () => t('levelUp', { name: t(gear), level: gearLevel(state, gear) + 1 }));
}

/** Pays towards a lesson at a shop's study. */
export function payLesson(state: GameState, id: ShopId, lesson: Lesson): Feedback | null {
  const upgrade = state.town.shops[id]!.study[lesson];
  return payLevel(state, upgrade, lessonCost(id, lesson), 1, () => t('learned', { potion: t(lesson) }));
}

/** Pays towards the next recipe a shop's study teaches. */
export function payRecipe(state: GameState, id: ShopId): Feedback | null {
  const recipes = state.town.shops[id]!.recipes;
  const research = SHOPS[id].research;
  return payLevel(state, recipes, recipeCost(id, recipes.level), research.length, () => t('learned', { potion: goodName(research[recipes.level - 1]) }));
}

/** Pays towards a shop's second line. */
export function payLine2(state: GameState, id: ShopId): Feedback | null {
  return payLevel(state, state.town.shops[id]!.line2, line2Cost(id), 1, () => t('line2Built'));
}

/** Pays towards joining a shop's guild. */
export function payGuildJoin(state: GameState, id: ShopId): Feedback | null {
  return payLevel(state, state.town.shops[id]!.guild.join, guildJoinCost(id), 1, () => t('welcomeGuild'));
}

/** Pays towards a shop guild upgrade's next level, once the guild is joined. */
export function payGuildUpgrade(state: GameState, id: ShopId, upgrade: ShopGuild): Feedback | null {
  const guild = state.town.shops[id]!.guild;
  if (guild.join.level === 0) return null;
  const u = guild[upgrade];
  return payLevel(state, u, guildCost(id, upgrade, u.level), SHOP_GUILD_UPGRADES[upgrade].max, () => t('levelUp', { name: t(UPGRADES[upgrade].name), level: u.level + 1 }));
}

/** Moves a shop station's priority on: none, then each product it makes, and back to none. */
export function cycleShopPriority(state: GameState, id: ShopId, station: string): Feedback | null {
  const shop = state.town.shops[id]!;
  const def = stationDef(SHOPS[id], station);
  const choices: (GoodId | null)[] = [null, ...priorityChoices(def, (g) => shopMakes(shop, SHOPS[id], g))];
  if (!shopStudied(shop, 'craftOrder') || choices.length === 1) return null;
  const next = choices[(choices.indexOf(shop.priority[station] ?? null) + 1) % choices.length];
  shop.priority[station] = next;
  return [next ? t('firstChoice', { item: goodName(next) }) : t('anyOrder')];
}

/** Moves a shop shelf's price sign on: Fair to Dear, Dear to Cheap, Cheap to Fair. */
export function cycleShopSign(state: GameState, id: ShopId, good: GoodId): Feedback | null {
  const shop = state.town.shops[id]!;
  if (!shopStudied(shop, 'priceSigns')) return null;
  const next = PRICE_SIGNS[(PRICE_SIGNS.indexOf(shopSignOf(shop, good)) + 1) % PRICE_SIGNS.length];
  shop.signs[good] = next;
  return [t(SIGN_SET[next], { potion: goodName(good) })];
}

/** A good's colour, for bars and crates. */
export const goodColor = (held: Held) => GOODS[plainGood(held)].color;
