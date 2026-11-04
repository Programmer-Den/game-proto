import Phaser from 'phaser';
import { sharpRes } from '../../../../shared/scaling';
import type { ArtStyle } from '../game/save';
import { VIEW } from '../game/rules';

// Shared tools for painting textures on 2D canvases, and the size of every sprite. Both art styles
// paint each sprite into the same box with the same origin, so switching style only swaps textures:
// nothing moves, and hit boxes (which come from rules.ts, not from the art) stay the same.

export type Ctx = CanvasRenderingContext2D;
export type Pt = [number, number];
export const TAU = Math.PI * 2;

/**
 * Textures are painted at twice the game's pixels on a screen that needs no scaling, and more on a
 * bigger one (`sharpRes`), then shown scaled down to their box, so they stay sharp.
 */
export const HI = 2;

/**
 * The whole view in game pixels, as a rectangle in the road's coordinates. The road is laid out for
 * the designed 540x960 (`VIEW`); on a screen of another shape the view grows (`setupScaling` with
 * `fill`), sideways round the road (`x` goes below 0) or downwards behind the squad (`h` grows past
 * 960), and the camera scrolls by `x` so the road stays in the middle. At 540x960 it is the view.
 * Set once by `fitField`, before the first texture is baked.
 */
export const FIELD = { x: 0, y: 0, w: VIEW.w, h: VIEW.h };
/** The boxes of the layers painted over the whole view's width (or all of it), kept in step with `FIELD`. */
const FIELD_BOX = { w: VIEW.w, h: VIEW.h, ox: 0, oy: 0 };
const HUDBAR_BOX = { w: VIEW.w, h: 56, ox: 0, oy: 0 };
const SANDBAGS_BOX = { w: VIEW.w, h: 36, ox: 0, oy: 18 };

/** Fits `FIELD` to a view of `w` x `h` game pixels: the road centred across it, at its top. */
export function fitField(w: number, h: number) {
  FIELD.x = -Math.round((w - VIEW.w) / 2);
  FIELD.w = Math.max(w, VIEW.w);
  FIELD.h = Math.max(h, VIEW.h);
  for (const box of [FIELD_BOX, HUDBAR_BOX, SANDBAGS_BOX]) {
    box.w = FIELD.w;
    box.ox = -FIELD.x;
  }
  FIELD_BOX.h = FIELD.h;
}

/**
 * Each sprite's box in game pixels and where its origin is inside it (the entity's x, y). The
 * soldier's origin is the rifle, so bullets leave from where the hero's x says.
 */
export const GEOM = {
  hero: { w: 42, h: 64, ox: 30, oy: 34 },
  companion: { w: 42, h: 64, ox: 30, oy: 34 },
  grunt: { w: 46, h: 62, ox: 23, oy: 34 },
  runner: { w: 46, h: 62, ox: 23, oy: 34 },
  brute: { w: 68, h: 70, ox: 34, oy: 28 },
  boss: { w: 136, h: 140, ox: 68, oy: 58 },
  brood: { w: 136, h: 140, ox: 68, oy: 58 },
  bloater: { w: 136, h: 140, ox: 68, oy: 58 },
  /** A survivor on the road, the same box as a walker. */
  survivor: { w: 46, h: 62, ox: 23, oy: 34 },
  crate: { w: 64, h: 86, ox: 32, oy: 58 },
  drum: { w: 40, h: 46, ox: 20, oy: 22 },
  bullet: { w: 14, h: 34, ox: 7, oy: 7 },
  muzzle: { w: 28, h: 28, ox: 14, oy: 16 },
  splat: { w: 52, h: 34, ox: 26, oy: 17 },
  blast: { w: 220, h: 220, ox: 110, oy: 110 },
  streak: { w: 92, h: 70, ox: 46, oy: 35 },
  label: { w: 132, h: 24, ox: 66, oy: 0 },
  sandbags: SANDBAGS_BOX,
  ground: FIELD_BOX,
  sfx: { w: 150, h: 70, ox: 75, oy: 35 },
  hudbar: HUDBAR_BOX,
  ring: { w: 192, h: 192, ox: 96, oy: 96 },
  spitter: { w: 46, h: 62, ox: 23, oy: 34 },
  riot: { w: 56, h: 66, ox: 28, oy: 32 },
  crawler: { w: 38, h: 42, ox: 19, oy: 20 },
  /** An acid puddle, painted for a radius of 78 and scaled to the pool's size. */
  acid: { w: 168, h: 64, ox: 84, oy: 32 },
  glob: { w: 22, h: 22, ox: 11, oy: 11 },
  /** A sandbag wall across a lane, painted for the widest lane and stretched to the narrow ones. */
  wall: { w: 184, h: 40, ox: 92, oy: 22 },
  /** The flamethrower's burst along the sandbags, its origin on the line. */
  flame: { w: 540, h: 200, ox: 270, oy: 176 },
  supply: { w: 72, h: 72, ox: 36, oy: 36 },
  /** The escort towns' bus, from above and driving up the road, its origin in the middle. */
  bus: { w: 64, h: 124, ox: 32, oy: 62 },
} as const;
export type SpriteName = keyof typeof GEOM;

/** A texture name's box: its own, or its first part's (`crate-rate` uses `GEOM.crate`). */
export const geomOf = (name: string) => GEOM[(name.split('-')[0] in GEOM ? name.split('-')[0] : name) as SpriteName];

/** The night-vision grain tile's size in game pixels. */
export const GRAIN_TILE = 128;

/** The texture key of a sprite in a style, e.g. `comic-grunt` or `nv-crate-rate`. */
export const tex = (style: ArtStyle, name: string) => `${style}-${name}`;

/** A small seeded random, so the art is the same every time and never touches Math.random. */
export function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

export function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w);
  c.height = Math.ceil(h);
  return c;
}

/** Screen-sized layers are painted at 1x (more on a bigger screen): drawing them every frame is much cheaper. */
export const FULL_SCREEN = new Set<string>(['ground', 'sandbags', 'scan', 'hudbar', 'flame']);
/**
 * The most a texture is painted at, however big the screen: painting slows with the square of it,
 * and night vision reworks every pixel. Big layers are mostly soft shading and grain.
 */
const MAX_SCALE = { layer: 2, sprite: 4 };

/**
 * Paints a texture into the box of `geom` (in game pixels, at `scale`: `HI`, or 1 for a full-screen
 * layer, times what a bigger screen needs), with the drawing's (0, 0) at the box's origin. `post` can rework the
 * finished canvas (the night-vision look does). Show it at `geom.w / width` scale.
 */
export function bake(
  scene: Phaser.Scene,
  key: string,
  geom: { w: number; h: number; ox: number; oy: number },
  draw: (ctx: Ctx) => void,
  post?: (c: HTMLCanvasElement, scale: number) => void,
) {
  const layer = FULL_SCREEN.has(key.slice(key.indexOf('-') + 1));
  const scale = Math.min(sharpRes(geom.w, geom.h, layer ? 1 : HI), layer ? MAX_SCALE.layer : MAX_SCALE.sprite);
  const c = canvas(geom.w * scale, geom.h * scale);
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.translate(geom.ox, geom.oy);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  post?.(c, scale);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

export function path(ctx: Ctx, pts: Pt[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

export function circle(ctx: Ctx, x: number, y: number, r: number, fill?: string, stroke?: string, lw = 2) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

const hex = (c: string) => {
  const p = parseInt(c.slice(1), 16);
  return [(p >> 16) & 255, (p >> 8) & 255, p & 255];
};
/** Mixes two #rrggbb colours: t = 0 is a, 1 is b. */
export function mix(a: string, b: string, t: number) {
  const A = hex(a), B = hex(b);
  return '#' + A.map((v, i) => Math.round(v * (1 - t) + B[i] * t).toString(16).padStart(2, '0')).join('');
}
/** Lighter towards white for k > 0, darker towards black for k < 0. */
export const lit = (c: string, k: number) => (k >= 0 ? mix(c, '#ffffff', k) : mix(c, '#000000', -k));
export function rgba(c: string, a: number) {
  const [r, g, b] = hex(c);
  return `rgba(${r},${g},${b},${a})`;
}
/** A #rrggbb colour as the number Phaser's Graphics wants. */
export const num = (c: string) => parseInt(c.slice(1), 16);
