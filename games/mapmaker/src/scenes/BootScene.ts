import Phaser from 'phaser';
import { bakeIcons } from '../art/icons';
import { applyTheme, sharpenArt, type Theme } from '../art/paint';
import { bakeSurveyor } from '../art/surveyor';
import { loadTheme } from '../game/save';
import type { GameState } from '../game/state';

// Paints the surveyor and the icons at runtime, so the game needs no asset files. The island
// itself is painted by GameScene, since it changes with every new isle. Switching the theme comes
// back here, so the icons are baked again in the new colours, with the running game and the picked
// theme handed along (so the switch works even when storage is blocked or full).
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(data?: { state?: GameState; atlas?: GameState | null; theme?: Theme }) {
    sharpenArt();
    applyTheme(data?.theme ?? loadTheme());
    bakeSurveyor(this);
    bakeIcons(this);
    this.scene.start('Game', { state: data?.state, atlas: data?.atlas });
  }
}
