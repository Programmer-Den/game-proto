import { pickUpPad, upgradePad, type UpgradeIcon } from '../art/markers';
import Phaser from 'phaser';
import { settings as hubSettings } from '../../../../shared/settings';
import { formatNumber } from '../../../../shared/i18n';
import { playMusic, playSting, ui } from '../../../../shared/audio';
import { RUSH_SONG, SONG, sfx, type SfxName } from '../audio';
import { scrollingCamera, viewFrame, viewPoint, viewSize } from '../../../../shared/scaling';
import { PIXIE_FRAMES, drawFairyPaths, laneOffset, pointAlong } from '../art/pixies';
import { plantTexture } from '../art/garden';
import { EXPANSION_IMAGE, WALLS_IMAGE, GARDEN_MARGIN, gardenTexture, sceneryLayout } from '../art/ground';
import { itemTexture } from '../art/items';
import { INK, INK_NUM, SERIF, TEXT_HALO, fit, resOf } from '../art/paint';
import { craftsmanTexture, customerTexture } from '../art/townsfolk';
import { BUBBLE_TAIL, cardInset, cardTexture, signTexture, type CardKind } from '../art/ui';
import { catchUp, type AwaySummary } from '../game/away';
import { GROW_MS, ITEMS, PANACEA_RECIPE, PLANTS, POTIONS, REFINE, REFINED, isFine, isPlant, isPotion, isRefined, isSellable, plainOf, type ItemId, type SellableId } from '../game/items';
import {
  clearBlight,
  collectTill,
  cycleSign,
  doneByHand,
  isBlighted,
  replantGarden,
  dropItem,
  dropAtRefiner,
  dropInCauldron,
  harvest,
  isRipe,
  payBelt,
  payCraftsman,
  payExpansion,
  joinGuild,
  payUpgrade,
  payShade,
  pickUpFromCauldron,
  pickUpFromRefiner,
  refining,
  stockShelf,
  tick,
  type ExpansionPart,
  cyclePriority,
  buyHerb,
  cycleMarketPick,
  sellHerb,
  serveOrder,
  sellToWagon,
  type Feedback,
} from '../game/sim';
import { clearSave, loadState, saveState } from '../game/save';
import { townOpen } from '../game/town';
import { tickTown } from '../game/townSim';
import { leaveFor } from './townKit';
import { addWeather } from './weather';
import { setupZoom } from './zoom';
import {
  BELTS,
  BELT_COST,
  BELT_LANES,
  BELT_MS,
  DOCTOR_UPGRADES,
  EXPANSION_COST,
  LINE2_GARDEN,
  MAX_CARRY,
  MAX_CRAFTSMEN,
  GUILD_UPGRADES,
  MAX_ORDER_SLOTS,
  SERVE_MS,
  beltBuildable,
  gardenBuilt,
  gardenOf,
  UPGRADES,
  RESEARCH_ORDER,
  researched,
  studied,
  LESSONS,
  shadeGrown,
  carryCapacity,
  craftsmanCost,
  harvestReach,
  stationBuilt,
  stockFactor,
  unlocked,
  GUILD_COST,
  upgradeCost,
  type BeltId,
  type Build,
  type CauldronId,
  type CraftingId,
  type GameState,
  type RefinerId,
  type StationId,
  type Upgrade,
  type UpgradeId,
  walkSpeed,
  DAY_MS,
  RUSH_BONUS,
  tipLeft,
  tipNow,
  FINE_SHARE,
  SHADE_COST,
  SHADE_GARDEN,
  WEATHER,
  isMarketDay,
  weatherFor,
  GARDEN_NAMES,
  GARDEN_NAMES_IN,
  SEAL_PRICE,
  SEASON_GAP,
  herbBuyPrice,
  herbSellPrice,
  marketOpen,
  stagesFor,
  storage,
  wagonHere,
  RIVAL_CUT,
  RIVAL_MONTH_DAYS,
  RIVAL_SALES,
  SIGN_NAMES,
  SIGN_PAY,
  gardenPlant,
  panaceaUnlocked,
  plagueStage,
  rivalUndercuts,
  signOf,
  payBoost,
  payment,
} from '../game/state';
import { checkTrophies } from '../trophies/check';
import { BackStack } from '../ui/BackStack';
import { IconRow } from '../ui/IconRow';
import { Pallet } from '../ui/Pallet';
import { Shelf } from '../ui/Shelf';
import { RecipeBook } from '../ui/RecipeBook';
import { Settings } from '../ui/Settings';
import { ProgressBar } from '../ui/ProgressBar';
import { COIN, itemName, potionCount, t, type TextKey } from '../i18n';
import { coined } from '../ui/coins';
import {
  BELT_BUILD,
  BELT_PATHS,
  beltSpan,
  CAULDRON,
  CAULDRON2,
  CAULDRON2_MARKERS,
  CAULDRON_MARKERS,
  COUNTER,
  COUNTER_MARKERS,
  CRAFTSMEN,
  EXPANSION_LAND,
  GARDEN_AREAS,
  GUILD,
  HUD_HEIGHT,
  LABELS,
  PRIORITY_SIGNS,
  OUTFITTER,
  PALLETS,
  REFINER,
  REFINER2,
  REFINER2_MARKERS,
  REFINER_MARKERS,
  SHOP_SIGN,
  SHOP_DOOR,
  SHOP_BLOCKS,
  SHOP_DOORWAY,
  STREET,
  WORLD,
  HERB_MARKET,
  LINE2_BELTS,
  WAGON,
  customerPosition,
  plotPosition,
  type StationMarkers,
  type StationPallets,
  STUDY,
  RIVAL,
  shelfPosition,
  shelfSignPosition,
} from './layout';

type Point = { x: number; y: number };

/** Walking speed in pixels per second, before the doctor's boots are upgraded. */
const SPEED = 160;
/**
 * Most the doctor walks in one physics step. A long frame walks slower instead, so its one step can't
 * carry the feet through a station.
 */
const MAX_WALK_STEP_PX = 20;
/** Longest simulated step, so a backgrounded tab doesn't jump the world forward. */
const MAX_STEP_MS = 250;
const UI_DEPTH = 10_000;
/**
 * The floating touch stick, in screen pixels: rim and knob radius, the dead zone, and how far a
 * finger drags before a touch steers instead of walking to where it landed.
 */
const STICK = { r: 60, knob: 24, dead: 8, drag: 14 };
/** Bars, icons and feedback over the world, kept under the top bar and panels when the camera scrolls them up there. */
const WORLD_UI_DEPTH = UI_DEPTH - 1;
const AUTOSAVE_MS = 3_000;
/** How fast customers walk, in pixels per second. */
const CUSTOMER_SPEED = 120;
/** How often a floor marker moves the next item while the doctor stands on it. */
const MARKER_INTERVAL_MS = 200;
/** Pause between plants when several in reach are ripe, so each pickup can be seen. */
const HARVEST_INTERVAL_MS = 150;
/** Sickle spin speed in radians per millisecond, its size, and how long it keeps spinning after the
 * last ripe plant in reach. It circles on the edge of the harvest radius, tracing the area. */
const SICKLE_SPIN = 0.008;
const SICKLE_SCALE = 1;
const SICKLE_LINGER_MS = 400;
/** Width of a crafting station's priority sign, wide enough for "First:" and its choice. */
const PRIORITY_SIGN_W = 92;
/** Width of a shelf's price sign, wide enough for "Cheap". */
const PRICE_SIGN_W = 48;
/** Width of a garden's sign, wide enough for any of `GARDEN_NAMES` and the plant's icon. */
const GARDEN_SIGN_W = 128;
/** The plague card, under the town card and the away chip, clear of the shop's shelves when the doctor is at the counter. */
const PLAGUE_CARD = { x: 626, y: 150, w: 316, h: 44 };
/** A blighted plant is drawn in a sickly violet-grey. */
const BLIGHT_TINT = 0x8a7aa0;
/** How opaque the cards over the world are (the contract, town, plague and order cards and the hands), so the yard shows through. */
const HUD_CARD_ALPHA = 0.72;
/** How long the doctor stands still on a purple marker before it starts taking coins, so walking over one buys nothing. */
const STILL_MS = 400;
/**
 * Floor marker captions: outlined so they read on dirt, grass and boards alike, and wrapped so a
 * long one doesn't run into its neighbour's.
 */
const CAPTION = {
  fontFamily: SERIF,
  fontSize: '12px',
  fontStyle: 'bold',
  stroke: TEXT_HALO,
  strokeThickness: 3,
  align: 'center',
  wordWrap: { width: 92 },
};
/**
 * How wide a marker's caption may run where its neighbours stand close: in a station's row
 * (`COINS_GAP` apart), at a belt's build marker in that row, and in the markets (the outfitter, the
 * guild and the herb market, 90 apart). A longer caption there is set a size or two smaller
 * (`fitCaption`) rather than run into the next.
 */
const ROW_CAPTION = 62;
const BELT_CAPTION = 68;
const MARKET_CAPTION = 84;
/** The study's lessons' captions get a little more, so "Crafting order" and its cost stay on one line. */
const LESSON_CAPTION = 110;
/** Caption colours: ink for the doctor's markers, violet for the ones that take coins. */
const CAPTION_INK = INK;
const CAPTION_PAY = '#5a2c80';
/** The top bar's text: ink on parchment. */
const HUD_TEXT = { fontFamily: SERIF, fontSize: '17px', fontStyle: 'bold', color: INK };
/** The top bar's day sky, from and to these offsets from the bar's middle. */
const DAY_BAR = { left: -140, right: 90 };
/** The square Settings button with its cogwheel. */
const HUD_ICON_BUTTON = 36;
/** The hands card at the bottom of the screen: its height and the slots' spacing. */
const HANDS_BAR = { h: 40, gap: 40 };
/** Pixies fly above everything standing in the world, under the order bubbles and bars. */
const PIXIE_DEPTH = 5000;
/** How long before the end of its route a pixie turns off towards the pallet or shelf its goods go on. */
const PIXIE_APPROACH_MS = 700;
/** The station each belt's pixies carry goods to. */
const BELT_TARGET: Record<BeltId, StationId> = {
  garden: 'refiner',
  refiner: 'cauldron',
  cauldron: 'counter',
  garden2: 'refiner2',
  refiner2: 'cauldron2',
  cauldron2: 'counter',
};
/** The row of order cards under the top bar on the left, one per customer. */
const ORDER_STRIP = { x: 8, y: 50, w: 44, h: 34, gap: 4 };
/** The weather is drawn over everything standing in the world and the pixies, under the bubbles and bars. */
const WEATHER_DEPTH = 9990;
const CONTRACT_CARD = { x: 313, y: 50, w: 300, h: 44 };
/** The town card, right of the contract: the day's weather, the street's reputation and the market day. */
const TOWN_CARD = { x: 626, y: 50, w: 316, h: 44 };
const AWAY_CHIP = { x: 652, y: 102, w: 290, h: 30 };
/** The order bubble over a waiting customer: its height, how far above the customer's middle its middle is, the spacing of its icons, and its tip ring's radius. */
const BUBBLE = { h: 30, above: 58, icon: 15, ring: 6 };
/** The refining bar's fill: a strong amber, since the cream track hides anything paler. */
const REFINING_BAR = 0xc8741e;
/** The refining bars' height, a little taller than the 6px default so they read under the table. */
const REFINING_BAR_H = 8;

/** A floor marker that acts by itself, one step at a time, while the doctor stands on it. */
interface Marker {
  zone: Phaser.Geom.Rectangle;
  act: () => Feedback | null;
  /** Whether the marker is there at all; markers a belt replaces go once it is built. */
  shown: () => boolean;
  /** Set once an upgrade level is paid off; the next level waits until the doctor steps off and on again. */
  paused?: boolean;
  /** A purple marker that takes coins: it pays only once the doctor has stood still on it for `STILL_MS`. */
  pays?: boolean;
}

/** A whole percentage or price change with its sign, such as +20 or -15, in the player's language. */
const signed = (n: number) => `${n > 0 ? '+' : ''}${formatNumber(n)}`;

/** A purple level marker's icon: the station for a station's level, the study's book for its lessons, otherwise the upgrade's own. */
const upgradeIcon = (id: UpgradeId): UpgradeIcon =>
  id === 'refiner' || id === 'refiner2' ? 'refiner' : id === 'cauldron' || id === 'cauldron2' ? 'cauldron' : id === 'craftOrder' || id === 'priceSigns' || id === 'replant' ? 'research' : id;

export class GameScene extends Phaser.Scene {
  private state!: GameState;
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private pointerTarget: Phaser.Math.Vector2 | null = null;
  /** A corner to walk to first when a station stands between the doctor and the tapped spot. */
  private waypoint: Phaser.Math.Vector2 | null = null;
  /** Which way the doctor set off towards the tapped spot (or corner) last frame. */
  private heading: Phaser.Math.Vector2 | null = null;
  /**
   * A finger on the map, in screen pixels: where it went down and where it is now. Dragged past
   * `STICK.drag` it goes `live` and steers like a joystick; until then it is an ordinary tap.
   */
  private stick: { id: number; ox: number; oy: number; x: number; y: number; live: boolean } | null = null;
  private stickGfx!: Phaser.GameObjects.Graphics;
  /** Station footprints grown by the doctor's feet, used to walk around stations after a tap. */
  private blockedAreas: Phaser.Geom.Rectangle[] = [];
  /** The shop as measured for the doctor's feet, and the feet's half size it was measured for. */
  private shopMeasured: ReturnType<GameScene['measureShop']> | null = null;
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private markers: Marker[] = [];
  /** Work spots: the station whose spot holds the doctor's feet is the one that works. */
  private workSpots: { zone: Phaser.Geom.Rectangle; station: StationId }[] = [];
  private nextMarkerAt = 0;
  /** Since when the doctor has stood still, by `this.time.now`, or null while walking. */
  private stillSince: number | null = null;
  /** The marker the doctor's feet are on, and since when: paying speeds up the longer they stay. */
  private lastMarker?: Marker;
  private markerSince = 0;
  /** The purple marker that last refused to take coins, so its buzz plays once until the doctor steps off. */
  private refusedMarker: Marker | null = null;
  /** Plot centres, in plot order, for finding ripe plants within the doctor's reach. */
  private plotCentres: Phaser.Math.Vector2[] = [];
  private nextHarvestAt = 0;
  /** Spins around the doctor while harvesting. */
  private sickle!: Phaser.GameObjects.Image;
  private sickleAngle = 0;
  private lastHarvestingAt = -Infinity;
  private nextFeedbackAt = 0;
  /** Each standing station's pallets, for goods coming in and going out; read by the playthrough test. */
  private pallets: Partial<Record<StationId, { in: { item: ItemId; count: number }[]; out: { item: ItemId; count: number }[] }>> = {};
  /** Game time of the frame being drawn, for things that move on their own. */
  private frameMs = 0;
  /** Where each customer in the shop stands, and whether they have reached their spot; read by the playthrough test. */
  customers: { id: number; x: number; y: number; arrived: boolean }[] = [];
  /** The orders whose customers have reached the counter, so they can be served. */
  private atCounter = new Set<number>();
  /** The recipe overview opened from the top bar. */
  private recipes!: RecipeBook;
  /** The settings panel opened from the top bar: the hub's settings and a new game. */
  private settings!: Settings;
  /** Set once a new game is confirmed, so nothing saves the old one before the scene restarts. */
  private startingOver = false;
  /** Per-frame view updates, each reading from `state`. */
  private views: (() => void)[] = [];
  /** Draws the top bar and panels at a fixed size, while the main camera zooms the world. */
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  /** What the craftsmen and belts earned while the player was away, shown on a chip until tapped. */
  away: AwaySummary | null = null;
  /** The panel shown once the town is cured, until tapped away. */
  private winPanel: Phaser.GameObjects.Container | null = null;
  /** The plague as it was saved, before the time away was played, so the card can tell what changed while away. */
  private plagueSaved: { stage: number; relapses: number; cured: boolean; season: number } | null = null;

  constructor() {
    super('Game');
  }

  create(data?: { state?: GameState }) {
    // Back from the town the live state comes as scene data; otherwise the save is loaded.
    this.state = data?.state ?? loadState();
    // Back from the town the card goes on from the plague it last saw, so a cure brewed there is told too.
    const saved = this.state.plague;
    if (!data?.state) this.plagueSaved = saved ? { stage: saved.stage, relapses: saved.relapses, cured: saved.cured, season: saved.season ?? 0 } : null;
    // Play through the time away, before anything is drawn from the state.
    this.away = catchUp(this.state, Date.now());
    this.startingOver = false;
    this.plotCentres = [];
    this.markers = [];
    this.workSpots = [];
    this.pallets = {};
    this.views = [];
    this.pointerTarget = null;
    this.waypoint = null;
    this.blockedAreas = [];
    this.atCounter = new Set();
    this.shopMeasured = null;
    this.winPanel = null;
    this.refusedMarker = null;
    this.physics.world.setBounds(0, HUD_HEIGHT, WORLD.w, WORLD.h - HUD_HEIGHT);
    // Restarting the scene for a new game keeps its event listeners, so this one is added once.
    this.events.off(Phaser.Scenes.Events.PRE_UPDATE, this.limitWalkStep, this);
    this.events.on(Phaser.Scenes.Events.PRE_UPDATE, this.limitWalkStep, this);
    this.obstacles = this.physics.add.staticGroup();

    this.drawGrounds();
    this.createPlots();
    this.createStations();
    this.createExpansion();
    this.createOutfitter();
    this.createGuild();
    this.createStudy();
    this.createBelts();
    this.createPlayer();
    this.followPlayer();
    this.createShopfront();
    this.createHud();
    this.createContract();
    this.createPlague();
    this.createTown();
    this.createRival();
    this.createWagon();
    this.createHerbMarket();
    this.createOrderStrip();
    this.views.push(addWeather(this, WORLD, WEATHER_DEPTH, () => this.state));
    this.createAwayChip();
    this.createSound();
    this.createUiCamera();
    this.createControls();
    setupZoom(this, WORLD);
    this.setUpSaving();
  }

  private setUpSaving() {
    const save = () => {
      if (!this.startingOver) saveState(this.state);
    };
    const onHide = () => {
      if (document.visibilityState === 'hidden') save();
    };
    this.time.addEvent({ delay: AUTOSAVE_MS, loop: true, callback: save });
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
    });
  }

  private startOver() {
    if (!window.confirm(t('confirmNewGame'))) return;
    this.startingOver = true;
    clearSave();
    // Fresh scene data, or the restart would keep the state handed over from the town.
    this.scene.restart({});
  }

  /** The world is bigger than the view, so the camera keeps the doctor in sight within its edges. */
  private followPlayer() {
    scrollingCamera(this.cameras.main).setBounds(0, 0, WORLD.w, WORLD.h).startFollow(this.player, true);
  }

  /**
   * A second camera, never zoomed or scrolled by the player, draws everything from `UI_DEPTH` up (the top bar and
   * its panels), and the main camera draws the rest, so zooming leaves the top bar as it is.
   * `splitCameras` sorts each object, including ones created later, every frame.
   */
  private createUiCamera() {
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.splitCameras();
  }

  private splitCameras() {
    const world = this.cameras.main.id;
    const ui = this.uiCamera.id;
    for (const obj of this.children.list) obj.cameraFilter = (obj as unknown as { depth: number }).depth >= UI_DEPTH ? world : ui;
  }

  /** A painted piece of ground laid flat, its top-left corner at (x, y). */
  private ground(x: number, y: number, texture: string, depth = -1000) {
    return fit(this.add.image(x, y, texture).setOrigin(0).setDepth(depth));
  }

  /** A garden: meadow inside a picket fence, with its name on a sign that replants it when tapped. */
  private drawGarden(garden: number) {
    const area = GARDEN_AREAS[garden];
    this.ground(area.x - GARDEN_MARGIN, area.y - GARDEN_MARGIN, gardenTexture(garden), -990);
    this.addGardenSign(garden, { x: area.x + area.w / 2, y: area.y + 10 });
  }

  /**
   * A garden's sign: the plant its beds grow, by name and icon. Tapping it switches every bed to the
   * next plant the line grows, which starts again from seed; the tap doesn't walk the doctor.
   */
  private addGardenSign(garden: number, at: Point) {
    const sign = this.card(at.x, at.y, 'sign', signTexture(this, GARDEN_SIGN_W)).setDepth(-910);
    const name = this.add
      .text(at.x + 8, at.y, '', { fontFamily: SERIF, fontSize: '13px', fontStyle: 'bold', color: INK })
      .setOrigin(0.5)
      .setDepth(-900);
    const icon = fit(this.add.image(at.x, at.y, itemTexture('wheat')).setDepth(-900));
    sign.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      if (this.pinching()) return;
      if (this.closePanels()) return;
      // Until the study teaches replanting, a tap says where to learn it.
      const before = gardenPlant(this.state, garden);
      const feedback = replantGarden(this.state, garden);
      if (gardenPlant(this.state, garden) === before) ui('refuse');
      else ui('click');
      if (feedback) this.showFeedback(feedback);
    });
    let shown = '';
    this.views.push(() => {
      const plant = gardenPlant(this.state, garden);
      if (plant === shown) return;
      shown = plant;
      name.setText(t(GARDEN_NAMES[plant]));
      icon.setTexture(itemTexture(plant)).setX(name.x - name.width / 2 - 10);
    });
  }

  /** Closes any open panel; true if one was open, so the tap that closed it does nothing else. */
  private closePanels() {
    const open = this.recipes.visible || this.settings.visible || !!this.winPanel;
    this.recipes.toggle(false);
    this.settings.toggle(false);
    this.winPanel?.destroy();
    this.winPanel = null;
    return open;
  }

  /** A place name on a parchment sign. */
  private label(x: number, y: number, text: string) {
    const name = this.add
      .text(x, y, text, { fontFamily: SERIF, fontSize: '13px', fontStyle: 'bold', color: INK })
      .setOrigin(0.5)
      .setDepth(-900);
    this.card(x, y, 'sign', signTexture(this, name.width + 16)).setDepth(-910);
  }

  /** A card image centred on (x, y) by its card, not by its shadow or a bubble's tail. */
  private card(x: number, y: number, kind: CardKind, key: string) {
    const img = fit(this.add.image(x, y, key));
    const inset = cardInset(kind);
    const h = img.height / resOf(key);
    const cardH = h - 2 * inset - (kind === 'bubble' ? BUBBLE_TAIL : 0);
    return img.setOrigin(0.5, (inset + cardH / 2) / h);
  }

  /**
   * A small sign saying what a crafting station makes first: the item's icon, or "any" when it is
   * left to the station. Tapping it moves on to the next choice and doesn't walk the doctor.
   */
  private addPrioritySign(id: CraftingId, at: Point) {
    const sign = this.card(at.x, at.y, 'small', signTexture(this, PRIORITY_SIGN_W, true)).setDepth(-910);
    const left = at.x - PRIORITY_SIGN_W / 2 + 10;
    const style = { fontFamily: SERIF, fontSize: '12px', fontStyle: 'bold', color: INK };
    const caption = this.add.text(left, at.y, t('first'), style).setOrigin(0, 0.5).setDepth(-900);
    const choiceX = left + caption.width + 6;
    const any = this.add.text(choiceX, at.y, t('any'), style).setOrigin(0, 0.5).setDepth(-900);
    const icon = fit(this.add.image(choiceX + 8, at.y, itemTexture('wheat')).setDepth(-900));
    sign.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      // A second finger landing on a sign starts a pinch, not a priority change.
      if (this.pinching()) return;
      // With a panel open, a tap anywhere closes it, a sign's included, without changing the sign.
      if (this.closePanels()) return;
      ui('click');
      cyclePriority(this.state, id);
    });
    // It stands once the study has taught the crafting order.
    this.views.push(() => {
      const shown = studied(this.state, 'craftOrder');
      sign.setVisible(shown);
      caption.setVisible(shown);
      const first = this.state.priority[id];
      any.setVisible(shown && !first);
      icon.setVisible(shown && !!first);
      if (first) icon.setTexture(itemTexture(first));
    });
  }

  /** Runs `create` once, on the first frame `ready` holds: for things bought during play, or loaded built. */
  private once(ready: () => boolean, create: () => void) {
    let done = false;
    this.views.push(() => {
      if (done || !ready()) return;
      done = true;
      create();
    });
  }

  private drawGrounds() {
    // One painted page: grass, the yard and market of packed earth, the street, and the shop's plank
    // floor inside its stone walls, with a back door in the top wall facing the market and the
    // customers' street door in the bottom one (see src/art/ground.ts).
    this.ground(0, 0, 'ground-world');
    // The right column gets its yard once the expansion's land is bought.
    this.once(
      () => this.state.expansion.land.built,
      () => this.ground(EXPANSION_IMAGE.x, EXPANSION_IMAGE.y, 'ground-expansion', -999),
    );
    // The shop's walls lie above both, so the expansion's yard doesn't cover the right one.
    this.ground(WALLS_IMAGE.x, WALLS_IMAGE.y, 'ground-walls', -998);

    // The second line's fields appear as they are built.
    GARDEN_AREAS.forEach((_, garden) => this.once(() => gardenBuilt(this.state, garden), () => this.drawGarden(garden)));

    // Trees and bushes in the grass, in front of or behind the doctor by their feet.
    for (const { key, x, y } of sceneryLayout()) {
      fit(this.add.image(x, y, key)).setOrigin(0.5, key.startsWith('tree') ? 84 / 88 : key === 'hedge' ? 26 / 30 : 28 / 32).setDepth(y);
    }

    for (const block of SHOP_BLOCKS) this.obstacles.add(this.add.zone(block.x + block.w / 2, block.y + block.h / 2, block.w, block.h));

    this.label(SHOP_SIGN.x, SHOP_SIGN.y, t('storefront'));
  }

  private createPlots() {
    this.state.plots.forEach((plot, i) => {
      const { x, y } = plotPosition(i);
      this.plotCentres[i] = new Phaser.Math.Vector2(x, y);
      this.once(
        () => gardenBuilt(this.state, gardenOf(i)),
        () => {
          fit(this.add.image(x, y, 'plot').setDepth(-500));
          const plant = fit(this.add.image(x, y + 10, plantTexture(plot.plant, 2)).setOrigin(0.5, 1).setDepth(y));
          // Inside the bed's bottom edge, since the next row's bed starts right below it.
          const growth = new ProgressBar(this, x, y + 14, 40, 0x9ccf6a, WORLD_UI_DEPTH);
          this.views.push(() => {
            const grown = plot.grown / GROW_MS[plot.plant];
            plant.setTexture(plantTexture(plot.plant, grown >= 1 ? 2 : grown >= 0.5 ? 1 : 0));
            // A blighted bed's plant withers to a sickly violet-grey and its bar goes.
            plant.setTint(plot.blighted ? BLIGHT_TINT : 0xffffff);
            growth.set(grown >= 1 || plot.blighted ? null : grown);
          });
        },
      );
    });
  }

  /** Both lines' refining tables and cauldrons; the second line's stand once built. */
  private createStations() {
    this.addRefiner('refiner', REFINER, REFINER_MARKERS, LABELS.refiner, 'garden', 'refiner');
    this.addCauldron('cauldron', CAULDRON, CAULDRON_MARKERS, LABELS.cauldron, 'refiner', 'cauldron');
    this.once(
      () => stationBuilt(this.state, 'refiner2'),
      () => this.addRefiner('refiner2', REFINER2, REFINER2_MARKERS, LABELS.refiner2, 'garden2', 'refiner2'),
    );
    this.once(
      () => stationBuilt(this.state, 'cauldron2'),
      () => this.addCauldron('cauldron2', CAULDRON2, CAULDRON2_MARKERS, LABELS.cauldron2, 'refiner2', 'cauldron2'),
    );
  }

  /** A refining table, fed by belt `beltIn` and emptied by belt `beltOut` once those are built. */
  private addRefiner(id: RefinerId, at: Point, m: StationMarkers, label: Point, beltIn: BeltId, beltOut: BeltId) {
    const refiner = this.state[id];
    this.label(label.x, label.y, t('refiningTable'));
    this.addPrioritySign(id, PRIORITY_SIGNS[id]);
    this.addObstacle(at.x, at.y, 'table', 84, 30);
    this.addPallets(id, PALLETS[id], [PLANTS, REFINED], [() => refiner.queue, () => refiner.output]);
    const progress = new ProgressBar(this, at.x, at.y + 30, 60, REFINING_BAR, WORLD_UI_DEPTH, REFINING_BAR_H);
    // A second craftsman's pipe shows its own bar just below.
    const progress2 = new ProgressBar(this, at.x, at.y + 41, 60, REFINING_BAR, WORLD_UI_DEPTH, REFINING_BAR_H);
    this.addMarker(m.pickUp, pickUpPad('sack'), t('pickUp'), () => this.sounded(pickUpFromRefiner(this.state, id), 'pickUp'), () => this.state.belts[beltOut].built);
    this.addMarker(m.drop, 'pad-in', t('drop'), () => this.sounded(dropAtRefiner(this.state, id), 'drop'), () => this.state.belts[beltIn].built && !this.carries(isPlant));
    this.addWorkSpot(m.work, id);
    this.addUpgradeMarker(m.upgrade, id);
    this.addCraftsmen(id);
    this.views.push(() => {
      // The plant being refined is always the front one (see tick).
      progress.set(refining(this.state, refiner) >= 0 ? refiner.progress / REFINE[refiner.queue[0]].ms : null);
      progress2.set(refiner.second ? refiner.second.progress / REFINE[refiner.second.plant].ms : null);
    });
  }

  /** A cauldron, fed by belt `beltIn` and emptied by belt `beltOut` once those are built. */
  private addCauldron(id: CauldronId, at: Point, m: StationMarkers, label: Point, beltIn: BeltId, beltOut: BeltId) {
    const cauldron = this.state[id];
    this.label(label.x, label.y, t('cauldron'));
    this.addPrioritySign(id, PRIORITY_SIGNS[id]);
    const pot = this.addObstacle(at.x, at.y, 'cauldron', 60, 28);
    // The boil flickers its flames and bubbles, so reduced motion holds it on the still frame.
    if (!hubSettings.reduceMotion) pot.play('cauldron-boil');
    this.addPallets(id, PALLETS[id], [REFINED, POTIONS], [() => cauldron.contents, () => cauldron.output]);
    // The end of the bar is the fine window: picked up then, the potion comes out fine.
    const brewing = new ProgressBar(this, at.x, at.y + 34, 60, 0x58a35a, WORLD_UI_DEPTH).setZone(1 - FINE_SHARE, 0xe8b830);
    const brewing2 = new ProgressBar(this, at.x, at.y + 42, 60, 0x58a35a, WORLD_UI_DEPTH).setZone(1 - FINE_SHARE, 0xe8b830);
    this.addMarker(m.pickUp, pickUpPad('bottle'), t('pickUp'), () => this.pickUpPotion(id), () => this.state.belts[beltOut].built);
    this.addMarker(m.drop, 'pad-in', t('drop'), () => this.sounded(dropInCauldron(this.state, id), 'drop'), () => this.state.belts[beltIn].built && !this.carries(isRefined));
    this.addWorkSpot(m.work, id);
    this.addUpgradeMarker(m.upgrade, id);
    this.addCraftsmen(id);
    this.views.push(() => {
      for (const [bar, brew] of [
        [brewing, cauldron.brewing],
        [brewing2, cauldron.brewing2],
      ] as const)
        bar.set(brew ? brew.progress / brew.ms : null);
    });
  }

  /**
   * A station's pallets: one per kind of goods coming in (`kinds[0]`, kept in `trays[0]`) and going
   * out (`kinds[1]`, kept in `trays[1]`), each stacked as high as that tray holds of its kind.
   */
  private addPallets(
    id: StationId,
    at: StationPallets,
    kinds: [readonly ItemId[], readonly ItemId[]],
    trays: [() => readonly ItemId[], () => readonly ItemId[]],
  ) {
    const pallets = {
      in: at.in.map((p, i) => new Pallet(this, p.x, p.y, kinds[0][i])),
      out: at.out.map((p, i) => new Pallet(this, p.x, p.y, kinds[1][i])),
    };
    const stack = (row: Pallet[], tray: readonly ItemId[]) => {
      for (const pallet of row) pallet.set(tray.filter((item) => item === pallet.item).length);
    };
    // A pallet stands only once its goods can be made: nightshade's once a shade garden grows, a
    // potion's once its recipe is known. The test reads the pallets standing.
    let standing = '';
    this.views.push(() => {
      const shown = [...pallets.in, ...pallets.out].map((p) => this.available(p.item));
      if (shown.join() !== standing) {
        standing = shown.join();
        for (const pallet of [...pallets.in, ...pallets.out]) pallet.setVisible(this.available(pallet.item));
        this.pallets[id] = { in: pallets.in.filter((p) => this.available(p.item)), out: pallets.out.filter((p) => this.available(p.item)) };
      }
      stack(pallets.in, trays[0]());
      stack(pallets.out, trays[1]());
    });
  }

  /**
   * Whether goods of a kind can be made yet: wheat and mandrakes always, nightshade once a shade
   * garden grows it, a refined good once its plant can be grown, a potion once its recipe is known.
   */
  private available(item: ItemId): boolean {
    if (isPlant(item)) return item !== 'nightshade' || shadeGrown(this.state);
    if (isRefined(item)) return PLANTS.some((plant) => REFINE[plant].out === item && this.available(plant));
    return isPotion(item) && researched(this.state, item);
  }

  /** Lays a floor marker with a caption. A marker a belt replaces goes away once `gone` holds. */
  private addMarker(at: Point, texture: string, caption: string, act: () => Feedback | null, gone?: () => boolean) {
    const pad = fit(this.add.image(at.x, at.y, texture).setDepth(-400));
    const text = coined(
      this.add
        .text(at.x, at.y + 26, caption, { ...CAPTION, color: CAPTION_INK })
        .setOrigin(0.5, 0)
        .setDepth(-400),
    );
    const shown = () => !gone?.();
    this.markers.push({ zone: new Phaser.Geom.Rectangle(at.x - 22, at.y - 22, 44, 44), act, shown });
    if (gone) {
      this.views.push(() => {
        pad.setVisible(shown());
        text.setVisible(shown());
      });
    }
    return text;
  }

  /**
   * Whether the doctor carries something of a kind. A drop marker that a belt made unneeded comes
   * back while the doctor carries what it takes, such as goods from the other line.
   */
  private carries(kind: (item: ItemId) => boolean) {
    return this.state.carrying.some(kind);
  }

  /** The spot the doctor stands on to make the station work, gone once a craftsman is hired there. */
  private addWorkSpot(at: { x: number; y: number }, station: StationId) {
    this.addMarker(at, 'pad-work', t('work'), () => null, () => this.state.craftsmen[station].level > 0);
    this.workSpots.push({ zone: new Phaser.Geom.Rectangle(at.x - 22, at.y - 22, 44, 44), station });
  }

  /** An upgrade marker, captioned with the next level and its price, after `name` if given. */
  private addUpgradeMarker(at: Point, id: UpgradeId, name?: TextKey, room?: number) {
    this.addLevelMarker(
      at,
      upgradeIcon(id),
      () => this.state.upgrades[id],
      UPGRADES[id].max,
      (level) => upgradeCost(id, level),
      () => payUpgrade(this.state, id),
      (level, left) => (name ? t('levelCost', { name: t(name), level: level + 2, coins: left }) : t('stationLevelCost', { level: level + 2, coins: left })),
      () => unlocked(this.state, `level-${id}`),
      room ?? (name ? undefined : ROW_CAPTION),
    );
  }

  /**
   * A purple marker for something bought a level at a time, like an upgrade or a craftsman: standing
   * still on it pays towards the next level, captioned by `caption` with the coins still to pay for
   * it. It is shown while `shown` holds and goes away once the last level is bought. With `room`,
   * the caption is fitted to that width (`fitCaption`).
   */
  private addLevelMarker(
    at: Point,
    icon: UpgradeIcon,
    get: () => Upgrade,
    max: number,
    cost: (level: number) => number,
    pay: () => Feedback | null,
    caption: (level: number, left: number) => string,
    shown: () => boolean = () => true,
    room?: number,
  ) {
    this.addMarker(
      at,
      upgradePad(icon),
      '',
      () => {
        const level = get().level;
        const feedback = pay();
        // A finished level doesn't roll straight into paying for the next.
        if (get().level > level) this.markers[marker].paused = true;
        if (get().level > level) sfx('upgrade');
        else if (feedback) sfx('pay', { pitch: 1 + (0.6 * get().paid) / cost(level) });
        return feedback;
      },
      () => !open(),
    );
    const open = () => shown() && get().level < max;
    const marker = this.markers.length - 1;
    this.markers[marker].pays = true;
    const text = coined(
      this.add
        .text(at.x, at.y + 26, '', { ...CAPTION, color: CAPTION_PAY })
        .setOrigin(0.5, 0)
        .setDepth(-400),
    );
    this.views.push(() => {
      const { level, paid } = get();
      text.setVisible(open());
      if (level < max) this.fitCaption(text, caption(level, cost(level) - paid), room);
    });
  }

  /**
   * A station's craftsmen: a marker to hire them one at a time, and the craftsmen themselves standing
   * by the station once hired.
   */
  private addCraftsmen(id: StationId) {
    const { hire, stand } = CRAFTSMEN[id];
    const hired = () => this.state.craftsmen[id];
    this.addLevelMarker(
      hire,
      'hire',
      hired,
      MAX_CRAFTSMEN,
      craftsmanCost,
      () => payCraftsman(this.state, id),
      (_level, left) => t('hireCost', { coins: left }),
      () => unlocked(this.state, `hire-${id}`),
      ROW_CAPTION,
    );
    stand.forEach((at, i) => {
      const craftsman = fit(this.add.image(at.x, at.y, craftsmanTexture(i)).setOrigin(0.5, 1).setDepth(at.y).setFlipX(i === 1));
      this.views.push(() => {
        craftsman.setVisible(hired().level > i);
        // At work, a craftsman rocks to and fro over the station (grinding, stirring or handing
        // potions over) and bobs with each stroke; idle, or with reduced motion, they stand still.
        const busy = hired().level > i && !hubSettings.reduceMotion && this.craftsmanBusy(id, i);
        const stroke = busy ? Math.sin(this.time.now / 140 + i * 1.3) : 0;
        craftsman.setRotation(stroke * 0.07 * (i === 1 ? -1 : 1)).setY(at.y - Math.abs(stroke) * 2);
      });
    });
  }

  /**
   * Whether craftsman `i` at a station has work in hand: at a refining table or cauldron the first
   * works its first pipe and the second its second; at the counter both serve customers.
   */
  private craftsmanBusy(id: StationId, i: number) {
    if (id === 'counter') return (this.state.counter.serving ?? 0) > 0;
    if (id === 'refiner' || id === 'refiner2') {
      const refiner = this.state[id];
      return i === 0 ? refining(this.state, refiner, this.state.priority[id]) >= 0 : !!refiner.second;
    }
    const cauldron = this.state[id];
    return !!(i === 0 ? cauldron.brewing : cauldron.brewing2);
  }

  /**
   * A purple build marker captioned with the coins still to pay for the build, shown while `shown`
   * holds; standing still on it pays towards the build. With `room`, the caption is fitted to that
   * width (`fitCaption`).
   */
  private addBuildMarker(
    at: Point,
    icon: UpgradeIcon,
    caption: TextKey,
    cost: number,
    build: Build,
    shown: () => boolean,
    act: () => Feedback | null,
    room?: number,
  ) {
    const pad = fit(this.add.image(at.x, at.y, upgradePad(icon)).setDepth(-400));
    const text = coined(
      this.add
        .text(at.x, at.y + 26, '', { ...CAPTION, color: CAPTION_PAY })
        .setOrigin(0.5, 0)
        .setDepth(-400),
    );
    const payAndSound = () => {
      const feedback = act();
      if (build.built && feedback) sfx('upgrade');
      else if (feedback) sfx('pay', { pitch: 1 + (0.6 * build.paid) / cost });
      return feedback;
    };
    this.markers.push({ zone: new Phaser.Geom.Rectangle(at.x - 22, at.y - 22, 44, 44), act: payAndSound, shown, pays: true });
    this.views.push(() => {
      const show = shown();
      pad.setVisible(show);
      text.setVisible(show);
      this.fitCaption(text, t('buildCost', { name: t(caption), coins: cost - build.paid }), room);
    });
  }

  /**
   * Shows `caption` under a purple marker. Without `room` it wraps at the caption's width as usual;
   * with it, a caption wider than `room` is set a size or two smaller, and wraps at `room` if that is
   * still too wide, so it doesn't run into the markers beside it.
   */
  private fitCaption(text: Phaser.GameObjects.Text, caption: string, room?: number) {
    if (text.text === caption) return;
    if (room === undefined) {
      text.setText(caption);
      return;
    }
    text.setWordWrapWidth(null).setFontSize(CAPTION.fontSize).setText(caption);
    for (let size = parseInt(CAPTION.fontSize) - 1; text.width > room && size >= 10; size--) text.setFontSize(size);
    if (text.width > room) text.setFontSize(CAPTION.fontSize).setWordWrapWidth(room);
  }

  /**
   * The expansion: a marker to buy the land on the grass right of the shop, then one for each field,
   * the refining table and the cauldron of the second line, where each will go.
   */
  private createExpansion() {
    const { expansion } = this.state;
    this.addBuildMarker(EXPANSION_LAND, 'land', 'land', EXPANSION_COST.land, expansion.land, () => !expansion.land.built && unlocked(this.state, 'land'), () =>
      payExpansion(this.state, 'land'),
    );
    const parts: { part: ExpansionPart; at: Point; icon: UpgradeIcon; caption: TextKey; cost: number; build: Build }[] = [
      ...expansion.fields.map((build, i) => {
        const area = GARDEN_AREAS[LINE2_GARDEN + i];
        return {
          part: (i === 0 ? 'field1' : 'field2') as ExpansionPart,
          at: { x: area.x + area.w / 2, y: area.y + area.h / 2 },
          icon: 'field' as const,
          caption: area.name,
          cost: EXPANSION_COST.field,
          build,
        };
      }),
      // The stations are bought from where their work spots will be, clear of where they will stand.
      { part: 'refiner', at: REFINER2_MARKERS.work, icon: 'refiner', caption: 'table', cost: EXPANSION_COST.refiner, build: expansion.refiner },
      { part: 'cauldron', at: CAULDRON2_MARKERS.work, icon: 'cauldron', caption: 'cauldron', cost: EXPANSION_COST.cauldron, build: expansion.cauldron },
    ];
    for (const { part, at, icon, caption, cost, build } of parts) {
      this.addBuildMarker(at, icon, caption, cost, build, () => expansion.land.built && !build.built, () => payExpansion(this.state, part));
    }
    // The shade gardens, bought in the middle of where each will grow: the first line's once the
    // garden belt is built, the second line's once the expansion's land is bought.
    const { shade } = this.state;
    ([0, 1] as const).forEach((line) => {
      const area = GARDEN_AREAS[SHADE_GARDEN + line];
      const shown = () => !shade[line].built && (line === 0 ? unlocked(this.state, 'shade') : expansion.land.built);
      this.addBuildMarker({ x: area.x + area.w / 2, y: area.y + area.h / 2 + 10 }, 'shade', 'shadeGarden', SHADE_COST[line], shade[line], shown, () =>
        payShade(this.state, line),
      );
    });
  }

  /**
   * Pixies, which carry goods between the stations in place of conveyor belts: a build marker for
   * each route once the stations at its ends stand, until it is paid off; then a faint trail of fairy
   * dust along the route and a pixie carrying each item along it. All built routes are drawn as one
   * image. Near the end of its route a pixie flies over to the pallet or shelf its goods go on, and
   * waits there while it is full.
   */
  private createBelts() {
    let network: Phaser.GameObjects.Image | null = null;
    let drawn = '';
    this.views.push(() => {
      const built = BELTS.filter((id) => this.state.belts[id].built);
      if (built.join() === drawn) return;
      drawn = built.join();
      network?.destroy();
      network = built.length > 0 ? drawFairyPaths(this, built.flatMap((id) => BELT_PATHS[id]), -600) : null;
    });

    for (const id of BELTS) {
      const belt = this.state.belts[id];
      this.addBuildMarker(BELT_BUILD[id], 'pixies', 'pixies', BELT_COST[id], belt, () => !belt.built && beltBuildable(this.state, id) && unlocked(this.state, `belt-${id}`), () =>
        payBelt(this.state, id),
        BELT_CAPTION,
      );
      const riding: { pixie: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image }[] = [];
      const [main, ...feeders] = BELT_PATHS[id];
      // For each kind of goods: the run it gets on at, where on the main run that starts and joins,
      // and how far across the route its pixies fly.
      const lanes = BELT_LANES[id];
      // The second line's routes head left, so its lanes are counted from the other side to stay in the pallets' order.
      const side = LINE2_BELTS.includes(id) ? -1 : 1;
      const offs = new Map(lanes.map((kind, lane) => [kind, side * laneOffset(lane, lanes.length)]));
      const approach = BELT_MS[id] - PIXIE_APPROACH_MS;
      this.views.push(() => {
        while (riding.length < belt.items.length) {
          riding.push({
            pixie: fit(this.add.image(0, 0, PIXIE_FRAMES[0]).setDepth(PIXIE_DEPTH + 0.1)),
            icon: fit(this.add.image(0, 0, itemTexture(belt.items[0].id)), 0.8).setDepth(PIXIE_DEPTH),
          });
        }
        riding.forEach(({ pixie, icon }, i) => {
          const item = belt.items[i];
          if (!item) {
            pixie.setVisible(false);
            icon.setVisible(false);
            return;
          }
          // Goods loaded from the doctor's hands wait out of sight until their turn to set off. They
          // ride the run of the garden they came from, or their kind's. A kind with no lane of its own
          // (from an edited save) flies down the middle of the main run.
          const { run, start, join } = beltSpan(id, item.id, item.run);
          const off = offs.get(item.id) ?? 0;
          pixie.setVisible(item.at >= start);
          icon.setVisible(item.at >= start);
          // Along the main run, off to the side for the item's kind. On a feeder, the pixie drifts over
          // to that side as it goes, so it carries straight on where the feeder joins.
          const along = (at: number) => {
            let { x, y, dx, dy } = pointAlong(main, Math.max(at, join) / BELT_MS[id]);
            let across = off;
            if (run > 0 && at < join) {
              const t = (at - start) / (join - start);
              ({ x, y } = pointAlong(feeders[run - 1], t));
              across = off * Math.max(0, t);
            }
            return { x: x - dy * across, y: y + dx * across };
          };
          let at = along(item.at);
          // The last stretch: over to its own pallet or shelf at the next station.
          const to = item.at > approach ? this.dropSpot(id, item.id) : null;
          if (to) {
            const from = along(approach);
            const t = Math.min(1, (item.at - approach) / PIXIE_APPROACH_MS);
            at = { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t };
          }
          // Wings beat and the pixie bobs as it flies, each a little out of step with the others;
          // with reduced motion it glides.
          const beat = hubSettings.reduceMotion ? 0 : Math.floor(this.time.now / 110 + i) % 2;
          const bob = hubSettings.reduceMotion ? 0 : Math.sin(this.time.now / 160 + i * 1.7) * 1.5;
          pixie.setTexture(PIXIE_FRAMES[beat]).setPosition(at.x, at.y - 13 + bob);
          icon.setTexture(itemTexture(item.id)).setPosition(at.x, at.y + bob);
        });
      });
    }
  }

  /**
   * Where a pixie on belt `id` sets goods of a kind down: over that kind's pallet at the next
   * station, or its shelf in the shop.
   */
  private dropSpot(id: BeltId, kind: ItemId): Point | null {
    const target = BELT_TARGET[id];
    if (target === 'counter') {
      const i = POTIONS.indexOf(plainOf(kind as SellableId));
      if (i < 0) return null;
      const at = shelfPosition(i);
      return { x: at.x, y: at.y - 50 };
    }
    const kinds: readonly ItemId[] = target === 'refiner' || target === 'refiner2' ? PLANTS : REFINED;
    const at = PALLETS[target].in[kinds.indexOf(kind)];
    return at ? { x: at.x, y: at.y - 24 } : null;
  }

  /** The outfitter's stall right of the shop: upgrades for the doctor's pack, boots and sickle. */
  private createOutfitter() {
    this.label(OUTFITTER.sign.x, OUTFITTER.sign.y, t('outfitter'));
    for (const id of DOCTOR_UPGRADES) this.addUpgradeMarker(OUTFITTER[id], id, UPGRADES[id].name, MARKET_CAPTION);
  }

  /** The guild in the corner of the yard: upgrades for the gardens, the belts and the shop. */
  private createGuild() {
    this.label(GUILD.sign.x, GUILD.sign.y, t('guild'));
    // Its upgrades go up for sale once the doctor has paid to join.
    const { guild } = this.state;
    this.addBuildMarker(GUILD.join, 'guild', 'joinGuild', GUILD_COST, guild, () => !guild.built && unlocked(this.state, 'guild'), () => joinGuild(this.state), MARKET_CAPTION);
    for (const id of GUILD_UPGRADES) this.addUpgradeMarker(GUILD[id], id, UPGRADES[id].name, MARKET_CAPTION);
  }

  /**
   * The study in the market: a writing desk and a marker where each level paid teaches the next
   * recipe in `RESEARCH_ORDER`, captioned with its name.
   */
  private createStudy() {
    this.label(STUDY.sign.x, STUDY.sign.y, t('study'));
    this.addObstacle(STUDY.desk.x, STUDY.desk.y, 'study', 60, 16);
    this.addLevelMarker(
      STUDY.learn,
      'research',
      () => this.state.upgrades.research,
      UPGRADES.research.max,
      (level) => upgradeCost('research', level),
      () => payUpgrade(this.state, 'research'),
      (level, left) => t('learnCost', { potion: itemName(RESEARCH_ORDER[level]), coins: left }),
      () => unlocked(this.state, 'level-research'),
    );
    for (const id of LESSONS) {
      this.addLevelMarker(
        STUDY[id],
        'research',
        () => this.state.upgrades[id],
        UPGRADES[id].max,
        (level) => upgradeCost(id, level),
        () => payUpgrade(this.state, id),
        (_level, left) => t('learnCost', { potion: t(UPGRADES[id].name), coins: left }),
        () => unlocked(this.state, `level-${id}`),
        LESSON_CAPTION,
      );
    }
  }

  private createShopfront() {
    this.addObstacle(COUNTER.x, COUNTER.y, 'counter', 200, 30);
    // A shelf for each potion along the side walls, standing once the apothecary has learned it. Below
    // each, how much less the next one sells for while the shop is well stocked.
    const shelves = POTIONS.map((potion, i) => new Shelf(this, shelfPosition(i).x, shelfPosition(i).y, potion));
    const cuts = POTIONS.map((_, i) =>
      this.add
        .text(shelfPosition(i).x, shelfPosition(i).y + 2, '', { fontFamily: SERIF, fontSize: '10px', fontStyle: 'bold', color: '#8a3a10', stroke: TEXT_HALO, strokeThickness: 3 })
        .setOrigin(0.5, 0)
        .setDepth(WORLD_UI_DEPTH),
    );
    // Each shelf's price sign, which a tap moves on: Fair, Dear, Cheap.
    const signs = POTIONS.map((potion, i) => this.addPriceSign(potion, shelfSignPosition(i)));
    this.pallets.counter = { in: [], out: [] };
    let row = '';
    this.views.push(() => {
      const { shelf } = this.state.counter;
      const known = POTIONS.filter((p) => researched(this.state, p));
      // The price signs stand once the study has taught them.
      const priced = studied(this.state, 'priceSigns');
      if (`${known.join()}${priced}` !== row) {
        row = `${known.join()}${priced}`;
        shelves.forEach((s, i) => s.setVisible(known.includes(POTIONS[i])));
        signs.forEach((show, i) => show(priced && known.includes(POTIONS[i])));
        // The test reads the shelves standing, in POTIONS order.
        this.pallets.counter!.in = shelves.filter((_, i) => known.includes(POTIONS[i]));
      }
      POTIONS.forEach((potion, i) => {
        if (!known.includes(potion)) return cuts[i].setText('');
        shelves[i].set(shelf);
        const stocked = shelf.filter((p) => plainOf(p) === potion).length;
        // What the next plain one sells for against the price: the stock cut, the sign and the rival's cut.
        const rival = rivalUndercuts(this.state, potion);
        const factor = stockFactor(stocked, storage(this.state)) * SIGN_PAY[signOf(this.state, potion)] * (rival ? 1 - RIVAL_CUT : 1);
        const off = Math.round(100 * (factor - 1));
        cuts[i].setText(off === 0 ? '' : rival ? t('rivalCut', { n: signed(off) }) : `${signed(off)}%`).setColor(off > 0 ? '#2f6a1a' : '#8a3a10');
      });
    });
    // Potions are stocked by hand until every cauldron standing has its belt to the counter, and
    // whenever the doctor carries one.
    const allBelted = () => !doneByHand(this.state, 'cauldron') && !doneByHand(this.state, 'cauldron2');
    this.addMarker(COUNTER_MARKERS.drop, 'pad-in', t('drop'), () => this.sounded(stockShelf(this.state), 'drop'), () => allBelted() && !this.carries(isSellable));
    // The till: a coin beside the pick-up arrow, and what it holds as the caption.
    const till = this.addMarker(COUNTER_MARKERS.pickUp, pickUpPad('coin'), '', () => this.sounded(collectTill(this.state), 'cascade'));
    this.addWorkSpot(COUNTER_MARKERS.work, 'counter');
    this.addUpgradeMarker(COUNTER_MARKERS.upgrade, 'counter');
    this.addCraftsmen('counter');
    this.views.push(() => {
      const { counter } = this.state;
      till.setText(counter.till > 0 ? `${formatNumber(counter.till)}${COIN}` : '');
    });

    // How far the counter's craftsmen are with handing over the next potion.
    const serving = new ProgressBar(this, COUNTER.x, COUNTER.y + 36, 44, 0x9ccf6a, WORLD_UI_DEPTH);
    this.views.push(() => {
      const done = this.state.counter.serving ?? 0;
      serving.set(this.state.craftsmen.counter.level > 0 && done > 0 ? done / SERVE_MS : null);
    });

    // One customer slot per possible order; slot i shows the i-th open order once its customer has
    // walked up to it.
    const customers = new Map<number, Phaser.GameObjects.Image>();
    for (let i = 0; i < MAX_ORDER_SLOTS; i++) this.addOrderBubble(i, customers);
    // Customers walk in by the street door to their spot at the counter, move along as those ahead
    // leave, and walk back out once served or out of patience.
    this.views.push(() => {
      const step = (CUSTOMER_SPEED * this.frameMs) / 1000;
      const waiting = new Set(this.state.orders.map((o) => o.id));
      this.state.orders.forEach((order, i) => {
        if (!customers.has(order.id)) {
          // A regular comes back looking as they did.
          const sprite = fit(this.add.image(STREET.x, STREET.y, customerTexture(order.face ?? order.id)));
          customers.set(order.id, sprite);
        }
        const sprite = customers.get(order.id)!;
        sprite.setData('arrived', walkTowards(sprite, customerPosition(i), step));
        // Served from here on, even while moving up to a spot freed by someone ahead.
        if (sprite.getData('arrived')) this.atCounter.add(order.id);
      });
      for (const [id, sprite] of customers) {
        if (waiting.has(id)) continue;
        this.atCounter.delete(id);
        sprite.setData('arrived', false);
        if (walkTowards(sprite, STREET, step, true)) {
          sprite.destroy();
          customers.delete(id);
        }
      }
      this.customers = [...customers].map(([id, s]) => ({ id, x: s.x, y: s.y, arrived: !!s.getData('arrived') }));
    });
  }

  /**
   * A shelf's price sign beside it: Cheap, Fair or Dear. A tap moves it on and doesn't walk the
   * doctor. Returns a function that shows or hides it with its shelf.
   */
  private addPriceSign(potion: (typeof POTIONS)[number], at: Point) {
    const sign = this.card(at.x, at.y, 'small', signTexture(this, PRICE_SIGN_W, true)).setDepth(-910);
    const text = this.add.text(at.x, at.y, '', { fontFamily: SERIF, fontSize: '12px', fontStyle: 'bold', color: INK }).setOrigin(0.5).setDepth(-900);
    sign.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      if (this.pinching()) return;
      if (this.closePanels()) return;
      ui('click');
      const feedback = cycleSign(this.state, potion);
      if (feedback) this.showFeedback(feedback);
    });
    const COLOURS = { cheap: '#2f6a1a', fair: INK, dear: '#8a3a10' };
    this.views.push(() => {
      const sign = signOf(this.state, potion);
      text.setText(t(SIGN_NAMES[sign])).setColor(COLOURS[sign]);
    });
    return (shown: boolean) => {
      sign.setVisible(shown);
      text.setVisible(shown);
    };
  }

  /**
   * The order bubble over waiting customer `i`, once they stand at the counter: the potions they
   * want, a coin in a ring that shrinks as their tip decays, the tip it would pay now above it, and
   * their patience along the bottom.
   */
  private addOrderBubble(i: number, customers: Map<number, Phaser.GameObjects.Image>) {
    const { x, y } = customerPosition(i);
    const cy = y - BUBBLE.above;
    const top = cy - BUBBLE.h / 2;
    // Later customers' bubbles sit over earlier ones' where two wide ones meet.
    const depth = WORLD_UI_DEPTH - 1 + i * 0.1;
    const bubbles = [1, 2, 3].map((n) => this.card(x, cy, 'bubble', cardTexture(this, 'bubble', bubbleWidth(n), BUBBLE.h)).setDepth(depth).setVisible(false));
    // Selling by hand: a tap on a waiting customer's bubble hands them what they want from the
    // shelf, while the doctor is in the shop.
    for (const bubble of bubbles) {
      bubble.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        if (this.pinching()) return;
        if (this.closePanels()) return;
        const order = this.state.orders[i];
        if (!order || !this.atCounter.has(order.id)) return;
        const sold = this.state.sold;
        this.showFeedback(this.inShop({ x: this.feetX(), y: this.feetY() }) ? (serveOrder(this.state, order.id) ?? []) : [t('serveInShop')]);
        // Nothing handed over (not in the shop, or nothing on the shelf they want) is refused; a sale sounds from `createSound`.
        if (this.state.sold === sold) ui('refuse');
      });
    }
    const wants = new IconRow(this, x, cy - 4, depth + 0.02, BUBBLE.icon);
    const patience = new ProgressBar(this, x, cy + 5, 10, 0xd9a032, depth + 0.02);
    const ring = this.add.graphics().setDepth(depth + 0.03);
    const coin = fit(this.add.image(x, top + 1, 'coin'), 0.8).setDepth(depth + 0.04).setVisible(false);
    // A gold star on a regular's bubble, on its top left corner.
    const regular = fit(this.add.image(x, top + 1, 'regular')).setDepth(depth + 0.04).setVisible(false);
    const tipText = coined(
      this.add
        .text(x, top - 7, '', { fontFamily: SERIF, fontSize: '11px', fontStyle: 'bold', color: '#7a4a00', stroke: TEXT_HALO, strokeThickness: 3 })
        .setOrigin(0.5, 1)
        .setDepth(depth + 0.04),
    );
    let drawn = '';
    this.views.push(() => {
      const order = this.state.orders[i];
      const there = !!order && !!customers.get(order.id)?.getData('arrived');
      const n = there ? Math.min(order.wants.length, 3) : 0;
      bubbles.forEach((b, k) => b.setVisible(k === n - 1));
      wants.set(there ? order.wants.slice(0, 3) : []);
      // The tip ring sits on the bubble's top right corner, like a badge.
      const ringX = x + bubbleWidth(Math.max(1, n)) / 2 - 2;
      coin.setVisible(there).setX(ringX);
      regular.setVisible(there && !!order.regular).setX(x - bubbleWidth(Math.max(1, n)) / 2 + 2);
      tipText.setVisible(there);
      if (!there) {
        patience.set(null);
        ring.clear();
        drawn = '';
        return;
      }
      patience.resize(bubbleWidth(n) - 10);
      patience.set(order.patience / order.maxPatience);
      const left01 = tipLeft(order);
      const tip = tipNow(order);
      tipText.setText(tip > 0 ? t('tip', { n: tip }) : t('noTip')).setColor(left01 < 0.4 ? '#b04a10' : '#7a4a00');
      // Redraw the ring only when it has visibly shrunk.
      const key = `${n}:${Math.round(left01 * 48)}`;
      if (key === drawn) return;
      drawn = key;
      ring.clear();
      ring.fillStyle(0xe6dcc4, 1).fillCircle(ringX, top + 1, BUBBLE.ring + 2);
      ring.lineStyle(1, 0x2a1d14, 0.9).strokeCircle(ringX, top + 1, BUBBLE.ring + 2.5);
      ring.lineStyle(2.4, 0x2a1d14, 0.15).strokeCircle(ringX, top + 1, BUBBLE.ring);
      if (left01 > 0) {
        ring.lineStyle(2.4, left01 < 0.4 ? 0xe98a2e : 0xe8b830, 1);
        ring.beginPath();
        ring.arc(ringX, top + 1, BUBBLE.ring, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left01, false);
        ring.strokePath();
      }
    });
  }

  /**
   * Today's contract on a parchment card under the top bar: the potion and how many by dusk, a pip
   * for each (filled once sold), the reward, and a sun that sinks towards the horizon as the day
   * passes. A kept or missed contract says so under the card as the next one comes in.
   */
  private createContract() {
    // Centred under the top bar with the frame, so a wider view keeps the cards beside the day bar.
    const { y, w, h } = CONTRACT_CARD;
    const x = CONTRACT_CARD.x + viewFrame(this).x;
    const d = UI_DEPTH;
    const first = this.children.list.length;
    this.card(x + w / 2, y + h / 2, 'contract', cardTexture(this, 'contract', w, h)).setDepth(d).setAlpha(HUD_CARD_ALPHA).setInteractive().on('pointerdown', this.stopTaps);
    const icon = fit(this.add.image(x + 22, y + h / 2 + 1, itemTexture('sleepingTonic')), 1.8).setDepth(d + 0.1);
    const title = this.add.text(x + 42, y + 13, '', { ...HUD_TEXT, fontSize: '13px' }).setOrigin(0, 0.5).setDepth(d + 0.1);
    const pips = this.add.graphics().setDepth(d + 0.1);
    const count = this.add.text(0, y + 31, '', { ...HUD_TEXT, fontSize: '12px' }).setOrigin(0, 0.5).setDepth(d + 0.1);
    const reward = this.add.text(x + w - 10, y + 31, '', { ...HUD_TEXT, fontSize: '12px' }).setOrigin(1, 0.5).setDepth(d + 0.1);
    const rewardCoin = fit(this.add.image(0, y + 31, 'coin'), 1.1).setDepth(d + 0.1);
    const dial = this.add.graphics().setDepth(d + 0.1);
    const note = this.add
      .text(x + w / 2, y + h + 12, '', { ...HUD_TEXT, fontSize: '13px', stroke: TEXT_HALO, strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(d + 0.1)
      .setAlpha(0);
    for (const obj of this.children.list.slice(first)) (obj as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(0);
    let drawn = '';
    let day = this.state.contract.day;
    let kept = this.state.contract.kept;
    this.views.push(() => {
      const c = this.state.contract;
      if (c.day !== day) {
        // A new day's contract: say how the last one went.
        const paid = c.kept > kept;
        // A kept contract gets a fanfare in place of the new day's bell; a missed one two low notes, then the bell.
        if (paid) playSting(SONG, 'kept');
        else {
          sfx('missed');
          this.time.delayedCall(450, () => playSting(SONG, 'day'));
        }
        note.setText(paid ? t('contractKept') : t('contractMissed')).setColor(paid ? '#2f6a1a' : '#8a3a10').setAlpha(1);
        this.tweens.killTweensOf(note);
        this.tweens.add({ targets: note, alpha: 0, delay: 2_500, duration: 800 });
        day = c.day;
        kept = c.kept;
      }
      // A bundle day's second potion follows the first, on the title and in the pips.
      const parts = [{ potion: c.potion, need: c.need, made: c.made }, ...(c.bundle ? [c.bundle] : [])];
      const need = parts.reduce((n, part) => n + part.need, 0);
      const made = parts.reduce((n, part) => n + part.made, 0);
      const key = `${c.day}:${made}:${Math.floor((1 - c.dayLeft / DAY_MS) * 60)}`;
      if (key === drawn) return;
      drawn = key;
      icon.setTexture(itemTexture(c.potion));
      const potions = potionCount(c.potion, c.need);
      title.setText(c.bundle ? t('contractBundle', { potions, more: potionCount(c.bundle.potion, c.bundle.need) }) : t('contract', { potions }));
      // The title stops short of the dusk dial, in a smaller hand when a long one would run into it,
      // and scaled down to fit when even the smallest hand is too wide.
      title.setScale(1).setFontSize(13);
      for (let size = 12; title.width > w - 42 - 40 && size >= 10; size--) title.setFontSize(size);
      title.setScale(Math.min(1, (w - 42 - 40) / title.width));
      const gap = need > 8 ? 11 : 15;
      const r = need > 8 ? 4.5 : 5.5;
      pips.clear();
      let k = 0;
      for (const part of parts) {
        for (let n = 0; n < part.need; n++, k++) {
          const px = x + 48 + k * gap;
          if (n < part.made) pips.fillStyle(ITEMS[part.potion].color, 0.9).fillCircle(px, y + 31, r);
          pips.lineStyle(1.1, 0x2a1d14, n < part.made ? 0.95 : 0.5).strokeCircle(px, y + 31, r);
        }
      }
      count.setText(`${made}/${need}`).setX(x + 48 + need * gap - gap / 2 + 4);
      reward.setText(t('reward', { n: c.reward }));
      rewardCoin.setX(x + w - 10 - reward.width - 9);
      // The dusk dial: a sun sinking to the horizon over the day, gone at dusk.
      const dx = x + w - 22, hy = y + 15, sr = 7;
      const sunY = hy - sr - 1 + (2 * sr + 1) * (1 - c.dayLeft / DAY_MS);
      dial.clear();
      const s01 = Phaser.Math.Clamp((hy - sunY) / sr, -1, 1);
      if (s01 > -1) {
        const a = Math.asin(s01);
        dial.fillStyle(0xf0a040, 1).lineStyle(1, 0x2a1d14, 0.9);
        dial.beginPath();
        dial.arc(dx, sunY, sr, Math.PI - a, 2 * Math.PI + a, false);
        dial.closePath();
        dial.fillPath();
        dial.strokePath();
      }
      dial.lineStyle(1.4, 0x2a1d14, 0.9).lineBetween(dx - 11, hy, dx + 11, hy);
    });
  }

  /**
   * The plague card under the contract card, from the day the sickness comes: its stage and the
   * potions it asks for, a pip for each sold, and the days left before it comes back worse. Past
   * the last stage it shows the Panacea's recipe; once the town is cured it says so. A note under
   * the card says when a stage is beaten or missed, and the cure opens a panel over the map.
   */
  private createPlague() {
    const { y, w, h } = PLAGUE_CARD;
    const x = PLAGUE_CARD.x + viewFrame(this).x;
    const d = UI_DEPTH;
    const first = this.children.list.length;
    const card = this.card(x + w / 2, y + h / 2, 'plague', cardTexture(this, 'plague', w, h)).setDepth(d).setAlpha(HUD_CARD_ALPHA).setInteractive().on('pointerdown', this.stopTaps);
    const bell = fit(this.add.image(x + 19, y + h / 2, 'bell')).setDepth(d + 0.1);
    const title = this.add.text(x + 36, y + 13, '', { ...HUD_TEXT, fontSize: '13px' }).setOrigin(0, 0.5).setDepth(d + 0.1);
    const pips = this.add.graphics().setDepth(d + 0.1);
    const count = this.add.text(0, y + 31, '', { ...HUD_TEXT, fontSize: '12px' }).setOrigin(0, 0.5).setDepth(d + 0.1);
    const side = this.add.text(x + w - 10, y + 31, '', { ...HUD_TEXT, fontSize: '12px' }).setOrigin(1, 0.5).setDepth(d + 0.1);
    // The Panacea's ingredients, shown once it is unlocked.
    const cure = PANACEA_RECIPE.inputs.map((item, i) => fit(this.add.image(x + 46 + i * 26, y + 31, itemTexture(item))).setDepth(d + 0.1).setVisible(false));
    const plus = [0, 1].map((i) => this.add.text(x + 59 + i * 26, y + 31, '+', { ...HUD_TEXT, fontSize: '12px' }).setOrigin(0.5).setDepth(d + 0.1).setVisible(false));
    const note = this.add
      .text(x + w / 2, y + h + 12, '', { ...HUD_TEXT, fontSize: '13px', stroke: TEXT_HALO, strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(d + 0.1)
      .setAlpha(0);
    const parts = this.children.list.slice(first) as (Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible)[];
    for (const obj of parts) (obj as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(0);
    const say = (text: string, good: boolean) => {
      note.setText(text).setColor(good ? '#2f6a1a' : '#8a3a10').setAlpha(1);
      this.tweens.killTweensOf(note);
      this.tweens.add({ targets: note, alpha: 0, delay: 2_500, duration: 800 });
    };
    // Starts from the plague as saved, so a stage, relapse or cure while away is told like one in play.
    let seen = this.plagueSaved;
    let drawn = '';
    // The first frame tells what changed while away, which stays silent like the catch-up itself.
    let live = false;
    this.views.push(() => {
      const loud = live;
      live = true;
      const plague = this.state.plague;
      card.setVisible(!!plague);
      if (!plague) {
        for (const part of parts) part.setVisible(false);
        return;
      }
      const season = plague.season ?? 0;
      const stages = stagesFor(season).length;
      const untold =
        this.state.untoldCure ??
        (plague.cured && !seen?.cured ? { season, day: plague.curedDay ?? this.state.contract.day } : undefined);
      if (untold) {
        // The first cure is the game's ending; a later season's earns a town seal.
        if (untold.season === 0) {
          say(t('panaceaBrewed'), true);
          this.showWin(untold.day);
        } else say(t('seasonCured', { n: Math.round(SEAL_PRICE * 100) }), true);
        if (loud) playSting(SONG, 'win');
        delete this.state.untoldCure;
      } else if (seen && season > seen.season) {
        say(t('newSeason'), false);
        if (loud) playSting(SONG, 'relapse');
      } else if (seen && plague.stage > seen.stage) {
        say(plague.stage < stages ? t('stageBeaten') : t('panaceaUnlocked'), true);
        if (loud) sfx('plagueUp');
      } else if (seen && plague.relapses > seen.relapses) {
        say(t('relapse'), false);
        if (loud) playSting(SONG, 'relapse');
      } else if (!seen) {
        say(t('sicknessSpreads'), false);
        if (loud) playSting(SONG, 'relapse');
      }
      seen = this.plagueSaved = { stage: plague.stage, relapses: plague.relapses, cured: plague.cured, season };
      const stage = plagueStage(this.state);
      const key = `${season}:${plague.stage}:${plague.need}:${plague.made}:${plague.cured}:${this.state.seals}:${Math.ceil(plague.left / (DAY_MS / 4))}`;
      if (key === drawn) return;
      drawn = key;
      for (const part of parts) part.setVisible(true);
      const unlocked = panaceaUnlocked(this.state);
      for (const icon of cure) icon.setVisible(unlocked);
      for (const p of plus) p.setVisible(unlocked);
      pips.clear();
      if (plague.cured) {
        bell.setVisible(false);
        const seals = this.state.seals ?? 0;
        title.setText(seals > 0 ? t('townCuredSeals', { seals, n: Math.round(SEAL_PRICE * seals * 100) }) : t('townCured'));
        title.setFontSize(13);
        for (let size = 12; title.width > w - 46 && size >= 10; size--) title.setFontSize(size);
        const next = (plague.curedDay ?? this.state.contract.day) + SEASON_GAP;
        count.setText(t('nextSeason', { day: next })).setX(x + 36);
        side.setText('');
      } else if (!stage) {
        title.setText(t('brewTheCure'));
        count.setText(t('inACauldron')).setX(x + 46 + cure.length * 26 - 6);
        side.setText('');
      } else {
        const need = stage.potion ? potionCount(stage.potion, plague.need) : t('anyPotionCount', { n: plague.need });
        const at = { stage: plague.stage + 1, stages, need };
        title.setText(season > 0 ? t('seasonPlagueStage', { season: season + 1, ...at }) : t('plagueStage', at));
        title.setFontSize(13);
        for (let size = 12; title.width > w - 46 && size >= 10; size--) title.setFontSize(size);
        const gap = plague.need > 8 ? 11 : 15;
        const r = plague.need > 8 ? 4.5 : 5.5;
        for (let k = 0; k < plague.need; k++) {
          const px = x + 48 + k * gap;
          if (k < plague.made) pips.fillStyle(0x8a3a40, 0.9).fillCircle(px, y + 31, r);
          pips.lineStyle(1.1, 0x2a1d14, k < plague.made ? 0.95 : 0.5).strokeCircle(px, y + 31, r);
        }
        count.setText(`${plague.made}/${plague.need}`).setX(x + 48 + plague.need * gap - gap / 2 + 4);
        const days = plague.left / DAY_MS;
        side.setText(days >= 1 ? t('daysLeft', { n: Math.ceil(days) }) : t('lastDay'));
      }
    });
  }

  /** The panel over the map once the town is cured: the win, and "Keep trading" to go on. */
  private showWin(day: number) {
    if (this.winPanel) return;
    const { width, height } = viewSize(this);
    const w = 380, h = 176;
    const bg = fit(this.add.image(0, 0, cardTexture(this, 'panel', w, h)))
      .setInteractive()
      .on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        this.closePanels();
      });
    const parts: Phaser.GameObjects.GameObject[] = [
      bg,
      fit(this.add.image(0, -59, 'bell')),
      this.add.text(0, -31, t('townCured'), { ...HUD_TEXT, fontSize: '20px', color: '#7a4a10' }).setOrigin(0.5),
      this.add
        .text(0, 10, t('winText', { day }), { ...HUD_TEXT, fontSize: '13px', fontStyle: 'normal', align: 'center' })
        .setOrigin(0.5),
      this.card(0, 65, 'button', cardTexture(this, 'button', 120, 28)),
      this.add.text(0, 65, t('keepTrading'), { ...HUD_TEXT, fontSize: '14px' }).setOrigin(0.5),
    ];
    this.winPanel = this.add
      .container(width / 2, height / 2, parts)
      .setDepth(UI_DEPTH + 1)
      .setScrollFactor(0, 0, true);
  }

  /**
   * The rival's stall across the street, from the day it opens: its sign, the potion it undercuts
   * today with the cut, and how many days running the shop has outsold it. Once it closes for good
   * the stall is boarded up and says so.
   */
  private createRival() {
    const stall = fit(this.add.image(RIVAL.x, RIVAL.y, 'rival-stall').setOrigin(0.5, 1).setDepth(RIVAL.y)).setVisible(false);
    const sign = this.card(RIVAL.sign.x, RIVAL.sign.y, 'sign', signTexture(this, 118)).setDepth(RIVAL.y + 0.1).setVisible(false);
    const name = this.add
      .text(RIVAL.sign.x, RIVAL.sign.y, t('rivalApothecary'), { fontFamily: SERIF, fontSize: '13px', fontStyle: 'bold', color: INK })
      .setOrigin(0.5)
      .setDepth(RIVAL.y + 0.2)
      .setVisible(false);
    const style = { fontFamily: SERIF, fontSize: '12px', fontStyle: 'bold', color: INK, stroke: TEXT_HALO, strokeThickness: 3 };
    const offer = this.add.text(RIVAL.offer.x + 8, RIVAL.offer.y, '', style).setOrigin(1, 0.5).setDepth(RIVAL.y + 0.2).setVisible(false);
    const icon = fit(this.add.image(RIVAL.offer.x + 18, RIVAL.offer.y, itemTexture('healingDraught'))).setDepth(RIVAL.y + 0.2).setVisible(false);
    const streak = this.add.text(RIVAL.streak.x, RIVAL.streak.y, '', style).setOrigin(0.5).setDepth(RIVAL.y + 0.2).setVisible(false);
    let drawn = '';
    this.views.push(() => {
      const { rival } = this.state;
      const there = !!rival.potion || rival.streak > 0 || !rival.open;
      const key = `${there}:${rival.open}:${rival.potion}:${rival.sold}:${rival.streak}`;
      if (key === drawn) return;
      drawn = key;
      for (const part of [stall, sign, name, offer, icon, streak]) part.setVisible(there);
      if (!there) return;
      stall.setAlpha(rival.open ? 1 : 0.55);
      icon.setVisible(!!rival.potion);
      if (rival.potion) {
        icon.setTexture(itemTexture(rival.potion));
        offer.setText(t('rivalOffer', { n: Math.round(RIVAL_CUT * 100) }));
        streak.setText(t('rivalStreak', { streak: rival.streak, days: RIVAL_MONTH_DAYS, sold: rival.sold, sales: RIVAL_SALES + 1 }));
      } else {
        offer.setText(rival.open ? '' : t('rivalClosed'));
        streak.setText(rival.open ? '' : t('streetIsYours'));
      }
    });
  }

  /**
   * The merchant wagon across the street on a wagon day, while it waits: what crate it wants and at
   * what price, how many of them the shelf holds, and when it drives off. A tap on it sells the crate.
   */
  private createWagon() {
    const wagon = fit(this.add.image(WAGON.x, WAGON.y, 'wagon').setOrigin(0.5, 1).setDepth(WAGON.y)).setVisible(false);
    wagon.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      if (this.pinching()) return;
      if (this.closePanels()) return;
      const feedback = sellToWagon(this.state);
      if (this.state.wagon?.sold) sfx('cascade');
      else ui('refuse');
      if (feedback) this.showFeedback(feedback);
    });
    const style = { fontFamily: SERIF, fontSize: '12px', fontStyle: 'bold', color: INK, stroke: TEXT_HALO, strokeThickness: 3 };
    const want = coined(this.add.text(WAGON.want.x + 10, WAGON.want.y, '', style).setOrigin(0.5).setDepth(WAGON.y + 0.2).setVisible(false));
    const icon = fit(this.add.image(WAGON.want.x, WAGON.want.y, itemTexture('healingDraught'))).setDepth(WAGON.y + 0.2).setVisible(false);
    const left = this.add.text(WAGON.left.x, WAGON.left.y, '', style).setOrigin(0.5).setDepth(WAGON.y + 0.2).setVisible(false);
    let drawn = '';
    this.views.push(() => {
      const w = this.state.wagon;
      const here = wagonHere(this.state);
      const have = w ? this.state.counter.shelf.filter((p) => plainOf(p) === w.potion).length : 0;
      const key = `${here}:${w?.potion}:${have}:${w ? Math.ceil(w.left / 10_000) : 0}`;
      if (key === drawn) return;
      drawn = key;
      for (const part of [wagon, want, icon, left]) part.setVisible(here);
      if (!here || !w) return;
      want.setText(t('wagonBuys', { crate: potionCount(w.potion, w.crate), pay: w.pay }));
      icon.setTexture(itemTexture(w.potion)).setX(want.x - want.width / 2 - 12);
      left.setText(t(have >= w.crate ? 'wagonReady' : 'wagonWaiting', { have: Math.min(have, w.crate), crate: w.crate, s: Math.ceil(w.left / 1000) }));
      left.setColor(have >= w.crate ? '#2f6a1a' : INK);
    });
  }

  /**
   * The herb market below the outfitter, once the garden pixies are hired: a marker that sells the
   * plants and refined goods the doctor carries, and one that buys the good its sign shows (a tap
   * moves it on), both captioned with today's price.
   */
  private createHerbMarket() {
    const open = () => marketOpen(this.state);
    const stall = fit(this.add.image(HERB_MARKET.stall.x, HERB_MARKET.stall.y, 'herb-stall').setOrigin(0.5, 1).setDepth(HERB_MARKET.stall.y));
    const name = this.add
      .text(HERB_MARKET.label.x, HERB_MARKET.label.y, t('herbMarket'), { fontFamily: SERIF, fontSize: '13px', fontStyle: 'bold', color: INK })
      .setOrigin(0.5)
      .setDepth(-900);
    const board = this.card(HERB_MARKET.label.x, HERB_MARKET.label.y, 'sign', signTexture(this, name.width + 16)).setDepth(-910);
    // Walking over either marker trades nothing: like a purple marker, the doctor has to stand still on it.
    this.addMarker(HERB_MARKET.sell, 'pad-in', '', () => this.sounded(sellHerb(this.state), 'cascade'), () => !open());
    this.markers[this.markers.length - 1].pays = true;
    this.addMarker(HERB_MARKET.buy, 'pad-out', '', () => this.sounded(buyHerb(this.state), 'pay'), () => !open());
    this.markers[this.markers.length - 1].pays = true;
    const caption = (at: Point) =>
      coined(
        this.add
          .text(at.x, at.y + 26, '', { ...CAPTION, color: CAPTION_INK })
          .setOrigin(0.5, 0)
          .setDepth(-400),
      );
    const sellText = caption(HERB_MARKET.sell);
    const buyText = caption(HERB_MARKET.buy);
    const pick = this.card(HERB_MARKET.pick.x, HERB_MARKET.pick.y, 'small', signTexture(this, PRICE_SIGN_W, true)).setDepth(-910);
    const pickIcon = fit(this.add.image(HERB_MARKET.pick.x, HERB_MARKET.pick.y, itemTexture('flour'))).setDepth(-900);
    pick.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      if (this.pinching()) return;
      if (this.closePanels()) return;
      ui('click');
      this.showFeedback(cycleMarketPick(this.state));
    });
    let drawn = '';
    this.views.push(() => {
      const shown = open();
      const day = this.state.contract.day;
      const herb = this.state.marketPick;
      // What the doctor would sell first: the topmost plant or refined good carried.
      const top = [...this.state.carrying].reverse().find((id) => isPlant(id) || isRefined(id));
      const key = `${shown}:${day}:${herb}:${top}`;
      if (key === drawn) return;
      drawn = key;
      for (const part of [stall, name, board, sellText, buyText, pick, pickIcon]) part.setVisible(shown);
      if (!shown) return;
      pickIcon.setTexture(itemTexture(herb));
      this.fitCaption(buyText, t('buyHerb', { item: itemName(herb), coins: herbBuyPrice(day, herb) }), MARKET_CAPTION);
      this.fitCaption(
        sellText,
        top && (isPlant(top) || isRefined(top)) ? t('sellHerb', { item: itemName(top), coins: herbSellPrice(day, top) }) : t('sellHerbs'),
        MARKET_CAPTION,
      );
    });
  }

  /**
   * The town card under the top bar, right of the contract: today's weather from the almanac and what
   * it does, the street's reputation as a bar, and tomorrow's weather, or on a market day how its
   * crowd is going. When a market day's rush pays its bonus or loses it, a note under the card says so.
   */
  private createTown() {
    const { y, w, h } = TOWN_CARD;
    const x = TOWN_CARD.x + viewFrame(this).x;
    const d = UI_DEPTH;
    const first = this.children.list.length;
    this.card(x + w / 2, y + h / 2, 'town', cardTexture(this, 'town', w, h)).setDepth(d).setAlpha(HUD_CARD_ALPHA).setInteractive().on('pointerdown', this.stopTaps);
    const icon = fit(this.add.image(x + 19, y + h / 2, 'weather-mild')).setDepth(d + 0.1);
    const title = this.add.text(x + 36, y + 13, '', { ...HUD_TEXT, fontSize: '13px' }).setOrigin(0, 0.5).setDepth(d + 0.1);
    const label = this.add.text(x + 36, y + 31, t('reputation'), { ...HUD_TEXT, fontSize: '12px', fontStyle: 'normal' }).setOrigin(0, 0.5).setDepth(d + 0.1);
    const barW = 70;
    const reputation = new ProgressBar(this, label.x + label.width + 6 + barW / 2, y + 28, barW, 0x58a35a, d + 0.1);
    const side = this.add.text(x + w - 10, y + 31, '', { ...HUD_TEXT, fontSize: '12px' }).setOrigin(1, 0.5).setDepth(d + 0.1);
    const note = this.add
      .text(x + w / 2, y + h + 12, '', { ...HUD_TEXT, fontSize: '13px', stroke: TEXT_HALO, strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(d + 0.1)
      .setAlpha(0);
    for (const obj of this.children.list.slice(first)) (obj as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(0);
    const say = (text: string, good: boolean) => {
      note.setText(text).setColor(good ? '#2f6a1a' : '#8a3a10').setAlpha(1);
      this.tweens.killTweensOf(note);
      this.tweens.add({ targets: note, alpha: 0, delay: 2_500, duration: 800 });
    };
    // What the rush was when last drawn, so a change to it can be told.
    let rushSeen = JSON.stringify(this.state.rush);
    let blightSeen = new Set(this.state.plots.flatMap((p, i) => (p.blighted ? [i] : [])));
    let drawn = '';
    this.views.push(() => {
      const { contract, rush } = this.state;
      const day = contract.day;
      // Blight striking a bed: say which garden.
      const blighted = new Set(this.state.plots.flatMap((p, i) => (p.blighted ? [i] : [])));
      const struck = [...blighted].find((i) => !blightSeen.has(i));
      if (struck !== undefined) say(t('blightIn', { garden: t(GARDEN_NAMES_IN[gardenPlant(this.state, gardenOf(struck))]) }), false);
      blightSeen = blighted;
      const rushNow = JSON.stringify(rush);
      if (rushNow !== rushSeen && rush) {
        const before = rushSeen === 'null' ? null : (JSON.parse(rushSeen) as typeof rush);
        const sameRush = before?.day === rush.day;
        if (rush.paid && !(sameRush && before.paid)) say(t('crowdBonus', { n: RUSH_BONUS * rush.size }), true);
        else if (rush.lost && rush.size > 0 && !(sameRush && before.lost)) say(t('crowdWalkedOff'), false);
        else if (!sameRush) say(rush.size > 0 ? t('crowdComes') : t('crowdNoRoom'), rush.size > 0);
      }
      rushSeen = rushNow;
      const weather = WEATHER[weatherFor(day)];
      let status: string;
      if (!isMarketDay(day)) status = t('tomorrow', { weather: t(WEATHER[weatherFor(day + 1)].name) });
      else if (rush?.day !== day) status = t('crowdAtMidday');
      else if (rush.paid) status = t('crowdServed');
      else if (rush.lost) status = t('crowdLost');
      else status = t('crowdCount', { served: rush.served, size: rush.size });
      reputation.set(this.state.reputation / 100);
      const key = `${day}:${status}`;
      if (key === drawn) return;
      drawn = key;
      icon.setTexture(`weather-${weatherFor(day)}`);
      title.setText(t(isMarketDay(day) ? 'marketDayWeather' : 'dayWeather', { day, weather: t(weather.today) }));
      side.setText(status);
    });
  }

  /**
   * Every customer's order, always on screen: a row of small cards under the top bar on the left,
   * one per customer in the order they came, each with the potions still owed and, once they wait at
   * the counter, how much patience they have left.
   */
  private createOrderStrip() {
    const { x, y, w, h, gap } = ORDER_STRIP;
    const d = UI_DEPTH;
    const first = this.children.list.length;
    const key = cardTexture(this, 'chip', w, h);
    const chips = Array.from({ length: MAX_ORDER_SLOTS }, (_, i) => {
      const cx = x + i * (w + gap) + w / 2;
      const card = this.card(cx, y + h / 2, 'chip', key).setDepth(d).setAlpha(HUD_CARD_ALPHA).setInteractive().on('pointerdown', this.stopTaps);
      const icons = [0, 1].map(() => fit(this.add.image(0, y + 12, itemTexture('healingDraught'))).setDepth(d + 0.1));
      const patience = new ProgressBar(this, cx, y + h - 10, w - 10, 0x58a35a, d + 0.1);
      return { cx, card, icons, patience };
    });
    for (const obj of this.children.list.slice(first)) (obj as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(0);
    this.views.push(() => {
      const orders = this.state.orders;
      chips.forEach(({ cx, card, icons, patience }, i) => {
        const order = orders[i];
        card.setVisible(!!order);
        icons.forEach((icon, k) => {
          const want = order?.wants[k];
          icon.setVisible(!!want);
          if (want) icon.setTexture(itemTexture(want)).setX(order.wants.length === 1 ? cx : cx + (k - 0.5) * 17);
        });
        patience.set(order && this.atCounter.has(order.id) ? order.patience / order.maxPatience : null);
      });
    });
  }

  /**
   * "While you were away: +32 coins, 9 potions" on a violet chip under the top bar, after the
   * automation caught up on the time away; tapping it puts it away.
   */
  private createAwayChip() {
    const away = this.away;
    if (!away) return;
    // The chip keeps its right edge and grows to the left when the numbers are long.
    const { y, h } = AWAY_CHIP;
    const d = UI_DEPTH;
    const lead = this.add.text(0, y + h / 2, t('awayLead'), { ...HUD_TEXT, fontSize: '13px', fontStyle: 'normal' }).setOrigin(0, 0.5).setDepth(d + 0.1);
    const sum = coined(this.add.text(0, y + h / 2, t('awaySum', { coins: away.coins, n: away.potions }), { ...HUD_TEXT, fontSize: '13px', color: '#6a2c90' }).setOrigin(0, 0.5).setDepth(d + 0.1));
    const w = Math.max(AWAY_CHIP.w, Math.ceil(lead.width + sum.width + 46));
    const x = viewFrame(this).x + AWAY_CHIP.x + AWAY_CHIP.w - w;
    lead.setX(x + 28);
    sum.setX(lead.x + lead.width + 6);
    const chip = this.card(x + w / 2, y + h / 2, 'chip', cardTexture(this, 'chip', w, h)).setDepth(d);
    const parts: (Phaser.GameObjects.Components.Visible & Phaser.GameObjects.GameObject)[] = [chip, lead, sum];
    parts.push(fit(this.add.image(x + 15, y + h / 2, 'hourglass')).setDepth(d + 0.1));
    for (const part of parts) (part as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(0);
    chip.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      if (this.pinching()) return;
      for (const part of parts) part.destroy();
      this.away = null;
    });
  }

  private createHud() {
    const { width, height } = viewSize(this);
    const first = this.children.list.length;
    fit(this.add.image(0, 0, cardTexture(this, 'bar', width, HUD_HEIGHT)))
      .setOrigin(0)
      .setDepth(UI_DEPTH)
      .setInteractive()
      .on('pointerdown', this.stopTaps);
    const style = HUD_TEXT;
    fit(this.add.image(26, HUD_HEIGHT / 2 - 1, 'coin'), 1.6).setDepth(UI_DEPTH);
    const coins = this.add.text(42, HUD_HEIGHT / 2 - 1, '', style).setOrigin(0, 0.5).setDepth(UI_DEPTH);
    this.add
      .text(width / 2 + DAY_BAR.right + 28, HUD_HEIGHT / 2, t('hint'), { ...style, fontSize: '12px', fontStyle: 'normal', color: '#4a3424' })
      .setOrigin(0, 0.5)
      .setDepth(UI_DEPTH);
    // Settings behind a cogwheel at the bar's right end.
    const cog = this.card(width - 16 - HUD_ICON_BUTTON / 2, HUD_HEIGHT / 2, 'button', cardTexture(this, 'button', HUD_ICON_BUTTON, 28))
      .setDepth(UI_DEPTH)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        if (this.pinching()) return;
        ui('click');
        const open = this.settings.visible;
        this.closePanels();
        this.settings.toggle(!open);
      });
    fit(this.add.image(cog.x, HUD_HEIGHT / 2, 'cog')).setDepth(UI_DEPTH + 0.5);
    // What each station makes from what, in a panel over the map.
    const [recipesButton, recipesText] = this.hudButton(width / 2 - 230, t('recipes'), () => {
      const open = this.recipes.visible;
      this.closePanels();
      this.recipes.toggle(!open);
    });
    // The town map, once the town has granted its charter (the plague's first cure), left of Recipes.
    const town = this.hudButton(recipesButton.x - (recipesText.width + 22) / 2 - 8, t('town'), () => leaveFor(this, this.state, 'Town'));
    this.views.push(() => town.forEach((part) => part.setVisible(townOpen(this.state.seals))));
    this.createDayBar(width);

    // The doctor's hands on a card at the bottom of the screen: a slot for everything the biggest
    // pack holds (those beyond the current pack stay hidden), each with a bin on it once it holds
    // something; tapping the slot throws that thing away.
    const label = this.add.text(0, height - HANDS_BAR.h / 2 - 4, t('hands'), style).setOrigin(0, 0.5).setDepth(UI_DEPTH + 0.1);
    const barW = label.width + 24 + MAX_CARRY * HANDS_BAR.gap;
    const barX = width / 2 - barW / 2;
    const barY = height - HANDS_BAR.h / 2 - 4;
    this.card(width / 2, barY, 'contract', cardTexture(this, 'contract', barW, HANDS_BAR.h))
      .setDepth(UI_DEPTH)
      .setAlpha(HUD_CARD_ALPHA)
      .setInteractive()
      .on('pointerdown', this.stopTaps);
    label.setX(barX + 12);
    const frames: Phaser.GameObjects.Image[] = [];
    const bins: Phaser.GameObjects.Image[] = [];
    const slots = Array.from({ length: MAX_CARRY }, (_, i) => {
      const x = barX + label.width + 18 + HANDS_BAR.gap / 2 + i * HANDS_BAR.gap;
      const frame = fit(this.add.image(x, barY, 'slot').setDepth(UI_DEPTH + 0.1))
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
          e.stopPropagation();
          if (this.pinching()) return;
          const feedback = dropItem(this.state, i);
          if (feedback) sfx('toss');
          if (feedback) this.showFeedback(feedback);
        });
      frames.push(frame);
      bins.push(fit(this.add.image(x + 12, barY - 11, 'bin')).setDepth(UI_DEPTH + 0.3));
      return fit(this.add.image(x, barY, itemTexture('wheat')), 1.5).setDepth(UI_DEPTH + 0.2);
    });
    // Everything in the top and bottom bars stays put while the camera follows the doctor.
    for (const obj of this.children.list.slice(first)) (obj as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(0);
    const pack = new BackStack(this);
    this.recipes = new RecipeBook(this, UI_DEPTH + 1);
    this.settings = new Settings(this, UI_DEPTH + 1, () => this.startOver());

    this.views.push(() => {
      coins.setText(formatNumber(this.state.coins));
      frames.forEach((frame, i) => frame.setVisible(i < carryCapacity(this.state)));
      slots.forEach((slot, i) => {
        const item = this.state.carrying[i];
        slot.setVisible(!!item);
        bins[i].setVisible(!!item);
        if (item) slot.setTexture(itemTexture(item));
      });
      pack.update(this.player, this.state.carrying);
      this.recipes.update(this.state);
    });
  }

  /**
   * The day in the middle of the top bar: "Day 3" and a sky that runs from dawn to dusk, the sun
   * crossing it as the day passes and the moon waiting at its end. In the last part of the day the
   * world takes on the evening light, and a new day is named across the screen as it starts.
   */
  private createDayBar(width: number) {
    const y = HUD_HEIGHT / 2;
    const left = width / 2 + DAY_BAR.left, right = width / 2 + DAY_BAR.right;
    const label = this.add.text(left - 8, y, '', HUD_TEXT).setOrigin(1, 0.5).setDepth(UI_DEPTH);
    const sky = this.add.graphics().setDepth(UI_DEPTH);
    // The sky: morning blue, a bright noon and an orange dusk, under an ink rule.
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const color = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(i < steps / 2 ? 0x9cc4dc : 0xf2d27a),
        Phaser.Display.Color.ValueToColor(i < steps / 2 ? 0xf2d27a : 0xd8743a),
        steps / 2,
        i % (steps / 2),
      );
      sky.fillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b), 1).fillRect(left + ((right - left) * i) / steps, y - 5, (right - left) / steps + 0.5, 10);
    }
    sky.lineStyle(1.2, INK_NUM, 0.9).strokeRoundedRect(left, y - 5, right - left, 10, 3);
    const passed = this.add.graphics().setDepth(UI_DEPTH + 0.1);
    fit(this.add.image(right + 10, y, 'moon'), 1.1).setDepth(UI_DEPTH + 0.2);
    const sun = fit(this.add.image(left, y, 'sun'), 1.2).setDepth(UI_DEPTH + 0.3);
    const banner = this.add
      .text(0, 0, '', { fontFamily: SERIF, fontSize: '40px', fontStyle: 'bold', color: INK, stroke: TEXT_HALO, strokeThickness: 6 })
      .setOrigin(0.5)
      .setDepth(UI_DEPTH + 0.5)
      .setAlpha(0);
    for (const obj of [label, sky, passed, sun, banner]) obj.setScrollFactor(0);
    let day = this.state.contract.day;
    let drawn = -1;
    this.views.push(() => {
      const c = this.state.contract;
      label.setText(t('dayClock', { day: c.day }));
      const share = Phaser.Math.Clamp(1 - c.dayLeft / DAY_MS, 0, 1);
      const x = left + (right - left) * share;
      sun.setX(x);
      if (Math.round(x) !== drawn) {
        drawn = Math.round(x);
        // The part of the day gone by is shaded over.
        passed.clear().fillStyle(INK_NUM, 0.28).fillRect(left, y - 5, x - left, 10);
      }
      if (c.day === day) return;
      day = c.day;
      const view = viewSize(this);
      banner.setText(t('dayClock', { day })).setPosition(view.width / 2, view.height / 2 - 60).setAlpha(1);
      this.tweens.killTweensOf(banner);
      this.tweens.add({ targets: banner, alpha: 0, delay: 1_400, duration: 900 });
    });
  }

  /**
   * A parchment button in the top bar, right-aligned at `x`; tapping it doesn't walk the doctor.
   * Returns its card and its label, to dim together.
   */
  private hudButton(x: number, label: string, onTap: () => void) {
    const text = this.add
      .text(0, HUD_HEIGHT / 2, label, { ...HUD_TEXT, fontSize: '14px' })
      .setOrigin(0.5)
      .setDepth(UI_DEPTH + 0.5);
    const w = Math.round(text.width + 22);
    text.setX(x - w / 2);
    const button = this.card(x - w / 2, HUD_HEIGHT / 2, 'button', cardTexture(this, 'button', w, 28))
      .setDepth(UI_DEPTH)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        // A second finger landing on a button starts a pinch, not a tap.
        if (this.pinching()) return;
        ui('click');
        onTap();
      });
    return [button, text] as const;
  }

  /** Stops a tap on a HUD card here rather than letting it fall through to a sign in the world below. */
  private readonly stopTaps = (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
    e.stopPropagation();
    this.pinching();
  };

  /** True while two fingers are down, which starts a pinch; it also cancels the walk. */
  private pinching() {
    if (!this.input.pointer1.isDown || !this.input.pointer2.isDown) return false;
    this.pointerTarget = null;
    this.waypoint = null;
    this.stick = null;
    return true;
  }

  /** A station image whose lower part blocks walking, so the doctor can pass behind its top edge. */
  private addObstacle(x: number, y: number, texture: string, bodyW: number, bodyH: number) {
    const img = fit(this.add.sprite(x, y, texture).setDepth(y));
    const block = this.add.zone(x, y + img.displayHeight / 2 - bodyH / 2, bodyW, bodyH);
    this.obstacles.add(block);
    this.blockedAreas.push(new Phaser.Geom.Rectangle(x - bodyW / 2 - 18, block.y - bodyH / 2 - 10, bodyW + 36, bodyH + 20));
    return img;
  }

  private createPlayer() {
    const { x, y } = this.state.player;
    this.player = fit(this.physics.add.sprite(x, y, 'doctor-idle'));
    // Collide with the feet only, so the hat and beak can overlap things behind the doctor: a 30x15
    // box at (9, 57) of the 48x72 doctor as shown, given in the painting's own pixels.
    const res = resOf('doctor-idle');
    this.player.body!.setSize(30 * res, 15 * res).setOffset(9 * res, 57 * res);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.obstacles);
    this.sickle = fit(this.add.image(x, y, 'sickle'), SICKLE_SCALE).setVisible(false);
  }

  private createControls() {
    const keyboard = this.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.wasd = {
      up: keyboard.addKey('W'),
      down: keyboard.addKey('S'),
      left: keyboard.addKey('A'),
      right: keyboard.addKey('D'),
    };

    // Touch / click to walk, so the same controls work on phones.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // A second finger starts a pinch: stop walking instead of heading for it.
      if (this.pinching()) return;
      if (viewPoint(p).y < HUD_HEIGHT) return;
      // While a panel is open, a tap anywhere below the top bar closes it instead of walking.
      if (this.closePanels()) return;
      // Where the tap is in the world, through the zoomed main camera rather than the top bar's.
      const at = this.cameras.main.getWorldPoint(p.x, p.y);
      this.pointerTarget = this.reachable(new Phaser.Math.Vector2(at.x, at.y));
      this.heading = null;
      this.waypoint = this.routeAround(this.pointerTarget);
      // A touch may also turn into the floating stick, if the finger drags on from here.
      if (p.wasTouch) {
        const v = viewPoint(p);
        this.stick = { id: p.id, ox: v.x, oy: v.y, x: v.x, y: v.y, live: false };
      }
    });
    this.stick = null;
    this.stickGfx = this.add.graphics().setDepth(UI_DEPTH);
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const st = this.stick;
      if (!st || st.id !== p.id || !p.isDown) return;
      const v = viewPoint(p);
      st.x = v.x;
      st.y = v.y;
      const d = Math.hypot(st.x - st.ox, st.y - st.oy);
      if (!st.live && d > STICK.drag) {
        // Steering now, so drop the walk to where the finger landed.
        st.live = true;
        this.pointerTarget = null;
        this.waypoint = null;
        this.heading = null;
      }
      // Past the rim the base is dragged along behind the finger.
      if (d > STICK.r) {
        const k = (d - STICK.r) / d;
        st.ox += (st.x - st.ox) * k;
        st.oy += (st.y - st.oy) * k;
      }
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.stick?.id === p.id) this.stick = null;
    });
  }

  /** The stick under a steering finger: a faint ring and a knob, drawn by the fixed UI camera. */
  private drawStick() {
    const g = this.stickGfx;
    g.clear();
    const st = this.stick;
    if (!st?.live) return;
    const d = Math.hypot(st.x - st.ox, st.y - st.oy);
    const k = d > STICK.r ? STICK.r / d : 1;
    const kx = st.ox + (st.x - st.ox) * k;
    const ky = st.oy + (st.y - st.oy) * k;
    g.fillStyle(INK_NUM, 0.18).fillCircle(st.ox, st.oy, STICK.r);
    g.lineStyle(3, INK_NUM, 0.5).strokeCircle(st.ox, st.oy, STICK.r);
    g.fillStyle(0xe8dcb8, 0.85).fillCircle(kx, ky, STICK.knob);
    g.lineStyle(2, INK_NUM, 0.7).strokeCircle(kx, ky, STICK.knob);
  }

  /**
   * Harvests ripe plants within the sickle's reach of the doctor's centre, one at a time
   * so each pickup can be seen. Returns whether a ripe plant is in reach with room to carry it.
   */
  private harvestReach() {
    return this.player.displayHeight * harvestReach(this.state);
  }

  private autoHarvest() {
    const reach = this.harvestReach();
    const centre = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const near = this.plotCentres.map((at, i) => ({ i, d: at.distance(centre) })).filter(({ d }) => d <= reach);
    // The sickle clears blighted beds in reach first, with the hands full or not, then cuts ripe ones.
    const blighted = near.filter(({ i }) => isBlighted(this.state, i)).sort((a, b) => a.d - b.d);
    const inReach = near.filter(({ i }) => isRipe(this.state, i)).sort((a, b) => a.d - b.d);
    const full = this.state.carrying.length >= carryCapacity(this.state);
    if (blighted.length === 0 && (inReach.length === 0 || full)) return false;
    if (this.time.now >= this.nextHarvestAt) {
      this.nextHarvestAt = this.time.now + HARVEST_INTERVAL_MS;
      const feedback = blighted.length > 0 ? clearBlight(this.state, blighted[0].i) : full ? null : harvest(this.state, inReach[0].i);
      if (feedback && blighted.length > 0) sfx('rasp');
      else if (feedback) {
        sfx('swish');
        sfx('pluck');
      }
      if (feedback) this.showFeedback(feedback);
    }
    return true;
  }

  /** Swings the sickle around the edge of the harvest radius while harvesting, and a moment after. */
  private spinSickle(harvesting: boolean, delta: number) {
    if (harvesting) this.lastHarvestingAt = this.time.now;
    const show = this.time.now - this.lastHarvestingAt < SICKLE_LINGER_MS;
    this.sickle.setVisible(show);
    if (!show) return;
    this.sickleAngle = (this.sickleAngle + delta * SICKLE_SPIN) % (Math.PI * 2);
    const orbit = this.harvestReach();
    this.sickle
      .setPosition(
        this.player.x + Math.cos(this.sickleAngle) * orbit,
        this.player.y + Math.sin(this.sickleAngle) * orbit,
      )
      .setRotation(this.sickleAngle + Math.PI / 2);
    // Sorted by its own position like the plants it passes, in front of what stands above it.
    this.sickle.setDepth(this.sickle.y + this.sickle.displayHeight / 2);
  }

  /** Plays `name` when a marker's action did something (returned feedback), and passes the feedback on. */
  private sounded(feedback: Feedback | null, name: SfxName) {
    if (feedback) sfx(name);
    return feedback;
  }

  /** The cauldron's pick-up marker: a chime for a potion taken out fine, a blip for one off the pallet. */
  private pickUpPotion(id: CauldronId) {
    const feedback = pickUpFromCauldron(this.state, id);
    if (feedback) sfx(isFine(this.state.carrying[this.state.carrying.length - 1]) ? 'fine' : 'pickUp');
    return feedback;
  }

  /**
   * Music, and the sounds of what the sim does on its own each frame, found by comparing the state
   * with the last frame's: a station in view finishing a good, a sale, an order filled or walked
   * off, a market day's crowd and the blight. It starts from the state as loaded, after `catchUp`,
   * so the time away stays silent. The music follows the day: the plague's part while it spreads,
   * the market rush while its crowd waits, and the calm part otherwise.
   */
  private createSound() {
    const stations = [
      { id: 'refiner', at: REFINER },
      { id: 'refiner2', at: REFINER2 },
      { id: 'cauldron', at: CAULDRON },
      { id: 'cauldron2', at: CAULDRON2 },
    ] as const;
    const made = () => stations.map(({ id }) => this.state[id].output.length);
    let output = made();
    let orders = [...this.state.orders];
    let sold = this.state.sold;
    let rushDay = this.state.rush?.day ?? 0;
    let blighted = this.state.plots.filter((p) => p.blighted).length;
    let music = '';
    this.views.push(() => {
      const state = this.state;
      const view = this.cameras.main.worldView;
      const now = made();
      // One pop a frame at most, and only for a station on screen.
      if (stations.some(({ at }, i) => now[i] > output[i] && view.contains(at.x, at.y))) sfx('bubble');
      output = now;
      // Orders gone since the last frame: filled (nothing left to want) or walked off (out of patience).
      const gone = orders.filter((o) => !state.orders.includes(o));
      if (gone.some((o) => o.wants.length === 0)) sfx('served');
      else if (state.sold > sold) sfx('sell');
      if (gone.some((o) => o.wants.length > 0 && o.patience <= 0)) sfx('hmph');
      orders = [...state.orders];
      sold = state.sold;
      if (state.rush && state.rush.day !== rushDay) sfx('rush');
      rushDay = state.rush?.day ?? 0;
      const blightedNow = state.plots.filter((p) => p.blighted).length;
      if (blightedNow > blighted) sfx('blight');
      blighted = blightedNow;
      const plague = state.plague && !state.plague.cured;
      const rush = state.orders.some((o) => o.rush);
      const part = rush ? 'rush' : plague ? 'plague' : 'calm';
      if (part !== music) {
        music = part;
        if (part === 'rush') playMusic(RUSH_SONG, 'rush');
        else playMusic(SONG, part);
      }
    });
  }

  private showFeedback(lines: Feedback) {
    // Stagger lines so several pickups read one after another.
    const start = Math.max(this.time.now, this.nextFeedbackAt);
    lines.forEach((line, i) => {
      this.time.delayedCall(start - this.time.now + i * 180, () => {
        const text = coined(
          this.add
            .text(this.player.x, this.player.y - 60, line, {
              fontFamily: SERIF,
              fontSize: '14px',
              fontStyle: 'bold',
              color: INK,
              stroke: TEXT_HALO,
              strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setDepth(WORLD_UI_DEPTH),
        );
        this.tweens.add({ targets: text, y: text.y - 36, alpha: 0, duration: 1100, onComplete: () => text.destroy() });
      });
    });
    this.nextFeedbackAt = start + lines.length * 180;
  }

  update(_time: number, delta: number) {
    this.frameMs = Math.min(delta, MAX_STEP_MS);
    const feetY = this.feetY();
    const workingAt = this.workSpots.find((w) => w.zone.contains(this.feetX(), feetY))?.station ?? null;
    tick(this.state, this.frameMs, workingAt, (order) => this.atCounter.has(order.id));
    // The town's shops keep working while the doctor is in the apothecary.
    tickTown(this.state, this.frameMs, null);
    this.movePlayer();

    this.standOnMarkers();

    this.spinSickle(this.autoHarvest(), delta);
    checkTrophies(this.state);

    this.state.player.x = this.player.x;
    this.state.player.y = this.player.y;
    for (const view of this.views) view();
    this.drawStick();
    this.splitCameras();
  }

  private standOnMarkers() {
    const under = (m: Marker) => m.zone.contains(this.feetX(), this.feetY());
    for (const m of this.markers) if (m.paused && !under(m)) m.paused = false;
    const marker = this.markers.find((m) => m.shown() && under(m));
    if (marker !== this.lastMarker) {
      this.lastMarker = marker;
      this.markerSince = this.time.now;
    }
    const moving = this.player.body!.velocity.lengthSq() > 0;
    if (moving) this.stillSince = null;
    else this.stillSince ??= this.time.now;
    if (marker !== this.refusedMarker) this.refusedMarker = null;
    if (!marker || marker.paused || this.time.now < this.nextMarkerAt) return;
    if (marker.pays && (this.stillSince === null || this.time.now - this.stillSince < STILL_MS)) return;
    this.nextMarkerAt = this.time.now + MARKER_INTERVAL_MS;
    // The longer the doctor stays on a purple marker, the more each payment takes.
    if (marker.pays) payment.boost = payBoost(this.time.now - Math.max(this.stillSince!, this.markerSince) - STILL_MS);
    const feedback = marker.act();
    payment.boost = 1;
    if (feedback) this.showFeedback(feedback);
    // A purple marker that takes nothing (no coins, or the herb market with nothing to trade) buzzes once a visit.
    else if (marker.pays && !this.refusedMarker) {
      this.refusedMarker = marker;
      ui('refuse');
    }
  }

  private movePlayer() {
    const dir = new Phaser.Math.Vector2(0, 0);
    if (this.cursors.left.isDown || this.wasd.left.isDown) dir.x -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dir.x += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) dir.y -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) dir.y += 1;

    const st = this.stick;
    if (dir.lengthSq() === 0 && st?.live && Math.hypot(st.x - st.ox, st.y - st.oy) > STICK.dead) dir.set(st.x - st.ox, st.y - st.oy);

    if (dir.lengthSq() > 0) {
      this.pointerTarget = null;
    } else if (this.pointerTarget) {
      // Steer the feet, not the sprite centre, to the tapped spot, via a corner if a station is in the way.
      const target = this.waypoint ?? this.pointerTarget;
      dir.set(target.x - this.feetX(), target.y - this.feetY());
      // Walking past the spot counts as getting there, so a fast walk on a slow frame rate doesn't
      // overshoot it back and forth.
      const passed = this.heading !== null && dir.dot(this.heading) <= 0;
      if (this.waypoint && (dir.length() < 6 || passed)) {
        // Settle the feet on the corner, so the next leg starts clear of the station, and head on.
        this.settleFeet(this.waypoint);
        this.waypoint = this.routeAround(this.pointerTarget);
        const next = this.waypoint ?? this.pointerTarget;
        dir.set(next.x - this.feetX(), next.y - this.feetY());
      } else if (!this.waypoint && (dir.length() < 4 || passed)) {
        // Settle the feet on the spot itself, a step back if the last frame carried them past it.
        if (passed) this.settleFeet(target);
        this.pointerTarget = null;
        dir.set(0, 0);
      }
    }

    dir.normalize();
    this.heading = this.pointerTarget && dir.lengthSq() > 0 ? dir.clone() : null;
    dir.scale(SPEED * walkSpeed(this.state));
    this.player.setVelocity(dir.x, dir.y);
    this.animatePlayer(dir);
  }

  /**
   * Each station's blocked area slightly shrunk, which walking is tested against so lines along an
   * edge or from a corner count as clear. It stays clear of where feet touching the station stand,
   * half the feet's size (15 by 7 pixels) from it, so they still route around it.
   */
  private innerArea(area: Phaser.Geom.Rectangle) {
    return new Phaser.Geom.Rectangle(area.x + 4, area.y + 4, area.width - 8, area.height - 8);
  }

  /**
   * Where the doctor's feet can't stand for the shop: its walls and the street behind it grown by half
   * the feet's size (`walls`), and the whole shop, street included, as one more area to walk around
   * like a station's (`area`), from the top of the world down to where feet stand clear of its front
   * wall. `inside` is between the side walls and above that, so the doorway counts as inside.
   */
  private measureShop(halfWidth: number, halfHeight: number) {
    const walls = SHOP_BLOCKS.map((w) => new Phaser.Geom.Rectangle(w.x - halfWidth, w.y - halfHeight, w.w + 2 * halfWidth, w.h + 2 * halfHeight));
    const left = Math.min(...walls.map((w) => w.left)), right = Math.max(...walls.map((w) => w.right));
    const top = Math.min(...walls.map((w) => w.top)), bottom = Math.max(...walls.map((w) => w.bottom));
    return {
      halfWidth,
      halfHeight,
      walls,
      area: new Phaser.Geom.Rectangle(left - 3, top - 3, right - left + 6, bottom - top + 6),
      inside: new Phaser.Geom.Rectangle(left + halfWidth, top, right - left - 2 * halfWidth, bottom - top),
    };
  }

  /** The shop measured for the feet; measured again if their size changes, as it does once the body takes the sprite's scale. */
  private shop() {
    const { halfWidth, halfHeight } = this.player.body!;
    const m = this.shopMeasured;
    if (m?.halfWidth !== halfWidth || m.halfHeight !== halfHeight) this.shopMeasured = this.measureShop(halfWidth, halfHeight);
    return this.shopMeasured!;
  }

  /** Whether feet at a spot are in the shop. */
  private inShop(p: Point) {
    const { inside } = this.shop();
    return p.x > inside.left && p.x < inside.right && p.y > inside.top && p.y < inside.bottom;
  }

  /**
   * Where to walk first on the way to `to`. Into or out of the shop, that is the front door, unless a
   * straight line to the spot clears the walls: the spot in line with the door on this side of it, and
   * then the one on the other side. When a station, or outside the shop the shop itself, blocks the way
   * there, it is the corner of the nearest such area (the one making the shorter trip). Null once the
   * way to `to` is clear.
   */
  private routeAround(to: Phaser.Math.Vector2): Phaser.Math.Vector2 | null {
    const from = new Phaser.Math.Vector2(this.feetX(), this.feetY());
    const line = (a: Phaser.Math.Vector2, b: Phaser.Math.Vector2) => new Phaser.Geom.Line(a.x, a.y, b.x, b.y);
    const blocks = (a: Phaser.Math.Vector2, b: Phaser.Math.Vector2, area: Phaser.Geom.Rectangle) =>
      Phaser.Geom.Intersects.LineToRectangle(line(a, b), area);
    // Shrunk like the stations' areas, so a line along a wall's edge counts as clear.
    const walls = this.shop().walls.map((w) => this.innerArea(w));
    const wallsBlock = (a: Phaser.Math.Vector2, b: Phaser.Math.Vector2) => walls.some((w) => blocks(a, b, w));
    let goal = to;
    const inside = this.inShop(from);
    if (inside !== this.inShop(to) && wallsBlock(from, to)) {
      const { halfWidth } = this.player.body!;
      const x = Phaser.Math.Clamp(from.x, SHOP_DOOR.from + halfWidth + 2, SHOP_DOOR.to - halfWidth - 2);
      const near = new Phaser.Math.Vector2(x, inside ? SHOP_DOORWAY.inside : SHOP_DOORWAY.outside);
      const far = new Phaser.Math.Vector2(x, inside ? SHOP_DOORWAY.outside : SHOP_DOORWAY.inside);
      goal = wallsBlock(from, far) ? near : far;
    }
    const areas = inside || this.inShop(goal) ? this.blockedAreas : [...this.blockedAreas, this.shop().area];
    // How far along the way each station in it is.
    const inTheWay = areas
      .map((area) => ({ area, inner: this.innerArea(area) }))
      .filter(({ inner }) => !inner.contains(from.x, from.y) && !inner.contains(goal.x, goal.y) && blocks(from, goal, inner))
      .map((s) => ({ ...s, d: Math.min(...Phaser.Geom.Intersects.GetLineToRectangle(line(from, goal), s.inner).map((p) => from.distance(p))) }))
      .sort((a, b) => a.d - b.d);
    if (inTheWay.length === 0) return goal === to ? null : goal;
    const { area, inner } = inTheWay[0];
    const { bounds } = this.physics.world;
    const { halfWidth, halfHeight } = this.player.body!;
    const reach = new Phaser.Geom.Rectangle(bounds.x + halfWidth, bounds.y + halfHeight, bounds.width - 2 * halfWidth, bounds.height - 2 * halfHeight);
    const corners = [
      new Phaser.Math.Vector2(area.left, area.top),
      new Phaser.Math.Vector2(area.right, area.top),
      new Phaser.Math.Vector2(area.left, area.bottom),
      new Phaser.Math.Vector2(area.right, area.bottom),
    ].filter((c) => reach.contains(c.x, c.y) && from.distance(c) > 0.5 && !blocks(from, c, inner));
    // Prefer a corner the way to which no other station blocks either.
    const others = areas.filter((a) => a !== area).map((a) => this.innerArea(a)).filter((a) => !a.contains(from.x, from.y));
    const clear = corners.filter((c) => others.every((other) => !blocks(from, c, other)));
    if (clear.length > 0) corners.splice(0, corners.length, ...clear);
    corners.sort((a, b) => from.distance(a) + a.distance(goal) - (from.distance(b) + b.distance(goal)));
    // With no corner to go by, still head for the door rather than straight at a wall.
    return corners[0] ?? (goal === to ? null : goal);
  }

  /**
   * Where the doctor's feet are, from the physics body: during the update it has already stepped
   * this frame, while the sprite only follows it afterwards.
   */
  private feetX() {
    return this.player.body!.center.x;
  }

  private feetY() {
    return this.player.body!.center.y;
  }

  /**
   * Physics steps once per frame (see main.ts), right after this, with the frame's whole delta; a
   * long frame slows the doctor down to MAX_WALK_STEP_PX for that step.
   */
  private limitWalkStep(_time: number, delta: number) {
    const body = this.player?.body;
    if (body && body.velocity.length() * (delta / 1000) > MAX_WALK_STEP_PX) body.velocity.setLength((MAX_WALK_STEP_PX * 1000) / delta);
  }

  /** Stops the doctor with their feet on a spot. */
  private settleFeet(at: Point) {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    body.stop();
    // The body has already stepped this frame and the sprite follows it after the update, so place the
    // sprite and take the body from it, rather than Arcade's reset, which also drops the body's offset.
    this.player.x = at.x;
    body.updateFromGameObject();
    this.player.y += at.y - body.center.y;
    body.updateFromGameObject();
    body.prev.copy(body.position);
    body.prevFrame.copy(body.position);
  }

  /**
   * A tapped spot the feet can't stand on moves to the nearest one they can: inside the world's
   * edges, and out of a station or a shop wall to the nearest edge of its area, so the doctor walks up
   * to it instead of into it.
   */
  private reachable(to: Phaser.Math.Vector2) {
    const { bounds } = this.physics.world;
    const { halfWidth, halfHeight } = this.player.body!;
    to.set(
      Phaser.Math.Clamp(to.x, bounds.left + halfWidth, bounds.right - halfWidth),
      Phaser.Math.Clamp(to.y, bounds.top + halfHeight, bounds.bottom - halfHeight),
    );
    // The same areas walking routes around, so the moved spot gets routed to. The shop's walls meet at
    // its corners, so it moves to the nearest edge outside the others too, if there is one.
    const areas = [
      ...this.blockedAreas.map((area) => ({ area, inner: this.innerArea(area) })),
      ...this.shop().walls.map((area) => ({ area, inner: new Phaser.Geom.Rectangle(area.x + 0.5, area.y + 0.5, area.width - 1, area.height - 1) })),
    ];
    for (let moves = 0; moves < 3; moves++) {
      const hit = areas.find(({ inner }) => inner.contains(to.x, to.y));
      if (!hit) break;
      const { area } = hit;
      const edges = [
        { d: to.x - area.left, x: area.left, y: to.y },
        { d: area.right - to.x, x: area.right, y: to.y },
        { d: to.y - area.top, x: to.x, y: area.top },
        { d: area.bottom - to.y, x: to.x, y: area.bottom },
      ].filter((e) => e.y >= bounds.top + halfHeight);
      const free = edges.filter((e) => !areas.some((other) => other !== hit && other.inner.contains(e.x, e.y)));
      const nearest = (free.length > 0 ? free : edges).reduce((a, b) => (b.d < a.d ? b : a));
      to.set(nearest.x, nearest.y);
    }
    return to;
  }

  private animatePlayer(velocity: Phaser.Math.Vector2) {
    if (velocity.x !== 0) this.player.setFlipX(velocity.x < 0);
    if (velocity.lengthSq() > 0) {
      this.player.anims.play('doctor-walk', true);
    } else {
      this.player.anims.stop();
      this.player.setTexture('doctor-idle');
    }
    // Draw lower sprites in front of higher ones.
    this.player.setDepth(this.feetY());
  }
}

/**
 * Moves `obj` up to `step` pixels towards `to`, one axis at a time: across a row before going up or
 * down when `leaving`, otherwise up or down first. Returns whether it has arrived.
 */
function walkTowards(obj: Phaser.GameObjects.Image, to: Point, step: number, leaving = false) {
  const along = (from: number, target: number) => from + Phaser.Math.Clamp(target - from, -step, step);
  const vertical = leaving ? obj.x === to.x : obj.y !== to.y;
  if (vertical) obj.setY(along(obj.y, to.y));
  else obj.setX(along(obj.x, to.x));
  obj.setDepth(obj.y);
  return obj.x === to.x && obj.y === to.y;
}

/** How wide an order bubble is for `n` potions: their icons and a margin. */
function bubbleWidth(n: number) {
  return 11 + n * BUBBLE.icon;
}
