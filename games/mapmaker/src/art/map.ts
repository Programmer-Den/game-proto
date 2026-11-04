import { GRID, indexOf, type Feature, type Point, type Tile } from '../game/state';
import type { Terrain } from '../game/terrain';
import { t, type TextKey } from '../i18n';
import { BLUE, FOG_LETTER, FOG_LINE, GREEN, INK, LIMIT, SHEET, TREE, VELLUM, circle, poly, rng, theme, type Ctx } from './paint';

// The island as a survey sheet. `paintTerrain` paints the whole island once (it is hidden under the
// fog until surveyed): layered height tints, hillshade from the north-west, brown contours, the blue
// coastline and black map symbols. `paintFog` paints the blank, gridded drafting paper over every
// tile not charted yet and the dashed survey limit round the charted land. Both paint in units of
// a CANVAS (TS per tile, twice the screen's pixels) onto a canvas that may be bigger, shown at 1 / HI
// over the map.

/** A tile's size on the painted canvases (twice its 40 px on screen). */
export const TS = 80;
export const CANVAS = { w: GRID.w * TS, h: GRID.h * TS };

/** Each terrain's height, before noise: the tints and contours follow it. */
const ELEV: Record<Terrain, number> = {
  sea: -0.22,
  beach: 0.04,
  port: 0.02,
  grass: 0.16,
  forest: 0.22,
  village: 0.18,
  ruins: 0.2,
  hills: 0.48,
  mountain: 1.0,
  river: 0.1,
  road: 0.16,
};

/** Hypsometric tints: the colour from each height up, by day and at night. */
const BANDS: Record<'light' | 'dark', [number, string][]> = {
  light: [
    [-9, '#a9d3ec'],
    [-0.16, '#bcdff1'],
    [-0.06, '#d2eaf5'],
    [-0.02, '#f2e6bf'],
    [0.08, '#dcebc8'],
    [0.2, '#cfe2b2'],
    [0.32, '#e3e3b0'],
    [0.46, '#ead39f'],
    [0.62, '#e2bf8e'],
    [0.8, '#d6ab86'],
    [1.0, '#ece6e2'],
    [1.15, '#ffffff'],
  ],
  dark: [
    [-9, '#0f2233'],
    [-0.16, '#13293d'],
    [-0.06, '#183249'],
    [-0.02, '#4a4431'],
    [0.08, '#2f3f2a'],
    [0.2, '#34482b'],
    [0.32, '#47492d'],
    [0.46, '#574a30'],
    [0.62, '#5e4732'],
    [0.8, '#654a3b'],
    [1.0, '#6c6560'],
    [1.15, '#857e79'],
  ],
};
const FOREST_TINT = { light: '#a7cf8a', dark: '#26472a' };
const ROAD_FILL = { light: '#f6ecd2', dark: '#6a5c44' };
/** Brown contours (index and plain) and the hillshade's highlight strength. */
const CONTOUR = { light: ['rgba(150,88,44,0.9)', 'rgba(168,105,58,0.55)'], dark: ['rgba(214,150,98,0.85)', 'rgba(196,136,88,0.45)'] };
const SHINE = { light: 0.7, dark: 0.3 };

/** One flat colour per terrain, for the panel's live chart and the chart rows. */
const TINTS: Record<'light' | 'dark', Record<Terrain, string>> = {
  light: {
    sea: '#bcdff1',
    beach: '#f2e6bf',
    port: '#1d2329',
    grass: '#cfe2b2',
    forest: FOREST_TINT.light,
    village: '#1d2329',
    ruins: '#5b6670',
    hills: '#ead39f',
    mountain: '#d6ab86',
    river: '#2f7fb8',
    road: '#8d7a5c',
  },
  dark: {
    sea: '#1d3f5c',
    beach: '#6b6142',
    port: '#e4e8ec',
    grass: '#4a6640',
    forest: '#356b38',
    village: '#e4e8ec',
    ruins: '#9aa6b1',
    hills: '#7d6a43',
    mountain: '#8a6650',
    river: '#5aa6dc',
    road: '#a8946e',
  },
};
/** Every terrain, for baking a swatch of each. */
export const TERRAINS = Object.keys(TINTS.light) as Terrain[];
/** A terrain's flat colour in the current theme. */
export const tintOf = (t: Terrain) => TINTS[theme][t];

const rgb = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
function vnoise(x: number, y: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function terrainOf(tiles: Tile[]) {
  return (x: number, y: number): Terrain =>
    x < 0 || y < 0 || x >= GRID.w || y >= GRID.h ? 'sea' : tiles[indexOf(x, y)].terrain;
}

/** The ground's height at a canvas point: tile heights blended between tile centres, plus noise, peaks pointed. */
function heightField(tiles: Tile[]) {
  const T = terrainOf(tiles);
  const sm = (t: number) => t * t * (3 - 2 * t);
  return (px: number, py: number) => {
    const gx = px / TS - 0.5;
    const gy = py / TS - 0.5;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const u = sm(gx - x0);
    const v = sm(gy - y0);
    const e = (x: number, y: number) => ELEV[T(x, y)];
    let h = e(x0, y0) * (1 - u) * (1 - v) + e(x0 + 1, y0) * u * (1 - v) + e(x0, y0 + 1) * (1 - u) * v + e(x0 + 1, y0 + 1) * u * v;
    h += (vnoise(px / 70, py / 70) - 0.5) * 0.12;
    const tx = Math.round(gx);
    const ty = Math.round(gy);
    if (T(tx, ty) === 'mountain') {
      const d = Math.hypot(px - (tx + 0.5) * TS, py - (ty + 0.5) * TS) / TS;
      h += Math.max(0, 0.6 - d) * 1.4;
    }
    return h;
  };
}

/** How many canvas pixels a CANVAS unit is on `ctx`'s canvas, which is CANVAS times that. */
const unitOf = (ctx: Ctx) => ctx.canvas.width / CANVAS.w;

/** The snow over a winter isle's land, per theme, and how much of the tint it covers. */
const SNOW = { light: [243, 246, 249], dark: [128, 141, 153] } as const;
const SNOW_COVER = 0.72;
/** A frozen river's ice, per theme. */
const ICE = { light: '#8fc3e0', dark: '#4f7f9f' } as const;

/**
 * Paints the whole island (charted or not) onto a context the shape of CANVAS; a winter isle's land
 * lies under snow and its rivers are ice.
 */
export function paintTerrain(ctx: Ctx, tiles: Tile[], winter = false) {
  const T = terrainOf(tiles);
  const k = unitOf(ctx);
  const heightAt = heightField(tiles);
  const R = 2;
  const gw = CANVAS.w / R + 1;
  const gh = CANVAS.h / R + 1;
  const H = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) H[j * gw + i] = heightAt(i * R, j * R);
  const hAt = (i: number, j: number) => H[Math.min(gh - 1, Math.max(0, j)) * gw + Math.min(gw - 1, Math.max(0, i))];
  // The hillshade's light, from the north-west, at each height sample.
  const L = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) {
    for (let i = 0; i < gw; i++) L[j * gw + i] = -(hAt(i + 1, j) - hAt(i - 1, j)) - (hAt(i, j + 1) - hAt(i, j - 1));
  }
  // A sample grid read between its points, so tint edges stay smooth on a canvas finer than it.
  const between = (G: Float32Array, fi: number, fj: number) => {
    const i = Math.min(gw - 2, fi | 0);
    const j = Math.min(gh - 2, fj | 0);
    const u = fi - i;
    const v = fj - j;
    const o = j * gw + i;
    return (G[o] * (1 - u) + G[o + 1] * u) * (1 - v) + (G[o + gw] * (1 - u) + G[o + gw + 1] * u) * v;
  };

  // Tints and hillshade, pixel by pixel at the canvas's own size.
  const CW = ctx.canvas.width;
  const CH = ctx.canvas.height;
  const img = ctx.createImageData(CW, CH);
  const bands = BANDS[theme];
  const bandCol = bands.map(([, c]) => rgb(c));
  const forest = rgb(FOREST_TINT[theme]);
  const shine = SHINE[theme];
  const step = 1 / (R * k);
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      const fi = x * step;
      const fj = y * step;
      const h = between(H, fi, fj);
      let b = 0;
      while (b + 1 < bands.length && h >= bands[b + 1][0]) b++;
      let [r, g, bl] = bandCol[b];
      if (T((x / (TS * k)) | 0, (y / (TS * k)) | 0) === 'forest' && h > -0.02) {
        r = r * 0.35 + forest[0] * 0.65;
        g = g * 0.35 + forest[1] * 0.65;
        bl = bl * 0.35 + forest[2] * 0.65;
      }
      if (winter && h > -0.02) {
        const [sr, sg, sb] = SNOW[theme];
        r += (sr - r) * SNOW_COVER;
        g += (sg - g) * SNOW_COVER;
        bl += (sb - bl) * SNOW_COVER;
      }
      if (h > -0.02) {
        const s = Math.max(-0.35, Math.min(0.3, between(L, fi, fj) * 9));
        if (s < 0) {
          r *= 1 + s * 0.6;
          g *= 1 + s * 0.55;
          bl *= 1 + s * 0.45;
        } else {
          r += (255 - r) * s * shine;
          g += (255 - g) * s * shine;
          bl += (255 - bl) * s * shine;
        }
      }
      const o = (y * CW + x) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = bl;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // Everything else is drawn in CANVAS units.
  ctx.setTransform(k, 0, 0, k, 0, 0);

  // Contours by marching squares.
  const contour = (lev: number, col: string, lw: number) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const S = 2;
    for (let j = 0; j < gh - S; j += S) {
      for (let i = 0; i < gw - S; i += S) {
        const a = hAt(i, j);
        const b = hAt(i + S, j);
        const c = hAt(i + S, j + S);
        const d = hAt(i, j + S);
        const X = i * R;
        const Y = j * R;
        const s = S * R;
        const pts: [number, number][] = [];
        const e = (p: number, q: number, x1: number, y1: number, x2: number, y2: number) => {
          if (p < lev !== q < lev) {
            const t = (lev - p) / (q - p);
            pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
          }
        };
        e(a, b, X, Y, X + s, Y);
        e(b, c, X + s, Y, X + s, Y + s);
        e(c, d, X + s, Y + s, X, Y + s);
        e(d, a, X, Y + s, X, Y);
        if (pts.length >= 2) {
          ctx.moveTo(pts[0][0], pts[0][1]);
          ctx.lineTo(pts[1][0], pts[1][1]);
        }
        if (pts.length === 4) {
          ctx.moveTo(pts[2][0], pts[2][1]);
          ctx.lineTo(pts[3][0], pts[3][1]);
        }
      }
    }
    ctx.stroke();
  };
  for (let k = 1; k < 16; k++) {
    const index = k % 5 === 0;
    contour(k / 10, CONTOUR[theme][index ? 0 : 1], index ? 2.4 : 1.3);
  }
  contour(-0.06, 'rgba(47,127,184,0.45)', 1.3);
  contour(-0.16, 'rgba(47,127,184,0.45)', 1.3);
  contour(-0.02, BLUE, 2.6);

  // Rivers and roads: lines from each tile's centre to the edges it shares with the next stretch.
  const links = (kinds: Terrain[], draw: (segments: [number, number, number, number][]) => void, own: Terrain) => {
    for (let y = 0; y < GRID.h; y++) {
      for (let x = 0; x < GRID.w; x++) {
        if (T(x, y) !== own) continue;
        const cx = (x + 0.5) * TS;
        const cy = (y + 0.5) * TS;
        const segs: [number, number, number, number][] = [];
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          if (kinds.includes(T(x + dx, y + dy))) segs.push([cx, cy, cx + (dx * TS) / 2, cy + (dy * TS) / 2]);
        }
        if (segs.length === 0) segs.push([cx - 12, cy, cx + 12, cy]);
        draw(segs);
      }
    }
  };
  const stroke = (segs: [number, number, number, number][], col: string, lw: number) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of segs) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.stroke();
  };
  links(['river', 'sea'], (segs) => stroke(segs, theme === 'dark' ? 'rgba(24,50,73,0.9)' : 'rgba(188,223,241,0.9)', 12), 'river');
  links(['river', 'sea'], (segs) => stroke(segs, winter ? ICE[theme] : BLUE, 5), 'river');
  if (winter) {
    // Frozen: a broken white line of ice down the river's middle.
    ctx.setLineDash([5, 6]);
    links(['river', 'sea'], (segs) => stroke(segs, theme === 'dark' ? 'rgba(220,235,245,0.7)' : '#ffffff', 1.6), 'river');
    ctx.setLineDash([]);
  }
  // A cased road: an ink edge round a pale fill.
  links(['road', 'village', 'port'], (segs) => stroke(segs, INK, 8), 'road');
  links(['road', 'village', 'port'], (segs) => stroke(segs, ROAD_FILL[theme], 4), 'road');

  // Map symbols.
  const tree = (x: number, y: number) => {
    circle(ctx, x, y, 5.5, theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.35)', TREE, 1.6);
    circle(ctx, x, y, 1.4, TREE);
  };
  for (let y = 0; y < GRID.h; y++) {
    for (let x = 0; x < GRID.w; x++) {
      const t = T(x, y);
      const X = x * TS;
      const Y = y * TS;
      const cx = X + TS / 2;
      const cy = Y + TS / 2;
      if (t === 'forest') {
        for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) if ((i + j) % 2 === 0) tree(X + 12 + i * 18 + (j % 2) * 4, Y + 12 + j * 18);
      } else if (t === 'beach') {
        const r = rng(x * 131 + y * 17 + 5);
        ctx.fillStyle = 'rgba(160,120,60,0.55)';
        for (let k = 0; k < 22; k++) ctx.fillRect(X + 4 + r() * (TS - 8), Y + 8 + r() * (TS - 16), 2, 2);
      } else if (t === 'mountain') {
        poly(ctx, [[cx, cy - 10], [cx + 9, cy + 6], [cx - 9, cy + 6]], INK);
      } else if (t === 'village') {
        // Buildings as black blocks round a green, and the church as a ringed dot.
        for (const [dx, dy, w, h] of [[-20, -12, 14, 10], [-2, -18, 12, 12], [14, -8, 12, 14], [-16, 6, 16, 10], [6, 12, 12, 10]]) {
          ctx.save();
          ctx.translate(cx + dx, cy + dy);
          ctx.rotate(0.12);
          ctx.fillStyle = INK;
          ctx.fillRect(0, 0, w, h);
          ctx.restore();
        }
        circle(ctx, cx + 2, cy + 2, 5, SHEET, INK, 2);
        circle(ctx, cx + 2, cy + 2, 1.8, INK);
      } else if (t === 'ruins') {
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.strokeRect(cx - 18, cy - 14, 36, 28);
        ctx.setLineDash([]);
        for (const [dx, dy] of [[-10, -4], [8, 6], [0, -6]]) circle(ctx, cx + dx, cy + dy, 3, INK);
      } else if (t === 'port') {
        // A jetty out into the water and an anchor offshore.
        ctx.fillStyle = INK;
        ctx.fillRect(cx - 4, cy - 6, 8, 52);
        const ax = cx + 30;
        const ay = cy + 50;
        ctx.strokeStyle = BLUE;
        ctx.lineWidth = 2.5;
        circle(ctx, ax, ay - 14, 4, null, BLUE, 2.5);
        ctx.beginPath();
        ctx.moveTo(ax, ay - 10);
        ctx.lineTo(ax, ay + 10);
        ctx.moveTo(ax - 10, ay + 2);
        ctx.quadraticCurveTo(ax - 10, ay + 12, ax, ay + 12);
        ctx.quadraticCurveTo(ax + 10, ay + 12, ax + 10, ay + 2);
        ctx.stroke();
      }
    }
  }
}

/**
 * Paints the blank drafting paper over every fogged tile, and the dashed survey limit; on a winter
 * isle, pale blue snowflakes are scattered over the paper.
 */
export function paintFog(ctx: Ctx, tiles: Tile[], winter = false) {
  const fogged = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID.w && y < GRID.h && !tiles[indexOf(x, y)].revealed;
  const k = unitOf(ctx);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.clearRect(0, 0, CANVAS.w, CANVAS.h);
  ctx.save();
  ctx.beginPath();
  for (let y = 0; y < GRID.h; y++) for (let x = 0; x < GRID.w; x++) if (fogged(x, y)) ctx.rect(x * TS, y * TS, TS, TS);
  ctx.fillStyle = VELLUM;
  ctx.fill();
  ctx.clip();
  ctx.lineWidth = 1;
  ctx.strokeStyle = `rgba(${FOG_LINE},0.16)`;
  ctx.beginPath();
  for (let x = 0; x <= CANVAS.w; x += 20) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, CANVAS.h);
  }
  for (let y = 0; y <= CANVAS.h; y += 20) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(CANVAS.w, y + 0.5);
  }
  ctx.stroke();
  ctx.strokeStyle = `rgba(${FOG_LINE},0.32)`;
  ctx.beginPath();
  for (let y = 0; y <= GRID.h; y++) {
    ctx.moveTo(0, y * TS + 0.5);
    ctx.lineTo(CANVAS.w, y * TS + 0.5);
  }
  for (let x = 0; x <= GRID.w; x++) {
    ctx.moveTo(x * TS + 0.5, 0);
    ctx.lineTo(x * TS + 0.5, CANVAS.h);
  }
  ctx.stroke();
  // UNSURVEYED (in the player's language), lettered across up to two wide stretches of blank paper.
  ctx.font = `700 26px Inter, system-ui, sans-serif`;
  (ctx as Ctx & { letterSpacing: string }).letterSpacing = '10px';
  ctx.fillStyle = FOG_LETTER;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let placed = -9;
  let count = 0;
  for (let y = 0; y < GRID.h && count < 2; y++) {
    if (y - placed < 4) continue;
    let run = 0;
    for (let x = 0; x <= GRID.w; x++) {
      if (x < GRID.w && fogged(x, y)) {
        run++;
        continue;
      }
      if (run >= 5) {
        ctx.fillText(t('unsurveyed'), (x - run / 2) * TS, y * TS + TS / 2);
        placed = y;
        count++;
        break;
      }
      run = 0;
    }
  }
  if (winter) {
    // A six-armed flake on about every other fogged tile, placed by a hash of the tile.
    ctx.strokeStyle = 'rgba(90,166,220,0.55)';
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let y = 0; y < GRID.h; y++) {
      for (let x = 0; x < GRID.w; x++) {
        const h = (Math.imul(x * 31 + y * 17 + 5, 2654435761) >>> 0) / 2 ** 32;
        if (!fogged(x, y) || h > 0.5) continue;
        const cx = x * TS + 16 + ((h * 997) % 1) * 48;
        const cy = y * TS + 16 + ((h * 7919) % 1) * 48;
        for (let a = 0; a < 3; a++) {
          const dx = Math.cos(Math.PI / 6 + (a * Math.PI) / 3) * 7;
          const dy = Math.sin(Math.PI / 6 + (a * Math.PI) / 3) * 7;
          ctx.moveTo(cx - dx, cy - dy);
          ctx.lineTo(cx + dx, cy + dy);
        }
      }
    }
    ctx.stroke();
    ctx.lineCap = 'butt';
  }
  ctx.restore();

  // The survey limit: a dashed pencil line where charted ground meets blank paper.
  ctx.strokeStyle = LIMIT;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 5]);
  ctx.beginPath();
  for (let y = 0; y < GRID.h; y++) {
    for (let x = 0; x < GRID.w; x++) {
      if (fogged(x, y)) continue;
      const X = x * TS;
      const Y = y * TS;
      if (fogged(x, y - 1)) {
        ctx.moveTo(X, Y);
        ctx.lineTo(X + TS, Y);
      }
      if (fogged(x, y + 1)) {
        ctx.moveTo(X, Y + TS);
        ctx.lineTo(X + TS, Y + TS);
      }
      if (fogged(x - 1, y)) {
        ctx.moveTo(X, Y);
        ctx.lineTo(X, Y + TS);
      }
      if (fogged(x + 1, y)) {
        ctx.moveTo(X + TS, Y);
        ctx.lineTo(X + TS, Y + TS);
      }
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

/** A place name printed on the sheet once its tile is charted. */
export interface PlaceName {
  tile: Point;
  /** Where its middle goes, in screen pixels relative to the tile's centre. */
  dx: number;
  dy: number;
  text: string;
  kind: 'village' | 'ruin' | 'height' | 'wood' | 'river' | 'water' | 'port';
}

const VILLAGES = ['Ashby', 'Kelwick', 'Marlow', 'Pennick', 'Brackenford', 'Oakhurst', 'Saltmere', 'Wendle', 'Hollin', 'Thistle End'];
// Villages keep their names in every language; the ruins and bays are keys of `i18n/en.ts`.
const RUINS: TextKey[] = ['oldAbbey', 'watchtower', 'oldFort', 'standingStones'];
const BAYS: TextKey[] = ['southBay', 'calmBay', 'gullBay', 'sealBay'];

/**
 * The names printed on an island: its villages, ruins, peak heights, its woods and rivers (the
 * features that pay once charted whole, by their names), the harbour and the bay below it. Picked
 * from the island number and tile spots, never from Math.random.
 */
export function placeNames(tiles: Tile[], island: number, port: Point, features: Feature[]): PlaceName[] {
  const T = terrainOf(tiles);
  const out: PlaceName[] = [];
  let v = island * 3;
  let r = island;
  for (let y = 0; y < GRID.h; y++) {
    for (let x = 0; x < GRID.w; x++) {
      const here = T(x, y);
      if (here === 'village') out.push({ tile: { x, y }, dx: 0, dy: 20, text: VILLAGES[v++ % VILLAGES.length], kind: 'village' });
      if (here === 'ruins') out.push({ tile: { x, y }, dx: 0, dy: 20, text: t(RUINS[r++ % RUINS.length]), kind: 'ruin' });
      if (here === 'mountain') {
        const m = 480 + Math.floor(hash(x + island * 17, y) * 260);
        out.push({ tile: { x, y }, dx: -2, dy: 16, text: `${m} m`, kind: 'height' });
      }
    }
  }
  for (const f of features) {
    if (f.kind === 'wood') {
      // A wood's name sits on the tile of it with the most forest round it.
      let best = f.tiles[0];
      let most = -1;
      for (const p of f.tiles) {
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (T(p.x + dx, p.y + dy) === 'forest') n++;
        if (n > most) {
          most = n;
          best = p;
        }
      }
      out.push({ tile: best, dx: 0, dy: 0, text: t(f.name), kind: 'wood' });
    } else if (f.kind === 'river') {
      // A river's name runs beside its middle tile.
      const mid = f.tiles[Math.floor(f.tiles.length / 2)];
      out.push({ tile: mid, dx: 0, dy: -16, text: t(f.name), kind: 'river' });
    }
  }
  out.push({ tile: port, dx: -26, dy: 12, text: t('harbourName'), kind: 'port' });
  if (port.y + 1 < GRID.h && T(port.x, port.y + 1) === 'sea') {
    out.push({ tile: { x: port.x, y: port.y + 1 }, dx: 50, dy: 4, text: t(BAYS[island % BAYS.length]), kind: 'water' });
  }
  return out;
}

/** A place name's colour in the current theme. */
export function nameColor(kind: PlaceName['kind']) {
  return kind === 'wood' ? GREEN : kind === 'river' || kind === 'water' ? BLUE : INK;
}
