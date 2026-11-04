import Phaser from 'phaser';
import { sharpRes } from '../../../../shared/scaling';

// The wooden toy set's toolkit: painted beech blocks with rounded edges and grain showing through
// the paint, peg trees, block houses and towers with flags on dowels. Textures are painted on 2D
// canvases and added with `textures.addCanvas`. The painters work in "art units", twice the game's
// 960x540 view (the approved mockup's scale). Each canvas is `RES` texture pixels per view pixel
// (more on a big screen, see `sharpRes`), and `addArt` shows the textures at the view's own size.

export const PI = Math.PI;
/** Art units per view pixel. */
export const ART = 2;
/** Texture pixels per view pixel, the same for every texture; 1 until `setArtRes`. */
export let RES = 1;

/** Picks `RES` for this screen: as sharp as the biggest texture, the view-sized `bg`, can be painted. */
export function setArtRes(viewW: number, viewH: number) {
  RES = sharpRes(viewW, viewH);
}

/** An image of a baked texture, shown at its size in view pixels. */
export function addArt(scene: Phaser.Scene, x: number, y: number, key: string) {
  return scene.add.image(x, y, key).setScale(1 / RES);
}

/** The toy set's paints, as CSS colours. */
export const T = {
  beech: '#e2bf8a',
  beechD: '#b88a52',
  walnut: '#7a4e2c',
  walnutD: '#4e2f19',
  green: '#5fae4c',
  blue: '#3b86d6',
  red: '#d9573c',
  yellow: '#f2c33a',
  cream: '#fff6e2',
  ink: '#3a2414',
  navy: '#27406e',
  soil: '#a8743f',
  sign: '#f3e4c4',
  tick: '#4f9e3a',
};

/** The canvas being painted; set by `bake` for the duration of one painter. */
export let ctx: CanvasRenderingContext2D;

let seed = 7;
/** A seeded random number, so the grain looks the same on every visit and never touches Math.random. */
export const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
export const reseed = (s: number) => {
  seed = s;
  for (let i = 0; i < 3; i++) rnd();
};

/**
 * Paints a `w` x `h` (view pixels, `RES` times that in texture pixels) texture called `key`. The painter draws in art units with
 * (0, 0) at view pixel (`ox`, `oy`) of the texture, so a shape can be painted around its anchor.
 */
export function bake(scene: Phaser.Scene, key: string, w: number, h: number, paint: () => void, ox = 0, oy = 0) {
  if (scene.textures.exists(key)) return;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * RES);
  canvas.height = Math.ceil(h * RES);
  ctx = canvas.getContext('2d')!;
  ctx.scale(RES, RES);
  ctx.translate(ox, oy);
  ctx.scale(1 / ART, 1 / ART);
  paint();
  scene.textures.addCanvas(key, canvas);
}

const mix = (a: string, b: string, t: number) => {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('');
};
export const lit = (c: string, t: number) => mix(c, '#ffffff', t);
export const dark = (c: string, t: number) => mix(c, '#000000', t);

/** Canvas shadows ignore the transform, so they are given in art units and turned into canvas pixels here. */
export function shadow(blur: number, ox: number, oy: number, color: string) {
  ctx.shadowColor = color;
  ctx.shadowBlur = (blur * RES) / ART;
  ctx.shadowOffsetX = (ox * RES) / ART;
  ctx.shadowOffsetY = (oy * RES) / ART;
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

export function poly(pts: number[][], fill: string) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function circle(x: number, y: number, r: number, fill: string | CanvasGradient, stroke?: string, lw = 2) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

/** Wavy grain lines across a box, clipped to it. */
export function grain(x: number, y: number, w: number, h: number, col: string, n: number, wav = 3, alpha = 0.18) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = col;
  ctx.globalAlpha = alpha;
  for (let i = 0; i < n; i++) {
    const yy = y + ((i + rnd() * 0.6) * h) / n;
    const ph = rnd() * 6;
    const f = 0.01 + rnd() * 0.02;
    ctx.lineWidth = 0.8 + rnd() * 1.6;
    ctx.beginPath();
    for (let xx = x - 4; xx <= x + w + 4; xx += 8) ctx.lineTo(xx, yy + Math.sin(xx * f + ph) * wav);
    ctx.stroke();
  }
  ctx.restore();
}

/** A rounded painted block face with a darker edge below, a soft highlight and grain through the paint. */
export function tile(x: number, y: number, w: number, h: number, r: number, col: string, opts: { blur?: number; grain?: number } = {}) {
  ctx.save();
  shadow(opts.blur ?? 10, 4, 6, 'rgba(60,35,15,0.35)');
  rrect(x, y + 6, w, h, r);
  ctx.fillStyle = dark(col, 0.35);
  ctx.fill();
  ctx.restore();
  rrect(x, y, w, h, r);
  const g = ctx.createLinearGradient(x, y, x + w * 0.4, y + h);
  g.addColorStop(0, lit(col, 0.16));
  g.addColorStop(1, dark(col, 0.08));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  rrect(x, y, w, h, r);
  ctx.clip();
  grain(x, y, w, h, dark(col, 0.5), opts.grain ?? 9, 3, 0.16);
  ctx.restore();
  ctx.save();
  rrect(x + 3, y + 3, w - 6, h - 6, Math.max(1, r - 2));
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
}

/** A walnut board with dark grain and a light rim, as for the tray and the panel. */
export function walnut(x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  shadow(24, 8, 12, 'rgba(50,30,10,0.45)');
  rrect(x, y, w, h, r);
  ctx.fillStyle = T.walnut;
  ctx.fill();
  ctx.restore();
  ctx.save();
  rrect(x, y, w, h, r);
  ctx.clip();
  grain(x, y, w, h, '#2a170a', Math.round(h / 26), 5, 0.25);
  ctx.restore();
  rrect(x, y, w, h, r);
  ctx.strokeStyle = 'rgba(255,220,170,0.25)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

export function shadowBlob(x: number, y: number, rx: number, ry: number, a = 0.3) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(40,25,10,${a})`);
  g.addColorStop(1, 'rgba(40,25,10,0)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rx, 0, PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A turned wooden ball, lit from the top left. */
export function ball(x: number, y: number, r: number, col: string) {
  const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, lit(col, 0.35));
  g.addColorStop(0.6, col);
  g.addColorStop(1, dark(col, 0.3));
  circle(x, y, r, g);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, PI * 2);
  ctx.clip();
  grain(x - r, y - r, 2 * r, 2 * r, dark(col, 0.5), 5, 2, 0.12);
  ctx.restore();
}

/** A peg tree: a dowel trunk and a green ball. */
export function peg(x: number, y: number, s = 1) {
  shadowBlob(x + 10 * s, y + 4 * s, 22 * s, 9 * s, 0.35);
  const g = ctx.createLinearGradient(x - 3 * s, 0, x + 3 * s, 0);
  g.addColorStop(0, '#d8ad72');
  g.addColorStop(1, '#9a6a3a');
  ctx.fillStyle = g;
  rrect(x - 3.5 * s, y - 18 * s, 7 * s, 20 * s, 3 * s);
  ctx.fill();
  ball(x, y - 30 * s, 17 * s, T.green);
}

/** A painted block: a rounded front face and a side face to the right, at a shallow oblique depth `d`. */
function box(x0: number, y0: number, w: number, h: number, d: number, col: string) {
  poly(
    [
      [x0 + w, y0],
      [x0 + w + d, y0 - d * 0.8],
      [x0 + w + d, y0 + h - d * 0.8],
      [x0 + w, y0 + h],
    ],
    dark(col, 0.25),
  );
  rrect(x0, y0, w, h, 5);
  const g = ctx.createLinearGradient(x0, y0, x0, y0 + h);
  g.addColorStop(0, lit(col, 0.1));
  g.addColorStop(1, dark(col, 0.06));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  rrect(x0, y0, w, h, 5);
  ctx.clip();
  grain(x0, y0, w, h, dark(col, 0.5), 6, 2, 0.14);
  ctx.restore();
}

/** A block house with a red prism roof, a navy door and yellow windows. */
export function house(x: number, y: number, s = 1) {
  shadowBlob(x + 14 * s, y + 30 * s, 44 * s, 12 * s, 0.38);
  const w = 52 * s;
  const h = 32 * s;
  const d = 12 * s;
  const x0 = x - w / 2 - 4 * s;
  const y0 = y - 2 * s;
  box(x0, y0, w, h, d, T.cream);
  const rh = 26 * s;
  const ov = 6 * s;
  const front = [
    [x0 - ov, y0 + 2 * s],
    [x0 + w + ov, y0 + 2 * s],
    [x0 + w / 2 + ov * 0.2 + w * 0.32, y0 - rh],
    [x0 + w / 2 - w * 0.32, y0 - rh],
  ];
  const sideR = [
    [x0 + w + ov, y0 + 2 * s],
    [x0 + w + ov + d, y0 + 2 * s - d * 0.8],
    [x0 + w / 2 + w * 0.32 + d, y0 - rh - d * 0.8],
    front[2],
  ];
  poly(sideR, dark(T.red, 0.3));
  poly(
    [front[3], front[2], [front[2][0] + d, front[2][1] - d * 0.8], [front[3][0] + d, front[3][1] - d * 0.8]],
    lit(T.red, 0.2),
  );
  ctx.beginPath();
  front.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y0 - rh, 0, y0);
  g.addColorStop(0, lit(T.red, 0.15));
  g.addColorStop(1, dark(T.red, 0.08));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  grain(x0 - ov, y0 - rh, w + 2 * ov, rh + 4, dark(T.red, 0.5), 4, 2, 0.15);
  ctx.restore();
  rrect(x - 8 * s, y0 + h - 18 * s, 12 * s, 18 * s, 5 * s);
  ctx.fillStyle = T.navy;
  ctx.fill();
  for (const wx of [x0 + 7 * s, x0 + w - 17 * s]) {
    rrect(wx, y0 + 8 * s, 10 * s, 10 * s, 3 * s);
    ctx.fillStyle = T.yellow;
    ctx.fill();
  }
}

/** A round stone tower with a crenellated cap and a blue flag on a dowel. */
export function tower(x: number, y: number, s = 1) {
  shadowBlob(x + 16 * s, y + 32 * s, 40 * s, 12 * s, 0.4);
  const w = 42 * s;
  const top = y - 26 * s;
  const base = y + 30 * s;
  const g = ctx.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, '#d9d4cb');
  g.addColorStop(0.3, '#f4f0e8');
  g.addColorStop(1, '#8f8a82');
  ctx.beginPath();
  ctx.moveTo(x - w / 2, top);
  ctx.lineTo(x - w / 2, base);
  ctx.ellipse(x, base, w / 2, 7 * s, 0, PI, 0, true);
  ctx.lineTo(x + w / 2, top);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  grain(x - w / 2, top, w, base - top + 8, '#6a6258', 6, 2, 0.12);
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(x, top, w / 2 + 4 * s, 8 * s, 0, 0, PI * 2);
  ctx.fillStyle = '#b3aea5';
  ctx.fill();
  for (const k of [-1, -0.33, 0.33, 1]) {
    const mx = x + k * (w / 2 - 3 * s);
    const gg = ctx.createLinearGradient(mx - 5 * s, 0, mx + 5 * s, 0);
    gg.addColorStop(0, '#f2eee6');
    gg.addColorStop(1, '#a29c93');
    rrect(mx - 6 * s, top - 13 * s, 12 * s, 15 * s, 3 * s);
    ctx.fillStyle = gg;
    ctx.fill();
  }
  rrect(x - 6 * s, base - 22 * s, 12 * s, 20 * s, 6 * s);
  ctx.fillStyle = T.navy;
  ctx.fill();
  rrect(x - 3 * s, top + 12 * s, 6 * s, 12 * s, 3 * s);
  ctx.fillStyle = T.navy;
  ctx.fill();
  ctx.strokeStyle = '#9a6a3a';
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, top - 8 * s);
  ctx.lineTo(x, top - 36 * s);
  ctx.stroke();
  rrect(x, top - 37 * s, 24 * s, 14 * s, 3 * s);
  ctx.fillStyle = T.blue;
  ctx.fill();
  ball(x, top - 38 * s, 3.5 * s, T.yellow);
}

/** A windmill: a tapered cream block with a navy cap and four yellow sails on a navy hub. */
export function windmill(x: number, y: number, s = 1) {
  shadowBlob(x + 14 * s, y + 32 * s, 40 * s, 12 * s, 0.4);
  const base = y + 30 * s;
  const top = y - 14 * s;
  const body = [
    [x - 21 * s, base],
    [x + 21 * s, base],
    [x + 14 * s, top],
    [x - 14 * s, top],
  ];
  poly(
    [
      [x + 21 * s, base],
      [x + 28 * s, base - 6 * s],
      [x + 20 * s, top - 5 * s],
      [x + 14 * s, top],
    ],
    dark(T.cream, 0.25),
  );
  ctx.beginPath();
  body.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  const g = ctx.createLinearGradient(x - 21 * s, 0, x + 21 * s, 0);
  g.addColorStop(0, lit(T.cream, 0.1));
  g.addColorStop(1, dark(T.cream, 0.12));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  grain(x - 22 * s, top, 44 * s, base - top, dark(T.cream, 0.5), 6, 2, 0.14);
  ctx.restore();
  // a navy cap
  ctx.beginPath();
  ctx.ellipse(x + 1 * s, top, 17 * s, 13 * s, 0, PI, 0);
  ctx.closePath();
  const cg = ctx.createLinearGradient(0, top - 13 * s, 0, top);
  cg.addColorStop(0, lit(T.navy, 0.25));
  cg.addColorStop(1, dark(T.navy, 0.1));
  ctx.fillStyle = cg;
  ctx.fill();
  rrect(x - 6 * s, base - 16 * s, 12 * s, 16 * s, 6 * s);
  ctx.fillStyle = T.navy;
  ctx.fill();
  // four sails as painted slats on spokes
  const hx = x + 1 * s;
  const hy = top - 2 * s;
  for (const a of [0.5, 2.07, 3.64, 5.21]) {
    const ex = hx + Math.cos(a) * 36 * s;
    const ey = hy + Math.sin(a) * 36 * s;
    ctx.strokeStyle = '#9a6a3a';
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    // the sail sits on one side of its spoke
    const nx = -Math.sin(a) * 9 * s;
    const ny = Math.cos(a) * 9 * s;
    const sx = hx + Math.cos(a) * 10 * s;
    const sy = hy + Math.sin(a) * 10 * s;
    poly(
      [
        [sx, sy],
        [ex, ey],
        [ex + nx, ey + ny],
        [sx + nx * 0.7, sy + ny * 0.7],
      ],
      T.yellow,
    );
    ctx.strokeStyle = dark(T.yellow, 0.3);
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();
  }
  ball(hx, hy, 5 * s, T.navy);
}

/** A prism roof over a block from x0 to x0 + w at y0, `rh` high, with the block's depth `d`. */
function roof(x0: number, y0: number, w: number, rh: number, d: number, ov: number, col: string) {
  const front = [
    [x0 - ov, y0 + 2],
    [x0 + w + ov, y0 + 2],
    [x0 + w * 0.82 + ov * 0.2, y0 - rh],
    [x0 + w * 0.18, y0 - rh],
  ];
  poly([[x0 + w + ov, y0 + 2], [x0 + w + ov + d, y0 + 2 - d * 0.8], [front[2][0] + d, front[2][1] - d * 0.8], front[2]], dark(col, 0.3));
  poly([front[3], front[2], [front[2][0] + d, front[2][1] - d * 0.8], [front[3][0] + d, front[3][1] - d * 0.8]], lit(col, 0.2));
  ctx.beginPath();
  front.forEach(([px, py], i) => (i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)));
  ctx.closePath();
  const g = ctx.createLinearGradient(0, y0 - rh, 0, y0);
  g.addColorStop(0, lit(col, 0.15));
  g.addColorStop(1, dark(col, 0.08));
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.clip();
  grain(x0 - ov, y0 - rh, w + 2 * ov, rh + 4, dark(col, 0.5), 4, 2, 0.15);
  ctx.restore();
}

/** A dowel: a turned wooden rod from (x1, y1) to (x2, y2). */
function dowel(x1: number, y1: number, x2: number, y2: number, w: number) {
  ctx.strokeStyle = '#9a6a3a';
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

/** A manor: a wide two-storey cream block with a red roof, a chimney, a navy door and six windows. */
export function manor(x: number, y: number, s = 1) {
  shadowBlob(x + 14 * s, y + 32 * s, 54 * s, 13 * s, 0.4);
  const w = 72 * s;
  const h = 44 * s;
  const d = 12 * s;
  const x0 = x - w / 2 - 4 * s;
  const y0 = y - 12 * s;
  box(x0, y0, w, h, d, T.cream);
  rrect(x0 + w * 0.62, y0 - 34 * s, 9 * s, 22 * s, 2 * s);
  ctx.fillStyle = dark(T.red, 0.2);
  ctx.fill();
  roof(x0, y0, w, 24 * s, d, 6 * s, T.red);
  rrect(x - 8 * s, y0 + h - 18 * s, 12 * s, 18 * s, 5 * s);
  ctx.fillStyle = T.navy;
  ctx.fill();
  for (const wx of [x0 + 6 * s, x0 + 22 * s, x0 + w - 32 * s, x0 + w - 16 * s])
    for (const wy of wx === x0 + 22 * s || wx === x0 + w - 32 * s ? [y0 + 6 * s] : [y0 + 6 * s, y0 + 24 * s]) {
      rrect(wx, wy, 10 * s, 10 * s, 3 * s);
      ctx.fillStyle = T.yellow;
      ctx.fill();
    }
  // a blue pennant on a dowel above the ridge
  dowel(x - 14 * s, y0 - 22 * s, x - 14 * s, y0 - 46 * s, 3 * s);
  rrect(x - 14 * s, y0 - 47 * s, 20 * s, 12 * s, 3 * s);
  ctx.fillStyle = T.blue;
  ctx.fill();
  ball(x - 14 * s, y0 - 48 * s, 3.5 * s, T.yellow);
}

/** A market stall: a beech counter with fruit balls under a red and cream striped awning on dowels. */
export function market(x: number, y: number, s = 1) {
  shadowBlob(x + 12 * s, y + 30 * s, 46 * s, 12 * s, 0.38);
  const w = 56 * s;
  const d = 10 * s;
  const x0 = x - w / 2 - 3 * s;
  dowel(x0 + 3 * s, y + 24 * s, x0 + 3 * s, y - 30 * s, 3.5 * s);
  dowel(x0 + w - 3 * s, y + 24 * s, x0 + w - 3 * s, y - 30 * s, 3.5 * s);
  box(x0, y + 4 * s, w, 22 * s, d, T.beech);
  for (const [fx, col] of [
    [x0 + 10 * s, T.red],
    [x0 + 22 * s, T.yellow],
    [x0 + 34 * s, T.green],
    [x0 + 46 * s, '#e08a2a'],
  ] as const)
    ball(fx, y, 6 * s, col);
  // the awning: a sloped board of stripes with a scalloped edge
  const top = y - 40 * s;
  const bottom = y - 22 * s;
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a = x0 - 6 * s + ((w + 12 * s) * i) / n;
    const b = x0 - 6 * s + ((w + 12 * s) * (i + 1)) / n;
    const col = i % 2 ? T.cream : T.red;
    poly([[a + 4 * s, top], [b + 4 * s, top], [b, bottom], [a, bottom]], col);
    ctx.beginPath();
    ctx.arc((a + b) / 2, bottom, (b - a) / 2, 0, PI);
    ctx.fillStyle = col;
    ctx.fill();
  }
  poly([[x0 + w + 10 * s, top], [x0 + w + 10 * s + d, top - d * 0.8], [x0 + w + 6 * s + d, bottom - d * 0.8], [x0 + w + 6 * s, bottom]], dark(T.red, 0.3));
}

/** A harbor: a plank jetty on posts with a little blue boat and a cream sail. */
export function harbor(x: number, y: number, s = 1) {
  shadowBlob(x + 10 * s, y + 26 * s, 48 * s, 12 * s, 0.35);
  // the jetty
  for (const px of [-30, -6, 18]) {
    rrect(x + px * s, y + 4 * s, 7 * s, 22 * s, 3 * s);
    ctx.fillStyle = '#9a6a3a';
    ctx.fill();
  }
  rrect(x - 36 * s, y - 6 * s, 66 * s, 14 * s, 4 * s);
  ctx.fillStyle = T.beech;
  ctx.fill();
  ctx.strokeStyle = dark(T.beech, 0.35);
  ctx.lineWidth = 1.5 * s;
  for (const px of [-20, -4, 12]) {
    ctx.beginPath();
    ctx.moveTo(x + px * s, y - 6 * s);
    ctx.lineTo(x + px * s, y + 8 * s);
    ctx.stroke();
  }
  ball(x - 30 * s, y - 10 * s, 5 * s, T.navy);
  // the boat, moored alongside
  const bx = x + 8 * s;
  const by = y + 22 * s;
  ctx.beginPath();
  ctx.moveTo(bx - 30 * s, by - 10 * s);
  ctx.lineTo(bx + 30 * s, by - 10 * s);
  ctx.quadraticCurveTo(bx + 24 * s, by + 8 * s, bx, by + 8 * s);
  ctx.quadraticCurveTo(bx - 24 * s, by + 8 * s, bx - 30 * s, by - 10 * s);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, by - 10 * s, 0, by + 8 * s);
  g.addColorStop(0, lit(T.blue, 0.15));
  g.addColorStop(1, dark(T.blue, 0.2));
  ctx.fillStyle = g;
  ctx.fill();
  rrect(bx - 30 * s, by - 12 * s, 60 * s, 5 * s, 2 * s);
  ctx.fillStyle = T.cream;
  ctx.fill();
  dowel(bx, by - 10 * s, bx, by - 62 * s, 3 * s);
  poly([[bx + 3 * s, by - 60 * s], [bx + 3 * s, by - 16 * s], [bx + 30 * s, by - 16 * s]], T.cream);
  poly([[bx - 3 * s, by - 52 * s], [bx - 3 * s, by - 16 * s], [bx - 22 * s, by - 16 * s]], lit(T.yellow, 0.3));
  ball(bx, by - 64 * s, 3.5 * s, T.yellow);
}

/** A lumber camp: a little hut with a green roof and a stack of logs in front. */
export function lumber(x: number, y: number, s = 1) {
  shadowBlob(x + 12 * s, y + 30 * s, 46 * s, 12 * s, 0.38);
  const w = 36 * s;
  const x0 = x - 6 * s;
  const y0 = y - 18 * s;
  box(x0, y0, w, 26 * s, 9 * s, T.beech);
  roof(x0, y0, w, 20 * s, 9 * s, 5 * s, T.green);
  rrect(x0 + 12 * s, y0 + 10 * s, 10 * s, 16 * s, 4 * s);
  ctx.fillStyle = T.navy;
  ctx.fill();
  // three logs in a pile, ends towards the viewer
  for (const [lx, ly] of [
    [-30, 20],
    [-12, 20],
    [6, 20],
    [-21, 5],
    [-3, 5],
    [-12, -10],
  ]) {
    circle(x + lx * s, y + ly * s, 10 * s, '#a8743f', '#6e4520', 2 * s);
    circle(x + lx * s, y + ly * s, 6 * s, '#e8c99a');
    circle(x + lx * s, y + ly * s, 2.5 * s, '#c79a62');
  }
}

/** Painted wheat rows, as on a farm tile. */
/** The island's castle: a wide stone keep with battlements, a round tower at each corner, a gate and the royal flag. */
export function castle(x: number, y: number, s = 1) {
  shadowBlob(x + 14 * s, y + 30 * s, 56 * s, 13 * s, 0.4);
  const w = 62 * s;
  const h = 34 * s;
  const d = 12 * s;
  const x0 = x - w / 2 - 4 * s;
  const y0 = y - 6 * s;
  tower(x0 + 4 * s, y - 2 * s, 0.6 * s);
  tower(x0 + w - 4 * s, y - 2 * s, 0.6 * s);
  box(x0, y0, w, h, d, '#d4cec4');
  for (let i = 0; i < 4; i++) {
    rrect(x0 + 6 * s + i * 15 * s, y0 - 8 * s, 9 * s, 11 * s, 2 * s);
    ctx.fillStyle = '#e9e4db';
    ctx.fill();
  }
  rrect(x - 8 * s, y0 + h - 20 * s, 16 * s, 20 * s, 7 * s);
  ctx.fillStyle = T.navy;
  ctx.fill();
  ctx.strokeStyle = '#9a6a3a';
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y0 - 8 * s);
  ctx.lineTo(x, y0 - 46 * s);
  ctx.stroke();
  rrect(x, y0 - 47 * s, 28 * s, 16 * s, 3 * s);
  ctx.fillStyle = T.red;
  ctx.fill();
  crown(x + 14 * s, y0 - 39 * s, 0.45 * s);
  ball(x, y0 - 48 * s, 3.5 * s, T.yellow);
}

export function stripes(x: number, y: number, w: number, h: number, s = 1) {
  const n = 4;
  const gap = h / n;
  for (let i = 0; i < n; i++) {
    rrect(x, y + i * gap + gap * 0.18, w, gap * 0.64, gap * 0.32);
    const g = ctx.createLinearGradient(0, y + i * gap, 0, y + (i + 1) * gap);
    g.addColorStop(0, lit(T.yellow, 0.25));
    g.addColorStop(1, dark(T.yellow, 0.15));
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,80,10,0.35)';
    ctx.lineWidth = 1.5 * s;
    ctx.stroke();
  }
}

/** A gold crown with three points. */
export function crown(x: number, y: number, s: number, col = T.yellow) {
  ctx.beginPath();
  ctx.moveTo(x - 14 * s, y + 8 * s);
  ctx.lineTo(x - 16 * s, y - 8 * s);
  ctx.lineTo(x - 7 * s, y);
  ctx.lineTo(x, y - 12 * s);
  ctx.lineTo(x + 7 * s, y);
  ctx.lineTo(x + 16 * s, y - 8 * s);
  ctx.lineTo(x + 14 * s, y + 8 * s);
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = dark(col, 0.3);
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** A temple: a stepped beech base, four cream columns and a navy pediment with a gold finial. */
export function temple(x: number, y: number, s = 1) {
  shadowBlob(x + 12 * s, y + 30 * s, 46 * s, 12 * s, 0.38);
  const w = 56 * s;
  const x0 = x - w / 2 - 3 * s;
  box(x0 - 4 * s, y + 18 * s, w + 8 * s, 10 * s, 9 * s, T.beech);
  box(x0, y + 10 * s, w, 9 * s, 8 * s, lit(T.beech, 0.15));
  for (let i = 0; i < 4; i++) {
    const cx = x0 + 6 * s + (i * (w - 18 * s)) / 3;
    const g = ctx.createLinearGradient(cx, 0, cx + 7 * s, 0);
    g.addColorStop(0, '#fffaf0');
    g.addColorStop(1, '#cfc4ae');
    rrect(cx, y - 22 * s, 7 * s, 33 * s, 2 * s);
    ctx.fillStyle = g;
    ctx.fill();
  }
  box(x0 - 2 * s, y - 28 * s, w + 4 * s, 7 * s, 8 * s, T.cream);
  poly(
    [
      [x0 - 6 * s, y - 27 * s],
      [x0 + w + 6 * s, y - 27 * s],
      [x0 + w / 2, y - 48 * s],
    ],
    T.navy,
  );
  poly(
    [
      [x0 + w + 6 * s, y - 27 * s],
      [x0 + w + 6 * s + 8 * s, y - 33 * s],
      [x0 + w / 2 + 8 * s, y - 54 * s],
      [x0 + w / 2, y - 48 * s],
    ],
    dark(T.navy, 0.3),
  );
  ball(x0 + w / 2 + 2 * s, y - 52 * s, 5 * s, T.yellow);
}

/** A lighthouse: a tapered tower in red and cream bands, a glowing lamp room and a navy cap. */
export function lighthouse(x: number, y: number, s = 1) {
  shadowBlob(x + 14 * s, y + 30 * s, 36 * s, 11 * s, 0.4);
  const base = y + 28 * s;
  const top = y - 40 * s;
  const wb = 34 * s;
  const wt = 20 * s;
  const band = 5;
  for (let i = 0; i < band; i++) {
    const y1 = base - ((base - top) * i) / band;
    const y2 = base - ((base - top) * (i + 1)) / band;
    const w1 = wb - ((wb - wt) * i) / band;
    const w2 = wb - ((wb - wt) * (i + 1)) / band;
    const col = i % 2 ? T.cream : T.red;
    const g = ctx.createLinearGradient(x - w1 / 2, 0, x + w1 / 2, 0);
    g.addColorStop(0, lit(col, 0.12));
    g.addColorStop(0.35, lit(col, 0.25));
    g.addColorStop(1, dark(col, 0.25));
    ctx.beginPath();
    ctx.moveTo(x - w1 / 2, y1);
    ctx.lineTo(x - w2 / 2, y2);
    ctx.lineTo(x + w2 / 2, y2);
    ctx.lineTo(x + w1 / 2, y1);
    ctx.closePath();
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.save();
  shadow(14, 0, 0, 'rgba(255,220,90,0.9)');
  rrect(x - 11 * s, top - 14 * s, 22 * s, 14 * s, 3 * s);
  ctx.fillStyle = T.yellow;
  ctx.fill();
  ctx.restore();
  rrect(x - 14 * s, top - 2 * s, 28 * s, 5 * s, 2 * s);
  ctx.fillStyle = T.ink;
  ctx.fill();
  poly(
    [
      [x - 14 * s, top - 13 * s],
      [x + 14 * s, top - 13 * s],
      [x, top - 28 * s],
    ],
    T.navy,
  );
  ball(x, top - 29 * s, 3.5 * s, T.yellow);
}

/** An orchard: three peg trees hung with red and orange fruit, behind a low beech fence. */
export function orchard(x: number, y: number, s = 1) {
  const trees: [number, number, number][] = [
    [-22, -2, 0.85],
    [20, -8, 0.9],
    [0, 20, 0.95],
  ];
  for (const [tx, ty, k] of trees) {
    peg(x + tx * s, y + ty * s, k * s);
    for (const [fx, fy, col] of [
      [-8, -34, T.red],
      [7, -28, '#e08a2a'],
      [2, -40, T.red],
    ] as const)
      ball(x + (tx + fx * k) * s, y + (ty + fy * k) * s, 3.6 * k * s, col);
  }
  for (const px of [-34, -12, 10, 32]) {
    rrect(x + px * s, y + 22 * s, 5 * s, 14 * s, 2 * s);
    ctx.fillStyle = T.beech;
    ctx.fill();
  }
  rrect(x - 36 * s, y + 26 * s, 74 * s, 4 * s, 2 * s);
  ctx.fillStyle = dark(T.beech, 0.15);
  ctx.fill();
}
