// Bakes the low-poly models into sprite sheets: at boot the minions, the jungle's boar, wolf and
// brutes, the guardian beast, towers, inhibitors, watchstones, rubble, the Nexus, a coin and one
// figure per champion class for the pick cards; at the start of a match the champions in it, in
// their team's colours (`bakeChampions`). Each moving one is drawn from eight directions in eight poses. Frames are named `${dir}:${pose}`; dir 0
// faces right (east) and each step turns 45 degrees clockwise on screen, so dir 2 faces the viewer.

import Phaser from 'phaser';
import { sharpRes } from '../../../../shared/scaling';
import { INK, INK_WIDTH, Model, render } from './lowpoly';
import { POSES, PoseName, TeamName, beastModel, bruteModel, drakeModel, inhibitorModel, boarModel, championModel, coinModel, mercModel, minionModel, nexusModel, rubbleModel, towerModel, watchstoneModel, wolfModel } from './models';
import { CHAMPIONS, type DrakeElement } from '../game/data';

/**
 * Canvas pixels per game pixel in the sheets; sprites are drawn at 1 / RES scale. 2 on a screen that
 * needs no scaling, more on a big or dense one (set by `bakeUnits`, in half steps, held to what the
 * beast's sheet, the widest, can load).
 */
export let RES = 2;
export const DIRS = 8;

export interface SheetInfo {
  key: string;
  /** Cell size and where the feet sit inside it, in screen pixels. */
  w: number;
  h: number;
  footY: number;
}

export const CHAMP_CELL = { w: 76, h: 98, footY: 80 };
export const MINION_CELL = { w: 48, h: 56, footY: 42 };
export const MERC_CELL = { w: 58, h: 68, footY: 52 };
export const BOAR_CELL = { w: 84, h: 72, footY: 44 };
export const WOLF_CELL = { w: 80, h: 66, footY: 44 };
export const BRUTE_CELL = { w: 104, h: 112, footY: 84 };
export const WATCH_CELL = { w: 60, h: 92, footY: 72 };
export const TOWER_CELL = { w: 76, h: 124, footY: 104 };
export const RUBBLE_CELL = { w: 76, h: 56, footY: 36 };
export const NEXUS_CELL = { w: 120, h: 134, footY: 100 };
export const BEAST_CELL = { w: 170, h: 150, footY: 104 };
export const DRAKE_CELL = { w: 120, h: 110, footY: 74 };
export const INHIB_CELL = { w: 72, h: 84, footY: 64 };
export const COIN_CELL = { w: 26, h: 26, footY: 13 };

/** The screen angle a direction faces, in radians (0 is right, pi/2 is down). */
export function dirAngle(dir: number) {
  return (dir * Math.PI * 2) / DIRS;
}
/** The nearest of the eight directions to a facing angle in radians. */
export function dirFor(facing: number) {
  const d = Math.round(facing / (Math.PI / 4));
  return ((d % DIRS) + DIRS) % DIRS;
}
export const frameName = (dir: number, pose: PoseName | 'idle') => `${dir}:${pose}`;

interface Cell {
  name: string;
  model: () => Model;
  yaw: number;
}

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Renders the cells of one sheet in a grid and registers each as a named frame. */
function bake(scene: Phaser.Scene, key: string, cell: { w: number; h: number; footY: number }, cells: Cell[], post?: (canvas: HTMLCanvasElement) => HTMLCanvasElement) {
  const cols = Math.min(cells.length, 8);
  const rows = Math.ceil(cells.length / cols);
  const cw = cell.w * RES;
  const ch = cell.h * RES;
  let canvas = makeCanvas(cols * cw, rows * ch);
  const ctx = canvas.getContext('2d')!;
  cells.forEach((c, i) => {
    const x = (i % cols) * cw;
    const y = Math.floor(i / cols) * ch;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, cw, ch);
    ctx.clip();
    render(ctx, c.model(), x + cw / 2, y + cell.footY * RES, RES, { yaw: c.yaw, noInk: true });
    ctx.restore();
  });
  canvas = inkOutline(canvas);
  if (post) canvas = post(canvas);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, canvas)!;
  cells.forEach((c, i) => tex.add(c.name, 0, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch));
  return canvas;
}

/** Eight directions times every pose of a moving unit. */
function movingCells(model: (pose: PoseName) => Model): Cell[] {
  const cells: Cell[] = [];
  for (let dir = 0; dir < DIRS; dir++) {
    for (const pose of POSES) cells.push({ name: frameName(dir, pose), model: () => model(pose), yaw: Math.PI / 2 - dirAngle(dir) });
  }
  return cells;
}

/**
 * The toon look's ink outline for a whole sheet at once: the sheet's silhouette in ink, drawn a
 * little out in eight directions, under the sheet. Much cheaper than stroking every face.
 */
function inkOutline(src: HTMLCanvasElement): HTMLCanvasElement {
  const ink = makeCanvas(src.width, src.height);
  const ictx = ink.getContext('2d')!;
  ictx.drawImage(src, 0, 0);
  ictx.globalCompositeOperation = 'source-in';
  ictx.fillStyle = INK;
  ictx.fillRect(0, 0, ink.width, ink.height);
  const out = makeCanvas(src.width, src.height);
  const ctx = out.getContext('2d')!;
  const r = Math.max(1, (INK_WIDTH * RES) / 2);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    ctx.drawImage(ink, Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r));
  }
  ctx.drawImage(src, 0, 0);
  return out;
}

/** A gold silhouette two and a half pixels wider than each frame of a sheet, for the last-hit outline. */
function outlineOf(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = makeCanvas(src.width, src.height);
  const ctx = out.getContext('2d')!;
  const r = 2.5 * RES;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12;
    ctx.drawImage(src, Math.round(Math.cos(a) * r), Math.round(Math.sin(a) * r));
  }
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#ffd34d';
  ctx.fillRect(0, 0, out.width, out.height);
  return out;
}

export const TEAMS: TeamName[] = ['blue', 'red'];

export const champKey = (id: string, team: TeamName) => `lb-champ-${id}-${team}`;
/** One idle figure per class, facing the viewer, for the pick cards. */
export const pickKey = (id: string) => `lb-pick-${id}`;
export const WOLF = 'lb-wolf';
export const bruteKey = (kind: 'ember' | 'moss') => `lb-brute-${kind}`;
export const watchKey = (side: TeamName | 'neutral') => `lb-watch-${side}`;
export const minionKey = (team: TeamName) => `lb-minion-${team}`;
export const MINION_OUTLINE = 'lb-minion-outline';
export const BOAR = 'lb-boar';
export const MERC_KEY = 'lb-merc';
export const towerKey = (team: TeamName) => `lb-tower-${team}`;
export const nexusKey = (team: TeamName) => `lb-nexus-${team}`;
export const RUBBLE = 'lb-rubble';
export const BEAST_KEY = 'lb-beast';
/** The elder beast's sheet, baked the first time it appears (`bakeElder`). */
export const ELDER_KEY = 'lb-beast-elder';
/** A river drake's sheet by element, baked the first time a drake of it appears (`bakeDrake`). */
export const drakeKey = (element: DrakeElement) => `lb-drake-${element}`;
export const inhibKey = (team: TeamName) => `lb-inhib-${team}`;
export const COIN = 'lb-coin';

/** Bakes every unit sheet once; later calls do nothing. Returns the time it took, in ms. */
export function bakeUnits(scene: Phaser.Scene): number {
  if (scene.textures.exists(COIN)) return 0;
  const t0 = performance.now();
  RES = Math.floor(sharpRes(BEAST_CELL.w * DIRS, BEAST_CELL.h * DIRS, 2) * 2) / 2;
  for (const c of CHAMPIONS) bake(scene, pickKey(c.id), CHAMP_CELL, [{ name: frameName(2, 'idle'), model: () => championModel(c.id, 'blue', 'idle'), yaw: Math.PI / 2 - dirAngle(2) }]);
  for (const team of TEAMS) {
    const sheet = bake(scene, minionKey(team), MINION_CELL, movingCells((p) => minionModel(team, p)));
    if (team === 'red') {
      const cells = movingCells((p) => minionModel(team, p));
      const tex = scene.textures.addCanvas(MINION_OUTLINE, outlineOf(sheet))!;
      const cw = MINION_CELL.w * RES;
      const ch = MINION_CELL.h * RES;
      cells.forEach((c, i) => tex.add(c.name, 0, (i % 8) * cw, Math.floor(i / 8) * ch, cw, ch));
    }
    bake(scene, towerKey(team), TOWER_CELL, [{ name: 'idle', model: () => towerModel(team), yaw: 0.2 }]);
    bake(scene, inhibKey(team), INHIB_CELL, [{ name: 'idle', model: () => inhibitorModel(team), yaw: 0.2 }]);
    bake(scene, nexusKey(team), NEXUS_CELL, [{ name: 'idle', model: () => nexusModel(team), yaw: 0.25 }]);
  }
  for (const side of ['neutral', ...TEAMS] as const) bake(scene, watchKey(side), WATCH_CELL, [{ name: 'idle', model: () => watchstoneModel(side), yaw: 0.3 }]);
  bake(scene, BOAR, BOAR_CELL, movingCells(boarModel));
  bake(scene, MERC_KEY, MERC_CELL, movingCells(mercModel));
  bake(scene, WOLF, WOLF_CELL, movingCells(wolfModel));
  for (const kind of ['ember', 'moss'] as const) bake(scene, bruteKey(kind), BRUTE_CELL, movingCells((p) => bruteModel(kind, p)));
  bake(scene, BEAST_KEY, BEAST_CELL, movingCells(beastModel));
  bake(scene, RUBBLE, RUBBLE_CELL, [{ name: 'idle', model: rubbleModel, yaw: 0.2 }]);
  bake(scene, COIN, COIN_CELL, [{ name: 'idle', model: coinModel, yaw: 0.3 }]);
  return performance.now() - t0;
}

/** Bakes the elder beast's sheet if it is not baked yet. Returns the time it took, in ms. */
export function bakeElder(scene: Phaser.Scene): number {
  if (scene.textures.exists(ELDER_KEY)) return 0;
  const t0 = performance.now();
  bake(scene, ELDER_KEY, BEAST_CELL, movingCells((p) => beastModel(p, true)));
  return performance.now() - t0;
}

/** Bakes a river drake's sheet if it is not baked yet. Returns the time it took, in ms. */
export function bakeDrake(scene: Phaser.Scene, element: DrakeElement): number {
  if (scene.textures.exists(drakeKey(element))) return 0;
  const t0 = performance.now();
  bake(scene, drakeKey(element), DRAKE_CELL, movingCells((p) => drakeModel(element, p)));
  return performance.now() - t0;
}

/** Bakes the sheets of the champions in a match that are not baked yet. Returns the time it took, in ms. */
export function bakeChampions(scene: Phaser.Scene, list: { id: string; team: TeamName }[]): number {
  const t0 = performance.now();
  for (const { id, team } of list) {
    if (!scene.textures.exists(champKey(id, team))) bake(scene, champKey(id, team), CHAMP_CELL, movingCells((p) => championModel(id, team, p)));
  }
  return performance.now() - t0;
}
