// The low-poly models of Lane Brawl: fifteen champions, minions, the jungle's boar, wolves and brutes,
// the guardian beast, towers, the Nexus, watchstones, pines and rocks. Each builder returns a fresh `Model` for one pose; `bake.ts` renders them into
// sprite frames from eight directions. Units: one model unit is one screen pixel.

import { Model, RGB, Rx, Rz, S, T, box, chain, gem, ico, prism, rgb, slab, swing } from './lowpoly';

export type PoseName = 'idle' | 'w0' | 'w1' | 'w2' | 'w3' | 'a0' | 'a1' | 'c0';
export const POSES: PoseName[] = ['idle', 'w0', 'w1', 'w2', 'w3', 'a0', 'a1', 'c0'];
export type TeamName = 'blue' | 'red';

/** Team cloth for tunics, cloaks and robes. */
export const TEAM_CLOTH: Record<TeamName, string> = { blue: '#3b7be8', red: '#d6463a' };
/** Team crystals on towers and the Nexus. */
export const TEAM_GLOW: Record<TeamName, string> = { blue: '#4aa3ff', red: '#ff5a48' };

const SKIN = rgb('#f1c9a0');
const EYE = rgb('#1d1a22');
const PANTS = rgb('#4b4038');
const BOOT = rgb('#3a2c24');
const LEATHER = rgb('#7a5434');
const WOOD = rgb('#8a5d36');
const STEEL = rgb('#b9c3cf');
const DARK_STEEL = rgb('#6c7684');
const GOLD = rgb('#f2c14e');
const CREAM = rgb('#efe6cf');
const STONE = rgb('#9aa0a8');
const STONE_D = rgb('#7d838c');
const STONE_L = rgb('#b4b9c0');

/** Joint angles of a figure: limbs swing forward (+) and back (-), in radians. */
interface Pose {
  legL: number;
  legR: number;
  armL: number;
  armR: number;
  /** Arms spread outwards (radians), left and right. */
  outL: number;
  outR: number;
  /** Torso lean forward. */
  lean: number;
  /** Body lift for the walk. */
  bob: number;
}

const WALK = [0.55, 0, -0.55, 0];
const BOB = [0, 1.2, 0, 1.2];

function basePose(name: PoseName): Pose {
  const p: Pose = { legL: 0, legR: 0, armL: 0.08, armR: 0.08, outL: 0.12, outR: 0.12, lean: 0, bob: 0 };
  if (name[0] === 'w') {
    const k = Number(name[1]);
    p.legL = WALK[k];
    p.legR = -WALK[k];
    p.armL = -WALK[k] * 0.8;
    p.armR = WALK[k] * 0.8;
    p.bob = BOB[k];
  }
  return p;
}

type ChampId =
  | 'warden'
  | 'blade'
  | 'archer'
  | 'mage'
  | 'priest'
  | 'berserker'
  | 'harpooner'
  | 'witch'
  | 'stalker'
  | 'lancer'
  | 'gunslinger'
  | 'automaton'
  | 'tinker'
  | 'wolfkin'
  | 'bruin';

/** Attack and cast poses differ by class: a hammer swings, a bow draws, a staff points. */
function classPose(id: ChampId | 'minion', name: PoseName): Pose {
  const p = basePose(name);
  if (name === 'c0') {
    p.armL = 2.3;
    p.armR = 2.3;
    p.outL = 0.35;
    p.outR = 0.35;
    p.lean = -0.08;
    return p;
  }
  if (name !== 'a0' && name !== 'a1') return p;
  const wind = name === 'a0';
  switch (id) {
    case 'archer':
      p.armL = Math.PI / 2;
      p.outL = 0;
      p.armR = wind ? 1.35 : 1.55;
      p.outR = wind ? -0.55 : -0.25;
      break;
    case 'gunslinger':
      // The revolver held out at arm's length, kicking up on the shot.
      p.armR = wind ? 1.5 : 1.85;
      p.outR = 0;
      p.armL = 0.5;
      p.lean = wind ? 0 : -0.06;
      break;
    case 'lancer':
    case 'harpooner':
      // A thrust: the weapon arm draws back, then drives straight forward.
      p.armR = wind ? 0.6 : 1.6;
      p.outR = wind ? 0.25 : 0;
      p.armL = 0.9;
      p.lean = wind ? -0.1 : 0.28;
      p.legL = 0.45;
      p.legR = -0.35;
      break;
    case 'berserker':
    case 'bruin':
      // Both hands on the axe, high over the head, then down.
      p.armL = wind ? 2.9 : 1.2;
      p.armR = wind ? 2.9 : 1.2;
      p.outL = wind ? -0.15 : -0.3;
      p.outR = wind ? -0.15 : -0.3;
      p.lean = wind ? -0.12 : 0.3;
      p.legL = 0.4;
      p.legR = -0.3;
      break;
    case 'blade':
    case 'stalker':
    case 'wolfkin':
      p.armL = wind ? 2.5 : 1.0;
      p.armR = wind ? 2.5 : 1.0;
      p.outL = wind ? 0.5 : -0.25;
      p.outR = wind ? 0.5 : -0.25;
      p.lean = wind ? -0.05 : 0.25;
      p.legL = 0.35;
      p.legR = -0.3;
      break;
    case 'mage':
    case 'priest':
    case 'witch':
    case 'tinker':
      p.armR = wind ? 2.4 : 1.45;
      p.armL = wind ? 0.6 : 1.1;
      p.lean = wind ? -0.06 : 0.12;
      break;
    default:
      // Warden and minions: an overhead swing of the weapon arm, shield held forward.
      p.armR = wind ? 2.7 : 1.1;
      p.outR = wind ? 0.2 : -0.1;
      p.armL = 0.9;
      p.lean = wind ? -0.08 : 0.22;
      p.legL = 0.35;
      p.legR = -0.3;
  }
  return p;
}

interface Kit {
  cloth: RGB;
  accent: RGB;
  /** 'robe' swaps the legs for a long skirt. */
  robe: boolean;
  /** Wider shoulders and thicker limbs. */
  heavy: boolean;
  head: (md: Model) => void;
  /** The head draws its own face and skull (a robot's, a wolf's, a bear's) instead of a person's. */
  ownHead?: boolean;
  /** Skin for the hands and forearms (fur, brass); a person's by default. */
  skin?: RGB;
  /** Legs and boots, when not trousers and leather. */
  legs?: RGB;
  feet?: RGB;
  rightHand?: (md: Model, arm: number) => void;
  leftHand?: (md: Model, arm: number) => void;
  back?: (md: Model) => void;
  over?: (md: Model) => void;
  /** A champion: a bigger head (`HERO_HEAD`), so faces and hats read at sprite size. */
  hero?: boolean;
}

/** How much bigger a champion's head and headgear are than a minion's, and how far it sits higher. */
const HERO_HEAD = 1.3;
const HERO_LIFT = 2;

/** A standing figure, feet at the origin, facing +z. About 54 units tall. */
function figure(kit: Kit, pose: Pose): Model {
  const md = new Model();
  const w = kit.heavy ? 1.15 : 1;
  md.at(T(0, pose.bob, 0), () => {
    // Legs (or the hem of a robe), pivoting at the hips.
    const hip = 17;
    for (const side of [-1, 1]) {
      const a = side < 0 ? pose.legR : pose.legL;
      md.at(chain(T(side * 3.4 * w, hip, 0), swing(a)), () => {
        if (!kit.robe) box(md, -2.6 * w, -hip + 4, -2.6, 2.6 * w, 0, 2.6, kit.legs ?? PANTS, 0.95);
        box(md, -2.8 * w, -hip, -2.8, 2.8 * w, -hip + 5, 3.6, kit.feet ?? BOOT);
      });
    }
    md.at(chain(T(0, hip, 0), Rx(pose.lean), T(0, -hip, 0)), () => {
      if (kit.robe) {
        md.at(T(0, 1.5, 0), () => prism(md, 9.5, 7.4, 0, hip + 1, 8, kit.cloth, Math.PI / 8));
      }
      // Torso: a tunic in the team's cloth, wider at the shoulders, with a belt.
      box(md, -6.8 * w, hip, -4, 6.8 * w, hip + 15, 4, kit.cloth, 1.18);
      box(md, -7.1 * w, hip, -4.3, 7.1 * w, hip + 2.6, 4.3, LEATHER);
      kit.back?.(md);
      // Head, bigger on a champion.
      md.at(kit.hero ? chain(T(0, 40 + HERO_LIFT, 0), S(HERO_HEAD)) : T(0, 40, 0), () => {
        if (!kit.ownHead) {
          ico(md, 6.6, SKIN);
          box(md, -3.1, -1.4, 5.5, -1.5, 0.6, 6.5, EYE);
          box(md, 1.5, -1.4, 5.5, 3.1, 0.6, 6.5, EYE);
        }
        kit.head(md);
      });
      // Arms from the shoulders, sleeves in cloth, hands bare.
      for (const side of [-1, 1]) {
        const a = side < 0 ? pose.armR : pose.armL;
        const out = side < 0 ? pose.outR : pose.outL;
        md.at(chain(T(side * 9.6 * w, 31, 0), Rz(side * out), swing(a)), () => {
          box(md, -2.3 * w, -7, -2.3 * w, 2.3 * w, 1.5, 2.3 * w, kit.cloth);
          box(md, -2 * w, -12, -2 * w, 2 * w, -7, 2 * w, kit.skin ?? SKIN, 0.9);
          md.at(T(0, -13.5, 0), () => {
            if (side < 0) kit.rightHand?.(md, a);
            else kit.leftHand?.(md, a);
          });
        });
      }
      kit.over?.(md);
    });
  });
  return md;
}

/** Holds a prop upright whatever the arm is doing, tipped forward by `tip`. */
const upright = (arm: number, tip = 0) => Rx(arm + tip);
/** Holds a weapon out in front of the hand, so it swings with the arm. */
const grip = (tip = 0.3) => Rx(Math.PI / 2 - tip);

/** Broken chain links hanging from a wrist (the Berserker's). */
function chainLinks(md: Model) {
  md.at(T(0, 3.5, 0), () => prism(md, 2.8, 2.8, -0.6, 0.8, 6, DARK_STEEL));
  for (let i = 0; i < 3; i++) md.at(chain(T(2.4, 3 - i * 2.2, 0), Rz(0.3)), () => box(md, -0.5, -1.2, -0.9, 0.5, 1.2, 0.9, DARK_STEEL));
}

const KITS: Record<ChampId, (cloth: RGB) => Kit> = {
  warden: (cloth) => {
    const bronze = rgb('#c98b3b');
    return {
      cloth,
      accent: bronze,
      robe: false,
      heavy: true,
      head: (md) => {
        // A bronze helm with a nose guard and a crest.
        prism(md, 7.4, 6.1, 1.6, 8.4, 8, bronze, Math.PI / 8);
        gem(md, 6.1, 8.3, 8.4, 11.6, 8, bronze, 0, Math.PI / 8);
        box(md, -0.7, -0.6, 6.2, 0.7, 3.5, 7.6, bronze);
        box(md, -0.9, 9, -5, 0.9, 13.5, 4, cloth, 0.9);
      },
      over: (md) => {
        // Pauldrons on both shoulders.
        for (const side of [-1, 1]) md.at(T(side * 10.2, 32.5, 0), () => gem(md, 4.6, -2.6, 0.6, 3.6, 6, bronze));
        // The key of the gate he lost, hanging from his belt.
        md.at(T(4.5, 15.5, 4.8), () => {
          md.at(Rx(Math.PI / 2), () => prism(md, 1.7, 1.7, -0.5, 0.5, 6, GOLD));
          box(md, -0.5, -7, -0.5, 0.5, -1.4, 0.5, GOLD);
          box(md, -0.5, -7, -0.5, 2.2, -5.6, 0.5, GOLD);
        });
      },
      rightHand: (md) => {
        // A war hammer.
        md.at(grip(0.35), () => {
          prism(md, 1.2, 1.2, -4, 20, 5, WOOD);
          box(md, -5.5, 16, -3.2, 5.5, 23, 3.2, DARK_STEEL);
          box(md, -6, 17, -2.6, -5.4, 22, 2.6, STEEL);
          box(md, 5.4, 17, -2.6, 6, 22, 2.6, STEEL);
        });
      },
      leftHand: (md, arm) => {
        // A kite shield on the forearm: a bronze rim and a field in the team's colour.
        md.at(chain(T(-1.5, 6, 3.5), upright(arm)), () => {
          const kite = (k: number): [number, number][] => [[0, 11 * k], [8 * k, 6 * k], [7 * k, -5 * k], [0, -13 * k], [-7 * k, -5 * k], [-8 * k, 6 * k]];
          slab(md, kite(1), 0, 2.2, bronze);
          md.at(T(0, -0.5, 0), () => slab(md, kite(0.72), 2, 3.1, cloth));
          // A gate painted on the field: an arch and bars, one of them broken.
          for (const x of [-3, -1, 1, 3]) box(md, x - 0.4, x === 3 ? -2 : -6, 3.1, x + 0.4, 2, 3.5, EYE);
          box(md, -3.4, 2, 3.1, 3.4, 3, 3.5, EYE);
        });
      },
    };
  },
  blade: (cloth) => {
    const violet = rgb('#8e6cf0');
    const dagger = (md: Model) =>
      md.at(grip(0.2), () => {
        box(md, -1, -2, -1, 1, 3, 1, LEATHER);
        box(md, -2.6, 3, -1.2, 2.6, 4.2, 1.2, DARK_STEEL);
        slab(md, [[-1.4, 4], [1.4, 4], [0.6, 15], [0, 17], [-0.6, 15]], -0.5, 0.5, STEEL);
      });
    return {
      cloth,
      accent: violet,
      robe: false,
      heavy: false,
      head: (md) => {
        // A deep hood and a dark mask over the mouth.
        prism(md, 7.6, 3.2, -3, 10.5, 7, violet, Math.PI / 2);
        box(md, -5.4, -5.6, 3.4, 5.4, -0.6, 6.9, rgb('#2a2440'));
      },
      back: (md) => {
        // A short violet cape.
        md.at(chain(T(0, 31, -4.2), Rx(-0.12)), () => slab(md, [[-7.5, 0], [7.5, 0], [6, -17], [0, -20], [-6, -17]], -1, 0, violet));
      },
      over: (md) => {
        // The torn sash of the guild that hunts her, across the chest.
        md.at(chain(T(0, 25, 4.3), Rz(-0.75)), () => box(md, -1.3, -10, 0, 1.3, 9, 1, violet));
        md.at(chain(T(5.5, 19.5, 4.6), Rz(0.4)), () => slab(md, [[-1.3, 0], [1.3, 0], [0.4, -5], [-0.6, -3]], 0, 0.6, violet));
      },
      rightHand: dagger,
      leftHand: dagger,
    };
  },
  archer: (cloth) => {
    const yellow = rgb('#e6c03a');
    return {
      cloth,
      accent: yellow,
      robe: false,
      heavy: false,
      head: (md) => {
        // A peaked cap with a feather.
        prism(md, 7.2, 4.6, 1.8, 7.6, 8, yellow, Math.PI / 8);
        box(md, -4.8, 1.8, 4.5, 4.8, 2.8, 9, yellow);
        md.at(chain(T(5, 5, -1), Rz(-0.5)), () => slab(md, [[0, 0], [1.6, 4], [1, 12], [-0.6, 5]], -0.4, 0.4, rgb('#e2553a')));
      },
      back: (md) => {
        // A short green cloak with leaf-cut edges.
        md.at(chain(T(0, 32, -4.3), Rx(-0.1)), () =>
          slab(md, [[-8, 0], [8, 0], [9, -13], [6, -11], [4.5, -16], [1.5, -12], [0, -17], [-1.5, -12], [-4.5, -16], [-6, -11], [-9, -13]], -1.1, 0, rgb('#4f8a3a')),
        );
        // A quiver of arrows across the back.
        md.at(chain(T(3, 27, -6), Rz(-0.35)), () => {
          prism(md, 2.6, 2.6, -8, 6, 6, LEATHER);
          for (const dx of [-1.2, 1.2]) md.at(T(dx, 0, 0), () => prism(md, 0.5, 0.5, 6, 10, 4, CREAM));
        });
      },
      leftHand: (md, arm) => {
        // The bow: a curved stave and a string, held upright.
        md.at(upright(arm), () => {
          const pts: [number, number][] = [];
          for (let i = 0; i <= 6; i++) {
            const t = -1 + i / 3;
            pts.push([t * 21, Math.cos(t * 1.25) * 6]);
          }
          for (let i = 0; i < 6; i++) {
            const [y0, z0] = pts[i];
            const [y1, z1] = pts[i + 1];
            const ang = Math.atan2(z1 - z0, y1 - y0);
            md.at(chain(T(0, y0, z0), Rx(ang)), () => box(md, -1.1, 0, -1.1, 1.1, Math.hypot(y1 - y0, z1 - z0) + 0.4, 1.1, WOOD));
          }
          box(md, -0.3, -21, -0.3 + pts[0][1], 0.3, 21, 0.3 + pts[0][1], CREAM);
        });
      },
      rightHand: (md, arm) => {
        md.at(upright(arm, Math.PI / 2), () => slab(md, [[-0.4, -2], [0.4, -2], [0.4, 14], [0, 16], [-0.4, 14]], -0.4, 0.4, CREAM));
      },
    };
  },
  mage: (cloth) => {
    const cyan = rgb('#3fd0d9');
    return {
      cloth,
      accent: cyan,
      robe: true,
      heavy: false,
      head: (md) => {
        // A wide brim and a tall pointed hat, bent at the tip.
        prism(md, 11.5, 11, 3.2, 4.6, 10, cyan, 0);
        md.at(Rx(-0.12), () => prism(md, 7.4, 0, 4.6, 21, 8, cyan, 0));
        box(md, -3.4, -5.6, 5, 3.4, -2.6, 6.2, rgb('#ece6dc'));
      },
      rightHand: (md, arm) => {
        // A staff topped by a glowing crystal.
        md.at(upright(arm, 0.15), () => {
          prism(md, 1.2, 1.1, -12, 26, 5, WOOD);
          // Fire and frost pulled from the Riftwell: the crystal is half of each.
          md.at(T(0, 30, 0), () => {
            md.at(T(-1.6, 0, 0), () => gem(md, 2.8, -5, 0, 6, 5, rgb('#ff9a3c'), 0.6));
            md.at(T(1.6, 0, 0), () => gem(md, 2.8, -5, 0, 6, 5, rgb('#9fe6ff'), 0.6));
          });
        });
      },
    };
  },
  priest: (cloth) => {
    const green = rgb('#6fe07f');
    return {
      cloth: CREAM,
      accent: green,
      robe: true,
      heavy: false,
      head: (md) => {
        // Short hair and a golden halo of small gems.
        md.at(chain(T(0, 0, -0.8), Rx(-0.25)), () => prism(md, 6.9, 5, 1.6, 6.8, 8, rgb('#7a5236'), Math.PI / 8));
        for (let i = 0; i < 10; i++) {
          const a = (i * Math.PI * 2) / 10;
          md.at(T(Math.cos(a) * 8, 12, Math.sin(a) * 8), () => gem(md, 1.6, -1, 0, 1, 4, GOLD, 0.6, a));
        }
      },
      back: (md) => {
        // A long cloak in the team's colour.
        md.at(chain(T(0, 32, -4.4), Rx(-0.1)), () => slab(md, [[-9, 0], [9, 0], [11.5, -27], [0, -29], [-11.5, -27]], -1.2, 0, cloth));
      },
      over: (md) => {
        // A stole down the front in the team's colour, and the Daykeeper's sun on her chest.
        for (const side of [-1, 1]) box(md, side * 3.2 - 1.3, 4, 4.6, side * 3.2 + 1.3, 32, 5.6, cloth);
        md.at(chain(T(0, 26, 5), Rx(Math.PI / 2)), () => {
          prism(md, 2.2, 2.2, -0.4, 0.6, 8, GOLD, 0);
          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI) / 4;
            md.at(T(Math.cos(a) * 3.3, 0, Math.sin(a) * 3.3), () => box(md, -0.6, -0.3, -0.6, 0.6, 0.5, 0.6, GOLD));
          }
        });
      },
      rightHand: (md, arm) => {
        // A staff with a golden sunburst and a green orb.
        md.at(upright(arm, 0.15), () => {
          prism(md, 1.1, 1, -12, 25, 5, rgb('#d9c79a'));
          md.at(T(0, 29, 0), () => {
            for (let i = 0; i < 8; i++) md.at(Rz((i * Math.PI) / 4), () => gem(md, 1.1, 2.5, 4, 7, 4, GOLD, 0.4));
            ico(md, 3.2, green, 0.55);
          });
        });
      },
      leftHand: (md) => md.at(T(0, 0, 1.5), () => ico(md, 2.2, green, 0.7)),
    };
  },
  berserker: (cloth) => {
    const orange = rgb('#ff8a3d');
    const fur = rgb('#8b6b4a');
    const furD = rgb('#5e4630');
    return {
      cloth,
      accent: orange,
      robe: false,
      heavy: true,
      head: (md) => {
        // A wild beard and an iron cap with two great curved horns.
        box(md, -4.2, -7.5, 3.6, 4.2, -2.4, 7.2, rgb('#b5582b'), 0.8);
        prism(md, 7.2, 5.6, 1.8, 7.8, 8, DARK_STEEL, Math.PI / 8);
        for (const side of [-1, 1]) {
          md.at(chain(T(side * 6.4, 5, 0), Rz(side * -1.1)), () => {
            prism(md, 2.2, 1.4, 0, 6, 5, CREAM);
            md.at(chain(T(0, 6, 0), Rz(side * 0.9)), () => prism(md, 1.4, 0.2, 0, 6, 5, CREAM));
          });
        }
      },
      over: (md) => {
        // A fur mantle round the shoulders.
        for (let i = 0; i < 7; i++) {
          const a = Math.PI * (0.1 + (i / 6) * 0.8);
          md.at(T(Math.cos(a) * 9.5, 31.5, -Math.sin(a) * 2 - 1), () => gem(md, 3.4, -2, 0.5, 3.2, 5, i % 2 ? fur : furD));
        }
      },
      leftHand: (md) => chainLinks(md),
      rightHand: (md) => {
        chainLinks(md);
        // A great axe: a long haft and a broad crescent blade.
        md.at(grip(0.25), () => {
          prism(md, 1.3, 1.2, -8, 26, 5, WOOD);
          md.at(T(0, 21, 0), () => {
            slab(md, [[0, -6], [6, -8], [10, -2], [10, 4], [6, 9], [0, 6]], -0.9, 0.9, STEEL);
            box(md, -1.6, -6.5, -1.2, 1.2, 6.5, 1.2, DARK_STEEL);
          });
          md.at(T(0, 26, 0), () => gem(md, 1.4, 0, 1, 3, 4, orange, 0.3));
        });
      },
    };
  },
  harpooner: (cloth) => {
    const teal = rgb('#2fb39a');
    const rope = rgb('#c9ad7a');
    return {
      cloth,
      accent: teal,
      robe: false,
      heavy: true,
      head: (md) => {
        // A knit cap folded at the brim, and a short brown beard.
        prism(md, 7, 6.2, 2.4, 9.4, 8, teal, Math.PI / 8);
        prism(md, 7.4, 7.2, 1.6, 3.6, 8, rgb('#228673'), Math.PI / 8);
        box(md, -4.4, -7, 3.4, 4.4, -2.6, 6.8, rgb('#6b4a2e'), 0.85);
      },
      back: (md) => {
        // A coil of rope slung on the back.
        md.at(chain(T(0, 26, -5.6), Rx(Math.PI / 2)), () => {
          for (let i = 0; i < 8; i++) {
            const a = (i * Math.PI * 2) / 8;
            md.at(chain(T(Math.cos(a) * 5, 0, Math.sin(a) * 5), Rz(a)), () => box(md, -1.3, -2.2, -1.3, 1.3, 2.2, 1.3, rope));
          }
        });
      },
      rightHand: (md) => {
        // The harpoon: a long shaft, a barbed iron head, and a line tied at its foot.
        md.at(grip(0.2), () => {
          prism(md, 1.1, 1, -10, 30, 5, WOOD);
          md.at(T(0, 30, 0), () => {
            gem(md, 2.2, 0, 2, 9, 4, STEEL);
            for (const side of [-1, 1]) md.at(chain(T(side * 1.6, 3, 0), Rz(side * 0.7)), () => prism(md, 0.7, 0, 0, 4, 4, STEEL));
          });
          md.at(T(0, -10, 0), () => ico(md, 1.8, rope));
        });
      },
      leftHand: (md) => md.at(T(0, 0, 1.4), () => ico(md, 2.4, SKIN)),
      over: (md) => {
        // A whale tooth on a cord round his neck.
        md.at(T(0, 30, 4.4), () => box(md, -3, -0.3, 0, 3, 0.3, 0.6, rope));
        md.at(chain(T(0, 29.5, 4.6), Rz(Math.PI)), () => slab(md, [[-1.3, 0], [1.3, 0], [0.6, 4.5], [-0.2, 5]], 0, 1, CREAM));
      },
    };
  },
  witch: (cloth) => {
    const magenta = rgb('#c55fae');
    const bark = rgb('#5a4130');
    return {
      cloth,
      accent: magenta,
      robe: true,
      heavy: false,
      head: (md) => {
        // A deep hood with antlers rising from it, and a pale face.
        prism(md, 7.8, 3.6, -3, 10, 7, rgb('#3b2a40'), Math.PI / 2);
        for (const side of [-1, 1]) {
          md.at(chain(T(side * 4, 8, -1), Rz(side * -0.5)), () => {
            prism(md, 1, 0.7, 0, 9, 4, bark);
            md.at(chain(T(0, 5, 0), Rz(side * -0.8)), () => prism(md, 0.7, 0.3, 0, 5, 4, bark));
            md.at(chain(T(0, 9, 0), Rz(side * 0.6)), () => prism(md, 0.7, 0.2, 0, 4, 4, bark));
          });
        }
      },
      back: (md) => {
        // A ragged shawl in her own colour.
        md.at(chain(T(0, 32, -4.4), Rx(-0.1)), () => slab(md, [[-9, 0], [9, 0], [10, -14], [5, -11], [0, -18], [-5, -11], [-10, -14]], -1.2, 0, magenta));
        // Bog moss clinging to the shoulders.
        for (const [x, z] of [[-7, -2], [6.5, -1], [-3, -3.5]]) md.at(T(x, 32.5, z), () => gem(md, 2.2, -1, 0.4, 1.6, 5, rgb('#5f8a3c')));
      },
      rightHand: (md, arm) => {
        // A crooked branch staff with a glowing orb caught in its fork.
        md.at(upright(arm, 0.15), () => {
          prism(md, 1.3, 1, -12, 14, 5, bark);
          md.at(chain(T(0, 14, 0), Rz(0.25)), () => prism(md, 1, 0.9, 0, 10, 5, bark));
          md.at(chain(T(-1.5, 24, 0), Rz(-0.5)), () => prism(md, 0.8, 0.3, 0, 6, 4, bark));
          md.at(T(1, 28, 0), () => ico(md, 3.4, magenta, 0.7));
          // Pale moths drawn to the orb.
          for (const [x, y, z] of [[-4, 31, 1], [5, 26, 2], [3, 33, -1]]) md.at(T(x, y, z), () => slab(md, [[-1.6, 0.8], [0, 0], [1.6, 0.8], [0, -0.8]], -0.2, 0.2, CREAM, 0.4));
        });
      },
      leftHand: (md) => md.at(T(0, 0, 1.5), () => ico(md, 2.2, magenta, 0.6)),
    };
  },
  stalker: (cloth) => {
    const slate = rgb('#8fa0b8');
    const straw = rgb('#c9a96a');
    return {
      cloth,
      accent: slate,
      robe: false,
      heavy: false,
      head: (md) => {
        // A wide conical straw hat over a dark mask.
        md.at(T(0, 4.5, 0), () => prism(md, 13, 0.5, 0, 6.5, 10, straw, Math.PI / 10));
        box(md, -5.4, -5.6, 3.6, 5.4, -0.8, 6.9, rgb('#2b3140'));
      },
      over: (md) => {
        // A small watchstone charm at her neck, the Mistwalkers' token.
        md.at(T(0, 30, 4.6), () => gem(md, 1.4, -1.8, 0, 1.8, 4, rgb('#9fe6ff'), 0.7));
      },
      back: (md) => {
        // A long scarf streaming behind.
        md.at(chain(T(1.5, 34, -4.4), Rx(-0.5)), () => slab(md, [[-2.5, 0], [2.5, 0], [3, -22], [0, -26], [-1, -22]], -0.8, 0, slate));
      },
      rightHand: (md) => {
        // A short curved sword.
        md.at(grip(0.25), () => {
          box(md, -1, -2, -1, 1, 3, 1, rgb('#2b3140'));
          box(md, -2.4, 3, -1.2, 2.4, 4, 1.2, GOLD);
          slab(md, [[-1.3, 4], [1.5, 4], [2.4, 12], [1.6, 19], [0.2, 15]], -0.5, 0.5, STEEL);
        });
      },
      leftHand: (md) => {
        // A throwing star held flat.
        md.at(chain(T(0, 0, 2), Rx(Math.PI / 2)), () => slab(md, [[0, 4.5], [1.2, 1.2], [4.5, 0], [1.2, -1.2], [0, -4.5], [-1.2, -1.2], [-4.5, 0], [-1.2, 1.2]], -0.4, 0.4, STEEL));
      },
    };
  },
  lancer: (cloth) => {
    const ivory = rgb('#d8cfb4');
    const plume = rgb('#e3e8ef');
    return {
      cloth,
      accent: ivory,
      robe: false,
      heavy: true,
      head: (md) => {
        // A rounded steel helm with cheek guards and a tall crest.
        prism(md, 7.4, 6.4, 0.5, 8.6, 8, STEEL, Math.PI / 8);
        gem(md, 6.4, 8.5, 8.6, 10.8, 8, STEEL, 0, Math.PI / 8);
        for (const side of [-1, 1]) box(md, side * 5.6 - 1, -4.5, 2, side * 5.6 + 1, 2, 6, DARK_STEEL);
        box(md, -1, 9, -6.5, 1, 15.5, 5.5, plume, 0.9);
      },
      over: (md) => {
        for (const side of [-1, 1]) md.at(T(side * 10, 32.5, 0), () => gem(md, 4.2, -2.4, 0.4, 3.2, 6, STEEL));
      },
      rightHand: (md, arm) => {
        // A long spear with a pennant in the team's colour.
        md.at(upright(arm, 0.2), () => {
          prism(md, 1, 0.9, -14, 36, 5, WOOD);
          md.at(T(0, 36, 0), () => gem(md, 2.4, 0, 2, 10, 4, STEEL));
          md.at(T(0, 31, 0), () => slab(md, [[0.6, 0], [15, -1], [11, -4], [15, -7], [0.6, -8]], -0.4, 0.4, cloth));
        });
      },
      leftHand: (md, arm) => {
        // A tall shield: an ivory rim, the team's colour and one gold band.
        md.at(chain(T(-1.5, 5, 3.5), upright(arm)), () => {
          const rect = (w: number, h: number): [number, number][] => [[-w, h], [w, h], [w, -h], [-w, -h]];
          slab(md, rect(7.5, 12), 0, 2.2, ivory);
          slab(md, rect(5.8, 10.3), 2, 3, cloth);
          md.at(T(0, 3, 0), () => slab(md, rect(5.8, 1.3), 2.9, 3.3, GOLD));
        });
      },
    };
  },
  gunslinger: (cloth) => {
    const hat = rgb('#6b4a30');
    const coat = rgb('#8a6440');
    const brass = rgb('#d8a24a');
    return {
      cloth,
      accent: rgb('#c9925a'),
      robe: false,
      heavy: false,
      head: (md) => {
        // A wide-brimmed hat with a band, and a bandana over the mouth.
        prism(md, 12, 11.4, 3.6, 4.8, 12, hat, 0);
        prism(md, 6.6, 5.6, 4.8, 10.6, 8, hat, Math.PI / 8);
        prism(md, 6.7, 6.6, 4.8, 6.2, 8, rgb('#2b2220'), Math.PI / 8);
        box(md, -5, -5.8, 3.4, 5, -1.8, 6.9, rgb('#b5582b'), 0.9);
      },
      back: (md) => {
        // A long duster coat.
        md.at(chain(T(0, 32, -4.4), Rx(-0.08)), () => slab(md, [[-8.5, 0], [8.5, 0], [10.5, -26], [0, -27], [-10.5, -26]], -1.2, 0, coat));
      },
      over: (md) => {
        // A bandolier of brass rounds across the chest.
        md.at(chain(T(0, 24.5, 4.3), Rz(0.7)), () => {
          box(md, -1.3, -11, 0, 1.3, 11, 1, LEATHER);
          for (let i = -4; i <= 4; i++) md.at(T(0, i * 2.3, 1), () => box(md, -0.6, -0.7, 0, 0.6, 0.7, 0.9, brass));
        });
        // A gun belt with a holster on the hip.
        box(md, 6.2, 12, -1.6, 9, 19, 2.2, LEATHER);
        md.at(T(0, 21, 4.6), () => gem(md, 1.6, -0.6, 0, 0.6, 6, brass));
      },
      rightHand: (md) => {
        // A revolver: wooden grip, brass cylinder, long barrel.
        md.at(grip(0), () => {
          box(md, -1, -3.5, -1.3, 1, 1, 1.3, WOOD);
          prism(md, 2, 2, 1, 4.6, 6, brass);
          box(md, -0.8, 4.6, -0.8, 0.8, 13, 0.8, DARK_STEEL);
          box(md, -0.4, 12, 0.8, 0.4, 13, 1.6, DARK_STEEL);
        });
      },
    };
  },
  automaton: (cloth) => {
    const brass = rgb('#d8a24a');
    const copper = rgb('#b8693a');
    const eye = rgb('#7ff3ff');
    return {
      cloth,
      accent: brass,
      robe: false,
      heavy: true,
      ownHead: true,
      skin: brass,
      legs: DARK_STEEL,
      feet: brass,
      head: (md) => {
        // A riveted brass head with two glowing eyes, a grille for a mouth and an antenna.
        box(md, -5.6, -5.2, -5.2, 5.6, 5.6, 5.6, brass, 0.92);
        for (const side of [-1, 1]) md.at(T(side * 2.4, 1, 5.6), () => ico(md, 1.5, eye, 0.9));
        box(md, -3, -3.8, 5.2, 3, -2, 6, DARK_STEEL);
        for (const side of [-1, 1]) box(md, side * 5.6 - 0.8, -1.5, -1.5, side * 5.6 + 0.8, 1.5, 1.5, copper);
        prism(md, 0.5, 0.5, 5.6, 11, 4, DARK_STEEL);
        md.at(T(0, 11.5, 0), () => ico(md, 1.4, eye, 0.9));
      },
      back: (md) => {
        // A boiler on the back with a smokestack.
        md.at(T(0, 18, -7.5), () => {
          prism(md, 4.6, 4.6, 2, 14, 8, copper, Math.PI / 8);
          md.at(T(2.6, 0, 0), () => prism(md, 1.4, 1.8, 14, 21, 6, DARK_STEEL));
        });
      },
      over: (md) => {
        // The aether core that woke it, glowing through a grille in the chest, and brass shoulder plates.
        md.at(T(0, 26, 4.4), () => ico(md, 2.8, rgb('#7ff3ff'), 0.9));
        for (const y of [-1.4, 1.4]) box(md, -3, 26 + y - 0.3, 6.4, 3, 26 + y + 0.3, 7, DARK_STEEL);
        for (const side of [-1, 1]) md.at(T(side * 10.2, 32.5, 0), () => gem(md, 4.6, -2.6, 0.6, 3.6, 6, brass));
      },
      rightHand: (md) => box(md, -3.2, -4, -3.2, 3.2, 2.5, 3.2, DARK_STEEL, 0.85),
      leftHand: (md) => box(md, -3.2, -4, -3.2, 3.2, 2.5, 3.2, DARK_STEEL, 0.85),
    };
  },
  tinker: (cloth) => {
    const brass = rgb('#d8a24a');
    const copper = rgb('#b8693a');
    const spark = rgb('#5fd3f0');
    return {
      cloth,
      accent: spark,
      robe: false,
      heavy: false,
      // Copper gauntlets.
      skin: copper,
      head: (md) => {
        // A leather cap with brass goggles pushed up on the brow.
        prism(md, 7, 5.6, 2, 8.2, 8, LEATHER, Math.PI / 8);
        box(md, -6.8, 2.2, -6, 6.8, 3.4, 6, rgb('#3a2c24'));
        for (const side of [-1, 1]) md.at(T(side * 2.6, 3, 5.8), () => {
          prism(md, 2, 2, -1.2, 1.2, 8, brass, 0);
          md.at(T(0, 0, 0.6), () => ico(md, 1.5, rgb('#ffcf6a'), 0.6));
        });
      },
      back: (md) => {
        // A backpack with a crackling storm coil.
        box(md, -5, 17, -9, 5, 30, -4, LEATHER);
        md.at(T(0, 30, -6.5), () => {
          prism(md, 1, 0.8, 0, 9, 6, copper);
          for (const y of [2, 4.5, 7, 9.5]) md.at(T(0, y, 0), () => prism(md, 2.2, 2.2, 0, 0.8, 8, brass));
          md.at(T(0, 9, 0), () => prism(md, 0.4, 0.3, 0, 8, 4, DARK_STEEL));
          md.at(T(0, 17.5, 0), () => ico(md, 2.4, spark, 0.9));
        });
      },
      over: (md) => box(md, -5.5, 8, 4.2, 5.5, 26, 5.2, LEATHER),
      rightHand: (md, arm) => {
        // A spark gun: a brass body, copper coils and a glowing tip.
        md.at(upright(arm, Math.PI / 2 - 0.2), () => {
          box(md, -1, -3, -1.2, 1, 1, 1.2, WOOD);
          prism(md, 2.2, 1.6, 1, 8, 8, brass);
          for (const y of [3, 5.5]) md.at(T(0, y, 0), () => prism(md, 2.8, 2.8, 0, 0.8, 8, copper));
          md.at(T(0, 9.5, 0), () => ico(md, 1.8, spark, 0.9));
        });
      },
      leftHand: (md) => md.at(grip(0.5), () => {
        // A wrench.
        box(md, -0.8, -2, -0.6, 0.8, 9, 0.6, STEEL);
        slab(md, [[-2.6, 9], [-1, 9], [-1, 11.5], [1, 11.5], [1, 9], [2.6, 9], [2.6, 13], [-2.6, 13]], -0.7, 0.7, STEEL);
      }),
    };
  },
  wolfkin: (cloth) => {
    const fur = rgb('#8d949c');
    const furD = rgb('#5d636b');
    const furL = rgb('#c3c8cd');
    const claw = (md: Model) => {
      for (const dx of [-1.4, 0, 1.4]) md.at(T(dx, -1, 1.5), () => slab(md, [[-0.5, 0], [0.5, 0], [0, -4]], -0.5, 0.5, CREAM));
    };
    return {
      cloth,
      accent: rgb('#ffd34a'),
      robe: false,
      heavy: false,
      ownHead: true,
      skin: fur,
      legs: furD,
      feet: furD,
      head: (md) => {
        // A wolf's head: grey fur, a long muzzle, pointed ears and yellow eyes.
        ico(md, 6.6, fur);
        box(md, -2.6, -3.6, 3.4, 2.6, 0.6, 11.5, furL, 0.75);
        box(md, -1.2, -0.6, 10.8, 1.2, 1, 12.4, EYE);
        for (const side of [-1, 1]) {
          md.at(T(side * 2.5, 1.6, 5.4), () => ico(md, 1.1, rgb('#ffd34a'), 0.8));
          md.at(chain(T(side * 3.8, 4.6, -0.5), Rz(side * -0.25)), () => gem(md, 2.2, 0, 0.4, 7.5, 4, furD));
        }
        // A pale moon painted on the brow.
        md.at(T(0, 4, 5.4), () => slab(md, [[-1.8, 1], [0, 2], [1.8, 1], [0.8, 0.4], [0, 1], [-0.8, 0.4]], 0, 0.8, rgb('#eef3ff'), 0.4));
      },
      back: (md) => {
        // A bushy tail.
        md.at(chain(T(0, 16, -3.8), Rx(-0.9)), () => gem(md, 2.6, 0, 6, 15, 6, fur));
      },
      over: (md) => {
        // A shaggy mane over the shoulders.
        for (let i = 0; i < 7; i++) {
          const a = Math.PI * (0.1 + (i / 6) * 0.8);
          md.at(T(Math.cos(a) * 9, 31.5, -Math.sin(a) * 2 - 1), () => gem(md, 3, -2, 0.5, 3.4, 5, i % 2 ? fur : furL));
        }
      },
      rightHand: claw,
      leftHand: (md) => {
        claw(md);
        // A strip of torn cloth tied round the arm.
        md.at(T(0, 4, 0), () => prism(md, 2.6, 2.6, -0.8, 0.8, 6, rgb('#5a8bd6')));
      },
    };
  },
  bruin: (cloth) => {
    const fur = rgb('#8a5a33');
    const furD = rgb('#5e3c22');
    const muzzle = rgb('#c99a6a');
    const claw = (md: Model) => {
      for (const dx of [-1.6, 0, 1.6]) md.at(T(dx, -1, 1.8), () => slab(md, [[-0.6, 0], [0.6, 0], [0, -3.5]], -0.6, 0.6, CREAM));
    };
    return {
      cloth,
      accent: rgb('#a0683a'),
      robe: false,
      heavy: true,
      ownHead: true,
      skin: fur,
      legs: fur,
      feet: furD,
      head: (md) => {
        // A bear's head: round, with a pale muzzle, a dark nose and small round ears.
        ico(md, 7.4, fur);
        md.at(T(0, -2, 5.6), () => ico(md, 3.6, muzzle));
        box(md, -1.4, -1.2, 8.6, 1.4, 0.8, 9.6, EYE);
        for (const side of [-1, 1]) {
          box(md, side * 2.8 - 0.8, 1.2, 6, side * 2.8 + 0.8, 2.6, 7, EYE);
          md.at(T(side * 5, 5.6, -0.5), () => ico(md, 2.4, furD));
        }
      },
      over: (md) => {
        // A pale belly under the vest, and a leather strap across it.
        box(md, -4.4, 19, 4, 4.4, 28, 4.9, muzzle);
        md.at(chain(T(0, 25, 4.3), Rz(0.7)), () => box(md, -1.2, -11, 0, 1.2, 11, 1.2, LEATHER));
        // A honey pot on his belt, and moss on one shoulder.
        md.at(T(-6.5, 15, 4), () => {
          ico(md, 2.6, rgb('#e8a531'));
          prism(md, 1.6, 1.6, 1.8, 3, 6, rgb('#6b4a2e'));
        });
        md.at(T(-10, 33, 0), () => gem(md, 2.8, -1, 0.5, 1.8, 5, rgb('#5f8a3c')));
      },
      back: (md) => {
        md.at(T(0, 17, -4.4), () => ico(md, 2.2, fur));
        // An oak sapling growing from the moss on his back.
        md.at(T(3, 28, -5), () => {
          gem(md, 3, -1, 0.5, 1.5, 6, rgb('#5f8a3c'));
          prism(md, 0.8, 0.6, 0, 12, 5, rgb('#6b4a2e'));
          for (const [x, y, z, r] of [[0, 14, 0, 3.2], [-2.4, 12, 1, 2.4], [2.4, 11.5, -1, 2.4]]) md.at(T(x, y, z), () => ico(md, r, rgb('#6aa84f')));
        });
      },
      rightHand: claw,
      leftHand: claw,
    };
  },
};

/** A champion of class `id` in a team's cloth, in one pose. */
export function championModel(id: string, team: TeamName, pose: PoseName): Model {
  const kit = (KITS[id as ChampId] ?? KITS.warden)(rgb(TEAM_CLOTH[team]));
  return figure({ ...kit, hero: true }, classPose(id as ChampId, pose));
}

/** A minion: a small soldier with a helmet, a sword and a round shield in the team's colour. */
export function minionModel(team: TeamName, pose: PoseName): Model {
  const cloth = rgb(TEAM_CLOTH[team]);
  const kit: Kit = {
    cloth,
    accent: STEEL,
    robe: false,
    heavy: true,
    head: (md) => {
      prism(md, 7.5, 5.6, 1.4, 7.4, 7, DARK_STEEL, 0);
      gem(md, 5.6, 7.3, 7.4, 10, 7, DARK_STEEL);
      box(md, -6.6, 1.4, 5.6, 6.6, 2.6, 7.4, STEEL);
    },
    rightHand: (md) =>
      md.at(grip(0.3), () => {
        box(md, -1, -2, -1, 1, 3, 1, LEATHER);
        box(md, -3, 3, -1.2, 3, 4.4, 1.2, DARK_STEEL);
        slab(md, [[-1.8, 4], [1.8, 4], [1.4, 19], [0, 22], [-1.4, 19]], -0.6, 0.6, STEEL);
      }),
    leftHand: (md, arm) =>
      md.at(chain(T(-1.5, 5, 3.4), upright(arm)), () => {
        const disc = (r: number): [number, number][] => Array.from({ length: 8 }, (_, i) => [Math.cos((i * Math.PI) / 4 + Math.PI / 8) * r, Math.sin((i * Math.PI) / 4 + Math.PI / 8) * r]);
        slab(md, disc(8.5), 0, 2, DARK_STEEL);
        slab(md, disc(6.4), 2, 3, cloth);
        gem(md, 2, 3, 3, 4.6, 6, STEEL);
      }),
  };
  return scaled(figure(kit, classPose('minion', pose)), 0.62);
}

/** A sellsword of a mercenary camp: a minion's build in tan cloth, a wide kettle hat and a broad blade, a little bigger. */
export function mercModel(pose: PoseName): Model {
  const cloth = rgb('#a08055');
  const kit: Kit = {
    cloth,
    accent: LEATHER,
    robe: false,
    heavy: true,
    head: (md) => {
      prism(md, 7.5, 5.6, 1.4, 7.4, 7, DARK_STEEL, 0);
      // The kettle hat's crown and its wide brim.
      prism(md, 6, 4.8, 8.6, 12.4, 8, STEEL, 0);
      prism(md, 10, 9.2, 7.4, 8.6, 10, DARK_STEEL, 0);
    },
    rightHand: (md) =>
      md.at(grip(0.3), () => {
        box(md, -1, -2, -1, 1, 3, 1, LEATHER);
        box(md, -4, 3, -1.2, 4, 4.6, 1.2, GOLD);
        slab(md, [[-2.6, 4.6], [2.6, 4.6], [2.2, 20], [0, 24], [-2.2, 20]], -0.7, 0.7, STEEL);
      }),
    leftHand: (md, arm) =>
      md.at(chain(T(-1.5, 5, 3.4), upright(arm)), () => {
        slab(md, [[-6, -8], [6, -8], [6, 6], [0, 10], [-6, 6]], 0, 2, LEATHER);
        slab(md, [[-4, -6], [4, -6], [4, 4.5], [0, 7.5], [-4, 4.5]], 2, 3, cloth);
      }),
  };
  return scaled(figure(kit, classPose('minion', pose)), 0.78);
}

/** Scales a finished model's points (a model's builder can't scale after the fact). */
function scaled(md: Model, k: number): Model {
  const out = new Model();
  out.polys = md.polys.map((p) => ({ ...p, pts: p.pts.map(([x, y, z]) => [x * k, y * k, z * k] as [number, number, number]) }));
  out.normals = md.normals;
  return out;
}

/** The jungle boar: a bristly quadruped with tusks. Attack poses lower the head and lunge. */
export function boarModel(pose: PoseName): Model {
  const md = new Model();
  const hide = rgb('#7d5a3a');
  const dark = rgb('#4f3826');
  const snout = rgb('#c58b6c');
  const tusk = rgb('#f3ecd9');
  const k = pose[0] === 'w' ? WALK[Number(pose[1])] : 0;
  const bob = pose[0] === 'w' ? BOB[Number(pose[1])] * 0.6 : 0;
  const lunge = pose === 'a1' ? 4 : pose === 'a0' ? -2 : 0;
  const dip = pose === 'a1' ? 0.35 : pose === 'a0' ? -0.2 : 0;
  md.at(T(0, bob, lunge), () => {
    // Four short legs, diagonal pairs moving together.
    for (const [x, z, ph] of [[-6.5, 10, 1], [6.5, 10, -1], [-6.5, -11, -1], [6.5, -11, 1]] as const) {
      md.at(chain(T(x, 11, z), swing(k * ph * 0.8)), () => {
        box(md, -2.6, -11, -2.6, 2.6, 0, 2.6, dark, 0.9);
        box(md, -2.8, -11, -2.9, 2.8, -9.5, 3, rgb('#2b2019'));
      });
    }
    // Body: a heavy barrel, high at the shoulders.
    box(md, -10, 9, -16, 10, 25, 13, hide, 0.82);
    box(md, -9, 10, 10, 9, 26.5, 16, hide, 0.85);
    // Bristles along the spine.
    for (let i = 0; i < 6; i++) md.at(T(0, 24.5 - i * 0.6, 12 - i * 5), () => prism(md, 2.6, 0, 0, 5 - i * 0.4, 4, dark, Math.PI / 4));
    // A short tail.
    md.at(chain(T(0, 20, -16), Rx(-0.7)), () => prism(md, 1, 0.3, 0, 6, 4, dark));
    // Head, dipping on the attack.
    md.at(chain(T(0, 18, 15), Rx(dip)), () => {
      box(md, -7, -7, 0, 7, 6, 10, hide, 0.85);
      md.at(chain(T(0, -2.5, 10), Rx(Math.PI / 2)), () => prism(md, 4.4, 4, 0, 4, 6, snout, Math.PI / 6));
      box(md, -2.8, -1.6, 14.1, -1, 0.2, 14.6, dark);
      box(md, 1, -1.6, 14.1, 2.8, 0.2, 14.6, dark);
      for (const side of [-1, 1]) {
        md.at(chain(T(side * 4.6, -4, 11), Rx(-0.6), Rz(side * 0.35)), () => prism(md, 1.2, 0, 0, 7, 4, tusk));
        md.at(chain(T(side * 5, 5.5, 3), Rz(side * -0.5)), () => slab(md, [[-2, 0], [2, 0], [0, 6]], -0.8, 0.8, dark));
        box(md, side * 3.6 - 1, 1, 9.6, side * 3.6 + 1, 3, 10.4, rgb('#120c08'));
      }
    });
  });
  return md;
}

/** A wolf: lean and grey, with a long snout, pricked ears and a raised tail. Pups use the same sheet, drawn smaller. */
export function wolfModel(pose: PoseName): Model {
  const md = new Model();
  const fur = rgb('#8d939c');
  const dark = rgb('#5b6069');
  const pale = rgb('#c9ccd1');
  const k = pose[0] === 'w' ? WALK[Number(pose[1])] : 0;
  const bob = pose[0] === 'w' ? BOB[Number(pose[1])] * 0.7 : 0;
  const lunge = pose === 'a1' ? 6 : pose === 'a0' ? -2 : 0;
  const dip = pose === 'a1' ? 0.3 : pose === 'a0' ? -0.35 : 0;
  md.at(T(0, bob, lunge), () => {
    for (const [x, z, ph] of [[-4.5, 10, 1], [4.5, 10, -1], [-4.5, -10, -1], [4.5, -10, 1]] as const) {
      md.at(chain(T(x, 12, z), swing(k * ph)), () => {
        box(md, -1.8, -12, -1.8, 1.8, 0, 1.8, dark, 0.9);
        box(md, -2, -12, -2.2, 2, -10.6, 2.6, rgb('#33363c'));
      });
    }
    // A lean body, deeper at the chest, with a pale belly.
    box(md, -6, 11, -13, 6, 20, 11, fur, 0.85);
    box(md, -6.6, 12, 4, 6.6, 22.5, 13, fur, 0.85);
    box(md, -4.5, 10.6, -10, 4.5, 12, 11, pale);
    // A bushy tail held up.
    md.at(chain(T(0, 18, -13), Rx(-0.9)), () => prism(md, 2.6, 1, 0, 12, 5, fur));
    // The head on a raised neck: a long snout, ears, pale cheeks.
    md.at(chain(T(0, 20, 12), Rx(dip)), () => {
      box(md, -5, -4, 0, 5, 5, 8, fur, 0.85);
      md.at(chain(T(0, -1.5, 8), Rx(Math.PI / 2)), () => prism(md, 3, 2, 0, 7, 6, pale, Math.PI / 6));
      box(md, -1.2, -0.6, 14.6, 1.2, 0.8, 15.2, rgb('#1d1a22'));
      for (const side of [-1, 1]) {
        md.at(chain(T(side * 3.2, 4.5, 2), Rz(side * -0.2)), () => slab(md, [[-1.8, 0], [1.8, 0], [0, 6]], -0.7, 0.7, dark));
        box(md, side * 2.6 - 0.9, 1, 7.6, side * 2.6 + 0.9, 2.4, 8.3, rgb('#f2c14e'), 1, 0.6);
      }
    });
  });
  return md;
}

/**
 * A brute: a hulking stone golem on short legs, its back grown with crystals. The ember brute's
 * glow orange and the moss brute's green, with moss on its shoulders.
 */
export function bruteModel(kind: 'ember' | 'moss', pose: PoseName): Model {
  const md = new Model();
  const glow = rgb(kind === 'ember' ? '#ff8a3d' : '#7fe08a');
  const stone = rgb(kind === 'ember' ? '#6e625c' : '#68705f');
  const dark = rgb(kind === 'ember' ? '#4a403b' : '#454c3f');
  const p = classPose('minion', pose);
  md.at(T(0, p.bob, 0), () => {
    for (const side of [-1, 1]) {
      const a = side < 0 ? p.legR : p.legL;
      md.at(chain(T(side * 6, 12, 0), swing(a * 0.7)), () => box(md, -4, -12, -4, 4, 0, 4.5, dark, 0.9));
    }
    md.at(chain(T(0, 12, 0), Rx(p.lean), T(0, -12, 0)), () => {
      // A boulder of a body, broader at the shoulders, with a small head sunk in front.
      box(md, -11, 12, -7, 11, 34, 8, stone, 1.15);
      md.at(T(0, 34, 3), () => {
        box(md, -4.5, 0, -3, 4.5, 7, 5, stone);
        for (const side of [-1, 1]) box(md, side * 2.2 - 1, 3, 4.8, side * 2.2 + 1, 4.8, 5.5, glow, 1, 0.9);
      });
      // Crystals along the back.
      for (let i = 0; i < 4; i++) md.at(chain(T((i % 2 ? 4 : -4), 30 - i * 4, -7), Rx(-0.6)), () => gem(md, 2.6, -1, 3, 9, 5, glow, 0.6));
      if (kind === 'moss') for (const side of [-1, 1]) md.at(T(side * 9, 34, 0), () => ico(md, 4.2, rgb('#4f8d44')));
      // Long arms with heavy fists.
      for (const side of [-1, 1]) {
        const a = side < 0 ? p.armR : p.armL;
        md.at(chain(T(side * 13.5, 30, 0), Rz(side * 0.15), swing(a)), () => {
          box(md, -3.4, -14, -3.4, 3.4, 2, 3.4, stone, 0.9);
          md.at(T(0, -17, 0), () => ico(md, 5, dark));
        });
      }
    });
  });
  return scaled(md, 1.2);
}

/** A watchstone: a carved standing stone on a round step, crowned with a crystal in its team's colour (pale gold while untaken). */
export function watchstoneModel(team: TeamName | 'neutral'): Model {
  const md = new Model();
  const glow = rgb(team === 'neutral' ? '#f4d35e' : TEAM_GLOW[team]);
  prism(md, 20, 18, 0, 5, 8, STONE_D, Math.PI / 8);
  prism(md, 7.5, 6, 5, 40, 4, STONE, Math.PI / 4);
  for (let i = 0; i < 3; i++) box(md, -6.6, 12 + i * 9, 5.5, 6.6, 14 + i * 9, 6.4, glow, 1, 0.5);
  md.at(T(0, 46, 0), () => gem(md, 6, -6, 1, 12, 6, glow, 0.5));
  return md;
}

/**
 * The guardian beast: a hulking horned quadruped of slate hide with violet crystals growing along
 * its back, built like the boar but heavier, and drawn about twice its size.
 */
export function beastModel(pose: PoseName, elder = false): Model {
  const md = new Model();
  // The elder form is darker, with gold crystals and pale gold horns.
  const hide = rgb(elder ? '#4b4460' : '#5d5a72');
  const dark = rgb(elder ? '#2e2a40' : '#3a3850');
  const belly = rgb(elder ? '#a08a74' : '#8a84a0');
  const horn = rgb(elder ? '#fff0b8' : '#efe6cf');
  const crystal = rgb(elder ? '#ffc93d' : '#b98cff');
  const k = pose[0] === 'w' ? WALK[Number(pose[1])] : 0;
  const lunge = pose === 'a1' ? 5 : pose === 'a0' ? -3 : 0;
  const rear = pose === 'a0' ? -0.18 : pose === 'a1' ? 0.12 : 0;
  md.at(chain(T(0, 0, lunge), Rx(rear)), () => {
    // Four thick legs, the front pair longer, like a great ape on its knuckles.
    for (const [x, z, h, ph] of [[-11, 11, 15, 1], [11, 11, 15, -1], [-9, -12, 12, -1], [9, -12, 12, 1]] as const) {
      md.at(chain(T(x, h, z), swing(k * ph * 0.6)), () => {
        box(md, -3.8, -h, -3.8, 3.8, 0, 3.8, dark, 0.85);
        box(md, -4.2, -h, -4.4, 4.2, -h + 2.6, 4.8, rgb('#25233a'));
      });
    }
    // The body: a broad back rising to great humped shoulders.
    box(md, -12, 11, -15, 12, 26, 6, hide, 0.82);
    box(md, -16, 12, 2, 16, 32, 15, hide, 0.8);
    box(md, -10, 10, -12, 10, 13, 12, belly, 0.9);
    // Crystals along the spine and the shoulders.
    for (let i = 0; i < 5; i++) {
      md.at(chain(T((i % 2 ? 1 : -1) * 2.5, 30 - i * 1.8, 10 - i * 6), Rz((i % 2 ? -1 : 1) * 0.25)), () => gem(md, 2.8 - i * 0.2, -1, 4, 11 - i, 5, crystal, 0.5));
    }
    for (const side of [-1, 1]) md.at(chain(T(side * 13, 30, 8), Rz(side * -0.6)), () => gem(md, 2.4, -1, 3, 9, 5, crystal, 0.5));
    // The head, low and heavy, with two great horns sweeping out and up.
    md.at(chain(T(0, 22, 16), Rx(pose === 'a1' ? 0.3 : 0)), () => {
      box(md, -9, -7, 0, 9, 6, 10, hide, 0.86);
      box(md, -6.5, -8, 8, 6.5, -1, 13.5, belly, 0.9);
      for (const side of [-1, 1]) {
        md.at(chain(T(side * 8, 3, 4), Rz(side * -1.25), Rx(-0.3)), () => {
          prism(md, 2.8, 2, 0, 9, 5, horn);
          md.at(chain(T(0, 9, 0), Rz(side * 0.9)), () => prism(md, 2, 0.3, 0, 9, 5, horn));
        });
        box(md, side * 4.2 - 1.3, 0.5, 9.6, side * 4.2 + 1.3, 3, 10.4, crystal, 1, 0.9);
      }
    });
  });
  return scaled(md, 2.1);
}

/** An inhibitor: a crystal in the team's colour held in a ring of stone posts on a low plinth. */
export function inhibitorModel(team: TeamName): Model {
  const md = new Model();
  const glow = rgb(TEAM_GLOW[team]);
  prism(md, 26, 24, 0, 6, 8, STONE_D, Math.PI / 8);
  prism(md, 18, 17, 6, 11, 8, STONE, Math.PI / 8);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    md.at(T(Math.cos(a) * 19, 6, Math.sin(a) * 19), () => {
      box(md, -2.6, 0, -2.6, 2.6, 20, 2.6, STONE_L, 0.8);
      md.at(T(0, 20, 0), () => gem(md, 2.4, 0, 2, 5, 4, glow, 0.4));
    });
  }
  md.at(T(0, 16, 0), () => gem(md, 8, -4, 12, 34, 6, glow, 0.4, Math.PI / 6));
  return md;
}

/** A stone tower on an octagonal base, crenellated, with a crystal and a banner in the team's colour. */
export function towerModel(team: TeamName): Model {
  const md = new Model();
  const glow = rgb(TEAM_GLOW[team]);
  const cloth = rgb(TEAM_CLOTH[team]);
  prism(md, 27, 25, 0, 12, 8, STONE_D, Math.PI / 8);
  // The shaft in courses of stone, each a slightly different grey.
  const course = [STONE, STONE_L, STONE, STONE_D, STONE_L, STONE];
  course.forEach((c, i) => prism(md, 20 - i * 0.5, 19.5 - i * 0.5, 12 + i * 9, 21 + i * 9, 8, c, Math.PI / 8 + (i % 2) * 0.08));
  prism(md, 24, 24, 66, 72, 8, STONE_L, Math.PI / 8);
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    md.at(chain(T(Math.cos(a) * 21, 72, Math.sin(a) * 21), Rx(0)), () => box(md, -3.4, 0, -3.4, 3.4, 6, 3.4, STONE));
  }
  // A window slit and a door.
  box(md, -2, 42, 18.4, 2, 52, 19.6, rgb('#2a2e36'));
  box(md, -5, 12, 19.2, 5, 25, 20.6, rgb('#5a3f2a'));
  // The crystal floats over the top.
  md.at(T(0, 88, 0), () => gem(md, 8, -10, 0, 14, 6, glow, 0.45));
  // The banner on a pole.
  md.at(T(14, 72, -8), () => {
    prism(md, 0.8, 0.8, 0, 26, 4, WOOD);
    slab(md, [[0.6, 25.5], [13, 22.5], [0.6, 18]], -0.6, 0.6, cloth);
  });
  return md;
}

/** The rubble of a fallen tower. */
export function rubbleModel(): Model {
  const md = new Model();
  prism(md, 27, 25, 0, 8, 8, STONE_D, Math.PI / 8);
  prism(md, 20, 18, 8, 16, 8, STONE, Math.PI / 8);
  const rocks: [number, number, number, number][] = [[-14, 10, 10, 6], [12, 9, 12, 7], [3, 16, -6, 6], [-8, 9, -14, 5], [16, 6, -4, 5], [-2, 18, 6, 4]];
  for (const [x, y, z, r] of rocks) md.at(T(x, y, z), () => ico(md, r, (i) => (i % 3 === 0 ? STONE_L : STONE)));
  return md;
}

/** The Nexus: a great crystal on a stepped hexagonal plinth, with smaller shards around it. */
export function nexusModel(team: TeamName): Model {
  const md = new Model();
  const glow = rgb(TEAM_GLOW[team]);
  prism(md, 50, 46, 0, 9, 6, STONE_D, Math.PI / 6);
  prism(md, 38, 34, 9, 18, 6, STONE, Math.PI / 6);
  prism(md, 24, 22, 18, 24, 6, STONE_L, Math.PI / 6);
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    md.at(chain(T(Math.cos(a) * 31, 18, Math.sin(a) * 31), Rz(Math.cos(a) * 0.3), Rx(-Math.sin(a) * 0.3)), () => gem(md, 4, -2, 2, 16, 5, glow, 0.35));
  }
  md.at(T(0, 30, 0), () => gem(md, 16, -6, 28, 82, 6, glow, 0.35, Math.PI / 6));
  return md;
}

/** A pine: a trunk and three tiers of needles, in one of a few greens. */
export function pineModel(shade: number): Model {
  const md = new Model();
  const greens = ['#2f6b3a', '#356f3c', '#2a5f37', '#3b7841'];
  const g = rgb(greens[shade % greens.length]);
  prism(md, 2.4, 2, 0, 9, 5, rgb('#6b4a2e'));
  prism(md, 15, 0, 7, 28, 7, g, shade * 0.4);
  prism(md, 12, 0, 18, 38, 7, g, shade * 0.4 + 0.3);
  prism(md, 8.5, 0, 29, 48, 7, g, shade * 0.4 + 0.6);
  return md;
}

/** A rock: a squashed icosahedron in greys. */
export function rockModel(r: number, shade: number): Model {
  const md = new Model();
  const greys = [STONE, STONE_L, STONE_D];
  md.at(S(1, 0.7, 1), () => ico(md, r, (i) => greys[(i + shade) % 3]));
  return md;
}

/** A low-poly coin, seen from the front. */
export function coinModel(): Model {
  const md = new Model();
  md.at(Rx(Math.PI / 2 - 0.4), () => {
    prism(md, 9, 9, -1.6, 1.6, 8, GOLD, Math.PI / 8, 0.2);
    prism(md, 6, 5, 1.6, 2.6, 8, rgb('#ffd977'), Math.PI / 8, 0.3);
  });
  return md;
}

/** A broken pillar of an old ruin, in one of four heights, with moss on its top. */
export function ruinModel(v: number): Model {
  const md = new Model();
  const h = [22, 14, 30, 9][v % 4];
  prism(md, 9, 8.5, 0, 4, 6, STONE_D, 0.3);
  prism(md, 6.5, 6, 4, 4 + h, 6, (v % 2 ? STONE : STONE_L), 0.3 + v * 0.2);
  md.at(T(0, 4 + h, 0), () => gem(md, 5.5, -1, 1, 2.5, 6, rgb('#4f8d44'), 0, 0.3));
  return md;
}
