import { dailyRand, finishDaily, loadDaily, startDaily, today } from '../../../../shared/daily';
import { byDifficulty } from '../../../../shared/settings';
import { t } from '../i18n';
import { DOUBT_COST, HEX_WEAK, POWER_BLOCK, POWER_STRENGTH, THORNS, WOUND_HURT, canBeTempered, card, cardName, isCurse, poolFor, tempered, type BaseId, type CardId } from './cards';
import { DEPTH_CURSE, depthFoeHp, DEEP_REST_HEAL, loadBestDepth, saveBestDepth } from './depth';
import { ENEMIES, type EnemyKind, type StatusKind } from './enemies';
import { ALTAR_COST, BRAZIER_HEAL, CHEST_CURSE, EVENTS, POOL_COST, POOL_HEAL, RELIQUARY_COST, RELIQUARY_MAX_HP, SHRINE_CURSE, SHRINE_GOLD } from './events';
import { FLASKS, FLASK_BLOCK, FLASK_DRAW, FLASK_ENERGY, FLASK_HEAL, FLASK_IDS, FLASK_POISON, FLASK_PRICE, FLASK_SLOTS, type FlaskId } from './flasks';
import { HEROES, heroUnlocked, loadHeroWins, saveHeroWins, type HeroId } from './heroes';
import { ACTS, ACT_FOES, COLUMNS, SPIRE_DEPTH, makeMap, reachable } from './map';
import { keyedRand, random, setRandom, withRandom } from './rng';
import { BONE_CHARM_VULNERABLE, EMBER_LANTERN_ENERGY, GOLDEN_IDOL_GOLD, MENDING_MOSS_HEAL, OAK_WARD_BLOCK, RELICS, RELIC_IDS, VENOM_GLAND_POISON, WHETSTONE_DAMAGE, relicText, type RelicId } from './relics';
import {
  CARD_PRICE,
  CLEARED_MS,
  ENEMY_ACT_MS,
  ENERGY,
  HAND_SIZE,
  HIT_MS,
  MIN_DECK,
  POP_MS,
  RELIC_GOLD,
  RELIC_PRICE,
  REMOVE_PRICE,
  REST_HEAL,
  REWARD_CHOICES,
  SHOP_CARDS,
  SHOP_FLASKS,
  SHOP_RELICS,
  START_GOLD,
  VULNERABLE_MULT,
  WALK_MS,
  WEAK_MULT,
  noStatus,
  type Enemy,
  type GameState,
  type Pop,
  type Status,
} from './state';

// The rules: moving on the map, playing cards, the foes' turn, statuses, rewards, the campfire,
// the merchant, mystery rooms, the descent to the next act and the daily crypt. Plain TypeScript,
// with randomness only through `random` (`rng.ts`: Math.random, so the playthrough test can seed
// it, or the day's source in the daily crypt).

/** The game's name for its daily record (`catacomb-daily`) and seed. */
export const DAILY = 'catacomb';
/** The heroes the daily crypt picks from. */
const DAILY_HEROES: HeroId[] = ['knight', 'hunter'];
/** What each room cleared in the daily crypt scores; a win adds the health left. */
export const DAILY_ROOM_SCORE = 10;

/** A new run, waiting for the hero to be chosen. The Knight's health and deck stand in until then. */
export function newRun(): GameState {
  setRandom(null);
  const bestDepth = loadBestDepth();
  return {
    phase: 'hero',
    hero: 'knight',
    depth: bestDepth,
    bestDepth,
    heroWins: loadHeroWins(),
    daily: null,
    dailyRecord: loadDaily(DAILY),
    dailyScore: null,
    flasks: [],
    act: 1,
    rooms: makeMap(1),
    hp: HEROES.knight.hp,
    maxHp: HEROES.knight.hp,
    deck: [...HEROES.knight.deck],
    gold: START_GOLD,
    relics: [],
    at: null,
    cleared: [],
    walk: null,
    fight: null,
    reward: null,
    rewardRare: false,
    goldWon: 0,
    flaskWon: null,
    shop: null,
    notice: '',
    timerMs: 0,
    heroHitMs: 0,
    healed: 0,
    pops: [],
    nextId: 1,
  };
}

/** Fisher-Yates, on a copy. */
export function shuffle<T>(items: T[]) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export const hasRelic = (s: GameState, id: RelicId) => s.relics.includes(id);

// The hero and the depth

/** Picks the hero: their health, deck and flask, plus the depth's starting curse, then on to the map. */
export function chooseHero(s: GameState, hero: HeroId) {
  if (s.phase !== 'hero' || !heroUnlocked(s.heroWins, hero)) return false;
  setOut(s, hero);
  return true;
}

function setOut(s: GameState, hero: HeroId) {
  const h = HEROES[hero];
  s.hero = hero;
  s.hp = h.hp;
  s.maxHp = h.hp;
  s.deck = [...h.deck];
  if (s.depth >= 3) s.deck.push(DEPTH_CURSE);
  s.flasks = [h.flask];
  s.phase = 'map';
}

/** Whether today's daily crypt can still be tried, on the hero panel. */
export const canStartDaily = (s: GameState) => s.phase === 'hero' && !s.dailyRecord.played;

/** The hero the daily crypt sends out on this day: the same for everyone. */
export const dailyHero = (day = today()) => DAILY_HEROES[Math.floor(keyedRand(`${day}:hero`)() * DAILY_HEROES.length)];

/**
 * Sets out on today's daily crypt: the day's hero at depth 0 and on Normal, on a map and with fights
 * drawn from the day's seed, and card offers seeded by the room, so everyone meets the same run.
 * It uses up today's try at once, so leaving half way still counts.
 */
export function startDailyRun(s: GameState) {
  if (!canStartDaily(s)) return false;
  const day = today();
  s.daily = day;
  s.dailyRecord = startDaily(DAILY, day);
  setRandom(dailyRand(DAILY, day));
  s.depth = 0;
  s.rooms = makeMap(1);
  setOut(s, dailyHero(day));
  return true;
}

/** The daily's score so far: ten for each room cleared, in every act, plus the health left after a win. */
export const dailyScore = (s: GameState) => ((s.act - 1) * COLUMNS + s.cleared.length) * DAILY_ROOM_SCORE + (s.phase === 'won' ? s.hp : 0);

/** Card offers in the daily come from the room's own seed, the same whatever came before; any other run draws as usual. */
function offerDraw<T>(s: GameState, fn: () => T): T {
  return s.daily ? withRandom(keyedRand(`${s.daily}:offer:${s.act}:${s.at}`), fn) : fn();
}

/** The act whose boss ends the run: the Hollow Queen's, or from SPIRE_DEPTH down the Bone Spire's (never in the daily, at depth 0). */
export const lastAct = (s: GameState) => (s.depth >= SPIRE_DEPTH ? ACTS + 1 : ACTS);

/** The run just ended: saves the daily's score, or what the win means for the heroes and the depths. */
function endRun(s: GameState) {
  if (s.daily) {
    if (s.dailyScore !== null) return;
    s.dailyScore = dailyScore(s);
    s.dailyRecord = finishDaily(DAILY, s.dailyScore, s.daily);
    return;
  }
  if (s.phase !== 'won') return;
  // The last boss falls: the next depth opens, and this hero's best win is kept.
  if (s.depth + 1 > s.bestDepth) {
    s.bestDepth = s.depth + 1;
    saveBestDepth(s.bestDepth);
  }
  if (s.depth > s.heroWins[s.hero]) {
    s.heroWins = { ...s.heroWins, [s.hero]: s.depth };
    saveHeroWins(s.heroWins);
  }
}

/** Sets the depth to delve to, between 0 and the best unlocked, while choosing the hero. */
export function setDepth(s: GameState, depth: number) {
  if (s.phase !== 'hero' || depth < 0 || depth > s.bestDepth) return false;
  s.depth = depth;
  return true;
}

// Flasks

/** Whether a flask can be drunk now: on the hero's turn, in a fight. */
export const canUseFlask = (s: GameState, slot: number) => s.phase === 'player' && !!s.fight && slot >= 0 && slot < s.flasks.length;

/** Drinks the flask in this slot, for no energy. */
export function useFlask(s: GameState, slot: number) {
  if (!canUseFlask(s, slot)) return false;
  const f = s.fight!;
  const id = s.flasks.splice(slot, 1)[0];
  if (id === 'heal') heal(s, FLASK_HEAL);
  else if (id === 'energy') f.energy += FLASK_ENERGY;
  else if (id === 'block') gainBlock(s, FLASK_BLOCK);
  else if (id === 'draw') drawCards(s, FLASK_DRAW);
  else for (const e of [...f.enemies]) applyPoison(s, e, FLASK_POISON);
  return true;
}

/** Puts a flask in a free slot; false when all three are held. */
function addFlask(s: GameState, id: FlaskId) {
  if (s.flasks.length >= FLASK_SLOTS) return false;
  s.flasks.push(id);
  return true;
}

/** A random flask, left behind by an elite or a boss; none when the slots are full. */
function grantFlask(s: GameState) {
  const id = FLASK_IDS[Math.floor(random() * FLASK_IDS.length)];
  return addFlask(s, id) ? id : null;
}

/** The name of the act the hero is in. */
export const actName = (s: GameState) => t(ACT_FOES[s.act - 1].name);

/** Sets off towards a room next to the hero's; false if it isn't one. */
export function walkTo(s: GameState, room: number) {
  if (s.phase !== 'map' || !reachable(s.rooms, s.at).includes(room)) return false;
  s.walk = { from: s.at, to: room, ms: 0 };
  s.notice = '';
  s.phase = 'walk';
  return true;
}

function enterRoom(s: GameState, i: number) {
  const room = s.rooms[i];
  s.at = i;
  s.walk = null;
  if (room.kind === 'rest') {
    s.healed = 0;
    s.phase = 'rest';
  } else if (room.kind === 'treasure') {
    offerReward(s, true);
  } else if (room.kind === 'shop') {
    s.shop = offerDraw(s, () => makeShop(s));
    s.phase = 'shop';
  } else if (room.kind === 'event') {
    s.phase = 'event';
  } else {
    startFight(s, room.foes ?? []);
  }
}

function startFight(s: GameState, foes: EnemyKind[]) {
  s.fight = {
    draw: shuffle(s.deck),
    hand: [],
    discard: [],
    energy: 0,
    block: 0,
    turn: 0,
    enemies: foes.map((kind) => {
      // Foes are a quarter weaker on Easy and 30% tougher on Hard, and tougher again down the depths.
      // The daily crypt is always on Normal, so every player meets the same foes.
      const hp = Math.round(ENEMIES[kind].hp * (s.daily ? 1 : byDifficulty(0.75, 1, 1.3)) * depthFoeHp(s.depth));
      const status = noStatus();
      if (hasRelic(s, 'boneCharm')) status.vulnerable = BONE_CHARM_VULNERABLE;
      return { id: s.nextId++, kind, hp, maxHp: hp, block: 0, strength: 0, status, step: 0, intent: ENEMIES[kind].moves[0], hitMs: 0, actMs: 0 };
    }),
    acted: 0,
    status: noStatus(),
    strength: 0,
    powers: [],
    played: 0,
    drawn: 0,
    wasVulnerable: false,
    gold: foes.reduce((sum, kind) => sum + ENEMIES[kind].gold, 0),
  };
  startTurn(s);
}

function startTurn(s: GameState) {
  const f = s.fight!;
  f.block = hasRelic(s, 'oakWard') ? OAK_WARD_BLOCK : 0;
  f.turn++;
  f.played = 0;
  f.energy = ENERGY + (f.turn === 1 && hasRelic(s, 'emberLantern') ? EMBER_LANTERN_ENERGY : 0);
  s.phase = 'player';
  // The powers in play do their turn's work before the hand is drawn.
  for (const id of f.powers) {
    const power = card(id).power;
    if (power === 'bulwark') gainBlock(s, POWER_BLOCK);
    else if (power === 'rage') {
      f.strength += POWER_STRENGTH;
      pop(s, 'hero', t('strengthPop', { n: POWER_STRENGTH }), 'heal');
    } else if (power === 'hex') {
      for (const e of f.enemies) applyStatus(s, e.status, e.id, 'weak', HEX_WEAK);
    }
  }
  drawCards(s, HAND_SIZE);
}

/** How many copies of this power are in play; each copy adds its effect again. */
const powerCount = (s: GameState, power: NonNullable<ReturnType<typeof card>['power']>) => s.fight?.powers.filter((id) => card(id).power === power).length ?? 0;

/** Draws up to n cards, shuffling the discard pile into the draw pile when it runs out. */
function drawCards(s: GameState, n: number) {
  const f = s.fight!;
  for (let i = 0; i < n; i++) {
    if (f.draw.length === 0) {
      if (f.discard.length === 0) return;
      f.draw = shuffle(f.discard);
      f.discard = [];
    }
    const id = f.draw.shift()!;
    f.hand.push(id);
    f.drawn++;
    // A Wound bites when drawn, but never kills.
    if (card(id).curse === 'wound' && s.hp > 1) {
      const hurt = Math.min(WOUND_HURT, s.hp - 1);
      s.hp -= hurt;
      s.heroHitMs = HIT_MS;
      pop(s, 'hero', `-${hurt}`, 'damage');
    }
  }
}

/** What the card at this place in the hand costs now: its own cost, plus Doubt's on the first card of a turn. */
export function costOf(s: GameState, index: number) {
  const f = s.fight!;
  const doubt = f.played === 0 && f.hand.some((id) => card(id).curse === 'doubt') ? DOUBT_COST : 0;
  return card(f.hand[index]).cost + doubt;
}

export function canPlay(s: GameState, index: number) {
  const f = s.fight;
  if (s.phase !== 'player' || !f || index < 0 || index >= f.hand.length) return false;
  return !isCurse(f.hand[index]) && costOf(s, index) <= f.energy;
}

/** What one hit of a card's `damage` deals to this foe before its block: the Whetstone, the hero's Weak and the foe's Vulnerable. */
export function heroHit(s: GameState, damage: number, e: Enemy) {
  let d = damage + (hasRelic(s, 'whetstone') ? WHETSTONE_DAMAGE : 0) + (s.fight?.strength ?? 0);
  if (s.fight?.status.weak) d = Math.floor(d * WEAK_MULT);
  if (e.status.vulnerable) d = Math.floor(d * VULNERABLE_MULT);
  return d;
}

/** What one hit of this foe's attack deals to the hero before block: its strength, its Weak and the hero's Vulnerable. */
export function foeHit(s: GameState, e: Enemy, damage: number) {
  let d = damage + e.strength;
  if (e.status.weak) d = Math.floor(d * WEAK_MULT);
  if (s.fight?.status.vulnerable) d = Math.floor(d * VULNERABLE_MULT);
  return d;
}

/** Plays the card at this place in the hand; false if it can't be played now. */
export function playCard(s: GameState, index: number) {
  if (!canPlay(s, index)) return false;
  const f = s.fight!;
  const cost = costOf(s, index);
  const id = f.hand.splice(index, 1)[0];
  const c = card(id);
  f.energy -= cost;
  f.played++;
  if (c.power) {
    f.powers.push(id);
    pop(s, 'hero', cardName(id), 'status');
    return true;
  }
  const targets = c.all ? [...f.enemies] : f.enemies.slice(0, 1);
  if (c.damage) {
    for (let hit = 0; hit < (c.hits ?? 1); hit++) {
      const now = c.all ? [...f.enemies] : f.enemies.slice(0, 1);
      for (const e of now) damageEnemy(s, e, heroHit(s, c.damage + (c.hexed && hexed(e) ? c.hexed : 0), e));
    }
  }
  for (const e of targets) {
    if (!f.enemies.includes(e)) continue;
    if (c.weak) applyStatus(s, e.status, e.id, 'weak', c.weak);
    if (c.vulnerable) applyStatus(s, e.status, e.id, 'vulnerable', c.vulnerable);
    if (c.poison) applyPoison(s, e, c.poison, !c.all);
  }
  if (c.block) gainBlock(s, c.block);
  if (c.heal) heal(s, c.heal);
  if (c.energy) f.energy += c.energy;
  if (c.draw) drawCards(s, c.draw);
  f.discard.push(id);
  if (f.enemies.length === 0) clearFight(s);
  return true;
}

/** Whether a foe is hexed: it has any status on it (the Hexer's cards hit it harder). */
export const hexed = (e: Enemy) => e.status.weak > 0 || e.status.vulnerable > 0 || e.status.poison > 0;

function clearFight(s: GameState) {
  s.phase = 'cleared';
  s.timerMs = CLEARED_MS;
}

function gainBlock(s: GameState, amount: number) {
  s.fight!.block += amount;
  pop(s, 'hero', `+${amount}`, 'block');
}

/** Poisons a foe, more with the Venom Gland; with the Venom Veil in play, poison aimed at one foe splashes half onto the others, once per Veil. */
function applyPoison(s: GameState, e: Enemy, amount: number, splash = false) {
  const f = s.fight!;
  const total = amount + (hasRelic(s, 'venomGland') ? VENOM_GLAND_POISON : 0);
  applyStatus(s, e.status, e.id, 'poison', total);
  const veils = splash ? powerCount(s, 'splash') : 0;
  if (veils > 0) {
    for (const other of f.enemies) if (other !== e) applyStatus(s, other.status, other.id, 'poison', Math.ceil(total / 2) * veils);
  }
}

function applyStatus(s: GameState, status: Status, on: Pop['on'], kind: StatusKind, amount: number) {
  status[kind] += amount;
  pop(s, on, `${t(kind)} ${amount}`, 'status');
}

function heal(s: GameState, amount: number) {
  const healed = Math.min(amount, s.maxHp - s.hp);
  s.hp += healed;
  if (healed > 0) pop(s, 'hero', `+${healed}`, 'heal');
  return healed;
}

function damageEnemy(s: GameState, e: Enemy, amount: number) {
  const f = s.fight!;
  if (!f.enemies.includes(e)) return;
  const blocked = Math.min(e.block, amount);
  e.block -= blocked;
  e.hp -= amount - blocked;
  e.hitMs = HIT_MS;
  pop(s, e.id, blocked === amount ? t('blocked') : `-${amount - blocked}`, 'damage');
  if (e.hp <= 0) f.enemies.splice(f.enemies.indexOf(e), 1);
}

/** Hits the hero for this much, through block; with Thorns in play, the foe that hit takes damage back, once per Thorns. */
function damageHero(s: GameState, amount: number, from?: Enemy) {
  const f = s.fight!;
  const blocked = Math.min(f.block, amount);
  f.block -= blocked;
  s.hp = Math.max(0, s.hp - (amount - blocked));
  s.heroHitMs = HIT_MS;
  pop(s, 'hero', blocked === amount ? t('blocked') : `-${amount - blocked}`, 'damage');
  const thorns = from ? powerCount(s, 'thorns') : 0;
  if (from && thorns > 0) damageEnemy(s, from, THORNS * thorns);
}

/** Draws a foe's next move at random from its list, never the one it just made. */
function nextIntent(e: Enemy) {
  const moves = ENEMIES[e.kind].moves;
  const choices = moves.length > 1 ? moves.filter((m) => m !== e.intent) : moves;
  e.intent = choices[Math.floor(random() * choices.length)];
}

/** Ends the hero's turn: the hand is discarded, the hero's Weak wears off a turn, and the foes act, one at a time. */
export function endTurn(s: GameState) {
  if (s.phase !== 'player') return false;
  const f = s.fight!;
  f.discard.push(...f.hand);
  f.hand = [];
  for (const e of f.enemies) e.block = 0;
  f.status.weak = Math.max(0, f.status.weak - 1);
  f.wasVulnerable = f.status.vulnerable > 0;
  f.acted = 0;
  s.phase = 'enemy';
  s.timerMs = ENEMY_ACT_MS;
  return true;
}

/** A foe's go: its poison first, then its move. False if the poison, or the hero's Thorns, killed it. */
function act(s: GameState, e: Enemy) {
  const f = s.fight!;
  if (e.status.poison > 0) {
    e.hp -= e.status.poison;
    e.hitMs = HIT_MS;
    pop(s, e.id, `-${e.status.poison}`, 'status');
    e.status.poison--;
    if (e.hp <= 0) {
      f.enemies.splice(f.enemies.indexOf(e), 1);
      return false;
    }
  }
  const intent = e.intent;
  e.step++;
  nextIntent(e);
  e.actMs = HIT_MS;
  if (intent.kind === 'attack') {
    // Thorns can kill the foe mid-attack: then its remaining hits and its rider don't land.
    for (let hit = 0; hit < (intent.hits ?? 1) && f.enemies.includes(e); hit++) damageHero(s, foeHit(s, e, intent.damage), e);
    if (!f.enemies.includes(e)) return false;
    if (intent.apply) applyStatus(s, f.status, 'hero', intent.apply.status, intent.apply.amount);
  } else if (intent.kind === 'curse') {
    curse(s, intent.curse);
  } else if (intent.kind === 'block') {
    e.block += intent.block;
    pop(s, e.id, `+${intent.block}`, 'block');
  } else if (intent.kind === 'buff') {
    e.strength += intent.strength;
    pop(s, e.id, t('strengthPop', { n: intent.strength }), 'heal');
  } else {
    applyStatus(s, f.status, 'hero', intent.status, intent.amount);
  }
  e.status.weak = Math.max(0, e.status.weak - 1);
  return true;
}

/** Adds a curse card to the deck for good, and to the discard pile of the fight in progress. */
function curse(s: GameState, id: CardId) {
  s.deck.push(id);
  s.fight?.discard.push(id);
  pop(s, 'hero', t('cursedPop', { name: cardName(id) }), 'status');
}

/** After the foes' turn: Vulnerable wears off a turn on everyone (on the hero only if it was there before the foes' turn, so a foe's Vulnerable lasts its full number of foe turns), the hero's poison bites, and the hero's turn starts. */
function endRound(s: GameState) {
  const f = s.fight!;
  for (const e of f.enemies) e.status.vulnerable = Math.max(0, e.status.vulnerable - 1);
  if (f.wasVulnerable) f.status.vulnerable = Math.max(0, f.status.vulnerable - 1);
  if (f.status.poison > 0) {
    s.hp = Math.max(0, s.hp - f.status.poison);
    s.heroHitMs = HIT_MS;
    pop(s, 'hero', `-${f.status.poison}`, 'status');
    f.status.poison--;
    if (s.hp <= 0) {
      s.phase = 'over';
      return;
    }
  }
  startTurn(s);
}

/** Moves the run on by dt milliseconds of game time. */
export function tick(s: GameState, dt: number) {
  for (const p of s.pops) p.ms -= dt;
  s.pops = s.pops.filter((p) => p.ms > 0);
  s.heroHitMs = Math.max(0, s.heroHitMs - dt);
  for (const e of s.fight?.enemies ?? []) {
    e.hitMs = Math.max(0, e.hitMs - dt);
    e.actMs = Math.max(0, e.actMs - dt);
  }

  if (s.phase === 'walk' && s.walk) {
    s.walk.ms += dt;
    if (s.walk.ms >= WALK_MS) enterRoom(s, s.walk.to);
  } else if (s.phase === 'enemy') {
    s.timerMs -= dt;
    if (s.timerMs > 0) return;
    const f = s.fight!;
    if (f.acted < f.enemies.length) {
      if (act(s, f.enemies[f.acted])) f.acted++;
      s.timerMs = ENEMY_ACT_MS;
      if (s.hp <= 0) s.phase = 'over';
      else if (f.enemies.length === 0) clearFight(s);
    } else {
      endRound(s);
    }
    if (s.phase === 'over') endRun(s);
  } else if (s.phase === 'cleared') {
    s.timerMs -= dt;
    if (s.timerMs > 0) return;
    winFight(s);
  }
}

/** The last foe fell: gold, the Mending Moss, then the reward, the descent or the win. */
function winFight(s: GameState) {
  const room = s.rooms[s.at!];
  s.goldWon = Math.round(s.fight!.gold * (hasRelic(s, 'goldenIdol') ? GOLDEN_IDOL_GOLD : 1));
  s.gold += s.goldWon;
  s.fight = null;
  if (hasRelic(s, 'mendingMoss')) heal(s, MENDING_MOSS_HEAL);
  const flask = room.kind === 'elite' || room.kind === 'boss' ? grantFlask(s) : null;
  if (room.kind !== 'boss') {
    offerReward(s, room.kind === 'elite');
    s.flaskWon = flask;
    return;
  }
  s.cleared.push(s.at!);
  if (s.act >= lastAct(s)) {
    s.phase = 'won';
    endRun(s);
    return;
  }
  const relic = grantRelic(s);
  s.notice = relic ? t('boneRelic', { name: t(RELICS[relic].name), text: relicText(relic) }) : t('boneGold', { n: RELIC_GOLD });
  if (flask) s.notice = t('boneFlask', { notice: s.notice, name: t(FLASKS[flask].name) });
  s.phase = 'descend';
}

function offerReward(s: GameState, rare: boolean) {
  s.rewardRare = rare;
  s.reward = offerDraw(s, () => pickSome(poolFor(s.hero, rare ? 'rare' : 'common'), REWARD_CHOICES));
  s.flaskWon = null;
  s.phase = 'reward';
}

/** Takes the reward card at this place, or none for null, and goes back to the map. */
export function takeReward(s: GameState, index: number | null) {
  if (s.phase !== 'reward' || !s.reward) return false;
  if (index !== null) {
    const id = s.reward[index];
    if (!id) return false;
    s.deck.push(id);
  }
  s.reward = null;
  s.goldWon = 0;
  s.flaskWon = null;
  s.cleared.push(s.at!);
  s.phase = 'map';
  return true;
}

/** A relic the hero doesn't own yet, at random; gold instead once they own every one. */
function grantRelic(s: GameState) {
  const left = RELIC_IDS.filter((r) => !hasRelic(s, r));
  if (left.length === 0) {
    s.gold += RELIC_GOLD;
    return null;
  }
  const relic = left[Math.floor(random() * left.length)];
  s.relics.push(relic);
  return relic;
}

/** Goes down to the next act: a new map, and a rest's worth of healing on the way. */
export function descend(s: GameState) {
  if (s.phase !== 'descend') return false;
  s.act++;
  s.rooms = makeMap(s.act);
  s.at = null;
  s.cleared = [];
  const healed = heal(s, restHeal(s));
  s.notice = healed ? t('catchBreath', { act: actName(s), n: healed }) : actName(s);
  s.phase = 'map';
  return true;
}

// The campfire

/** The share of health a rest heals: less from depth 2 down. */
export const restShare = (s: GameState) => (s.depth >= 2 ? DEEP_REST_HEAL : REST_HEAL);

/** What resting at the campfire would heal. */
export const restHeal = (s: GameState) => Math.min(s.maxHp - s.hp, Math.round(s.maxHp * restShare(s)));

/** Rests at the campfire: heals, then goes back to the map. */
export function rest(s: GameState) {
  if (s.phase !== 'rest') return false;
  s.healed = restHeal(s);
  s.hp += s.healed;
  if (s.healed > 0) pop(s, 'hero', `+${s.healed}`, 'heal');
  leaveRoom(s);
  return true;
}

/** Whether the campfire can take a card out of the deck. */
export const canRemove = (s: GameState) => s.phase === 'rest' && s.deck.length > MIN_DECK;

/** Takes one copy of a card out of the deck at the campfire, then goes back to the map. */
export function removeCard(s: GameState, id: CardId) {
  const i = s.deck.indexOf(id);
  if (!canRemove(s) || i < 0) return false;
  s.deck.splice(i, 1);
  leaveRoom(s);
  return true;
}

/** Whether the campfire can temper a card: one in the deck isn't tempered yet and isn't a curse. */
export const canTemper = (s: GameState) => s.phase === 'rest' && s.deck.some(canBeTempered);

/** Tempers one copy of a card at the campfire, then goes back to the map. */
export function temperCard(s: GameState, id: CardId) {
  const i = s.deck.indexOf(id);
  if (!canTemper(s) || i < 0 || !canBeTempered(id)) return false;
  s.deck[i] = tempered(id);
  s.notice = t('temperedInto', { from: cardName(id), to: cardName(s.deck[i]) });
  leaveRoom(s);
  return true;
}

/** Tempers up to n cards of the deck at random, never a curse; returns their new names. */
function temperRandom(s: GameState, n: number) {
  const names: string[] = [];
  for (let k = 0; k < n; k++) {
    const plain = s.deck.map((id, i) => (canBeTempered(id) ? i : -1)).filter((i) => i >= 0);
    if (plain.length === 0) break;
    const i = plain[Math.floor(random() * plain.length)];
    s.deck[i] = tempered(s.deck[i]);
    names.push(cardName(s.deck[i]));
  }
  return names;
}

function leaveRoom(s: GameState) {
  s.cleared.push(s.at!);
  s.phase = 'map';
}

// The merchant

function makeShop(s: GameState) {
  const ware = <T>(id: T, price: number) => ({ id, price, sold: false });
  const relics = shuffle(RELIC_IDS.filter((r) => !hasRelic(s, r))).slice(0, SHOP_RELICS);
  return {
    cards: [
      ...shuffle(poolFor(s.hero, 'common')).slice(0, SHOP_CARDS.common).map((id) => ware<BaseId>(id, CARD_PRICE.common)),
      ...shuffle(poolFor(s.hero, 'rare')).slice(0, SHOP_CARDS.rare).map((id) => ware<BaseId>(id, CARD_PRICE.rare)),
    ],
    relics: relics.map((id) => ware(id, RELIC_PRICE)),
    flasks: shuffle(FLASK_IDS).slice(0, SHOP_FLASKS).map((id) => ware(id, FLASK_PRICE)),
    removePrice: REMOVE_PRICE,
    removed: false,
  };
}

/** Buys the merchant's card at this place into the deck; false if sold or too dear. */
export function buyCard(s: GameState, i: number) {
  const w = s.phase === 'shop' ? s.shop?.cards[i] : undefined;
  if (!w || w.sold || s.gold < w.price) return false;
  s.gold -= w.price;
  s.deck.push(w.id);
  w.sold = true;
  return true;
}

/** Buys the merchant's relic at this place; false if sold or too dear. */
export function buyRelic(s: GameState, i: number) {
  const w = s.phase === 'shop' ? s.shop?.relics[i] : undefined;
  if (!w || w.sold || s.gold < w.price || hasRelic(s, w.id)) return false;
  s.gold -= w.price;
  s.relics.push(w.id);
  w.sold = true;
  return true;
}

/** Whether the merchant's flask at this place can be bought: not sold, affordable, and a slot free. */
export function canBuyFlask(s: GameState, i: number) {
  const w = s.phase === 'shop' ? s.shop?.flasks[i] : undefined;
  return !!w && !w.sold && s.gold >= w.price && s.flasks.length < FLASK_SLOTS;
}

/** Buys the merchant's flask at this place into a free slot. */
export function buyFlask(s: GameState, i: number) {
  if (!canBuyFlask(s, i)) return false;
  const w = s.shop!.flasks[i];
  s.gold -= w.price;
  addFlask(s, w.id);
  w.sold = true;
  return true;
}

/** Whether the merchant can still take a card out of the deck. */
export const canBuyRemoval = (s: GameState) =>
  s.phase === 'shop' && !!s.shop && !s.shop.removed && s.gold >= s.shop.removePrice && s.deck.length > MIN_DECK;

/** Pays the merchant to take one copy of a card out of the deck. */
export function buyRemoval(s: GameState, id: CardId) {
  const i = s.deck.indexOf(id);
  if (!canBuyRemoval(s) || i < 0) return false;
  s.gold -= s.shop!.removePrice;
  s.deck.splice(i, 1);
  s.shop!.removed = true;
  return true;
}

export function leaveShop(s: GameState) {
  if (s.phase !== 'shop') return false;
  s.shop = null;
  leaveRoom(s);
  return true;
}

// Mystery rooms

/** Whether this choice of the event can be taken: one that costs health needs more than it costs. */
export function canChoose(s: GameState, choice: number) {
  const ev = s.phase === 'event' ? s.rooms[s.at!].event : undefined;
  if (!ev || (choice !== 0 && choice !== 1)) return false;
  if (ev === 'altar' && choice === 0) return s.hp > ALTAR_COST;
  if (ev === 'pool' && choice === 1) return s.hp > POOL_COST && s.deck.some(canBeTempered);
  if (ev === 'brazier' && choice === 0) return s.deck.some(isCurse);
  if (ev === 'reliquary' && choice === 1) return s.hp > RELIQUARY_COST;
  return true;
}

/** Takes one of the event's two choices, then goes back to the map (or on to a rare card). */
export function chooseEvent(s: GameState, choice: number) {
  if (!canChoose(s, choice)) return false;
  const ev = s.rooms[s.at!].event!;
  const hurt = (n: number) => {
    s.hp -= n;
    pop(s, 'hero', `-${n}`, 'damage');
  };
  s.notice = '';
  if (ev === 'altar') {
    if (choice === 0) {
      hurt(ALTAR_COST);
      offerReward(s, true);
      return true;
    }
  } else if (ev === 'shrine') {
    if (choice === 0) {
      const names = temperRandom(s, 2);
      s.notice = names.length ? t('idolTempers', { names: names.reduce((a, b) => t('and', { a, b })) }) : t('idolSilent');
    } else {
      s.gold += SHRINE_GOLD;
      curse(s, SHRINE_CURSE);
      s.notice = t('idolLoot', { n: SHRINE_GOLD, curse: cardName(SHRINE_CURSE) });
    }
  } else if (ev === 'chest') {
    if (choice === 0) {
      const relic = grantRelic(s);
      curse(s, CHEST_CURSE);
      const found = relic ? t('foundRelic', { name: t(RELICS[relic].name), text: relicText(relic) }) : t('foundGold', { n: RELIC_GOLD });
      s.notice = t('chestCurse', { found, curse: cardName(CHEST_CURSE) });
    }
  } else if (ev === 'brazier') {
    if (choice === 0) {
      const id = s.deck.splice(s.deck.findIndex(isCurse), 1)[0];
      s.notice = t('brazierBurns', { curse: cardName(id) });
    } else s.notice = t('healed', { n: heal(s, BRAZIER_HEAL) });
  } else if (ev === 'reliquary') {
    if (choice === 0) {
      s.maxHp += RELIQUARY_MAX_HP;
      heal(s, RELIQUARY_MAX_HP);
      s.notice = t('reliquaryBlesses', { n: RELIQUARY_MAX_HP });
    } else {
      hurt(RELIQUARY_COST);
      const relic = grantRelic(s);
      s.notice = relic ? t('foundRelic', { name: t(RELICS[relic].name), text: relicText(relic) }) : t('foundGold', { n: RELIC_GOLD });
    }
  } else if (choice === 0) {
    const healed = heal(s, POOL_HEAL);
    s.notice = t('healed', { n: healed });
  } else {
    hurt(POOL_COST);
    const names = temperRandom(s, 1);
    s.notice = names.length ? t('waterTempers', { name: names[0] }) : t('nothingHappens');
  }
  leaveRoom(s);
  return true;
}

/** The event in the hero's room, while in one. */
export const eventHere = (s: GameState) => (s.phase === 'event' ? EVENTS[s.rooms[s.at!].event!] : null);

function pickSome(pool: BaseId[], n: number): CardId[] {
  return shuffle(pool).slice(0, n);
}

function pop(s: GameState, on: Pop['on'], text: string, kind: Pop['kind']) {
  s.pops.push({ id: s.nextId++, on, text, kind, ms: POP_MS });
}

