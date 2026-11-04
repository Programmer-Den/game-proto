// What a playthrough of Bramblecrest knows: where the knight is, their hearts and things, the
// moonstones found, the quest they are on and every flag the world has set. Saved to the browser
// whenever the knight changes place or the quest moves on.

import { byDifficulty } from '../../../../shared/settings';
import { isMapId, type EnemyKind, type Facing, type FishId, type ItemId, type MapId, type NpcId, type RequestId } from './maps';
import type { TextKey } from '../i18n';
import { formatNumber } from '../../../../shared/i18n';

export const SAVE_KEY = 'bramblecrest-save';

/** Health is counted in half hearts. */
export const START_HEARTS = byDifficulty(5, 3, 2);
/** Moonstones hidden in the first chapter, in the first two together, the first three, and in all four. */
export const CHAPTER_ONE_STONES = 8;
export const CHAPTER_TWO_STONES = 13;
export const CHAPTER_THREE_STONES = 17;
export const MOONSTONES = 22;
/** The most bellseeds the knight can carry, and with Sedge's bigger pouch. */
export const MAX_SEEDS = 10;
export const BIG_POUCH = 15;

/** Who sells upgrades: Marla in Mossford and Old Sedge in the fen. */
export type Seller = 'baker' | 'hermit';
/** What coins buy (`UPGRADES`), and what the villagers give for their requests (`REQUESTS`). */
export type UpgradeId = 'pie' | 'boots' | 'pouch' | 'vine' | 'whetstone' | 'pockets' | 'charm';
/**
 * What coins buy, for good: a heart (`pie`), a longer, quicker roll (`boots`), a bigger bellseed
 * pouch (`pouch`) and a longer hookvine (`vine`). `needs` is an item the knight must have first.
 */
export const UPGRADES: { id: UpgradeId; seller: Seller; cost: number; needs?: 'seeds' | 'hookvine' }[] = [
  { id: 'pie', seller: 'baker', cost: 30 },
  { id: 'boots', seller: 'baker', cost: 15 },
  { id: 'pouch', seller: 'hermit', cost: 20, needs: 'seeds' },
  { id: 'vine', seller: 'hermit', cost: 25, needs: 'hookvine' },
];

export function hasUpgrade(s: GameState, id: UpgradeId) {
  return s.upgrades.includes(id);
}

/** How many bellseeds the knight can carry now. */
export function maxSeeds(s: GameState) {
  return hasUpgrade(s, 'pouch') ? BIG_POUCH : MAX_SEEDS;
}

/** Buys an upgrade if the knight has the coins; returns whether it was bought. */
export function buy(s: GameState, id: UpgradeId) {
  const u = UPGRADES.find((x) => x.id === id)!;
  if (hasUpgrade(s, id) || s.coins < u.cost || (u.needs && !s.items[u.needs])) return false;
  s.coins -= u.cost;
  s.upgrades.push(id);
  if (id === 'pie') {
    s.maxHp += 2;
    s.hp = s.maxHp;
  } else if (id === 'pouch') s.seeds = BIG_POUCH;
  return true;
}

/**
 * The villagers' requests: who asks, how many of the thing they want lie about (the map's `finds`),
 * from which step of the story they ask, and what they give. `heart` is a heart vessel; the rest
 * are kept in `upgrades`: the whetstone (a longer sword reach), a deep purse (two coins a foe) and
 * a moon charm (longer safe after a hit).
 */
export const REQUESTS: { id: RequestId; giver: NpcId; count: number; from: Quest; reward: 'heart' | 'whetstone' | 'pockets' | 'charm' }[] = [
  { id: 'lilies', giver: 'baker', count: 3, from: 'done', reward: 'heart' },
  { id: 'boat', giver: 'pip', count: 1, from: 'done', reward: 'whetstone' },
  { id: 'glowcaps', giver: 'elder', count: 3, from: 'bell', reward: 'pockets' },
  { id: 'specs', giver: 'hermit', count: 1, from: 'home', reward: 'charm' },
  { id: 'goatbells', giver: 'herder', count: 3, from: 'peaks', reward: 'heart' },
];

/** How many of a request's things the knight has picked up (flags `find-<request>-<i>`). */
export function found(s: GameState, id: RequestId) {
  return s.flags.filter((f) => f.startsWith(`find-${id}-`)).length;
}

/**
 * The quest line of the four chapters, in order. `final` is chapter three's end (the elder then
 * tells of the coast) and `after` the post-game, after chapter four.
 */
export const QUESTS = ['start', 'blade', 'thorns', 'shrine', 'return', 'done', 'bell', 'belfry', 'home', 'end', 'peaks', 'caverns', 'homeward', 'final', 'coast', 'seacave', 'tidings', 'after'] as const;
export type Quest = (typeof QUESTS)[number];

/** A time on the clock as m:ss.t, with the language's decimal mark. */
export function clock(ms: number) {
  const tenths = Math.floor(ms / 100);
  const m = Math.floor(tenths / 600);
  const sec = (tenths % 600) / 10;
  return `${m}:${formatNumber(sec, { minimumIntegerDigits: 2, minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

/** The text the journal line shows for each step of the quest. */
export const OBJECTIVES: Record<Quest, TextKey> = {
  start: 'objStart',
  blade: 'objBlade',
  thorns: 'objThorns',
  shrine: 'objShrine',
  return: 'objReturn',
  done: 'objDone',
  bell: 'objBell',
  belfry: 'objBelfry',
  home: 'objHome',
  end: 'objEnd',
  peaks: 'objPeaks',
  caverns: 'objCaverns',
  homeward: 'objHomeward',
  final: 'objFinal',
  coast: 'objCoast',
  seacave: 'objSeacave',
  tidings: 'objTidings',
  after: 'objAfter',
};

/** Whether the quest has reached `q`. */
export function reached(s: GameState, q: Quest) {
  return QUESTS.indexOf(s.quest) >= QUESTS.indexOf(q);
}

/** How many moonstones there are to find so far: each chapter's show up once it starts. */
export function stonesToFind(s: GameState) {
  return reached(s, 'coast') ? MOONSTONES : reached(s, 'peaks') ? CHAPTER_THREE_STONES : reached(s, 'bell') ? CHAPTER_TWO_STONES : CHAPTER_ONE_STONES;
}

/** Whether a moonstone of a chapter counts yet. */
export function stoneCounts(s: GameState, chapter?: 2 | 3 | 4) {
  return chapter === 4 ? reached(s, 'coast') : chapter === 3 ? reached(s, 'peaks') : chapter === 2 ? reached(s, 'bell') : true;
}

/** The most of each fish the knight's creel holds. */
export const FISH_MAX = 5;
export const FISH: FishId[] = ['perch', 'eel', 'bream'];
/** A campfire's meals: the fish each takes and how many. One meal at a time, until the knight next falls. */
export type MealId = 'stew' | 'skewer' | 'chowder';
export const MEALS: { id: MealId; fish: FishId; n: number }[] = [
  { id: 'stew', fish: 'perch', n: 2 },
  { id: 'skewer', fish: 'eel', n: 2 },
  { id: 'chowder', fish: 'bream', n: 2 },
];

/** Cooks and eats a meal if the creel holds its fish; returns whether it was cooked. Perch stew is one more heart while it lasts. */
export function cook(s: GameState, id: MealId) {
  const m = MEALS.find((x) => x.id === id)!;
  if (s.meal === id || s.fish[m.fish] < m.n) return false;
  s.fish[m.fish] -= m.n;
  endMeal(s);
  s.meal = id;
  if (id === 'stew') s.maxHp += 2;
  s.hp = s.maxHp;
  return true;
}

/** The meal wears off (a fall, or another meal): the stew's heart goes with it. */
export function endMeal(s: GameState) {
  if (s.meal === 'stew') {
    s.maxHp -= 2;
    s.hp = Math.min(s.hp, s.maxHp);
  }
  s.meal = null;
}

export interface GameState {
  map: MapId;
  /** Where the knight is, in pixels, and which way they face. */
  x: number;
  y: number;
  facing: Facing;
  /** Where the knight wakes after a fall: the tile they last entered this map on. */
  spawn: { map: MapId; x: number; y: number; facing: Facing };
  hp: number;
  maxHp: number;
  items: { sword: boolean; hookvine: boolean; oil: boolean; seeds: boolean; moonlantern: boolean; horn: boolean; rod: boolean };
  keys: number;
  /** Bellseeds carried. */
  seeds: number;
  moonstones: string[];
  flags: string[];
  quest: Quest;
  /** Times the knight has fallen. */
  falls: number;
  /** Foes beaten, for the chapter's end card. */
  beaten: number;
  /** The best time of each dungeon's hourglass trial, in ms of play. */
  trials: Partial<Record<MapId, number>>;
  /** Coins from cut bushes and beaten foes, and the upgrades they bought. */
  coins: number;
  upgrades: UpgradeId[];
  /** The villagers' requests taken and done. */
  requests: Partial<Record<RequestId, 'taken' | 'done'>>;
  /** How many times new game+ began again: 0 on a first run. */
  cycle: number;
  /** Fish in the creel, and the meal eaten (until the next fall). */
  fish: Record<FishId, number>;
  meal: MealId | null;
  /** Foes beaten of each kind, for the bestiary. */
  bestiary: Partial<Record<EnemyKind, number>>;
}

export function newState(): GameState {
  const spawn = { map: 'village' as MapId, x: 25.5 * 32, y: 19.5 * 32, facing: 'down' as Facing };
  return {
    map: spawn.map,
    x: spawn.x,
    y: spawn.y,
    facing: spawn.facing,
    spawn,
    hp: START_HEARTS * 2,
    maxHp: START_HEARTS * 2,
    items: { sword: false, hookvine: false, oil: false, seeds: false, moonlantern: false, horn: false, rod: false },
    keys: 0,
    seeds: 0,
    moonstones: [],
    flags: [],
    quest: 'start',
    falls: 0,
    beaten: 0,
    trials: {},
    coins: 0,
    upgrades: [],
    requests: {},
    cycle: 0,
    fish: { perch: 0, eel: 0, bream: 0 },
    meal: null,
    bestiary: {},
  };
}

/**
 * New game+: the story starts over from the first night, one cycle on, keeping the tools, the
 * upgrades, the coins, the requests done, the trials' best times, the creel and the bestiary. Hearts
 * start again, with the pie's and the requests' hearts kept; a meal does not carry over.
 */
export function newPlus(old: GameState): GameState {
  const s = newState();
  s.items = { ...old.items };
  s.upgrades = [...old.upgrades];
  s.coins = old.coins;
  s.requests = { ...old.requests };
  s.trials = { ...old.trials };
  s.cycle = old.cycle + 1;
  s.fish = { ...old.fish };
  s.bestiary = { ...old.bestiary };
  const hearts = (hasUpgrade(s, 'pie') ? 1 : 0) + REQUESTS.filter((r) => r.reward === 'heart' && s.requests[r.id] === 'done').length;
  s.maxHp += hearts * 2;
  s.hp = s.maxHp;
  s.seeds = s.items.seeds ? maxSeeds(s) : 0;
  return s;
}

/** Hands in a request: marks it done and gives its reward. */
export function reward(s: GameState, id: RequestId) {
  const r = REQUESTS.find((x) => x.id === id)!;
  s.requests[id] = 'done';
  if (r.reward === 'heart') give(s, 'heart');
  else if (!hasUpgrade(s, r.reward)) s.upgrades.push(r.reward);
}

export function hasFlag(s: GameState, flag: string) {
  return s.flags.includes(flag);
}

export function setFlag(s: GameState, flag: string) {
  if (!s.flags.includes(flag)) s.flags.push(flag);
}

/** Moves the quest on to `q`, never back. */
export function advance(s: GameState, q: Quest) {
  if (QUESTS.indexOf(q) > QUESTS.indexOf(s.quest)) s.quest = q;
}

/** Gives the knight a thing found in a chest. */
export function give(s: GameState, item: ItemId) {
  if (item === 'sword') s.items.sword = true;
  else if (item === 'hookvine') s.items.hookvine = true;
  else if (item === 'oil') s.items.oil = true;
  else if (item === 'moonlantern') s.items.moonlantern = true;
  else if (item === 'horn') s.items.horn = true;
  else if (item === 'rod') s.items.rod = true;
  else if (item === 'key') s.keys++;
  else if (item === 'seeds') {
    s.items.seeds = true;
    s.seeds = maxSeeds(s);
  }
  else if (item === 'heart') {
    s.maxHp += 2;
    s.hp = s.maxHp;
  }
}

export function save(s: GameState) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    // Storage can be blocked (private mode); the run lasts until the page closes.
  }
}

/** Whether a saved place is on a map that exists, at a real position. */
function placeOk(p: { map?: unknown; x?: unknown; y?: unknown } | undefined) {
  return !!p && isMapId(p.map) && Number.isFinite(p.x) && Number.isFinite(p.y);
}

/** The saved playthrough, or a new one when there is none (or it can't be read). */
export function load(): GameState {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<GameState>;
      const fresh = newState();
      if (saved && QUESTS.includes(saved.quest as Quest) && placeOk(saved) && placeOk(saved.spawn ?? fresh.spawn)) return { ...fresh, ...saved, items: { ...fresh.items, ...saved.items }, fish: { ...fresh.fish, ...saved.fish } };
    }
  } catch {
    // A broken save starts over.
  }
  return newState();
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
