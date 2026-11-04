import Phaser from 'phaser';
import { bakeAlchemy } from '../art/alchemy';
import { bakeDoctor } from '../art/doctor';
import { bakeGarden } from '../art/garden';
import { bakeGround } from '../art/ground';
import { bakeItems } from '../art/items';
import { bakeMarkers } from '../art/markers';
import { bakePixies } from '../art/pixies';
import { bakeStations } from '../art/stations';
import { bakeTown } from '../art/town';
import { bakeTownsfolk } from '../art/townsfolk';
import { bakeUi } from '../art/ui';

// Generates all textures at runtime so the prototype needs no asset files yet.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create() {
    bakeDoctor(this);
    bakeItems(this);
    bakeGarden(this);
    bakeStations(this);
    bakeMarkers(this);
    bakePixies(this);
    bakeTownsfolk(this);
    bakeGround(this);
    bakeUi(this);
    bakeTown(this);
    bakeAlchemy(this);

    this.scene.start('Game');
  }
}
