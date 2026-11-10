/**
 * The knights in Glow Vector (the first seven, then Sable Rhee, General Krull and Mother Ysolde), drawn from their scheme like the soldiers (body = robes or
 * armour, accent = blade and rim, mark = a second colour, bolt = the blade's glow), facing right,
 * plus their thrown blades and the knights' allies: Kael's starfighter and bot co-pilot, Oom's
 * spirit pupils and wreckage, Veyl's puppets (Ysolde raises them too) and Krull's guards. The
 * later knights' blades and guards are painted lazily (`bakeLateKnight`), never at boot.
 */
import Phaser from 'phaser';
import { HERO_IDS, isKnight, isLate, schemeOf, type HeroId, type HeroScheme } from '../game/heroes';
import { beam, glow, outline, paint, shade, shape, type Ctx } from './glow';

const INK = '#0b0f1c';

/** A blade: a hilt at (x1, y1) and a glowing edge to (x2, y2). */
function blade(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, w: number, z: number) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  beam(ctx, x1 + Math.cos(a) * 6, y1 + Math.sin(a) * 6, x2, y2, color, w, 22, z);
  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(a + Math.PI / 2);
  ctx.fillStyle = '#9aa3b5';
  ctx.fillRect(-3, -8, 6, 16);
  ctx.fillStyle = '#3a4050';
  ctx.fillRect(-3, -2, 6, 3);
  ctx.restore();
}

function eyes(ctx: Ctx, x: number, y: number, d = 6, color = INK) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x - d, y, 2.6, 0, Math.PI * 2);
  ctx.arc(x + d, y, 2.6, 0, Math.PI * 2);
  ctx.fill();
}

/** A robe: narrow at the shoulders (y), wider at the hem (y + h). */
const robe = (ctx: Ctx, x: number, y: number, w: number, h: number) => () => {
  ctx.moveTo(x - w * 0.45, y);
  ctx.lineTo(x + w * 0.45, y);
  ctx.lineTo(x + w * 0.6, y + h);
  ctx.lineTo(x - w * 0.6, y + h);
  ctx.closePath();
};
const head = (ctx: Ctx, x: number, y: number, r: number) => () => ctx.arc(x, y, r, 0, Math.PI * 2);

/** Draws a knight at (x, y) in art units, facing right; `fx` adds the portrait's extras (lightning, the deflect arc). */
export function drawKnight(ctx: Ctx, id: HeroId, x: number, y: number, z: number, fx: boolean, sch: HeroScheme) {
  const mark = sch.mark ?? shade(sch.accent, -0.3);
  if (id === 'kael') {
    shape(ctx, robe(ctx, x, y + 6, 44, 58), sch.body, sch.accent, 10, z);
    ctx.fillStyle = mark;
    ctx.fillRect(x - 3, y + 6, 6, 58);
    shape(ctx, head(ctx, x, y - 14, 17), '#e3b98f', sch.accent, 6, z);
    shape(ctx, () => {
      ctx.arc(x, y - 18, 18, Math.PI * 1.05, Math.PI * 1.95);
      ctx.lineTo(x + 18, y - 20);
      ctx.lineTo(x - 18, y - 20);
      ctx.closePath();
    }, '#7a4e2a', '#7a4e2a', 0, z);
    eyes(ctx, x, y - 12);
    blade(ctx, x + 30, y + 30, x + 64, y - 40, sch.bolt, 6, z);
  } else if (id === 'vharn') {
    // A dark teal cape, gunmetal armour, a helmet with a breathing mask.
    shape(ctx, () => {
      ctx.moveTo(x - 34, y + 66);
      ctx.lineTo(x - 26, y + 4);
      ctx.lineTo(x + 26, y + 4);
      ctx.lineTo(x + 34, y + 66);
      ctx.closePath();
    }, mark, sch.accent, 12, z);
    shape(ctx, () => ctx.roundRect(x - 20, y + 6, 40, 56, 10), sch.body, sch.accent, 0, z);
    ctx.fillStyle = sch.accent;
    ctx.fillRect(x - 8, y + 20, 5, 5);
    ctx.fillStyle = '#5fd0ff';
    ctx.fillRect(x + 1, y + 20, 5, 5);
    ctx.fillStyle = '#c8c8c8';
    ctx.fillRect(x - 8, y + 28, 14, 4);
    shape(ctx, () => {
      ctx.arc(x, y - 16, 22, Math.PI, 0);
      ctx.lineTo(x + 26, y + 6);
      ctx.lineTo(x - 26, y + 6);
      ctx.closePath();
    }, sch.body, sch.accent, 8, z);
    ctx.fillStyle = '#2d3140';
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 14);
    ctx.lineTo(x + 12, y - 14);
    ctx.lineTo(x + 6, y + 2);
    ctx.lineTo(x - 6, y + 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = INK;
    ctx.fillRect(x - 13, y - 18, 10, 6);
    ctx.fillRect(x + 3, y - 18, 10, 6);
    blade(ctx, x + 34, y + 36, x + 62, y - 40, sch.bolt, 7, z);
  } else if (id === 'oom') {
    // Knee-high: a rust robe, big ears, a cane and a short golden blade.
    shape(ctx, robe(ctx, x, y + 28, 34, 36), sch.body, sch.accent, 10, z);
    shape(ctx, () => ctx.ellipse(x - 30, y + 10, 18, 7, -0.25, 0, Math.PI * 2), mark, sch.accent, 6, z);
    shape(ctx, () => ctx.ellipse(x + 30, y + 10, 18, 7, 0.25, 0, Math.PI * 2), mark, sch.accent, 6, z);
    shape(ctx, head(ctx, x, y + 14, 16), mark, sch.accent, 6, z);
    ctx.fillStyle = '#e6e6d8';
    ctx.fillRect(x - 10, y + 2, 20, 3);
    eyes(ctx, x, y + 13, 6);
    ctx.strokeStyle = '#5a3d22';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x - 22, y + 30);
    ctx.lineTo(x - 26, y + 64);
    ctx.stroke();
    blade(ctx, x + 22, y + 46, x + 46, y + 2, sch.bolt, 5, z);
  } else if (id === 'corvin') {
    // Red robes with a darker belt, a beard, the blade held back.
    shape(ctx, robe(ctx, x, y + 6, 46, 58), sch.body, '#e8857a', 10, z);
    ctx.fillStyle = mark;
    ctx.fillRect(x - 23, y + 24, 46, 6);
    ctx.fillStyle = '#e8d2b0';
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 6);
    ctx.lineTo(x, y + 24);
    ctx.lineTo(x + 10, y + 6);
    ctx.fill();
    shape(ctx, head(ctx, x, y - 14, 17), '#e3b98f', '#e1c49a', 6, z);
    shape(ctx, () => {
      ctx.moveTo(x - 15, y - 12);
      ctx.quadraticCurveTo(x, y + 14, x + 15, y - 12);
      ctx.lineTo(x + 10, y - 6);
      ctx.lineTo(x - 10, y - 6);
      ctx.closePath();
    }, '#9c6a3a', '#9c6a3a', 0, z);
    shape(ctx, () => {
      ctx.arc(x, y - 18, 18, Math.PI * 1.05, Math.PI * 1.95);
      ctx.closePath();
    }, '#9c6a3a', '#9c6a3a', 0, z);
    eyes(ctx, x, y - 15);
    blade(ctx, x - 34, y + 30, x - 58, y - 40, sch.bolt, 6, z);
    if (fx) {
      ctx.save();
      ctx.strokeStyle = 'rgba(95,208,255,0.5)';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(x, y + 14, 70, -1.2, 0.9);
      ctx.stroke();
      ctx.restore();
    }
  } else if (id === 'veyl') {
    // A hooded regent in deep violet, a pale face and gold eyes; lightning from his sleeve.
    shape(ctx, robe(ctx, x, y - 4, 50, 70), sch.body, sch.accent, 12, z);
    shape(ctx, () => {
      ctx.arc(x, y - 12, 24, Math.PI * 0.9, Math.PI * 2.1);
      ctx.lineTo(x + 26, y + 10);
      ctx.lineTo(x - 26, y + 10);
      ctx.closePath();
    }, sch.body, sch.accent, 8, z);
    ctx.fillStyle = mark;
    ctx.beginPath();
    ctx.ellipse(x, y - 4, 11, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    eyes(ctx, x, y - 6, 5, '#ffcc33');
    // The hidden blade: a short edge out of the sleeve.
    beam(ctx, x + 24, y + 24, x + 34, y + 20, sch.bolt, 3, 10, z);
    if (fx) {
      ctx.save();
      glow(ctx, sch.bolt, 18, z);
      ctx.strokeStyle = sch.bolt;
      ctx.lineWidth = 3;
      for (const dy of [-10, 14]) {
        ctx.beginPath();
        ctx.moveTo(x + 34, y + 22);
        for (let k = 1; k < 6; k++) ctx.lineTo(x + 34 + k * 12, y + 22 + (dy * k) / 5 + (k % 2 ? -8 : 8));
        ctx.stroke();
      }
      ctx.restore();
    }
  } else if (id === 'kresh') {
    // Horned and tattooed, gold eyes, a double-ended staff blade across him.
    shape(ctx, () => ctx.roundRect(x - 21, y + 8, 42, 56, 10), sch.body, sch.accent, 10, z);
    shape(ctx, head(ctx, x, y - 14, 18), mark, sch.accent, 6, z);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (const dx of [-11, -4, 4, 11]) {
      ctx.moveTo(x + dx, y - 31);
      ctx.quadraticCurveTo(x + dx * 1.4, y - 20, x + dx * 0.6, y - 18);
    }
    ctx.moveTo(x - 9, y - 4);
    ctx.lineTo(x - 4, y + 1);
    ctx.moveTo(x + 9, y - 4);
    ctx.lineTo(x + 4, y + 1);
    ctx.stroke();
    eyes(ctx, x, y - 12, 7, '#ffcc33');
    ctx.fillStyle = '#3a3a40';
    for (const [dx, h] of [[-12, 10], [-4, 13], [4, 13], [12, 10]]) {
      ctx.beginPath();
      ctx.moveTo(x + dx - 3, y - 28);
      ctx.lineTo(x + dx, y - 28 - h);
      ctx.lineTo(x + dx + 3, y - 28);
      ctx.fill();
    }
    beam(ctx, x + 6, y + 20, x + 44, y - 34, sch.bolt, 6, 22, z);
    beam(ctx, x - 2, y + 32, x - 36, y + 64, sch.bolt, 6, 22, z);
    ctx.save();
    ctx.translate(x + 2, y + 26);
    ctx.rotate(-0.95);
    ctx.fillStyle = '#9aa3b5';
    ctx.fillRect(-12, -3, 24, 6);
    ctx.restore();
  } else if (id === 'sable') {
    // Cropped hair, a padded vest over a long shirt, a scarf, and a curved single-edged blade.
    shape(ctx, robe(ctx, x, y + 8, 40, 56), shade(sch.body, -0.15), sch.accent, 8, z);
    shape(ctx, () => ctx.roundRect(x - 17, y + 8, 34, 30, 7), sch.body, sch.accent, 6, z);
    ctx.fillStyle = mark;
    for (let i = 0; i < 3; i++) ctx.fillRect(x - 15, y + 14 + i * 8, 30, 2);
    ctx.fillStyle = sch.accent;
    ctx.beginPath();
    ctx.moveTo(x - 14, y + 4);
    ctx.lineTo(x + 14, y + 4);
    ctx.lineTo(x + 6, y + 14);
    ctx.lineTo(x - 2, y + 30);
    ctx.lineTo(x - 6, y + 12);
    ctx.closePath();
    ctx.fill();
    shape(ctx, head(ctx, x, y - 14, 16), '#c99a74', sch.accent, 6, z);
    ctx.fillStyle = '#2e2420';
    ctx.beginPath();
    ctx.arc(x - 1, y - 18, 16, Math.PI * 0.95, Math.PI * 2.02);
    ctx.lineTo(x - 15, y - 12);
    ctx.closePath();
    ctx.fill();
    eyes(ctx, x + 2, y - 12, 6);
    // The curved blade, its edge bowed out.
    ctx.save();
    glow(ctx, sch.bolt, 14, z);
    ctx.strokeStyle = sch.bolt;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x + 34, y + 22);
    ctx.quadraticCurveTo(x + 70, y + 2, x + 60, y - 42);
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#9aa3b5';
    ctx.fillRect(x + 22, y + 24, 14, 6);
  } else if (id === 'krull') {
    // Broad plate armour with brass trim, a horned great helm with round eye holes, a heavy cleaver.
    shape(ctx, () => ctx.roundRect(x - 27, y + 6, 54, 60, 8), sch.body, sch.accent, 10, z);
    ctx.fillStyle = mark;
    ctx.fillRect(x - 27, y + 34, 54, 8);
    ctx.fillStyle = sch.accent;
    ctx.fillRect(x - 27, y + 6, 54, 3);
    ctx.fillRect(x - 3, y + 34, 6, 8);
    shape(ctx, () => ctx.roundRect(x - 36, y + 2, 20, 18, 6), shade(sch.body, 0.15), sch.accent, 4, z);
    shape(ctx, () => ctx.roundRect(x + 16, y + 2, 20, 18, 6), shade(sch.body, 0.15), sch.accent, 4, z);
    shape(ctx, () => ctx.roundRect(x - 18, y - 36, 36, 38, 10), shade(sch.body, 0.08), sch.accent, 6, z);
    ctx.fillStyle = mark;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(x + side * 14, y - 30);
      ctx.quadraticCurveTo(x + side * 30, y - 38, x + side * 26, y - 54);
      ctx.lineTo(x + side * 20, y - 36);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.arc(x - 6, y - 18, 4, 0, Math.PI * 2);
    ctx.arc(x + 7, y - 18, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = sch.accent;
    ctx.fillRect(x - 2, y - 10, 4, 10);
    // The cleaver: a short hilt and a broad glowing slab.
    ctx.fillStyle = '#9aa3b5';
    ctx.fillRect(x + 28, y + 24, 8, 16);
    ctx.save();
    glow(ctx, sch.bolt, 16, z);
    ctx.fillStyle = sch.bolt;
    ctx.beginPath();
    ctx.moveTo(x + 26, y + 24);
    ctx.lineTo(x + 46, y - 40);
    ctx.lineTo(x + 62, y - 34);
    ctx.lineTo(x + 40, y + 26);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else if (id === 'ysolde') {
    // A tall hooded robe with a high pointed collar, a pale face and a staff crowned with a glowing stone.
    shape(ctx, robe(ctx, x, y + 2, 46, 62), sch.body, sch.accent, 10, z);
    ctx.fillStyle = mark;
    ctx.fillRect(x - 3, y + 4, 6, 60);
    for (const side of [-1, 1]) {
      shape(ctx, () => {
        ctx.moveTo(x + side * 6, y + 4);
        ctx.lineTo(x + side * 26, y - 30);
        ctx.lineTo(x + side * 18, y + 6);
        ctx.closePath();
      }, shade(sch.body, 0.12), sch.accent, 4, z);
    }
    shape(ctx, () => {
      ctx.moveTo(x - 16, y + 2);
      ctx.quadraticCurveTo(x - 18, y - 34, x, y - 40);
      ctx.quadraticCurveTo(x + 18, y - 34, x + 16, y + 2);
      ctx.closePath();
    }, mark, sch.accent, 6, z);
    shape(ctx, () => ctx.ellipse(x + 1, y - 13, 9, 12, 0, 0, Math.PI * 2), '#d8d2c8', sch.accent, 3, z);
    eyes(ctx, x + 1, y - 14, 4, sch.accent);
    ctx.strokeStyle = '#4a3a2a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x + 30, y + 64);
    ctx.lineTo(x + 36, y - 30);
    ctx.quadraticCurveTo(x + 44, y - 42, x + 34, y - 48);
    ctx.stroke();
    ctx.save();
    glow(ctx, sch.bolt, 16, z);
    ctx.fillStyle = sch.bolt;
    ctx.beginPath();
    ctx.arc(x + 38, y - 38, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (fx) {
      ctx.save();
      glow(ctx, sch.bolt, 10, z);
      ctx.strokeStyle = sch.bolt;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(x + 72, y - 10, 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  } else {
    // Joren: pale grey robes, a sash, bald, a royal blue blade.
    shape(ctx, robe(ctx, x, y + 6, 48, 58), sch.body, sch.accent, 10, z);
    ctx.fillStyle = '#7d8396';
    ctx.fillRect(x - 24, y + 24, 48, 6);
    ctx.fillStyle = '#7fb8b0';
    ctx.beginPath();
    ctx.moveTo(x - 10, y + 6);
    ctx.lineTo(x, y + 22);
    ctx.lineTo(x + 10, y + 6);
    ctx.fill();
    shape(ctx, head(ctx, x, y - 14, 18), mark, sch.accent, 6, z);
    ctx.fillStyle = INK;
    ctx.fillRect(x - 11, y - 20, 8, 2);
    ctx.fillRect(x + 3, y - 20, 8, 2);
    eyes(ctx, x, y - 14);
    blade(ctx, x + 32, y + 30, x + 58, y - 44, sch.bolt, 7, z);
  }
}

/** The texture of a knight's thrown blade (Kresh's is his whole double-ended staff). */
export const bladeKey = (id: HeroId) => `rb-blade-${id}`;

/** Paints a knight's thrown blade. */
function bakeBlade(scene: Phaser.Scene, id: HeroId) {
  const color = schemeOf(id).bolt;
  paint(scene, bladeKey(id), 48, 48, (ctx) => {
    if (id === 'kresh') {
      beam(ctx, 4, 24, 44, 24, color, 4, 10);
      ctx.fillStyle = '#9aa3b5';
      ctx.fillRect(18, 21, 12, 6);
    } else {
      beam(ctx, 22, 24, 44, 24, color, 4.5, 10);
      ctx.fillStyle = '#9aa3b5';
      ctx.fillRect(8, 21, 14, 6);
    }
  });
}

/** A later knight's blade and allies (Krull's guards), painted the first time the knight is shown. */
export function bakeLateKnight(scene: Phaser.Scene, id: HeroId) {
  if (!scene.textures.exists(bladeKey(id))) bakeBlade(scene, id);
  if (id === 'krull' && !scene.textures.exists('rb-guard')) {
    const sch = schemeOf('krull');
    paint(scene, 'rb-guard', 30, 36, (ctx) => {
      // A small Hollow guard: plate, a round helm and a short glowing blade.
      shape(ctx, () => ctx.roundRect(7, 14, 16, 18, 4), sch.body, sch.accent, 4);
      shape(ctx, () => ctx.arc(15, 10, 7, 0, Math.PI * 2), shade(sch.body, 0.1), sch.accent, 3);
      ctx.fillStyle = INK;
      ctx.fillRect(12, 9, 7, 2);
      beam(ctx, 22, 22, 28, 4, sch.bolt, 2.5, 6);
    });
  }
}

/** Paints the knights' thrown blades and allies (the later knights' come with `bakeLateKnight`). */
export function bakeKnights(scene: Phaser.Scene) {
  for (const id of HERO_IDS) if (isKnight(id) && !isLate(id)) bakeBlade(scene, id);
  // Kael's starfighter: a slim dart with swept wings and a magenta engine.
  const kael = schemeOf('kael');
  paint(scene, 'rb-fighter', 44, 34, (ctx) => {
    beam(ctx, 4, 17, 12, 17, kael.bolt, 4, 10);
    shape(ctx, () => {
      ctx.moveTo(40, 17);
      ctx.lineTo(12, 9);
      ctx.lineTo(8, 17);
      ctx.lineTo(12, 25);
      ctx.closePath();
    }, '#c9ccd6', kael.bolt, 8);
    shape(ctx, () => {
      ctx.moveTo(22, 15);
      ctx.lineTo(14, 2);
      ctx.lineTo(10, 4);
      ctx.lineTo(14, 15);
      ctx.moveTo(22, 19);
      ctx.lineTo(14, 32);
      ctx.lineTo(10, 30);
      ctx.lineTo(14, 19);
    }, '#8a90a0', kael.bolt, 6);
    ctx.fillStyle = INK;
    ctx.fillRect(24, 15, 7, 4);
  });
  // The bot co-pilot: a little round astromech-style dome.
  paint(scene, 'rb-copilot', 28, 30, (ctx) => {
    shape(ctx, () => ctx.roundRect(7, 12, 14, 14, 3), '#d9dde6', kael.bolt, 6);
    shape(ctx, () => {
      ctx.arc(14, 12, 7, Math.PI, 0);
      ctx.closePath();
    }, '#d9dde6', kael.bolt, 6);
    ctx.fillStyle = kael.bolt;
    ctx.fillRect(12, 7, 4, 3);
    ctx.fillRect(9, 16, 10, 2);
  });
  // A spirit pupil: a small robed figure of pale gold light.
  const oom = schemeOf('oom');
  paint(scene, 'rb-spirit', 30, 36, (ctx) => {
    shape(ctx, () => {
      ctx.moveTo(10, 14);
      ctx.lineTo(20, 14);
      ctx.lineTo(24, 32);
      ctx.lineTo(6, 32);
      ctx.closePath();
    }, 'rgba(255,236,160,0.25)', oom.accent, 10);
    shape(ctx, () => ctx.arc(15, 9, 6, 0, Math.PI * 2), 'rgba(255,236,160,0.35)', oom.accent, 8);
    beam(ctx, 22, 24, 27, 12, oom.bolt, 2.5, 8);
  });
  // Wreckage Oom lifts and throws, and the starship wreck of Lift the Ship.
  paint(scene, 'rb-wreck', 34, 30, (ctx) => {
    shape(ctx, () => {
      ctx.moveTo(4, 18);
      ctx.lineTo(12, 6);
      ctx.lineTo(28, 8);
      ctx.lineTo(30, 22);
      ctx.lineTo(16, 26);
      ctx.closePath();
    }, '#3a3f4a', oom.accent, 10);
    outline(ctx, () => {
      ctx.moveTo(12, 12);
      ctx.lineTo(24, 18);
    }, '#8a90a0', 2, 0);
  });
  paint(scene, 'rb-ship', 150, 90, (ctx) => {
    shape(ctx, () => {
      ctx.moveTo(146, 46);
      ctx.lineTo(40, 14);
      ctx.lineTo(8, 30);
      ctx.lineTo(16, 46);
      ctx.lineTo(8, 62);
      ctx.lineTo(40, 78);
      ctx.closePath();
    }, '#2c313c', oom.accent, 16);
    ctx.strokeStyle = '#5a6070';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(40 + i * 18, 22 + i * 4);
      ctx.lineTo(40 + i * 18, 70 - i * 4);
      ctx.stroke();
    }
    beam(ctx, 4, 40, 14, 40, '#ffb347', 4, 12);
    beam(ctx, 4, 52, 14, 52, '#ffb347', 4, 12);
  });
  // A puppet: a hunched shape of lime lightning with hollow eyes.
  const veyl = schemeOf('veyl');
  paint(scene, 'rb-puppet', 30, 32, (ctx) => {
    shape(ctx, () => {
      ctx.moveTo(6, 28);
      ctx.quadraticCurveTo(6, 8, 16, 7);
      ctx.quadraticCurveTo(25, 8, 24, 28);
      ctx.closePath();
    }, '#14200a', veyl.accent, 10);
    ctx.fillStyle = veyl.accent;
    ctx.fillRect(11, 13, 3, 3);
    ctx.fillRect(18, 13, 3, 3);
    outline(ctx, () => {
      ctx.moveTo(8, 22);
      ctx.lineTo(2, 26);
      ctx.moveTo(22, 22);
      ctx.lineTo(28, 26);
    }, veyl.accent, 1.5, 4);
  });
  // Kael's teal wave (The Fall).
  paint(scene, 'rb-bolt-fallen', 30, 34, (ctx) => {
    outline(ctx, () => ctx.arc(4, 17, 18, -0.9, 0.9), schemeOf('kael', 1).bolt, 4, 12);
  });
}
