import Phaser from 'phaser';
import { HANDS, type Hand } from '../game/hands';
import { KINDS, type IsleKind } from '../game/kinds';
import type { Terrain } from '../game/terrain';
import type { UpgradeId } from '../game/upgrades';
import { WONDER_IDS, type WonderKind } from '../game/wonders';
import { TERRAINS, tintOf } from './map';
import { BLUE, BROWN, GOLD, GOLD_DARK, INK, MAGENTA, RULE, SHEET, TRACK, TREE, bake, circle, poly, rrect, star, theme, type Ctx } from './paint';

/** A small sloop: a brown hull, a mast and a magenta sail, on a blue wave. */
function sloop(ctx: Ctx) {
  ctx.beginPath();
  ctx.moveTo(3, 15);
  ctx.lineTo(21, 15);
  ctx.quadraticCurveTo(18.5, 20, 12, 20);
  ctx.quadraticCurveTo(5.5, 20, 3, 15);
  ctx.fillStyle = BROWN;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(11, 15);
  ctx.lineTo(11, 2.5);
  ctx.stroke();
  poly(ctx, [[12, 3], [19.5, 13], [12, 13]], MAGENTA, INK, 1);
  poly(ctx, [[10, 5], [10, 13], [4.5, 13]], SHEET, INK, 1);
  ctx.strokeStyle = BLUE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(2, 22);
  ctx.quadraticCurveTo(7, 19.5, 12, 22);
  ctx.quadraticCurveTo(17, 24.5, 22, 22);
  ctx.stroke();
}

/** Upgrade icons: clean line symbols in ink with a magenta mark, 24 px, baked as `icon-<id>`. */
const UPGRADE_ICONS: Record<UpgradeId, (ctx: Ctx) => void> = {
  // A provisions crate.
  provisions: (ctx) => {
    ctx.fillStyle = '#efe3c4';
    ctx.fillRect(4, 7, 16, 13);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(4, 7, 16, 13);
    ctx.beginPath();
    ctx.moveTo(4, 7);
    ctx.lineTo(20, 20);
    ctx.moveTo(4, 12);
    ctx.lineTo(20, 12);
    ctx.stroke();
    ctx.fillStyle = MAGENTA;
    ctx.fillRect(9, 3, 6, 4);
  },
  // A spyglass, drawn out.
  spyglass: (ctx) => {
    ctx.save();
    ctx.translate(12, 12);
    ctx.rotate(-0.6);
    ctx.fillStyle = INK;
    ctx.fillRect(-10, -2, 8, 4);
    ctx.fillStyle = '#5b6670';
    ctx.fillRect(-3, -3, 7, 6);
    ctx.fillStyle = INK;
    ctx.fillRect(4, -4, 6, 8);
    ctx.fillStyle = MAGENTA;
    ctx.fillRect(9, -3, 2, 6);
    ctx.restore();
  },
  // An ink bottle and a drafting pen.
  ink: (ctx) => {
    rrect(ctx, 5, 10, 11, 10, 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.fillStyle = '#5b6670';
    ctx.fillRect(8, 7, 5, 3);
    ctx.strokeStyle = MAGENTA;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(12, 14);
    ctx.lineTo(20, 4);
    ctx.stroke();
  },
  // A lodestone compass: a gold rose in a ring.
  compass: (ctx) => {
    circle(ctx, 12, 12, 9, SHEET, INK, 1.5);
    star(ctx, 12, 12, 7.5, 2, 4, GOLD, GOLD_DARK, 0.8);
    circle(ctx, 12, 12, 1.2, INK);
  },
  // The coastal sloop.
  sloop,
};

/** The hands' icons, 24 px, baked as `hand-<id>`: a tool each, in ink with a magenta mark. */
const HAND_ICONS: Record<Hand, (ctx: Ctx) => void> = {
  // A woodsman's axe.
  woodsman: (ctx) => {
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(6, 21);
    ctx.lineTo(17, 7);
    ctx.stroke();
    poly(ctx, [[13, 3], [21, 6], [20, 13], [14, 10]], '#9aa3ab', INK, 1.2);
    ctx.fillStyle = MAGENTA;
    ctx.fillRect(5, 19, 4, 3);
  },
  // A climber's coil of rope and piton.
  climber: (ctx) => {
    circle(ctx, 11, 13, 7, null, BROWN, 2.5);
    circle(ctx, 11, 13, 3.5, null, BROWN, 1.5);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(17, 20);
    ctx.lineTo(21, 4);
    ctx.stroke();
    ctx.fillStyle = MAGENTA;
    ctx.fillRect(18.5, 3, 4, 3);
  },
  // A naturalist's magnifying glass over a leaf.
  naturalist: (ctx) => {
    ctx.fillStyle = TREE;
    ctx.beginPath();
    ctx.moveTo(4, 20);
    ctx.quadraticCurveTo(4, 10, 14, 9);
    ctx.quadraticCurveTo(13, 19, 4, 20);
    ctx.fill();
    circle(ctx, 14, 9, 5.5, 'rgba(255,255,255,0.55)', INK, 1.8);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(18, 13);
    ctx.lineTo(22, 19);
    ctx.stroke();
    ctx.fillStyle = MAGENTA;
    ctx.fillRect(20, 17.5, 3, 3);
  },
  // A boatman's rowing boat on a wave.
  boatman: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(3, 11);
    ctx.lineTo(21, 11);
    ctx.quadraticCurveTo(19, 17, 12, 17);
    ctx.quadraticCurveTo(5, 17, 3, 11);
    ctx.fillStyle = BROWN;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(9, 11);
    ctx.lineTo(16, 3);
    ctx.stroke();
    ctx.fillStyle = MAGENTA;
    ctx.fillRect(14.5, 2, 3.5, 3);
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(2, 20);
    ctx.quadraticCurveTo(7, 17.5, 12, 20);
    ctx.quadraticCurveTo(17, 22.5, 22, 20);
    ctx.stroke();
  },
};

/** A tile's flat tint with its map symbol, for chart rows and the commission. */
function swatch(ctx: Ctx, t: Terrain) {
  ctx.fillStyle = ['village', 'port', 'ruins', 'river', 'road'].includes(t) ? tintOf('grass') : tintOf(t);
  ctx.fillRect(0, 0, 16, 16);
  ctx.strokeStyle = theme === 'dark' ? 'rgba(228,232,236,0.3)' : 'rgba(29,35,41,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, 15, 15);
  if (t === 'forest') {
    for (const [x, y] of [[5, 5], [11, 6], [6, 11], [11, 11]]) {
      circle(ctx, x, y, 2.4, theme === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.4)', TREE, 0.9);
    }
  } else if (t === 'hills') {
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 1;
    for (const r of [2.5, 5]) {
      ctx.beginPath();
      ctx.ellipse(8, 9, r * 1.3, r, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (t === 'mountain') {
    poly(ctx, [[8, 3], [13, 12], [3, 12]], INK);
  } else if (t === 'village') {
    ctx.fillStyle = INK;
    ctx.fillRect(3, 4, 4, 3);
    ctx.fillRect(9, 3, 4, 4);
    ctx.fillRect(4, 9, 5, 3);
    ctx.fillRect(10, 10, 3, 3);
  } else if (t === 'ruins') {
    ctx.strokeStyle = INK;
    ctx.setLineDash([2, 1.5]);
    ctx.strokeRect(3, 4, 10, 8);
    ctx.setLineDash([]);
    circle(ctx, 6, 7, 1.2, INK);
    circle(ctx, 10, 9, 1.2, INK);
  } else if (t === 'beach') {
    ctx.fillStyle = 'rgba(160,120,60,0.7)';
    for (const [x, y] of [[3, 4], [8, 3], [12, 6], [5, 9], [10, 11], [4, 13], [13, 13]]) ctx.fillRect(x, y, 1.2, 1.2);
  } else if (t === 'sea') {
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 1;
    for (const y of [6, 11]) {
      ctx.beginPath();
      ctx.moveTo(3, y);
      ctx.quadraticCurveTo(5.5, y - 2, 8, y);
      ctx.quadraticCurveTo(10.5, y + 2, 13, y);
      ctx.stroke();
    }
  } else if (t === 'port') {
    ctx.fillStyle = INK;
    ctx.fillRect(7, 2, 2, 12);
  } else if (t === 'river') {
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(3, 3);
    ctx.quadraticCurveTo(12, 6, 7, 9);
    ctx.quadraticCurveTo(3, 12, 13, 14);
    ctx.stroke();
  } else if (t === 'road') {
    for (const [col, lw] of [[INK, 4], [theme === 'dark' ? '#6a5c44' : '#f6ecd2', 2]] as const) {
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.moveTo(2, 13);
      ctx.lineTo(8, 8);
      ctx.lineTo(14, 4);
      ctx.stroke();
    }
  }
}

/**
 * The map's marks for what tiles hold, each 24 px: `find-wreck`, `find-cave`, `artifact`,
 * `storm`, `camp`, `dug`, `treasure` and `riddle`. Ink symbols like the rest of the sheet; the
 * camp is magenta survey overprint like the stations, and the treasure gold like the compass.
 */
const MARKS: Record<string, (ctx: Ctx) => void> = {
  // The coastal sloop at anchor off its landing.
  sloop,
  // A village's rumour of the wonder: a dashed gold ring round a question mark, seen through the fog.
  rumour: (ctx) => {
    ctx.setLineDash([3, 2]);
    circle(ctx, 12, 12, 9.5, null, GOLD_DARK, 1.4);
    ctx.setLineDash([]);
    ctx.fillStyle = GOLD_DARK;
    ctx.font = '800 13px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 12, 12.5);
  },
  // A village's guide: a walking staff and a trail of magenta footsteps.
  'trade-guide': (ctx) => {
    ctx.strokeStyle = BROWN;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(6, 21);
    ctx.lineTo(9, 3.5);
    ctx.stroke();
    ctx.lineCap = 'butt';
    circle(ctx, 9.2, 3.5, 1.8, INK);
    ctx.fillStyle = MAGENTA;
    for (const [x, y] of [[13, 19], [17, 16], [14.5, 12], [18.5, 9], [16, 5]]) {
      ctx.beginPath();
      ctx.ellipse(x, y, 1.6, 1.1, -0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  // A village's rumour: a speech bubble with a gold question mark.
  'trade-rumour': (ctx) => {
    rrect(ctx, 3, 3, 18, 13, 3);
    ctx.fillStyle = SHEET;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    poly(ctx, [[7, 15.5], [7, 21], [12, 15.5]], SHEET, INK, 1.2);
    ctx.fillStyle = SHEET;
    ctx.fillRect(7.6, 14.6, 3.8, 1.6);
    ctx.fillStyle = GOLD_DARK;
    ctx.font = '800 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 12, 10);
  },
  // A wrecked hull on its side with a broken mast.
  'find-wreck': (ctx) => {
    ctx.save();
    ctx.translate(12, 13);
    ctx.rotate(-0.25);
    ctx.beginPath();
    ctx.moveTo(-9, -1);
    ctx.lineTo(9, -1);
    ctx.quadraticCurveTo(7, 6, 0, 6);
    ctx.quadraticCurveTo(-7, 6, -9, -1);
    ctx.fillStyle = BROWN;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-1, -1);
    ctx.lineTo(-1, -9);
    ctx.lineTo(4, -6);
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(3, 21);
    ctx.quadraticCurveTo(7.5, 18.5, 12, 21);
    ctx.quadraticCurveTo(16.5, 23.5, 21, 21);
    ctx.stroke();
  },
  // A cave mouth: a dark arch in a rock face.
  'find-cave': (ctx) => {
    poly(ctx, [[2, 20], [7, 7], [12, 4], [18, 8], [22, 20]], '#d9c3a0', INK, 1.2);
    ctx.beginPath();
    ctx.moveTo(7.5, 20);
    ctx.lineTo(7.5, 15);
    ctx.arc(12, 15, 4.5, Math.PI, 0);
    ctx.lineTo(16.5, 20);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
  },
  // An old urn, for the chart's artifact row.
  artifact: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(9, 3);
    ctx.lineTo(15, 3);
    ctx.lineTo(14, 6);
    ctx.quadraticCurveTo(20, 10, 16, 18);
    ctx.lineTo(16, 21);
    ctx.lineTo(8, 21);
    ctx.lineTo(8, 18);
    ctx.quadraticCurveTo(4, 10, 10, 6);
    ctx.closePath();
    ctx.fillStyle = GOLD;
    ctx.fill();
    ctx.strokeStyle = GOLD_DARK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = GOLD_DARK;
    ctx.fillRect(7, 11, 10, 1.5);
  },
  // A storm cloud with slanting rain.
  storm: (ctx) => {
    ctx.strokeStyle = BLUE;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const x of [7, 11.5, 16]) {
      ctx.moveTo(x, 15);
      ctx.lineTo(x - 2.5, 21);
    }
    ctx.stroke();
    ctx.fillStyle = '#5b6670';
    ctx.beginPath();
    ctx.arc(8, 11, 4.5, 0, Math.PI * 2);
    ctx.arc(13, 8, 5.5, 0, Math.PI * 2);
    ctx.arc(17.5, 11.5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(8, 11, 10, 4.5);
  },
  // A base camp: a magenta tent with a pennant.
  camp: (ctx) => {
    poly(ctx, [[3, 20], [12, 6], [21, 20]], MAGENTA, INK, 1.2);
    poly(ctx, [[12, 11], [15.5, 20], [8.5, 20]], SHEET);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(12, 6);
    ctx.lineTo(12, 1.5);
    ctx.stroke();
    poly(ctx, [[12, 1.5], [17, 3], [12, 4.5]], MAGENTA);
  },
  // A dug tile: a dotted ring of spoil round a hole.
  dug: (ctx) => {
    ctx.fillStyle = BROWN;
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(12 + Math.cos(a) * 7, 12 + Math.sin(a) * 5.5, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(12, 12, 3.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(29,35,41,0.55)';
    ctx.fill();
  },
  // The treasure: a gold-banded chest.
  treasure: (ctx) => {
    rrect(ctx, 4, 8, 16, 12, 2);
    ctx.fillStyle = BROWN;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.fillRect(4, 12, 16, 2);
    ctx.fillRect(10.5, 11, 3, 5);
    ctx.strokeStyle = GOLD_DARK;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(10.5, 11, 3, 5);
    ctx.beginPath();
    ctx.moveTo(4, 8);
    ctx.quadraticCurveTo(12, 2, 20, 8);
    ctx.fillStyle = '#8a5a30';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  },
  // The rival's claim: a small grey pennant on a stake, on a tile they charted first.
  claim: (ctx) => {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(8, 21);
    ctx.lineTo(8, 4);
    ctx.stroke();
    poly(ctx, [[8.5, 4], [19, 7.5], [8.5, 11]], '#8a949c', INK, 1);
  },
  // The riddle chart: a curled sheet with a dotted magenta trail to a gold star.
  riddle: (ctx) => {
    rrect(ctx, 3, 4, 18, 16, 2);
    ctx.fillStyle = '#efe3c4';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = MAGENTA;
    for (const [x, y] of [[6, 16], [8, 13.5], [10.5, 12], [13, 11]]) ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
    star(ctx, 16.5, 9, 3.5, 1.4, 5, GOLD, GOLD_DARK, 0.6);
  },
};


/**
 * The wonders (`wonder-<kind>`, 32 px): a small picture in a gold ring, drawn on the map once a
 * wonder is seen and in the wonder gallery; `wonder-unseen` is the gallery's empty frame.
 */
const STONE = '#9aa3a8';
const WATER = '#5aa6d6';
const LEAF = '#3f8f3a';
const WONDER_ICONS: Record<WonderKind, (ctx: Ctx) => void> = {
  // White water falling over a cliff into a pool.
  waterfall: (ctx) => {
    poly(ctx, [[6, 24], [9, 9], [14, 7], [14, 24]], STONE, INK, 1);
    poly(ctx, [[18, 24], [18, 7], [23, 9], [26, 24]], STONE, INK, 1);
    ctx.fillStyle = WATER;
    ctx.fillRect(14, 7, 4, 17);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(15, 9, 1, 13);
    ctx.beginPath();
    ctx.ellipse(16, 25, 8, 2.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = WATER;
    ctx.fill();
  },
  // A rock arch over the waves.
  arch: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(6, 24);
    ctx.lineTo(8, 11);
    ctx.quadraticCurveTo(16, 4, 24, 11);
    ctx.lineTo(26, 24);
    ctx.lineTo(21, 24);
    ctx.lineTo(20, 15);
    ctx.quadraticCurveTo(16, 11, 12, 15);
    ctx.lineTo(11, 24);
    ctx.closePath();
    ctx.fillStyle = '#c9b48d';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = WATER;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(5, 25.5);
    ctx.quadraticCurveTo(10.5, 23, 16, 25.5);
    ctx.quadraticCurveTo(21.5, 28, 27, 25.5);
    ctx.stroke();
  },
  // A cone with a glowing crater and a plume of smoke.
  volcano: (ctx) => {
    poly(ctx, [[5, 25], [13, 12], [19, 12], [27, 25]], '#8a5a3c', INK, 1);
    ctx.fillStyle = GOLD;
    ctx.fillRect(13, 11, 6, 2);
    ctx.fillStyle = '#7c868c';
    for (const [x, y, r] of [[15, 8, 2.5], [18, 5.5, 3], [14, 4, 2]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  // A wide old tree with a heavy crown.
  tree: (ctx) => {
    ctx.fillStyle = BROWN;
    ctx.fillRect(14, 15, 4, 11);
    ctx.fillStyle = LEAF;
    for (const [x, y, r] of [[10, 13, 5], [16, 9, 6], [22, 13, 5], [16, 15, 5]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = INK;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(8, 26);
    ctx.lineTo(24, 26);
    ctx.stroke();
  },
  // Three standing stones and a lintel.
  stones: (ctx) => {
    poly(ctx, [[6, 25], [7, 13], [11, 13], [11, 25]], STONE, INK, 1);
    poly(ctx, [[14, 25], [14, 10], [18, 10], [18, 25]], STONE, INK, 1);
    poly(ctx, [[21, 25], [21, 13], [25, 13], [26, 25]], STONE, INK, 1);
    poly(ctx, [[12, 9], [20, 9], [20, 7], [12, 7]], STONE, INK, 1);
  },
  // A ring of reef round still blue water.
  lagoon: (ctx) => {
    ctx.beginPath();
    ctx.ellipse(16, 17, 11, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#e9d9a8';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(16, 17, 7, 4.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#8fd3e6';
    ctx.fill();
    ctx.fillStyle = '#e8829c';
    for (const [x, y] of [[8, 13], [24, 20], [11, 22]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  },
  // A steaming pool among rocks.
  springs: (ctx) => {
    ctx.beginPath();
    ctx.ellipse(16, 22, 10, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = WATER;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = '#9aa3a8';
    ctx.lineWidth = 1.4;
    for (const x of [11, 16, 21]) {
      ctx.beginPath();
      ctx.moveTo(x, 18);
      ctx.bezierCurveTo(x - 3, 15, x + 3, 12, x, 8);
      ctx.stroke();
    }
  },
  // A stepped temple under vines.
  temple: (ctx) => {
    poly(ctx, [[5, 25], [27, 25], [24, 19], [8, 19]], STONE, INK, 1);
    poly(ctx, [[9, 19], [23, 19], [21, 13], [11, 13]], STONE, INK, 1);
    poly(ctx, [[12, 13], [20, 13], [18, 8], [14, 8]], STONE, INK, 1);
    ctx.fillStyle = INK;
    ctx.fillRect(15, 21, 2, 4);
    ctx.strokeStyle = LEAF;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(8, 19);
    ctx.quadraticCurveTo(10, 23, 9, 25);
    ctx.moveTo(21, 13);
    ctx.quadraticCurveTo(24, 16, 23, 19);
    ctx.stroke();
  },
};

function wonderIcon(ctx: Ctx, draw: ((ctx: Ctx) => void) | null) {
  circle(ctx, 16, 16, 15, SHEET, null);
  if (draw) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(16, 16, 14, 0, Math.PI * 2);
    ctx.clip();
    draw(ctx);
    ctx.restore();
    circle(ctx, 16, 16, 15, null, GOLD_DARK, 1.6);
  } else {
    ctx.setLineDash([3, 2.5]);
    circle(ctx, 16, 16, 14.5, null, RULE, 1.2);
    ctx.setLineDash([]);
  }
}

export function bakeIcons(scene: Phaser.Scene) {
  for (const id of WONDER_IDS) bake(scene, `wonder-${id}`, 32, 32, (ctx) => wonderIcon(ctx, WONDER_ICONS[id]));
  bake(scene, 'wonder-unseen', 32, 32, (ctx) => wonderIcon(ctx, null));
  for (const [id, draw] of Object.entries(UPGRADE_ICONS)) bake(scene, `icon-${id}`, 24, 24, draw);
  for (const id of Object.keys(HANDS) as Hand[]) bake(scene, `hand-${id}`, 24, 24, HAND_ICONS[id]);
  for (const t of TERRAINS) bake(scene, `swatch-${t}`, 16, 16, (ctx) => swatch(ctx, t));
  // The Lodestone Compass's mark for a landmark under the fog: a gold rose in a thin ring.
  bake(scene, 'landmark-hint', 26, 26, (ctx) => {
    circle(ctx, 13, 13, 11, null, '#c08a1e', 0.8);
    star(ctx, 13, 13, 9, 2.5, 4, GOLD, GOLD_DARK, 0.8);
  });
  // The sheet's mark: a survey station in a ring.
  bake(scene, 'logo', 22, 22, (ctx) => {
    circle(ctx, 11, 11, 9.5, null, MAGENTA, 1.6);
    poly(ctx, [[11, 4], [17, 14.5], [5, 14.5]], null, MAGENTA, 1.6);
  });
  for (const [key, draw] of Object.entries(MARKS)) bake(scene, key, 24, 24, draw);
  // An atlas: a bound book with a station on its cover, one cover colour per kind of isle.
  for (const kind of [...(Object.keys(KINDS) as IsleKind[]), null]) {
    const filled = kind !== null;
    bake(scene, kind ? `atlas-${kind}` : 'atlas-empty', 16, 16, (ctx) => {
      const c = kind ? KINDS[kind].page : theme === 'dark' ? '#4a5560' : '#b9c0c6';
      ctx.fillStyle = c;
      ctx.fillRect(2, 2, 12, 12);
      ctx.fillStyle = filled ? SHEET : TRACK;
      ctx.fillRect(4, 12, 10, 1.5);
      ctx.fillStyle = filled ? MAGENTA : RULE;
      ctx.fillRect(2, 2, 2, 12);
      poly(ctx, [[9, 4.5], [12, 9.5], [6, 9.5]], null, SHEET, 1);
    });
  }
}
