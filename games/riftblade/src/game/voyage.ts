/**
 * The Rift Crusade between the fights: what happens when a planet's boss (or the arena) falls, the
 * space map (which planet to jump to), the star map's nodes on the way (trader, elite arena, rest,
 * events) and the jump itself. Pure state changes like `sim.ts`; randomness from `rand`.
 */
import { ELITE, OBJECTIVE_AT, WAVES, statsOf, xpFor, type EventState, type GameState } from './state';
import { collectAll, heal, lower, nextPick, pop, raise, raiseCard, refreshHealth, spawnElite, startRun, tick, SHORT_LIVED, type Input } from './sim';
import { BASE_TIER, DRILLS, FILLER, UPGRADES, UPGRADE_IDS, canOffer, cardTiers, extraChoices, lockedOf, parseCard, rollChoices } from './upgrades';
import { HEROES, type HeroId } from './heroes';
import { RUSH } from './rush';
import { t } from '../i18n';
import { checkDeeds } from './blades';
import { hot } from './heat';
import { rand, reseed } from './weekly';
import { lastStage } from './daily';
import { CREDITS, LAST_STAGE, NODE_INFO, PLANETS, REST_HEAL, TIDE, TRADE, arenaElites, planetsAt, type EventId, type NodeKind } from './planets';

/** One frame of the game: the sim while a fight is on, then whatever follows a cleared fight. */
export function frame(s: GameState, dtMs: number, input: Input) {
  tick(s, dtMs, input);
  if (s.phase === 'cleared') afterClear(s);
  if (s.phase === 'travel') nextPlanet(s);
  // The boss rush unlocks no heroes.
  if (s.hero && !s.rush) checkDeeds(s);
}

/** Empties the field between fights (the hero, their kit and allies stay). */
function clearField(s: GameState) {
  s.enemies = [];
  s.bullets = [];
  s.shards = [];
  s.bombs = [];
  s.fires = [];
  s.pickups = [];
  s.hazards = [];
  s.spawnDebt = 0;
  s.player.dashMs = 0;
  s.player.slowMs = 0;
  s.player.slowPct = 0;
  s.slashes = [];
  s.zaps = [];
  s.mark = 0;
  s.platform = null;
  s.flag = null;
  s.allies = s.allies.filter((a) => !SHORT_LIVED.includes(a.kind));
  s.objective = null;
  s.lureMs = s.overdriveMs = s.shieldHits = 0;
  s.tide = null;
  s.pillars = [];
}

/** A boss (or the arena) has fallen: take what is lying about, then the cards, the map or the win. */
export function afterClear(s: GameState) {
  collectAll(s);
  clearField(s);
  if (s.rush) {
    // The boss rush: on to the next boss at once, a little healed, or won after the last.
    s.rushBeaten += 1;
    const next = s.rushQueue.shift();
    if (next === undefined) {
      s.phase = 'won';
      return;
    }
    heal(s, RUSH.heal * s.player.maxHp);
    rushLand(s, next);
    return;
  }
  if (s.arena) {
    s.arena = false;
    if (s.arenaWon) {
      s.arenaWins += 1;
      s.credits += CREDITS.arena;
      s.rewardPicks += 1;
      pop(s, t('arenaWon', { n: CREDITS.arena }), '#ffe066');
    } else pop(s, t('elitesWithdraw'), '#8ea0c4');
    s.after = 'travel';
  } else {
    s.credits += CREDITS.clear;
    // Master Oom's deed: the Swamp world cleared with few hits from toad globs.
    if (s.planet === 1 && s.globHits <= 5) s.cleanSwamp = true;
    if (s.endless) s.endlessCleared += 1;
    if (s.stage >= lastStage(s)) {
      if (!s.endless) {
        s.phase = 'won';
        return;
      }
      // The endless rift loops: from the Lava world the star map leads back to the Dune world.
      loopBack(s);
    } else s.after = 'chart';
  }
  nextPick(s);
}

/** The star map from the last world back to the Dune world, the next loop of the endless rift. */
function loopBack(s: GameState) {
  s.next = planetsAt(0)[0];
  s.nodes = rollNodes(hot(s.heat, 'noRest'));
  s.after = 'map';
}

/**
 * Goes on into the endless rift from a won crusade (a normal run only: not a weekly or daily): the
 * level-ups still owed first, then the star map back to the Dune world, where the next loop begins.
 */
export function enterEndless(s: GameState) {
  if (s.phase !== 'won' || s.endless || s.seed >= 0 || s.daily || s.rush) return false;
  s.endless = true;
  // The credits left at the win were banked with its salvage, so the rift starts with none.
  s.credits = 0;
  loopBack(s);
  nextPick(s);
  return true;
}

/**
 * Starts a boss rush with `hero` against the bosses of `planets` (in order, from `rushPlanets`):
 * no heat, Armoury or mastery, and the set kit (`RUSH`): the hero's three paths and its drill a few
 * tiers up, at a set level.
 */
export function startRush(s: GameState, hero: HeroId, planets: readonly number[], known: HeroId[] = [], ringOut = 0, colour = false) {
  if (!planets.length) return false;
  startRun(s, hero, known, ringOut, { colour });
  for (const id of HEROES[hero].paths) for (let k = 0; k < RUSH.tiers; k++) raise(s, id);
  for (let k = 0; k < RUSH.drill; k++) raise(s, DRILLS[hero].id);
  s.level = RUSH.level;
  s.xpNext = xpFor(RUSH.level);
  s.player.hp = s.player.maxHp;
  s.pops = [];
  s.rush = true;
  s.rushTotal = planets.length;
  s.rushBeaten = 0;
  s.rushQueue = planets.slice(1);
  s.route = [];
  rushLand(s, planets[0]);
  return true;
}

/** Lands on the next boss rush planet: no swarm, no objectives, the boss at once. */
function rushLand(s: GameState, planet: number) {
  clearField(s);
  s.planet = planet;
  s.stage = PLANETS[planet].stage;
  s.route.push(planet);
  s.time = 0;
  s.waves = [];
  s.nextElite = Infinity;
  s.nextVent = RUSH.firstPillarMs;
  s.nextTide = RUSH.firstTideMs;
  s.objectiveAt = Infinity;
  s.bossSpawned = false;
  s.arena = false;
  s.phase = 'run';
  s.after = 'run';
  pop(s, t('rushPop', { n: s.rushBeaten + 1, of: s.rushTotal, planet: t(PLANETS[planet].name) }), '#ff9a3c');
}

/** The jump after this one (the endless rift wraps from the last back to the first). */
export const nextStage = (s: GameState) => (s.stage >= LAST_STAGE ? 0 : s.stage + 1);

/** The planets the space map offers for the next jump (indices into `PLANETS`). */
export const chartOptions = (s: GameState) => planetsAt(s.stage + 1);

/** Takes the planet at `index` of the space map's choices, then the star map's nodes on the way there. */
export function chooseWorld(s: GameState, index: number) {
  if (s.phase !== 'chart') return;
  const planet = chartOptions(s)[index];
  if (planet === undefined) return;
  s.next = planet;
  // A weekly run's star map and the next world play out the same way each attempt.
  if (s.seed >= 0) reseed(s.seed + 7919 * (s.stage + 1) + 31 * planet);
  s.nodes = rollNodes(hot(s.heat, 'noRest'));
  s.phase = 'map';
}

/** Two or three different nodes for the star map (never a rest at rift heat 3 and up). */
export function rollNodes(noRest = false): NodeKind[] {
  const kinds = (Object.keys(NODE_INFO) as NodeKind[]).filter((k) => !noRest || k !== 'rest');
  const count = rand() < 0.5 ? 2 : 3;
  const out: NodeKind[] = [];
  while (out.length < count) out.push(kinds.splice(Math.floor(rand() * kinds.length), 1)[0]);
  return out;
}

/** Takes the star map node at `index`. */
export function chooseNode(s: GameState, index: number) {
  if (s.phase !== 'map') return;
  const kind = s.nodes[index];
  if (!kind) return;
  if (kind === 'trader') {
    s.offers = rollOffers(s);
    s.freeReroll = (s.perks.reroll ?? 0) > 0;
    s.phase = 'trader';
  } else if (kind === 'elite') startArena(s);
  else if (kind === 'rest') {
    const before = s.player.hp;
    heal(s, REST_HEAL * s.player.maxHp);
    pop(s, t('rested', { n: Math.round(s.player.hp - before) }), '#7dffa0');
    s.phase = 'travel';
  } else {
    s.event = rollEvent(s);
    s.phase = 'event';
  }
}

// ---------------------------------------------------------------------------------------------
// The trader

/** Three offers: a level-up's cards, without the ration. */
function rollOffers(s: GameState): (string | null)[] {
  const ids = rollChoices(s.hero!, s).filter((id) => id !== FILLER.id);
  return [0, 1, 2].map((i) => ids[i] ?? null);
}

/** What the next tier of an upgrade costs. */
export function priceOf(s: GameState, id: string) {
  const c = parseCard(id);
  return TRADE.base + TRADE.perTier * (c ? cardTiers(s, c).held : 0);
}

/** Whether an offer can still be bought (a slot, a fusion's lock or a specialisation may shut it). */
function stillOpen(s: GameState, id: string) {
  const c = parseCard(id);
  if (!c || c.kind === 'filler') return false;
  if (c.kind === 'upgrade') return canOffer(id, s.hero!, s.ranks, lockedOf(s));
  return extraChoices(s).includes(id);
}

/** Buys the offer at `index`; false if it is gone or too dear. */
export function buy(s: GameState, index: number) {
  if (s.phase !== 'trader') return false;
  const id = s.offers[index];
  if (!id || s.credits < priceOf(s, id)) return false;
  s.credits -= priceOf(s, id);
  raiseCard(s, id);
  // Sold; and anything the slots, locks or specialisations no longer allow goes too.
  s.offers = s.offers.map((o, i) => (i === index || !o || !stillOpen(s, o) ? null : o));
  return true;
}

/** What a reroll costs now: nothing for the Armoury's Spare Reroll, once per trader. */
export const rerollPrice = (s: GameState) => (s.freeReroll ? 0 : TRADE.reroll);

export function reroll(s: GameState) {
  if (s.phase !== 'trader' || s.credits < rerollPrice(s)) return false;
  s.credits -= rerollPrice(s);
  s.freeReroll = false;
  s.offers = rollOffers(s);
  return true;
}

export function leave(s: GameState) {
  if (s.phase === 'trader') s.phase = 'travel';
}

// ---------------------------------------------------------------------------------------------
// The elite arena

function startArena(s: GameState) {
  clearField(s);
  s.arena = true;
  s.arenaWon = false;
  s.time = 0;
  s.waves = [];
  s.nextElite = Infinity;
  s.bossSpawned = false;
  s.phase = 'run';
  const n = arenaElites(s.stage);
  const a0 = rand() * Math.PI * 2;
  for (let i = 0; i < n; i++) spawnElite(s, a0 + (i / n) * Math.PI * 2);
  pop(s, t('arenaStart', { n }), '#ffe066');
}

// ---------------------------------------------------------------------------------------------
// Events

/** Two abilities for the shrine: one to give a tier of, one to raise by two. */
function shrinePair(s: GameState) {
  const abilities = Object.keys(s.ranks).filter((id) => UPGRADES[id].kind !== 'gear');
  // A skill a held fusion locks stops rising, here as everywhere else.
  const locked = lockedOf(s);
  const gains = abilities.filter((id) => s.ranks[id] <= BASE_TIER - 2 && !locked.has(id));
  if (abilities.length < 2 || !gains.length) return null;
  const gain = gains[Math.floor(rand() * gains.length)];
  const loses = abilities.filter((id) => id !== gain);
  return { gain, lose: loses[Math.floor(rand() * loses.length)] };
}

/** A gear piece the cache can give: a new one if a slot is free, else one held below tier 5. */
function cacheGear(s: GameState) {
  const open = UPGRADE_IDS.filter((id) => UPGRADES[id].kind === 'gear' && canOffer(id, s.hero!, s.ranks, lockedOf(s)));
  return open.length ? open[Math.floor(rand() * open.length)] : null;
}

export function rollEvent(s: GameState): EventState {
  const ids: EventId[] = ['bot', 'cache', 'well'];
  const pair = shrinePair(s);
  if (pair) ids.push('shrine');
  const id = ids[Math.floor(rand() * ids.length)];
  if (id === 'bot') {
    return {
      id, title: 'botTitle', text: 'botText',
      options: [
        { label: 'botTake', text: 'botTakeText' },
        { label: 'botStrip', text: 'botStripText' },
      ],
    };
  }
  if (id === 'cache') {
    return {
      id, title: 'cacheTitle', text: 'cacheText',
      options: [
        { label: 'cacheTake', text: 'cacheTakeText' },
        { label: 'cacheForce', text: 'cacheForceText' },
      ],
    };
  }
  if (id === 'well') {
    return {
      id, title: 'wellTitle', text: 'wellText',
      options: [
        { label: 'wellDrink', text: 'wellDrinkText' },
        { label: 'wellBottle', text: 'wellBottleText' },
      ],
    };
  }
  const { lose, gain } = pair!;
  return {
    id, title: 'shrineTitle', text: 'shrineText',
    options: [
      { label: 'shrineTrade', text: 'shrineTradeText' },
      { label: 'shrineWalk', text: 'shrineWalkText' },
    ],
    lose, gain,
  };
}

/** Takes option `index` of the event on offer, then travels on (after a free level-up, if won). */
export function chooseEvent(s: GameState, index: number) {
  const ev = s.event;
  if (s.phase !== 'event' || !ev || !ev.options[index]) return;
  const first = index === 0;
  if (ev.id === 'bot') {
    if (first) {
      s.escort = true;
      pop(s, t('botFollows'), '#7df9ff');
    } else s.credits += 20;
  } else if (ev.id === 'cache') {
    if (first) s.credits += 40;
    else {
      const gear = cacheGear(s);
      if (gear) {
        raise(s, gear);
        pop(s, t('upgradeTier', { name: t(UPGRADES[gear].name), n: s.ranks[gear] }), '#b48cff');
        s.maxHpMod *= 0.85;
        refreshHealth(s);
      } else s.credits += 40;
    }
  } else if (ev.id === 'well') {
    if (first) s.pendingLevels += 1;
    else s.credits += 25;
  } else if (first && ev.lose && ev.gain) {
    lower(s, ev.lose);
    raise(s, ev.gain);
    raise(s, ev.gain);
    pop(s, t('upgradeTier', { name: t(UPGRADES[ev.gain].name), n: s.ranks[ev.gain] }), '#b48cff');
  }
  s.event = null;
  s.after = 'travel';
  nextPick(s);
}

// ---------------------------------------------------------------------------------------------
// The next planet

export function nextPlanet(s: GameState) {
  s.planet = s.next >= 0 ? s.next : chartOptions(s)[0];
  s.stage += 1;
  // The endless rift: past the Lava world the next loop starts on the Dune world, tougher.
  if (s.stage > LAST_STAGE) {
    s.stage = 0;
    s.loop += 1;
  }
  if (s.seed >= 0) reseed(s.seed + 7919 * s.stage + 31 * s.planet + 1);
  s.route.push(s.planet);
  s.next = -1;
  clearField(s);
  s.time = 0;
  s.waves = [...WAVES];
  s.nextElite = ELITE.first;
  s.nextVent = 8000;
  s.nextTide = TIDE.firstMs;
  s.bossSpawned = false;
  s.arena = false;
  s.globHits = 0;
  s.objectiveSlot = 0;
  s.objectiveAt = OBJECTIVE_AT[0];
  s.player.saved = false;
  s.allies = s.allies.filter((a) => a.kind !== 'escort');
  if (s.escort) {
    s.escort = false;
    s.allies.push({ id: s.nextId++, kind: 'escort', x: s.player.x, y: s.player.y, cdMs: 300, lifeMs: 0, slot: 0, aim: 0 });
  }
  s.player.maxHp = statsOf(s).maxHp;
  s.phase = 'run';
  s.after = 'run';
  pop(s, t(PLANETS[s.planet].name), '#9fd8ff');
}
