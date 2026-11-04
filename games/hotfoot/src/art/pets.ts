import Phaser from 'phaser';
import { C, circle, gold, hl, oval, paint, poly, type Ctx, type Pt } from './ink';

// The companions, as beasts from a bestiary's margin, facing right to run with the knight: a
// tawny owl with gold eyes, a lean hound in a madder collar and a red fox with a white-tipped
// brush. Each has two frames (wings up and down, or the two strides of a run), painted in page
// units and scaled down by half.

/** Each companion's texture size and where it stands: the owl is centred on its body, the hound and fox on their feet. */
export const PET_ART = {
  owl: { w: 52, h: 44, x: 26, y: 24 },
  hound: { w: 62, h: 42, x: 31, y: 39 },
  fox: { w: 64, h: 38, x: 32, y: 35 },
};

const S = 0.5;

/** A thin inked leg from `hip` to `foot`, `w` wide. */
function leg(ctx: Ctx, hip: Pt, foot: Pt, w: number, fill: string) {
  const dx = foot[0] - hip[0];
  const dy = foot[1] - hip[1];
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * (w / 2);
  const oy = (dx / len) * (w / 2);
  poly(ctx, [[hip[0] + ox, hip[1] + oy], [foot[0] + ox, foot[1] + oy], [foot[0] - ox, foot[1] - oy], [hip[0] - ox, hip[1] - oy]], fill, 2);
}

function owl(ctx: Ctx, frame: number) {
  const up = frame === 0;
  // Wings, spread up or swept down.
  for (const side of [-1, 1]) {
    const tip: Pt = up ? [side * 46, -30] : [side * 44, 18];
    poly(ctx, [[side * 10, -10], tip, [side * 30, up ? -4 : 22], [side * 14, 10]], '#7a4a2a', 2.5);
    hl(ctx, [[side * 14, -8], [side * (up ? 36 : 34), up ? -22 : 12]], 1.5);
  }
  oval(ctx, 0, 0, 17, 21, C.wood, 3);
  // Breast speckles.
  ctx.fillStyle = 'rgba(43,27,18,0.45)';
  for (const [x, y] of [[-6, 6], [4, 9], [-2, 14], [7, 2], [-8, 13]]) {
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  poly(ctx, [[-14, -14], [-12, -28], [-4, -18]], C.wood, 2);
  poly(ctx, [[14, -14], [12, -28], [4, -18]], C.wood, 2);
  oval(ctx, 0, -10, 13, 10, C.vellumDark, 2);
  circle(ctx, -5, -11, 4.5, C.goldLight, 1.5);
  circle(ctx, 5, -11, 4.5, C.goldLight, 1.5);
  circle(ctx, -4.5, -11, 2, C.ink, 0);
  circle(ctx, 5.5, -11, 2, C.ink, 0);
  poly(ctx, [[-2, -6], [2, -6], [0, -1]], C.gold, 1.2);
}

function hound(ctx: Ctx, frame: number) {
  const k = frame === 0 ? 1 : -1;
  const coat = '#b08a5a';
  const far = '#8f6c42';
  // Legs: far pair first, then near, reaching out and tucked by turns.
  leg(ctx, [-26, -30], [-38 * (k > 0 ? 1 : 0.6), 0], 7, far);
  leg(ctx, [24, -30], [k > 0 ? 30 : 40, 0], 7, far);
  // The tail, raised.
  ctx.beginPath();
  ctx.moveTo(-32, -38);
  ctx.quadraticCurveTo(-50, -44, -52, -62);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.strokeStyle = coat;
  ctx.lineWidth = 3;
  ctx.stroke();
  oval(ctx, 0, -38, 36, 13, coat, 2.5);
  hl(ctx, [[-24, -46], [16, -48]], 1.5);
  leg(ctx, [-22, -32], [k > 0 ? -16 : -34, 0], 8, coat);
  leg(ctx, [26, -32], [k > 0 ? 44 : 22, 0], 8, coat);
  // Neck, head and muzzle.
  poly(ctx, [[22, -46], [34, -66], [46, -60], [36, -36]], coat, 2.5);
  oval(ctx, 42, -64, 13, 10, coat, 2.5);
  poly(ctx, [[48, -70], [66, -62], [64, -56], [48, -56]], coat, 2.5);
  circle(ctx, 65, -61, 3, C.ink, 0);
  circle(ctx, 44, -67, 2.2, C.ink, 0);
  poly(ctx, [[36, -72], [30, -52], [40, -58]], far, 2);
  // The madder collar with a gold bell.
  poly(ctx, [[30, -58], [40, -64], [44, -56], [34, -50]], C.madder, 1.5);
  circle(ctx, 38, -50, 3, C.goldLight, 1.2);
}

function fox(ctx: Ctx, frame: number) {
  const k = frame === 0 ? 1 : -1;
  const red = '#d9792e';
  const dark = C.ink;
  leg(ctx, [-20, -24], [k > 0 ? -32 : -14, 0], 6, '#4a3020');
  leg(ctx, [18, -24], [k > 0 ? 24 : 34, 0], 6, '#4a3020');
  // The brush, long and full, with its white tip.
  ctx.save();
  ctx.translate(-30, -30);
  ctx.rotate(k > 0 ? -0.25 : -0.1);
  oval(ctx, -24, 0, 28, 10, red, 2.5);
  oval(ctx, -46, -1, 8, 7, '#fff8e8', 2);
  ctx.restore();
  oval(ctx, 0, -30, 30, 12, red, 2.5);
  poly(ctx, [[10, -24], [28, -22], [22, -16], [8, -18]], '#fff8e8', 1.5);
  hl(ctx, [[-20, -38], [12, -40]], 1.5);
  leg(ctx, [-16, -24], [k > 0 ? -8 : -26, 0], 7, dark);
  leg(ctx, [20, -24], [k > 0 ? 36 : 16, 0], 7, dark);
  // Head: pointed ears, a long snout and a white cheek.
  oval(ctx, 34, -44, 12, 10, red, 2.5);
  poly(ctx, [[26, -50], [28, -66], [36, -52]], red, 2);
  poly(ctx, [[36, -52], [42, -66], [44, -50]], red, 2);
  poly(ctx, [[40, -48], [60, -42], [40, -36]], red, 2.5);
  poly(ctx, [[36, -40], [52, -40], [40, -34]], '#fff8e8', 1.5);
  circle(ctx, 60, -42, 2.6, dark, 0);
  circle(ctx, 38, -47, 2.2, dark, 0);
}

const DRAW = { owl, hound, fox };

/** Bakes `owl-0`, `owl-1`, `hound-0`, `hound-1`, `fox-0` and `fox-1`, and a gold ring for the fox's guard (`fox-guard`). */
export function bakePets(scene: Phaser.Scene) {
  for (const id of ['owl', 'hound', 'fox'] as const) {
    const a = PET_ART[id];
    for (const frame of [0, 1]) {
      paint(scene, `${id}-${frame}`, a.w, a.h, (ctx) => {
        ctx.translate(a.x, a.y);
        ctx.scale(S, S);
        DRAW[id](ctx, frame);
      });
    }
  }
  // A little gold ring the fox wears while it is ready to take a hit.
  paint(scene, 'fox-guard', 14, 14, (ctx) => {
    ctx.beginPath();
    ctx.arc(7, 7, 5, 0, Math.PI * 2);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.strokeStyle = gold(ctx, 2, 2, 12, 12);
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}
