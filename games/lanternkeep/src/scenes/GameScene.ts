import Phaser from 'phaser';
import { formatNumber, language } from '../../../../shared/i18n';
import { settings } from '../../../../shared/settings';
import { BACK_RES, bakeScenery, DUSK, FX, FY, HUD_RES, INK, INK_HEX, lampOriginY, PAD, RES, SCREENS } from '../art/puppet';
import { dailyRand, finishDaily, loadDaily, startDaily, type DailyRecord } from '../../../../shared/daily';
import { DISTRICTS, type DistrictId, JARS, LANTERN_SPOTS, MOVE_IDS } from '../game/places';
import { loadBest, loadBestPeril, loadBoon, loadFlown, loadVillage, saveBest, saveBestPeril, saveBoon, saveFlown, saveVillage } from '../game/save';
import {
  BOON_IDS,
  BOONS,
  build,
  BUILDING_IDS,
  BUILDINGS,
  buildCost,
  caskCost,
  climb,
  PILGRIM_PAY,
  SEASONS,
  seasonOf,
  type BuildingId,
  caskMax,
  CASK_NIGHT,
  dailyNight,
  flooded,
  sail,
  SHIP_PAY,
  SHIP_Y,
  shipX,
  TIDE_MS,
  takeBoon,
  traitsOf,
  type BoonId,
  type TraitId,
  callPay,
  CHAIN_BONUS,
  chainLit,
  chainsFor,
  chainsOf,
  carryOn,
  chase,
  CLOSE_CALL,
  caskSpare,
  closeCallPay,
  CURSES,
  endPeril,
  hearthCost,
  HEARTH_COSTS,
  perilMult,
  rekindle,
  required,
  restMs,
  swapJar,
  takeCurse,
  FEAST_PAY,
  FESTIVAL_NIGHTS,
  LANTERN_KINDS,
  lanternPay,
  moveTo,
  NIGHT_KINDS,
  buy,
  LIVES,
  mothLightMs,
  newGame,
  nextCost,
  nextDusk,
  orderProgress,
  send,
  stunned,
  tick,
  topUp,
  UPGRADE_IDS,
  UPGRADES,
  usesCask,
  type CurseId,
  type GameEvent,
  type GameState,
  type Order,
  type UpgradeId,
} from '../game/state';
import { ui } from '../../../../shared/audio';
import { frameSounds, nightfallSounds, snapshot, updateMusic } from '../audio/cues';
import { sfx, type SoundName } from '../audio/sound';
import { t, type TextKey } from '../i18n';
import { makeButton } from '../ui/Button';
import {
  BAT_HIT,
  CALL_TAG,
  CASK_HUD,
  FONT,
  GUST_TAG,
  KIND_TAG,
  LANTERN_HIT,
  MOTH_HIT,
  MOVE_CARDS,
  MOVE_PANEL,
  NEXT_BUTTON,
  NIGHT_PANEL,
  ORDER,
  SHOP,
  SMALL_PANEL,
  UI_DEPTH,
  VIEW,
} from './layout';
import { checkTrophies } from '../trophies/check';

/** The longest step of game time one frame may take, so a stalled tab doesn't skip the dusk. */
const MAX_STEP_MS = 100;
/** How long a popup floats up, in milliseconds. */
const POPUP_MS = 1200;
/** How long night shows the lit castle and its coins before the night panel opens, in milliseconds. */
const PANEL_DELAY_MS = 1500;

/**
 * How much of a puppet that flies in from beyond the designed frame (a bat, the owl) shows at `x`:
 * none where it starts, `margin` outside the frame, and all of it once inside, so it doesn't pop
 * into sight on a view wider than the frame.
 */
const edgeFade = (x: number, margin: number) => Phaser.Math.Clamp(Math.min(x + margin, VIEW.w + margin - x) / margin, 0, 1);

/** The game's name for its daily record (`shared/daily.ts`, `lanternkeep-daily`). */
const GAME = 'lanternkeep';

/** Each trait's dot under a moth that has it, and the popup when one is gained (LK16). */
const TRAIT_LOOK: Record<TraitId, { color: number; popup: TextKey }> = {
  swift: { color: 0xffe890, popup: 'swiftPopup' },
  frugal: { color: 0xffa860, popup: 'frugalPopup' },
  gustproof: { color: 0xbcd4ff, popup: 'gustproofPopup' },
};

/** A pay multiplier with two decimals, like 1.25 (1,25 in German). */
const mult2 = (n: number) => formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type TextOpts = { size: number; color?: string; bold?: boolean; glow?: boolean; stroke?: boolean };

/** Where a button is on screen; read by the playthrough test. */
export interface ButtonSpot {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ShopParts {
  bg: Phaser.GameObjects.Image;
  level: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
}

interface LampParts {
  glow: Phaser.GameObjects.Image;
  lamp: Phaser.GameObjects.Image;
  flame: Phaser.GameObjects.Image;
  tag: Phaser.GameObjects.Container;
  tagText: Phaser.GameObjects.Text;
  /** The lantern's kind, lettered under it when it is not a plain lantern. */
  kindLabel: Phaser.GameObjects.Text;
  hit: Phaser.GameObjects.Zone;
}

/** The shop's cards: the upgrades, the cask's top-up and rekindling a hearth. */
type ShopId = UpgradeId | 'cask' | 'hearth';

export class GameScene extends Phaser.Scene {
  /** The game being played; read by the playthrough test. */
  state!: GameState;
  /** The upgrade buttons in the night panel, by id (the cask's top-up too); read by the playthrough test. */
  shopButtons: (ButtonSpot & { id: ShopId })[] = [];
  /** The district cards of a fifth nightfall's choice, by id, for tests that play five nights. */
  moveButtons: (ButtonSpot & { id: DistrictId })[] = [];
  /** The two curse cards of the peril panel (by place: `state.offer[k]`) and its "Go on" button. */
  perilButtons: ButtonSpot[] = [];
  goOnButton: ButtonSpot = { x: VIEW.w / 2, y: VIEW.h / 2 + 115, w: 200, h: 40 };
  /** The night panel's "Next dusk" button; read by the playthrough test. */
  nextButton: ButtonSpot = { x: NEXT_BUTTON.x, y: NEXT_BUTTON.y, w: 200, h: 40 };
  /** The Great Festival panel's "Keep going" and "Set sail" buttons, for tests that play ten nights. */
  carryOnButton: ButtonSpot = { x: VIEW.w / 2 - 190, y: VIEW.h / 2 + 115, w: 180, h: 40 };
  sailButton: ButtonSpot = { x: VIEW.w / 2, y: VIEW.h / 2 + 115, w: 180, h: 40 };
  /** The Harbour Festival's boon cards, by id. */
  boonButtons: (ButtonSpot & { id: BoonId })[] = [];
  /** The night panel's "Daily night" link and the daily's "Back to my keep" button. */
  dailyButton: ButtonSpot = { x: NIGHT_PANEL.x + NIGHT_PANEL.w / 2 - 92, y: NEXT_BUTTON.y, w: 150, h: 60 };
  backButton: ButtonSpot = { x: VIEW.w / 2, y: VIEW.h / 2 + 76, w: 200, h: 40 };
  /** The village panel's building cards (LK18), by id, its "Back" button and the night panel's "Village" link. */
  villageButtons: (ButtonSpot & { id: BuildingId })[] = [];
  villageBack: ButtonSpot = { x: VIEW.w / 2, y: VIEW.h / 2 + 115, w: 200, h: 40 };
  villageButton: ButtonSpot = { x: NIGHT_PANEL.x - NIGHT_PANEL.w / 2 + 92, y: NEXT_BUTTON.y, w: 150, h: 34 };
  /** The Great Festival's "Climb" button (LK20). */
  climbButton: ButtonSpot = { x: VIEW.w / 2 + 190, y: VIEW.h / 2 + 115, w: 180, h: 40 };
  /** True while the village panel is open over the night panel. */
  private villageOpen = false;
  private villagePanel!: Phaser.GameObjects.Container;
  private villageSub!: Phaser.GameObjects.Text;
  private villageCards = new Map<BuildingId, { bg: Phaser.GameObjects.Image; note: Phaser.GameObjects.Text }>();
  /** The houses and buildings at the foot of the screen, redrawn when the village changes. */
  private houses!: Phaser.GameObjects.Graphics;
  private housesShown = '';
  /** The monastery's avalanche warning and the pilgrim's plea (LK20). */
  private snowLabel!: Phaser.GameObjects.Text;
  private pilgrimLabel!: Phaser.GameObjects.Text;
  private boonTitle!: Phaser.GameObjects.Text;
  private boonSub!: Phaser.GameObjects.Text;
  /** The game put aside while a daily night is played, given back after it. */
  private run: GameState | null = null;
  /** Today's daily record, read when the scene starts and after each daily. */
  private dailyRecord!: DailyRecord;
  private dailyLink!: Phaser.GameObjects.Text;
  private dailyPanel!: Phaser.GameObjects.Container;
  private dailyText!: Phaser.GameObjects.Text;
  private boonPanel!: Phaser.GameObjects.Container;
  private boonNotes = new Map<BoonId, Phaser.GameObjects.Text>();
  /** The harbour's water (LK15) and the ship sailing in, with its label. */
  private water!: Phaser.GameObjects.Graphics;
  private tideLabel!: Phaser.GameObjects.Text;
  private ship!: Phaser.GameObjects.Image;
  private shipLabel!: Phaser.GameObjects.Text;
  private clock = 0;
  /** When night fell, on the scene's clock. */
  private nightAt = 0;
  private lastFrame: number | null = null;
  private screens: Phaser.GameObjects.Image[] = [];
  /** The district's scenery, re-baked when the keep moves. */
  private castle!: Phaser.GameObjects.Image;
  private shownDistrict: DistrictId = 'keep';
  private stars!: Phaser.GameObjects.Image;
  private moon!: Phaser.GameObjects.Image;
  private lamps: LampParts[] = [];
  /** The gust's wind curls, drawn each frame under the lanterns. */
  private wind!: Phaser.GameObjects.Graphics;
  /** Oil bars and the punched rings round lanterns, drawn each frame over them. */
  private marks!: Phaser.GameObjects.Graphics;
  /** Dotted trails of moths flying home. */
  private trails!: Phaser.GameObjects.Graphics;
  /** Each moth's puppet and halo, and its tap zone for swapping jars while it rests on one. */
  private moths: { halo: Phaser.GameObjects.Image; body: Phaser.GameObjects.Image; hit: Phaser.GameObjects.Zone; nap: Phaser.GameObjects.Text }[] = [];
  /** The second jar, shown once bought. */
  private jar2!: Phaser.GameObjects.Image;
  private gustTag!: Phaser.GameObjects.Container;
  private gustTitle!: Phaser.GameObjects.Text;
  private gustNote!: Phaser.GameObjects.Text;
  private gustPointer!: Phaser.GameObjects.Graphics;
  private orderText!: Phaser.GameObjects.Text;
  private orderReward!: Phaser.GameObjects.Text;
  private orderProgressText!: Phaser.GameObjects.Text;
  private orderPips: Phaser.GameObjects.Image[] = [];
  private hearths: Phaser.GameObjects.Image[] = [];
  private nightText!: Phaser.GameObjects.Text;
  private coinsText!: Phaser.GameObjects.Text;
  private litText!: Phaser.GameObjects.Text;
  private needText!: Phaser.GameObjects.Text;
  private duskText!: Phaser.GameObjects.Text;
  private duskFill!: Phaser.GameObjects.Image;
  private duskSun!: Phaser.GameObjects.Image;
  private nightPanel!: Phaser.GameObjects.Container;
  private nightTitle!: Phaser.GameObjects.Text;
  private tallyText!: Phaser.GameObjects.Text;
  private shop = new Map<ShopId, ShopParts>();
  private caskIcon!: Phaser.GameObjects.Image;
  private caskText!: Phaser.GameObjects.Text;
  private gameOver!: Phaser.GameObjects.Container;
  /** The Great Owl, the dashed line along the row it is warned for, and its plaque. */
  private owl!: Phaser.GameObjects.Image;
  private owlMarks!: Phaser.GameObjects.Graphics;
  private owlTag!: Phaser.GameObjects.Container;
  private owlTitle!: Phaser.GameObjects.Text;
  private owlNote!: Phaser.GameObjects.Text;
  /** The window-call plaque beside the lantern a window asks for. */
  private callTag!: Phaser.GameObjects.Container;
  private callTitle!: Phaser.GameObjects.Text;
  private callNote!: Phaser.GameObjects.Text;
  private movePanel!: Phaser.GameObjects.Container;
  private moveTitle!: Phaser.GameObjects.Text;
  private moveCards = new Map<DistrictId, { bg: Phaser.GameObjects.Image; note: Phaser.GameObjects.Text }>();
  private perilPanel!: Phaser.GameObjects.Container;
  private perilTitle!: Phaser.GameObjects.Text;
  private perilMultText!: Phaser.GameObjects.Text;
  private perilCards: { bg: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text; note: Phaser.GameObjects.Text; blurb: Phaser.GameObjects.Text }[] = [];
  private gameOverText!: Phaser.GameObjects.Text;
  /** The night kind's layers: mist banks, feast bunting and storm rain. */
  private fog!: Phaser.GameObjects.Image;
  private bunting!: Phaser.GameObjects.Image;
  private rain!: Phaser.GameObjects.Graphics;
  /** The cords of the lantern chains, under the lanterns. */
  private cords!: Phaser.GameObjects.Graphics;
  private kindIcon!: Phaser.GameObjects.Image;
  private kindName!: Phaser.GameObjects.Text;
  private kindBlurb!: Phaser.GameObjects.Text;
  /** Bat puppets and their tap zones, one per bat on screen, by index into `state.bats`. */
  private bats: { body: Phaser.GameObjects.Image; hit: Phaser.GameObjects.Zone }[] = [];
  /** Dotted flight lines from the bats to their lanterns, and rings round the bats. */
  private batMarks!: Phaser.GameObjects.Graphics;
  private festival!: Phaser.GameObjects.Container;
  private skyLanterns: Phaser.GameObjects.Image[] = [];
  /**
   * The view's edges in world pixels. The world and the panels keep the designed 960x540 frame,
   * which the camera centres in a view of any shape (scrolled by -FX, -FY), so the view spans
   * `left` to `right` and `top` to `bottom`; the HUD, the order card and the kind plaque are pinned
   * to its edges. At 960x540 they are the frame's own edges.
   */
  private left = 0;
  private right: number = VIEW.w;
  private top = 0;
  private bottom: number = VIEW.h;
  /** Where the order card and the kind plaque sit, pinned under the HUD at the view's corners. */
  private orderAt = { x: ORDER.x, y: ORDER.y };
  private kindAt = { x: KIND_TAG.x, y: KIND_TAG.y };

  constructor() {
    super('Game');
  }

  create() {
    // The designed frame sits in the middle of the view (see `FX`, `FY` in art/puppet.ts).
    this.cameras.main.setScroll(-FX, -FY);
    this.left = -FX;
    this.right = VIEW.w + FX;
    this.top = -FY;
    this.bottom = VIEW.h + FY;
    this.orderAt = { x: ORDER.x - FX, y: ORDER.y - FY };
    this.kindAt = { x: KIND_TAG.x + FX, y: KIND_TAG.y - FY };
    this.state = this.freshGame();
    this.dailyRecord = loadDaily(GAME);
    this.createWorld();
    this.createOrderCard();
    this.createKindTag();
    this.createGustTag();
    this.createOwl();
    this.createCallTag();
    this.createHud();
    this.createNightPanel();
    this.createMovePanel();
    this.createPerilPanel();
    this.createGameOver();
    this.createFestival();
    this.createBoonPanel();
    this.createDailyPanel();
    this.createVillagePanel();
    updateMusic(this.state, true);
  }

  /** A new game, with the moths' flights, the harbour's boon and the village carried in from earlier games. */
  private freshGame() {
    return newGame(loadBest(), loadBestPeril(), { flown: loadFlown(), boon: loadBoon(), village: loadVillage() });
  }

  /** A tap on lantern `i`: a moth flutters off, or the tap queues with a pip; a lost tap buzzes. */
  private tapLantern(i: number) {
    const s = this.state;
    const queued = s.queue.length;
    if (send(s, i)) sfx(s.queue.length > queued ? 'pip' : 'flutter');
    else if (s.phase === 'dusk' && s.lanterns[i]) ui('refuse');
  }

  /** The sound of a tapped action: its own sound (or a click) when done, the refusal buzz when not. */
  private answer(done: boolean, sound?: SoundName) {
    if (!done) ui('refuse');
    else if (sound) sfx(sound);
    else ui('click');
  }

  /** A line of serif lettering: `glow` lights it from behind like light through cut card. */
  private label(x: number, y: number, text: string, o: TextOpts) {
    const lettering = this.add.text(x, y, text, {
      fontFamily: FONT,
      fontSize: `${o.size}px`,
      fontStyle: o.bold ? 'bold' : 'normal',
      color: o.color ?? '#f4e2c8',
      ...(o.stroke ? { stroke: INK, strokeThickness: 4 } : {}),
    });
    if (o.glow) lettering.setShadow(0, 0, 'rgba(255,150,70,0.85)', 6, !!o.stroke, true);
    return lettering;
  }

  /** A sprite painted at RES canvas pixels per view pixel, drawn at view size. */
  private sprite(x: number, y: number, key: string) {
    return this.add.image(x, y, key).setScale(1 / RES);
  }

  /** A full-view layer painted at BACK_RES, drawn over the whole view from its top-left. */
  private backdrop(key: string) {
    return this.add.image(this.left, this.top, key).setOrigin(0).setScale(1 / BACK_RES);
  }

  private createWorld() {
    this.screens = SCREENS.map((key) => this.backdrop(key).setDepth(0));
    this.stars = this.backdrop('stars').setDepth(1);
    this.moon = this.sprite(650, 86, 'moon').setDepth(1);
    this.castle = this.backdrop('castle-keep').setDepth(2);
    this.bunting = this.backdrop('bunting').setDepth(2.5);
    this.wind = this.add.graphics().setDepth(4);
    this.cords = this.add.graphics().setDepth(4.2);
    this.fog = this.backdrop('fog').setDepth(4.4);
    this.rain = this.add.graphics().setDepth(4.5);
    this.jar2 = this.sprite(JARS[1].x, JARS[1].y - 20, 'jar').setDepth(4.6).setVisible(false);

    LANTERN_SPOTS.forEach(({ x, y }, i) => {
      const glow = this.add.image(x, y, 'glow').setDepth(3).setBlendMode(Phaser.BlendModes.ADD);
      const lamp = this.sprite(x, y, 'lantern-dark').setDepth(5);
      lamp.setOrigin(0.5, lampOriginY('plain'));
      const flame = this.sprite(x, y, 'flame').setDepth(5);
      const bg = this.add.image(-42 - PAD, -11 - PAD, 'save-tag').setOrigin(0).setScale(1 / RES);
      const tagText = this.label(0, 0, '', { size: 11, bold: true, color: '#ffc890', glow: true }).setOrigin(0.5);
      const tag = this.add.container(x, y - 53, [bg, tagText]).setDepth(8);
      const kindLabel = this.label(x, y + 36, '', { size: 9.5, bold: true, color: '#ffd8a0', stroke: true }).setOrigin(0.5).setDepth(6.1).setVisible(false);
      const hit = this.add
        .zone(x, y, LANTERN_HIT.w, LANTERN_HIT.h)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.tapLantern(i));
      this.lamps.push({ glow, lamp, flame, tag, tagText, kindLabel, hit });
    });
    this.marks = this.add.graphics().setDepth(6);
    this.trails = this.add.graphics().setDepth(6);
    this.batMarks = this.add.graphics().setDepth(6.2);
    this.water = this.add.graphics().setDepth(5.5);
    this.tideLabel = this.label(0, 0, '', { size: 12.5, bold: true, color: '#cfe8ff', stroke: true }).setOrigin(0.5).setDepth(8.5).setVisible(false);
    this.ship = this.sprite(-200, SHIP_Y, 'ship').setDepth(7.1).setVisible(false);
    this.shipLabel = this.label(0, 0, '', { size: 11, bold: true, color: '#ffe6b0', stroke: true }).setOrigin(0.5).setDepth(8.5).setVisible(false);
    this.houses = this.add.graphics().setDepth(2.6);
    this.snowLabel = this.label(0, 0, '', { size: 12.5, bold: true, color: '#eef4ff', stroke: true }).setOrigin(0.5).setDepth(8.5).setVisible(false);
    this.pilgrimLabel = this.label(0, 0, '', { size: 11, bold: true, color: '#ffe6b0', stroke: true }).setOrigin(0.5).setDepth(8.5).setVisible(false);
  }

  private createKindTag() {
    const { x, y } = this.kindAt;
    this.add.image(x - PAD, y - PAD, 'kind-tag').setOrigin(0).setScale(1 / RES).setDepth(UI_DEPTH);
    this.kindIcon = this.sprite(x + 22, y + 20, 'kind-clear').setDepth(UI_DEPTH);
    this.kindName = this.label(x + 44, y + 14, '', { size: 12.5, bold: true, color: '#ffd08a', glow: true }).setOrigin(0, 0.5).setDepth(UI_DEPTH);
    this.kindBlurb = this.label(x + 44, y + 28, '', { size: 9.5, color: '#e0cfb4' }).setOrigin(0, 0.5).setDepth(UI_DEPTH);
  }

  private createOrderCard() {
    const { x, y } = this.orderAt;
    const { w } = ORDER;
    this.add.image(x - PAD, y - PAD, 'order-card').setOrigin(0).setScale(1 / RES).setDepth(UI_DEPTH);
    this.label(x + 42, y + 15, t('heraldsOrder'), { size: 10, bold: true, color: '#ffd08a', glow: true }).setOrigin(0, 0.5).setDepth(UI_DEPTH);
    this.orderText = this.label(x + 42, y + 29, '', { size: 10.5, glow: true }).setOrigin(0, 0.5).setDepth(UI_DEPTH);
    this.orderReward = this.label(x + w - 24, y + 18.5, '', { size: 8.5, bold: true, color: INK }).setOrigin(0.5).setDepth(UI_DEPTH);
    this.orderProgressText = this.label(x + 118, y + 45, '', { size: 9.5, color: '#c9a882' }).setOrigin(0, 0.5).setDepth(UI_DEPTH);
    for (let k = 0; k < 3; k++) this.orderPips.push(this.sprite(x + 50 + k * 22, y + 45, 'pip-dark').setDepth(UI_DEPTH));
  }

  private createGustTag() {
    const bg = this.add.image(-PAD, -PAD, 'gust-tag').setOrigin(0).setScale(1 / RES);
    this.gustTitle = this.label(34, 15, '', { size: 12.5, bold: true, color: '#dbe8ff', glow: true }).setOrigin(0, 0.5);
    this.gustTitle.setShadow(0, 0, 'rgba(140,180,255,0.8)', 6, false, true);
    this.gustNote = this.label(32, 29, '', { size: 7.5, color: '#b8c8e4' }).setOrigin(0, 0.5);
    this.gustTag = this.add.container(0, 0, [bg, this.gustTitle, this.gustNote]).setDepth(8.5).setVisible(false);
    this.gustPointer = this.add.graphics().setDepth(8.4);
  }

  /** The owl puppet (off screen until it sweeps), the row's dashed line and the "Owl in Ns" plaque. */
  private createOwl() {
    this.owl = this.sprite(-200, -200, 'owl-up').setDepth(9).setVisible(false);
    this.owlMarks = this.add.graphics().setDepth(4.1);
    const bg = this.add.image(-PAD, -PAD, 'owl-tag').setOrigin(0).setScale(1 / RES);
    this.owlTitle = this.label(40, 15, '', { size: 12.5, bold: true, color: '#ffe6c0', glow: true }).setOrigin(0, 0.5);
    this.owlNote = this.label(40, 29, '', { size: 7.5, color: '#e0cfb4' }).setOrigin(0, 0.5);
    this.owlTag = this.add.container(0, 0, [bg, this.owlTitle, this.owlNote]).setDepth(8.5).setVisible(false);
  }

  /** The plaque of a window calling for a lantern, with its countdown. */
  private createCallTag() {
    const bg = this.add.image(-PAD, -PAD, 'call-tag').setOrigin(0).setScale(1 / RES);
    this.callTitle = this.label(40, 15, '', { size: 12.5, bold: true, color: '#ffd890', glow: true }).setOrigin(0, 0.5);
    this.callNote = this.label(40, 29, '', { size: 7.5, color: '#e0cfb4' }).setOrigin(0, 0.5);
    this.callTag = this.add.container(0, 0, [bg, this.callTitle, this.callNote]).setDepth(8.5).setVisible(false);
  }

  /** The bar across the top of the view: its left group pinned to the left edge, lanterns lit to the right, dusk in the middle. */
  private createHud() {
    const l = this.left;
    const y = this.top;
    this.add.image(l, y, 'hud').setOrigin(0).setScale(1 / HUD_RES).setDepth(UI_DEPTH);
    this.caskIcon = this.sprite(l + CASK_HUD.x, y + CASK_HUD.y, 'cask-full').setDepth(UI_DEPTH);
    this.caskText = this.label(l + CASK_HUD.x + 15, y + CASK_HUD.y, '', { size: 13, bold: true, color: '#ffe4b8' }).setOrigin(0, 0.5).setDepth(UI_DEPTH);
    this.nightText = this.label(l + 14, y + 20, '', { size: 18, bold: true, color: '#ffc870', glow: true }).setOrigin(0, 0.5).setDepth(UI_DEPTH);
    for (let i = 0; i < LIVES; i++) this.hearths.push(this.sprite(l + 130 + i * 22, y + 20, 'hearth-lit').setDepth(UI_DEPTH));
    this.sprite(l + 221, y + 20, 'coin').setDepth(UI_DEPTH);
    this.coinsText = this.label(l + 236, y + 20, '', { size: 18, bold: true, color: '#ffe4b8', glow: true }).setOrigin(0, 0.5).setDepth(UI_DEPTH);
    this.duskFill = this.add.image(DUSK.x, y + DUSK.y, 'dusk-fill').setOrigin(0).setScale(1 / RES).setDepth(UI_DEPTH);
    this.add.image(DUSK.x - 1, y + DUSK.y - 1, 'dusk-rim').setOrigin(0).setScale(1 / RES).setDepth(UI_DEPTH);
    this.duskSun = this.sprite(DUSK.x, y + DUSK.y + 8, 'sun').setDepth(UI_DEPTH).setBlendMode(Phaser.BlendModes.ADD);
    this.duskText = this.label(DUSK.x + DUSK.w / 2 + 14, y + DUSK.y + 8.5, '', { size: 12, bold: true, color: '#fff3dc', stroke: true })
      .setOrigin(0.5)
      .setDepth(UI_DEPTH + 1);
    this.needText = this.label(this.right - 14, y + 20, '', { size: 15, color: '#c9a882' }).setOrigin(1, 0.5).setDepth(UI_DEPTH);
    this.litText = this.label(this.right - 76, y + 20, '', { size: 18, bold: true, color: '#ffc870', glow: true }).setOrigin(1, 0.5).setDepth(UI_DEPTH);
  }

  /** A dimming veil over the whole view, under a panel; it takes the taps the panel doesn't. */
  private dim(alpha: number) {
    const w = this.right - this.left;
    const h = this.bottom - this.top;
    return this.add.rectangle(this.left + w / 2, this.top + h / 2, w, h, 0x000000, alpha).setInteractive();
  }

  private createNightPanel() {
    const { x, y, w, h } = NIGHT_PANEL;
    const dim = this.dim(0.35);
    const panel = this.add.image(x - w / 2 - PAD, y - h / 2 - PAD, 'panel').setOrigin(0).setScale(1 / RES);
    this.nightTitle = this.label(x, y - h / 2 + 32, '', { size: 26, bold: true, color: '#ffc870', glow: true }).setOrigin(0.5);
    this.tallyText = this.label(x, y - h / 2 + 116, '', { size: 13 }).setOrigin(0.5).setAlign('center').setLineSpacing(3);
    const parts: Phaser.GameObjects.GameObject[] = [dim, panel, this.nightTitle, this.tallyText];
    const cards: ShopId[] = [...UPGRADE_IDS, 'cask', 'hearth'];
    cards.forEach((id, i) => {
      const bx = SHOP.xs[i % 3];
      const by = SHOP.ys[Math.floor(i / 3)];
      const left = bx - SHOP.w / 2;
      const top = by - SHOP.h / 2;
      const bg = this.add.image(left - PAD, top - PAD, 'card-off').setOrigin(0).setScale(1 / RES);
      const title = t(id === 'cask' ? 'caskName' : id === 'hearth' ? 'hearthName' : UPGRADES[id].name);
      const text = id === 'cask' ? t('caskBlurb', { n: CASK_NIGHT }) : t(id === 'hearth' ? 'hearthBlurb' : UPGRADES[id].blurb);
      const name = this.label(left + 12, top + 7, title, { size: 15, bold: true, color: '#ffc870', glow: true });
      const level = this.label(left + 18 + name.width, top + 10, '', { size: 10, color: '#b8a8c8' });
      const blurb = this.label(left + 12, top + 31, text, { size: 10.5, color: '#e0cfb4' });
      const cost = this.label(left + SHOP.w - 12, top + 9, '', { size: 12, bold: true, color: '#ffc870' }).setOrigin(1, 0);
      const hit = this.add
        .zone(bx, by, SHOP.w, SHOP.h)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const done = id === 'cask' ? topUp(this.state) : id === 'hearth' ? rekindle(this.state) : buy(this.state, id);
          this.answer(done, id === 'cask' ? 'glug' : id === 'hearth' ? 'swell' : 'kaching');
        });
      this.shop.set(id, { bg, level, cost });
      this.shopButtons.push({ id, x: bx, y: by, w: SHOP.w, h: SHOP.h });
      parts.push(bg, name, level, blurb, cost, hit);
    });
    parts.push(makeButton(this, NEXT_BUTTON.x, NEXT_BUTTON.y, t('nextDusk'), () => this.answer(nextDusk(this.state), 'evening')));
    // The daily night's link, right of "Next dusk": the run waits while it is played. Once played,
    // today's record goes under it, smaller and wrapped to the link's width.
    const d = this.dailyButton;
    this.dailyLink = this.label(d.x, d.y, '', { size: 12.5, bold: true, color: '#d8c8ff', glow: true })
      .setOrigin(0.5)
      .setAlign('center')
      .setWordWrapWidth(d.w);
    const dailyHit = this.add
      .zone(d.x, d.y, d.w, d.h)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.openDaily());
    parts.push(this.dailyLink, dailyHit);
    // The village's link, left of "Next dusk" (LK18).
    const v = this.villageButton;
    const villageLink = this.label(v.x, v.y, t('villageButton'), { size: 14, bold: true, color: '#ffd890', glow: true }).setOrigin(0.5);
    const villageHit = this.add
      .zone(v.x, v.y, v.w, v.h)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        ui('click');
        this.villageOpen = true;
      });
    parts.push(villageLink, villageHit);
    this.nightPanel = this.add.container(0, 0, parts).setDepth(UI_DEPTH + 10).setVisible(false);
  }

  /** A fifth nightfall's choice of district: a card for each, with its rule; a tap picks it. */
  private createMovePanel() {
    const cx = VIEW.w / 2;
    const cy = VIEW.h / 2;
    const dim = this.dim(0.35);
    const panel = this.add.image(cx - MOVE_PANEL.w / 2 - PAD, cy - MOVE_PANEL.h / 2 - PAD, 'panel-move').setOrigin(0).setScale(1 / RES);
    this.moveTitle = this.label(cx, cy - MOVE_PANEL.h / 2 + 32, '', { size: 26, bold: true, color: '#ffc870', glow: true }).setOrigin(0.5);
    const sub = this.label(cx, cy - MOVE_PANEL.h / 2 + 66, t('moveSub'), {
      size: 12.5,
    })
      .setOrigin(0.5)
      .setAlign('center');
    const parts: Phaser.GameObjects.GameObject[] = [dim, panel, this.moveTitle, sub];
    MOVE_IDS.forEach((id, i) => {
      const bx = MOVE_CARDS.xs[i % 2];
      const by = MOVE_CARDS.ys[Math.floor(i / 2)];
      const left = bx - MOVE_CARDS.w / 2;
      const top = by - MOVE_CARDS.h / 2;
      const bg = this.add.image(left - PAD, top - PAD, 'card-wide-on').setOrigin(0).setScale(1 / RES);
      const name = this.label(left + 14, top + 6, t(DISTRICTS[id].name), { size: 16, bold: true, color: '#ffc870', glow: true });
      const note = this.label(left + MOVE_CARDS.w - 14, top + 10, '', { size: 11, color: '#b8a8c8' }).setOrigin(1, 0);
      const blurb = this.label(left + 14, top + 30, t(DISTRICTS[id].blurb), { size: 11.5, color: '#e0cfb4' }).setWordWrapWidth(MOVE_CARDS.w - 28);
      const hit = this.add
        .zone(bx, by, MOVE_CARDS.w, MOVE_CARDS.h)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.answer(moveTo(this.state, id), 'rumble'));
      this.moveCards.set(id, { bg, note });
      this.moveButtons.push({ id, x: bx, y: by, w: MOVE_CARDS.w, h: MOVE_CARDS.h });
      parts.push(bg, name, note, blurb, hit);
    });
    parts.push(this.label(cx, cy + MOVE_PANEL.h / 2 - 28, t('moveHint'), { size: 11, color: '#c9a882' }).setOrigin(0.5));
    this.movePanel = this.add.container(0, 0, parts).setDepth(UI_DEPTH + 12).setVisible(false);
  }

  /** The curses offered at a nightfall from PERIL_NIGHT: two cards to take, and "Go on". */
  private createPerilPanel() {
    const cx = VIEW.w / 2;
    const cy = VIEW.h / 2;
    const dim = this.dim(0.35);
    const panel = this.add.image(cx - MOVE_PANEL.w / 2 - PAD, cy - MOVE_PANEL.h / 2 - PAD, 'panel-move').setOrigin(0).setScale(1 / RES);
    this.perilTitle = this.label(cx, cy - MOVE_PANEL.h / 2 + 32, '', { size: 26, bold: true, color: '#ffc870', glow: true }).setOrigin(0.5);
    const sub = this.label(cx, cy - MOVE_PANEL.h / 2 + 68, t('perilSub'), {
      size: 12.5,
    })
      .setOrigin(0.5)
      .setAlign('center');
    this.perilMultText = this.label(cx, cy + 50, '', { size: 13, bold: true, color: '#ffd890' }).setOrigin(0.5);
    const parts: Phaser.GameObjects.GameObject[] = [dim, panel, this.perilTitle, sub, this.perilMultText];
    for (let k = 0; k < 2; k++) {
      const bx = MOVE_CARDS.xs[k];
      const by = cy - 20;
      const left = bx - MOVE_CARDS.w / 2;
      const top = by - MOVE_CARDS.h / 2;
      const bg = this.add.image(left - PAD, top - PAD, 'card-wide-on').setOrigin(0).setScale(1 / RES);
      const name = this.label(left + 14, top + 6, '', { size: 16, bold: true, color: '#ffc870', glow: true });
      const note = this.label(left + MOVE_CARDS.w - 14, top + 10, '', { size: 11, color: '#b8a8c8' }).setOrigin(1, 0);
      const blurb = this.label(left + 14, top + 32, '', { size: 11.5, color: '#e0cfb4' });
      const hit = this.add
        .zone(bx, by, MOVE_CARDS.w, MOVE_CARDS.h)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const id = this.perilCards[k].name.getData('curse') as CurseId | undefined;
          const taken = !!id && takeCurse(this.state, id);
          if (taken) saveBestPeril(this.state.bestPeril);
          this.answer(taken, 'pluck');
        });
      this.perilCards.push({ bg, name, note, blurb });
      this.perilButtons.push({ x: bx, y: by, w: MOVE_CARDS.w, h: MOVE_CARDS.h });
      parts.push(bg, name, note, blurb, hit);
    }
    parts.push(makeButton(this, this.goOnButton.x, this.goOnButton.y, t('goOn'), () => this.answer(endPeril(this.state))));
    this.perilPanel = this.add.container(0, 0, parts).setDepth(UI_DEPTH + 12).setVisible(false);
  }

  private createGameOver() {
    const cx = VIEW.w / 2;
    const cy = VIEW.h / 2;
    const dim = this.dim(0.6);
    const panel = this.add.image(cx - SMALL_PANEL.w / 2 - PAD, cy - SMALL_PANEL.h / 2 - PAD, 'panel-small').setOrigin(0).setScale(1 / RES);
    const title = this.label(cx, cy - 76, t('keepDark'), { size: 28, bold: true, color: '#ffc870', glow: true }).setOrigin(0.5);
    this.gameOverText = this.label(cx, cy - 10, '', { size: 16 }).setOrigin(0.5).setAlign('center');
    const again = makeButton(this, cx - 110, cy + 72, t('newKeep'), () => this.restart());
    const daily = makeButton(this, cx + 110, cy + 72, t('dailyNight'), () => this.openDaily(cx + 110, cy + 40));
    this.gameOver = this.add.container(0, 0, [dim, panel, title, this.gameOverText, again, daily]).setDepth(UI_DEPTH + 20).setVisible(false);
  }

  /** The Great Festival's panel, with paper sky lanterns rising behind it. */
  private createFestival() {
    const cx = VIEW.w / 2;
    const cy = VIEW.h / 2;
    const dim = this.dim(0.35);
    for (let k = 0; k < 12; k++) {
      const sky = this.sprite(this.left + 40 + ((k * 331) % (this.right - this.left - 80)), 0, 'sky-lantern').setScale((0.7 + (k % 3) * 0.2) / RES);
      this.skyLanterns.push(sky);
    }
    const panel = this.add.image(cx - MOVE_PANEL.w / 2 - PAD, cy - MOVE_PANEL.h / 2 - PAD, 'panel-move').setOrigin(0).setScale(1 / RES);
    const title = this.label(cx, cy - MOVE_PANEL.h / 2 + 34, t('festivalTitle'), { size: 28, bold: true, color: '#ffc870', glow: true }).setOrigin(0.5);
    const text = this.label(cx, cy - 12, t('festivalText', { n: FESTIVAL_NIGHTS }), { size: 15 })
      .setOrigin(0.5)
      .setAlign('center');
    // Three ways on: stay, sail to the harbour (LK15) or climb to the monastery (LK20).
    const go = makeButton(this, this.carryOnButton.x, this.carryOnButton.y, t('keepGoing'), () => this.answer(carryOn(this.state)), true);
    const sailOff = makeButton(this, this.sailButton.x, this.sailButton.y, t('setSail'), () => this.answer(sail(this.state), 'rumble'), true);
    const climbUp = makeButton(this, this.climbButton.x, this.climbButton.y, t('climb'), () => this.answer(climb(this.state), 'rumble'), true);
    this.festival = this.add
      .container(0, 0, [dim, ...this.skyLanterns, panel, title, text, go, sailOff, climbUp])
      .setDepth(UI_DEPTH + 15)
      .setVisible(false);
  }

  /** The Harbour Festival (LK15): three boons, one to keep for every later game. */
  private createBoonPanel() {
    const cx = VIEW.w / 2;
    const cy = VIEW.h / 2;
    const dim = this.dim(0.35);
    const panel = this.add.image(cx - MOVE_PANEL.w / 2 - PAD, cy - MOVE_PANEL.h / 2 - PAD, 'panel-move').setOrigin(0).setScale(1 / RES);
    // The Harbour Festival's texts, or the Mountain Festival's (LK20), set as the panel opens.
    this.boonTitle = this.label(cx, cy - MOVE_PANEL.h / 2 + 32, t('harbourFestivalTitle'), { size: 26, bold: true, color: '#ffc870', glow: true }).setOrigin(0.5);
    this.boonSub = this.label(cx, cy - MOVE_PANEL.h / 2 + 68, t('boonSub', { n: FESTIVAL_NIGHTS }), { size: 12.5 })
      .setOrigin(0.5)
      .setAlign('center');
    const parts: Phaser.GameObjects.GameObject[] = [dim, panel, this.boonTitle, this.boonSub];
    const spots = [
      { x: MOVE_CARDS.xs[0], y: MOVE_CARDS.ys[0] },
      { x: MOVE_CARDS.xs[1], y: MOVE_CARDS.ys[0] },
      { x: cx, y: MOVE_CARDS.ys[1] },
    ];
    BOON_IDS.forEach((id, i) => {
      const { x: bx, y: by } = spots[i];
      const left = bx - MOVE_CARDS.w / 2;
      const top = by - MOVE_CARDS.h / 2;
      const bg = this.add.image(left - PAD, top - PAD, 'card-wide-on').setOrigin(0).setScale(1 / RES);
      const name = this.label(left + 14, top + 6, t(BOONS[id].name), { size: 16, bold: true, color: '#ffc870', glow: true });
      const note = this.label(left + MOVE_CARDS.w - 14, top + 10, '', { size: 11, color: '#b8a8c8' }).setOrigin(1, 0);
      const blurb = this.label(left + 14, top + 30, t(BOONS[id].blurb), { size: 11.5, color: '#e0cfb4' }).setWordWrapWidth(MOVE_CARDS.w - 28);
      const hit = this.add
        .zone(bx, by, MOVE_CARDS.w, MOVE_CARDS.h)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const taken = takeBoon(this.state, id);
          if (taken) saveBoon(id);
          this.answer(taken, 'swell');
        });
      this.boonNotes.set(id, note);
      this.boonButtons.push({ id, x: bx, y: by, w: MOVE_CARDS.w, h: MOVE_CARDS.h });
      parts.push(bg, name, note, blurb, hit);
    });
    parts.push(this.label(cx, cy + MOVE_PANEL.h / 2 - 24, t('boonHint'), { size: 11, color: '#c9a882' }).setOrigin(0.5));
    this.boonPanel = this.add.container(0, 0, parts).setDepth(UI_DEPTH + 15).setVisible(false);
  }

  /** The end of a daily night (LK17): today's score, the best and the streak, and the way back. */
  private createDailyPanel() {
    const cx = VIEW.w / 2;
    const cy = VIEW.h / 2;
    const dim = this.dim(0.45);
    const panel = this.add.image(cx - SMALL_PANEL.w / 2 - PAD, cy - SMALL_PANEL.h / 2 - PAD, 'panel-small').setOrigin(0).setScale(1 / RES);
    const title = this.label(cx, cy - 78, t('dailyNight'), { size: 28, bold: true, color: '#d8c8ff', glow: true }).setOrigin(0.5);
    this.dailyText = this.label(cx, cy - 12, '', { size: 15 }).setOrigin(0.5).setAlign('center');
    const back = makeButton(this, this.backButton.x, this.backButton.y, t('backToKeep'), () => this.leaveDaily());
    this.dailyPanel = this.add.container(0, 0, [dim, panel, title, this.dailyText, back]).setDepth(UI_DEPTH + 20).setVisible(false);
  }

  /** The village below the keep (LK18): its houses and three buildings to build for every game after, and "Back". */
  private createVillagePanel() {
    const cx = VIEW.w / 2;
    const cy = VIEW.h / 2;
    const dim = this.dim(0.35);
    const panel = this.add.image(cx - MOVE_PANEL.w / 2 - PAD, cy - MOVE_PANEL.h / 2 - PAD, 'panel-move').setOrigin(0).setScale(1 / RES);
    const title = this.label(cx, cy - MOVE_PANEL.h / 2 + 32, t('villageTitle'), { size: 26, bold: true, color: '#ffc870', glow: true }).setOrigin(0.5);
    this.villageSub = this.label(cx, cy - MOVE_PANEL.h / 2 + 68, '', { size: 12.5 }).setOrigin(0.5).setAlign('center');
    const parts: Phaser.GameObjects.GameObject[] = [dim, panel, title, this.villageSub];
    const spots = [
      { x: MOVE_CARDS.xs[0], y: MOVE_CARDS.ys[0] - 4 },
      { x: MOVE_CARDS.xs[1], y: MOVE_CARDS.ys[0] - 4 },
      { x: cx, y: MOVE_CARDS.ys[1] - 8 },
    ];
    BUILDING_IDS.forEach((id, i) => {
      const { x: bx, y: by } = spots[i];
      const left = bx - MOVE_CARDS.w / 2;
      const top = by - MOVE_CARDS.h / 2;
      const bg = this.add.image(left - PAD, top - PAD, 'card-wide-off').setOrigin(0).setScale(1 / RES);
      const name = this.label(left + 14, top + 6, t(BUILDINGS[id].name), { size: 16, bold: true, color: '#ffc870', glow: true });
      const note = this.label(left + MOVE_CARDS.w - 14, top + 10, '', { size: 11, bold: true, color: '#ffc870' }).setOrigin(1, 0);
      const blurb = this.label(left + 14, top + 32, t(BUILDINGS[id].blurb), { size: 11.5, color: '#e0cfb4' }).setWordWrapWidth(MOVE_CARDS.w - 28);
      const hit = this.add
        .zone(bx, by, MOVE_CARDS.w, MOVE_CARDS.h)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const built = build(this.state, id);
          if (built) saveVillage(this.state.village);
          this.answer(built, 'kaching');
        });
      this.villageCards.set(id, { bg, note });
      this.villageButtons.push({ id, x: bx, y: by, w: MOVE_CARDS.w, h: MOVE_CARDS.h });
      parts.push(bg, name, note, blurb, hit);
    });
    parts.push(
      makeButton(this, this.villageBack.x, this.villageBack.y, t('back'), () => {
        ui('click');
        this.villageOpen = false;
      }),
    );
    this.villagePanel = this.add.container(0, 0, parts).setDepth(UI_DEPTH + 12).setVisible(false);
  }

  /**
   * Starts today's daily night, putting the game aside (from the night panel or the game over).
   * Once today's try is used it floats today's record at (`x`, `y`) instead.
   */
  private openDaily(x = this.dailyButton.x, y = this.dailyButton.y - 30) {
    this.dailyRecord = loadDaily(GAME);
    if (this.dailyRecord.played || this.state.daily) {
      ui('refuse');
      this.popup(x, y, this.dailyLine(), '#d8c8ff', 13, UI_DEPTH + 30);
      return;
    }
    ui('click');
    this.dailyRecord = startDaily(GAME);
    this.run = this.state;
    this.state = dailyNight(dailyRand(GAME), loadBest(), loadBestPeril());
    this.lastFrame = null;
    updateMusic(this.state, true);
    // Today's two curses, named as the dusk begins.
    const curses = (Object.keys(CURSES) as CurseId[]).filter((id) => this.state.curses[id] > 0).map((id) => t(CURSES[id].name));
    this.popup(VIEW.w / 2, 210, t('dailyCurses', { curses: curses.join(' + ') }), '#d8c8ff', 15);
  }

  /** Back from the daily's end to the game put aside, or a new one. */
  private leaveDaily() {
    if (this.state.phase !== 'daily') return;
    ui('click');
    this.state = this.run ?? this.freshGame();
    this.run = null;
    updateMusic(this.state, true);
  }

  /** Today's daily, in a line: not yet played, started but left, or its score with the best and streak. */
  private dailyLine() {
    const r = this.dailyRecord;
    if (!r.played) return t('dailyNight');
    if (r.score === null) return t('dailyLeft');
    return t('dailyDone', { score: r.score, best: r.best, n: r.streak });
  }

  update(time: number) {
    // Game time from the frame's own timestamp rather than Phaser's smoothed delta, which holds
    // every step to 16ms while the page is not in focus.
    const dt = this.lastFrame === null ? 0 : Phaser.Math.Clamp(time - this.lastFrame, 0, MAX_STEP_MS);
    this.lastFrame = time;
    this.clock += dt;
    const s = this.state;
    const phase = s.phase;
    const before = phase === 'dusk' ? snapshot(s) : null;
    tick(s, dt);
    // A daily night earns no trophies: it starts mid-game with upgrades it didn't buy.
    if (!s.daily) checkTrophies(s);
    const events = s.events.splice(0);
    if (before) frameSounds(before, s, events);
    for (const e of events) this.showEvent(e);
    if (s.phase !== phase) {
      saveBest(s.best);
      if (s.breeds) saveFlown(s.flown);
      if (!s.daily) saveVillage(s.village);
      this.villageOpen = false;
      this.nightAt = this.clock;
      this.payout();
      nightfallSounds(s, (ms, fn) => this.time.delayedCall(ms, fn));
    }
    // The daily's score is kept once its nightfall has been scored (finishDaily keeps only the first).
    if (s.phase === 'daily' && this.dailyRecord.score === null) this.dailyRecord = finishDaily(GAME, s.coins);
    updateMusic(s);
    this.drawScreen();
    this.drawDistrict();
    this.drawKind();
    this.drawChains();
    this.drawLanterns();
    this.drawGust();
    this.drawOwl();
    this.drawCall();
    this.drawHarbour();
    this.drawMountain();
    this.drawVillage();
    this.drawMoths();
    this.drawBats();
    this.drawOrder();
    this.drawHud();
    this.drawPanels();
  }

  /** How far dusk has gone, from 0 at its start to 1 once night has fallen. */
  private dusk() {
    return this.state.phase === 'dusk' ? 1 - this.state.duskMs / this.state.duskMax : 1;
  }

  /** The paper screen crossfades from saffron through deep dusk to indigo; stars and moon come out. */
  private drawScreen() {
    const p = this.dusk();
    const [a, b, c] = this.screens;
    a.setVisible(p < 0.6);
    b.setVisible(true).setAlpha(p < 0.6 ? p / 0.6 : 1);
    c.setVisible(p > 0.6).setAlpha(Phaser.Math.Clamp((p - 0.6) / 0.4, 0, 1));
    this.stars.setAlpha(Phaser.Math.Clamp(p * 1.6 - 0.3, 0, 1));
    this.moon.setY(170 - 84 * p).setAlpha(Phaser.Math.Clamp(p * 1.5, 0, 1));
  }

  /** The district's scenery, baked the first time the keep moves there. */
  private drawDistrict() {
    const id = this.state.district;
    if (id === this.shownDistrict) return;
    if (!this.textures.exists(`castle-${id}`)) bakeScenery(this, id);
    this.castle.setTexture(`castle-${id}`).setScale(1 / BACK_RES);
    this.shownDistrict = id;
  }

  /** The night's kind: its plaque, and mist, bunting or rain over the castle. */
  private drawKind() {
    const s = this.state;
    const kind = NIGHT_KINDS[s.kind];
    this.kindIcon.setTexture(`kind-${s.kind}`);
    // The plaque names the season too (LK19), shrunk to fit a long name.
    const season = seasonOf(s.night);
    const name = t('kindSeason', { kind: t(kind.name), season: t(SEASONS[season].name) });
    if (name !== this.kindName.text) {
      this.kindName.setFontSize(12.5).setText(name);
      for (let size = 12; size >= 9.5 && this.kindName.width > KIND_TAG.w - 52; size -= 0.5) this.kindName.setFontSize(size);
    }
    this.kindBlurb.setText(t(kind.blurb));
    const still = settings.reduceMotion;
    this.fog.setVisible(s.kind === 'fog').setX(this.left + (still ? 0 : Math.sin(this.clock / 6000) * 30));
    this.bunting.setVisible(s.kind === 'feast');
    const g = this.rain.clear();
    const w = this.right - this.left;
    const h = this.bottom - this.top;
    const many = (n: number) => Math.round((n * w * h) / (VIEW.w * VIEW.h));
    if (s.kind === 'storm') {
      // Slanted streaks falling across the screen; reduce motion holds them still.
      const fall = still ? 0 : this.clock * 0.5;
      for (let k = 0; k < many(90); k++) {
        const x = this.left + ((k * 137 + fall * 0.4) % (w + 40));
        const y = this.top + ((((k * 211) % VIEW.h) + fall) % h);
        g.lineStyle(1, 0xc8d4ff, 0.3).lineBetween(x, y, x - 6, y + 15);
      }
    }
    if (season === 'winter' || season === 'autumn') {
      // Winter's snowflakes or autumn's leaves drift down; reduce motion holds them still.
      const fall = still ? 0 : this.clock * (season === 'winter' ? 0.04 : 0.06);
      const n = many(season === 'winter' ? 70 : 24);
      for (let k = 0; k < n; k++) {
        const sway = still ? 0 : Math.sin(this.clock / 900 + k) * 8;
        const x = this.left + ((((k * 173) % w) + sway + w) % w);
        const y = this.top + ((((k * 97) % h) + fall * (0.7 + (k % 3) * 0.2)) % h);
        if (season === 'winter') g.fillStyle(0xf4f8ff, 0.75).fillCircle(x, y, 1.2 + (k % 3) * 0.5);
        else g.fillStyle(k % 2 ? 0xe08a3c : 0xc8642a, 0.7).fillEllipse(x, y, 5, 2.6);
      }
    }
  }

  /**
   * The village at the foot of the screen (LK18): a lit window and a roof line for each house, and
   * the buildings built, bigger, with their own gel. Redrawn only when the village changes.
   */
  private drawVillage() {
    const v = this.state.village;
    const key = `${v.houses}:${v.built.join(',')}`;
    if (key === this.housesShown) return;
    this.housesShown = key;
    const g = this.houses.clear();
    const y = VIEW.h - 8;
    // The buildings stand at the left end, past the corner buttons, the houses along the rest, clear of the jars.
    let x = this.left + 104;
    const BUILDING_GEL: Record<BuildingId, number> = { smithy: 0xff7a3a, chandler: 0xffd870, chapel: 0xb8c8ff };
    for (const id of BUILDING_IDS) {
      if (!v.built.includes(id)) continue;
      g.lineStyle(1.6, 0xd89a60, 1).strokeTriangle(x - 13, y - 14, x + 13, y - 14, x, y - 27);
      g.strokeRect(x - 11, y - 14, 22, 14);
      g.fillStyle(BUILDING_GEL[id], 0.95).fillRect(x - 4, y - 10, 8, 8);
      if (id === 'chapel') g.fillStyle(BUILDING_GEL[id], 0.95).fillCircle(x, y - 20, 2.4);
      if (id === 'smithy') g.fillStyle(0xff9a50, 0.8).fillCircle(x + 8, y - 28, 2);
      x += 32;
    }
    let shown = 0;
    for (; x < this.right - 16 && shown < v.houses; x += 24) {
      if (Math.abs(x - JARS[0].x) < 40 || Math.abs(x - JARS[1].x) < 30) continue;
      g.lineStyle(1.4, 0xd89a60, 1).strokeTriangle(x - 9, y - 10, x + 9, y - 10, x, y - 19);
      g.lineStyle(1.2, 0xd89a60, 0.7).strokeRect(x - 7, y - 10, 14, 10);
      g.fillStyle(0xffc870, 0.6).fillCircle(x, y - 5, 5);
      g.fillStyle(0xffe0a0, 1).fillRect(x - 2.5, y - 7, 5, 5);
      shown++;
    }
  }

  /**
   * The monastery (LK20): the avalanche's warning (a dashed snow line over the low path, a
   * countdown), the pilgrim's lamp climbing the path, a violet ring on the bell tower to ring, and
   * snow mounds on buried lanterns.
   */
  private drawMountain() {
    const s = this.state;
    const g = this.water;
    const a = s.phase === 'dusk' ? s.avalanche : null;
    this.snowLabel.setVisible(!!a);
    this.pilgrimLabel.setVisible(!!a && !a.rung);
    s.lanterns.forEach((l) => {
      if (!l.buried || s.phase !== 'dusk') return;
      g.fillStyle(0xeef4ff, 0.9).fillEllipse(l.x, l.y + 14, 40, 16);
      g.fillStyle(0xeef4ff, 0.75).fillEllipse(l.x - 8, l.y + 4, 22, 14);
    });
    if (!a) return;
    const still = settings.reduceMotion;
    const left = Math.max(1, Math.ceil((s.duskMs - a.atMs) / 1000));
    const dash = still ? 0 : (this.clock / 50) % 14;
    for (let x = this.left - dash; x < this.right; x += 14) g.lineStyle(2, 0xeef4ff, 0.8).lineBetween(x, a.y - 40, Math.min(this.right, x + 7), a.y - 40);
    // A pale ring round each lantern of the path: a moth on one keeps it.
    for (const i of a.lanterns) {
      const l = s.lanterns[i];
      const spin = still ? 0 : this.clock / 2000;
      for (let k = 0; k < 24; k++) {
        const ang = spin + (k / 24) * Math.PI * 2;
        g.lineStyle(1.6, 0xeef4ff, 0.95).beginPath().arc(l.x, l.y, 28, ang, ang + 0.14).strokePath();
      }
    }
    this.snowLabel.setPosition(VIEW.w / 2, a.y - 56).setText(t('avalancheIn', { n: left }));
    if (a.rung) return;
    // The pilgrim's lamp climbs the path from the west as the snow comes.
    const p = Phaser.Math.Clamp(1 - (s.duskMs - a.atMs) / 8_000, 0, 1);
    const px = this.left + 30 + (VIEW.w / 2 - 60 - this.left) * p;
    g.fillStyle(0xffe6b0, 0.35).fillCircle(px, a.y + 72, 7);
    g.fillStyle(0xffe6b0, 1).fillCircle(px, a.y + 72, 2.6);
    const bell = s.lanterns[a.bell];
    const pulse = still ? 1 : 0.7 + 0.3 * Math.sin(this.clock / 150);
    this.marks.lineStyle(2, 0xd8c8ff, 0.9 * pulse).strokeCircle(bell.x, bell.y, 33);
    const spot = DISTRICTS[s.district].spots[a.bell];
    this.pilgrimLabel.setText(t('pilgrimRing', { spot: t(spot.name), coins: PILGRIM_PAY }));
    const half = this.pilgrimLabel.width / 2 + 8;
    this.pilgrimLabel.setPosition(Phaser.Math.Clamp(bell.x, this.left + half, this.right - half), bell.y + 58);
  }

  /**
   * The cords of the chains this night has: a dotted line sagging from lantern to lantern, faint
   * until all of the chain is lit, then amber.
   */
  private drawChains() {
    const s = this.state;
    const g = this.cords.clear();
    for (const i of chainsFor(s)) {
      const lit = chainLit(s, i);
      const spots = chainsOf(s)[i].lanterns.map((l) => s.lanterns[l]);
      for (let k = 1; k < spots.length; k++) {
        const a = spots[k - 1];
        const b = spots[k];
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        const n = Math.floor(d / 7);
        for (let j = 2; j < n - 1; j++) {
          const f = j / n;
          const x = a.x + (b.x - a.x) * f;
          const y = a.y - 22 + (b.y - a.y) * f + Math.sin(f * Math.PI) * 18;
          if (lit) g.fillStyle(0xffc870, 0.25).fillCircle(x, y, 3.2);
          g.fillStyle(lit ? 0xffd890 : 0xfff0c8, lit ? 1 : 0.35).fillCircle(x, y, lit ? 1.5 : 1.1);
        }
      }
    }
  }

  private drawLanterns() {
    const s = this.state;
    const g = this.marks.clear();
    const still = settings.reduceMotion;
    this.lamps.forEach((parts, i) => {
      const lantern = s.lanterns[i];
      parts.lamp.setVisible(!!lantern);
      // A spot the night has no lantern on takes no taps and shows no hand cursor.
      parts.hit.setVisible(!!lantern);
      parts.glow.setVisible(!!lantern?.lit);
      parts.flame.setVisible(!!lantern?.lit);
      parts.tag.setVisible(false);
      parts.kindLabel.setVisible(false);
      if (!lantern) return;
      const { x, y } = lantern;
      // The lanterns hang where the district puts them.
      parts.lamp.setPosition(x, y);
      parts.glow.setPosition(x, y);
      parts.flame.setPosition(x, y);
      parts.hit.setPosition(x, y);
      parts.tag.setX(x);
      const kind = lantern.kind === 'plain' ? '' : `${lantern.kind}-`;
      // setTexture keeps the origin's fraction, so re-anchor it for the taller special textures.
      parts.lamp.setTexture(`lantern-${kind}${lantern.lit ? 'lit' : 'dark'}`).setOrigin(0.5, lampOriginY(lantern.kind));
      if (lantern.buried) parts.kindLabel.setVisible(true).setPosition(x, y + 38).setText(t('snowedIn'));
      else if (lantern.kind !== 'plain') {
        parts.kindLabel.setVisible(true).setPosition(x, y + 38).setText(t(LANTERN_KINDS[lantern.kind].name));
      }
      // The flicker wavers the flame and the glow; reduce motion holds them still.
      const flicker = still ? 0 : Math.sin(this.clock / 90 + i * 1.7);
      const f = lantern.lit ? Phaser.Math.Clamp(lantern.oilMs / lantern.oilMaxMs, 0, 1) : 0;
      if (lantern.lit) {
        const strength = Math.min(1, f / 0.3);
        parts.glow.setScale(((60 + 24 * strength) / 64) * (1 + flicker * 0.03)).setAlpha(0.5 + 0.5 * strength);
        parts.flame.setScale(1 / RES, (1 / RES) * (1 + flicker * 0.12));
        // The oil left, a strip of gel under the lantern; it turns orange when low.
        const bx = x - 18;
        const by = y + 24;
        g.fillStyle(INK_HEX).fillRect(bx - 1.5, by - 1.5, 39, 8);
        g.fillStyle(f < 0.25 ? 0xff7a3a : 0xffd070).fillRect(bx, by, 36 * f, 5);
      }
      const moth = s.moths.find((m) => m.target === i && (m.task === 'lighting' || m.task === 'guard'));
      const queued = s.queue.indexOf(i);
      if (moth?.task === 'lighting') this.holes(g, x, y, 23, Math.min(1, moth.lightingMs / Math.max(1, mothLightMs(s, moth))), 0xfff6d0, 1.6);
      else if (moth?.task === 'guard') this.holes(g, x, y, 23, 1, 0xbcd4ff, 1.8);
      else if (queued >= 0) {
        this.holes(g, x, y, 23, 1, 0xffb040, 1.8);
        g.fillStyle(INK_HEX).fillCircle(x + 20, y - 22, 7);
      } else if (flooded(s, i)) this.holes(g, x, y, 23, 1, 0x7ab8e0, 1.3);
      else if (!lantern.lit && !lantern.claimed && s.phase === 'dusk') this.holes(g, x, y, 23, 0, 0xffffff, 1.3);
      this.queueBadge(i, queued);
      // A nearly dry lantern with no moth on its way: a refill now is a close call.
      // With the cask dry (or every fill spoken for) no refill can be sent, so nothing invites one.
      if (s.phase === 'dusk' && lantern.lit && !lantern.claimed && f < CLOSE_CALL && caskSpare(s)) {
        const pulse = still ? 1 : 0.65 + 0.35 * Math.sin(this.clock / 120);
        g.lineStyle(1.8, 0xff8c3c, 0.95 * pulse).strokeCircle(x, y, 25);
        g.lineStyle(1.8, 0xff8c3c, 0.4 * pulse).strokeCircle(x, y, 31);
        parts.tag.setVisible(true).setY(y - 53);
        parts.tagText.setText(t('saveIt', { n: closeCallPay(s) }));
      }
    });
  }

  /** The queue position badge numbers, made on demand. */
  private badges = new Map<number, Phaser.GameObjects.Text>();
  private queueBadge(i: number, queued: number) {
    let badge = this.badges.get(i);
    if (queued < 0) {
      badge?.setVisible(false);
      return;
    }
    if (!badge) {
      badge = this.label(0, 0, '', { size: 10, bold: true, color: '#ffb040' }).setOrigin(0.5).setDepth(6.1);
      this.badges.set(i, badge);
    }
    const l = this.state.lanterns[i];
    badge.setVisible(true).setPosition(l.x + 20, l.y - 22).setText(formatNumber(queued + 1));
  }

  /** A ring of punched holes round (x, y), the first `f` of them lit in `color`. */
  private holes(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, f: number, color: number, size: number) {
    const n = 28;
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (k / n) * Math.PI * 2;
      const on = k / n < f;
      g.fillStyle(on ? color : 0xfff0c8, on ? 1 : 0.22).fillCircle(x + Math.cos(a) * r, y + Math.sin(a) * r, size);
    }
  }

  /** The gust warning: wind curls sweeping in from the nearer edge, a dashed ring and the countdown plaque. */
  private drawGust() {
    const s = this.state;
    const g = this.wind.clear();
    const p = this.gustPointer.clear();
    const gust = s.phase === 'dusk' ? s.gust : null;
    this.gustTag.setVisible(!!gust);
    if (!gust) return;
    const T = s.lanterns[gust.target];
    const still = settings.reduceMotion;
    const fromRight = T.x >= VIEW.w / 2;
    const edge = fromRight ? this.right - 4 : this.left + 4;
    const dir = fromRight ? 1 : -1;
    const curl = (y0: number, bend: number, width: number, alpha: number, phase: number) => {
      const end = new Phaser.Math.Vector2(T.x + 30 * dir, T.y - 4);
      const curve = new Phaser.Curves.CubicBezier(
        new Phaser.Math.Vector2(edge, y0),
        new Phaser.Math.Vector2(edge - 56 * dir, y0 + bend),
        new Phaser.Math.Vector2(T.x + 70 * dir, T.y - 20 + bend / 2),
        end,
      );
      const pts = curve.getPoints(40);
      g.lineStyle(width, 0xffecd2, alpha * (still ? 0.85 : 0.45)).strokePoints(pts);
      if (!still) {
        // A brighter gust of air travels along the curl.
        const along = (this.clock / 900 + phase) % 1;
        const a = Math.floor(along * 34);
        g.lineStyle(width + 0.6, 0xfff6e8, alpha).strokePoints(pts.slice(a, a + 8));
      }
      g.lineStyle(width, 0xffecd2, alpha * 0.85).beginPath().arc(end.x + 4 * dir, end.y - 4, 4, Math.PI * 0.7, Math.PI * 2.1).strokePath();
    };
    curl(T.y - 24, -14, 2.2, 0.85, 0);
    curl(T.y + 12, 10, 1.6, 0.6, 0.33);
    curl(T.y + 48, -4, 1.3, 0.45, 0.66);
    // A dashed pale-blue ring round the lantern the gust is coming for.
    const spin = still ? 0 : this.clock / 2000;
    for (let k = 0; k < 24; k++) {
      const a = spin + (k / 24) * Math.PI * 2;
      g.lineStyle(1.6, 0xd2e6ff, 0.95).beginPath().arc(T.x, T.y, 28, a, a + 0.14).strokePath();
    }
    // The plaque beside it, clear of the order card and the HUD.
    // Beside the lantern on the windward side, or the other side when the screen edge is too near.
    const right = Math.min(T.x + 38, this.right - 4 - GUST_TAG.w);
    const left = Math.max(T.x - 38 - GUST_TAG.w, this.left + 4);
    let tx = fromRight ? right : left;
    if (fromRight && tx < T.x + 30) tx = left;
    if (!fromRight && tx + GUST_TAG.w > T.x - 30) tx = right;
    let ty = Math.max(this.top + 46, T.y - 80);
    if (tx < this.orderAt.x + ORDER.w + 6 && ty < this.orderAt.y + ORDER.h + 6) ty = this.orderAt.y + ORDER.h + 8;
    this.gustTag.setPosition(tx, ty);
    const secs = Math.max(1, Math.ceil((s.duskMs - gust.atMs) / 1000));
    this.gustTitle.setText(t('gustIn', { n: secs }));
    const shielded = s.moths.some((m) => m.target === gust.target && (m.task === 'lighting' || m.task === 'guard'));
    this.gustNote.setText(t(shielded ? 'gustShielding' : T.sheltered ? 'gustSheltered' : 'gustShield'));
    // The plaque's pointer, a sliver of card reaching to the lantern.
    const px = tx + (fromRight ? 30 : GUST_TAG.w - 30);
    p.fillStyle(INK_HEX).fillTriangle(px - 6, ty + GUST_TAG.h - 1, px + 6, ty + GUST_TAG.h - 1, T.x + 14 * dir, T.y - 26);
  }

  /**
   * The Great Owl: while warned, a dashed line along its row and a plaque counting down; while
   * sweeping, the owl puppet flying across.
   */
  private drawOwl() {
    const s = this.state;
    const g = this.owlMarks.clear();
    const owl = s.phase === 'dusk' ? s.owl : null;
    this.owlTag.setVisible(!!owl && owl.x === null);
    this.owl.setVisible(!!owl && owl.x !== null);
    if (!owl) return;
    const still = settings.reduceMotion;
    if (owl.x === null) {
      // A dashed pale line along the row, and a ring round each lantern on it.
      const dash = still ? 0 : (this.clock / 40) % 16;
      for (let x = this.left - dash; x < this.right; x += 16) g.lineStyle(1.6, 0xffe6c0, 0.7).lineBetween(x, owl.y - 36, Math.min(this.right, x + 9), owl.y - 36);
      for (const i of owl.lanterns) {
        const l = s.lanterns[i];
        const spin = still ? 0 : this.clock / 2000;
        for (let k = 0; k < 24; k++) {
          const a = spin + (k / 24) * Math.PI * 2;
          g.lineStyle(1.6, 0xffe6c0, 0.95).beginPath().arc(l.x, l.y, 28, a, a + 0.14).strokePath();
        }
      }
      // The plaque at the right end of the row, under the HUD and clear of the kind plaque.
      const tx = this.right - 4 - GUST_TAG.w;
      let ty = Math.max(this.top + 46, owl.y - 84);
      if (ty < this.kindAt.y + KIND_TAG.h + 6) ty = this.kindAt.y + KIND_TAG.h + 8;
      this.owlTag.setPosition(tx, ty);
      const secs = Math.max(1, Math.ceil((s.duskMs - owl.atMs) / 1000));
      this.owlTitle.setText(t('owlIn', { n: secs }));
      this.owlNote.setText(t('owlNote'));
      return;
    }
    const wingsUp = still || Math.floor(this.clock / 140) % 2 === 0;
    const bob = still ? 0 : Math.sin(this.clock / 180) * 4;
    this.owl.setTexture(wingsUp ? 'owl-up' : 'owl-down').setPosition(owl.x, owl.y - 30 + bob).setAlpha(edgeFade(owl.x, 40));
  }

  /** A window's call: a pulsing ring on the lantern it asks for, and a plaque with the countdown. */
  private drawCall() {
    const s = this.state;
    const call = s.phase === 'dusk' ? s.call : null;
    this.callTag.setVisible(!!call);
    if (!call) return;
    const l = s.lanterns[call.lantern];
    const g = this.owlMarks;
    const pulse = settings.reduceMotion ? 1 : 0.7 + 0.3 * Math.sin(this.clock / 150);
    g.lineStyle(2, 0xffd890, 0.9 * pulse).strokeCircle(l.x, l.y, 33);
    // Beside the lantern, on the side with room, clear of the order card and the kind plaque.
    let tx = l.x + 38;
    if (tx + CALL_TAG.w > this.right - 4) tx = l.x - 38 - CALL_TAG.w;
    let ty = Math.max(this.top + 46, l.y + 30);
    if (ty + CALL_TAG.h > this.bottom - 4) ty = l.y - 80;
    const { orderAt, kindAt } = this;
    if (tx < orderAt.x + ORDER.w + 6 && ty < orderAt.y + ORDER.h + 6) ty = orderAt.y + ORDER.h + 8;
    if (tx + CALL_TAG.w > kindAt.x - 6 && ty < kindAt.y + KIND_TAG.h + 6) ty = kindAt.y + KIND_TAG.h + 8;
    this.callTag.setPosition(tx, ty);
    this.callTitle.setText(t('windowCalls', { n: Math.max(1, Math.ceil(call.msLeft / 1000)) }));
    this.callNote.setText(t('windowNote', { n: callPay(s) }));
  }

  /**
   * The harbour (LK15): the tide's warning (a wavy line under its row and a countdown), the water
   * up over the low quay, and a ship sailing in with a ring on the lantern it needs lit.
   */
  private drawHarbour() {
    const s = this.state;
    const g = this.water.clear();
    const still = settings.reduceMotion;
    const tide = s.phase === 'dusk' ? s.tide : null;
    this.tideLabel.setVisible(!!tide);
    if (tide) {
      const wave = (top: number, alpha: number) => {
        const pts: Phaser.Math.Vector2[] = [];
        for (let x = this.left; x <= this.right + 12; x += 12) pts.push(new Phaser.Math.Vector2(x, top + Math.sin(x / 26 + (still ? 0 : this.clock / 400)) * 3));
        return { pts, alpha };
      };
      if (!tide.risen) {
        const { pts } = wave(tide.y + 30, 1);
        g.lineStyle(1.6, 0x9ad8ff, 0.8).strokePoints(pts);
        this.tideLabel.setPosition(VIEW.w / 2, tide.y + 52).setText(t('tideIn', { n: Math.max(1, Math.ceil((s.duskMs - tide.atMs) / 1000)) }));
      } else {
        // The water rises over half a second and falls again as the tide ebbs.
        const up = Phaser.Math.Clamp((tide.atMs - s.duskMs) / 500, 0, 1);
        const down = Phaser.Math.Clamp((s.duskMs - (tide.atMs - TIDE_MS)) / 500, 0, 1);
        const top = this.bottom - (this.bottom - (tide.y - 14)) * Math.min(up, down);
        const { pts } = wave(top, 1);
        g.fillStyle(0x3a6a98, 0.55).fillPoints([...pts, new Phaser.Math.Vector2(this.right + 12, this.bottom), new Phaser.Math.Vector2(this.left, this.bottom)], true);
        g.lineStyle(1.8, 0xcfe8ff, 0.8).strokePoints(pts);
        this.tideLabel.setPosition(VIEW.w / 2, tide.y + 52).setText(t('tideUp', { n: Math.max(1, Math.ceil((s.duskMs - (tide.atMs - TIDE_MS)) / 1000)) }));
      }
    }
    const ship = s.phase === 'dusk' ? s.ship : null;
    this.ship.setVisible(!!ship);
    this.shipLabel.setVisible(!!ship);
    if (!ship) return;
    const x = shipX(s, ship);
    const bob = still ? 0 : Math.sin(this.clock / 300) * 2.5;
    this.ship.setPosition(x, SHIP_Y + bob).setFlipX(!ship.fromLeft).setAlpha(edgeFade(x, 70));
    const guide = s.lanterns[ship.guide];
    const spot = DISTRICTS[s.district].spots[ship.guide];
    this.shipLabel.setPosition(Phaser.Math.Clamp(x, this.left + 110, this.right - 110), SHIP_Y - 50).setText(t('shipComing', { n: Math.max(1, Math.ceil(ship.msLeft / 1000)), spot: t(spot.name), coins: SHIP_PAY }));
    const pulse = still ? 1 : 0.7 + 0.3 * Math.sin(this.clock / 150);
    this.marks.lineStyle(2, 0x9ad8e8, 0.9 * pulse).strokeCircle(guide.x, guide.y, 33);
  }

  private drawMoths() {
    const s = this.state;
    while (this.moths.length < s.moths.length) {
      const k = this.moths.length;
      const halo = this.add.image(0, 0, 'glow-pale').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.32).setScale(0.42).setDepth(6.5);
      const body = this.add.image(0, 0, 'moth-fast-up').setScale(1 / RES).setDepth(7);
      const hit = this.add
        .zone(-200, -200, MOTH_HIT.w, MOTH_HIT.h)
        .setDepth(7.4)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.answer(swapJar(this.state, k), 'swap'));
      const nap = this.label(0, 0, '', { size: 9, bold: true, color: '#e4d8ff', stroke: true }).setOrigin(0.5).setDepth(7.3).setVisible(false);
      this.moths.push({ halo, body, hit, nap });
    }
    while (this.moths.length > s.moths.length) {
      const m = this.moths.pop()!;
      m.halo.destroy();
      m.body.destroy();
      m.hit.destroy();
      m.nap.destroy();
    }
    const trail = this.trails.clear();
    const still = settings.reduceMotion;
    const twoJars = s.levels.jar > 0;
    this.jar2.setVisible(twoJars);
    s.moths.forEach((m, i) => {
      // Wings flap while flying and slowly while sitting; reduce motion holds them up and stops the bobbing.
      const sitting = m.task === 'lighting' || m.task === 'guard' || m.task === 'idle';
      const rate = sitting ? 320 : 90;
      // A tired moth rests with its wings folded down, its halo dimmed.
      const wingsUp = m.task !== 'rest' && (still || Math.floor(this.clock / rate + i) % 2 === 0);
      const bob = still || sitting || m.task === 'rest' ? 0 : Math.sin(this.clock / 260 + i * 2) * 3;
      const parts = this.moths[i];
      parts.body.setTexture(`moth-${m.kind}-${wingsUp ? 'up' : 'down'}`).setPosition(m.x, m.y + bob);
      parts.halo.setPosition(m.x, m.y + bob).setAlpha(m.task === 'rest' ? 0.12 : 0.32);
      // With two jars, an idle moth can be tapped to rest at the other one.
      const swappable = twoJars && m.task === 'idle' && s.phase === 'dusk';
      parts.hit.setPosition(swappable ? m.x : -200, swappable ? m.y : -200);
      parts.nap.setVisible(m.task === 'rest');
      // A dot under the moth for each trait it has grown.
      traitsOf(s, i).forEach((trait, k, all) => trail.fillStyle(TRAIT_LOOK[trait].color, 0.95).fillCircle(m.x + (k - (all.length - 1) / 2) * 6, m.y + 15 + bob, 2));
      if (m.task === 'rest') {
        // A lilac ring fills as it rests, under a "zz" countdown.
        this.holes(trail, m.x, m.y, 17, 1 - m.restMs / Math.max(1, restMs(s)), 0xd8c8ff, 1.4);
        parts.nap.setPosition(m.x, m.y - 26).setText(t('nap', { n: Math.ceil(m.restMs / 1000) }));
      }
      if (m.task === 'home') {
        // A dotted chalk trail back to its jar.
        const jar = JARS[twoJars ? (s.homes[i] ?? 0) : 0];
        const jx = jar.x;
        const jy = jar.y - 46;
        const d = Math.hypot(jx - m.x, jy - m.y);
        for (let k = 10; k < d; k += 5.5) trail.fillStyle(0xffe4b4, 0.45).fillCircle(m.x + ((jx - m.x) * k) / d, m.y + 6 + ((jy - m.y - 6) * k) / d, 0.8);
      }
    });
  }

  /** Bat puppets, the dotted line to the lantern each is after, and a ring that says it can be tapped. */
  private drawBats() {
    const s = this.state;
    while (this.bats.length < s.bats.length) {
      const k = this.bats.length;
      const body = this.add.image(0, 0, 'bat-up').setScale(1 / RES).setDepth(7.2);
      const hit = this.add
        .zone(0, 0, BAT_HIT.w, BAT_HIT.h)
        .setDepth(7.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const bat = this.state.bats[k];
          if (bat) this.answer(chase(this.state, bat.id), 'whoosh');
        });
      this.bats.push({ body, hit });
    }
    const g = this.batMarks.clear();
    const still = settings.reduceMotion;
    this.bats.forEach((parts, k) => {
      const bat = s.phase === 'dusk' ? s.bats[k] : undefined;
      parts.body.setVisible(!!bat);
      parts.hit.setVisible(!!bat).setPosition(bat ? bat.x : -200, bat ? bat.y : -200);
      if (!bat) return;
      const wingsUp = still || Math.floor(this.clock / 110 + k) % 2 === 0;
      const bob = still ? 0 : Math.sin(this.clock / 200 + k) * 2;
      const lantern = s.lanterns[bat.target];
      parts.body
        .setTexture(wingsUp ? 'bat-up' : 'bat-down')
        .setPosition(bat.x, bat.y + bob)
        .setAlpha(edgeFade(bat.x, 24))
        .setFlipX(bat.task === 'fly' ? lantern.x < bat.x : bat.x < VIEW.w / 2);
      if (bat.task !== 'fly') return;
      // A dotted violet line to the lantern it is after.
      const d = Math.hypot(lantern.x - bat.x, lantern.y - bat.y);
      for (let k = 24; k < d - 26; k += 9) g.fillStyle(0xd6c8ff, 0.55).fillCircle(bat.x + ((lantern.x - bat.x) * k) / d, bat.y + ((lantern.y - bat.y) * k) / d, 1.2);
      // A ring of holes round the bat: pale blue once a moth is chasing it, and a teal ring while a bell holds it.
      const chased = s.moths.some((m) => m.task === 'chase' && m.bat === bat.id);
      this.holes(g, bat.x, bat.y + bob, 22, chased ? 1 : 0, 0xbcd4ff, 1.4);
      if (stunned(s, bat)) {
        g.lineStyle(1.8, 0x9af0d8, 0.9).strokeCircle(bat.x, bat.y + bob, 27);
        for (let k = 0; k < 3; k++) g.fillStyle(0x9af0d8, 0.9).fillCircle(bat.x - 8 + k * 8, bat.y + bob - 32, 1.8);
      }
    });
  }

  private drawOrder() {
    const s = this.state;
    const { goal, reward } = s.order;
    const order = this.describeOrder(s.order);
    if (order !== this.orderText.text) {
      // A long order (three lanterns named) shrinks to stay clear of the reward badge, and at
      // the last wraps onto a second line above the pips.
      const room = ORDER.w - 82;
      this.orderText.setWordWrapWidth(null).setLineSpacing(0).setFontSize(10.5).setText(order);
      for (let size = 10; size >= 9 && this.orderText.width > room; size -= 0.5) this.orderText.setFontSize(size);
      const wrap = this.orderText.width > room;
      if (wrap) this.orderText.setWordWrapWidth(room).setLineSpacing(-2);
      const pipY = this.orderAt.y + (wrap ? 49 : 45);
      for (const pip of this.orderPips) pip.setY(pipY);
      this.orderProgressText.setY(pipY);
    }
    this.orderReward.setText(t('reward', { n: reward }));
    const { done, of } = orderProgress(s);
    this.orderPips.forEach((pip, k) => {
      pip.setVisible(k < of);
      const on = goal.kind === 'lit' ? !!s.lanterns[goal.lanterns[k]]?.lit : k < done;
      pip.setTexture(on ? 'pip-lit' : 'pip-dark');
    });
    this.orderProgressText.setX(this.orderAt.x + 50 + of * 22 + 2);
    const met = done >= of;
    const line = t(goal.kind === 'lit' ? (met ? 'progressLitMet' : 'progressLit') : goal.kind === 'closeCalls' ? 'progressSaved' : 'progressShielded', { done, of });
    this.orderProgressText.setText(s.phase === 'dusk' ? line : t(s.report?.orderMet ? 'orderKept' : 'orderMissed'));
  }

  private drawHud() {
    const s = this.state;
    this.nightText.setText(t('night', { n: s.night }));
    this.hearths.forEach((h, i) => h.setTexture(i < s.lives ? 'hearth-lit' : 'hearth-out'));
    this.coinsText.setText(formatNumber(s.coins));
    const lit = s.lanterns.filter((l) => l.lit).length;
    const need = required(s);
    this.litText.setText(t('lit', { lit, count: s.lanterns.length }));
    this.needText.setText(t('need', { n: need }));
    // The lit count stands left of the need, however wide a two-digit need makes it.
    this.litText.setX(Math.min(this.right - 76, this.needText.x - this.needText.width - 8));
    // setColor always redraws the text, so only set it when it changes.
    const litColour = lit >= need ? '#ffc870' : '#f4e2c8';
    if (this.litText.style.color !== litColour) this.litText.setColor(litColour);

    this.caskIcon.setTexture(s.cask > 0 ? 'cask-full' : 'cask-empty');
    this.caskText.setText(formatNumber(s.cask));
    // Grey until refills draw on it, orange once it is dry.
    const caskColour = !usesCask(s) ? '#8a7e8a' : s.cask <= 0 ? '#ff9a6a' : '#ffe4b8';
    if (this.caskText.style.color !== caskColour) this.caskText.setColor(caskColour);
    const f = s.phase === 'dusk' ? s.duskMs / s.duskMax : 0;
    this.duskFill.setCrop(0, 0, DUSK.w * RES * f, DUSK.h * RES).setVisible(f > 0);
    this.duskSun.setX(DUSK.x + DUSK.w * f);
    const secs = Math.ceil(s.duskMs / 1000);
    this.duskText.setText(s.phase !== 'dusk' ? t('nightHasFallen') : t(s.queue.length ? 'nightfallQueued' : 'nightfallIn', { s: secs, n: s.queue.length }));
  }

  /** True once the night panel or the game-over panel is open; read by the playthrough test. */
  get panelOpen() {
    return this.state.phase !== 'dusk' && this.clock - this.nightAt >= PANEL_DELAY_MS;
  }

  private drawPanels() {
    const s = this.state;
    if (s.phase !== 'night') this.villageOpen = false;
    this.nightPanel.setVisible(s.phase === 'night' && this.panelOpen && !this.villageOpen);
    this.villagePanel.setVisible(s.phase === 'night' && this.panelOpen && this.villageOpen);
    if (this.villageOpen) {
      this.villageSub.setText(t('villageSub', { n: s.village.houses }));
      for (const [id, parts] of this.villageCards) {
        const cost = buildCost(s, id);
        const built = s.village.built.includes(id);
        const affordable = cost !== null && s.coins >= cost;
        parts.bg.setTexture(affordable ? 'card-wide-on' : 'card-wide-off');
        parts.note.setText(built ? t('built') : cost === null ? t('needHouses', { n: BUILDINGS[id].houses }) : t('cost', { n: cost }));
        const colour = affordable ? '#ffc870' : '#8a7e8a';
        if (parts.note.style.color !== colour) parts.note.setColor(colour);
      }
    }
    this.gameOver.setVisible(s.phase === 'over' && this.panelOpen);
    this.festival.setVisible(s.phase === 'festival' && this.panelOpen);
    this.movePanel.setVisible(s.phase === 'move' && this.panelOpen);
    this.perilPanel.setVisible(s.phase === 'peril' && this.panelOpen);
    this.boonPanel.setVisible(s.phase === 'boon' && this.panelOpen);
    this.dailyPanel.setVisible(s.phase === 'daily' && this.panelOpen);
    if (s.phase === 'boon') {
      for (const [id, note] of this.boonNotes) note.setText(id === s.boon ? t('yourBoon') : '');
      const mountain = s.district === 'monastery';
      this.boonTitle.setText(t(mountain ? 'mountainFestivalTitle' : 'harbourFestivalTitle'));
      this.boonSub.setText(t(mountain ? 'mountainBoonSub' : 'boonSub', { n: FESTIVAL_NIGHTS }));
    }
    if (s.phase === 'daily' && s.report) {
      const r = s.report;
      this.dailyText.setText(
        t('dailyEnd', {
          district: t(DISTRICTS[s.district].name),
          kind: t(NIGHT_KINDS[s.kind].name),
          lit: r.lit,
          count: r.count,
          score: s.coins,
          halved: r.lostHearth ? t('dailyHalved') : '',
          best: this.dailyRecord.best,
          n: this.dailyRecord.streak,
        }),
      );
    }
    if (s.phase === 'peril') {
      this.perilTitle.setText(t('perilTitle', { n: s.night }));
      // A taken card stays where it was, greyed, until the panel closes.
      this.perilCards.forEach((card, k) => {
        const id = (card.name.getData('curse') as CurseId | undefined) ?? s.offer[k];
        if (!card.name.getData('curse') && id) card.name.setData('curse', id);
        if (!id) return;
        const taken = !s.offer.includes(id);
        card.bg.setTexture(taken ? 'card-wide-off' : 'card-wide-on');
        card.name.setText(t(CURSES[id].name));
        card.blurb.setText(t(CURSES[id].blurb));
        card.note.setText(taken ? t('taken') : s.curses[id] ? t('takenTimes', { n: s.curses[id] }) : '');
      });
      this.perilMultText.setText(t('perilMult', { mult: mult2(perilMult(s)), best: mult2(s.bestPeril) }));
    } else {
      for (const card of this.perilCards) card.name.setData('curse', undefined);
    }
    if (s.phase === 'move') {
      this.moveTitle.setText(t('moveTitle', { n: s.night }));
      for (const [id, parts] of this.moveCards) {
        const here = id === s.district;
        parts.bg.setTexture(here ? 'card-wide-off' : 'card-wide-on');
        parts.note.setText(here ? t('stayHere') : '');
      }
    }
    if (s.phase === 'festival') {
      // Sky lanterns drift up the screen and come round again; reduce motion holds them still.
      const rise = settings.reduceMotion ? 0 : this.clock / 40;
      const h = this.bottom - this.top;
      this.skyLanterns.forEach((sky, k) => sky.setY(this.bottom + 30 - ((((k * 97) % (h + 60)) + rise * (0.6 + (k % 3) * 0.2)) % (h + 60))));
    }
    const r = s.report;
    if (s.phase === 'night' && r) {
      this.nightTitle.setText(t('nightFalls', { n: s.night }));
      const verdict = t(r.lostHearth ? (s.spared ? 'verdictSpared' : 'verdictLost') : r.lit === r.count ? 'verdictAll' : 'verdictHeld');
      const mult = s.kind === 'feast' ? FEAST_PAY : 1;
      const order = r.orderMet ? t('orderKeptLine', { n: Math.round(s.order.reward * s.paidMult) }) : t('orderMissedLine');
      const chains = r.chains ? t('chainsLit', { n: r.chains, coins: Math.round(r.chains * CHAIN_BONUS * mult * s.paidMult) }) : '';
      const peril = s.paidMult > 1 ? t('cursesPaid', { mult: mult2(s.paidMult) }) : '';
      const during = [
        s.closeCalls ? t('closeCallsEarned', { n: s.closeCalls * closeCallPay(s) }) : '',
        s.callsKept ? t('windowsEarned', { n: s.callsKept * callPay(s) }) : '',
        s.shipsGuided ? t('shipsEarned', { n: s.shipsGuided * SHIP_PAY }) : '',
        s.pilgrimsWarned ? t('pilgrimsEarned', { n: s.pilgrimsWarned * PILGRIM_PAY }) : '',
      ]
        .filter(Boolean)
        .join(', ');
      const feast = mult > 1 ? t('feastDouble') : '';
      const goal = s.climbed
        ? s.mountainFestival
          ? t('mountainHeldGoal')
          : t('mountainGoal', { kept: s.mountainKept, of: FESTIVAL_NIGHTS })
        : s.sailed
        ? s.harbourFestival
          ? t('harbourHeldGoal')
          : t('harbourGoal', { kept: s.harbourKept, of: FESTIVAL_NIGHTS })
        : s.festival
          ? t('festivalHeldGoal')
          : t('festivalGoal', { kept: s.kept, of: FESTIVAL_NIGHTS });
      const next = NIGHT_KINDS[s.nextKind];
      const where = s.nextDistrict !== s.district ? t('nextWhere', { district: t(DISTRICTS[s.nextDistrict].name) }) : '';
      // English lowers the rule's first letter inside the brackets; German nouns keep their capital.
      const blurb = t(next.blurb);
      // A new season coming says what it brings (LK19).
      const nextSeason = seasonOf(s.night + 1);
      const seasonLine = nextSeason !== seasonOf(s.night) ? t('nextSeason', { season: t(SEASONS[nextSeason].name), blurb: t(SEASONS[nextSeason].blurb) }) : '';
      this.tallyText.setText([
        t('litLine', { lit: r.lit, count: r.count, need: r.required, feast }),
        order + chains,
        t('coinsLine', { n: r.earned, during: during ? `  (${during})` : '', peril }),
        verdict,
        goal,
        t('nextNight', { kind: t(next.name), where, blurb: language() === 'de' ? blurb : blurb[0].toLowerCase() + blurb.slice(1) }) + seasonLine,
      ]);
      const played = this.dailyRecord.played;
      this.dailyLink.setFontSize(played ? 11 : 12.5).setText(played ? `${t('dailyNight')}\n${this.dailyLine()}` : this.dailyLine());
      for (const [id, parts] of this.shop) {
        const cost = id === 'cask' ? (s.cask >= caskMax(s) ? null : caskCost(s)) : id === 'hearth' ? hearthCost(s) : nextCost(s, id);
        const affordable = cost !== null && s.coins >= cost;
        parts.bg.setTexture(affordable ? 'card-on' : 'card-off');
        parts.level.setText(
          id === 'cask'
            ? t('caskLevel', { n: s.cask, max: caskMax(s) })
            : id === 'hearth'
              ? t('hearthLevel', { n: s.lives, max: LIVES })
              : id === 'jar'
                ? ''
                : t('level', { n: s.levels[id], max: UPGRADES[id].costs.length }),
        );
        const none: TextKey = id === 'cask' ? 'full' : id === 'hearth' ? (s.rekindled >= HEARTH_COSTS.length ? 'spent' : 'allLit') : id === 'jar' ? 'built' : 'maxed';
        parts.cost.setText(cost === null ? t(none) : t('cost', { n: cost }));
        const costColour = affordable ? '#ffc870' : '#8a7e8a';
        if (parts.cost.style.color !== costColour) parts.cost.setColor(costColour);
      }
    }
    if (s.phase === 'over') {
      const festival = s.festival ? t('festivalWasHeld') : '';
      const peril = s.bestPeril > 1 ? t('bestPeril', { mult: mult2(s.bestPeril) }) : '';
      this.gameOverText.setText(t('gameOver', { night: s.night, kept: s.kept, festival, n: s.best, peril }));
    }
  }

  /** Lettering that floats up and fades; reduce motion keeps it still and only fades it. */
  private popup(x: number, y: number, text: string, color: string, size = 13, depth = UI_DEPTH - 1) {
    const lettering = this.label(x, y, text, { size, bold: true, color, stroke: true, glow: true }).setOrigin(0.5).setDepth(depth);
    const rise = settings.reduceMotion ? 0 : 34;
    this.tweens.add({ targets: lettering, y: y - rise, alpha: 0, duration: POPUP_MS, delay: 300, ease: 'Quad.easeIn', onComplete: () => lettering.destroy() });
  }

  private showEvent(e: GameEvent) {
    if (e.type === 'chased') {
      this.popup(e.x, e.y - 26, t('chasedOff'), '#dbe8ff');
      return;
    }
    if (e.type === 'trait') {
      const m = this.state.moths[e.moth];
      if (m) this.popup(m.x, m.y - 30, t(TRAIT_LOOK[e.trait].popup), '#fff0c0', 12);
      return;
    }
    const l = this.state.lanterns[e.lantern];
    if (!l) return;
    if (e.type === 'bat') {
      this.popup(l.x, l.y - 40, t(e.snuffed ? 'snuffed' : 'drivenOff'), e.snuffed ? '#d8c0ff' : '#dbe8ff');
    } else if (e.type === 'owl') {
      this.popup(l.x, l.y - 40, t(e.shielded ? 'keptPopup' : 'snuffed'), e.shielded ? '#ffe6c0' : '#d8c0ff');
    } else if (e.type === 'call') {
      this.popup(l.x, l.y - 40, e.kept ? t('windowLit', { n: e.coins }) : t('windowDarkens'), e.kept ? '#ffd890' : '#b8a8c8');
    } else if (e.type === 'dry') {
      this.popup(l.x, l.y - 40, t('caskDry'), '#ff9a6a');
    } else if (e.type === 'tide') {
      this.popup(l.x, l.y - 40, t('flooded'), '#cfe8ff');
    } else if (e.type === 'avalanche') {
      this.popup(l.x, l.y - 40, t(e.shielded ? 'keptPopup' : 'buried'), e.shielded ? '#ffe6c0' : '#eef4ff');
    } else if (e.type === 'pilgrim') {
      this.popup(l.x, l.y - 40, e.warned ? t('pilgrimWarned', { n: e.coins }) : t('pilgrimLost'), e.warned ? '#d8c8ff' : '#b8a8c8');
    } else if (e.type === 'ship') {
      this.popup(l.x, l.y - 40, e.guided ? t('shipGuided', { n: e.coins }) : t('shipTurned'), e.guided ? '#9ad8e8' : '#b8a8c8');
    } else if (e.type === 'closeCall') {
      // A flare of light and sparks round the saved lantern.
      const flare = this.add.image(l.x, l.y, 'glow-pale').setBlendMode(Phaser.BlendModes.ADD).setScale(1.1).setDepth(4);
      this.tweens.add({ targets: flare, alpha: 0, duration: 900, onComplete: () => flare.destroy() });
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2 + 0.3;
        const r0 = 14 + (k % 3) * 6;
        const spark = this.add.image(l.x + Math.cos(a) * r0, l.y - 4 + Math.sin(a) * r0, 'spark').setScale(1 / RES).setDepth(9);
        const r1 = settings.reduceMotion ? r0 : r0 + 18;
        this.tweens.add({
          targets: spark,
          x: l.x + Math.cos(a) * r1,
          y: l.y - 4 + Math.sin(a) * r1,
          alpha: 0,
          duration: 800,
          onComplete: () => spark.destroy(),
        });
      }
      this.popup(l.x, l.y - 40, t('closeCall', { n: e.coins }), '#ffe2a0');
    } else {
      this.popup(l.x, l.y - 40, t(e.shielded ? 'shielded' : 'blownOut'), e.shielded ? '#dbe8ff' : '#ffb08a');
    }
  }

  /** Coins float up from every lantern still lit at nightfall, and from the order card if it was kept. */
  private payout() {
    const r = this.state.report;
    if (!r) return;
    const s = this.state;
    const mult = (s.kind === 'feast' ? FEAST_PAY : 1) * s.paidMult;
    for (const lantern of s.lanterns) if (lantern.lit) this.popup(lantern.x, lantern.y - 34, `+${Math.round(lanternPay(s, lantern) * mult)}`, '#ffc870', 18);
    for (const i of chainsFor(s)) {
      if (!chainLit(s, i)) continue;
      const [a, , b] = chainsOf(s)[i].lanterns.map((l) => s.lanterns[l]);
      this.popup((a.x + b.x) / 2, (a.y + b.y) / 2 + 4, t('chainPay', { n: Math.round(CHAIN_BONUS * mult) }), '#ffd890', 15);
    }
    // Every night kept adds a house to the village (LK18).
    if (!s.daily && !r.lostHearth) this.popup(VIEW.w / 2 + 170, VIEW.h - 36, t('newHouse'), '#ffd890', 13);
    if (r.orderMet) this.popup(this.orderAt.x + ORDER.w - 24, this.orderAt.y + ORDER.h + 14, t('orderPay', { n: Math.round(s.order.reward * s.paidMult) }), '#ffc870', 15);
  }

  /** The order's text, naming the lanterns of the district the night is played in. */
  private describeOrder(order: Order) {
    const { goal } = order;
    if (this.state.district === 'keep' || goal.kind !== 'lit') return t(order.text);
    const spots = DISTRICTS[this.state.district].spots;
    return t('orderLit', { names: goal.lanterns.map((i) => t(spots[i].name)).join(', ') });
  }

  private restart() {
    ui('click');
    this.state = this.freshGame();
    updateMusic(this.state, true);
  }
}
