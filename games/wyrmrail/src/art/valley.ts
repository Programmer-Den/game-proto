import Phaser from 'phaser';
import { COLS, ROWS, VILLAGE_NAMES, type Terrain, type Valley, type ValleyKind } from '../game/map';
import { BOARD, ISO, iso } from '../scenes/layout';
import { bakeCanvas, mix, poly, shadow, type Ctx, type Pt } from './canvas';
import { seeded } from './pixelArt';

// The valley in isometric low-poly: a floating block of land under a pale sky, baked into the
// `valley` texture for each new game's valley, and the things that stand on it, each baked as a texture drawn on its own tile
// so it can sit in front of or behind the wyrm: `forest` (a clump of pines), `peak` (a mountain),
// `roost` and `village-<name>`.

/** How much smaller than the mockups' 150-pixel tiles everything is drawn. */
const K = ISO.tw / 150;

/** How far a river tile's floor sits below the grass. */
export const RIVER_DROP = 6;

/** Each village's roof colours (light slope, dark side), by name. */
export const ROOFS: Record<string, [string, string]> = {
  Millbrook: ['#e9b949', '#c48f22'],
  Ashford: ['#8f95a8', '#6b7084'],
  Fernhollow: ['#5fae5a', '#3f8a3f'],
  Stonereach: ['#c0724a', '#9a5434'],
  Saltmere: ['#4f86d0', '#3566a8'],
  Brackenly: ['#b7894f', '#8f6634'],
  Dunmoor: ['#d0a066', '#a87a40'],
  Wyndle: ['#6ab8c8', '#4890a0'],
  Kettlecross: ['#b06a9a', '#8a4a78'],
};

/** Bakes the `valley` texture for a game's valley; it replaces the last game's. */
export function bakeValley(scene: Phaser.Scene, valley: Valley) {
  bakeCanvas(scene, 'valley', BOARD.w, BOARD.h, (ctx) => {
    ctx.translate(-BOARD.x, -BOARD.y);
    const look = LOOKS[valley.kind];
    backdrop(ctx, look);
    for (let s = 0; s < COLS + ROWS - 1; s++) {
      for (let c = 0; c < COLS; c++) {
        const r = s - c;
        if (r >= 0 && r < ROWS) block(ctx, c, r, valley.terrain[r][c], look);
      }
    }
  });
}

/** Bakes the props, which are the same in every valley, once at boot. */
export function bakeProps(scene: Phaser.Scene) {
  prop(scene, 'forest', forest);
  prop(scene, 'peak', mountain);
  prop(scene, 'mesa', mesa);
  prop(scene, 'roost', roost);
  for (const name of VILLAGE_NAMES) prop(scene, `village-${name}`, (ctx, L) => village(ctx, L, ROOFS[name] ?? ['#c0b090', '#a09070']));
  prop(scene, 'bunting', bunting);
  prop(scene, 'town', town);
}

/** The size of a prop's texture, and where the middle of its tile is in it. */
export const PROP = { w: ISO.tw + 40, h: ISO.th + 120, x: (ISO.tw + 40) / 2, y: 100 + ISO.th / 2 };

/** A point on a tile, in tile units from its top corner (0 to 1 each way), `z` pixels up, in a prop's texture. */
type Local = (u: number, v: number, z?: number) => Pt;

function prop(scene: Phaser.Scene, key: string, draw: (ctx: Ctx, L: Local) => void) {
  const L: Local = (u, v, z = 0) => ({ x: PROP.x + ((u - v) * ISO.tw) / 2, y: PROP.y + ((u + v - 1) * ISO.th) / 2 - z });
  bakeCanvas(scene, key, PROP.w, PROP.h, (ctx) => draw(ctx, L));
}

function backdrop(ctx: Ctx, look: Look) {
  const rnd = seeded(7);
  const g = ctx.createLinearGradient(0, BOARD.y, 0, BOARD.y + BOARD.h);
  g.addColorStop(0, look.sky[0]);
  g.addColorStop(1, look.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 0; i < 9; i++) {
    const x = BOARD.x + rnd() * BOARD.w;
    const y = BOARD.y + 20 + rnd() * 110;
    for (let j = 0; j < 4; j++) {
      ctx.beginPath();
      ctx.ellipse(x + j * 19 - 30, y + Math.sin(j) * 4, 30 + rnd() * 15, 11 + rnd() * 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The valley's shadow on the haze below it.
  const c = iso(COLS / 2 + 0.6, ROWS / 2 + 0.6);
  const sg = ctx.createRadialGradient(c.x, c.y + 35, 20, c.x, c.y + 35, 380);
  sg.addColorStop(0, 'rgba(40,60,40,0.18)');
  sg.addColorStop(1, 'rgba(40,60,40,0)');
  ctx.fillStyle = sg;
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 35, 390, 190, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** How each kind of valley looks (WR15): its sky, its ground, its earth, its water and its tufts. */
interface Look {
  sky: [string, string];
  grass: string[];
  forest: string[];
  lip: string;
  earth: [string, string];
  rock: string;
  bed: string;
  /** The river bed's lip, under its front edges. */
  bank: string;
  water: [string, string, string];
  ripple: string;
  tuft: string;
}

const LOOKS: Record<ValleyKind, Look> = {
  meadow: {
    sky: ['#9fcfe0', '#d9ead0'],
    grass: ['#82c45c', '#7bbd56', '#88c962'],
    forest: ['#6eae4f', '#68a84a', '#73b354'],
    lip: '#5f9c40',
    earth: ['#9a6a43', '#7b5133'],
    rock: '#9fa08e',
    bed: '#e2cd95',
    bank: '#c9b47c',
    water: ['#3c8ad2', '#4a98de', '#2f74b8'],
    ripple: 'rgba(200,232,255,0.75)',
    tuft: 'rgba(70,130,45,0.65)',
  },
  // Snow over everything, and the river frozen to pale ice.
  snow: {
    sky: ['#b8cde0', '#eef2f6'],
    grass: ['#eef3f8', '#e6edf4', '#f4f7fa'],
    forest: ['#dfe8ef', '#d8e2ea', '#e4ecf2'],
    lip: '#b8c8d6',
    earth: ['#8a7a70', '#6e5f58'],
    rock: '#c8ccd8',
    bed: '#d8e4ee',
    bank: '#bccbd8',
    water: ['#a8d0ea', '#c4e2f4', '#94c0e0'],
    ripple: 'rgba(255,255,255,0.9)',
    tuft: 'rgba(150,170,190,0.6)',
  },
  // Dull olive ground under a grey sky, with brown peaty water.
  marsh: {
    sky: ['#a8b8b0', '#d4dccc'],
    grass: ['#7f9a52', '#76914b', '#86a058'],
    forest: ['#6a8646', '#647f42', '#6f8c4a'],
    lip: '#5a6e3a',
    earth: ['#6e5a3c', '#54442c'],
    rock: '#8e9080',
    bed: '#9a8a5a',
    bank: '#82744a',
    water: ['#4f6e5a', '#5c7c64', '#42604e'],
    ripple: 'rgba(200,220,190,0.6)',
    tuft: 'rgba(60,80,40,0.7)',
  },
  // Red sand under a hot sky, the river deep in its gorge.
  canyon: {
    sky: ['#f0c890', '#f8e6c8'],
    grass: ['#dca46a', '#d49c62', '#e2ac72'],
    forest: ['#c8a060', '#c09858', '#cea666'],
    lip: '#b8784a',
    earth: ['#a8563a', '#86402a'],
    rock: '#c07a58',
    bed: '#8a4a32',
    bank: '#743c28',
    water: ['#3c7ac2', '#4a88ce', '#2f68a8'],
    ripple: 'rgba(200,232,255,0.6)',
    tuft: 'rgba(150,100,50,0.6)',
  },
};

/** One tile: its top, and the earth under its front faces. */
function block(ctx: Ctx, c: number, r: number, t: Terrain, look: Look) {
  const rnd = seeded(c * 31 + r * 7 + 1);
  const drop = t === 'river' ? RIVER_DROP : 0;
  const D = ISO.depth;
  const T = iso(c, r, -drop);
  const R = iso(c + 1, r, -drop);
  const B = iso(c + 1, r + 1, -drop);
  const L = iso(c, r + 1, -drop);
  const down = (p: Pt, d: number) => ({ x: p.x, y: p.y + d });
  const lip = t === 'river' ? look.bank : look.lip;
  poly(ctx, [L, B, down(B, D - drop), down(L, D - drop)], look.earth[0]);
  poly(ctx, [B, R, down(R, D - drop), down(B, D - drop)], look.earth[1]);
  poly(ctx, [L, B, down(B, 4), down(L, 4)], t === 'river' ? lip : mix(lip, '#ffffff', 0.05));
  poly(ctx, [B, R, down(R, 4), down(B, 4)], t === 'river' ? lip : mix(lip, '#000000', 0.15));
  ctx.strokeStyle = 'rgba(90,55,30,0.55)';
  ctx.lineWidth = 1;
  for (const f of [0.55, 0.8]) {
    ctx.beginPath();
    ctx.moveTo(L.x, L.y + (D - drop) * f);
    ctx.lineTo(B.x, B.y + (D - drop) * f);
    ctx.lineTo(R.x, R.y + (D - drop) * f);
    ctx.stroke();
  }
  const pick = (arr: string[]) => arr[(c * 7 + r * 13) % arr.length];
  const top = t === 'forest' ? pick(look.forest) : t === 'mountain' ? look.rock : t === 'river' ? look.bed : pick(look.grass);
  poly(ctx, [T, R, B, L], top);
  if (t === 'river') {
    const z = -drop - 1;
    const a = iso(c + 0.12, r, z);
    const b = iso(c + 0.88, r, z);
    const wg = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    wg.addColorStop(0, look.water[0]);
    wg.addColorStop(0.5, look.water[1]);
    wg.addColorStop(1, look.water[2]);
    poly(ctx, [a, b, iso(c + 0.88, r + 1, z), iso(c + 0.12, r + 1, z)], wg);
    ctx.strokeStyle = look.ripple;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const u = c + 0.3 + rnd() * 0.4;
      const v = r + 0.15 + i * 0.3;
      const p1 = iso(u, v, z);
      const p2 = iso(u, v + 0.14, z);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    }
  } else if (t !== 'mountain') {
    ctx.strokeStyle = look.tuft;
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const p = iso(c + 0.15 + rnd() * 0.7, r + 0.15 + rnd() * 0.7);
      ctx.beginPath();
      ctx.moveTo(p.x - 2, p.y);
      ctx.lineTo(p.x - 1, p.y - 3);
      ctx.moveTo(p.x + 0.5, p.y);
      ctx.lineTo(p.x + 1.5, p.y - 3.5);
      ctx.stroke();
    }
  }
}

function pine(ctx: Ctx, at: Pt, s: number) {
  const { x, y } = at;
  s *= K;
  shadow(ctx, x + 10 * s, y + 4 * s, 22 * s, 9 * s, 0.25);
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(x - 3 * s, y - 14 * s, 6 * s, 14 * s);
  for (const [dy, w, h] of [
    [0, 38, 30],
    [-22, 30, 26],
    [-40, 22, 22],
  ]) {
    const foot = y - 14 * s + dy * s;
    const top = foot - h * s;
    poly(ctx, [{ x, y: top }, { x, y: foot }, { x: x - (w * s) / 2 - 4 * s, y: foot }], '#3f8c46');
    poly(ctx, [{ x, y: top }, { x: x + (w * s) / 2 + 4 * s, y: foot }, { x, y: foot }], '#2d6d37');
  }
}

function forest(ctx: Ctx, L: Local) {
  for (const [u, v, s] of [
    [0.3, 0.35, 1],
    [0.68, 0.32, 0.9],
    [0.45, 0.7, 1.1],
    [0.78, 0.72, 0.85],
  ].sort((a, b) => a[0] + a[1] - (b[0] + b[1]))) {
    pine(ctx, L(u, v), s);
  }
}

function mountain(ctx: Ctx, L: Local) {
  const T = L(0.06, 0.06);
  const R = L(0.94, 0.06);
  const B = L(0.94, 0.94);
  const Lf = L(0.06, 0.94);
  const A = L(0.5, 0.5, 64);
  poly(ctx, [T, R, A], '#9a96a8');
  poly(ctx, [T, Lf, A], '#a9a5b6');
  poly(ctx, [Lf, B, A], '#b9b5c6');
  poly(ctx, [B, R, A], '#837e93');
  const at = (p: Pt, t: number) => ({ x: A.x + (p.x - A.x) * t, y: A.y + (p.y - A.y) * t });
  poly(ctx, [A, at(Lf, 0.34), at(B, 0.3)], '#ffffff');
  poly(ctx, [A, at(B, 0.3), at(R, 0.36)], '#d8dce8');
  poly(ctx, [A, at(T, 0.3), at(Lf, 0.34)], '#eef0f6');
}

/** A canyon's mountain (WR15): a flat-topped mesa of banded red rock, with no snow. */
function mesa(ctx: Ctx, L: Local) {
  const h = 46;
  const foot = [L(0.08, 0.08), L(0.92, 0.08), L(0.92, 0.92), L(0.08, 0.92)];
  const top = [L(0.26, 0.26, h), L(0.74, 0.26, h), L(0.74, 0.74, h), L(0.26, 0.74, h)];
  poly(ctx, [foot[0], foot[1], top[1], top[0]], '#b0603e');
  poly(ctx, [foot[0], foot[3], top[3], top[0]], '#c8724a');
  poly(ctx, [foot[3], foot[2], top[2], top[3]], '#d88a5a');
  poly(ctx, [foot[2], foot[1], top[1], top[2]], '#9a4e32');
  poly(ctx, top, '#e8a070');
  // Bands of paler rock round its sides.
  for (const f of [0.35, 0.65]) {
    const at = (a: Pt, b: Pt) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });
    ctx.strokeStyle = 'rgba(250,210,160,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const pts = [at(foot[0], top[0]), at(foot[3], top[3]), at(foot[2], top[2]), at(foot[1], top[1])];
    ctx.moveTo(pts[0].x, pts[0].y);
    for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
}

/** A cottage on the tile's back half, from `du` along the columns. */
function house(ctx: Ctx, L: Local, du: number, dv: number, roof: [string, string]) {
  const u0 = du;
  const v0 = dv;
  const u1 = u0 + 0.34;
  const v1 = v0 + 0.3;
  const h = 30 * K;
  const rh = 28 * K;
  const vm = (v0 + v1) / 2;
  const c = L((u0 + u1) / 2, (v0 + v1) / 2);
  shadow(ctx, c.x + 7, c.y + 3, 20, 8, 0.3);
  const ink = '#5b4632';
  poly(ctx, [L(u0, v1, 0), L(u1, v1, 0), L(u1, v1, h), L(u0, v1, h)], '#f1e4c6', ink, 1);
  poly(ctx, [L(u1, v1, 0), L(u1, v0, 0), L(u1, v0, h), L(u1, vm, h + rh), L(u1, v1, h)], '#d3c19b', ink, 1);
  poly(ctx, [L(u0 + 0.13, v1, 0), L(u0 + 0.2, v1, 0), L(u0 + 0.2, v1, 18 * K), L(u0 + 0.13, v1, 18 * K)], '#6b4a2b');
  poly(ctx, [L(u1, v0 + 0.08, 12 * K), L(u1, v0 + 0.15, 12 * K), L(u1, v0 + 0.15, 22 * K), L(u1, v0 + 0.08, 22 * K)], '#5aa0d8');
  poly(ctx, [L(u0 + 0.25, v1, 12 * K), L(u0 + 0.31, v1, 12 * K), L(u0 + 0.31, v1, 22 * K), L(u0 + 0.25, v1, 22 * K)], '#5aa0d8');
  poly(ctx, [L(u0 - 0.03, v1 + 0.04, h - 2), L(u1 + 0.03, v1 + 0.04, h - 2), L(u1 + 0.03, vm, h + rh), L(u0 - 0.03, vm, h + rh)], roof[0], '#4a3a2a', 1);
  poly(ctx, [L(u1 + 0.03, vm, h + rh), L(u1 + 0.03, v1 + 0.04, h - 2), L(u1 + 0.05, v1 + 0.04, h - 3), L(u1 + 0.05, vm, h + rh - 1)], roof[1]);
  poly(ctx, [L(u0 + 0.06, vm - 0.02, h + rh - 3), L(u0 + 0.11, vm - 0.02, h + rh - 3), L(u0 + 0.11, vm - 0.02, h + rh + 6), L(u0 + 0.06, vm - 0.02, h + rh + 6)], '#9c6a4a');
}

/** Two cottages on the tile's back corners, clear of the track down its middle either way. */
function village(ctx: Ctx, L: Local, roof: [string, string]) {
  house(ctx, L, 0.02, 0.04, roof);
  house(ctx, L, 0.62, 0.04, roof);
}

/** A faceted boulder with its cave mouth facing east, and a glint of hoard inside. */
function roost(ctx: Ctx, L: Local) {
  const { x, y } = L(0.5, 0.5);
  const s = K;
  shadow(ctx, x + 5, y + 5, 32, 13, 0.3);
  const pts = [
    [-62, 6],
    [-50, -40],
    [-14, -70],
    [30, -62],
    [58, -30],
    [62, 8],
    [30, 26],
    [-30, 26],
  ].map(([px, py]) => ({ x: x + px * s, y: y + py * s }));
  const top = { x: x + 2 * s, y: y - 30 * s };
  const fills = ['#a7a3b0', '#b8b4c2', '#c4c0cd', '#9a96a5', '#86828f', '#77737f', '#8d8997', '#9c98a6'];
  pts.forEach((p, i) => poly(ctx, [top, p, pts[(i + 1) % pts.length]], fills[i]));
  poly(ctx, [
    { x: x + 18 * s, y: y + 18 * s },
    { x: x + 22 * s, y: y - 22 * s },
    { x: x + 44 * s, y: y - 26 * s },
    { x: x + 52 * s, y: y + 8 * s },
  ], '#1f1b24');
  ctx.fillStyle = '#f2c14e';
  ctx.beginPath();
  ctx.ellipse(x + 36 * s, y + 6 * s, 10 * s, 5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe08a';
  ctx.fillRect(x + 32 * s, y + 1 * s, 4 * s, 3 * s);
}

/** Festival bunting: two poles at the tile's back corners and a string of pennants between them. */
function bunting(ctx: Ctx, L: Local) {
  const h = 62 * K;
  const a = L(0.02, 0.98, 0);
  const b = L(0.98, 0.02, 0);
  for (const p of [a, b]) {
    shadow(ctx, p.x + 3, p.y + 1, 5, 2, 0.25);
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(p.x - 1.5, p.y - h, 3, h);
  }
  const top = (t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y - h + (b.y - a.y) * t + Math.sin(t * Math.PI) * 10 });
  ctx.strokeStyle = '#4a3a2a';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) {
    const p = top(i / 20);
    if (i) ctx.lineTo(p.x, p.y);
    else ctx.moveTo(p.x, p.y);
  }
  ctx.stroke();
  const colours = ['#f2c14e', '#4f86d0', '#5fae5a', '#b06a9a', '#e8823a'];
  for (let i = 0; i < 7; i++) {
    const p = top((i + 0.6) / 8);
    const q = top((i + 1.4) / 8);
    poly(ctx, [p, q, { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 + 9 }], colours[i % colours.length], '#4a3a2a', 0.6);
  }
}

/** A grown town (WR18): a stone tower with a slate spire and a gold pennant, rising behind the cottages. */
function town(ctx: Ctx, L: Local) {
  const u0 = 0.38;
  const u1 = 0.6;
  const v0 = 0.0;
  const v1 = 0.2;
  const h = 62 * K;
  const ink = '#4a4250';
  const c = L((u0 + u1) / 2, (v0 + v1) / 2);
  shadow(ctx, c.x + 6, c.y + 3, 14, 6, 0.28);
  poly(ctx, [L(u0, v1, 0), L(u1, v1, 0), L(u1, v1, h), L(u0, v1, h)], '#c8c2b4', ink, 1);
  poly(ctx, [L(u1, v1, 0), L(u1, v0, 0), L(u1, v0, h), L(u1, v1, h)], '#a29c90', ink, 1);
  // Windows, lit gold.
  for (const z of [18, 38]) {
    poly(ctx, [L(u0 + 0.08, v1, z * K), L(u0 + 0.14, v1, z * K), L(u0 + 0.14, v1, (z + 10) * K), L(u0 + 0.08, v1, (z + 10) * K)], '#f2c14e');
    poly(ctx, [L(u1, v0 + 0.07, z * K), L(u1, v0 + 0.13, z * K), L(u1, v0 + 0.13, (z + 10) * K), L(u1, v0 + 0.07, (z + 10) * K)], '#d8a83a');
  }
  const top = L((u0 + u1) / 2, (v0 + v1) / 2, h + 34 * K);
  poly(ctx, [L(u0 - 0.02, v1 + 0.02, h), L(u1 + 0.02, v1 + 0.02, h), top], '#5a6278', ink, 1);
  poly(ctx, [L(u1 + 0.02, v1 + 0.02, h), L(u1 + 0.02, v0 - 0.02, h), top], '#454c60', ink, 1);
  ctx.fillStyle = '#4a3a2a';
  ctx.fillRect(top.x - 0.75, top.y - 16 * K, 1.5, 16 * K);
  poly(ctx, [{ x: top.x + 0.75, y: top.y - 16 * K }, { x: top.x + 13 * K, y: top.y - 12 * K }, { x: top.x + 0.75, y: top.y - 8 * K }], '#f2c14e', '#8a6a20', 0.6);
}
