import Phaser from 'phaser';
import { renderScale, splitHudCamera, viewPoint } from '../../../../shared/scaling';
import {
  AURA_DMG,
  AURA_RANGE,
  BOONS,
  BUILD_MORE,
  BUILD_ORDER,
  BUILDINGS,
  EDGES,
  FACTION_IDS,
  FACTIONS,
  MAP_KIND_IDS,
  HEAL_RANGE,
  MAP_SIZE,
  MARKET_LOT,
  RANK_KILLS,
  RANK_NAMES,
  RELICS,
  TECHS,
  TEMPERAMENT_IDS,
  TEMPERAMENTS,
  TILE,
  UNIQUE,
  UNIQUE_EFFECT,
  UNITS,
  isCivil,
  isSoldier,
  unitFor,
  type BoonId,
  type BuildingId,
  type EdgeId,
  type FactionId,
  type MapKind,
  type Cost,
  takesRally,
} from '../game/data';
import { generateMap, idx } from '../game/map';
import {
  AI,
  AI2,
  NEUTRAL,
  PLAYER,
  affordable,
  campAt,
  campSpots,
  canPlace,
  buildingHp,
  chooseBoon,
  chooseEdge,
  createGame,
  deedsDone,
  entityAt,
  explored,
  figureTall,
  hasBuilt,
  inAura,
  issue,
  marketPrice,
  maxHp,
  notAllowed,
  placeBuilding,
  placeWall,
  popCap,
  popUsed,
  postAt,
  seenBuilding,
  releaseBell,
  research,
  ringBell,
  say,
  setRally,
  techQueued,
  clearRally,
  tick,
  trade,
  train,
  unitCost,
  unitCount,
  visible,
  wallLine,
  type Building,
  type Camp,
  type GameState,
  type SimEvent,
  type Unit,
} from '../game/sim';
import { nearestUnit, think } from '../game/planner';
import { byDifficulty, settings } from '../../../../shared/settings';
import { mountWatch, watching, watchSteps } from '../../../../shared/watch';
import { t, type TextKey } from '../i18n';
import { FEET, FRAME, WOOL } from '../art/figures';
import { BUILDING_TOP, CAMP_TOP, CHUNK, paintChunk, TREE_TOP } from '../art/scenery';
import { hexNum, SERIF, T } from '../art/stitch';
import { buildingKey, figKey, relicKey, TREE_VARIANTS } from './BootScene';
import { Effects } from './fx';
import { DeedCard, Minimap, StatusCard, stitchEllipse, stitchLine, Toast, TopBar } from './hud';
import { BOON, BUTTONS, H, PANEL_Y, SEL, TOP_H, W } from './layout';
import { SoundCues } from './sound';
import { checkTrophies } from '../trophies/check';
import { sfx } from '../audio/sfx';
import { COLONY } from '../audio/music';
import { playSting, stopMusic, ui } from '../../../../shared/audio';

const SCROLL_PX_PER_S = 520;
/** How long a raid's horn toast stays up, in game time. */
const RAID_TOAST_MS = 10_000;
/** An attack alert stays on the map this long after its last hit, in game time. */
const ALERT_MS = 8_000;
/** Hits within this many tiles of a live alert belong to it, so one fight is one alert. */
const ALERT_NEAR = 12;
/** How long an attack alert's toast stays up, in game time. */
const ALERT_TOAST_MS = 5_000;
const FOG_RES = 256;

/** A place where the player's units or buildings are being hit, for the toast, the markers and the minimap. */
interface Alert {
  x: number;
  y: number;
  /** Game time of its latest hit. */
  last: number;
}

interface Hud {
  /** What the button does, in no language: a unit, building, tech, boon or edge id, or an action such as 'build'. */
  id: string;
  /** The text on the button, its name and the line under it. */
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

const text = (size: number, color: string = T.ink, bold = false): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: SERIF,
  fontSize: `${size}px`,
  fontStyle: bold ? 'bold' : 'normal',
  color,
});

/** A match of Colonizer: the world, its sprites, the selection and the bottom panel. */
export class GameScene extends Phaser.Scene {
  /** The rules; the test reads it, the scene changes it only through sim functions. */
  state!: GameState;
  /** Selected own units and buildings, by id. */
  selected = new Set<number>();
  /** Control groups, 1 to 9, by key. */
  groups = new Map<number, number[]>();
  /** A building waiting for a place on the map. */
  placing: BuildingId | null = null;
  /** The next click attack-moves the selected army. */
  attackMode = false;
  /** Whether the bottom panel shows the build list, and which of its two pages. */
  buildMenu = false;
  buildPage = 0;
  /** The relics and Monument card under the deeds card. */
  status!: StatusCard;
  /** Buttons in the bottom panel (and the boon cards), in screen coordinates, for the test and for hit-testing. */
  hud: Hud[] = [];
  /** Drop-off badges shown for the player, newest last, such as '+10 wood' (by resource id, in no language). */
  popLog: string[] = [];
  /** Raid toasts shown, newest last. */
  toastLog: string[] = [];
  /** The horn toast, whose `shown` is the line on screen. */
  toast!: Toast;
  /** Attack alerts shown in the toast, newest last, translated. */
  alertLog: string[] = [];
  /** Where the player is under attack now, each kept while the hits go on. */
  alerts: Alert[] = [];
  /** The next click on the map plants the selected buildings' rally flags. */
  rallyMode = false;

  private faction!: FactionId;
  private aiFaction!: FactionId;
  /** The second AI's faction in a three-way match, or null. */
  private rival2: FactionId | null = null;
  private kind: MapKind = 'lowlands';
  /** The sides the planner plays: the AI, the second AI, and the player's side when watching. */
  private aiSides: number[] = [];
  private unitSprites = new Map<number, Phaser.GameObjects.Image>();
  private buildingSprites = new Map<number, Phaser.GameObjects.Image>();
  private nodeSprites = new Map<number, Phaser.GameObjects.Image>();
  private campSprites = new Map<number, Phaser.GameObjects.Image>();
  private postSprites: Phaser.GameObjects.Image[] = [];
  private rallyFlags: Phaser.GameObjects.Image[] = [];
  /** The latest alert that was announced, and until when its toast shows. */
  private alertAt: Alert | null = null;
  /** Sounds and music for what changes in the sim (`scenes/sound.ts`). */
  private cues!: SoundCues;
  /** Counts frames, so watching plays the battle's sounds on one frame in three. */
  private frame = 0;
  private alertText = '';
  private alertToastUntil = 0;
  /** Where the toast's arrow points, so a click on it jumps there. */
  private toastAt: { x: number; y: number } | null = null;
  /** Red markers at the edge of the view, pointing at alerts out of sight. */
  private edgeG!: Phaser.GameObjects.Graphics;
  private edgeMarks: { x: number; y: number; alert: Alert }[] = [];
  /** Where a palisade drag started, in tiles, while placing a wall. */
  private wallStart: { tx: number; ty: number } | null = null;
  private wallGhost!: Phaser.GameObjects.Graphics;
  private chunks = new Set<number>();
  private terrain!: Uint8Array;
  private rings!: Phaser.GameObjects.Graphics;
  private fogTex!: Phaser.Textures.CanvasTexture;
  private fogMask!: HTMLCanvasElement;
  private fogData!: ImageData;
  private lastSight = new Uint8Array(MAP_SIZE * MAP_SIZE).fill(255);
  private needle!: Phaser.GameObjects.Image;
  private needleClock = 0;
  private ghost: Phaser.GameObjects.Image | null = null;
  private dragStart: { x: number; y: number } | null = null;
  private dragBox!: Phaser.GameObjects.Graphics;
  private fx!: Effects;
  private top!: TopBar;
  private deeds!: DeedCard;
  private mini!: Minimap;
  private lastRaid = 0;
  private raidToastUntil = 0;
  /** The notice's time left last frame, and the game time the current notice was said. */
  private noticeLeft = 0;
  private noticeAt = -Infinity;
  private selTitle!: Phaser.GameObjects.Text;
  private selInfo!: Phaser.GameObjects.Text;
  private selBig!: Phaser.GameObjects.Image;
  private selFigs: Phaser.GameObjects.Image[] = [];
  private selG!: Phaser.GameObjects.Graphics;
  private endPanel: Phaser.GameObjects.Container | null = null;
  private buttonObjects: Phaser.GameObjects.GameObject[] = [];
  private panelKey = '';
  /** The selection the panel last showed, so a new selection closes the build list. */
  private panelSelection = '';
  private arrows!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

  constructor() {
    super('Game');
  }

  init(data: { faction?: FactionId; aiFaction?: FactionId; rival2?: FactionId | null; kind?: MapKind }) {
    this.faction = data.faction ?? 'ember';
    this.aiFaction = data.aiFaction ?? 'tide';
    this.rival2 = data.rival2 ?? null;
    this.kind = data.kind ?? 'lowlands';
    if (watching) {
      // Watch mode skips the menu: two different factions, picked at random, both played by the AI,
      // on a map kind picked at random, and every other match a three-way one with the third faction.
      const i = Math.floor(Math.random() * FACTION_IDS.length);
      const step = 1 + Math.floor(Math.random() * (FACTION_IDS.length - 1));
      this.faction = FACTION_IDS[i];
      this.aiFaction = FACTION_IDS[(i + step) % FACTION_IDS.length];
      this.kind = MAP_KIND_IDS[Math.floor(Math.random() * MAP_KIND_IDS.length)];
      this.rival2 = Math.random() < 0.5 ? FACTION_IDS.find((f) => f !== this.faction && f !== this.aiFaction)! : null;
    }
    this.aiSides = [AI, ...(this.rival2 ? [AI2] : []), ...(watching ? [PLAYER] : [])];
    this.selected = new Set();
    this.groups = new Map();
    this.placing = null;
    this.attackMode = false;
    this.rallyMode = false;
    this.buildMenu = false;
    this.buildPage = 0;
    this.panelSelection = '';
    this.wallStart = null;
    this.campSprites = new Map();
    this.postSprites = [];
    this.hud = [];
    this.popLog = [];
    this.toastLog = [];
    this.alertLog = [];
    this.alerts = [];
    this.alertAt = null;
    this.alertText = '';
    this.alertToastUntil = 0;
    this.toastAt = null;
    this.edgeMarks = [];
    this.rallyFlags = [];
    this.unitSprites = new Map();
    this.buildingSprites = new Map();
    this.nodeSprites = new Map();
    this.chunks = new Set();
    this.lastSight = new Uint8Array(MAP_SIZE * MAP_SIZE).fill(255);
    this.ghost = null;
    this.endPanel = null;
    this.buttonObjects = [];
    this.panelKey = '';
    this.selFigs = [];
    this.lastRaid = 0;
    this.raidToastUntil = 0;
    this.noticeLeft = 0;
    this.noticeAt = -Infinity;
  }

  create() {
    const map = generateMap(this.kind, this.rival2 ? 3 : 2);
    this.terrain = map.terrain;
    // The difficulty sets how fast the AIs gather; Normal is the game as designed. Watching, every
    // side gathers alike. Each AI side draws its temperament for the match.
    const mul = watching ? 1 : byDifficulty(0.75, 1, 1.25);
    const temper = () => TEMPERAMENT_IDS[Math.floor(Math.random() * TEMPERAMENT_IDS.length)];
    const sides = [
      { faction: this.faction, gatherMul: 1, temperament: watching ? temper() : null },
      { faction: this.aiFaction, gatherMul: mul, temperament: temper() },
      ...(this.rival2 ? [{ faction: this.rival2, gatherMul: mul, temperament: temper() }] : []),
    ];
    this.state = createGame(sides, map, watching);
    this.cues = new SoundCues(this.state, watching);
    const side = (k: number) => {
      const p = this.state.players[k];
      return { name: `${t(FACTIONS[p.faction].name)} (${t(TEMPERAMENTS[p.temperament ?? 'builder'].name)})`, color: WOOL[p.faction].cloth };
    };
    mountWatch({ sides: Object.fromEntries([PLAYER, ...this.aiSides.filter((k) => k !== PLAYER)].map((k) => [k, side(k)])), time: () => this.state.time });
    const town = [...this.state.buildings.values()].find((b) => b.owner === PLAYER && b.type === 'town')!;
    const world = MAP_SIZE * TILE;
    // The world camera scrolls; the top bar, panel and cards (scroll factor 0) get a fixed camera.
    splitHudCamera(this);
    this.cameras.main.setBounds(0, 0, world, world);
    this.cameras.main.setBackgroundColor(T.linen);
    this.cameras.main.centerOn(town.tx * TILE + 64, town.ty * TILE + 64);

    // Each match has its own ground; drop the last match's chunks, then paint those in view.
    for (const key of this.textures.getTextureKeys()) if (key.startsWith('ground-')) this.textures.remove(key);
    this.paintGround();

    // Fog: unworked linen, masked by what the player has seen, at 2 px a tile and scaled up softly.
    if (this.textures.exists('fog')) this.textures.remove('fog');
    this.fogTex = this.textures.createCanvas('fog', FOG_RES, FOG_RES)!;
    this.fogMask = document.createElement('canvas');
    this.fogMask.width = MAP_SIZE;
    this.fogMask.height = MAP_SIZE;
    this.fogData = new ImageData(MAP_SIZE, MAP_SIZE);
    this.add.image(0, 0, 'fog').setOrigin(0, 0).setScale((MAP_SIZE * TILE) / FOG_RES).setDepth(5000);
    this.needle = this.add.image(0, 0, 'needle').setOrigin(40 / 56, 9 / 56).setDepth(5001).setVisible(false);
    this.rings = this.add.graphics().setDepth(4950);
    this.dragBox = this.add.graphics().setDepth(4960);
    // Placement ghosts sit above the fog, so a site in explored land still shows clearly.
    this.wallGhost = this.add.graphics().setDepth(5002);
    // The trading posts, where trade carts load ore; shown once their ground has been seen.
    for (const p of this.state.posts) this.postSprites.push(this.add.image(p.tx * TILE, p.ty * TILE - BUILDING_TOP, 'post').setOrigin(0, 0).setDepth((p.ty + 2) * TILE - 1).setVisible(false));
    this.fx = new Effects(this);

    this.buildHud();
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    // A release off the canvas (past the window or over a corner button) still ends a drag.
    this.input.on('pointerupoutside', this.onPointerUp, this);
    this.input.keyboard?.on('keydown', this.onKey, this);
    this.arrows = this.input.keyboard!.addKeys({ up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT' }) as unknown as Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;

    this.selectOwn([town.id]);
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 250);
    // Watching, the sim runs once per step of the chosen speed (none while paused), the AI plays both
    // sides and the whole map is in sight.
    for (let i = watchSteps(); i > 0 && this.state.winner === null; i--) {
      tick(this.state, dt);
      for (const side of this.aiSides) think(this.state, dt, side);
    }
    if (watching) this.state.sight.fill(2);
    else checkTrophies(this.state);
    this.scroll(dt);
    this.paintGround();
    this.syncSprites();
    this.drainEvents();
    const v = this.cameras.main.worldView;
    this.cues.update(this.state, { x0: v.x / TILE, y0: v.y / TILE, x1: v.right / TILE, y1: v.bottom / TILE });
    this.fx.update(dt);
    this.renderFog(dt);
    this.renderRings();
    this.top.update(this.state);
    this.deeds.update(this.state);
    this.status.update(this.state);
    this.mini.update(this.state, dt, this.cameras.main.worldView, this.alerts);
    this.renderAlerts();
    this.renderToast();
    this.renderPanel();
    this.renderGhost();
    if (this.state.winner !== null && !this.endPanel) this.showEnd();
  }

  /** Converts a screen point (in game space) to a world point. */
  toWorld(x: number, y: number) {
    const p = this.cameras.main.getWorldPoint(x * renderScale, y * renderScale);
    return { x: p.x / TILE, y: p.y / TILE };
  }

  /** The screen point, in game space, of a world tile. */
  toScreen(tx: number, ty: number) {
    const v = this.cameras.main.worldView;
    return { x: tx * TILE - v.x, y: ty * TILE - v.y };
  }

  // ----------------------------------------------------------- ground, sprites and fog

  /** Paints the ground chunks the camera can see, a few at a time. */
  private paintGround() {
    const v = this.cameras.main.worldView;
    const span = CHUNK * TILE;
    const n = MAP_SIZE / CHUNK;
    let budget = 4;
    for (let cy = Math.max(0, Math.floor(v.y / span)); cy <= Math.min(n - 1, Math.floor((v.bottom - 1) / span)); cy++)
      for (let cx = Math.max(0, Math.floor(v.x / span)); cx <= Math.min(n - 1, Math.floor((v.right - 1) / span)); cx++) {
        const key = cy * n + cx;
        if (this.chunks.has(key) || budget-- <= 0) continue;
        this.chunks.add(key);
        const tex = `ground-${cx}-${cy}`;
        this.textures.addCanvas(tex, paintChunk(this.terrain, cx, cy));
        this.add.image(cx * span, cy * span, tex).setOrigin(0, 0).setDepth(-10);
      }
  }

  /** The frame a unit shows now, from what it is doing. */
  private frameOf(u: Unit) {
    const s = this.state;
    const still = settings.reduceMotion;
    const t = s.time + u.id * 53;
    const def = UNITS[u.type];
    const work = [0, 0, 0, 1, 2, 2, 2];
    if (def.role === 'villager') {
      if (u.act === 'gather') return `${u.carry === 'wood' ? 'chop' : u.carry === 'ore' ? 'mine' : 'reap'}-${still ? 0 : work[Math.floor(t / 110) % work.length]}`;
      if (u.act === 'build') return `build-${still ? 0 : work[Math.floor(t / 110) % work.length]}`;
      if (u.amount > 0 && u.carry) return `carry-${u.carry}-${u.act === 'walk' && !still ? Math.floor(t / 140) % 4 : 0}`;
      if (u.act === 'walk') return `walk-${still ? 0 : Math.floor(t / 140) % 4}`;
      return 'idle-0';
    }
    if (def.role === 'cart') return u.act === 'walk' && !still ? `walk-${Math.floor(t / 120) % 4}` : 'idle-0';
    const since = s.time - u.struck;
    if (u.act === 'fight' || since < def.cooldown * 0.3) {
      if (still) return 'attack-0';
      // Right after a blow: the follow-through; then the wind-up, then the swing coming in.
      const p = since / def.cooldown;
      return `attack-${p < 0.3 ? 2 : p < 0.7 ? 0 : 1}`;
    }
    if (u.act === 'walk') return `walk-${still ? 0 : Math.floor(t / (def.role === 'cavalry' ? 100 : 130)) % 4}`;
    return 'idle-0';
  }

  private syncSprites() {
    const s = this.state;
    for (const [id, img] of this.unitSprites) {
      if (!s.units.has(id)) {
        img.destroy();
        this.unitSprites.delete(id);
      }
    }
    for (const u of s.units.values()) {
      let img = this.unitSprites.get(u.id);
      if (!img) {
        img = this.add.image(0, 0, figKey(u.type, s.players[u.owner].faction), 'idle-0').setOrigin(FEET.x / FRAME, FEET.y / FRAME);
        this.unitSprites.set(u.id, img);
      }
      const seen = u.owner === PLAYER || visible(s, Math.floor(u.x), Math.floor(u.y));
      img.setVisible(seen);
      if (!seen) continue;
      img.setFrame(this.frameOf(u));
      img.setFlipX(u.face < 0);
      img.setPosition(u.x * TILE, u.y * TILE);
      img.setDepth(u.y * TILE + 2);
    }

    for (const [id, img] of this.buildingSprites) {
      if (!s.buildings.has(id)) {
        img.destroy();
        this.buildingSprites.delete(id);
      }
    }
    for (const b of s.buildings.values()) {
      let img = this.buildingSprites.get(b.id);
      if (!img) {
        img = this.add.image(0, 0, buildingKey(s.players[b.owner].faction, b.type)).setOrigin(0, 0);
        this.buildingSprites.set(b.id, img);
      }
      const def = BUILDINGS[b.type];
      // A Monument is seen by everyone from the moment it is begun.
      const seen = seenBuilding(s, b);
      img.setVisible(seen);
      img.setPosition(b.tx * TILE, b.ty * TILE - BUILDING_TOP);
      img.setDepth((b.ty + def.h) * TILE);
      img.setAlpha(b.built ? 1 : 0.5);
    }

    for (const [id, img] of this.nodeSprites) {
      if (!s.nodes.has(id)) {
        img.destroy();
        this.nodeSprites.delete(id);
      }
    }
    for (const n of s.nodes.values()) {
      let img = this.nodeSprites.get(n.id);
      if (!img) {
        const key = n.kind === 'tree' ? `tree-${n.id % TREE_VARIANTS}` : n.kind === 'bush' ? 'bush' : 'mine';
        img = this.add.image(n.tx * TILE, n.ty * TILE - (n.kind === 'tree' ? TREE_TOP : 0), key).setOrigin(0, 0);
        img.setDepth((n.ty + n.h) * TILE - 1);
        this.nodeSprites.set(n.id, img);
      }
      img.setVisible(explored(s, n.tx, n.ty));
    }

    s.posts.forEach((p, i) => this.postSprites[i]?.setVisible(explored(s, p.tx, p.ty)));
    for (const c of s.camps) {
      let img = this.campSprites.get(c.id);
      if (!img) {
        img = this.add.image(c.tx * TILE, c.ty * TILE - CAMP_TOP, this.campKey(c)).setOrigin(0, 0).setDepth((c.ty + 2) * TILE - 1);
        this.campSprites.set(c.id, img);
      }
      if (c.claimed) {
        img.setVisible(false);
        continue;
      }
      const key = this.campKey(c);
      if (img.texture.key !== key) img.setTexture(key);
      img.setVisible(explored(s, c.tx, c.ty));
    }
  }

  /** A camp's texture: its cache, or its relic with the holder's banner. */
  private campKey(c: Camp) {
    if (c.kind === 'cache') return `camp-cache-${c.res}`;
    const holder = c.holder === null ? null : this.state.players[c.holder].faction;
    return relicKey(c.relic!, holder);
  }

  /** Turns what the sim reported this tick into sparks, numbers and drop-off badges. */
  private drainEvents() {
    const s = this.state;
    // One sound of a kind a frame for the fights on screen, quieter when the player's side is not in
    // it; watching, on one frame in three and quieter still.
    const v = this.cameras.main.worldView;
    const loud = !watching || this.frame++ % 3 === 0;
    let blow: { name: 'clash' | 'thwip' | 'volley'; volume: number } | null = null;
    for (const e of s.events) {
      // A rival's blow on the player's side raises an alert, seen or not (the camp guards only fight back).
      if (e.t === 'hit' && e.victim === PLAYER && e.owner !== PLAYER && e.owner !== NEUTRAL && !watching) this.alarm(e);
      if (!visible(s, Math.floor(e.x), Math.floor(e.y))) continue;
      if (e.t === 'hit') {
        this.fx.hit(e.x, e.y, e.fromX, e.fromY, e.dmg, e.ranged);
        const inView = e.x * TILE >= v.x && e.x * TILE <= v.right && e.y * TILE >= v.y && e.y * TILE <= v.bottom;
        const volume = (e.owner === PLAYER || e.victim === PLAYER) && !watching ? 1 : watching ? 0.45 : 0.6;
        if (inView && loud && (!blow || volume > blow.volume)) blow = { name: e.tower ? 'volley' : e.ranged ? 'thwip' : 'clash', volume };
      } else if (e.t === 'grow') continue;
      else if (e.owner === PLAYER && !watching) {
        this.fx.drop(e.x, e.y, e.res, e.n);
        sfx(e.res === 'wood' ? 'dropWood' : e.res === 'food' ? 'dropFood' : 'dropOre');
        this.popLog.push(`+${e.n} ${e.res}`);
        if (this.popLog.length > 20) this.popLog.shift();
      }
    }
    s.events.length = 0;
    if (blow) sfx(blow.name, { volume: blow.volume });
  }

  private renderFog(dt: number) {
    const s = this.state;
    let changed = false;
    for (let i = 0; i < s.sight.length; i++)
      if (s.sight[i] !== this.lastSight[i]) {
        changed = true;
        break;
      }
    if (changed) {
      this.lastSight.set(s.sight);
      const px = this.fogData.data;
      for (let i = 0; i < MAP_SIZE * MAP_SIZE; i++) {
        const v = s.sight[i];
        px[i * 4 + 3] = v === 2 ? 0 : v === 1 ? 120 : 255;
      }
      this.fogMask.getContext('2d')!.putImageData(this.fogData, 0, 0);
      const c = this.fogTex.getContext();
      c.globalCompositeOperation = 'source-over';
      c.clearRect(0, 0, FOG_RES, FOG_RES);
      c.drawImage(this.textures.get('fog-pattern').getSourceImage() as HTMLCanvasElement, 0, 0, FOG_RES, FOG_RES);
      c.globalCompositeOperation = 'destination-in';
      c.imageSmoothingEnabled = true;
      c.drawImage(this.fogMask, 0, 0, FOG_RES, FOG_RES);
      c.globalCompositeOperation = 'source-over';
      this.fogTex.refresh();
    }
    // The needle sits at the edge of the known land nearest the middle of the view.
    this.needleClock -= dt;
    if (this.needleClock > 0) return;
    this.needleClock = 1500;
    const v = this.cameras.main.worldView;
    const cx = (v.x + v.width / 2) / TILE;
    const cy = (v.y + (PANEL_Y - TOP_H) / 2) / TILE;
    let best: { x: number; y: number; d: number } | null = null;
    for (let ty = Math.max(1, Math.floor(v.y / TILE) + 3); ty < Math.min(MAP_SIZE - 1, Math.floor((v.y + PANEL_Y) / TILE) - 2); ty++)
      for (let tx = Math.max(1, Math.floor(v.x / TILE) + 2); tx < Math.min(MAP_SIZE - 1, Math.floor(v.right / TILE) - 2); tx++) {
        if (s.sight[idx(tx, ty)] !== 0) continue;
        if (s.sight[idx(tx - 1, ty)] === 0 && s.sight[idx(tx, ty - 1)] === 0 && s.sight[idx(tx, ty + 1)] === 0) continue;
        const d = Math.hypot(tx - cx, ty - cy);
        if (!best || d < best.d) best = { x: tx, y: ty, d };
      }
    if (best) this.needle.setPosition((best.x + 0.5) * TILE, (best.y + 0.5) * TILE).setVisible(true);
    else this.needle.setVisible(false);
  }

  /** Selection rings in chain stitch, health threads and build progress, over the sprites. */
  private renderRings() {
    const g = this.rings;
    g.clear();
    const s = this.state;
    const ochre = hexNum(T.ochre);
    for (const id of this.selected) {
      const u = s.units.get(id);
      if (u) stitchEllipse(g, u.x * TILE, u.y * TILE + 1, 11, 4.5, 1.5, ochre);
      const b = s.buildings.get(id);
      if (b) {
        const def = BUILDINGS[b.type];
        const x0 = b.tx * TILE - 2;
        const y0 = b.ty * TILE - 2;
        const x1 = (b.tx + def.w) * TILE + 2;
        const y1 = (b.ty + def.h) * TILE + 2;
        stitchLine(g, x0, y1, x1, y1, 1.5, ochre);
        stitchLine(g, x0, y0 + def.h * TILE * 0.5, x0, y1, 1.5, ochre);
        stitchLine(g, x1, y0 + def.h * TILE * 0.5, x1, y1, 1.5, ochre);
      }
    }
    for (const u of s.units.values()) {
      const def = UNITS[u.type];
      const mine = u.owner === PLAYER;
      if (!mine && !visible(s, Math.floor(u.x), Math.floor(u.y))) continue;
      const top = (u.y - figureTall(def)) * TILE;
      // A champion's gift shows as a faint ring: ochre for the Warlord's aura, green for the Druid's healing.
      if (def.gift === 'aura') stitchEllipse(g, u.x * TILE, u.y * TILE, AURA_RANGE * TILE, AURA_RANGE * TILE * 0.6, 1.2, ochre, 0.45);
      if (def.gift === 'heal') stitchEllipse(g, u.x * TILE, u.y * TILE, HEAL_RANGE * TILE, HEAL_RANGE * TILE * 0.6, 1.2, hexNum(T.green), 0.45);
      // Veteran chevrons over the head, one per rank.
      for (let k = 0; k < u.rank; k++) {
        const cx = u.x * TILE - 4 + k * 4;
        const cy = top - 4;
        g.lineStyle(1.2, mine ? ochre : hexNum(T.ink), 1);
        g.beginPath();
        g.moveTo(cx - 2, cy - 2);
        g.lineTo(cx, cy);
        g.lineTo(cx + 2, cy - 2);
        g.strokePath();
      }
      const max = maxHp(u);
      if (!this.selected.has(u.id) && u.hp >= max) continue;
      const foe = u.owner === NEUTRAL ? WOOL.wild.cloth : WOOL[s.players[u.owner].faction].cloth;
      this.thread(g, u.x * TILE - 9, top, 18, u.hp / max, mine ? T.green : foe);
    }
    // Each selected building's rally flag, with a running thread out to it.
    const flagged = this.rallyBuildings().filter((b) => b.rally);
    while (this.rallyFlags.length < flagged.length) this.rallyFlags.push(this.add.image(0, 0, 'rally-flag').setOrigin(4 / 28, 38 / 40).setDepth(4955));
    this.rallyFlags.forEach((f, i) => f.setVisible(i < flagged.length));
    flagged.forEach((rb, i) => {
      const def = BUILDINGS[rb.type];
      const fx = rb.rally!.x * TILE;
      const fy = rb.rally!.y * TILE;
      stitchLine(g, (rb.tx + def.w / 2) * TILE, (rb.ty + def.h / 2) * TILE, fx, fy, 1.2, ochre, 0.85);
      stitchEllipse(g, fx, fy, 7, 3, 1.2, ochre);
      this.rallyFlags[i].setPosition(fx, fy);
    });
    // Where the player is under attack: rings of red running stitch on the ground.
    const red = hexNum(T.red);
    for (const a of this.alerts) {
      for (let k = 0; k < 2; k++) {
        const rad = settings.reduceMotion ? 20 + k * 14 : 14 + ((s.time / 25 + k * 20) % 40);
        const alpha = settings.reduceMotion ? 0.8 : 1 - (rad - 14) / 40;
        stitchEllipse(g, a.x * TILE, a.y * TILE, rad, rad * 0.6, 1.6, red, alpha);
      }
    }
    for (const b of s.buildings.values()) {
      const def = BUILDINGS[b.type];
      if (b.owner !== PLAYER && !visible(s, b.tx, b.ty)) continue;
      if (!b.built) this.thread(g, b.tx * TILE + 4, b.ty * TILE - BUILDING_TOP + 2, def.w * TILE - 8, 1 - b.buildLeft / Math.max(1, def.time), T.indigo);
      else if (b.hp < buildingHp(s, b)) this.thread(g, b.tx * TILE + 4, b.ty * TILE - BUILDING_TOP + 2, def.w * TILE - 8, b.hp / buildingHp(s, b), b.owner === PLAYER ? T.green : T.red);
      // A sheltering garrison: a knot of ochre per villager inside, along the top of the walls.
      for (let k = 0; k < b.garrison.length; k++) {
        g.fillStyle(ochre, 1).fillCircle(b.tx * TILE + 8 + (k % 6) * 7, b.ty * TILE - BUILDING_TOP + 10 + Math.floor(k / 6) * 7, 2.4);
      }
    }
  }

  /** A health or progress bar as two stitched threads. */
  private thread(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, frac: number, col: string) {
    stitchLine(g, x, y, x + w, y, 2.2, hexNum('#b8a888'));
    const f = Math.max(0, Math.min(1, frac));
    if (f > 0) stitchLine(g, x, y, x + w * f, y, 2.2, hexNum(col));
  }

  private scroll(dt: number) {
    const cam = this.cameras.main;
    const k = this.arrows;
    let dx = 0;
    let dy = 0;
    if (k.left.isDown) dx -= 1;
    if (k.right.isDown) dx += 1;
    if (k.up.isDown) dy -= 1;
    if (k.down.isDown) dy += 1;
    const pointer = this.input.activePointer;
    const p = viewPoint(pointer);
    // Only a mouse scrolls at the edge: a finger's last tap leaves the pointer where it lifted. A mouse
    // pushed against the screen's left or top edge sits at 0, so that counts; one that has left the
    // canvas (`isOver`) or never moved (still at 0, 0) doesn't.
    const mouse = !pointer.wasTouch && pointer.moveTime > 0 && this.game.input.isOver;
    if (pointer.isDown === false && mouse && p.x >= 0 && p.x < W && p.y >= 0 && p.y < H) {
      if (p.x < 6) dx -= 1;
      if (p.x > W - 6) dx += 1;
      if (p.y < 6) dy -= 1;
      if (p.y > H - 6) dy += 1;
    }
    cam.setScroll(cam.scrollX + (dx * SCROLL_PX_PER_S * dt) / 1000, cam.scrollY + (dy * SCROLL_PX_PER_S * dt) / 1000);
  }

  // ----------------------------------------------------------- selection and commands

  private selectOwn(ids: number[]) {
    this.selected.clear();
    for (const id of ids) {
      const u = this.state.units.get(id);
      const b = this.state.buildings.get(id);
      if ((u && u.owner === PLAYER) || (b && b.owner === PLAYER)) this.selected.add(id);
    }
    this.panelKey = '';
  }

  private selectedUnits(): Unit[] {
    const out: Unit[] = [];
    for (const id of this.selected) {
      const u = this.state.units.get(id);
      if (u && u.owner === PLAYER) out.push(u);
    }
    return out;
  }

  private selectedBuilding(): Building | null {
    for (const id of this.selected) {
      const b = this.state.buildings.get(id);
      if (b && b.owner === PLAYER) return b;
    }
    return null;
  }

  /** The selected own buildings that train units, whose rally flags a right click plants. */
  private rallyBuildings(): Building[] {
    const out: Building[] = [];
    for (const id of this.selected) {
      const b = this.state.buildings.get(id);
      if (b && b.owner === PLAYER && takesRally(b.type)) out.push(b);
    }
    return out;
  }

  /** Plants the selected buildings' rally flags at a point, or takes them down on one of those buildings. */
  private plantRally(tx: number, ty: number) {
    const all = this.rallyBuildings();
    const hit = entityAt(this.state, tx, ty, undefined, PLAYER, true);
    if (hit && hit.kind === 'building' && all.some((b) => b.id === hit.id)) {
      if (all.filter((b) => clearRally(this.state, PLAYER, b.id)).length > 0) {
        say(this.state, t('rallyCleared'));
        sfx('flagDown');
      }
      return;
    }
    if (all.filter((b) => setRally(this.state, PLAYER, b.id, tx, ty)).length > 0) {
      say(this.state, t('rallySet'));
      sfx('flag');
    } else ui('refuse');
  }

  /** Centres the camera on a world tile, allowing for the panel and top bar. */
  private jumpTo(x: number, y: number) {
    sfx('whoosh');
    this.cameras.main.centerOn(x * TILE, y * TILE + (H - PANEL_Y - TOP_H) / 2);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    const p = Object.assign(viewPoint(pointer), { rightButtonDown: () => pointer.rightButtonDown(), event: pointer.event });
    if (this.endPanel) return void this.scene.start(watching ? 'Game' : 'Menu');
    if (this.mini.contains(p.x, p.y)) {
      const t = this.mini.toTile(p.x, p.y);
      this.cameras.main.centerOn(t.x * TILE, t.y * TILE + (H - PANEL_Y - TOP_H) / 2);
      return;
    }
    // Only a raid or alert toast takes the click; a plain notice lets it through to the world.
    if (this.toastAt && this.toast.contains(p.x, p.y)) return void this.jumpTo(this.toastAt.x, this.toastAt.y);
    // A marker at the edge of the view jumps to the attack it points at.
    const mark = this.edgeMarks.find((m) => Math.hypot(m.x - p.x, m.y - p.y) <= 14);
    if (mark) return void this.jumpTo(mark.alert.x, mark.alert.y);
    if (p.y < TOP_H || p.y >= PANEL_Y || this.deeds.contains(p.x, p.y) || this.status.contains(p.x, p.y)) return;
    // Watching, a click only selects, to see what a unit is doing; the AI gives every order.
    if (watching && p.rightButtonDown()) return;
    const w = this.toWorld(p.x, p.y);
    const tx = w.x;
    const ty = w.y;

    if (p.rightButtonDown()) {
      if (this.placing || this.attackMode || this.rallyMode) {
        this.placing = null;
        this.attackMode = false;
        this.rallyMode = false;
        this.buildMenu = false;
        this.wallStart = null;
        return;
      }
      // Production buildings and no units: a right click plants their rally flags (on one of them, takes them down).
      if (this.selectedUnits().length === 0 && this.rallyBuildings().length > 0) {
        this.plantRally(tx, ty);
        return;
      }
      this.commandAt(tx, ty);
      return;
    }

    if (this.placing === 'wall') {
      // A palisade is dragged out as a line, from here to where the button comes up.
      this.wallStart = { tx: Math.floor(tx), ty: Math.floor(ty) };
      return;
    }
    if (this.placing) {
      this.tryPlace(this.placing, tx, ty, p.event.shiftKey);
      return;
    }
    if (this.rallyMode) {
      this.plantRally(tx, ty);
      this.rallyMode = false;
      return;
    }
    if (this.attackMode) {
      const ids = this.selectedUnits().map((u) => u.id);
      issue(this.state, PLAYER, ids, { t: 'attackMove', x: tx, y: ty });
      if (ids.length > 0) sfx('order');
      this.attackMode = false;
      return;
    }
    this.dragStart = { x: p.x, y: p.y };
  }

  private onPointerMove(pointer: Phaser.Input.Pointer) {
    if (!this.dragStart || !pointer.isDown) return;
    const p = viewPoint(pointer);
    // The box stops at the play area, like the select on release.
    p.y = Math.min(Math.max(p.y, TOP_H), PANEL_Y - 1);
    const g = this.dragBox.clear();
    const v = this.cameras.main.worldView;
    const x0 = Math.min(this.dragStart.x, p.x) + v.x;
    const y0 = Math.min(this.dragStart.y, p.y) + v.y;
    const x1 = Math.max(this.dragStart.x, p.x) + v.x;
    const y1 = Math.max(this.dragStart.y, p.y) + v.y;
    const ochre = hexNum(T.ochre);
    stitchLine(g, x0, y0, x1, y0, 1.2, ochre);
    stitchLine(g, x1, y0, x1, y1, 1.2, ochre);
    stitchLine(g, x1, y1, x0, y1, 1.2, ochre);
    stitchLine(g, x0, y1, x0, y0, 1.2, ochre);
  }

  private onPointerUp(pointer: Phaser.Input.Pointer) {
    const p = Object.assign(viewPoint(pointer), { event: pointer.event, wasTouch: pointer.wasTouch });
    this.dragBox.clear();
    if (this.wallStart && this.placing === 'wall') {
      const end = this.toWorld(p.x, p.y);
      this.tryWall(this.wallStart, { tx: Math.floor(end.x), ty: Math.floor(end.y) }, p.event.shiftKey);
      this.wallStart = null;
      return;
    }
    const start = this.dragStart;
    this.dragStart = null;
    if (!start) return;
    // A press starts only in the play area; a release over the top bar, panel or off the canvas selects up to its edge.
    p.x = Math.min(Math.max(p.x, 0), W - 1);
    p.y = Math.min(Math.max(p.y, TOP_H), PANEL_Y - 1);
    const a = this.toWorld(start.x, start.y);
    const b = this.toWorld(p.x, p.y);
    const moved = Math.hypot(p.x - start.x, p.y - start.y);
    const additive = p.event.shiftKey;
    if (moved < 5) {
      // A click picks one's own unit over an enemy standing on it; a tap keeps the nearest, to order an attack on it.
      const hit = entityAt(this.state, b.x, b.y, p.wasTouch ? undefined : PLAYER, undefined, true);
      // A touch screen has no right click, so a tap gives the orders one would.
      if (p.wasTouch && !watching && this.tapOrder(b.x, b.y, entityAt(this.state, b.x, b.y, undefined, PLAYER, true))) return;
      if (!hit) {
        if (!additive) this.selectOwn([]);
        const camp = campAt(this.state, b.x, b.y, true);
        if (camp) say(this.state, this.campText(camp));
        else if (postAt(this.state, b.x, b.y, true)) say(this.state, t('tradingPost'));
        return;
      }
      if (hit.owner !== PLAYER && hit.kind !== 'node') {
        if (!additive) this.selectOwn([]);
        return;
      }
      if (hit.kind === 'node') return;
      if (additive) {
        if (this.selected.has(hit.id)) this.selected.delete(hit.id);
        else this.selected.add(hit.id);
      } else this.selectOwn([hit.id]);
      sfx('select');
      this.panelKey = '';
      return;
    }
    // Box select: own units inside the box.
    const x0 = Math.min(a.x, b.x);
    const x1 = Math.max(a.x, b.x);
    const y0 = Math.min(a.y, b.y);
    const y1 = Math.max(a.y, b.y);
    const inside = [...this.state.units.values()].filter((u) => u.owner === PLAYER && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1);
    if (!additive) this.selected.clear();
    for (const u of inside) this.selected.add(u.id);
    if (inside.length > 0) sfx('select');
    this.panelKey = '';
  }

  /**
   * A tap on a touch screen: with units selected, a tap anywhere but on another own unit or finished
   * building orders them like a right click (an unfinished own building or a farm included, for the
   * villagers); with a production building alone, a tap on the ground, a node or a farm plants its
   * rally flag. Returns false when the tap should select instead.
   */
  private tapOrder(tx: number, ty: number, hit: ReturnType<typeof entityAt>): boolean {
    const own = hit && hit.kind !== 'node' && hit.owner === PLAYER;
    const ownBuilding = own && hit.kind === 'building' ? this.state.buildings.get(hit.id) : undefined;
    const farm = !!ownBuilding && !!BUILDINGS[ownBuilding.type].farm;
    if (this.selectedUnits().length > 0) {
      const work = !!ownBuilding && (!ownBuilding.built || farm) && this.selectedUnits().some((u) => UNITS[u.type].role === 'villager');
      if (own && !work) return false;
      this.commandAt(tx, ty);
      return true;
    }
    if (this.rallyBuildings().length === 0 || (own && !farm)) return false;
    this.plantRally(tx, ty);
    return true;
  }

  /** What a camp is, for the notice shown when it is clicked. */
  private campText(c: Camp) {
    const guarded = c.guards.some((id) => this.state.units.has(id));
    if (c.kind === 'cache') return t(guarded ? 'cacheGuarded' : 'cacheFree', { n: c.amount, res: t(c.res!) });
    const r = RELICS[c.relic!];
    const by = c.holder === null ? (guarded ? 'relicGuarded' : 'relicNobody') : c.holder === PLAYER ? 'relicYours' : 'relicEnemy';
    return t('campRelic', { relic: t(r.name), effect: t(r.text), by: t(by) });
  }

  /** A right click: attack, gather, build, or walk, depending on what is under it. */
  private commandAt(tx: number, ty: number) {
    const units = this.selectedUnits();
    if (units.length === 0) return;
    sfx('order');
    const camp = campAt(this.state, tx, ty, true);
    if (camp) {
      // To a camp: stand round it, close enough to take it once its guards are down.
      const spots = campSpots(this.state, camp);
      units.forEach((u, i) => {
        const at = spots[i % Math.max(1, spots.length)];
        const order = UNITS[u.type].role === 'villager' ? 'move' : 'attackMove';
        if (at) issue(this.state, PLAYER, [u.id], { t: order, x: at.x, y: at.y });
      });
      return;
    }
    const hit = entityAt(this.state, tx, ty, undefined, PLAYER, true);
    const villagers = units.filter((u) => UNITS[u.type].role === 'villager');
    const carts = units.filter((u) => UNITS[u.type].role === 'cart');
    const army = units.filter((u) => isSoldier(UNITS[u.type].role));
    if (postAt(this.state, tx, ty, true)) {
      // To a trading post: carts set off trading, everyone else walks there.
      issue(this.state, PLAYER, carts.map((u) => u.id), { t: 'trade' });
      issue(this.state, PLAYER, [...villagers, ...army].map((u) => u.id), { t: 'move', x: tx, y: ty });
      return;
    }
    if (hit && hit.kind !== 'node' && hit.owner !== PLAYER) {
      issue(this.state, PLAYER, army.map((u) => u.id), { t: 'attack', target: hit.id });
      issue(this.state, PLAYER, [...villagers, ...carts].map((u) => u.id), { t: 'move', x: tx, y: ty });
      return;
    }
    if (hit && hit.kind === 'node') {
      const node = this.state.nodes.get(hit.id);
      if (node) issue(this.state, PLAYER, villagers.map((u) => u.id), { t: 'gather', node: node.id });
      issue(this.state, PLAYER, [...army, ...carts].map((u) => u.id), { t: 'move', x: tx, y: ty });
      return;
    }
    if (hit && hit.kind === 'building') {
      const b = this.state.buildings.get(hit.id)!;
      if (!b.built) issue(this.state, PLAYER, villagers.map((u) => u.id), { t: 'build', b: b.id });
      else if (BUILDINGS[b.type].farm) issue(this.state, PLAYER, villagers.map((u) => u.id), { t: 'gather', node: b.id });
      else issue(this.state, PLAYER, villagers.map((u) => u.id), { t: 'move', x: tx, y: ty });
      issue(this.state, PLAYER, [...army, ...carts].map((u) => u.id), { t: 'move', x: tx, y: ty });
      return;
    }
    // Walk: spread the group around the spot so the units don't stack on one tile.
    units.forEach((u, i) => {
      const ox = (i % 4) - 1.5;
      const oy = Math.floor(i / 4) - 1.5;
      issue(this.state, PLAYER, [u.id], { t: 'move', x: tx + ox, y: ty + oy });
    });
  }

  private tryPlace(type: BuildingId, tx: number, ty: number, keep: boolean) {
    const def = BUILDINGS[type];
    const ox = Math.floor(tx) - Math.floor(def.w / 2);
    const oy = Math.floor(ty) - Math.floor(def.h / 2);
    const p = this.state.players[PLAYER];
    const why = notAllowed(this.state, PLAYER, type);
    if (why) {
      say(this.state, why);
      return void ui('refuse');
    }
    if (!affordable(p, def.cost)) {
      say(this.state, t('notEnoughResources'));
      return void ui('refuse');
    }
    if (!canPlace(this.state, type, ox, oy, PLAYER)) {
      say(this.state, t(def.shore ? 'dockShore' : 'cantBuild'));
      return void ui('refuse');
    }
    const id = placeBuilding(this.state, PLAYER, type, ox, oy);
    if (id === null) return void ui('refuse');
    sfx('place');
    const builders = this.selectedUnits().filter((u) => UNITS[u.type].role === 'villager');
    const builder = nearestUnit(builders.length > 0 ? builders : this.ownVillagers(), ox + def.w / 2, oy + def.h / 2);
    if (builder) issue(this.state, PLAYER, [builder.id], { t: 'build', b: id });
    if (!keep) this.placing = null;
  }

  /** Places a palisade line and sends the selected villagers (or the nearest one) to build it. */
  private tryWall(from: { tx: number; ty: number }, to: { tx: number; ty: number }, keep: boolean) {
    const ids = placeWall(this.state, PLAYER, wallLine(from.tx, from.ty, to.tx, to.ty));
    if (ids.length === 0) {
      say(this.state, t(affordable(this.state.players[PLAYER], BUILDINGS.wall.cost) ? 'cantBuild' : 'notEnoughWood'));
      return void ui('refuse');
    }
    sfx('place');
    const builders = this.selectedUnits().filter((u) => UNITS[u.type].role === 'villager');
    // With none selected, the villager nearest the first stake, where a crew of one starts.
    const first = this.state.buildings.get(ids[0])!;
    const nearest = nearestUnit(this.ownVillagers(), first.tx + 0.5, first.ty + 0.5);
    const crew = builders.length > 0 ? builders : nearest ? [nearest] : [];
    // Each builder starts on its own piece; when done, each goes on to the next one nearby.
    crew.forEach((u, i) => issue(this.state, PLAYER, [u.id], { t: 'build', b: ids[Math.floor((i * ids.length) / crew.length)] }));
    if (!keep) this.placing = null;
  }

  private ownVillagers() {
    return [...this.state.units.values()].filter((u) => u.owner === PLAYER && UNITS[u.type].role === 'villager');
  }

  private onKey(e: KeyboardEvent) {
    if (this.endPanel || watching) return;
    const digit = /^[1-9]$/.test(e.key) ? Number(e.key) : null;
    if (digit !== null) {
      if (e.ctrlKey) this.groups.set(digit, [...this.selected]);
      else {
        const ids = (this.groups.get(digit) ?? []).filter((id) => this.state.units.has(id) || this.state.buildings.has(id));
        this.selectOwn(ids);
        if (ids.length > 0) sfx('select');
      }
      return;
    }
    switch (e.key.toLowerCase()) {
      case 'a':
        if (this.selectedUnits().some((u) => isSoldier(UNITS[u.type].role))) this.attackMode = true;
        break;
      case 's':
        if (this.selectedUnits().length > 0) sfx('order');
        issue(this.state, PLAYER, this.selectedUnits().map((u) => u.id), { t: 'stop' });
        break;
      case 'b':
        if (this.selectedUnits().some((u) => UNITS[u.type].role === 'villager')) this.buildMenu = !this.buildMenu;
        break;
      case ' ': {
        // Space jumps to the latest attack, or the raid under way.
        const a = this.alerts[this.alerts.length - 1];
        const r = this.state.raid;
        if (a) this.jumpTo(a.x, a.y);
        else if (r && r.target === PLAYER) this.jumpTo(r.x, r.y);
        break;
      }
      case 'escape':
        this.placing = null;
        this.attackMode = false;
        this.rallyMode = false;
        this.buildMenu = false;
        this.wallStart = null;
        break;
    }
  }

  // ----------------------------------------------------------- HUD and panel

  private buildHud() {
    this.add.image(0, PANEL_Y, 'panel').setOrigin(0, 0).setScrollFactor(0).setDepth(9990);
    this.top = new TopBar(this, this.faction);
    this.deeds = new DeedCard(this);
    this.status = new StatusCard(this, this.state);
    this.toast = new Toast(this);
    this.edgeG = this.add.graphics().setScrollFactor(0).setDepth(9980);
    this.mini = new Minimap(this, this.terrain, this.state);
    const fix = <O extends Phaser.GameObjects.Image | Phaser.GameObjects.Text | Phaser.GameObjects.Graphics>(o: O, d = 10000) => o.setScrollFactor(0).setDepth(d) as O;
    this.selTitle = fix(this.add.text(SEL.x + 2, SEL.y + 8, '', text(13, T.ink, true)).setOrigin(0, 0.5));
    this.selInfo = fix(this.add.text(SEL.x + 2, SEL.y + 22, '', { ...text(11), lineSpacing: 2, wordWrap: { width: SEL.w - 6 } }));
    this.selBig = fix(this.add.image(0, 0, 'icon-wood').setVisible(false), 10001);
    for (let i = 0; i < 14; i++) this.selFigs.push(fix(this.add.image(0, 0, figKey('villager', this.faction), 'idle-0').setOrigin(FEET.x / FRAME, FEET.y / FRAME).setScale(0.78).setVisible(false), 10001));
    this.selG = fix(this.add.graphics(), 10002);
  }

  private renderToast() {
    const s = this.state;
    const r = s.raid;
    if (r && r.target === PLAYER && r.n !== this.lastRaid) {
      this.lastRaid = r.n;
      this.raidToastUntil = s.time + RAID_TOAST_MS;
      this.toastLog.push(t('raidToast', { faction: t(FACTIONS[s.players[r.by].faction].name), from: t(r.from) }).toUpperCase());
    }
    const v = this.cameras.main.worldView;
    const angle = (x: number, y: number) => Math.atan2(y * TILE - (v.y + v.height / 2), x * TILE - (v.x + v.width / 2));
    const a = this.alertAt;
    if (s.noticeMs > this.noticeLeft) this.noticeAt = s.time;
    this.noticeLeft = s.noticeMs;
    const raidOn = !!r && r.target === PLAYER && s.time < this.raidToastUntil;
    const alertOn = !!a && s.time < this.alertToastUntil;
    // A notice said while the raid or alert line is up takes the toast for its time, then gives it back.
    const since = raidOn ? this.raidToastUntil - RAID_TOAST_MS : alertOn ? this.alertToastUntil - ALERT_TOAST_MS : -Infinity;
    this.toastAt = null;
    if (s.noticeMs > 0 && this.noticeAt >= since) this.toast.show(s.notice.toUpperCase(), null);
    else if (raidOn) {
      this.toastAt = { x: r!.x, y: r!.y };
      this.toast.show(this.toastLog[this.toastLog.length - 1], angle(r!.x, r!.y));
    } else if (alertOn) {
      this.toastAt = { x: a!.x, y: a!.y };
      this.toast.show(this.alertText, angle(a!.x, a!.y));
    } else this.toast.hide();
  }

  /** A hit on one of the player's units or buildings by a rival: a new alert, or more of a known one. */
  private alarm(e: Extract<SimEvent, { t: 'hit' }>) {
    const s = this.state;
    const near = this.alerts.find((a) => Math.hypot(a.x - e.x, a.y - e.y) < ALERT_NEAR);
    if (near) {
      near.x = e.x;
      near.y = e.y;
      near.last = s.time;
      return;
    }
    const alert = { x: e.x, y: e.y, last: s.time };
    this.alerts.push(alert);
    // A fight on screen speaks for itself; one out of sight gets the toast, saying what is hit.
    // A short horn, once per alert, louder when the fight is out of sight.
    const v = this.cameras.main.worldView;
    const inView = e.x * TILE >= v.x && e.x * TILE <= v.right && e.y * TILE >= v.y && e.y * TILE <= v.bottom;
    sfx('alarm', { volume: inView ? 0.6 : 1 });
    if (inView) return;
    const u = s.units.get(e.target);
    const b = s.buildings.get(e.target);
    const text = u
      ? t(isCivil(UNITS[u.type].role) ? 'alertVillagers' : 'alertSoldiers')
      : b
        ? t('alertBuilding', { building: t(BUILDINGS[b.type].name) })
        : t('alertAny');
    this.alertText = text.toUpperCase();
    this.alertAt = alert;
    this.alertToastUntil = s.time + ALERT_TOAST_MS;
    this.alertLog.push(this.alertText);
  }

  /** Drops alerts whose fight is over, and marks the edge of the view towards the ones out of sight. */
  private renderAlerts() {
    const s = this.state;
    this.alerts = this.alerts.filter((a) => s.time - a.last < ALERT_MS);
    const g = this.edgeG.clear();
    this.edgeMarks = [];
    const v = this.cameras.main.worldView;
    const cx = W / 2;
    const cy = (TOP_H + PANEL_Y) / 2;
    for (const a of this.alerts) {
      const sx = a.x * TILE - v.x;
      const sy = a.y * TILE - v.y;
      if (sx >= 0 && sx <= W && sy >= TOP_H && sy <= PANEL_Y) continue;
      // Where the line from the middle of the view to the alert leaves the play area, a little inside.
      const dx = sx - cx;
      const dy = sy - cy;
      const k = Math.min(Math.abs((W / 2 - 16) / (dx || 1e-6)), Math.abs(((PANEL_Y - TOP_H) / 2 - 16) / (dy || 1e-6)));
      const mx = cx + dx * k;
      const my = cy + dy * k;
      const rot = Math.atan2(dy, dx);
      const alpha = settings.reduceMotion ? 1 : 0.65 + 0.35 * Math.sin(s.time / 160);
      const pt = (fx: number, fy: number) => ({ x: mx + fx * Math.cos(rot) - fy * Math.sin(rot), y: my + fx * Math.sin(rot) + fy * Math.cos(rot) });
      const p1 = pt(10, 0);
      const p2 = pt(-7, -8);
      const p3 = pt(-7, 8);
      g.fillStyle(hexNum(T.red), alpha).fillTriangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      g.lineStyle(1, hexNum(T.ink), alpha).strokeTriangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      this.edgeMarks.push({ x: mx, y: my, alert: a });
    }
  }

  /** The left of the panel: what is selected, with its figures or its building. */
  private renderSelection() {
    const g = this.selG.clear();
    for (const f of this.selFigs) f.setVisible(false);
    this.selBig.setVisible(false);
    if (this.rallyMode) {
      this.selTitle.setText(t('rallyTitle').toUpperCase());
      this.info(2, 24, t('rallyHow'));
      return;
    }
    if (this.placing || this.attackMode) {
      this.selTitle.setText((this.placing ? t('placeTitle', { building: t(BUILDINGS[this.placing].name) }) : t('attackMoveTitle')).toUpperCase());
      const how =
        this.placing === 'wall'
          ? t('placeWall', { n: BUILDINGS.wall.cost.wood ?? 0 })
          : this.placing === 'gate'
            ? t('placeGate')
            : this.placing === 'dock'
              ? t('placeDock')
              : this.placing
                ? t('placeAny')
                : t('attackHow');
      this.info(2, 24, how);
      return;
    }
    const units = this.selectedUnits();
    if (units.length > 1) {
      this.selTitle.setText(t('unitsTitle', { n: units.length }).toUpperCase());
      this.selInfo.setText('');
      [...units]
        .sort((a, b) => (a.type < b.type ? -1 : a.type > b.type ? 1 : a.id - b.id))
        .slice(0, 14)
        .forEach((u, i) => {
          const x = SEL.x + 16 + (i % 7) * 38;
          const y = SEL.y + 56 + Math.floor(i / 7) * 40;
          this.selFigs[i].setTexture(figKey(u.type, this.faction), 'idle-0').setPosition(x, y).setVisible(true);
          const f = u.hp / maxHp(u);
          stitchLine(g, x - 8, y + 3, x + 8, y + 3, 1.6, hexNum('#c8b890'));
          stitchLine(g, x - 8, y + 3, x - 8 + 16 * f, y + 3, 1.6, hexNum(T.green));
        });
      return;
    }
    if (units.length === 1) {
      const u = units[0];
      const def = UNITS[u.type];
      this.selTitle.setText(t(def.name).toUpperCase());
      this.selBig.setTexture(figKey(u.type, this.faction), this.frameOf(u)).setOrigin(FEET.x / FRAME, FEET.y / FRAME).setScale(1.3).setPosition(SEL.x + 34, SEL.y + 96).setVisible(true);
      const lines = [t('health', { hp: Math.ceil(u.hp), max: maxHp(u) })];
      if (u.carry && u.amount > 0) lines.push(t('carrying', { n: u.amount, res: t(u.carry) }));
      if (u.rank > 0) lines.push(t('rankLine', { rank: t(RANK_NAMES[u.rank - 1]), numeral: ['I', 'II', 'III'][u.rank - 1], n: u.kills }));
      else if (def.role !== 'villager' && def.role !== 'cart' && def.role !== 'siege') lines.push(t('killsLine', { n: u.kills, at: RANK_KILLS[0] }));
      if (def.gift === 'aura') lines.push(t('giftAura', { n: AURA_DMG }));
      if (def.gift === 'sight') lines.push(t('giftSight'));
      if (def.gift === 'heal') lines.push(t('giftHeal'));
      if (def.role === 'siege') lines.push(t('ramInfo'));
      if (inAura(this.state, u) && def.gift !== 'aura') lines.push(t('inAura'));
      lines.push(doing(u));
      this.info(76, 26, lines.join('\n'));
      return;
    }
    const b = this.selectedBuilding();
    if (b) {
      const def = BUILDINGS[b.type];
      this.selTitle.setText(t(def.name).toUpperCase());
      const key = buildingKey(this.faction, b.type);
      const src = this.textures.get(key).getSourceImage();
      const k = Math.min(70 / src.width, 70 / src.height);
      this.selBig.setTexture(key).setOrigin(0, 0).setScale(k).setPosition(SEL.x, SEL.y + 22).setVisible(true);
      const lines = [b.built ? t('health', { hp: Math.ceil(b.hp), max: buildingHp(this.state, b) }) : t('underConstruction', { pct: Math.floor((1 - b.buildLeft / def.time) * 100) })];
      const head = b.queue[0];
      if (head) {
        const name = t(head.kind === 'unit' ? UNITS[head.key].name : TECHS[head.key].name);
        const total = head.kind === 'unit' ? UNITS[head.key].time : TECHS[head.key].time;
        lines.push(t('queueHead', { name, s: Math.ceil(head.left / 1000) }));
        stitchLine(g, SEL.x + 84, SEL.y + 70, SEL.x + 200, SEL.y + 70, 3, hexNum('#c8b890'));
        stitchLine(g, SEL.x + 84, SEL.y + 70, SEL.x + 84 + 116 * (1 - head.left / total), SEL.y + 70, 3, hexNum(T.red));
        if (b.queue.length > 1) lines.push(t('queueMore', { n: b.queue.length - 1 }));
      }
      const unique = (Object.keys(UNIQUE) as FactionId[]).find((f) => UNIQUE[f] === b.type);
      if (unique && !head) lines.push(t(UNIQUE_EFFECT[unique]));
      if (b.type === 'monument' && b.built) lines.push(t('monumentInfo'));
      if (b.type === 'gate' && b.built) lines.push(t('gateInfo'));
      if (def.shelter && b.built) lines.push(b.garrison.length > 0 ? t('garrisonInside', { n: b.garrison.length }) : t('shelters', { n: def.shelter }));
      if (def.market && b.built && !head) lines.push(t('marketInfo'));
      if (takesRally(b.type) && b.built && !head) lines.push(t(b.rally ? 'rallyMove' : 'rallyHint'));
      this.info(84, 24, lines.join('\n'));
      return;
    }
    this.selTitle.setText(t('nothingSelected').toUpperCase());
    this.info(2, 24, t('nothingHint'));
  }

  /** The selection's lines, `dx` right of the panel's left edge, wrapped before the buttons. */
  private info(dx: number, dy: number, lines: string) {
    this.selInfo.setPosition(SEL.x + dx, SEL.y + dy).setWordWrapWidth(SEL.w - dx - 4).setText(lines);
  }

  /** Rebuilds the panel's buttons when the selection, the menus or what they show changes. */
  private renderPanel() {
    this.renderSelection();
    // The build list belongs to the villagers it was opened for: a new selection, or none of them
    // left in it, closes it so the panel shows what is selected now.
    const selection = [...this.selected].join(',');
    if (selection !== this.panelSelection || !this.selectedUnits().some((u) => UNITS[u.type].role === 'villager')) {
      this.panelSelection = selection;
      this.buildMenu = false;
      this.buildPage = 0;
    }
    const key = this.panelSignature();
    if (key === this.panelKey) return;
    this.panelKey = key;
    for (const o of this.buttonObjects) o.destroy();
    this.buttonObjects = [];
    this.hud = [];
    // Watching, the AI picks the boon and gives every order, so the panel shows no buttons.
    if (watching) return;
    const me = this.state.players[PLAYER];
    if (me.boonPending || me.edgePending) return this.renderPick();
    this.actions()
      .slice(0, BUTTONS.cols * BUTTONS.rows)
      .forEach((a, i) => {
        const x = BUTTONS.x + (i % BUTTONS.cols) * BUTTONS.dx;
        const y = BUTTONS.y + Math.floor(i / BUTTONS.cols) * BUTTONS.dy;
        const bg = this.add.image(x - 2, y - 2, a.enabled ? 'btn-on' : 'btn-off').setOrigin(0, 0).setScrollFactor(0).setDepth(10001);
        const label = fitWidth(this.add.text(x + 9, y + 9.5, a.name.toUpperCase(), text(10.5, a.enabled ? T.ink : T.faded, true)).setOrigin(0, 0.5).setScrollFactor(0).setDepth(10002), BUTTONS.w - 14);
        const sub = fitWidth(this.add.text(x + 9, y + 21.5, a.sub, text(9.5, a.enabled ? '#5a3a20' : '#9a8a70')).setOrigin(0, 0.5).setScrollFactor(0).setDepth(10002), BUTTONS.w - 14);
        if (a.enabled) {
          bg.setInteractive({ useHandCursor: true });
          bg.on('pointerover', () => bg.setTexture('btn-hot'));
          bg.on('pointerout', () => bg.setTexture('btn-on'));
          // An action that makes its own sound (or refuses) says so; the rest click.
          bg.on('pointerdown', () => {
            if (a.run() !== 'sounded') ui('click');
          });
        } else bg.setInteractive().on('pointerdown', () => ui('refuse'));
        this.buttonObjects.push(bg, label, sub);
        this.hud.push({ id: a.id, label: a.sub ? `${a.name} ${a.sub}` : a.name, x, y, w: BUTTONS.w, h: BUTTONS.h });
      });
  }

  /** The Age II boon, or the Age III edge: two cards in place of the buttons until one is picked. */
  private renderPick() {
    const age3 = !this.state.players[PLAYER].boonPending;
    const title = this.add.text(BOON.x + 2, BOON.y - 10, t(age3 ? 'edgeTitle' : 'boonTitle').toUpperCase(), text(11, T.red, true)).setOrigin(0, 0.5).setScrollFactor(0).setDepth(10002);
    this.buttonObjects.push(title);
    const picks = age3 ? (Object.keys(EDGES) as EdgeId[]) : (Object.keys(BOONS) as BoonId[]);
    const icons: Record<BoonId | EdgeId, string> = { shieldwall: 'icon-shield', harvest: 'icon-wheat', masonry: 'icon-stone', muster: 'icon-drum' };
    picks.forEach((id, i) => {
      const pick = age3 ? EDGES[id as EdgeId] : BOONS[id as BoonId];
      const x = BOON.x + i * BOON.dx;
      const y = BOON.y;
      const bg = this.add.image(x - 2, y - 2, 'card-boon').setOrigin(0, 0).setScrollFactor(0).setDepth(10001).setInteractive({ useHandCursor: true });
      const icon = this.add.image(x + 18, y + 20, icons[id]).setScrollFactor(0).setDepth(10002);
      const name = fitWidth(this.add.text(x + 34, y + 18, t(pick.name).toUpperCase(), text(12, T.red, true)).setOrigin(0, 0.5).setScrollFactor(0).setDepth(10002), BOON.w - 44);
      const body = id === 'shieldwall' ? t('shieldwallText', { unit: t(unitFor(this.faction, 'melee').name) }) : t(pick.text);
      const words = this.add.text(x + 12, y + 36, body, { ...text(11), wordWrap: { width: BOON.w - 24 } }).setScrollFactor(0).setDepth(10002);
      const choose = this.add.text(x + BOON.w / 2, y + BOON.h - 9, t('choose').toUpperCase(), text(9.5, T.green, true)).setOrigin(0.5).setScrollFactor(0).setDepth(10002);
      bg.on('pointerover', () => bg.setTexture('card-boon-hot').setPosition(x - 5, y - 5));
      bg.on('pointerout', () => bg.setTexture('card-boon').setPosition(x - 2, y - 2));
      bg.on('pointerdown', () => {
        const done = age3 ? chooseEdge(this.state, PLAYER, id as EdgeId) : chooseBoon(this.state, PLAYER, id as BoonId);
        if (done) {
          say(this.state, t('picked', { name: t(pick.name) }));
          sfx('pick');
        }
      });
      this.buttonObjects.push(bg, icon, name, words, choose);
      this.hud.push({ id, label: t(pick.name), x, y, w: BOON.w, h: BOON.h });
    });
  }

  private panelSignature() {
    const b = this.selectedBuilding();
    const q = b ? b.queue.map((x) => x.key).join(',') : '';
    const p = this.state.players[PLAYER];
    const own = [...this.state.buildings.values()].filter((x) => x.owner === PLAYER).length;
    const rates = `${p.rates.wood.toFixed(2)}/${p.rates.food.toFixed(2)}`;
    const champion = unitCount(this.state, PLAYER, unitFor(this.faction, 'champion').id);
    const pop = `${popUsed(this.state, PLAYER)}/${popCap(this.state, PLAYER)}`;
    return [...this.selected].join(',') + `|${b?.built}|${pop}|${this.buildMenu}|${this.buildPage}|${this.placing}|${this.attackMode}|${this.rallyMode}|${this.rallyBuildings().map((x) => (x.rally ? 1 : 0)).join('')}|${q}|${p.techs.join(',')}|${p.age}|${p.boonPending}|${p.edgePending}|${deedsDone(p)}|${this.resourceKey()}|${own}|${hasBuilt(this.state, PLAYER, 'forge')}|${p.bell}|${rates}|${champion}`;
  }

  private resourceKey() {
    const r = this.state.players[PLAYER].res;
    // Exact amounts, so a button whose cost is not a round ten lights up as soon as it is affordable.
    return `${Math.floor(r.wood)}/${Math.floor(r.food)}/${Math.floor(r.ore)}`;
  }

  /** What the panel offers for the current selection, as buttons. */
  private actions(): Action[] {
    const s = this.state;
    const p = s.players[PLAYER];
    const out: Action[] = [];
    const ageName = (age: 2 | 3) => t(age === 3 ? 'age3' : 'age2');
    if (this.placing) return [{ id: 'cancel', name: t('cancel'), sub: '', enabled: true, run: () => void (this.placing = null) }];
    if (this.rallyMode) return [{ id: 'cancel', name: t('cancel'), sub: '', enabled: true, run: () => void (this.rallyMode = false) }];
    if (this.buildMenu) {
      // Page one: the usual buildings and the faction's own; page two: palisade, gate and Monument.
      const list = this.buildPage === 0 ? [...BUILD_ORDER, UNIQUE[this.faction]] : BUILD_MORE;
      for (const type of list) {
        const def = BUILDINGS[type];
        const why = notAllowed(s, PLAYER, type);
        out.push({
          id: type,
          name: t(def.name),
          sub: why && def.age ? ageName(def.age) : costText(def.cost),
          enabled: !why && affordable(p, def.cost),
          run: () => {
            this.buildMenu = false;
            this.buildPage = 0;
            this.placing = type;
          },
        });
      }
      if (this.buildPage === 0) out.push({ id: 'more', name: t('wallsMore'), sub: '', enabled: true, run: () => void (this.buildPage = 1) });
      out.push({ id: 'back', name: t('back'), sub: '', enabled: true, run: () => void (this.buildPage === 1 ? (this.buildPage = 0) : (this.buildMenu = false)) });
      return out;
    }
    const units = this.selectedUnits();
    const villagers = units.filter((u) => UNITS[u.type].role === 'villager');
    const carts = units.filter((u) => UNITS[u.type].role === 'cart');
    const army = units.filter((u) => isSoldier(UNITS[u.type].role));
    if (villagers.length > 0) out.push({ id: 'build', name: t('build'), sub: '', enabled: true, run: () => void (this.buildMenu = true) });
    if (carts.length > 0) out.push({ id: 'trade', name: t('trade'), sub: '', enabled: true, run: () => order(issue(this.state, PLAYER, carts.map((u) => u.id), { t: 'trade' })) });
    if (army.length > 0) {
      out.push({ id: 'attack', name: t('attack'), sub: '', enabled: true, run: () => void (this.attackMode = true) });
      out.push({ id: 'stop', name: t('stop'), sub: '', enabled: true, run: () => order(issue(this.state, PLAYER, units.map((u) => u.id), { t: 'stop' })) });
    }
    const b = this.selectedBuilding();
    if (b && b.built) {
      const def = BUILDINGS[b.type];
      for (const role of def.trains ?? []) {
        const unit = unitFor(this.faction, role);
        const cost = unitCost(s, PLAYER, unit);
        const tooEarly = unit.age !== undefined && p.age < unit.age;
        const atLimit = unit.limit !== undefined && unitCount(s, PLAYER, unit.id) >= unit.limit;
        const ok = !tooEarly && !atLimit && affordable(p, cost) && popUsed(this.state, PLAYER) < popCap(this.state, PLAYER);
        out.push({
          id: unit.id,
          name: t(unit.name),
          sub: tooEarly ? ageName(unit.age!) : atLimit ? t('oneOnly') : costText(cost),
          enabled: ok,
          run: () => {
            if (train(this.state, PLAYER, b.id, unit.id)) return queued();
            say(this.state, t('notEnoughPop'));
            return refused();
          },
        });
      }
      if (b.type === 'town') {
        // The town bell: villagers near the Town Center and the towers shelter inside until released.
        out.push(
          p.bell
            ? { id: 'release', name: t('backToWork'), sub: '', enabled: true, run: () => (releaseBell(this.state, PLAYER), 'sounded') }
            : { id: 'bell', name: t('ringBell'), sub: '', enabled: true, run: () => (ringBell(this.state, PLAYER) > 0 ? 'sounded' : refused()) },
        );
      }
      if (def.market) {
        for (const res of ['wood', 'food'] as const) {
          const buy = marketPrice(s, PLAYER, res, 'buy');
          const sell = marketPrice(s, PLAYER, res, 'sell');
          const lot = { n: MARKET_LOT, res: t(res) };
          out.push({ id: `buy-${res}`, name: t('buy', lot), sub: costText({ ore: buy }), enabled: p.res.ore >= buy, run: () => coin(trade(this.state, PLAYER, res, 'buy')) });
          out.push({ id: `sell-${res}`, name: t('sell', lot), sub: costText({ ore: sell }), enabled: p.res[res] >= MARKET_LOT, run: () => coin(trade(this.state, PLAYER, res, 'sell')) });
        }
      }
      if (def.research) {
        for (const tech of Object.values(TECHS)) {
          if (tech.at !== 'academy') continue;
          out.push({
            id: tech.id,
            name: t(tech.name),
            sub: costText(tech.cost),
            enabled: affordable(p, tech.cost) && !p.techs.includes(tech.id) && !techQueued(s, PLAYER, tech.id) && (!tech.age2 || p.age >= 2),
            run: () => {
              if (research(this.state, PLAYER, b.id, tech.id)) return queued();
              say(this.state, t('cantResearch'));
              return refused();
            },
          });
        }
      }
      if (takesRally(b.type)) {
        const flags = this.rallyBuildings();
        out.push({ id: 'rally', name: t('rallyFlag'), sub: t(flags.some((x) => x.rally) ? 'rallyMoveSub' : 'rallySetSub'), enabled: true, run: () => void (this.rallyMode = true) });
      }
      if (b.type === 'town' && p.age < 3) {
        const next = p.age === 1 ? TECHS.age2 : TECHS.age3;
        const ready = p.age === 1 || deedsDone(p);
        out.push({
          id: next.id,
          name: t(next.name),
          sub: costText(next.cost),
          enabled: ready && affordable(p, next.cost) && !b.queue.some((q) => q.key === next.id),
          run: () => {
            if (research(this.state, PLAYER, b.id, next.id)) return queued();
            say(this.state, t(p.age === 2 ? 'deedsFirst' : 'cantAdvance'));
            return refused();
          },
        });
      }
    }
    return out;
  }

  private renderGhost() {
    this.wallGhost.clear();
    if (!this.placing) {
      this.ghost?.destroy();
      this.ghost = null;
      return;
    }
    const type = this.placing;
    const def = BUILDINGS[type];
    const pointer = viewPoint(this.input.activePointer);
    if (type === 'wall' && this.wallStart) {
      // The line being dragged: a stitched square per stake, green where it fits and is paid for.
      this.ghost?.setVisible(false);
      const end = this.toWorld(pointer.x, pointer.y);
      let wood = this.state.players[PLAYER].res.wood;
      for (const t of wallLine(this.wallStart.tx, this.wallStart.ty, Math.floor(end.x), Math.floor(end.y))) {
        const ok = canPlace(this.state, 'wall', t.tx, t.ty, PLAYER) && wood >= (def.cost.wood ?? 0);
        if (ok) wood -= def.cost.wood ?? 0;
        const col = ok ? 0x4e8a3a : 0xb4523b;
        this.wallGhost.fillStyle(col, 0.28).fillRect(t.tx * TILE + 2, t.ty * TILE + 2, TILE - 4, TILE - 4);
        stitchLine(this.wallGhost, t.tx * TILE + 3, t.ty * TILE + TILE - 3, t.tx * TILE + TILE - 3, t.ty * TILE + TILE - 3, 1.4, col);
      }
      return;
    }
    if (!this.ghost) this.ghost = this.add.image(0, 0, buildingKey(this.faction, type)).setOrigin(0, 0).setAlpha(0.6).setDepth(5002);
    const p = pointer;
    if (p.y >= TOP_H && p.y < PANEL_Y) {
      const w = this.toWorld(p.x, p.y);
      const ox = Math.floor(w.x) - Math.floor(def.w / 2);
      const oy = Math.floor(w.y) - Math.floor(def.h / 2);
      this.ghost.setPosition(ox * TILE, oy * TILE - BUILDING_TOP).setVisible(true);
      this.ghost.setTint(canPlace(this.state, type, ox, oy, PLAYER) ? 0x9be88a : 0xd88a6a);
    } else this.ghost.setVisible(false);
  }

  // ----------------------------------------------------------- end of the match

  private showEnd() {
    stopMusic();
    if (watching) {
      playSting(COLONY, 'end');
      return this.showWatchEnd();
    }
    const won = this.state.winner === PLAYER;
    playSting(COLONY, won ? 'win' : 'lose');
    const bg = this.add.rectangle(W / 2, H / 2, W, H, hexNum(T.linen), 0.72).setScrollFactor(0);
    const card = this.add.image(W / 2, H / 2, 'card-end').setScrollFactor(0);
    const title = this.add.text(W / 2, H / 2 + -25, t(won ? 'victory' : 'defeat').toUpperCase(), { ...text(44, won ? T.green : T.red, true) }).setOrigin(0.5).setScrollFactor(0);
    const how =
      this.state.winBy === 'monument'
        ? t(won ? 'endMonumentOwn' : 'endMonumentFoe')
        : t(won ? (this.rival2 ? 'endBothFallen' : 'endFoeFallen') : 'townFallen');
    const why = this.add.text(W / 2, H / 2 + 14, how, { ...text(15, T.ink), fontStyle: 'italic' }).setOrigin(0.5).setScrollFactor(0);
    const sub = this.add.text(W / 2, H / 2 + 42, t('endAgain'), text(14, T.faded)).setOrigin(0.5).setScrollFactor(0);
    this.endPanel = this.add.container(0, 0, [bg, card, title, why, sub]).setScrollFactor(0).setDepth(11000);
  }
  /** The end of a watched match: which faction won and how, and a click starts another. */
  private showWatchEnd() {
    const winner = this.state.players[this.state.winner ?? PLAYER].faction;
    const loser = this.state.winner === PLAYER ? this.aiFaction : this.faction;
    const bg = this.add.rectangle(W / 2, H / 2, W, H, hexNum(T.linen), 0.72).setScrollFactor(0);
    const card = this.add.image(W / 2, H / 2, 'card-end').setScrollFactor(0);
    const title = this.add.text(W / 2, H / 2 + -25, t('watchWins', { faction: t(FACTIONS[winner].name) }).toUpperCase(), { ...text(34, WOOL[winner].cloth, true) }).setOrigin(0.5).setScrollFactor(0);
    const how = this.state.winBy === 'monument' ? t('watchMonument') : this.rival2 ? t('watchBothFallen') : t('watchFallen', { faction: t(FACTIONS[loser].name) });
    const why = this.add.text(W / 2, H / 2 + 14, how, { ...text(15, T.ink), fontStyle: 'italic' }).setOrigin(0.5).setScrollFactor(0);
    const sub = this.add.text(W / 2, H / 2 + 42, t('watchAgain'), text(14, T.faded)).setOrigin(0.5).setScrollFactor(0);
    this.endPanel = this.add.container(0, 0, [bg, card, title, why, sub]).setScrollFactor(0).setDepth(11000);
  }

}

/** A panel button: `id` names what it does in no language, `sub` is the line under its name (a cost or why it is locked). */
interface Action {
  id: string;
  name: string;
  sub: string;
  enabled: boolean;
  /** 'sounded' when it played its own sound (or the refusal); otherwise the button clicks. */
  run: () => 'sounded' | void;
}

/** A panel action's sounds: a quill for something queued, the buzz for a refusal, coins for a trade, a blip for an order. */
function queued(): 'sounded' {
  sfx('queue');
  return 'sounded';
}
function refused(): 'sounded' {
  ui('refuse');
  return 'sounded';
}
function coin(done: boolean): 'sounded' {
  if (done) ui('coin');
  else ui('refuse');
  return 'sounded';
}
function order(_issued: unknown): 'sounded' {
  sfx('order');
  return 'sounded';
}

/** A cost as the line under a button reads it, such as '170 wood · 50 ore'. */
function costText(cost: Cost) {
  return Object.entries(cost)
    .map(([res, n]) => t('costPart', { n, res: t(res as TextKey) }))
    .join(' · ');
}

/** Shrinks a text that would run past `width`, so a long name in another language still fits its button. */
function fitWidth(label: Phaser.GameObjects.Text, width: number) {
  if (label.width > width) label.setScale(width / label.width, 1);
  return label;
}

/** What a unit is doing, in words, for the panel. */
function doing(u: Unit) {
  if (u.act === 'gather') return t(u.carry === 'wood' ? 'chopping' : u.carry === 'ore' ? 'mining' : 'foraging');
  if (u.act === 'build') return t('building');
  if (u.act === 'fight') return t('fighting');
  if (u.order.t === 'garrison') return t('sheltering');
  if (u.order.t === 'trade') return t('driving');
  if (u.order.t === 'return') return t(UNITS[u.type].role === 'cart' ? 'bringingOre' : 'carryingHome');
  if (u.act === 'walk') return t('walking');
  return t('standing');
}
