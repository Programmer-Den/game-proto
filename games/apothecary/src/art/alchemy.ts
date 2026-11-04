import Phaser from 'phaser';
import { MIXES, MURKY, WILD_HERBS, isGood, type Brewed, type Ingredient } from '../game/alchemy';
import { itemTexture } from './items';
import { WASH, both, ellPts, ink, itemIcon, paint, rectPts, shadow, sparkle, type Ctx } from './paint';

// The alchemy bench, the courier's post, the wild herbs and bench potions' icons and the shop decor
// (AP18 to AP20), painted like the rest of the yard.

/** An ingredient's or bench potion's icon: refined goods use their item icon. */
export const alchemyTexture = (id: Ingredient | Brewed) => (isGood(id) ? itemTexture(id) : `alchemy-${id}`);

function drawWild(c: Ctx, id: string) {
  c.save();
  c.translate(8, 8.5);
  if (id === 'silverleaf') {
    // A silvery fern frond.
    ink(c, [[0, 7], [0, -6]], { closed: false, w: 0.9 });
    for (let k = 0; k < 4; k++) {
      const y = 4 - k * 3;
      for (const side of [-1, 1]) both(c, ellPts(side * 2.6, y, 2.6 - k * 0.3, 1.1, 10), '#b8c8c0', { layers: 1 }, { w: 0.5 });
    }
  } else if (id === 'bogbloom') {
    // A pink marsh flower on a reed-like stem.
    ink(c, [[0, 7], [0, -1]], { closed: false, w: 0.9, col: '#3f6a2e' });
    both(c, ellPts(-2.5, 3, 1.2, 3, 10), WASH.leaf, { layers: 1 }, { w: 0.5 });
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      both(c, ellPts(Math.cos(a) * 2.6, -3 + Math.sin(a) * 2.6, 1.8, 1.8, 10), '#d47aa8', { layers: 1 }, { w: 0.5 });
    }
    both(c, ellPts(0, -3, 1.3, 1.3, 10), '#f5d06a', { layers: 1 }, { w: 0.4 });
  } else {
    // A pale blue mountain mushroom, frosted.
    both(c, rectPts(-1.6, -1, 3.2, 7.5, 1), '#efe8d8', { layers: 1 }, { w: 0.6 });
    both(c, [[-6.5, 0], [-4, -5], [0, -6.8], [4, -5], [6.5, 0]], '#8ab8e0', { layers: 1 }, { w: 0.7 });
    for (const [x, y] of [[-3, -3], [1, -4.5], [3.5, -1.8]]) both(c, ellPts(x, y, 0.8, 0.8, 8), '#f4f8ff', { layers: 1 }, { w: 0.3 });
  }
  c.restore();
}

/** The alchemy bench: a long table with an alembic over a burner, a mortar, jars and a glowing flask. 88x56 as shown. */
function drawBench(c: Ctx) {
  shadow(c, 44, 52, 40, 4, 0.2);
  for (const lx of [6, 76]) both(c, rectPts(lx, 32, 6, 20, 1), WASH.woodDeep, { layers: 2 }, { w: 1 });
  both(c, rectPts(2, 24, 84, 10, 3), WASH.wood, { layers: 3, bloom: 2, cx: 30, cy: 28 }, { w: 1.3 });
  both(c, rectPts(2, 32, 84, 4, 1.5), WASH.woodDark, { layers: 2 }, { w: 1 });
  // The alembic: a round flask over a little flame, its neck bent down into a receiver.
  const g = c.createRadialGradient(22, 18, 0, 22, 18, 18);
  g.addColorStop(0, 'rgba(160,230,200,0.5)');
  g.addColorStop(1, 'rgba(160,230,200,0)');
  c.fillStyle = g;
  c.fillRect(2, 0, 40, 36);
  both(c, ellPts(22, 24, 4, 1.5, 10), WASH.flame, { layers: 1 }, { w: 0.5 });
  both(c, ellPts(22, 15, 7, 7, 24), '#9fe0c4', { layers: 1, bloom: 1, cx: 20, cy: 13 }, { w: 1 });
  ink(c, [[24, 9], [30, 3], [40, 8], [40, 16]], { closed: false, w: 1.4 });
  both(c, rectPts(36, 16, 8, 8, 2), '#d8e6ee', { layers: 1 }, { w: 0.8 });
  // A mortar and pestle, and three jars of herbs.
  both(c, [[48, 18], [58, 18], [56, 24], [50, 24]], WASH.stone, { layers: 1 }, { w: 0.9 });
  ink(c, [[55, 19], [61, 10]], { closed: false, w: 1.6 });
  for (const [x, col] of [[66, '#b8c8c0'], [73, '#d47aa8'], [80, '#8ab8e0']] as const) {
    both(c, rectPts(x - 3, 13, 6, 11, 1.5), '#e8eef0', { layers: 1 }, { w: 0.7 });
    both(c, rectPts(x - 2.2, 17, 4.4, 6.5, 1), col, { layers: 1 }, { w: 0.3 });
    both(c, rectPts(x - 3.4, 11, 6.8, 2.5, 1), WASH.woodDark, { layers: 1 }, { w: 0.5 });
  }
}

/** The courier's post: a signpost with arms to the forest, the marsh and the mountains, and a satchel on a peg. 56x72 as shown. */
function drawPost(c: Ctx) {
  shadow(c, 28, 69, 16, 3, 0.2);
  both(c, rectPts(25, 8, 6, 62, 1.5), WASH.woodDark, { layers: 2 }, { w: 1.1 });
  const arm = (y: number, left: boolean, col: string) => {
    const pts: [number, number][] = left
      ? [[3, y + 5], [8, y], [28, y], [28, y + 10], [8, y + 10]]
      : [[28, y], [48, y], [53, y + 5], [48, y + 10], [28, y + 10]];
    both(c, pts, WASH.wood, { layers: 2 }, { w: 1 });
    both(c, ellPts(left ? 13 : 43, y + 5, 2.6, 2.6, 10), col, { layers: 1 }, { w: 0.5 });
  };
  arm(10, true, '#4f8a3a');
  arm(24, false, '#d47aa8');
  arm(38, true, '#8ab8e0');
  // The satchel.
  both(c, rectPts(31, 50, 14, 11, 3), WASH.leather, { layers: 2 }, { w: 0.9 });
  ink(c, [[31, 51], [38, 44], [45, 51]], { closed: false, w: 0.8 });
}

/** A painted shop sign on a post: a flask on a green board. 40x46 as shown. */
function drawSign(c: Ctx) {
  shadow(c, 20, 44, 10, 2, 0.2);
  both(c, rectPts(18, 14, 4, 30, 1), WASH.woodDark, { layers: 1 }, { w: 0.9 });
  ink(c, [[8, 6], [32, 6]], { closed: false, w: 1.2 });
  both(c, rectPts(4, 8, 32, 22, 3), '#3f6a4a', { layers: 2 }, { w: 1.1 });
  both(c, rectPts(6, 10, 28, 18, 2), '#e9d8a8', { layers: 1, alpha: 0.25 }, { w: 0.5, col: WASH.brass });
  itemIcon(c, 'moonlightSalve', 20, 19.5, 14);
}

/** A lantern on a post, lit. 18x44 as shown. */
function drawLantern(c: Ctx) {
  shadow(c, 9, 42, 6, 1.5, 0.2);
  const g = c.createRadialGradient(9, 9, 0, 9, 9, 9);
  g.addColorStop(0, 'rgba(255,210,110,0.7)');
  g.addColorStop(1, 'rgba(255,210,110,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 18, 18);
  both(c, rectPts(7.5, 16, 3, 26, 1), WASH.iron, { layers: 1 }, { w: 0.7 });
  both(c, rectPts(4, 5, 10, 11, 1.5), '#ffd88a', { layers: 1 }, { w: 0.9, col: WASH.iron });
  both(c, [[3, 5], [9, 1], [15, 5]], WASH.iron, { layers: 1 }, { w: 0.7 });
}

/** An arch of woven willow grown over with herbs and flowers, its posts either side of the street path. 64x72 as shown. */
function drawArch(c: Ctx) {
  for (const x of [7, 57]) {
    shadow(c, x, 70, 5, 1.5, 0.2);
    both(c, rectPts(x - 3, 34, 6, 36, 1.5), WASH.woodDark, { layers: 1 }, { w: 0.9 });
  }
  c.lineCap = 'round';
  c.lineWidth = 6;
  c.strokeStyle = WASH.woodDark;
  c.beginPath();
  c.arc(32, 34, 25, Math.PI, 0);
  c.stroke();
  ink(c, Array.from({ length: 21 }, (_, k) => { const a = Math.PI + (k / 20) * Math.PI; return [32 + Math.cos(a) * 28, 34 + Math.sin(a) * 28] as [number, number]; }), { closed: false, w: 0.8 });
  for (let k = 0; k < 12; k++) {
    const a = Math.PI + ((k + 0.5) / 12) * Math.PI;
    const x = 32 + Math.cos(a) * 25, y = 34 + Math.sin(a) * 25;
    both(c, ellPts(x, y, 4, 3, 10), k % 2 ? WASH.leaf : WASH.leafLight, { layers: 1 }, { w: 0.4 });
    if (k % 3 === 0) both(c, ellPts(x + 1, y - 1, 1.6, 1.6, 8), k % 2 ? '#d47aa8' : '#9a7ad8', { layers: 1 }, { w: 0.3 });
  }
  for (const x of [7, 57]) for (const y of [42, 53, 63]) both(c, ellPts(x + (y % 4) - 1, y, 3.2, 2.4, 10), WASH.leaf, { layers: 1 }, { w: 0.4 });
}

/** A stone fountain with a basin of water and a little spout. 56x44 as shown. */
function drawFountain(c: Ctx) {
  shadow(c, 28, 40, 26, 4, 0.2);
  both(c, ellPts(28, 30, 25, 9, 32), WASH.stone, { layers: 2 }, { w: 1.1 });
  both(c, ellPts(28, 28, 20, 6, 28), '#6fa8c8', { layers: 2, bloom: 1, cx: 24, cy: 27 }, { w: 0.8 });
  both(c, rectPts(25, 10, 6, 17, 1.5), WASH.stoneDark, { layers: 1 }, { w: 0.9 });
  both(c, ellPts(28, 10, 7, 2.5, 16), WASH.stone, { layers: 1 }, { w: 0.8 });
  ink(c, [[24, 9], [19, 4], [16, 14]], { closed: false, w: 1, col: '#a8d8f0' });
  ink(c, [[32, 9], [37, 4], [40, 14]], { closed: false, w: 1, col: '#a8d8f0' });
  sparkle(c, 22, 26, 2);
}

export function bakeAlchemy(scene: Phaser.Scene) {
  for (const id of WILD_HERBS) paint(scene, `alchemy-${id}`, 16, 16, (c) => drawWild(c, id), 4);
  for (const id of [...MIXES.map((m) => m.id), MURKY]) paint(scene, `alchemy-${id}`, 16, 16, (c) => itemIcon(c, id, 8, 8.5, 15), 4);
  paint(scene, 'alchemy-bench', 88, 56, drawBench, 3);
  paint(scene, 'courier-post', 56, 72, drawPost, 3);
  paint(scene, 'decor-paintedSign', 40, 46, drawSign, 3);
  paint(scene, 'decor-lanterns', 18, 44, drawLantern, 3);
  paint(scene, 'decor-herbArch', 64, 72, drawArch, 3);
  paint(scene, 'decor-fountain', 56, 44, drawFountain, 3);
}
