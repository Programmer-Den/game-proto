import { POTIONS, REFINED, isRefined, type RefinedId } from './items';
import { SEAL_PRICE, nudgeReputation, plagueAt, plagueStage, researched, type GameState } from './state';
import type { Feedback } from './sim';
import { itemName, t, type TextKey } from '../i18n';

// Round 4 of the game loop: the alchemy bench (AP18), herb expeditions (AP19) and shop decor (AP20).
// The rules live here, free of Phaser; `GameScene` draws them and `tick` runs the courier.

/** Rare herbs that grow only out in the wild, fetched by the courier (AP19). */
export type WildHerb = 'silverleaf' | 'bogbloom' | 'frostcap';
export const WILD_HERBS: readonly WildHerb[] = ['silverleaf', 'bogbloom', 'frostcap'];
/** What the alchemy bench mixes: refined goods from the yard and wild herbs from the satchel. */
export type Ingredient = RefinedId | WildHerb;
export const isWild = (id: string): id is WildHerb => (WILD_HERBS as readonly string[]).includes(id);
/** Whether an ingredient or bench potion is a refined good from the yard (`isRefined` only knows items). */
export const isGood = (id: string): id is RefinedId => (REFINED as readonly string[]).includes(id);

/** Where the courier goes, what grows there, how long a trip takes and how much comes back. */
export type Place = 'forest' | 'marsh' | 'mountains';
export const PLACES: readonly Place[] = ['forest', 'marsh', 'mountains'];
export const TRIPS: Record<Place, { herb: WildHerb; ms: number; brings: number }> = {
  forest: { herb: 'silverleaf', ms: 3 * 60_000, brings: 3 },
  marsh: { herb: 'bogbloom', ms: 5 * 60_000, brings: 3 },
  mountains: { herb: 'frostcap', ms: 8 * 60_000, brings: 3 },
};
/** What hiring the courier costs, once. */
export const COURIER_COST = 400;
/** The most of each wild herb the satchel holds; a courier coming back to a full one brings the rest home for nothing. */
export const SATCHEL = 12;
/** The most of each refined good the bench keeps for mixing. */
export const BENCH_STOCK = 6;
/** How many ingredients a mix takes: two or three. */
export const MIX_MIN = 2;
export const MIX_MAX = 3;

/**
 * The potions the bench can discover, each from its own mix (in any order). Some sell well, and the
 * cures put an end to a stage of the plague at once. Their art and names are keyed by id.
 */
export type MixId = 'silverBalm' | 'marshCordial' | 'frostDraught' | 'feverCure' | 'starlightElixir' | 'plagueBane';
export interface Mix {
  id: MixId;
  inputs: Ingredient[];
  price: number;
  cures?: true;
}
export const MIXES: readonly Mix[] = [
  { id: 'silverBalm', inputs: ['silverleaf', 'flour'], price: 45 },
  { id: 'marshCordial', inputs: ['bogbloom', 'mandrakeSeeds'], price: 60 },
  { id: 'frostDraught', inputs: ['frostcap', 'nightshadeExtract'], price: 85 },
  { id: 'feverCure', inputs: ['silverleaf', 'bogbloom', 'flour'], price: 70, cures: true },
  { id: 'starlightElixir', inputs: ['silverleaf', 'frostcap', 'nightshadeExtract'], price: 170 },
  { id: 'plagueBane', inputs: ['bogbloom', 'frostcap', 'mandrakeSeeds'], price: 110, cures: true },
];
/** What a mix that matches no recipe makes: a cheap Murky Draught. */
export const MURKY = 'murkyDraught';
export const MURKY_PRICE = 3;
export type Brewed = MixId | typeof MURKY;

/** The bench, the courier and the satchel of wild herbs. */
export interface Alchemy {
  /** Refined goods dropped at the bench. */
  stock: Partial<Record<RefinedId, number>>;
  /** What is in the mixing bowl now, in the order added. */
  mix: Ingredient[];
  /** The potions discovered, in the order found. */
  found: MixId[];
  /** Potions mixed and not yet sold or used. */
  rack: Partial<Record<Brewed, number>>;
  /** Wild herbs the courier brought back. */
  wild: Partial<Record<WildHerb, number>>;
  courier: { hired: boolean; trip: { to: Place; left: number } | null; trips: number };
}
export const createAlchemy = (): Alchemy => ({ stock: {}, mix: [], found: [], rack: {}, wild: {}, courier: { hired: false, trip: null, trips: 0 } });

/** The bench and the courier's post open once the study has taught every recipe: the late game's discovery goal. */
export const alchemyOpen = (state: GameState) => POTIONS.every((p) => researched(state, p));

const sameMix = (a: Ingredient[], b: Ingredient[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
/** The recipe a set of ingredients makes, or undefined for a Murky Draught. */
export const mixFor = (inputs: Ingredient[]) => MIXES.find((m) => sameMix(m.inputs, inputs));
/** What a bench potion sells for: town seals raise it like every potion. */
export const brewedPrice = (state: GameState, id: Brewed) =>
  id === MURKY ? MURKY_PRICE : Math.round(MIXES.find((m) => m.id === id)!.price * (1 + SEAL_PRICE * (state.seals ?? 0)));
/** How many of an ingredient are at hand for the bowl: refined goods on the bench, wild herbs in the satchel. */
export const onHand = (state: GameState, id: Ingredient) => (isWild(id) ? state.alchemy.wild[id] : state.alchemy.stock[id]) ?? 0;
/** The name of an ingredient or a bench potion. */
export const alchemyName = (id: Ingredient | Brewed) => (isGood(id) ? itemName(id) : t(id as TextKey));

const take = (state: GameState, id: Ingredient, by: number) => {
  const pile = isWild(id) ? state.alchemy.wild : state.alchemy.stock;
  (pile as Record<string, number>)[id] = ((pile as Record<string, number>)[id] ?? 0) + by;
};

/** The bench's drop marker: puts the topmost refined good the doctor carries on the bench. */
export function dropAtBench(state: GameState): Feedback | null {
  if (!alchemyOpen(state)) return null;
  for (let i = state.carrying.length - 1; i >= 0; i--) {
    const id = state.carrying[i];
    if (!isRefined(id) || (state.alchemy.stock[id] ?? 0) >= BENCH_STOCK) continue;
    state.carrying.splice(i, 1);
    take(state, id, 1);
    return [t('benchStocked', { item: itemName(id) })];
  }
  return null;
}

/** Puts one of an ingredient in the bowl, if there is room and one at hand. */
export function addToMix(state: GameState, id: Ingredient): boolean {
  if (state.alchemy.mix.length >= MIX_MAX || onHand(state, id) <= 0) return false;
  take(state, id, -1);
  state.alchemy.mix.push(id);
  return true;
}

/** Empties the bowl back onto the bench and into the satchel. */
export function clearMix(state: GameState) {
  for (const id of state.alchemy.mix) take(state, id, 1);
  state.alchemy.mix = [];
}

/**
 * Mixes what is in the bowl: a recipe's mix makes its potion (and a new one is discovered, into the
 * recipe book), anything else a Murky Draught.
 */
export function mixNow(state: GameState): { feedback: Feedback; found: boolean } | null {
  const lab = state.alchemy;
  if (lab.mix.length < MIX_MIN) return null;
  const mix = mixFor(lab.mix);
  lab.mix = [];
  const out: Brewed = mix?.id ?? MURKY;
  lab.rack[out] = (lab.rack[out] ?? 0) + 1;
  if (mix && !lab.found.includes(mix.id)) {
    lab.found.push(mix.id);
    return { feedback: [t('discovered', { name: t(mix.id) })], found: true };
  }
  return { feedback: [t('mixed', { name: alchemyName(out) })], found: false };
}

/** Fills the bowl with a discovered recipe's mix from what is at hand, and mixes it. */
export function mixAgain(state: GameState, id: MixId): Feedback | null {
  const mix = MIXES.find((m) => m.id === id)!;
  if (!state.alchemy.found.includes(id)) return null;
  const need = new Map<Ingredient, number>();
  for (const i of mix.inputs) need.set(i, (need.get(i) ?? 0) + 1);
  // What is in the bowl goes back before the mix is filled, so it counts as at hand; when something
  // is short, the bowl is left as it was.
  const inBowl = (i: Ingredient) => state.alchemy.mix.filter((m) => m === i).length;
  if ([...need].some(([i, n]) => onHand(state, i) + inBowl(i) < n)) return null;
  clearMix(state);
  for (const i of mix.inputs) addToMix(state, i);
  return mixNow(state)!.feedback;
}

/** Sells one bench potion off the rack to the town's collectors, into the purse. */
export function sellBrewed(state: GameState, id: Brewed): Feedback | null {
  if ((state.alchemy.rack[id] ?? 0) <= 0) return null;
  state.alchemy.rack[id]!--;
  const coins = brewedPrice(state, id);
  state.coins += coins;
  return [t('sold', { item: alchemyName(id), coins })];
}

/** Whether a cure on the rack can be given to the town now: the plague is at a stage. */
export const canCure = (state: GameState) => !!plagueStage(state);

/** Gives a cure to the town: the plague's current stage is over at once, as if every potion it asked for was sold. */
export function useCure(state: GameState, id: MixId): Feedback | null {
  const mix = MIXES.find((m) => m.id === id)!;
  const plague = state.plague;
  if (!mix.cures || (state.alchemy.rack[id] ?? 0) <= 0 || !plague || !canCure(state)) return null;
  state.alchemy.rack[id]!--;
  state.plague = plagueAt(plague.stage + 1, plague.relapses, 0, plague.season ?? 0);
  return [t('cureGiven', { name: t(id) })];
}

/** Hires the courier, once. */
export function hireCourier(state: GameState): Feedback | null {
  const courier = state.alchemy.courier;
  if (courier.hired || state.coins < COURIER_COST) return null;
  state.coins -= COURIER_COST;
  courier.hired = true;
  return [t('courierHired')];
}

/** Sends the courier out to a place, if they are home. */
export function sendCourier(state: GameState, to: Place): Feedback | null {
  const courier = state.alchemy.courier;
  if (!courier.hired || courier.trip) return null;
  courier.trip = { to, left: TRIPS[to].ms };
  return [t('courierSent', { place: t(to) })];
}

/**
 * The courier's trip runs on with game time, which the time away plays too, so a trip finishes while
 * the game is closed. Back home, the herbs go into the satchel, up to its size.
 */
export function tickCourier(state: GameState, dt: number) {
  const courier = state.alchemy.courier;
  const trip = courier.trip;
  if (!trip) return;
  trip.left -= dt;
  if (trip.left > 0) return;
  const { herb, brings } = TRIPS[trip.to];
  const have = state.alchemy.wild[herb] ?? 0;
  // Never lower the count: Clear and Make return the bowl's herbs uncapped, so the satchel can hold more than SATCHEL.
  state.alchemy.wild[herb] = Math.max(have, Math.min(SATCHEL, have + brings));
  courier.trip = null;
  courier.trips++;
}

/** Shop decor (AP20): bought once each at the decor board on the shop's front, each with a small lasting bonus. */
export type DecorId = 'paintedSign' | 'lanterns' | 'herbArch' | 'fountain';
export const DECOR: Record<DecorId, { cost: number }> = {
  paintedSign: { cost: 200 },
  lanterns: { cost: 450 },
  herbArch: { cost: 900 },
  fountain: { cost: 1_800 },
};
export const DECOR_IDS = Object.keys(DECOR) as DecorId[];
/** The painted sign: tips are this much bigger. */
export const SIGN_TIP = 1.25;
/** The lanterns: customers wait this much longer. */
export const LANTERN_PATIENCE = 1.2;
/** The herb arch: a regular comes back this much more often. */
export const ARCH_REGULARS = 1.5;
/** The fountain: a customer walking off costs this share of the reputation it used to. */
export const FOUNTAIN_WALK_OFF = 0.5;
export const hasDecor = (state: GameState, id: DecorId) => (state.decor ?? []).includes(id);
/** The decor board stands once the guild has been joined. */
export const decorOpen = (state: GameState) => state.guild.built;
export const decorTip = (state: GameState) => (hasDecor(state, 'paintedSign') ? SIGN_TIP : 1);
export const decorPatience = (state: GameState) => (hasDecor(state, 'lanterns') ? LANTERN_PATIENCE : 1);
export const decorRegulars = (state: GameState) => (hasDecor(state, 'herbArch') ? ARCH_REGULARS : 1);
export const decorWalkOff = (state: GameState) => (hasDecor(state, 'fountain') ? FOUNTAIN_WALK_OFF : 1);

/** Buys a piece of decor, all at once. */
export function buyDecor(state: GameState, id: DecorId): Feedback | null {
  if (!decorOpen(state) || hasDecor(state, id) || state.coins < DECOR[id].cost) return null;
  state.coins -= DECOR[id].cost;
  state.decor = [...(state.decor ?? []), id];
  // A shop front made nicer lifts the street's opinion a little.
  nudgeReputation(state, 3);
  return [t('decorBought', { name: t(id) })];
}
