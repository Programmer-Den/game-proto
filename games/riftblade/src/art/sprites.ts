/**
 * Every texture of the game, painted once at boot: the heroes (a game-sized sprite per colour
 * scheme and a big portrait each; the knights are drawn in `knights.ts`, Elara Voss and Triad-77 in
 * `squad.ts`), the soldiers' allies, the
 * Scrap bots and the Grinder Crawler, bolts, shards and pickups. Heroes take their colours from
 * their scheme (`schemeOf`), so a new scheme needs no art.
 */
import Phaser from 'phaser';
import { BOOT_HEROES, HEROES, HERO_IDS, isCrew, isKnight, isLate, schemeOf, type HeroId, type HeroScheme } from '../game/heroes';
import { C, beam, glow, outline, paint, shade, shape, type Ctx } from './glow';
import { bakeLateKnight, drawKnight } from './knights';
import { bot, drawSquadHero, rebel } from './squad';
import { bakeCrewAllies, drawCrewHero } from './crew';
import { MASTERY_COLOURS } from '../game/mastery';

/** How big a hero is drawn in play (their art is laid out at 1 for the portraits). */
export const HERO_SCALE = 0.46;
/** The hero art's box around its centre, in art units: left, top, width, height. */
const HERO_BOX = { x: -66, y: -52, w: 132, h: 120 };
/** The portrait's box (the guns' bolts included). */
const PORTRAIT_BOX = { x: -104, y: -56, w: 208, h: 128 };

/** A soldier helmet in the armour's colour: a dome with a dark T visor and a stripe on top. */
function helmet(ctx: Ctx, x: number, y: number, sch: HeroScheme, z: number) {
  shape(ctx, () => {
    ctx.arc(x, y, 20, Math.PI, 0);
    ctx.lineTo(x + 20, y + 14);
    ctx.lineTo(x - 20, y + 14);
    ctx.closePath();
  }, sch.body, sch.accent, 10, z);
  ctx.fillStyle = C.ink;
  ctx.fillRect(x - 13, y - 2, 26, 6);
  ctx.fillRect(x - 3, y + 2, 6, 12);
  ctx.fillStyle = sch.mark ?? sch.accent;
  ctx.fillRect(x - 3, y - 20, 6, 14);
}

function gun(ctx: Ctx, x: number, y: number, w: number) {
  ctx.fillStyle = '#2c3140';
  ctx.fillRect(x, y - 3, w, 6);
  ctx.fillRect(x, y, 6, 9);
  ctx.fillStyle = '#4a5266';
  ctx.fillRect(x, y - 3, w, 2);
}

function torso(ctx: Ctx, x: number, y: number, sch: HeroScheme, z: number) {
  shape(ctx, () => ctx.roundRect(x - 23, y + 10, 46, 52, 10), sch.body, sch.accent, 10, z);
}

/** Draws a hero at (x, y) in art units, facing right; `bolts` adds their shots, for portraits. */
export function drawHero(ctx: Ctx, id: HeroId, x: number, y: number, z: number, bolts: boolean, sch = schemeOf(id)) {
  if (isKnight(id)) {
    drawKnight(ctx, id, x, y, z, bolts, sch);
    return;
  }
  if (id === 'elara' || id === 'triad') {
    drawSquadHero(ctx, id, x, y, z, bolts, sch);
    return;
  }
  if (isCrew(id)) {
    drawCrewHero(ctx, id, x, y, z, bolts, sch);
    return;
  }
  const mark = sch.mark ?? shade(sch.accent, -0.15);
  if (id === 'rook') {
    torso(ctx, x, y, sch, z);
    ctx.fillStyle = mark;
    ctx.fillRect(x - 23, y + 14, 46, 7);
    ctx.fillRect(x - 4, y + 21, 8, 38);
    shape(ctx, () => ctx.roundRect(x - 34, y + 8, 18, 14, 5), mark, sch.accent, 4, z);
    helmet(ctx, x, y - 14, sch, z);
    gun(ctx, x - 52, y + 34, 22);
    gun(ctx, x + 30, y + 34, 22);
    if (bolts) {
      beam(ctx, x - 58, y + 34, x - 80, y + 34, sch.bolt, 4, 22, z);
      beam(ctx, x + 58, y + 34, x + 80, y + 34, sch.bolt, 4, 22, z);
    }
  } else if (id === 'tr9') {
    torso(ctx, x, y, sch, z);
    ctx.fillStyle = shade(sch.body, -0.4);
    ctx.fillRect(x - 23, y + 30, 46, 6);
    shape(ctx, () => ctx.roundRect(x - 20, y - 34, 40, 40, 14), sch.body, sch.accent, 10, z);
    ctx.save();
    glow(ctx, sch.accent, 10, z);
    ctx.fillStyle = sch.accent;
    ctx.beginPath();
    ctx.ellipse(x - 9, y - 18, 7, 5, -0.4, 0, Math.PI * 2);
    ctx.ellipse(x + 9, y - 18, 7, 5, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = C.ink;
    ctx.fillRect(x - 6, y - 8, 12, 4);
    gun(ctx, x + 18, y + 24, 44);
    if (bolts) for (const a of [-0.35, 0, 0.35]) beam(ctx, x + 70, y + 24, x + 70 + Math.cos(a) * 22, y + 24 + Math.sin(a) * 22, sch.bolt, 4, 22, z);
  } else {
    torso(ctx, x, y, sch, z);
    ctx.fillStyle = sch.accent;
    ctx.fillRect(x - 23, y + 40, 46, 6);
    ctx.fillRect(x + 8, y + 10, 7, 30);
    helmet(ctx, x, y - 14, sch, z);
    ctx.save();
    glow(ctx, sch.accent, 6, z);
    ctx.fillStyle = sch.accent;
    ctx.beginPath();
    ctx.arc(x - 30, y + 44, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    gun(ctx, x + 16, y + 30, 40);
    if (bolts) beam(ctx, x + 62, y + 30, x + 92, y + 30, sch.bolt, 4, 22, z);
  }
}

/** The texture key of a hero's in-play sprite (in scheme `variant`) and portrait. */
export const heroKey = (id: HeroId, variant = 0) => (variant ? `rb-hero-${id}-${variant}` : `rb-hero-${id}`);
export const portraitKey = (id: HeroId) => `rb-portrait-${id}`;

/** The texture keys of a hero (and Triad-77's bots) in its mastery colours, and its portrait. */
export const masteryKey = (id: HeroId) => `rb-hero-${id}-mastery`;
export const masteryPortraitKey = (id: HeroId) => `rb-portrait-${id}-mastery`;
export const MASTERY_BOT = 'rb-bot-mastery';

/** A hero's mastery colours as a scheme (its bolts keep their colour). */
export const masteryScheme = (id: HeroId): HeroScheme => ({ name: 'Mastery', ...MASTERY_COLOURS[id], bolt: schemeOf(id).bolt });

/**
 * Paints a hero in its mastery colours, the first time they are shown (not at boot: Phaser draws
 * on Math.random for every texture's id, and a fresh save's seeded first minute must stay as it was).
 */
export function bakeMastery(scene: Phaser.Scene, id: HeroId) {
  bakeLate(scene, id);
  if (scene.textures.exists(masteryKey(id))) return;
  const sch = masteryScheme(id);
  bakeHero(scene, masteryKey(id), id, HERO_SCALE, HERO_BOX, false, sch);
  bakeHero(scene, masteryPortraitKey(id), id, 1, PORTRAIT_BOX, true, sch);
  if (id === 'triad') {
    paint(scene, MASTERY_BOT, 34, 40, (ctx) => {
      ctx.scale(0.5, 0.5);
      bot(ctx, 30, 44, 0.5, sch);
    });
  }
}

/**
 * Paints a hero added after the first twelve (its sprites, portrait, bolt and allies), the first
 * time it is shown or played. Not at boot: every texture Phaser makes draws on Math.random for its
 * id, and a fresh save's seeded first minute must stay as it was. Call it before using any of
 * their keys; it does nothing for the first twelve, painted by `bakeSprites`, or once done.
 */
export function bakeLate(scene: Phaser.Scene, id: HeroId) {
  if (!isLate(id) || scene.textures.exists(portraitKey(id))) return;
  HEROES[id].schemes.forEach((sch, v) => bakeHero(scene, heroKey(id, v), id, HERO_SCALE, HERO_BOX, false, sch));
  boltTexture(scene, `rb-bolt-${id}`, schemeOf(id).bolt, 18, 4);
  if (isCrew(id)) bakeCrewAllies(scene, id, schemeOf(id));
  if (isKnight(id)) bakeLateKnight(scene, id);
  // The portrait last: its key is what says the hero is painted.
  bakeHero(scene, portraitKey(id), id, 1, PORTRAIT_BOX, true);
}

/** A hero's portrait key, painting the hero first if it is one of the later ones. */
export function portraitOf(scene: Phaser.Scene, id: HeroId) {
  bakeLate(scene, id);
  return portraitKey(id);
}

/** A bolt texture, pointing right; each is rotated to its heading. */
function boltTexture(scene: Phaser.Scene, key: string, color: string, len: number, w: number) {
  paint(scene, key, len + 16, w + 14, (ctx) => beam(ctx, 8, (w + 14) / 2, len + 8, (w + 14) / 2, color, w, 10));
}

function bakeHero(scene: Phaser.Scene, key: string, id: HeroId, scale: number, box: typeof HERO_BOX, bolts: boolean, sch = schemeOf(id)) {
  paint(scene, key, box.w * scale, box.h * scale, (ctx) => {
    ctx.scale(scale, scale);
    drawHero(ctx, id, -box.x, -box.y, scale, bolts, sch);
  });
}

/** A Clanker: a round scrap bot with a glowing visor bar and little feet. */
function clanker(ctx: Ctx, cx: number, cy: number, r: number, rim: string, elite: boolean) {
  if (elite) outline(ctx, () => ctx.arc(cx, cy, r + 4, 0, Math.PI * 2), C.elite, 2.5, 14);
  shape(ctx, () => ctx.arc(cx, cy, r, 0, Math.PI * 2), '#1a1220', rim, 9);
  ctx.save();
  glow(ctx, rim, 6);
  ctx.strokeStyle = rim;
  ctx.lineWidth = Math.max(2, r * 0.2);
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, cy - r * 0.05);
  ctx.lineTo(cx + r * 0.5, cy - r * 0.05);
  ctx.stroke();
  ctx.lineWidth = Math.max(1.2, r * 0.1);
  for (const dx of [-0.45, 0.45]) {
    ctx.beginPath();
    ctx.moveTo(cx + dx * r, cy + r * 0.85);
    ctx.lineTo(cx + dx * r * 1.15, cy + r * 1.25);
    ctx.stroke();
  }
  ctx.restore();
}

/** A Rollerbomb: a spiked ball with a fuse light; `armed` glows hot before its rush. */
function rollerbomb(ctx: Ctx, cx: number, cy: number, r: number, armed: boolean, elite: boolean) {
  if (elite) outline(ctx, () => ctx.arc(cx, cy, r + 5, 0, Math.PI * 2), C.elite, 2.5, 14);
  const rim = armed ? '#ffd36b' : C.roller;
  ctx.save();
  glow(ctx, rim, 6);
  ctx.strokeStyle = rim;
  ctx.lineWidth = 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.lineTo(cx + Math.cos(a) * (r + 4), cy + Math.sin(a) * (r + 4));
    ctx.stroke();
  }
  ctx.restore();
  shape(ctx, () => ctx.arc(cx, cy, r, 0, Math.PI * 2), armed ? '#5a2a10' : '#22160e', rim, armed ? 16 : 8);
  ctx.save();
  glow(ctx, rim, 10);
  ctx.fillStyle = armed ? '#fff1c0' : rim;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The Grinder Crawler: a giant tread tank with grinding saws in front, facing right. */
function grinder(ctx: Ctx, w: number, h: number) {
  const cx = w / 2;
  const cy = h / 2;
  const rim = C.boss;
  // Treads.
  for (const ty of [cy - 46, cy + 30]) {
    shape(ctx, () => ctx.roundRect(cx - 62, ty, 116, 16, 8), '#1c1410', rim, 10);
    ctx.save();
    ctx.strokeStyle = shade(rim, -0.35);
    ctx.lineWidth = 2;
    for (let x = cx - 54; x < cx + 50; x += 10) {
      ctx.beginPath();
      ctx.moveTo(x, ty + 2);
      ctx.lineTo(x, ty + 14);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Hull.
  shape(ctx, () => ctx.roundRect(cx - 52, cy - 32, 98, 64, 14), '#2a1a12', rim, 16);
  ctx.save();
  ctx.strokeStyle = shade(rim, -0.25);
  ctx.lineWidth = 2;
  ctx.strokeRect(cx - 40, cy - 20, 30, 40);
  ctx.restore();
  // The grinding saws.
  for (const sy of [cy - 22, cy + 22]) {
    outline(ctx, () => ctx.arc(cx + 56, sy, 15, 0, Math.PI * 2), '#ffd36b', 2.5, 12);
    ctx.save();
    glow(ctx, '#ffd36b', 6);
    ctx.fillStyle = '#ffd36b';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + 56 + Math.cos(a) * 15, sy + Math.sin(a) * 15);
      ctx.lineTo(cx + 56 + Math.cos(a + 0.25) * 21, sy + Math.sin(a + 0.25) * 21);
      ctx.lineTo(cx + 56 + Math.cos(a + 0.45) * 15, sy + Math.sin(a + 0.45) * 15);
      ctx.fill();
    }
    ctx.restore();
  }
  // Turret and its cannon.
  shape(ctx, () => ctx.arc(cx - 4, cy, 18, 0, Math.PI * 2), '#3a2416', rim, 12);
  shape(ctx, () => ctx.roundRect(cx + 8, cy - 5, 34, 10, 3), '#3a2416', rim, 8);
  ctx.save();
  glow(ctx, '#ff5a3c', 12);
  ctx.fillStyle = '#ff9a5a';
  ctx.beginPath();
  ctx.arc(cx - 4, cy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function diamond(ctx: Ctx, cx: number, cy: number, w: number, h: number, color: string) {
  ctx.save();
  glow(ctx, color, 10);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2);
  ctx.lineTo(cx + w / 2, cy);
  ctx.lineTo(cx, cy + h / 2);
  ctx.lineTo(cx - w / 2, cy);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - h / 2 + 2);
  ctx.lineTo(cx + w / 4, cy);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Bolt colours by look, besides each hero's own. */
export const BOLT_COLOR = { drone: '#7df9ff', rocket: '#ffd36b', shell: '#c77dff' } as const;

export function bakeSprites(scene: Phaser.Scene) {
  // The first twelve heroes; the later ones are painted when first shown (`bakeLate`).
  for (const id of HERO_IDS.slice(0, BOOT_HEROES)) {
    HEROES[id].schemes.forEach((sch, v) => bakeHero(scene, heroKey(id, v), id, HERO_SCALE, HERO_BOX, false, sch));
    bakeHero(scene, portraitKey(id), id, 1, PORTRAIT_BOX, true);
  }
  // Allies: Rook's troopers are smaller copies of him; Bram's brothers are identical to him.
  bakeHero(scene, 'rb-trooper', 'rook', 0.34, HERO_BOX, false);
  bakeHero(scene, 'rb-brother', 'bram', 0.42, HERO_BOX, false);
  // TR-9's Drop Squad troopers are smaller copies of him; Elara's commandos and medic are rebels.
  bakeHero(scene, 'rb-legionary', 'tr9', 0.32, HERO_BOX, false);
  for (const [key, medic] of [['rb-commando', false], ['rb-medic', true]] as const) {
    paint(scene, key, HERO_BOX.w * 0.34, HERO_BOX.h * 0.34, (ctx) => {
      ctx.scale(0.34, 0.34);
      rebel(ctx, -HERO_BOX.x, -HERO_BOX.y, 0.34, medic);
    });
  }

  paint(scene, 'rb-clanker', 36, 36, (ctx) => clanker(ctx, 18, 17, 11, C.clanker, false));
  paint(scene, 'rb-clanker-elite', 56, 56, (ctx) => clanker(ctx, 28, 27, 17.6, C.clanker, true));
  paint(scene, 'rb-roller', 40, 40, (ctx) => rollerbomb(ctx, 20, 20, 12, false, false));
  paint(scene, 'rb-roller-armed', 40, 40, (ctx) => rollerbomb(ctx, 20, 20, 12, true, false));
  paint(scene, 'rb-roller-elite', 64, 64, (ctx) => rollerbomb(ctx, 32, 32, 19, false, true));
  paint(scene, 'rb-roller-elite-armed', 64, 64, (ctx) => rollerbomb(ctx, 32, 32, 19, true, true));
  paint(scene, 'rb-boss', 170, 150, (ctx) => grinder(ctx, 170, 150));

  // Bolts point right; each is rotated to its heading.
  const boltTex = (key: string, color: string, len: number, w: number) => boltTexture(scene, key, color, len, w);
  for (const id of HERO_IDS.slice(0, BOOT_HEROES)) boltTex(`rb-bolt-${id}`, schemeOf(id).bolt, 18, 4);
  boltTex('rb-bolt-drone', BOLT_COLOR.drone, 14, 3.5);
  boltTex('rb-bolt-heavy', schemeOf('bram').bolt, 28, 7);
  paint(scene, 'rb-bolt-rocket', 30, 18, (ctx) => {
    beam(ctx, 4, 9, 14, 9, '#ff7a2e', 3, 8);
    shape(ctx, () => ctx.roundRect(13, 6, 13, 6, 3), '#d9dde6', BOLT_COLOR.rocket, 6);
  });
  paint(scene, 'rb-bolt-shell', 24, 24, (ctx) => {
    shape(ctx, () => ctx.arc(12, 12, 6, 0, Math.PI * 2), '#3a0f22', BOLT_COLOR.shell, 12);
    ctx.fillStyle = BOLT_COLOR.shell;
    ctx.beginPath();
    ctx.arc(12, 12, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  paint(scene, 'rb-shard', 18, 20, (ctx) => diamond(ctx, 9, 10, 8, 11, C.shard));
  paint(scene, 'rb-shard-big', 28, 32, (ctx) => diamond(ctx, 14, 16, 14, 19, '#b4fff0'));
  // A medkit: a dark case with a green cross (never red).
  paint(scene, 'rb-medkit', 30, 30, (ctx) => {
    shape(ctx, () => ctx.roundRect(5, 7, 20, 16, 4), '#10261a', C.heal, 10);
    ctx.save();
    glow(ctx, C.heal, 6);
    ctx.fillStyle = C.heal;
    ctx.fillRect(13, 10, 4, 10);
    ctx.fillRect(10, 13, 10, 4);
    ctx.restore();
  });
  paint(scene, 'rb-chest', 36, 32, (ctx) => {
    shape(ctx, () => ctx.roundRect(6, 9, 24, 17, 3), '#2a2210', C.elite, 14);
    ctx.save();
    glow(ctx, C.elite, 6);
    ctx.strokeStyle = C.elite;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(6, 15);
    ctx.lineTo(30, 15);
    ctx.stroke();
    ctx.fillStyle = C.elite;
    ctx.fillRect(16, 13, 4, 6);
    ctx.restore();
  });
  paint(scene, 'rb-drone', 26, 26, (ctx) => {
    shape(ctx, () => ctx.arc(13, 13, 6, 0, Math.PI * 2), '#132a33', BOLT_COLOR.drone, 10);
    outline(ctx, () => ctx.ellipse(13, 13, 11, 4, 0, 0, Math.PI * 2), BOLT_COLOR.drone, 1.5, 6);
  });
  paint(scene, 'rb-charge', 24, 24, (ctx) => {
    shape(ctx, () => ctx.roundRect(5, 7, 14, 10, 3), '#2a1a10', C.roller, 10);
    ctx.fillStyle = '#ffd36b';
    ctx.fillRect(10, 10, 4, 4);
  });
  paint(scene, 'rb-grenade', 20, 20, (ctx) => {
    shape(ctx, () => ctx.arc(10, 10, 5, 0, Math.PI * 2), '#2a2410', '#ffd36b', 10);
  });
  paint(scene, 'rb-crate', 34, 34, (ctx) => {
    shape(ctx, () => ctx.roundRect(6, 6, 22, 22, 3), '#14261c', C.heal, 12);
    ctx.save();
    ctx.strokeStyle = C.heal;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(6, 6);
    ctx.lineTo(28, 28);
    ctx.moveTo(28, 6);
    ctx.lineTo(6, 28);
    ctx.stroke();
    ctx.restore();
  });
  // The soft shadow under the hero.
  paint(scene, 'rb-shadow', 40, 14, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(20, 7, 17, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}
