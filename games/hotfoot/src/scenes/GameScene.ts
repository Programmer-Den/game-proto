import Phaser from 'phaser';
import { viewPoint } from '../../../../shared/scaling';
import { formatDate, formatNumber } from '../../../../shared/i18n';
import { ui } from '../../../../shared/audio';
import { settings } from '../../../../shared/settings';
import { SoundCues } from '../audio/cues';
import { sfx } from '../audio/sound';
import { BOSS_ART, GOBLIN_ART } from '../art/foes';
import { bakePanel } from '../art/hud';
import { armouryIcon } from '../art/icons';
import { C, N, tileAt } from '../art/ink';
import { KNIGHT_FEET, type KnightPose } from '../art/knight';
import { FAR_H, GROUND_TOP, NEAR_H } from '../art/scenery';
import { ARMOURY, ARMOURY_IDS, nextPrice, type ArmouryId } from '../game/armoury';
import { MISSILES, bossOf, bossStands } from '../game/boss';
import { BOONS, forSale, type BoonId } from '../game/boons';
import { PAIRS, pairsOf } from '../game/pairs';
import { loadProgress, saveProgress, type Progress } from '../game/save';
import { buyArmoury, buyMissed, jump, newRun, pick, pickRoad, slide, tick } from '../game/sim';
import {
  BOON_PRICE,
  LEAD_IN,
  ROADS,
  ROCK,
  TERRAIN,
  RUNNER,
  SHRINE,
  STREAK,
  DARE_TEXT,
  flameOf,
  floorAt,
  metres,
  stats,
  streakMax,
  streakMult,
  today,
  trackOf,
  type Dare,
  type Effect,
  type GameState,
  type Road,
  type Shrine,
  type Trap,
} from '../game/state';
import { t, type TextKey } from '../i18n';
import { BoonCards } from '../ui/BoonCards';
import { makeButton } from '../ui/Button';
import { ACTION_BUTTONS, ARMOURY_PANEL, DARE_TAG, FONT, FRAME, GROUND_Y, HUD_SHIFT, MARGIN, RUNNER_X, STAGE_TITLE, STREAK_CHIP, TAG, TAP_SPLIT_Y, TRACK, UI_DEPTH, VIEW } from './layout';
import { checkTrophies } from '../trophies/check';

/** Longest simulated step, so a backgrounded tab doesn't jump the run forward. */
const MAX_STEP_MS = 100;
/** Distance covered per frame of the running animation. */
const STRIDE_PX = 22;
/** How far into the first stage the controls hint shows. */
const HINT_UNTIL = 640;
/** The sparkle trail behind the knight on a streak: how many stars, and how often one is laid. */
const TRAIL = { stars: 7, everyMs: 45 };
/** How far into a stage its title shows, fading over the last 200 px. */
const TITLE_UNTIL = LEAD_IN;
/** The weather over the frozen pass and the windy pass: snowflakes and gust streaks. */
const WEATHER = { flakes: 26, gusts: 9 };
/** The rockfall's boulders, from the front: each one's size (as a share of the texture) and how far behind the leading edge it rolls. */
const BOULDERS = [
  { scale: 1, back: 0 },
  { scale: 0.7, back: 62 },
  { scale: 0.85, back: 110 },
  { scale: 0.6, back: 168 },
];

/** A daily course's date for the panel: "14 Oct" ("Oct 14" in US English, "14. Okt." in German). */
const dayName = (date: string) => {
  const [y, m, d] = date.split('-').map(Number);
  return formatDate(new Date(y, m - 1, d), { day: 'numeric', month: 'short' });
};

/** The words over the road of a pop, a shrine's heart or a shrine's refusal. */
const wordsOf = (e: Effect) => (e.kind === 'heal' ? t('healPop') : e.text ? t(e.text, { n: e.n ?? 0 }) : '');

/** A dare in the herald's words: "Stomp 2 foes". */
const dareText = (d: Dare) => t(DARE_TEXT[d.kind], { n: d.goal });

const textStyle = (size: number, color: string = C.goldPale, stroke = 3): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  fontStyle: 'bold',
  color,
  stroke: C.ink,
  strokeThickness: stroke,
});

/** A shrine's sprite and its banderole label. */
interface ShrineArt {
  image: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Container;
}

export class GameScene extends Phaser.Scene {
  /** The run being played; read by the playthrough test. */
  state!: GameState;
  /** The boon cards at a checkpoint; the playthrough test reads where they are to tap one. */
  boonCards!: BoonCards;
  private traps = new Map<number, Phaser.GameObjects.Image>();
  private coins = new Map<number, Phaser.GameObjects.Image>();
  private ledges = new Map<number, Phaser.GameObjects.TileSprite>();
  private shrines = new Map<number, ShrineArt>();
  /** Words over the road: coin pops, a shrine's heart and its refusals, by effect id. */
  private words = new Map<number, Phaser.GameObjects.Text>();
  /** The inked ends and arched doors of the ledges, redrawn every frame. */
  private ledgeSides!: Phaser.GameObjects.Graphics;
  private far!: Phaser.GameObjects.TileSprite;
  private near!: Phaser.GameObjects.TileSprite;
  private ground!: Phaser.GameObjects.TileSprite;
  private knight!: Phaser.GameObjects.Image;
  private flag!: Phaser.GameObjects.Image;
  private fx!: Phaser.GameObjects.Graphics;
  /** Points along the course the knight passed on a streak, newest first, for the sparkle trail. */
  private trail: { x: number; h: number }[] = [];
  private trailAt = 0;
  private hud!: Phaser.GameObjects.Graphics;
  private hearts: Phaser.GameObjects.Image[] = [];
  private stageText!: Phaser.GameObjects.Text;
  private distText!: Phaser.GameObjects.Text;
  private coinText!: Phaser.GameObjects.Text;
  private coinsLabel!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private medalText!: Phaser.GameObjects.Text;
  private streakText!: Phaser.GameObjects.Text;
  private streakNext!: Phaser.GameObjects.Text;
  private trackNext!: Phaser.GameObjects.Text;
  private trackBest!: Phaser.GameObjects.Text;
  private caption!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Container;
  /** The round Slide and Jump buttons, shown while running on a touch screen. */
  private actionButtons!: Phaser.GameObjects.Container;
  private touchScreen = false;
  private gameOver!: Phaser.GameObjects.Container;
  private gameOverText!: Phaser.GameObjects.Text;
  private shopText!: Phaser.GameObjects.Text;
  private buyButton!: Phaser.GameObjects.Container;
  /** The boss's sprite (the Gatekeeper or the dragon), shown on its stage. */
  private boss!: Phaser.GameObjects.Image;
  /** The rockfall's boulders, shown on a rockfall stage. */
  private rocks: Phaser.GameObjects.Image[] = [];
  /** Snow and wind drawn over the stage's ground. */
  private weather!: Phaser.GameObjects.Graphics;
  private tagText!: Phaser.GameObjects.Text;
  private dareTag!: Phaser.GameObjects.Image;
  private dareText!: Phaser.GameObjects.Text;
  private title!: Phaser.GameObjects.Container;
  private titleName!: Phaser.GameObjects.Text;
  private titleRule!: Phaser.GameObjects.Text;
  private armouryButton!: Phaser.GameObjects.Container;
  private armouryPanel!: Phaser.GameObjects.Container;
  private armouryBank!: Phaser.GameObjects.Text;
  private armouryRows: { id: ArmouryId; level: Phaser.GameObjects.Text; buy: Phaser.GameObjects.Container; full: Phaser.GameObjects.Text }[] = [];
  /** What is saved between runs; the run's own numbers are copied into it by `persist`. */
  private progress!: Progress;
  /** Plays the run's sounds and music from what changed in it each frame. */
  private cues = new SoundCues();
  private clock = 0;
  private lastFrame: number | null = null;

  constructor() {
    super('Game');
  }

  create() {
    this.traps.clear();
    this.coins.clear();
    this.ledges.clear();
    this.shrines.clear();
    this.words.clear();
    this.progress = loadProgress();
    this.state = this.freshRun(null);
    this.persist();
    this.cues.reset(this.state);

    this.add.image(0, 0, 'page').setOrigin(0).setDepth(-10);
    this.add.image(FRAME.x, FRAME.y, 'sky').setOrigin(0).setDepth(-5);
    this.far = this.add.tileSprite(0, GROUND_Y - FAR_H, VIEW.w, FAR_H, 'far').setOrigin(0).setDepth(-4);
    this.near = this.add.tileSprite(0, GROUND_Y - NEAR_H, VIEW.w, NEAR_H, 'near').setOrigin(0).setDepth(-3);
    this.ground = this.add.tileSprite(0, GROUND_Y - GROUND_TOP, VIEW.w, GROUND_TOP + 13, 'ground').setOrigin(0).setDepth(1);
    this.ledgeSides = this.add.graphics().setDepth(1.6);
    this.flag = this.add.image(0, GROUND_Y + 2, 'checkpoint').setOrigin(8 / 48, 1).setDepth(3);
    this.boss = this.add.image(0, GROUND_Y + 2, 'gate-ready').setDepth(3.5).setVisible(false);
    this.rocks = BOULDERS.map((b) => this.add.image(0, GROUND_Y + 2 - (ROCK.r * b.scale) / 1, 'boulder').setScale(b.scale).setDepth(4.3).setVisible(false));
    this.weather = this.add.graphics().setDepth(4.4);
    this.add.image(0, 0, 'frame').setOrigin(0).setDepth(4.5);
    this.knight = this.add.image(RUNNER_X, GROUND_Y, 'knight-run0').setDepth(5);
    this.fx = this.add.graphics().setDepth(6);
    this.caption = this.add
      .text(MARGIN.captionX, MARGIN.captionY, '', { fontFamily: FONT, fontSize: '13px', fontStyle: 'italic', color: C.madder })
      .setOrigin(0.5, 0.5)
      .setDepth(0);
    this.createHud();
    this.createHint();
    this.createActionButtons();
    this.createTitle();
    this.createGameOver();
    this.createArmoury();
    this.boonCards = new BoonCards(
      this,
      (id) => this.pick(id),
      (road) => this.pickRoad(road),
    );

    // A tap in the top half of the screen jumps, in the bottom half slides. Taps on a card or a
    // button are theirs alone.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (p.wasTouch) this.touchScreen = true;
      if (over.length > 0) return;
      if (viewPoint(p).y < TAP_SPLIT_Y) jump(this.state);
      else slide(this.state);
    });
    const keys = this.input.keyboard;
    // A held key's auto-repeat is not another press: it would fire the Second Leap or keep the
    // knight sliding.
    const press = (act: (s: GameState) => void) => (e: KeyboardEvent) => {
      if (!e.repeat) act(this.state);
    };
    keys?.on('keydown-SPACE', press(jump));
    keys?.on('keydown-UP', press(jump));
    keys?.on('keydown-W', press(jump));
    keys?.on('keydown-DOWN', press(slide));
    keys?.on('keydown-S', press(slide));
    // Back from the shared pause, the first frame starts the clock again rather than catching up.
    this.events.on(Phaser.Scenes.Events.RESUME, () => (this.lastFrame = null));
  }

  update(time: number) {
    // Game time from the frame's own timestamp rather than Phaser's smoothed delta, which holds
    // every step to 16ms while the page is not in focus.
    const dt = this.lastFrame === null ? 0 : Phaser.Math.Clamp(time - this.lastFrame, 0, MAX_STEP_MS);
    this.lastFrame = time;
    const s = this.state;
    const phase = s.phase;
    tick(s, dt);
    checkTrophies(s);
    this.clock += dt;
    if (s.phase !== phase && s.phase !== 'running') this.persist();
    this.cues.update(s);

    this.drawWorld();
    this.drawBoss();
    this.drawRocks();
    this.drawWeather();
    this.drawKnight();
    this.drawEffects();
    this.drawHud();
    this.drawCaption();
    this.boonCards.show(s.phase === 'checkpoint' ? s.choices : null, s.phase === 'checkpoint' ? s.roads : null, s.ranks, s.stage);
    this.gameOver.setVisible(s.phase === 'over');
    if (s.phase === 'over') this.drawGameOver();
    else this.armouryPanel.setVisible(false);
  }

  /** A new run, ordinary or the daily course of `daily`, carrying over the bank, the bought boon and the armoury. */
  private freshRun(daily: string | null) {
    const p = this.progress;
    const best = daily ? (p.daily?.date === daily ? p.daily.best : 0) : p.best;
    return newRun({ best, bank: p.bank, pending: p.pending, armoury: p.armoury, crown: p.crown }, daily);
  }

  /** Copies the run's lasting numbers into the progress and saves it; a daily run keeps its own best. */
  private persist() {
    const s = this.state;
    const p = this.progress;
    if (s.daily) p.daily = { date: s.daily, best: s.best };
    else p.best = s.best;
    p.bank = s.bank;
    p.pending = s.pending;
    p.armoury = { ...s.armoury };
    p.crown = p.crown || s.crown;
    saveProgress(p);
  }

  /** The game-over panel: the run's result, the boon missed at the last checkpoint, and the shop. */
  private drawGameOver() {
    const s = this.state;
    const boons = (Object.entries(s.ranks) as [BoonId, number][]).map(([id, n]) => (n > 1 ? t('boonRanks', { boon: t(BOONS[id].name), n }) : t(BOONS[id].name)));
    const pairs = pairsOf(s.ranks).map((id) => t(PAIRS.find((p) => p.id === id)!.name));
    const missed = s.missed ? `\n${t('missed', { boon: t(BOONS[s.missed].name) })}` : '';
    const fell = [
      t('fellAt', { m: metres(s.distance), stage: s.stage, coins: s.coins, bank: s.bank }),
      s.bosses ? t('gatesBeaten', { n: s.bosses }) : '',
      s.dragonBeaten ? t('dragonDown') : '',
    ];
    const best = [s.daily ? t('bestDaily', { date: dayName(s.daily), n: s.best }) : t('bestRun', { n: s.best }), s.crown ? t('crowned') : ''];
    const join = (parts: string[]) => parts.filter(Boolean).join(' ');
    this.gameOverText.setText(
      `${join(fell)}\n${join(best)}\n\n` + `${t('boons', { boons: boons.length ? boons.join(', ') : t('boonsNone') })}${pairs.length ? ` (${pairs.join(', ')})` : ''}${missed}`,
    );
    const missedName = s.missed ? t(BOONS[s.missed].name) : '';
    let line: string;
    let canBuy = false;
    if (s.pending) line = t('shopPending', { boon: t(BOONS[s.pending].name) });
    else if (!s.missed) line = t(s.banners.length > 0 ? 'shopNoneLeft' : 'shopReach');
    else if (!forSale(s.missed)) line = t('shopNotForSale', { boon: missedName });
    else if (s.bank < BOON_PRICE) line = t('shopTooDear', { boon: missedName, price: BOON_PRICE, n: s.bank });
    else {
      line = t('shopBuy', { boon: missedName, price: BOON_PRICE });
      canBuy = true;
    }
    this.shopText.setText(line);
    this.buyButton.setVisible(canBuy);
    if (this.armouryPanel.visible) this.drawArmoury();
  }

  /** Screen x of a point on the course. */
  private sx(x: number) {
    return RUNNER_X + x - this.state.distance;
  }

  private drawWorld() {
    const s = this.state;
    const groundKey = s.terrain === 'road' ? 'ground' : `ground-${s.terrain}`;
    if (this.ground.texture.key !== groundKey) this.ground.setTexture(groundKey);
    tileAt(this.far, s.distance * 0.15);
    tileAt(this.near, s.distance * 0.4);
    tileAt(this.ground, s.distance);
    this.flag.setX(this.sx(s.checkpointX)).setVisible(this.sx(s.checkpointX) < VIEW.w + 80);

    const seen = new Set<number>();
    const sides = this.ledgeSides.clear();
    for (const l of s.ledges) {
      seen.add(l.id);
      let sprite = this.ledges.get(l.id);
      if (!sprite) {
        // The wall reaches a little below the road's top so it sits on the road.
        sprite = this.add.tileSprite(0, GROUND_Y - l.h, l.w, l.h + 10, 'ledge').setOrigin(0).setDepth(1.5);
        this.ledges.set(l.id, sprite);
      }
      const x = this.sx(l.x);
      tileAt(sprite.setX(x), l.x);
      // Inked ends, and an arched lapis door in a long wall.
      sides.lineStyle(1.5, N.ink).lineBetween(x, GROUND_Y - l.h, x, GROUND_Y + 10).lineBetween(x + l.w, GROUND_Y - l.h, x + l.w, GROUND_Y + 10);
      if (l.w >= 160 && l.h >= 40) {
        const d = x + 56;
        const door = [
          new Phaser.Math.Vector2(d, GROUND_Y + 2),
          new Phaser.Math.Vector2(d, GROUND_Y - 22),
          new Phaser.Math.Vector2(d + 9, GROUND_Y - 32),
          new Phaser.Math.Vector2(d + 18, GROUND_Y - 22),
          new Phaser.Math.Vector2(d + 18, GROUND_Y + 2),
        ];
        sides.fillStyle(N.lapis).fillPoints(door, true).lineStyle(1.25, N.ink).strokePoints(door, true);
      }
    }
    for (const [id, sprite] of this.ledges) {
      if (seen.has(id)) continue;
      sprite.destroy();
      this.ledges.delete(id);
    }

    seen.clear();
    for (const sh of s.shrines) {
      seen.add(sh.id);
      let art = this.shrines.get(sh.id);
      if (!art) {
        art = this.makeShrine();
        this.shrines.set(sh.id, art);
      }
      this.drawShrine(sh, art);
    }
    for (const [id, art] of this.shrines) {
      if (seen.has(id)) continue;
      art.image.destroy();
      art.label.destroy();
      this.shrines.delete(id);
    }

    seen.clear();
    for (const t of s.traps) {
      seen.add(t.id);
      let sprite = this.traps.get(t.id);
      if (!sprite) {
        if (t.kind === 'spikes') sprite = this.add.image(0, GROUND_Y - t.h + 2, `spikes-${t.w}`).setOrigin(0, 1).setDepth(4);
        else if (t.kind === 'pit') sprite = this.add.image(0, GROUND_Y - 2, `pit-${t.w}`).setOrigin(0, 0).setDepth(2);
        // The log hangs from above the screen, so it is lifted whole over raised ground.
        else if (t.kind === 'blade') sprite = this.add.image(0, -t.h, 'blade').setOrigin(0.5, 0).setDepth(4);
        else if (t.kind === 'flames') sprite = this.add.image(0, GROUND_Y - t.h + 2, 'flames-off').setOrigin(0, 1).setDepth(4);
        else if (t.kind === 'goblin') sprite = this.add.image(0, GROUND_Y - t.h, 'goblin-0').setOrigin(0.5, GOBLIN_ART.feetY / GOBLIN_ART.h).setDepth(4);
        else if (t.kind === 'barrel') sprite = this.add.image(0, GROUND_Y - t.h - 13, 'barrel').setDepth(4);
        else if (t.kind === 'axe') sprite = this.add.image(0, GROUND_Y - t.h - 9, 'axe').setDepth(4);
        else if (t.kind === 'fire') sprite = this.add.image(0, GROUND_Y - t.h + 2, 'fire-0').setOrigin(0.5, 1).setDepth(4);
        else if (t.kind === 'tail') sprite = this.add.image(0, GROUND_Y - t.h - 9, 'tail').setDepth(4);
        else sprite = this.add.image(0, 0, 'bat-0').setOrigin(0.5, 0.5).setDepth(4);
        this.traps.set(t.id, sprite);
      }
      this.drawTrap(t, sprite);
    }
    for (const [id, sprite] of this.traps) {
      if (seen.has(id)) continue;
      sprite.destroy();
      this.traps.delete(id);
    }

    seen.clear();
    for (const c of s.course) {
      seen.add(c.id);
      let sprite = this.coins.get(c.id);
      if (!sprite) {
        sprite = this.add.image(0, 0, 'coin-0').setDepth(4);
        this.coins.set(c.id, sprite);
      }
      // Coins turn, each a little out of step with the next.
      const spin = Math.floor(this.clock / 160 + c.id * 0.5) % 4 === 3 ? 'coin-1' : 'coin-0';
      sprite.setTexture(spin).setPosition(this.sx(c.x), GROUND_Y - c.h);
    }
    for (const [id, sprite] of this.coins) {
      if (seen.has(id)) continue;
      sprite.destroy();
      this.coins.delete(id);
    }
  }

  /** A shrine on the road and its banderole: "Wayside shrine / Slide in: 15 coins = 1 heart". */
  private makeShrine(): ShrineArt {
    const image = this.add.image(0, GROUND_Y + 2, 'shrine').setOrigin(0.5, 1).setDepth(3);
    const y = GROUND_Y - 150;
    const line = this.add.graphics();
    for (let dy = 22; dy < 150 - 80 - 8; dy += 5) line.lineStyle(1, N.ink).lineBetween(0, dy, 0, dy + 2.5);
    const scroll = this.add.image(0, 0, 'banderole');
    const title = this.add.text(0, -7, t('shrineName'), { fontFamily: FONT, fontSize: '13px', fontStyle: 'bold', color: '#2f7a4a' }).setOrigin(0.5);
    const rule = this.add.text(0, 8, t('shrineRule', { n: SHRINE.price }), { fontFamily: FONT, fontSize: '11.5px', fontStyle: 'italic', color: C.ink }).setOrigin(0.5);
    const label = this.add.container(0, y, [line, scroll, title, rule]).setDepth(4.2);
    return { image, label };
  }

  private drawShrine(sh: Shrine, art: ShrineArt) {
    const x = this.sx(sh.x + sh.w / 2);
    art.image.setX(x).setTexture(sh.used ? 'shrine-used' : 'shrine');
    art.label.setX(x).setVisible(!sh.used && x > -100 && x < VIEW.w + 100);
  }

  /** Places a trap's sprite, and animates the ones that move or burn. */
  private drawTrap(t: Trap, sprite: Phaser.GameObjects.Image) {
    if (t.kind === 'blade' || t.kind === 'goblin' || t.kind === 'bat' || MISSILES.includes(t.kind)) sprite.setX(this.sx(t.x + t.w / 2));
    else sprite.setX(this.sx(t.x));
    if (t.kind === 'flames') {
      const burn = flameOf(this.state, t);
      sprite.setTexture(burn === 'lit' ? `flames-lit${settings.reduceMotion ? 0 : Math.floor(this.clock / 90) % 2}` : `flames-${burn}`);
    } else if (t.kind === 'goblin') {
      // Steps in time with its walk, and faces the way it is going.
      const moving = t.vx !== 0 && this.state.phase === 'running';
      sprite.setTexture(`goblin-${moving ? Math.floor(t.x / 10) & 1 : 0}`).setFlipX(t.vx > 0);
    } else if (t.kind === 'bat') {
      // Flaps, bobbing a little; the bob is only for show, the bat's box stays put. Held still
      // with reduced motion.
      const flap = settings.reduceMotion ? 0 : Math.floor(this.clock / 110 + t.id) % 2;
      sprite.setTexture(`bat-${flap}`).setY(GROUND_Y - t.h - 10 + (settings.reduceMotion ? 0 : flap ? 2 : -2));
    } else if (t.kind === 'barrel') {
      // Rolls towards the knight: it turns by how far it has rolled.
      sprite.setRotation(t.x / 13);
    } else if (t.kind === 'axe') {
      sprite.setRotation(-t.x / 9);
    } else if (t.kind === 'fire') {
      // The fire flickers as it rolls (held still with reduced motion).
      sprite.setTexture(`fire-${settings.reduceMotion ? 0 : Math.floor(this.clock / 80) % 2}`);
    } else if (t.kind === 'tail') {
      // The tail lash whips a little up and down as it flies.
      sprite.setY(GROUND_Y - t.h - 9 + (settings.reduceMotion ? 0 : Math.sin(this.clock / 60) * 3));
    }
  }

  /** The boss: its pose by what it is doing, facing away as it flees, flashing after a stomp, felled once beaten. */
  private drawBoss() {
    const b = this.state.boss;
    this.boss.setVisible(!!b);
    if (!b) return;
    const s = this.state;
    const n = bossOf(b);
    const art = BOSS_ART[b.kind];
    let pose = 'ready';
    if ((b.mode === 'tired' && b.ms <= 0) || b.mode === 'down') pose = 'tired';
    else if (b.mode === 'throw' && b.thrown > 0 && b.ms > n.throwEvery(b.hp) - 260) pose = b.kind === 'dragon' ? 'breathe' : 'throw';
    const flash = b.hurtMs > 0 ? (settings.reduceMotion ? 0.6 : Math.floor(this.clock / 80) % 2 ? 0.35 : 1) : 1;
    this.boss
      .setTexture(`${b.kind}-${pose}`)
      .setOrigin(0.5, art.feetY / art.h)
      .setX(this.sx(b.x + b.w / 2))
      .setFlipX(b.mode === 'flee')
      .setAngle(b.mode === 'down' ? (b.kind === 'dragon' ? -14 : 80) : 0)
      .setAlpha(s.phase === 'over' ? 1 : flash);
  }

  /** The rockfall's boulders tumbling along behind the knight, turning as they roll (held still with reduced motion). */
  private drawRocks() {
    const rock = this.state.rockfall;
    this.rocks.forEach((img, i) => {
      img.setVisible(!!rock);
      if (!rock) return;
      const b = BOULDERS[i];
      const x = rock.x - b.back - ROCK.r * b.scale;
      img.setPosition(this.sx(x), GROUND_Y + 2 - ROCK.r * b.scale).setRotation(settings.reduceMotion ? 0 : x / (ROCK.r * b.scale) + i);
    });
  }

  /** Snow falling over the frozen pass and gusts blowing over the windy pass; held still with reduced motion. */
  private drawWeather() {
    const g = this.weather.clear();
    const s = this.state;
    if (s.terrain !== 'ice' && s.terrain !== 'wind') return;
    const t = settings.reduceMotion ? 0 : this.clock / 1000;
    const top = FRAME.y + 30;
    const height = GROUND_Y - top;
    if (s.terrain === 'ice') {
      for (let i = 0; i < WEATHER.flakes; i++) {
        const x = (((i * 137 + s.distance * 0.3 - t * 30) % VIEW.w) + VIEW.w) % VIEW.w;
        const y = top + ((i * 71 + t * (40 + (i % 3) * 14)) % height);
        g.fillStyle(0xffffff, 0.9).fillCircle(x, y, 1.6 + (i % 3) * 0.6).lineStyle(0.75, N.ink, 0.5).strokeCircle(x, y, 1.6 + (i % 3) * 0.6);
      }
    } else {
      for (let i = 0; i < WEATHER.gusts; i++) {
        const len = 40 + (i % 3) * 22;
        const x = VIEW.w - ((((i * 211 + t * 520) % (VIEW.w + 200)) + VIEW.w + 200) % (VIEW.w + 200));
        const y = top + 20 + ((i * 53) % (height - 40));
        g.lineStyle(2.5, N.ink, 0.35).lineBetween(x, y, x + len, y);
        g.lineStyle(1.5, 0xffffff, 0.85).lineBetween(x, y, x + len, y);
        g.lineStyle(1.5, 0xffffff, 0.85).beginPath().arc(x, y - 5, 5, Math.PI * 0.5, Math.PI * 1.5).strokePath();
      }
    }
  }

  private drawKnight() {
    const s = this.state;
    const r = s.runner;
    let pose: KnightPose;
    if (s.phase === 'over' || r.slideMs > 0) pose = 'slide';
    else if (r.h > floorAt(s, s.distance - RUNNER.w / 2, s.distance + RUNNER.w / 2)) pose = r.vh > 0 ? 'jump' : 'fall';
    else if (s.phase === 'checkpoint') pose = 'run1';
    else pose = `run${Math.floor(s.distance / STRIDE_PX) % 4}` as KnightPose;
    const feet = pose === 'slide' ? KNIGHT_FEET.slide : KNIGHT_FEET.stand;
    this.knight
      .setTexture(`knight-${pose}`)
      .setOrigin(feet.x / feet.w, feet.y / feet.h)
      .setPosition(RUNNER_X, GROUND_Y - r.h)
      .setAngle(s.phase === 'over' ? -8 : 0);
    // Blinks while it can't be hurt after a hit (held faded with reduced motion); greyed once fallen.
    const hurt = r.hurtMs > 0 && s.phase === 'running';
    this.knight.setAlpha(!hurt ? 1 : settings.reduceMotion ? 0.6 : Math.floor(this.clock / 80) % 2 === 0 ? 0.35 : 1);
    if (s.phase === 'over') this.knight.setTint(0x9a8f88).setTintMode(Phaser.TintModes.MULTIPLY);
    else this.knight.clearTint();
  }

  /** A gold six-pointed star, inked, for the sparkles. */
  private star(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, alpha: number) {
    const pts = Array.from({ length: 12 }, (_, i) => {
      const a = (i * Math.PI) / 6;
      const q = i % 2 ? r * 0.45 : r;
      return new Phaser.Math.Vector2(x + Math.cos(a) * q, y + Math.sin(a) * q);
    });
    g.fillStyle(N.goldLight, alpha).fillPoints(pts, true).lineStyle(1, N.ink, alpha).strokePoints(pts, true);
  }

  private drawEffects() {
    const g = this.fx;
    g.clear();
    const s = this.state;
    const still = settings.reduceMotion;
    const seen = new Set<number>();
    for (const e of s.effects) {
      const t = 1 - e.ms / e.total;
      const x = this.sx(e.x);
      const y = GROUND_Y - e.h;
      if (e.kind === 'coin') {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.6;
          this.star(g, x + Math.cos(a) * 18 * t, y + Math.sin(a) * 18 * t - 10 * t, 3.5, 1 - t);
        }
      } else if (e.kind === 'hit') {
        g.lineStyle(5, N.ink, 0.8 * (1 - t)).strokeCircle(x, y, 16 + 30 * t);
        g.lineStyle(3, N.madder, 1 - t).strokeCircle(x, y, 16 + 30 * t);
      } else if (e.kind === 'block') {
        g.fillStyle(N.frost, 0.3 * (1 - t)).fillCircle(x, y, 40);
        g.lineStyle(5, N.ink, 1 - t).strokeCircle(x, y, 40);
        g.lineStyle(3, N.gold, 1 - t).strokeCircle(x, y, 40);
      } else if (e.kind === 'stomp') {
        // A puff of dust and a few stars where a goblin or bat was knocked out.
        g.fillStyle(N.vellumDark, 0.8 * (1 - t)).fillCircle(x - 12, y + 4 - 8 * t, 8 + 8 * t).fillCircle(x + 12, y + 4 - 8 * t, 8 + 8 * t);
        g.lineStyle(1, N.ink, 0.6 * (1 - t)).strokeCircle(x - 12, y + 4 - 8 * t, 8 + 8 * t).strokeCircle(x + 12, y + 4 - 8 * t, 8 + 8 * t);
        for (let i = 0; i < 3; i++) {
          const a = -Math.PI / 2 + (i - 1) * 0.9;
          this.star(g, x + Math.cos(a) * 26 * t, y - 6 + Math.sin(a) * 26 * t, 5, 1 - t);
        }
      } else if (e.kind === 'skid') {
        // Ice chips sprayed up from the knight's heels as they skid.
        for (let i = 0; i < 4; i++) {
          const px = x - 14 - i * 7 - 18 * t;
          const py = y - 3 - (i % 2) * 5 - 6 * t;
          g.fillStyle(0xffffff, 1 - t).fillCircle(px, py, 2.5).lineStyle(0.75, N.ink, 0.6 * (1 - t)).strokeCircle(px, py, 2.5);
        }
      } else if (e.kind === 'fall') {
        // A puff thrown up from a pit fallen into while unhurtable.
        g.fillStyle(N.vellumDark, 0.8 * (1 - t)).fillCircle(x - 10, y - 6 - 14 * t, 7 + 7 * t).fillCircle(x + 10, y - 6 - 14 * t, 7 + 7 * t);
        g.lineStyle(1, N.ink, 0.6 * (1 - t)).strokeCircle(x - 10, y - 6 - 14 * t, 7 + 7 * t).strokeCircle(x + 10, y - 6 - 14 * t, 7 + 7 * t);
      } else if (e.kind === 'dust') {
        g.fillStyle(N.vellum, 0.7 * (1 - t)).fillCircle(x - 10 - 16 * t, y - 4 - 6 * t, 5 + 4 * t).fillCircle(x - 22 - 20 * t, y - 3 - 4 * t, 4 + 3 * t);
      } else {
        // Words: a "+3" coin pop that rises (held still with reduced motion), a heart from a shrine,
        // or why a shrine gave none.
        seen.add(e.id);
        let word = this.words.get(e.id);
        if (!word) {
          const words = wordsOf(e);
          const big = words.length > 6;
          const style =
            e.kind === 'pop' ? textStyle(big ? 22 : 24, C.goldLight, 4) : e.kind === 'heal' ? textStyle(18, '#7fd08a', 4) : { ...textStyle(15, C.goldPale, 4), fontStyle: 'bold italic' };
          word = this.add.text(0, 0, words, style).setOrigin(0.5).setDepth(6.5);
          this.words.set(e.id, word);
        }
        const rise = still || e.kind === 'refuse' ? 0 : 30 * t;
        // A pop sits up by the knight's sword hand, clear of the helm.
        const lift = e.kind === 'pop' && word.text.length <= 6 ? 34 : 0;
        word.setPosition(x + lift, y - lift - rise).setAlpha(t < 0.7 ? 1 : (1 - t) / 0.3);
        if (e.kind === 'heal') {
          g.lineStyle(4, N.ink, 1 - t).strokeCircle(x, GROUND_Y - 40, 20 + 20 * t);
          g.lineStyle(2, N.heal, 1 - t).strokeCircle(x, GROUND_Y - 40, 20 + 20 * t);
        }
      }
    }
    for (const [id, word] of this.words) {
      if (seen.has(id)) continue;
      word.destroy();
      this.words.delete(id);
    }

    // The crown from the Dragon's Keep sits on the knight's helm.
    if (s.crown && s.phase !== 'over') {
      const r = s.runner;
      const cx = RUNNER_X + 1;
      const cy = GROUND_Y - r.h - (r.slideMs > 0 ? 38 : 72);
      const pts = [
        new Phaser.Math.Vector2(cx - 11, cy),
        new Phaser.Math.Vector2(cx - 12, cy - 11),
        new Phaser.Math.Vector2(cx - 6, cy - 5),
        new Phaser.Math.Vector2(cx, cy - 13),
        new Phaser.Math.Vector2(cx + 6, cy - 5),
        new Phaser.Math.Vector2(cx + 12, cy - 11),
        new Phaser.Math.Vector2(cx + 11, cy),
      ];
      g.fillStyle(N.goldLight).fillPoints(pts, true).lineStyle(1.25, N.ink).strokePoints(pts, true);
      g.fillStyle(N.madder).fillCircle(cx, cy - 3, 1.6);
    }
    // The rockfall's dust, rolling up ahead of the boulders.
    if (s.rockfall && s.phase === 'running') {
      const x = this.sx(s.rockfall.x);
      const t = still ? 0 : this.clock / 1000;
      for (let i = 0; i < 5; i++) {
        const px = x + 6 + i * 9 + (still ? 0 : ((t * 60 + i * 17) % 30));
        const py = GROUND_Y - 6 - i * 7 - ((i * 13) % 9);
        g.fillStyle(N.vellumDark, 0.55 - i * 0.08).fillCircle(px, py, 7 + i * 2);
      }
    }

    // The sparkle trail: gold stars left behind the knight while a streak pays x2 or more.
    const running = s.phase === 'running';
    if (!still && running && streakMult(s.streak) >= 2) {
      if (this.clock - this.trailAt >= TRAIL.everyMs) {
        this.trailAt = this.clock;
        this.trail.unshift({ x: s.distance - 18, h: s.runner.h + 34 });
        this.trail.length = Math.min(this.trail.length, TRAIL.stars);
      }
      this.trail.forEach((p, i) => this.star(g, this.sx(p.x) - i * 4, GROUND_Y - p.h, 5.5 - i * 0.5, 1 - i / (TRAIL.stars + 1)));
    } else if (running || s.phase === 'over') {
      this.trail.length = 0;
    }

    if (s.shields > 0 && running) {
      // The Aegis: a gold-ruled nimbus round the knight.
      const cy = GROUND_Y - s.runner.h - 30;
      const a = still ? 0.8 : 0.7 + 0.2 * Math.sin(this.clock / 150);
      g.fillStyle(0x8cb4ff, 0.15).fillCircle(RUNNER_X, cy, 39);
      g.lineStyle(4.5, N.ink, a).strokeCircle(RUNNER_X, cy, 39);
      g.lineStyle(2.5, N.gold, a).strokeCircle(RUNNER_X, cy, 39);
      g.fillStyle(0xfff2c0, a);
      for (let k = 0; k < 16; k++) {
        const ang = (k * Math.PI) / 8;
        g.fillCircle(RUNNER_X + Math.cos(ang) * 34, cy + Math.sin(ang) * 34, 1);
      }
    }
  }

  private createHud() {
    const d = UI_DEPTH;
    this.add.image(0, 0, 'hud-band').setOrigin(0).setDepth(d);
    this.hud = this.add.graphics().setDepth(d + 1);
    // The hearts keep to the left edge, the stage's name to the middle, the distance, coins and best to the right edge.
    const { mid, right } = HUD_SHIFT;
    this.add.image(457 + mid, 20, 'initial').setDepth(d + 1);
    this.stageText = this.add.text(474 + mid, 21, '', textStyle(19, C.goldPale, 0)).setOrigin(0, 0.5).setDepth(d + 1);
    this.distText = this.add.text(719 + right, 21, '', textStyle(17, C.goldPale, 0)).setOrigin(0.5).setDepth(d + 1);
    this.add.image(765 + right, 21, 'coin-0').setDepth(d + 1);
    this.coinText = this.add.text(794 + right, 21, '', textStyle(17, C.goldLight, 0)).setOrigin(0.5).setDepth(d + 1);
    this.coinsLabel = this.add.text(815 + right, 22, t('coins'), { fontFamily: FONT, fontSize: '13px', fontStyle: 'italic', color: C.frost }).setOrigin(0, 0.5).setDepth(d + 1);
    this.bestText = this.add.text(905 + right, 21, '', textStyle(16, C.frost, 0)).setOrigin(0.5).setDepth(d + 1);

    // The streak chip: a gold medallion with the multiplier, its name, and a bar to the next one.
    const c = STREAK_CHIP;
    this.add.image(c.x, c.y, 'streak-chip').setOrigin(0).setDepth(d + 1);
    this.add.image(c.x + 13, c.y + 12, 'medallion').setDepth(d + 2);
    this.medalText = this.add.text(c.x + 13, c.y + 12.5, '', { fontFamily: FONT, fontSize: '9px', fontStyle: 'bold', color: C.ink }).setOrigin(0.5).setDepth(d + 3);
    this.streakText = this.add.text(c.x + 25, c.y + 8.5, '', { fontFamily: FONT, fontSize: '10.5px', fontStyle: 'bold', color: C.madder }).setOrigin(0, 0.5).setDepth(d + 2);
    this.streakNext = this.add.text(c.x + c.w - 5, c.y + 17.5, '', { fontFamily: FONT, fontSize: '8px', fontStyle: 'italic', color: C.ink }).setOrigin(1, 0.5).setDepth(d + 2);

    // The run track: a vellum strip with the ruled road, its banners, the knight and the best run.
    this.add.image(TRACK.left, TRACK.y - TRACK.h / 2, 'track-strip').setOrigin(0).setDepth(d);
    this.trackNext = this.add.text(TRACK.x0 - 7, TRACK.y + 0.5, '', { fontFamily: FONT, fontSize: '10px', fontStyle: 'italic', color: C.ink }).setOrigin(1, 0.5).setDepth(d + 2);
    this.trackBest = this.add.text(TRACK.x1 + 7, TRACK.y + 1, '', { fontFamily: FONT, fontSize: '9px', fontStyle: 'bold italic', color: C.madder }).setOrigin(0, 0.5).setDepth(d + 2);

    // The stage's tag: its ground and rule, or the Gatekeeper's stomps left; "Daily" on a daily run.
    this.add.image(TAG.x, TAG.y, 'tag-strip').setOrigin(0).setDepth(d);
    this.tagText = this.add.text(TAG.x + 10, TAG.y + TAG.h / 2 + 0.5, '', { fontFamily: FONT, fontSize: '10px', fontStyle: 'bold italic', color: C.lapis }).setOrigin(0, 0.5).setDepth(d + 2);

    // The herald's dare under the tag: the dare and how far it has come.
    this.dareTag = this.add.image(DARE_TAG.x, DARE_TAG.y, 'dare-strip').setOrigin(0).setDepth(d);
    this.dareText = this.add.text(DARE_TAG.x + 10, DARE_TAG.y + DARE_TAG.h / 2 + 0.5, '', { fontFamily: FONT, fontSize: '10px', fontStyle: 'bold italic', color: C.madder }).setOrigin(0, 0.5).setDepth(d + 2);
  }

  private drawHud() {
    const s = this.state;
    const g = this.hud.clear();
    const d = UI_DEPTH;
    const max = stats(s).maxHearts;
    while (this.hearts.length < max) this.hearts.push(this.add.image(23 + this.hearts.length * 36, 19, 'heart-full').setDepth(d + 1));
    this.hearts.forEach((h, i) => h.setVisible(i < max).setTexture(i < s.hearts ? 'heart-full' : 'heart-empty'));
    this.stageText.setText(t('stageRest', { n: s.stage }));
    this.distText.setText(t('metres', { n: metres(s.distance) }));
    this.coinText.setText(formatNumber(s.coins));
    const best = t('best', { n: s.best });
    if (this.bestText.text !== best) this.fitBest(best);

    // The coin streak, capped by the road.
    const cap = streakMax(s.road);
    const mult = streakMult(s.streak, cap);
    const c = STREAK_CHIP;
    const maxed = mult >= cap;
    const into = maxed ? STREAK.step : s.streak % STREAK.step;
    this.medalText.setText(`x${mult}`);
    this.streakText.setText(t('streak', { n: mult }));
    this.streakNext.setText(maxed ? t('streakMax') : t('streakNext', { n: STREAK.step - into, mult: mult + 1 }));
    const bar = { x: c.x + 25, y: c.y + 15, w: 42, h: 4 };
    g.fillStyle(N.vellumDark).fillRect(bar.x, bar.y, bar.w, bar.h);
    g.fillStyle(N.verm).fillRect(bar.x, bar.y, (bar.w * into) / STREAK.step, bar.h);
    g.lineStyle(0.75, N.ink).strokeRect(bar.x, bar.y, bar.w, bar.h);

    // The run track.
    const tr = trackOf(s);
    const at = (m: number) => TRACK.x0 + ((TRACK.x1 - TRACK.x0) * Math.min(m, tr.length)) / tr.length;
    const ly = TRACK.y + 3;
    g.lineStyle(2, N.ink).lineBetween(TRACK.x0, ly, TRACK.x1, ly);
    g.lineStyle(1, N.vellumDark).lineBetween(TRACK.x0, ly, TRACK.x1, ly);
    g.lineStyle(1, N.verm).lineBetween(TRACK.x0, ly, at(tr.at), ly);
    for (const m of tr.banners) {
      const x = at(m);
      g.lineStyle(1, N.ink).lineBetween(x, ly + 1, x, ly - 10);
      const flag = [
        new Phaser.Math.Vector2(x, ly - 10),
        new Phaser.Math.Vector2(x + 9, ly - 8),
        new Phaser.Math.Vector2(x + 5, ly - 6.5),
        new Phaser.Math.Vector2(x + 9, ly - 4.5),
        new Phaser.Math.Vector2(x, ly - 4.5),
      ];
      g.fillStyle(m <= tr.at ? N.gold : N.lapis).fillPoints(flag, true).lineStyle(0.75, N.ink).strokePoints(flag, true);
    }
    if (tr.best > 0) {
      // The ghost flag at the best run, to chase.
      const x = at(tr.best);
      g.lineStyle(1, N.ink).lineBetween(x, ly + 2, x, ly - 11);
      const flag = [new Phaser.Math.Vector2(x, ly - 11), new Phaser.Math.Vector2(x + 10, ly - 8.5), new Phaser.Math.Vector2(x, ly - 5.5)];
      g.fillStyle(N.madder, 0.85).fillPoints(flag, true).lineStyle(0.75, N.ink).strokePoints(flag, true);
    }
    g.fillStyle(N.lapis).fillCircle(at(tr.at), ly, 4).lineStyle(1, N.ink).strokeCircle(at(tr.at), ly, 4);
    g.fillStyle(N.goldLight).fillCircle(at(tr.at), ly, 1.5);
    const dragon = s.boss?.kind === 'dragon';
    this.trackNext.setText(s.boss && bossStands(s) ? t(dragon ? 'dragonTrack' : 'gateTrack') : tr.next > 0 ? t('trackNext', { n: tr.next }) : t('trackAt'));

    // The stage's tag (its ground and road), and the boss's stomps left as pips while it stands.
    const daily = s.daily ? t('daily') : '';
    const tag = (...parts: string[]) => parts.filter(Boolean).join(' · ');
    if (s.boss && bossStands(s)) {
      this.tagText.setText(tag(daily, t(bossOf(s.boss).name)));
      const hp = bossOf(s.boss).hp;
      for (let i = 0; i < hp; i++) {
        const x = TAG.x + TAG.w - 16 - i * 16;
        const y = TAG.y + TAG.h / 2;
        const pip = [new Phaser.Math.Vector2(x, y - 6), new Phaser.Math.Vector2(x + 6, y), new Phaser.Math.Vector2(x, y + 6), new Phaser.Math.Vector2(x - 6, y)];
        g.fillStyle(i < s.boss.hp ? N.madder : N.vellumDark).fillPoints(pip, true).lineStyle(1, N.ink).strokePoints(pip, true);
      }
    } else {
      const ground = s.boss ? t(dragon ? 'dragonBeatenTag' : 'gateBeatenTag') : t(TERRAIN[s.terrain].name);
      this.tagText.setText(tag(daily, ground, s.rockfall && !s.boss ? t('rockfall') : '', s.road ? t(ROADS[s.road].short) : ''));
    }
    this.trackBest.setText(tr.best === 0 ? t('trackFirst') : tr.at > tr.best ? t('trackNewBest') : t('best', { n: tr.best }));

    // The herald's dare and its progress.
    const dare = s.dare;
    this.dareTag.setVisible(!!dare);
    this.dareText.setVisible(!!dare);
    if (dare) {
      const progress = dare.done ? t('dareMet') : dare.failed ? t('dareLost') : dare.kind === 'nohit' ? t('dareSoFar') : dare.kind === 'streak' ? `x${dare.progress}` : `${formatNumber(dare.progress)}/${formatNumber(dare.goal)}`;
      const words = t('dareTag', { dare: dareText(dare), progress });
      if (this.dareText.text !== words) this.dareText.setText(words);
      this.dareText.setColor(dare.done ? '#2f7a4a' : dare.failed ? C.iron : C.madder);
    }

    // The controls hint fades out a little way into the first stage.
    const hint = s.stage === 1 && s.phase === 'running' ? (HINT_UNTIL - s.distance) / 200 : 0;
    this.hint.setAlpha(Phaser.Math.Clamp(hint, 0, 1));

    this.actionButtons.setVisible(this.touchScreen && s.phase === 'running');

    // Each stage after the first opens with its title: its name and its rule.
    const intoStage = s.distance - s.stageStart;
    const shown = s.stage > 1 && s.phase === 'running' ? (TITLE_UNTIL - intoStage) / 200 : 0;
    if (shown > 0) {
      const name = t(dragon ? 'dragonTitle' : s.boss ? 'gateTitle' : TERRAIN[s.terrain].name);
      const rule = TERRAIN[s.terrain].rule;
      // The dare reads on after a colon, so it starts small: "The herald's dare: stomp 2 foes".
      const dare = s.dare ? dareText(s.dare) : '';
      const lines = s.boss
        ? [t(dragon ? 'dragonTitleRule' : 'gateTitleRule')]
        : [rule ? t(rule) : '', s.road ? t(ROADS[s.road].title) : '', s.rockfall ? t('rockfallTitle') : '', dare ? t('dareTitle', { dare: dare[0].toLowerCase() + dare.slice(1) }) : ''];
      const rules = lines.filter(Boolean).join('\n');
      const title = t('stageTitle', { n: s.stage, name });
      if (this.titleName.text !== title) this.titleName.setText(title);
      if (this.titleRule.text !== rules) this.titleRule.setText(rules);
    }
    this.title.setAlpha(Phaser.Math.Clamp(shown, 0, 1));
  }

  /**
   * The best run in the HUD, centred where it was designed to sit, but moved left of the edge and
   * shrunk where a longer text (German's "Rekord") would run into the coins' label.
   */
  private fitBest(words: string) {
    const text = this.bestText.setText(words).setScale(1);
    const left = this.coinsLabel.x + this.coinsLabel.width + 8;
    const right = VIEW.w - 10;
    const scale = Math.min(1, (right - left) / text.width);
    const half = (text.width * scale) / 2;
    text.setScale(scale).setX(Phaser.Math.Clamp(905 + HUD_SHIFT.right, left + half, right - half));
  }

  private createTitle() {
    this.titleName = this.add.text(0, 0, '', textStyle(26, C.goldPale, 5)).setOrigin(0.5);
    this.titleRule = this.add.text(0, 32, '', { ...textStyle(17, C.goldPale, 4), fontStyle: 'bold italic', align: 'center' }).setOrigin(0.5, 0);
    this.title = this.add.container(STAGE_TITLE.x, STAGE_TITLE.y, [this.titleName, this.titleRule]).setDepth(UI_DEPTH - 5).setAlpha(0);
  }

  /** The rubric in the margin under the road, saying what the knight is about. */
  private drawCaption() {
    const s = this.state;
    let line: string;
    if (s.phase === 'over') line = t('captionOver');
    else if (s.phase === 'checkpoint') line = t(s.roads ? 'captionRoads' : 'captionBoons');
    else if (s.stage === 1 && s.distance < HINT_UNTIL) line = t('captionStart');
    else if (s.boss && bossStands(s)) {
      const b = s.boss;
      const thrown = s.traps.find((t) => MISSILES.includes(t.kind) && t.x + t.w > s.distance - 20);
      if (b.kind === 'dragon') {
        if (b.mode === 'wait') line = t('captionDragonWait');
        else if (b.mode === 'tired' && b.ms <= 0) line = t('captionDragonTired');
        else if (thrown?.kind === 'fire') line = t('captionDragonFire');
        else if (thrown?.kind === 'tail') line = t('captionDragonTail');
        else line = t('captionDragonChase');
      } else if (b.mode === 'wait') line = t('captionGateWait');
      else if (b.mode === 'tired' && b.ms <= 0) line = t('captionGateTired');
      else if (thrown?.kind === 'barrel') line = t('captionGateBarrel');
      else if (thrown?.kind === 'axe') line = t('captionGateAxe');
      else line = t('captionGateChase');
    } else if (s.rockfall && s.rockfall.x > s.distance - RUNNER.w / 2 - 110) line = t('captionRockfall');
    else {
      const ahead = (x: number) => x > s.distance && x < s.distance + 700;
      const trap = s.traps.find((t) => t.x + t.w > s.distance - 20 && t.x < s.distance + 700);
      const wall = s.ledges.find((l) => ahead(l.x));
      const shrine = s.shrines.find((sh) => !sh.used && ahead(sh.x));
      const next = [
        trap && { x: trap.x, kind: trap.kind as string },
        wall && { x: wall.x, kind: 'wall' },
        shrine && { x: shrine.x, kind: 'shrine' },
      ]
        .filter((n): n is { x: number; kind: string } => !!n)
        .sort((a, b) => a.x - b.x)[0];
      const lines: Record<string, TextKey> = {
        spikes: 'captionSpikes',
        pit: 'captionPit',
        blade: 'captionBlade',
        flames: 'captionFlames',
        goblin: 'captionGoblin',
        bat: 'captionBat',
        wall: 'captionWall',
        shrine: 'captionShrine',
        barrel: 'captionBarrel',
        axe: 'captionAxe',
        fire: 'captionFire',
        tail: 'captionTail',
      };
      const onward: Record<GameState['terrain'], TextKey> = {
        road: 'captionRoad',
        ice: 'captionIce',
        marsh: 'captionMarsh',
        wind: 'captionWind',
      };
      line = t(next ? lines[next.kind] : s.boss ? (s.boss.kind === 'dragon' ? 'captionPastDragon' : 'captionPastGate') : onward[s.terrain]);
    }
    if (this.caption.text !== line) {
      this.caption.setText(line).setScale(1);
      if (this.caption.width > MARGIN.captionW) this.caption.setScale(MARGIN.captionW / this.caption.width);
    }
  }

  private createHint() {
    const g = this.add.graphics();
    g.lineStyle(2, N.goldPale, 0.5).lineBetween(FRAME.x, TAP_SPLIT_Y, FRAME.x + FRAME.w, TAP_SPLIT_Y);
    const up = this.add.text(VIEW.w / 2 + 100, TAP_SPLIT_Y - 70, t('hintJump'), textStyle(19, C.goldPale, 4)).setOrigin(0.5).setAlign('center');
    const down = this.add.text(VIEW.w / 2 + 100, TAP_SPLIT_Y + 70, t('hintSlide'), textStyle(19, C.goldPale, 4)).setOrigin(0.5).setAlign('center');
    this.hint = this.add.container(0, 0, [g, up, down]).setDepth(UI_DEPTH - 5);
  }

  /**
   * The round Slide and Jump buttons in the margin's bottom right. They show on a touch screen (or
   * once the screen has been touched), next to the tap halves and keys, which still work.
   */
  private createActionButtons() {
    const { y, r, slideX, jumpX } = ACTION_BUTTONS;
    this.touchScreen = this.sys.game.device.input.touch;
    // Two thumbs at once: one on a button, one tapping the screen.
    this.input.addPointer(1);
    const button = (kind: 'jump' | 'slide', x: number, act: () => void) => {
      const key = `action-${kind}`;
      const disc = this.add.image(0, 0, key).setInteractive(new Phaser.Geom.Circle(r + 2, r + 2, r), Phaser.Geom.Circle.Contains);
      const caption = this.add.text(0, 20, t(kind === 'jump' ? 'buttonJump' : 'buttonSlide'), textStyle(13, C.goldPale, 3)).setOrigin(0.5);
      disc
        .on('pointerdown', () => {
          disc.setTexture(`${key}-down`);
          act();
        })
        .on('pointerup', () => disc.setTexture(key))
        .on('pointerout', () => disc.setTexture(key));
      return this.add.container(x, y, [disc, caption]);
    };
    this.actionButtons = this.add
      .container(0, 0, [button('slide', slideX, () => slide(this.state)), button('jump', jumpX, () => jump(this.state))])
      .setDepth(UI_DEPTH - 4)
      .setVisible(false);
  }

  private createGameOver() {
    bakePanel(this, 'over-panel', 600, 400);
    const dim = this.add.rectangle(VIEW.w / 2, VIEW.h / 2, VIEW.w, VIEW.h, N.ink, 0.6).setInteractive();
    const panel = this.add.image(VIEW.w / 2, VIEW.h / 2, 'over-panel');
    const title = this.add
      .text(VIEW.w / 2, VIEW.h / 2 - 160, t('fallen'), { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: C.madder })
      .setOrigin(0.5);
    this.gameOverText = this.add
      .text(VIEW.w / 2, VIEW.h / 2 - 70, '', { fontFamily: FONT, fontSize: '16px', color: C.ink, align: 'center', wordWrap: { width: 540 } })
      .setOrigin(0.5, 0.5);
    this.shopText = this.add
      .text(VIEW.w / 2, VIEW.h / 2 + 32, '', { fontFamily: FONT, fontSize: '16px', fontStyle: 'italic', color: C.lapis, align: 'center', wordWrap: { width: 540 } })
      .setOrigin(0.5);
    this.buyButton = makeButton(this, VIEW.w / 2, VIEW.h / 2 + 80, t('buy', { n: BOON_PRICE }), () => this.buy(), 400);
    this.armouryButton = makeButton(this, VIEW.w / 2 - 190, VIEW.h / 2 + 150, t('armoury'), () => this.openArmoury());
    const again = makeButton(this, VIEW.w / 2, VIEW.h / 2 + 150, t('runAgain'), () => this.restart(null));
    const daily = makeButton(this, VIEW.w / 2 + 190, VIEW.h / 2 + 150, t('dailyCourse'), () => this.restart(today()));
    this.gameOver = this.add
      .container(0, 0, [dim, panel, title, this.gameOverText, this.shopText, this.buyButton, this.armouryButton, again, daily])
      .setDepth(UI_DEPTH + 20)
      .setVisible(false);
  }

  private pick(id: BoonId) {
    if (pick(this.state, id)) sfx('pick');
  }

  private pickRoad(road: Road) {
    if (pickRoad(this.state, road)) sfx('pick');
  }

  /** Spends the coins on the boon missed at the last checkpoint, for the next run. */
  private buy() {
    if (buyMissed(this.state)) {
      ui('coin');
      this.persist();
      this.drawGameOver();
    } else ui('refuse');
  }

  /**
   * The armoury: an overlay on the game-over panel listing each lasting upgrade with its level, what
   * it does and the price of its next level, and a button to buy it with banked coins.
   */
  private createArmoury() {
    const { w, h, rowY } = ARMOURY_PANEL;
    bakePanel(this, 'armoury-panel', w, h);
    const cx = VIEW.w / 2;
    const cy = VIEW.h / 2;
    const dim = this.add.rectangle(cx, cy, VIEW.w, VIEW.h, N.ink, 0.4).setInteractive();
    const panel = this.add.image(cx, cy, 'armoury-panel');
    const title = this.add.text(cx, cy - h / 2 + 42, t('armouryTitle'), { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: C.madder }).setOrigin(0.5);
    this.armouryBank = this.add.text(cx, cy - h / 2 + 76, '', { fontFamily: FONT, fontSize: '15px', fontStyle: 'italic', color: C.lapis }).setOrigin(0.5);
    const parts: Phaser.GameObjects.GameObject[] = [dim, panel, title, this.armouryBank];
    ARMOURY_IDS.forEach((id, i) => {
      const y = cy + rowY[i];
      const item = ARMOURY[id];
      const icon = this.add.image(cx - w / 2 + 64, y, armouryIcon(id));
      const name = this.add.text(cx - w / 2 + 108, y - 16, t(item.name), { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: C.madder }).setOrigin(0, 0.5);
      const text = this.add.text(cx - w / 2 + 108, y + 10, t(item.text), { fontFamily: FONT, fontSize: '14px', color: C.ink, wordWrap: { width: 270 } }).setOrigin(0, 0.5);
      const level = this.add.text(cx + 150, y - 28, '', { fontFamily: FONT, fontSize: '13px', fontStyle: 'italic', color: '#2f7a4a' }).setOrigin(0.5);
      const buy = makeButton(this, cx + 150, y + 6, '', () => this.buyArmoury(id), 190);
      const full = this.add.text(cx + 150, y + 6, t('fullyForged'), { fontFamily: FONT, fontSize: '16px', fontStyle: 'bold italic', color: C.lapis }).setOrigin(0.5);
      parts.push(icon, name, text, level, buy, full);
      this.armouryRows.push({ id, level, buy, full });
    });
    const back = makeButton(this, cx, cy + h / 2 - 44, t('back'), () => {
      ui('click');
      this.armouryPanel.setVisible(false);
    });
    parts.push(back);
    this.armouryPanel = this.add.container(0, 0, parts).setDepth(UI_DEPTH + 30).setVisible(false);
  }

  private drawArmoury() {
    const s = this.state;
    this.armouryBank.setText(t('armouryBank', { n: s.bank }));
    for (const row of this.armouryRows) {
      const lv = s.armoury[row.id];
      const max = ARMOURY[row.id].prices.length;
      const price = nextPrice(s.armoury, row.id);
      row.level.setText(t('level', { n: lv, max }));
      row.full.setVisible(price === null);
      row.buy.setVisible(price !== null).setAlpha(price !== null && s.bank >= price ? 1 : 0.45);
      const caption = row.buy.getAt(1) as Phaser.GameObjects.Text;
      const words = price === null ? '' : t('forge', { n: price });
      if (caption.text !== words) caption.setText(words);
    }
  }

  private openArmoury() {
    ui('click');
    this.armouryPanel.setVisible(true);
    this.drawArmoury();
  }

  private buyArmoury(id: ArmouryId) {
    if (buyArmoury(this.state, id)) {
      ui('coin');
      this.persist();
      this.drawGameOver();
    } else ui('refuse');
  }

  /**
   * A new run from the start, with no boons except one bought at the game over; the bank, the
   * armoury and the best carry over. `daily` is the date of a daily course to run, or null.
   */
  private restart(daily: string | null) {
    this.persist();
    this.state = this.freshRun(daily);
    this.persist();
    sfx('again');
    this.cues.reset(this.state);
    this.armouryPanel.setVisible(false);
    for (const sprite of [...this.traps.values(), ...this.coins.values(), ...this.ledges.values(), ...this.words.values()]) sprite.destroy();
    for (const art of this.shrines.values()) {
      art.image.destroy();
      art.label.destroy();
    }
    this.traps.clear();
    this.coins.clear();
    this.ledges.clear();
    this.shrines.clear();
    this.words.clear();
    this.trail.length = 0;
  }
}
