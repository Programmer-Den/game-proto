import Phaser from 'phaser';
import { KNIGHT_IDS, type KnightId } from '../game/knights';
import { C, gold, hl, paint, poly, type Ctx, type Pt } from './ink';

/** A knight's colours: the surcoat, the helm, and the plume or, for the heavy knight, a fan crest. */
interface Look {
  coat: string;
  helm: string;
  plume: string | null;
  crest: boolean;
  /** The gold boots from the challenge courses, gilding the sabatons. */
  boots?: boolean;
}
const LOOKS: Record<KnightId, Look> = {
  knight: { coat: C.lapis, helm: C.silver, plume: C.verm, crest: false },
  squire: { coat: C.leaf, helm: C.silver, plume: C.goldLight, crest: false },
  heavy: { coat: C.madder, helm: C.iron, plume: null, crest: true },
};

// The knight as a figure from a miniature: a lapis surcoat with a gold cross (never red), mail and
// plate in silver, a great helm with a vermilion plume, and a sword held forward. Each pose is painted
// into its own texture. Poses are written in page units with the feet at (0, 0), scaled by `S`.
// The standing poses are 104x100 px with the feet at (52, 94); the slide is 108x42 with the feet at
// (66, 38). GameScene sets the origins from `KNIGHT_FEET`. Each knight of `KNIGHT_IDS` has their own
// look (`LOOKS`): the knight in lapis with a vermilion plume, the squire in green with a gold plume,
// and the heavy knight in madder with an iron helm and a gold fan crest; their poses are painted as
// `<knight>-<pose>` (`knight-run0`, `squire-run0`, `heavy-run0`...), and again with the gold boots
// won on the challenge courses as `<knight>-gold-<pose>` (`knight-gold-run0`...).

export type KnightPose = 'run0' | 'run1' | 'run2' | 'run3' | 'jump' | 'fall' | 'slide';

const S = 0.5;
export const KNIGHT_FEET = {
  stand: { w: 104, h: 100, x: 52, y: 94 },
  slide: { w: 108, h: 42, x: 66, y: 38 },
};

type Leg = [Pt, Pt, Pt];
interface Pose {
  /** Lift of the body, in page units (negative is up). */
  bob: number;
  back: Leg;
  front: Leg;
  /** The free arm's hand, from its shoulder at (-16, -94). */
  hand: Pt;
  /** The sword hand, from its shoulder at (18, -94), and the sword's angle (radians, 0 is forward). */
  grip: Pt;
  sword: number;
}

const POSES: Record<Exclude<KnightPose, 'slide'>, Pose> = {
  run0: { bob: 0, back: [[-8, -52], [-20, -30], [-36, -12]], front: [[6, -52], [20, -30], [24, -4]], hand: [-26, -66], grip: [40, -74], sword: -0.75 },
  run1: { bob: -4, back: [[-6, -52], [-2, -28], [-18, -18]], front: [[6, -52], [8, -28], [2, -4]], hand: [-18, -64], grip: [42, -76], sword: -0.7 },
  run2: { bob: 0, back: [[-6, -52], [10, -30], [18, -4]], front: [[6, -52], [-8, -30], [-26, -12]], hand: [-6, -64], grip: [40, -72], sword: -0.8 },
  run3: { bob: -4, back: [[-6, -52], [0, -28], [-4, -4]], front: [[6, -52], [4, -28], [-10, -18]], hand: [-18, -64], grip: [42, -76], sword: -0.7 },
  jump: { bob: 0, back: [[-11, -51], [-18, -24], [-21, -10]], front: [[10, -51], [23, -32], [30, -19]], hand: [-43, -122], grip: [44, -68], sword: -0.62 },
  fall: { bob: 0, back: [[-8, -52], [-14, -28], [-16, -4]], front: [[8, -52], [16, -28], [14, -2]], hand: [-40, -120], grip: [42, -104], sword: -1.0 },
};

/** A limb segment as an inked quad of width `w` from `a` to `b`. */
function limb(ctx: Ctx, a: Pt, b: Pt, w: number, fill: string) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy) || 1;
  const ox = (-dy / len) * (w / 2);
  const oy = (dx / len) * (w / 2);
  poly(ctx, [[a[0] + ox, a[1] + oy], [b[0] + ox, b[1] + oy], [b[0] - ox, b[1] - oy], [a[0] - ox, a[1] - oy]], fill, 2.5);
}

/** A leg in plate: thigh, shin and a pointed sabaton facing forward. */
function leg(ctx: Ctx, [hip, knee, foot]: Leg, near: boolean, boots = false) {
  const fill = near ? C.steel : C.iron;
  limb(ctx, hip, knee, 16, fill);
  limb(ctx, knee, foot, 14, fill);
  const [fx, fy] = foot;
  const sabaton: Pt[] = [[fx - 8, fy - 6], [fx + 6, fy - 6], [fx + 16, fy], [fx - 8, fy + 2]];
  if (!boots) {
    poly(ctx, sabaton, near ? C.iron : '#6e7388', 2.5);
    return;
  }
  // Gold boots: the sabaton and a cuff above it in gold leaf.
  poly(ctx, [[fx - 9, fy - 14], [fx + 7, fy - 14], [fx + 7, fy - 6], [fx - 9, fy - 6]], gold(ctx, fx - 9, fy - 14, fx + 7, fy - 6), 2);
  poly(ctx, sabaton, gold(ctx, fx - 8, fy - 6, fx + 16, fy + 2), 2.5);
  hl(ctx, [[fx - 5, fy - 4], [fx + 6, fy - 4]], 1.5);
}

/** An arm from `shoulder` to `hand`, with a mailed fist. */
function arm(ctx: Ctx, shoulder: Pt, hand: Pt, near: boolean) {
  limb(ctx, shoulder, hand, 12, near ? C.steel : C.iron);
  poly(ctx, [[hand[0] - 6, hand[1] - 6], [hand[0] + 6, hand[1] - 6], [hand[0] + 6, hand[1] + 6], [hand[0] - 6, hand[1] + 6]], near ? C.iron : '#6e7388', 2);
}

/** A sword held at `hand`, pointing along `angle`: a silver blade, gold crossguard and pommel. */
function sword(ctx: Ctx, hand: Pt, angle: number) {
  const [x, y] = hand;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const at = (along: number, across: number): Pt => [x + c * along - s * across, y + s * along + c * across];
  poly(ctx, [at(8, -4), at(62, -3), at(70, 0), at(62, 3), at(8, 4)], '#e4e8f0', 2);
  hl(ctx, [at(12, -1.5), at(58, -1.5)], 1.5);
  poly(ctx, [at(4, -12), at(9, -12), at(9, 12), at(4, 12)], C.gold, 2);
  poly(ctx, [at(-10, -3), at(4, -3), at(4, 3), at(-10, 3)], C.woodDark, 1.5);
  const [px, py] = at(-12, 0);
  ctx.beginPath();
  ctx.arc(px, py, 4, 0, Math.PI * 2);
  ctx.fillStyle = C.gold;
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** The surcoat with its gold cross and belt, the helm and its plume, around the hips at (0, -52). */
function body(ctx: Ctx, look: Look) {
  poly(ctx, [[-22, -100], [22, -100], [28, -50], [12, -44], [0, -50], [-12, -44], [-30, -50]], look.coat, 3);
  hl(ctx, [[-18, -96], [-24, -54]], 2);
  // The cross is gold leaf, never red.
  poly(ctx, [[-3, -92], [3, -92], [3, -82], [13, -82], [13, -76], [3, -76], [3, -58], [-3, -58], [-3, -76], [-13, -76], [-13, -82], [-3, -82]], gold(ctx, -12, -92, 12, -58), 1.5);
  poly(ctx, [[-24, -54], [24, -54], [24, -48], [-24, -48]], C.woodDark, 2);
  // The great helm with its eye slit.
  ctx.beginPath();
  ctx.moveTo(-22, -100);
  ctx.lineTo(-22, -126);
  ctx.quadraticCurveTo(-20, -146, 0, -146);
  ctx.quadraticCurveTo(24, -146, 26, -122);
  ctx.lineTo(24, -100);
  ctx.closePath();
  ctx.fillStyle = look.helm;
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 3;
  ctx.stroke();
  poly(ctx, [[4, -126], [25, -126], [25, -120], [4, -120]], C.ink, 1);
  hl(ctx, [[-16, -104], [-16, -128], [-6, -140]], 2.5);
  if (look.crest) {
    // The heavy knight's fan crest of gold leaf along the top of the helm.
    poly(ctx, [[-16, -142], [-20, -162], [-8, -170], [6, -172], [18, -164], [16, -144]], gold(ctx, -20, -172, 18, -142), 2.5);
    for (const x of [-10, 0, 10]) hl(ctx, [[x, -146], [x - 2, -164]], 1.5);
  }
  if (!look.plume) return;
  // The plume streams back from the crest.
  ctx.beginPath();
  ctx.moveTo(-2, -144);
  ctx.bezierCurveTo(-20, -180, -50, -172, -62, -150);
  ctx.bezierCurveTo(-40, -160, -22, -152, 4, -140);
  ctx.fillStyle = look.plume;
  ctx.fill();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function standing(ctx: Ctx, p: Pose, look: Look) {
  leg(ctx, p.back, false, look.boots);
  arm(ctx, [-16, -94 + p.bob], [p.hand[0], p.hand[1] + p.bob], false);
  leg(ctx, p.front, true, look.boots);
  ctx.save();
  ctx.translate(0, p.bob);
  body(ctx, look);
  ctx.restore();
  const grip: Pt = [p.grip[0], p.grip[1] + p.bob];
  sword(ctx, grip, p.sword);
  arm(ctx, [18, -94 + p.bob], grip, true);
}

/** Feet first along the road, leaning far back, the sword still held forward. */
function sliding(ctx: Ctx, look: Look) {
  const hip: Pt = [0, -18];
  const lean = -1.15;
  leg(ctx, [[-4, -20], [26, -18], [54, -14]], false, look.boots);
  ctx.save();
  ctx.translate(hip[0], hip[1]);
  ctx.rotate(lean);
  ctx.translate(0, 52);
  arm(ctx, [-16, -94], [-30, -60], false);
  body(ctx, look);
  ctx.restore();
  leg(ctx, [[2, -16], [32, -12], [62, -8]], true, look.boots);
  const sh: Pt = [hip[0] + 18 * Math.cos(lean) + 42 * Math.sin(lean), hip[1] + 18 * Math.sin(lean) - 42 * Math.cos(lean)];
  const grip: Pt = [6, -40];
  sword(ctx, grip, -0.25);
  arm(ctx, sh, grip, true);
}

export function bakeKnight(scene: Phaser.Scene) {
  const { stand, slide } = KNIGHT_FEET;
  for (const [id, boots] of KNIGHT_IDS.flatMap((k) => [[k, false], [k, true]] as const)) {
    const look = { ...LOOKS[id], boots };
    const key = boots ? `${id}-gold` : id;
    for (const pose of Object.keys(POSES) as Exclude<KnightPose, 'slide'>[]) {
      paint(scene, `${key}-${pose}`, stand.w, stand.h, (ctx) => {
        ctx.translate(stand.x, stand.y);
        ctx.scale(S, S);
        standing(ctx, POSES[pose], look);
      });
    }
    paint(scene, `${key}-slide`, slide.w, slide.h, (ctx) => {
      ctx.translate(slide.x, slide.y);
      ctx.scale(S, S);
      sliding(ctx, look);
    });
  }
}
