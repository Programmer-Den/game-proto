// The world of a match: its units, projectiles and what the view should show. No Phaser here.

import type { TextKey } from '../i18n';

import {
  GANK,
  JUNGLE,
  SpellId,
  aiSpellFor,
  MERC,
  RUNE,
  RuneKind,
  PingKind,
  AbilityKey,
  BASE,
  BuffDef,
  CAMPS,
  CAMP_KINDS,
  CampKind,
  CHAMPIONS,
  ChampionDef,
  ENEMY_LANES,
  ALLY_LANES,
  ITEMS,
  LANES,
  LaneId,
  MINION,
  NEXUS_HP,
  NEXUS_RADIUS,
  START_GOLD,
  Team,
  TOWER,
  TOWERS,
  Vec,
  XP_FOR_LEVEL,
  MAX_LEVEL,
  WAVE_MS,
  WORLD,
  ObjectiveKind,
  BEAST,
  INHIBITOR,
  INHIBITORS,
  SUPER_MINION,
  PUPS,
  WATCHSTONES,
  WARD,
} from './data';

export type Phase = 'pick' | 'playing' | 'won' | 'lost';
export type UnitKind = 'champion' | 'minion' | 'tower' | 'nexus' | 'camp' | 'beast' | 'inhibitor' | 'watchstone' | 'ward';
/** Camps, the beast and untaken watchstones belong to no team: every team's units may attack the first two. */
export type Side = Team | 'neutral';

export interface Unit {
  id: number;
  kind: UnitKind;
  side: Side;
  x: number;
  y: number;
  spawnX: number;
  spawnY: number;
  radius: number;
  hp: number;
  maxHp: number;
  shield: number;
  /** Time left on the shield, in ms; it is lost when this runs out. */
  shieldMs: number;
  dmg: number;
  armor: number;
  range: number;
  speed: number;
  attackMs: number;
  /** Time until this unit may attack again, in ms. */
  attackCd: number;
  /** Time left on a slow, in ms. */
  slowMs: number;
  /** Direction the unit faces, in radians. */
  facing: number;
  /** Distance walked, to drive the walk cycle. */
  walk: number;
  /** Time left on the attack swing animation, in ms. */
  swing: number;
  /** Time left on the hit flash, in ms. */
  flash: number;
  /** Time left on the cast pose after an ability, in ms (animation only). */
  castMs: number;
  /** Time left on a stun, in ms: a stunned unit neither moves nor attacks. */
  stunMs: number;
  /** Percent shorter ability cooldowns, from items. */
  cdr: number;
  dead: boolean;
  /** When a dead champion, minion or camp returns, in game time. */
  respawnAt: number;
  /** The unit this one attacks, or the one the player clicked. */
  target: number | null;
  /** The last unit to hurt this one; a camp fights back against it. */
  lastHitBy: number | null;
  /** Where a player's champion is walking to, if it was sent to a point. */
  moveTo: Vec | null;
  /** Lane walk: the points this unit follows, and the index it is walking toward. */
  path: Vec[] | null;
  wp: number;
  /** The lane a minion, a lane champion, a tower or an inhibitor belongs to. */
  lane: LaneId | null;
  /** A super minion's health and damage multiplier (1 for a plain one). */
  power: number;
  /** Time left on being seen while in a bush, after attacking or casting, in ms. */
  revealMs: number;
  /** Set when this champion hurts an enemy champion: towers near by shoot it first while it lasts. */
  aggroMs: number;
  /** An AI champion waits this long after one ability before the next. */
  aiCastMs: number;
  /** Whether each team can't see this unit this tick (fog of war, a bush or stealth). */
  hidden: Record<Team, boolean>;
  /** Stat changes that last a while: an ability's buff, or a jungle buff. */
  buffs: Buff[];
  // Camps only.
  /** The kind of jungle monster, and the pack it belongs to (the unit id of its alpha or itself). */
  campKind: CampKind | null;
  group: number;
  // Watchstones only: the team taking it and how far along it is, in ms.
  capture: { team: Team; ms: number } | null;
  // Wards only: the game time it burns out at.
  expiresAt: number;
  // Champions only.
  champ: ChampionDef | null;
  /** A champion's own name: a first name and a byname, like "Brannoc Ironwall". */
  name: string;
  player: boolean;
  level: number;
  xp: number;
  gold: number;
  items: string[];
  cds: Record<AbilityKey, number>;
  /** The full length of each key's last cooldown, after cooldown upgrades and cdr, for the HUD's sweep. */
  cdFull: Record<AbilityKey, number>;
  /** Ids of the upgrades the champion chose on its level ups (see `UPGRADES`). AI champions pick too. */
  upgrades: string[];
  /** Cooldowns of item actives, by active id. */
  activeCds: Record<string, number>;
  /** Champions: the battle spell carried (`SPELLS`) and the time left on its cooldown, in ms. */
  spell: SpellId | null;
  spellCd: number;
  /** AI champions: falling back until this game time. */
  retreatUntil: number;
  /** AI champions: the enemy champion it left its lane to gang up on, and until when. */
  gankTarget: number | null;
  gankUntil: number;
  /** AI champions: the camp or watchstone it went into the jungle for, and until when. */
  jungleTarget: number | null;
  jungleUntil: number;
  /** AI champions: the point a ping of the player's sent it to, the enemy marked there, and until when. */
  pingGoal: Vec | null;
  pingTarget: number | null;
  pingUntil: number;
  /** Attacks made, for a passive that hits harder every few attacks. */
  attackCount: number;
  /** Time since the champion last attacked or cast, in ms (an ambush needs a lull). */
  lullMs: number;
  /** Time left on the haste a passive gives after an attack, in ms. */
  hasteMs: number;
  kills: number;
  deaths: number;
  /** Champion kills this champion helped with (`ASSIST`). */
  assists: number;
  /** Minions and jungle monsters this champion finished, for the scoreboard. */
  cs: number;
  /** Champions: the enemy champions that hurt it, by id, with the game time of their last hit. */
  hurtBy: Record<number, number>;
  /** Champions slain since this champion last died; three or more put a bounty on it (`bountyOf`). */
  killStreak: number;
  /** Vision wards carried, planted with V (`WARD.carry` at most). */
  wards: number;
  /** Time left on a recall channel, in ms; 0 when not recalling. */
  recallMs: number;
  /** When this champion last started a recall (the AI spaces its trips home). */
  lastRecallAt: number;
  /** A buy back is allowed again from this game time. */
  buybackReadyAt: number;
}

export interface Buff {
  /** What gave it: an ability's or an elixir's name (a text key), or 'ember' or 'moss' for a jungle buff. */
  id: string;
  ms: number;
  def: BuffDef;
  color: string;
  /** The look of the ability that gave it (`${championId}.${key}`), for its aura; none for a jungle buff. */
  look?: string;
  /** An elixir: kept through death, and replaced by the next one bought. */
  elixir?: boolean;
}

/** A patch on the ground from a zone ability: it hurts and slows the other team's units inside. */
export interface Zone {
  x: number;
  y: number;
  r: number;
  side: Team;
  owner: number;
  /** Damage per second. */
  dps: number;
  slow: number;
  /** Time left and the time it lasts, in ms. */
  left: number;
  ms: number;
  color: string;
  /** The look of the ability that made it, `${championId}.${key}`. */
  look: string;
}

export interface Projectile {
  x: number;
  y: number;
  /** Pixels per ms. */
  vx: number;
  vy: number;
  /** Distance it can still fly, in pixels. */
  left: number;
  side: Side;
  owner: number;
  damage: number;
  width: number;
  pierce: boolean;
  hit: number[];
  color: string;
  /** Stun and slow in ms on whatever it hits. */
  stun: number;
  slow: number;
  /** Drags the first champion or minion it hits to its owner. */
  pull: boolean;
  /** Double damage to a target below this share of its health (0 for none). */
  executeBelow: number;
  /** The look of the ability that threw it, `${championId}.${key}`; none for towers and the beast. */
  look?: string;
}

/** A short-lived visual the view turns into shapes: a ring, or a line between two points. */
export type Fx =
  | { kind: 'ring'; x: number; y: number; r: number; color: string; ms: number }
  | { kind: 'line'; x: number; y: number; x2: number; y2: number; color: string; ms: number }
  /** A slash: an arc of radius r around (x, y), centred on the angle a. */
  | { kind: 'arc'; x: number; y: number; r: number; a: number; color: string; ms: number }
  /** A coin that pops out of a minion the player last-hit, showing the gold it paid. */
  | { kind: 'coin'; x: number; y: number; gold: number; color: string; ms: number }
  /**
   * An ability's own effect, drawn by the view in that ability's look (`${championId}.${key}`, or
   * `${look}>hit` where a bolt struck): (x, y) where it lands, (x2, y2) where the caster stood, r the
   * area's radius and a the way the caster faced. The view sets how long it lasts.
   */
  | { kind: 'skill'; look: string; x: number; y: number; x2: number; y2: number; r: number; a: number; color: string; ms: number };

/** A sound the rules raise for the view to play, by name in the scene's sound table. */
export type SoundId =
  | 'swing' | 'shot' | 'crit' | 'towerShot' | 'beastClaw'
  | 'burst' | 'bolt' | 'dash' | 'ally' | 'buff' | 'zone' | 'impact'
  | 'lastHit' | 'slain' | 'youDie' | 'streak' | 'crash' | 'nexus' | 'wardBreak'
  | 'levelUp' | 'flask' | 'blink' | 'ward' | 'recallHome' | 'respawn' | 'buyBack'
  | 'wave' | 'watchstone' | 'rune' | 'runeTaken' | 'mercs' | 'spell' | 'ping' | 'growl' | 'beastSlain' | 'brute' | 'objective' | 'objectiveMissed';

/**
 * A sound raised by the rules: at a point in the world (the view plays it only where blue sees and
 * the camera shows), or anywhere when `x` is left out. `mine` marks the player's own deed.
 */
export interface SoundEvent {
  id: SoundId;
  x?: number;
  y?: number;
  mine?: boolean;
}

/** An objective's title: a text key, with the key of the champion's name to fill in `{name}`. */
export interface ObjectiveTitle {
  key: TextKey;
  name?: TextKey;
}

/** The goal the player's team is chasing now. `target` is the unit to bring down. */
export interface Objective {
  kind: ObjectiveKind;
  target: number;
  title: ObjectiveTitle;
  gold: number;
  banner: 'siege' | null;
  startAt: number;
  endsAt: number;
}

/** Two upgrades on offer after the player's champion reached `level`. */
export interface UpgradeOffer {
  level: number;
  /** Two upgrade ids, or three where the class's mastery adds one. */
  options: string[];
}

export interface GameState {
  phase: Phase;
  time: number;
  nextWave: number;
  nextId: number;
  units: Unit[];
  projectiles: Projectile[];
  /** Visuals raised since the view last drained this list. */
  fx: Fx[];
  /** Sounds raised since the view last drained this list (the view plays the ones it can see). */
  sounds: SoundEvent[];
  winner: Team | null;
  /** Multiplies the damage red's units deal, to make the match harder or easier. */
  enemyDamage: number;
  /** The player's champion's unit id. */
  player: number;
  /** Watch AI: the AI plays the player's champion as well, and no objectives run. */
  watch: boolean;
  /** The player's mastery rank with its class: its first `mastery` upgrade offers get a third card. */
  mastery: number;
  /** The objective in progress, or null between two. */
  objective: Objective | null;
  /** Index into `OBJECTIVES` of the next objective to start, and when it starts. */
  objectiveIndex: number;
  nextObjectiveAt: number;
  objectivesDone: number;
  /** How the last objective ended, for the card's message. */
  lastObjective: { title: ObjectiveTitle; done: boolean; gold: number; at: number } | null;
  /** The siege banner lasts until this game time. */
  siegeUntil: number;
  /** The enemy minion the player's next hit would kill, outlined in gold. */
  lastHitMark: number | null;
  /** Last hits the player landed, the unbroken run of them now, and the best run. */
  lastHits: number;
  streak: number;
  bestStreak: number;
  /** Level-up upgrade choices still waiting for the player, the first one shown. */
  upgradeOffers: UpgradeOffer[];
  /** The guardian beast's unit id, and until when each team's minions are empowered by it. */
  beast: number;
  beastBuff: Record<Team, number>;
  /** Beasts each team slew. */
  beastKills: Record<Team, number>;
  /** Whether the beast is in its elder form (from `ELDER.at`). */
  beastElder: boolean;
  /** Game time each team's elder blessing lasts until (0 when it has none). */
  elderBuff: Record<Team, number>;
  /** The AI champions sent to fight over the beast now. */
  contesters: number[];
  /** When the AI next sends gankers, and next sends a champion into the jungle. */
  nextGank: number;
  nextJungle: number;
  /** The rune at each of `RUNE.spots`, or null; when the next ones appear, and how many have so far. */
  runes: ({ kind: RuneKind; x: number; y: number } | null)[];
  nextRune: number;
  runeRounds: number;
  /** Pings on the map (the player's, and blue's AI calling a retreat), newest last, and when the player last pinged. */
  pings: Ping[];
  lastPingAt: number;
  /** Patches on the ground left by zone abilities. */
  zones: Zone[];
  /** Short messages for the player (the beast woke, an inhibitor fell), newest last. */
  notices: Notice[];
}

/** Plants a team's vision ward at a point; it burns out at `WARD.ms` from now. */
export function spawnWard(s: GameState, side: Team, x: number, y: number): Unit {
  const w = blankUnit(s, 'ward', side, x, y, { hp: WARD.hits, dmg: 0, armor: 0, range: 0, speed: 0, attackMs: 1000, radius: WARD.radius });
  w.expiresAt = s.time + WARD.ms;
  s.units.push(w);
  return w;
}

/** A ping on the map: its kind, where, by which team and when. */
export interface Ping {
  kind: PingKind;
  x: number;
  y: number;
  side: Team;
  at: number;
}

export interface Notice {
  text: string;
  color: string;
  at: number;
}

export function pathFor(lane: LaneId, team: Team): Vec[] {
  return team === 'blue' ? LANES[lane] : [...LANES[lane]].reverse();
}

export function blankUnit(
  s: GameState,
  kind: UnitKind,
  side: Side,
  x: number,
  y: number,
  stats: { hp: number; dmg: number; armor: number; range: number; speed: number; attackMs: number; radius: number },
): Unit {
  return {
    id: s.nextId++,
    kind,
    side,
    x,
    y,
    spawnX: x,
    spawnY: y,
    radius: stats.radius,
    hp: stats.hp,
    maxHp: stats.hp,
    shield: 0,
    shieldMs: 0,
    dmg: stats.dmg,
    armor: stats.armor,
    range: stats.range,
    speed: stats.speed,
    attackMs: stats.attackMs,
    attackCd: 0,
    slowMs: 0,
    facing: 0,
    walk: 0,
    swing: 0,
    flash: 0,
    castMs: 0,
    stunMs: 0,
    cdr: 0,
    dead: false,
    respawnAt: 0,
    target: null,
    lastHitBy: null,
    moveTo: null,
    path: null,
    wp: 0,
    lane: null,
    power: 1,
    revealMs: 0,
    aggroMs: 0,
    aiCastMs: 0,
    hidden: { blue: false, red: false },
    buffs: [],
    campKind: null,
    group: 0,
    capture: null,
    expiresAt: 0,
    champ: null,
    name: '',
    player: false,
    level: 1,
    xp: 0,
    gold: 0,
    items: [],
    cds: { Q: 0, W: 0, E: 0, R: 0 },
    cdFull: { Q: 1, W: 1, E: 1, R: 1 },
    upgrades: [],
    activeCds: {},
    spell: null,
    spellCd: 0,
    retreatUntil: 0,
    gankTarget: null,
    gankUntil: 0,
    jungleTarget: null,
    jungleUntil: 0,
    pingGoal: null,
    pingTarget: null,
    pingUntil: 0,
    attackCount: 0,
    lullMs: 0,
    hasteMs: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    cs: 0,
    hurtBy: {},
    killStreak: 0,
    wards: 0,
    recallMs: 0,
    lastRecallAt: -1e9,
    buybackReadyAt: 0,
  };
}

/** Recomputes a champion's stats from its level and items. Healing covers any new max health. */
export function refreshStats(u: Unit) {
  const c = u.champ;
  if (!c) return;
  const owned = ITEMS.filter((i) => u.items.includes(i.id));
  const sum = (key: 'hp' | 'dmg' | 'armor' | 'speed' | 'atk' | 'cdr') => owned.reduce((n, i) => n + (i[key] ?? 0), 0);
  const levels = u.level - 1;
  const maxHp = c.hp + levels * c.hpPerLevel + sum('hp');
  // A dead champion stays at 0 until it respawns full.
  if (!u.dead) u.hp += maxHp - u.maxHp;
  u.maxHp = maxHp;
  u.dmg = c.dmg + levels * c.dmgPerLevel + sum('dmg');
  u.armor = c.armor + sum('armor');
  u.speed = c.speed + sum('speed');
  u.attackMs = c.attackMs / (1 + sum('atk') / 100);
  u.cdr = sum('cdr');
}

export function spawnChampion(s: GameState, def: ChampionDef, side: Team, x: number, y: number, player: boolean, lane: LaneId | null, name = def.name) {
  const u = blankUnit(s, 'champion', side, x, y, {
    hp: 0,
    dmg: def.dmg,
    armor: def.armor,
    range: def.range,
    speed: def.speed,
    attackMs: def.attackMs,
    radius: 22,
  });
  u.hp = 0;
  u.maxHp = 0;
  u.champ = def;
  u.name = name;
  u.player = player;
  u.level = 1;
  u.gold = START_GOLD;
  u.spell = aiSpellFor(def);
  if (lane) {
    u.path = pathFor(lane, side);
    u.wp = 1;
    u.lane = lane;
  }
  refreshStats(u);
  u.hp = u.maxHp;
  s.units.push(u);
  return u;
}

export interface MatchOptions {
  /** Draws the rosters: Math.random in the game. */
  rnd?: () => number;
  /** Watch AI (`?watch`): the AI plays the player's champion too, in the top lane like red's fifth. */
  watch?: boolean;
  /** The player's mastery rank with the picked class (`masteryRank`), 0 when none. */
  mastery?: number;
  /** The player's battle spell; its role's when not given (and always when watching). */
  spell?: SpellId;
}

/**
 * A fresh match: the player's champion and four allies on blue, five champions on red, every one a
 * different class drawn at random, each played by its own champion, and the map.
 */
export function createGame(pick: ChampionDef, enemyDamage: number, opts: MatchOptions = {}): GameState {
  const rnd = opts.rnd ?? Math.random;
  const s: GameState = {
    phase: 'playing',
    time: 0,
    nextWave: 2000,
    nextId: 1,
    units: [],
    projectiles: [],
    fx: [],
    sounds: [],
    winner: null,
    enemyDamage,
    player: 0,
    watch: !!opts.watch,
    mastery: opts.watch ? 0 : (opts.mastery ?? 0),
    objective: null,
    objectiveIndex: 0,
    nextObjectiveAt: 0,
    objectivesDone: 0,
    lastObjective: null,
    siegeUntil: 0,
    lastHitMark: null,
    lastHits: 0,
    streak: 0,
    bestStreak: 0,
    upgradeOffers: [],
    beast: 0,
    beastBuff: { blue: 0, red: 0 },
    beastKills: { blue: 0, red: 0 },
    beastElder: false,
    elderBuff: { blue: 0, red: 0 },
    contesters: [],
    nextGank: GANK.firstAt,
    nextJungle: JUNGLE.firstAt,
    runes: RUNE.spots.map(() => null),
    nextRune: RUNE.firstAt,
    runeRounds: 0,
    pings: [],
    lastPingAt: -Infinity,
    zones: [],
    notices: [],
  };

  for (const team of ['blue', 'red'] as Team[]) {
    const nexus = blankUnit(s, 'nexus', team, BASE[team].x, BASE[team].y, {
      hp: NEXUS_HP,
      dmg: 0,
      armor: 0,
      range: 0,
      speed: 0,
      attackMs: 1000,
      radius: NEXUS_RADIUS,
    });
    s.units.push(nexus);
  }
  for (const t of TOWERS) {
    const tower = blankUnit(s, 'tower', t.team, t.x, t.y, {
        hp: TOWER.hp,
        dmg: TOWER.dmg,
        armor: 0,
        range: TOWER.range,
        speed: 0,
        attackMs: TOWER.attackMs,
        radius: TOWER.radius,
    });
    tower.lane = t.lane;
    s.units.push(tower);
  }
  for (const spot of INHIBITORS) {
    const inhib = blankUnit(s, 'inhibitor', spot.team, spot.x, spot.y, {
      hp: INHIBITOR.hp,
      dmg: 0,
      armor: 0,
      range: 0,
      speed: 0,
      attackMs: 1000,
      radius: INHIBITOR.radius,
    });
    inhib.lane = spot.lane;
    s.units.push(inhib);
  }
  for (const c of CAMPS) {
    const lead = spawnCamp(s, c.kind, c.x, c.y, 0);
    lead.facing = Math.atan2(WORLD.h / 2 - c.y, WORLD.w / 2 - c.x);
    // A wolf pack: the alpha and two pups beside it, which fight as one.
    if (c.kind === 'wolf') for (const d of PUPS) spawnCamp(s, 'pup', c.x + d.x, c.y + d.y, lead.id).facing = lead.facing;
  }
  for (const w of WATCHSTONES) {
    s.units.push(blankUnit(s, 'watchstone', 'neutral', w.x, w.y, { hp: 1, dmg: 0, armor: 0, range: 0, speed: 0, attackMs: 1000, radius: 20 }));
  }

  // The guardian beast sleeps until its first waking.
  const beast = blankUnit(s, 'beast', 'neutral', BEAST.x, BEAST.y, {
    hp: BEAST.hp,
    dmg: BEAST.dmg,
    armor: 10,
    range: BEAST.range,
    speed: 0,
    attackMs: BEAST.attackMs,
    radius: BEAST.radius,
  });
  beast.dead = true;
  beast.hp = 0;
  beast.respawnAt = BEAST.firstAt;
  beast.facing = Math.PI * 0.75;
  s.units.push(beast);
  s.beast = beast.id;

  // The other classes, shuffled: four join the player, five fight on red.
  const others = CHAMPIONS.filter((c) => c.id !== pick.id);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1)) % (i + 1);
    [others[i], others[j]] = [others[j], others[i]];
  }
  const offsets: Vec[] = [
    { x: 70, y: -40 },
    { x: 40, y: -90 },
    { x: 110, y: -10 },
    { x: 70, y: 40 },
    { x: 40, y: 90 },
  ];
  const blueAt = (i: number) => ({ x: BASE.blue.x + offsets[i].x, y: BASE.blue.y + offsets[i].y });
  const redAt = (i: number) => ({ x: BASE.red.x - offsets[i].x, y: BASE.red.y - offsets[i].y });

  const player = spawnChampion(s, pick, 'blue', blueAt(0).x, blueAt(0).y, !opts.watch, opts.watch ? 'top' : null, pick.hero);
  s.player = player.id;
  if (opts.spell && !opts.watch) player.spell = opts.spell;
  others.slice(0, 4).forEach((def, i) => {
    spawnChampion(s, def, 'blue', blueAt(i + 1).x, blueAt(i + 1).y, false, ALLY_LANES[i], def.hero);
  });
  others.slice(4, 9).forEach((def, i) => {
    spawnChampion(s, def, 'red', redAt(i).x, redAt(i).y, false, ENEMY_LANES[i], def.hero);
  });

  // The mercenary camps, a band of sellswords each that fight as one.
  for (const m of MERC.spots) {
    let lead: Unit | null = null;
    for (let i = 0; i < MERC.count; i++) {
      const a = (i / MERC.count) * Math.PI * 2;
      const u = spawnCamp(s, 'merc', m.x + Math.cos(a) * MERC.spread, m.y + Math.sin(a) * MERC.spread * 0.7, lead?.id ?? 0);
      u.facing = Math.atan2(WORLD.h / 2 - m.y, WORLD.w / 2 - m.x);
      lead ??= u;
    }
  }

  return s;
}

/**
 * A mercenary band won by `team`: `MERC.count` strong minions at a camp, which walk to the end of
 * the nearest stretch of the nearest lane and on down it. Returns the lane.
 */
export function spawnMercs(s: GameState, team: Team, at: Vec): LaneId {
  const lane = laneNear(at);
  const full = pathFor(lane, team);
  let seg = 0;
  let bestD = Infinity;
  for (let i = 0; i < full.length - 1; i++) {
    const a = full[i], b = full[i + 1];
    const dx = b.x - a.x, dy = b.y - a.y;
    const t = Math.max(0, Math.min(1, ((at.x - a.x) * dx + (at.y - a.y) * dy) / (dx * dx + dy * dy)));
    const d = Math.hypot(at.x - (a.x + dx * t), at.y - (a.y + dy * t));
    if (d < bestD) {
      bestD = d;
      seg = i;
    }
  }
  const path = [{ x: at.x, y: at.y }, ...full.slice(seg + 1)];
  for (let i = 0; i < MERC.count; i++) {
    const m = blankUnit(s, 'minion', team, at.x + (i - 1) * 24, at.y + (i % 2) * 14, {
      hp: MINION.hp * MERC.power,
      dmg: MINION.dmg * MERC.power,
      armor: 0,
      range: MINION.range,
      speed: MINION.speed,
      attackMs: MINION.attackMs,
      radius: MINION.radius,
    });
    m.path = path;
    m.wp = 1;
    m.lane = lane;
    m.power = MERC.power;
    s.units.push(m);
  }
  return lane;
}

/** A jungle monster of a kind at a spot; `group` is its pack's alpha (0 for itself). */
export function spawnCamp(s: GameState, kind: CampKind, x: number, y: number, group: number): Unit {
  const def = CAMP_KINDS[kind];
  const u = blankUnit(s, 'camp', 'neutral', x, y, { hp: def.hp, dmg: def.dmg, armor: def.armor, range: def.range, speed: 0, attackMs: def.attackMs, radius: def.radius });
  u.campKind = kind;
  u.group = group || u.id;
  s.units.push(u);
  return u;
}

/** Puts a wave of minions on each lane from both Nexuses. */
export function spawnWave(s: GameState) {
  for (const team of ['blue', 'red'] as Team[]) {
    for (const lane of ['top', 'mid', 'bottom'] as LaneId[]) {
      for (let i = 0; i < 3; i++) {
        const jitter = i * 12;
        const x = BASE[team].x + (team === 'blue' ? 1 : -1) * (30 + jitter);
        const y = BASE[team].y + (team === 'blue' ? -1 : 1) * (30 + jitter);
        // A lane whose enemy inhibitor has fallen sends super minions.
        const power = s.units.some((u) => u.kind === 'inhibitor' && u.dead && u.side !== team && u.lane === lane) ? SUPER_MINION : 1;
        const m = blankUnit(s, 'minion', team, x, y, {
          hp: MINION.hp * power,
          dmg: MINION.dmg * power,
          armor: 0,
          range: MINION.range,
          speed: MINION.speed,
          attackMs: MINION.attackMs,
          radius: MINION.radius,
        });
        m.path = pathFor(lane, team);
        m.wp = 1;
        m.lane = lane;
        m.power = power;
        s.units.push(m);
      }
    }
  }
  s.nextWave = s.time + WAVE_MS;
}

export function getUnit(s: GameState, id: number | null): Unit | null {
  if (id === null) return null;
  return s.units.find((u) => u.id === id) ?? null;
}

export function levelFor(xp: number): number {
  let level = 1;
  for (let i = 1; i < XP_FOR_LEVEL.length; i++) if (xp >= XP_FOR_LEVEL[i]) level = i + 1;
  return Math.min(level, MAX_LEVEL);
}

export function dist(a: Vec, b: Vec): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The lane whose centre line runs nearest a point. */
export function laneNear(p: Vec): LaneId {
  let best: LaneId = 'mid';
  let bestD = Infinity;
  for (const [id, pts] of Object.entries(LANES) as [LaneId, Vec[]][]) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
      const d = Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
  }
  return best;
}
