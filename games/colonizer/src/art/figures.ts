// Embroidered figures in profile for every unit, in a few baked frames per pose: villagers walk,
// carry wood, food or ore, chop with an axe, reap with a sickle, mine with a pick and hammer at a
// building; soldiers walk (riders gallop) and fight: a sword, club or spear blow, an archer's
// draw-and-loose, a slinger's whirl and a rider's charge. Every figure faces right and the scene
// flips it for left. Each unit's frames sit side by side on one canvas (see `bakeFigureSheet`).
import type { FactionId, Role } from '../game/data';
import { canvas, knot, mix, outline, P, reseed, se, sp, T, thread, type Ctx, type Pt } from './stitch';

/** Size of one frame, and where the unit's feet sit in it. */
export const FRAME = 64;
export const FEET = { x: 32, y: 56 };

/** Each side that draws figures: the three factions, and the wild guards of the neutral camps. */
export type Side = FactionId | 'wild';

/** The wool colours of each side: tunic, shield, helm, horse and mane. */
export const WOOL: Record<Side, { cloth: string; trim: string; helm: string; boss: string; horse: string; mane: string; smock: string }> = {
  ember: { cloth: T.red, trim: T.ochre, helm: T.indigo, boss: T.red, horse: T.buff, mane: T.red, smock: T.sage },
  tide: { cloth: T.indigo, trim: T.teal, helm: T.ochre, boss: T.ochre, horse: T.teal, mane: T.ochre, smock: T.sage },
  thorn: { cloth: T.green, trim: T.ochre, helm: T.brown, boss: T.green, horse: T.sage, mane: T.ochre, smock: T.tan },
  wild: { cloth: T.brown, trim: T.grey, helm: T.grey, boss: T.ink, horse: T.tan, mane: T.ink, smock: T.tan },
};

/** The poses and how many frames each has. Villagers have every pose; soldiers idle, walk and attack. */
export const VILLAGER_POSES = { idle: 1, walk: 4, 'carry-wood': 4, 'carry-food': 4, 'carry-ore': 4, chop: 3, reap: 3, mine: 3, build: 3 } as const;
export const SOLDIER_POSES = { idle: 1, walk: 4, attack: 3 } as const;
/** A trade cart only stands and rolls. */
export const CART_POSES = { idle: 1, walk: 4 } as const;
export type Pose = keyof typeof VILLAGER_POSES;

type Kind = 'villager' | 'sword' | 'club' | 'spear' | 'bow' | 'longbow' | 'sling' | 'lance' | 'horsespear' | 'horseaxe' | 'cart' | 'ram' | 'warlord' | 'seer' | 'druid' | 'torch' | 'harpoon' | 'warden';

/** Which figure a unit type is drawn as. */
function kindOf(type: string, role: Role): Kind {
  if (role === 'villager') return 'villager';
  if (role === 'cart') return 'cart';
  if (role === 'siege') return 'ram';
  const name = type.split('-')[1];
  const kinds: Record<string, Kind> = {
    militia: 'sword', spearman: 'spear', brute: 'club',
    archer: 'bow', slinger: 'sling', hunter: 'longbow',
    knight: 'lance', rider: 'horsespear', stalker: 'horseaxe',
    brigand: 'club', poacher: 'bow',
    warlord: 'warlord', seer: 'seer', druid: 'druid',
    torchbearer: 'torch', harpooner: 'harpoon', warden: 'warden',
  };
  return kinds[name] ?? 'sword';
}

// ---------------------------------------------------------------- parts

function legs(c: Ctx, x: number, y: number, col: string, stride: number) {
  for (const k of [-1.6, 1.8]) {
    const fx = x + k * 1.2;
    const off = (k < 0 ? stride : -stride) * 3;
    sp(c, [[fx - 1.3, y - 11], [fx + 1.3, y - 11], [fx + off + 1.1, y - 1], [fx + off - 1.1, y - 1]], col, { ang: 0, noCouch: true, lw: 0.5 });
    for (let g = 0; g < 3; g++) {
      const t = (g + 1) / 4;
      const gx = fx + off * (1 - t);
      thread(c, [[gx - 1.2, y - 1 - (1 - t) * 10 + 1], [gx + 1.2, y - 1 - (1 - t) * 10 - 1]], T.ink, 0.45);
    }
    sp(c, [[fx + off - 1.3, y - 1.5], [fx + off + 3.3, y - 1.5], [fx + off + 3.3, y + 0.5], [fx + off - 1.3, y + 0.5]], T.ink, { line: false, noCouch: true });
  }
}

function body(c: Ctx, x: number, y: number, cloth: string, lean: number, mail = false, wide = 0) {
  const pts: Pt[] = [[x - 4 - wide + lean, y - 23], [x + 4 + wide + lean, y - 23], [x + 6.5 + wide, y - 10], [x - 6.5 - wide, y - 10]];
  sp(c, pts, cloth, { ang: Math.PI / 2, sp: 1.1 });
  if (mail) {
    c.save();
    P(pts)(c);
    c.clip();
    c.strokeStyle = mix(cloth, '#ffffff', 0.4);
    c.lineWidth = 0.45;
    for (let yy = y - 22; yy < y - 9; yy += 2.2)
      for (let xx = x - 8 + (Math.round(yy) % 2); xx < x + 8; xx += 2.2) {
        c.beginPath();
        c.arc(xx, yy, 0.8, 0, Math.PI * 2);
        c.stroke();
      }
    c.restore();
  }
}

function head(c: Ctx, x: number, y: number, helm: string | null, hood: string | null) {
  se(c, x, y - 26.5, 3.4, 3.6, T.skin, { noCouch: true, lw: 0.7 });
  knot(c, x + 1.4, y - 27, 0.5, T.ink);
  if (helm) {
    sp(c, [[x - 3.8, y - 27], [x + 3.8, y - 27], [x + 0.5, y - 34], [x - 0.5, y - 34]], helm, { ang: Math.PI / 2, noCouch: true, lw: 0.7 });
    // The nasal guard of a Norman helm.
    thread(c, [[x + 2.6, y - 27], [x + 2.6, y - 24.5]], T.ink, 0.8);
  }
  if (hood)
    sp(c, [[x - 4, y - 25], [x - 3.6, y - 29], [x, y - 31.5], [x + 3.6, y - 29], [x + 4, y - 25], [x + 2.5, y - 28], [x - 2.5, y - 28]], hood, { noCouch: true, lw: 0.7 });
}

function kite(c: Ctx, x: number, y: number, col: string, boss: string) {
  sp(c, [[x - 4, y - 21], [x + 4, y - 21], [x + 4.5, y - 15], [x, y - 6], [x - 4.5, y - 15]], col, { ang: Math.PI / 2, sp: 1.1, noCouch: true, lw: 0.8 });
  knot(c, x, y - 16, 1.2, boss);
  thread(c, [[x - 3, y - 19], [x + 3, y - 19]], mix(col, '#000000', 0.3), 0.5);
}

/** An arm from the shoulder to the hand, with the hand as a knot. */
function arm(c: Ctx, sx: number, sy: number, hx: number, hy: number, sleeve: string) {
  thread(c, [[sx, sy], [(sx + hx) / 2 + 0.5, (sy + hy) / 2 + 1], [hx, hy]], sleeve, 2.2);
  knot(c, hx, hy, 1.1, T.skin);
}

const along = (x: number, y: number, a: number, d: number): Pt => [x + Math.cos(a) * d, y + Math.sin(a) * d];
const across = (x: number, y: number, a: number, d: number): Pt => [x - Math.sin(a) * d, y + Math.cos(a) * d];

/** A tool or weapon held at (hx, hy), pointing along `ang`. */
function tool(c: Ctx, kind: string, hx: number, hy: number, ang: number) {
  if (kind === 'axe' || kind === 'pick' || kind === 'hammer') {
    const len = kind === 'pick' ? 13 : kind === 'axe' ? 12 : 10;
    thread(c, [along(hx, hy, ang, -3), along(hx, hy, ang, len)], T.brown, 1.4);
    const [tx, ty] = along(hx, hy, ang, len);
    if (kind === 'axe') {
      const a1 = across(tx, ty, ang, -1);
      const a2 = across(tx, ty, ang, -5.5);
      const b2 = along(a2[0], a2[1], ang, -3.5);
      sp(c, [a1, a2, b2, along(a1[0], a1[1], ang, -2)], T.grey, { noCouch: true, lw: 0.5 });
    } else if (kind === 'pick') {
      const p1 = across(tx, ty, ang, -5);
      const p2 = across(tx, ty, ang, 5);
      thread(c, [along(p1[0], p1[1], ang, -2), [tx, ty], along(p2[0], p2[1], ang, -2)], T.grey, 1.6);
    } else {
      const h1 = across(tx, ty, ang, -3);
      const h2 = across(tx, ty, ang, 3);
      thread(c, [h1, h2], T.grey, 3);
    }
    return;
  }
  if (kind === 'sickle') {
    thread(c, [along(hx, hy, ang, -1), along(hx, hy, ang, 4)], T.brown, 1.4);
    const [tx, ty] = along(hx, hy, ang, 4);
    c.save();
    c.strokeStyle = T.grey;
    c.lineWidth = 1.4;
    c.setLineDash([2, 0.5]);
    c.beginPath();
    c.arc(tx + Math.cos(ang) * 4, ty + Math.sin(ang) * 4, 4, ang + Math.PI, ang + Math.PI * 1.9 + Math.PI * 0.1);
    c.stroke();
    c.restore();
    return;
  }
  if (kind === 'sword') {
    thread(c, [[hx, hy], along(hx, hy, ang, 13)], T.grey, 1.5);
    thread(c, [along(hx, hy, ang, 13), along(hx, hy, ang, 14.5)], mix(T.grey, '#ffffff', 0.3), 0.9);
    thread(c, [across(hx + Math.cos(ang) * 1.5, hy + Math.sin(ang) * 1.5, ang, -2.5), across(hx + Math.cos(ang) * 1.5, hy + Math.sin(ang) * 1.5, ang, 2.5)], T.ochre, 1.2);
    knot(c, ...along(hx, hy, ang, -1.5), 0.9, T.ochre);
    return;
  }
  if (kind === 'club') {
    const [tx, ty] = along(hx, hy, ang, 12);
    sp(c, [across(hx, hy, ang, -0.9), across(hx, hy, ang, 0.9), across(tx, ty, ang, 2.6), across(tx, ty, ang, -2.6)], T.bark, { noCouch: true, lw: 0.6 });
    for (const d of [6, 9, 11]) knot(c, ...across(...along(hx, hy, ang, d), ang, d % 2 ? 1.6 : -1.6), 0.7, T.brown);
    return;
  }
  if (kind === 'staff') {
    // A champion's staff: a long rod with a bound head.
    thread(c, [along(hx, hy, ang, -14), along(hx, hy, ang, 12)], T.bark, 1.5);
    const [tx, ty] = along(hx, hy, ang, 12);
    knot(c, tx, ty, 2.2, T.ochre);
    thread(c, [across(tx, ty, ang, -2.5), across(tx, ty, ang, 2.5)], T.ochre, 1);
    return;
  }
  if (kind === 'torch') {
    // A torch: a short haft with a flame of ochre and orange wool at its head.
    thread(c, [along(hx, hy, ang, -3), along(hx, hy, ang, 10)], T.brown, 1.6);
    const [tx, ty] = along(hx, hy, ang, 12);
    se(c, tx, ty - 1.5, 3.2, 4.4, T.ochre, { noCouch: true, lw: 0.5 });
    se(c, tx, ty - 0.5, 1.7, 2.6, '#e0763a', { noCouch: true, lw: 0.3 });
    return;
  }
  if (kind === 'harpoon') {
    // A harpoon: a spear with two barbs and a coil of line at the butt.
    thread(c, [along(hx, hy, ang, -10), along(hx, hy, ang, 20)], T.brown, 1.1);
    const [tx, ty] = along(hx, hy, ang, 20);
    sp(c, [across(tx, ty, ang, -1.4), across(tx, ty, ang, 1.4), along(tx, ty, ang, 5)], T.grey, { noCouch: true, lw: 0.6 });
    for (const d of [-1, 1]) thread(c, [along(tx, ty, ang, 1), across(...along(tx, ty, ang, -2), ang, d * 2.6)], T.grey, 0.8);
    const [bx, by] = along(hx, hy, ang, -10);
    thread(c, [[bx, by], [bx - 2, by + 3], [bx + 1, by + 5], [bx - 1, by + 7]], T.tan, 0.7);
    return;
  }
  if (kind === 'spear' || kind === 'lance') {
    const len = kind === 'lance' ? 28 : 24;
    thread(c, [along(hx, hy, ang, -11), along(hx, hy, ang, len)], T.brown, 1.1);
    const [tx, ty] = along(hx, hy, ang, len);
    sp(c, [across(tx, ty, ang, -1.6), across(tx, ty, ang, 1.6), along(tx, ty, ang, 5)], T.grey, { noCouch: true, lw: 0.6 });
    if (kind === 'lance') {
      // A pennon just below the point.
      const [px, py] = along(hx, hy, ang, len - 4);
      sp(c, [[px, py], along(px, py, ang, -5), across(...along(px, py, ang, -2), ang, -4)], T.ochre, { noCouch: true, lw: 0.4 });
    }
  }
}

/** A bow held at (bx, by); the string is pulled back to x = pull (none when loosed). */
function bow(c: Ctx, bx: number, by: number, r: number, pull: number | null, arrow: boolean) {
  c.save();
  c.strokeStyle = T.brown;
  c.lineWidth = 1.3;
  c.setLineDash([2, 0.5]);
  c.beginPath();
  c.arc(bx - r * 0.55, by, r, -1.05, 1.05);
  c.stroke();
  c.restore();
  const top: Pt = [bx - r * 0.55 + Math.cos(-1.05) * r, by + Math.sin(-1.05) * r];
  const bot: Pt = [bx - r * 0.55 + Math.cos(1.05) * r, by + Math.sin(1.05) * r];
  const px = pull ?? top[0];
  thread(c, [top, [px, by], bot], T.ink, 0.45);
  if (arrow && pull !== null) {
    thread(c, [[px, by], [bx + 5, by]], T.brown, 0.9);
    sp(c, [[bx + 7.5, by], [bx + 5, by - 1.5], [bx + 5, by + 1.5]], T.grey, { noCouch: true, lw: 0.4 });
    thread(c, [[px - 0.5, by - 1.2], [px + 1.5, by]], T.red, 0.8);
  }
}

function horse(c: Ctx, x: number, y: number, col: string, mane: string, gait: number | null, rear = 0) {
  // Legs first, so the body covers the hips. `gait` is the gallop phase; null stands still.
  const LEGS: [number, number][] = [[-8, 0], [-5, Math.PI], [6, Math.PI / 2], [9, Math.PI * 1.5]];
  for (const [lx, ph] of LEGS) {
    const a = gait === null ? 0 : gait + ph;
    const dx = gait === null ? 0 : Math.sin(a) * 3.5;
    const lift = gait === null ? 0 : Math.max(0, Math.cos(a)) * 3 + (lx > 0 ? rear : 0);
    thread(c, [[x + lx, y - 11], [x + lx + dx * 0.4 + 1, y - 6 - lift * 0.5], [x + lx + dx, y - lift]], T.ink, 1.6);
  }
  const by = y - rear * 0.4;
  sp(c, [[x - 12, by - 17], [x + 10, by - 17 - rear * 0.3], [x + 12, by - 12], [x + 8, by - 9], [x - 10, by - 9], [x - 13, by - 13]], col, { ang: 0 });
  sp(c, [[x + 8, by - 16], [x + 11, by - 24 - rear], [x + 16, by - 26 - rear], [x + 18, by - 22 - rear], [x + 13, by - 20 - rear], [x + 11, by - 14]], col, { ang: 0.7, lw: 0.8 });
  thread(c, [[x + 9, by - 18], [x + 11, by - 23 - rear], [x + 14, by - 26 - rear]], mane, 1.6);
  thread(c, [[x - 12, by - 15], [x - 16, by - 9 + (gait === null ? 0 : Math.sin(gait) * 1.5)], [x - 15, by - 5]], mane, 1.4);
  knot(c, x + 15.5, by - 23.5 - rear, 0.5, T.ink);
  // Saddle cloth.
  sp(c, [[x - 5, by - 18], [x + 4, by - 18], [x + 3, by - 12], [x - 4, by - 12]], mix(col, '#000000', 0.15), { noCouch: true, lw: 0.5 });
}

// ---------------------------------------------------------------- frames

interface Frame {
  stride: number;
  bob: number;
  lean: number;
  hand: Pt;
  ang: number;
}

const WALK = [1, 0, -1, 0];
const BOB = [0, -0.8, 0, -0.8];

/** One frame of a figure, with the feet at (x, y). */
export function drawFigure(c: Ctx, type: string, role: Role, faction: Side, pose: string, f: number, x: number, y: number) {
  const w = WOOL[faction];
  const kind = kindOf(type, role);
  reseed(f * 7 + pose.length * 13 + type.length);
  if (kind === 'villager') return villager(c, w, pose, f, x, y);
  if (kind === 'cart') return cart(c, w, pose, f, x, y);
  if (kind === 'ram') return ram(c, w, pose, f, x, y);
  if (kind === 'lance' || kind === 'horsespear' || kind === 'horseaxe') return rider(c, w, kind, pose, f, x, y);
  return footman(c, w, kind, pose, f, x, y);
}

/** A spoked cart wheel centred at (x, y), turned by `turn`. */
function wheel(c: Ctx, x: number, y: number, r: number, turn: number) {
  se(c, x, y, r, r, T.brown, { noCouch: true, lw: 0.8 });
  for (let k = 0; k < 3; k++) {
    const a = turn + (k * Math.PI) / 3;
    thread(c, [[x - Math.cos(a) * (r - 1), y - Math.sin(a) * (r - 1)], [x + Math.cos(a) * (r - 1), y + Math.sin(a) * (r - 1)]], T.ink, 0.7);
  }
  knot(c, x, y, 1, T.ink);
}

/** A trade cart: a villager pulling a two-wheeled cart heaped with sacks. */
function cart(c: Ctx, w: (typeof WOOL)[Side], pose: string, f: number, x: number, y: number) {
  const rolling = pose === 'walk';
  const turn = rolling ? (f * Math.PI) / 4 : 0;
  // The cart behind the walker: bed, sacks, a wheel and the shafts up to the hands.
  const bx = x - 14;
  const by = y - (rolling ? BOB[f] * 0.5 : 0);
  sp(c, [[bx - 11, by - 14], [bx + 9, by - 14], [bx + 8, by - 7], [bx - 10, by - 7]], '#a0703a', { ang: 0, lw: 0.7 });
  for (const [dx, dy] of [[-6, -17], [1, -18], [6, -16], [-2, -21]] as Pt[]) {
    se(c, bx + dx, by + dy, 4.2, 3.6, T.tan, { noCouch: true, lw: 0.6 });
    knot(c, bx + dx, by + dy - 1, 0.8, T.ochre);
  }
  wheel(c, bx - 1, by - 5, 5.5, turn);
  thread(c, [[bx + 9, by - 10], [x + 3, y - 15]], T.brown, 1.3);
  villager(c, w, rolling ? 'walk' : 'idle', f, x, y);
}

/** A siege ram: a slung log under a gabled roof on four wheels, pushed by two crewmen. */
function ram(c: Ctx, w: (typeof WOOL)[Side], pose: string, f: number, x: number, y: number) {
  const rolling = pose === 'walk';
  const turn = rolling ? (f * Math.PI) / 4 : 0;
  // The beam swings forward on the blow.
  const swing = pose === 'attack' ? [-3, 2, 7][f] : 0;
  const x0 = x - 17;
  const x1 = x + 15;
  for (const wx of [x0 + 5, x1 - 5]) wheel(c, wx, y - 4, 4.5, turn);
  // The frame: four posts and a shingled roof in the side's colour.
  for (const px of [x0 + 3, x1 - 3]) thread(c, [[px, y - 6], [px, y - 24]], T.bark, 2.2);
  sp(c, [[x0 - 3, y - 22], [x1 + 3, y - 22], [x1 - 2, y - 33], [x0 + 2, y - 33]], w.cloth, { ang: 0, lw: 0.8 });
  for (let k = 0; k < 4; k++) thread(c, [[x0 + 2 + k * 9, y - 31], [x0 + 3 + k * 9, y - 23]], mix(w.cloth, '#000000', 0.3), 0.6);
  // The log, slung on two ropes, with an iron head.
  for (const px of [x0 + 8, x1 - 8]) thread(c, [[px, y - 22], [px + swing * 0.3, y - 14]], T.ochre, 0.8);
  sp(c, [[x0 + swing, y - 16], [x1 + 2 + swing, y - 16], [x1 + 2 + swing, y - 11], [x0 + swing, y - 11]], T.brown, { ang: 0, noCouch: true, lw: 0.8 });
  sp(c, [[x1 + 1 + swing, y - 17], [x1 + 7 + swing, y - 13.5], [x1 + 1 + swing, y - 10]], T.grey, { noCouch: true, lw: 0.6 });
  // Two crewmen push from behind, in the side's cloth.
  for (const [cx, k] of [[x0 - 6, 0], [x0 + 1, 1]] as [number, number][]) {
    const stride = rolling ? WALK[(f + k) % 4] : 0;
    legs(c, cx, y, T.buff, stride);
    body(c, cx, y, w.cloth, 1.5);
    head(c, cx + 1.5, y, w.helm, null);
    arm(c, cx + 2.5, y - 21, cx + 9, y - 19, w.cloth);
  }
}

function villager(c: Ctx, w: (typeof WOOL)[Side], pose: string, f: number, x: number, y0: number) {
  const walking = pose === 'walk' || pose.startsWith('carry');
  const stride = walking ? WALK[f] : 0;
  const y = y0 + (walking ? BOB[f] : 0);
  const work: Record<string, { tool: string; frames: Frame[] }> = {
    chop: { tool: 'axe', frames: [{ stride: 0, bob: 0, lean: -1, hand: [2, -27], ang: -2.2 }, { stride: 0, bob: 0, lean: 0.5, hand: [7, -23], ang: -0.7 }, { stride: 0, bob: 0, lean: 1.5, hand: [9, -15], ang: 0.7 }] },
    reap: { tool: 'sickle', frames: [{ stride: 0.3, bob: 0, lean: 1, hand: [4, -15], ang: -1.3 }, { stride: 0.3, bob: 0, lean: 2, hand: [7, -11], ang: 0.1 }, { stride: 0.3, bob: 0, lean: 2.5, hand: [8, -8], ang: 1.2 }] },
    mine: { tool: 'pick', frames: [{ stride: 0, bob: 0, lean: -1, hand: [1, -28], ang: -2.4 }, { stride: 0, bob: 0, lean: 0.5, hand: [6, -24], ang: -1 }, { stride: 0, bob: 0, lean: 2, hand: [10, -14], ang: 0.9 }] },
    build: { tool: 'hammer', frames: [{ stride: 0, bob: 0, lean: -0.5, hand: [4, -26], ang: -1.9 }, { stride: 0, bob: 0, lean: 0.5, hand: [7, -21], ang: -0.6 }, { stride: 0, bob: 0, lean: 1, hand: [9, -16], ang: 0.5 }] },
  };
  const job = work[pose];
  const fr = job?.frames[f];
  const lean = fr?.lean ?? 0;
  legs(c, x, y, T.buff, fr?.stride ?? stride);
  if (pose === 'carry-ore') {
    // A sack of ore on the back.
    se(c, x - 6 + lean, y - 20, 4.5, 5.5, T.grey, { noCouch: true, lw: 0.7, ang: 0.4 });
    for (const [dx, dy] of [[-1, -2], [1.5, 0], [-0.5, 2]]) knot(c, x - 6 + dx, y - 20 + dy, 0.9, T.ochre);
  }
  body(c, x, y, w.smock, lean);
  thread(c, [[x - 6, y - 12], [x + 6, y - 12]], w.trim, 0.8);
  head(c, x + lean, y, null, w.cloth);
  const sx = x + 1 + lean;
  const sy = y - 21;
  if (job && fr) {
    arm(c, sx, sy, x + fr.hand[0], y + fr.hand[1], w.smock);
    tool(c, job.tool, x + fr.hand[0], y + fr.hand[1], fr.ang);
    return;
  }
  if (pose === 'carry-wood') {
    arm(c, sx, sy, x + 3, y - 25, w.smock);
    for (let k = 0; k < 3; k++) thread(c, [[x - 8, y - 22 - k * 1.8], [x + 7, y - 25 - k * 1.8]], k % 2 ? '#a0703a' : T.brown, 1.7);
    for (let k = 0; k < 3; k++) knot(c, x + 7, y - 25 - k * 1.8, 0.8, '#c49a62');
    return;
  }
  if (pose === 'carry-food') {
    arm(c, sx, sy, x + 6, y - 15, w.smock);
    sp(c, [[x + 4, y - 16], [x + 11, y - 16], [x + 10, y - 10], [x + 5, y - 10]], '#a0703a', { ang: 0, noCouch: true, lw: 0.6 });
    for (let k = 0; k < 3; k++) knot(c, x + 5.5 + k * 2.2, y - 17, 1.2, T.red);
    return;
  }
  if (pose === 'carry-ore') {
    arm(c, sx, sy, x - 2, y - 23, w.smock);
    return;
  }
  const swing = walking ? stride * 2 : 0;
  arm(c, sx, sy, x + 4 + swing, y - 14, w.smock);
}

function footman(c: Ctx, w: (typeof WOOL)[Side], kind: Kind, pose: string, f: number, x: number, y0: number) {
  const walking = pose === 'walk';
  const stride = walking ? WALK[f] : 0;
  const y = y0 + (walking ? BOB[f] : 0);
  const attack = pose === 'attack';
  const mail = kind === 'sword' || kind === 'spear' || kind === 'warlord' || kind === 'warden';
  const robed = kind === 'seer' || kind === 'druid';
  const wide = kind === 'club' || kind === 'warlord' || kind === 'warden' ? 1.5 : robed ? 1 : 0;
  // Each weapon's hand and angle: resting, then the three attack frames.
  const HANDS: Record<string, { rest: Frame; hit: Frame[] }> = {
    sword: { rest: { stride: 0, bob: 0, lean: 0, hand: [4, -18], ang: -1.1 }, hit: [{ stride: 0.4, bob: 0, lean: -1, hand: [2, -27], ang: -2.4 }, { stride: 0.6, bob: 0, lean: 1, hand: [8, -23], ang: -0.4 }, { stride: 0.8, bob: 0, lean: 2, hand: [10, -16], ang: 0.6 }] },
    club: { rest: { stride: 0, bob: 0, lean: 0, hand: [5, -16], ang: -1.2 }, hit: [{ stride: 0.4, bob: 0, lean: -1.5, hand: [1, -28], ang: -2.5 }, { stride: 0.6, bob: 0, lean: 1, hand: [8, -24], ang: -0.6 }, { stride: 0.8, bob: 0, lean: 2.5, hand: [10, -15], ang: 0.7 }] },
    spear: { rest: { stride: 0, bob: 0, lean: 0, hand: [6, -17], ang: -1.45 }, hit: [{ stride: 0.3, bob: 0, lean: -1, hand: [1, -20], ang: -0.14 }, { stride: 0.6, bob: 0, lean: 1, hand: [7, -20], ang: -0.08 }, { stride: 0.9, bob: 0, lean: 2.5, hand: [12, -20], ang: -0.04 }] },
    bow: { rest: { stride: 0, bob: 0, lean: 0, hand: [6, -19], ang: 0 }, hit: [{ stride: 0.3, bob: 0, lean: 0, hand: [8, -21], ang: 0 }, { stride: 0.3, bob: 0, lean: -0.5, hand: [9, -21], ang: 0 }, { stride: 0.3, bob: 0, lean: 0.5, hand: [9, -21], ang: 0 }] },
    sling: { rest: { stride: 0, bob: 0, lean: 0, hand: [4, -19], ang: 1.2 }, hit: [{ stride: 0.3, bob: 0, lean: -1, hand: [3, -28], ang: 0 }, { stride: 0.5, bob: 0, lean: 0, hand: [6, -29], ang: 0 }, { stride: 0.8, bob: 0, lean: 1.5, hand: [10, -22], ang: 0 }] },
    staff: { rest: { stride: 0, bob: 0, lean: 0, hand: [5, -18], ang: -1.5 }, hit: [{ stride: 0.3, bob: 0, lean: -1, hand: [3, -24], ang: -2.3 }, { stride: 0.5, bob: 0, lean: 0.5, hand: [7, -22], ang: -1 }, { stride: 0.8, bob: 0, lean: 1.5, hand: [10, -18], ang: -0.2 }] },
  };
  const hk = kind === 'longbow' ? 'bow' : kind === 'warlord' ? 'sword' : robed ? 'staff' : kind === 'torch' || kind === 'warden' ? 'club' : kind === 'harpoon' ? 'spear' : kind;
  const fr = attack ? HANDS[hk].hit[f] : HANDS[hk].rest;
  const lean = fr.lean;
  legs(c, x, y, T.buff, attack ? fr.stride : stride);
  if (kind === 'bow' || kind === 'longbow') thread(c, [[x - 3, y - 24], [x - 5, y - 14]], T.ochre, 2); // quiver
  body(c, x, y, w.cloth, lean, mail, wide);
  const hood = kind === 'bow' ? T.green : kind === 'longbow' ? T.sage : kind === 'sling' ? T.teal : kind === 'club' ? T.brown : kind === 'seer' ? T.indigo : kind === 'druid' ? T.green : kind === 'harpoon' ? T.teal : kind === 'torch' ? T.brown : null;
  if (robed) {
    // A champion's long robe over the legs, hemmed in the side's trim.
    sp(c, [[x - 6.5 + lean * 0.5, y - 11], [x + 6.5 + lean * 0.5, y - 11], [x + 8, y - 1], [x - 8, y - 1]], w.cloth, { ang: Math.PI / 2, sp: 1.1 });
    thread(c, [[x - 8, y - 2], [x + 8, y - 2]], w.trim, 1);
  }
  head(c, x + lean, y, mail ? w.helm : null, hood);
  if (kind === 'warlord') {
    // A crest of plumes on the helm, and a gold band.
    thread(c, [[x + lean - 2, y - 33], [x + lean - 6, y - 38], [x + lean - 9, y - 36]], T.red, 1.6);
    thread(c, [[x + lean - 3, y - 29], [x + lean + 3, y - 29]], T.ochre, 1);
  }
  if (kind === 'seer') {
    // A third eye of gold on the hood.
    knot(c, x + lean, y - 30, 1.3, T.ochre);
  }
  if (kind === 'warden') {
    // A crown of briars on the helm.
    for (let k = -2; k <= 2; k++) thread(c, [[x + lean + k * 1.8, y - 31], [x + lean + k * 2.4, y - 35]], T.green, 0.9);
    thread(c, [[x + lean - 4.5, y - 31.5], [x + lean + 4.5, y - 31.5]], T.bark, 1);
  }
  if (kind === 'druid') {
    // Antlers of twig.
    for (const d of [-1, 1]) thread(c, [[x + lean + d * 2, y - 31], [x + lean + d * 5, y - 36], [x + lean + d * 7, y - 35]], T.bark, 1.1);
  }
  const sx = x + 1 + lean;
  const sy = y - 21;
  const swing = walking ? stride * 1.5 : 0;
  const hx = x + fr.hand[0] + swing;
  const hy = y + fr.hand[1];
  if (kind === 'bow' || kind === 'longbow') {
    const r = kind === 'longbow' ? 11.5 : 9;
    const pulls = [x + 2 + lean, x - 3 + lean, null];
    const pull = attack ? pulls[f] : hx - 4;
    // The drawing hand rides on the string.
    if (pull !== null) arm(c, sx, sy, pull, hy, w.cloth);
    arm(c, sx, sy, hx, hy, w.cloth);
    bow(c, hx + r * 0.55 - 1, hy, r, pull, attack ? f < 2 : true);
    if (attack && f === 2) thread(c, [[hx + 9, hy - 1], [hx + 15, hy - 1]], mix(T.brown, T.linen, 0.4), 0.6);
    return;
  }
  if (kind === 'sling') {
    arm(c, sx, sy, hx, hy, w.cloth);
    const STONE: (Pt | null)[] = [[x - 4 + lean, y - 34], [x + 7, y - 37], null];
    const stone = attack ? STONE[f] : ([hx + 3, hy + 7] as Pt);
    if (stone) {
      thread(c, [[hx, hy], stone], T.brown, 0.8);
      knot(c, stone[0], stone[1], 1.6, T.grey);
    } else thread(c, [[hx, hy], [hx + 7, hy - 1]], T.brown, 0.8);
    return;
  }
  arm(c, sx, sy, hx, hy, w.cloth);
  tool(c, robed ? 'staff' : kind === 'warlord' ? 'sword' : kind === 'warden' ? 'club' : kind, hx, hy, fr.ang);
  if (kind === 'sword' || kind === 'spear' || kind === 'warlord' || kind === 'warden') kite(c, x - 3.5 + lean * 0.5, y, kind === 'warlord' ? T.ochre : w.trim, kind === 'warlord' ? w.cloth : w.boss);
}

function rider(c: Ctx, w: (typeof WOOL)[Side], kind: Kind, pose: string, f: number, x: number, y0: number) {
  const gallop = pose === 'walk' ? (f * Math.PI) / 2 : pose === 'attack' ? Math.PI / 2 + f * 0.6 : null;
  const y = y0 + (pose === 'walk' ? BOB[f] : 0);
  const rear = pose === 'attack' ? [0, 1.5, 2.5][f] : 0;
  horse(c, x, y, w.horse, w.mane, gallop, rear);
  const ry = y - rear * 0.4;
  // The rider's leg hangs over the horse's flank.
  thread(c, [[x - 1, ry - 17], [x + 1, ry - 11], [x - 0.5, ry - 8]], T.buff, 2.2);
  const mail = kind === 'lance';
  const pts: Pt[] = [[x - 3.5, ry - 30], [x + 3.5, ry - 30], [x + 5, ry - 17], [x - 5, ry - 17]];
  sp(c, pts, w.cloth, { ang: Math.PI / 2 });
  if (mail) outline(c, P(pts), mix(w.cloth, '#ffffff', 0.35), 0.5);
  se(c, x, ry - 33, 3.2, 3.4, T.skin, { noCouch: true, lw: 0.7 });
  knot(c, x + 1.4, ry - 33.5, 0.5, T.ink);
  if (kind === 'horseaxe') sp(c, [[x - 4, ry - 31], [x - 3.6, ry - 35], [x, ry - 37.5], [x + 3.6, ry - 35], [x + 4, ry - 31], [x + 2.5, ry - 34], [x - 2.5, ry - 34]], w.helm, { noCouch: true, lw: 0.7 });
  else {
    sp(c, [[x - 3.6, ry - 33.5], [x + 3.6, ry - 33.5], [x + 0.4, ry - 40], [x - 0.4, ry - 40]], w.helm, { noCouch: true, lw: 0.7 });
    thread(c, [[x + 2.4, ry - 33.5], [x + 2.4, ry - 31]], T.ink, 0.8);
  }
  const ANG = { rest: -0.55, hit: [-0.35, -0.14, 0] };
  const HAND: Pt[] = [[4, -24], [6, -23], [8, -22]];
  const hand = pose === 'attack' ? HAND[f] : ([3, -24] as Pt);
  const ang = pose === 'attack' ? ANG.hit[f] : ANG.rest;
  const hx = x + hand[0];
  const hy = ry + hand[1];
  arm(c, x + 1, ry - 28, hx, hy, w.cloth);
  if (kind === 'horseaxe') {
    // A short war axe: raised, swinging, striking.
    const axeAng = pose === 'attack' ? [-2.3, -0.9, 0.5][f] : -1.3;
    tool(c, 'axe', hx, hy, axeAng);
  } else tool(c, kind === 'lance' ? 'lance' : 'spear', hx, hy, ang);
  kite(c, x - 4, ry - 9, w.trim, w.boss);
}

/** The frames a unit has, in sheet order, as [pose, index]. */
export function framesFor(role: Role): [string, number][] {
  const poses = role === 'villager' ? VILLAGER_POSES : role === 'cart' ? CART_POSES : SOLDIER_POSES;
  const out: [string, number][] = [];
  for (const [pose, n] of Object.entries(poses)) for (let i = 0; i < n; i++) out.push([pose, i]);
  return out;
}

/** Paints every frame of one unit type for one side on a strip, FRAME pixels apart. */
export function bakeFigureSheet(type: string, role: Role, faction: Side) {
  const frames = framesFor(role);
  const { cv, c } = canvas(frames.length * FRAME, FRAME);
  frames.forEach(([pose, i], k) => drawFigure(c, type, role, faction, pose, i, k * FRAME + FEET.x, FEET.y));
  return { cv, frames };
}
