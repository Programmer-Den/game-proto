// The things that bite back: slugs, moths, thornlings, frogs, shelled beetles and lantern moths, the
// thornlings' seeds and the lantern moths' embers, the
// Thornmother at the bottom of the shrine with her three bulbs, and the Bellwraith in the belfry.

import Phaser from 'phaser';
import { texScale } from '../art/paint';
import { LOW, SOLID, TILE, tileAt, type EnemyKind, type MapDef } from '../game/maps';
import { byDifficulty } from '../../../../shared/settings';

export interface FoeInfo {
  hp: number;
  speed: number;
  /** How far away it notices the knight. */
  sees: number;
  /** Half hearts a touch costs. */
  damage: number;
  /** Flies over water and pits. */
  flies?: boolean;
}

export const FOES: Record<EnemyKind, FoeInfo> = {
  slug: { hp: 2, speed: 32, sees: 140, damage: 1 },
  moth: { hp: 1, speed: 74, sees: 200, damage: 1, flies: true },
  thornling: { hp: 3, speed: 0, sees: 270, damage: 1 },
  frog: { hp: 2, speed: 150, sees: 180, damage: 1 },
  beetle: { hp: 3, speed: 40, sees: 160, damage: 1 },
  lantern: { hp: 2, speed: 64, sees: 220, damage: 1, flies: true },
};

/**
 * Foes a plain sword swing can't hurt until something knocks them down: a beetle's shell turns the
 * blade until the hookvine or a bellseed flips it, and a lantern moth flies above it until the
 * hookvine or a bellseed brings it down. Down, they lie still for `DOWN_MS`.
 */
export const ARMOURED: ReadonlySet<EnemyKind> = new Set<EnemyKind>(['beetle', 'lantern']);
export const DOWN_MS = 2600;
/** A lantern moth flies this high, keeps this far from the knight, and drops an ember this often. */
export const LANTERN_LIFT = 30;
export const LANTERN_KEEP = 70;
export const LANTERN_SHOT_MS = 2600;

/** A frog sits still between leaps: how long, and how long a leap lasts. */
export const FROG_WAIT_MS = 1100;
export const FROG_LEAP_MS = 320;

/** Seeds a thornling spits, and the Thornmother's volleys. */
export const SEED_SPEED = 150;
export const THORNLING_SHOT_MS = 2300;
/** The Thornmother: how often a bulb rises, how long it stays up, and how long a yanked bulb lies stunned. */
export const BULB_EVERY_MS = 4200;
export const BULB_UP_MS = 3400;
export const BULB_DOWN_MS = 4800;
export const BULB_HP = 2;
/** Seconds between her thorn volleys, by bulbs left (3, 2, 1). */
export const VOLLEY_MS = [3400, 2800, 2200];
export const SUMMON_MS = byDifficulty(12000, 9000, 7000);

/** Bellseeds: how long one swells before it bursts, and how far the burst reaches. */
export const FUSE_MS = 1400;
export const BURST_PX = 50;
/** The Bellwraith: how long its bell hovers after the knight, how long the drop is telegraphed,
 * how long the bell lies on the floor, how long the wraith shows once the bell is tipped, and how
 * far the slam's shockwave reaches. */
export const HOVER_MS = 2600;
export const DROP_MS = 600;
export const BELL_DOWN_MS = 2800;
export const EXPOSED_MS = 3500;
export const SLAM_PX = 50;
export const WRAITH_HP = 3;
export const HOVER_SPEED = 85;

/**
 * The hourglass trial's harder bosses, as factors on the numbers above: the Thornmother's bulbs stay
 * up less long, her volleys come faster and wider and she calls more slugs; the Bellwraith takes more
 * hits, hunts faster and shows itself for less time.
 */
export const TRIAL = { bulbUp: 0.8, volley: 0.75, volleyShots: 12, summon: 0.75, summoned: 3, wraithHp: 5, hover: 0.7, hoverSpeed: 1.3, exposed: 0.8 };

export interface Foe {
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  sprite: Phaser.GameObjects.Image;
  home: { x: number; y: number };
  dir: { x: number; y: number };
  /** Counts down to its next turn or shot. */
  t: number;
  stun: number;
  hurt: number;
  room?: string;
  /** A frog's leap: time left in it. */
  leap: number;
  /** An armoured foe knocked down (a beetle on its back, a lantern moth on the ground): time left. */
  down: number;
  /** Its place in the map's list, for remembering shrine foes that are beaten. */
  index: number;
  alive: boolean;
}

export interface Seed {
  x: number;
  y: number;
  vx: number;
  vy: number;
  sprite: Phaser.GameObjects.Image;
  life: number;
}

export type BulbState = 'hidden' | 'raised' | 'down' | 'gone';
export interface Bulb {
  home: { x: number; y: number };
  x: number;
  y: number;
  state: BulbState;
  t: number;
  hp: number;
  sprite: Phaser.GameObjects.Image;
}

export interface Boss {
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
  bulbs: Bulb[];
  raiseT: number;
  volleyT: number;
  summonT: number;
  awake: boolean;
}

/** Whether a foe can stand at a point (a small circle round its feet). */
export function foeFree(map: MapDef, extra: (tx: number, ty: number) => boolean, x: number, y: number, flies = false) {
  for (const [dx, dy] of [[-7, -5], [7, -5], [-7, 5], [7, 5]]) {
    const tx = Math.floor((x + dx) / TILE);
    const ty = Math.floor((y + dy) / TILE);
    const t = tileAt(map, tx, ty);
    if (SOLID.has(t) && !(flies && LOW.has(t))) return false;
    if (extra(tx, ty)) return false;
  }
  return true;
}

export function makeFoe(scene: Phaser.Scene, kind: EnemyKind, x: number, y: number, index: number, room?: string): Foe {
  const key = kind === 'moth' ? 'moth-a' : kind === 'lantern' ? 'lantern-a' : kind;
  const sprite = scene.add.image(x, y, key).setOrigin(0.5, 0.85).setScale(texScale(key));
  return { kind, x, y, hp: FOES[kind].hp, sprite, home: { x, y }, dir: { x: 0, y: 0 }, t: Math.random() * 1500, stun: 0, hurt: 0, room, leap: 0, down: 0, index, alive: true };
}

/** The Bellwraith's bell: hovering after the knight, dropping, lying on the floor, tipped over to
 * show the wraith, or rising again. */
export type WraithState = 'hover' | 'drop' | 'down' | 'tipped' | 'rise';
export interface Wraith {
  x: number;
  y: number;
  /** How high the bell hangs over its shadow, in pixels. */
  lift: number;
  state: WraithState;
  t: number;
  hp: number;
  bell: Phaser.GameObjects.Image;
  ghost: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  summonT: number;
  podT: number;
  awake: boolean;
}

/** A bellseed planted on the ground, swelling until it bursts. */
export interface Bomb {
  x: number;
  y: number;
  t: number;
  sprite: Phaser.GameObjects.Image;
}
