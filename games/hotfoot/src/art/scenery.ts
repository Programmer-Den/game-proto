import Phaser from 'phaser';
import { SKY_GAPS } from '../game/course';
import { DESIGN, DESIGN_GROUND_Y, FRAME, GROUND_Y, MARGIN, VIEW } from '../scenes/layout';
import { C, bezant, circle, gold, heartPath, hl, oval, paint, poly, seeded, shade, star6, type Ctx, type Pt } from './ink';

// The world as a gothic miniature on a vellum page: a diapered sky of lapis and madder lozenges with
// gold fleurettes and banded sunset clouds, a gold-leaf moon, stepped crags with a pink castle, then
// lollipop trees and a ruined tower nearer the road, a turf road strewn with flowers, and a margin of
// acanthus scrollwork under it. Traps, coins, the checkpoint banner and the wayside shrine are
// painted in the same flat colours and ink. Most of it is drawn in page units (twice screen size) and
// scaled by half, so the numbers match the approved mockup. The scrolling layers wrap every 960 px;
// the page, sky and frame are painted as wide as the view, and the sky as tall as the road is low.

/** The width the scrolling layers wrap at. */
const W = DESIGN.w;
/** How much lower the road is than designed, in page units (a taller view grows the sky). */
const lift = () => (GROUND_Y - DESIGN_GROUND_Y) * U;
/** Page units per screen pixel. */
const U = 2;
/** The road in page units, inside a layer whose bottom edge is the road. */
const half = (ctx: Ctx) => ctx.scale(1 / U, 1 / U);

/** The vellum page behind everything: stains, and the bas-de-page scrollwork with its snail. */
function page(scene: Phaser.Scene) {
  const W = VIEW.w;
  paint(scene, 'page', W, VIEW.h, (ctx) => {
    ctx.fillStyle = C.vellum;
    ctx.fillRect(0, 0, W, VIEW.h);
    const rand = seeded(2);
    for (let i = 0; i < 130; i++) {
      const x = rand() * W;
      const y = rand() * VIEW.h;
      const r = 10 + rand() * 45;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(170,120,60,${0.03 + rand() * 0.04})`);
      g.addColorStop(1, 'rgba(170,120,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    half(ctx);
    const yB = MARGIN.scrollY * U;
    // The stem: an inked vine waving along the margin.
    ctx.beginPath();
    ctx.moveTo(30, yB);
    for (let x = 30; x < W * U - 30; x += 160) ctx.bezierCurveTo(x + 40, yB - 50, x + 120, yB + 50, x + 160, yB);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = C.leaf;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Acanthus leaves above and below the stem in turn, each with a gold dot beside it.
    for (let x = 30, k = 0; x < W * U - 60; x += 80, k++) {
      const up = k % 2 === 0;
      const cx = x + 40;
      const cy = yB + (up ? -26 : 26);
      const s = up ? -1 : 1;
      const col = [C.lapis, C.verm, C.madder, C.leaf][k % 4];
      ctx.beginPath();
      ctx.moveTo(cx - 10, yB + 8 * s);
      ctx.bezierCurveTo(cx - 40, cy + 10 * s, cx + 8, cy + 40 * s, cx + 30, cy + 14 * s);
      ctx.bezierCurveTo(cx + 18, cy, cx + 10, cy, cx - 10, yB + 8 * s);
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      hl(ctx, [[cx - 18, cy], [cx + 4, cy + 18 * s]], 2);
      circle(ctx, cx + 46, yB - 30 * s, 6, gold(ctx, cx + 40, yB - 6, cx + 52, yB + 6), 2);
    }
    // A snail crawling along the margin: a drollery.
    const sx = (W - 70) * U;
    const sy = (MARGIN.scrollY + 33) * U;
    poly(ctx, [[sx - 40, sy], [sx + 50, sy], [sx + 60, sy - 12], [sx + 70, sy - 30], [sx + 64, sy - 34], [sx + 52, sy - 14], [sx - 30, sy - 8]], '#c9b08a', 2.5);
    circle(ctx, sx, sy - 26, 24, C.madder, 2.5);
    ctx.strokeStyle = C.goldLight;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 4; a += 0.2) {
      const r = 20 - a * 1.5;
      ctx.lineTo(sx + Math.cos(a) * r, sy - 26 + Math.sin(a) * r);
    }
    ctx.stroke();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx + 66, sy - 32);
    ctx.lineTo(sx + 70, sy - 48);
    ctx.moveTo(sx + 62, sy - 32);
    ctx.lineTo(sx + 58, sy - 46);
    ctx.stroke();
  });
}

/** The miniature's sky, inside the frame: a diaper of lapis and madder, sunset clouds, stars and the moon. */
function sky(scene: Phaser.Scene) {
  const W = VIEW.w;
  const w = FRAME.w;
  const h = GROUND_Y - FRAME.y;
  paint(scene, 'sky', w, h, (ctx) => {
    half(ctx);
    // Page coordinates of the mockup: the sky's top-left corner is (14, 84). A taller sky moves
    // everything down by `lift` and carries the diaper on up.
    const up = lift();
    ctx.translate(-FRAME.x * U, -FRAME.y * U + up);
    const top = FRAME.y * U;
    const bottom = GROUND_Y * U - up;
    const D = 56;
    for (let r = -1 - 2 * Math.ceil(up / D); (r * D) / 2 < bottom - top + D; r++) {
      for (let c = -1; c * D < W * U + D; c++) {
        const cx = c * D + (r % 2 ? D / 2 : 0);
        const cy = top + (r * D) / 2;
        const col = (r + 400) % 2 ? C.lapis : C.madder;
        poly(ctx, [[cx, cy - D / 2], [cx + D / 2, cy], [cx, cy + D / 2], [cx - D / 2, cy]], col, 1.5, 'rgba(232,194,90,0.8)');
        ctx.fillStyle = C.goldDot;
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        circle(ctx, cx, cy, 2.4, '#fff2c0', 0);
      }
    }
    // Sunset: banded scalloped clouds of rose, peach and gold low in the sky.
    for (const [y, col] of [[520, '#c45a6a'], [575, '#e07f6a'], [630, '#eea56a'], [690, '#f4c878'], [750, '#f7e0a0']] as const) {
      ctx.beginPath();
      ctx.moveTo(0, bottom);
      ctx.lineTo(0, y);
      for (let x = 0; x <= W * U; x += 64) ctx.quadraticCurveTo(x + 32, y - 22, x + 64, y);
      ctx.lineTo(W * U, bottom);
      ctx.closePath();
      ctx.fillStyle = col;
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,250,235,0.6)';
      for (let x = 10; x <= W * U; x += 64) {
        ctx.beginPath();
        ctx.arc(x + 22, y + 2, 12, Math.PI * 1.15, Math.PI * 1.6);
        ctx.stroke();
      }
    }
    for (const [x, y] of [[180, 200], [420, 150], [610, 290], [1000, 250], [1180, 160], [1300, 380], [1720, 160], [1830, 330], [90, 420], [520, 450], [1660, 430], [800, 180]]) {
      star6(ctx, x, y, 11);
    }
    // The moon: a gold-leaf disc on a vellum halo, with rays and an inked face in profile.
    const M = { x: 1520, y: 240, r: 68 };
    circle(ctx, M.x, M.y, M.r + 10, C.vellum, 3);
    circle(ctx, M.x, M.y, M.r, gold(ctx, M.x - M.r, M.y - M.r, M.x + M.r, M.y + M.r), 3);
    ctx.strokeStyle = '#c9962e';
    ctx.lineWidth = 3;
    for (let k = 0; k < 24; k++) {
      const a = (k * Math.PI) / 12;
      const out = M.r + 24 + (k % 2) * 10;
      ctx.beginPath();
      ctx.moveTo(M.x + Math.cos(a) * (M.r + 12), M.y + Math.sin(a) * (M.r + 12));
      ctx.lineTo(M.x + Math.cos(a) * out, M.y + Math.sin(a) * out);
      ctx.stroke();
    }
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(M.x + 14, M.y - 46);
    ctx.quadraticCurveTo(M.x - 6, M.y - 30, M.x - 2, M.y - 12);
    ctx.lineTo(M.x - 16, M.y - 2);
    ctx.lineTo(M.x - 2, M.y + 4);
    ctx.quadraticCurveTo(M.x - 10, M.y + 18, M.x + 2, M.y + 22);
    ctx.quadraticCurveTo(M.x - 4, M.y + 40, M.x + 18, M.y + 48);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(M.x + 6, M.y - 18, 4, 0, Math.PI);
    ctx.stroke();
  });
}

/** Height of the far layer, in screen pixels; its bottom is the road. */
const FAR_H = 180;

/** Byzantine crags: stepped rock with white highlights along their lit ledges, and a pink castle. */
function far(scene: Phaser.Scene) {
  paint(scene, 'far', W, FAR_H, (ctx) => {
    half(ctx);
    const base = FAR_H * U;
    const crag = (x: number, w: number, h: number, col: string, seed: number) => {
      const rand = seeded(seed);
      const pts: Pt[] = [[x, base]];
      for (let i = 0; i < 4; i++) {
        const t0 = i / 4;
        const t1 = (i + 1) / 4;
        const y = base - h * (i % 2 ? 0.75 + rand() * 0.25 : 0.55 + rand() * 0.2) * (1 - Math.abs(t0 - 0.45));
        pts.push([x + w * t0 + 8, y + 8], [x + w * t0 + 14, y], [x + w * t1 - 6, y + 4]);
      }
      pts.push([x + w, base]);
      poly(ctx, pts, col, 3);
      for (let i = 1; i < pts.length - 2; i += 3) hl(ctx, [[pts[i][0], pts[i][1] + 2], [pts[i + 1][0] + 2, pts[i + 1][1] + 2], [pts[i + 1][0] + 30, pts[i + 1][1] + 4]], 3);
      ctx.strokeStyle = 'rgba(43,27,18,0.45)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 10; i++) {
        const xx = x + 20 + rand() * (w - 40);
        const yy = base - rand() * h * 0.4;
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx + 10, yy + 18);
        ctx.stroke();
      }
    };
    const castle = (x: number, y: number) => {
      poly(ctx, [[x, y], [x + 120, y], [x + 120, y + 80], [x, y + 80]], C.rose, 2.5);
      poly(ctx, [[x - 16, y - 40], [x + 20, y - 40], [x + 20, y + 80], [x - 16, y + 80]], C.rose, 2.5);
      poly(ctx, [[x - 22, y - 40], [x + 2, y - 76], [x + 26, y - 40]], C.lapis, 2.5);
      poly(ctx, [[x + 100, y - 24], [x + 132, y - 24], [x + 132, y + 80], [x + 100, y + 80]], C.rose, 2.5);
      poly(ctx, [[x + 94, y - 24], [x + 116, y - 58], [x + 138, y - 24]], C.verm, 2.5);
      for (let k = 0; k < 4; k++) poly(ctx, [[x + 28 + k * 18, y - 12], [x + 38 + k * 18, y - 12], [x + 38 + k * 18, y], [x + 28 + k * 18, y]], C.rose, 2);
      poly(ctx, [[x + 50, y + 80], [x + 50, y + 50], [x + 60, y + 40], [x + 70, y + 50], [x + 70, y + 80]], C.ink, 1);
      poly(ctx, [[x + 112, y + 4], [x + 112, y - 6], [x + 116, y - 10], [x + 120, y - 6], [x + 120, y + 4]], C.lapis, 1.5);
    };
    // Each crag is drawn once more a page-width to each side, so the layer wraps without a seam.
    for (const dx of [-W * U, 0, W * U]) {
      crag(-40 + dx, 520, 300, '#8f9b7a', 4);
      crag(380 + dx, 460, 250, '#a49a7e', 6);
      crag(760 + dx, 560, 330, '#8a9474', 9);
      crag(1240 + dx, 420, 230, '#a49a7e', 12);
      crag(1580 + dx, 420, 300, '#8f9b7a', 15);
      castle(1130 + dx, base - 260);
    }
  });
}

/** A scalloped cloud bank in page units: puffs of radius about `r` along `w` from (x, y), on a flat bottom. */
function cloudBank(ctx: Ctx, x: number, y: number, w: number, r: number, fill: string, seed: number, lw = 3) {
  const rand = seeded(seed);
  const n = Math.max(2, Math.round(w / (r * 1.4)));
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i < n; i++) {
    const x0 = x + (w * i) / n;
    const x1 = x + (w * (i + 1)) / n;
    const up = r * (0.8 + rand() * 0.6);
    ctx.bezierCurveTo(x0, y - up * 1.3, x1, y - up * 1.3, x1, y);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = lw;
  ctx.stroke();
}

/**
 * Beyond the Keep, the far and near layers give way to banks of cloud: a far bank of pale lapis
 * cloud and a nearer one of white, both wrapping every 960 px like the crags and trees.
 */
function skyLayers(scene: Phaser.Scene) {
  paint(scene, 'far-sky', W, FAR_H, (ctx) => {
    half(ctx);
    const base = FAR_H * U;
    for (const dx of [-W * U, 0, W * U]) {
      cloudBank(ctx, -60 + dx, base, 700, 70, '#b8c6ea', 3);
      cloudBank(ctx, 560 + dx, base, 760, 90, '#c9d2ee', 5);
      cloudBank(ctx, 1260 + dx, base, 700, 60, '#b8c6ea', 8);
    }
  });
  paint(scene, 'near-sky', W, NEAR_H, (ctx) => {
    half(ctx);
    const base = NEAR_H * U;
    for (const dx of [-W * U, 0, W * U]) {
      cloudBank(ctx, 40 + dx, base, 520, 46, '#f4f6ff', 11);
      cloudBank(ctx, 900 + dx, base, 380, 40, '#ffffff', 13);
      cloudBank(ctx, 1460 + dx, base, 300, 36, '#f4f6ff', 17);
      hl(ctx, [[120 + dx, base - 60], [220 + dx, base - 74]], 3);
    }
  });
}

/** How far a cloud's art reaches below its top, in screen pixels. */
export const CLOUD_DEPTH = 26;
/** How far down a cloud's texture its walking top is. */
export const CLOUD_TOP = 14;

/**
 * The clouds that float over the Sky Road's gaps, one for each width a gap's cloud can be (the gap
 * less a margin each side): a white scalloped top with a flat lapis-shadowed base.
 */
function clouds(scene: Phaser.Scene) {
  for (const gap of SKY_GAPS) {
    const width = gap - 120;
    paint(scene, `cloud-${width}`, width, CLOUD_DEPTH + 14, (ctx) => {
      half(ctx);
      const w = width * U;
      const top = 14 * U;
      const bottom = (CLOUD_DEPTH + 14) * U - 4;
      // The base of the cloud, under its walking top.
      const rand = seeded(width);
      ctx.beginPath();
      ctx.moveTo(4, top);
      ctx.lineTo(w - 4, top);
      for (let x = w - 4; x > 4; x -= 40) ctx.quadraticCurveTo(x - 20, bottom + 4 - rand() * 14, x - 40 < 4 ? 4 : x - 40, bottom - 10);
      ctx.closePath();
      ctx.fillStyle = '#dfe6fb';
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      ctx.stroke();
      // Puffs along the top, which the knight runs on.
      cloudBank(ctx, 0, top + 8, w, 18, '#ffffff', width + 1, 3);
      hl(ctx, [[20, top - 8], [w * 0.35, top - 12]], 2.5);
    });
  }
}

/** Height of the near layer, in screen pixels; its bottom is the road. */
const NEAR_H = 140;

/** Lollipop trees and a ruined tower of pink stone, nearer the road. */
function near(scene: Phaser.Scene) {
  paint(scene, 'near', W, NEAR_H, (ctx) => {
    half(ctx);
    const base = NEAR_H * U;
    const tree = (x: number, h: number, col: string) => {
      poly(ctx, [[x - 5, base], [x - 4, base - h * 0.55], [x + 4, base - h * 0.55], [x + 5, base]], C.woodDark, 2.5);
      const r = h * 0.28;
      const cy = base - h + r;
      circle(ctx, x, cy, r, col, 3);
      ctx.fillStyle = shade(col, 1.35);
      for (let k = 0; k < 9; k++) {
        const a = -Math.PI * 0.9 + k * 0.22;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * r * 0.65, cy + Math.sin(a) * r * 0.65, 4, 7, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = shade(col, 0.7);
      for (let k = 0; k < 6; k++) {
        const a = Math.PI * 0.1 + k * 0.25;
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6, 4, 6, a, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const tower = (x: number, top: number) => {
      poly(ctx, [[x - 16, base], [x - 16, top], [x - 6, top], [x - 6, top - 14], [x + 2, top - 14], [x + 2, top - 4], [x + 8, top - 4], [x + 8, top - 16], [x + 16, top - 16], [x + 16, base]], '#d9a99a', 3);
      poly(ctx, [[x - 5, top + 80], [x - 5, top + 64], [x, top + 58], [x + 5, top + 64], [x + 5, top + 80]], C.ink, 1);
      ctx.strokeStyle = 'rgba(43,27,18,0.4)';
      ctx.lineWidth = 1.5;
      for (let y = top + 20; y < base; y += 22) {
        ctx.beginPath();
        ctx.moveTo(x - 16, y);
        ctx.lineTo(x + 16, y);
        ctx.stroke();
      }
      hl(ctx, [[x - 13, top + 4], [x - 13, base - 10]], 2);
    };
    const rand = seeded(44);
    const trees = [8, 212, 456, 676, 900, 1072, 1272, 1460, 1680, 1880].map((x) => ({
      x: x + (rand() - 0.5) * 12,
      h: 130 + rand() * 35,
      col: [C.leaf, '#2f6a4a', '#4f8a3a'][Math.floor(rand() * 3)],
    }));
    for (const dx of [-W * U, 0, W * U]) {
      tower(248 + dx, base - 260);
      for (const t of trees) tree(t.x + dx, t.h, t.col);
    }
  });
}

/** The turf road strewn with flowers: one 63 px strip that tiles, from 9 px above the road's top. */
export const GROUND_TOP = 9;

/**
 * How each stage's ground is painted: the old road's turf and flowers, the frozen pass's frosted
 * blades on pale ice with white crystals, the fen's dark reeds on mud with lapis puddles, and the
 * windy pass's turf with its grass blown flat.
 */
const GROUNDS = {
  ground: { blade: C.leaf, turf: C.turf, lean: 0, flowers: ['#ffffff', C.verm, C.goldLight, '#8fb4ff'], puddles: false, ice: false },
  'ground-ice': { blade: '#e9eefb', turf: '#b9c9e8', lean: 0, flowers: ['#ffffff'], puddles: false, ice: true },
  'ground-marsh': { blade: '#3e5a2c', turf: '#7a7442', lean: 0, flowers: [C.goldLight], puddles: true, ice: false },
  'ground-wind': { blade: C.leaf, turf: C.turf, lean: -7, flowers: ['#ffffff', C.goldLight], puddles: false, ice: false },
  'ground-sky': { blade: '#ffffff', turf: '#e4eafc', lean: 0, flowers: ['#ffffff'], puddles: false, ice: false, cloud: true },
} as Record<string, { blade: string; turf: string; lean: number; flowers: string[]; puddles: boolean; ice: boolean; cloud?: boolean }>;

function ground(scene: Phaser.Scene) {
  const w = 63;
  const h = GROUND_TOP + 13;
  for (const [key, look] of Object.entries(GROUNDS)) {
    paint(scene, key, w, h, (ctx) => {
      half(ctx);
      const top = GROUND_TOP * U;
      // Grass blades (or reeds, or frosted blades, or the Sky Road's puffs) over the top edge, then
      // the band, inked only along its top and bottom.
      ctx.fillStyle = look.blade;
      if (look.cloud) {
        // A flat-topped band of cloud (a gap's art covers it whole), scalloped along its top edge
        // and puffed inside, with a lapis shadow along its bottom.
        ctx.fillStyle = look.turf;
        ctx.fillRect(0, top - 4, w * U, 30);
        ctx.fillStyle = '#c9d2ee';
        ctx.fillRect(0, top + 17, w * U, 8);
        for (let x = 0; x < w * U; x += 42) {
          ctx.beginPath();
          ctx.arc(x + 21, top - 4, 21, 0, Math.PI);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = 'rgba(43,27,18,0.45)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 3;
        for (const y of [top - 4, top + 25]) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(w * U, y);
          ctx.stroke();
        }
        hl(ctx, [[0, top], [w * U, top]], 2);
        return;
      }
      for (let x = 0; x < w * U; x += 9) {
        const tall = look.puddles && x % 27 === 0 ? 8 : 0;
        ctx.beginPath();
        ctx.moveTo(x, top - 2);
        ctx.lineTo(x + 3 + look.lean, top - 12 - tall - ((x * 7) % 6));
        ctx.lineTo(x + 5, top - 2);
        ctx.fill();
        if (look.ice || tall) {
          ctx.strokeStyle = C.ink;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
        if (tall) {
          // A bulrush head on the tallest reeds.
          ctx.fillStyle = C.woodDark;
          ctx.fillRect(x + 1.5, top - 22 - ((x * 7) % 6), 3, 7);
          ctx.fillStyle = look.blade;
        }
      }
      ctx.fillStyle = look.turf;
      ctx.fillRect(0, top - 4, w * U, 30);
      if (look.ice) hl(ctx, [[0, top + 1], [w * U, top + 1]], 2);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      for (const y of [top - 4, top + 25]) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w * U, y);
        ctx.stroke();
      }
      const rand = seeded(31);
      if (look.puddles) oval(ctx, 70, top + 15, 22, 5, C.lapis, 1.5);
      for (let i = 0; i < 5; i++) {
        const x = 10 + rand() * (w * U - 20);
        const y = top + 6 + rand() * 14;
        if (look.ice) {
          // A frost crystal: three crossed white strokes.
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1.5;
          for (let k = 0; k < 3; k++) {
            const a = (k * Math.PI) / 3;
            ctx.beginPath();
            ctx.moveTo(x - Math.cos(a) * 4, y - Math.sin(a) * 4);
            ctx.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4);
            ctx.stroke();
          }
          continue;
        }
        ctx.fillStyle = look.flowers[i % look.flowers.length];
        for (let k = 0; k < 5; k++) {
          const a = k * Math.PI * 0.4;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * 3, y + Math.sin(a) * 3, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        circle(ctx, x, y, 1.5, C.goldLight, 0);
      }
    });
  }
}

/** Silver points on a plank, for each width a spike trap can be: tips reach 24 px above the road. */
function spikes(scene: Phaser.Scene) {
  for (const width of [36, 48, 60]) {
    paint(scene, `spikes-${width}`, width, 26, (ctx) => {
      half(ctx);
      const ground = 26 * U - 4;
      const w = width * U;
      poly(ctx, [[2, ground], [2, ground - 12], [w - 2, ground - 12], [w - 2, ground]], C.wood, 2.5);
      const n = width / 12;
      const each = (w - 8) / n;
      for (let i = 0; i < n; i++) {
        const x = 4 + i * each;
        poly(ctx, [[x + 1, ground - 12], [x + each / 2, ground - 48], [x + each - 1, ground - 12]], C.silver, 2.5);
        hl(ctx, [[x + 5, ground - 15], [x + each / 2 - 1, ground - 42]], 2);
      }
    });
  }
}

/** Depth of a pit's art below the road, cut through the turf into the page. */
export const PIT_DEPTH = 64;

/** A gap in the Sky Road's clouds, for each width one can be: the lapis sky far below, with wisps, between ragged cloud lips. */
function skyGaps(scene: Phaser.Scene) {
  for (const width of SKY_GAPS) {
    paint(scene, `pit-${width}`, width, PIT_DEPTH, (ctx) => {
      half(ctx);
      const w = width * U;
      const h = PIT_DEPTH * U;
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#6f86c8');
      g.addColorStop(1, C.lapisDeep);
      poly(ctx, [[10, 0], [w - 10, 0], [w - 30, h - 4], [30, h - 4]], g, 3);
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2.5;
      for (const [x, y, len] of [[60, 50, 90], [w * 0.5, 80, 120], [w - 160, 40, 70], [120, 104, 60]] as const) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y);
        ctx.stroke();
      }
      star6(ctx, w * 0.3, 70, 7);
      star6(ctx, w * 0.72, 100, 6);
      // The cloud lips either side of the gap.
      cloudBank(ctx, -6, 34, 46, 14, '#ffffff', width + 3, 2.5);
      cloudBank(ctx, w - 40, 34, 46, 14, '#ffffff', width + 4, 2.5);
    });
  }
}

/** A pit: a hole cut through the turf, with stakes at its bottom, for each width a pit can be. */
function pits(scene: Phaser.Scene) {
  for (const width of [80, 96, 112]) {
    paint(scene, `pit-${width}`, width, PIT_DEPTH, (ctx) => {
      half(ctx);
      const w = width * U;
      const h = PIT_DEPTH * U;
      const rand = seeded(width);
      // The hole, its walls ragged and inked.
      const left: Pt[] = [];
      const right: Pt[] = [];
      for (let y = 0; y <= h - 8; y += 18) {
        left.push([4 + rand() * 8 + y * 0.06, y]);
        right.push([w - 4 - rand() * 8 - y * 0.06, y]);
      }
      const hole: Pt[] = [...left, [w / 2, h - 2], ...right.reverse()];
      poly(ctx, hole, '#24170f', 3);
      // Earth banding on the walls, and stakes along the bottom.
      ctx.strokeStyle = 'rgba(154,106,62,0.6)';
      ctx.lineWidth = 2;
      for (let y = 30; y < h - 20; y += 26) {
        ctx.beginPath();
        ctx.moveTo(16, y);
        ctx.lineTo(w - 16, y + 4);
        ctx.stroke();
      }
      for (let x = 22; x + 14 <= w - 18; x += 28) {
        poly(ctx, [[x, h - 14], [x + 7, h - 46], [x + 14, h - 14]], C.silver, 2);
        hl(ctx, [[x + 4, h - 18], [x + 7, h - 40]], 1.5);
      }
      // The turf lips either side of the hole.
      poly(ctx, [[0, 0], [16, 0], [10, 30], [0, 30]], C.turf, 2.5);
      poly(ctx, [[w, 0], [w - 16, 0], [w - 10, 30], [w, 30]], C.turf, 2.5);
    });
  }
}

/**
 * A spiked log hanging on a chain from above the screen, down to 34 pixels over the road: too low to
 * run under, so the knight slides. Its art is 46 pixels wide (the log is 27, with spikes either side)
 * and reaches the road's height minus 34.
 */
function blade(scene: Phaser.Scene) {
  const bottom = GROUND_Y - 34;
  paint(scene, 'blade', 46, bottom, (ctx) => {
    half(ctx);
    ctx.translate(46, 0);
    const top = 622 + lift();
    const log = 760 + lift();
    const tip = bottom * U;
    const w = 54;
    for (let y = 0; y < top - 4; y += 15) {
      ctx.beginPath();
      ctx.ellipse(0, y + 7, (y / 15) % 2 < 1 ? 5 : 2, 8, 0, 0, Math.PI * 2);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 4;
      ctx.stroke();
      ctx.strokeStyle = C.silver;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    poly(ctx, [[-20, top - 4], [20, top - 4], [14, top + 8], [-14, top + 8]], C.iron, 2.5);
    const lx0 = -w / 2;
    const lx1 = w / 2;
    for (const y of [top + 50, top + 96]) {
      poly(ctx, [[lx0, y - 6], [lx0 - 18, y], [lx0, y + 6]], C.silver, 2);
      poly(ctx, [[lx1, y - 6], [lx1 + 18, y], [lx1, y + 6]], C.silver, 2);
    }
    for (let i = 0; i < 3; i++) {
      const sw = (w - 8) / 3;
      const x = lx0 + 4 + i * sw;
      poly(ctx, [[x, log - 2], [x + sw / 2, tip - 1], [x + sw, log - 2]], C.silver, 2.5);
    }
    poly(ctx, [[lx0, top + 6], [lx1, top + 6], [lx1, log], [lx0, log]], C.wood, 3);
    ctx.strokeStyle = 'rgba(43,27,18,0.5)';
    ctx.lineWidth = 1.5;
    for (const dx of [-14, -2, 12]) {
      ctx.beginPath();
      ctx.moveTo(dx, top + 10);
      ctx.bezierCurveTo(dx + 4, top + 50, dx - 4, top + 90, dx, log - 4);
      ctx.stroke();
    }
    for (const y of [top + 24, log - 30]) poly(ctx, [[lx0 - 3, y], [lx1 + 3, y], [lx1 + 3, y + 10], [lx0 - 3, y + 10]], C.iron, 2);
    hl(ctx, [[lx0 + 5, top + 12], [lx0 + 5, log - 6]], 2);
  });
}

/**
 * The stone of a raised ledge: a castle wall of pink ashlar with a turf cap, tall enough for the
 * highest ledge plus the road below it. It tiles sideways; GameScene crops it to each ledge's height.
 */
function ledge(scene: Phaser.Scene) {
  const w = 72;
  const h = 128;
  paint(scene, 'ledge', w, h, (ctx) => {
    half(ctx);
    const rand = seeded(70);
    for (let y = 12, row = 0; y < h * U; y += 30, row++) {
      for (let x = row % 2 ? -72 : 0; x < w * U; x += 72) {
        const c = ['#e2aa98', '#d79a88', '#ebbcaa'][Math.floor(rand() * 3)];
        poly(ctx, [[x, y], [x + 72, y], [x + 72, y + 30], [x, y + 30]], c, 1.6);
        hl(ctx, [[x + 4, y + 26], [x + 4, y + 4], [x + 64, y + 4]], 1.6);
      }
    }
    ctx.fillStyle = C.turf;
    ctx.fillRect(0, 0, w * U, 12);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 12);
    ctx.lineTo(w * U, 12);
    ctx.moveTo(0, 1.5);
    ctx.lineTo(w * U, 1.5);
    ctx.stroke();
  });
}

/**
 * A fire vent: a grate in the road that flares into vermilion and gold flames. Baked as `flames-off`
 * (embers on the grate), `flames-warn` (small tongues sputtering just before it flares) and two
 * flickering `flames-lit<n>` frames, all 32x72 with the grate at the bottom. The column is as tall as
 * `TRAP_SPAN.flames.hi`.
 */
function flames(scene: Phaser.Scene) {
  const w = 32;
  const h = 72;
  /** Page units, with (0, 0) the middle of the vent at road level. */
  const frame = (key: string, draw: (ctx: Ctx) => void) =>
    paint(scene, key, w, h, (ctx) => {
      half(ctx);
      ctx.translate(w, (h - 2) * U);
      draw(ctx);
    });
  const tongue = (ctx: Ctx, tw: number, th: number, fill: string | CanvasGradient, dx: number, curl: number) => {
    ctx.beginPath();
    ctx.moveTo(-tw + dx, -14);
    ctx.bezierCurveTo(-tw * 1.2 + dx, -th * 0.5, curl + dx, -th * 0.7, dx + curl * 0.6, -th);
    ctx.bezierCurveTo(tw * 0.9 + dx, -th * 0.6, tw * 1.3 + dx, -th * 0.3, tw + dx, -14);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  };
  const grate = (ctx: Ctx) => {
    poly(ctx, [[-30, 0], [-30, -16], [30, -16], [30, 0]], C.iron, 2.5);
    for (let x = -24; x < 24; x += 12) poly(ctx, [[x, -12], [x + 5, -12], [x + 5, -4], [x, -4]], C.ink, 1);
  };
  frame('flames-off', (ctx) => {
    grate(ctx);
    for (const [x, c] of [[-14, C.verm], [2, '#f08a2a'], [14, C.verm]] as const) oval(ctx, x, -18, 4, 3, c, 1.5);
  });
  frame('flames-warn', (ctx) => {
    tongue(ctx, 9, 40, C.verm, -10, 4);
    tongue(ctx, 10, 50, '#f08a2a', 10, -4);
    grate(ctx);
  });
  for (const f of [0, 1]) {
    frame(`flames-lit${f}`, (ctx) => {
      const curl = f ? 14 : -18;
      const tall = f ? 128 : 136;
      tongue(ctx, 28, tall, C.verm, 0, curl);
      tongue(ctx, 19, tall * 0.78, '#f08a2a', f ? -3 : 3, -curl * 0.6);
      tongue(ctx, 10, tall * 0.48, gold(ctx, -10, -80, 10, -20), 2, curl * 0.4);
      grate(ctx);
    });
  }
}

/** A coin: a gold-leaf bezant, and one turned edge-on for its spin. */
function coin(scene: Phaser.Scene) {
  paint(scene, 'coin-0', 18, 18, (ctx) => bezant(ctx, 9, 9, 7.5, 1, 1.3));
  paint(scene, 'coin-1', 18, 18, (ctx) => bezant(ctx, 9, 9, 7.5, 0.4, 1.3));
}

/** The checkpoint: a lapis banner with a gold cross on a pole, by a campfire. 48x84, the pole at x 8. */
function checkpoint(scene: Phaser.Scene) {
  paint(scene, 'checkpoint', 48, 84, (ctx) => {
    half(ctx);
    const g = 82 * U;
    poly(ctx, [[13, g], [13, 14], [19, 14], [19, g]], C.woodDark, 2.5);
    circle(ctx, 16, 12, 7, gold(ctx, 9, 5, 23, 19), 2);
    // The swallow-tailed banner.
    poly(ctx, [[19, 22], [66, 26], [56, 46], [66, 66], [19, 70]], C.lapis, 2.5);
    hl(ctx, [[23, 26], [23, 64]], 2);
    poly(ctx, [[33, 32], [39, 32], [39, 42], [48, 42], [48, 48], [39, 48], [39, 62], [33, 62], [33, 48], [24, 48], [24, 42], [33, 42]], gold(ctx, 24, 32, 48, 62), 1.5);
    // The campfire: crossed logs and flames.
    poly(ctx, [[40, g], [86, g - 12], [90, g - 6], [44, g + 4]], C.wood, 2);
    poly(ctx, [[44, g - 12], [90, g], [86, g + 4], [40, g - 6]], C.woodDark, 2);
    ctx.beginPath();
    ctx.moveTo(48, g - 8);
    ctx.bezierCurveTo(44, g - 40, 66, g - 44, 64, g - 70);
    ctx.bezierCurveTo(80, g - 48, 90, g - 36, 84, g - 8);
    ctx.closePath();
    ctx.fillStyle = C.verm;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(56, g - 8);
    ctx.bezierCurveTo(56, g - 28, 70, g - 30, 68, g - 46);
    ctx.bezierCurveTo(80, g - 30, 80, g - 20, 76, g - 8);
    ctx.closePath();
    ctx.fillStyle = gold(ctx, 56, g - 46, 80, g - 8);
    ctx.fill();
    ctx.stroke();
  });
}

/**
 * A wayside shrine: a little gothic chapel on a plinth, with a green heart in its lapis niche between
 * two candles. 56x80, standing on the road by its bottom middle. `shrine-used` has given its heart:
 * the niche is bare and the candles are out.
 */
function shrine(scene: Phaser.Scene) {
  for (const used of [false, true]) {
    paint(scene, used ? 'shrine-used' : 'shrine', 56, 80, (ctx) => {
      half(ctx);
      ctx.translate(56, 78 * U);
      poly(ctx, [[-46, 0], [-46, -20], [46, -20], [46, 0]], '#cfc4ae', 2.5);
      poly(ctx, [[-36, -20], [-36, -100], [36, -100], [36, -20]], '#ebbcaa', 2.5);
      hl(ctx, [[-32, -24], [-32, -96]], 2);
      poly(ctx, [[-24, -26], [-24, -72], [0, -92], [24, -72], [24, -26]], used ? '#5a6a9c' : C.lapis, 2.5);
      poly(ctx, [[-52, -96], [0, -138], [52, -96]], C.verm, 3);
      ctx.strokeStyle = 'rgba(43,27,18,0.5)';
      ctx.lineWidth = 1.5;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo(-52 + k * 11, -96 - k * 7);
        ctx.lineTo(52 - k * 11, -96 - k * 7);
        ctx.stroke();
      }
      star6(ctx, 0, -147, 9);
      heartPath(ctx, 0, -54, 30);
      ctx.fillStyle = used ? C.vellumDark : C.heal;
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      if (!used) hl(ctx, [[-9, -62], [-4, -66]], 2);
      for (const dx of [-15, 15]) {
        poly(ctx, [[dx - 3, -26], [dx - 3, -38], [dx + 3, -38], [dx + 3, -26]], '#fff8e6', 1.5);
        if (!used) oval(ctx, dx, -44, 3, 5, '#f4b03a', 0);
      }
    });
  }
}

/** The shrine's banderole: a scroll label with curled ends, 180x48, for two lines of text. */
function banderole(scene: Phaser.Scene) {
  paint(scene, 'banderole', 180, 48, (ctx) => {
    half(ctx);
    ctx.translate(180, 46);
    const x0 = -150;
    const x1 = 150;
    const h = 70;
    const y = 0;
    poly(ctx, [[x0 - 24, y - h / 2 + 10], [x0, y - h / 2], [x0, y + h / 2], [x0 - 24, y + h / 2 + 10], [x0 - 14, y + 5]], C.vellumDark, 2.5);
    poly(ctx, [[x1 + 24, y - h / 2 + 10], [x1, y - h / 2], [x1, y + h / 2], [x1 + 24, y + h / 2 + 10], [x1 + 14, y + 5]], C.vellumDark, 2.5);
    ctx.beginPath();
    ctx.moveTo(x0, y - h / 2);
    ctx.bezierCurveTo(-60, y - h / 2 - 10, 60, y - h / 2 + 8, x1, y - h / 2);
    ctx.lineTo(x1, y + h / 2);
    ctx.bezierCurveTo(60, y + h / 2 + 8, -60, y + h / 2 - 10, x0, y + h / 2);
    ctx.closePath();
    ctx.fillStyle = C.vellumLight;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
  });
}

/**
 * The miniature's frame, drawn over the world: vellum down the sides, and a gold rule inside an ink
 * one round the painted scene.
 */
function frame(scene: Phaser.Scene) {
  const W = VIEW.w;
  paint(scene, 'frame', W, VIEW.h, (ctx) => {
    ctx.fillStyle = C.vellum;
    ctx.fillRect(0, FRAME.y - 4, FRAME.x, FRAME.bottom - FRAME.y + 8);
    ctx.fillRect(FRAME.x + FRAME.w, FRAME.y - 4, W - FRAME.x - FRAME.w, FRAME.bottom - FRAME.y + 8);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(5, FRAME.y - 2, W - 10, FRAME.bottom - FRAME.y + 4);
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(FRAME.x, FRAME.y, FRAME.w, FRAME.bottom - FRAME.y);
  });
}

export function bakeScenery(scene: Phaser.Scene) {
  page(scene);
  sky(scene);
  far(scene);
  near(scene);
  ground(scene);
  spikes(scene);
  pits(scene);
  skyGaps(scene);
  skyLayers(scene);
  clouds(scene);
  blade(scene);
  flames(scene);
  ledge(scene);
  coin(scene);
  checkpoint(scene);
  shrine(scene);
  banderole(scene);
  frame(scene);
}

export { FAR_H, NEAR_H };
