import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { setupGame } from '../../../shared/setupGame';
import { howToPlay } from './howToPlay';
import { trophies } from './trophies';
import { setupScaling } from '../../../shared/scaling';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: 960,
  height: 540,
  backgroundColor: '#1d1a26',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [GameScene],
});
// The field's floor and the map's buttons sit along the bottom, so the corner row goes top right.
setupGame(game, { howToPlay, trophies, corner: 'top-right' });
setupScaling(game, { fill: true });

// Handy for poking at state from the browser console during development, and read by the
// playthrough test.
if (import.meta.env.DEV) Object.assign(window, { game });
