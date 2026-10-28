import Phaser from 'phaser';
import { playMusic, playSting, ui } from '../../../../shared/audio';
import { settings } from '../../../../shared/settings';
import { viewSize } from '../../../../shared/scaling';
import { BOSS_SONG, SONG, sfx } from '../audio';
import { Backdrop, type BackdropInfo } from '../art/backdrop';
import { bakeComic } from '../art/comic';
import { bakeNightVision } from '../art/nightvision';
import { FIELD, GEOM, GRAIN_TILE, fitField, geomOf, num, tex } from '../art/paint';
import { ACID_COLOR, BURN_COLOR, CRATE_COLORS, OPERATION_COLORS, OUTPOST_COLORS, ROLE_COLORS, SHIELD_COLOR, SURVIVOR_COLOR, THEMES, UPGRADE_COLORS, type Theme } from '../art/theme';
import { Pool } from '../game/pool';
import {
  ACID_SLOW,
  ADAPT,
  ADAPTS,
  BASE_STATS,
  BLOATER,
  BOSS,
  BOSSES,
  BREAK_MS,
  BROOD,
  BULLET,
  CONDITION,
  CONDITIONS,
  DRUM,
  ENEMIES,
  EXTRACT,
  FIRE_ROUNDS,
  FLAMER,
  FRENZY,
  GRENADE,
  HEADSHOT,
  HERO,
  HUD_HEIGHT,
  KIT_COSTS,
  LANES,
  MARKSMAN,
  MAX_COMPANIONS,
  MEDKIT,
  OPERATION_BONUS,
  OPERATION_KINDS,
  OPERATIONS,
  OUTPOST,
  OUTPOST_KINDS,
  OUTPOST_MAX,
  PERKS,
  PICKUP,
  REACH_Y,
  RICOCHET,
  ROLES,
  ROLE_KINDS,
  SCRAP,
  SHOTGUN,
  SPAWN_Y,
  SPITTER,
  SQUAD_SLOTS,
  SUPPLIES,
  SURVIVOR,
  UPGRADE_KINDS,
  UPGRADES,
  VIEW,
  WALL,
  adaptTo,
  applyUpgrade,
  blastDamage,
  bossKind,
  bossMove,
  canExtract,
  drawCondition,
  isBoss,
  isBossWave,
  laneAt,
  laneMid,
  medalOf,
  outpostCost,
  perksOf,
  planWave,
  riotShield,
  seamAt,
  supplyPick,
  toughness,
  waveTotal,
  type Adapt,
  type BossKind,
  type BossMove,
  type Condition,
  type CrateKind,
  type EnemyKind,
  type OperationKind,
  type Outpost,
  type OutpostKind,
  type Perk,
  type Role,
  type Spawn,
  type Stats,
  type SupplyKind,
  type UpgradeKind,
} from '../game/rules';
import {
  loadBest,
  loadKit,
  loadOperation,
  loadOperationBests,
  loadOutpost,
  loadScrap,
  loadStyle,
  saveBest,
  saveKit,
  saveOperation,
  saveOperationBests,
  saveOutpost,
  saveScrap,
  saveStyle,
  type ArtStyle,
} from '../game/save';
import { HUD_DEPTH, Hud, fireRate } from './Hud';
import { checkBlast, checkTrophies } from '../trophies/check';
// Text objects go by `t` in this scene, so the translator goes by `tr`.
import { t as tr, type TextKey } from '../i18n';

const DEPTH = {
  ground: 0, sandbags: 5, splats: 8, acid: 8.5, ringUnder: 9, drums: 10, pickups: 11, dark: 19, enemies: 20, hero: 40,
  bullets: 45, muzzle: 46, fx: 47, moon: 48, bars: 50, overlay: 90, labels: 92, pops: 95, hud: HUD_DEPTH,
};
/** How long a fallen enemy's splat stays on the road, in ms. */
const SPLAT_MS = 900;
/** One BLAM! lettered over the squad every this many volleys (comic only). */
const BLAM_EVERY = 6;
/** A SPLUT! on every this many kills (comic only). */
const SPLUT_EVERY = 4;
/** Taps on the game over screen are ignored for this long (game time, in ms) after it opens. */
const OVER_GRACE_MS = 600;
/** A boss's pack spawns at least this far (px) above the sandbags, so none of it starts behind them. */
const PACK_CLEAR = 30;
/** The pitch of a zombie's death sound: the small ones squeak, the big ones thud (bosses have their own). */
const KILL_PITCH: Partial<Record<EnemyKind, number>> = { crawler: 1.4, runner: 1.15, spitter: 1.05, brute: 0.75, riot: 0.85 };

interface Enemy {
  alive: boolean;
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  /** Inside a fuel drum's blast ring this frame. */
  inBlast: boolean;
  /** A riot zombie's shield points left (0 for every other kind, or once it broke). */
  shield: number;
  maxShield: number;
  /** A spitter's clock towards its next glob. */
  clock: number;
  /** Fire rounds: burn time left, and the clock towards its next tick of burn damage. */
  burn: number;
  burnTick: number;
  /** The horde adapts: an armoured brute stops every bullet that hits it; a flank spitter keeps to its edge of the road. */
  armoured: boolean;
  flank: boolean;
  sprite: Phaser.GameObjects.Image;
}

/** A survivor walking down the road among the zombies, towards the sandbags. */
interface Survivor {
  alive: boolean;
  id: number;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
}

interface Pickup {
  alive: boolean;
  id: number;
  upgrade: CrateKind;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Image;
  hpText: Phaser.GameObjects.Text;
}

interface Drum {
  alive: boolean;
  id: number;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  /** How many zombies its blast would catch right now. */
  caught: number;
  sprite: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
}

interface Bullet {
  alive: boolean;
  x: number;
  y: number;
  /** Its speed across and up (a shotgun's outer bullets fan out; the rest go straight up). */
  vx: number;
  vy: number;
  /** Where it was last frame: hits are tested along the whole stretch it moved. */
  prevX: number;
  prevY: number;
  /** Fired with pierce: it goes past a riot zombie's shield. */
  pierces: boolean;
  /** Targets it can still hit, and the ids of those it already went through. */
  hitsLeft: number;
  hit: number[];
  /** Ricochets left: with the perk, a spent bullet jumps once to the nearest zombie. */
  ricochets: number;
  /** Its damage as a multiple of the squad's (a marksman's shot), and whether it is a grenadier's grenade. */
  mult: number;
  grenade: boolean;
  sprite: Phaser.GameObjects.Image;
}

interface Splat {
  alive: boolean;
  age: number;
  sprite: Phaser.GameObjects.Image;
}

/**
 * A glob of acid in flight (from a spitter or a boss) and then the puddle it leaves on the squad's
 * line. `flight` counts down to the landing, `life` the puddle's time left after it.
 */
interface Acid {
  alive: boolean;
  x: number;
  r: number;
  fromX: number;
  fromY: number;
  flight: number;
  flightMs: number;
  life: number;
  sprite: Phaser.GameObjects.Image;
  glob: Phaser.GameObjects.Image;
}

/** A sandbag wall across a lane, holding its zombies back until `ms` runs out. */
interface Wall {
  alive: boolean;
  lane: number;
  ms: number;
  sprite: Phaser.GameObjects.Image;
}

/** A short-lived effect: a muzzle flash, a blast, a lettered sound, a streak burst or a hit number. */
interface Fx {
  alive: boolean;
  age: number;
  life: number;
  /** Rise speed in px/s, and how much it grows over its life. */
  rise: number;
  grow: number;
  baseScale: number;
  sprite: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.Text;
}

/**
 * What the game is doing: fighting a wave, the pause after one, picking a boss's supply drop,
 * picking a joining survivor's role, or overrun.
 */
export type Phase = 'wave' | 'break' | 'supply' | 'role' | 'over';

export interface GameState {
  wave: number;
  phase: Phase;
  kills: number;
  stats: Stats;
  /** How many of each pickup the hero has collected. */
  collected: Record<UpgradeKind, number>;
  /** The highest wave any run has reached (saved under `deadline-best`). */
  best: number;
  /** Zombies of this wave down so far, out of `waveTotal`. */
  fallen: number;
  waveTotal: number;
  /** Kills in quick succession, and the frenzy time left (0 when none runs). */
  streak: number;
  frenzyMs: number;
  frenzies: number;
  /** Fuel drums shot this run, and what the last one did. */
  drumsBlown: number;
  lastBlast: { caught: number; killed: number } | null;
  /** Scrap earned this run, and the scrap banked before it (saved together under `deadline-scrap`). */
  scrap: number;
  bank: number;
  /** The starting crates this run began with, and those bought on the game over screen for the next. */
  startKit: UpgradeKind[];
  nextKit: UpgradeKind[];
  /** Sandbag walls in hand, and whether the next tap on the road places one. */
  sandbags: number;
  placing: boolean;
  walls: number;
  /** From the supply drops: extra shotgun pairs, flame bursts and medkits left. */
  pellets: number;
  flames: number;
  medkits: number;
  /** The three supplies on offer while the phase is 'supply', and every one picked this run. */
  offer: SupplyKind[];
  supplies: SupplyKind[];
  /** The hero stands in acid, so the squad fires slower. */
  inAcid: boolean;
  /** The boss's move being wound up or under way, and how many it has made. */
  bossMove: BossMove | null;
  bossMoves: number;
  /** Which boss this wave ends with (null on other waves). */
  bossKind: BossKind | null;
  /** The perks earned from three crates of a kind, and the headshots landed this run. */
  perks: Perk[];
  headshots: number;
  /** Survivors who made it to the sandbags, and those the squad's fire killed. */
  survivorsSaved: number;
  survivorsLost: number;
  /** This wave's condition. */
  condition: Condition;
  /** The run ended by extraction or a completed operation (a win), and the scrap it paid. */
  extracted: boolean;
  payout: number;
  /** The outpost upgrades' levels (saved, lasting), applied at the run's start. */
  outpost: Outpost;
  /** Each companion's role, in squad order (`squad`'s order). */
  roles: Role[];
  /** The operation this run plays, the one picked for the next run, and each operation's best (waves cleared). */
  operation: OperationKind;
  nextOperation: OperationKind;
  operationBests: Record<OperationKind, number>;
  /** What the horde answers the squad with this wave (null before wave 8, or when no stat stands out). */
  adapt: Adapt | null;
}

export class GameScene extends Phaser.Scene {
  state!: GameState;
  player!: Phaser.GameObjects.Image;
  /** Where on the line the hero is walking to after a tap or drag, or null when standing. */
  pointerTarget: number | null = null;
  /** The companions at the hero's side, in the order of their `SQUAD_SLOTS` after the hero's. */
  squad: Phaser.GameObjects.Image[] = [];
  /** The art style the game is drawn in. */
  style: ArtStyle = 'comic';

  private enemies!: Pool<Enemy>;
  private pickups!: Pool<Pickup>;
  private drums!: Pool<Drum>;
  private bullets!: Pool<Bullet>;
  private splats!: Pool<Splat>;
  private fx!: Pool<Fx>;
  private acids!: Pool<Acid>;
  private walls!: Pool<Wall>;
  private survivors!: Pool<Survivor>;
  private nextId = 1;
  private plan: Spawn[] = [];
  private waveClock = 0;
  private fireClock = 0;
  private breakClock = 0;
  private sinceKill = Infinity;
  private volleys = 0;
  private runMs = 0;
  private bestAtStart = 0;
  private lastSecond = -1;
  /** The boss's clock towards its next move, and the move being wound up or under way. */
  private bossClock = 0;
  private bossAct: { move: BossMove; ms: number; acting: boolean; tx: number; fromX: number; fromY: number } | null = null;
  private flameClock = 0;
  /** The press that is down started on a button, so dragging it doesn't move the hero. */
  private pressOnUi = false;
  /** Game time since the game over screen opened; taps on it count only after `OVER_GRACE_MS`. */
  private overMs = 0;

  /** Every image and the sprite it shows, so a style switch can swap all their textures. */
  private skins = new Map<Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite, string>();
  private scan!: Phaser.GameObjects.Image;
  private grain!: Phaser.GameObjects.TileSprite;
  private bars!: Phaser.GameObjects.Graphics;
  private marks!: Phaser.GameObjects.Graphics;
  private hud!: Hud;
  private banner!: Phaser.GameObjects.Text;
  private overText: Phaser.GameObjects.GameObject[] = [];
  /** The supply drop's cards, and the game over screen's kit buttons, as tap boxes. */
  private supplyUi: Phaser.GameObjects.GameObject[] = [];
  private cards: { kind: SupplyKind | 'extract'; x: number; y: number; w: number; h: number }[] = [];
  /** The game over screen's buttons: starting crates, outpost upgrades and operations. */
  private shop: { act: () => void; x: number; y: number; w: number; h: number }[] = [];
  /** The role cards while a survivor picks one, and the phase to go back to after. */
  private roleCards: { role: Role; x: number; y: number; w: number; h: number }[] = [];
  private rolePrev: Phase = 'wave';
  private bossCall!: Phaser.GameObjects.Text;
  private placeHint!: Phaser.GameObjects.Text;
  /** The blackout's darkness over the road, and the blood moon's red cast. */
  private dark!: Phaser.GameObjects.Rectangle;
  private moon!: Phaser.GameObjects.Rectangle;
  /** Bullet hits on zombies, counted for the headshot perk. */
  private bulletHits = 0;
  private keys!: { left: Phaser.Input.Keyboard.Key[]; right: Phaser.Input.Keyboard.Key[] };
  private static backdrop: Backdrop | null = null;

  constructor() {
    super('Game');
  }

  create() {
    this.bestAtStart = loadBest();
    this.state = {
      wave: 0,
      phase: 'wave',
      kills: 0,
      stats: { ...BASE_STATS },
      collected: Object.fromEntries(UPGRADE_KINDS.map((k) => [k, 0])) as Record<UpgradeKind, number>,
      best: this.bestAtStart,
      fallen: 0,
      waveTotal: 0,
      streak: 0,
      frenzyMs: 0,
      frenzies: 0,
      drumsBlown: 0,
      lastBlast: null,
      scrap: 0,
      bank: loadScrap(),
      startKit: loadKit(),
      nextKit: [],
      sandbags: 0,
      placing: false,
      walls: 0,
      pellets: 0,
      flames: 0,
      medkits: 0,
      offer: [],
      supplies: [],
      inAcid: false,
      bossMove: null,
      bossMoves: 0,
      bossKind: null,
      perks: [],
      headshots: 0,
      survivorsSaved: 0,
      survivorsLost: 0,
      condition: 'clear',
      extracted: false,
      payout: 0,
      outpost: loadOutpost(),
      roles: [],
      operation: loadOperation(),
      nextOperation: 'road',
      operationBests: loadOperationBests(),
      adapt: null,
    };
    this.state.nextOperation = this.state.operation;
    // An operation shows its own best (waves cleared) in place of the Open Road's.
    if (this.state.operation !== 'road') this.state.best = this.bestAtStart = this.state.operationBests[this.state.operation];
    // The starting crates bought last run are spent now; they count towards the perks.
    saveKit([]);
    for (const kind of this.state.startKit) {
      this.state.stats = applyUpgrade(this.state.stats, kind);
      this.state.collected[kind]++;
    }
    this.state.perks = perksOf(this.state.collected);
    // The outpost: sandbag walls and medkits to start with, and veteran companions (Gunners).
    const o = this.state.outpost;
    this.state.sandbags = o.barricade;
    this.state.medkits = o.medic;
    for (let i = 0; i < o.veteran; i++) this.state.stats = applyUpgrade(this.state.stats, 'companion');
    this.roleCards = [];
    this.bulletHits = 0;
    this.bossClock = 0;
    this.bossAct = null;
    this.flameClock = 0;
    this.pressOnUi = false;
    this.overMs = 0;
    this.supplyUi = [];
    this.cards = [];
    this.shop = [];
    this.pointerTarget = null;
    this.nextId = 1;
    this.fireClock = 0;
    this.sinceKill = Infinity;
    this.volleys = 0;
    this.runMs = 0;
    this.lastSecond = -1;
    this.squad = [];
    this.overText = [];
    this.skins.clear();
    this.style = loadStyle();
    // The view takes the screen's shape (`setupScaling` with `fill`): the road stays 540 wide in the
    // middle of it, with wider shoulders round it or more road behind the squad, and the camera
    // scrolls so the road keeps its coordinates. Set before the first bake, as the layers fill it.
    const view = viewSize(this);
    fitField(view.width, view.height);
    this.cameras.main.setScroll(FIELD.x, FIELD.y);
    this.bakeStyle(this.style);
    GameScene.backdrop ??= new Backdrop(() => this.game.canvas);

    this.skin(this.add.image(0, 0, '__DEFAULT'), 'ground').setDepth(DEPTH.ground);
    // Sandbags mark the hero's line: an enemy that gets to them has reached the hero.
    this.skin(this.add.image(0, REACH_Y, '__DEFAULT'), 'sandbags').setDepth(DEPTH.sandbags);
    // The hero's x is where their rifle is, so the bullets go up from under the spot that was tapped.
    this.player = this.skin(this.add.image(VIEW.w / 2, HERO.y, '__DEFAULT'), 'hero').setDepth(this.squadDepth(0));
    this.bars = this.add.graphics().setDepth(DEPTH.bars);
    this.marks = this.add.graphics().setDepth(DEPTH.labels);
    // The night-vision feed's scanlines and grain, over the picture but under its amber overlay.
    this.scan = this.add.image(FIELD.x, FIELD.y, '__DEFAULT').setOrigin(0).setDepth(DEPTH.overlay);
    this.dark = this.fieldRect(0x05040c, 0.55).setDepth(DEPTH.dark).setVisible(false);
    this.moon = this.fieldRect(0xc01a1a, 0.16).setDepth(DEPTH.moon).setVisible(false);
    this.grain = this.add.tileSprite(FIELD.x, FIELD.y, FIELD.w, FIELD.h, '__DEFAULT').setOrigin(0).setDepth(DEPTH.overlay + 1);

    const text = (depth: number) => this.add.text(0, 0, '').setOrigin(0.5).setDepth(depth).setVisible(false);
    this.enemies = new Pool<Enemy>(
      () => ({ alive: false, id: 0, kind: 'grunt', hp: 0, maxHp: 0, x: 0, y: 0, inBlast: false, shield: 0, maxShield: 0, clock: 0, burn: 0, burnTick: 0, armoured: false, flank: false, sprite: this.add.image(0, 0, '__DEFAULT') }),
      (e) => e.sprite.setVisible(false),
    );
    this.pickups = new Pool<Pickup>(
      () => ({
        alive: false, id: 0, upgrade: 'rate', hp: 0, maxHp: 0, x: 0, y: 0,
        sprite: this.add.image(0, 0, '__DEFAULT').setDepth(DEPTH.pickups),
        label: this.add.image(0, 0, '__DEFAULT').setDepth(DEPTH.labels),
        hpText: text(DEPTH.labels),
      }),
      (p) => [p.sprite, p.label, p.hpText].forEach((o) => o.setVisible(false)),
    );
    this.drums = new Pool<Drum>(
      () => ({
        alive: false, id: 0, hp: 0, maxHp: 0, x: 0, y: 0, caught: 0,
        sprite: this.skin(this.add.image(0, 0, '__DEFAULT'), 'drum').setDepth(DEPTH.drums),
        ring: this.skin(this.add.image(0, 0, '__DEFAULT'), 'ring'),
        label: text(DEPTH.labels),
      }),
      (d) => [d.sprite, d.ring, d.label].forEach((o) => o.setVisible(false)),
    );
    this.bullets = new Pool<Bullet>(
      () => ({ alive: false, x: 0, y: 0, vx: 0, vy: 0, prevX: 0, prevY: 0, pierces: false, hitsLeft: 0, hit: [], ricochets: 0, mult: 1, grenade: false, sprite: this.skin(this.add.image(0, 0, '__DEFAULT'), 'bullet').setDepth(DEPTH.bullets) }),
      (b) => b.sprite.setVisible(false),
    );
    this.splats = new Pool<Splat>(
      () => ({ alive: false, age: 0, sprite: this.skin(this.add.image(0, 0, '__DEFAULT'), 'splat').setDepth(DEPTH.splats) }),
      (s) => s.sprite.setVisible(false),
    );
    this.fx = new Pool<Fx>(
      () => ({ alive: false, age: 0, life: 0, rise: 0, grow: 0, baseScale: 1, sprite: this.add.image(0, 0, '__DEFAULT').setDepth(DEPTH.fx), text: text(DEPTH.pops) }),
      (f) => {
        f.sprite.setVisible(false);
        f.text.setVisible(false);
      },
    );

    this.acids = new Pool<Acid>(
      () => ({
        alive: false, x: 0, r: 0, fromX: 0, fromY: 0, flight: 0, flightMs: 0, life: 0,
        sprite: this.skin(this.add.image(0, 0, '__DEFAULT'), 'acid').setDepth(DEPTH.acid),
        glob: this.skin(this.add.image(0, 0, '__DEFAULT'), 'glob').setDepth(DEPTH.bullets),
      }),
      (a) => [a.sprite, a.glob].forEach((o) => o.setVisible(false)),
    );
    this.walls = new Pool<Wall>(
      () => ({ alive: false, lane: 0, ms: 0, sprite: this.skin(this.add.image(0, 0, '__DEFAULT'), 'wall').setDepth(DEPTH.enemies + WALL.y / VIEW.h) }),
      (w) => w.sprite.setVisible(false),
    );
    this.survivors = new Pool<Survivor>(
      () => ({ alive: false, id: 0, hp: 0, maxHp: 0, x: 0, y: 0, sprite: this.add.image(0, 0, '__DEFAULT'), label: text(DEPTH.labels) }),
      (v) => [v.sprite, v.label].forEach((o) => o.setVisible(false)),
    );
    // Starting crates bought with scrap: a companion one brings its soldier in at once.
    this.addCompanions();

    this.hud = new Hud(this);
    // Wrapped, as a perk's line or a German one can run wider than the road.
    this.banner = this.add.text(VIEW.w / 2, VIEW.h * 0.38, '', { align: 'center', wordWrap: { width: VIEW.w - 40, useAdvancedWrap: true } }).setOrigin(0.5).setDepth(DEPTH.hud).setAlpha(0);
    this.bossCall = this.add.text(0, 0, '').setOrigin(0.5).setDepth(DEPTH.pops).setVisible(false);
    this.placeHint = this.add.text(VIEW.w / 2, WALL.y - 70, '', { align: 'center' }).setOrigin(0.5).setDepth(DEPTH.pops).setVisible(false);
    this.createInput();
    this.applyStyle();
    this.startWave(1);
  }

  /** The enemies in play, for the playthrough test. */
  liveEnemies() {
    return this.enemies.live().map(({ id, kind, hp, maxHp, x, y, shield, armoured, flank }) => ({ id, kind, hp, maxHp, x, y, shield, armoured, flank }));
  }

  /** The acid on the squad's line: where, how wide, and whether it has landed yet. */
  liveAcid() {
    return this.acids.live().map(({ x, r, flight, life }) => ({ x, r, landed: flight <= 0, life }));
  }

  /** The sandbag walls standing: their lane and the time they have left. */
  liveWalls() {
    return this.walls.live().map(({ lane, ms }) => ({ lane, ms }));
  }

  /** The survivors on the road: their hit points left and where they are. */
  liveSurvivors() {
    return this.survivors.live().map(({ id, hp, maxHp, x, y }) => ({ id, hp, maxHp, x, y }));
  }

  /** The pickups in play: what they give, how many hits are left to open them and where they are. */
  livePickups() {
    return this.pickups.live().map(({ id, upgrade, hp, maxHp, x, y }) => ({ id, upgrade, hp, maxHp, x, y }));
  }

  /** The fuel drums on the road: hits left, where they are and how many zombies their blast would catch. */
  liveDrums() {
    return this.drums.live().map(({ id, hp, maxHp, x, y, caught }) => ({ id, hp, maxHp, x, y, caught }));
  }

  /** How many enemies of the wave have yet to come in. */
  enemiesToCome() {
    return this.plan.filter((s) => s.type === 'enemy').length;
  }

  // ---------- Art styles ----------

  /** Bakes a style's textures, once: the comic at boot, night vision the first time it is shown. */
  private bakeStyle(style: ArtStyle) {
    if (this.textures.exists(tex(style, 'ground'))) return;
    if (style === 'comic') bakeComic(this);
    else bakeNightVision(this);
  }

  /** Shows an image as one of the style's sprites and remembers it, so a switch can swap it. */
  private skin<T extends Phaser.GameObjects.Image>(img: T, name: string): T {
    this.skins.set(img, name);
    const geom = geomOf(name);
    img.setTexture(tex(this.style, name)).setOrigin(geom.ox / geom.w, geom.oy / geom.h).setScale(this.unit(img));
    return img;
  }

  /** The scale that shows a skinned image's texture at its box's size, however finely it was painted. */
  private unit(img: Phaser.GameObjects.Image) {
    const name = this.skins.get(img);
    return name ? geomOf(name).w / img.frame.width : 1;
  }

  /** Switches between the comic and the night-vision feed, and saves the choice. */
  switchStyle() {
    ui('click');
    this.style = this.style === 'comic' ? 'nv' : 'comic';
    saveStyle(this.style);
    this.bakeStyle(this.style);
    this.applyStyle();
  }

  private applyStyle() {
    const nv = this.style === 'nv', th = this.theme();
    for (const [img, name] of this.skins) {
      const geom = geomOf(name);
      img.setTexture(tex(this.style, name)).setOrigin(geom.ox / geom.w, geom.oy / geom.h);
    }
    this.scan.setTexture(nv ? tex('nv', 'scan') : '__DEFAULT').setDisplaySize(FIELD.w, FIELD.h).setVisible(nv);
    if (nv) this.grain.setTexture(tex('nv', 'grain')).setTileScale(GRAIN_TILE / this.grain.frame.width);
    this.grain.setVisible(nv).setAlpha(0.9);
    // In the comic the blast ring is painted on the road under the horde; in night vision it is
    // part of the overlay, over the scanlines.
    for (const d of this.drums.all) d.ring.setDepth(nv ? DEPTH.labels - 1 : DEPTH.ringUnder);
    for (const p of this.pickups.all) this.styleCrateText(p.hpText);
    for (const d of this.drums.all) this.styleDrumLabel(d.label);
    for (const v of this.survivors.all) this.styleSurvivorLabel(v.label);
    for (const f of this.fx.all) if (f.alive) this.fx.release(f);
    this.font(this.banner, 40, nv ? th.accent : '#ffe04a', nv ? { glow: th.accent } : { stroke: th.ink, sw: 8 });
    this.font(this.bossCall, nv ? 16 : 20, nv ? th.warn : '#ffe04a', nv ? { glow: th.warn } : { stroke: th.ink, sw: 6 });
    this.font(this.placeHint, nv ? 14 : 16, nv ? th.accent : '#fff8e8', nv ? { glow: th.accent } : { stroke: th.ink, sw: 5 });
    for (const t of this.overText) t.destroy();
    this.overText = [];
    if (this.state.phase === 'over') this.showGameOver();
    if (this.state.phase === 'supply') this.showSupply();
    if (this.state.phase === 'role') this.showRoles();
    this.hud.setStyle(this.style);
    GameScene.backdrop?.setStyle(this.style);
    this.refreshBackdrop();
  }

  private theme(): Theme {
    return THEMES[this.style];
  }

  private font(t: Phaser.GameObjects.Text, size: number, color: string, o: { stroke?: string; sw?: number; glow?: string } = {}) {
    const th = this.theme();
    t.setFontFamily(th.font).setFontSize(`${size}px`).setFontStyle(th.fontStyle).setColor(color);
    t.setStroke(o.stroke ?? '#000000', o.stroke ? (o.sw ?? 3) : 0);
    if (o.glow) t.setShadow(0, 0, o.glow, 6, false, true);
    else t.setShadow(0, 0, '#000000', 0, false, false);
    return t;
  }

  private styleCrateText(t: Phaser.GameObjects.Text) {
    if (this.style === 'comic') this.font(t, 12, THEMES.comic.ink);
    else this.font(t, 13, '#ffffff', { glow: '#ffffff' });
  }

  /** Shrinks a card's name to `width` when it runs wider, as a long word (German, say) can. */
  private fit(t: Phaser.GameObjects.Text, width: number) {
    t.setScale(Math.min(1, width / t.width));
  }

  private styleDrumLabel(t: Phaser.GameObjects.Text) {
    if (this.style === 'comic') this.font(t, 10, '#c03a1a');
    else this.font(t, 10, THEMES.nv.accent, { glow: THEMES.nv.accent });
  }

  private styleSurvivorLabel(t: Phaser.GameObjects.Text) {
    if (this.style === 'comic') this.font(t, 11, '#fff8e8', { stroke: THEMES.comic.ink, sw: 3 });
    else this.font(t, 9, SURVIVOR_COLOR, { glow: SURVIVOR_COLOR });
    t.setText(tr(this.style === 'comic' ? 'survivorLabel' : 'nvSurvivorLabel'));
  }

  // ---------- Input and waves ----------

  private createInput() {
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: [kb.addKey(K.LEFT), kb.addKey(K.A)],
      right: [kb.addKey(K.RIGHT), kb.addKey(K.D)],
    };
    // V switches the art style, like the switch in the top bar.
    kb.addKey(K.V).on('down', () => this.switchStyle());
    // S drops a sandbag wall in the hero's lane; 1, 2 and 3 pick a supply.
    kb.addKey(K.S).on('down', () => this.state.phase === 'wave' && !this.placeWall(laneAt(this.player.x)) && ui('refuse'));
    // 1, 2 and 3 also pick a joining survivor's role.
    [K.ONE, K.TWO, K.THREE].forEach((code, i) =>
      kb.addKey(code).on('down', () => {
        if (this.state.phase === 'supply') this.pickSupply(this.state.offer[i]);
        else if (this.state.phase === 'role') this.pickRole(ROLE_KINDS[i]);
      }),
    );
    // 4 takes the extraction, when it is on offer.
    kb.addKey(K.FOUR).on('down', () => this.state.phase === 'supply' && this.cards.some((c) => c.kind === 'extract') && this.pickSupply('extract'));
    // Tap or drag anywhere: the hero walks along their line to below that spot.
    const aim = (p: Phaser.Input.Pointer) => {
      if (this.state.phase === 'over' || this.state.phase === 'supply' || this.state.phase === 'role') return;
      const [minX, maxX] = this.heroRange();
      this.pointerTarget = Phaser.Math.Clamp(p.worldX, minX, maxX);
    };
    const inBox = (x: number, y: number, b: { x: number; y: number; w: number; h: number }) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const { worldX: x, worldY: y } = p, s = this.state;
      this.pressOnUi = true;
      if (this.hud.onSwitch(x, y)) this.switchStyle();
      else if (s.phase === 'over') {
        // A tap still meant for steering as the horde breaks through doesn't skip the screen.
        if (this.overMs < OVER_GRACE_MS) return;
        const button = this.shop.find((b) => inBox(x, y, b));
        if (button) button.act();
        else {
          ui('click');
          this.scene.restart();
        }
      } else if (s.phase === 'supply') {
        const card = this.cards.find((c) => inBox(x, y, c));
        if (card) this.pickSupply(card.kind);
      } else if (s.phase === 'role') {
        const card = this.roleCards.find((c) => inBox(x, y, c));
        if (card) this.pickRole(card.role);
      } else if (this.hud.onKit(x, y) && ((s.phase === 'wave' && s.sandbags > 0) || s.placing)) {
        s.placing = !s.placing;
        ui('click');
      } else if (this.hud.onKit(x, y)) {
        // Sandbags only go down in a wave, and only with some in the kit; any other tap on the
        // shown kit panel does nothing (and never aims the squad). A hidden panel takes no taps.
        ui('refuse');
      } else if (s.placing) {
        // A tap on the road puts the wall in that lane; anywhere else puts the sandbags away.
        if (y > HUD_HEIGHT + 30 && y < REACH_Y) this.placeWall(laneAt(x));
        else ui('click');
        s.placing = false;
      } else {
        this.pressOnUi = false;
        aim(p);
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => p.isDown && !this.pressOnUi && aim(p));
  }

  private startWave(wave: number) {
    this.state.wave = wave;
    this.state.phase = 'wave';
    this.state.fallen = 0;
    this.state.waveTotal = waveTotal(wave);
    // The condition is drawn before the plan, as an ammo shortage adds drums to it. Neither draws
    // anything before wave 6, so the first waves are the same as without conditions.
    // An operation can fix the condition (Lights Out's blackout); then nothing is drawn for it.
    const op = OPERATIONS[this.state.operation];
    this.state.condition = op.condition ?? drawCondition(wave);
    // From wave 8 the horde answers the squad's strongest stat.
    this.state.adapt = wave >= ADAPT.fromWave ? adaptTo(this.state.stats) : null;
    this.plan = planWave(wave, Math.random, this.state.condition, {
      extraDrums: this.state.outpost.depot,
      drums: op.drums,
      survivors: op.survivors,
      survivorsFrom: op.survivorsFrom,
      adapt: this.state.adapt,
    });
    this.waveClock = 0;
    this.bossClock = 0;
    this.bossAct = null;
    this.state.bossMove = null;
    this.state.bossMoves = 0;
    this.state.bossKind = isBossWave(wave) ? bossKind(wave) : null;
    // The Open Road's best is the wave reached; an operation's is the waves cleared (saved on clearing them).
    if (this.state.operation === 'road' && wave > this.state.best) {
      this.state.best = wave;
      saveBest(wave);
    }
    const bossName = this.state.bossKind ? tr(BOSSES[this.state.bossKind].name).toUpperCase() : '';
    const title = op.waves ? tr('waveOf', { wave, waves: op.waves }) : tr('wave', { wave });
    const lines = [title, isBossWave(wave) ? tr('bossIncoming', { boss: bossName }) : isBossWave(wave + 1) ? tr('bannerBossNext') : ''];
    if (this.state.condition !== 'clear') lines.push(`${tr(CONDITIONS[this.state.condition].label).toUpperCase()}!`);
    if (this.state.adapt) lines.push(tr('hordeAdapts', { adapt: tr(ADAPTS[this.state.adapt].label).toUpperCase() }));
    this.showBanner(lines.filter(Boolean).join('\n'));
    this.applyCondition();
    this.refreshBackdrop();
    // A boss wave opens on a low horn, any other on a drum hit.
    if (this.state.bossKind) playSting(SONG, 'warn');
    else if (wave > 1) sfx('waveStart');
    this.music();
  }

  /**
   * Plays the part of the music that fits the phase: the boss song through a boss wave, the battle
   * (the frenzy's, or the dark one under a blackout or blood moon) in a wave, calm otherwise.
   */
  private music() {
    const s = this.state;
    if (s.phase === 'role') return;
    if (s.phase !== 'wave') playMusic(SONG, 'calm');
    else if (s.bossKind) playMusic(BOSS_SONG, 'boss');
    else if (s.frenzyMs > 0) playMusic(SONG, 'frenzy');
    else playMusic(SONG, s.condition === 'blackout' || s.condition === 'bloodmoon' ? 'dark' : 'battle');
  }

  /** The blackout's dark and the blood moon's red cast come and go with the wave's condition. */
  private applyCondition() {
    const c = this.state.condition;
    this.dark.setVisible(c === 'blackout');
    this.moon.setVisible(c === 'bloodmoon');
  }

  /**
   * How well something at x, y can be seen: 1 in the open, fading to 0 beyond `blackoutRadius` of
   * the hero during a blackout.
   */
  private visibility(x: number, y: number) {
    if (this.state.condition !== 'blackout') return 1;
    const d = Math.hypot(x - this.player.x, y - HERO.y), r = CONDITION.blackoutRadius;
    return Phaser.Math.Clamp((r + 70 - d) / 70, 0, 1);
  }

  private showBanner(text: string) {
    this.tweens.killTweensOf(this.banner);
    this.banner.setText(text).setAlpha(1);
    this.tweens.add({ targets: this.banner, alpha: 0, delay: 1200, duration: 400 });
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 100);
    this.animateFeed();
    checkTrophies(this.state);
    if (this.state.phase === 'over') this.overMs += dt;
    // Nothing moves while the game is over, or a supply drop or a survivor's role is being picked.
    if (this.state.phase === 'over' || this.state.phase === 'supply' || this.state.phase === 'role') return;
    this.runMs += dt;
    this.moveHero(dt);
    this.spawn(dt);
    this.fire(dt);
    this.moveBullets(dt);
    this.tickBoss(dt);
    // A game over or a rescue ends the frame early, so each saves its trophies before returning.
    if (this.moveEnemies(dt)) return checkTrophies(this.state);
    this.movePickups(dt);
    this.moveDrums(dt);
    this.moveAcid(dt);
    this.moveWalls(dt);
    // A rescue that opens the role pick holds the rest of the frame, so nothing (a companion crate
    // shot open by this frame's bullets) can fill the squad under the pick.
    if (this.moveSurvivors(dt)) return checkTrophies(this.state);
    this.hitTargets();
    this.tickFlamer(dt);
    this.tickFrenzy(dt);
    this.ageEffects(dt);
    this.checkWave(dt);
    // Again after the step, so a trophy its events earn is saved in the same frame.
    checkTrophies(this.state);
    this.drawBars();
    this.updateHud();
    const second = Math.floor(this.runMs / 1000);
    if (second !== this.lastSecond) {
      this.lastSecond = second;
      this.refreshBackdrop();
    }
  }

  /** The night-vision grain crawls and the feed flickers; both hold still with reduced motion. */
  private animateFeed() {
    if (this.style !== 'nv' || settings.reduceMotion) return;
    const f = this.game.loop.frame;
    this.grain.setTilePosition((f * 37) % 128, (f * 53) % 128);
    this.grain.setAlpha(0.75 + 0.25 * Math.abs(Math.sin(f * 0.7)));
    this.scan.setAlpha(0.92 + 0.08 * Math.sin(f * 1.3));
  }

  /**
   * How far left and right the hero can go: as far as `HERO.minX..HERO.maxX` allows for every rifle
   * in the squad, so companions never walk off the road or bunch up against its edge.
   */
  private heroRange(): [number, number] {
    const slots = SQUAD_SLOTS.slice(0, 1 + this.squad.length);
    return [HERO.minX - Math.min(...slots.map((s) => s.dx)), HERO.maxX - Math.max(...slots.map((s) => s.dx))];
  }

  /** Rows further back draw on top of the ones ahead of them, as they are closer to the camera. */
  private squadDepth(slot: number) {
    return DEPTH.hero + SQUAD_SLOTS[slot].dy / 100;
  }

  private moveHero(dt: number) {
    const left = this.keys.left.some((k) => k.isDown), right = this.keys.right.some((k) => k.isDown);
    const step = (HERO.speed * dt) / 1000;
    const [minX, maxX] = this.heroRange();
    if (this.pointerTarget !== null) this.pointerTarget = Phaser.Math.Clamp(this.pointerTarget, minX, maxX);
    if (left !== right) {
      this.pointerTarget = null;
      this.player.x += left ? -step : step;
    } else if (this.pointerTarget !== null) {
      const dx = this.pointerTarget - this.player.x;
      if (Math.abs(dx) <= step) {
        this.player.x = this.pointerTarget;
        this.pointerTarget = null;
      } else this.player.x += Math.sign(dx) * step;
    }
    this.player.x = Phaser.Math.Clamp(this.player.x, minX, maxX);
    this.squad.forEach((c, i) => c.setPosition(this.player.x + SQUAD_SLOTS[i + 1].dx, HERO.y + SQUAD_SLOTS[i + 1].dy));
  }

  private spawn(dt: number) {
    if (this.state.phase !== 'wave') return;
    this.waveClock += dt;
    while (this.plan.length && this.plan[0].at <= this.waveClock) {
      const s = this.plan.shift()!;
      if (s.type === 'enemy') {
        const e = this.addEnemy(s.kind, s.hp, s.x, SPAWN_Y);
        e.armoured = !!s.armoured;
        e.flank = !!s.flank;
      } else if (s.type === 'pickup') {
        // Once every slot in the squad is filled, a companion crate brings extra damage instead.
        const upgrade: CrateKind = s.upgrade === 'companion' && this.state.stats.companions >= MAX_COMPANIONS ? 'damage' : s.upgrade;
        const p = this.pickups.take();
        Object.assign(p, { id: this.nextId++, upgrade, hp: s.hp, maxHp: s.hp, x: s.x, y: SPAWN_Y });
        this.skin(p.sprite, `crate-${upgrade}`).setVisible(true);
        this.skin(p.label, `label-${upgrade}`).setVisible(true);
        this.styleCrateText(p.hpText);
        p.hpText.setVisible(true);
      } else if (s.type === 'survivor') {
        const v = this.survivors.take();
        Object.assign(v, { id: this.nextId++, hp: s.hp, maxHp: s.hp, x: s.x, y: SPAWN_Y });
        this.skin(v.sprite, 'survivor').setPosition(v.x, v.y).setAlpha(1).setVisible(true);
        this.styleSurvivorLabel(v.label);
        v.label.setVisible(true);
      } else {
        const d = this.drums.take();
        Object.assign(d, { id: this.nextId++, hp: s.hp, maxHp: s.hp, x: s.x, y: SPAWN_Y, caught: 0 });
        d.ring.setDepth(this.style === 'nv' ? DEPTH.labels - 1 : DEPTH.ringUnder);
        this.styleDrumLabel(d.label);
        [d.sprite, d.ring, d.label].forEach((o) => o.setVisible(true));
      }
    }
  }

  private addEnemy(kind: EnemyKind, hp: number, x: number, y: number) {
    const e = this.enemies.take();
    const shield = kind === 'riot' ? riotShield(this.state.wave) : 0;
    Object.assign(e, { id: this.nextId++, kind, hp, maxHp: hp, x, y, inBlast: false, shield, maxShield: shield, clock: SPITTER.everyMs - SPITTER.firstMs, burn: 0, burnTick: 0, armoured: false, flank: false });
    this.skin(e.sprite, kind).setPosition(e.x, e.y).setAlpha(1).setVisible(true);
    return e;
  }

  /**
   * Fires a volley every so often: one bullet straight up from the hero and from each companion, and
   * with the shotgun pairs of bullets fanning out from the hero's rifle. A grenadier throws a grenade
   * in place of every so many bullets, and a marksman only fires every few volleys, at the toughest
   * zombie. A frenzy fires `FRENZY.rate` times as fast; standing in acid, `ACID_SLOW` times slower.
   */
  private fire(dt: number) {
    this.fireClock += dt;
    const { pierce } = this.state.stats;
    const interval = (this.state.stats.fireInterval / (this.state.frenzyMs > 0 ? FRENZY.rate : 1)) * (this.state.inAcid ? ACID_SLOW : 1) * (this.state.condition === 'shortage' ? CONDITION.shortageFire : 1);
    const ricochets = this.state.perks.includes('ricochet') ? 1 : 0;
    const shoot = (x: number, y: number, angle: number, o: { mult?: number; pierce?: number; grenade?: boolean } = {}) => {
      const b = this.bullets.take();
      b.x = b.prevX = x;
      b.y = b.prevY = y;
      b.vx = Math.sin(angle) * BULLET.speed;
      b.vy = Math.cos(angle) * BULLET.speed;
      b.hitsLeft = 1 + pierce + (o.pierce ?? 0);
      b.pierces = pierce + (o.pierce ?? 0) > 0;
      b.ricochets = ricochets;
      b.mult = o.mult ?? 1;
      b.grenade = !!o.grenade;
      b.hit.length = 0;
      b.sprite.setPosition(b.x, b.y).setRotation(angle).setVisible(true);
      // A grenade and a marksman's round show bigger than a bullet.
      b.sprite.setScale(this.unit(b.sprite) * (b.grenade ? 2 : b.mult > 1 ? 1.5 : 1));
    };
    while (this.fireClock >= interval) {
      this.fireClock -= interval;
      this.volleys++;
      sfx('shot');
      for (let i = 0; i <= this.squad.length; i++) {
        const x = this.player.x + SQUAD_SLOTS[i].dx, y = HERO.y + SQUAD_SLOTS[i].dy - 30;
        const role = i === 0 ? 'gunner' : this.state.roles[i - 1];
        if (role === 'marksman') {
          if (this.volleys % MARKSMAN.every) continue;
          const t = this.toughestEnemy(y);
          shoot(x, y, t ? Math.atan2(t.x - x, y - t.y) : 0, { mult: MARKSMAN.mult, pierce: MARKSMAN.pierce });
        } else if (!this.survivorAhead(x, y)) shoot(x, y, 0, { grenade: role === 'grenadier' && this.volleys % GRENADE.every === 0 });
        if (i === 0) for (let k = 1; k <= this.state.pellets; k++) [-1, 1].forEach((side) => shoot(x, y, side * k * SHOTGUN.angle));
        this.effect('muzzle', x, y, { life: 70 });
      }
      if (this.style === 'comic' && this.volleys % BLAM_EVERY === 0) {
        const side = (this.volleys / BLAM_EVERY) % 2 ? -1 : 1;
        const x = Phaser.Math.Clamp(this.player.x + side * 110, 110, VIEW.w - 110);
        this.effect('sfx-blam', x, REACH_Y - 50 - (this.volleys % 3) * 8, { life: 380, grow: 0.15, angle: side * 7 });
      }
    }
  }

  /** A survivor in the line of a rifle at x, y: it holds its straight shot so as not to hit them. */
  private survivorAhead(x: number, y: number) {
    return this.survivors.all.some((v) => v.alive && v.y < y && Math.abs(v.x - x) <= SURVIVOR.radius + BULLET.radius);
  }

  /** The zombie on the road with the most hit points left, ahead of a rifle at y (null when none). */
  private toughestEnemy(y: number) {
    let best: Enemy | null = null;
    for (const e of this.enemies.all) if (e.alive && e.y < y - 40 && e.y > HUD_HEIGHT && (!best || e.hp > best.hp)) best = e;
    return best;
  }

  private moveBullets(dt: number) {
    for (const b of this.bullets.all) {
      if (!b.alive) continue;
      b.prevX = b.x;
      b.prevY = b.y;
      b.x += (b.vx * dt) / 1000;
      b.y -= (b.vy * dt) / 1000;
      // A ricochet can fly downwards, so the bottom edge counts too.
      if (b.y < HUD_HEIGHT - 10 || b.y > FIELD.y + FIELD.h || b.x < FIELD.x || b.x > FIELD.x + FIELD.w) this.bullets.release(b);
      else b.sprite.setPosition(b.x, b.y);
    }
  }

  /**
   * The horde walks down, each one veering into the middle of its lane to go for that lane's
   * sandbags: it never chases the hero, so the player moves the squad under the lane that needs it.
   * Each aims a little to one side, so a lane comes as a crowd rather than in single file. Reaching
   * the hero's line ends the game (and returns true, so the rest of the frame is skipped).
   */
  private moveEnemies(dt: number): boolean {
    for (const e of this.enemies.all) {
      if (!e.alive) continue;
      const { steer, radius } = ENEMIES[e.kind], boss = isBoss(e.kind);
      // Under a blood moon the runners come faster.
      const speed = ENEMIES[e.kind].speed * (e.kind === 'runner' && this.state.condition === 'bloodmoon' ? CONDITION.bloodMoonRunner : 1);
      // A boss winding up a move stands still, and a charge moves it on its own (`tickBoss`).
      const bossBusy = boss && this.bossAct !== null;
      // A sandbag wall in its lane holds a zombie back; a boss smashes through it.
      const wall = this.walls.all.find((w) => w.alive && w.lane === laneAt(e.x) && e.y < WALL.y && e.y + radius >= WALL.y - 14);
      if (wall && boss) this.smashWall(wall);
      const held = !!wall && !boss;
      // Fire rounds: a burning zombie takes a tick of damage every so often until the fire is out.
      if (e.burn > 0) {
        e.burn -= dt;
        e.burnTick += dt;
        if (e.burnTick >= FIRE_ROUNDS.tickMs) {
          e.burnTick -= FIRE_ROUNDS.tickMs;
          this.hurt(e, FIRE_ROUNDS.damage(this.state.wave));
          if (!e.alive) continue;
        }
      }
      if (!bossBusy && !held) {
        e.y += (speed * dt) / 1000;
        // A spitter stops at its range and lobs acid from there.
        if (e.kind === 'spitter' && e.y >= SPITTER.standY) {
          e.y = SPITTER.standY;
          e.clock += dt;
          if (e.clock >= SPITTER.everyMs) {
            e.clock = 0;
            this.lobAcid(e.x, e.y - 4, SPITTER.poolRadius, SPITTER.warnMs, SPITTER.poolMs);
          }
        } else if (!e.flank) {
          const aside = boss ? 0 : ((e.id * 53) % 25) - 12;
          const dx = laneMid(laneAt(e.x)) + aside - e.x, maxStep = (steer * dt) / 1000;
          e.x += Phaser.Math.Clamp(dx, -maxStep, maxStep);
        }
      }
      // A little shamble from side to side, the same for every frame rate (none when motion is reduced).
      const sway = settings.reduceMotion || boss ? 0 : Math.sin((e.y + e.id * 37) / 9) * 1.5;
      e.sprite.setPosition(e.x + sway, e.y).setDepth(DEPTH.enemies + e.y / VIEW.h).setAlpha(this.visibility(e.x, e.y));
      if (e.y + radius >= REACH_Y) {
        // A medkit gets the squad through one breach; without one, it's over.
        if (this.state.medkits > 0) this.useMedkit();
        else {
          this.gameOver();
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Survivors walk down the nearest seam between two lanes, out of the horde's columns, so the
   * player can keep the squad's fire off them. One who reaches the sandbags is rescued. Returns
   * whether a rescue opened the role pick.
   */
  private moveSurvivors(dt: number) {
    for (const v of this.survivors.all) {
      // A second survivor reaching the line while the first picks a role waits for the next frame.
      if (this.state.phase === 'role') return true;
      if (!v.alive) continue;
      v.y += (SURVIVOR.speed * dt) / 1000;
      const maxStep = (SURVIVOR.steer * dt) / 1000;
      v.x += Phaser.Math.Clamp(seamAt(v.x) - v.x, -maxStep, maxStep);
      const seen = this.visibility(v.x, v.y);
      v.sprite.setPosition(v.x, v.y).setDepth(DEPTH.enemies + v.y / VIEW.h).setAlpha(seen);
      v.label.setPosition(v.x, v.y - SURVIVOR.radius - 30).setAlpha(seen);
      if (v.y + SURVIVOR.radius >= REACH_Y && this.rescue(v)) return true;
    }
    return false;
  }

  /**
   * A survivor made it: they join the squad (picking a role first), or hand over scrap when it is
   * full. Returns whether the role pick opened.
   */
  private rescue(v: Survivor) {
    this.survivors.release(v);
    this.state.survivorsSaved++;
    sfx('rescue');
    if (this.state.stats.companions < MAX_COMPANIONS) {
      this.rolePrev = this.state.phase;
      this.state.phase = 'role';
      this.state.placing = false;
      this.pointerTarget = null;
      this.showRoles();
      this.refreshBackdrop();
      return true;
    }
    this.state.scrap += SURVIVOR.scrap;
    this.pop(tr(this.style === 'comic' ? 'survivorSaved' : 'nvSurvivorSaved', { n: SURVIVOR.scrap }), SURVIVOR_COLOR);
    this.refreshBackdrop();
    return false;
  }

  /** A bullet hits a survivor: it hurts them, and the squad's fire can kill them. */
  private hurtSurvivor(v: Survivor, damage: number) {
    v.hp -= damage;
    this.effect('', v.x + SURVIVOR.radius + 4, v.y - 6, { life: 520, rise: 36, text: `-${damage}` });
    if (v.hp > 0) {
      sfx('yelp');
      return;
    }
    sfx('survivorLost');
    this.survivors.release(v);
    this.state.survivorsLost++;
    const s = this.splats.take();
    s.age = 0;
    s.sprite.setPosition(v.x, v.y).setScale(GEOM.splat.w / s.sprite.frame.width).setAlpha(1).setVisible(true);
    this.effect('', v.x, v.y - 20, { life: 900, rise: 24, text: tr(this.style === 'comic' ? 'fxSurvivorLost' : 'nvFxSurvivorLost') });
  }

  /** The squad patches up and throws back every zombie near the line. */
  private useMedkit() {
    this.state.medkits--;
    sfx('medkit');
    for (const e of this.enemies.all) {
      if (!e.alive || e.y < REACH_Y - MEDKIT.reach) continue;
      e.y -= MEDKIT.push;
      e.sprite.setY(e.y);
    }
    if (this.bossAct?.acting) this.endBossMove();
    this.showBanner(tr(this.style === 'comic' ? 'medkitUsed' : 'nvMedkitUsed'));
  }

  /** Every so often a boss winds up a move (shown for `BOSS.warnMs`), then makes it. */
  private tickBoss(dt: number) {
    const boss = this.enemies.all.find((e) => e.alive && isBoss(e.kind));
    if (!boss) {
      if (this.bossAct) this.endBossMove();
      return;
    }
    const a = this.bossAct;
    if (!a) {
      this.bossClock += dt;
      if (this.bossClock < (this.state.bossMoves === 0 ? BOSS.firstMs : BOSS.everyMs)) return;
      const move = bossMove(this.state.wave, this.state.bossMoves++);
      // It aims at where the hero stands now; the warning shows where, so they can get out of the way.
      const tx = Phaser.Math.Clamp(this.player.x, LANES[0].x0 + 40, LANES[2].x1 - 40);
      this.bossAct = { move, ms: 0, acting: false, tx, fromX: boss.x, fromY: boss.y };
      this.state.bossMove = move;
      sfx('siren');
      const calls: Record<BossMove, [TextKey, TextKey]> = { charge: ['callCharge', 'nvCallCharge'], spit: ['callSpit', 'nvCallSpit'], call: boss.kind === 'brood' ? ['callBrood', 'nvCallBrood'] : ['callPack', 'nvCallPack'] };
      const call = calls[move];
      this.bossCall.setText(tr(call[this.style === 'comic' ? 0 : 1])).setVisible(true);
      return;
    }
    a.ms += dt;
    this.bossCall.setPosition(boss.x, boss.y - ENEMIES[boss.kind].radius - 46);
    if (!a.acting) {
      if (a.ms < BOSS.warnMs) return;
      a.ms = 0;
      if (a.move === 'charge') {
        a.acting = true;
        a.fromX = boss.x;
        a.fromY = boss.y;
        return;
      }
      if (a.move === 'spit') this.lobAcid(boss.x, boss.y - 20, this.spitRadius(boss.kind), 400, BOSS.poolMs, a.tx);
      else this.callPack(boss);
      this.endBossMove();
      return;
    }
    // The charge: across the lanes to where the hero stood, and further down.
    const t = Math.min(1, a.ms / BOSS.chargeMs);
    boss.x = a.fromX + (a.tx - a.fromX) * t;
    boss.y = a.fromY + BOSS.chargeDrop * t;
    if (t >= 1) this.endBossMove();
  }

  private endBossMove() {
    this.bossAct = null;
    this.bossClock = 0;
    this.state.bossMove = null;
    this.bossCall.setVisible(false);
  }

  /** How wide a boss's acid spit lands: the Bloater's is the big one. */
  private spitRadius(kind: EnemyKind) {
    return kind === 'bloater' ? BLOATER.spitRadius : BOSS.spitRadius;
  }

  /** The boss calls a pack out round it (runners, or crawlers for the Brood Mother); they join the wave's count. */
  private callPack(boss: Enemy) {
    const brood = boss.kind === 'brood';
    this.spawnPack(boss, brood ? 'crawler' : 'runner', brood ? BROOD.pack : BOSS.pack, 30);
  }

  /**
   * A bunch of `n` zombies of a kind comes out round a boss, in two staggered rows: below it, or
   * above it once the boss is within `FLAMER.trigger` of the sandbags, so a pack called or burst
   * at the line still gives the squad time to shoot. The rows also stay `PACK_CLEAR` short of the
   * sandbags, so nothing is ever put behind them.
   */
  private spawnPack(boss: Enemy, kind: EnemyKind, n: number, step: number) {
    const hp = Math.round(ENEMIES[kind].hp * toughness(this.state.wave));
    const maxY = REACH_Y - ENEMIES[kind].radius - PACK_CLEAR;
    const bossR = ENEMIES[boss.kind].radius, near = boss.y + bossR >= REACH_Y - FLAMER.trigger;
    for (let i = 0; i < n; i++) {
      const x = Phaser.Math.Clamp(boss.x + (i - (n - 1) / 2) * step, LANES[0].x0 + 10, LANES[2].x1 - 10);
      const y = near ? boss.y - bossR - 10 - (i % 2) * 12 : boss.y + 26 + (i % 2) * 12;
      this.addEnemy(kind, hp, x, Math.min(y, maxY));
    }
    this.state.waveTotal += n;
  }

  /** Lobs a glob of acid from x, y at the hero's line (where the hero stands, or at `tx`). */
  private lobAcid(x: number, y: number, r: number, flightMs: number, poolMs: number, tx = this.player.x) {
    const a = this.acids.take();
    Object.assign(a, { x: tx, r, fromX: x, fromY: y, flight: flightMs, flightMs, life: poolMs });
    // A spitter hidden by a blackout lobs unheard; the glob is still seen landing.
    if (this.visibility(x, y) > 0) sfx('spit');
    a.glob.setPosition(x, y).setVisible(true);
    a.sprite.setPosition(tx, HERO.y + 6).setScale((GEOM.acid.w / a.sprite.frame.width) * (r / 78)).setAlpha(1).setVisible(false);
  }

  /** Globs fly in an arc and land as puddles; the hero standing in one slows the squad's fire. */
  private moveAcid(dt: number) {
    let inAcid = false;
    for (const a of this.acids.all) {
      if (!a.alive) continue;
      if (a.flight > 0) {
        a.flight -= dt;
        const t = 1 - Math.max(0, a.flight) / a.flightMs;
        a.glob.setPosition(a.fromX + (a.x - a.fromX) * t, a.fromY + (HERO.y - a.fromY) * t - Math.sin(t * Math.PI) * 60);
        if (a.flight <= 0) {
          a.glob.setVisible(false);
          a.sprite.setVisible(true);
          sfx('sizzle');
        }
        continue;
      }
      a.life -= dt;
      if (a.life <= 0) {
        this.acids.release(a);
        continue;
      }
      a.sprite.setAlpha(Math.min(1, a.life / 500));
      if (Math.abs(this.player.x - a.x) <= a.r) inAcid = true;
    }
    this.state.inAcid = inAcid;
  }

  /** Drops a sandbag wall across a lane (or tops up the one already there). */
  private placeWall(lane: number): boolean {
    // Not in the break: the wall would run out before the next wave reaches it.
    if (this.state.sandbags <= 0 || this.state.phase !== 'wave') return false;
    sfx('wall');
    this.state.sandbags--;
    this.state.walls++;
    let w = this.walls.all.find((o) => o.alive && o.lane === lane);
    if (!w) {
      w = this.walls.take();
      w.lane = lane;
      const { x0, x1 } = LANES[lane];
      // Skinned before it is stretched to the lane, as `skin` sets the scale.
      this.skin(w.sprite, 'wall').setPosition((x0 + x1) / 2, WALL.y).setVisible(true);
      w.sprite.setScale(w.sprite.scaleX * ((x1 - x0) / GEOM.wall.w), w.sprite.scaleY);
    }
    w.ms = WALL.ms;
    w.sprite.setAlpha(1);
    this.state.placing = false;
    return true;
  }

  private moveWalls(dt: number) {
    for (const w of this.walls.all) {
      if (!w.alive) continue;
      w.ms -= dt;
      if (w.ms <= 0) this.walls.release(w);
      else w.sprite.setAlpha(Math.min(1, w.ms / 600));
    }
  }

  private smashWall(w: Wall) {
    sfx('wallSmash');
    this.effect('', w.sprite.x, WALL.y - 20, { life: 600, rise: 30, text: tr(this.style === 'comic' ? 'fxWallDown' : 'nvFxWallDown') });
    this.walls.release(w);
  }

  /** A flame burst goes off on its own when a zombie gets close to the sandbags. */
  private tickFlamer(dt: number) {
    this.flameClock = Math.max(0, this.flameClock - dt);
    if (this.state.flames <= 0 || this.flameClock > 0) return;
    const close = this.enemies.all.some((e) => e.alive && e.y + ENEMIES[e.kind].radius >= REACH_Y - FLAMER.trigger);
    if (!close) return;
    this.state.flames--;
    this.flameClock = FLAMER.cooldownMs;
    sfx('flame');
    const caught = this.enemies.all.filter((e) => e.alive && e.y >= REACH_Y - FLAMER.reach);
    for (const e of caught) this.hurt(e, FLAMER.damage(this.state.wave));
    this.effect('flame', VIEW.w / 2, REACH_Y, settings.reduceMotion ? { life: 700 } : { life: 700, grow: 0.08 });
  }

  private movePickups(dt: number) {
    for (const p of this.pickups.all) {
      if (!p.alive) continue;
      p.y += (PICKUP.speed * dt) / 1000;
      // A pickup nobody opened is lost behind the sandbags.
      if (p.y - PICKUP.halfSize > REACH_Y) {
        this.pickups.release(p);
        continue;
      }
      p.sprite.setPosition(p.x, p.y);
      p.label.setPosition(p.x, p.y + PICKUP.halfSize + 2);
      p.hpText.setPosition(p.x - (this.style === 'nv' ? 4 : 0), p.y - (this.style === 'nv' ? 1 : 10)).setText(String(p.hp));
    }
  }

  /** Zombies inside a drum's blast ring, by distance from the drum's centre. */
  private inBlast(d: { x: number; y: number }) {
    return this.enemies.all.filter((e) => e.alive && Math.hypot(e.x - d.x, e.y - d.y) <= DRUM.blastRadius);
  }

  /** Drums roll down; each one's ring and label preview how many zombies its blast would catch. */
  private moveDrums(dt: number) {
    for (const e of this.enemies.all) e.inBlast = false;
    for (const d of this.drums.all) {
      if (!d.alive) continue;
      d.y += (DRUM.speed * dt) / 1000;
      if (d.y - DRUM.halfSize > REACH_Y) {
        this.drums.release(d);
        continue;
      }
      const caught = this.inBlast(d);
      caught.forEach((e) => (e.inBlast = true));
      d.caught = caught.length;
      d.sprite.setPosition(d.x, d.y);
      d.ring.setPosition(d.x, d.y);
      const text = tr(this.style === 'comic' ? 'drumLabel' : 'nvDrumLabel', { n: d.caught });
      if (d.label.text !== text) d.label.setText(text);
      if (this.style === 'comic') d.label.setPosition(d.x, d.y - 33);
      else d.label.setPosition(d.x + 38, d.y + 30);
    }
  }

  private hitTargets() {
    const perks = this.state.perks;
    const fire = perks.includes('fire'), headshots = perks.includes('headshot');
    // One `hit`, `block` and `ricochet` for the whole pass, not one per bullet, and only for what the
    // player can see.
    let struck = false, blocked = false, bounced = false;
    for (const b of this.bullets.all) {
      if (!b.alive) continue;
      const damage = this.state.stats.damage * b.mult;
      // Swept along the stretch from prevY up to y, so a long frame can't carry a bullet through a
      // target; the nearest ones (largest y) are hit first. Survivors are in the way like zombies.
      const sx = b.x - b.prevX, sy = b.y - b.prevY, len2 = sx * sx + sy * sy || 1;
      const inPath = (t: { id: number; x: number; y: number }, radius: number) => {
        if (b.hit.includes(t.id)) return false;
        const r = radius + BULLET.radius;
        // The point of this frame's stretch nearest the target.
        const k = Phaser.Math.Clamp(((t.x - b.prevX) * sx + (t.y - b.prevY) * sy) / len2, 0, 1);
        return (b.prevX + sx * k - t.x) ** 2 + (b.prevY + sy * k - t.y) ** 2 <= r * r;
      };
      const hits: (Enemy | Survivor)[] = [
        ...this.enemies.all.filter((e) => e.alive && inPath(e, ENEMIES[e.kind].radius)),
        ...this.survivors.all.filter((v) => v.alive && inPath(v, SURVIVOR.radius)),
      ];
      hits.sort((a, c) => c.y - a.y);
      let last: Enemy | null = null;
      for (const e of hits) {
        b.hit.push(e.id);
        // A grenade bursts on the first zombie it hits.
        if (b.grenade && 'kind' in e) {
          this.grenade(e.x, e.y);
          b.hitsLeft = 0;
          b.ricochets = 0;
          break;
        }
        if (!('kind' in e)) this.hurtSurvivor(e, damage);
        // A riot shield stops a bullet without pierce, and takes the hit itself.
        else if (e.shield > 0 && !b.pierces) {
          if (this.chipShield(e, damage) && this.visibility(e.x, e.y) > 0) blocked = true;
        }
        else {
          last = e;
          // Headshots: every so many hits lands triple. Fire rounds set the zombie burning.
          const head = headshots && ++this.bulletHits % HEADSHOT.every === 0;
          if (head) {
            this.state.headshots++;
            this.effect('', e.x, e.y - ENEMIES[e.kind].radius - 12, { life: 600, rise: 30, text: tr(this.style === 'comic' ? 'fxHeadshot' : 'nvFxHeadshot') });
          }
          if (fire) e.burn = FIRE_ROUNDS.ms;
          this.hurt(e, head ? damage * HEADSHOT.mult : damage);
          if (e.alive && this.visibility(e.x, e.y) > 0) struck = true;
          // An armoured brute stops the bullet, pierce or not, and nothing ricochets off it.
          if (e.armoured) {
            b.hitsLeft = 0;
            b.ricochets = 0;
            if (this.volleys % 3 === 0) this.effect('', e.x, e.y + ENEMIES[e.kind].radius, { life: 360, rise: 20, text: tr(this.style === 'comic' ? 'fxArmour' : 'nvFxArmour') });
            break;
          }
        }
        if (--b.hitsLeft <= 0) break;
      }
      // Ricochets: a bullet spent on a zombie jumps to the nearest one it hasn't hit, with one more hit.
      if (b.hitsLeft <= 0 && b.ricochets > 0 && last) {
        const from = last.alive ? last : { x: last.x, y: last.y };
        const next = this.nearestEnemy(from.x, from.y, RICOCHET.range, b.hit);
        if (next) {
          b.ricochets--;
          b.hitsLeft = 1;
          b.x = b.prevX = from.x;
          b.y = b.prevY = from.y;
          const ang = Math.atan2(next.x - from.x, from.y - next.y);
          b.vx = Math.sin(ang) * BULLET.speed;
          b.vy = Math.cos(ang) * BULLET.speed;
          b.sprite.setPosition(b.x, b.y).setRotation(ang);
          if (this.visibility(from.x, from.y) > 0) bounced = true;
          this.effect('', from.x, from.y - 16, { life: 400, rise: 20, text: tr(this.style === 'comic' ? 'fxRicochet' : 'nvFxRicochet') });
          continue;
        }
      }
      if (b.hitsLeft <= 0) {
        this.bullets.release(b);
        continue;
      }
      // Then the drums and crates in its way, square hit boxes.
      const boxes: (Drum | Pickup)[] = [...this.drums.all, ...this.pickups.all];
      for (const t of boxes) {
        if (!t.alive || b.hit.includes(t.id)) continue;
        const reach = ('upgrade' in t ? PICKUP.halfSize : DRUM.halfSize) + BULLET.radius;
        const nearX = Phaser.Math.Clamp(t.x, Math.min(b.x, b.prevX), Math.max(b.x, b.prevX));
        if (Math.abs(nearX - t.x) > reach || Math.min(b.y, b.prevY) > t.y + reach || Math.max(b.y, b.prevY) < t.y - reach) continue;
        b.hit.push(t.id);
        t.hp -= damage;
        if (t.hp <= 0) {
          if ('upgrade' in t) this.collect(t);
          else this.explode(t);
        }
        if (--b.hitsLeft <= 0) break;
      }
      if (b.hitsLeft <= 0) this.bullets.release(b);
    }
    if (struck) sfx('hit');
    if (blocked) sfx('block');
    if (bounced) sfx('ricochet');
  }

  /** A grenadier's grenade bursts: every zombie within `GRENADE.radius` takes its damage, past any shield. */
  private grenade(x: number, y: number) {
    const dmg = GRENADE.damage(this.state.wave);
    sfx('grenade');
    const caught = this.enemies.all.filter((e) => e.alive && Math.hypot(e.x - x, e.y - y) <= GRENADE.radius + ENEMIES[e.kind].radius);
    for (const e of caught) this.hurt(e, dmg);
    this.effect('blast', x, y, settings.reduceMotion ? { life: 380, baseScale: 0.42 } : { life: 380, grow: 0.4, baseScale: 0.3 });
  }

  /** The nearest living zombie to x, y within `range`, skipping the ids in `not`. */
  private nearestEnemy(x: number, y: number, range: number, not: number[]) {
    let best: Enemy | null = null, bestD = range;
    for (const e of this.enemies.all) {
      if (!e.alive || not.includes(e.id)) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  /**
   * A bullet on a riot shield: it chips the shield, and the shield breaks at 0. Returns whether the
   * shield held, so `hitTargets` plays one `block` for the pass.
   */
  private chipShield(e: Enemy, damage: number) {
    e.shield = Math.max(0, e.shield - damage);
    const r = ENEMIES[e.kind].radius;
    if (e.shield > 0) {
      if (this.volleys % 3 === 0) this.effect('', e.x, e.y + r, { life: 360, rise: 20, text: tr(this.style === 'comic' ? 'fxBlock' : 'nvFxBlock') });
      return true;
    }
    if (this.visibility(e.x, e.y) > 0) sfx('shieldDown');
    this.skin(e.sprite, 'riot-bare');
    this.effect('', e.x, e.y - r - 10, { life: 700, rise: 30, text: tr(this.style === 'comic' ? 'fxShieldDown' : 'nvFxShieldDown') });
    return false;
  }

  /** Takes hit points off an enemy, with a little damage number, and kills it at 0. */
  private hurt(e: Enemy, damage: number) {
    e.hp -= damage;
    const r = ENEMIES[e.kind].radius;
    this.effect('', e.x + r * 0.8 + 4, e.y - r * 0.4, { life: 520, rise: 36, text: `-${damage}` });
    if (e.hp <= 0) this.kill(e);
  }

  private kill(e: Enemy) {
    this.state.kills++;
    this.state.fallen++;
    this.state.scrap += SCRAP[e.kind];
    // Kills close together build the streak; a full streak sets off a frenzy.
    this.state.streak = this.sinceKill <= FRENZY.gapMs || this.state.frenzyMs > 0 ? this.state.streak + 1 : 1;
    this.sinceKill = 0;
    if (this.state.streak >= FRENZY.kills && this.state.frenzyMs === 0) {
      this.state.frenzyMs = FRENZY.ms;
      this.state.frenzies++;
      this.showBanner(tr(this.style === 'comic' ? 'frenzyBanner' : 'nvFrenzyBanner'));
      sfx('frenzy');
      this.music();
    }
    // A zombie hidden by a blackout falls unheard.
    if (this.visibility(e.x, e.y) > 0) {
      if (isBoss(e.kind)) sfx('bossKill');
      else sfx('kill', { pitch: KILL_PITCH[e.kind] ?? 1 });
    }
    const n = this.state.streak;
    if (n >= 3 && n % 3 === 0) this.effect('streak', e.x + 12, e.y + 2, { life: 700, text: `x${n}`, grow: 0.1 });
    const s = this.splats.take();
    s.age = 0;
    s.sprite.setPosition(e.x, e.y).setScale(((isBoss(e.kind) ? 3 : e.kind === 'brute' ? 1.6 : e.kind === 'crawler' ? 0.7 : 1) * GEOM.splat.w) / s.sprite.frame.width).setAlpha(1).setVisible(true);
    if (this.style === 'comic' && this.state.kills % SPLUT_EVERY === 0) this.effect('sfx-splut', e.x - 30, e.y + 10, { life: 450, grow: 0.1, angle: -5 });
    // The Brood Mother bursts into crawlers; the Bloater leaves a huge acid pool on the squad's line.
    // Released after that, so the burst can't reuse (and move) the dying boss's own enemy object.
    if (e.kind === 'brood') {
      this.spawnPack(e, 'crawler', BROOD.burst, 24);
      this.effect('', e.x, e.y - 50, { life: 900, rise: 30, text: tr(this.style === 'comic' ? 'fxBroodBursts' : 'nvFxBroodBursts') });
    } else if (e.kind === 'bloater') {
      this.lobAcid(e.x, e.y, BLOATER.poolRadius, 600, BLOATER.poolMs);
      this.effect('', e.x, e.y - 50, { life: 900, rise: 30, text: tr(this.style === 'comic' ? 'fxAcidBursts' : 'nvFxAcidBursts') });
    }
    this.enemies.release(e);
  }

  /** A fuel drum goes up: every zombie in its ring takes the blast. */
  private explode(d: Drum) {
    const caught = this.inBlast(d), dmg = blastDamage(this.state.wave);
    sfx('boom');
    let killed = 0;
    for (const e of caught) {
      this.hurt(e, dmg);
      if (!e.alive) killed++;
    }
    this.state.drumsBlown++;
    this.state.lastBlast = { caught: caught.length, killed };
    checkBlast(killed);
    // The blast swells out, or with reduced motion just shows at full size and fades.
    this.effect('blast', d.x, d.y, settings.reduceMotion ? { life: 520, baseScale: 0.8 } : { life: 520, grow: 0.5, baseScale: 0.55 });
    if (this.style === 'comic') this.effect('sfx-boom', d.x, d.y - 40, { life: 700, grow: 0.2 });
    this.drums.release(d);
  }

  private collect(p: Pickup) {
    this.pickups.release(p);
    sfx('crate');
    // A sandbag crate goes into the kit, to be placed in a lane.
    if (p.upgrade === 'sandbag') {
      this.state.sandbags++;
      this.pop(tr(this.style === 'comic' ? 'sandbagsPop' : 'nvSandbagsPop'), CRATE_COLORS.sandbag);
      return;
    }
    // A companion crate that was already falling when the squad filled up brings damage instead.
    const upgrade = p.upgrade === 'companion' && this.state.stats.companions >= MAX_COMPANIONS ? 'damage' : p.upgrade;
    this.state.stats = applyUpgrade(this.state.stats, upgrade);
    this.state.collected[upgrade]++;
    if (upgrade === 'companion') this.addCompanions();
    this.pop(tr(UPGRADES[upgrade].label).toUpperCase(), UPGRADE_COLORS[upgrade]);
    // The third crate of a kind evolves its stat into a perk.
    const perks = perksOf(this.state.collected), gained = perks.find((p) => !this.state.perks.includes(p));
    this.state.perks = perks;
    if (gained) sfx('perk');
    if (gained) this.showBanner(`${tr(PERKS[gained].label).toUpperCase()}!\n${tr(PERKS[gained].detail).toUpperCase()}`);
    this.refreshBackdrop();
  }

  /** A word that pops up over the squad and floats away. */
  private pop(text: string, color: string) {
    const pop = this.add.text(this.player.x, HERO.y - 50, text).setOrigin(0.5).setDepth(DEPTH.hud);
    if (this.style === 'comic') this.font(pop, 18, color, { stroke: THEMES.comic.ink, sw: 5 });
    else this.font(pop, 16, color, { glow: color });
    pop.setX(Phaser.Math.Clamp(this.player.x, pop.width / 2 + 8, VIEW.w - pop.width / 2 - 8));
    this.tweens.add({ targets: pop, y: pop.y - 60, alpha: 0, duration: 1200, onComplete: () => pop.destroy() });
  }

  /** Brings in companions until the squad matches the stats, each in the next free slot (a Gunner unless a role was picked). */
  private addCompanions() {
    while (this.state.roles.length < this.state.stats.companions) this.state.roles.push('gunner');
    while (this.squad.length < this.state.stats.companions) {
      const slot = SQUAD_SLOTS[this.squad.length + 1];
      const c = this.skin(this.add.image(this.player.x + slot.dx, HERO.y + slot.dy, '__DEFAULT'), 'companion').setDepth(this.squadDepth(this.squad.length + 1));
      this.squad.push(c);
    }
    // A companion that joins near the road's edge pushes the squad back onto it.
    const [minX, maxX] = this.heroRange();
    this.player.x = Phaser.Math.Clamp(this.player.x, minX, maxX);
  }

  private tickFrenzy(dt: number) {
    this.sinceKill += dt;
    if (this.state.frenzyMs > 0) {
      this.state.frenzyMs = Math.max(0, this.state.frenzyMs - dt);
      if (this.state.frenzyMs === 0) {
        this.state.streak = 0;
        this.music();
      }
    } else if (this.sinceKill > FRENZY.gapMs) this.state.streak = 0;
  }

  /** Starts an effect: a sprite (by name, '' for none) and an optional text, fading over `life`. */
  private effect(name: string, x: number, y: number, o: { life: number; rise?: number; grow?: number; text?: string; angle?: number; baseScale?: number }) {
    if (name && !this.textures.exists(tex(this.style, name))) return;
    const f = this.fx.take();
    Object.assign(f, { age: 0, life: o.life, rise: o.rise ?? 0, grow: o.grow ?? 0, baseScale: o.baseScale ?? 1 });
    if (name) {
      this.skins.delete(f.sprite);
      this.skin(f.sprite, name).setPosition(x, y).setAngle(o.angle ?? 0).setScale(f.baseScale * this.unit(f.sprite)).setAlpha(1).setVisible(true);
      f.sprite.setDepth(name === 'muzzle' ? DEPTH.muzzle : DEPTH.fx);
    }
    if (o.text) {
      const th = this.theme(), streak = name === 'streak';
      if (this.style === 'comic') this.font(f.text, streak ? 20 : 12, streak ? '#e8402a' : '#fff8e8', { stroke: th.ink, sw: streak ? 4 : 3 });
      else this.font(f.text, streak ? 20 : 11, streak ? th.accent : '#ffffff', { glow: streak ? th.accent : '#ffffff' });
      f.text.setText(o.text).setPosition(x, y - (streak ? 3 : 0)).setAlpha(1).setVisible(true);
    }
  }

  private ageEffects(dt: number) {
    for (const s of this.splats.all) {
      if (!s.alive) continue;
      s.age += dt;
      if (s.age >= SPLAT_MS) this.splats.release(s);
      else s.sprite.setAlpha(1 - s.age / SPLAT_MS);
    }
    for (const f of this.fx.all) {
      if (!f.alive) continue;
      f.age += dt;
      if (f.age >= f.life) {
        this.fx.release(f);
        continue;
      }
      const t = f.age / f.life, alpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      if (f.sprite.visible) f.sprite.setAlpha(alpha).setScale(f.baseScale * (1 + f.grow * t) * this.unit(f.sprite));
      if (f.text.visible) f.text.setAlpha(alpha).setY(f.text.y - (f.rise * dt) / 1000);
    }
  }

  /** A wave is cleared once every enemy in it has come in and fallen; the next one follows a short pause. */
  private checkWave(dt: number) {
    if (this.state.phase === 'wave') {
      if (this.enemiesToCome() === 0 && this.enemies.live().length === 0) {
        this.state.phase = 'break';
        this.breakClock = 0;
        this.state.placing = false;
        // The wave's scrap is banked.
        saveScrap(this.state.bank + this.state.scrap);
        this.showBanner(tr('waveCleared', { wave: this.state.wave }));
        sfx('cleared');
        this.recordOperation(this.state.wave);
        // An operation's last wave cleared wins it.
        const op = OPERATIONS[this.state.operation];
        if (op.waves && this.state.wave >= op.waves) this.completeOperation();
        // A boss leaves a supply drop behind: the game waits for a pick.
        else if (isBossWave(this.state.wave)) {
          this.state.phase = 'supply';
          this.state.offer = supplyPick(this.state.pellets >= SHOTGUN.maxPairs);
          this.showSupply();
          sfx('supply');
          this.music();
        } else this.music();
      }
    } else if (this.state.phase === 'break') {
      this.breakClock += dt;
      if (this.breakClock >= BREAK_MS) this.startWave(this.state.wave + 1);
    }
  }

  /** Health bars over hurt enemies, the boss bar, and the marks on zombies a drum would catch. */
  private drawBars() {
    const g = this.bars.clear(), m = this.marks.clear(), th = this.theme(), comic = this.style === 'comic';
    // In the comic the marks under caught zombies are painted on the road; in night vision they
    // are part of the overlay.
    this.bars.setDepth(comic ? DEPTH.bars : DEPTH.labels);
    this.marks.setDepth(comic ? DEPTH.ringUnder + 0.5 : DEPTH.labels);
    for (const e of this.enemies.all) {
      if (!e.alive || this.visibility(e.x, e.y) < 0.5) continue;
      const r = ENEMIES[e.kind].radius;
      // Burning: a flicker of flame over a zombie with fire rounds in it.
      if (e.burn > 0) {
        const k = Math.max(0.5, e.burn / FIRE_ROUNDS.ms), fy = e.y - r * 0.6, fw = r * 0.9 * k, fh = r * 1.3 * k;
        if (comic) g.lineStyle(3, num(th.ink)).strokeTriangle(e.x - fw, fy, e.x + fw, fy, e.x, fy - fh);
        g.fillStyle(num(comic ? BURN_COLOR : th.accent), comic ? 0.95 : 0.8).fillTriangle(e.x - fw, fy, e.x + fw, fy, e.x, fy - fh);
        g.fillStyle(num(comic ? '#ffe24a' : '#ffffff'), 0.9).fillTriangle(e.x - fw * 0.45, fy, e.x + fw * 0.45, fy, e.x, fy - fh * 0.5);
      }
      if (e.inBlast) {
        if (comic) {
          m.lineStyle(3.5, num(th.ink)).strokeEllipse(e.x, e.y + r * 0.9, (r + 4) * 2, 12);
          m.lineStyle(1.8, num('#ffb02a')).strokeEllipse(e.x, e.y + r * 0.9, (r + 4) * 2, 12);
        } else {
          const top = e.y - r - 11;
          m.lineStyle(1.4, num(th.accent)).strokeTriangle(e.x, top + 6, e.x + (r + 5) * 0.5, top, e.x - (r + 5) * 0.5, top);
        }
      }
      // An armoured brute's plate across its chest.
      if (e.armoured) {
        const pw = r * 1.3, ph = r * 0.75, px = e.x - pw / 2, py = e.y - r * 0.15;
        g.fillStyle(num(comic ? '#9aa6b4' : th.text), comic ? 1 : 0.35).fillRoundedRect(px, py, pw, ph, 3);
        g.lineStyle(comic ? 2 : 1, num(comic ? th.ink : th.text)).strokeRoundedRect(px, py, pw, ph, 3);
      }
      // A riot shield's points, in blue under the health bar.
      if (e.shield > 0 && e.shield < e.maxShield) {
        const sw = r * 2, sy = e.y + r + 4;
        g.fillStyle(num(comic ? th.ink : '#020a05'), 0.8).fillRect(e.x - r - 1, sy - 1, sw + 2, 5);
        g.fillStyle(num(SHIELD_COLOR)).fillRect(e.x - r, sy, (sw * e.shield) / e.maxShield, 3);
      }
      if (e.hp === e.maxHp) continue;
      const w = r * 2, top = e.y - r - 14;
      if (comic) {
        g.fillStyle(num('#fff8e8')).fillRect(e.x - r - 1, top - 1, w + 2, 7);
        g.lineStyle(1.4, num(th.ink)).strokeRect(e.x - r - 1, top - 1, w + 2, 7);
        g.fillStyle(num(th.hp)).fillRect(e.x - r + 0.5, top + 0.5, ((w - 1) * e.hp) / e.maxHp, 4);
      } else {
        g.lineStyle(1, num(th.text)).strokeRect(e.x - r - 1, top - 1, w + 2, 6);
        g.fillStyle(num(th.hp)).fillRect(e.x - r + 0.5, top + 0.5, ((w - 1) * e.hp) / e.maxHp, 3);
      }
    }
    // Survivors: a pale health bar once hurt, and their plea on a balloon in the comic.
    for (const v of this.survivors.all) {
      if (!v.alive || this.visibility(v.x, v.y) < 0.5) continue;
      const r = SURVIVOR.radius, w = r * 2 + 6, top = v.y - r - 14, lw = v.label.width + 14;
      if (comic) {
        g.fillStyle(num('#fff8e8')).fillRoundedRect(v.x - lw / 2, v.y - r - 39, lw, 18, 6);
        g.lineStyle(1.6, num(th.ink)).strokeRoundedRect(v.x - lw / 2, v.y - r - 39, lw, 18, 6);
      } else {
        g.fillStyle(num('#1e1204'), 0.8).fillRoundedRect(v.x - lw / 2, v.y - r - 38, lw, 15, 2);
        g.lineStyle(1, num(SURVIVOR_COLOR)).strokeRoundedRect(v.x - lw / 2, v.y - r - 38, lw, 15, 2);
      }
      if (v.hp === v.maxHp) continue;
      if (comic) {
        g.fillStyle(num('#fff8e8')).fillRect(v.x - w / 2 - 1, top - 1, w + 2, 7);
        g.lineStyle(1.4, num(th.ink)).strokeRect(v.x - w / 2 - 1, top - 1, w + 2, 7);
        g.fillStyle(num(SURVIVOR_COLOR)).fillRect(v.x - w / 2 + 0.5, top + 0.5, ((w - 1) * v.hp) / v.maxHp, 4);
      } else {
        g.lineStyle(1, num(th.text)).strokeRect(v.x - w / 2 - 1, top - 1, w + 2, 6);
        g.fillStyle(num(SURVIVOR_COLOR)).fillRect(v.x - w / 2 + 0.5, top + 0.5, ((w - 1) * v.hp) / v.maxHp, 3);
      }
    }
    // Squad roles: a badge on each grenadier (a round grenade) and marksman (a long scope).
    this.squad.forEach((c, i) => {
      const role = this.state.roles[i];
      if (role === 'gunner') return;
      const col = num(comic ? ROLE_COLORS[role] : th.accent), bx = c.x + 12, by = c.y - 26;
      if (role === 'grenadier') {
        g.fillStyle(col).fillCircle(bx, by, 5);
        g.lineStyle(1.5, num(comic ? th.ink : '#020a05')).strokeCircle(bx, by, 5);
      } else {
        g.fillStyle(col).fillRoundedRect(bx - 7, by - 3, 14, 6, 2);
        g.lineStyle(1.5, num(comic ? th.ink : '#020a05')).strokeRoundedRect(bx - 7, by - 3, 14, 6, 2);
      }
    });
    // Drum labels sit on a balloon in the comic, on a dark tag in night vision.
    for (const d of this.drums.all) {
      if (!d.alive) continue;
      const w = d.label.width + 16;
      if (comic) {
        g.fillStyle(num('#fff8e8')).fillEllipse(d.x, d.y - 33, w + 8, 22);
        g.lineStyle(1.6, num(th.ink)).strokeEllipse(d.x, d.y - 33, w + 8, 22);
        g.fillStyle(num('#fff8e8')).fillTriangle(d.x - 3, d.y - 23, d.x + 4, d.y - 23, d.x + 1, d.y - 15);
        g.lineStyle(1.6, num(th.ink)).lineBetween(d.x - 3, d.y - 22, d.x + 1, d.y - 15).lineBetween(d.x + 1, d.y - 15, d.x + 4, d.y - 22);
      } else {
        g.fillStyle(num('#1e1204'), 0.8).fillRoundedRect(d.x + 38 - w / 2, d.y + 22, w, 15, 2);
        g.lineStyle(1, num(th.accent)).strokeRoundedRect(d.x + 38 - w / 2, d.y + 22, w, 15, 2);
      }
    }
    // Where acid is about to land: a ring on the squad's line.
    for (const a of this.acids.all) {
      if (!a.alive || a.flight <= 0) continue;
      const col = num(comic ? ACID_COLOR : th.warn);
      if (comic) g.lineStyle(4, num(th.ink)).strokeEllipse(a.x, HERO.y + 6, a.r * 2, a.r * 0.72);
      g.lineStyle(2, col).strokeEllipse(a.x, HERO.y + 6, a.r * 2, a.r * 0.72);
    }
    // A boss winding up a move shows what is coming and where.
    const act = this.bossAct, boss = this.enemies.all.find((e) => e.alive && isBoss(e.kind));
    if (act && boss && !act.acting) {
      // Orange, never red: a red ring with a line through it would read as a red crosshair.
      const col = num(comic ? '#ff9a2a' : th.warn), dy = BOSS.chargeDrop;
      if (act.move === 'charge') {
        // The path of the lunge, and where it ends.
        if (comic) g.lineStyle(9, num(th.ink)).lineBetween(boss.x, boss.y, act.tx, boss.y + dy);
        g.lineStyle(5, col, 0.9).lineBetween(boss.x, boss.y, act.tx, boss.y + dy);
        // Where it lands: an arrowhead at the end of the path.
        const ang = Math.atan2(dy, act.tx - boss.x), hx = act.tx, hy = boss.y + dy, k = 16;
        const p1 = { x: hx - Math.cos(ang - 0.5) * k, y: hy - Math.sin(ang - 0.5) * k }, p2 = { x: hx - Math.cos(ang + 0.5) * k, y: hy - Math.sin(ang + 0.5) * k };
        g.fillStyle(col).fillTriangle(hx, hy, p1.x, p1.y, p2.x, p2.y);
        if (comic) g.lineStyle(2, num(th.ink)).strokeTriangle(hx, hy, p1.x, p1.y, p2.x, p2.y);
      } else if (act.move === 'spit') {
        const r = this.spitRadius(boss.kind);
        if (comic) g.lineStyle(4, num(th.ink)).strokeEllipse(act.tx, HERO.y + 6, r * 2, r * 0.72);
        g.lineStyle(2, num(comic ? ACID_COLOR : th.warn)).strokeEllipse(act.tx, HERO.y + 6, r * 2, r * 0.72);
      } else {
        g.lineStyle(comic ? 3 : 1.5, col).strokeCircle(boss.x, boss.y, ENEMIES[boss.kind].radius + 14);
      }
    }
    // Placing a sandbag wall: every lane lights up, with where its wall would stand.
    if (this.state.placing) {
      const col = num(comic ? '#ffd23f' : th.accent);
      for (const l of LANES) {
        g.fillStyle(col, 0.1).fillRect(l.x0 + 3, HUD_HEIGHT + 30, l.x1 - l.x0 - 6, REACH_Y - HUD_HEIGHT - 40);
        g.lineStyle(2, col, 0.8).strokeRect(l.x0 + 3, WALL.y - 14, l.x1 - l.x0 - 6, 28);
      }
    }
    this.placeHint.setText(tr(this.style === 'comic' ? 'placeHint' : 'nvPlaceHint')).setVisible(this.state.placing);
    // A boss also gets a big bar along the top of the screen, under the progress strip.
    if (boss) {
      // Across the whole view, like the progress strip above it.
      const y = HUD_HEIGHT + 32, x = FIELD.x + 40, w = FIELD.w - 80;
      if (comic) {
        g.fillStyle(num(th.ink)).fillRect(x, y, w, 14);
        g.fillStyle(num('#8a2a6a')).fillRect(x + 2, y + 2, ((w - 4) * boss.hp) / boss.maxHp, 10);
      } else {
        g.lineStyle(1, num(th.warn)).strokeRect(x, y, w, 12);
        g.fillStyle(num(th.warn), 0.85).fillRect(x + 2, y + 2, ((w - 4) * boss.hp) / boss.maxHp, 8);
      }
    }
  }

  private updateHud() {
    const s = this.state;
    this.hud.update({
      wave: s.wave,
      kills: s.kills,
      best: s.best,
      newBest: this.bestAtStart > 0 && s.best > this.bestAtStart,
      stats: s.stats,
      fallen: s.fallen,
      total: s.waveTotal,
      bossWave: isBossWave(s.wave),
      bossNext: isBossWave(s.wave + 1),
      nextBoss: this.nextBoss(),
      streak: s.streak,
      frenzyFill: s.frenzyMs > 0 ? s.frenzyMs / FRENZY.ms : Math.min(1, s.streak / FRENZY.kills),
      frenzyOn: s.frenzyMs > 0,
      sandbags: s.sandbags,
      placing: s.placing,
      flames: s.flames,
      medkits: s.medkits,
      pellets: s.pellets,
      inAcid: s.inAcid,
      perks: s.perks,
      condition: s.condition,
      adapt: s.adapt,
      bossLive: this.enemies.all.some((e) => e.alive && isBoss(e.kind)),
      operation: s.operation === 'road' ? null : { label: OPERATIONS[s.operation].label, waves: OPERATIONS[s.operation].waves ?? 0 },
    });
  }

  private nextBoss() {
    let w = this.state.wave + 1;
    while (!isBossWave(w)) w++;
    return w;
  }

  private refreshBackdrop() {
    const s = this.state;
    if (!GameScene.backdrop || !s) return;
    const info: BackdropInfo = {
      wave: s.wave,
      best: s.best,
      kills: s.kills,
      over: s.phase === 'over',
      seconds: Math.floor(this.runMs / 1000),
      squad: s.stats.companions + 1,
      maxSquad: MAX_COMPANIONS + 1,
      damage: s.stats.damage,
      rate: `${fireRate(s.stats)}/s`,
      pierce: s.stats.pierce,
      collected: s.collected,
      inbound: this.pickups ? this.pickups.live().flatMap((p) => (p.upgrade === 'sandbag' ? [] : [p.upgrade])) : [],
      horde: this.enemies ? this.enemies.live().length : 0,
      bossWave: isBossWave(s.wave),
      bossNext: isBossWave(s.wave + 1),
      nextBoss: this.nextBoss(),
    };
    GameScene.backdrop.refresh(info);
  }

  private gameOver() {
    this.state.phase = 'over';
    this.overMs = 0;
    this.state.frenzyMs = 0;
    this.state.placing = false;
    this.pointerTarget = null;
    this.bossCall.setVisible(false);
    // The run's scrap goes in the bank, to spend on starting crates and the outpost.
    this.state.bank += this.state.scrap;
    saveScrap(this.state.bank);
    playMusic(SONG, 'calm');
    playSting(SONG, 'lose');
    this.updateHud();
    this.showGameOver();
    this.refreshBackdrop();
  }

  /** An operation's best is the most of its waves cleared; saved as soon as a run beats it. */
  private recordOperation(cleared: number) {
    const s = this.state;
    if (s.operation === 'road' || cleared <= s.operationBests[s.operation]) return;
    s.operationBests = { ...s.operationBests, [s.operation]: cleared };
    s.best = cleared;
    saveOperationBests(s.operationBests);
  }

  /** The operation's last wave is cleared: the run ends as a win, its scrap paid `OPERATION_BONUS` times. */
  private completeOperation() {
    const s = this.state;
    s.payout = Math.round(s.scrap * OPERATION_BONUS);
    this.endAsWin();
  }

  /** A rectangle over the whole view (`FIELD`), for a shade or a tint. */
  private fieldRect(color: number, alpha: number) {
    return this.add.rectangle(FIELD.x, FIELD.y, FIELD.w, FIELD.h, color, alpha).setOrigin(0);
  }

  /**
   * Moves an overlay, laid out for the 540x960 road, down to the middle of a view taller than that,
   * with its tap boxes. Its first object, the shade over the whole view, stays put.
   */
  private centreOverlay(objs: Phaser.GameObjects.GameObject[], boxes: { y: number }[]) {
    const dy = Math.round((FIELD.h - VIEW.h) / 2);
    if (!dy) return;
    for (const o of objs.slice(1)) (o as unknown as { y: number }).y += dy;
    for (const b of boxes) b.y += dy;
  }

  private showGameOver() {
    this.drawGameOver();
    this.centreOverlay(this.overText, this.shop);
  }

  private drawGameOver() {
    const th = this.theme(), comic = this.style === 'comic', s = this.state;
    const op = OPERATIONS[s.operation], onOp = s.operation !== 'road';
    const shade = this.fieldRect(comic ? 0x15121a : 0x000000, comic ? 0.6 : 0.65).setDepth(DEPTH.hud + 1);
    const won = s.extracted;
    const winTitle = onOp ? tr(comic ? 'operationWon' : 'nvOperationWon') : tr(comic ? 'extracted' : 'nvExtracted');
    const title = this.add.text(VIEW.w / 2, 120, won ? winTitle : tr(comic ? 'overrun' : 'nvOverrun')).setOrigin(0.5).setDepth(DEPTH.hud + 2);
    if (comic) this.font(title, won ? 46 : 52, won ? '#8cd05a' : '#e8402a', { stroke: th.ink, sw: 9 });
    else this.font(title, 30, won ? '#6ae06a' : th.warn, { glow: won ? '#6ae06a' : th.warn });
    const medal = medalOf(s.best), opBest = { op: tr(op.label), best: s.best, waves: op.waves ?? 0 };
    const best = onOp
      ? medal ? tr('opBestMedal', { ...opBest, medal: tr(medal) }) : tr('opBest', opBest)
      : s.wave >= s.best && this.bestAtStart < s.wave ? tr('aNewBest') : tr('bestWave', { wave: s.best });
    const bonus = onOp ? OPERATION_BONUS : EXTRACT.bonus(s.wave);
    const scrap = won ? tr('scrapPaid', { scrap: s.scrap, bonus, payout: s.payout, bank: s.bank }) : tr('scrapBanked', { scrap: s.scrap, bank: s.bank });
    const reached = tr(won ? (onOp ? 'heldTo' : 'gotOut') : 'reached', { wave: s.wave, n: s.kills });
    const info = this.add
      .text(VIEW.w / 2, 158, `${reached}\n${best}\n${scrap}`, { align: 'center' })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.hud + 2);
    const body = (t: Phaser.GameObjects.Text, size: number, color = comic ? '#fff8e8' : th.text) =>
      this.font(t, size, color, comic ? { stroke: th.ink, sw: 5 } : { glow: color });
    body(info, 18);
    const g = this.add.graphics().setDepth(DEPTH.hud + 2);
    const objs: Phaser.GameObjects.GameObject[] = [shade, title, info, g];
    this.shop = [];
    const heading = (y: number, comicText: string, nvText: string) => {
      const t = this.add.text(VIEW.w / 2, y, comic ? comicText : nvText).setOrigin(0.5).setDepth(DEPTH.hud + 2);
      body(t, 13, comic ? '#ffe04a' : th.accent);
      objs.push(t);
    };
    // A button: lit when picked, greyed out when it can't be had, with a colour band, a name and a note.
    const button = (x: number, y: number, w: number, h: number, col: string, lit: boolean, live: boolean, name: string, note: string, act: () => void) => {
      if (comic) {
        g.fillStyle(num(th.ink)).fillRect(x + 4, y + 4, w, h);
        g.fillStyle(num(lit ? col : live ? '#fff8e8' : '#8a8494')).fillRect(x, y, w, h);
        g.lineStyle(2.5, num(th.ink)).strokeRect(x, y, w, h);
        g.fillStyle(num(col)).fillRect(x + 8, y + 8, 12, h - 16);
        g.lineStyle(1.4, num(th.ink)).strokeRect(x + 8, y + 8, 12, h - 16);
      } else {
        g.fillStyle(num(lit ? col : '#020a05'), lit ? 0.3 : 0.8).fillRoundedRect(x, y, w, h, 3);
        g.lineStyle(1.5, num(live ? col : th.muted), live ? 1 : 0.5).strokeRoundedRect(x, y, w, h, 3);
        g.fillStyle(num(col)).fillRect(x + 8, y + 10, 5, h - 20);
      }
      const ink = comic ? th.ink : live ? th.text : th.muted;
      const n = this.add.text(x + 28, y + 15, name).setOrigin(0, 0.5).setDepth(DEPTH.hud + 3);
      this.font(n, 13, ink, comic ? {} : { glow: ink });
      const c = this.add.text(x + 28, y + 26, note).setOrigin(0, 0).setDepth(DEPTH.hud + 3);
      this.font(c, 10, comic ? th.ink : live ? th.accent : th.muted);
      objs.push(n, c);
      this.shop.push({ act, x, y, w, h });
    };
    const grid = (i: number, top: number, step: number) => ({ x: i % 2 ? VIEW.w / 2 + 8 : VIEW.w / 2 - 8 - 220, y: top + Math.floor(i / 2) * step });
    // The scrap shop: starting crates for the next run, each bought once, tapped again to refund.
    heading(262, tr('shopHeading'), tr('nvShopHeading'));
    UPGRADE_KINDS.forEach((kind, i) => {
      const { x, y } = grid(i, 280, 58), bought = s.nextKit.includes(kind), afford = bought || s.bank >= KIT_COSTS[kind];
      const note = bought ? tr(comic ? 'kitBought' : 'nvKitBought') : tr('scrapCost', { n: KIT_COSTS[kind] });
      button(x, y, 220, 48, UPGRADE_COLORS[kind], bought, afford, tr(UPGRADES[kind].label).toUpperCase(), note, () => this.buyKit(kind));
    });
    // The outpost: lasting upgrades, three levels each, bought for good.
    heading(410, tr('outpostHeading'), tr('nvOutpostHeading'));
    OUTPOST_KINDS.forEach((kind, i) => {
      const { x, y } = grid(i, 428, 62), lv = s.outpost[kind], cost = outpostCost(kind, lv), afford = cost !== null && s.bank >= cost;
      const level = cost === null ? tr('outpostMaxed', { level: lv, max: OUTPOST_MAX }) : tr('outpostNext', { level: lv, max: OUTPOST_MAX, cost });
      const note = `${tr(OUTPOST[kind].detail).toUpperCase()}\n${level}`;
      button(x, y, 220, 54, OUTPOST_COLORS[kind], lv > 0, afford, tr(OUTPOST[kind].label).toUpperCase(), note, () => this.buyOutpost(kind));
    });
    // The operation the next run plays: the Open Road, or a 10-wave operation with its own rules.
    heading(568, tr('operationHeading'), tr('nvOperationHeading'));
    OPERATION_KINDS.forEach((kind, i) => {
      const w = 160, x = 18 + i * (w + 11), y = 586, rec = s.operationBests[kind], m = medalOf(rec);
      const waves = OPERATIONS[kind].waves ?? 0;
      const record = kind === 'road' ? tr('bestWaveCaps', { wave: kind === s.operation ? s.best : this.roadBest() }) : m ? tr('opRecordMedal', { best: rec, waves, medal: tr(m).toUpperCase() }) : tr('opRecord', { best: rec, waves });
      button(x, y, w, 76, OPERATION_COLORS[kind], s.nextOperation === kind, true, tr(OPERATIONS[kind].label).toUpperCase(), `${tr(OPERATIONS[kind].detail)}\n${record}`, () => this.pickOperation(kind));
    });
    const again = this.add.text(VIEW.w / 2, 702, tr('tapToStart', { op: tr(OPERATIONS[s.nextOperation].label) })).setOrigin(0.5).setDepth(DEPTH.hud + 2);
    body(again, 18);
    objs.push(again);
    this.overText = objs;
  }

  /** The Open Road's best wave, saved under `deadline-best`. */
  private roadBest() {
    return Math.max(loadBest(), this.state.operation === 'road' ? this.state.best : 0);
  }

  /** Rebuilds the game over screen after a purchase or a pick. */
  private redrawGameOver() {
    for (const t of this.overText) t.destroy();
    this.showGameOver();
  }

  /** Buys a starting crate for the next run with banked scrap, or refunds it. */
  private buyKit(kind: UpgradeKind) {
    const s = this.state;
    if (s.nextKit.includes(kind)) {
      s.nextKit = s.nextKit.filter((k) => k !== kind);
      s.bank += KIT_COSTS[kind];
      ui('click');
    } else if (s.bank >= KIT_COSTS[kind]) {
      s.nextKit = [...s.nextKit, kind];
      s.bank -= KIT_COSTS[kind];
      ui('coin');
    } else {
      ui('refuse');
      return;
    }
    saveScrap(s.bank);
    saveKit(s.nextKit);
    this.redrawGameOver();
  }

  /** Buys the next level of an outpost upgrade, for good. */
  private buyOutpost(kind: OutpostKind) {
    const s = this.state, cost = outpostCost(kind, s.outpost[kind]);
    if (cost === null || s.bank < cost) {
      ui('refuse');
      return;
    }
    ui('coin');
    s.bank -= cost;
    s.outpost = { ...s.outpost, [kind]: s.outpost[kind] + 1 };
    saveScrap(s.bank);
    saveOutpost(s.outpost);
    this.redrawGameOver();
  }

  /** Picks the operation the next run plays. */
  private pickOperation(kind: OperationKind) {
    ui('click');
    this.state.nextOperation = kind;
    saveOperation(kind);
    this.redrawGameOver();
  }

  /** The supply drop after a boss: three cards to pick one from. */
  private showSupply() {
    this.drawSupply();
    this.centreOverlay(this.supplyUi, this.cards);
  }

  private drawSupply() {
    for (const o of this.supplyUi) o.destroy();
    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(0);
    const th = this.theme(), comic = this.style === 'comic';
    const shade = this.fieldRect(comic ? 0x15121a : 0x000000, comic ? 0.5 : 0.55).setDepth(DEPTH.hud + 1);
    const title = this.add.text(VIEW.w / 2, 300, tr(comic ? 'supplyTitle' : 'nvSupplyTitle'), { align: 'center' }).setOrigin(0.5).setDepth(DEPTH.hud + 2);
    if (comic) this.font(title, 34, '#ffe04a', { stroke: th.ink, sw: 8 });
    else this.font(title, 26, th.accent, { glow: th.accent });
    const g = this.add.graphics().setDepth(DEPTH.hud + 2);
    this.supplyUi = [shade, title, g];
    this.cards = [];
    this.state.offer.forEach((kind, i) => {
      const w = 160, h = 230, x = 18 + i * (w + 11), y = 370;
      if (comic) {
        g.fillStyle(num(th.ink)).fillRect(x + 5, y + 5, w, h);
        g.fillStyle(num('#fff8e8')).fillRect(x, y, w, h);
        g.lineStyle(3, num(th.ink)).strokeRect(x, y, w, h);
        g.fillStyle(num('#ffd23f')).fillRect(x, y, w, 30);
        g.lineStyle(2, num(th.ink)).lineBetween(x, y + 30, x + w, y + 30);
      } else {
        g.fillStyle(num('#020a05'), 0.85).fillRoundedRect(x, y, w, h, 4);
        g.lineStyle(1.5, num(th.accent)).strokeRoundedRect(x, y, w, h, 4);
      }
      const key = this.add.text(x + w / 2, y + 15, `${i + 1}`).setOrigin(0.5).setDepth(DEPTH.hud + 3);
      this.font(key, 14, comic ? th.ink : th.accent, comic ? {} : { glow: th.accent });
      const icon = this.add.image(x + w / 2, y + 82, tex(this.style, `supply-${kind}`)).setDepth(DEPTH.hud + 3);
      icon.setScale((GEOM.supply.w / icon.frame.width) * 1.1);
      const name = this.add.text(x + w / 2, y + 136, tr(SUPPLIES[kind].label).toUpperCase()).setOrigin(0.5).setDepth(DEPTH.hud + 3);
      this.fit(this.font(name, comic ? 17 : 15, comic ? th.ink : th.text, comic ? {} : { glow: th.text }), w - 14);
      const detail = this.add.text(x + w / 2, y + 156, tr(SUPPLIES[kind].detail), { align: 'center' }).setOrigin(0.5, 0).setDepth(DEPTH.hud + 3);
      this.font(detail, 11, comic ? th.ink : th.muted);
      this.supplyUi.push(key, icon, name, detail);
      this.cards.push({ kind, x, y, w, h });
    });
    // From wave 20, a fourth card: extract, and end the run as a win with the scrap paid over.
    if (!canExtract(this.state.wave)) return;
    const bonus = EXTRACT.bonus(this.state.wave), x = 18, y = 616, w = VIEW.w - 36, h = 74;
    if (comic) {
      g.fillStyle(num(th.ink)).fillRect(x + 5, y + 5, w, h);
      g.fillStyle(num('#8cd05a')).fillRect(x, y, w, h);
      g.lineStyle(3, num(th.ink)).strokeRect(x, y, w, h);
    } else {
      g.fillStyle(num('#06200c'), 0.9).fillRoundedRect(x, y, w, h, 4);
      g.lineStyle(1.5, num('#6ae06a')).strokeRoundedRect(x, y, w, h, 4);
    }
    const key = this.add.text(x + 16, y + h / 2, '4').setOrigin(0.5).setDepth(DEPTH.hud + 3);
    this.font(key, 14, comic ? th.ink : '#6ae06a', comic ? {} : { glow: '#6ae06a' });
    const icon = this.add.image(x + 56, y + h / 2, tex(this.style, 'supply-extract')).setDepth(DEPTH.hud + 3);
    icon.setScale((GEOM.supply.w / icon.frame.width) * 0.8);
    const name = this.add.text(x + 98, y + 22, tr(comic ? 'extract' : 'nvExtract')).setOrigin(0, 0.5).setDepth(DEPTH.hud + 3);
    this.font(name, comic ? 15 : 13, comic ? th.ink : th.text, comic ? {} : { glow: th.text });
    const pay = Math.round(this.state.scrap * bonus);
    const detail = this.add.text(x + 98, y + 48, tr('extractDetail', { bonus, pay })).setOrigin(0, 0.5).setDepth(DEPTH.hud + 3);
    this.font(detail, 11, comic ? th.ink : th.muted);
    this.supplyUi.push(key, icon, name, detail);
    this.cards.push({ kind: 'extract', x, y, w, h });
  }

  /** Extraction: the run ends as a win, and its scrap goes in the bank with the bonus. */
  private extract() {
    const s = this.state;
    s.payout = Math.round(s.scrap * EXTRACT.bonus(s.wave));
    this.endAsWin();
  }

  /** Ends the run as a win (an extraction or a won operation), banking `payout`. */
  private endAsWin() {
    const s = this.state;
    s.extracted = true;
    s.offer = [];
    for (const o of this.supplyUi) o.destroy();
    this.supplyUi = [];
    this.cards = [];
    s.phase = 'over';
    this.overMs = 0;
    s.frenzyMs = 0;
    s.placing = false;
    this.pointerTarget = null;
    this.bossCall.setVisible(false);
    s.bank += s.payout;
    saveScrap(s.bank);
    playMusic(SONG, 'calm');
    playSting(SONG, 'win');
    this.updateHud();
    this.showGameOver();
    this.refreshBackdrop();
  }

  private pickSupply(kind: SupplyKind | 'extract' | undefined) {
    const s = this.state;
    if (!kind || s.phase !== 'supply') return;
    sfx('confirm');
    if (kind === 'extract') {
      this.extract();
      return;
    }
    if (kind === 'shotgun') s.pellets = Math.min(SHOTGUN.maxPairs, s.pellets + 1);
    else if (kind === 'flamer') s.flames += FLAMER.charges;
    else if (kind === 'medkit') s.medkits++;
    else s.sandbags += 2;
    s.supplies.push(kind);
    s.offer = [];
    for (const o of this.supplyUi) o.destroy();
    this.supplyUi = [];
    this.cards = [];
    s.phase = 'break';
    this.breakClock = 0;
    this.pop(tr(SUPPLIES[kind].label).toUpperCase(), this.style === 'comic' ? '#ffe04a' : this.theme().accent);
    this.music();
  }

  /** A survivor reached the sandbags: three cards for the role they take in the squad. */
  private showRoles() {
    this.drawRoles();
    this.centreOverlay(this.supplyUi, this.roleCards);
  }

  private drawRoles() {
    for (const o of this.supplyUi) o.destroy();
    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(0);
    const th = this.theme(), comic = this.style === 'comic';
    const shade = this.fieldRect(comic ? 0x15121a : 0x000000, comic ? 0.5 : 0.55).setDepth(DEPTH.hud + 1);
    const title = this.add.text(VIEW.w / 2, 300, tr(comic ? 'roleTitle' : 'nvRoleTitle'), { align: 'center' }).setOrigin(0.5).setDepth(DEPTH.hud + 2);
    if (comic) this.font(title, 32, '#ffe04a', { stroke: th.ink, sw: 8 });
    else this.font(title, 24, th.accent, { glow: th.accent });
    const g = this.add.graphics().setDepth(DEPTH.hud + 2);
    this.supplyUi = [shade, title, g];
    this.roleCards = [];
    ROLE_KINDS.forEach((role, i) => {
      const w = 160, h = 210, x = 18 + i * (w + 11), y = 370, col = num(comic ? ROLE_COLORS[role] : th.accent), cx = x + w / 2, cy = y + 78;
      if (comic) {
        g.fillStyle(num(th.ink)).fillRect(x + 5, y + 5, w, h);
        g.fillStyle(num('#fff8e8')).fillRect(x, y, w, h);
        g.lineStyle(3, num(th.ink)).strokeRect(x, y, w, h);
        g.fillStyle(num(ROLE_COLORS[role])).fillRect(x, y, w, 30);
        g.lineStyle(2, num(th.ink)).lineBetween(x, y + 30, x + w, y + 30);
      } else {
        g.fillStyle(num('#020a05'), 0.85).fillRoundedRect(x, y, w, h, 4);
        g.lineStyle(1.5, num(th.accent)).strokeRoundedRect(x, y, w, h, 4);
      }
      // The role's sign: three rounds, a grenade with its burst, or a long scoped round.
      const line = num(comic ? th.ink : th.text);
      g.lineStyle(2, line);
      if (role === 'gunner') {
        for (const dx of [-16, 0, 16]) {
          g.fillStyle(col).fillRoundedRect(cx + dx - 4, cy - 16, 8, 32, 4);
          g.strokeRoundedRect(cx + dx - 4, cy - 16, 8, 32, 4);
        }
      } else if (role === 'grenadier') {
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2;
          g.lineBetween(cx + Math.cos(a) * 22, cy + Math.sin(a) * 22, cx + Math.cos(a) * 30, cy + Math.sin(a) * 30);
        }
        g.fillStyle(col).fillCircle(cx, cy, 16);
        g.strokeCircle(cx, cy, 16);
      } else {
        g.fillStyle(col).fillRoundedRect(cx - 34, cy - 6, 68, 12, 4);
        g.strokeRoundedRect(cx - 34, cy - 6, 68, 12, 4);
        g.fillStyle(col).fillRoundedRect(cx - 12, cy - 16, 26, 9, 3);
        g.strokeRoundedRect(cx - 12, cy - 16, 26, 9, 3);
      }
      const key = this.add.text(cx, y + 15, `${i + 1}`).setOrigin(0.5).setDepth(DEPTH.hud + 3);
      this.font(key, 14, comic ? th.ink : th.accent, comic ? {} : { glow: th.accent });
      const name = this.add.text(cx, y + 126, tr(ROLES[role].label).toUpperCase()).setOrigin(0.5).setDepth(DEPTH.hud + 3);
      this.fit(this.font(name, comic ? 17 : 15, comic ? th.ink : th.text, comic ? {} : { glow: th.text }), w - 14);
      const detail = this.add.text(cx, y + 146, tr(ROLES[role].detail), { align: 'center' }).setOrigin(0.5, 0).setDepth(DEPTH.hud + 3);
      this.font(detail, 11, comic ? th.ink : th.muted);
      this.supplyUi.push(key, name, detail);
      this.roleCards.push({ role, x, y, w, h });
    });
  }

  /** The survivor joins the squad in the role picked, and the game goes on. */
  private pickRole(role: Role | undefined) {
    const s = this.state;
    if (!role || s.phase !== 'role') return;
    sfx('confirm');
    s.stats = applyUpgrade(s.stats, 'companion');
    s.roles.push(role);
    this.addCompanions();
    for (const o of this.supplyUi) o.destroy();
    this.supplyUi = [];
    this.roleCards = [];
    s.phase = this.rolePrev;
    this.pop(tr(this.style === 'comic' ? 'roleJoins' : 'nvRoleJoins', { role: tr(ROLES[role].label).toUpperCase() }), SURVIVOR_COLOR);
    this.refreshBackdrop();
  }
}
