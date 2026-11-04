import Phaser from 'phaser';
import { PAD, RES } from '../art/puppet';
import { BUTTON, FONT } from '../scenes/layout';

/**
 * A carved black card button with a glowing amber rim and a caption, brighter under the pointer.
 * `narrow` uses the 180-wide card (`btn-180`), for three buttons side by side.
 */
export function makeButton(scene: Phaser.Scene, x: number, y: number, caption: string, onClick: () => void, narrow = false) {
  const w = narrow ? 180 : BUTTON.w;
  const key = narrow ? 'btn-180' : 'btn';
  const bg = scene.add.image(-w / 2 - PAD, -BUTTON.h / 2 - PAD, key).setOrigin(0).setScale(1 / RES);
  const text = scene.add
    .text(0, 0, caption, { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#ffd08a' })
    .setOrigin(0.5)
    .setShadow(0, 0, 'rgba(255,150,70,0.8)', 6, false, true);
  const hit = scene.add.zone(0, 0, w, BUTTON.h).setInteractive({ useHandCursor: true });
  hit
    .on('pointerover', () => bg.setTexture(`${key}-hover`))
    .on('pointerout', () => bg.setTexture(key))
    .on('pointerdown', onClick);
  return scene.add.container(x, y, [bg, text, hit]);
}
