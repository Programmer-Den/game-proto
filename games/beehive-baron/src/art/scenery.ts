import Phaser from 'phaser';
import { CELL_CAP, FLOWERS } from '../game/state';
import { MEADOWS } from '../game/meadows';
import { viewEdges, AWAY, BOARD, BOOK, BOOK_CARD, CASK, COMB, CONTRACT, END_CARD, FAR_RIDGE, FLOWER_GROUND, GOAL, HIVE, HIVE_TAB, MARKET, MEADOW_SPOTS, ORDER, PLAQUE, MEADOW_TAG, SWARM, farY, flowerSpot } from '../scenes/layout';
import { KINDS } from '../game/honey';
import { BROOD_CARD, CARD, KIND_CARD, MEADOW_CARD, MEAD_CARD, NOTE_CARD, ORCHARD_CARD, PETALS, WAX_CARD } from './palette';

/** The rosette's deeper gold on the end card. */
const LIVE_GOLD = '#e8a31c';
import { addTexture, circ, cut, hex, outline, rect, reseed, resOfCtx, rr, sketch, smooth, type Pt } from './paper';

// The meadow and the hive in cut paper: a sky sheet with a paper sun and clouds, layered hills with
// the goal meadows on the far one, the hive box, petal-cut flowers, the honey jar, the comb cells
// in each of their states and the UI cards. Everything is baked once at boot.

const NEAR_RIDGE = smooth([[-10, 260], [100, 250], [210, 260], [350, 240], [450, 235], [550, 250], [650, 235], [750, 245], [850, 235], [970, 250]]);
const GROUND_RIDGE = smooth([[-10, 390], [200, 370], [450, 395], [700, 380], [970, 390]]);

/**
 * A hill from its ridge down past the view's bottom: the ridge runs on level beyond its ends when
 * the view is wider than the 960x540 layout.
 */
function widen(ridge: Pt[], v: { x: number; right: number; bottom: number }): Pt[] {
  const first = ridge[0];
  const last = ridge[ridge.length - 1];
  const left = Math.min(first[0], v.x - 10);
  const right = Math.max(last[0], v.right + 10);
  const bottom = Math.max(560, v.bottom + 20);
  // Points are only added where the view needs them, so the 960x540 hills cut exactly as before.
  const before: Pt[] = left < first[0] ? [[left, first[1]]] : [];
  const after: Pt[] = right > last[0] ? [[right, last[1]]] : [];
  return [...before, ...ridge, ...after, [right, bottom], [left, bottom]];
}

export function bakeScenery(scene: Phaser.Scene) {
  reseed(29);
  bakeBackBackground(scene);
  MEADOWS.forEach((_, i) => bakeMeadow(scene, i));
  bakeFrontBackground(scene);
  bakeHive(scene);
  for (let i = 0; i < FLOWERS; i++) bakeFlower(scene, i);
  bakeJar(scene);
  bakeCells(scene);
  bakeCards(scene);
}

/** Sky, sun, clouds and the far hill. */
function bakeBackBackground(scene: Phaser.Scene) {
  const v = viewEdges(scene);
  const { canvas, ctx } = sketch(v.w, v.h);
  ctx.translate(-v.x, -v.y);
  cut(ctx, rect(v.x, v.y, v.w, v.h), CARD.sky, { depth: 0, wob: 0, grain: 0.3 });
  cut(ctx, circ(480, 85, 24), CARD.sun, { depth: 2 });
  for (const [cx, cy, s] of [[515, 170, 18], [548, 118, 13]]) {
    const pts: Pt[] = [];
    for (let i = 0; i <= 40; i++) {
      const t = (i / 40) * Math.PI;
      const bump = 1 + 0.25 * Math.abs(Math.sin(t * 4));
      pts.push([cx - Math.cos(t) * s * 1.7, cy - Math.sin(t) * s * 0.9 * bump]);
    }
    pts.push([cx + s * 1.7, cy + 5], [cx - s * 1.7, cy + 5]);
    cut(ctx, pts, CARD.cloud, { depth: 2.5, shadow: 0.2 });
  }
  cut(ctx, widen(FAR_RIDGE, v), CARD.farHill, { depth: 4, shadow: 0.3, wob: 1.2 });
  addTexture(scene, 'bg-back', canvas);
}

/**
 * One goal meadow, as two textures placed at the same spot: `meadow-<i>`, rows of coloured card
 * along the far ridge (shown faded while locked), and `meadow-<i>-blooms`, the little flowers cut
 * on them once it is unlocked.
 */
function bakeMeadow(scene: Phaser.Scene, i: number) {
  const spot = MEADOW_SPOTS[i];
  const colours = MEADOW_CARD[i];
  const left = spot.x0 - 8;
  const top = Math.min(farY(spot.x0), farY(spot.x1)) - 8;
  const w = spot.x1 - spot.x0 + 16;
  const h = 120;
  const along = (x0: number, x1: number, dy: number) => {
    const pts: Pt[] = [];
    for (let x = x0; x <= x1; x += 6) pts.push([x, farY(x) + dy]);
    return pts;
  };
  const strip = sketch(w, h);
  strip.ctx.translate(-left, -top);
  for (let r = 0; r < 5; r++) {
    const ridge = along(spot.x0, spot.x1, 3 + r * 10);
    const base = along(spot.x0, spot.x1, 3 + r * 10 + 22).reverse();
    cut(strip.ctx, [...ridge, ...base], colours.rows[r % 2], { depth: 1.5, shadow: 0.25 });
  }
  addTexture(scene, `meadow-${i}`, strip.canvas);

  const blooms = sketch(w, h);
  blooms.ctx.translate(-left, -top);
  for (let r = 0; r < 4; r++) {
    for (let x = spot.x0 + 8 + (r % 2) * 7; x < spot.x1 - 6; x += 14) {
      const y = farY(x) + 9 + r * 10;
      if (i === 0) {
        // Lavender: little spikes of purple buds.
        for (let k = 0; k < 3; k++) cut(blooms.ctx, circ(x + (k % 2 ? 1.2 : -1.2), y - k * 3, 1.8, 1.5, 10), colours.bloom[k % 2], { depth: 0.8, wob: 0 });
      } else if (i === 1) {
        // Sunflowers: a ring of gold with a brown middle.
        cut(blooms.ctx, circ(x, y - 2, 3.6, 3.6, 12), colours.bloom[0], { depth: 1, wob: 0 });
        cut(blooms.ctx, circ(x, y - 2, 1.5, 1.5, 8), colours.bloom[1], { depth: 0, wob: 0 });
      } else {
        // Heather: tufts of small mauve and pink bells.
        for (let k = 0; k < 3; k++) cut(blooms.ctx, circ(x - 2 + k * 2, y - 1 - (k === 1 ? 2 : 0), 1.7, 1.7, 8), colours.bloom[k % 2], { depth: 0.8, wob: 0 });
      }
    }
  }
  addTexture(scene, `meadow-${i}-blooms`, blooms.canvas);
}
export const meadowOrigin = (i: number) => {
  const spot = MEADOW_SPOTS[i];
  return { x: spot.x0 - 8, y: Math.min(farY(spot.x0), farY(spot.x1)) - 8 };
};

/** The near hills, the button board and the jar shelf, over the meadows. */
function bakeFrontBackground(scene: Phaser.Scene) {
  const v = viewEdges(scene);
  const { canvas, ctx } = sketch(v.w, v.h);
  ctx.translate(-v.x, -v.y);
  cut(ctx, widen(NEAR_RIDGE, v), CARD.nearHill, { depth: 5, shadow: 0.3, wob: 1.2 });
  cut(ctx, widen(GROUND_RIDGE, v), CARD.grass, { depth: 5, shadow: 0.3, wob: 1.2 });
  // The kraft board the buttons sit on.
  cut(ctx, rr(BOARD.x - 1, BOARD.y - 1, BOARD.w + 2, BOARD.h + 2, 10), CARD.board, { depth: 6 });
  cut(ctx, rr(BOARD.x + 5, BOARD.y + 5, BOARD.w - 10, BOARD.h - 10, 7), CARD.boardInner, { depth: 0 });
  // The jar shelf under the hive.
  cut(ctx, rect(56, 468, 359, 18), CARD.shelf, { depth: 4 });
  for (const lx of [80, 376]) cut(ctx, rect(lx, 486, 13, 17), CARD.shelfLeg, { depth: 3 });
  addTexture(scene, 'bg-front', canvas);
}

/** The hive box: roof, frame, the dark recess the comb sits in, the entrance and the landing board. */
function bakeHive(scene: Phaser.Scene) {
  const { canvas, ctx } = sketch(HIVE.w, HIVE.h);
  ctx.translate(-HIVE.x, -HIVE.y);
  cut(ctx, [[42, 93], [418, 93], [405, 54], [65, 54]], CARD.roof, { depth: 5 });
  cut(ctx, [[50, 59], [410, 59], [406, 54], [65, 54]], CARD.roofTrim, { depth: 0 });
  cut(ctx, rect(56, 93, 355, 267), CARD.box, { depth: 6 });
  for (let i = 0; i < 4; i++) cut(ctx, rect(59, 330 + i * 7, 349, 3), CARD.slat, { depth: 0, grain: 0.2 });
  cut(ctx, rect(70, 102, 327, 222), CARD.recess, { depth: 0, wob: 0.4 });
  // The frame stands above the recess: shade its inner edges.
  const edge = (x0: number, y0: number, x1: number, y1: number, x: number, y: number, w: number, h: number) => {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, 'rgba(30,15,0,0.55)');
    g.addColorStop(1, 'rgba(30,15,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, h);
  };
  edge(0, 102, 0, 116, 70, 102, 327, 14);
  edge(70, 0, 80, 0, 70, 102, 10, 222);
  edge(397, 0, 389, 0, 389, 102, 8, 222);
  edge(0, 324, 0, 318, 70, 318, 327, 6);
  cut(ctx, rr(186, 333, 94, 16, 7), CARD.slit, { depth: 0 });
  cut(ctx, [[95, 360], [372, 360], [385, 375], [84, 375]], CARD.landing, { depth: 4 });
  cut(ctx, rr(PLAQUE.x - PLAQUE.w / 2, PLAQUE.y - PLAQUE.h / 2, PLAQUE.w, PLAQUE.h, 5), CARD.plaque, { depth: 2 });
  addTexture(scene, 'hive', canvas);
}

/** The flowers' texture size and where the head's centre is in it. */
export const FLOWER_TEX = { w: 110, head: 50 };

/** A flower on a paper stem: six petals in a ring round a golden middle, so it never reads as a cross. */
function bakeFlower(scene: Phaser.Scene, i: number) {
  const f = flowerSpot(i);
  const len = FLOWER_GROUND - f.y;
  const { canvas, ctx } = sketch(FLOWER_TEX.w, FLOWER_TEX.head + len + 8);
  const x = FLOWER_TEX.w / 2;
  const y = FLOWER_TEX.head;
  const ground = y + len;
  cut(ctx, [[x - 2, y + 8], [x + 2, y + 8], [x + 2.5, ground], [x - 2.5, ground]], CARD.stem, { depth: 2 });
  for (const [ly, d] of [[y + len * 0.5, i % 2 ? 1 : -1], [y + len * 0.78, i % 2 ? -1 : 1]]) {
    const pts: Pt[] = [];
    for (let k = 0; k <= 12; k++) {
      const t = k / 12;
      pts.push([x + d * t * 25, ly - Math.sin(t * Math.PI) * 7 - t * 7]);
    }
    for (let k = 12; k >= 0; k--) {
      const t = k / 12;
      pts.push([x + d * t * 25, ly + Math.sin(t * Math.PI) * 5 - t * 7]);
    }
    cut(ctx, pts, CARD.leaf, { depth: 2 });
  }
  for (let n = 0; n < 6; n++) {
    const a = (n / 6) * Math.PI * 2 + i * 0.3;
    const px = x + Math.cos(a) * 12.5;
    const py = y + Math.sin(a) * 12.5;
    const petal = circ(0, 0, 10.5, 7, 18).map(([u, v]): Pt => [px + u * Math.cos(a) - v * Math.sin(a), py + u * Math.sin(a) + v * Math.cos(a)]);
    cut(ctx, petal, PETALS[i], { depth: 2, shadow: 0.3 });
  }
  cut(ctx, circ(x, y, 8, 8, 18), CARD.middle, { depth: 2 });
  cut(ctx, circ(x - 1.5, y - 1.5, 4, 4, 12), CARD.middleShine, { depth: 0 });
  addTexture(scene, `flower-${i}`, canvas);
}

/** The jar texture's size and the point of its foot, for placing it on the shelf. */
export const JAR_TEX = { w: 36, h: 44, footY: 39 };

/** A honey jar per kind of honey, `jar-<kind>`, coloured by its honey. */
function bakeJar(scene: Phaser.Scene) {
  for (const kind of KINDS) {
    const { canvas, ctx } = sketch(JAR_TEX.w, JAR_TEX.h);
    const honey = KIND_CARD[kind].jar;
    ctx.translate(16, 22);
    cut(ctx, rr(-13.5, -12, 27, 29, 6), honey, { depth: 3 });
    cut(ctx, rr(-11, -19, 22, 8, 2.5), CARD.lid, { depth: 1.5 });
    cut(ctx, rr(-8, -1, 16, 11, 2), CARD.label, { depth: 1 });
    cut(ctx, hex(0, 4.5, 3.6), honey, { depth: 0, wob: 0 });
    cut(ctx, rr(-11, -9, 3, 20, 1.5), 'rgba(255,240,200,0.7)', { depth: 0, wob: 0 });
    addTexture(scene, `jar-${kind}`, canvas);
  }
}

/** The cell textures' size; the hexagon's centre is in the middle. */
export const CELL_TEX = 84;

/**
 * The comb cells as stacked hexagons of card: `cell-empty` (a dashed outline for a spot not built
 * yet), per kind of honey `cell-fill-<0..4>-<kind>` (a dark well with that much nectar),
 * `cell-ripe-<kind>` and `cell-capped-<kind>`, then `cell-brood` (a domed brood cap with a curled
 * larva) and `cell-preview` (the green spot where a cell would go).
 */
function bakeCells(scene: Phaser.Scene) {
  const c = CELL_TEX / 2;
  const r = COMB.r;
  const make = (key: string, paint: (ctx: CanvasRenderingContext2D) => void) => {
    const { canvas, ctx } = sketch(CELL_TEX, CELL_TEX);
    paint(ctx);
    addTexture(scene, key, canvas);
  };
  make('cell-empty', (ctx) => outline(ctx, hex(c, c, r - 4), 'rgba(240,200,140,0.4)', 1.2, [3.5, 3.5]));
  const base = (ctx: CanvasRenderingContext2D) => cut(ctx, hex(c, c, r - 2.5), CARD.wax, { depth: 3 });
  for (const kind of KINDS) {
    const k = KIND_CARD[kind];
    for (let n = 0; n <= CELL_CAP; n++) {
      make(`cell-fill-${n}-${kind}`, (ctx) => {
        base(ctx);
        cut(ctx, hex(c, c, r - 7), CARD.well, { depth: 0 });
        if (n > 0) cut(ctx, hex(c, c, r - 10 - (CELL_CAP - n) * 4.5), k.nectar, { depth: 2 });
      });
    }
    make(`cell-ripe-${kind}`, (ctx) => {
      base(ctx);
      cut(ctx, hex(c, c, r - 6), k.ripe[0], { depth: 1.5 });
      cut(ctx, hex(c, c, r - 12), k.ripe[1], { depth: 1.5 });
    });
    make(`cell-capped-${kind}`, (ctx) => {
      base(ctx);
      cut(ctx, hex(c, c, r - 5.5), k.capped[0], { depth: 1.5 });
      cut(ctx, hex(c, c, r - 11), k.capped[1], { depth: 1.5 });
      cut(ctx, hex(c, c, r - 17), k.capped[2], { depth: 1 });
    });
  }
  make('cell-brood', (ctx) => {
    base(ctx);
    cut(ctx, hex(c, c, r - 6), BROOD_CARD.cap, { depth: 1.5 });
    cut(ctx, hex(c, c, r - 12), BROOD_CARD.dome, { depth: 2 });
    // A curled larva on the cap, like a C, with a round head.
    ctx.save();
    ctx.strokeStyle = BROOD_CARD.larva;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.shadowColor = 'rgba(42,26,8,0.35)';
    ctx.shadowBlur = 2 * resOfCtx(ctx);
    ctx.shadowOffsetY = resOfCtx(ctx);
    ctx.beginPath();
    ctx.arc(c, c, 7, Math.PI * 0.35, Math.PI * 1.75);
    ctx.stroke();
    ctx.restore();
    cut(ctx, circ(c + 5.5, c - 4.5, 3.4), BROOD_CARD.larva, { depth: 1, wob: 0 });
  });
  make('cell-preview', (ctx) => {
    ctx.globalAlpha = 0.85;
    cut(ctx, hex(c, c, r - 2.5), CARD.preview, { depth: 2 });
    ctx.globalAlpha = 1;
    outline(ctx, hex(c, c, r - 2.5), CARD.previewLine, 2, [6, 4]);
  });
}

/** The UI cards: the HUD strip and its icons, the goal card, the away chip, tags and a lock. */
function bakeCards(scene: Phaser.Scene) {
  const PAD = 8;
  const card = (key: string, w: number, h: number, paint: (ctx: CanvasRenderingContext2D) => void) => {
    const { canvas, ctx } = sketch(w + PAD * 2, h + PAD * 2);
    ctx.translate(PAD, PAD);
    paint(ctx);
    addTexture(scene, key, canvas);
  };

  // The HUD: a dark brown strip with a scalloped lower edge.
  // As wide as the view, which can be wider than the layout when the game fills a wide screen.
  const hudW = viewEdges(scene).w;
  card('hud', hudW, 44, (ctx) => {
    const pts: Pt[] = [[-PAD, -PAD], [hudW + PAD, -PAD]];
    for (let x = hudW + 10; x >= -10; x -= 20) {
      for (let k = 0; k <= 4; k++) {
        const t = (k / 4) * Math.PI;
        pts.push([x - 10 + Math.cos(t) * 10, 36 + Math.sin(t) * 4.5]);
      }
    }
    cut(ctx, pts, CARD.hud, { depth: 4, wob: 0.4 });
  });
  card('coin', 18, 18, (ctx) => {
    cut(ctx, circ(9, 9, 8), '#f5c33a', { depth: 1.5 });
    cut(ctx, circ(9, 9, 4.5), '#ffd862', { depth: 0.5 });
  });
  // A little jar per kind of honey (`honey-icon-<kind>`) and a cake of wax.
  for (const kind of KINDS) {
    card(`honey-icon-${kind}`, 16, 18, (ctx) => {
      cut(ctx, rr(1, 4, 13, 13, 3), KIND_CARD[kind].jar, { depth: 1.5 });
      cut(ctx, rr(0, 0, 15, 4.5, 1.5), CARD.lid, { depth: 1 });
    });
  }
  card('wax-icon', 18, 18, (ctx) => {
    cut(ctx, hex(9, 9, 8.5), WAX_CARD.cake, { depth: 1.5 });
    cut(ctx, hex(9, 9, 4.5), WAX_CARD.shine, { depth: 0.5 });
  });

  card('goal-card', GOAL.w, GOAL.h, (ctx) => cut(ctx, rr(0, 0, GOAL.w, GOAL.h, 9), CARD.goal, { depth: 4.5 }));
  // The goal card's icon for each meadow: a lavender sprig, a sunflower and a sprig of heather.
  MEADOWS.forEach((_, i) => card(`meadow-icon-${i}`, 20, 34, (ctx) => {
    cut(ctx, rect(9, 10, 2, 22), CARD.stem, { depth: 1, wob: 0 });
    const [a, b] = MEADOW_CARD[i].bloom;
    if (i === 0) {
      for (let n = 0; n < 6; n++) cut(ctx, circ(10 + (n % 2 ? 3 : -3), 22 - n * 3.5, 3, 2.5, 12), n % 2 ? MEADOW_CARD[0].rows[1] : a, { depth: 1 });
    } else if (i === 1) {
      for (let n = 0; n < 8; n++) {
        const t = (n / 8) * Math.PI * 2;
        cut(ctx, circ(10 + Math.cos(t) * 5, 9 + Math.sin(t) * 5, 3.2, 3.2, 10), a, { depth: 1 });
      }
      cut(ctx, circ(10, 9, 3.5, 3.5, 12), b, { depth: 0.5 });
    } else {
      for (let n = 0; n < 7; n++) cut(ctx, circ(10 + ((n % 3) - 1) * 3.5, 22 - n * 2.8, 2.2, 2.2, 10), n % 2 ? b : a, { depth: 1 });
    }
  }));

  // A grey paper padlock.
  card('lock', 16, 20, (ctx) => {
    ctx.save();
    ctx.strokeStyle = '#7a7f8e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(8, 8, 5, Math.PI, 0);
    ctx.lineTo(13, 10);
    ctx.moveTo(3, 8);
    ctx.lineTo(3, 10);
    ctx.stroke();
    ctx.restore();
    cut(ctx, rr(0.5, 8.5, 15, 11, 2), '#c3c7d2', { depth: 1.5 });
    cut(ctx, circ(8, 13.5, 1.6, 1.6, 8), '#4a4e5a', { depth: 0, wob: 0 });
  });

  card('meadow-tag', MEADOW_TAG.w, MEADOW_TAG.h, (ctx) => cut(ctx, rr(0, 0, MEADOW_TAG.w, MEADOW_TAG.h, 6), CARD.tag, { depth: 3 }));
  card('away-chip', AWAY.w, AWAY.h, (ctx) => {
    cut(ctx, rr(0, 0, AWAY.w, AWAY.h, 8), CARD.away, { depth: 4 });
    // A paper crescent moon.
    const [mx, my] = [21, 19];
    cut(ctx, circ(mx, my, 9.5), '#ffd86a', { depth: 1.5 });
    ctx.save();
    ctx.beginPath();
    ctx.arc(mx + 5, my - 3.5, 8, 0, Math.PI * 2);
    ctx.fillStyle = CARD.away;
    ctx.fill();
    ctx.restore();
  });
  // The market board under the hive, a cream card like the goal card.
  card('market-card', MARKET.w, MARKET.h, (ctx) => cut(ctx, rr(0, 0, MARKET.w, MARKET.h, 8), CARD.goal, { depth: 4 }));
  // The village order and the orchard contract: notes pinned to the button board, with a stitched edge and a pin.
  card('order-card', ORDER.w, ORDER.h, (ctx) => {
    cut(ctx, rr(0, 0, ORDER.w, ORDER.h, 4), NOTE_CARD.paper, { depth: 3 });
    outline(ctx, rr(3.5, 3.5, ORDER.w - 7, ORDER.h - 7, 3), NOTE_CARD.edge, 1, [3, 3]);
    cut(ctx, circ(ORDER.w / 2, 4, 3.6), NOTE_CARD.pin, { depth: 1.5, wob: 0 });
  });
  card('contract-card', CONTRACT.w, CONTRACT.h, (ctx) => {
    cut(ctx, rr(0, 0, CONTRACT.w, CONTRACT.h, 4), ORCHARD_CARD.paper, { depth: 3 });
    outline(ctx, rr(3.5, 3.5, CONTRACT.w - 7, CONTRACT.h - 7, 3), ORCHARD_CARD.edge, 1, [3, 3]);
    cut(ctx, circ(CONTRACT.w / 2, 4, 3.6), ORCHARD_CARD.pin, { depth: 1.5, wob: 0 });
  });
  // A mead cask: a barrel with two hoops, standing on the shelf.
  card('cask', CASK.w, CASK.h, (ctx) => {
    cut(ctx, rr(0, 0, CASK.w, CASK.h, 7), MEAD_CARD.stave, { depth: 2.5 });
    for (const y of [6, CASK.h - 9]) cut(ctx, rect(1, y, CASK.w - 2, 3), MEAD_CARD.hoop, { depth: 0.5, wob: 0 });
    cut(ctx, circ(CASK.w / 2, CASK.h / 2, 3, 3, 10), MEAD_CARD.bung, { depth: 0.5, wob: 0 });
  });
  // The tabs on the hive roof that switch combs: cream when shown, flat brown otherwise.
  card('hive-tab-on', HIVE_TAB.w, HIVE_TAB.h, (ctx) => cut(ctx, rr(0, 0, HIVE_TAB.w, HIVE_TAB.h, 5), CARD.plaque, { depth: 2 }));
  card('hive-tab-off', HIVE_TAB.w, HIVE_TAB.h, (ctx) => cut(ctx, rr(0, 0, HIVE_TAB.w, HIVE_TAB.h, 5), CARD.roofTrim, { depth: 0.5, shadow: 0.2 }));
  // The swarm chip over the meadow, just above the button board, a warm card to tap while the swarm gathers.
  card('swarm-chip', SWARM.w, SWARM.h, (ctx) => cut(ctx, rr(0, 0, SWARM.w, SWARM.h, 8), CARD.roof, { depth: 4 }));
  // The end card, a big cream card with a gold rosette, when the fair makes the player the Baron.
  const bigCard = (ctx: CanvasRenderingContext2D, w = END_CARD.w, h = END_CARD.h) => {
    cut(ctx, rr(0, 0, w, h, 14), CARD.goal, { depth: 6 });
    outline(ctx, rr(8, 8, w - 16, h - 16, 10), NOTE_CARD.edge, 1.5, [5, 4]);
  };
  // The buyer's book: a cream chip with a stitched edge, and the big card that lists the asks.
  card('book-chip', BOOK.w, BOOK.h, (ctx) => {
    cut(ctx, rr(0, 0, BOOK.w, BOOK.h, 8), CARD.goal, { depth: 4 });
    outline(ctx, rr(4, 4, BOOK.w - 8, BOOK.h - 8, 6), NOTE_CARD.edge, 1, [4, 3]);
  });
  card('book-card', BOOK_CARD.w, BOOK_CARD.h, (ctx) => bigCard(ctx, BOOK_CARD.w, BOOK_CARD.h));
  // The queen card is the end card without the gold rosette.
  card('queen-card', END_CARD.w, END_CARD.h, bigCard);
  card('end-card', END_CARD.w, END_CARD.h, (ctx) => {
    bigCard(ctx);
    const [rx, ry] = [END_CARD.w / 2, 46];
    for (let n = 0; n < 12; n++) {
      const t = (n / 12) * Math.PI * 2;
      cut(ctx, circ(rx + Math.cos(t) * 15, ry + Math.sin(t) * 15, 6, 6, 10), n % 2 ? CARD.sun : LIVE_GOLD, { depth: 1 });
    }
    cut(ctx, circ(rx, ry, 13), CARD.sun, { depth: 1 });
    cut(ctx, circ(rx, ry, 7), '#fff0b0', { depth: 0.5 });
  });
  // Green tags: the build preview's callout and the "+N touching" pop.
  card('tag-build', 104, 32, (ctx) => cut(ctx, rr(0, 0, 104, 32, 7), CARD.green, { depth: 3 }));
  card('tag-touching', 80, 20, (ctx) => cut(ctx, rr(0, 0, 80, 20, 9), CARD.green, { depth: 2.5 }));
}

/** The padding the card textures above have round their card, so a sprite can be placed by its card's corner. */
export const CARD_PAD = 8;
