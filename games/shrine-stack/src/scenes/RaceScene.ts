import Phaser from 'phaser';
import { t } from '../i18n';
import { seeded } from '../../../../shared/daily';
import { playMusic, playSting, ui } from '../../../../shared/audio';
import { viewSize } from '../../../../shared/scaling';
import { bellPitch, sfx, SONG } from '../audio';
import { makeButton } from '../ui/Button';
import { drop, goalOf, newGame, PLINTH_W, stackHeight, STONE_H, STONES_PER_TIER, tick, TOWER_X, type GameEvent, type GameState } from '../game/state';
import { drawStone, textStyle, type UiPart } from './GameScene';
import { FONT, PLINTH_Y, UI_DEPTH } from './layout';

/** The longest step of game time one frame may take, as in `GameScene`. */
const MAX_STEP_MS = 100;
/** How big each temple is drawn, so its whole swing fits in half the 960-wide view. */
const SCALE = 0.62;
/** Where the plinth's top starts on screen, above the bottom edge, and the highest the temple's top climbs before its half scrolls. */
const GROUND_UP = 64;
const TOP_Y = 190;
const CAMERA_MS = 180;
/** How long the winning temple shows before the end panel. */
const END_MS = 1400;
const END_PANEL = { w: 520, h: 260 };
const OUTLINE = 0x2a2036;
const GOLD = 0xf3c64e;

/** One temple of the race: its rules, its half of the view and what is drawn in it. */
interface Side {
  state: GameState;
  /** The middle of its half of the view. */
  cx: number;
  /** Everything in the temple's world, scaled and scrolled together. */
  world: Phaser.GameObjects.Container;
  stones: Phaser.GameObjects.Graphics[];
  moving: Phaser.GameObjects.Graphics;
  movingKey: string;
  guide: Phaser.GameObjects.Graphics;
  tierText: Phaser.GameObjects.Text;
  /** How far the world has scrolled down to keep the temple's top in view, in screen pixels. */
  scroll: number;
}

/**
 * The two-player race (SS16): two temples side by side on one screen, each with its own half to tap (or
 * A and L). Both start at once with the same stones, no patron and no breaks between tiers; the first to
 * crown the hill's shrine wins, and so does the one still standing when the other misses.
 */
export class RaceScene extends Phaser.Scene {
  /** The left and the right temple's states; read by tests. */
  sides: Side[] = [];
  /** The winner (0 left, 1 right), -1 for a draw, or null while racing. */
  winner: number | null = null;
  private endedMs = 0;
  private lastFrame: number | null = null;
  private vw = 960;
  private vh = 540;
  private endParts: UiPart[] = [];
  private endTitle!: Phaser.GameObjects.Text;
  private endText!: Phaser.GameObjects.Text;
  private endShown = false;

  constructor() {
    super('Race');
  }

  /** The two temples' states, for tests. */
  get states() {
    return this.sides.map((side) => side.state);
  }

  create() {
    ({ width: this.vw, height: this.vh } = viewSize(this));
    this.sides = [];
    this.winner = null;
    this.endedMs = 0;
    this.lastFrame = null;
    this.endShown = false;
    this.createSky();
    // Both temples draw from the same seed, so both get the same stones and trials.
    const seed = Math.floor(Math.random() * 2 ** 31) || 1;
    for (const i of [0, 1]) this.sides.push(this.createSide(i, seed));
    this.add.rectangle(this.vw / 2, this.vh / 2, 4, this.vh, 0x14101f).setDepth(UI_DEPTH - 2);

    // Phaser has one touch pointer by default, which would drop the second player's tap while the
    // first player's finger is down.
    if (this.input.manager.pointersTotal < 2) this.input.addPointer(1);
    for (const i of [0, 1]) {
      this.add
        .zone((i * this.vw) / 2, 0, this.vw / 2, this.vh)
        .setOrigin(0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.dropSide(i));
    }
    // A held key's auto-repeat must not drop the next stone the moment it swings in.
    this.input.keyboard?.on('keydown-A', (e: KeyboardEvent) => !e.repeat && this.dropSide(0));
    this.input.keyboard?.on('keydown-L', (e: KeyboardEvent) => !e.repeat && this.dropSide(1));
    const onResume = () => (this.lastFrame = null);
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.events.on(Phaser.Scenes.Events.WAKE, onResume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, onResume);
      this.events.off(Phaser.Scenes.Events.WAKE, onResume);
    });

    const goal = goalOf(this.sides[0].state);
    const go = this.add
      .text(this.vw / 2, this.vh / 2 - 40, t('raceGo', { goal }), { ...textStyle(18, '#f3c64e'), align: 'center', wordWrap: { width: this.vw - 120 } })
      .setOrigin(0.5)
      .setDepth(UI_DEPTH + 5);
    this.tweens.add({ targets: go, alpha: 0, delay: 1600, duration: 900, onComplete: () => go.destroy() });
    this.createEnd();
    playMusic(SONG, 'calm');
  }

  update(time: number) {
    const dt = this.lastFrame === null ? 0 : Phaser.Math.Clamp(time - this.lastFrame, 0, MAX_STEP_MS);
    this.lastFrame = time;
    // Once the race is decided both temples stand still.
    if (this.winner === null) for (const side of this.sides) tick(side.state, dt);
    else this.endedMs += dt;
    for (const side of this.sides) {
      for (const e of side.state.events.splice(0)) this.show(side, e);
      this.follow(side, dt);
      this.drawMoving(side);
      const s = side.state;
      side.tierText.setText(t('raceTier', { tier: Math.min(s.tiersBuilt, goalOf(s)), goal: goalOf(s) }));
    }
    if (this.winner === null) this.judge();
    if (this.winner !== null && this.endedMs >= END_MS && !this.endShown) this.showEnd();
  }

  /** The dusk sky over both halves. */
  private createSky() {
    const sky = this.add.graphics().setDepth(-10);
    const top = Phaser.Display.Color.IntegerToColor(0x1d1838);
    const low = Phaser.Display.Color.IntegerToColor(0xd88a5a);
    const bands = 27;
    for (let i = 0; i < bands; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, low, bands - 1, Math.pow(i / (bands - 1), 1.6) * (bands - 1));
      sky.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b)).fillRect(0, (i * this.vh) / bands, this.vw, this.vh / bands + 1);
    }
  }

  /** A temple on its half of the view: a hill, the stepped plinth and the swinging stone, with its label and tier on top. */
  private createSide(i: number, seed: number): Side {
    const cx = ((i + 0.5) * this.vw) / 2;
    const state = newGame({ race: { rand: seeded(seed), kindRand: seeded(seed ^ 0x5bd1e995) } });
    const world = this.add.container(0, 0).setScale(SCALE).setDepth(1);
    // The hill, as wide as the half it stands in.
    const half = this.vw / 2 / SCALE;
    const ground = this.add.graphics();
    ground.fillStyle(0x2f4a36).fillEllipse(TOWER_X, PLINTH_Y + 120, half + 200, 200);
    ground.fillStyle(0x3d5e42).fillEllipse(TOWER_X, PLINTH_Y + 110, half, 150);
    ground.fillStyle(0x2f4a36).fillRect(TOWER_X - half / 2, PLINTH_Y + 60, half, 900);
    const steps = [
      { w: PLINTH_W + 80, h: 14 },
      { w: PLINTH_W + 40, h: 14 },
      { w: PLINTH_W, h: 16 },
    ];
    let y = PLINTH_Y + 44;
    for (const step of steps) {
      ground.fillStyle(OUTLINE).fillRect(TOWER_X - step.w / 2, y - step.h, step.w, step.h);
      ground.fillStyle(0x8e8496).fillRect(TOWER_X - step.w / 2 + 1, y - step.h + 1, step.w - 2, step.h - 2);
      ground.fillStyle(0xb2a9b8).fillRect(TOWER_X - step.w / 2 + 1, y - step.h + 1, step.w - 2, 3);
      y -= step.h;
    }
    const guide = this.add.graphics();
    const moving = this.add.graphics();
    world.add([ground, guide, moving]);
    const color = i === 0 ? '#bfe4f4' : '#c8eaa8';
    this.add
      .text(cx, 22, t(i === 0 ? 'raceLeft' : 'raceRight'), { fontFamily: FONT, fontSize: '14px', color, stroke: '#14101f', strokeThickness: 3 })
      .setOrigin(0.5)
      .setDepth(UI_DEPTH);
    const tierText = this.add.text(cx, 46, '', textStyle(18, '#f3c64e')).setOrigin(0.5).setDepth(UI_DEPTH);
    const side: Side = { state, cx, world, stones: [], moving, movingKey: '', guide, tierText, scroll: 0 };
    this.place(side);
    return side;
  }

  /** Puts a temple's world where its half and its scroll say. */
  private place(side: Side) {
    side.world.setPosition(side.cx - TOWER_X * SCALE, this.vh - GROUND_UP - PLINTH_Y * SCALE + side.scroll);
  }

  /** Scrolls a temple's half down as it grows, so its top stays in view. */
  private follow(side: Side, dt: number) {
    const top = this.vh - GROUND_UP - stackHeight(side.state) * SCALE;
    const target = Math.max(0, TOP_Y - top);
    side.scroll += (target - side.scroll) * (1 - Math.exp(-dt / CAMERA_MS));
    this.place(side);
  }

  private dropSide(i: number) {
    if (this.winner !== null) return;
    if (drop(this.sides[i].state)) sfx('whoosh');
  }

  /**
   * The first temple crowned wins; one that missed loses to the other, and two crowns or two misses
   * in the same frame are a draw.
   */
  private judge() {
    const [a, b] = this.sides.map((side) => side.state.phase);
    if (a === 'crowned' && b === 'crowned') this.winner = -1;
    else if (a === 'crowned' || b === 'crowned') this.winner = a === 'crowned' ? 0 : 1;
    else if (a === 'over' && b === 'over') this.winner = -1;
    else if (a === 'over' || b === 'over') this.winner = a === 'over' ? 1 : 0;
    if (this.winner === null) return;
    if (this.winner >= 0 || a === 'crowned') playSting(SONG, 'crown');
    else playSting(SONG, 'fall');
  }

  /** What one temple's rules just did: a stone landing or falling, a tier toppling or a stone growing back. */
  private show(side: Side, e: GameEvent) {
    const s = side.state;
    const goal = goalOf(s);
    if (e.type === 'placed') {
      const g = this.add.graphics().setPosition(e.stone.x, PLINTH_Y - e.row * STONE_H);
      drawStone(g, e.stone.w, e.stone.tier, e.stone.perfect, e.stone.kind, e.stone.material, goal);
      side.world.add(g);
      side.stones.push(g);
      for (const piece of e.cut) this.debris(side, piece.x, PLINTH_Y - e.row * STONE_H, piece.w, e.stone.tier);
      sfx('thud', { pitch: e.stone.kind === 'heavy' ? 0.8 : e.stone.kind === 'light' ? 1.25 : 1 });
      if (e.drop.perfect) {
        sfx('bell', { pitch: bellPitch(s.chain) });
        this.popup(side, e.stone.x, PLINTH_Y - (e.row + 1) * STONE_H - 6, t('perfectPopup', { n: e.favor }));
      } else if (e.cut.length) sfx('crack');
    } else if (e.type === 'missed') {
      sfx('crash');
      this.debris(side, e.drop.x, PLINTH_Y - stackHeight(s), e.drop.w, e.tier);
    } else if (e.type === 'toppled') {
      for (const g of side.stones.splice(side.stones.length - e.count, e.count)) this.tumble(g, e.lean > 0 ? 1 : -1);
      sfx('rumble');
      this.popup(side, TOWER_X, PLINTH_Y - stackHeight(s) - 40, t('toppled'));
    } else if (e.type === 'regrown') {
      const i = s.stones.length - 1;
      const top = s.stones[i];
      side.stones[i].clear();
      drawStone(side.stones[i], top.w, top.tier, top.perfect, top.kind, top.material, goal);
      sfx('shimmer');
    } else if (e.type === 'tier') {
      if (e.balanced) {
        // Gold trim along a balanced tier.
        const top = s.stones[e.tier * STONES_PER_TIER - 1];
        const y = PLINTH_Y - e.tier * STONES_PER_TIER * STONE_H;
        side.world.add(this.add.graphics().fillStyle(GOLD).fillRect(top.x - top.w / 2 + 1, y + 1, top.w - 2, 3));
      }
      if (s.phase !== 'crowned') sfx(e.balanced ? 'chime' : 'meh');
    } else if (e.type === 'crowned') {
      const top = s.stones.at(-1)!;
      const g = this.add.graphics().setPosition(top.x, PLINTH_Y - stackHeight(s));
      g.fillStyle(OUTLINE).fillRect(-30, -12, 60, 12);
      g.fillTriangle(-32, -10, -22, -40, -12, -10).fillTriangle(-12, -10, 0, -48, 12, -10).fillTriangle(12, -10, 22, -40, 32, -10);
      g.fillStyle(GOLD).fillRect(-28, -11, 56, 10);
      g.fillTriangle(-29, -10, -22, -36, -15, -10).fillTriangle(-9, -10, 0, -44, 9, -10).fillTriangle(15, -10, 22, -36, 29, -10);
      side.world.add(g);
    }
  }

  private debris(side: Side, x: number, y: number, w: number, tier: number) {
    const g = this.add.graphics().setPosition(x, y);
    drawStone(g, w, tier, false, 'normal', 'limestone', goalOf(side.state));
    side.world.add(g);
    this.tumble(g, x < TOWER_X ? -1 : 1);
  }

  private tumble(g: Phaser.GameObjects.Graphics, dir: number) {
    this.tweens.add({ targets: g, y: g.y + 420, x: g.x + dir * 60, angle: dir * 70, alpha: 0, duration: 1100, ease: 'Quad.easeIn', onComplete: () => g.destroy() });
  }

  private popup(side: Side, x: number, y: number, text: string) {
    const p = this.add.text(x, y, text, textStyle(24, '#f3c64e')).setOrigin(0.5, 1);
    side.world.add(p);
    this.tweens.add({ targets: p, y: y - 50, alpha: 0, duration: 900, ease: 'Quad.easeIn', onComplete: () => p.destroy() });
  }

  /** The swinging or falling stone and its drop guide, in the temple's own world. */
  private drawMoving(side: Side) {
    const s = side.state;
    const m = s.moving;
    const show = s.phase === 'swinging' || s.phase === 'falling';
    side.moving.setVisible(show);
    side.guide.clear();
    if (!show) return;
    const key = `${m.w}|${s.tier}|${m.kind}|${m.material}`;
    if (key !== side.movingKey) {
      side.movingKey = key;
      side.moving.clear();
      drawStone(side.moving, m.w, s.tier, false, m.kind, m.material, goalOf(s));
    }
    const y = PLINTH_Y - m.h;
    side.moving.setPosition(m.x, y);
    const top = PLINTH_Y - stackHeight(s);
    side.guide.fillStyle(0xf3e9d2, 0.35);
    for (let gy = y + 6; gy < top - 2; gy += 10) side.guide.fillRect(Math.round(m.x) - 1, gy, 2, 5);
  }

  /** The end panel: who won and why, with Race again and Back. */
  private createEnd() {
    const cx = this.vw / 2;
    const cy = this.vh / 2;
    const dim = this.add.rectangle(cx, cy, this.vw, this.vh, 0x0c0916, 0.6).setInteractive();
    const panel = this.add.rectangle(cx, cy, END_PANEL.w, END_PANEL.h, 0x231c38).setStrokeStyle(4, 0x6a5a9a);
    this.endTitle = this.add.text(cx, cy - 80, '', textStyle(26, '#f3c64e')).setOrigin(0.5);
    this.endText = this.add.text(cx, cy - 20, '', { fontFamily: FONT, fontSize: '16px', color: '#f1e3c6', align: 'center' }).setOrigin(0.5);
    const again = makeButton(this, cx - 115, cy + 80, t('raceAgain'), () => {
      ui('click');
      this.scene.restart();
    });
    const back = makeButton(this, cx + 115, cy + 80, t('raceBack'), () => {
      ui('click');
      // Empty data, so the patron pick comes back rather than the village a build last restarted with.
      this.scene.start('Game', {});
    });
    this.endParts = [dim, panel, this.endTitle, this.endText, ...again, ...back] as UiPart[];
    for (const part of this.endParts) part.setDepth(UI_DEPTH + 20).setVisible(false);
  }

  private showEnd() {
    this.endShown = true;
    const w = this.winner!;
    if (w < 0) {
      this.endTitle.setText(t(this.sides[0].state.phase === 'crowned' ? 'raceBothCrowned' : 'raceDraw'));
      this.endText.setText(t('raceDrawText'));
    } else {
      const s = this.sides[w].state;
      this.endTitle.setText(t(w === 0 ? 'raceWinLeft' : 'raceWinRight'));
      this.endText.setText(s.phase === 'crowned' ? t('raceCrowned', { tiers: s.tiersBuilt }) : t('raceLast', { n: this.sides[1 - w].state.tiersBuilt }));
    }
    for (const part of this.endParts) part.setVisible(true);
  }
}
