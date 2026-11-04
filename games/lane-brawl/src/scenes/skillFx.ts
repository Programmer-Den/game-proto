import Phaser from 'phaser';
import type { Projectile, Zone } from '../game/state';

/**
 * The look of every ability: what its cast leaves on screen, how its bolts fly and hit, how its
 * zone churns and how its buff glows round the champion. Each ability has its own look, keyed
 * `${championId}.${key}` (as `lookOf` in `sim.ts` names it); a bolt's hit is `${look}>hit`.
 * Everything is drawn with Graphics from the time an effect has run, so nothing here is random:
 * scatter comes from `hash`, seeded by the effect's place.
 */

type G = Phaser.GameObjects.Graphics;

/** One cast effect: (x, y) is where it lands (an area's centre, a dash's end, a bolt's hand),
 * (x2, y2) where the caster stood, r the area's radius and a the way the caster faced. */
export interface SkillShot {
  look: string;
  x: number;
  y: number;
  x2: number;
  y2: number;
  r: number;
  a: number;
}

/** The two layers effects draw on: the ground under the figures and the air over them. */
export interface FxLayers {
  ground: G;
  top: G;
}

/** Graphics' point lists are typed as vectors but take any {x, y}. */
function pts2(p: { x: number; y: number }[]): Phaser.Math.Vector2[] {
  return p as Phaser.Math.Vector2[];
}

/** How high above the ground a bolt flies and an effect on the body sits. */
const AIR = 20;
const TAU = Math.PI * 2;

/** A repeatable value in [0, 1) for a number. */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
const out = (k: number) => 1 - (1 - k) * (1 - k);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

// ---------------------------------------------------------------------------------------------
// Shapes.

function ring(g: G, x: number, y: number, r: number, w: number, color: number, alpha: number) {
  if (r <= 0 || alpha <= 0) return;
  g.lineStyle(w, color, clamp01(alpha)).strokeCircle(x, y, r);
}

function disc(g: G, x: number, y: number, r: number, color: number, alpha: number) {
  if (r <= 0 || alpha <= 0) return;
  g.fillStyle(color, clamp01(alpha)).fillCircle(x, y, r);
}

function poly(g: G, pts: { x: number; y: number }[], color: number, alpha: number) {
  if (alpha <= 0) return;
  g.fillStyle(color, clamp01(alpha)).fillPoints(pts2(pts), true);
}

function line(g: G, x1: number, y1: number, x2: number, y2: number, w: number, color: number, alpha: number) {
  if (alpha <= 0) return;
  g.lineStyle(w, color, clamp01(alpha)).lineBetween(x1, y1, x2, y2);
}

/** A star of n points between radii r1 (tips) and r2 (notches). */
function star(g: G, x: number, y: number, r1: number, r2: number, n: number, rot: number, color: number, alpha: number) {
  const pts = Array.from({ length: n * 2 }, (_, i) => {
    const rr = i % 2 ? r2 : r1;
    const a = rot + (i * Math.PI) / n;
    return { x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr };
  });
  poly(g, pts, color, alpha);
}

/** Lines from radius r0 to r1 round a point. */
function spokes(g: G, x: number, y: number, r0: number, r1: number, n: number, rot: number, w: number, color: number, alpha: number) {
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * TAU;
    line(g, x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, w, color, alpha);
  }
}

/** A jagged line from one point to another: a crack, a lightning bolt, a vine. */
function jag(g: G, x1: number, y1: number, x2: number, y2: number, segs: number, amp: number, seed: number, w: number, color: number, alpha: number) {
  if (alpha <= 0) return;
  const d = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / d, ny = (x2 - x1) / d;
  g.lineStyle(w, color, clamp01(alpha)).beginPath();
  g.moveTo(x1, y1);
  for (let i = 1; i < segs; i++) {
    const k = i / segs;
    const o = (hash(seed + i * 7.3) - 0.5) * 2 * amp;
    g.lineTo(lerp(x1, x2, k) + nx * o, lerp(y1, y2, k) + ny * o);
  }
  g.lineTo(x2, y2);
  g.strokePath();
}

function arcStroke(g: G, x: number, y: number, r: number, a0: number, a1: number, w: number, color: number, alpha: number) {
  if (alpha <= 0 || r <= 0) return;
  g.lineStyle(w, color, clamp01(alpha)).beginPath();
  g.arc(x, y, r, a0, a1, false);
  g.strokePath();
}

/** A filled slash: thick in the middle of the sweep and sharp at both ends. */
function crescent(g: G, x: number, y: number, r: number, a0: number, a1: number, thick: number, color: number, alpha: number) {
  if (alpha <= 0 || r <= 0) return;
  const n = 14;
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const a = lerp(a0, a1, i / n);
    pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
  }
  for (let i = n; i >= 0; i--) {
    const a = lerp(a0, a1, i / n);
    const rr = r - thick * Math.sin((i / n) * Math.PI);
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  poly(g, pts, color, alpha);
}

/** Bits flying out from a point to radius r as k runs from 0 to 1. */
function burstDots(g: G, x: number, y: number, r: number, n: number, k: number, seed: number, size: number, color: number, alpha: number) {
  for (let i = 0; i < n; i++) {
    const a = hash(seed + i) * TAU;
    const d = r * out(k) * (0.55 + hash(seed + i * 3.1) * 0.45);
    disc(g, x + Math.cos(a) * d, y + Math.sin(a) * d, size * (1 - k * 0.6), color, alpha);
  }
}

/** Soft puffs that swell as they fade, scattered within r. */
function puffs(g: G, x: number, y: number, r: number, n: number, k: number, seed: number, size: number, color: number, alpha: number) {
  for (let i = 0; i < n; i++) {
    const a = hash(seed + i * 1.7) * TAU;
    const d = r * Math.sqrt(hash(seed + i * 5.3));
    disc(g, x + Math.cos(a) * d, y + Math.sin(a) * d, size * (0.5 + out(k) * 0.8) * (0.7 + hash(seed + i) * 0.6), color, alpha * (1 - k) * 0.7);
  }
}

/** Motes that rise from points within r. */
function rising(g: G, x: number, y: number, r: number, n: number, k: number, seed: number, size: number, height: number, color: number, alpha: number, shape: 'dot' | 'diamond' | 'plus' = 'dot') {
  for (let i = 0; i < n; i++) {
    const kk = clamp01(k * 1.3 - hash(seed + i * 2.3) * 0.3);
    const a = hash(seed + i * 1.3) * TAU;
    const d = r * Math.sqrt(hash(seed + i * 4.1));
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d - height * kk;
    const al = alpha * Math.sin(kk * Math.PI);
    if (shape === 'diamond') poly(g, [{ x: px, y: py - size }, { x: px + size * 0.6, y: py }, { x: px, y: py + size }, { x: px - size * 0.6, y: py }], color, al);
    else if (shape === 'plus') {
      line(g, px - size, py, px + size, py, size * 0.6, color, al);
      line(g, px, py - size, px, py + size, size * 0.6, color, al);
    } else disc(g, px, py, size, color, al);
  }
}

/** A column of light standing on (x, y). */
function pillar(g: G, x: number, y: number, w: number, h: number, color: number, alpha: number) {
  if (alpha <= 0) return;
  g.fillStyle(color, clamp01(alpha * 0.35)).fillRect(x - w / 2, y - h, w, h);
  g.fillStyle(color, clamp01(alpha * 0.55)).fillRect(x - w / 4, y - h, w / 2, h);
  g.fillStyle(0xffffff, clamp01(alpha * 0.6)).fillRect(x - w / 10, y - h, w / 5, h);
  g.fillStyle(color, clamp01(alpha * 0.5)).fillEllipse(x, y, w * 1.6, w * 0.6);
}

function gear(g: G, x: number, y: number, r: number, teeth: number, rot: number, color: number, alpha: number) {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = rot + (i / (teeth * 4)) * TAU;
    const rr = i % 4 < 2 ? r : r * 0.75;
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  poly(g, pts, color, alpha);
  disc(g, x, y, r * 0.3, 0x3a2a14, alpha);
}

/** A circle with a wavy edge. */
function wavyRing(g: G, x: number, y: number, r: number, waves: number, amp: number, rot: number, w: number, color: number, alpha: number) {
  if (alpha <= 0 || r <= 0) return;
  const pts = Array.from({ length: 64 }, (_, i) => {
    const a = (i / 64) * TAU;
    const rr = r + Math.sin(a * waves + rot) * amp;
    return { x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr };
  });
  g.lineStyle(w, color, clamp01(alpha)).strokePoints(pts2(pts), true);
}

/** A circle with a zigzag edge, like a roar's shock. */
function zigRing(g: G, x: number, y: number, r: number, n: number, amp: number, w: number, color: number, alpha: number) {
  if (alpha <= 0 || r <= 0) return;
  const pts = Array.from({ length: n * 2 }, (_, i) => {
    const a = (i / (n * 2)) * TAU;
    const rr = r + (i % 2 ? amp : -amp);
    return { x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr };
  });
  g.lineStyle(w, color, clamp01(alpha)).strokePoints(pts2(pts), true);
}

/** Spiral arms turning round a point. */
function spiral(g: G, x: number, y: number, r: number, arms: number, rot: number, w: number, color: number, alpha: number) {
  for (let arm = 0; arm < arms; arm++) {
    const pts = Array.from({ length: 24 }, (_, i) => {
      const k = i / 23;
      const a = rot + (arm / arms) * TAU + k * 3.2;
      return { x: x + Math.cos(a) * r * k, y: y + Math.sin(a) * r * k };
    });
    g.lineStyle(w, color, clamp01(alpha)).strokePoints(pts2(pts), false);
  }
}

/** n parallel claw marks across angle a, each len long. */
function claws(g: G, x: number, y: number, a: number, len: number, n: number, gap: number, w: number, color: number, alpha: number) {
  const dx = Math.cos(a), dy = Math.sin(a);
  const px = -dy, py = dx;
  for (let i = 0; i < n; i++) {
    const o = (i - (n - 1) / 2) * gap;
    const cx = x + px * o, cy = y + py * o;
    // A claw mark bows a little, thin at the ends.
    crescent(g, cx - px * len * 0.6, cy - py * len * 0.6, len * 0.9, a + Math.PI / 2 - 0.55, a + Math.PI / 2 + 0.55, w, color, alpha);
  }
}

/** Points along a path from (x1, y1) to (x2, y2), with a hop of `hop` px at its middle. */
function along(x1: number, y1: number, x2: number, y2: number, k: number, hop = 0) {
  return { x: lerp(x1, x2, k), y: lerp(y1, y2, k) - Math.sin(k * Math.PI) * hop };
}

function dottedPath(g: G, f: SkillShot, hop: number, n: number, size: number, color: number, alpha: number) {
  for (let i = 0; i <= n; i++) {
    const p = along(f.x2, f.y2 - AIR, f.x, f.y - AIR, i / n, hop);
    disc(g, p.x, p.y, size, color, alpha * (0.3 + (0.7 * i) / n));
  }
}

/** Dizzy stars turning over a stunned spot. */
function stunStars(g: G, x: number, y: number, k: number, color: number, alpha: number) {
  for (let i = 0; i < 3; i++) {
    const a = k * TAU * 1.5 + (i / 3) * TAU;
    star(g, x + Math.cos(a) * 16, y - 38 + Math.sin(a) * 6, 6, 2.5, 5, k * 4, color, alpha);
  }
}

/** A paw print pressed into the ground. */
function pawPrint(g: G, x: number, y: number, s: number, a: number, color: number, alpha: number) {
  g.fillStyle(color, clamp01(alpha)).fillEllipse(x, y + s * 0.3, s * 1.3, s);
  for (let i = 0; i < 4; i++) {
    const t = a - 0.9 + i * 0.6;
    disc(g, x + Math.cos(t) * s * 0.95, y + s * 0.3 + Math.sin(t) * s * 0.85, s * 0.24, color, alpha);
  }
}

/** A kite shield standing on (x, y). */
function kiteShield(g: G, x: number, y: number, s: number, fill: number, rim: number, alpha: number) {
  const pts = [
    { x: x - s * 0.5, y: y - s * 1.4 },
    { x: x + s * 0.5, y: y - s * 1.4 },
    { x: x + s * 0.5, y: y - s * 0.7 },
    { x: x, y: y },
    { x: x - s * 0.5, y: y - s * 0.7 },
  ];
  poly(g, pts, fill, alpha);
  g.lineStyle(2, rim, clamp01(alpha)).strokePoints(pts2(pts), true);
}

/** A rune circle: a ring, ticks and a hexagram turning inside. */
function rune(g: G, x: number, y: number, r: number, rot: number, color: number, alpha: number) {
  ring(g, x, y, r, 2, color, alpha);
  ring(g, x, y, r * 0.78, 1, color, alpha * 0.8);
  spokes(g, x, y, r * 0.78, r, 12, rot, 1.5, color, alpha);
  for (const off of [0, Math.PI / 3]) {
    const pts = [0, 1, 2].map((i) => ({ x: x + Math.cos(rot * -1.5 + off + (i * TAU) / 3) * r * 0.7, y: y + Math.sin(rot * -1.5 + off + (i * TAU) / 3) * r * 0.7 }));
    g.lineStyle(1.5, color, clamp01(alpha)).strokePoints(pts2(pts), true);
  }
}

/** A snowflake: six arms with little branches. */
function snowflake(g: G, x: number, y: number, r: number, rot: number, color: number, alpha: number) {
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * TAU) / 6;
    const ex = x + Math.cos(a) * r, ey = y + Math.sin(a) * r;
    line(g, x, y, ex, ey, 2, color, alpha);
    const mx = x + Math.cos(a) * r * 0.6, my = y + Math.sin(a) * r * 0.6;
    for (const s of [-1, 1]) line(g, mx, my, mx + Math.cos(a + s * 0.7) * r * 0.3, my + Math.sin(a + s * 0.7) * r * 0.3, 1.5, color, alpha);
  }
}

/** Ice shards pointing outward round a ring. */
function iceShards(g: G, x: number, y: number, r: number, n: number, len: number, seed: number, alpha: number) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash(seed + i) * 0.3;
    const l = len * (0.7 + hash(seed + i * 2) * 0.6);
    const bx = x + Math.cos(a) * r, by = y + Math.sin(a) * r;
    const tx = bx + Math.cos(a) * l, ty = by + Math.sin(a) * l - l * 0.5;
    const px = -Math.sin(a) * 6, py = Math.cos(a) * 6;
    poly(g, [{ x: bx + px, y: by + py }, { x: tx, y: ty }, { x: bx - px, y: by - py }], 0xe6fbff, alpha);
    g.lineStyle(1, 0x5fc0e8, clamp01(alpha)).strokeTriangle(bx + px, by + py, tx, ty, bx - px, by - py);
  }
}

/** Flame tongues licking up round a point. */
function flames(g: G, x: number, y: number, r: number, n: number, h: number, time: number, seed: number, color: number, core: number, alpha: number) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash(seed + i) * 0.4;
    const bx = x + Math.cos(a) * r, by = y + Math.sin(a) * r * 0.5;
    const hh = h * (0.6 + 0.4 * Math.sin(time / 70 + i * 2.1));
    poly(g, [{ x: bx - 6, y: by }, { x: bx + Math.sin(time / 90 + i) * 4, y: by - hh }, { x: bx + 6, y: by }], color, alpha);
    poly(g, [{ x: bx - 3, y: by }, { x: bx, y: by - hh * 0.55 }, { x: bx + 3, y: by }], core, alpha);
  }
}

// ---------------------------------------------------------------------------------------------
// The casts. `k` runs 0 to 1 over the effect's life, `a` is its fade, `n` a seed for scatter.

type Draw = (L: FxLayers, f: SkillShot, k: number, a: number, n: number) => void;

interface Look {
  /** How long the cast's effect stays on screen. */
  ms: number;
  draw: Draw;
}

const LOOKS: Record<string, Look> = {
  // Warden: an earth-splitting hammer, a shield wall, a bash that dazes, a beacon of gold.
  'warden.Q': {
    ms: 650,
    draw: ({ ground, top }, f, k, a, n) => {
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * TAU + hash(n + i) * 0.5;
        const len = f.r * Math.min(1, k * 3) * (0.6 + hash(n + i * 3) * 0.4);
        jag(ground, f.x, f.y, f.x + Math.cos(ang) * len, f.y + Math.sin(ang) * len, 5, 9, n + i * 11, 3, 0x4a3524, a);
      }
      ring(ground, f.x, f.y, f.r * out(k), 2 + 8 * (1 - k), 0xead6a8, a);
      puffs(ground, f.x, f.y, f.r * out(k), 10, k, n, 16, 0xcdb48a, a);
      disc(top, f.x, f.y - 10, 34 * (1 - k), 0xfff3cf, a);
    },
  },
  'warden.W': {
    ms: 850,
    draw: ({ ground, top }, f, k, a) => {
      const r = f.r * out(Math.min(1, k * 2));
      const hex = (rr: number, dy: number) => Array.from({ length: 6 }, (_, i) => ({ x: f.x + Math.cos((i * TAU) / 6) * rr, y: f.y + Math.sin((i * TAU) / 6) * rr + dy }));
      poly(ground, hex(r, 0), 0x8fd0ff, 0.18 * a);
      ground.lineStyle(3, 0xbfe6ff, a).strokePoints(pts2(hex(r, 0)), true);
      const h = 46 * out(k);
      for (const p of hex(r, 0)) line(top, p.x, p.y, p.x, p.y - h, 3, 0xbfe6ff, a * 0.8);
      top.lineStyle(2, 0xe9f6ff, a * 0.8).strokePoints(pts2(hex(r, -h)), true);
    },
  },
  'warden.E': {
    ms: 600,
    draw: ({ ground, top }, f, k, a) => {
      const ang = Math.atan2(f.y - f.y2, f.x - f.x2);
      for (let i = 0; i < 4; i++) {
        const p = along(f.x2, f.y2, f.x, f.y, (i + 1) / 5);
        const al = a * (0.35 + i * 0.18);
        const c = Math.cos(ang), s = Math.sin(ang);
        ground.lineStyle(5, 0xf2c14e, al).beginPath();
        ground.moveTo(p.x - c * 14 - s * 16, p.y - s * 14 + c * 16);
        ground.lineTo(p.x, p.y);
        ground.lineTo(p.x - c * 14 + s * 16, p.y - s * 14 - c * 16);
        ground.strokePath();
      }
      ring(ground, f.x, f.y, f.r * out(k), 4, 0xf2c14e, a);
      stunStars(top, f.x, f.y, k, 0xffe27a, a);
    },
  },
  'warden.R': {
    ms: 1100,
    draw: ({ ground, top }, f, k, a) => {
      pillar(top, f.x2, f.y2, 18 + 40 * (1 - k), 230, 0xffd76a, a);
      ring(ground, f.x, f.y, f.r * out(k), 6, 0xffd76a, a);
      ring(ground, f.x, f.y, f.r * out(k) * 0.7, 3, 0xfff1b8, a * 0.8);
      spokes(ground, f.x, f.y, f.r * 0.2, f.r * out(k), 16, k * 0.8, 3, 0xffd76a, a * 0.55);
      disc(ground, f.x, f.y, f.r * out(k), 0xffd76a, 0.12 * a);
    },
  },

  // Blade: a gleaming lunge, a whirl of knives, a step through shadow, a falling verdict.
  'blade.Q': {
    ms: 450,
    draw: ({ top }, f, k, a) => {
      line(top, f.x2, f.y2 - AIR, f.x, f.y - AIR, 10 * (1 - k), 0x8e6cf0, a * 0.5);
      line(top, f.x2, f.y2 - AIR, f.x, f.y - AIR, 2, 0xffffff, a);
      const ang = Math.atan2(f.y - f.y2, f.x - f.x2);
      crescent(top, f.x, f.y - AIR, f.r * (0.6 + out(k) * 0.4), ang - Math.PI / 2 - 1, ang - Math.PI / 2 + 1, 12, 0xd9ccff, a);
      crescent(top, f.x, f.y - AIR, f.r * (0.6 + out(k) * 0.4), ang + Math.PI / 2 - 1, ang + Math.PI / 2 + 1, 12, 0xd9ccff, a);
    },
  },
  'blade.W': {
    ms: 600,
    draw: ({ ground, top }, f, k, a) => {
      disc(ground, f.x, f.y, f.r, 0x8e6cf0, 0.12 * a);
      ring(ground, f.x, f.y, f.r, 2, 0xc9b8ff, a * 0.7);
      for (let i = 0; i < 3; i++) {
        const s = (i * TAU) / 3 + out(k) * TAU * 1.6;
        crescent(top, f.x, f.y - 10, f.r * 0.85, s, s + 1.3, 10, 0xc9b8ff, a);
        crescent(top, f.x, f.y - 10, f.r * 0.85, s - 0.9, s, 6, 0x8e6cf0, a * 0.5);
      }
    },
  },
  'blade.E': {
    ms: 650,
    draw: ({ ground, top }, f, k, a, n) => {
      puffs(top, f.x2, f.y2 - AIR, 26, 9, k, n, 18, 0x3a2a5c, a * 1.3);
      // The smoke gathers where it lands, closing in.
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * TAU;
        const d = 40 * (1 - out(k));
        disc(top, f.x + Math.cos(ang) * d, f.y - AIR + Math.sin(ang) * d, 9 * (1 - k * 0.5), 0x5b3f9a, a * 0.7);
      }
      dottedPath(ground, f, 0, 10, 3, 0x8e6cf0, a);
    },
  },
  'blade.R': {
    ms: 800,
    draw: ({ ground, top }, f, k, a) => {
      const drop = out(Math.min(1, k * 3));
      crescent(top, f.x + 30, f.y - 140 + drop * 120, 90, Math.PI * 0.55, Math.PI * 1.05, 16, 0xe7dcff, a);
      star(top, f.x, f.y - 14, f.r * 2.2 * out(k), f.r * 0.5 * out(k), 8, 0.2, 0x8e6cf0, a * 0.8);
      star(top, f.x, f.y - 14, f.r * 1.2 * out(k), f.r * 0.25 * out(k), 8, 0.6, 0xffffff, a);
      ring(ground, f.x, f.y, f.r * 1.4, 4, 0x4b2f8f, a);
    },
  },

  // Archer: a twang of the bow, a triple loose, a roll through leaves, a sky full of arrows.
  'archer.Q': {
    ms: 300,
    draw: ({ top }, f, k, a) => arcStroke(top, f.x, f.y - AIR, 18 + 12 * k, f.a - 0.9, f.a + 0.9, 3, 0xe6f08a, a),
  },
  'archer.W': {
    ms: 350,
    draw: ({ top }, f, k, a) => {
      for (let i = -1; i <= 1; i++) arcStroke(top, f.x, f.y - AIR, 16 + 14 * k, f.a + i * 0.35 - 0.3, f.a + i * 0.35 + 0.3, 2, 0xc8e66a, a);
    },
  },
  'archer.E': {
    ms: 550,
    draw: ({ ground, top }, f, k, a, n) => {
      for (let i = 0; i < 16; i++) {
        const kk = i / 15;
        const p = along(f.x2, f.y2, f.x, f.y, kk);
        const sp = k * 6 + i;
        const ox = Math.cos(sp) * 16, oy = Math.sin(sp) * 10 - 14 - k * 20 * hash(n + i);
        top.fillStyle(i % 2 ? 0x9be05a : 0xe6f08a, clamp01(a * (0.5 + 0.5 * kk))).fillEllipse(p.x + ox, p.y + oy, 14, 6);
      }
      arcStroke(ground, (f.x + f.x2) / 2, (f.y + f.y2) / 2, Math.hypot(f.x - f.x2, f.y - f.y2) / 2, Math.atan2(f.y2 - f.y, f.x2 - f.x), Math.atan2(f.y2 - f.y, f.x2 - f.x) + Math.PI, 2, 0xe6c03a, a * 0.6);
    },
  },
  'archer.R': {
    ms: 500,
    draw: ({ top }, f, k, a) => {
      // The volley climbs from the bow; the zone draws the rain.
      for (let i = 0; i < 5; i++) line(top, f.x2 - 8 + i * 4, f.y2 - 30 - k * 120, f.x2 - 8 + i * 4, f.y2 - 50 - k * 120, 2, 0xe6c03a, a);
    },
  },

  // Mage: a hand of flame, a nova of ice, a rune-to-rune blink, a meteor from the sky.
  'mage.Q': {
    ms: 300,
    draw: ({ top }, f, k, a) => star(top, f.x + Math.cos(f.a) * 16, f.y - AIR + Math.sin(f.a) * 16, 16 * (1 - k * 0.5), 6, 6, k * 2, 0xffa340, a),
  },
  'mage.W': {
    ms: 750,
    draw: ({ ground, top }, f, k, a, n) => {
      disc(ground, f.x, f.y, f.r * out(k), 0xbfefff, 0.22 * a);
      ring(ground, f.x, f.y, f.r * out(k), 3, 0x9fe4ff, a);
      iceShards(top, f.x, f.y, f.r * out(k) * 0.8, 14, 22, n, a);
      snowflake(top, f.x, f.y - 34, 20, k * 1.2, 0xe6fbff, a);
    },
  },
  'mage.E': {
    ms: 600,
    draw: ({ ground, top }, f, k, a, n) => {
      rune(ground, f.x2, f.y2, 34 * (1 - k * 0.7), k * 3, 0xb68cff, a);
      rune(ground, f.x, f.y, 34 * out(k), -k * 3, 0x3fd0d9, a);
      for (let i = 0; i < 8; i++) {
        const p = along(f.x2, f.y2 - AIR, f.x, f.y - AIR, hash(n + i));
        star(top, p.x, p.y - hash(n + i * 3) * 20, 5, 1.5, 4, 0, 0xdff9ff, a * (0.5 + 0.5 * Math.sin(k * 9 + i)));
      }
    },
  },
  'mage.R': {
    ms: 950,
    draw: ({ ground, top }, f, k, _a, n) => {
      const fall = clamp01(k / 0.25);
      if (fall < 1) {
        const mx = lerp(f.x - 170, f.x, fall), my = lerp(f.y - 340, f.y, fall);
        for (let i = 1; i <= 6; i++) disc(top, mx - i * 12, my - i * 24, 16 - i * 2, i % 2 ? 0xffa340 : 0xffd46a, 0.8);
        disc(top, mx, my, 18, 0x5a3424, 1);
        disc(top, mx - 4, my - 4, 10, 0xff7a2a, 1);
        return;
      }
      const k2 = (k - 0.25) / 0.75, a2 = 1 - k2;
      disc(ground, f.x, f.y, f.r, 0x2a1408, 0.35 * a2);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * TAU + hash(n + i);
        jag(ground, f.x, f.y, f.x + Math.cos(ang) * f.r * 0.9, f.y + Math.sin(ang) * f.r * 0.9, 5, 10, n + i * 5, 3, 0xff5a1e, a2);
      }
      disc(top, f.x, f.y - 10, f.r * 0.8 * out(k2), 0xff8a2a, 0.45 * a2);
      disc(top, f.x, f.y - 10, f.r * 0.45 * out(k2), 0xffe08a, 0.6 * a2);
      ring(ground, f.x, f.y, f.r * out(k2), 6, 0xffa340, a2);
      burstDots(top, f.x, f.y - 20, f.r * 1.1, 18, k2, n, 5, 0xffc04a, a2);
    },
  },

  // Priest: a glint of judgement, healing motes, a ring of warding sigils, a sun on the ground.
  'priest.Q': {
    ms: 300,
    draw: ({ top }, f, k, a) => star(top, f.x, f.y - 46, 14 * (1 - k * 0.5), 3, 4, k, 0xfff1b8, a),
  },
  'priest.W': {
    ms: 950,
    draw: ({ ground, top }, f, k, a, n) => {
      disc(ground, f.x, f.y, f.r, 0x7fe08a, 0.14 * a);
      ring(ground, f.x, f.y, f.r * (0.85 + 0.15 * out(k)), 3, 0x9af0b0, a);
      rising(top, f.x, f.y, f.r * 0.9, 14, k, n, 4, 70, 0xb8ffc8, a, 'diamond');
      rising(top, f.x, f.y, f.r * 0.7, 5, k, n + 50, 5, 60, 0x62d86f, a, 'plus');
    },
  },
  'priest.E': {
    ms: 850,
    draw: ({ ground, top }, f, k, a) => {
      disc(ground, f.x, f.y, f.r, 0xcfe8ff, 0.12 * a);
      ring(ground, f.x, f.y, f.r, 2, 0xcfe8ff, a);
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + k * Math.PI;
        const px = f.x + Math.cos(ang) * f.r * 0.8, py = f.y + Math.sin(ang) * f.r * 0.8 - 18 - out(k) * 12;
        poly(top, [{ x: px, y: py - 10 }, { x: px + 6, y: py }, { x: px, y: py + 10 }, { x: px - 6, y: py }], 0xe9f6ff, a);
      }
    },
  },
  'priest.R': {
    ms: 1300,
    draw: ({ ground, top }, f, k, a, n) => {
      disc(ground, f.x, f.y, f.r, 0xffe9a0, 0.14 * a);
      ring(ground, f.x, f.y, f.r, 4, 0xffe08a, a);
      spokes(ground, f.x, f.y, f.r * 0.15, f.r * 0.95, 24, k * 0.6, 3, 0xffe08a, a * 0.5);
      pillar(top, f.x, f.y, 60, 280, 0xfff1b8, a * 0.8);
      top.lineStyle(4, 0xffe08a, clamp01(a)).strokeEllipse(f.x, f.y - 130 - out(k) * 20, 70, 22);
      rising(top, f.x, f.y, f.r * 0.9, 18, k, n, 3, 90, 0xffe08a, a);
    },
  },

  // Berserker: a great axe sweep, a burst of rage, a crashing leap, a roaring rampage.
  'berserker.Q': {
    ms: 500,
    draw: ({ ground, top }, f, k, a) => {
      ring(ground, f.x, f.y, f.r, 2, 0xff8a3d, a * 0.6);
      const s = f.a - Math.PI + out(k) * TAU;
      crescent(top, f.x, f.y - 10, f.r * 0.85, s - 2, s, 20, 0xff8a3d, a * 0.55);
      crescent(top, f.x, f.y - 10, f.r * 0.85, s - 0.9, s, 14, 0xffe0b0, a);
    },
  },
  'berserker.W': {
    ms: 700,
    draw: ({ ground, top }, f, k, a, n) => {
      ring(ground, f.x, f.y, 30 + 30 * out(k), 4, 0xff4a2a, a);
      flames(top, f.x, f.y, 22, 8, 40 * (1 - k * 0.5), k * 1000, n, 0xff4a2a, 0xffb36a, a);
    },
  },
  'berserker.E': {
    ms: 600,
    draw: ({ ground, top }, f, k, a, n) => {
      dottedPath(top, f, 90, 14, 3, 0xffb36a, a);
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * TAU + hash(n + i);
        jag(ground, f.x, f.y, f.x + Math.cos(ang) * f.r * 0.9, f.y + Math.sin(ang) * f.r * 0.9, 4, 7, n + i * 9, 3, 0x4a3524, a);
      }
      ring(ground, f.x, f.y, f.r * out(k), 5, 0xd9b48a, a);
      puffs(ground, f.x, f.y, f.r * out(k), 8, k, n, 14, 0xc9a77a, a);
    },
  },
  'berserker.R': {
    ms: 1000,
    draw: ({ ground, top }, f, k, a, n) => {
      zigRing(ground, f.x, f.y, 40 + 140 * out(k), 14, 10, 5, 0xc0281e, a);
      disc(top, f.x, f.y - 30, 44 * (1 - k * 0.4), 0xff3a1e, 0.28 * a);
      rising(top, f.x, f.y, 60, 24, k, n, 3, 110, 0xff6a3a, a);
    },
  },

  // Harpooner: a splash of spray, a tide that shoves, a bubble of water, a whirlpool.
  'harpooner.Q': {
    ms: 300,
    draw: ({ top }, f, k, a, n) => burstDots(top, f.x + Math.cos(f.a) * 16, f.y - AIR, 22, 8, k, n, 3, 0x9fe8ff, a),
  },
  'harpooner.W': {
    ms: 750,
    draw: ({ ground, top }, f, k, a, n) => {
      for (let i = 0; i < 3; i++) {
        const kk = clamp01(k * 1.4 - i * 0.2);
        wavyRing(ground, f.x, f.y, f.r * out(kk), 10, 5, kk * 6, 4 - i, i ? 0x6fd3ff : 0xffffff, a * (1 - kk * 0.5));
      }
      for (let i = 0; i < 16; i++) {
        const ang = hash(n + i) * TAU;
        const d = f.r * out(k) * (0.6 + 0.4 * hash(n + i * 2));
        const up = Math.sin(k * Math.PI) * (20 + 20 * hash(n + i * 3));
        disc(top, f.x + Math.cos(ang) * d, f.y + Math.sin(ang) * d - up, 3, 0xbff2ff, a);
      }
    },
  },
  'harpooner.E': {
    ms: 700,
    draw: ({ top }, f, k, a) => {
      disc(top, f.x, f.y - 24, 40 * out(k), 0x7fe8ff, 0.18 * a);
      wavyRing(top, f.x, f.y - 24, 40 * out(k), 6, 3, k * 8, 3, 0x7fe8ff, a);
      arcStroke(top, f.x - 10, f.y - 38, 12, Math.PI * 1.1, Math.PI * 1.6, 3, 0xffffff, a);
    },
  },
  'harpooner.R': {
    ms: 450,
    draw: ({ ground }, f, k, a) => wavyRing(ground, f.x, f.y, f.r * out(k), 8, 8, k * 8, 4, 0x9fe8ff, a),
  },

  // Witch: a puff of hex, a bubbling blight, brambles from the ground, a plague fog.
  'witch.Q': {
    ms: 300,
    draw: ({ top }, f, k, a, n) => puffs(top, f.x + Math.cos(f.a) * 16, f.y - AIR, 12, 5, k, n, 8, 0xc55fae, a * 1.4),
  },
  'witch.W': {
    ms: 450,
    draw: ({ ground }, f, k, a, n) => burstDots(ground, f.x, f.y, f.r, 12, k, n, 5, 0x9be05a, a),
  },
  'witch.E': {
    ms: 1000,
    draw: ({ ground, top }, f, k, a, n) => {
      const grow = out(Math.min(1, k * 2.5));
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * TAU + hash(n + i);
        const pts = Array.from({ length: 10 }, (_, j) => {
          const t = (j / 9) * grow;
          const aa = ang + t * 1.6;
          return { x: f.x + Math.cos(aa) * f.r * t, y: f.y + Math.sin(aa) * f.r * t };
        });
        ground.lineStyle(7, 0x2d3f14, clamp01(a)).strokePoints(pts2(pts), false);
        ground.lineStyle(3.5, 0xa8d060, clamp01(a)).strokePoints(pts2(pts), false);
      }
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * TAU + 0.3;
        const bx = f.x + Math.cos(ang) * f.r * 0.7, by = f.y + Math.sin(ang) * f.r * 0.7;
        const h = 28 * grow * (0.7 + 0.3 * hash(n + i));
        poly(top, [{ x: bx - 6, y: by }, { x: bx + (hash(n + i * 4) - 0.5) * 8, y: by - h }, { x: bx + 6, y: by }], 0x2d3f14, a);
        poly(top, [{ x: bx - 3, y: by }, { x: bx + (hash(n + i * 4) - 0.5) * 8, y: by - h + 3 }, { x: bx + 3, y: by }], 0xc6e070, a);
      }
    },
  },
  'witch.R': {
    ms: 500,
    draw: ({ ground }, f, k, a, n) => puffs(ground, f.x, f.y, f.r, 12, k, n, 34, 0x6a2f6a, a * 1.2),
  },

  // Stalker: a flick of the wrist, a smoke bomb, a pounce, a mark of death.
  'stalker.Q': {
    ms: 280,
    draw: ({ top }, f, k, a) => {
      for (let i = -1; i <= 1; i++) line(top, f.x, f.y - AIR, f.x + Math.cos(f.a + i * 0.25) * (20 + k * 20), f.y - AIR + Math.sin(f.a + i * 0.25) * (20 + k * 20), 2, 0xe9eef5, a);
    },
  },
  'stalker.W': {
    ms: 900,
    draw: ({ top }, f, k, a, n) => {
      puffs(top, f.x, f.y - 16, 40, 12, k, n, 22, 0x9aa3ad, a * 1.4);
      puffs(top, f.x, f.y - 26, 26, 6, k, n + 30, 16, 0xc9d0d8, a * 1.2);
      for (let i = 0; i < 5; i++) star(top, f.x + (hash(n + i) - 0.5) * 70, f.y - 16 - hash(n + i * 2) * 50, 5, 1.5, 4, 0, 0xffffff, a * Math.abs(Math.sin(k * 8 + i)));
    },
  },
  'stalker.E': {
    ms: 500,
    draw: ({ ground, top }, f, k, a) => {
      dottedPath(top, f, 40, 10, 2.5, 0xcfd6e0, a);
      const ang = Math.atan2(f.y - f.y2, f.x - f.x2);
      claws(top, f.x, f.y - AIR, ang, 26 + 10 * out(k), 2, 10, 6, 0xf0e27a, a);
      ring(ground, f.x, f.y, f.r * out(k), 3, 0xcfd6e0, a);
      stunStars(top, f.x, f.y, k, 0xe9eef5, a * 0.8);
    },
  },
  'stalker.R': {
    ms: 450,
    draw: ({ top }, f, k, a) => {
      const px = f.x + Math.cos(f.a) * 22, py = f.y - AIR + Math.sin(f.a) * 22;
      const s = 14 + 10 * k;
      top.lineStyle(2, 0x9c6cff, clamp01(a)).strokePoints(pts2([{ x: px, y: py - s }, { x: px + s, y: py }, { x: px, y: py + s }, { x: px - s, y: py }]), true);
    },
  },

  // Lancer: a gust, a full sweep that throws back, a vault, a wall of shields.
  'lancer.Q': {
    ms: 280,
    draw: ({ top }, f, k, a) => {
      for (const o of [-8, 8]) {
        const px = -Math.sin(f.a) * o, py = Math.cos(f.a) * o;
        line(top, f.x + px, f.y - AIR + py, f.x + px + Math.cos(f.a) * (30 + 30 * k), f.y - AIR + py + Math.sin(f.a) * (30 + 30 * k), 2, 0xf4f1e8, a);
      }
    },
  },
  'lancer.W': {
    ms: 650,
    draw: ({ ground, top }, f, k, a) => {
      const end = f.a + out(k) * TAU;
      arcStroke(top, f.x, f.y - 12, f.r * 0.9, f.a, end, 4, 0xe9eef5, a * 0.6);
      crescent(top, f.x, f.y - 12, f.r * 0.9, end - 0.8, end, 12, 0xffffff, a);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * TAU;
        const d = f.r * out(k);
        const cx = f.x + Math.cos(ang) * d, cy = f.y + Math.sin(ang) * d;
        const c = Math.cos(ang), s = Math.sin(ang);
        ground.lineStyle(4, 0xd8cfb4, clamp01(a)).beginPath();
        ground.moveTo(cx - c * 10 - s * 10, cy - s * 10 + c * 10);
        ground.lineTo(cx, cy);
        ground.lineTo(cx - c * 10 + s * 10, cy - s * 10 - c * 10);
        ground.strokePath();
      }
    },
  },
  'lancer.E': {
    ms: 650,
    draw: ({ ground, top }, f, k, a, n) => {
      const pts = Array.from({ length: 16 }, (_, i) => along(f.x2, f.y2 - AIR, f.x, f.y - AIR, (i / 15) * Math.min(1, k * 2), 120));
      top.lineStyle(4, 0xd84a3a, clamp01(a * 0.7)).strokePoints(pts2(pts), false);
      top.lineStyle(1.5, 0xf4f1e8, clamp01(a)).strokePoints(pts2(pts), false);
      if (k > 0.4) {
        const kk = (k - 0.4) / 0.6;
        ring(ground, f.x, f.y, f.r * out(kk), 4, 0xd8cfb4, a);
        puffs(ground, f.x, f.y, f.r * 0.7, 5, kk, n, 14, 0xcdb48a, a);
      }
    },
  },
  'lancer.R': {
    ms: 1150,
    draw: ({ ground, top }, f, k, a) => {
      disc(ground, f.x, f.y, f.r, 0xf2c14e, 0.14 * a);
      ring(ground, f.x, f.y, f.r, 4, 0xf2c14e, a);
      const rise = out(Math.min(1, k * 2));
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * TAU;
        kiteShield(top, f.x + Math.cos(ang) * f.r * 0.8, f.y + Math.sin(ang) * f.r * 0.8 - 6 * out(k), 20 * rise, 0xd8cfb4, 0xf2c14e, a);
      }
      // A great banded shield rises over the lancer.
      kiteShield(top, f.x, f.y - 60 - 20 * out(k), 26 * rise, 0xf2c14e, 0xffffff, a);
    },
  },

  // Gunslinger: muzzle flashes, a smoke bomb, a dusty roll, the dead-eye sight.
  'gunslinger.Q': {
    ms: 260,
    draw: ({ top }, f, k, a) => {
      for (let i = 0; i < 3; i++) {
        const kk = clamp01(k * 3 - i);
        if (kk <= 0 || kk >= 1) continue;
        star(top, f.x + Math.cos(f.a) * 20, f.y - AIR + Math.sin(f.a) * 20, 13 * (1 - kk), 4, 6, i, 0xffe27a, Math.max(a, 0.6));
      }
    },
  },
  'gunslinger.W': {
    ms: 400,
    draw: ({ top }, f, k, a, n) => burstDots(top, f.x, f.y - 10, f.r * 0.6, 10, k, n, 4, 0xffe27a, a),
  },
  'gunslinger.E': {
    ms: 550,
    draw: ({ ground, top }, f, k, a, n) => {
      const ang = Math.atan2(f.y - f.y2, f.x - f.x2);
      for (const o of [-7, 7]) {
        const px = -Math.sin(ang) * o, py = Math.cos(ang) * o;
        line(ground, f.x2 + px, f.y2 + py, f.x + px, f.y + py, 2.5, 0x5a3e24, a * 0.8);
      }
      for (let i = 0; i < 5; i++) {
        const p = along(f.x2, f.y2, f.x, f.y, i / 4);
        puffs(top, p.x, p.y - 8, 10, 2, k, n + i * 5, 12, 0xc9a77a, a * 1.2);
      }
    },
  },
  'gunslinger.R': {
    ms: 650,
    draw: ({ top }, f, k, a) => {
      const r = 26 - 10 * out(k);
      const cx = f.x + Math.cos(f.a) * 34, cy = f.y - AIR + Math.sin(f.a) * 34;
      ring(top, cx, cy, r, 2, 0xffd76a, a);
      // Ticks outside the sight ring only.
      spokes(top, cx, cy, r + 3, r + 10, 4, Math.PI / 4, 2, 0xffd76a, a);
      star(top, f.x + Math.cos(f.a) * 18, f.y - AIR + Math.sin(f.a) * 18, 18 * (1 - k), 5, 8, 0, 0xfff1b8, a);
    },
  },

  // Automaton: jets of steam, spinning gears, a fist launch, an electric overload.
  'automaton.Q': {
    ms: 750,
    draw: ({ ground, top }, f, k, a, n) => {
      ring(ground, f.x, f.y, f.r * out(k), 3, 0xd8a24a, a * 0.8);
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * TAU + 0.2;
        for (let j = 0; j < 4; j++) {
          const d = f.r * out(k) * (0.3 + j * 0.22);
          disc(top, f.x + Math.cos(ang) * d, f.y - 10 + Math.sin(ang) * d - j * 4 * k, 8 + j * 3 + 6 * k, 0xeef3f6, a * (0.55 - j * 0.1));
        }
      }
      burstDots(top, f.x, f.y - 10, 30, 6, k, n, 3, 0xffffff, a);
    },
  },
  'automaton.W': {
    ms: 750,
    draw: ({ top }, f, k, a, n) => {
      gear(top, f.x - 26, f.y - 46, 13 * out(Math.min(1, k * 3)), 8, k * 6, 0xd8a24a, a);
      gear(top, f.x + 24, f.y - 40, 10 * out(Math.min(1, k * 3)), 7, -k * 8, 0xb88a3a, a);
      burstDots(top, f.x, f.y - 30, 40, 10, k, n, 2.5, 0xffe27a, a);
    },
  },
  'automaton.E': {
    ms: 320,
    draw: ({ top }, f, k, a, n) => puffs(top, f.x - Math.cos(f.a) * 10, f.y - AIR, 14, 6, k, n, 10, 0xbfc6cc, a * 1.3),
  },
  'automaton.R': {
    ms: 950,
    draw: ({ ground, top }, f, k, a, n) => {
      disc(ground, f.x, f.y, f.r * out(k), 0x1e2a3a, 0.25 * a);
      ring(ground, f.x, f.y, f.r * out(k), 4, 0xd8a24a, a);
      const flick = Math.floor(k * 14);
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * TAU + hash(n + i) * 0.5;
        const d = f.r * out(k);
        jag(top, f.x, f.y - 24, f.x + Math.cos(ang) * d, f.y + Math.sin(ang) * d - 10, 7, 14, n + i * 13 + flick * 101, 4, 0x6fd8ff, a * 0.6);
        jag(top, f.x, f.y - 24, f.x + Math.cos(ang) * d, f.y + Math.sin(ang) * d - 10, 7, 14, n + i * 13 + flick * 101, 1.5, 0xffffff, a);
      }
      disc(top, f.x, f.y - 24, 30 * (1 - k), 0xe9fbff, a);
    },
  },

  // Tinker: a spark, a coil pylon, jetpack flames, a storm cloud.
  'tinker.Q': {
    ms: 260,
    draw: ({ top }, f, k, a, n) => {
      for (let i = 0; i < 4; i++) {
        const ang = f.a + (i - 1.5) * 0.5;
        jag(top, f.x, f.y - AIR, f.x + Math.cos(ang) * 26 * (0.6 + 0.4 * k), f.y - AIR + Math.sin(ang) * 26 * (0.6 + 0.4 * k), 3, 5, n + i, 1.5, 0x9ff4ff, a);
      }
    },
  },
  'tinker.W': {
    ms: 400,
    draw: ({ ground }, f, k, a) => ring(ground, f.x, f.y, f.r * out(k), 4, 0x5fd3f0, a),
  },
  'tinker.E': {
    ms: 650,
    draw: ({ top }, f, k, a, n) => {
      const ang = Math.atan2(f.y - f.y2, f.x - f.x2);
      for (const o of [-7, 7]) {
        const px = -Math.sin(ang) * o, py = Math.cos(ang) * o;
        line(top, f.x2 + px, f.y2 - 30 + py, f.x + px, f.y - 30 + py, 6, 0xff8a2a, a * 0.5);
        line(top, f.x2 + px, f.y2 - 30 + py, f.x + px, f.y - 30 + py, 2, 0xffe08a, a);
      }
      puffs(top, f.x2, f.y2 - 10, 20, 7, k, n, 14, 0x9aa3ad, a * 1.2);
      puffs(top, f.x, f.y - 6, 16, 5, k, n + 9, 11, 0xbfc6cc, a);
    },
  },
  'tinker.R': {
    ms: 500,
    draw: ({ top }, f, k, a) => {
      for (let i = 0; i < 5; i++) disc(top, f.x + (i - 2) * 40 * out(k), f.y - 170, 36 * out(k), 0x3a4256, 0.5 * a);
    },
  },

  // Wolfkin: a lunge that rakes, a howl, a ring of claws, a blood moon.
  'wolfkin.Q': {
    ms: 500,
    draw: ({ ground, top }, f, k, a) => {
      const ang = Math.atan2(f.y - f.y2, f.x - f.x2);
      for (const o of [-14, 0, 14]) {
        const px = -Math.sin(ang) * o, py = Math.cos(ang) * o;
        line(ground, f.x2 + px, f.y2 + py, f.x + px, f.y + py, 2, 0xcfd6e0, a * 0.6);
      }
      claws(top, f.x, f.y - AIR, ang + 0.6, 30 + 8 * out(k), 3, 9, 5, 0xffffff, a);
    },
  },
  'wolfkin.W': {
    ms: 950,
    draw: ({ top }, f, k, a) => {
      for (let i = 0; i < 4; i++) {
        const kk = clamp01(k * 1.5 - i * 0.18);
        if (kk <= 0) continue;
        arcStroke(top, f.x, f.y - 50, 14 + 90 * kk, -Math.PI / 2 - 0.8, -Math.PI / 2 + 0.8, 4, 0xdfe8ff, a * (1 - kk));
      }
      disc(top, f.x, f.y - 50, 10 * (1 - k), 0xffffff, a);
    },
  },
  'wolfkin.E': {
    ms: 600,
    draw: ({ ground, top }, f, k, a) => {
      ring(ground, f.x, f.y, f.r, 2, 0x9aa3ad, a * 0.6);
      for (let i = 0; i < 6; i++) {
        if (i / 6 > k * 2) continue;
        const ang = (i / 6) * TAU + f.a;
        claws(top, f.x + Math.cos(ang) * f.r * 0.65, f.y - 12 + Math.sin(ang) * f.r * 0.65, ang + Math.PI / 2, 22, 3, 7, 4, 0xf4f1e8, a);
      }
    },
  },
  'wolfkin.R': {
    ms: 1150,
    draw: ({ ground, top }, f, k, a) => {
      const my = f.y - 70 - 50 * out(k);
      disc(top, f.x, my, 40, 0xff3a3a, 0.2 * a);
      disc(top, f.x, my, 26, 0xd8343a, a);
      disc(top, f.x + 9, my - 6, 22, 0x5a1420, a * 0.85);
      for (let i = 0; i < 3; i++) ring(ground, f.x, f.y, 30 + ((k * 3 + i) % 3) * 40, 3, 0xd8343a, a * 0.6);
    },
  },

  // Bruin: a paw swipe, a roar, a stampede, the wrath of the earth.
  'bruin.Q': {
    ms: 550,
    draw: ({ ground, top }, f, k, a) => {
      pawPrint(ground, f.x, f.y, 26, -Math.PI / 2, 0x3a2414, a * 0.6);
      const left = clamp01(k * 2), right = clamp01(k * 2 - 0.5);
      if (left > 0 && left < 1) claws(top, f.x - 20, f.y - 26, f.a + 0.9, 40, 4, 10, 7, 0xf0d6b0, 1 - left);
      if (right > 0 && right < 1) claws(top, f.x + 20, f.y - 26, f.a - 0.9, 40, 4, 10, 7, 0xf0d6b0, 1 - right);
    },
  },
  'bruin.W': {
    ms: 850,
    draw: ({ ground, top }, f, k, a) => {
      for (let i = 0; i < 3; i++) {
        const kk = clamp01(k * 1.4 - i * 0.2);
        zigRing(ground, f.x, f.y, f.r * out(kk), 16, 8, 4, 0xd9a66a, a * (1 - kk * 0.6));
      }
      spokes(top, f.x, f.y - 36, 26 + 40 * out(k), 38 + 40 * out(k), 10, 0.3, 3, 0xffe0b0, a);
    },
  },
  'bruin.E': {
    ms: 650,
    draw: ({ ground, top }, f, k, a, n) => {
      for (let i = 0; i < 6; i++) {
        const p = along(f.x2, f.y2, f.x, f.y, i / 5);
        puffs(ground, p.x, p.y, 16, 3, k, n + i * 7, 18, 0x8a6a4a, a * 1.3);
      }
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + hash(n + i);
        jag(ground, f.x, f.y, f.x + Math.cos(ang) * f.r * 0.8, f.y + Math.sin(ang) * f.r * 0.8, 4, 6, n + i * 3, 3, 0x4a3524, a);
      }
      stunStars(top, f.x, f.y, k, 0xffc46a, a);
    },
  },
  // Falconer: the falcon loosed, a hawk circling over its prey, a step on a gust of feathers, the
  // royal stoop from the sky.
  'falconer.Q': {
    ms: 300,
    draw: ({ top }, f, k, a) => {
      for (const sd of [-1, 1]) arcStroke(top, f.x, f.y - AIR, 14 + 12 * k, f.a + sd * 0.4 - 0.5, f.a + sd * 0.4 + 0.5, 2, 0xe8e2d0, a);
    },
  },
  'falconer.W': {
    ms: 450,
    draw: ({ ground }, f, k, a) => ring(ground, f.x, f.y, f.r * out(k), 3, 0xc9a46a, a),
  },
  'falconer.E': {
    ms: 600,
    draw: ({ ground, top }, f, k, a, n) => {
      dottedPath(ground, f, 0, 6, 3, 0xe8e2d0, a * 0.7);
      for (let i = 0; i < 7; i++) {
        const t = hash(n + i), ang = hash(n + i * 5) * TAU;
        const fx = lerp(f.x2, f.x, t) + Math.cos(ang) * 14 * k, fy = lerp(f.y2, f.y, t) - 18 - 20 * k + Math.sin(ang) * 8;
        poly(top, [{ x: fx, y: fy - 4 }, { x: fx + 2, y: fy }, { x: fx, y: fy + 5 }, { x: fx - 2, y: fy }], 0xe8e2d0, a);
      }
    },
  },
  'falconer.R': {
    ms: 900,
    draw: ({ ground, top }, f, k, _a, n) => {
      const fall = clamp01(k / 0.3);
      if (fall < 1) {
        // The falcon stoops out of the sky, wings folded, trailing a gold streak.
        const fx = lerp(f.x - 120, f.x, fall), fy = lerp(f.y - 360, f.y - AIR, fall);
        line(top, fx - 40, fy - 120, fx, fy, 6, 0xf2c14e, 0.35);
        poly(top, [{ x: fx, y: fy + 10 }, { x: fx - 7, y: fy - 8 }, { x: fx + 7, y: fy - 8 }], 0x8a5d36, 1);
        disc(top, fx, fy - 9, 4, 0xefe6cf, 1);
        ring(ground, f.x, f.y, f.r, 2, 0xf2c14e, 0.5 * fall);
        return;
      }
      const k2 = (k - 0.3) / 0.7, a2 = 1 - k2;
      disc(ground, f.x, f.y, f.r * out(k2), 0xc9a46a, 0.25 * a2);
      ring(ground, f.x, f.y, f.r * out(k2), 4, 0xf2c14e, a2);
      burstDots(top, f.x, f.y - 10, f.r * 0.8, 14, k2, n, 3, 0xe8e2d0, a2);
      stunStars(top, f.x, f.y - 40, k2, 0xf2c14e, a2);
    },
  },

  // Alchemist: a flask that shatters into acid, a tonic's green mist, a smoke bomb, the grand mixture.
  'alchemist.Q': {
    ms: 500,
    draw: ({ ground, top }, f, k, a, n) => {
      const fly = clamp01(k / 0.4);
      if (fly < 1) {
        const fx = lerp(f.x2, f.x, fly), fy = lerp(f.y2, f.y, fly) - AIR - Math.sin(fly * Math.PI) * 60;
        disc(top, fx, fy, 5, 0x9be15d, 1);
        disc(top, fx - 1.5, fy - 1.5, 2, 0xffffff, 0.9);
        return;
      }
      const k2 = (k - 0.4) / 0.6;
      burstDots(ground, f.x, f.y, f.r * 0.7, 10, k2, n, 3, 0xd8ffb0, a);
      ring(ground, f.x, f.y, f.r * out(k2), 3, 0x9be15d, a);
    },
  },
  'alchemist.W': {
    ms: 900,
    draw: ({ ground, top }, f, k, a, n) => {
      disc(ground, f.x, f.y, f.r, 0x9be15d, 0.12 * a);
      ring(ground, f.x, f.y, f.r * (0.85 + 0.15 * out(k)), 3, 0xc7f59a, a);
      rising(top, f.x, f.y, f.r * 0.8, 12, k, n, 4, 60, 0xd8ffb0, a, 'dot');
      rising(top, f.x, f.y, f.r * 0.6, 4, k, n + 40, 5, 50, 0x6fd06a, a, 'plus');
    },
  },
  'alchemist.E': {
    ms: 800,
    draw: ({ top }, f, k, a, n) => {
      puffs(top, f.x, f.y - 14, 26 + 30 * out(k), 9, k, n, 18, 0x8f96a3, a);
      puffs(top, f.x, f.y - 24, 18 + 20 * out(k), 6, k, n + 21, 14, 0xc79bff, a * 0.6);
    },
  },
  'alchemist.R': {
    ms: 1000,
    draw: ({ ground, top }, f, k, a, n) => {
      const fly = clamp01(k / 0.3);
      if (fly < 1) {
        const fx = lerp(f.x2, f.x, fly), fy = lerp(f.y2, f.y, fly) - AIR - Math.sin(fly * Math.PI) * 120;
        disc(top, fx, fy, 9, 0xc79bff, 1);
        disc(top, fx, fy - 9, 3, 0xb88a5a, 1);
        return;
      }
      const k2 = (k - 0.3) / 0.7, a2 = 1 - k2;
      disc(ground, f.x, f.y, f.r * out(k2), 0x6a3aa8, 0.25 * a2);
      wavyRing(ground, f.x, f.y, f.r * out(k2), 9, 8, k2 * 3, 4, 0xc79bff, a2);
      ring(ground, f.x, f.y, f.r * 0.7 * out(k2), 3, 0x9be15d, a2);
      puffs(top, f.x, f.y - 20, f.r * 0.6 * out(k2), 12, k2, n, 22, 0x9be15d, 0.5 * a);
      burstDots(top, f.x, f.y - 30, f.r * 0.7, 16, k2, n + 7, 4, 0xe9d6ff, a2);
    },
  },
  'bruin.R': {
    ms: 1050,
    draw: ({ ground, top }, f, k, a, n) => {
      disc(ground, f.x, f.y, 90 * out(k), 0xa0683a, 0.25 * a);
      zigRing(ground, f.x, f.y, 90 * out(k), 12, 8, 4, 0xd9a66a, a);
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * TAU;
        const bx = f.x + Math.cos(ang) * 70, by = f.y + Math.sin(ang) * 70;
        const h = 34 * out(Math.min(1, k * 2.5)) * (0.7 + 0.3 * hash(n + i));
        poly(top, [{ x: bx - 9, y: by }, { x: bx, y: by - h }, { x: bx + 9, y: by }], 0x7a6a5a, a);
        poly(top, [{ x: bx, y: by }, { x: bx, y: by - h }, { x: bx + 9, y: by }], 0x5a4a3a, a);
      }
    },
  },
};

/** How long a cast's effect stays on screen. */
export function skillMs(look: string): number {
  if (look.endsWith('>hit')) return 380;
  return LOOKS[look]?.ms ?? 500;
}

/** Draws a cast's effect `k` (0 to 1) of the way through its life. */
export function drawSkill(L: FxLayers, f: SkillShot, k: number) {
  const n = Math.floor(f.x * 7 + f.y * 13) % 997;
  const a = 1 - k * k;
  if (f.look.endsWith('>hit')) return drawHit(L, f, k, a, n);
  const look = LOOKS[f.look];
  if (look) look.draw(L, f, k, a, n);
  else ring(L.ground, f.x, f.y, Math.max(20, f.r) * out(k), 4, 0xffffff, a);
}

// ---------------------------------------------------------------------------------------------
// Bolts in flight and where they hit.

/** Draws a bolt in flight. `owner` is the thrower, for a harpoon's rope. */
export function drawProjectile(g: G, p: Projectile, time: number, owner: { x: number; y: number } | null) {
  const speed = Math.hypot(p.vx, p.vy) || 1;
  const dx = p.vx / speed, dy = p.vy / speed;
  const px = -dy, py = dx;
  const x = p.x, y = p.y - AIR;
  const back = (d: number) => ({ x: x - dx * d, y: y - dy * d });
  switch (p.look) {
    case 'archer.Q':
    case 'archer.W': {
      const big = p.look === 'archer.Q';
      const len = big ? 30 : 20;
      if (big) line(g, x - dx * 90, y - dy * 90, x - dx * len, y - dy * len, 2, 0xe6f08a, 0.3);
      line(g, x - dx * len, y - dy * len, x, y, 2.5, 0x6a4a2a, 1);
      poly(g, [{ x: x + dx * 8, y: y + dy * 8 }, { x: x + px * 4, y: y + py * 4 }, { x: x - px * 4, y: y - py * 4 }], 0xdfe6ee, 1);
      const t = back(len);
      for (const s of [-1, 1]) line(g, t.x, t.y, t.x - dx * 7 + px * 5 * s, t.y - dy * 7 + py * 5 * s, 2, big ? 0xe6c03a : 0xa9d86a, 1);
      return;
    }
    case 'mage.Q': {
      for (let i = 6; i >= 1; i--) {
        const b = back(i * 8);
        const wob = Math.sin(time / 40 + i) * 2;
        disc(g, b.x + px * wob, b.y + py * wob, 11 - i * 1.4, i % 2 ? 0xff7a2a : 0xffb347, 0.75 - i * 0.1);
      }
      disc(g, x, y, 11, 0xff7a2a, 1);
      disc(g, x + dx * 2, y + dy * 2, 6, 0xffe08a, 1);
      return;
    }
    case 'priest.Q':
      disc(g, x, y, 15, 0xffe08a, 0.3);
      star(g, x, y, 16, 4, 4, time / 120, 0xfff1b8, 0.9);
      disc(g, x, y, 7, 0xffffff, 1);
      line(g, x - dx * 30, y - dy * 30, x, y, 3, 0xffe08a, 0.5);
      return;
    case 'harpooner.Q': {
      const t = back(30);
      if (owner) {
        // The rope sags a little between the hand and the harpoon.
        const ox = owner.x, oy = owner.y - AIR;
        const pts = Array.from({ length: 9 }, (_, i) => {
          const k = i / 8;
          return { x: lerp(ox, t.x, k), y: lerp(oy, t.y, k) + Math.sin(k * Math.PI) * 10 };
        });
        g.lineStyle(1.5, 0xd8c49a, 1).strokePoints(pts2(pts), false);
      }
      line(g, t.x, t.y, x, y, 3, 0x7a5a3a, 1);
      poly(g, [{ x: x + dx * 12, y: y + dy * 12 }, { x: x + px * 6, y: y + py * 6 }, { x: x - px * 6, y: y - py * 6 }], 0xcfd6e0, 1);
      for (const s of [-1, 1]) line(g, x + px * 5 * s, y + py * 5 * s, x - dx * 8 + px * 8 * s, y - dy * 8 + py * 8 * s, 2, 0xcfd6e0, 1);
      return;
    }
    case 'witch.Q': {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const b = back(i * 6);
        const w = Math.sin(time / 60 - i * 0.9) * 6 * (i / 9);
        return { x: b.x + px * w, y: b.y + py * w };
      });
      g.lineStyle(4, 0x9be05a, 0.5).strokePoints(pts2(pts), false);
      disc(g, x, y, 10, 0xc55fae, 0.5);
      disc(g, x, y, 7, 0x7a2f8a, 1);
      const r = time / 150;
      g.lineStyle(1.5, 0xd4ff9a, 1).strokeTriangle(x + Math.cos(r) * 5, y + Math.sin(r) * 5, x + Math.cos(r + 2.1) * 5, y + Math.sin(r + 2.1) * 5, x + Math.cos(r + 4.2) * 5, y + Math.sin(r + 4.2) * 5);
      return;
    }
    case 'stalker.Q':
      star(g, x, y, 10, 3.5, 4, time / 25, 0xd8dde6, 1);
      disc(g, x, y, 2.5, 0x2a2f3a, 1);
      return;
    case 'stalker.R': {
      line(g, x - dx * 120, y - dy * 120, x, y, 2, 0x9c6cff, 0.45);
      for (let i = 3; i >= 0; i--) {
        const b = back(i * 14);
        const al = i ? 0.25 : 1;
        poly(g, [{ x: b.x + dx * 14, y: b.y + dy * 14 }, { x: b.x + px * 4, y: b.y + py * 4 }, { x: b.x - dx * 10, y: b.y - dy * 10 }, { x: b.x - px * 4, y: b.y - py * 4 }], i ? 0x9c6cff : 0x3a2a5c, al);
      }
      line(g, x - dx * 10, y - dy * 10, x + dx * 14, y + dy * 14, 1, 0xd9ccff, 1);
      return;
    }
    case 'lancer.Q': {
      poly(g, [{ x: x + dx * 14, y: y + dy * 14 }, { x: x - dx * 46 + px * 9, y: y - dy * 46 + py * 9 }, { x: x - dx * 46 - px * 9, y: y - dy * 46 - py * 9 }], 0xe9eef5, 0.6);
      line(g, x - dx * 46, y - dy * 46, x + dx * 10, y + dy * 10, 2, 0xf2c14e, 1);
      for (const s of [-1, 1]) line(g, x - dx * 20 + px * 16 * s, y - dy * 20 + py * 16 * s, x - dx * 60 + px * 16 * s, y - dy * 60 + py * 16 * s, 1.5, 0xffffff, 0.5);
      return;
    }
    case 'gunslinger.Q':
      line(g, x - dx * 40, y - dy * 40, x, y, 2, 0xffe27a, 0.6);
      disc(g, x, y, 3, 0xfff6c0, 1);
      return;
    case 'gunslinger.R':
      line(g, x - dx * 170, y - dy * 170, x, y, 10, 0xffd76a, 0.25);
      line(g, x - dx * 170, y - dy * 170, x, y, 3, 0xffffff, 0.9);
      disc(g, x, y, 5, 0xffffff, 1);
      return;
    case 'automaton.E': {
      for (let i = 1; i <= 4; i++) {
        const b = back(10 + i * 10);
        disc(g, b.x, b.y - i * 1.5, 4 + i * 1.5, 0xbfc6cc, 0.5 - i * 0.1);
      }
      const t = back(12);
      const fl = 10 + Math.sin(time / 30) * 4;
      poly(g, [{ x: t.x + px * 5, y: t.y + py * 5 }, { x: t.x - dx * fl, y: t.y - dy * fl }, { x: t.x - px * 5, y: t.y - py * 5 }], 0xff8a2a, 1);
      g.fillStyle(0xd8a24a, 1).fillCircle(x, y, 9);
      for (let i = -1; i <= 1; i++) line(g, x + dx * 5 + px * i * 4, y + dy * 5 + py * i * 4, x + dx * 9 + px * i * 4, y + dy * 9 + py * i * 4, 2, 0x8a6424, 1);
      return;
    }
    case 'tinker.Q': {
      const flick = Math.floor(time / 50);
      for (let i = 0; i < 3; i++) {
        const a = hash(flick * 3 + i) * TAU;
        jag(g, x, y, x + Math.cos(a) * 16, y + Math.sin(a) * 16, 3, 4, flick + i * 17, 1.5, 0x9ff4ff, 1);
      }
      disc(g, x, y, 9, 0x5fd3f0, 0.45);
      disc(g, x, y, 5, 0xe9fbff, 1);
      line(g, x - dx * 26, y - dy * 26, x, y, 2, 0x5fd3f0, 0.6);
      return;
    }
    case 'falconer.Q': {
      // The falcon in a dive: swept wings, a pale breast and a gold beak.
      const flap = Math.sin(time / 45) * 0.35;
      for (const sd of [-1, 1]) {
        const w = { x: x - dx * 6 + px * sd * (14 + 4 * flap), y: y - dy * 6 + py * sd * (14 + 4 * flap) };
        poly(g, [{ x: x + px * sd * 2, y: y + py * sd * 2 }, w, { x: x - dx * 12, y: y - dy * 12 }], 0x8a5d36, 1);
      }
      disc(g, x, y, 5, 0x8a5d36, 1);
      disc(g, x + dx * 2, y + dy * 2, 3, 0xefe6cf, 1);
      poly(g, [{ x: x + dx * 9, y: y + dy * 9 }, { x: x + dx * 5 + px * 2, y: y + dy * 5 + py * 2 }, { x: x + dx * 5 - px * 2, y: y + dy * 5 - py * 2 }], 0xf2c14e, 1);
      line(g, x - dx * 40, y - dy * 40, x - dx * 14, y - dy * 14, 2, 0xe8e2d0, 0.35);
      return;
    }
    default: {
      // Towers, the beast's rocks and anything without a look of its own.
      const tail = p.width >= 28 ? 22 : 15;
      line(g, x - dx * tail * 1.5, y - dy * tail * 1.5, x, y, 7, parseInt(p.color.slice(1), 16), 0.25);
      line(g, x - dx * tail, y - dy * tail, x, y, 3, parseInt(p.color.slice(1), 16), 1);
      disc(g, x, y, 3, 0xffffff, 1);
    }
  }
}

/** What each look's bolt leaves where it strikes. */
const HIT_COLOR: Record<string, number> = {
  'archer.Q': 0xe6f08a,
  'archer.W': 0xa9d86a,
  'mage.Q': 0xff8a2a,
  'priest.Q': 0xfff1b8,
  'harpooner.Q': 0x9fe8ff,
  'witch.Q': 0xc55fae,
  'stalker.Q': 0xe9eef5,
  'stalker.R': 0x9c6cff,
  'lancer.Q': 0xffffff,
  'gunslinger.Q': 0xffe27a,
  'gunslinger.R': 0xffd76a,
  'automaton.E': 0xd8a24a,
  'tinker.Q': 0x9ff4ff,
  'falconer.Q': 0xe8e2d0,
};

function drawHit({ ground, top }: FxLayers, f: SkillShot, k: number, a: number, n: number) {
  const look = f.look.slice(0, -4);
  const c = HIT_COLOR[look] ?? 0xffffff;
  const x = f.x, y = f.y - AIR;
  switch (look) {
    case 'mage.Q':
      disc(top, x, y, 34 * out(k), 0xff8a2a, 0.5 * a);
      disc(top, x, y, 18 * out(k), 0xffe08a, 0.7 * a);
      burstDots(top, x, y, 40, 8, k, n, 3, 0xffc04a, a);
      return;
    case 'priest.Q':
      pillar(top, f.x, f.y, 22, 80 * out(k), 0xfff1b8, a);
      return;
    case 'harpooner.Q':
    case 'archer.Q':
    case 'archer.W':
    case 'lancer.Q':
    case 'stalker.Q':
    case 'gunslinger.Q':
      burstDots(top, x, y, 26, 7, k, n, 2.5, c, a);
      ring(top, x, y, 14 * out(k), 2, c, a);
      return;
    case 'witch.Q':
      puffs(top, x, y, 14, 6, k, n, 12, 0x7a2f8a, a * 1.3);
      return;
    case 'stalker.R':
      star(top, x, y, 40 * out(k), 8 * out(k), 6, 0.3, c, a);
      return;
    case 'gunslinger.R':
      star(top, x, y, 44 * out(k), 8, 8, 0, c, a);
      ring(ground, f.x, f.y, 40 * out(k), 3, c, a);
      return;
    case 'automaton.E':
      puffs(top, x, y, 20, 7, k, n, 14, 0xff9a4a, a * 1.2);
      puffs(top, x, y, 24, 6, k, n + 20, 12, 0xbfc6cc, a);
      return;
    case 'tinker.Q':
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + hash(n + i);
        jag(top, x, y, x + Math.cos(ang) * 30 * out(k), y + Math.sin(ang) * 30 * out(k), 3, 5, n + i * 3, 2, c, a);
      }
      return;
    default:
      ring(top, x, y, 18 * out(k), 3, c, a);
  }
}

// ---------------------------------------------------------------------------------------------
// Zones: each one churns in its own way while it lasts.

export function drawZone(L: FxLayers, z: Zone, time: number, reduceMotion: boolean) {
  const { ground, top } = L;
  const fade = Math.min(1, z.left / 400, (z.ms - z.left) / 200 + 0.3);
  const t = reduceMotion ? 0 : time;
  const n = Math.floor(z.x * 7 + z.y * 13) % 997;
  const edge = (color: number, fill: number, fillA: number) => {
    disc(ground, z.x, z.y, z.r, fill, fillA * fade);
    ring(ground, z.x, z.y, z.r, 3, color, 0.8 * fade);
  };
  switch (z.look) {
    case 'archer.R': {
      edge(0xe6c03a, 0xe6c03a, 0.12);
      for (let i = 0; i < 16; i++) {
        const cycle = t / 520 + hash(n + i);
        const phase = cycle % 1;
        const round = Math.floor(cycle);
        const a = hash(n + i + round * 31) * TAU;
        const d = z.r * Math.sqrt(hash(n + i * 3 + round * 17));
        const px = z.x + Math.cos(a) * d, py = z.y + Math.sin(a) * d;
        if (phase < 0.55) {
          const h = 140 * (1 - phase / 0.55);
          line(top, px, py - h - 22, px, py - h, 2, 0x6a4a2a, fade);
          poly(top, [{ x: px, y: py - h + 6 }, { x: px - 3, y: py - h }, { x: px + 3, y: py - h }], 0xdfe6ee, fade);
        } else {
          line(ground, px, py, px - 4, py - 14, 2, 0x6a4a2a, fade * (1 - (phase - 0.55) / 0.45));
          ring(ground, px, py, 6, 1.5, 0xe6c03a, fade * (1 - (phase - 0.55) / 0.45));
        }
      }
      return;
    }
    case 'harpooner.R':
      edge(0x9fe8ff, 0x1a4a7a, 0.35);
      spiral(ground, z.x, z.y, z.r * 0.95, 4, -t / 300, 4, 0x5fc8e8, 0.8 * fade);
      spiral(ground, z.x, z.y, z.r * 0.7, 4, -t / 300 + 0.4, 2, 0xffffff, 0.5 * fade);
      for (let i = 0; i < 10; i++) {
        const a = -t / (200 + i * 30) + hash(n + i) * TAU;
        const d = z.r * (0.3 + hash(n + i * 2) * 0.65);
        disc(ground, z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, 3, 0xffffff, 0.8 * fade);
      }
      return;
    case 'witch.W':
      edge(0x9be05a, 0x4a6a1a, 0.3);
      for (let i = 0; i < 10; i++) {
        const phase = (t / 700 + hash(n + i)) % 1;
        const round = Math.floor(t / 700 + hash(n + i));
        const a = hash(n + i + round * 13) * TAU;
        const d = z.r * 0.85 * Math.sqrt(hash(n + i * 5 + round * 7));
        const bx = z.x + Math.cos(a) * d, by = z.y + Math.sin(a) * d;
        if (phase < 0.8) {
          disc(ground, bx, by, 2 + 7 * (phase / 0.8), 0x9be05a, 0.7 * fade);
          disc(ground, bx - 2, by - 2, 2, 0xe0ffb0, 0.8 * fade);
        } else ring(ground, bx, by, 9 + 20 * (phase - 0.8), 1.5, 0xc6ff8a, fade * (1 - (phase - 0.8) / 0.2));
      }
      return;
    case 'witch.R':
      edge(0x9c5fd0, 0x3a1a4a, 0.35);
      for (let i = 0; i < 9; i++) {
        const a = t / (900 + i * 80) + hash(n + i) * TAU;
        const d = z.r * (0.25 + hash(n + i * 3) * 0.6);
        disc(top, z.x + Math.cos(a) * d, z.y + Math.sin(a) * d - 14, 26 + 10 * Math.sin(t / 400 + i), 0x6a2f6a, 0.22 * fade);
      }
      for (let i = 0; i < 14; i++) {
        const cx = z.x + (hash(n + i) - 0.5) * z.r * 1.3, cy = z.y + (hash(n + i * 7) - 0.5) * z.r * 1.3;
        const a = t / 60 + i * 2;
        disc(top, cx + Math.cos(a) * 8, cy - 20 + Math.sin(a * 1.3) * 5, 1.8, 0x1a1020, 0.9 * fade);
      }
      return;
    case 'gunslinger.W':
      edge(0xc9d0d8, 0x9aa3ad, 0.2);
      for (let i = 0; i < 14; i++) {
        const a = t / (1400 + i * 60) + hash(n + i) * TAU;
        const d = z.r * (0.15 + hash(n + i * 3) * 0.7);
        disc(top, z.x + Math.cos(a) * d, z.y + Math.sin(a) * d - 18, 24 + 8 * Math.sin(t / 300 + i * 1.3), i % 2 ? 0x9aa3ad : 0xc9d0d8, 0.35 * fade);
      }
      return;
    case 'tinker.W': {
      edge(0x5fd3f0, 0x1a3a5a, 0.22);
      for (let i = 0; i < 3; i++) top.lineStyle(3, 0xd8a24a, fade).strokeEllipse(z.x, z.y - 6 - i * 9, 20 - i * 3, 7);
      disc(top, z.x, z.y - 32, 6, 0xe9fbff, fade);
      const flick = Math.floor(t / 90);
      for (let i = 0; i < 4; i++) {
        const a = hash(n + flick * 4 + i) * TAU;
        const d = z.r * (0.5 + hash(n + flick + i * 9) * 0.5);
        jag(top, z.x, z.y - 32, z.x + Math.cos(a) * d, z.y + Math.sin(a) * d, 6, 9, n + flick * 7 + i, 2, 0x9ff4ff, fade);
      }
      return;
    }
    case 'tinker.R': {
      edge(0x5fd3f0, 0x14203a, 0.3);
      for (let i = 0; i < 6; i++) disc(top, z.x + (i - 2.5) * z.r * 0.3, z.y - 170 + Math.sin(i * 1.7) * 10, z.r * 0.28, 0x2b3344, 0.55 * fade);
      for (let i = 0; i < 3; i++) {
        const cycle = t / 260 + i / 3;
        const phase = cycle % 1;
        if (phase > 0.45) continue;
        const round = Math.floor(cycle) * 3 + i;
        const a = hash(n + round) * TAU;
        const d = z.r * Math.sqrt(hash(n + round * 3));
        const px = z.x + Math.cos(a) * d, py = z.y + Math.sin(a) * d;
        const al = fade * (1 - phase / 0.45);
        jag(top, px + (hash(round) - 0.5) * 60, z.y - 160, px, py, 8, 14, round * 5, 5, 0x5fd3f0, al * 0.6);
        jag(top, px + (hash(round) - 0.5) * 60, z.y - 160, px, py, 8, 14, round * 5, 2, 0xffffff, al);
        disc(ground, px, py, 24 * (1 - phase), 0xe9fbff, 0.5 * al);
      }
      return;
    }
    case 'falconer.W': {
      // A hawk wheeling over the circle, its shadow sweeping the ground.
      edge(0xc9a46a, 0x6b4a2e, 0.14);
      const a = t / 260;
      const hx = z.x + Math.cos(a) * z.r * 0.7, hy = z.y + Math.sin(a) * z.r * 0.35;
      disc(ground, hx, hy, 9, 0x000000, 0.18 * fade);
      const tx = -Math.sin(a), ty = Math.cos(a) * 0.5;
      for (const sd of [-1, 1]) poly(top, [{ x: hx, y: hy - 60 }, { x: hx - ty * 4 + tx * 2 + sd * 14 * Math.abs(ty * 2 + 0.3), y: hy - 60 + sd * 6 }, { x: hx - tx * 8, y: hy - 60 - ty * 8 }], 0x8a5d36, fade);
      disc(top, hx, hy - 60, 4, 0x8a5d36, fade);
      for (let i = 0; i < 6; i++) {
        const ph = (t / 1100 + hash(n + i)) % 1;
        const fa = hash(n + i * 3) * TAU, fd = z.r * 0.8 * hash(n + i * 7);
        poly(top, [{ x: z.x + Math.cos(fa) * fd, y: z.y + Math.sin(fa) * fd - 50 * (1 - ph) - 4 }, { x: z.x + Math.cos(fa) * fd + 2, y: z.y + Math.sin(fa) * fd - 50 * (1 - ph) }, { x: z.x + Math.cos(fa) * fd, y: z.y + Math.sin(fa) * fd - 50 * (1 - ph) + 5 }], 0xe8e2d0, fade * Math.sin(ph * Math.PI));
      }
      return;
    }
    case 'alchemist.Q': {
      // A bubbling green pool.
      edge(0x9be15d, 0x3f7a1e, 0.3);
      for (let i = 0; i < 10; i++) {
        const ph = (t / 700 + hash(n + i)) % 1;
        const ba = hash(n + i * 3) * TAU, bd = z.r * 0.85 * Math.sqrt(hash(n + i * 7));
        ring(top, z.x + Math.cos(ba) * bd, z.y + Math.sin(ba) * bd - 4 - ph * 10, 2 + ph * 4, 1.5, 0xd8ffb0, fade * (1 - ph));
      }
      return;
    }
    default:
      edge(parseInt(z.color.slice(1), 16), parseInt(z.color.slice(1), 16), 0.2);
  }
}

// ---------------------------------------------------------------------------------------------
// Buff auras: a buff from an ability glows round its champion in that ability's look.

export function drawAura(L: FxLayers, look: string, x: number, y: number, time: number, color: string, reduceMotion: boolean) {
  const { ground, top } = L;
  const t = reduceMotion ? 0 : time;
  const c = parseInt(color.slice(1), 16);
  switch (look) {
    case 'berserker.W':
      flames(top, x, y + 6, 16, 5, 18, t, 3, 0xff4a2a, 0xffb36a, 0.75);
      return;
    case 'berserker.R':
    case 'wolfkin.R': {
      const red = look === 'berserker.R' ? 0xff6a3a : 0xd8343a;
      ring(ground, x, y + 8, 26 + Math.sin(t / 200) * 3, 3, red, 0.7);
      for (let i = 0; i < 6; i++) {
        const ph = (t / 900 + i / 6) % 1;
        disc(top, x + Math.cos(i * 2.4) * 16, y - 10 - ph * 50, 2.5, red, Math.sin(ph * Math.PI));
      }
      return;
    }
    case 'harpooner.E':
      wavyRing(top, x, y - 24, 32, 6, 2.5, t / 150, 2, 0x7fe8ff, 0.7);
      return;
    case 'automaton.W':
      gear(top, x + 22, y - 44, 7, 7, t / 120, 0xd8a24a, 0.9);
      return;
    case 'wolfkin.W':
      arcStroke(top, x, y - 50, 16 + ((t / 25) % 24), -Math.PI / 2 - 0.7, -Math.PI / 2 + 0.7, 2, 0xdfe8ff, 0.6);
      return;
    case 'bruin.R':
      zigRing(ground, x, y + 8, 30, 10, 4, 3, 0xd9a66a, 0.8);
      return;
    case 'alchemist.E':
      // Smoke curling round the hidden alchemist.
      for (let i = 0; i < 5; i++) {
        const a = t / 700 + (i * TAU) / 5;
        disc(top, x + Math.cos(a) * 18, y - 14 + Math.sin(a) * 8, 9, 0x8f96a3, 0.35);
      }
      return;
    case 'lancer.R':
      for (let i = 0; i < 3; i++) {
        const a = t / 600 + (i * TAU) / 3;
        kiteShield(top, x + Math.cos(a) * 24, y + 10 + Math.sin(a) * 10, 6, 0xd8cfb4, 0xf2c14e, 0.85);
      }
      return;
    default:
      ring(ground, x, y + 8, 30, 2, c, 0.85);
  }
}
