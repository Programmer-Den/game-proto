import Phaser from 'phaser';
import { formatNumber } from '../../../../shared/i18n';
import { playMusic, playSting, ui } from '../../../../shared/audio';
import { scrollingCamera, splitHudCamera, viewPoint, viewSize } from '../../../../shared/scaling';
import { settings } from '../../../../shared/settings';
import { RUSH_SONG, SONG, sfx } from '../audio';
import { pickUpPad, upgradePad, type UpgradeIcon } from '../art/markers';
import { INK, SERIF, TEXT_HALO, fit, resOf } from '../art/paint';
import { PIXIE_FRAMES } from '../art/pixies';
import { bakeYard, bedTexture, goodTexture, yardTexture } from '../art/town';
import { craftsmanTexture, customerTexture } from '../art/townsfolk';
import { signTexture } from '../art/ui';
import { loadState } from '../game/save';
import { tick, type Feedback } from '../game/sim';
import { FINE_SHARE, MAX_CARRY, SIGN_NAMES, UPGRADES, WEATHER, carryCapacity, gearLevel, harvestReach, isMarketDay, payBoost, payment, tipLeft, tipNow, walkSpeed, weatherFor, type GameState, type Upgrade } from '../game/state';
import {
  BEDS,
  OPEN_GARDENS,
  MAX_LEVEL,
  MAX_SHOPKEEPERS,
  MAX_WORKERS,
  SHOPS,
  SHOP_GUILD,
  SHOP_GUILD_UPGRADES,
  WALK_IN_MS,
  LESSONS,
  OUTFITTER_GEAR,
  gardenOpen,
  isBlightedBed,
  isLine2,
  line1Id,
  line2Cost,
  lineOpen,
  shopRoutes,
  shopStations,
  gearCost,
  lessonCost,
  levelCost,
  priorityChoices,
  recipeCost,
  shopKnows,
  shopMakes,
  shopSignOf,
  shopStudied,
  routeCost,
  guildCost,
  guildJoinCost,
  shopRouteSpeed,
  shopStorage,
  workerCost,
  type GoodId,
  type RouteDef,
  type ShopDef,
  type ShopId,
  type ShopState,
  type StationDef,
  plainGood,
  sellsGood,
  type Held,
} from '../game/town';
import {
  clearShopBlight,
  collectShopTill,
  cycleShopPriority,
  cycleShopSign,
  payGear,
  goodName,
  payLesson,
  payRecipe,
  inShopFineWindow,
  payGuildJoin,
  payLine2,
  payGuildUpgrade,
  shopContractKept,
  shopPrice,
  shopStockedPay,
  dropAtStation,
  harvestBed,
  isRipeBed,
  payCounterLevel,
  payRoute,
  payShopkeeper,
  payStationLevel,
  payWorker,
  pickUpFromStation,
  stockShopShelf,
  tickTown,
  tossGood,
} from '../game/townSim';
import { checkTrophies } from '../trophies/check';
import { t } from '../i18n';
import { coined } from '../ui/coins';
import { ProgressBar } from '../ui/ProgressBar';
import { SHOP_HUD, guildLayout, marketLayout, shopFence, shopStart, yardScenery, line2Layout, bedPosition, counterLayout, gardenLayout, routePath, shopWorld, stationLayout, type Point } from './shopLayout';
import { addWeather } from './weather';
import { setupZoom } from './zoom';
import { TOWN_HUD_H, TOWN_TEXT, TOWN_UI_DEPTH, keepSaving, leaveFor, townCard, townTopBar } from './townKit';

// A town shop's yard, built from its `ShopDef` the way the apothecary's is laid out by hand: the
// doctor walks it, the sickle cuts ripe beds, floor markers drop off, work and pick up at each
// station and stock the shelves, and purple markers buy levels, workers and pixie routes. Every
// other shop and the apothecary keep working meanwhile, as while away.

const SPEED = 160;
const MAX_STEP_MS = 250;
const MAX_WALK_STEP_PX = 20;
const WORLD_UI_DEPTH = TOWN_UI_DEPTH - 1;
const PIXIE_DEPTH = 5_000;
const MARKER_INTERVAL_MS = 200;
const HARVEST_INTERVAL_MS = 150;
const STILL_MS = 400;
const SICKLE_SPIN = 0.008;
const SICKLE_LINGER_MS = 400;
const HANDS_BAR = { h: 40, gap: 40 };
const CAPTION = { fontFamily: SERIF, fontSize: '12px', fontStyle: 'bold', stroke: TEXT_HALO, strokeThickness: 3, align: 'center', color: INK };
const CAPTION_PAY = '#5a2c80';
const COUNT = { fontFamily: SERIF, fontSize: '12px', fontStyle: 'bold', color: INK, stroke: TEXT_HALO, strokeThickness: 3 };
/** Widths of a station's "First:" sign and a shelf's price sign, as the apothecary's. */
const PRIORITY_SIGN_W = 92;
const PRICE_SIGN_W = 48;
/** The contract card under the top bar's purse. */
const CONTRACT_W = 300;
/** The town card at the top right under the top bar: the day's weather, the shop's reputation and the market day. */
const TOWN_CARD = { w: 300, h: 44 };
/**
 * The screen band the top bar and the cards under it cover. The camera scrolls up past the yard's top
 * so the yard below `SHOP_HUD` always shows below it, never under a card.
 */
const HUD_BAND = TOWN_HUD_H + 8 + TOWN_CARD.h + 4;
/** The weather is drawn over everything standing in the yard and the pixies, under the bubbles and bars. */
const WEATHER_DEPTH = WORLD_UI_DEPTH - 9;
/** A blighted bed's plant, greyed purple as at the apothecary. */
const BLIGHT_TINT = 0x8a7aa0;
/** An order bubble: its size, how far above a customer's feet its middle is, and its tip ring's radius. */
const BUBBLE = { w: 64, h: 30, above: 82, ring: 6 };
const SIGN_COLOURS = { cheap: '#2f6a1a', fair: INK, dear: '#8a3a10' };
/** A shelf's price while the overstock cut takes some off. */
const CUT_COLOUR = '#b04a10';

interface Marker {
  zone: Phaser.Geom.Rectangle;
  act: () => Feedback | null;
  shown: () => boolean;
  paused?: boolean;
  pays?: boolean;
}

export class ShopScene extends Phaser.Scene {
  private state!: GameState;
  private id!: ShopId;
  private def!: ShopDef;
  private player!: Phaser.Physics.Arcade.Sprite;
  private sickle!: Phaser.GameObjects.Image;
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<'up' | 'down' | 'left' | 'right', Phaser.Input.Keyboard.Key>;
  private pointerTarget: Phaser.Math.Vector2 | null = null;
  private waypoint: Phaser.Math.Vector2 | null = null;
  private blockedAreas: Phaser.Geom.Rectangle[] = [];
  private markers: Marker[] = [];
  private workSpots: { zone: Phaser.Geom.Rectangle; at: string }[] = [];
  private views: (() => void)[] = [];
  private nextMarkerAt = 0;
  private nextHarvestAt = 0;
  private nextFeedbackAt = 0;
  private stillSince: number | null = null;
  /** The marker the doctor's feet are on, and since when: paying speeds up the longer they stay. */
  private lastMarker?: Marker;
  private markerSince = 0;
  private refused: Marker | null = null;
  private sickleAngle = 0;
  private lastHarvestingAt = -Infinity;
  private frameMs = 0;

  constructor() {
    super('Shop');
  }

  private get shop(): ShopState {
    return this.state.town.shops[this.id]!;
  }

  create(data: { shop: ShopId; state?: GameState }) {
    // Entered only through `leaveFor`, which hands the state over and saved a moment ago, so there is
    // no time away to catch up on; the save is the fallback.
    this.state = data.state ?? loadState();
    this.id = data.shop;
    this.def = SHOPS[this.id];
    this.markers = [];
    this.workSpots = [];
    this.views = [];
    this.blockedAreas = [];
    this.pointerTarget = null;
    this.waypoint = null;
    this.refused = null;
    if (!this.state.town.shops[this.id]) {
      leaveFor(this, this.state, 'Town');
      return;
    }
    const world = shopWorld(this.id);
    bakeYard(this, this.id);
    fit(this.add.image(0, 0, yardTexture(this.id)).setOrigin(0).setDepth(-1000));
    this.physics.world.setBounds(0, SHOP_HUD, world.w, shopFence(this.id) - SHOP_HUD);
    this.events.off(Phaser.Scenes.Events.PRE_UPDATE, this.limitWalkStep, this);
    this.events.on(Phaser.Scenes.Events.PRE_UPDATE, this.limitWalkStep, this);
    this.obstacles = this.physics.add.staticGroup();

    this.createScenery();
    this.createGardens();
    this.createMarket();
    this.createGuild();
    this.createLine2();
    this.createCounter();
    this.createPixies();
    this.createCustomers();
    this.views.push(addWeather(this, world, WEATHER_DEPTH, () => this.state));
    this.createPlayer();
    this.createHud();
    this.createControls();
    this.createSound();
    scrollingCamera(this.cameras.main).startFollow(this.player, true);
    splitHudCamera(this);
    setupZoom(this, world, { band: HUD_BAND, under: SHOP_HUD });
    playMusic(SONG, 'calm');
    keepSaving(this, () => this.state);
  }

  // The yard

  private sign(x: number, y: number, text: string) {
    const name = this.add.text(x, y, text, { fontFamily: SERIF, fontSize: '13px', fontStyle: 'bold', color: INK }).setOrigin(0.5).setDepth(-900);
    return [name, fit(this.add.image(x, y, signTexture(this, name.width + 16))).setDepth(-910)] as const;
  }

  /** The yard's trees and bushes, standing like everything else, and the water and wells the doctor walks round. */
  private createScenery() {
    const { plants, blocks } = yardScenery(this.id);
    for (const { key, x, y } of plants) fit(this.add.image(x, y, key)).setOrigin(0.5, key.startsWith('tree') ? 84 / 88 : 28 / 32).setDepth(y);
    for (const b of blocks) this.addObstacle(b.x + b.w / 2, b.y + b.h / 2, b.w, b.h);
  }

  private createGardens() {
    this.def.gardens.forEach((garden, g) => {
      const layout = gardenLayout(this.id, g);
      this.sign(layout.sign.x, layout.sign.y, t(garden.name));
      const open = () => gardenOpen(this.shop, g);
      if (g >= OPEN_GARDENS) {
        const { area } = layout;
        const locked = this.add
          .text(area.x + area.w / 2, area.y + area.h / 2, t('gardenLocked'), { ...CAPTION, align: 'center', wordWrap: { width: area.w - 16 } })
          .setOrigin(0.5)
          .setDepth(-400);
        this.views.push(() => locked.setVisible(!open()));
      }
      for (let b = g * BEDS; b < (g + 1) * BEDS; b++) {
        const at = bedPosition(this.id, b);
        fit(this.add.image(at.x, at.y, 'plot')).setDepth(-500);
        const texture = (stage: number) => bedTexture(garden.good, stage);
        const plant = fit(this.add.image(at.x, at.y + 10, texture(2)).setOrigin(0.5, 1).setDepth(at.y));
        let drawn = -1;
        let blighted = false;
        this.views.push(() => {
          const grown = this.shop.beds[b] / garden.grow;
          const stage = grown >= 1 ? 2 : grown >= 0.5 ? 1 : 0;
          if (stage !== drawn) plant.setTexture(texture((drawn = stage)));
          fit(plant).setVisible(open());
          if (isBlightedBed(this.shop, b) !== blighted) plant.setTint((blighted = !blighted) ? BLIGHT_TINT : 0xffffff);
        });
      }
      for (const route of shopRoutes(this.def).filter((r) => 'garden' in r.from && r.from.garden === g)) {
        this.addRouteMarker(isLine2(route.id) ? layout.route2 : layout.route, route, () => !open() || !lineOpen(this.shop, route.id));
      }
    });
  }

  /** The outfitter, with one level each of the doctor's pack, boots and sickle, and the study with its two lessons. */
  private createMarket() {
    const MARKET = marketLayout(this.id);
    this.sign(MARKET.outfitter.x, MARKET.outfitter.y, t('outfitter'));
    for (const gear of OUTFITTER_GEAR) {
      const get = () => this.shop.outfitter[gear];
      this.addLevelMarker(MARKET.gear[gear], gear, get, 1, () => gearCost(this.id, gear), () => payGear(this.state, this.id, gear), (_lv, left) =>
        t('levelCost', { name: t(gear), level: gearLevel(this.state, gear) + 1, coins: formatNumber(left) }),
      );
    }
    this.sign(MARKET.study.x, MARKET.study.y, t('study'));
    const desk = fit(this.add.image(MARKET.desk.x, MARKET.desk.y, 'study'));
    desk.setDepth(MARKET.desk.y + desk.displayHeight / 2);
    this.addObstacle(MARKET.desk.x, MARKET.desk.y + 8, 60, 16);
    for (const lesson of LESSONS) {
      this.addLevelMarker(MARKET.lessons[lesson], 'research', () => this.shop.study[lesson], 1, () => lessonCost(this.id, lesson), () => payLesson(this.state, this.id, lesson), (_lv, left) =>
        t('learnCost', { potion: t(lesson), coins: formatNumber(left) }),
      );
    }
    const research = this.def.research;
    this.addLevelMarker(MARKET.recipe, 'research', () => this.shop.recipes, research.length, (lv) => recipeCost(this.id, lv), () => payRecipe(this.state, this.id), (lv, left) =>
      t('learnCost', { potion: goodName(research[lv]), coins: formatNumber(left) }),
    );
  }


  /** The guild under the first stations: a marker to join it, then its six upgrades. */
  private createGuild() {
    const l = guildLayout(this.id);
    const guild = () => this.shop.guild;
    this.sign(l.sign.x, l.sign.y, t('guild'));
    this.addLevelMarker(l.join, 'guild', () => guild().join, 1, () => guildJoinCost(this.id), () => payGuildJoin(this.state, this.id), (_lv, left) =>
      t('buildCost', { name: t('joinGuild'), coins: formatNumber(left) }),
    );
    for (const id of SHOP_GUILD) {
      const { max } = SHOP_GUILD_UPGRADES[id];
      // A one-off upgrade, like the herbalist, has no level to show.
      this.addLevelMarker(l.upgrade(id), id, () => guild()[id], max, (lv) => guildCost(this.id, id, lv), () => payGuildUpgrade(this.state, this.id, id), (lv, left) =>
        max === 1
          ? t('buildCost', { name: t(UPGRADES[id].name), coins: formatNumber(left) })
          : t('levelCost', { name: t(UPGRADES[id].name), level: lv + 2, coins: formatNumber(left) }),
        () => guild().join.level === 0,
      );
    }
  }

  /** A small tappable sign; a tap calls `tap` and doesn't walk the doctor. Shown while `shown` holds. */
  private addTapSign(at: Point, w: number, tap: () => Feedback | null, shown: () => boolean) {
    const card = townCard(this, at.x, at.y, 'small', w, 18).setDepth(-910);
    card.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      const feedback = tap();
      if (!feedback) return;
      ui('click');
      this.showFeedback(feedback);
    });
    this.views.push(() => card.setVisible(shown()));
    return card;
  }

  /** A station's "First:" sign: the good it makes first, or "any". */
  private addPrioritySign(at: Point, station: StationDef) {
    const shown = () => shopStudied(this.shop, 'craftOrder') && priorityChoices(station, (g) => shopMakes(this.shop, this.def, g)).length > 0;
    this.addTapSign(at, PRIORITY_SIGN_W, () => cycleShopPriority(this.state, this.id, station.id), shown);
    const style = { fontFamily: SERIF, fontSize: '12px', fontStyle: 'bold', color: INK };
    const left = at.x - PRIORITY_SIGN_W / 2 + 10;
    const caption = this.add.text(left, at.y, t('first'), style).setOrigin(0, 0.5).setDepth(-900);
    const choiceX = left + caption.width + 6;
    const any = this.add.text(choiceX, at.y, t('any'), style).setOrigin(0, 0.5).setDepth(-900);
    const icon = fit(this.add.image(choiceX + 8, at.y, goodTexture('wheat')), 1.2).setDepth(-900);
    this.views.push(() => {
      const first = this.shop.priority[station.id];
      caption.setVisible(shown());
      any.setVisible(shown() && !first);
      icon.setVisible(shown() && !!first);
      if (first) fit(icon.setTexture(goodTexture(first)), 1.2);
    });
  }

  /**
   * The first line's stations, and the second line's once bought: until then its sign and the
   * marker that buys it stand in the middle of its row.
   */
  private createLine2() {
    this.def.stations.forEach((s) => this.createStation(s));
    const l = line2Layout(this.id);
    const sign = this.sign(l.sign.x, l.sign.y, t('secondLine'));
    const bought = () => this.shop.line2.level > 0;
    this.addLevelMarker(l.buy, 'land', () => this.shop.line2, 1, () => line2Cost(this.id), () => payLine2(this.state, this.id), (_lv, left) =>
      t('buildCost', { name: t('secondLine'), coins: formatNumber(left) }),
    );
    let built = false;
    const build = () => {
      if (built || !bought()) return;
      built = true;
      for (const part of sign) part.setVisible(false);
      for (const s of shopStations(this.def)) if (isLine2(s.id)) this.createStation(s);
    };
    build();
    this.views.push(build);
  }

  private createStation(def: StationDef) {
    const i = this.def.stations.findIndex((s) => s.id === line1Id(def.id));
    const l = stationLayout(this.id, def.id);
    const image = fit(this.add.image(l.at.x, l.at.y, def.texture));
    image.setDepth(l.at.y + image.displayHeight / 2);
    this.addObstacle(l.at.x, l.at.y + image.displayHeight / 2 - 12, image.displayWidth - 8, 24);
    this.sign(l.label.x, l.label.y, t(def.name));
    if (priorityChoices(def).length > 0) this.addPrioritySign(l.priority, def);
    const station = () => this.shop.stations[def.id];
    this.addMarker(l.drop, 'pad-in', t('drop'), () => this.sounded(dropAtStation(this.state, this.id, def.id), 'drop'));
    this.addMarker(l.work, 'pad-work', t('work'), () => null, () => station().hired.level >= MAX_WORKERS);
    this.workSpots.push({ zone: new Phaser.Geom.Rectangle(l.work.x - 22, l.work.y - 22, 44, 44), at: def.id });
    this.addMarker(l.pickUp, pickUpPad('sack'), t('pickUp'), () => {
      const fine = inShopFineWindow(this.def, station());
      return this.sounded(pickUpFromStation(this.state, this.id, def.id), fine ? 'fine' : 'pickUp');
    });
    const icon: UpgradeIcon = i === 0 ? 'refiner' : 'cauldron';
    this.addLevelMarker(l.level, icon, () => station().level, MAX_LEVEL, (lv) => levelCost(this.id, lv), () => payStationLevel(this.state, this.id, def.id), (lv, left) =>
      t('stationLevelCost', { level: lv + 2, coins: formatNumber(left) }),
    );
    this.addLevelMarker(l.hire, 'hire', () => station().hired, MAX_WORKERS, (n) => workerCost(this.id, n), () => payWorker(this.state, this.id, def.id), (_n, left) =>
      t('hireCost', { coins: formatNumber(left) }),
    );
    const route = shopRoutes(this.def).find((r) => 'station' in r.from && r.from.station === def.id);
    if (route) this.addRouteMarker(l.route, route);
    // Its goods in and out, each an icon and how many there are.
    const ins = [...new Set(def.recipes.flatMap((r) => r.inputs))];
    const outs = [...new Set(def.recipes.map((r) => r.out))];
    ins.forEach((good, k) => this.addStock(l.stockIn(k), good, () => station().queue, () => shopMakes(this.shop, this.def, good)));
    outs.forEach((good, k) => this.addStock(l.stockOut(k), good, () => station().output, () => shopMakes(this.shop, this.def, good)));
    const bar = new ProgressBar(this, l.at.x, l.at.y - image.displayHeight / 2 - 12, 64, 0xc8741e, WORLD_UI_DEPTH, 8);
    // Its last quarter is gold where it makes what the shop sells: picked up then, the good comes out fine.
    if (def.recipes.some((r) => sellsGood(this.def, r.out))) bar.setZone(1 - FINE_SHARE, 0xe8b830);
    const workers = [0, 1].map((k) => {
      const at = l.workers(k);
      return fit(this.add.image(at.x, at.y, craftsmanTexture(k)).setOrigin(0.5, 1).setDepth(at.y));
    });
    this.views.push(() => {
      const s = station();
      bar.set(s.work ? s.work.progress / s.work.ms : null);
      workers.forEach((w, k) => w.setVisible(k < s.hired.level));
    });
  }

  /** A good standing by a station or on a shelf: its icon and how many there are, while `shown` holds. */
  private addStock(at: Point, good: GoodId, list: () => Held[], shown: () => boolean = () => true) {
    const icon = fit(this.add.image(at.x - 8, at.y, goodTexture(good)), 1.3).setDepth(at.y);
    const text = this.add.text(at.x + 4, at.y, '', COUNT).setOrigin(0, 0.5).setDepth(at.y);
    this.views.push(() => {
      const n = list().filter((g) => plainGood(g) === good).length;
      icon.setAlpha(n > 0 ? 1 : 0.4).setVisible(shown());
      text.setText(`${n}/${shopStorage(this.shop)}`).setVisible(shown());
    });
  }

  private createCounter() {
    const l = counterLayout(this.id);
    this.sign(l.sign.x, l.sign.y, t(this.def.name));
    for (const good of Object.keys(this.def.sells) as GoodId[]) {
      const at = l.shelf(good);
      // A shelf stands empty until the study teaches its good.
      const known = () => shopKnows(this.shop, this.def, good);
      fit(this.add.image(at.x, at.y, 'shelf')).setDepth(at.y);
      this.addStock({ x: at.x, y: at.y + 36 }, good, () => this.shop.shelf, known);
      const price = coined(this.add.text(at.x, at.y + 52, t('coinPrice', { n: this.def.sells[good]! }), { ...COUNT, fontSize: '11px' }).setOrigin(0.5, 0).setDepth(at.y));
      const icon = fit(this.add.image(at.x, at.y - 8, goodTexture(good)), 1.5).setDepth(at.y + 1);
      this.views.push(() => {
        // What the next one sells for: less once the shelf holds more than a few (the overstock cut).
        const full = shopPrice(this.shop, this.def, good), now = shopStockedPay(this.shop, good, full);
        price.setText(t('coinPrice', { n: formatNumber(now) })).setColor(now < full ? CUT_COLOUR : INK).setVisible(known());
        icon.setVisible(known());
      });
      // Its price sign: Cheap, Fair or Dear, once the study has taught them.
      const signAt = l.priceSign(good);
      const signed = () => known() && shopStudied(this.shop, 'priceSigns');
      this.addTapSign(signAt, PRICE_SIGN_W, () => cycleShopSign(this.state, this.id, good), signed);
      const sign = this.add.text(signAt.x, signAt.y, '', { fontFamily: SERIF, fontSize: '12px', fontStyle: 'bold', color: INK }).setOrigin(0.5).setDepth(-900);
      this.views.push(() => {
        const now = shopSignOf(this.shop, good);
        sign.setVisible(signed()).setText(t(SIGN_NAMES[now])).setColor(SIGN_COLOURS[now]);
      });
    }
    const counter = fit(this.add.image(l.counter.x, l.counter.y, 'counter'));
    counter.setDepth(l.counter.y + counter.displayHeight / 2);
    this.addObstacle(l.counter.x, l.counter.y + counter.displayHeight / 2 - 14, counter.displayWidth, 28);
    this.addMarker(l.drop, 'pad-in', t('drop'), () => this.sounded(stockShopShelf(this.state, this.id), 'drop'));
    this.addMarker(l.work, 'pad-work', t('work'), () => null, () => this.shop.counter.hired.level >= MAX_SHOPKEEPERS);
    this.workSpots.push({ zone: new Phaser.Geom.Rectangle(l.work.x - 22, l.work.y - 22, 44, 44), at: 'counter' });
    this.addMarker(l.till, pickUpPad('coin'), '', () => this.sounded(collectShopTill(this.state, this.id), 'cascade'));
    const till = coined(this.add.text(l.till.x, l.till.y + 26, '', { ...CAPTION }).setOrigin(0.5, 0).setDepth(-400));
    this.views.push(() => till.setText(t('coinPrice', { n: formatNumber(this.shop.till) })));
    const c = () => this.shop.counter;
    this.addLevelMarker(l.level, 'counter', () => c().level, MAX_LEVEL, (lv) => levelCost(this.id, lv), () => payCounterLevel(this.state, this.id), (lv, left) =>
      t('stationLevelCost', { level: lv + 2, coins: formatNumber(left) }),
    );
    this.addLevelMarker(l.hire, 'hire', () => c().hired, MAX_SHOPKEEPERS, (n) => workerCost(this.id, n), () => payShopkeeper(this.state, this.id), (_n, left) =>
      t('hireCost', { coins: formatNumber(left) }),
    );
    const keepers = [0, 1].map((k) => {
      const at = l.shopkeepers(k);
      return fit(this.add.image(at.x, at.y, craftsmanTexture(k + 1)).setOrigin(0.5, 1).setDepth(at.y));
    });
    this.views.push(() => keepers.forEach((keeper, k) => keeper.setVisible(k < c().hired.level)));
  }

  private addRouteMarker(at: Point, route: RouteDef, locked: () => boolean = () => false) {
    const built = () => this.shop.routes[route.id].built;
    const open = () => !built() && !locked();
    this.addMarker(
      at,
      upgradePad('pixies'),
      '',
      () => {
        const feedback = payRoute(this.state, this.id, route.id);
        if (built()) sfx('upgrade');
        else if (feedback) sfx('pay', { pitch: 1 + (0.6 * this.shop.routes[route.id].paid) / routeCost(this.id, route) });
        return feedback;
      },
      () => !open(),
    );
    this.markers[this.markers.length - 1].pays = true;
    const text = coined(this.add.text(at.x, at.y + 26, '', { ...CAPTION, color: CAPTION_PAY, wordWrap: { width: 92 } }).setOrigin(0.5, 0).setDepth(-400));
    this.views.push(() => {
      text.setVisible(open());
      text.setText(t('buildCost', { name: t('pixies'), coins: formatNumber(routeCost(this.id, route) - this.shop.routes[route.id].paid) }));
    });
  }

  /** The pixies on each route built, carrying one good each from its source to its target. */
  private createPixies() {
    const pool: { pixie: Phaser.GameObjects.Image; good: Phaser.GameObjects.Image }[] = [];
    const get = (i: number) => {
      while (pool.length <= i) {
        pool.push({
          pixie: fit(this.add.image(0, 0, PIXIE_FRAMES[0])).setDepth(PIXIE_DEPTH),
          good: fit(this.add.image(0, 0, goodTexture('wheat'))).setDepth(PIXIE_DEPTH + 1),
        });
      }
      return pool[i];
    };
    const paths = shopRoutes(this.def).map((r) => {
      const path = routePath(this.id, r);
      return { route: r, path, length: Math.hypot(path[1].x - path[0].x, path[1].y - path[0].y) };
    });
    this.views.push(() => {
      let n = 0;
      for (const { route, path, length } of paths) {
        const ms = (length / shopRouteSpeed(this.shop)) * 1000;
        for (const item of this.shop.routes[route.id].items) {
          const k = Math.min(1, item.at / ms);
          const x = path[0].x + (path[1].x - path[0].x) * k;
          // Wings beat and the pixie bobs as it flies; with reduced motion it glides.
          const bob = settings.reduceMotion ? 0 : Math.sin(this.time.now / 160 + n) * 2;
          const y = path[0].y + (path[1].y - path[0].y) * k - Math.sin(k * Math.PI) * 18 + bob;
          const { pixie, good } = get(n++);
          const beat = settings.reduceMotion ? 0 : Math.floor(this.time.now / 120 + n) % 2;
          pixie.setVisible(true).setPosition(x, y).setTexture(PIXIE_FRAMES[beat]).setFlipX(path[1].x < path[0].x);
          fit(pixie);
          good.setVisible(true).setPosition(x, y + 12).setTexture(goodTexture(item.good));
          fit(good);
        }
      }
      for (let i = n; i < pool.length; i++) {
        pool[i].pixie.setVisible(false);
        pool[i].good.setVisible(false);
      }
    });
  }

  /**
   * Customers walking up from the street to their place in front of the counter, each with a bubble
   * of what they want, a coin in a ring that shrinks as their tip decays with the tip it would pay
   * now above it, a star on a regular's, and their patience under their feet.
   */
  private createCustomers() {
    const l = counterLayout(this.id);
    type Shown = {
      body: Phaser.GameObjects.Image;
      bubble: Phaser.GameObjects.Image;
      icons: Phaser.GameObjects.Image[];
      ring: Phaser.GameObjects.Graphics;
      coin: Phaser.GameObjects.Image;
      star: Phaser.GameObjects.Image;
      tip: Phaser.GameObjects.Text;
      bar: ProgressBar;
      drawn: string;
    };
    const shown = new Map<number, Shown>();
    this.views.push(() => {
      const orders = this.shop.orders;
      for (const [id, c] of shown) {
        if (orders.some((o) => o.id === id)) continue;
        for (const part of [c.body, c.bubble, ...c.icons, c.ring, c.coin, c.star, c.tip]) part.destroy();
        c.bar.destroy();
        shown.delete(id);
      }
      for (const order of orders) {
        const to = l.place(order.spot);
        const cy = to.y - BUBBLE.above, top = cy - BUBBLE.h / 2;
        const ringX = to.x + BUBBLE.w / 2 - 2;
        let c = shown.get(order.id);
        if (!c) {
          const body = fit(this.add.image(0, 0, customerTexture(order.face)).setOrigin(0.5, 1));
          const bubble = townCard(this, to.x, cy, 'bubble', BUBBLE.w, BUBBLE.h).setDepth(WORLD_UI_DEPTH);
          const icons = [0, 1].map(() => fit(this.add.image(0, 0, goodTexture('bread')), 1.2).setDepth(WORLD_UI_DEPTH + 0.1));
          const ring = this.add.graphics().setDepth(WORLD_UI_DEPTH + 0.2);
          const coin = fit(this.add.image(ringX, top + 1, 'coin'), 0.8).setDepth(WORLD_UI_DEPTH + 0.3);
          const star = fit(this.add.image(to.x - BUBBLE.w / 2 + 2, top + 1, 'regular')).setDepth(WORLD_UI_DEPTH + 0.3);
          const tip = coined(this.add.text(to.x, top - 7, '', { fontFamily: SERIF, fontSize: '11px', fontStyle: 'bold', color: '#7a4a00', stroke: TEXT_HALO, strokeThickness: 3 }).setOrigin(0.5, 1).setDepth(WORLD_UI_DEPTH + 0.3));
          const bar = new ProgressBar(this, to.x, to.y + 6, 40, 0x5a9a4a, WORLD_UI_DEPTH, 6);
          c = { body, bubble, icons, ring, coin, star, tip, bar, drawn: '' };
          shown.set(order.id, c);
        }
        const from = l.street(order.spot);
        const k = 1 - order.walk / WALK_IN_MS;
        const x = from.x + (to.x - from.x) * k, y = from.y + (to.y - from.y) * k;
        c.body.setPosition(x, y).setDepth(y);
        const here = order.walk <= 0;
        for (const part of [c.bubble, c.ring, c.coin, c.tip]) part.setVisible(here);
        c.star.setVisible(here && !!order.regular);
        c.icons.forEach((icon, i) => {
          const want = order.wants[i];
          icon.setVisible(here && !!want);
          if (want) icon.setTexture(goodTexture(want)).setPosition(to.x + (i - (order.wants.length - 1) / 2) * 20, cy);
          fit(icon, 1.2);
        });
        c.bar.set(here ? order.patience / order.maxPatience : null);
        if (!here) continue;
        const left01 = tipLeft(order), tip = tipNow(order);
        // Just the coins, without the word: the places stand close and shops' tips run to four figures.
        c.tip.setText(tip > 0 ? `+${t('coinPrice', { n: formatNumber(tip) })}` : '').setColor(left01 < 0.4 ? '#b04a10' : '#7a4a00');
        // Redraw the ring only when it has visibly shrunk.
        const key = `${Math.round(left01 * 48)}`;
        if (key === c.drawn) continue;
        c.drawn = key;
        c.ring.clear();
        c.ring.fillStyle(0xe6dcc4, 1).fillCircle(ringX, top + 1, BUBBLE.ring + 2);
        c.ring.lineStyle(1, 0x2a1d14, 0.9).strokeCircle(ringX, top + 1, BUBBLE.ring + 2.5);
        c.ring.lineStyle(2.4, 0x2a1d14, 0.15).strokeCircle(ringX, top + 1, BUBBLE.ring);
        if (left01 > 0) {
          c.ring.lineStyle(2.4, left01 < 0.4 ? 0xe98a2e : 0xe8b830, 1);
          c.ring.beginPath();
          c.ring.arc(ringX, top + 1, BUBBLE.ring, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * left01, false);
          c.ring.strokePath();
        }
      }
    });
  }

  private addObstacle(x: number, y: number, w: number, h: number) {
    this.obstacles.add(this.add.zone(x, y, w, h));
    this.blockedAreas.push(new Phaser.Geom.Rectangle(x - w / 2 - 18, y - h / 2 - 10, w + 36, h + 20));
  }

  // Markers

  private addMarker(at: Point, texture: string, caption: string, act: () => Feedback | null, gone?: () => boolean) {
    const pad = fit(this.add.image(at.x, at.y, texture).setDepth(-400));
    const text = this.add.text(at.x, at.y + 26, caption, CAPTION).setOrigin(0.5, 0).setDepth(-400);
    const shown = () => !gone?.();
    this.markers.push({ zone: new Phaser.Geom.Rectangle(at.x - 22, at.y - 22, 44, 44), act, shown });
    if (gone) {
      this.views.push(() => {
        pad.setVisible(shown());
        text.setVisible(shown());
      });
    }
  }

  /** A purple marker for something bought a level at a time; standing still on it pays towards the next. */
  private addLevelMarker(
    at: Point,
    icon: UpgradeIcon,
    get: () => Upgrade,
    max: number,
    cost: (level: number) => number,
    pay: () => Feedback | null,
    caption: (level: number, left: number) => string,
    locked: () => boolean = () => false,
  ) {
    const open = () => get().level < max && !locked();
    this.addMarker(
      at,
      upgradePad(icon),
      '',
      () => {
        const level = get().level;
        const feedback = pay();
        if (get().level > level) {
          this.markers[marker].paused = true;
          sfx('upgrade');
        } else if (feedback) sfx('pay', { pitch: 1 + (0.6 * get().paid) / cost(level) });
        return feedback;
      },
      () => !open(),
    );
    const marker = this.markers.length - 1;
    this.markers[marker].pays = true;
    const text = coined(this.add.text(at.x, at.y + 26, '', { ...CAPTION, color: CAPTION_PAY, wordWrap: { width: 92 } }).setOrigin(0.5, 0).setDepth(-400));
    this.views.push(() => {
      const { level, paid } = get();
      text.setVisible(open());
      if (level < max) text.setText(caption(level, cost(level) - paid));
    });
  }

  private sounded(feedback: Feedback | null, name: Parameters<typeof sfx>[0]) {
    if (feedback) sfx(name);
    return feedback;
  }

  private standOnMarkers() {
    const feet = this.player.body!.center;
    const under = (m: Marker) => m.zone.contains(feet.x, feet.y);
    for (const m of this.markers) if (m.paused && !under(m)) m.paused = false;
    const marker = this.markers.find((m) => m.shown() && under(m));
    if (marker !== this.lastMarker) {
      this.lastMarker = marker;
      this.markerSince = this.time.now;
    }
    if (this.player.body!.velocity.lengthSq() > 0) this.stillSince = null;
    else this.stillSince ??= this.time.now;
    if (marker !== this.refused) this.refused = null;
    if (!marker || marker.paused || this.time.now < this.nextMarkerAt) return;
    if (marker.pays && (this.stillSince === null || this.time.now - this.stillSince < STILL_MS)) return;
    this.nextMarkerAt = this.time.now + MARKER_INTERVAL_MS;
    // The longer the doctor stays on a purple marker, the more each payment takes.
    if (marker.pays) payment.boost = payBoost(this.time.now - Math.max(this.stillSince!, this.markerSince) - STILL_MS);
    const feedback = marker.act();
    payment.boost = 1;
    if (feedback) this.showFeedback(feedback);
    else if (marker.pays && !this.refused) {
      this.refused = marker;
      ui('refuse');
    }
  }

  // The doctor

  private createPlayer() {
    const start = shopStart(this.id);
    this.player = fit(this.physics.add.sprite(start.x, start.y, 'doctor-idle'));
    const res = resOf('doctor-idle');
    this.player.body!.setSize(30 * res, 15 * res).setOffset(9 * res, 57 * res);
    this.player.setCollideWorldBounds(true);
    this.physics.add.collider(this.player, this.obstacles);
    this.sickle = fit(this.add.image(0, 0, 'sickle')).setVisible(false);
  }

  private createControls() {
    const keyboard = this.input.keyboard!;
    this.cursors = keyboard.createCursorKeys();
    this.wasd = { up: keyboard.addKey('W'), down: keyboard.addKey('S'), left: keyboard.addKey('A'), right: keyboard.addKey('D') };
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      // A second finger starts a pinch: stop walking instead of heading for it.
      if (this.input.pointer1.isDown && this.input.pointer2.isDown) {
        this.pointerTarget = null;
        this.waypoint = null;
        return;
      }
      if (viewPoint(p).y < TOWN_HUD_H) return;
      const at = this.cameras.main.getWorldPoint(p.x, p.y);
      this.pointerTarget = this.reachable(new Phaser.Math.Vector2(at.x, at.y));
      this.waypoint = this.routeAround(this.pointerTarget);
    });
  }

  private reachable(to: Phaser.Math.Vector2) {
    const { bounds } = this.physics.world;
    const { halfWidth, halfHeight } = this.player.body!;
    to.set(Phaser.Math.Clamp(to.x, bounds.left + halfWidth, bounds.right - halfWidth), Phaser.Math.Clamp(to.y, bounds.top + halfHeight, bounds.bottom - halfHeight));
    const hit = this.blockedAreas.find((a) => a.contains(to.x, to.y));
    if (hit) to.y = to.y < hit.centerY ? hit.top : Math.min(hit.bottom, bounds.bottom - halfHeight);
    return to;
  }

  /** A corner of the first station in the way to `to` (never the one the doctor stands on), or null when the way is clear. */
  private routeAround(to: Phaser.Math.Vector2): Phaser.Math.Vector2 | null {
    const feet = this.player.body!.center;
    const from = new Phaser.Math.Vector2(feet.x, feet.y);
    const line = new Phaser.Geom.Line(from.x, from.y, to.x, to.y);
    const inner = (a: Phaser.Geom.Rectangle) => new Phaser.Geom.Rectangle(a.x + 4, a.y + 4, a.width - 8, a.height - 8);
    const area = this.blockedAreas
      .filter((a) => !inner(a).contains(from.x, from.y) && Phaser.Geom.Intersects.LineToRectangle(line, inner(a)))
      .sort((a, b) => from.distance(new Phaser.Math.Vector2(a.centerX, a.centerY)) - from.distance(new Phaser.Math.Vector2(b.centerX, b.centerY)))[0];
    if (!area) return null;
    const { bounds } = this.physics.world;
    const corners = [
      new Phaser.Math.Vector2(area.left, area.top),
      new Phaser.Math.Vector2(area.right, area.top),
      new Phaser.Math.Vector2(area.left, area.bottom),
      new Phaser.Math.Vector2(area.right, area.bottom),
    ].filter((c) => from.distance(c) >= 5 && bounds.contains(c.x, c.y) && !Phaser.Geom.Intersects.LineToRectangle(new Phaser.Geom.Line(from.x, from.y, c.x, c.y), inner(area)));
    corners.sort((a, b) => from.distance(a) + a.distance(to) - (from.distance(b) + b.distance(to)));
    return corners[0] ?? null;
  }

  private movePlayer() {
    const dir = new Phaser.Math.Vector2(0, 0);
    if (this.cursors.left.isDown || this.wasd.left.isDown) dir.x -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dir.x += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) dir.y -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) dir.y += 1;
    const feet = this.player.body!.center;
    if (dir.lengthSq() > 0) {
      this.pointerTarget = null;
      this.waypoint = null;
    } else if (this.pointerTarget) {
      const target = this.waypoint ?? this.pointerTarget;
      dir.set(target.x - feet.x, target.y - feet.y);
      if (dir.length() < 5) {
        if (this.waypoint) {
          this.waypoint = this.routeAround(this.pointerTarget);
          const next = this.waypoint ?? this.pointerTarget;
          dir.set(next.x - feet.x, next.y - feet.y);
        } else {
          this.pointerTarget = null;
          dir.set(0, 0);
        }
      }
    }
    dir.normalize().scale(SPEED * walkSpeed(this.state));
    this.player.setVelocity(dir.x, dir.y);
    if (dir.x !== 0) this.player.setFlipX(dir.x < 0);
    if (dir.lengthSq() > 0) this.player.anims.play('doctor-walk', true);
    else {
      this.player.anims.stop();
      this.player.setTexture('doctor-idle');
    }
    this.player.setDepth(feet.y);
  }

  private limitWalkStep(_time: number, delta: number) {
    const body = this.player?.body;
    if (body && body.velocity.length() * (delta / 1000) > MAX_WALK_STEP_PX) body.velocity.setLength((MAX_WALK_STEP_PX * 1000) / delta);
  }

  private reach() {
    return this.player.displayHeight * harvestReach(this.state);
  }

  /**
   * Cuts the nearest bed in the sickle's reach, one at a time: a blighted one first, hands full or
   * not, then a ripe one while there is room to carry it. Returns whether one is in reach to cut.
   */
  private autoHarvest() {
    const centre = new Phaser.Math.Vector2(this.player.x, this.player.y);
    const reach = this.reach();
    const handsFull = this.state.town.hands.length >= carryCapacity(this.state);
    const near = this.shop.beds
      .map((_, b) => ({ b, d: centre.distance(new Phaser.Math.Vector2(bedPosition(this.id, b).x, bedPosition(this.id, b).y)), blighted: isBlightedBed(this.shop, b) }))
      .filter(({ b, d, blighted }) => d <= reach && (blighted || (!handsFull && isRipeBed(this.state, this.id, b))))
      .sort((a, b) => Number(b.blighted) - Number(a.blighted) || a.d - b.d);
    if (near.length === 0) return false;
    if (this.time.now >= this.nextHarvestAt) {
      this.nextHarvestAt = this.time.now + HARVEST_INTERVAL_MS;
      const [{ b, blighted }] = near;
      const feedback = blighted ? clearShopBlight(this.state, this.id, b) : harvestBed(this.state, this.id, b);
      if (feedback) {
        if (blighted) sfx('rasp');
        else {
          sfx('swish');
          sfx('pluck');
        }
        this.showFeedback(feedback);
      }
    }
    return true;
  }

  private spinSickle(harvesting: boolean, delta: number) {
    if (harvesting) this.lastHarvestingAt = this.time.now;
    const show = this.time.now - this.lastHarvestingAt < SICKLE_LINGER_MS;
    this.sickle.setVisible(show);
    if (!show) return;
    this.sickleAngle = (this.sickleAngle + delta * SICKLE_SPIN) % (Math.PI * 2);
    const orbit = this.reach();
    this.sickle
      .setPosition(this.player.x + Math.cos(this.sickleAngle) * orbit, this.player.y + Math.sin(this.sickleAngle) * orbit)
      .setRotation(this.sickleAngle + Math.PI / 2)
      .setDepth(this.sickle.y + 8);
  }

  // The screen

  private createHud() {
    const purse = townTopBar(this, () => this.state, t(this.def.name), { label: t('townMap'), onTap: () => leaveFor(this, this.state, 'Town') });
    this.views.push(purse);
    this.createContract();
    this.createTownCard();
    // The doctor's hands in this shop, at the bottom of the screen; tapping a slot throws its good away.
    const { width, height } = viewSize(this);
    const label = this.add.text(0, height - HANDS_BAR.h / 2 - 4, t('hands'), TOWN_TEXT).setOrigin(0, 0.5);
    const barW = label.width + 24 + MAX_CARRY * HANDS_BAR.gap;
    const barX = width / 2 - barW / 2, barY = height - HANDS_BAR.h / 2 - 4;
    const parts: Phaser.GameObjects.GameObject[] = [];
    parts.push(
      townCard(this, width / 2, barY, 'contract', barW, HANDS_BAR.h)
        .setAlpha(0.72)
        .setInteractive()
        .on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => e.stopPropagation()),
    );
    label.setX(barX + 12);
    parts.push(label);
    const frames: Phaser.GameObjects.Image[] = [];
    const icons: Phaser.GameObjects.Image[] = [];
    for (let i = 0; i < MAX_CARRY; i++) {
      const x = barX + label.width + 18 + HANDS_BAR.gap / 2 + i * HANDS_BAR.gap;
      const frame = fit(this.add.image(x, barY, 'slot'))
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
          e.stopPropagation();
          const feedback = tossGood(this.state, i);
          if (feedback) {
            sfx('toss');
            this.showFeedback(feedback);
          }
        });
      frames.push(frame);
      icons.push(fit(this.add.image(x, barY, goodTexture('wheat')), 1.5));
      parts.push(frame, icons[i]);
    }
    parts.forEach((part, i) => (part as unknown as Phaser.GameObjects.Image).setDepth(TOWN_UI_DEPTH + 0.1 + i * 0.001).setScrollFactor(0));
    this.views.push(() => {
      const hands = this.state.town.hands;
      frames.forEach((f, i) => f.setVisible(i < carryCapacity(this.state)));
      icons.forEach((icon, i) => {
        icon.setVisible(!!hands[i]);
        if (hands[i]) fit(icon.setTexture(goodTexture(hands[i])), 1.5);
      });
    });
  }

  /**
   * Today's contract, on a card under the top bar's purse: the good (and on a bundle day the second
   * one), how many are handed over of how many, and the reward. The text shrinks to fit the card.
   */
  private createContract() {
    const y = TOWN_HUD_H + 20;
    const card = townCard(this, 12 + CONTRACT_W / 2, y, 'contract', CONTRACT_W, 28).setAlpha(0.72);
    const icon = fit(this.add.image(28, y, goodTexture('bread')), 1.3);
    const icon2 = fit(this.add.image(46, y, goodTexture('bread')), 1.3);
    const text = coined(this.add.text(42, y, '', { ...TOWN_TEXT, fontSize: '13px' }).setOrigin(0, 0.5));
    for (const [i, part] of [card, icon, icon2, text].entries()) part.setDepth(TOWN_UI_DEPTH + i * 0.01).setScrollFactor(0);
    let kept = this.shop.kept;
    let drawn = '';
    this.views.push(() => {
      const c = this.shop.contract;
      for (const part of [card, icon, text]) part.setVisible(!!c);
      icon2.setVisible(!!c?.bundle);
      if (this.shop.kept > kept) playSting(SONG, 'kept');
      kept = this.shop.kept;
      if (!c) return;
      const b = c.bundle;
      let line: string;
      if (shopContractKept(c)) line = t('shopContractKept', { coins: formatNumber(c.reward) });
      else if (b) line = t('shopContractBundle', { item: goodName(c.good), made: c.made, need: c.need, item2: goodName(b.good), made2: b.made, need2: b.need, coins: formatNumber(c.reward) });
      else line = t('shopContract', { item: goodName(c.good), made: c.made, need: c.need, coins: formatNumber(c.reward) });
      if (line === drawn) return;
      drawn = line;
      fit(icon.setTexture(goodTexture(c.good)), 1.3);
      if (b) fit(icon2.setTexture(goodTexture(b.good)), 1.3);
      const x = b ? 60 : 42;
      text.setX(x).setText(line).setFontSize(13);
      for (let size = 13; size > 10 && text.width > CONTRACT_W + 4 - x; size--) text.setFontSize(size - 1);
    });
  }

  /**
   * The town card at the top right, as the apothecary's: today's weather and what it does, the
   * shop's reputation as a bar, and tomorrow's weather, or on a market day how its crowd is doing.
   * Below it, a note when the blight strikes or the crowd comes, is served or loses its bonus.
   */
  private createTownCard() {
    const { width } = viewSize(this);
    const { w, h } = TOWN_CARD;
    const x = width - 12 - w, y = TOWN_HUD_H + 8;
    const first = this.children.list.length;
    townCard(this, x + w / 2, y + h / 2, 'town', w, h).setAlpha(0.72);
    const icon = fit(this.add.image(x + 19, y + h / 2, 'weather-mild'));
    const title = this.add.text(x + 36, y + 13, '', { ...TOWN_TEXT, fontSize: '13px' }).setOrigin(0, 0.5);
    const label = this.add.text(x + 36, y + 31, t('reputation'), { ...TOWN_TEXT, fontSize: '12px', fontStyle: 'normal' }).setOrigin(0, 0.5);
    const barW = 60;
    const side = this.add.text(x + w - 10, y + 31, '', { ...TOWN_TEXT, fontSize: '12px' }).setOrigin(1, 0.5);
    const note = this.add.text(x + w / 2, y + h + 12, '', { ...TOWN_TEXT, fontSize: '13px', stroke: TEXT_HALO, strokeThickness: 4 }).setOrigin(0.5).setAlpha(0);
    const parts = this.children.list.slice(first) as (Phaser.GameObjects.Image & Phaser.GameObjects.Components.ScrollFactor)[];
    parts.forEach((part, i) => part.setDepth(TOWN_UI_DEPTH + i * 0.01).setScrollFactor(0));
    const reputation = new ProgressBar(this, label.x + label.width + 6 + barW / 2, y + 28, barW, 0x58a35a, TOWN_UI_DEPTH + 0.5).setScrollFactor(0);
    const say = (text: string, good: boolean) => {
      note.setText(text).setColor(good ? '#2f6a1a' : '#8a3a10').setAlpha(1);
      this.tweens.killTweensOf(note);
      this.tweens.add({ targets: note, alpha: 0, delay: 2_500, duration: 800 });
    };
    let rushSeen = JSON.stringify(this.shop.rush);
    let blightSeen = this.shop.blight.length;
    let drawn = '';
    this.views.push(() => {
      const { rush } = this.shop;
      const day = this.state.contract.day;
      if (this.shop.blight.length > blightSeen) say(t('blightInShop'), false);
      blightSeen = this.shop.blight.length;
      const rushNow = JSON.stringify(rush);
      if (rushNow !== rushSeen && rush) {
        const before = rushSeen === 'null' ? null : (JSON.parse(rushSeen) as typeof rush);
        const sameRush = before?.day === rush.day;
        if (rush.paid && !(sameRush && before.paid)) say(t('crowdBonus', { n: formatNumber(rush.bonus) }), true);
        else if (rush.lost && !(sameRush && before.lost)) say(t('crowdWalkedOff'), false);
        else if (!sameRush) say(t('crowdComes'), true);
      }
      rushSeen = rushNow;
      let status: string;
      if (!isMarketDay(day)) status = t('tomorrow', { weather: t(WEATHER[weatherFor(day + 1)].name) });
      else if (rush?.day !== day) status = t('crowdAtMidday');
      else if (rush.paid) status = t('crowdServed');
      else if (rush.lost) status = t('crowdLost');
      else status = t('crowdCount', { served: rush.served, size: rush.size });
      reputation.set(this.shop.reputation / 100);
      const key = `${day}:${status}`;
      if (key === drawn) return;
      drawn = key;
      fit(icon.setTexture(`weather-${weatherFor(day)}`));
      title.setText(t(isMarketDay(day) ? 'marketDayWeather' : 'dayWeather', { day, weather: t(WEATHER[weatherFor(day)].today) })).setFontSize(13);
      for (let size = 13; size > 10 && title.width > w - 46; size--) title.setFontSize(size - 1);
      side.setText(status);
    });
  }

  /**
   * Sounds of what the shop does on its own: a station done, a sale, an order filled or walked off,
   * the blight striking and a market crowd coming in; and the music, the rush's while a crowd waits.
   */
  private createSound() {
    let made = shopStations(this.def).map((s) => this.shop.stations[s.id].output.length);
    let sold = this.shop.sold;
    let orders = [...this.shop.orders];
    let blighted = this.shop.blight.length;
    let rushDay = this.shop.rush?.day;
    let rushing = false;
    this.views.push(() => {
      if (this.shop.blight.length > blighted) sfx('blight');
      blighted = this.shop.blight.length;
      if (this.shop.rush && this.shop.rush.day !== rushDay) sfx('rush');
      rushDay = this.shop.rush?.day;
      const crowd = this.shop.orders.some((o) => o.rush) || (this.shop.rush?.waiting ?? 0) > 0;
      if (crowd !== rushing) {
        rushing = crowd;
        if (crowd) playMusic(RUSH_SONG, 'rush');
        else playMusic(SONG, 'calm');
      }
      const now = shopStations(this.def).map((s) => this.shop.stations[s.id].output.length);
      if (now.some((n, i) => n > made[i])) sfx('bubble');
      made = now;
      const gone = orders.filter((o) => !this.shop.orders.includes(o));
      if (gone.some((o) => o.wants.length === 0)) sfx('served');
      else if (this.shop.sold > sold) sfx('sell');
      if (gone.some((o) => o.wants.length > 0)) sfx('hmph');
      orders = [...this.shop.orders];
      sold = this.shop.sold;
    });
  }

  private showFeedback(lines: Feedback) {
    const start = Math.max(this.time.now, this.nextFeedbackAt);
    lines.forEach((line, i) => {
      this.time.delayedCall(start - this.time.now + i * 180, () => {
        const text = coined(
          this.add
            .text(this.player.x, this.player.y - 60, line, { fontFamily: SERIF, fontSize: '14px', fontStyle: 'bold', color: INK, stroke: TEXT_HALO, strokeThickness: 4 })
            .setOrigin(0.5)
            .setDepth(WORLD_UI_DEPTH),
        );
        this.tweens.add({ targets: text, y: text.y - 36, alpha: 0, duration: 1100, onComplete: () => text.destroy() });
      });
    });
    this.nextFeedbackAt = start + lines.length * 180;
  }

  update(_time: number, delta: number) {
    if (!this.state.town.shops[this.id] || !this.player) return;
    this.frameMs = Math.min(delta, MAX_STEP_MS);
    const feet = this.player.body!.center;
    const at = this.workSpots.find((w) => w.zone.contains(feet.x, feet.y))?.at ?? null;
    tick(this.state, this.frameMs, null);
    tickTown(this.state, this.frameMs, { shop: this.id, at });
    this.movePlayer();
    this.standOnMarkers();
    this.spinSickle(this.autoHarvest(), delta);
    checkTrophies(this.state);
    for (const view of this.views) view();
  }
}
