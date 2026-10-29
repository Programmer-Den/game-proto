import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
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
  backgroundColor: '#e9dcbc',
  pixelArt: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, MenuScene, GameScene],
});
setupGame(game, { howToPlay, trophies, corner: 'top-right' });
setupScaling(game, { fill: true });

// Handy for poking at state from the browser console during development.
if (import.meta.env.DEV) Object.assign(window, { game });
