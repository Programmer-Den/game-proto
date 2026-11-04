// The world in tapestry work: buildings in elevation, Bayeux trees, berry bushes, gold mines, the
// linen ground with its lakes, ridges and grass tufts, and the fog of unworked linen with the needle
// still at its edge.
import { BUILDINGS, BUILDING_TOP, MAP_SIZE, TILE, type BuildingId, type FactionId } from '../game/data';
import { DIRT, ROCK, SHALLOW, WATER } from '../game/map';
import { WOOL } from './figures';
import { canvas, knot, linen, mix, outline, P, PI, reseed, rnd, rr, se, sew, sp, sr, T, thread, type Ctx, type Pt } from './stitch';

export { BUILDING_TOP };
/** Room above a tree's tile for its crown. */
export const TREE_TOP = 24;

// ---------------------------------------------------------------- buildings

function tiles(c: Ctx, x0: number, y0: number, x1: number, y1: number, col: string, row = 4) {
  // A roof of scale tiles: rows of little arcs over a laid fill.
  const pts: Pt[] = [[x0, y1], [x1, y1], [x1 - 6, y0], [x0 + 6, y0]];
  sp(c, pts, col, { ang: 0, noCouch: true, line: false });
  c.save();
  P(pts)(c);
  c.clip();
  c.strokeStyle = mix(col, '#000000', 0.35);
  c.lineWidth = 0.7;
  for (let y = y0 + row, r = 0; y < y1 + row; y += row, r++)
    for (let x = x0 + (r % 2) * row; x < x1 + row; x += row * 1.6) {
      c.beginPath();
      c.arc(x, y - row, row * 0.8, 0.15, PI - 0.15);
      c.stroke();
    }
  c.restore();
  outline(c, P(pts), T.ink, 1);
}

function arch(c: Ctx, x: number, y: number, w: number, h: number, col: string) {
  sew(
    c,
    (cc) => {
      cc.beginPath();
      cc.moveTo(x, y + h);
      cc.lineTo(x, y + w / 2);
      cc.arc(x + w / 2, y + w / 2, w / 2, PI, 0);
      cc.lineTo(x + w, y + h);
      cc.closePath();
    },
    col,
    { bb: [x, y, x + w, y + h], ang: PI / 2, sp: 1.1 },
  );
}

function dome(c: Ctx, x: number, y: number, r: number, col: string) {
  sew(
    c,
    (cc) => {
      cc.beginPath();
      cc.arc(x, y, r, PI, 0);
      cc.closePath();
    },
    col,
    { bb: [x - r, y - r, x + r, y], ang: 0.4 },
  );
  knot(c, x, y - r - 1.5, 1.6, T.ochre);
}

function wall(c: Ctx, x0: number, y0: number, x1: number, y1: number, courses = 0) {
  sr(c, x0, y0, x1 - x0, y1 - y0, T.buff, { ang: 0 });
  for (let i = 1; i <= courses; i++) {
    const y = y0 + ((y1 - y0) * i) / (courses + 1);
    thread(c, [[x0 + 1, y], [x1 - 1, y]], mix(T.buff, '#000000', 0.25), 0.6);
  }
}

function pennant(c: Ctx, x: number, y: number, col: string) {
  thread(c, [[x, y], [x, y - 12]], T.ink, 1);
  sp(c, [[x, y - 12], [x + 11, y - 9], [x, y - 6]], col, { ang: 0, noCouch: true, lw: 0.6 });
}

type Painter = (c: Ctx, x: number, y: number, w: number, h: number, roof: string, trim: string) => void;

const PAINT: Record<BuildingId, Painter> = {
  town(c, x, y, w, h, roof) {
    wall(c, x + 8, y + 60, x + w - 8, y + h - 4, 4);
    arch(c, x + 24, y + 84, 18, 40, T.indigo);
    arch(c, x + w / 2 - 12, y + 80, 24, 44, T.red);
    arch(c, x + w - 42, y + 84, 18, 40, T.indigo);
    sr(c, x + w / 2 - 6, y + 98, 12, h - 102, T.ink, { line: false });
    tiles(c, x + 4, y + 30, x + w - 4, y + 62, roof);
    for (const tx of [x + 2, x + w - 18]) {
      sr(c, tx, y + 40, 16, h - 44, T.sage, { ang: 0 });
      dome(c, tx + 8, y + 40, 8, T.ochre);
      arch(c, tx + 4, y + 60, 8, 16, T.ink);
    }
    sr(c, x + w / 2 - 12, y + 12, 24, 28, T.teal, { ang: 0 });
    arch(c, x + w / 2 - 6, y + 20, 12, 16, T.ink);
    knot(c, x + w / 2, y + 29, 3, T.ochre);
    dome(c, x + w / 2, y + 12, 12, roof);
    pennant(c, x + w / 2, y - 2, T.ochre);
  },
  house(c, x, y, w, h, roof) {
    wall(c, x + 10, y + 32, x + w - 10, y + h - 4);
    arch(c, x + w / 2 - 5, y + 40, 10, 20, T.indigo);
    tiles(c, x + 4, y + 10, x + w - 4, y + 34, roof, 3.5);
    knot(c, x + w / 2, y + 8, 2, T.ochre);
  },
  farm(c, x, y, w, h, _roof, trim) {
    const cols = [T.ochre, T.sage, T.tan, T.sage, T.ochre];
    for (let r = 0; r < 5; r++) sr(c, x + 4, y + 5 + r * 11, w - 8, 8, cols[r], { ang: 0, lw: 0.6, noCouch: r % 2 === 1 });
    for (let r = 0; r < 5; r++)
      for (let i = 0; i < 9; i++) {
        const sx = x + 8 + i * 6;
        const sy = y + 12 + r * 11;
        c.strokeStyle = r % 2 ? T.green : '#8a6a20';
        c.lineWidth = 0.8;
        c.beginPath();
        c.moveTo(sx, sy);
        c.lineTo(sx + 1, sy - 6);
        c.moveTo(sx + 1, sy - 4);
        c.lineTo(sx + 3, sy - 6);
        c.stroke();
      }
    thread(c, [[x + 2, y + 2], [x + w - 2, y + 2], [x + w - 2, y + h - 2], [x + 2, y + h - 2], [x + 2, y + 2]], T.brown, 1.2);
    for (const [px, py] of [[x + 2, y + 2], [x + w - 2, y + 2], [x + 2, y + h - 2], [x + w - 2, y + h - 2], [x + w / 2, y + 2], [x + w / 2, y + h - 2]] as Pt[]) knot(c, px, py, 1.5, T.brown);
    pennant(c, x + w - 4, y + 2, trim);
  },
  lumber(c, x, y, w, h, roof) {
    for (const px of [x + 10, x + w - 12]) sr(c, px, y + 24, 3, h - 30, T.brown, { line: false });
    tiles(c, x + 4, y + 14, x + w - 4, y + 28, roof, 3);
    for (let i = 0; i < 3; i++)
      for (let k = 0; k < 3 - i; k++) {
        const cx = x + 18 + k * 10 + i * 5;
        const cy = y + h - 10 - i * 8;
        se(c, cx, cy, 5, 4.5, '#c49a62', { ang: 0, noCouch: true });
        c.strokeStyle = T.brown;
        c.lineWidth = 0.6;
        c.beginPath();
        c.arc(cx, cy, 2.2, 0, PI * 2);
        c.stroke();
      }
    thread(c, [[x + w - 6, y + h - 4], [x + w - 2, y + h - 18]], T.brown, 1.4);
    sp(c, [[x + w - 4, y + h - 20], [x + w + 1, y + h - 18], [x + w - 1, y + h - 14]], T.grey, { noCouch: true });
  },
  mine(c, x, y, w, h, roof) {
    for (const px of [x + 8, x + w - 11]) sr(c, px, y + 22, 3, h - 28, T.brown, { line: false });
    tiles(c, x + 3, y + 12, x + w - 3, y + 26, roof, 3);
    // A heap of ore under the shed, with gold knots in it.
    sp(c, [[x + 12, y + h - 4], [x + 18, y + h - 20], [x + 30, y + h - 26], [x + 44, y + h - 18], [x + 52, y + h - 4]], T.grey, { ang: 0.5 });
    for (const [dx, dy] of [[20, -10], [30, -16], [38, -9], [26, -6], [44, -8]]) knot(c, x + dx, y + h + dy, 1.6, T.ochre);
    thread(c, [[x + 4, y + h - 3], [x + 10, y + h - 20]], T.brown, 1.3);
    thread(c, [[x + 5, y + h - 21], [x + 10, y + h - 20], [x + 14, y + h - 17]], T.grey, 1.6);
  },
  barracks(c, x, y, w, h, roof, trim) {
    wall(c, x + 6, y + 44, x + w - 6, y + h - 4);
    for (let i = 0; i < 4; i++) arch(c, x + 12 + i * 19, y + 56, 12, 32, i % 2 ? T.indigo : T.ink);
    tiles(c, x + 2, y + 18, x + w - 2, y + 46, roof);
    // Kite shields hung along the eaves.
    for (let i = 0; i < 3; i++) {
      const sx = x + 22 + i * 26;
      const sy = y + 34;
      sp(c, [[sx - 5, sy - 6], [sx + 5, sy - 6], [sx + 5, sy], [sx, sy + 9], [sx - 5, sy]], [trim, T.sage, trim][i], { ang: PI / 2, noCouch: true });
      knot(c, sx, sy - 2, 1.4, T.red);
    }
    dome(c, x + w / 2, y + 18, 9, T.sage);
  },
  range(c, x, y, w, h, roof) {
    wall(c, x + 6, y + 44, x + w - 30, y + h - 4, 2);
    arch(c, x + 14, y + 58, 14, 30, T.ink);
    arch(c, x + 36, y + 58, 14, 30, T.indigo);
    tiles(c, x + 2, y + 20, x + w - 26, y + 46, roof);
    // The butt: a straw target on a stand, ringed in wool, with arrows in it.
    thread(c, [[x + w - 22, y + h - 4], [x + w - 16, y + 52]], T.brown, 1.6);
    thread(c, [[x + w - 8, y + h - 4], [x + w - 14, y + 52]], T.brown, 1.6);
    se(c, x + w - 15, y + 52, 12, 12, T.buff, { noCouch: true, ang: 0.6 });
    se(c, x + w - 15, y + 52, 8, 8, T.indigo, { noCouch: true, lw: 0.6 });
    se(c, x + w - 15, y + 52, 3.5, 3.5, T.ochre, { noCouch: true, lw: 0.6 });
    for (const [dx, dy, a] of [[-4, -3, -0.4], [3, 2, 0.3]] as [number, number, number][]) {
      const ax = x + w - 15 + dx;
      const ay = y + 52 + dy;
      thread(c, [[ax, ay], [ax - Math.cos(a) * 8, ay - Math.sin(a) * 8 - 2]], T.brown, 0.8);
    }
  },
  stable(c, x, y, w, h, roof) {
    wall(c, x + 4, y + 48, x + w - 4, y + h - 4, 1);
    arch(c, x + 30, y + 56, 34, h - 60, T.ink);
    // A horse looking out of the stable door.
    sp(c, [[x + 38, y + h - 18], [x + 42, y + 66], [x + 52, y + 62], [x + 58, y + 68], [x + 52, y + 72], [x + 46, y + h - 18]], T.teal, { ang: 0.7, lw: 0.8 });
    thread(c, [[x + 41, y + 68], [x + 45, y + 62], [x + 50, y + 61]], T.ochre, 1.4);
    knot(c, x + 52, y + 65, 0.6, T.ink);
    tiles(c, x + 2, y + 24, x + w - 2, y + 50, roof);
    // Hay at the side.
    se(c, x + 16, y + h - 12, 9, 7, T.ochre, { ang: 1.1, noCouch: true });
    for (let k = -2; k <= 2; k++) thread(c, [[x + 16 + k * 2.5, y + h - 6], [x + 16 + k * 3.5, y + h - 18]], mix(T.ochre, '#000000', 0.25), 0.5);
  },
  academy(c, x, y, w, h, roof) {
    wall(c, x + 6, y + 50, x + w - 6, y + h - 4);
    for (let i = 0; i < 5; i++) sr(c, x + 12 + i * 17, y + 52, 5, h - 56, '#efe2c2', { ang: PI / 2, sp: 1, noCouch: true, lw: 0.6 });
    sp(c, [[x + 2, y + 52], [x + w / 2, y + 30], [x + w - 2, y + 52]], roof, { ang: 0 });
    dome(c, x + w / 2, y + 30, 14, T.teal);
    sr(c, x + w / 2 - 4, y + 2, 8, 14, T.ochre, { noCouch: true });
  },
  watchtower(c, x, y, w, h, roof) {
    wall(c, x + 18, y + 18, x + w - 18, y + h - 4, 6);
    arch(c, x + w / 2 - 4, y + h - 24, 8, 20, T.ink);
    for (const wy of [y + 28, y + 42]) sr(c, x + w / 2 - 1.5, wy, 3, 7, T.ink, { line: false, noCouch: true });
    // The fighting platform, with merlons, and a cone roof above it.
    sr(c, x + 12, y + 10, w - 24, 9, T.sage, { ang: 0 });
    for (let i = 0; i < 4; i++) sr(c, x + 13 + i * 10.5, y + 5, 5, 5, T.sage, { noCouch: true, lw: 0.6 });
    sp(c, [[x + 16, y + 5], [x + w / 2, y - 14], [x + w - 16, y + 5]], roof, { ang: 0 });
    pennant(c, x + w / 2, y - 14, T.ochre);
  },
  forge(c, x, y, w, h, roof, trim) {
    // A smithy: a stone chimney with its fire, a lean-to roof, and an anvil in the yard.
    wall(c, x + 10, y + 46, x + w - 34, y + h - 4, 3);
    arch(c, x + 22, y + 58, 22, 30, T.ink);
    sp(c, [[x + 24, y + h - 8], [x + 30, y + h - 18], [x + 34, y + h - 12], [x + 38, y + h - 22], [x + 42, y + h - 8]], T.ochre, { ang: PI / 2, noCouch: true, lw: 0.5 });
    sp(c, [[x + 28, y + h - 8], [x + 33, y + h - 15], [x + 38, y + h - 8]], T.red, { ang: PI / 2, noCouch: true, lw: 0.5 });
    tiles(c, x + 4, y + 26, x + w - 28, y + 48, roof);
    sr(c, x + w - 34, y + 4, 16, h - 8, T.grey, { ang: 0 });
    for (let k = 1; k < 6; k++) thread(c, [[x + w - 33, y + 4 + k * 14], [x + w - 19, y + 4 + k * 14]], mix(T.grey, '#000000', 0.3), 0.6);
    for (const [dx, dy, r] of [[-26, -2, 4], [-22, -10, 3.2], [-16, -15, 2.4]] as [number, number, number][]) se(c, x + w + dx, y + dy, r, r * 0.8, '#cfc6b0', { noCouch: true, lw: 0.5 });
    // The anvil on its block, with a hammer leaning on it.
    sr(c, x + w - 16, y + h - 16, 8, 12, T.brown, { line: false, noCouch: true });
    sp(c, [[x + w - 22, y + h - 22], [x + w - 4, y + h - 22], [x + w - 6, y + h - 17], [x + w - 18, y + h - 17]], T.ink, { ang: 0, noCouch: true, lw: 0.6 });
    thread(c, [[x + w - 26, y + h - 4], [x + w - 20, y + h - 24]], T.brown, 1.3);
    thread(c, [[x + w - 23, y + h - 25], [x + w - 17, y + h - 23]], T.grey, 2.6);
    pennant(c, x + 14, y + 26, trim);
  },
  dock(c, x, y, w, h, roof, trim) {
    // A fishing stage: a plank deck on posts, a net hung to dry, a boat drawn up and a basket of fish.
    for (let k = 0; k < 6; k++) sr(c, x + 4 + k * 9.5, y + h - 22, 8, 16, k % 2 ? '#b08a56' : '#9c7646', { ang: PI / 2, noCouch: true, lw: 0.5 });
    for (const px of [x + 6, x + w / 2, x + w - 6]) thread(c, [[px, y + h - 6], [px, y + h - 1]], T.brown, 2);
    thread(c, [[x + 8, y + 4], [x + 8, y + h - 22]], T.brown, 1.6);
    thread(c, [[x + 30, y + 10], [x + 30, y + h - 22]], T.brown, 1.6);
    thread(c, [[x + 6, y + 6], [x + 32, y + 12]], T.brown, 1.1);
    c.save();
    c.strokeStyle = mix(T.buff, '#000000', 0.25);
    c.lineWidth = 0.6;
    for (let k = 0; k < 6; k++) {
      c.beginPath();
      c.moveTo(x + 9 + k * 4, y + 7 + k);
      c.lineTo(x + 7 + k * 4.5, y + 26);
      c.stroke();
    }
    for (let k = 0; k < 4; k++) {
      c.beginPath();
      c.moveTo(x + 8, y + 11 + k * 4);
      c.lineTo(x + 30, y + 15 + k * 3.5);
      c.stroke();
    }
    c.restore();
    // The boat, in the Bayeux way: a long hull with a curled prow and a striped sail.
    sp(c, [[x + 34, y + h - 30], [x + w + 2, y + h - 30], [x + w - 4, y + h - 22], [x + 38, y + h - 22]], roof, { ang: 0, lw: 0.7 });
    thread(c, [[x + w + 2, y + h - 30], [x + w + 3, y + h - 36], [x + w, y + h - 37]], roof, 1.4);
    thread(c, [[x + 48, y + h - 30], [x + 48, y + h - 56]], T.brown, 1.2);
    sp(c, [[x + 49, y + h - 55], [x + 60, y + h - 50], [x + 60, y + h - 34], [x + 49, y + h - 36]], trim, { ang: PI / 2, noCouch: true, lw: 0.6 });
    thread(c, [[x + 49, y + h - 45], [x + 60, y + h - 42]], T.red, 1);
    se(c, x + 16, y + h - 28, 7, 5, '#a0703a', { ang: 0, noCouch: true, lw: 0.6 });
    for (let k = 0; k < 3; k++) se(c, x + 12 + k * 4, y + h - 31, 2.6, 1.2, T.teal, { noCouch: true, lw: 0.4 });
  },
  grove(c, x, y, w, h, roof, trim) {
    // A sacred grove: three young trees inside a wattle fence, with a carved post at the gap.
    for (const [dx, sc, col] of [[14, 0.8, T.sage], [w / 2, 1, T.green], [w - 14, 0.85, T.sage]] as [number, number, string][]) {
      const bx = x + dx;
      const by = y + h - 14;
      sp(c, [[bx - 1.6, by], [bx + 1.6, by], [bx + 1.2, by - 20 * sc], [bx - 1.2, by - 20 * sc]], T.bark, { ang: PI / 2, noCouch: true, lw: 0.5 });
      se(c, bx - 5 * sc, by - 22 * sc, 5 * sc, 7 * sc, col, { rot: -0.3, ang: PI / 2, noCouch: true, lw: 0.6 });
      se(c, bx + 5 * sc, by - 22 * sc, 5 * sc, 7 * sc, col === T.green ? T.sage : T.green, { rot: 0.3, ang: PI / 2, noCouch: true, lw: 0.6 });
      se(c, bx, by - 30 * sc, 5 * sc, 7 * sc, col, { ang: PI / 2, noCouch: true, lw: 0.6 });
    }
    // The fence: stakes with a woven band.
    for (let k = 0; k < 9; k++) thread(c, [[x + 3 + k * 7.2, y + h - 2], [x + 3 + k * 7.2, y + h - 13]], T.brown, 1.4);
    sr(c, x + 2, y + h - 10, w - 4, 4, T.tan, { ang: 0, noCouch: true, lw: 0.5 });
    sr(c, x + w / 2 - 3, y + h - 24, 6, 22, roof, { ang: PI / 2, noCouch: true });
    knot(c, x + w / 2, y + h - 20, 1.8, trim);
  },
  wall(c, x, y, w, h) {
    // Palisade: sharpened stakes lashed together, standing up into the room above the tile.
    for (let k = 0; k < 4; k++) {
      const sx = x + 1 + k * 7.8;
      const top = y - 10 + (k % 2) * 3;
      sp(c, [[sx, y + h - 3], [sx + 7, y + h - 3], [sx + 7, top + 4], [sx + 3.5, top], [sx, top + 4]], k % 2 ? '#a0703a' : T.brown, { ang: PI / 2, noCouch: true, lw: 0.6 });
    }
    thread(c, [[x, y + 6], [x + w, y + 6]], T.ochre, 1.2);
    thread(c, [[x, y + h - 10], [x + w, y + h - 10]], T.ochre, 1.2);
  },
  gate(c, x, y, w, h, roof, trim) {
    // Two tall posts under a lintel, with a pair of plank doors banded in iron.
    for (const px of [x + 1, x + w - 6]) sp(c, [[px, y + h - 2], [px + 5, y + h - 2], [px + 5, y - 12], [px + 2.5, y - 16], [px, y - 12]], T.brown, { ang: PI / 2, noCouch: true, lw: 0.6 });
    sr(c, x - 1, y - 8, w + 2, 6, roof, { ang: 0, noCouch: true });
    sp(c, [[x + 6, y + h - 2], [x + w - 6, y + h - 2], [x + w - 6, y + 2], [x + 6, y + 2]], T.tan, { ang: PI / 2, sp: 1.6, noCouch: true, lw: 0.6 });
    thread(c, [[x + w / 2, y + 2], [x + w / 2, y + h - 2]], T.ink, 0.8);
    for (const yy of [y + 8, y + h - 9]) thread(c, [[x + 6, yy], [x + w - 6, yy]], T.ink, 1.2);
    knot(c, x + w / 2 - 2.5, y + h / 2 + 2, 1.1, trim);
    knot(c, x + w / 2 + 2.5, y + h / 2 + 2, 1.1, trim);
  },
  market(c, x, y, w, h, roof, trim) {
    // A market: a striped awning on poles over a counter of sacks and jars, with a pair of scales.
    for (const px of [x + 6, x + w - 6]) thread(c, [[px, y + h - 4], [px, y + 22]], T.brown, 2);
    sp(c, [[x + 2, y + 24], [x + w - 2, y + 24], [x + w - 10, y + 6], [x + 10, y + 6]], T.tan, { ang: 0 });
    for (let k = 0; k < 6; k++) thread(c, [[x + 12 + k * 13, y + 7], [x + 6 + k * 15, y + 23]], roof, 2.4);
    for (let k = 0; k < 7; k++) sp(c, [[x + 2 + k * 13, y + 24], [x + 15 + k * 13, y + 24], [x + 8.5 + k * 13, y + 31]], roof, { ang: PI / 2, noCouch: true, lw: 0.5 });
    wall(c, x + 10, y + 52, x + w - 10, y + h - 4, 2);
    sr(c, x + 8, y + 48, w - 16, 6, '#a0703a', { ang: 0, noCouch: true, lw: 0.7 });
    for (const [bx, by, col] of [[x + 20, y + 42, T.tan], [x + 34, y + 40, '#b08a56'], [x + 48, y + 43, T.tan], [x + w - 20, y + 41, T.sage]] as [number, number, string][]) {
      se(c, bx, by, 6.5, 6, col, { ang: 0, noCouch: true, lw: 0.6 });
      for (let k = 0; k < 3; k++) knot(c, bx - 3 + k * 3, by - 4, 1.2, k === 1 ? T.ochre : T.red);
    }
    for (const jx of [x + 16, x + 26]) {
      sp(c, [[jx - 3, y + 68], [jx + 3, y + 68], [jx + 4, y + 80], [jx - 4, y + 80]], T.indigo, { ang: PI / 2, noCouch: true, lw: 0.6 });
      knot(c, jx, y + 67, 1.4, T.ochre);
    }
    // The scales on the counter.
    const sx = x + w - 24;
    thread(c, [[sx, y + 48], [sx, y + 30]], T.ink, 1);
    thread(c, [[sx - 9, y + 32], [sx + 9, y + 32]], T.ink, 1);
    for (const d of [-9, 9]) {
      thread(c, [[sx + d, y + 32], [sx + d, y + 39]], T.ink, 0.6);
      sp(c, [[sx + d - 4, y + 39], [sx + d + 4, y + 39], [sx + d + 2.5, y + 42], [sx + d - 2.5, y + 42]], T.ochre, { noCouch: true, lw: 0.5 });
    }
    knot(c, sx, y + 29, 1.6, trim);
    pennant(c, x + w / 2, y + 6, trim);
  },
  monument(c, x, y, w, h, roof, trim) {
    // A great stepped tower on a plinth, gold-knotted, with a long banner in the side's colours.
    sr(c, x + 4, y + h - 14, w - 8, 10, T.buff, { ang: 0 });
    sr(c, x + 12, y + h - 26, w - 24, 12, T.buff, { ang: 0 });
    wall(c, x + 24, y + 12, x + w - 24, y + h - 26, 8);
    for (let k = 0; k < 3; k++) arch(c, x + 30 + k * 13, y + 40, 8, 18, k === 1 ? T.red : T.indigo);
    arch(c, x + w / 2 - 7, y + h - 46, 14, 20, T.ink);
    sr(c, x + 20, y + 4, w - 40, 10, T.sage, { ang: 0 });
    for (let k = 0; k < 5; k++) sr(c, x + 21 + k * 11.5, y - 2, 6, 6, T.sage, { noCouch: true, lw: 0.6 });
    dome(c, x + w / 2, y - 2, 13, T.ochre);
    for (const [dx, dy] of [[10, h - 9], [w - 10, h - 9], [18, h - 20], [w - 18, h - 20], [w / 2, h - 9]] as Pt[]) knot(c, x + dx, y + dy, 2, T.ochre);
    thread(c, [[x + w / 2, y - 16], [x + w / 2, y - 21]], T.ink, 1);
    sp(c, [[x + w / 2 + 1, y - 21], [x + w / 2 + 20, y - 19], [x + w / 2 + 14, y - 15], [x + w / 2 + 20, y - 11], [x + w / 2 + 1, y - 12]], roof, { ang: 0, noCouch: true, lw: 0.6 });
    thread(c, [[x + w / 2 + 2, y - 16.5], [x + w / 2 + 15, y - 15.5]], trim, 0.9);
  },
  harbour(c, x, y, w, h, roof, trim) {
    // A harbour: a stone quay along the front, a boathouse with its arch, a crane with a hanging
    // bale, and a ship moored alongside with its striped sail furled.
    sr(c, x + 2, y + h - 18, w - 4, 14, T.grey, { ang: 0 });
    for (let k = 1; k < 6; k++) thread(c, [[x + 2 + k * 15, y + h - 18], [x + 2 + k * 15, y + h - 4]], mix(T.grey, '#000000', 0.3), 0.6);
    wall(c, x + 8, y + 40, x + 54, y + h - 18, 2);
    arch(c, x + 20, y + 50, 22, h - 68, T.indigo);
    tiles(c, x + 4, y + 18, x + 58, y + 42, roof);
    pennant(c, x + 31, y + 16, trim);
    // The crane: a post, a jib and a bale on its rope.
    thread(c, [[x + w - 14, y + h - 18], [x + w - 14, y + 14]], T.bark, 2);
    thread(c, [[x + w - 16, y + 16], [x + w - 34, y + 30]], T.bark, 1.6);
    thread(c, [[x + w - 33, y + 30], [x + w - 33, y + 48]], T.ink, 0.6);
    se(c, x + w - 33, y + 52, 4.5, 4, T.tan, { noCouch: true, lw: 0.6 });
    // The moored ship's hull in front of the quay.
    sp(c, [[x + 6, y + h - 12], [x + w - 4, y + h - 12], [x + w - 10, y + h - 2], [x + 12, y + h - 2]], T.brown, { ang: 0, lw: 0.7 });
    thread(c, [[x + w - 4, y + h - 12], [x + w, y + h - 18], [x + w - 3, y + h - 20]], roof, 1.4);
    for (let k = 0; k < 4; k++) sp(c, [[x + 22 + k * 14, y + h - 13], [x + 28 + k * 14, y + h - 13], [x + 28 + k * 14, y + h - 9], [x + 25 + k * 14, y + h - 6], [x + 22 + k * 14, y + h - 9]], k % 2 ? trim : roof, { ang: PI / 2, noCouch: true, lw: 0.4 });
  },
  yurt(c, x, y, w, h, roof, trim) {
    // A felt tent of the steppe: a round wall of felt with lattice lines, a domed roof bound with
    // ropes in the side's colour, a painted door and a crown with smoke above it.
    sr(c, x + 6, y + 26, w - 12, h - 30, T.buff, { ang: 0 });
    c.save();
    c.strokeStyle = mix(T.buff, '#000000', 0.25);
    c.lineWidth = 0.6;
    for (let k = 0; k < 7; k++) {
      c.beginPath();
      c.moveTo(x + 8 + k * 8, y + 28);
      c.lineTo(x + 14 + k * 8, y + h - 6);
      c.moveTo(x + 14 + k * 8, y + 28);
      c.lineTo(x + 8 + k * 8, y + h - 6);
      c.stroke();
    }
    c.restore();
    sew(
      c,
      (cc) => {
        cc.beginPath();
        cc.moveTo(x + 2, y + 28);
        cc.quadraticCurveTo(x + w / 2, y - 6, x + w - 2, y + 28);
        cc.closePath();
      },
      T.buff,
      { bb: [x + 2, y + 4, x + w - 2, y + 28], ang: 0.3 },
    );
    for (const dx of [-16, 0, 16]) thread(c, [[x + w / 2 + dx * 0.4, y + 8], [x + w / 2 + dx, y + 28]], roof, 1.4);
    thread(c, [[x + 3, y + 27], [x + w - 3, y + 27]], roof, 1.6);
    sr(c, x + w / 2 - 7, y + 38, 14, h - 42, roof, { ang: PI / 2, noCouch: true });
    for (const dy of [44, 52]) thread(c, [[x + w / 2 - 5, y + dy], [x + w / 2 + 5, y + dy]], trim, 1);
    se(c, x + w / 2, y + 9, 5, 2.5, T.brown, { noCouch: true, lw: 0.6 });
    for (const [dx, dy, r] of [[2, -1, 2.4], [5, -6, 1.9]] as [number, number, number][]) se(c, x + w / 2 + dx, y + dy, r, r * 0.8, '#cfc6b0', { noCouch: true, lw: 0.4 });
  },
  wonder(c, x, y, w, h, roof, trim) {
    // A great cathedral of the Imperial age: three stepped plinths, an arcaded hall between two
    // towers, a high drum under a gold dome, and banners in the side's colours on every tower.
    sr(c, x + 2, y + h - 12, w - 4, 9, T.buff, { ang: 0 });
    sr(c, x + 8, y + h - 22, w - 16, 10, T.buff, { ang: 0 });
    wall(c, x + 14, y + 44, x + w - 14, y + h - 22, 6);
    for (let k = 0; k < 5; k++) arch(c, x + 22 + k * 18, y + 66, 10, 24, k === 2 ? T.red : k % 2 ? T.teal : T.indigo);
    arch(c, x + w / 2 - 9, y + h - 48, 18, 26, T.ink);
    tiles(c, x + 12, y + 30, x + w - 12, y + 46, roof);
    for (const tx of [x + 2, x + w - 22]) {
      sr(c, tx, y + 8, 20, h - 30, T.sage, { ang: 0 });
      for (let k = 0; k < 3; k++) arch(c, tx + 6, y + 24 + k * 26, 8, 14, T.ink);
      dome(c, tx + 10, y + 8, 10, T.ochre);
      pennant(c, tx + 10, y - 4, trim);
    }
    sr(c, x + w / 2 - 16, y + 4, 32, 28, T.tan, { ang: 0 });
    for (let k = 0; k < 3; k++) arch(c, x + w / 2 - 12 + k * 9, y + 12, 6, 14, T.indigo);
    dome(c, x + w / 2, y + 4, 17, T.ochre);
    for (const [dx, dy] of [[12, h - 7], [w - 12, h - 7], [w / 2, h - 7], [20, h - 17], [w - 20, h - 17]] as Pt[]) knot(c, x + dx, y + dy, 2.2, T.ochre);
    thread(c, [[x + w / 2, y - 14], [x + w / 2, y - 20]], T.ink, 1);
    sp(c, [[x + w / 2 + 1, y - 20], [x + w / 2 + 22, y - 18], [x + w / 2 + 16, y - 14], [x + w / 2 + 22, y - 10], [x + w / 2 + 1, y - 11]], roof, { ang: 0, noCouch: true, lw: 0.6 });
  },
};

/** A building for one side, with its footprint's top-left at (0, BUILDING_TOP). */
export function bakeBuilding(type: BuildingId, faction: FactionId) {
  const def = BUILDINGS[type];
  const w = def.w * TILE;
  const h = def.h * TILE;
  const { cv, c } = canvas(w + 4, h + BUILDING_TOP);
  reseed(type.length * 31 + faction.length);
  // A soft ground shadow so the building sits on the linen.
  c.fillStyle = 'rgba(110,90,60,0.14)';
  c.beginPath();
  c.ellipse(w / 2, BUILDING_TOP + h - 3, w / 2, 5, 0, 0, PI * 2);
  c.fill();
  PAINT[type](c, 0, BUILDING_TOP, w, h, WOOL[faction].cloth, WOOL[faction].trim);
  return cv;
}

// ---------------------------------------------------------------- nodes

/** A Bayeux tree: a trunk that splits and curls into leaf fans. Its tile's top-left is at (0, TREE_TOP). */
export function bakeTree(variant: number) {
  const { cv, c } = canvas(TILE, TILE + TREE_TOP);
  reseed(40 + variant);
  const cx = TILE / 2;
  const by = TREE_TOP + TILE - 3;
  sp(c, [[cx - 2.5, by], [cx + 2.5, by], [cx + 2, by - 14], [cx - 2, by - 14]], T.bark, { ang: PI / 2, noCouch: true });
  thread(c, [[cx, by - 13], [cx - 4, by - 17], [cx - 8, by - 20]], T.bark, 2.2);
  thread(c, [[cx, by - 13], [cx + 4, by - 17], [cx + 8, by - 20]], T.bark, 2.2);
  const a = variant % 2 ? T.sage : T.green;
  const b = variant % 2 ? T.green : T.sage;
  const leaves: [number, number, string, number][] = [[-8, -26, a, -0.3], [8, -26, b, 0.3], [0, -34, a, 0]];
  for (const [dx, dy, col, rot] of leaves) {
    se(c, cx + dx, by + dy, 6.5, 9, col, { rot, ang: PI / 2 + rot, sp: 1.1, noCouch: true });
    for (let k = -2; k <= 2; k++) thread(c, [[cx + dx, by + dy + 7], [cx + dx + k * 2.4 + rot * 4, by + dy - 6]], mix(col, '#ffffff', 0.3), 0.5);
  }
  return cv;
}

export function bakeBush() {
  const { cv, c } = canvas(TILE, TILE);
  reseed(77);
  const cx = 16;
  const cy = 19;
  se(c, cx, cy, 11, 8, T.sage, { ang: 0.6, noCouch: true });
  se(c, cx - 3, cy - 3, 6, 5, T.green, { ang: 0.6, noCouch: true, lw: 0.6 });
  for (let i = 0; i < 7; i++) knot(c, cx + Math.cos(i * 0.9) * 6.5, cy + Math.sin(i * 0.9) * 4.5, 1.6, T.red);
  return cv;
}

/** A gold mine: a grey mound with a dark adit and gold knots, 2x2 tiles. */
export function bakeMine() {
  const s = TILE * 2;
  const { cv, c } = canvas(s, s);
  reseed(91);
  sp(c, [[4, s - 6], [10, 24], [24, 10], [42, 12], [56, 26], [60, s - 6]], T.grey, { ang: 0.5 });
  sp(c, [[10, 24], [24, 10], [30, 22], [18, 30]], mix(T.grey, '#ffffff', 0.25), { ang: -0.6, noCouch: true, lw: 0.6 });
  sp(c, [[42, 12], [56, 26], [44, 30], [36, 20]], mix(T.grey, '#000000', 0.15), { ang: 0.9, noCouch: true, lw: 0.6 });
  sew(
    c,
    (cc) => {
      cc.beginPath();
      cc.moveTo(24, s - 6);
      cc.lineTo(24, 42);
      cc.arc(32, 42, 8, PI, 0);
      cc.lineTo(40, s - 6);
      cc.closePath();
    },
    T.ink,
    { bb: [24, 34, 40, s - 6], ang: PI / 2 },
  );
  thread(c, [[23, s - 6], [23, 41]], T.brown, 1.4);
  thread(c, [[41, s - 6], [41, 41]], T.brown, 1.4);
  thread(c, [[22, 40], [42, 40]], T.brown, 1.6);
  for (const [x, y] of [[14, 36], [18, 46], [48, 38], [50, 48], [34, 22], [28, 18], [46, 24]] as Pt[]) knot(c, x, y, 2, T.ochre);
  return cv;
}

/** A rally flag: a tall staff with a swallow-tailed pennant, its foot at (4, 38). */
export function bakeRallyFlag() {
  const { cv, c } = canvas(28, 40);
  reseed(5);
  c.fillStyle = 'rgba(110,90,60,0.18)';
  c.beginPath();
  c.ellipse(5, 38, 5, 1.8, 0, 0, PI * 2);
  c.fill();
  thread(c, [[4, 38], [4, 3]], T.ink, 1.4);
  knot(c, 4, 2.5, 1.6, T.ochre);
  sp(c, [[5, 4], [26, 7], [19, 11], [26, 15], [5, 17]], T.ochre, { ang: 0, noCouch: true, lw: 0.7 });
  thread(c, [[6, 10.5], [20, 11]], T.sage, 1.4);
  return cv;
}

// ---------------------------------------------------------------- neutral camps

/** Room above a camp's 2x2 footprint for its canopy and banner. */
export const CAMP_TOP = 26;

/** A cache: a laden cart under an awning, heaped with ore or with baskets of food. */
export function bakeCache(res: 'ore' | 'food' | 'wood') {
  const s = TILE * 2;
  const { cv, c } = canvas(s, s + CAMP_TOP);
  reseed(res.length * 19);
  const y = CAMP_TOP;
  c.fillStyle = 'rgba(110,90,60,0.14)';
  c.beginPath();
  c.ellipse(s / 2, y + s - 4, s / 2 - 2, 5, 0, 0, PI * 2);
  c.fill();
  // The awning on two poles.
  for (const px of [6, s - 8]) thread(c, [[px, y + s - 6], [px, y - 6]], T.brown, 1.6);
  sp(c, [[2, y - 2], [s - 2, y - 2], [s - 8, y - 16], [8, y - 16]], T.tan, { ang: 0 });
  for (let k = 0; k < 4; k++) thread(c, [[10 + k * 13, y - 15], [6 + k * 15, y - 3]], T.red, 0.9);
  // The cart.
  sp(c, [[8, y + 36], [s - 8, y + 36], [s - 12, y + 48], [12, y + 48]], '#a0703a', { ang: 0, lw: 0.8 });
  for (const wx of [18, s - 18]) {
    se(c, wx, y + 50, 7, 7, T.brown, { noCouch: true, lw: 0.7 });
    knot(c, wx, y + 50, 1.6, T.ink);
  }
  if (res === 'ore') {
    sp(c, [[12, y + 36], [20, y + 20], [32, y + 14], [44, y + 20], [52, y + 36]], T.grey, { ang: 0.5 });
    for (const [dx, dy] of [[22, 28], [30, 20], [38, 26], [28, 32], [44, 30], [34, 30]]) knot(c, dx, y + dy, 1.9, T.ochre);
  } else {
    for (const [bx, by] of [[18, 30], [32, 28], [46, 30], [25, 20], [39, 20]]) {
      se(c, bx, y + by, 6.5, 5.5, '#b08a56', { ang: 0, noCouch: true, lw: 0.6 });
      for (let k = 0; k < 3; k++) knot(c, bx - 3 + k * 3, y + by - 4, 1.4, T.red);
    }
  }
  return cv;
}

/**
 * A relic shrine: a gilded reliquary on a stepped plinth under a canopy, with its sign (a wheat sheaf,
 * a sword or a feather), and a banner in the holder's colour (plain linen while nobody holds it).
 */
export function bakeRelic(relic: 'plenty' | 'valor' | 'haste', holder: FactionId | null) {
  const s = TILE * 2;
  const { cv, c } = canvas(s, s + CAMP_TOP);
  reseed(relic.length * 23 + (holder?.length ?? 0));
  const y = CAMP_TOP;
  c.fillStyle = 'rgba(110,90,60,0.14)';
  c.beginPath();
  c.ellipse(s / 2, y + s - 4, s / 2 - 2, 5, 0, 0, PI * 2);
  c.fill();
  sr(c, 4, y + s - 14, s - 8, 10, T.buff, { ang: 0 });
  sr(c, 12, y + s - 22, s - 24, 8, T.buff, { ang: 0 });
  // The canopy on four posts.
  for (const px of [8, 20, s - 22, s - 10]) thread(c, [[px, y + s - 22], [px, y + 2]], T.brown, 1.4);
  sp(c, [[2, y + 4], [s - 2, y + 4], [s / 2, y - 18]], T.sage, { ang: 0 });
  knot(c, s / 2, y - 19, 2, T.ochre);
  // The reliquary: a little gabled house of gold.
  sp(c, [[20, y + s - 22], [s - 20, y + s - 22], [s - 20, y + 22], [s / 2, y + 12], [20, y + 22]], T.ochre, { ang: PI / 2, lw: 0.8 });
  for (const [dx, dy] of [[24, 26], [s - 24, 26], [24, s - 26], [s - 24, s - 26]]) knot(c, dx, y + dy, 1.4, T.red);
  const cx = s / 2;
  const cy = y + 32;
  if (relic === 'plenty')
    for (let k = -1; k <= 1; k++) {
      thread(c, [[cx + k * 2, cy + 8], [cx + k * 3, cy - 3]], T.brown, 0.9);
      se(c, cx + k * 3, cy - 5, 1.6, 3.4, T.brown, { noCouch: true, lw: 0.4 });
    }
  if (relic === 'valor') {
    thread(c, [[cx, cy + 8], [cx, cy - 7]], T.ink, 1.6);
    thread(c, [[cx - 4, cy + 4], [cx + 4, cy + 4]], T.ink, 1.4);
  }
  if (relic === 'haste') {
    se(c, cx, cy, 2.6, 7.5, T.indigo, { rot: 0.5, noCouch: true, lw: 0.5 });
    thread(c, [[cx - 4, cy + 7], [cx + 3, cy - 6]], T.ink, 0.7);
  }
  // The holder's banner on a staff at the side.
  const col = holder ? WOOL[holder].cloth : T.card;
  thread(c, [[s - 6, y + s - 6], [s - 6, y - 22]], T.ink, 1);
  sp(c, [[s - 5, y - 22], [s + 0, y - 21], [s + 0, y - 6], [s - 5, y - 9]], col, { ang: PI / 2, noCouch: true, lw: 0.6 });
  return cv;
}

/**
 * A trading post: a neutral timber hall with an open front, a hanging sign of scales and a cart
 * drawn up beside it, where trade carts load ore. Its 2x2 footprint's top-left is at (0, BUILDING_TOP).
 */
export function bakePost() {
  const s = TILE * 2;
  const { cv, c } = canvas(s + 4, s + BUILDING_TOP);
  reseed(71);
  const y = BUILDING_TOP;
  c.fillStyle = 'rgba(110,90,60,0.14)';
  c.beginPath();
  c.ellipse(s / 2, y + s - 3, s / 2, 5, 0, 0, PI * 2);
  c.fill();
  wall(c, 6, y + 22, s - 6, y + s - 3, 3);
  arch(c, s / 2 - 9, y + 36, 18, 25, T.ink);
  tiles(c, 2, y - 2, s - 2, y + 24, T.bark, 3.5);
  // A sign of scales hung on a bracket.
  thread(c, [[s - 8, y + 26], [s + 1, y + 26]], T.ink, 1);
  thread(c, [[s - 2, y + 26], [s - 2, y + 32]], T.ink, 0.8);
  thread(c, [[s - 8, y + 32], [s + 4, y + 32]], T.ochre, 1.2);
  for (const d of [-6, 6]) {
    thread(c, [[s - 2 + d, y + 32], [s - 2 + d, y + 36]], T.ochre, 0.6);
    sp(c, [[s - 5 + d, y + 36], [s + 1 + d, y + 36], [s + d - 0.5, y + 38.5], [s - 3.5 + d, y + 38.5]], T.ochre, { noCouch: true, lw: 0.5 });
  }
  // Sacks of ore stacked by the door, gold-knotted.
  for (const [bx, by] of [[12, s - 10], [20, s - 9], [16, s - 17]] as Pt[]) {
    se(c, bx, y + by, 4.5, 4, T.grey, { noCouch: true, lw: 0.6 });
    knot(c, bx, y + by - 1, 1, T.ochre);
  }
  pennant(c, s / 2, y - 4, T.ochre);
  return cv;
}

// ---------------------------------------------------------------- ground

/** Tiles per side of a ground chunk; chunks are painted when they first come into view. */
export const CHUNK = 16;
let linenTile: HTMLCanvasElement | null = null;

function linenPattern() {
  if (!linenTile) {
    const { cv, c } = canvas(256, 256);
    linen(c, 0, 0, 256, 256, T.linen, 4);
    linenTile = cv;
  }
  return linenTile;
}

/** Paints one CHUNK x CHUNK chunk of the map at full size: linen, lakes, ridges, dirt and grass. */
export function paintChunk(terrain: Uint8Array, cx: number, cy: number) {
  const px = CHUNK * TILE;
  const { cv, c } = canvas(px, px);
  const pat = linenPattern();
  for (let y = 0; y < px; y += 256) for (let x = 0; x < px; x += 256) c.drawImage(pat, x, y);
  c.fillStyle = 'rgba(150,160,90,0.12)';
  c.fillRect(0, 0, px, px);
  reseed(1000 + cy * 64 + cx);
  const at = (tx: number, ty: number) =>
    tx < 0 || ty < 0 || tx >= MAP_SIZE || ty >= MAP_SIZE ? -1 : terrain[ty * MAP_SIZE + tx];
  const tx0 = cx * CHUNK;
  const ty0 = cy * CHUNK;
  // Dirt and grass first, so lakes and ridges sit over the tufts at their edges.
  for (let j = 0; j < CHUNK; j++)
    for (let i = 0; i < CHUNK; i++) {
      const k = at(tx0 + i, ty0 + j);
      const x = i * TILE;
      const y = j * TILE;
      if (k === DIRT) {
        const pts: Pt[] = [];
        for (let a = 0; a < 6; a++) pts.push([x + 16 + Math.cos(a * 1.05) * rr(9, 14), y + 16 + Math.sin(a * 1.05) * rr(7, 11)]);
        sp(c, pts, T.tan, { ang: 0.4, lw: 0.6 });
        continue;
      }
      if (k !== 0) continue;
      const tufts = rnd() < 0.45 ? (rnd() < 0.3 ? 2 : 1) : 0;
      for (let n = 0; n < tufts; n++) {
        const gx = x + rr(4, 28);
        const gy = y + rr(8, 30);
        c.strokeStyle = rnd() < 0.5 ? T.sage : T.green;
        c.lineWidth = 0.9;
        c.lineCap = 'round';
        for (const a of [-0.5, 0, 0.5]) {
          c.beginPath();
          c.moveTo(gx, gy);
          c.quadraticCurveTo(gx + a * 3, gy - 3, gx + a * 5, gy - 5.5);
          c.stroke();
        }
      }
      if (rnd() < 0.04) knot(c, x + rr(6, 26), y + rr(6, 26), 1.2, rnd() < 0.5 ? T.ochre : T.teal);
    }
  for (let j = 0; j < CHUNK; j++)
    for (let i = 0; i < CHUNK; i++) {
      const tx = tx0 + i;
      const ty = ty0 + j;
      const k = at(tx, ty);
      const x = i * TILE;
      const y = j * TILE;
      if (k === SHALLOW) {
        // A ford: pale shallows over sand, with a few ripples, wadeable and sailable.
        sr(c, x - 0.5, y - 0.5, TILE + 1, TILE + 1, mix(T.teal, T.buff, 0.35), { line: false, ang: 0, noCouch: true });
        c.strokeStyle = mix(T.teal, '#ffffff', 0.35);
        c.lineWidth = 0.8;
        for (let b = 0; b < 2; b++) {
          c.beginPath();
          for (let xx = 4; xx <= TILE - 4; xx += 2) c.lineTo(x + xx, y + 10 + b * 12 + Math.sin((tx * TILE + xx) / 3 + b) * 1);
          c.stroke();
        }
        if (rnd() < 0.3) knot(c, x + rr(6, 26), y + rr(6, 26), 1, T.tan);
      } else if (k === WATER) {
        // The Bayeux sea: a laid field of blue with wavy teal bands, stitched shut where it meets land.
        sr(c, x - 0.5, y - 0.5, TILE + 1, TILE + 1, T.indigo, { line: false, ang: 0, noCouch: true });
        c.strokeStyle = T.teal;
        c.lineWidth = 1;
        for (let b = 0; b < 4; b++) {
          c.beginPath();
          for (let xx = 0; xx <= TILE; xx += 2) c.lineTo(x + xx, y + 5 + b * 8 + Math.sin((tx * TILE + xx) / 4 + b + ty) * 1.5);
          c.stroke();
        }
        const edge = (nx: number, ny: number, a: Pt, b: Pt) => {
          const n = at(nx, ny);
          if (n !== WATER && n !== SHALLOW && n !== -1) thread(c, [a, b], T.ink, 1.1);
        };
        edge(tx, ty - 1, [x, y + 0.6], [x + TILE, y + 0.6]);
        edge(tx, ty + 1, [x, y + TILE - 0.6], [x + TILE, y + TILE - 0.6]);
        edge(tx - 1, ty, [x + 0.6, y], [x + 0.6, y + TILE]);
        edge(tx + 1, ty, [x + TILE - 0.6, y], [x + TILE - 0.6, y + TILE]);
      } else if (k === ROCK) {
        // A ridge: stitched hills in grey and sage, two to a tile.
        for (const [hx, w2, col] of [[x + 9, 11, T.grey], [x + 23, 12, mix(T.grey, T.sage, 0.4)]] as [number, number, string][]) {
          const base = y + TILE - 2;
          const top = y + rr(4, 9);
          sew(
            c,
            (cc) => {
              cc.beginPath();
              cc.moveTo(hx - w2, base);
              cc.quadraticCurveTo(hx - w2 * 0.6, top - 2, hx, top);
              cc.quadraticCurveTo(hx + w2 * 0.6, top - 2, hx + w2, base);
              cc.closePath();
            },
            col,
            { bb: [hx - w2, top, hx + w2, base], ang: -0.9, sp: 1.2 },
          );
          thread(c, [[hx - 3, top + 6], [hx, top + 3], [hx + 3, top + 6]], mix(col, '#ffffff', 0.35), 0.6);
        }
      }
    }
  return cv;
}

/** Unworked linen for the fog: a darker, mottled linen. */
export function bakeFogPattern(size: number) {
  const { cv, c } = canvas(size, size);
  linen(c, 0, 0, size, size, T.fog, 9);
  c.fillStyle = 'rgba(80,66,44,0.16)';
  c.fillRect(0, 0, size, size);
  reseed(13);
  for (let i = 0; i < 40; i++) {
    const x = rr(0, size);
    const y = rr(0, size);
    const r = rr(10, 40);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(80,66,44,0.16)');
    g.addColorStop(1, 'rgba(80,66,44,0)');
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  return cv;
}

/** The needle at the edge of the known land, with its red working thread. The eye end is at (8, 36). */
export function bakeNeedle() {
  const { cv, c } = canvas(56, 56);
  c.save();
  c.translate(28, 24);
  c.rotate(-0.9);
  c.fillStyle = '#b8bcc4';
  c.beginPath();
  c.moveTo(-22, 0);
  c.lineTo(16, -1.2);
  c.lineTo(19, 0);
  c.lineTo(16, 1.2);
  c.closePath();
  c.fill();
  c.strokeStyle = '#6a6e78';
  c.lineWidth = 0.5;
  c.stroke();
  c.fillStyle = T.linen;
  c.beginPath();
  c.ellipse(-17, 0, 2.6, 0.6, 0, 0, PI * 2);
  c.fill();
  c.restore();
  c.strokeStyle = T.red;
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(16, 38);
  c.bezierCurveTo(8, 44, 18, 48, 10, 55);
  c.stroke();
  return cv;
}
