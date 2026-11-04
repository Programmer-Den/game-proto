// Scenario battles: hand-made maps with goals of their own. `escort` sees a slow carrier from the
// player's hub to a dock across the map, `survive` holds a walled hub in the middle for ten minutes
// against every rival at once, and `relay` is a race to hold the relay beacon in the centre. Each
// map is the same every time (no Math.random). The best time of each one won is saved under
// `space-wars-scenarios`. No Phaser.

import { NODE_AMOUNT } from './arena';
import { localRandom, type MapLayout, type Point } from './map';
import type { TextKey } from '../i18n';

export type ScenarioId = 'escort' | 'survive' | 'relay';

export interface Scenario {
  id: ScenarioId;
  /** Keys of `i18n/en.ts`: its name and goal in a sentence. */
  name: TextKey;
  brief: TextKey;
  /** Crystal the player starts with on top of the usual. */
  crystal: number;
  layout: () => MapLayout;
}

/** `escort`: the carrier waits this long at the hub, then flies the route at its own speed. */
export const CARRIER_DEPART_MS = 75000;
export const CARRIER_SPEED = 12;
/** The carrier is a heavy with this many times the hit points, and no guns. */
export const CARRIER_HP = 5;
/** While it flies, the rival nearest it sends this many warships at it every so often. */
export const CARRIER_HUNT_MS = 30000;
export const CARRIER_HUNTERS = 3;
/** How close to the dock the carrier must come. */
export const DOCK_RADIUS = 40;
/** `survive`: how long the hub must stand. */
export const SURVIVE_MS = 600000;
/** `survive`: the rivals hold their first raid back this long, and the hub starts with a turret toward each of these gates (offsets from the hub). */
export const SURVIVE_GRACE_MS = 120000;
/** `survive`: each rival raids at most this often (the four in turn), with an army of at most SURVIVE_ARMY. */
export const SURVIVE_RAID_MS = 40000;
export const SURVIVE_ARMY = 10;
export const SURVIVE_TURRETS: readonly (readonly [number, number])[] = [[-150, 0], [150, 0], [0, -130], [0, 130]];
/** `relay`: seconds of holding the beacon that win it (a rival that gets there first wins instead). */
export const RELAY_HOLD = 150;

/** The escort carrier's way from the player's hub to the dock, the dock last. */
export const CARRIER_ROUTE: readonly Point[] = [
  { x: 420, y: 700 }, { x: 760, y: 560 }, { x: 1080, y: 420 }, { x: 1250, y: 250 }, { x: 1480, y: 110 },
];

interface Spec {
  homes: Point[];
  /** The direction of the first of the three nodes round each hub, in radians. */
  turn: number[];
  loose: Point[];
  beacon: Point;
  rocks: Point[];
  nebulae: (Point & { r: number })[];
  derelicts: MapLayout['derelicts'];
  seed: number;
}

const NEBULA_COLORS = [0x3a1d6e, 0x14406b, 0x5a1d4a, 0x1d5a4f];

/** A hand-made map: three nodes round each hub, the loose ones and the beacon where given, and rock fields of five rocks each. */
function handMade(s: Spec): MapLayout {
  const rand = localRandom(s.seed);
  const nodes: MapLayout['nodes'] = [];
  s.homes.forEach((h, k) => {
    for (let i = 0; i < 3; i++) {
      const a = s.turn[k] + (i * Math.PI * 2) / 3;
      nodes.push({ x: h.x + Math.cos(a) * 118, y: h.y + Math.sin(a) * 118, amount: NODE_AMOUNT });
    }
  });
  for (const p of s.loose) nodes.push({ ...p, amount: NODE_AMOUNT });
  const beacon = nodes.length;
  nodes.push({ ...s.beacon, amount: NODE_AMOUNT });
  const rocks: MapLayout['rocks'] = [];
  for (const c of s.rocks) {
    for (let i = 0; i < 5; i++) {
      const a = rand() * Math.PI * 2;
      const d = rand() * 50;
      rocks.push({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d, r: 9 + rand() * 11 });
    }
  }
  const stars: MapLayout['stars'] = [];
  for (let i = 0; i < 480; i++) stars.push({ x: rand() * 1600, y: rand() * 1000, a: 0.3 + rand() * 0.7 });
  const nebulae = s.nebulae.map((n, i) => ({ ...n, color: NEBULA_COLORS[i % NEBULA_COLORS.length] }));
  return { homes: s.homes, nodes, rocks, nebulae, stars, derelicts: s.derelicts, beacon };
}

/** Rock fields in a ring round a point, leaving gates at the four sides. */
function wall(c: Point, rx: number, ry: number): Point[] {
  return [30, 55, 125, 150, 210, 235, 305, 330].map((deg) => ({ x: c.x + Math.cos((deg * Math.PI) / 180) * rx, y: c.y + Math.sin((deg * Math.PI) / 180) * ry }));
}

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'escort', name: 'scenarioEscort', brief: 'scenarioEscortBrief', crystal: 100,
    layout: () => handMade({
      homes: [{ x: 200, y: 820 }, { x: 1390, y: 820 }, { x: 230, y: 190 }, { x: 800, y: 170 }, { x: 1390, y: 470 }],
      turn: [-2.4, -1.6, 0.6, 1.2, 2.6],
      loose: [{ x: 430, y: 430 }, { x: 1100, y: 160 }, { x: 1180, y: 600 }, { x: 980, y: 900 }, { x: 300, y: 520 }, { x: 1500, y: 640 }, { x: 560, y: 90 }],
      beacon: { x: 620, y: 760 },
      rocks: [{ x: 560, y: 430 }, { x: 980, y: 700 }, { x: 1160, y: 760 }, { x: 980, y: 280 }, { x: 420, y: 560 }, { x: 760, y: 880 }],
      nebulae: [{ x: 620, y: 300, r: 130 }, { x: 1250, y: 90, r: 95 }, { x: 260, y: 420, r: 100 }],
      derelicts: [{ x: 880, y: 470, kind: 'gun' }, { x: 1120, y: 940, kind: 'shipyard' }, { x: 470, y: 230, kind: 'sensors' }],
      seed: 0.31,
    }),
  },
  {
    id: 'survive', name: 'scenarioSurvive', brief: 'scenarioSurviveBrief', crystal: 200,
    layout: () => handMade({
      homes: [{ x: 800, y: 500 }, { x: 1390, y: 180 }, { x: 210, y: 820 }, { x: 210, y: 180 }, { x: 1390, y: 820 }],
      turn: [Math.PI / 4, 2.2, -1, 0.8, -2.2],
      loose: [{ x: 640, y: 380 }, { x: 980, y: 630 }, { x: 120, y: 500 }, { x: 1480, y: 500 }, { x: 800, y: 920 }, { x: 420, y: 520 }, { x: 1180, y: 480 }],
      beacon: { x: 800, y: 90 },
      rocks: wall({ x: 800, y: 500 }, 330, 270),
      nebulae: [{ x: 420, y: 820, r: 100 }, { x: 1200, y: 260, r: 110 }],
      derelicts: [{ x: 800, y: 735, kind: 'gun' }, { x: 430, y: 300, kind: 'sensors' }, { x: 1170, y: 700, kind: 'shipyard' }],
      seed: 0.57,
    }),
  },
  {
    id: 'relay', name: 'scenarioRelay', brief: 'scenarioRelayBrief', crystal: 0,
    layout: () => handMade({
      homes: [{ x: 200, y: 820 }, { x: 1400, y: 180 }, { x: 1400, y: 820 }, { x: 200, y: 180 }, { x: 800, y: 120 }],
      turn: [-1.6, 1.6, -1.6, 1.4, 1.6],
      loose: [{ x: 500, y: 830 }, { x: 1100, y: 830 }, { x: 500, y: 300 }, { x: 1100, y: 300 }, { x: 800, y: 900 }],
      beacon: { x: 800, y: 560 },
      rocks: [{ x: 650, y: 450 }, { x: 950, y: 450 }, { x: 650, y: 680 }, { x: 950, y: 680 }],
      nebulae: [{ x: 1150, y: 560, r: 100 }, { x: 450, y: 560, r: 100 }],
      derelicts: [{ x: 800, y: 330, kind: 'sensors' }, { x: 300, y: 500, kind: 'gun' }, { x: 1300, y: 500, kind: 'shipyard' }],
      seed: 0.83,
    }),
  },
];

export function scenarioOf(id: ScenarioId): Scenario {
  return SCENARIOS.find((s) => s.id === id)!;
}

/** The fastest win of each scenario, in ms of game time. */
export type ScenarioBest = Partial<Record<ScenarioId, number>>;

export const SCENARIO_KEY = 'space-wars-scenarios';

export function loadScenarios(): ScenarioBest {
  try {
    const raw = JSON.parse(localStorage.getItem(SCENARIO_KEY) ?? 'null');
    const best: ScenarioBest = {};
    if (raw && typeof raw === 'object') {
      for (const s of SCENARIOS) if (typeof raw[s.id] === 'number' && raw[s.id] > 0) best[s.id] = Math.round(raw[s.id]);
    }
    return best;
  } catch {
    return {};
  }
}

/** Records a win of `id` in `ms` of game time, keeping the faster. */
export function winScenario(best: ScenarioBest, id: ScenarioId, ms: number): ScenarioBest {
  const next = { ...best, [id]: Math.min(best[id] ?? Infinity, Math.round(ms)) };
  try {
    localStorage.setItem(SCENARIO_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the record lasts this visit only.
  }
  return next;
}
