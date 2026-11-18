import Phaser from 'phaser';
import { ACTION_BUTTONS, DARE_TAG, HUD_HEIGHT, STREAK_CHIP, TAG, TRACK, VIEW } from '../scenes/layout';
import { t } from '../i18n';
import { C, gold, paint, poly, SERIF } from './ink';

// The page furniture round the miniature: the lapis rubric band of the HUD ruled in gold, the
// illuminated initial for the stage's name, the vellum chip of the coin streak and the vellum strip
// of the run track, plus the vellum panels and lapis buttons of the overlays.

export function bakeHud(scene: Phaser.Scene) {
  paint(scene, 'hud-band', VIEW.w, HUD_HEIGHT, (ctx) => {
    ctx.fillStyle = C.lapisDeep;
    ctx.fillRect(0, 0, VIEW.w, HUD_HEIGHT);
    ctx.fillStyle = 'rgba(232,194,90,0.12)';
    for (let x = 0; x < VIEW.w; x += 12) {
      for (let y = 6, row = 0; y < HUD_HEIGHT - 4; y += 12, row++) {
        ctx.beginPath();
        ctx.arc(x + (row % 2 ? 6 : 0), y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = gold(ctx, 0, HUD_HEIGHT - 4, 0, HUD_HEIGHT);
    ctx.fillRect(0, HUD_HEIGHT - 4, VIEW.w, 4);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, HUD_HEIGHT - 4);
    ctx.lineTo(VIEW.w, HUD_HEIGHT - 4);
    ctx.moveTo(0, HUD_HEIGHT - 0.5);
    ctx.lineTo(VIEW.w, HUD_HEIGHT - 0.5);
    ctx.stroke();
  });

  // The illuminated first letter of "Stage" (`stageInitial`, E for "Etappe" in German): a gold square, a madder field with gold penwork, a vellum letter.
  paint(scene, 'initial', 32, 32, (ctx) => {
    ctx.fillStyle = gold(ctx, 0, 0, 32, 32);
    ctx.fillRect(1, 1, 30, 30);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1.25;
    ctx.strokeRect(1, 1, 30, 30);
    ctx.fillStyle = C.madder;
    ctx.fillRect(4, 4, 24, 24);
    ctx.strokeRect(4, 4, 24, 24);
    ctx.strokeStyle = C.goldDot;
    ctx.lineWidth = 0.8;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(16, 16, 4 + k * 3, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(16, 16, 4 + k * 3, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
    }
    ctx.font = `700 22px ${SERIF}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.ink;
    ctx.strokeText(t('stageInitial'), 16, 17.5);
    ctx.fillStyle = C.goldPale;
    ctx.fillText(t('stageInitial'), 16, 17.5);
  });

  const { w, h } = STREAK_CHIP;
  paint(scene, 'streak-chip', w, h, (ctx) => {
    poly(ctx, [[0.75, 0.75], [w - 0.75, 0.75], [w - 0.75, h - 0.75], [0.75, h - 0.75]], C.vellumLight, 1.25);
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 1;
    ctx.strokeRect(2.5, 2.5, w - 5, h - 5);
  });
  paint(scene, 'medallion', 18, 18, (ctx) => {
    ctx.beginPath();
    ctx.arc(9, 9, 8, 0, Math.PI * 2);
    ctx.fillStyle = gold(ctx, 1, 1, 17, 17);
    ctx.fill();
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  const tw = TRACK.right - TRACK.left;
  paint(scene, 'track-strip', tw, TRACK.h, (ctx) => {
    poly(ctx, [[0.75, 0.75], [tw - 0.75, 0.75], [tw - 0.75, TRACK.h - 0.75], [0.75, TRACK.h - 0.75]], C.vellumLight, 1.25);
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 0.8;
    ctx.strokeRect(3, 3, tw - 6, TRACK.h - 6);
  });
  // The stage's tag beside the track: the ground's name, or the Gatekeeper and its stomps left.
  for (const [key, { w: sw, h: sh }] of [['tag-strip', TAG], ['dare-strip', DARE_TAG]] as const) {
    paint(scene, key, sw, sh, (ctx) => {
      poly(ctx, [[0.75, 0.75], [sw - 0.75, 0.75], [sw - 0.75, sh - 0.75], [0.75, sh - 0.75]], C.vellumLight, 1.25);
      ctx.strokeStyle = C.gold;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(3, 3, sw - 6, sh - 6);
    });
  }
  bakeActionButtons(scene);
}

/**
 * A vellum panel with an ink border and a gold rule inside it, with gold corner dots: the boon cards
 * and the game-over panel.
 */
export function bakePanel(scene: Phaser.Scene, key: string, w: number, h: number, edge = C.ink) {
  paint(scene, key, w, h, (ctx) => {
    ctx.fillStyle = C.vellum;
    ctx.fillRect(2, 2, w - 4, h - 4);
    const rnd = (x: number, y: number, r: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(170,120,60,0.07)');
      g.addColorStop(1, 'rgba(170,120,60,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    rnd(w * 0.3, h * 0.4, w * 0.4);
    rnd(w * 0.8, h * 0.7, w * 0.3);
    ctx.strokeStyle = edge;
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, w - 4, h - 4);
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 2;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.strokeStyle = C.ink;
    ctx.lineWidth = 0.75;
    ctx.strokeRect(11, 11, w - 22, h - 22);
    for (const [x, y] of [[8, 8], [w - 8, 8], [8, h - 8], [w - 8, h - 8]]) {
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fillStyle = gold(ctx, x - 4, y - 4, x + 4, y + 4);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });
}

/** A lapis button with a gold border, `w` x `h`, and a madder one for when it is hovered. */
export function bakeButton(scene: Phaser.Scene, key: string, w: number, h: number) {
  for (const [suffix, fill] of [['', C.lapis], ['-over', C.madder]] as const) {
    paint(scene, key + suffix, w, h, (ctx) => {
      ctx.fillStyle = C.ink;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = gold(ctx, 0, 0, w, h);
      ctx.fillRect(1.5, 1.5, w - 3, h - 3);
      ctx.fillStyle = fill;
      ctx.fillRect(4.5, 4.5, w - 9, h - 9);
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 1;
      ctx.strokeRect(4.5, 4.5, w - 9, h - 9);
      ctx.strokeStyle = 'rgba(255,250,235,0.5)';
      ctx.beginPath();
      ctx.moveTo(8, h - 8);
      ctx.lineTo(8, 8);
      ctx.lineTo(w - 8, 8);
      ctx.stroke();
    });
  }
}

/**
 * The round Slide and Jump buttons: a lapis disc ringed in gold (madder while held) with a vellum
 * arrow, up for the jump and down then forward for the slide. Their captions are texts on top.
 */
export function bakeActionButtons(scene: Phaser.Scene) {
  const r = ACTION_BUTTONS.r;
  const size = r * 2 + 4;
  const c = size / 2;
  for (const kind of ['jump', 'slide', 'dash'] as const) {
    for (const [suffix, fill] of [['', C.lapis], ['-down', C.madder]] as const) {
      paint(scene, `action-${kind}${suffix}`, size, size, (ctx) => {
        ctx.fillStyle = C.ink;
        ctx.beginPath();
        ctx.arc(c, c, r + 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = gold(ctx, c - r, c - r, c + r, c + r);
        ctx.beginPath();
        ctx.arc(c, c, r - 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = fill;
        ctx.beginPath();
        ctx.arc(c, c, r - 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = C.ink;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,250,235,0.45)';
        ctx.beginPath();
        ctx.arc(c, c, r - 8, Math.PI * 0.95, Math.PI * 1.55);
        ctx.stroke();
        // The arrow, in the disc's upper part; the caption sits under it.
        ctx.strokeStyle = C.goldPale;
        ctx.lineWidth = 5;
        if (kind === 'jump') {
          ctx.beginPath();
          ctx.moveTo(c, c + 6);
          ctx.lineTo(c, c - 16);
          ctx.stroke();
          poly(ctx, [[c - 12, c - 12], [c, c - 26], [c + 12, c - 12]], C.goldPale, 0);
        } else if (kind === 'dash') {
          // A shield charging forward, with speed lines behind it.
          ctx.lineWidth = 3;
          for (const dy of [-18, -10, -2]) {
            ctx.beginPath();
            ctx.moveTo(c - 22, c + dy);
            ctx.lineTo(c - 10, c + dy);
            ctx.stroke();
          }
          poly(ctx, [[c - 4, c - 24], [c + 16, c - 24], [c + 16, c - 10], [c + 6, c + 4], [c - 4, c - 10]], C.goldPale, 0);
        } else {
          ctx.beginPath();
          ctx.moveTo(c - 14, c - 22);
          ctx.lineTo(c - 14, c - 2);
          ctx.lineTo(c + 6, c - 2);
          ctx.stroke();
          poly(ctx, [[c + 4, c - 12], [c + 18, c - 2], [c + 4, c + 8]], C.goldPale, 0);
        }
      });
    }
  }
}
