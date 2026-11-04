/**
 * The cel-shaded look, painted in code: every robot, monster, commander and part is drawn once at
 * boot into a canvas texture with flat colour, one hard shadow band and a thick ink outline. A
 * robot's look comes from its class (body and arms), its origin (head, colours, legs or rotor) and
 * its cost (size). Nothing here is loaded from image files.
 */
import Phaser from 'phaser';
import { sharpRes } from '../../../../shared/scaling';
import {
  BOSSES, ITEMS, MONSTERS, ORIGIN_COLOR, PLAYER_COMMANDERS, RIVALS, UNITS,
  type ClassId, type CommanderDef, type MonsterId, type OriginId, type PartId, type UnitDef,
} from '../game/data';

export const INK = '#0a0818';
export const UNIT_TEX = { w: 64, h: 78, footY: 72 };
export const CMD_TEX = { w: 40, h: 52, footY: 48 };
export const ICON = 20;

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
export function shade(color: number, f: number): string {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((color >> 8) & 255) * f));
  const b = Math.min(255, Math.round((color & 255) * f));
  return `rgb(${r},${g},${b})`;
}

type Ctx = CanvasRenderingContext2D;

/** Fills the current path flat, lays a darker band over its right part, then inks the outline. */
function cel(ctx: Ctx, path: () => void, color: number, opts: { split?: number; line?: number; shadow?: number } = {}) {
  ctx.save();
  path();
  ctx.fillStyle = hex(color);
  ctx.fill();
  ctx.clip();
  // The hard shadow band: everything right of a slanted line, as if lit from the upper left.
  const split = opts.split ?? 0;
  ctx.fillStyle = shade(color, opts.shadow ?? 0.62);
  ctx.beginPath();
  ctx.moveTo(split + 6, -200);
  ctx.lineTo(400, -200);
  ctx.lineTo(400, 400);
  ctx.lineTo(split - 6, 400);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  path();
  ctx.lineWidth = opts.line ?? 2.4;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, r = 3) => () => {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
};
const circle = (ctx: Ctx, x: number, y: number, r: number) => () => {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
};
const poly = (ctx: Ctx, pts: number[]) => () => {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
};

function glowDot(ctx: Ctx, x: number, y: number, r: number, color: string) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

const EYE: Record<OriginId, string> = {
  heavy: '#ffd34d', drone: '#7cf3ff', sparker: '#7cf3ff', magnet: '#ffffff', salvager: '#ff9a3c', neon: '#ffffff', hacker: '#39e58c', clockwork: '#ffe9a8',
};

/** A robot, standing on (0, 0), facing the viewer. */
function robot(ctx: Ctx, def: { origin: OriginId; cls: ClassId; cost: number }) {
  const base = ORIGIN_COLOR[def.origin];
  const metal = 0xb8c0d8;
  const dark = 0x3a3f58;
  const eye = EYE[def.origin];
  const s = 0.82 + 0.06 * def.cost;
  ctx.save();
  ctx.scale(s, s);
  const torsoW = def.cls === 'guardian' ? 30 : def.cls === 'brawler' ? 28 : def.cls === 'sniper' ? 18 : def.cls === 'saboteur' ? 20 : 24;
  const torsoH = def.cls === 'sniper' ? 26 : def.cls === 'saboteur' ? 18 : 22;
  const hip = def.origin === 'drone' ? -14 : def.origin === 'heavy' ? -12 : -14;
  const top = hip - torsoH;

  // Locomotion: treads for Heavy, a thruster for drones, legs for the rest.
  if (def.origin === 'heavy') {
    cel(ctx, rect(ctx, -18, -13, 36, 12, 6), dark, { split: 6 });
    for (let x = -13; x <= 13; x += 6.5) cel(ctx, circle(ctx, x, -7, 3), metal, { line: 1.4, split: x + 1 });
  } else if (def.origin === 'drone') {
    glowDot(ctx, 0, -6, 4, '#7cf3ff');
    cel(ctx, poly(ctx, [-7, -14, 7, -14, 4, -8, -4, -8]), dark, { split: 1 });
  } else {
    cel(ctx, rect(ctx, -10, -15, 7, 15, 2), dark, { split: -5 });
    cel(ctx, rect(ctx, 3, -15, 7, 15, 2), dark, { split: 7 });
    cel(ctx, rect(ctx, -12, -4, 10, 4, 2), metal, { split: -6, line: 1.6 });
    cel(ctx, rect(ctx, 2, -4, 10, 4, 2), metal, { split: 8, line: 1.6 });
  }

  // Back gear: a Mechanic's crane arm behind the body.
  if (def.cls === 'mechanic') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-8, top + 6);
    ctx.lineTo(-20, top - 14);
    ctx.lineTo(-10, top - 20);
    ctx.stroke();
    ctx.strokeStyle = '#ffb703';
    ctx.lineWidth = 2.6;
    ctx.stroke();
  }

  // Torso.
  if (def.cls === 'brawler') cel(ctx, () => { ctx.beginPath(); ctx.ellipse(0, hip - torsoH / 2, torsoW / 2, torsoH / 2 + 2, 0, 0, Math.PI * 2); }, base, { split: 3 });
  else if (def.cls === 'saboteur') cel(ctx, poly(ctx, [-torsoW / 2, hip, torsoW / 2, hip, torsoW / 2 - 3, top, -torsoW / 2 + 5, top + 3]), base, { split: 2 });
  else cel(ctx, rect(ctx, -torsoW / 2, top, torsoW, torsoH, 4), base, { split: torsoW / 6 });
  // Chest detail: a vent or a rivet row.
  ctx.fillStyle = INK;
  if (def.origin === 'neon' || def.origin === 'sparker') glowDot(ctx, 0, hip - torsoH / 2, 3, eye);
  else for (let i = -1; i <= 1; i++) ctx.fillRect(i * 5 - 1, hip - torsoH / 2 - 1, 2.4, 2.4);

  // Arms and weapons by class.
  const sh = top + 5;
  const half = torsoW / 2;
  if (def.cls === 'guardian') {
    cel(ctx, rect(ctx, -half - 10, sh - 2, 12, 24, 4), metal, { split: -half - 3 });
    ctx.fillStyle = hex(base);
    ctx.fillRect(-half - 6, sh + 6, 4, 8);
    cel(ctx, rect(ctx, half - 1, sh, 7, 16, 3), base, { split: half + 3 });
  } else if (def.cls === 'brawler') {
    cel(ctx, circle(ctx, -half - 4, sh + 14, 7), metal, { split: -half - 3 });
    cel(ctx, circle(ctx, half + 4, sh + 14, 7), metal, { split: half + 5 });
    cel(ctx, rect(ctx, -half - 6, sh, 6, 9, 2), dark, { split: -half - 3 });
    cel(ctx, rect(ctx, half, sh, 6, 9, 2), dark, { split: half + 3 });
  } else if (def.cls === 'gunner') {
    cel(ctx, rect(ctx, -half - 6, sh, 6, 14, 3), base, { split: -half - 3 });
    cel(ctx, rect(ctx, half - 2, sh + 2, 18, 8, 3), dark, { split: half + 12 });
    ctx.fillStyle = INK;
    ctx.fillRect(half + 13, sh + 4, 3, 4);
  } else if (def.cls === 'sniper') {
    cel(ctx, rect(ctx, -half - 12, sh - 1, 34 + torsoW, 5, 2), dark, { split: half + 12 });
    cel(ctx, rect(ctx, -4, sh - 5, 8, 4, 1), metal, { line: 1.4, split: 2 });
    glowDot(ctx, -half - 10, sh + 1.5, 1.6, '#ff8a8a');
  } else if (def.cls === 'bomber') {
    // A stubby mortar on the shoulder, tilted up, with a round bomb ready in the other hand.
    cel(ctx, poly(ctx, [half - 4, sh + 4, half + 4, sh - 14, half + 12, sh - 10, half + 4, sh + 8]), dark, { split: half + 4 });
    cel(ctx, circle(ctx, half + 8, sh - 12, 3.4), 0x0a0818, { line: 1.2 });
    cel(ctx, rect(ctx, -half - 6, sh, 6, 12, 3), base, { split: -half - 3 });
    cel(ctx, circle(ctx, -half - 4, sh + 15, 5), 0x2b2d42, { split: -half - 2 });
    glowDot(ctx, -half - 2, sh + 9, 1.5, '#ffb703');
  } else if (def.cls === 'saboteur') {
    cel(ctx, poly(ctx, [-half - 2, sh + 4, -half - 14, sh + 18, -half - 4, sh + 10]), metal, { split: -half - 8, line: 2 });
    cel(ctx, poly(ctx, [half - 2, sh + 4, half + 12, sh + 18, half + 2, sh + 10]), metal, { split: half + 6, line: 2 });
  } else {
    cel(ctx, rect(ctx, -half - 6, sh, 6, 14, 3), base, { split: -half - 3 });
    cel(ctx, rect(ctx, half, sh, 6, 12, 3), base, { split: half + 3 });
    cel(ctx, poly(ctx, [half + 1, sh + 12, half + 9, sh + 12, half + 11, sh + 20, half + 7, sh + 17, half + 3, sh + 20]), metal, { split: half + 6, line: 1.8 });
  }

  // Head by origin.
  const hy = top - 2;
  switch (def.origin) {
    case 'heavy':
      cel(ctx, rect(ctx, -10, hy - 15, 20, 15, 3), base, { split: 3 });
      cel(ctx, rect(ctx, -8, hy - 10, 16, 4, 1), 0x1a1030, { line: 1.4, shadow: 1 });
      glowDot(ctx, -3, hy - 8, 1.6, eye);
      glowDot(ctx, 3, hy - 8, 1.6, eye);
      break;
    case 'drone':
      cel(ctx, () => { ctx.beginPath(); ctx.arc(0, hy - 4, 11, Math.PI, 0); ctx.closePath(); }, base, { split: 3 });
      glowDot(ctx, 0, hy - 8, 4, eye);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, hy - 15);
      ctx.lineTo(0, hy - 20);
      ctx.stroke();
      cel(ctx, () => { ctx.beginPath(); ctx.ellipse(0, hy - 21, 18, 3, 0, 0, Math.PI * 2); }, metal, { line: 1.6, split: 4 });
      break;
    case 'sparker':
      cel(ctx, circle(ctx, 0, hy - 8, 9), base, { split: 3 });
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, hy - 17);
      for (let i = 0; i < 4; i++) ctx.lineTo(i % 2 ? 3 : -3, hy - 19 - i * 2.5);
      ctx.stroke();
      glowDot(ctx, 0, hy - 30, 3, '#7cf3ff');
      glowDot(ctx, -3.5, hy - 8, 1.8, eye);
      glowDot(ctx, 3.5, hy - 8, 1.8, eye);
      break;
    case 'magnet':
      cel(ctx, rect(ctx, -9, hy - 13, 18, 13, 4), metal, { split: 3 });
      glowDot(ctx, -3.5, hy - 7, 1.8, eye);
      glowDot(ctx, 3.5, hy - 7, 1.8, eye);
      // The horseshoe magnet: a U, red with silver tips.
      ctx.lineCap = 'butt';
      ctx.strokeStyle = INK;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(0, hy - 18, 7, Math.PI, 0, true);
      ctx.stroke();
      ctx.strokeStyle = hex(base);
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.fillStyle = '#e8ecf4';
      ctx.fillRect(-9.5, hy - 19, 5, 3);
      ctx.fillRect(4.5, hy - 19, 5, 3);
      break;
    case 'salvager':
      cel(ctx, poly(ctx, [-10, hy, 9, hy, 11, hy - 12, -2, hy - 16, -11, hy - 10]), base, { split: 2 });
      cel(ctx, rect(ctx, 1, hy - 13, 7, 6, 1), 0xa8b2c8, { line: 1.4, split: 5 });
      glowDot(ctx, -4, hy - 7, 3, eye);
      glowDot(ctx, 4.5, hy - 6, 1.6, eye);
      break;
    case 'neon':
      cel(ctx, rect(ctx, -9, hy - 14, 18, 14, 7), 0x2a1d4a, { split: 3, shadow: 0.8 });
      ctx.save();
      ctx.shadowColor = hex(base);
      ctx.shadowBlur = 6;
      ctx.strokeStyle = hex(base);
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.roundRect(-7, hy - 12, 14, 10, 5);
      ctx.stroke();
      ctx.restore();
      glowDot(ctx, -3, hy - 7, 1.6, eye);
      glowDot(ctx, 3, hy - 7, 1.6, eye);
      break;
    case 'clockwork': {
      // A brass clock face with two hands and a wind-up key on top.
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, hy - 18);
      ctx.lineTo(0, hy - 24);
      ctx.stroke();
      cel(ctx, () => { ctx.beginPath(); ctx.ellipse(-4, hy - 26, 4, 3, 0, 0, Math.PI * 2); ctx.ellipse(4, hy - 26, 4, 3, 0, 0, Math.PI * 2); }, base, { line: 1.6, split: 0 });
      cel(ctx, circle(ctx, 0, hy - 9, 10), base, { split: 3 });
      cel(ctx, circle(ctx, 0, hy - 9, 7), 0xfff3d6, { line: 1.4, shadow: 0.9 });
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, hy - 9);
      ctx.lineTo(0, hy - 14);
      ctx.moveTo(0, hy - 9);
      ctx.lineTo(4, hy - 7);
      ctx.stroke();
      glowDot(ctx, -3.5, hy - 10, 1.2, eye);
      glowDot(ctx, 3.5, hy - 10, 1.2, eye);
      break;
    }
    case 'hacker':
      cel(ctx, rect(ctx, -11, hy - 15, 22, 15, 2), 0x2b2d42, { split: 4, shadow: 0.8 });
      ctx.fillStyle = '#0d2a1d';
      ctx.fillRect(-8, hy - 12, 16, 9);
      ctx.fillStyle = eye;
      ctx.fillRect(-5, hy - 10, 2.5, 2.5);
      ctx.fillRect(2.5, hy - 10, 2.5, 2.5);
      ctx.fillRect(-4, hy - 6, 8, 1.5);
      break;
  }
  ctx.restore();
}

/** A neutral monster, standing on (0, 0). */
function monster(ctx: Ctx, id: MonsterId) {
  const c = MONSTERS[id].color;
  const metal = 0xb8c0d8;
  const eye = (x: number, y: number, r = 1.8) => glowDot(ctx, x, y, r, '#ff9a3c');
  if (id === 'mite') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    for (const sx of [-1, 1]) for (const k of [0, 1, 2]) {
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(sx * (10 + k * 2), -12 + k * 5);
      ctx.lineTo(sx * (12 + k * 2), -1);
      ctx.stroke();
    }
    cel(ctx, () => { ctx.beginPath(); ctx.ellipse(0, -10, 9, 7, 0, 0, Math.PI * 2); }, c, { split: 2 });
    eye(-3, -11);
    eye(3, -11);
  } else if (id === 'hound') {
    for (const x of [-12, -5, 5, 12]) cel(ctx, rect(ctx, x - 2, -10, 4, 10, 1), 0x3a3f58, { line: 1.6, split: x });
    cel(ctx, rect(ctx, -15, -22, 30, 13, 5), c, { split: 2 });
    cel(ctx, rect(ctx, 8, -30, 14, 11, 3), c, { split: 14 });
    eye(15, -26);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-15, -20);
    ctx.lineTo(-22, -28);
    ctx.stroke();
  } else if (id === 'crab') {
    cel(ctx, circle(ctx, -18, -16, 6), c, { split: -17 });
    cel(ctx, circle(ctx, 18, -16, 6), c, { split: 19 });
    cel(ctx, () => { ctx.beginPath(); ctx.ellipse(0, -10, 17, 10, 0, Math.PI, 0); ctx.closePath(); }, c, { split: 3 });
    for (const x of [-10, -4, 4, 10]) cel(ctx, rect(ctx, x - 1.5, -10, 3, 10, 1), 0x3a3f58, { line: 1.4, split: x });
    eye(-4, -18);
    eye(4, -18);
  } else if (id === 'golem' || id === 'crusher') {
    const k = id === 'crusher' ? 1.3 : 1;
    ctx.save();
    ctx.scale(k, k);
    cel(ctx, rect(ctx, -12, -16, 9, 16, 2), 0x3a3f58, { split: -8 });
    cel(ctx, rect(ctx, 3, -16, 9, 16, 2), 0x3a3f58, { split: 8 });
    cel(ctx, poly(ctx, [-18, -14, 18, -14, 20, -38, 6, -44, -14, -42, -20, -32]), c, { split: 4 });
    cel(ctx, rect(ctx, -26, -38, 9, 22, 3), metal, { split: -22 });
    cel(ctx, rect(ctx, 17, -38, 9, 22, 3), metal, { split: 22 });
    if (id === 'crusher') cel(ctx, rect(ctx, 14, -22, 16, 12, 2), 0x5a5a6a, { split: 22 });
    cel(ctx, rect(ctx, -8, -52, 16, 12, 3), c, { split: 2 });
    eye(-3, -46, 2.2);
    eye(3, -46, 2.2);
    ctx.restore();
  } else if (id === 'rat') {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-12, -6);
    ctx.quadraticCurveTo(-26, -6, -22, -18);
    ctx.stroke();
    cel(ctx, () => { ctx.beginPath(); ctx.ellipse(0, -9, 14, 8, 0, 0, Math.PI * 2); }, c, { split: 3 });
    cel(ctx, poly(ctx, [8, -14, 20, -8, 8, -3]), c, { split: 14 });
    cel(ctx, circle(ctx, 5, -17, 4), c, { split: 6, line: 1.8 });
    eye(12, -10);
    // A sack of loose coins on its back.
    cel(ctx, circle(ctx, -4, -18, 6), 0xffd166, { split: -2, line: 2 });
  }
}

/** A commander: a small pilot in a hard hat, standing on (0, 0). */
function commander(ctx: Ctx, c: CommanderDef) {
  cel(ctx, rect(ctx, -6, -12, 5, 12, 2), 0x2b2d42, { split: -4, line: 2 });
  cel(ctx, rect(ctx, 1, -12, 5, 12, 2), 0x2b2d42, { split: 4, line: 2 });
  cel(ctx, rect(ctx, -9, -27, 18, 16, 5), c.color, { split: 2 });
  ctx.fillStyle = hex(c.trim);
  ctx.fillRect(-9, -20, 18, 3);
  cel(ctx, circle(ctx, 0, -35, 9), 0xf1c9a0, { split: 3, shadow: 0.82 });
  cel(ctx, () => { ctx.beginPath(); ctx.arc(0, -37, 10, Math.PI, 0); ctx.lineTo(13, -37); ctx.lineTo(-13, -37); ctx.closePath(); }, c.color, { split: 3 });
  ctx.fillStyle = INK;
  ctx.fillRect(-4, -35, 2.4, 3);
  ctx.fillRect(2, -35, 2.4, 3);
  glowDot(ctx, 0, -46, 2, hex(c.trim));
}

/** A part's icon, centred on (0, 0), about 16 px across. */
export function part(ctx: Ctx, id: PartId) {
  switch (id) {
    case 'saw':
      cel(ctx, () => {
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * Math.PI * 2;
          const r = i % 2 ? 6 : 8;
          ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
      }, 0xd8dfee, { split: 1, line: 1.6 });
      cel(ctx, circle(ctx, 0, 0, 2.2), 0x3a3f58, { line: 1.2 });
      break;
    case 'servo':
      cel(ctx, rect(ctx, -7, -5, 10, 10, 2), 0x5aa9ff, { split: 0, line: 1.6 });
      cel(ctx, circle(ctx, 4, 0, 4), 0xffd166, { split: 5, line: 1.6 });
      break;
    case 'plate':
      cel(ctx, poly(ctx, [-7, -7, 7, -7, 7, 2, 0, 8, -7, 2]), 0xa8b2c8, { split: 1, line: 1.6 });
      ctx.fillStyle = INK;
      for (const [x, y] of [[-4, -4], [4, -4], [0, 3]]) ctx.fillRect(x - 1, y - 1, 2, 2);
      break;
    case 'cell':
      cel(ctx, rect(ctx, -5, -8, 10, 16, 3), 0x4ccf6a, { split: 1, line: 1.6 });
      ctx.fillStyle = INK;
      ctx.fillRect(-5, -2, 10, 2.2);
      break;
    case 'cap':
      cel(ctx, rect(ctx, -6, -6, 12, 12, 2), 0x2b2d42, { split: 2, line: 1.6, shadow: 0.8 });
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.moveTo(1, -5);
      ctx.lineTo(-3, 1);
      ctx.lineTo(0, 1);
      ctx.lineTo(-1, 5);
      ctx.lineTo(3, -1);
      ctx.lineTo(0, -1);
      ctx.closePath();
      ctx.fill();
      break;
    case 'scope':
      cel(ctx, rect(ctx, -8, -3, 13, 6, 2), 0x3a3f58, { split: 0, line: 1.6 });
      cel(ctx, circle(ctx, 5, 0, 4), 0x7cf3ff, { split: 6, line: 1.6 });
      break;
  }
}

function itemIcon(ctx: Ctx, id: string) {
  const item = ITEMS[id];
  if (!item.from.length) {
    part(ctx, id as PartId);
    return;
  }
  ctx.save();
  ctx.fillStyle = '#1a1438';
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 9.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.translate(-3, -2.5);
  ctx.scale(0.62, 0.62);
  part(ctx, item.from[0] as PartId);
  ctx.restore();
  ctx.save();
  ctx.translate(3.2, 3);
  ctx.scale(0.62, 0.62);
  part(ctx, item.from[1] as PartId);
  ctx.restore();
}

function bake(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void, res = 2) {
  if (scene.textures.exists(key)) return;
  const r = sharpRes(w, h, res);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(w * r);
  canvas.height = Math.ceil(h * r);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(r, r);
  draw(ctx);
  scene.textures.addCanvas(key, canvas);
  textureRes.set(key, r);
}

/** The resolution each texture was painted at, so images can be shown at 1 / res. */
export const textureRes = new Map<string, number>();

export const unitKey = (defId: string) => `unit:${defId}`;
export const monsterKey = (id: MonsterId) => `mon:${id}`;
export const cmdKey = (name: string) => `cmd:${name}`;
export const itemKey = (id: string) => `item:${id}`;

/** Paints every texture the game uses. */
export function bakeAll(scene: Phaser.Scene) {
  for (const def of UNITS) bakeUnit(scene, def);
  for (const id of Object.keys(MONSTERS) as MonsterId[]) {
    const big = id === 'crusher' || id === 'golem';
    bake(scene, monsterKey(id), big ? 90 : 64, big ? 90 : 78, (ctx) => {
      ctx.translate(big ? 45 : 32, big ? 84 : UNIT_TEX.footY);
      monster(ctx, id);
    });
  }
  for (const c of [...PLAYER_COMMANDERS, ...RIVALS, ...BOSSES]) {
    bake(scene, cmdKey(c.name), CMD_TEX.w, CMD_TEX.h, (ctx) => {
      ctx.translate(CMD_TEX.w / 2, CMD_TEX.footY);
      commander(ctx, c);
    });
  }
  for (const id of Object.keys(ITEMS)) {
    bake(scene, itemKey(id), ICON, ICON, (ctx) => {
      ctx.translate(ICON / 2, ICON / 2);
      itemIcon(ctx, id);
    }, 3);
  }
}

function bakeUnit(scene: Phaser.Scene, def: UnitDef) {
  bake(scene, unitKey(def.id), UNIT_TEX.w, UNIT_TEX.h, (ctx) => {
    ctx.translate(UNIT_TEX.w / 2, UNIT_TEX.footY);
    robot(ctx, def);
  });
}

/** Paints a robot into any canvas (the cover and the menu use it). */
export function paintRobot(ctx: Ctx, def: UnitDef) {
  robot(ctx, def);
}
