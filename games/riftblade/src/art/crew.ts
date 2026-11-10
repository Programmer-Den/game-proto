/**
 * The crew's art: Dax Morrow (a smuggler in a vest with a heavy pistol), Grunda (a big furred
 * hunter with a crossbow), KT-4 "Kettle" (a small boxy droid with a zap prod), Cassia Vane (a
 * hooded spy with a long rifle), Vesk Drayl (bulky plates, a one-lens helmet and a rocket pod),
 * Rena Kask (a pilot on a hover board), Admiral Thessa Orn (a long coat and a peaked cap) and Chief
 * Wikka (small, under a leaf hood, with a slingshot) and Boss Gorbul (huge, in a draped coat with
 * a wide-mouthed blaster), each from its scheme, and their allies' textures: Dax's freighter,
 * Kettle's repair drone, Cassia's spy drone, Rena's wingmates, Wikka's tribe and his logs, and
 * Gorbul's thugs. Painted lazily, the first time one is shown
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
  if (id === 'vesk') {
    // Bulky plates, a fuel tank on his back, a round helmet with one big lens, and a rocket pod on
    // his shoulder.
    shape(ctx, () => ctx.roundRect(x - 38, y + 4, 16, 44, 6), shade(sch.body, -0.3), sch.accent, 4, z);
    ctx.fillStyle = mark;
    ctx.fillRect(x - 36, y + 12, 12, 4);
    ctx.fillRect(x - 36, y + 34, 12, 4);
    shape(ctx, () => ctx.roundRect(x - 26, y + 6, 52, 58, 12), sch.body, sch.accent, 8, z);
    ctx.fillStyle = shade(sch.body, 0.18);
    ctx.fillRect(x - 18, y + 14, 36, 14);
    ctx.fillStyle = mark;
    ctx.fillRect(x - 26, y + 40, 52, 7);
    ctx.fillRect(x - 14, y + 30, 6, 8);
    ctx.fillRect(x + 8, y + 30, 6, 8);
    shape(ctx, () => ctx.arc(x, y - 12, 19, 0, Math.PI * 2), shade(sch.body, 0.1), sch.accent, 6, z);
    ctx.fillStyle = mark;
    ctx.fillRect(x - 19, y - 4, 38, 5);
    ctx.fillStyle = C.ink;
    ctx.beginPath();
    ctx.arc(x + 6, y - 14, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    glow(ctx, sch.accent, 10, z);
    ctx.fillStyle = sch.accent;
    ctx.beginPath();
    ctx.arc(x + 8, y - 15, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // The rocket pod: a box of four tubes on his right shoulder.
    shape(ctx, () => ctx.roundRect(x + 10, y - 2, 30, 18, 4), shade(sch.body, -0.2), sch.accent, 4, z);
    ctx.fillStyle = C.ink;
    for (const [dx, dy] of [[34, 2], [34, 9], [28, 2], [28, 9]]) ctx.fillRect(x + dx, y + dy, 5, 5);
    if (bolts) beam(ctx, x + 44, y + 7, x + 84, y - 4, sch.bolt, 6, 22, z);
    return;
  }
  if (id === 'rena') {
    // A pilot standing on a hover board: a flight suit with a harness, a round helmet with
    // goggles pushed up, and a pair of short cannons.
    ctx.save();
    glow(ctx, sch.bolt, 14, z);
    ctx.fillStyle = sch.bolt;
    ctx.fillRect(x - 22, y + 66, 10, 3);
    ctx.fillRect(x + 12, y + 66, 10, 3);
    ctx.restore();
    shape(ctx, () => ctx.roundRect(x - 32, y + 56, 64, 9, 4), mark, sch.accent, 6, z);
    shape(ctx, () => ctx.roundRect(x - 18, y + 8, 36, 48, 9), sch.body, sch.accent, 8, z);
    ctx.strokeStyle = sch.accent;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x - 14, y + 10);
    ctx.lineTo(x + 12, y + 40);
    ctx.moveTo(x + 14, y + 10);
    ctx.lineTo(x - 12, y + 40);
    ctx.stroke();
    shape(ctx, () => ctx.arc(x, y - 10, 16, 0, Math.PI * 2), SKIN, sch.accent, 4, z);
    ctx.fillStyle = sch.body;
    ctx.beginPath();
    ctx.arc(x, y - 12, 17, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = sch.accent;
    ctx.fillRect(x - 12, y - 26, 10, 6);
    ctx.fillRect(x + 2, y - 26, 10, 6);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x - 6, y - 8, 4, 3);
    ctx.fillRect(x + 4, y - 8, 4, 3);
    // Two short cannons side by side.
    ctx.fillStyle = '#2c3140';
    ctx.fillRect(x + 14, y + 20, 30, 6);
    ctx.fillRect(x + 14, y + 30, 30, 6);
    ctx.fillRect(x + 16, y + 20, 8, 20);
    if (bolts) {
      beam(ctx, x + 48, y + 23, x + 80, y + 23, sch.bolt, 3, 18, z);
      beam(ctx, x + 48, y + 33, x + 80, y + 33, sch.bolt, 3, 18, z);
    }
    return;
  }
  if (id === 'thessa') {
    // A long uniform coat with a double row of buttons and shoulder boards, a peaked cap and a pistol.
    shape(ctx, () => {
      ctx.moveTo(x - 20, y + 6);
      ctx.lineTo(x + 20, y + 6);
      ctx.lineTo(x + 24, y + 64);
      ctx.lineTo(x - 24, y + 64);
      ctx.closePath();
    }, sch.body, sch.accent, 8, z);
    ctx.fillStyle = mark;
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(x - 8, y + 14 + i * 10, 4, 4);
      ctx.fillRect(x + 4, y + 14 + i * 10, 4, 4);
    }
    ctx.fillStyle = sch.accent;
    ctx.fillRect(x - 24, y + 4, 14, 5);
    ctx.fillRect(x + 10, y + 4, 14, 5);
    ctx.fillRect(x - 22, y + 22, 6, 3);
    shape(ctx, () => ctx.arc(x, y - 10, 15, 0, Math.PI * 2), SKIN, sch.accent, 4, z);
    ctx.fillStyle = '#c9c2b6';
    ctx.fillRect(x - 15, y - 6, 4, 14);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x - 6, y - 10, 4, 3);
    ctx.fillRect(x + 4, y - 10, 4, 3);
    // The peaked cap.
    shape(ctx, () => ctx.roundRect(x - 17, y - 32, 34, 12, 5), sch.body, sch.accent, 4, z);
    ctx.fillStyle = mark;
    ctx.fillRect(x - 4, y - 21, 26, 4);
    ctx.fillStyle = sch.accent;
    ctx.fillRect(x - 3, y - 30, 6, 6);
    ctx.fillStyle = '#2c3140';
    ctx.fillRect(x + 18, y + 26, 22, 7);
    ctx.fillRect(x + 20, y + 30, 6, 10);
    if (bolts) beam(ctx, x + 44, y + 29, x + 80, y + 29, sch.bolt, 4, 20, z);
    return;
  }
  if (id === 'wikka') {
    // Small and quick: a moss-furred body under a cape of leaves, a pointed leaf hood with long
    // ears poking through, big round eyes and a forked slingshot.
    shape(ctx, () => ctx.roundRect(x - 18, y + 22, 36, 40, 14), sch.body, sch.accent, 6, z);
    ctx.fillStyle = mark;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(x - 13 + i * 9, y + 30, 6, 10, 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = shade(sch.body, -0.35);
    ctx.fillRect(x - 12, y + 58, 8, 8);
    ctx.fillRect(x + 4, y + 58, 8, 8);
    // Ears through the hood, then the hood itself, coming to a point.
    shape(ctx, () => {
      ctx.ellipse(x - 20, y - 18, 5, 14, -0.7, 0, Math.PI * 2);
    }, shade(sch.body, 0.1), sch.accent, 3, z);
    shape(ctx, () => {
      ctx.moveTo(x - 17, y + 20);
      ctx.quadraticCurveTo(x - 20, y - 14, x + 4, y - 36);
      ctx.quadraticCurveTo(x + 20, y - 10, x + 17, y + 20);
      ctx.closePath();
    }, mark, sch.accent, 6, z);
    shape(ctx, () => ctx.ellipse(x + 1, y + 2, 12, 13, 0, 0, Math.PI * 2), shade(sch.body, 0.15), sch.accent, 3, z);
    ctx.fillStyle = sch.accent;
    ctx.beginPath();
    ctx.arc(x - 4, y, 4.5, 0, Math.PI * 2);
    ctx.arc(x + 7, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.ink;
    ctx.fillRect(x - 4, y - 1, 3, 3);
    ctx.fillRect(x + 7, y - 1, 3, 3);
    // The slingshot: a forked stick and its band.
    ctx.strokeStyle = '#6a4a2a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 16, y + 40);
    ctx.lineTo(x + 26, y + 30);
    ctx.lineTo(x + 32, y + 18);
    ctx.moveTo(x + 26, y + 30);
    ctx.lineTo(x + 36, y + 26);
    ctx.stroke();
    ctx.strokeStyle = sch.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x + 32, y + 18);
    ctx.lineTo(x + 22, y + 24);
    ctx.lineTo(x + 36, y + 26);
    ctx.stroke();
    if (bolts) {
      ctx.fillStyle = sch.bolt;
      ctx.beginPath();
      ctx.arc(x + 62, y + 20, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }
  if (id === 'gorbul') {
    // Huge and round: a draped coat with a wide collar, a sash with a gem, a broad bald head with
    // a heavy brow and small eyes, rings on his fingers and a wide-mouthed blaster.
    shape(ctx, () => ctx.ellipse(x, y + 34, 38, 34, 0, 0, Math.PI * 2), sch.body, sch.accent, 10, z);
    ctx.fillStyle = shade(sch.body, -0.25);
    ctx.beginPath();
    ctx.moveTo(x - 36, y + 30);
    ctx.quadraticCurveTo(x, y + 80, x + 36, y + 30);
    ctx.lineTo(x + 30, y + 62);
    ctx.lineTo(x - 30, y + 62);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = mark;
    ctx.fillRect(x - 34, y + 36, 68, 7);
    ctx.save();
    glow(ctx, sch.accent, 10, z);
    ctx.fillStyle = sch.accent;
    ctx.beginPath();
    ctx.arc(x, y + 39, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    shape(ctx, () => ctx.ellipse(x, y + 4, 30, 10, 0, 0, Math.PI * 2), shade(sch.body, 0.15), sch.accent, 4, z);
    shape(ctx, () => ctx.ellipse(x, y - 16, 22, 19, 0, 0, Math.PI * 2), '#b08a6c', sch.accent, 5, z);
    ctx.fillStyle = shade('#b08a6c', -0.3);
    ctx.fillRect(x - 15, y - 24, 30, 4);
    ctx.fillStyle = C.ink;
    ctx.fillRect(x - 9, y - 18, 4, 3);
    ctx.fillRect(x + 6, y - 18, 4, 3);
    ctx.fillRect(x - 6, y - 6, 14, 2);
    // The blaster: a short body and a flared mouth; rings on his hand.
    ctx.fillStyle = '#2c3140';
    ctx.fillRect(x + 22, y + 22, 22, 9);
    ctx.beginPath();
    ctx.moveTo(x + 44, y + 20);
    ctx.lineTo(x + 54, y + 16);
    ctx.lineTo(x + 54, y + 37);
    ctx.lineTo(x + 44, y + 33);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd36b';
    ctx.fillRect(x + 22, y + 31, 4, 3);
    ctx.fillRect(x + 28, y + 31, 4, 3);
    if (bolts) {
      for (const dy of [-8, 0, 8]) beam(ctx, x + 58, y + 26 + dy * 0.3, x + 86, y + 26 + dy, sch.bolt, 3, 18, z);
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
  if (id === 'rena' && !scene.textures.exists('rb-wingman')) {
    paint(scene, 'rb-wingman', 34, 26, (ctx) => {
      // A small fighter seen from above, pointing right: a pointed hull and swept wings.
      shape(ctx, () => {
        ctx.moveTo(32, 13);
        ctx.lineTo(16, 8);
        ctx.lineTo(8, 2);
        ctx.lineTo(4, 4);
        ctx.lineTo(8, 13);
        ctx.lineTo(4, 22);
        ctx.lineTo(8, 24);
        ctx.lineTo(16, 18);
        ctx.closePath();
      }, sch.body, sch.accent, 8);
      ctx.fillStyle = sch.accent;
      ctx.fillRect(18, 11, 8, 4);
    });
  }
  if (id === 'wikka' && !scene.textures.exists('rb-tribesman')) {
    paint(scene, 'rb-tribesman', 22, 28, (ctx) => {
      shape(ctx, () => ctx.roundRect(4, 12, 14, 14, 5), sch.body, sch.accent, 4);
      shape(ctx, () => {
        ctx.moveTo(3, 15);
        ctx.quadraticCurveTo(3, 4, 11, 1);
        ctx.quadraticCurveTo(19, 4, 19, 15);
        ctx.closePath();
      }, sch.mark ?? sch.body, sch.accent, 4);
      ctx.fillStyle = sch.accent;
      ctx.fillRect(7, 10, 3, 3);
      ctx.fillRect(12, 10, 3, 3);
    });
  }
  if (id === 'gorbul' && !scene.textures.exists('rb-thug')) {
    paint(scene, 'rb-thug', 26, 32, (ctx) => {
      // A hired gun: a stocky body, a flat cap and a short blaster.
      shape(ctx, () => ctx.roundRect(5, 13, 16, 17, 5), sch.mark ?? sch.body, sch.accent, 4);
      shape(ctx, () => ctx.arc(13, 9, 6, 0, Math.PI * 2), '#b08a6c', sch.accent, 3);
      ctx.fillStyle = sch.body;
      ctx.fillRect(6, 2, 15, 4);
      ctx.fillStyle = '#2c3140';
      ctx.fillRect(16, 18, 9, 4);
    });
  }
  if (id === 'wikka' && !scene.textures.exists('rb-log')) {
    paint(scene, 'rb-log', 22, 40, (ctx) => {
      // A log seen from above, lying across its way (it rolls toward the right).
      shape(ctx, () => ctx.roundRect(4, 2, 14, 36, 6), '#7a5232', sch.accent, 4);
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(8, 6, 2, 28);
      ctx.fillRect(13, 6, 2, 28);
    });
  }
}
