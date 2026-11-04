import Phaser from 'phaser';
import { CRATES, CRATE_KINDS, DRUM, HUD_HEIGHT, REACH_Y, SUPPLY_KINDS, VIEW, type CrateKind, type SupplyKind } from '../game/rules';
import { t } from '../i18n';
import { FIELD, GEOM, GRAIN_TILE, TAU, bake, canvas, rgba, rng, tex, type Ctx } from './paint';
import { CRATE_COLORS, NV } from './theme';

// Deadline through a night-vision camera: everything is painted in greys (how bright it shows up in
// infrared), then `phosphor` maps the greys onto the green of a phosphor screen and blooms the
// brightest parts (eyeshine, helmet strobes, tracers). Crates keep their coloured chemlights, and
// the HUD and markers are a crisp amber overlay on top. Grain and scanlines are separate textures
// laid over the whole feed by the scene.

const key = (name: string) => tex('nv', name);
const AMB = NV.accent;
const PH = NV.text;

/** A grey for a brightness 0..1. */
const g = (v: number) => {
  const c = Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${c},${c},${c})`;
};

/** A rounded body lit from the top left. */
function vol(ctx: Ctx, x: number, y: number, rx: number, ry: number, v: number, k = 0.16) {
  const gr = ctx.createRadialGradient(x - rx * 0.4, y - ry * 0.45, 0, x, y, Math.max(rx, ry) * 1.15);
  gr.addColorStop(0, g(v + k));
  gr.addColorStop(1, g(v - k));
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = gr;
  ctx.fill();
}
function limb(ctx: Ctx, a: [number, number], b: [number, number], w: number, v: number) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = g(v);
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(...a);
  ctx.lineTo(...b);
  ctx.stroke();
}
function box(ctx: Ctx, x: number, y: number, w: number, h: number, v: number, r = 2) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = g(v);
  ctx.fill();
}
function shade(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.5) {
  ctx.save();
  ctx.filter = 'blur(3px)';
  ctx.beginPath();
  ctx.ellipse(x + 4, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = `rgba(0,0,0,${a})`;
  ctx.fill();
  ctx.restore();
}
/** Eyes catching the infrared light: pure white, so they bloom. */
function eyeshine(ctx: Ctx, x: number, y: number, d: number, r = 1.6) {
  ctx.save();
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(x - d, y, r, 0, TAU);
  ctx.arc(x + d, y, r, 0, TAU);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
}

/** Black, through phosphor green, to a pale green-white. */
function ramp(v: number): [number, number, number] {
  const a = [1, 6, 3], m = [46, 160, 66], c = [220, 255, 210];
  const lerp = (p: number[], q: number[], s: number) => p.map((u, i) => u + (q[i] - u) * s) as [number, number, number];
  return v < 0.5 ? lerp(a, m, Math.pow(v / 0.5, 1.15)) : lerp(m, c, (v - 0.5) / 0.5);
}

/**
 * Turns a grey painting into the phosphor image: each pixel's grey through `ramp` (with a little
 * fixed grain), keeping its alpha, then a bloom of the brightest pixels added on top.
 */
function phosphor(c: HTMLCanvasElement, scale: number, opts: { grain?: number; bloom?: number; seed?: number } = {}) {
  const ctx = c.getContext('2d')!;
  const id = ctx.getImageData(0, 0, c.width, c.height), d = id.data;
  const glow = canvas(c.width, c.height), gctx = glow.getContext('2d')!;
  const gid = gctx.createImageData(c.width, c.height), gd = gid.data;
  const rnd = rng(opts.seed ?? 31);
  const grain = opts.grain ?? 0.05;
  let bright = false;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const v = Math.max(0, Math.min(1, d[i] / 255 + (rnd() - 0.5) * grain));
    const [r, gg, b] = ramp(v);
    d[i] = r;
    d[i + 1] = gg;
    d[i + 2] = b;
    const k = Math.max(0, (v - 0.72) / 0.28);
    if (k > 0) {
      bright = true;
      gd[i] = r;
      gd[i + 1] = gg;
      gd[i + 2] = b;
      gd[i + 3] = Math.round(255 * k * (d[i + 3] / 255));
    }
  }
  ctx.putImageData(id, 0, 0);
  if (!bright || opts.bloom === 0) return;
  gctx.putImageData(gid, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.filter = `blur(${(opts.bloom ?? 4) * scale}px)`;
  ctx.drawImage(glow, 0, 0);
  ctx.filter = `blur(${scale}px)`;
  ctx.globalAlpha = 0.6;
  ctx.drawImage(glow, 0, 0);
  ctx.restore();
}

/** Bakes a grey painting through `phosphor`, then `after` paints in colour on top (chemlights). */
function nvBake(scene: Phaser.Scene, name: string, geom: { w: number; h: number; ox: number; oy: number }, draw: (ctx: Ctx) => void, opts: { grain?: number; bloom?: number; seed?: number } = {}, after?: (ctx: Ctx) => void) {
  bake(scene, key(name), geom, draw, (c, scale) => {
    phosphor(c, scale, opts);
    if (!after) return;
    const ctx = c.getContext('2d')!;
    ctx.save();
    ctx.setTransform(scale, 0, 0, scale, geom.ox * scale, geom.oy * scale);
    after(ctx);
    ctx.restore();
  });
}

function soldier(ctx: Ctx, hero: boolean) {
  const rx = 0, y = 0, bx = rx - 10;
  shade(ctx, bx, y + 20, 15, 5);
  limb(ctx, [bx - 5, y + 9], [bx - 6, y + 20], 4.5, 0.16);
  limb(ctx, [bx + 5, y + 9], [bx + 6, y + 20], 4.5, 0.14);
  vol(ctx, bx, y + 3, 12.5, 11, hero ? 0.4 : 0.34);
  box(ctx, bx - 7, y - 2, 14, 13, 0.28);
  limb(ctx, [bx + 9, y - 2], [rx - 1, y - 8], 4, 0.34);
  ctx.fillStyle = g(0.12);
  ctx.fillRect(rx - 2.4, y - 28, 4.8, 34);
  vol(ctx, bx, y - 8, 9.5, 8.5, 0.4);
  // An infrared strobe on every helmet; the hero's is the bigger one.
  ctx.save();
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = hero ? 12 : 7;
  ctx.beginPath();
  ctx.arc(bx - 2, y - 13, hero ? 2.4 : 1.6, 0, TAU);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
}

function walker(ctx: Ctx, run: boolean) {
  const sc = run ? 0.88 : 1;
  ctx.save();
  ctx.scale(sc, sc);
  shade(ctx, 0, 19, 12, 4);
  limb(ctx, [-4, 7], [-6, 19], 4.5, 0.22);
  limb(ctx, [4, 7], [run ? 8 : 5, 18], 4.5, 0.2);
  vol(ctx, 0, 2, 10.5, 9.5, run ? 0.36 : 0.32);
  if (run) {
    limb(ctx, [-8, -2], [-14, 7], 4, 0.46);
    limb(ctx, [8, -2], [12, -10], 4, 0.42);
  } else {
    limb(ctx, [-9, -3], [-11, 11], 4.6, 0.44);
    limb(ctx, [9, -3], [12, 9], 4.6, 0.4);
  }
  vol(ctx, 0, -10, 8.5, 8, run ? 0.56 : 0.48);
  eyeshine(ctx, 0, -10.5, 3);
  ctx.restore();
}

function brute(ctx: Ctx, boss: boolean) {
  const x = 0, y = 0;
  shade(ctx, x, y + 24, 22, 6);
  limb(ctx, [x - 9, y + 10], [x - 10, y + 25], 8, 0.28);
  limb(ctx, [x + 9, y + 10], [x + 10, y + 25], 8, 0.24);
  vol(ctx, x, y + 4, 21, 16, boss ? 0.36 : 0.42);
  limb(ctx, [x - 17, y - 3], [x - 22, y + 19], 10, 0.4);
  limb(ctx, [x + 17, y - 3], [x + 22, y + 19], 10, 0.34);
  if (boss) {
    // Bone spikes catch the light along its shoulders.
    for (const [sx, sy, a] of [[-15, -8, -2.3], [-8, -13, -1.9], [8, -13, -1.2], [15, -8, -0.8]] as const) {
      ctx.beginPath();
      ctx.moveTo(sx - 2.5, sy + 1);
      ctx.lineTo(sx + Math.cos(a) * 9, sy + Math.sin(a) * 9);
      ctx.lineTo(sx + 2.5, sy + 1);
      ctx.closePath();
      ctx.fillStyle = g(0.7);
      ctx.fill();
    }
  }
  vol(ctx, x, y - 11, 9, 8.5, 0.5);
  eyeshine(ctx, x, y - 11, 3.4, 1.9);
}

/** The Brood Mother: the eggs in its belly are warm, so each one glows through the sac. */
function brood(ctx: Ctx) {
  brute(ctx, false);
  vol(ctx, 0, 6, 17, 12, 0.5, 0.1);
  ctx.save();
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 5;
  for (const [ex, ey] of [[-8, 3], [2, 9], [10, 2], [-3, -2], [7, 11]] as const) vol(ctx, ex, ey, 4, 3.4, 0.82, 0.08);
  ctx.restore();
}

/** The Bloater: a belly full of warm acid, the brightest body on the feed. */
function bloater(ctx: Ctx) {
  brute(ctx, false);
  ctx.save();
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 10;
  vol(ctx, 0, 7, 19, 14, 0.8, 0.14);
  ctx.restore();
  for (const [dx, dy] of [[-14, 20], [12, 22], [2, 24]] as const) vol(ctx, dx, dy, 2, 3.2, 0.9, 0.05);
}

/** A survivor: a warm, living body with both arms up, no eyeshine. */
function survivor(ctx: Ctx) {
  shade(ctx, 0, 19, 12, 4);
  limb(ctx, [-4, 7], [-6, 19], 4.5, 0.4);
  limb(ctx, [4, 7], [6, 19], 4.5, 0.38);
  vol(ctx, 0, 2, 10, 9.5, 0.62);
  limb(ctx, [-8, -3], [-13, -14], 4.2, 0.7);
  limb(ctx, [8, -3], [13, -15], 4.2, 0.66);
  vol(ctx, 0, -11, 8, 7.8, 0.74);
}

function crate(ctx: Ctx) {
  const x = 0, y = 0;
  shade(ctx, x + 2, y + 22, 24, 6);
  ctx.strokeStyle = g(0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 19, y - 20);
  ctx.lineTo(x - 7, y - 42);
  ctx.moveTo(x + 19, y - 20);
  ctx.lineTo(x + 7, y - 42);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y - 42, 18, 9, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.fillStyle = g(0.66);
  ctx.fill();
  box(ctx, x - 21, y - 20, 42, 40, 0.48);
  box(ctx, x - 21, y - 20, 42, 6, 0.6, 1);
  ctx.fillStyle = g(0.32);
  for (const py of [y - 7, y + 7]) ctx.fillRect(x - 21, py, 42, 1.5);
}

/** The chemlight taped to a crate, in the upgrade's colour, glowing. */
function chemlight(ctx: Ctx, kind: CrateKind) {
  const col = CRATE_COLORS[kind];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const gr = ctx.createRadialGradient(17, 3, 0, 17, 3, 22);
  gr.addColorStop(0, rgba(col, 0.75));
  gr.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = gr;
  ctx.fillRect(-10, -20, 50, 50);
  ctx.restore();
  ctx.save();
  ctx.shadowColor = col;
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.roundRect(15, -6, 4, 18, 2);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.restore();
  // Amber corner brackets round the crate: the overwatch system has tagged it.
  brackets(ctx, -27, -26, 54, 52, col, 6);
}

function brackets(ctx: Ctx, x: number, y: number, w: number, h: number, color: string, len = 6) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;
  ctx.beginPath();
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    ctx.moveTo(cx + sx * len, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + sy * len);
  }
  ctx.stroke();
  ctx.restore();
}

function crateLabel(ctx: Ctx, kind: CrateKind) {
  const label = t(CRATES[kind].label).toUpperCase();
  ctx.font = `800 10px ${NV.canvasFont}`;
  const w = ctx.measureText(label).width + 18;
  ctx.beginPath();
  ctx.roundRect(-w / 2, 3, w, 15, 2);
  ctx.fillStyle = 'rgba(2,10,5,0.78)';
  ctx.fill();
  ctx.fillStyle = CRATE_COLORS[kind];
  ctx.fillRect(-w / 2 + 4, 6, 3, 9);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = rgba(PH, 0.8);
  ctx.shadowBlur = 5;
  ctx.fillStyle = PH;
  ctx.fillText(label, 3, 11);
}

function drum(ctx: Ctx) {
  const x = 0, y = 0;
  shade(ctx, x, y + 14, 14, 5);
  box(ctx, x - 12, y - 12, 24, 25, 0.54, 3);
  ctx.fillStyle = g(0.3);
  ctx.fillRect(x - 12, y - 2, 24, 4);
  ctx.fillRect(x - 12, y + 7, 24, 2);
  ctx.beginPath();
  ctx.ellipse(x, y - 12, 12, 4.5, 0, 0, TAU);
  ctx.fillStyle = g(0.7);
  ctx.fill();
}

/** The escort bus from above: a long, cool roof with a warm engine at the back and headlamps that bloom. */
function bus(ctx: Ctx) {
  shade(ctx, 2, 2, 30, 58, 0.45);
  for (const wy of [-34, 36]) for (const wx of [-28, 24]) box(ctx, wx, wy - 8, 4, 16, 0.12, 1);
  box(ctx, -25, -57, 50, 114, 0.46, 7);
  box(ctx, -19, -53, 38, 12, 0.18, 3);
  box(ctx, -23, -37, 5, 86, 0.26, 1);
  box(ctx, 18, -37, 5, 86, 0.26, 1);
  for (const hy of [-24, 4]) box(ctx, -8, hy, 16, 12, 0.56, 2);
  // The engine at the back runs warm.
  vol(ctx, 0, 42, 16, 9, 0.72, 0.1);
  ctx.save();
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 8;
  for (const hx of [-17, 17]) {
    ctx.beginPath();
    ctx.arc(hx, -56, 3.2, 0, TAU);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
  ctx.restore();
}

/** A spitter: its acid sac is warm, so it glows bright under the jaw. */
function spitter(ctx: Ctx) {
  shade(ctx, 0, 19, 12, 4);
  limb(ctx, [-4, 7], [-6, 19], 4.5, 0.22);
  limb(ctx, [4, 7], [5, 18], 4.5, 0.2);
  vol(ctx, 0, 3, 11, 9.5, 0.3);
  limb(ctx, [-9, -2], [-12, 8], 4.2, 0.42);
  limb(ctx, [9, -2], [12, 8], 4.2, 0.38);
  vol(ctx, 0, -12, 8, 7.5, 0.46);
  ctx.save();
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 8;
  vol(ctx, 0, -3, 8.5, 6.5, 0.8, 0.12);
  ctx.restore();
  eyeshine(ctx, 0, -13, 3);
}

function riot(ctx: Ctx, shield: boolean) {
  shade(ctx, 0, 21, 14, 5);
  limb(ctx, [-5, 8], [-6, 21], 5, 0.16);
  limb(ctx, [5, 8], [6, 21], 5, 0.14);
  vol(ctx, 0, 2, 13, 11, 0.26);
  vol(ctx, -11, -3, 5, 4, 0.34);
  vol(ctx, 11, -3, 5, 4, 0.3);
  if (!shield) {
    limb(ctx, [-11, -1], [-14, 12], 4.6, 0.42);
    limb(ctx, [11, -1], [13, 11], 4.6, 0.38);
  }
  vol(ctx, 0, -11, 8.5, 8, 0.44);
  ctx.beginPath();
  ctx.ellipse(0, -13, 10, 8, 0, Math.PI, TAU);
  ctx.closePath();
  ctx.fillStyle = g(0.22);
  ctx.fill();
  box(ctx, -9, -21, 18, 4, 0.6);
  eyeshine(ctx, 0, -11, 3);
  if (shield) {
    // The shield's plastic reflects the illuminator: a pale slab with a dark viewport.
    box(ctx, -19, 0, 38, 24, 0.62, 4);
    box(ctx, -19, 0, 38, 4, 0.76, 2);
    box(ctx, -11, 3, 22, 6, 0.3, 2);
  }
}

function crawler(ctx: Ctx) {
  shade(ctx, 0, 11, 11, 4);
  vol(ctx, 0, -5, 9, 7.5, 0.28);
  limb(ctx, [-7, -2], [-12, 6], 3.8, 0.42);
  limb(ctx, [-12, 6], [-9, 12], 3.8, 0.42);
  limb(ctx, [7, -2], [12, 4], 3.8, 0.38);
  limb(ctx, [12, 4], [10, 11], 3.8, 0.38);
  vol(ctx, 0, 4, 6.5, 6, 0.5);
  eyeshine(ctx, 0, 4, 2.4, 1.3);
}

/** Acid is warm: a bright, hazy pool that blooms on the feed. */
function acid(ctx: Ctx) {
  const rnd = rng(41);
  ctx.beginPath();
  for (let i = 0; i < 18; i++) {
    const t = (i / 18) * TAU, r = 78 * (0.86 + rnd() * 0.14);
    ctx.lineTo(Math.cos(t) * r, Math.sin(t) * r * 0.36);
  }
  ctx.closePath();
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, 80);
  gr.addColorStop(0, g(0.82));
  gr.addColorStop(1, g(0.5));
  ctx.fillStyle = gr;
  ctx.fill();
  for (let k = 0; k < 7; k++) {
    ctx.beginPath();
    ctx.arc((rnd() - 0.5) * 110, (rnd() - 0.5) * 30, 2.5 + rnd() * 3, 0, TAU);
    ctx.fillStyle = g(0.95);
    ctx.fill();
  }
}

function wall(ctx: Ctx) {
  for (let x = -78; x <= 78; x += 26) {
    shade(ctx, x, 12, 14, 4);
    vol(ctx, x, 5, 13, 7, 0.46, 0.12);
  }
  for (let x = -65; x <= 65; x += 26) vol(ctx, x, -6, 12, 6.5, 0.52, 0.12);
}

function flame(ctx: Ctx) {
  // Flame is the hottest thing on the feed: near white at the base, still bright at the tips.
  const gr = ctx.createLinearGradient(0, 0, 0, -170);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.6, 'rgba(235,235,235,0.9)');
  gr.addColorStop(1, 'rgba(200,200,200,0.35)');
  ctx.fillStyle = gr;
  const rnd = rng(19);
  for (let x = -260; x <= 260; x += 30) {
    const h = 110 + rnd() * 60, w = 26;
    ctx.beginPath();
    ctx.moveTo(x - w, 0);
    ctx.quadraticCurveTo(x - w * 0.9, -h * 0.5, x + (rnd() - 0.5) * 20, -h);
    ctx.quadraticCurveTo(x + w * 0.9, -h * 0.5, x + w, 0);
    ctx.closePath();
    ctx.fill();
  }
}

/** The extraction card's icon: a flare, the hottest point on the feed, over its smoke. */
function extractIcon(ctx: Ctx) {
  for (const [sx, sy, r] of [[-16, 14, 9], [-4, 20, 7], [8, 15, 8]] as const) vol(ctx, sx, sy, r, r * 0.8, 0.3, 0.08);
  limb(ctx, [0, 18], [0, -4], 4, 0.4);
  ctx.save();
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 14;
  vol(ctx, 0, -14, 12, 12, 0.98, 0.02);
  ctx.restore();
}

function supplyIcon(ctx: Ctx, kind: SupplyKind) {
  if (kind === 'shotgun') {
    for (const a of [-0.45, 0, 0.45]) {
      ctx.save();
      ctx.rotate(a);
      box(ctx, -6, -26, 12, 28, 0.42);
      box(ctx, -6.5, 2, 13, 9, 0.75, 1);
      ctx.restore();
    }
  } else if (kind === 'flamer') {
    ctx.save();
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 10;
    vol(ctx, 8, -12, 10, 12, 0.95, 0.05);
    ctx.restore();
    box(ctx, -20, -6, 16, 30, 0.36, 6);
    limb(ctx, [-4, 10], [6, 4], 4, 0.5);
    limb(ctx, [6, 4], [8, -4], 4, 0.5);
  } else if (kind === 'medkit') {
    box(ctx, -24, -16, 48, 34, 0.7, 4);
    box(ctx, -8, -24, 16, 9, 0.5, 3);
  } else {
    for (const [x, y] of [[-14, 10], [14, 10], [0, -4]]) vol(ctx, x, y, 14, 7.5, y < 0 ? 0.56 : 0.46, 0.12);
  }
}

function ground(ctx: Ctx) {
  const rnd = rng(17);
  // Painted over the whole view (`FIELD`), like the comic's road.
  const W = VIEW.w, H = FIELD.h, L = FIELD.x, R = FIELD.x + FIELD.w;
  ctx.fillStyle = g(0.17);
  ctx.fillRect(L, 0, R - L, H);
  for (let i = 0, n = Math.round((9000 * H) / VIEW.h); i < n; i++) {
    ctx.fillStyle = g(0.11 + rnd() * 0.13);
    ctx.fillRect(57 + rnd() * 426, rnd() * H, 1.2 + rnd() * 2, 1.2 + rnd() * 2);
  }
  // Grass on the shoulders reflects infrared: it shows up bright.
  for (const [x0, x1] of [[L, 57], [483, R]]) {
    ctx.fillStyle = g(0.34);
    ctx.fillRect(x0, 0, x1 - x0, H);
    for (let i = 0, n = Math.round((2600 * (x1 - x0) * H) / (57 * VIEW.h)); i < n; i++) {
      const x = x0 + rnd() * (x1 - x0), y = rnd() * H;
      limb(ctx, [x, y], [x + (rnd() - 0.5) * 4, y - 3 - rnd() * 6], 1, 0.3 + rnd() * 0.35);
    }
  }
  for (const x of [57, 483]) {
    ctx.fillStyle = g(0.5);
    ctx.fillRect(x - 3, 0, 6, H);
  }
  ctx.strokeStyle = g(0.1);
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 14; i++) {
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
  for (const lx of [180, 360]) {
    for (let y = -20; y < H; y += 80) {
      if (y > REACH_Y - 12 && y < REACH_Y + 28) continue;
      box(ctx, lx - 3, y, 6, 40, 0.62, 1);
    }
  }
  // The squad's infrared illuminator lights the road nearest them.
  const gr = ctx.createRadialGradient(W / 2, 930, 20, W / 2, 900, 520);
  gr.addColorStop(0, 'rgba(255,255,255,0.16)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(L, 0, R - L, H);
}

function sandbags(ctx: Ctx) {
  // Across the whole view, in step with the bags at 540 wide.
  const from = 28 * Math.floor(FIELD.x / 28), to = FIELD.x + FIELD.w + 14;
  for (let x = from + 12; x < to; x += 28) {
    shade(ctx, x, 13, 14, 4);
    vol(ctx, x, 7, 13, 7, 0.46, 0.12);
  }
  for (let x = from - 2; x < to; x += 28) vol(ctx, x, -3, 12, 6.5, 0.52, 0.12);
}

/** Scanlines and the lens vignette, laid over the whole feed. */
function scan(ctx: Ctx) {
  // Over the whole view (`FIELD`), its vignette and corners round the view's middle and edges.
  const { x: L, w: W, h: H } = FIELD, cx = L + W / 2, size = Math.max(W * (VIEW.h / VIEW.w), H);
  ctx.fillStyle = 'rgba(0,0,0,0.16)';
  for (let y = 0; y < H; y += 3) ctx.fillRect(L, y, W, 1);
  const vg = ctx.createRadialGradient(cx, H / 2, size * 0.32, cx, H / 2, size * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = vg;
  ctx.fillRect(L, 0, W, H);
  // Feed frame corners.
  const c = rgba(PH, 0.5);
  brackets(ctx, L + 4, 86, W - 8, H - 92, c, 18);
}

/** Sensor noise: pale specks on transparent, tiled over the feed and nudged every frame. */
function grain(ctx: Ctx) {
  const rnd = rng(77);
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = `rgba(220,255,210,${0.04 + rnd() * 0.12})`;
    ctx.fillRect(rnd() * GRAIN_TILE, rnd() * GRAIN_TILE, 1, 1);
  }
}

/** Bakes every night-vision texture, under `nv-<name>` keys. */
export function bakeNightVision(scene: Phaser.Scene) {
  nvBake(scene, 'ground', GEOM.ground, ground, { grain: 0.08, bloom: 0, seed: 3 });
  nvBake(scene, 'sandbags', GEOM.sandbags, sandbags, { bloom: 0 });
  nvBake(scene, 'hero', GEOM.hero, (c) => soldier(c, true));
  nvBake(scene, 'companion', GEOM.companion, (c) => soldier(c, false));
  nvBake(scene, 'grunt', GEOM.grunt, (c) => walker(c, false));
  nvBake(scene, 'runner', GEOM.runner, (c) => walker(c, true));
  nvBake(scene, 'brute', GEOM.brute, (c) => brute(c, false));
  nvBake(scene, 'boss', GEOM.boss, (c) => {
    c.scale(1.9, 1.9);
    brute(c, true);
  });
  nvBake(scene, 'brood', GEOM.brood, (c) => {
    c.scale(1.9, 1.9);
    brood(c);
  });
  nvBake(scene, 'bloater', GEOM.bloater, (c) => {
    c.scale(1.9, 1.9);
    bloater(c);
  }, { bloom: 6 });
  nvBake(scene, 'survivor', GEOM.survivor, survivor);
  nvBake(scene, 'spitter', GEOM.spitter, spitter);
  nvBake(scene, 'riot', GEOM.riot, (c) => riot(c, true));
  nvBake(scene, 'riot-bare', GEOM.riot, (c) => riot(c, false));
  nvBake(scene, 'crawler', GEOM.crawler, crawler);
  nvBake(scene, 'acid', GEOM.acid, acid, { bloom: 5 });
  nvBake(scene, 'glob', GEOM.glob, (c) => {
    c.save();
    c.shadowColor = '#fff';
    c.shadowBlur = 6;
    vol(c, 0, 0, 6, 7, 0.9, 0.08);
    c.restore();
  });
  nvBake(scene, 'wall', GEOM.wall, wall, { bloom: 0 }, (c) => brackets(c, -90, -20, 180, 38, AMB, 8));
  nvBake(scene, 'flame', GEOM.flame, flame, { bloom: 8 });
  for (const kind of SUPPLY_KINDS) {
    // The medkit's green cross is painted after the phosphor pass, as a crisp mark on the box.
    nvBake(scene, `supply-${kind}`, GEOM.supply, (c) => supplyIcon(c, kind), {}, kind === 'medkit' ? (c) => {
      c.fillStyle = '#6ae06a';
      c.shadowColor = '#6ae06a';
      c.shadowBlur = 6;
      c.fillRect(-4, -11, 8, 24);
      c.fillRect(-12, -3, 24, 8);
    } : undefined);
  }
  nvBake(scene, 'supply-extract', GEOM.supply, extractIcon, { bloom: 8 });
  for (const kind of CRATE_KINDS) {
    nvBake(scene, `crate-${kind}`, GEOM.crate, crate, {}, (c) => chemlight(c, kind));
    bake(scene, key(`label-${kind}`), GEOM.label, (c) => crateLabel(c, kind));
  }
  nvBake(scene, 'drum', GEOM.drum, drum, {}, (c) => brackets(c, -17, -17, 34, 34, AMB, 5));
  nvBake(scene, 'bus', GEOM.bus, bus, {}, (c) => brackets(c, -30, -61, 60, 120, AMB, 9));
  nvBake(scene, 'bullet', GEOM.bullet, (c) => {
    const gr = c.createLinearGradient(0, -4, 0, 26);
    gr.addColorStop(0, '#fff');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr;
    c.beginPath();
    c.roundRect(-1.8, -4, 3.6, 30, 1.8);
    c.fill();
  });
  nvBake(scene, 'muzzle', GEOM.muzzle, (c) => {
    c.save();
    c.shadowColor = '#fff';
    c.shadowBlur = 10;
    c.beginPath();
    for (let i = 0; i < 12; i++) {
      const t = -Math.PI / 2 + ((i - 6) / 6) * 1.2, r = i % 2 ? 4 : 10;
      c.lineTo(Math.cos(t) * r, 4 + Math.sin(t) * r);
    }
    c.closePath();
    c.fillStyle = '#fff';
    c.fill();
    c.restore();
  });
  nvBake(scene, 'splat', GEOM.splat, (c) => {
    const rnd = rng(23);
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const t = (i / 10) * TAU, r = (i % 2 ? 8 : 13) * (0.8 + rnd() * 0.4);
      c.lineTo(Math.cos(t) * r, Math.sin(t) * r * 0.6);
    }
    c.closePath();
    c.fillStyle = g(0.04);
    c.fill();
  }, { bloom: 0 });
  nvBake(scene, 'blast', GEOM.blast, (c) => {
    // A white-hot flare that blooms out over the feed.
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, 96);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(230,230,230,0.9)');
    gr.addColorStop(1, 'rgba(120,120,120,0)');
    c.fillStyle = gr;
    c.beginPath();
    c.arc(0, 0, 96, 0, TAU);
    c.fill();
  }, { bloom: 6 });
  bake(scene, key('streak'), GEOM.streak, (c) => brackets(c, -40, -26, 80, 52, AMB, 8));
  bake(scene, key('scan'), GEOM.ground, scan);
  bake(scene, key('hudbar'), GEOM.hudbar, (c) => {
    const gr = c.createLinearGradient(0, 0, 0, HUD_HEIGHT);
    gr.addColorStop(0, 'rgba(2,10,5,0.85)');
    gr.addColorStop(1, 'rgba(2,10,5,0.6)');
    c.fillStyle = gr;
    c.fillRect(FIELD.x, 0, FIELD.w, HUD_HEIGHT);
    c.fillStyle = rgba(PH, 0.5);
    c.fillRect(FIELD.x, HUD_HEIGHT - 1, FIELD.w, 1);
  });
  bake(scene, key('ring'), GEOM.ring, (c) => {
    // The drum's blast radius, marked by the overwatch system: a dashed amber circle with ticks.
    const r = DRUM.blastRadius;
    c.beginPath();
    c.arc(0, 0, r, 0, TAU);
    c.fillStyle = rgba(AMB, 0.12);
    c.fill();
    c.save();
    c.strokeStyle = AMB;
    c.shadowColor = AMB;
    c.shadowBlur = 6;
    c.lineWidth = 1.4;
    c.setLineDash([3, 5]);
    c.stroke();
    c.setLineDash([]);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      c.beginPath();
      c.moveTo(Math.cos(a) * (r - 5), Math.sin(a) * (r - 5));
      c.lineTo(Math.cos(a) * (r + 5), Math.sin(a) * (r + 5));
      c.stroke();
    }
    c.restore();
  });
  bake(scene, key('grain'), { w: GRAIN_TILE, h: GRAIN_TILE, ox: 0, oy: 0 }, grain);
}
