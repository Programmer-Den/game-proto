import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { ShopScene } from './scenes/ShopScene';
import { TownScene } from './scenes/TownScene';
import { setupGame } from '../../../shared/setupGame';
import { howToPlay } from './howToPlay';
import { trophies } from './trophies';
import { setupScaling } from '../../../shared/scaling';

export const GAME_WIDTH = 960;
export const GAME_HEIGHT = 540;

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: '#cfc09c',
  pixelArt: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    // Step physics once per drawn frame with its real delta, so walking is as smooth as the chosen
    // frame rate rather than stepping at a fixed 60Hz.
    arcade: { debug: false, fixedStep: false },
  },
  scene: [BootScene, GameScene, TownScene, ShopScene],
});
setupGame(game, { howToPlay, trophies });
setupScaling(game, { fill: true });

// Handy for poking at state from the browser console during development.
if (import.meta.env.DEV) Object.assign(window, { game });
