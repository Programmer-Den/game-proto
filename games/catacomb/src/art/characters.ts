import Phaser from 'phaser';
import type { EnemyKind } from '../game/enemies';
import type { HeroId } from '../game/heroes';
import { BLUE, BONE, GOLD, GREEN, INK, IRON, PURPLE, RED, SKIN, WOOD } from './palette';
import { addTexture, bakePainted, paint, sketch } from './paint';
import { type Palette } from './pixelArt';

// The hero and the foes, side on, in the painterly style. The knight and the slime are drawn as
// shapes; the other foes are character grids ('.' = clear) outlined in ink. Every one is then
// repainted with brush strokes. The hero faces right, towards the foes; the foes face left.

export const CHAR_SCALE = 4;

const PALETTE: Palette = {
  e: INK,
  i: IRON.shine,
  I: IRON.light,
  m: IRON.mid,
  d: IRON.dark,
  s: SKIN.mid,
  S: SKIN.shade,
  b: BLUE.mid,
  B: BLUE.light,
  n: BLUE.dark,
  w: WOOD.mid,
  W: WOOD.light,
  g: GOLD.mid,
  G: GOLD.light,
  r: RED.mid,
  R: RED.light,
  x: RED.dark,
  k: GREEN.dark,
  l: GREEN.mid,
  L: GREEN.light,
  h: GREEN.shine,
  o: BONE.dark,
  O: BONE.mid,
  c: BONE.light,
  p: PURPLE.dark,
  P: PURPLE.mid,
  q: PURPLE.light,
  y: 0xf8d460,
  t: 0x6a5a50,
  T: 0x8a7a6a,
  u: 0xd8a0a8,
};

const FOES: Record<EnemyKind, string[]> = {
  // A green blob with a shine.
  slime: [
    '.....LLLL.....',
    '...LLhhLLLL...',
    '..LLhhLLLLLL..',
    '.LLLLLLLLLLLL.',
    '.LeeLLLLeeLLL.',
    'LLeeLLLLeeLLLL',
    'LLLLLLLLLLLLLl',
    'LLLLLxxxxLLLLl',
    'LLLLLLLLLLLLll',
    '.lLLLLLLLLLlll',
    '..llllllllll..',
  ],
  // A grey rat with a long pink tail.
  rat: [
    '..TT...........',
    '.TuT...........',
    'TTTTTT.........',
    'eTTTTTTTTT.....',
    'TTTTTTTTTTT....',
    '.TTtTTTTTTTT...',
    '..tTTTTTTTTTuu.',
    '...tttttttt..uu',
    '...t.t..t.t...u',
  ],
  // A skeleton with a rusty sword.
  skeleton: [
    '.....OcccO...',
    '....Occcccc..',
    '....ceecec...',
    '....cccccc...',
    '.....cOcOc...',
    '..W...ccc....',
    '..W..cOcOc...',
    '..W.c.ccc.c..',
    '..WcO.OcO.Oc.',
    '.gWg..ccc..c.',
    '..w...OcO....',
    '......ccc....',
    '.....c...c...',
    '.....c...c...',
    '.....c...c...',
    '....cc...cc..',
  ],
  // A hooded cultist in purple robes with a glowing candle.
  cultist: [
    '.....pppp....',
    '....pPPPPp...',
    '...pPPPPPPp..',
    '...pPeyPeyp..',
    '...pPPPPPPp..',
    '....pPPPPp...',
    '..y.pqPPqPp..',
    '..G.PqPPqPPp.',
    '..sPPqPPqPPp.',
    '...PPqPPqPPp.',
    '...pPPPPPPPp.',
    '...pPPPPPPPpp',
    '..pPPPPPPPPpp',
    '..pppppppppp.',
  ],
  // The Bone King: a big crowned skeleton with a great axe.
  boneKing: [
    '.......g.g.g.......',
    '.......gGgGg.......',
    '......OcccccO......',
    '.....Occcccccc.....',
    '.....crrcccrrc.....',
    '.....crrcccrrc.....',
    '.....ccccOcccc.....',
    '......cOcOcOc......',
    '.I.....ccccc.......',
    'IiI...xxccccxx.....',
    'IiiW.xcOcOcOcOcx...',
    'IiI.W.c.ccccc.c.c..',
    '.I...WcOcOcOcOc.c..',
    '......W.ccccc...c..',
    '.......WcOcOc...c..',
    '......xxxcccxxx....',
    '.....xxxxxxxxxxx...',
    '.....xx.c...c.xx...',
    '........c...c......',
    '........c...c......',
    '.......cc...cc.....',
  ],
  // An undead knight in dark plate with glowing eyes and a greatsword.
  graveKnight: [
    '......tttt.....',
    '.....tTTTTt....',
    '....tTTTTTTt...',
    '....tGtTGtTt...',
    '....tTTTTTTt...',
    '.i...tTTTTt....',
    '.Ii..xxxxxx....',
    '.Ii.tTIITTTt...',
    '.Ii.tTTIITTTt..',
    '.Ii.tTTTTTTTt..',
    'gggt.tTTTTTt...',
    '.w...txxxxxt...',
    '.w...tTTtTTt...',
    '.....tTt.tTt...',
    '.....tTt.tTt...',
    '.....tTt.tTt...',
    '....ttTt.tTtt..',
  ],
  // A hunched witch with green skin, a tall purple hat and a crooked staff.
  bogWitch: [
    '.......p.......',
    '......pp.......',
    '.....pPp.......',
    '....pPPPp......',
    '...pppppppp....',
    '.....lLLl......',
    '.w...LeLeL.....',
    '.W...lLLLl.....',
    '.w....lkl......',
    '.w..pPPPPPp....',
    '.wlLPPqPPPPp...',
    '.w..pPqPPPPp...',
    '.w..pPPPPPPpp..',
    '.w.pPPPPPPPPp..',
    '.w.pPPPPPPPPPp.',
    '.w.ppppppppppp.',
  ],
  // A grey-green ghoul, hunched, with long claws.
  ghoul: [
    '....kkkk.....',
    '...kllllk....',
    '..kllllllk...',
    '..klRlllRl...',
    '..kllllllk...',
    '...klxxlk....',
    '....klllk....',
    '..kllllllk...',
    '.kllkllllkl..',
    'cklk.kllk.klc',
    'c.c..kllk..c.',
    '.....kllk....',
    '....kl..lk...',
    '....kl..lk...',
    '...kkl..lkk..',
  ],
  // A hooded wraith, pale blue and fading out below.
  wraith: [
    '.....nnnn.....',
    '....nbbbbn....',
    '...nbbbbbbn...',
    '...nbeBBebn...',
    '...nbeBBebn...',
    '...nbbbbbbn...',
    '..nbbBbbBbbn..',
    '.cnbbBbbBbbnc.',
    'c.nbbBbbBbbn.c',
    '..nbbbbbbbbn..',
    '..nbBbbbbBbn..',
    '...nb.bb.bn...',
    '...n..b...n...',
    '......n.......',
  ],
  // A big purple spider, low and wide.
  spider: [
    '...............',
    '....pppp.......',
    '..ppPPPPpp.....',
    '.pPPqPPPPPp....',
    '.pPPPPPPPPPp...',
    '.pPPPPPPPPPppp.',
    'p.pPPPPPPPpRRRp',
    'p.p.ppppp.pRpRp',
    '.p.p.p.p.p.ppp.',
    '.p.p.p..p.p.p..',
    'p..p..p..p..p..',
  ],
  // A mummy wrapped in old bandages.
  mummy: [
    '.....oooo....',
    '....oOcOOo...',
    '....OcOcOO...',
    '....OeOOeO...',
    '....OOcOOO...',
    '.....OOcO....',
    '..OOcOOOcOO..',
    '.OcOOcOOcOcO.',
    '.Oc.OOcOOO.cO',
    '.O..OcOOcO..O',
    '....OOOcOO...',
    '....OcO.OO...',
    '....OO..OcO..',
    '....cO..OO...',
    '...OOO..OOO..',
  ],
  // A stone gargoyle with horns and folded wings.
  gargoyle: [
    '.T..........T....',
    '.TT........TT....',
    '..T.tttttt.T.....',
    '...tTTTTTTt......',
    '...tTyTTyTt......',
    'tt.tTTTTTTt..tt..',
    'tTt.tTxxTt..tTTt.',
    'tTTt.tttt..tTTTt.',
    'tTTTttTTTttTTTTt.',
    '.tTTtTTTTTtTTTt..',
    '..tttTTTTTttTt...',
    '....tTTTTTt.t....',
    '....tTTtTTt......',
    '...tTTt.tTTt.....',
    '...tTt...tTt.....',
    '..ttTt...tTtt....',
  ],
  // The Hollow Queen: a tall crowned ghost queen in purple with a staff of green fire.
  hollowQueen: [
    '...h...............',
    '..hLh..g.g.g.......',
    '..LhL..gGgGg.......',
    '...L..OcccccO......',
    '...w..cqqcqqc......',
    '...w..ccccccc......',
    '...w...cOcOc.......',
    '...w..ppPPPpp......',
    '...wppPPqPqPPpp....',
    '...wPPPPqPqPPPPp...',
    '..cwpPPPqPqPPPPp...',
    '...w.pPPqPqPPPPp...',
    '...w.pPPPPPPPPPp...',
    '...w.pPPqPPqPPPPp..',
    '...wpPPPqPPqPPPPp..',
    '...wpPPPPPPPPPPPPp.',
    '...pPPPqPPPqPPPPPp.',
    '..pPPPPqPPPqPPPPPPp',
    '..ppppppppppppppppp',
  ],
  // The Bone Spire, act three.
  // A skeleton archer with a drawn bow and a quiver.
  boneArcher: [
    '.....OcccO...',
    '....Occcccc..',
    '....ceecec...',
    '....cccccc...',
    '..W..cOcOc...',
    '.W....ccc..w.',
    'W...ccOcOcww.',
    'W..c..ccc.w..',
    'Wcc..OcOc.w..',
    'W.....ccc....',
    '.W....OcO....',
    '..W...ccc....',
    '.....c...c...',
    '.....c...c...',
    '.....c...c...',
    '....cc...cc..',
  ],
  // A shade: a shadow with two yellow eyes, ragged at the hem.
  shade: [
    '.....pppp.....',
    '....peeeep....',
    '...peeeeeep...',
    '...peyeeyep...',
    '...peeeeeep...',
    '..peeeeeeeep..',
    '.peepeeeepeep.',
    'pep.peeeep.pep',
    'p...peeeep...p',
    '....peeeep....',
    '....pepeep....',
    '...pe.pe.ep...',
    '...p..p...p...',
  ],
  // A bat of bone with red eyes and wide wings.
  marrowBat: [
    '.o............o.',
    '.oO..........Oo.',
    '.OcO..oooo..OcO.',
    '.OccOocccoOccO..',
    '..OcccrccrcccO..',
    '...OOcccccccOO..',
    '.....OcxxcO.....',
    '......OccO......',
    '.......OO.......',
  ],
  // A golem of stacked bones and skulls.
  ossuary: [
    '....oOOOOo.....',
    '...oOccccOo....',
    '...OcrcOrcO....',
    '...OccccccO....',
    '....OcOcOc.....',
    '.ooOOOcOOOOoo..',
    'oOccOcOcOcOccOo',
    'Occ.OOcccOO.ccO',
    'Oco.OcOcOcO.ocO',
    'ccc.OOcccOO.ccc',
    '....OcOcOcO....',
    '....OO...OO....',
    '...oOc...cOo...',
    '...Occ...ccO...',
    '..oOcc...ccOo..',
  ],
  // A hooded bell ringer in grey with a great bronze bell and its rope.
  bellRinger: [
    '......tttt......',
    '.....tTTTTt.....',
    '....tTTTTTTt....',
    '....tTyTTyTt....',
    '....tTTTTTTt....',
    '.....tTTTTt.....',
    '...ttxxxxxxtt...',
    '..tTTtTTTTtTTt..',
    '..tT.tTTTTt.Tt..',
    '.gg..tTTTTt..w..',
    'gGGg.tTTTTt..w..',
    'gGGg.tTTTTt..w..',
    'gGGGgtTTTTt..w..',
    '.g..tTTTTTTt.w..',
    '....tTTttTTt....',
    '...ttTt..tTtt...',
  ],
  // The Marrow Tyrant: a towering crowned skeleton in purple robes with an iron mace.
  marrowTyrant: [
    '......g.G.g.G.g......',
    '......gGgGgGgGg......',
    '.....OcccccccccO.....',
    '....Occcccccccccc....',
    '....ccyycccccyycc....',
    '....ccyycccccyycc....',
    '....cccccOcOccccc....',
    '.....ccOcOcOcOcc.....',
    '......ccccccccc......',
    '..I..ppPPPPPPPpp.....',
    '.IiI.pPqPcccPqPPp....',
    '.IiIpPPqcOcOcqPPPp...',
    '..W.pPPqPcccPqPPPp...',
    '..W.cPPqcOcOcqPPPpc..',
    '..WcOPPqPcccPqPPPpOc.',
    '..W.pPPPPPPPPPPPPp.c.',
    '..W.pPPqPPPPPqPPPp...',
    '..WpPPPqPPPPPqPPPPp..',
    '..WpPPPPPPPPPPPPPPp..',
    '.pPPPPqPPPPPPPqPPPPp.',
    '.ppppppppppppppppppp.',
  ],
};

export function bakeCharacters(scene: Phaser.Scene) {
  for (const [hero, figure] of Object.entries(HERO_FIGURES)) {
    addTexture(scene, `hero-${hero}`, paintedFigure(figure, 1));
    addTexture(scene, `hero-token-${hero}`, paintedFigure(figure, 0.5));
  }
  addTexture(scene, 'foe-slime', paintedFigure(SLIME, 1));
  for (const [kind, rows] of Object.entries(FOES)) {
    if (kind !== 'slime') bakePainted(scene, `foe-${kind}`, rows, PALETTE, CHAR_SCALE, INK, 3.5, true);
  }
}

export const foeTexture = (kind: EnemyKind) => `foe-${kind}`;
export const heroTexture = (hero: HeroId, token = false) => `hero-${token ? 'token-' : ''}${hero}`;

/** A figure drawn as shapes at twice its size, around its feet at (`fx`, `fy`), `w` x `h` at its own size. */
interface Figure {
  w: number;
  h: number;
  fx: number;
  fy: number;
  draw: (ctx: CanvasRenderingContext2D) => void;
}

function paintedFigure(f: Figure, scale: number) {
  const { canvas, ctx } = sketch(f.w * scale, f.h * scale);
  ctx.translate((f.w / 2) * scale, f.h * scale - 2 * scale);
  ctx.scale(0.5 * scale, 0.5 * scale);
  ctx.translate(-f.fx, -f.fy);
  f.draw(ctx);
  return paint(canvas, { sizes: [3 * scale, 1.6 * scale, Math.max(0.7, 0.9 * scale)], seed: Math.round(f.fx), cutout: true, threshold: 28 });
}

const shapes = (ctx: CanvasRenderingContext2D) => ({
  poly(pts: number[][], fill: string) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  },
  ell(x: number, y: number, rx: number, ry: number, fill: string, rot = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  },
  rrect(x: number, y: number, w: number, h: number, r: number, fill: string) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  },
});

/** A knight in mail and a blue tabard, a red cape, a raised sword and a round blue shield with a gold boss. */
const KNIGHT: Figure = {
  w: 84,
  h: 130,
  fx: 462,
  fy: 656,
  draw(ctx) {
    const { poly, ell, rrect } = shapes(ctx);
    poly([[432, 540], [492, 540], [508, 640], [416, 640]], '#6e2b38');
    poly([[432, 540], [462, 540], [452, 640], [416, 640]], '#5a2230');
    for (const lx of [444, 476]) {
      rrect(lx - 11, 600, 22, 46, 6, '#8b92a3');
      rrect(lx - 7, 604, 6, 36, 3, '#c3c9d6');
      rrect(lx - 14, 640, 30, 16, 5, '#4a3222');
    }
    rrect(428, 540, 68, 70, 14, '#7d8494');
    poly([[434, 548], [490, 548], [500, 612], [424, 612]], '#2f5f9e');
    poly([[434, 548], [462, 548], [462, 612], [424, 612]], '#3a71b4');
    rrect(428, 586, 70, 10, 3, '#5a3a22');
    ell(462, 591, 7, 6, '#d9b24a');
    poly([[486, 552], [502, 548], [512, 520], [498, 516]], '#7d8494');
    ell(504, 516, 9, 9, '#5a3a22');
    rrect(486, 506, 38, 8, 3, '#d9b24a');
    poly([[499, 506], [509, 506], [507, 426], [504, 414], [501, 426]], '#c9cfdb');
    poly([[504, 506], [509, 506], [507, 426], [504, 414]], '#eef2f8');
    ell(504, 526, 6, 6, '#d9b24a');
    ell(462, 522, 30, 32, '#9aa2b2');
    ell(452, 512, 16, 18, '#c6ccd8');
    rrect(440, 520, 46, 7, 3, '#15121a');
    poly([[460, 492], [470, 480], [490, 478], [474, 494]], '#2f5f9e');
    ell(428, 586, 38, 40, '#c9a24a');
    ell(428, 586, 31, 33, '#3a67a8');
    ell(420, 576, 16, 18, '#4f7fc0');
    ell(428, 586, 10, 10, '#e2bd5c');
    ell(425, 583, 4, 4, '#fff1c2');
  },
};

/** A hunter in a green hooded cloak and leather, a quiver on the back, a long knife raised and a buckler on the arm. */
const HUNTER: Figure = {
  w: 84,
  h: 130,
  fx: 462,
  fy: 656,
  draw(ctx) {
    const { poly, ell, rrect } = shapes(ctx);
    // Cloak behind, hanging to the knees.
    poly([[430, 536], [494, 536], [506, 630], [418, 630]], '#2f5a36');
    poly([[430, 536], [462, 536], [452, 630], [418, 630]], '#254a2c');
    // Quiver over the shoulder, with fletched arrows.
    rrect(478, 528, 16, 56, 6, '#5a3a22');
    for (const ax of [482, 489]) {
      rrect(ax - 1, 500, 3, 30, 1, '#c9a24a');
      poly([[ax - 4, 504], [ax + 1, 494], [ax + 6, 504]], '#e0584f');
    }
    // Legs in brown breeches and tall boots.
    for (const lx of [444, 476]) {
      rrect(lx - 10, 598, 20, 36, 5, '#6b4a2a');
      rrect(lx - 12, 622, 26, 34, 6, '#3b2416');
      rrect(lx - 8, 626, 6, 22, 3, '#5c3a21');
    }
    // Leather tunic with a belt.
    rrect(430, 540, 64, 68, 12, '#8a5a32');
    poly([[436, 548], [488, 548], [496, 606], [428, 606]], '#6b4a2a');
    poly([[436, 548], [462, 548], [462, 606], [428, 606]], '#7a5430');
    rrect(430, 584, 66, 9, 3, '#3b2416');
    ell(462, 588, 6, 5, '#c9a24a');
    // Knife arm raised.
    poly([[486, 552], [502, 548], [512, 520], [498, 516]], '#8a5a32');
    ell(504, 516, 8, 8, '#d9b48c');
    rrect(494, 508, 24, 6, 2, '#5a3a22');
    poly([[501, 508], [509, 508], [507, 450], [504, 440], [501, 450]], '#c9cfdb');
    poly([[505, 508], [509, 508], [507, 450], [504, 440]], '#eef2f8');
    // Hood and face in shadow, a strand of hair.
    ell(462, 522, 30, 32, '#3a6b42');
    ell(466, 528, 18, 18, '#2a1c14');
    ell(470, 526, 8, 6, '#d9b48c');
    poly([[440, 500], [462, 488], [490, 500], [484, 510], [462, 500], [446, 512]], '#2f5a36');
    // Buckler on the left arm.
    ell(428, 586, 26, 28, '#5a3a22');
    ell(428, 586, 19, 21, '#8a5a32');
    ell(428, 586, 7, 7, '#c9a24a');
  },
};

/** A hexer in a hooded purple robe with a pale face and glowing eyes, a staff topped with a green eye raised, and a bone charm at the belt. */
const HEXER: Figure = {
  w: 84,
  h: 130,
  fx: 462,
  fy: 656,
  draw(ctx) {
    const { poly, ell, rrect } = shapes(ctx);
    // Robe to the ankles, darker behind.
    poly([[432, 536], [492, 536], [512, 650], [412, 650]], '#3a1e4a');
    poly([[432, 536], [462, 536], [452, 650], [412, 650]], '#2c163a');
    // Feet under the hem.
    for (const lx of [446, 478]) rrect(lx - 12, 640, 26, 16, 6, '#2a1c14');
    // Robe front with a sash and a bone charm hanging from it.
    rrect(430, 540, 64, 96, 14, '#6a3a8a');
    poly([[440, 548], [484, 548], [496, 636], [428, 636]], '#5a2e78');
    poly([[440, 548], [462, 548], [462, 636], [428, 636]], '#6a3a8a');
    rrect(430, 584, 66, 9, 3, '#2a1c14');
    rrect(452, 592, 4, 16, 2, '#c8bea8');
    ell(454, 612, 7, 6, '#ece4d0');
    ell(452, 611, 1.6, 1.6, '#141018');
    ell(457, 611, 1.6, 1.6, '#141018');
    // Staff arm raised, the staff upright with a green eye at its head.
    poly([[486, 552], [502, 548], [512, 520], [498, 516]], '#6a3a8a');
    ell(504, 516, 8, 8, '#d8c8b0');
    rrect(501, 430, 7, 220, 3, '#5c3a21');
    rrect(503, 432, 2, 214, 1, '#8a5a32');
    ell(504.5, 420, 14, 14, '#2a5a2a');
    ell(504.5, 420, 10, 10, '#8cd060');
    ell(504.5, 420, 5, 6, '#141018');
    ell(502, 417, 2, 2, '#e8ffe0');
    // Hood with a pale face in its shadow and two green glints for eyes.
    ell(462, 522, 30, 32, '#4a2862');
    ell(466, 528, 18, 18, '#1a0f22');
    ell(469, 528, 10, 12, '#d8c8b0');
    ell(465, 525, 2.2, 1.6, '#8cd060');
    ell(473, 525, 2.2, 1.6, '#8cd060');
    poly([[436, 504], [462, 478], [488, 500], [482, 510], [462, 498], [442, 514]], '#3a1e4a');
    poly([[456, 482], [462, 470], [470, 484]], '#3a1e4a');
    // The free hand held out, a wisp of green over it.
    ell(426, 580, 8, 8, '#d8c8b0');
    ell(420, 566, 6, 9, 'rgba(140,208,96,0.7)');
  },
};

/** An alchemist in a teal robe and a leather apron, brass goggles pushed up on a cap, vials at the belt and a bubbling round flask held up high. */
const ALCHEMIST: Figure = {
  w: 84,
  h: 130,
  fx: 462,
  fy: 656,
  draw(ctx) {
    const { poly, ell, rrect } = shapes(ctx);
    // Robe to the shins, darker behind.
    poly([[432, 538], [492, 538], [508, 640], [416, 640]], '#1f4a4e');
    poly([[432, 538], [462, 538], [452, 640], [416, 640]], '#183a3e');
    // Boots.
    for (const lx of [446, 478]) {
      rrect(lx - 10, 620, 20, 26, 5, '#3b2416');
      rrect(lx - 13, 640, 28, 16, 6, '#2a1c14');
    }
    // Robe front and the leather apron over it.
    rrect(430, 540, 64, 86, 14, '#2c6a6e');
    rrect(440, 556, 44, 76, 8, '#8a5a32');
    rrect(444, 560, 18, 68, 6, '#9c6a3c');
    rrect(430, 584, 66, 9, 3, '#3b2416');
    // Vials at the belt: amber, green and blue.
    for (const [vx, c] of [[438, '#f0a040'], [486, '#8cd060'], [494, '#6aa8e0']] as [number, string][]) {
      rrect(vx - 4, 590, 8, 16, 3, '#d8e4e8');
      rrect(vx - 3, 596, 6, 9, 2, c);
    }
    // The flask arm raised, a round flask bubbling orange over the hand.
    poly([[486, 552], [502, 548], [512, 520], [498, 516]], '#2c6a6e');
    ell(504, 512, 8, 8, '#d9b48c');
    rrect(500, 472, 9, 26, 3, '#d8e4e8');
    ell(504.5, 494, 18, 17, '#d8e4e8');
    ell(504.5, 498, 14, 12, '#f0a040');
    ell(499, 494, 4, 4, '#ffe0a0');
    ell(508, 470, 4, 4, 'rgba(240,160,64,0.7)');
    ell(500, 458, 3, 3, 'rgba(240,160,64,0.5)');
    // Head with a cap, brass goggles pushed up and a short beard.
    ell(462, 524, 22, 24, '#d9b48c');
    ell(462, 538, 16, 10, '#8a6a4a');
    ell(462, 504, 26, 14, '#4a3222');
    rrect(440, 506, 44, 8, 3, '#6b4a2a');
    ell(452, 510, 7, 7, '#c9a24a');
    ell(472, 510, 7, 7, '#c9a24a');
    ell(452, 510, 4, 4, '#6aa8e0');
    ell(472, 510, 4, 4, '#6aa8e0');
    ell(455, 524, 2, 2, '#15121a');
    ell(469, 524, 2, 2, '#15121a');
    // The free hand at the side, holding a pinch of green powder.
    ell(426, 584, 8, 8, '#d9b48c');
    ell(420, 572, 5, 5, 'rgba(140,208,96,0.7)');
  },
};

/** The hero figures, by hero. */
const HERO_FIGURES: Record<HeroId, Figure> = { knight: KNIGHT, hunter: HUNTER, hexer: HEXER, alchemist: ALCHEMIST };

/** A glossy green slime with a highlight, two dark eyes and a small mouth. */
const SLIME: Figure = {
  w: 100,
  h: 64,
  fx: 1402,
  fy: 664,
  draw(ctx) {
    const { ell, rrect } = shapes(ctx);
    ctx.beginPath();
    ctx.moveTo(1332, 656);
    ctx.bezierCurveTo(1318, 600, 1360, 556, 1402, 556);
    ctx.bezierCurveTo(1446, 556, 1490, 600, 1472, 656);
    ctx.bezierCurveTo(1440, 668, 1366, 668, 1332, 656);
    const g = ctx.createRadialGradient(1380, 590, 10, 1402, 620, 90);
    g.addColorStop(0, '#a8ef7c');
    g.addColorStop(0.55, '#5cbf48');
    g.addColorStop(1, '#2c7a2e');
    ctx.fillStyle = g;
    ctx.fill();
    ell(1372, 584, 16, 9, 'rgba(255,255,255,0.75)', -0.5);
    ell(1386, 614, 7, 10, '#1a2a18');
    ell(1420, 614, 7, 10, '#1a2a18');
    ell(1384, 610, 2.5, 3, '#ffffff');
    ell(1418, 610, 2.5, 3, '#ffffff');
    rrect(1393, 634, 18, 4, 2, '#1f3a1c');
    ell(1350, 660, 10, 6, '#4aa83e');
  },
};
