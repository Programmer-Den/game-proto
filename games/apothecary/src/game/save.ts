import type { ItemId } from './items';
import { BELT_GAP_MS, BELT_MS, BELTS, COLUMNS_BELT_MS, COLUMNS_LAYOUT, FEEDERS_LAYOUT, GUILD_UPGRADES, HEART_LAYOUT, PLOTS_PER_GARDEN, U_BELT_MS, createInitialState, gardenOf, type GameState, type Plot } from './state';
import { beltSpan } from '../scenes/layout';
import { normalizeTown, type ShopState } from './town';

const KEY = 'apothecary-save';

/** Loads the saved game, or a fresh one if there is none or it is from an incompatible version. */
export function loadState(): GameState {
  const fresh = createInitialState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh;
    const { thin, ...saved } = JSON.parse(raw) as Partial<GameState> & { thin?: boolean };
    if (saved.version !== fresh.version || !saved.plots) return fresh;
    // Fields added after the save was written fall back to their defaults, including new plots,
    // stations' upgrades, craftsmen and belts, the contract, sales and tips counts, the last-seen
    // time (0, so a save from before them catches up on nothing), the shade gardens, the
    // reputation, the regulars, the market day's rush, the plague, the price signs, the rival,
    // the town seals, the merchant wagon and the herb market's pick.
    const state: GameState = {
      ...fresh,
      ...saved,
      plots: keepsPlots(saved.plots) ? [...saved.plots, ...fresh.plots.slice(saved.plots.length)] : fresh.plots,
      upgrades: { ...fresh.upgrades, ...saved.upgrades },
      craftsmen: { ...fresh.craftsmen, ...saved.craftsmen },
      belts: { ...fresh.belts, ...saved.belts },
      expansion: { ...fresh.expansion, ...saved.expansion },
      priority: { ...fresh.priority, ...saved.priority },
      // Customers from before they paid per potion go home; new ones come along soon.
      orders: (saved.orders ?? []).filter((o) => o.pay),
      town: normalizeTown(saved.town),
    };
    // A save from before the guild took members has already joined if it bought any guild upgrade.
    if (!saved.guild && GUILD_UPGRADES.some((id) => state.upgrades[id].level > 0 || state.upgrades[id].paid > 0)) {
      state.guild = { built: true, paid: 0 };
    }
    // The rest grant what an older save was already using. A thin save (see `thinSave`) leaves out the
    // upgrades never bought, so a missing one there is simply at level 0.
    if (!thin) grantLessons(saved, state, fresh);
    // Rescale first: the joins `ontoOwnRuns` moves goods up to are on today's shorter belts.
    if ((saved.layout ?? 0) < COLUMNS_LAYOUT) ontoColumns(state);
    if ((saved.layout ?? 0) < HEART_LAYOUT) ontoHeart(state);
    if ((saved.layout ?? 0) < FEEDERS_LAYOUT) ontoOwnRuns(state);
    // The stations have moved since this save; start the doctor somewhere clear of them.
    if (saved.layout !== fresh.layout) return { ...state, layout: fresh.layout, player: fresh.player };
    return state;
  } catch {
    return fresh;
  }
}

/** Grants the lessons an older save was already using before the study taught them. */
function grantLessons(saved: Partial<GameState>, state: GameState, fresh: GameState) {
  // A save from before the study brewed Shadow Elixirs once a shade garden grew; it keeps them, and
  // the Vigour Tonic before it in the study's order.
  if (!saved.upgrades?.research && state.shade.some((g) => g.built)) state.upgrades.research = { level: 2, paid: 0 };
  // A save from before the study taught the crafting order and the price signs keeps whichever it
  // was already using.
  if (!saved.upgrades?.craftOrder && Object.values(state.priority).some((p) => p)) state.upgrades.craftOrder = { level: 1, paid: 0 };
  if (!saved.upgrades?.priceSigns && Object.values(state.signs ?? {}).some((s) => s && s !== 'fair')) state.upgrades.priceSigns = { level: 1, paid: 0 };
  // Likewise replanting, for a save with a garden already growing something else.
  if (!saved.upgrades?.replant && state.plots.some((p, i) => p.plant !== fresh.plots[i]?.plant)) state.upgrades.replant = { level: 1, paid: 0 };
}

/**
 * Whether saved plots still fit today's gardens: every bed of a garden grows the same plant (a
 * replanted garden switches all nine). Saves from when a garden had three plots don't, and start
 * again with every plot ripe.
 */
function keepsPlots(plots: Plot[]) {
  return plots.every((plot, i) => plots[gardenOf(i) * PLOTS_PER_GARDEN].plant === plot.plant);
}

/**
 * Goods saved on a belt before they got on at the start of their own run (mandrakes now come in on
 * their patch's feeder) were drawn on the main run, so any short of where their run joins it move up
 * to the join, or a gap behind the one ahead of them in their lane. They never move back.
 */
function ontoOwnRuns(state: GameState) {
  for (const id of BELTS) {
    // The items in each lane come front first.
    const ahead = new Map<ItemId, number>();
    for (const item of state.belts[id].items) {
      const { join } = beltSpan(id, item.id);
      if (item.at < join) item.at = Math.max(item.at, Math.min(join, (ahead.get(item.id) ?? Infinity) - BELT_GAP_MS));
      ahead.set(item.id, item.at);
    }
  }
}

/**
 * Belts got shorter when the map went to two columns, so goods saved on one keep the same share of
 * the way along it.
 */
function ontoColumns(state: GameState) {
  for (const id of BELTS) for (const item of state.belts[id].items) item.at *= COLUMNS_BELT_MS[id] / U_BELT_MS[id];
}

/**
 * Routes got shorter again when the shop moved into the middle, so goods saved on one keep the same
 * share of the way along it.
 */
function ontoHeart(state: GameState) {
  for (const id of BELTS) for (const item of state.belts[id].items) item.at *= BELT_MS[id] / COLUMNS_BELT_MS[id];
}

/** Saves the game, stamped with the wall-clock time, so the next load can catch up on the time away. */
export function saveState(state: GameState) {
  state.lastSeen = Date.now();
  try {
    localStorage.setItem(KEY, JSON.stringify(thinSave(state)));
  } catch {
    // Storage can be full or blocked (private mode); the game keeps running unsaved.
  }
}

/**
 * Whether a saved entry is still as the game starts it: an upgrade never bought (`level` and `paid`
 * 0), a build, belt or route never started (`built` false, nothing paid, nothing on it).
 */
const untouched = (entry: unknown) =>
  typeof entry === 'object' && entry !== null && Object.values(entry).every((v) => v === 0 || v === false || (Array.isArray(v) && v.length === 0));

/** A record without its untouched entries; the load spreads it over the defaults again. */
const touched = <T extends object>(record: T) => Object.fromEntries(Object.entries(record).filter(([, v]) => !untouched(v))) as Partial<T>;

/**
 * The state as saved: the upgrades, craftsmen, belts, second-line builds and the town shops'
 * routes and upgrades still at their start are left out, which keeps progress codes short. `thin`
 * tells `loadState` that a missing upgrade is one never bought, not one from before it existed.
 */
function thinSave(state: GameState) {
  const shops: Partial<Record<string, Partial<ShopState>>> = {};
  for (const [id, shop] of Object.entries(state.town.shops)) {
    const { recipes, line2, ...rest } = shop;
    shops[id] = {
      ...rest,
      ...touched({ recipes, line2 }),
      routes: touched(shop.routes),
      counter: touched(shop.counter) as ShopState['counter'],
      outfitter: touched(shop.outfitter) as ShopState['outfitter'],
      study: touched(shop.study) as ShopState['study'],
      guild: touched(shop.guild) as ShopState['guild'],
    } as Partial<ShopState>;
  }
  return {
    ...state,
    thin: true,
    upgrades: touched(state.upgrades),
    craftsmen: touched(state.craftsmen),
    belts: touched(state.belts),
    expansion: touched(state.expansion),
    town: { ...state.town, shops },
  };
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing to clear.
  }
}
