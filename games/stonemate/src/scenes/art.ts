import Phaser from 'phaser';
import { sharpRes } from '../../../../shared/scaling';
import type { Kind, Side } from '../game/chess';
import { NECK, paintStatue } from './statues';

// The Living Statues (drawn in `statues.ts`): sculpted figures in white marble with gold inlay and
// black obsidian with silver inlay, with rune-lit eyes (amber for White, violet for Black). Each piece
// is painted once at boot in a 100-unit box, sharp for this screen, and the capture scenes cut the
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

const canvases = new Map<string, HTMLCanvasElement>();

export const pieceKey = (kind: Kind, side: Side) => `sm-${side}${kind}`;

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
