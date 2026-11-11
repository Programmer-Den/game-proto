import type Phaser from 'phaser';
import type { WeaponId } from '../game/weapons';
import { WEAPONS } from '../game/weapons';
import type { Balloon, Beam, Bee, Bolt, Crate, Flame, Keg, Mole, Mound, Particle, Shot, ShotKind } from '../game/world';

/**
 * Burrow Brigade's drawing, all with Phaser Graphics and no image files: the moles and their
 * animations, every shell, bees, flames, crates, the balloon, the storm cloud, the particles of a
 * blast and the weapon icons. Each function draws one thing at its spot; the scene clears and calls
 * them every frame.
 */

type G = Phaser.GameObjects.Graphics;
/** Plain points as Phaser's point lists (it only reads x and y). */
export const pts = (p: { x: number; y: number }[]) => p as unknown as Phaser.Math.Vector2[];

export const INK = 0x2a1a12;
export const TEAM_COLORS = [0x3d8be0, 0xe8a33d];
export const TEAM_DARK = [0x24609f, 0xb0731c];
const FUR = 0x7a5640;
const FUR_DARK = 0x5c3f2d;
const BELLY = 0xc99c7a;
const PAW = 0xe89a8f;
const NOSE = 0xf07c8c;
/** Moles are drawn a little bigger than they collide. */
const MOLE_SCALE = 1.2;

/** An outlined circle. */
function oc(g: G, x: number, y: number, r: number, col: number, line = 1.4) {
  g.fillStyle(INK, 1);
  g.fillCircle(x, y, r + line);
  g.fillStyle(col, 1);
  g.fillCircle(x, y, r);
}

/** An outlined ellipse, by width and height. */
function oe(g: G, x: number, y: number, w: number, h: number, col: number, line = 1.4) {
  g.fillStyle(INK, 1);
  g.fillEllipse(x, y, w + line * 2, h + line * 2, 20);
  g.fillStyle(col, 1);
  g.fillEllipse(x, y, w, h, 20);
}

/** An outlined rectangle. */
function or(g: G, x: number, y: number, w: number, h: number, col: number, line = 1.2) {
  g.fillStyle(INK, 1);
  g.fillRect(x - line, y - line, w + line * 2, h + line * 2);
  g.fillStyle(col, 1);
  g.fillRect(x, y, w, h);
}

export interface MoleLook {
  time: number;
  /** World aim angle while the mole holds a weapon ready, else null. */
  aim: number | null;
  weapon: WeaponId | null;
}

/** A mole, with its animation picked from what it is doing. */
export function drawMole(g: G, m: Mole, look: MoleLook) {
  if (!m.alive || m.hidden) return;
  const team = TEAM_COLORS[m.team];
  const a = m.act;
  let sx = 1;
  let sy = 1;
  let lift = 0;
  let rot = 0;
  let lean = 0;
  let foot = 0;
  let squint = m.hurtT > 0;
  let armUp = 0;
  let swing = -1;
  const breathe = Math.sin(look.time * 3 + m.id) * 0.03;
  sy += breathe;
  sx -= breathe * 0.5;
  if (m.grounded && m.walk) {
    const step = Math.sin(m.walkT * 16);
    foot = step * 2.4;
    lift = Math.abs(step) * 1.4;
  }
  if (!m.grounded && !a) {
    sy = m.vy < 0 ? 1.12 : 0.94;
    sx = 1 / sy;
    armUp = 1;
  }
  if (m.hurtT > 0) rot = Math.sin(m.hurtT * 32) * 0.18 * m.hurtT;
  if (a) {
    const p = Math.min(1, a.t / a.dur);
    switch (a.kind) {
      case 'die':
        squint = true;
        if (p < 0.55) rot = Math.sin(a.t * 14) * 0.25;
        else {
          sy = Math.max(0.05, 1 - (p - 0.55) / 0.45);
          sx = 1 + (1 - sy) * 0.3;
        }
        break;
      case 'hop':
        if (a.phase === 0) {
          sy = Math.max(0.05, 1 - a.t / 0.5);
          rot = Math.sin(a.t * 40) * 0.1;
        } else if (a.phase === 2) sy = Math.min(1, (a.t - 0.9) / 0.3) * 1.1;
        break;
      case 'dig':
        rot = Math.atan2(a.dy!, Math.abs(a.dx!)) * 0.8;
        foot = Math.sin(a.t * 30) * 2;
        armUp = 2;
        break;
      case 'pound':
        if (!m.grounded) {
          rot = m.vy < 0 ? 0 : a.t * 14;
          sx = 1.1;
          sy = 0.9;
        }
        break;
      case 'swipe':
        swing = p;
        lean = 2 * Math.sin(p * Math.PI);
        break;
      case 'throw':
        swing = p;
        break;
      case 'recoil':
        lean = -3 * (1 - p);
        break;
      case 'cheer':
        armUp = 1;
        lift = Math.abs(Math.sin(a.t * 12)) * 4;
        break;
    }
  }
  g.save();
  g.translateCanvas(m.x + lean * m.facing, m.y - lift);
  g.scaleCanvas(m.facing * sx * MOLE_SCALE, sy * MOLE_SCALE);
  g.rotateCanvas(-rot);

  // Shield bubble behind the mole.
  if (m.shield) {
    g.fillStyle(0x8fd3ff, 0.18);
    g.fillCircle(0, -11, 19);
  }
  // Tail and feet.
  oe(g, -9, -5, 5, 3, FUR_DARK, 1);
  oe(g, -4 + foot, -1.5, 8, 4, PAW, 1.1);
  oe(g, 4 - foot, -1.5, 8, 4, PAW, 1.1);
  // Back paw.
  const backPaw = armUp === 1 ? { x: -8, y: -22 } : armUp === 2 ? { x: 9 + foot, y: -8 } : { x: -6, y: -9 };
  oc(g, backPaw.x, backPaw.y, 3, FUR, 1.1);
  // Body and belly.
  oe(g, 0, -11, 20, 22, FUR);
  g.fillStyle(BELLY, 1);
  g.fillEllipse(2.5, -9, 10, 13, 16);
  // Snout, nose and whiskers.
  oe(g, 9, -14, 10, 7, BELLY, 1.2);
  oc(g, 13.6, -14.6, 2.3, NOSE, 1);
  g.lineStyle(0.8, INK, 0.7);
  g.lineBetween(10.5, -12.5, 17, -11);
  g.lineBetween(10.5, -12, 16.5, -9.5);
  // Eye.
  if (squint) {
    g.lineStyle(1.3, INK, 1);
    g.lineBetween(3.4, -18.6, 6.4, -17.2);
    g.lineBetween(3.4, -15.8, 6.4, -17.2);
  } else if (m.blink < 0) {
    g.lineStyle(1.3, INK, 1);
    g.lineBetween(3.2, -17, 6.8, -17);
  } else {
    oc(g, 5, -17, 2.3, 0xffffff, 1);
    g.fillStyle(INK, 1);
    g.fillCircle(5.9, -17, 1.2);
  }
  // Helmet in the team's colour.
  g.fillStyle(INK, 1);
  g.beginPath();
  g.arc(-0.5, -20, 10.2, Math.PI, Math.PI * 2, false);
  g.closePath();
  g.fillPath();
  g.fillStyle(team, 1);
  g.beginPath();
  g.arc(-0.5, -20, 8.8, Math.PI, Math.PI * 2, false);
  g.closePath();
  g.fillPath();
  or(g, -10.5, -21.4, 20, 2.6, TEAM_DARK[m.team], 1);
  g.fillStyle(0xffffff, 0.45);
  g.fillEllipse(-3, -25.5, 5, 2.4, 10);
  // A bandage on a badly hurt mole.
  if (m.hp > 0 && m.hp < 30) {
    g.fillStyle(0xf6efe2, 1);
    g.fillRect(-8, -13, 6, 3);
    g.lineStyle(0.6, 0xb8a990, 1);
    g.strokeRect(-8, -13, 6, 3);
  }

  // Front paw and whatever it holds.
  if (look.aim !== null && look.weapon && !a) {
    const la = Math.atan2(Math.sin(look.aim), Math.cos(look.aim) * m.facing);
    // Undo the body's tilt so the prop points where the aim does.
    drawProp(g, look.weapon, la + rot, look.time);
  } else if (swing >= 0) {
    const ang = -2.2 + swing * 2.8;
    oc(g, 4 + Math.cos(ang) * 10, -12 + Math.sin(ang) * 10, 3.2, FUR, 1.1);
    if (a?.kind === 'swipe') {
      g.lineStyle(1.2, 0xffffff, 1 - swing);
      for (let i = -1; i <= 1; i++) g.lineBetween(8 + Math.cos(ang) * 10, -12 + Math.sin(ang) * 10 + i * 2, 12 + Math.cos(ang) * 12, -12 + Math.sin(ang) * 12 + i * 2);
    }
  } else if (armUp === 1) oc(g, 8, -23, 3, FUR, 1.1);
  else if (armUp === 2) oc(g, 11 - foot, -12, 3, FUR, 1.1);
  else oc(g, 6, -8, 3, FUR, 1.1);
  g.restore();

  // Dizzy stars over a hurt or dying mole.
  if ((m.hurtT > 0.15 && m.hp > 0) || a?.kind === 'die') {
    for (let i = 0; i < 3; i++) {
      const ang = look.time * 6 + (i * Math.PI * 2) / 3;
      star(g, m.x + Math.cos(ang) * 11, m.y - 36 + Math.sin(ang) * 3, 2.6, 0xffe066, 1);
    }
  }
}

/** What an aiming mole holds, in its own space (facing right, `la` up from the right). */
function drawProp(g: G, id: WeaponId, la: number, time: number) {
  const w = WEAPONS[id];
  g.save();
  g.translateCanvas(2, -12);
  if (w.group === 'rocket' || id === 'beam') {
    g.rotateCanvas(la);
    if (id === 'beam') {
      // A sun lens on a short handle.
      or(g, 0, -1.5, 12, 3, 0x8a6a3a, 1);
      oc(g, 15, 0, 6, 0xffd34d, 1.2);
      g.fillStyle(0xffffff, 0.7);
      g.fillCircle(13.5, -1.5, 2);
    } else {
      or(g, -7, -4, 27, 8, 0x4c6b5a, 1.3);
      or(g, 1, -4, 3, 8, 0x3b5446, 0);
      or(g, 18, -5, 4, 10, INK, 0);
      // Trigger paw.
      oc(g, 4, 4, 3, FUR, 1.1);
    }
  } else if (w.group === 'throw' || id === 'mine' || id === 'dynamite') {
    // Held up, ready to throw.
    const px = Math.cos(la) * 7 - 3;
    const py = Math.sin(la) * 7 - 6;
    drawShotShape(g, id, px, py, 0, 0.85, time);
    oc(g, px - 1, py + 3, 3, FUR, 1.1);
  } else if (id === 'skyrain' || id === 'bolt') {
    // A signal flag waved high.
    g.lineStyle(1.6, 0x6b4a2c, 1);
    g.lineBetween(4, 4, 6, -18);
    g.fillStyle(id === 'bolt' ? 0x8fb4ff : 0xffd34d, 1);
    const flap = Math.sin(time * 10) * 2;
    g.fillTriangle(6, -18, 17, -14 + flap, 6, -10);
    oc(g, 4, 0, 3, FUR, 1.1);
  } else if (id === 'burrow' || id === 'hop') {
    // A spade.
    g.rotateCanvas(la);
    g.lineStyle(2, 0x8a6a3a, 1);
    g.lineBetween(-2, 0, 13, 0);
    oe(g, 16, 0, 8, 7, 0xb8c0c8, 1.1);
    oc(g, 2, 2, 3, FUR, 1.1);
  } else if (id === 'shield') {
    g.lineStyle(1.5, 0x8a6a3a, 1);
    g.lineBetween(4, 4, 10, -10);
    g.lineStyle(1.5, 0x8fd3ff, 1);
    g.strokeCircle(11, -13, 5);
    oc(g, 4, 2, 3, FUR, 1.1);
  } else if (id === 'repair') {
    or(g, 2, -4, 12, 9, 0x4cae4c, 1.2);
    g.fillStyle(0xffffff, 1);
    g.fillRect(7, -3, 2, 7);
    g.fillRect(4.5, -0.5, 7, 2);
    oc(g, 2, 2, 3, FUR, 1.1);
  } else {
    // Paws up as fists.
    oc(g, 9, -2 + Math.sin(time * 8), 3.6, FUR, 1.2);
  }
  g.restore();
}

/** A shell, in flight or held, with its own look for each kind. */
export function drawShotShape(g: G, kind: ShotKind, x: number, y: number, angle: number, scale: number, time: number, extra = 0) {
  g.save();
  g.translateCanvas(x, y);
  g.scaleCanvas(scale, scale);
  g.rotateCanvas(angle);
  switch (kind) {
    case 'rocket':
    case 'mini':
    case 'acorn': {
      // An acorn rocket: nut body, cap and stem.
      const s = kind === 'mini' ? 0.65 : kind === 'acorn' ? 0.8 : 1;
      g.scaleCanvas(s, s);
      oe(g, 1, 0, 14, 9, kind === 'mini' ? 0xff8a3c : 0xc98a4b, 1.2);
      oe(g, -5, 0, 7, 11, 0x7a4d2a, 1.2);
      g.fillStyle(0x5a3a20, 1);
      g.fillRect(-11, -1, 4, 2);
      g.fillStyle(0xffffff, 0.4);
      g.fillEllipse(3, -2.5, 6, 2, 8);
      break;
    }
    case 'heavy':
      oe(g, 0, 0, 22, 13, 0x8d8f96, 1.4);
      oe(g, 9, 0, 8, 11, 0x5e6068, 1.2);
      g.fillStyle(0x4c6b5a, 1);
      g.fillTriangle(-12, 0, -18, -7, -18, 7);
      g.fillStyle(0xffffff, 0.35);
      g.fillEllipse(0, -3, 10, 3, 8);
      break;
    case 'splitter':
    case 'seed':
      // A dandelion puff.
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(0, 0, kind === 'seed' ? 4 : 7);
      g.lineStyle(1, 0xd8d8d8, 1);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + time * 2;
        g.lineBetween(0, 0, Math.cos(a) * (kind === 'seed' ? 6 : 10), Math.sin(a) * (kind === 'seed' ? 6 : 10));
      }
      g.fillStyle(0x6fa04a, 1);
      g.fillCircle(0, 0, 2);
      break;
    case 'seeker':
      // A wasp rocket: stripes and buzzing wings.
      oe(g, 0, 0, 16, 9, 0xffcf3f, 1.2);
      g.fillStyle(INK, 1);
      g.fillRect(-3, -4.5, 2.4, 9);
      g.fillRect(2, -4.5, 2.4, 9);
      g.fillStyle(INK, 1);
      g.fillTriangle(-8, 0, -13, -2, -13, 2);
      g.fillStyle(0xe8f4ff, 0.75);
      g.fillEllipse(-1, -7 - Math.abs(Math.sin(time * 40)) * 2, 8, 5, 10);
      break;
    case 'drill':
      or(g, -9, -4, 9, 8, 0x4c6b5a, 1.2);
      g.fillStyle(INK, 1);
      g.fillTriangle(-1, -6, -1, 6, 13, 0);
      g.fillStyle(0xc0c8d0, 1);
      g.fillTriangle(0, -4.6, 0, 4.6, 11, 0);
      g.lineStyle(1, 0x7a828a, 1);
      for (let i = 0; i < 3; i++) {
        const o = ((time * 30 + i * 3) % 9) + 1;
        g.lineBetween(o, -4.6 + o * 0.42, o + 1.5, 4.6 - (o + 1.5) * 0.42);
      }
      break;
    case 'grenade':
      oc(g, 0, 0, 6, 0x9a9a9a, 1.3);
      g.fillStyle(0x7a7a7a, 1);
      g.fillCircle(-2, 1.5, 1.4);
      g.fillCircle(2, -1, 1);
      or(g, -1.5, -9, 3, 3, 0x6b4a2c, 1);
      break;
    case 'cluster':
      // A pinecone.
      oe(g, 0, 0, 12, 16, 0x9a6234, 1.2);
      g.lineStyle(1, 0x5c3a1c, 1);
      for (let i = -1; i <= 1; i++) {
        g.lineBetween(-5, i * 4, 0, i * 4 + 2);
        g.lineBetween(5, i * 4, 0, i * 4 + 2);
      }
      g.fillStyle(0x4f7d36, 1);
      g.fillRect(-1, -11, 2, 3);
      break;
    case 'bomblet':
      oe(g, 0, 0, 6, 8, 0xb07a40, 1);
      break;
    case 'bouncer':
      oc(g, 0, 0, 6, 0xff9ad5, 1.3);
      g.fillStyle(0xfff36b, 1);
      g.fillRect(-6, -1.5, 12, 3);
      g.fillStyle(0xffffff, 0.6);
      g.fillCircle(-2, -2.5, 1.5);
      break;
    case 'roller':
      // A log end, rolling.
      oc(g, 0, 0, 8, 0xc99760, 1.4);
      g.lineStyle(1, 0x8a5a3b, 1);
      g.strokeCircle(0, 0, 5);
      g.strokeCircle(0, 0, 2.4);
      g.lineBetween(-7, 0, 7, 0);
      break;
    case 'ember':
      oe(g, 0, 1, 12, 11, 0xc0703a, 1.2);
      or(g, -4, -6, 8, 2.5, 0x9a5228, 1);
      g.fillStyle(0xffa13d, 1);
      g.fillTriangle(-3, -7, 3, -7, Math.sin(time * 20), -13);
      g.fillStyle(0xffe066, 1);
      g.fillTriangle(-1.5, -7, 1.5, -7, 0, -10);
      break;
    case 'beehive':
      oe(g, 0, 0, 14, 15, 0xf2c14e, 1.2);
      g.lineStyle(1, 0xb8862a, 1);
      g.lineBetween(-6, -3, 6, -3);
      g.lineBetween(-7, 1, 7, 1);
      g.lineBetween(-6, 4.5, 6, 4.5);
      g.fillStyle(INK, 1);
      g.fillCircle(0, 2, 1.6);
      break;
    case 'clod':
      oc(g, 0, 0, 7, 0xa36a3d, 1.2);
      g.fillStyle(0x59c14a, 1);
      g.fillEllipse(0, -5.5, 9, 3, 8);
      g.fillStyle(0x8c5530, 1);
      g.fillCircle(-2, 2, 1.5);
      g.fillCircle(3, 0, 1.2);
      break;
    case 'mine': {
      g.fillStyle(INK, 1);
      g.beginPath();
      g.arc(0, 2, 7.4, Math.PI, Math.PI * 2, false);
      g.closePath();
      g.fillPath();
      g.fillStyle(0x4a4f57, 1);
      g.beginPath();
      g.arc(0, 2, 6, Math.PI, Math.PI * 2, false);
      g.closePath();
      g.fillPath();
      or(g, -8, 1.5, 16, 2, 0x34383e, 0.8);
      // extra: 0 unarmed, 1 armed, 2 tripped.
      const on = extra === 2 ? Math.sin(time * 30) > 0 : extra === 1 ? Math.sin(time * 4) > 0.6 : false;
      g.fillStyle(on ? 0xff5a3c : 0x5ad06a, 1);
      g.fillCircle(0, -4.5, 1.8);
      break;
    }
    case 'dynamite':
      for (let i = -1; i <= 1; i++) or(g, i * 3.6 - 1.6, -5, 3.2, 11, 0xd8463a, 0.8);
      or(g, -5.5, -1.5, 11, 2, 0x6b4a2c, 0.6);
      g.lineStyle(1, 0x3a2a1a, 1);
      g.lineBetween(0, -5, 2 + extra * 3, -9 - extra * 3);
      break;
    default: {
      // Weapons with no shell (tools): a plain dot.
      oc(g, 0, 0, 4, 0xffffff, 1);
    }
  }
  g.restore();
}

export function drawShot(g: G, s: Shot, time: number) {
  if (s.age < 0) return;
  const ang = Math.atan2(s.vy, s.vx);
  switch (s.kind) {
    case 'rocket':
    case 'heavy':
    case 'seeker':
    case 'mini':
    case 'acorn':
    case 'drill':
      drawShotShape(g, s.kind, s.x, s.y, s.state === 'drill' ? Math.atan2(s.vy, s.vx) : ang, 1, time);
      if (s.state !== 'drill') {
        g.fillStyle(0xffd04d, 0.9);
        g.fillCircle(s.x - Math.cos(ang) * 11, s.y - Math.sin(ang) * 11, 2.5 + Math.abs(Math.sin(time * 60)) * 1.5);
      }
      return;
    case 'mine':
      drawShotShape(g, 'mine', s.x, s.y - 2, 0, 1, time, s.trip >= 0 ? 2 : s.armed ? 1 : 0);
      return;
    case 'dynamite':
      drawShotShape(g, 'dynamite', s.x, s.y - 5, s.state === 'rest' ? 0 : s.spin, 1, time, Math.max(0, s.fuse / 4.5));
      return;
    default:
      drawShotShape(g, s.kind, s.x, s.y - (s.state === 'rest' || s.state === 'roll' ? 6 : 0), s.spin, 1, time);
  }
}

export function drawFlame(g: G, f: Flame, time: number) {
  const k = Math.min(1, f.life / 1.5);
  const h = (6 + Math.sin(time * 18 + f.x) * 2) * k;
  g.fillStyle(0xff7a2f, 0.9);
  g.fillTriangle(f.x - 4 * k, f.y, f.x + 4 * k, f.y, f.x + Math.sin(time * 12 + f.y) * 2, f.y - h - 4);
  g.fillStyle(0xffd04d, 1);
  g.fillTriangle(f.x - 2 * k, f.y, f.x + 2 * k, f.y, f.x, f.y - h);
}

export function drawBee(g: G, b: Bee, time: number) {
  g.save();
  g.translateCanvas(b.x, b.y);
  g.scaleCanvas(b.vx >= 0 ? 1 : -1, 1);
  g.fillStyle(0xe8f4ff, 0.8);
  const flap = Math.abs(Math.sin(time * 50 + b.wob)) * 2.5;
  g.fillEllipse(-0.5, -3 - flap, 4, 3, 8);
  g.fillStyle(INK, 1);
  g.fillEllipse(0, 0, 8, 5.4, 10);
  g.fillStyle(0xffcf3f, 1);
  g.fillEllipse(0, 0, 6.4, 3.8, 10);
  g.fillStyle(INK, 1);
  g.fillRect(-1.2, -2, 1.2, 4);
  g.fillRect(1.4, -2, 1.2, 4);
  g.restore();
}

export function drawCrate(g: G, c: Crate, time: number) {
  const sway = c.landed ? 0 : Math.sin(c.sway) * 0.15;
  g.save();
  g.translateCanvas(c.x, c.y);
  g.rotateCanvas(sway);
  if (!c.landed) {
    // Parachute.
    g.lineStyle(0.8, 0xf6efe2, 1);
    g.lineBetween(-7, -14, -14, -34);
    g.lineBetween(7, -14, 14, -34);
    g.fillStyle(INK, 1);
    g.beginPath();
    g.arc(0, -32, 17, Math.PI, Math.PI * 2, false);
    g.closePath();
    g.fillPath();
    g.fillStyle(c.kind === 'health' ? 0xf6efe2 : 0x5fb0ff, 1);
    g.beginPath();
    g.arc(0, -32, 15.6, Math.PI, Math.PI * 2, false);
    g.closePath();
    g.fillPath();
    g.fillStyle(0xffffff, 0.5);
    g.fillRect(-2, -47, 4, 15);
  }
  if (c.kind === 'health') {
    or(g, -8, -15, 16, 15, 0xf6efe2, 1.3);
    g.fillStyle(0x3fae4a, 1);
    g.fillRect(-1.6, -12.5, 3.2, 10);
    g.fillRect(-5, -9, 10, 3.2);
  } else {
    or(g, -8, -15, 16, 15, 0xd6a456, 1.3);
    g.lineStyle(1.3, 0x8a5a2b, 1);
    g.lineBetween(-8, -15, 8, 0);
    g.lineBetween(-8, -7.5, 8, -7.5);
    g.fillStyle(0xffe066, 0.9 + Math.sin(time * 6) * 0.1);
    g.fillCircle(0, -7.5, 2.2);
  }
  g.restore();
}

export function drawBalloon(g: G, b: Balloon, time: number) {
  const bob = Math.sin(time * 3) * 2;
  g.save();
  g.translateCanvas(b.x, b.y + bob);
  oe(g, 0, -12, 34, 30, TEAM_COLORS[b.team], 1.6);
  g.fillStyle(0xffffff, 0.4);
  g.fillEllipse(-6, -18, 10, 8, 10);
  g.lineStyle(1, INK, 1);
  g.lineBetween(-8, 0, -6, 9);
  g.lineBetween(8, 0, 6, 9);
  or(g, -8, 9, 16, 8, 0x8a5a2b, 1.2);
  g.restore();
}

export function drawBolt(g: G, b: Bolt, time: number, viewTop: number) {
  // A storm cloud gathers, then a zigzag bolt.
  const k = Math.min(1, b.t / 0.5);
  g.fillStyle(0x4a5068, 0.85 * k);
  for (const [dx, dy, r] of [[-16, 2, 12], [0, -4, 16], [16, 2, 12], [8, 6, 10], [-8, 6, 10]] as const) g.fillCircle(b.x + dx, viewTop + 34 + dy, r * k);
  if (!b.struck) {
    if (Math.sin(time * 40) > 0.6) {
      g.fillStyle(0xbfe0ff, 0.5);
      g.fillCircle(b.x, viewTop + 40, 10);
    }
    return;
  }
  const alpha = Math.max(0, 1 - (b.t - 0.75) / 0.4);
  const points: { x: number; y: number }[] = [];
  for (let y = viewTop + 44, i = 0; y < b.y; y += 14, i++) points.push({ x: b.x + (i % 2 ? 6 : -6) * (0.75 + Math.sin(time * 50 + i) * 0.25), y });
  points.push({ x: b.x, y: b.y });
  g.lineStyle(6, 0x8fb4ff, alpha * 0.5);
  g.strokePoints(pts(points), false);
  g.lineStyle(2.5, 0xffffff, alpha);
  g.strokePoints(pts(points), false);
}

export function drawBeam(g: G, b: Beam) {
  const k = Math.min(1, b.t / 0.4);
  g.lineStyle(12 * k, 0xffd34d, 0.35 * k);
  g.lineBetween(b.x, b.y, b.ex, b.ey);
  g.lineStyle(5 * k, 0xfff3a8, 0.8 * k);
  g.lineBetween(b.x, b.y, b.ex, b.ey);
  g.lineStyle(1.6, 0xffffff, k);
  g.lineBetween(b.x, b.y, b.ex, b.ey);
}

/** A fallen mole's molehill with a little flag in its team's colour. */
/** A powder keg: a banded barrel with a fuse cap; it glows faintly so it reads as dangerous. */
export function drawKeg(g: G, k: Keg, time: number) {
  const x = k.x;
  const y = k.y;
  g.fillStyle(INK, 1);
  g.fillRoundedRect(x - 8.5, y - 19, 17, 19.5, 4);
  g.fillStyle(0x9a5a2a, 1);
  g.fillRoundedRect(x - 7.2, y - 17.7, 14.4, 17, 3.5);
  g.fillStyle(0xb8743a, 1);
  g.fillRect(x - 4, y - 17.5, 3, 16.6);
  g.fillStyle(0x4a4a52, 1);
  g.fillRect(x - 7.2, y - 14.5, 14.4, 2);
  g.fillRect(x - 7.2, y - 5, 14.4, 2);
  // A black powder mark with a little flame on it.
  g.fillStyle(INK, 1);
  g.fillCircle(x + 1.5, y - 9.2, 3);
  g.fillStyle(0xffb03a, 0.85 + Math.sin(time * 5 + x) * 0.15);
  g.fillTriangle(x - 0.2, y - 8, x + 3.2, y - 8, x + 1.5, y - 12);
  // The fuse cap on top.
  g.fillStyle(INK, 1);
  g.fillRect(x - 1.5, y - 22, 3, 3.5);
  g.lineStyle(1.2, INK, 1);
  g.lineBetween(x, y - 22, x + 2.5, y - 25);
}

export function drawMound(g: G, m: Mound) {
  if (m.drowned) return;
  g.fillStyle(INK, 1);
  g.fillEllipse(m.x, m.y, 20, 13, 14);
  g.fillStyle(0x8c5530, 1);
  g.fillEllipse(m.x, m.y, 18, 11, 14);
  g.fillStyle(0xa36a3d, 1);
  g.fillEllipse(m.x - 2, m.y - 2, 9, 4, 10);
  g.lineStyle(1.2, 0x5a3a20, 1);
  g.lineBetween(m.x + 2, m.y - 4, m.x + 2, m.y - 18);
  g.fillStyle(TEAM_COLORS[m.team], 1);
  g.fillTriangle(m.x + 2.5, m.y - 18, m.x + 11, m.y - 15, m.x + 2.5, m.y - 12);
}

function star(g: G, x: number, y: number, r: number, col: number, alpha: number) {
  g.fillStyle(col, alpha);
  g.fillTriangle(x - r, y, x + r, y, x, y - r * 1.6);
  g.fillTriangle(x - r, y, x + r, y, x, y + r * 1.6);
  g.fillTriangle(x, y - r, x, y + r, x - r * 1.6, y);
  g.fillTriangle(x, y - r, x, y + r, x + r * 1.6, y);
}

export function drawParticle(g: G, p: Particle) {
  const k = Math.max(0, p.life / p.max);
  switch (p.kind) {
    case 'dirt':
      g.fillStyle(p.color, Math.min(1, k * 2));
      g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      break;
    case 'smoke':
      g.fillStyle(p.color, 0.45 * k);
      g.fillCircle(p.x, p.y, p.size * (1 + (1 - k) * 1.3));
      break;
    case 'spark':
      g.fillStyle(p.color, k);
      g.fillCircle(p.x, p.y, p.size);
      break;
    case 'fire':
      g.fillStyle(p.color, 0.9 * k);
      g.fillCircle(p.x, p.y, p.size * (0.4 + k * 0.6));
      break;
    case 'flash':
      g.fillStyle(p.color, k * 0.9);
      g.fillCircle(p.x, p.y, p.size * (0.7 + (1 - k) * 0.5));
      break;
    case 'ring':
      g.lineStyle(3 * k + 0.5, p.color, k * 0.8);
      g.strokeCircle(p.x, p.y, p.size * (1 - k) + 3);
      break;
    case 'drop':
      g.fillStyle(p.color, Math.min(1, k * 2));
      g.fillCircle(p.x, p.y, p.size);
      break;
    case 'heal':
      // A small green plus, rising.
      g.fillStyle(p.color, k);
      g.fillRect(p.x - p.size / 2, p.y - p.size * 0.15, p.size, p.size * 0.3);
      g.fillRect(p.x - p.size * 0.15, p.y - p.size / 2, p.size * 0.3, p.size);
      break;
    case 'feather':
      g.fillStyle(p.color, k);
      g.fillEllipse(p.x, p.y, 2, 5, 6);
      g.lineStyle(0.6, 0xcfcfcf, k);
      g.lineBetween(p.x, p.y + 2, p.x, p.y + 6);
      break;
    case 'swoosh':
      g.lineStyle(3 * k, p.color, k);
      g.beginPath();
      g.arc(p.x, p.y, p.size, p.rot > 0 ? -1.4 : Math.PI - 0.8, p.rot > 0 ? 0.8 : Math.PI + 1.4, false);
      g.strokePath();
      break;
    case 'star':
      star(g, p.x, p.y, p.size, p.color, k);
      break;
  }
}

/** A weapon's icon in a box of about 30 by 30 around (x, y). */
export function drawWeaponIcon(g: G, id: WeaponId, x: number, y: number, s = 1, time = 0) {
  g.save();
  g.translateCanvas(x, y);
  g.scaleCanvas(s, s);
  switch (id) {
    case 'rocket': drawShotShape(g, 'rocket', 0, 0, -0.6, 1.3, time); break;
    case 'heavy': drawShotShape(g, 'heavy', 0, 0, -0.6, 1, time); break;
    case 'splitter': drawShotShape(g, 'splitter', 0, 0, 0, 1.2, time); break;
    case 'seeker': drawShotShape(g, 'seeker', 0, 2, -0.4, 1.3, time); break;
    case 'firecracker':
      for (let i = -1; i <= 1; i++) drawShotShape(g, 'mini', i * 6, i * -2 + 2, -0.9, 1.2, time);
      break;
    case 'drill': drawShotShape(g, 'drill', 0, 0, -0.5, 1.2, time); break;
    case 'skyrain':
      g.save();
      g.scaleCanvas(0.55, 0.55);
      drawBalloon(g, { x: 0, y: 4, dir: 1, targetX: 0, dropped: 0, team: 0, owner: null as unknown as Mole }, 0);
      g.restore();
      drawShotShape(g, 'acorn', 9, 10, Math.PI / 2, 0.7, time);
      break;
    case 'bolt':
      g.fillStyle(0x4a5068, 1);
      g.fillCircle(-6, -8, 6);
      g.fillCircle(3, -10, 7);
      g.fillCircle(9, -7, 5);
      g.fillStyle(0xffe066, 1);
      g.fillTriangle(1, -4, -5, 6, 1, 4);
      g.fillTriangle(1, 4, -1, 14, 6, 2);
      g.fillTriangle(-1, 4, 6, 2, 1, -4);
      break;
    case 'quake':
      g.lineStyle(3, 0x8a5a3b, 1);
      g.strokePoints(pts([{ x: -13, y: 6 }, { x: -8, y: -6 }, { x: -3, y: 6 }, { x: 2, y: -6 }, { x: 7, y: 6 }, { x: 12, y: -6 }]), false);
      g.fillStyle(0xa36a3d, 1);
      g.fillRect(-14, 8, 28, 5);
      break;
    case 'swipe':
      oc(g, -2, 2, 8, FUR, 1.4);
      g.lineStyle(2, 0xffffff, 1);
      for (let i = 0; i < 3; i++) g.lineBetween(4 + i * 3, -10, 10 + i * 3, 2);
      break;
    case 'pound':
      oc(g, 0, -4, 8, FUR, 1.4);
      g.lineStyle(2, 0xffffff, 1);
      g.lineBetween(-12, 8, -6, 6);
      g.lineBetween(12, 8, 6, 6);
      g.lineBetween(0, 12, 0, 8);
      break;
    case 'burrow':
      g.rotateCanvas(-0.7);
      g.lineStyle(3, 0x8a6a3a, 1);
      g.lineBetween(-12, 0, 4, 0);
      oe(g, 9, 0, 11, 10, 0xb8c0c8, 1.3);
      break;
    case 'beam':
      oc(g, -4, -4, 7, 0xffd34d, 1.3);
      g.lineStyle(3, 0xfff3a8, 1);
      g.lineBetween(0, 0, 14, 12);
      break;
    case 'hop':
      g.fillStyle(0x4e2f18, 1);
      g.fillEllipse(-5, 8, 14, 6, 12);
      g.fillEllipse(8, -6, 12, 5, 12);
      g.lineStyle(2, 0xffffff, 1);
      g.beginPath();
      g.arc(1, 4, 9, Math.PI * 1.1, Math.PI * 1.75, false);
      g.strokePath();
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(5, -7, 9, -1, 1, -1);
      break;
    case 'shield':
      g.fillStyle(0x8fd3ff, 0.35);
      g.fillCircle(0, 0, 11);
      g.lineStyle(2, 0x8fd3ff, 1);
      g.strokeCircle(0, 0, 11);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(-4, -4, 2.5);
      break;
    case 'repair':
      or(g, -9, -8, 18, 15, 0x4cae4c, 1.4);
      g.fillStyle(0xffffff, 1);
      g.fillRect(-1.6, -5.5, 3.2, 10);
      g.fillRect(-5, -2, 10, 3.2);
      break;
    case 'skip':
      g.fillStyle(0xf6efe2, 1);
      g.fillTriangle(-8, -10, 8, -10, 0, 0);
      g.fillTriangle(-8, 10, 8, 10, 0, 0);
      g.lineStyle(1.5, INK, 1);
      g.strokeTriangle(-8, -10, 8, -10, 0, 0);
      g.strokeTriangle(-8, 10, 8, 10, 0, 0);
      break;
    default:
      drawShotShape(g, id, 0, 0, 0, 1.3, time, id === 'dynamite' ? 0.6 : 1);
  }
  g.restore();
}
