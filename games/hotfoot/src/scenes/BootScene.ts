import Phaser from 'phaser';
import { bakeFoes } from '../art/foes';
import { bakeHud } from '../art/hud';
import { bakeIcons } from '../art/icons';
import { bakeKnight } from '../art/knight';
import { bakePets } from '../art/pets';
import { bakeScenery } from '../art/scenery';
import { viewSize } from '../../../../shared/scaling';
import { fitLayout } from './layout';

// Paints every texture on canvases at runtime, so the game needs no asset files.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    // The view's shape is picked once, as the game starts: fit the layout to it before painting.
    const view = viewSize(this);
    fitLayout(view.width, view.height);
    bakeScenery(this);
    bakeFoes(this);
    bakeKnight(this);
    bakePets(this);
    bakeIcons(this);
    bakeHud(this);
    this.scene.start('Game');
  }
}
