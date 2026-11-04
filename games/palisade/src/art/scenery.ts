import Phaser from 'phaser';
import { facet, line, mix, ngon, paint, poly, rect, seeded, shade, softShadow, type Pt } from './lowpoly';

// The battlefield in low-poly 3D: a faceted sky, snowy peaks and a castle on the far hill, rows of
// pines, and the road the foes march along as a jittered triangle mesh of packed earth. Plus the
// slate-and-gold top and bottom bars, and the barricade, which breaks up in stages.
//
// Everything here is painted in "double" units (1920x1080 for the 960x540 view) and scaled down
// by half, so the shapes keep their fine facets. A view bigger than 960x540 (a screen of another
// shape) gets the background and bars at its own size, with the designed scene at `frame` in its
// middle and the sky, hills, road and verge carried on round it.

const W = 1920;

/** The part of the double-unit scene a background shows: 0..W by 0..1080, or more round it. */
interface Extent {
  l: number;
  r: number;
  t: number;
  b: number;
}

export function bakeScenery(scene: Phaser.Scene, w = 960, h = 540, frame = { x: 0, y: 0 }) {
  paint(scene, 'background', w, h, (ctx) => {
    ctx.scale(0.5, 0.5);
    ctx.translate(frame.x * 2, frame.y * 2);
    drawBackground(ctx, { l: -frame.x * 2, r: (w - frame.x) * 2, t: -frame.y * 2, b: (h - frame.y) * 2 });
  });
  // The frozen pass: the same scene under snow, graded cold and blue, with drifts on the road.
  paint(scene, 'background-pass', w, h, (ctx) => {
    ctx.scale(0.5, 0.5);
    ctx.translate(frame.x * 2, frame.y * 2);
    const E = { l: -frame.x * 2, r: (w - frame.x) * 2, t: -frame.y * 2, b: (h - frame.y) * 2 };
    drawBackground(ctx, E);
    drawWinter(ctx, E);
  });
  paint(scene, 'hud-top', w, 42, (ctx) => {
    ctx.scale(0.5, 0.5);
    slateBar(ctx, 0, 80, 'bottom', w * 2);
  });
  paint(scene, 'hud-bottom', w, 36, (ctx) => {
    ctx.scale(0.5, 0.5);
    slateBar(ctx, 2, 72, 'top', w * 2);
  });
  for (const stage of [0, 1, 2, 3]) {
    paint(scene, `barricade-${stage}`, BARRICADE_TEX.w, BARRICADE_TEX.h, (ctx) => {
      ctx.scale(0.5, 0.5);
      ctx.translate(-(LOG_X - BARRICADE_TEX.logX * 2), -(LOG_TOP - BARRICADE_TEX.top * 2));
      drawBarricade(ctx, stage);
    });
  }
}

/**
 * Turns the vale into the frozen pass: the colours drained and cooled, a pale haze, snow drifts
 * lying over the verge and the road, and flakes in the air (the scene adds none that move).
 */
function drawWinter(ctx: CanvasRenderingContext2D, E: Extent) {
  const all = () => ctx.fillRect(E.l, E.t, E.r - E.l, E.b - E.t);
  ctx.save();
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = 'rgba(128,128,128,0.75)';
  all();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#c4d8f0';
  all();
  ctx.globalCompositeOperation = 'screen';
  ctx.fillStyle = 'rgba(70,90,120,0.45)';
  all();
  ctx.restore();
  // Drifts: soft white heaps along the far verge, over the road and along the near edge.
  const rnd = seeded(77);
  ctx.save();
  for (let i = 0; i < 90; i++) {
    const x = E.l + rnd() * (E.r - E.l);
    const band = rnd();
    const y = band < 0.35 ? 540 + rnd() * 50 : band < 0.8 ? 600 + rnd() * 360 : 960 + rnd() * 80;
    const rx = 40 + rnd() * 110;
    ctx.globalAlpha = band < 0.35 || band >= 0.8 ? 0.75 : 0.32;
    poly(ctx, ngon(x, y, rx, rx * 0.22, 9, rnd()), '#f4f8fc');
    ctx.globalAlpha *= 0.6;
    poly(ctx, ngon(x + rx * 0.2, y + rx * 0.06, rx * 0.7, rx * 0.12, 7, rnd()), '#c8d8ea');
  }
  // Flakes in the air.
  ctx.globalAlpha = 0.8;
  for (let i = 0; i < 260; i++) {
    const x = E.l + rnd() * (E.r - E.l);
    const y = E.t + rnd() * (E.b - E.t);
    const r = 1.5 + rnd() * 3;
    poly(ctx, ngon(x, y, r, r, 5, rnd()), '#ffffff');
  }
  ctx.restore();
}

/** A slate bar with faceted bevels and a gold trim on its inner edge. */
function slateBar(ctx: CanvasRenderingContext2D, y: number, h: number, trim: 'top' | 'bottom', W: number) {
  poly(ctx, rect(0, y, W, h), '#262b36');
  for (let x = 0; x < W; x += 160) {
    poly(ctx, [[x, y], [x + 160, y], [x + 80, y + h / 2]], '#2c3240');
    poly(ctx, [[x + 80, y + h / 2], [x + 160, y + h], [x, y + h]], '#22262f');
  }
  const ty = trim === 'bottom' ? y + h - 4 : y;
  poly(ctx, rect(0, ty, W, 4), '#b8862c');
  poly(ctx, rect(0, trim === 'bottom' ? ty : ty + 2, W, 2), '#e5b53a');
}

function drawBackground(ctx: CanvasRenderingContext2D, E: Extent) {
  // Sky: a triangle mesh from cool blue overhead to warm haze at the horizon.
  let rnd = seeded(4);
  {
    const SP = 120;
    const rows = 7;
    // Rows above and columns beside the designed sky for a bigger view.
    const r0 = -Math.ceil(-E.t / 80);
    const c0 = -Math.ceil(-E.l / SP);
    const cols = 19 + Math.ceil((E.r - W) / SP);
    const pts: Pt[][] = [];
    for (let r = r0; r <= rows; r++) {
      pts.push([]);
      for (let c = c0; c <= cols; c++) {
        pts[r - r0].push([c * SP - 120 + (((r % 2) + 2) % 2) * 50 + (rnd() - 0.5) * 50, r * 80 + (rnd() - 0.5) * 30 * (r > r0 && r < rows ? 1 : 0)]);
      }
    }
    const skyCol = (y: number) => {
      const t = Math.max(0, Math.min(1, (y - 80) / 380));
      return t < 0.6 ? mix('#6f9fcf', '#a9c9e2', t / 0.6) : mix('#a9c9e2', '#f2d9b4', (t - 0.6) / 0.4);
    };
    for (let r = 0; r < rows - r0; r++) {
      for (let c = 0; c < cols - c0; c++) {
        const a = pts[r][c];
        const b = pts[r][c + 1];
        const d = pts[r + 1][c];
        const e = pts[r + 1][c + 1];
        for (const tri of [[a, b, e], [a, e, d]]) {
          const y = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
          const col = mix(skyCol(y), '#ffffff', rnd() * 0.06);
          poly(ctx, tri, col, col, 1);
        }
      }
    }
  }
  // Sun glow and clouds.
  ctx.save();
  const sg = ctx.createRadialGradient(330, 200, 10, 330, 200, 420);
  sg.addColorStop(0, 'rgba(255,240,200,0.55)');
  sg.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = sg;
  ctx.fillRect(E.l, E.t, E.r - E.l, 500 - E.t);
  ctx.restore();
  const cloud = (x: number, y: number, s: number) => {
    rnd = seeded(Math.round(x));
    softShadow(ctx, () => poly(ctx, ngon(x + 14, y + 18, s * 1.7, s * 0.45, 9), '#5b7fa8'), 10, 0.25);
    for (const [dx, dy, r] of [[-1.1, 0.15, 0.55], [-0.45, -0.25, 0.75], [0.35, -0.1, 0.65], [1.0, 0.2, 0.5]]) {
      facet(ctx, ngon(x + dx * s, y + dy * s, r * s, r * s * 0.8, 7, rnd()), '#eef3f8', { edge: false, k: 1.3 });
    }
    poly(ctx, [[x - s * 1.6, y + s * 0.3], [x + s * 1.5, y + s * 0.35], [x + s * 1.2, y + s * 0.5], [x - s * 1.3, y + s * 0.5]], '#c9d6e6');
  };
  cloud(340, 150, 58);
  cloud(980, 104, 66);
  cloud(1530, 170, 58);
  cloud(1790, 112, 48);
  // Beyond the designed view, for a wider one.
  cloud(-210, 128, 52);
  cloud(2150, 140, 56);

  // Mountains: faceted peaks with snow, the far range bluish and the near one darker.
  const range = (peaks: number[][], base: number, col: string, snow: boolean, seed: number) => {
    rnd = seeded(seed);
    for (const [px, py, hw] of peaks) {
      const lx = px - hw;
      const rx = px + hw * (0.9 + rnd() * 0.3);
      const ridgeL: Pt = [px - hw * 0.45, py + (base - py) * 0.42 + (rnd() - 0.5) * 20];
      const ridgeR: Pt = [px + hw * 0.5, py + (base - py) * 0.38];
      const mid: Pt = [px + hw * 0.08, base];
      poly(ctx, [[px, py], [lx, base], ridgeL], shade(col, 0.82));
      poly(ctx, [[px, py], ridgeL, mid], shade(col, 0.62));
      poly(ctx, [[px, py], mid, ridgeR], shade(col, 0.4));
      poly(ctx, [[px, py], ridgeR, [rx, base]], shade(col, 0.24));
      if (snow) {
        const s = 0.26;
        const a: Pt = [px + (lx - px) * s, py + (base - py) * s];
        const b: Pt = [px + (ridgeL[0] - px) * s * 1.5, py + (ridgeL[1] - py) * s * 1.4];
        const c: Pt = [px + (mid[0] - px) * s, py + (mid[1] - py) * s * 0.9];
        const d: Pt = [px + (rx - px) * s, py + (base - py) * s];
        poly(ctx, [[px, py], a, b], '#ffffff');
        poly(ctx, [[px, py], b, c], '#e3ebf5');
        poly(ctx, [[px, py], c, d], '#b9c7dc');
      }
    }
  };
  range([[120, 300, 260], [640, 214, 300], [1010, 300, 220], [1450, 236, 280], [1880, 300, 260]], 470, '#7d92b8', true, 11);
  range([[-300, 250, 240], [2250, 260, 260]], 470, '#7d92b8', true, 13);
  range([[380, 330, 240], [860, 340, 220], [1230, 330, 200], [1700, 350, 240]], 470, '#5d7a9a', false, 12);
  range([[-260, 340, 200], [2140, 330, 210]], 470, '#5d7a9a', false, 14);

  // The castle on the far hill: blocky prisms in the haze, with a gold pennant.
  {
    const x0 = 1176;
    const w = 224;
    const base = 432;
    const haze = '#7488a8';
    const tower = (x: number, tw: number, top: number) => {
      poly(ctx, rect(x, top, tw, base - top), shade(haze, 0.62));
      poly(ctx, rect(x + tw * 0.7, top, tw * 0.3, base - top), shade(haze, 0.38));
      for (let k = 0; k < 3; k++) poly(ctx, rect(x + k * (tw / 3) + 2, top - 12, tw / 3 - 8, 12), shade(haze, 0.6));
      poly(ctx, [[x - 6, top - 12], [x + tw / 2, top - 70], [x + tw * 0.62, top - 12]], '#8d6f8c');
      poly(ctx, [[x + tw * 0.62, top - 12], [x + tw / 2, top - 70], [x + tw + 6, top - 12]], '#5e4a63');
      poly(ctx, rect(x + tw * 0.42, top + 26, 8, 14), '#ffd27a');
    };
    poly(ctx, rect(x0 + 30, 340, w - 60, base - 340), shade(haze, 0.55));
    for (let k = 0; k < 8; k++) poly(ctx, rect(x0 + 34 + k * 20, 328, 12, 12), shade(haze, 0.55));
    tower(x0, 48, 286);
    tower(x0 + w - 48, 48, 286);
    tower(x0 + 88, 48, 250);
    line(ctx, [[x0 + 112, 180], [x0 + 112, 228]], '#4a3a3a', 3);
    poly(ctx, [[x0 + 114, 182], [x0 + 146, 190], [x0 + 114, 200]], '#e8b33a');
    poly(ctx, [[x0 + 114, 190], [x0 + 146, 190], [x0 + 114, 200]], '#c08a22');
    poly(ctx, rect(x0 + 98, 408, 28, 24), '#3d4660');
  }

  // Hills and a row of pines.
  rnd = seeded(5);
  const step = (W + 80) / 40;
  const i0 = -Math.ceil(-E.l / step);
  const i1 = 40 + Math.ceil((E.r - W) / step);
  const ridge = (y0: number, amp: number, f: number, ph: number): Pt[] =>
    [...Array(i1 - i0 + 1).keys()].map((k) => {
      const x = (k + i0) * step - 40;
      return [x, y0 + amp * Math.sin(x / f + ph) + amp * 0.4 * Math.sin(x / (f * 0.37) + ph * 2)];
    });
  const hill = (r: Pt[], bottom: number, col: string) => {
    for (let i = 0; i < r.length - 1; i++) {
      const a = r[i];
      const b = r[i + 1];
      const slope = (b[1] - a[1]) / (b[0] - a[0]);
      const l = 0.55 - slope * 1.6 + (rnd() - 0.5) * 0.12;
      const m: Pt = [(a[0] + b[0]) / 2 + (rnd() - 0.5) * 20, (a[1] + bottom) / 2 + 10];
      poly(ctx, [a, b, m], shade(col, Math.max(0.1, Math.min(0.95, l))));
      poly(ctx, [a, m, [a[0], bottom]], shade(col, 0.42 + rnd() * 0.08));
      poly(ctx, [b, m, [b[0], bottom]], shade(col, 0.36 + rnd() * 0.08));
      poly(ctx, [[a[0], bottom], m, [b[0], bottom]], shade(col, 0.4));
    }
  };
  hill(ridge(430, 22, 260, 0.4), 520, '#5f8f55');
  const pine = (x: number, y: number, s: number) => {
    softShadow(ctx, () => poly(ctx, [[x, y], [x + s * 1.2, y + s * 0.3], [x + s * 0.9, y + s * 0.45], [x - s * 0.2, y + s * 0.15]], '#1d3a1f'), 3, 0.35);
    poly(ctx, rect(x - s * 0.08, y - s * 0.2, s * 0.16, s * 0.25), '#5a3a22');
    for (let k = 0; k < 3; k++) {
      const yy = y - s * 0.15 - k * s * 0.42;
      const ww = s * (0.55 - k * 0.12);
      const tip = yy - s * 0.62;
      poly(ctx, [[x, tip], [x - ww, yy], [x, yy + s * 0.04]], '#4f8f3e');
      poly(ctx, [[x, tip], [x, yy + s * 0.04], [x + ww, yy]], '#2d5e2c');
    }
  };
  rnd = seeded(8);
  for (let x = 20; x < E.r; x += 46 + rnd() * 60) {
    const y = 470 + 20 * Math.sin(x / 260 + 0.4) + 10;
    if (x > 1150 && x < 1420) continue;
    pine(x, y + rnd() * 12, 26 + rnd() * 16);
  }
  if (E.l < 0) {
    const r2 = seeded(9);
    for (let x = -36 - r2() * 30; x > E.l - 30; x -= 46 + r2() * 60) pine(x, 470 + 20 * Math.sin(x / 260 + 0.4) + 10 + r2() * 12, 26 + r2() * 16);
  }
  hill(ridge(500, 8, 200, 1.2), 580, '#6aa84f');

  // The road: a jittered triangle mesh in packed-earth browns, with ruts and stones.
  {
    const top = 560;
    const bottom = 990;
    const SP = 64;
    const rows = Math.ceil((bottom - top) / SP) + 3;
    const cols = Math.ceil(W / SP) + 4;
    // Columns beside the designed road for a wider view, from a seed of their own.
    const cl = Math.ceil(-E.l / SP);
    const cr = Math.ceil((E.r - W) / SP);
    const pts: [number, number, number][][] = [...Array(rows)].map(() => []);
    const point = (r: number, c: number) => {
      const x = (c - 1.5) * SP + (r % 2) * SP * 0.5 + (rnd() - 0.5) * SP * 0.6;
      const y = top - 24 + r * SP * 0.92 + (rnd() - 0.5) * SP * 0.5;
      pts[r][c + cl] = [x, y, (rnd() - 0.5) * 18 + 6 * Math.sin(x / 140)];
    };
    rnd = seeded(17);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) point(r, c);
    rnd = seeded(18);
    for (let r = 0; r < rows; r++) for (let c = -cl; c < cols + cr; c++) if (c < 0 || c >= cols) point(r, c);
    const ramp = ['#5e3f24', '#77522f', '#8d643a', '#a07446', '#b48a58'];
    const tri = (a: number[], b: number[], c: number[]) => {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      if (n[2] < 0) n = n.map((k) => -k);
      const nl = Math.hypot(n[0], n[1], n[2]);
      const l = Math.max(0, Math.min(1, 0.55 + ((n[0] * -0.55 + n[1] * -0.55 + n[2] * 0.62) / nl - 0.62) * 2.2));
      const t = l * (ramp.length - 1.001);
      const i = Math.floor(t);
      const col = mix(ramp[i], ramp[i + 1], t - i);
      poly(ctx, [a, b, c].map((p) => [p[0], p[1]] as Pt), col, col, 1);
    };
    ctx.save();
    ctx.beginPath();
    ctx.rect(E.l, top, E.r - E.l, bottom - top);
    ctx.clip();
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols + cl + cr - 1; c++) {
        tri(pts[r][c], pts[r][c + 1], pts[r + 1][c + 1]);
        tri(pts[r][c], pts[r + 1][c + 1], pts[r + 1][c]);
      }
    }
    // Two worn ruts.
    ctx.globalAlpha = 0.18;
    for (const y of [700, 880]) {
      for (let x = -20 - 90 * Math.ceil(-E.l / 90); x < E.r; x += 90) {
        const s = (xx: number) => 6 * Math.sin(xx / 300);
        poly(ctx, [[x, y - 6 + s(x)], [x + 92, y - 4 + s(x + 92)], [x + 92, y + 8 + s(x + 92)], [x, y + 6 + s(x)]], '#3a2414');
      }
    }
    ctx.globalAlpha = 1;
    rnd = seeded(23);
    for (let i = 0; i < 90; i++) {
      const x = rnd() * W;
      const y = top + 10 + rnd() * (bottom - top - 20);
      const s = 4 + rnd() * 7;
      poly(ctx, [[x - s, y + s * 0.3], [x - s * 0.2, y - s * 0.6], [x + s * 0.4, y + s * 0.4]], '#c9b7a0');
      poly(ctx, [[x - s * 0.2, y - s * 0.6], [x + s, y], [x + s * 0.4, y + s * 0.4]], '#7d6a58');
    }
    // As many again for each stretch of road beyond the designed view.
    rnd = seeded(24);
    for (const [x0, x1] of [[E.l, 0], [W, E.r]]) {
      for (let i = 0; i < Math.round((90 * (x1 - x0)) / W); i++) {
        const x = x0 + rnd() * (x1 - x0);
        const y = top + 10 + rnd() * (bottom - top - 20);
        const s = 4 + rnd() * 7;
        poly(ctx, [[x - s, y + s * 0.3], [x - s * 0.2, y - s * 0.6], [x + s * 0.4, y + s * 0.4]], '#c9b7a0');
        poly(ctx, [[x - s * 0.2, y - s * 0.6], [x + s, y], [x + s * 0.4, y + s * 0.4]], '#7d6a58');
      }
    }
    ctx.restore();
    // Grass lips over both edges, in toothy triangles, and the verge below the road.
    rnd = seeded(31);
    const lip = (y0: number, dir: number, x: number) => {
      const h = 10 + rnd() * 16;
      const yy = y0 + 4 * Math.sin(x / 90);
      poly(ctx, [[x, yy - dir * 6], [x + 26, yy - dir * 6], [x + 13 + (rnd() - 0.5) * 8, yy + dir * h]], rnd() < 0.5 ? '#5f9a45' : '#4a8238');
    };
    for (const [y0, dir] of [[top, 1], [bottom, -1]]) {
      for (let x = -10; x < W; x += 26) lip(y0, dir, x);
    }
    // The lips and the verge's teeth beyond the designed view, from seeds of their own.
    rnd = seeded(32);
    const lipEnd = -10 + 26 * Math.ceil((W + 10) / 26);
    for (const [y0, dir] of [[top, 1], [bottom, -1]]) {
      for (let x = -36; x > E.l - 26; x -= 26) lip(y0, dir, x);
      for (let x = lipEnd; x < E.r; x += 26) lip(y0, dir, x);
    }
    poly(ctx, rect(E.l, bottom + 4, E.r - E.l, E.b - bottom - 4), '#3f7432');
    const tooth = (x: number) => poly(ctx, [[x, bottom + 6], [x + 30, bottom + 6], [x + 15, 1012]], rnd() < 0.5 ? '#4b8a3b' : '#356a2c');
    rnd = seeded(37);
    for (let x = 0; x < W; x += 30) tooth(x);
    rnd = seeded(38);
    for (let x = -30; x > E.l - 30; x -= 30) tooth(x);
    for (let x = W; x < E.r; x += 30) tooth(x);
    // Tufts of grass on the verge below the designed view, for a taller one.
    rnd = seeded(39);
    for (let i = 0; i < Math.round(((E.r - E.l) * Math.max(0, E.b - 1080)) / 2400); i++) {
      const x = E.l + rnd() * (E.r - E.l);
      const y = 1080 + rnd() * (E.b - 1080);
      const s = 8 + rnd() * 10;
      poly(ctx, [[x - s, y], [x - s * 0.3, y - s * 1.4], [x, y]], '#4b8a3b');
      poly(ctx, [[x - s * 0.4, y], [x + s * 0.2, y - s * 1.8], [x + s * 0.6, y]], '#5f9a45');
      poly(ctx, [[x, y], [x + s * 0.8, y - s * 1.2], [x + s, y]], '#356a2c');
    }
  }
}

// ---- The barricade: a faceted upright log with sharpened stakes through it (a cheval de frise).

/** The log's centre and top in double units, where the mockup drew it. */
const LOG_X = 365;
const LOG_TOP = 528;
const LOG_BOTTOM = 1008;
/** The barricade texture's size, and where in it the log's centre and top are (view pixels). */
export const BARRICADE_TEX = { w: 140, h: 266, logX: 70, top: 14 };

/** Stake pairs crossing the log, from the top down. */
const STAKES = [...Array(8).keys()].map((i) => LOG_TOP + 34 + i * 60);

/** Which stakes are splintered at each stage: 'L' or 'R' for one tip, 'X' for gone. */
const BROKEN: Record<number, Record<number, string>> = {
  0: {},
  1: { 2: 'R', 5: 'R' },
  2: { 1: 'L', 2: 'X', 4: 'R', 5: 'R', 6: 'L' },
};

function drawBarricade(ctx: CanvasRenderingContext2D, stage: number) {
  const x = LOG_X;
  if (stage === 3) {
    drawWreck(ctx);
    return;
  }
  const broken = BROKEN[stage];
  const lean = stage === 2 ? 0.04 : 0;
  ctx.save();
  ctx.translate(x, LOG_BOTTOM);
  ctx.rotate(lean);
  ctx.translate(-x, -LOG_BOTTOM);
  softShadow(ctx, () => poly(ctx, [[x + 10, LOG_TOP + 60], [x + 70, LOG_TOP + 90], [x + 90, LOG_BOTTOM], [x + 10, LOG_BOTTOM]], '#2a1808'), 6, 0.4);
  const rod = (y: number, dir: number, cut: string | undefined) => {
    if (cut === 'X') return;
    const ang = dir > 0 ? -0.5 : 0.5;
    const L = 70;
    const ca = Math.cos(ang);
    const sa = Math.sin(ang);
    const nx = -sa * 6;
    const ny = ca * 6;
    const A: Pt = [x - ca * (cut === 'L' ? 26 : L), y - sa * (cut === 'L' ? 26 : L)];
    const B: Pt = [x + ca * (cut === 'R' ? 26 : L), y + sa * (cut === 'R' ? 26 : L)];
    poly(ctx, [[A[0] - nx, A[1] - ny], [B[0] - nx, B[1] - ny], B, A], '#c99260');
    poly(ctx, [A, B, [B[0] + nx, B[1] + ny], [A[0] + nx, A[1] + ny]], '#7a5230');
    const tip = (P: Pt, s: number, splintered: boolean) => {
      if (splintered) {
        poly(ctx, [[P[0] - nx, P[1] - ny], [P[0] + s * ca * 8 + 3, P[1] + s * sa * 8 - 4], [P[0] + s * ca * 3, P[1] + s * sa * 3 + 2], [P[0] + s * ca * 9, P[1] + s * sa * 9 + 5], [P[0] + nx, P[1] + ny]], '#e6c89a');
        return;
      }
      const T: Pt = [P[0] + s * ca * 22, P[1] + s * sa * 22];
      poly(ctx, [[P[0] - nx, P[1] - ny], T, P], '#f3d7aa');
      poly(ctx, [P, T, [P[0] + nx, P[1] + ny]], '#b48b5a');
    };
    tip(A, -1, cut === 'L');
    tip(B, 1, cut === 'R');
  };
  STAKES.forEach((y, i) => rod(y, -1, i % 2 ? broken[i] : undefined));
  const w = 15;
  poly(ctx, [[x - w, LOG_TOP], [x - 4, LOG_TOP - 8], [x - 4, LOG_BOTTOM], [x - w, LOG_BOTTOM]], '#c48c56');
  poly(ctx, [[x - 4, LOG_TOP - 8], [x + 6, LOG_TOP - 6], [x + 6, LOG_BOTTOM], [x - 4, LOG_BOTTOM]], '#9a6a3c');
  poly(ctx, [[x + 6, LOG_TOP - 6], [x + w, LOG_TOP + 2], [x + w, LOG_BOTTOM], [x + 6, LOG_BOTTOM]], '#6a4426');
  poly(ctx, [[x - w, LOG_TOP], [x - 4, LOG_TOP - 8], [x + 6, LOG_TOP - 6], [x + w, LOG_TOP + 2], [x + 2, LOG_TOP + 6]], '#e0b47e');
  if (stage === 2) {
    // A split down the log.
    line(ctx, [[x - 2, LOG_TOP + 140], [x + 3, LOG_TOP + 190], [x - 1, LOG_TOP + 240], [x + 2, LOG_TOP + 300]], '#3a2414', 3);
  }
  for (let y = LOG_TOP + 60; y < LOG_BOTTOM; y += 140) {
    poly(ctx, rect(x - w - 1, y, 10, 10), '#8a9098');
    poly(ctx, rect(x - 6, y, 12, 10), '#5c6068');
    poly(ctx, rect(x + 6, y, 10, 10), '#3a3d44');
  }
  STAKES.forEach((y, i) => rod(y, 1, i % 2 ? undefined : broken[i]));
  ctx.restore();
  if (stage > 0) {
    // Splinters on the ground.
    const bits = stage === 1 ? 3 : 7;
    const rnd = seeded(60 + stage);
    for (let i = 0; i < bits; i++) {
      const sx = x + 20 + rnd() * 80;
      const sy = LOG_BOTTOM - 40 + rnd() * 40;
      const a = rnd() * 3;
      poly(ctx, [[sx, sy], [sx + Math.cos(a) * 18, sy + Math.sin(a) * 18], [sx + Math.cos(a) * 18 + 3, sy + Math.sin(a) * 18 + 4], [sx + 3, sy + 4]], '#b9864f');
    }
  }
}

/** The fallen barricade: the log down on the road among broken stakes and splinters. */
function drawWreck(ctx: CanvasRenderingContext2D) {
  const x = LOG_X;
  const y = LOG_BOTTOM - 40;
  softShadow(ctx, () => poly(ctx, [[x - 100, y + 10], [x + 120, y + 4], [x + 130, y + 40], [x - 90, y + 40]], '#2a1808'), 6, 0.4);
  const rnd = seeded(77);
  for (let i = 0; i < 9; i++) {
    const sx = x - 90 + rnd() * 140;
    const sy = LOG_BOTTOM - 200 + rnd() * 170;
    const a = rnd() * Math.PI;
    const L = 24 + rnd() * 26;
    const nx = -Math.sin(a) * 5;
    const ny = Math.cos(a) * 5;
    const B: Pt = [sx + Math.cos(a) * L, sy + Math.sin(a) * L];
    poly(ctx, [[sx - nx, sy - ny], [B[0] - nx, B[1] - ny], B, [sx, sy]], '#c99260');
    poly(ctx, [[sx, sy], B, [B[0] + nx, B[1] + ny], [sx + nx, sy + ny]], '#7a5230');
  }
  // The log, lying across the road.
  const top: Pt[] = [[x - 110, y - 14], [x + 110, y - 22], [x + 116, y - 10], [x - 104, y - 2]];
  facet(ctx, top, '#a8743f', { k: 1.3 });
  poly(ctx, [[x - 104, y - 2], [x + 116, y - 10], [x + 112, y + 12], [x - 108, y + 18]], '#6a4426');
  poly(ctx, ngon(x - 108, y + 6, 10, 14, 6), '#e0b47e', '#8a5a32', 2);
  for (let i = 0; i < 10; i++) {
    const sx = x - 110 + rnd() * 210;
    const sy = LOG_BOTTOM - 20 + rnd() * 20;
    const a = rnd() * 3;
    poly(ctx, [[sx, sy], [sx + Math.cos(a) * 16, sy + Math.sin(a) * 16], [sx + Math.cos(a) * 16 + 3, sy + Math.sin(a) * 16 + 4], [sx + 3, sy + 4]], '#b9864f');
  }
}
