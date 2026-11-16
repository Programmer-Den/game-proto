import Phaser from 'phaser';
import { sharpRes } from '../../../../shared/scaling';
import type { Terrain, Theme } from '../game/terrain';

/**
 * Paints the ground on canvases from the terrain mask: a dark back wall where earth was at the start
 * (so a crater shows the hole dug into the hill), and the earth itself, with strata, pebbles, roots
 * and grass on every top edge. Carves and fills are replayed from `terrain.ops`, a crater getting a
 * scorched rim, so the canvas only changes where the ground did.
 */
export class TerrainArt {
  private res: number;
  private earth: HTMLCanvasElement;
  private pattern: HTMLCanvasElement;
  private tex: Phaser.Textures.CanvasTexture;
  private done = 0;
  readonly images: Phaser.GameObjects.Image[];

  constructor(scene: Phaser.Scene, private terrain: Terrain, private theme: Theme, depth: number) {
    const { w, h } = terrain;
    const res = (this.res = Math.min(2.5, sharpRes(w, h)));
    const W = Math.ceil(w * res);
    const H = Math.ceil(h * res);
    // The 1x mask as an image, scaled up for the edges.
    const mask = document.createElement('canvas');
    mask.width = w;
    mask.height = h;
    const mctx = mask.getContext('2d')!;
    const img = mctx.createImageData(w, h);
    for (let i = 0; i < w * h; i++) if (terrain.mask[i]) img.data[i * 4 + 3] = 255;
    mctx.putImageData(img, 0, 0);
    // The back wall's shape: the ground before the caves.
    const backMask = document.createElement('canvas');
    backMask.width = w;
    backMask.height = h;
    const bctx = backMask.getContext('2d')!;
    const bimg = bctx.createImageData(w, h);
    const src = terrain.back ?? terrain.mask;
    for (let i = 0; i < w * h; i++) if (src[i]) bimg.data[i * 4 + 3] = 255;
    bctx.putImageData(bimg, 0, 0);

    this.pattern = this.paintPattern(W, H);

    // Back wall: the first shape of the ground in dark earth.
    const back = document.createElement('canvas');
    back.width = W;
    back.height = H;
    const b = back.getContext('2d')!;
    b.fillStyle = theme.back;
    b.fillRect(0, 0, W, H);
    b.globalAlpha = 0.25;
    b.drawImage(this.pattern, 0, 0);
    b.globalAlpha = 1;
    b.fillStyle = 'rgba(0,0,0,0.35)';
    b.fillRect(0, 0, W, H);
    b.globalCompositeOperation = 'destination-in';
    b.imageSmoothingEnabled = true;
    b.drawImage(backMask, 0, 0, W, H);

    // The earth.
    const earth = (this.earth = document.createElement('canvas'));
    earth.width = W;
    earth.height = H;
    const e = earth.getContext('2d')!;
    e.drawImage(this.pattern, 0, 0);
    e.globalCompositeOperation = 'destination-in';
    e.drawImage(mask, 0, 0, W, H);
    e.globalCompositeOperation = 'source-over';
    this.paintGrass(e);

    for (const key of ['bb-back', 'bb-earth']) if (scene.textures.exists(key)) scene.textures.remove(key);
    scene.textures.addCanvas('bb-back', back);
    this.tex = scene.textures.addCanvas('bb-earth', earth)!;
    this.images = [
      scene.add.image(0, 0, 'bb-back').setOrigin(0).setScale(1 / res).setDepth(depth),
      scene.add.image(0, 0, 'bb-earth').setOrigin(0).setScale(1 / res).setDepth(depth + 1),
    ];
  }

  private paintPattern(W: number, H: number) {
    const th = this.theme;
    const r = this.res;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    g.fillStyle = th.dirt;
    g.fillRect(0, 0, W, H);
    // Strata: wavy bands that darken with depth.
    for (let i = 0; i < 9; i++) {
      g.fillStyle = i % 2 ? th.dirtDark : th.dirt;
      g.globalAlpha = 0.35 + i * 0.05;
      g.beginPath();
      g.moveTo(0, H);
      const base = H * (0.45 + i * 0.07);
      const ph = Math.random() * 6;
      for (let x = 0; x <= W; x += 8 * r) g.lineTo(x, base + Math.sin(x / (40 * r) + ph) * 8 * r);
      g.lineTo(W, H);
      g.fill();
    }
    g.globalAlpha = 1;
    // Clumps and pebbles.
    const n = Math.round((W * H) / (r * r) / 900);
    for (let i = 0; i < n; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      g.fillStyle = Math.random() < 0.5 ? th.dirtDark : th.dirtLight;
      g.globalAlpha = 0.5;
      g.beginPath();
      g.ellipse(x, y, (2 + Math.random() * 5) * r, (1.5 + Math.random() * 3) * r, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    for (let i = 0; i < n / 6; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      g.fillStyle = th.dirtLight;
      g.strokeStyle = th.dirtDark;
      g.lineWidth = r;
      g.beginPath();
      g.ellipse(x, y, 3 * r, 2.2 * r, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    }
    // Roots.
    g.strokeStyle = th.dirtDark;
    g.lineWidth = 1.2 * r;
    for (let i = 0; i < n / 10; i++) {
      let x = Math.random() * W;
      let y = Math.random() * H;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (Math.random() - 0.5) * 16 * r;
        y += Math.random() * 10 * r;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    return c;
  }

  /** Grass along every top edge of the ground, with blades poking up. */
  private paintGrass(e: CanvasRenderingContext2D) {
    const t = this.terrain;
    const r = this.res;
    const th = this.theme;
    for (let x = 0; x < t.w; x++) {
      for (let y = 1; y < t.h; y++) {
        if (!t.mask[y * t.w + x] || t.mask[(y - 1) * t.w + x]) continue;
        e.fillStyle = th.grass;
        e.fillRect(x * r, y * r, r + 0.5, 4 * r);
        e.fillStyle = th.grassDark;
        e.fillRect(x * r, (y + 4) * r, r + 0.5, 1.6 * r);
        if ((x * 7 + y) % 3 === 0) {
          e.fillStyle = th.grass;
          const hgt = (2 + ((x * 13) % 4)) * r;
          e.fillRect(x * r, y * r - hgt, r * 0.9, hgt);
        }
      }
    }
  }

  /** Replays the ground's changes since last time onto the canvas. */
  sync() {
    const ops = this.terrain.ops;
    if (this.done === ops.length) return;
    const e = this.earth.getContext('2d')!;
    const r = this.res;
    for (; this.done < ops.length; this.done++) {
      const op = ops[this.done];
      e.save();
      if (op.add) {
        e.beginPath();
        e.arc(op.x * r, op.y * r, op.r * r, 0, Math.PI * 2);
        e.clip();
        e.drawImage(this.pattern, 0, 0);
        e.strokeStyle = this.theme.dirtDark;
        e.lineWidth = 2 * r;
        e.stroke();
      } else {
        e.globalCompositeOperation = 'destination-out';
        e.beginPath();
        e.arc(op.x * r, op.y * r, op.r * r, 0, Math.PI * 2);
        e.fill();
        if (op.r >= 14) {
          // A scorched rim, only where earth is left.
          e.globalCompositeOperation = 'source-atop';
          e.strokeStyle = 'rgba(40,22,12,0.45)';
          e.lineWidth = 5 * r;
          e.beginPath();
          e.arc(op.x * r, op.y * r, (op.r + 2) * r, 0, Math.PI * 2);
          e.stroke();
        }
      }
      e.restore();
    }
    this.tex.refresh();
  }
}

/** The sky, the sun and two rows of far hills, painted once for a match. */
export function paintSky(scene: Phaser.Scene, w: number, h: number, theme: Theme) {
  const res = Math.min(2, sharpRes(w, h));
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * res);
  c.height = Math.ceil(h * res);
  const g = c.getContext('2d')!;
  g.scale(res, res);
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, theme.skyTop);
  sky.addColorStop(1, theme.skyBottom);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  const sx = w * (0.15 + Math.random() * 0.7);
  const glow = g.createRadialGradient(sx, 90, 10, sx, 90, 120);
  glow.addColorStop(0, theme.sun);
  glow.addColorStop(0.3, theme.sun + '88');
  glow.addColorStop(1, theme.sun + '00');
  g.fillStyle = glow;
  g.fillRect(sx - 120, -30, 240, 240);
  g.fillStyle = theme.sun;
  g.beginPath();
  g.arc(sx, 90, 26, 0, Math.PI * 2);
  g.fill();
  theme.hills.forEach((col, i) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, h);
    const base = h * (0.55 + i * 0.1);
    const ph = Math.random() * 6;
    for (let x = 0; x <= w; x += 6) g.lineTo(x, base - Math.sin(x / (120 - i * 30) + ph) * 40 - Math.sin(x / 37 + ph) * 12);
    g.lineTo(w, h);
    g.fill();
  });
  if (scene.textures.exists('bb-sky')) scene.textures.remove('bb-sky');
  scene.textures.addCanvas('bb-sky', c);
  return scene.add.image(0, 0, 'bb-sky').setOrigin(0).setScale(1 / res).setDepth(0);
}
