import { byDifficulty } from '../../../../shared/settings';
import type { TextKey } from '../i18n';
// The rules and numbers of the game, kept apart from drawing so they are easy to tune. Names and
// texts are keys of `i18n/en.ts`, shown with `t`.

/** The battlefield, in game pixels: a portrait screen with the hero at the bottom. */
export const VIEW = { w: 540, h: 960 };
/** The top bar with the wave, kills and the hero's stats. */
export const HUD_HEIGHT = 56;
/** Where the hero stands, and how far left and right they can move. */
export const HERO = { y: 880, minX: 40, maxX: 500, speed: 300 };
/** An enemy that gets this close to the hero's line has reached the hero: game over. */
export const REACH_Y = HERO.y - 28;
/** Where enemies and pickups come in, from under the top bar. */
export const SPAWN_Y = HUD_HEIGHT - 40;
/** How far in from the screen's sides enemies and pickups come in. */
export const SPAWN_MARGIN = 40;
export const BULLET = { speed: 720, radius: 4 };

/**
 * Where the hero and their companions stand, as offsets from the hero: up to three rows of three,
 * the hero in the middle of the front row. Each row is shifted a third of a step from the last, so
 * all nine rifles are in different columns and every one of them has a clear line of fire.
 * Companions fill the slots after the hero's in order: the front row first, then the rows behind.
 */
export const SQUAD_SLOTS: { dx: number; dy: number }[] = [
  { dx: 0, dy: 0 }, { dx: -60, dy: 0 }, { dx: 60, dy: 0 },
  { dx: 20, dy: 24 }, { dx: -40, dy: 24 }, { dx: 80, dy: 24 },
  { dx: -20, dy: 48 }, { dx: 40, dy: 48 }, { dx: -80, dy: 48 },
];
/** The most companions the hero can have: the slots left once the hero has theirs. */
export const MAX_COMPANIONS = SQUAD_SLOTS.length - 1;
/** The pause between one wave being cleared and the next coming in, in ms. */
export const BREAK_MS = 2500;

export type EnemyKind = 'grunt' | 'runner' | 'brute' | 'boss' | 'spitter' | 'riot' | 'crawler' | 'brood' | 'bloater';

/**
 * Hit points at wave 1, walking speed and how fast they veer into the middle of their lane, where
 * they go for its stretch of sandbags (pixels per second), and the size of their hit circle.
 */
export const ENEMIES: Record<EnemyKind, { hp: number; speed: number; steer: number; radius: number }> = {
  grunt: { hp: 3, speed: 46, steer: 22, radius: 13 },
  runner: { hp: 1, speed: 80, steer: 36, radius: 10 },
  brute: { hp: 9, speed: 26, steer: 14, radius: 20 },
  boss: { hp: 200, speed: 18, steer: 10, radius: 38 },
  spitter: { hp: 4, speed: 34, steer: 12, radius: 13 },
  riot: { hp: 6, speed: 30, steer: 16, radius: 15 },
  crawler: { hp: 1, speed: 54, steer: 30, radius: 8 },
  brood: { hp: 170, speed: 16, steer: 10, radius: 36 },
  bloater: { hp: 240, speed: 14, steer: 8, radius: 40 },
};

/** Scrap banked for each kill, kept between runs to buy a head start (see `KIT_COSTS`). */
export const SCRAP: Record<EnemyKind, number> = { grunt: 1, runner: 1, brute: 3, boss: 25, spitter: 2, riot: 3, crawler: 1, brood: 25, bloater: 25 };

/**
 * Spitters walk down to `standY` and stay there, lobbing a glob of acid at the squad's line every
 * `everyMs`. The glob's landing spot is marked `warnMs` before it lands; the puddle burns for
 * `poolMs`. While the hero stands in acid, the squad fires `ACID_SLOW` times slower.
 */
export const SPITTER = { standY: 430, firstMs: 1500, everyMs: 4200, warnMs: 1100, poolMs: 3000, poolRadius: 30 };
export const ACID_SLOW = 2;

/**
 * A riot zombie holds a shield in front of it. A bullet without pierce only chips the shield; a
 * piercing bullet, a drum blast or a flame goes past it. The shield breaks after `riotShield(wave)`
 * points of chipping, so a squad without pierce can still get through it in the end.
 */
export const riotShield = (wave: number) => 8 + 2 * wave;

/** Crawlers come in swarms of `size` from wave `fromWave`, one swarm more every third wave. */
export const SWARM = { size: 6, fromWave: 4 };
export const swarmCount = (wave: number) => (wave >= SWARM.fromWave ? 1 + Math.floor((wave - SWARM.fromWave) / 3) : 0);

/**
 * What a boss does. It walks down like before, but every `everyMs` (the first after `firstMs`) it
 * winds up a move, shown for `warnMs` before it happens:
 * - charge: lunges across the lanes to where the hero stood, `chargeDrop` px further down, over `chargeMs`;
 * - spit: a big acid pool on the hero's line, `spitRadius` wide, burning for `poolMs`;
 * - call: a pack of `pack` runners comes out round it.
 */
export type BossMove = 'charge' | 'spit' | 'call';
export const BOSS_MOVES: BossMove[] = ['charge', 'spit', 'call'];
export const BOSS = { firstMs: 7000, everyMs: 5500, warnMs: 1300, chargeMs: 550, chargeDrop: 55, spitRadius: 64, poolMs: 4500, pack: 5 };

/**
 * The three bosses take turns on the boss waves: the Behemoth (wave 5, 20, 35...), then the Brood
 * Mother (wave 10, 25...), then the Bloater (wave 15, 30...). Each has its own round of moves:
 * - the Behemoth charges, spits and calls a pack of runners;
 * - the Brood Mother calls a brood of `BROOD.pack` crawlers instead of runners, and bursts into
 *   `BROOD.burst` more when it falls;
 * - the Bloater's spit is `BLOATER.spitRadius` wide, and when it falls it leaves a huge acid pool
 *   (`BLOATER.poolRadius`, for `BLOATER.poolMs`) on the squad's line.
 */
export type BossKind = 'boss' | 'brood' | 'bloater';
export const BOSS_KINDS: BossKind[] = ['boss', 'brood', 'bloater'];
export const BOSSES: Record<BossKind, { name: TextKey; moves: BossMove[] }> = {
  boss: { name: 'bossBehemoth', moves: BOSS_MOVES },
  brood: { name: 'bossBrood', moves: ['charge', 'call', 'call'] },
  bloater: { name: 'bossBloater', moves: ['spit', 'charge', 'spit'] },
};
export const isBoss = (kind: EnemyKind): kind is BossKind => kind in BOSSES;
/** Which boss ends a boss wave: wave 5's is the Behemoth, and they take turns from there. */
export const bossKind = (wave: number): BossKind => BOSS_KINDS[(Math.floor(wave / 5) - 1) % BOSS_KINDS.length];
export const BROOD = { pack: 8, burst: 10 };
export const BLOATER = { spitRadius: 96, poolRadius: 150, poolMs: 7000 };
/** The boss's `n`th move from its own round, started one further along per boss wave: the Behemoth opens with a charge, the Brood Mother with its call. */
export const bossMove = (wave: number, n: number) => {
  const moves = BOSSES[bossKind(wave)].moves;
  return moves[(Math.floor(wave / 5) - 1 + n) % moves.length];
};

export type UpgradeKind = 'rate' | 'damage' | 'companion' | 'pierce';

/** What each pickup does, with the name shown on its crate. */
export const UPGRADES: Record<UpgradeKind, { label: TextKey }> = {
  rate: { label: 'upgradeRate' },
  damage: { label: 'upgradeDamage' },
  companion: { label: 'upgradeCompanion' },
  pierce: { label: 'upgradePierce' },
};
export const UPGRADE_KINDS = Object.keys(UPGRADES) as UpgradeKind[];

/**
 * Upgrade evolutions: the third crate of one kind (starting crates count) turns its stat into a perk
 * for the rest of the run.
 * - fire rounds (fire rate): every bullet hit sets the zombie burning for `FIRE_ROUNDS.ms`, taking
 *   `FIRE_ROUNDS.damage(wave)` every `tickMs`, past any riot shield;
 * - headshots (damage): every `HEADSHOT.every`th bullet hit on a zombie lands `HEADSHOT.mult` times
 *   the damage;
 * - ricochets (pierce): a bullet that has spent its hits on a zombie jumps once to the nearest other
 *   zombie within `RICOCHET.range` px, with one more hit in it.
 * The companion crate has no perk: once the squad is full, it already brings damage instead.
 */
export type Perk = 'fire' | 'headshot' | 'ricochet';
export const PERKS: Record<Perk, { upgrade: UpgradeKind; label: TextKey; detail: TextKey }> = {
  fire: { upgrade: 'rate', label: 'perkFire', detail: 'perkFireDetail' },
  headshot: { upgrade: 'damage', label: 'perkHeadshot', detail: 'perkHeadshotDetail' },
  ricochet: { upgrade: 'pierce', label: 'perkRicochet', detail: 'perkRicochetDetail' },
};
export const PERK_KINDS = Object.keys(PERKS) as Perk[];
export const PERK_AT = 3;
/** The perks a run has earned, from how many crates of each kind it collected. */
export const perksOf = (collected: Record<UpgradeKind, number>) => PERK_KINDS.filter((p) => collected[PERKS[p].upgrade] >= PERK_AT);
export const FIRE_ROUNDS = { ms: 2400, tickMs: 400, damage: (wave: number) => Math.max(1, Math.round(waveToughness(wave) * 0.6)) };
export const HEADSHOT = { every: 4, mult: 3 };
export const RICOCHET = { range: 150 };

/**
 * Survivors: from wave `fromWave`, one walks down the road each wave among the zombies, keeping to
 * the nearest seam between two lanes, out of the horde's columns. Bullets hurt them (they have
 * `hp(wave)` hit points), so the player keeps the squad's rifles off that seam; one who reaches the
 * sandbags joins the squad as a companion, or, once the squad is full, hands over `scrap` scrap. Zombies leave them alone; it is the squad's fire they must survive.
 */
export const SURVIVOR = { fromWave: 3, speed: 44, steer: 30, radius: 12, hp: (wave: number) => 4 + wave, scrap: 15 };

/**
 * Wave conditions: from wave `fromWave` each wave draws one of these (or none).
 * - blackout: zombies and survivors can only be seen within `blackoutRadius` px of the hero;
 * - bloodmoon: runners move `bloodMoonRunner` times as fast;
 * - shortage: the squad fires `shortageFire` times slower, and `shortageDrums` more fuel drums roll down;
 * - fog (never drawn, only the Fogbank town has it): zombies and survivors can only be seen below
 *   `fogY`, the lower part of the road.
 */
export type Condition = 'clear' | 'blackout' | 'bloodmoon' | 'shortage' | 'fog';
/** The name and effect of each condition but the clear one, which has nothing to show. */
export const CONDITIONS: Record<Exclude<Condition, 'clear'>, { label: TextKey; detail: TextKey }> = {
  blackout: { label: 'conditionBlackout', detail: 'conditionBlackoutDetail' },
  bloodmoon: { label: 'conditionBloodmoon', detail: 'conditionBloodmoonDetail' },
  shortage: { label: 'conditionShortage', detail: 'conditionShortageDetail' },
  fog: { label: 'conditionFog', detail: 'conditionFogDetail' },
};
export const CONDITION = { fromWave: 6, blackoutRadius: 250, bloodMoonRunner: 1.5, shortageFire: 1.4, shortageDrums: 2, fogY: 420 };
const CONDITION_DRAWS: Condition[] = ['clear', 'blackout', 'bloodmoon', 'shortage'];
/** The wave's condition: none before `CONDITION.fromWave`, then one draw among the four (one of them clear). */
export function drawCondition(wave: number, rand: () => number = Math.random, from: number = CONDITION.fromWave): Condition {
  return wave < from ? 'clear' : CONDITION_DRAWS[Math.floor(rand() * CONDITION_DRAWS.length)];
}

/**
 * Extraction, the run's ending: from wave `fromWave`, every boss's supply drop also offers to
 * extract, which ends the run as a win and banks this run's scrap `bonus(wave)` times over (twice at
 * wave 20, half as much again for each boss wave passed up: 2.5x at wave 25, 3x at wave 30).
 */
export const EXTRACT = { fromWave: 20, bonus: (wave: number) => 2 + Math.max(0, wave - 20) / 10 };
export const canExtract = (wave: number) => isBossWave(wave) && wave >= EXTRACT.fromWave;

/** What a crate can hold: an upgrade, or (from wave 2, now and then) a sandbag wall to place. */
export type CrateKind = UpgradeKind | 'sandbag';
export const CRATES: Record<CrateKind, { label: TextKey }> = { ...UPGRADES, sandbag: { label: 'crateSandbag' } };
export const CRATE_KINDS = Object.keys(CRATES) as CrateKind[];
/** The chance a wave from wave 2 on also drops a sandbag crate. */
export const SANDBAG_CRATE_ODDS = 0.5;

/**
 * Sandbag walls. Placed across one of the road's three lanes at `y`, a wall stops the zombies in
 * that lane for `ms`. A boss smashes straight through it.
 */
export const LANES = [{ x0: 57, x1: 180 }, { x0: 180, x1: 360 }, { x0: 360, x1: 483 }];
export const WALL = { y: 690, ms: 6000 };
export function laneAt(x: number) {
  const i = LANES.findIndex((l) => x < l.x1);
  return i < 0 ? LANES.length - 1 : i;
}
/** The middle of a lane, where the zombies in it walk. */
export const laneMid = (lane: number) => (LANES[lane].x0 + LANES[lane].x1) / 2;
/** The seam between two lanes nearest x, where survivors walk. */
export function seamAt(x: number) {
  const seams = LANES.slice(1).map((l) => l.x0);
  return seams.reduce((a, b) => (Math.abs(b - x) < Math.abs(a - x) ? b : a));
}

/**
 * The supply drop after each boss: a pick of three of these.
 * - shotgun: two more bullets fan out from the soldier's rifle every volley (`SHOTGUN.angle` apart);
 * - flamer: `FLAMER.charges` flame bursts, each set off on its own when a zombie gets within
 *   `FLAMER.trigger` px of the sandbags, burning every zombie within `FLAMER.reach` px of them;
 * - medkit: the next zombie to reach the sandbags doesn't end the run: the squad patches up and
 *   throws everything near the line `MEDKIT.push` px back;
 * - sandbags: two sandbag walls.
 */
export type SupplyKind = 'shotgun' | 'flamer' | 'medkit' | 'sandbags';
export const SUPPLIES: Record<SupplyKind, { label: TextKey; detail: TextKey }> = {
  shotgun: { label: 'supplyShotgun', detail: 'supplyShotgunDetail' },
  flamer: { label: 'supplyFlamer', detail: 'supplyFlamerDetail' },
  medkit: { label: 'supplyMedkit', detail: 'supplyMedkitDetail' },
  sandbags: { label: 'supplySandbags', detail: 'supplySandbagsDetail' },
};
export const SUPPLY_KINDS = Object.keys(SUPPLIES) as SupplyKind[];
export const SHOTGUN = { angle: 0.2, maxPairs: 3 };
export const FLAMER = { charges: 2, trigger: 70, reach: 170, damage: (wave: number) => 20 + 8 * wave, cooldownMs: 800 };
export const MEDKIT = { push: 200, reach: 120 };

/** Three different supplies to pick from, drawn from `SUPPLY_KINDS`; no shotgun once it has `SHOTGUN.maxPairs`. */
export function supplyPick(shotgunMaxed = false, rand: () => number = Math.random): SupplyKind[] {
  const pool = SUPPLY_KINDS.filter((k) => !(shotgunMaxed && k === 'shotgun'));
  if (pool.length > 3) pool.splice(Math.floor(rand() * pool.length), 1);
  return pool;
}

/** What each starting crate costs in scrap, bought on the game over screen for the next run. */
export const KIT_COSTS: Record<UpgradeKind, number> = { rate: 40, damage: 60, companion: 80, pierce: 100 };
/**
 * Outpost upgrades: lasting upgrades bought with scrap on the game over screen, each up to
 * `OUTPOST_MAX` levels, every level costing more than the last. They are never spent and never
 * refunded; a fresh save starts with every one at 0.
 * - barricade: start each run with a sandbag wall per level;
 * - medic: start each run with a medkit per level;
 * - depot: one more fuel drum rolls down every wave, per level;
 * - veteran: start each run with a companion (a Gunner) per level.
 */
export type OutpostKind = 'barricade' | 'medic' | 'depot' | 'veteran';
export const OUTPOST: Record<OutpostKind, { label: TextKey; detail: TextKey; costs: number[] }> = {
  barricade: { label: 'outpostBarricade', detail: 'outpostBarricadeDetail', costs: [60, 120, 200] },
  medic: { label: 'outpostMedic', detail: 'outpostMedicDetail', costs: [100, 180, 280] },
  depot: { label: 'outpostDepot', detail: 'outpostDepotDetail', costs: [80, 150, 240] },
  veteran: { label: 'outpostVeteran', detail: 'outpostVeteranDetail', costs: [120, 220, 340] },
};
export const OUTPOST_KINDS = Object.keys(OUTPOST) as OutpostKind[];
export const OUTPOST_MAX = 3;
export type Outpost = Record<OutpostKind, number>;
export const NO_OUTPOST: Outpost = { barricade: 0, medic: 0, depot: 0, veteran: 0 };
/** What the next level of an outpost upgrade costs, or null once it is at `OUTPOST_MAX`. */
export const outpostCost = (kind: OutpostKind, level: number) => (level < OUTPOST_MAX ? OUTPOST[kind].costs[level] : null);

/**
 * Squad roles: a survivor who joins the squad picks one (the player chooses on a card). Companions
 * from crates, starting crates and the Veteran are Gunners.
 * - gunner: one bullet every volley, like the soldier;
 * - grenadier: one bullet every volley, and every `GRENADE.every`th volley a grenade instead, which
 *   bursts on the first zombie it hits and hurts every zombie within `GRENADE.radius`, past shields;
 * - marksman: one slow shot every `MARKSMAN.every` volleys at the toughest zombie on the road,
 *   doing `MARKSMAN.mult` times the damage and going through `MARKSMAN.pierce` more zombies (and
 *   any shield).
 */
export type Role = 'gunner' | 'grenadier' | 'marksman';
export const ROLES: Record<Role, { label: TextKey; detail: TextKey }> = {
  gunner: { label: 'roleGunner', detail: 'roleGunnerDetail' },
  grenadier: { label: 'roleGrenadier', detail: 'roleGrenadierDetail' },
  marksman: { label: 'roleMarksman', detail: 'roleMarksmanDetail' },
};
export const ROLE_KINDS = Object.keys(ROLES) as Role[];
export const GRENADE = { every: 4, radius: 46, damage: (wave: number) => Math.round(2 + 1.5 * wave) };
export const MARKSMAN = { every: 3, mult: 3, pierce: 2 };

/**
 * Operations: the game over screen picks what the next run is. The Open Road is the endless run
 * with extraction; an operation is `waves` waves long under a fixed rule set, won by clearing its
 * last wave (paying the run's scrap `OPERATION_BONUS` times over). Each operation keeps its own
 * best (the most waves cleared) and the medal that earns.
 *
 * The operations are towns down the road (`TOWNS`, the road map): Hospital is open from the start,
 * and winning a town opens the next one, paying its `bounty` in scrap the first time. The last is
 * the evacuation. The daily stand is a 10-wave run of its own, seeded by the day (see `DAILY`).
 * - survivors: how many walk down each wave, from wave `survivorsFrom`;
 * - drums: whether fuel drums roll down at all;
 * - condition: the condition every wave has (null: drawn as usual from `conditionFrom`, wave 6);
 * - lanes: the lanes the horde comes down (every lane when left out): the rest are blocked by a wreck;
 * - bounty: the scrap the first win pays on top;
 * - escort: a bus rolls up the middle lane every wave and has to reach the far end (see `BUS`);
 * - after: the town whose win opens this one, for a town off the main road (the escort route).
 */
export type OperationKind = 'road' | 'hospital' | 'lightsout' | 'fogbank' | 'bridges' | 'evac' | 'depot' | 'convoy' | 'daily';
export interface Operation {
  label: TextKey;
  detail: TextKey;
  waves: number | null;
  survivors: number;
  survivorsFrom: number;
  drums: boolean;
  condition: Condition | null;
  conditionFrom?: number;
  lanes?: number[];
  bounty?: number;
  escort?: boolean;
  after?: OperationKind;
}
export const OPERATIONS: Record<OperationKind, Operation> = {
  road: { label: 'opRoad', detail: 'opRoadDetail', waves: null, survivors: 1, survivorsFrom: SURVIVOR.fromWave, drums: true, condition: null },
  hospital: { label: 'opHospital', detail: 'opHospitalDetail', waves: 10, survivors: 2, survivorsFrom: 1, drums: false, condition: null, bounty: 60 },
  lightsout: { label: 'opLightsout', detail: 'opLightsoutDetail', waves: 10, survivors: 1, survivorsFrom: SURVIVOR.fromWave, drums: true, condition: 'blackout', bounty: 90 },
  fogbank: { label: 'opFogbank', detail: 'opFogbankDetail', waves: 10, survivors: 1, survivorsFrom: SURVIVOR.fromWave, drums: true, condition: 'fog', bounty: 120 },
  bridges: { label: 'opBridges', detail: 'opBridgesDetail', waves: 10, survivors: 1, survivorsFrom: SURVIVOR.fromWave, drums: true, condition: null, lanes: [0, 2], bounty: 160 },
  evac: { label: 'opEvac', detail: 'opEvacDetail', waves: 10, survivors: 2, survivorsFrom: 2, drums: true, condition: null, conditionFrom: 1, bounty: 250 },
  depot: { label: 'opDepot', detail: 'opDepotDetail', waves: 10, survivors: 1, survivorsFrom: SURVIVOR.fromWave, drums: true, condition: null, escort: true, after: 'hospital', bounty: 140 },
  convoy: { label: 'opConvoy', detail: 'opConvoyDetail', waves: 10, survivors: 1, survivorsFrom: SURVIVOR.fromWave, drums: true, condition: null, conditionFrom: 1, escort: true, after: 'depot', bounty: 220 },
  daily: { label: 'opDaily', detail: 'opDailyDetail', waves: 10, survivors: 1, survivorsFrom: SURVIVOR.fromWave, drums: true, condition: null },
};
export const OPERATION_KINDS = Object.keys(OPERATIONS) as OperationKind[];
export const OPERATION_BONUS = 2;
/** The road map: the towns in the order they open, ending in the evacuation. */
export const TOWNS: OperationKind[] = ['hospital', 'lightsout', 'fogbank', 'bridges', 'evac'];
/** The escort route, a branch off the road map opened by the Hospital: a bus to bring through every wave. */
export const ESCORTS: OperationKind[] = ['depot', 'convoy'];
export const isTown = (kind: OperationKind) => TOWNS.includes(kind) || ESCORTS.includes(kind);
/**
 * Whether a town on the road map can be picked: the first always, the others once the town before
 * them (or the one named by `after`) is won, or once they have been played, so a save from before
 * the road map keeps them.
 */
export function townOpen(kind: OperationKind, bests: Record<OperationKind, number>) {
  const after = OPERATIONS[kind].after;
  if (after) return bests[after] >= (OPERATIONS[after].waves ?? 0) || bests[kind] > 0;
  const i = TOWNS.indexOf(kind);
  if (i < 0) return true;
  const prev = TOWNS[i - 1];
  return i === 0 || bests[prev] >= (OPERATIONS[prev].waves ?? 0) || bests[kind] > 0;
}
/** The towns a win opens: the next one down the main road and any escort town that branches off it. */
export function nextTowns(kind: OperationKind): OperationKind[] {
  const main = TOWNS.includes(kind) ? TOWNS[TOWNS.indexOf(kind) + 1] : undefined;
  return [...(main ? [main] : []), ...ESCORTS.filter((k) => OPERATIONS[k].after === kind)];
}
/** The town the next run goes to after a win: the next one on its own road (null after the last). */
export const nextTown = (kind: OperationKind) => {
  const road = ESCORTS.includes(kind) ? ESCORTS : TOWNS;
  return isTown(kind) ? (road[road.indexOf(kind) + 1] ?? null) : null;
};

/**
 * The escort towns' bus: it starts at `startY` in the middle lane each wave and drives up at
 * `speed` to `endY`, the far end, where it gets through and pays `scrap`. A zombie that touches it
 * holds it still and bites `bite` hit points a second (a brute twice that, a boss `bossBite`), and
 * zombies within `lure` px above it go for it instead of their lane's sandbags. The wave isn't
 * cleared until the bus is through; if its `hp` runs out the run is lost.
 */
export const BUS = { w: 56, h: 116, startY: REACH_Y - 76, endY: HUD_HEIGHT + 90, speed: 30, hp: 100, bite: 8, bossBite: 30, lure: 170, scrap: 25 };
export const busBite = (kind: EnemyKind) => (isBoss(kind) ? BUS.bossBite : kind === 'brute' ? BUS.bite * 2 : BUS.bite);

/**
 * Where a zombie planned at x comes in when only `lanes` are open: a blocked lane's zombie moves
 * across to the nearest open lane, keeping its place in that lane. No draws.
 */
export function openLaneX(x: number, lanes: number[] | undefined) {
  if (!lanes) return x;
  const lane = laneAt(x);
  if (lanes.includes(lane)) return x;
  const to = lanes.reduce((a, b) => (Math.abs(laneMid(b) - x) < Math.abs(laneMid(a) - x) ? b : a));
  const from = LANES[lane], into = LANES[to], k = (x - from.x0) / (from.x1 - from.x0);
  return Math.round(into.x0 + 12 + k * (into.x1 - into.x0 - 24));
}

/**
 * The daily stand: the same 10 waves for every player on the same day, one try a day
 * (`shared/daily.ts`). Each wave draws from its own seeded source (`dailyWaveRand`), in a fixed
 * order: the horde's answer, the condition, the plan, the supply drop. The horde's answer is drawn
 * from `ADAPT.fromWave` (the same for everyone, not read from the squad). No starting crates,
 * outpost upgrades or veterans come along, so every player starts the same. The score is the run's
 * scrap plus `perWave` for each wave cleared.
 */
export const DAILY = { game: 'deadline', perWave: 100 };
export const dailyScore = (scrap: number, cleared: number) => scrap + DAILY.perWave * cleared;

/**
 * Squad loyalty: a survivor who joins the squad and lives through a won run (a town, or an Open Road
 * extraction; not the daily) stays on the roster with their role and rank 1. Two picked from the
 * roster start the next run in the squad, and each win they live through raises their rank, up to
 * `maxRank`: every rank adds `damage` to their bullets' damage. The roster keeps `size` veterans;
 * a new one past that takes the place of the lowest rank.
 */
export const LOYALTY = { size: 6, picks: 2, maxRank: 3, damage: 0.2 };
export interface Veteran {
  name: string;
  role: Role;
  rank: number;
}
/** Call signs for veterans, in the order they are handed out. */
export const CALL_SIGNS = ['Ash', 'Brick', 'Cole', 'Dusty', 'Echo', 'Flint', 'Gator', 'Hawk', 'Iris', 'Jinx', 'Knox', 'Lark', 'Moss', 'Nova', 'Onyx', 'Pike'];
/** The first call sign no one in `taken` has (numbered once all are used). */
export function callSign(taken: string[]) {
  for (let n = 1; ; n++) {
    const sign = CALL_SIGNS.find((c) => !taken.includes(n > 1 ? `${c} ${n}` : c));
    if (sign) return n > 1 ? `${sign} ${n}` : sign;
  }
}
/** How much more damage a veteran of `rank` does. */
export const rankMult = (rank: number) => 1 + LOYALTY.damage * rank;
/**
 * The roster after a won run: the veterans brought along rank up, and the survivors who joined
 * this run come in at rank 1, taking the place of the lowest-ranked veteran once the roster is full.
 */
export function promote(roster: Veteran[], brought: number[], recruits: { name: string; role: Role }[]): Veteran[] {
  const next = roster.map((v, i) => (brought.includes(i) ? { ...v, rank: Math.min(LOYALTY.maxRank, v.rank + 1) } : v));
  for (const r of recruits) {
    if (next.length >= LOYALTY.size) {
      let low = 0;
      next.forEach((v, i) => v.rank < next[low].rank && (low = i));
      if (next[low].rank > 1) continue;
      next.splice(low, 1);
    }
    next.push({ name: r.name, role: r.role, rank: 1 });
  }
  return next;
}
/**
 * Squad leaders: one picked on the game over screen leads the next run (not the daily) with an
 * active, used from its button and then cooling down for `leaderCooldown`; the first use is ready
 * `LEADER.firstMs` into the run.
 * - Sergeant: an airstrike on the hero's lane after `AIRSTRIKE.warnMs`, hitting every zombie in it
 *   past shields;
 * - Medic: a patch-up that throws back every zombie within `PATCH.reach` of the sandbags and mends
 *   the bus in an escort town;
 * - Scout: a flare that lights the whole road for `FLARE.ms` (lifting blackout and fog), marks where
 *   the rest of the wave comes in and lists it, and makes every hit land `FLARE.spotted` times.
 * Each leader earns xp for every wave cleared in a run they led, and levels up at `LEADER.levels`:
 * each level past the first cuts the cooldown by `cooldownCut` and strengthens the active.
 */
export type LeaderKind = 'sergeant' | 'medic' | 'scout';
export const LEADERS: Record<LeaderKind, { label: TextKey; ability: TextKey; detail: TextKey; cooldownMs: number }> = {
  sergeant: { label: 'leaderSergeant', ability: 'leaderSergeantAbility', detail: 'leaderSergeantDetail', cooldownMs: 28000 },
  medic: { label: 'leaderMedic', ability: 'leaderMedicAbility', detail: 'leaderMedicDetail', cooldownMs: 34000 },
  scout: { label: 'leaderScout', ability: 'leaderScoutAbility', detail: 'leaderScoutDetail', cooldownMs: 30000 },
};
export const LEADER_KINDS = Object.keys(LEADERS) as LeaderKind[];
export const LEADER = { levels: [0, 6, 16, 32, 56], firstMs: 8000, cooldownCut: 0.08 };
export const LEADER_MAX = LEADER.levels.length;
/** A leader's level (1 to `LEADER_MAX`) for the xp earned, and the xp the next level needs (null at the top). */
export const leaderLevel = (xp: number) => LEADER.levels.filter((t) => xp >= t).length;
export const nextLevelXp = (xp: number) => LEADER.levels.find((t) => t > xp) ?? null;
export const leaderCooldown = (kind: LeaderKind, level: number) => Math.round(LEADERS[kind].cooldownMs * (1 - LEADER.cooldownCut * (level - 1)));
export const AIRSTRIKE = { warnMs: 900, damage: (wave: number, level: number) => Math.round((12 + 6 * wave) * (1 + 0.15 * (level - 1))) };
export const PATCH = { reach: 160, push: (level: number) => 180 + 20 * level, bus: (level: number) => 30 + 10 * level };
export const FLARE = { ms: (level: number) => 5000 + 1000 * (level - 1), spotted: 1.25 };

/**
 * The zombie codex: every kill of a kind fills its page, kept for good. A full page (`pages`) makes
 * every hit on that kind land `bonus` times, in every run but the daily.
 */
export const CODEX_KINDS: EnemyKind[] = ['grunt', 'runner', 'brute', 'spitter', 'crawler', 'riot', 'boss', 'brood', 'bloater'];
export const CODEX: { pages: Record<EnemyKind, number>; bonus: number } = {
  pages: { grunt: 200, runner: 120, brute: 60, spitter: 50, crawler: 150, riot: 40, boss: 3, brood: 3, bloater: 3 },
  bonus: 1.15,
};
export type Codex = Record<EnemyKind, number>;
export const EMPTY_CODEX = Object.fromEntries(CODEX_KINDS.map((k) => [k, 0])) as Codex;
export const codexFull = (codex: Codex, kind: EnemyKind) => codex[kind] >= CODEX.pages[kind];
/** Each kind's name on its codex page and in the scout's flare. */
export const KIND_NAMES: Record<EnemyKind, TextKey> = {
  grunt: 'kindGrunt', runner: 'kindRunner', brute: 'kindBrute', spitter: 'kindSpitter', crawler: 'kindCrawler', riot: 'kindRiot',
  boss: 'bossBehemoth', brood: 'bossBrood', bloater: 'bossBloater',
};

/** The medals an operation's best earns: waves cleared out of its 10. */
export const MEDALS: { label: TextKey; cleared: number }[] = [
  { label: 'medalGold', cleared: 10 },
  { label: 'medalSilver', cleared: 8 },
  { label: 'medalBronze', cleared: 5 },
];
export const medalOf = (cleared: number) => MEDALS.find((m) => cleared >= m.cleared)?.label ?? null;

/**
 * The horde adapts: from wave `ADAPT.fromWave` the wave plan answers the squad's strongest stat,
 * turning every `ADAPT.every`th grunt into its counter:
 * - armour (against pierce): armoured brutes, which stop any bullet that hits them, pierce or not;
 * - shields (against fire rate): riot zombies;
 * - flanks (against a wide squad): spitters that keep to the road's edges.
 * A stat only counts once it scores `ADAPT.minScore`: pierce by its level, fire rate by the rate
 * upgrades in it, the squad by every two companions. The first of the highest wins a tie.
 */
export type Adapt = 'armour' | 'shields' | 'flanks';
export const ADAPTS: Record<Adapt, { label: TextKey }> = {
  armour: { label: 'adaptArmour' },
  shields: { label: 'adaptShields' },
  flanks: { label: 'adaptFlanks' },
};
export const ADAPT = { fromWave: 8, minScore: 2, every: 4 };
export const ADAPT_KINDS = Object.keys(ADAPTS) as Adapt[];
/** The daily stand's horde answer: drawn from the day's seed, the same for every player. */
export const dailyAdapt = (wave: number, rand: () => number): Adapt | null => (wave >= ADAPT.fromWave ? ADAPT_KINDS[Math.floor(rand() * ADAPT_KINDS.length)] : null);
export function adaptTo(stats: Stats): Adapt | null {
  const rate = Math.round(Math.log(BASE_STATS.fireInterval / stats.fireInterval) / Math.log(1.25));
  const scores: [Adapt, number][] = [['armour', stats.pierce], ['shields', rate], ['flanks', Math.floor(stats.companions / 2)]];
  const best = scores.reduce((a, b) => (b[1] > a[1] ? b : a));
  return best[1] >= ADAPT.minScore ? best[0] : null;
}

/** Pickups drift down slower than the horde, so there is time to shoot them open. */
export const PICKUP = { speed: 40, halfSize: 22 };

/**
 * Fuel drums roll down the road slower still, so the horde walks past and through them. A single
 * hit blows one up: every zombie within `blastRadius` of it takes `blastDamage(wave)`.
 */
export const DRUM = { speed: 30, halfSize: 14, blastRadius: 88, hp: 1 };
export const blastDamage = (wave: number) => 6 + 3 * wave;

/**
 * Kills that come within `gapMs` of the last one build a streak. A streak of `kills` sets off a
 * frenzy: for `ms` the squad fires `rate` times as fast. The streak starts over once it ends.
 */
export const FRENZY = { gapMs: 1500, kills: 12, ms: 5000, rate: 2 };

export interface Stats {
  /** Hit points a bullet takes off. */
  damage: number;
  /** Time between volleys, in ms. */
  fireInterval: number;
  /** Soldiers at the hero's side, each firing a bullet of their own every volley. */
  companions: number;
  /** Enemies a bullet passes through before it stops. */
  pierce: number;
}

export const BASE_STATS: Stats = { damage: 1, fireInterval: 340, companions: 0, pierce: 0 };
/** The fastest the hero can fire, in ms between volleys. */
export const MIN_FIRE_INTERVAL = 90;

export function applyUpgrade(stats: Stats, kind: UpgradeKind): Stats {
  switch (kind) {
    case 'rate':
      return { ...stats, fireInterval: Math.max(MIN_FIRE_INTERVAL, Math.round(stats.fireInterval * 0.8)) };
    case 'damage':
      return { ...stats, damage: stats.damage + 1 };
    case 'companion':
      return { ...stats, companions: Math.min(MAX_COMPANIONS, stats.companions + 1) };
    case 'pierce':
      return { ...stats, pierce: stats.pierce + 1 };
  }
}

/** Something that comes in during a wave: `at` ms after the wave starts, `x` across the screen. */
export type Spawn =
  | { at: number; x: number; type: 'enemy'; kind: EnemyKind; hp: number; armoured?: boolean; flank?: boolean }
  | { at: number; x: number; type: 'pickup'; upgrade: CrateKind; hp: number }
  | { at: number; x: number; type: 'drum'; hp: number }
  | { at: number; x: number; type: 'survivor'; hp: number };

/** Every fifth wave ends with a boss. */
export const isBossWave = (wave: number) => wave % 5 === 0;

/** How many enemies a wave sends, not counting its boss. */
export const waveSize = (wave: number) => 12 + 6 * (wave - 1);

/**
 * Every zombie that must fall to clear the wave, its boss and crawler swarms included: the progress
 * strip's total. A boss's call adds its pack to it during the wave.
 */
export const waveTotal = (wave: number) => waveSize(wave) + (isBossWave(wave) ? 1 : 0) + swarmCount(wave) * SWARM.size;

/** How much tougher a wave's zombies are than wave 1's (scaled by the hub's difficulty). */
/** How much tougher each wave gets, before the hub's difficulty: fire rounds burn by this, so difficulty doesn't scale them too. */
export const waveToughness = (wave: number) => 1 + 0.3 * (wave - 1);
export const toughness = (wave: number) => waveToughness(wave) * byDifficulty(0.75, 1, 1.3);

/** How many fuel drums roll down in a wave (more in an ammo shortage). */
export const drumCount = (wave: number, condition: Condition = 'clear') => 1 + Math.floor(wave / 4) + (condition === 'shortage' ? CONDITION.shortageDrums : 0);

/**
 * Plans a wave: who comes in, when and where. Waves grow in size and toughness (scaled by the hub's difficulty), bring runners from
 * wave 2, brutes from wave 3, spitters and crawler swarms from wave 4 and riot zombies from wave 6,
 * and carry a pickup or more and a fuel drum or more in among the enemies, and a survivor from wave
 * 3. Draws for things added later come last, so earlier waves keep the enemies, crates and drums
 * they had. The wave's condition (drawn before the plan) can add drums.
 */
export interface WaveRules {
  /** Fuel drums added to every wave (the Fuel Depot), or none at all. */
  extraDrums?: number;
  drums?: boolean;
  /** Survivors a wave, from wave `survivorsFrom`. */
  survivors?: number;
  survivorsFrom?: number;
  /** What the horde answers the squad with, from `ADAPT.fromWave`. */
  adapt?: Adapt | null;
}

export function planWave(wave: number, rand: () => number = Math.random, condition: Condition = 'clear', rules: WaveRules = {}): Spawn[] {
  const tough = toughness(wave);
  const gap = Math.max(180, 550 - 35 * (wave - 1));
  const x = () => Math.round(SPAWN_MARGIN + rand() * (VIEW.w - 2 * SPAWN_MARGIN));
  const spawns: Spawn[] = [];
  const size = waveSize(wave);
  for (let i = 0; i < size; i++) {
    const roll = rand();
    const kind: EnemyKind =
      wave >= 3 && roll < 0.15 ? 'brute'
        : wave >= 2 && roll < 0.4 ? 'runner'
          : wave >= 4 && roll < 0.5 ? 'spitter'
            : wave >= 6 && roll < 0.6 ? 'riot'
              : 'grunt';
    spawns.push({ at: i * gap, x: x(), type: 'enemy', kind, hp: Math.round(ENEMIES[kind].hp * tough) });
  }
  // The horde adapts: every few grunts become the counter to the squad's strongest stat. No draws,
  // so the rest of the plan is the same as without it.
  if (rules.adapt && wave >= ADAPT.fromWave) {
    let grunts = 0, flank = 0;
    for (const sp of spawns) {
      if (sp.type !== 'enemy' || sp.kind !== 'grunt' || ++grunts % ADAPT.every) continue;
      const kind: EnemyKind = rules.adapt === 'armour' ? 'brute' : rules.adapt === 'shields' ? 'riot' : 'spitter';
      Object.assign(sp, { kind, hp: Math.round(ENEMIES[kind].hp * tough) });
      if (rules.adapt === 'armour') sp.armoured = true;
      if (rules.adapt === 'flanks') {
        sp.flank = true;
        sp.x = flank++ % 2 ? VIEW.w - SPAWN_MARGIN - 10 : SPAWN_MARGIN + 10;
      }
    }
  }
  if (isBossWave(wave)) {
    spawns.push({ at: size * gap + 1500, x: VIEW.w / 2, type: 'enemy', kind: 'boss', hp: Math.round(ENEMIES.boss.hp * tough) });
  }
  // Pickups come in among the enemies, the first a few seconds in, in the middle part of the screen.
  const pickups = 1 + Math.floor(wave / 3);
  for (let i = 0; i < pickups; i++) {
    const upgrade = UPGRADE_KINDS[Math.floor(rand() * UPGRADE_KINDS.length)];
    const at = 2500 + Math.round((i * size * gap) / pickups);
    spawns.push({ at, x: Math.round(VIEW.w * (0.25 + rand() * 0.5)), type: 'pickup', upgrade, hp: 10 + 6 * wave });
  }
  // Fuel drums come in early and spread over the wave, so the zombies behind them catch up and walk
  // through their blast rings. Their draws come last, so a wave's enemies and crates are the same
  // as without them.
  const drums = rules.drums === false ? 0 : drumCount(wave, condition) + (rules.extraDrums ?? 0);
  for (let i = 0; i < drums; i++) {
    const at = 2000 + Math.round((i * size * gap) / drums);
    spawns.push({ at, x: Math.round(VIEW.w * (0.3 + rand() * 0.4)), type: 'drum', hp: DRUM.hp });
  }
  // Crawler swarms: a tight bunch that comes in all at once, spread over the wave.
  const swarms = swarmCount(wave);
  for (let i = 0; i < swarms; i++) {
    const at = Math.round(((i + 0.5) * size * gap) / swarms), cx = Math.round(VIEW.w * (0.25 + rand() * 0.5));
    for (let k = 0; k < SWARM.size; k++) {
      const dx = ((k % 3) - 1) * 22 + (k >= 3 ? 11 : 0);
      spawns.push({ at: at + (k >= 3 ? 250 : 0), x: cx + dx, type: 'enemy', kind: 'crawler', hp: Math.round(ENEMIES.crawler.hp * tough) });
    }
  }
  // From wave 2, now and then a crate holds a sandbag wall.
  if (wave >= 2 && rand() < SANDBAG_CRATE_ODDS) {
    spawns.push({ at: 4000 + Math.round(rand() * size * gap * 0.5), x: Math.round(VIEW.w * (0.25 + rand() * 0.5)), type: 'pickup', upgrade: 'sandbag', hp: 8 + 4 * wave });
  }
  // From wave 3, a survivor walks down among the zombies, somewhere in the first part of the wave
  // (an operation can send more, from earlier).
  if (wave >= (rules.survivorsFrom ?? SURVIVOR.fromWave)) {
    for (let i = 0; i < (rules.survivors ?? 1); i++) {
      spawns.push({ at: 3000 + Math.round(rand() * size * gap * 0.6), x: x(), type: 'survivor', hp: SURVIVOR.hp(wave) });
    }
  }
  return spawns.sort((a, b) => a.at - b.at);
}
