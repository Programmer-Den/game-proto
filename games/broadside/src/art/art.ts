import Phaser from 'phaser';
import { sharpRes } from '../../../../shared/scaling';
import { ORDER_IDS, type OrderId } from '../game/orders';
import { HULLS, type HullId } from '../game/hulls';
import type { EnemyKind } from '../game/ships';
import { FORT, ISLANDS, WORLD } from '../game/state';
import { t } from '../i18n';
import { FIRE, HARBOR, HELM, HUD_HEIGHT, OVER, VIEW, WIND } from '../scenes/layout';

// The art of an old hand-tinted sea chart: ink on parchment, a compass rose and rhumb lines,
// engraved hatching for the sea and form lines round the coasts, and ships drawn as engraved
// miniatures. Everything is painted on 2D canvases at startup and added as textures, so there are
// no asset files. Each is painted finer than the game's pixels and shown scaled down, so it stays
// crisp on a big or high-density screen: small pieces at `HI`, the sea at `SEA_RES` and the frame
// and panels at `SHEET_RES`. All three are set by `bakeAll` from the screen's `renderScale`.

type Ctx = CanvasRenderingContext2D;
type Pt = [number, number];

/** How much finer than the game's pixels the small textures are painted; show them at 1 / HI. */
export let HI = 2;
/** How much finer the sea is painted; a whole number, so its copies join without a seam. */
export let SEA_RES = 1;
/** How much finer the frame and the panels are painted; show them at 1 / SHEET_RES. */
export let SHEET_RES = 1;

export const INK = '#2b2118';
const ink = (a: number) => `rgba(43,33,24,${a})`;
export const OCHRE = '#c9902e';
const PARCHMENT = '#ead9b2';
const CREAM = '#f6ecd2';
export const SERIF = "Georgia, 'Times New Roman', Times, serif";

interface ShipLook {
  /** Bow to stern and side to side, in game pixels. */
  length: number;
  beam: number;
  /** Mast positions along the hull, as a share of its length from the middle (bow positive). */
  masts: number[];
  guns: number;
  sail: string;
  flag: string;
  /**
   * Something only this ship carries: a fireship's deck stacked with burning pitch, a ketch's
   * mortar on the foredeck, the flagship's gilded rail and stern lanterns, or a merchantman's
   * cargo lashed on deck, or the Tempest's silvered rail and storm lanterns.
   */
  extra?: 'fire' | 'mortar' | 'flagship' | 'cargo' | 'storm';
}

export const SHIP_LOOKS: Record<HullId | EnemyKind, ShipLook> = {
  // The player's ships, with black sails.
  frigate: { length: 76, beam: 27, masts: [0.2, -0.14], guns: 2, sail: '#3a332c', flag: '#1e1a16' },
  cutter: { length: 60, beam: 22, masts: [0.08], guns: 1, sail: '#3a332c', flag: '#1e1a16' },
  bomb: { length: 72, beam: 30, masts: [-0.06, -0.3], guns: 2, sail: '#3a332c', flag: '#1e1a16', extra: 'mortar' },
  sloop: { length: 56, beam: 21, masts: [0.06], guns: 1, sail: '#f6ecd2', flag: 'rgba(60,100,170,0.9)' },
  brig: { length: 70, beam: 27, masts: [0.2, -0.14], guns: 2, sail: '#f6ecd2', flag: 'rgba(176,70,52,0.85)' },
  galleon: { length: 90, beam: 34, masts: [0.26, 0.02, -0.22], guns: 3, sail: '#f4e4b8', flag: 'rgba(201,144,46,0.95)' },
  fireship: { length: 54, beam: 20, masts: [0.16], guns: 0, sail: '#d9b98a', flag: 'rgba(214,110,40,0.95)', extra: 'fire' },
  ketch: { length: 60, beam: 24, masts: [-0.02, -0.28], guns: 0, sail: '#efe0bc', flag: 'rgba(80,110,60,0.9)', extra: 'mortar' },
  flagship: { length: 104, beam: 38, masts: [0.28, 0.06, -0.16, -0.34], guns: 4, sail: '#f4e4b8', flag: 'rgba(110,50,120,0.95)', extra: 'flagship' },
  admiral: { length: 114, beam: 42, masts: [0.3, 0.08, -0.14, -0.34], guns: 5, sail: '#efd9a0', flag: 'rgba(200,150,30,0.98)', extra: 'flagship' },
  tempest: { length: 118, beam: 44, masts: [0.3, 0.08, -0.14, -0.34], guns: 5, sail: '#a9b3b5', flag: 'rgba(40,96,110,0.98)', extra: 'storm' },
  merchant: { length: 74, beam: 31, masts: [0.16, -0.2], guns: 0, sail: '#efe4c8', flag: 'rgba(50,120,110,0.95)', extra: 'cargo' },
};

/** The look of a ship: the player's by the hull sailed, an enemy's or a prize's by its kind. */
export const lookOf = (ship: { kind: string }, hull: HullId) => SHIP_LOOKS[(ship.kind === 'player' ? hull : ship.kind) as HullId | EnemyKind];

/** A small seeded random, so the chart is drawn the same every time without touching Math.random. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return s / 2147483647;
  };
}

function bake(scene: Phaser.Scene, key: string, w: number, h: number, scale: number, draw: (ctx: Ctx) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * scale);
  canvas.height = Math.ceil(h * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  draw(ctx);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, canvas);
}

function poly(ctx: Ctx, pts: Pt[], fill?: string | CanvasGradient | null, stroke?: string, lw = 1) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
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

function circle(ctx: Ctx, x: number, y: number, r: number, fill?: string | null, stroke?: string, lw = 1) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
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

function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, lw: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function text(ctx: Ctx, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'center') {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

/**
 * Speckled, stained parchment over a `w` x `h` area. With `wrap`, a stain over one edge comes back
 * in at the opposite edge, so the sheet repeats seamlessly.
 */
function parchment(ctx: Ctx, w: number, h: number, seed: number, specks: number, wrap = false) {
  const rnd = rng(seed);
  ctx.fillStyle = PARCHMENT;
  ctx.fillRect(0, 0, w, h);
  const stains = Math.round((w * h) / 70_000) + 4;
  for (let i = 0; i < stains; i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const r = 40 + rnd() * 140;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const dark = rnd() < 0.5;
    g.addColorStop(0, dark ? 'rgba(170,130,70,0.10)' : 'rgba(255,245,215,0.20)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    for (const dx of wrap ? [-w, 0, w] : [0]) {
      for (const dy of wrap ? [-h, 0, h] : [0]) {
        ctx.save();
        ctx.translate(dx, dy);
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
        ctx.restore();
      }
    }
  }
  for (let i = 0; i < specks; i++) {
    ctx.fillStyle = rnd() < 0.5 ? 'rgba(120,85,40,0.10)' : 'rgba(255,250,230,0.12)';
    ctx.fillRect(rnd() * w, rnd() * h, 0.6 + rnd(), 0.6 + rnd());
  }
}

// ---------------------------------------------------------------------------------------------
// The sea: one chart the size of the whole wrapping sea, so it repeats seamlessly at its edges.

/** A wobbly coastline round an ellipse, as points. */
function coast(cx: number, cy: number, rx: number, ry: number, seed: number, n = 40, jitter = 0.05): Pt[] {
  const rnd = rng(seed);
  const ph = [rnd() * 6, rnd() * 6, rnd() * 6];
  const out: Pt[] = [];
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const f = 1 + jitter * (Math.sin(a * 3 + ph[0]) * 0.6 + Math.sin(a * 5 + ph[1]) * 0.3 + Math.sin(a * 9 + ph[2]) * 0.2);
    out.push([cx + Math.cos(a) * rx * f, cy + Math.sin(a) * ry * f]);
  }
  return out;
}

function smooth(ctx: Ctx, pts: Pt[]) {
  ctx.beginPath();
  const n = pts.length;
  for (let k = 0; k <= n; k++) {
    const p = pts[k % n];
    const q = pts[(k + 1) % n];
    const m: Pt = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    if (k === 0) ctx.moveTo(m[0], m[1]);
    else ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  ctx.closePath();
}

function palm(ctx: Ctx, x: number, y: number, s: number, lean: number) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + lean * 0.4, y - s * 0.6, x + lean, y - s);
  ctx.stroke();
  const tx = x + lean;
  const ty = y - s;
  ctx.lineWidth = 0.8;
  for (let k = 0; k < 6; k++) {
    const a = -Math.PI + (k / 5) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.quadraticCurveTo(tx + Math.cos(a) * s * 0.3, ty - s * 0.15, tx + Math.cos(a) * s * 0.55, ty + Math.sin(a) * s * 0.3 + s * 0.12);
    ctx.stroke();
  }
  line(ctx, x - 4, y + 0.5, x + 4, y + 0.5, INK, 0.8);
}

/** One island: tinted shallows, form lines round the coast, stippled sand, a hachured hill, palms. */
function island(ctx: Ctx, i: (typeof ISLANDS)[number], seed: number) {
  const { x, y, rx, ry } = i;
  const wash = ctx.createRadialGradient(x, y, Math.min(rx, ry) * 0.6, x, y, rx * 1.9 + 20);
  wash.addColorStop(0, 'rgba(90,150,140,0.55)');
  wash.addColorStop(1, 'rgba(90,150,140,0)');
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.ellipse(x, y, rx * 1.9 + 20, ry * 1.9 + 20, 0, 0, Math.PI * 2);
  ctx.fill();
  for (let k = 5; k >= 1; k--) {
    smooth(ctx, coast(x, y, rx + k * 7, ry + k * 5.5, seed));
    ctx.strokeStyle = ink(0.55 - k * 0.08);
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  const sand = coast(x, y, rx, ry, seed);
  smooth(ctx, sand);
  ctx.fillStyle = '#e8c98a';
  ctx.fill();
  ctx.save();
  ctx.clip();
  const rnd = rng(seed + 7);
  ctx.fillStyle = ink(0.45);
  for (let k = 0; k < rx * ry * 0.3; k++) ctx.fillRect(x - rx * 1.1 + rnd() * rx * 2.2, y - ry * 1.1 + rnd() * ry * 2.2, 0.8, 0.8);
  ctx.restore();
  smooth(ctx, sand);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // The hill: a green wash with hachures radiating down from the top, heavier on the lee side.
  const hx = x - rx * 0.1;
  const hy = y - ry * 0.1;
  const hrx = rx * 0.62;
  const hry = ry * 0.6;
  smooth(ctx, coast(hx, hy, hrx, hry, seed + 1, 30, 0.14));
  ctx.fillStyle = 'rgba(120,150,80,0.75)';
  ctx.fill();
  ctx.strokeStyle = ink(0.7);
  ctx.lineWidth = 0.65;
  const n = Math.round(rx * 0.7);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const r1 = 0.95 - (k % 2) * 0.12;
    ctx.globalAlpha = Math.cos(a - 0.8) > 0 ? 1 : 0.5;
    line(ctx, hx + Math.cos(a) * hrx * 0.35, hy + Math.sin(a) * hry * 0.35, hx + Math.cos(a) * hrx * r1, hy + Math.sin(a) * hry * r1, ink(0.7), 0.65);
  }
  ctx.globalAlpha = 1;
  const s = Math.min(23, ry * 0.65);
  palm(ctx, x - rx * 0.3, y + ry * 0.3, s, 5);
  if (rx > 30) palm(ctx, x + rx * 0.22, y + ry * 0.2, s * 0.86, -4);
  if (rx > 50) palm(ctx, x - rx * 0.03, y - ry * 0.1, s * 0.74, 2);
  text(ctx, t(i.name), x, y + ry + 22, `italic 600 ${rx > 50 ? 14 : 12}px ${SERIF}`, INK);
}

/** A compass rose: a 32-point star in ink and green on a ring graduated like a compass card. */
function rose(ctx: Ctx, x: number, y: number) {
  circle(ctx, x, y, 56, 'rgba(245,232,200,0.85)');
  for (const r of [56, 52, 42]) circle(ctx, x, y, r, null, INK, r === 56 ? 1.25 : 0.6);
  for (let k = 0; k < 64; k++) {
    const a = (k / 64) * Math.PI * 2;
    const l = k % 8 === 0 ? 6 : k % 2 ? 2 : 3.5;
    line(ctx, x + Math.cos(a) * 52, y + Math.sin(a) * 52, x + Math.cos(a) * (52 - l), y + Math.sin(a) * (52 - l), INK, 0.6);
  }
  const point = (a: number, len: number, wid: number, dark: boolean) => {
    const tip: Pt = [x + Math.cos(a) * len, y + Math.sin(a) * len];
    const l: Pt = [x + Math.cos(a - Math.PI / 2) * wid, y + Math.sin(a - Math.PI / 2) * wid];
    const r: Pt = [x + Math.cos(a + Math.PI / 2) * wid, y + Math.sin(a + Math.PI / 2) * wid];
    poly(ctx, [[x, y], tip, l], dark ? INK : '#f3e6c4', INK, 0.65);
    poly(ctx, [[x, y], tip, r], dark ? '#f3e6c4' : '#2f6a58', INK, 0.65);
  };
  for (let k = 0; k < 8; k++) point(-Math.PI / 2 + (k / 8) * Math.PI * 2 + Math.PI / 8, 30, 4.5, k % 2 === 1);
  for (let k = 0; k < 4; k++) point(-Math.PI / 2 + (k / 4) * Math.PI * 2 + Math.PI / 4, 36, 6, k % 2 === 1);
  for (let k = 0; k < 4; k++) point(-Math.PI / 2 + (k / 4) * Math.PI * 2, 49, 7.5, k % 2 === 1);
  circle(ctx, x, y, 3.5, OCHRE, INK, 0.75);
  poly(ctx, [[x, y - 68], [x - 5, y - 59], [x, y - 61], [x + 5, y - 59]], INK);
  text(ctx, t('windN'), x, y - 75, `700 12px ${SERIF}`, INK);
}

/** The compass rose drawn on the chart, and a second one off to the east whose lines also cross it. */
export const ROSES = [
  { x: 700, y: 560, drawn: true },
  { x: 1620, y: 660, drawn: false },
];

function bakeSea(scene: Phaser.Scene) {
  const { w: W, h: H } = WORLD;
  bake(scene, 'sea', W, H, SEA_RES, (ctx) => {
    parchment(ctx, W, H, 5, 40_000, true);
    // Everything that may cross an edge of the sea is drawn again one sea over, so the chart
    // joins up seamlessly where it wraps.
    const copies = (x: number, y: number, reach: number, draw: (dx: number, dy: number) => void) => {
      for (const dx of [-W, 0, W]) {
        for (const dy of [-H, 0, H]) {
          if (x + dx + reach < 0 || x + dx - reach > W || y + dy + reach < 0 || y + dy - reach > H) continue;
          draw(dx, dy);
        }
      }
    };
    // Rhumb lines: 32 from each rose, as on a portolan chart.
    ctx.lineWidth = 0.6;
    for (const [i, r] of ROSES.entries()) {
      const a = i === 0 ? 0.32 : 0.2;
      copies(r.x, r.y, 4000, (dx, dy) => {
        for (let k = 0; k < 32; k++) {
          const ang = (k / 32) * Math.PI * 2;
          ctx.strokeStyle = k % 4 === 0 ? ink(a) : k % 2 === 0 ? `rgba(40,90,70,${a * 0.8})` : `rgba(150,100,40,${a * 0.7})`;
          ctx.beginPath();
          ctx.moveTo(r.x + dx, r.y + dy);
          ctx.lineTo(r.x + dx + Math.cos(ang) * 2600, r.y + dy + Math.sin(ang) * 2600);
          ctx.stroke();
        }
      });
    }
    // Sea hatching: short engraved strokes, thicker toward the coasts, none on the shallows.
    const rnd = rng(12);
    ctx.strokeStyle = ink(0.4);
    ctx.lineWidth = 0.75;
    const near = (x: number, y: number) => {
      let best = Infinity;
      for (const i of ISLANDS) {
        const dx = Math.abs(x - i.x);
        const dy = Math.abs(y - i.y);
        const d = Math.hypot(Math.min(dx, W - dx) / (i.rx + 30), Math.min(dy, H - dy) / (i.ry + 30));
        best = Math.min(best, d);
      }
      return best;
    };
    for (let i = 0; i < 13_000; i++) {
      const x = rnd() * W;
      const y = rnd() * H;
      const l = 5 + rnd() * 9;
      const d = near(x, y);
      const keep = rnd();
      if (d < 1.25) continue;
      if (keep > 0.3 + Math.max(0, 1 - (d - 1.25) / 2.5) * 0.7) continue;
      copies(x, y, l, (dx, dy) => {
        ctx.beginPath();
        ctx.moveTo(x + dx, y + dy);
        ctx.quadraticCurveTo(x + dx + l / 2, y + dy - 1.5, x + dx + l, y + dy);
        ctx.stroke();
      });
    }
    for (const [k, i] of ISLANDS.entries()) copies(i.x, i.y, i.rx * 2 + 60, (dx, dy) => island(ctx, { ...i, x: i.x + dx, y: i.y + dy }, 23 + k * 11));
    // Depth soundings scattered over the open sea.
    const srnd = rng(8);
    for (let k = 0; k < 70; k++) {
      const x = 30 + srnd() * (W - 60);
      const y = 30 + srnd() * (H - 60);
      const depth = 6 + Math.floor(srnd() * 20);
      if (near(x, y) < 2) continue;
      text(ctx, String(depth), x, y, `italic 9px ${SERIF}`, ink(0.55));
    }
    const drawn = ROSES[0];
    rose(ctx, drawn.x, drawn.y);
  });
}

/** Fixed on screen over the sea: browned edges and the chart's neatline with its degree scale. */
function bakeFrame(scene: Phaser.Scene) {
  const { w: W, h: H } = VIEW;
  bake(scene, 'frame', W, H, SHEET_RES, (ctx) => {
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, H * 1.15);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(110,70,25,0.45)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(3, 3, W - 6, H - 6);
    ctx.lineWidth = 0.6;
    ctx.strokeRect(9, 9, W - 18, H - 18);
    ctx.fillStyle = INK;
    for (let x = 9, k = 0; x < W - 9; x += 24, k++) if (k % 2 === 0) ctx.fillRect(x, H - 9, Math.min(24, W - 9 - x), 6);
    for (let y = HUD_HEIGHT, k = 0; y < H - 9; y += 24, k++) {
      if (k % 2) continue;
      const h = Math.min(24, H - 9 - y);
      ctx.fillRect(3, y, 6, h);
      ctx.fillRect(W - 9, y, 6, h);
    }
  });
}

// ---------------------------------------------------------------------------------------------
// Ships, shot and plunder.

/** A ship seen from above, bow to the east, as an engraved miniature: the texture `ship-<kind>`. */
function bakeShip(scene: Phaser.Scene, kind: keyof typeof SHIP_LOOKS) {
  const look = SHIP_LOOKS[kind];
  const L = look.length;
  const B = look.beam;
  const w = L + 12;
  const h = B * 2 + 12;
  const dark = kind in HULLS;
  bake(scene, `ship-${kind}`, w, h, HI, (ctx) => {
    ctx.translate(w / 2, h / 2);
    const P = (pts: number[][]): Pt[] => pts.map(([a, b]) => [a * L, b * B]);
    const hull = P([[0.5, 0], [0.34, 0.42], [0.12, 0.52], [-0.3, 0.48], [-0.5, 0.36], [-0.5, -0.36], [-0.3, -0.48], [0.12, -0.52], [0.34, -0.42]]);
    // Guns run out of each side.
    for (let g = 0; g < look.guns; g++) {
      const gx = L * (-0.12 + (0.34 * (g + 0.5)) / look.guns);
      for (const side of [-1, 1]) poly(ctx, [[gx - 2, side * B * 0.48], [gx + 2, side * B * 0.48], [gx + 1.5, side * (B * 0.48 + 4.5)], [gx - 1.5, side * (B * 0.48 + 4.5)]], INK);
    }
    poly(ctx, hull, '#b88a55', INK, 1.5);
    ctx.save();
    poly(ctx, hull);
    ctx.clip();
    for (let k = -0.5; k <= 0.5; k += 0.045) line(ctx, k * L, -B, k * L, B, ink(0.55), 0.55);
    // Shading on the starboard quarter; the light comes from the north-west.
    for (let k = -0.5; k <= 0.5; k += 0.03) line(ctx, k * L, B * 0.2, k * L + 4, B, ink(0.55), 0.5);
    ctx.restore();
    poly(ctx, P([[0.3, 0.3], [0.08, 0.36], [-0.28, 0.33], [-0.42, 0.24], [-0.42, -0.24], [-0.28, -0.33], [0.08, -0.36], [0.3, -0.3], [0.4, 0]]), '#d9b77e', INK, 0.75);
    poly(ctx, P([[-0.24, 0.3], [-0.42, 0.24], [-0.42, -0.24], [-0.24, -0.3]]), '#c49a62', INK, 0.75);
    if (look.extra === 'flagship') {
      // A gilded rail round the deck and a lantern on each quarter.
      poly(ctx, P([[0.3, 0.3], [0.08, 0.36], [-0.28, 0.33], [-0.42, 0.24], [-0.42, -0.24], [-0.28, -0.33], [0.08, -0.36], [0.3, -0.3], [0.4, 0]]), null, OCHRE, 1.4);
      for (const side of [-1, 1]) circle(ctx, -0.47 * L, side * 0.3 * B, 2.6, '#f0c860', INK, 0.8);
    }
    if (look.extra === 'storm') {
      // A silvered rail round the deck and a pale storm lantern on each quarter and at the bow.
      poly(ctx, P([[0.3, 0.3], [0.08, 0.36], [-0.28, 0.33], [-0.42, 0.24], [-0.42, -0.24], [-0.28, -0.33], [0.08, -0.36], [0.3, -0.3], [0.4, 0]]), null, '#5f7a80', 1.6);
      for (const side of [-1, 1]) circle(ctx, -0.47 * L, side * 0.3 * B, 2.8, '#cfe6ea', INK, 0.8);
      circle(ctx, 0.46 * L, 0, 2.4, '#cfe6ea', INK, 0.8);
    }
    if (look.extra === 'mortar') {
      // A squat mortar on a round bed on the foredeck.
      circle(ctx, 0.24 * L, 0, B * 0.3, '#c49a62', INK, 1);
      circle(ctx, 0.24 * L, 0, B * 0.19, '#3a332c', INK, 1);
      circle(ctx, 0.24 * L, 0, B * 0.09, INK);
    }
    if (look.extra === 'cargo') {
      // Bales and crates of cargo lashed amidships.
      for (const [bx, by] of [[0.02, 0.17], [0.02, -0.17], [-0.12, 0.17], [-0.12, -0.17]]) poly(ctx, P([[bx + 0.06, by + 0.13], [bx - 0.06, by + 0.13], [bx - 0.06, by - 0.13], [bx + 0.06, by - 0.13]]), '#b08850', INK, 0.8);
    }
    if (look.extra === 'fire') {
      // Barrels of pitch stacked on deck.
      for (const [bx, by] of [[0.32, 0], [-0.05, 0.2], [-0.05, -0.2], [-0.3, 0.05]]) circle(ctx, bx * L, by * B, 3.2, '#6a4a2a', INK, 0.8);
    }
    // Sails, bellied forward by the wind, with engraved shading lines.
    for (const m of look.masts) {
      const span = B * 0.92;
      const a: Pt = [m * L, -span];
      const b: Pt = [m * L, span];
      const c1: Pt = [(m + 0.2) * L, -span * 0.75];
      const c2: Pt = [(m + 0.2) * L, span * 0.75];
      const sail = () => {
        ctx.beginPath();
        ctx.moveTo(...a);
        ctx.bezierCurveTo(...c1, ...c2, ...b);
      };
      sail();
      ctx.closePath();
      ctx.fillStyle = look.sail;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = dark ? 'rgba(10,8,6,0.8)' : ink(0.5);
      ctx.lineWidth = dark ? 0.8 : 0.5;
      for (let k = -1; k <= 1; k += dark ? 0.07 : 0.12) {
        ctx.beginPath();
        ctx.moveTo(m * L, span * k);
        ctx.quadraticCurveTo((m + 0.1) * L, span * k * 1.05 + 3, (m + 0.2) * L, span * k * 0.7 + 5);
        ctx.stroke();
      }
      ctx.restore();
      sail();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      line(ctx, m * L - 1.5, -span - 2, m * L - 1.5, span + 2, INK, 1.75);
      circle(ctx, m * L - 0.5, 0, 2, INK);
    }
    // A pennant streaming aft from the mainmast, tinted with the ship's colour.
    const fm = look.masts[0] * L - 1.5;
    ctx.beginPath();
    ctx.moveTo(fm, 0);
    ctx.quadraticCurveTo(fm - 9, -5, fm - 20, -2);
    ctx.lineTo(fm - 15, 1.5);
    ctx.quadraticCurveTo(fm - 8, 3, fm, 3);
    ctx.closePath();
    ctx.fillStyle = look.flag;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.75;
    ctx.stroke();
    if (look.extra === 'fire') {
      // Tongues of flame licking up from the pitch, in ochre and orange with ink outlines.
      for (const [fx, fy, s] of [[0.3, 0.05, 1], [-0.08, -0.25, 0.8], [-0.32, 0.2, 0.9]] as const) {
        const x = fx * L;
        const y = fy * B;
        ctx.beginPath();
        ctx.moveTo(x + 6 * s, y);
        ctx.quadraticCurveTo(x + 1 * s, y - 4 * s, x - 5 * s, y - 2 * s);
        ctx.quadraticCurveTo(x - 1 * s, y, x - 5 * s, y + 2.5 * s);
        ctx.quadraticCurveTo(x + 1 * s, y + 4 * s, x + 6 * s, y);
        ctx.fillStyle = 'rgba(224,120,40,0.92)';
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 0.7;
        ctx.stroke();
        circle(ctx, x - 0.5 * s, y, 1.4 * s, '#f0c860');
      }
    }
  });
}

/**
 * A shore fort on an island: a four-pointed stone bastion with a gun on each point and a flag,
 * engraved and washed in grey. Its hull bar and hit flash are drawn over it each frame.
 */
function bakeFort(scene: Phaser.Scene) {
  const size = FORT.radius * 2 + 12;
  bake(scene, 'fort', size, size, HI, (ctx) => {
    const c = size / 2;
    const R = FORT.radius;
    // The star: four bastions at the corners of a square keep.
    const star: Pt[] = [];
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2 + Math.PI / 4;
      star.push([c + Math.cos(a - 0.5) * R * 0.62, c + Math.sin(a - 0.5) * R * 0.62]);
      star.push([c + Math.cos(a) * R, c + Math.sin(a) * R]);
      star.push([c + Math.cos(a + 0.5) * R * 0.62, c + Math.sin(a + 0.5) * R * 0.62]);
    }
    ctx.shadowColor = 'rgba(40,30,20,0.3)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    poly(ctx, star, '#b7ad98', INK, 1.5);
    ctx.shadowColor = 'transparent';
    // Masonry: hatched courses of stone.
    ctx.save();
    poly(ctx, star);
    ctx.clip();
    for (let y = 0; y < size; y += 4) line(ctx, 0, y, size, y, ink(0.35), 0.5);
    for (let x = 0; x < size; x += 7) line(ctx, x, 0, x + 2, size, ink(0.2), 0.5);
    ctx.restore();
    poly(ctx, star, null, INK, 1.5);
    // The keep, its parapet and the magazine's well.
    const k = R * 0.42;
    poly(ctx, [[c - k, c - k], [c + k, c - k], [c + k, c + k], [c - k, c + k]], '#cfc6b0', INK, 1.2);
    poly(ctx, [[c - k + 3, c - k + 3], [c + k - 3, c - k + 3], [c + k - 3, c + k - 3], [c - k + 3, c + k - 3]], null, ink(0.6), 0.6);
    circle(ctx, c, c, R * 0.16, '#3a332c', INK, 1);
    circle(ctx, c, c, R * 0.07, INK);
    // Guns on each bastion, run out toward the sea.
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4;
      const gx = c + Math.cos(a) * R * 0.78;
      const gy = c + Math.sin(a) * R * 0.78;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      poly(ctx, [[gx - ca * 4 - sa * 1.6, gy - sa * 4 + ca * 1.6], [gx + ca * 5 - sa * 1.2, gy + sa * 5 + ca * 1.2], [gx + ca * 5 + sa * 1.2, gy + sa * 5 - ca * 1.2], [gx - ca * 4 + sa * 1.6, gy - sa * 4 - ca * 1.6]], INK);
    }
    // A rust pennant on a staff over the keep.
    line(ctx, c + 4, c - k - 2, c + 4, c - k - 16, INK, 1.4);
    poly(ctx, [[c + 4, c - k - 16], [c + 20, c - k - 12], [c + 4, c - k - 7]], 'rgba(154,74,48,0.95)', INK, 0.8);
  });
}

/**
 * The wind rose in the top right corner: a small compass card. The arrow showing which way the
 * wind blows is drawn over it each frame.
 */
function bakeWindRose(scene: Phaser.Scene) {
  const size = WIND.r * 2 + 8;
  bake(scene, 'wind-rose', size, size, HI, (ctx) => {
    const c = size / 2;
    const R = WIND.r;
    circle(ctx, c, c, R, 'rgba(246,236,210,0.94)', INK, 1.5);
    circle(ctx, c, c, R - 5, null, INK, 0.6);
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2;
      const l = k % 8 === 0 ? 5 : k % 4 === 0 ? 3.5 : 2;
      line(ctx, c + Math.cos(a) * (R - 5), c + Math.sin(a) * (R - 5), c + Math.cos(a) * (R - 5 - l), c + Math.sin(a) * (R - 5 - l), INK, 0.6);
    }
    for (const [label, a] of [['windN', -Math.PI / 2], ['windE', 0], ['windS', Math.PI / 2], ['windW', Math.PI]] as const) {
      text(ctx, t(label), c + Math.cos(a) * (R - 14), c + Math.sin(a) * (R - 14), `700 8px ${SERIF}`, ink(0.7));
    }
  });
}

/** The shot: round shot, chain shot, grapeshot and double-powder shot, flying toward the east. */
function bakeShot(scene: Phaser.Scene) {
  bake(scene, 'shot-round', 10, 10, HI, (ctx) => {
    circle(ctx, 5, 5, 3.6, INK);
    circle(ctx, 4, 4, 1, 'rgba(240,226,192,0.6)');
  });
  bake(scene, 'shot-chain', 14, 22, HI, (ctx) => {
    ctx.setLineDash([2, 1.5]);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(8, 3.5);
    ctx.quadraticCurveTo(3, 11, 8, 18.5);
    ctx.stroke();
    ctx.setLineDash([]);
    for (const y of [3.5, 18.5]) {
      circle(ctx, 8, y, 3.3, INK);
      circle(ctx, 7.2, y - 0.8, 0.9, 'rgba(240,226,192,0.6)');
    }
  });
  bake(scene, 'shot-grape', 10, 10, HI, (ctx) => {
    for (const [x, y] of [[3.5, 3.5], [6.5, 4], [4.5, 6.8], [7, 7]]) circle(ctx, x, y, 1.7, INK);
  });
  bake(scene, 'shot-powder', 24, 12, HI, (ctx) => {
    // A ball with a flash of burning powder streaming behind it.
    ctx.beginPath();
    ctx.moveTo(18, 3);
    ctx.quadraticCurveTo(6, 2, 1, 6);
    ctx.quadraticCurveTo(6, 10, 18, 9);
    ctx.closePath();
    ctx.fillStyle = 'rgba(214,150,50,0.8)';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.7;
    ctx.stroke();
    circle(ctx, 18, 6, 4.3, INK);
    circle(ctx, 17, 5, 1.1, 'rgba(240,226,192,0.6)');
  });
}

/** A barrel of plunder afloat, ringed by ripples. */
function bakeLoot(scene: Phaser.Scene) {
  bake(scene, 'loot', 50, 36, HI, (ctx) => {
    const x = 25;
    const y = 16;
    ctx.strokeStyle = ink(0.6);
    ctx.lineWidth = 0.65;
    for (const r of [17, 23]) {
      ctx.beginPath();
      ctx.ellipse(x, y + 4, r, r * 0.45, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    const barrel = () => {
      ctx.beginPath();
      ctx.ellipse(x, y, 11, 13, 0.3, 0, Math.PI * 2);
    };
    barrel();
    ctx.fillStyle = '#c9a060';
    ctx.fill();
    ctx.save();
    barrel();
    ctx.clip();
    for (let k = 0; k < 12; k++) line(ctx, x + 2 + k, y - 15, x + 2 + k, y + 15, ink(0.6), 0.5);
    ctx.restore();
    for (const o of [-6, 6]) {
      ctx.beginPath();
      ctx.ellipse(x - o * 0.09, y + o, 10, 3, 0.3, 0, Math.PI * 2);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    barrel();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.25;
    ctx.stroke();
    circle(ctx, x - 3, y - 5, 2.2, '#e0b040', INK, 0.6);
  });
}

// ---------------------------------------------------------------------------------------------
// The controls and panels.

/** A ship's wheel in ink: the helm button `helm-<side>` and, held, `helm-<side>-held`. */
function bakeWheel(scene: Phaser.Scene, side: 'port' | 'starboard', held: boolean) {
  const size = HELM.r * 2 + 8;
  bake(scene, `helm-${side}${held ? '-held' : ''}`, size, size, HI, (ctx) => {
    const c = size / 2;
    const R = HELM.r - 11;
    const dir = side === 'port' ? -1 : 1;
    circle(ctx, c, c, R + 3, held ? 'rgba(214,160,60,0.55)' : 'rgba(245,232,200,0.8)');
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
      line(ctx, c + Math.cos(a) * 13, c + Math.sin(a) * 13, c + Math.cos(a) * (R + 9), c + Math.sin(a) * (R + 9), INK, 3);
      circle(ctx, c + Math.cos(a) * (R + 10), c + Math.sin(a) * (R + 10), 3.5, held ? OCHRE : '#b88a55', INK, 1);
    }
    circle(ctx, c, c, R - 4, null, INK, 3.5);
    circle(ctx, c, c, R - 9, held ? 'rgba(248,236,200,0.95)' : 'rgba(248,238,214,0.95)', INK, 1);
    circle(ctx, c, c, 13, null, INK, 1);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'miter';
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(c - 5 * dir, c - 19);
    ctx.lineTo(c + 7 * dir, c - 7);
    ctx.lineTo(c - 5 * dir, c + 5);
    ctx.stroke();
    text(ctx, t(side === 'port' ? 'helmPort' : 'helmStarboard'), c, c + 22, `italic 700 13px ${SERIF}`, INK);
  });
}

/**
 * A fire control: a brass-rimmed button with a cannon run out to that side, and a sextant scale
 * round its rim that the charge fills while it is held. `fire-<side>`, and `fire-<side>-held`.
 */
function bakeFireButton(scene: Phaser.Scene, side: 'port' | 'starboard', held: boolean) {
  const size = FIRE.r * 2 + 8;
  bake(scene, `fire-${side}${held ? '-held' : ''}`, size, size, HI, (ctx) => {
    const c = size / 2;
    const R = FIRE.r;
    const dir = side === 'port' ? -1 : 1;
    circle(ctx, c, c, R, held ? '#e3bf78' : 'rgba(246,236,210,0.92)', INK, 2);
    circle(ctx, c, c, R - 7, null, INK, 0.7);
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2;
      const l = k % 9 === 0 ? 7 : k % 3 === 0 ? 4.5 : 2.5;
      line(ctx, c + Math.cos(a) * R, c + Math.sin(a) * R, c + Math.cos(a) * (R - l), c + Math.sin(a) * (R - l), INK, k % 9 === 0 ? 1 : 0.6);
    }
    // A cannon on its carriage, seen from above, its muzzle out to the side it fires.
    const cy = c - 6;
    poly(ctx, [[c - 9, cy - 7], [c + 9, cy - 7], [c + 9, cy + 7], [c - 9, cy + 7]].map(([x, y]) => [c + (x - c) * dir, y] as Pt), '#b88a55', INK, 1);
    for (const y of [cy - 8.5, cy + 8.5]) poly(ctx, [[c - 7, y - 2], [c + 5, y - 2], [c + 5, y + 2], [c - 7, y + 2]].map(([x, yy]) => [c + (x - c) * dir, yy] as Pt), INK);
    poly(ctx, [[c - 12, cy - 4.5], [c + 20, cy - 3], [c + 20, cy + 3], [c - 12, cy + 4.5]].map(([x, y]) => [c + (x - c) * dir, y] as Pt), '#3a332c', INK, 1);
    line(ctx, c + 19 * dir, cy - 4, c + 19 * dir, cy + 4, INK, 2.2);
    circle(ctx, c - 13 * dir, cy, 2.6, '#3a332c', INK, 1);
    text(ctx, t(side === 'port' ? 'firePort' : 'fireStarboard'), c, c + 17, `italic 700 ${side === 'port' ? 11 : 10.5}px ${SERIF}`, INK);
  });
}

/** The wax seal on the captain's order card, with the order's emblem: `seal-<order>`. */
function bakeSeal(scene: Phaser.Scene, order: OrderId) {
  bake(scene, `seal-${order}`, 40, 40, HI, (ctx) => {
    const x = 20;
    const y = 20;
    ctx.beginPath();
    for (let k = 0; k <= 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      const r = k % 2 ? 15 : 17;
      if (k) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      else ctx.moveTo(x + r, y);
    }
    ctx.fillStyle = '#2f4f7a';
    ctx.fill();
    ctx.strokeStyle = '#1a2c48';
    ctx.lineWidth = 0.75;
    ctx.stroke();
    circle(ctx, x, y, 10, null, 'rgba(220,230,255,0.6)', 0.75);
    const pale = '#dfe6f2';
    ctx.strokeStyle = pale;
    ctx.fillStyle = pale;
    if (order === 'chain') {
      circle(ctx, x - 4.5, y, 3, pale);
      circle(ctx, x + 4.5, y, 3, pale);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x - 2, y);
      ctx.quadraticCurveTo(x, y + 3, x + 2, y);
      ctx.stroke();
    } else if (order === 'grape') {
      for (const [dx, dy] of [[-3, -2.5], [3, -2.5], [0, 0.5], [-3, 3.5], [3, 3.5]]) circle(ctx, x + dx, y + dy, 1.9, pale);
    } else if (order === 'powder') {
      // A flame with a flickering tip, and a tongue of the seal's blue inside it.
      const flame = (k: number, dy: number) => {
        ctx.beginPath();
        ctx.moveTo(x + 1 * k, y - 8 * k + dy);
        ctx.quadraticCurveTo(x + 2 * k, y - 3 * k + dy, x + 5 * k, y - 2 * k + dy);
        ctx.quadraticCurveTo(x + 7 * k, y + 5 * k + dy, x, y + 7 * k + dy);
        ctx.quadraticCurveTo(x - 7 * k, y + 5 * k + dy, x - 4 * k, y - 1 * k + dy);
        ctx.quadraticCurveTo(x - 2 * k, y + 1 * k + dy, x + 1 * k, y - 8 * k + dy);
        ctx.fill();
      };
      flame(1, 0);
      ctx.fillStyle = '#2f4f7a';
      flame(0.45, 3);
    } else if (order === 'wind') {
      ctx.lineWidth = 1.2;
      for (const [dy, w] of [[-3.5, 10], [0.5, 12], [4.5, 8]]) {
        ctx.beginPath();
        ctx.moveTo(x - 6, y + dy);
        ctx.lineTo(x - 6 + w - 3, y + dy);
        ctx.arc(x - 6 + w - 3, y + dy - 1.5, 1.5, Math.PI / 2, -Math.PI / 2, true);
        ctx.stroke();
      }
    } else {
      // An hourglass, for gun crews working against the clock.
      poly(ctx, [[x - 4.5, y - 6], [x + 4.5, y - 6], [x, y], [x + 4.5, y + 6], [x - 4.5, y + 6], [x, y]], pale);
      line(ctx, x - 5.5, y - 6.5, x + 5.5, y - 6.5, pale, 1);
      line(ctx, x - 5.5, y + 6.5, x + 5.5, y + 6.5, pale, 1);
    }
  });
}

/** A sheet of parchment with a double ruled border and a little fleuron at each corner. */
function bakePanel(scene: Phaser.Scene, key: string, w: number, h: number) {
  bake(scene, key, w, h, SHEET_RES, (ctx) => {
    parchment(ctx, w, h, w + h, Math.round((w * h) / 30));
    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(110,70,25,0.35)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
    ctx.lineWidth = 1;
    ctx.strokeRect(9, 9, w - 18, h - 18);
    for (const [x, y] of [[9, 9], [w - 9, 9], [9, h - 9], [w - 9, h - 9]]) {
      poly(ctx, [[x, y - 6], [x + 6, y], [x, y + 6], [x - 6, y]], CREAM, INK, 1);
      circle(ctx, x, y, 1.5, INK);
    }
  });
}

/** The captain's order card: a folded note, its shadow on the chart; the text is drawn over it. */
function bakeOrderCard(scene: Phaser.Scene) {
  const w = 300;
  const h = 60;
  bake(scene, 'order-card', w + 12, h + 12, HI, (ctx) => {
    ctx.translate(4, 3);
    ctx.shadowColor = 'rgba(80,50,20,0.35)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2.5;
    const sheet: Pt[] = [[0, 0], [w, 2], [w - 3, h], [2, h - 1.5]];
    poly(ctx, sheet, '#f8eed6');
    ctx.shadowColor = 'transparent';
    poly(ctx, sheet, null, INK, 1);
    ctx.strokeStyle = ink(0.4);
    ctx.lineWidth = 0.5;
    ctx.strokeRect(4, 4, w - 10, h - 9);
  });
}

/** The top bar: a strip of parchment ruled off from the chart, with a ribbon for the wave. */
function bakeHudBar(scene: Phaser.Scene) {
  const W = VIEW.w;
  bake(scene, 'hud-bar', W, HUD_HEIGHT + 2, HI, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, HUD_HEIGHT);
    g.addColorStop(0, '#f2e4c0');
    g.addColorStop(1, '#e2cc98');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, HUD_HEIGHT);
    line(ctx, 0, HUD_HEIGHT, W, HUD_HEIGHT, INK, 1.5);
    line(ctx, 0, HUD_HEIGHT - 3, W, HUD_HEIGHT - 3, INK, 0.6);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(3, 3, W - 6, HUD_HEIGHT);
    // The ribbon the wave number is written on.
    const rx = 15;
    const ry = 7;
    const rw = 95;
    const rh = 24;
    poly(ctx, [[rx - 8, ry + 4], [rx, ry + 4], [rx, ry + rh + 4], [rx - 8, ry + rh + 4], [rx - 3, ry + rh / 2 + 4]], '#b88a55', INK, 0.75);
    poly(ctx, [[rx + rw + 8, ry + 4], [rx + rw, ry + 4], [rx + rw, ry + rh + 4], [rx + rw + 8, ry + rh + 4], [rx + rw + 3, ry + rh / 2 + 4]], '#b88a55', INK, 0.75);
    poly(ctx, [[rx, ry], [rx + rw, ry], [rx + rw, ry + rh], [rx, ry + rh]], CREAM, INK, 1);
    // A gold coin beside the purse.
    circle(ctx, 400, 21, 8.5, '#d8a840', INK, 1);
    circle(ctx, 400, 21, 5.5, null, INK, 0.6);
  });
}

/** Paints every texture at startup, so the prototype needs no asset files. */
export function bakeAll(scene: Phaser.Scene) {
  // The widest small piece is the top bar, which holds the rest to a texture every device loads.
  HI = sharpRes(VIEW.w, HUD_HEIGHT + 2, 2);
  SEA_RES = Math.floor(sharpRes(WORLD.w, WORLD.h, 1));
  SHEET_RES = sharpRes(VIEW.w, VIEW.h, 1);
  bakeSea(scene);
  bakeFrame(scene);
  for (const kind of Object.keys(SHIP_LOOKS) as (keyof typeof SHIP_LOOKS)[]) bakeShip(scene, kind);
  bakeShot(scene);
  bakeLoot(scene);
  bakeFort(scene);
  for (const side of ['port', 'starboard'] as const) {
    for (const held of [false, true]) {
      bakeWheel(scene, side, held);
      bakeFireButton(scene, side, held);
    }
  }
  for (const order of ORDER_IDS) bakeSeal(scene, order);
  bakePanel(scene, 'panel-harbor', HARBOR.w, HARBOR.h);
  bakePanel(scene, 'panel-over', OVER.w, OVER.h);
  bakeWindRose(scene);
  bakeOrderCard(scene);
  bakeHudBar(scene);
}
