import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { VIEW } from './scenes/layout';
import { C } from './art/glow';
import { setupGame } from '../../../shared/setupGame';
import { trophies } from './trophies';
import { setupScaling } from '../../../shared/scaling';
import { howToPlay } from './howToPlay';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW.w,
  height: VIEW.h,
  backgroundColor: C.night,
  pixelArt: false,
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
