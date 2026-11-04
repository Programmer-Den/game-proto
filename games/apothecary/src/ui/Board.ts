import Phaser from 'phaser';
import { INK, SERIF, fit } from '../art/paint';
import { cardTexture } from '../art/ui';
import { viewSize } from '../../../../shared/scaling';
import { t } from '../i18n';
import { coined } from './coins';

const TEXT = { fontFamily: SERIF, fontSize: '13px', color: INK };
const PAD = 16;

type Part = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Visible;

/**
 * What a board's contents are built with, line by line from the top. Each call places a part on the
 * current line at `x` from the board's left edge; `next` moves down a line.
 */
export interface BoardKit {
  readonly width: number;
  heading(text: string): void;
  text(x: number, text: string, opts?: { color?: string; bold?: boolean; size?: number; italic?: boolean; right?: boolean; centre?: boolean }): Phaser.GameObjects.Text;
  icon(x: number, texture: string, scale?: number, alpha?: number): void;
  /** A small parchment button; a disabled one is faded and taps on it do nothing. */
  button(x: number, label: string, onTap: () => void, enabled?: boolean, w?: number): void;
  next(h?: number): void;
}

/**
 * A panel over the middle of the screen whose contents `build` lays out afresh each time it opens
 * and after every button pressed on it, so it always shows the state as it is. Like `Settings`, its
 * parts are not in a container, since taps on a container's children miss once the camera has
 * scrolled; taps on its background keep it open and the scene closes it on a tap outside.
 */
export class Board {
  private parts: Part[] = [];

  constructor(
    private scene: Phaser.Scene,
    private depth: number,
    private width: number,
    private build: (kit: BoardKit) => void,
  ) {}

  get visible() {
    return this.parts.length > 0;
  }

  toggle(open = !this.visible) {
    if (open) this.draw();
    else this.clear();
  }

  /** Lays the board out again from the state, if it is open. */
  refresh() {
    if (this.visible) this.draw();
  }

  private clear() {
    for (const part of this.parts) part.destroy();
    this.parts = [];
  }

  private draw() {
    this.clear();
    const scene = this.scene;
    const parts: Part[] = [];
    const w = this.width;
    let y = PAD;
    const kit: BoardKit = {
      width: w,
      heading: (text) => {
        parts.push(scene.add.text(w / 2, y, text, { ...TEXT, fontSize: '15px', fontStyle: 'bold', color: '#7a4a10' }).setOrigin(0.5, 0));
        y += 24;
      },
      text: (x, text, opts = {}) => {
        const style = {
          ...TEXT,
          fontSize: `${opts.size ?? 13}px`,
          color: opts.color ?? INK,
          fontStyle: [opts.bold ? 'bold' : '', opts.italic ? 'italic' : ''].join(' ').trim() || 'normal',
        };
        const part = coined(scene.add.text(x, y + 11, text, style).setOrigin(opts.right ? 1 : opts.centre ? 0.5 : 0, 0.5));
        parts.push(part);
        return part;
      },
      icon: (x, texture, scale = 1.25, alpha = 1) => {
        parts.push(fit(scene.add.image(x, y + 11, texture), scale).setAlpha(alpha));
      },
      button: (x, label, onTap, enabled = true, bw = 64) => {
        parts.push(fit(scene.add.image(x, y + 11, cardTexture(scene, 'button', bw, 22))).setAlpha(enabled ? 1 : 0.45));
        const text = scene.add
          .text(x, y + 11, label, { ...TEXT, fontSize: '12px', fontStyle: 'bold' })
          .setOrigin(0.5)
          .setAlpha(enabled ? 1 : 0.45);
        if (enabled) {
          text.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
            e.stopPropagation();
            onTap();
            this.refresh();
          });
        }
        parts.push(text);
      },
      next: (h = 26) => {
        y += h;
      },
    };
    this.build(kit);
    y += 4;
    parts.push(scene.add.text(w / 2, y, t('tapOutside'), { ...TEXT, fontSize: '12px', fontStyle: 'italic', color: '#6a5440' }).setOrigin(0.5, 0));
    const h = y + 18 + PAD;
    const view = viewSize(scene);
    const left = (view.width - w) / 2;
    const top = Math.max(4, (view.height - h) / 2);
    const bg = fit(scene.add.image(left + w / 2, top + h / 2, cardTexture(scene, 'panel', w, h)))
      .setInteractive()
      .on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => e.stopPropagation());
    for (const part of parts) part.setPosition(part.x + left, part.y + top);
    this.parts = [bg, ...parts];
    // The background goes under everything on it, which was made before it.
    for (const part of this.parts) (part as unknown as Phaser.GameObjects.Image).setScrollFactor(0).setDepth(part === bg ? this.depth : this.depth + 0.1);
  }
}
