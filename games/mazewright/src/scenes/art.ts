import type Phaser from 'phaser';
import type { Season } from '../game/maps';
import type { FoeKind, TowerKind, TrapKind } from '../game/rules';

// The Hedge Garden in flat vector shapes: clean fills, soft drop shadows, no outlines. Every piece
// is drawn with a Phaser Graphics at a cell's middle, in pixels, and sized for 40-pixel cells.

type G = Phaser.GameObjects.Graphics;

export const C = {
  lawn: 0x8cc265,
  /** A pouch chip for a tower still in the potting shed. */
  locked: 0x6b5a44,
  lawn2: 0x7db457,
  lawnEdge: 0x6fa24c,
  hedge: 0x3f8a3a,
  hedgeLight: 0x57a64b,
  hedgeDark: 0x2e6b2b,
  stone: 0xc9c3b4,
  stoneLight: 0xe4dfd2,
  rock: 0x9b9486,
  rockLight: 0xb7b0a2,
  soil: 0x6b4a2b,
  hole: 0x24170c,
  wood: 0x7a4a22,
  route: 0xfff6d6,
  moth: 0xd9c7f2,
  mothDark: 0xc3aee6,
  frost: 0x9fe6ff,
  iron: 0x3e3e46,
  shadow: 0x1e3214,
  bar: 0x3e2a1a,
  barLight: 0x4f3826,
  cream: 0xf8ecd0,
  gold: 0xf2c14e,
  warn: 0xff9d2e,
  life: 0xa6e07a,
  health: 0x7be36b,
};

export const FOE_COLOUR: Record<FoeKind, number> = {
  beetle: 0x7a3fa0,
  ladybird: 0xd9412e,
  stag: 0x3c3c46,
  moth: C.moth,
  mole: 0x4a3a33,
  weevil: 0x7d6a52,
  woodlouse: 0x8a8f99,
  snail: 0xc9a36b,
  ember: 0x9c3b1c,
  earwig: 0x6e4126,
  queen: 0x5b2a7a,
};

const shadow = (g: G, draw: () => void) => {
  g.fillStyle(C.shadow, 0.22);
  draw();
};

/** Each season's lawn: its two checks and its edge. Spring is the picker's lawn. */
export const SEASON_LAWN: Record<Season, { lawn: number; lawn2: number; edge: number }> = {
  spring: { lawn: C.lawn, lawn2: C.lawn2, edge: C.lawnEdge },
  summer: { lawn: 0xa3c35c, lawn2: 0x97b752, edge: 0x7f9c40 },
  autumn: { lawn: 0xb39d58, lawn2: 0xa69050, edge: 0x8a7640 },
  winter: { lawn: 0x9db5c2, lawn2: 0x92aab8, edge: 0x7a95a4 },
};

export function lawn(g: G, x: number, y: number, w: number, h: number, cols: number, rows: number, cell: number, season: Season = 'spring') {
  const look = SEASON_LAWN[season];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) if ((i + j) % 2) {
    g.fillStyle(look.lawn2, 1);
    g.fillRect(x + i * cell, y + j * cell, cell, cell);
  }
  g.lineStyle(2, look.edge, 1);
  g.strokeRect(x - 1, y - 1, w + 2, h + 2);
}

/** Flowers scattered over the lawn, the same every time. */
export function flowers(g: G, x: number, y: number, w: number, h: number) {
  const colours = [0xfff6d5, 0xf7a8c0, 0xffe066, 0xa8c8ff];
  for (let i = 0; i < Math.floor((w * h) / 9000); i++) {
    const fx = x + ((i * 211.7) % w);
    const fy = y + ((i * 137.3 + (i % 3) * 53) % h);
    g.fillStyle(colours[i % 4], 1);
    for (let p = 0; p < 5; p++) g.fillCircle(fx + Math.cos(p * 1.256) * 3, fy + Math.sin(p * 1.256) * 3, 2.2);
    g.fillStyle(0xe8a33d, 1);
    g.fillCircle(fx, fy, 1.5);
  }
}

/** A cell of water by its top-left corner, `cell` wide; ice in winter. */
export function pond(g: G, x: number, y: number, cell: number, ice: boolean) {
  g.fillStyle(ice ? 0xd6ecf6 : 0x4f9fd1, 1);
  g.fillRect(x, y, cell, cell);
  g.fillStyle(ice ? 0xffffff : 0x7cc0e8, ice ? 0.8 : 1);
  if (ice) g.fillTriangle(x + cell * 0.2, y + cell * 0.75, x + cell * 0.55, y + cell * 0.25, x + cell * 0.62, y + cell * 0.32);
  else {
    g.fillRoundedRect(x + cell * 0.18, y + cell * 0.3, cell * 0.36, 3, 1.5);
    g.fillRoundedRect(x + cell * 0.46, y + cell * 0.62, cell * 0.36, 3, 1.5);
  }
}

/** A raised bank by its top-left corner: a lighter top with a step along its foot. */
export function bank(g: G, x: number, y: number, cell: number) {
  g.fillStyle(0xfff3c4, 0.4);
  g.fillRect(x + 1, y + 1, cell - 2, cell - 7);
  g.fillStyle(0x4b5d2a, 0.6);
  g.fillRect(x + 1, y + cell - 6, cell - 2, 5);
}

/** A cell of a path garden's gravel path, by its top-left corner. */
export function gravel(g: G, x: number, y: number, cell: number) {
  g.fillStyle(0xd9c79f, 1);
  g.fillRect(x, y, cell, cell);
  g.fillStyle(0xb8a37a, 1);
  for (const [a, b] of [[0.22, 0.3], [0.6, 0.18], [0.78, 0.6], [0.35, 0.72], [0.52, 0.46]]) g.fillCircle(x + a * cell, y + b * cell, cell / 16);
}

export function hedge(g: G, x: number, y: number, alpha = 1) {
  shadow(g, () => g.fillRoundedRect(x - 18 + 2, y - 17 + 3, 36, 36, 10));
  g.fillStyle(C.hedgeDark, alpha);
  g.fillRoundedRect(x - 18, y - 17, 36, 36, 10);
  g.fillStyle(C.hedge, alpha);
  for (const [a, b, r] of [[-8, -7, 9], [7, -8, 9], [0, 2, 10], [-9, 7, 7], [9, 8, 7]]) g.fillCircle(x + a, y + b, r);
  g.fillStyle(C.hedgeLight, alpha);
  g.fillCircle(x - 5, y - 9, 3.5);
  g.fillCircle(x + 6, y - 2, 2.5);
}

/** A hedge being chewed: thinner, with soil around it, by how far the mole has got (0 to 1). */
export function chewedHedge(g: G, x: number, y: number, done: number) {
  hedge(g, x, y, 1 - done * 0.6);
  g.fillStyle(C.soil, 0.8);
  for (let i = 0; i < 6; i++) g.fillCircle(x - 14 + ((i * 11) % 28), y + 14 - ((i * 7) % 10), 2 + (i % 2));
}

export function rock(g: G, x: number, y: number) {
  const pts = [[-16, 12], [-14, -4], [-4, -13], [10, -10], [16, 2], [13, 13]].map(([a, b]) => ({ x: x + a, y: y + b }));
  shadow(g, () => g.fillPoints(pts.map((p) => ({ x: p.x + 2, y: p.y + 3 })) as Phaser.Math.Vector2[], true));
  g.fillStyle(C.rock, 1);
  g.fillPoints(pts as Phaser.Math.Vector2[], true);
  g.fillStyle(C.rockLight, 1);
  g.fillTriangle(x - 8, y - 6, x - 2, y - 10, x + 6, y - 7);
  g.fillTriangle(x - 8, y - 6, x + 6, y - 7, x - 2, y - 3);
}

/** A tower's stone plinth on its hedge, with its weapon turned to `aim` and a pip per level. */
export function tower(g: G, kind: TowerKind, x: number, y: number, level: number, aim = 0, alpha = 1) {
  hedge(g, x, y, alpha);
  if (kind === 'hedge') return;
  shadow(g, () => g.fillCircle(x + 2, y + 3, 14));
  g.fillStyle(C.stone, alpha);
  g.fillCircle(x, y, 14);
  g.fillStyle(C.stoneLight, alpha);
  g.fillCircle(x - 2, y - 3, 9);
  g.save();
  g.translateCanvas(x, y);
  if (kind !== 'frost' && kind !== 'beehive' && kind !== 'apple' && kind !== 'puffball' && kind !== 'nettle' && kind !== 'toadstool') g.rotateCanvas(aim);
  if (kind === 'storm') {
    // A copper rod with a charged ball on top.
    g.fillStyle(0xb06a35, alpha);
    g.fillRect(-2, -2, 12, 4);
    g.fillStyle(0x6fd3ff, alpha);
    g.fillCircle(-1, 0, 6.5);
    g.fillStyle(0xfff27a, alpha);
    g.fillCircle(-2, -1.5, 3);
  } else if (kind === 'crossbow') {
    // A long stock with a short, stiff bow across its front.
    g.fillStyle(C.wood, alpha);
    g.fillRoundedRect(-9, -2.5, 20, 5, 2);
    g.lineStyle(3, 0x5a3417, alpha);
    g.lineBetween(7, -9, 7, 9);
    g.lineStyle(1, 0x2d3b1f, alpha);
    g.lineBetween(7, -9, -1, 0);
    g.lineBetween(7, 9, -1, 0);
    g.fillStyle(0x3e3e46, alpha);
    g.fillTriangle(11, -2, 15, 0, 11, 2);
  } else if (kind === 'bonfire') {
    // An iron brazier with flames leaning the way it points.
    g.fillStyle(C.iron, alpha);
    g.fillCircle(0, 0, 9);
    g.fillStyle(0xff8a2a, alpha);
    g.fillTriangle(-4, -6, 13, 0, -4, 6);
    g.fillStyle(0xffd24a, alpha);
    g.fillTriangle(-2, -3.5, 9, 0, -2, 3.5);
  } else if (kind === 'puffball') {
    // A round puffball with spots and a little cloud of spores.
    g.fillStyle(0xe9dfc4, alpha);
    g.fillCircle(0, 1, 9);
    g.fillStyle(0xcbbd98, alpha);
    for (const [a, b] of [[-4, -1], [3, -3], [1, 4], [-2, 5]]) g.fillCircle(a, b, 1.6);
    g.fillStyle(0xa6d96a, alpha * 0.8);
    for (const [a, b] of [[-5, -10], [1, -12], [6, -9]]) g.fillCircle(a, b, 2.2);
  } else if (kind === 'sunglass') {
    // A brass-rimmed lens on an arm, looking the way it shines.
    g.fillStyle(0xb38b2e, alpha);
    g.fillRect(-6, -2, 8, 4);
    g.fillStyle(0xd9a93a, alpha);
    g.fillCircle(5, 0, 7.5);
    g.fillStyle(0xcff3ff, alpha);
    g.fillCircle(5, 0, 5.5);
    g.fillStyle(0xffffff, alpha * 0.8);
    g.fillCircle(3.5, -2, 1.8);
  } else if (kind === 'beehive') {
    // A straw skep: a striped dome with a dark door.
    g.fillStyle(0xe0a93a, alpha);
    g.fillEllipse(0, 1, 20, 18);
    g.lineStyle(1.4, 0xb27a1e, alpha);
    for (const b of [-3, 1, 5]) g.lineBetween(-9 + Math.abs(b) * 0.3, b, 9 - Math.abs(b) * 0.3, b);
    g.fillStyle(0x3b2410, alpha);
    g.fillEllipse(0, 7, 5, 3.5);
    g.fillStyle(0xffe066, alpha);
    g.fillCircle(8, -7, 2);
    g.fillCircle(-8, -6, 2);
  } else if (kind === 'apple') {
    // A little tree: a round crown with apples on it.
    g.fillStyle(0x2f7a2f, alpha);
    g.fillCircle(0, -1, 10);
    g.fillStyle(0x4c9a3e, alpha);
    g.fillCircle(-3, -4, 5);
    g.fillStyle(0xd9412e, alpha);
    for (const [a, b] of [[-5, 2], [4, -4], [5, 4]]) g.fillCircle(a, b, 2.4);
  } else if (kind === 'whirligig') {
    // A pinwheel of four coloured blades.
    for (const [i, colour] of [0xf7a8c0, 0xffe066, 0xa8c8ff, 0xa6d96a].entries()) {
      const a = (i * Math.PI) / 2;
      g.fillStyle(colour, alpha);
      g.fillTriangle(0, 0, Math.cos(a) * 11, Math.sin(a) * 11, Math.cos(a + 0.9) * 8, Math.sin(a + 0.9) * 8);
    }
    g.fillStyle(C.wood, alpha);
    g.fillCircle(0, 0, 2.4);
  } else if (kind === 'swallow') {
    // A mud nest with a swallow peeking out the way it looks.
    g.fillStyle(0xa47a4e, alpha);
    g.fillCircle(-2, 0, 9);
    g.fillStyle(0x3b2410, alpha);
    g.fillCircle(2, 0, 5);
    g.fillStyle(0x3a4a7a, alpha);
    g.fillTriangle(1, -4, 12, 0, 1, 4);
    g.fillStyle(0xf3e6d0, alpha);
    g.fillCircle(4, 1.5, 1.8);
  } else if (kind === 'nettle') {
    // A clump of jagged nettle leaves.
    for (const [i, colour] of [0x3f8a35, 0x56a645, 0x3f8a35, 0x56a645, 0x6fbf55].entries()) {
      const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
      g.fillStyle(colour, alpha);
      g.fillTriangle(Math.cos(a - 0.45) * 3, Math.sin(a - 0.45) * 3, Math.cos(a) * 12, Math.sin(a) * 12, Math.cos(a + 0.45) * 3, Math.sin(a + 0.45) * 3);
    }
    g.fillStyle(0xd7f0a8, alpha);
    g.fillCircle(0, 0, 2.2);
  } else if (kind === 'toadstool') {
    // A ring of little toadstools round a big one.
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      g.fillStyle(0xd98ad9, alpha);
      g.fillCircle(Math.cos(a) * 9, Math.sin(a) * 9, 2.6);
    }
    g.fillStyle(0xf3e6d0, alpha);
    g.fillRect(-1.5, 0, 3, 5);
    g.fillStyle(0x9b4fb0, alpha);
    g.fillEllipse(0, 0, 13, 9);
    g.fillStyle(0xf3e6d0, alpha);
    g.fillCircle(-2.5, -1.5, 1.3);
    g.fillCircle(2.5, -0.5, 1.1);
  } else if (kind === 'bow') {
    g.lineStyle(2.6, C.wood, alpha);
    g.beginPath();
    g.arc(-3, 0, 8, -1.1, 1.1);
    g.strokePath();
    g.lineStyle(1, 0x2d3b1f, alpha);
    g.lineBetween(0.5, -7, 0.5, 7);
    g.lineStyle(1.6, 0xefe3c8, alpha);
    g.lineBetween(-6, 0, 9, 0);
  } else if (kind === 'frost') {
    g.fillStyle(C.frost, alpha);
    g.fillPoints([{ x: 0, y: -12 }, { x: 7, y: -1 }, { x: 0, y: 9 }, { x: -7, y: -1 }] as Phaser.Math.Vector2[], true);
    g.fillStyle(0xe6fbff, alpha);
    g.fillTriangle(0, -12, 7, -1, 0, -1);
  } else {
    g.fillStyle(0x33333a, alpha);
    g.fillRoundedRect(-2, -4, 14, 8, 2);
    g.fillStyle(C.iron, alpha);
    g.fillCircle(-2, 0, 7);
    g.fillStyle(0x6a6a74, alpha);
    g.fillCircle(-4, -2, 2);
  }
  g.restore();
  // Level pips along the bottom of the plinth.
  g.fillStyle(C.gold, alpha);
  for (let i = 1; i < level; i++) g.fillCircle(x - (level - 2) * 4 + (i - 1) * 8, y + 13, 2.6);
  // The master level: a gold ring round the plinth.
  if (level >= 4) {
    g.lineStyle(2, C.gold, alpha);
    g.strokeCircle(x, y, 15.5);
  }
}

/** Over a tower wilted in the summer heat: a brown wash and a drooping leaf. */
export function wilted(g: G, x: number, y: number) {
  g.fillStyle(0x8a5a2b, 0.45);
  g.fillCircle(x, y, 17);
  g.fillStyle(0xc9a45c, 1);
  g.fillEllipse(x + 9, y - 12, 10, 6);
  g.fillStyle(0x7a4a22, 1);
  g.fillRect(x + 4, y - 13, 5, 2);
}

/** Over a tower frozen by winter frost: a cold wash and a white spark. */
export function frozen(g: G, x: number, y: number) {
  g.fillStyle(0xbfe6ff, 0.75);
  g.fillRoundedRect(x - 17, y - 17, 34, 34, 8);
  g.lineStyle(2, 0xffffff, 0.95);
  g.strokeRoundedRect(x - 17, y - 17, 34, 34, 8);
  g.fillStyle(0xffffff, 0.95);
  g.fillRect(x + 7, y - 15, 2, 10);
  g.fillRect(x + 3, y - 11, 10, 2);
}

export function burrow(g: G, x: number, y: number, open: boolean) {
  shadow(g, () => g.fillEllipse(x + 2, y + 5, 36, 26));
  g.fillStyle(C.soil, 1);
  g.fillEllipse(x, y + 2, 36, 26);
  g.fillStyle(C.hole, open ? 1 : 0.45);
  g.fillEllipse(x, y + 4, 20, 14);
}

export function cottage(g: G, x: number, y: number) {
  shadow(g, () => g.fillRect(x - 15 + 2, y - 6 + 3, 30, 22));
  g.fillStyle(0xf2e6c9, 1);
  g.fillRect(x - 15, y - 6, 30, 22);
  g.fillStyle(0xc2573f, 1);
  g.fillTriangle(x - 20, y - 4, x, y - 23, x + 20, y - 4);
  g.fillStyle(C.soil, 1);
  g.fillRect(x - 4, y + 4, 8, 12);
  g.fillStyle(0xffe6a0, 1);
  g.fillRect(x + 6, y, 5, 5);
  g.fillRect(x - 11, y, 5, 5);
}

/** A garden trap on the lawn: a honey pot (glowing once sprung) or a bramble snare. */
export function trap(g: G, kind: TrapKind, x: number, y: number, alpha: number, sprung: boolean) {
  if (kind === 'honey') {
    g.fillStyle(C.shadow, 0.22 * alpha);
    g.fillEllipse(x + 2, y + 9, 22, 8);
    if (sprung) {
      g.fillStyle(0xffd24a, 0.35);
      g.fillCircle(x, y, 16);
    }
    g.fillStyle(0xc98a3a, alpha);
    g.fillEllipse(x, y + 2, 20, 18);
    g.fillStyle(0xe0a84e, alpha);
    g.fillRect(x - 7, y - 9, 14, 4);
    g.fillStyle(0xffc23a, alpha);
    g.fillEllipse(x, y - 6, 12, 5);
    g.fillTriangle(x + 3, y - 5, x + 7, y - 5, x + 5, y + 2);
    return;
  }
  // Two crossed thorny bramble loops.
  g.lineStyle(2.4, 0x6b3f2a, alpha);
  g.strokeEllipse(x, y, 26, 14);
  g.strokeEllipse(x, y, 14, 26);
  g.fillStyle(0x3f8a35, alpha);
  for (const [a, b] of [[-11, -2], [10, 3], [2, -11], [-3, 11]]) g.fillTriangle(x + a - 2, y + b, x + a + 2, y + b, x + a, y + b - 4);
}

/** A cabbage from the patch, `r` pixels round. */
export function cabbage(g: G, x: number, y: number, r: number) {
  g.fillStyle(C.shadow, 0.22);
  g.fillCircle(x + 1.5, y + 2, r);
  g.fillStyle(0x5f9e3c, 1);
  g.fillCircle(x, y, r);
  g.fillStyle(0x8fcf5f, 1);
  g.fillCircle(x - r * 0.15, y - r * 0.15, r * 0.65);
  g.fillStyle(0xc4ec9a, 1);
  g.fillCircle(x - r * 0.25, y - r * 0.25, r * 0.3);
}

/** What ails a foe: frost, fire and poison each tint it. */
export interface Ailments {
  chilled: boolean;
  burning: boolean;
  poisoned: boolean;
  /** Sunglass and bonfire heat, 0 to 1. */
  heat: number;
  /** A crowned king. */
  king?: boolean;
}

/** A foe at its middle, facing `angle`. `size` is its radius in pixels. */
export function foe(g: G, kind: FoeKind, x: number, y: number, angle: number, size: number, ails: Ailments) {
  if (kind === 'moth') moth(g, x, y, size);
  else if (kind === 'mole') mole(g, x, y, angle, size);
  else if (kind === 'woodlouse') woodlouse(g, x, y, angle, size);
  else if (kind === 'snail') snail(g, x, y, angle, size);
  else beetle(g, kind, x, y, angle, size, ails.chilled);
  if (ails.king) crown(g, x, y - size - 4, Math.max(6, size * 0.5));
  if (ails.heat > 0.05) {
    // A warm glow that turns bright once the foe is fully heated.
    g.lineStyle(ails.heat >= 1 ? 2.5 : 1.5, ails.heat >= 1 ? 0xffd24a : 0xff8a2a, 0.35 + 0.5 * ails.heat);
    g.strokeCircle(x, y, size * 1.25);
  }
  if (ails.poisoned) {
    g.fillStyle(0x8fd14f, 0.4);
    g.fillCircle(x, y, size * 1.15);
  }
  if (ails.burning) {
    g.fillStyle(0xff8a2a, 0.9);
    g.fillTriangle(x - 4, y - size, x - 1, y - size - 7, x + 2, y - size);
    g.fillStyle(0xffd24a, 0.9);
    g.fillTriangle(x + 1, y - size, x + 4, y - size - 5, x + 6, y - size);
  }
}

function beetle(g: G, kind: FoeKind, x: number, y: number, angle: number, size: number, chilled: boolean) {
  const r = size;
  g.save();
  g.translateCanvas(x, y);
  g.rotateCanvas(angle);
  g.lineStyle(kind === 'queen' ? 2 : 1.2, 0x2d3b1f, 1);
  for (const s of [-1, 1]) for (const k of [-0.5, 0.1, 0.6]) g.lineBetween(k * r, s * r * 0.6, k * r + 3, s * (r + 4));
  g.fillStyle(C.shadow, 0.22);
  g.fillEllipse(2, 3, r * 2, r * 1.7);
  g.fillStyle(FOE_COLOUR[kind], 1);
  g.fillEllipse(0, 0, r * 2, r * 1.7);
  g.lineStyle(1, 0x000000, 0.4);
  g.lineBetween(-r, 0, r * 0.6, 0);
  if (kind === 'stag') {
    // A waxy shine across its back.
    g.fillStyle(0xffffff, 0.35);
    g.fillEllipse(-r * 0.2, -r * 0.35, r * 0.9, r * 0.35);
  }
  if (kind === 'ladybird') {
    g.fillStyle(0x1d1d22, 1);
    for (const [a, b] of [[-3, -3], [-2, 3], [3, -2], [2, 4]]) g.fillCircle(a, b, 1.5);
  }
  if (kind === 'ember') {
    // Glowing spots: fire can't hurt it.
    g.fillStyle(0xffb04a, 1);
    for (const [a, b] of [[-0.4, -0.3], [-0.4, 0.3], [0.2, 0]]) g.fillCircle(r * a, r * b, r * 0.18);
  }
  if (kind === 'earwig') {
    // A long body with pincers at the back.
    g.lineStyle(2, 0x3b2413, 1);
    g.lineBetween(-r, -2, -r * 1.7, -4);
    g.lineBetween(-r, 2, -r * 1.7, 4);
  }
  if (kind === 'weevil') {
    // Armour plates across its back, and a long snout.
    g.lineStyle(1.4, 0x4f4232, 1);
    for (const k of [-0.45, 0, 0.45]) g.lineBetween(k * r, -r * 0.8, k * r, r * 0.8);
    g.lineStyle(2.4, 0x1d1d22, 1);
    g.lineBetween(r * 1.1, 0, r * 1.9, 0);
  }
  if (kind === 'queen') {
    g.fillStyle(C.gold, 1);
    g.fillTriangle(-r * 0.2, -r * 0.5, r * 0.1, -r * 0.1, -r * 0.5, -r * 0.1);
    g.fillTriangle(-r * 0.2, r * 0.5, r * 0.1, r * 0.1, -r * 0.5, r * 0.1);
  }
  g.fillStyle(0x1d1d22, 1);
  g.fillCircle(r * 0.85, 0, r * 0.42);
  if (kind === 'stag' || kind === 'queen') {
    g.lineStyle(2.5, 0x1d1d22, 1);
    g.lineBetween(r * 1.1, -3, r * 1.6, -6);
    g.lineBetween(r * 1.1, 3, r * 1.6, 6);
  }
  if (chilled) {
    g.fillStyle(C.frost, 0.45);
    g.fillEllipse(0, 0, r * 2.2, r * 1.9);
  }
  g.restore();
}

/** A gold crown above a king. */
function crown(g: G, x: number, y: number, w: number) {
  g.fillStyle(C.gold, 1);
  g.fillRect(x - w, y - w * 0.3, w * 2, w * 0.6);
  for (const k of [-1, 0, 1]) g.fillTriangle(x + k * w * 0.8 - w * 0.3, y - w * 0.3, x + k * w * 0.8, y - w * 1.1, x + k * w * 0.8 + w * 0.3, y - w * 0.3);
}

function woodlouse(g: G, x: number, y: number, angle: number, size: number) {
  g.save();
  g.translateCanvas(x, y);
  g.rotateCanvas(angle);
  g.fillStyle(C.shadow, 0.22);
  g.fillEllipse(2, 3, size * 2.2, size * 1.6);
  g.fillStyle(FOE_COLOUR.woodlouse, 1);
  g.fillEllipse(0, 0, size * 2.2, size * 1.6);
  // Its banded plates.
  g.lineStyle(1.2, 0x5f646d, 1);
  for (const k of [-0.6, -0.2, 0.2, 0.6]) g.lineBetween(size * k, -size * 0.75, size * k, size * 0.75);
  g.lineStyle(1, 0x2d3b1f, 1);
  g.lineBetween(size * 1.05, -2, size * 1.45, -5);
  g.lineBetween(size * 1.05, 2, size * 1.45, 5);
  g.restore();
}

function snail(g: G, x: number, y: number, angle: number, size: number) {
  g.save();
  g.translateCanvas(x, y);
  g.rotateCanvas(angle);
  g.fillStyle(C.shadow, 0.22);
  g.fillEllipse(2, 3, size * 2.4, size * 1.2);
  // Its soft body, then the spiral shell on top.
  g.fillStyle(0xb8c48a, 1);
  g.fillEllipse(size * 0.2, 0, size * 2.4, size * 0.9);
  g.lineStyle(1, 0x6f7a4a, 1);
  g.lineBetween(size * 1.2, -2, size * 1.6, -5);
  g.lineBetween(size * 1.2, 2, size * 1.6, 5);
  g.fillStyle(FOE_COLOUR.snail, 1);
  g.fillCircle(-size * 0.2, 0, size * 0.85);
  g.lineStyle(1.4, 0x8a6a3a, 1);
  g.beginPath();
  g.arc(-size * 0.2, 0, size * 0.55, 0, Math.PI * 1.5);
  g.strokePath();
  g.beginPath();
  g.arc(-size * 0.2, 0, size * 0.25, 0, Math.PI * 1.5);
  g.strokePath();
  g.restore();
}

function moth(g: G, x: number, y: number, size: number) {
  const s = size / 9;
  // Its shadow falls well below it: it is flying.
  g.fillStyle(0x000000, 0.18);
  g.fillEllipse(x + 4, y + 16, 24 * s, 8 * s);
  g.fillStyle(C.moth, 1);
  g.fillEllipse(x - 7 * s, y - 2 * s, 16 * s, 12 * s);
  g.fillEllipse(x + 7 * s, y - 2 * s, 16 * s, 12 * s);
  g.fillStyle(C.mothDark, 1);
  g.fillEllipse(x - 5 * s, y + 5 * s, 10 * s, 8 * s);
  g.fillEllipse(x + 5 * s, y + 5 * s, 10 * s, 8 * s);
  g.fillStyle(0x5a4870, 1);
  g.fillEllipse(x, y + s, 5 * s, 16 * s);
}

function mole(g: G, x: number, y: number, angle: number, size: number) {
  g.save();
  g.translateCanvas(x, y);
  g.rotateCanvas(angle);
  g.fillStyle(C.shadow, 0.22);
  g.fillEllipse(2, 3, size * 2.2, size * 1.8);
  g.fillStyle(0x4a3a33, 1);
  g.fillEllipse(0, 0, size * 2.2, size * 1.8);
  // Its hairy coat.
  g.fillStyle(0x6b574c, 1);
  for (const [a, b] of [[-0.6, -0.4], [-0.2, 0.5], [0.1, -0.6], [-0.7, 0.3], [0.3, 0.2]]) g.fillCircle(size * a, size * b, 1.4);
  g.fillStyle(0xf2a7b5, 1);
  g.fillEllipse(size * 1.05, 0, size * 0.6, size * 0.5);
  g.fillEllipse(size * 0.4, -size * 0.85, size * 0.6, size * 0.4);
  g.fillEllipse(size * 0.4, size * 0.85, size * 0.6, size * 0.4);
  g.fillStyle(0x111111, 1);
  g.fillCircle(size * 0.55, -size * 0.3, 1.3);
  g.fillCircle(size * 0.55, size * 0.3, 1.3);
  g.restore();
}

export function healthBar(g: G, x: number, y: number, share: number) {
  g.fillStyle(0x000000, 0.45);
  g.fillRect(x - 10, y, 20, 4);
  g.fillStyle(C.health, 1);
  g.fillRect(x - 10, y, 20 * Math.max(0, share), 4);
}

/** A dotted line through points, for the routes. */
export function dotted(g: G, pts: { x: number; y: number }[], colour: number, alpha: number, dot = 2.4, gap = 10) {
  g.fillStyle(colour, alpha);
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    let d = carry;
    for (; d < len; d += gap) g.fillCircle(a.x + ((b.x - a.x) * d) / len, a.y + ((b.y - a.y) * d) / len, dot);
    carry = d - len;
  }
}

/** A dashed circle, for a tower's reach. */
export function dashedCircle(g: G, x: number, y: number, r: number, colour: number, alpha: number) {
  const n = Math.max(12, Math.round(r / 5));
  g.lineStyle(2, colour, alpha);
  for (let i = 0; i < n; i += 2) {
    g.beginPath();
    g.arc(x, y, r, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2);
    g.strokePath();
  }
}

/** The orange no-entry ring on a tile that can't be planted: a circle with a slash, never a cross. */
export function noEntry(g: G, x: number, y: number) {
  g.lineStyle(3, C.warn, 1);
  g.strokeRect(x - 18, y - 18, 36, 36);
  g.strokeCircle(x, y, 10);
  g.lineBetween(x - 7, y + 7, x + 7, y - 7);
}
