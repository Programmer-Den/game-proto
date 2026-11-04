// The embroidery kit for Colonizer's Bayeux tapestry look: natural linen, laid-and-couched wool fills,
// stem-stitch outlines, French knots and stitched lettering, in eight period wool colours. Every
// painter in src/art draws with these on a 2D canvas. Randomness comes from a private seeded
// generator, never Math.random, so baking textures leaves the seeded match untouched.

export const PI = Math.PI;

/** The wool colours, plus the linen ground. */
export const T = {
  linen: '#e9dcbc',
  linenDark: '#d8c9a4',
  band: '#e4d4ae',
  card: '#efe4c6',
  fog: '#c4b592',
  red: '#b4523b',
  ochre: '#c99a3a',
  sage: '#8f9c5c',
  green: '#4e6640',
  ink: '#2c3446',
  indigo: '#4a5f8c',
  buff: '#dcc597',
  teal: '#7ea295',
  grey: '#9a9a8c',
  brown: '#7a5530',
  bark: '#8a5a32',
  tan: '#b8955e',
  skin: '#e8cfa0',
  faded: '#7a6a50',
  plum: '#7e4f76',
} as const;

/** System serif stack for every stitched letter. */
export const SERIF = 'Georgia, "Times New Roman", serif';

let seed = 1;
/** Restarts the private generator, so a painter draws the same picture every time. */
export function reseed(s: number) {
  seed = (s * 2654435761) >>> 0 || 1;
}
export function rnd() {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const rr = (a: number, b: number) => a + rnd() * (b - a);

/** Mixes two #rrggbb colours; t = 0 gives a. */
export function mix(a: string, b: string, t: number) {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (p: number, s: number) => (p >> s) & 255;
  const m = (s: number) => Math.round(ch(pa, s) + (ch(pb, s) - ch(pa, s)) * t);
  return `#${((m(16) << 16) | (m(8) << 8) | m(0)).toString(16).padStart(6, '0')}`;
}
export const hexNum = (c: string) => parseInt(c.slice(1), 16);

export type Ctx = CanvasRenderingContext2D;
export type PathFn = (c: Ctx) => void;
export type Pt = [number, number];

/** Natural linen: a base colour with fine warp and weft threads and a few slubs. */
export function linen(c: Ctx, x: number, y: number, w: number, h: number, base: string = T.linen, s = 3) {
  c.fillStyle = base;
  c.fillRect(x, y, w, h);
  reseed(s);
  c.lineWidth = 0.35;
  for (let yy = y; yy < y + h; yy += 1.1) {
    c.strokeStyle = `rgba(${rnd() < 0.5 ? '255,250,235' : '120,100,70'},${rr(0.05, 0.14)})`;
    c.beginPath();
    c.moveTo(x, yy);
    c.lineTo(x + w, yy + rr(-0.3, 0.3));
    c.stroke();
  }
  for (let xx = x; xx < x + w; xx += 1.1) {
    c.strokeStyle = `rgba(${rnd() < 0.5 ? '255,250,235' : '120,100,70'},${rr(0.04, 0.1)})`;
    c.beginPath();
    c.moveTo(xx, y);
    c.lineTo(xx + rr(-0.3, 0.3), y + h);
    c.stroke();
  }
  for (let i = 0; i < (w * h) / 400; i++) {
    c.fillStyle = `rgba(110,90,60,${rr(0.04, 0.1)})`;
    c.fillRect(x + rr(0, w), y + rr(0, h), rr(1, 3), 0.5);
  }
}

/** Stem-stitch outline along a path. */
export function outline(c: Ctx, path: PathFn, col: string = T.ink, lw = 0.9) {
  c.save();
  path(c);
  c.strokeStyle = col;
  c.lineWidth = lw;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.setLineDash([2.2, 0.55]);
  c.stroke();
  c.globalAlpha = 0.5;
  c.setLineDash([0.8, 2]);
  c.lineDashOffset = 1;
  c.strokeStyle = mix(col, '#ffffff', 0.25);
  c.lineWidth = lw * 0.5;
  c.stroke();
  c.restore();
}

export interface SewOpts {
  bb?: [number, number, number, number];
  /** Direction of the laid threads, in radians. */
  ang?: number;
  /** Spacing of the laid threads. */
  sp?: number;
  /** Skip the couching bars across the laid threads. */
  noCouch?: boolean;
  /** Spacing of the couching bars. */
  cs?: number;
  line?: boolean;
  lineCol?: string;
  lw?: number;
}

/** Laid-and-couched fill: the shape in a wool colour, long parallel threads and short couching bars. */
export function sew(c: Ctx, path: PathFn, fill: string, o: SewOpts = {}) {
  c.save();
  path(c);
  c.fillStyle = fill;
  c.fill();
  c.clip();
  const [x0, y0, x1, y1] = o.bb ?? [0, 0, c.canvas.width, c.canvas.height];
  const ang = o.ang ?? -0.35;
  const sp = o.sp ?? 1.3;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const R = Math.hypot(x1 - x0, y1 - y0) / 2 + 2;
  c.lineWidth = sp * 0.55;
  for (let t = -R; t < R; t += sp) {
    const px = cx - dy * t;
    const py = cy + dx * t;
    c.strokeStyle = rnd() < 0.5 ? mix(fill, '#ffffff', rr(0.06, 0.16)) : mix(fill, '#000000', rr(0.05, 0.14));
    c.beginPath();
    c.moveTo(px - dx * R, py - dy * R);
    c.lineTo(px + dx * R, py + dy * R);
    c.stroke();
  }
  if (!o.noCouch) {
    const cs = o.cs ?? 5;
    c.strokeStyle = mix(fill, '#000000', 0.3);
    c.lineWidth = 0.45;
    for (let t = -R; t < R; t += cs) {
      const px = cx + dx * t;
      const py = cy + dy * t;
      c.setLineDash([2.2, 1.6]);
      c.lineDashOffset = rr(0, 3);
      c.beginPath();
      c.moveTo(px + dy * R, py - dx * R);
      c.lineTo(px - dy * R, py + dx * R);
      c.stroke();
    }
    c.setLineDash([]);
  }
  c.restore();
  if (o.line !== false) outline(c, path, o.lineCol ?? T.ink, o.lw ?? 0.9);
}

export const P = (pts: Pt[]): PathFn => (c) => {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
};
export const E = (x: number, y: number, rx: number, ry: number, rot = 0): PathFn => (c) => {
  c.beginPath();
  c.ellipse(x, y, rx, ry, rot, 0, PI * 2);
};
export const bbP = (pts: Pt[]): [number, number, number, number] => [
  Math.min(...pts.map((p) => p[0])),
  Math.min(...pts.map((p) => p[1])),
  Math.max(...pts.map((p) => p[0])),
  Math.max(...pts.map((p) => p[1])),
];
/** A sewn polygon. */
export const sp = (c: Ctx, pts: Pt[], fill: string, o: SewOpts = {}) => sew(c, P(pts), fill, { bb: bbP(pts), ...o });
/** A sewn ellipse. */
export const se = (c: Ctx, x: number, y: number, rx: number, ry: number, fill: string, o: SewOpts & { rot?: number } = {}) =>
  sew(c, E(x, y, rx, ry, o.rot ?? 0), fill, { bb: [x - rx, y - ry, x + rx, y + ry], ...o });
/** A sewn rectangle. */
export const sr = (c: Ctx, x: number, y: number, w: number, h: number, fill: string, o: SewOpts = {}) =>
  sp(c, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], fill, o);

/** A single couched thread along points. */
export function thread(c: Ctx, pts: Pt[], col: string, lw = 1) {
  c.save();
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.strokeStyle = col;
  c.lineWidth = lw;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.setLineDash([2.2, 0.55]);
  c.stroke();
  c.restore();
}

/** A French knot: a raised dot of wool with a highlight. */
export function knot(c: Ctx, x: number, y: number, r: number, col: string) {
  c.fillStyle = col;
  c.beginPath();
  c.arc(x, y, r, 0, PI * 2);
  c.fill();
  c.strokeStyle = mix(col, '#000000', 0.35);
  c.lineWidth = 0.5;
  c.stroke();
  c.fillStyle = mix(col, '#ffffff', 0.35);
  c.beginPath();
  c.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, PI * 2);
  c.fill();
}

export function rrect(c: Ctx, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

/** Stitched lettering: solid serif letters with a running stitch over them. */
export function stext(
  c: Ctx,
  s: string,
  x: number,
  y: number,
  o: { size?: number; color?: string; align?: CanvasTextAlign; weight?: number; italic?: boolean } = {},
) {
  const size = o.size ?? 12;
  const wt = o.weight ?? 700;
  c.save();
  c.font = `${o.italic ? 'italic ' : ''}${wt} ${size}px ${SERIF}`;
  c.textAlign = o.align ?? 'left';
  c.textBaseline = 'middle';
  c.fillStyle = o.color ?? T.ink;
  c.fillText(s, x, y);
  c.setLineDash([1.2, 0.8]);
  c.strokeStyle = mix(o.color ?? T.ink, '#ffffff', 0.3);
  c.lineWidth = 0.35;
  c.strokeText(s, x, y);
  c.restore();
}

/** A tick mark in thread. */
export function check(c: Ctx, x: number, y: number, s: number, col: string, lw: number) {
  c.save();
  c.strokeStyle = col;
  c.lineWidth = lw;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  c.moveTo(x - s * 0.45, y);
  c.lineTo(x - s * 0.1, y + s * 0.35);
  c.lineTo(x + s * 0.5, y - s * 0.4);
  c.stroke();
  c.restore();
}

/** One of the tapestry border's slanted bars. */
export function bar(c: Ctx, x: number, y0: number, h: number, col: string) {
  sp(c, [[x - 3, y0 + h - 3], [x + 2, y0 + h - 3], [x + 8, y0 + 3], [x + 3, y0 + 3]], col, { ang: -1.2, noCouch: true, lw: 0.6 });
}

/** A border band: linen with an ink thread along each edge. */
export function band(c: Ctx, x: number, y0: number, w: number, h: number, s: number) {
  linen(c, x, y0, w, h, T.band, s);
  thread(c, [[x, y0 + 1.5], [x + w, y0 + 1.5]], T.ink, 1.2);
  thread(c, [[x, y0 + h - 1.5], [x + w, y0 + h - 1.5]], T.ink, 1.2);
}

/** A stitched card: linen with a laid fill and a stem-stitch edge. */
export function card(c: Ctx, x: number, y: number, w: number, h: number, fill: string = T.card, lw = 1.1, r = 4) {
  sew(c, (cc) => rrect(cc, x, y, w, h, r), fill, { bb: [x, y, x + w, y + h], ang: 0, noCouch: true, lw });
}

/** A fresh canvas of a size, with its 2D context. */
export function canvas(w: number, h: number): { cv: HTMLCanvasElement; c: Ctx } {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w));
  cv.height = Math.max(1, Math.ceil(h));
  return { cv, c: cv.getContext('2d')! };
}
