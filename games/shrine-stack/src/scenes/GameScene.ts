import Phaser from 'phaser';
import { settings } from '../../../../shared/settings';
import { t } from '../i18n';
import { BLESSING_INFO, BLESSINGS, type BlessingId } from '../game/blessings';
import {
  CURSE_INFO,
  KIND_INFO,
  MATERIAL_INFO,
  MATERIAL_PICKS,
  PATRON_INFO,
  SHOP_INFO,
  TRIAL_INFO,
  type MaterialId,
  type PatronId,
  type ShopId,
  type StoneKind,
} from '../game/catalog';
import { loadBest, saveBest } from '../game/save';
import {
  buildOn,
  buy,
  canBuy,
  canPickMaterial,
  canReroll,
  canSwap,
  chooseBlessing,
  chooseMaterial,
  choosePatron,
  CURSE_MULT,
  curseNow,
  drop,
  gusty,
  keepBuilding,
  ALTAR_MULT,
  isAltar,
  nextAltar,
  GILDED_MULT,
  GILDED_TIER,
  GOAL_TIER,
  LEAN_FROM_TIER,
  LEAN_MAX,
  newGame,
  PLINTH_W,
  REROLL_COST,
  reroll,
  RESERVE_FROM_TIER,
  TRIALS_FROM_TIER,
  shopFor,
  stackHeight,
  STONE_H,
  STONES_PER_TIER,
  swapReserve,
  tick,
  toggleCurse,
  TOWER_X,
  type GameEvent,
  type GameState,
} from '../game/state';
import { makeButton } from '../ui/Button';
import { checkTrophies } from '../trophies/check';
import { playMusic, playSting, ui } from '../../../../shared/audio';
import { bellPitch, sfx, SONG } from '../audio';
import { viewFrame, viewSize } from '../../../../shared/scaling';
import {
  BUILD_ON,
  CARDS,
  CARDS_FOUR,
  CURSE,
  FONT,
  GOAL,
  LEAN_BAR,
  MATERIAL_ROW,
  MATERIAL_TITLE,
  OFFER_TITLE,
  PANEL,
  PATRON_CARDS,
  PATRON_TITLE,
  PLINTH_Y,
  REROLL,
  RESERVE_BUTTON,
  SHOP_ROW,
  SHOP_TITLE,
  TOP_SCREEN_Y,
  UI_DEPTH,
  VIEW,
} from './layout';

/** The longest step of game time one frame may take, so a hidden tab doesn't drop a stone through the temple. */
const MAX_STEP_MS = 100;
/** The widest a line of the side panel may be, so it stays inside the panel. */
const PANEL_TEXT_W = PANEL.w - 24;
/** How quickly the camera catches up with the temple's top: the time to close about two thirds of the gap. */
const CAMERA_MS = 180;
const POPUP_MS = 900;
const DEBRIS_MS = 1100;
const BANNER_MS = 2200;
/** The banner's smallest box, the room it leaves round its text, and the width its lines wrap at. */
const BANNER_MIN = { w: 420, h: 64 };
const BANNER_PAD = { x: 40, y: 20 };
const BANNER_WRAP = 640;
/** How long the crowned shrine shows on its own before the win panel comes up. */
const CROWN_MS = 2400;

/** Stone colours, one per tier, repeating. */
const TIER_COLORS = [0xd8b58a, 0xb9c3cc, 0xe3c98f, 0xa9c49a, 0xd6a7a0, 0xc2b0dc];
const OUTLINE = 0x2a2036;
const GOLD = 0xf3c64e;
/** The gilded tier's stones are leaf gold whatever the tier colours say. */
const GILT = 0xe9b949;
/** A sky altar's stones are pale cloud-silver. */
const ALTAR_STONE = 0xcfe2f2;
/** Curses are drawn in a dusky plum. */
const CURSE_COLOR = 0xb0609a;

const textStyle = (size: number, color = '#f3e9d2') => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  color,
  stroke: '#14101f',
  strokeThickness: 3,
});

/** The smallest font `setFitted` shrinks a text to. */
const MIN_FONT = 9;

/**
 * Sets a text and shrinks its font from `size` (down to `MIN_FONT`) until it is no wider than
 * `maxW`, so a long translation stays inside its box. An unchanged text is left as it is.
 */
function setFitted(text: Phaser.GameObjects.Text, value: string | string[], maxW: number, size: number) {
  if (text.text === (Array.isArray(value) ? value.join('\n') : value)) return text;
  text.setText(value).setFontSize(size);
  for (let px = size; text.width > maxW && px > MIN_FONT; ) text.setFontSize(--px);
  return text;
}

/** Where something to tap is on screen, by its centre and size; read by the playthrough test. */
export interface Spot {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a blessing card is on screen; read by the playthrough test. */
export interface BlessingCard extends Spot {
  id: BlessingId;
}

/** Where a shop button is on screen; read by the playthrough test. */
export interface ShopButton extends Spot {
  id: ShopId;
}

/** Where a patron card is on screen before the first stone; read by the playthrough test. */
export interface PatronCard extends Spot {
  id: PatronId;
}

/** Where a material button is on screen during a break. */
export interface MaterialButton extends Spot {
  id: MaterialId;
}

/** Mixes `t` of colour `b` into colour `a`. */
function blend(a: number, b: number, t: number) {
  const ca = Phaser.Display.Color.IntegerToColor(a);
  const cb = Phaser.Display.Color.IntegerToColor(b);
  const f = (x: number, y: number) => Math.round(x + (y - x) * t);
  return Phaser.Display.Color.GetColor(f(ca.red, cb.red), f(ca.green, cb.green), f(ca.blue, cb.blue));
}

/** Shifts a colour lighter (amount > 0) or darker (amount < 0). */
function shade(color: number, amount: number) {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const f = (v: number) => Phaser.Math.Clamp(Math.round(amount > 0 ? v + (255 - v) * amount : v * (1 + amount)), 0, 255);
  return Phaser.Display.Color.GetColor(f(c.red), f(c.green), f(c.blue));
}

/** A small seeded generator for the stars and clouds, so they never use `Math.random`. */
function seeded(seed: number) {
  return () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 10_000) / 10_000;
  };
}

/** Keeps a container and everything in it still on screen, so taps hit where it is drawn. */
function pin(container: Phaser.GameObjects.Container) {
  container.setScrollFactor(0, 0, true);
  for (const child of container.list) if (child instanceof Phaser.GameObjects.Container) pin(child);
  return container;
}

/** A piece of fixed UI: it can be moved, faded, hidden, layered and kept still on screen. */
export type UiPart = Phaser.GameObjects.GameObject &
  Phaser.GameObjects.Components.Transform &
  Phaser.GameObjects.Components.AlphaSingle &
  Phaser.GameObjects.Components.Visible &
  Phaser.GameObjects.Components.Depth &
  Phaser.GameObjects.Components.ScrollFactor;

/**
 * Moves the parts of a button drawn around (0, 0) to (x, y). Buttons are loose parts rather than
 * containers: Phaser misplaces taps on anything inside a container once the camera has climbed.
 */
function place(parts: UiPart[], x: number, y: number, alpha = 1) {
  for (const p of parts) p.setPosition(p.x + x, p.y + y).setAlpha(alpha);
  return parts;
}

const tierColor = (tier: number) => (tier === GILDED_TIER ? GILT : isAltar(tier) ? ALTAR_STONE : TIER_COLORS[(tier - 1) % TIER_COLORS.length]);

/** The colour of a tier's stone in a material: marble pale, sandstone warm, basalt dark; limestone is the tier's own colour. */
function materialColor(tier: number, material: MaterialId) {
  const base = tierColor(tier);
  if (tier === GILDED_TIER) return base;
  return material === 'marble' ? blend(base, 0xf4f0f8, 0.6) : material === 'sandstone' ? blend(base, 0xe0a060, 0.6) : material === 'basalt' ? blend(base, 0x3e4454, 0.7) : base;
}

/**
 * Draws a stone `w` wide with its bottom middle at the graphics' origin; heavy ones darker and strapped,
 * light ones pale and porous; marble veined, sandstone grained, basalt pitted.
 */
function drawStone(g: Phaser.GameObjects.Graphics, w: number, tier: number, perfect: boolean, kind: StoneKind = 'normal', material: MaterialId = 'limestone') {
  const base = materialColor(tier, material);
  const color = kind === 'heavy' ? shade(base, -0.28) : kind === 'light' ? shade(base, 0.35) : base;
  const x = -w / 2;
  const y = -STONE_H;
  g.fillStyle(OUTLINE).fillRect(x, y, w, STONE_H);
  if (w <= 2) return;
  g.fillStyle(color).fillRect(x + 1, y + 1, w - 2, STONE_H - 2);
  g.fillStyle(shade(color, 0.35)).fillRect(x + 1, y + 1, w - 2, 3);
  g.fillStyle(shade(color, -0.25)).fillRect(x + 1, y + STONE_H - 5, w - 2, 4);
  // Brick seams, offset on every other tier like courses of masonry.
  g.fillStyle(shade(color, -0.4));
  for (let sx = x + (tier % 2 ? 30 : 52); sx < x + w - 8; sx += 46) g.fillRect(Math.round(sx), y + 4, 2, STONE_H - 9);
  if (kind === 'heavy' && w > 24) {
    // Iron straps near either end, with a rivet top and bottom.
    for (const sx of [x + 8, x + w - 13]) {
      g.fillStyle(0x4a4656).fillRect(Math.round(sx), y + 1, 5, STONE_H - 2);
      g.fillStyle(0x9a96a8).fillRect(Math.round(sx) + 1, y + 5, 3, 3).fillRect(Math.round(sx) + 1, y + STONE_H - 9, 3, 3);
    }
  } else if (kind === 'light') {
    // Pumice pores.
    g.fillStyle(shade(color, -0.3));
    for (let px = x + 7, i = 0; px < x + w - 5; px += 13, i++) g.fillRect(Math.round(px), y + (i % 2 ? 9 : 17), 2, 2);
  }
  if (material === 'marble' && w > 20) {
    // Grey veins running across the slab.
    g.lineStyle(1, shade(color, -0.3), 0.8);
    for (let vx = x + 14; vx < x + w - 10; vx += 38) g.lineBetween(Math.round(vx), y + 5, Math.round(vx) + 9, y + STONE_H - 7);
  } else if (material === 'sandstone' && w > 20) {
    // Layered grain.
    g.fillStyle(shade(color, -0.18));
    g.fillRect(x + 4, y + 10, w - 8, 1).fillRect(x + 7, y + 17, w - 14, 1);
  } else if (material === 'basalt' && w > 20) {
    // Pits in the dark rock.
    g.fillStyle(shade(color, -0.45));
    for (let px = x + 10, i = 0; px < x + w - 6; px += 17, i++) g.fillRect(Math.round(px), y + (i % 3 ? 8 : 15), 3, 2);
  }
  if (isAltar(tier) && w > 12) {
    // A sky altar: a silver line along the top and a star near either end.
    g.fillStyle(0xf4fbff).fillRect(x + 1, y + 1, w - 2, 2);
    for (const sx of [x + 8, x + w - 11]) g.fillRect(Math.round(sx) + 1, y + 7, 1, 5).fillRect(Math.round(sx), y + 9, 3, 1);
  }
  if (tier === GILDED_TIER && w > 12) {
    // Gilding: a bright leaf along the top and a glint near either end.
    g.fillStyle(0xfff1b8).fillRect(x + 1, y + 1, w - 2, 2);
    g.fillStyle(0xfff8dc).fillRect(x + 6, y + 6, 3, 3).fillRect(x + w - 10, y + 9, 2, 2);
  }
  if (perfect) {
    // A gold rune in the middle of a stone that snapped on whole.
    g.fillStyle(GOLD).fillTriangle(-5, y + STONE_H / 2, 0, y + 7, 5, y + STONE_H / 2);
    g.fillTriangle(-5, y + STONE_H / 2, 0, y + STONE_H - 7, 5, y + STONE_H / 2);
  }
}

export class GameScene extends Phaser.Scene {
  /** The game being played; read by the playthrough test. */
  state!: GameState;
  /** The blessing cards on screen while choosing; read by the playthrough test. */
  blessingCards: BlessingCard[] = [];
  /** The reroll button while choosing a blessing, or null; read by the playthrough test. */
  rerollButton: Spot | null = null;
  /** The shop's buttons between tiers, the curse toggle and the button that ends a wobbly tier's break. */
  shopButtons: ShopButton[] = [];
  curseToggle: Spot | null = null;
  buildOnButton: Spot | null = null;
  /** The "Keep building" button on the crowned panel, or null. */
  keepButton: Spot | null = null;
  /** The patron cards before the first stone; read by the playthrough test. */
  patronCards: PatronCard[] = [];
  /** The material buttons during a break (from tier 3), and the reserve's swap button while it can be used. */
  materialButtons: MaterialButton[] = [];
  reserveButton: Spot | null = null;
  private lastFrame: number | null = null;
  private stoneViews: Phaser.GameObjects.Graphics[] = [];
  /** The gold trim and lanterns on each balanced tier, by tier. */
  private ornaments = new Map<number, Phaser.GameObjects.Graphics>();
  private moving!: Phaser.GameObjects.Graphics;
  private movingKey = '';
  private guide!: Phaser.GameObjects.Graphics;
  private tierText!: Phaser.GameObjects.Text;
  private pips!: Phaser.GameObjects.Graphics;
  private favorText!: Phaser.GameObjects.Text;
  private builtText!: Phaser.GameObjects.Text;
  private nextText!: Phaser.GameObjects.Text;
  private trialText!: Phaser.GameObjects.Text;
  private curseText!: Phaser.GameObjects.Text;
  private patronText!: Phaser.GameObjects.Text;
  private reserveText!: Phaser.GameObjects.Text;
  private reserveParts: UiPart[] = [];
  private leanLabel!: Phaser.GameObjects.Text;
  private leanBar!: Phaser.GameObjects.Graphics;
  private windText!: Phaser.GameObjects.Text;
  /** The goal box's last line: the gilded tier, or in the sky the next sky altar. */
  private goalNote!: Phaser.GameObjects.Text;
  private crown: Phaser.GameObjects.Graphics | null = null;
  /** "Build again" centred (after a fall) and beside "Keep building" (after the crown). */
  private againButton: UiPart[] = [];
  private againBeside: UiPart[] = [];
  private keepBuildingButton: UiPart[] = [];
  private blessingsText!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Container;
  private bannerText!: Phaser.GameObjects.Text;
  private bannerBack!: Phaser.GameObjects.Rectangle;
  /** Everything shown during a break between tiers, rebuilt with the offer. */
  private offerParts: UiPart[] = [];
  private offerKey = '';
  /** The patron pick before the first stone. */
  private patronParts: UiPart[] = [];
  private patronShown = false;
  /** The end panel's dim, panel and texts. */
  private gameOver: UiPart[] = [];
  private gameOverTitle!: Phaser.GameObjects.Text;
  private gameOverText!: Phaser.GameObjects.Text;
  private goalPips!: Phaser.GameObjects.Graphics;
  /** Game time since the shrine was crowned. */
  private crownedMs = 0;
  /** The song part playing, so the music only switches when the phase calls for another. */
  private musicPart = '';
  /** `dropped` when the gust sound last played, so each gusty stone sounds once. */
  private lastGustStone = -1;
  /** The view's size in game pixels (wider or taller than `VIEW` when it fills the screen). */
  private vw: number = VIEW.w;
  private vh: number = VIEW.h;
  /** Where the designed 960x540 frame sits in the view: the world and the break's layer move by this. */
  private fx = 0;
  private fy = 0;

  constructor() {
    super('Game');
  }

  create() {
    this.state = newGame(loadBest());
    this.lastFrame = null;
    this.stoneViews = [];
    this.ornaments = new Map();
    this.blessingCards = [];
    this.rerollButton = null;
    this.shopButtons = [];
    this.curseToggle = null;
    this.buildOnButton = null;
    this.keepButton = null;
    this.patronCards = [];
    this.materialButtons = [];
    this.reserveButton = null;
    this.patronParts = [];
    this.patronShown = false;
    this.crown = null;
    this.crownedMs = 0;
    this.musicPart = '';
    this.lastGustStone = -1;
    this.movingKey = '';
    this.offerKey = '';
    ({ width: this.vw, height: this.vh } = viewSize(this));
    ({ x: this.fx, y: this.fy } = viewFrame(this));
    // The camera puts the designed frame in the middle of the view; it only ever moves up from here.
    this.cameras.main.setScroll(-this.fx, -this.fy);

    this.createBackdrop();
    this.createPlinth();
    this.guide = this.add.graphics().setDepth(4);
    this.moving = this.add.graphics().setDepth(5);
    this.createPanel();

    this.hint = this.add
      .text(this.fx + TOWER_X, this.vh - 18, t('hint'), textStyle(14, '#d8cbe8'))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(UI_DEPTH);
    this.windText = this.add.text(this.fx + TOWER_X, 20, '', textStyle(15, '#bfe4f4')).setOrigin(0.5).setScrollFactor(0).setDepth(UI_DEPTH);
    this.bannerBack = this.add.rectangle(0, 0, BANNER_MIN.w, BANNER_MIN.h, 0x231c38, 0.92).setStrokeStyle(3, GOLD);
    this.bannerText = this.add
      .text(0, 0, '', { ...textStyle(20), wordWrap: { width: BANNER_WRAP } })
      .setOrigin(0.5)
      .setAlign('center')
      .setLineSpacing(6);
    this.banner = pin(this.add.container(this.fx + TOWER_X, this.fy + 70, [this.bannerBack, this.bannerText]))
      .setDepth(UI_DEPTH + 5)
      .setAlpha(0);

    // One zone over the whole view: a tap drops the swinging stone.
    this.add
      .zone(0, 0, this.vw, this.vh)
      .setOrigin(0)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => drop(this.state) && sfx('whoosh'));
    // R swaps the stone in hand with the reserve, like the panel's button.
    this.input.keyboard?.on('keydown-R', () => this.trySwap());
    // The shared pause stops update but not the frame clock: the first frame after Resume steps nothing.
    const onResume = () => (this.lastFrame = null);
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    this.events.on(Phaser.Scenes.Events.WAKE, onResume);
    // A restart ("Build again") shuts the scene down without clearing these, so take them off.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.RESUME, onResume);
      this.events.off(Phaser.Scenes.Events.WAKE, onResume);
    });

    this.offerParts = [];
    this.createGameOver();
    this.refresh();
  }

  update(time: number) {
    // Game time from the frame's own timestamp rather than Phaser's smoothed delta.
    const dt = this.lastFrame === null ? 0 : Phaser.Math.Clamp(time - this.lastFrame, 0, MAX_STEP_MS);
    this.lastFrame = time;
    const s = this.state;
    tick(s, dt);
    if (s.phase === 'crowned') this.crownedMs += dt;
    for (const e of s.events.splice(0)) {
      this.show(e);
      checkTrophies(s, e);
    }
    this.updateSound();

    // The camera follows the temple's top up, easing so each new stone slides the view gently.
    const target = Math.min(0, PLINTH_Y - stackHeight(s) - TOP_SCREEN_Y) - this.fy;
    const cam = this.cameras.main;
    cam.scrollY += (target - cam.scrollY) * (1 - Math.exp(-dt / CAMERA_MS));

    this.drawMoving();
    this.refresh();
  }

  private createBackdrop() {
    // The dusk sky, in bands from deep violet at the top to amber at the horizon.
    const sky = this.add.graphics().setScrollFactor(0).setDepth(-10);
    const top = Phaser.Display.Color.IntegerToColor(0x1d1838);
    const low = Phaser.Display.Color.IntegerToColor(0xd88a5a);
    const bands = 27;
    for (let i = 0; i < bands; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(top, low, bands - 1, Math.pow(i / (bands - 1), 1.6) * (bands - 1));
      sky.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b)).fillRect(0, (i * this.vh) / bands, this.vw, this.vh / bands + 1);
    }
    const rand = seeded(20261013);
    for (let i = 0; i < 60; i++) {
      sky.fillStyle(0xf3e9d2, 0.4 + rand() * 0.5).fillRect(Math.round(rand() * this.vw), Math.round(rand() * (280 + this.fy)), rand() < 0.2 ? 2 : 1, rand() < 0.2 ? 2 : 1);
    }
    const mx = this.fx + 820;
    const my = this.fy + 92;
    sky.fillStyle(0xf6e7c0, 0.18).fillCircle(mx, my, 34);
    sky.fillStyle(0xf6e7c0).fillCircle(mx, my, 24);
    sky.fillStyle(0xe7d4a6).fillCircle(mx - 8, my - 6, 5).fillCircle(mx + 8, my + 8, 3);

    // Far mountains drift slowly as the camera climbs. Each layer starts as far down as the
    // designed frame sits in the view, whatever its scroll factor.
    const sink = (f: number) => this.fy * (1 - f);
    const far = this.add.graphics().setScrollFactor(0, 0.15).setDepth(-9).setY(sink(0.15));
    far.fillStyle(0x4a3a62).fillPoints(this.ridge(380, 70, 7, rand), true);
    const near = this.add.graphics().setScrollFactor(0, 0.35).setDepth(-8).setY(sink(0.35));
    near.fillStyle(0x34294a).fillPoints(this.ridge(430, 50, 11, rand), true);

    // Clouds at every height, so climbing shows.
    const clouds = this.add.graphics().setScrollFactor(0, 0.6).setDepth(-7).setY(sink(0.6));
    for (let y = 260; y > -16000; y -= 110 + rand() * 90) {
      const x = 240 + rand() * (this.vw - 240);
      const w = 50 + rand() * 70;
      clouds.fillStyle(0xf3e9d2, 0.12 + rand() * 0.1);
      clouds.fillEllipse(x, y, w, w * 0.32).fillEllipse(x + w * 0.3, y - 6, w * 0.6, w * 0.3);
    }
  }

  /** A jagged mountain line along `baseY`, closed down to the bottom of the view. */
  private ridge(baseY: number, height: number, peaks: number, rand: () => number) {
    const points = [new Phaser.Math.Vector2(0, VIEW.h + 400)];
    for (let i = 0; i <= peaks * 2; i++) {
      const x = (i / (peaks * 2)) * this.vw;
      const y = i % 2 ? baseY - height * (0.5 + rand() * 0.5) : baseY - rand() * height * 0.2;
      points.push(new Phaser.Math.Vector2(x, y));
    }
    points.push(new Phaser.Math.Vector2(this.vw, VIEW.h + 400));
    return points;
  }

  private createPlinth() {
    const g = this.add.graphics().setDepth(1);
    // The hill the shrine stands on.
    g.fillStyle(0x2f4a36).fillEllipse(TOWER_X, PLINTH_Y + 120, 900 + 2 * this.fx, 200);
    g.fillStyle(0x3d5e42).fillEllipse(TOWER_X, PLINTH_Y + 110, 760 + 2 * this.fx, 150);
    g.fillStyle(0x2f4a36).fillRect(-this.fx, PLINTH_Y + 60, this.vw, 200 + this.fy);
    // Three steps up to the plinth, the top one exactly as wide as the plinth.
    const steps = [
      { w: PLINTH_W + 80, h: 14 },
      { w: PLINTH_W + 40, h: 14 },
      { w: PLINTH_W, h: 16 },
    ];
    let y = PLINTH_Y + 44;
    for (const step of steps) {
      g.fillStyle(OUTLINE).fillRect(TOWER_X - step.w / 2, y - step.h, step.w, step.h);
      g.fillStyle(0x8e8496).fillRect(TOWER_X - step.w / 2 + 1, y - step.h + 1, step.w - 2, step.h - 2);
      g.fillStyle(0xb2a9b8).fillRect(TOWER_X - step.w / 2 + 1, y - step.h + 1, step.w - 2, 3);
      y -= step.h;
    }
  }

  private createPanel() {
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T) =>
      o.setScrollFactor(0).setDepth(UI_DEPTH);
    const small = (color: string) => ({ fontFamily: FONT, fontSize: '13px', color, stroke: '#14101f', strokeThickness: 2 });
    fixed(this.add.rectangle(PANEL.x, PANEL.y, PANEL.w, this.vh - 2 * PANEL.y, 0x231c38, 0.92).setOrigin(0).setStrokeStyle(3, 0x4a3a6a));
    fixed(this.add.text(PANEL.x + PANEL.w / 2, PANEL.y + 20, t('title'), textStyle(22, '#f3c64e')).setOrigin(0.5));
    this.patronText = fixed(this.add.text(PANEL.x + PANEL.w / 2, PANEL.y + 42, '', { fontFamily: FONT, fontSize: '12px', color: '#d8cbe8' }).setOrigin(0.5));
    this.tierText = fixed(this.add.text(PANEL.x + 16, PANEL.y + 56, '', textStyle(18)));
    this.pips = fixed(this.add.graphics());
    this.favorText = fixed(this.add.text(PANEL.x + 16, PANEL.y + 102, '', textStyle(18, '#f3c64e')));
    this.builtText = fixed(this.add.text(PANEL.x + 16, PANEL.y + 126, '', textStyle(14, '#d8cbe8')));
    this.nextText = fixed(this.add.text(PANEL.x + 16, PANEL.y + 146, '', textStyle(14)));
    this.reserveText = fixed(this.add.text(PANEL.x + 16, PANEL.y + 166, '', small('#d8cbe8')));
    // The reserve's swap button, lit while a swap is allowed.
    const { x: rx, y: ry, w: rw, h: rh } = RESERVE_BUTTON;
    const swapBg = fixed(this.add.rectangle(rx, ry, rw, rh, 0x4a3a6a).setStrokeStyle(2, GOLD));
    const swapLabel = fixed(this.add.text(rx, ry, t('swap'), { fontFamily: FONT, fontSize: '10px', color: '#f3e9d2' }).setOrigin(0.5));
    swapBg
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => canSwap(this.state) && swapBg.setFillStyle(0x6a5a9a))
      .on('pointerout', () => swapBg.setFillStyle(0x4a3a6a))
      .on('pointerdown', () => this.trySwap());
    this.reserveParts = [swapBg, swapLabel];
    this.trialText = fixed(this.add.text(PANEL.x + 16, PANEL.y + 186, '', small('#9ad46a')));
    this.curseText = fixed(this.add.text(PANEL.x + 16, PANEL.y + 203, '', small('#e8a0d4')));
    this.leanLabel = fixed(this.add.text(PANEL.x + 16, PANEL.y + 220, t('lean'), small('#d8cbe8')));
    this.leanBar = fixed(this.add.graphics());
    fixed(this.add.text(PANEL.x + 16, PANEL.y + 244, t('blessings'), textStyle(16, '#f3c64e')));
    this.blessingsText = fixed(
      this.add.text(PANEL.x + 16, PANEL.y + 266, '', { fontFamily: FONT, fontSize: '12px', color: '#f3e9d2', lineSpacing: 3 }),
    );
    // The run's goal: a pip per tier up to the crown, the gilded one framed in gold.
    const goal = PANEL.y + GOAL.y;
    fixed(this.add.rectangle(PANEL.x + 10, goal, PANEL.w - 20, 76, 0x2c2446).setOrigin(0).setStrokeStyle(2, 0x6a5a9a));
    fixed(this.add.text(PANEL.x + 18, goal + 6, t('goal', { tier: GOAL_TIER }), textStyle(14, '#f3c64e')));
    this.goalPips = fixed(this.add.graphics());
    this.goalNote = fixed(this.add.text(PANEL.x + 18, goal + 52, '', { fontFamily: FONT, fontSize: '12px', color: '#e9b949' }));
    // The rules sit between the goal box and the corner buttons, which reach 42px up from the view's bottom.
    fixed(
      this.add.text(PANEL.x + 16, goal + 80, t('rules'), {
        fontFamily: FONT,
        fontSize: '11px',
        color: '#a99cc0',
        lineSpacing: 1,
      }),
    );
  }

  /** The panel's lean meter: a bar with the centre marked and a pointer for the lean, red near the limit. */
  private drawLean() {
    const s = this.state;
    const { x, y, w, h } = LEAN_BAR;
    const g = this.leanBar.clear();
    const on = s.tier >= LEAN_FROM_TIER;
    this.leanLabel.setText(on ? t('lean') : t('leanFrom', { tier: LEAN_FROM_TIER })).setColor(on ? '#d8cbe8' : '#8a7ea0');
    if (!on) return;
    g.fillStyle(OUTLINE).fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(0x3a3052).fillRect(x, y, w, h);
    g.fillStyle(0x6a5a9a).fillRect(x + w / 2 - 1, y, 2, h);
    const share = Phaser.Math.Clamp(s.lean / LEAN_MAX, -1, 1);
    const px = x + w / 2 + share * (w / 2 - 3);
    const color = Math.abs(share) > 0.7 ? 0xe86a4a : Math.abs(share) > 0.4 ? 0xf3c64e : 0x9ad46a;
    g.fillStyle(color).fillRect(Math.round(Math.min(px, x + w / 2)), y + 2, Math.max(2, Math.round(Math.abs(px - (x + w / 2)))), h - 4);
    g.fillStyle(0xf3e9d2).fillRect(Math.round(px) - 1, y - 2, 3, h + 4);
  }

  /** Switches the song's part with the phase and hears a gust pick up around a new stone. */
  private updateSound() {
    const s = this.state;
    const playing = s.phase === 'swinging' || s.phase === 'falling';
    const part = !playing ? 'break' : s.tier === GILDED_TIER || isAltar(s.tier) ? 'gilded' : s.endless ? 'sky' : 'calm';
    if (part !== this.musicPart) {
      this.musicPart = part;
      playMusic(SONG, part);
    }
    // Only while stacking: the next stone's wind is rolled as a break opens, and must still gust when play resumes.
    if (!playing) return;
    if (s.wind !== 0 && s.dropped !== this.lastGustStone) {
      sfx('gust');
      this.lastGustStone = s.dropped;
    }
  }

  /** The panel's Swap button and the R key: swap, or buzz while stacking when it isn't allowed. */
  private trySwap() {
    const s = this.state;
    if (swapReserve(s)) return;
    if (s.phase === 'swinging' || s.phase === 'falling') ui('refuse');
  }

  private createGameOver() {
    const cx = this.vw / 2;
    const cy = this.vh / 2;
    const dim = this.add.rectangle(cx, cy, this.vw, this.vh, 0x0c0916, 0.7).setInteractive();
    const panel = this.add.rectangle(cx, cy, 520, 260, 0x231c38).setStrokeStyle(4, 0x6a5a9a);
    const title = (this.gameOverTitle = this.add.text(cx, cy - 90, '', textStyle(30, '#f3c64e')).setOrigin(0.5));
    this.gameOverText = this.add
      .text(cx, cy - 10, '', { fontFamily: FONT, fontSize: '16px', color: '#f1e3c6', align: 'center' })
      .setOrigin(0.5);
    this.gameOver = [dim, panel, title, this.gameOverText];
    const restart = () => {
      ui('click');
      this.scene.restart();
    };
    this.againButton = makeButton(this, cx, cy + 80, t('buildAgain'), restart);
    this.againBeside = makeButton(this, cx - 115, cy + 80, t('buildAgain'), restart);
    this.keepBuildingButton = makeButton(this, cx + 115, cy + 80, t('keepBuilding'), () => {
      if (keepBuilding(this.state)) {
        sfx('rise');
        this.onKeepBuilding();
      }
    });
    for (const part of [...this.gameOver, ...this.againButton, ...this.againBeside, ...this.keepBuildingButton]) {
      part.setScrollFactor(0).setDepth(UI_DEPTH + 20).setVisible(false);
    }
  }

  /** The world y of a height above the plinth. */
  private worldY(h: number) {
    return PLINTH_Y - h;
  }

  /** Shows what the rules just did: a stone landing, a piece breaking off, a tier finishing. */
  private show(e: GameEvent) {
    const s = this.state;
    if (e.type === 'placed') {
      // Drawn from the event: a topple may already have taken the stone off `s.stones`.
      const { stone, row: i } = e;
      const g = this.add.graphics().setDepth(3).setPosition(stone.x, this.worldY(i * STONE_H));
      drawStone(g, stone.w, stone.tier, stone.perfect, stone.kind, stone.material);
      this.stoneViews.push(g);
      for (const piece of e.cut) this.debris(piece.x, this.worldY(i * STONE_H), piece.w, stone.tier, stone.kind, stone.material);
      this.popup(stone.x, this.worldY((i + 1) * STONE_H) - 6, e.drop.perfect ? t('perfectPopup', { n: e.favor }) : `+${e.favor}`, e.drop.perfect);
      if (e.drop.perfect) this.glow(stone.x, this.worldY(i * STONE_H), stone.w);
      sfx('thud', { pitch: stone.kind === 'heavy' ? 0.8 : stone.kind === 'light' ? 1.25 : 1 });
      if (e.drop.perfect) sfx('bell', { pitch: bellPitch(s.chain) });
      else if (e.cut.length) sfx('crack');
    } else if (e.type === 'missed') {
      sfx(e.drop.caught ? 'saved' : 'crash');
      if (s.phase === 'over') playSting(SONG, 'fall');
      this.debris(e.drop.x, this.worldY(stackHeight(s)), e.drop.w, e.tier, e.kind, e.material);
      this.cameras.main.shake(200, 0.006);
      if (e.drop.caught) this.announce([t('graceName'), t('caught')]);
      if (s.phase === 'over') saveBest(s.best);
    } else if (e.type === 'rerolled') {
      sfx('shuffle');
      this.popup(PANEL.x + 150, PANEL.y + 126, `-${REROLL_COST}`, false, true);
    } else if (e.type === 'bought') {
      ui('coin');
      this.popup(PANEL.x + 150, PANEL.y + 126, `-${SHOP_INFO[e.item].cost}`, false, true);
      if (e.item === 'wider') this.redrawTop();
    } else if (e.type === 'trial') {
      const top = s.stones.at(-1)!;
      const y = this.worldY(stackHeight(s)) - 34;
      sfx(e.passed ? 'sparkle' : 'blip');
      this.popup(top.x, y, e.passed ? t('trialPassed', { n: e.favor }) : t('trialFailedPopup'), e.passed);
    } else if (e.type === 'toppled') {
      // The tier's stones tumble off the way the temple was leaning.
      const side = e.lean > 0 ? 1 : -1;
      for (const g of this.stoneViews.splice(this.stoneViews.length - e.count, e.count)) this.tumble(g, side);
      this.cameras.main.shake(250, 0.008);
      sfx('rumble');
      sfx('tumble');
      const right = side > 0;
      // The toppled tier always held at least one stone's favour, so there is always some to lose.
      this.announce([t('toppled'), t(right ? 'toppledFavourRight' : 'toppledFavourLeft', { n: e.favor })]);
    } else if (e.type === 'regrown') {
      sfx('shimmer');
      this.redrawTop();
      this.popup(s.stones.at(-1)!.x, this.worldY(stackHeight(s)) - 34, t('regrown', { n: e.px }), true);
    } else if (e.type === 'swapped') {
      sfx('swish');
      this.popup(PANEL.x + PANEL.w + 90, RESERVE_BUTTON.y + 8, t('inHand', { kind: t(KIND_INFO[e.kind].name) }), false, true);
    } else if (e.type === 'altar') {
      // A sky altar: trimmed and lit like a balanced tier, and a blessing either way.
      this.ornament(e.tier);
      sfx('gong');
    } else if (e.type === 'patron') {
      const info = PATRON_INFO[e.patron];
      sfx('gong');
      this.announce([t('watchesOver', { patron: t(info.name) }), t(info.boon)]);
    } else {
      if (e.balanced) this.ornament(e.tier);
      if (s.phase !== 'crowned') sfx(e.balanced ? 'chime' : 'meh');
      if (s.phase === 'crowned') this.crownTemple();
      // A break between tiers says so itself; only a wobbly tier with nothing to buy goes straight on.
      else if (s.phase !== 'blessing') this.announce([t('wobbly', { tier: e.tier })]);
      saveBest(s.best);
    }
  }

  /** A gold crown with three points and gems on top of the finished shrine. */
  private crownTemple() {
    const top = this.state.stones.at(-1)!;
    const y = this.worldY(stackHeight(this.state));
    const g = (this.crown = this.add.graphics().setDepth(3.6).setPosition(top.x, y));
    g.fillStyle(OUTLINE).fillRect(-30, -12, 60, 12);
    g.fillTriangle(-32, -10, -22, -40, -12, -10).fillTriangle(-12, -10, 0, -48, 12, -10).fillTriangle(12, -10, 22, -40, 32, -10);
    g.fillStyle(GOLD).fillRect(-28, -11, 56, 10);
    g.fillTriangle(-29, -10, -22, -36, -15, -10).fillTriangle(-9, -10, 0, -44, 9, -10).fillTriangle(15, -10, 22, -36, 29, -10);
    g.fillStyle(0xfff1b8).fillRect(-28, -11, 56, 2);
    g.fillStyle(0x6ac0e8).fillCircle(0, -6, 3);
    g.fillStyle(0x8ad06a).fillCircle(-18, -6, 2.5).fillCircle(18, -6, 2.5);
    this.glow(top.x, y, top.w);
    playSting(SONG, 'crown');
    this.announce([t('crowned'), t('tierStands', { tier: GOAL_TIER })]);
  }

  /** A broken piece or a missed stone, tumbling down off the temple. */
  private debris(x: number, y: number, w: number, tier: number, kind: StoneKind = 'normal', material: MaterialId = 'limestone') {
    const g = this.add.graphics().setDepth(6).setPosition(x, y);
    drawStone(g, w, tier, false, kind, material);
    this.tumble(g, x < TOWER_X ? -1 : 1);
  }

  /** Sends a drawn stone tumbling down off the temple to `side`, then destroys it. */
  private tumble(g: Phaser.GameObjects.Graphics, side: number) {
    const { x, y } = g;
    g.setDepth(6);
    this.tweens.add({
      targets: g,
      y: y + 420,
      x: x + side * 60,
      angle: side * 70,
      alpha: 0,
      duration: DEBRIS_MS,
      ease: 'Quad.easeIn',
      onComplete: () => g.destroy(),
    });
  }

  /** A soft gold glow along a stone that landed perfectly, fading out once. */
  private glow(x: number, y: number, w: number) {
    const r = this.add.rectangle(x, y - STONE_H / 2, w + 16, STONE_H + 16, GOLD, 0.45).setDepth(2);
    this.tweens.add({ targets: r, alpha: 0, scaleX: 1.15, duration: 500, onComplete: () => r.destroy() });
  }

  /** Gold trim along the top of a balanced tier, and a lantern hanging from either side. */
  private ornament(tier: number) {
    const top = this.state.stones[tier * STONES_PER_TIER - 1];
    const y = this.worldY(tier * STONES_PER_TIER * STONE_H);
    const g = this.ornaments.get(tier) ?? this.add.graphics().setDepth(3.5);
    this.ornaments.set(tier, g.clear());
    g.fillStyle(GOLD).fillRect(top.x - top.w / 2 + 1, y + 1, top.w - 2, 3);
    for (const side of [-1, 1]) {
      const edge = top.x + side * (top.w / 2);
      const lx = edge + side * 7;
      g.fillStyle(OUTLINE).fillRect(Math.min(edge, lx), y + 5, 7, 2);
      g.fillStyle(0xffd27a, 0.18).fillCircle(lx, y + 15, 12);
      g.fillStyle(OUTLINE).fillRect(lx - 4, y + 9, 8, 13);
      g.fillStyle(0xffd27a).fillRect(lx - 3, y + 10, 6, 11);
      g.fillStyle(OUTLINE).fillRect(lx - 5, y + 7, 10, 3).fillRect(lx - 1, y + 5, 2, 3);
    }
  }

  /** A number or word that floats up and fades, in the world or, `fixed`, on the screen (by the panel). */
  private popup(x: number, y: number, text: string, big: boolean, fixed = false) {
    const t = this.add
      .text(x, y, text, textStyle(big ? 20 : 16, big ? '#f3c64e' : '#f3e9d2'))
      .setOrigin(0.5, 1)
      .setScrollFactor(fixed ? 0 : 1)
      .setDepth(UI_DEPTH - 1);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: POPUP_MS, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
  }

  private announce(lines: string[]) {
    this.bannerText.setText(lines);
    // The box grows to fit a long line (some boons, and German) rather than letting it spill out.
    this.bannerBack.setSize(
      Math.max(BANNER_MIN.w, this.bannerText.width + BANNER_PAD.x),
      Math.max(BANNER_MIN.h, this.bannerText.height + BANNER_PAD.y),
    );
    this.banner.setAlpha(1);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({ targets: this.banner, alpha: 0, delay: BANNER_MS / 2, duration: BANNER_MS / 2 });
  }

  /** The swinging or falling stone and the faint line showing where it would land. */
  private drawMoving() {
    const s = this.state;
    const m = s.moving;
    const show = s.phase === 'swinging' || s.phase === 'falling';
    this.moving.setVisible(show);
    this.guide.clear();
    if (!show) return;
    const key = `${m.w}|${s.tier}|${m.kind}|${m.material}`;
    if (key !== this.movingKey) {
      this.movingKey = key;
      this.moving.clear();
      drawStone(this.moving, m.w, s.tier, false, m.kind, m.material);
    }
    const y = this.worldY(m.h);
    this.moving.setPosition(m.x, y);
    // A gust shows as streaks blowing past the stone, longer the stronger it is.
    if (s.wind) {
      const side = Math.sign(s.wind);
      const len = 10 + Math.abs(s.wind) / 4;
      this.guide.fillStyle(0xbfe4f4, 0.6);
      for (const [dy, off] of [[-22, 0], [-14, 14], [-6, 4]] as const) {
        const x0 = m.x - side * (m.w / 2 + 12 + off) - (side > 0 ? len : 0);
        this.guide.fillRect(Math.round(x0), Math.round(y + dy), Math.round(len), 2);
      }
    }
    // Dimness hides the drop guide.
    if (curseNow(s) === 'dim') return;
    const top = this.worldY(stackHeight(s));
    this.guide.fillStyle(0xf3e9d2, 0.35);
    for (let gy = y + 6; gy < top - 2; gy += 10) this.guide.fillRect(Math.round(m.x) - 1, gy, 2, 5);
  }

  private refresh() {
    const s = this.state;
    this.tierText.setText(s.endless ? t('tierSky', { tier: s.tier }) : t('tier', { tier: Math.min(s.tier, GOAL_TIER) }));
    this.pips.clear();
    for (let i = 0; i < STONES_PER_TIER; i++) {
      const x = PANEL.x + 16 + i * 30;
      this.pips.fillStyle(OUTLINE).fillRect(x, PANEL.y + 82, 24, 14);
      this.pips.fillStyle(i < s.inTier ? (s.wobbly ? 0xb08a6a : TIER_COLORS[(s.tier - 1) % TIER_COLORS.length]) : 0x3a3052).fillRect(x + 2, PANEL.y + 84, 20, 10);
    }
    this.goalPips.clear();
    for (let t = 1; t <= GOAL_TIER; t++) {
      const x = PANEL.x + 18 + (t - 1) * (GOAL.pip + GOAL.gap);
      const y = PANEL.y + GOAL.y + 30;
      const built = t <= s.tiersBuilt;
      this.goalPips.fillStyle(built ? tierColor(t) : 0x3a3052).fillRect(x, y, GOAL.pip, GOAL.pip);
      if (t === GILDED_TIER) this.goalPips.lineStyle(2, GILT).strokeRect(x - 1, y - 1, GOAL.pip + 2, GOAL.pip + 2);
      if (t === s.tier && s.phase !== 'crowned') this.goalPips.fillStyle(0xf3e9d2).fillRect(x, y + GOAL.pip + 2, GOAL.pip, 2);
    }
    if (s.endless) setFitted(this.goalNote.setColor('#bfe4f4'), t('altarGoal', { tier: nextAltar(s.tier), mult: ALTAR_MULT }), PANEL_TEXT_W, 12);
    else this.goalNote.setText(t('gildedGoal', { tier: GILDED_TIER, mult: GILDED_MULT }));
    this.favorText.setText(t('favour', { n: s.favor }));
    this.builtText.setText(t('built', { built: s.tiersBuilt, best: s.best }));
    const next = KIND_INFO[s.nextKind];
    this.nextText.setText(t('next', { kind: t(next.name) })).setColor(next.color);
    const trial = s.trial;
    this.trialText
      .setText(
        trial
          ? trial.failed
            ? t('trialFailed', { trial: t(TRIAL_INFO[trial.id].short) })
            : t('trial', { trial: t(TRIAL_INFO[trial.id].short), done: trial.done, of: STONES_PER_TIER })
          : t('trialsFrom', { tier: TRIALS_FROM_TIER }),
      )
      .setColor(trial && !trial.failed ? '#9ad46a' : '#8a7ea0');
    const curse = curseNow(s);
    // With a curse in force the material shows by name only, after it, so the line fits the panel.
    const materialName = s.material !== 'limestone' ? t(MATERIAL_INFO[s.material].name) : '';
    const curseLine = curse
      ? [t('curse', { curse: t(CURSE_INFO[curse].name), mult: CURSE_MULT }), materialName].filter(Boolean).join(' · ')
      : materialName && t('materialTier', { material: materialName });
    setFitted(this.curseText, curseLine, PANEL_TEXT_W, 13);
    setFitted(this.patronText, s.patron ? t('patron', { patron: t(PATRON_INFO[s.patron].name) }) : t('choosePatron'), PANEL_TEXT_W, 12);
    const reserveOn = s.tier >= RESERVE_FROM_TIER;
    this.reserveText
      .setText(reserveOn ? (s.reserve ? t('hold', { kind: t(KIND_INFO[s.reserve].short) }) : t('holdNothing')) : t('reserveFrom', { tier: RESERVE_FROM_TIER }))
      .setColor(reserveOn ? '#d8cbe8' : '#8a7ea0');
    const swappable = canSwap(s);
    for (const part of this.reserveParts) part.setVisible(reserveOn).setAlpha(swappable ? 1 : 0.4);
    this.reserveButton = swappable ? { ...RESERVE_BUTTON } : null;
    this.drawLean();
    const playing = s.phase === 'swinging' || s.phase === 'falling';
    this.windText.setText(gusty(s) && playing ? (s.wind ? t('gust', { arrows: s.wind > 0 ? '>>>' : '<<<', n: Math.abs(s.wind) }) : t('calmAir')) : '');
    const counts = BLESSINGS.filter((b) => s.blessings.includes(b)).map((b) => {
      const n = s.blessings.filter((x) => x === b).length;
      const name = n > 1 ? t('blessingCount', { blessing: t(BLESSING_INFO[b].name), n }) : t(BLESSING_INFO[b].name);
      return b === 'grace' && s.grace ? t('graceHeld', { blessing: name, n: s.grace }) : name;
    });
    if (s.grace && !s.blessings.includes('grace')) counts.push(t('graceBought', { n: s.grace }));
    setFitted(this.blessingsText, counts.length ? counts : [t('noBlessings')], PANEL_TEXT_W, 12);
    // The hint shows until the first drop, while the temple is still too short to reach it.
    this.hint.setVisible(s.dropped === 0 && s.phase === 'swinging');

    const offerKey = s.phase === 'blessing' ? `break:${s.offer.join(',')}:${s.material}` : '';
    if (offerKey !== this.offerKey) {
      this.offerKey = offerKey;
      this.buildOffer();
    }
    if ((s.phase === 'patron') !== this.patronShown) {
      this.patronShown = s.phase === 'patron';
      this.buildPatrons();
    }

    const ended = s.phase === 'over' || (s.phase === 'crowned' && this.crownedMs >= CROWN_MS);
    const crowned = s.phase === 'crowned';
    for (const part of this.gameOver) part.setVisible(ended);
    for (const part of this.againButton) part.setVisible(ended && !crowned);
    for (const part of [...this.againBeside, ...this.keepBuildingButton]) part.setVisible(ended && crowned);
    this.keepButton = crowned && ended ? { x: this.vw / 2 + 115, y: this.vh / 2 + 80, w: 200, h: 40 } : null;
    if (s.phase === 'over' && s.endless) {
      this.gameOverTitle.setText(t('fallen'));
      this.gameOverText.setText(`${t('fallenSky', { tiers: s.tiersBuilt, favour: s.favor })}\n\n${t('bestTiers', { n: s.best })}`);
    } else if (s.phase === 'over') {
      this.gameOverTitle.setText(t('fallen'));
      this.gameOverText.setText(
        `${t('fallenStood', { n: s.tiersBuilt, balanced: s.balancedTiers, favour: s.favor })}\n\n${t('bestTiers', { n: s.best })}`,
      );
    } else if (s.phase === 'crowned') {
      this.gameOverTitle.setText(t('crowned'));
      this.gameOverText.setText(t('crownedText', { tiers: GOAL_TIER, balanced: s.balancedTiers, favour: s.favor }));
    }
  }

  /** The break between tiers: the blessing cards (or, after a wobbly tier, "Build on"), the curse and the shop. */
  private buildOffer() {
    for (const part of this.offerParts) part.destroy();
    this.offerParts = [];
    this.blessingCards = [];
    this.rerollButton = null;
    this.shopButtons = [];
    this.curseToggle = null;
    this.buildOnButton = null;
    this.materialButtons = [];
    const s = this.state;
    if (s.phase !== 'blessing') return;
    const dim = this.add.rectangle(this.vw / 2, this.vh / 2, this.vw, this.vh, 0x0c0916, 0.55).setInteractive();
    this.addOffer(dim);
    this.fillOffer();
    // Laid out for the designed frame: move it, and the spots the test reads, to where the frame sits.
    for (const part of this.offerParts) if (part !== dim) part.setPosition(part.x + this.fx, part.y + this.fy);
    for (const spot of [...this.blessingCards, this.rerollButton, ...this.shopButtons, this.curseToggle, this.buildOnButton, ...this.materialButtons]) {
      if (spot) Object.assign(spot, { x: spot.x + this.fx, y: spot.y + this.fy });
    }
  }

  /** The break's parts, laid out in the designed 960x540 frame. */
  private fillOffer() {
    const s = this.state;
    this.addOffer(...this.makeShop());
    if (canPickMaterial(s)) this.addOffer(...this.makeMaterials());
    if (!s.offer.length) {
      const sky = s.endless && s.tier === GOAL_TIER + 1;
      const text = sky ? t('skyPick') : t('wobbly', { tier: s.tier - 1 });
      const title = this.add.text(OFFER_TITLE.x + 70, OFFER_TITLE.y, text, textStyle(20, '#d8cbe8')).setOrigin(0.5);
      this.addOffer(title, ...this.makeBuildOn());
      return;
    }
    const done = s.tier - 1;
    const title = setFitted(
      this.add.text(OFFER_TITLE.x, OFFER_TITLE.y, '', textStyle(20, isAltar(done) ? '#bfe4f4' : '#f3c64e')).setOrigin(0.5),
      isAltar(done) ? t('altarBlessing', { tier: done }) : t('balanced', { tier: done }),
      2 * (REROLL.x - REROLL.w / 2 - OFFER_TITLE.x) - 16,
      20,
    );
    this.addOffer(title, ...this.makeReroll());
    if (s.curseOffer) this.addOffer(...this.makeCurse());
    const cards = s.offer.length > CARDS.xs.length ? CARDS_FOUR : CARDS;
    s.offer.forEach((id, i) => {
      const info = BLESSING_INFO[id];
      const x = cards.xs[i];
      const { y, w, h } = cards;
      const bg = this.add.rectangle(x, y, w, h, 0x2c2446).setStrokeStyle(3, 0x6a5a9a);
      const icon = this.add.graphics().setPosition(x, y - 50);
      this.drawBlessingIcon(icon, id, info.color);
      const size = w < 200 ? 15 : 17;
      const name = setFitted(this.add.text(x, y + 6, '', textStyle(size, '#f3c64e')).setOrigin(0.5), t(info.name), w - 16, size);
      const text = this.add
        .text(x, y + 30, t(info.text), { fontFamily: FONT, fontSize: '13px', color: '#e8dcf4', align: 'center', wordWrap: { width: w - 24 }, lineSpacing: 3 })
        .setOrigin(0.5, 0);
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => bg.setStrokeStyle(3, GOLD))
        .on('pointerout', () => bg.setStrokeStyle(3, 0x6a5a9a))
        .on('pointerdown', () => {
          const cursed = this.state.cursed ? this.state.curseOffer : null;
          if (chooseBlessing(this.state, id)) this.onChosen(id, cursed);
        });
      this.addOffer(bg, icon, name, text);
      this.blessingCards.push({ id, x, y, w, h });
    });
  }

  /** Adds parts to the break's layer, fixed on screen above the temple. */
  private addOffer(...parts: UiPart[]) {
    for (const part of parts) this.offerParts.push(part.setScrollFactor(0).setDepth(UI_DEPTH + 10));
  }

  /** The button that spends favor on three new blessings, dimmed when there isn't enough. */
  private makeReroll() {
    const { x, y, w, h } = REROLL;
    const afford = canReroll(this.state);
    const bg = this.add.rectangle(0, 0, w, h, 0x2c2446).setStrokeStyle(3, afford ? GOLD : 0x4a3a6a);
    const coin = this.add.graphics();
    coin.fillStyle(GOLD).fillCircle(-w / 2 + 20, 0, 10);
    coin.fillStyle(shade(GOLD, -0.35)).fillCircle(-w / 2 + 20, 0, 6);
    coin.fillStyle(GOLD).fillRect(-w / 2 + 19, -4, 2, 8);
    const label = this.add.text(-w / 2 + 38, 0, t('reroll'), textStyle(17)).setOrigin(0, 0.5);
    const cost = this.add.text(w / 2 - 12, 0, String(REROLL_COST), textStyle(17, '#f3c64e')).setOrigin(1, 0.5);
    const button = place([bg, coin, label, cost], x, y, afford ? 1 : 0.5);
    bg.setInteractive({ useHandCursor: afford })
      .on('pointerover', () => afford && bg.setFillStyle(0x3a3060))
      .on('pointerout', () => bg.setFillStyle(0x2c2446))
      .on('pointerdown', () => (reroll(this.state) ? this.rebuildOffer() : ui('refuse')));
    this.rerollButton = { x, y, w, h };
    return button;
  }

  /** The shop's row: one button per item, dimmed when it can't be bought, marked once bought. */
  private makeShop() {
    const s = this.state;
    const title = this.add.text(SHOP_TITLE.x, SHOP_TITLE.y, t('spendFavour', { n: s.favor }), textStyle(14, '#d8cbe8')).setOrigin(0.5);
    const parts: UiPart[] = [title];
    const items = shopFor(s);
    items.forEach((id, i) => {
      const info = SHOP_INFO[id];
      const { y, w, h } = SHOP_ROW;
      // Three buttons sit on the row's spots; two are centred under the title.
      const x = items.length === SHOP_ROW.xs.length ? SHOP_ROW.xs[i] : SHOP_TITLE.x + (i - (items.length - 1) / 2) * (w + 18);
      const bought = s.bought.includes(id);
      const afford = canBuy(s, id);
      const bg = this.add.rectangle(0, 0, w, h, bought ? 0x3a3060 : 0x2c2446).setStrokeStyle(3, bought ? GOLD : afford ? info.color : 0x4a3a6a);
      const icon = this.add.graphics();
      this.drawShopIcon(icon, id, -w / 2 + 20, info.color);
      const cost = this.add.text(w / 2 - 10, 0, bought ? t('bought') : String(info.cost), textStyle(15, '#f3c64e')).setOrigin(1, 0.5);
      // The name fits between the icon and the price.
      const label = setFitted(this.add.text(-w / 2 + 38, 0, '', textStyle(14)).setOrigin(0, 0.5), t(info.name), w - 54 - cost.width, 14);
      const button = place([bg, icon, label, cost], x, y, afford || bought ? 1 : 0.5);
      bg.setInteractive({ useHandCursor: afford })
        .on('pointerover', () => afford && bg.setFillStyle(0x3a3060))
        .on('pointerout', () => !bought && bg.setFillStyle(0x2c2446))
        .on('pointerdown', () => (buy(this.state, id) ? this.rebuildOffer() : ui('refuse')));
      parts.push(...button);
      this.shopButtons.push({ id, x, y, w, h });
    });
    return parts;
  }

  /** A small emblem for a shop item at (x, 0). */
  private drawShopIcon(g: Phaser.GameObjects.Graphics, id: ShopId, x: number, color: number) {
    g.fillStyle(color);
    if (id === 'slow') {
      // An hourglass.
      g.fillTriangle(x - 7, -9, x + 7, -9, x, 0).fillTriangle(x - 7, 9, x + 7, 9, x, 0);
      g.fillRect(x - 8, -11, 16, 2).fillRect(x - 8, 9, 16, 2);
    } else if (id === 'wider') {
      g.fillRect(x - 7, -4, 14, 8);
      g.fillTriangle(x - 12, 0, x - 7, -5, x - 7, 5).fillTriangle(x + 12, 0, x + 7, -5, x + 7, 5);
    } else {
      g.fillEllipse(x - 5, 2, 9, 16).fillEllipse(x + 5, 2, 9, 16);
    }
  }

  /** The row that picks the next tier's material: the chosen one lit, tapped again to go back to limestone. */
  private makeMaterials() {
    const s = this.state;
    const title = this.add
      .text(MATERIAL_TITLE.x, MATERIAL_TITLE.y, t('stoneFor', { tier: s.tier, material: t(MATERIAL_INFO[s.material].name) }), { fontFamily: FONT, fontSize: '12px', color: '#d8cbe8' })
      .setOrigin(0.5);
    const parts: UiPart[] = [title];
    MATERIAL_PICKS.forEach((id, i) => {
      const info = MATERIAL_INFO[id];
      const { y, w, h } = MATERIAL_ROW;
      const x = MATERIAL_ROW.xs[i];
      const picked = s.material === id;
      const bg = this.add.rectangle(0, 0, w, h, picked ? 0x3a3060 : 0x2c2446).setStrokeStyle(3, picked ? GOLD : info.color);
      const swatch = this.add.graphics();
      swatch.fillStyle(OUTLINE).fillRect(-w / 2 + 9, -8, 22, 16);
      swatch.fillStyle(info.color).fillRect(-w / 2 + 10, -7, 20, 14);
      swatch.fillStyle(shade(info.color, 0.3)).fillRect(-w / 2 + 10, -7, 20, 2);
      const name = this.add.text(-w / 2 + 38, -8, t(info.name), textStyle(14, picked ? '#f3c64e' : '#f3e9d2')).setOrigin(0, 0.5);
      const text = this.add.text(-w / 2 + 38, 7, t(info.short), { fontFamily: FONT, fontSize: '11px', color: '#d8cbe8' }).setOrigin(0, 0.5);
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => bg.setFillStyle(0x3a3060))
        .on('pointerout', () => !picked && bg.setFillStyle(0x2c2446))
        .on('pointerdown', () => {
          if (!chooseMaterial(this.state, id)) return;
          sfx('stone');
          this.rebuildOffer();
        });
      parts.push(...place([bg, swatch, name, text], x, y));
      this.materialButtons.push({ id, x, y, w, h });
    });
    return parts;
  }

  /** Before the first stone: the two patrons on offer, each a card with its boon and its bane. */
  private buildPatrons() {
    for (const part of this.patronParts) part.destroy();
    this.patronParts = [];
    this.patronCards = [];
    const s = this.state;
    if (s.phase !== 'patron') return;
    const dim = this.add.rectangle(this.vw / 2, this.vh / 2, this.vw, this.vh, 0x0c0916, 0.55).setInteractive();
    const title = this.add.text(PATRON_TITLE.x, PATRON_TITLE.y, t('patronTitle'), textStyle(22, '#f3c64e')).setOrigin(0.5);
    const sub = this.add.text(PATRON_TITLE.x, PATRON_TITLE.y + 30, t('patronSub'), textStyle(14, '#d8cbe8')).setOrigin(0.5);
    const parts: UiPart[] = [dim, title, sub];
    s.patronOffer.forEach((id, i) => {
      const info = PATRON_INFO[id];
      const x = PATRON_CARDS.xs[i];
      const { y, w, h } = PATRON_CARDS;
      const bg = this.add.rectangle(x, y, w, h, 0x2c2446).setStrokeStyle(3, 0x6a5a9a);
      const icon = this.add.graphics().setPosition(x, y - 56);
      this.drawPatronIcon(icon, id, info.color);
      const name = this.add.text(x, y - 4, t(info.name), textStyle(16, '#f3c64e')).setOrigin(0.5);
      const style = (color: string) => ({ fontFamily: FONT, fontSize: '12px', color, align: 'center', wordWrap: { width: w - 24 }, lineSpacing: 2 });
      const boon = this.add.text(x, y + 16, t(info.boon), style('#9ad46a')).setOrigin(0.5, 0);
      const bane = this.add.text(x, y + 54, t(info.bane), style('#e8a0d4')).setOrigin(0.5, 0);
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => bg.setStrokeStyle(3, GOLD))
        .on('pointerout', () => bg.setStrokeStyle(3, 0x6a5a9a))
        .on('pointerdown', () => choosePatron(this.state, id));
      parts.push(bg, icon, name, boon, bane);
      this.patronCards.push({ id, x: x + this.fx, y: y + this.fy, w, h });
    });
    for (const part of parts) {
      if (part !== dim) part.setPosition(part.x + this.fx, part.y + this.fy);
      this.patronParts.push(part.setScrollFactor(0).setDepth(UI_DEPTH + 10));
    }
  }

  /** A small emblem for each patron, centred on the graphics' origin. */
  private drawPatronIcon(g: Phaser.GameObjects.Graphics, id: PatronId, color: number) {
    g.fillStyle(color, 0.2).fillCircle(0, 0, 30);
    g.lineStyle(2, color).strokeCircle(0, 0, 30);
    g.fillStyle(color);
    switch (id) {
      case 'gilded':
        // An open hand: a palm and four fingers.
        g.fillRect(-12, -2, 24, 16);
        for (const fx of [-12, -5, 2, 9]) g.fillRect(fx, -18, 5, 18);
        break;
      case 'hands':
        // Four hands reaching in from the sides.
        for (const [dx, dy] of [[-18, -8], [18, -8], [-18, 8], [18, 8]] as const) g.fillRect(dx - 6, dy - 3, 12, 6);
        g.fillCircle(0, 0, 7);
        break;
      case 'patient':
        // An hourglass, sand settled at the bottom.
        g.fillRect(-12, -18, 24, 3).fillRect(-12, 15, 24, 3);
        g.fillTriangle(-9, 14, 9, 14, 0, 2);
        g.lineStyle(2, color).lineBetween(-9, -15, 0, 0).lineBetween(9, -15, 0, 0);
        break;
      case 'storm':
        // A gust: three streaks and a swirl.
        for (const [y, w] of [[-10, 36], [2, 26], [12, 30]] as const) g.fillRect(-w / 2 - 2, y - 2, w, 4);
        g.lineStyle(3, color).strokeCircle(16, -8, 5);
        break;
    }
  }

  /** The toggle that takes a curse along with the blessing, for double favor on the next tier. */
  private makeCurse() {
    const s = this.state;
    const info = CURSE_INFO[s.curseOffer!];
    const { x, y, w, h } = CURSE;
    const bg = this.add.rectangle(0, 0, w, h, s.cursed ? 0x4a2446 : 0x2c2446).setStrokeStyle(3, s.cursed ? CURSE_COLOR : 0x6a5a9a);
    const box = this.add.graphics();
    const bx = -w / 2 + 22;
    box.fillStyle(OUTLINE).fillRect(bx - 9, -9, 18, 18);
    box.fillStyle(s.cursed ? CURSE_COLOR : 0x3a3052).fillRect(bx - 7, -7, 14, 14);
    if (s.cursed) {
      // A tick, drawn as two strokes.
      box.lineStyle(3, 0xf3e9d2).lineBetween(bx - 4, 0, bx - 1, 4).lineBetween(bx - 1, 4, bx + 5, -4);
    }
    const label = setFitted(
      this.add.text(bx + 18, 0, '', textStyle(14, '#e8a0d4')).setOrigin(0, 0.5),
      t('takeCurse', { tier: s.tier, curse: t(info.name), text: t(info.text), mult: CURSE_MULT }),
      w / 2 - 12 - (bx + 18),
      14,
    );
    const button = place([bg, box, label], x, y);
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (!toggleCurse(this.state)) return;
      if (this.state.cursed) sfx('pluck');
      else ui('click');
      this.rebuildOffer();
    });
    this.curseToggle = { x, y, w, h };
    return button;
  }

  /** After a wobbly tier: the button that goes back to stacking. */
  private makeBuildOn() {
    const { x, y, w, h } = BUILD_ON;
    const bg = this.add.rectangle(0, 0, w, h, 0x4a3a6a).setStrokeStyle(3, GOLD);
    const label = this.add.text(0, 0, t('buildOn'), textStyle(20)).setOrigin(0.5);
    bg.setInteractive({ useHandCursor: true })
      .on('pointerover', () => bg.setFillStyle(0x6a5a9a))
      .on('pointerout', () => bg.setFillStyle(0x4a3a6a))
      .on('pointerdown', () => {
        if (!buildOn(this.state)) return;
        sfx('rise');
        const notice = this.tierNotice();
        if (notice) this.announce(notice);
      });
    this.buildOnButton = { x, y, w, h };
    return place([bg, label], x, y);
  }

  /**
   * Has `refresh` rebuild the break's layer on the next frame after a reroll, a buy or the curse
   * toggle, and not while the tapped button is still handling its tap.
   */
  private rebuildOffer() {
    this.offerKey = '#';
  }

  /** Redraws the top stone after it grew (Broad Stones, a wider stone), with its lanterns if it has them. */
  private redrawTop() {
    const i = this.state.stones.length - 1;
    const top = this.state.stones[i];
    this.stoneViews[i].clear();
    drawStone(this.stoneViews[i], top.w, top.tier, top.perfect, top.kind, top.material);
    this.glow(top.x, this.worldY(i * STONE_H), top.w);
    if (this.ornaments.has(top.tier) && i === top.tier * STONES_PER_TIER - 1) this.ornament(top.tier);
  }

  private onChosen(id: BlessingId, cursed: string | null) {
    sfx('choir');
    if (id === 'broad') this.redrawTop();
    const tier = this.state.tier;
    const special = tier === GILDED_TIER ? t('gildedTierFavour', { tier, mult: GILDED_MULT }) : isAltar(tier) ? t('altarTierFavour', { tier, mult: ALTAR_MULT }) : '';
    const curse = cursed ? t('cursedWith', { curse: t(CURSE_INFO[this.state.curse!.id].name), mult: CURSE_MULT }) : null;
    this.announce([t('blessingYours', { blessing: t(BLESSING_INFO[id].name) }), curse ?? special].filter(Boolean));
  }

  /** The banner for a tier that starts after a break with no blessing: the gilded tier or a sky altar. */
  private tierNotice() {
    const tier = this.state.tier;
    if (tier === GILDED_TIER) return [t('gildedTier', { tier }), t('gildedFavour', { mult: GILDED_MULT })];
    if (isAltar(tier)) return [t('altarTier', { tier }), t('altarFavour', { mult: ALTAR_MULT })];
    return null;
  }

  /** Past the crown: the crown comes off so the temple can climb on. */
  private onKeepBuilding() {
    this.crown?.destroy();
    this.crown = null;
    this.announce([t('intoSky'), t('mindGusts')]);
  }

  /** A small emblem for each blessing, centred on the graphics' origin. */
  private drawBlessingIcon(g: Phaser.GameObjects.Graphics, id: BlessingId, color: number) {
    g.fillStyle(color, 0.2).fillCircle(0, 0, 36);
    g.lineStyle(2, color).strokeCircle(0, 0, 36);
    g.fillStyle(color);
    switch (id) {
      case 'broad':
        g.fillRect(-26, -6, 52, 14);
        g.fillTriangle(-34, 1, -26, -7, -26, 9).fillTriangle(34, 1, 26, -7, 26, 9);
        break;
      case 'calm':
        for (const [y, w] of [[-12, 40], [0, 30], [12, 36]] as const) g.fillRect(-w / 2, y - 2, w, 4);
        g.fillCircle(18, -12, 4);
        break;
      case 'steady':
        g.fillRect(-14, 6, 28, 12);
        g.fillTriangle(-10, -22, 10, -22, 0, 2);
        break;
      case 'golden':
        g.fillCircle(0, 0, 16);
        g.fillStyle(shade(color, -0.35)).fillCircle(0, 0, 10);
        g.fillStyle(color).fillRect(-2, -7, 4, 14);
        break;
      case 'grace':
        g.fillEllipse(-12, 4, 18, 28).fillEllipse(12, 4, 18, 28);
        g.fillStyle(0x2c2446).fillRect(-22, -22, 44, 14);
        g.fillStyle(color).fillRect(-12, -14, 24, 8);
        break;
    }
    if (settings.reduceMotion) return;
    this.tweens.add({ targets: g, scale: 1.06, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
}
