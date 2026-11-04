import Phaser from 'phaser';
import type { EnemyKind } from '../game/enemies';
import { dark, facet, gem, light, line, ngon, paint, poly, rect, softShadow, type Pt } from './lowpoly';

// The ranger, the foes and the missiles as faceted low-poly figures, each part a flat-shaded
// pyramid lit from the top left, with a soft shadow on the road to the lower right. A figure is a
// rig: a list of parts in local units with the feet at 0,0 and up negative. Foes face left, towards
// the barricade; the ranger faces right. Each foe has two walk frames (its legs apart and together).

type Rig = { m: string; p?: Pt[]; c?: Pt; r?: number }[];

const PAL: Record<string, string> = {
  skin: '#79b24a', skinD: '#5a8d36', tunic: '#8b5a32', belt: '#4c3020', eye: '#ffd84a', steel: '#c9d2dc', boot: '#3d2b1d',
  cloth: '#5e4532', leather: '#86522c', iron: '#7d8590', bone: '#efe5c9', wood: '#93653a', plate: '#4a4f62', plateL: '#5d6379',
  tabard: '#5b2f66', plume: '#b8343c', shield: '#2f4f8a', gold: '#e5b53a', cloakD: '#245c34', cloak: '#3a8a46',
  trousers: '#4f4766', face: '#e3ad84', fletch: '#efe7d4', eyeD: '#2a1c14', gemP: '#9b4fd1',
  tower: '#3b5578', harpy: '#7a6a9a', harpyD: '#564a74', harpyW: '#9a8ab8', harpyF: '#d8b8a0', hair: '#3a2a4a',
  robe: '#6a3e7a', robeD: '#4a2a58', gemG: '#5ad07a', teal: '#3a8a8a', blue: '#3a5f9a', mrobe: '#2f6f7a', mrobeD: '#22525c',
  beard: '#e8e2d8', arcane: '#6fe0d0',
  fur: '#c8d4e0', furD: '#8e9cb0', furL: '#eef3f8', ice: '#a8dcf8', iceD: '#6aaee0',
  wshield: '#2f7a4a',
};

const RIGS: Record<'hero' | 'goblin' | 'orc' | 'knight' | 'bearer' | 'shaman' | 'spear' | 'mage' | 'warden', Rig> = {
  // The warden hero, facing right: in plate under a green tabard, a mace raised behind and a green
  // kite shield held out in front.
  warden: [
    { m: 'cloakD', p: [[-28, -30], [-8, -24], [-6, -98], [-24, -94]] },
    { m: 'wood', p: [[-10, -78], [-4, -82], [-26, -128], [-31, -125]] },
    { m: 'steel', c: [-30, -132], r: 9 },
    { m: 'boot', p: [[-17, 0], [-2, 0], [-2, -11], [-15, -11]] },
    { m: 'boot', p: [[4, 0], [20, 0], [17, -11], [4, -11]] },
    { m: 'plate', p: [[-15, -10], [-3, -10], [-3, -42], [-15, -42]] },
    { m: 'plate', p: [[4, -10], [16, -10], [15, -42], [4, -42]] },
    { m: 'plateL', p: [[-19, -38], [19, -38], [17, -88], [-17, -90]] },
    { m: 'cloak', p: [[-10, -40], [10, -40], [9, -84], [-9, -84]] },
    { m: 'belt', p: [[-18, -48], [18, -48], [18, -55], [-18, -55]] },
    { m: 'face', p: [[-6, -88], [-6, -108], [8, -108], [12, -98], [8, -88]] },
    { m: 'steel', p: [[-12, -100], [-10, -118], [6, -122], [15, -106], [13, -100]] },
    { m: 'eyeD', p: [[4, -102], [8, -102], [8, -98], [4, -98]] },
    { m: 'plateL', p: [[-8, -82], [-2, -84], [-18, -100], [-24, -96]] },
    { m: 'wshield', p: [[12, -100], [40, -100], [42, -64], [26, -30], [10, -64]] },
    { m: 'gold', p: [[12, -100], [40, -100], [40, -95], [12, -95]] },
    { m: 'gold', c: [26, -70], r: 6 },
  ],
  goblin: [
    { m: 'skinD', p: [[3, 0], [11, 0], [10, -22], [3, -22]] },
    { m: 'skinD', p: [[14, -44], [20, -42], [22, -26], [16, -24]] },
    { m: 'skin', p: [[-11, 0], [-2, 0], [-3, -22], [-11, -22]] },
    { m: 'tunic', p: [[-15, -18], [15, -18], [12, -46], [-12, -46]] },
    { m: 'belt', p: [[-14, -24], [14, -24], [14, -29], [-14, -29]] },
    { m: 'skinD', p: [[10, -62], [30, -76], [14, -54]] },
    { m: 'skin', p: [[-17, -52], [-15, -68], [-4, -76], [9, -72], [13, -58], [7, -47], [-8, -45]] },
    { m: 'skin', p: [[-14, -64], [-34, -74], [-16, -57]] },
    { m: 'eye', p: [[-12, -63], [-6, -64], [-6, -59], [-12, -59]] },
    { m: 'eye', p: [[-2, -63], [3, -63], [3, -59], [-2, -59]] },
    { m: 'skin', p: [[-12, -44], [-5, -41], [-16, -27], [-22, -31]] },
    { m: 'steel', p: [[-22, -30], [-17, -27], [-31, -10], [-35, -13]] },
  ],
  orc: [
    { m: 'boot', p: [[4, 0], [19, 0], [17, -9], [4, -9]] },
    { m: 'cloth', p: [[4, -8], [16, -8], [15, -30], [4, -30]] },
    { m: 'skinD', p: [[17, -62], [28, -58], [30, -34], [20, -34]] },
    { m: 'boot', p: [[-18, 0], [-3, 0], [-3, -9], [-16, -9]] },
    { m: 'cloth', p: [[-15, -8], [-3, -8], [-4, -30], [-15, -30]] },
    { m: 'leather', p: [[-21, -27], [21, -27], [23, -64], [-21, -66]] },
    { m: 'belt', p: [[-21, -27], [21, -27], [21, -35], [-21, -35]] },
    { m: 'skin', p: [[-19, -66], [-21, -82], [-12, -92], [6, -92], [13, -82], [11, -66], [-2, -62]] },
    { m: 'iron', p: [[-23, -82], [-15, -98], [2, -103], [14, -94], [15, -82]] },
    { m: 'bone', p: [[-18, -70], [-15, -78], [-13, -70]] },
    { m: 'eye', p: [[-16, -84], [-9, -84], [-9, -80], [-16, -80]] },
    { m: 'iron', p: [[-25, -60], [-8, -68], [-3, -57], [-23, -51]] },
    { m: 'skin', p: [[-15, -60], [-6, -55], [-23, -79], [-29, -75]] },
    { m: 'wood', p: [[-28, -70], [-24, -73], [-31, -116], [-35, -114]] },
    { m: 'steel', p: [[-32, -108], [-50, -122], [-52, -100], [-33, -98]] },
  ],
  knight: [
    { m: 'plate', p: [[4, 0], [16, 0], [15, -34], [4, -34]] },
    { m: 'plate', p: [[-15, 0], [-3, 0], [-4, -34], [-15, -34]] },
    { m: 'steel', p: [[14, -62], [19, -64], [33, -108], [28, -110]] },
    { m: 'gold', p: [[9, -63], [24, -58], [25, -63], [10, -68]] },
    { m: 'plateL', p: [[-21, -31], [21, -31], [21, -72], [-19, -74]] },
    { m: 'tabard', p: [[-12, -31], [11, -31], [9, -62], [-10, -62]] },
    { m: 'plate', p: [[-17, -72], [-19, -94], [-7, -104], [10, -102], [17, -90], [15, -72]] },
    { m: 'eye', p: [[-19, -88], [-5, -88], [-5, -84], [-19, -84]] },
    { m: 'plume', p: [[2, -102], [10, -116], [24, -114], [31, -100], [15, -97]] },
    { m: 'shield', p: [[-38, -66], [-15, -66], [-15, -38], [-26, -24], [-38, -38]] },
    { m: 'gold', c: [-26.5, -48], r: 6 },
  ],
  // An orc in mail behind a tower shield as tall as he is.
  bearer: [
    { m: 'boot', p: [[4, 0], [19, 0], [17, -9], [4, -9]] },
    { m: 'cloth', p: [[4, -8], [16, -8], [15, -30], [4, -30]] },
    { m: 'boot', p: [[-18, 0], [-3, 0], [-3, -9], [-16, -9]] },
    { m: 'cloth', p: [[-15, -8], [-3, -8], [-4, -30], [-15, -30]] },
    { m: 'iron', p: [[-21, -27], [21, -27], [23, -64], [-21, -66]] },
    { m: 'belt', p: [[-21, -27], [21, -27], [21, -35], [-21, -35]] },
    { m: 'skin', p: [[-19, -66], [-21, -82], [-12, -92], [6, -92], [13, -82], [11, -66], [-2, -62]] },
    { m: 'iron', p: [[-23, -82], [-15, -98], [2, -103], [14, -94], [15, -82]] },
    { m: 'iron', p: [[-17, -84], [-13, -84], [-13, -70], [-17, -70]] },
    { m: 'bone', p: [[-18, -70], [-15, -78], [-13, -70]] },
    { m: 'eye', p: [[-12, -84], [-6, -84], [-6, -80], [-12, -80]] },
    { m: 'skin', p: [[-6, -60], [4, -56], [-20, -44], [-27, -50]] },
    { m: 'tower', p: [[-46, -98], [-26, -102], [-22, -6], [-42, -2]] },
    { m: 'gold', p: [[-46, -98], [-26, -102], [-26, -96], [-46, -92]] },
    { m: 'gold', p: [[-42, -8], [-22, -12], [-22, -6], [-42, -2]] },
    { m: 'gold', c: [-34, -52], r: 7 },
  ],
  // A goblin shaman in a hooded robe and a bone mask, with a staff topped by a green healing stone.
  shaman: [
    { m: 'skinD', p: [[3, 0], [11, 0], [10, -22], [3, -22]] },
    { m: 'skin', p: [[-11, 0], [-2, 0], [-3, -22], [-11, -22]] },
    { m: 'robe', p: [[-18, -8], [17, -8], [12, -50], [-12, -50]] },
    { m: 'bone', p: [[-15, -26], [15, -26], [15, -31], [-15, -31]] },
    { m: 'skinD', p: [[10, -62], [30, -76], [14, -54]] },
    { m: 'skin', p: [[-17, -52], [-15, -68], [-4, -76], [9, -72], [13, -58], [7, -47], [-8, -45]] },
    { m: 'skin', p: [[-14, -64], [-34, -74], [-16, -57]] },
    { m: 'robeD', p: [[-12, -70], [-4, -86], [12, -88], [20, -64], [12, -50], [6, -70]] },
    { m: 'teal', p: [[8, -86], [18, -100], [16, -82]] },
    { m: 'bone', p: [[-20, -67], [-6, -70], [-4, -56], [-12, -49], [-19, -56]] },
    { m: 'eye', p: [[-16, -63], [-11, -63], [-11, -60], [-16, -60]] },
    { m: 'wood', p: [[-28, -2], [-24, -2], [-26, -94], [-30, -94]] },
    { m: 'skin', p: [[-10, -44], [-4, -40], [-22, -54], [-27, -50]] },
    { m: 'gemG', c: [-28, -100], r: 7 },
  ],
  // The hired guards face right, like the ranger: a spearman with a round shield on his back...
  spear: [
    { m: 'shield', c: [-15, -62], r: 13 },
    { m: 'boot', p: [[-17, 0], [-2, 0], [-2, -11], [-15, -11]] },
    { m: 'boot', p: [[4, 0], [20, 0], [17, -11], [4, -11]] },
    { m: 'trousers', p: [[-15, -10], [-3, -10], [-3, -42], [-15, -42]] },
    { m: 'trousers', p: [[4, -10], [16, -10], [15, -42], [4, -42]] },
    { m: 'blue', p: [[-15, -38], [15, -38], [13, -82], [-13, -84]] },
    { m: 'gold', p: [[-3, -40], [3, -40], [3, -80], [-3, -80]] },
    { m: 'belt', p: [[-15, -48], [15, -48], [15, -54], [-15, -54]] },
    { m: 'face', p: [[-8, -82], [-8, -104], [6, -106], [11, -96], [6, -82]] },
    { m: 'steel', p: [[-12, -96], [-8, -113], [6, -115], [14, -100], [12, -95]] },
    { m: 'eyeD', p: [[3, -99], [7, -99], [7, -95], [3, -95]] },
    { m: 'wood', p: [[-22, -60], [60, -74], [60, -70], [-22, -56]] },
    { m: 'steel', p: [[58, -79], [78, -73], [58, -65]] },
    { m: 'blue', p: [[0, -76], [8, -79], [26, -66], [20, -61]] },
  ],
  // ...and a mage in a long robe and pointed hat, with a staff topped by an arcane stone.
  mage: [
    { m: 'mrobeD', p: [[-17, 0], [17, 0], [12, -50], [-12, -50]] },
    { m: 'mrobe', p: [[-14, -44], [14, -44], [12, -84], [-12, -86]] },
    { m: 'gold', p: [[-14, -48], [14, -48], [14, -53], [-14, -53]] },
    { m: 'face', p: [[-6, -84], [-6, -103], [8, -103], [11, -93], [7, -84]] },
    { m: 'beard', p: [[-4, -92], [11, -92], [6, -68], [-2, -74]] },
    { m: 'eyeD', p: [[3, -99], [7, -99], [7, -96], [3, -96]] },
    { m: 'mrobeD', p: [[-17, -97], [19, -97], [17, -103], [-15, -103]] },
    { m: 'mrobe', p: [[-11, -101], [13, -101], [-6, -140]] },
    { m: 'gold', c: [1, -106], r: 3 },
    { m: 'wood', p: [[24, -2], [28, -2], [30, -112], [26, -112]] },
    { m: 'skin', p: [[4, -80], [10, -80], [29, -70], [25, -64]] },
    { m: 'arcane', c: [28, -119], r: 8 },
  ],
  hero: [
    { m: 'cloakD', p: [[-28, -28], [-6, -22], [-4, -102], [-24, -98]] },
    { m: 'boot', p: [[-17, 0], [-2, 0], [-2, -11], [-15, -11]] },
    { m: 'boot', p: [[4, 0], [20, 0], [17, -11], [4, -11]] },
    { m: 'trousers', p: [[-15, -10], [-3, -10], [-3, -42], [-15, -42]] },
    { m: 'trousers', p: [[4, -10], [16, -10], [15, -42], [4, -42]] },
    { m: 'leather', p: [[-27, -70], [-17, -104], [-10, -102], [-20, -66]] },
    { m: 'fletch', p: [[-17, -104], [-22, -114], [-13, -108]] },
    { m: 'fletch', p: [[-12, -103], [-12, -114], [-8, -104]] },
    { m: 'tunic', p: [[-17, -38], [17, -38], [15, -86], [-15, -88]] },
    { m: 'belt', p: [[-17, -48], [17, -48], [17, -55], [-17, -55]] },
    { m: 'cloak', p: [[-19, -84], [-23, -110], [-8, -128], [11, -126], [19, -110], [17, -92], [4, -84]] },
    { m: 'face', p: [[1, -93], [1, -115], [13, -115], [17, -105], [13, -93]] },
    { m: 'eyeD', p: [[8, -109], [12, -109], [12, -105], [8, -105]] },
    { m: 'tunic', p: [[8, -82], [14, -84], [42, -76], [40, -69]] },
    { m: 'face', p: [[38, -78], [46, -78], [46, -70], [38, -70]] },
  ],
};

/**
 * The three bosses share one hulking body: a pot belly, long arms, a small head with tusks, and
 * each their own colours, headgear and weapon.
 */
function bossRig(kind: 'troll' | 'ogre' | 'giant' | 'chieftain'): { rig: Rig; pal: Record<string, string> } {
  const pal = {
    troll: { skin: '#6f9a4a', skinD: '#4f7434', hide: '#6a4a2c', gear: '#e5b53a', gearD: '#b8862c', weapon: '#7a5230', tip: '#9aa4ae' },
    ogre: { skin: '#c08a5c', skinD: '#94643e', hide: '#4a3a5a', gear: '#7d8590', gearD: '#555c66', weapon: '#6a4426', tip: '#d8e0e8' },
    giant: { skin: '#8fb6d8', skinD: '#6488ac', hide: '#e8eef4', gear: '#c8ecff', gearD: '#7fbde6', weapon: '#a9dcf4', tip: '#ffffff' },
    // The frozen pass's Yeti Chieftain: white fur, a horned head with a crown of ice, an ice-spiked club.
    chieftain: { skin: '#e4ebf2', skinD: '#b4c2d2', hide: '#5a6c88', gear: '#8fd0f4', gearD: '#4f8fc0', weapon: '#7a8ca4', tip: '#d8f4ff' },
  }[kind];
  const body: Rig = [
    { m: 'skinD', p: [[6, 0], [28, 0], [26, -42], [8, -42]] },
    { m: 'skinD', p: [[24, -104], [40, -96], [42, -54], [28, -52]] },
    { m: 'skin', p: [[-26, 0], [-4, 0], [-6, -42], [-24, -42]] },
    { m: 'skinD', p: [[-30, 0], [-2, 0], [-4, -8], [-28, -8]] },
    { m: 'hide', p: [[-30, -34], [28, -34], [24, -54], [-28, -54]] },
    { m: 'skin', p: [[-36, -50], [32, -50], [38, -92], [22, -114], [-22, -116], [-38, -94]] },
    { m: 'skin', p: [[-26, -110], [-28, -128], [-16, -142], [4, -142], [14, -130], [12, -112]] },
    { m: 'skinD', p: [[-28, -126], [-36, -121], [-25, -117]] },
    { m: 'bone', p: [[-23, -116], [-21, -125], [-17, -116]] },
    { m: 'bone', p: [[-9, -114], [-7, -123], [-4, -114]] },
    { m: 'eye', p: [[-21, -131], [-14, -131], [-14, -127], [-21, -127]] },
  ];
  const head: Rig =
    kind === 'troll'
      ? [
          { m: 'gear', p: [[-24, -140], [-26, -160], [-16, -150], [-7, -165], [2, -150], [11, -160], [11, -140]] },
          { m: 'gemP', c: [-7, -146], r: 3.5 },
        ]
      : kind === 'chieftain'
        ? [
            { m: 'bone', p: [[-26, -134], [-48, -158], [-40, -132]] },
            { m: 'bone', p: [[8, -134], [26, -160], [18, -130]] },
            { m: 'gear', p: [[-22, -140], [-20, -158], [-12, -146], [-6, -164], [0, -146], [6, -156], [8, -140]] },
            { m: 'gearD', p: [[-6, -164], [0, -146], [-6, -143]] },
          ]
        : kind === 'ogre'
        ? [
            { m: 'gear', p: [[-28, -128], [-24, -148], [-8, -156], [8, -150], [16, -130]] },
            { m: 'bone', p: [[-24, -146], [-40, -160], [-36, -170], [-22, -152]] },
            { m: 'bone', p: [[10, -146], [22, -164], [26, -158], [16, -140]] },
          ]
        : [
            { m: 'gear', p: [[-24, -140], [-28, -168], [-18, -150], [-10, -176], [-2, -150], [8, -170], [12, -140]] },
            { m: 'gearD', p: [[-10, -176], [-2, -150], [-10, -146]] },
          ];
  const weapon: Rig =
    kind === 'ogre'
      ? [
          { m: 'weapon', p: [[-44, -60], [-38, -58], [-46, -168], [-52, -166]] },
          { m: 'tip', p: [[-50, -160], [-80, -170], [-84, -134], [-50, -140]] },
          { m: 'tip', p: [[-48, -160], [-30, -156], [-30, -144], [-48, -144]] },
        ]
      : [
          { m: 'weapon', p: [[-50, -62], [-38, -58], [-46, -150], [-66, -146]] },
          { m: 'tip', p: [[-64, -140], [-74, -144], [-64, -132]] },
          { m: 'tip', p: [[-50, -146], [-48, -158], [-42, -146]] },
          { m: 'tip', p: [[-62, -116], [-72, -116], [-62, -108]] },
        ];
  const arm: Rig = [{ m: 'skin', p: [[-30, -106], [-12, -98], [-34, -58], [-48, -64]] }];
  return { rig: [...body, ...head, ...weapon, ...arm], pal: { ...PAL, ...pal } };
}

/**
 * The harpy flies, so its two frames beat its wings (up and down) instead of stepping its legs: a
 * feathered body with gold talons, a pale face and wild dark hair.
 */
function harpyRig(frame: number): Rig {
  const back: Rig =
    frame === 0
      ? [{ m: 'harpyD', p: [[0, -44], [18, -92], [36, -98], [28, -70], [12, -40]] }]
      : [{ m: 'harpyD', p: [[0, -40], [26, -26], [42, -8], [22, -20], [10, -34]] }];
  const front: Rig =
    frame === 0
      ? [{ m: 'harpyW', p: [[-4, -42], [-22, -94], [2, -86], [14, -46]] }]
      : [{ m: 'harpyW', p: [[-4, -40], [-32, -22], [-38, -2], [-14, -22], [8, -36]] }];
  return [
    ...back,
    { m: 'gold', p: [[-5, 0], [-1, -10], [3, 0]] },
    { m: 'gold', p: [[5, 0], [8, -10], [12, 0]] },
    { m: 'harpyD', p: [[-3, -8], [11, -8], [9, -22], [-1, -22]] },
    { m: 'harpyD', p: [[10, -26], [32, -14], [28, -32]] },
    { m: 'harpy', p: [[-14, -22], [14, -20], [16, -44], [-6, -54], [-16, -44]] },
    { m: 'harpyF', p: [[-22, -52], [-20, -66], [-8, -72], [2, -66], [0, -52], [-10, -48]] },
    { m: 'hair', p: [[-10, -72], [8, -76], [16, -56], [2, -54], [0, -66]] },
    { m: 'eye', p: [[-18, -63], [-13, -63], [-13, -60], [-18, -60]] },
    ...front,
  ];
}

/**
 * The frozen pass's frost wolf, on four legs: a pale grey coat, a long snout and a bushy tail. Its
 * legs (below the hips, y -44) step in the walk frames like any foe's.
 */
const WOLF: Rig = [
  { m: 'furD', p: [[20, 0], [28, 0], [28, -26], [20, -28]] },
  { m: 'furD', p: [[-22, 0], [-14, 0], [-14, -28], [-22, -28]] },
  { m: 'furD', p: [[28, -36], [54, -50], [50, -40], [30, -30]] },
  { m: 'fur', p: [[-28, -26], [32, -24], [34, -46], [-22, -52]] },
  { m: 'furL', p: [[-20, -24], [22, -24], [20, -30], [-18, -32]] },
  { m: 'fur', p: [[12, 0], [22, 0], [24, -28], [14, -30]] },
  { m: 'fur', p: [[-30, 0], [-20, 0], [-18, -30], [-28, -30]] },
  { m: 'fur', p: [[-46, -52], [-32, -64], [-18, -60], [-12, -46], [-26, -40]] },
  { m: 'furL', p: [[-60, -46], [-44, -54], [-38, -44], [-54, -40]] },
  { m: 'furD', p: [[-34, -60], [-32, -74], [-24, -62]] },
  { m: 'eyeD', p: [[-62, -48], [-57, -48], [-57, -44], [-62, -44]] },
  { m: 'eye', p: [[-41, -55], [-36, -55], [-36, -51], [-41, -51]] },
];

/**
 * The ice wisp flies like a harpy: a shard of glowing ice with a trailing swirl, which sways
 * between its two frames instead of stepping.
 */
function wispRig(frame: number): Rig {
  const tail: Rig =
    frame === 0
      ? [{ m: 'iceD', p: [[6, -26], [30, -14], [42, -26], [18, -38]] }]
      : [{ m: 'iceD', p: [[6, -30], [34, -40], [44, -24], [16, -22]] }];
  return [
    ...tail,
    { m: 'ice', p: [[-16, -40], [0, -66], [16, -42], [2, -14]] },
    { m: 'furL', p: [[-10, -42], [0, -58], [4, -42], [0, -24]] },
    { m: 'arcane', c: [0, -42], r: 7 },
    { m: 'eyeD', p: [[-9, -50], [-5, -50], [-5, -46], [-9, -46]] },
    { m: 'eyeD', p: [[1, -50], [5, -50], [5, -46], [1, -46]] },
  ];
}

/**
 * The siege engines on the barricade, facing right: the ballista, a great crossbow on a stand with
 * a bolt laid on, and the catapult, a wheeled frame with its arm thrown back and a stone in the cup.
 */
const BALLISTA: Rig = [
  { m: 'wood', p: [[-30, 0], [30, 0], [28, -10], [-28, -10]] },
  { m: 'wood', p: [[-6, -10], [6, -10], [4, -40], [-4, -40]] },
  { m: 'iron', p: [[28, -50], [33, -48], [18, -82], [13, -80]] },
  { m: 'iron', p: [[28, -40], [33, -42], [18, -10], [13, -12]] },
  { m: 'wood', p: [[-36, -48], [40, -50], [40, -40], [-36, -38]] },
  { m: 'gold', p: [[24, -51], [32, -51], [32, -39], [24, -39]] },
  { m: 'steel', p: [[-24, -52], [44, -54], [44, -50], [-24, -48]] },
  { m: 'steel', p: [[44, -58], [60, -52], [44, -46]] },
];
const CATAPULT: Rig = [
  { m: 'wood', p: [[-34, -6], [34, -6], [32, -16], [-32, -16]] },
  { m: 'iron', c: [-22, -8], r: 9 },
  { m: 'iron', c: [22, -8], r: 9 },
  { m: 'wood', p: [[-4, -16], [8, -16], [6, -50], [-2, -50]] },
  { m: 'gold', p: [[-8, -50], [12, -50], [12, -55], [-8, -55]] },
  { m: 'wood', p: [[0, -50], [6, -46], [-34, -70], [-38, -76]] },
  { m: 'leather', p: [[-48, -76], [-30, -78], [-32, -68], [-46, -66]] },
  { m: 'iron', c: [-39, -81], r: 7 },
];

/** How big each figure is drawn: view pixels per rig unit. */
const SCALE: Record<'hero' | 'spear' | 'mage' | EnemyKind, number> = {
  hero: 0.5, spear: 0.44, mage: 0.44, goblin: 0.61, orc: 0.57, knight: 0.55, harpy: 0.6, bearer: 0.57, shaman: 0.61, wolf: 0.6, wisp: 0.62,
  troll: 0.78, ogre: 0.8, giant: 0.84, chieftain: 0.86,
};

/** Where a figure's feet are in its texture (as an origin) and how tall it stands, in view pixels. */
export interface Figure {
  originX: number;
  originY: number;
  height: number;
}
export const FIGURES: Partial<Record<string, Figure>> = {};

export const foeTexture = (kind: EnemyKind, frame: number) => `foe-${kind}-${frame}`;
export const guardTexture = (kind: 'spear' | 'mage') => `guard-${kind}`;

/** The hero's texture for a class: the ranger with a bow, the mage hero in violet robes, or the warden with shield and mace. */
export const heroTexture = (hero: 'ranger' | 'mage' | 'warden') => (hero === 'mage' ? 'hero-mage' : hero === 'warden' ? 'hero-warden' : 'hero');
/** The warden's hound, in its two running frames (facing left, like the frost wolf it is drawn from). */
export const houndTexture = (frame: number) => `hound-${frame}`;
/** A siege engine on the barricade. */
export const engineTexture = (kind: 'ballista' | 'catapult') => `engine-${kind}`;

export function bakeCharacters(scene: Phaser.Scene) {
  bakeFigure(scene, 'hero', RIGS.hero, PAL, SCALE.hero, drawBow);
  bakeFigure(scene, 'hero-mage', RIGS.mage, { ...PAL, mrobe: '#5a3f9a', mrobeD: '#3d2a70', arcane: '#d6a8ff' }, SCALE.hero);
  bakeFigure(scene, 'hero-warden', RIGS.warden, PAL, SCALE.hero);
  // The hound is the frost wolf's body in a brown coat, smaller.
  for (const frame of [0, 1]) bakeFigure(scene, houndTexture(frame), stride(WOLF, frame), { ...PAL, fur: '#9a6a3c', furD: '#6e4826', furL: '#c89a68' }, 0.5);
  bakeFigure(scene, engineTexture('ballista'), BALLISTA, PAL, 0.7);
  bakeFigure(scene, engineTexture('catapult'), CATAPULT, PAL, 0.7);
  for (const frame of [0, 1]) bakeFigure(scene, foeTexture('wolf', frame), stride(WOLF, frame), PAL, SCALE.wolf);
  for (const frame of [0, 1]) bakeFigure(scene, foeTexture('wisp', frame), wispRig(frame), { ...PAL, arcane: '#e8fbff' }, SCALE.wisp, undefined, false);
  for (const kind of ['goblin', 'orc', 'knight', 'bearer', 'shaman'] as const) {
    for (const frame of [0, 1]) bakeFigure(scene, foeTexture(kind, frame), stride(RIGS[kind], frame), PAL, SCALE[kind]);
  }
  // The harpy flies: no shadow at its feet (the scene casts one on the road below it).
  for (const frame of [0, 1]) bakeFigure(scene, foeTexture('harpy', frame), harpyRig(frame), PAL, SCALE.harpy, undefined, false);
  for (const kind of ['spear', 'mage'] as const) bakeFigure(scene, guardTexture(kind), RIGS[kind], PAL, SCALE[kind]);
  for (const kind of ['troll', 'ogre', 'giant', 'chieftain'] as const) {
    const { rig, pal } = bossRig(kind);
    for (const frame of [0, 1]) bakeFigure(scene, foeTexture(kind, frame), stride(rig, frame), pal, SCALE[kind]);
  }
}

/** The second walk frame: the legs (parts below the hips) stepped together. */
function stride(rig: Rig, frame: number): Rig {
  if (frame === 0) return rig;
  return rig.map((part) => {
    if (!part.p || part.p.some(([, y]) => y < -44)) return part;
    const cx = part.p.reduce((s, [x]) => s + x, 0) / part.p.length;
    const dx = cx < 0 ? 5 : -5;
    return { ...part, p: part.p.map(([x, y]) => [x + dx * (1 + y / 44), y] as Pt) };
  });
}

function bakeFigure(scene: Phaser.Scene, key: string, rig: Rig, pal: Record<string, string>, k: number, extra?: (ctx: CanvasRenderingContext2D) => void, shadow = true) {
  const pts = rig.flatMap((part) => part.p ?? [part.c!]);
  if (extra) pts.push([62, -120], [62, -24]);
  const minX = Math.min(...pts.map((p) => p[0])) - 6;
  const maxX = Math.max(...pts.map((p) => p[0])) + 30;
  const minY = Math.min(...pts.map((p) => p[1])) - 8;
  const maxY = 14;
  const w = (maxX - minX) * k;
  const h = (maxY - minY) * k;
  paint(scene, key, w, h, (ctx) => {
    ctx.scale(k, k);
    ctx.translate(-minX, -minY);
    // A soft shadow on the road, falling to the lower right.
    const r = Math.max(28, (maxX - minX - 36) * 0.55);
    if (shadow) softShadow(ctx, () => poly(ctx, ngon(r * 0.35, 3, r, 9, 12), '#2a1808'), 3 / k, 0.4);
    for (const part of rig) {
      const shape = part.c ? ngon(part.c[0], part.c[1], part.r!, part.r!, 8) : part.p!;
      if (part.m === 'eye' || part.m === 'gemG' || part.m === 'arcane') {
        // Eyes and magic stones glow.
        ctx.save();
        ctx.shadowColor = part.m === 'eye' ? '#ffcf3a' : pal[part.m];
        ctx.shadowBlur = part.m === 'eye' ? 6 : 10;
        if (part.m === 'eye') poly(ctx, shape, pal.eye);
        else gem(ctx, part.c![0], part.c![1], part.r!, 6, 0.3, dark(pal[part.m], 0.35), light(pal[part.m], 0.5));
        ctx.restore();
        continue;
      }
      facet(ctx, shape, pal[part.m], { k: 1.2 });
    }
    extra?.(ctx);
  });
  FIGURES[key] = { originX: (-minX * k) / w, originY: (-minY * k) / h, height: -(minY + 8) * k };
}

/** The ranger's bow, drawn and nocked. */
function drawBow(ctx: CanvasRenderingContext2D) {
  const t: Pt = [44, -116];
  const g: Pt = [62, -72];
  const b: Pt = [44, -28];
  const pull: Pt = [26, -72];
  line(ctx, [t, pull, b], '#f3ead2', 2);
  const limb = (a: Pt, c: Pt) => {
    const m: Pt = [(a[0] + c[0]) / 2 + 6, (a[1] + c[1]) / 2];
    poly(ctx, [a, m, c, [c[0] + 6, c[1]], [m[0] + 7, m[1]], [a[0] + 6, a[1]]], '#a8743f');
    poly(ctx, [m, c, [c[0] + 6, c[1]], [m[0] + 7, m[1]]], '#6e4826');
  };
  limb(t, g);
  limb(b, g);
  poly(ctx, rect(g[0] - 3, g[1] - 8, 9, 16), '#4c3020');
  line(ctx, [pull, [g[0] + 26, g[1]]], '#d9c49c', 3);
  poly(ctx, [[g[0] + 26, g[1] - 5], [g[0] + 40, g[1]], [g[0] + 26, g[1] + 5]], '#c9d2dc');
}

/** Arrows (plain, fire and frost), the fireball, and the Arrow Rain shaft. */
export function bakeMissiles(scene: Phaser.Scene) {
  const arrow = (key: string, glow: string | null, head: string, headD: string) =>
    paint(scene, key, 44, 16, (ctx) => {
      ctx.translate(30, 8);
      ctx.scale(0.5, 0.5);
      if (glow) {
        ctx.globalAlpha = 0.5;
        poly(ctx, [[-56, -2], [-10, -1], [-10, 1], [-56, 2]], glow);
        ctx.globalAlpha = 1;
      }
      poly(ctx, rect(-28, -2, 34, 4), '#d7b98a');
      poly(ctx, [[-30, -1], [-38, -8], [-26, -2]], '#efe7d4');
      poly(ctx, [[-30, 1], [-38, 8], [-26, 2]], '#b8ad96');
      if (glow) {
        ctx.shadowColor = glow;
        ctx.shadowBlur = 10;
      }
      poly(ctx, [[6, -6], [20, 0], [6, 6]], head);
      poly(ctx, [[6, 0], [20, 0], [6, 6]], headD);
    });
  arrow('arrow', null, '#e2e8ee', '#8e98a4');
  arrow('arrow-fire', '#ff9a2a', '#ffd27a', '#f08a24');
  arrow('arrow-frost', '#7fd0ff', '#e8f8ff', '#6aaee0');
  paint(scene, 'fireball', 48, 28, (ctx) => {
    ctx.translate(34, 14);
    ctx.scale(0.5, 0.5);
    ctx.shadowColor = '#ff8a1e';
    ctx.shadowBlur = 16;
    for (let i = 0; i < 4; i++) {
      const tx = -26 - i * 10;
      const s = 12 - i * 2.4;
      ctx.globalAlpha = 0.85 - i * 0.18;
      poly(ctx, ngon(tx, i % 2 ? 3 : -3, s, s * 0.8, 5, i), i < 2 ? '#ff9b2f' : '#e0512a');
    }
    ctx.globalAlpha = 1;
    gem(ctx, 0, 0, 20, 8, 0.2, '#e8541c', '#ffe08a');
    poly(ctx, ngon(-5, -5, 7, 7, 5), '#fff4c8');
  });
  // The ballista's lance: a long iron-tipped bolt with wooden flights.
  paint(scene, 'lance', 64, 16, (ctx) => {
    ctx.translate(46, 8);
    poly(ctx, rect(-42, -2, 46, 4), '#93653a');
    poly(ctx, [[-40, -1], [-46, -7], [-32, -2]], '#c99260');
    poly(ctx, [[-40, 1], [-46, 7], [-32, 2]], '#6e4826');
    poly(ctx, [[2, -6], [16, 0], [2, 6]], '#d8e0e8');
    poly(ctx, [[2, 0], [16, 0], [2, 6]], '#8e98a4');
  });
  // The Troll King's rock: a grey faceted lump.
  paint(scene, 'rock', 30, 26, (ctx) => {
    ctx.translate(15, 13);
    softShadow(ctx, () => poly(ctx, ngon(0, 0, 13, 11, 7, 0.4), '#6e6a66'), 3, 0.3);
    facet(ctx, ngon(0, 0, 13, 11, 7, 0.4), '#7d7872');
    poly(ctx, [[-6, -5], [1, -8], [5, -2]], '#a39d95');
  });
  paint(scene, 'rain-arrow', 12, 40, (ctx) => {
    ctx.translate(6, 0);
    poly(ctx, rect(-1, 6, 2, 26), '#fff2c4');
    poly(ctx, [[-4, 30], [0, 39], [4, 30]], '#ffffff');
    poly(ctx, [[-1, 6], [-5, 0], [-1, 10]], '#ffe08a');
    poly(ctx, [[1, 6], [5, 0], [1, 10]], '#e5b53a');
  });
  // The hired mage's arcane bolt: a teal gem with a fading trail.
  paint(scene, 'magic-bolt', 40, 24, (ctx) => {
    ctx.translate(28, 12);
    ctx.shadowColor = '#6fe0d0';
    ctx.shadowBlur = 10;
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.7 - i * 0.2;
      poly(ctx, ngon(-8 - i * 7, 0, 5 - i, 4 - i, 4, 0.5), '#6fe0d0');
    }
    ctx.globalAlpha = 1;
    gem(ctx, 0, 0, 8, 6, 0.3, '#22767a', '#c8fff6');
  });
  // The mage hero's bolt: a violet gem with a fading trail.
  paint(scene, 'spell-bolt', 44, 26, (ctx) => {
    ctx.translate(30, 13);
    ctx.shadowColor = '#c08aff';
    ctx.shadowBlur = 12;
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = 0.7 - i * 0.2;
      poly(ctx, ngon(-9 - i * 8, 0, 6 - i, 5 - i, 4, 0.5), '#c08aff');
    }
    ctx.globalAlpha = 1;
    gem(ctx, 0, 0, 9, 6, 0.3, '#5a2a9a', '#f0dcff');
  });
  // A faceted shard for death puffs and splinters of the Arrow Rain landing.
  paint(scene, 'shard', 16, 14, (ctx) => facet(ctx, ngon(8, 7, 7, 6, 5, 0.4), '#d8d2c8', { edge: false }));
}
