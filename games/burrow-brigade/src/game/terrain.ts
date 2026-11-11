/**
 * The ground: a mask of one byte per game pixel, 1 for earth and 0 for air. Explosions cut circles
 * out of it, Dirt Clod adds them back, and everything that moves asks `solid(x, y)`. The look of it
 * is painted by `scenes/terrainArt.ts` from the same mask. All randomness goes through `Math.random`.
 */

/** Gravity, px/s². */
export const GRAVITY = 520;
/** Wind push per wind point, px/s². Wind runs from -10 to 10. */
export const WIND_ACC = 13;
/** The fixed simulation step. */
export const DT = 1 / 60;
/** The water's surface sits this far above the bottom of the map at the start. */
export const WATER_GAP = 30;

export interface Theme {
  id: 'meadow' | 'autumn' | 'frost';
  skyTop: string;
  skyBottom: string;
  hills: [string, string];
  dirt: string;
  dirtDark: string;
  dirtLight: string;
  grass: string;
  grassDark: string;
  back: string;
  water: number;
  waterTop: number;
  /** The specks the wind blows across the sky. */
  speck: number;
  sun: string;
}

export const THEMES: Theme[] = [
  {
    id: 'meadow', skyTop: '#5cc3f2', skyBottom: '#c9f1ff', hills: ['#9fd6a8', '#7cc08a'],
    dirt: '#a36a3d', dirtDark: '#8c5530', dirtLight: '#c99760', grass: '#59c14a', grassDark: '#3f9a3a',
    back: '#4e2f18', water: 0x2f86d6, waterTop: 0x7cc6ff, speck: 0x7fcf5a, sun: '#fff3a8',
  },
  {
    id: 'autumn', skyTop: '#f2a65c', skyBottom: '#ffe2b0', hills: ['#d9946b', '#b9734f'],
    dirt: '#8a5a3b', dirtDark: '#714629', dirtLight: '#b07a52', grass: '#d98a2b', grassDark: '#b3651d',
    back: '#3f2414', water: 0x3a6fb0, waterTop: 0x8ab6e6, speck: 0xe0662f, sun: '#fff0c8',
  },
  {
    id: 'frost', skyTop: '#7a9fd8', skyBottom: '#e6f0ff', hills: ['#c4d4ec', '#a6bde0'],
    dirt: '#6f7a8f', dirtDark: '#5a6476', dirtLight: '#9aa6bb', grass: '#f4f8ff', grassDark: '#c8d6ec',
    back: '#2e3444', water: 0x2a5d9c, waterTop: 0xa8d4ff, speck: 0xffffff, sun: '#ffffff',
  },
];

export class Terrain {
  readonly mask: Uint8Array;
  /** Bumped on every change, so the painter knows to redraw. */
  version = 0;
  /** Every carve and fill since the map was made, which the painter replays on its canvas. */
  ops: { x: number; y: number; r: number; add: boolean }[] = [];
  /** The ground before its caves were dug, painted as the dark back wall. */
  back: Uint8Array | null = null;

  constructor(readonly w: number, readonly h: number, mask?: Uint8Array) {
    this.mask = mask ?? new Uint8Array(w * h);
  }

  solid(x: number, y: number) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || ix >= this.w || iy < 0 || iy >= this.h) return false;
    return this.mask[iy * this.w + ix] === 1;
  }

  /** Cuts a circle of earth away; returns how many pixels went. */
  carve(cx: number, cy: number, r: number) {
    return this.paint(cx, cy, r, 0);
  }

  /** Adds a circle of earth; returns how many pixels were added. */
  add(cx: number, cy: number, r: number) {
    return this.paint(cx, cy, r, 1);
  }

  private paint(cx: number, cy: number, r: number, v: 0 | 1) {
    let n = 0;
    const r2 = r * r;
    const y0 = Math.max(0, Math.floor(cy - r));
    const y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy;
      const half = Math.sqrt(Math.max(0, r2 - dy * dy));
      const x0 = Math.max(0, Math.floor(cx - half));
      const x1 = Math.min(this.w - 1, Math.ceil(cx + half) - 1);
      for (let x = x0; x <= x1; x++) {
        const i = y * this.w + x;
        if (this.mask[i] !== v) {
          this.mask[i] = v;
          n++;
        }
      }
    }
    if (n) {
      this.version++;
      this.ops.push({ x: cx, y: cy, r, add: v === 1 });
    }
    return n;
  }

  /** The first earth pixel at or below `y` in column `x`, or -1. */
  groundBelow(x: number, y: number) {
    for (let yy = Math.max(0, Math.floor(y)); yy < this.h; yy++) if (this.solid(x, yy)) return yy;
    return -1;
  }

  /** The way out of the ground at a point, from the earth around it, as a unit vector. */
  normal(x: number, y: number) {
    let nx = 0;
    let ny = 0;
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        if (dx * dx + dy * dy > 16) continue;
        if (this.solid(x + dx, y + dy)) {
          nx -= dx;
          ny -= dy;
        }
      }
    const len = Math.hypot(nx, ny);
    return len < 0.001 ? { x: 0, y: -1 } : { x: nx / len, y: ny / len };
  }

  clone() {
    return new Terrain(this.w, this.h, this.mask.slice());
  }
}

/** A new map for a view of `w` by `h`: rolling hills over the water, with caves and a ledge or two. */
export function generate(w: number, h: number) {
  const t = new Terrain(w, h);
  const water = h - WATER_GAP;
  const margin = 24 + Math.random() * 30;
  const waves = Array.from({ length: 4 }, (_, i) => ({
    a: (i === 0 ? 70 : 34 / i) * (0.6 + Math.random() * 0.8),
    f: ((i + 1) * 1.4 + Math.random()) / w * Math.PI * 2 * 0.55,
    p: Math.random() * Math.PI * 2,
  }));
  // Sometimes a gap of water splits the land in two.
  const gap = Math.random() < 0.3 ? { x: w * (0.42 + Math.random() * 0.16), half: 22 + Math.random() * 18 } : null;
  for (let x = 0; x < w; x++) {
    let y = h * 0.6;
    for (const wv of waves) y += wv.a * Math.sin(x * wv.f + wv.p);
    // A ridge in the middle, so there is something to shoot over.
    y -= h * 0.2 * Math.exp(-(((x - w / 2) / (w * 0.16)) ** 2));
    const edge = Math.min(x - margin, w - margin - x);
    if (edge < 40) y += (40 - edge) * 2.2;
    if (gap && Math.abs(x - gap.x) < gap.half) y = h;
    y = Math.max(h * 0.24, Math.min(h + 10, y));
    for (let yy = Math.floor(y); yy < h; yy++) t.mask[yy * w + x] = 1;
  }
  t.back = t.mask.slice();
  // Caves.
  const caves = 2 + Math.floor(Math.random() * 3);
  for (let i = 0; i < caves; i++) {
    const cx = w * (0.15 + Math.random() * 0.7);
    const top = t.groundBelow(cx, 0);
    if (top < 0) continue;
    const cy = top + 50 + Math.random() * Math.max(10, water - top - 90);
    if (cy > water - 25) continue;
    for (let k = 0; k < 6; k++) t.carve(cx + (k - 2.5) * 12, cy + Math.sin(k) * 6, 16 + Math.random() * 6);
  }
  // Floating ledges.
  const ledges = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < ledges; i++) {
    const cx = w * (0.2 + Math.random() * 0.6);
    const top = t.groundBelow(cx, 0);
    const cy = Math.min(top - 70, h * 0.32 + Math.random() * 40);
    if (cy < 60) continue;
    for (let k = 0; k < 5; k++) t.add(cx + (k - 2) * 13, cy + Math.abs(k - 2) * 3, 12);
  }
  t.version = 0;
  t.ops = [];
  return t;
}

/** Spots to stand on: `n` per team (or `[left, right]`), team 0 on the left half and team 1 on the right. */
export function spawnPoints(t: Terrain, size: number | [number, number], water: number) {
  const out: { x: number; y: number }[][] = [[], []];
  const counts = typeof size === 'number' ? [size, size] : size;
  for (let team = 0; team < 2; team++) {
    const lo = team === 0 ? 0.06 : 0.56;
    const n = counts[team];
    for (let i = 0; i < n; i++) {
      let best: { x: number; y: number } | null = null;
      for (let tries = 0; tries < 40 && !best; tries++) {
        const x = Math.round(t.w * (lo + ((i + Math.random()) / n) * 0.38));
        const y = t.groundBelow(x, 0);
        if (y < 30 || y > water - 14) continue;
        if (out.flat().some((p) => Math.abs(p.x - x) < 26)) continue;
        best = { x, y };
      }
      if (!best) {
        // Any dry ground will do.
        for (let x = Math.round(t.w * lo); x < t.w * (lo + 0.38) && !best; x += 7) {
          const y = t.groundBelow(x, 0);
          if (y > 30 && y < water - 14 && !out.flat().some((p) => Math.abs(p.x - x) < 20)) best = { x, y };
        }
      }
      out[team].push(best ?? { x: Math.round(t.w * (lo + 0.19)), y: Math.max(30, t.groundBelow(t.w * (lo + 0.19), 0)) });
    }
  }
  return out;
}

export interface Flight {
  points: { x: number; y: number }[];
  hit: { x: number; y: number } | null;
  /** Seconds in the air. */
  time: number;
  /** Ended in the water or off the map. */
  lost: boolean;
}

/**
 * Where a shell launched from (x, y) at (vx, vy) flies with a sideways push of `ax`, step by step as
 * the live game moves it (`scenes/world.ts` uses `flyStep`). Stops at earth, at one of `bodies`, in
 * the water or after `maxT` seconds. Used for the aim preview and the Burrow AI.
 */
export function flight(t: Terrain, x: number, y: number, vx: number, vy: number, ax: number, water: number, maxT: number, bodies: { x: number; y: number }[] = [], every = 3): Flight {
  const points = [{ x, y }];
  const s = { x, y, vx, vy };
  for (let i = 1; i * DT <= maxT; i++) {
    const hit = flyStep(t, s, ax, bodies, i * DT > 0.12);
    if (i % every === 0) points.push({ x: s.x, y: s.y });
    if (hit) return { points, hit: { x: s.x, y: s.y }, time: i * DT, lost: false };
    if (s.y > water || s.x < -60 || s.x > t.w + 60) return { points, hit: null, time: i * DT, lost: true };
  }
  return { points, hit: null, time: maxT, lost: false };
}

/** One step of a flying shell; returns true when it touched earth or a body (and stops there). */
export function flyStep(t: Terrain, s: { x: number; y: number; vx: number; vy: number }, ax: number, bodies: { x: number; y: number }[] = [], hitBodies = true) {
  s.vx += ax * DT;
  s.vy += GRAVITY * DT;
  const n = Math.max(1, Math.ceil((Math.max(Math.abs(s.vx), Math.abs(s.vy)) * DT) / 2.5));
  for (let k = 0; k < n; k++) {
    const nx = s.x + (s.vx * DT) / n;
    const ny = s.y + (s.vy * DT) / n;
    if (t.solid(nx, ny)) return true;
    s.x = nx;
    s.y = ny;
    if (hitBodies) for (const b of bodies) if ((b.x - s.x) ** 2 + (b.y - 10 - s.y) ** 2 < 121) return true;
  }
  return false;
}
