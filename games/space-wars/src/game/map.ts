import { ARENA, NODE_AMOUNT, startPoints } from './arena';

export interface Point {
  x: number;
  y: number;
}

/** What a derelict station gives the faction that claims it. */
export type DerelictKind = 'sensors' | 'shipyard' | 'gun';
export const DERELICT_KINDS: readonly DerelictKind[] = ['sensors', 'shipyard', 'gun'];

/**
 * A random star map: where each faction's hub sits, crystal nodes, rock fields, nebulae (ships
 * inside are hidden and slowed), stars and derelict stations out in the fog.
 */
export interface MapLayout {
  homes: Point[];
  nodes: (Point & { amount: number })[];
  rocks: (Point & { r: number })[];
  nebulae: (Point & { r: number; color: number })[];
  stars: (Point & { a: number })[];
  derelicts: (Point & { kind: DerelictKind })[];
  /** A hand-made map's relay beacon (an index into `nodes`); a random map leaves it to `beaconNode`. */
  beacon?: number;
  /** Wormhole pairs: a ship that flies into one mouth comes out of the other (`wormholes`). None on most maps. */
  wormholes?: Wormhole[];
}

/** Two linked mouths: a warship that flies into either comes out of the other. */
export interface Wormhole {
  a: Point;
  b: Point;
}

/** How far a wormhole's mouths sit in from the battlefield's corners. */
const WORMHOLE_INSET = 110;

/**
 * The wormholes for the battlefield as it is now: two pairs, each linking a corner with the far
 * corner, behind the four corner starts, so a fleet can strike the back of a base across the map.
 * Fixed spots, with no Math.random, so adding them leaves a map's randomness as it was.
 */
export function wormholes(): Wormhole[] {
  const x0 = ARENA.x + WORMHOLE_INSET, x1 = ARENA.x + ARENA.w - WORMHOLE_INSET;
  const y0 = ARENA.y + WORMHOLE_INSET, y1 = ARENA.y + ARENA.h - WORMHOLE_INSET;
  return [
    { a: { x: x0, y: y1 }, b: { x: x1, y: y0 } },
    { a: { x: x0, y: y0 }, b: { x: x1, y: y1 } },
  ];
}

/** Where the relay beacon goes: the loose crystal node nearest this share of the way from the player's start to the map's centre. */
const BEACON_TOWARD = 0.5;
/** How far the relay beacon stays from the player's start, beyond what the hub sees, so it has to be found. */
export const BEACON_HOME_GAP = 200;
/** How far the relay beacon stays from every rival's start, so it sits in open space. */
const BEACON_RIVAL_GAP = 300;
/** How far a nebula's edge stays from every hub and from the line from the player's start to the beacon. */
const NEBULA_HOME_GAP = 60;
const NEBULA_LANE_GAP = 100;
/** How far a derelict station stays from the hubs, the beacon, the start-to-beacon line and the other derelicts. */
const DERELICT_HOME_GAP = 260;
const DERELICT_BEACON_GAP = 160;
const DERELICT_LANE_GAP = 130;
const DERELICT_GAP = 260;
/** A derelict's ring, kept out of the nebulae (the world's DERELICT_RADIUS). */
const DERELICT_RADIUS = 60;

/** Keeps random spots away from the battlefield's edge. */
const EDGE = 60;
/** How far a start point may drift from its fixed spot. */
const JITTER = 36;

function randomIn(rand = Math.random): Point {
  return {
    x: ARENA.x + EDGE + rand() * (ARENA.w - 2 * EDGE),
    y: ARENA.y + EDGE + rand() * (ARENA.h - 2 * EDGE),
  };
}

/**
 * A small generator of its own for the retries that keep nebulae and derelicts clear of things, so
 * the map draws the same count from Math.random whatever the retries, and everything that follows
 * (the stars, then the battle's own randomness) is the same as before they existed.
 */
export function localRandom(seed: number) {
  let s = Math.floor(seed * 2147483647) | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** How far a point is from the line segment a to b. */
function distToSegment(p: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return dist(p, { x: a.x + dx * t, y: a.y + dy * t });
}

/**
 * The index in `nodes` of the node that becomes the relay beacon: the loose node (after the three
 * beside each hub) nearest the point partway from the player's start to the map's centre, at least
 * BEACON_HOME_GAP from the player's start and BEACON_RIVAL_GAP from every rival's.
 */
export function beaconNode(homes: Point[], nodes: Point[]): number {
  const home = homes[0];
  const toward = { x: home.x + (ARENA.x + ARENA.w / 2 - home.x) * BEACON_TOWARD, y: home.y + (ARENA.y + ARENA.h / 2 - home.y) * BEACON_TOWARD };
  const loose = nodes.map((_, i) => i).slice(homes.length * 3)
    .filter((i) => homes.every((h, k) => dist(h, nodes[i]) > (k === 0 ? BEACON_HOME_GAP : BEACON_RIVAL_GAP)));
  return (loose.length ? loose : nodes.map((_, i) => i)).reduce((a, b) => (dist(nodes[b], toward) < dist(nodes[a], toward) ? b : a));
}

/** Each faction's hub sits at its fixed start point, nudged a little at random. */
function placeHomes(count: number): Point[] {
  return startPoints().slice(0, count).map((p) => ({
    x: p.x + (Math.random() * 2 - 1) * JITTER,
    y: p.y + (Math.random() * 2 - 1) * JITTER,
  }));
}

/**
 * Makes a random map for `factionCount` hubs with `loose` crystal nodes across the field (fewer in
 * a harder campaign sector). Every call with the same Math.random gives the same map.
 */
export function generateMap(factionCount: number, loose = 16): MapLayout {
  const homes = placeHomes(factionCount);
  const nodes: MapLayout['nodes'] = [];

  // Three crystal nodes a short way from each hub, then a few loose ones across the field.
  for (const home of homes) {
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const d = 95 + Math.random() * 60;
      nodes.push({ x: home.x + Math.cos(angle) * d, y: home.y + Math.sin(angle) * d, amount: NODE_AMOUNT });
    }
  }
  for (let i = 0; i < loose; i++) {
    let p = randomIn();
    for (let tries = 0; tries < 20 && homes.some((h) => dist(h, p) < 130); tries++) p = randomIn();
    nodes.push({ ...p, amount: NODE_AMOUNT });
  }

  // Rock fields: clusters of rocks that block where buildings can go.
  const rocks: MapLayout['rocks'] = [];
  for (let f = 0; f < 12; f++) {
    let center = randomIn();
    for (let tries = 0; tries < 20 && homes.some((h) => dist(h, center) < 140); tries++) center = randomIn();
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const d = Math.random() * 60;
      rocks.push({ x: center.x + Math.cos(angle) * d, y: center.y + Math.sin(angle) * d, r: 8 + Math.random() * 12 });
    }
  }

  // Nebulae hide and slow the ships inside them, so they keep clear of the hubs and of the lane
  // from the player's start to the relay beacon: the first round's flight stays in the open.
  const beacon = nodes[beaconNode(homes, nodes)];
  const local = localRandom(homes[0].x / ARENA.w + homes[0].y / ARENA.h);
  const nebulaColors = [0x3a1d6e, 0x14406b, 0x5a1d4a, 0x1d5a4f];
  const nebulae: MapLayout['nebulae'] = [];
  for (let i = 0; i < 8; i++) {
    let p = randomIn();
    const r = 120 + Math.random() * 90;
    const crowded = (q: Point) => homes.some((h) => dist(h, q) < r + NEBULA_HOME_GAP) || distToSegment(q, homes[0], beacon) < r + NEBULA_LANE_GAP;
    for (let tries = 0; tries < 30 && crowded(p); tries++) p = randomIn(local);
    nebulae.push({ ...p, r, color: nebulaColors[i % nebulaColors.length] });
  }

  const stars: MapLayout['stars'] = [];
  for (let i = 0; i < 480; i++) {
    stars.push({ x: ARENA.x + Math.random() * ARENA.w, y: ARENA.y + Math.random() * ARENA.h, a: 0.3 + Math.random() * 0.7 });
  }

  // Derelict stations, one of each kind, out in the open away from the bases, the beacon, the lane
  // to it and the nebulae; a faction that holds one claims its perk.
  const derelicts: MapLayout['derelicts'] = [];
  for (const kind of DERELICT_KINDS) {
    let p = randomIn(local);
    const crowded = (q: Point) => homes.some((h) => dist(h, q) < DERELICT_HOME_GAP) || dist(q, beacon) < DERELICT_BEACON_GAP
      || distToSegment(q, homes[0], beacon) < DERELICT_LANE_GAP || derelicts.some((d) => dist(d, q) < DERELICT_GAP)
      || nodes.some((n) => dist(n, q) < 70) || nebulae.some((n) => dist(n, q) < n.r + DERELICT_RADIUS);
    for (let tries = 0; tries < 40 && crowded(p); tries++) p = randomIn(local);
    derelicts.push({ ...p, kind });
  }

  return { homes, nodes, rocks, nebulae, stars, derelicts };
}
