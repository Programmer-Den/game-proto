import Phaser from 'phaser';
import type { Cargo } from '../game/map';
import { ISO } from '../scenes/layout';
import { GOLD, INK, WOOD } from './palette';
import { bakeCanvas, ellipse, poly, shadow, sphere, type Ctx, type Pt } from './canvas';
import { bakePixelArt } from './pixelArt';

// The wyrm and its wagons in the isometric style, and the pixel icons for cargo, coins and hearts.
// Each wyrm part is a texture whose origin (`PART_ORIGIN`) is the point on the ground under it, so
// the scene places it on the track and sorts it by that point; the part floats above it.

export function bakeSprites(scene: Phaser.Scene) {
  bakeWyrm(scene, 'wyrm', false);
  bakeWyrm(scene, 'wyrm2', true);
  for (const [cargo, rows] of Object.entries(CARGO_ICONS)) bakePixelArt(scene, `cargo-${cargo}`, rows, ICON_COLORS, 3, INK);
  bakePixelArt(scene, 'coin', COIN, ICON_COLORS, 3, INK);
  bakePixelArt(scene, 'heart', HEART, ICON_COLORS, 3, INK);
  bakePixelArt(scene, 'heart-empty', HEART.map((r) => r.replace(/[rp]/g, 'x')), ICON_COLORS, 3, INK);
  bakePixelArt(scene, 'food', FOOD, ICON_COLORS, 2, INK);
  bakePixelArt(scene, 'depot', DEPOT, ICON_COLORS, 2, INK);
}

/** Every wyrm texture is this size, with the ground point under the part at `x`, `y`. */
export const PART = { w: 120, h: 90, x: 60, y: 76 };
export const PART_ORIGIN = { x: PART.x / PART.w, y: PART.y / PART.h };

/** The mockups drew the wyrm for 150-pixel tiles; it is drawn a little larger than that scale here. */
const SCALE = (ISO.tw / 150) * 1.4;
const GREEN = { base: '#4fbf5a', light: '#9be883', dark: '#2b7c39' };

/**
 * Bakes a wyrm's head, coils and wings as `<prefix>-head` and so on. The second wyrm is the same
 * drawing with its greens turned to copper. The wagons are shared and baked with the first.
 */
function bakeWyrm(scene: Phaser.Scene, prefix: string, copper: boolean) {
  const part = (key: string, draw: (ctx: Ctx, x: number, y: number) => void) =>
    bakeCanvas(scene, key.replace('wyrm', prefix), PART.w, PART.h, (ctx) => {
      draw(ctx, PART.x, PART.y);
      if (copper) toCopper(ctx);
    });
  part('wyrm-head', (ctx, x, y) => {
    shadow(ctx, x + 3, y + 3, 18, 7, 0.25);
    head(ctx, x, y - 38);
  });
  for (const [i, size] of [0.9, 0.8, 0.7].entries()) {
    part(`wyrm-coil-${i}`, (ctx, x, y) => {
      shadow(ctx, x + 3, y + 2, 13 * size, 5, 0.22);
      const r = 27 * SCALE * size;
      const cy = y - (20 + i * 3) * SCALE;
      sphere(ctx, x, cy, r, GREEN.base, GREEN.light, GREEN.dark);
      poly(ctx, [{ x: x - 2, y: cy - r + 1 }, { x: x + 1, y: cy - r - 6 * size }, { x: x + 3, y: cy - r + 2 }], '#e9dfb8');
    });
  }
  part('wyrm-wings', (ctx, x, y) => {
    const w = { x, y: y - 40 * SCALE };
    const k = SCALE;
    poly(ctx, [w, { x: w.x - 74 * k, y: w.y - 44 * k }, { x: w.x - 50 * k, y: w.y - 6 * k }, { x: w.x - 66 * k, y: w.y + 10 * k }], '#3fa04d', '#25623a', 1);
    poly(ctx, [w, { x: w.x + 66 * k, y: w.y - 52 * k }, { x: w.x + 50 * k, y: w.y - 10 * k }, { x: w.x + 68 * k, y: w.y + 4 * k }], '#2f8a3f', '#25623a', 1);
  });
  // The wagons, lengthwise along the columns (`wagon-u`) or along the rows (`wagon-v`).
  if (!copper) for (const along of ['u', 'v'] as const) part(`wagon-${along}`, (ctx, x, y) => wagon(ctx, x, y, along));
}

/** Turns every green on the canvas to copper, keeping its shading; cream horns and the gold eye stay. */
function toCopper(ctx: Ctx) {
  const img = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const [r, g, b] = [d[i] / 255, d[i + 1] / 255, d[i + 2] / 255];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max !== g || max - min < 0.12) continue;
    const hue = 60 * ((b - r) / (max - min) + 2);
    if (hue < 70 || hue > 170) continue;
    // Same lightness and saturation, the greens (hue 70 to 170) squeezed into copper (12 to 42).
    const l = (max + min) / 2;
    const sat = (max - min) / (1 - Math.abs(2 * l - 1));
    const c = (1 - Math.abs(2 * l - 1)) * sat;
    const h = (12 + (hue - 70) * 0.3) / 60;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const m = l - c / 2;
    const [rr, gg, bb] = [c, x, 0];
    d[i] = (rr + m) * 255;
    d[i + 1] = (gg + m) * 255;
    d[i + 2] = (bb + m) * 255;
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * The head in profile, facing right (the scene flips it to face left), around the middle of its
 * skull: a long snout with a nostril and teeth, a slightly open jaw, a slit-pupil eye under a brow
 * ridge, swept-back horns, spines and a frill down the neck.
 */
function head(ctx: Ctx, hx: number, hy: number) {
  type Step = [number, number] | [number, number, number, number];
  const path = (steps: Step[], close = true) => {
    ctx.beginPath();
    ctx.moveTo(hx + steps[0][0], hy + steps[0][1]);
    for (const p of steps.slice(1)) {
      if (p.length === 4) ctx.quadraticCurveTo(hx + p[0], hy + p[1], hx + p[2], hy + p[3]);
      else ctx.lineTo(hx + p[0], hy + p[1]);
    }
    if (close) ctx.closePath();
  };
  const fill = (color: string | CanvasGradient, stroke?: string, width = 0.8) => {
    ctx.fillStyle = color;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  };
  const ink = '#1f4a2a';
  // The neck, running down and back to the first coil.
  const ng = ctx.createLinearGradient(hx - 20, hy - 6, hx - 8, hy + 18);
  ng.addColorStop(0, '#4fbf5a');
  ng.addColorStop(1, GREEN.dark);
  path([[-12, -6], [-22, 2, -21, 16], [-8, 18], [-6, 10, 0, 6]]);
  fill(ng, ink);
  // The far horn, behind the skull.
  path([[-5, -9], [-14, -20, -27, -21], [-16, -16, -9, -6]]);
  fill('#b9ab88');
  // The frill down the neck.
  for (const [fx, fy, l] of [
    [-15, -3, 9],
    [-18, 3, 8],
    [-19, 9, 7],
  ]) {
    path([[fx + 3, fy - 3], [fx - l, fy + 1], [fx + 3, fy + 3]]);
    fill('#2f8a3f');
  }
  // The lower jaw, a little open, with a pale throat.
  path([[-8, 5], [6, 8, 18, 10], [20, 12], [15, 14, 2, 14], [-6, 13, -10, 9]]);
  fill('#3b9a48', ink);
  path([[-6, 11], [6, 13, 17, 12], [15, 14, 2, 14], [-6, 13, -6, 11]]);
  fill('#c8e6a0');
  path([[-4, 5], [10, 6, 21, 9], [10, 9, -4, 7]]);
  fill('#5a1e22');
  // The skull and the long snout.
  const g = ctx.createLinearGradient(hx, hy - 14, hx, hy + 8);
  g.addColorStop(0, '#8fe07e');
  g.addColorStop(0.45, '#4fbf5a');
  g.addColorStop(1, GREEN.dark);
  path([[-14, 2], [-16, -10, -4, -12], [3, -13, 7, -9], [15, -7, 24, -4], [29, -2.5, 27, 1], [25, 4.5, 19, 5.5], [6, 6, -8, 6], [-13, 5, -14, 2]]);
  fill(g, ink, 0.9);
  // Teeth along the upper jaw.
  for (const tx of [4, 9, 14, 19]) {
    path([[tx - 1.4, 5.8], [tx, 9.3], [tx + 1.4, 5.9]]);
    fill('#fbf6e2');
  }
  // Scale ridges along the snout, and a cheek plate.
  ctx.strokeStyle = 'rgba(31,74,42,0.55)';
  ctx.lineWidth = 0.7;
  for (const sx of [10, 15, 20]) {
    path([[sx - 2, -6 + (sx - 10) * 0.2], [sx, -4 + (sx - 10) * 0.2, sx + 2, -6 + (sx - 10) * 0.22]], false);
    ctx.stroke();
  }
  path([[-10, 0], [-4, 3, 2, 2]], false);
  ctx.stroke();
  ellipse(ctx, hx + 24, hy - 1.8, 1.6, 0.9, '#163a20', -0.4);
  // The brow ridge over a gold, slit-pupil eye.
  path([[-4, -8], [2, -11, 8, -8], [3, -7.5, -4, -6.5]]);
  fill(GREEN.dark);
  ctx.beginPath();
  ctx.ellipse(hx + 2, hy - 5, 3.2, 1.9, -0.15, 0, Math.PI * 2);
  fill('#f6c945', '#163a20', 0.6);
  ellipse(ctx, hx + 2.4, hy - 5, 0.6, 1.7, '#111111');
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(hx + 0.6, hy - 6.2, 0.9, 0.9);
  // The near horn, swept back over the neck, and the spines behind it.
  const hg = ctx.createLinearGradient(hx - 26, hy - 24, hx - 4, hy - 8);
  hg.addColorStop(0, '#fff6dc');
  hg.addColorStop(1, '#c9b78c');
  path([[-3, -10], [-12, -22, -28, -24], [-14, -18, -9, -6]]);
  fill(hg, '#7a6a48', 0.7);
  for (const [sx, sy] of [
    [-10, -9],
    [-15, -4],
    [-19, 2],
  ]) {
    path([[sx + 2, sy], [sx - 2, sy - 6], [sx - 3, sy + 1]]);
    fill('#e9dfb8');
  }
}

function wagon(ctx: Ctx, x: number, y: number, along: 'u' | 'v') {
  const P = (u: number, v: number, z = 0): Pt => ({ x: x + ((u - v) * ISO.tw) / 2, y: y + ((u + v) * ISO.th) / 2 - z });
  const [hu, hv] = along === 'v' ? [0.14, 0.19] : [0.19, 0.14];
  const h = 22 * SCALE;
  const z = 6 * SCALE;
  const [u0, u1, v0, v1] = [-hu, hu, -hv, hv];
  shadow(ctx, x + 3, y + 3, 22, 9, 0.3);
  const wheels = along === 'v' ? [[u0, v0 + 0.06], [u0, v1 - 0.06]] : [[u0 + 0.06, v1], [u1 - 0.06, v1]];
  for (const [wu, wv] of wheels) {
    const p = P(wu, wv, 8 * SCALE);
    ellipse(ctx, p.x, p.y, 4, 6, '#3b2a1c', along === 'v' ? 0.5 : -0.5);
  }
  poly(ctx, [P(u0, v1, z), P(u1, v1, z), P(u1, v1, z + h), P(u0, v1, z + h)], '#a8703f', '#4a3220', 1);
  poly(ctx, [P(u1, v1, z), P(u1, v0, z), P(u1, v0, z + h), P(u1, v1, z + h)], '#8a5a31', '#4a3220', 1);
  poly(ctx, [P(u0, v0, z + h), P(u1, v0, z + h), P(u1, v1, z + h), P(u0, v1, z + h)], '#5c3d22', '#4a3220', 1);
  const front = along === 'v' ? [[u1, v0 + 0.06], [u1, v1 - 0.06]] : [[u0 + 0.06, v1], [u1 - 0.06, v1]];
  for (const [wu, wv] of front) {
    const p = P(wu + (along === 'u' ? 0 : 0), wv, 8 * SCALE);
    ellipse(ctx, p.x, p.y, 4.5, 6.5, '#2a1d12', along === 'v' ? 0.5 : -0.5);
    ellipse(ctx, p.x, p.y, 1.6, 2.4, '#b08850', along === 'v' ? 0.5 : -0.5);
  }
}

/** How high above the ground point a wagon's load sits. */
export const LOAD_LIFT = 28 * SCALE + 6;

const ICON_COLORS = {
  y: 0xe8c45a, // grain
  t: 0xc9a46a, // sack
  b: 0x8a6a40,
  i: 0xb9b4c2, // iron
  w: WOOD.base,
  W: WOOD.light,
  D: WOOD.dark,
  o: 0x6e6878, // ore
  O: 0x9a94a6,
  c: 0x6ad0e8, // crystal glint
  f: 0x7aa8d0, // fish
  F: 0xc8e0f0,
  G: GOLD,
  L: 0xfff2b0,
  r: 0xd8483f, // heart
  p: 0xf08a8a,
  x: 0x4a3a3a,
  n: 0xf4efe2, // flour
  N: 0xd8d0bc,
  I: 0xe2e2ec, // iron bars
  k: 0x6a6878,
  m: 0xc0603a, // meat
  M: 0xe8956a,
  B: 0xf1e4c6,
  s: 0xf0c8a0, // passengers: faces, a blue coat and a plum one
  h: 0x5070b0,
  d: 0x8a4a6a,
};

const CARGO_ICONS: Record<Cargo, string[]> = {
  grain: ['..y.y..', '.yyyyy.', '..ttt..', '.ttttt.', 'tttbttt', 'ttttttt', '.ttttt.'],
  tools: ['.iiiii.', '.iiiii.', '...w...', '...w...', '...w...', '...w...', '...D...'],
  timber: ['.......', 'WbWbWb.', 'wwwwwwb', '.WbWbWb', 'wwwwwww', 'WbWbWb.', '.......'],
  ore: ['...O...', '..OOo..', '.OcOoo.', 'OOOoooo', 'OOocooo', '.Ooooo.', '.......'],
  fish: ['.......', 'f..fff.', 'ff.fFfF', '.fffffF', 'ff.ffff', 'f..fff.', '.......'],
  flour: ['..b.b..', '...b...', '.nnnnn.', 'nnnnnnn', 'nnnNnnn', 'nnNNNnn', '.nnnnn.'],
  planks: ['.......', 'WWWWWWW', 'wwwwwwD', 'DDDDDDD', 'WWWWWWW', 'wwwwwwD', 'DDDDDDD'],
  iron: ['..III..', '.IiiiI.', 'kkkkkkk', '.......', '.IIIII.', 'IiiiiiI', 'kkkkkkk'],
  wool: ['.......', '.nNnNn.', 'nNnnnNn', 'nnNnNnn', 'NnnNnnN', '.nNnnN.', '..x.x..'],
  peat: ['.......', '.bbbbb.', '.DbDbD.', 'bbbbbbb', 'DbDbDbD', 'bbbbbbb', '.DDDDD.'],
  salt: ['...I...', '..IcI..', '..III..', '.ttttt.', 'tnnnnnt', 'tnnnnnt', '.ttttt.'],
  passengers: ['.s...s.', 'sss.sss', '.s...s.', 'hhh.ddd', 'hhh.ddd', '.hh.dd.', '.h...d.'],
};

/** The wyrm's belly on the HUD: a joint of meat on the bone. */
const FOOD = ['....mm.', '...mMmm', '..mmmmm', '..mmmm.', '.Bm....', 'BB.....', '.B.....'];

/** A village's depot (WR11): a wooden goods shed. */
const DEPOT = ['...D...', '..DWD..', '.DWWWD.', 'DDDDDDD', '.wwDww.', '.wwDww.', '.wwDww.'];

const COIN = ['.GGG.', 'GLGGG', 'GLGGG', 'GGGGG', '.GGG.'];
const HEART = ['.rr.rr.', 'rpprrrr', 'rprrrrr', '.rrrrr.', '..rrr..', '...r...'];
