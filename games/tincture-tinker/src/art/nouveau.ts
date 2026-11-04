import Phaser from 'phaser';
import type { Kind } from '../game/kinds';
import { sharpRes, viewSize } from '../../../../shared/scaling';
import { SERIF, VIEW } from '../scenes/layout';

// The Art Nouveau label toolkit every texture is painted with: flat muted inks with bold sepia
// contours, gold whiplash ornament, cream card. Textures are painted on 2D canvases and added with
// `textures.addCanvas`. Painters work in "art units", twice the game's 960x540 view, and each canvas
// is scaled to `RES` canvas pixels per view pixel: 1 on a screen the game fits at its own size, more
// on a bigger one, so the art stays sharp. Show a texture with `shown`, which undoes `RES`.

export const PI = Math.PI;
/** Art units per view pixel. */
export const ART = 2;

export const SEPIA = '#2e1d14';
export const GOLD = '#c9a24a';
export const GOLDL = '#e6c97a';
export const GOLDD = '#a77c2c';
export const STAR = '#e1b247';
export const CREAM = '#f1e6c8';
export const CREAMD = '#e3d3ad';
export const GREEN = '#1e3a32';
export const BOTTLE = '#2f5a48';
export const RUST = '#7a3a2e';
export const BROWN = '#5a4030';
export const MOSS = '#6a9a58';
export const OCHRE = '#d4a23e';
export { SERIF };

export type Pt = [number, number];

/**
 * Canvas pixels per view pixel every texture is painted at, the same for all of them; set by `bake`
 * from `sharpRes` for the biggest texture (the whole view), once `setupScaling` has picked the scale.
 */
export let RES = 1;

/** Sizes an image showing a baked texture to `scale` times its size in view pixels. */
export function shown<T extends { setScale(x: number): unknown }>(obj: T, scale = 1): T {
  obj.setScale(scale / RES);
  return obj;
}

/** The canvas being painted; set by `bake` for the duration of one painter. */
export let ctx: CanvasRenderingContext2D;

/**
 * Paints a `w` x `h` (view pixels) texture called `key`: the painter draws in art units, on a
 * canvas of 2w x 2h art units, `RES` canvas pixels per view pixel. Does nothing if the texture is
 * already there.
 */
export function bake(scene: Phaser.Scene, key: string, w: number, h: number, paint: () => void) {
  if (scene.textures.exists(key)) return;
  const view = viewSize(scene);
  RES = sharpRes(Math.max(VIEW.w, view.width), Math.max(VIEW.h, view.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * RES);
  canvas.height = Math.ceil(h * RES);
  ctx = canvas.getContext('2d')!;
  ctx.scale(RES / ART, RES / ART);
  paint();
  scene.textures.addCanvas(key, canvas);
}

export const num = (col: string) => parseInt(col.slice(1), 16);
export function mix(a: string, b: string, t: number) {
  const pa = num(a);
  const pb = num(b);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('');
}
export const lighten = (c: string, k: number) => mix(c, '#fff8e8', k);

export function pathOf(pts: Pt[]) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}
export function poly(pts: Pt[], fill?: string | null, stroke?: string | null, lw = 2) {
  pathOf(pts);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}
export function circle(x: number, y: number, r: number, fill?: string | null, stroke?: string | null, lw = 2) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, PI * 2);
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
export function rrect(x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export function line(x1: number, y1: number, x2: number, y2: number, col: string, lw = 2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
}
export function txt(s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left') {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
  ctx.restore();
}
export function star(x: number, y: number, r: number, inner = 0.45): Pt[] {
  const pts: Pt[] = [];
  for (let k = 0; k < 10; k++) {
    const a = -PI / 2 + (k * PI) / 5;
    const rr = k % 2 ? r * inner : r;
    pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
  }
  return pts;
}
export function ell(x: number, y: number, rx: number, ry: number, rot = 0, n = 14): Pt[] {
  const pts: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * PI * 2;
    const px = Math.cos(a) * rx;
    const py = Math.sin(a) * ry;
    pts.push([x + px * Math.cos(rot) - py * Math.sin(rot), y + px * Math.sin(rot) + py * Math.cos(rot)]);
  }
  return pts;
}
/** A pointed leaf from its base along angle `ang`. */
export function leaf(x: number, y: number, ang: number, len: number, w: number, n = 6): Pt[] {
  const up: Pt[] = [];
  const lo: Pt[] = [];
  for (let k = 0; k <= n; k++) {
    const u = k / n;
    const half = w * Math.sin(PI * Math.pow(u, 0.8)) * 0.5;
    up.push([u * len, -half]);
    lo.push([u * len, half]);
  }
  const pts = [...up, ...lo.slice(1, -1).reverse()];
  return pts.map(([px, py]) => [x + px * Math.cos(ang) - py * Math.sin(ang), y + px * Math.sin(ang) + py * Math.cos(ang)]);
}

// ---- Ornament ----

/** A whiplash curl: an S-curve with a spiral end. */
export function whip(x: number, y: number, len: number, ang: number, col: string, lw: number, flip = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(1, flip);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(len * 0.3, -len * 0.25, len * 0.55, len * 0.25, len * 0.85, 0);
  ctx.bezierCurveTo(len * 1.0, -len * 0.14, len * 0.92, -len * 0.28, len * 0.8, -len * 0.22);
  ctx.bezierCurveTo(len * 0.72, -len * 0.18, len * 0.76, -len * 0.08, len * 0.84, -len * 0.1);
  ctx.strokeStyle = col;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}
/** A gold double rule round a card. */
export function doubleRule(x: number, y: number, w: number, h: number, r = 0) {
  ctx.lineWidth = 3;
  ctx.strokeStyle = GOLD;
  rrect(x, y, w, h, r);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = GOLDL;
  rrect(x + 7, y + 7, w - 14, h - 14, Math.max(0, r - 6));
  ctx.stroke();
}
/** Two whiplashes curling out of a corner; `sx`, `sy` turn it to face into the card. */
export function cornerOrn(x: number, y: number, sx: number, sy: number, len = 70) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(sx, sy);
  whip(0, 0, len, 0, GOLD, 3);
  whip(0, 0, len, PI / 2, GOLD, 3, -1);
  circle(10, 10, 6, GOLD);
  ctx.restore();
}
/** A gold star with a sepia outline, or a pale one when not earned. */
export function goldStar(x: number, y: number, r: number, lit: boolean) {
  poly(star(x, y, r + 3), SEPIA, SEPIA, 4);
  poly(star(x, y, r), lit ? STAR : CREAMD);
  if (lit) poly(star(x - r * 0.12, y - r * 0.15, r * 0.5), '#f3d98a');
}
export function coin(x: number, y: number, r: number, face = STAR, ring = GOLDD) {
  circle(x, y, r, face, SEPIA, r * 0.17);
  circle(x, y, r * 0.62, null, ring, r * 0.1);
}

// ---- Ingredients ----

interface Part {
  role: string;
  pts?: Pt[];
  line?: [Pt, Pt];
}

const COL: Record<Kind, Record<string, string>> = {
  wheat: { main: '#d9a441', light: '#e9c26a', stem: '#a8792c', tie: '#8c3f2e' },
  mandrake: { main: '#c98f62', leaf: '#5d8a4a', leafL: '#78a35a', arm: '#b07a50', eye: SEPIA },
  sage: { main: '#7aa36a', dark: '#5a8650', stem: '#4d6e3c', vein: '#c9dcae' },
  ember: { gem: '#c4513f' },
  moonpetal: { main: '#8a6fae', light: '#a88fc8', center: '#e5b84c' },
  fern: { main: '#3f8f7a', dark: '#2f7262', stem: '#2f5a48' },
  honey: { main: '#d9861f', eye: '#f6c46a' },
  pearl: { shell: '#cdb59c', vein: '#9a7f66', main: '#efe4ee', eye: '#ffffff' },
  thistle: { stem: '#5a7a3a', base: '#7f9a52', tuft: '#9c5aa6' },
  acorn: { stem: '#5a4030', main: '#b8823e', cap: '#7a5a32' },
  larkspur: { stem: '#4d6e3c', leaf: '#5d8a4a', main: '#4f6fc8', light: '#7790dc' },
  glowcap: { stem: '#efe3c2', cap: '#3fa59a', eye: '#e8f6a8' },
  bramble: { leaf: '#5d8a4a', main: '#5a2f5e', light: '#7a4682', eye: '#d6b0dc' },
};
/** Points on the arc of an ellipse round `x`, `y` from angle `a0` to `a1` (degrees, clockwise on screen). */
const arc = (x: number, y: number, rx: number, ry: number, a0: number, a1: number, n = 12): Pt[] =>
  Array.from({ length: n + 1 }, (_, k) => {
    const a = (a0 + ((a1 - a0) * k) / n) * (PI / 180);
    return [x + Math.cos(a) * rx, y + Math.sin(a) * ry] as Pt;
  });
const D = PI / 180;
/** Ingredient silhouettes in a unit frame (about -1..1), as polygons tagged with a colour role. */
function shapes(kind: Kind): Part[] {
  if (kind === 'wheat') {
    const parts: Part[] = [];
    for (const [deg, len] of [[-28, 0.92], [0, 1.02], [28, 0.92]]) {
      const a = (-90 + deg) * D;
      parts.push({ role: 'stem', line: [[0, 0.82], [Math.cos(a) * 1.3 * len, 0.82 + Math.sin(a) * 1.3 * len]] });
      for (let g = 0; g < 4; g++) {
        const d = 0.62 + g * 0.2;
        const gx = Math.cos(a) * d * len;
        const gy = 0.82 + Math.sin(a) * d * len;
        const side = a + PI / 2;
        for (const sd of [-1, 1]) {
          parts.push({ role: g % 2 ? 'main' : 'light', pts: ell(gx + Math.cos(side) * 0.09 * sd, gy + Math.sin(side) * 0.09 * sd, 0.15, 0.085, a + sd * 0.45, 8) });
        }
      }
      parts.push({ role: 'light', pts: ell(Math.cos(a) * 1.42 * len, 0.82 + Math.sin(a) * 1.42 * len, 0.12, 0.07, a, 8) });
    }
    parts.push({ role: 'tie', pts: [[-0.2, 0.3], [0.2, 0.3], [0.17, 0.44], [-0.17, 0.44]] });
    return parts;
  }
  if (kind === 'mandrake') {
    const body: Pt[] = [];
    for (let k = 0; k <= 16; k++) {
      const a = PI + (k / 16) * PI;
      body.push([Math.cos(a) * 0.5, -0.05 + Math.sin(a) * 0.32]);
    }
    body.push([0.52, 0.14], [0.4, 0.42], [0.34, 0.78], [0.18, 0.5], [0.06, 0.62], [-0.06, 0.62], [-0.18, 0.5], [-0.34, 0.78], [-0.4, 0.42], [-0.52, 0.14]);
    return [
      { role: 'leaf', pts: leaf(-0.04, -0.3, -120 * D, 0.62, 0.3) },
      { role: 'leaf', pts: leaf(0.04, -0.3, -60 * D, 0.62, 0.3) },
      { role: 'leafL', pts: leaf(0, -0.32, -90 * D, 0.72, 0.32) },
      { role: 'arm', pts: [[-0.48, 0.08], [-0.78, 0.24], [-0.74, 0.32], [-0.44, 0.22]] },
      { role: 'arm', pts: [[0.48, 0.08], [0.78, 0.24], [0.74, 0.32], [0.44, 0.22]] },
      { role: 'main', pts: body },
      { role: 'eye', pts: ell(-0.18, 0.04, 0.065, 0.075, 0, 8) },
      { role: 'eye', pts: ell(0.18, 0.04, 0.065, 0.075, 0, 8) },
      { role: 'eye', pts: [[-0.08, 0.2], [0.08, 0.2], [0.04, 0.26], [-0.04, 0.26]] },
    ];
  }
  if (kind === 'sage') {
    return [
      { role: 'stem', line: [[0, 0.86], [0, 0.2]] },
      { role: 'dark', pts: leaf(0, 0.48, -142 * D, 0.92, 0.5) },
      { role: 'dark', pts: leaf(0, 0.48, -38 * D, 0.92, 0.5) },
      { role: 'main', pts: leaf(0, 0.6, -90 * D, 1.38, 0.62) },
      { role: 'vein', line: [[0, 0.5], [0, -0.6]] },
    ];
  }
  if (kind === 'fern') {
    const parts: Part[] = [{ role: 'stem', line: [[0, 0.9], [0, -0.8]] }];
    for (let k = 0; k < 5; k++) {
      const y = 0.55 - k * 0.3;
      const len = 0.62 - k * 0.1;
      const w = 0.28 - k * 0.03;
      parts.push({ role: k % 2 ? 'dark' : 'main', pts: leaf(0, y, -152 * D, len, w) }, { role: k % 2 ? 'main' : 'dark', pts: leaf(0, y, -28 * D, len, w) });
    }
    parts.push({ role: 'main', pts: leaf(0, -0.62, -90 * D, 0.32, 0.2) });
    return parts;
  }
  if (kind === 'honey') {
    return [
      { role: 'main', pts: [...arc(0, 0.25, 0.6, 0.6, -25, 205, 16), [0, -0.88]] },
      { role: 'eye', pts: ell(-0.24, 0.12, 0.1, 0.2, 0.3, 10) },
    ];
  }
  if (kind === 'pearl') {
    const parts: Part[] = [{ role: 'shell', pts: [[0, 0.82], ...arc(0, 0.82, 1, 1, 195, 345, 14)] }];
    for (let k = 0; k <= 6; k++) {
      const a = (195 + k * 25) * D;
      parts.push({ role: 'vein', line: [[0, 0.82], [Math.cos(a) * 0.95, 0.82 + Math.sin(a) * 0.95]] });
    }
    parts.push({ role: 'main', pts: ell(0, 0.08, 0.46, 0.46, 0, 16) }, { role: 'eye', pts: ell(-0.16, -0.1, 0.12, 0.09, -0.5, 8) });
    return parts;
  }
  if (kind === 'thistle') {
    const tuft: Pt[] = [[-0.3, 0.05]];
    for (let k = 0; k <= 10; k++) {
      const a = (200 + k * 14) * D;
      const r = k % 2 ? 0.48 : 0.9;
      tuft.push([Math.cos(a) * r * 0.85, 0.05 + Math.sin(a) * r]);
    }
    tuft.push([0.3, 0.05]);
    return [
      { role: 'stem', line: [[0, 0.9], [0, 0.3]] },
      { role: 'tuft', pts: tuft },
      { role: 'base', pts: ell(0, 0.28, 0.36, 0.3, 0, 14) },
    ];
  }
  if (kind === 'acorn') {
    return [
      { role: 'stem', line: [[0, -0.4], [0.14, -0.82]] },
      { role: 'main', pts: ell(0, 0.26, 0.44, 0.56, 0, 16) },
      { role: 'cap', pts: arc(0, -0.08, 0.58, 0.44, 180, 360, 14) },
    ];
  }
  if (kind === 'larkspur') {
    const parts: Part[] = [
      { role: 'stem', line: [[0, 0.9], [0, -0.75]] },
      { role: 'leaf', pts: leaf(0, 0.78, -150 * D, 0.55, 0.24) },
      { role: 'leaf', pts: leaf(0, 0.7, -30 * D, 0.5, 0.22) },
    ];
    for (let k = 0; k < 5; k++) {
      const r = 0.3 - k * 0.04;
      parts.push({ role: k % 2 ? 'light' : 'main', pts: ell(k % 2 ? 0.12 : -0.12, 0.42 - k * 0.28, r, r * 0.85, 0, 12) });
    }
    parts.push({ role: 'light', pts: ell(0, -0.8, 0.1, 0.14, 0, 10) });
    return parts;
  }
  if (kind === 'glowcap') {
    return [
      { role: 'stem', pts: [[-0.17, -0.05], [0.17, -0.05], [0.24, 0.86], [-0.24, 0.86]] },
      { role: 'cap', pts: arc(0, 0.08, 0.84, 0.74, 180, 360, 16) },
      { role: 'eye', pts: ell(-0.38, -0.2, 0.1, 0.1, 0, 8) },
      { role: 'eye', pts: ell(0.12, -0.4, 0.12, 0.12, 0, 8) },
      { role: 'eye', pts: ell(0.46, -0.1, 0.09, 0.09, 0, 8) },
    ];
  }
  if (kind === 'bramble') {
    const parts: Part[] = [
      { role: 'leaf', pts: leaf(0, -0.36, -135 * D, 0.58, 0.32) },
      { role: 'leaf', pts: leaf(0, -0.36, -45 * D, 0.58, 0.32) },
    ];
    const drupes: Pt[] = [[-0.24, -0.16], [0.24, -0.16], [-0.4, 0.1], [0, 0.12], [0.4, 0.1], [-0.24, 0.38], [0.24, 0.38], [0, 0.62]];
    drupes.forEach(([x, y], k) => parts.push({ role: k % 3 ? 'main' : 'light', pts: ell(x, y, 0.24, 0.23, 0, 10) }));
    for (const [x, y] of drupes.slice(0, 5)) parts.push({ role: 'eye', pts: ell(x - 0.07, y - 0.08, 0.05, 0.05, 0, 6) });
    return parts;
  }
  if (kind === 'ember') return [{ role: 'gem', pts: [[-0.78, -0.12], [-0.42, -0.62], [0.42, -0.62], [0.78, -0.12], [0, 0.86]] }];
  const parts: Part[] = [];
  for (let k = 0; k < 5; k++) {
    const a = (-90 + k * 72) * D;
    parts.push({ role: k % 2 ? 'main' : 'light', pts: ell(Math.cos(a) * 0.44, Math.sin(a) * 0.44 + 0.02, 0.4, 0.3, a, 12) });
  }
  parts.push({ role: 'center', pts: ell(0, 0.02, 0.24, 0.24, 0, 10) });
  return parts;
}
/** The ember gem's crown and pavilion facets, lit (k > 0) or shaded (k < 0). */
const GEM_FACETS: { pts: Pt[]; k: number }[] = [
  { pts: [[-0.42, -0.62], [0.42, -0.62], [0.24, -0.3], [-0.24, -0.3]], k: 0.45 },
  { pts: [[-0.78, -0.12], [-0.42, -0.62], [-0.24, -0.3], [-0.36, -0.12]], k: 0.3 },
  { pts: [[0.78, -0.12], [0.42, -0.62], [0.24, -0.3], [0.36, -0.12]], k: -0.05 },
  { pts: [[-0.24, -0.3], [0.24, -0.3], [0.36, -0.12], [-0.36, -0.12]], k: 0.2 },
  { pts: [[-0.78, -0.12], [-0.36, -0.12], [0, 0.86]], k: 0.05 },
  { pts: [[-0.36, -0.12], [0.36, -0.12], [0, 0.86]], k: -0.15 },
  { pts: [[0.36, -0.12], [0.78, -0.12], [0, 0.86]], k: -0.4 },
];
const tf = (pts: Pt[], x: number, y: number, s: number): Pt[] => pts.map(([px, py]) => [x + px * s, y + py * s]);

/** Paints an ingredient centred on `x`, `y`, `s` art units from its middle to its edge. */
export function ingredient(kind: Kind, x: number, y: number, s: number, lw = 7) {
  const parts = shapes(kind);
  // The bold sepia contour first, then the flat inks inside it.
  for (const p of parts) {
    if (p.line) {
      const [[a, b], [c, d]] = tf(p.line, x, y, s);
      if (p.role !== 'vein') line(a, b, c, d, SEPIA, 6 + lw);
      continue;
    }
    if (p.role === 'eye') continue;
    poly(tf(p.pts!, x, y, s), SEPIA, SEPIA, lw);
  }
  for (const p of parts) {
    const col = COL[kind][p.role];
    if (p.line) {
      const [[a, b], [c, d]] = tf(p.line, x, y, s);
      line(a, b, c, d, col, p.role === 'vein' ? 2 : 6);
      continue;
    }
    const pts = tf(p.pts!, x, y, s);
    if (p.role === 'eye') {
      poly(pts, col);
      continue;
    }
    poly(pts, col, SEPIA, 2);
    if (p.role === 'gem') {
      for (const f of GEM_FACETS) {
        if (f.k > 0.3) poly(tf(f.pts, x, y, s), lighten(col, 0.35));
        if (f.k < -0.3) poly(tf(f.pts, x, y, s), mix(col, SEPIA, 0.3));
      }
      ctx.save();
      ctx.globalAlpha = 0.8;
      for (const f of GEM_FACETS) poly(tf(f.pts, x, y, s), null, SEPIA, 1.6);
      ctx.restore();
      continue;
    }
    // A flat cel highlight towards the top left.
    if (pts.length > 8) {
      let mx = 0;
      let my = 0;
      for (const [a, b] of pts) {
        mx += a;
        my += b;
      }
      mx /= pts.length;
      my /= pts.length;
      ctx.save();
      pathOf(pts);
      ctx.clip();
      poly(pts.map(([a, b]) => [mx + (a - mx) * 0.55 - s * 0.08, my + (b - my) * 0.55 - s * 0.1]), lighten(col, 0.3));
      ctx.restore();
    }
  }
}
