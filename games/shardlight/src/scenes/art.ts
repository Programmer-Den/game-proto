import type Phaser from 'phaser';
import { seeded } from '../../../../shared/daily';
import type { BeadKind, Pane } from '../game/sim';
import type { GlassId } from '../game/save';

/**
 * Shardlight's look: jewel-coloured panes held in black lead, a stone arch round the field, and the
 * picture each window shows once its panes are out. Everything is drawn with Phaser graphics, so
 * it stays sharp at any screen size.
 */

export const C = {
  stone: 0x1d1a26,
  stoneLine: 0x2a2533,
  stoneDark: 0x120f17,
  lead: 0x14110c,
  arch: 0x8a7a5c,
  ink: 0xe8d9b0,
  dim: 0x9a8e74,
  gold: 0xf2c45a,
  brass: 0xd8b060,
  brassDark: 0x8a6420,
  ruby: 0xc0263a,
  button: 0x2c2636,
  buttonHi: 0x45394f,
  locked: 0x2a2533,
  night: 0x0b0a14,
};

/** The pane colours: ruby, sapphire, amber, emerald, and gold for the heart. */
export const PANE_COLOURS = [0xc0263a, 0x1f5fbf, 0xe0a020, 0x2f9a5a, 0xf2c45a];
const LEAD_GREY = 0x8d96a0;
const BEAD_PANE = 0xb04aa8;

export const hex = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

const shade = (c: number, k: number) => {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * k));
  const b = Math.min(255, Math.round((c & 255) * k));
  return (r << 16) | (g << 8) | b;
};

/** The stone wall behind everything, over the whole view. */
export function drawWall(g: Phaser.GameObjects.Graphics, w: number, h: number) {
  g.fillStyle(C.stone, 1).fillRect(0, 0, w, h);
  g.lineStyle(2, C.stoneLine, 1);
  for (let y = 0, row = 0; y < h; y += 30, row++)
    for (let x = row % 2 ? -40 : 0; x < w; x += 80) g.strokeRect(x, y, 80, 30);
  g.fillStyle(C.stoneDark, 0.5).fillRect(0, h * 0.6, w, h * 0.4);
}

/** The arch frame round the field: the stone sill, the sides and the pointed top. */
export function drawArch(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.fillStyle(C.night, 1).fillRect(x, y, w, h);
  g.lineStyle(10, C.arch, 1);
  g.beginPath();
  g.moveTo(x - 5, y + h + 5);
  g.lineTo(x - 5, y - 5);
  g.lineTo(x + w + 5, y - 5);
  g.lineTo(x + w + 5, y + h + 5);
  g.strokePath();
  // The pointed arch above the field.
  g.fillStyle(C.stoneDark, 1);
  g.beginPath();
  g.moveTo(x - 10, y - 10);
  g.lineTo(x + w / 2, y - 46);
  g.lineTo(x + w + 10, y - 10);
  g.closePath();
  g.fillPath();
  g.lineStyle(6, C.arch, 1);
  g.beginPath();
  g.moveTo(x - 10, y - 8);
  g.lineTo(x + w / 2, y - 44);
  g.lineTo(x + w + 10, y - 8);
  g.strokePath();
}

/** The dark quarry glass below the panes, a diamond lattice the orb crosses. */
export function drawQuarries(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number) {
  g.lineStyle(1, 0x2a2840, 0.7);
  const step = 48;
  // Lines at 45 degrees each way, cut to the rectangle.
  for (let k = -h; k < w + h; k += step) {
    // Down to the right: from (k, 0) along (1, 1).
    const t0 = Math.max(0, -k);
    const t1 = Math.min(h, w - k);
    if (t1 > t0) g.lineBetween(x + k + t0, y + t0, x + k + t1, y + t1);
    // Down to the left: from (k, 0) along (-1, 1).
    const s0 = Math.max(0, k - w);
    const s1 = Math.min(h, k);
    if (s1 > s0) g.lineBetween(x + k - s0, y + s0, x + k - s1, y + s1);
  }
}

type Paint = (g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, variant: number) => void;

/** The picture's frame being drawn; every shape is held inside it. */
let bounds = { x: 0, y: 0, w: 0, h: 0 };

/** A stained-glass shape: filled, then leaded round its edge, its corners held inside the picture. */
function glassPoly(g: Phaser.GameObjects.Graphics, raw: number[][], colour: number, alpha = 1) {
  const { x, y, w, h } = bounds;
  const points = raw.map(([px, py]) => [Math.max(x, Math.min(x + w, px)), Math.max(y, Math.min(y + h, py))]);
  g.fillStyle(colour, alpha);
  g.beginPath();
  g.moveTo(points[0][0], points[0][1]);
  for (const [px, py] of points.slice(1)) g.lineTo(px, py);
  g.closePath();
  g.fillPath();
  g.lineStyle(3, C.lead, 1);
  g.strokePath();
}

function glassCircle(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, colour: number) {
  g.fillStyle(colour, 1).fillCircle(x, y, r);
  g.lineStyle(3, C.lead, 1).strokeCircle(x, y, r);
}

/** Where a line from (x, y) at angle `a` leaves the picture, and which edge it leaves by. */
function edgePoint(x: number, y: number, a: number) {
  const { x: bx, y: by, w, h } = bounds;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const hits: [number, string][] = [];
  if (dx > 1e-6) hits.push([(bx + w - x) / dx, 'r']);
  if (dx < -1e-6) hits.push([(bx - x) / dx, 'l']);
  if (dy > 1e-6) hits.push([(by + h - y) / dy, 'b']);
  if (dy < -1e-6) hits.push([(by - y) / dy, 't']);
  const [t, edge] = hits.reduce((m, hit) => (hit[0] < m[0] ? hit : m));
  return { x: x + dx * t, y: y + dy * t, edge };
}

/** A ray of light from (x, y) between two angles, out to the picture's edge (round a corner if need be). */
function ray(x: number, y: number, a0: number, a1: number) {
  const p0 = edgePoint(x, y, a0);
  const p1 = edgePoint(x, y, a1);
  const pts = [[x, y], [p0.x, p0.y]];
  if (p0.edge !== p1.edge) {
    const side = [p0, p1].find((p) => p.edge === 'l' || p.edge === 'r');
    const top = [p0, p1].find((p) => p.edge === 't' || p.edge === 'b');
    if (side && top) pts.push([side.x, top.y]);
  }
  pts.push([p1.x, p1.y]);
  return pts;
}

/** Sky in leaded bands, light at the bottom. */
function skyBands(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, colours: number[]) {
  const band = h / colours.length;
  colours.forEach((c, i) => {
    g.fillStyle(c, 1).fillRect(x, y + i * band, w, band + 1);
    g.lineStyle(3, C.lead, 1).lineBetween(x, y + i * band, x + w, y + i * band);
  });
}

/** Each chapel's picture: dawn over hills, a ship at sea, a fox in the forest, the moon, the sun's rose. */
const PICTURES: Paint[] = [
  (g, x, y, w, h, v) => {
    skyBands(g, x, y, w, h, [0x3a3f8f, 0x6a4a9a, 0xb85a7a, 0xe8885a, 0xf4c070]);
    const sx = x + w * (0.3 + 0.1 * (v % 5));
    const sy = y + h * 0.72;
    for (let i = 0; i < 12; i++) {
      const a = Math.PI + 0.3 + (i / 11) * (Math.PI - 0.6);
      glassPoly(g, ray(sx, sy, a - 0.08, a + 0.08), i % 2 ? 0xf8d890 : 0xf0b060, 0.55);
    }
    glassCircle(g, sx, sy, h * 0.2, 0xffe08a);
    glassPoly(g, [[x, y + h], [x, y + h * 0.75], [x + w * 0.25, y + h * 0.62], [x + w * 0.5, y + h * 0.8], [x + w * 0.5, y + h]], 0x2f7a4a);
    glassPoly(g, [[x + w * 0.4, y + h], [x + w * 0.7, y + h * 0.68], [x + w, y + h * 0.78], [x + w, y + h]], 0x3f9a5a);
  },
  (g, x, y, w, h, v) => {
    skyBands(g, x, y, w, h * 0.55, [0x5aa0d8, 0x8ac0e8, 0xc8e0f0]);
    for (let i = 0; i < 4; i++) {
      const wy = y + h * (0.55 + i * 0.12);
      const pts: number[][] = [[x, y + h]];
      for (let k = 0; k <= 12; k++) pts.push([x + (w * k) / 12, wy + (k % 2 ? 10 : -6)]);
      pts.push([x + w, y + h]);
      glassPoly(g, pts, [0x1f5fbf, 0x2a70c8, 0x1a4a9a, 0x123a7a][i]);
    }
    const bx = x + w * (0.25 + 0.08 * (v % 6));
    const by = y + h * 0.6;
    glassPoly(g, [[bx - 70, by], [bx + 70, by], [bx + 50, by + 26], [bx - 50, by + 26]], 0x8a4a2a);
    glassPoly(g, [[bx - 4, by - 4], [bx - 4, by - 110], [bx - 70, by - 8]], 0xf4ead0);
    glassPoly(g, [[bx + 4, by - 4], [bx + 4, by - 90], [bx + 54, by - 8]], 0xe8d8b0);
    glassCircle(g, x + w * 0.82, y + h * 0.16, 26, 0xffe08a);
  },
  (g, x, y, w, h, v) => {
    skyBands(g, x, y, w, h, [0x2a5a4a, 0x3a7a5a, 0x5a9a5a, 0x7ab060]);
    for (let i = 0; i < 7; i++) {
      const tx = x + (w * (i + 0.5)) / 7;
      const th = h * (0.55 + ((i * 37 + v * 11) % 30) / 100);
      glassPoly(g, [[tx - 8, y + h], [tx - 8, y + h - th * 0.3], [tx + 8, y + h - th * 0.3], [tx + 8, y + h]], 0x6a4a2a);
      glassPoly(g, [[tx, y + h - th], [tx - 46, y + h - th * 0.3], [tx + 46, y + h - th * 0.3]], i % 2 ? 0x1f6a3a : 0x2f8a4a);
    }
    // A fox, sitting.
    const fx = x + w * (0.35 + 0.05 * (v % 6));
    const fy = y + h * 0.95;
    glassPoly(g, [[fx - 34, fy], [fx + 30, fy], [fx + 18, fy - 56], [fx - 20, fy - 56]], 0xd8702a);
    glassPoly(g, [[fx - 22, fy - 52], [fx + 20, fy - 52], [fx, fy - 92]], 0xe8803a);
    glassPoly(g, [[fx - 20, fy - 74], [fx - 14, fy - 104], [fx - 4, fy - 82]], 0xd8702a);
    glassPoly(g, [[fx + 18, fy - 74], [fx + 12, fy - 104], [fx + 2, fy - 82]], 0xd8702a);
    glassPoly(g, [[fx + 30, fy], [fx + 80, fy - 8], [fx + 70, fy - 30]], 0xe8803a);
    glassPoly(g, [[fx + 70, fy - 30], [fx + 80, fy - 8], [fx + 92, fy - 22]], 0xf4ead0);
  },
  (g, x, y, w, h, v) => {
    skyBands(g, x, y, w, h, [0x0e1238, 0x161a4a, 0x1e2460, 0x2a3070]);
    const r = seeded(77 + v);
    for (let i = 0; i < 26; i++) {
      const sx = x + r() * w;
      const sy = y + r() * h * 0.9;
      const s = 3 + r() * 5;
      glassPoly(g, [[sx, sy - s], [sx + s * 0.4, sy], [sx, sy + s], [sx - s * 0.4, sy]], 0xf4ead0);
    }
    const mx = x + w * (0.3 + 0.07 * (v % 6));
    const my = y + h * 0.45;
    glassCircle(g, mx, my, h * 0.3, 0xf0e0a0);
    g.fillStyle(0x161a4a, 1).fillCircle(mx + h * 0.13, my - h * 0.06, h * 0.27);
    g.lineStyle(3, C.lead, 1).strokeCircle(mx + h * 0.13, my - h * 0.06, h * 0.27);
    glassPoly(g, [[x, y + h], [x, y + h * 0.85], [x + w * 0.3, y + h * 0.8], [x + w * 0.6, y + h * 0.9], [x + w, y + h * 0.82], [x + w, y + h]], 0x0a0c22);
  },
  (g, x, y, w, h, v) => {
    g.fillStyle(0x7a1a2a, 1).fillRect(x, y, w, h);
    const cx = x + w / 2;
    const cy = y + h / 2;
    const n = 16 + (v % 3) * 4;
    for (let ring = 3; ring >= 1; ring--) {
      const R = (h * 0.8 * ring) / 3;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2 + ring * 0.2;
        const a1 = ((i + 1) / n) * Math.PI * 2 + ring * 0.2;
        const colour = [0xf2c45a, 0xe0a020, 0xc0263a, 0x1f5fbf][(i + ring) % 4];
        glassPoly(g, [[cx, cy], [cx + Math.cos(a0) * R, cy + Math.sin(a0) * R], [cx + Math.cos(a1) * R, cy + Math.sin(a1) * R]], colour);
      }
    }
    glassCircle(g, cx, cy, h * 0.14, 0xffe08a);
  },
];

/** The picture behind a window's panes, `variant` changing it from window to window. */
export function drawPicture(g: Phaser.GameObjects.Graphics, chapel: number, variant: number, x: number, y: number, w: number, h: number) {
  bounds = { x, y, w, h };
  PICTURES[chapel % PICTURES.length](g, x, y, w, h, variant);
  g.lineStyle(4, C.lead, 1).strokeRect(x, y, w, h);
}

/** Draws a pane at its place in the field, `ox`, `oy` being the field's top left. */
export function drawPane(g: Phaser.GameObjects.Graphics, p: Pane, ox: number, oy: number, guarded = false) {
  const x = ox + p.x;
  const y = oy + p.y;
  if (p.kind === 'gargoyle' || p.kind === 'owl') return drawGuardian(g, p, x, y);
  if (p.kind === 'mirror' || p.kind === 'prism' || p.kind === 'bell') return drawNewPane(g, p, x, y);
  if (p.kind === 'heart' && guarded) {
    // A guarded heart: a pale stone ward round it until its guardians fall.
    g.lineStyle(3, 0xb8c0c8, 0.8).strokeRoundedRect(x - 6, y - 6, p.w + 12, p.h + 12, 8);
  }
  const colour =
    p.kind === 'lead' ? LEAD_GREY : p.kind === 'bead' ? BEAD_PANE : p.kind === 'heart' ? PANE_COLOURS[4] : PANE_COLOURS[p.colour % 4];
  const fill = p.kind === 'thick' ? shade(colour, 0.75) : colour;
  g.fillStyle(fill, 1).fillRect(x, y, p.w, p.h);
  g.fillStyle(0xffffff, p.kind === 'thick' ? 0.12 : 0.2).fillRect(x + 3, y + 3, p.w * 0.6, 4);
  if (p.kind === 'thick') {
    g.lineStyle(2, shade(colour, 1.25), 1).strokeRect(x + 4, y + 4, p.w - 8, p.h - 8);
    if (p.hp === 1) {
      g.lineStyle(1.5, 0xffffff, 0.75);
      g.beginPath();
      g.moveTo(x + p.w * 0.15, y + 4);
      g.lineTo(x + p.w * 0.45, y + p.h * 0.55);
      g.lineTo(x + p.w * 0.38, y + p.h - 3);
      g.moveTo(x + p.w * 0.45, y + p.h * 0.55);
      g.lineTo(x + p.w * 0.8, y + p.h * 0.3);
      g.strokePath();
    }
  } else if (p.kind === 'lead') {
    g.fillStyle(0xd8dde3, 1);
    for (const k of [0.2, 0.5, 0.8]) g.fillCircle(x + p.w * k, y + p.h / 2, 2.5);
  } else if (p.kind === 'bead') {
    g.fillStyle(0xffd8f8, 1).fillCircle(x + p.w / 2, y + p.h / 2, 5);
  } else if (p.kind === 'heart') {
    // A rose: petals round a bright middle, cracking as it is hit.
    const cx = x + p.w / 2;
    const cy = y + p.h / 2;
    g.fillStyle(0xc0263a, 1);
    for (let i = 0; i < 6; i++) g.fillCircle(cx + Math.cos((i * Math.PI) / 3) * 7, cy + Math.sin((i * Math.PI) / 3) * 7, 5);
    g.fillStyle(0xffe08a, 1).fillCircle(cx, cy, 5);
    if (p.hp < 3) {
      g.lineStyle(1.5, 0xffffff, 0.8);
      g.lineBetween(x + 4, y + 4, cx, cy);
      if (p.hp < 2) g.lineBetween(x + p.w - 4, y + p.h - 4, cx, cy);
    }
  }
  g.lineStyle(4, C.lead, 1).strokeRect(x, y, p.w, p.h);
}

/** Cracks across a pane as it is worn down: one line for each hit taken. */
function cracks(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, n: number) {
  g.lineStyle(1.5, 0xffffff, 0.75);
  const lines = [
    [0.15, 0.1, 0.45, 0.6, 0.35, 0.95],
    [0.85, 0.15, 0.55, 0.5, 0.7, 0.9],
    [0.05, 0.6, 0.4, 0.45, 0.6, 0.2],
  ];
  for (const l of lines.slice(0, n)) {
    g.beginPath();
    g.moveTo(x + w * l[0], y + h * l[1]);
    g.lineTo(x + w * l[2], y + h * l[3]);
    g.lineTo(x + w * l[4], y + h * l[5]);
    g.strokePath();
  }
}

/** The new panes: a silvered mirror, a clear prism with a rainbow, a bronze bell. */
function drawNewPane(g: Phaser.GameObjects.Graphics, p: Pane, x: number, y: number) {
  const { w, h } = p;
  if (p.kind === 'mirror') {
    g.fillStyle(0xa8b8c8, 1).fillRect(x, y, w, h);
    g.fillStyle(0xe8f0f8, 0.8).fillTriangle(x + w * 0.1, y + h, x + w * 0.35, y, x + w * 0.5, y);
    g.fillStyle(0xe8f0f8, 0.5).fillTriangle(x + w * 0.45, y + h, x + w * 0.62, y, x + w * 0.7, y);
    // An arrow up: what falls on it goes back up.
    g.fillStyle(0x304050, 1).fillTriangle(x + w * 0.82, y + 5, x + w * 0.74, y + h - 6, x + w * 0.9, y + h - 6);
    if (p.hp < 2) cracks(g, x, y, w, h, 1);
  } else if (p.kind === 'prism') {
    g.fillStyle(0xd8e8f0, 0.85).fillRect(x, y, w, h);
    const bands = [0xe84040, 0xf0a030, 0xf0e050, 0x50c060, 0x4080e0, 0x8050c0];
    bands.forEach((c, i) => g.fillStyle(c, 0.9).fillRect(x + w * 0.5 + i * 3, y + 4 + i * 2.6, w * 0.42 - i * 3, 2.6));
    g.fillStyle(0xffffff, 1).fillTriangle(x + w * 0.12, y + h - 4, x + w * 0.42, y + h - 4, x + w * 0.27, y + 4);
    g.lineStyle(1.5, 0x8090a0, 1).strokeTriangle(x + w * 0.12, y + h - 4, x + w * 0.42, y + h - 4, x + w * 0.27, y + 4);
  } else {
    g.fillStyle(0x5a3a1a, 1).fillRect(x, y, w, h);
    const cx = x + w / 2;
    g.fillStyle(0xe0a840, 1);
    g.fillCircle(cx, y + h * 0.38, h * 0.22);
    g.fillRect(cx - h * 0.22, y + h * 0.38, h * 0.44, h * 0.28);
    g.fillRect(cx - h * 0.32, y + h * 0.62, h * 0.64, h * 0.1);
    g.fillCircle(cx, y + h * 0.8, h * 0.08);
  }
  g.lineStyle(4, C.lead, 1).strokeRect(x, y, w, h);
}

/** A guardian of a rose window: a horned, winged gargoyle or a round stone owl, cracking as it is struck. */
function drawGuardian(g: Phaser.GameObjects.Graphics, p: Pane, x: number, y: number) {
  const { w, h } = p;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const stone = 0x7a7480;
  const dark = 0x4a4450;
  if (p.kind === 'gargoyle') {
    // Wings out to the sides, a squat body, horns and glowing eyes.
    g.fillStyle(dark, 1);
    g.fillTriangle(x, y + 2, x + w * 0.32, y + h * 0.35, x + w * 0.22, y + h);
    g.fillTriangle(x + w, y + 2, x + w * 0.68, y + h * 0.35, x + w * 0.78, y + h);
    g.fillStyle(stone, 1).fillRoundedRect(x + w * 0.25, y + 3, w * 0.5, h - 3, 6);
    g.fillTriangle(cx - 10, y + 5, cx - 6, y + 5, cx - 12, y - 4);
    g.fillTriangle(cx + 10, y + 5, cx + 6, y + 5, cx + 12, y - 4);
    g.fillStyle(0xffb030, 1).fillCircle(cx - 5, cy - 2, 2.5).fillCircle(cx + 5, cy - 2, 2.5);
    g.fillStyle(dark, 1).fillRect(cx - 5, cy + 5, 10, 2);
  } else {
    // A round owl with ear tufts and big eyes, its wings folded.
    g.fillStyle(stone, 1).fillEllipse(cx, cy + 2, w * 0.86, h * 0.92);
    g.fillTriangle(x + w * 0.14, y + 6, x + w * 0.3, y + 4, x + w * 0.14, y - 3);
    g.fillTriangle(x + w * 0.86, y + 6, x + w * 0.7, y + 4, x + w * 0.86, y - 3);
    g.fillStyle(dark, 1).fillEllipse(x + w * 0.16, cy + 6, w * 0.16, h * 0.5).fillEllipse(x + w * 0.84, cy + 6, w * 0.16, h * 0.5);
    g.fillStyle(0xd8d0c0, 1).fillCircle(cx - 8, cy - 3, 7).fillCircle(cx + 8, cy - 3, 7);
    g.fillStyle(0x5ad0e0, 1).fillCircle(cx - 8, cy - 3, 3.5).fillCircle(cx + 8, cy - 3, 3.5);
    g.fillStyle(0xe0a840, 1).fillTriangle(cx - 3, cy + 3, cx + 3, cy + 3, cx, cy + 9);
  }
  cracks(g, x + w * 0.2, y, w * 0.6, h, Math.min(3, (p.kind === 'gargoyle' ? 3 : 4) - p.hp));
}

const BEAD_COLOURS: Record<BeadKind, number> = {
  wide: 0x3fd0e0,
  multi: 0xf2c45a,
  sticky: 0x5ad07a,
  fire: 0xff7a2a,
  slow: 0x8ab0ff,
  life: 0xff8ab0,
  short: 0x6a3a8a,
  fast: 0x7a2a6a,
};

/** A falling bead with its sign: arrows out (wide), three dots, a drop (sticky), a flame, a pause, a heart, arrows in, chevrons. */
export function drawBead(g: Phaser.GameObjects.Graphics, kind: BeadKind, x: number, y: number, r = 11) {
  const bad = kind === 'short' || kind === 'fast';
  g.fillStyle(BEAD_COLOURS[kind], 1).fillCircle(x, y, r);
  g.lineStyle(2, bad ? 0x2a0a2a : 0xffffff, 1).strokeCircle(x, y, r);
  const ink = bad ? 0xf0d0f0 : 0x14110c;
  const k = r / 11;
  g.fillStyle(ink, 1);
  g.lineStyle(2 * k, ink, 1);
  switch (kind) {
    case 'wide':
    case 'short': {
      const out = kind === 'wide' ? 1 : -1;
      g.lineBetween(x - 6 * k, y, x + 6 * k, y);
      for (const s of [-1, 1]) {
        const tip = x + s * (kind === 'wide' ? 7 : 2) * k;
        g.fillTriangle(tip, y, tip - s * out * 4 * k, y - 4 * k, tip - s * out * 4 * k, y + 4 * k);
      }
      break;
    }
    case 'multi':
      for (const [dx, dy] of [[-4, 3], [4, 3], [0, -4]]) g.fillCircle(x + dx * k, y + dy * k, 2.4 * k);
      break;
    case 'sticky':
      g.fillCircle(x, y + 2 * k, 4 * k);
      g.fillTriangle(x - 3.6 * k, y + 0.5 * k, x + 3.6 * k, y + 0.5 * k, x, y - 7 * k);
      break;
    case 'fire':
      g.fillTriangle(x - 5 * k, y + 5 * k, x + 5 * k, y + 5 * k, x, y - 7 * k);
      g.fillStyle(0xffe08a, 1).fillTriangle(x - 2.5 * k, y + 5 * k, x + 2.5 * k, y + 5 * k, x, y - 1 * k);
      break;
    case 'slow':
      g.fillRect(x - 4 * k, y - 5 * k, 3 * k, 10 * k);
      g.fillRect(x + 1 * k, y - 5 * k, 3 * k, 10 * k);
      break;
    case 'life':
      g.fillCircle(x - 2.5 * k, y - 1.5 * k, 3 * k);
      g.fillCircle(x + 2.5 * k, y - 1.5 * k, 3 * k);
      g.fillTriangle(x - 5.4 * k, y - 0.5 * k, x + 5.4 * k, y - 0.5 * k, x, y + 6 * k);
      break;
    case 'fast':
      for (const dx of [-3, 2]) {
        g.lineBetween(x + dx * k - 2 * k, y - 5 * k, x + dx * k + 2 * k, y);
        g.lineBetween(x + dx * k + 2 * k, y, x + dx * k - 2 * k, y + 5 * k);
      }
      break;
  }
}

/** The lantern orb with its glow, and a swirl of light round it while it carries a bar spin. */
export function drawOrb(g: Phaser.GameObjects.Graphics, x: number, y: number, fire: boolean, spin = 0) {
  if (spin) {
    const a = Math.min(1, Math.abs(spin) + 0.3);
    g.lineStyle(2, 0xfff3c8, 0.7 * a);
    const dir = Math.sign(spin);
    for (const k of [0, Math.PI]) {
      g.beginPath();
      g.arc(x, y, 12, k - dir * 0.2, k + dir * 1.4, dir < 0);
      g.strokePath();
    }
  }
  g.fillStyle(fire ? 0xff7a2a : 0xffc860, 0.18).fillCircle(x, y, 20);
  g.fillStyle(fire ? 0xff9a3a : 0xffc860, 0.35).fillCircle(x, y, 13);
  g.fillStyle(fire ? 0xffd0a0 : 0xfff3c8, 1).fillCircle(x, y, 7);
  g.fillStyle(0xffffff, 1).fillCircle(x - 2, y - 2, 2.5);
}

/** The colours of each bar glass, its panes in turn from the left. */
export const GLASS_COLOURS: Record<GlassId, number[]> = {
  brass: [C.brass],
  ruby: [0xc0263a, 0xe05060],
  sapphire: [0x1f5fbf, 0x5a90e0],
  emerald: [0x2f9a5a, 0x60c080],
  amber: [0xe0a020, 0xf4c860],
  rose: [0xc0263a, 0xe0a020, 0x1f5fbf, 0x2f9a5a, 0xb04aa8],
};

/** The glazing bar, brass or in stained glass, with a ruby in the middle and green ends while it is sticky. */
export function drawBar(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, sticky: boolean, glass: GlassId = 'brass') {
  g.fillStyle(C.brassDark, 1).fillRoundedRect(x - w / 2, y, w, h, h / 2);
  if (glass === 'brass') g.fillStyle(C.brass, 1).fillRoundedRect(x - w / 2, y, w, h * 0.6, { tl: h / 2, tr: h / 2, bl: 2, br: 2 });
  else {
    // Small panes held in lead along the bar.
    const colours = GLASS_COLOURS[glass];
    const n = Math.max(4, Math.round(w / 18));
    const pw = (w - h) / n;
    for (let i = 0; i < n; i++) g.fillStyle(colours[i % colours.length], 1).fillRect(x - w / 2 + h / 2 + i * pw, y + 2, pw, h - 4);
    g.lineStyle(1.5, C.lead, 1);
    for (let i = 1; i < n; i++) g.lineBetween(x - w / 2 + h / 2 + i * pw, y + 2, x - w / 2 + h / 2 + i * pw, y + h - 2);
  }
  g.fillStyle(0xf8e8b0, 0.7).fillRect(x - w / 2 + 8, y + 2, w - 16, 2);
  if (sticky) {
    g.fillStyle(0x5ad07a, 1).fillCircle(x - w / 2 + h / 2, y + h / 2, h / 2 - 1);
    g.fillCircle(x + w / 2 - h / 2, y + h / 2, h / 2 - 1);
  }
  g.fillStyle(C.ruby, 1).fillCircle(x, y + h / 2, 4.5);
  g.lineStyle(2, 0x3a2a10, 1).strokeRoundedRect(x - w / 2, y, w, h, h / 2);
}

/** A map node's little window: the chapel's colours when restored. */
export function drawNodeGlass(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, chapel: number, lit: boolean) {
  const colours = [
    [0xe8885a, 0xf4c070, 0x6a4a9a, 0x3f9a5a],
    [0x1f5fbf, 0x8ac0e8, 0xf4ead0, 0x2a70c8],
    [0x2f8a4a, 0xd8702a, 0x7ab060, 0x1f6a3a],
    [0x161a4a, 0xf0e0a0, 0x2a3070, 0xf4ead0],
    [0xf2c45a, 0xc0263a, 0xe0a020, 0x1f5fbf],
  ][chapel % 5];
  for (let i = 0; i < 4; i++) {
    const a0 = (i / 4) * Math.PI * 2 - Math.PI / 4;
    const a1 = ((i + 1) / 4) * Math.PI * 2 - Math.PI / 4;
    g.fillStyle(lit ? colours[i] : shade(colours[i], 0.22), 1);
    g.slice(x, y, r, a0, a1, false);
    g.fillPath();
  }
  g.lineStyle(2, C.lead, 1);
  g.lineBetween(x - r * 0.7, y - r * 0.7, x + r * 0.7, y + r * 0.7);
  g.lineBetween(x - r * 0.7, y + r * 0.7, x + r * 0.7, y - r * 0.7);
}
