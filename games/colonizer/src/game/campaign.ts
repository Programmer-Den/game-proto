// The campaign: five scenarios on fixed maps, each with its own goal and one new rule, played in
// order (a win opens the next) and scored with up to three stars. Free of Phaser, like the sim.
import type { MapKind, TemperamentId } from './data';
import type { GameState, MissionSetup } from './sim';
import { PLAYER } from './sim';
import type { TextKey } from '../i18n';

/** A star a win can earn beyond the first: won within `ms`, at most `n` units lost, or no building lost. */
export type StarCheck = { t: 'time'; ms: number } | { t: 'losses'; n: number } | { t: 'intact' };

export interface Scenario {
  id: 'watch' | 'road' | 'valour' | 'standing' | 'wonder';
  name: TextKey;
  /** The goal and the new rule, as the menu and the mission card say them. */
  goal: TextKey;
  rule: TextKey;
  kind: MapKind;
  /** Seeds the map and nothing else, so the scenario's map is the same every time. */
  seed: number;
  /** One temperament per rival (two for a three-way scenario). */
  rivals: TemperamentId[];
  mission: MissionSetup;
  /** The second and third stars. */
  stars: [StarCheck, StarCheck];
}

const MIN = 60000;

export const SCENARIOS: Scenario[] = [
  {
    id: 'watch', name: 'scnWatch', goal: 'scnWatchGoal', rule: 'scnWatchRule', kind: 'lowlands', seed: 1101, rivals: ['raider'],
    mission: { goal: { t: 'survive', ms: 12 * MIN }, raids: { first: 4 * MIN, rest: 90000 } },
    stars: [{ t: 'intact' }, { t: 'losses', n: 12 }],
  },
  {
    id: 'road', name: 'scnRoad', goal: 'scnRoadGoal', rule: 'scnRoadRule', kind: 'lakes', seed: 2202, rivals: ['builder'],
    mission: { goal: { t: 'escort', trips: 3 }, guardPosts: true },
    stars: [{ t: 'time', ms: 15 * MIN }, { t: 'losses', n: 8 }],
  },
  {
    id: 'valour', name: 'scnValour', goal: 'scnValourGoal', rule: 'scnValourRule', kind: 'highlands', seed: 3303, rivals: ['warden'],
    mission: { goal: { t: 'hold', relic: 'valor', ms: 4 * MIN }, rivalAge: 2 },
    stars: [{ t: 'time', ms: 25 * MIN }, { t: 'intact' }],
  },
  {
    id: 'standing', name: 'scnStanding', goal: 'scnStandingGoal', rule: 'scnStandingRule', kind: 'lowlands', seed: 4404, rivals: ['raider', 'warden'],
    mission: { goal: { t: 'conquest' }, noMonument: true },
    stars: [{ t: 'time', ms: 40 * MIN }, { t: 'losses', n: 40 }],
  },
  {
    id: 'wonder', name: 'scnWonder', goal: 'scnWonderGoal', rule: 'scnWonderRule', kind: 'lakes', seed: 5505, rivals: ['builder'],
    mission: { goal: { t: 'wonder' }, noMonument: true, startAge: 3, startRes: { wood: 2500, food: 2500, ore: 2000 } },
    stars: [{ t: 'time', ms: 35 * MIN }, { t: 'intact' }],
  },
];

export const scenarioById = (id: string) => SCENARIOS.find((s) => s.id === id) ?? null;

/** The text naming a star's condition. */
export function starText(c: StarCheck): { key: TextKey; vars: Record<string, number> } {
  if (c.t === 'time') return { key: 'starTime', vars: { n: c.ms / MIN } };
  if (c.t === 'losses') return { key: 'starLosses', vars: { n: c.n } };
  return { key: 'starIntact', vars: {} };
}

/** Whether a won match earned a star's condition. */
export function starEarned(s: GameState, c: StarCheck) {
  const p = s.players[PLAYER];
  if (c.t === 'time') return s.time <= c.ms;
  if (c.t === 'losses') return p.lost <= c.n;
  return p.razed === 0;
}

/** The stars a match earned: none for a loss, one for a win and one more for each star condition met. */
export function starsFor(s: GameState, sc: Scenario) {
  if (s.winner !== PLAYER) return 0;
  return 1 + sc.stars.filter((c) => starEarned(s, c)).length;
}

/** A seeded stand-in for Math.random (mulberry32), so a scenario's map is the same every time. */
export function seededRandom(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Runs `fn` with Math.random seeded, then puts Math.random back, so the rest of the game is untouched. */
export function withSeed<T>(seed: number, fn: () => T): T {
  const saved = Math.random;
  Math.random = seededRandom(seed);
  try {
    return fn();
  } finally {
    Math.random = saved;
  }
}
