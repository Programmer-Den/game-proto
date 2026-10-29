import { playMusic, playSting, ui } from '../../../../shared/audio';
import { formatNumber } from '../../../../shared/i18n';
import { settings } from '../../../../shared/settings';
import Phaser from 'phaser';
import { BEE_TEX, WASP_TEX } from '../art/bees';
import { SONG, sfx, type SoundName } from '../audio';
import { LIVE, SEASON_TINT } from '../art/palette';
import { CARD_PAD, FLOWER_TEX, JAR_TEX, meadowOrigin } from '../art/scenery';
import { CONTRACTS_FROM } from '../game/contracts';
import { MEAD_POINTS, classesFor, fairGold } from '../game/fair';
import { HONEY, KINDS, type Kind } from '../game/honey';
import { CASK_JARS, MAX_CASKS, MEAD_MULT } from '../game/mead';
import { MEADOWS } from '../game/meadows';
import { ORDERS_FROM } from '../game/orders';
import { clearProgress, loadProgress, saveProgress } from '../game/save';
import { acceptContract, build, buildBrood, buy, canPay, cask, caskKind, catchSwarm, enterFair, enterMead, forage, gatherAway, harvest, send, sell, swat, tick } from '../game/sim';
import {
  AWAY_CAP,
  BROOD_MS,
  FLOWERS,
  SLOTS,
  atHome,
  broodPrice,
  caskDone,
  cellPrice,
  combBonus,
  crowded,
  demand,
  fairIn,
  fairOn,
  fairScore,
  fairTotal,
  fairWon,
  freshProgress,
  hiveOf,
  isOpen,
  isWinter,
  jarCount,
  jarPrice,
  marketLeft,
  maxBees,
  meadReady,
  neighbours,
  newHive,
  openKinds,
  progressOf,
  ripenTime,
  room,
  season,
  seasonLeft,
  sharedEdges,
  shelfValue,
  withWax,
  type Bee,
  type GameState,
} from '../game/state';
import { CATCH_PRICE, QUEENS, QUEEN_IDS, SWARM_MS } from '../game/swarm';
import { TIRE_MS } from '../game/tired';
import { UPGRADES, nextPrice, type UpgradeId } from '../game/upgrades';
import { WASP_IN_MS, WASP_OUT_MS, WASP_STEAL_MS, type Wasp } from '../game/wasps';
import { t } from '../i18n';
import { checkTrophies } from '../trophies/check';
import { Button } from '../ui/Button';
import {
  AWAY,
  CASK,
  COMB,
  CONTRACT,
  END_CARD,
  ENTRANCE,
  FONT,
  GOAL,
  HINT,
  HIVE,
  HIVE_TAB,
  MARKET,
  MEADOW_SPOTS,
  MEADOW_TAG,
  ORDER,
  PLAQUE,
  SELL_BUTTON,
  SEND_BUTTON,
  SHELF,
  SHOP_BUTTONS,
  SWARM,
  UI_DEPTH,
  VIEW,
  viewEdges,
  WASP_FROM,
  WASP_TO,
  caskSpot,
  cellAt,
  cellCentre,
  forageSpot,
  flowerSpot,
  hexPoints,
  hiveTab,
  homeSpot,
  marketEntry,
  shopSpot,
} from './layout';

/** Longest simulated step, so a backgrounded tab doesn't jump the hive forward. */
const MAX_STEP_MS = 250;
/** The share of a trip spent flying out, and the share spent at the flower after it. */
const OUT = 0.4;
const AT_FLOWER = 0.2;
/** How often the hive is saved anyway, so its last-seen time stays fresh for the nectar gathered while away. */
const SAVE_EVERY_MS = 5000;
/** How long the "While you were away" chip stays up, in game time, before it fades. */
const AWAY_SHOW_MS = 12_000;

/** Bold system-font text; `stroke` gives it a dark cut-out edge for floating over the scenery. */
const textStyle = (size: number, color: string, weight = '800', stroke = false): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  fontStyle: weight,
  color,
  ...(stroke ? { stroke: '#3a2410', strokeThickness: 3 } : {}),
});

/** How often a wasp on the comb shown buzzes, in game time. */
const WASP_BUZZ_MS = 1500;

/** How close a tap must be to a wasp to swat it. */
const SWAT_RADIUS = 30;

/** The shop buttons in order: a brood cell, each upgrade and the mead cask; the village order and orchard contract cards take the last two spots. */
type ShopItem = 'brood' | 'cask' | UpgradeId;
const SHOP: ShopItem[] = ['brood', 'guards', 'baskets', 'clover', 'dance', 'cask'];

/** "1:05" for a time in milliseconds. */
const clockText = (ms: number) => {
  const sec = Math.ceil(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

/** The ends of the edge two neighbouring spots share. */
function sharedEdge(a: number, b: number) {
  const [A, B] = [cellCentre(a), cellCentre(b)];
  const [mx, my] = [(A.x + B.x) / 2, (A.y + B.y) / 2];
  const l = Math.hypot(B.x - A.x, B.y - A.y);
  const [px, py] = [-(B.y - A.y) / l, (B.x - A.x) / l];
  const h = COMB.r / 2;
  return [mx + px * h, my + py * h, mx - px * h, my - py * h] as const;
}

export class GameScene extends Phaser.Scene {
  /** The hive being played; read by the playthrough test. */
  state!: GameState;
  private bees = new Map<number, Phaser.GameObjects.Image>();
  private wasps = new Map<number, Phaser.GameObjects.Image>();
  /** Where each wasp was drawn this frame, for taps to swat it. */
  private waspAt = new Map<number, { x: number; y: number }>();
  /** The whole view in layout coordinates (see `viewEdges`). */
  private edges = { x: 0, y: 0, w: VIEW.w, h: VIEW.h, right: VIEW.w, bottom: VIEW.h };
  /** Whether the next tap on an empty spot places a brood cell (the Brood cell button arms it). */
  private placing = false;
  /** Whether the next tap on a capped cell enters its honey in the fair (the fair card arms it). */
  private entering = false;
  /** The hive whose comb is shown (0 or 1); the tabs on the roof switch it. */
  private hive = 0;
  private tabs: { root: Phaser.GameObjects.Container; card: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }[] = [];
  private seasonTint!: Phaser.GameObjects.Rectangle;
  private casks: { cask: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text }[] = [];
  private caskArcs!: Phaser.GameObjects.Graphics;
  private contract!: {
    card: Phaser.GameObjects.Image;
    title: Phaser.GameObjects.Text;
    detail: Phaser.GameObjects.Text;
  };
  private swarm!: { root: Phaser.GameObjects.Container; text: Phaser.GameObjects.Text; detail: Phaser.GameObjects.Text; bar: Phaser.GameObjects.Graphics };
  private endCard!: { root: Phaser.GameObjects.Container; detail: Phaser.GameObjects.Text };
  /** The card that asks which queen the caught swarm gets, over everything. */
  private queenCard!: { root: Phaser.GameObjects.Container; buttons: Button[] };
  private goalZone!: Phaser.GameObjects.Zone;
  private market!: {
    root: Phaser.GameObjects.Container;
    marks: Phaser.GameObjects.Graphics;
    next: Phaser.GameObjects.Text;
    entries: { icon: Phaser.GameObjects.Image; name: Phaser.GameObjects.Text; price: Phaser.GameObjects.Text; lock: Phaser.GameObjects.Image; bee: Phaser.GameObjects.Image }[];
  };
  private order!: {
    icon: Phaser.GameObjects.Image;
    title: Phaser.GameObjects.Text;
    detail: Phaser.GameObjects.Text;
    card: Phaser.GameObjects.Image;
  };
  private jars: Phaser.GameObjects.Image[] = [];
  private cells: Phaser.GameObjects.Image[] = [];
  private prices: Phaser.GameObjects.Text[] = [];
  private comb!: Phaser.GameObjects.Graphics;
  private trails!: Phaser.GameObjects.Graphics;
  private plaque!: Phaser.GameObjects.Text;
  private preview!: Phaser.GameObjects.Container;
  private previewText!: Phaser.GameObjects.Text;
  private previewLabel!: Phaser.GameObjects.Text;
  /** The empty spot the pointer is over, which shows the build preview. */
  private hover: number | null = null;
  private meadowStrips: Phaser.GameObjects.Image[] = [];
  private meadowBlooms: Phaser.GameObjects.Image[] = [];
  private meadowTag!: Phaser.GameObjects.Container;
  private meadowTagText!: Phaser.GameObjects.Text;
  private goal!: {
    icon: Phaser.GameObjects.Image;
    title: Phaser.GameObjects.Text;
    unlocks: Phaser.GameObjects.Text;
    count: Phaser.GameObjects.Text;
    blurb: Phaser.GameObjects.Text;
    lock: Phaser.GameObjects.Image;
    bar: Phaser.GameObjects.Graphics;
  };
  private away!: Phaser.GameObjects.Container;
  /** Game time left before the away chip fades; 0 once it is gone. */
  private awayLeft = 0;
  private sendButton!: Button;
  private sellButton!: Button;
  private shopButtons = new Map<ShopItem, Button>();
  private hud!: {
    coins: Phaser.GameObjects.Text;
    coinsLabel: Phaser.GameObjects.Text;
    honeyIcon: Phaser.GameObjects.Image;
    honey: Phaser.GameObjects.Text;
    honeyLabel: Phaser.GameObjects.Text;
    waxIcon: Phaser.GameObjects.Image;
    wax: Phaser.GameObjects.Text;
    waxLabel: Phaser.GameObjects.Text;
    stats: Phaser.GameObjects.Text;
  };
  private moreJars!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private clock = 0;
  /** The room the stats had when last fitted, so they only refit when it or their text changes. */
  private statsRoom = 0;
  private lastSave = 0;
  private lastFrame: number | null = null;
  /** True until the events of loading (the away nectar) are drained, which make no sound. */
  private hushed = true;
  /** The song's part playing now: the season's, or the fair's while it is on. */
  private musicPart = '';
  /** Game time until a wasp on the comb buzzes again. */
  private waspBuzz = 0;

  constructor() {
    super('Game');
  }

  /**
   * Where the controls are on screen, so the playthrough test can tap like a player: the Send and
   * Sell buttons, each comb cell (of the comb shown), each shop button (in `SHOP` order), each
   * market entry (by kind), each wasp now in the air (by id), the order and contract cards, the
   * swarm chip, the goal (or fair) card and the hive tabs.
   */
  spots() {
    return {
      send: { x: SEND_BUTTON.x, y: SEND_BUTTON.y },
      sell: { x: SELL_BUTTON.x, y: SELL_BUTTON.y },
      cells: [...Array(SLOTS).keys()].map(cellCentre),
      shop: Object.fromEntries(SHOP.map((item, i) => [item, shopSpot(i)])),
      market: Object.fromEntries(KINDS.map((k, i) => {
        const e = marketEntry(i);
        return [k, { x: e.x + e.w / 2, y: e.y + e.h / 2 }];
      })),
      wasps: Object.fromEntries(this.waspAt),
      order: { x: ORDER.x, y: ORDER.y },
      contract: { x: CONTRACT.x, y: CONTRACT.y },
      swarm: { x: SWARM.x + SWARM.w / 2, y: SWARM.y + SWARM.h / 2 },
      goal: { x: GOAL.x + GOAL.w / 2, y: GOAL.y + GOAL.h / 2 },
      tabs: [0, 1].map(hiveTab),
    };
  }

  create() {
    this.bees.clear();
    this.wasps.clear();
    this.waspAt.clear();
    this.placing = false;
    this.entering = false;
    this.hive = 0;
    this.tabs = [];
    this.casks = [];
    this.jars = [];
    this.cells = [];
    this.prices = [];
    this.meadowStrips = [];
    this.meadowBlooms = [];
    this.shopButtons.clear();
    this.hushed = true;
    this.musicPart = '';
    this.waspBuzz = 0;
    const progress = loadProgress();
    this.state = newHive(progress);

    // The game fills the screen's shape: the layout stays in VIEW, centred, and the scenery and the
    // HUD reach out to the view's edges.
    this.edges = viewEdges(this);
    this.cameras.main.setScroll(this.edges.x, this.edges.y);
    this.add.image(this.edges.x, this.edges.y, 'bg-back').setOrigin(0);
    MEADOWS.forEach((_, i) => {
      const o = meadowOrigin(i);
      this.meadowStrips.push(this.add.image(o.x, o.y, `meadow-${i}`).setOrigin(0).setDepth(0.01));
      this.meadowBlooms.push(this.add.image(o.x, o.y, `meadow-${i}-blooms`).setOrigin(0).setDepth(0.02));
    });
    this.add.image(this.edges.x, this.edges.y, 'bg-front').setOrigin(0).setDepth(0.05);
    for (let i = 0; i < FLOWERS; i++) {
      const f = flowerSpot(i);
      const tex = this.textures.getFrame(`flower-${i}`);
      this.add.image(f.x, f.y, `flower-${i}`).setOrigin(0.5, FLOWER_TEX.head / tex.realHeight).setDepth(0.1 + f.y / 10_000);
    }
    // The season lies over the scenery as a tint: the hive, the cards and the bees stay as they are.
    this.seasonTint = this.add.rectangle(this.edges.x, this.edges.y, this.edges.w, this.edges.h, 0xffffff, 0).setOrigin(0).setDepth(0.5);
    this.add.image(HIVE.x, HIVE.y, 'hive').setOrigin(0).setDepth(1);
    this.plaque = this.add.text(PLAQUE.x, PLAQUE.y, '', textStyle(11, '#7a4410')).setOrigin(0.5).setDepth(1.5);
    this.createTabs();
    for (let slot = 0; slot < SLOTS; slot++) {
      const c = cellCentre(slot);
      this.cells.push(this.add.image(c.x, c.y, 'cell-empty').setDepth(2));
      this.prices.push(this.add.text(c.x, c.y, '', textStyle(10.5, '#f6d6a0', '700')).setOrigin(0.5).setDepth(3));
    }
    this.comb = this.add.graphics().setDepth(2.5);
    this.previewText = this.add.text(0, 6, '', textStyle(12.5, '#ffffff', '900')).setOrigin(0.5);
    this.preview = this.add
      .container(0, 0, [
        this.add.image(0, 0, 'tag-build'),
        (this.previewLabel = this.add.text(0, -7, t('buildHere'), textStyle(9.5, '#cdeeb0', '600')).setOrigin(0.5)),
        this.previewText,
      ])
      .setDepth(4)
      .setVisible(false);

    for (let i = 0; i < SHELF.jars; i++) {
      this.jars.push(this.add.image(SHELF.x + i * SHELF.jarGap, SHELF.y, 'jar-clover').setOrigin(16 / JAR_TEX.w, JAR_TEX.footY / JAR_TEX.h).setVisible(false).setDepth(3));
    }
    this.moreJars = this.add.text(SHELF.x + SHELF.jars * SHELF.jarGap - 16, SHELF.y - 30, '', textStyle(14, '#ffd25a', '900', true)).setOrigin(1, 0.5).setDepth(4);
    this.createCasks();
    this.trails = this.add.graphics().setDepth(49);

    this.sendButton = new Button(this, SEND_BUTTON.x, SEND_BUTTON.y, SEND_BUTTON.w, SEND_BUTTON.h, () => this.act(send(this.state), 'send'));
    this.sellButton = new Button(this, SELL_BUTTON.x, SELL_BUTTON.y, SELL_BUTTON.w, SELL_BUTTON.h, () => this.act(sell(this.state)));
    SHOP.forEach((item, i) => {
      const at = shopSpot(i);
      const onClick = () =>
        item === 'brood' ? ((this.placing = !this.placing), ui('click')) : item === 'cask' ? this.act(cask(this.state)) : this.act(buy(this.state, item), 'buy');
      this.shopButtons.set(item, new Button(this, at.x, at.y, SHOP_BUTTONS.w, SHOP_BUTTONS.h, onClick));
    });
    this.createOrder();
    this.createContract();
    this.createMarket();
    this.createGoal();
    this.createAway();
    this.createSwarm();
    this.createHud();
    this.createReset();
    this.createEnd();
    this.createQueenCard();

    // Nectar the bees gathered while the page was closed, capped; save at once so a reload does not count it twice.
    const gained = progress.seen > 0 ? gatherAway(this.state, Date.now() - progress.seen) : 0;
    this.showAway(gained);
    this.save();
    this.playSeasonMusic();

    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => this.tapComb(p, over));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => (this.hover = cellAt(p.worldX, p.worldY)));
    this.input.on('gameout', () => (this.hover = null));
    const keep = () => this.save();
    const onHide = () => document.visibilityState === 'hidden' && keep();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', keep);
    this.events.once('shutdown', () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', keep);
    });
  }

  update(time: number) {
    // Game time from the frame's own timestamp rather than Phaser's smoothed delta, which holds
    // every step to 16ms while the page is not in focus.
    const dt = this.lastFrame === null ? 0 : Phaser.Math.Clamp(time - this.lastFrame, 0, MAX_STEP_MS);
    this.lastFrame = time;
    this.clock += dt;
    tick(this.state, dt);
    checkTrophies(this.state);
    // Nectar coming home and cells capping change the comb; keep it. Save now and then anyway,
    // so the last-seen time stays fresh.
    const changed = (e: GameState['events'][number]) => ['nectar', 'capped', 'hatched', 'stolen', 'season', 'ate', 'mead', 'swarmed', 'returned', 'wilted', 'fair-closed'].includes(e.kind);
    if (this.state.events.some(changed) || this.clock - this.lastSave >= SAVE_EVERY_MS) this.save();
    if (this.awayLeft > 0) {
      this.awayLeft = Math.max(0, this.awayLeft - dt);
      this.away.setAlpha(Math.min(1, this.awayLeft / 600));
      if (this.awayLeft === 0) this.away.setVisible(false);
    }

    this.playSeasonMusic();
    this.buzzWasps(dt);
    this.drawSeason();
    this.drawTabs();
    this.drawComb();
    this.drawBees();
    this.drawWasps();
    this.drawJars();
    this.drawCasks();
    this.drawMarket();
    this.drawOrder();
    this.drawContract();
    this.drawSwarm();
    this.drawQueenCard();
    this.drawEvents();
    this.drawGoal();
    this.drawHud();
    this.drawButtons();
  }

  /** After a player's action: saves and plays `sound` if it was done, else the refusal buzz. */
  private act(done: boolean, sound?: SoundName | 'click') {
    if (!done) return ui('refuse');
    this.save();
    if (sound === 'click') ui('click');
    else if (sound) sfx(sound);
  }

  /** The season's part of the song, or the fair's jig while the fair is on; switched at the next bar. */
  private playSeasonMusic() {
    const part = fairOn(this.state) ? 'fair' : season(this.state);
    if (part === this.musicPart) return;
    this.musicPart = part;
    playMusic(SONG, part);
  }

  /** A wasp sitting on the comb shown buzzes now and then. */
  private buzzWasps(dt: number) {
    if (!this.state.wasps.some((w) => w.phase === 'steal' && hiveOf(w.slot) === this.hive)) return (this.waspBuzz = 0);
    this.waspBuzz -= dt;
    if (this.waspBuzz > 0) return;
    this.waspBuzz = WASP_BUZZ_MS;
    sfx('wasp', { volume: 0.6 });
  }

  private save() {
    this.lastSave = this.clock;
    saveProgress(progressOf(this.state));
  }

  /**
   * A tap on a wasp swats it; a tap on the comb shown builds a cell on an empty spot (a brood cell
   * while the Brood cell button is armed) or harvests a capped one (enters it in the fair while
   * the fair card is armed).
   */
  private tapComb(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    // A tap on a card or button (the queen card's, say, which hides as it is tapped) is not for the comb.
    if (over.length > 0) return;
    for (const [id, at] of this.waspAt) {
      if (Math.hypot(p.worldX - at.x, p.worldY - at.y) <= SWAT_RADIUS && swat(this.state, id)) return;
    }
    const local = cellAt(p.worldX, p.worldY);
    if (local === null) return;
    const slot = this.hive * SLOTS + local;
    const cell = this.state.cells[slot];
    if (cell !== null) {
      if (!this.entering) return this.act(harvest(this.state, slot));
      if (!enterFair(this.state, slot)) return ui('refuse');
      this.entering = false;
      return this.save();
    }
    if (!this.placing) return this.act(build(this.state, slot));
    this.placing = false;
    this.act(buildBrood(this.state, slot));
  }

  private drawComb() {
    const s = this.state;
    const g = this.comb;
    g.clear();
    if (this.hive >= s.hives) this.hive = 0;
    const base = this.hive * SLOTS;
    const price = this.placing ? broodPrice(s, this.hive) : cellPrice(s, this.hive);
    const pay = withWax(s, price);
    const pulse = settings.reduceMotion ? 0.8 : 0.55 + 0.4 * Math.sin(this.clock / 150);
    const preview = this.hover !== null && s.cells[base + this.hover] === null ? base + this.hover : null;
    for (let local = 0; local < SLOTS; local++) {
      const slot = base + local;
      const cell = s.cells[slot];
      const image = this.cells[local];
      const label = this.prices[local];
      if (!cell) {
        const lit = slot === preview;
        image.setTexture(lit ? 'cell-preview' : 'cell-empty');
        label.setText(pay.coins === 0 && pay.wax === 0 ? t('free') : t('price', { n: pay.coins }));
        // setColor and setFontSize always redraw the text, so only set them when they change.
        const colour = lit ? '#1f4a18' : s.coins >= pay.coins ? (this.placing ? '#cdeeb0' : '#f6d6a0') : '#b08a62';
        if (label.style.color !== colour) label.setColor(colour);
        const size = lit ? '13px' : '10.5px';
        if (label.style.fontSize !== size) label.setFontSize(size).setFontStyle(lit ? '900' : '700');
        label.setAlpha(lit ? 1 : 0.8);
        continue;
      }
      label.setText('');
      const c = cellCentre(slot);
      if (cell.type === 'brood') {
        image.setTexture('cell-brood');
        // A green arc goes round as the next bee grows; it waits while the hive is full.
        if (s.bees.length < maxBees(s)) {
          const done = 1 - cell.hatchMs / BROOD_MS;
          g.lineStyle(3.5, LIVE.broodArc, 0.95).beginPath().arc(c.x, c.y, 15, -Math.PI / 2, -Math.PI / 2 + done * Math.PI * 2).strokePath();
        }
        continue;
      }
      const kind = cell.kind ?? 'clover';
      if (cell.phase === 'filling') image.setTexture(`cell-fill-${cell.nectar}-${kind}`);
      else if (cell.phase === 'ripening') {
        image.setTexture(`cell-ripe-${kind}`);
        // A cream arc goes round as the nectar ripens into honey.
        // Clamped: a cell that started ripening before the Heather Moor sped it up has more time left than `ripenTime` now.
        const done = Phaser.Math.Clamp(1 - cell.ripenMs / ripenTime(s), 0, 1);
        g.lineStyle(3.5, LIVE.ripenArc, 0.95).beginPath().arc(c.x, c.y, 12, -Math.PI / 2, -Math.PI / 2 + done * Math.PI * 2).strokePath();
      } else {
        image.setTexture(`cell-capped-${kind}`);
        // While the fair card is armed, each capped cell shows the points its honey would score.
        if (this.entering) {
          g.lineStyle(3, LIVE.fairPick, pulse).strokePoints(hexPoints(slot, 3), true);
          label.setText(t('points', { n: fairScore(s, slot) }));
          if (label.style.color !== '#1f4a18') label.setColor('#1f4a18');
          label.setAlpha(1);
        } else g.lineStyle(2, LIVE.cappedRim, pulse).strokePoints(hexPoints(slot, 3), true);
      }
    }

    // Every edge two built cells share glows gold: each one adds a coin to every jar sold.
    for (const [a, b] of sharedEdges(s)) if (hiveOf(a) === this.hive) this.glowLine(sharedEdge(a, b), LIVE.edgeGlow, LIVE.edge, LIVE.edgeCore);
    const queen = this.hive === 1 && s.queen ? t(QUEENS[s.queen].name) : null;
    this.plaque.setText(queen ? t('queenBonus', { queen, n: combBonus(s) }) : t('combBonus', { n: combBonus(s) }));

    // The build preview: the edges the new cell would share light up green.
    this.preview.setVisible(preview !== null);
    if (preview !== null) {
      const built = neighbours(preview).filter((n) => s.cells[n] !== null);
      for (const n of built) this.glowLine(sharedEdge(preview, n), LIVE.previewGlow, LIVE.preview, 0xf0ffe0);
      const c = cellCentre(preview);
      this.preview.setPosition(c.x, c.y + COMB.r + 12);
      this.previewText.setText(t('touching', { n: built.length }));
      const what = t(this.placing ? 'broodHere' : 'buildHere');
      this.previewLabel.setText(pay.wax > 0 ? t('withWax', { what, n: pay.wax }) : what);
    }

    // A wasp on a cell: an orange bar over it runs out as it steals the honey.
    for (const w of s.wasps) {
      if (w.phase !== 'steal' || hiveOf(w.slot) !== this.hive) continue;
      const c = cellCentre(w.slot);
      const [bx, by, bw, bh] = [c.x - 22, c.y - COMB.r - 2, 44, 6];
      g.fillStyle(LIVE.stealTrack, 0.85).fillRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 3);
      g.fillStyle(LIVE.stealBar, 1).fillRoundedRect(bx, by, Math.max(bh, bw * (1 - w.ms / WASP_STEAL_MS)), bh, 3);
    }
  }

  /** A strip of foil with a soft glow, along one shared edge. */
  private glowLine([x1, y1, x2, y2]: readonly number[], glow: number, foil: number, core: number) {
    const g = this.comb;
    for (const [w, colour, alpha] of [[10, glow, 0.16], [6.5, glow, 0.32], [3.5, foil, 0.95], [1.4, core, 1]] as const) {
      g.lineStyle(w, colour, alpha).lineBetween(x1, y1, x2, y2);
    }
  }

  /** Where a bee is `t` of the way through its trip (0 at the hive, 1 home again). */
  private tripSpot(bee: Bee, t: number, bob: number) {
    const flower = forageSpot(bee.kind, bee.flower);
    const ease = (u: number) => 0.5 - 0.5 * Math.cos(Math.PI * u);
    if (t < OUT) {
      const u = ease(t / OUT);
      return { x: ENTRANCE.x + (flower.x - ENTRANCE.x) * u, y: ENTRANCE.y + (flower.y - ENTRANCE.y) * u - 60 * Math.sin(Math.PI * u) + bob, left: false };
    }
    if (t < OUT + AT_FLOWER) {
      const a = settings.reduceMotion ? 0 : this.clock / 140 + bee.id;
      return { x: flower.x + 6 * Math.cos(a), y: flower.y + 3 * Math.sin(a), left: false };
    }
    const u = ease((t - OUT - AT_FLOWER) / (1 - OUT - AT_FLOWER));
    return { x: flower.x + (ENTRANCE.x - flower.x) * u, y: flower.y + (ENTRANCE.y - flower.y) * u - 60 * Math.sin(Math.PI * u) + bob, left: true };
  }

  private drawBees() {
    const here = new Set(this.state.bees.map((b) => b.id));
    for (const [id, sprite] of this.bees) {
      if (here.has(id)) continue;
      sprite.destroy();
      this.bees.delete(id);
    }
    this.trails.clear();
    const flap = settings.reduceMotion ? 0 : Math.floor(this.clock / 60) % 2;
    this.state.bees.forEach((bee, i) => {
      let sprite = this.bees.get(bee.id);
      if (!sprite) {
        sprite = this.add.image(0, 0, 'bee-0').setOrigin(BEE_TEX.cx / BEE_TEX.w, BEE_TEX.cy / BEE_TEX.h).setDepth(50);
        this.bees.set(bee.id, sprite);
      }
      // A bee lent to the orchard is away from the hive, out of sight.
      sprite.setVisible(!bee.lent);
      if (bee.tripMs === 0) {
        const h = homeSpot(i);
        sprite.setPosition(h.x, h.y).setFlipX(false).setTexture('bee-0');
        return;
      }
      const t = 1 - bee.tripMs / bee.trip;
      const bob = settings.reduceMotion ? 0 : Math.sin(this.clock / 90 + bee.id) * 3;
      const p = this.tripSpot(bee, t, bob);
      sprite.setPosition(p.x, p.y).setFlipX(p.left).setTexture(`bee-${flap}`);
      // A dotted trail of paper confetti behind a flying bee.
      const flying = t < OUT || t > OUT + AT_FLOWER;
      for (let k = 1; flying && k <= 6; k++) {
        const tk = t - k * 0.022;
        if (tk <= 0 || (tk > OUT && tk < OUT + AT_FLOWER) || (t > OUT && tk <= OUT + AT_FLOWER)) break;
        const q = this.tripSpot(bee, tk, 0);
        this.trails.fillStyle(LIVE.trail, 0.85 - k * 0.11).fillCircle(q.x + (p.left ? 14 : -14), q.y + 5, 1.6);
      }
    });
  }

  /** The jars on the shelf, kind by kind, coloured by their honey. */
  private drawJars() {
    const kinds = KINDS.flatMap((k) => Array<Kind>(Math.min(SHELF.jars, this.state.jars[k])).fill(k));
    this.jars.forEach((jar, i) => {
      jar.setVisible(i < kinds.length);
      if (i < kinds.length && jar.texture.key !== `jar-${kinds[i]}`) jar.setTexture(`jar-${kinds[i]}`);
    });
    const jars = jarCount(this.state);
    this.moreJars.setText(jars > SHELF.jars ? `+${formatNumber(jars - SHELF.jars)}` : '');
  }

  /** Where a wasp is: flying in from the right edge, sitting on its cell, or flying off again. */
  private waspSpot(w: Wasp) {
    const c = cellCentre(w.slot);
    const cell = { x: c.x, y: c.y - 6 };
    const along = (t: number) => {
      const u = 0.5 - 0.5 * Math.cos(Math.PI * t);
      const from = { x: WASP_FROM.x + this.edges.right - VIEW.w, y: WASP_FROM.y + (w.id % 3) * 30 };
      return { x: from.x + (cell.x - from.x) * u, y: from.y + (cell.y - from.y) * u - 50 * Math.sin(Math.PI * u) };
    };
    const still = settings.reduceMotion;
    if (w.phase === 'in') return { ...along(Math.min(1, w.ms / WASP_IN_MS)), left: true };
    if (w.phase === 'steal') {
      const a = this.clock / 70 + w.id;
      return { x: cell.x + (still ? 0 : 3 * Math.cos(a)), y: cell.y + (still ? 0 : 2 * Math.sin(a * 1.3)), left: true };
    }
    const from = along(w.turned);
    const u = Math.min(1, w.ms / WASP_OUT_MS);
    const to = WASP_TO.x + this.edges.right - VIEW.w;
    return { x: from.x + (to - from.x) * u, y: from.y + (WASP_TO.y - from.y) * u - 40 * Math.sin(Math.PI * u), left: false };
  }

  private drawWasps() {
    const here = new Set(this.state.wasps.map((w) => w.id));
    for (const [id, sprite] of this.wasps) {
      if (here.has(id)) continue;
      sprite.destroy();
      this.wasps.delete(id);
    }
    this.waspAt.clear();
    const flap = settings.reduceMotion ? 0 : Math.floor(this.clock / 45) % 2;
    for (const w of this.state.wasps) {
      let sprite = this.wasps.get(w.id);
      if (!sprite) {
        sprite = this.add.image(0, 0, 'wasp-0').setOrigin(WASP_TEX.cx / WASP_TEX.w, WASP_TEX.cy / WASP_TEX.h).setScale(1.15).setDepth(51);
        this.wasps.set(w.id, sprite);
      }
      const p = this.waspSpot(w);
      const shown = hiveOf(w.slot) === this.hive;
      sprite.setPosition(p.x, p.y).setFlipX(p.left).setTexture(`wasp-${flap}`).setVisible(shown);
      if (w.phase !== 'out' && shown) this.waspAt.set(w.id, { x: Math.round(p.x), y: Math.round(p.y) });
    }
  }

  /** Little flourishes for what just happened. */
  private drawEvents() {
    const events = this.state.events.splice(0);
    if (!this.hushed) this.playEvents(events);
    this.hushed = false;
    for (const e of events) {
      if (e.kind === 'built' || e.kind === 'capped') {
        const c = cellCentre(e.slot);
        if (!settings.reduceMotion) {
          const flash = this.add.circle(c.x, c.y, COMB.r, 0xfff6dc, 0.6).setDepth(4);
          this.tweens.add({ targets: flash, scale: 1.3, alpha: 0, duration: 350, onComplete: () => flash.destroy() });
        }
        if (e.kind === 'capped') this.float(c.x, c.y - 10, t('honey'), '#ffe08a', 14);
        if (e.kind === 'built' && e.touching > 0) this.touchingPop(c.x, c.y - COMB.r + 2, e.touching);
        if (e.kind === 'built' && e.wax > 0) this.float(c.x, c.y + 14, t('waxSpent', { n: e.wax }), '#fff0c0', 13);
      } else if (e.kind === 'harvested') {
        const c = cellCentre(e.slot);
        this.float(c.x, c.y, t('harvested'), '#ffd25a', 15);
      } else if (e.kind === 'hatched') {
        const c = cellCentre(e.slot);
        this.float(c.x, c.y - 10, t('newBee'), '#e4ffd0', 14);
      } else if (e.kind === 'demand') {
        if (this.state.sold > 0) this.float(MARKET.x + MARKET.w / 2, MARKET.y - 8, t('inDemand', { honey: t(`${e.honey}Honey`) }), '#ffffff', 14, 2000);
      } else if (e.kind === 'wasp') {
        // The comb the wasp is after comes to the front, so it can be swatted.
        const w = this.state.wasps.find((w) => w.id === e.id);
        if (w) this.hive = hiveOf(w.slot);
        this.float(HIVE.x + HIVE.w / 2, HIVE.y + 70, t(this.state.ranks.guards > 0 ? 'waspGuards' : 'waspTap'), '#ffe08a', 15, 2000);
      } else if (e.kind === 'stolen') {
        const c = cellCentre(e.slot);
        this.float(c.x, c.y - 10, t('stolen'), '#ffc890', 14, 1600);
      } else if (e.kind === 'swatted' || e.kind === 'guarded') {
        const w = this.state.wasps.find((w) => w.id === e.id);
        const at = w ? this.waspSpot(w) : { x: HIVE.x + HIVE.w / 2, y: HIVE.y + 70 };
        this.float(at.x, at.y - 18, t(e.kind === 'swatted' ? 'swat' : 'chasedOff'), '#ffffff', 14);
      } else if (e.kind === 'order') {
        this.float(ORDER.x, ORDER.y - 24, t('orderCame'), '#ffffff', 14, 1600);
      } else if (e.kind === 'order-done') {
        this.float(ORDER.x, ORDER.y - 24, t('orderDone', { n: e.premium }), '#ffd25a', 15, 2000);
      } else if (e.kind === 'order-failed') {
        this.float(ORDER.x, ORDER.y - 24, t('orderLapsed'), '#ffd0b0', 14, 1600);
      } else if (e.kind === 'spilled') {
        this.float(ENTRANCE.x, ENTRANCE.y - 30, t('spilled'), '#ffd0b0', 14);
      } else if (e.kind === 'season') {
        this.float(VIEW.w / 2, 140, t(`${e.season}Came`), '#ffffff', 17, 3000);
      } else if (e.kind === 'year') {
        this.float(VIEW.w / 2, 170, t('yearSurvived', { n: e.years }), '#ffd25a', 18, 3000);
      } else if (e.kind === 'ate') {
        if (e.what === 'jar') this.float(SHELF.x + 100, SHELF.y - 40, t('ateJar'), '#ffd0b0', 14, 1600);
        else if (e.what === 'cell' && e.slot !== null) {
          this.hive = hiveOf(e.slot);
          const c = cellCentre(e.slot);
          this.float(c.x, c.y - 10, t('ateCell'), '#ffc890', 14, 1600);
        } else this.float(ENTRANCE.x, ENTRANCE.y - 30, t('starved'), '#ffb0a0', 15, 2400);
      } else if (e.kind === 'casked') {
        this.float(CASK.x + CASK.gap, CASK.y - 40, t('casked', { jars: t(`${e.honey}Jars`, { n: CASK_JARS }) }), '#ffffff', 13, 1600);
      } else if (e.kind === 'mead') {
        const at = caskSpot(e.cask);
        this.float(at.x, at.y - 30, t('meadReady'), '#ffd25a', 14, 1600);
      } else if (e.kind === 'swarm-ready') {
        this.float(HIVE.x + HIVE.w / 2, HIVE.y + 70, t('swarmReady'), '#ffe08a', 15, 2400);
      } else if (e.kind === 'caught') {
        this.hive = 1;
        this.float(HIVE.x + HIVE.w / 2, HIVE.y + 70, t('caught'), '#ffffff', 15, 3000);
      } else if (e.kind === 'swarmed') {
        this.float(ENTRANCE.x, ENTRANCE.y - 30, t('swarmed', { n: e.lost }), '#ffb0a0', 15, 2400);
      } else if (e.kind === 'contract') {
        this.float(CONTRACT.x, CONTRACT.y - 22, t('contractCame'), '#ffffff', 14, 1600);
      } else if (e.kind === 'lent') {
        this.float(CONTRACT.x, CONTRACT.y - 22, t('lent', { n: e.bees, coins: e.coins }), '#ffd25a', 14, 2000);
      } else if (e.kind === 'returned') {
        this.float(ENTRANCE.x, ENTRANCE.y - 30, t('returned', { n: e.bees }), '#ffffff', 14, 1600);
      } else if (e.kind === 'contract-lapsed') {
        this.float(CONTRACT.x, CONTRACT.y - 22, t('contractLapsed'), '#ffd0b0', 13, 1600);
      } else if (e.kind === 'entered') {
        this.float(GOAL.x + GOAL.w / 2, GOAL.y + GOAL.h + 16, t('entered', { what: e.classes.map((k) => t(k)).reduce((a, b) => t('and', { a, b })), n: e.score }), '#ffffff', 14, 2000);
      } else if (e.kind === 'judged') {
        this.float(GOAL.x + GOAL.w / 2, GOAL.y + GOAL.h + 16, t('judged', { total: e.total, gold: e.gold }), '#ffd0b0', 14, 2600);
      } else if (e.kind === 'fair-open') {
        this.float(VIEW.w / 2, 170, t('fairOpen'), '#ffd25a', 17, 3000);
      } else if (e.kind === 'gold') {
        // The first gold shows the end card; later ones climb the ladder.
        if (e.golds > 1) this.float(GOAL.x + GOAL.w / 2, GOAL.y + GOAL.h + 16, t('goldAgain', { total: e.total, n: e.golds }), '#ffd25a', 15, 3000);
      } else if (e.kind === 'fair-closed') {
        const what = e.won ? t('fairWonOver') : e.total === null ? t('fairMissing') : t('fairLost', { total: e.total, gold: e.gold });
        this.float(VIEW.w / 2, 170, t('nextGold', { what, n: fairGold(this.state.fairs) }), e.won ? '#ffd25a' : '#ffd0b0', 15, 3200);
      } else if (e.kind === 'wilted') {
        this.float(MARKET.x + MARKET.w / 2, MARKET.y - 8, t('wilted', { meadow: t(`${e.honey}Meadow`) }), '#ffd0b0', 14, 2600);
      } else if (e.kind === 'baron') {
        this.showEnd();
      } else if (e.kind === 'sold') {
        this.float(SELL_BUTTON.x, SELL_BUTTON.y - 34, t('coinsGained', { n: e.coins }), '#ffd25a');
      } else if (e.kind === 'unlocked') {
        const m = MEADOWS[e.meadow];
        const tag = MEADOW_SPOTS[e.meadow].tag;
        const kind = KINDS.find((k) => HONEY[k].meadows === e.meadow + 1);
        const more = kind ? `\n${t('pickOnMarket', { honey: t(`${kind}Honey`) })}` : '';
        this.float(Math.min(tag.x, VIEW.w - 150), tag.y + 40, t('unlocked', { meadow: t(m.name), blurb: t(m.blurb) }) + more, '#ffffff', 16, 3200);
        if (!settings.reduceMotion) {
          const blooms = this.meadowBlooms[e.meadow];
          blooms.setAlpha(0);
          this.tweens.add({ targets: blooms, alpha: 1, duration: 900 });
        }
      }
    }
  }

  /**
   * The sounds for what just happened: one per kind of event a frame (the sound table's gaps thin
   * out the rest), and nothing for cells on the comb not shown.
   */
  private playEvents(events: GameState['events']) {
    const shown = (slot: number | null) => slot === null || hiveOf(slot) === this.hive;
    // The fair's gold, the Baron and the season's turn come with their own music.
    const baron = events.some((e) => e.kind === 'baron');
    for (const e of events) {
      switch (e.kind) {
        case 'built':
          sfx('build', { pitch: 2 ** ((2 * e.touching) / 12) });
          break;
        case 'nectar':
          if (shown(e.slot)) sfx('nectar');
          break;
        case 'capped':
          if (shown(e.slot)) sfx('capped');
          break;
        case 'harvested':
          sfx('harvest');
          break;
        case 'sold':
          sfx('sell');
          break;
        case 'order-done':
          sfx('orderDone');
          break;
        case 'spilled':
        case 'order-failed':
        case 'contract-lapsed':
        case 'judged':
          sfx('sad');
          break;
        case 'stolen':
          if (shown(e.slot)) sfx('sad');
          break;
        case 'ate':
          if (e.what === 'bee') sfx('starve');
          else if (e.what === 'jar' || shown(e.slot)) sfx('sad');
          break;
        case 'wasp':
          this.waspBuzz = WASP_BUZZ_MS;
          sfx('wasp');
          break;
        case 'swatted':
          sfx('swat');
          break;
        case 'guarded':
          sfx('zap');
          break;
        case 'hatched':
          if (shown(e.slot)) sfx('hatched');
          break;
        case 'unlocked':
          playSting(SONG, 'unlock');
          break;
        case 'demand':
          if (this.state.sold > 0) sfx('demand');
          break;
        case 'wilted':
          sfx('wilted');
          break;
        case 'order':
        case 'contract':
          sfx('ding');
          break;
        case 'season':
          sfx('season');
          break;
        case 'year':
          sfx('year');
          break;
        case 'casked':
          sfx('casked');
          break;
        case 'mead':
          sfx('mead');
          break;
        case 'swarm-ready':
          sfx('swarmReady');
          break;
        case 'swarmed':
          sfx('swarmed');
          break;
        case 'caught':
          sfx('caught');
          break;
        case 'lent':
          ui('coin');
          break;
        case 'returned':
          sfx('returned');
          break;
        case 'fair-open':
          sfx('fairOpen');
          break;
        case 'entered':
          sfx('stamp');
          break;
        case 'gold':
          if (!baron) playSting(SONG, 'gold');
          break;
        case 'baron':
          playSting(SONG, 'baron');
          break;
        case 'fair-closed':
          // Autumn comes in the same step, and its chime closes the fair.
          break;
      }
    }
  }

  /** The green "+N touching" tag over a cell just built next to others. */
  private touchingPop(x: number, y: number, n: number) {
    const pop = this.add
      .container(x, y, [this.add.image(0, 0, 'tag-touching'), this.add.text(0, 0, t('touching', { n }), textStyle(11, '#ffffff', '800')).setOrigin(0.5)])
      .setDepth(UI_DEPTH + 2);
    this.tweens.add({
      targets: pop,
      y: settings.reduceMotion ? y : y - 18,
      alpha: { from: 1, to: 0 },
      delay: 700,
      duration: 900,
      onComplete: () => pop.destroy(),
    });
  }

  private float(x: number, y: number, message: string, color: string, size = 18, duration = 1200) {
    const text = this.add.text(x, y, message, { ...textStyle(size, color, '900', true), align: 'center' }).setOrigin(0.5).setDepth(UI_DEPTH + 2);
    this.tweens.add({ targets: text, y: settings.reduceMotion ? y : y - 40, alpha: 0, duration, onComplete: () => text.destroy() });
  }

  private drawButtons() {
    const s = this.state;
    const home = s.bees.filter(atHome).length;
    const built = s.cells.some((c) => c !== null);
    // Once a second kind is open, the Send button says which nectar the bees go for.
    const nectar = openKinds(s).length > 1 ? t(`${s.forage}Nectar`) : null;
    const sendCaption = isWinter(s)
      ? t('winterHome')
      : s.ranks.dance > 0
        ? nectar ? t('forageAloneFor', { nectar }) : t('forageOwn')
        : !built
          ? t('buildFirst')
          : room(s) === 0
            ? nectar ? t('noRoomFor', { nectar }) : t('combFull')
            : home === 0
              ? t('foragersOut')
              : nectar ? t('sendFor', { n: home, nectar }) : t('send', { n: home });
    const canSend = s.ranks.dance === 0 && home > 0 && room(s) > 0 && !isWinter(s);
    this.sendButton.set(sendCaption, canSend, true);
    const jars = jarCount(s);
    const mead = meadReady(s).length;
    const what = [jars > 0 ? t('jars', { n: jars }) : '', mead > 0 ? t('meads', { n: mead }) : ''].filter(Boolean).join(' + ');
    this.sellButton.set(jars + mead === 0 ? t('noHoney') : t('sellWhat', { what, coins: shelfValue(s) }), jars + mead > 0, true);
    const free = s.cells.some((c) => c === null);
    const freeHere = s.cells.some((c, i) => c === null && hiveOf(i) === this.hive);
    if (this.placing && (!freeHere || !canPay(s, broodPrice(s, this.hive)))) this.placing = false;
    if (this.entering && (!fairOn(s) || fairWon(s))) this.entering = false;
    for (const item of SHOP) {
      const button = this.shopButtons.get(item)!;
      if (item === 'brood') {
        const pay = withWax(s, broodPrice(s, this.hive));
        const caption = this.placing
          ? t('broodCancel')
          : !free
            ? t('broodNoSpot')
            : !freeHere
              ? t('broodCombFull')
              : t('brood', { price: t('price', { n: pay.coins }), what: t(s.bees.length >= maxBees(s) ? 'beesFull' : 'hatches') });
        button.set(caption, freeHere && canPay(s, broodPrice(s, this.hive)), this.placing);
        continue;
      }
      if (item === 'cask') {
        const kind = caskKind(s);
        const caption = s.casks.length >= MAX_CASKS
          ? t('cellarFull')
          : kind
            ? t('caskJars', { jars: t(`${kind}Jars`, { n: CASK_JARS }), mult: MEAD_MULT[kind] })
            : t('caskNeeds', { n: CASK_JARS });
        button.set(caption, kind !== null);
        continue;
      }
      const u = UPGRADES[item];
      const rank = s.ranks[item];
      const price = nextPrice(item, rank);
      const name = u.prices.length > 1 ? t('rank', { name: t(u.name), n: rank + 1 }) : t(u.name);
      const caption = price === null ? t('maxed', { name: t(u.name), blurb: t(u.blurb) }) : t('upgrade', { name, price: t('price', { n: price }), blurb: t(u.blurb) });
      button.set(caption, price !== null && s.coins >= price);
    }
  }

  /** The market board under the hive: each kind's price now, the one in demand, and where the bees forage (tap to choose). */
  private createMarket() {
    const parts: Phaser.GameObjects.GameObject[] = [this.add.image(-CARD_PAD, -CARD_PAD, 'market-card').setOrigin(0)];
    const marks = this.add.graphics();
    parts.push(marks);
    parts.push(this.add.text(10, 12, t('market'), textStyle(13, '#4a2c10', '900')).setOrigin(0, 0.5));
    const next = this.add.text(10, 27, '', textStyle(10, '#8a6a40', '700')).setOrigin(0, 0.5);
    parts.push(next);
    const entries = KINDS.map((kind, i) => {
      const e = marketEntry(i);
      const x = e.x - MARKET.x;
      const entry = {
        icon: this.add.image(x + 13, 19, `honey-icon-${kind}`),
        name: this.add.text(x + 25, 12, t(HONEY[kind].name), textStyle(11.5, '#4a2c10', '800')).setOrigin(0, 0.5),
        price: this.add.text(x + 25, 27, '', textStyle(11, '#6a4a28', '800')).setOrigin(0, 0.5),
        lock: this.add.image(x + e.w - 12, 26, 'lock').setScale(0.7),
        bee: this.add.image(x + e.w - 14, 26, 'bee-0').setScale(0.5),
      };
      const zone = this.add.zone(x, 0, e.w, e.h).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.state.forage !== kind && this.act(forage(this.state, kind), 'click'));
      parts.push(entry.icon, entry.name, entry.price, entry.lock, entry.bee, zone);
      return entry;
    });
    const root = this.add.container(MARKET.x, MARKET.y, parts).setDepth(UI_DEPTH - 2).setVisible(false);
    this.market = { root, marks, next, entries };
  }

  private drawMarket() {
    const s = this.state;
    const m = this.market;
    // It takes the hint's place once the first jar is sold.
    m.root.setVisible(s.sold > 0);
    if (s.sold === 0) return;
    const wanted = demand(s);
    m.next.setText(wanted ? t('nextIn', { time: clockText(marketLeft(s)) }) : t('oneKind'));
    m.marks.clear();
    KINDS.forEach((kind, i) => {
      const e = marketEntry(i);
      const x = e.x - MARKET.x;
      const entry = m.entries[i];
      const open = isOpen(s, kind);
      const picked = s.forage === kind;
      m.marks.lineStyle(1, LIVE.marketLine, 0.8).lineBetween(x - 1, 6, x - 1, MARKET.h - 6);
      if (picked) m.marks.fillStyle(LIVE.marketPick, 0.9).fillRoundedRect(x + 2, 4, e.w - 4, MARKET.h - 8, 7);
      entry.icon.setAlpha(open ? 1 : 0.4);
      entry.name.setAlpha(open ? 1 : 0.5);
      entry.lock.setVisible(!open);
      entry.bee.setVisible(picked);
      // A strip under the price fills as the meadow tires; once wilted it says so.
      const strain = s.tired[kind] / TIRE_MS;
      if (open && openKinds(s).length > 1 && strain > 0) {
        m.marks.fillStyle(LIVE.tiredTrack, 0.9).fillRoundedRect(x + 25, MARKET.h - 6, e.w - 32, 3, 1.5);
        m.marks.fillStyle(LIVE.tired, 1).fillRoundedRect(x + 25, MARKET.h - 6, Math.max(3, (e.w - 32) * strain), 3, 1.5);
      }
      let price = t('price', { n: jarPrice(s, kind) });
      if (wanted === kind) price = t('starred', { price });
      if (s.wilted[kind]) price = t('wiltedTag', { price });
      if (!open) price = s.meadows >= HONEY[kind].meadows ? t('shutAutumn') : t('soldNeed', { n: MEADOWS[HONEY[kind].meadows - 1].need });
      entry.price.setText(price).setAlpha(open ? 1 : 0.6);
      const colour = open && s.wilted[kind] ? '#a0522d' : wanted === kind ? '#2f7a24' : '#6a4a28';
      if (entry.price.style.color !== colour) entry.price.setColor(colour);
    });
  }

  /** The village order card in the shop's seventh spot: what the village wants, how many are sold and the time left. */
  private createOrder() {
    this.order = {
      card: this.add.image(ORDER.x, ORDER.y, 'order-card').setDepth(30),
      icon: this.add.image(ORDER.x - ORDER.w / 2 + 18, ORDER.y + 1, 'honey-icon-clover').setDepth(31),
      title: this.add.text(ORDER.x - ORDER.w / 2 + 32, ORDER.y - 7, '', textStyle(13, '#4a2c10', '900')).setOrigin(0, 0.5).setDepth(31),
      detail: this.add.text(ORDER.x - ORDER.w / 2 + 32, ORDER.y + 9, '', textStyle(10.5, '#6a4a28', '700')).setOrigin(0, 0.5).setDepth(31),
    };
  }

  private drawOrder() {
    const s = this.state;
    const o = this.order;
    const order = s.order;
    o.icon.setVisible(order !== null);
    o.card.setAlpha(s.sold < ORDERS_FROM ? 0.75 : 1);
    if (order) {
      o.icon.setTexture(`honey-icon-${order.kind}`);
      o.title.setText(t('orderFor', { n: order.count, kind: t(HONEY[order.kind].name) }));
      o.detail.setText(t('orderLeft', { done: order.done, n: order.count, time: clockText(order.leftMs), premium: order.premium }));
    } else if (s.sold < ORDERS_FROM) {
      o.title.setText(t('villageOrders'));
      o.detail.setText(t('fromSold', { n: ORDERS_FROM }));
    } else {
      o.title.setText(t('villageOrders'));
      o.detail.setText(t('nextOrder'));
    }
    o.title.setX(ORDER.x - ORDER.w / 2 + (order ? 32 : 14));
    o.detail.setX(o.title.x);
  }

  /** The goal card (next meadow, its goal and a progress bar) and the tag on the meadow it unlocks. */
  private createGoal() {
    const x = GOAL.x;
    const y = GOAL.y;
    this.add.image(x - CARD_PAD, y - CARD_PAD, 'goal-card').setOrigin(0).setDepth(20);
    this.goal = {
      icon: this.add.image(x + 6, y + 8 - CARD_PAD, 'meadow-icon-0').setOrigin(0).setDepth(21),
      title: this.add.text(x + 38, y + 16, '', textStyle(15, '#4a2c10', '900')).setOrigin(0, 0.5).setDepth(21),
      unlocks: this.add.text(0, y + 17, '', textStyle(12, '#6a4aa8', '700')).setOrigin(0, 0.5).setDepth(21),
      bar: this.add.graphics().setDepth(21),
      count: this.add.text(x + 216, y + 36, '', textStyle(11.5, '#4a2c10', '800')).setOrigin(0, 0.5).setDepth(21),
      blurb: this.add.text(x + 270, y + 36, '', textStyle(10.5, '#6a4aa8', '700')).setOrigin(0, 0.5).setDepth(21),
      lock: this.add.image(x + GOAL.w - 22, y + GOAL.h / 2, 'lock').setDepth(21),
    };
    // Once every meadow is open the card is the fair's: a tap arms entering a capped cell's honey.
    this.goalZone = this.add.zone(x, y, GOAL.w, GOAL.h).setOrigin(0).setDepth(21);
    this.goalZone.on('pointerdown', () => {
      if (!fairOn(this.state) || fairWon(this.state)) return;
      this.entering = !this.entering;
      ui('click');
    });
    this.meadowTagText = this.add.text(-MEADOW_TAG.w / 2 + 26, 0, '', textStyle(11.5, '#f1e8ff', '800')).setOrigin(0, 0.5);
    this.meadowTag = this.add
      .container(0, 0, [this.add.image(0, 0, 'meadow-tag'), this.add.image(-MEADOW_TAG.w / 2 + 13, -1, 'lock').setScale(0.8), this.meadowTagText])
      .setDepth(20);
  }

  private drawGoal() {
    const s = this.state;
    const next = MEADOWS[s.meadows];
    const done = !next;
    const g = this.goal;
    g.icon.setTexture(`meadow-icon-${Math.min(s.meadows, MEADOWS.length - 1)}`);
    g.lock.setVisible(!done);
    const [bx, by, bw, bh] = [GOAL.x + 38, GOAL.y + 31, 170, 10];
    g.bar.clear();
    if (done) {
      // The county honey fair, at the end of every summer: the best entry of each class, and a tap to enter the next.
      const total = fairTotal(s);
      const gold = fairGold(s.fairs);
      const classes = classesFor(s.fairs);
      const on = fairOn(s);
      const won = fairWon(s);
      const entries = classes.map((k) => `${t(k)} ${s.fair[k] ?? '–'}`).join(' · ');
      const golds = s.golds > 0 ? ` · ${t('goldCount', { n: s.golds })}` : '';
      g.title.setText(
        this.entering ? t(classes.includes('mead') ? 'tapCellOrCask' : 'tapCell') : won ? t('goldAtFair', { n: s.fairs + 1 }) : t('countyFair', { n: s.fairs + 1 }),
      );
      g.unlocks
        .setText(this.entering ? '' : won ? t('pointsTotal', { n: total ?? 0 }) : on ? t('fairLeft', { time: clockText(seasonLeft(s)), gold }) : t('lateSummer', { time: clockText(fairIn(s)) }))
        .setX(g.title.x + g.title.width + 10);
      g.count.setText('').setX(GOAL.x + 38);
      g.blurb
        .setText(on ? `${entries}${won ? golds : ` · ${t('tapToEnter')}`}` : `${t('goldAt', { gold })} · ${classes.map((k) => t(k)).join(', ')}${golds}`)
        .setX(GOAL.x + 38);
      if (this.entering) g.bar.lineStyle(2.5, LIVE.fairPick, 0.9).strokeRoundedRect(GOAL.x + 2, GOAL.y + 2, GOAL.w - 4, GOAL.h - 4, 8);
      if (!this.goalZone.input) this.goalZone.setInteractive({ useHandCursor: true });
      if (this.goalZone.input) this.goalZone.input.cursor = on && !won ? 'pointer' : 'default';
    } else {
      g.title.setText(t('goalSold', { n: next.need }));
      g.unlocks.setText(t('unlocks', { meadow: t(next.name) })).setX(g.title.x + g.title.width + 10);
      g.count.setText(`${formatNumber(Math.min(s.sold, next.need))} / ${formatNumber(next.need)}`).setX(GOAL.x + 216);
      g.blurb.setText(t(next.blurb)).setX(GOAL.x + 270);
      const from = s.meadows === 0 ? 0 : MEADOWS[s.meadows - 1].need;
      const share = Phaser.Math.Clamp((s.sold - from) / (next.need - from), 0, 1);
      g.bar.fillStyle(LIVE.barTrack).fillRoundedRect(bx, by, bw, bh, 5);
      if (share > 0) g.bar.fillStyle(LIVE.bar).fillRoundedRect(bx, by, Math.max(bh, bw * share), bh, 5);
    }

    MEADOWS.forEach((_, i) => {
      // Open meadows in full colour, the next one faded behind its lock, later ones not shown yet.
      this.meadowStrips[i].setVisible(i <= s.meadows).setAlpha(i < s.meadows ? 1 : 0.7);
      this.meadowBlooms[i].setVisible(i < s.meadows);
    });
    this.meadowTag.setVisible(!done);
    if (!done) {
      const tag = MEADOW_SPOTS[s.meadows].tag;
      this.meadowTag.setPosition(tag.x, tag.y);
      this.meadowTagText.setText(t(next.name));
    }
  }

  /** The "While you were away" chip under the hive, hidden until there is nectar to report. */
  private createAway() {
    const x = AWAY.x;
    const y = AWAY.y;
    const parts = [
      this.add.image(-CARD_PAD, -CARD_PAD, 'away-chip').setOrigin(0),
      this.add.text(40, 19, t('awayWhile'), textStyle(12.5, '#d8e6f4', '600')).setOrigin(0, 0.5),
      this.add.text(0, 19, '', textStyle(15, '#ffd25a', '900')).setOrigin(0, 0.5).setName('gained'),
      this.add.text(305, 11, t('awayCap', { n: AWAY_CAP }), textStyle(9.5, '#d8e6f4', '700')).setOrigin(0.5),
      this.add.graphics().setName('bar'),
    ];
    this.away = this.add.container(x, y, parts).setDepth(UI_DEPTH - 1).setVisible(false);
    parts[0].setInteractive({ useHandCursor: true }).on('pointerdown', () => (this.awayLeft = Math.min(this.awayLeft, 600)));
  }

  private showAway(gained: number) {
    this.awayLeft = gained > 0 ? AWAY_SHOW_MS : 0;
    this.away.setVisible(gained > 0).setAlpha(1);
    if (gained <= 0) return;
    const label = this.away.getByName('gained') as Phaser.GameObjects.Text;
    label.setText(t('nectarGained', { n: gained })).setX(40 + (this.away.getAt(1) as Phaser.GameObjects.Text).width + 8);
    const bar = this.away.getByName('bar') as Phaser.GameObjects.Graphics;
    const [bx, by, bw, bh] = [270, 20, 70, 8];
    bar.clear().fillStyle(LIVE.awayTrack).fillRoundedRect(bx, by, bw, bh, 4);
    bar.fillStyle(LIVE.bar).fillRoundedRect(bx, by, Math.max(bh, (bw * gained) / AWAY_CAP), bh, 4);
  }

  private createHud() {
    // The HUD is pinned to the view's top edge, its title and counts at the left, the stats at the right.
    const { x: left, y: top, right } = this.edges;
    this.add.image(left - CARD_PAD, top - CARD_PAD, 'hud').setOrigin(0).setDepth(UI_DEPTH);
    const d = UI_DEPTH + 1;
    this.add.text(left + 16, top + 18, t('title'), textStyle(19, '#ffd25a', '900')).setOrigin(0, 0.5).setDepth(d);
    this.add.image(left + 237, top + 19, 'coin').setDepth(d);
    this.hud = {
      coins: this.add.text(left + 249, top + 18, '', textStyle(16, '#fff1cc', '800')).setOrigin(0, 0.5).setDepth(d),
      coinsLabel: this.add.text(0, top + 19, t('coins'), textStyle(11, '#d9b880', '600')).setOrigin(0, 0.5).setDepth(d),
      honeyIcon: this.add.image(0, top + 19, 'honey-icon-clover').setDepth(d),
      honey: this.add.text(0, top + 18, '', textStyle(16, '#fff1cc', '800')).setOrigin(0, 0.5).setDepth(d),
      honeyLabel: this.add.text(0, top + 19, t('honeyLabel'), textStyle(11, '#d9b880', '600')).setOrigin(0, 0.5).setDepth(d),
      waxIcon: this.add.image(0, top + 19, 'wax-icon').setDepth(d),
      wax: this.add.text(0, top + 18, '', textStyle(16, '#fff1cc', '800')).setOrigin(0, 0.5).setDepth(d),
      waxLabel: this.add.text(0, top + 19, t('wax'), textStyle(11, '#d9b880', '600')).setOrigin(0, 0.5).setDepth(d),
      stats: this.add.text(right - 16, top + 18, '', textStyle(13.5, '#fff1cc', '700')).setOrigin(1, 0.5).setDepth(d),
    };
    this.hint = this.add.text(HINT.x, HINT.y, '', textStyle(13, '#ffffff', '800', true)).setOrigin(0.5).setDepth(d);
  }

  private drawHud() {
    const s = this.state;
    const h = this.hud;
    h.coins.setText(formatNumber(s.coins));
    h.coinsLabel.setX(h.coins.x + h.coins.width + 3);
    const honeyX = Math.max(this.edges.x + 335, h.coinsLabel.x + h.coinsLabel.width + 26);
    h.honeyIcon.setX(honeyX);
    h.honey.setText(formatNumber(jarCount(s))).setX(honeyX + 12);
    h.honeyLabel.setX(h.honey.x + h.honey.width + 3);
    const waxX = h.honeyLabel.x + h.honeyLabel.width + 26;
    h.waxIcon.setX(waxX);
    h.wax.setText(formatNumber(s.wax)).setX(waxX + 13);
    h.waxLabel.setX(h.wax.x + h.wax.width + 3);
    const out = s.bees.filter((b) => b.tripMs > 0).length;
    const lent = s.bees.filter((b) => b.lent).length;
    const bees = lent ? t('beesLent', { n: s.bees.length, out, lent }) : t('bees', { n: s.bees.length, out });
    const stats = t('stats', { year: s.years + 1, season: t(season(s)), time: clockText(seasonLeft(s)), bees, sold: s.sold });
    const room = h.stats.x - (h.waxLabel.x + h.waxLabel.width) - 16;
    if (stats !== h.stats.text || room !== this.statsRoom) {
      // Big counts at the left squeeze the stats: they shrink to stay clear of the wax.
      this.statsRoom = room;
      h.stats.setFontSize(13.5).setText(stats);
      for (let size = 13; size >= 9 && h.stats.width > room; size--) h.stats.setFontSize(size);
    }
    this.hint.setText(this.awayLeft > 0 ? '' : this.hintText());
  }

  /** What to do next, while the player is still learning the loop. */
  private hintText() {
    const s = this.state;
    if (s.sold > 0) return '';
    if (jarCount(s) > 0) return t('hintSell');
    if (s.cells.some((c) => c?.type === 'honey' && c.phase === 'capped')) return t('hintHarvest');
    if (s.cells.some((c) => c?.type === 'honey' && c.phase === 'ripening')) return t('hintRipen');
    if (!s.cells.some((c) => c !== null)) return t('hintBuild');
    if (s.bees.some((b) => b.tripMs === 0)) return t('hintSend');
    return t('hintWait');
  }

  /** A small button in the corner that throws the comb and coins away for a fresh hive. */
  private createReset() {
    const text = this.add
      .text(this.edges.right - 16, this.edges.bottom - 6, t('newHive'), textStyle(12, '#1f4a18', '700'))
      .setOrigin(1, 1)
      .setDepth(UI_DEPTH + 1)
      .setInteractive({ useHandCursor: true });
    text.on('pointerdown', () => {
      ui('click');
      clearProgress();
      for (const sprite of [...this.bees.values(), ...this.wasps.values()]) sprite.destroy();
      this.bees.clear();
      this.wasps.clear();
      this.waspAt.clear();
      this.placing = false;
      this.entering = false;
      this.hive = 0;
      this.state = newHive(freshProgress());
      this.showAway(0);
      this.endCard.root.setVisible(false);
      this.queenCard.root.setVisible(false);
    });
  }

  /** The season's tint over the scenery. */
  private drawSeason() {
    const t = SEASON_TINT[season(this.state)];
    this.seasonTint.setFillStyle(t.colour, t.alpha);
  }

  /** The tabs on the roof that switch between the hives' combs, shown once there are two. */
  private createTabs() {
    for (const hive of [0, 1]) {
      const at = hiveTab(hive);
      const card = this.add.image(0, 0, 'hive-tab-on');
      const label = this.add.text(0, -1, t('hive', { n: hive + 1 }), textStyle(10.5, '#7a4410', '800')).setOrigin(0.5);
      const zone = this.add.zone(0, 0, HIVE_TAB.w, HIVE_TAB.h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        if (this.hive !== hive) ui('click');
        this.hive = hive;
        this.placing = false;
      });
      const root = this.add.container(at.x, at.y, [card, label, zone]).setDepth(1.5).setVisible(false);
      this.tabs.push({ root, card, label });
    }
  }

  private drawTabs() {
    const s = this.state;
    this.tabs.forEach((tab, hive) => {
      tab.root.setVisible(s.hives > 1);
      const on = hive === this.hive;
      const key = on ? 'hive-tab-on' : 'hive-tab-off';
      if (tab.card.texture.key !== key) tab.card.setTexture(key);
      const colour = on ? '#7a4410' : '#fff1cc';
      if (tab.label.style.color !== colour) tab.label.setColor(colour);
    });
  }

  /** The mead casks at the right end of the shelf: a barrel per cask with an arc as it ages, lit once the mead is ready. */
  private createCasks() {
    for (let i = 0; i < MAX_CASKS; i++) {
      const at = caskSpot(i);
      this.casks.push({
        cask: this.add.image(at.x, at.y, 'cask').setOrigin(0.5, 1).setVisible(false).setDepth(3).setInteractive({ useHandCursor: true }),
        label: this.add.text(at.x, at.y - CASK.h - 9, '', textStyle(10, '#fff1cc', '800', true)).setOrigin(0.5).setDepth(4),
      });
    }
    this.caskArcs = this.add.graphics().setDepth(4);
    // While the fair card is armed, a tap on a ready cask enters its mead.
    this.casks.forEach((c, i) =>
      c.cask.on('pointerdown', () => {
        if (!this.entering) return;
        if (!enterMead(this.state, i)) return ui('refuse');
        this.entering = false;
        this.save();
      }),
    );
  }

  private drawCasks() {
    const s = this.state;
    const g = this.caskArcs;
    g.clear();
    this.casks.forEach((c, i) => {
      const cask = s.casks[i];
      c.cask.setVisible(!!cask);
      const entering = this.entering && classesFor(s.fairs).includes('mead');
      c.label.setText(cask ? (cask.agingMs > 0 ? clockText(cask.agingMs) : entering ? t('points', { n: MEAD_POINTS[cask.kind] }) : t('price', { n: cask.value })) : '');
      if (!cask) return;
      const at = caskSpot(i);
      const [cx, cy] = [at.x, at.y - CASK.h / 2];
      const kind = cask.kind;
      if (cask.agingMs > 0) {
        g.lineStyle(3, LIVE.meadArc, 0.95).beginPath().arc(cx, cy, 9, -Math.PI / 2, -Math.PI / 2 + caskDone(cask) * Math.PI * 2).strokePath();
      } else {
        const pulse = settings.reduceMotion ? 0.8 : 0.55 + 0.4 * Math.sin(this.clock / 150);
        g.lineStyle(entering ? 3 : 2, entering ? LIVE.fairPick : LIVE.meadReady, pulse).strokeRoundedRect(cx - CASK.w / 2 - 1, cy - CASK.h / 2 - 1, CASK.w + 2, CASK.h + 2, 8);
      }
      const colour = kind === 'clover' ? '#f2a92e' : kind === 'lavender' ? '#b48ae0' : '#df7aa6';
      if (c.label.style.color !== colour) c.label.setColor(colour);
    });
  }

  /** The orchard contract card in the shop's eighth spot: the farmer's offer (tap to take it), or the bees away. */
  private createContract() {
    this.contract = {
      card: this.add.image(CONTRACT.x, CONTRACT.y, 'contract-card').setDepth(30).setInteractive({ useHandCursor: true }),
      title: this.add.text(CONTRACT.x - CONTRACT.w / 2 + 14, CONTRACT.y - 7, '', textStyle(12.5, '#2f5a24', '900')).setOrigin(0, 0.5).setDepth(31),
      detail: this.add.text(CONTRACT.x - CONTRACT.w / 2 + 14, CONTRACT.y + 8, '', textStyle(10, '#4a6a30', '700')).setOrigin(0, 0.5).setDepth(31),
    };
    this.contract.card.on('pointerdown', () => this.state.contract?.phase === 'offer' && this.act(acceptContract(this.state)));
  }

  private drawContract() {
    const s = this.state;
    const c = this.contract;
    const contract = s.contract;
    const home = s.bees.filter(atHome).length;
    c.card.setAlpha(s.sold < CONTRACTS_FROM ? 0.75 : 1);
    if (contract?.phase === 'offer') {
      const time = clockText(contract.leftMs);
      c.title.setText(t('orchardOffer', { n: contract.bees, pay: contract.pay }));
      c.detail.setText(home >= contract.bees ? t('takeIt', { time }) : t('mustBeHome', { n: contract.bees, time }));
    } else if (contract) {
      c.title.setText(t('atOrchard', { n: contract.bees }));
      c.detail.setText(t('backIn', { time: clockText(contract.leftMs) }));
    } else if (s.sold < CONTRACTS_FROM) {
      c.title.setText(t('orchardContracts'));
      c.detail.setText(t('fromSold', { n: CONTRACTS_FROM }));
    } else {
      c.title.setText(t('orchardContracts'));
      c.detail.setText(t(isWinter(s) ? 'noneWinter' : 'farmerCalls'));
    }
  }

  /** The swarm chip above the button board while a crowded hive gets ready to swarm: a bar runs out, and a tap catches the swarm. */
  private createSwarm() {
    const text = this.add.text(12, 12, '', textStyle(12.5, '#fff1cc', '900')).setOrigin(0, 0.5);
    const detail = this.add.text(12, 27, '', textStyle(10, '#ffe0b0', '700')).setOrigin(0, 0.5);
    const bar = this.add.graphics();
    const card = this.add.image(-CARD_PAD, -CARD_PAD, 'swarm-chip').setOrigin(0).setInteractive({ useHandCursor: true });
    card.on('pointerdown', () => {
      if (this.state.coins < CATCH_PRICE) return ui('refuse');
      ui('click');
      this.queenCard.root.setVisible(true);
    });
    const root = this.add.container(SWARM.x, SWARM.y, [card, text, detail, bar]).setDepth(UI_DEPTH - 1).setVisible(false);
    this.swarm = { root, text, detail, bar };
  }

  private drawSwarm() {
    const s = this.state;
    const on = crowded(s);
    this.swarm.root.setVisible(on);
    // The queen card goes with the swarm (it leaves, or there are no longer coins to catch it).
    if (this.queenCard.root.visible && (!crowded(s) || s.coins < CATCH_PRICE)) this.queenCard.root.setVisible(false);
    if (!on) return;
    this.swarm.text.setText(t('swarmGathers', { time: clockText(s.swarmIn) }));
    this.swarm.detail.setText(t(s.coins >= CATCH_PRICE ? 'catchIt' : 'catchCosts', { n: CATCH_PRICE }));
    const [bx, by, bw, bh] = [SWARM.w - 80, 15, 68, 8];
    this.swarm.bar.clear().fillStyle(LIVE.swarmTrack).fillRoundedRect(bx, by, bw, bh, 4);
    this.swarm.bar.fillStyle(LIVE.swarmBar).fillRoundedRect(bx, by, Math.max(bh, (bw * s.swarmIn) / SWARM_MS), bh, 4);
  }

  /** The end card: gold at the fair makes the player the Beehive Baron. A tap on it, or on the shade around it, carries on playing. */
  private createEnd() {
    const card = this.add.image(0, 0, 'end-card').setInteractive({ useHandCursor: true });
    const title = this.add.text(0, -16, t('goldTitle'), textStyle(22, '#4a2c10', '900')).setOrigin(0.5);
    const sub = this.add.text(0, 12, t('baron'), textStyle(15, '#6a4aa8', '800')).setOrigin(0.5);
    const detail = this.add.text(0, 40, '', textStyle(11.5, '#6a4a28', '700')).setOrigin(0.5);
    const more = this.add.text(0, END_CARD.h / 2 - 22, t('keepPlaying'), textStyle(10.5, '#8a6a40', '600')).setOrigin(0.5);
    // The shade takes the taps around the card too, so none reaches the comb or the shop under it.
    const shade = this.add.rectangle(0, 0, VIEW.w * 2, VIEW.h * 2, 0x2a1808, 0.45).setInteractive();
    const root = this.add.container(END_CARD.x, END_CARD.y, [shade, card, title, sub, detail, more]).setDepth(UI_DEPTH + 5).setVisible(false);
    for (const target of [shade, card])
      target.on('pointerdown', () => {
        ui('click');
        root.setVisible(false);
      });
    this.endCard = { root, detail };
  }

  private showEnd() {
    const s = this.state;
    const total = fairTotal(s) ?? 0;
    this.endCard.detail.setText(t('endDetail', { points: total, year: s.years + 1, sold: s.sold, bees: s.bees.length, n: s.hives }));
    this.endCard.root.setVisible(true);
  }

  /** The card that opens from the swarm chip: three queens for the second hive, each a button; a tap beside them backs out. */
  private createQueenCard() {
    const shade = this.add.rectangle(0, 0, VIEW.w * 2, VIEW.h * 2, 0x2a1808, 0.45).setInteractive();
    const card = this.add.image(0, 0, 'queen-card').setInteractive();
    const title = this.add.text(0, -END_CARD.h / 2 + 34, t('pickQueen'), textStyle(19, '#4a2c10', '900')).setOrigin(0.5);
    const sub = this.add.text(0, -END_CARD.h / 2 + 58, t('queenSub', { n: CATCH_PRICE }), textStyle(10.5, '#6a4a28', '700')).setOrigin(0.5);
    const more = this.add.text(0, END_CARD.h / 2 - 20, t('waitOutside'), textStyle(10.5, '#8a6a40', '600')).setOrigin(0.5);
    const root = this.add.container(END_CARD.x, END_CARD.y, [shade, card, title, sub, more]).setDepth(UI_DEPTH + 5).setVisible(false);
    shade.on('pointerdown', () => {
      ui('click');
      root.setVisible(false);
    });
    const buttons = QUEEN_IDS.map((queen, i) => {
      const b = new Button(this, END_CARD.x + (i - 1) * 130, END_CARD.y + 18, 122, 56, () => {
        root.setVisible(false);
        this.act(catchSwarm(this.state, queen));
      });
      b.set(`${t(QUEENS[queen].name)}\n${t(QUEENS[queen].blurb)}`, true);
      b.root.setDepth(UI_DEPTH + 6).setVisible(false);
      return b;
    });
    this.queenCard = { root, buttons };
  }

  private drawQueenCard() {
    for (const b of this.queenCard.buttons) b.root.setVisible(this.queenCard.root.visible);
  }
}
