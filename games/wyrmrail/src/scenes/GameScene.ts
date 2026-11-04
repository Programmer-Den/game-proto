import Phaser from 'phaser';
import { dailyRand, finishDaily, loadDaily, startDaily, today } from '../../../../shared/daily';
import { formatNumber, t as sharedText } from '../../../../shared/i18n';
import { settings } from '../../../../shared/settings';
import { t, type TextKey } from '../i18n';
import { CARGO_NAMES, COLS, ROOST, ROWS, inGrid, key, terrainAt, terrainCost, type Tile } from '../game/map';
import {
  arms,
  boonNames,
  buildTrack,
  buyDepot,
  buyLamp,
  buyUpgrade,
  UPGRADE_NAMES,
  buyWarehouse,
  canBuyWarehouse,
  isLit,
  rivalFlyovers,
  isNight,
  canBuyDepot,
  canRemove,
  canSendCourier,
  choosing,
  depotCost,
  depotLocked,
  dispatch,
  festivalHost,
  isCrossing,
  jobOrder,
  moodOf,
  onLine,
  newGame,
  openVillages,
  orderPay,
  pickCharter,
  pickMoult,
  removeTrack,
  routable,
  secondWyrmRound,
  sendCourier,
  throwSwitch,
  tick,
  trackCost,
  upgradeCost,
  upgradeLocked,
  villageAt,
  villages,
  wagons,
  workshopOf,
  type Journey,
} from '../game/sim';
import { saveMedal, loadMedals } from '../game/medals';
import {
  COURIER_COST,
  DEPOT_ROUND,
  FESTIVAL_GOAL,
  FESTIVAL_ROUND,
  HAZARD_TEXT,
  HUNGRY,
  KIND_TEXT,
  LAMP_COST,
  LAMP_ROUND,
  RIVAL_CLAIM_MS,
  WAREHOUSE_COST,
  MOOD_PAY,
  MOOD_ROUND,
  POP_MS,
  TRAIT_TEXT,
  UPGRADE_COSTS,
  isPassengers,
  kindOfLeg,
  roundGoal,
  type GameState,
  type Order,
  type Upgrade,
  type Wyrm,
} from '../game/state';
import { RAIL, WOOD } from '../art/palette';
import { fit } from '../art/canvas';
import { LOAD_LIFT, PART_ORIGIN } from '../art/sprites';
import { PROP, bakeValley } from '../art/valley';
import { makeButton } from '../ui/Button';
import { ui } from '../../../../shared/audio';
import { viewSize } from '../../../../shared/scaling';
import { GameSounds } from '../audio/events';
import { sfx } from '../audio/sounds';
import { checkTrophies } from '../trophies/check';
import {
  BOARD,
  BUTTONS,
  CHARTER_CARD,
  DAILY_LINK,
  DESIGN_BOARD,
  END_BUTTON,
  MOULT_CARD,
  FONT,
  HINT_BOTTOM,
  HUD_HEIGHT,
  ORDER_CARD,
  PANEL,
  SEGMENT_GAPS,
  UI_DEPTH,
  UPGRADES_Y,
  VIEW,
  groundDepth,
  iso,
  placeBoard,
  tileAt,
  tileCenter,
} from './layout';

/** The hint line's font size, the smallest it shrinks to, the room it keeps clear of the shared corner buttons, and the corner's width when it can't be measured. */
const HINT_PX = 13;
const MIN_HINT_PX = 10;
const HINT_GAP = 10;
const CORNER_FALLBACK = 120;
/** How often the corner buttons' reach is measured again, in ms. */
const HINT_CHECK_MS = 500;

/** The tok of new track by terrain: a bridge sounds hollow, a tunnel deep. */
const TOK_PITCH: Record<ReturnType<typeof terrainAt>, number> = { grass: 1, forest: 0.88, river: 0.72, mountain: 0.6 };

/** The name the daily valley keeps its record under (`wyrmrail-daily`, `shared/daily.ts`). */
const GAME = 'wyrmrail';

/** Longest simulated step, so a backgrounded tab doesn't jump the game forward. */
const MAX_STEP_MS = 250;

/** Where an order card is on screen; read by the playthrough test to tap it. */
export interface OrderSpot {
  id: number;
  x: number;
  y: number;
}

const textStyle = (size: number, color = '#f3e9d2') => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  color,
  stroke: '#1d1a14',
  strokeThickness: 4,
});

const STATUS_TEXT: Record<Order['status'], TextKey> = {
  waiting: 'tapToSend',
  queued: 'queued',
  loading: 'loading',
  carrying: 'onTheWay',
};

type Button = ReturnType<typeof makeButton>;

/** What draws one wyrm: its head, three coils and two wagons, front to back, and the trail they follow. */
interface WyrmView {
  segments: Phaser.GameObjects.Image[];
  wings: Phaser.GameObjects.Image;
  wagonCargo: Phaser.GameObjects.Image[];
  /** Where the head has been, newest first; the coils and the wagons follow it. */
  trail: { x: number; y: number }[];
  headAngle: number;
}

/** Each wyrm's colour for its planned route and its belly bar: the green wyrm, then the copper one. */
const WYRM_COLORS = [0x9be883, 0xf0a060];

/** A village's mood bubble, from bitter to delighted: its colour and its mouth (down, flat or up). */
const MOOD_LOOKS: { color: number; mouth: number }[] = [
  { color: 0xe0584f, mouth: -1 },
  { color: 0xe8b040, mouth: -1 },
  { color: 0xb8b0a0, mouth: 0 },
  { color: 0x9be883, mouth: 1 },
  { color: 0x5ad06a, mouth: 1 },
];

/** How taps on the valley act: laying track that joins its neighbours, plain track, taking track up, or building a depot at a village. */
type Mode = 'auto' | 'plain' | 'remove' | 'depot';

/** A tile from a track key (`c,r`). */
const tileOfKey = (k: string): Tile => {
  const [c, r] = k.split(',').map(Number);
  return { c, r };
};

/** Minutes and seconds of game time, like 2:05. */
const clock = (ms: number) => `${Math.floor(ms / 60_000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;

export class GameScene extends Phaser.Scene {
  /** The game being played; read by the playthrough test. */
  state!: GameState;
  /** The order cards on the panel; read by the playthrough test. */
  orderSpots: OrderSpot[] = [];

  private mode: Mode = 'auto';
  private lastFrame = 0;
  private dragTile: string | null = null;
  /** The last tile track was laid on, which plain track continues from. */
  private lastLaid: Tile | null = null;
  /** The village a tap went down on, for a courier call when it comes up there without dragging off. */
  private pressedVillage: number | null = null;
  /** The track tile a tap went down on, for a lamp when it comes up there without dragging off. */
  private pressedTrack: Tile | null = null;
  /** Whether this game's festival medal has been saved. */
  private medalSaved = false;
  /** Plays what the sim did each frame, and the music. */
  private sounds!: GameSounds;
  /** Tiles of track laid in this drag, which raise the tok's pitch. */
  private dragLaid = 0;

  private hints!: Phaser.GameObjects.Graphics;
  private rails!: Phaser.GameObjects.Graphics;
  private trackKey = '';
  /** The Roost and the villages, each with its name and, for a workshop, a sign of what it makes. */
  private stations: {
    sprite: Phaser.GameObjects.Image;
    label: Phaser.GameObjects.Text;
    sign?: Phaser.GameObjects.Container;
    /** A village's tower once it has grown into a town, and its warehouse's icon. */
    tower?: Phaser.GameObjects.Image;
    warehouse?: Phaser.GameObjects.Image;
    round: number;
  }[] = [];
  /** Night (WR19): the dark over the valley, and the glow of the lamps, the stations and the wyrms' heads in it. */
  private dark!: Phaser.GameObjects.Graphics;
  private darkKey = '';
  private glow!: Phaser.GameObjects.Graphics;
  /** Each village's mood, as a face by its name, from round `MOOD_ROUND`. */
  private moodLayer!: Phaser.GameObjects.Graphics;
  private moodKey = '';
  /** The warning over a tile a washout or a rockfall is about to take. */
  private hazardMark!: Phaser.GameObjects.Text;
  /** Each village's depot shed, by village index, shown once one is built there. */
  private depotIcons: Phaser.GameObjects.Image[] = [];
  /** The tunnel mouths, drawn in front of their mountain; redrawn with the track. */
  private portals: Phaser.GameObjects.Graphics[] = [];
  /** The pines on each forest tile, by tile key; hidden once track is laid through them. */
  private pines = new Map<string, Phaser.GameObjects.Image>();
  private markers: Phaser.GameObjects.Image[] = [];
  /** Festival bunting over the last village, shown in the last round. */
  private bunting!: Phaser.GameObjects.Image;

  private wyrmViews: WyrmView[] = [];

  private pops = new Map<number, Phaser.GameObjects.Text>();

  private coinsText!: Phaser.GameObjects.Text;
  private hearts: Phaser.GameObjects.Image[] = [];
  private roundText!: Phaser.GameObjects.Text;
  private wyrmText!: Phaser.GameObjects.Text;
  /** Each wyrm's belly, drawn as a bar by the HUD next to the food icon. */
  private bellies!: Phaser.GameObjects.Graphics;
  private hint!: Phaser.GameObjects.Text;
  /** The corner buttons' reach the hint was last placed for, and when it was last measured. */
  private hintCorner = -1;
  private hintCheck = 0;

  private cards: Phaser.GameObjects.Container[] = [];
  private cardKey = '';
  private timers!: Phaser.GameObjects.Graphics;
  private wingsButton!: Button;
  private hoardButton!: Button;
  private secondButton!: Button;
  private depotButton!: Button;
  private removeButton!: Button;
  private plainButton!: Button;
  /** The round's two charters to choose from, over the board. */
  private charterLayer!: Phaser.GameObjects.Container;
  private charterTitle!: Phaser.GameObjects.Text;
  private charterCards: { name: Phaser.GameObjects.Text; text: Phaser.GameObjects.Text }[] = [];
  private charterKey = '';
  /** A moult's traits to choose from, over the board (WR16). */
  private moultLayer!: Phaser.GameObjects.Container;
  private moultTitle!: Phaser.GameObjects.Text;
  private moultCards: { bg: Phaser.GameObjects.Rectangle; name: Phaser.GameObjects.Text; text: Phaser.GameObjects.Text }[] = [];
  private moultKey = '';
  /** The daily valley's link in the sky over the valley before the first track (WR17), or its tag while it is played. */
  private dailyLink!: Phaser.GameObjects.Text;
  /** Whether today's daily valley has been tried already, read when the scene starts and again after midnight. */
  private dailyPlayed = false;
  /** Today's daily score, once today's try is used (0 for a try left half way). */
  private dailyScore = 0;
  /** The day `dailyPlayed` and `dailyScore` were read for, so the link rolls over at midnight. */
  private dailyDay = '';
  /** The end panel's buttons: fly on keeping an upgrade, play again and the daily valley. */
  private endButtons!: Phaser.GameObjects.Container;

  private banner!: Phaser.GameObjects.Container;
  private bannerText!: Phaser.GameObjects.Text;
  private bannerBox!: Phaser.GameObjects.Rectangle;
  private overLayer!: Phaser.GameObjects.Container;
  private overText!: Phaser.GameObjects.Text;
  /** The view's size in game pixels: 960x540, or bigger on a screen of another shape. */
  private view = { width: VIEW.w, height: VIEW.h };

  constructor() {
    super('Game');
  }

  /** `journey` carries a chain of valleys on (WR15), or starts today's daily valley (WR17). */
  create(data: { journey?: Partial<Journey> } = {}) {
    const journey = data.journey ?? {};
    // Today's try is used up as soon as it starts, so leaving it half way still counts.
    if (journey.daily) startDaily(GAME);
    const daily = loadDaily(GAME);
    this.dailyPlayed = daily.played;
    this.dailyScore = daily.score ?? 0;
    this.dailyDay = daily.day;
    this.state = journey.daily ? newGame(null, journey, dailyRand(GAME)) : newGame(loadMedals()[settings.difficulty] ?? null, journey);
    this.mode = 'auto';
    this.lastLaid = null;
    this.pressedVillage = null;
    this.pressedTrack = null;
    this.medalSaved = false;
    this.depotIcons = [];
    this.portals = [];
    this.trackKey = '';
    this.cardKey = '';
    this.moodKey = '';
    this.charterKey = '';
    this.charterCards = [];
    this.moultKey = '';
    this.moultCards = [];
    this.stations = [];
    this.pines.clear();
    this.markers = [];
    this.wyrmViews = [];
    this.cards = [];
    this.hearts = [];
    this.pops.clear();
    this.hintCorner = -1;
    this.sounds = new GameSounds(this.state);

    // The board, the grid and the panel take the view's shape before anything is placed.
    this.view = viewSize(this);
    placeBoard(this.view.width, this.view.height);
    // Every game has a new valley, baked here over the last one.
    bakeValley(this, this.state.valley);
    fit(this.add.image(BOARD.x, BOARD.y, 'valley').setOrigin(0));
    this.rails = this.add.graphics().setDepth(1);
    this.hints = this.add.graphics().setDepth(2);
    this.createScenery();
    this.createStations();
    this.moodLayer = this.add.graphics().setDepth(UI_DEPTH - 2);
    this.dark = this.add.graphics().setDepth(UI_DEPTH - 4);
    this.darkKey = '';
    this.glow = this.add.graphics().setDepth(UI_DEPTH - 3);
    this.hazardMark = this.add.text(0, 0, '!', textStyle(26, '#f0a050')).setOrigin(0.5, 1).setDepth(UI_DEPTH - 1).setVisible(false);
    this.wyrmViews.push(this.createWyrm('wyrm'));
    this.createHud();
    this.createPanel();
    this.createOverlays();

    // A tap on a card or button (the charter cards sit over the board) is not a tap on the board.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => !over.length && this.onGridPointer(p, true));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => p.isDown && this.onGridPointer(p, false));
    this.input.on('pointerup', () => {
      this.dragTile = null;
      // A tap on a village that didn't drag off it sends a wyrm with gifts.
      if (this.pressedVillage !== null) {
        if (sendCourier(this.state, this.pressedVillage)) sfx('courier');
        else if (this.state.round >= MOOD_ROUND && this.state.phase === 'play') ui('refuse');
      }
      this.pressedVillage = null;
      // A tap on track that didn't drag off it hangs a lamp there, once lamps are sold.
      if (this.pressedTrack) {
        if (buyLamp(this.state, this.pressedTrack)) sfx('lamp');
        else if (this.state.round >= LAMP_ROUND && this.state.phase === 'play' && !this.state.lamps.includes(key(this.pressedTrack))) ui('refuse');
      }
      this.pressedTrack = null;
    });
    this.draw();
  }

  update(time: number) {
    const dt = this.lastFrame ? Math.min(time - this.lastFrame, MAX_STEP_MS) : 0;
    this.lastFrame = time;
    tick(this.state, dt);
    this.sounds.update(this.state);
    checkTrophies(this.state);
    this.draw();
    // The corner buttons change with the window (a resize, full screen, the pause button appearing): keep the hint clear of them.
    if (time - this.hintCheck > HINT_CHECK_MS) {
      this.hintCheck = time;
      const corner = Math.round(this.cornerWidth());
      if (corner !== this.hintCorner) this.placeHint();
    }
  }

  /**
   * A tap or drag on the valley lays track there, or takes it up while Remove track is on. A tap on
   * a junction throws its switch.
   */
  private onGridPointer(p: Phaser.Input.Pointer, down: boolean) {
    // The camera never scrolls, so the world point is the point in the view.
    const t = tileAt(p.worldX, p.worldY);
    const onBoard = p.worldX >= BOARD.x && p.worldX < BOARD.x + BOARD.w && p.worldY >= BOARD.y && p.worldY < BOARD.y + BOARD.h;
    // A press on a village that slides off the board or the grid is no courier call.
    if (!onBoard || !inGrid(t)) return void (this.pressedVillage = this.pressedTrack = null);
    // The game waits for a charter or moult pick: a tap on the shaded board around the cards does nothing.
    if (this.state.phase !== 'play' || choosing(this.state)) return void (this.pressedVillage = this.pressedTrack = null);
    if (!down && (this.dragTile === null || this.dragTile === key(t))) return;
    this.dragTile = key(t);
    if (down) this.dragLaid = 0;
    const s = this.state;
    const village = villageAt(s, t);
    this.pressedVillage = down && this.mode !== 'remove' && this.mode !== 'depot' ? village : null;
    this.pressedTrack = down && this.mode !== 'remove' && this.mode !== 'depot' && s.track.includes(key(t)) && !s.switches[key(t)] ? t : null;
    if (this.mode === 'depot') {
      if (!down) return;
      // A tap on a village builds its depot; on a town with a depot, its warehouse.
      if (village !== null && (buyDepot(s, village) || buyWarehouse(s, village))) {
        this.mode = 'auto';
        sfx('buy');
      } else ui('refuse');
      return;
    }
    if (this.mode === 'remove') {
      if (removeTrack(s, t)) {
        sfx('untok');
        ui('coin');
      } else if (down) ui('refuse');
      return;
    }
    if (down && throwSwitch(s, t)) return void sfx('switch');
    // Plain track continues from the line tile touched just before it (laid or already there), when that is next to it.
    if (buildTrack(s, t, this.mode === 'plain', this.lastLaid)) {
      this.lastLaid = t;
      sfx('tok', { pitch: TOK_PITCH[terrainAt(s.valley, t)] * Math.min(1.5, 1 + 0.05 * this.dragLaid++) });
    } else if (onLine(s, t)) this.lastLaid = t;
    else if (down) ui('refuse');
  }

  /** A prop standing on a tile, sorted with the wyrm by where it touches the ground. */
  private addProp(t: Tile, texture: string) {
    const { x, y } = tileCenter(t);
    return fit(this.add.image(x, y, texture).setOrigin(PROP.x / PROP.w, PROP.y / PROP.h).setDepth(groundDepth(y)));
  }

  /** The pines and the mountains. */
  private createScenery() {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const terrain = terrainAt(this.state.valley, { c, r });
        if (terrain === 'forest') this.pines.set(key({ c, r }), this.addProp({ c, r }, 'forest'));
        // A canyon's mountains are red mesas.
        if (terrain === 'mountain') this.addProp({ c, r }, this.state.valley.kind === 'canyon' ? 'mesa' : 'peak');
      }
    }
  }

  private createStations() {
    const add = (t: Tile, texture: string, name: string, round: number) => {
      const { x, y } = tileCenter(t);
      // Village cottages stand on the tile's back half, behind the wyrm passing through.
      const sprite = this.addProp(t, texture).setDepth(groundDepth(y) - (texture === 'roost' ? 0 : 12));
      const label = this.add.text(x, y + 16, name, textStyle(11)).setOrigin(0.5).setDepth(UI_DEPTH - 2);
      this.stations.push({ sprite, label, round });
      if (texture !== 'roost') {
        this.depotIcons.push(fit(this.add.image(x - label.width / 2 - 10, y + 15, 'depot')).setDepth(UI_DEPTH - 2).setVisible(false));
        const st = this.stations[this.stations.length - 1];
        // The town's tower stands behind the cottages.
        st.tower = this.addProp(t, 'town').setDepth(sprite.depth - 1).setVisible(false);
        st.warehouse = fit(this.add.image(x - label.width / 2 - 26, y + 15, 'warehouse')).setDepth(UI_DEPTH - 2).setVisible(false);
      }
    };
    add(ROOST, 'roost', t('roost'), 1);
    for (const v of villages(this.state)) {
      const shop = workshopOf(v);
      add(v, `village-${v.id}`, v.name, v.round);
      if (!shop) continue;
      // A workshop shows what it takes and what it makes, under its name.
      const { x, y } = tileCenter(v);
      const sign = this.add.container(x, y + 31, [
        fit(this.add.image(-14, 0, `cargo-${shop.takes}`), 0.55),
        this.add.text(0, 0, '>', textStyle(11)).setOrigin(0.5),
        fit(this.add.image(14, 0, `cargo-${shop.makes}`), 0.55),
      ]);
      this.stations[this.stations.length - 1].sign = sign.setDepth(UI_DEPTH - 2);
    }
    const host = tileCenter(villages(this.state)[festivalHost(this.state)]);
    this.bunting = this.add
      .image(host.x, host.y, 'bunting')
      .setOrigin(PROP.x / PROP.w, PROP.y / PROP.h)
      .setDepth(groundDepth(host.y) - 6)
      .setVisible(false);
  }

  /** A wyrm's parts, from the textures named `<prefix>-head` and so on. */
  private createWyrm(prefix: string): WyrmView {
    const { x, y } = tileCenter(ROOST);
    // It starts curled up behind the Roost's cave mouth, out of sight.
    const trail = [];
    const tail = SEGMENT_GAPS[SEGMENT_GAPS.length - 1];
    for (let i = 0; i <= tail; i++) trail.push({ x: x - i * 0.45, y: y - i * 0.22 });
    const part = (texture: string) => fit(this.add.image(0, 0, texture).setOrigin(PART_ORIGIN.x, PART_ORIGIN.y));
    return {
      // Three wagons: the third shows once a moult has given the wyrms one.
      segments: [part(`${prefix}-head`), part(`${prefix}-coil-0`), part(`${prefix}-coil-1`), part(`${prefix}-coil-2`), part('wagon-v'), part('wagon-v'), part('wagon-v')],
      wings: part(`${prefix}-wings`),
      wagonCargo: [0, 1, 2].map(() => fit(this.add.image(0, 0, 'cargo-grain'), 0.7).setVisible(false)),
      trail,
      headAngle: 0,
    };
  }

  private createHud() {
    const { width, height } = this.view;
    this.add.rectangle(0, 0, width, HUD_HEIGHT, 0x2c2018).setOrigin(0).setDepth(UI_DEPTH);
    this.add.rectangle(0, HUD_HEIGHT, width, 4, 0x5a3f2a).setOrigin(0).setDepth(UI_DEPTH);
    fit(this.add.image(22, 22, 'coin')).setDepth(UI_DEPTH);
    this.coinsText = this.add.text(38, 22, '', textStyle(18, '#f3c64e')).setOrigin(0, 0.5).setDepth(UI_DEPTH);
    for (let i = 0; i < 3; i++) this.hearts.push(fit(this.add.image(140 + i * 26, 22, 'heart')).setDepth(UI_DEPTH));
    fit(this.add.image(230, 22, 'food')).setDepth(UI_DEPTH);
    this.bellies = this.add.graphics().setDepth(UI_DEPTH);
    // The round sits between the bellies and the wyrms' status, which keeps to the right edge.
    this.roundText = this.add.text(440 + (width - VIEW.w) / 2, 22, '', { ...textStyle(16), align: 'center' }).setOrigin(0.5).setDepth(UI_DEPTH);
    this.wyrmText = this.add.text(width - 10, 22, '', { ...textStyle(14, '#c9e8c0'), align: 'right' }).setOrigin(1, 0.5).setDepth(UI_DEPTH);
    this.add.rectangle(0, BOARD.y + BOARD.h, BOARD.w, height - BOARD.y - BOARD.h, 0x2c2018).setOrigin(0).setDepth(UI_DEPTH);
    this.hint = this.add.text(BOARD.x + BOARD.w / 2, height - HINT_BOTTOM, '', textStyle(HINT_PX, '#d8c7a6')).setOrigin(0.5).setDepth(UI_DEPTH);
  }

  private createPanel() {
    const { width, height } = this.view;
    const left = PANEL.x - PANEL.w / 2 - 8;
    // The upgrades and toggles keep to the bottom edge; the order cards stay at the top.
    const dy = height - VIEW.h;
    this.add.rectangle(left, PANEL.top, width - left, height - PANEL.top, 0x2c2018).setOrigin(0).setDepth(UI_DEPTH);
    this.add.rectangle(left, PANEL.top, 4, height - PANEL.top, 0x5a3f2a).setOrigin(0).setDepth(UI_DEPTH);
    this.add.text(PANEL.x, 62, t('orders'), textStyle(16, '#f3c64e')).setOrigin(0.5).setDepth(UI_DEPTH);
    this.add.text(PANEL.x, UPGRADES_Y + dy, t('upgrades'), textStyle(14, '#f3c64e')).setOrigin(0.5).setDepth(UI_DEPTH);
    this.timers = this.add.graphics().setDepth(UI_DEPTH + 2);
    const button = (y: number, onClick: () => void) => {
      const b = makeButton(this, PANEL.x, y + dy, PANEL.w, BUTTONS.h, '', onClick);
      b.container.setDepth(UI_DEPTH + 1);
      return b;
    };
    const buy = (u: Upgrade) => () => {
      if (!buyUpgrade(this.state, u)) return ui('refuse');
      sfx('buy');
      if (u === 'second') sfx('roar');
    };
    this.wingsButton = button(BUTTONS.wings, buy('wings'));
    this.hoardButton = button(BUTTONS.hoard, buy('hoard'));
    this.secondButton = button(BUTTONS.second, buy('second'));
    const toggle = (mode: Mode) => () => {
      // Depots are locked until their round: the dimmed Depot button refuses rather than turning on.
      if (mode === 'depot' && this.mode !== 'depot' && depotLocked(this.state)) return ui('refuse');
      ui('click');
      this.mode = this.mode === mode ? 'auto' : mode;
    };
    this.depotButton = button(BUTTONS.depot, toggle('depot'));
    const dx = (PANEL.w - BUTTONS.half) / 2;
    this.removeButton = makeButton(this, PANEL.x - dx, BUTTONS.remove + dy, BUTTONS.half, BUTTONS.h, t('remove'), toggle('remove'));
    this.plainButton = makeButton(this, PANEL.x + dx, BUTTONS.remove + dy, BUTTONS.half, BUTTONS.h, t('plain'), toggle('plain'));
    this.removeButton.container.setDepth(UI_DEPTH + 1);
    this.plainButton.container.setDepth(UI_DEPTH + 1);
  }

  private createOverlays() {
    const mid = { x: BOARD.x + BOARD.w / 2, y: BOARD.y + 36 };
    // The game over panel and the charter cards were laid out for the designed board; they sit in the middle of a bigger one.
    const cy = Math.round((BOARD.h - DESIGN_BOARD.h) / 2);
    // A valley's arrival banner runs long: it wraps inside the board.
    this.bannerText = this.add.text(0, 0, '', { ...textStyle(18, '#f3c64e'), align: 'center', wordWrap: { width: BOARD.w - 80 } }).setOrigin(0.5);
    const box = this.add.rectangle(0, 0, 10, 40, 0x1d1a14, 0.8).setStrokeStyle(2, 0xc9a040);
    this.banner = this.add.container(mid.x, mid.y, [box, this.bannerText]).setDepth(UI_DEPTH + 3).setVisible(false);
    this.bannerBox = box;

    const shade = this.add.rectangle(0, 0, BOARD.w, BOARD.h, 0x0e0a08, 0.7).setOrigin(0);
    this.overText = this.add.text(BOARD.w / 2, 220 - BOARD.y + cy, '', { ...textStyle(20), align: 'center' }).setOrigin(0.5);
    this.endButtons = this.add.container(0, 0);
    this.overLayer = this.add.container(BOARD.x, BOARD.y, [shade, this.overText, this.endButtons]).setDepth(UI_DEPTH + 4).setVisible(false);

    // The round's charter: two cards over the board, the game waiting until one is tapped.
    const charterShade = this.add.rectangle(0, 0, BOARD.w, BOARD.h, 0x0e0a08, 0.6).setOrigin(0);
    this.charterTitle = this.add.text(BOARD.w / 2, CHARTER_CARD.y + cy - CHARTER_CARD.h / 2 - 40, '', { ...textStyle(20, '#f3c64e'), align: 'center' }).setOrigin(0.5);
    const parts: Phaser.GameObjects.GameObject[] = [charterShade, this.charterTitle];
    for (const i of [0, 1]) {
      const x = BOARD.w / 2 + (i ? 1 : -1) * (CHARTER_CARD.w + CHARTER_CARD.gap) / 2;
      const bg = this.add.rectangle(x, CHARTER_CARD.y + cy, CHARTER_CARD.w, CHARTER_CARD.h, 0x3d2b1f).setStrokeStyle(3, 0xc9a040);
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => bg.setFillStyle(0x5c3a21))
        .on('pointerout', () => bg.setFillStyle(0x3d2b1f))
        .on('pointerdown', () => pickCharter(this.state, i) && sfx('stamp'));
      const name = this.add.text(x, CHARTER_CARD.y + cy - 34, '', textStyle(17, '#f3c64e')).setOrigin(0.5);
      const text = this.add.text(x, CHARTER_CARD.y + cy + 10, '', { ...textStyle(13, '#f3e9d2'), align: 'center', wordWrap: { width: CHARTER_CARD.w - 30 } }).setOrigin(0.5);
      this.charterCards.push({ name, text });
      parts.push(bg, name, text);
    }
    this.charterLayer = this.add.container(BOARD.x, BOARD.y, parts).setDepth(UI_DEPTH + 4).setVisible(false);

    // A moult: up to three trait cards over the board, the game waiting until one is tapped.
    const moultShade = this.add.rectangle(0, 0, BOARD.w, BOARD.h, 0x0e0a08, 0.6).setOrigin(0);
    this.moultTitle = this.add.text(BOARD.w / 2, MOULT_CARD.y + cy - MOULT_CARD.h / 2 - 44, '', { ...textStyle(19, '#9be883'), align: 'center' }).setOrigin(0.5);
    const moultParts: Phaser.GameObjects.GameObject[] = [moultShade, this.moultTitle];
    for (const i of [0, 1, 2]) {
      const bg = this.add.rectangle(0, MOULT_CARD.y + cy, MOULT_CARD.w, MOULT_CARD.h, 0x24361f).setStrokeStyle(3, 0x7bc85a);
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => bg.setFillStyle(0x34502c))
        .on('pointerout', () => bg.setFillStyle(0x24361f))
        .on('pointerdown', () => pickMoult(this.state, i) && sfx('stamp'));
      const name = this.add.text(0, MOULT_CARD.y + cy - 36, '', textStyle(16, '#9be883')).setOrigin(0.5);
      const text = this.add.text(0, MOULT_CARD.y + cy + 10, '', { ...textStyle(13, '#f3e9d2'), align: 'center', wordWrap: { width: MOULT_CARD.w - 24 } }).setOrigin(0.5);
      this.moultCards.push({ bg, name, text });
      moultParts.push(bg, name, text);
    }
    this.moultLayer = this.add.container(BOARD.x, BOARD.y, moultParts).setDepth(UI_DEPTH + 5).setVisible(false);

    // The daily valley: a link in the sky before the first track is laid, a tag while it is played.
    this.dailyLink = this.add
      .text(BOARD.x + DAILY_LINK.x, BOARD.y + DAILY_LINK.y, '', textStyle(14, '#f3c64e'))
      .setDepth(UI_DEPTH - 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (!this.dailyOpen()) return;
        ui('click');
        this.scene.restart({ journey: { daily: true } });
      });
  }

  /** Whether the daily valley's link can start today's try: a fresh first valley that hasn't laid track, with today's try unused. */
  private dailyOpen() {
    const s = this.state;
    return !s.daily && !this.dailyPlayed && s.leg === 1 && s.phase === 'play' && s.round === 1 && !s.track.length;
  }

  /**
   * The daily link's text: the link while it is open, the tag while the daily valley is played, today's
   * score in its place once today's try is used, else nothing.
   */
  private drawDailyLink() {
    const s = this.state;
    // After midnight a fresh valley reads the record again, so yesterday's score isn't shown as today's.
    if (!s.daily && this.dailyDay !== today()) {
      const daily = loadDaily(GAME);
      this.dailyPlayed = daily.played;
      this.dailyScore = daily.score ?? 0;
      this.dailyDay = daily.day;
    }
    const open = this.dailyOpen();
    const done = !s.daily && this.dailyPlayed && s.leg === 1 && s.phase === 'play' && s.round === 1 && !s.track.length;
    const text = s.daily ? t('dailyTag') : open ? t('dailyLink') : done ? t('dailyDone', { n: this.dailyScore }) : '';
    if (this.dailyLink.text !== text) this.dailyLink.setText(text);
    this.dailyLink.setVisible(!!text).setColor(s.daily ? '#9bd8f0' : done ? '#d8c7a6' : '#f3c64e');
    if (this.dailyLink.input) this.dailyLink.input.enabled = open;
  }

  /**
   * Fills the end panel once the game is over or the festival won: the text, and its buttons. A won
   * festival offers to fly on to the next valley keeping one upgrade (WR15); the daily valley keeps
   * its score instead (WR17); and a game that isn't the daily offers today's daily valley if it is unused.
   */
  private openEnd() {
    const s = this.state;
    const lines: string[] = [];
    if (s.leg > 1 || s.daily) lines.push(t(s.daily ? 'dailyBanner' : 'valleyBanner', { n: s.leg, valley: t(KIND_TEXT[s.valley.kind].name) }));
    if (s.phase === 'over') lines.push(t('gameOver', { round: s.round, n: s.totalDelivered }));
    else {
      const host = villages(s)[festivalHost(s)].name;
      const medal = s.medal ?? 'bronze';
      lines.push(t('festivalWon', { village: host, n: s.totalDelivered, hearts: s.hearts }), t('medalLine', { medal: t(medal), time: clock(s.festivalMs) }));
      // The best medal on this difficulty is kept, and its boons start the next game; the daily valley is a game apart.
      if (!s.daily) {
        const best = this.medalSaved ? medal : saveMedal(settings.difficulty, medal);
        this.medalSaved = true;
        lines.push(t('bestLine', { level: sharedText(settings.difficulty), best: t(best) }), t('nextGame', { boons: boonNames(best).join(', ') }));
      }
    }
    if (s.traits.length) lines.push(t('traitsLine', { traits: s.traits.map((tr) => t(TRAIT_TEXT[tr].name)).join(', ') }));
    const owned = (Object.keys(UPGRADE_COSTS) as Upgrade[]).filter((u) => s.upgrades[u] > 0);
    const flying = s.phase === 'won' && !s.daily;
    if (flying) lines.push(t(owned.length ? 'flyOnLine' : 'flyOnPlain', { valley: t(KIND_TEXT[kindOfLeg(s.leg + 1)].name) }));
    if (s.daily) {
      const day = finishDaily(GAME, s.totalDelivered);
      lines.push('', t('dailyResult', { n: day.score ?? s.totalDelivered, best: day.best, streak: t('dailyStreak', { n: day.streak }) }));
    }
    const cy = Math.round((BOARD.h - DESIGN_BOARD.h) / 2);
    const rows = flying ? 2 : 1;
    this.overText.setText(lines.join('\n')).setFontSize(lines.length > 6 ? 16 : lines.length > 4 ? 18 : 20);
    const top = END_BUTTON.y - BOARD.y + cy - (rows - 1) * END_BUTTON.step;
    this.overText.setY(top - END_BUTTON.h / 2 - 14 - this.overText.height / 2);
    this.endButtons.removeAll(true);
    const row = (y: number, buttons: [string, () => void][]) => {
      const w = END_BUTTON.w;
      buttons.forEach(([caption, onClick], i) => {
        const x = BOARD.w / 2 + (i - (buttons.length - 1) / 2) * (w + END_BUTTON.gap);
        this.endButtons.add(makeButton(this, x, y, w, END_BUTTON.h, caption, onClick).container);
      });
    };
    const fly = (kept: Journey['kept']) => () => {
      ui('click');
      sfx('roar');
      this.scene.restart({ journey: { leg: s.leg + 1, kept, traits: s.traits } });
    };
    if (flying) {
      row(
        top,
        owned.length
          ? owned.map((u) => [t('keepUpgrade', { upgrade: t(UPGRADE_NAMES[u]) + (u === 'second' ? '' : ` ${s.upgrades[u]}`) }), fly({ upgrade: u, level: s.upgrades[u] })])
          : [[t('flyOn'), fly(null)]],
      );
    }
    const again: [string, () => void][] = [
      [
        t('playAgain'),
        () => {
          ui('click');
          this.scene.restart({ journey: {} });
        },
      ],
    ];
    if (!s.daily && !loadDaily(GAME).played) {
      again.push([
        t('dailyButton'),
        () => {
          ui('click');
          this.scene.restart({ journey: { daily: true } });
        },
      ]);
    }
    row(top + (rows - 1) * END_BUTTON.step, again);
  }

  private draw() {
    const s = this.state;
    this.drawTrack();
    this.drawHints();
    for (const st of this.stations) {
      st.sprite.setVisible(st.round <= s.round);
      st.label.setVisible(st.round <= s.round);
      st.sign?.setVisible(st.round <= s.round);
    }
    this.depotIcons.forEach((icon, i) => icon.setVisible(s.depots.includes(i)));
    this.stations.slice(1).forEach((st, i) => {
      st.tower!.setVisible(s.towns.includes(i));
      st.warehouse!.setVisible(s.warehouses.includes(i));
      st.label.setColor(s.towns.includes(i) ? '#f3c64e' : '#f3e9d2');
    });
    this.bunting.setVisible(s.round === FESTIVAL_ROUND);
    this.drawMoods();
    this.drawHazard();
    this.drawMarkers();
    while (this.wyrmViews.length < s.wyrms.length) this.wyrmViews.push(this.createWyrm('wyrm2'));
    s.wyrms.forEach((w, i) => this.drawWyrm(w, i, this.wyrmViews[i]));
    this.drawNight();
    this.drawPops();
    this.drawHud();
    this.drawHintLine();
    this.drawPanel();
    if (s.banner) {
      this.bannerText.setText(s.banner.text);
      this.bannerBox.setSize(this.bannerText.width + 32, this.bannerText.height + 16).setOrigin(0.5);
      // A banner of several lines grows down from where a one-line banner sits, clear of the HUD.
      this.banner.setY(BOARD.y + 36 + Math.max(0, this.bannerBox.height - 40) / 2);
    }
    this.banner.setVisible(!!s.banner && s.phase === 'play');
    if (s.phase !== 'play' && !this.overLayer.visible) this.openEnd();
    this.overLayer.setVisible(s.phase !== 'play');
    this.drawCharters();
    this.drawMoult();
    this.drawDailyLink();
  }

  /** The traits a moult offers, while the player has yet to pick one. */
  private drawMoult() {
    const s = this.state;
    const offer = s.moultOffer;
    this.moultLayer.setVisible(!!offer && s.phase === 'play');
    if (!offer) return;
    const k = `${s.leg}|${s.round}|${offer.join(';')}`;
    if (k === this.moultKey) return;
    this.moultKey = k;
    this.moultTitle.setText(t('pickMoult', { round: s.round }));
    this.moultCards.forEach((card, i) => {
      const trait = offer[i];
      const x = BOARD.w / 2 + (i - (offer.length - 1) / 2) * (MOULT_CARD.w + MOULT_CARD.gap);
      for (const o of [card.bg, card.name, card.text]) o.setX(x).setVisible(!!trait);
      card.bg.input!.enabled = !!trait;
      if (!trait) return;
      card.name.setText(t(TRAIT_TEXT[trait].name));
      card.text.setText(t(TRAIT_TEXT[trait].text));
    });
  }

  /** The two charters on offer at a round's start, while the player has yet to pick one. */
  private drawCharters() {
    const s = this.state;
    const offer = s.charterOffer;
    // A moult comes first: the charter cards wait under its cards.
    this.charterLayer.setVisible(!!offer && !s.moultOffer && s.phase === 'play');
    if (!offer) return;
    const k = `${s.round}|${offer.map((c) => c.id + (c.cargo ?? '')).join(';')}`;
    if (k === this.charterKey) return;
    this.charterKey = k;
    this.charterTitle.setText(t('pickCharter', { round: s.round }));
    offer.forEach((c, i) => {
      this.charterCards[i].name.setText(t(c.name));
      this.charterCards[i].text.setText(t(c.text, { cargo: c.cargo ? t(CARGO_NAMES[c.cargo].name) : '' }));
    });
  }

  /** Each open village's mood, as a face by its name, once moods count. */
  private drawMoods() {
    const s = this.state;
    const k = s.round < MOOD_ROUND ? '' : `${s.round}|${s.moods.join(',')}`;
    if (k === this.moodKey) return;
    this.moodKey = k;
    const g = this.moodLayer.clear();
    if (!k) return;
    openVillages(s).forEach((v) => {
      const i = villages(s).indexOf(v);
      const st = this.stations[i + 1];
      const look = MOOD_LOOKS[moodOf(s, i) + 2];
      const x = st.label.x + st.label.width / 2 + 10;
      const y = st.label.y;
      g.fillStyle(0x1d1a14, 0.8).fillCircle(x, y + 1, 8);
      g.fillStyle(look.color).fillCircle(x, y, 7);
      g.fillStyle(0x1d1a14).fillCircle(x - 2.5, y - 2, 1.2).fillCircle(x + 2.5, y - 2, 1.2);
      g.lineStyle(1.5, 0x1d1a14);
      if (look.mouth === 0) g.lineBetween(x - 3, y + 2.5, x + 3, y + 2.5);
      else {
        g.beginPath();
        g.arc(x, y + (look.mouth > 0 ? 1 : 5), 3.2, look.mouth > 0 ? 0.3 : Math.PI + 0.3, look.mouth > 0 ? Math.PI - 0.3 : 2 * Math.PI - 0.3);
        g.strokePath();
      }
    });
  }

  /** The warning over the tile a washout or a rockfall is about to take: an amber mark that blinks (held still with reduced motion). */
  private drawHazard() {
    const h = this.state.hazard;
    this.hazardMark.setVisible(!!h);
    if (!h) return;
    const { x, y } = tileCenter(h.tile);
    const blink = !settings.reduceMotion && Math.floor(this.time.now / 300) % 2 === 0;
    this.hazardMark.setPosition(x, y - 14).setAlpha(blink ? 0.5 : 1);
  }

  /** Redraws the rails when the track, the switches or the open villages change. */
  private drawTrack() {
    const s = this.state;
    const k = `${s.track.join(';')}|${s.round}|${Object.entries(s.switches).join(';')}|${s.cuts.join(';')}|${s.crossings.join(';')}|${s.hazard ? key(s.hazard.tile) : ''}|${s.lamps.join(';')}|${s.rival ? s.rival.track.join(';') : ''}`;
    if (k === this.trackKey) return;
    this.trackKey = k;
    for (const [tile, pines] of this.pines) pines.setVisible(!s.track.includes(tile));
    this.drawPortals();
    const g = this.rails.clear();
    const tiles = [...s.track.map((k) => k.split(',').map(Number)), ...[ROOST, ...openVillages(s)].map((t) => [t.c, t.r])];
    // Each tile draws a half rail towards every arm it is joined to. Ballast and bridges first, then sleepers, then rails.
    for (const pass of ['bed', 'sleepers', 'rails', 'switches'] as const) {
      for (const [c, r] of tiles) {
        const here = { c, r };
        const station = !s.track.includes(key(here));
        const bridge = !station && terrainAt(s.valley, here) === 'river';
        const closed = s.switches[key(here)];
        const doomed = s.hazard && key(s.hazard.tile) === key(here);
        for (const n of arms(s, here)) {
          const dc = n.c - c;
          const dr = n.r - r;
          // A point `t` of the way from the tile's middle to its edge towards `n`, `side` tiles across, `z` up.
          const at = (t: number, side: number, z = 0) => {
            const p = iso(c + 0.5 + dc * 0.5 * t + Math.abs(dr) * side, r + 0.5 + dr * 0.5 * t + Math.abs(dc) * side, z);
            return new Phaser.Math.Vector2(p.x, p.y);
          };
          const shut = closed === key(n);
          if (pass === 'bed') {
            g.fillStyle(doomed ? 0xc06a3a : bridge ? WOOD.base : RAIL.bed).fillPoints([at(0, -0.24), at(1, -0.24), at(1, 0.24), at(0, 0.24)], true);
            if (bridge) for (const side of [-0.25, 0.25]) g.lineStyle(2, WOOD.dark).lineBetween(at(-0.5, side).x, at(-0.5, side).y, at(1, side).x, at(1, side).y);
          }
          if (pass === 'sleepers') {
            for (const t of [0.12, 0.42, 0.72, 0.98]) {
              const a = at(t, -0.2, 0.5);
              const b = at(t, 0.2, 0.5);
              g.lineStyle(4.5, bridge ? WOOD.light : RAIL.sleeper).lineBetween(a.x, a.y, b.x, b.y);
            }
          }
          if (pass === 'rails') {
            for (const side of [-0.12, 0.12]) {
              const a = at(0, side, 1.5);
              const b = at(1, side, 1.5);
              g.lineStyle(3, 0x4c4b55).lineBetween(a.x, a.y + 1, b.x, b.y + 1);
              g.lineStyle(1.8, shut ? 0x8a8a94 : RAIL.shine, shut ? 0.7 : 1).lineBetween(a.x, a.y, b.x, b.y);
            }
          }
          if (pass === 'switches' && shut) {
            // A striped barrier across the arm the switch is set against.
            const a = at(0.62, -0.26, 5);
            const b = at(0.62, 0.26, 5);
            g.lineStyle(4, 0x3a2a1c).lineBetween(a.x, a.y + 1, b.x, b.y + 1);
            for (let i = 0; i < 4; i++) {
              const p = Phaser.Math.LinearXY(a, b, i / 4);
              const q = Phaser.Math.LinearXY(a, b, (i + 1) / 4);
              g.lineStyle(3, i % 2 ? 0xf7efd8 : 0xe8823a).lineBetween(p.x, p.y, q.x, q.y);
            }
            for (const end of [a, b]) g.lineStyle(1.5, 0x3a2a1c).lineBetween(end.x, end.y, end.x, end.y + 5);
          }
        }
        if (pass === 'switches' && isCrossing(s, here)) {
          // A crossing's plate, where the two straights pass over each other.
          const m = iso(c + 0.5, r + 0.5, 1.5);
          g.fillStyle(0x3a3a44).fillPoints([iso(c + 0.3, r + 0.3, 1.5), iso(c + 0.7, r + 0.3, 1.5), iso(c + 0.7, r + 0.7, 1.5), iso(c + 0.3, r + 0.7, 1.5)].map((p) => new Phaser.Math.Vector2(p.x, p.y)), true);
          g.lineStyle(1.5, RAIL.shine).strokeCircle(m.x, m.y, 3);
        }
        if (pass === 'switches' && closed) {
          // The lever on the junction's front corner.
          const foot = iso(c + 0.86, r + 0.86);
          g.fillStyle(0x1d1a14, 0.25).fillEllipse(foot.x + 3, foot.y + 1, 12, 5);
          g.fillStyle(0x4a3a2a).fillRect(foot.x - 2, foot.y - 22, 4, 22);
          g.lineStyle(4, 0xe8823a).lineBetween(foot.x, foot.y - 15, foot.x + 10, foot.y - 30);
          g.fillStyle(0xf2c14e).fillCircle(foot.x + 10, foot.y - 30, 4);
        }
        if (pass === 'switches' && s.lamps.includes(key(here))) {
          // A lamp post on the tile's left corner.
          const foot = iso(c + 0.14, r + 0.86);
          g.fillStyle(0x1d1a14, 0.25).fillEllipse(foot.x + 3, foot.y + 1, 10, 4);
          g.fillStyle(0x3a3a44).fillRect(foot.x - 1.5, foot.y - 26, 3, 26);
          g.fillStyle(0x3a3a44).fillRect(foot.x - 4, foot.y - 32, 8, 7);
          g.fillStyle(0xffe08a).fillRect(foot.x - 2.5, foot.y - 31, 5, 5);
        }
      }
    }
    this.drawRival(g);
  }

  /** The rival line (WR20): its track in plum, joined only to itself, its flyovers over the wyrm's line and its yard's shed. */
  private drawRival(g: Phaser.GameObjects.Graphics) {
    const r = this.state.rival;
    if (!r) return;
    const flyovers = rivalFlyovers(this.state).map(key);
    const own = (t: Tile) => r.track.includes(key(t)) || (t.c === r.yard.c && t.r === r.yard.r) || flyovers.includes(key(t));
    for (const pass of ['bed', 'rails'] as const) {
      for (const k of [key(r.yard), ...r.track, ...flyovers]) {
        const over = flyovers.includes(k);
        const [c, rr] = k.split(',').map(Number);
        for (const n of [{ c: c + 1, r: rr }, { c: c - 1, r: rr }, { c, r: rr + 1 }, { c, r: rr - 1 }]) {
          if (!own(n)) continue;
          // A flyover only runs straight across, to the rival tiles on either side.
          if (over && !r.track.includes(key(n)) && !(n.c === r.yard.c && n.r === r.yard.r)) continue;
          const dc = n.c - c;
          const dr = n.r - rr;
          // A flyover's deck rides high over the wyrm's rails.
          const lift = over ? 12 : 0;
          const at = (t: number, side: number, z = 0) => {
            const p = iso(c + 0.5 + dc * 0.5 * t + Math.abs(dr) * side, rr + 0.5 + dr * 0.5 * t + Math.abs(dc) * side, z + lift);
            return new Phaser.Math.Vector2(p.x, p.y);
          };
          if (pass === 'bed') {
            g.fillStyle(over ? 0x3a2e46 : 0x5a4a66).fillPoints([at(0, -0.2), at(1, -0.2), at(1, 0.2), at(0, 0.2)], true);
            if (over) for (const side of [-0.18, 0.18]) g.lineStyle(2, 0x3a2e46).lineBetween(at(0.3, side).x, at(0.3, side).y, at(0.3, side).x, at(0.3, side).y + lift);
          } else for (const side of [-0.1, 0.1]) g.lineStyle(1.8, 0xc7a0e8).lineBetween(at(0, side, 1).x, at(0, side, 1).y, at(1, side, 1).x, at(1, side, 1).y);
        }
      }
    }
    // The yard: a plum shed with a pennant.
    const { c, r: rr } = r.yard;
    const pt = (u: number, v: number, z = 0) => {
      const p = iso(c + u, rr + v, z);
      return new Phaser.Math.Vector2(p.x, p.y);
    };
    g.fillStyle(0x1d1a14, 0.25).fillEllipse(pt(0.5, 0.5).x + 4, pt(0.5, 0.5).y + 2, 40, 16);
    g.fillStyle(0x8a6aa0).fillPoints([pt(0.25, 0.75), pt(0.75, 0.75), pt(0.75, 0.75, 22), pt(0.25, 0.75, 22)], true);
    g.fillStyle(0x6a4e80).fillPoints([pt(0.75, 0.75), pt(0.75, 0.25), pt(0.75, 0.25, 22), pt(0.75, 0.75, 22)], true);
    g.fillStyle(0x4a3460).fillPoints([pt(0.2, 0.8, 22), pt(0.8, 0.8, 22), pt(0.8, 0.5, 36), pt(0.2, 0.5, 36)], true);
    g.fillStyle(0x3a2850).fillPoints([pt(0.8, 0.8, 22), pt(0.8, 0.2, 22), pt(0.8, 0.5, 36)], true);
    g.fillStyle(0x2a2030).fillPoints([pt(0.4, 0.75), pt(0.6, 0.75), pt(0.6, 0.75, 14), pt(0.4, 0.75, 14)], true);
  }

  /**
   * Night (WR19): the valley darkens, and the tiles the lamps and the stations light stay brighter,
   * so the player sees which track slows the wyrm. Lamps and the wyrms' heads glow.
   */
  private drawNight() {
    const s = this.state;
    const night = isNight(s) && s.phase === 'play';
    const k = night ? `${s.round}|${s.lamps.join(';')}` : '';
    if (k !== this.darkKey) {
      this.darkKey = k;
      const d = this.dark.clear();
      if (night) {
        d.fillStyle(0x0c1430, 0.45).fillRect(BOARD.x, BOARD.y, BOARD.w, BOARD.h);
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            if (isLit(s, { c, r })) continue;
            const pts = [iso(c, r), iso(c + 1, r), iso(c + 1, r + 1), iso(c, r + 1)].map((p) => new Phaser.Math.Vector2(p.x, p.y));
            d.fillStyle(0x0c1430, 0.35).fillPoints(pts, true);
          }
        }
      }
    }
    const g = this.glow.clear();
    if (!night) return;
    const light = (x: number, y: number, r: number) => {
      for (const [f, a] of [[1, 0.12], [0.6, 0.2], [0.3, 0.45]]) g.fillStyle(0xffd27a, a).fillCircle(x, y, r * f);
    };
    for (const lamp of s.lamps) {
      const [c, r] = lamp.split(',').map(Number);
      const foot = iso(c + 0.14, r + 0.86);
      light(foot.x, foot.y - 28, 14);
    }
    for (const v of this.wyrmViews.slice(0, s.wyrms.length)) if (v.segments[0].visible) light(v.segments[0].x, v.segments[0].y - 14, 10);
  }

  /** A dark tunnel mouth on each side of a mountain the track runs through, in front of the peak. */
  private drawPortals() {
    const s = this.state;
    for (const p of this.portals) p.destroy();
    this.portals = [];
    for (const k of s.track) {
      const [c, r] = k.split(',').map(Number);
      if (terrainAt(s.valley, { c, r }) !== 'mountain') continue;
      const g = this.add.graphics().setDepth(groundDepth(tileCenter({ c, r }).y) + 1);
      for (const n of arms(s, { c, r })) {
        const m = iso(c + 0.5 + (n.c - c) * 0.4, r + 0.5 + (n.r - r) * 0.4);
        g.fillStyle(0x6a6678).fillEllipse(m.x, m.y - 6, 26, 22);
        g.fillStyle(0x1d1a24).fillEllipse(m.x, m.y - 4, 18, 16);
        g.fillStyle(0x6a6678).fillRect(m.x - 13, m.y + 1, 26, 4);
      }
      this.portals.push(g);
    }
  }

  /** Whether a point on the valley floor is inside a tunnel, where the wyrm is out of sight. */
  private inTunnel(x: number, y: number) {
    const t = tileAt(x, y);
    return inGrid(t) && terrainAt(this.state.valley, t) === 'mountain' && this.state.track.includes(key(t));
  }

  /** Outlines where track can go (or, while removing, which track can be taken up). */
  private drawHints() {
    const s = this.state;
    const g = this.hints.clear();
    if (s.phase !== 'play') return;
    const diamond = (c: number, r: number) =>
      [iso(c + 0.1, r + 0.1), iso(c + 0.9, r + 0.1), iso(c + 0.9, r + 0.9), iso(c + 0.1, r + 0.9)].map((p) => new Phaser.Math.Vector2(p.x, p.y));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = { c, r };
        if (this.mode === 'remove') {
          if (canRemove(s, t)) g.lineStyle(2, 0xf0a050, 0.95).strokePoints(diamond(c, r), true);
          continue;
        }
        if (this.mode === 'depot') {
          const v = villageAt(s, t);
          if (v !== null && (canBuyDepot(s, v) || canBuyWarehouse(s, v))) g.lineStyle(2.5, 0xf3c64e, 0.95).strokePoints(diamond(c, r), true);
          continue;
        }
        const cost = trackCost(s, t);
        if (cost === null) continue;
        const pts = diamond(c, r);
        g.fillStyle(0xfffff0, cost <= s.coins ? 0.12 : 0.05).fillPoints(pts, true);
        g.lineStyle(1.5, cost <= s.coins ? (this.mode === 'plain' ? 0x9bd8f0 : 0xfffff0) : 0x6a6070, cost <= s.coins ? 0.8 : 0.5).strokePoints(pts, true);
      }
    }
    if (s.hazard) {
      const { c, r } = s.hazard.tile;
      g.lineStyle(3, 0xf0a050, 0.95).strokePoints(diamond(c, r), true);
    }
    // Each wyrm's way ahead, as a dotted line in its colour, so the player can see where the switches send it.
    s.wyrms.forEach((w, i) => {
      if (!w.path.length) return;
      const pts = [w.at, ...w.path].map(tileCenter);
      for (let j = 1; j < pts.length; j++) {
        for (const t of [0.25, 0.5, 0.75, 1]) {
          const x = pts[j - 1].x + (pts[j].x - pts[j - 1].x) * t;
          const y = pts[j - 1].y + (pts[j].y - pts[j - 1].y) * t + 2;
          g.fillStyle(0x1d1a14, 0.6).fillCircle(x, y + 1, 3.6);
          g.fillStyle(WYRM_COLORS[i]).fillCircle(x, y, 2.8);
        }
      }
      const end = pts[pts.length - 1];
      g.lineStyle(2.5, WYRM_COLORS[i]).strokeEllipse(end.x, end.y + 2, 34, 17);
    });
  }

  /** A cargo icon over each village with goods waiting for the wyrm. */
  private drawMarkers() {
    const s = this.state;
    const waiting = s.orders.filter((o) => o.status !== 'carrying');
    while (this.markers.length < waiting.length) this.markers.push(fit(this.add.image(0, 0, 'cargo-grain')).setDepth(4));
    const perVillage = new Map<number, number>();
    this.markers.forEach((m, i) => {
      const o = waiting[i];
      m.setVisible(!!o);
      if (!o) return;
      const n = perVillage.get(o.from) ?? 0;
      perVillage.set(o.from, n + 1);
      const { x, y } = tileCenter(villages(s)[o.from]);
      m.setTexture(`cargo-${o.cargo}`).setPosition(x - 9 + n * 18, y - 68).setDepth(UI_DEPTH - 1);
    });
  }

  private drawWyrm(w: Wyrm, index: number, view: WyrmView) {
    const s = this.state;
    const { segments, wings, wagonCargo, trail } = view;
    const a = tileCenter(w.at);
    const b = w.path.length ? tileCenter(w.path[0]) : a;
    const head = { x: a.x + (b.x - a.x) * w.progress, y: a.y + (b.y - a.y) * w.progress };
    if (w.path.length) view.headAngle = Math.atan2(b.y - a.y, b.x - a.x);
    const last = trail[0];
    const step = Math.hypot(head.x - last.x, head.y - last.y);
    // Keep a point every pixel of the head's way, so the body follows the track's corners.
    for (let i = Math.floor(step); i >= 1; i--) {
      trail.unshift({ x: head.x + ((last.x - head.x) * (i - 1)) / step, y: head.y + ((last.y - head.y) * (i - 1)) / step });
    }
    trail.length = Math.min(trail.length, SEGMENT_GAPS[SEGMENT_GAPS.length - 1] + 2);
    const shown = 4 + wagons(s);
    segments.forEach((seg, i) => {
      const gap = SEGMENT_GAPS[i];
      const p = i === 0 ? head : trail[Math.min(gap, trail.length - 1)];
      seg.setPosition(p.x, p.y).setDepth(groundDepth(p.y) + (i === 0 ? 0.5 : 0)).setVisible(i < shown && !this.inTunnel(p.x, p.y));
      // The head is drawn in profile: it looks the way the wyrm is going across the screen.
      if (i === 0 && w.path.length && Math.abs(b.x - a.x) > 0.5) seg.setFlipX(b.x < a.x);
      if (i < 4) return;
      // A wagon turns to lie along the track it is on: down-right is along the columns.
      const ahead = trail[Math.max(0, gap - 6)];
      const dx = ahead.x - p.x;
      const dy = ahead.y - p.y;
      const angle = dx || dy ? Math.atan2(dy, dx) : view.headAngle;
      seg.setTexture(Math.cos(angle) * Math.sin(angle) > 0 ? 'wagon-u' : 'wagon-v');
    });
    const coil = segments[1];
    wings.setPosition(coil.x, coil.y).setDepth(coil.depth + 0.2).setVisible(coil.visible);
    const moving = w.path.length > 0 && w.switchMs <= 0 && w.waitMs <= 0;
    fit(wings, 1, moving && !settings.reduceMotion ? 0.75 + 0.25 * Math.sin(this.time.now / 90 + index) : 1);
    // What the wagons carry: the orders this wyrm has loaded, first loaded in the front wagon.
    const carried = s.orders.filter((o) => o.status === 'carrying' && o.wyrm === index);
    wagonCargo.forEach((icon, i) => {
      const wagon = segments[4 + i];
      const o = carried[i] ?? (carried[0] && isPassengers(carried[0]) ? carried[0] : undefined);
      icon.setVisible(!!o && wagon.visible).setPosition(wagon.x, wagon.y - LOAD_LIFT).setDepth(wagon.depth + 0.1);
      if (o) icon.setTexture(`cargo-${o.cargo}`);
    });
  }

  private drawPops() {
    const s = this.state;
    for (const p of s.pops) {
      let t = this.pops.get(p.id);
      if (!t) {
        t = this.add.text(0, 0, p.text, textStyle(16, p.color)).setOrigin(0.5).setDepth(UI_DEPTH - 1);
        this.pops.set(p.id, t);
      }
      const { x, y } = tileCenter({ c: p.x, r: p.y });
      const age = 1 - p.ms / POP_MS;
      t.setPosition(x, y - 20 - age * 30).setAlpha(Math.min(1, p.ms / 300));
    }
    for (const [id, t] of this.pops) {
      if (!s.pops.some((p) => p.id === id)) {
        t.destroy();
        this.pops.delete(id);
      }
    }
  }

  /** What a wyrm is doing, for the HUD. */
  private wyrmStatus(w: Wyrm) {
    const s = this.state;
    const vs = villages(s);
    const job = s.orders.find((o) => o.id === jobOrder(w.job));
    const cargo = job ? t(CARGO_NAMES[job.cargo].lower) : '';
    if (w.switchMs > 0) return t('throwingSwitch');
    if (w.waitMs > 0) return t('waitingJunction');
    if (w.eatMs > 0) return t('eating');
    if (w.job?.leg === 'feed') return t('hungry');
    if (w.job?.leg === 'visit') return t('bringingGifts', { village: vs[w.job.village].name });
    if (!job) return t(s.queue.length ? 'settingOff' : 'resting');
    if (job.status === 'carrying') return t('hauling', { cargo, village: vs[job.to].name });
    if (job.status === 'loading') return t('loadingCargo', { cargo });
    return t('offTo', { village: vs[job.from].name });
  }

  private drawHud() {
    const s = this.state;
    this.coinsText.setText(formatNumber(s.coins));
    this.hearts.forEach((h, i) => h.setTexture(i < s.hearts ? 'heart' : 'heart-empty'));
    const progress =
      s.round === FESTIVAL_ROUND
        ? t('festivalProgress', { n: s.delivered, goal: FESTIVAL_GOAL })
        : t('roundProgress', { round: s.round, n: s.delivered, goal: roundGoal(s.round) });
    // The round's charter goes on a second line, so the HUD stays clear of the bellies and the wyrms' status.
    const charter = !!s.charter;
    this.roundText.setText(charter ? t('roundCharter', { progress, charter: t(s.charter!.name) }) : progress).setFontSize(charter ? 14 : 16);
    const two = s.wyrms.length > 1;
    this.wyrmText
      .setText(s.wyrms.map((w, i) => (two ? t('wyrmN', { n: i + 1, status: this.wyrmStatus(w) }) : t('wyrm', { status: this.wyrmStatus(w) }))).join('\n'))
      .setFontSize(two ? 12 : 14);
    // Each wyrm's belly: green while fed, amber when hungry, empty when it is starving.
    const g = this.bellies.clear();
    s.wyrms.forEach((w, i) => {
      const y = two ? 12 + i * 15 : 18;
      g.fillStyle(0x1d1a14).fillRect(244, y, 62, 8);
      g.fillStyle(w.food <= HUNGRY ? 0xe8b040 : WYRM_COLORS[i]).fillRect(245, y + 1, 60 * w.food, 6);
    });
  }

  private drawHintLine() {
    const s = this.state;
    const text =
      this.mode === 'remove'
        ? t('hintRemove')
        : this.mode === 'plain'
          ? t('hintPlain')
          : this.mode === 'depot'
            ? s.towns.length
              ? t('hintWarehouse', { cost: depotCost(s), warehouse: WAREHOUSE_COST })
              : t('hintDepot', { cost: depotCost(s) })
            : isNight(s) && s.track.some((k) => !isLit(s, tileOfKey(k)))
              ? t('hintNight', { cost: LAMP_COST })
              : s.rival?.claim
                ? t('hintRival')
                : s.hazard
              ? t(HAZARD_TEXT[s.hazard.kind].hint)
              : s.round >= MOOD_ROUND && openVillages(s).some((v) => moodOf(s, villages(s).indexOf(v)) < 0 && canSendCourier(s, villages(s).indexOf(v)))
                ? t('hintCourier', { cost: COURIER_COST })
                : Object.keys(s.switches).length
                  ? t('hintSwitch')
                  : t('hintBuild', { bridge: terrainCost(s.valley.kind, 'river') });
    if (text === this.hint.text) return;
    this.hint.setText(text);
    this.placeHint();
  }

  /**
   * Fits the hint into the bar beside the shared corner buttons (full screen and pause; DOM
   * elements in the bottom left, sized in CSS pixels): centred under the board while it clears
   * them, else centred in the room right of them, shrinking (German runs long) to fit there.
   */
  private placeHint() {
    const corner = this.cornerWidth();
    this.hintCorner = Math.round(corner);
    const right = BOARD.x + BOARD.w - HINT_GAP;
    const left = corner + HINT_GAP;
    this.hint.setFontSize(HINT_PX);
    for (let px = HINT_PX - 1; px >= MIN_HINT_PX && this.hint.width > right - left; px--) this.hint.setFontSize(px);
    const mid = BOARD.x + BOARD.w / 2;
    this.hint.setX(mid - this.hint.width / 2 >= left ? mid : (left + right) / 2);
  }

  /** How far the shared corner buttons reach into the view from its left edge, in game pixels. */
  private cornerWidth() {
    const bar = document.querySelector('.game-corner');
    const canvas = this.game.canvas.getBoundingClientRect();
    if (!bar || !canvas.width) return CORNER_FALLBACK;
    const reach = bar.getBoundingClientRect().right - canvas.left;
    return Math.max(0, (reach * this.view.width) / canvas.width);
  }


  private drawPanel() {
    const s = this.state;
    const k = `${s.upgrades.hoard}|${s.wyrms.length}|${s.rival?.claim?.order ?? ''}|` + s.orders.map((o) => `${o.id}:${o.status}:${routable(s, o)}`).join(';');
    if (k !== this.cardKey) {
      this.cardKey = k;
      for (const c of this.cards) c.destroy();
      this.cards = s.orders.map((o, i) => this.makeCard(o, ORDER_CARD.y + i * (ORDER_CARD.h + ORDER_CARD.gap)));
      this.orderSpots = s.orders.map((o, i) => ({ id: o.id, x: PANEL.x, y: ORDER_CARD.y + i * (ORDER_CARD.h + ORDER_CARD.gap) }));
    }
    // The time left on each order, as a bar along the card's foot.
    const g = this.timers.clear();
    s.orders.forEach((o, i) => {
      const f = Math.max(0, o.timeLeftMs / o.totalMs);
      const y = ORDER_CARD.y + i * (ORDER_CARD.h + ORDER_CARD.gap) + ORDER_CARD.h / 2 - 9;
      const color = f > 0.5 ? 0x7bc85a : f > 0.25 ? 0xe8b040 : 0xe0584f;
      const blink = f < 0.25 && !settings.reduceMotion && Math.floor(this.time.now / 250) % 2 === 0;
      g.fillStyle(0x1d1a14).fillRect(PANEL.x - PANEL.w / 2 + 8, y, PANEL.w - 16, 5);
      g.fillStyle(color, blink ? 0.4 : 1).fillRect(PANEL.x - PANEL.w / 2 + 8, y, (PANEL.w - 16) * f, 5);
      // The rival's race for it: a plum bar along the card's top, running out as the rival closes in.
      const claim = s.rival?.claim;
      if (claim?.order === o.id) {
        const top = y + 9 - ORDER_CARD.h + 3;
        g.fillStyle(0x1d1a14).fillRect(PANEL.x - PANEL.w / 2 + 2, top, PANEL.w - 4, 4);
        g.fillStyle(0xc7a0e8).fillRect(PANEL.x - PANEL.w / 2 + 2, top, ((PANEL.w - 4) * Math.max(0, claim.ms)) / RIVAL_CLAIM_MS, 4);
      }
    });

    const wings = upgradeCost(s, 'wings');
    const hoard = upgradeCost(s, 'hoard');
    const second = upgradeCost(s, 'second');
    this.wingsButton.setCaption(wings === null ? t('wingsMax') : t('wingsCost', { level: s.upgrades.wings + 1, cost: wings }));
    this.wingsButton.setEnabled(wings !== null && wings <= s.coins);
    this.hoardButton.setCaption(hoard === null ? t('hoardMax') : t('hoardCost', { level: s.upgrades.hoard + 1, cost: hoard }));
    this.hoardButton.setEnabled(hoard !== null && hoard <= s.coins);
    this.secondButton.setCaption(
      second === null ? t('secondAwake') : upgradeLocked(s, 'second') ? t('secondRound', { round: secondWyrmRound(s) }) : t('secondCost', { cost: second }),
    );
    this.secondButton.setEnabled(second !== null && second <= s.coins && !upgradeLocked(s, 'second'));
    const depot = depotCost(s);
    this.depotButton.setCaption(
      this.mode === 'depot' ? t('tapVillage') : depotLocked(s) ? t('depotRound', { round: DEPOT_ROUND }) : t('depotCost', { n: s.depots.length + 1, cost: depot }),
    );
    this.depotButton.setLit(this.mode === 'depot');
    this.depotButton.setEnabled(this.mode === 'depot' || (!depotLocked(s) && depot <= s.coins));
    this.removeButton.setCaption(t(this.mode === 'remove' ? 'removing' : 'remove'));
    this.removeButton.setLit(this.mode === 'remove');
    this.plainButton.setCaption(t(this.mode === 'plain' ? 'plainOn' : 'plain'));
    this.plainButton.setLit(this.mode === 'plain');
  }

  private makeCard(o: Order, y: number) {
    const s = this.state;
    const ok = routable(s, o);
    const bg = this.add
      .rectangle(0, 0, PANEL.w, ORDER_CARD.h, o.status === 'waiting' ? (o.made ? 0x4a3420 : 0x3d2b1f) : 0x2f4a2a)
      .setStrokeStyle(2, o.status === 'waiting' ? (ok ? 0xc9a040 : 0x6a6070) : 0x7bc85a);
    const left = -PANEL.w / 2 + 8;
    const vs = villages(s);
    const icon = fit(this.add.image(left + 12, -18, `cargo-${o.cargo}`));
    // Goods a workshop made have their name in gold.
    const title = this.add.text(left + 28, -26, t(CARGO_NAMES[o.cargo].name), textStyle(14, o.made ? '#f3c64e' : isPassengers(o) ? '#9bd8f0' : '#f3e9d2'));
    const pay = this.add.text(PANEL.w / 2 - 8, -26, t('coins', { n: orderPay(s, o) }), textStyle(14, '#f3c64e')).setOrigin(1, 0);
    const route = this.add.text(left, -8, t('route', { from: vs[o.from].name, to: vs[o.to].name }), textStyle(11, '#d8c7a6'));
    // An order the rival is after says so where its status goes.
    const raced = s.rival?.claim?.order === o.id;
    const status = this.add.text(left, 5, t(raced ? 'rivalRace' : ok ? STATUS_TEXT[o.status] : 'noTrack'), textStyle(11, raced ? '#c7a0e8' : ok ? '#c9e8c0' : '#a8957a'));
    // What the sending village's mood did to the order when it was made: a sulking village wants it fast, a happy one pays more.
    const mood = o.mood;
    const tag = this.add
      .text(PANEL.w / 2 - 8, 5, mood < 0 ? t('rushOrder') : mood > 0 ? t('morePay', { n: Math.round((MOOD_PAY[mood] - 1) * 100) }) : '', textStyle(11, mood < 0 ? '#e8b040' : '#9be883'))
      .setOrigin(1, 0);
    const card = this.add.container(PANEL.x, y, [bg, icon, title, pay, route, status, tag]).setDepth(UI_DEPTH + 1);
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => (dispatch(this.state, o.id) ? sfx('send') : ui('refuse')));
    return card;
  }
}
