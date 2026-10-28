import Phaser from 'phaser';
import { playMusic, playSting, ui } from '../../../../shared/audio';
import { settings } from '../../../../shared/settings';
import { viewFrame, viewSize } from '../../../../shared/scaling';
import { propKey, PROP_ORIGIN, tileKey } from '../art/textures';
import { addArt, RES } from '../art/wood';
import { PLACE_PITCH, sfx, SONG } from '../audio';
import { joinedCells, joinedCount } from '../game/castle';
import { DECREE_BONUS, decreeMarks, decreeRegion, type At, type Decree } from '../game/decree';
import { GIFT_INFO, type Gift } from '../game/gifts';
import { dailyIsland, LEVELS, levelOpen, parseIsland, starScores, starsFor, today, type Kingdom } from '../game/islands';
import { loadBest, loadCrowns, loadDailyBest, loadStars, saveBest, saveCrowns, saveDailyBest, saveStars } from '../game/save';
import { OMEN_FROM, type Omen } from '../game/omens';
import { SEASON_INFO } from '../game/seasons';
import {
  canClear,
  canClearAny,
  canMerge,
  canPlace,
  canTrade,
  anyPlace,
  canUndo,
  chooseGift,
  clear,
  finish,
  goalFor,
  handCount,
  housesCanMerge,
  merge,
  mergeable,
  newGame,
  place,
  previewClear,
  previewMerge,
  previewPlacement,
  ROUND_POUCH,
  season,
  select,
  shownKinds,
  trade,
  TRADE_GIVE,
  tradeGives,
  tradeTakes,
  undo,
  type GameState,
  type Placed,
  type Share,
} from '../game/state';
import { BUILDINGS, INFO, ISLANDS, randomIsland, type Building, type Special } from '../game/tiles';
import { placeName, t } from '../i18n';
import { checkTrophies } from '../trophies/check';
import { makeButton } from '../ui/Button';
import {
  BUTTON,
  cellCentre,
  DECREE,
  FONT,
  GIFT_CARD,
  GIFT_ROW,
  GOAL_BAR,
  GRID,
  ISLAND_BUTTON,
  ISLANDS_CARD,
  OMEN,
  PANEL,
  POUCH_LINE,
  SEASON,
  TILE_BUTTONS,
  TITLE,
  TRADE_CARD,
  TRAY,
  UI_DEPTH,
  UNDO_BUTTON,
  VIEW,
} from './layout';

/** How long a score popup floats up before it fades out, in milliseconds. */
const POPUP_MS = 900;
/** Score popups and the decree's "+8" float over the gift card (UI_DEPTH + 10), which opens on the same placement. */
const POPUP_DEPTH = UI_DEPTH + 11;
const BANNER_MS = 2400;

/** The paints used by text and Graphics, matching src/art/wood.ts. */
const INK = '#3a2414';
const CREAM = '#fff6e2';
const LABEL = '#f1d9b0';
const RULE = '#5a3a20';
const RUST = '#b06a2a';
const YELLOW = 0xf2c33a;
const NAVY = 0x27406e;
const BLUE = 0x3b86d6;
const CORAL = 0xe0785f;
const TEAL = 0x2f9c95;

/** Board depths: tiles, decree marks and the hover outline, props (by row), ghost, then links and labels. */
const D = { tile: 1, outline: 2, spots: 2.5, prop: 3, ghost: 3.9, ticks: 4, links: 5, label: 6 };

type Weight = '700' | '800' | '900';
const style = (size: number, color: string, weight: Weight = '800', extra: Phaser.Types.GameObjects.Text.TextStyle = {}) => ({
  fontFamily: FONT,
  fontStyle: weight,
  fontSize: `${size}px`,
  color,
  ...extra,
});

/** Shrinks a text to fit `max` view pixels wide (German runs longer than English); its `displayWidth` is what it takes up. */
const fit = <T extends Phaser.GameObjects.Text>(text: T, max: number) => text.setScale(text.width > max ? max / text.width : 1);

/** A count of a building, such as "3 farms", in the hub's language. */
const count = (kind: Building, n: number) => t(INFO[kind].count, { n });

/** Where a tile button is on screen and which building it holds; read by the playthrough test. */
export interface TileButton {
  kind: Building;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Where a gift's choice button is on screen; read by the playthrough test. */
export interface GiftButton {
  gift: Gift;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ButtonParts {
  glow: Phaser.GameObjects.Image;
  plaque: Phaser.GameObjects.Image;
  icon: Phaser.GameObjects.Container;
  name: Phaser.GameObjects.Text;
  count: Phaser.GameObjects.Text;
  key: string;
}

export class GameScene extends Phaser.Scene {
  /** The game being played; read by the playthrough test. */
  state!: GameState;
  /** The cell under the pointer with the selected building: what placing it there would add, each neighbour's share, the season's bonus and the castle's new joins. */
  preview: { col: number; row: number; gained: number; base: number; links: Share[]; season: number; joins: number } | null = null;
  /** The house picked to merge into a house beside it, while one is picked. */
  mergeFrom: { col: number; row: number } | null = null;
  /** On a touchscreen, the cell whose placement or clearing is being previewed: a second tap on it commits. */
  private touchAt: { col: number; row: number } | null = null;
  /** Where the island button is on screen. */
  islandButton = { x: ISLAND_BUTTON.x, y: ISLAND_BUTTON.y, w: ISLAND_BUTTON.w, h: ISLAND_BUTTON.h };
  tileButtons: TileButton[] = [];
  /** Where the undo button is on screen; read by the playthrough test. */
  undoButton = { x: UNDO_BUTTON.x, y: UNDO_BUTTON.y, w: UNDO_BUTTON.w, h: UNDO_BUTTON.h };
  /** The gift card's two buttons while a gift is due; read by the playthrough test. */
  giftButtons: GiftButton[] = [];

  private tiles: Phaser.GameObjects.Image[][] = [];
  private props: Phaser.GameObjects.Image[][] = [];
  private buttons = new Map<Building, ButtonParts>();
  private buttonObjects: Phaser.GameObjects.GameObject[] = [];
  private shownKinds = '';
  private undoBg!: Phaser.GameObjects.Image;
  private undoText!: Phaser.GameObjects.Text;
  private hover!: Phaser.GameObjects.Graphics;
  private ghost!: Phaser.GameObjects.Image;
  private links!: Phaser.GameObjects.Graphics;
  private linkTexts: Phaser.GameObjects.Text[] = [];
  private bubbleText!: Phaser.GameObjects.Text;
  private bar!: Phaser.GameObjects.Graphics;
  private roundText!: Phaser.GameObjects.Text;
  private islandText!: Phaser.GameObjects.Text;
  private seasonStrip!: Phaser.GameObjects.Graphics;
  private seasonText!: Phaser.GameObjects.Text;
  private pouchText!: Phaser.GameObjects.Text;
  private omenStrip!: Phaser.GameObjects.Graphics;
  private omenText!: Phaser.GameObjects.Text;
  private omenLabel!: Phaser.GameObjects.Text;
  private castleText!: Phaser.GameObjects.Text;
  private joinImages: Phaser.GameObjects.Image[] = [];
  private seasonBadge!: Phaser.GameObjects.Text;
  private castleBadge!: Phaser.GameObjects.Text;
  private mergeHint!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private goalText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private giftLabel!: Phaser.GameObjects.Text;
  private giftOr!: Phaser.GameObjects.Text;
  private chips!: Phaser.GameObjects.Graphics;
  private chipParts: { icon: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Zone }[] = [];
  private decreeText!: Phaser.GameObjects.Text;
  private beads: Phaser.GameObjects.Image[] = [];
  private progressText!: Phaser.GameObjects.Text;
  private rewardTitle!: Phaser.GameObjects.Text;
  private rewardText!: Phaser.GameObjects.Text;
  private crownsText!: Phaser.GameObjects.Text;
  private marks!: Phaser.GameObjects.Graphics;
  private markImages: Phaser.GameObjects.Image[] = [];
  private placeLabel!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Container;
  private bannerText!: Phaser.GameObjects.Text;
  private giftCard!: Phaser.GameObjects.Container;
  private giftTitle!: Phaser.GameObjects.Text;
  private giftSub!: Phaser.GameObjects.Text;
  private giftParts: { plaque: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; desc: Phaser.GameObjects.Text }[] = [];
  private tradeCard!: Phaser.GameObjects.Container;
  private tradeObjects: Phaser.GameObjects.GameObject[] = [];
  private tradeGo!: Phaser.GameObjects.Image;
  private tradeGoText!: Phaser.GameObjects.Text;
  /** The kind to give two of and the gift building to take, while the trade card is open. */
  private tradeGive: Building | null = null;
  private tradeTake: Special | null = null;
  private gameOver!: Phaser.GameObjects.Container;
  private gameOverText!: Phaser.GameObjects.Text;
  private islandsCard!: Phaser.GameObjects.Container;
  private levelParts: { plaque: Phaser.GameObjects.Image; num: Phaser.GameObjects.Text; stars: Phaser.GameObjects.Image[] }[] = [];
  private levelInfo!: Phaser.GameObjects.Text;
  private dailyText!: Phaser.GameObjects.Text;
  private codeText!: Phaser.GameObjects.Text;
  private codeHint!: Phaser.GameObjects.Text;
  /** The island number typed on the islands card's keypad. */
  private code = '';
  /** The campaign's best stars per level, loaded when the card opens. */
  private stars: number[] = [];
  /** The best score when this kingdom began, to tell a new best at its end. */
  private bestAtStart = 0;

  constructor() {
    super('Game');
  }

  create() {
    this.state = newGame(loadBest(), loadCrowns());
    // The layout is drawn for VIEW (960x540); on a wider or taller screen the camera centres it in
    // the view (`viewFrame`), and the background's table fills the rest.
    const frame = viewFrame(this);
    this.cameras.main.setScroll(-frame.x, -frame.y);
    addArt(this, -frame.x, -frame.y, 'bg').setOrigin(0).setDepth(-1);
    this.createBoard();
    this.createDecree();
    this.createPanel();
    this.createGiftCard();
    this.createTradeCard();
    this.createGameOver();
    this.createIslandsCard();
    const backdrop = addArt(this, 0, 0, 'walnut-440x96');
    this.bannerText = this.add.text(0, -2, '', style(15, CREAM, '900', { align: 'center', lineSpacing: 4 })).setOrigin(0.5);
    this.banner = this.add
      .container(GRID.x + (GRID.cols * GRID.cell) / 2, GRID.y + (GRID.rows * GRID.cell) / 2, [backdrop, this.bannerText])
      .setDepth(UI_DEPTH + 5)
      .setAlpha(0);
    this.refresh();
    this.bestAtStart = this.state.best;
    // Each season has its own part of the song; it starts on the first tap if sound is still locked.
    playMusic(SONG, season(this.state));
  }

  private createBoard() {
    this.tiles = this.state.grid.map((cells, row) =>
      cells.map((cell, col) => {
        const { x, y } = cellCentre(col, row);
        return addArt(this, x, y, tileKey(cell, col, row)).setDepth(D.tile);
      }),
    );
    this.props = this.state.grid.map((cells, row) =>
      cells.map((_, col) => {
        const { x, y } = cellCentre(col, row);
        return addArt(this, x, y, 'prop-house').setOrigin(PROP_ORIGIN.x, PROP_ORIGIN.y).setDepth(D.prop + row * 0.01).setVisible(false);
      }),
    );
    this.redrawCells();

    this.marks = this.add.graphics().setDepth(D.outline);
    this.placeLabel = this.add.text(0, 0, '', style(10, CREAM, '800')).setOrigin(0.5).setDepth(D.label);
    this.hover = this.add.graphics().setDepth(D.outline + 0.1);
    this.ghost = addArt(this, 0, 0, 'tile-farm').setDepth(D.ghost).setVisible(false);
    this.links = this.add.graphics().setDepth(D.links);
    for (let i = 0; i < 8; i++) this.linkTexts.push(this.add.text(0, 0, '', style(12, INK, '900')).setOrigin(0.5).setDepth(D.label).setVisible(false));
    this.bubbleText = this.add.text(0, 0, '', style(19, INK, '900')).setOrigin(0.5).setDepth(D.label + 0.1).setVisible(false);
    this.seasonBadge = this.add.text(0, 0, 'x2', style(11, CREAM, '900')).setOrigin(0.5).setDepth(D.label + 0.2).setVisible(false);
    this.castleBadge = this.add.text(0, 0, '', style(10, CREAM, '900')).setOrigin(0.5).setDepth(D.label + 0.2).setVisible(false);
    this.omenLabel = this.add.text(0, 0, '', style(10, CREAM, '800')).setOrigin(0.5).setDepth(D.label).setVisible(false);
    this.mergeHint = this.add.text(0, 0, '', style(11, CREAM, '900')).setOrigin(0.5).setDepth(D.label + 0.2).setVisible(false);

    // One zone over the whole board: hovering previews, a tap places. A touch has no hover, so its
    // first tap on a cell previews and a second tap on the same cell places.
    const zone = this.add.zone(GRID.x, GRID.y, GRID.cols * GRID.cell, GRID.rows * GRID.cell).setOrigin(0).setInteractive({ useHandCursor: true });
    zone.on('pointermove', (p: Phaser.Input.Pointer) => this.hoverPointer(p));
    // A lifted finger counts as leaving the board; the touch preview stays until the next tap.
    zone.on('pointerout', (p: Phaser.Input.Pointer) => {
      if (!(p.wasTouch && this.touchAt)) this.hoverAt(-1, -1);
    });
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const at = this.cameras.main.getWorldPoint(p.x, p.y);
      this.tapAt(at.x, at.y, p.wasTouch);
    });
  }

  private createDecree() {
    const R = DECREE;
    this.add.text(R.x + 44, R.y + 10, t('decreeHeading'), style(8, RUST, '900', { letterSpacing: 1 } as never)).setOrigin(0, 0.5);
    this.decreeText = this.add.text(R.x + 44, R.y + 21, '', style(12, INK, '800')).setOrigin(0, 0.5);
    for (let i = 0; i < 8; i++) this.beads.push(addArt(this, 0, R.y + R.h / 2 - 0.5, 'bead-off').setVisible(false));
    this.progressText = this.add.text(0, R.y + R.h / 2, '', style(13, '#3d7a2c', '900')).setOrigin(0, 0.5);
    this.rewardTitle = this.add.text(R.x + 435, R.y + 10, t('rewardHeading'), style(8, RUST, '900', { letterSpacing: 1 } as never)).setOrigin(0, 0.5);
    this.rewardText = this.add.text(R.x + 435, R.y + 21, '', style(12, INK, '800')).setOrigin(0, 0.5);
    this.crownsText = this.add.text(R.x + R.w - 49, R.y + R.h / 2 + 0.5, '', style(13, CREAM, '900')).setOrigin(0, 0.5);
  }

  private createPanel() {
    this.add
      .text(TITLE.x + TITLE.w / 2, TITLE.y + TITLE.h / 2 - 1, t('title'), style(21, CREAM, '900', { shadow: { offsetX: 1, offsetY: 1.5, color: 'rgba(80,20,10,0.6)', fill: true } }))
      .setOrigin(0.5);
    this.roundText = this.add.text(PANEL.x + 16, ISLAND_BUTTON.y, '', style(14, LABEL)).setOrigin(0, 0.5);
    // The island button: shows which island this is and opens the islands card.
    const ib = ISLAND_BUTTON;
    const islandBg = addArt(this, ib.x, ib.y, `plaque-${ib.w}x${ib.h}`).setInteractive({ useHandCursor: true });
    islandBg.on('pointerover', () => islandBg.setTexture(`plaque-${ib.w}x${ib.h}-sel`));
    islandBg.on('pointerout', () => islandBg.setTexture(`plaque-${ib.w}x${ib.h}`));
    islandBg.on('pointerdown', () => {
      ui('click');
      this.openIslands();
    });
    this.islandText = this.add.text(ib.x, ib.y - 1, '', style(12, INK, '900')).setOrigin(0.5);
    this.scoreText = this.add.text(PANEL.x + 16, 104, '', style(20, CREAM, '900', { shadow: { offsetX: 1, offsetY: 1.5, color: 'rgba(0,0,0,0.45)', fill: true } })).setOrigin(0, 0.5);
    // How many buildings the castle's chain reaches: the bonus the end of the kingdom pays.
    this.castleText = this.add.text(PANEL.x + PANEL.w - 16, 104, '', style(11, LABEL, '700', { align: 'right' })).setOrigin(1, 0.5);
    this.bar = this.add.graphics();
    this.goalText = this.add
      .text(GOAL_BAR.x + GOAL_BAR.w / 2, GOAL_BAR.y + GOAL_BAR.h / 2, '', style(10, CREAM, '900', { stroke: 'rgba(30,20,10,0.6)', strokeThickness: 2 }))
      .setOrigin(0.5);

    // The two gifts on offer for reaching the goal, as chips; taking one when the goal is reached.
    const midY = GIFT_ROW.y + GIFT_ROW.h / 2;
    this.giftLabel = this.add.text(GIFT_ROW.x, midY, '', style(10.5, LABEL)).setOrigin(0, 0.5);
    this.giftOr = this.add.text(0, midY, t('or'), style(10, LABEL)).setOrigin(0.5);
    this.chips = this.add.graphics();
    for (let i = 0; i < 2; i++) {
      const zone = this.add.zone(0, midY, 10, GIFT_ROW.h).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.takeGift(this.state.gifts[i]));
      this.chipParts.push({
        icon: addArt(this, 0, midY, 'icon-tower').setScale(0.85 / RES),
        text: this.add.text(0, midY + 0.5, '', style(9.5, '#ffffff')).setOrigin(0, 0.5),
        zone,
      });
    }

    // The season strip: the round's season and which buildings it doubles.
    this.seasonStrip = this.add.graphics();
    this.seasonText = this.add.text(SEASON.x + SEASON.w / 2, SEASON.y + SEASON.h / 2, '', style(10.5, CREAM, '800')).setOrigin(0.5);

    // The pouch line: what is left to draw, and whether a market can trade (a tap on one opens the trade card).
    this.pouchText = this.add.text(POUCH_LINE.x, POUCH_LINE.y, '', style(10, LABEL, '700', { wordWrap: { width: POUCH_LINE.w }, lineSpacing: 1 }));

    // The omen strip: what the next round brings, once omens begin.
    this.omenStrip = this.add.graphics();
    this.omenText = this.add.text(OMEN.x + OMEN.w / 2, OMEN.y + OMEN.h / 2, '', style(10, CREAM, '800')).setOrigin(0.5);

    const { x, y, w, h } = UNDO_BUTTON;
    this.undoBg = addArt(this, x, y, `plaque-${w}x${h}`);
    this.undoText = this.add.text(x, y - 1, '', style(13, INK)).setOrigin(0.5);
    this.undoBg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.closeTrade();
      // With no room for any tile and nothing to undo, the button finishes the kingdom instead
      // (merging or clearing a wood could still make room).
      if (!canUndo(this.state) && finish(this.state)) {
        this.gameEnded();
        this.refresh();
        return;
      }
      if (!undo(this.state)) {
        ui('refuse');
        return;
      }
      sfx('undo');
      this.mergeFrom = null;
      this.redrawCells();
      this.refresh();
      this.hoverPointer();
    });
    this.bestText = this.add.text(PANEL.x + PANEL.w / 2, PANEL.y + PANEL.h - 12, '', style(12, LABEL)).setOrigin(0.5);
  }

  /** Builds the tile buttons for the kinds in the hand: one plaque per kind, with its rule and how many the hand holds. */
  private buildButtons(kinds: Building[]) {
    for (const o of this.buttonObjects) o.destroy();
    this.buttonObjects = [];
    this.buttons.clear();
    this.tileButtons = [];
    const { ys, h, w, x } = TILE_BUTTONS;
    kinds.forEach((kind, i) => {
      const y = ys[i];
      const left = x - w / 2;
      const top = y - h / 2;
      const icon = this.tileIcon(kind, left + 31, y - 1, 0.62);
      const textX = left + 60;
      // The name leaves room for the count pill at the right.
      const name = fit(this.add.text(textX, top + 12, t(INFO[kind].name), style(15, INK, '900')).setOrigin(0, 0.5), 128);
      const rule = this.add.text(textX, top + 22, t(INFO[kind].rule), style(9.5, RULE, '700', { wordWrap: { width: 152 }, lineSpacing: 0 }));
      this.addTileButton(kind, x, y, w, h, top + 12, icon, name, [rule]);
    });
  }

  /** A building's tile and what stands on it, scaled into a button. */
  private tileIcon(kind: Building, x: number, y: number, scale: number) {
    const parts: Phaser.GameObjects.Image[] = [addArt(this, 0, 0, tileKey(kind === 'farm' || kind === 'road' ? kind : 'plain', 0, 0))];
    const prop = propKey(kind);
    if (prop) parts.push(addArt(this, 0, 0, prop).setOrigin(PROP_ORIGIN.x, PROP_ORIGIN.y));
    return this.add.container(x, y, parts).setScale(scale);
  }

  /** The plaque, glow and count of a tile button around its icon and name; `countX` puts the count pill, by default at the right. */
  private addTileButton(
    kind: Building,
    x: number,
    y: number,
    w: number,
    h: number,
    countY: number,
    icon: Phaser.GameObjects.Container,
    name: Phaser.GameObjects.Text,
    extra: Phaser.GameObjects.GameObject[],
    countX = x + w / 2 - 22,
  ) {
    const key = `plaque-${w}x${h}`;
    const glow = addArt(this, x, y + 1, `glow-${w}x${h}`).setVisible(false);
    const plaque = addArt(this, x, y, key);
    // The plaque goes under the icon and the text, which were added first.
    glow.setDepth(-0.2);
    plaque.setDepth(-0.1);
    const pill = addArt(this, countX, countY, 'count');
    const count = this.add.text(pill.x, pill.y, '', style(12, CREAM, '900')).setOrigin(0.5);
    plaque.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.closeTrade();
      if (!select(this.state, kind)) {
        ui('refuse');
        return;
      }
      sfx('select');
      this.mergeFrom = null;
      this.refresh();
      // The hover follows the new pick right away, without waiting for the pointer to move.
      this.hoverPointer();
    });
    this.buttonObjects.push(glow, plaque, icon, name, pill, count, ...extra);
    this.buttons.set(kind, { glow, plaque, icon, name, count, key });
    this.tileButtons.push({ kind, x, y, w, h });
  }

  /**
   * The market trade card: a row of kinds to give two of and a row of gift buildings to take one
   * of; picking one of each and tapping Trade makes the trade. Its chips are rebuilt on opening.
   */
  private createTradeCard() {
    const C = TRADE_CARD;
    const top = C.y - C.h / 2;
    const dim = this.add.rectangle(TRAY.x + TRAY.w / 2, TRAY.y + TRAY.h / 2, TRAY.w, TRAY.h, 0x2a170a, 0.45).setInteractive();
    const card = addArt(this, C.x, C.y, `walnut-${C.w}x${C.h}`);
    const title = this.add.text(C.x, top + 30, t('tradeTitle'), style(20, CREAM, '900', { shadow: { offsetX: 1, offsetY: 1.5, color: 'rgba(0,0,0,0.45)', fill: true } })).setOrigin(0.5);
    const sub = fit(this.add.text(C.x, top + 56, t('tradeSub', { n: TRADE_GIVE }), style(12, LABEL, '700')).setOrigin(0.5), C.w - 40);
    const heading = (y: number, text: string) => this.add.text(C.x, y, text, style(10, '#f2c33a', '900', { letterSpacing: 1 } as never)).setOrigin(0.5);
    this.tradeGo = this.plaque(C.x - 110, top + C.buttonY, BUTTON.w, BUTTON.h, () => this.makeTrade());
    this.tradeGoText = this.add.text(C.x - 110, top + C.buttonY - 1, t('trade'), style(16, INK, '900')).setOrigin(0.5);
    const close = this.plaque(C.x + 110, top + C.buttonY, BUTTON.w, BUTTON.h, () => {
      ui('click');
      this.closeTrade();
    });
    const closeText = this.add.text(C.x + 110, top + C.buttonY - 1, t('close'), style(16, INK, '900')).setOrigin(0.5);
    this.tradeCard = this.add
      .container(0, 0, [dim, card, title, sub, heading(top + C.giveY - 40, t('give', { n: TRADE_GIVE })), heading(top + C.takeY - 40, t('take', { n: 1 })), this.tradeGo, this.tradeGoText, close, closeText])
      .setDepth(UI_DEPTH + 12)
      .setVisible(false);
  }

  /** One row of chips on the trade card, centred, each with a building's icon and a label; `picked` says which is chosen. */
  private tradeRow<K extends Building>(kinds: K[], y: number, label: (k: K) => string, picked: K | null, onPick: (k: K) => void) {
    const { w, h, gap } = TRADE_CARD.chip;
    const rowW = kinds.length * w + (kinds.length - 1) * gap;
    kinds.forEach((kind, i) => {
      const x = TRADE_CARD.x - rowW / 2 + w / 2 + i * (w + gap);
      const key = `plaque-${w}x${h}`;
      const glow = addArt(this, x, y + 1, `glow-${w}x${h}`).setVisible(kind === picked);
      const plaque = addArt(this, x, y, kind === picked ? `${key}-sel` : key).setInteractive({ useHandCursor: true });
      plaque.on('pointerdown', () => {
        ui('click');
        onPick(kind);
      });
      const icon = this.tileIcon(kind, x, y - 9, 0.4);
      const text = fit(this.add.text(x, y + h / 2 - 11, label(kind), style(10, kind === picked ? '#b0401f' : INK, '900')).setOrigin(0.5), w - 6);
      this.tradeObjects.push(glow, plaque, icon, text);
      this.tradeCard.add([glow, plaque, icon, text]);
    });
  }

  private openTrade() {
    if (!canTrade(this.state)) return;
    this.tradeGive = null;
    this.tradeTake = null;
    this.mergeFrom = null;
    this.drawHover(null);
    this.refreshTrade();
    this.tradeCard.setVisible(true);
  }

  private closeTrade() {
    this.tradeCard.setVisible(false);
  }

  /** Rebuilds the trade card's chips for the pouch and the gift buildings won, marking the picks. */
  private refreshTrade() {
    for (const o of this.tradeObjects) o.destroy();
    this.tradeObjects = [];
    const s = this.state;
    const top = TRADE_CARD.y - TRADE_CARD.h / 2;
    const gives = tradeGives(s).filter((b) => b !== this.tradeTake);
    if (this.tradeGive && !gives.includes(this.tradeGive)) this.tradeGive = null;
    this.tradeRow(gives, top + TRADE_CARD.giveY, (b) => count(b, TRADE_GIVE), this.tradeGive, (b) => {
      this.tradeGive = b;
      this.refreshTrade();
    });
    const takes = tradeTakes(s).filter((b) => b !== this.tradeGive);
    if (this.tradeTake && !takes.includes(this.tradeTake)) this.tradeTake = null;
    this.tradeRow(takes, top + TRADE_CARD.takeY, (b) => count(b, 1), this.tradeTake, (b) => {
      this.tradeTake = b;
      this.refreshTrade();
    });
    const ready = !!(this.tradeGive && this.tradeTake);
    this.tradeGo.setAlpha(ready ? 1 : 0.5);
    this.tradeGoText.setAlpha(ready ? 1 : 0.5).setText(ready ? t('tradeFor', { give: count(this.tradeGive!, TRADE_GIVE), take: count(this.tradeTake!, 1) }) : t('trade'));
    fit(this.tradeGoText, BUTTON.w - 12);
  }

  private makeTrade() {
    if (!this.tradeGive || !this.tradeTake || !trade(this.state, this.tradeGive, this.tradeTake)) {
      ui('refuse');
      return;
    }
    sfx('jingle');
    this.closeTrade();
    if (this.state.phase === 'over') this.gameEnded();
    this.refresh();
    this.hoverPointer();
  }

  private createGiftCard() {
    const { x, y, w, h, button } = GIFT_CARD;
    // Dims the board and swallows its taps while the gift waits.
    const dim = this.add.rectangle(TRAY.x + TRAY.w / 2, TRAY.y + TRAY.h / 2, TRAY.w, TRAY.h, 0x2a170a, 0.45).setInteractive();
    const card = addArt(this, x, y, `walnut-${w}x${h}`);
    this.giftTitle = this.add.text(x, y - h / 2 + 30, '', style(20, CREAM, '900', { shadow: { offsetX: 1, offsetY: 1.5, color: 'rgba(0,0,0,0.45)', fill: true } })).setOrigin(0.5);
    this.giftSub = this.add.text(x, y - h / 2 + 56, '', style(12, LABEL, '700')).setOrigin(0.5);
    const objects: Phaser.GameObjects.GameObject[] = [dim, card, this.giftTitle, this.giftSub];
    const key = `plaque-${button.w}x${button.h}`;
    [-1, 1].forEach((side, i) => {
      const bx = x + side * button.dx;
      const by = y + button.dy;
      const plaque = addArt(this, bx, by, key).setInteractive({ useHandCursor: true });
      plaque.on('pointerover', () => plaque.setTexture(`${key}-sel`));
      plaque.on('pointerout', () => plaque.setTexture(key));
      plaque.on('pointerdown', () => this.takeGift(this.state.gifts[i]));
      const icon = addArt(this, bx, by - 22, 'icon-tower-big');
      const label = this.add.text(bx, by + 6, '', style(16, INK, '900')).setOrigin(0.5);
      const desc = this.add.text(bx, by + 26, '', style(10.5, RULE, '700')).setOrigin(0.5);
      objects.push(plaque, icon, label, desc);
      this.giftParts.push({ plaque, icon, label, desc });
    });
    this.giftCard = this.add.container(0, 0, objects).setDepth(UI_DEPTH + 10).setVisible(false);
  }

  private createGameOver() {
    const dim = this.dimmer();
    const panel = addArt(this, VIEW.w / 2, VIEW.h / 2, 'walnut-520x260');
    const title = this.add
      .text(VIEW.w / 2, VIEW.h / 2 - 90, t('gameOver'), style(28, CREAM, '900', { shadow: { offsetX: 1, offsetY: 2, color: 'rgba(0,0,0,0.45)', fill: true } }))
      .setOrigin(0.5);
    this.gameOverText = this.add.text(VIEW.w / 2, VIEW.h / 2 - 8, '', style(15, LABEL, '700', { align: 'center', lineSpacing: 4 })).setOrigin(0.5);
    const islands = makeButton(this, VIEW.w / 2 - 110, VIEW.h / 2 + 88, t('islands'), () => {
      ui('click');
      this.openIslands();
    });
    const again = makeButton(this, VIEW.w / 2 + 110, VIEW.h / 2 + 88, t('newKingdom'), () => this.start(randomIsland()));
    this.gameOver = this.add.container(0, 0, [dim, panel, title, this.gameOverText, islands, again]).setDepth(UI_DEPTH + 20).setVisible(false);
  }

  /** A dark veil over the whole view that swallows taps, behind a card. */
  private dimmer() {
    const frame = viewFrame(this);
    const { width, height } = viewSize(this);
    return this.add.rectangle(width / 2 - frame.x, height / 2 - frame.y, width, height, 0x2a170a, 0.55).setInteractive();
  }

  /** A beech plaque button of a baked size, lighter while the pointer is over it. */
  private plaque(x: number, y: number, w: number, h: number, onClick: () => void) {
    const key = `plaque-${w}x${h}`;
    const bg = addArt(this, x, y, key).setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => bg.setTexture(`${key}-sel`));
    bg.on('pointerout', () => bg.setTexture(key));
    bg.on('pointerdown', onClick);
    return bg;
  }

  /**
   * The islands card: the campaign's levels with their stars, the island of the day, a random
   * island, and a keypad to type an island number (the keyboard's digits work too).
   */
  private createIslandsCard() {
    const C = ISLANDS_CARD;
    const left = C.x - C.w / 2;
    const top = C.y - C.h / 2;
    const dim = this.dimmer();
    const objects: Phaser.GameObjects.GameObject[] = [dim, addArt(this, C.x, C.y, `walnut-${C.w}x${C.h}`)];
    const heading = (x: number, y: number, text: string) => objects.push(this.add.text(x, y, text, style(10, '#f2c33a', '900', { letterSpacing: 1 } as never)).setOrigin(0, 0.5));
    objects.push(
      this.add.text(left + 30, C.close.y, t('chooseIsland'), style(22, CREAM, '900', { shadow: { offsetX: 1, offsetY: 1.5, color: 'rgba(0,0,0,0.45)', fill: true } })).setOrigin(0, 0.5),
      this.plaque(C.close.x, C.close.y, C.close.w, C.close.h, () => {
        ui('click');
        this.closeIslands();
      }),
      fit(this.add.text(C.close.x, C.close.y - 1, t('close'), style(13, INK, '900')).setOrigin(0.5), C.close.w - 8),
    );

    // The campaign: one plaque per level with its number and stars.
    heading(left + 30, top + 66, t('campaign'));
    objects.push(fit(this.add.text(left + 110, top + 66, t('campaignSub'), style(11, LABEL, '700')).setOrigin(0, 0.5), C.w - 140));
    const L = C.level;
    const rowW = LEVELS.length * L.w + (LEVELS.length - 1) * L.gap;
    LEVELS.forEach((_, i) => {
      const x = C.x - rowW / 2 + L.w / 2 + i * (L.w + L.gap);
      const plaque = this.plaque(x, L.y, L.w, L.h, () => this.playLevel(i + 1));
      plaque.on('pointerover', () => this.showLevel(i + 1));
      const num = this.add.text(x, L.y - 9, String(i + 1), style(22, INK, '900')).setOrigin(0.5);
      const stars = [-1, 0, 1].map((k) => addArt(this, x + k * 16, L.y + 17, 'star-off'));
      objects.push(plaque, num, ...stars);
      this.levelParts.push({ plaque, num, stars });
    });
    this.levelInfo = this.add.text(C.x, L.y + 48, '', style(12, LABEL, '700')).setOrigin(0.5);
    objects.push(this.levelInfo);
    const rule = this.add.graphics();
    rule.fillStyle(0x000000, 0.25).fillRect(left + 24, L.y + 66, C.w - 48, 2);
    objects.push(rule);

    // The island of the day and a random island.
    const D2 = C.daily;
    heading(D2.x - D2.w / 2, D2.y - D2.h / 2 - 16, t('islandOfTheDay'));
    objects.push(this.plaque(D2.x, D2.y, D2.w, D2.h, () => this.playDaily()));
    this.dailyText = this.add.text(D2.x, D2.y - 1, '', style(15, INK, '900', { align: 'center', lineSpacing: 4 })).setOrigin(0.5);
    objects.push(this.dailyText);
    const R = C.random;
    objects.push(this.plaque(R.x, R.y, R.w, R.h, () => this.start(randomIsland())), this.add.text(R.x, R.y - 1, t('randomIsland'), style(15, INK, '900')).setOrigin(0.5));

    // The keypad for an island number.
    const K = C.key;
    const box = C.code;
    heading(box.x - box.w / 2, box.y - box.h / 2 - 16, t('islandNumber'));
    const field = this.add.graphics();
    field.fillStyle(0x2e1a0c, 1).fillRoundedRect(box.x - box.w / 2, box.y - box.h / 2, box.w, box.h, 10);
    field.lineStyle(2, 0xf2c33a, 0.8).strokeRoundedRect(box.x - box.w / 2, box.y - box.h / 2, box.w, box.h, 10);
    this.codeText = this.add.text(box.x, box.y, '', style(20, CREAM, '900', { letterSpacing: 3 } as never)).setOrigin(0.5);
    this.codeHint = this.add.text(box.x + box.w / 2, box.y - box.h / 2 - 16, t('islandRange', { n: String(ISLANDS) }), style(10, LABEL, '700')).setOrigin(1, 0.5);
    objects.push(field, this.codeText, this.codeHint);
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Del', '0', 'Play'];
    keys.forEach((key, i) => {
      const x = K.x + ((i % 3) - 1) * (K.w + K.gap);
      const y = K.y + Math.floor(i / 3) * (K.h + K.gap);
      const label = key === 'Del' ? t('keyDel') : key === 'Play' ? t('keyPlay') : key;
      objects.push(this.plaque(x, y, K.w, K.h, () => this.keyIn(key)), fit(this.add.text(x, y - 1, label, style(key.length > 1 ? 13 : 16, INK, '900')).setOrigin(0.5), K.w - 6));
    });
    this.islandsCard = this.add.container(0, 0, objects).setDepth(UI_DEPTH + 30).setVisible(false);

    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (!this.islandsCard.visible) return;
      if (/^\d$/.test(e.key)) this.keyIn(e.key);
      else if (e.key === 'Backspace') this.keyIn('Del');
      else if (e.key === 'Enter') this.keyIn('Play');
      else if (e.key === 'Escape') {
        ui('click');
        this.closeIslands();
      }
    });
  }

  /** A key on the islands card's keypad: a digit, Del or Play. */
  private keyIn(key: string) {
    if (key === 'Play') {
      const island = parseIsland(this.code);
      if (island) this.start(island, { mode: 'code' });
      else ui('refuse');
      return;
    }
    ui('click');
    if (key === 'Del') this.code = this.code.slice(0, -1);
    else if (this.code.length < 4) this.code = (this.code + key).replace(/^0+/, '');
    this.refreshCode();
  }

  private refreshCode() {
    this.codeText.setText(this.code || '-');
    this.codeHint.setColor(this.code && !parseIsland(this.code) ? '#e0785f' : LABEL);
  }

  private openIslands() {
    this.stars = loadStars();
    this.code = '';
    this.refreshCode();
    LEVELS.forEach((_, i) => {
      const p = this.levelParts[i];
      const open = levelOpen(i + 1, this.stars);
      p.plaque.setAlpha(open ? 1 : 0.45);
      if (p.plaque.input) p.plaque.input.enabled = open;
      p.num.setAlpha(open ? 1 : 0.45);
      p.stars.forEach((star, k) => star.setTexture(k < (this.stars[i] ?? 0) ? 'star-on' : 'star-off').setAlpha(open ? 1 : 0.45));
    });
    const next = LEVELS.findIndex((_, i) => levelOpen(i + 1, this.stars) && !(this.stars[i] ?? 0));
    this.showLevel(next < 0 ? 1 : next + 1);
    const day = today();
    const best = loadDailyBest(day);
    this.dailyText.setText([t('islandButton', { n: String(dailyIsland(day)) }), best ? t('todaysBest', { n: best }) : t('notPlayedToday')]);
    this.islandsCard.setVisible(true);
    this.mergeFrom = null;
    this.drawHover(null);
  }

  private closeIslands() {
    this.islandsCard.setVisible(false);
  }

  /** The line under the levels: a level's island and the scores its stars need. */
  private showLevel(level: number) {
    const [one, two, three] = starScores(level);
    const lock = levelOpen(level, this.stars) ? '' : t('levelLocked');
    this.levelInfo.setText(t('levelInfo', { level, island: String(LEVELS[level - 1].island), one, two, three }) + lock);
    fit(this.levelInfo, ISLANDS_CARD.w - 40);
  }

  private playLevel(level: number) {
    if (!levelOpen(level, loadStars())) return;
    this.start(LEVELS[level - 1].island, { mode: 'campaign', level });
  }

  private playDaily() {
    const day = today();
    this.start(dailyIsland(day), { mode: 'daily', day });
  }

  private cellAt(x: number, y: number) {
    const col = Math.floor((x - GRID.x) / GRID.cell);
    const row = Math.floor((y - GRID.y) / GRID.cell);
    if (col < 0 || row < 0 || col >= GRID.cols || row >= GRID.rows) return null;
    return { col, row };
  }

  /** Hovers where a pointer is, in layout pixels (the camera centres the layout in the view). */
  private hoverPointer(p = this.input.activePointer) {
    const at = this.cameras.main.getWorldPoint(p.x, p.y);
    this.hoverAt(at.x, at.y);
  }

  private hoverAt(x: number, y: number) {
    const at = this.cellAt(x, y);
    const kind = this.state.selected;
    const p = at && kind && !this.mergeFrom ? previewPlacement(this.state, kind, at.col, at.row) : null;
    this.preview = at && p ? { ...at, ...p } : null;
    this.drawHover(at);
  }

  /**
   * A tap on the board: on a house with a house beside it, picks it to merge (a second tap on the
   * house beside it merges them into a manor); on a wood beside a lumber camp with the lumber camp
   * picked, clears the wood; anywhere else, places the picked building. A `touch` tap on a cell to
   * build on or clear only previews it, unless the last touch tap previewed the same cell.
   */
  private tapAt(x: number, y: number, touch = false) {
    const at = this.cellAt(x, y);
    if (!at) return;
    const s = this.state;
    const armed = this.touchAt?.col === at.col && this.touchAt.row === at.row;
    this.touchAt = null;
    const commits = !this.mergeFrom && ((s.selected && previewPlacement(s, s.selected, at.col, at.row)) || canClear(s, at.col, at.row));
    if (touch && commits && !armed) {
      this.touchAt = at;
      this.hoverAt(x, y);
      return;
    }
    const from = this.mergeFrom;
    this.mergeFrom = null;
    let placed: Placed | null = null;
    if (from && canMerge(this.state, from, at)) {
      placed = merge(this.state, from, at);
      sfx('thunk');
      this.later(110, () => sfx('ding'));
    } else if ((!from || from.col !== at.col || from.row !== at.row) && mergeable(this.state, at.col, at.row)) {
      this.mergeFrom = at;
      sfx('select');
    } else if (!from && canClear(this.state, at.col, at.row)) {
      placed = clear(this.state, at.col, at.row);
      if (placed) sfx('chop');
    } else if (!from && this.state.grid[at.row][at.col] === 'market' && canTrade(this.state)) {
      ui('click');
      this.openTrade();
      return;
    } else if (!from) {
      const kind = this.state.selected;
      placed = place(this.state, at.col, at.row);
      if (placed && kind) sfx('place', { pitch: PLACE_PITCH[kind] });
      else if (!placed) ui('refuse');
    } else sfx('select', { pitch: 0.8 }); // a second tap that cancels the merge
    if (placed) this.placedSounds(placed, from);
    if (placed) {
      if (placed.decree) saveCrowns(this.state.crowns);
      if (this.state.phase === 'over') this.gameEnded();
      this.redrawCells();
      for (const change of placed.changes) this.popup(change.col, change.row, change.gained, change.col === at.col && change.row === at.row);
      if (placed.decree) this.decreePaid();
      if (placed.struck) for (const [c, r] of placed.struck.cells) this.popup(c, r, 0, true, t(placed.struck.kind === 'flood' ? 'flooded' : 'toppled'));
    }
    this.refresh();
    this.hoverAt(x, y);
  }

  private takeGift(gift: Gift) {
    if (!chooseGift(this.state, gift)) {
      ui('refuse');
      return;
    }
    sfx('gift');
    if (this.state.phase === 'over') this.gameEnded();
    if (this.state.phase === 'playing') this.announceRound(gift);
    this.refresh();
    this.hoverPointer();
  }

  /** Saves what a finished kingdom won: the best score, the island of the day's best and campaign stars. */
  private gameEnded() {
    const s = this.state;
    saveBest(s.best);
    if (s.mode === 'daily' && s.score > loadDailyBest(s.day)) saveDailyBest(s.day, s.score);
    if (s.mode === 'campaign') {
      const stars = loadStars();
      stars[s.level - 1] = Math.max(stars[s.level - 1] ?? 0, starsFor(s.level, s.score));
      saveStars(stars);
    }
    this.endSounds();
  }

  /** Plays `play` after `ms` of game time; `start` cancels the ones still waiting. */
  private later(ms: number, play: () => void) {
    this.time.delayedCall(ms, play);
  }

  /**
   * What a placement, clearing or merge sounds like after its own "tok": a rising blip per building
   * whose worth went up (staggered with the popups, at most six), one low note if any went down,
   * then the decree's fanfare, the omen striking and the goal's arpeggio, in that order. `from` is
   * the merged-away house for a merge, null otherwise.
   */
  private placedSounds(placed: Placed, from: { col: number; row: number } | null) {
    const gains = placed.changes.filter((c) => c.gained > 0).slice(0, 6);
    gains.forEach((_, i) => this.later(70 + i * 70, () => sfx('gain', { pitch: 2 ** ((i * 2) / 12) })));
    // A merge always loses the house it takes away, so only other losses sound.
    const lost = placed.changes.filter((c) => !(from && c.col === from.col && c.row === from.row));
    if (lost.some((c) => c.gained < 0)) this.later(80, () => sfx('loss'));
    let at = 120 + gains.length * 70;
    if (placed.decree) {
      this.later(at, () => sfx('decree'));
      at += 450;
    }
    if (placed.struck) {
      const kind = placed.struck.kind;
      this.later(at, () => sfx(kind));
      at += 500;
    }
    if (placed.newRound) this.later(at, () => sfx('goal'));
  }

  /** The end of a kingdom: a tick per building the castle joined (up to ten), a chime per campaign star, then a sting. */
  private endSounds() {
    const s = this.state;
    const ticks = Math.min(10, s.castle);
    for (let i = 0; i < ticks; i++) this.later(500 + i * 60, () => sfx('tick', { pitch: 1 + i * 0.03 }));
    let at = 600 + ticks * 60;
    if (s.mode === 'campaign') {
      const stars = starsFor(s.level, s.score);
      for (let i = 0; i < stars; i++) this.later(at + i * 260, () => sfx('star', { pitch: 2 ** ((i * 4) / 12) }));
      at += stars * 260;
    }
    const best = s.score > this.bestAtStart;
    this.later(at, () => playSting(SONG, best ? 'best' : 'finished'));
  }

  /** A "+N" (or a word, such as an omen's "Flooded") that floats up from a cell and fades; it only fades with reduced motion. */
  private popup(col: number, row: number, gained: number, main: boolean, word = '') {
    const { x, y } = cellCentre(col, row);
    const color = word ? '#e0785f' : gained > 0 ? '#f2c33a' : gained < 0 ? '#e0785f' : '#f1d9b0';
    const text = this.add
      .text(x, y - 8, word || `${gained >= 0 ? '+' : ''}${gained}`, style(word ? 15 : main ? 24 : 16, color, '900', { stroke: '#3a2414', strokeThickness: 4 }))
      .setOrigin(0.5)
      .setDepth(POPUP_DEPTH);
    const rise = settings.reduceMotion ? 0 : 32;
    this.tweens.add({ targets: text, y: y - 8 - rise, alpha: 0, duration: POPUP_MS, ease: 'Quad.easeIn', onComplete: () => text.destroy() });
  }

  /** The decree's "+8" drops from the banner, and the crown count bumps. */
  private decreePaid() {
    const x = this.progressText.x + 12;
    const text = this.add
      .text(x, DECREE.y + DECREE.h + 4, `+${DECREE_BONUS}`, style(22, '#f2c33a', '900', { stroke: '#3a2414', strokeThickness: 4 }))
      .setOrigin(0.5)
      .setDepth(POPUP_DEPTH);
    const fall = settings.reduceMotion ? 0 : 30;
    this.tweens.add({ targets: text, y: text.y + fall, alpha: 0, delay: 300, duration: POPUP_MS * 1.4, onComplete: () => text.destroy() });
    if (!settings.reduceMotion) this.tweens.add({ targets: this.crownsText, scale: 1.4, duration: 160, yoyo: true });
  }

  private announceRound(gift: Gift) {
    const s = this.state;
    const tiles = BUILDINGS.filter((b) => ROUND_POUCH[b] > 0)
      .map((b) => `+${count(b, ROUND_POUCH[b])}`)
      .join('  ');
    const info = SEASON_INFO[season(s)];
    const lines = [
      t('bannerRound', { n: s.round, season: t(info.name) }),
      t('bannerRule', { rule: t(info.rule), tiles }),
      t('bannerGift', { gift: t(GIFT_INFO[gift].label) }),
    ];
    if (s.omen) lines.push(t('bannerOmen', { n: s.round + 1, omen: this.omenLine(s.omen, 'text') }));
    // The new season's part takes over at the next bar; an omen for the next round adds its motif.
    playMusic(SONG, season(s));
    if (s.omen) this.later(500, () => playSting(SONG, 'omen'));
    fit(this.bannerText.setText(lines), 430);
    this.banner.setAlpha(1);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({ targets: this.banner, alpha: 0, delay: BANNER_MS / 2, duration: BANNER_MS / 2 });
  }

  /** The decree in a line, worded from its kind, place and need. */
  private decreeLine(d: Decree) {
    if (d.kind === 'watch') return t('decreeWatch', { n: d.need });
    return t(d.kind === 'shore' ? 'decreeShore' : 'decreeWood', { n: d.need, place: placeName(d.place) });
  }

  /** The omen in a line for the round banner (`text`), or in a few words for the panel's strip (`short`). */
  private omenLine(omen: Omen, length: 'text' | 'short') {
    if (omen.kind === 'flood') return t(length === 'text' ? 'floodText' : 'floodShort', { place: placeName(omen.place) });
    return t(length === 'text' ? 'stormText' : 'stormShort');
  }

  private drawHover(at: { col: number; row: number } | null) {
    const g = this.hover.clear();
    const l = this.links.clear();
    const kind = this.state.selected;
    this.ghost.setVisible(false);
    this.bubbleText.setVisible(false);
    this.seasonBadge.setVisible(false);
    this.castleBadge.setVisible(false);
    this.mergeHint.setVisible(false);
    for (const t of this.linkTexts) t.setVisible(false);
    if (this.state.phase !== 'playing') return;
    const box = (c: number, r: number, color: number) =>
      g.lineStyle(3.5, color, 1).strokeRoundedRect(GRID.x + c * GRID.cell + 1, GRID.y + r * GRID.cell + 1, GRID.cell - 2, GRID.cell - 4, 8);
    if (this.mergeFrom) box(this.mergeFrom.col, this.mergeFrom.row, TEAL);
    if (!at) return;
    const x = GRID.x + at.col * GRID.cell;
    const y = GRID.y + at.row * GRID.cell;
    const { x: cx, y: cy } = cellCentre(at.col, at.row);
    if (this.mergeFrom || mergeable(this.state, at.col, at.row)) {
      // Merging: a teal outline on a house that can merge, and over the house beside the picked one, a manor's ghost and what it would add.
      const gained = this.mergeFrom ? previewMerge(this.state, this.mergeFrom, at) : null;
      if (gained === null) {
        if (!this.mergeFrom || mergeable(this.state, at.col, at.row)) {
          const picked = this.mergeFrom?.col === at.col && this.mergeFrom.row === at.row;
          box(at.col, at.row, TEAL);
          this.hint(cx, y + GRID.cell - 12, t(picked ? 'tapToCancel' : this.mergeFrom ? 'pickThisHouse' : 'tapToMerge'));
          return;
        }
        box(at.col, at.row, CORAL);
        return;
      }
      box(at.col, at.row, TEAL);
      this.ghost.setTexture('prop-manor').setOrigin(PROP_ORIGIN.x, PROP_ORIGIN.y).setPosition(cx, cy).setAlpha(0.7).setVisible(true);
      this.bubble(cx, y - 4, gained);
      this.hint(cx, y + GRID.cell - 12, t('manorName'));
      return;
    }
    // Clearing a wood: with the lumber camp picked, a wood beside a camp shows what clearing it would cost.
    const cleared = previewClear(this.state, at.col, at.row);
    if (cleared !== null) {
      box(at.col, at.row, TEAL);
      this.ghost.setTexture('tile-grass-0').setOrigin(0.5).setPosition(cx, cy).setAlpha(0.6).setVisible(true);
      this.bubble(cx, y - 4, cleared);
      this.hint(cx, y + GRID.cell - 12, t('clearWood'));
      return;
    }
    // A market: a tap opens the trade card while a trade can be made this round.
    if (this.state.grid[at.row][at.col] === 'market') {
      const can = canTrade(this.state);
      box(at.col, at.row, can ? TEAL : CORAL);
      this.hint(cx, y + GRID.cell - 12, t(can ? 'tapToTrade' : this.state.tradedIn === this.state.round ? 'tradedThisRound' : 'noTrade'));
      return;
    }
    const ok = canPlace(this.state, at.col, at.row, kind);
    g.lineStyle(3.5, ok && kind ? YELLOW : CORAL, 1).strokeRoundedRect(x + 1, y + 1, GRID.cell - 2, GRID.cell - 4, 8);
    if (!this.preview || !kind) return;
    if (kind === 'farm' || kind === 'road') this.ghost.setTexture(`tile-${kind}`).setOrigin(0.5).setPosition(cx, cy).setAlpha(0.65);
    else this.ghost.setTexture(`prop-${kind}`).setOrigin(PROP_ORIGIN.x, PROP_ORIGIN.y).setPosition(cx, cy).setAlpha(0.6);
    this.ghost.setVisible(true);

    // A dotted link from each neighbour that pays into the ghost, with its share at the neighbour's end.
    this.preview.links.slice(0, this.linkTexts.length).forEach((link, i) => {
      const dc = at.col - link.col;
      const dr = at.row - link.row;
      const len = Math.hypot(dc, dr);
      const [ux, uy] = [dc / len, dr / len];
      // The share sits off the neighbour's middle, below it or to its left, so its building still shows.
      let [px, py] = [-uy, ux];
      if (py < 0 || (py === 0 && px > 0)) [px, py] = [-px, -py];
      const n = cellCentre(link.col, link.row);
      const start = { x: n.x + px * 12, y: n.y + py * 12 };
      const end = { x: cx - ux * 14 + px * 8, y: cy - uy * 14 + py * 8 };
      const ctrl = { x: (start.x + end.x) / 2 + px * 8, y: (start.y + end.y) / 2 + py * 8 };
      const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(start.x, start.y), new Phaser.Math.Vector2(ctrl.x, ctrl.y), new Phaser.Math.Vector2(end.x, end.y));
      const dots = Math.max(3, Math.round(curve.getLength() / 6));
      for (const p of curve.getSpacedPoints(dots)) {
        l.fillStyle(0x000000, 0.3).fillCircle(p.x, p.y + 1, 1.7);
        l.fillStyle(0xfff6e2, 1).fillCircle(p.x, p.y, 1.6);
      }
      const label = `${link.pts > 0 ? '+' : ''}${link.pts}`;
      const pw = label.length > 2 ? 34 : 30;
      l.fillStyle(0x000000, 0.3).fillRoundedRect(start.x - pw / 2, start.y - 8, pw, 19, 9.5);
      l.fillStyle(link.pts > 0 ? YELLOW : CORAL, 1).fillRoundedRect(start.x - pw / 2, start.y - 9.5, pw, 19, 9.5);
      this.linkTexts[i].setText(label).setColor(link.pts > 0 ? INK : CREAM).setPosition(start.x, start.y).setVisible(true);
    });
    // The total in a bubble over the ghost, the season's "x2" when it doubles this building, and the castle's new joins.
    this.bubble(cx, y - 4, this.preview.gained);
    if (this.preview.season > 0) {
      const color = SEASON_INFO[season(this.state)].color;
      l.fillStyle(0x000000, 0.3).fillRoundedRect(cx + 16, y - 21, 26, 16, 8);
      l.fillStyle(color, 1).fillRoundedRect(cx + 16, y - 22.5, 26, 16, 8);
      this.seasonBadge.setPosition(cx + 29, y - 14.5).setVisible(true);
    }
    if (this.preview.joins > 0) {
      const by = y + GRID.cell - 12;
      this.castleBadge.setText(t('castlePlus', { n: this.preview.joins })).setPosition(cx, by).setVisible(true);
      const w = this.castleBadge.width + 10;
      l.fillStyle(0x000000, 0.3).fillRoundedRect(cx - w / 2, by - 6.5, w, 16, 8);
      l.fillStyle(NAVY, 1).fillRoundedRect(cx - w / 2, by - 8, w, 16, 8);
    }
  }

  /** The total in a yellow bubble (coral when it loses points) centred at (cx, by). */
  private bubble(cx: number, by: number, gained: number) {
    const l = this.links;
    l.fillStyle(0x000000, 0.35).fillRoundedRect(cx - 21, by - 10.5, 42, 25, 12.5);
    l.fillStyle(gained < 0 ? CORAL : YELLOW, 1).fillRoundedRect(cx - 21, by - 12.5, 42, 25, 12.5);
    l.lineStyle(1.5, 0xfff6c8, 1).strokeRoundedRect(cx - 21, by - 12.5, 42, 25, 12.5);
    this.bubbleText
      .setText(`${gained >= 0 ? '+' : ''}${gained}`)
      .setColor(gained < 0 ? CREAM : INK)
      .setPosition(cx, by)
      .setVisible(true);
  }

  /** A small teal label on the board, for the merge. */
  private hint(x: number, y: number, text: string) {
    this.mergeHint.setText(text).setPosition(x, y).setVisible(true);
    const w = this.mergeHint.width + 12;
    this.links.fillStyle(TEAL, 1).fillRoundedRect(x - w / 2, y - 8, w, 16, 8);
  }

  /** The decree's banner text and progress, and its marks on the board. */
  private refreshDecree() {
    const s = this.state;
    const d = s.decree;
    this.crownsText.setText(`x${s.crowns}`);
    const g = this.marks.clear();
    for (const m of this.markImages) m.destroy();
    this.markImages = [];
    this.placeLabel.setVisible(false);
    for (const b of this.beads) b.setVisible(false);
    if (!d) {
      this.decreeText.setText(t('noDecree'));
      this.progressText.setText('');
      this.rewardTitle.setVisible(false);
      this.rewardText.setVisible(false);
      return;
    }
    this.rewardTitle.setVisible(true);
    fit(this.rewardText.setVisible(true).setText(t(d.done ? 'rewardPaid' : 'reward', { n: DECREE_BONUS })), this.crownsText.x - this.rewardText.x - 22);
    const marks = decreeMarks(s.grid, d);
    const have = d.done ? d.need : Math.min(marks.have, d.need);
    this.decreeText.setText(this.decreeLine(d));
    let px = this.decreeText.x + this.decreeText.width + 16;
    if (d.need <= this.beads.length) {
      for (let i = 0; i < d.need; i++) this.beads[i].setTexture(i < have ? 'bead-on' : 'bead-off').setPosition(px + i * 18, this.beads[i].y).setVisible(true);
      px += d.need * 18 - 6;
    }
    this.progressText.setText(d.done ? t('decreeDone') : `${have}/${d.need}`).setX(px);
    if (d.done || s.phase === 'over') return;

    // Outline the lake or wood (or the tower's watch), name it, tick what counts and mark the open spots.
    // A wood's cells come from the board as it stands, so a cleared cell drops out of the outline.
    const cells = decreeRegion(s.grid, d);
    const outline: At[] = d.kind === 'watch' ? (marks.tower ? this.around(marks.tower) : []) : cells;
    this.dashedOutline(g, outline);
    if (d.kind !== 'watch' && cells.length) {
      const cx = cells.reduce((t, [c]) => t + c, 0) / cells.length;
      const bottom = Math.max(...cells.filter(([c]) => Math.abs(c - cx) < 1).map(([, r]) => r), ...cells.map(([, r]) => r).slice(0, 1));
      const x = GRID.x + (cx + 0.5) * GRID.cell;
      const y = GRID.y + (bottom + 1) * GRID.cell - 9;
      this.placeLabel.setText(placeName(d.place)).setPosition(x, y).setVisible(true);
      const w = this.placeLabel.width + 16;
      g.fillStyle(NAVY, 1).fillRoundedRect(x - w / 2, y - 8, w, 16, 8);
    }
    for (const [c, r] of marks.counted) {
      this.markImages.push(addArt(this, GRID.x + c * GRID.cell + 52, GRID.y + r * GRID.cell + 11, 'tick').setDepth(D.ticks));
    }
    if (s.phase === 'playing') {
      const spot = d.kind === 'shore' ? 'spot-farm' : 'spot-house';
      for (const [c, r] of marks.spots) {
        const { x, y } = cellCentre(c, r);
        this.markImages.push(addArt(this, x, y - 2, spot).setDepth(D.spots));
      }
    }
  }

  /** The omen's mark on the board (a coral dashed box with a word on the threatened cell) and a bead on every cell the castle's chain reaches. */
  private refreshBoardMarks() {
    const s = this.state;
    for (const m of this.joinImages) m.destroy();
    this.joinImages = [];
    this.omenLabel.setVisible(false);
    const g = this.marks;
    if (s.omen && s.phase !== 'over') {
      const [c, r] = s.omen.at;
      const x = GRID.x + c * GRID.cell;
      const y = GRID.y + r * GRID.cell;
      g.lineStyle(3, CORAL, 1);
      for (let t = 0; t < 4; t++) {
        const [x1, y1, x2, y2] = [
          [x + 3, y + 3, x + GRID.cell - 3, y + 3],
          [x + GRID.cell - 3, y + 3, x + GRID.cell - 3, y + GRID.cell - 5],
          [x + GRID.cell - 3, y + GRID.cell - 5, x + 3, y + GRID.cell - 5],
          [x + 3, y + GRID.cell - 5, x + 3, y + 3],
        ][t];
        const len = Math.hypot(x2 - x1, y2 - y1);
        for (let d = 0; d < len; d += 11) {
          const e = Math.min(len, d + 6);
          g.lineBetween(x1 + ((x2 - x1) * d) / len, y1 + ((y2 - y1) * d) / len, x1 + ((x2 - x1) * e) / len, y1 + ((y2 - y1) * e) / len);
        }
      }
      this.omenLabel.setText(t(s.omen.kind === 'flood' ? 'floodMark' : 'stormMark')).setPosition(x + GRID.cell / 2, y + GRID.cell - 12).setVisible(true);
      const w = this.omenLabel.width + 12;
      g.fillStyle(CORAL, 1).fillRoundedRect(x + GRID.cell / 2 - w / 2, y + GRID.cell - 20, w, 16, 8);
    }
    for (const [c, r] of joinedCells(s.grid)) {
      this.joinImages.push(addArt(this, GRID.x + c * GRID.cell + 11, GRID.y + r * GRID.cell + 11, 'bead-on').setScale(0.7 / RES).setDepth(D.ticks));
    }
  }

  /** The cells of the 3x3 block around a tower, on the board. */
  private around([col, row]: At): At[] {
    const out: At[] = [];
    for (let r = row - 1; r <= row + 1; r++)
      for (let c = col - 1; c <= col + 1; c++) if (c >= 0 && r >= 0 && c < GRID.cols && r < GRID.rows) out.push([c, r]);
    return out;
  }

  /** A yellow dashed line round the outer edges of a group of cells. */
  private dashedOutline(g: Phaser.GameObjects.Graphics, cells: At[]) {
    const inside = new Set(cells.map(([c, r]) => `${c},${r}`));
    const has = (c: number, r: number) => inside.has(`${c},${r}`);
    g.lineStyle(3, YELLOW, 1);
    const dash = (x1: number, y1: number, x2: number, y2: number) => {
      const len = Math.hypot(x2 - x1, y2 - y1);
      for (let t = 0; t < len; t += 13) {
        const t2 = Math.min(len, t + 8);
        g.lineBetween(x1 + ((x2 - x1) * t) / len, y1 + ((y2 - y1) * t) / len, x1 + ((x2 - x1) * t2) / len, y1 + ((y2 - y1) * t2) / len);
      }
    };
    const inset = 2;
    for (const [c, r] of cells) {
      const x0 = GRID.x + c * GRID.cell + inset;
      const y0 = GRID.y + r * GRID.cell + inset;
      const x1 = GRID.x + (c + 1) * GRID.cell - inset;
      const y1 = GRID.y + (r + 1) * GRID.cell - inset;
      if (!has(c, r - 1)) dash(x0, y0, x1, y0);
      if (!has(c, r + 1)) dash(x0, y1, x1, y1);
      if (!has(c - 1, r)) dash(x0, y0, x0, y1);
      if (!has(c + 1, r)) dash(x1, y0, x1, y1);
    }
  }

  /** The gift row: "Gift at N:" and the two gifts as chips; they glow while the gift waits. */
  private refreshGifts() {
    const s = this.state;
    const choosing = s.phase === 'gift';
    const g = this.chips.clear();
    const show = s.phase !== 'over';
    s.gifts.forEach((gift, i) => this.chipParts[i].text.setText(t(GIFT_INFO[gift].label)));
    const chipsW = this.chipParts.reduce((t, p) => t + 26 + p.text.width, 12 + this.giftOr.width);
    // The label shortens when two long gifts would run past the panel's edge.
    const room = PANEL.x + PANEL.w - 6 - GIFT_ROW.x - chipsW - 6;
    this.giftLabel.setVisible(show).setText(choosing ? t('pickOne') : t('giftAt', { n: s.goal }));
    if (this.giftLabel.width > room) this.giftLabel.setText(choosing ? t('pickShort') : t('giftAtShort', { n: s.goal }));
    this.giftOr.setVisible(show);
    let x = this.giftLabel.x + this.giftLabel.width + 6;
    const y = GIFT_ROW.y;
    const h = GIFT_ROW.h;
    s.gifts.forEach((gift, i) => {
      const part = this.chipParts[i];
      const info = GIFT_INFO[gift];
      const w = 26 + part.text.width;
      if (show) {
        if (choosing) g.fillStyle(YELLOW, 0.9).fillRoundedRect(x - 2, y - 2, w + 4, h + 4, (h + 4) / 2);
        g.fillStyle(0x000000, 0.35).fillRoundedRect(x, y + 1.5, w, h, h / 2);
        g.fillStyle(BLUE, 1).fillRoundedRect(x, y, w, h, h / 2);
        g.fillStyle(0xffffff, 0.18).fillRoundedRect(x + 1, y + 1, w - 2, h / 2, h / 4);
      }
      part.icon.setTexture(`icon-${info.icon}`).setPosition(x + 11, y + h / 2).setVisible(show);
      part.text.setPosition(x + 20, y + h / 2 + 0.5).setVisible(show);
      part.zone.setPosition(x + w / 2, y + h / 2).setSize(w, h);
      if (part.zone.input) part.zone.input.enabled = choosing;
      if (i === 0) {
        this.giftOr.setX(x + w + 6 + this.giftOr.width / 2);
        x += w + 12 + this.giftOr.width;
      }
    });

    this.giftCard.setVisible(choosing);
    this.giftButtons = [];
    if (choosing) {
      const reached = s.round - s.giftsDue;
      fit(this.giftTitle.setText(t('goalReached', { n: reached })), GIFT_CARD.w - 30);
      fit(this.giftSub.setText(t('chooseGift', { n: reached + 1 })), GIFT_CARD.w - 30);
      const { x: gx, y: gy, button } = GIFT_CARD;
      s.gifts.forEach((gift, i) => {
        const p = this.giftParts[i];
        const info = GIFT_INFO[gift];
        p.icon.setTexture(`icon-${info.icon}-big`);
        fit(p.label.setText(t(info.label)), button.w - 12);
        fit(p.desc.setText(t(info.desc)), button.w - 12);
        this.giftButtons.push({ gift, x: gx + (i ? 1 : -1) * button.dx, y: gy + button.dy, w: button.w, h: button.h });
      });
    }
  }

  private refresh() {
    const s = this.state;
    // Any change to the game drops a touch preview, so the next tap previews afresh.
    this.touchAt = null;
    const kinds = shownKinds(s);
    if (kinds.join() !== this.shownKinds) {
      this.shownKinds = kinds.join();
      this.buildButtons(kinds);
    }
    this.roundText.setText(t('round', { n: s.round }));
    const island = String(s.island);
    this.islandText.setText(s.mode === 'campaign' ? t('levelButton', { n: s.level }) : s.mode === 'daily' ? t('dailyButton', { n: island }) : t('islandButton', { n: island }));
    fit(this.islandText, ISLAND_BUTTON.w - 8);
    this.scoreText.setText(t('score', { n: s.score }));
    fit(this.goalText.setText(t('goal', { score: s.score, goal: s.goal, next: s.round + 1 })), GOAL_BAR.w - 8);
    // A finished daily counts its own score, since saving it fails silently when storage is blocked.
    const dailyBest = s.mode === 'daily' ? Math.max(loadDailyBest(s.day), s.phase === 'over' ? s.score : 0) : 0;
    if (s.mode === 'campaign') {
      const [one, two, three] = starScores(s.level);
      this.bestText.setText(t('starsAt', { one, two, three }));
    } else if (s.mode === 'daily') this.bestText.setText(t('todaysBest', { n: dailyBest }));
    else this.bestText.setText(t('bestScore', { n: s.best }));

    // The season strip.
    const info = SEASON_INFO[season(s)];
    const S = SEASON;
    this.seasonStrip.clear();
    this.seasonStrip.fillStyle(0x000000, 0.3).fillRoundedRect(S.x, S.y + 1.5, S.w, S.h, S.h / 2);
    this.seasonStrip.fillStyle(info.color, 1).fillRoundedRect(S.x, S.y, S.w, S.h, S.h / 2);
    this.seasonStrip.fillStyle(0xffffff, 0.16).fillRoundedRect(S.x + 1, S.y + 1, S.w - 2, S.h / 2, S.h / 4);
    fit(this.seasonText.setText(`${t(info.name)}: ${t(info.short)}`), SEASON.w - 12);

    // The pouch line, the omen strip and the castle's count.
    // A no-break space keeps each count on one line ("2 mills", never "2" at a line's end).
    const left = BUILDINGS.filter((b) => s.pouch[b] > 0).map((b) => count(b, s.pouch[b]).replace(' ', '\u00a0'));
    const pouch = left.length ? t('pouch', { list: left.join(', ') }) : t('pouchEmpty');
    this.pouchText.setText(canTrade(s) ? t('pouchTrade', { pouch }) : pouch);
    const O = OMEN;
    this.omenStrip.clear();
    const omenOn = !!s.omen && s.phase !== 'over';
    if (omenOn) {
      this.omenStrip.fillStyle(0x000000, 0.3).fillRoundedRect(O.x, O.y + 1.5, O.w, O.h, O.h / 2);
      this.omenStrip.fillStyle(CORAL, 1).fillRoundedRect(O.x, O.y, O.w, O.h, O.h / 2);
      this.omenStrip.fillStyle(0xffffff, 0.16).fillRoundedRect(O.x + 1, O.y + 1, O.w - 2, O.h / 2, O.h / 4);
    }
    this.omenText.setText(omenOn ? this.omenLine(s.omen!, 'short') : s.round < OMEN_FROM ? t('omensFrom', { n: OMEN_FROM }) : t('noOmen')).setColor(omenOn ? CREAM : LABEL);
    fit(this.omenText, O.w - 12);
    const joined = joinedCount(s.grid);
    this.castleText.setText(s.phase === 'over' ? t('castlePaid', { n: s.castle }) : t('castleJoins', { n: joined }));

    // The goal bar is a groove filled with green from the last round's goal to this one's.
    const from = s.round === 1 ? 0 : goalFor(s.round - 1);
    const fill = Phaser.Math.Clamp((s.score - from) / (s.goal - from), 0, 1);
    const B = GOAL_BAR;
    const fw = Math.round((B.w - 4) * fill);
    this.bar.clear();
    this.bar.fillStyle(0x2e1a0c).fillRoundedRect(B.x, B.y, B.w, B.h, 8);
    if (fw >= 12) {
      this.bar.fillStyle(0x4f9a3d).fillRoundedRect(B.x + 2, B.y + 2, fw, B.h - 4, 6);
      this.bar.fillStyle(0x86c871).fillRoundedRect(B.x + 4, B.y + 3, fw - 4, (B.h - 4) / 2 - 1, 3);
    }

    for (const [kind, parts] of this.buttons) {
      const inHand = handCount(s, kind);
      const chosen = s.selected === kind;
      parts.glow.setVisible(chosen);
      parts.plaque.setTexture(chosen ? `${parts.key}-sel` : parts.key);
      parts.name.setColor(chosen ? '#b0401f' : INK);
      parts.count.setText(`x${inHand}`);
    }

    // With no room left and nothing to undo, the button finishes the kingdom.
    const stuck = s.phase === 'playing' && !anyPlace(s) && !canUndo(s);
    const undoable = canUndo(s) || stuck;
    const usedHere = s.undoneIn === s.round;
    const noRoom = housesCanMerge(s.grid) ? 'noRoom' : canClearAny(s) ? 'noRoomWood' : 'noRoomFinish';
    fit(this.undoText.setText(t(stuck ? noRoom : usedHere && !undoable ? 'undoUsed' : 'undo')), UNDO_BUTTON.w - 16);
    this.undoBg.setAlpha(undoable ? 1 : 0.5);
    this.undoText.setAlpha(undoable ? 1 : 0.5);

    this.refreshDecree();
    this.refreshBoardMarks();
    this.refreshGifts();
    if (s.phase !== 'playing') this.closeTrade();

    this.gameOver.setVisible(s.phase === 'over');
    if (s.phase === 'over') {
      let won = t('overBest', { best: s.best, crowns: s.crowns });
      if (s.mode === 'campaign') {
        const stars = starsFor(s.level, s.score);
        const next = stars < 3 ? t('nextStarAt', { n: starScores(s.level)[stars] }) : '';
        won = t('overLevel', { level: s.level, n: stars, next, crowns: s.crowns });
      } else if (s.mode === 'daily') won = t('overDaily', { best: dailyBest, crowns: s.crowns });
      const over = { score: s.score, island: String(s.island), round: s.round, n: s.placed, castle: s.castle, won };
      fit(this.gameOverText.setText(t('overText', over)), 500);
    }
    checkTrophies(s);
  }

  /** A new kingdom on island `island`, chosen as `kingdom` says. */
  private start(island: number, kingdom: Kingdom = { mode: 'random' }) {
    // The best score and crowns carry over even when storage is blocked and comes back empty.
    this.state = newGame(Math.max(loadBest(), this.state.best), Math.max(loadCrowns(), this.state.crowns), island, kingdom);
    this.closeIslands();
    this.closeTrade();
    ui('click');
    this.time.removeAllEvents();
    this.bestAtStart = this.state.best;
    playMusic(SONG, season(this.state));
    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(0);
    this.redrawCells();
    this.preview = null;
    this.mergeFrom = null;
    this.drawHover(null);
    this.refresh();
  }

  /** Shows each cell's current tile and what stands on it. */
  private redrawCells() {
    this.state.grid.forEach((cells, row) =>
      cells.forEach((cell, col) => {
        this.tiles[row][col].setTexture(tileKey(cell, col, row));
        const prop = propKey(cell);
        this.props[row][col].setVisible(!!prop);
        if (prop) this.props[row][col].setTexture(prop);
      }),
    );
  }
}
