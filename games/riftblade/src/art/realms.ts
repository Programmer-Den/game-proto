/**
 * The textures of the Ocean and Ruin worlds, in the same Glow Vector style as `worlds.ts`: the
 * Ocean world's Tidebound (sea blue and foam), the Ruin world's Stone Watch (sandstone and a ghostly
 * green), each with its boss, and the squids' ink. All face right; the scene flips them toward the
 * hero. Painted with `bakeWorlds`, the first time a run gets past the Dune world.
 */
import Phaser from 'phaser';
import { C, beam, glow, outline, paint, shape, type Ctx } from './glow';

const SEA = '#7fe9ff';
const SEA_DEEP = '#3cc8ff';
const SEA_DARK = '#06202e';
const FOAM = '#e8fdff';
const STONE = '#d8c08a';
const STONE_DARK = '#241d12';
const GHOST = '#9fffc8';
const GHOST_DARK = '#0c2418';

function eliteRing(ctx: Ctx, cx: number, cy: number, r: number) {
  outline(ctx, () => ctx.arc(cx, cy, r, 0, Math.PI * 2), C.elite, 2.5, 14);
}

function dot(ctx: Ctx, x: number, y: number, r: number, color: string, blur = 6) {
  ctx.save();
  glow(ctx, color, blur);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** A shape from a list of points (relative to the centre, scaled by `k`). */
function poly(ctx: Ctx, cx: number, cy: number, k: number, pts: readonly (readonly [number, number])[]) {
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(cx + x * k, cy + y * k) : ctx.lineTo(cx + x * k, cy + y * k)));
  ctx.closePath();
}

// ---------------------------------------------------------------------------------------------
// The Ocean world: the Tidebound

/** A crab: a wide shell on six thin legs, two raised claws and eyes on stalks. */
function crab(ctx: Ctx, cx: number, cy: number, k: number, elite: boolean) {
  if (elite) eliteRing(ctx, cx, cy, 14 * k);
  outline(ctx, () => {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        ctx.moveTo(cx + side * (3 + i * 3) * k, cy + 3 * k);
        ctx.lineTo(cx + side * (8 + i * 3) * k, cy + (8 + i) * k);
      }
    }
  }, SEA_DEEP, 1.3 * k, 4);
  for (const side of [-1, 1]) {
    outline(ctx, () => {
      ctx.moveTo(cx + side * 6 * k, cy - 3 * k);
      ctx.lineTo(cx + side * 10 * k, cy - 9 * k);
    }, SEA, 1.6 * k, 4);
    shape(ctx, () => ctx.arc(cx + side * 11 * k, cy - 10 * k, 3 * k, 0, Math.PI * 2), SEA_DARK, SEA, 6);
  }
  shape(ctx, () => ctx.ellipse(cx, cy, 10 * k, 6.5 * k, 0, 0, Math.PI * 2), SEA_DARK, SEA, 10);
  dot(ctx, cx - 2.5 * k, cy - 6 * k, 1.4 * k, FOAM, 4);
  dot(ctx, cx + 2.5 * k, cy - 6 * k, 1.4 * k, FOAM, 4);
}

/** A squid: a long mantle with a fin, two big eyes and a trailing fan of tentacles. */
function squid(ctx: Ctx, cx: number, cy: number, k: number, elite: boolean) {
  if (elite) eliteRing(ctx, cx, cy, 18 * k);
  for (let i = -2; i <= 2; i++) {
    outline(ctx, () => {
      ctx.moveTo(cx - 6 * k, cy + i * 2 * k);
      ctx.quadraticCurveTo(cx - 12 * k, cy + i * 4 * k, cx - 17 * k, cy + i * 3 * k + (i % 2) * 3 * k);
    }, SEA_DEEP, 1.4 * k, 5);
  }
  shape(ctx, () => {
    ctx.moveTo(cx + 15 * k, cy);
    ctx.quadraticCurveTo(cx + 6 * k, cy - 9 * k, cx - 7 * k, cy - 6 * k);
    ctx.lineTo(cx - 7 * k, cy + 6 * k);
    ctx.quadraticCurveTo(cx + 6 * k, cy + 9 * k, cx + 15 * k, cy);
  }, SEA_DARK, SEA, 12);
  shape(ctx, () => poly(ctx, cx, cy, k, [[15, 0], [9, -8], [11, 0], [9, 8]]), SEA_DARK, SEA_DEEP, 6);
  dot(ctx, cx - 1 * k, cy - 2.5 * k, 2 * k, FOAM, 6);
  dot(ctx, cx - 1 * k, cy + 2.5 * k, 2 * k, FOAM, 6);
}

/** The Deep Kraken: a great dome of a head over a wheel of thick, curling arms. */
function kraken(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    const x1 = cx + Math.cos(a) * 30;
    const y1 = cy + Math.sin(a) * 30;
    const x2 = cx + Math.cos(a + 0.5) * 62;
    const y2 = cy + Math.sin(a + 0.5) * 62;
    beam(ctx, x1, y1, (x1 + x2) / 2 + Math.cos(a) * 10, (y1 + y2) / 2 + Math.sin(a) * 10, SEA_DEEP, 9, 10);
    beam(ctx, (x1 + x2) / 2 + Math.cos(a) * 10, (y1 + y2) / 2 + Math.sin(a) * 10, x2, y2, SEA_DEEP, 5, 10);
    dot(ctx, x2, y2, 3, SEA, 6);
  }
  shape(ctx, () => ctx.arc(cx, cy, 38, 0, Math.PI * 2), SEA_DARK, SEA, 20);
  outline(ctx, () => ctx.arc(cx - 6, cy, 26, -1.2, 1.2), SEA_DEEP, 2, 8);
  shape(ctx, () => ctx.ellipse(cx + 16, cy - 12, 7, 9, 0, 0, Math.PI * 2), '#020a10', FOAM, 12);
  shape(ctx, () => ctx.ellipse(cx + 16, cy + 12, 7, 9, 0, 0, Math.PI * 2), '#020a10', FOAM, 12);
  dot(ctx, cx + 18, cy - 12, 2.6, FOAM, 10);
  dot(ctx, cx + 18, cy + 12, 2.6, FOAM, 10);
}

// ---------------------------------------------------------------------------------------------
// The Ruin world: the Stone Watch

/** A shade: a hooded wisp of a ghost, a trailing hem and two pale eyes. */
function shade(ctx: Ctx, cx: number, cy: number, k: number, elite: boolean) {
  if (elite) eliteRing(ctx, cx, cy, 14 * k);
  shape(ctx, () => {
    ctx.moveTo(cx + 2 * k, cy - 12 * k);
    ctx.quadraticCurveTo(cx + 11 * k, cy - 6 * k, cx + 8 * k, cy + 6 * k);
    ctx.lineTo(cx + 4 * k, cy + 11 * k);
    ctx.lineTo(cx, cy + 7 * k);
    ctx.lineTo(cx - 4 * k, cy + 12 * k);
    ctx.lineTo(cx - 8 * k, cy + 6 * k);
    ctx.quadraticCurveTo(cx - 9 * k, cy - 8 * k, cx + 2 * k, cy - 12 * k);
  }, GHOST_DARK, GHOST, 12);
  dot(ctx, cx + 1 * k, cy - 4 * k, 1.5 * k, '#f0fff6', 6);
  dot(ctx, cx + 5 * k, cy - 4 * k, 1.5 * k, '#f0fff6', 6);
}

/** A sentinel: a squat stone guardian with a carved face, a glowing rune and heavy fists. */
function sentinel(ctx: Ctx, cx: number, cy: number, k: number, elite: boolean) {
  if (elite) eliteRing(ctx, cx, cy, 21 * k);
  for (const side of [-1, 1]) shape(ctx, () => ctx.roundRect(cx + side * 13 * k - 4 * k, cy - 2 * k, 8 * k, 12 * k, 3 * k), STONE_DARK, STONE, 6);
  shape(ctx, () => poly(ctx, cx, cy, k, [[10, -15], [11, 12], [-11, 12], [-10, -15], [0, -18]]), STONE_DARK, STONE, 12);
  outline(ctx, () => {
    ctx.moveTo(cx - 6 * k, cy - 8 * k);
    ctx.lineTo(cx + 6 * k, cy - 8 * k);
    ctx.moveTo(cx - 10 * k, cy + 2 * k);
    ctx.lineTo(cx + 10 * k, cy + 2 * k);
  }, STONE, 1 * k, 3);
  dot(ctx, cx + 3 * k, cy - 11 * k, 1.8 * k, GHOST, 8);
  outline(ctx, () => poly(ctx, cx, cy + 6 * k, k, [[0, -4], [3, 0], [0, 4], [-3, 0]]), GHOST, 1.4 * k, 8);
}

/** The Stone Warden: a temple guardian of stacked blocks, a crown of broken columns and a rune eye. */
function warden(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  for (const dy of [-38, 38]) shape(ctx, () => ctx.roundRect(cx - 44, cy + dy - 11, 80, 22, 6), STONE_DARK, STONE, 10);
  shape(ctx, () => poly(ctx, cx, cy, 1, [[52, -6], [52, 6], [30, 30], [-36, 30], [-50, 12], [-50, -12], [-36, -30], [30, -30]]), STONE_DARK, STONE, 18);
  for (let i = 0; i < 3; i++) shape(ctx, () => ctx.rect(cx - 40 + i * 12, cy - 22 + i * 3, 7, 44 - i * 6), '#3a2f1c', STONE, 4);
  outline(ctx, () => {
    ctx.moveTo(cx - 4, cy - 26);
    ctx.lineTo(cx + 4, cy - 10);
    ctx.lineTo(cx - 2, cy + 6);
    ctx.lineTo(cx + 6, cy + 24);
  }, GHOST, 1.5, 8);
  shape(ctx, () => ctx.arc(cx + 30, cy, 10, 0, Math.PI * 2), GHOST_DARK, GHOST, 16);
  dot(ctx, cx + 30, cy, 4, '#f0fff6', 14);
}

/** Every texture of the Ocean and Ruin worlds: swarms and elites (with an `-elite` twin), bosses and the ink. */
export function bakeRealms(scene: Phaser.Scene) {
  const both = (key: string, size: number, draw: (ctx: Ctx, cx: number, cy: number, k: number, elite: boolean) => void) => {
    paint(scene, key, size, size, (ctx) => draw(ctx, size / 2, size / 2, 1, false));
    const big = Math.ceil(size * 1.7);
    paint(scene, `${key}-elite`, big, big, (ctx) => draw(ctx, big / 2, big / 2, 1.6, true));
  };
  both('rb-crab', 36, crab);
  both('rb-squid', 46, squid);
  both('rb-shade', 36, shade);
  both('rb-sentinel', 50, sentinel);
  paint(scene, 'rb-boss-kraken', 150, 150, (ctx) => kraken(ctx, 150, 150));
  paint(scene, 'rb-boss-warden', 150, 130, (ctx) => warden(ctx, 150, 130));
  // The squids' (and the Kraken's) ink: a dark blot with a sea-blue rim.
  paint(scene, 'rb-bolt-ink', 24, 24, (ctx) => {
    shape(ctx, () => ctx.arc(12, 12, 6, 0, Math.PI * 2), '#05121c', SEA_DEEP, 12);
    dot(ctx, 10, 10, 1.6, SEA, 3);
  });
}
