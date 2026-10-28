import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { DESIGN } from './scenes/layout';
import { setupGame } from '../../../shared/setupGame';
import { howToPlay } from './howToPlay';
import { trophies } from './trophies';
import { setupScaling } from '../../../shared/scaling';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: DESIGN.w,
  height: DESIGN.h,
  backgroundColor: '#ead9b2',
  pixelArt: false,
  // Two thumbs at once on a phone: one on the helm, one on a fire control.
  input: { activePointers: 3 },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, GameScene],
});
setupGame(game, { howToPlay, trophies });
setupScaling(game, { fill: true });

// Handy for poking at state from the browser console during development, and read by the
// playthrough test.
if (import.meta.env.DEV) Object.assign(window, { game });
