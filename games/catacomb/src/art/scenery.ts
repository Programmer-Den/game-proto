import Phaser from 'phaser';
import { viewFrame, viewSize } from '../../../../shared/scaling';
import { ART, BACKDROP_RES, addTexture, blank, paint, sketch } from './paint';
import { seeded } from './pixelArt';

// The two backdrops in the painterly style, drawn plainly at twice the screen's size, shrunk to
// it and repainted with brush strokes: a crypt for the fights (a stone wall with two torches
// and an arch over a flagstone floor in perspective), and the dark flagstones the map is laid
// out on. Each is painted over the whole view: the designed 960x540 picture in the view's frame
// (`viewFrame`), with more wall, floor or flagstones around it when the view is wider or taller.

const W = 1920;
const H = 1080;
const WALL_TOP = 0;
/** Where the floor meets the wall, at twice the screen's size. */
const FLOOR_Y = 545;
const TORCHES = [
  [355, 205],
  [1570, 205],
];

/** The part of the picture to paint, at twice the screen's size: the designed picture is 0,0 to W,H. */
interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function bakeScenery(scene: Phaser.Scene) {
  const res = Math.min(ART, BACKDROP_RES);
  const view = viewSize(scene);
  const frame = viewFrame(scene);
  const b = { x0: -2 * frame.x, y0: -2 * frame.y, x1: 2 * (view.width - frame.x), y1: 2 * (view.height - frame.y) };
  const crypt = painted(drawCrypt, 11, res, b);
  const flagstones = painted(drawFlagstones, 5, res, b);
  addTexture(scene, 'room-bg', crypt, res);
  addTexture(scene, 'map-bg', flagstones, res);
  // The second act, the Sunken Tombs, is the same stone washed in a cold, drowned green.
  addTexture(scene, 'room-bg-2', washed(crypt, '#6fa496'), res);
  addTexture(scene, 'map-bg-2', washed(flagstones, '#6fa496'), res);
  // The third act, the Bone Spire, in a pale, dusty violet.
  addTexture(scene, 'room-bg-3', washed(crypt, '#c4b4d8'), res);
  addTexture(scene, 'map-bg-3', washed(flagstones, '#c4b4d8'), res);
}

/** The backdrop for an act. */
export const backdrop = (kind: 'room' | 'map', act: number) => (act > 1 ? `${kind}-bg-${act}` : `${kind}-bg`);

/** A copy of a painted canvas with a colour multiplied over it. */
function washed(src: HTMLCanvasElement, color: string) {
  const canvas = blank(src.width, src.height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, src.width, src.height);
  return canvas;
}

type Draw = (ctx: CanvasRenderingContext2D, rnd: () => number, b: Bounds) => void;

function painted(draw: Draw, seed: number, res: number, b: Bounds) {
  const { canvas, ctx } = sketch((b.x1 - b.x0) / 2, (b.y1 - b.y0) / 2, res);
  ctx.scale(0.5, 0.5);
  ctx.translate(-b.x0, -b.y0);
  draw(ctx, seeded(seed), b);
  return paint(canvas, { sizes: [10, 5, 2.5, 1.3], seed, grain: 0.13, vignette: 0.5, res });
}

/** A hex colour with its brightness jittered by up to `amt` either way. */
const jitter = (rnd: () => number, hex: string, amt: number) => {
  const n = parseInt(hex.slice(1), 16);
  const f = 1 + (rnd() - 0.5) * amt;
  const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
};

function tools(ctx: CanvasRenderingContext2D) {
  return {
    poly(pts: number[][], fill: string) {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    },
    ell(x: number, y: number, rx: number, ry: number, fill: string) {
      ctx.beginPath();
      ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = fill;
      ctx.fill();
    },
    rrect(x: number, y: number, w: number, h: number, r: number, fill: string) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      ctx.fillStyle = fill;
      ctx.fill();
    },
    /** A soft round light; `color` holds `A` where its alpha goes. */
    glow(x: number, y: number, r: number, color: string, alpha: number) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color.replace('A', String(alpha)));
      g.addColorStop(1, color.replace('A', '0'));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.restore();
    },
  };
}

const drawCrypt: Draw = (ctx, rnd, b) => {
  const { poly, ell, rrect, glow } = tools(ctx);
  const jit = (hex: string, amt: number) => jitter(rnd, hex, amt);
  const wg = ctx.createLinearGradient(0, WALL_TOP, 0, FLOOR_Y);
  wg.addColorStop(0, '#231d2b');
  wg.addColorStop(1, '#2c2533');
  ctx.fillStyle = wg;
  ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, FLOOR_Y - b.y0);
  // Stone blocks, a little irregular, with lit tops and shadowed bottoms, a crack or moss now and then.
  const above = Math.max(0, Math.ceil((WALL_TOP - 30 - b.y0) / 92));
  for (let row = -above, y = WALL_TOP - 30 - 92 * above; y < FLOOR_Y; row++, y += 92) {
    for (let x = b.x0 + (row % 2 ? -90 : -10); x < b.x1; ) {
      const w = 150 + rnd() * 90;
      const h = Math.min(86, FLOOR_Y - y - 4);
      const j = () => (rnd() - 0.5) * 8;
      poly([[x + 4 + j(), y + 4 + j()], [x + w - 4 + j(), y + 4 + j()], [x + w - 4 + j(), y + h + j()], [x + 4 + j(), y + h + j()]], jit('#4a4357', 0.22));
      ctx.fillStyle = 'rgba(255,240,220,0.08)';
      ctx.fillRect(x + 8, y + 6, w - 16, 10);
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x + 8, y + h - 12, w - 16, 10);
      if (rnd() < 0.18) {
        ctx.strokeStyle = 'rgba(20,16,24,0.7)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        let cx = x + 20 + rnd() * (w - 40);
        let cy = y + 10;
        ctx.moveTo(cx, cy);
        for (let i = 0; i < 4; i++) {
          cx += (rnd() - 0.5) * 30;
          cy += h / 5;
          ctx.lineTo(cx, cy);
        }
        ctx.stroke();
      }
      if (rnd() < 0.12) ell(x + rnd() * w, y + h - 8, 30 + rnd() * 30, 9, 'rgba(70,110,60,0.55)');
      x += w;
    }
  }

  // The arch: a dark passage going down, with a cool light far inside.
  const AX = 960;
  const IN = 108;
  const OUT = 140;
  const SPRING = 205;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(AX - IN, FLOOR_Y);
  ctx.lineTo(AX - IN, SPRING);
  ctx.arc(AX, SPRING, IN, Math.PI, 0);
  ctx.lineTo(AX + IN, FLOOR_Y);
  ctx.closePath();
  const pg = ctx.createLinearGradient(0, SPRING - IN, 0, FLOOR_Y);
  pg.addColorStop(0, '#0b0910');
  pg.addColorStop(0.7, '#141019');
  pg.addColorStop(1, '#1f1a28');
  ctx.fillStyle = pg;
  ctx.fill();
  ctx.clip();
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = `rgba(110,120,170,${0.16 - i * 0.022})`;
    ctx.fillRect(AX - IN + i * 10, FLOOR_Y - 18 - i * 34, (IN - i * 10) * 2, 6);
  }
  glow(AX, SPRING + 120, 200, 'rgba(110,130,210,A)', 0.18);
  ctx.restore();
  const N = 11;
  const at = (a: number, r: number) => [AX + Math.cos(a) * r, SPRING + Math.sin(a) * r];
  for (let i = 0; i < N; i++) {
    const a0 = Math.PI + (i / N) * Math.PI + 0.01;
    const a1 = Math.PI + ((i + 1) / N) * Math.PI - 0.01;
    poly([at(a0, IN), at(a0, OUT), at(a1, OUT), at(a1, IN)], jit('#6a6177', 0.15));
  }
  for (const x0 of [AX - OUT, AX + IN]) {
    for (let y = SPRING; y < FLOOR_Y; y += 64) poly([[x0 + 2, y + 2], [x0 + OUT - IN - 2, y + 2], [x0 + OUT - IN - 2, y + 60], [x0 + 2, y + 60]], jit('#635a70', 0.15));
  }

  // Torches in iron brackets, their warm light on the stones.
  for (const [tx, ty] of TORCHES) {
    glow(tx, ty - 10, 520, 'rgba(255,140,50,A)', 0.42);
    glow(tx, ty - 10, 220, 'rgba(255,200,120,A)', 0.35);
    rrect(tx - 30, ty + 92, 60, 14, 4, '#2a2224');
    poly([[tx - 10, ty + 4], [tx + 10, ty + 4], [tx + 7, ty + 100], [tx - 7, ty + 100]], '#6b4423');
    rrect(tx - 18, ty - 6, 36, 18, 6, '#3a2f30');
    const flame = (s: number, fill: string) => {
      ctx.beginPath();
      ctx.moveTo(tx, ty - 70 * s);
      ctx.bezierCurveTo(tx + 26 * s, ty - 34 * s, tx + 30 * s, ty - 4, tx, ty);
      ctx.bezierCurveTo(tx - 30 * s, ty - 4, tx - 26 * s, ty - 34 * s, tx, ty - 70 * s);
      ctx.fillStyle = fill;
      ctx.fill();
    };
    flame(1.15, '#e9682a');
    flame(0.9, '#ffa63d');
    flame(0.6, '#ffe39a');
    flame(0.3, '#fffbe8');
  }

  // The floor: flagstones in perspective towards a point behind the arch.
  const fg = ctx.createLinearGradient(0, FLOOR_Y, 0, H);
  fg.addColorStop(0, '#2c2632');
  fg.addColorStop(1, '#1b1720');
  ctx.fillStyle = fg;
  ctx.fillRect(b.x0, FLOOR_Y, b.x1 - b.x0, b.y1 - FLOOR_Y);
  const VX = 960;
  const VY = 330;
  const rows: number[] = [];
  for (let k = 0, y = FLOOR_Y; y < b.y1 + 80; k++) {
    rows.push(y);
    y += 26 + k * 16;
  }
  const toward = (xb: number, y: number) => VX + (xb - VX) * ((y - VY) / (H - VY));
  const wider = Math.ceil(Math.max(-b.x0, b.x1 - W) / 230);
  for (let i = 0; i + 1 < rows.length; i++) {
    const [y0, y1] = [rows[i], rows[i + 1]];
    for (let c = -9 - wider; c <= 9 + wider; c++) {
      const xb0 = VX + (c - 0.5) * 230 + (i % 2) * 115;
      const xb1 = xb0 + 230;
      poly([[toward(xb0, y0) + 3, y0 + 3], [toward(xb1, y0) - 3, y0 + 3], [toward(xb1, y1) - 3, y1 - 3], [toward(xb0, y1) + 3, y1 - 3]], jit('#3b3442', 0.25));
    }
  }
  ctx.fillStyle = '#17131b';
  ctx.fillRect(b.x0, FLOOR_Y - 6, b.x1 - b.x0, 12);
  glow(460, 650, 360, 'rgba(255,160,80,A)', 0.3);
  glow(1450, 650, 360, 'rgba(255,160,80,A)', 0.26);
  glow(960, 600, 260, 'rgba(120,140,220,A)', 0.08);
};

const drawFlagstones: Draw = (ctx, rnd, b) => {
  const { poly, ell, glow } = tools(ctx);
  ctx.fillStyle = '#16121a';
  ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  // Big rough flagstones in staggered rows, each a slightly different shade.
  const above = Math.max(0, Math.ceil((-20 - b.y0) / 110));
  for (let row = -above, y = -20 - 110 * above; y < b.y1; row++, y += 110) {
    for (let x = b.x0 + (row % 2 ? -100 : -20); x < b.x1; ) {
      const w = 160 + rnd() * 80;
      const j = () => (rnd() - 0.5) * 10;
      poly([[x + 5 + j(), y + 5 + j()], [x + w - 5 + j(), y + 5 + j()], [x + w - 5 + j(), y + 104 + j()], [x + 5 + j(), y + 104 + j()]], jitter(rnd, '#272029', 0.25));
      ctx.fillStyle = 'rgba(255,240,220,0.05)';
      ctx.fillRect(x + 10, y + 8, w - 20, 10);
      if (rnd() < 0.1) ell(x + rnd() * w, y + 90, 30 + rnd() * 30, 9, 'rgba(70,110,60,0.4)');
      x += w;
    }
  }
  // Lantern light in the middle, falling off into the dark at the edges.
  glow(W / 2, H / 2, 900, 'rgba(255,170,90,A)', 0.14);
};
