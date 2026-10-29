import Phaser from 'phaser';
import { ARENA, BUILD_RANGE, NODE_AMOUNT } from '../game/arena';
import { checkTrophies } from '../trophies/check';
import { DERELICT_KINDS, generateMap, localRandom, type MapLayout } from '../game/map';
import { FACTIONS, type Role, type UnitId } from '../game/factions';
import { CONTRACT_STEPS, FLAGSHIP_STEP, RANKS, contractOf, type Goal } from '../game/contracts';
import { SECTORS, keptFor, loadCampaign, saveCampaign, sectorText, winSector, type Campaign } from '../game/campaign';
import {
  BEACON_PAY, BEACON_RADIUS, BRIBE_COST, BRIBE_MS, DERELICT_DEFS, DERELICT_RADIUS, EXPANSION_GAP, FLAGSHIP_MS, PLAYER, POP_MS, SENSOR_RANGE, TRUCE_MS,
  TRUCE_TRIBUTE, VETERAN_NAMES, World, buildInfo, flagshipStats, researchCost, unitStats, type Build, type Building, type Cue, type Derelict, type Effect, type SeenBuilding, type Struck,
} from '../game/world';
import {
  buildingLines, derelictLines, expansionLines, factionLines, fallBackLines, flagshipLines, rallyLines, researchLines, unitLines,
} from '../game/describe';
import { FOG_CELL, FOG_COLS, FOG_ROWS } from '../game/fog';
import { RESEARCH_LEVELS, RESEARCH_MS, TRACK_DEFS, type Track } from '../game/research';
import { dashedCircle, drawHealth, drawProgress, progressArc, stripes } from '../art/draw';
import { INK, INK_CSS, hex } from '../art/palette';
import {
  BACKDROP_KEY, BEACON_KEY, CRYSTAL_KEYS, GLOW_BLUE_KEY, GLOW_KEY, RES, SHARD_KEY, SHIP_ZOOM, bakeAll, bakeBackdrop, buildingKey, facing, flameKey, shipKey,
} from '../art/textures';
import { settings } from '../../../../shared/settings';
import { formatNumber } from '../../../../shared/i18n';
import { playMusic, playSting, stopMusic, ui } from '../../../../shared/audio';
import { LASER_PITCH, SONG, sfx, type Sfx } from '../audio';
import { mountWatch, watching, watchSteps } from '../../../../shared/watch';
import { renderScale, viewPoint, viewSize } from '../../../../shared/scaling';
// `tr` is the game's translator (`t` in the other files): `t` names the scene's text helpers here.
import { t as tr } from '../i18n';
import { ARMY_TAB, BAR, BOARD, BUTTONS, CONTRACT_PILL, FONT, GRID_X, GROW, KEEP, LEAD, MAP_VIEW, MINIMAP, PANEL_X, RIVALS_PANEL, RIVALS_TAB, ROLE_LABEL, SECTOR_STRIP, TOP, VIEW, fitView, type Button } from './layout';

// Game time for one step at most, so a hidden tab doesn't jump the battle ahead.
const MAX_STEP_MS = 100;
/** How far a press must travel before it counts as a box selection rather than a tap. */
const DRAG_MIN = 6;
const BEAM_MS = 140;
const BOOM_MS = 450;
/** The faction picker's cards: their size and the gaps between them, in view pixels. */
const CARD_W = 180;
const CARD_H = 250;
const CARD_GAP = 8;
/** How fast the arrow keys and WASD scroll the map, in view pixels a second. */
const PAN_SPEED = 360;
/** How far above an entity the hover label sits. */
const LABEL_LIFT = 26;
/** How wide the faction's name on the top bar may be before it shrinks, in view pixels. */
const FACTION_W = 128;
/** How long the gain flash by the crystal count stays up, in ms. */
const FLASH_MS = 1600;
/** Where each ship's engines sit behind its centre, and how long its exhaust flame is, in pixels. */
const TAIL: Record<UnitId, number> = { harvester: 11, scout: 10, gunship: 12, heavy: 20 };
const FLAME: Record<UnitId, number> = { harvester: 16, scout: 24, gunship: 26, heavy: 36 };
/** Draw order on the map; the fog covers everything but floating numbers and labels. */
const DEPTH = { backdrop: 0, under: 1, node: 2, building: 3, shard: 4, flame: 5, ship: 6, over: 7, fog: 7.5, pop: 8, label: 9 };
/** The fog's colour (the night sky's deepest violet) and how much it hides where unexplored and where only explored. */
const FOG_RGB = [20, 9, 34] as const;
const FOG_UNEXPLORED = 0.93;
const FOG_EXPLORED = 0.55;
const FOG_KEY = 'fog';
const FOG_SMOOTH = 3;
/** The fog is repainted every few frames, which is plenty for ships' speeds and spares slow devices. */
const FOG_EVERY = 3;
/** How many cells the fog's edge is blurred over, each way. */
const FOG_BLUR = 2;

/** A box blur of a grid of values, across then down, with the edges held (so the map's rim stays fogged). */
function blur(v: Float32Array, tmp: Float32Array, w: number, h: number, r: number) {
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += v[y * w + Math.min(w - 1, Math.max(0, x + k))];
      tmp[y * w + x] = sum / n;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let k = -r; k <= r; k++) sum += tmp[Math.min(h - 1, Math.max(0, y + k)) * w + x];
      v[y * w + x] = sum / n;
    }
  }
}
/** An expansion is drawn as a smaller copy of its faction's hub. */
const EXPANSION_SCALE = 0.8;
/** The flagship is drawn as its faction's heavy at this scale, over a gold ring. */
const FLAGSHIP_SCALE = 1.45;
const FLAGSHIP_GOLD = 0xffd36a;
/**
 * Attack alerts: a rival's hit on the player within ALERT_NEAR battlefield pixels of a live alert
 * refreshes it, and an alert lasts ALERT_MS of game time after its last hit. ALERT_COLOR is a hot
 * orange, apart from the HUD's tangerine.
 */
const ALERT_NEAR = 160;
const ALERT_MS = 8000;
/** How long the battle music plays on after the last attack alert has ended, in ms of scene time. */
const BATTLE_TAIL_MS = 4000;
/** A wreck at least this big (its radius) makes the big explosion. */
const BIG_BOOM = 22;

/** The sound each of the world's cues plays (`hubFalls` is played apart, only when it is in sight). */
const CUE_SOUND: Record<Exclude<Cue, 'hubFalls'>, Sfx> = {
  built: 'built', warpIn: 'warpIn', researchDone: 'upgrade', rankUp: 'upgrade', contractStarted: 'stamp',
  contractDone: 'contractDone', contractFailed: 'contractFailed', won: 'won', lost: 'lost', truceOffered: 'truceOffered',
  truceMade: 'truceMade', truceBroken: 'truceBroken', tribute: 'tribute', klaxon: 'klaxon', flagshipReady: 'flagshipReady',
  flagshipLaunched: 'flagshipLaunch', flagshipLost: 'flagshipLost',
};
const ALERT_COLOR = 0xff5a2c;
/** How close to the rally flag a tap in rally mode takes it down, in battlefield pixels. */
const RALLY_GRAB = 22;
/** The minimap's canvas texture, and how often it is repainted (in frames). */
const MINI_KEY = 'space-wars-minimap';
const MINI_EVERY = 6;
/** How many hack hits take a turret over, for the ring that fills on a hacked turret. */
const TAKEOVER = FACTIONS.map((f) => f.units.gunship.ability).find((a) => a?.kind === 'hack')?.takeover ?? 1;

/** A place where a rival is hitting the player: a ring on the map, and an arrow on the map's edge while it is off screen. */
interface Alert {
  x: number;
  y: number;
  /** Scene game time of its first and its last hit. */
  first: number;
  last: number;
  struck: Struck;
}

interface Drag {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** A button on the rivals panel: answer a truce offer, or pay tribute to turn a rival. */
interface RivalButton {
  x: number;
  y: number;
  w: number;
  h: number;
  action: 'accept' | 'decline' | 'bribe';
  faction: number;
}

/** A card to tap, in view pixels: a contract on the board, or a perk to keep after a victory. */
export interface GoalCard {
  x: number;
  y: number;
  w: number;
  h: number;
  goal: Goal;
}

interface ShipSprite {
  ship: Phaser.GameObjects.Image;
  flame: Phaser.GameObjects.Image;
  lastX: number;
  lastY: number;
}

/** The battle: draws the `World` every frame and turns the player's clicks into commands. */
export class GameScene extends Phaser.Scene {
  /** The battle itself; the playthrough test reads it. */
  state!: World;
  layout!: MapLayout;
  /** The map's camera: it shows a window of the battlefield between the bars. The test reads its scroll. */
  camera!: Phaser.Cameras.Scene2D.Camera;
  /** The command bar's buttons, in view pixels. */
  readonly buttons: Button[] = BUTTONS;
  /** Units the player has selected. */
  selected = new Set<number>();
  /** The building the player is about to place, once its button is pressed. */
  placing: Build | null = null;
  /** Whether the next tap on the map plants the rally point (the Rally button or R). */
  rallyMode = false;
  /** Live attack alerts, oldest first; Space jumps to the last one. */
  alerts: Alert[] = [];
  /** The edge arrows of off-screen alerts as last drawn, in view pixels; tapping one jumps to its alert. */
  private edgeMarks: { x: number; y: number; alert: Alert }[] = [];
  /** Whether a press on the minimap is being dragged: the map follows it. */
  private miniDrag = false;
  private miniTex!: Phaser.Textures.CanvasTexture;
  private miniData!: ImageData;
  private miniGfx!: Phaser.GameObjects.Graphics;
  private miniImage!: Phaser.GameObjects.Image;
  /** Whether the faction picker is up: nothing moves until the player picks a faction. */
  picking = true;
  /** Whether the rivals panel (truces and tribute) is open over the map. */
  rivalsOpen = false;
  /** The rivals panel's buttons, in view pixels, as last drawn. */
  rivalButtons: RivalButton[] = [];
  /** The picker's cards, one per faction, in view pixels; the playthrough taps one to begin. */
  pickCards: { x: number; y: number; w: number; h: number; faction: number }[] = [];
  /** The contract board's cards while it is up, in view pixels; the playthrough taps one. */
  boardCards: GoalCard[] = [];
  /** After a campaign victory, the perks the player can keep, in view pixels. */
  keepCards: GoalCard[] = [];
  /** The sector campaign's progress, from the browser's storage. */
  campaign: Campaign = loadCampaign();
  /** The campaign sector the next battle is fought in (an index into SECTORS). */
  sector = 0;
  /** The picker's sector nodes, in view pixels. */
  sectorNodes: { x: number; y: number; r: number; sector: number }[] = [];
  /** The last pointer position, in view pixels. */
  private pointer = { x: 0, y: 0 };
  private drag: Drag | null = null;
  /** Two fingers on the map scroll it: their midpoint when last seen, in view pixels. */
  private touchPan: { x: number; y: number } | null = null;
  private message = '';
  private lastFrame: number | null = null;
  /** Game time the scene has drawn, for the flicker of flames and the bob of floating pylons. */
  private clock = 0;
  /** Beams and booms already heard, so each plays at most once. */
  private heard = new WeakSet<Effect>();
  /** The song's part playing now ('' when none), the scene time the battle music lasts to, and the phase last heard. */
  private musicPart = '';
  private battleUntil = 0;
  private endPhase: World['phase'] = 'playing';
  private flash = { amount: 0, ms: 0 };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private fixed!: Phaser.Cameras.Scene2D.Camera;
  private backdrop!: Phaser.GameObjects.Image;
  private underGfx!: Phaser.GameObjects.Graphics;
  private gfx!: Phaser.GameObjects.Graphics;
  private chromeGfx!: Phaser.GameObjects.Graphics;
  private uiGfx!: Phaser.GameObjects.Graphics;
  private pickGfx!: Phaser.GameObjects.Graphics;
  private ships = new Map<number, ShipSprite>();
  private houses = new Map<number, Phaser.GameObjects.Image>();
  private crystals = new Map<number, { gem: Phaser.GameObjects.Image; glow: Phaser.GameObjects.Image }>();
  private shardSprites = new Map<number, { glow: Phaser.GameObjects.Image; gem: Phaser.GameObjects.Image }>();
  private popTexts: Phaser.GameObjects.Text[] = [];
  private beaconGlow!: Phaser.GameObjects.Image;
  private beaconImg!: Phaser.GameObjects.Image;
  private beaconLabel!: Phaser.GameObjects.Text;
  private derelictLabels: Phaser.GameObjects.Text[] = [];
  /** Each rival's own contract, under its status in the rivals panel. */
  private rivalDeals: Phaser.GameObjects.Text[] = [];
  private rivalTexts: { name: Phaser.GameObjects.Text; status: Phaser.GameObjects.Text; b1: Phaser.GameObjects.Text; b2: Phaser.GameObjects.Text }[] = [];
  private rivalsHead!: Phaser.GameObjects.Text;
  private rivalsHint!: Phaser.GameObjects.Text;
  private ghost!: Phaser.GameObjects.Image;
  private fogTex!: Phaser.Textures.CanvasTexture;
  private fogData!: ImageData;
  private fogCells!: HTMLCanvasElement;
  private fogFrame = 0;
  private fogAlpha = new Float32Array(FOG_COLS * FOG_ROWS);
  private fogTmp = new Float32Array(FOG_COLS * FOG_ROWS);
  private hud!: Record<'faction' | 'crystal' | 'gain' | 'harvesters' | 'army' | 'clock' | 'tag' | 'title' | 'count' | 'rivals' | 'rivalCount', Phaser.GameObjects.Text>;
  private panel!: Record<'line' | 'head' | 'next' | 'brief' | 'count' | 'reward' | 'perk' | 'build', Phaser.GameObjects.Text>;
  private overlay!: Phaser.GameObjects.Text;
  private hoverLabel!: Phaser.GameObjects.Text;
  private tip!: Phaser.GameObjects.Text;
  private pickTitle!: Phaser.GameObjects.Text;
  private pickTexts!: { name: Phaser.GameObjects.Text; body: Phaser.GameObjects.Text }[];
  private pickImages: Phaser.GameObjects.Image[] = [];
  private boardHead!: Phaser.GameObjects.Text;
  private boardTexts: { title: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text }[] = [];
  private keepTexts: { title: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text }[] = [];
  private pactBanner!: Phaser.GameObjects.Text;
  private convoyLabel!: Phaser.GameObjects.Text;
  private sectorTexts!: { title: Phaser.GameObjects.Text; body: Phaser.GameObjects.Text; kept: Phaser.GameObjects.Text; names: Phaser.GameObjects.Text[] };
  private captions!: { name: Phaser.GameObjects.Text; cost: Phaser.GameObjects.Text; icon: Phaser.GameObjects.Image }[];

  constructor() {
    super('Game');
  }

  create() {
    // The view takes the screen's shape (setupScaling's fill mode): lay the HUD out for it, and
    // centre the picker's cards in the map's window.
    const view = viewSize(this);
    fitView(view.width, view.height, this.cornerSize(view.width, view.height));
    this.pickCards = FACTIONS.map((_, faction) => ({
      x: (VIEW.w - FACTIONS.length * CARD_W - (FACTIONS.length - 1) * CARD_GAP) / 2 + faction * (CARD_W + CARD_GAP),
      y: MAP_VIEW.y + 62 + GROW.dy / 2,
      w: CARD_W,
      h: CARD_H,
      faction,
    }));
    this.sectorNodes = SECTORS.map((_, sector) => ({ x: SECTOR_STRIP.nodeX + sector * SECTOR_STRIP.nodeStep, y: SECTOR_STRIP.nodeY, r: SECTOR_STRIP.r, sector }));
    bakeAll(this);
    // The map scrolls in its own camera; the bars and the text sit on a second one that never moves.
    this.camera = this.cameras.main;
    // Viewports are in canvas pixels, renderScale to a view pixel. Both cameras keep the top-left
    // origin setupScaling gives them, so the map camera's scroll is the battlefield point at its corner.
    const k = renderScale;
    this.camera.setViewport(MAP_VIEW.x * k, MAP_VIEW.y * k, MAP_VIEW.w * k, MAP_VIEW.h * k);
    this.camera.setBackgroundColor('#1c0f36');
    this.fixed = this.cameras.add(0, 0, VIEW.w * k, VIEW.h * k);

    this.backdrop = this.onMap(this.add.image(0, 0, '__WHITE').setOrigin(0).setDepth(DEPTH.backdrop));
    this.underGfx = this.onMap(this.add.graphics().setDepth(DEPTH.under));
    this.gfx = this.onMap(this.add.graphics().setDepth(DEPTH.over));
    this.beaconGlow = this.onMap(this.add.image(0, 0, GLOW_KEY).setDepth(DEPTH.under).setAlpha(0.5).setBlendMode(Phaser.BlendModes.ADD));
    this.beaconImg = this.onMap(this.add.image(0, 0, BEACON_KEY).setScale(1 / RES).setDepth(DEPTH.building));
    this.beaconLabel = this.onMap(this.text(0, 0, 10, INK_CSS.chocolate, true).setBackgroundColor(INK_CSS.cream).setPadding(6, 3, 6, 3).setDepth(DEPTH.label));
    this.ghost = this.onMap(this.add.image(0, 0, SHARD_KEY).setScale(1 / RES).setAlpha(0.6).setDepth(DEPTH.over).setVisible(false));
    // The fog is worked out one pixel a cell, then smoothed up to FOG_SMOOTH pixels a cell so its edges blur.
    this.fogCells = document.createElement('canvas');
    this.fogCells.width = FOG_COLS;
    this.fogCells.height = FOG_ROWS;
    this.fogData = this.fogCells.getContext('2d')!.createImageData(FOG_COLS, FOG_ROWS);
    this.fogTex = this.textures.exists(FOG_KEY)
      ? this.textures.get(FOG_KEY) as Phaser.Textures.CanvasTexture
      : this.textures.createCanvas(FOG_KEY, FOG_COLS * FOG_SMOOTH, FOG_ROWS * FOG_SMOOTH)!;
    this.onMap(this.add.image(0, 0, FOG_KEY).setOrigin(0).setScale(FOG_CELL / FOG_SMOOTH).setDepth(DEPTH.fog));
    this.hoverLabel = this.onMap(this.text(0, 0, 11, INK_CSS.chocolate).setOrigin(0.5, 1).setPadding(6, 4, 6, 4)
      .setBackgroundColor(INK_CSS.cream).setDepth(DEPTH.label).setVisible(false));

    this.chromeGfx = this.onUi(this.add.graphics().setDepth(10));
    this.uiGfx = this.onUi(this.add.graphics().setDepth(11));
    this.pickGfx = this.onUi(this.add.graphics().setDepth(20));
    const t = (x: number, y: number, size: number, color: string, bold = false, depth = 12) =>
      this.onUi(this.text(x, y, size, color, bold).setDepth(depth));
    // The top bar: the counts stay on the left, the contract pill in the middle and the rivals on the right.
    const pill = CONTRACT_PILL.x - 482;
    const right = GROW.dx;
    this.hud = {
      faction: t(32, 8, 14, INK_CSS.cream, true),
      crystal: t(182, 5, 18, INK_CSS.cream, true),
      gain: t(0, 8, 11, '#ffffff', true).setBackgroundColor('#3d9a4a').setPadding(5, 1, 5, 1),
      harvesters: t(286, 9, 12, INK_CSS.cream),
      army: t(378, 9, 12, INK_CSS.cream),
      clock: t(436, 6, 16, INK_CSS.mustard, true),
      tag: t(pill + 490, 10, 10, INK_CSS.cream, true),
      title: t(pill + 578, 9, 11, INK_CSS.chocolate, true),
      count: t(pill + 782, 9, 11, INK_CSS.chocolate, true).setOrigin(1, 0),
      rivals: t(right + 806, 10, 10, INK_CSS.mustard, true).setText(tr('rivalsTab')),
      rivalCount: t(right + 950, 5, 17, INK_CSS.cream, true).setOrigin(1, 0),
    };
    const px = PANEL_X;
    this.panel = {
      line: t(px, BAR.y + 5, 10, INK_CSS.cream).setWordWrapWidth(VIEW.w - px - 106).setMaxLines(2),
      head: t(px + 8, BAR.y + 36, 10, INK_CSS.cream, true),
      next: t(VIEW.w - 16, BAR.y + 36, 10, INK_CSS.cream).setOrigin(1, 0),
      brief: t(px + 8, BAR.y + 52, 12, INK_CSS.chocolate, true),
      count: t(px + 170, BAR.y + 66, 11, INK_CSS.green, true),
      reward: t(px + 222, BAR.y + 66, 11, INK_CSS.rust, true),
      perk: t(px + 8, BAR.y + 81, 10, INK_CSS.cocoa),
      build: t(LEAD.x + GRID_X + 4, BAR.y + 8, 10, INK_CSS.mustard, true).setText(tr('build')),
    };
    this.overlay = t(MAP_VIEW.x + MAP_VIEW.w / 2, MAP_VIEW.y + MAP_VIEW.h / 2, 44, INK_CSS.mustard, true, 30)
      .setOrigin(0.5).setAlign('center').setStroke(INK_CSS.chocolate, 8);
    // Tooltips: the hover label names a unit or building on the map; the tip describes a command button.
    this.tip = t(0, 0, 11, INK_CSS.chocolate, false, 25).setOrigin(0, 1).setPadding(7, 5, 7, 5).setBackgroundColor(INK_CSS.cream)
      .setWordWrapWidth(300).setVisible(false);
    this.pickTitle = t(VIEW.w / 2, MAP_VIEW.y + 18 + GROW.dy / 2, 22, INK_CSS.mustard, true, 21).setOrigin(0.5, 0).setText(tr('chooseFaction'))
      .setStroke(INK_CSS.chocolate, 5);
    // The rivals panel: a header, a row per rival with its stance and up to two buttons, and a hint while an offer is open.
    const rp = RIVALS_PANEL;
    this.rivalsHead = t(rp.x + 10, rp.y + 5, 11, INK_CSS.cream, true, 22).setText(tr('rivalsHead'));
    this.rivalTexts = FACTIONS.slice(1).map((_, k) => {
      const y = rp.y + rp.head + k * rp.row;
      return {
        name: t(rp.x + 24, y + 6, 12, INK_CSS.chocolate, true, 22),
        status: t(rp.x + 24, y + 23, 10, INK_CSS.cocoa, false, 22).setWordWrapWidth(rp.w - 140).setMaxLines(2),
        b1: t(0, 0, 10, INK_CSS.chocolate, true, 22).setOrigin(0.5),
        b2: t(0, 0, 10, INK_CSS.chocolate, true, 22).setOrigin(0.5),
      };
    });
    this.rivalsHint = t(VIEW.w - 8, TOP.h + 8, 11, INK_CSS.chocolate, true, 22).setOrigin(1, 0).setPadding(8, 4, 8, 4)
      .setBackgroundColor(INK_CSS.mustard).setVisible(false);
    this.pickTexts = this.pickCards.map((c) => {
      const def = FACTIONS[c.faction];
      const name = t(c.x + 12, c.y + 8, 13, INK_CSS.cream, true, 21).setText(tr(def.name).toUpperCase());
      const body = t(c.x + 12, c.y + 150, 10, INK_CSS.chocolate, false, 21).setWordWrapWidth(c.w - 22)
        .setText(factionLines(def).join('\n')).setLineSpacing(1);
      return { name, body };
    });
    this.pickCards.forEach((c) => {
      const f = c.faction;
      this.pickImages.push(this.onUi(this.add.image(c.x + c.w / 2, c.y + 80, buildingKey(f, 'hub')).setScale(1.25 / RES).setDepth(21)));
      (['scout', 'gunship', 'heavy'] as const).forEach((type, k) => {
        this.pickImages.push(this.onUi(this.add.image(c.x + 36 + k * 54, c.y + 126, shipKey(f, type), facing(-Math.PI / 4).frame)
          .setScale(0.9 / RES).setDepth(21)));
      });
    });
    // Research buttons are slimmer and have no icon: their level pips sit on the right instead. The Fall back button is a plain pill.
    const caption = (b: Button) => b.kind === 'research' || b.kind === 'command'
      ? {
        icon: this.onUi(this.add.image(0, 0, '__WHITE').setVisible(false)),
        name: t(b.x + 10, b.y + 2, 11, INK_CSS.chocolate, true),
        cost: t(b.x + 10, b.y + 14, 9, INK_CSS.rust),
      }
      : {
        icon: this.onUi(this.add.image(b.x + 12, b.y + b.h / 2, '__WHITE').setDepth(12)),
        name: t(b.x + 31, b.y + 3, 12, INK_CSS.chocolate, true),
        cost: t(b.x + 31, b.y + 16, 10, INK_CSS.rust),
      };
    // Captions are kept by their button's index in BUTTONS. The Flagship and Rally buttons get theirs
    // with the board's texts below.
    const late = (b: Button) => b.key === 'flagship' || b.key === 'rally';
    this.captions = [];
    BUTTONS.forEach((b, i) => { if (!late(b)) this.captions[i] = caption(b); });
    this.drawChrome();

    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', this.onDown, this);
    this.input.on('pointermove', this.onMove, this);
    this.input.on('pointerup', this.onUp, this);
    // A second touch pointer, so two fingers can scroll the map.
    this.input.addPointer(1);
    // Arrow keys scroll the map; keep the browser from scrolling the page with them too.
    this.keys = this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,H,B,T') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.addCapture('UP,DOWN,LEFT,RIGHT,SPACE');
    // R arms the rally point; Space jumps to the latest attack. On the key's down event, so a quick tap always counts.
    const playing = () => !this.picking && !watching && this.state.phase === 'playing';
    this.input.keyboard!.on('keydown-R', () => playing() && this.press(BUTTONS.find((b) => b.key === 'rally')!));
    this.input.keyboard!.on('keydown-SPACE', () => playing() && this.jumpToAlert());
    // Q selects every warship.
    this.input.keyboard!.on('keydown-Q', () => playing() && this.selectFleet());
    this.newGame(true);
    // Every Phaser text draws from Math.random for its texture's key, and the map and the AI draw from
    // it too: these are made on a generator of their own, so a seeded battle plays as it did before them.
    const random = Math.random;
    Math.random = localRandom(0.5);
    BUTTONS.forEach((b, i) => { if (late(b)) this.captions[i] = caption(b); });
    // The minimap: a canvas of one pixel a fog cell for the explored space, and the dots drawn over it.
    this.miniTex = this.textures.exists(MINI_KEY)
      ? this.textures.get(MINI_KEY) as Phaser.Textures.CanvasTexture
      : this.textures.createCanvas(MINI_KEY, FOG_COLS, FOG_ROWS)!;
    this.miniData = this.miniTex.context.createImageData(FOG_COLS, FOG_ROWS);
    this.miniImage = this.onUi(this.add.image(MINIMAP.x, MINIMAP.y, MINI_KEY).setOrigin(0).setDisplaySize(MINIMAP.w, MINIMAP.h).setDepth(13));
    this.miniGfx = this.onUi(this.add.graphics().setDepth(14));
    // The contract board: a header over two cards at the map's top while the next contract is picked.
    this.boardHead = t(VIEW.w / 2, BOARD.y, 11, INK_CSS.mustard, true, 22).setOrigin(0.5, 0).setStroke(INK_CSS.chocolate, 4);
    this.boardTexts = [0, 1].map(() => ({
      title: t(0, 0, 12, INK_CSS.chocolate, true, 22),
      sub: t(0, 0, 10, INK_CSS.cocoa, false, 22).setWordWrapWidth(BOARD.w - 20).setMaxLines(2),
    }));
    // A campaign victory: a card for each perk earned this battle, one of them to keep.
    this.keepTexts = [0, 1, 2, 3, 4].map(() => ({
      title: t(0, 0, 11, INK_CSS.chocolate, true, 31).setWordWrapWidth(KEEP.w - 16),
      sub: t(0, 0, 10, INK_CSS.cocoa, false, 31).setWordWrapWidth(KEEP.w - 16).setMaxLines(3),
    }));
    this.pactBanner = t(8, TOP.h + 8, 11, INK_CSS.cream, true, 22).setPadding(8, 4, 8, 4).setBackgroundColor(INK_CSS.rust).setVisible(false);
    // One label for each derelict station (a map has one of each kind), placed and filled in drawDerelicts.
    this.derelictLabels = DERELICT_KINDS.map(() => this.onMap(this.text(0, 0, 10, INK_CSS.chocolate, true)
      .setBackgroundColor(INK_CSS.cream).setPadding(6, 3, 6, 3).setDepth(DEPTH.label).setVisible(false)));
    this.convoyLabel = this.onMap(this.text(0, 0, 10, INK_CSS.chocolate, true).setBackgroundColor(INK_CSS.mustard).setPadding(6, 3, 6, 3)
      .setDepth(DEPTH.label).setVisible(false).setText(tr('convoyField')));
    const st = SECTOR_STRIP;
    this.sectorTexts = {
      title: t(st.x + 14, st.y + 8, 13, INK_CSS.mustard, true, 21),
      body: t(st.x + 14, st.y + 28, 10, INK_CSS.cream, false, 21).setWordWrapWidth(st.nodeX - st.x - 44).setMaxLines(4),
      kept: t(st.nodeX - st.r, st.y + 64, 10, INK_CSS.mustard, false, 21).setWordWrapWidth(st.x + st.w - st.nodeX).setMaxLines(1),
      names: this.sectorNodes.map((n) => t(n.x, n.y + n.r + 3, 9, INK_CSS.cream, true, 21).setOrigin(0.5, 0)),
    };
    this.rivalDeals = FACTIONS.slice(1).map((_, k) => t(RIVALS_PANEL.x + 24, RIVALS_PANEL.y + RIVALS_PANEL.head + k * RIVALS_PANEL.row + 49, 10, INK_CSS.rust, true, 22)
      .setVisible(false));
    Math.random = random;
  }

  /**
   * The shared corner buttons' footprint in view pixels, measured from the view's bottom-left, with
   * the view shown as big as fits the page: what the command bar keeps clear of in a filled view.
   * The row (`shared/corner.ts`: two 30px buttons 6px apart, 12px from the edges) may not be on
   * the page yet when the scene starts, so its size is taken from there unless it is.
   */
  private cornerSize(w: number, h: number) {
    const parent = this.scale.parent as HTMLElement | undefined;
    const pw = parent?.clientWidth || window.innerWidth;
    const ph = parent?.clientHeight || window.innerHeight;
    const k = Math.min(pw / w, ph / h);
    const left = (pw - w * k) / 2;
    const bottom = (ph + h * k) / 2;
    const row = document.querySelector('.game-corner')?.getBoundingClientRect();
    const right = Math.max(12 + 2 * 30 + 6, row?.width ? row.right : 0);
    const top = Math.min(ph - 12 - 30, row?.width ? row.top : ph);
    return { w: (right - left) / k, h: (bottom - top) / k + 4 };
  }

  private text(x: number, y: number, size: number, color: string, bold = false) {
    return this.add.text(x, y, '', { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'italic bold' : '' });
  }

  /** Puts an object on the scrolling map only. */
  private onMap<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.fixed.ignore(o);
    return o;
  }

  /** Puts an object on the fixed bars only. */
  private onUi<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.camera.ignore(o);
    return o;
  }

  /**
   * Makes a new random map and shows the faction picker over it. With `furthest` (the first game and
   * after a victory) the campaign's furthest open sector is picked, otherwise (after a defeat) the
   * same sector again; the map has that sector's crystal. Watching always plays the first sector.
   */
  private newGame(furthest: boolean) {
    this.sector = watching ? 0 : furthest ? this.campaign.unlocked - 1 : Math.min(this.sector, this.campaign.unlocked - 1);
    this.makeMap();
    // Watch mode (`?watch`) skips the picker: a random faction takes the first slot and the AI plays all five.
    if (watching) this.startBattle(Math.floor(Math.random() * FACTIONS.length));
  }

  /** A fresh map for the current sector, under the picker. */
  private makeMap() {
    this.layout = generateMap(FACTIONS.length, SECTORS[this.sector].loose);
    this.picking = true;
    this.state = new World(this.layout);
    const res = bakeBackdrop(this, this.layout);
    this.backdrop.setTexture(BACKDROP_KEY).setScale(1 / res);
    this.reset();
  }

  /** Starts the battle with the chosen faction under the player's command, in the chosen sector with the campaign's kept perks. */
  private startBattle(faction: number) {
    this.state = watching
      ? new World(this.layout, faction, true)
      : new World(this.layout, faction, false, this.sector, keptFor(this.campaign, this.sector));
    this.picking = false;
    if (watching) {
      const sides = Object.fromEntries(this.state.sides.map((s) => [String(s.index), { name: tr(s.def.name), color: `#${s.def.color.toString(16).padStart(6, '0')}` }]));
      mountWatch({ sides, time: () => this.state.elapsedMs });
    }
    this.reset();
  }

  private reset() {
    this.fogFrame = 0;
    this.rivalsOpen = false;
    this.selected.clear();
    this.placing = null;
    this.rallyMode = false;
    this.alerts = [];
    this.edgeMarks = [];
    this.endPhase = 'playing';
    this.battleUntil = 0;
    this.miniDrag = false;
    this.drag = null;
    this.touchPan = null;
    this.message = '';
    this.lastFrame = null;
    this.flash = { amount: 0, ms: 0 };
    this.boardCards = [];
    this.keepCards = [];
    for (const s of this.ships.values()) {
      s.ship.destroy();
      s.flame.destroy();
    }
    this.ships.clear();
    for (const o of this.houses.values()) o.destroy();
    this.houses.clear();
    for (const c of this.crystals.values()) {
      c.gem.destroy();
      c.glow.destroy();
    }
    this.crystals.clear();
    for (const s of this.shardSprites.values()) {
      s.glow.destroy();
      s.gem.destroy();
    }
    this.shardSprites.clear();
    for (const n of this.state.nodes) {
      this.crystals.set(n.id, {
        glow: this.onMap(this.add.image(n.x, n.y - 4, GLOW_BLUE_KEY).setDepth(DEPTH.under).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55)),
        gem: this.onMap(this.add.image(n.x, n.y, CRYSTAL_KEYS[n.id % CRYSTAL_KEYS.length]).setDepth(DEPTH.node)),
      });
    }
    const bc = this.state.beacon;
    this.beaconImg.setPosition(bc.x, bc.y - 4);
    this.beaconGlow.setPosition(bc.x, bc.y - 10);
    const art = this.art(PLAYER);
    this.captions.forEach((c, i) => {
      const b = BUTTONS[i];
      if (b.kind === 'research' || b.kind === 'command') return;
      if (b.kind === 'build') c.icon.setTexture(buildingKey(art, b.key === 'expansion' ? 'hub' : b.key as Role));
      else c.icon.setTexture(shipKey(art, b.key as UnitId), facing(-Math.PI / 2).frame);
      c.icon.setScale(Math.min(24 / c.icon.width, 24 / c.icon.height) * (b.kind === 'build' ? 1.5 : 1.25));
    });
    this.centreOnHub();
  }

  /** The art (an index into FACTIONS) a side of the battle is drawn with. */
  private art(side: number) {
    return FACTIONS.indexOf(this.state.sides[side].def);
  }

  update(time: number) {
    // Game time from the frame's own timestamp, the same as the other games.
    const dt = this.lastFrame === null ? 0 : Phaser.Math.Clamp(time - this.lastFrame, 0, MAX_STEP_MS);
    this.lastFrame = time;
    if (!this.picking) {
      // Watching, the battle runs once per step of the chosen speed, none while held.
      for (let i = watchSteps(); i > 0; i--) this.state.update(dt);
      checkTrophies(this.state);
      this.selected = new Set([...this.selected].filter((id) => this.state.selectable(id)));
      this.clock += dt;
    }
    for (const e of this.state.events.splice(0)) {
      if (e.kind === 'notice') this.message = e.text;
      else if (e.kind === 'hit') this.alarm(e.x, e.y, e.struck);
      else if (e.kind === 'cue') this.cue(e.cue, e.x, e.y);
      else {
        this.flash = { amount: (this.flash.ms > 0 ? this.flash.amount : 0) + e.amount, ms: FLASH_MS };
        if (!watching) sfx('crystal');
      }
    }
    this.listen();
    this.music();
    this.flash.ms = Math.max(0, this.flash.ms - dt);
    this.pan(dt);
    this.draw();
  }

  /**
   * A rival's hit on the player: it refreshes the live alert near it, or raises a new one and says
   * what is under attack on the message line.
   */
  private alarm(x: number, y: number, struck: Struck) {
    const near = this.alerts.find((a) => Math.hypot(a.x - x, a.y - y) <= ALERT_NEAR);
    if (near) {
      // The alert follows the fight as it moves.
      near.x = x;
      near.y = y;
      near.last = this.clock;
      return;
    }
    this.alerts.push({ x, y, first: this.clock, last: this.clock, struck });
    sfx('alert');
    const key = struck === 'harvester' ? 'alertHarvesters' : struck === 'ship' ? 'alertShips' : 'alertBuilding';
    this.message = tr(key);
  }

  /** Selects every warship the player has (the army count on the top bar, or Q). */
  private selectFleet() {
    this.selected = new Set(this.state.fleet());
    this.message = this.selected.size ? tr('fleetSelected', { n: this.selected.size }) : tr('noFleet');
    if (this.selected.size) sfx('select');
    else ui('refuse');
  }

  /** Centres the map on the latest attack alert (Space, or a tap on its edge arrow). */
  private jumpToAlert(a = this.alerts[this.alerts.length - 1]) {
    if (!a) return ui('refuse');
    this.centreOn(a.x, a.y);
    sfx('whoosh');
  }

  /** Whether a battlefield point is on screen (with a margin) and in the player's sight. */
  private inSight(x: number, y: number, margin = 24) {
    const c = this.camera;
    const on = x >= c.scrollX - margin && x <= c.scrollX + MAP_VIEW.w + margin && y >= c.scrollY - margin && y <= c.scrollY + MAP_VIEW.h + margin;
    return on && (this.state.watch || this.state.fog.sees({ x, y }));
  }

  /** A sound for one of the world's cues: the player's own, or a hub falling in sight. A watched battle plays only the hubs. */
  private cue(cue: Cue, x = 0, y = 0) {
    if (cue === 'hubFalls') {
      if (this.inSight(x, y, 60)) sfx('hubFalls', { volume: watching ? 0.6 : 1 });
    } else if (!watching) sfx(CUE_SOUND[cue]);
  }

  /**
   * One laser and one explosion a frame at most, from the shots and wrecks new since the last frame
   * that are in sight: a volley sounds once, and fights off screen or in the fog stay quiet.
   */
  private listen() {
    const s = this.state;
    let shot: Effect | null = null;
    for (const b of s.beams) {
      if (this.heard.has(b)) continue;
      this.heard.add(b);
      if (!shot && (this.inSight(b.x, b.y) || this.inSight(b.x2 ?? b.x, b.y2 ?? b.y))) shot = b;
    }
    let boom: Effect | null = null;
    for (const b of s.booms) {
      if (this.heard.has(b)) continue;
      this.heard.add(b);
      // A rank-up's gold ring is no explosion: it has its own sound.
      if (b.kind === 'rank') continue;
      if (this.inSight(b.x, b.y) && (!boom || (b.r ?? 0) > (boom.r ?? 0))) boom = b;
    }
    const quiet = watching ? 0.45 : 1;
    if (shot) {
      const f = FACTIONS.findIndex((d) => d.color === shot.color);
      sfx('laser', { pitch: LASER_PITCH[f] ?? 1, volume: quiet });
    }
    if (boom) sfx((boom.r ?? 0) >= BIG_BOOM ? 'boomBig' : 'boom', { volume: quiet });
    if (!this.picking && s.phase !== this.endPhase) {
      this.endPhase = s.phase;
      if (s.phase !== 'playing') {
        stopMusic();
        this.musicPart = '';
        playSting(SONG, s.watch ? 'end' : s.phase === 'won' ? 'win' : 'lose');
      }
    }
  }

  /**
   * The music for what is on: the picker's theme, the calm loop, the battle while an attack alert is
   * live (and a little after), and the last stand once the pact is signed. Watching, the battle
   * part comes in once two factions are left.
   */
  private music() {
    const s = this.state;
    let part = '';
    if (this.picking) part = 'menu';
    else if (s.phase === 'playing') {
      if (this.alerts.length) this.battleUntil = this.clock + BATTLE_TAIL_MS;
      if (s.watch) part = s.sides.filter((side) => side.alive).length <= 2 ? 'battle' : 'calm';
      else part = s.pact ? 'boss' : this.clock < this.battleUntil ? 'battle' : 'calm';
    }
    if (part && part !== this.musicPart) {
      this.musicPart = part;
      playMusic(SONG, part);
    }
  }

  /** The battlefield point under a view pixel, from the map camera's scroll and viewport. */
  toWorld(x: number, y: number) {
    return { x: x - MAP_VIEW.x + this.camera.scrollX, y: y - MAP_VIEW.y + this.camera.scrollY };
  }

  /** Where a battlefield point is in view pixels, from the map camera's scroll and viewport. */
  toScreen(x: number, y: number) {
    return { x: x - this.camera.scrollX + MAP_VIEW.x, y: y - this.camera.scrollY + MAP_VIEW.y };
  }

  /** Whether a view pixel is over the map, rather than the top or command bar. */
  private inMap(x: number, y: number) {
    return x >= MAP_VIEW.x && x < MAP_VIEW.x + MAP_VIEW.w && y >= MAP_VIEW.y && y < MAP_VIEW.y + MAP_VIEW.h;
  }

  /** Scrolls the map so its top-left corner is at (left, top), keeping the view inside the battlefield. */
  private scrollTo(left: number, top: number) {
    this.camera.setScroll(
      Phaser.Math.Clamp(left, ARENA.x, ARENA.x + ARENA.w - MAP_VIEW.w),
      Phaser.Math.Clamp(top, ARENA.y, ARENA.y + ARENA.h - MAP_VIEW.h),
    );
  }

  /** Centres the map on (x, y). */
  private centreOn(x: number, y: number) {
    this.scrollTo(x - MAP_VIEW.w / 2, y - MAP_VIEW.h / 2);
  }

  /** Centres the map on the player's hub, where the battle starts and H brings the view back. */
  private centreOnHub() {
    const hub = this.state.hubOf(PLAYER);
    if (hub) this.centreOn(hub.x, hub.y);
  }

  /** Arrow keys and WASD scroll the map; H centres it on the hub. */
  private pan(dt: number) {
    const k = this.keys;
    const dx = (k.RIGHT.isDown || k.D.isDown ? 1 : 0) - (k.LEFT.isDown || k.A.isDown ? 1 : 0);
    const dy = (k.DOWN.isDown || k.S.isDown ? 1 : 0) - (k.UP.isDown || k.W.isDown ? 1 : 0);
    if (dx || dy) {
      const step = (PAN_SPEED * dt) / 1000;
      this.scrollTo(this.camera.scrollX + dx * step, this.camera.scrollY + dy * step);
    }
    if (Phaser.Input.Keyboard.JustDown(k.H)) this.centreOnHub();
    if (!this.picking && !watching && this.state.phase === 'playing') {
      // B falls the selection back (F is the shared full screen key); T opens and closes the rivals panel.
      if (Phaser.Input.Keyboard.JustDown(k.B)) this.press(BUTTONS.find((b) => b.key === 'fallback')!);
      if (Phaser.Input.Keyboard.JustDown(k.T)) {
        this.rivalsOpen = !this.rivalsOpen;
        ui('click');
      }
    }
  }

  /** The top and command bars: chocolate panels edged with the cover's stripes, drawn once. */
  private drawChrome() {
    const g = this.chromeGfx;
    g.fillStyle(INK.chocolate, 1);
    g.fillRect(0, 0, VIEW.w, TOP.h);
    g.fillRect(0, BAR.y, VIEW.w, BAR.h);
    stripes(g, 0, TOP.h - 6, VIEW.w, 6);
    stripes(g, 0, BAR.y, VIEW.w, 6);
    // The faction's planet badge, the crystal and the harvester marks on the top bar.
    g.lineStyle(2, INK.tangerine, 1);
    g.strokeEllipse(17, 15, 26, 8);
    g.fillStyle(INK.mustard, 1);
    g.fillCircle(17, 15, 7);
    g.fillStyle(INK.tangerine, 1);
    g.fillRect(10, 13, 14, 2);
    const diamond = (x: number, y: number, r: number, color: number) => {
      g.fillStyle(color, 1);
      g.fillTriangle(x, y - r, x + r * 0.75, y, x - r * 0.75, y);
      g.fillStyle(0x2a6ad8, 1);
      g.fillTriangle(x, y + r, x + r * 0.75, y, x - r * 0.75, y);
    };
    diamond(172, 15, 8, INK.sky);
    g.fillStyle(INK.mustard, 1);
    g.fillTriangle(276, 8, 281, 22, 271, 22);
    g.fillTriangle(368, 8, 373, 22, 363, 22);
  }

  private draw() {
    const s = this.state;
    this.gfx.clear();
    this.underGfx.clear();
    this.uiGfx.clear();
    this.pickGfx.clear();

    for (const n of s.nodes) {
      const c = this.crystals.get(n.id);
      if (!c) continue;
      const k = 0.55 + 0.45 * (n.amount / NODE_AMOUNT);
      const shown = n.amount > 0 && s.fog.knows(n);
      c.gem.setVisible(shown).setScale(k / RES);
      c.glow.setVisible(shown).setScale(k * 0.9);
    }
    this.drawFog();
    this.drawNebulae();
    this.drawBeacon();
    this.drawDerelicts();
    this.drawMines();
    this.drawBuildings();
    this.drawShips();
    this.drawShards();
    this.drawEffects();
    this.drawPops();
    this.drawSelection();
    this.drawRally();
    this.drawAlerts();
    this.drawPlacement();
    this.drawHover();
    this.drawBar();
    this.drawTop();
    this.drawText();
    this.drawRivals();
    this.drawBoard();
    this.drawPact();
    this.drawConvoy();
    this.drawKeep();
    this.drawMinimap();
    this.drawPicker();
  }

  /** Where a view pixel on the minimap is on the battlefield. */
  private fromMini(x: number, y: number) {
    return { x: ARENA.x + ((x - MINIMAP.x) / MINIMAP.w) * ARENA.w, y: ARENA.y + ((y - MINIMAP.y) / MINIMAP.h) * ARENA.h };
  }

  /**
   * The minimap in the map's bottom-right corner: unexplored space near black, explored space dim
   * violet and what the player sees now lighter (repainted every MINI_EVERY frames), then crystal,
   * the beacon, every known building as a square and every seen ship as a dot in its faction's
   * colour, the attack alerts as orange rings and the map camera's window as a cream frame.
   */
  private drawMinimap() {
    const g = this.miniGfx.clear();
    const show = !this.picking;
    this.miniImage.setVisible(show);
    if (!show) return;
    const s = this.state;
    if (this.fogFrame % MINI_EVERY === 1) {
      const d = this.miniData.data;
      for (let i = 0; i < FOG_COLS * FOG_ROWS; i++) {
        const [r, gr, b] = s.fog.visible[i] ? [74, 46, 104] : s.fog.explored[i] ? [44, 26, 64] : [16, 8, 26];
        d[i * 4] = r;
        d[i * 4 + 1] = gr;
        d[i * 4 + 2] = b;
        d[i * 4 + 3] = 255;
      }
      this.miniTex.context.putImageData(this.miniData, 0, 0);
      this.miniTex.refresh();
    }
    const m = MINIMAP;
    const kx = m.w / ARENA.w;
    const ky = m.h / ARENA.h;
    const at = (p: { x: number; y: number }) => ({ x: m.x + (p.x - ARENA.x) * kx, y: m.y + (p.y - ARENA.y) * ky });
    g.fillStyle(INK.sky, 0.8);
    for (const n of s.nodes) {
      if (n.amount <= 0 || !s.fog.knows(n)) continue;
      const q = at(n);
      g.fillRect(q.x - 0.75, q.y - 0.75, 1.5, 1.5);
    }
    if (s.watch || s.fog.knows(s.beacon)) {
      const q = at(s.beacon);
      g.lineStyle(1, s.beacon.owner >= 0 ? s.sides[s.beacon.owner].def.color : INK.cream, 1);
      g.strokeCircle(q.x, q.y, 3);
    }
    for (const [b] of this.shownBuildings()) {
      const q = at(b);
      const r = b.type === 'hub' ? 3.5 : 2;
      g.fillStyle(s.sides[b.faction].def.color, 1);
      g.fillRect(q.x - r, q.y - r, r * 2, r * 2);
      g.lineStyle(1, INK.chocolate, 1);
      g.strokeRect(q.x - r, q.y - r, r * 2, r * 2);
    }
    for (const u of s.units) {
      if (!s.seesUnit(u)) continue;
      const q = at(u);
      g.fillStyle(s.sides[u.faction].def.color, 1);
      g.fillCircle(q.x, q.y, u.faction === PLAYER && this.selected.has(u.id) ? 1.8 : 1.3);
    }
    for (const a of this.alerts) {
      const q = at(a);
      g.lineStyle(1.5, ALERT_COLOR, 1);
      g.strokeCircle(q.x, q.y, settings.reduceMotion ? 5 : 4 + ((this.clock / 120) % 4));
    }
    // The map camera's window, and the frame round the minimap.
    g.lineStyle(1, INK.cream, 0.9);
    g.strokeRect(m.x + (this.camera.scrollX - ARENA.x) * kx, m.y + (this.camera.scrollY - ARENA.y) * ky, MAP_VIEW.w * kx, MAP_VIEW.h * ky);
    g.lineStyle(2, INK.mustard, 1);
    g.strokeRect(m.x - 1, m.y - 1, m.w + 2, m.h + 2);
  }

  /**
   * The rally point: a mustard pennant on a pole with a faint ring where the new warships gather,
   * and a dashed line to it from each finished Barracks. In rally mode a pennant follows the pointer.
   */
  private drawRally() {
    if (this.picking || this.state.watch) return;
    const g = this.gfx;
    const rally = this.state.sides[PLAYER].rally;
    const flag = (x: number, y: number, alpha: number) => {
      g.lineStyle(2, INK.chocolate, alpha);
      g.lineBetween(x, y, x, y - 22);
      g.fillStyle(INK.mustard, alpha);
      g.fillTriangle(x, y - 22, x + 14, y - 17, x, y - 12);
      g.lineStyle(1.5, INK.chocolate, alpha);
      g.strokeTriangle(x, y - 22, x + 14, y - 17, x, y - 12);
      g.fillStyle(INK.chocolate, alpha);
      g.fillCircle(x, y, 2.5);
    };
    if (rally) {
      for (const b of this.state.buildings) {
        if (b.faction !== PLAYER || b.type !== 'barracks' || !b.done) continue;
        g.lineStyle(1, INK.mustard, 0.35);
        g.lineBetween(b.x, b.y, rally.x, rally.y);
      }
      dashedCircle(g, rally.x, rally.y, 46, 20, INK.mustard, 0.45, 1.5);
      flag(rally.x, rally.y, 1);
    }
    if (this.rallyMode && this.inMap(this.pointer.x, this.pointer.y)) {
      const at = this.toWorld(this.pointer.x, this.pointer.y);
      flag(at.x, at.y, 0.6);
    }
  }

  /**
   * Attack alerts: a pulsing ring where a rival is hitting the player, and for one off screen an
   * arrow on the map's edge pointing at it. Alerts end ALERT_MS after their last hit. With reduced
   * motion the ring and arrow hold still.
   */
  private drawAlerts() {
    this.alerts = this.alerts.filter((a) => this.clock - a.last < ALERT_MS);
    this.edgeMarks = [];
    if (this.picking || this.state.phase !== 'playing') return;
    const still = settings.reduceMotion;
    const pulse = still ? 0.5 : (Math.sin(this.clock / 160) + 1) / 2;
    const cx = MAP_VIEW.x + MAP_VIEW.w / 2;
    const cy = MAP_VIEW.y + MAP_VIEW.h / 2;
    for (const a of this.alerts) {
      const r = 26 + (still ? 0 : ((this.clock - a.first) / 25) % 14);
      this.gfx.lineStyle(3, ALERT_COLOR, 0.55 + 0.4 * pulse);
      this.gfx.strokeCircle(a.x, a.y, r);
      const p = this.toScreen(a.x, a.y);
      if (this.inMap(p.x, p.y)) continue;
      // Where the line from the map's middle to the alert leaves the map, a little inside its edge.
      const dx = p.x - cx;
      const dy = p.y - cy;
      const k = Math.min(Math.abs((MAP_VIEW.w / 2 - 18) / (dx || 1e-6)), Math.abs((MAP_VIEW.h / 2 - 18) / (dy || 1e-6)));
      const mx = cx + dx * k;
      const my = cy + dy * k;
      const rot = Math.atan2(dy, dx);
      const pt = (fx: number, fy: number) => ({ x: mx + fx * Math.cos(rot) - fy * Math.sin(rot), y: my + fx * Math.sin(rot) + fy * Math.cos(rot) });
      const [p1, p2, p3] = [pt(12, 0), pt(-8, -10), pt(-8, 10)];
      const g = this.uiGfx;
      g.fillStyle(ALERT_COLOR, 0.7 + 0.3 * pulse);
      g.fillTriangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      g.lineStyle(1.5, INK.chocolate, 1);
      g.strokeTriangle(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      this.edgeMarks.push({ x: mx, y: my, alert: a });
    }
  }

  /** The edge of each nebula, a faint dashed ring: ships inside are hidden from enemies and slowed. */
  private drawNebulae() {
    // Under the nebula contract the rings stand out in mustard.
    const held = this.state.contract.goal === 'nebula';
    for (const n of this.layout.nebulae) dashedCircle(this.underGfx, n.x, n.y, n.r, 40, held ? INK.mustard : INK.cream, held ? 0.5 : 0.14, held ? 2 : 1.5);
  }

  /**
   * Derelict stations, once found: a dark steel wheel with a broken rim, a ring in the owner's
   * colour, the claim arc, its sensor reach for the player, and a label with what it gives.
   */
  private drawDerelicts() {
    const s = this.state;
    const g = this.underGfx;
    s.derelicts.forEach((d: Derelict, k) => {
      const label = this.derelictLabels[k];
      const found = s.watch || s.fog.knows(d);
      if (!found) {
        label.setVisible(false);
        return;
      }
      const color = d.owner >= 0 ? s.sides[d.owner].def.color : INK.cream;
      g.fillStyle(color, d.owner >= 0 ? 0.1 : 0.04);
      g.fillCircle(d.x, d.y, DERELICT_RADIUS);
      dashedCircle(g, d.x, d.y, DERELICT_RADIUS, 20, color, 0.4, 1.5);
      progressArc(g, d.x, d.y, DERELICT_RADIUS, d.claim, d.capturer >= 0 ? s.sides[d.capturer].def.color : INK.cream, 5);
      if (d.perk === 'sensors' && d.owner === PLAYER) dashedCircle(g, d.x, d.y, SENSOR_RANGE, 64, INK.cream, 0.18, 1);
      // The wreck: a grey wheel of spokes with a gap torn out of its rim, and a dead core that lights in the owner's colour.
      g.lineStyle(5, 0x4a4652, 1);
      g.beginPath();
      g.arc(d.x, d.y, 18, 0.5, Math.PI * 1.75, false);
      g.strokePath();
      g.lineStyle(2, 0x8a8494, 1);
      g.beginPath();
      g.arc(d.x, d.y, 18, 0.5, Math.PI * 1.75, false);
      g.strokePath();
      g.lineStyle(3, 0x5c5866, 1);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3 + 0.3;
        if (a > Math.PI * 1.75 && a < Math.PI * 2 + 0.5) continue;
        g.lineBetween(d.x, d.y, d.x + Math.cos(a) * 18, d.y + Math.sin(a) * 18);
      }
      g.fillStyle(0x2a2731, 1);
      g.fillCircle(d.x, d.y, 8);
      g.fillStyle(d.owner >= 0 ? color : 0x6a6474, 1);
      g.fillCircle(d.x, d.y, 4);
      const def = DERELICT_DEFS[d.perk];
      const pct = Math.round(d.claim * 100);
      const who = d.owner === PLAYER ? tr('yours') : d.owner >= 0 ? tr('heldBy', { faction: tr(s.sides[d.owner].def.name) }) : tr('holdClaim', { pct });
      const text = `${tr('derelictLabel', { name: tr(def.name).toUpperCase() })}\n${who}`;
      if (label.text !== text) label.setText(text);
      label.setPosition(d.x + DERELICT_RADIUS * 0.72, d.y + DERELICT_RADIUS * 0.5).setVisible(!this.picking);
    });
  }

  /**
   * The rivals panel: each rival's stance toward the player (its grudge, a truce, an open offer) and
   * the buttons to accept or decline a truce or to pay tribute. A hint shows while an offer waits.
   */
  private drawRivals() {
    const s = this.state;
    const g = this.pickGfx;
    const rivals = s.sides.filter((r) => r.index !== PLAYER);
    const offer = rivals.find((r) => r.offerMs > 0);
    this.rivalsHint.setVisible(!this.rivalsOpen && !this.picking && !!offer);
    if (offer) this.setText(this.rivalsHint, tr('rivalOffers', { faction: tr(offer.def.name), s: Math.ceil(offer.offerMs / 1000) }));
    const show = this.rivalsOpen && !this.picking && !watching;
    this.rivalsHead.setVisible(show);
    this.rivalTexts.forEach((t) => [t.name, t.status, t.b1, t.b2].forEach((x) => x.setVisible(show)));
    this.rivalDeals.forEach((x) => x.setVisible(show));
    this.rivalButtons = [];
    if (!show) return;
    const rp = RIVALS_PANEL;
    const h = rp.head + rivals.length * rp.row + 6;
    g.fillStyle(0x000000, 0.4);
    g.fillRoundedRect(rp.x + 3, rp.y + 4, rp.w, h, 8);
    g.fillStyle(INK.cream, 1);
    g.fillRoundedRect(rp.x, rp.y, rp.w, h, 8);
    g.fillStyle(INK.chocolate, 1);
    g.fillRoundedRect(rp.x, rp.y, rp.w, rp.head, { tl: 8, tr: 8, bl: 0, br: 0 });
    g.lineStyle(2, INK.cocoa, 1);
    g.strokeRoundedRect(rp.x, rp.y, rp.w, h, 8);
    const pill = (x: number, y: number, w: number, label: Phaser.GameObjects.Text, text: string, on: boolean, action: RivalButton['action'], faction: number) => {
      g.fillStyle(on ? INK.mustard : INK.creamDim, 1);
      g.fillRoundedRect(x, y, w, 22, 11);
      g.lineStyle(1.5, INK.cocoa, 1);
      g.strokeRoundedRect(x, y, w, 22, 11);
      this.setText(label, text);
      label.setPosition(x + w / 2, y + 11).setVisible(true).setColor(on ? INK_CSS.chocolate : INK_CSS.cocoa);
      if (on) this.rivalButtons.push({ x, y, w, h: 22, action, faction });
    };
    rivals.forEach((r, k) => {
      const t = this.rivalTexts[k];
      const y = rp.y + rp.head + k * rp.row;
      g.fillStyle(r.def.color, r.alive ? 1 : 0.2);
      g.fillCircle(rp.x + 13, y + 14, 5.5);
      g.lineStyle(1, INK.cocoa, 1);
      g.lineBetween(rp.x + 8, y + rp.row, rp.x + rp.w - 8, y + rp.row);
      this.setText(t.name, tr(r.def.name));
      t.b1.setVisible(false);
      t.b2.setVisible(false);
      const deal = r.deal;
      const c = deal.goal ? contractOf(deal.goal) : null;
      this.setText(this.rivalDeals[k], !r.alive ? '' : c
        ? tr('rivalDeal', { rank: RANKS[deal.step], title: c.title(r.def), n: Math.floor(deal.progress), target: c.target })
        : deal.step >= CONTRACT_STEPS ? tr('rivalDealsDone') : '');
      if (!r.alive) {
        this.setText(t.status, tr('fallen'));
        return;
      }
      const grudge = r.grudge === PLAYER ? tr('grudgeYou') : r.grudge >= 0 ? tr('grudgeAt', { faction: tr(s.sides[r.grudge].def.name) }) : tr('noGrudge');
      const lock = r.grudgeLockMs > 0 ? tr('heldByTribute', { s: Math.ceil(r.grudgeLockMs / 1000) }) : '';
      t.status.setWordWrapWidth(r.offerMs > 0 ? rp.w - 196 : rp.w - 140);
      if (r.offerMs > 0) {
        this.setText(t.status, tr('offersTruce', { s: TRUCE_MS / 1000, n: TRUCE_TRIBUTE, left: Math.ceil(r.offerMs / 1000) }));
        pill(rp.x + rp.w - 160, y + 12, 72, t.b1, tr('accept'), true, 'accept', r.index);
        pill(rp.x + rp.w - 82, y + 12, 74, t.b2, tr('decline'), true, 'decline', r.index);
        return;
      }
      if (r.truceMs > 0) {
        this.setText(t.status, tr('truceLeft', { s: Math.ceil(r.truceMs / 1000) }));
        return;
      }
      if (s.pact) {
        this.setText(t.status, tr('inThePact'));
        return;
      }
      const target = s.bribeTarget(r.index);
      this.setText(t.status, lock ? `${grudge}${lock}` : `${grudge}${target ? tr('tributeTurns', { faction: tr(target.def.name), s: BRIBE_MS / 1000 }) : ''}`);
      if (target) pill(rp.x + rp.w - 104, y + 12, 96, t.b1, tr('tribute', { n: BRIBE_COST }), s.sides[PLAYER].crystal >= BRIBE_COST, 'bribe', r.index);
    });
  }

  /**
   * The fog of war: a canvas of one pixel a cell, smoothed onto a bigger one stretched over the
   * battlefield so its edges blur like airbrush. Unexplored space is near black, explored space is dimmed.
   */
  private drawFog() {
    if (this.fogFrame++ % FOG_EVERY !== 0) return;
    const fog = this.state.fog;
    const d = this.fogData.data;
    const [r, g, b] = FOG_RGB;
    const alpha = this.fogAlpha;
    for (let i = 0; i < alpha.length; i++) alpha[i] = fog.visible[i] ? 0 : fog.explored[i] ? FOG_EXPLORED : FOG_UNEXPLORED;
    blur(alpha, this.fogTmp, FOG_COLS, FOG_ROWS, FOG_BLUR);
    for (let i = 0; i < alpha.length; i++) {
      d[i * 4] = r;
      d[i * 4 + 1] = g;
      d[i * 4 + 2] = b;
      d[i * 4 + 3] = Math.round(alpha[i] * 255);
    }
    this.fogCells.getContext('2d')!.putImageData(this.fogData, 0, 0);
    const ctx = this.fogTex.context;
    ctx.clearRect(0, 0, this.fogTex.width, this.fogTex.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.fogCells, 0, 0, this.fogTex.width, this.fogTex.height);
    this.fogTex.refresh();
  }

  /** Mines: a dark studded disc with a ring in the layer's colour; a rival's only when a ship is close. */
  private drawMines() {
    const g = this.underGfx;
    for (const m of this.state.mines) {
      if (!this.state.seesMine(m)) continue;
      const def = this.state.sides[m.faction].def;
      g.fillStyle(INK.chocolate, 0.95);
      g.fillCircle(m.x, m.y, 5);
      for (let k = 0; k < 4; k++) {
        const a = (k * Math.PI) / 2 + Math.PI / 4;
        g.fillCircle(m.x + Math.cos(a) * 6, m.y + Math.sin(a) * 6, 1.6);
      }
      g.lineStyle(1.5, def.color, m.faction === PLAYER ? 0.55 : 1);
      g.strokeCircle(m.x, m.y, 8);
      g.fillStyle(def.accent, 1);
      g.fillCircle(m.x, m.y, 1.8);
    }
  }

  /** The relay beacon: its capture ring, the owner's glow and its label, once the player has found it. */
  private drawBeacon() {
    const bc = this.state.beacon;
    const found = this.state.fog.knows(bc);
    this.beaconImg.setVisible(found);
    this.beaconGlow.setVisible(found);
    if (!found) {
      this.beaconLabel.setVisible(false);
      return;
    }
    const g = this.underGfx;
    const color = (f: number) => (f >= 0 ? this.state.sides[f].def.color : INK.cream);
    g.fillStyle(color(bc.owner), bc.owner >= 0 ? 0.12 : 0.05);
    g.fillCircle(bc.x, bc.y, BEACON_RADIUS);
    dashedCircle(g, bc.x, bc.y, BEACON_RADIUS, 24, INK.cream, 0.45, 1.5);
    progressArc(g, bc.x, bc.y, BEACON_RADIUS, bc.capture, color(bc.capturer), 5);
    const pulse = settings.reduceMotion ? 1 : 0.9 + 0.1 * Math.sin(this.clock / 300);
    this.beaconGlow.setScale((bc.held ? 1.4 : 0.9) * pulse).setAlpha(bc.held ? 0.7 : 0.4);
    const pct = Math.round(bc.capture * 100);
    const status = bc.owner === PLAYER
      ? bc.held ? tr('beaconYoursPaying', { n: BEACON_PAY }) : tr('beaconYours')
      : bc.owner >= 0 ? tr('heldBy', { faction: tr(this.state.sides[bc.owner].def.name) }) : tr('beaconHold', { n: BEACON_PAY });
    const label = `${tr('beaconLabel', { pct })}\n${status}`;
    if (this.beaconLabel.text !== label) this.beaconLabel.setText(label);
    this.beaconLabel.setPosition(bc.x + BEACON_RADIUS * 0.72, bc.y + BEACON_RADIUS * 0.55).setVisible(!this.picking);
  }

  /**
   * The buildings the player's map shows, each with the live building when it is in sight: the
   * player's own and rivals' in sight as they are, rivals' under the fog as last seen (`known`),
   * even if they have fallen or changed hands since.
   */
  private shownBuildings(): [SeenBuilding, Building | null][] {
    const s = this.state;
    const shown: [SeenBuilding, Building | null][] = [];
    for (const b of s.buildings) if (b.faction === PLAYER) shown.push([b, b]);
    for (const v of s.known.values()) shown.push([v, s.fog.sees(v) ? s.building(v.id) ?? null : null]);
    return shown;
  }

  private drawBuildings() {
    const seen = new Set<number>();
    for (const [v, live] of this.shownBuildings()) {
      seen.add(v.id);
      const side = this.state.sides[v.faction];
      const def = side.def.buildings[v.type];
      // A hacked turret changes faction, and with it its look.
      const key = buildingKey(this.art(v.faction), v.type);
      let img = this.houses.get(v.id);
      if (!img) {
        img = this.onMap(this.add.image(v.x, v.y, key).setScale((v.expansion ? EXPANSION_SCALE : 1) / RES).setDepth(DEPTH.building));
        this.houses.set(v.id, img);
      } else if (img.texture.key !== key) {
        img.setTexture(key);
      }
      const floats = side.def.name === 'solarConcord' && v.type === 'turret' && !settings.reduceMotion;
      img.setPosition(v.x, v.y + (floats ? Math.sin(this.clock / 500 + v.id) * 1.6 : 0));
      img.setAlpha(!v.done ? 0.5 : live && live.disabledMs > 0 ? 0.45 : 1);
      const r = def.radius;
      // A soft faction-coloured pad under every building, so a base reads as its faction's at a glance.
      this.underGfx.fillStyle(side.def.color, 0.16);
      this.underGfx.fillEllipse(v.x, v.y + 2, r * 2.6, r * 1.7);
      if (!live) continue;
      const b = live;
      if (!b.done) {
        drawProgress(this.gfx, b.x, b.y + r + 6, 34, 1 - b.buildLeft / b.buildMs, side.def.color);
      } else if (b.hp < b.maxHp) {
        drawHealth(this.gfx, b.x, b.y - r - 14, 32, b.hp / b.maxHp);
      }
      // A hacked turret fills a ring toward its takeover.
      if (b.hacks > 0) progressArc(this.gfx, b.x, b.y, r + 9, b.hacks / TAKEOVER, 0x5ff0e6, 3);
    }
    for (const [id, img] of this.houses) {
      if (!seen.has(id)) {
        img.destroy();
        this.houses.delete(id);
      }
    }
  }

  /** Ships: the baked frame nearest each heading, turned the last few degrees, with exhaust while moving. */
  private drawShips() {
    const s = this.state;
    const seen = new Set<number>();
    for (const u of s.units) {
      if (!s.seesUnit(u)) continue;
      seen.add(u.id);
      const art = this.art(u.faction);
      let sp = this.ships.get(u.id);
      if (!sp) {
        sp = {
          flame: this.onMap(this.add.image(u.x, u.y, flameKey(art)).setOrigin(1, 0.5).setDepth(DEPTH.flame)),
          ship: this.onMap(this.add.image(u.x, u.y, shipKey(art, u.type), 0).setScale(1 / RES).setDepth(DEPTH.ship)),
          lastX: u.x,
          lastY: u.y,
        };
        this.ships.set(u.id, sp);
      }
      const ability = s.abilityOf(u);
      const { frame, rest } = facing(u.angle);
      // A cloaked ship of the player's own shows faintly, as does one hiding in a nebula; a decoy is a dimmer copy of its ship.
      const cloaked = u.faction === PLAYER && ability?.kind === 'cloak' && u.revealMs <= 0;
      const alpha = cloaked ? 0.4 : u.nebula && u.revealMs <= 0 ? 0.6 : u.decoyMs !== null ? 0.6 : 1;
      const size = u.flagship ? FLAGSHIP_SCALE : 1;
      sp.ship.setFrame(frame).setPosition(u.x, u.y).setRotation(rest).setAlpha(alpha).setScale(size / RES);
      // The flagship rides on a gold ring.
      if (u.flagship) {
        this.underGfx.fillStyle(FLAGSHIP_GOLD, 0.12);
        this.underGfx.fillCircle(u.x, u.y, 30);
        dashedCircle(this.underGfx, u.x, u.y, 30, 16, FLAGSHIP_GOLD, 0.8, 2);
      }
      const moving = Math.hypot(u.x - sp.lastX, u.y - sp.lastY) > 0.01;
      sp.lastX = u.x;
      sp.lastY = u.y;
      sp.flame.setVisible(moving && !this.picking);
      if (moving) {
        const flicker = settings.reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(this.clock / 40 + u.id * 1.7);
        const len = FLAME[u.type] * SHIP_ZOOM * flicker * size;
        const tail = TAIL[u.type] * SHIP_ZOOM * size;
        sp.flame
          .setPosition(u.x - Math.cos(u.angle) * tail, u.y - Math.sin(u.angle) * tail)
          .setRotation(u.angle)
          .setScale(len / sp.flame.width, (u.type === 'heavy' ? 12 : 8) * size / sp.flame.height)
          .setAlpha(alpha * 0.95);
      }
      if (ability?.kind === 'shield') {
        this.underGfx.fillStyle(s.sides[u.faction].def.accent, 0.06);
        this.underGfx.fillCircle(u.x, u.y, ability.range);
        this.underGfx.lineStyle(1.5, s.sides[u.faction].def.color, 0.3);
        this.underGfx.strokeCircle(u.x, u.y, ability.range);
      }
      if (this.selected.has(u.id)) dashedCircle(this.gfx, u.x, u.y, u.flagship ? 34 : u.type === 'heavy' ? 22 : 16, 10, INK.tangerine, 1, 2);
      if (u.hp < u.maxHp) drawHealth(this.gfx, u.x, u.y - (u.flagship ? 34 : 18), u.flagship ? 34 : 22, u.hp / u.maxHp);
      // Veteran chevrons above the ship, one per rank, in the faction's gold.
      const rank = s.rankOf(u);
      for (let k = 0; k < rank; k++) {
        const cx = u.x - (rank - 1) * 4 + k * 8;
        const cy = u.y - (u.flagship ? 42 : 26);
        this.gfx.fillStyle(0xffd36a, 1);
        this.gfx.fillTriangle(cx - 3.5, cy - 3, cx + 3.5, cy - 3, cx, cy + 2);
      }
      // A green cross beside a ship under repair.
      if (u.repairing && u.hp < u.maxHp) {
        this.gfx.lineStyle(2.5, 0x5ad66e, 1);
        this.gfx.lineBetween(u.x + 10, u.y - 15, u.x + 18, u.y - 15);
        this.gfx.lineBetween(u.x + 14, u.y - 19, u.x + 14, u.y - 11);
      }
    }
    for (const [id, sp] of this.ships) {
      if (!seen.has(id)) {
        sp.ship.destroy();
        sp.flame.destroy();
        this.ships.delete(id);
      }
    }
  }

  /** Salvage shards: glowing gold crystals that fly to the nearest of the player's ships. */
  private drawShards() {
    const seen = new Set<number>();
    for (const sh of this.state.shards) {
      if (!this.state.fog.sees(sh)) continue;
      seen.add(sh.id);
      let sp = this.shardSprites.get(sh.id);
      if (!sp) {
        sp = {
          glow: this.onMap(this.add.image(sh.x, sh.y, GLOW_KEY).setDepth(DEPTH.shard).setBlendMode(Phaser.BlendModes.ADD)),
          gem: this.onMap(this.add.image(sh.x, sh.y, SHARD_KEY).setScale(1 / RES).setDepth(DEPTH.shard)),
        };
        this.shardSprites.set(sh.id, sp);
      }
      const pulse = settings.reduceMotion ? 1 : 0.85 + 0.15 * Math.sin(this.clock / 160 + sh.id);
      sp.glow.setPosition(sh.x, sh.y).setScale(0.75 * pulse).setAlpha(0.85);
      sp.gem.setPosition(sh.x, sh.y - 2);
    }
    for (const [id, sp] of this.shardSprites) {
      if (!seen.has(id)) {
        sp.glow.destroy();
        sp.gem.destroy();
        this.shardSprites.delete(id);
      }
    }
  }

  /** Laser beams with a cream core, and airbrushed fireballs where things blow up. */
  private drawEffects() {
    const g = this.gfx;
    const fog = this.state.fog;
    for (const b of this.state.beams) {
      if (!fog.sees(b) && !fog.sees({ x: b.x2!, y: b.y2! })) continue;
      const a = settings.reduceMotion ? 0.9 : b.life / BEAM_MS;
      g.lineStyle(5, b.color, 0.35 * a);
      g.lineBetween(b.x, b.y, b.x2!, b.y2!);
      g.lineStyle(1.8, 0xfff4d8, a);
      g.lineBetween(b.x, b.y, b.x2!, b.y2!);
    }
    // Fireballs are not drawn under reduced motion, where their growth is the motion.
    if (!settings.reduceMotion) {
      for (const b of this.state.booms) {
        if (!fog.sees(b)) continue;
        const t = 1 - b.life / BOOM_MS;
        const r = b.r! * (0.6 + t * 1.4);
        g.fillStyle(0xe8742a, 0.45 * (1 - t));
        g.fillCircle(b.x, b.y, r);
        g.fillStyle(0xfff0c0, 0.7 * (1 - t));
        g.fillCircle(b.x, b.y, r * 0.45);
        g.lineStyle(2, b.color, 1 - t);
        g.strokeCircle(b.x, b.y, r * 1.25);
      }
    }
  }

  /** Floating numbers over the map: +8 where a shard is picked up, +3 over the beacon. */
  private drawPops() {
    const pops = this.state.pops;
    while (this.popTexts.length < pops.length) {
      this.popTexts.push(this.onMap(this.text(0, 0, 16, '#ffffff', true).setOrigin(0.5, 1).setStroke(INK_CSS.chocolate, 4).setDepth(DEPTH.pop)));
    }
    this.popTexts.forEach((t, k) => {
      const p = pops[k];
      t.setVisible(!!p);
      if (!p) return;
      const age = 1 - p.life / POP_MS;
      if (t.text !== p.text) t.setText(p.text);
      t.setColor(hex(p.color));
      t.setPosition(p.x, p.y - (settings.reduceMotion ? 0 : age * 22));
      t.setAlpha(age < 0.6 ? 1 : 1 - (age - 0.6) / 0.4);
    });
  }

  /** The box being dragged, in view pixels. */
  private drawSelection() {
    if (this.drag) {
      const d = this.drag;
      this.uiGfx.fillStyle(INK.mustard, 0.08);
      this.uiGfx.fillRect(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
      this.uiGfx.lineStyle(1.5, INK.mustard, 0.9);
      this.uiGfx.strokeRect(Math.min(d.x0, d.x1), Math.min(d.y0, d.y1), Math.abs(d.x1 - d.x0), Math.abs(d.y1 - d.y0));
    }
  }

  /** The building being placed follows the pointer: green where it can go, orange where it can't. */
  private drawPlacement() {
    if (!this.placing || !this.inMap(this.pointer.x, this.pointer.y)) {
      this.ghost.setVisible(false);
      return;
    }
    const { x, y } = this.toWorld(this.pointer.x, this.pointer.y);
    const ok = this.state.placementProblem(this.placing, x, y) === null;
    const side = this.state.sides[PLAYER];
    const radius = buildInfo(side, this.placing).radius;
    // Buildings go within reach of a hub; an expansion goes far from them, so the rings show where not to.
    for (const hub of this.state.hubsOf(PLAYER, this.placing !== 'expansion')) {
      dashedCircle(this.underGfx, hub.x, hub.y, this.placing === 'expansion' ? EXPANSION_GAP : BUILD_RANGE, 48, INK.cream, 0.35, 1.5);
    }
    this.underGfx.fillStyle(ok ? 0x7dffb0 : 0xffa94d, 0.25);
    this.underGfx.fillCircle(x, y, radius + 4);
    this.underGfx.lineStyle(2, ok ? 0x7dffb0 : 0xffa94d, 0.9);
    this.underGfx.strokeCircle(x, y, radius + 4);
    const expansion = this.placing === 'expansion';
    this.ghost.setTexture(buildingKey(this.art(PLAYER), expansion ? 'hub' : this.placing as Role))
      .setScale(1 / RES * (expansion ? EXPANSION_SCALE : 1)).setPosition(x, y).setVisible(true);
  }

  /** Names the unit or building under the pointer, with its role and hit points (a building's only in sight). */
  private drawHover() {
    const label = this.hoverLabel;
    const hit = this.inMap(this.pointer.x, this.pointer.y) && !this.placing && !this.picking
      ? this.toWorld(this.pointer.x, this.pointer.y)
      : null;
    const target = hit ? this.state.entityAt(hit.x, hit.y) : null;
    const derelict = hit && !target ? this.state.derelictAt(hit.x, hit.y) : null;
    if (derelict) {
      const text = [tr('derelictHover', { name: tr(DERELICT_DEFS[derelict.perk].name) }), ...derelictLines(derelict.perk)].join('\n');
      if (label.text !== text) label.setText(text);
      label.setPosition(derelict.x, derelict.y - LABEL_LIFT).setVisible(true);
      return;
    }
    if (!target) {
      label.setVisible(false);
      return;
    }
    let side = this.state.sides[target.faction];
    let text: string;
    let at: { x: number; y: number };
    if (target.kind === 'unit') {
      const u = this.state.unit(target.id)!;
      const rank = this.state.rankOf(u);
      const name = tr(u.flagship ? side.def.flagship.name : side.def.units[u.type].name);
      const hp = tr('hp', { hp: Math.ceil(u.hp), max: u.maxHp });
      const head = `${name} · ${rank ? `${tr(VETERAN_NAMES[rank - 1])} ${'★'.repeat(rank)} · ` : ''}${tr(ROLE_LABEL[u.flagship ? 'flagship' : u.type])} · ${hp}`;
      text = [head, ...(u.flagship ? flagshipLines(side) : unitLines(side, u.type))].join('\n');
      at = u;
    } else {
      // A rival building under the fog shows as last seen (even one fallen since): its owner, name and role then, not its hit points now.
      const live = this.state.building(target.id);
      const inSight = !!live && (live.faction === PLAYER || this.state.fog.sees(live));
      const b = inSight ? live : this.state.known.get(target.id) ?? live;
      if (!b) {
        label.setVisible(false);
        return;
      }
      side = this.state.sides[b.faction];
      const name = b.expansion ? buildInfo(side, 'expansion').name : tr(side.def.buildings[b.type].name);
      const hp = inSight && live ? ` · ${tr('hp', { hp: Math.ceil(live.hp), max: live.maxHp })}` : '';
      const head = `${name} · ${tr(ROLE_LABEL[b.expansion ? 'expansion' : b.type])}${hp}`;
      text = [head, ...(b.expansion ? expansionLines(side) : buildingLines(side, b.type))].join('\n');
      at = b;
    }
    if (label.text !== text) label.setText(text);
    label.setPosition(at.x, at.y - LABEL_LIFT).setVisible(true);
  }

  /** Each button: a cream pill with the ship or building, its name, role and crystal cost. */
  private drawBar() {
    const g = this.uiGfx;
    BUTTONS.forEach((b, i) => {
      if (b.kind === 'research') {
        this.drawResearchButton(b, i);
        return;
      }
      if (b.kind === 'command') {
        this.drawCommandButton(b, i);
        return;
      }
      const { name, cost } = this.buttonInfo(b);
      const affordable = this.state.sides[PLAYER].crystal >= cost;
      const active = b.kind === 'build' && this.placing === b.key;
      const round = b.h / 2;
      g.fillStyle(0x000000, 0.35);
      g.fillRoundedRect(b.x + 2, b.y + 3, b.w, b.h, round);
      g.fillStyle(active ? INK.mustard : affordable ? INK.cream : INK.creamDim, 1);
      g.fillRoundedRect(b.x, b.y, b.w, b.h, round);
      g.fillStyle(INK.tangerine, 1);
      g.fillRect(b.x + 24, b.y, 3, b.h);
      g.fillStyle(INK.mustard, 1);
      g.fillRect(b.x + 27, b.y, 2, b.h);
      g.lineStyle(1.5, active ? INK.tangerine : INK.cocoa, 1);
      g.strokeRoundedRect(b.x, b.y, b.w, b.h, round);
      const caption = this.captions[i];
      caption.icon.setAlpha(affordable ? 1 : 0.55);
      if (caption.name.text !== name) {
        caption.name.setText(name).setFontSize(12);
        for (let size = 11; caption.name.width > b.w - 35 && size >= 9; size--) caption.name.setFontSize(size);
      }
      const roleLine = tr('roleCost', { role: tr(ROLE_LABEL[b.key]), cost });
      if (caption.cost.text !== roleLine) {
        // A long role line (a big cost, or German) shrinks to stay inside the pill.
        caption.cost.setText(roleLine).setFontSize(10);
        if (caption.cost.width > b.w - 35) caption.cost.setFontSize(9);
      }
      caption.name.setColor(affordable ? INK_CSS.chocolate : INK_CSS.creamDim);
    });
    this.drawTip();
  }

  /**
   * A research button: a slim cream pill with the track's name, its next level and cost, three
   * level pips on the right, and a mustard fill while that track is being researched.
   */
  private drawResearchButton(b: Button, i: number) {
    const g = this.uiGfx;
    const side = this.state.sides[PLAYER];
    const track = b.key as Track;
    const r = side.research;
    const level = r.levels[track];
    const cost = researchCost(side, track);
    const busy = r.current?.track === track;
    const open = level < RESEARCH_LEVELS && !r.current && side.crystal >= cost;
    const round = b.h / 2;
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(b.x + 2, b.y + 3, b.w, b.h, round);
    g.fillStyle(open || busy ? INK.cream : INK.creamDim, 1);
    g.fillRoundedRect(b.x, b.y, b.w, b.h, round);
    if (busy) {
      const done = 1 - r.current!.left / RESEARCH_MS;
      g.fillStyle(INK.mustard, 1);
      g.fillRoundedRect(b.x, b.y, Math.max(b.h, b.w * done), b.h, round);
    }
    g.fillStyle(INK.tangerine, 1);
    g.fillRect(b.x + 4, b.y + 5, 2, b.h - 10);
    for (let k = 0; k < RESEARCH_LEVELS; k++) {
      const px = b.x + b.w - 30 + k * 9;
      g.fillStyle(k < level ? INK.tangerine : INK.creamDim, 1);
      g.fillCircle(px, b.y + b.h / 2, 3.2);
      g.lineStyle(1, INK.cocoa, 1);
      g.strokeCircle(px, b.y + b.h / 2, 3.2);
    }
    g.lineStyle(1.5, busy ? INK.tangerine : INK.cocoa, 1);
    g.strokeRoundedRect(b.x, b.y, b.w, b.h, round);
    const caption = this.captions[i];
    this.setText(caption.name, tr(TRACK_DEFS[track].name));
    const sub = busy ? tr('researching', { s: Math.ceil(r.current!.left / 1000) })
      : level >= RESEARCH_LEVELS ? tr('fullyResearchedShort') : tr('levelCost', { level: level + 1, cost });
    this.setText(caption.cost, sub);
    caption.name.setColor(open || busy ? INK_CSS.chocolate : INK_CSS.cocoa);
  }

  /**
   * A command pill. Fall back: lit while ships are selected. Flagship: dim until the third contract
   * unlocks it, then lit while it can be built, filling mustard as it is built.
   */
  private drawCommandButton(b: Button, i: number) {
    const g = this.uiGfx;
    const side = this.state.sides[PLAYER];
    const flag = side.flagship;
    const flagship = b.key === 'flagship';
    if (b.key === 'rally') {
      this.drawRallyButton(b, i);
      return;
    }
    const on = flagship ? flag.state === 'ready' && side.crystal >= flagshipStats(side).cost || flag.state === 'building' : this.selected.size > 0;
    const round = b.h / 2;
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(b.x + 2, b.y + 3, b.w, b.h, round);
    g.fillStyle(on ? INK.cream : INK.creamDim, 1);
    g.fillRoundedRect(b.x, b.y, b.w, b.h, round);
    if (flagship && flag.state === 'building') {
      g.fillStyle(INK.mustard, 1);
      g.fillRoundedRect(b.x, b.y, Math.max(b.h, b.w * (1 - flag.left / FLAGSHIP_MS)), b.h, round);
    }
    g.fillStyle(INK.tangerine, 1);
    g.fillRect(b.x + 4, b.y + 5, 2, b.h - 10);
    g.lineStyle(1.5, INK.cocoa, 1);
    g.strokeRoundedRect(b.x, b.y, b.w, b.h, round);
    const caption = this.captions[i];
    if (flagship) {
      const cost = flagshipStats(side).cost;
      const text = flag.state === 'locked' ? tr('flagshipUnlocks', { n: FLAGSHIP_STEP })
        : flag.state === 'ready' ? tr('buildFlagship', { cost })
        : flag.state === 'building' ? tr('flagshipBuildingShort', { s: Math.ceil(flag.left / 1000) })
        : flag.state === 'out' ? tr('flagshipFlying') : tr('flagshipLostShort');
      this.setText(caption.name, text);
      this.setText(caption.cost, '');
      caption.name.setColor(on || flag.state === 'out' ? INK_CSS.chocolate : INK_CSS.cocoa);
      return;
    }
    this.setText(caption.name, tr('fallBack'));
    this.setText(caption.cost, on ? tr('selectedB', { n: this.selected.size }) : tr('selectShipsB'));
    caption.name.setColor(on ? INK_CSS.chocolate : INK_CSS.cocoa);
  }

  /** The Rally pill: mustard while the next tap plants the rally point, cream once one is planted, dim before. */
  private drawRallyButton(b: Button, i: number) {
    const g = this.uiGfx;
    const set = !!this.state.sides[PLAYER].rally;
    const round = b.h / 2;
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(b.x + 2, b.y + 3, b.w, b.h, round);
    g.fillStyle(this.rallyMode ? INK.mustard : set ? INK.cream : INK.creamDim, 1);
    g.fillRoundedRect(b.x, b.y, b.w, b.h, round);
    g.fillStyle(INK.tangerine, 1);
    g.fillRect(b.x + 4, b.y + 5, 2, b.h - 10);
    g.lineStyle(1.5, this.rallyMode ? INK.tangerine : INK.cocoa, 1);
    g.strokeRoundedRect(b.x, b.y, b.w, b.h, round);
    const caption = this.captions[i];
    this.setText(caption.name, tr(this.rallyMode ? 'rallyTap' : set ? 'rallySetShort' : 'rallyShort'));
    this.setText(caption.cost, '');
    caption.name.setColor(this.rallyMode || set ? INK_CSS.chocolate : INK_CSS.cocoa);
  }

  /** Describes the command button under the pointer: its name, role, cost and stats. */
  private drawTip() {
    const b = this.picking
      ? undefined
      : BUTTONS.find((btn) => this.pointer.x >= btn.x && this.pointer.x < btn.x + btn.w && this.pointer.y >= btn.y && this.pointer.y < btn.y + btn.h);
    if (!b) {
      this.tip.setVisible(false);
      return;
    }
    const side = this.state.sides[PLAYER];
    const { name } = this.buttonInfo(b);
    const lines = b.kind === 'research' ? researchLines(side, b.key as Track)
      : b.key === 'flagship' ? flagshipLines(side)
      : b.key === 'rally' ? rallyLines()
      : b.kind === 'command' ? fallBackLines()
      : b.key === 'expansion' ? expansionLines(side)
      : b.kind === 'build' ? buildingLines(side, b.key as Role) : unitLines(side, b.key as UnitId);
    const text = [`${name} · ${tr(ROLE_LABEL[b.key])}`, ...lines].join('\n');
    if (this.tip.text !== text) this.tip.setText(text);
    // Above the command bar, so the tip never covers the buttons it describes.
    this.tip.setPosition(Phaser.Math.Clamp(b.x, 4, VIEW.w - this.tip.width - 4), BAR.y - 6).setVisible(true);
  }

  /** The caption and crystal cost a button shows for the player's faction. */
  buttonInfo(b: Button): { name: string; cost: number } {
    const side = this.state.sides[PLAYER];
    if (b.kind === 'research') return { name: tr(TRACK_DEFS[b.key as Track].name), cost: researchCost(side, b.key as Track) };
    if (b.key === 'flagship') return { name: flagshipStats(side).name, cost: flagshipStats(side).cost };
    if (b.key === 'rally') return { name: tr('rallyName'), cost: 0 };
    if (b.kind === 'command') return { name: tr('fallBackName'), cost: 0 };
    if (b.kind === 'build') {
      const stats = buildInfo(side, b.key as Build);
      return { name: stats.name, cost: stats.cost };
    }
    const stats = unitStats(side, b.key as UnitId);
    return { name: stats.name, cost: stats.cost };
  }

  private setText(t: Phaser.GameObjects.Text, value: string) {
    if (t.text !== value) t.setText(value);
  }

  /** The top bar: faction, crystal (with the gain flash), counts, clock, the contract pill and the rivals. */
  private drawTop() {
    const s = this.state;
    const side = s.sides[PLAYER];
    const h = this.hud;
    const g = this.uiGfx;
    const sec = Math.floor(s.elapsedMs / 1000);
    const faction = this.picking ? tr('gameTitle') : tr(side.def.name).toUpperCase();
    if (h.faction.text !== faction) {
      // A long name shrinks to stay clear of the crystal count.
      h.faction.setText(faction).setFontSize(14);
      for (let size = 13; h.faction.width > FACTION_W && size >= 10; size--) h.faction.setFontSize(size);
    }
    this.setText(h.crystal, formatNumber(side.crystal));
    this.setText(h.gain, `+${formatNumber(this.flash.amount)}`);
    h.gain.setVisible(this.flash.ms > 0).setX(h.crystal.x + h.crystal.width + 6);
    this.setText(h.harvesters, tr('harvesters', { n: s.count(PLAYER, 'harvester') }));
    this.setText(h.army, tr('army', { n: s.fleet().length }));
    this.setText(h.clock, `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`);

    // The contract pill: a tangerine tag, then the contract's title, progress and reward on cream.
    const c = s.currentContract();
    const step = s.contract.index;
    g.fillStyle(INK.cream, 1);
    g.fillRoundedRect(CONTRACT_PILL.x, 4, 308, 21, 10.5);
    g.fillStyle(INK.tangerine, 1);
    g.fillRoundedRect(CONTRACT_PILL.x, 4, 90, 21, 10.5);
    g.lineStyle(1.5, INK.mustard, 1);
    g.strokeRoundedRect(CONTRACT_PILL.x, 4, 308, 21, 10.5);
    // Watching, no contract runs, so the pill says so rather than showing the first one.
    if (s.watch) {
      this.setText(h.tag, tr('watchingTag'));
      this.setText(h.title, tr('noContractsWatching'));
      this.setText(h.count, '');
    } else if (c) {
      this.setText(h.tag, tr('contractTag', { step: step + 1, steps: CONTRACT_STEPS }));
      this.setText(h.title, c.title(side.def));
      this.setText(h.count, `${Math.floor(s.contract.progress)}/${c.target}  ◆+${c.reward}`);
    } else if (s.contract.offer.length) {
      this.setText(h.tag, tr('contractTag', { step: step + 1, steps: CONTRACT_STEPS }));
      this.setText(h.title, tr('pickOnBoard'));
      this.setText(h.count, tr('seconds', { n: Math.ceil(s.contract.boardMs / 1000) }));
    } else {
      this.setText(h.tag, tr('contractsDoneTag'));
      this.setText(h.title, tr('everyContractDone'));
      this.setText(h.count, '');
    }
    h.title.setFontSize(11);
    if (h.title.x + h.title.width > h.count.x - h.count.width - 6) h.title.setFontSize(10);

    // Rivals: a dot in each rival's colour, hollow once it has fallen. The area opens the rivals panel; it glows while a truce is offered.
    if (s.sides.some((r) => r.index !== PLAYER && r.offerMs > 0) && !this.picking) {
      g.fillStyle(INK.mustard, 0.35 + (settings.reduceMotion ? 0 : 0.25 * Math.sin(this.clock / 200)));
      g.fillRoundedRect(RIVALS_TAB.x, 3, RIVALS_TAB.w - 4, 23, 6);
    }
    s.sides.forEach((r, k) => {
      if (r.index === PLAYER) return;
      const x = GROW.dx + 862 + (k - 1) * 15;
      g.fillStyle(r.def.color, r.alive ? 1 : 0.15);
      g.fillCircle(x, 15, 5.5);
      g.lineStyle(1.5, INK.cream, r.alive ? 0.9 : 0.4);
      g.strokeCircle(x, 15, 5.5);
    });
    this.setText(h.rivalCount, String(s.sides.filter((f) => f.index !== PLAYER && f.alive).length));
  }

  /** The command bar's right side: the selection or the latest message, and the contract panel. */
  private drawText() {
    const s = this.state;
    const side = s.sides[PLAYER];
    let line = this.message;
    if (this.picking) {
      line = tr('hintPick');
    } else if (this.placing === 'expansion') {
      line = tr('hintPlaceOutpost', { name: buildInfo(side, 'expansion').name });
    } else if (this.placing) {
      line = tr('hintPlace', { name: tr(side.def.buildings[this.placing].name) });
    } else if (!line) {
      line = tr('hintPlay');
    }
    if (this.selected.size === 1) {
      const u = s.unit([...this.selected][0]);
      if (u) {
        line = tr('selectedOne', {
          name: tr(u.flagship ? side.def.flagship.name : side.def.units[u.type].name),
          role: tr(ROLE_LABEL[u.flagship ? 'flagship' : u.type]),
          hp: Math.ceil(u.hp),
          max: u.maxHp,
          line,
        });
      }
    } else if (this.selected.size) {
      line = tr('selectedMany', { n: this.selected.size, line });
    }
    this.setText(this.panel.line, line);

    // The contract panel: a tangerine header, then the goal, a progress bar, the reward and the perk.
    const g = this.uiGfx;
    const x = PANEL_X;
    const w = VIEW.w - x - 8;
    g.fillStyle(INK.cream, 1);
    g.fillRoundedRect(x, BAR.y + 33, w, 62, 6);
    g.fillStyle(INK.tangerine, 1);
    g.fillRoundedRect(x, BAR.y + 33, w, 16, { tl: 6, tr: 6, bl: 0, br: 0 });
    g.fillStyle(INK.mustard, 1);
    g.fillRect(x, BAR.y + 49, w, 2);
    const c = s.currentContract();
    const step = s.contract.index;
    const p = this.panel;
    if (s.watch) {
      this.setText(p.head, tr('watchingTag'));
      this.setText(p.next, '');
      this.setText(p.brief, tr('noContractsWatching'));
      this.setText(p.count, '');
      this.setText(p.reward, '');
      this.setText(p.perk, '');
    } else if (c) {
      this.setText(p.head, tr('contractHead', { step: step + 1, steps: CONTRACT_STEPS }));
      this.setText(p.next, step + 1 < CONTRACT_STEPS ? tr('nextFromBoard') : tr('lastContract'));
      this.setText(p.brief, c.brief(side.def));
      const ratio = Math.min(1, s.contract.progress / c.target);
      g.fillStyle(INK.creamDim, 1);
      g.fillRoundedRect(x + 8, BAR.y + 69, 156, 8, 4);
      g.fillStyle(INK.green, 1);
      g.fillRoundedRect(x + 8, BAR.y + 69, Math.max(8, 156 * ratio), 8, 4);
      this.setText(p.count, tr('progress', { n: Math.floor(s.contract.progress), target: c.target }));
      this.setText(p.reward, tr('reward', { n: c.reward }));
      this.setText(p.perk, tr('rankPerk', { rank: RANKS[step], perk: c.perk(side.def) }));
    } else if (s.contract.offer.length) {
      this.setText(p.head, tr('boardHead', { step: step + 1, steps: CONTRACT_STEPS }));
      this.setText(p.next, tr('seconds', { n: Math.ceil(s.contract.boardMs / 1000) }));
      this.setText(p.brief, tr('pickOfTwo'));
      this.setText(p.count, '');
      this.setText(p.reward, '');
      this.setText(p.perk, tr('firstTaken'));
    } else {
      this.setText(p.head, tr('contractsComplete'));
      this.setText(p.next, '');
      this.setText(p.brief, tr('allDone'));
      this.setText(p.count, '');
      this.setText(p.reward, '');
      this.setText(p.perk, tr('rankFive'));
    }

    const end = s.watch && s.phase === 'won'
      ? tr('watchWins', { faction: s.sides[s.winner] ? tr(s.sides[s.winner].def.name).toUpperCase() : tr('nobody') })
      : s.phase === 'won' ? this.victoryText() : s.phase === 'lost' ? tr('defeat', { n: s.sector + 1 }) : '';
    this.setText(this.overlay, end);
    this.overlay.setVisible(end !== '').setFontSize(this.keepCards.length ? 34 : 44)
      .setY(this.keepCards.length ? KEEP.y - 70 : MAP_VIEW.y + MAP_VIEW.h / 2);
  }

  /** The victory overlay's words: the sector won, and what to tap next. */
  private victoryText() {
    const s = this.state;
    const last = s.sector >= SECTORS.length - 1;
    const head = last ? tr('campaignWon') : tr('victory', { n: s.sector + 1 });
    const next = last ? tr('everySector') : tr('sectorOpen', { n: s.sector + 2 });
    return tr(this.keepCards.length ? 'keepOne' : 'tapOn', { head, next });
  }

  /** The perks the player can keep after a campaign victory: one per contract done this battle. */
  private keepable(): Goal[] {
    const s = this.state;
    return s.phase === 'won' && !s.watch ? [...new Set(s.contract.done)] : [];
  }

  /** After a campaign victory, a card for each perk earned this battle; tapping one keeps it. */
  private drawKeep() {
    const goals = this.keepable();
    const g = this.pickGfx;
    const side = this.state.sides[PLAYER];
    const total = goals.length * KEEP.w + Math.max(0, goals.length - 1) * KEEP.gap;
    this.keepCards = goals.map((goal, k) => ({ x: (VIEW.w - total) / 2 + k * (KEEP.w + KEEP.gap), y: KEEP.y, w: KEEP.w, h: KEEP.h, goal }));
    this.keepTexts.forEach((t, k) => {
      const card = this.keepCards[k];
      t.title.setVisible(!!card);
      t.sub.setVisible(!!card);
      if (!card) return;
      g.fillStyle(0x000000, 0.4);
      g.fillRoundedRect(card.x + 3, card.y + 4, card.w, card.h, 10);
      g.fillStyle(INK.cream, 1);
      g.fillRoundedRect(card.x, card.y, card.w, card.h, 10);
      g.fillStyle(INK.tangerine, 1);
      g.fillRect(card.x + 6, card.y + 8, 3, card.h - 16);
      g.lineStyle(2, INK.cocoa, 1);
      g.strokeRoundedRect(card.x, card.y, card.w, card.h, 10);
      const rank = RANKS[this.state.contract.done.indexOf(card.goal)];
      this.setText(t.title, tr('keepRank', { rank }));
      this.setText(t.sub, contractOf(card.goal).perk(side.def));
      t.title.setPosition(card.x + 16, card.y + 8);
      t.sub.setPosition(card.x + 16, card.y + 26);
    });
  }

  /**
   * The contract board, while it is up: a header with the countdown over two cards, each with the
   * contract's title, reward, rank perk and goal. The first is taken when the time runs out. It
   * stands aside while the rivals panel is open, which it would overlap (the top bar's pill keeps
   * the countdown).
   */
  private drawBoard() {
    const s = this.state;
    const c = s.contract;
    const show = !this.picking && !s.watch && !this.rivalsOpen && s.phase === 'playing' && !c.goal && c.offer.length > 0;
    this.boardHead.setVisible(show);
    const total = c.offer.length * BOARD.w + (c.offer.length - 1) * BOARD.gap;
    this.boardCards = show ? c.offer.map((goal, k) => ({ x: (VIEW.w - total) / 2 + k * (BOARD.w + BOARD.gap), y: BOARD.cardY, w: BOARD.w, h: BOARD.h, goal })) : [];
    this.boardTexts.forEach((t, k) => {
      const card = this.boardCards[k];
      t.title.setVisible(!!card);
      t.sub.setVisible(!!card);
      if (!card) return;
      const g = this.pickGfx;
      const contract = contractOf(card.goal);
      const def = s.sides[PLAYER].def;
      const hover = this.pointer.x >= card.x && this.pointer.x < card.x + card.w && this.pointer.y >= card.y && this.pointer.y < card.y + card.h;
      g.fillStyle(0x000000, 0.4);
      g.fillRoundedRect(card.x + 3, card.y + 4, card.w, card.h, 10);
      g.fillStyle(hover ? INK.mustard : INK.cream, 1);
      g.fillRoundedRect(card.x, card.y, card.w, card.h, 10);
      g.fillStyle(INK.tangerine, 1);
      g.fillRect(card.x + 6, card.y + 8, 3, card.h - 16);
      g.lineStyle(2, k === 0 ? INK.tangerine : INK.cocoa, 1);
      g.strokeRoundedRect(card.x, card.y, card.w, card.h, 10);
      this.setText(t.title, tr('boardTitle', { title: contract.title(def), n: contract.reward }));
      this.setText(t.sub, tr('boardSub', { rank: RANKS[c.index], perk: contract.perk(def), task: contract.task() }));
      t.title.setPosition(card.x + 16, card.y + 7);
      t.sub.setPosition(card.x + 16, card.y + 25);
    });
    if (show) this.setText(this.boardHead, tr('boardHeader', { rank: RANKS[c.index], s: Math.ceil(c.boardMs / 1000) }));
  }

  /** The last-stand pact's banner on the map's top left: the countdown to the rivals' next raid. */
  private drawPact() {
    const pact = this.state.pact;
    const show = !!pact && !this.picking && this.state.phase === 'playing';
    this.pactBanner.setVisible(show);
    if (!show) return;
    const sec = Math.ceil(pact.ms / 1000);
    this.setText(this.pactBanner, tr(pact.waves ? 'pactBannerNext' : 'pactBanner', { time: `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` }));
  }

  /** The convoy contract: a mustard ring on the convoy's field and a dashed trail from each convoy harvester to it. */
  private drawConvoy() {
    const to = this.state.convoyTo;
    this.convoyLabel.setVisible(!!to && !this.picking);
    if (!to) return;
    const g = this.underGfx;
    dashedCircle(g, to.x, to.y, 26, 16, INK.mustard, 0.9, 2);
    for (const u of this.state.units) {
      if (!u.convoy) continue;
      g.lineStyle(1.5, INK.mustard, 0.45);
      g.lineBetween(u.x, u.y, to.x, to.y);
      dashedCircle(g, u.x, u.y, 14, 8, INK.mustard, 0.9, 1.5);
    }
    this.convoyLabel.setPosition(to.x + 22, to.y + 18);
  }

  /** The faction picker: a dark veil over the map and a cream card for each faction. */
  private drawPicker() {
    const show = this.picking;
    this.pickTitle.setVisible(show);
    this.pickTexts.forEach((t) => {
      t.name.setVisible(show);
      t.body.setVisible(show);
    });
    this.pickImages.forEach((i) => i.setVisible(show));
    const st = this.sectorTexts;
    [st.title, st.body, st.kept, ...st.names].forEach((x) => x.setVisible(show && !watching));
    if (!show) return;
    const g = this.pickGfx;
    g.fillStyle(0x140a1c, 0.72);
    g.fillRect(MAP_VIEW.x, MAP_VIEW.y, MAP_VIEW.w, MAP_VIEW.h);
    if (!watching) this.drawSectors();
    for (const c of this.pickCards) {
      const def = FACTIONS[c.faction];
      g.fillStyle(0x000000, 0.4);
      g.fillRoundedRect(c.x + 3, c.y + 4, c.w, c.h, 12);
      g.fillStyle(INK.cream, 1);
      g.fillRoundedRect(c.x, c.y, c.w, c.h, 12);
      g.fillStyle(INK.chocolate, 1);
      g.fillRoundedRect(c.x, c.y, c.w, 30, { tl: 12, tr: 12, bl: 0, br: 0 });
      stripes(g, c.x, c.y + 30, c.w, 6);
      g.fillStyle(def.color, 1);
      g.fillCircle(c.x + c.w - 16, c.y + 15, 6);
      g.fillStyle(def.color, 0.2);
      g.fillEllipse(c.x + c.w / 2, c.y + 86, 110, 52);
      g.lineStyle(2, INK.cocoa, 1);
      g.strokeRoundedRect(c.x, c.y, c.w, c.h, 12);
    }
  }

  /**
   * The sector campaign under the picker's cards: the chosen sector's name and what makes it hard,
   * a chain of five sector nodes (won ones gold, open ones cream, locked ones dim) and the perks
   * the campaign carries into this sector.
   */
  private drawSectors() {
    const g = this.pickGfx;
    const st = SECTOR_STRIP;
    const t = this.sectorTexts;
    const c = this.campaign;
    g.fillStyle(INK.chocolate, 0.92);
    g.fillRoundedRect(st.x, st.y, st.w, st.h, 10);
    g.lineStyle(1.5, INK.mustard, 0.8);
    g.strokeRoundedRect(st.x, st.y, st.w, st.h, 10);
    const sector = SECTORS[this.sector];
    this.setText(t.title, tr('sectorTitle', { n: this.sector + 1, name: tr(sector.name).toUpperCase() }));
    this.setText(t.body, sectorText(sector));
    // Before a faction is picked, a turret perk names the generic Turret.
    const turret = tr(FACTIONS[0].buildings.turret.name);
    const kept = keptFor(c, this.sector).map((goal) => contractOf(goal).perk(FACTIONS[0]).replace(turret, tr('roleTurret')));
    this.setText(t.kept, kept.length ? tr('keptPerks', { perks: kept.join(' · ') }) : tr('winToKeep'));
    const first = this.sectorNodes[0];
    const last = this.sectorNodes[this.sectorNodes.length - 1];
    g.lineStyle(3, INK.cocoa, 1);
    g.lineBetween(first.x, first.y, last.x, last.y);
    this.sectorNodes.forEach((n, k) => {
      const open = k < c.unlocked;
      const won = k < c.kept.length;
      if (k > 0 && open) {
        g.lineStyle(3, INK.mustard, 1);
        g.lineBetween(this.sectorNodes[k - 1].x, n.y, n.x, n.y);
      }
      g.fillStyle(won ? INK.mustard : open ? INK.cream : INK.cocoa, 1);
      g.fillCircle(n.x, n.y, n.r);
      g.lineStyle(k === this.sector ? 3 : 1.5, k === this.sector ? INK.tangerine : INK.chocolate, 1);
      g.strokeCircle(n.x, n.y, k === this.sector ? n.r + 3 : n.r);
      this.setText(t.names[k], tr('sectorNode', { n: k + 1, name: tr(SECTORS[k].name) }));
      t.names[k].setColor(open ? INK_CSS.cream : INK_CSS.creamDim);
    });
  }

  /** The midpoint of the two fingers down on the screen, in view pixels, or null unless two are down. */
  private twoFingers() {
    const down = [this.input.pointer1, this.input.pointer2].filter((t) => t?.isDown);
    if (down.length < 2) return null;
    const [a, b] = down.map((t) => viewPoint(t));
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  private onDown(pointer: Phaser.Input.Pointer) {
    const p = viewPoint(pointer);
    // A second finger on the map turns the first one's box into a two-finger scroll.
    const mid = this.state.phase === 'playing' && !this.picking && this.inMap(p.x, p.y) ? this.twoFingers() : null;
    if (mid) {
      this.touchPan = mid;
      this.drag = null;
      return;
    }
    const inside = (r: { x: number; y: number; w: number; h: number }) => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;
    if (this.state.phase !== 'playing') {
      // A campaign victory keeps the tapped perk and opens the next sector; with nothing to keep any tap goes on.
      if (this.state.phase === 'won' && !watching) {
        const keep = this.keepCards.find(inside);
        if (this.keepCards.length && !keep) return;
        this.campaign = winSector(this.campaign, this.state.sector, keep?.goal ?? null);
        saveCampaign(this.campaign);
      }
      ui('click');
      this.newGame(this.state.phase === 'won');
      return;
    }
    // A press on the minimap centres the map there, and dragging it keeps following.
    if (!this.picking && inside(MINIMAP)) {
      const at = this.fromMini(p.x, p.y);
      this.centreOn(at.x, at.y);
      this.miniDrag = true;
      return;
    }
    // Watching, the AI gives every order; the map still pans.
    if (watching) return;
    if (this.picking) {
      const card = this.pickCards.find(inside);
      if (card) {
        ui('click');
        this.startBattle(card.faction);
      }
      // An open sector's node picks where the next battle is fought, on a map of its own.
      const node = this.sectorNodes.find((n) => Math.hypot(p.x - n.x, p.y - n.y) <= n.r + 6);
      if (node && node.sector < this.campaign.unlocked && node.sector !== this.sector) {
        ui('click');
        this.sector = node.sector;
        this.makeMap();
      }
      return;
    }
    // The right button cancels, even over the contract board.
    if (pointer.rightButtonDown()) {
      this.placing = null;
      this.rallyMode = false;
      this.selected.clear();
      this.rivalsOpen = false;
      return;
    }
    // A card on the contract board picks the next contract.
    const contract = this.boardCards.find(inside);
    if (contract) {
      const reason = this.state.pickContract(contract.goal);
      if (reason) {
        this.message = reason;
        ui('refuse');
      }
      return;
    }
    // The army count on the top bar selects every warship.
    if (p.y < TOP.h && p.x >= ARMY_TAB.x && p.x < ARMY_TAB.x + ARMY_TAB.w) {
      this.selectFleet();
      return;
    }
    // The rivals area of the top bar opens the panel; its buttons answer offers and pay tribute.
    if (p.y < TOP.h && p.x >= RIVALS_TAB.x) {
      this.rivalsOpen = !this.rivalsOpen;
      ui('click');
      return;
    }
    if (this.rivalsOpen) {
      const rb = this.rivalButtons.find((b) => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h);
      if (rb) {
        const reason = rb.action === 'accept' ? this.state.acceptTruce(rb.faction)
          : rb.action === 'decline' ? this.state.declineTruce(rb.faction) : this.state.bribe(rb.faction);
        if (reason) {
          this.message = reason;
          ui('refuse');
        } else if (rb.action === 'decline') {
          this.message = tr('truceDeclined');
          ui('click');
        }
        return;
      }
      const rp = RIVALS_PANEL;
      const h = rp.head + (this.state.sides.length - 1) * rp.row + 6;
      if (p.x >= rp.x && p.x < rp.x + rp.w && p.y >= rp.y && p.y < rp.y + h) return;
    }
    if (p.y >= BAR.y) {
      const b = BUTTONS.find((btn) => p.x >= btn.x && p.x < btn.x + btn.w && p.y >= btn.y && p.y < btn.y + btn.h);
      if (b) this.press(b);
      return;
    }
    if (!this.inMap(p.x, p.y)) return;
    // An edge arrow jumps the map to its attack.
    const mark = this.edgeMarks.find((m) => Math.hypot(m.x - p.x, m.y - p.y) <= 16);
    if (mark) {
      this.jumpToAlert(mark.alert);
      return;
    }
    if (this.rallyMode) {
      const at = this.toWorld(p.x, p.y);
      const rally = this.state.sides[PLAYER].rally;
      this.rallyMode = false;
      if (rally && Math.hypot(rally.x - at.x, rally.y - at.y) <= RALLY_GRAB) {
        this.state.clearRally();
        this.message = tr('rallyCleared');
        sfx('rallyClear');
      } else {
        this.state.setRally(at.x, at.y);
        this.message = tr('rallyPlanted');
        sfx('rally');
      }
      return;
    }
    if (this.placing) {
      const at = this.toWorld(p.x, p.y);
      const problem = this.state.build(this.placing, at.x, at.y);
      if (problem) {
        this.message = problem;
        ui('refuse');
      } else {
        this.message = tr('started', { name: buildInfo(this.state.sides[PLAYER], this.placing).name });
        this.placing = null;
        sfx('place');
      }
      return;
    }
    this.drag = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  }

  private onMove(pointer: Phaser.Input.Pointer) {
    const p = viewPoint(pointer);
    this.pointer = p;
    if (this.touchPan) {
      const mid = this.twoFingers();
      if (mid) {
        this.scrollTo(this.camera.scrollX - (mid.x - this.touchPan.x), this.camera.scrollY - (mid.y - this.touchPan.y));
        this.touchPan = mid;
      }
      return;
    }
    if (this.miniDrag) {
      const at = this.fromMini(Phaser.Math.Clamp(p.x, MINIMAP.x, MINIMAP.x + MINIMAP.w), Phaser.Math.Clamp(p.y, MINIMAP.y, MINIMAP.y + MINIMAP.h));
      this.centreOn(at.x, at.y);
      return;
    }
    if (this.drag) {
      this.drag.x1 = p.x;
      this.drag.y1 = p.y;
    }
  }

  private onUp(pointer: Phaser.Input.Pointer) {
    const p = viewPoint(pointer);
    const d = this.drag;
    this.drag = null;
    if (this.miniDrag) {
      this.miniDrag = false;
      return;
    }
    // Lifting either finger ends a two-finger scroll; the other finger's lift is not a tap.
    if (this.touchPan) {
      if (!this.twoFingers()) this.touchPan = null;
      return;
    }
    if (!d || this.state.phase !== 'playing') return;
    if (Math.hypot(p.x - d.x0, p.y - d.y0) >= DRAG_MIN) {
      const a = this.toWorld(d.x0, d.y0);
      const b = this.toWorld(p.x, p.y);
      this.selected = new Set(this.state.selectableIn(a.x, a.y, b.x, b.y));
      this.message = '';
      if (this.selected.size) sfx('select');
      return;
    }
    if (this.inMap(p.x, p.y)) this.tapMap(p.x, p.y);
  }

  /** A tap on the map, in view pixels: select a combat unit, or command the selection to attack or move. */
  private tapMap(x: number, y: number) {
    const at = this.toWorld(x, y);
    const hit = this.state.entityAt(at.x, at.y);
    if (hit?.kind === 'unit' && hit.faction === PLAYER && this.state.selectable(hit.id)) {
      this.selected = new Set([hit.id]);
      this.message = '';
      sfx('select');
      return;
    }
    if (!this.selected.size) return;
    if (!this.state.command([...this.selected], at.x, at.y)) {
      this.message = tr('harvestersOwn');
      ui('refuse');
      return;
    }
    const bc = this.state.beacon;
    const attack = !!hit && hit.faction !== PLAYER;
    sfx(attack ? 'attack' : 'move');
    this.message = attack
      ? tr('attacking')
      : Math.hypot(at.x - bc.x, at.y - bc.y) <= BEACON_RADIUS ? tr('movingBeacon') : tr('moving');
  }

  /** A press on a command bar button: arm a building, or queue a unit. */
  private press(b: Button) {
    const { name, cost } = this.buttonInfo(b);
    if (b.key === 'rally') {
      this.rallyMode = !this.rallyMode;
      this.placing = null;
      if (this.rallyMode) this.message = tr('rallyHow');
      ui('click');
      return;
    }
    if (b.key === 'flagship') {
      const reason = this.state.buildFlagship();
      this.message = reason ?? tr('flagshipStarted', { name, s: FLAGSHIP_MS / 1000 });
      if (reason) ui('refuse');
      else sfx('queue');
      return;
    }
    if (b.kind === 'command') {
      const sent = this.selected.size > 0 && this.state.fallBack([...this.selected]);
      this.message = this.selected.size === 0 ? tr('selectFirst') : sent ? tr('fallingBack') : tr('nowhere');
      if (sent) sfx('fallBack');
      else ui('refuse');
      return;
    }
    if (b.kind === 'research') {
      const reason = this.state.research(b.key as Track);
      this.message = reason ?? tr('researchStarted', { name });
      if (reason) ui('refuse');
      else sfx('queue');
      return;
    }
    if (b.kind === 'build') {
      if (this.placing === b.key) {
        this.placing = null;
        ui('click');
      } else if (this.state.sides[PLAYER].crystal < cost) {
        this.message = tr('notEnoughCrystal');
        ui('refuse');
      } else {
        this.placing = b.key as Build;
        this.rallyMode = false;
        this.message = '';
        ui('click');
      }
      return;
    }
    const reason = this.state.train(b.key as UnitId);
    this.message = reason ?? tr('queued', { name });
    if (reason) ui('refuse');
    else sfx('queue');
  }
}
