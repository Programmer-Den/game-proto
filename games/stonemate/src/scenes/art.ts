import Phaser from 'phaser';
import { sharpRes } from '../../../../shared/scaling';
import type { Kind, Side } from '../game/chess';

// The Living Statues, painted in code: classic piece shapes carved in white marble and black
// obsidian, with faint veins and rune-lit eyes (amber for White, violet for Black). Each piece is
// painted once at boot in a 100-unit box, sharp for this screen, and the capture scenes cut the
// same painting into halves and shards when a statue breaks (`fragment`).

/** Colours as numbers for Phaser and text for canvas. */
export const C = {
  bg: 0x161b24,
  bgTop: 0x232a36,
  frame: 0x2b3240,
  frameEdge: 0x3c4558,
  light: 0xd9d6cf,
  dark: 0x5b6370,
  ink: 0xe8e4da,
  dim: 0x9aa3b2,
  amber: 0xffb84d,
  violet: 0xb98cff,
  select: 0xffb84d,
  last: 0x8fb3ff,
  dust: 0xb9b4aa,
  darkDust: 0x4b4560,
  panel: 0x202734,
  button: 0x323b4d,
  buttonHi: 0x43506a,
  gold: 0xf2c14e,
};
export const RUNE: Record<Side, number> = { w: C.amber, b: C.violet };
export const DUST: Record<Side, number> = { w: C.dust, b: C.darkDust };

const SIL: Record<Kind, string> = {
  p: 'M36 84 Q38 64 46 56 L54 56 Q62 64 64 84 Z M38 58 Q50 50 62 58 L60 62 L40 62 Z',
  r: 'M30 84 L33 42 L67 42 L70 84 Z M26 42 L26 20 L36 20 L36 28 L44 28 L44 20 L56 20 L56 28 L64 28 L64 20 L74 20 L74 42 Z',
  b: 'M36 84 Q42 66 45 60 L55 60 Q58 66 64 84 Z M50 24 Q66 38 62 52 Q58 60 50 60 Q42 60 38 52 Q34 38 50 24 Z',
  n: 'M30 84 L34 62 Q28 50 36 40 L28 32 L40 28 Q48 16 60 20 Q76 26 72 50 Q70 66 70 84 Z',
  q: 'M33 84 Q42 62 44 46 L56 46 Q58 62 67 84 Z M32 46 L27 22 L38 34 L44 16 L50 32 L56 16 L62 34 L73 22 L68 46 Z',
  // The king's crown ends in a diamond, never a cross.
  k: 'M31 84 Q40 62 42 44 L58 44 Q60 62 69 84 Z M34 44 L31 24 L69 24 L66 44 Z M50 4 L57 13 L50 22 L43 13 Z',
};
const BASE = 'M22 84 L78 84 Q80 90 78 95 L22 95 Q20 90 22 84 Z';
/** Where each statue's eyes sit, in the 100-unit box. */
export const EYES: Record<Kind, [number, number]> = { p: [50, 40], r: [50, 32], b: [50, 44], n: [58, 32], q: [50, 54], k: [50, 34] };
/** Where each statue's neck is: the head topples off above it. */
export const NECK: Record<Kind, number> = { p: 54, r: 44, b: 60, n: 48, q: 47, k: 45 };

const canvases = new Map<string, HTMLCanvasElement>();

export const pieceKey = (kind: Kind, side: Side) => `sm-${side}${kind}`;

function paintStatue(c: CanvasRenderingContext2D, kind: Kind, side: Side) {
  const white = side === 'w';
  const g = c.createLinearGradient(20, 10, 85, 95);
  g.addColorStop(0, white ? '#ffffff' : '#57506e');
  g.addColorStop(0.55, white ? '#dcd8cf' : '#2a2638');
  g.addColorStop(1, white ? '#a9a398' : '#0b0a12');
  // A soft shadow on the floor.
  c.fillStyle = 'rgba(0,0,0,0.28)';
  c.beginPath();
  c.ellipse(52, 95, 32, 5, 0, 0, Math.PI * 2);
  c.fill();
  const shape = new Path2D(`${SIL[kind]} ${BASE}`);
  c.fillStyle = g;
  c.fill(shape);
  if (kind === 'p') {
    c.beginPath();
    c.arc(50, 40, 14, 0, Math.PI * 2);
    c.fill();
  }
  c.lineJoin = 'round';
  c.lineWidth = 2.5;
  c.strokeStyle = white ? '#6d6a63' : '#000000';
  c.stroke(shape);
  if (kind === 'p') {
    c.beginPath();
    c.arc(50, 40, 14, 0, Math.PI * 2);
    c.stroke();
  }
  // A carved band on the base and a vein through the body.
  c.strokeStyle = white ? 'rgba(120,114,104,0.6)' : 'rgba(140,120,190,0.45)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(24, 88.5);
  c.lineTo(76, 88.5);
  c.moveTo(45, 66);
  c.lineTo(49, 72);
  c.lineTo(46, 77);
  c.lineTo(51, 83);
  c.stroke();
  // Rune-lit eyes with a glow.
  const [ex, ey] = EYES[kind];
  const glow = white ? '255,184,77' : '185,140,255';
  for (const dx of [-5, 5]) {
    const r = c.createRadialGradient(ex + dx, ey, 0, ex + dx, ey, 7);
    r.addColorStop(0, `rgba(${glow},0.9)`);
    r.addColorStop(1, `rgba(${glow},0)`);
    c.fillStyle = r;
    c.fillRect(ex + dx - 7, ey - 7, 14, 14);
    c.fillStyle = white ? '#ffe2a8' : '#e2d0ff';
    c.beginPath();
    c.arc(ex + dx, ey, 2.4, 0, Math.PI * 2);
    c.fill();
  }
}

/** Paints every statue for pieces shown `size` game pixels across. */
export function paintPieces(scene: Phaser.Scene, size: number) {
  const res = sharpRes(size, size, 1);
  const px = Math.ceil(size * res);
  for (const side of ['w', 'b'] as Side[]) {
    for (const kind of ['p', 'n', 'b', 'r', 'q', 'k'] as Kind[]) {
      const key = pieceKey(kind, side);
      const cv = document.createElement('canvas');
      cv.width = cv.height = px;
      const c = cv.getContext('2d')!;
      c.scale(px / 100, px / 100);
      paintStatue(c, kind, side);
      if (scene.textures.exists(key)) scene.textures.remove(key);
      scene.textures.addCanvas(key, cv);
      canvases.set(key, cv);
    }
  }
}

/** A piece of a broken statue: its texture and its middle in the 100-unit box. */
export interface Fragment {
  key: string;
  cx: number;
  cy: number;
}

/** How a statue breaks: in two side by side, head from body, or into shards. */
export type Break = 'halves' | 'neck' | 'shards';

const fragments = new Map<string, Fragment[]>();

/** A wobbly line from a to b, for a crack: the same every time for the same statue. */
function jag(a: [number, number], b: [number, number], steps: number, amp: number, seed: number): [number, number][] {
  const pts: [number, number][] = [a];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const off = Math.sin(seed * 12.9898 + i * 78.233) * amp;
    const nx = -(b[1] - a[1]);
    const ny = b[0] - a[0];
    const len = Math.hypot(nx, ny) || 1;
    pts.push([a[0] + (b[0] - a[0]) * t + (nx / len) * off, a[1] + (b[1] - a[1]) * t + (ny / len) * off]);
  }
  pts.push(b);
  return pts;
}

/** The outlines a statue breaks along, in the 100-unit box. */
function cuts(kind: Kind, how: Break, seed: number): [number, number][][] {
  if (how === 'halves') {
    const line = jag([50, -5], [50, 105], 7, 4, seed);
    return [
      [[-5, -5], ...line, [-5, 105]],
      [[105, -5], ...line, [105, 105]],
    ];
  }
  if (how === 'neck') {
    const y = NECK[kind];
    const line = jag([-5, y], [105, y + 4], 7, 3, seed);
    return [
      [[-5, -5], [105, -5], ...line.slice().reverse()],
      [...line, [105, 105], [-5, 105]],
    ];
  }
  // Shards: wedges round a point in the body, each edge a crack.
  const mid: [number, number] = [50, 62];
  const n = 7;
  const rim = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + seed;
    return [mid[0] + Math.cos(a) * 90, mid[1] + Math.sin(a) * 90] as [number, number];
  });
  const spokes = rim.map((p, i) => jag(mid, p, 4, 3, seed + i));
  return rim.map((_, i) => {
    const a = spokes[i];
    const b = spokes[(i + 1) % n];
    return [...a, ...b.slice().reverse()];
  });
}

/** Cuts a statue into fragments (painted once, then kept). */
export function fragment(scene: Phaser.Scene, kind: Kind, side: Side, how: Break): Fragment[] {
  const key = `${pieceKey(kind, side)}-${how}`;
  const known = fragments.get(key);
  if (known) return known;
  const src = canvases.get(pieceKey(kind, side))!;
  const px = src.width;
  const seed = 'pnbrqk'.indexOf(kind) + (side === 'b' ? 0.5 : 0);
  const list = cuts(kind, how, seed).map((poly, i) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = px;
    const c = cv.getContext('2d')!;
    c.scale(px / 100, px / 100);
    c.beginPath();
    poly.forEach(([x, y], j) => (j ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.closePath();
    c.save();
    c.clip();
    c.drawImage(src, 0, 0, 100, 100);
    c.restore();
    // The broken edge shows the stone's lighter inside.
    c.strokeStyle = side === 'w' ? 'rgba(255,255,255,0.55)' : 'rgba(150,120,210,0.5)';
    c.lineWidth = 1.2;
    c.save();
    c.clip();
    c.stroke();
    c.restore();
    // Where most of the fragment is: the visible part's middle, from the painted pixels.
    const data = c.getImageData(0, 0, px, px).data;
    let sx = 0;
    let sy = 0;
    let count = 0;
    const step = Math.max(1, Math.floor(px / 50));
    for (let y = 0; y < px; y += step) {
      for (let x = 0; x < px; x += step) {
        if (data[(y * px + x) * 4 + 3] > 40) {
          sx += x;
          sy += y;
          count++;
        }
      }
    }
    const fkey = `${key}-${i}`;
    if (scene.textures.exists(fkey)) scene.textures.remove(fkey);
    scene.textures.addCanvas(fkey, cv);
    return { key: fkey, cx: count ? ((sx / count) * 100) / px : 50, cy: count ? ((sy / count) * 100) / px : 50, empty: count < 3 };
  });
  const kept = list.filter((f) => !f.empty).map(({ key: k, cx, cy }) => ({ key: k, cx, cy }));
  fragments.set(key, kept);
  return kept;
}

/** A small round puff texture, for dust and glows. */
export function paintPuff(scene: Phaser.Scene) {
  if (scene.textures.exists('sm-puff')) return;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  scene.textures.addCanvas('sm-puff', cv);
}
