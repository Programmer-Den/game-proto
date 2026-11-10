/**
 * The crew's art: Dax Morrow (a smuggler in a vest with a heavy pistol), Grunda (a big furred
 * hunter with a crossbow), KT-4 "Kettle" (a small boxy droid with a zap prod) and Cassia Vane (a
 * hooded spy with a long rifle), each from its scheme, and their allies' textures: Dax's freighter,
 * Kettle's repair drone and Cassia's spy drone. Painted lazily, the first time one is shown
 * (`bakeLate` in `sprites.ts`), never at boot.
 */
import type Phaser from 'phaser';
import type { HeroId, HeroScheme } from '../game/heroes';
import { C, beam, glow, outline, paint, shade, shape, type Ctx } from './glow';

const SKIN = '#d9a77c';

function longGun(ctx: Ctx, x: number, y: number, w: number, body = '#2c3140') {
  ctx.fillStyle = body;
  ctx.fillRect(x, y - 3, w, 6);
  ctx.fillRect(x + 4, y, 7, 10);
  ctx.fillStyle = shade(body, 0.35);
  ctx.fillRect(x, y - 3, w, 2);
}

/** Draws a crew hero at (x, y) in art units, facing right; `bolts` adds their shots, for portraits. */
export function drawCrewHero(ctx: Ctx, id: HeroId, x: number, y: number, z: number, bolts: boolean, sch: HeroScheme) {
  const mark = sch.mark ?? shade(sch.accent, -0.15);
  if (id === 'dax') {
    // Dark trousers and shirt, an open vest, a holster belt; bare head with swept hair.
    shape(ctx, () => ctx.roundRect(x - 22, y + 10, 44, 52, 10), sch.body, sch.accent, 8, z);
    ctx.fillStyle = mark;
    ctx.fillRect(x - 6, y + 12, 12, 30);
    shape(ctx, () => {
      ctx.moveTo(x - 22, y + 14);
      ctx.lineTo(x - 6, y + 14);
      ctx.lineTo(x - 8, y + 44);
      ctx.lineTo(x - 22, y + 44);
      ctx.closePath();
      ctx.moveTo(x + 22, y + 14);
      ctx.lineTo(x + 6, y + 14);
      ctx.lineTo(x + 8, y + 44);
      ctx.lineTo(x + 22, y + 44);
      ctx.closePath();
    }, shade(sch.body, -0.35), sch.accent, 4, z);
    ctx.fillStyle = '#4a3420';
    ctx.fillRect(x - 22, y + 44, 44, 6);
    ctx.fillStyle = sch.accent;
    ctx.fillRect(x - 3, y + 45, 6, 4);
    // Head and hair.
    shape(ctx, () => ctx.arc(x, y - 10, 16, 0, Math.PI * 2), SKIN, sch.accent, 4, z);
    ctx.fillStyle = '#3a2618';
    ctx.beginPath();
    ctx.arc(x - 2, y - 16, 16, Math.PI * 1.02, Math.PI * 1.95);
    ctx.lineTo(x + 14, y - 14);
    ctx.lineTo(x - 16, y - 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.fillRect(x + 4, y - 10, 4, 3);
    ctx.fillRect(x - 6, y - 10, 4, 3);
    // The heavy pistol: a short fat barrel and a scope.
    ctx.fillStyle = '#2c3140';
    ctx.fillRect(x + 16, y + 26, 30, 9);
    ctx.fillRect(x + 18, y + 30, 8, 14);
    ctx.fillStyle = '#4a5266';
    ctx.fillRect(x + 24, y + 21, 12, 5);
    if (bolts) beam(ctx, x + 50, y + 30, x + 84, y + 30, sch.bolt, 5, 22, z);
    return;
  }
  if (id === 'grunda') {
    // A head taller than the rest: a shaggy body, a belt and shoulder guard, a long face with dark eyes.
    const fur = sch.body;
    shape(ctx, () => ctx.roundRect(x - 28, y - 4, 56, 70, 22), fur, sch.accent, 6, z);
    ctx.fillStyle = shade(fur, -0.2);
    for (let i = 0; i < 6; i++) {
      const fx = x - 22 + i * 9;
      ctx.beginPath();
      ctx.moveTo(fx, y + 60);
      ctx.lineTo(fx + 4, y + 70);
      ctx.lineTo(fx + 8, y + 60);
      ctx.fill();
    }
    // A wide belt with a buckle, and a shoulder guard.
    ctx.fillStyle = mark;
    ctx.fillRect(x - 28, y + 40, 56, 8);
    ctx.fillStyle = sch.accent;
    ctx.fillRect(x - 5, y + 39, 10, 10);
    shape(ctx, () => ctx.roundRect(x - 32, y - 2, 22, 14, 6), mark, sch.accent, 4, z);
    shape(ctx, () => ctx.roundRect(x - 19, y - 42, 38, 42, 16), fur, sch.accent, 6, z);
    ctx.fillStyle = shade(fur, 0.2);
    ctx.beginPath();
    ctx.ellipse(x + 4, y - 12, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.fillRect(x - 9, y - 28, 6, 5);
    ctx.fillRect(x + 6, y - 28, 6, 5);
    ctx.fillRect(x + 1, y - 15, 6, 4);
    // The crossbow: a stock and a bow across its tip.
    longGun(ctx, x + 10, y + 26, 48, '#5a3f26');
    ctx.strokeStyle = '#8a8f99';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 50, y + 8);
    ctx.quadraticCurveTo(x + 62, y + 26, x + 50, y + 44);
    ctx.stroke();
    ctx.strokeStyle = sch.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 50, y + 8);
    ctx.lineTo(x + 40, y + 26);
    ctx.lineTo(x + 50, y + 44);
    ctx.stroke();
    if (bolts) beam(ctx, x + 62, y + 26, x + 96, y + 26, sch.bolt, 6, 22, z);
    return;
  }
  if (id === 'kettle') {
    // Small and boxy: a squat brass body on three short legs, a flat-topped head with a visor slit
    // and two antennae, and a prod arm.
    ctx.fillStyle = shade(sch.body, -0.45);
    ctx.fillRect(x - 18, y + 48, 8, 16);
    ctx.fillRect(x - 4, y + 50, 8, 14);
    ctx.fillRect(x + 10, y + 48, 8, 16);
    shape(ctx, () => ctx.roundRect(x - 22, y + 14, 44, 38, 5), sch.body, sch.accent, 8, z);
    ctx.fillStyle = mark;
    ctx.fillRect(x - 22, y + 26, 44, 5);
    ctx.fillStyle = shade(sch.body, 0.25);
    for (let i = 0; i < 3; i++) ctx.fillRect(x - 14 + i * 10, y + 36, 6, 8);
    shape(ctx, () => ctx.roundRect(x - 15, y - 12, 30, 24, 4), shade(sch.body, 0.1), sch.accent, 6, z);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x - 11, y - 4, 22, 7);
    ctx.save();
    glow(ctx, sch.accent, 10, z);
    ctx.fillStyle = sch.accent;
    ctx.fillRect(x - 2, y - 3, 10, 5);
    ctx.restore();
    ctx.strokeStyle = mark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 12);
    ctx.lineTo(x - 13, y - 24);
    ctx.moveTo(x + 9, y - 12);
    ctx.lineTo(x + 11, y - 22);
    ctx.stroke();
    ctx.fillStyle = sch.accent;
    ctx.fillRect(x - 15, y - 27, 4, 4);
    ctx.fillRect(x + 9, y - 25, 4, 4);
    // The prod: a thin arm with a forked, sparking tip.
    ctx.fillStyle = '#8a93a6';
    ctx.fillRect(x + 20, y + 26, 24, 4);
    ctx.fillRect(x + 42, y + 21, 3, 14);
    ctx.fillRect(x + 42, y + 21, 8, 3);
    ctx.fillRect(x + 42, y + 32, 8, 3);
    if (bolts) {
      ctx.save();
      glow(ctx, sch.bolt, 12, z);
      ctx.strokeStyle = sch.bolt;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x + 52, y + 28);
      ctx.lineTo(x + 62, y + 20);
      ctx.lineTo(x + 70, y + 32);
      ctx.lineTo(x + 82, y + 24);
      ctx.stroke();
      ctx.restore();
    }
    return;
  }
  // Cassia: a slim figure in a hooded cloak, a glowing visor slit and a long rifle.
  shape(ctx, () => {
    ctx.moveTo(x - 16, y - 2);
    ctx.lineTo(x + 16, y - 2);
    ctx.lineTo(x + 24, y + 64);
    ctx.lineTo(x - 26, y + 64);
    ctx.closePath();
  }, sch.body, sch.accent, 8, z);
  ctx.fillStyle = mark;
  ctx.fillRect(x - 3, y + 6, 6, 52);
  ctx.fillStyle = shade(sch.body, 0.2);
  ctx.fillRect(x - 14, y + 30, 28, 5);
  shape(ctx, () => {
    ctx.moveTo(x - 17, y + 2);
    ctx.quadraticCurveTo(x - 20, y - 34, x + 2, y - 38);
    ctx.quadraticCurveTo(x + 20, y - 34, x + 17, y + 2);
    ctx.closePath();
  }, shade(sch.body, 0.12), sch.accent, 6, z);
  ctx.fillStyle = C.ink;
  ctx.beginPath();
  ctx.ellipse(x + 2, y - 14, 10, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  glow(ctx, sch.accent, 10, z);
  ctx.fillStyle = sch.accent;
  ctx.fillRect(x - 5, y - 17, 16, 3);
  ctx.restore();
  longGun(ctx, x + 4, y + 22, 64);
  ctx.fillStyle = '#4a5266';
  ctx.fillRect(x + 22, y + 15, 18, 4);
  if (bolts) beam(ctx, x + 72, y + 22, x + 100, y + 22, sch.bolt, 3, 22, z);
}

/** Paints the crew's allies: the freighter (pointing right), the repair drone and the spy drone. */
export function bakeCrewAllies(scene: Phaser.Scene, id: HeroId, sch: HeroScheme) {
  if (id === 'dax' && !scene.textures.exists('rb-freighter')) {
    paint(scene, 'rb-freighter', 76, 48, (ctx) => {
      // A boxy hauler seen from above, pointing right: a long cargo hull, a narrow cab at the
      // front and two engine pods at the back.
      shape(ctx, () => ctx.roundRect(14, 14, 44, 20, 4), '#6f7a72', sch.accent, 10);
      ctx.fillStyle = '#56605a';
      for (let i = 0; i < 3; i++) ctx.fillRect(20 + i * 12, 17, 8, 14);
      shape(ctx, () => ctx.roundRect(56, 18, 14, 12, 5), '#8a958c', sch.accent, 4);
      ctx.fillStyle = C.ink;
      ctx.fillRect(64, 20, 4, 8);
      shape(ctx, () => ctx.roundRect(8, 4, 20, 9, 3), '#56605a', sch.accent, 4);
      shape(ctx, () => ctx.roundRect(8, 35, 20, 9, 3), '#56605a', sch.accent, 4);
      ctx.save();
      glow(ctx, sch.bolt, 10);
      ctx.fillStyle = sch.bolt;
      ctx.fillRect(4, 6, 4, 5);
      ctx.fillRect(4, 37, 4, 5);
      ctx.restore();
    });
  }
  if (id === 'kettle' && !scene.textures.exists('rb-patch')) {
    paint(scene, 'rb-patch', 26, 26, (ctx) => {
      shape(ctx, () => ctx.roundRect(7, 8, 12, 10, 3), '#e4e7ee', sch.accent, 8);
      // A green cross for healing (never red).
      ctx.fillStyle = C.heal;
      ctx.fillRect(12, 9, 2, 8);
      ctx.fillRect(9, 12, 8, 2);
      outline(ctx, () => ctx.ellipse(13, 6, 9, 2.5, 0, 0, Math.PI * 2), sch.accent, 1.5, 6);
    });
  }
  if (id === 'cassia' && !scene.textures.exists('rb-spydrone')) {
    paint(scene, 'rb-spydrone', 28, 24, (ctx) => {
      shape(ctx, () => {
        ctx.moveTo(4, 12);
        ctx.lineTo(14, 4);
        ctx.lineTo(24, 12);
        ctx.lineTo(14, 20);
        ctx.closePath();
      }, '#1c1f2a', sch.accent, 10);
      ctx.fillStyle = sch.accent;
      ctx.beginPath();
      ctx.arc(14, 12, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}
