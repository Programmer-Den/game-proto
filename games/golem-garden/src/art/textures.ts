import Phaser from 'phaser';
import { GARDENS, GRID, cellCentre, pathPoint, type Garden } from '../game/board';
import { GOLEMS } from '../game/data';
import { BUTTON, GARDEN_CARD, GOLEM_MENU, GRAFT_CARD, HUD, PANEL, PREVIEW, SEED_BUTTONS, SPEED_BUTTON, WAVE_BUTTON } from '../scenes/layout';
import { C, E, PI, Pp, R, addSharp, bake, blur, ctx, drop, ellipse, flower, golem, pest, reseed, rnd, sprout, type ClayOptions } from './clay';

// Every texture, painted in clay at startup. Sizes and anchors are in view pixels; painters work in
// art units (2 per view pixel) around their anchor.
//
// table           the studio table over the whole view, with the HUD strip and its tags across its
//                 top; baked at the view's size, again when the frame moves (see `bakeTable`)
// bg-plot         a drawn plot's static scene, painted again for each plot planted
// bg-<n>          garden n's static scene over the table, in the designed 960x540 frame: the
//                 garden slab with its pressed paths and soil beds, the side panel and the wave
//                 preview's dark pad (transparent where the table shows)
// edge            the table from the view's left edge to the board, drawn over pests coming in
// tree            the Heartwood without its flowers; bud and bloom are its flowers
// golem-<kind>    a golem standing, anchored at its feet
// sprout          a seed growing, anchored at its mound's foot
// pest-<kind>     a pest facing right, anchored where it stands on the path (the queen is bigger)
// mound           the heap of earth over a mole tunnelling under the path
// slime           the Queen Slug's slime on a cell
// slow            the moss clumps over a slowed pest
// spores          a fungus golem's patch of spores on the path, 32 view pixels round
// shot-<kind>     a thrown pellet; shot-bell is a bell golem's ring, 50 view pixels round
// sap, glow       a sap drop and the glow behind the sap counter
// splat           what a squashed pest leaves on the path
// leaf            the Heartwood's leaf in the HUD
// hedge           a hedge planted on a path cell, anchored at its foot
// card-<h>[-dim]  a seed card, h 44 (a golem's) or 36 (the hedge strip) view pixels tall; rim-<h> is the gold rim of the picked one
// card-locked     a golem's card before it unlocks (Thorn, Fungus, Bell), with its padlock
// btn-wave[-off]  the wave button, lit or waiting; btn is the overlays' button
// menu, chip[-off] the golem menu's slab and its buttons (Raise, Aim, Move, Uproot, the forms), usable or not
// speed[-on]      the speed button in the HUD, off or on
// pill            the garden tag under the title, which opens the garden picker
// gcard[-rim|-locked] a garden card in the garden picker, its gold rim, and a locked one
// graft[-rim|-dim] a golem graft's card, its gold rim once bought, and one with no laurel to buy it

const A = 2; // art units per view pixel
const G = { x: GRID.x * A, y: GRID.y * A, cell: GRID.cell * A, cols: GRID.cols, rows: GRID.rows };
const W = 960 * A;
const H = 540 * A;
const cc = (col: number, row: number) => {
  const p = cellCentre(col, row);
  return { x: p.x * A, y: p.y * A };
};
const shade = { print: false, sb: 2, sx: 2, sy: 2, rim: 2 } satisfies ClayOptions;

/** Garden n's background texture key; baked the first time a garden is planted (see `bakeGarden`). */
export const gardenBg = (n: number) => `bg-${n}`;

/** Bakes garden n's background, unless it is baked already. */
export function bakeGarden(scene: Phaser.Scene, n: number) {
  bake(scene, gardenBg(n), 960, 540, () => paintBackground(GARDENS[n]));
}

/** Bakes a drawn plot's background as `bg-plot`, afresh (each plot planted may differ). */
export function bakePlot(scene: Phaser.Scene, garden: Garden) {
  if (scene.textures.exists('bg-plot')) scene.textures.remove('bg-plot');
  bake(scene, 'bg-plot', 960, 540, () => paintBackground(garden));
  return 'bg-plot';
}

/** The view size and frame offset the table was last painted for. */
let tableFor = '';

/**
 * Bakes the table and the HUD strip for a view of `w` x `h` with the designed frame at (fx, fy),
 * and the edge that hides pests coming in, unless they are baked already for that view and frame
 * (the view never changes, but the frame moves off the corner buttons; see `GameScene.relayout`).
 */
export function bakeTable(scene: Phaser.Scene, w: number, h: number, fx: number, fy: number) {
  const wanted = `${w}x${h}+${fx},${fy}`;
  if (wanted !== tableFor) {
    for (const key of ['table', 'edge']) if (scene.textures.exists(key)) scene.textures.remove(key);
    tableFor = wanted;
  }
  const table = bake(scene, 'table', w, h, () => paintTable(w, h, fx, fy));
  if (table) {
    const edge = document.createElement('canvas');
    const res = table.width / w;
    edge.width = Math.round((fx + GRID.x - 3) * res);
    edge.height = table.height;
    edge.getContext('2d')!.drawImage(table, 0, 0);
    addSharp(scene, 'edge', edge, res);
  }
}

export function bakeTextures(scene: Phaser.Scene) {
  bake(scene, gardenBg(0), 960, 540, () => paintBackground(GARDENS[0]));

  bake(scene, 'tree', 130, 120, paintTree, 65, 70);
  bake(scene, 'bud', 28, 28, () => flower(0, 0, 1.05, false), 14, 14);
  bake(scene, 'bloom', 28, 28, () => flower(0, 0, 1.05, true), 14, 14);

  for (const kind of GOLEMS) {
    reseed(kind.length * 11);
    bake(scene, `golem-${kind}`, 100, 88, () => golem(0, 0, kind), 50, 78);
  }
  bake(scene, 'sprout', 70, 50, () => sprout(0, 0), 35, 40);
  bake(scene, 'hedge', 70, 64, paintHedge, 35, 54);
  for (const kind of ['beetle', 'slug', 'crow', 'mole', 'snail', 'aphid'] as const) bake(scene, `pest-${kind}`, 100, 60, () => pest(kind), 50, 34);
  bake(scene, 'pest-queen', 160, 90, () => pest('queen'), 84, 62);
  bake(scene, 'mound', 70, 36, paintMound, 35, 26);
  bake(scene, 'slime', 64, 64, paintSlime, 32, 32);
  bake(scene, 'slow', 50, 22, () => {
    for (let k = -1; k <= 1; k++) E(k * 18, k ? 0 : -6, 8, 6, '#8cd05a', shade);
  }, 25, 13);

  bake(scene, 'shot-pebble', 20, 20, () => E(0, 0, 12, 11, '#a8a49a', { print: false, sb: 3, sx: 2, sy: 4, sa: 0.3 }), 10, 10);
  bake(scene, 'shot-moss', 20, 20, () => E(0, 0, 12, 11, '#6fb048', { print: false, sb: 3, sx: 2, sy: 4, sa: 0.3 }), 10, 10);
  bake(scene, 'shot-fungus', 24, 24, () => {
    for (const [x, y, r] of [[-6, 2, 9], [6, 3, 8], [0, -6, 9]] as const) E(x, y, r, r, '#c8a0d8', { print: false, sb: 3, sx: 2, sy: 3, sa: 0.3, rim: 2 });
  }, 12, 12);
  bake(scene, 'shot-bell', 100, 100, () => {
    ctx.strokeStyle = 'rgba(248,232,160,0.9)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 92, 0, PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(242,196,74,0.6)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 80, 0, PI * 2);
    ctx.stroke();
  }, 50, 50);
  bake(scene, 'spores', 64, 64, () => {
    reseed(83);
    ctx.save();
    ctx.globalAlpha = 0.55;
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * PI * 2;
      const d = k % 3 ? 34 : 14;
      E(Math.cos(a) * d, Math.sin(a) * d * 0.8, 18 + rnd() * 8, 14 + rnd() * 6, k % 2 ? '#b088c8' : '#9a70b0', { print: false, shadow: false, rim: 2 });
    }
    ctx.restore();
    for (let k = 0; k < 7; k++) ellipse(-36 + rnd() * 72, -26 + rnd() * 52, 3, 3, 'rgba(248,236,255,0.8)');
  }, 32, 32);
  bake(scene, 'shot-thorn', 20, 20, () => Pp([[-10, 6], [14, -2], [-10, -8]], C.thornSpike, { print: false, sb: 3, rim: 2 }), 10, 10);

  bake(scene, 'sap', 24, 30, () => drop(0, 0, 1), 12, 16);
  bake(scene, 'glow', 64, 64, () => {
    const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 62);
    g.addColorStop(0, 'rgba(255,214,120,0.8)');
    g.addColorStop(1, 'rgba(255,214,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-64, -64, 128, 128);
  }, 32, 32);
  bake(scene, 'splat', 50, 32, () => {
    reseed(40);
    Pp(
      Array.from({ length: 12 }, (_, k) => {
        const a = (k / 12) * PI * 2;
        const r = k % 2 ? 16 : 30 + rnd() * 6;
        return [Math.cos(a) * r, Math.sin(a) * r * 0.45] as [number, number];
      }),
      '#e08a2a',
      { print: false, sb: 3, sx: 2, sy: 3, rim: 3 },
    );
  }, 25, 16);
  bake(scene, 'leaf', 32, 32, paintLeaf, 16, 16);

  for (const h of new Set(SEED_BUTTONS.hs)) {
    const w = SEED_BUTTONS.w * A - 8;
    const ha = h * A - 8;
    bake(scene, `card-${h}`, 150, h + 16, () => R(-w / 2, -ha / 2, w, ha, 22, C.card, { sb: 6, sa: 0.45, rim: 6 }), 75, h / 2 + 6);
    bake(scene, `card-${h}-dim`, 150, h + 16, () => R(-w / 2, -ha / 2, w, ha, 22, '#c4b48f', { sb: 6, sa: 0.45, rim: 6 }), 75, h / 2 + 6);
    bake(scene, `rim-${h}`, 150, h + 16, () => R(-w / 2 - 6, -ha / 2 - 6, w + 12, ha + 12, 26, C.gold, { sb: 6, rim: 6 }), 75, h / 2 + 6);
  }
  bake(scene, 'card-locked', 150, 60, paintLockedCard, 75, 28);
  bake(scene, 'btn-wave', 150, 64, () => R(-WAVE_BUTTON.w, -WAVE_BUTTON.h, WAVE_BUTTON.w * A, WAVE_BUTTON.h * A, 30, '#e0a23a', { sb: 8, sx: 5, sy: 9, rim: 8 }), 72, 28);
  bake(scene, 'btn-wave-off', 150, 64, () => R(-WAVE_BUTTON.w, -WAVE_BUTTON.h, WAVE_BUTTON.w * A, WAVE_BUTTON.h * A, 30, '#9c8a68', { sb: 8, sx: 5, sy: 9, rim: 8 }), 72, 28);
  const { w: mw, h: mh, chip } = GOLEM_MENU;
  bake(scene, 'menu', mw + 16, mh + 16, () => R(-mw, -mh, mw * A, mh * A, 26, C.hud, { sb: 8, sx: 5, sy: 8, rim: 8, spec: false }), mw / 2 + 6, mh / 2 + 6);
  bake(scene, 'chip', chip.w + 12, chip.h + 12, () => R(-chip.w, -chip.h, chip.w * A, chip.h * A, 18, C.card, { sb: 4, sx: 3, sy: 5, rim: 5 }), chip.w / 2 + 5, chip.h / 2 + 5);
  bake(scene, 'chip-off', chip.w + 12, chip.h + 12, () => R(-chip.w, -chip.h, chip.w * A, chip.h * A, 18, '#9c9078', { sb: 4, sx: 3, sy: 5, rim: 5 }), chip.w / 2 + 5, chip.h / 2 + 5);
  for (const on of [false, true]) bake(scene, on ? 'speed-on' : 'speed', SPEED_BUTTON.w + 12, SPEED_BUTTON.h + 12, () => paintSpeed(on), SPEED_BUTTON.w / 2 + 5, SPEED_BUTTON.h / 2 + 5);
  bake(scene, 'pill', HUD.garden.w + 12, HUD.garden.h + 10, () => R(-HUD.garden.w, -HUD.garden.h, HUD.garden.w * A, HUD.garden.h * A, 14, C.tag, { sb: 3, sx: 2, sy: 4, rim: 4, print: false }), HUD.garden.w / 2 + 5, HUD.garden.h / 2 + 4);
  const { w: gw, h: gh } = GARDEN_CARD;
  bake(scene, 'gcard', gw + 16, gh + 16, () => R(-gw, -gh, gw * A, gh * A, 26, C.card, { sb: 8, sa: 0.5, rim: 7 }), gw / 2 + 6, gh / 2 + 6);
  bake(scene, 'gcard-locked', gw + 16, gh + 16, () => R(-gw, -gh, gw * A, gh * A, 26, '#a89c84', { sb: 8, sa: 0.5, rim: 7 }), gw / 2 + 6, gh / 2 + 6);
  bake(scene, 'gcard-rim', gw + 24, gh + 24, () => R(-gw - 8, -gh - 8, gw * A + 16, gh * A + 16, 32, C.gold, { sb: 8, rim: 7 }), gw / 2 + 10, gh / 2 + 10);
  const gfw = GRAFT_CARD.w;
  bake(scene, 'graft', gfw + 16, gh + 16, () => R(-gfw, -gh, gfw * A, gh * A, 26, C.card, { sb: 8, sa: 0.5, rim: 7 }), gfw / 2 + 6, gh / 2 + 6);
  bake(scene, 'graft-dim', gfw + 16, gh + 16, () => R(-gfw, -gh, gfw * A, gh * A, 26, '#a89c84', { sb: 8, sa: 0.5, rim: 7 }), gfw / 2 + 6, gh / 2 + 6);
  bake(scene, 'graft-rim', gfw + 24, gh + 24, () => R(-gfw - 8, -gh - 8, gfw * A + 16, gh * A + 16, 32, C.gold, { sb: 8, rim: 7 }), gfw / 2 + 10, gh / 2 + 10);
  bake(scene, 'btn', BUTTON.w + 16, BUTTON.h + 16, () => R(-BUTTON.w, -BUTTON.h, BUTTON.w * A, BUTTON.h * A, 30, '#e0a23a', { sb: 8, sx: 5, sy: 9, rim: 8 }), BUTTON.w / 2 + 6, BUTTON.h / 2 + 6);
}

/** A hedge: a clump of clay bushes on a strip of soil, with a few lighter leaves pressed on. */
function paintHedge() {
  reseed(23);
  E(0, 0, 56, 12, C.soil, { sb: 4, sx: 3, sy: 4, rim: 3 });
  for (const [x, y, r] of [[-34, -16, 20], [34, -18, 19], [-12, -34, 22], [16, -30, 23], [0, -12, 24]] as const) {
    E(x, y, r, r * 0.85, rnd() < 0.5 ? '#3f7a2c' : '#4a8a34', { sb: 4, sx: 3, sy: 5, rim: 3 });
  }
  for (let k = 0; k < 9; k++) {
    const a = rnd() * PI * 2;
    E(-30 + rnd() * 60, -44 + rnd() * 30, 7, 3.5, '#8cd05a', { rot: a, print: false, sb: 2 });
  }
}

/** A heap of crumbly earth, the mole's tunnel showing above it. */
function paintMound() {
  reseed(61);
  Pp([[-44, 14], [-30, -12], [-6, -26], [18, -22], [40, -4], [46, 14]], '#7a4c2c', { sb: 4, sx: 3, sy: 5, rim: 4 });
  for (let k = 0; k < 7; k++) E(-34 + k * 11 + rnd() * 4, 10 - rnd() * 22, 5 + rnd() * 3, 4 + rnd() * 2, k % 2 ? '#8e5c36' : '#5e3a20', { print: false, sb: 2, sx: 1, sy: 2, rim: 1.5 });
}

/** The Queen Slug's slime: a glossy yellow-green smear. */
function paintSlime() {
  reseed(71);
  ctx.save();
  ctx.globalAlpha = 0.7;
  Pp(
    Array.from({ length: 10 }, (_, k) => {
      const a = (k / 10) * PI * 2;
      const r = k % 2 ? 40 : 54 + rnd() * 8;
      return [Math.cos(a) * r, Math.sin(a) * r * 0.8] as [number, number];
    }),
    '#c8dc6a',
    { print: false, shadow: false, rim: 3 },
  );
  ctx.restore();
  ellipse(-16, -14, 12, 6, 'rgba(255,255,230,0.55)', -0.5);
  ellipse(18, 12, 6, 4, 'rgba(255,255,230,0.45)', -0.5);
}

/** The speed button: two pressed play triangles on a clay tag, gold when the game runs fast. */
function paintSpeed(on: boolean) {
  const { w, h } = SPEED_BUTTON;
  R(-w, -h, w * A, h * A, 18, on ? C.gold : C.tag, { sb: 4, sx: 3, sy: 5, rim: 5 });
  for (const dx of [-36, -20]) Pp([[dx - 8, -12], [dx + 10, 0], [dx - 8, 12]], on ? '#8a4a10' : '#7a5a34', { print: false, shadow: false, rim: 1.5 });
}

function paintLeaf() {
  Pp([[-22, 20], [-12, -12], [18, -24], [22, 4], [-2, 24]], '#4ea548', { print: false, sb: 3, rim: 3 });
  ctx.strokeStyle = 'rgba(20,60,20,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-18, 22);
  ctx.lineTo(16, -18);
  ctx.stroke();
}

function paintTree() {
  Pp([[-40, 56], [-16, 30], [-12, -20], [12, -20], [16, 30], [44, 56]], '#8a5530', { sb: 8 });
  reseed(31);
  for (const [dx, dy, rx, ry, col] of [
    [-40, -30, 42, 36, '#3e8c3e'],
    [38, -32, 40, 34, '#45963f'],
    [0, -66, 50, 38, '#4ea548'],
    [-2, -22, 52, 38, '#57b04e'],
  ] as const) {
    E(dx, dy, rx, ry, col, { sb: 10 });
  }
}

/** Where the Heartwood's five flowers sit, in view pixels from its cell's centre. */
export const TREE_FLOWERS: readonly [number, number][] = [
  [-26, -20],
  [-7, -41],
  [15, -25],
  [26, -10],
  [-10, -6],
];

function paintLockedCard() {
  const w = SEED_BUTTONS.w * A - 8;
  const h = SEED_BUTTONS.hs[0] * A - 8;
  const x = -w / 2;
  const y = -h / 2;
  R(x, y, w, h, 22, '#b9ad94', { sb: 6, rim: 6 });
  // The padlock on a burst, sized for a 52-pixel card and shrunk to fit this one.
  ctx.save();
  ctx.translate(x + 50, 0);
  ctx.scale(0.72, 0.72);
  ctx.save();
  ctx.globalAlpha = 0.6;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * PI * 2;
    Pp(
      [
        [Math.cos(a - 0.25) * 26, Math.sin(a - 0.25) * 30],
        [Math.cos(a) * 46, Math.sin(a) * 50],
        [Math.cos(a + 0.25) * 26, Math.sin(a + 0.25) * 30],
      ],
      '#6a5a40',
      { print: false, shadow: false, rim: 2 },
    );
  }
  E(0, 0, 32, 36, '#7a6a4c', { shadow: false });
  ctx.restore();
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#9a7a2a';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(0, -6, 12, PI, 0);
  ctx.stroke();
  R(-18, -6, 36, 28, 8, C.gold, { sb: 3, print: false, rim: 3 });
  ellipse(0, 7, 4, 4, '#6a4a10');
  ctx.restore();
}

/** The studio table over a `w` x `h` view, its designed frame at (fx, fy), with the HUD strip across the top. */
function paintTable(w: number, h: number, fx: number, fy: number) {
  const [tw, th, ox, oy] = [w * A, h * A, fx * A, fy * A];
  // Warm wood with a vignette, centred on the frame and grown with the view.
  ctx.fillStyle = C.table;
  ctx.fillRect(0, 0, tw, th);
  reseed(3);
  for (let i = 0; i < Math.round((60 * th) / H); i++) {
    ctx.strokeStyle = `rgba(${rnd() < 0.5 ? '255,220,170' : '20,10,4'},0.06)`;
    ctx.lineWidth = 2 + rnd() * 6;
    ctx.beginPath();
    const y = rnd() * th;
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(tw * 0.31, y + rnd() * 40 - 20, tw * 0.68, y + rnd() * 40 - 20, tw, y + rnd() * 30 - 15);
    ctx.stroke();
  }
  const grow = Math.max(w / 960, h / 540);
  const vg = ctx.createRadialGradient(ox + W * 0.4, oy + H * 0.4, 300 * grow, tw / 2, th / 2, 1200 * grow);
  vg.addColorStop(0, 'rgba(255,200,140,0.12)');
  vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, tw, th);

  // The HUD: a strip of rolled clay across the view's top, with tags pressed on over the frame.
  ctx.save();
  ctx.filter = blur(10);
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 100, tw, 18);
  ctx.restore();
  R(-20, -30, tw + 40, 136, 30, C.hud, { shadow: false, rim: 10, spec: false, print: false });
  const tag = (x: number, w: number, col = C.tag) => R(ox + x * A, 28, w * A, 72, 30, col, { sb: 5, sx: 4, sy: 6, rim: 6 });
  tag(HUD.wave.x, HUD.wave.w);
  tag(HUD.leaf.x, HUD.leaf.w);
  tag(HUD.sap.x, HUD.sap.w);
  tag(HUD.bloom.x, HUD.bloom.w, '#d8e6b0');
}

function paintBackground(garden: Garden) {
  const routes = garden.routes.map((r) => r.points.map((p) => ({ x: p.x * A, y: p.y * A })));
  // The garden slab.
  const bx = G.x;
  const by = G.y;
  const bw = G.cols * G.cell;
  const bh = G.rows * G.cell;
  R(bx - 6, by - 6, bw + 12, bh + 12, 34, C.grass, { sb: 18, sa: 0.6, sx: 14, sy: 18, rim: 14, spec: false, print: false });
  reseed(5);
  for (let i = 0; i < 900; i++) {
    const x = bx + 10 + rnd() * (bw - 20);
    const y = by + 10 + rnd() * (bh - 20);
    const r = 4 + rnd() * 7;
    ellipse(x, y, r, r * 0.7, rnd() < 0.5 ? 'rgba(255,255,220,0.10)' : 'rgba(20,50,10,0.12)', rnd() * PI);
  }

  // The path: a flattened ribbon of tan clay.
  const pathLine = () => {
    ctx.beginPath();
    for (const pts of routes) {
      ctx.moveTo(G.x - 6, pts[0].y);
      pts.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    }
  };
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'butt';
  ctx.save();
  ctx.filter = blur(6);
  ctx.translate(6, 8);
  pathLine();
  ctx.strokeStyle = 'rgba(20,40,10,0.55)';
  ctx.lineWidth = 122;
  ctx.stroke();
  ctx.restore();
  pathLine();
  ctx.strokeStyle = '#b8935e';
  ctx.lineWidth = 120;
  ctx.stroke();
  pathLine();
  ctx.strokeStyle = C.path;
  ctx.lineWidth = 108;
  ctx.stroke();
  ctx.save();
  ctx.filter = blur(10);
  ctx.translate(-6, -6);
  pathLine();
  ctx.strokeStyle = 'rgba(255,240,200,0.35)';
  ctx.lineWidth = 56;
  ctx.stroke();
  ctx.restore();
  ctx.restore();
  // Pressed tool marks along the path.
  reseed(8);
  for (const route of garden.routes) {
    for (let d = 20; d < route.length - 6; d += 22) {
      const p = pathPoint(route, d);
      const q = pathPoint(route, d + 1);
      const along = Math.abs(q.x - p.x) > Math.abs(q.y - p.y);
      const ox = (rnd() - 0.5) * 80;
      const oy = (rnd() - 0.5) * 80;
      const x = along ? p.x * A : p.x * A + ox;
      const y = along ? p.y * A + oy : p.y * A;
      if (x < G.x + 8) continue;
      ellipse(x + 1.5, y + 1.5, 5, 3, 'rgba(255,240,200,0.35)');
      ellipse(x, y, 5, 3, 'rgba(90,60,30,0.35)');
    }
  }
  // Clear left of the board, where pests come in, so the table shows through.
  ctx.clearRect(0, by - 20, G.x - 6, bh + 40);

  // Soil beds: brown clay pads with pressed furrows.
  reseed(12);
  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      if (garden.map[r][c] !== 'soil') continue;
      const { x, y } = cc(c, r);
      const jx = (rnd() - 0.5) * 6;
      const jy = (rnd() - 0.5) * 6;
      R(x - 38 + jx, y - 28 + jy, 76, 54, 18, C.soil, { sb: 4, sa: 0.4, sx: 4, sy: 5, rim: 6 });
      for (let k = 0; k < 3; k++) {
        const fy = y - 14 + k * 14 + jy;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(40,18,6,0.55)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x - 26 + jx, fy);
        ctx.quadraticCurveTo(x + jx, fy + 3, x + 26 + jx, fy);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,220,180,0.25)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 26 + jx, fy + 4);
        ctx.quadraticCurveTo(x + jx, fy + 7, x + 26 + jx, fy + 4);
        ctx.stroke();
      }
    }
  }
  // Little clay grass tufts.
  reseed(14);
  for (let r = 0; r < G.rows; r++) {
    for (let c = 0; c < G.cols; c++) {
      if (garden.map[r][c] !== 'soil' || rnd() < 0.4) continue;
      const x = G.x + c * G.cell + 14 + rnd() * 100;
      const y = G.y + r * G.cell + (rnd() < 0.5 ? 14 : 112);
      for (let k = -1; k <= 1; k++) {
        Pp([[x + k * 7 - 4, y], [x + k * 9, y - 16 - (k === 0 ? 6 : 0)], [x + k * 7 + 4, y]], k ? '#5d9a3a' : '#80c050', {
          shadow: false,
          print: false,
          spec: false,
          rim: 2,
        });
      }
    }
  }

  // The panel: a slab of moss-green clay; the cards are stuck on by the scene.
  R(PANEL.x * A, PANEL.y * A, PANEL.w * A, PANEL.h * A, 28, C.hud, { sb: 16, sa: 0.55, sx: 10, sy: 14, rim: 12, spec: false });
  R(PREVIEW.x * A, PREVIEW.y * A, PREVIEW.w * A, PREVIEW.h * A, 20, '#2f4422', { sb: 4, rim: 6, sa: 0.35 });
}
