import Phaser from 'phaser';
import { viewSize } from '../../../../shared/scaling';
import { byDifficulty, settings } from '../../../../shared/settings';
import { award } from '../../../../shared/trophies';
import { ui, playMusic, playSting } from '../../../../shared/audio';
import { dailyRand, finishDaily, loadDaily, startDaily } from '../../../../shared/daily';
import { formatNumber } from '../../../../shared/i18n';
import { t, type TextKey } from '../i18n';
import { trophies } from '../trophies';
import { SFX, SONG } from '../audio';
import {
  CHAPEL_IDS,
  CHAPELS,
  FIELD_W,
  WINDOWS,
  WINDOWS_PER_CHAPEL,
  chapelOf,
  isRose,
  windowSpec,
} from '../game/levels';
import { BAD_BEADS, BAR_H, Sim, type BeadKind, type SimEvent } from '../game/sim';
import { UPGRADES, isOpen, loadProgress, saveProgress, type Progress, type UpgradeId } from '../game/save';
import { C, PANE_COLOURS, drawArch, drawBar, drawBead, drawNodeGlass, drawOrb, drawPane, drawPicture, drawQuarries, drawWall, hex } from './art';

const FONT = 'Georgia, "Times New Roman", serif';
const GAME = 'shardlight';
/** The field's top edge in the view, under the title and the arch. */
const FIELD_TOP = 58;
/** How far the picture behind the panes reaches down the field. */
const PICTURE_H = 300;
/** The bar's pace under the keyboard, in field pixels a second. */
const KEY_SPEED = 760;
/** The daily window plays like a window of this chapel. */
const DAILY_CHAPEL = 2;
/** Panes broken before the orb is back at the bar that earn the Chain trophy. */
const CHAIN = 8;
const BEADS_TROPHY = 10;

type Spot = { x: number; y: number; w: number; h: number };
interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
  angle: number;
  life: number;
  colour: number;
}

export class GameScene extends Phaser.Scene {
  private W = 960;
  private H = 540;
  screen: 'map' | 'play' = 'map';
  /** Every button on screen by id, its middle and size in view pixels; read by the playthrough. */
  buttons: Record<string, Spot> = {};
  progress: Progress = loadProgress();
  sim?: Sim;
  /** The window in play, 0 to 29, or -1 for the daily. */
  windowIndex = 0;
  /** The field's top left and size in view pixels. */
  field = { x: 0, y: FIELD_TOP, w: FIELD_W, h: 400 };
  private workshop = false;
  private gen = 0;
  private paneGfx?: Phaser.GameObjects.Graphics;
  private picture?: Phaser.GameObjects.Graphics;
  /** The window's panes to break at the start, for how bright its picture is. */
  private paneTotal = 1;
  private dynGfx?: Phaser.GameObjects.Graphics;
  private scoreText?: Phaser.GameObjects.Text;
  private comboText?: Phaser.GameObjects.Text;
  private effectsText?: Phaser.GameObjects.Text;
  private hintText?: Phaser.GameObjects.Text;
  private shards: Shard[] = [];
  private ended = false;
  private keys?: Record<'left' | 'right' | 'a' | 'd', Phaser.Input.Keyboard.Key>;

  constructor() {
    super('Game');
  }

  create() {
    ({ width: this.W, height: this.H } = viewSize(this));
    this.field = { x: Math.round((this.W - FIELD_W) / 2), y: FIELD_TOP, w: FIELD_W, h: Math.round(this.H - FIELD_TOP - 6) };
    const kb = this.input.keyboard;
    if (kb) {
      this.keys = {
        left: kb.addKey('LEFT', false),
        right: kb.addKey('RIGHT', false),
        a: kb.addKey('A', false),
        d: kb.addKey('D', false),
      };
      kb.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    }
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.screen === 'play' && this.sim && !this.ended) this.sim.moveBar(p.worldX - this.field.x);
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.screen !== 'play' || !this.sim || this.ended || over.length) return;
      this.sim.moveBar(p.worldX - this.field.x);
      this.sim.launch();
    });
    this.showMap();
  }

  // ---- what the playthrough reads ---------------------------------------------------------------

  get state() {
    const sim = this.sim;
    return {
      screen: this.screen,
      window: this.windowIndex,
      workshop: this.workshop,
      stars: this.progress.stars.slice(),
      lead: this.progress.lead,
      play: sim
        ? {
            left: sim.left,
            score: sim.score,
            lives: sim.lives,
            result: sim.result,
            barX: sim.barX,
            barY: sim.barY,
            barW: sim.barW,
            orbs: sim.orbs.map((o) => ({ x: o.x, y: o.y, vx: o.vx, vy: o.vy, held: o.held !== null })),
            /** The panes still to break, in field pixels. */
            panes: sim.panes.filter((p) => p.alive && p.kind !== 'lead').map((p) => ({ x: p.x, y: p.y, w: p.w, h: p.h })),
          }
        : null,
    };
  }

  // ---- shared pieces ---------------------------------------------------------------------------

  private clear() {
    this.gen++;
    this.tweens.killAll();
    this.time.removeAllEvents();
    for (const obj of this.children.list.slice()) obj.destroy();
    this.buttons = {};
    this.paneGfx = this.dynGfx = this.picture = undefined;
    this.scoreText = this.comboText = this.effectsText = this.hintText = undefined;
    this.shards = [];
  }

  private text(x: number, y: number, s: string, size: number, colour = C.ink, opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) {
    return this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color: hex(colour), ...opts });
  }

  private button(id: string, x: number, y: number, w: number, h: number, label: string, onTap: () => void, primary = false, depth = 50) {
    const fill = primary ? C.buttonHi : C.button;
    const box = this.add.rectangle(x, y, w, h, fill).setStrokeStyle(2, primary ? C.gold : C.arch).setDepth(depth);
    const txt = this.text(x, y, label, Math.min(18, h * 0.45), C.ink, { fontStyle: 'bold' }).setOrigin(0.5).setDepth(depth + 1);
    if (txt.width > w - 12) txt.setScale((w - 12) / txt.width);
    box.setInteractive({ useHandCursor: true });
    box.on('pointerover', () => box.setFillStyle(C.buttonHi));
    box.on('pointerout', () => box.setFillStyle(fill));
    box.on('pointerdown', () => {
      ui('click');
      onTap();
    });
    this.buttons[id] = { x, y, w, h };
    return [box, txt] as const;
  }

  private onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      if (this.workshop) this.showMap(false);
      else if (this.screen === 'play') this.leaveWindow();
      return;
    }
    if (e.key === ' ' && this.screen === 'play' && this.sim && !this.ended) {
      e.preventDefault();
      this.sim.launch();
    }
  }

  private windowTitle(index: number) {
    if (index < 0) return t('dailyName');
    const chapel = t(`chapel-${CHAPEL_IDS[chapelOf(index)]}` as TextKey);
    return isRose(index) ? t('roseName', { chapel }) : t('windowName', { chapel, n: (index % WINDOWS_PER_CHAPEL) + 1 });
  }

  // ---- the map ---------------------------------------------------------------------------------

  /** Where each window's node sits on the map: down the first chapel, up the second, and so on. */
  private nodeSpots() {
    const top = 178;
    const bottom = this.H - 92;
    const step = (bottom - top) / (WINDOWS_PER_CHAPEL - 1);
    const colW = this.W / CHAPELS;
    const spots: { x: number; y: number }[] = [];
    for (let i = 0; i < WINDOWS; i++) {
      const c = chapelOf(i);
      const j = i % WINDOWS_PER_CHAPEL;
      const row = c % 2 === 0 ? j : WINDOWS_PER_CHAPEL - 1 - j;
      spots.push({ x: colW * (c + 0.5) + (row % 2 ? 1 : -1) * colW * 0.14, y: top + row * step });
    }
    return spots;
  }

  showMap(fresh = true) {
    this.clear();
    this.screen = 'map';
    this.sim = undefined;
    this.workshop = false;
    if (fresh) playMusic(SONG, 'calm');
    const { W, H } = this;
    const g = this.add.graphics();
    // A night sky over the valley, fading to the ground.
    g.fillGradientStyle(0x141633, 0x141633, 0x2a2140, 0x2a2140, 1).fillRect(0, 0, W, H);
    g.fillStyle(0x1a1626, 1).fillRect(0, H - 50, W, 50);
    const stars = this.progress.stars;
    const colW = W / CHAPELS;
    // The chapels along the top, their windows lit once all their windows are restored.
    for (let c = 0; c < CHAPELS; c++) {
      const cx = colW * (c + 0.5);
      const done = stars.slice(c * WINDOWS_PER_CHAPEL, (c + 1) * WINDOWS_PER_CHAPEL).every((s) => s > 0);
      const wide = c === CHAPELS - 1 ? 1.4 : 1;
      g.fillStyle(0x0d0b14, 1).fillRect(cx - 34 * wide, 82, 68 * wide, 40);
      g.fillTriangle(cx - 40 * wide, 84, cx + 40 * wide, 84, cx, 56);
      g.fillRect(cx + 18 * wide, 50, 10, 34);
      g.fillTriangle(cx + 16 * wide, 52, cx + 30 * wide, 52, cx + 23 * wide, 38);
      drawNodeGlass(g, cx, 96, 11, c, done);
      this.text(cx, 128, t(`chapel-${CHAPEL_IDS[c]}` as TextKey), 14, done ? C.gold : C.dim)
        .setOrigin(0.5, 0)
        .setWordWrapWidth(colW - 8)
        .setAlign('center');
    }
    // The path from window to window.
    const spots = this.nodeSpots();
    for (let i = 1; i < WINDOWS; i++) {
      const a = spots[i - 1];
      const b = spots[i];
      const lit = stars[i - 1] > 0;
      const n = Math.max(2, Math.floor(Math.hypot(b.x - a.x, b.y - a.y) / 12));
      for (let k = 1; k < n; k++) g.fillStyle(lit ? C.gold : 0x4a4258, 1).fillCircle(a.x + ((b.x - a.x) * k) / n, a.y + ((b.y - a.y) * k) / n, 2);
    }
    const next = stars.findIndex((s, i) => s === 0 && isOpen(this.progress, i));
    spots.forEach((p, i) => {
      const open = isOpen(this.progress, i);
      const rose = isRose(i);
      const r = rose ? 25 : 19;
      if (i === next) {
        const glow = this.add.circle(p.x, p.y, r + 9, C.gold, 0.35);
        if (!settings.reduceMotion) this.tweens.add({ targets: glow, scale: 1.25, alpha: 0.1, duration: 900, yoyo: true, repeat: -1 });
      }
      g.fillStyle(C.lead, 1).fillCircle(p.x, p.y, r + 3);
      if (rose) {
        g.fillStyle(open ? C.ruby : C.locked, 1);
        for (let k = 0; k < 8; k++) g.fillCircle(p.x + Math.cos((k * Math.PI) / 4) * (r + 2), p.y + Math.sin((k * Math.PI) / 4) * (r + 2), 6);
      }
      drawNodeGlass(g, p.x, p.y, r, chapelOf(i), stars[i] > 0);
      g.lineStyle(3, stars[i] > 0 ? C.gold : open ? C.arch : 0x3a3346, 1).strokeCircle(p.x, p.y, r);
      if (stars[i] === 0) this.text(p.x, p.y, open ? String(i + 1) : '·', rose ? 18 : 15, open ? C.ink : C.dim, { fontStyle: 'bold' }).setOrigin(0.5).setShadow(0, 1, '#000', 3);
      for (let k = 0; k < 3; k++) {
        const sx = p.x + (k - 1) * 11;
        const sy = p.y + r + 9;
        g.fillStyle(k < stars[i] ? C.gold : 0x3a3346, 1);
        g.fillPoints(starPoints(sx, sy, 5, 2.2), true);
      }
      if (open) {
        const hit = this.add.circle(p.x, p.y, r + 6, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
        hit.on('pointerdown', () => {
          ui('click');
          this.startWindow(i);
        });
        this.buttons[`window-${i}`] = { x: p.x, y: p.y, w: 2 * r, h: 2 * r };
      }
    });
    // The title bar and the bottom row of buttons.
    this.text(18, 10, t('title'), 28, C.gold, { fontStyle: 'bold' }).setShadow(0, 2, '#000', 4);
    const total = stars.reduce((a, b) => a + b, 0);
    this.text(W / 2, 22, `${t('lead', { n: formatNumber(this.progress.lead) })}   ·   ${t('starsTotal', { n: total, total: WINDOWS * 3 })}`, 18, C.ink).setOrigin(0.5);
    const by = H - 26;
    this.button('workshop', W / 2 - 130, by, 220, 36, t('workshop'), () => this.showWorkshop(), false);
    const daily = loadDaily(GAME);
    this.button('daily', W / 2 + 130, by, 220, 36, t('daily'), () => this.startDaily(), !daily.played);
    const dailyNote = daily.score !== null
      ? t('dailyDone', { score: formatNumber(daily.score), best: formatNumber(daily.best), streak: daily.streak })
      : t('dailyOpen', { best: formatNumber(daily.best), streak: daily.streak });
    this.text(W / 2 + 250, by, dailyNote, 13, C.dim).setOrigin(0, 0.5).setWordWrapWidth(Math.max(80, W - (W / 2 + 260)));
  }

  private showWorkshop() {
    this.showMap(false);
    this.workshop = true;
    const { W, H } = this;
    const depth = 100;
    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(depth).setInteractive();
    const pw = Math.min(620, W - 40);
    const ph = Math.min(430, H - 40);
    const px = W / 2 - pw / 2;
    const py = H / 2 - ph / 2;
    const g = this.add.graphics().setDepth(depth);
    g.fillStyle(C.stone, 1).fillRoundedRect(px, py, pw, ph, 10);
    g.lineStyle(3, C.arch, 1).strokeRoundedRect(px, py, pw, ph, 10);
    this.text(W / 2, py + 14, t('workshop'), 26, C.gold, { fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(depth);
    this.text(W / 2, py + 48, `${t('workshopText')}  ${t('lead', { n: formatNumber(this.progress.lead) })}`, 14, C.ink, {
      align: 'center',
      wordWrap: { width: pw - 40 },
    })
      .setOrigin(0.5, 0)
      .setDepth(depth);
    const rowH = (ph - 140) / UPGRADES.length;
    UPGRADES.forEach((u, k) => {
      const y = py + 96 + k * rowH;
      const level = this.progress.upgrades[u.id];
      this.text(px + 20, y + 4, t(`upgrade-${u.id}` as TextKey), 18, C.ink, { fontStyle: 'bold' }).setDepth(depth);
      this.text(px + 20, y + 28, t(`upgrade-${u.id}Text` as TextKey), 13, C.dim, { wordWrap: { width: pw - 250 } }).setDepth(depth);
      for (let i = 0; i < u.costs.length; i++)
        g.fillStyle(i < level ? C.gold : C.locked, 1).fillCircle(px + pw - 215 + i * 14, y + rowH / 2 - 4, 5);
      const cost = u.costs[level];
      const label = cost === undefined ? t('max') : t('buy', { n: cost });
      this.button(`buy-${u.id}`, px + pw - 90, y + rowH / 2 - 4, 150, 32, label, () => this.buy(u.id), false, depth + 1);
    });
    this.button('close', W / 2, py + ph - 26, 160, 34, t('close'), () => this.showMap(false), true, depth + 1);
  }

  private buy(id: UpgradeId) {
    const u = UPGRADES.find((x) => x.id === id)!;
    const level = this.progress.upgrades[id];
    const cost = u.costs[level];
    if (cost === undefined || cost > this.progress.lead) {
      ui('refuse');
      return;
    }
    this.progress.lead -= cost;
    this.progress.upgrades[id]++;
    saveProgress(this.progress);
    ui('coin');
    this.showWorkshop();
  }

  private startDaily() {
    if (loadDaily(GAME).played) {
      ui('refuse');
      return;
    }
    startDaily(GAME);
    this.startWindow(-1);
  }

  // ---- a window in play ------------------------------------------------------------------------

  startWindow(index: number) {
    this.clear();
    this.screen = 'play';
    this.windowIndex = index;
    this.ended = false;
    const spec = index < 0 ? windowSpec(-1, dailyRand(GAME), DAILY_CHAPEL) : windowSpec(index);
    const up = this.progress.upgrades;
    this.sim = new Sim(spec, this.field.h, {
      speed: byDifficulty(320, 380, 450),
      barW: byDifficulty(132, 110, 92) + up.wide * 12,
      lives: 3 + up.orb,
      magnet: up.magnet,
      charmTime: 1 + up.charm * 0.25,
      dropChance: 0.08,
    });
    playMusic(SONG, spec.rose ? 'boss' : 'battle');
    const { W, H, field: f } = this;
    const g = this.add.graphics();
    drawWall(g, W, H);
    drawArch(g, f.x, f.y, f.w, f.h);
    const variant = index < 0 ? 7 : index % WINDOWS_PER_CHAPEL;
    // The picture behind the panes starts dim and brightens as panes break.
    this.picture = this.add.graphics();
    drawPicture(this.picture, spec.chapel, variant, f.x, f.y + 20, f.w, PICTURE_H);
    this.paneTotal = this.sim.left;
    drawQuarries(g, f.x, f.y + 20 + PICTURE_H, f.w, f.h - 20 - PICTURE_H);
    this.paneGfx = this.add.graphics();
    this.dynGfx = this.add.graphics();
    this.button('map', 52, 24, 84, 30, t('map'), () => this.leaveWindow(), false, 60);
    this.text(104, 24, this.windowTitle(index), 18, C.ink, { fontStyle: 'bold' }).setOrigin(0, 0.5).setShadow(0, 2, '#000', 4).setDepth(60);
    this.scoreText = this.text(W - 120, 24, '', 18, C.gold, { fontStyle: 'bold' }).setOrigin(1, 0.5).setShadow(0, 2, '#000', 4).setDepth(60);
    this.comboText = this.text(f.x + f.w / 2, f.y + f.h - 70, '', 20, C.gold, { fontStyle: 'bold' }).setOrigin(0.5).setShadow(0, 2, '#000', 4).setDepth(60);
    this.effectsText = this.text(f.x + f.w + 10, f.y + 10, '', 13, C.ink, { lineSpacing: 4, wordWrap: { width: Math.max(60, f.x - 16) } }).setDepth(60);
    this.hintText = this.text(f.x + f.w / 2, f.y + f.h - 110, t('launchHint'), 16, C.ink, { align: 'center', wordWrap: { width: f.w - 80 } })
      .setOrigin(0.5)
      .setShadow(0, 2, '#000', 4)
      .setDepth(60);
    this.draw();
  }

  update(_time: number, delta: number) {
    if (this.screen !== 'play' || !this.sim) return;
    const sim = this.sim;
    if (!this.ended && this.keys) {
      const dir = (this.keys.right.isDown || this.keys.d.isDown ? 1 : 0) - (this.keys.left.isDown || this.keys.a.isDown ? 1 : 0);
      if (dir) sim.moveBar(sim.barX + (dir * KEY_SPEED * delta) / 1000);
    }
    sim.step(delta);
    for (const e of sim.events) this.onEvent(e);
    sim.events = [];
    this.moveShards(delta / 1000);
    this.draw();
    if (sim.result && !this.ended) this.finish();
  }

  private onEvent(e: SimEvent) {
    const sim = this.sim!;
    switch (e.type) {
      case 'bar':
        SFX('bar');
        break;
      case 'wall':
        SFX('wall');
        break;
      case 'launch':
        SFX('launch');
        this.hintText?.setVisible(false);
        break;
      case 'crack':
        SFX('crack');
        break;
      case 'clang':
        SFX('clang');
        break;
      case 'break': {
        SFX('shatter', { pitch: 1 + Math.min(e.combo - 1, 10) * 0.06 });
        SFX('tinkle');
        this.burst(e.pane.x + e.pane.w / 2, e.pane.y + e.pane.h / 2, e.pane.kind === 'heart' ? PANE_COLOURS[4] : PANE_COLOURS[e.pane.colour % 4]);
        award(trophies, 'firstPane');
        if (e.combo >= CHAIN) award(trophies, 'chain');
        break;
      }
      case 'bead':
        SFX('drop');
        break;
      case 'catch':
        SFX(BAD_BEADS.has(e.kind) ? 'curse' : 'catch');
        this.progress.beads++;
        if (this.progress.beads >= BEADS_TROPHY) award(trophies, 'beads');
        if (sim.mostOrbs >= 3) award(trophies, 'triple');
        break;
      case 'lost':
        SFX('lost');
        if (sim.lives > 0) this.hintText?.setVisible(true);
        break;
    }
  }

  /** Flying shards of a broken pane, in field pixels. */
  private burst(x: number, y: number, colour: number) {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 60 + Math.random() * 120;
      this.shards.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, spin: (Math.random() - 0.5) * 10, angle: a, life: 0.8, colour });
    }
    if (this.shards.length > 160) this.shards.splice(0, this.shards.length - 160);
  }

  private moveShards(dt: number) {
    for (const s of this.shards) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 420 * dt;
      s.angle += s.spin * dt;
      s.life -= dt;
    }
    this.shards = this.shards.filter((s) => s.life > 0);
  }

  private draw() {
    const sim = this.sim;
    if (!sim || !this.paneGfx || !this.dynGfx) return;
    const { x: ox, y: oy } = this.field;
    this.picture?.setAlpha(sim.result === 'won' ? 1 : 0.3 + 0.55 * (1 - sim.left / this.paneTotal));
    const pg = this.paneGfx.clear();
    for (const p of sim.panes) if (p.alive) drawPane(pg, p, ox, oy);
    const g = this.dynGfx.clear();
    for (const s of this.shards) {
      g.fillStyle(s.colour, Math.min(1, s.life * 1.5));
      const c = Math.cos(s.angle) * 6;
      const d = Math.sin(s.angle) * 6;
      g.fillTriangle(ox + s.x + c, oy + s.y + d, ox + s.x - d, oy + s.y + c, ox + s.x - c * 0.6, oy + s.y - d * 0.6);
    }
    for (const b of sim.beads) drawBead(g, b.kind, ox + b.x, oy + b.y);
    drawBar(g, ox + sim.barX, oy + sim.barY, sim.barW, BAR_H, sim.sticky > 0);
    const fire = !!sim.timers.fire;
    for (const o of sim.orbs) drawOrb(g, ox + o.x, oy + o.y, fire);
    // The orbs left, down the left side of the field.
    const lx = Math.max(18, ox / 2);
    for (let i = 0; i < Math.min(sim.lives, 8); i++) drawOrb(g, lx, oy + 24 + i * 30, false);
    this.scoreText?.setText(t('score', { n: formatNumber(sim.score) }));
    this.comboText?.setText(sim.combo >= 3 ? t('combo', { n: sim.combo }) : '');
    const lines: string[] = [];
    for (const [kind, left] of Object.entries(sim.timers) as [BeadKind, number][]) lines.push(`${t(`bead-${kind}` as TextKey)} ${Math.ceil(left)}`);
    if (sim.sticky > 0) lines.push(t('stickyLeft', { n: sim.sticky }));
    this.effectsText?.setText(lines.join('\n'));
  }

  private leaveWindow() {
    // Leaving the daily uses up today's try with the score so far.
    if (this.windowIndex < 0 && this.sim && !this.ended) finishDaily(GAME, this.sim.score);
    this.showMap();
  }

  /** The window is won or lost: save, award and show the result. */
  private finish() {
    const sim = this.sim!;
    this.ended = true;
    const won = sim.result === 'won';
    const index = this.windowIndex;
    const broken = sim.panes.filter((p) => !p.alive).length;
    const lead = won ? broken + 10 + sim.stars * 5 : Math.floor(broken / 2);
    const p = this.progress;
    p.lead += lead;
    let best = sim.score;
    if (index >= 0) {
      if (won) p.stars[index] = Math.max(p.stars[index], sim.stars);
      p.best[index] = best = Math.max(p.best[index], sim.score);
    } else best = finishDaily(GAME, sim.score).best;
    saveProgress(p);
    if (won) {
      playSting(SONG, 'win');
      award(trophies, 'firstWindow');
      if (sim.stars === 3) award(trophies, 'flawless');
      if (index === WINDOWS_PER_CHAPEL - 1) award(trophies, 'firstChapel');
      if (p.stars.every((s) => s > 0)) award(trophies, 'allChapels');
      for (let c = 0; c < CHAPELS; c++)
        if (p.stars.slice(c * WINDOWS_PER_CHAPEL, (c + 1) * WINDOWS_PER_CHAPEL).every((s) => s === 3)) award(trophies, 'allStars');
      if (!settings.reduceMotion) this.cameras.main.flash(300, 255, 240, 200);
    } else playSting(SONG, 'lose');
    this.hintText?.setVisible(false);
    // The result box, after a moment to see the window light up.
    const gen = this.gen;
    this.time.delayedCall(won ? 700 : 400, () => {
      if (gen === this.gen) this.showResult(won, sim.stars, sim.score, best, lead);
    });
  }

  private showResult(won: boolean, stars: number, score: number, best: number, lead: number) {
    const { W, H } = this;
    const depth = 100;
    const bw = Math.min(440, W - 40);
    const bh = 250;
    const x = W / 2 - bw / 2;
    const y = H / 2 - bh / 2;
    const g = this.add.graphics().setDepth(depth);
    g.fillStyle(C.stone, 0.96).fillRoundedRect(x, y, bw, bh, 12);
    g.lineStyle(3, won ? C.gold : C.arch, 1).strokeRoundedRect(x, y, bw, bh, 12);
    const daily = this.windowIndex < 0;
    this.text(W / 2, y + 22, won ? t('won') : t('lost'), 28, won ? C.gold : C.ink, { fontStyle: 'bold' }).setOrigin(0.5, 0).setDepth(depth);
    if (won && !daily)
      for (let k = 0; k < 3; k++) {
        g.fillStyle(k < stars ? C.gold : 0x3a3346, 1);
        g.fillPoints(starPoints(W / 2 + (k - 1) * 40, y + 86, 16, 7), true);
      }
    const line = daily ? t('dailyResult', { score: formatNumber(score) }) : t('scoreLine', { score: formatNumber(score), best: formatNumber(best) });
    this.text(W / 2, y + 116, line, 18, C.ink).setOrigin(0.5, 0).setDepth(depth);
    this.text(W / 2, y + 144, t('leadEarned', { n: lead }), 16, C.gold).setOrigin(0.5, 0).setDepth(depth);
    const by = y + bh - 34;
    const index = this.windowIndex;
    if (daily) this.button('result-map', W / 2, by, 220, 36, t('toMap'), () => this.showMap(), true, depth + 1);
    else {
      this.button('result-map', W / 2 - 105, by, 190, 36, t('toMap'), () => this.showMap(), !won || index === WINDOWS - 1, depth + 1);
      if (!won) this.button('result-retry', W / 2 + 105, by, 190, 36, t('retry'), () => this.startWindow(index), true, depth + 1);
      else if (index < WINDOWS - 1) this.button('result-next', W / 2 + 105, by, 190, 36, t('next'), () => this.startWindow(index + 1), true, depth + 1);
    }
  }
}

/** A five-pointed star's corners round (x, y). */
function starPoints(x: number, y: number, outer: number, inner: number) {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? inner : outer;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * r, y + Math.sin(a) * r));
  }
  return pts;
}
