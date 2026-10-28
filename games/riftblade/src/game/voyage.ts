/**
 * The Rift Crusade between the fights: what happens when a planet's boss (or the arena) falls, the
 * space map (which planet to jump to), the star map's nodes on the way (trader, elite arena, rest,
 * events) and the jump itself. Pure state changes like `sim.ts`; randomness from Math.random.
 */
import { ELITE, OBJECTIVE_AT, WAVES, statsOf, type EventState, type GameState } from './state';
import { collectAll, heal, lower, nextPick, pop, raise, refreshHealth, spawnElite, tick, SHORT_LIVED, type Input } from './sim';
import { FILLER, MAX_TIER, UPGRADES, UPGRADE_IDS, canOffer, rollChoices } from './upgrades';
import { t } from '../i18n';
import { checkDeeds } from './blades';
import { hot } from './heat';
import { CREDITS, LAST_STAGE, NODE_INFO, PLANETS, REST_HEAL, TRADE, arenaElites, planetsAt, type EventId, type NodeKind } from './planets';

/** One frame of the game: the sim while a fight is on, then whatever follows a cleared fight. */
export function frame(s: GameState, dtMs: number, input: Input) {
  tick(s, dtMs, input);
  if (s.phase === 'cleared') afterClear(s);
  if (s.phase === 'travel') nextPlanet(s);
  if (s.hero) checkDeeds(s);
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
}

/** A boss (or the arena) has fallen: take what is lying about, then the cards, the map or the win. */
export function afterClear(s: GameState) {
  collectAll(s);
  clearField(s);
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
    if (s.stage >= LAST_STAGE) {
      s.phase = 'won';
      return;
    }
    s.after = 'chart';
  }
  nextPick(s);
}

/** The planets the space map offers for the next jump (indices into `PLANETS`). */
export const chartOptions = (s: GameState) => planetsAt(s.stage + 1);

/** Takes the planet at `index` of the space map's choices, then the star map's nodes on the way there. */
export function chooseWorld(s: GameState, index: number) {
  if (s.phase !== 'chart') return;
  const planet = chartOptions(s)[index];
  if (planet === undefined) return;
  s.next = planet;
  s.nodes = rollNodes(hot(s.heat, 'noRest'));
  s.phase = 'map';
}

/** Two or three different nodes for the star map (never a rest at rift heat 3 and up). */
export function rollNodes(noRest = false): NodeKind[] {
  const kinds = (Object.keys(NODE_INFO) as NodeKind[]).filter((k) => !noRest || k !== 'rest');
  const count = Math.random() < 0.5 ? 2 : 3;
  const out: NodeKind[] = [];
  while (out.length < count) out.push(kinds.splice(Math.floor(Math.random() * kinds.length), 1)[0]);
  return out;
}

/** Takes the star map node at `index`. */
export function chooseNode(s: GameState, index: number) {
  if (s.phase !== 'map') return;
  const kind = s.nodes[index];
  if (!kind) return;
  if (kind === 'trader') {
    s.offers = rollOffers(s);
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
  const ids = rollChoices(s.hero!, s.ranks).filter((id) => id !== FILLER.id);
  return [0, 1, 2].map((i) => ids[i] ?? null);
}

/** What the next tier of an upgrade costs. */
export function priceOf(s: GameState, id: string) {
  return TRADE.base + TRADE.perTier * (s.ranks[id] ?? 0);
}

/** Buys the offer at `index`; false if it is gone or too dear. */
export function buy(s: GameState, index: number) {
  if (s.phase !== 'trader') return false;
  const id = s.offers[index];
  if (!id || s.credits < priceOf(s, id)) return false;
  s.credits -= priceOf(s, id);
  raise(s, id);
  // Sold; and anything the slots no longer allow goes too.
  s.offers = s.offers.map((o, i) => (i === index || !o || !canOffer(o, s.hero!, s.ranks) ? null : o));
  return true;
}

export function reroll(s: GameState) {
  if (s.phase !== 'trader' || s.credits < TRADE.reroll) return false;
  s.credits -= TRADE.reroll;
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
  const a0 = Math.random() * Math.PI * 2;
  for (let i = 0; i < n; i++) spawnElite(s, a0 + (i / n) * Math.PI * 2);
  pop(s, t('arenaStart', { n }), '#ffe066');
}

// ---------------------------------------------------------------------------------------------
// Events

/** Two abilities for the shrine: one to give a tier of, one to raise by two. */
function shrinePair(s: GameState) {
  const abilities = Object.keys(s.ranks).filter((id) => UPGRADES[id].kind !== 'gear');
  const gains = abilities.filter((id) => s.ranks[id] <= MAX_TIER - 2);
  if (abilities.length < 2 || !gains.length) return null;
  const gain = gains[Math.floor(Math.random() * gains.length)];
  const loses = abilities.filter((id) => id !== gain);
  return { gain, lose: loses[Math.floor(Math.random() * loses.length)] };
}

/** A gear piece the cache can give: a new one if a slot is free, else one held below tier 5. */
function cacheGear(s: GameState) {
  const open = UPGRADE_IDS.filter((id) => UPGRADES[id].kind === 'gear' && canOffer(id, s.hero!, s.ranks));
  return open.length ? open[Math.floor(Math.random() * open.length)] : null;
}

export function rollEvent(s: GameState): EventState {
  const ids: EventId[] = ['bot', 'cache', 'well'];
  const pair = shrinePair(s);
  if (pair) ids.push('shrine');
  const id = ids[Math.floor(Math.random() * ids.length)];
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
  s.route.push(s.planet);
  s.next = -1;
  clearField(s);
  s.time = 0;
  s.waves = [...WAVES];
  s.nextElite = ELITE.first;
  s.nextVent = 8000;
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
