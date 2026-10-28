// Every picture in Bramblecrest, painted in code at boot. The look is a moonlit tabletop
// miniature: soft, rounded shapes lit from the upper left like painted models, with a soft contact
// shadow under each, and warm lamp-lit windows. Textures are painted `res` times the game's size
// (see `sharpRes`) and drawn back at 1 / res, so they stay sharp on big screens.

import Phaser from 'phaser';
import { sharpRes } from '../../../../shared/scaling';

type Ctx = CanvasRenderingContext2D;

/** Each texture's painted resolution, so sprites can be shown at game size. */
const RES = new Map<string, number>();

export function texScale(key: string) {
  return 1 / (RES.get(key) ?? 1);
}

/** Paints a `w` x `h` texture (game pixels) with `draw`, sharp for this screen. */
export function paint(scene: Phaser.Scene, key: string, w: number, h: number, draw: (c: Ctx) => void, res = sharpRes(w, h, 2)) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w * res));
  cv.height = Math.max(1, Math.ceil(h * res));
  const c = cv.getContext('2d')!;
  c.scale(res, res);
  draw(c);
  scene.textures.addCanvas(key, cv);
  RES.set(key, res);
}

/** A hex colour made lighter (amt > 0) or darker (amt < 0), amt from -1 to 1. */
export function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const mix = (v: number) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
  const r = mix(n >> 16);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `rgb(${r},${g},${b})`;
}

/** A soft round shadow on the ground. */
function shadow(c: Ctx, x: number, y: number, rx: number, ry: number, a = 0.4) {
  const g = c.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(5,8,20,${a})`);
  g.addColorStop(1, 'rgba(5,8,20,0)');
  c.save();
  c.translate(x, y);
  c.scale(1, ry / rx);
  c.translate(-x, -y);
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, rx, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

/** A ball lit from the upper left, like a painted bead. */
function ball(c: Ctx, x: number, y: number, r: number, col: string, ry = r) {
  const g = c.createRadialGradient(x - r * 0.35, y - ry * 0.4, r * 0.1, x, y, r * 1.05);
  g.addColorStop(0, shade(col, 0.35));
  g.addColorStop(0.55, col);
  g.addColorStop(1, shade(col, -0.45));
  c.fillStyle = g;
  c.beginPath();
  c.ellipse(x, y, r, ry, 0, 0, Math.PI * 2);
  c.fill();
}

/** A rounded upright body (a robe, a tunic), lit from the left. */
function body(c: Ctx, x: number, y: number, w: number, h: number, col: string, round = 0.45) {
  const g = c.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  g.addColorStop(0, shade(col, 0.25));
  g.addColorStop(0.45, col);
  g.addColorStop(1, shade(col, -0.45));
  c.fillStyle = g;
  c.beginPath();
  c.roundRect(x - w / 2, y, w, h, [w * round, w * round, w * 0.2, w * 0.2]);
  c.fill();
}

/** A box seen from above and in front: a lit top and a shaded face. */
function box(c: Ctx, x: number, y: number, w: number, top: number, face: number, col: string) {
  c.fillStyle = shade(col, 0.15);
  c.fillRect(x, y, w, top);
  const g = c.createLinearGradient(0, y + top, 0, y + top + face);
  g.addColorStop(0, shade(col, -0.2));
  g.addColorStop(1, shade(col, -0.5));
  c.fillStyle = g;
  c.fillRect(x, y + top, w, face);
}

function glowDot(c: Ctx, x: number, y: number, r: number, col: string) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, col);
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

const WINDOW = '#ffcf7a';

export function paintAll(scene: Phaser.Scene) {
  // Trees: a trunk and a crown of lit leaf balls. The fen grows drooping blue-green willows.
  const tree = (key: string, leaf: string, willow = false) =>
    paint(scene, key, 56, 72, (c) => {
      shadow(c, 30, 64, 24, 8, 0.45);
      body(c, 28, 40, 10, 26, '#6b4a30', 0.2);
      if (willow) {
        for (let i = 0; i < 7; i++) {
          c.strokeStyle = shade(leaf, -0.1 - i * 0.03);
          c.lineWidth = 3;
          c.beginPath();
          c.moveTo(12 + i * 5, 24);
          c.quadraticCurveTo(10 + i * 5, 44, 12 + i * 5.5, 54);
          c.stroke();
        }
        ball(c, 28, 24, 20, leaf, 15);
      } else {
        ball(c, 18, 32, 14, shade(leaf, -0.1));
        ball(c, 38, 32, 14, shade(leaf, -0.15));
        ball(c, 28, 20, 17, leaf);
        ball(c, 22, 14, 8, shade(leaf, 0.12));
      }
    });
  tree('tree', '#3f7f46');
  tree('tree-b', '#4a8a3c');
  tree('tree-fen', '#3d7a6c', true);

  paint(scene, 'bush', 34, 30, (c) => {
    shadow(c, 17, 25, 15, 5);
    ball(c, 10, 17, 8, '#3d7a3a');
    ball(c, 24, 17, 8, '#36703a');
    ball(c, 17, 12, 10, '#4a8c44');
    for (const [x, y] of [[12, 10], [22, 14], [16, 19]]) glowDot(c, x, y, 2, 'rgba(255,240,200,0.8)');
  });
  paint(scene, 'thorns', 34, 34, (c) => {
    shadow(c, 17, 29, 15, 5);
    c.lineCap = 'round';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI;
      c.strokeStyle = i % 2 ? '#5a2f4a' : '#6f3a52';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(17, 30);
      c.quadraticCurveTo(17 + Math.cos(a) * 20, 18, 17 - Math.cos(a) * 14, 4 + (i % 3) * 3);
      c.stroke();
    }
    c.fillStyle = '#d8c2e6';
    for (let i = 0; i < 14; i++) {
      const x = 5 + ((i * 7) % 25);
      const y = 6 + ((i * 11) % 22);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + 3, y - 1);
      c.lineTo(x + 1, y + 2);
      c.fill();
    }
  });

  // A cottage: plaster walls, a thatched roof in two lit faces, glowing windows and a door.
  paint(scene, 'house', 160, 184, (c) => {
    shadow(c, 84, 172, 84, 14, 0.5);
    box(c, 6, 82, 148, 6, 90, '#e7d6b4');
    c.fillStyle = '#5b3a26';
    c.beginPath();
    c.roundRect(68, 124, 26, 52, [13, 13, 0, 0]);
    c.fill();
    for (const x of [22, 112]) {
      c.fillStyle = '#3a2618';
      c.fillRect(x - 2, 112, 30, 30);
      c.fillStyle = WINDOW;
      c.fillRect(x, 114, 26, 26);
      c.fillStyle = '#3a2618';
      c.fillRect(x + 12, 114, 2, 26);
      c.fillRect(x, 126, 26, 2);
      glowDot(c, x + 13, 127, 22, 'rgba(255,200,110,0.35)');
    }
    const roof = c.createLinearGradient(0, 4, 0, 92);
    roof.addColorStop(0, '#c86a4c');
    roof.addColorStop(1, '#8e3f30');
    c.fillStyle = roof;
    c.beginPath();
    c.moveTo(0, 92);
    c.lineTo(28, 10);
    c.lineTo(132, 10);
    c.lineTo(160, 92);
    c.closePath();
    c.fill();
    c.fillStyle = 'rgba(255,220,180,0.18)';
    c.beginPath();
    c.moveTo(0, 92);
    c.lineTo(28, 10);
    c.lineTo(60, 10);
    c.lineTo(40, 92);
    c.fill();
    c.strokeStyle = 'rgba(60,20,15,0.35)';
    c.lineWidth = 2;
    for (let y = 26; y < 92; y += 14) {
      c.beginPath();
      c.moveTo(4 + (92 - y) * 0.3, y);
      c.lineTo(156 - (92 - y) * 0.3, y);
      c.stroke();
    }
    box(c, 112, 0, 18, 4, 22, '#8a8580');
  });
  paint(scene, 'shed', 96, 132, (c) => {
    shadow(c, 50, 122, 50, 10, 0.5);
    box(c, 4, 56, 88, 4, 66, '#8c6a48');
    c.strokeStyle = 'rgba(40,25,15,0.4)';
    for (let x = 14; x < 92; x += 12) {
      c.beginPath();
      c.moveTo(x, 62);
      c.lineTo(x, 122);
      c.stroke();
    }
    c.fillStyle = '#3d2a1c';
    c.fillRect(34, 80, 28, 42);
    const roof = c.createLinearGradient(0, 6, 0, 62);
    roof.addColorStop(0, '#6f7a86');
    roof.addColorStop(1, '#4a525c');
    c.fillStyle = roof;
    c.beginPath();
    c.moveTo(0, 62);
    c.lineTo(16, 8);
    c.lineTo(80, 8);
    c.lineTo(96, 62);
    c.fill();
  });
  paint(scene, 'hut', 128, 140, (c) => {
    shadow(c, 66, 130, 64, 10, 0.5);
    box(c, 10, 66, 108, 4, 62, '#7a6a52');
    c.fillStyle = WINDOW;
    c.beginPath();
    c.arc(36, 98, 9, 0, Math.PI * 2);
    c.fill();
    glowDot(c, 36, 98, 20, 'rgba(255,200,110,0.35)');
    c.fillStyle = '#2e2418';
    c.beginPath();
    c.roundRect(70, 90, 24, 40, [12, 12, 0, 0]);
    c.fill();
    const roof = c.createRadialGradient(50, 20, 10, 64, 50, 80);
    roof.addColorStop(0, '#c9b276');
    roof.addColorStop(1, '#7d6a3e');
    c.fillStyle = roof;
    c.beginPath();
    c.ellipse(64, 60, 66, 52, 0, Math.PI, 0);
    c.lineTo(128, 72);
    c.lineTo(0, 72);
    c.fill();
  });
  paint(scene, 'well', 64, 100, (c) => {
    shadow(c, 34, 88, 32, 9, 0.5);
    c.fillStyle = '#5b3a26';
    c.fillRect(8, 24, 6, 50);
    c.fillRect(50, 24, 6, 50);
    box(c, 4, 54, 56, 10, 30, '#9a948a');
    c.fillStyle = '#1b2a3a';
    c.beginPath();
    c.ellipse(32, 59, 22, 5, 0, 0, Math.PI * 2);
    c.fill();
    const roof = c.createLinearGradient(0, 4, 0, 28);
    roof.addColorStop(0, '#c86a4c');
    roof.addColorStop(1, '#8e3f30');
    c.fillStyle = roof;
    c.beginPath();
    c.moveTo(0, 30);
    c.lineTo(32, 4);
    c.lineTo(64, 30);
    c.fill();
  });
  paint(scene, 'lamp', 24, 70, (c) => {
    shadow(c, 12, 66, 10, 3);
    c.fillStyle = '#2c2f3a';
    c.fillRect(10, 18, 4, 48);
    c.fillRect(6, 62, 12, 4);
    c.fillStyle = '#2c2f3a';
    c.fillRect(4, 4, 16, 3);
    c.fillStyle = '#ffe2a0';
    c.fillRect(6, 7, 12, 12);
    glowDot(c, 12, 13, 12, 'rgba(255,220,140,0.9)');
  });
  paint(scene, 'brazier', 30, 44, (c) => {
    shadow(c, 15, 40, 13, 4);
    c.fillStyle = '#3a3a44';
    c.fillRect(12, 22, 6, 18);
    ball(c, 15, 22, 13, '#55525e', 6);
    glowDot(c, 15, 14, 14, 'rgba(255,170,70,0.95)');
    c.fillStyle = '#ffd27a';
    c.beginPath();
    c.moveTo(9, 20);
    c.quadraticCurveTo(15, 0, 21, 20);
    c.fill();
  });
  paint(scene, 'shroom', 26, 24, (c) => {
    shadow(c, 13, 21, 10, 3);
    for (const [x, y, r] of [[8, 14, 6], [17, 11, 7], [13, 17, 4]] as const) {
      c.fillStyle = '#d8e8f0';
      c.fillRect(x - 1, y, 2, 6);
      ball(c, x, y, r, '#5fd0d8', r * 0.6);
      glowDot(c, x, y, r + 4, 'rgba(120,240,255,0.5)');
    }
  });
  paint(scene, 'bench', 64, 30, (c) => {
    shadow(c, 32, 26, 30, 4);
    box(c, 2, 8, 60, 6, 6, '#8a6040');
    c.fillStyle = '#5b3a26';
    c.fillRect(6, 20, 5, 8);
    c.fillRect(53, 20, 5, 8);
  });
  paint(scene, 'rock', 34, 28, (c) => {
    shadow(c, 17, 23, 15, 5);
    ball(c, 16, 16, 13, '#8a8c94', 10);
    ball(c, 24, 19, 7, '#7a7c84', 6);
  });
  paint(scene, 'arch', 128, 104, (c) => {
    shadow(c, 64, 96, 62, 8, 0.5);
    box(c, 4, 16, 120, 6, 80, '#7d7f8c');
    c.fillStyle = '#05060c';
    c.beginPath();
    c.roundRect(36, 40, 56, 58, [28, 28, 0, 0]);
    c.fill();
    c.fillStyle = '#4e8a4a';
    for (let i = 0; i < 12; i++) ball(c, 6 + i * 11, 18 + (i % 3) * 5, 6, '#3f7a3e');
    c.strokeStyle = '#9fd0e8';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(64, 30, 7, 0, Math.PI * 2);
    c.stroke();
  });
  for (const dir of ['right', 'down', 'up'] as const)
    paint(scene, `statue-${dir}`, 34, 64, (c) => {
      shadow(c, 17, 60, 14, 4);
      box(c, 5, 44, 24, 4, 14, '#8a8c94');
      body(c, 17, 20, 16, 26, '#a2a4ac', 0.5);
      ball(c, 17, 14, 7, '#b0b2ba');
      c.strokeStyle = '#a2a4ac';
      c.lineWidth = 4;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(17, 26);
      if (dir === 'right') c.lineTo(32, 26);
      else if (dir === 'down') c.lineTo(22, 40);
      else c.lineTo(23, 4);
      c.stroke();
    });

  paint(scene, 'post', 22, 40, (c) => {
    shadow(c, 11, 36, 9, 3);
    body(c, 11, 10, 8, 26, '#7a5638', 0.2);
    c.strokeStyle = '#e8c45a';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(11, 8, 6, 0, Math.PI * 2);
    c.stroke();
    glowDot(c, 11, 8, 10, 'rgba(255,220,120,0.35)');
  });
  paint(scene, 'block', 32, 42, (c) => {
    shadow(c, 16, 38, 16, 4);
    box(c, 1, 2, 30, 18, 20, '#8a8478');
    c.strokeStyle = 'rgba(30,25,20,0.4)';
    c.strokeRect(5, 6, 22, 10);
  });
  paint(scene, 'plate', 30, 30, (c) => {
    c.fillStyle = '#3f4652';
    c.beginPath();
    c.roundRect(2, 2, 26, 26, 4);
    c.fill();
    c.fillStyle = '#6a7a8c';
    c.beginPath();
    c.roundRect(5, 5, 20, 20, 3);
    c.fill();
    c.strokeStyle = '#9fd0e8';
    c.lineWidth = 2;
    c.beginPath();
    c.arc(15, 15, 5, 0, Math.PI * 2);
    c.stroke();
  });
  const chest = (key: string, open: boolean) =>
    paint(scene, key, 32, 32, (c) => {
      shadow(c, 16, 28, 15, 4);
      box(c, 3, 12, 26, 4, 14, '#9a6a3a');
      c.fillStyle = '#e8c45a';
      c.fillRect(3, 18, 26, 2);
      if (open) {
        c.fillStyle = '#2a1a10';
        c.fillRect(5, 12, 22, 4);
        box(c, 3, 2, 26, 3, 8, '#8a5a30');
      } else {
        box(c, 3, 6, 26, 4, 6, '#a8744a');
        c.fillStyle = '#e8c45a';
        c.fillRect(14, 14, 4, 6);
      }
    });
  chest('chest', false);
  chest('chest-open', true);
  paint(scene, 'sign', 26, 32, (c) => {
    shadow(c, 13, 29, 10, 3);
    c.fillStyle = '#5b3a26';
    c.fillRect(11, 12, 4, 18);
    box(c, 2, 2, 22, 3, 12, '#a07850');
    c.fillStyle = 'rgba(40,25,15,0.6)';
    for (let i = 0; i < 3; i++) c.fillRect(6, 8 + i * 3, 14 - i * 3, 1.5);
  });
  paint(scene, 'door-key', 32, 40, (c) => {
    box(c, 0, 0, 32, 6, 34, '#6a4a2e');
    c.fillStyle = '#e8c45a';
    c.beginPath();
    c.arc(16, 22, 5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2a1a10';
    c.fillRect(15, 21, 2, 6);
  });
  paint(scene, 'door-bars', 32, 40, (c) => {
    c.fillStyle = '#1a1c24';
    c.fillRect(0, 6, 32, 34);
    for (let x = 3; x < 32; x += 7) body(c, x + 1, 0, 4, 40, '#8a8c98', 0.5);
  });
  paint(scene, 'door-shut', 32, 40, (c) => {
    c.fillStyle = '#20141c';
    c.fillRect(0, 4, 32, 36);
    c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      c.strokeStyle = i % 2 ? '#5a2f4a' : '#7a3f5a';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(0, 6 + i * 6);
      c.quadraticCurveTo(16, 2 + i * 7, 32, 8 + i * 5);
      c.stroke();
    }
  });
  paint(scene, 'moonstone', 18, 18, (c) => {
    glowDot(c, 9, 9, 9, 'rgba(180,220,255,0.6)');
    c.fillStyle = '#dff2ff';
    c.beginPath();
    c.moveTo(9, 2);
    c.lineTo(15, 9);
    c.lineTo(9, 16);
    c.lineTo(3, 9);
    c.closePath();
    c.fill();
    c.fillStyle = '#8fc4f0';
    c.beginPath();
    c.moveTo(9, 2);
    c.lineTo(15, 9);
    c.lineTo(9, 16);
    c.fill();
  });
  paint(scene, 'pickup-heart', 16, 16, (c) => heart(c, 8, 8, 6, '#e8506a'));
  paint(scene, 'wisp', 26, 26, (c) => {
    glowDot(c, 13, 13, 13, 'rgba(190,240,255,0.7)');
    ball(c, 13, 13, 5, '#f0fbff');
  });

  // People: small rounded figures like painted pawns, each with one thing that says who they are.
  const person = (key: string, robe: string, skin: string, hair: string, extra?: (c: Ctx) => void, h = 44) =>
    paint(scene, key, 32, h, (c) => {
      shadow(c, 16, h - 3, 12, 3.5);
      body(c, 16, h - 26, 20, 23, robe);
      ball(c, 16, h - 31, 9, skin);
      c.fillStyle = hair;
      c.beginPath();
      c.ellipse(16, h - 35, 9.5, 6, 0, Math.PI, 0);
      c.fill();
      c.fillStyle = '#1a1420';
      c.fillRect(12, h - 31, 2, 3);
      c.fillRect(18, h - 31, 2, 3);
      extra?.(c);
    });
  person('elder', '#3f6a52', '#f0d2b0', '#d8d8e0', (c) => {
    c.fillStyle = '#7a5638';
    c.fillRect(26, 6, 3, 38);
    glowDot(c, 27, 6, 6, 'rgba(150,230,200,0.8)');
  });
  person('pip', '#d07a3a', '#f4d0a8', '#e0803a', undefined, 36);
  person('baker', '#e8e0d0', '#e8c09a', '#5a3a2a', (c) => {
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.ellipse(16, 7, 10, 5, 0, 0, Math.PI * 2);
    c.fill();
  });
  person('hermit', '#6a5a40', '#d8b890', '#6a5a40', (c) => {
    c.fillStyle = '#ffe2a0';
    c.fillRect(25, 26, 6, 7);
    glowDot(c, 28, 29, 8, 'rgba(255,220,140,0.8)');
  });
  paint(scene, 'cat', 28, 24, (c) => {
    shadow(c, 14, 21, 11, 3);
    ball(c, 14, 15, 9, '#e0904a', 6);
    ball(c, 21, 10, 6, '#e8a05a');
    c.fillStyle = '#e8a05a';
    c.beginPath();
    c.moveTo(17, 7);
    c.lineTo(18, 1);
    c.lineTo(21, 5);
    c.moveTo(22, 5);
    c.lineTo(25, 1);
    c.lineTo(25, 7);
    c.fill();
    c.strokeStyle = '#e0904a';
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(6, 16);
    c.quadraticCurveTo(0, 10, 4, 4);
    c.stroke();
  });

  // The knight: a steel helm with a small plume, a blue tunic and a gold-lined cape.
  const knight = (key: string, view: 'down' | 'up' | 'side') =>
    paint(scene, key, 32, 44, (c) => {
      shadow(c, 16, 41, 12, 3.5);
      if (view !== 'down') body(c, view === 'side' ? 13 : 16, 18, 20, 22, '#c8a03a', 0.3);
      body(c, 16, 18, 18, 22, '#3d6fc4');
      c.fillStyle = '#5a3a26';
      c.fillRect(8, 30, 16, 3);
      ball(c, 16, 13, 10, '#c4ccd8');
      if (view !== 'up') {
        c.fillStyle = '#1a1c28';
        if (view === 'down') c.fillRect(10, 13, 12, 3);
        else c.fillRect(17, 13, 8, 3);
      }
      c.fillStyle = '#e07a3a';
      c.beginPath();
      c.ellipse(view === 'side' ? 12 : 16, 3, 3, 4, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#2a2030';
      c.fillRect(10, 39, 5, 3);
      c.fillRect(17, 39, 5, 3);
    });
  knight('hero-down', 'down');
  knight('hero-up', 'up');
  knight('hero-side', 'side');
  paint(scene, 'sword', 10, 34, (c) => {
    const g = c.createLinearGradient(2, 0, 8, 0);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#9aa4b8');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(5, 0);
    c.lineTo(8, 4);
    c.lineTo(8, 24);
    c.lineTo(2, 24);
    c.lineTo(2, 4);
    c.fill();
    c.fillStyle = '#e8c45a';
    c.fillRect(0, 24, 10, 3);
    c.fillStyle = '#5a3a26';
    c.fillRect(3, 27, 4, 7);
  });
  paint(scene, 'hook', 14, 14, (c) => {
    c.strokeStyle = '#7fc45a';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(7, 7, 4.5, 0.3, Math.PI * 1.7);
    c.stroke();
    ball(c, 7, 7, 2.5, '#b0e07a');
  });

  // Foes.
  paint(scene, 'slug', 34, 26, (c) => {
    shadow(c, 17, 22, 15, 4);
    ball(c, 17, 16, 14, '#6a8a4a', 7);
    ball(c, 27, 14, 6, '#7a9a5a');
    c.fillStyle = '#1a1420';
    c.fillRect(28, 11, 2, 2);
    c.fillStyle = '#5a2f4a';
    for (let i = 0; i < 4; i++) {
      c.beginPath();
      c.moveTo(7 + i * 5, 11);
      c.lineTo(9 + i * 5, 3);
      c.lineTo(11 + i * 5, 11);
      c.fill();
    }
  });
  const moth = (key: string, up: boolean) =>
    paint(scene, key, 34, 30, (c) => {
      shadow(c, 17, 27, 8, 2.5, 0.25);
      for (const s of [-1, 1]) {
        c.fillStyle = '#c8bce0';
        c.beginPath();
        c.ellipse(17 + s * 9, up ? 9 : 14, 9, up ? 7 : 5, s * (up ? -0.6 : 0.3), 0, Math.PI * 2);
        c.fill();
        glowDot(c, 17 + s * 10, up ? 9 : 14, 3, 'rgba(255,230,140,0.9)');
      }
      body(c, 17, 7, 6, 14, '#8a7aa8', 0.5);
    });
  moth('moth-a', true);
  moth('moth-b', false);
  paint(scene, 'thornling', 34, 38, (c) => {
    shadow(c, 17, 34, 14, 4);
    c.strokeStyle = '#4a6a3a';
    c.lineWidth = 3;
    for (const a of [-0.9, -0.3, 0.3, 0.9]) {
      c.beginPath();
      c.moveTo(17, 30);
      c.quadraticCurveTo(17 + a * 20, 26, 17 + a * 16, 34);
      c.stroke();
    }
    ball(c, 17, 18, 11, '#7a3f5a');
    c.fillStyle = '#1a0a14';
    c.beginPath();
    c.ellipse(17, 20, 5, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e8d070';
    c.fillRect(11, 13, 3, 2);
    c.fillRect(20, 13, 3, 2);
  });
  paint(scene, 'seed', 12, 12, (c) => {
    glowDot(c, 6, 6, 6, 'rgba(220,120,200,0.6)');
    ball(c, 6, 6, 3.5, '#c06aa0');
  });
  paint(scene, 'boss', 150, 140, (c) => {
    shadow(c, 75, 128, 66, 14, 0.55);
    c.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      c.strokeStyle = i % 2 ? '#5a2f4a' : '#4a6a3a';
      c.lineWidth = 7;
      c.beginPath();
      c.moveTo(75, 80);
      c.quadraticCurveTo(75 + Math.cos(a) * 70, 80 + Math.sin(a) * 50, 75 + Math.cos(a + 0.6) * 60, 80 + Math.sin(a + 0.6) * 44);
      c.stroke();
    }
    ball(c, 75, 70, 40, '#8a3f62', 44);
    for (let i = 0; i < 6; i++) ball(c, 75 + Math.cos(i) * 34, 40 + Math.sin(i * 2) * 6, 12, '#c06aa0', 18);
    c.fillStyle = '#ffe48a';
    c.beginPath();
    c.ellipse(60, 66, 6, 4, 0.3, 0, Math.PI * 2);
    c.ellipse(90, 66, 6, 4, -0.3, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1a0a14';
    c.beginPath();
    c.ellipse(75, 88, 14, 8, 0, 0, Math.PI);
    c.fill();
  });
  const bulb = (key: string, lit: boolean) =>
    paint(scene, key, 30, 40, (c) => {
      shadow(c, 15, 36, 10, 3);
      c.strokeStyle = '#4a6a3a';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(15, 36);
      c.lineTo(15, 22);
      c.stroke();
      if (lit) glowDot(c, 15, 14, 15, 'rgba(230,255,140,0.8)');
      ball(c, 15, 14, 9, lit ? '#d8e86a' : '#6a7a4a', 11);
    });
  bulb('bulb', false);
  bulb('bulb-lit', true);

  // The second chapter: boulders, bellseeds, the belfry's bells, candles, frogs and the Bellwraith.
  paint(scene, 'boulder', 34, 32, (c) => {
    shadow(c, 17, 27, 16, 5, 0.5);
    ball(c, 17, 17, 15, '#7c7a84', 12);
    ball(c, 11, 13, 6, '#8e8c96', 5);
    c.strokeStyle = 'rgba(30,28,40,0.55)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(20, 8);
    c.lineTo(17, 15);
    c.lineTo(22, 20);
    c.stroke();
    c.fillStyle = 'rgba(90,140,80,0.6)';
    c.beginPath();
    c.ellipse(24, 9, 5, 2.5, 0.3, 0, Math.PI * 2);
    c.fill();
  });
  const seedPod = (c: Ctx, x: number, y: number, r: number) => {
    glowDot(c, x, y, r * 2, 'rgba(200,255,140,0.45)');
    ball(c, x, y, r, '#7aa84a', r * 1.15);
    c.strokeStyle = '#e8d070';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(x - r * 0.7, y);
    c.lineTo(x + r * 0.7, y);
    c.stroke();
    c.strokeStyle = '#4a6a3a';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x, y - r);
    c.quadraticCurveTo(x + 2, y - r - 4, x + 4, y - r - 3);
    c.stroke();
  };
  paint(scene, 'bellseed', 20, 22, (c) => {
    shadow(c, 10, 19, 7, 2.5);
    seedPod(c, 10, 12, 6);
  });
  paint(scene, 'pickup-seed', 18, 18, (c) => seedPod(c, 9, 10, 4.5));
  const bell = (key: string, r: number) =>
    paint(scene, key, 40, 48, (c) => {
      shadow(c, 20, 44, r + 4, 4, 0.45);
      c.fillStyle = '#3a2c22';
      c.fillRect(19, 2, 2, 44 - r * 2.2);
      const top = 44 - r * 2;
      const g = c.createLinearGradient(20 - r, 0, 20 + r, 0);
      g.addColorStop(0, '#e0b060');
      g.addColorStop(0.45, '#b07a34');
      g.addColorStop(1, '#5a3a1a');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(20 - r * 0.55, top);
      c.quadraticCurveTo(20 - r * 0.6, top + r * 1.2, 20 - r, 44 - r * 0.3);
      c.lineTo(20 + r, 44 - r * 0.3);
      c.quadraticCurveTo(20 + r * 0.6, top + r * 1.2, 20 + r * 0.55, top);
      c.quadraticCurveTo(20, top - r * 0.4, 20 - r * 0.55, top);
      c.fill();
      c.fillStyle = '#2a1a10';
      c.beginPath();
      c.ellipse(20, 44 - r * 0.3, r, r * 0.25, 0, 0, Math.PI * 2);
      c.fill();
      ball(c, 20, 44 - r * 0.15, r * 0.18, '#8a6a3a');
    });
  bell('bell-0', 15);
  bell('bell-1', 12);
  bell('bell-2', 9);
  paint(scene, 'candle', 14, 28, (c) => {
    shadow(c, 7, 26, 6, 2);
    body(c, 7, 12, 7, 14, '#e8dcc0', 0.2);
    glowDot(c, 7, 8, 7, 'rgba(255,200,110,0.9)');
    c.fillStyle = '#ffe2a0';
    c.beginPath();
    c.moveTo(5, 11);
    c.quadraticCurveTo(7, 2, 9, 11);
    c.fill();
  });
  // The trial's hourglass: a wooden frame round two glass bulbs, the sand glowing like moonlight.
  paint(scene, 'hourglass', 30, 48, (c) => {
    shadow(c, 15, 45, 13, 4);
    box(c, 2, 36, 26, 4, 5, '#6b4a30');
    for (const x of [5, 25]) body(c, x, 8, 4, 30, '#7a5638', 0.2);
    const glass = (top: boolean) => {
      c.fillStyle = 'rgba(200,225,255,0.28)';
      c.beginPath();
      if (top) {
        c.moveTo(7, 9);
        c.quadraticCurveTo(15, 26, 15, 23);
        c.quadraticCurveTo(15, 26, 23, 9);
      } else {
        c.moveTo(7, 36);
        c.quadraticCurveTo(15, 19, 15, 23);
        c.quadraticCurveTo(15, 19, 23, 36);
      }
      c.closePath();
      c.fill();
    };
    glass(true);
    glass(false);
    glowDot(c, 15, 30, 12, 'rgba(170,220,255,0.55)');
    c.fillStyle = '#cfe8ff';
    c.beginPath();
    c.moveTo(9, 12);
    c.lineTo(21, 12);
    c.lineTo(15, 20);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(15, 28);
    c.lineTo(22, 36);
    c.lineTo(8, 36);
    c.closePath();
    c.fill();
    c.fillRect(14.5, 20, 1, 8);
    box(c, 2, 4, 26, 4, 5, '#6b4a30');
  });
  paint(scene, 'tower', 128, 152, (c) => {
    shadow(c, 64, 146, 62, 8, 0.5);
    // Two leaning pillars and a broken arch over a dark door, with a small bell still hanging.
    box(c, 8, 30, 26, 6, 112, '#6a7080');
    box(c, 94, 22, 26, 6, 120, '#646a7a');
    c.fillStyle = '#585e6e';
    c.beginPath();
    c.moveTo(8, 34);
    c.quadraticCurveTo(64, -14, 120, 26);
    c.lineTo(120, 42);
    c.quadraticCurveTo(64, 4, 8, 48);
    c.fill();
    c.fillStyle = '#0a0c14';
    c.beginPath();
    c.moveTo(32, 148);
    c.lineTo(32, 104);
    c.quadraticCurveTo(64, 78, 96, 104);
    c.lineTo(96, 148);
    c.fill();
    c.fillStyle = '#3a2c22';
    c.fillRect(63, 22, 2, 18);
    c.fillStyle = '#b07a34';
    c.beginPath();
    c.moveTo(56, 52);
    c.quadraticCurveTo(58, 38, 64, 38);
    c.quadraticCurveTo(70, 38, 72, 52);
    c.fill();
    glowDot(c, 64, 60, 14, 'rgba(150,200,255,0.5)');
    c.fillStyle = 'rgba(70,120,70,0.7)';
    for (const [x, y] of [[14, 60], [20, 100], [100, 44], [108, 120], [40, 30]]) {
      c.beginPath();
      c.ellipse(x, y, 7, 3.5, 0.4, 0, Math.PI * 2);
      c.fill();
    }
  });
  paint(scene, 'frog', 32, 26, (c) => {
    shadow(c, 16, 23, 13, 4);
    ball(c, 8, 18, 6, '#3f7a4a', 4);
    ball(c, 24, 18, 6, '#3f7a4a', 4);
    ball(c, 16, 15, 11, '#4f9a5a', 8);
    ball(c, 10, 8, 4.5, '#5fae68');
    ball(c, 22, 8, 4.5, '#5fae68');
    c.fillStyle = '#e8d070';
    c.beginPath();
    c.arc(10, 7.5, 2.2, 0, Math.PI * 2);
    c.arc(22, 7.5, 2.2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#1a1420';
    c.fillRect(9.5, 6.5, 1.2, 2.2);
    c.fillRect(21.5, 6.5, 1.2, 2.2);
    c.strokeStyle = '#2a4a30';
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(10, 16);
    c.quadraticCurveTo(16, 19, 22, 16);
    c.stroke();
  });
  paint(scene, 'bigbell', 84, 88, (c) => {
    const g = c.createLinearGradient(6, 0, 78, 0);
    g.addColorStop(0, '#d8a858');
    g.addColorStop(0.4, '#9a6a2e');
    g.addColorStop(1, '#3e2812');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(24, 12);
    c.quadraticCurveTo(20, 50, 4, 78);
    c.lineTo(80, 78);
    c.quadraticCurveTo(64, 50, 60, 12);
    c.quadraticCurveTo(42, 2, 24, 12);
    c.fill();
    c.fillStyle = '#2a1a0e';
    c.beginPath();
    c.ellipse(42, 78, 38, 8, 0, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#e8c070';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(12, 66);
    c.quadraticCurveTo(42, 72, 72, 66);
    c.stroke();
    // Pale light leaks through cracks in the bronze.
    c.strokeStyle = 'rgba(170,230,255,0.9)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(34, 20);
    c.lineTo(38, 34);
    c.lineTo(33, 44);
    c.moveTo(54, 28);
    c.lineTo(50, 42);
    c.stroke();
    c.fillStyle = '#5a3e1e';
    c.beginPath();
    c.roundRect(36, 2, 12, 8, 3);
    c.fill();
  });
  paint(scene, 'wraith', 56, 64, (c) => {
    glowDot(c, 28, 26, 28, 'rgba(150,210,255,0.55)');
    c.fillStyle = 'rgba(210,235,255,0.92)';
    c.beginPath();
    c.moveTo(10, 30);
    c.quadraticCurveTo(10, 6, 28, 6);
    c.quadraticCurveTo(46, 6, 46, 30);
    c.lineTo(46, 54);
    for (let i = 0; i < 4; i++) c.quadraticCurveTo(46 - i * 9 - 4.5, 62, 46 - (i + 1) * 9, 54);
    c.closePath();
    c.fill();
    c.fillStyle = '#10163a';
    c.beginPath();
    c.ellipse(21, 26, 4, 6, 0, 0, Math.PI * 2);
    c.ellipse(35, 26, 4, 6, 0, 0, Math.PI * 2);
    c.ellipse(28, 40, 5, 4, 0, 0, Math.PI * 2);
    c.fill();
  });
  paint(scene, 'bell-shadow', 80, 28, (c) => shadow(c, 40, 14, 38, 12, 0.7));

  // The HUD's icons and the touch buttons.
  const icon = (key: string, draw: (c: Ctx) => void) => paint(scene, key, 22, 20, draw);
  icon('ui-heart', (c) => heart(c, 11, 10, 8, '#e8506a'));
  icon('ui-heart-half', (c) => {
    heart(c, 11, 10, 8, '#3a2a3a');
    c.save();
    c.beginPath();
    c.rect(0, 0, 11, 20);
    c.clip();
    heart(c, 11, 10, 8, '#e8506a');
    c.restore();
  });
  icon('ui-heart-empty', (c) => heart(c, 11, 10, 8, '#3a2a3a'));
  const button = (key: string, draw: (c: Ctx) => void) =>
    paint(scene, key, 64, 64, (c) => {
      c.fillStyle = 'rgba(20,24,44,0.55)';
      c.beginPath();
      c.arc(32, 32, 30, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = 'rgba(200,220,255,0.6)';
      c.lineWidth = 2;
      c.stroke();
      draw(c);
    });
  button('btn-sword', (c) => {
    c.save();
    c.translate(32, 32);
    c.rotate(Math.PI / 4);
    c.fillStyle = '#e8eef8';
    c.fillRect(-3, -20, 6, 28);
    c.fillStyle = '#e8c45a';
    c.fillRect(-9, 8, 18, 4);
    c.fillRect(-2, 12, 4, 8);
    c.restore();
  });
  button('btn-roll', (c) => {
    c.strokeStyle = '#e8eef8';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(32, 32, 13, 0.4, Math.PI * 1.8);
    c.stroke();
    c.fillStyle = '#e8eef8';
    c.beginPath();
    c.moveTo(44, 22);
    c.lineTo(48, 34);
    c.lineTo(36, 30);
    c.fill();
  });
  button('btn-seed', (c) => seedPod(c, 32, 34, 11));
  button('btn-vine', (c) => {
    c.strokeStyle = '#9ad86a';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(16, 46);
    c.bezierCurveTo(26, 30, 34, 44, 44, 22);
    c.stroke();
    c.beginPath();
    c.arc(44, 20, 5, 0, Math.PI * 2);
    c.stroke();
  });
}

function heart(c: Ctx, x: number, y: number, r: number, col: string) {
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(x, y + r);
  c.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.4, x, y - r * 0.4);
  c.bezierCurveTo(x + r * 0.6, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.35)';
  c.beginPath();
  c.ellipse(x - r * 0.45, y - r * 0.35, r * 0.25, r * 0.18, -0.5, 0, Math.PI * 2);
  c.fill();
}
