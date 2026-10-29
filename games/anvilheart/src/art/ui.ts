import Phaser from 'phaser';
import { BANNER, BARREL, BOARD, DESK, DISCOVERED, ORDER, ROW_BOX, SCRAP, TAG, WIN } from '../scenes/layout';
import { ART, PI, bake, ctx, diamond, glass, glow, glowFrame, label, lit, mix, panel, rect, reseed, ring, type Pt } from './glass';

// The leaded-glass interface: buttons, the order cards, the fit tags, the commission banner, the
// merge and buyer frames, the discovered row's frames, the set order's tick, and the streak's burst
// and sparks.

const a = (n: number) => n * ART;

/** The looks a button can take: ready, under the pointer, and disabled. */
export type ButtonState = 'on' | 'over' | 'off';
export const BUTTON_STATES: ButtonState[] = ['on', 'over', 'off'];
export const buttonTexture = (style: string, state: ButtonState) => `button-${style}-${state}`;

/** Button glass: the frame and centre pane colours, and the frame's width in art units. */
export const BUTTON_STYLES = {
  forge: { frame: '#c8962e', pane: '#a8381c', border: 12, diamonds: true },
  upgrade: { frame: '#6a5a3a', pane: '#2a3a5a', border: 8, diamonds: false },
  row: { frame: '#6a5a3a', pane: '#2a3a5a', border: 7, diamonds: false },
  wide: { frame: '#c8962e', pane: '#4a2a6a', border: 9, diamonds: false },
  mode: { frame: '#6a5a3a', pane: '#3a2a20', border: 6, diamonds: false },
};
export type ButtonStyle = keyof typeof BUTTON_STYLES;

/** The jewel on each upgrade button, by upgrade. */
export const EMBLEMS = ['#d8742a', '#7fa8d8', '#8a7aa8'];
export const emblemTexture = (i: number, locked = false) => `emblem-${i}${locked ? '-locked' : ''}`;

export function bakeUi(scene: Phaser.Scene, sizes: Record<ButtonStyle, { w: number; h: number }>) {
  for (const style of Object.keys(BUTTON_STYLES) as ButtonStyle[]) {
    const st = BUTTON_STYLES[style];
    const { w, h } = sizes[style];
    for (const state of BUTTON_STATES) {
      bake(scene, buttonTexture(style, state), w, h, () => {
        reseed(11);
        const off = state === 'off';
        const frame = off ? mix(st.frame, '#3a3446', 0.7) : st.frame;
        const pane = off ? mix(st.pane, '#2a2636', 0.65) : state === 'over' ? lit(st.pane, 0.18) : st.pane;
        panel(2, 2, a(w) - 4, a(h) - 4, frame, pane, st.border);
        if (st.diamonds) for (const x of [36, a(w) - 36]) glass(diamond(x, a(h) / 2, 14), off ? '#6a6070' : '#ffd36a', { lw: 3 });
      });
    }
  }
  EMBLEMS.forEach((col, i) => {
    for (const locked of [false, true]) {
      bake(scene, emblemTexture(i, locked), 26, 26, () => {
        glass(ring(26, 26, 22, 6, PI / 6), locked ? '#5a5068' : col, { lw: 4 });
        if (!locked) return;
        // A padlock of dark glass.
        glass([[18, 24], [34, 24], [34, 37], [18, 37]], '#2a2430', { flat: true, lw: 2 });
        ctx.strokeStyle = '#2a2430';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(26, 23, 6, PI, 0);
        ctx.stroke();
      });
    }
  });

  // The order card: a parchment pane with a speech tail towards the adventurer.
  bake(scene, 'order-card', ORDER.w + 14, ORDER.h + 6, () => {
    reseed(12);
    const x = 26;
    const y = 4;
    panel(x, y, a(ORDER.w), a(ORDER.h), '#8a6a3a', '#efe2c0', 10, true);
    glass([[x, y + 120], [x - 20, y + 150], [x, y + 140]], '#efe2c0', { lw: 4, flat: true });
  });

  // The fit tags over an adventurer while a sword they would buy is held.
  bake(scene, 'tag-exact', TAG.w + 2, TAG.h + 2, () => panel(2, 2, a(TAG.w), a(TAG.h), '#c8962e', '#2a8a3a', 6));
  bake(scene, 'tag-overkill', TAG.w + 2, TAG.h + 2, () => panel(2, 2, a(TAG.w), a(TAG.h), '#5a5060', '#3a3444', 6));

  // The hammer streak's tag over the anvil.
  bake(scene, 'streak-tag', 182, 30, () => panel(2, 2, 360, 56, '#c8962e', '#a0281c', 8));

  // The merge outline round a matching sword's anvil, and the buyer outline round a desk.
  const gm = 30;
  bake(scene, 'frame-gold', BOARD.cell - 14 + gm, BOARD.cell - 14 + gm, () => glowFrame(gm, gm, a(BOARD.cell - 14), a(BOARD.cell - 14), '#f0b830'));
  bake(scene, 'frame-green', DESK.w - 6 + gm, DESK.h - 6 + gm, () => glowFrame(gm, gm, a(DESK.w - 6), a(DESK.h - 6), '#5ad06a', 10));

  // The discovered row: a blue pane once a sword is made, a dark one with a question mark before.
  const s = a(DISCOVERED.size);
  bake(scene, 'disc-on', DISCOVERED.size, DISCOVERED.size, () => panel(0, 0, s, s, '#6a5a3a', '#2a3a6a', 6));
  bake(scene, 'disc-off', DISCOVERED.size, DISCOVERED.size, () => {
    panel(0, 0, s, s, '#3a3446', '#1a1824', 6);
    label('?', s / 2, s / 2 + 3, 32, '#6a6080', { sw: 0 });
  });

  // The royal commission's banner: purple glass in a gold frame, with a crowned ruby seal.
  bake(scene, 'banner', BANNER.w, BANNER.h, () => {
    reseed(13);
    const w = a(BANNER.w);
    const h = a(BANNER.h);
    panel(0, 0, w, h, '#c8962e', '#5a2a7a', 7);
    glass(ring(38, h / 2, 22, 12), '#c03050', { lw: 4, hi: 0.5 });
    glass([[27, 40], [29, 24], [38, 33], [47, 24], [49, 40]], '#ffd36a', { lw: 2, flat: true });
  });
  bake(scene, 'pip-on', 14, 14, () => glass(diamond(14, 14, 11), '#bfe6ff', { lw: 2.5, flat: true }));
  bake(scene, 'pip-off', 14, 14, () => glass(diamond(14, 14, 11), '#2a1a3a', { lw: 2.5, flat: true }));
  bake(scene, 'star', 22, 22, () => {
    const pts: Pt[] = [];
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? 9 : 20;
      const t = -PI / 2 + (k / 10) * PI * 2;
      pts.push([22 + Math.cos(t) * r, 23 + Math.sin(t) * r]);
    }
    glass(pts, '#f6c440', { lw: 3, hi: 0.5, flat: true });
  });

  // The streak's rose burst of amber shards, and one loose spark.
  bake(scene, 'burst', 90, 90, () => {
    glow(90, 90, 90, '#ffd070', 0.6);
    for (let k = 0; k < 16; k++) {
      const t = (k / 16) * PI * 2;
      const at = (r: number, d: number): Pt => [90 + Math.cos(t + d) * r, 90 + Math.sin(t + d) * r];
      glass([at(48, -0.17), at(88, 0), at(48, 0.17)], k % 2 ? '#ffb02e' : '#ffe08a', { lw: 3, flat: true });
    }
  });
  // The green tick over the half of a set order already handed over.
  bake(scene, 'tick', 30, 30, () => glass([[8, 30], [20, 20], [28, 32], [50, 8], [56, 16], [28, 48]], '#5ad06a', { lw: 4, flat: true, hi: 0.4 }));
  bake(scene, 'spark', 10, 10, () => glass([[4, 10], [16, 4], [12, 16]], '#ffd36a', { lw: 2, flat: true }));

  // A soft light for the commission's completion.
  bake(scene, 'halo', 120, 120, () => glow(120, 120, 120, '#ffe7a0', 0.8));

  // The delivery outline round the banner while a sword the crown wants is held.
  bake(scene, 'frame-banner', BANNER.w + gm, BANNER.h + gm, () => glowFrame(gm, gm, a(BANNER.w), a(BANNER.h), '#f0b830', 8));
  // The barrel's merge outline.
  bake(scene, 'frame-barrel', BARREL.w + gm, BARREL.h + gm, () => glowFrame(gm, gm, a(BARREL.w), a(BARREL.h), '#f0b830', 8));

  // The scrap bin and the outline round it while something is held.
  bake(scene, 'scrap', SCRAP.w, SCRAP.h, scrapBin);
  bake(scene, 'frame-scrap', SCRAP.w + gm, SCRAP.h + gm, () => glowFrame(gm, gm, a(SCRAP.w), a(SCRAP.h), '#e0904a', 8));

  // The fifth row before it is bought: smoky glass over its panes.
  bake(scene, 'row-locked', ROW_BOX.w, ROW_BOX.h, () => {
    reseed(15);
    panel(4, 4, a(ROW_BOX.w) - 8, a(ROW_BOX.h) - 8, '#4a3e30', '#1e1a2a', 8);
  });

  // The quench barrel, bought and not yet bought.
  for (const off of [false, true]) bake(scene, off ? 'barrel-off' : 'barrel', BARREL.w, BARREL.h, () => barrel(off));

  // The win window: purple glass in a gold frame, with a crowned ruby seal like the banner's; and a
  // taller one for the guild perks and the charter's edicts.
  for (const [key, h] of [['win-panel', WIN.h], ['tall-panel', WIN.tallH]] as const) {
    bake(scene, key, WIN.w, h, () => {
      reseed(16);
      const w = a(WIN.w);
      panel(0, 0, w, a(h), '#c8962e', '#3a1e5a', 14);
      glass(ring(w / 2, 70, 40, 14), '#c03050', { lw: 5, hi: 0.5 });
      glass([[w / 2 - 22, 84], [w / 2 - 18, 52], [w / 2, 68], [w / 2 + 18, 52], [w / 2 + 22, 84]], '#ffd36a', { lw: 3, flat: true });
    });
  }
}

/** An iron scrap pail with a broken blade and a bent hilt poking out of its dark mouth. */
function scrapBin() {
  reseed(18);
  const w = a(SCRAP.w);
  const h = a(SCRAP.h);
  const top = 46;
  glass([[w / 2 - 6, top + 4], [w / 2 + 14, 12], [w / 2 + 26, 18], [w / 2 + 10, top + 4]], '#9aa4b8', { lw: 3, flat: true });
  glass([[w / 2 - 30, top + 2], [w / 2 - 40, 22], [w / 2 - 30, 18], [w / 2 - 20, top]], '#8a6a3a', { lw: 3, flat: true });
  glass([[10, top], [w - 10, top], [w - 22, h - 6], [22, h - 6]], '#4a5266', { lw: 4 });
  glass(rect(14, top + 30, w - 28, 10), '#6a7288', { lw: 3, flat: true });
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(w / 2, top, w / 2 - 10, 12, 0, 0, PI * 2);
  ctx.fillStyle = '#1a1622';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#17131c';
  ctx.stroke();
  ctx.restore();
}

/** A barrel of leaded staves and iron bands, with dark quench water at its mouth; dim before it is bought. */
function barrel(off: boolean) {
  reseed(17);
  const dim = (c: string) => (off ? mix(c, '#2a2636', 0.65) : c);
  const w = a(BARREL.w);
  const h = a(BARREL.h);
  const staves = 5;
  const top = 26;
  const bottom = h - 6;
  for (let k = 0; k < staves; k++) {
    const x0 = 10 + ((w - 20) * k) / staves;
    const x1 = 10 + ((w - 20) * (k + 1)) / staves;
    // The staves bulge out at the middle.
    const bulge = (x: number) => (x - w / 2) * 0.1;
    glass([[x0, top], [x1, top], [x1 + bulge(x1), h / 2], [x1, bottom], [x0, bottom], [x0 + bulge(x0), h / 2]], dim(k % 2 ? '#8a5a2a' : '#a06a34'), { lw: 4 });
  }
  for (const y of [top + 24, bottom - 26]) glass(rect(6, y, w - 12, 12), dim('#5a6278'), { lw: 3, flat: true });
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(w / 2, top, w / 2 - 8, 18, 0, 0, PI * 2);
  ctx.fillStyle = dim('#8a5a2a');
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#17131c';
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(w / 2, top, w / 2 - 18, 11, 0, 0, PI * 2);
  ctx.fillStyle = dim('#2a4a7a');
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}
