import { byDifficulty } from '../../../../shared/settings';
import { commissionAt, grandOf, offered, type Commission } from './commissions';
import { EDICT_IDS, HALL_IDS, HALL_TOP, edictRule, edictsFor, hallLevels, PERKS, type Edict, type Hall, type Perk } from './charter';
import { GEM, MASTER, combine, isGemmed, isMaster, isShield, isSword, shield, sword, tierOf } from './items';
import { SHIELD_TOP } from './shields';
import {
  BARREL,
  FIRST_ORDER,
  FIRST_VISITOR_MS,
  GEM_ORDER_CHANCE,
  HAGGLER_PATIENCE,
  LOOKS,
  APPRENTICE_PRICE,
  MAX_SLOTS,
  PATIENCE_MS,
  PATIENCE_PER_TIER_MS,
  plainPrice,
  REP_EXACT,
  REP_MAX,
  REP_WALKOFF,
  RETURN_CHANCE,
  RETURN_MS,
  RETURN_TIER,
  RUST_DROP_MS,
  SET_ORDER_CHANCE,
  SET_PATIENCE,
  SLOTS,
  STREAK_COINS,
  STREAK_MS,
  STREAK_TOP,
  TRAITS,
  TRAIT_CHANCE,
  apprenticeAbout,
  apprenticeEvery,
  autoForging,
  cartsAbout,
  desksOf,
  knightPay,
  masterMs,
  tourneyOpen,
  fitOf,
  forgeMs,
  freeStars,
  freshProgress,
  freshRival,
  gemChance,
  newShop,
  rivalOpen,
  rivalPrize,
  DAILY_MS,
  RIVAL_DAY_MS,
  RIVAL_REP,
  RIVAL_SALE_MS,
  tavernFactor,
  gemsAbout,
  oreChance,
  patienceFactor,
  payFor,
  repairPay,
  rustMs,
  rusts,
  setPay,
  shieldsAbout,
  trophyFor,
  visitorEveryMs,
  type Adventurer,
  type Fit,
  type GameState,
  type Returning,
  type Trait,
} from './state';
import { MAX_TIER, ORDER_TOP } from './swords';
import { locked, nextPrice, type UpgradeId } from './upgrades';
import { KNIGHTS, KNIGHT_LOOK, KNIGHT_MS, TOURNEY_EVERY_MS, freshTourney, lance, placeOf, purse, tourneyTier } from './tourney';
import { CART_EVERY_MS, CART_STAY_MS, ORE_IDS, ORE_MS, STARMETAL_TIER, freshCart, noOres, orePrice, type Ore } from './cart';

/**
 * Where the rules' random numbers come from: `Math.random`, so a seeded test repeats, or the daily
 * forge's own seeded source while a daily shift runs (`useRandom`).
 */
let rng: (() => number) | null = null;
const random = () => (rng ? rng() : Math.random());
/** Sets the random source for the rules: a seeded one for the daily forge, or null for `Math.random`. */
export function useRandom(source: (() => number) | null) {
  rng = source;
}

/**
 * Moves the smithy on by `dt` milliseconds: the forge cools (and forges by itself with the Auto
 * Forge on), swords left lying rust, adventurers come, wait and leave, and heroes return. Nothing
 * moves while a new charter waits for its edict.
 */
export function tick(s: GameState, dt: number) {
  // A new charter's smithy stands still until its edict and hall are chosen, and a daily shift
  // stands still once its time is up.
  if (edictOffers(s) || hallOffers(s) || (s.daily && s.daily.ms <= 0)) return;
  if (s.daily) {
    s.daily.ms = Math.max(0, s.daily.ms - dt);
    if (s.daily.ms === 0) {
      s.events.push({ kind: 'dailyEnd', earned: s.daily.earned });
      return;
    }
  }
  if (rivalOpen(s)) rivalDay(s, dt);
  s.heatMs = Math.max(0, s.heatMs - dt);

  // A due hero takes a free anvil before the Auto Forge can fill it.
  for (const hero of s.returning) hero.inMs -= dt;
  const due = s.returning.find((hero) => hero.inMs <= 0);
  if (due && s.adventurers.length < desksOf(s) && s.slots.includes(null)) {
    s.returning.splice(s.returning.indexOf(due), 1);
    comeBack(s, due);
  }

  if (autoForging(s)) forge(s);
  s.streakMs = Math.max(0, s.streakMs - dt);
  if (s.streakMs === 0) s.streak = 0;
  rust(s, dt);
  apprentice(s, dt);
  cartDay(s, dt);

  for (const a of s.adventurers) a.patienceMs -= dt;
  for (const a of s.adventurers.filter((a) => a.patienceMs <= 0)) {
    s.adventurers.splice(s.adventurers.indexOf(a), 1);
    // A knight rides off unarmed: the tourney goes on without them, and the guild minds no more.
    if (a.knight) {
      s.events.push({ kind: 'left', desk: a.desk, knight: true });
      continue;
    }
    s.walkedOff++;
    s.reputation = Math.max(0, s.reputation - REP_WALKOFF);
    // Someone kept waiting walks across the street to the rival.
    if (rivalOpen(s)) s.rival.theirs++;
    // Half a set they held comes back to the smithy.
    const half = a.given.sword ?? a.given.shield;
    s.events.push({ kind: 'left', desk: a.desk, back: half === null ? undefined : handBack(s, half) });
  }

  // Knights ride in ahead of the adventurers.
  if (tourneyOpen(s)) tourneyDay(s, dt);

  if (s.adventurers.length < desksOf(s)) {
    s.nextVisitorMs -= dt;
    if (s.nextVisitorMs <= 0) {
      arrive(s);
      s.nextVisitorMs = visitorEveryMs(s);
    }
  }
}

/**
 * The rival smithy's day: it sells a sword of its own every `RIVAL_SALE_MS`, and at the day's end
 * outselling it pays a prize and reputation.
 */
function rivalDay(s: GameState, dt: number) {
  const before = s.rival.ms;
  s.rival.ms -= dt;
  const elapsed = (ms: number) => Math.floor((RIVAL_DAY_MS - ms) / RIVAL_SALE_MS);
  s.rival.theirs += Math.max(0, elapsed(Math.max(0, s.rival.ms)) - elapsed(before));
  if (s.rival.ms > 0) return;
  const won = s.rival.mine > s.rival.theirs;
  const coins = won ? rivalPrize(s) : 0;
  s.coins += coins;
  if (won) s.reputation = Math.min(REP_MAX, s.reputation + RIVAL_REP);
  s.events.push({ kind: 'rivalDay', won, coins });
  s.rival = freshRival();
}

/**
 * The tourney (AN18): every `TOURNEY_EVERY_MS` three knights ride in, taking desks as they free up
 * ahead of the adventurers. Once each has a sword or has ridden off, the best sword handed over
 * jousts against the field: its place pays a purse, and 1st hangs a banner in the smithy.
 */
function tourneyDay(s: GameState, dt: number) {
  const t = s.tourney;
  if (!t.on) {
    t.inMs -= dt;
    if (t.inMs > 0) return;
    s.tourney = { inMs: TOURNEY_EVERY_MS, on: true, riding: KNIGHTS, wants: tourneyTier(s.bestTier), entries: [] };
    s.events.push({ kind: 'tourneyStart', wants: s.tourney.wants });
  }
  const now = s.tourney;
  while (now.riding > 0 && freeDesk(s) !== undefined) {
    arriveKnight(s, now.wants);
    now.riding--;
  }
  if (now.riding > 0 || s.adventurers.some((a) => a.knight)) return;
  const place = now.entries.length > 0 ? placeOf(Math.max(...now.entries), now.wants) : 0;
  const coins = place > 0 ? purse(place, now.wants) : 0;
  const banner = place === 1;
  s.coins += coins;
  if (banner) s.banners++;
  s.events.push({ kind: 'tourney', place, coins, banner });
  s.tourney = { ...freshTourney(), inMs: TOURNEY_EVERY_MS };
}

/** A knight rides up to the first free desk, wanting any sword at least as good as `wants` within `KNIGHT_MS`. No random rolls. */
function arriveKnight(s: GameState, wants: number) {
  const desk = freeDesk(s);
  if (desk === undefined) return;
  const patience = KNIGHT_MS * byDifficulty(1.5, 1, 0.7);
  s.adventurers.push({
    id: s.nextId++,
    desk,
    wants,
    gem: false,
    trait: 'none',
    shield: 0,
    patience,
    patienceMs: patience,
    look: KNIGHT_LOOK,
    returned: false,
    knight: true,
    given: { sword: null, shield: null },
  });
}

/**
 * The apprentice (AN19): every `apprenticeEvery` they merge one matching pair on the anvils, the
 * lowest first, leaving Masterworks and the sword in the player's hand alone. With no pair to merge
 * they wait for one.
 */
function apprentice(s: GameState, dt: number) {
  if (!s.apprentice) return;
  s.apprenticeMs = Math.max(0, s.apprenticeMs - dt);
  if (s.apprenticeMs > 0) return;
  const pair = apprenticePair(s);
  if (!pair) return;
  const [to, from] = pair;
  const made = combine(s.slots[from]!, s.slots[to]!)!;
  put(s, from, null);
  put(s, to, made.item);
  raiseBest(s, made.item);
  s.apprenticeMs = apprenticeEvery(s);
  s.events.push({ kind: 'apprenticed', slot: to, from, tier: tierOf(made.item) });
}

/** The pair the apprentice merges next: the lowest-tier matching pair on the anvils, as [into, from], or null. */
export function apprenticePair(s: GameState): [number, number] | null {
  let best: [number, number] | null = null;
  let bestTier = Infinity;
  const ok = (slot: number) => {
    const item = s.slots[slot];
    return item !== null && slot !== s.held && !(isSword(item) && isMaster(item));
  };
  for (let i = 0; i < s.slots.length; i++) {
    if (!ok(i)) continue;
    for (let j = i + 1; j < s.slots.length; j++) {
      if (!ok(j)) continue;
      const made = combine(s.slots[j]!, s.slots[i]!);
      if (!made?.merged || tierOf(s.slots[i]!) >= bestTier) continue;
      best = [i, j];
      bestTier = tierOf(s.slots[i]!);
    }
  }
  return best;
}

/** Hires the apprentice, once the smithy has made a Steel Sword, if there are coins enough. */
export function hireApprentice(s: GameState) {
  if (s.apprentice || !apprenticeAbout(s) || s.coins < APPRENTICE_PRICE) return false;
  s.coins -= APPRENTICE_PRICE;
  s.apprentice = true;
  s.apprenticeMs = apprenticeEvery(s);
  s.events.push({ kind: 'hired' });
  return true;
}

/**
 * The ore cart (AN20): once carts are about it comes every `CART_EVERY_MS` and stays `CART_STAY_MS`.
 * Ores bought from it run down meanwhile.
 */
function cartDay(s: GameState, dt: number) {
  for (const ore of ORE_IDS) s.ores[ore] = Math.max(0, s.ores[ore] - dt);
  if (!cartsAbout(s)) return;
  const c = s.cart;
  if (c.hereMs > 0) {
    c.hereMs = Math.max(0, c.hereMs - dt);
    if (c.hereMs === 0) c.inMs = CART_EVERY_MS;
    return;
  }
  c.inMs -= dt;
  if (c.inMs > 0) return;
  s.cart = { inMs: 0, hereMs: CART_STAY_MS, sold: { silver: false, starmetal: false } };
  s.events.push({ kind: 'cart' });
}

/** Buys an ore from the cart while it is here: once per ore a visit, for `ORE_MS` of forging (added to any left). */
export function buyOre(s: GameState, ore: Ore) {
  const price = orePrice(ore, s.bestTier);
  if (s.cart.hereMs <= 0 || s.cart.sold[ore] || s.coins < price) return false;
  s.coins -= price;
  s.ores[ore] += ORE_MS;
  s.cart.sold[ore] = true;
  s.events.push({ kind: 'ore', ore });
  return true;
}

/** The first free desk at the counter, if any. */
function freeDesk(s: GameState) {
  const taken = new Set(s.adventurers.map((a) => a.desk));
  return [...Array(desksOf(s)).keys()].find((d) => !taken.has(d));
}

/** Swords left on an anvil dull after `rustMs`, and `RUST_DROP_MS` later drop a tier; the barrel keeps them safe. */
function rust(s: GameState, dt: number) {
  for (let slot = 0; slot < s.slots.length; slot++) {
    const item = s.slots[slot];
    if (!rusts(item)) {
      s.idle[slot] = 0;
      continue;
    }
    s.idle[slot] += dt;
    if (s.idle[slot] < rustMs(s) + RUST_DROP_MS) continue;
    s.slots[slot] = item! - 1;
    s.idle[slot] = 0;
    s.events.push({ kind: 'rusted', slot, tier: tierOf(item! - 1) });
  }
}

/** An adventurer walks up to the first free spot at the counter with an order; a hero back from a quest keeps their look. */
function arrive(s: GameState, hero?: Returning) {
  const desk = freeDesk(s);
  if (desk === undefined) return null;
  // After the first order, they ask for anything up to one better than the best sword made yet.
  const top = Math.min(ORDER_TOP, Math.max(3, s.bestTier + 1));
  const wants = s.orders === 0 ? FIRST_ORDER : 1 + Math.floor(random() * top);
  const look = hero ? hero.look : Math.floor(random() * LOOKS);
  // Once bucklers are about, some ask for a sword and shield set (never with a dagger), with no gem
  // or trait, and a buckler up to one better than the best made yet.
  const set = shieldsAbout(s) && wants >= 2 && random() < SET_ORDER_CHANCE;
  const shieldWanted = set ? 1 + Math.floor(random() * Math.min(SHIELD_TOP, Math.max(2, s.bestShield + 1))) : 0;
  // Once gems are about, some ask for one set in their sword (never in a dagger).
  const gem = !set && gemsAbout(s) && wants >= 2 && random() < GEM_ORDER_CHANCE;
  // From the second order on, some come with a trait; a Veteran who wants a dagger has nothing
  // below it to take, so comes with none.
  const rolled = s.orders === 0 || set ? 'none' : rollTrait();
  const trait = rolled === 'veteran' && wants === 1 ? 'none' : rolled;
  // Easier difficulties, a better reputation and a set order give adventurers more patience; a
  // Haggler brings their own, and the edict may take some away.
  const patience =
    (PATIENCE_MS + PATIENCE_PER_TIER_MS * wants) *
    byDifficulty(1.5, 1, 0.7) *
    patienceFactor(s) *
    (trait === 'haggler' ? HAGGLER_PATIENCE : 1) *
    (set ? SET_PATIENCE : 1) *
    edictRule(s.edict).patience *
    tavernFactor(s);
  const a = {
    id: s.nextId++,
    desk,
    wants,
    gem,
    trait,
    shield: shieldWanted,
    patience,
    patienceMs: patience,
    look,
    returned: hero !== undefined,
    knight: false,
    given: { sword: null, shield: null },
  };
  s.adventurers.push(a);
  s.orders++;
  return a;
}

/**
 * Gives a half set back when its adventurer walks off: onto the first empty anvil, else into the
 * empty barrel, else as its plain price in coins (the place is -1 then).
 */
function handBack(s: GameState, item: number): { place: number; coins: number } {
  const slot = s.slots.indexOf(null);
  if (slot >= 0) {
    put(s, slot, item);
    return { place: slot, coins: 0 };
  }
  if (s.ranks.barrel > 0 && s.barrel === null) {
    put(s, BARREL, item);
    return { place: BARREL, coins: 0 };
  }
  const coins = plainPrice(item, s);
  s.coins += coins;
  return { place: -1, coins };
}

function rollTrait(): Trait {
  const r = random();
  return r < TRAIT_CHANCE ? TRAITS[Math.floor((r / TRAIT_CHANCE) * TRAITS.length)] : 'none';
}

/** A hero comes back to the counter with a new order, lays their battered sword on the first empty anvil and hands over a trophy. */
function comeBack(s: GameState, hero: Returning) {
  const a = arrive(s, hero);
  const slot = s.slots.indexOf(null);
  if (!a || slot < 0) return;
  s.slots[slot] = hero.item;
  s.idle[slot] = 0;
  s.coins += hero.trophy;
  s.events.push({ kind: 'returned', desk: a.desk, slot, tier: tierOf(hero.item), trophy: hero.trophy });
}

/**
 * Forges a new sword (or, in buckler mode, a buckler, and now and then a gem) onto the first empty
 * anvil, if the forge is hot and there is room.
 */
export function forge(s: GameState) {
  // A new charter forges nothing until its edict is chosen.
  if (s.heatMs > 0 || edictOffers(s) || hallOffers(s) || (s.daily && s.daily.ms <= 0)) return false;
  const slot = s.slots.indexOf(null);
  if (slot < 0) return false;
  // Starmetal from the ore cart forges Steel blanks; the Fine Ore roll is still made, so the random sequence holds.
  const fine = random() < oreChance(s) ? 2 : 1;
  const tier = s.ores.starmetal > 0 ? Math.max(STARMETAL_TIER, fine) : fine;
  const made = s.shieldMode && shieldsAbout(s) ? shield(tier) : tier;
  const item = gemsAbout(s) && random() < gemChance(s) ? GEM : made;
  s.slots[slot] = item;
  s.idle[slot] = 0;
  raiseBest(s, item);
  s.heatMs = forgeMs(s);
  s.events.push({ kind: 'forged', slot, tier: tierOf(item) });
  return true;
}

/** Raises the best sword or buckler made so far to a new item's. */
function raiseBest(s: GameState, item: number) {
  if (isSword(item)) s.bestTier = Math.max(s.bestTier, tierOf(item));
  if (isShield(item)) s.bestShield = Math.max(s.bestShield, tierOf(item));
}

/** Switches the forge between swords and bucklers, once bucklers are about. */
export function toggleShieldMode(s: GameState) {
  if (!shieldsAbout(s)) return false;
  s.shieldMode = !s.shieldMode;
  return true;
}

/** What lies at a place: an anvil, or the quench barrel (`BARREL`). */
export function itemAt(s: GameState, place: number) {
  return place === BARREL ? s.barrel : (s.slots[place] ?? null);
}
/** Notes the place the player holds a sword from (or null once let go), so the apprentice leaves it be. */
export function hold(s: GameState, place: number | null) {
  s.held = place;
}
/** Tends the sword on an anvil, as picking it up does: it starts afresh against rust. */
export function touch(s: GameState, place: number) {
  if (place !== BARREL && place >= 0 && place < s.idle.length) s.idle[place] = 0;
}
/** Puts an item at a place; a touched anvil's sword starts afresh against rust. */
function put(s: GameState, place: number, item: number | null) {
  if (place === BARREL) s.barrel = item;
  else {
    s.slots[place] = item;
    s.idle[place] = 0;
  }
}
/** Whether a place exists in this smithy: a bought anvil, or the bought barrel. */
const placeable = (s: GameState, place: number) => (place === BARREL ? s.ranks.barrel > 0 : place >= 0 && place < s.slots.length);

/**
 * Drops what lies at `from` onto `to` (an anvil or the barrel): onto an empty place it moves, onto
 * a sword of the same tier the two merge into one of the next tier, a gem sets into a plain
 * sword, a Rusty Dagger repairs a battered sword for a bonus, and anything else swaps. A merge
 * soon after the last one chains a hammer streak, and a sword merged in the streak's last second is
 * a Masterwork.
 */
export function drop(s: GameState, from: number, to: number) {
  const item = itemAt(s, from);
  if (item === null || from === to || !placeable(s, from) || !placeable(s, to)) return false;
  const there = itemAt(s, to);
  const made = there === null ? null : combine(item, there);
  if (made) {
    const master = made.merged && isSword(made.item) && s.streakMs > 0 && s.streakMs <= masterMs(s);
    const item = master ? made.item + MASTER : made.item;
    put(s, from, null);
    put(s, to, item);
    if (made.merged) {
      raiseBest(s, item);
      s.events.push({ kind: 'merged', slot: to, tier: tierOf(item), master });
      hammer(s, to);
    } else if (made.repaired) {
      const coins = repairPay(made.item);
      s.coins += coins;
      s.events.push({ kind: 'repaired', slot: to, tier: tierOf(made.item), coins });
    } else {
      s.events.push({ kind: 'set', slot: to });
    }
  } else {
    put(s, from, there);
    put(s, to, item);
  }
  return true;
}

/** Chains a merge on `slot` into the hammer streak, paying its bonus (capped at `STREAK_TOP` steps) from the second merge on. */
function hammer(s: GameState, slot: number) {
  s.streak = s.streakMs > 0 ? s.streak + 1 : 1;
  s.streakMs = STREAK_MS;
  s.streakSlot = slot;
  if (s.streak < 2) return;
  const coins = STREAK_COINS * Math.min(s.streak, STREAK_TOP);
  s.coins += coins;
  s.events.push({ kind: 'streak', slot, streak: s.streak, coins });
}

/** The commission that stands: the level's own in this charter, grand if that way was chosen, or null once won. */
export function standing(s: GameState): Commission | null {
  const c = commissionAt(s.commission.level, s.charter);
  return c && s.commission.grand ? grandOf(c) : c;
}

/** The crown's two offers while a choice is open: the commission as it stands and its grand way. */
export function offers(s: GameState): [Commission, Commission] | null {
  const c = commissionAt(s.commission.level, s.charter);
  return s.choosing && c ? [c, grandOf(c)] : null;
}

/** Takes one of the crown's two offers: the commission as it stands, or its grand (gemmed) way. */
export function chooseCommission(s: GameState, grand: boolean) {
  if (!s.choosing) return false;
  s.commission.grand = grand;
  s.choosing = false;
  return true;
}

/**
 * Whether the crown would take this sword now: the commission's own (gemmed, if the grand way was
 * chosen), or an Anvilheart for any lesser commission. Nothing is taken while an offer waits.
 */
export function deliverable(s: GameState, item: number | null) {
  const c = standing(s);
  if (!c || s.choosing || item === null || !isSword(item)) return false;
  const tier = tierOf(item);
  if (tier === MAX_TIER && c.tier !== MAX_TIER) return true;
  return tier === c.tier && (!c.gem || isGemmed(item));
}

/** Throws what lies at `from` (a sword, buckler or gem) into the scrap bin, for nothing, to free its place. */
export function scrap(s: GameState, from: number) {
  if (itemAt(s, from) === null || !placeable(s, from)) return false;
  put(s, from, null);
  s.events.push({ kind: 'scrapped', slot: from });
  return true;
}

/**
 * Hands the sword at `from` to the crown, if the royal commission wants it. It leaves the board,
 * and once enough are delivered the commission pays its purse and a guild star, and the next one
 * is offered. An Anvilheart completes any lesser commission on its own; the last one wins the
 * smithy.
 */
export function deliver(s: GameState, from: number) {
  const item = itemAt(s, from);
  const c = standing(s);
  if (!c || !placeable(s, from) || !deliverable(s, item)) return false;
  const tier = tierOf(item!);
  put(s, from, null);
  s.commission.made = tier === MAX_TIER && c.tier !== MAX_TIER ? c.count : s.commission.made + 1;
  s.events.push({ kind: 'delivered', tier });
  if (s.commission.made < c.count) return true;
  s.coins += c.reward;
  if (s.daily) s.daily.earned += c.reward;
  s.stars++;
  s.commission = { level: s.commission.level + 1, made: 0, grand: false };
  s.won = commissionAt(s.commission.level, s.charter) === null;
  s.choosing = !s.won && offered(s.commission.level);
  s.events.push({ kind: 'commission', reward: c.reward, won: s.won });
  return true;
}

/** How an adventurer takes an item: as its fit, or 'short' if it doesn't fit or they already hold that half of their set. */
export function takes(a: Adventurer, item: number | null): Fit {
  if (item === null) return 'short';
  if (a.given[isShield(item) ? 'shield' : 'sword'] !== null) return 'short';
  return fitOf(item, a);
}

/**
 * Sells the sword at `from` to the adventurer `id`, if it fits their order. The exact sword asked
 * for pays a tip on top and raises the guild's reputation; a better one pays only the price asked.
 * A set order takes its sword and buckler one at a time, in either order, and pays for both with a
 * bonus once it has the second. The buyer of a fine sword may come back with it later, battered.
 */
export function sell(s: GameState, from: number, id: number) {
  const item = itemAt(s, from);
  const a = s.adventurers.find((a) => a.id === id);
  if (item === null || !a || !placeable(s, from)) return false;
  if (takes(a, item) === 'short') return false;
  put(s, from, null);
  if (a.shield > 0) {
    a.given[isShield(item) ? 'shield' : 'sword'] = item;
    if (a.given.sword === null || a.given.shield === null) {
      s.events.push({ kind: 'handed', desk: a.desk, shield: isShield(item) });
      return true;
    }
  }
  // A knight takes the sword for its worth and rides to the joust with it.
  if (a.knight) {
    const coins = knightPay(item, s);
    s.coins += coins;
    s.sold++;
    if (rivalOpen(s)) s.rival.mine++;
    if (s.daily) s.daily.earned += coins;
    s.tourney.entries.push(lance(item));
    s.adventurers.splice(s.adventurers.indexOf(a), 1);
    s.events.push({ kind: 'armed', desk: a.desk, coins, place: placeOf(lance(item), a.wants) });
    return true;
  }
  const sold = a.given.sword ?? item;
  const fit = fitOf(sold, a);
  const coins = a.shield > 0 ? setPay(sold, a, s) : payFor(sold, a, s);
  const tier = tierOf(sold);
  s.coins += coins;
  s.sold++;
  if (rivalOpen(s)) s.rival.mine++;
  if (s.daily) s.daily.earned += coins;
  if (fit === 'exact') s.reputation = Math.min(REP_MAX, s.reputation + REP_EXACT);
  s.adventurers.splice(s.adventurers.indexOf(a), 1);
  s.events.push({ kind: 'sold', desk: a.desk, tier, coins, fit });
  if (tier >= RETURN_TIER && random() < RETURN_CHANCE) {
    s.returning.push({ inMs: RETURN_MS, item: sword(tier - 1, isGemmed(sold), true), trophy: trophyFor(tier), look: a.look });
  }
  return true;
}

/** Spends guild stars on a lasting perk, if there are enough unspent ones; the Guild barrel brings the barrel at once. */
export function buyPerk(s: GameState, perk: Perk) {
  if (s.perks[perk] || freeStars(s) < PERKS[perk].stars) return false;
  s.perks[perk] = true;
  if (perk === 'barrel') s.ranks.barrel = Math.max(1, s.ranks.barrel);
  s.events.push({ kind: 'perk', perk });
  return true;
}

/** The two edicts the charter offers while it waits for a choice: from the second smithy on, until one is taken. */
export const edictOffers = (s: GameState): [Edict, Edict] | null => (s.charter > 0 && s.edict === null ? edictsFor(s.charter) : null);

/** Takes one of the charter's two edicts, which then rules it until the next charter. */
export function chooseEdict(s: GameState, edict: Edict) {
  const two = edictOffers(s);
  if (!two || !two.includes(edict)) return false;
  s.edict = edict;
  // An edict that slows the forge also lengthens a heat-up under way.
  s.heatMs = Math.min(s.heatMs, forgeMs(s));
  s.events.push({ kind: 'edict', edict });
  return true;
}

/** Buys the next rank of an upgrade, if it is unlocked and there are coins enough and ranks left. */
export function buy(s: GameState, id: UpgradeId) {
  const price = nextPrice(id, s.ranks[id]);
  if (price === null || s.coins < price || locked(id, s.ranks)) return false;
  s.coins -= price;
  s.ranks[id]++;
  // A new Auto Forge starts switched on.
  if (id === 'auto') s.autoForge = true;
  // Faster Bellows also shorten a heat-up already under way.
  if (id === 'bellows') s.heatMs = Math.min(s.heatMs, forgeMs(s));
  // The fifth row adds four empty anvils at the bottom.
  if (id === 'row') {
    while (s.slots.length < MAX_SLOTS) {
      s.slots.push(null);
      s.idle.push(0);
    }
  }
  return true;
}

/** Switches a bought Auto Forge on or off. */
export function toggleAutoForge(s: GameState) {
  if (s.ranks.auto === 0) return false;
  s.autoForge = !s.autoForge;
  return true;
}

/**
 * Founds a new smithy under a new charter, once the Crown Blade is in: the board, barrel, coins
 * and upgrades go, the guild stars (and the better prices they bring), their perks, reputation and
 * the count of swords sold stay, and the commissions start over, asking for more, under an edict
 * still to be chosen.
 */
export function foundCharter(s: GameState) {
  if (!s.won) return false;
  s.charter++;
  s.coins = 0;
  s.slots = new Array(SLOTS).fill(null);
  s.idle = new Array(SLOTS).fill(0);
  s.barrel = null;
  s.adventurers = [];
  s.returning = [];
  s.heatMs = 0;
  s.nextVisitorMs = FIRST_VISITOR_MS;
  s.bestTier = 0;
  for (const id of Object.keys(s.ranks) as UpgradeId[]) s.ranks[id] = 0;
  // The guild barrel comes with every new smithy.
  if (s.perks.barrel) s.ranks.barrel = 1;
  s.autoForge = false;
  s.shieldMode = false;
  s.bestShield = 0;
  // A new edict is chosen for the new charter.
  s.edict = null;
  s.commission = { level: 0, made: 0, grand: false };
  s.choosing = false;
  s.won = false;
  s.streak = 0;
  s.streakMs = 0;
  s.rival = freshRival();
  // The apprentice comes along, quicker for the new charter; the tourney, the cart and the ores start afresh.
  s.apprenticeMs = apprenticeEvery(s);
  s.tourney = freshTourney();
  s.cart = freshCart();
  s.ores = noOres();
  // The Armoury lays its Iron Shortswords on the new smithy's first anvils.
  for (let k = 0; k < s.halls.armoury; k++) s.slots[k] = 2;
  s.events.push({ kind: 'charter', charter: s.charter });
  return true;
}

/** Whether a new charter still owes a hall level: once its edict is chosen, one per charter founded, while a hall has room. */
export const hallOffers = (s: GameState) =>
  s.charter > 0 && s.edict !== null && hallLevels(s.halls) < s.charter && HALL_IDS.some((id) => s.halls[id] < HALL_TOP);

/** Raises a guild hall a level for good; a new Armoury level lays its Iron Shortsword at once. */
export function chooseHall(s: GameState, hall: Hall) {
  if (!hallOffers(s) || s.halls[hall] >= HALL_TOP) return false;
  s.halls[hall]++;
  if (hall === 'armoury') {
    const slot = s.slots.indexOf(null);
    if (slot >= 0) put(s, slot, 2);
  }
  s.events.push({ kind: 'hall', hall });
  return true;
}

/**
 * The daily forge's smithy: a fresh first smithy with the quench barrel, under an edict the day's
 * seed picks, with `DAILY_MS` on the clock. Every random number of the shift comes from `rand`, so
 * everyone plays the same day. Nothing of the player's own smithy carries over.
 */
export function dailyShop(rand: () => number): GameState {
  useRandom(rand);
  const s = newShop(freshProgress());
  s.ranks.barrel = 1;
  s.edict = EDICT_IDS[Math.floor(rand() * EDICT_IDS.length)];
  s.daily = { ms: DAILY_MS, earned: 0 };
  return s;
}
