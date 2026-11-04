import Phaser from 'phaser';
import { sharpRes } from '../../../../shared/scaling';

// The storybook painting kit: every texture is painted on a 2D canvas in code, like a page of a
// herbalist's almanac. Shapes get layered watercolour washes whose pigment pools at the edges, wobbly
// ink outlines and hatched shadows, on cream paper. Canvases are painted at a higher resolution than
// they are shown, so the art stays crisp when the camera zooms in; `fit` scales an image back down.

export type Pt = [number, number];
export type Ctx = CanvasRenderingContext2D;

/** Dark brown ink for every outline and the interface's text. */
export const INK = '#2a1d14';
export const INK_NUM = 0x2a1d14;
/** Cream paper, the colour of the page under every wash. */
export const PAPER = '#cfc09c';
export const PAPER_NUM = 0xcfc09c;
/** A light cream used as the outline of ink text over the world, so it reads on grass and boards alike. */
export const TEXT_HALO = '#faf4e4';
/** The interface's serif, from the system: no web fonts are loaded. */
export const SERIF = 'Georgia, "Times New Roman", serif';

/** Watercolours shared across the art. */
export const WASH = {
  grass: '#5f8a42',
  grassDark: '#3f6a2e',
  grassLight: '#7a9c52',
  forest: '#2f5226',
  leaf: '#6f9e48',
  leafLight: '#7fae52',
  dirt: '#5e4430',
  dirtDark: '#3e2c1e',
  wood: '#c08850',
  woodDark: '#8a5a32',
  woodDeep: '#6e4426',
  planks: '#8e6038',
  stone: '#868c92',
  stoneDark: '#747a82',
  iron: '#3a3d48',
  ironRim: '#5a5f6c',
  brew: '#7fd04a',
  brass: '#d4a84a',
  brassDark: '#a87e2e',
  leather: '#7a5236',
  parchment: '#d8c8a2',
  card: '#cfb27c',
  button: '#c09a5e',
  violetCard: '#c6b4d6',
  bubble: '#e6dcc4',
  flame: '#f08a3a',
  flameLight: '#f5b03a',
  flameCore: '#ffe07a',
};

/** Item colours, matching ITEMS in the game's rules. */
export const ITEM_COL: Record<string, string> = {
  wheat: '#d9b24a',
  mandrake: '#b07a4a',
  flour: '#f1e8d0',
  mandrakeSeeds: '#6b4426',
  healingDraught: '#d9434b',
  sleepingTonic: '#6a5bd6',
  nightshade: '#4a3060',
  nightshadeExtract: '#5a3a78',
  shadowElixir: '#2f8a72',
  vigourTonic: '#e0862e',
  moonlightSalve: '#6fa8d6',
  witchsBrew: '#7a8f22',
  // The alchemy bench's potions (AP18).
  silverBalm: '#b8c8c0',
  marshCordial: '#c86a9a',
  frostDraught: '#8ad0e8',
  feverCure: '#5fb86a',
  starlightElixir: '#e8d070',
  plagueBane: '#3fa88a',
  murkyDraught: '#6a6248',
};

/** How many canvas pixels each texture has per pixel shown, by texture key. */
const RES = new Map<string, number>();

/** A small seeded random generator, so the hand-drawn wobble comes out the same on every load. */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/** The wobble's random numbers; reseeded for every texture so each paints the same way each time. */
let rnd = seeded(1);
export const reseed = (seed: number) => (rnd = seeded(seed));
export const rr = (a: number, b: number) => a + rnd() * (b - a);
export const chance = (p: number) => rnd() < p;

/**
 * Paints a texture `w` x `h` pixels as shown, on a canvas `res` times that, and adds it to the
 * scene's textures under `key`. `draw` paints in shown pixels. Replaces a texture of the same key.
 */
export function paint(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void, baseRes = 2, seed = hash(key)) {
  // `baseRes` is for a screen the game is shown on at its own size; a bigger screen gets more.
  const res = sharpRes(w, h, baseRes);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * res);
  canvas.height = Math.ceil(h * res);
  const c = canvas.getContext('2d')!;
  c.scale(res, res);
  reseed(seed);
  draw(c);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
  RES.set(key, res);
  return key;
}

/** Sizes an image or sprite showing a painted texture to `scale` times the texture's shown size. */
export function fit<T extends Phaser.GameObjects.Components.Transform & { texture: Phaser.Textures.Texture }>(obj: T, scale = 1): T {
  obj.setScale(scale / (RES.get(obj.texture.key) ?? 1));
  return obj;
}

/** How many canvas pixels a painted texture has per pixel shown. */
export const resOf = (key: string) => RES.get(key) ?? 1;

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** A colour lightened (f > 1, towards white) or darkened (f < 1). */
export function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.max(0, Math.min(255, Math.round(f >= 1 ? v + (255 - v) * (f - 1) : v * f))));
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// ---------- shapes ----------

export const ellPts = (cx: number, cy: number, rx: number, ry: number, n = 40): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry];
  });

export function rectPts(x: number, y: number, w: number, h: number, r = 0): Pt[] {
  if (!r) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const pts: Pt[] = [];
  const corner = (cx: number, cy: number, a0: number) => {
    for (let i = 0; i <= 4; i++) {
      const a = a0 + (i / 4) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2);
  corner(x + w - r, y + h - r, 0);
  corner(x + r, y + h - r, Math.PI / 2);
  corner(x + r, y + r, Math.PI);
  return pts;
}

/** Subdivides a path and jitters it, so an edge wanders like a hand-drawn line. */
export function wob(pts: Pt[], amt: number, closed = true, step = 7): Pt[] {
  const out: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.max(1, Math.round(len / step));
    for (let j = 0; j < k; j++) {
      const t = j / k;
      out.push([a[0] + (b[0] - a[0]) * t + rr(-amt, amt), a[1] + (b[1] - a[1]) * t + rr(-amt, amt)]);
    }
  }
  if (!closed) out.push(pts[n - 1]);
  return out;
}

export function pathOf(c: Ctx, pts: Pt[], closed = true) {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  if (closed) c.closePath();
}

export interface WashOpts {
  layers?: number;
  spread?: number;
  alpha?: number;
  /** Width of the darker rim where pigment pools; 0 for none. */
  edge?: number;
  /** Lighter blooms inside, around the point (cx, cy). */
  bloom?: number;
  cx?: number;
  cy?: number;
}

/** A watercolour wash: several thin, slightly shifted layers and a darker pooled rim. */
export function wash(c: Ctx, pts: Pt[], col: string, o: WashOpts = {}) {
  const layers = o.layers ?? 3;
  const spread = o.spread ?? 1.2;
  c.save();
  for (let i = 0; i < layers; i++) {
    pathOf(c, wob(pts, spread));
    c.fillStyle = rgba(col, Math.min(1, ((o.alpha ?? 0.9) / layers) * 1.6));
    c.fill();
  }
  // One solid layer underneath the last, so a small shape is never see-through.
  if ((o.alpha ?? 0.9) >= 0.9) {
    pathOf(c, pts);
    c.globalAlpha = 0.55;
    c.fillStyle = col;
    c.fill();
  }
  c.restore();
  const edge = o.edge ?? 1.6;
  if (edge > 0) {
    c.save();
    pathOf(c, wob(pts, spread * 0.4));
    c.lineWidth = edge;
    c.strokeStyle = rgba(shade(col, 0.72), 0.5);
    c.lineJoin = 'round';
    c.stroke();
    c.restore();
  }
  if (o.bloom && o.cx !== undefined && o.cy !== undefined) {
    c.save();
    pathOf(c, pts);
    c.clip();
    for (let i = 0; i < o.bloom; i++) {
      const p = pts[Math.floor(rr(0, pts.length))];
      const x = (p[0] + o.cx) / 2 + rr(-10, 10), y = (p[1] + o.cy) / 2 + rr(-10, 10), r = rr(6, 22);
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,250,235,0.14)');
      g.addColorStop(1, 'rgba(255,250,235,0)');
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    c.restore();
  }
}

export interface InkOpts {
  w?: number;
  wob?: number;
  alpha?: number;
  col?: string;
  closed?: boolean;
}

/** A wobbly ink line around (or along) a path, its width varying stroke by stroke like a nib. */
export function ink(c: Ctx, pts: Pt[], o: InkOpts = {}) {
  const closed = o.closed ?? true;
  const w = wob(pts, o.wob ?? 0.35, closed, 5);
  c.save();
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = o.col ?? INK;
  c.globalAlpha = o.alpha ?? 0.92;
  const width = o.w ?? 1.2;
  for (let i = 0; i < w.length - (closed ? 0 : 1); i++) {
    const a = w[i], b = w[(i + 1) % w.length];
    c.lineWidth = width * rr(0.75, 1.25);
    c.beginPath();
    c.moveTo(a[0], a[1]);
    c.lineTo(b[0], b[1]);
    c.stroke();
  }
  c.restore();
}

/** Hatched shadow: diagonal ink strokes clipped to a shape. */
export function hatch(c: Ctx, pts: Pt[], o: { gap?: number; alpha?: number; w?: number; col?: string } = {}) {
  c.save();
  pathOf(c, pts);
  c.clip();
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const x0 = Math.min(...xs) - (y1 - y0), x1 = Math.max(...xs) + 4;
  c.strokeStyle = o.col ?? INK;
  c.globalAlpha = o.alpha ?? 0.4;
  c.lineWidth = o.w ?? 0.6;
  for (let x = x0; x < x1; x += o.gap ?? 3) {
    c.beginPath();
    c.moveTo(x + rr(-0.4, 0.4), y1 + rr(-1, 1));
    c.lineTo(x + (y1 - y0) * 0.6 + rr(-0.4, 0.4), y0 + rr(-1, 1));
    c.stroke();
  }
  c.restore();
}

/** A wash with an ink outline over it. */
export function both(c: Ctx, pts: Pt[], col: string, o: WashOpts = {}, line: InkOpts = {}) {
  wash(c, pts, col, o);
  ink(c, pts, line);
}

/** A soft shadow on the ground, cast down and to the right, away from the light at the top left. */
export function shadow(c: Ctx, cx: number, cy: number, rx: number, ry: number, a = 0.2) {
  c.save();
  c.fillStyle = `rgba(42,29,20,${a})`;
  pathOf(c, ellPts(cx, cy, rx, ry, 24));
  c.fill();
  c.restore();
}

/** A paper texture: cream with speckled grain and faint fibres. */
export function paper(c: Ctx, x: number, y: number, w: number, h: number, base = PAPER) {
  c.fillStyle = base;
  c.fillRect(x, y, w, h);
  const n = Math.round((w * h) / 90);
  for (let i = 0; i < n; i++) {
    c.fillStyle = chance(0.5) ? 'rgba(120,90,50,0.06)' : 'rgba(255,255,255,0.08)';
    c.fillRect(x + rr(0, w), y + rr(0, h), rr(0.6, 1.6), rr(0.6, 1.6));
  }
  for (let i = 0; i < n / 30; i++) {
    c.strokeStyle = `rgba(150,120,80,${rr(0.03, 0.08)})`;
    c.lineWidth = 0.6;
    const px = x + rr(0, w), py = y + rr(0, h);
    c.beginPath();
    c.moveTo(px, py);
    c.quadraticCurveTo(px + rr(-6, 6), py + rr(-6, 6), px + rr(-14, 14), py + rr(-14, 14));
    c.stroke();
  }
}

/** Text painted on a canvas, in the serif, optionally with a halo so it reads on any ground. */
export function letter(c: Ctx, t: string, x: number, y: number, o: { size?: number; weight?: number; fill?: string; halo?: string | false; align?: CanvasTextAlign } = {}) {
  c.save();
  c.font = `${o.weight ?? 700} ${o.size ?? 12}px ${SERIF}`;
  c.textAlign = o.align ?? 'center';
  c.textBaseline = 'middle';
  if (o.halo) {
    c.lineJoin = 'round';
    c.lineWidth = 3;
    c.strokeStyle = o.halo;
    c.strokeText(t, x, y);
  }
  c.fillStyle = o.fill ?? INK;
  c.fillText(t, x, y);
  c.restore();
}

// ---------- shared pieces: items and coins ----------

/** A coin: gold disc with a lighter face and a shaded half, ink rimmed. */
export function coinIcon(c: Ctx, x: number, y: number, r: number) {
  c.save();
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fillStyle = '#e9b93a';
  c.fill();
  c.lineWidth = Math.max(0.8, r * 0.14);
  c.strokeStyle = INK;
  c.stroke();
  c.beginPath();
  c.arc(x, y, r * 0.64, 0, Math.PI * 2);
  c.fillStyle = '#f7d878';
  c.fill();
  c.fillStyle = '#c4922e';
  c.beginPath();
  c.arc(x, y, r * 0.64, -0.2, Math.PI * 0.8);
  c.fill();
  c.restore();
}

/** A four-pointed gold sparkle centred on (x, y), `r` from its middle to a point, for fine potions. */
export function sparkle(c: Ctx, x: number, y: number, r: number) {
  c.save();
  c.beginPath();
  for (let k = 0; k < 8; k++) {
    const d = k % 2 === 0 ? r : r * 0.32;
    const a = (k / 8) * Math.PI * 2 - Math.PI / 2;
    c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  c.closePath();
  c.fillStyle = '#f2c84a';
  c.fill();
  c.lineWidth = Math.max(0.6, r * 0.16);
  c.strokeStyle = INK;
  c.stroke();
  c.restore();
}

/** The potions, each drawn as its own flask. */
const POTION_SHAPES = {
  healingDraught: 1,
  sleepingTonic: 1,
  vigourTonic: 1,
  shadowElixir: 1,
  moonlightSalve: 1,
  witchsBrew: 1,
  // The bench's potions borrow the flask shapes; the unnamed ones are cones.
  silverBalm: 1,
  marshCordial: 1,
  frostDraught: 1,
  feverCure: 1,
  starlightElixir: 1,
  plagueBane: 1,
  murkyDraught: 1,
};

/**
 * An item, centred on (x, y) and about `s` pixels tall, washed in its colour with an ink outline:
 * a flask for each potion, a sheaf of wheat, a mandrake root with its leaves, a sprig of nightshade
 * berries, and a sack for flour, seeds and extract. A fine potion is its flask with a gold sparkle.
 */
export function itemIcon(c: Ctx, kind: string, x: number, y: number, s: number) {
  if (kind.startsWith('fine')) {
    const plain = kind[4].toLowerCase() + kind.slice(5);
    itemIcon(c, plain, x, y, s);
    sparkle(c, x + s * 0.3, y - s * 0.3, s * 0.24);
    return;
  }
  const col = ITEM_COL[kind];
  const lw = Math.max(0.7, s * 0.055);
  const out = () => {
    c.lineWidth = lw;
    c.strokeStyle = INK;
    c.stroke();
  };
  c.save();
  c.translate(x, y);
  c.lineJoin = 'round';
  c.lineCap = 'round';
  if (kind in POTION_SHAPES) {
    const round = kind === 'healingDraught' || kind === 'witchsBrew' || kind === 'starlightElixir' || kind === 'murkyDraught';
    // A round flask, a cone, a squat jar, a slim vial, a fat round pot, or for the Shadow Elixir a
    // tall square-shouldered bottle.
    const body = () => {
      c.beginPath();
      if (kind === 'witchsBrew') c.arc(0, s * 0.14, s * 0.36, 0, Math.PI * 2);
      else if (round) c.arc(0, s * 0.12, s * 0.33, 0, Math.PI * 2);
      else if (kind === 'vigourTonic' || kind === 'marshCordial') {
        c.moveTo(-s * 0.1, -s * 0.24);
        c.lineTo(s * 0.1, -s * 0.24);
        c.lineTo(s * 0.3, -s * 0.04);
        c.lineTo(s * 0.3, s * 0.44);
        c.lineTo(-s * 0.3, s * 0.44);
        c.lineTo(-s * 0.3, -s * 0.04);
        c.closePath();
      } else if (kind === 'moonlightSalve' || kind === 'silverBalm') {
        c.moveTo(-s * 0.1, -s * 0.24);
        c.lineTo(s * 0.1, -s * 0.24);
        c.lineTo(s * 0.14, s * 0.3);
        c.quadraticCurveTo(0, s * 0.56, -s * 0.14, s * 0.3);
        c.closePath();
      } else if (kind === 'shadowElixir' || kind === 'plagueBane') {
        c.moveTo(-s * 0.1, -s * 0.24);
        c.lineTo(s * 0.1, -s * 0.24);
        c.lineTo(s * 0.22, -s * 0.1);
        c.lineTo(s * 0.22, s * 0.44);
        c.lineTo(-s * 0.22, s * 0.44);
        c.lineTo(-s * 0.22, -s * 0.1);
        c.closePath();
      } else {
        c.moveTo(-s * 0.1, -s * 0.24);
        c.lineTo(s * 0.1, -s * 0.24);
        c.lineTo(s * 0.34, s * 0.42);
        c.lineTo(-s * 0.34, s * 0.42);
        c.closePath();
      }
    };
    c.fillStyle = '#d8e6ee';
    c.beginPath();
    c.rect(-s * 0.1, -s * 0.44, s * 0.2, s * 0.22);
    c.fill();
    out();
    c.fillStyle = '#8a5a32';
    c.beginPath();
    c.rect(-s * 0.13, -s * 0.54, s * 0.26, s * 0.11);
    c.fill();
    out();
    body();
    c.fillStyle = '#eef4f6';
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = col;
    c.fillRect(-s, round ? -s * 0.02 : s * 0.02, s * 2, s);
    // The shaded side, away from the light.
    c.fillStyle = rgba(shade(col, 0.6), 0.6);
    c.beginPath();
    c.moveTo(s * 0.08, -s);
    c.lineTo(s, -s);
    c.lineTo(s, s);
    c.lineTo(s * 0.12, s);
    c.closePath();
    c.fill();
    c.restore();
    body();
    out();
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.beginPath();
    c.ellipse(-s * 0.13, s * 0.04, s * 0.045, s * 0.11, 0.4, 0, Math.PI * 2);
    c.fill();
  } else if (kind === 'wheat') {
    c.strokeStyle = shade(col, 0.55);
    c.lineWidth = s * 0.06;
    for (const a of [-0.35, 0, 0.35]) {
      c.beginPath();
      c.moveTo(0, s * 0.46);
      c.lineTo(Math.sin(a) * s * 0.48, -s * 0.18);
      c.stroke();
    }
    for (const a of [-0.35, 0, 0.35]) {
      const hx = Math.sin(a) * s * 0.48, hy = -s * 0.24;
      c.fillStyle = col;
      c.beginPath();
      c.ellipse(hx, hy, s * 0.11, s * 0.23, a, 0, Math.PI * 2);
      c.fill();
      out();
      c.strokeStyle = rgba(INK, 0.5);
      c.lineWidth = lw * 0.6;
      for (let k = -1; k <= 1; k++) {
        c.beginPath();
        c.moveTo(hx - s * 0.06, hy + k * s * 0.08);
        c.lineTo(hx + s * 0.06, hy + k * s * 0.08 - s * 0.03);
        c.stroke();
      }
    }
    c.fillStyle = '#8a5a32';
    c.fillRect(-s * 0.16, s * 0.12, s * 0.32, s * 0.08);
    c.strokeStyle = INK;
    c.lineWidth = lw * 0.8;
    c.strokeRect(-s * 0.16, s * 0.12, s * 0.32, s * 0.08);
  } else if (kind === 'nightshade') {
    // A sprig: two leaves, a violet star flower and a cluster of dark berries.
    c.fillStyle = '#4f8a3a';
    for (const a of [-0.7, 0.7]) {
      c.beginPath();
      c.ellipse(Math.sin(a) * s * 0.2, -s * 0.18, s * 0.1, s * 0.24, a, 0, Math.PI * 2);
      c.fill();
      out();
    }
    c.strokeStyle = shade('#4f8a3a', 0.6);
    c.lineWidth = s * 0.05;
    c.beginPath();
    c.moveTo(0, -s * 0.1);
    c.lineTo(0, s * 0.2);
    c.stroke();
    for (const [bx, by] of [[-0.13, 0.22], [0.12, 0.24], [0, 0.36], [-0.02, 0.12]]) {
      c.fillStyle = col;
      c.beginPath();
      c.arc(bx * s, by * s, s * 0.11, 0, Math.PI * 2);
      c.fill();
      out();
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.beginPath();
      c.arc(bx * s - s * 0.035, by * s - s * 0.035, s * 0.03, 0, Math.PI * 2);
      c.fill();
    }
    c.fillStyle = '#9a7ad8';
    c.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 === 0 ? s * 0.12 : s * 0.05;
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      c.lineTo(Math.cos(a) * r, -s * 0.38 + Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    out();
  } else if (kind === 'mandrake') {
    c.fillStyle = '#5c9a3c';
    for (const a of [-0.6, 0, 0.6]) {
      c.beginPath();
      c.ellipse(Math.sin(a) * s * 0.18, -s * 0.32, s * 0.08, s * 0.2, a, 0, Math.PI * 2);
      c.fill();
      out();
    }
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(-s * 0.24, -s * 0.12);
    c.quadraticCurveTo(0, -s * 0.26, s * 0.24, -s * 0.12);
    c.quadraticCurveTo(s * 0.18, s * 0.2, s * 0.06, s * 0.48);
    c.lineTo(-s * 0.06, s * 0.48);
    c.quadraticCurveTo(-s * 0.18, s * 0.2, -s * 0.24, -s * 0.12);
    c.closePath();
    c.fill();
    c.fillStyle = rgba(shade(col, 0.6), 0.5);
    c.fillRect(0, -s * 0.2, s * 0.3, s * 0.7);
    c.beginPath();
    c.moveTo(-s * 0.24, -s * 0.12);
    c.quadraticCurveTo(0, -s * 0.26, s * 0.24, -s * 0.12);
    c.quadraticCurveTo(s * 0.18, s * 0.2, s * 0.06, s * 0.48);
    c.lineTo(-s * 0.06, s * 0.48);
    c.quadraticCurveTo(-s * 0.18, s * 0.2, -s * 0.24, -s * 0.12);
    c.closePath();
    out();
    // A grumpy little face.
    c.fillStyle = INK;
    c.fillRect(-s * 0.11, -s * 0.06, s * 0.06, s * 0.06);
    c.fillRect(s * 0.05, -s * 0.06, s * 0.06, s * 0.06);
    c.fillRect(-s * 0.05, s * 0.08, s * 0.1, s * 0.03);
  } else {
    // A tied sack: flour pale, mandrake seeds dark.
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(-s * 0.14, -s * 0.3);
    c.lineTo(s * 0.14, -s * 0.3);
    c.lineTo(s * 0.38, s * 0.38);
    c.quadraticCurveTo(0, s * 0.5, -s * 0.38, s * 0.38);
    c.closePath();
    c.fill();
    c.save();
    c.clip();
    c.fillStyle = rgba(shade(col, 0.7), 0.6);
    c.fillRect(s * 0.04, -s, s, s * 2);
    c.restore();
    c.beginPath();
    c.moveTo(-s * 0.14, -s * 0.3);
    c.lineTo(s * 0.14, -s * 0.3);
    c.lineTo(s * 0.38, s * 0.38);
    c.quadraticCurveTo(0, s * 0.5, -s * 0.38, s * 0.38);
    c.closePath();
    out();
    c.beginPath();
    c.moveTo(-s * 0.1, -s * 0.3);
    c.lineTo(-s * 0.16, -s * 0.46);
    c.moveTo(s * 0.1, -s * 0.3);
    c.lineTo(s * 0.16, -s * 0.46);
    out();
    c.fillStyle = '#8a5a32';
    c.fillRect(-s * 0.18, -s * 0.31, s * 0.36, s * 0.08);
    c.fillStyle = kind === 'flour' ? '#c9a24a' : kind === 'nightshadeExtract' ? '#c8b0f0' : '#e0b070';
    c.beginPath();
    c.arc(0, s * 0.12, s * 0.08, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}
