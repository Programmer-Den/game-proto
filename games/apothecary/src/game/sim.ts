import { byDifficulty } from '../../../../shared/settings';
import {
  FINE,
  GROW_MS,
  PANACEA,
  PANACEA_RECIPE,
  POTIONS,
  RECIPES,
  REFINE,
  isPlant,
  isRefined,
  isSellable,
  PLANTS,
  plainOf,
  type ItemId,
  type PlantId,
  type PotionId,
} from './items';
import {
  BELT_COST,
  BELT_ENDS,
  BELT_GAP_MS,
  BELT_LANES,
  BELT_MS,
  BELTS,
  SERVE_MS,
  CAULDRONS,
  EXPANSION_COST,
  MAX_CRAFTSMEN,
  beltSpeed,
  growthSpeed,
  maxOrders,
  orderInterval,
  potionPrice,
  stockedPay,
  unlocked,
  GUILD_COST,
  REFINERS,
  GARDEN_LINE,
  UPGRADES,
  anyFieldBuilt,
  beltBuildable,
  carryCapacity,
  stationBuilt,
  craftsmanCost,
  gardenBuilt,
  gardenOf,
  speedAt,
  palletHasRoom,
  storage,
  upgradeCost,
  contractFor,
  maxTip,
  tipNow,
  tipLeft,
  DAY_MS,
  FINE_BONUS,
  MAX_REGULARS,
  REGULAR_BONUS,
  REGULAR_CHANCE,
  REGULAR_TIP_LEFT,
  REPUTATION_SERVED,
  REPUTATION_WALKED_OFF,
  RUSH_BONUS,
  RUSH_EXTRA,
  RUSH_SIZE,
  SHADE_COST,
  inFineWindow,
  isMarketDay,
  nudgeReputation,
  orderable,
  researched,
  studied,
  payment,
  RESEARCH_ORDER,
  BLIGHT_DAY,
  BLIGHT_EVERY_MS,
  BLIGHT_SPREAD_MS,
  GARDEN_RUN,
  GARDEN_NAMES_IN,
  MAX_PLAGUE_NEED,
  PLAGUE_DAY,
  PLAGUE_RELAPSE_EXTRA,
  PLAGUE_RELAPSE_REPUTATION,
  PLAGUE_STAGE_MS,
  PRICE_SIGNS,
  RIVAL_MONTH_DAYS,
  RIVAL_CUT,
  RIVAL_SALES,
  SIGN_DEMAND,
  SIGN_SET,
  SIGN_PAY,
  SIGN_REPUTATION,
  blightImmune,
  gardenPlant,
  panaceaUnlocked,
  patienceRate,
  plagueAt,
  plagueStage,
  plantChoices,
  plotNeighbours,
  rivalPotionFor,
  rivalUndercuts,
  signOf,
  weatherFor,
  PLOTS_PER_GARDEN,
  SEASON_GAP,
  contractWants,
  herbBuyPrice,
  herbSellPrice,
  isWagonDay,
  marketOpen,
  wagonFor,
  wagonHere,
  WAGON_ARRIVES,
  HERBS,
  type HerbId,
  type BeltId,
  type CraftingId,
  type BeltItem,
  type Build,
  type Brew,
  type Cauldron,
  type CauldronId,
  type GameState,
  type RefinerId,
  type Order,
  type Refiner,
  type StationId,
  type Upgrade,
  type UpgradeId,
} from './state';
// Where goods get on the belts comes from their paths; the layout is plain data, free of Phaser too.
import { beltSpan } from '../scenes/layout';
import { itemName, potionCount, t, type TextKey } from '../i18n';

// Pure game rules, kept free of Phaser so later automation can drive the same functions.

/**
 * How many work a station: its craftsmen once any are hired, otherwise the doctor when standing on
 * its work spot. A station with craftsmen has no work spot left.
 */
const crew = (state: GameState, id: StationId, workingAt: StationId | null) =>
  state.craftsmen[id].level > 0 ? state.craftsmen[id].level : workingAt === id ? 1 : 0;

/** Whether a refining table or cauldron has its second pipe open: a second craftsman works it. */
const secondPipe = (state: GameState, id: StationId) => state.craftsmen[id].level >= 2;

/**
 * Advances the world by `dt` ms. Stations only work while someone works them: the doctor standing
 * at their work spot, given as `workingAt`, or their craftsmen. The refining table and cauldron make
 * progress, a second craftsman working a second pipe alongside the first, and customers are
 * served. A counter's second craftsman also takes the coins from the till. Customers are served,
 * and lose patience, only once they stand at the counter, as `atCounter` says; without anyone
 * showing them walk in, they are there at once.
 */
export function tick(
  state: GameState,
  dt: number,
  workingAt: StationId | null,
  atCounter: (order: Order) => boolean = () => true,
  rand: () => number = Math.random,
) {
  // A blighted bed stands still until the sickle clears it.
  for (const plot of state.plots) {
    if (!plot.blighted) plot.grown = Math.min(plot.grown + dt * growthSpeed(state), GROW_MS[plot.plant]);
  }

  for (const id of REFINERS) {
    const refiner = state[id];
    const speed = dt * speedAt(state.upgrades[id].level);
    const next = refining(state, refiner, state.priority[id]);
    // Each pair of hands works its own pipe at the same speed: the first the front of the queue, a
    // second craftsman's a plant of its own (see `refineSecond`).
    if (crew(state, id, workingAt) > 0 && next >= 0) {
      // The plant being worked on moves to the front of the queue, so its progress stays its own even
      // when a plant ahead of it gets room on its pallet again. Work on a front plant whose pallet
      // has filled up is dropped rather than handed to the newcomer.
      if (next > 0) {
        refiner.queue.unshift(...refiner.queue.splice(next, 1));
        refiner.progress = 0;
      }
      refiner.progress += speed;
      const recipe = REFINE[refiner.queue[0]];
      if (refiner.progress >= recipe.ms) {
        refiner.queue.shift();
        refiner.output.push(recipe.out);
        // Work past the end of this plant goes on the next, so a slow frame rate makes no less. The
        // next is picked now, so the priority applies to it as well.
        refiner.progress = refiner.queue.length > 0 ? refiner.progress - recipe.ms : 0;
        const after = firstToRefine(state, refiner, state.priority[id]);
        if (after > 0) refiner.queue.unshift(...refiner.queue.splice(after, 1));
      }
    }
    if (secondPipe(state, id)) refineSecond(state, refiner, speed, state.priority[id]);
  }

  for (const id of CAULDRONS) {
    const cauldron = state[id];
    if (crew(state, id, workingAt) === 0) continue;
    const speed = dt * speedAt(state.upgrades[id].level);
    // The first pipe, then a second craftsman's: each brews on its own at the same speed.
    cauldron.brewing = brew(state, cauldron, cauldron.brewing, speed, state.priority[id]);
    if (secondPipe(state, id)) cauldron.brewing2 = brew(state, cauldron, cauldron.brewing2 ?? null, speed, state.priority[id]);
  }

  for (const id of BELTS) runBelt(state, id, dt);

  serveCustomers(state, dt, workingAt, atCounter);
  if (state.craftsmen.counter.level >= 2) collectTill(state);
  // Patience runs out faster while a potion wanted is sold dear.
  for (const order of state.orders) if (atCounter(order)) order.patience -= dt * patienceRate(state, order);
  // A customer who runs out of patience walks off, and the street thinks less of the shop. One of a
  // market day's crowd walking off loses the rush bonus.
  for (const order of state.orders) {
    if (order.patience > 0) continue;
    nudgeReputation(state, -REPUTATION_WALKED_OFF);
    if (order.rush && state.rush) state.rush.lost = true;
  }
  state.orders = state.orders.filter((o) => o.patience > 0);

  // At dusk a contract still open is missed and the next day's comes in.
  state.contract.dayLeft -= dt;
  if (state.contract.dayLeft <= 0) state.contract = contractFor(state, state.contract.day + 1, state.contract.kept);

  // On a market day, a crowd comes in at midday.
  const day = state.contract.day;
  if (isMarketDay(day) && state.contract.dayLeft <= DAY_MS / 2 && state.rush?.day !== day) startRush(state, rand);
  // Each new day the rival picks the potion it undercuts, after yesterday's sales are counted.
  if (state.rival.day !== day) rivalNewDay(state);
  // From the fifth day the plague spreads; each stage has so long before it comes back worse.
  if (!state.plague && day >= PLAGUE_DAY) state.plague = plagueAt(0);
  // A season after the cure, a new, stronger outbreak comes.
  if (state.plague?.cured) {
    const plague = state.plague;
    plague.curedDay ??= day;
    if (day >= plague.curedDay + SEASON_GAP) state.plague = plagueAt(0, 0, 0, (plague.season ?? 0) + 1);
  }
  // On a wagon day, the merchant wagon pulls up at the street door mid-morning and waits a while.
  if (isWagonDay(day) && state.wagon?.day !== day && state.contract.dayLeft <= DAY_MS * WAGON_ARRIVES) state.wagon = wagonFor(state, day);
  if (state.wagon && state.wagon.left > 0) state.wagon.left -= dt;
  const stage = plagueStage(state);
  if (stage) {
    state.plague!.left -= dt;
    if (state.plague!.left <= 0) relapse(state);
  }
  spreadBlight(state, dt, rand);

  state.nextOrderIn -= dt;
  if (state.nextOrderIn <= 0) {
    state.nextOrderIn = orderInterval(state, rand());
    if (state.orders.length < maxOrders(state)) state.orders.push(newOrder(state, rand));
  }
}

/**
 * A plague stage missed comes back worse: the same stage asks for `PLAGUE_RELAPSE_EXTRA` more potions
 * within the same time, and the street thinks less of the shop.
 */
function relapse(state: GameState) {
  const plague = state.plague!;
  plague.need = Math.min(MAX_PLAGUE_NEED, plague.need + PLAGUE_RELAPSE_EXTRA);
  plague.made = 0;
  plague.left = PLAGUE_STAGE_MS;
  plague.relapses++;
  nudgeReputation(state, -PLAGUE_RELAPSE_REPUTATION);
}

/**
 * Counts a potion sold towards the plague's stage: the stage's potion, or any on the last stage.
 * Once enough are sold the next stage comes; past the last, the Panacea is unlocked.
 */
function deliverForPlague(state: GameState, potion: PotionId) {
  const stage = plagueStage(state);
  const plague = state.plague;
  if (!stage || !plague || (stage.potion && stage.potion !== potion)) return;
  plague.made++;
  if (plague.made < plague.need) return;
  state.plague = plagueAt(plague.stage + 1, plague.relapses, 0, plague.season ?? 0);
}

/**
 * The blight: on a rainy day from `BLIGHT_DAY`, now and then a bed in a garden that stands is
 * blighted, and every blighted bed blights a neighbour in its garden every `BLIGHT_SPREAD_MS`. The
 * guild's herbalist keeps every bed clear. `rand` is only rolled when the blight can strike, so an
 * earlier day's randomness is as it was.
 */
function spreadBlight(state: GameState, dt: number, rand: () => number) {
  if (blightImmune(state)) {
    for (const plot of state.plots) plot.blighted = false;
    return;
  }
  const day = state.contract.day;
  const standing = (i: number) => gardenBuilt(state, gardenOf(i));
  if (day >= BLIGHT_DAY && weatherFor(day) === 'rain' && rand() < dt / BLIGHT_EVERY_MS) {
    const clear = state.plots.map((_, i) => i).filter((i) => standing(i) && !state.plots[i].blighted);
    if (clear.length > 0) blight(state, clear[Math.floor(rand() * clear.length)]);
  }
  state.plots.forEach((plot, i) => {
    if (!plot.blighted) return;
    plot.blightMs = (plot.blightMs ?? 0) + dt;
    if (plot.blightMs < BLIGHT_SPREAD_MS) return;
    plot.blightMs -= BLIGHT_SPREAD_MS;
    const near = plotNeighbours(i).filter((n) => !state.plots[n].blighted);
    if (near.length > 0) blight(state, near[Math.floor(rand() * near.length)]);
  });
}

function blight(state: GameState, plot: number) {
  state.plots[plot].blighted = true;
  state.plots[plot].blightMs = 0;
}

/** Whether a bed is blighted. */
export const isBlighted = (state: GameState, plotIndex: number) => !!state.plots[plotIndex].blighted;

/** The sickle clears a blighted bed, which then grows again from seed. */
export function clearBlight(state: GameState, plotIndex: number): Feedback | null {
  const plot = state.plots[plotIndex];
  if (!plot.blighted) return null;
  plot.blighted = false;
  plot.blightMs = 0;
  plot.grown = 0;
  return [t('blightCleared')];
}

/**
 * A new day for the rival: yesterday's sales of its potion are counted (more than its own keep the
 * streak going, fewer break it; a month's streak closes it for good), and it picks today's potion.
 * A day a kept contract ended early only has to beat the rival's sales for the part of it that went by.
 */
function rivalNewDay(state: GameState) {
  const { rival } = state;
  if (rival.open && rival.potion) {
    rival.streak = rival.sold > RIVAL_SALES * (rival.dayShare ?? 1) ? rival.streak + 1 : 0;
    if (rival.streak >= RIVAL_MONTH_DAYS) rival.open = false;
  }
  rival.day = state.contract.day;
  rival.sold = 0;
  delete rival.dayShare;
  rival.potion = rival.open ? rivalPotionFor(state, rival.day) : null;
}

/**
 * Which waiting plant the refining table works on, or -1 when there is none: the one at the front
 * while work on it has started, otherwise the first one to start on.
 */
export function refining(state: GameState, refiner: Refiner, first: PlantId | null = null) {
  const front = refiner.queue[0];
  if (refiner.progress > 0 && front && palletHasRoom(state, refiner.output, REFINE[front].out)) return 0;
  return firstToRefine(state, refiner, first);
}

/** How many of `item` stand on a station's output pallets. */
const onPallet = <T extends string>(output: T[], item: T) => output.filter((i) => i === item).length;

/**
 * Which waiting plant to start on: the first of the priority plant `first` whose output pallet has
 * room, or else the one whose good has the fewest on its output pallet (ties to the front of the
 * queue), or -1 when no output pallet has room.
 */
function firstToRefine(state: GameState, refiner: Refiner, first: PlantId | null) {
  const fits = (plant: PlantId) => palletHasRoom(state, refiner.output, REFINE[plant].out);
  const preferred = first ? refiner.queue.findIndex((plant) => plant === first && fits(plant)) : -1;
  if (preferred >= 0) return preferred;
  let best = -1;
  refiner.queue.forEach((plant, i) => {
    if (!fits(plant)) return;
    if (best < 0 || onPallet(refiner.output, REFINE[plant].out) < onPallet(refiner.output, REFINE[refiner.queue[best]].out)) best = i;
  });
  return best;
}

/**
 * Works a refining table's second pipe for `ms`: takes a plant off the queue when it has none (behind
 * the front one, which is the first pipe's), refines it and puts it out, then starts on the next with
 * the work left over. A finished plant waits there while its pallet is full.
 */
function refineSecond(state: GameState, refiner: Refiner, ms: number, first: PlantId | null) {
  if (!refiner.second) {
    const rest: Refiner = { ...refiner, queue: refiner.queue.slice(1) };
    const i = firstToRefine(state, rest, first);
    if (i < 0) return;
    refiner.second = { plant: refiner.queue.splice(i + 1, 1)[0], progress: 0 };
  }
  const second = refiner.second;
  const recipe = REFINE[second.plant];
  const over = second.progress + ms - recipe.ms;
  second.progress = Math.min(second.progress + ms, recipe.ms);
  if (over < 0 || !palletHasRoom(state, refiner.output, recipe.out)) return;
  refiner.output.push(recipe.out);
  refiner.second = null;
  // Work past the end of this plant goes on the next, so a slow frame rate makes no less.
  if (over > 0) refineSecond(state, refiner, over, first);
}

/**
 * Where each belt takes goods from: a ripe plant from either garden of its line, or a station's
 * finished goods; only goods whose lane has room at the start.
 */
function takeForBelt(state: GameState, belt: BeltId, fits: (id: ItemId, run: number) => boolean): BeltItem | null {
  if (belt === 'garden' || belt === 'garden2') {
    const line = belt === 'garden2' ? 2 : 1;
    const i = state.plots.findIndex((p, i) => GARDEN_LINE[gardenOf(i)] === line && isRipe(state, i) && fits(p.plant, GARDEN_RUN[gardenOf(i)]));
    if (i < 0) return null;
    state.plots[i].grown = 0;
    const run = GARDEN_RUN[gardenOf(i)];
    return { id: state.plots[i].plant, at: beltStart(belt, state.plots[i].plant, run), run };
  }
  const output = state[belt].output;
  const i = output.findIndex((id) => fits(id, 0));
  if (i < 0) return null;
  const id = output.splice(i, 1)[0];
  return { id, at: beltStart(belt, id) };
}

/** Where each belt hands its goods to: the station's tray they go in. */
function beltTarget(state: GameState, belt: BeltId): ItemId[] {
  const targets: Record<BeltId, ItemId[]> = {
    garden: state.refiner.queue,
    refiner: state.cauldron.contents,
    cauldron: state.counter.shelf,
    garden2: state.refiner2.queue,
    refiner2: state.cauldron2.contents,
    cauldron2: state.counter.shelf,
  };
  return targets[belt];
}

/** Hands an item from the end of a belt to the next station, if it has room. */
function giveFromBelt(state: GameState, belt: BeltId, id: ItemId) {
  const to = beltTarget(state, belt);
  if (!hasRoom(state, to, id)) return false;
  (to as ItemId[]).push(id);
  return true;
}

/**
 * Whether `to` has room for one more `id`: its pallet, or on the shop's shelf, that potion's shelf,
 * which holds its plain and fine ones together.
 */
function hasRoom(state: GameState, to: readonly ItemId[], id: ItemId) {
  if (to !== state.counter.shelf || !isSellable(id)) return palletHasRoom(state, to, id);
  return to.filter((p) => isSellable(p) && plainOf(p) === plainOf(id)).length < storage(state);
}

/**
 * Moves a built belt's items along, each in its own kind's lane. The item at the end of a lane is
 * handed over when the next station has room; until then it waits and the items behind it in that
 * lane queue up, while the other lanes keep moving. A new item is taken on once the last one in its
 * lane has moved a gap away from the start.
 */
function runBelt(state: GameState, id: BeltId, dt: number) {
  const belt = state.belts[id];
  if (!belt.built) return;
  const length = BELT_MS[id];
  // Each lane runs at half the belt's speed, as when belts had two lanes, so the nightshade's lane
  // didn't slow the others down.
  const step = (dt * beltSpeed(state)) / LANE_SHARE;
  // The item last seen in each lane: the one ahead of the next in that lane, and in the end the rearmost.
  const ahead = new Map<ItemId, BeltItem>();
  belt.items = belt.items.filter((item) => {
    const front = !ahead.has(item.id);
    if (front && item.at >= length && giveFromBelt(state, id, item.id)) return false;
    const room = front ? length : ahead.get(item.id)!.at - BELT_GAP_MS;
    item.at = Math.max(item.at, Math.min(item.at + step, room));
    ahead.set(item.id, item);
    return true;
  });
  // Goods get on at the start of their garden's run (or their kind's), a gap behind the last in their lane.
  const item = takeForBelt(state, id, (kind, run) => BELT_LANES[id].includes(kind) && (ahead.get(kind)?.at ?? Infinity) >= beltStart(id, kind, run) + BELT_GAP_MS);
  if (item) belt.items.push(item);
}

/** What share of a belt's speed each of its lanes runs at. */
const LANE_SHARE = 2;

/** Where goods of a kind get on a belt, in ms along its main run: the start of their own run, or of `run`. */
const beltStart = (id: BeltId, kind: ItemId, run?: number) => beltSpan(id, kind, run).start;

/**
 * Works one of a cauldron's pipes for `ms` and returns its brew afterwards: starts one when it has
 * none, and puts a finished one out, going straight on to the next with the work left over.
 */
function brew(state: GameState, cauldron: Cauldron, brewing: Brew | null, ms: number, first: PotionId | null) {
  // The recipe is picked when work starts, from everything in the cauldron by then.
  const current = brewing ?? startBrew(state, cauldron, first);
  if (!current) return null;
  current.progress += ms;
  if (current.progress < current.ms) return current;
  // The Panacea goes straight to the town, which it cures; a potion goes out on its pallet.
  if (current.out === PANACEA) {
    // Each season cured earns the town's seal, which raises every price.
    if (state.plague && !state.plague.cured) {
      state.plague.cured = true;
      state.plague.curedDay = state.contract.day;
      state.seals = (state.seals ?? 0) + 1;
    }
  } else cauldron.output.push(current.out);
  // Work past the end of this brew goes on the next, if there is one.
  const next = startBrew(state, cauldron, first);
  if (next) next.progress = current.progress - current.ms;
  return next;
}

/** How far ahead of the shop's shortest potion another may get before its cauldron saves the ingredients. */
const BREW_LEAD = 6;

/**
 * Starts the recipe the shop is shortest of (the potions on the cauldron's output pallets and on
 * the shop's shelf) among those the apothecary has learned and the cauldron has the ingredients and
 * room for, so every potion keeps coming. Ties go in recipe order. Takes the ingredients out of the cauldron and returns the brew
 * started, if any, for a pipe to work.
 */
function startBrew(state: GameState, cauldron: Cauldron, first: PotionId | null = null): Brew | null {
  // What the pipes are still brewing (a pipe's finished brew is out already), counted as made.
  const under = (c: Cauldron) => [c.brewing, c.brewing2].filter((b): b is Brew => !!b && b.progress < b.ms).map((b) => b.out);
  // Once the plague's last stage is over, the town's cure comes before everything, the moment one of
  // each refined good is in, unless a pipe already brews it.
  if (panaceaUnlocked(state) && ![state.cauldron, state.cauldron2].some((c) => under(c).includes(PANACEA))) {
    const left = without(cauldron.contents, PANACEA_RECIPE.inputs);
    if (left) {
      cauldron.contents = left;
      return { out: PANACEA, ms: PANACEA_RECIPE.ms, progress: 0 };
    }
  }
  // A fine potion counts as the potion it is. Counting the shelf too keeps one potion from piling up
  // there while another runs out, now that pixies empty the pallets as fast as they fill.
  const brewing = under(cauldron).filter((out): out is PotionId => out !== PANACEA);
  const stock = [...cauldron.output, ...state.counter.shelf].map(plainOf);
  const have = new Map(RECIPES.map((r) => [r.out, onPallet(stock, r.out)]));
  // The priority potion goes first whenever its ingredients are in; the rest by fewest in stock.
  const byNeed = [...RECIPES].sort((a, b) => Number(b.out === first) - Number(a.out === first) || have.get(a.out)! - have.get(b.out)!);
  // A potion already `BREW_LEAD` ahead of the one customers can ask for that the shop is shortest of
  // waits, so its ingredients go to the short one when they come in rather than into the pile.
  const shortest = Math.min(...orderable(state).map((p) => have.get(p) ?? 0));
  for (const recipe of byNeed) {
    if (!researched(state, recipe.out) || !palletHasRoom(state, [...cauldron.output, ...brewing], recipe.out)) continue;
    if (recipe.out !== first && have.get(recipe.out)! >= shortest + BREW_LEAD) continue;
    const left = without(cauldron.contents, recipe.inputs);
    if (left) {
      cauldron.contents = left;
      return { out: recipe.out, ms: recipe.ms, progress: 0 };
    }
  }
  return null;
}

function newOrder(state: GameState, rand: () => number, regulars = true): Order {
  // A busier town, with more customers, sends more two-potion orders and less patient customers.
  const busy = state.upgrades.customers.level;
  const potions = orderable(state);
  // Now and then a regular comes back, for the same potions as last time.
  const regular = regulars && state.regulars.length > 0 && rand() < REGULAR_CHANCE ? state.regulars.shift()! : null;
  const theirs = regular?.wants.filter((p) => potions.includes(p)) ?? [];
  let wants: PotionId[];
  if (theirs.length > 0) wants = theirs;
  else {
    const count = rand() < 0.35 + 0.2 * busy ? 2 : 1;
    // A potion sold cheap is asked for twice as often: it is in the hat twice.
    const hat = potions.flatMap((p) => Array.from({ length: SIGN_DEMAND[signOf(state, p)] }, () => p));
    wants = Array.from({ length: count }, () => hat[Math.floor(rand() * hat.length)]);
  }
  const back = theirs.length > 0;
  // Customers pay for each potion as they get it, with a counter bonus that is more generous, and
  // patience that lasts longer, at a better counter and on an easier difficulty. Regulars pay a
  // little more. The decaying tip comes on top, once the order is filled.
  const level = state.upgrades.counter.level;
  const pay = Object.fromEntries(wants.map((p) => [p, potionPrice(state, p) + 2 * (level + 1) + (back ? REGULAR_BONUS : 0)]));
  const maxPatience =
    ((60_000 + rand() * 30_000) * (1 + 0.25 * level) * byDifficulty(1.5, 1, 0.7)) / (1 + 0.5 * busy);
  const id = state.nextOrderId++;
  return {
    id,
    wants,
    asked: [...wants],
    pay,
    patience: maxPatience,
    maxPatience,
    tip: maxTip(wants.length),
    face: back ? regular!.face : id,
    ...(back ? { regular: true } : {}),
  };
}

/**
 * A market day's crowd: up to `RUSH_SIZE` customers come in at once, filling every free place at the
 * counter and `RUSH_EXTRA` more. Regulars stay home that day.
 */
function startRush(state: GameState, rand: () => number) {
  const room = Math.max(0, maxOrders(state) + RUSH_EXTRA - state.orders.length);
  const size = Math.min(RUSH_SIZE, room);
  state.rush = { day: state.contract.day, size, served: 0, lost: size === 0, paid: false };
  for (let i = 0; i < size; i++) state.orders.push({ ...newOrder(state, rand, false), rush: true });
}

/** Whether a plot can be harvested: grown, in a garden that is there. */
export function isRipe(state: GameState, plotIndex: number) {
  const plot = state.plots[plotIndex];
  return !plot.blighted && plot.grown >= GROW_MS[plot.plant] && gardenBuilt(state, gardenOf(plotIndex));
}

/** Outcome of an interaction, as short lines for floating feedback text. */
export type Feedback = string[];

const freeHands = (state: GameState) => carryCapacity(state) - state.carrying.length;

export function harvest(state: GameState, plotIndex: number): Feedback {
  const plot = state.plots[plotIndex];
  if (!isRipe(state, plotIndex)) return [t('notRipe')];
  if (freeHands(state) === 0) return [t('handsFull')];
  plot.grown = 0;
  state.carrying.push(plot.plant);
  return [t('gained', { item: itemName(plot.plant) })];
}

/**
 * Serving at the counter. The doctor on the work spot hands customers everything on the shelf they
 * want at once. Craftsmen take SERVE_MS over each potion, sped up by each pair of hands.
 */
function serveCustomers(state: GameState, dt: number, workingAt: StationId | null, atCounter: (order: Order) => boolean) {
  const { counter } = state;
  const hired = state.craftsmen.counter.level;
  if (hired === 0) {
    if (workingAt === 'counter') serveFromShelf(state, atCounter);
    return;
  }
  if (!state.orders.some((o) => atCounter(o) && o.wants.some((want) => counter.shelf.some((p) => plainOf(p) === want)))) {
    counter.serving = 0;
    return;
  }
  counter.serving = (counter.serving ?? 0) + dt * hired;
  if (counter.serving < SERVE_MS) return;
  counter.serving -= SERVE_MS;
  serveFromShelf(state, atCounter, 1);
}

/**
 * Customers take what they ordered from the counter shelf, at most `limit` potions, and pay into
 * the till, less for each potion of the kind still stocked after theirs (`stockedPay`). A fine
 * potion of the kind goes first and pays `FINE_BONUS` times as much. Orders the shelf can fill
 * completely go first (oldest first); leftover matching potions go towards the rest.
 */
function serveFromShelf(state: GameState, atCounter: (order: Order) => boolean, limit = Infinity) {
  const { counter } = state;
  if (counter.shelf.length === 0) return;
  const give = (order: Order) => {
    order.wants = order.wants.filter((want) => {
      if (limit <= 0) return true;
      let i = counter.shelf.indexOf(FINE[want]);
      const fine = i >= 0;
      if (!fine) i = counter.shelf.indexOf(want);
      if (i < 0) return true;
      counter.shelf.splice(i, 1);
      // The stock cut counts the potions of the kind on the shelf, this one included.
      const stocked = counter.shelf.filter((p) => plainOf(p) === want).length + 1;
      const sign = signOf(state, want);
      // A fine one pays more, the shelf's sign scales the price, and the rival's cut comes off a plain one.
      let pay = Math.round((order.pay[want] ?? 0) * SIGN_PAY[sign] * (fine ? FINE_BONUS : 1));
      if (!fine && rivalUndercuts(state, want)) pay = Math.round(pay * (1 - RIVAL_CUT));
      counter.till += stockedPay(pay, stocked, storage(state));
      state.sold++;
      nudgeReputation(state, SIGN_REPUTATION[sign]);
      if (rivalUndercuts(state, want)) state.rival.sold++;
      if (contractWants(state.contract, want)) deliverForContract(state, want);
      deliverForPlague(state, want);
      limit--;
      return false;
    });
    // A filled order tips what is left of its tip, which shrank while the customer waited.
    if (order.wants.length === 0) {
      const tip = tipNow(order);
      counter.till += tip;
      state.tips += tip;
      orderFilled(state, order);
    }
  };
  // Only customers standing at the counter get served.
  const waiting = state.orders.filter(atCounter);
  for (const order of waiting) if (canFill(counter.shelf, order)) give(order);
  for (const order of waiting) if (order.wants.length > 0) give(order);
  state.orders = state.orders.filter((o) => o.wants.length > 0);
}

/**
 * A customer leaves served: the street thinks better of the shop, one who was served quickly comes
 * back as a regular, and one of a market day's crowd counts towards the rush bonus.
 */
function orderFilled(state: GameState, order: Order) {
  nudgeReputation(state, REPUTATION_SERVED);
  if (tipLeft(order) >= REGULAR_TIP_LEFT) {
    const asked = order.asked ?? (Object.keys(order.pay) as PotionId[]);
    if (state.regulars.length >= MAX_REGULARS) state.regulars.shift();
    state.regulars.push({ face: order.face ?? order.id, wants: asked });
  }
  const rush = state.rush;
  if (!order.rush || !rush) return;
  rush.served++;
  if (rush.served >= rush.size && !rush.lost && !rush.paid) {
    rush.paid = true;
    state.coins += RUSH_BONUS * rush.size;
  }
}

/**
 * Counts a potion of today's contract as delivered. Once enough are, the reward goes straight into
 * the purse and the next day's contract comes in at once.
 */
function deliverForContract(state: GameState, potion: PotionId) {
  const contract = state.contract;
  const { bundle } = contract;
  if (contract.potion === potion && contract.made < contract.need) contract.made++;
  else if (bundle?.potion === potion) bundle.made++;
  if (contract.made < contract.need || (bundle && bundle.made < bundle.need)) return;
  state.coins += contract.reward;
  state.rival.dayShare = 1 - contract.dayLeft / DAY_MS;
  state.contract = contractFor(state, contract.day + 1, contract.kept + 1);
}

function canFill(shelf: readonly ItemId[], order: Order) {
  return without(shelf.map((p) => (isSellable(p) ? plainOf(p) : p)), order.wants) !== null;
}

/** What is left of `items` once one of each of `taken` is taken out, or null if any is missing. */
function without<T extends ItemId>(items: readonly T[], taken: readonly T[]): T[] | null {
  const left = [...items];
  for (const item of taken) {
    const i = left.indexOf(item);
    if (i < 0) return null;
    left.splice(i, 1);
  }
  return left;
}

// Floor markers: while the doctor stands on one, the scene calls its action repeatedly, and each
// call moves at most one item (or one handful of coins). They return null when nothing moved.

/** Takes the topmost carried item matching `pick` that has room on its pallet in `to` off the doctor's back. */
function takeTopFromBack<T extends ItemId>(state: GameState, pick: (id: ItemId) => id is T, to: readonly ItemId[]): T | null {
  for (let i = state.carrying.length - 1; i >= 0; i--) {
    const id = state.carrying[i];
    if (pick(id) && hasRoom(state, to, id)) {
      state.carrying.splice(i, 1);
      return id;
    }
  }
  return null;
}

/**
 * Picks one item up off a station's pallets, so the hands fill with a mix of every kind there: the
 * kind the doctor carries fewest of, then the kind with the most waiting, then the first.
 */
function pickUpOne(state: GameState, from: ItemId[]): Feedback | null {
  if (from.length === 0 || freeHands(state) === 0) return null;
  const held = (id: ItemId) => state.carrying.filter((i) => i === id).length;
  const waiting = (id: ItemId) => from.filter((i) => i === id).length;
  let best = 0;
  from.forEach((id, i) => {
    const other = from[best];
    if (held(id) < held(other) || (held(id) === held(other) && waiting(id) > waiting(other))) best = i;
  });
  const id = from.splice(best, 1)[0];
  state.carrying.push(id);
  return [t('gained', { item: itemName(id) })];
}

export function dropAtRefiner(state: GameState, id: RefinerId = 'refiner'): Feedback | null {
  const plant = takeTopFromBack(state, isPlant, state[id].queue);
  if (!plant) return null;
  state[id].queue.push(plant);
  return [t('handedOver', { item: itemName(plant) })];
}

export const pickUpFromRefiner = (state: GameState, id: RefinerId = 'refiner') => pickUpOne(state, state[id].output);

export function dropInCauldron(state: GameState, id: CauldronId = 'cauldron'): Feedback | null {
  const good = takeTopFromBack(state, isRefined, state[id].contents);
  if (!good) return null;
  state[id].contents.push(good);
  return [t('handedOver', { item: itemName(good) })];
}

/**
 * Picks up a potion at the cauldron: the brew in it while it is in its fine window, taken out early
 * as a Fine potion, or else a finished one from its pallet.
 */
export function pickUpFromCauldron(state: GameState, id: CauldronId = 'cauldron'): Feedback | null {
  const cauldron = state[id];
  // Either pipe's brew can be taken out fine.
  // The Panacea is for the town, so it is never taken out early.
  const fineIn = (brew: Brew | null | undefined) => inFineWindow(brew ?? null) && brew!.out !== PANACEA;
  const pipe = fineIn(cauldron.brewing) ? 'brewing' : fineIn(cauldron.brewing2) ? 'brewing2' : null;
  if (pipe && freeHands(state) > 0) {
    const fine = FINE[cauldron[pipe]!.out as PotionId];
    cauldron[pipe] = null;
    state.carrying.push(fine);
    return [t('gainedFine', { item: itemName(fine) })];
  }
  return pickUpOne(state, cauldron.output);
}

const UPGRADE_STEP = 5;
/** Pays a handful of coins towards `cost` (more the longer the doctor stays, see `payment`); once it is fully paid, `complete` says what was bought. */
function pay(state: GameState, toward: { paid: number }, cost: number, complete: () => string): Feedback {
  const coins = Math.min(UPGRADE_STEP * payment.boost, state.coins, cost - toward.paid);
  state.coins -= coins;
  toward.paid += coins;
  return toward.paid < cost ? [t('coinsPaid', { n: coins })] : [complete()];
}

/** Pays towards the next of something bought in levels, going up once fully paid. */
function payLevel(state: GameState, upgrade: Upgrade, max: number, cost: number, done: () => string): Feedback | null {
  if (upgrade.level >= max || state.coins === 0) return null;
  return pay(state, upgrade, cost, () => {
    upgrade.level++;
    upgrade.paid = 0;
    return done();
  });
}

/** Pays a handful of coins towards an upgrade's next level, levelling it up once fully paid. */
export function payUpgrade(state: GameState, id: UpgradeId): Feedback | null {
  if (!unlocked(state, `level-${id}`)) return null;
  const upgrade = state.upgrades[id];
  // A study level teaches a recipe; levels count from 0, so the one just learned is at level - 1.
  const done = () =>
    id === 'research'
      ? t('learned', { potion: itemName(RESEARCH_ORDER[upgrade.level - 1]) })
      : id === 'craftOrder' || id === 'priceSigns' || id === 'replant'
        ? t('learned', { potion: t(UPGRADES[id].name) })
        : t('levelUp', { name: t(UPGRADES[id].name), level: upgrade.level + 1 });
  return payLevel(state, upgrade, UPGRADES[id].max, upgradeCost(id, upgrade.level), done);
}

/**
 * Moves a crafting station's priority on to the next choice: from none (the station's own order) to
 * each plant or potion it makes in turn, and back to none.
 */
export function cyclePriority(state: GameState, id: CraftingId): Feedback | null {
  if (!studied(state, 'craftOrder')) return null;
  // A cauldron can put first only the potions the apothecary has learned.
  const potions = POTIONS.filter((p) => researched(state, p));
  const choices: (PlantId | PotionId | null)[] = [null, ...(id === 'refiner' || id === 'refiner2' ? PLANTS : potions)];
  const next = choices[(choices.indexOf(state.priority[id]) + 1) % choices.length];
  (state.priority as Record<CraftingId, PlantId | PotionId | null>)[id] = next;
  return [next ? t('firstChoice', { item: itemName(next) }) : t('anyOrder')];
}

/** Moves a shelf's price sign on: Fair to Dear, Dear to Cheap, Cheap to Fair. */
export function cycleSign(state: GameState, potion: PotionId): Feedback | null {
  if (!studied(state, 'priceSigns')) return null;
  const next = PRICE_SIGNS[(PRICE_SIGNS.indexOf(signOf(state, potion)) + 1) % PRICE_SIGNS.length];
  state.signs[potion] = next;
  return [t(SIGN_SET[next], { potion: itemName(potion) })];
}

/**
 * Switches a garden's beds to the next plant its line grows (see `plantChoices`). Every bed starts
 * again from seed, clear of blight, so the switch costs a crop.
 */
export function replantGarden(state: GameState, garden: number): Feedback | null {
  if (!studied(state, 'replant')) return [t('learnLesson', { lesson: t('replanting') })];
  const choices = plantChoices(state, garden);
  const now = gardenPlant(state, garden);
  const next = choices[(choices.indexOf(now) + 1) % choices.length];
  if (!next || next === now) return [t('nothingToPlant')];
  // Changed in place: the scene keeps each bed's plot object.
  for (let i = garden * PLOTS_PER_GARDEN; i < (garden + 1) * PLOTS_PER_GARDEN; i++) {
    Object.assign(state.plots[i], { plant: next, grown: 0, blighted: false, blightMs: 0 });
  }
  return [t('replanted', { garden: t(GARDEN_NAMES_IN[next]) })];
}

/** Pays a handful of coins towards hiring a station's next craftsman, who starts work once fully paid. */
export function payCraftsman(state: GameState, id: StationId): Feedback | null {
  if (!unlocked(state, `hire-${id}`)) return null;
  const hired = state.craftsmen[id];
  return payLevel(state, hired, MAX_CRAFTSMEN, craftsmanCost(hired.level), () => t('craftsmanHired'));
}

/** Pays towards entry to the guild, which puts its upgrades up for sale. */
export function joinGuild(state: GameState): Feedback | null {
  if (!unlocked(state, 'guild')) return null;
  return payToward(state, state.guild, GUILD_COST, t('welcomeGuild'));
}

/** Pays towards a build, which is done once fully paid. */
function payToward(state: GameState, build: Build, cost: number, done: string): Feedback | null {
  if (build.built || state.coins === 0) return null;
  return pay(state, build, cost, () => {
    build.built = true;
    return done;
  });
}

const BELT_NAMES: Record<BeltId, TextKey> = {
  garden: 'gardenPixies',
  refiner: 'tablePixies',
  cauldron: 'cauldronPixies',
  garden2: 'gardenPixies',
  refiner2: 'tablePixies',
  cauldron2: 'cauldronPixies',
};

/** Each belt's twin on the other line, which takes the same kind of goods by hand until it is built. */
const OTHER_LINE: Record<BeltId, BeltId> = {
  garden: 'garden2',
  refiner: 'refiner2',
  cauldron: 'cauldron2',
  garden2: 'garden',
  refiner2: 'refiner',
  cauldron2: 'cauldron',
};

/**
 * Whether a belt's step is still done by hand: it isn't built, while a station at its ends stands
 * (not counting the counter both lines share), or for the second line's garden belt, a field.
 */
export const doneByHand = (state: GameState, id: BeltId) =>
  !state.belts[id].built &&
  (BELT_ENDS[id].some((station) => station !== 'counter' && stationBuilt(state, station)) ||
    (id === 'garden2' && anyFieldBuilt(state)));

/**
 * Pays a handful of coins towards building a belt, which starts running once fully paid. The belt
 * takes over that step of the work, so the goods it carries go from the doctor's hands onto it,
 * unless the other line still takes them by hand. They get on one after another, a gap apart in each
 * lane, so those waiting their turn stand just before the start, out of sight.
 */
export function payBelt(state: GameState, id: BeltId): Feedback | null {
  if (!beltBuildable(state, id) || !unlocked(state, `belt-${id}`)) return null;
  const belt = state.belts[id];
  const feedback = payToward(state, belt, BELT_COST[id], t('pixiesHired', { pixies: t(BELT_NAMES[id]) }));
  if (!feedback || !belt.built) return feedback;
  if (doneByHand(state, OTHER_LINE[id])) return feedback;
  const carried = (item: ItemId) => BELT_LANES[id].includes(item);
  const loaded = state.carrying.filter(carried);
  state.carrying = state.carrying.filter((item) => !carried(item));
  loaded.forEach((item, i) => {
    const ahead = loaded.slice(0, i).filter((other) => other === item).length;
    belt.items.push({ id: item, at: beltStart(id, item) - ahead * BELT_GAP_MS });
  });
  return loaded.length > 0 ? [...feedback, t('toPixies', { n: loaded.length })] : feedback;
}

/** Throws away the `i`th thing the doctor carries (bottom first), for goods that are no longer needed. */
export function dropItem(state: GameState, i: number): Feedback | null {
  const [item] = state.carrying.splice(i, 1);
  return item ? [t('droppedItem', { item: itemName(item) })] : null;
}

/**
 * Serving by hand: the customer of order `id`, once at the counter, gets everything they want that
 * is on the shelf at once, as the doctor on the counter's work spot hands it over.
 */
export function serveOrder(state: GameState, id: number): Feedback | null {
  const order = state.orders.find((o) => o.id === id);
  if (!order) return null;
  const wanted = [...order.wants];
  serveFromShelf(state, (o) => o.id === id);
  const left = state.orders.find((o) => o.id === id)?.wants ?? [];
  const given = [...wanted];
  for (const want of left) given.splice(given.indexOf(want), 1);
  return given.length > 0 ? given.map((p) => t('handedOver', { item: itemName(p) })) : [t('notOnShelf')];
}

/** What can be built on the expansion: its land first, then a field, the table or the cauldron. */
export type ExpansionPart = 'land' | 'field1' | 'field2' | 'refiner' | 'cauldron';

/** Pays a handful of coins towards part of the expansion; everything but the land needs the land first. */
export function payExpansion(state: GameState, part: ExpansionPart): Feedback | null {
  const { expansion } = state;
  if (part === 'land') return unlocked(state, 'land') ? payToward(state, expansion.land, EXPANSION_COST.land, t('landBought')) : null;
  if (!expansion.land.built) return null;
  if (part === 'refiner') return payToward(state, expansion.refiner, EXPANSION_COST.refiner, t('tableBuilt'));
  if (part === 'cauldron') return payToward(state, expansion.cauldron, EXPANSION_COST.cauldron, t('cauldronBuilt'));
  const field = expansion.fields[part === 'field1' ? 0 : 1];
  return payToward(state, field, EXPANSION_COST.field, t('fieldPlanted'));
}

/** Pays a handful of coins towards planting a shade garden: the first line's (`line` 0), or the second's once its land is bought. */
export function payShade(state: GameState, line: 0 | 1): Feedback | null {
  if (line === 0 ? !unlocked(state, 'shade') : !state.expansion.land.built) return null;
  return payToward(state, state.shade[line], SHADE_COST[line], t('shadePlanted'));
}

export function stockShelf(state: GameState): Feedback | null {
  const potion = takeTopFromBack(state, isSellable, state.counter.shelf);
  if (!potion) return null;
  state.counter.shelf.push(potion);
  return [t('handedOver', { item: itemName(potion) })];
}

export function collectTill(state: GameState): Feedback | null {
  const { counter } = state;
  if (counter.till === 0) return null;
  state.coins += counter.till;
  const feedback = [t('coinsGained', { n: counter.till })];
  counter.till = 0;
  return feedback;
}

/**
 * Sells the merchant wagon a whole crate of its potion from the shelf, fine ones last, at the
 * wagon's price each, straight into the purse. Only a full crate will do.
 */
export function sellToWagon(state: GameState): Feedback | null {
  const wagon = state.wagon;
  if (!wagon || !wagonHere(state)) return null;
  const { shelf } = state.counter;
  const have = shelf.filter((p) => plainOf(p) === wagon.potion).length;
  if (have < wagon.crate) return [t('wagonWants', { crate: potionCount(wagon.potion, wagon.crate) })];
  for (let n = 0; n < wagon.crate; n++) {
    const plain = shelf.indexOf(wagon.potion);
    shelf.splice(plain >= 0 ? plain : shelf.indexOf(FINE[wagon.potion]), 1);
  }
  wagon.sold = true;
  const coins = wagon.crate * wagon.pay;
  state.coins += coins;
  return [t('crateSold', { n: coins })];
}

/** Moves the herb market's buy marker on to the next good. */
export function cycleMarketPick(state: GameState): Feedback {
  const next = HERBS[(HERBS.indexOf(state.marketPick) + 1) % HERBS.length];
  state.marketPick = next;
  return [t('marketPick', { item: itemName(next) })];
}

/** Buys one of the herb market's chosen good into the doctor's hands, at today's price. */
export function buyHerb(state: GameState): Feedback | null {
  if (!marketOpen(state) || freeHands(state) === 0) return null;
  const herb = state.marketPick;
  const price = herbBuyPrice(state.contract.day, herb);
  if (state.coins < price) return null;
  state.coins -= price;
  state.carrying.push(herb);
  return [t('bought', { item: itemName(herb), coins: price })];
}

/** Sells the topmost plant or refined good the doctor carries to the herb market, at today's price. */
export function sellHerb(state: GameState): Feedback | null {
  if (!marketOpen(state)) return null;
  for (let i = state.carrying.length - 1; i >= 0; i--) {
    const id = state.carrying[i];
    if (!(HERBS as readonly ItemId[]).includes(id)) continue;
    const price = herbSellPrice(state.contract.day, id as HerbId);
    state.carrying.splice(i, 1);
    state.coins += price;
    return [t('sold', { item: itemName(id), coins: price })];
  }
  return null;
}
