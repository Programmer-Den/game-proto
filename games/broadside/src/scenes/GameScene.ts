import Phaser from 'phaser';
import { settings } from '../../../../shared/settings';
import { dailyRand, finishDaily, loadDaily, startDaily, today, type DailyRecord } from '../../../../shared/daily';
import { ui } from '../../../../shared/audio';
import { HI, lookOf, SEA_RES, SHEET_RES } from '../art/art';
import { renderScale } from '../../../../shared/scaling';
import { BOON_IDS, BOONS, costOfBoons, type BoonId } from '../game/admiralty';
import { BOUNTIES, bountyMet, bountyPay } from '../game/bounties';
import { CAPTAIN_IDS, captainBounty, CAPTAINS, logFull } from '../game/captains';
import { CONVOY_ARRIVE } from '../game/convoy';
import { COURSES, type CourseId } from '../game/courses';
import { FIRST_HULL, HULL_IDS, HULLS, unlocked, type HullId } from '../game/hulls';
import { ORDERS } from '../game/orders';
import { PERKS, type PerkId } from '../game/perks';
import { useRandom } from '../game/random';
import { loadBestWave, loadHull, loadLog, loadMedals, loadReachesBest, loadWall, saveBestWave, saveHull, saveLog, saveMedals, saveReachesBest, saveWall } from '../game/save';
import { HEAD_MS, isBeast, TENTACLE_R } from '../game/beasts';
import type { CargoId } from '../game/trade';
import { DAILY_GAME, drawVoyage, voyageScore, wavesBeaten } from '../game/voyage';
import { ENEMIES } from '../game/ships';
import { SHOTS } from '../game/shot';
import type { UpgradeId } from '../game/upgrades';
import { afloat, boardable, boardMs, buy, canBoard, convoyShip, detourCourse, fireFlare, fortBounty, hire, keep, loadShot, pickPerk, repair, sailOn, scuttle, scuttleGold, seen as inSight, setSail, SHELL_R, tick, trade } from '../game/sim';
import {
  BREAK_MS,
  FORT,
  ISLANDS,
  loadedShot,
  newRun,
  offset,
  radiusOf,
  reachOf,
  sideRange,
  stats,
  windFrom,
  windReach,
  WORLD,
  type GameState,
  type Ship,
  type Side,
} from '../game/state';
import { t } from '../i18n';
import { makeButton } from '../ui/Button';
import { HAVEN_WAVE, inReaches, REACHES_WAVES, reachWave, TEMPEST_WAVE } from '../game/waves';
import { Harbor, type HarborAction } from '../ui/Harbor';
import { fitWidth, pinToScreen } from '../ui/screen';
import { checkTrophies } from '../trophies/check';
import { SoundCues } from './soundCues';
import { BANNER, BOUNTY, CONVOY, FIRE, FLARE, FONT, HELM, HUD_HEIGHT, ORDER_CARD, OVER, SCUTTLE, UI_DEPTH, VIEW, WIND } from './layout';

/** Longest simulated step, so a backgrounded tab doesn't jump the battle forward. */
const MAX_STEP_MS = 250;
/** How often each ship leaves a stroke of foam in its wake. */
const WAKE_EVERY_MS = 90;
const WAKE_MS = 1400;
const HP_BAR_W = 40;
const SIDES: Side[] = ['port', 'starboard'];
/** The width of each button along the foot of the end card: the daily voyage, Sail again and Sail on. */
const OVER_BUTTON_W = 180;

const INK = 0x2b2118;
const CREAM = 0xf6ecd2;
const OCHRE = 0xc9902e;
const WASH = 0xd6a03c;
const RUST = 0x9a4a30;
const GREEN = 0x3f6e48;
const LANTERN = 0xf0c860;
/** The dark of a night wave lies over the sea and the ships; a ship lit by her guns' flash, and the lights, go over it. */
const NIGHT_DEPTH = 7.5;
const LIT_DEPTH = 7.55;
const GLOW_DEPTH = 7.8;
/** A sea beast's head rises and sinks over this long at each end of its time up. */
const RISE_MS = 300;

const textStyle = (size: number, color = '#2b2118', fontStyle = 'normal', stroke?: string, strokeThickness = 0) => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  fontStyle,
  color,
  resolution: Math.max(2, renderScale),
  ...(stroke ? { stroke, strokeThickness } : {}),
});

/** What a pointer is holding down. */
type Control = 'helm-port' | 'helm-starboard' | 'fire-port' | 'fire-starboard';

export class GameScene extends Phaser.Scene {
  /** The run being played; read by the playthrough test. */
  state!: GameState;
  /** The harbor panel; the playthrough test reads where its buttons are to tap one. */
  harbor!: Harbor;
  private ships = new Map<number, Phaser.GameObjects.Image>();
  private forts = new Map<number, Phaser.GameObjects.Image>();
  private balls = new Map<number, Phaser.GameObjects.Image>();
  private loot = new Map<number, { barrel: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }>();
  private sinking = new Map<number, Phaser.GameObjects.Image>();
  private floaters = new Map<number, Phaser.GameObjects.Text>();
  /** The name over each named captain's ship. */
  private captainLabels = new Map<number, Phaser.GameObjects.Text>();
  /** The Storm Reaches' reefs, drawn on the sea, and a squall's rain, drawn over the screen. */
  private reefLines!: Phaser.GameObjects.Graphics;
  private rain!: Phaser.GameObjects.Graphics;
  /** How much of the captain's log is saved, so a captain sunk is saved once. */
  private savedLog = 0;
  /** Today's daily voyage on this device: whether it was sailed and its score. */
  private daily!: DailyRecord;
  /** The end card's daily voyage button, made the first time the card shows (see `createDailyButton`). */
  private dailyButton: Phaser.GameObjects.Container | null = null;
  private dailyText!: Phaser.GameObjects.Text;
  private sailOnText!: Phaser.GameObjects.Text;
  private wakes: { x: number; y: number; heading: number; ms: number; size: number }[] = [];
  /** Four copies of the sea in a square, moved so they always cover the screen. */
  private sea: Phaser.GameObjects.Image[] = [];
  /**
   * Where the player's ship is drawn. The sea wraps at its edges but this does not: it follows
   * the ship's every move, so the camera never jumps when the ship crosses an edge. Everything
   * else is drawn at its nearest copy around the player (see `place`).
   */
  private view = { x: 0, y: 0 };
  /** The point of the sea at the screen's top-left this frame; the camera's `worldView` lags a frame. */
  private topLeft = { x: 0, y: 0 };
  /** The player's position in the sea last frame, to move `view` by. */
  private lastPlayer = { x: 0, y: 0 };
  private arcs!: Phaser.GameObjects.Graphics;
  private course!: Phaser.GameObjects.Graphics;
  private wakeLines!: Phaser.GameObjects.Graphics;
  private bars!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private labels!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private controls!: Phaser.GameObjects.Graphics;
  private aimLabel!: Phaser.GameObjects.Text;
  private courseLabel!: Phaser.GameObjects.Text;
  private helmImages!: Record<Side, Phaser.GameObjects.Image>;
  private fireImages!: Record<Side, Phaser.GameObjects.Image>;
  private fireCaptions!: Record<Side, Phaser.GameObjects.Text>;
  private controlHits: Phaser.GameObjects.Arc[] = [];
  private waveText!: Phaser.GameObjects.Text;
  private hullText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private crewText!: Phaser.GameObjects.Text;
  private bountyText!: Phaser.GameObjects.Text;
  private convoyText!: Phaser.GameObjects.Text;
  private convoyLabel!: Phaser.GameObjects.Text;
  private infoText!: Phaser.GameObjects.Text;
  private bannerTitle!: Phaser.GameObjects.Text;
  private bannerSub!: Phaser.GameObjects.Text;
  private orderCard!: Phaser.GameObjects.Container;
  private orderSeal!: Phaser.GameObjects.Image;
  private orderHead!: Phaser.GameObjects.Text;
  private orderTitle!: Phaser.GameObjects.Text;
  private orderDesc!: Phaser.GameObjects.Text;
  private gameOver!: Phaser.GameObjects.Container;
  private gameOverTitle!: Phaser.GameObjects.Text;
  private gameOverText!: Phaser.GameObjects.Text;
  private medalText!: Phaser.GameObjects.Text;
  private boonRows: { id: BoonId; bg: Phaser.GameObjects.Rectangle; cost: Phaser.GameObjects.Text }[] = [];
  private shipRows: { id: HullId; bg: Phaser.GameObjects.Rectangle; name: Phaser.GameObjects.Text; desc: Phaser.GameObjects.Text }[] = [];
  private againButton!: Phaser.GameObjects.Container;
  private sailOnButton!: Phaser.GameObjects.Container;
  /** The Admiralty's medals banked across runs, once this run's are added at its end. */
  private medalBank = 0;
  /** The starting upgrades chosen on the game-over panel for the next run. */
  private commission: BoonId[] = [];
  /** The ship chosen on the game-over panel for the next run. */
  private nextHull: HullId = FIRST_HULL;
  private windText!: Phaser.GameObjects.Text;
  private windRose!: Phaser.GameObjects.Image;
  private shotTexts!: Record<Side, Phaser.GameObjects.Text>;
  private boardLabel!: Phaser.GameObjects.Text;
  private scuttleButton!: Phaser.GameObjects.Container;
  private scuttleText!: Phaser.GameObjects.Text;
  private keys!: Record<'left' | 'right' | 'a' | 'd' | 'q' | 'e' | 'r', Phaser.Input.Keyboard.Key>;
  /** A night wave's dark, the lanterns and flashes drawn over it, and the flare button (made on the first night, see `drawNight`). */
  private night!: Phaser.GameObjects.Image;
  private glow!: Phaser.GameObjects.Graphics;
  private flareButton: Phaser.GameObjects.Container | null = null;
  private flareText!: Phaser.GameObjects.Text;
  /** How many sea beasts the saved harbor wall holds, so a new one is saved once. */
  private savedWall = 0;
  /** Which control each pointer (finger or mouse) is holding down. */
  private held = new Map<number, Control>();
  /** A fire control pressed since the last frame, so even a tap shorter than a frame fires. */
  private tapped: Record<Side, boolean> = { port: false, starboard: false };
  private clock = 0;
  private lastWake = 0;
  private lastFrame: number | null = null;
  /** Plays the sound and music for what each tick changed. */
  private cues!: SoundCues;

  constructor() {
    super('Game');
  }

  create(data?: { boons?: BoonId[]; hull?: HullId; daily?: boolean }) {
    for (const map of [this.ships, this.forts, this.balls, this.sinking, this.floaters, this.captainLabels]) map.clear();
    this.loot.clear();
    this.wakes = [];
    this.held.clear();
    this.tapped = { port: false, starboard: false };
    this.controlHits = [];
    this.lastFrame = null;
    this.dailyButton = null;
    this.flareButton = null;
    this.commission = [];
    this.boonRows = [];
    this.shipRows = [];
    // A fresh page sails the ship chosen last, if the best wave still unlocks it.
    const best = loadBestWave();
    const own = data?.hull ?? (unlocked(loadHull(), best) ? loadHull() : FIRST_HULL);
    this.nextHull = own;
    // The daily voyage draws its ship, its perks and then the whole run from the day's seeded sea;
    // any other run draws from Math.random.
    const rand = data?.daily ? dailyRand(DAILY_GAME) : undefined;
    const voyage = rand ? drawVoyage(rand) : null;
    useRandom(rand);
    this.daily = loadDaily(DAILY_GAME);
    const extras = { log: loadLog(), reachesBest: loadReachesBest(), wall: loadWall(), daily: voyage ? { perks: voyage.perks } : undefined };
    this.state = newRun(best, voyage ? [] : (data?.boons ?? []), voyage?.hull ?? own, extras);
    this.savedLog = this.state.log.length;
    this.savedWall = this.state.wall.kraken + this.state.wall.serpent;
    this.view = { x: this.state.player.x, y: this.state.player.y };
    this.lastPlayer = { ...this.view };
    this.cues = new SoundCues(this.state);

    // The chart is the whole sea; it fills the screen and scrolls with the camera, repeating where
    // the sea wraps.
    // Images rather than a tile sprite, so the sea is painted as finely as the screen needs.
    this.sea = [0, 1, 2, 3].map(() => this.add.image(0, 0, 'sea').setOrigin(0).setScale(1 / SEA_RES));
    this.arcs = this.add.graphics().setDepth(2);
    this.reefLines = this.add.graphics().setDepth(2.2);
    this.course = this.add.graphics().setDepth(2.5);
    this.wakeLines = this.add.graphics().setDepth(3);
    this.fx = this.add.graphics().setDepth(5);
    this.labels = this.add.graphics().setDepth(7);
    this.aimLabel = this.add.text(0, 0, '', textStyle(13, '#6a4410', 'bold italic')).setOrigin(0.5).setDepth(8);
    this.courseLabel = this.add.text(0, 0, '', textStyle(12, '#2b2118', 'bold italic', '#f0e2c0', 4)).setOrigin(0.5).setDepth(8);
    this.boardLabel = this.add.text(0, 0, '', textStyle(13, '#6a4410', 'bold italic', '#f6ecd2', 4)).setOrigin(0.5).setDepth(8);
    this.convoyLabel = this.add.text(0, 0, '', textStyle(12, '#2f5a3a', 'bold italic', '#f6ecd2', 4)).setOrigin(0.5).setDepth(8);
    this.bars = this.add.graphics().setDepth(UI_DEPTH - 40);
    this.rain = this.add.graphics().setScrollFactor(0).setDepth(UI_DEPTH - 35);
    this.night = this.add.image(0, 0, 'night').setOrigin(0).setScale(1 / SHEET_RES).setScrollFactor(0).setDepth(NIGHT_DEPTH).setVisible(false);
    this.glow = this.add.graphics().setDepth(GLOW_DEPTH);
    this.add.image(0, 0, 'frame').setOrigin(0).setScale(1 / SHEET_RES).setScrollFactor(0).setDepth(UI_DEPTH - 30);

    this.createHud();
    this.createOrderCard();
    this.createControls();
    this.createScuttle();
    this.harbor = new Harbor(this, (id) => this.harborAction(id));
    this.createGameOver();
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: kb.addKey(K.LEFT),
      right: kb.addKey(K.RIGHT),
      a: kb.addKey(K.A),
      d: kb.addKey(K.D),
      q: kb.addKey(K.Q),
      e: kb.addKey(K.E),
      r: kb.addKey(K.R),
    };
    this.keys.r.on('down', () => this.flare());
  }

  update(time: number) {
    // Game time from the frame's own timestamp rather than Phaser's smoothed delta, which holds
    // every step to 16ms while the page is not in focus.
    const dt = this.lastFrame === null ? 0 : Phaser.Math.Clamp(time - this.lastFrame, 0, MAX_STEP_MS);
    this.lastFrame = time;
    const s = this.state;
    const phase = s.phase;
    this.cues.before(s);
    this.readInput();
    tick(s, dt);
    checkTrophies(s);
    this.cues.after(s, dt);
    // A captain sunk goes into the lasting log at once, even on the daily voyage.
    if (s.log.length > this.savedLog) {
      saveLog(s.log);
      this.savedLog = s.log.length;
    }
    // So does a sea beast sunk, on the harbor wall.
    if (s.wall.kraken + s.wall.serpent > this.savedWall) {
      saveWall(s.wall);
      this.savedWall = s.wall.kraken + s.wall.serpent;
    }
    // The daily voyage keeps no best wave and earns no medals: it keeps its score instead.
    if (s.phase !== phase && (s.phase === 'harbor' || s.phase === 'over' || s.phase === 'won') && !s.daily) {
      saveBestWave(s.bestWave);
      if (s.reachesBest > loadReachesBest()) saveReachesBest(s.reachesBest);
    }
    if (s.phase !== phase && (s.phase === 'over' || s.phase === 'won')) {
      this.medalBank = loadMedals() + (s.daily ? 0 : s.medals);
      saveMedals(this.medalBank);
      this.commission = [];
      if (s.daily) this.daily = finishDaily(DAILY_GAME, voyageScore(s));
    }
    this.clock += dt;

    this.followPlayer();
    this.placeSea();
    this.drawWakes(dt);
    this.drawReefs();
    this.drawCourses();
    this.drawShips();
    this.drawBalls();
    this.drawLoot();
    this.drawEffects();
    this.drawArcs();
    this.drawRain();
    this.drawNight();
    this.drawHud();
    this.drawControls();
    this.drawScuttle();
    this.harbor.show(s.phase === 'harbor' ? s : null);
    const ended = s.phase === 'over' || s.phase === 'won';
    this.gameOver.setVisible(ended);
    if (ended) this.drawGameOver();
  }

  /** Writes the helm and the fire controls into the state, from the keys and the pointers. */
  private readInput() {
    const s = this.state;
    const holding = new Set(this.held.values());
    const pointerHelm = holding.has('helm-port') === holding.has('helm-starboard') ? 0 : holding.has('helm-port') ? -1 : 1;
    const left = this.keys.left.isDown || this.keys.a.isDown;
    const right = this.keys.right.isDown || this.keys.d.isDown;
    s.helm = left !== right ? (left ? -1 : 1) : pointerHelm;
    const sailing = s.phase === 'break' || s.phase === 'fighting';
    s.aim.port = sailing && (this.keys.q.isDown || holding.has('fire-port') || this.tapped.port);
    s.aim.starboard = sailing && (this.keys.e.isDown || holding.has('fire-starboard') || this.tapped.starboard);
    this.tapped = { port: false, starboard: false };
  }

  /** Moves `view` along with the player's ship and centres the camera on it. */
  private followPlayer() {
    const { dx, dy } = offset(this.lastPlayer, this.state.player);
    this.view.x += dx;
    this.view.y += dy;
    this.lastPlayer = { x: this.state.player.x, y: this.state.player.y };
    this.topLeft = { x: Math.round(this.view.x - VIEW.w / 2), y: Math.round(this.view.y - VIEW.h / 2) };
    // The camera keeps its top-left origin (see shared/scaling.ts), so its scroll is that corner.
    this.cameras.main.setScroll(this.topLeft.x, this.topLeft.y);
  }

  /** Moves the four copies of the sea to the corners of the sea the top-left of the screen is in. */
  private placeSea() {
    const v = this.topLeft;
    const x = Math.floor(v.x / WORLD.w) * WORLD.w;
    const y = Math.floor(v.y / WORLD.h) * WORLD.h;
    this.sea.forEach((img, i) => img.setPosition(x + (i % 2) * WORLD.w, y + Math.floor(i / 2) * WORLD.h));
  }

  /**
   * Where to draw something at `p` on the sea: its copy nearest the player's ship, which is the
   * one on screen. The sea is bigger than the screen, so only one copy can ever be in sight.
   */
  private place(p: { x: number; y: number }) {
    const { dx, dy } = offset(this.state.player, p);
    return { x: this.view.x + dx, y: this.view.y + dy };
  }

  /** A harbor row, card or sail button: a coin for gold spent, a click for a choice, the buzz when refused. */
  private harborAction(id: HarborAction) {
    const s = this.state;
    let done: boolean;
    let spent = false;
    if (id === 'sail') done = setSail(s);
    else if (id.startsWith('sail-')) done = setSail(s, id.slice('sail-'.length) as CourseId);
    else if (id === 'load-port' || id === 'load-starboard') done = loadShot(s, id === 'load-port' ? 'port' : 'starboard');
    else if (id.startsWith('draft-')) done = pickPerk(s, id.slice('draft-'.length) as PerkId);
    else if (id.startsWith('trade-')) {
      spent = true;
      done = trade(s, id.slice('trade-'.length) as CargoId);
    } else {
      spent = true;
      if (id === 'keep') done = keep(s);
      else if (id === 'repair') done = repair(s);
      else if (id === 'hire') done = hire(s);
      else done = buy(s, id as UpgradeId);
    }
    ui(!done ? 'refuse' : spent ? 'coin' : 'click');
  }

  private drawShips() {
    const s = this.state;
    const seen = new Set<number>();
    this.bars.clear();
    for (const ship of [s.player, ...s.enemies, ...s.escorts]) {
      seen.add(ship.id);
      let sprite = this.ships.get(ship.id);
      if (!sprite) {
        sprite = this.add.image(0, 0, `ship-${ship.kind === 'player' ? s.hull : ship.kind}`).setScale(1 / HI).setDepth(4);
        this.ships.set(ship.id, sprite);
      }
      // A gentle roll on the swell.
      const roll = settings.reduceMotion ? 0 : Math.sin(this.clock / 420 + ship.id) * 0.03;
      const at = this.place(ship);
      sprite.setPosition(at.x, at.y).setRotation(ship.heading + roll);
      // A sea beast shows only while its head is up, rising out of the water and sinking back.
      if (isBeast(ship.kind)) {
        const up = afloat(ship);
        const rise = up ? Math.min(1, (HEAD_MS - ship.surfaceMs) / RISE_MS, ship.surfaceMs / RISE_MS) : 0;
        sprite.setVisible(up).setAlpha(rise).setScale((0.75 + 0.25 * rise) / HI);
        if (!up) continue;
      }
      // At night a ship lit by the flash of her own guns shows over the dark.
      sprite.setDepth(s.night && ship.flashMs > 0 && ship.kind !== 'player' ? LIT_DEPTH : 4);
      // Reduce motion holds the hull still rather than flashing it on a hit.
      if (ship.hitMs > 0 && !settings.reduceMotion) sprite.setTint(0xffc090).setTintMode(Phaser.TintModes.MULTIPLY);
      else sprite.clearTint();
      const escort = s.escorts.includes(ship);
      // An enemy out of sight in the dark shows no hull bar.
      if (ship.kind !== 'player' && (escort || inSight(s, ship))) this.drawHpBar(ship, escort);
      if (ship.slowMs > 0) this.drawSlowed(ship);
      if (ship.jamMs > 0) this.drawJammed(ship);
      if (escort) this.drawPrize(ship);
    }
    this.drawBoarding();
    this.drawConvoy();
    this.drawCaptains();
    for (const [id, sprite] of this.ships) {
      if (seen.has(id)) continue;
      sprite.destroy();
      this.ships.delete(id);
    }
    this.drawForts();
  }

  /** The wave's shore forts on their islands, each with its hull bar and a flash when hit. */
  private drawForts() {
    const s = this.state;
    const seen = new Set<number>();
    for (const fort of s.forts) {
      seen.add(fort.id);
      let sprite = this.forts.get(fort.id);
      if (!sprite) {
        sprite = this.add.image(0, 0, 'fort').setScale(1 / HI).setDepth(3.5);
        this.forts.set(fort.id, sprite);
      }
      const at = this.place(fort);
      sprite.setPosition(at.x, at.y);
      if (fort.hitMs > 0 && !settings.reduceMotion) sprite.setTint(0xffc090).setTintMode(Phaser.TintModes.MULTIPLY);
      else sprite.clearTint();
      const x = Math.round(at.x - HP_BAR_W / 2);
      const y = Math.round(at.y - FORT.radius - 22);
      const fill = (HP_BAR_W - 2) * Phaser.Math.Clamp(fort.hp / fort.maxHp, 0, 1);
      const g = this.bars;
      g.fillStyle(0xf3e6c4).fillRect(x, y, HP_BAR_W, 5);
      g.fillStyle(0xb04634, 0.9).fillRect(x + 1, y + 1, fill, 3);
      g.lineStyle(0.75, INK).strokeRect(x, y, HP_BAR_W, 5);
      for (let k = 1; k < 4; k++) g.lineBetween(x + (k * HP_BAR_W) / 4, y, x + (k * HP_BAR_W) / 4, y + 5);
    }
    for (const [id, sprite] of this.forts) {
      if (seen.has(id)) continue;
      sprite.destroy();
      this.forts.delete(id);
    }
  }

  /** An enemy's hull, as a little scale bar over it once it has been hit. */
  private drawHpBar(ship: Ship, escort: boolean) {
    // A prize's bar is always shown, in green; the flagships' too (the admiral's included), so they read as the big ones.
    if (ship.hp >= ship.maxHp && !escort && ship.kind !== 'flagship' && ship.kind !== 'admiral' && ship.kind !== 'tempest' && !isBeast(ship.kind) && !ship.captain) return;
    const at = this.place(ship);
    const x = Math.round(at.x - HP_BAR_W / 2);
    const y = Math.round(at.y - lookOf(ship, this.state.hull).length / 2 - 14);
    const fill = (HP_BAR_W - 2) * Phaser.Math.Clamp(ship.hp / ship.maxHp, 0, 1);
    const g = this.bars;
    g.fillStyle(0xf3e6c4).fillRect(x, y, HP_BAR_W, 5);
    g.fillStyle(escort ? 0x5a8c50 : 0xb04634, 0.9).fillRect(x + 1, y + 1, fill, 3);
    g.lineStyle(0.75, INK).strokeRect(x, y, HP_BAR_W, 5);
    for (let k = 1; k < 4; k++) g.lineBetween(x + (k * HP_BAR_W) / 4, y, x + (k * HP_BAR_W) / 4, y + 5);
  }

  /** A ship slowed by chain shot: a dotted ring of tangled rigging round it. */
  private drawSlowed(ship: Ship) {
    const at = this.place(ship);
    const r = radiusOf(ship) + 7;
    const g = this.bars;
    g.fillStyle(0x7a5410, 0.9);
    const turn = settings.reduceMotion ? 0 : this.clock / 900;
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2 + turn;
      g.fillCircle(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, k % 3 === 0 ? 1.8 : 1.1);
    }
  }

  /** A ship hit by grapeshot, its gun crews cut up: short ink dashes round it, slowly reloading. */
  private drawJammed(ship: Ship) {
    const at = this.place(ship);
    const r = radiusOf(ship) + 12;
    const g = this.bars;
    g.lineStyle(1.2, INK, 0.8);
    for (let k = 0; k < 10; k++) {
      const a = (k / 10) * Math.PI * 2;
      g.lineBetween(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, at.x + Math.cos(a + 0.18) * r, at.y + Math.sin(a + 0.18) * r);
    }
  }

  /** One of the player's prizes: a ring of green dots, and the little pennant of a prize crew. */
  private drawPrize(ship: Ship) {
    const at = this.place(ship);
    const r = radiusOf(ship) + 9;
    const g = this.bars;
    g.fillStyle(GREEN, 0.9);
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      g.fillCircle(at.x + Math.cos(a) * r, at.y + Math.sin(a) * r, k % 4 === 0 ? 2 : 1.3);
    }
  }

  /**
   * Crippled enemies that can be boarded: a dashed ochre ring of grappling lines, filled round as
   * the player stays alongside, and a label on the nearest.
   */
  private drawBoarding() {
    const s = this.state;
    const g = this.bars;
    this.boardLabel.setVisible(false);
    if (s.phase !== 'fighting') return;
    let nearest: Ship | null = null;
    let best = Infinity;
    for (const e of s.enemies) {
      if (!boardable(e, s.renown)) continue;
      const at = this.place(e);
      const r = radiusOf(e) + 16;
      g.lineStyle(2, OCHRE, 0.95);
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        g.beginPath().arc(at.x, at.y, r, a, a + 0.3).strokePath();
      }
      if (e.boardMs > 0) g.lineStyle(5, OCHRE, 1).beginPath().arc(at.x, at.y, r + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, e.boardMs / boardMs(s))).strokePath();
      const { dx, dy } = offset(s.player, e);
      if (Math.hypot(dx, dy) < best) {
        best = Math.hypot(dx, dy);
        nearest = e;
      }
    }
    if (!nearest) return;
    const at = this.place(nearest);
    const label = t(nearest.boardMs > 0 ? 'boarding' : canBoard(s, nearest) ? 'crippled' : 'crippledFewCrew');
    this.boardLabel.setText(label).setPosition(at.x, at.y - radiusOf(nearest) - 36).setVisible(true);
  }

  /** The name over each named captain's ship: wanted with her bounty once she has got away, and running when she flees. */
  private drawCaptains() {
    const s = this.state;
    const seen = new Set<number>();
    for (const e of s.enemies) {
      if (!e.captain) continue;
      seen.add(e.id);
      let label = this.captainLabels.get(e.id);
      if (!label) {
        label = this.add.text(0, 0, '', textStyle(13, '#7a2a1a', 'bold italic', '#f6ecd2', 4)).setOrigin(0.5).setDepth(8);
        this.captainLabels.set(e.id, label);
      }
      const name = t(CAPTAINS[e.captain].name);
      const gold = captainBounty(s.captains[e.captain].escapes);
      const text = e.escapeMs > 0 ? t('captainFlees', { name }) : gold ? t('captainWanted', { name, gold }) : name;
      const at = this.place(e);
      // Under the hull, clear of the hull bar and the boarding label over it.
      label.setText(text).setPosition(at.x, at.y + lookOf(e, s.hull).length / 2 + 14).setVisible(inSight(s, e));
    }
    for (const [id, label] of this.captainLabels) {
      if (seen.has(id)) continue;
      label.destroy();
      this.captainLabels.delete(id);
    }
  }

  /** The Storm Reaches' reefs: dark rocks awash, ringed with breakers (which roll in and out, held still with reduce motion). */
  private drawReefs() {
    const s = this.state;
    const g = this.reefLines;
    g.clear();
    if (s.phase !== 'fighting' && s.phase !== 'break') return;
    for (const reef of s.reefs) {
      const at = this.place(reef);
      const swell = settings.reduceMotion ? 0.5 : (Math.sin(this.clock / 500 + reef.id) + 1) / 2;
      g.fillStyle(0xf6ecd2, 0.55).fillCircle(at.x, at.y, reef.r + 10 + swell * 4);
      g.lineStyle(1, INK, 0.55);
      for (let k = 0; k < 20; k++) {
        const a = (k / 20) * Math.PI * 2;
        const r = reef.r + 8 + swell * 4;
        g.beginPath().arc(at.x, at.y, r, a, a + 0.16).strokePath();
      }
      // A cluster of rocks, the same for each reef every frame.
      const rocks: [number, number, number][] = [[0, 0, 0.55], [0.45, 0.25, 0.38], [-0.4, 0.3, 0.34], [0.1, -0.45, 0.36], [-0.35, -0.3, 0.28]];
      for (const [dx, dy, r] of rocks) {
        g.fillStyle(0x4a3c30, 1).fillCircle(at.x + dx * reef.r, at.y + dy * reef.r, r * reef.r);
        g.lineStyle(1, INK, 1).strokeCircle(at.x + dx * reef.r, at.y + dy * reef.r, r * reef.r);
      }
      // The chart's cross-hatched danger mark round the rocks.
      g.lineStyle(1.2, RUST, 0.85).strokeCircle(at.x, at.y, reef.r + 2);
    }
  }

  /** A squall's rain: grey streaks slanting with the new wind across the screen, faded out in its last second (and held still with reduce motion). */
  private drawRain() {
    const s = this.state;
    const g = this.rain;
    g.clear();
    const sailing = s.phase === 'fighting' || s.phase === 'break';
    if (!sailing || s.squallBlowMs <= 0) return;
    const fade = Math.min(1, s.squallBlowMs / 1000);
    g.fillStyle(0x5a6a70, 0.12 * fade).fillRect(0, 0, VIEW.w, VIEW.h);
    const dx = Math.cos(s.wind) * 10 + 4;
    const dy = Math.sin(s.wind) * 10 + 14;
    const fall = settings.reduceMotion ? 0 : this.clock / 2;
    g.lineStyle(1, 0x3a4a52, 0.45 * fade);
    for (let k = 0; k < 90; k++) {
      // Spread with a fixed scatter, never Math.random, and swept along with the clock.
      const x = (((k * 137.5 + fall * (dx / 14)) % VIEW.w) + VIEW.w) % VIEW.w;
      const y = (((k * 71.3 + fall) % VIEW.h) + VIEW.h) % VIEW.h;
      g.lineBetween(x, y, x + dx, y + dy);
    }
  }

  /**
   * The convoy: a label over the merchantman naming her island, and round the island the dashed
   * green ring she must reach.
   */
  private drawConvoy() {
    const s = this.state;
    const ship = convoyShip(s);
    this.convoyLabel.setVisible(!!ship && (s.phase === 'fighting' || s.phase === 'break'));
    if (!ship || !s.convoy) return;
    const island = ISLANDS[s.convoy.island];
    const at = this.place(ship);
    this.convoyLabel.setText(t('convoyFor', { island: t(island.name) })).setPosition(at.x, at.y - lookOf(ship, s.hull).length / 2 - 28);
    const c = this.place(island);
    const g = this.bars;
    g.lineStyle(2, GREEN, 0.9);
    const rx = island.rx + CONVOY_ARRIVE;
    const ry = island.ry + CONVOY_ARRIVE;
    for (let k = 0; k < 24; k++) {
      const a0 = (k / 24) * Math.PI * 2;
      const a1 = a0 + 0.14;
      g.lineBetween(c.x + Math.cos(a0) * rx, c.y + Math.sin(a0) * ry, c.x + Math.cos(a1) * rx, c.y + Math.sin(a1) * ry);
    }
  }

  /** Engraved foam lines spreading from each ship's stern. */
  private drawWakes(dt: number) {
    const s = this.state;
    const sailing = s.phase === 'break' || s.phase === 'fighting';
    if (sailing && this.clock - this.lastWake >= WAKE_EVERY_MS) {
      this.lastWake = this.clock;
      for (const ship of [s.player, ...s.enemies, ...s.escorts]) {
        // A sea beast's head leaves no wake.
        if (isBeast(ship.kind)) continue;
        const look = lookOf(ship, s.hull);
        const back = look.length * 0.45;
        this.wakes.push({
          x: ship.x - Math.cos(ship.heading) * back,
          y: ship.y - Math.sin(ship.heading) * back,
          heading: ship.heading,
          ms: WAKE_MS,
          size: look.beam * 0.3,
        });
      }
    }
    for (const w of this.wakes) w.ms -= dt;
    this.wakes = this.wakes.filter((w) => w.ms > 0);
    const g = this.wakeLines;
    g.clear();
    for (const w of this.wakes) {
      const t = 1 - w.ms / WAKE_MS;
      const at = this.place(w);
      const spread = w.size * (1 + t * 2.2);
      const cx = Math.cos(w.heading);
      const cy = Math.sin(w.heading);
      g.lineStyle(1, INK, 0.5 * (1 - t));
      for (const side of [-1, 1]) {
        const x = at.x - cy * spread * side;
        const y = at.y + cx * spread * side;
        g.lineBetween(x - cx * 3, y - cy * 3, x + cx * 3, y + cy * 3);
      }
    }
  }

  /** The dotted course of each enemy sailing round an island, with an arrow at its end. */
  private drawCourses() {
    const s = this.state;
    const g = this.course;
    g.clear();
    let labelled = false;
    this.courseLabel.setVisible(false);
    if (s.phase !== 'fighting') return;
    this.drawShells();
    for (const e of s.enemies) {
      const pts = detourCourse(e);
      if (pts.length < 2) continue;
      const at = this.place(e);
      const screen = pts.map((p) => ({ x: at.x + p.x - e.x, y: at.y + p.y - e.y }));
      g.fillStyle(INK, 0.75);
      let n = 0;
      for (let i = 1; i < screen.length; i++) {
        const a = screen[i - 1];
        const b = screen[i];
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        for (let d = i === 1 ? 26 : 0; d < len; d += 9) {
          const k = d / len;
          g.fillCircle(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k, n++ % 4 === 0 ? 2 : 1.3);
        }
      }
      const end = screen[screen.length - 1];
      const prev = screen[screen.length - 2];
      const dir = Math.atan2(end.y - prev.y, end.x - prev.x);
      g.lineStyle(1.5, INK, 0.85);
      g.beginPath();
      g.moveTo(end.x + Math.cos(dir + 2.6) * 10, end.y + Math.sin(dir + 2.6) * 10);
      g.lineTo(end.x + Math.cos(dir) * 3, end.y + Math.sin(dir) * 3);
      g.lineTo(end.x + Math.cos(dir - 2.6) * 10, end.y + Math.sin(dir - 2.6) * 10);
      g.strokePath();
      if (!labelled) {
        labelled = true;
        // Written beside the middle of the course, on the side away from the island.
        const mid = screen[Math.floor(screen.length / 2)];
        const isle = this.place(ISLANDS[e.detour!.island]);
        const away = Math.atan2(mid.y - isle.y, mid.x - isle.x);
        const ship = t(ENEMIES[e.kind as keyof typeof ENEMIES].name);
        this.courseLabel
          .setText(t('steersRound', { ship }))
          .setPosition(mid.x + Math.cos(away) * 22, mid.y + Math.sin(away) * 16)
          .setVisible(true);
      }
    }
  }

  /**
   * Where mortar shells will land: a dashed rust ring on the sea, the size of the blast, with a
   * second ring closing in on the middle as the shell comes down.
   */
  private drawShells() {
    const g = this.course;
    // A sea beast's tentacle about to rise: dark water swirling in rings that close on the spot.
    for (const arm of this.state.tentacles) {
      const at = this.place(arm);
      const t = 1 - arm.ms / arm.total;
      g.fillStyle(0x1e3c3a, 0.1 + 0.25 * t).fillCircle(at.x, at.y, TENTACLE_R);
      g.lineStyle(1.4, 0x1e3c3a, 0.85);
      for (let k = 0; k < 3; k++) {
        const r = TENTACLE_R * (1 - ((t + k / 3) % 1) * 0.8);
        g.strokeEllipse(at.x, at.y, r * 2, r * 1.4);
      }
      g.lineStyle(1.6, RUST, 0.9);
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2;
        g.beginPath().arc(at.x, at.y, TENTACLE_R, a, a + 0.24).strokePath();
      }
    }
    for (const shell of this.state.shells) {
      const at = this.place(shell);
      const t = 1 - shell.ms / shell.total;
      g.fillStyle(RUST, 0.12 + 0.18 * t).fillCircle(at.x, at.y, SHELL_R);
      g.lineStyle(1.6, RUST, 0.9);
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        g.beginPath().arc(at.x, at.y, SHELL_R, a, a + 0.24).strokePath();
      }
      g.lineStyle(1.2, INK, 0.8).strokeCircle(at.x, at.y, Math.max(2, SHELL_R * (1 - t)));
      g.fillStyle(INK, 0.8).fillCircle(at.x, at.y, 2.5);
    }
  }

  private drawBalls() {
    const seen = new Set<number>();
    const g = this.fx;
    g.clear();
    for (const b of this.state.balls) {
      seen.add(b.id);
      let sprite = this.balls.get(b.id);
      if (!sprite) {
        sprite = this.add.image(0, 0, `shot-${b.shot ?? 'round'}`).setScale(1 / HI).setDepth(6);
        if (b.shot === 'powder') sprite.setOrigin(0.75, 0.5);
        this.balls.set(b.id, sprite);
      }
      const at = this.place(b);
      const dir = Math.atan2(b.vy, b.vx);
      // Chain shot tumbles as it flies.
      const spin = b.shot === 'chain' && !settings.reduceMotion ? Math.sin(this.clock / 90 + b.id) * 0.9 : 0;
      sprite.setPosition(at.x, at.y).setRotation(dir + spin);
      // Engraved motion lines behind the shot.
      const cx = Math.cos(dir);
      const cy = Math.sin(dir);
      g.lineStyle(0.75, INK, 0.5);
      for (const o of b.shot === 'grape' ? [0] : [-2.5, 2.5]) {
        g.lineBetween(at.x - cx * 7 - cy * o, at.y - cy * 7 + cx * o, at.x - cx * 18 - cy * o, at.y - cy * 18 + cx * o);
      }
    }
    for (const [id, sprite] of this.balls) {
      if (seen.has(id)) continue;
      sprite.destroy();
      this.balls.delete(id);
    }
  }

  private drawLoot() {
    const seen = new Set<number>();
    for (const l of this.state.loot) {
      seen.add(l.id);
      let item = this.loot.get(l.id);
      if (!item) {
        item = {
          barrel: this.add.image(0, 0, 'loot').setScale(1 / HI).setDepth(3),
          label: this.add.text(0, 0, t('plunder'), textStyle(11, '#2b2118', 'bold italic', '#f0e2c0', 3)).setOrigin(0.5).setDepth(3),
        };
        this.loot.set(l.id, item);
      }
      // Bobbing on the water, and blinking in its last few seconds before it sinks (held faded
      // instead with reduce motion).
      const fading = l.ms < 4000 && (settings.reduceMotion || Math.floor(this.clock / 200) % 2 === 0);
      const at = this.place(l);
      const bob = settings.reduceMotion ? 0 : Math.sin(this.clock / 300 + l.id) * 1.5;
      item.barrel.setPosition(at.x, at.y + bob).setAlpha(fading ? 0.4 : 1);
      item.label.setPosition(at.x, at.y + 22).setAlpha(fading ? 0.4 : 1);
    }
    for (const [id, item] of this.loot) {
      if (seen.has(id)) continue;
      item.barrel.destroy();
      item.label.destroy();
      this.loot.delete(id);
    }
  }

  /** A billow of cannon smoke: overlapping circles, outlined in ink where they meet the chart. */
  private cloud(x: number, y: number, r: number, alpha: number) {
    const g = this.fx;
    const puffs: [number, number, number][] = [[0, 0, r], [r * 0.75, -r * 0.3, r * 0.7], [-r * 0.7, -r * 0.2, r * 0.75], [r * 0.2, r * 0.6, r * 0.7], [-r * 0.45, r * 0.5, r * 0.6]];
    g.lineStyle(1.6, INK, alpha);
    for (const [dx, dy, pr] of puffs) g.strokeCircle(x + dx, y + dy, pr);
    g.fillStyle(0xfaf4e4, alpha);
    for (const [dx, dy, pr] of puffs) g.fillCircle(x + dx, y + dy, pr);
    g.lineStyle(0.6, INK, alpha * 0.35);
    g.beginPath();
    g.arc(x + r * 0.3, y + r * 0.35, r * 0.55, Math.PI, Math.PI * 1.5);
    g.strokePath();
  }

  private drawEffects() {
    const g = this.fx;
    const sinking = new Set<number>();
    const floaters = new Set<number>();
    for (const fx of this.state.effects) {
      const age = 1 - fx.ms / fx.total;
      const e = { ...fx, ...this.place(fx) };
      if (e.kind === 'smoke') {
        const out = e.heading ?? 0;
        const drift = 5 + age * 12;
        this.cloud(e.x + Math.cos(out) * drift, e.y + Math.sin(out) * drift, 4 + age * 6, Math.min(1, (1 - age) * 2.5));
      } else if (e.kind === 'splash') {
        const a = 1 - age;
        g.lineStyle(0.9, INK, a);
        for (let k = 0; k < 7; k++) {
          const ang = -Math.PI + (k / 6) * Math.PI;
          g.lineBetween(e.x + Math.cos(ang) * 3, e.y + Math.sin(ang) * 1.5, e.x + Math.cos(ang) * (6 + age * 4), e.y + Math.sin(ang) * (6 + age * 3));
        }
        g.strokeEllipse(e.x, e.y + 1, 18 + age * 8, 6 + age * 3);
      } else if (e.kind === 'hit') {
        const a = 1 - age;
        g.lineStyle(0.9, INK, a);
        for (let k = 0; k < 12; k++) {
          const ang = (k / 12) * Math.PI * 2 + 0.13;
          const r = (k % 2 ? 12 : 8) * (0.6 + age * 0.6);
          g.lineBetween(e.x + Math.cos(ang) * 3, e.y + Math.sin(ang) * 3, e.x + Math.cos(ang) * r, e.y + Math.sin(ang) * r);
        }
        g.fillStyle(OCHRE, a).fillCircle(e.x, e.y, 3.5);
        g.lineStyle(0.75, INK, a).strokeCircle(e.x, e.y, 3.5);
      } else if (e.kind === 'blast') {
        // A burst of fire: an ochre and orange flash spreading to the blast's reach, ink rays and smoke.
        const r = (e.size ?? 40) * Math.min(1, 0.4 + age * 1.2);
        const a = 1 - age;
        g.fillStyle(0xe07828, 0.45 * a).fillCircle(e.x, e.y, r);
        g.fillStyle(0xf0c860, 0.7 * a).fillCircle(e.x, e.y, r * 0.55);
        g.lineStyle(1.2, INK, a);
        for (let k = 0; k < 16; k++) {
          const ang = (k / 16) * Math.PI * 2 + 0.1;
          g.lineBetween(e.x + Math.cos(ang) * r * 0.6, e.y + Math.sin(ang) * r * 0.6, e.x + Math.cos(ang) * r * (k % 2 ? 1 : 1.15), e.y + Math.sin(ang) * r * (k % 2 ? 1 : 1.15));
        }
        g.strokeCircle(e.x, e.y, r);
        this.cloud(e.x, e.y - age * 14, 6 + age * 10, Math.min(1, a * 1.6));
      } else if (e.kind === 'sink' && e.ship) {
        sinking.add(e.id);
        let sprite = this.sinking.get(e.id);
        if (!sprite) {
          sprite = this.add.image(e.x, e.y, `ship-${e.ship}`).setDepth(3).setTint(0x9a8460).setTintMode(Phaser.TintModes.MULTIPLY);
          this.sinking.set(e.id, sprite);
        }
        sprite.setPosition(e.x, e.y).setRotation((e.heading ?? 0) + age * 0.6).setScale((1 - age * 0.5) / HI).setAlpha(1 - age);
        g.lineStyle(1, INK, 0.6 * (1 - age));
        g.strokeEllipse(e.x, e.y, 20 + age * 60, 10 + age * 30);
        g.strokeEllipse(e.x, e.y, 10 + age * 36, 5 + age * 18);
      } else if (e.kind === 'tentacle') {
        // An arm rising out of the sea and slapping down again, ringed with suckers.
        const height = Math.sin(age * Math.PI);
        const skin = e.ship === 'serpent' ? 0x5f8a6a : 0xa8604c;
        const sway = settings.reduceMotion ? 0 : age * 2;
        for (let k = 0; k <= 12; k++) {
          const u = k / 12;
          const x = e.x + Math.sin(u * 3 + sway) * 10 * u;
          const y = e.y - u * 50 * height;
          const r = (1 - u) * 7 + 1.5;
          g.fillStyle(skin, 1).fillCircle(x, y, r);
          g.lineStyle(1, INK, 0.9).strokeCircle(x, y, r);
          if (k % 3 === 1) g.fillStyle(CREAM, 1).fillCircle(x - r * 0.4, y, 1.2);
        }
        g.lineStyle(1, INK, 0.6 * (1 - age)).strokeEllipse(e.x, e.y + 2, 30 + age * 20, 10 + age * 6);
      } else if (e.kind === 'coins' || e.kind === 'prize' || e.kind === 'escape') {
        floaters.add(e.id);
        let text = this.floaters.get(e.id);
        if (!text) {
          const caption = e.kind === 'coins' ? t('goldGained', { gold: e.gold ?? 0 }) : t(e.kind === 'prize' ? 'prizeTaken' : 'gotAway');
          text = this.add.text(e.x, e.y, caption, textStyle(e.kind === 'coins' ? 15 : 18, e.kind === 'coins' ? '#6a4410' : '#2f5a3a', 'bold italic', '#f6ecd2', 4)).setOrigin(0.5).setDepth(UI_DEPTH - 50);
          this.floaters.set(e.id, text);
        }
        text.setPosition(e.x, e.y - 16 - age * 22).setAlpha(1 - age);
      }
    }
    // Fireships trail smoke from the pitch burning on their decks.
    for (const ship of this.state.enemies) {
      if (ship.kind !== 'fireship') continue;
      const at = this.place(ship);
      for (let k = 0; k < 3; k++) {
        const t = settings.reduceMotion ? k / 3 : (this.clock / 700 + k / 3) % 1;
        const back = 14 + t * 30;
        this.cloud(at.x - Math.cos(ship.heading) * back, at.y - Math.sin(ship.heading) * back, 3 + t * 5, (1 - t) * 0.8);
      }
    }
    for (const [map, seen] of [[this.sinking, sinking], [this.floaters, floaters]] as const) {
      for (const [id, obj] of map as Map<number, Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject>) {
        if (seen.has(id)) continue;
        obj.destroy();
        map.delete(id);
      }
    }
  }

  /**
   * The broadsides' firing arcs. At rest each is a dotted ink wedge out to the guns' full reach
   * (fainter while reloading). Held, it becomes an ochre wash out to the reach of the charge so
   * far, with a sextant scale along its rim that the charge fills.
   */
  private drawArcs() {
    const g = this.arcs;
    const lg = this.labels;
    g.clear();
    lg.clear();
    this.aimLabel.setVisible(false);
    const s = this.state;
    if (s.phase !== 'fighting' && s.phase !== 'break') return;
    const p = { ...s.player, ...this.view };
    const ARC = stats(s).arc;
    const at = (a: number, r: number) => ({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r });
    for (const side of SIDES) {
      const out = p.heading + (side === 'starboard' ? Math.PI / 2 : -Math.PI / 2);
      // Each side's reach: shorter for grapeshot, and further fired downwind.
      const wind = windReach(s.wind, out);
      const full = sideRange(s, side) * wind;
      const a0 = out - ARC;
      const a1 = out + ARC;
      const charge = s.charge[side];
      const loaded = p.reload[side] <= 0;
      if (charge === null && !s.aim[side]) {
        g.fillStyle(INK, loaded ? 0.6 : 0.25);
        for (const a of [a0, a1]) for (let d = 30; d < full; d += 9) g.fillCircle(at(a, d).x, at(a, d).y, 1.1);
        const steps = Math.round((full * ARC * 2) / 9);
        for (let k = 0; k <= steps; k++) {
          const q = at(a0 + ((a1 - a0) * k) / steps, full);
          g.fillCircle(q.x, q.y, 1.1);
        }
        continue;
      }
      const c = charge ?? 0;
      const reach = reachOf(full / wind, c) * wind;
      g.fillStyle(WASH, 0.1).slice(p.x, p.y, reach * 0.55, a0, a1).fillPath();
      g.fillStyle(WASH, 0.24).slice(p.x, p.y, reach, a0, a1).fillPath();
      g.lineStyle(1.1, INK, 0.9);
      g.lineBetween(p.x, p.y, at(a0, reach).x, at(a0, reach).y);
      g.lineBetween(p.x, p.y, at(a1, reach).x, at(a1, reach).y);
      // The rim: a graduated band the charge fills in ochre, like the scale of a sextant.
      const r0 = reach;
      const r1 = reach + 12;
      g.lineStyle(12, CREAM, 0.95).beginPath().arc(p.x, p.y, (r0 + r1) / 2, a0, a1).strokePath();
      if (c > 0) g.lineStyle(8, OCHRE, 1).beginPath().arc(p.x, p.y, (r0 + r1) / 2, a0, a0 + (a1 - a0) * c).strokePath();
      g.lineStyle(1, INK, 1);
      g.beginPath().arc(p.x, p.y, r0, a0, a1).strokePath();
      g.beginPath().arc(p.x, p.y, r1, a0, a1).strokePath();
      for (let k = 0; k <= 40; k++) {
        const a = a0 + ((a1 - a0) * k) / 40;
        const l = k % 10 === 0 ? 12 : k % 5 === 0 ? 8 : 4;
        g.lineStyle(k % 10 === 0 ? 1 : 0.5, INK, 1).lineBetween(at(a, r1).x, at(a, r1).y, at(a, r1 - l).x, at(a, r1 - l).y);
      }
      // How far a full charge reaches, dotted, while it is still building.
      if (c < 1) {
        g.fillStyle(INK, 0.45);
        const steps = Math.round((full * ARC * 2) / 8);
        for (let k = 0; k <= steps; k++) {
          const q = at(a0 + ((a1 - a0) * k) / steps, full + 6);
          g.fillCircle(q.x, q.y, 0.8);
        }
      }
      // A label on a little cream ribbon just off the start of the rim.
      const label = !loaded ? t('aimLoading') : c >= 1 ? t('aimFire') : t('aimCharge', { n: Math.round(c * 100) });
      const spot = at(a0 - 0.05, reach + 30);
      this.aimLabel.setText(label).setPosition(spot.x, spot.y).setVisible(true);
      const w = this.aimLabel.width / 2 + 12;
      const pts = [
        { x: spot.x - w - 7, y: spot.y },
        { x: spot.x - w, y: spot.y - 10 },
        { x: spot.x + w, y: spot.y - 10 },
        { x: spot.x + w + 7, y: spot.y },
        { x: spot.x + w, y: spot.y + 10 },
        { x: spot.x - w, y: spot.y + 10 },
      ];
      lg.fillStyle(CREAM, 1).fillPoints(pts as Phaser.Math.Vector2[], true);
      lg.lineStyle(1, INK, 1).strokePoints(pts as Phaser.Math.Vector2[], true);
    }
  }

  /**
   * A night wave: the dark over the sea (falling during the wave's banner, lifted while a flare
   * burns), and over it each enemy's stern lantern, the flash of guns going off, a glint on each
   * barrel of loot and the flare itself, hanging over where it was fired. The flare button shows
   * how many are left. Firing arcs are drawn over the dark too, so the player can still aim.
   */
  private drawNight() {
    const s = this.state;
    const g = this.glow;
    g.clear();
    const sailing = s.phase === 'break' || s.phase === 'fighting';
    const dark = sailing && s.night;
    this.night.setVisible(dark);
    this.arcs.setDepth(dark ? LIT_DEPTH + 0.01 : 2);
    this.labels.setDepth(dark ? LIT_DEPTH + 0.02 : 7);
    if (dark && !this.flareButton) this.createFlareButton();
    this.flareButton?.setVisible(dark);
    if (!dark) return;
    this.flareText.setText(t('flareButton', { n: s.flares }));
    this.flareButton!.setAlpha(s.flares > 0 ? 1 : 0.5);
    // Dusk falls over the banner; a flare lifts the dark, which comes back over its last second.
    const dusk = s.phase === 'break' ? 1 - s.breakMs / BREAK_MS : 1;
    const flare = s.flareMs > 0 ? Math.max(0, 1 - s.flareMs / 1000) : 1;
    this.night.setAlpha(Phaser.Math.Clamp(Math.min(dusk, 0.12 + 0.88 * flare), 0, 1));
    for (const e of s.enemies) {
      const look = lookOf(e, s.hull);
      const at = this.place(e);
      const lx = at.x - Math.cos(e.heading) * look.length * 0.45;
      const ly = at.y - Math.sin(e.heading) * look.length * 0.45;
      const flicker = settings.reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(this.clock / 90 + e.id);
      g.fillStyle(LANTERN, 0.3 * flicker).fillCircle(lx, ly, 14);
      g.fillStyle(LANTERN, 0.5 * flicker).fillCircle(lx, ly, 6);
      g.fillStyle(0xfff4c8, 1).fillCircle(lx, ly, 2.6);
    }
    for (const fx of s.effects) {
      const at = this.place(fx);
      const age = 1 - fx.ms / fx.total;
      if (fx.kind === 'smoke' && age < 0.4) {
        // A gun's flash, bright and brief.
        const a = 1 - age / 0.4;
        g.fillStyle(0xf8d878, 0.35 * a).fillCircle(at.x, at.y, 16);
        g.fillStyle(0xfff4c8, 0.9 * a).fillCircle(at.x, at.y, 5);
      } else if (fx.kind === 'flare') {
        // The flare hangs high over the ship, swaying down on its little chute.
        const drop = age * 40;
        const fx2 = this.view.x + (settings.reduceMotion ? 0 : Math.sin(this.clock / 400) * 6);
        const fy = this.view.y - 130 + drop;
        const fade = Math.min(1, fx.ms / 1000);
        g.lineStyle(0.8, INK, 0.6 * fade).lineBetween(fx2, fy - 6, fx2 - 7, fy - 16).lineBetween(fx2, fy - 6, fx2 + 7, fy - 16);
        g.fillStyle(LANTERN, 0.3 * fade).fillCircle(fx2, fy, 26);
        g.fillStyle(0xe07828, 0.9 * fade).fillCircle(fx2, fy, 7);
        g.fillStyle(0xfff4c8, fade).fillCircle(fx2, fy, 4);
        g.lineStyle(1.4, 0xe07828, 0.9 * fade);
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          g.lineBetween(fx2 + Math.cos(a) * 8, fy + Math.sin(a) * 8, fx2 + Math.cos(a) * 14, fy + Math.sin(a) * 14);
        }
      }
    }
    for (const l of s.loot) {
      const at = this.place(l);
      g.fillStyle(LANTERN, 0.8).fillCircle(at.x, at.y - 3, 1.8);
    }
  }

  /** The flare button at the foot of the screen, made the first night (a text made at the start would change the first wave). */
  private createFlareButton() {
    const b = makeButton(this, FLARE.x, FLARE.y, '', () => this.flare(), FLARE.w, FLARE.h);
    this.flareText = b.text.setFontSize(16);
    this.flareButton = pinToScreen(b.button).setDepth(UI_DEPTH - 5);
  }

  /** Fires a flare (the button or R): the burst sounds through its effect, the buzz when none is left. */
  private flare() {
    const s = this.state;
    if (!s.night || (s.phase !== 'fighting' && s.phase !== 'break')) return;
    if (!fireFlare(s)) ui('refuse');
  }

  private createHud() {
    this.add.image(0, 0, 'hud-bar').setOrigin(0).setScale(1 / HI).setScrollFactor(0).setDepth(UI_DEPTH);
    this.hud = this.add.graphics().setDepth(UI_DEPTH + 1).setScrollFactor(0);
    const text = (x: number, y: number, size: number, color: string, fontStyle: string) =>
      this.add.text(x, y, '', textStyle(size, color, fontStyle)).setDepth(UI_DEPTH + 2).setScrollFactor(0);
    this.waveText = text(62, 19, 18, '#2b2118', 'bold').setOrigin(0.5);
    // Short of the hull bar at 168.
    fitWidth(text(128, 20, 15, '#2b2118', 'bold italic').setOrigin(0, 0.5).setText(t('hull')), 36);
    this.hullText = text(268, 16, 11, '#2b2118', 'bold').setOrigin(0.5).setStroke('#f6ecd2', 3);
    this.goldText = text(414, 21, 17, '#6a4410', 'bold').setOrigin(0, 0.5);
    this.crewText = text(528, 21, 14, '#2b2118', 'bold italic').setOrigin(0, 0.5);
    this.infoText = text(VIEW.w - 20, 21, 15, '#2b2118', 'bold italic').setOrigin(1, 0.5);
    this.bountyText = this.add
      .text(BOUNTY.x, BOUNTY.y, '', textStyle(12, '#2b2118', 'bold italic', '#f0e2c0', 4))
      .setOrigin(0, 0.5)
      .setDepth(UI_DEPTH - 5)
      .setScrollFactor(0);
    this.convoyText = this.add
      .text(CONVOY.x, CONVOY.y, '', textStyle(12, '#2f5a3a', 'bold italic', '#f0e2c0', 4))
      .setOrigin(0, 0.5)
      .setDepth(UI_DEPTH - 5)
      .setScrollFactor(0);
    this.bannerTitle = this.add
      .text(VIEW.w / 2, BANNER.title, '', textStyle(44, '#2b2118', 'bold', '#f0e2c0', 7))
      .setOrigin(0.5)
      .setDepth(UI_DEPTH + 2)
      .setScrollFactor(0);
    this.windRose = this.add.image(WIND.x, WIND.y, 'wind-rose').setScale(1 / HI).setScrollFactor(0).setDepth(UI_DEPTH - 5);
    this.windText = this.add
      .text(WIND.x, WIND.y + WIND.r + 12, '', textStyle(12, '#2b2118', 'bold italic', '#f0e2c0', 4))
      .setOrigin(0.5)
      .setDepth(UI_DEPTH - 4)
      .setScrollFactor(0);
    this.bannerSub = this.add
      .text(VIEW.w / 2, BANNER.sub, t('sailsSub'), textStyle(22, '#6a4410', 'bold italic', '#f0e2c0', 6))
      .setOrigin(0.5)
      .setDepth(UI_DEPTH + 2)
      .setScrollFactor(0);
  }

  /** The captain's order for the wave: a note pinned under the top bar, sealed in blue wax. */
  private createOrderCard() {
    const { x, y } = ORDER_CARD;
    const card = this.add.image(0, 0, 'order-card').setOrigin(0).setScale(1 / HI);
    this.orderSeal = this.add.image(28, 33, 'seal-chain').setScale(1 / HI);
    this.orderHead = this.add.text(54, 15, '', textStyle(11, '#6a4410', 'bold italic')).setOrigin(0, 0.5);
    this.orderTitle = this.add.text(54, 32, '', textStyle(16, '#2b2118', 'bold')).setOrigin(0, 0.5);
    this.orderDesc = this.add.text(54, 49, '', textStyle(11, '#5a4a38', 'italic')).setOrigin(0, 0.5);
    this.orderCard = pinToScreen(this.add.container(x, y, [card, this.orderSeal, this.orderHead, this.orderTitle, this.orderDesc])).setDepth(UI_DEPTH - 5);
  }

  private drawHud() {
    const s = this.state;
    const g = this.hud;
    g.clear();
    this.waveText.setText(inReaches(s.wave) ? t('reachHud', { wave: reachWave(s.wave) }) : t('wave', { wave: s.wave }));

    // The hull as a scale bar, and under it how loaded each broadside is.
    const hx = 168;
    const hw = 200;
    const fill = (hw - 3) * Phaser.Math.Clamp(s.player.hp / s.player.maxHp, 0, 1);
    g.fillStyle(CREAM).fillRect(hx, 9, hw, 13);
    g.fillStyle(0x5a8c50, 0.85).fillRect(hx + 1.5, 10.5, fill, 10);
    g.lineStyle(0.5, 0x1e3c1e, 0.45);
    for (let x = hx + 2; x < hx + 1.5 + fill - 6; x += 3) g.lineBetween(x, 10.5, x + 6, 20.5);
    g.lineStyle(1, INK).strokeRect(hx, 9, hw, 13);
    for (let k = 1; k < 12; k++) g.lineStyle(0.6, INK).lineBetween(hx + (k * hw) / 12, 9, hx + (k * hw) / 12, k % 3 ? 12 : 14);
    this.hullText.setText(`${Math.max(0, Math.ceil(s.player.hp))} / ${s.player.maxHp}`);
    const reload = stats(s).reloadMs;
    for (const [i, side] of SIDES.entries()) {
      const loaded = Phaser.Math.Clamp(1 - s.player.reload[side] / reload, 0, 1);
      const x = hx + i * (hw / 2 + 2);
      const w = hw / 2 - 2;
      g.fillStyle(CREAM).fillRect(x, 26, w, 5);
      g.fillStyle(loaded >= 1 ? OCHRE : 0x8a6a40, loaded >= 1 ? 1 : 0.6).fillRect(x, 26, w * loaded, 5);
      g.lineStyle(0.6, INK).strokeRect(x, 26, w, 5);
    }
    this.goldText.setText(t('gold', { gold: s.gold }));
    const short = s.player.crew < s.player.maxCrew;
    const crew = { crew: s.player.crew, max: s.player.maxCrew, hold: s.hold.length };
    this.crewText.setText(t(s.hold.length ? 'crewHold' : 'crew', crew)).setColor(short ? '#9a4a30' : '#2b2118');
    const left = s.toSpawn.length + s.enemies.length;
    this.infoText.setText(s.daily ? t('infoDaily', { left, sunk: s.sunk, score: voyageScore(s) }) : t('info', { left, sunk: s.sunk, best: s.bestWave }));

    const breaking = s.phase === 'break';
    const fade = breaking ? Math.min(1, s.breakMs / 500) : 0;
    const reaches = inReaches(s.wave);
    const course = s.course ? t(COURSES[s.course].name) : '';
    const title =
      s.wave === HAVEN_WAVE ? t('havenTitle')
      : s.wave === TEMPEST_WAVE ? t('tempestTitle')
      : reaches ? (course ? t('reachesCourse', { wave: reachWave(s.wave), course }) : t('reachesTitle', { wave: reachWave(s.wave) }))
      : course ? t('waveCourse', { wave: s.wave, course })
      : t('wave', { wave: s.wave });
    this.bannerTitle.setVisible(breaking).setText(title).setAlpha(fade);
    const flagship = s.toSpawn.includes('flagship') || s.enemies.some((e) => e.kind === 'flagship');
    const named = s.named[0];
    const beast = [...s.toSpawn, ...s.enemies.map((e) => e.kind)].find((kind) => isBeast(kind));
    const escapes = named ? s.captains[named].escapes : 0;
    const sub =
      s.wave === HAVEN_WAVE ? t('havenSub')
      : s.wave === TEMPEST_WAVE ? t('tempestSub')
      : s.daily && s.wave === 1 ? t('dailySub', { ship: t(HULLS[s.hull].name), perks: s.perks.map((id) => t(PERKS[id].name)).join(', ') })
      : reaches && reachWave(s.wave) === 1 ? t('reachesSub')
      // A beast or the dark explains what the player is about to meet, so it comes before a named
      // captain (who sails on the first night and the first beast wave, and is named under her ship).
      : beast ? t(beast === 'kraken' ? 'krakenSub' : 'serpentSub')
      : s.night ? t('nightSub')
      : named ? (escapes ? t('captainBackSub', { name: t(CAPTAINS[named].name), gold: captainBounty(escapes) }) : t('captainSub', { name: t(CAPTAINS[named].name) }))
      : s.raiders ? t('raidersSub', { n: s.raiders })
      : s.convoy ? t('convoySub', { island: t(ISLANDS[s.convoy.island].name), gold: s.convoy.cargo })
      : s.forts.length ? t('fortsSub', { n: s.forts.length, gold: fortBounty(s.wave) })
      : t(flagship ? 'flagshipSub' : 'sailsSub');
    this.bannerSub.setVisible(breaking).setAlpha(fade).setText(sub);

    const sailing = s.phase === 'break' || s.phase === 'fighting';
    this.orderCard.setVisible(sailing);
    // The Admiralty's bounty under the order card, and whether it still stands.
    this.bountyText.setVisible(sailing && !!s.bounty);
    if (s.bounty) {
      const bounty = BOUNTIES[s.bounty];
      const met = bountyMet(s);
      const standing = t(bounty.kind === 'keep' ? (met ? 'bountyStanding' : 'bountyLost') : met ? 'bountyDone' : 'bountyNotYet');
      const pay = s.waveLoot ? t('bountySoFar', { gold: bountyPay(s) }) : t('bountyHalf');
      this.bountyText.setText(t('bountyLine', { bounty: t(bounty.desc, bounty.vars?.(s)), standing, pay })).setColor(met ? '#2f5a3a' : '#9a4a30');
    }
    // The convoy's line under the bounty, or in its place.
    const convoy = s.convoy?.state === 'sailing';
    this.convoyText.setVisible(sailing && convoy).setY(s.bounty ? CONVOY.y : BOUNTY.y);
    if (s.convoy && convoy) {
      const ship = convoyShip(s);
      this.convoyText.setText(t('convoyLine', { island: t(ISLANDS[s.convoy.island].name), hp: Math.ceil(ship?.hp ?? 0), max: ship?.maxHp ?? 0, gold: s.convoy.cargo }));
    }
    const order = ORDERS[s.order];
    this.orderSeal.setTexture(`seal-${s.order}`);
    this.orderHead.setText(t('orderHead', { wave: s.wave }));
    this.orderTitle.setText(t(order.title));
    this.orderDesc.setText(t(order.desc));
    this.drawWind(sailing);

    this.drawPointers();
  }

  /**
   * The wind rose: an arrow flying the way the wind blows, feathered at the end it blows from, and
   * under it where the wind is from.
   */
  private drawWind(sailing: boolean) {
    const s = this.state;
    this.windRose.setVisible(sailing);
    // A squall seen coming names the wind it brings; one blowing says so.
    const wind =
      s.squallTo !== null ? t('squallComing', { point: t(windFrom(s.squallTo)) })
      : s.squallBlowMs > 0 ? t('squallBlowing', { point: t(windFrom(s.wind)) })
      : t('windFrom', { point: t(windFrom(s.wind)) });
    this.windText.setVisible(sailing).setText(wind).setColor(s.squallTo !== null || s.squallBlowMs > 0 ? '#2f4a58' : '#2b2118');
    // A squall's longer line is kept inside the right edge.
    this.windText.setX(Math.min(WIND.x, VIEW.w - 14 - this.windText.width / 2));
    if (!sailing) return;
    const g = this.hud;
    const { x, y } = WIND;
    const r = WIND.r - 9;
    if (s.squallTo !== null) {
      // The squall's wind, dotted, where the arrow will swing to.
      const sx = Math.cos(s.squallTo);
      const sy = Math.sin(s.squallTo);
      g.fillStyle(0x2f4a58, 1);
      for (let d = -r; d <= r; d += 5) g.fillCircle(x + sx * d, y + sy * d, 1.4);
      g.fillCircle(x + sx * r, y + sy * r, 3.2);
    }
    const cx = Math.cos(s.wind);
    const cy = Math.sin(s.wind);
    const tip = { x: x + cx * r, y: y + cy * r };
    const tail = { x: x - cx * r, y: y - cy * r };
    g.lineStyle(2.2, INK, 1).lineBetween(tail.x, tail.y, tip.x - cx * 6, tip.y - cy * 6);
    const head = [
      { x: tip.x, y: tip.y },
      { x: tip.x - cx * 10 - cy * 6, y: tip.y - cy * 10 + cx * 6 },
      { x: tip.x - cx * 10 + cy * 6, y: tip.y - cy * 10 - cx * 6 },
    ];
    g.fillStyle(OCHRE, 1).fillPoints(head as Phaser.Math.Vector2[], true);
    g.lineStyle(1, INK, 1).strokePoints(head as Phaser.Math.Vector2[], true);
    for (const k of [0, 5]) {
      for (const side of [-1, 1]) {
        const bx = tail.x + cx * (k + 2);
        const by = tail.y + cy * (k + 2);
        g.lineStyle(1.2, INK, 1).lineBetween(bx, by, bx - cx * 5 - cy * 5 * side, by - cy * 5 + cx * 5 * side);
      }
    }
  }

  /** Arrows at the edge of the screen toward enemy ships (rust) and loot (ochre) out of sight. */
  private drawPointers() {
    const g = this.hud;
    const view = new Phaser.Geom.Rectangle(this.topLeft.x, this.topLeft.y, VIEW.w, VIEW.h);
    const cx = view.centerX;
    const cy = view.centerY;
    // Each arrow points the shortest way to its target, which may be over an edge of the sea.
    const mark = (target: { x: number; y: number }, color: number) => {
      const { x, y } = this.place(target);
      if (view.contains(x, y)) return;
      const a = Math.atan2(y - cy, x - cx);
      // Where the line toward the target leaves the screen, kept clear of the top bar and frame.
      const hx = VIEW.w / 2 - 22;
      const hy = (VIEW.h - HUD_HEIGHT) / 2 - 22;
      const k = Math.min(hx / Math.abs(Math.cos(a) || 1e-6), hy / Math.abs(Math.sin(a) || 1e-6));
      const px = VIEW.w / 2 + Math.cos(a) * k;
      const py = HUD_HEIGHT + (VIEW.h - HUD_HEIGHT) / 2 + Math.sin(a) * k;
      const tip = (d: number, off: number) => ({ x: px + Math.cos(a + off) * d, y: py + Math.sin(a + off) * d });
      const pts = [tip(12, 0), tip(9, 2.4), tip(4, Math.PI), tip(9, -2.4)];
      g.fillStyle(color, 0.95).fillPoints(pts as Phaser.Math.Vector2[], true);
      g.lineStyle(1, INK, 1).strokePoints(pts as Phaser.Math.Vector2[], true);
    };
    // Never to a sea beast under the sea, nor at night to a ship out of sight.
    for (const e of this.state.enemies) if (afloat(e) && inSight(this.state, e)) mark(e, RUST);
    for (const f of this.state.forts) mark(f, RUST);
    for (const e of this.state.escorts) mark(e, GREEN);
    if (this.state.convoy?.state === 'sailing') mark(ISLANDS[this.state.convoy.island], GREEN);
    for (const l of this.state.loot) mark(l, OCHRE);
  }

  /**
   * The helm wheels in the bottom corners, held to turn, and above each a fire control, held to
   * aim and charge that side's broadside and let go to fire. Every pointer remembers what it
   * pressed, so one thumb can hold the helm while the other fires.
   */
  private createControls() {
    const pinned = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T, depth: number) => {
      o.setScrollFactor(0);
      o.setDepth(depth);
      return o;
    };
    const hit = (x: number, y: number, r: number, control: Control) => {
      const area = pinned(this.add.circle(x, y, r, 0x000000, 0), UI_DEPTH + 3);
      area.setInteractive().on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        this.held.set(pointer.id, control);
        if (control === 'fire-port') this.tapped.port = true;
        if (control === 'fire-starboard') this.tapped.starboard = true;
      });
      this.controlHits.push(area);
    };
    this.helmImages = {} as Record<Side, Phaser.GameObjects.Image>;
    this.fireImages = {} as Record<Side, Phaser.GameObjects.Image>;
    this.fireCaptions = {} as Record<Side, Phaser.GameObjects.Text>;
    this.shotTexts = {} as Record<Side, Phaser.GameObjects.Text>;
    for (const side of SIDES) {
      const h = HELM[side];
      this.helmImages[side] = pinned(this.add.image(h.x, h.y, `helm-${side}`).setScale(1 / HI), UI_DEPTH);
      hit(h.x, h.y, HELM.r, `helm-${side}`);
      const f = FIRE[side];
      this.fireImages[side] = pinned(this.add.image(f.x, f.y, `fire-${side}`).setScale(1 / HI), UI_DEPTH);
      this.fireCaptions[side] = pinned(this.add.text(f.x, f.y - FIRE.r - 16, '', textStyle(12, '#6a4410', 'bold italic', '#f0e2c0', 4)).setOrigin(0.5), UI_DEPTH + 2);
      this.shotTexts[side] = pinned(this.add.text(f.x, f.y + FIRE.r + 12, '', textStyle(11, '#2b2118', 'bold italic', '#f0e2c0', 4)).setOrigin(0.5), UI_DEPTH + 2);
      hit(f.x, f.y, FIRE.r, `fire-${side}`);
    }
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => this.held.delete(pointer.id));
    this.input.on('gameout', () => this.held.clear());
    // A pointer let go while the shared pause screen was up never reaches this scene, so let go of
    // every control on resume, and start the clock afresh rather than jumping a whole step.
    const resume = () => {
      this.held.clear();
      this.lastFrame = null;
    };
    this.events.on(Phaser.Scenes.Events.RESUME, resume);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.RESUME, resume));
    this.controls = this.add.graphics().setScrollFactor(0).setDepth(UI_DEPTH + 1);
  }

  private drawControls() {
    const s = this.state;
    const sailing = s.phase === 'break' || s.phase === 'fighting';
    const g = this.controls;
    g.clear();
    for (const hitArea of this.controlHits) hitArea.setVisible(sailing);
    const reloadMs = stats(s).reloadMs;
    for (const side of SIDES) {
      const turning = s.helm === (side === 'port' ? -1 : 1);
      this.helmImages[side].setVisible(sailing).setTexture(`helm-${side}${turning ? '-held' : ''}`);
      const aiming = s.aim[side];
      this.fireImages[side].setVisible(sailing).setTexture(`fire-${side}${aiming ? '-held' : ''}`);
      const charge = s.charge[side];
      const loaded = s.player.reload[side] <= 0;
      const caption = !aiming ? t('holdToFire') : !loaded ? t('loading') : (charge ?? 0) >= 1 ? t('letGo') : t('charge', { n: Math.round((charge ?? 0) * 100) });
      this.fireCaptions[side].setVisible(sailing).setText(caption);
      this.shotTexts[side].setVisible(sailing).setText(t(HULLS[s.hull].mortarSide === side ? 'mortar' : SHOTS[loadedShot(s, side)].name));
      if (!sailing) continue;
      const { x, y } = FIRE[side];
      const R = FIRE.r + 6;
      // Reloading: a thin brown arc of how loaded the guns are.
      if (!loaded) {
        const done = Phaser.Math.Clamp(1 - s.player.reload[side] / reloadMs, 0, 1);
        g.lineStyle(3, 0x8a6a40, 0.8).beginPath().arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * done).strokePath();
      }
      if (charge === null) continue;
      // Charging: an ochre ring round the held button on a graduated scale.
      g.lineStyle(9, WASH, 0.35).strokeCircle(x, y, R);
      g.lineStyle(6, OCHRE, 1).beginPath().arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, charge)).strokePath();
      g.lineStyle(0.75, INK, 1).strokeCircle(x, y, R);
      for (let k = 0; k < 36; k++) {
        const a = (k / 36) * Math.PI * 2;
        g.lineBetween(x + Math.cos(a) * (R - 4), y + Math.sin(a) * (R - 4), x + Math.cos(a) * (R + 4), y + Math.sin(a) * (R + 4));
      }
    }
  }

  /** While the player has a prize in tow, a button under the order card to scuttle the newest for double loot. */
  private createScuttle() {
    const b = makeButton(this, SCUTTLE.x, SCUTTLE.y, '', () => {
      const prize = this.scuttlePrize();
      // The prize going down and the gold coming in sound through the effects they leave.
      if (!prize || !scuttle(this.state, prize.id)) ui('refuse');
    }, SCUTTLE.w, SCUTTLE.h);
    this.scuttleText = b.text.setFontSize(15);
    this.scuttleButton = pinToScreen(b.button).setDepth(UI_DEPTH - 5).setVisible(false);
  }

  /** The newest of the player's prizes and consorts (never the convoy), which the scuttle button sinks. */
  private scuttlePrize() {
    const s = this.state;
    return s.escorts.filter((e) => e.id !== s.convoy?.id).pop();
  }

  private drawScuttle() {
    const s = this.state;
    const prize = this.scuttlePrize();
    this.scuttleButton.setVisible(s.phase === 'fighting' && !!prize);
    if (!prize) return;
    const ship = t(ENEMIES[prize.kind as keyof typeof ENEMIES].called);
    this.scuttleText.setText(t('scuttle', { ship, gold: scuttleGold(s, prize) }));
  }

  /**
   * The end of a run, with the Admiralty's reward: medals for the waves beaten, spent on rows of
   * starting upgrades for the next run.
   */
  private createGameOver() {
    const top = OVER.y - OVER.h / 2;
    const dim = this.add.rectangle(VIEW.w / 2, VIEW.h / 2, VIEW.w, VIEW.h, 0x3a2a18, 0.5).setInteractive();
    const panel = this.add.image(OVER.x, OVER.y, 'panel-over').setScale(1 / SHEET_RES);
    this.gameOverTitle = this.add.text(OVER.x, top + 30, t('sunkTitle'), textStyle(30, '#2b2118', 'bold')).setOrigin(0.5);
    this.gameOverText = this.add
      .text(OVER.x, top + 76, '', { ...textStyle(14, '#3a2c20', 'italic'), align: 'center', lineSpacing: 2 })
      .setOrigin(0.5);
    this.medalText = this.add
      .text(OVER.x, top + 124, '', { ...textStyle(13, '#6a4410', 'bold italic'), align: 'center', lineSpacing: 1 })
      .setOrigin(0.5);
    const shipLabel = this.add.text(OVER.x, OVER.shipY - 29, t('nextShip'), textStyle(12, '#5a4a38', 'italic')).setOrigin(0.5);
    const parts: Phaser.GameObjects.GameObject[] = [dim, panel, this.gameOverTitle, this.gameOverText, this.medalText, shipLabel];
    HULL_IDS.forEach((id, i) => {
      const x = OVER.x + (i - (HULL_IDS.length - 1) / 2) * (OVER.shipW + 10);
      const y = OVER.shipY;
      const bg = this.add.rectangle(x, y, OVER.shipW, 36, CREAM, 0.9).setStrokeStyle(1.5, INK);
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        // The daily keeps no best wave, so its ships stay as the saved best wave left them.
        const open = unlocked(id, this.state.daily ? this.state.bestBefore : this.state.bestWave);
        if (open) this.nextHull = id;
        ui(open ? 'click' : 'refuse');
      });
      const name = this.add.text(x, y - 8, t(HULLS[id].name), textStyle(14, '#2b2118', 'bold')).setOrigin(0.5);
      const desc = this.add.text(x, y + 9, '', textStyle(10, '#5a4a38', 'italic')).setOrigin(0.5);
      this.shipRows.push({ id, bg, name, desc });
      parts.push(bg, name, desc);
    });
    BOON_IDS.forEach((id, i) => {
      const y = OVER.firstRowY + i * OVER.rowGap;
      const left = OVER.x - OVER.rowW / 2;
      const boon = BOONS[id];
      const bg = this.add.rectangle(OVER.x, y, OVER.rowW, OVER.rowH, CREAM, 0.9).setStrokeStyle(1.5, INK);
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.toggleBoon(id));
      const name = this.add.text(left + 12, y, t(boon.name), textStyle(14, '#2b2118', 'bold')).setOrigin(0, 0.5);
      const desc = this.add.text(left + 200, y, t(boon.desc), textStyle(12, '#5a4a38', 'italic')).setOrigin(0, 0.5);
      const cost = this.add.text(left + OVER.rowW - 12, y, '', textStyle(13, '#6a4410', 'bold italic')).setOrigin(1, 0.5);
      this.boonRows.push({ id, bg, cost });
      parts.push(bg, name, desc, cost);
    });
    const again = makeButton(this, OVER.x, top + OVER.h - 32, t('sailAgain'), () => {
      ui('click');
      saveMedals(this.medalBank - costOfBoons(this.commission));
      saveHull(this.nextHull);
      this.scene.restart({ boons: this.commission, hull: this.nextHull });
    }, OVER_BUTTON_W);
    this.againButton = again.button;
    // After razing the haven, the run can go on into the Storm Reaches instead (and after the
    // Tempest, through the waves beyond).
    const on = makeButton(this, OVER.x + OVER_BUTTON_W + 16, top + OVER.h - 32, t('sailReaches'), () => {
      ui('click');
      sailOn(this.state);
    }, OVER_BUTTON_W);
    this.sailOnButton = on.button;
    this.sailOnText = on.text;
    parts.push(again.button, on.button);
    this.gameOver = pinToScreen(this.add.container(0, 0, parts))
      .setDepth(UI_DEPTH + 20)
      .setVisible(false);
  }

  /** Chooses a starting upgrade for the next run, if the medals cover it, or puts it back. */
  private toggleBoon(id: BoonId) {
    if (this.commission.includes(id)) this.commission = this.commission.filter((b) => b !== id);
    else if (costOfBoons(this.commission) + BOONS[id].cost <= this.medalBank) this.commission = [...this.commission, id];
    else return ui('refuse');
    ui('click');
  }

  /**
   * Today's daily voyage, once a day: the medals and the ship chosen wait for the next run of your
   * own. Made the first time the end card shows rather than in `create`, because every Phaser text
   * draws on Math.random as it is made, and one more at the start would change the first wave the
   * playthrough plays.
   */
  private createDailyButton() {
    const daily = makeButton(this, OVER.x, OVER.y + OVER.h / 2 - 32, t('dailyButton'), () => {
      if (this.daily.played) return ui('refuse');
      ui('click');
      saveMedals(this.medalBank);
      this.daily = startDaily(DAILY_GAME);
      this.scene.restart({ daily: true, hull: this.nextHull });
    }, OVER_BUTTON_W);
    this.dailyButton = daily.button;
    this.dailyText = daily.text;
    this.gameOver.add(daily.button);
    pinToScreen(daily.button);
  }

  private drawGameOver() {
    const s = this.state;
    if (!this.dailyButton) this.createDailyButton();
    // A run that ended after midnight offers the new day's voyage (the record is read afresh).
    if (this.daily.day !== today()) this.daily = loadDaily(DAILY_GAME);
    const won = s.phase === 'won';
    const calmed = won && s.wave === TEMPEST_WAVE;
    const run = { wave: s.wave, sunk: s.sunk, taken: s.taken, gold: s.plundered };
    // The log's line, and the best Storm Reaches wave once one is beaten.
    const log = logFull(s.log) ? t('logFull') : t('logLine', { n: CAPTAIN_IDS.filter((id) => s.log.includes(id)).length, total: CAPTAIN_IDS.length });
    const best = Math.max(s.reachesBest, loadReachesBest());
    const record = best ? t('recordReaches', { best: s.bestWave, reach: best, total: REACHES_WAVES, log }) : t('recordLine', { best: s.bestWave, log });
    if (s.daily) {
      const score = this.daily.score ?? voyageScore(s);
      this.gameOverTitle.setText(t('dailyTitle'));
      this.gameOverText.setText(`${t('dailyText', { score, waves: Math.max(0, wavesBeaten(s)), gold: s.plundered, best: this.daily.best, n: this.daily.streak })}\n${log}`);
    } else {
      this.gameOverTitle.setText(t(calmed ? 'calmTitle' : won ? 'wonTitle' : 'sunkTitle'));
      this.gameOverText.setText(`${t(calmed ? 'calmText' : won ? 'wonText' : 'sunkText', run)}\n${record}`);
    }
    // The daily voyage ends at the haven: there is no sailing on.
    const onward = won && !s.daily;
    this.sailOnButton.setVisible(onward);
    this.sailOnText.setText(t(s.wave >= TEMPEST_WAVE ? 'sailOn' : 'sailReaches'));
    this.againButton.setX(onward ? OVER.x : OVER.x + (OVER_BUTTON_W + 16) / 2);
    this.dailyButton!.setX(onward ? OVER.x - OVER_BUTTON_W - 16 : OVER.x - (OVER_BUTTON_W + 16) / 2);
    this.dailyText.setText(this.daily.score !== null ? t('dailyDone', { score: this.daily.score }) : this.daily.played ? t('dailyUsed') : t('dailyButton'));
    this.dailyButton!.setAlpha(this.daily.played ? 0.6 : 1);
    const left = this.medalBank - costOfBoons(this.commission);
    this.medalText.setText(s.daily ? t('dailyMedals', { left }) : t('medals', { n: s.medals, left }));
    // The daily keeps no best wave, so it unlocks no ship.
    const unlockBest = s.daily ? s.bestBefore : s.bestWave;
    for (const row of this.shipRows) {
      const open = unlocked(row.id, unlockBest);
      const chosen = this.nextHull === row.id;
      fitWidth(row.desc.setText(open ? t(HULLS[row.id].desc) : t('unlockAt', { wave: HULLS[row.id].unlockWave })), OVER.shipW - 8);
      row.bg.setFillStyle(chosen ? 0xebd29a : CREAM, 0.95).setStrokeStyle(chosen ? 2.5 : 1.5, INK).setAlpha(open ? 1 : 0.5);
    }
    for (const row of this.boonRows) {
      const chosen = this.commission.includes(row.id);
      const cost = BOONS[row.id].cost;
      row.cost.setText(chosen ? t('chosen') : t('medalCost', { n: cost }));
      row.bg.setFillStyle(chosen ? 0xebd29a : CREAM, 0.95).setAlpha(chosen || cost <= left ? 1 : 0.5);
    }
  }
}
