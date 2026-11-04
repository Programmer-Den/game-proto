import Phaser from 'phaser';
import { CRATES, CRATE_KINDS, DRUM, HUD_HEIGHT, REACH_Y, SUPPLY_KINDS, VIEW, type CrateKind, type SupplyKind } from '../game/rules';
import { t } from '../i18n';
import { FIELD, GEOM, TAU, bake, circle, lit, path, rng, tex, type Ctx, type Pt } from './paint';
import { ACID_COLOR, BUS_COLOR, COMIC, CRATE_COLORS } from './theme';

// Deadline as a pulp horror comic: inked outlines, flat colours, halftone dots on the side away
// from the light (top left), and lettered sound effects. Every texture is painted on a canvas.

const INK = COMIC.ink;
const FONT = COMIC.canvasFont;
const key = (name: string) => tex('comic', name);

/** Halftone dot patterns, cached by colour, spacing and dot size. */
const patterns = new Map<string, HTMLCanvasElement>();
// Painted at 8x so the dots stay round in the textures (up to 6x on a 4K screen) and on the page around the game.
const DOTS_RES = 8;

export function dots(ctx: Ctx, color: string, sp = 3.2, r = 1.05) {
  const id = `${color}|${sp}|${r}`;
  let c = patterns.get(id);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = Math.round(sp * 2 * DOTS_RES);
    const g = c.getContext('2d')!;
    g.scale(DOTS_RES, DOTS_RES);
    g.fillStyle = color;
    for (const [x, y] of [[sp / 2, sp / 2], [sp * 1.5, sp * 1.5]]) {
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
    patterns.set(id, c);
  }
  const p = ctx.createPattern(c, 'repeat')!;
  p.setTransform(new DOMMatrix().scale(1 / DOTS_RES));
  return p;
}

type Shape = () => void;
const P = (ctx: Ctx, pts: Pt[]): Shape => () => path(ctx, pts);
const E = (ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): Shape => () => {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rot, 0, TAU);
};
const R = (ctx: Ctx, x: number, y: number, w: number, h: number, r = 2): Shape => () => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};

/** A flat fill, halftone dots on the side away from the light, and an ink outline. */
export function ink(ctx: Ctx, shape: Shape, color: string, o: { sh?: number; lw?: number; sp?: number; dr?: number } = {}) {
  shape();
  ctx.fillStyle = color;
  ctx.fill();
  const sh = o.sh ?? 3.2;
  if (sh) {
    ctx.save();
    shape();
    ctx.clip();
    ctx.fillStyle = dots(ctx, lit(color, -0.55), o.sp ?? 3.2, o.dr ?? 1.05);
    ctx.fillRect(-300, -300, 1200, 1600);
    ctx.translate(-sh, -sh);
    shape();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }
  if (o.lw !== 0) {
    shape();
    ctx.strokeStyle = INK;
    ctx.lineWidth = o.lw ?? 1.6;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }
}

/** A limb: an inked line with a coloured core. */
function limb(ctx: Ctx, pts: Pt[], w: number, color: string) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = INK;
  ctx.lineWidth = w + 3;
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.stroke();
}

/** A spiky comic burst, the jag lengths from a seeded random. */
export function burst(ctx: Ctx, x: number, y: number, r0: number, r1: number, n: number, fill: string, o: { rot?: number; sx?: number; lw?: number; seed?: number } = {}) {
  const rnd = rng(o.seed ?? 7);
  const pts: Pt[] = [];
  for (let i = 0; i < n * 2; i++) {
    const t = (i / (n * 2)) * TAU + (o.rot ?? 0);
    const r = i % 2 ? r0 * (0.9 + rnd() * 0.2) : r1 * (0.85 + rnd() * 0.3);
    pts.push([x + Math.cos(t) * r * (o.sx ?? 1), y + Math.sin(t) * r]);
  }
  path(ctx, pts);
  ctx.fillStyle = fill;
  ctx.fill();
  if ((o.lw ?? 2) > 0) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = o.lw ?? 2;
    ctx.stroke();
  }
}

/** Comic lettering: a heavy italic word with an ink outline and a dropped ink shadow. */
export function letter(ctx: Ctx, s: string, x: number, y: number, size: number, color: string, o: { rot?: number; sw?: number } = {}) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.rot ?? 0);
  ctx.font = `italic 900 ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.fillStyle = INK;
  ctx.fillText(s, 3, 3);
  ctx.strokeStyle = INK;
  ctx.lineWidth = o.sw ?? size * 0.22;
  ctx.strokeText(s, 0, 0);
  ctx.fillStyle = color;
  ctx.fillText(s, 0, 0);
  ctx.restore();
}

/** A shadow under a figure, in dark halftone dots. */
function shadowBlob(ctx: Ctx, x: number, y: number, rx: number) {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(x + 3, y, rx, rx * 0.32, 0, 0, TAU);
  ctx.clip();
  ctx.fillStyle = dots(ctx, 'rgba(10,8,20,0.85)', 3, 1.1);
  ctx.fillRect(x - rx - 10, y - 20, rx * 2 + 30, 40);
  ctx.restore();
}

/** Zombie eyes: yellow with a soft glow and a pin-prick pupil. */
function eyes(ctx: Ctx, x: number, y: number, d: number, r = 1.8) {
  ctx.save();
  ctx.shadowColor = '#ffdf3a';
  ctx.shadowBlur = 4;
  circle(ctx, x - d, y, r, '#fff26a');
  circle(ctx, x + d, y, r, '#fff26a');
  ctx.restore();
  circle(ctx, x - d, y, 0.8, INK);
  circle(ctx, x + d, y, 0.8, INK);
}

function soldier(ctx: Ctx, hero: boolean) {
  const rx = 0, y = 0, bx = rx - 10;
  const jacket = hero ? '#5e8a3a' : '#b89a62', helm = hero ? '#46682c' : '#a08654';
  shadowBlob(ctx, bx, y + 21, 15);
  limb(ctx, [[bx - 5, y + 9], [bx - 6, y + 20]], 3.6, '#2a2430');
  limb(ctx, [[bx + 5, y + 9], [bx + 6, y + 20]], 3.6, '#2a2430');
  ink(ctx, E(ctx, bx, y + 3, 12.5, 11), jacket, { sh: 2.5 });
  ink(ctx, R(ctx, bx - 7, y - 2, 14, 13, 2), '#7a5430', { sh: 2 });
  limb(ctx, [[bx - 7, y + 5], [bx + 7, y + 5]], 0.8, '#4e3520');
  limb(ctx, [[bx + 9, y - 2], [rx - 1, y - 8]], 3.2, jacket);
  ink(ctx, P(ctx, [[rx - 2.4, y + 6], [rx + 2.4, y + 6], [rx + 2, y - 28], [rx - 2, y - 28]]), '#3a3640', { sh: 0, lw: 1.3 });
  ink(ctx, R(ctx, rx - 3.4, y - 6, 6.8, 8, 1), '#6a4a30', { sh: 0, lw: 1.1 });
  ink(ctx, E(ctx, bx, y - 8, 9.5, 8.5), helm, { sh: 2.5 });
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(bx - 2, y - 10, 5, Math.PI * 1.05, Math.PI * 1.45);
  ctx.stroke();
  // The hero wears a yellow sergeant's chevron over the helmet, so they stand out in the squad.
  if (hero) ink(ctx, P(ctx, [[bx - 6, y - 27], [bx, y - 22], [bx + 6, y - 27], [bx + 6, y - 23], [bx, y - 18], [bx - 6, y - 23]]), '#ffd23f', { sh: 0, lw: 1.2 });
}

function walker(ctx: Ctx, run: boolean) {
  const sc = run ? 0.88 : 1;
  const skin = run ? '#d8cc6a' : '#8cc04e', shirt = run ? '#3a6a9a' : '#a0784e', pants = run ? '#2e2e4a' : '#46466a';
  ctx.save();
  ctx.scale(sc, sc);
  shadowBlob(ctx, 0, 20, 13);
  if (run) {
    // Speed lines behind a runner.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    for (const k of [-6, 0, 6]) {
      ctx.beginPath();
      ctx.moveTo(k, -24);
      ctx.lineTo(k, -34);
      ctx.stroke();
    }
  }
  limb(ctx, [[-4, 7], [-6, 19]], 3.5, pants);
  limb(ctx, [[4, 7], [run ? 8 : 5, 18]], 3.5, pants);
  ink(ctx, E(ctx, 0, 2, 10.5, 9.5), shirt, { sh: 2.5 });
  ink(ctx, P(ctx, [[1, -2], [8, 2], [4, 9], [2, 4]]), '#9a2a3a', { sh: 0, lw: 1 });
  if (run) {
    limb(ctx, [[-8, -2], [-14, 7]], 3.4, skin);
    limb(ctx, [[8, -2], [12, -10]], 3.4, skin);
  } else {
    limb(ctx, [[-9, -3], [-11, 11]], 3.8, skin);
    limb(ctx, [[9, -3], [12, 9]], 3.8, skin);
  }
  ink(ctx, E(ctx, 0, -10, 8.5, 8), skin, { sh: 2.2 });
  eyes(ctx, 0, -10.5, 3);
  limb(ctx, [[-5.5, -14.5], [-1.2, -12.6]], 0.9, INK);
  limb(ctx, [[5.5, -14.5], [1.2, -12.6]], 0.9, INK);
  ink(ctx, P(ctx, [[-3.6, -6.4], [3.6, -6.4], [2.6, -3], [-2.6, -3]]), '#3a0e0e', { sh: 0, lw: 0.9 });
  ctx.fillStyle = '#f4ecd8';
  for (const k of [-2.2, -0.2, 1.8]) ctx.fillRect(k, -6.2, 1, 1.3);
  ctx.restore();
}

function brute(ctx: Ctx, body: string, limbs: string, boss: boolean) {
  const x = 0, y = 0;
  shadowBlob(ctx, x, y + 25, 24);
  limb(ctx, [[x - 9, y + 10], [x - 10, y + 26]], 6, '#4a3a2c');
  limb(ctx, [[x + 9, y + 10], [x + 10, y + 26]], 6, '#4a3a2c');
  ink(ctx, E(ctx, x, y + 4, 21, 16), body);
  ink(ctx, P(ctx, [[x - 14, y + 11], [x + 14, y + 11], [x + 12, y + 19], [x + 4, y + 16], [x - 3, y + 20], [x - 12, y + 18]]), '#6a4630', { sh: 1.5 });
  limb(ctx, [[x - 17, y - 3], [x - 23, y + 18]], 7, limbs);
  limb(ctx, [[x + 17, y - 3], [x + 23, y + 18]], 7, limbs);
  ink(ctx, E(ctx, x - 23, y + 21, 6, 5), limbs, { sh: 1.5 });
  ink(ctx, E(ctx, x + 23, y + 21, 6, 5), limbs, { sh: 1.5 });
  if (boss) {
    // Bone spikes along the shoulders and a stitched scar across the belly.
    for (const [sx, sy, a] of [[-15, -8, -2.3], [-8, -13, -1.9], [8, -13, -1.2], [15, -8, -0.8]] as const) {
      const tip: Pt = [sx + Math.cos(a) * 9, sy + Math.sin(a) * 9];
      ink(ctx, P(ctx, [[sx - 2.5, sy + 1], tip, [sx + 2.5, sy + 1]]), '#efe4c8', { sh: 0, lw: 1 });
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 2);
    ctx.lineTo(x + 9, y + 6);
    for (let i = 0; i < 5; i++) {
      const sx = x - 8 + i * 4, sy = y + 2.5 + i * 0.8;
      ctx.moveTo(sx, sy - 2);
      ctx.lineTo(sx + 1, sy + 2);
    }
    ctx.stroke();
  }
  ink(ctx, E(ctx, x, y - 11, 9, 8.5), limbs, { sh: 2 });
  limb(ctx, [[x - 6, y - 15], [x - 1, y - 13]], 1.2, INK);
  limb(ctx, [[x + 6, y - 15], [x + 1, y - 13]], 1.2, INK);
  eyes(ctx, x, y - 11, 3.4);
  ink(ctx, P(ctx, [[x - 4, y - 6], [x + 4, y - 6], [x + 3, y - 3], [x - 3, y - 3]]), '#2b1a14', { sh: 0, lw: 1 });
}

/** The Brood Mother: a boss with a swollen, translucent egg sac for a belly, crawlers curled up inside. */
function brood(ctx: Ctx) {
  brute(ctx, '#6a3a5a', '#8a5070', false);
  ink(ctx, E(ctx, 0, 6, 17, 12), '#e8a8c8', { sh: 3, lw: 1.6 });
  // Eggs showing through the sac, each with a pair of tiny eyes.
  for (const [ex, ey] of [[-8, 3], [2, 9], [10, 2], [-3, -2], [7, 11]] as const) {
    ink(ctx, E(ctx, ex, ey, 4.2, 3.6), '#f8d8e8', { sh: 0, lw: 1 });
    circle(ctx, ex - 1.4, ey, 0.7, INK);
    circle(ctx, ex + 1.4, ey, 0.7, INK);
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(-5, 0, 7, Math.PI * 1.1, Math.PI * 1.55);
  ctx.stroke();
}

/** The Bloater: a boss bloated with acid, its belly a drum of green with drips down its legs. */
function bloater(ctx: Ctx) {
  brute(ctx, '#7a8a3a', '#98a850', false);
  ink(ctx, E(ctx, 0, 7, 19, 14), ACID_COLOR, { sh: 3.5, lw: 1.8 });
  ink(ctx, E(ctx, -6, 2, 5, 3.5), '#e4ff9a', { sh: 0, lw: 1 });
  // Stretched skin: a few taut lines, and acid dripping from the seams.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const k of [-10, 0, 10]) {
    ctx.moveTo(k, -4);
    ctx.lineTo(k + 2, 18);
  }
  ctx.stroke();
  for (const [dx, dy] of [[-14, 20], [12, 22], [2, 24]] as const) ink(ctx, E(ctx, dx, dy, 2, 3.2), ACID_COLOR, { sh: 0, lw: 0.9 });
}

/** A survivor: an unbitten civilian in a torn shirt, both arms up and waving at the squad. */
function survivor(ctx: Ctx) {
  const skin = '#e8b890', shirt = '#e8e0d0', pants = '#4a5a7a';
  shadowBlob(ctx, 0, 20, 13);
  limb(ctx, [[-4, 7], [-6, 19]], 3.5, pants);
  limb(ctx, [[4, 7], [6, 19]], 3.5, pants);
  ink(ctx, E(ctx, 0, 2, 10, 9.5), shirt, { sh: 2.5 });
  limb(ctx, [[-8, -3], [-13, -14]], 3.6, skin);
  limb(ctx, [[8, -3], [13, -15]], 3.6, skin);
  ink(ctx, E(ctx, 0, -11, 8, 7.8), skin, { sh: 2.2 });
  ink(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(0, -13, 8.5, 6, 0, Math.PI, TAU);
    ctx.closePath();
  }, '#5a3a24', { sh: 1.5, lw: 1.2 });
  circle(ctx, -2.8, -10.5, 1, INK);
  circle(ctx, 2.8, -10.5, 1, INK);
  ink(ctx, E(ctx, 0, -6.5, 2.4, 1.6), '#9a3a3a', { sh: 0, lw: 0.8 });
}

function crate(ctx: Ctx, kind: CrateKind) {
  const x = 0, y = 0, col = CRATE_COLORS[kind];
  shadowBlob(ctx, x + 2, y + 23, 24);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x - 19, y - 20);
  ctx.lineTo(x - 7, y - 42);
  ctx.moveTo(x + 19, y - 20);
  ctx.lineTo(x + 7, y - 42);
  ctx.stroke();
  ink(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(x, y - 42, 18, 9, 0, Math.PI, TAU);
    ctx.closePath();
  }, '#f1e8d2', { sh: 2 });
  ink(ctx, R(ctx, x - 21, y - 20, 42, 40, 2), '#c0884a', { sh: 3 });
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  for (const py of [y - 9, y + 10]) {
    ctx.beginPath();
    ctx.moveTo(x - 21, py);
    ctx.lineTo(x + 21, py);
    ctx.stroke();
  }
  // The upgrade's colour as a painted band round the crate (never a cross).
  ink(ctx, R(ctx, x - 21, y + 1, 42, 7, 0), col, { sh: 0, lw: 1.2 });
  // The white plate the hits-left number is lettered on.
  ink(ctx, R(ctx, x - 13, y - 18, 26, 15, 3), '#fff8e8', { sh: 0, lw: 1.4 });
}

function crateLabel(ctx: Ctx, kind: CrateKind) {
  const label = t(CRATES[kind].label).toUpperCase();
  ctx.font = `italic 900 10px ${FONT}`;
  const w = ctx.measureText(label).width + 22;
  ctx.save();
  ctx.translate(0, 11);
  ctx.rotate(-0.03);
  ctx.fillStyle = INK;
  ctx.fillRect(-w / 2 + 2, -7, w, 16);
  ink(ctx, R(ctx, -w / 2, -9, w, 16, 0), '#fff8e8', { sh: 0, lw: 1.4 });
  ink(ctx, R(ctx, -w / 2 + 5, -4.5, 7, 7, 0), CRATE_COLORS[kind], { sh: 0, lw: 1 });
  ctx.fillStyle = INK;
  ctx.textBaseline = 'middle';
  ctx.fillText(label, -w / 2 + 16, -0.5);
  ctx.restore();
}

function drum(ctx: Ctx) {
  const x = 0, y = 0;
  shadowBlob(ctx, x, y + 15, 15);
  ink(ctx, R(ctx, x - 12, y - 12, 24, 25, 3), '#ffcf3a', { sh: 3 });
  // Hazard stripes.
  ctx.fillStyle = INK;
  for (let k = -10; k < 12; k += 6) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 12, y - 1, 24, 5);
    ctx.clip();
    path(ctx, [[x + k, y - 1], [x + k + 3, y - 1], [x + k - 2, y + 4], [x + k - 5, y + 4]]);
    ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.strokeRect(x - 12, y - 1, 24, 5);
  ink(ctx, E(ctx, x, y - 12, 12, 4.5), '#ffe27a', { sh: 0, lw: 1.4 });
  circle(ctx, x + 4, y - 12, 1.5, INK);
  // A flame mark: this one goes bang.
  ink(ctx, P(ctx, [[x - 3, y + 11], [x + 3, y + 11], [x + 3.5, y + 8], [x + 1, y + 9], [x, y + 5.5], [x - 1.5, y + 8.5], [x - 3.5, y + 7]]), '#e8402a', { sh: 0, lw: 0.8 });
}

/** The escort towns' bus from above, driving up the road: yellow, roof hatches, lit headlamps at the front. */
function bus(ctx: Ctx) {
  ctx.fillStyle = 'rgba(10,8,20,0.45)';
  ctx.fillRect(-22, -52, 52, 112);
  for (const wy of [-34, 36]) for (const wx of [-28, 24]) ink(ctx, R(ctx, wx, wy - 8, 4, 16, 1), INK, { sh: 0, lw: 1 });
  ink(ctx, R(ctx, -25, -57, 50, 114, 7), BUS_COLOR, { sh: 3.2 });
  // The windscreen at the front, the dark strips of the side windows and a black bumper at the back.
  ink(ctx, R(ctx, -19, -53, 38, 12, 3), '#8ad0f0', { sh: 0, lw: 1.4 });
  ink(ctx, R(ctx, -23, -37, 5, 86, 1), '#3a3448', { sh: 0, lw: 1 });
  ink(ctx, R(ctx, 18, -37, 5, 86, 1), '#3a3448', { sh: 0, lw: 1 });
  ink(ctx, R(ctx, -22, 50, 44, 5, 1), INK, { sh: 0, lw: 1 });
  for (const hy of [-24, 4, 30]) ink(ctx, R(ctx, -8, hy, 16, 12, 2), '#f6efd8', { sh: 0, lw: 1.2 });
  ctx.fillStyle = INK;
  ctx.fillRect(-12, -2, 24, 3);
  circle(ctx, -17, -56, 3.2, '#fff8c0', INK, 1.2);
  circle(ctx, 17, -56, 3.2, '#fff8c0', INK, 1.2);
}

/** A spitter: a hunched walker with a swollen acid sac under its jaw, drooling green. */
function spitter(ctx: Ctx) {
  const skin = '#a8b84a', shirt = '#6a5a7a', pants = '#3e3a52';
  shadowBlob(ctx, 0, 20, 13);
  limb(ctx, [[-4, 7], [-6, 19]], 3.5, pants);
  limb(ctx, [[4, 7], [5, 18]], 3.5, pants);
  ink(ctx, E(ctx, 0, 3, 11, 9.5), shirt, { sh: 2.5 });
  limb(ctx, [[-9, -2], [-12, 8]], 3.6, skin);
  limb(ctx, [[9, -2], [12, 8]], 3.6, skin);
  ink(ctx, E(ctx, 0, -12, 8, 7.5), skin, { sh: 2.2 });
  // The sac bulges out under the jaw, lit acid green with a highlight.
  ink(ctx, E(ctx, 0, -3, 8.5, 6.5), ACID_COLOR, { sh: 2, lw: 1.4 });
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(-2, -4.5, 3.5, Math.PI * 1.1, Math.PI * 1.6);
  ctx.stroke();
  eyes(ctx, 0, -13, 3);
  limb(ctx, [[-5, -17], [-1.2, -15]], 0.9, INK);
  limb(ctx, [[5, -17], [1.2, -15]], 0.9, INK);
  // Drips of acid.
  for (const [dx, dy] of [[-5, 4], [4, 6]]) ink(ctx, E(ctx, dx, dy, 1.6, 2.6), ACID_COLOR, { sh: 0, lw: 0.9 });
}

/** A riot zombie in a helmet and padded vest, behind a big shield (or without it, once it broke). */
function riot(ctx: Ctx, shield: boolean) {
  const skin = '#8cb04e', armour = '#3a4a6e', pads = '#4e5e86';
  shadowBlob(ctx, 0, 22, 15);
  limb(ctx, [[-5, 8], [-6, 21]], 4, '#2a2a3c');
  limb(ctx, [[5, 8], [6, 21]], 4, '#2a2a3c');
  ink(ctx, E(ctx, 0, 2, 13, 11), armour, { sh: 2.5 });
  ink(ctx, E(ctx, -11, -3, 5, 4), pads, { sh: 1.5 });
  ink(ctx, E(ctx, 11, -3, 5, 4), pads, { sh: 1.5 });
  if (!shield) {
    limb(ctx, [[-11, -1], [-14, 12]], 4, skin);
    limb(ctx, [[11, -1], [13, 11]], 4, skin);
  }
  ink(ctx, E(ctx, 0, -11, 8.5, 8), skin, { sh: 2.2 });
  eyes(ctx, 0, -11, 3);
  // A helmet with a raised visor.
  ink(ctx, () => {
    ctx.beginPath();
    ctx.ellipse(0, -13, 10, 8, 0, Math.PI, TAU);
    ctx.closePath();
  }, '#2e3a5a', { sh: 2 });
  ink(ctx, R(ctx, -9, -21, 18, 4, 2), '#9ab8d8', { sh: 0, lw: 1.1 });
  if (shield) {
    // The shield, held in front: clear plastic with a viewport and a dent or two.
    ink(ctx, R(ctx, -19, 0, 38, 24, 4), '#b8d0e4', { sh: 2.5, lw: 1.8 });
    ink(ctx, R(ctx, -11, 3, 22, 6, 2), '#5a7a9a', { sh: 0, lw: 1.1 });
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(8, 13);
    ctx.lineTo(12, 17);
    ctx.lineTo(10, 20);
    ctx.moveTo(-12, 15);
    ctx.lineTo(-8, 18);
    ctx.stroke();
    for (const rx of [-15, 15]) circle(ctx, rx, 20, 1.2, INK);
  } else {
    // What's left of the shield: a bent handle and a crack across the vest.
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-1, 5);
    ctx.lineTo(-4, 9);
    ctx.stroke();
  }
}

/** A crawler: a legless zombie dragging itself along on its arms, small and low. */
function crawler(ctx: Ctx) {
  const skin = '#9ab84e', rag = '#7a5a4a';
  shadowBlob(ctx, 0, 12, 12);
  ink(ctx, E(ctx, 0, -5, 9, 7.5), rag, { sh: 2 });
  limb(ctx, [[-7, -2], [-12, 6], [-9, 12]], 3.2, skin);
  limb(ctx, [[7, -2], [12, 4], [10, 11]], 3.2, skin);
  ink(ctx, E(ctx, 0, 4, 6.5, 6), skin, { sh: 1.8 });
  eyes(ctx, 0, 4, 2.4, 1.5);
  ink(ctx, P(ctx, [[-2.5, 7.5], [2.5, 7.5], [1.8, 9.5], [-1.8, 9.5]]), '#3a0e0e', { sh: 0, lw: 0.8 });
  // A torn trail behind it.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-3, -12);
  ctx.lineTo(-4, -17);
  ctx.moveTo(3, -12);
  ctx.lineTo(4, -16);
  ctx.stroke();
}

/** An acid puddle: a lumpy green pool with halftone and bubbles, painted for a radius of 78. */
function acid(ctx: Ctx) {
  const rnd = rng(41);
  const pts: Pt[] = [];
  for (let i = 0; i < 18; i++) {
    const t = (i / 18) * TAU, r = 78 * (0.86 + rnd() * 0.14);
    pts.push([Math.cos(t) * r, Math.sin(t) * r * 0.36]);
  }
  ink(ctx, P(ctx, pts), ACID_COLOR, { sh: 4, lw: 2.2, sp: 5, dr: 1.6 });
  for (let k = 0; k < 7; k++) {
    const bx = (rnd() - 0.5) * 110, by = (rnd() - 0.5) * 30;
    circle(ctx, bx, by, 2.5 + rnd() * 3, '#e4ff9a', INK, 1.2);
  }
}

function glob(ctx: Ctx) {
  ink(ctx, E(ctx, 0, 1, 6.5, 7.5), ACID_COLOR, { sh: 1.5, lw: 1.4 });
  ink(ctx, E(ctx, -1, -7, 2.5, 3), ACID_COLOR, { sh: 0, lw: 1 });
  circle(ctx, -2, -1, 1.6, '#f4ffc8');
}

/** A short sandbag wall, two rows high. */
function wall(ctx: Ctx) {
  for (let x = -78; x <= 78; x += 26) ink(ctx, R(ctx, x - 13, -2, 26, 14, 7), '#c8ab72', { sh: 2.5, lw: 1.5 });
  for (let x = -65; x <= 65; x += 26) ink(ctx, R(ctx, x - 12, -12, 24, 12, 6), '#dcc28a', { sh: 2.5, lw: 1.5 });
}

/** The flamethrower's burst: a wall of flame tongues along the sandbags. */
function flame(ctx: Ctx) {
  const rnd = rng(19);
  for (const [col, hk, wk] of [['#e8402a', 1, 1], ['#ff8a2a', 0.78, 0.8], ['#ffe24a', 0.5, 0.55]] as const) {
    for (let x = -260; x <= 260; x += 36) {
      const h = (110 + rnd() * 60) * hk, w = 30 * wk, lean = (rnd() - 0.5) * 20;
      ink(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(x - w, 0);
        ctx.quadraticCurveTo(x - w * 0.9, -h * 0.5, x + lean, -h);
        ctx.quadraticCurveTo(x + w * 0.9, -h * 0.5, x + w, 0);
        ctx.closePath();
      }, col, { sh: 0, lw: col === '#e8402a' ? 2.2 : 0 });
    }
  }
}

/** The extraction card's icon: a signal flare burning red over a drift of smoke. */
function extractIcon(ctx: Ctx) {
  for (const [sx, sy, r] of [[-16, 14, 9], [-4, 20, 7], [8, 15, 8]] as const) ink(ctx, E(ctx, sx, sy, r, r * 0.8), '#b8b0c8', { sh: 2 });
  limb(ctx, [[0, 18], [0, -4]], 4, '#5a5a6a');
  burst(ctx, 0, -14, 10, 20, 9, '#e8402a', { lw: 1.8, seed: 3 });
  burst(ctx, 0, -14, 5, 10, 7, '#ffe24a', { lw: 0, seed: 6 });
}

/** The supply drop's pick icons. */
function supplyIcon(ctx: Ctx, kind: SupplyKind) {
  if (kind === 'shotgun') {
    // Three shells fanned out.
    for (const a of [-0.45, 0, 0.45]) {
      ctx.save();
      ctx.rotate(a);
      ink(ctx, R(ctx, -6, -26, 12, 28, 2), '#e0702a', { sh: 2 });
      ink(ctx, R(ctx, -6.5, 2, 13, 9, 1), '#e8c050', { sh: 1.5 });
      ctx.restore();
    }
  } else if (kind === 'flamer') {
    burst(ctx, 8, -12, 9, 18, 8, '#ffe24a', { lw: 1.6, seed: 5 });
    ink(ctx, R(ctx, -20, -6, 16, 30, 6), '#c03a1a', { sh: 2.5 });
    ink(ctx, R(ctx, -16, -12, 8, 6, 1), '#5a5a6a', { sh: 0, lw: 1.2 });
    limb(ctx, [[-4, 10], [6, 4], [8, -4]], 3.4, '#5a5a6a');
  } else if (kind === 'medkit') {
    // A first-aid box with a green cross (never a red one).
    ink(ctx, R(ctx, -24, -16, 48, 34, 4), '#f4ecd8', { sh: 3 });
    ink(ctx, R(ctx, -8, -24, 16, 9, 3), '#b0a890', { sh: 0, lw: 1.4 });
    ink(ctx, P(ctx, [[-4, -11], [4, -11], [4, -3], [12, -3], [12, 5], [4, 5], [4, 13], [-4, 13], [-4, 5], [-12, 5], [-12, -3], [-4, -3]]), '#4ac05a', { sh: 0, lw: 1.4 });
  } else {
    for (const [x, y] of [[-14, 10], [14, 10], [0, -4]]) ink(ctx, R(ctx, x - 14, y - 7, 28, 15, 7), y < 0 ? '#dcc28a' : '#c8ab72', { sh: 2.5, lw: 1.5 });
  }
}

function ground(ctx: Ctx) {
  const rnd = rng(5);
  // Painted over the whole view (`FIELD`): wider shoulders round the road on a wider screen, and
  // more road behind the squad on a taller one.
  const W = VIEW.w, H = FIELD.h, left = FIELD.x, right = FIELD.x + FIELD.w, roadL = 57, roadR = 483;
  ctx.fillStyle = '#3b3f62';
  ctx.fillRect(left, 0, right - left, H);
  // Shoulders: olive grass with ink hatching and tufts.
  for (const [x0, x1] of [[left, roadL], [roadR, right]]) {
    ctx.fillStyle = '#5a6a36';
    ctx.fillRect(x0, 0, x1 - x0, H);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, 0, x1 - x0, H);
    ctx.clip();
    ctx.strokeStyle = 'rgba(21,18,26,0.55)';
    ctx.lineWidth = 1;
    for (let y = -40 - (x1 - x0) * 0.5; y < H + 40; y += 7) {
      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y + (x1 - x0) * 0.5);
      ctx.stroke();
    }
    for (let i = 0, n = Math.round((26 * (x1 - x0) * H) / (57 * VIEW.h)); i < n; i++) {
      const tx = x0 + 6 + rnd() * (x1 - x0 - 12), ty = rnd() * H;
      path(ctx, [[tx - 6, ty], [tx - 3, ty - 9], [tx, ty - 2], [tx + 3, ty - 11], [tx + 6, ty]]);
      ctx.fillStyle = '#7c8c46';
      ctx.fill();
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
    ctx.restore();
  }
  // The road: a pool of headlight round the squad, halftone dots thickening into the dark.
  ctx.save();
  ctx.beginPath();
  ctx.rect(roadL, 0, roadR - roadL, H);
  ctx.clip();
  const g = ctx.createRadialGradient(W / 2, 900, 40, W / 2, 820, 700);
  g.addColorStop(0, '#5a5f86');
  g.addColorStop(1, '#2c2f4c');
  ctx.fillStyle = g;
  ctx.fillRect(roadL, 0, roadR - roadL, H);
  ctx.fillStyle = 'rgba(16,14,34,0.75)';
  for (let y = 0; y < H; y += 6) {
    for (let x = roadL + ((y / 6) % 2) * 3; x < roadR; x += 6) {
      const d = Math.hypot((x - W / 2) * 1.6, y - 900) / 900, r = Math.min(2.3, Math.max(0, (d - 0.15) * 2.8));
      if (r > 0.25) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();
      }
    }
  }
  // Cracks and a pothole.
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 12; i++) {
    let x = 90 + rnd() * 360, y = rnd() * 820;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (rnd() - 0.5) * 26;
      y += 6 + rnd() * 14;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ink(ctx, E(ctx, 120, 680, 22, 9), '#25263c', { sh: 0 });
  ctx.restore();
  // Curbs.
  for (const x of [roadL, roadR]) {
    ctx.fillStyle = '#d8d0b8';
    ctx.fillRect(x - 3, 0, 6, H);
    ctx.fillStyle = INK;
    ctx.fillRect(x - 4, 0, 1.4, H);
    ctx.fillRect(x + 3, 0, 1.4, H);
    for (let y = 0; y < H; y += 30) ctx.fillRect(x - 4, y, 8, 1.4);
  }
  // Lane dashes, with a gap at the sandbags.
  for (const lx of [180, 360]) {
    for (let y = -20; y < H; y += 80) {
      if (y > REACH_Y - 12 && y < REACH_Y + 28) continue;
      ink(ctx, R(ctx, lx - 3, y, 6, 40, 1), '#ffd23f', { sh: 0, lw: 1.3 });
    }
  }
}

function sandbags(ctx: Ctx) {
  // Across the whole view, in step with the bags at 540 wide.
  const from = 28 * Math.floor(FIELD.x / 28), to = FIELD.x + FIELD.w + 14;
  for (let x = from + 12; x < to; x += 28) ink(ctx, R(ctx, x - 13, 0, 26, 14, 7), '#c8ab72', { sh: 2.5, lw: 1.5 });
  for (let x = from - 2; x < to; x += 28) ink(ctx, R(ctx, x - 12, -9, 24, 12, 6), '#dcc28a', { sh: 2.5, lw: 1.5 });
}

function splat(ctx: Ctx) {
  const rnd = rng(23);
  const pts: Pt[] = [];
  for (let i = 0; i < 12; i++) {
    const t = (i / 12) * TAU, r = (i % 2 ? 8 : 14) * (0.8 + rnd() * 0.5);
    pts.push([Math.cos(t) * r, Math.sin(t) * r * 0.6]);
  }
  ink(ctx, P(ctx, pts), '#6a9a2a', { sh: 2, lw: 1.2 });
  for (let k = 0; k < 3; k++) ink(ctx, E(ctx, (rnd() - 0.5) * 34, (rnd() - 0.5) * 18, 2.5, 2), '#6a9a2a', { sh: 0, lw: 1 });
}

function bullet(ctx: Ctx) {
  ctx.strokeStyle = 'rgba(255,240,180,0.85)';
  ctx.lineWidth = 0.9;
  for (const k of [-3.5, 3.5]) {
    ctx.beginPath();
    ctx.moveTo(k, 6);
    ctx.lineTo(k, 22);
    ctx.stroke();
  }
  ink(ctx, R(ctx, -2.4, -4, 4.8, 12, 2.4), '#ffe24a', { sh: 0, lw: 1.2 });
}

function blast(ctx: Ctx) {
  burst(ctx, 0, 0, 60, 104, 14, '#ff8a2a', { lw: 4, seed: 3 });
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 100, 0, TAU);
  ctx.clip();
  ctx.fillStyle = dots(ctx, 'rgba(160,40,10,0.55)', 6, 2);
  ctx.fillRect(-110, -110, 220, 220);
  ctx.restore();
  burst(ctx, 0, 0, 40, 70, 12, '#ffe24a', { lw: 3, seed: 9, rot: 0.2 });
  burst(ctx, 0, 0, 20, 36, 9, '#fff8e8', { lw: 0, seed: 4 });
}

/** Bakes every comic texture, under `comic-<name>` keys. */
export function bakeComic(scene: Phaser.Scene) {
  bake(scene, key('ground'), GEOM.ground, ground);
  bake(scene, key('sandbags'), GEOM.sandbags, sandbags);
  bake(scene, key('hero'), GEOM.hero, (c) => soldier(c, true));
  bake(scene, key('companion'), GEOM.companion, (c) => soldier(c, false));
  bake(scene, key('grunt'), GEOM.grunt, (c) => walker(c, false));
  bake(scene, key('runner'), GEOM.runner, (c) => walker(c, true));
  bake(scene, key('brute'), GEOM.brute, (c) => brute(c, '#8a6fa8', '#9a80b8', false));
  bake(scene, key('boss'), GEOM.boss, (c) => {
    c.scale(1.9, 1.9);
    brute(c, '#5a3a6e', '#74508a', true);
  });
  bake(scene, key('brood'), GEOM.brood, (c) => {
    c.scale(1.9, 1.9);
    brood(c);
  });
  bake(scene, key('bloater'), GEOM.bloater, (c) => {
    c.scale(1.9, 1.9);
    bloater(c);
  });
  bake(scene, key('survivor'), GEOM.survivor, survivor);
  bake(scene, key('spitter'), GEOM.spitter, spitter);
  bake(scene, key('riot'), GEOM.riot, (c) => riot(c, true));
  bake(scene, key('riot-bare'), GEOM.riot, (c) => riot(c, false));
  bake(scene, key('crawler'), GEOM.crawler, crawler);
  bake(scene, key('acid'), GEOM.acid, acid);
  bake(scene, key('glob'), GEOM.glob, glob);
  bake(scene, key('wall'), GEOM.wall, wall);
  bake(scene, key('flame'), GEOM.flame, flame);
  for (const kind of SUPPLY_KINDS) bake(scene, key(`supply-${kind}`), GEOM.supply, (c) => supplyIcon(c, kind));
  bake(scene, key('supply-extract'), GEOM.supply, extractIcon);
  for (const kind of CRATE_KINDS) {
    bake(scene, key(`crate-${kind}`), GEOM.crate, (c) => crate(c, kind));
    bake(scene, key(`label-${kind}`), GEOM.label, (c) => crateLabel(c, kind));
  }
  bake(scene, key('drum'), GEOM.drum, drum);
  bake(scene, key('bus'), GEOM.bus, bus);
  bake(scene, key('bullet'), GEOM.bullet, bullet);
  bake(scene, key('muzzle'), GEOM.muzzle, (c) => {
    burst(c, 0, 2, 4, 10, 6, '#fff3a0', { lw: 1.2, rot: -Math.PI / 2 });
    circle(c, 0, 2, 3, '#ff9a2a');
  });
  bake(scene, key('splat'), GEOM.splat, splat);
  bake(scene, key('blast'), GEOM.blast, blast);
  bake(scene, key('streak'), GEOM.streak, (c) => {
    c.rotate(-0.1);
    burst(c, 0, 0, 22, 34, 11, '#ff8a2a', { lw: 2, sx: 1.25 });
    burst(c, 0, 0, 17, 26, 11, '#ffe24a', { lw: 0, sx: 1.25, seed: 8 });
  });
  bake(scene, key('hudbar'), GEOM.hudbar, (c) => {
    c.fillStyle = '#20223a';
    c.fillRect(FIELD.x, 0, FIELD.w, HUD_HEIGHT);
    c.fillStyle = dots(c, '#2e3150', 4, 1.3);
    c.fillRect(FIELD.x, 0, FIELD.w, HUD_HEIGHT);
    c.fillStyle = INK;
    c.fillRect(FIELD.x, HUD_HEIGHT - 3, FIELD.w, 3);
  });
  bake(scene, key('ring'), GEOM.ring, (c) => {
    // The drum's blast ring: orange halftone inside a dashed inked circle.
    const r = DRUM.blastRadius;
    c.save();
    c.beginPath();
    c.arc(0, 0, r, 0, TAU);
    c.clip();
    c.fillStyle = dots(c, 'rgba(255,150,40,0.45)', 6, 1.8);
    c.fillRect(-r, -r, r * 2, r * 2);
    c.restore();
    c.beginPath();
    c.arc(0, 0, r, 0, TAU);
    c.setLineDash([10, 6]);
    c.lineWidth = 3;
    c.strokeStyle = INK;
    c.stroke();
    c.lineWidth = 1.6;
    c.strokeStyle = '#ffb02a';
    c.stroke();
  });
  bake(scene, key('sfx-blam'), GEOM.sfx, (c) => letter(c, t('sfxBlam'), 0, 0, 26, '#ffe24a', { sw: 5 }));
  bake(scene, key('sfx-splut'), GEOM.sfx, (c) => letter(c, t('sfxSplut'), 0, 0, 16, '#8cc04e', { sw: 4 }));
  bake(scene, key('sfx-boom'), GEOM.sfx, (c) => {
    burst(c, 0, 0, 24, 40, 10, '#fff3a0', { lw: 2.5, sx: 1.7, seed: 12 });
    letter(c, t('sfxBoom'), 0, 0, 22, '#e8402a', { sw: 5 });
  });
}
