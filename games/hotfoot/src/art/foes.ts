import Phaser from 'phaser';
import { C, circle, gold, hl, oval, paint, poly, type Ctx } from './ink';

// The things that move on the course, as marginal grotesques: a green goblin with a pot belly and a
// spiked club, and a bestiary bat with ribbed wings. Both face left, towards the knight; GameScene
// flips a goblin walking the other way. Each has two frames, painted in page units and scaled down.

/** The goblin's texture: 48x54 px, centred on its feet at (24, 51). */
export const GOBLIN_ART = { w: 48, h: 54, feetY: 51 };
const GS = 0.46;

/** A goblin: `goblin-0` and `goblin-1` are the two steps of its walk. */
function goblin(scene: Phaser.Scene) {
  for (const frame of [0, 1]) {
    paint(scene, `goblin-${frame}`, GOBLIN_ART.w, GOBLIN_ART.h, (ctx) => {
      ctx.translate(GOBLIN_ART.w / 2, GOBLIN_ART.feetY);
      ctx.scale(GS, GS);
      draw(ctx, frame);
    });
  }
  function draw(ctx: Ctx, frame: number) {
    const stride = frame ? 6 : -6;
    poly(ctx, [[-14 - stride, 0], [-8, -24], [-1, -24], [-4 - stride, 0]], '#4f7a2e', 2.5);
    poly(ctx, [[3 + stride, 0], [3, -24], [10, -24], [16 + stride, 0]], '#4f7a2e', 2.5);
    oval(ctx, 0, -36, 18, 16, '#c47a3a');
    ctx.strokeStyle = 'rgba(43,27,18,0.6)';
    ctx.lineWidth = 1.5;
    for (const dx of [-8, 0, 8]) {
      ctx.beginPath();
      ctx.moveTo(dx, -48);
      ctx.lineTo(dx + 2, -24);
      ctx.stroke();
    }
    oval(ctx, -4, -62, 16, 14, '#7ab04a', 2.5, -0.2);
    poly(ctx, [[-16, -66], [-40, -80], [-18, -56]], '#8cc25a', 2.5);
    poly(ctx, [[8, -68], [26, -82], [12, -58]], '#6a9a3e', 2.5);
    poly(ctx, [[-18, -62], [-30, -56], [-18, -54]], '#8cc25a', 2);
    circle(ctx, -10, -66, 4, '#fff8e0', 1.5);
    circle(ctx, -11, -66, 1.8, C.ink, 0);
    poly(ctx, [[-16, -52], [-6, -52], [-11, -47]], '#fff8e0', 1.5);
    // The club, raised over its shoulder, bobbing with the step.
    const lift = frame ? 4 : 0;
    poly(ctx, [[10, -40], [16, -42], [30, -84 + lift], [23, -86 + lift]], C.wood, 2.5);
    oval(ctx, 28, -90 + lift, 11, 13, C.wood, 2.5, 0.3);
    for (const [a, b] of [[20, -98], [37, -92], [34, -80]]) poly(ctx, [[a - 3, b + 3 + lift], [a + 5, b - 3 + lift], [a + 2, b + 5 + lift]], C.silver, 1.5);
  }
}

/** The shield goblin's texture: 64x160 px, its feet at (30, 156). Its pike stands 150 px tall (`TRAP_SPAN.shield`). */
export const SHIELD_ART = { w: 64, h: 160, feetX: 30, feetY: 156 };

/** A goblin behind a tower shield, its pike planted upright with a pennant: dashed through, never leapt. */
function shieldGoblin(scene: Phaser.Scene) {
  paint(scene, 'shield-goblin', SHIELD_ART.w, SHIELD_ART.h, (ctx) => {
    ctx.translate(SHIELD_ART.feetX, SHIELD_ART.feetY);
    ctx.scale(GS, GS);
    // The pike, behind it, with a madder pennant at the top.
    poly(ctx, [[22, 4], [30, 4], [30, -300], [22, -300]], C.wood, 2.5);
    poly(ctx, [[18, -300], [26, -330], [34, -300]], C.silver, 2.5);
    poly(ctx, [[30, -296], [62, -284], [30, -270]], C.madder, 2.5);
    // Its legs and head peeping over the shield.
    poly(ctx, [[-10, 0], [-6, -24], [2, -24], [0, 0]], '#4f7a2e', 2.5);
    poly(ctx, [[6, 0], [6, -24], [14, -24], [18, 0]], '#4f7a2e', 2.5);
    oval(ctx, 6, -110, 16, 14, '#7ab04a', 2.5, -0.2);
    poly(ctx, [[-6, -114], [-26, -128], [-8, -104]], '#8cc25a', 2.5);
    poly(ctx, [[18, -116], [34, -130], [22, -106]], '#6a9a3e', 2.5);
    circle(ctx, 0, -114, 4, '#fff8e0', 1.5);
    circle(ctx, -1, -114, 1.8, C.ink, 0);
    // The tower shield, faced towards the knight: iron-rimmed planks with a gold boss.
    poly(ctx, [[-40, -4], [-40, -96], [-30, -104], [20, -104], [30, -96], [30, -4]], C.iron, 3);
    poly(ctx, [[-34, -10], [-34, -92], [-26, -98], [16, -98], [24, -92], [24, -10]], C.wood, 2);
    ctx.strokeStyle = C.woodDark;
    ctx.lineWidth = 2;
    for (const x of [-20, -6, 8]) {
      ctx.beginPath();
      ctx.moveTo(x, -96);
      ctx.lineTo(x, -12);
      ctx.stroke();
    }
    circle(ctx, -5, -54, 11, gold(ctx, -16, -65, 6, -43), 2.5);
    hl(ctx, [[-30, -16], [-30, -88]], 2);
  });
}

/** The bat's texture: 76x40 px, centred on its body. */
export const BAT_ART = { w: 76, h: 40 };
const BS = 0.45;

/** A bat: `bat-0` with its wings up and `bat-1` with them down. */
function bat(scene: Phaser.Scene) {
  for (const frame of [0, 1]) {
    paint(scene, `bat-${frame}`, BAT_ART.w, BAT_ART.h, (ctx) => {
      ctx.translate(BAT_ART.w / 2, BAT_ART.h / 2 + 2);
      ctx.scale(BS, BS);
      const flip = frame ? -1 : 1;
      const wing = (s: number) => {
        ctx.beginPath();
        ctx.moveTo(0, -4);
        ctx.quadraticCurveTo(s * 30, -34 * flip, s * 78, -12 * flip - (frame ? 14 : 0));
        for (let k = 0; k < 3; k++) {
          const x0 = s * (78 - k * 22);
          const x1 = s * (56 - k * 22);
          ctx.quadraticCurveTo((x0 + x1) / 2, (2 + k * 2) * flip + (frame ? 8 : 0), x1, (14 - k * 2) * (frame ? 0.6 : 1));
        }
        ctx.lineTo(0, 10);
        ctx.closePath();
        ctx.fillStyle = '#5a4a6a';
        ctx.fill();
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.lineWidth = 1.5;
        for (const k of [0, 1, 2]) {
          ctx.beginPath();
          ctx.moveTo(s * 10, -6);
          ctx.lineTo(s * (56 - k * 22 + 22), (8 - k * 4 - (k === 0 ? 18 : 0)) * flip);
          ctx.stroke();
        }
      };
      wing(-1);
      wing(1);
      oval(ctx, 0, 2, 15, 14, '#6a5a7a');
      poly(ctx, [[-11, -6], [-7, -24], [-2, -8]], '#6a5a7a', 2);
      poly(ctx, [[2, -8], [7, -24], [11, -6]], '#6a5a7a', 2);
      circle(ctx, -6, 0, 3, C.goldLight, 1.2);
      circle(ctx, 5, 0, 3, C.goldLight, 1.2);
      poly(ctx, [[-5, 8], [-3, 13], [-1, 8]], '#fff8e0', 1);
      poly(ctx, [[1, 8], [3, 13], [5, 8]], '#fff8e0', 1);
    });
  }
}

/** The Gatekeeper's texture: 100x104 px, centred on its feet at (50, 100). Its helm is 86 px up, where a stomp lands (`BOSS.h`). */
export const GATE_ART = { w: 100, h: 104, feetY: 100 };
const SKIN = '#9aa87a';

/**
 * The Gatekeeper, a great ogre in a pot helm and a madder tabard with the gate's gold key at its
 * belt: `gate-ready` with an axe raised over its shoulder, `gate-throw` with its arm flung forward,
 * and `gate-tired` slumped and panting.
 */
function gatekeeper(scene: Phaser.Scene) {
  for (const pose of ['ready', 'throw', 'tired'] as const) {
    paint(scene, `gate-${pose}`, GATE_ART.w, GATE_ART.h, (ctx) => {
      ctx.translate(GATE_ART.w / 2, GATE_ART.feetY);
      ctx.scale(0.43, 0.43);
      draw(ctx, pose);
    });
  }
  function arm(ctx: Ctx, from: [number, number], to: [number, number]) {
    const [x0, y0] = from;
    const [x1, y1] = to;
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const nx = ((y1 - y0) / len) * 11;
    const ny = (-(x1 - x0) / len) * 11;
    poly(ctx, [[x0 + nx, y0 + ny], [x1 + nx * 0.8, y1 + ny * 0.8], [x1 - nx * 0.8, y1 - ny * 0.8], [x0 - nx, y0 - ny]], SKIN, 2.5);
    circle(ctx, x1, y1, 11, SKIN, 2.5);
  }
  function axe(ctx: Ctx, x: number, y: number) {
    poly(ctx, [[x - 3, y + 26], [x + 3, y + 26], [x + 3, y - 30], [x - 3, y - 30]], C.wood, 2.5);
    poly(ctx, [[x - 3, y - 30], [x - 26, y - 44], [x - 22, y - 20], [x - 3, y - 18]], C.steel, 2.5);
    hl(ctx, [[x - 20, y - 38], [x - 18, y - 24]], 2);
  }
  function draw(ctx: Ctx, pose: 'ready' | 'throw' | 'tired') {
    const tired = pose === 'tired';
    const droop = tired ? 12 : 0;
    // The back arm, behind the body: raised with an axe, or hanging.
    if (pose === 'ready') {
      arm(ctx, [36, -128], [64, -178]);
      axe(ctx, 64, -178);
    } else arm(ctx, [38, -124], [54, -66 + droop / 2]);
    // Legs in iron greaves and heavy boots.
    poly(ctx, [[-38, -8], [-34, -62], [-8, -62], [-12, -8]], C.iron, 2.5);
    poly(ctx, [[12, -8], [8, -62], [34, -62], [38, -8]], C.iron, 2.5);
    hl(ctx, [[-30, -54], [-32, -14]], 2);
    oval(ctx, -28, -6, 22, 10, C.woodDark);
    oval(ctx, 26, -6, 22, 10, C.woodDark);
    // The belly in a madder tabard, hemmed in gold.
    oval(ctx, 0, -104 + droop / 2, 58, 52, C.madder, 3);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, -104 + droop / 2, 58, 52, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 4;
    for (const x of [-30, 30]) {
      ctx.beginPath();
      ctx.moveTo(x, -170);
      ctx.lineTo(x, -40);
      ctx.stroke();
    }
    ctx.restore();
    hl(ctx, [[-44, -126 + droop], [-50, -96 + droop]], 2.5);
    // The belt, its gold buckle, and the gate's key hanging from it.
    poly(ctx, [[-56, -84 + droop / 2], [56, -84 + droop / 2], [54, -70 + droop / 2], [-54, -70 + droop / 2]], C.woodDark, 2.5);
    poly(ctx, [[-10, -88 + droop / 2], [8, -88 + droop / 2], [8, -66 + droop / 2], [-10, -66 + droop / 2]], gold(ctx, -10, -88, 8, -66), 2);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(32, -70 + droop / 2);
    ctx.lineTo(32, -30);
    ctx.lineTo(42, -30);
    ctx.moveTo(32, -40);
    ctx.lineTo(40, -40);
    ctx.stroke();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 3;
    ctx.stroke();
    circle(ctx, 32, -62 + droop / 2, 7, null, 0);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 3;
    ctx.stroke();
    // The front arm: hanging, or flung forward after a throw.
    if (pose === 'throw') arm(ctx, [-40, -132], [-100, -138]);
    else arm(ctx, [-42, -126 + droop / 2], [-62, -66 + droop]);
    // The head: a green ogre with tusks, under a steel pot helm with a gold rim and crest.
    const hy = -160 + droop;
    oval(ctx, -10, hy, 36, 30, SKIN, 3);
    poly(ctx, [[-40, hy + 8], [-36, hy + 30], [14, hy + 30], [18, hy + 8]], SKIN, 2.5);
    if (tired) {
      oval(ctx, -26, hy + 30, 7, 10, C.rose, 2);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2.5;
      for (const x of [-30, -8]) {
        ctx.beginPath();
        ctx.arc(x, hy - 2, 6, 0.1 * Math.PI, 0.9 * Math.PI);
        ctx.stroke();
      }
      for (const [x, y] of [[20, hy - 24], [28, hy - 8]] as const) oval(ctx, x, y, 3.5, 6, C.frost, 1.5);
    } else {
      circle(ctx, -30, hy - 2, 5, C.goldLight, 2);
      circle(ctx, -8, hy - 2, 5, C.goldLight, 2);
      circle(ctx, -31, hy - 2, 2, C.ink, 0);
      circle(ctx, -9, hy - 2, 2, C.ink, 0);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-40, hy - 12);
      ctx.lineTo(-18, hy - 7);
      ctx.lineTo(2, hy - 12);
      ctx.stroke();
    }
    poly(ctx, [[-34, hy + 18], [-30, hy + 6], [-26, hy + 18]], '#fff8e0', 1.5);
    poly(ctx, [[-2, hy + 18], [2, hy + 6], [6, hy + 18]], '#fff8e0', 1.5);
    ctx.beginPath();
    ctx.moveTo(-50, hy - 10);
    ctx.bezierCurveTo(-48, hy - 50, 30, hy - 50, 30, hy - 10);
    ctx.closePath();
    ctx.fillStyle = C.steel;
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.stroke();
    hl(ctx, [[-38, hy - 18], [-28, hy - 36]], 2.5);
    poly(ctx, [[-54, hy - 14], [34, hy - 14], [34, hy - 6], [-54, hy - 6]], gold(ctx, -54, hy - 14, 34, hy - 6), 2);
    poly(ctx, [[-14, hy - 40], [-10, hy - 58], [-6, hy - 40]], gold(ctx, -14, hy - 58, -6, hy - 40), 2);
  }
}

/** A barrel the Gatekeeper rolls down the road, seen end on so its roll shows: 28x28 px, centred. */
function barrel(scene: Phaser.Scene) {
  paint(scene, 'barrel', 28, 28, (ctx) => {
    ctx.scale(0.5, 0.5);
    circle(ctx, 28, 28, 25, C.wood, 3);
    circle(ctx, 28, 28, 18, null, 0);
    ctx.strokeStyle = C.iron;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = C.woodDark;
    ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(28 + Math.cos(a) * 16, 28 + Math.sin(a) * 16);
      ctx.lineTo(28 - Math.cos(a) * 16, 28 - Math.sin(a) * 16);
      ctx.stroke();
    }
    circle(ctx, 28, 28, 5, C.iron, 2);
    hl(ctx, [[12, 18], [18, 10]], 2.5);
  });
}

/** An axe the Gatekeeper throws at head height: 32x32 px, centred, spun as it flies. */
function thrownAxe(scene: Phaser.Scene) {
  paint(scene, 'axe', 32, 32, (ctx) => {
    ctx.scale(0.5, 0.5);
    poly(ctx, [[30, 56], [36, 56], [36, 10], [30, 10]], C.wood, 2.5);
    poly(ctx, [[36, 12], [58, 4], [60, 32], [36, 26]], C.steel, 2.5);
    hl(ctx, [[52, 10], [54, 26]], 2);
    poly(ctx, [[30, 14], [16, 10], [20, 22], [30, 22]], C.iron, 2);
  });
}

/** The dragon's texture: 170x130 px, centred on its feet at (85, 126). Its head, lowered when tired, is 96 px up (`BOSS.dragon.h`). */
export const DRAGON_ART = { w: 170, h: 130, feetY: 126 };
/** The bosses' textures by kind, for the one boss sprite. */
export const BOSS_ART = { gate: GATE_ART, dragon: DRAGON_ART };
const SCALE = '#4f8a3f';
const SCALE_DARK = '#376b2c';
const BELLY = '#d8c57a';

/**
 * The dragon of the Dragon's Keep, a wyrm in leaf-green scales with madder wings and a pale
 * belly, facing left: `dragon-ready` reared with its head high and wings spread, `dragon-breathe`
 * with its head down and jaws open on a flame, and `dragon-tired` slumped with its wings folded and
 * its head low, where a stomp lands.
 */
function dragon(scene: Phaser.Scene) {
  for (const pose of ['ready', 'breathe', 'tired'] as const) {
    paint(scene, `dragon-${pose}`, DRAGON_ART.w, DRAGON_ART.h, (ctx) => {
      ctx.translate(DRAGON_ART.w / 2, DRAGON_ART.feetY);
      ctx.scale(0.5, 0.5);
      draw(ctx, pose);
    });
  }
  function wing(ctx: Ctx, root: [number, number], tip: [number, number], folded: boolean) {
    const [x0, y0] = root;
    const [x1, y1] = folded ? [x0 + 40, y0 - 30] : tip;
    const mid: [number, number] = [(x0 + x1) / 2 + (folded ? 10 : 30), (y0 + y1) / 2 + (folded ? 10 : 40)];
    poly(ctx, [[x0, y0], [x1, y1], [x1 + 24, y1 + 50], mid, [x0 + 20, y0 + 30]], C.madder, 3);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    for (const to of [[x1, y1], [x1 + 24, y1 + 50], mid] as const) {
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(to[0], to[1]);
      ctx.stroke();
    }
  }
  function head(ctx: Ctx, x: number, y: number, open: boolean, shut: boolean) {
    // The neck up to the head, the head with its horns and eye, and the jaws.
    oval(ctx, x, y, 34, 22, SCALE, 3);
    poly(ctx, [[x - 8, y - 16], [x - 2, y - 44], [x + 10, y - 18]], BELLY, 2.5);
    poly(ctx, [[x + 12, y - 14], [x + 24, y - 38], [x + 26, y - 12]], BELLY, 2.5);
    if (open) {
      poly(ctx, [[x - 30, y + 6], [x - 70, y + 20], [x - 28, y + 24]], SCALE_DARK, 2.5);
      poly(ctx, [[x - 30, y - 6], [x - 74, y - 10], [x - 28, y + 8]], SCALE, 2.5);
      // The fire in its jaws.
      poly(ctx, [[x - 70, y + 4], [x - 110, y - 6], [x - 96, y + 10], [x - 118, y + 14], [x - 92, y + 20], [x - 70, y + 20]], C.verm, 2);
      poly(ctx, [[x - 72, y + 8], [x - 96, y + 4], [x - 88, y + 16], [x - 74, y + 16]], C.goldLight, 1.5);
    } else {
      poly(ctx, [[x - 30, y - 8], [x - 72, y + 2], [x - 30, y + 18]], SCALE, 2.5);
      poly(ctx, [[x - 60, y + 6], [x - 56, y + 14], [x - 52, y + 6]], '#fff8e0', 1.5);
    }
    if (shut) {
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x - 10, y - 4, 7, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    } else {
      circle(ctx, x - 10, y - 4, 7, C.goldLight, 2.5);
      circle(ctx, x - 11, y - 4, 3, C.ink, 0);
    }
  }
  function draw(ctx: Ctx, pose: 'ready' | 'breathe' | 'tired') {
    const tired = pose === 'tired';
    const bodyY = tired ? -96 : -116;
    // The tail, curling back and up behind the body, with spikes along it.
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(40, bodyY + 10);
    ctx.quadraticCurveTo(130, bodyY + 40, 150, bodyY - 60);
    ctx.stroke();
    ctx.strokeStyle = SCALE;
    ctx.lineWidth = 16;
    ctx.stroke();
    ctx.lineCap = 'butt';
    for (const [x, y] of [[90, bodyY + 18], [122, bodyY + 10], [142, bodyY - 20]] as const) poly(ctx, [[x - 8, y], [x + 2, y - 22], [x + 10, y - 2]], BELLY, 2);
    // The far wing, the legs and the body.
    wing(ctx, [10, bodyY - 30], [60, bodyY - 150], tired);
    poly(ctx, [[-36, -4], [-30, bodyY + 30], [-6, bodyY + 30], [-14, -4]], SCALE_DARK, 2.5);
    poly(ctx, [[20, -4], [14, bodyY + 30], [38, bodyY + 30], [44, -4]], SCALE_DARK, 2.5);
    for (const x of [-40, -24, 18, 40]) poly(ctx, [[x - 6, -4], [x, -14], [x + 6, -4], [x + 4, 0], [x - 4, 0]], BELLY, 2);
    oval(ctx, 0, bodyY, 76, 50, SCALE, 3);
    oval(ctx, -6, bodyY + 18, 52, 26, BELLY, 2.5);
    hl(ctx, [[-50, bodyY - 20], [-30, bodyY - 40]], 3);
    for (const [x, y] of [[-30, bodyY - 48], [-4, bodyY - 52], [22, bodyY - 48]] as const) poly(ctx, [[x - 8, y + 2], [x, y - 18], [x + 8, y + 2]], BELLY, 2);
    // The near wing, folded when tired.
    wing(ctx, [-20, bodyY - 34], [-10, bodyY - 170], tired);
    // The neck and head: high and proud, down and breathing, or hung low and panting.
    const [hx, hy] = pose === 'ready' ? [-96, -236] : pose === 'breathe' ? [-104, -160] : [-70, -186];
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 34;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-50, bodyY - 20);
    ctx.quadraticCurveTo(hx + 30, (bodyY + hy) / 2, hx + 10, hy + 6);
    ctx.stroke();
    ctx.strokeStyle = SCALE;
    ctx.lineWidth = 28;
    ctx.stroke();
    ctx.lineCap = 'butt';
    head(ctx, hx, hy, pose === 'breathe', tired);
  }
}

/** A gout of the dragon's fire rolling along the road: 44x34 px, standing on its bottom middle, in two flickers. */
function fire(scene: Phaser.Scene) {
  for (const k of [0, 1]) {
    paint(scene, `fire-${k}`, 44, 34, (ctx) => {
      ctx.scale(0.5, 0.5);
      const f = k ? 8 : 0;
      poly(ctx, [[4, 66], [10, 40 - f], [26, 48], [34, 8 + f], [50, 40], [62, 20 - f], [70, 44], [84, 32 + f], [84, 66]], C.verm, 3);
      poly(ctx, [[22, 66], [30, 46], [42, 56], [48, 28 + f], [58, 50], [66, 66]], C.goldLight, 2);
      hl(ctx, [[26, 56], [30, 50]], 2);
    });
  }
}

/** A lash of the dragon's tail flying at head height: 64x22 px, centred, its spikes along the top. */
function tailLash(scene: Phaser.Scene) {
  paint(scene, 'tail', 64, 22, (ctx) => {
    ctx.scale(0.5, 0.5);
    poly(ctx, [[4, 26], [40, 14], [124, 10], [124, 34], [40, 34]], SCALE, 3);
    hl(ctx, [[44, 20], [110, 16]], 2.5);
    for (const x of [48, 76, 104]) poly(ctx, [[x - 8, 14], [x, 0], [x + 8, 12]], BELLY, 2);
    poly(ctx, [[4, 26], [-2, 8], [18, 20]], BELLY, 2);
  });
}

/** A boulder of the rockfall: 80x80 px, centred, grey stone with ink cracks and a mossy top. */
function boulder(scene: Phaser.Scene) {
  paint(scene, 'boulder', 80, 80, (ctx) => {
    ctx.scale(0.5, 0.5);
    poly(ctx, [[80, 8], [120, 20], [150, 60], [148, 110], [110, 150], [50, 148], [12, 110], [10, 56], [40, 18]], C.iron, 4);
    poly(ctx, [[80, 8], [120, 20], [136, 40], [100, 36], [60, 44], [30, 36], [40, 18]], C.turf, 3);
    hl(ctx, [[30, 70], [40, 44], [66, 30]], 3);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(70, 60);
    ctx.lineTo(90, 84);
    ctx.lineTo(80, 110);
    ctx.moveTo(90, 84);
    ctx.lineTo(118, 92);
    ctx.stroke();
  });
}

export function bakeFoes(scene: Phaser.Scene) {
  goblin(scene);
  shieldGoblin(scene);
  bat(scene);
  gatekeeper(scene);
  barrel(scene);
  thrownAxe(scene);
  dragon(scene);
  fire(scene);
  tailLash(scene);
  boulder(scene);
}
