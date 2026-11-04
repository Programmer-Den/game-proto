import Phaser from 'phaser';
import { KINDS, type Kind } from '../game/kinds';
import type { Tile } from '../game/board';
import type { PotionId } from '../game/orders';
import { TOOLS, type Tool } from '../game/sim';
import { BOARD, BUTTON, PANEL, TOOL, TRAY, VIEW } from '../scenes/layout';
import { viewSize } from '../../../../shared/scaling';
import { t } from '../i18n';
import {
  ART,
  bake,
  BOTTLE,
  circle,
  coin,
  cornerOrn,
  CREAM,

  ctx,
  doubleRule,
  ell,
  GOLD,
  GOLDD,
  GOLDL,
  goldStar,
  GREEN,
  ingredient,
  leaf,
  line,
  PI,
  poly,
  rrect,
  RUST,
  SEPIA,
  SERIF,
  STAR,
  txt,
  whip,
} from './nouveau';

// Every texture the game draws, baked once at boot. Sizes are in view pixels; the painters work in
// art units (twice that).

export const kindTexture = (kind: Kind, catalyst = false) => (catalyst ? `catalyst-${kind}` : `kind-${kind}`);
/** The texture of a tile on the board: a town's wall, a jar, a resin-held or mouldy tile, a Bloom, a Catalyst or a plain ingredient. */
export const tileTexture = (t: Tile) =>
  t.hole ? 'hole' : t.jar ? `jar-${t.kind}` : t.resin ? `resin-${t.kind}` : t.mould ? `mould-${t.kind}` : t.bloom ? `bloom-${t.kind}` : kindTexture(t.kind, t.catalyst);
export const needTexture = (kind: Kind) => `need-${kind}`;
export const potionTexture = (potion: PotionId) => `potion-${potion}`;
export const toolTexture = (tool: Tool, look: 'on' | 'off' | 'armed') => `tool-${tool}-${look}`;
/** Where the flask texture's anchor (the middle of its bulb) sits, as a Phaser origin. */
export const POTION_ORIGIN = { x: 0.5, y: 108 / 190 };
/** View pixels a tool texture reaches past its button on every side (for the shadow). */
export const TOOL_PAD = 2;

/** The colour of each potion in its flask. */
const BREWS: Record<PotionId, string> = {
  healingDraught: '#6a9a58',
  sleepingTonic: '#5f7fa8',
  mandrakeTincture: '#8fa04e',
  goldenElixir: '#d9a441',
  moonlitPhilter: '#8a6fae',
  amberCordial: '#c47a3a',
  starlightElixir: '#4f8f9a',
  philosophersDraught: '#a8484f',
};

export function bakeTextures(scene: Phaser.Scene) {
  // The wall fills the whole view, whatever the screen's shape; the table sits in its middle.
  const view = viewSize(scene);
  bake(scene, 'wall', view.width, view.height, () => paintWall(view.width * ART, view.height * ART));
  bake(scene, 'table', VIEW.w, VIEW.h, paintTable);
  for (const kind of KINDS) {
    bake(scene, kindTexture(kind), BOARD.cell, BOARD.cell, () => ingredient(kind, 56, 56, 39, 7));
    bake(scene, kindTexture(kind, true), 64, 64, () => paintCatalyst(kind));
    bake(scene, `bloom-${kind}`, 64, 64, () => paintBloom(kind));
    bake(scene, `jar-${kind}`, BOARD.cell, BOARD.cell, () => paintJar(kind));
    bake(scene, `resin-${kind}`, BOARD.cell, BOARD.cell, () => paintResin(kind));
    bake(scene, `mould-${kind}`, BOARD.cell, BOARD.cell, () => paintMould(kind));
    bake(scene, needTexture(kind), 40, 40, () => {
      circle(40, 40, 37, '#f6ecd2', GOLD, 2.5);
      ingredient(kind, 40, 40, 28, 5);
    });
  }
  for (const potion of Object.keys(BREWS) as PotionId[]) bake(scene, potionTexture(potion), 80, 95, () => paintFlask(BREWS[potion]));
  bake(scene, 'coin', 24, 24, () => coin(24, 24, 20));
  bake(scene, 'star-on', 26, 26, () => goldStar(26, 26, 19, true));
  bake(scene, 'star-off', 26, 26, () => goldStar(26, 26, 19, false));
  for (const tool of Object.keys(TOOLS) as Tool[]) {
    for (const look of ['on', 'off', 'armed'] as const) {
      bake(scene, toolTexture(tool, look), TOOL.w + TOOL_PAD * 2, TOOL.h + TOOL_PAD * 2 + 2, () => paintTool(tool, look));
    }
  }
  bake(scene, 'button', BUTTON.w + 4, BUTTON.h + 6, paintButton);
  bake(scene, 'cursor', 70, 70, paintCursor);
  bake(scene, 'band', BOARD.cell * 8 + 2, BOARD.cell + 2, () => paintBand(BOARD.cell * 8, BOARD.cell));
  bake(scene, 'band-col', BOARD.cell + 2, BOARD.cell * 8 + 2, () => paintBand(BOARD.cell, BOARD.cell * 8));
  bake(scene, 'area', BOARD.cell * 3 + 2, BOARD.cell * 3 + 2, () => paintBand(BOARD.cell * 3, BOARD.cell * 3, 'rgba(200,120,140,0.22)'));
  bake(scene, 'sun', 18, 18, () => paintSun(18, 18, '#8a6fae'));
  bake(scene, 'result-card', 400, 236, () => paintCard(800, 472));
  bake(scene, 'map-card', 440, 440, () => paintCard(880, 880));
  bake(scene, 'hole', BOARD.cell, BOARD.cell, paintHole);
}

/** The bottle-green wall with its lily pattern and gold rules, `W` x `H` art units: the whole view. */
function paintWall(W: number, H: number) {
  ctx.fillStyle = GREEN;
  ctx.fillRect(0, 0, W, H);
  // Centred on the table in the middle of the view, as it was on the designed 960x540 view.
  const ox = (W - VIEW.w * ART) / 2;
  const oy = (H - VIEW.h * ART) / 2;
  const vg = ctx.createRadialGradient(ox + 700, oy + 400, 200, ox + 960, oy + 540, 1300 * Math.max(1, W / (VIEW.w * ART), H / (VIEW.h * ART)));
  vg.addColorStop(0, 'rgba(70,110,90,0.35)');
  vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  // A faint lily pattern on the wall.
  ctx.save();
  ctx.globalAlpha = 0.12;
  for (let j = 0; j * 170 < H + 100; j++) {
    for (let i = 0; i * 170 < W + 100; i++) {
      const x = i * 170 + (j % 2) * 85;
      const y = j * 170;
      ctx.beginPath();
      ctx.moveTo(x, y + 80);
      ctx.bezierCurveTo(x + 30, y + 30, x - 30, y - 10, x, y - 50);
      ctx.strokeStyle = GOLDL;
      ctx.lineWidth = 2;
      ctx.stroke();
      poly(leaf(x, y - 50, -PI / 2, 40, 22), null, GOLDL, 2);
      poly(leaf(x + 4, y + 20, -PI / 5, 34, 14), null, GOLDL, 1.5);
    }
  }
  ctx.restore();
  ctx.lineWidth = 2;
  ctx.strokeStyle = GOLD;
  ctx.strokeRect(10, 10, W - 20, H - 20);
  ctx.lineWidth = 1;
  ctx.strokeRect(18, 18, W - 36, H - 36);
}

/** The cream tray with its cells, the rank ribbon and the order label, over the wall. */
function paintTable() {
  // The rank ribbon above the board: its tails and cream band (the scene writes on it).
  {
    const x = 92;
    const y = 14;
    const w = 916;
    const h = 46;
    poly([[x - 14, y + 4], [x + 10, y + 4], [x + 10, y + h - 4], [x - 14, y + h - 4], [x - 4, y + h / 2]], RUST, SEPIA, 2);
    poly([[x + w + 14, y + 4], [x + w - 10, y + 4], [x + w - 10, y + h - 4], [x + w + 14, y + h - 4], [x + w + 4, y + h / 2]], RUST, SEPIA, 2);
    rrect(x, y, w, h, 6);
    ctx.fillStyle = CREAM;
    ctx.fill();
    ctx.strokeStyle = SEPIA;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    rrect(x + 5, y + 5, w - 10, h - 10, 4);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    goldStar(x + 32, y + 23, 14, true);
  }

  // The tray: cream inlay with a gold double rule, corner whiplashes and a cell for every tile.
  {
    const tx = TRAY.x * ART;
    const ty = TRAY.y * ART;
    const tw = TRAY.w * ART;
    const th = TRAY.h * ART;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    rrect(tx, ty, tw, th, 18);
    ctx.fillStyle = '#3a2a1e';
    ctx.fill();
    ctx.restore();
    rrect(tx + 8, ty + 8, tw - 16, th - 16, 12);
    ctx.fillStyle = CREAM;
    ctx.fill();
    doubleRule(tx + 4, ty + 4, tw - 8, th - 8, 16);
    const cell = BOARD.cell * ART;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const x = BOARD.x * ART + c * cell;
        const y = BOARD.y * ART + r * cell;
        rrect(x + 5, y + 5, cell - 10, cell - 10, 14);
        ctx.fillStyle = (r + c) % 2 ? '#eadcb8' : '#f4ead0';
        ctx.fill();
        ctx.strokeStyle = 'rgba(160,120,60,0.55)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    cornerOrn(tx + 2, ty + 2, 1, 1);
    cornerOrn(tx + tw - 2, ty + 2, -1, 1);
    cornerOrn(tx + 2, ty + th - 2, 1, -1);
    cornerOrn(tx + tw - 2, ty + th - 2, -1, -1);
  }

  // The order label: cream card with a double gold rule, corner whiplashes and an arched crest.
  {
    const x = PANEL.x * ART;
    const y = PANEL.y * ART;
    const w = PANEL.w * ART;
    const h = PANEL.h * ART;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    rrect(x, y, w, h, 26);
    ctx.fillStyle = CREAM;
    ctx.fill();
    ctx.restore();
    const pg = ctx.createRadialGradient(x + 300, y + 300, 100, x + 400, y + 500, 700);
    pg.addColorStop(0, 'rgba(255,250,235,0.6)');
    pg.addColorStop(1, 'rgba(200,170,120,0.25)');
    rrect(x, y, w, h, 26);
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.strokeStyle = SEPIA;
    ctx.lineWidth = 4;
    ctx.stroke();
    doubleRule(x + 12, y + 12, w - 24, h - 24, 18);
    cornerOrn(x + 14, y + h - 14, 1, -1);
    cornerOrn(x + w - 14, y + h - 14, -1, -1);
    whip(x + 250, 126, 150, PI, GOLD, 3, -1);
    whip(x + w - 250, 126, 150, 0, GOLD, 3);
    circle(x + 250, 126, 5, GOLD);
    circle(x + w - 250, 126, 5, GOLD);
    // The bench tools heading over the two buttons.
    txt(t('benchTools'), x + w / 2, 762, `italic 700 24px ${SERIF}`, RUST, 'center');
    line(x + 120, 762, x + 300, 762, GOLD, 2);
    line(x + w - 300, 762, x + w - 120, 762, GOLD, 2);
  }
}

/** A Catalyst: a Mucha-style sunburst disc with its ingredient, smaller, in the middle. */
function paintCatalyst(kind: Kind) {
  const x = 64;
  const y = 64;
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * PI * 2;
    const r = k % 2 ? 54 : 61;
    line(x + Math.cos(a) * 38, y + Math.sin(a) * 38, x + Math.cos(a) * r, y + Math.sin(a) * r, GOLDD, 3);
  }
  circle(x, y, 44, '#f6e2a6', SEPIA, 4);
  circle(x, y, 38, null, GOLD, 2);
  ingredient(kind, x, y, 32, 6);
}

/** A Bloom: a rosette of rose petals around a cream disc with its ingredient, smaller, in the middle. */
function paintBloom(kind: Kind) {
  const x = 64;
  const y = 64;
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * PI * 2 - PI / 2;
    poly(leaf(x + Math.cos(a) * 30, y + Math.sin(a) * 30, a, 32, 22), k % 2 ? '#c98a96' : '#dba5ad', SEPIA, 3);
  }
  circle(x, y, 40, '#f6e6dc', SEPIA, 4);
  circle(x, y, 34, null, '#b0606e', 2);
  ingredient(kind, x, y, 29, 6);
}

/** A corked jar of pale glass with its ingredient inside and a twine round the neck. */
function paintJar(kind: Kind) {
  const x = 56;
  const y = 60;
  rrect(x - 38, y - 30, 76, 72, 18);
  ctx.fillStyle = '#dfe8de';
  ctx.fill();
  ctx.strokeStyle = SEPIA;
  ctx.lineWidth = 5;
  ctx.stroke();
  ingredient(kind, x, y + 8, 24, 5);
  // The glass: a pale wash over the ingredient and a highlight down the left.
  rrect(x - 38, y - 30, 76, 72, 18);
  ctx.fillStyle = 'rgba(225,238,230,0.35)';
  ctx.fill();
  line(x - 26, y - 16, x - 26, y + 24, '#fbfdf6', 5);
  rrect(x - 26, y - 44, 52, 16, 5);
  ctx.fillStyle = '#e3d3ad';
  ctx.fill();
  ctx.strokeStyle = SEPIA;
  ctx.lineWidth = 4;
  ctx.stroke();
  rrect(x - 18, y - 56, 36, 16, 5);
  ctx.fillStyle = '#a0683c';
  ctx.fill();
  ctx.stroke();
  line(x - 24, y - 36, x + 24, y - 36, RUST, 3);
}

/** An ingredient caught in amber resin: a glossy drip-edged coat over it. */
function paintResin(kind: Kind) {
  const x = 56;
  const y = 56;
  ingredient(kind, x, y, 36, 7);
  ctx.beginPath();
  ctx.moveTo(x - 42, y - 30);
  ctx.quadraticCurveTo(x - 42, y - 44, x - 28, y - 44);
  ctx.lineTo(x + 28, y - 44);
  ctx.quadraticCurveTo(x + 42, y - 44, x + 42, y - 30);
  ctx.lineTo(x + 42, y + 22);
  ctx.quadraticCurveTo(x + 40, y + 42, x + 30, y + 30);
  ctx.quadraticCurveTo(x + 18, y + 48, x + 8, y + 32);
  ctx.quadraticCurveTo(x - 6, y + 44, x - 16, y + 34);
  ctx.quadraticCurveTo(x - 30, y + 46, x - 42, y + 26);
  ctx.closePath();
  ctx.fillStyle = 'rgba(214,140,48,0.42)';
  ctx.fill();
  ctx.strokeStyle = GOLDD;
  ctx.lineWidth = 3.5;
  ctx.stroke();
  line(x - 30, y - 32, x - 8, y - 36, '#fff3d0', 4);
  circle(x + 28, y - 26, 4, '#fff3d0');
}

/** An ingredient under creeping mould: a grey-green fuzzy growth of spots with pale tufts over it. */
function paintMould(kind: Kind) {
  const x = 56;
  const y = 56;
  ingredient(kind, x, y, 36, 7);
  // The growth: a lumpy, translucent patch that leaves the ingredient's edges showing.
  const lumps: [number, number, number][] = [
    [-20, -18, 26], [14, -24, 22], [24, 6, 24], [-24, 14, 22], [0, 4, 30], [10, 28, 22], [-14, 30, 20],
  ];
  ctx.save();
  ctx.globalAlpha = 0.55;
  for (const [dx, dy, r] of lumps) circle(x + dx, y + dy, r, '#5f7452');
  ctx.restore();
  const spots: [number, number, number][] = [
    [-22, -20, 12], [8, -28, 9], [26, -6, 11], [-28, 10, 9], [-4, 4, 14], [22, 20, 10], [-16, 28, 11], [10, 32, 8],
  ];
  for (const [dx, dy, r] of spots) {
    circle(x + dx, y + dy, r, '#7d9a67', SEPIA, 2.5);
    circle(x + dx - r * 0.3, y + dy - r * 0.3, r * 0.38, '#b6ca9c');
  }
  for (const [dx, dy] of [[-10, -6], [14, 4], [-2, 20], [18, -20], [-26, 24], [30, 30]] as const) circle(x + dx, y + dy, 2.5, '#eef0d6');
}

/** A round flask with a cork, half full, and a label ribbon the scene writes the order number on. */
function paintFlask(brew: string) {
  const x = 80;
  const y = 108;
  ctx.beginPath();
  ctx.arc(x, y + 14, 56, -PI * 0.38, PI * 1.38);
  ctx.lineTo(x - 18, y - 70);
  ctx.lineTo(x + 18, y - 70);
  ctx.closePath();
  ctx.fillStyle = '#e8eee4';
  ctx.fill();
  ctx.strokeStyle = SEPIA;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(x - 70, y + 2);
  ctx.bezierCurveTo(x - 30, y - 14, x + 20, y + 16, x + 70, y - 4);
  ctx.lineTo(x + 70, y + 90);
  ctx.lineTo(x - 70, y + 90);
  ctx.closePath();
  ctx.fillStyle = brew;
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.arc(x - 18, y + 4, 34, PI * 1.05, PI * 1.45);
  ctx.strokeStyle = '#fffbe8';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.stroke();
  rrect(x - 16, y - 98, 32, 30, 6);
  ctx.fillStyle = '#a0683c';
  ctx.fill();
  ctx.strokeStyle = SEPIA;
  ctx.lineWidth = 4;
  ctx.stroke();
  poly([[x - 62, y + 26], [x + 62, y + 26], [x + 56, y + 50], [x - 56, y + 50]], CREAM, SEPIA, 3);
}

/** A bench tool: a small bottle-green cartouche with its icon, name and price. */
function paintTool(tool: Tool, look: 'on' | 'off' | 'armed') {
  const pad = TOOL_PAD * ART;
  const x = pad;
  const y = pad;
  const w = TOOL.w * ART;
  const h = TOOL.h * ART;
  const fill = look === 'off' ? '#6f6c5c' : look === 'armed' ? '#8a6420' : BOTTLE;
  ctx.save();
  ctx.shadowColor = 'rgba(60,30,10,0.3)';
  ctx.shadowOffsetY = 4;
  ctx.shadowBlur = 6;
  rrect(x, y, w, h, 22);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = SEPIA;
  ctx.lineWidth = 3;
  ctx.stroke();
  rrect(x + 5, y + 5, w - 10, h - 10, 17);
  ctx.strokeStyle = look === 'off' ? '#a8a28a' : GOLDL;
  ctx.lineWidth = look === 'armed' ? 3 : 1.5;
  ctx.stroke();
  const ix = x + 33;
  const iy = y + h / 2;
  circle(ix, iy, 24, look === 'off' ? '#d8d0b8' : CREAM, SEPIA, 3);
  if (tool === 'stir') {
    ctx.save();
    ctx.translate(ix, iy);
    ctx.rotate(-PI / 4);
    poly([[-2, -2.5], [19, -2.5], [19, 2.5], [-2, 2.5]], '#c98f62', SEPIA, 2);
    poly(ell(-9, 0, 10, 6.5, 0, 14), '#d9a86c', SEPIA, 2.5);
    ctx.restore();
  } else if (tool === 'sift') {
    circle(ix, iy, 16, '#d8cfb4', SEPIA, 2.5);
    ctx.save();
    ctx.beginPath();
    ctx.arc(ix, iy, 13, 0, PI * 2);
    ctx.clip();
    for (let a = -14; a <= 14; a += 4.5) {
      line(ix + a, iy - 15, ix + a, iy + 15, '#8a7a5a', 1.2);
      line(ix - 15, iy + a, ix + 15, iy + a, '#8a7a5a', 1.2);
    }
    ctx.restore();
  } else if (tool === 'pestle') {
    // A mortar bowl with the pestle leaning in it.
    ctx.save();
    ctx.translate(ix + 2, iy - 6);
    ctx.rotate(PI / 5);
    rrect(-4, -16, 8, 26, 4);
    ctx.fillStyle = '#c9b48a';
    ctx.fill();
    ctx.strokeStyle = SEPIA;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(ix - 17, iy);
    ctx.lineTo(ix + 17, iy);
    ctx.quadraticCurveTo(ix + 15, iy + 15, ix, iy + 15);
    ctx.quadraticCurveTo(ix - 15, iy + 15, ix - 17, iy);
    ctx.closePath();
    ctx.fillStyle = '#9a8a6e';
    ctx.fill();
    ctx.strokeStyle = SEPIA;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    line(ix - 18, iy, ix + 18, iy, SEPIA, 3);
  } else {
    // A copper funnel.
    poly([[ix - 16, iy - 13], [ix + 16, iy - 13], [ix + 4, iy + 3], [ix + 4, iy + 15], [ix - 4, iy + 15], [ix - 4, iy + 3]], '#c47a3a', SEPIA, 2.5);
    line(ix - 12, iy - 9, ix + 12, iy - 9, '#e6b07a', 2);
  }
  const ink = look === 'off' ? '#d6cfb8' : CREAM;
  txt(t(TOOLS[tool].name), x + 64, y + 34, `italic 700 24px ${SERIF}`, ink);
  if (look === 'off') coin(x + 74, y + 61, 10, '#b9b29a', '#8f8a76');
  else coin(x + 74, y + 61, 10);
  txt(`${TOOLS[tool].cost}`, x + 90, y + 63, `700 23px ${SERIF}`, look === 'off' ? '#d6cfb8' : GOLDL);
}

/** The result card's button: a bottle-green cartouche (the scene writes its caption). */
function paintButton() {
  const w = BUTTON.w * ART;
  const h = BUTTON.h * ART;
  ctx.save();
  ctx.shadowColor = 'rgba(60,30,10,0.35)';
  ctx.shadowOffsetY = 5;
  ctx.shadowBlur = 6;
  rrect(4, 2, w, h, h / 2);
  ctx.fillStyle = BOTTLE;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = SEPIA;
  ctx.lineWidth = 3;
  ctx.stroke();
  rrect(10, 8, w - 12, h - 12, h / 2 - 6);
  ctx.strokeStyle = GOLDL;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

/** The picked tile: a lit cell in a gold ring with a little finial on each side. */
function paintCursor() {
  const x = 14;
  const y = 14;
  rrect(x + 2, y + 2, 108, 108, 16);
  ctx.fillStyle = '#fbf3dc';
  ctx.fill();
  ctx.strokeStyle = SEPIA;
  ctx.lineWidth = 7;
  ctx.stroke();
  ctx.strokeStyle = STAR;
  ctx.lineWidth = 4;
  ctx.stroke();
  for (const [a, b] of [[x + 56, y - 4], [x + 56, y + 116], [x - 4, y + 56], [x + 116, y + 56]]) {
    poly([[a, b - 9], [a + 9, b], [a, b + 9], [a - 9, b]], STAR, SEPIA, 2.5);
  }
}

/** The gold-hatched band behind a Catalyst's row (or a column, or a Bloom's square): what it clears. */
function paintBand(w: number, h: number, fill = 'rgba(214,170,80,0.22)') {
  rrect(4, 4, w * ART - 4, h * ART - 4, 16);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.setLineDash([2, 9]);
  ctx.lineCap = 'round';
  ctx.strokeStyle = GOLDD;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.setLineDash([]);
}

/** A little sunburst, the Catalyst's mark in the caption. */
function paintSun(x: number, y: number, ink: string) {
  for (let k = 0; k < 12; k++) {
    const a = (k * PI) / 6;
    line(x + Math.cos(a) * 8, y + Math.sin(a) * 8, x + Math.cos(a) * 14, y + Math.sin(a) * 14, GOLDD, 2);
  }
  circle(x, y, 7, ink, SEPIA, 1.5);
}

/** The card shown over the board when an order sells or runs out of moves. */
/** A wall in a town's board shape: a bottle-green inlay with a gold rim and a small gold lozenge, over the tray's cell. */
function paintHole() {
  const cell = BOARD.cell * ART;
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, cell, cell);
  rrect(4, 4, cell - 8, cell - 8, 14);
  ctx.fillStyle = GREEN;
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.stroke();
  rrect(14, 14, cell - 28, cell - 28, 8);
  ctx.strokeStyle = 'rgba(201,162,74,0.45)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  poly([[cell / 2, cell / 2 - 12], [cell / 2 + 8, cell / 2], [cell / 2, cell / 2 + 12], [cell / 2 - 8, cell / 2]], GOLD, null);
}

/** A cream card `w` x `h` art units with a shadow, a double rule and corner whiplashes: the result card and the journey map. */
function paintCard(w: number, h: number) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  rrect(12, 8, w - 24, h - 28, 24);
  ctx.fillStyle = CREAM;
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = SEPIA;
  ctx.lineWidth = 4;
  ctx.stroke();
  doubleRule(24, 20, w - 48, h - 52, 16);
  cornerOrn(26, 22, 1, 1, 56);
  cornerOrn(w - 26, 22, -1, 1, 56);
  cornerOrn(26, h - 34, 1, -1, 56);
  cornerOrn(w - 26, h - 34, -1, -1, 56);
}
