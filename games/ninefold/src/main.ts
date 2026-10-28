import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { VIEW } from './scenes/layout';
import { setupGame } from '../../../shared/setupGame';
import { howToPlay } from './howToPlay';
import { trophies } from './trophies';
import { setupScaling } from '../../../shared/scaling';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: VIEW.w,
  height: VIEW.h,
  backgroundColor: '#f7e3d4',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
});
setupGame(game, { howToPlay, trophies });
setupScaling(game, { fill: true, bothWays: true });

// Handy for poking at state from the browser console during development, and read by the
// playthrough test.
if (import.meta.env.DEV) Object.assign(window, { game });
