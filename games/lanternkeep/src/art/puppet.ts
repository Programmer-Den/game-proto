import Phaser from 'phaser';
import { DISTRICTS, type DistrictId, JAR, type Spot } from '../game/places';
import type { LanternKind, MothKind, NightKind } from '../game/state';
import { sharpRes, viewFrame, viewSize } from '../../../../shared/scaling';
import { CALL_TAG, DUSK_BAR as DUSK, GUST_TAG, KIND_TAG, MOVE_CARDS, MOVE_PANEL, NIGHT_PANEL, ORDER, SHOP, SMALL_PANEL } from '../scenes/layout';

export { DUSK };

// The shadow-puppet theatre look: the keep is black cut card held in front of a backlit paper
// screen that glows from saffron to indigo as dusk falls. Light comes through the cuts (arrow
// slits, stone joints, the gate), the lanterns have coloured gel panes, the moths are lace-winged
// puppets with a pale rim of light so they read against the black card, and the HUD and panels are
// black card plaques with punched lace borders.
//
// Everything is painted once at startup on 2D canvases and added with `textures.addCanvas`. The
// painters work in view pixels; sprites and plaques are painted at RES times that size and the
// full-view layers (the screen, castle, stars, fog, bunting) at BACK_RES, and the scene draws them
// at 1 / RES and 1 / BACK_RES, so they stay sharp on every screen.

export const PI = Math.PI;
/** Canvas pixels per view pixel for sprites and plaques: 2, or more on a big screen (set by `bakeTextures`). */
export let RES = 2;
/** Canvas pixels per view pixel for the HUD bar, which spans the view: RES, or less on a wide view. */
export let HUD_RES = 2;
/** Canvas pixels per view pixel for the full-view layers: 1, or more on a big screen. */
export let BACK_RES = 1;
/** The black of the card. */
export const INK = '#0d0a10';
export const INK_HEX = 0x0d0a10;

let ctx: CanvasRenderingContext2D;

let seed = 7;
/** A seeded random number, so the paper and stars are the same on every visit (never Math.random). */
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const reseed = (s: number) => {
  seed = s;
};

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

type P = readonly [number, number];

function poly(pts: readonly P[], fill?: string) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

function rrect(x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function dot(x: number, y: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * PI);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A soft additive glow of colour `col`, as light through the paper. */
function glow(x: number, y: number, r: number, col: string, a = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, 0.55 * a));
  g.addColorStop(0.35, rgba(col, 0.25 * a));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.restore();
}

/**
 * Paints a `w` x `h` (view pixels) texture called `key` at `res` canvas pixels per view pixel,
 * with (0, 0) of the painter at view pixel (`ox`, `oy`) of the texture.
 */
function bake(scene: Phaser.Scene, key: string, w: number, h: number, paint: () => void, ox = 0, oy = 0, res = RES) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * res);
  canvas.height = Math.ceil(h * res);
  ctx = canvas.getContext('2d')!;
  ctx.scale(res, res);
  ctx.translate(ox, oy);
  paint();
  scene.textures.addCanvas(key, canvas);
}

const W = 960;
const H = 540;
/**
 * The view around the designed 960x540 frame (set by `bakeTextures`): the view is `VW` x `VH`
 * and the frame sits `FX`, `FY` in from its top-left, so the view spans -FX to W + FX and -FY to
 * H + FY in the painters' (frame) pixels. The full-view layers paint over all of it.
 */
export let FX = 0;
export let FY = 0;
let VW = W;
let VH = H;
const GROUND = 500;
const WALL = { x: 40, y: 320, w: 880 };
const TOWERS = [
  { x: 120, y: 200, w: 100 },
  { x: 740, y: 200, w: 100 },
];
const KEEP = { x: 400, y: 128, w: 160 };

/** Merlon x positions along a top edge, skipping those a lantern spot covers. */
function merlonXs(x0: number, x1: number, top: number, spots: readonly Spot[]) {
  const xs: number[] = [];
  for (let x = x0; x + 12 <= x1; x += 24) {
    if (spots.some((s) => Math.abs(x + 6 - s.x) < 18 && Math.abs(top + 12 - (s.y + 16)) < 8)) continue;
    xs.push(x);
  }
  return xs;
}

/** The three paper screens dusk crossfades through: early dusk, deep dusk and night. */
export const SCREENS = ['screen-0', 'screen-1', 'screen-2'] as const;
const SCREEN_STOPS = [
  ['#4a3466', '#8c4c6a', '#d8705a', '#f5a066', '#ffd08a'],
  ['#1d1b3e', '#3b2c5c', '#8a4a62', '#e0825a', '#ffc27a'],
  ['#0c0b1e', '#17152f', '#2a2148', '#4a3058', '#80506a'],
];

function paintScreen(stops: string[], lamp: number) {
  const sky = ctx.createLinearGradient(0, 40, 0, 540);
  [0, 0.35, 0.62, 0.82, 1].forEach((t, i) => sky.addColorStop(t, stops[i]));
  ctx.fillStyle = sky;
  ctx.fillRect(-FX, -FY, VW, VH);
  // The lamp behind the screen: a warm hot spot low and centre.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const hs = ctx.createRadialGradient(480, 560, 10, 480, 560, 520);
  hs.addColorStop(0, `rgba(255,200,120,${lamp})`);
  hs.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = hs;
  ctx.fillRect(-FX, -FY, VW, VH);
  ctx.restore();
  // Paper fibres.
  reseed(9);
  ctx.lineWidth = 0.5;
  for (let i = 0; i < Math.round((900 * VW * VH) / (W * H)); i++) {
    const x = -FX + rnd() * VW;
    const y = -FY + rnd() * VH;
    const l = 2 + rnd() * 9;
    const a = rnd() * PI;
    ctx.strokeStyle = rnd() < 0.5 ? 'rgba(255,240,220,0.06)' : 'rgba(30,10,30,0.06)';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
}

/** Far hills behind every district: a fainter, blurred card further from the screen. */
function paintHills() {
  ctx.save();
  ctx.filter = 'blur(1.5px)';
  poly(
    [
      ...(FX > 0 ? ([[-FX, 424], [-FX / 2, 400]] as P[]) : []),
      [0, 440], [60, 410], [140, 430], [230, 396], [330, 424], [460, 400], [560, 420], [700, 392], [820, 418], [900, 404], [960, 420],
      ...(FX > 0 ? ([[W + FX / 2, 398], [W + FX, 422]] as P[]) : []),
      [W + FX, H + FY], [-FX, H + FY],
    ],
    'rgba(40,20,40,0.55)',
  );
  ctx.restore();
}

/** Grass tufts along the ground edge. */
function paintGrass() {
  reseed(4);
  for (let x = -FX; x < W + FX; x += 6) {
    const h = 3 + rnd() * 7;
    poly([[x, 501], [x + 2 + rnd() * 2, 500 - h], [x + 5, 501]], INK);
  }
}

/** Light through a cut in the card: warm gel and a soft glow. */
function cut(pts: P[], gel = '#f0a868') {
  ctx.save();
  ctx.globalAlpha = 0.8;
  poly(pts, gel);
  ctx.restore();
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  glow(cx, cy, 12, '#ff9a50', 0.35);
}

/** An arched window cut, `w` wide, its sill at (x, y) and its top `h` up. */
function arch(x: number, y: number, w: number, h: number, gel?: string) {
  cut([[x, y - h + w / 2], [x + w / 2, y - h], [x + w, y - h + w / 2], [x + w, y], [x, y]], gel);
}

/** Brick lace: thin joints cut through a block, so the card reads as masonry. */
function joints(b: { x: number; y: number; w: number }, step: number, bottom = 496) {
  ctx.save();
  ctx.strokeStyle = 'rgba(240,150,90,0.22)';
  ctx.lineWidth = 0.7;
  for (let y = b.y + 18, row = 0; y < bottom; y += 18, row++) {
    ctx.beginPath();
    ctx.moveTo(b.x + 4, y);
    ctx.lineTo(b.x + b.w - 4, y);
    ctx.stroke();
    for (let x = b.x + 8 + ((row % 2) * step) / 2; x < b.x + b.w - 6; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, y - 18);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** A gateway cut out from `x0` to `x1`, with a lattice of thin card bars against warm light. */
function gateway(x0: number, x1: number, top = 400) {
  const m = (x0 + x1) / 2;
  poly([[x0, 500], [x0, top + 30], [x0 + 12, top + 10], [x0 + 28, top], [x1 - 28, top], [x1 - 12, top + 10], [x1, top + 30], [x1, 500]], '#f6b06a');
  glow(m, (top + 500) / 2 + 5, 50, '#ffb060', 0.6);
  for (let x = x0 + 12; x < x1; x += 12) poly([[x - 1, top], [x + 1, top], [x + 1, 500], [x - 1, 500]], INK);
  for (let y = top + 20; y < 500; y += 20) poly([[x0, y], [x1, y], [x1, y + 2], [x0, y + 2]], INK);
  for (let x = x0 + 12; x < x1; x += 12) poly([[x - 2, 496], [x + 2, 496], [x, 502]], INK);
}

/** The moth jar in front of the gate: a card outline with pale blue gel glass. */
function paintJar(jx = JAR.x, jy = JAR.y - 20) {
  ctx.save();
  ctx.globalAlpha = 0.85;
  poly([[jx - 16, jy - 10], [jx + 16, jy - 10], [jx + 16, jy + 18], [jx - 16, jy + 18]], '#a8d0dc');
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(jx - 16, jy - 10, 32, 28);
  poly([[jx - 9, jy - 15], [jx + 9, jy - 15], [jx + 9, jy - 10], [jx - 9, jy - 10]], INK);
  poly([[jx - 6, jy - 21], [jx + 6, jy - 21], [jx + 5, jy - 15], [jx - 5, jy - 15]], INK);
  poly([[jx - 18, jy + 18], [jx + 18, jy + 18], [jx + 18, jy + 22], [jx - 18, jy + 22]], INK);
  poly([[jx - 12, jy - 6], [jx - 10, jy - 6], [jx - 10, jy + 14], [jx - 12, jy + 14]], 'rgba(255,255,255,0.7)');
}

/** A district's scenery: the path of its black card, and the trim drawn over it (cuts, joints, the gate). */
interface Scenery {
  card: (spots: readonly Spot[]) => void;
  trim: () => void;
}
const r = (x: number, y: number, w: number, h: number) => ctx.rect(x, y, w, h);

const SCENERY: Record<DistrictId, Scenery> = {
  // The castle: a wall with merlons, two towers and the keep.
  keep: {
    card(spots) {
      r(WALL.x, WALL.y, WALL.w, GROUND - WALL.y + 2);
      for (const x of merlonXs(40, 920, 308, spots)) r(x, 308, 12, 13);
      for (const t of TOWERS) {
        r(t.x, t.y, t.w, GROUND - t.y);
        for (const x of merlonXs(t.x, t.x + 112, 188, spots)) if (x + 12 <= t.x + t.w + 4) r(x - 2, 186, 14, 15);
        r(t.x - 6, t.y + 2, t.w + 12, 6);
      }
      r(KEEP.x, KEEP.y, KEEP.w, GROUND - KEEP.y);
      for (const x of merlonXs(400, 572, 116, spots)) if (x + 12 <= 564) r(x, 114, 12, 15);
      r(KEEP.x - 6, KEEP.y + 2, KEEP.w + 12, 6);
    },
    trim() {
      // Pennant pole and flag on the keep.
      poly([[548, 70], [550, 70], [550, 116], [548, 116]], INK);
      poly([[550, 71], [578, 78], [566, 81], [578, 86], [550, 90]], INK);
      for (const t of TOWERS) for (const oy of [250, 330]) arch(t.x + 44, oy + 26, 10, 30);
      for (const x of [432, 516]) arch(x, 330, 14, 34);
      joints(KEEP, 40);
      TOWERS.forEach((t) => joints(t, 34));
      gateway(440, 520);
    },
  },
  // The docks: a long warehouse with a crane, a customs house with a mast, a fish hall and a lighthouse.
  docks: {
    card(spots) {
      r(40, 320, 380, GROUND - 320 + 2);
      for (const x of merlonXs(40, 420, 308, spots)) r(x + 2, 312, 8, 9);
      r(120, 200, 60, GROUND - 200);
      r(130, 206, 130, 8);
      r(254, 206, 4, 40);
      r(540, 320, 380, GROUND - 320 + 2);
      for (const x of merlonXs(540, 920, 308, spots)) r(x + 2, 312, 8, 9);
      r(780, 166, 60, GROUND - 166);
      r(770, 160, 80, 8);
      r(400, 246, 160, GROUND - 246);
      r(394, 248, 172, 6);
      r(477, 128, 6, 120);
      r(440, 150, 80, 4);
    },
    trim() {
      // The lighthouse lamp room and the warehouse portholes.
      cut([[790, 178], [830, 178], [830, 200], [790, 200]], '#ffe6a0');
      glow(810, 190, 30, '#ffd080', 0.6);
      for (const x of [120, 200, 340]) cut([[x - 7, 400], [x, 393], [x + 7, 400], [x, 407]]);
      for (const x of [620, 700, 840]) cut([[x - 7, 400], [x, 393], [x + 7, 400], [x, 407]]);
      arch(470, 300, 20, 40);
      joints({ x: 400, y: 246, w: 160 }, 40);
      joints({ x: 780, y: 166, w: 60 }, 30);
      // Rope from the crane's jib, and a coil on the quay.
      poly([[256, 214], [258, 214], [258, 290], [256, 290]], INK);
      gateway(380, 580, 408);
      for (const x of [400, 560]) poly([[x - 5, 408], [x + 5, 408], [x + 5, 500], [x - 5, 500]], INK);
    },
  },
  // Chapel Hill: a bell tower, a chapel with a steeple, a churchyard wall with headstones and an old yew.
  chapel: {
    card(spots) {
      r(40, 320, 880, GROUND - 320 + 2);
      for (const x of merlonXs(40, 920, 308, spots)) {
        ctx.moveTo(x + 1, 322);
        ctx.lineTo(x + 1, 308);
        ctx.arc(x + 6, 308, 5, PI, 0);
        ctx.lineTo(x + 11, 322);
        ctx.closePath();
      }
      r(90, 200, 60, GROUND - 200);
      r(84, 202, 72, 6);
      ctx.moveTo(400, 246);
      ctx.lineTo(480, 200);
      ctx.lineTo(560, 246);
      ctx.lineTo(560, GROUND);
      ctx.lineTo(400, GROUND);
      ctx.closePath();
      r(466, 128, 28, 120);
      r(462, 130, 36, 6);
      ctx.moveTo(840, 200);
      ctx.bezierCurveTo(900, 230, 900, 340, 870, 400);
      ctx.lineTo(880, GROUND);
      ctx.lineTo(800, GROUND);
      ctx.lineTo(810, 400);
      ctx.bezierCurveTo(780, 340, 780, 230, 840, 200);
      ctx.closePath();
      r(836, 400, 8, GROUND - 400);
    },
    trim() {
      // The belfry, the chapel's windows and a rose window over the porch.
      arch(110, 250, 20, 36, '#ffd8a0');
      for (const x of [420, 530]) arch(x, 330, 10, 40);
      cut([[480, 300], [490, 310], [480, 320], [470, 310]], '#f0a8c0');
      glow(480, 310, 14, '#ff9ab0', 0.4);
      joints({ x: 466, y: 128, w: 28 }, 28, 246);
      joints({ x: 90, y: 200, w: 60 }, 30);
      gateway(440, 520, 408);
    },
  },
  // The market: gabled houses, a market hall with a clock tower and a row of stalls with awnings.
  market: {
    card(spots) {
      for (const hx of [150, 710]) {
        ctx.moveTo(hx, 260);
        ctx.lineTo(hx + 50, 200);
        ctx.lineTo(hx + 100, 260);
        ctx.lineTo(hx + 100, GROUND);
        ctx.lineTo(hx, GROUND);
        ctx.closePath();
        r(hx + 36, 200, 28, 6);
      }
      r(400, 246, 160, GROUND - 246);
      r(394, 248, 172, 6);
      r(455, 128, 50, 120);
      r(449, 130, 62, 6);
      // Stalls: a scalloped awning on two posts each.
      for (const sx of [100, 320, 640, 860]) {
        r(sx - 44, 320, 88, 8);
        for (let x = sx - 44; x < sx + 44; x += 11) {
          ctx.moveTo(x, 328);
          ctx.arc(x + 5.5, 328, 5.5, PI, 0, true);
          ctx.closePath();
        }
        r(sx - 42, 328, 4, GROUND - 328);
        r(sx + 38, 328, 4, GROUND - 328);
        r(sx - 44, 420, 88, 6);
      }
      void spots;
    },
    trim() {
      // The clock face, the houses' windows and the wares on the stalls.
      ctx.save();
      ctx.globalAlpha = 0.85;
      dot(480, 170, 14, '#ffe6b0');
      ctx.restore();
      glow(480, 170, 22, '#ffd080', 0.5);
      poly([[479, 170], [481, 170], [481, 160], [479, 160]], INK);
      poly([[480, 169], [480, 171], [488, 171], [488, 169]], INK);
      for (const x of [190, 750]) for (const y of [300, 380]) arch(x, y, 12, 30);
      joints({ x: 400, y: 246, w: 160 }, 40);
      const gels = ['#ffc870', '#ff9a8a', '#9ad8c8', '#c8a8ff'];
      [100, 320, 640, 860].forEach((sx, k) => {
        for (let i = 0; i < 6; i++) dot(sx - 32 + i * 13, 414, 5, gels[(i + k) % gels.length]);
      });
      gateway(440, 520, 408);
    },
  },
  // The harbour (LK15): the harbour master's house, a lighthouse, a signal mast over the harbour
  // hall, two breakwaters with a net loft and a chandler's, and a low slipway the tide floods.
  harbour: {
    card(spots) {
      r(40, 320, 380, GROUND - 320 + 2);
      r(540, 320, 380, GROUND - 320 + 2);
      // Round bollards along the breakwaters.
      for (const x of merlonXs(40, 920, 308, spots)) {
        if (x > 408 && x < 540) continue;
        ctx.moveTo(x + 2, 322);
        ctx.lineTo(x + 2, 312);
        ctx.arc(x + 6, 312, 4, PI, 0);
        ctx.lineTo(x + 10, 322);
        ctx.closePath();
      }
      // The harbour master's house, gabled.
      ctx.moveTo(110, 230);
      ctx.lineTo(150, 200);
      ctx.lineTo(190, 230);
      ctx.lineTo(190, GROUND);
      ctx.lineTo(110, GROUND);
      ctx.closePath();
      // The lighthouse, tapering, with its gallery.
      ctx.moveTo(800, 166);
      ctx.lineTo(840, 166);
      ctx.lineTo(852, GROUND);
      ctx.lineTo(788, GROUND);
      ctx.closePath();
      r(790, 160, 60, 8);
      // The harbour hall and its signal mast with a yard.
      r(400, 250, 160, GROUND - 250);
      r(394, 252, 172, 6);
      r(477, 128, 6, 124);
      r(446, 152, 68, 4);
    },
    trim() {
      // The lighthouse lamp room and its beam, the house's windows and the hall's porthole.
      cut([[800, 178], [840, 178], [840, 198], [800, 198]], '#ffe6a0');
      glow(820, 188, 34, '#ffd080', 0.6);
      for (const y of [260, 340, 420]) arch(144, y, 12, 26);
      for (let y = 214; y < 470; y += 22) poly([[813, y], [827, y], [828, y + 3], [812, y + 3]], 'rgba(240,150,90,0.3)');
      cut([[480, 270], [490, 280], [480, 290], [470, 280]], '#9ad8e8');
      joints({ x: 400, y: 250, w: 160 }, 40);
      // Signal flags on the yard.
      for (const [x, gel] of [[452, '#ff9a8a'], [500, '#ffd890']] as const) {
        ctx.save();
        ctx.globalAlpha = 0.8;
        poly([[x, 156], [x + 10, 156], [x + 5, 168]], gel);
        ctx.restore();
      }
      // The slipway: an opening down to the water, its posts and the low quay's lattice.
      gateway(330, 630, 408);
      for (const x of [360, 480, 600]) poly([[x - 5, 408], [x + 5, 408], [x + 5, 500], [x - 5, 500]], INK);
      // Waves cut along the foot of the breakwaters, with sea-green gel.
      for (let x = 50; x < 910; x += 34) {
        if (x > 320 && x < 640) continue;
        cut([[x, 470], [x + 8, 464], [x + 16, 470], [x + 8, 467]], '#9ad8c8');
      }
    },
  },
  // The mountain monastery (LK20): two bell towers on the crags, a domed hall, snowy peaks behind
  // and the pilgrims' path climbing through an opening at the foot.
  monastery: {
    card(spots) {
      r(40, 320, 380, GROUND - 320 + 2);
      r(540, 320, 380, GROUND - 320 + 2);
      for (const x of merlonXs(40, 920, 308, spots)) {
        if (x > 408 && x < 540) continue;
        ctx.moveTo(x + 1, 322);
        ctx.lineTo(x + 1, 308);
        ctx.arc(x + 6, 308, 5, PI, 0);
        ctx.lineTo(x + 11, 322);
        ctx.closePath();
      }
      // Jagged peaks behind the walls.
      for (const [a, b, c, d, e] of [
        [200, 260, 290, 330, 380],
        [580, 630, 670, 700, 760],
      ]) {
        ctx.moveTo(a, 322);
        ctx.lineTo(b, a < 480 ? 236 : 214);
        ctx.lineTo(c, 262);
        ctx.lineTo(d, a < 480 ? 214 : 236);
        ctx.lineTo(e, 322);
        ctx.closePath();
      }
      // The bell towers.
      for (const tx of [130, 770]) {
        r(tx, 200, 60, GROUND - 200);
        r(tx - 6, 202, 72, 6);
      }
      // The hall, its dome and its finial.
      r(400, 250, 160, GROUND - 250);
      ctx.moveTo(410, 252);
      ctx.arc(480, 252, 70, PI, 0);
      ctx.closePath();
      r(477, 124, 6, 64);
    },
    trim() {
      // The belfries, the hall's windows and a round window in the dome.
      for (const x of [160, 800]) {
        arch(x - 8, 248, 16, 34, '#ffd8a0');
        glow(x, 262, 22, '#ffc870', 0.4);
      }
      for (const x of [430, 530]) arch(x, 330, 10, 40);
      cut([[480, 206], [490, 216], [480, 226], [470, 216]], '#c8d8ff');
      // Snow on the peaks, in pale blue gel.
      for (const [x, y] of [[260, 236], [330, 214], [630, 214], [700, 236]]) cut([[x, y + 4], [x + 9, y + 16], [x - 9, y + 16]], '#e8f0ff');
      joints({ x: 400, y: 250, w: 160 }, 40);
      joints({ x: 130, y: 200, w: 60 }, 34);
      joints({ x: 770, y: 200, w: 60 }, 34);
      // The pilgrims' path: an opening at the foot with a post at each path lantern.
      gateway(300, 660, 408);
      for (const x of [340, 480, 620]) poly([[x - 5, 408], [x + 5, 408], [x + 5, 500], [x - 5, 500]], INK);
    },
  },
};

/** The district's scenery as one black cut card, with light through its cuts and the jar at the gate. */
function paintScenery(id: DistrictId) {
  paintHills();
  const { card, trim } = SCENERY[id];
  const spots = DISTRICTS[id].spots;
  const path = () => {
    ctx.beginPath();
    card(spots);
    r(-FX, GROUND, VW, H + FY - GROUND);
  };
  // The card sits a hair off the screen, so its edge blooms a soft shadow.
  ctx.save();
  ctx.filter = 'blur(3px)';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  path();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = INK;
  path();
  ctx.fill();
  paintGrass();
  trim();
  paintJar();
}

/** Stars punched through the screen, on their own layer so they can come out as night falls. */
function paintStars() {
  reseed(5);
  for (let i = 0; i < Math.round((55 * VW * (240 + FY)) / (W * 240)); i++) {
    const x = -FX + rnd() * VW;
    const y = 48 - FY + rnd() * (240 + FY);
    const r = 0.5 + rnd() * 1.1;
    glow(x, y, r * 5, '#fff0d0', 0.35);
    dot(x, y, r, 'rgba(255,248,230,0.9)');
  }
}

/** The moon: a pale gel disc with a crescent cut away, so the screen shows through. */
function paintMoon() {
  glow(0, 0, 50, '#ffe6c0', 0.4);
  dot(0, 0, 15, '#fff1d8');
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  dot(7, -5, 13, '#000');
  ctx.restore();
}

/** The gel panes of each kind of lantern, lit and dark. */
const LANTERN_GELS: Record<LanternKind, { lit: [string, string]; dark: [string, string] }> = {
  plain: { lit: ['#ffd480', '#ffb04a'], dark: ['#6f7aa8', '#4a5480'] },
  beacon: { lit: ['#ff9a50', '#ff5a2a'], dark: ['#8a5a70', '#5a3850'] },
  candle: { lit: ['#fff6d0', '#ffe8a8'], dark: ['#8a8aa0', '#606078'] },
  bell: { lit: ['#9af0d8', '#48c8b0'], dark: ['#5a8a90', '#3a6068'] },
};

/** A lantern texture's height (the special kinds are taller, for the bell under the base) and where its anchor is painted. */
const lampH = (kind: LanternKind) => (kind === 'plain' ? 56 : 60);
const LAMP_Y = 36;
/** The lantern image's origin y for `kind`, as a fraction; set it again after every setTexture. */
export const lampOriginY = (kind: LanternKind) => LAMP_Y / lampH(kind);

/**
 * A hanging lantern centred on (0, 0): a black card frame with two coloured gel panes. The kinds
 * differ in their gel and an emblem: a beacon has a flared crown, a candle a single slim pane, and
 * a bell a bell hanging under it.
 */
function paintLantern(lit: boolean, kind: LanternKind = 'plain') {
  const x = 0;
  const y = 0;
  poly([[x - 1.2, y - 30], [x + 1.2, y - 30], [x + 1.2, y - 18], [x - 1.2, y - 18]], INK);
  ctx.beginPath();
  ctx.arc(x, y - 31, 3, 0, 2 * PI);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = INK;
  ctx.stroke();
  if (kind === 'beacon') poly([[x, y - 26], [x + 15, y - 15], [x + 9, y - 12], [x - 9, y - 12], [x - 15, y - 15]], INK);
  else poly([[x, y - 24], [x + 12, y - 15], [x + 9, y - 12], [x - 9, y - 12], [x - 12, y - 15]], INK);
  poly([[x - 11, y - 13], [x + 11, y - 13], [x + 11, y + 10], [x - 11, y + 10]], INK);
  poly([[x - 12, y + 9], [x + 12, y + 9], [x + 8, y + 15], [x - 8, y + 15]], INK);
  if (kind === 'bell') {
    // A small bell on a cord under the base.
    poly([[x - 0.8, y + 15], [x + 0.8, y + 15], [x + 0.8, y + 18], [x - 0.8, y + 18]], INK);
    ctx.beginPath();
    ctx.moveTo(x - 5, y + 24);
    ctx.quadraticCurveTo(x - 4, y + 17, x, y + 17);
    ctx.quadraticCurveTo(x + 4, y + 17, x + 5, y + 24);
    ctx.closePath();
    ctx.fillStyle = lit ? '#9af0d8' : '#5a8a90';
    ctx.fill();
    dot(x, y + 24.5, 1.2, INK);
  } else poly([[x - 3, y + 15], [x + 3, y + 15], [x, y + 19]], INK);
  const gels = LANTERN_GELS[kind];
  const pane = lit ? gels.lit : gels.dark;
  const panes: readonly (readonly [number, number, string])[] =
    kind === 'candle' ? [[-3.5, 7, pane[0]]] : [[-8, 7, pane[0]], [1, 7, pane[1]]];
  for (const [px, pw, c] of panes) {
    ctx.beginPath();
    ctx.moveTo(x + px, y + 7);
    ctx.lineTo(x + px, y - 6);
    ctx.arc(x + px + pw / 2, y - 6, pw / 2, PI, 0);
    ctx.lineTo(x + px + pw, y + 7);
    ctx.closePath();
    ctx.fillStyle = c;
    ctx.fill();
  }
  if (kind === 'candle') {
    // The candle itself, a pale stick with a wick, behind the pane.
    poly([[x - 1.2, y + 6], [x + 1.2, y + 6], [x + 1.2, y - 2], [x - 1.2, y - 2]], lit ? '#fff' : '#c0c0d0');
  }
  if (lit) glow(x, y, 16, kind === 'beacon' ? '#ffb070' : kind === 'bell' ? '#b0ffe8' : '#fff0b0', kind === 'beacon' ? 1.1 : 0.9);
  else poly([[x - 7, y - 5], [x - 6, y - 5], [x - 6, y + 4], [x - 7, y + 4]], 'rgba(220,230,255,0.5)');
}

/** The flame inside a lit lantern, its own texture so it can flicker. */
function paintFlame() {
  poly([[0, -6], [3, 3], [0, 6], [-3, 3]], '#fff8e0');
}

/** How each moth kind's puppet looks: its size and the gel in its wings' eye-spots. */
export const MOTH_LOOK = {
  fast: { s: 1.15, gel: '#8cc8ff' },
  slow: { s: 1.4, gel: '#b8e690' },
  heavy: { s: 1.6, gel: '#f0c27a' },
  firefly: { s: 1.25, gel: '#e6ff86' },
} as const satisfies Record<MothKind, { s: number; gel: string }>;

/**
 * A moth puppet centred on (0, 0): black lace wings with a pale lit rim (so it reads against the
 * black card), a gel eye-spot per kind and a brass rod pin at the body.
 */
function paintMoth(kind: MothKind, up: boolean) {
  const k = MOTH_LOOK[kind];
  const s = k.s;
  const sp = up ? 1 : 0.55;
  const Pt = (px: number, py: number): [number, number] => [px * s, py * s];
  for (const side of [-1, 1]) {
    const Q = (px: number, py: number) => Pt(px * side, py);
    const wing = () => {
      ctx.beginPath();
      ctx.moveTo(...Q(1, -2));
      ctx.quadraticCurveTo(...Q(8, -13 * sp), ...Q(13, -9 * sp));
      ctx.quadraticCurveTo(...Q(11, -1), ...Q(7, 0));
      ctx.quadraticCurveTo(...Q(8, 6 * sp), ...Q(4, 6 * sp + 1));
      ctx.quadraticCurveTo(...Q(1, 3), ...Q(1, 0));
      ctx.closePath();
    };
    wing();
    ctx.save();
    ctx.shadowColor = 'rgba(255,214,150,0.95)';
    ctx.shadowBlur = 5 * RES;
    ctx.strokeStyle = 'rgba(255,224,176,0.95)';
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = INK;
    ctx.fill();
    // Lace: a gel eye-spot and a little punched hole.
    const [ex, ey] = Q(7.5, -5 * sp - 1);
    dot(ex, ey, 2.4 * s, k.gel);
    const [cx, cy] = Q(4.5, 3 * sp + 0.5);
    dot(cx, cy, 1 * s, 'rgba(255,220,170,0.8)');
  }
  poly([Pt(0, -4), Pt(1.8, 0), Pt(0, 6), Pt(-1.8, 0)], INK);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(...Pt(0, -4));
  ctx.quadraticCurveTo(...Pt(-1, -8), ...Pt(-3.5, -9));
  ctx.moveTo(...Pt(0, -4));
  ctx.quadraticCurveTo(...Pt(1, -8), ...Pt(3.5, -9));
  ctx.stroke();
  dot(0, 0, 0.9, '#c9a86a');
  // A firefly's tail is a lit gel bulb.
  if (kind === 'firefly') {
    glow(0, 5 * s, 9 * s, '#e6ff80', 0.9);
    dot(0, 4.5 * s, 2 * s, '#f2ffb4');
  }
}

/**
 * A bat puppet centred on (0, 0): black card wings with scalloped edges and a pale violet rim of
 * light (so it reads against the black castle), pointed ears and two amber gel eyes.
 */
function paintBat(up: boolean) {
  const sp = up ? 1 : 0.35;
  for (const side of [-1, 1]) {
    const X = (x: number) => x * side;
    ctx.beginPath();
    ctx.moveTo(X(3), -3);
    ctx.quadraticCurveTo(X(12), -12 * sp - 2, X(22), -10 * sp - 1);
    // The wing's trailing edge, scalloped between the finger bones.
    ctx.quadraticCurveTo(X(19), 1, X(15), 3 * sp + 2);
    ctx.quadraticCurveTo(X(12), 0, X(9), 5 * sp + 2);
    ctx.quadraticCurveTo(X(6), 2, X(3), 5);
    ctx.closePath();
    ctx.save();
    ctx.shadowColor = 'rgba(200,180,255,0.9)';
    ctx.shadowBlur = 4 * RES;
    ctx.strokeStyle = 'rgba(214,200,255,0.9)';
    ctx.lineWidth = 1.1;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = INK;
    ctx.fill();
    // Finger bones cut thin, so the screen glows through.
    ctx.strokeStyle = 'rgba(214,190,240,0.45)';
    ctx.lineWidth = 0.6;
    for (const [fx, fy] of [[15, 3 * sp + 1], [9, 5 * sp + 1]] as const) {
      ctx.beginPath();
      ctx.moveTo(X(4), -2);
      ctx.lineTo(X(fx), fy);
      ctx.stroke();
    }
    poly([[X(1.5), -5], [X(3.5), -10], [X(4.5), -4]], INK);
  }
  ctx.beginPath();
  ctx.ellipse(0, 0, 4.5, 6, 0, 0, 2 * PI);
  ctx.fillStyle = INK;
  ctx.fill();
  dot(-1.8, -2.5, 1.1, '#ffb050');
  dot(1.8, -2.5, 1.1, '#ffb050');
}

/**
 * The Great Owl, a shadow puppet centred on (0, 0): a broad body and wide wings with a pale rim of
 * light, ear tufts and two big amber gel eyes. `up` and down are its wing beats.
 */
function paintOwl(up: boolean) {
  const sp = up ? 1 : 0.3;
  for (const side of [-1, 1]) {
    const X = (x: number) => x * side;
    ctx.beginPath();
    ctx.moveTo(X(8), -6);
    ctx.quadraticCurveTo(X(30), -26 * sp - 6, X(56), -16 * sp - 4);
    ctx.quadraticCurveTo(X(48), 4, X(36), 10 * sp + 4);
    ctx.quadraticCurveTo(X(24), 2, X(14), 12 * sp + 2);
    ctx.quadraticCurveTo(X(10), 6, X(8), 10);
    ctx.closePath();
    ctx.save();
    ctx.shadowColor = 'rgba(255,220,180,0.9)';
    ctx.shadowBlur = 5 * RES;
    ctx.strokeStyle = 'rgba(255,230,200,0.85)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = INK;
    ctx.fill();
    // Feather lines cut thin, so the screen glows through.
    ctx.strokeStyle = 'rgba(255,220,180,0.4)';
    ctx.lineWidth = 0.7;
    for (const [fx, fy] of [[36, 10 * sp + 3], [24, 10 * sp + 1], [48, 0]] as const) {
      ctx.beginPath();
      ctx.moveTo(X(9), -3);
      ctx.lineTo(X(fx), fy);
      ctx.stroke();
    }
    // An ear tuft.
    poly([[X(4), -12], [X(9), -22], [X(11), -10]], INK);
  }
  ctx.beginPath();
  ctx.ellipse(0, 2, 11, 15, 0, 0, 2 * PI);
  ctx.fillStyle = INK;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -8, 11, 9, 0, 0, 2 * PI);
  ctx.fill();
  // Pale rim light round the head and the breast's lace.
  ctx.save();
  ctx.shadowColor = 'rgba(255,220,180,0.9)';
  ctx.shadowBlur = 4 * RES;
  ctx.strokeStyle = 'rgba(255,230,200,0.7)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, -8, 11, 9, 0, 0, 2 * PI);
  ctx.stroke();
  ctx.restore();
  for (let k = 0; k < 6; k++) dot((k % 2) * 4 - 2, 4 + k * 2.6, 0.8, 'rgba(255,220,180,0.4)');
  for (const side of [-1, 1]) {
    glow(side * 4.5, -8, 7, '#ffb050', 0.8);
    dot(side * 4.5, -8, 3.6, '#ffb84a');
    dot(side * 4.5, -8, 1.6, INK);
  }
  poly([[-1.5, -4], [1.5, -4], [0, -0.5]], '#ffd8a0');
}

/**
 * A ship sailing in to the harbour (LK15), a cut-card puppet centred on (0, 0) facing right: a hull
 * with portholes, two masts with gel sails lit from behind and a lantern at the bow.
 */
function paintShip() {
  ctx.save();
  ctx.shadowColor = 'rgba(200,220,255,0.8)';
  ctx.shadowBlur = 4 * RES;
  poly([[-44, 12], [44, 12], [34, 28], [-38, 28]], INK);
  ctx.restore();
  poly([[-44, 12], [44, 12], [34, 28], [-38, 28]], INK);
  for (const x of [-24, -8, 8, 24]) cut([[x - 2.5, 18], [x + 2.5, 18], [x + 2.5, 22], [x - 2.5, 22]], '#ffd890');
  for (const [mx, top] of [[-14, -34], [14, -28]] as const) {
    poly([[mx - 1.5, top], [mx + 1.5, top], [mx + 1.5, 12], [mx - 1.5, 12]], INK);
    ctx.save();
    ctx.globalAlpha = 0.75;
    poly([[mx - 14, top + 6], [mx + 14, top + 6], [mx + 12, 6], [mx - 12, 6]], '#f4e2c8');
    ctx.restore();
    poly([[mx - 15, top + 4], [mx + 15, top + 4], [mx + 15, top + 7], [mx - 15, top + 7]], INK);
  }
  poly([[44, 12], [56, 4], [57, 6], [46, 14]], INK);
  glow(52, 2, 9, '#ffc060', 0.9);
  dot(52, 2, 2.4, '#ffe0a0');
}

/** The owl warning plaque, with a pair of owl eyes. */
function paintOwlTag() {
  paintPlaque(GUST_TAG.w, GUST_TAG.h, 'rgba(255,220,180,0.55)');
  for (const x of [13, 25]) {
    glow(x, 20, 8, '#ffb050', 0.7);
    dot(x, 20, 5, '#ffb84a');
    dot(x, 20, 2.2, INK);
  }
  poly([[6, 14], [11, 8], [13, 14]], '#ffd8a0');
  poly([[25, 14], [27, 8], [32, 14]], '#ffd8a0');
}

/** The window-call plaque: a plaque with a lit cottage window on its left. */
function paintCallTag() {
  paintPlaque(CALL_TAG.w, CALL_TAG.h, 'rgba(255,200,140,0.55)');
  glow(20, 20, 16, '#ffc060', 0.7);
  poly([[10, 11], [30, 11], [30, 29], [10, 29]], '#ffd890');
  poly([[19, 11], [21, 11], [21, 29], [19, 29]], INK);
  poly([[10, 19], [30, 19], [30, 21], [10, 21]], INK);
  poly([[8, 9], [32, 9], [32, 11], [8, 11]], INK);
  poly([[8, 29], [32, 29], [32, 31], [8, 31]], INK);
}

/** The oil cask on the HUD and its shop card: a barrel with two hoops, centred on (0, 0). */
function paintCask(full: boolean) {
  ctx.beginPath();
  ctx.moveTo(-9, -12);
  ctx.quadraticCurveTo(-13, 0, -9, 12);
  ctx.lineTo(9, 12);
  ctx.quadraticCurveTo(13, 0, 9, -12);
  ctx.closePath();
  ctx.fillStyle = full ? '#b07a44' : '#5a4a44';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  for (const y of [-6, 6]) poly([[-12, y - 1.2], [12, y - 1.2], [12, y + 1.2], [-12, y + 1.2]], INK);
  poly([[-10, -12.5], [10, -12.5], [10, -10.5], [-10, -10.5]], INK);
  poly([[-10, 10.5], [10, 10.5], [10, 12.5], [-10, 12.5]], INK);
  if (full) {
    glow(0, 0, 12, '#ffc060', 0.5);
    dot(0, 0, 2.8, '#ffd880');
  }
}

/** A paper sky lantern for the Great Festival: a gel shade in a card frame, glowing, centred on (0, 0). */
function paintSkyLantern() {
  glow(0, 0, 26, '#ffb050', 0.8);
  poly([[-9, -12], [9, -12], [12, 10], [-12, 10]], INK);
  poly([[-7, -10], [7, -10], [9.5, 8], [-9.5, 8]], '#ffc870');
  poly([[-1, -10], [1, -10], [1, 8], [-1, 8]], INK);
  poly([[-12, 10], [12, 10], [10, 13], [-10, 13]], INK);
  dot(0, 9, 2, '#fff2c8');
}

/** Mist banks drifting across the castle on a foggy night: soft pale bands, full screen at 1x. */
function paintFog() {
  reseed(21);
  for (let i = 0; i < Math.round((14 * VW) / W); i++) {
    const x = -FX + rnd() * VW;
    const y = 160 + rnd() * 330;
    const rx = 140 + rnd() * 160;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.16 + rnd() * 0.08);
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(226,214,236,0.5)');
    g.addColorStop(0.6, 'rgba(210,198,226,0.22)');
    g.addColorStop(1, 'rgba(210,198,226,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-rx, -rx, 2 * rx, 2 * rx);
    ctx.restore();
  }
}

/** Feast-night bunting: cut-card pennants with gel windows on cords from the towers to the keep. */
function paintBunting() {
  const strings: [P, P][] = [
    [[TOWERS[0].x + TOWERS[0].w, 196], [KEEP.x, 134]],
    [[KEEP.x + KEEP.w, 134], [TOWERS[1].x, 196]],
    [[WALL.x + 6, 324], [TOWERS[0].x, 214]],
    [[TOWERS[1].x + TOWERS[1].w, 214], [WALL.x + WALL.w - 6, 324]],
  ];
  const gels = ['#ffc870', '#ff9a8a', '#9ad8c8', '#c8a8ff'];
  strings.forEach(([a, b], k) => {
    const sag = 26;
    const at = (t: number): P => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(t * PI) * sag];
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let t = 0; t <= 1.001; t += 0.05) {
      const [x, y] = at(t);
      if (t === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    const n = 7;
    for (let i = 1; i < n; i++) {
      const [x, y] = at(i / n);
      poly([[x - 6, y], [x + 6, y], [x, y + 13]], INK);
      ctx.save();
      ctx.globalAlpha = 0.85;
      poly([[x - 3, y + 2], [x + 3, y + 2], [x, y + 8]], gels[(i + k) % gels.length]);
      ctx.restore();
    }
  });
}

/** The night kind's emblem on its plaque, centred on (0, 0). */
function paintKindIcon(kind: NightKind) {
  if (kind === 'clear') {
    // A crescent moon.
    glow(0, 0, 14, '#ffe6c0', 0.5);
    dot(0, 0, 8, '#fff1d8');
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    dot(4, -3, 7, '#000');
    ctx.restore();
  } else if (kind === 'fog') {
    ctx.strokeStyle = '#d8cce8';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    for (const [y, w] of [[-5, 9], [0, 11], [5, 8]] as const) {
      ctx.beginPath();
      ctx.moveTo(-w, y);
      ctx.quadraticCurveTo(-w / 2, y - 3, 0, y);
      ctx.quadraticCurveTo(w / 2, y + 3, w, y);
      ctx.stroke();
    }
  } else if (kind === 'feast') {
    // A pennant on a pole.
    poly([[-7, -10], [-5, -10], [-5, 11], [-7, 11]], '#d89a50');
    poly([[-5, -9], [9, -5], [3, -2], [9, 1], [-5, 4]], '#ff9a8a');
    glow(0, -3, 12, '#ffb070', 0.5);
  } else {
    // A storm cloud with a bolt.
    glow(0, 0, 14, '#9ec4ff', 0.4);
    dot(-4, -1, 5, '#9eb0d0');
    dot(3, -3, 6, '#9eb0d0');
    poly([[-9, 0], [9, 0], [9, 3], [-9, 3]], '#9eb0d0');
    poly([[1, 3], [-3, 9], [0, 9], [-2, 14], [4, 7], [1, 7], [3, 3]], '#ffe27a');
  }
}

/** The night kind plaque: a plaque with a ring for the kind's emblem. */
function paintKindTag() {
  paintPlaque(KIND_TAG.w, KIND_TAG.h);
  ctx.strokeStyle = 'rgba(255,190,120,0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(22, KIND_TAG.h / 2, 14, 0, 2 * PI);
  ctx.stroke();
}

/**
 * Plaques, cards and panels are baked with PAD view pixels of room around them for their soft
 * shadow; the scene places such a texture at (x - PAD, y - PAD) with origin 0.
 */
export const PAD = 8;

/** A black card plaque with a punched lace border, `w` x `h` at (0, 0). */
function paintPlaque(w: number, h: number, edge = 'rgba(255,190,120,0.55)', step = 6) {
  ctx.save();
  ctx.filter = 'blur(3px)';
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(2, 3, w, h);
  ctx.restore();
  rrect(0, 0, w, h, 4);
  ctx.fillStyle = INK;
  ctx.fill();
  for (let t = 6; t < w - 3; t += step) for (const yy of [4, h - 4]) dot(t, yy, 1, edge);
  for (let t = 10; t < h - 6; t += step) for (const xx of [4, w - 4]) dot(xx, t, 1, edge);
}

/** A carved panel: a plaque with a double lace border and corner rosettes. */
function paintPanel(w: number, h: number) {
  paintPlaque(w, h, 'rgba(255,190,120,0.6)', 8);
  ctx.strokeStyle = 'rgba(216,154,80,0.55)';
  ctx.lineWidth = 1.2;
  rrect(12, 12, w - 24, h - 24, 6);
  ctx.stroke();
  for (const [cx, cy] of [[12, 12], [w - 12, 12], [12, h - 12], [w - 12, h - 12]] as const) {
    dot(cx, cy, 7, INK);
    ctx.strokeStyle = 'rgba(255,190,120,0.8)';
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, 2 * PI);
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 2 * PI;
      dot(cx + Math.cos(a) * 3.2, cy + Math.sin(a) * 3.2, 1.1, '#ffbe6a');
    }
  }
}

/** A carved card button `w` x `h`; `lit` gives it a glowing amber rim. */
function paintCard(w: number, h: number, lit: boolean, hover = false) {
  ctx.save();
  ctx.filter = 'blur(2px)';
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(1, 2, w, h);
  ctx.restore();
  rrect(0, 0, w, h, 6);
  ctx.fillStyle = hover ? '#2a1d22' : lit ? '#1a1218' : '#121016';
  ctx.fill();
  ctx.save();
  if (lit) {
    ctx.shadowColor = 'rgba(255,170,80,0.9)';
    ctx.shadowBlur = 6 * RES;
  }
  ctx.strokeStyle = lit ? '#e8a656' : '#4a3e4a';
  ctx.lineWidth = 1.6;
  rrect(0, 0, w, h, 6);
  ctx.stroke();
  ctx.restore();
  const edge = lit ? 'rgba(255,190,120,0.55)' : 'rgba(160,140,150,0.3)';
  for (let t = 9; t < w - 6; t += 7) for (const yy of [5, h - 5]) dot(t, yy, 0.8, edge);
}

/** A hearth flame on the HUD, lit or gone out, centred on (0, 0). */
function paintHearth(lit: boolean) {
  const flame = () => {
    ctx.beginPath();
    ctx.moveTo(-6, 7);
    ctx.quadraticCurveTo(-7, -2, 0, -10);
    ctx.quadraticCurveTo(7, -2, 6, 7);
    ctx.closePath();
  };
  if (lit) {
    glow(0, 0, 14, '#ff9a40', 0.8);
    flame();
    ctx.fillStyle = '#ffa850';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-2.5, 7);
    ctx.quadraticCurveTo(-3, 2, 0, -2);
    ctx.quadraticCurveTo(3, 2, 2.5, 7);
    ctx.closePath();
    ctx.fillStyle = '#fff2c8';
    ctx.fill();
  } else {
    flame();
    ctx.strokeStyle = 'rgba(200,160,130,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  poly([[-8, 7], [8, 7], [8, 10], [-8, 10]], '#8a5a34');
}

function paintCoin() {
  glow(0, 0, 14, '#ffb040', 0.6);
  dot(0, 0, 8, '#ffc860');
  ctx.beginPath();
  ctx.arc(0, 0, 5, 0, 2 * PI);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

/** The HUD: a black proscenium strip with a scalloped lower edge and the dusk bar's trough. */
function paintHud() {
  ctx.fillStyle = INK;
  ctx.fillRect(-FX, 0, VW, 38);
  for (let x = -FX; x < W + FX; x += 12) {
    ctx.beginPath();
    ctx.arc(x + 6, 38, 6, 0, PI);
    ctx.fill();
  }
  for (let x = -FX; x < W + FX; x += 12) dot(x + 6, 38, 1.2, 'rgba(255,180,110,0.6)');
  const D = DUSK;
  rrect(D.x, D.y, D.w, D.h, 8);
  ctx.fillStyle = '#2a2040';
  ctx.fill();
}
function paintDuskRim() {
  rrect(1, 1, DUSK.w, DUSK.h, 8);
  ctx.strokeStyle = '#8a5a34';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}
function paintDuskFill() {
  ctx.save();
  rrect(0, 0, DUSK.w, DUSK.h, 8);
  ctx.clip();
  const dg = ctx.createLinearGradient(0, 0, DUSK.w, 0);
  dg.addColorStop(0, '#c45a3a');
  dg.addColorStop(1, '#ffbe6a');
  ctx.fillStyle = dg;
  ctx.fillRect(0, 0, DUSK.w, DUSK.h);
  ctx.restore();
}

/** The herald's order card: a plaque with a pennant on its left and a reward seal on its right. */
function paintOrderCard() {
  const { w, h } = ORDER;
  paintPlaque(w, h);
  poly([[13, 11], [15, 11], [15, 47], [13, 47]], '#d89a50');
  poly([[15, 12], [34, 17], [27, 20], [34, 24], [15, 27]], '#ffbe6a');
  glow(w - 24, 18, 20, '#ffb050', 0.6);
  dot(w - 24, 18, 14, '#ffc870');
}

/** A small arched window pip for the order card: lit amber or dark slate. */
function paintPip(lit: boolean) {
  if (lit) glow(0, 0, 10, '#ffb560', 0.7);
  ctx.beginPath();
  ctx.moveTo(-4, 5);
  ctx.lineTo(-4, -2);
  ctx.arc(0, -2, 4, PI, 0);
  ctx.lineTo(4, 5);
  ctx.closePath();
  ctx.fillStyle = lit ? '#ffcf6a' : '#4a5070';
  ctx.fill();
}

/** The gust warning plaque, with a puppet wind spirit's head puffing its cheeks. */
function paintGustTag() {
  paintPlaque(GUST_TAG.w, GUST_TAG.h);
  dot(18, 20, 10, '#9ec4ff');
  dot(22, 22, 4.5, INK);
  dot(15, 16, 1.4, INK);
  dot(27, 22, 1.6, '#9ec4ff');
}

/** The "Save it" tag over a nearly dry lantern, with its pointer. */
export const SAVE_TAG = { w: 84, h: 22 };
function paintSaveTag() {
  paintPlaque(SAVE_TAG.w, SAVE_TAG.h, 'rgba(255,160,90,0.6)', 6);
  poly([[SAVE_TAG.w / 2 - 5, SAVE_TAG.h - 0.5], [SAVE_TAG.w / 2 + 5, SAVE_TAG.h - 0.5], [SAVE_TAG.w / 2, SAVE_TAG.h + 6]], INK);
}

/**
 * Bakes the scenery of district `id` as `castle-<id>`, a full-view layer. `bakeTextures` bakes
 * the keep's; the scene bakes another district's the first time the keep moves there.
 */
export function bakeScenery(scene: Phaser.Scene, id: DistrictId) {
  bake(scene, `castle-${id}`, VW, VH, () => paintScenery(id), FX, FY, BACK_RES);
}

/** Bakes every texture the scene uses. */
export function bakeTextures(scene: Phaser.Scene) {
  // The full-view layers cover the whole view, whatever the screen's shape, with the designed
  // frame (where the castle stands) in its middle.
  const view = viewSize(scene);
  const frame = viewFrame(scene);
  VW = view.width;
  VH = view.height;
  FX = frame.x;
  FY = frame.y;
  // Sized by the widest texture of each kind: the sprites and plaques, the HUD bar and the full-view layers.
  RES = sharpRes(W, 48, 2);
  HUD_RES = sharpRes(VW, 48, 2);
  BACK_RES = sharpRes(VW, VH, 1);
  SCREENS.forEach((key, i) => bake(scene, key, VW, VH, () => paintScreen(SCREEN_STOPS[i], [0.4, 0.35, 0.18][i]), FX, FY, BACK_RES));
  bakeScenery(scene, 'keep');
  bake(scene, 'stars', VW, 300 + FY, paintStars, FX, FY, BACK_RES);
  bake(scene, 'moon', 100, 100, paintMoon, 50, 50);
  bake(scene, 'glow', 128, 128, () => glow(64, 64, 64, '#ffbe6a', 1), 0, 0, 1);
  bake(scene, 'glow-pale', 128, 128, () => glow(64, 64, 64, '#ffe0a0', 1), 0, 0, 1);
  bake(scene, 'lantern-lit', 32, lampH('plain'), () => paintLantern(true), 16, LAMP_Y);
  bake(scene, 'lantern-dark', 32, lampH('plain'), () => paintLantern(false), 16, LAMP_Y);
  for (const kind of ['beacon', 'candle', 'bell'] as const satisfies readonly LanternKind[]) {
    bake(scene, `lantern-${kind}-lit`, 32, lampH(kind), () => paintLantern(true, kind), 16, LAMP_Y);
    bake(scene, `lantern-${kind}-dark`, 32, lampH(kind), () => paintLantern(false, kind), 16, LAMP_Y);
  }
  bake(scene, 'flame', 10, 16, paintFlame, 5, 8);
  for (const kind of Object.keys(MOTH_LOOK) as MothKind[]) {
    bake(scene, `moth-${kind}-up`, 56, 52, () => paintMoth(kind, true), 28, 26);
    bake(scene, `moth-${kind}-down`, 56, 52, () => paintMoth(kind, false), 28, 26);
  }
  bake(scene, 'bat-up', 56, 40, () => paintBat(true), 28, 20);
  bake(scene, 'bat-down', 56, 40, () => paintBat(false), 28, 20);
  bake(scene, 'owl-up', 120, 70, () => paintOwl(true), 60, 36);
  bake(scene, 'owl-down', 120, 70, () => paintOwl(false), 60, 36);
  bake(scene, 'ship', 124, 76, paintShip, 62, 40);
  bake(scene, 'cask-full', 30, 30, () => paintCask(true), 15, 15);
  bake(scene, 'cask-empty', 30, 30, () => paintCask(false), 15, 15);
  bake(scene, 'sky-lantern', 56, 56, paintSkyLantern, 28, 28);
  // The second jar (LK14), drawn by the scene where JARS puts it; its foot is 22 below the centre.
  bake(scene, 'jar', 48, 56, () => paintJar(0, 0), 24, 28);
  bake(scene, 'fog', VW, VH, paintFog, FX, FY, BACK_RES);
  bake(scene, 'bunting', VW, VH, paintBunting, FX, FY, BACK_RES);
  for (const kind of ['clear', 'fog', 'feast', 'storm'] as const satisfies readonly NightKind[]) {
    bake(scene, `kind-${kind}`, 32, 32, () => paintKindIcon(kind), 16, 16);
  }
  bake(scene, 'hud', VW, 48, paintHud, FX, 0, HUD_RES);
  bake(scene, 'dusk-fill', DUSK.w, DUSK.h, paintDuskFill);
  bake(scene, 'dusk-rim', DUSK.w + 2, DUSK.h + 2, paintDuskRim);
  bake(scene, 'sun', 40, 40, () => {
    glow(20, 20, 18, '#ffc070', 0.9);
    dot(20, 20, 6, '#fff0c8');
  });
  bake(scene, 'hearth-lit', 30, 30, () => paintHearth(true), 15, 15);
  bake(scene, 'hearth-out', 30, 30, () => paintHearth(false), 15, 15);
  bake(scene, 'coin', 30, 30, paintCoin, 15, 15);
  const padded = (key: string, w: number, h: number, paint: () => void) => bake(scene, key, w + 2 * PAD, h + 2 * PAD, paint, PAD, PAD);
  padded('order-card', ORDER.w, ORDER.h, paintOrderCard);
  bake(scene, 'pip-lit', 20, 20, () => paintPip(true), 10, 10);
  bake(scene, 'pip-dark', 20, 20, () => paintPip(false), 10, 10);
  padded('gust-tag', GUST_TAG.w, GUST_TAG.h, paintGustTag);
  padded('owl-tag', GUST_TAG.w, GUST_TAG.h, paintOwlTag);
  padded('call-tag', CALL_TAG.w, CALL_TAG.h, paintCallTag);
  padded('kind-tag', KIND_TAG.w, KIND_TAG.h, paintKindTag);
  padded('save-tag', SAVE_TAG.w, SAVE_TAG.h, paintSaveTag);
  bake(scene, 'spark', 12, 12, () => {
    glow(6, 6, 6, '#ffe8b0', 0.9);
    dot(6, 6, 1.4, '#fff6dc');
  });
  padded('panel', NIGHT_PANEL.w, NIGHT_PANEL.h, () => paintPanel(NIGHT_PANEL.w, NIGHT_PANEL.h));
  padded('panel-small', SMALL_PANEL.w, SMALL_PANEL.h, () => paintPanel(SMALL_PANEL.w, SMALL_PANEL.h));
  padded('panel-move', MOVE_PANEL.w, MOVE_PANEL.h, () => paintPanel(MOVE_PANEL.w, MOVE_PANEL.h));
  padded('card-on', SHOP.w, SHOP.h, () => paintCard(SHOP.w, SHOP.h, true));
  padded('card-off', SHOP.w, SHOP.h, () => paintCard(SHOP.w, SHOP.h, false));
  padded('card-wide-on', MOVE_CARDS.w, MOVE_CARDS.h, () => paintCard(MOVE_CARDS.w, MOVE_CARDS.h, true));
  padded('card-wide-off', MOVE_CARDS.w, MOVE_CARDS.h, () => paintCard(MOVE_CARDS.w, MOVE_CARDS.h, false));
  padded('btn', 200, 40, () => paintCard(200, 40, true));
  padded('btn-hover', 200, 40, () => paintCard(200, 40, true, true));
  // The narrower buttons of the Great Festival's three ways on (LK20).
  padded('btn-180', 180, 40, () => paintCard(180, 40, true));
  padded('btn-180-hover', 180, 40, () => paintCard(180, 40, true, true));
}
