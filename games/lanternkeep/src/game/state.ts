import { byDifficulty } from '../../../../shared/settings';
import type { TextKey } from '../i18n';
import { VIEW } from '../scenes/layout';
import { BELL_TOWERS, DISTRICTS, type DistrictId, JARS, LANTERN_SPOTS, MOVE_IDS, mothRest, SHIP_GUIDES } from './places';

// The rules in plain TypeScript, with no Phaser. Each night begins with a dusk: tap a lantern and
// an idle moth flies from the jar to light it, then flies home. A lit lantern burns its oil and
// goes out when the oil runs dry. When dusk ends, night falls and every lantern still lit pays;
// too few lit costs one of the keep's hearths. Between nights the coins buy upgrades. Each night
// the herald orders a bonus goal, gusts blow out lanterns no moth is sitting on, and a refill that
// saves a nearly dry lantern pays a little at once. Each night draws a kind (fog, a feast, a
// storm), bats come for the lanterns from the third night, lanterns side by side form chains that
// pay when all of them are lit, and ten nights kept reach the Great Festival, a win, with endless
// nights after. From the second night cottage windows call for a named lantern, from the third
// refills draw on a cask of oil topped up between nights, from the fourth some spots hold a
// beacon, a candle or a bell, every fifth night the Great Owl sweeps a row of lanterns, and at
// every fifth nightfall the keep can move to another district with its own spots and rule. Late
// nights add tired moths (from the sixth), a second jar to buy, lost hearths to rekindle and, from
// the tenth nightfall, curses to pick that raise the pay. After the Great Festival the keep can sail
// to a harbour town with tides and ships and a festival of its own, which gives a boon kept for
// every later game (LK15); the moths of the jar grow traits from the flights they fly, kept from
// game to game (LK16); and a daily night gives everyone the same seeded dusk once a day (LK17).
// Every night kept adds a house to a village below the keep, kept from game to game, whose smithy,
// chandler and chapel give lasting perks (LK18); the nights turn through the seasons, with long
// snowy winter dusks and short stormy summer ones (LK19); and the Great Festival can send the keep
// up to a mountain monastery, where avalanches bury the low path and its bells warn pilgrims (LK20).

export const UPGRADE_IDS = ['wick', 'oil', 'moths', 'wings', 'firefly', 'nectar', 'jar'] as const;
export type UpgradeId = (typeof UPGRADE_IDS)[number];

export interface Upgrade {
  name: TextKey;
  /** What one level does, shown on its button. */
  blurb: TextKey;
  /** The cost of each level; its length is the most levels there are. */
  costs: readonly number[];
}

export const UPGRADES: Record<UpgradeId, Upgrade> = {
  wick: { name: 'wickName', blurb: 'wickBlurb', costs: [10, 20, 35] },
  oil: { name: 'oilName', blurb: 'oilBlurb', costs: [10, 20, 35] },
  moths: { name: 'mothsName', blurb: 'mothsBlurb', costs: [15, 30, 50] },
  wings: { name: 'wingsName', blurb: 'wingsBlurb', costs: [10, 20, 35] },
  firefly: { name: 'fireflyName', blurb: 'fireflyBlurb', costs: [25, 45] },
  nectar: { name: 'nectarName', blurb: 'nectarBlurb', costs: [15, 30, 50] },
  jar: { name: 'jarName', blurb: 'jarBlurb', costs: [120] },
};

/**
 * Tired moths (LK13): from TIRED_NIGHT a moth that comes home from its TIRED_FLIGHTS-th flight of
 * the dusk rests TIRED_MS in the jar before it can fly again; each Nectar level takes NECTAR_MS off.
 */
export const TIRED_NIGHT = 6;
export const TIRED_FLIGHTS = 4;
export const TIRED_MS = 6_000;
export const NECTAR_MS = 1_500;
/** How long a tired moth rests, with the Nectar bought. */
export const restMs = (s: GameState) => Math.max(0, TIRED_MS - NECTAR_MS * s.levels.nectar);

/** Rekindle a hearth (LK12): between nights coins buy back a lost hearth, at these prices in turn. */
export const HEARTH_COSTS = [40, 80, 120] as const;
/** The price of rekindling a hearth now, or null when none is out or all three rekindles are spent. */
export const hearthCost = (s: GameState) => (s.lives < LIVES ? (HEARTH_COSTS[s.rekindled] ?? null) : null);

/**
 * A second keep (LK15): the harbour's tide floods its lowest row of lanterns at TIDE_TIMES (dusk
 * left), warned TIDE_WARN_MS before, for TIDE_MS: the lanterns there go dark and can't be lit
 * until it ebbs. Ships come at SHIP_TIMES and take SHIP_MS to sail in; one whose guiding lantern
 * (SHIP_GUIDES) is lit when it arrives pays SHIP_PAY.
 */
export const TIDE_TIMES = [32_000, 14_000];
export const TIDE_WARN_MS = 5_000;
export const TIDE_MS = 7_000;
export const SHIP_TIMES = [40_000, 24_000];
export const SHIP_MS = 12_000;
export const SHIP_PAY = 6;
/** Where ships sail across the screen, as a height in view pixels. */
export const SHIP_Y = 262;

/**
 * The boons of the Harbour Festival (LK15): the one picked lasts the rest of the game and every
 * later game, in either keep. A purse of BOON_COINS at the first dusk, a cask BOON_CASK fills
 * bigger that starts full, or a free Firefly level.
 */
export const BOONS = {
  purse: { name: 'purseName', blurb: 'purseBlurb' },
  cask: { name: 'bigCaskName', blurb: 'bigCaskBlurb' },
  pilot: { name: 'pilotName', blurb: 'pilotBlurb' },
} as const satisfies Record<string, { name: TextKey; blurb: TextKey }>;
export type BoonId = keyof typeof BOONS;
export const BOON_IDS = Object.keys(BOONS) as BoonId[];
export const BOON_COINS = 30;
export const BOON_CASK = 2;

/**
 * Moth breeds (LK16): each moth of the jar (not a firefly) counts the flights it has ever flown,
 * kept from game to game by its place in the jar, and gains a trait at each of TRAIT_FLIGHTS, in
 * TRAIT_IDS order starting from its place. Swift flies SWIFT_SPEED faster, frugal fills
 * FRUGAL_OIL more oil, and a lantern a gust-proof moth lit or refilled shrugs off the next gust.
 */
export const TRAIT_IDS = ['swift', 'frugal', 'gustproof'] as const;
export type TraitId = (typeof TRAIT_IDS)[number];
export const TRAIT_FLIGHTS = [25, 75, 150] as const;
export const SWIFT_SPEED = 1.2;
export const FRUGAL_OIL = 1.25;
/** The traits of moth `i`, gained so far; none on a firefly or on a daily night. */
export function traitsOf(s: GameState, i: number): TraitId[] {
  const m = s.moths[i];
  if (!s.breeds || !m || m.kind === 'firefly') return [];
  const n = TRAIT_FLIGHTS.filter((f) => (s.flown[i] ?? 0) >= f).length;
  return Array.from({ length: n }, (_, k) => TRAIT_IDS[(i + k) % TRAIT_IDS.length]);
}
const hasTrait = (s: GameState, m: Moth, trait: TraitId) => traitsOf(s, s.moths.indexOf(m)).includes(trait);
/** Counts a flight out of the jar: for tired moths, and for the moth's breed, which may gain a trait. */
function flew(s: GameState, m: Moth) {
  m.flights++;
  const i = s.moths.indexOf(m);
  if (!s.breeds || m.kind === 'firefly') return;
  const had = traitsOf(s, i).length;
  s.flown[i] = (s.flown[i] ?? 0) + 1;
  const now = traitsOf(s, i);
  if (now.length > had) s.events.push({ type: 'trait', moth: i, trait: now[now.length - 1] });
}

/**
 * The daily night (LK17): one seeded dusk, the same for every player on the same day, on one of
 * DAILY_NIGHTS in a keep district with a kind of night and two curses, with DAILY_LEVELS bought and
 * a full cask. The score is the coins at nightfall, halved if too few lanterns burn.
 */
export const DAILY_NIGHTS = [6, 7, 8, 9, 10, 11, 12];
export const DAILY_LEVELS: Record<UpgradeId, number> = { wick: 1, oil: 1, moths: 1, wings: 1, firefly: 1, nectar: 1, jar: 0 };

/**
 * A village that grows (LK18): every night kept adds a house below the keep, kept from game to
 * game. Between nights coins build each of BUILDINGS once the village has its `houses`, and a
 * building lasts for every later game: the smithy makes a cask fill cost SMITHY_CASK_COST, the
 * chandler adds a spare moth to the jar, and the chapel spares the first hearth a game would lose.
 */
export const BUILDINGS = {
  smithy: { name: 'smithyName', blurb: 'smithyBlurb', cost: 60, houses: 3 },
  chandler: { name: 'chandlerName', blurb: 'chandlerBlurb', cost: 90, houses: 6 },
  chapel: { name: 'chapelHouseName', blurb: 'chapelHouseBlurb', cost: 120, houses: 10 },
} as const satisfies Record<string, { name: TextKey; blurb: TextKey; cost: number; houses: number }>;
export type BuildingId = keyof typeof BUILDINGS;
export const BUILDING_IDS = Object.keys(BUILDINGS) as BuildingId[];
export const SMITHY_CASK_COST = 2;
/** The village: its houses (one a night kept, in any game) and the buildings built. */
export interface Village {
  houses: number;
  built: BuildingId[];
}
/** True when the village has building `id`. */
export const hasBuilt = (s: GameState, id: BuildingId) => s.village.built.includes(id);

/**
 * Seasons (LK19): the nights turn through SEASON_IDS, SEASON_NIGHTS each, from spring on night 1.
 * Summer dusks are SUMMER_DUSK_MS short and half of its nights are stormy; autumn's are foggy as
 * often; winter dusks are WINTER_DUSK_MS long, but snow slows the moths to SNOW_SPEED.
 */
export const SEASONS = {
  spring: { name: 'springName', blurb: 'springBlurb' },
  summer: { name: 'summerName', blurb: 'summerBlurb' },
  autumn: { name: 'autumnName', blurb: 'autumnBlurb' },
  winter: { name: 'winterName', blurb: 'winterBlurb' },
} as const satisfies Record<string, { name: TextKey; blurb: TextKey }>;
export type SeasonId = keyof typeof SEASONS;
export const SEASON_IDS = Object.keys(SEASONS) as SeasonId[];
export const SEASON_NIGHTS = 3;
export const SUMMER_DUSK_MS = 36_000;
export const WINTER_DUSK_MS = 54_000;
export const SNOW_SPEED = 0.85;
/** The share of summer nights drawn stormy and of autumn nights drawn foggy, before the usual draw. */
export const SEASON_KIND = 0.5;
/** The season of night `night`. */
export const seasonOf = (night: number): SeasonId => SEASON_IDS[Math.floor((night - 1) / SEASON_NIGHTS) % SEASON_IDS.length];
/** How long the dusk of night `night` lasts: short in summer, long in winter. */
export const duskFor = (night: number) => {
  const season = seasonOf(night);
  return season === 'summer' ? SUMMER_DUSK_MS : season === 'winter' ? WINTER_DUSK_MS : DUSK_MS;
};

/**
 * A third keep (LK20): the mountain monastery, climbed to from the Great Festival. At
 * AVALANCHE_TIMES (dusk left), warned AVALANCHE_WARN_MS before, an avalanche buries its lowest row
 * (the pilgrims' path): each lantern there with no moth on it goes dark under the snow, and a moth
 * sent to it digs DIG_MS before it lights. Each warning brings a pilgrim up the path, and a moth
 * that lights or refills the named bell tower (BELL_TOWERS) before the snow comes warns them, for
 * PILGRIM_PAY. Ten nights kept there hold the Mountain Festival, which gives a boon like the harbour's.
 */
export const AVALANCHE_TIMES = [30_000, 12_000];
export const AVALANCHE_WARN_MS = 8_000;
export const DIG_MS = 2_000;
export const PILGRIM_PAY = 6;

/**
 * Pick your peril (LK11): every nightfall before a night from PERIL_NIGHT offers two curses drawn
 * from CURSES. Each one taken lasts the rest of the game and adds PERIL_STEP to the multiplier on
 * what every nightfall pays; the best multiplier reached is saved.
 */
export const PERIL_NIGHT = 11;
export const PERIL_STEP = 0.25;
export const CURSES = {
  wet: { name: 'wetName', blurb: 'wetBlurb' },
  bats: { name: 'batsName', blurb: 'batsBlurb' },
  thin: { name: 'thinName', blurb: 'thinBlurb' },
  watch: { name: 'watchName', blurb: 'watchBlurb' },
} as const satisfies Record<string, { name: TextKey; blurb: TextKey }>;
export type CurseId = keyof typeof CURSES;
export const CURSE_IDS = Object.keys(CURSES) as CurseId[];
/** What each Wet wicks multiplies the wick time by, and each Thin oil the burn. */
export const WET_WICK = 1.5;
export const THIN_BURN = 1.25;
/** When the bats of Restless bats come, as dusk left, one more for each taken. */
export const RESTLESS_BATS = [22_000, 8_000, 36_000, 12_000, 26_000, 4_000];
/** What every nightfall's pay is multiplied by, for the curses taken. */
export const perilMult = (s: GameState) => 1 + PERIL_STEP * CURSE_IDS.reduce((n, id) => n + s.curses[id], 0);
/** Two different curses, drawn with Math.random. */
function drawOffer(): CurseId[] {
  const ids = [...CURSE_IDS];
  const first = ids.splice(Math.floor(Math.random() * ids.length), 1)[0];
  return [first, ids[Math.floor(Math.random() * ids.length)]];
}

/** How long each dusk lasts before night falls, in milliseconds. */
export const DUSK_MS = 45_000;
/** Hearths the keep starts with; a night with too few lanterns lit puts one out. */
export const LIVES = 3;
/** Coins for each lantern lit at nightfall, and the bonus when every one is. */
export const PAY_PER_LANTERN = 5;
export const ALL_LIT_BONUS = 10;
/** Moths in the jar, their speed (px/s) and how long a wick takes to catch, before upgrades. */
export const BASE_MOTHS = 3;
export const BASE_SPEED = 160;
export const BASE_LIGHT_MS = 1500;
/** How long a lantern burns on a full fill of oil, before upgrades: longer on Easy, shorter on Hard. */
export const baseBurnMs = () => byDifficulty(26_000, 20_000, 16_000);

/**
 * The three kinds of moth. The jar holds them in KIND_ORDER (fast, slow, heavy, fast, ...), so
 * the first night's three moths are one of each. Each multiplies the base speed, wick time and oil.
 */
export const MOTH_KINDS = {
  fast: { speed: 1.5, wick: 1.3, oil: 1 },
  slow: { speed: 0.75, wick: 0.7, oil: 1 },
  heavy: { speed: 0.8, wick: 1, oil: 1.5 },
  /** Bought with the Firefly upgrade, not part of KIND_ORDER: lights a second lantern before flying home. */
  firefly: { speed: 1.1, wick: 1, oil: 1 },
} as const;
export type MothKind = keyof typeof MOTH_KINDS;
export const KIND_ORDER: readonly MothKind[] = ['fast', 'slow', 'heavy'];
/** Lanterns a firefly lights in one flight. */
export const FIREFLY_LANTERNS = 2;
/** Taps kept while every moth is busy; a tap past this is lost. */
export const QUEUE_MAX = 2;

/**
 * The kinds of lantern (LK6). From LANTERN_KINDS_NIGHT some spots hold one: a beacon holds 40% less
 * oil but pays triple at nightfall, a candle catches at once but holds half the oil, and a bell
 * stuns every bat within BELL_RANGE of it while it is lit. Each multiplies the oil a fill gives,
 * the wick time and the pay a lantern.
 */
export const LANTERN_KINDS = {
  plain: { name: 'plainName', oil: 1, wick: 1, pay: 1 },
  beacon: { name: 'beaconName', oil: 0.6, wick: 1, pay: 3 },
  candle: { name: 'candleName', oil: 0.5, wick: 0, pay: 1 },
  bell: { name: 'bellName', oil: 1, wick: 1, pay: 1 },
} as const satisfies Record<string, { name: TextKey; oil: number; wick: number; pay: number }>;
export type LanternKind = keyof typeof LANTERN_KINDS;
/** The kinds of lantern that spots hold, in the order nights deal them. */
export const SPECIAL_KINDS: readonly LanternKind[] = ['beacon', 'candle', 'bell'];
/** The first night with special lanterns, and the most of them a night has. */
export const LANTERN_KINDS_NIGHT = 4;
export const LANTERN_KINDS_MAX = 3;
/** How near a lit bell a bat must be to be stunned, in view pixels. */
export const BELL_RANGE = 150;
/**
 * The kind of each of the night's `count` lanterns: all plain before LANTERN_KINDS_NIGHT, then one
 * more special spot each night up to LANTERN_KINDS_MAX, dealt to spots that change with the night.
 */
export function lanternKindsFor(night: number, count: number): LanternKind[] {
  const kinds: LanternKind[] = Array.from({ length: count }, () => 'plain');
  if (night < LANTERN_KINDS_NIGHT) return kinds;
  const specials = Math.min(LANTERN_KINDS_MAX, night - LANTERN_KINDS_NIGHT + 1, count);
  for (let k = 0; k < specials; k++) {
    let spot = (night * 7 + k * 4) % count;
    while (kinds[spot] !== 'plain') spot = (spot + 1) % count;
    kinds[spot] = SPECIAL_KINDS[(night + k) % SPECIAL_KINDS.length];
  }
  return kinds;
}

/** How long before a gust its warning shows the lantern it will blow out, in milliseconds. */
export const GUST_WARN_MS = 5_000;
/**
 * When each gust hits, as dusk left in milliseconds. Night 1 has one, nights 2 and 3 two, and
 * every night after three.
 */
export function gustsFor(night: number, kind: NightKind = 'clear') {
  const gusts = [34_000, 22_000, 10_000].slice(0, night === 1 ? 1 : night <= 3 ? 2 : 3);
  // A stormy night adds two gusts between them, still more than GUST_WARN_MS apart.
  return kind === 'storm' ? [...gusts, ...STORM_GUSTS].sort((a, b) => b - a) : gusts;
}

/**
 * The Great Owl (LK7): every OWL_EVERY nights it sweeps one row of lanterns, OWL_AT_MS of dusk
 * left, warned OWL_WARN_MS before, flying across at OWL_SPEED and snuffing every lit lantern on
 * the row it passes unless a moth sits on it.
 */
export const OWL_EVERY = 5;
export const OWL_AT_MS = 20_000;
export const OWL_WARN_MS = 6_000;
export const OWL_SPEED = 300;
/** When the owl comes on night `night`, as dusk left: one sweep every fifth night, else none. */
export const owlsFor = (night: number) => (night % OWL_EVERY === 0 ? [OWL_AT_MS] : []);

/**
 * Windows that call (LK8): from CALLS_NIGHT a cottage window asks for a named lantern to be lit
 * within CALL_MS, for CALL_PAY coins; a call that runs out costs nothing.
 */
export const CALLS_NIGHT = 2;
export const CALL_MS = 8_000;
export const CALL_PAY = 3;
/** When the windows call on night `night`, as dusk left: none on the first night, two after, three from night 6. */
export const callsFor = (night: number) => (night < CALLS_NIGHT ? [] : night < 6 ? [37_000, 23_000] : [37_000, 23_000, 11_000]);

/**
 * The oil cask (LK9): from CASK_NIGHT a refill of a lit lantern draws one fill from the cask,
 * which holds up to CASK_MAX and is topped up between nights at CASK_COST a fill. Lighting a dark
 * lantern is always free.
 */
export const CASK_NIGHT = 3;
export const CASK_START = 3;
export const CASK_MAX = 6;
export const CASK_COST = 3;
/** True once refills draw on the cask. */
export const usesCask = (s: GameState) => s.night >= CASK_NIGHT;
/** The fills the cask holds: more with the harbour's cask boon. */
export const caskMax = (s: GameState) => CASK_MAX + (s.boon === 'cask' ? BOON_CASK : 0);
/**
 * True when a refill can be sent now: before CASK_NIGHT always, after it while the cask holds a
 * fill that no moth (other than `except`) already flying to or refilling a lit lantern has
 * reserved. A moth reserves a fill only as it leaves (`reserved`, set in `dispatch`), so no
 * reservation appears mid-flight; one whose lantern goes dark on the way lights it free and gives
 * its reservation back.
 */
export function caskSpare(s: GameState, except?: Moth) {
  if (!usesCask(s)) return true;
  const reserved = s.moths.filter((m) => m !== except && m.reserved && (m.task === 'out' || m.task === 'lighting') && drawsFill(s, m)).length;
  return s.cask - reserved > 0;
}
/** The oil a fill by moth `m` gives lantern `l`, in milliseconds of burning. */
const mothFill = (s: GameState, m: Moth, l: Lantern) =>
  stats(s).burnMs * MOTH_KINDS[m.kind].oil * LANTERN_KINDS[l.kind].oil * (hasTrait(s, m, 'frugal') ? FRUGAL_OIL : 1);
/**
 * True when a refill by moth `m` of its lantern would draw a fill from the cask: the lantern is lit
 * and the fill adds oil (a guard tap on a full lantern adds none).
 */
function drawsFill(s: GameState, m: Moth) {
  const l = s.lanterns[m.target];
  return !!l?.lit && mothFill(s, m, l) > l.oilMs;
}
/**
 * True when a tap on lantern `i` may go: a dark lantern always, a lit one while the cask has a
 * spare fill (not counting `except`) or while a gust or the owl is coming for it, since a moth
 * sent to shield it is no wasted refill (sent with no spare fill it guards without drawing one).
 * A bat is no reason: a moth on its lantern does not stop it, chasing it does.
 */
export const mayTap = (s: GameState, i: number, except?: Moth) =>
  !flooded(s, i) && (!s.lanterns[i].lit || threatened(s, i) || pilgrimBell(s) === i || caskSpare(s, except));
/** The bell tower a pilgrim needs rung now (LK20), or -1. */
export const pilgrimBell = (s: GameState) => (s.avalanche && !s.avalanche.rung ? s.avalanche.bell : -1);
/** True while the harbour's tide is up over lantern `i`: it is dark and can't be lit. */
export const flooded = (s: GameState, i: number) => !!s.tide?.risen && s.tide.lanterns.includes(i);

/** Districts (LK10): at every MOVE_EVERY nightfalls the keep can move to another district. */
export const MOVE_EVERY = 5;
/** The district the game is in. */
export const districtOf = (s: GameState) => DISTRICTS[s.district];
/** The chains of the district the game is in. */
export const chainsOf = (s: GameState) => districtOf(s).chains;

/**
 * The kinds of night. The first night is always clear; each later night's kind is drawn at the
 * nightfall before it, so the night panel can show what is coming.
 */
export const NIGHT_KINDS = {
  clear: { name: 'clearName', blurb: 'clearBlurb' },
  fog: { name: 'fogName', blurb: 'fogBlurb' },
  feast: { name: 'feastName', blurb: 'feastBlurb' },
  storm: { name: 'stormName', blurb: 'stormBlurb' },
} as const satisfies Record<string, { name: TextKey; blurb: TextKey }>;
export type NightKind = keyof typeof NIGHT_KINDS;
export const NIGHT_KIND_IDS = Object.keys(NIGHT_KINDS) as NightKind[];
/** How much faster oil burns on a foggy night. */
export const FOG_BURN = 1.4;
/** How much faster oil burns in the market. */
export const TRADE_BURN = 1.15;
/** What vespers add to each lantern's pay on Chapel Hill, and the share that must burn there. */
export const VESPERS_PAY = 2;
export const VESPERS_QUOTA = 0.75;
/** What a feast night multiplies the lanterns', all-lit bonus's and chains' pay by. */
export const FEAST_PAY = 2;
/** The extra gusts of a stormy night, as dusk left. */
export const STORM_GUSTS = [28_000, 16_000];
/** Draws the kind of night `night`: clear on the first, any kind (clear too) after. */
export function drawKind(night: number): NightKind {
  if (night === 1) return 'clear';
  // Summer brings storms and autumn fog half the time; the rest are drawn as usual.
  const season = seasonOf(night);
  if ((season === 'summer' || season === 'autumn') && Math.random() < SEASON_KIND) return season === 'summer' ? 'storm' : 'fog';
  return NIGHT_KIND_IDS[Math.floor(Math.random() * NIGHT_KIND_IDS.length)];
}

/** How fast a bat flies, in pixels per second; it flees at BAT_FLEE times that. */
export const BAT_SPEED = 55;
export const BAT_FLEE = 1.6;
/** Where bats come in from the screen's edge, as a height in view pixels. */
export const BAT_Y = 140;
/**
 * When each bat comes, as dusk left in milliseconds: none on the first two nights, one on nights
 * 3 to 5, then two.
 */
export const batsFor = (night: number, restless = 0) =>
  [...(night < 3 ? [] : night < 6 ? [28_000] : [30_000, 16_000]), ...RESTLESS_BATS.slice(0, restless)].sort((a, b) => b - a);

/** What each lantern chain with every lantern lit at nightfall pays. */
export const CHAIN_BONUS = 8;
/** The chains night `s` has every lantern of, by index into the district's chains. */
export const chainsFor = (s: GameState) => chainsOf(s).map((_, i) => i).filter((i) => chainsOf(s)[i].lanterns.every((l) => l < s.lanterns.length));
/** True when every lantern of chain `i` is lit. */
export const chainLit = (s: GameState, i: number) => chainsOf(s)[i].lanterns.every((l) => s.lanterns[l]?.lit);

/** Nights kept to reach the Great Festival, the win; the nights go on after it. */
export const FESTIVAL_NIGHTS = 10;
/** A refill of a lantern with less than this share of its oil left is a close call... */
export const CLOSE_CALL = 0.15;
/** ...and pays this many coins at once. */
export const CLOSE_CALL_PAY = 2;
/** What a close call pays here: double in the market. */
export const closeCallPay = (s: GameState) => CLOSE_CALL_PAY * (districtOf(s).rule === 'trade' ? 2 : 1);
/** What a window call pays here: double in the market. */
export const callPay = (s: GameState) => CALL_PAY * (districtOf(s).rule === 'trade' ? 2 : 1);

/**
 * The herald's order: one bonus goal a night, paid at nightfall. `lit` names lanterns that must be
 * burning at nightfall; `closeCalls` and `shields` count close-call refills and gusts a moth
 * shielded during the dusk.
 */
export type OrderGoal = { kind: 'lit'; lanterns: readonly number[] } | { kind: 'closeCalls' | 'shields'; count: number };
export interface Order {
  /** What the herald asks for, as named in the keep; `orderText` in the scene names another district's lanterns. */
  text: TextKey;
  goal: OrderGoal;
  reward: number;
}
/**
 * The orders, one a night in this order, then round again. Each only names lanterns its night has.
 * The texts name the keep's lanterns; in another district the scene names that district's.
 */
export const ORDERS: readonly Order[] = [
  { text: 'orderTowers', goal: { kind: 'lit', lanterns: [0, 1, 2] }, reward: 15 },
  { text: 'orderWest', goal: { kind: 'lit', lanterns: [0, 3, 5] }, reward: 15 },
  { text: 'orderCloseCalls', goal: { kind: 'closeCalls', count: 2 }, reward: 15 },
  { text: 'orderEast', goal: { kind: 'lit', lanterns: [1, 4, 6] }, reward: 15 },
  { text: 'orderShield', goal: { kind: 'shields', count: 1 }, reward: 15 },
];
export const orderFor = (night: number): Order => ORDERS[(night - 1) % ORDERS.length];

/** How far the night's order has come: `done` of `of`. */
export function orderProgress(s: GameState) {
  const goal = s.order.goal;
  if (goal.kind === 'lit') return { done: goal.lanterns.filter((i) => s.lanterns[i]?.lit).length, of: goal.lanterns.length };
  return { done: Math.min(goal.count, goal.kind === 'closeCalls' ? s.closeCalls : s.shields), of: goal.count };
}

/** Lanterns to light on night `night`: five on the first, one more each night after. */
export const lanternsFor = (night: number) => Math.min(4 + night, LANTERN_SPOTS.length);
/** Lanterns that must be lit at nightfall to keep every hearth: three in five, or three in four on Chapel Hill. */
export const requiredFor = (count: number, district: DistrictId = 'keep') => Math.ceil(count * (DISTRICTS[district].rule === 'vespers' ? VESPERS_QUOTA : 0.6));
/** Lanterns that must be lit tonight: the district's share, plus one for each Watchful lord taken. */
export const required = (s: GameState) => Math.min(s.lanterns.length, requiredFor(s.lanterns.length, s.district) + s.curses.watch);

export interface Lantern {
  x: number;
  y: number;
  /** A plain lantern, or one of the special kinds from night LANTERN_KINDS_NIGHT. */
  kind: LanternKind;
  lit: boolean;
  /** Oil left while lit, in milliseconds of burning. */
  oilMs: number;
  /** The oil it was filled to, so the bar shows how much is left. */
  oilMaxMs: number;
  /** True while a moth is on its way to it or lighting it, so a second tap sends no other moth. */
  claimed: boolean;
  /** Lit or refilled by a gust-proof moth (LK16): the next gust passes it by. */
  sheltered: boolean;
  /** Under an avalanche's snow (LK20): a moth digs DIG_MS before it lights it. */
  buried: boolean;
}

export interface Moth {
  kind: MothKind;
  x: number;
  y: number;
  /**
   * Waiting in the jar, flying out, lighting a wick, guarding the lantern a gust or the owl is
   * coming for (it stays after lighting it until the threat has passed), chasing a bat, flying
   * home, or resting in the jar once tired.
   */
  task: 'idle' | 'out' | 'lighting' | 'guard' | 'chase' | 'home' | 'rest';
  /** The lantern it is flying to or lighting, or -1. */
  target: number;
  /** How long it has been lighting, in milliseconds. */
  lightingMs: number;
  /** True when it found its lit lantern with under CLOSE_CALL of its oil left: a close call. */
  closeCall: boolean;
  /** The bat it is chasing (task `chase`), by id, or -1. */
  bat: number;
  /** More lanterns it lights on this flight before flying home: a firefly's second. */
  hops: number;
  /**
   * True when it left with a cask fill reserved for its refill: the cask had a spare fill and its
   * fill would add oil to its lit lantern then. Settled in `dispatch` and never changed mid-flight.
   */
  reserved: boolean;
  /** Flights out of the jar since it last rested this dusk, and the rest left while tired. */
  flights: number;
  restMs: number;
}

/** A bat flying to a lit lantern to snuff it, or fleeing off the screen. */
export interface Bat {
  id: number;
  x: number;
  y: number;
  /** The lantern it is flying to. */
  target: number;
  task: 'fly' | 'flee';
}

/** A gust on its way: the lantern it will blow out and when, as dusk left in milliseconds. */
export interface Gust {
  target: number;
  atMs: number;
}

/** The Great Owl, warned for a row of lanterns and then sweeping across it. */
export interface Owl {
  /** The row it sweeps, as the lanterns' height, and the lanterns on it. */
  y: number;
  lanterns: number[];
  /** When it comes, as dusk left in milliseconds. */
  atMs: number;
  /** Where it is while sweeping, or null while only warned. */
  x: number | null;
  /** The lanterns it has passed on this sweep. */
  passed: number[];
}

/** A window calling for lantern `lantern` to be lit within `msLeft`. */
export interface Call {
  lantern: number;
  msLeft: number;
}

/** The harbour's tide, warned for its lowest row of lanterns, then up over them for TIDE_MS. */
export interface Tide {
  y: number;
  lanterns: number[];
  /** When it rises, as dusk left; it ebbs TIDE_MS later. */
  atMs: number;
  risen: boolean;
}

/** A ship sailing in to the harbour, asking for lantern `guide` to be lit when it arrives. */
export interface Ship {
  guide: number;
  fromLeft: boolean;
  /** Time left before it arrives. */
  msLeft: number;
}

/** An avalanche on the monastery's low path (LK20), warned for its lowest row, with the bell tower a pilgrim needs rung. */
export interface Avalanche {
  y: number;
  lanterns: number[];
  /** When the snow comes down, as dusk left. */
  atMs: number;
  /** The bell tower to ring for the pilgrim on the path, and whether a moth has rung it. */
  bell: number;
  rung: boolean;
}

/** Something that just happened, for the scene to show; it empties the list every frame. */
export type GameEvent =
  | { type: 'closeCall'; lantern: number; coins: number }
  | { type: 'gust'; lantern: number; shielded: boolean }
  /** A bat reached its lantern: it snuffed it, or a moth sitting on it drove the bat off. */
  | { type: 'bat'; lantern: number; snuffed: boolean }
  /** A moth caught up with a bat, which flees. */
  | { type: 'chased'; x: number; y: number }
  /** The owl passed a lantern on its row: snuffed it, or a moth sitting on it kept it. */
  | { type: 'owl'; lantern: number; shielded: boolean }
  /** A window's call was answered in time (`coins` paid) or ran out. */
  | { type: 'call'; lantern: number; kept: boolean; coins: number }
  /** A moth came to refill a lantern and found the cask dry. */
  | { type: 'dry'; lantern: number }
  /** The harbour's tide rose over a lit lantern and put it out. */
  | { type: 'tide'; lantern: number }
  /** A ship arrived: guided in by its lit lantern (`coins` paid), or turned away. */
  | { type: 'ship'; lantern: number; guided: boolean; coins: number }
  /** Moth `moth` gained a trait from the flights it has flown. */
  | { type: 'trait'; moth: number; trait: TraitId }
  /** An avalanche came down on a lantern of the low path: buried it, or a moth sitting on it kept it. */
  | { type: 'avalanche'; lantern: number; shielded: boolean }
  /** A bell tower was rung in time for a pilgrim (`coins` paid), or the snow came first. */
  | { type: 'pilgrim'; lantern: number; warned: boolean; coins: number };

/** What nightfall counted, shown until the next dusk. */
export interface NightReport {
  lit: number;
  count: number;
  required: number;
  earned: number;
  lostHearth: boolean;
  /** Whether the herald's order was met; its reward is part of `earned`. */
  orderMet: boolean;
  /** Lantern chains with every lantern lit; their bonus is part of `earned`. */
  chains: number;
  /** True on the nightfall that reached the Great Festival. */
  festival: boolean;
}

export interface GameState {
  night: number;
  /**
   * `festival` is the night the Great Festival is reached: its panel shows before the night
   * panel. `move` is a fifth nightfall's choice of district and `peril` the curses offered from
   * PERIL_NIGHT, shown in that order before the night panel too. `boon` is the Harbour
   * Festival's choice of boon, and `daily` the end of a daily night.
   */
  phase: 'dusk' | 'night' | 'festival' | 'move' | 'peril' | 'boon' | 'daily' | 'over';
  /** Dusk left before night falls, in milliseconds. */
  duskMs: number;
  coins: number;
  lives: number;
  lanterns: Lantern[];
  moths: Moth[];
  levels: Record<UpgradeId, number>;
  report: NightReport | null;
  /** Nights the keep met its quota. */
  kept: number;
  /** The most nights kept in any game, saved in the browser. */
  best: number;
  /** Lantern taps kept while every moth was busy, oldest first, at most QUEUE_MAX. */
  queue: number[];
  /** The herald's order for this night. */
  order: Order;
  /** Gusts still to come this dusk, as dusk left when each hits, soonest first. */
  gusts: number[];
  /** The gust being warned about, or null. */
  gust: Gust | null;
  /** Close-call refills and gusts shielded this dusk, for the order. */
  closeCalls: number;
  shields: number;
  /** What happened since the scene last looked; the scene empties it. */
  events: GameEvent[];
  /** This night's kind, and the next night's, drawn at nightfall. */
  kind: NightKind;
  nextKind: NightKind;
  /** Bats still to come this dusk, as dusk left when each comes, soonest first. */
  batTimes: number[];
  /** Bats on the screen. */
  bats: Bat[];
  /** The id the next bat gets. */
  nextBat: number;
  /** Bats chased off this dusk. */
  chased: number;
  /** True once the Great Festival has been reached this game. */
  festival: boolean;
  /** The owl's sweeps still to come this dusk, as dusk left, and the one warned or flying. */
  owls: number[];
  owl: Owl | null;
  /** Window calls still to come this dusk, as dusk left, the one calling now, and those answered this dusk. */
  callTimes: number[];
  call: Call | null;
  callsKept: number;
  /** Fills of oil in the cask, which refills draw on from CASK_NIGHT. */
  cask: number;
  /** The district the keep stands in, and the one it moves to at the next dusk. */
  district: DistrictId;
  nextDistrict: DistrictId;
  /** True from a fifth nightfall until the district for the next night is chosen. */
  moveDue: boolean;
  /** Which jar each moth rests at, by index (0 the gate's, 1 the second jar's); kept from night to night. */
  homes: number[];
  /** Hearths rekindled this game. */
  rekindled: number;
  /** Curses taken, by id, and the two offered at this nightfall (empty when none). */
  curses: Record<CurseId, number>;
  offer: CurseId[];
  /** The curses' multiplier the last nightfall paid at. */
  paidMult: number;
  /** The best pay multiplier reached in any game, saved in the browser. */
  bestPeril: number;
  /** True once the keep has sailed to the harbour (LK15); the harbour's nights kept and its festival. */
  sailed: boolean;
  harbourKept: number;
  harbourFestival: boolean;
  /** The tide's times still to come this dusk and the one warned or up; ships to come, the one sailing in, and those guided this dusk. */
  tideTimes: number[];
  tide: Tide | null;
  shipTimes: number[];
  ship: Ship | null;
  shipsGuided: number;
  /** The Harbour Festival's boon, kept for every later game, or null. */
  boon: BoonId | null;
  /** True when moths grow traits (LK16), with the flights each place in the jar has ever flown. */
  breeds: boolean;
  flown: number[];
  /** True on a daily night (LK17): one seeded dusk, nothing carried in or out. */
  daily: boolean;
  /** How long this dusk lasts (LK19: by the season). */
  duskMax: number;
  /** The village below the keep (LK18), kept from game to game; whether the chapel has spared a hearth this game, and did tonight. */
  village: Village;
  chapelUsed: boolean;
  spared: boolean;
  /** True once the keep has climbed to the monastery (LK20); its nights kept and its festival. */
  climbed: boolean;
  mountainKept: number;
  mountainFestival: boolean;
  /** The avalanches still to come this dusk, the one warned, and the pilgrims warned this dusk. */
  avalancheTimes: number[];
  avalanche: Avalanche | null;
  pilgrimsWarned: number;
}

/** Moth count, flight speed, wick time and burn time with the bought upgrades. */
export function stats(s: GameState) {
  return {
    moths: BASE_MOTHS + s.levels.moths + (hasBuilt(s, 'chandler') ? 1 : 0),
    fireflies: s.levels.firefly,
    speed: BASE_SPEED * (1 + 0.2 * s.levels.wings),
    lightMs: Math.round(BASE_LIGHT_MS * 0.75 ** s.levels.wick),
    burnMs: baseBurnMs() + 6_000 * s.levels.oil,
  };
}

/** How fast moth `m` flies, in pixels per second. */
export const mothSpeed = (s: GameState, m: Moth) =>
  stats(s).speed * MOTH_KINDS[m.kind].speed * (hasTrait(s, m, 'swift') ? SWIFT_SPEED : 1) * (seasonOf(s.night) === 'winter' ? SNOW_SPEED : 1);
/** How long moth `m` takes to catch a wick, in milliseconds: none at all on a candle, DIG_MS more under snow. */
export const mothLightMs = (s: GameState, m: Moth) =>
  Math.round(stats(s).lightMs * MOTH_KINDS[m.kind].wick * LANTERN_KINDS[s.lanterns[m.target]?.kind ?? 'plain'].wick * WET_WICK ** s.curses.wet) +
  (s.lanterns[m.target]?.buried ? DIG_MS : 0);

function makeLanterns(night: number, district: DistrictId): Lantern[] {
  const count = lanternsFor(night);
  const kinds = lanternKindsFor(night, count);
  return DISTRICTS[district].spots.slice(0, count).map(({ x, y }, i) => ({ x, y, kind: kinds[i], lit: false, oilMs: 0, oilMaxMs: 0, claimed: false, sheltered: false, buried: false }));
}

/** The jar moth `i` rests at. */
const homeOf = (s: GameState, i: number) => (s.levels.jar > 0 ? (s.homes[i] ?? 0) : 0);

/** Where moth `i` rests: spaced out on its jar's rim among the moths that share that jar. */
export function restOf(s: GameState, i: number) {
  const jar = homeOf(s, i);
  const mates = s.moths.map((_, k) => k).filter((k) => homeOf(s, k) === jar);
  return mothRest(mates.indexOf(i), mates.length, JARS[jar]);
}

/** The moths with the bought upgrades, `moths` in KIND_ORDER then the fireflies, at rest on their jars. */
function makeMoths(s: GameState) {
  const { moths: n, fireflies } = stats(s);
  s.moths = Array.from({ length: n + fireflies }, (_, i) => ({
    kind: i < n ? KIND_ORDER[i % KIND_ORDER.length] : ('firefly' as const),
    x: 0,
    y: 0,
    task: 'idle' as const,
    target: -1,
    lightingMs: 0,
    closeCall: false,
    bat: -1,
    hops: 0,
    reserved: false,
    flights: 0,
    restMs: 0,
  }));
  s.moths.forEach((m, i) => Object.assign(m, restOf(s, i)));
}

/** What a new game carries in from earlier ones: the moths' flights (LK16), the harbour's boon (LK15) and the village (LK18). */
export interface Carried {
  flown?: readonly number[];
  boon?: BoonId | null;
  village?: Village;
}

/** Gives the game boon `id`: the purse's coins now, the bigger cask filled, or a free Firefly level. */
function applyBoon(s: GameState, id: BoonId) {
  s.boon = id;
  if (id === 'purse') s.coins += BOON_COINS;
  else if (id === 'cask') s.cask = caskMax(s);
  else s.levels.firefly = Math.min(UPGRADES.firefly.costs.length, s.levels.firefly + 1);
}

export function newGame(best = 0, bestPeril = 1, carried: Carried = {}): GameState {
  const s: GameState = {
    night: 1,
    phase: 'dusk',
    duskMs: DUSK_MS,
    coins: 0,
    lives: LIVES,
    lanterns: makeLanterns(1, 'keep'),
    moths: [],
    levels: { wick: 0, oil: 0, moths: 0, wings: 0, firefly: 0, nectar: 0, jar: 0 },
    report: null,
    kept: 0,
    best,
    queue: [],
    order: orderFor(1),
    gusts: gustsFor(1),
    gust: null,
    closeCalls: 0,
    shields: 0,
    events: [],
    kind: 'clear',
    nextKind: 'clear',
    batTimes: batsFor(1),
    bats: [],
    nextBat: 0,
    chased: 0,
    festival: false,
    owls: owlsFor(1),
    owl: null,
    callTimes: callsFor(1),
    call: null,
    callsKept: 0,
    cask: CASK_START,
    district: 'keep',
    nextDistrict: 'keep',
    moveDue: false,
    homes: [],
    rekindled: 0,
    curses: { wet: 0, bats: 0, thin: 0, watch: 0 },
    offer: [],
    paidMult: 1,
    bestPeril,
    sailed: false,
    harbourKept: 0,
    harbourFestival: false,
    tideTimes: [],
    tide: null,
    shipTimes: [],
    ship: null,
    shipsGuided: 0,
    boon: null,
    breeds: true,
    // A place for every moth the jar can hold: the bought ones and the chandler's spare.
    flown: Array.from({ length: BASE_MOTHS + UPGRADES.moths.costs.length + 1 }, (_, i) => Math.max(0, Math.floor(carried.flown?.[i] ?? 0))),
    daily: false,
    duskMax: DUSK_MS,
    village: { houses: carried.village?.houses ?? 0, built: [...(carried.village?.built ?? [])] },
    chapelUsed: false,
    spared: false,
    climbed: false,
    mountainKept: 0,
    mountainFestival: false,
    avalancheTimes: [],
    avalanche: null,
    pilgrimsWarned: 0,
  };
  if (carried.boon) applyBoon(s, carried.boon);
  makeMoths(s);
  return s;
}

/**
 * Today's daily night (LK17) from the day's random source `rand`: a night, a district, a kind and
 * two curses drawn in that order, with DAILY_LEVELS bought, a full cask and no traits or boon.
 */
export function dailyNight(rand: () => number, best = 0, bestPeril = 1): GameState {
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)];
  const s = newGame(best, bestPeril);
  s.daily = true;
  s.breeds = false;
  s.village = { houses: 0, built: [] };
  s.night = pick(DAILY_NIGHTS);
  s.district = s.nextDistrict = pick(MOVE_IDS);
  s.kind = s.nextKind = pick(NIGHT_KIND_IDS);
  const ids = [...CURSE_IDS];
  s.curses[ids.splice(Math.floor(rand() * ids.length), 1)[0]]++;
  s.curses[pick(ids)]++;
  s.levels = { ...DAILY_LEVELS };
  s.cask = CASK_MAX;
  startDusk(s);
  return s;
}

/**
 * Sends moth `moth` to light lantern `i`, or to refill it if it is already lit. A firefly leaving
 * the jar lights FIREFLY_LANTERNS on the flight; `hops` is how many more after this one.
 */
function dispatch(s: GameState, moth: Moth, i: number, hops = moth.kind === 'firefly' ? FIREFLY_LANTERNS - 1 : 0) {
  // Leaving the jar is a flight; a firefly flying on from its first lantern is the same one.
  if (moth.task === 'idle') flew(s, moth);
  moth.task = 'out';
  moth.target = i;
  // Whether it reserves a cask fill is settled now, so no reservation appears mid-flight.
  moth.reserved = caskSpare(s, moth) && drawsFill(s, moth);
  moth.hops = hops;
  s.lanterns[i].claimed = true;
}

/** A firefly's next stop after lighting a lantern: the oldest queued tap, else the nearest dark lantern no moth has, else -1. */
function nextHop(s: GameState, m: Moth) {
  // A queued refill with the cask spoken for is dropped, as the tap would now be refused.
  s.queue = s.queue.filter((i) => mayTap(s, i, m));
  const queued = s.queue.findIndex((i) => !s.lanterns[i].claimed);
  if (queued >= 0) return s.queue.splice(queued, 1)[0];
  let best = -1;
  let bestD = Infinity;
  s.lanterns.forEach((l, i) => {
    const d = Math.hypot(l.x - m.x, l.y - m.y);
    if (!l.lit && !l.claimed && !flooded(s, i) && d < bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

/**
 * Taps lantern `i`. The first idle moth goes to light it, or refill it if it is already lit. When
 * every moth is busy the tap waits in the queue (up to QUEUE_MAX) and a moth takes it when one
 * comes home. False when the tap was lost: another moth already has the lantern, the queue is full,
 * it is not dusk, or it is lit and the cask is dry (unless something is coming for it, see `mayTap`).
 */
export function send(s: GameState, i: number) {
  const lantern = s.lanterns[i];
  if (s.phase !== 'dusk' || !lantern || lantern.claimed || s.queue.includes(i)) return false;
  if (!mayTap(s, i)) return false;
  // An idle firefly goes first, so its second lantern is not wasted.
  const moth = s.moths.find((m) => m.task === 'idle' && m.kind === 'firefly') ?? s.moths.find((m) => m.task === 'idle');
  if (moth) {
    dispatch(s, moth, i);
    return true;
  }
  if (s.queue.length >= QUEUE_MAX) return false;
  s.queue.push(i);
  return true;
}

/**
 * Sends an idle moth to chase bat `id` off. False when there is no such bat still coming, a moth
 * already chases it, or no moth is idle (a chase is never queued).
 */
export function chase(s: GameState, id: number) {
  const bat = s.bats.find((b) => b.id === id && b.task === 'fly');
  if (s.phase !== 'dusk' || !bat || s.moths.some((m) => m.task === 'chase' && m.bat === id)) return false;
  // A plain moth goes before a firefly, which is better kept for lanterns.
  const moth = s.moths.find((m) => m.task === 'idle' && m.kind !== 'firefly') ?? s.moths.find((m) => m.task === 'idle');
  if (!moth) return false;
  moth.task = 'chase';
  moth.bat = id;
  flew(s, moth);
  return true;
}

/**
 * Once the second jar is bought, sends idle moth `i` to rest at the other jar from now on (and on
 * later nights). False when there is no second jar, it is not dusk or the moth is not idle.
 */
export function swapJar(s: GameState, i: number) {
  const moth = s.moths[i];
  if (s.phase !== 'dusk' || s.levels.jar === 0 || moth?.task !== 'idle') return false;
  s.homes[i] = 1 - homeOf(s, i);
  moth.task = 'home';
  return true;
}

/** Moves a moth or bat `step` pixels towards (x, y); true once it is there. */
function flyTo(m: { x: number; y: number }, x: number, y: number, step: number) {
  const dx = x - m.x;
  const dy = y - m.y;
  const d = Math.hypot(dx, dy);
  if (d <= step) {
    m.x = x;
    m.y = y;
    return true;
  }
  m.x += (dx / d) * step;
  m.y += (dy / d) * step;
  return false;
}

/** True when a moth is sitting on lantern `i`: lighting it or guarding it. */
const sitting = (s: GameState, i: number) => s.moths.some((m) => m.target === i && (m.task === 'lighting' || m.task === 'guard'));

/** True while a gust or the owl is coming for lantern `i`, so a moth that lights it stays to guard it. */
export const threatened = (s: GameState, i: number) => s.gust?.target === i || !!s.owl?.lanterns.includes(i) || !!s.avalanche?.lanterns.includes(i);

/** The lantern a gust warned now goes for: the lit one with the most oil left, or -1 if none is lit. */
function gustTarget(s: GameState, except = -1) {
  let best = -1;
  s.lanterns.forEach((l, i) => {
    if (i !== except && l.lit && (best < 0 || l.oilMs > s.lanterns[best].oilMs)) best = i;
  });
  return best;
}

/** The lantern a bat goes for: the lit one with the most oil, or -1 if none is lit. */
const batTarget = (s: GameState) => gustTarget(s);

/** True while bat `bat` is within BELL_RANGE of a lit bell, which holds it still. */
export const stunned = (s: GameState, bat: Bat) => s.lanterns.some((l) => l.kind === 'bell' && l.lit && Math.hypot(l.x - bat.x, l.y - bat.y) <= BELL_RANGE);

/** Bats come in from the edges at their times, fly to a lit lantern and snuff it, unless chased off first. */
function raiders(s: GameState, dt: number) {
  if (s.batTimes.length && s.duskMs <= s.batTimes[0]) {
    s.batTimes.shift();
    const target = batTarget(s);
    // With no lantern lit there is nothing to snuff, and the bat stays away.
    if (target >= 0) {
      const fromLeft = (s.night + s.nextBat) % 2 === 0;
      s.bats.push({ id: s.nextBat++, x: fromLeft ? -24 : VIEW.w + 24, y: BAT_Y, target, task: 'fly' });
    }
  }
  for (const bat of s.bats) {
    if (bat.task === 'flee') {
      bat.x += ((bat.x < VIEW.w / 2 ? -1 : 1) * BAT_SPEED * BAT_FLEE * dt) / 1000;
      bat.y -= (BAT_SPEED * BAT_FLEE * 0.6 * dt) / 1000;
      continue;
    }
    // Its lantern went dark on its way: it turns to another lit one, or leaves.
    if (!s.lanterns[bat.target].lit) {
      const next = batTarget(s);
      if (next < 0) {
        bat.task = 'flee';
        continue;
      }
      bat.target = next;
    }
    // A lit bell nearby holds it where it is.
    if (stunned(s, bat)) continue;
    const lantern = s.lanterns[bat.target];
    if (flyTo(bat, lantern.x, lantern.y - 6, (BAT_SPEED * dt) / 1000)) {
      const snuffed = !sitting(s, bat.target);
      if (snuffed) {
        lantern.lit = false;
        lantern.oilMs = 0;
      }
      s.events.push({ type: 'bat', lantern: bat.target, snuffed });
      bat.task = 'flee';
    }
  }
  s.bats = s.bats.filter((b) => b.x > -60 && b.x < VIEW.w + 60 && b.y > -60);
}

/** Sends a guarding moth home and frees its lantern. */
function release(m: Moth, s: GameState) {
  s.lanterns[m.target].claimed = false;
  m.task = 'home';
  m.target = -1;
}

/** Sends home every guard whose lantern nothing is coming for any more. */
function releaseGuards(s: GameState) {
  for (const m of s.moths) if (m.task === 'guard' && !threatened(s, m.target)) release(m, s);
}

/** Blows out lantern `i` unless a moth sits on it; the gust's event says which. */
function blow(s: GameState, i: number) {
  const lantern = s.lanterns[i];
  // A lantern a gust-proof moth lit shrugs off one gust.
  const sheltered = lantern.lit && lantern.sheltered && !sitting(s, i);
  if (sheltered) lantern.sheltered = false;
  const shielded = sitting(s, i) || sheltered;
  // A lantern that went dark before the gust came, with no moth on it, has nothing to blow out.
  if (!lantern.lit && !shielded) return;
  if (shielded) s.shields++;
  else {
    lantern.lit = false;
    lantern.oilMs = 0;
  }
  s.events.push({ type: 'gust', lantern: i, shielded });
}

/** Warns of the next gust when it is GUST_WARN_MS away, and blows it when it arrives. */
function wind(s: GameState) {
  if (!s.gust && s.gusts.length && s.duskMs <= s.gusts[0] + GUST_WARN_MS) {
    const atMs = s.gusts.shift()!;
    const target = gustTarget(s);
    // With no lantern lit the wind has nothing to blow out, and passes unannounced.
    if (target >= 0) s.gust = { target, atMs };
  }
  if (s.gust && s.duskMs <= s.gust.atMs) {
    const { target } = s.gust;
    blow(s, target);
    // The sea wind at the docks takes the next lantern too.
    if (districtOf(s).rule === 'seawind') {
      const second = gustTarget(s, target);
      if (second >= 0) blow(s, second);
    }
    s.gust = null;
    releaseGuards(s);
  }
}

/** The rows of lanterns: each height and the lanterns at it, top row first. */
function rows(s: GameState) {
  const byY = new Map<number, number[]>();
  s.lanterns.forEach((l, i) => byY.set(l.y, [...(byY.get(l.y) ?? []), i]));
  return [...byY.entries()].sort((a, b) => a[0] - b[0]).map(([y, lanterns]) => ({ y, lanterns }));
}

/** Warns of the owl OWL_WARN_MS before its sweep of the row with the most lit lanterns, then flies it across. */
function greatOwl(s: GameState, dt: number) {
  if (!s.owl && s.owls.length && s.duskMs <= s.owls[0] + OWL_WARN_MS) {
    const atMs = s.owls.shift()!;
    const lit = (r: { lanterns: number[] }) => r.lanterns.filter((i) => s.lanterns[i].lit).length;
    const row = rows(s).reduce((best, r) => (lit(r) > lit(best) || (lit(r) === lit(best) && r.lanterns.length > best.lanterns.length) ? r : best));
    s.owl = { y: row.y, lanterns: row.lanterns, atMs, x: null, passed: [] };
  }
  const owl = s.owl;
  if (!owl) return;
  if (owl.x === null) {
    if (s.duskMs <= owl.atMs) owl.x = -40;
    else return;
  }
  owl.x += (OWL_SPEED * dt) / 1000;
  for (const i of owl.lanterns) {
    if (owl.passed.includes(i) || s.lanterns[i].x > owl.x) continue;
    owl.passed.push(i);
    const lantern = s.lanterns[i];
    const shielded = sitting(s, i);
    // A dark lantern with no moth on it is passed without a word.
    if (!lantern.lit && !shielded) continue;
    if (!shielded) {
      lantern.lit = false;
      lantern.oilMs = 0;
    }
    s.events.push({ type: 'owl', lantern: i, shielded });
  }
  if (owl.x > VIEW.w + 40) {
    s.owl = null;
    releaseGuards(s);
  }
}

/**
 * The lantern a window calls for: a dark one no moth is going to, by the night and the call, else
 * the lit one lowest on oil while the cask has a spare fill to refill it, else -1.
 */
function callTarget(s: GameState) {
  const n = s.lanterns.length;
  const start = (s.night * 3 + s.callsKept + s.callTimes.length) % n;
  for (let k = 0; k < n; k++) {
    const i = (start + k) % n;
    const l = s.lanterns[i];
    if (!l.lit && !l.claimed && !s.queue.includes(i) && !flooded(s, i)) return i;
  }
  // With every fill spoken for, a lit lantern could not be refilled, so no window calls for one.
  if (!caskSpare(s)) return -1;
  let best = -1;
  s.lanterns.forEach((l, i) => {
    if (l.lit && !l.claimed && (best < 0 || l.oilMs < s.lanterns[best].oilMs)) best = i;
  });
  return best;
}

/** A window calls for a lantern at its times; the call runs out after CALL_MS. */
function windows(s: GameState, dt: number) {
  if (!s.call && s.callTimes.length && s.duskMs <= s.callTimes[0]) {
    s.callTimes.shift();
    const lantern = callTarget(s);
    if (lantern >= 0) s.call = { lantern, msLeft: CALL_MS };
  }
  if (!s.call) return;
  s.call.msLeft -= dt;
  if (s.call.msLeft <= 0) {
    s.events.push({ type: 'call', lantern: s.call.lantern, kept: false, coins: 0 });
    s.call = null;
  }
}

/** A moth has just lit (or refilled) lantern `i`: a window calling for it is answered. */
function answerCall(s: GameState, i: number) {
  if (s.call?.lantern !== i) return;
  const coins = callPay(s);
  s.coins += coins;
  s.callsKept++;
  s.events.push({ type: 'call', lantern: i, kept: true, coins });
  s.call = null;
}

/** The harbour's tide: warned TIDE_WARN_MS before for its lowest row, it rises over it and puts its lanterns out, then ebbs after TIDE_MS. */
function tides(s: GameState) {
  if (!s.tide && s.tideTimes.length && s.duskMs <= s.tideTimes[0] + TIDE_WARN_MS) {
    const atMs = s.tideTimes.shift()!;
    const all = rows(s);
    const low = all[all.length - 1];
    if (low) s.tide = { y: low.y, lanterns: low.lanterns, atMs, risen: false };
  }
  const tide = s.tide;
  if (!tide) return;
  if (!tide.risen && s.duskMs <= tide.atMs) {
    tide.risen = true;
    for (const i of tide.lanterns) {
      const l = s.lanterns[i];
      if (l.lit) s.events.push({ type: 'tide', lantern: i });
      l.lit = false;
      l.oilMs = 0;
    }
    // Moths on their way to or sitting on a flooded lantern turn home, and its queued taps are dropped.
    for (const m of s.moths) {
      if (tide.lanterns.includes(m.target) && (m.task === 'out' || m.task === 'lighting' || m.task === 'guard')) {
        m.reserved = false;
        m.closeCall = false;
        release(m, s);
      }
    }
    s.queue = s.queue.filter((i) => !tide.lanterns.includes(i));
  }
  if (tide.risen && s.duskMs <= tide.atMs - TIDE_MS) s.tide = null;
}

/** Ships sail in at their times; one whose guiding lantern is lit when it arrives pays SHIP_PAY. */
function ships(s: GameState, dt: number) {
  if (!s.ship && s.shipTimes.length && s.duskMs <= s.shipTimes[0]) {
    s.shipTimes.shift();
    const guide = SHIP_GUIDES[(SHIP_TIMES.length - s.shipTimes.length - 1) % SHIP_GUIDES.length];
    s.ship = { guide, fromLeft: s.lanterns[guide].x > VIEW.w / 2, msLeft: SHIP_MS };
  }
  const ship = s.ship;
  if (!ship) return;
  ship.msLeft -= dt;
  if (ship.msLeft > 0) return;
  const guided = s.lanterns[ship.guide].lit;
  const coins = guided ? SHIP_PAY : 0;
  s.coins += coins;
  if (guided) s.shipsGuided++;
  s.events.push({ type: 'ship', lantern: ship.guide, guided, coins });
  s.ship = null;
}

/** Where ship `ship` is: sailing from beyond its edge to beside its guiding lantern. */
export function shipX(s: GameState, ship: Ship) {
  const guide = s.lanterns[ship.guide];
  const from = ship.fromLeft ? -70 : VIEW.w + 70;
  const to = guide.x + (ship.fromLeft ? -110 : 110);
  return from + (to - from) * (1 - Math.max(0, ship.msLeft) / SHIP_MS);
}

/**
 * The monastery's avalanches (LK20): warned AVALANCHE_WARN_MS before for its lowest row, with a
 * pilgrim on the path asking for a bell tower to be rung; when the snow comes down, each lantern of
 * the row with no moth on it is buried.
 */
function avalanches(s: GameState) {
  if (!s.avalanche && s.avalancheTimes.length && s.duskMs <= s.avalancheTimes[0] + AVALANCHE_WARN_MS) {
    const atMs = s.avalancheTimes.shift()!;
    const all = rows(s);
    const low = all[all.length - 1];
    const bell = BELL_TOWERS[(AVALANCHE_TIMES.length - s.avalancheTimes.length - 1) % BELL_TOWERS.length];
    if (low) s.avalanche = { y: low.y, lanterns: low.lanterns, atMs, bell, rung: false };
    // A moth already guarding that bell tower (from a gust or the owl) is on it and rings it now.
    if (s.moths.some((m) => m.task === 'guard' && m.target === bell)) ringBell(s, bell);
  }
  const a = s.avalanche;
  if (!a || s.duskMs > a.atMs) return;
  if (!a.rung) s.events.push({ type: 'pilgrim', lantern: a.bell, warned: false, coins: 0 });
  for (const i of a.lanterns) {
    const l = s.lanterns[i];
    const shielded = sitting(s, i);
    s.events.push({ type: 'avalanche', lantern: i, shielded });
    if (shielded) continue;
    l.lit = false;
    l.oilMs = 0;
    l.buried = true;
  }
  s.avalanche = null;
  releaseGuards(s);
}

/** A moth has just finished at lantern `i`: the bell tower a pilgrim needs is rung. */
function ringBell(s: GameState, i: number) {
  const a = s.avalanche;
  if (!a || a.rung || a.bell !== i) return;
  a.rung = true;
  s.coins += PILGRIM_PAY;
  s.pilgrimsWarned++;
  s.events.push({ type: 'pilgrim', lantern: i, warned: true, coins: PILGRIM_PAY });
}

/** Advances dusk by `dt` milliseconds: oil burns, moths fly and light, gusts blow, and night falls at the end. */
export function tick(s: GameState, dt: number) {
  if (s.phase !== 'dusk') return;
  const burn = (s.kind === 'fog' ? FOG_BURN : 1) * (districtOf(s).rule === 'trade' ? TRADE_BURN : 1) * THIN_BURN ** s.curses.thin;
  s.lanterns.forEach((lantern, i) => {
    // A moth refilling a lantern holds its flame, so it burns no oil meanwhile.
    if (!lantern.lit || sitting(s, i)) return;
    lantern.oilMs -= dt * burn;
    if (lantern.oilMs <= 0) {
      lantern.lit = false;
      lantern.oilMs = 0;
    }
  });
  s.moths.forEach((m, i) => {
    const step = (mothSpeed(s, m) * dt) / 1000;
    if (m.task === 'out') {
      const lantern = s.lanterns[m.target];
      if (flyTo(m, lantern.x, lantern.y - 4, step)) {
        m.task = 'lighting';
        m.lightingMs = 0;
        m.closeCall = lantern.lit && lantern.oilMs < lantern.oilMaxMs * CLOSE_CALL;
      }
    } else if (m.task === 'lighting') {
      m.lightingMs += dt;
      if (m.lightingMs >= mothLightMs(s, m)) {
        const lantern = s.lanterns[m.target];
        const fill = mothFill(s, m, lantern);
        // A refill that adds oil draws a fill from the cask: the one it reserved as it left, or, for
        // a moth that left with none (sent only to shield, or its lantern burned down below its
        // fill on the way), only a fill no other moth has reserved. With none it leaves the lantern
        // as it is. One that would add none (a guard tap on a full lantern) never lowers it.
        const adds = !lantern.lit || fill > lantern.oilMs;
        const refill = lantern.lit && adds && usesCask(s);
        if (refill && (s.cask <= 0 || (!m.reserved && !caskSpare(s, m)))) {
          s.events.push({ type: 'dry', lantern: m.target });
          m.closeCall = false;
        } else {
          if (refill) s.cask--;
          // A gust-proof moth's lantern shrugs off the next gust; another moth lighting it afresh doesn't.
          const proof = hasTrait(s, m, 'gustproof');
          if (!lantern.lit) lantern.sheltered = proof;
          else if (proof) lantern.sheltered = true;
          lantern.lit = true;
          lantern.buried = false;
          if (adds) {
            lantern.oilMs = fill;
            lantern.oilMaxMs = fill;
          }
          if (m.closeCall) {
            const coins = closeCallPay(s);
            s.coins += coins;
            s.closeCalls++;
            s.events.push({ type: 'closeCall', lantern: m.target, coins });
            m.closeCall = false;
          }
          answerCall(s, m.target);
        }
        // A bell rung for a pilgrim counts even when the cask was dry.
        ringBell(s, m.target);
        // On the lantern a gust or the owl is coming for, the moth stays to shield it.
        if (threatened(s, m.target)) m.task = 'guard';
        else {
          // A firefly with a lantern still to light flies on to it instead of going home.
          const next = m.hops > 0 ? nextHop(s, m) : -1;
          if (next >= 0) {
            s.lanterns[m.target].claimed = false;
            dispatch(s, m, next, m.hops - 1);
          } else release(m, s);
        }
      }
    } else if (m.task === 'chase') {
      const bat = s.bats.find((b) => b.id === m.bat && b.task === 'fly');
      if (!bat) {
        m.task = 'home';
        m.bat = -1;
      } else if (flyTo(m, bat.x, bat.y, step)) {
        bat.task = 'flee';
        s.chased++;
        s.events.push({ type: 'chased', x: bat.x, y: bat.y });
        m.task = 'home';
        m.bat = -1;
      }
    } else if (m.task === 'home') {
      const rest = restOf(s, i);
      if (flyTo(m, rest.x, rest.y, step)) {
        // From TIRED_NIGHT a moth home from its fourth flight of the dusk rests a while.
        const tired = s.night >= TIRED_NIGHT && m.flights >= TIRED_FLIGHTS && restMs(s) > 0;
        m.task = tired ? 'rest' : 'idle';
        m.restMs = tired ? restMs(s) : 0;
        if (tired) m.flights = 0;
      }
    } else if (m.task === 'rest') {
      m.restMs -= dt;
      if (m.restMs <= 0) {
        m.restMs = 0;
        m.task = 'idle';
      }
    } else if (m.task === 'idle') {
      // A moth moved along the rim when another joins or leaves its jar.
      const rest = restOf(s, i);
      flyTo(m, rest.x, rest.y, step);
    }
  });
  wind(s);
  tides(s);
  greatOwl(s, dt);
  raiders(s, dt);
  windows(s, dt);
  ships(s, dt);
  avalanches(s);
  // A moth that has just come home takes the oldest queued tap.
  for (const moth of s.moths) {
    if (moth.task !== 'idle' || s.queue.length === 0) continue;
    const i = s.queue.shift()!;
    // A queued refill with the cask spoken for is dropped, as the tap would now be refused.
    if (!s.lanterns[i].claimed && mayTap(s, i)) dispatch(s, moth, i);
  }
  s.duskMs = Math.max(0, s.duskMs - dt);
  if (s.duskMs === 0) nightfall(s);
}

/** What lantern `l` pays lit at nightfall, before the feast: its kind's share of PAY_PER_LANTERN, plus vespers on Chapel Hill. */
export const lanternPay = (s: GameState, l: Lantern) => PAY_PER_LANTERN * LANTERN_KINDS[l.kind].pay + (districtOf(s).rule === 'vespers' ? VESPERS_PAY : 0);

function nightfall(s: GameState) {
  const count = s.lanterns.length;
  const litLanterns = s.lanterns.filter((l) => l.lit);
  const lit = litLanterns.length;
  const need = required(s);
  const { done, of } = orderProgress(s);
  const orderMet = done >= of;
  const chains = chainsFor(s).filter((i) => chainLit(s, i)).length;
  const lanternPayTotal = litLanterns.reduce((sum, l) => sum + lanternPay(s, l), 0) + (lit === count ? ALL_LIT_BONUS : 0) + chains * CHAIN_BONUS;
  s.paidMult = perilMult(s);
  const earned = Math.round((lanternPayTotal * (s.kind === 'feast' ? FEAST_PAY : 1) + (orderMet ? s.order.reward : 0)) * perilMult(s));
  const lostHearth = lit < need;
  s.queue = [];
  s.avalanche = null;
  s.avalancheTimes = [];
  s.spared = false;
  s.tide = null;
  s.tideTimes = [];
  s.ship = null;
  s.shipTimes = [];
  s.gust = null;
  s.gusts = [];
  s.batTimes = [];
  s.bats = [];
  s.owl = null;
  s.owls = [];
  s.call = null;
  s.callTimes = [];
  s.coins += earned;
  if (s.daily) {
    // The daily's one dusk ends here: its score is the coins, halved if too few lanterns burn.
    if (lostHearth) s.coins = Math.floor(s.coins / 2);
    s.report = { lit, count, required: need, earned, lostHearth, orderMet, chains, festival: false };
    s.phase = 'daily';
    return;
  }
  // The village's chapel spares the first hearth a game would lose.
  if (lostHearth && hasBuilt(s, 'chapel') && !s.chapelUsed) {
    s.chapelUsed = true;
    s.spared = true;
  } else if (lostHearth) s.lives--;
  else {
    s.kept++;
    s.village.houses++;
    if (s.district === 'harbour') s.harbourKept++;
    if (s.district === 'monastery') s.mountainKept++;
  }
  s.best = Math.max(s.best, s.kept);
  const festival = !s.festival && s.kept >= FESTIVAL_NIGHTS && s.lives > 0;
  if (festival) s.festival = true;
  const harbourFestival = !s.harbourFestival && s.harbourKept >= FESTIVAL_NIGHTS && s.lives > 0;
  if (harbourFestival) s.harbourFestival = true;
  const mountainFestival = !s.mountainFestival && s.mountainKept >= FESTIVAL_NIGHTS && s.lives > 0;
  if (mountainFestival) s.mountainFestival = true;
  s.report = { lit, count, required: need, earned, lostHearth, orderMet, chains, festival: festival || harbourFestival || mountainFestival };
  s.nextKind = drawKind(s.night + 1);
  // Once the keep has sailed or climbed it stays in the harbour or the monastery.
  s.moveDue = s.lives > 0 && s.night % MOVE_EVERY === 0 && !s.sailed && !s.climbed;
  s.offer = s.lives > 0 && s.night + 1 >= PERIL_NIGHT ? drawOffer() : [];
  s.phase = s.lives <= 0 ? 'over' : festival ? 'festival' : harbourFestival || mountainFestival ? 'boon' : afterPanels(s);
}

/** The panel after the festival's: the choice of district if due, then the curses if offered, then the night panel. */
const afterPanels = (s: GameState): GameState['phase'] => (s.moveDue ? 'move' : s.offer.length ? 'peril' : 'night');

/** Leaves the Great Festival's panel for the choice of district or the night panel; the nights go on. */
export function carryOn(s: GameState) {
  if (s.phase !== 'festival') return false;
  s.phase = afterPanels(s);
  return true;
}

/** Sails from the Great Festival to the harbour (LK15), which the keep stands in from the next dusk on. */
export function sail(s: GameState) {
  if (s.phase !== 'festival' || s.sailed || s.climbed) return false;
  s.sailed = true;
  s.nextDistrict = 'harbour';
  s.moveDue = false;
  s.phase = afterPanels(s);
  return true;
}

/** Climbs from the Great Festival to the mountain monastery (LK20), which the keep stands in from the next dusk on. */
export function climb(s: GameState) {
  if (s.phase !== 'festival' || s.sailed || s.climbed) return false;
  s.climbed = true;
  s.nextDistrict = 'monastery';
  s.moveDue = false;
  s.phase = afterPanels(s);
  return true;
}

/** Takes boon `id` at the Harbour Festival: it starts now and in every later game. */
export function takeBoon(s: GameState, id: BoonId) {
  if (s.phase !== 'boon') return false;
  applyBoon(s, id);
  s.phase = afterPanels(s);
  return true;
}

/** Takes curse `id` from this nightfall's offer: it lasts the rest of the game and raises the pay. */
export function takeCurse(s: GameState, id: CurseId) {
  if (s.phase !== 'peril' || !s.offer.includes(id)) return false;
  s.curses[id]++;
  s.offer = s.offer.filter((c) => c !== id);
  s.bestPeril = Math.max(s.bestPeril, perilMult(s));
  if (!s.offer.length) s.phase = 'night';
  return true;
}

/** Leaves the curses not taken and goes on to the night panel. */
export function endPeril(s: GameState) {
  if (s.phase !== 'peril') return false;
  s.offer = [];
  s.phase = 'night';
  return true;
}

/** Picks the district the keep stands in from the next dusk, at a fifth nightfall's choice. */
export function moveTo(s: GameState, district: DistrictId) {
  if (s.phase !== 'move') return false;
  s.nextDistrict = district;
  s.moveDue = false;
  s.phase = afterPanels(s);
  return true;
}

/** The cost of the next level of `id`, or null when it is maxed out. */
export const nextCost = (s: GameState, id: UpgradeId) => UPGRADES[id].costs[s.levels[id]] ?? null;

/** Buys the next level of an upgrade between nights; false if it is maxed or too dear. */
export function buy(s: GameState, id: UpgradeId) {
  const cost = nextCost(s, id);
  if (s.phase !== 'night' || cost === null || s.coins < cost) return false;
  s.coins -= cost;
  s.levels[id]++;
  // The second jar takes every other moth to start with; a tap on an idle moth on its jar swaps it.
  if (id === 'jar') s.homes = s.moths.map((_, i) => i % 2);
  return true;
}

/** Rekindles a hearth that went out, between nights, for hearthCost; false when none is out, too dear or spent. */
export function rekindle(s: GameState) {
  const cost = hearthCost(s);
  if (s.phase !== 'night' || cost === null || s.coins < cost) return false;
  s.coins -= cost;
  s.lives++;
  s.rekindled++;
  return true;
}

/** What a fill of the cask costs: less with the village's smithy. */
export const caskCost = (s: GameState) => (hasBuilt(s, 'smithy') ? SMITHY_CASK_COST : CASK_COST);

/** Puts one fill of oil in the cask between nights, for caskCost; false when it is full or the coins are short. */
export function topUp(s: GameState) {
  if (s.phase !== 'night' || s.cask >= caskMax(s) || s.coins < caskCost(s)) return false;
  s.coins -= caskCost(s);
  s.cask++;
  return true;
}

/** The cost of building `id` in the village now, or null when it is built or the village is too small for it. */
export const buildCost = (s: GameState, id: BuildingId) => (hasBuilt(s, id) || s.village.houses < BUILDINGS[id].houses ? null : BUILDINGS[id].cost);

/** Builds `id` in the village between nights (LK18): it lasts for every later game. False when it is built, the village is too small or the coins are short. */
export function build(s: GameState, id: BuildingId) {
  const cost = buildCost(s, id);
  if (s.phase !== 'night' || s.daily || cost === null || s.coins < cost) return false;
  s.coins -= cost;
  s.village.built.push(id);
  return true;
}

/** Starts the next night's dusk, with one more lantern and every moth back in the jar. */
export function nextDusk(s: GameState) {
  if (s.phase !== 'night') return false;
  s.night++;
  s.district = s.nextDistrict;
  s.kind = s.nextKind;
  startDusk(s);
  return true;
}

/**
 * Warned event times (dusk left, latest first) moved earlier where a short dusk would start inside
 * their warning: each comes at least `warnMs` + 1 s before the dusk's start and after the one before
 * it, so a summer dusk keeps every gust, still warned. A dusk long enough for them leaves them as they are.
 */
function fitTimes(times: number[], warnMs: number, duskMax: number) {
  let latest = duskMax - warnMs - 1_000;
  return times.map((at) => {
    const fitted = Math.min(at, latest);
    latest = fitted - warnMs - 1_000;
    return fitted;
  });
}

/** Sets up a dusk of night `s.night` in `s.district`, of kind `s.kind`. */
function startDusk(s: GameState) {
  s.phase = 'dusk';
  s.duskMax = duskFor(s.night);
  s.duskMs = s.duskMax;
  s.lanterns = makeLanterns(s.night, s.district);
  makeMoths(s);
  s.queue = [];
  s.report = null;
  s.order = orderFor(s.night);
  s.gusts = fitTimes(gustsFor(s.night, s.kind), GUST_WARN_MS, s.duskMax);
  s.batTimes = batsFor(s.night, s.curses.bats);
  s.bats = [];
  s.chased = 0;
  s.gust = null;
  s.closeCalls = 0;
  s.shields = 0;
  s.owls = owlsFor(s.night);
  s.owl = null;
  s.callTimes = callsFor(s.night);
  s.call = null;
  s.callsKept = 0;
  const tide = districtOf(s).rule === 'tide';
  s.tideTimes = tide ? fitTimes(TIDE_TIMES, TIDE_WARN_MS, s.duskMax) : [];
  s.tide = null;
  s.shipTimes = tide ? [...SHIP_TIMES] : [];
  s.ship = null;
  s.shipsGuided = 0;
  const snow = districtOf(s).rule === 'avalanche';
  s.avalancheTimes = snow ? fitTimes(AVALANCHE_TIMES, AVALANCHE_WARN_MS, s.duskMax) : [];
  s.avalanche = null;
  s.pilgrimsWarned = 0;
}
