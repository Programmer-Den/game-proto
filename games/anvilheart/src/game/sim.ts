import { byDifficulty } from '../../../../shared/settings';
import { commissionAt, grandOf, offered, type Commission } from './commissions';
import { edictRule, edictsFor, PERKS, type Edict, type Perk } from './charter';
import { GEM, MASTER, combine, isGemmed, isShield, isSword, shield, sword, tierOf } from './items';
import { SHIELD_TOP } from './shields';
import {
  BARREL,
  FIRST_ORDER,
  FIRST_VISITOR_MS,
  GEM_ORDER_CHANCE,
  HAGGLER_PATIENCE,
  LOOKS,
  MASTER_MS,
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
  autoForging,
  desksOf,
  fitOf,
  forgeMs,
  freeStars,
  gemChance,
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

/**
 * Moves the smithy on by `dt` milliseconds: the forge cools (and forges by itself with the Auto
 * Forge on), swords left lying rust, adventurers come, wait and leave, and heroes return. Nothing
 * moves while a new charter waits for its edict.
 */
export function tick(s: GameState, dt: number) {
  // A new charter's smithy stands still until its edict is chosen.
  if (edictOffers(s)) return;
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

  for (const a of s.adventurers) a.patienceMs -= dt;
  for (const a of s.adventurers.filter((a) => a.patienceMs <= 0)) {
    s.adventurers.splice(s.adventurers.indexOf(a), 1);
    s.walkedOff++;
    s.reputation = Math.max(0, s.reputation - REP_WALKOFF);
    // Half a set they held comes back to the smithy.
    const half = a.given.sword ?? a.given.shield;
    s.events.push({ kind: 'left', desk: a.desk, back: half === null ? undefined : handBack(s, half) });
  }

  if (s.adventurers.length < desksOf(s)) {
    s.nextVisitorMs -= dt;
    if (s.nextVisitorMs <= 0) {
      arrive(s);
      s.nextVisitorMs = visitorEveryMs(s);
    }
  }
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
  const taken = new Set(s.adventurers.map((a) => a.desk));
  const desk = [...Array(desksOf(s)).keys()].find((d) => !taken.has(d));
  if (desk === undefined) return null;
  // After the first order, they ask for anything up to one better than the best sword made yet.
  const top = Math.min(ORDER_TOP, Math.max(3, s.bestTier + 1));
  const wants = s.orders === 0 ? FIRST_ORDER : 1 + Math.floor(Math.random() * top);
  const look = hero ? hero.look : Math.floor(Math.random() * LOOKS);
  // Once bucklers are about, some ask for a sword and shield set (never with a dagger), with no gem
  // or trait, and a buckler up to one better than the best made yet.
  const set = shieldsAbout(s) && wants >= 2 && Math.random() < SET_ORDER_CHANCE;
  const shieldWanted = set ? 1 + Math.floor(Math.random() * Math.min(SHIELD_TOP, Math.max(2, s.bestShield + 1))) : 0;
  // Once gems are about, some ask for one set in their sword (never in a dagger).
  const gem = !set && gemsAbout(s) && wants >= 2 && Math.random() < GEM_ORDER_CHANCE;
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
    edictRule(s.edict).patience;
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
  const r = Math.random();
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
  if (s.heatMs > 0 || edictOffers(s)) return false;
  const slot = s.slots.indexOf(null);
  if (slot < 0) return false;
  const tier = Math.random() < oreChance(s) ? 2 : 1;
  const made = s.shieldMode && shieldsAbout(s) ? shield(tier) : tier;
  const item = gemsAbout(s) && Math.random() < gemChance(s) ? GEM : made;
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
    const master = made.merged && isSword(made.item) && s.streakMs > 0 && s.streakMs <= MASTER_MS;
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
  const sold = a.given.sword ?? item;
  const fit = fitOf(sold, a);
  const coins = a.shield > 0 ? setPay(sold, a, s) : payFor(sold, a, s);
  const tier = tierOf(sold);
  s.coins += coins;
  s.sold++;
  if (fit === 'exact') s.reputation = Math.min(REP_MAX, s.reputation + REP_EXACT);
  s.adventurers.splice(s.adventurers.indexOf(a), 1);
  s.events.push({ kind: 'sold', desk: a.desk, tier, coins, fit });
  if (tier >= RETURN_TIER && Math.random() < RETURN_CHANCE) {
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
  s.events.push({ kind: 'charter', charter: s.charter });
  return true;
}
