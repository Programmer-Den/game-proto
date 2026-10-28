import type Phaser from 'phaser';
import { CHARM_KIND, type CharmId } from '../game/catalog';
import type { KindId } from '../game/kinds';
import { C, PALETTE } from './theme';

type G = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };

/** Traces a closed outline through the points, to fill or stroke. */
export function trace(g: G, pts: Pt[]) {
  g.beginPath().moveTo(pts[0].x, pts[0].y);
  for (const pt of pts.slice(1)) g.lineTo(pt.x, pt.y);
  return g.closePath();
}

/** The six glyphs Code Breaker and Memory Echo use, each in its own colour and shape. */
export const GLYPH_COLORS = [0xf2cf73, 0xd8dcf0, 0x9be7ff, 0xff8fc7, 0xb9a4ff, 0x8fe3b0] as const;

function star(g: G, x: number, y: number, r: number, points = 5, inner = 0.45) {
  const pts: Pt[] = [];
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const rr = i % 2 ? r * inner : r;
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  trace(g, pts).fillPath();
}

/** Draws glyph `id` (0 to 5) centred on (x, y), about `size` across. */
export function drawGlyph(g: G, id: number, x: number, y: number, size: number, alpha = 1) {
  const r = size / 2;
  const color = GLYPH_COLORS[id];
  g.fillStyle(color, alpha).lineStyle(Math.max(1.5, size / 16), color, alpha);
  switch (id) {
    case 0: // Sun: a disc with rays.
      g.fillCircle(x, y, r * 0.5);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        g.lineBetween(x + Math.cos(a) * r * 0.65, y + Math.sin(a) * r * 0.65, x + Math.cos(a) * r * 0.95, y + Math.sin(a) * r * 0.95);
      }
      break;
    case 1: {
      // Moon: a crescent opening to the right.
      const pts: Pt[] = [];
      for (let i = 0; i <= 24; i++) {
        const a = Math.PI / 2 + (i / 24) * Math.PI * 1.1 - 0.05 * Math.PI;
        pts.push({ x: x + Math.cos(a) * r * 0.9, y: y + Math.sin(a) * r * 0.9 });
      }
      for (let i = 24; i >= 0; i--) {
        const a = Math.PI / 2 + (i / 24) * Math.PI * 1.1 - 0.05 * Math.PI;
        pts.push({ x: x + r * 0.32 + Math.cos(a) * r * 0.72, y: y + Math.sin(a) * r * 0.78 });
      }
      trace(g, pts).fillPath();
      break;
    }
    case 2:
      star(g, x, y, r * 0.95);
      break;
    case 3: // Flame: a rising triangle.
      g.fillTriangle(x, y - r * 0.9, x + r * 0.75, y + r * 0.7, x - r * 0.75, y + r * 0.7);
      break;
    case 4: // Gem: a diamond.
      trace(g, [{ x, y: y - r * 0.95 }, { x: x + r * 0.7, y }, { x, y: y + r * 0.95 }, { x: x - r * 0.7, y }]).fillPath();
      break;
    case 5: // Eye: an almond with a dark pupil.
      g.fillEllipse(x, y, r * 1.9, r * 1.1);
      g.fillStyle(C.deep, alpha).fillCircle(x, y, r * 0.3);
      break;
  }
}

/** A small picture of a puzzle kind, centred on (x, y), about `size` across. */
export function drawKindIcon(g: G, kind: KindId, x: number, y: number, size: number, color: number) {
  const s = size / 34;
  const X = (v: number) => x + (v - 17) * s;
  const Y = (v: number) => y + (v - 17) * s;
  g.lineStyle(Math.max(1, 1.2 * s), color, 1).fillStyle(color, 1);
  switch (kind) {
    case 'nonogram': {
      const pic = [[1, 0, 0, 1], [1, 1, 1, 1], [0, 1, 1, 0], [0, 1, 1, 0]];
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (pic[r][c]) g.fillRect(X(3 + c * 7.5), Y(3 + r * 7.5), 6.5 * s, 6.5 * s);
          else g.strokeRect(X(3 + c * 7.5), Y(3 + r * 7.5), 6.5 * s, 6.5 * s);
        }
      }
      break;
    }
    case 'code':
      [0, 2, 3, 4].forEach((id, i) => drawGlyph(g, id, X(5 + i * 8), Y(13), 7 * s));
      g.fillStyle(color, 1);
      for (let i = 0; i < 3; i++) g.fillCircle(X(9 + i * 8), Y(25), 2 * s);
      break;
    case 'unjam':
      g.strokeRect(X(3), Y(3), 28 * s, 28 * s);
      g.fillStyle(C.goldBright, 1).fillRect(X(5), Y(13), 15 * s, 7 * s);
      g.fillStyle(color, 1).fillRect(X(22), Y(5), 7 * s, 15 * s).fillRect(X(8), Y(22), 20 * s, 7 * s);
      break;
    case 'bridges':
      g.lineBetween(X(8), Y(8), X(26), Y(8)).lineBetween(X(8), Y(8), X(8), Y(26));
      g.lineBetween(X(8), Y(25), X(26), Y(25)).lineBetween(X(8), Y(28), X(26), Y(28));
      for (const [a, b] of [[8, 8], [26, 8], [8, 27], [26, 27]]) g.fillStyle(C.deep, 1).fillCircle(X(a), Y(b), 5 * s).lineStyle(1.2 * s, color, 1).strokeCircle(X(a), Y(b), 5 * s);
      break;
    case 'flip':
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          if ((r + c) % 2) g.fillStyle(color, 1).fillCircle(X(7 + c * 10), Y(7 + r * 10), 4 * s);
          else g.strokeCircle(X(7 + c * 10), Y(7 + r * 10), 4 * s);
        }
      }
      break;
    case 'calc':
      g.strokeRect(X(3), Y(3), 28 * s, 28 * s);
      g.lineStyle(2.4 * s, color, 1).beginPath().moveTo(X(3), Y(17)).lineTo(X(17), Y(17)).lineTo(X(17), Y(3)).strokePath();
      g.fillRect(X(20), Y(23), 8 * s, 2 * s).fillRect(X(23), Y(20), 2 * s, 8 * s);
      break;
    case 'sums':
      g.strokeRect(X(3), Y(3), 28 * s, 28 * s);
      g.fillRect(X(3), Y(3), 9 * s, 9 * s);
      g.lineBetween(X(12), Y(12), X(31), Y(12)).lineBetween(X(12), Y(12), X(12), Y(31)).lineBetween(X(21), Y(12), X(21), Y(31)).lineBetween(X(12), Y(21), X(31), Y(21));
      break;
    case 'link':
      g.lineStyle(3 * s, color, 1).beginPath().moveTo(X(7), Y(7)).lineTo(X(27), Y(7)).lineTo(X(27), Y(17)).lineTo(X(7), Y(17)).lineTo(X(7), Y(27)).lineTo(X(27), Y(27)).strokePath();
      g.fillCircle(X(7), Y(7), 4 * s).fillCircle(X(27), Y(27), 4 * s);
      break;
    case 'echo':
      g.fillRect(X(4), Y(8), 12 * s, 18 * s);
      g.strokeRect(X(18), Y(8), 12 * s, 18 * s);
      drawGlyph(g, 2, X(24), Y(17), 8 * s);
      break;
  }
}

/** A relic's emblem, about 44 pixels across at scale 1: a lantern, a heart-cut stone, an hourglass or a crystal ball. */
export function drawRelic(g: G, relic: string, x: number, y: number, color: number, scale = 1) {
  const k = scale;
  const X = (v: number) => x + v * k;
  const Y = (v: number) => y + v * k;
  g.fillStyle(color, 1).lineStyle(2, color, 1);
  // A charm: its kind's icon in a ring with four studs, like a medallion.
  const kind = CHARM_KIND[relic as CharmId];
  if (kind) {
    g.strokeCircle(x, y, 30 * k).strokeCircle(x, y, 25 * k);
    for (const [dx, dy] of [[0, -30], [30, 0], [0, 30], [-30, 0]]) g.fillCircle(X(dx), Y(dy), 3 * k);
    drawKindIcon(g, kind, x, y, 34 * k, color);
    return;
  }
  switch (relic) {
    case 'lantern':
      g.strokeRect(X(-14), Y(-16), 28 * k, 32 * k);
      g.fillCircle(x, y, 8 * k);
      g.strokeCircle(x, Y(-22), 6 * k);
      break;
    case 'heartstone':
      g.fillCircle(X(-9), Y(-6), 11 * k).fillCircle(X(9), Y(-6), 11 * k).fillTriangle(X(-19), Y(-1), X(19), Y(-1), x, Y(20));
      break;
    case 'hourglass':
      g.fillTriangle(X(-16), Y(-20), X(16), Y(-20), x, y).fillTriangle(X(-16), Y(20), X(16), Y(20), x, y);
      g.lineBetween(X(-20), Y(-22), X(20), Y(-22)).lineBetween(X(-20), Y(22), X(20), Y(22));
      break;
    default:
      g.fillStyle(color, 0.35).fillCircle(x, Y(-4), 18 * k);
      g.strokeCircle(x, Y(-4), 18 * k);
      g.fillStyle(color, 1).fillRect(X(-14), Y(14), 28 * k, 6 * k);
      star(g, X(-5), Y(-9), 5 * k, 4, 0.4);
      break;
  }
}

export { PALETTE };
