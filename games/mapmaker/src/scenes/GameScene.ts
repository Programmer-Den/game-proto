import Phaser from 'phaser';
import { settings } from '../../../../shared/settings';
import { formatNumber } from '../../../../shared/i18n';
import { renderScale, viewFrame, viewSize } from '../../../../shared/scaling';
import { playMusic, playSting, ui } from '../../../../shared/audio';
import { SONG, sfx } from '../audio';
import { CANVAS, TS, nameColor, paintFog, paintTerrain, placeNames, tintOf } from '../art/map';
import {
  BLUE,
  CARD,
  DIM,
  DIM_ALPHA,
  FOG_LINE,
  GOLD_DARK,
  GREEN,
  GREY,
  HI,
  INK,
  MAGENTA,
  ON_INK,
  ON_INK_ACCENT,
  ON_INK_SOFT,
  ON_MAGENTA,
  ON_MAGENTA_SOFT,
  RULE,
  SHEET,
  SLATE,
  TABLE,
  TABLE_LINE,
  TRACK,
  VELLUM,
  hex,
  theme,
} from '../art/paint';
import { SURVEYOR_ORIGIN } from '../art/surveyor';
import { loadBest, loadGame, saveBest, saveGame, saveTheme } from '../game/save';
import { checkTrophies } from '../trophies/check';
import {
  artifactValue,
  atlasKinds,
  buy,
  canAfford,
  canCamp,
  carriesOver,
  chartOf,
  closeAtlas,
  costOf,
  dig,
  diggable,
  featureAt,
  featuresDone,
  frontier,
  hire,
  isPicked,
  isleProgress,
  islandCharted,
  milestonesDue,
  newGame,
  pickCommission,
  pitchCamp,
  returnToPort,
  sellChart,
  setSail,
  survey,
  valueOf,
} from '../game/sim';
import { HANDS } from '../game/hands';
import { kindOf, KINDS, type IsleKind } from '../game/kinds';
import {
  CAMP_COST,
  DIG_COST,
  GRID,
  MILESTONES,
  ROYAL_KINDS,
  SELL_BACK,
  TREASURE_VALUE,
  WRECK_SUPPLIES,
  indexOf,
  maxSupplies,
  rankOf,
  type Clue,
  type Commission,
  type GameState,
  type Ground,
  type Point,
  type Tile,
} from '../game/state';
import { CHART_ORDER, TERRAIN, isLandmark } from '../game/terrain';
import { UPGRADES, UPGRADE_IDS, nextCost } from '../game/upgrades';
import { coins, t, type TextKey } from '../i18n';
import { makeButton } from '../ui/Button';
import {
  BOARD,
  CAMP_BUTTON,
  FONT,
  HANDS_COLUMN,
  MAP,
  OVERLAY,
  OVERLAY_BUTTON,
  PANEL,
  RETURN_BUTTON,
  SHOP,
  SMALL_BUTTON,
  UI_DEPTH,
  tileCentre,
} from './layout';

/** Longest step between frames, so a backgrounded tab doesn't jump the animations. */
const MAX_STEP_MS = 100;
/** How fast the surveyor walks between tiles, in screen pixels a second. */
const WALK_SPEED = 260;
/** How long a newly charted tile's blank paper takes to fade, and a value chip to float up. */
const REVEAL_MS = 300;
const POPUP_MS = 900;
/** How long a find's or a dig's notice stays up. */
const NOTICE_MS = 2200;
/** How long the panel's live chart inks new tiles in magenta. */
const FRESH_MS = 1800;
/**
 * The lookout's viewshed: the sight ring sweeps out over RING_MS, the tiles' values gather into the
 * tally from GATHER_AT over GATHER_MS, and the whole thing fades out from HOLD_MS over FADE_MS.
 */
const RING_MS = 500;
const GATHER_AT = 1000;
const GATHER_MS = 350;
const HOLD_MS = 2800;
const FADE_MS = 400;

const SHEET_RECT = { x: 8, y: 12, w: 632, h: 518 };
const MAP_W = GRID.w * MAP.tile;
const MAP_H = GRID.h * MAP.tile;
/** The panel's left and right text edges. */
const PL = PANEL.x + 18;
const PR = PANEL.x + PANEL.w - 18;
/** The theme switch beside the panel's logo. */
const THEME_BUTTON = { x: PR - 36, y: 50, size: 20 };
/** Type on an atlas page's cover, light on every kind's colour in both themes. */
const PAGE_TYPE = '#fbfaf6';

interface TextOpts {
  size: number;
  weight?: number;
  color?: string;
  italic?: boolean;
  ls?: number;
  stroke?: boolean;
  wrap?: number;
}

/** A button's centre, for the playthrough test to tap. */
export interface Spot {
  x: number;
  y: number;
}

interface Popup {
  chip: Phaser.GameObjects.Container;
  age: number;
  life: number;
}

/** A lookout's reveal: the ring, a chip per tile and the tally they gather into. */
interface Sweep {
  age: number;
  centre: Spot;
  radius: number;
  tiles: { p: Spot; dist: number; value: number; chip: Phaser.GameObjects.Container; heard: boolean }[];
  /** True once the tally's chime has played. */
  tallied: boolean;
  total: number;
  tally: Phaser.GameObjects.Container;
  tallyCount: Phaser.GameObjects.Text;
  tallyAt: Spot;
  below: boolean;
}

export class GameScene extends Phaser.Scene {
  /** The game being played; read by the playthrough test. */
  state!: GameState;
  /** Where each button on screen is, by name (`return`, `camp`, `sell`, `sail`, `buy-<upgrade>`). */
  spots: Record<string, Spot> = {};
  private terrainTex!: Phaser.Textures.CanvasTexture;
  private fogTex!: Phaser.Textures.CanvasTexture;
  /** The tiles the island art was painted from, and which of them were charted when the fog was. */
  private paintedTiles: Tile[] | null = null;
  private known: boolean[] = [];
  private fading: { img: Phaser.GameObjects.Image; age: number }[] = [];
  private names: { text: Phaser.GameObjects.Text; tile: Point }[] = [];
  private hints = new Map<number, Phaser.GameObjects.Container>();
  /** When each tile was charted, by the scene's clock, for the panel's live chart. */
  private freshAt = new Map<number, number>();
  private glow!: Phaser.GameObjects.Graphics;
  /** Cost labels under the survey stations, reused frame to frame. */
  private costLabels: Phaser.GameObjects.Text[] = [];
  /** The map's marks (finds, storms, camps, dug tiles, the treasure), by what and where. */
  private marks = new Map<string, Phaser.GameObjects.Image>();
  private campButton: Phaser.GameObjects.Container | null = null;
  private campEnabled: boolean | null = null;
  private ring!: Phaser.GameObjects.Graphics;
  private hoverPill!: Phaser.GameObjects.Container;
  private surveyor!: Phaser.GameObjects.Image;
  private walker = { x: 0, y: 0 };
  /** The rival surveyor's sprite and where it has walked to. */
  private rivalSprite!: Phaser.GameObjects.Image;
  private rivalWalker = { x: 0, y: 0 };
  private popups: Popup[] = [];
  private sweep: Sweep | null = null;
  private header!: { isle: Phaser.GameObjects.Text; sheet: Phaser.GameObjects.Text };
  private panel!: {
    isle: Phaser.GameObjects.Text;
    atlas: Phaser.GameObjects.Text;
    atlasIcon: Phaser.GameObjects.Image;
    supplies: Phaser.GameObjects.Text;
    max: Phaser.GameObjects.Text;
    riddle: Phaser.GameObjects.Text;
    riddleTag: Phaser.GameObjects.Text;
    unused: Phaser.GameObjects.Text;
    coins: Phaser.GameObjects.Text;
    tiles: Phaser.GameObjects.Text;
    worth: Phaser.GameObjects.Text;
    order: Phaser.GameObjects.Text;
    commission: Phaser.GameObjects.Text;
    soFar: Phaser.GameObjects.Text;
    done: Phaser.GameObjects.Text;
    swatches: Phaser.GameObjects.Image[];
    isleLabel: Phaser.GameObjects.Text;
    pct: Phaser.GameObjects.Text;
    marks: Phaser.GameObjects.Text[];
    turnBack: Phaser.GameObjects.Text;
    tag: Phaser.GameObjects.Container;
    tagText: Phaser.GameObjects.Text;
    live: Phaser.GameObjects.Graphics;
  };
  private overlay: Phaser.GameObjects.Container | null = null;
  private overlayKey = '';
  private hover: { x: number; y: number } | null = null;
  private clock = 0;
  private lastFrame: number | null = null;
  /** The song part playing, from the phase, the isle kind and the rival. */
  private musicPart = '';
  /** Whether the sale that completed the Royal Atlas set a new best (a reload shows the best instead). */
  private newBest = false;

  constructor() {
    super('Game');
  }

  create(data?: { state?: GameState }) {
    this.paintedTiles = null;
    this.known = [];
    this.fading = [];
    this.names = [];
    this.hints.clear();
    this.freshAt.clear();
    this.popups = [];
    this.costLabels = [];
    this.marks.clear();
    this.campButton = null;
    this.campEnabled = null;
    this.sweep = null;
    this.overlay = null;
    this.overlayKey = '';
    this.musicPart = '';
    this.state = data?.state ?? loadGame() ?? newGame();
    // The sheet is laid out for 960x540; on a screen of another shape the camera centres it in the
    // view and the drafting table fills the rest.
    const frame = viewFrame(this);
    this.cameras.main.setScroll(-frame.x, -frame.y);

    this.drawSheet();
    this.terrainTex = this.canvasTexture('island-terrain');
    this.fogTex = this.canvasTexture('island-fog');
    this.add.image(MAP.x, MAP.y, 'island-terrain').setOrigin(0).setScale(1 / HI).setDepth(1);
    this.add.image(MAP.x, MAP.y, 'island-fog').setOrigin(0).setScale(1 / HI).setDepth(2);
    this.bakeVellum();
    this.drawNeatLine();
    this.glow = this.add.graphics().setDepth(4);
    this.ring = this.add.graphics().setDepth(5);
    const start = tileCentre(this.state.surveyor.x, this.state.surveyor.y);
    this.walker = { ...start };
    this.surveyor = this.add
      .image(start.x, start.y + MAP.tile * 0.3, 'surveyor')
      .setOrigin(SURVEYOR_ORIGIN.x, SURVEYOR_ORIGIN.y)
      .setScale(1 / HI)
      .setDepth(6);
    this.rivalSprite = this.add
      .image(start.x, start.y, 'rival')
      .setOrigin(SURVEYOR_ORIGIN.x, SURVEYOR_ORIGIN.y)
      .setScale(1 / HI)
      .setDepth(5.8)
      .setVisible(false);
    this.hoverPill = this.pill(0, 0, t('supplyCost', { n: 1 }), 64, 13, 7.5).setDepth(8).setVisible(false);
    this.createPanel();
    this.syncIsland();

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => (this.hover = this.tileAtScreen(p.worldX, p.worldY)));
    // A tap on a survey station surveys it, and a tap on charted ground digs there once the riddle is
    // known. Taps on a button or the overlay are theirs alone.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0) return;
      const at = this.tileAtScreen(p.worldX, p.worldY);
      if (!at) return;
      const s = this.state;
      const before = {
        surveyed: s.surveyed.length,
        known: !!s.riddle?.known,
        features: featuresDone(s).map((f) => f.name),
        rivalRuins: !!s.rival?.ruins,
        rivalTreasure: !!s.riddle?.rival,
      };
      const tile = s.tiles[indexOf(at.x, at.y)];
      const cost = costOf(s, at.x, at.y);
      const storms = survey(s, at.x, at.y);
      if (storms) {
        saveGame(s);
        const fresh = s.surveyed.slice(before.surveyed);
        // A pen stroke and a blip, lower for the dearer tiles and higher for the free ones.
        sfx('scratch');
        sfx('blip', { pitch: cost === 0 ? 1.26 : cost >= 2 ? 0.8 : 1 });
        this.announce(at, fresh);
        // One news sound a survey, the most important one (a lookout can turn up several).
        const news = [
          this.announceFinds(fresh, storms, before.known),
          this.announceFeatures(before.features),
          this.announceRival(before.rivalRuins, before.rivalTreasure),
        ].filter((n): n is News => n !== null);
        news.sort((a, b) => NEWS_ORDER.indexOf(a) - NEWS_ORDER.indexOf(b));
        if (news.length) playNews(news[0]);
        this.endedVoyage();
      } else if (dig(s, at.x, at.y)) {
        saveGame(s);
        const c = tileCentre(at.x, at.y);
        sfx('dig');
        if (s.riddle?.found) {
          sfx('treasure');
          this.notice(c.x, c.y - 14, t('treasureFound', { n: TREASURE_VALUE }), true);
        } else {
          sfx('thud');
          this.notice(c.x, c.y - 14, t('nothingHere'));
        }
        this.endedVoyage();
      } else if (s.phase === 'survey' && (!tile.revealed || (s.riddle?.known && !s.riddle.found))) {
        // A fogged tile out of reach or too dear, or ground that can't be dug.
        ui('refuse');
      }
    });
  }

  update(time: number) {
    const dt = this.lastFrame === null ? 0 : Math.min(time - this.lastFrame, MAX_STEP_MS);
    this.lastFrame = time;
    this.clock += dt;

    this.syncIsland();
    this.ageFades(dt);
    this.moveSurveyor(dt);
    this.moveRival(dt);
    this.drawGlow();
    this.syncMarks();
    this.agePopups(dt);
    this.ageSweep(dt);
    this.updatePanel();
    this.syncOverlay();
    this.syncMusic();
    checkTrophies(this.state);
  }

  /** Plays the part for where the voyage stands: the isle's own, the rival's, or the harbor's. */
  private syncMusic() {
    const s = this.state;
    const part = s.phase !== 'survey' ? 'harbor' : s.rival ? 'rival' : s.kind;
    if (part === this.musicPart) return;
    this.musicPart = part;
    playMusic(SONG, part);
  }

  /** The ship's horn when an action ended the voyage (the last supplies spent, or Return to port). */
  private endedVoyage() {
    if (this.state.phase === 'chart') sfx('horn');
  }

  // ---- Helpers.

  private text(x: number, y: number, s: string, o: TextOpts) {
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT,
      fontSize: `${o.size}px`,
      fontStyle: `${o.italic ? 'italic ' : ''}${o.weight ?? 600}`,
      color: o.color ?? INK,
      resolution: Math.max(2, renderScale),
    };
    if (o.stroke) {
      style.stroke = SHEET;
      style.strokeThickness = 3;
    }
    if (o.wrap) style.wordWrap = { width: o.wrap };
    const t = this.add.text(x, y, s, style);
    if (o.ls) t.setLetterSpacing(o.ls);
    return t;
  }

  /** A rounded magenta label with white type, centred on (x, y). */
  private pill(x: number, y: number, caption: string, w: number, h: number, size: number) {
    const g = this.add.graphics();
    g.fillStyle(hex(MAGENTA)).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    const t = this.text(0, 0, caption, { size, weight: 800, color: ON_MAGENTA }).setOrigin(0.5);
    return this.add.container(x, y, [g, t]);
  }

  /** A value chip: "+N" in magenta on white with a magenta rim, centred on (x, y). */
  private chip(x: number, y: number, caption: string) {
    const g = this.add.graphics();
    g.fillStyle(hex(SHEET)).fillRoundedRect(-8.5, -5.5, 17, 11, 3);
    g.lineStyle(0.75, hex(MAGENTA)).strokeRoundedRect(-8.5, -5.5, 17, 11, 3);
    const t = this.text(0, 0, caption, { size: 7, weight: 800, color: MAGENTA }).setOrigin(0.5);
    return this.add.container(x, y, [g, t]).setDepth(7);
  }

  private canvasTexture(key: string) {
    if (this.textures.exists(key)) this.textures.remove(key);
    return this.textures.createCanvas(key, (CANVAS.w * HI) / 2, (CANVAS.h * HI) / 2)!;
  }

  /** One tile of blank drafting paper, laid over a tile as it is charted and faded out. */
  private bakeVellum() {
    // Baked again in each theme's paper.
    if (this.textures.exists('vellum')) this.textures.remove('vellum');
    const c = document.createElement('canvas');
    c.width = c.height = MAP.tile * HI;
    const ctx = c.getContext('2d')!;
    // Drawn on a tile of TS, like the fog it matches.
    ctx.scale(HI / 2, HI / 2);
    ctx.fillStyle = VELLUM;
    ctx.fillRect(0, 0, TS, TS);
    ctx.strokeStyle = `rgba(${FOG_LINE},0.16)`;
    ctx.beginPath();
    for (let k = 0; k <= TS; k += 20) {
      ctx.moveTo(k + 0.5, 0);
      ctx.lineTo(k + 0.5, TS);
      ctx.moveTo(0, k + 0.5);
      ctx.lineTo(TS, k + 0.5);
    }
    ctx.stroke();
    this.textures.addCanvas('vellum', c);
  }

  private tileAtScreen(sx: number, sy: number) {
    const x = Math.floor((sx - MAP.x) / MAP.tile);
    const y = Math.floor((sy - MAP.y) / MAP.tile);
    return x >= 0 && y >= 0 && x < GRID.w && y < GRID.h ? { x, y } : null;
  }

  // ---- The sheet.

  /** The whole view in world coordinates: the designed 960x540 with the extra the screen's shape adds around it. */
  private viewRect() {
    const frame = viewFrame(this);
    const { width, height } = viewSize(this);
    return { x: -frame.x, y: -frame.y, w: width, h: height };
  }

  /** The drafting table, the survey sheet with its header, scale bar, north arrow and grid labels, and the panel card. */
  private drawSheet() {
    const g = this.add.graphics();
    const table = this.viewRect();
    g.fillStyle(hex(TABLE)).fillRect(table.x, table.y, table.w, table.h);
    g.lineStyle(1, hex(TABLE_LINE), 0.1);
    // The grid lines stay on the sheet's 12px pitch, out past its edges.
    const x0 = table.x - (((table.x % 12) + 12) % 12);
    const y0 = table.y - (((table.y % 12) + 12) % 12);
    for (let x = x0; x < table.x + table.w; x += 12) g.lineBetween(x + 0.5, table.y, x + 0.5, table.y + table.h);
    for (let y = y0; y < table.y + table.h; y += 12) g.lineBetween(table.x, y + 0.5, table.x + table.w, y + 0.5);
    for (const r of [SHEET_RECT, PANEL]) {
      for (let k = 1; k <= 4; k++) g.fillStyle(0x000000, 0.035).fillRect(r.x - k + 1, r.y - k + 3 + k, r.w + 2 * k - 2, r.h + 2 * k - 2);
    }
    g.fillStyle(hex(SHEET)).fillRect(SHEET_RECT.x, SHEET_RECT.y, SHEET_RECT.w, SHEET_RECT.h);
    g.fillStyle(hex(CARD)).fillRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h);
    g.fillStyle(hex(INK)).fillRect(PANEL.x, PANEL.y, PANEL.w, 4);

    const isle = this.text(24, 31, '', { size: 15, weight: 800, ls: 2 }).setOrigin(0, 0.5);
    const sheet = this.text(86, 32, '', { size: 9, weight: 600, color: SLATE, ls: 1 }).setOrigin(0, 0.5);
    this.header = { isle, sheet };
    // Scale bar: two tiles in half-tile steps.
    const sx = 500;
    for (let k = 0; k < 4; k++) g.fillStyle(k % 2 ? hex(SHEET) : hex(INK)).fillRect(sx + k * 20, 32.5, 20, 5);
    g.lineStyle(0.75, hex(INK)).strokeRect(sx, 32.5, 80, 5);
    this.text(sx, 25, '0', { size: 7, weight: 500 }).setOrigin(0.5);
    this.text(sx + 80, 25, t('scaleBar'), { size: 7, weight: 500 }).setOrigin(0.5);
    // North arrow.
    const nx = 609;
    const ny = 33;
    g.fillStyle(hex(INK)).fillTriangle(nx, ny - 13, nx + 5.5, ny + 6, nx, ny + 2);
    g.lineStyle(0.75, hex(INK)).strokeTriangle(nx, ny - 13, nx - 5.5, ny + 6, nx, ny + 2);
    this.text(nx, ny + 13, t('northArrow'), { size: 7, weight: 800 }).setOrigin(0.5);
    // Grid letters along the top and numbers down the side.
    for (let x = 0; x < GRID.w; x++) {
      this.text(MAP.x + (x + 0.5) * MAP.tile, MAP.y - 8, String.fromCharCode(65 + x), { size: 7, color: GREY }).setOrigin(0.5);
    }
    for (let y = 0; y < GRID.h; y++) {
      this.text(MAP.x - 9, MAP.y + (y + 0.5) * MAP.tile, String(y + 1), { size: 7, color: GREY }).setOrigin(0.5);
    }
  }

  /** The neat line round the map: a heavy inner rule and a fine outer one. */
  private drawNeatLine() {
    const g = this.add.graphics().setDepth(3);
    g.lineStyle(1.5, hex(INK)).strokeRect(MAP.x - 0.75, MAP.y - 0.75, MAP_W + 1.5, MAP_H + 1.5);
    g.lineStyle(0.5, hex(INK)).strokeRect(MAP.x - 4.25, MAP.y - 4.25, MAP_W + 8.5, MAP_H + 8.5);
  }

  /**
   * Keeps the island art in step with the state: paints a new island when the tiles change (a new
   * isle or a load), and repaints the fog when tiles are charted, fading their paper out.
   */
  private syncIsland() {
    const s = this.state;
    if (s.tiles !== this.paintedTiles) {
      this.paintedTiles = s.tiles;
      paintTerrain(this.terrainTex.context, s.tiles);
      this.terrainTex.refresh();
      for (const n of this.names) n.text.destroy();
      this.names = placeNames(s.tiles, s.island, s.port, s.features).map((n) => {
        const c = tileCentre(n.tile.x, n.tile.y);
        const style: TextOpts =
          n.kind === 'water'
            ? { size: 11, weight: 500, italic: true, ls: 3 }
            : n.kind === 'height' || n.kind === 'port'
              ? { size: 7.5, weight: n.kind === 'height' ? 600 : 500, italic: n.kind === 'port' }
              : n.kind === 'ruin'
                ? { size: 8, weight: 500, italic: true }
                : n.kind === 'river'
                  ? { size: 7.5, weight: 600, italic: true, ls: 1 }
                  : { size: n.kind === 'wood' ? 9 : 9.5, weight: 600, italic: true };
        const text = this.text(c.x + n.dx, c.y + n.dy, n.text, { ...style, color: nameColor(n.kind), stroke: true })
          .setOrigin(0.5)
          .setDepth(3);
        return { text, tile: n.tile };
      });
      for (const h of this.hints.values()) h.destroy();
      this.hints.clear();
      this.known = [];
    }
    const changed = s.tiles.some((t, i) => t.revealed !== this.known[i]);
    if (changed) {
      const first = this.known.length === 0;
      s.tiles.forEach((t, i) => {
        if (!t.revealed || this.known[i] || first) return;
        const x = i % GRID.w;
        const y = Math.floor(i / GRID.w);
        const img = this.add.image(MAP.x + x * MAP.tile, MAP.y + y * MAP.tile, 'vellum').setOrigin(0).setScale(1 / HI).setDepth(2);
        this.fading.push({ img, age: 0 });
        this.freshAt.set(i, this.clock);
      });
      this.known = s.tiles.map((t) => t.revealed);
      paintFog(this.fogTex.context, s.tiles);
      this.fogTex.refresh();
      for (const n of this.names) n.text.setVisible(s.tiles[indexOf(n.tile.x, n.tile.y)].revealed);
    }
    // With the Lodestone Compass, landmarks under the paper show a gold rose and a guess.
    s.tiles.forEach((tile, i) => {
      const hinted = !tile.revealed && isLandmark(tile.terrain) && rankOf(s, 'compass') > 0;
      const hint = this.hints.get(i);
      if (hinted && !hint) {
        const c = tileCentre(i % GRID.w, Math.floor(i / GRID.w));
        const star = this.add.image(0, 0, 'landmark-hint').setScale(1 / HI);
        const label = this.text(0, 17, t(tile.terrain === 'village' ? 'villageHint' : 'ruinsHint'), {
          size: 7.5,
          italic: true,
          color: GOLD_DARK,
          stroke: true,
        }).setOrigin(0.5);
        this.hints.set(i, this.add.container(c.x, c.y, [star, label]).setDepth(4));
      } else if (!hinted && hint) {
        hint.destroy();
        this.hints.delete(i);
      }
    });
  }

  private ageFades(dt: number) {
    for (const f of this.fading) {
      f.age += dt;
      f.img.setAlpha(Math.max(0, 1 - f.age / REVEAL_MS));
      if (f.age >= REVEAL_MS) f.img.destroy();
    }
    this.fading = this.fading.filter((f) => f.age < REVEAL_MS);
  }

  // ---- What a survey shows.

  /**
   * After a survey: a lookout (hills or a peak) that charted more than its own tile sweeps its sight
   * ring and gathers the values into one tally; any other tile floats its value up.
   */
  private announce(tapped: Point, fresh: Point[]) {
    const terrain = this.state.tiles[indexOf(tapped.x, tapped.y)].terrain;
    if ((terrain === 'hills' || terrain === 'mountain') && fresh.length > 1) {
      this.startSweep(tapped, fresh);
      return;
    }
    for (const p of fresh) {
      const v = TERRAIN[this.state.tiles[indexOf(p.x, p.y)].terrain].value;
      if (v <= 0) continue;
      const c = tileCentre(p.x, p.y);
      this.popups.push({ chip: this.chip(c.x, c.y - 4, `+${v}`), age: 0, life: POPUP_MS });
    }
  }

  /**
   * Notices for what the survey turned up: a wreck's stores, an artifact, a storm, the riddle chart.
   * The storms come from `survey` itself, since one that ends the voyage is already cleared from
   * the state by the time this runs.
   */
  private announceFinds(fresh: Point[], storms: { settled: Point[]; passed: Point[] }, knewRiddle: boolean): News | null {
    const s = this.state;
    let news: News | null = null;
    const heard = (n: News) => {
      if (news === null || NEWS_ORDER.indexOf(n) < NEWS_ORDER.indexOf(news)) news = n;
    };
    // Several notices from one survey (a lookout can turn up more than one find) stack upward.
    let n = 0;
    const say = (p: Point, caption: string, strong = false) => {
      const c = tileCentre(p.x, p.y);
      this.notice(c.x, c.y - 16 - 18 * n++, caption, strong);
    };
    for (const p of fresh) {
      const find = s.tiles[indexOf(p.x, p.y)].find;
      if (find === 'wreck') {
        say(p, t('wreckFound', { n: WRECK_SUPPLIES }), true);
        heard('wreck');
      }
      if (find === 'cave') {
        say(p, t('caveFound', { n: artifactValue(s) }), true);
        heard('cave');
      }
      if (find === 'storm' && storms.passed.some((q) => q.x === p.x && q.y === p.y)) say(p, t('stormOver'));
    }
    for (const st of storms.settled) {
      say(st, t('stormBlocks'));
      heard('storm');
    }
    if (!knewRiddle && s.riddle?.known) {
      say(fresh.find((p) => s.tiles[indexOf(p.x, p.y)].terrain === 'ruins')!, t('riddleFound'), true);
      heard('riddle');
    }
    return news;
  }

  /** A notice for each feature the survey charted whole: its name and bonus, over its middle tile. */
  private announceFeatures(doneBefore: string[]): News | null {
    const s = this.state;
    let n = 0;
    for (const f of featuresDone(s)) {
      if (doneBefore.includes(f.name)) continue;
      const mid = f.tiles[Math.floor(f.tiles.length / 2)];
      const c = tileCentre(mid.x, mid.y);
      this.notice(c.x, c.y - 16 - 18 * n++, t('chartedWhole', { name: t(f.name), n: f.bonus }), true);
    }
    return n > 0 ? 'feature' : null;
  }

  /** The rival's news: they have reached the ruins, or dug the treasure up first. */
  private announceRival(hadRuins: boolean, hadTreasure: boolean): News | null {
    const s = this.state;
    const r = s.rival;
    if (!r) return null;
    const c = tileCentre(r.at.x, r.at.y);
    if (!hadTreasure && s.riddle?.rival) this.notice(c.x, c.y - 30, t('rivalDug'));
    else if (!hadRuins && r.ruins) this.notice(c.x, c.y - 30, t('rivalRead'));
    else return null;
    return 'rival';
  }

  /** A notice on the map: a magenta pill (or a white one with magenta type) that floats up and fades. */
  private notice(x: number, y: number, caption: string, strong = false) {
    const t = this.text(0, 0, caption, { size: 8.5, weight: 800, color: strong ? ON_MAGENTA : MAGENTA }).setOrigin(0.5);
    const w = t.width + 14;
    const g = this.add.graphics();
    g.fillStyle(strong ? hex(MAGENTA) : hex(SHEET)).fillRoundedRect(-w / 2, -8, w, 16, 8);
    if (!strong) g.lineStyle(1, hex(MAGENTA)).strokeRoundedRect(-w / 2, -8, w, 16, 8);
    const cx = Phaser.Math.Clamp(x, MAP.x + w / 2 + 2, MAP.x + MAP_W - w / 2 - 2);
    const chip = this.add.container(cx, Math.max(MAP.y + 10, y), [g, t]).setDepth(9);
    this.popups.push({ chip, age: 0, life: NOTICE_MS });
  }

  private agePopups(dt: number) {
    for (const p of this.popups) {
      p.age += dt;
      if (!settings.reduceMotion) p.chip.y -= (dt / p.life) * 12;
      p.chip.setAlpha(Math.max(0, Math.min(1, 2 - (2 * p.age) / p.life)));
      if (p.age >= p.life) p.chip.destroy();
    }
    this.popups = this.popups.filter((p) => p.age < p.life);
  }

  private startSweep(tapped: Point, fresh: Point[]) {
    this.endSweep();
    const s = this.state;
    const centre = tileCentre(tapped.x, tapped.y);
    const tiles = fresh.map((p) => {
      const c = tileCentre(p.x, p.y);
      const value = TERRAIN[s.tiles[indexOf(p.x, p.y)].terrain].value;
      const chip = this.chip(c.x + 11.5, c.y - 9.5, `+${value}`).setAlpha(0);
      return { p: c, dist: Math.hypot(c.x - centre.x, c.y - centre.y), value, chip, heard: false };
    });
    const radius = Math.max(...tiles.map((t) => t.dist)) + MAP.tile * 0.55;
    const total = valueOf(s, fresh);
    // The tally sits above the ring, or below it near the top of the sheet.
    let ty = centre.y - radius - 24;
    const below = ty - 14 < MAP.y + 2;
    if (below) ty = Math.min(centre.y + radius + 24, MAP.y + MAP_H - 16);
    const tx = Phaser.Math.Clamp(centre.x + 5, MAP.x + 82, MAP.x + MAP_W - 82);
    const g = this.add.graphics();
    g.fillStyle(hex(MAGENTA)).fillRoundedRect(-80, -13.5, 160, 27, 4);
    const label = this.text(-71, 0, t('viewshed'), { size: 8, weight: 800, color: ON_MAGENTA_SOFT, ls: 1.5 }).setOrigin(0, 0.5);
    // The count follows the label, which runs longer in some languages.
    const count = this.text(Math.max(-11, label.x + label.width + 6), 0, t('tiles', { n: fresh.length }), { size: 10, weight: 600, color: ON_MAGENTA }).setOrigin(0, 0.5);
    const sum = this.text(71, 0, '+0', { size: 15, weight: 900, color: ON_MAGENTA }).setOrigin(1, 0.5);
    const tally = this.add.container(tx, ty, [g, label, count, sum]).setDepth(7).setAlpha(0);
    this.sweep = { age: 0, centre, radius, tiles, total, tally, tallyCount: sum, tallyAt: { x: tx, y: ty }, below, tallied: false };
    if (!settings.reduceMotion) sfx('sweep');
  }

  private endSweep() {
    if (!this.sweep) return;
    for (const t of this.sweep.tiles) t.chip.destroy();
    this.sweep.tally.destroy();
    this.sweep = null;
    this.ring.clear();
  }

  /** Plays the viewshed: ring out, chips in, values gathered into the tally, then a fade. */
  private ageSweep(dt: number) {
    const sw = this.sweep;
    if (!sw) return;
    sw.age += dt;
    const still = settings.reduceMotion;
    const age = sw.age;
    const fade = age < HOLD_MS ? 1 : Math.max(0, 1 - (age - HOLD_MS) / FADE_MS);
    if (fade <= 0) {
      this.endSweep();
      return;
    }
    const grow = still ? 1 : 1 - Math.pow(1 - Math.min(1, age / RING_MS), 3);
    const r = sw.radius * grow;
    const g = this.ring.clear();
    g.fillStyle(hex(MAGENTA), 0.07 * fade).fillCircle(sw.centre.x, sw.centre.y, r);
    // A dotted ring.
    const dots = Math.max(8, Math.floor((Math.PI * 2 * r) / 4.5));
    g.fillStyle(hex(MAGENTA), fade);
    for (let k = 0; k < dots; k++) {
      const a = (k / dots) * Math.PI * 2;
      g.fillCircle(sw.centre.x + Math.cos(a) * r, sw.centre.y + Math.sin(a) * r, 0.9);
    }
    const tallyOn = still || age >= GATHER_AT;
    if (tallyOn) {
      sw.tally.setAlpha(fade);
      const edge = sw.below ? sw.tallyAt.y - 13.5 : sw.tallyAt.y + 13.5;
      const ringEdge = sw.below ? sw.centre.y + r : sw.centre.y - r;
      g.lineStyle(1, hex(MAGENTA), fade).lineBetween(sw.centre.x, edge, sw.centre.x, ringEdge);
    }
    let gathered = 0;
    sw.tiles.forEach((tile, n) => {
      const reached = r >= tile.dist;
      // A tick as the ring passes each tile (the sound's own gap thins a crowd of them).
      if (reached && !tile.heard && !still) {
        tile.heard = true;
        sfx('tick', { pitch: 1 + n * 0.03 });
      }
      if (reached) g.fillStyle(hex(MAGENTA), fade).fillCircle(tile.p.x, tile.p.y, 1.75);
      const home = { x: tile.p.x + 11.5, y: tile.p.y - 9.5 };
      if (still) {
        tile.chip.setAlpha(fade);
        gathered += tile.value;
        return;
      }
      // Each chip leaves for the tally a little after the one before it.
      const leave = GATHER_AT + n * 40;
      const k = Math.min(1, Math.max(0, (age - leave) / GATHER_MS));
      if (k >= 1) {
        tile.chip.setAlpha(0);
        gathered += tile.value;
        return;
      }
      const e = k * k * (3 - 2 * k);
      gathered += tile.value * e;
      tile.chip.setPosition(home.x + (sw.tallyAt.x + 50 - home.x) * e, home.y + (sw.tallyAt.y - home.y) * e);
      tile.chip.setAlpha(reached ? 1 - k * 0.6 : 0);
    });
    const added = still || age > GATHER_AT + sw.tiles.length * 40 + GATHER_MS;
    if (added && !sw.tallied) {
      sw.tallied = true;
      sfx('tally');
    }
    const shown = added ? sw.total : gathered;
    const caption = `+${Math.round(shown)}`;
    if (sw.tallyCount.text !== caption) sw.tallyCount.setText(caption);
  }

  // ---- The surveyor and the survey stations.

  private moveSurveyor(dt: number) {
    const target = tileCentre(this.state.surveyor.x, this.state.surveyor.y);
    const dx = target.x - this.walker.x;
    const dy = target.y - this.walker.y;
    const d = Math.hypot(dx, dy);
    const step = (WALK_SPEED * dt) / 1000;
    if (d <= step || d > MAP.tile * 6) {
      // Arrived, or sailed home to the port: stand on the tile.
      this.walker = { ...target };
    } else {
      this.walker.x += (dx / d) * step;
      this.walker.y += (dy / d) * step;
    }
    const walking = d > step && d <= MAP.tile * 6;
    this.surveyor.setTexture(walking && Math.floor(this.clock / 140) % 2 === 1 ? 'surveyor-step' : 'surveyor');
    if (dx !== 0 && walking) this.surveyor.setFlipX(dx < 0);
    this.surveyor.setPosition(this.walker.x, this.walker.y + MAP.tile * 0.3);
    this.surveyor.setVisible(this.state.phase === 'survey');
  }

  /** The rival walks the same way, and is only seen while they are on the isle. */
  private moveRival(dt: number) {
    const r = this.state.rival;
    this.rivalSprite.setVisible(!!r);
    if (!r) return;
    const target = tileCentre(r.at.x, r.at.y);
    const dx = target.x - this.rivalWalker.x;
    const dy = target.y - this.rivalWalker.y;
    const d = Math.hypot(dx, dy);
    const step = (WALK_SPEED * dt) / 1000;
    if (d <= step || d > MAP.tile * 6) this.rivalWalker = { ...target };
    else {
      this.rivalWalker.x += (dx / d) * step;
      this.rivalWalker.y += (dy / d) * step;
    }
    const walking = d > step && d <= MAP.tile * 6;
    this.rivalSprite.setTexture(walking && Math.floor(this.clock / 140) % 2 === 1 ? 'rival-step' : 'rival');
    if (dx !== 0 && walking) this.rivalSprite.setFlipX(dx < 0);
    this.rivalSprite.setPosition(this.rivalWalker.x, this.rivalWalker.y + MAP.tile * 0.3);
  }

  /**
   * Marks every tile that can be surveyed as a magenta survey station with its cost under it (grey
   * when the supplies can't pay it); the one under the pointer is lit with a pill. Once the riddle is
   * known, charted ground under the pointer shows where a dig would go.
   */
  private drawGlow() {
    const g = this.glow.clear();
    const s = this.state;
    this.hoverPill.setVisible(false);
    let used = 0;
    if (s.phase === 'survey') {
      const pulse = settings.reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin(this.clock / 300);
      for (const p of frontier(s)) {
        const can = canAfford(s, p);
        const m = can ? hex(MAGENTA) : hex(GREY);
        const x = MAP.x + p.x * MAP.tile + 3;
        const y = MAP.y + p.y * MAP.tile + 3;
        const w = MAP.tile - 6;
        const lit = can && this.hover?.x === p.x && this.hover?.y === p.y;
        g.fillStyle(m, lit ? 0.16 : can ? 0.04 + 0.05 * pulse : 0.05).fillRect(x, y, w, w);
        if (lit) {
          g.lineStyle(1.75, m).strokeRect(x, y, w, w);
        } else {
          g.lineStyle(1, m, can ? 1 : 0.6);
          dashedRect(g, x, y, w, w, 5, 3);
        }
        const c = tileCentre(p.x, p.y);
        const cy = c.y - 3;
        g.fillStyle(lit ? m : hex(SHEET)).fillTriangle(c.x, cy - 5, c.x + 5, cy + 3.5, c.x - 5, cy + 3.5);
        g.lineStyle(1, m).strokeTriangle(c.x, cy - 5, c.x + 5, cy + 3.5, c.x - 5, cy + 3.5);
        g.fillStyle(lit ? hex(ON_MAGENTA) : m).fillCircle(c.x, cy + 0.75, 1);
        const cost = costOf(s, p.x, p.y);
        if (!lit && cost !== 1) {
          const label = this.costLabel(used++);
          const caption = cost === 0 ? t('free') : `−${cost}`;
          if (label.text !== caption) label.setText(caption);
          label.setPosition(c.x, c.y + 10).setColor(can ? MAGENTA : GREY).setVisible(true);
        }
        if (lit) {
          const f = featureAt(s, p.x, p.y);
          const price = cost === 0 ? t('freeToFollow') : t('supplyCost', { n: cost });
          this.showPill(c, f ? t('finishes', { price, name: t(f.name), n: f.bonus }) : price);
        }
      }
      const h = this.hover;
      if (h && diggable(s).some((p) => p.x === h.x && p.y === h.y)) {
        const c = tileCentre(h.x, h.y);
        g.lineStyle(1.25, hex(MAGENTA));
        dashedRect(g, c.x - 12, c.y - 12, 24, 24, 3, 3);
        this.showPill(c, t('digHere', { n: DIG_COST }));
      }
    }
    for (let k = used; k < this.costLabels.length; k++) this.costLabels[k].setVisible(false);
  }

  private showPill(c: Spot, caption: string) {
    const label = this.hoverPill.list[1] as Phaser.GameObjects.Text;
    if (label.text !== caption) {
      label.setText(caption);
      const w = label.width + 12;
      (this.hoverPill.list[0] as Phaser.GameObjects.Graphics).clear().fillStyle(hex(MAGENTA)).fillRoundedRect(-w / 2, -6.5, w, 13, 6.5);
    }
    this.hoverPill.setPosition(c.x, c.y + 15.5).setVisible(true);
  }

  private costLabel(k: number) {
    while (this.costLabels.length <= k) {
      this.costLabels.push(this.text(0, 0, '', { size: 6.5, weight: 800, color: MAGENTA, ls: 0.5 }).setOrigin(0.5).setDepth(4));
    }
    return this.costLabels[k];
  }

  /**
   * Keeps the map's marks in step with the state: wrecks and caves on charted tiles, storms on the
   * tiles they block, base camps, dug tiles and the treasure once found.
   */
  private syncMarks() {
    const s = this.state;
    const want = new Map<string, { key: string; x: number; y: number; scale: number }>();
    const at = (p: Point, dx: number, dy: number) => ({ x: tileCentre(p.x, p.y).x + dx, y: tileCentre(p.x, p.y).y + dy });
    s.tiles.forEach((t, i) => {
      if (!t.revealed || (t.find !== 'wreck' && t.find !== 'cave')) return;
      const c = at({ x: i % GRID.w, y: Math.floor(i / GRID.w) }, -11, -11);
      want.set(`${t.find}:${i}`, { key: `find-${t.find}`, ...c, scale: 0.75 });
    });
    if (s.phase === 'survey') {
      for (const p of s.storms) if (!s.tiles[indexOf(p.x, p.y)].revealed) want.set(`storm:${indexOf(p.x, p.y)}`, { key: 'storm', ...at(p, 0, 0), scale: 1.2 });
    }
    for (const p of s.dug) want.set(`dug:${indexOf(p.x, p.y)}`, { key: 'dug', ...at(p, 0, 6), scale: 0.9 });
    // The treasure chest marks the player's own find; the rival's leaves a dug tile, once charted.
    const r = s.riddle;
    if (r?.found && !r.rival) want.set(`treasure`, { key: 'treasure', ...at(r.at, 0, 4), scale: 0.9 });
    else if (r?.rival && s.tiles[indexOf(r.at.x, r.at.y)].revealed) want.set(`dug:${indexOf(r.at.x, r.at.y)}`, { key: 'dug', ...at(r.at, 0, 6), scale: 0.9 });
    for (const p of s.camps) want.set(`camp:${indexOf(p.x, p.y)}`, { key: 'camp', ...at(p, 9, -9), scale: 1 });
    // The rival's claims show through the paper, so you know which tiles will sell for half.
    for (const p of s.rival?.claims ?? []) want.set(`claim:${indexOf(p.x, p.y)}`, { key: 'claim', ...at(p, 11, -10), scale: 0.8 });
    for (const [id, img] of this.marks) {
      if (want.has(id)) continue;
      img.destroy();
      this.marks.delete(id);
    }
    for (const [id, m] of want) {
      if (this.marks.has(id)) continue;
      this.marks.set(id, this.add.image(m.x, m.y, m.key).setScale(m.scale / HI).setDepth(m.key === 'camp' || m.key === 'claim' ? 5.5 : 3.5));
    }
  }

  // ---- The panel.

  private createPanel() {
    const label = (x: number, y: number, s: string) => this.text(x, y, s, { size: 8.5, weight: 700, color: GREY, ls: 1.5 }).setOrigin(0, 0.5);
    const g = this.add.graphics();
    const rule = (y: number) => g.fillStyle(hex(RULE)).fillRect(PL, y, PR - PL, 1);
    this.text(PL, 50, t('title'), { size: 24, weight: 900, ls: 1 }).setOrigin(0, 0.5);
    this.add.image(PR - 9, 50, 'logo').setScale(1 / HI);
    this.makeThemeButton();
    const isle = this.text(PL, 72, '', { size: 9, weight: 700, color: GREY, ls: 1.5 }).setOrigin(0, 0.5);
    const atlas = this.text(PR, 72, '', { size: 8.5, weight: 700, color: GREY, ls: 1 }).setOrigin(1, 0.5);
    const atlasIcon = this.add.image(PR - 60, 72, 'atlas-empty').setScale(1 / HI);
    rule(85);
    label(PL, 99, t('supplies'));
    const supplies = this.text(PL, 120, '', { size: 22, weight: 800 }).setOrigin(0, 0.5);
    const max = this.text(PL + 15, 123, '', { size: 12, weight: 600, color: GREY }).setOrigin(0, 0.5);
    const unused = this.text(PL + 55, 143, t('unusedEach', { n: SELL_BACK }), { size: 8, weight: 600, color: MAGENTA }).setOrigin(0, 0.5);
    rule(154);
    label(PL, 167, t('coinsHead'));
    const coinTotal = this.text(PL, 187, '', { size: 22, weight: 800 }).setOrigin(0, 0.5);
    label(PL + 95, 167, t('thisChart'));
    const tiles = this.text(PL + 95, 184, '', { size: 13, weight: 700 }).setOrigin(0, 0.5);
    const worth = this.text(PL + 95, 199, '', { size: 11, weight: 600, color: SLATE }).setOrigin(0, 0.5);
    rule(212);
    // The commission: a work order.
    const bw = PR - PL;
    g.lineStyle(1, hex(INK)).strokeRect(PL, 220, bw, 72);
    g.fillStyle(hex(INK)).fillRect(PL, 220, bw, 18);
    this.text(PL + 9, 229, t('commissionHead'), { size: 8.5, weight: 800, color: ON_INK, ls: 2 }).setOrigin(0, 0.5);
    const order = this.text(PR - 9, 229, '', { size: 7.5, weight: 600, color: ON_INK_SOFT, ls: 1 }).setOrigin(1, 0.5);
    const commission = this.text(PL + 9, 251, '', { size: 11.5, weight: 600 }).setOrigin(0, 0.5);
    const swatches = [0, 1, 2, 3].map((k) => this.add.image(PL + 16.5 + k * 19, 274, 'swatch-forest').setScale(0.94 / HI));
    const soFar = this.text(PL + 70, 274, '', { size: 12, weight: 700 }).setOrigin(0, 0.5);
    const done = this.text(PR - 51, 274, t('done'), { size: 12, weight: 800, color: GREEN }).setOrigin(0, 0.5);
    // The riddle chart.
    g.lineStyle(1, hex(INK)).strokeRect(PL, 300, bw, 62);
    g.fillStyle(hex(MAGENTA)).fillRect(PL, 300, bw, 18);
    this.add.image(PL + 10, 309, 'riddle').setScale(0.62 / HI);
    this.text(PL + 21, 309, t('riddleHead'), { size: 8.5, weight: 800, color: ON_MAGENTA, ls: 2 }).setOrigin(0, 0.5);
    const riddleTag = this.text(PR - 9, 309, '', { size: 7.5, weight: 700, color: ON_MAGENTA_SOFT, ls: 1 }).setOrigin(1, 0.5);
    const riddle = this.text(PL + 9, 323, '', { size: 10.5, weight: 600, wrap: bw - 18 });
    // The isle goal.
    const isleLabel = label(PL, 377, '');
    const pct = this.text(PR, 378, '', { size: 17, weight: 800 }).setOrigin(1, 0.5);
    const marks = MILESTONES.map((m) =>
      this.text(PL + (bw * m.pct) / 100, 411, m.atlas ? t('atlasPage') : `+${coins(m.coins)}`, { size: 8.5, weight: 700, color: MAGENTA }).setOrigin(
        m.pct === 100 ? 1 : 0.5,
        0.5,
      ),
    );
    rule(423);
    const turnBack = this.text(PANEL.x + PANEL.w / 2, 439, '', { size: 9, weight: 600, color: SLATE }).setOrigin(0.5);
    makeButton(
      this,
      RETURN_BUTTON.x,
      RETURN_BUTTON.y,
      t('returnToPort'),
      () => {
        if (returnToPort(this.state)) {
          saveGame(this.state);
          this.endedVoyage();
        } else ui('refuse');
      },
      RETURN_BUTTON,
    );
    // The sell-back tag sits on the button's top-right corner, like a badge.
    const tag = this.pill(RETURN_BUTTON.x + RETURN_BUTTON.w / 2 - 22, RETURN_BUTTON.y - RETURN_BUTTON.h / 2, '', 44, 18, 10.5);
    const tagText = tag.list[1] as Phaser.GameObjects.Text;
    this.spots.return = { x: RETURN_BUTTON.x, y: RETURN_BUTTON.y };
    this.spots.camp = { x: CAMP_BUTTON.x, y: CAMP_BUTTON.y };
    const live = this.add.graphics();
    this.panel = {
      isle,
      atlas,
      atlasIcon,
      supplies,
      max,
      riddle,
      riddleTag,
      unused,
      coins: coinTotal,
      tiles,
      worth,
      order,
      commission,
      soFar,
      done,
      swatches,
      isleLabel,
      pct,
      marks,
      turnBack,
      tag,
      tagText,
      live,
    };
  }

  /**
   * The theme switch: a moon on the white sheet, a sun on the night sheet. A tap saves the other
   * theme and goes back to the boot scene, which bakes the art in its colours and redraws the game.
   * It sits above the overlays' dim, so it works at the port and the harbor too.
   */
  private makeThemeButton() {
    const { x, y, size } = THEME_BUTTON;
    const g = this.add.graphics();
    const draw = (lit: boolean) => {
      g.clear();
      g.fillStyle(hex(lit ? TRACK : CARD)).fillRoundedRect(-size / 2, -size / 2, size, size, 4);
      g.lineStyle(1, hex(RULE)).strokeRoundedRect(-size / 2, -size / 2, size, size, 4);
      g.fillStyle(hex(INK));
      if (theme === 'dark') {
        g.fillCircle(0, 0, 3.6);
        g.lineStyle(1.4, hex(INK));
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4;
          g.lineBetween(Math.cos(a) * 5.6, Math.sin(a) * 5.6, Math.cos(a) * 7.4, Math.sin(a) * 7.4);
        }
      } else {
        g.fillCircle(0, 0, 6);
        g.fillStyle(hex(lit ? TRACK : CARD)).fillCircle(3.2, -2.6, 5.2);
      }
    };
    draw(false);
    const hit = this.add.rectangle(0, 0, size, size).setInteractive({ useHandCursor: true });
    hit
      .on('pointerover', () => draw(true))
      .on('pointerout', () => draw(false))
      .on('pointerdown', () => {
        ui('click');
        const next = theme === 'dark' ? 'light' : 'dark';
        saveTheme(next);
        // The running game and the new theme are handed along, so the restart never falls back to
        // an older save (or a new game) or the old theme when storage is blocked or full.
        this.scene.start('Boot', { state: this.state, theme: next });
      });
    this.add.container(x, y, [g, hit]).setDepth(UI_DEPTH + 1);
    this.spots.theme = { x, y };
  }

  /** The Camp button, rebuilt when it turns on or off. */
  private syncCampButton() {
    const on = canCamp(this.state);
    if (on === this.campEnabled) return;
    this.campEnabled = on;
    this.campButton?.destroy();
    this.campButton = makeButton(
      this,
      CAMP_BUTTON.x,
      CAMP_BUTTON.y,
      t('camp', { n: CAMP_COST }),
      () => {
        if (!pitchCamp(this.state)) return ui('refuse');
        saveGame(this.state);
        sfx('flap');
        sfx('peg');
        this.endedVoyage();
      },
      CAMP_BUTTON,
      on,
    );
  }

  private updatePanel() {
    const s = this.state;
    const p = this.panel;
    const max = maxSupplies(s);
    const set = (text: Phaser.GameObjects.Text, v: string) => text.text !== v && text.setText(v);
    set(this.header.isle, t('isleHead', { n: s.island }));
    this.header.sheet.setX(24 + this.header.isle.width + 14);
    const aboard = s.hand ? t('aboard', { hand: t(HANDS[s.hand].name).toUpperCase() }) : '';
    set(this.header.sheet, t('sheetHead', { kind: t(KINDS[s.kind].name).toUpperCase(), sheet: s.voyage - s.isleStart + 1, aboard }));
    set(p.isle, t('panelIsle', { island: s.island, voyage: s.voyage }));
    const pages = s.atlas.length;
    set(p.atlas, t('atlasCount', { n: pages }));
    p.atlas.setColor(pages ? INK : GREY);
    p.atlasIcon.setTexture(pages ? `atlas-${s.atlas[pages - 1].kind}` : 'atlas-empty').setX(PR - p.atlas.width - 10);
    set(p.supplies, `${s.supplies}`);
    set(p.max, `/ ${max}`);
    p.max.setX(PL + p.supplies.width + 3);
    set(p.coins, formatNumber(s.coins));
    const chart = s.chart ?? chartOf(s);
    set(p.tiles, t('tiles', { n: s.surveyed.length }));
    set(p.worth, t('worth', { n: chart.base - chart.rivalLoss + chart.ink + chart.featureCoins + chart.artifactCoins + chart.treasure }));

    const g = p.live.clear();
    // Supply pips, with the unused ones bracketed in magenta while they can still sell back. A
    // wreck's stores can take the supplies past the most a voyage starts with.
    const pips = Math.max(max, s.supplies);
    const pipX = PL + 55;
    const pitch = (PR - pipX + 3) / pips;
    const pw = Math.max(2, pitch - 3);
    for (let k = 0; k < pips; k++) g.fillStyle(k < s.supplies ? hex(k < max ? INK : MAGENTA) : hex(TRACK)).fillRect(pipX + k * pitch, 113, pw, 15);
    const selling = s.phase === 'survey' && s.supplies > 0;
    p.unused.setVisible(selling);
    if (selling) {
      const end = pipX + (s.supplies - 1) * pitch + pw;
      g.lineStyle(1, hex(MAGENTA));
      g.beginPath();
      g.moveTo(pipX, 131);
      g.lineTo(pipX, 135);
      g.lineTo(end, 135);
      g.lineTo(end, 131);
      g.strokePath();
    }
    // The live chart: every charted tile, the newest inked in magenta.
    const cs = 3;
    const ox = PR - GRID.w * cs;
    const oy = 166;
    g.fillStyle(hex(VELLUM)).fillRect(ox - 2, oy - 2, GRID.w * cs + 4, GRID.h * cs + 4);
    s.tiles.forEach((t, i) => {
      if (!t.revealed) return;
      const born = this.freshAt.get(i);
      const fresh = born !== undefined && this.clock - born < FRESH_MS;
      if (born !== undefined && !fresh) this.freshAt.delete(i);
      g.fillStyle(hex(fresh ? MAGENTA : tintOf(t.terrain))).fillRect(ox + (i % GRID.w) * cs, oy + Math.floor(i / GRID.w) * cs, cs, cs);
    });
    g.lineStyle(0.75, hex(INK)).strokeRect(ox - 2, oy - 2, GRID.w * cs + 4, GRID.h * cs + 4);

    // The commission.
    const c = s.commission;
    set(p.order, t('workOrder', { n: String(s.voyage).padStart(2, '0') }));
    if (c) {
      const have = Math.min(c.done + (chart.counts[c.terrain] ?? 0), c.need);
      set(p.commission, commissionText(c));
      // Up to four tiles are shown as swatches; a long commission counts in words.
      const pips = c.need <= p.swatches.length;
      p.swatches.forEach((img, k) => {
        img.setVisible(pips && k < c.need);
        if (img.texture.key !== `swatch-${c.terrain}`) img.setTexture(`swatch-${c.terrain}`);
        img.setAlpha(k < have ? 1 : 0.28);
      });
      const left = c.voyages > 1 ? ` · ${voyagesLeft(c)}` : '';
      set(p.soFar, t('soFar', { have, need: c.need }) + left);
      p.soFar.setX(pips ? PL + 9 + c.need * 19 + 6 : PL + 9).setVisible(true);
      const met = have >= c.need;
      p.done.setVisible(met);
      if (met) {
        const bx = PR - 70;
        g.lineStyle(1.5, hex(GREEN)).strokeRect(bx, 267.5, 13, 13);
        g.beginPath();
        g.moveTo(bx + 2.5, 274);
        g.lineTo(bx + 5.5, 277.5);
        g.lineTo(bx + 11, 270);
        g.strokePath();
      }
    } else {
      set(p.commission, t('noCommission'));
      p.swatches.forEach((img) => img.setVisible(false));
      p.soFar.setVisible(false);
      p.done.setVisible(false);
    }

    // The riddle chart: hidden in the ruins, then its clues, then the treasure.
    const r = s.riddle;
    const riddle = !r
      ? t('noRiddle')
      : r.found && r.rival
        ? t('rivalDugRiddle')
        : r.found
          ? t(s.treasure ? 'treasureOnChart' : 'treasureSold', { n: TREASURE_VALUE })
        : r.known
          ? t('riddleQuote', { clues: r.clues.map(clueText).join(', ') })
          : t('riddleHidden');
    set(p.riddle, riddle);
    p.riddle.setColor(r?.known && !r.found ? INK : r?.found && !r.rival ? GREEN : SLATE).setFontStyle(r?.known && !r.found ? 'italic 600' : '600');
    set(p.riddleTag, r?.known && !r.found ? t('digTag', { n: DIG_COST }) : '');

    // The isle goal: the share charted, with its milestones.
    const { pct } = isleProgress(s);
    set(p.isleLabel, t('isleSurveyed', { n: s.island }));
    set(p.pct, t('percent', { n: pct }));
    const bw = PR - PL;
    const by = 389;
    g.fillStyle(hex(TRACK)).fillRect(PL, by, bw, 8);
    g.fillStyle(hex(BLUE)).fillRect(PL, by, (bw * pct) / 100, 8);
    for (let k = 0; k <= 20; k++) g.fillStyle(hex(INK)).fillRect(PL + (bw * k) / 20 - 0.25, by + 8, 0.5, k % 5 ? 2.5 : 4.5);
    const due = milestonesDue(s).length;
    MILESTONES.forEach((m, k) => {
      const mx = PL + (bw * m.pct) / 100;
      const paid = k < s.milestones;
      const reached = !paid && k < s.milestones + due;
      const col = paid ? hex(GREY) : reached ? hex(INK) : hex(MAGENTA);
      g.fillStyle(col).fillTriangle(mx, by - 1, mx - 4, by - 7, mx + 4, by - 7);
      const caption = (m.atlas ? t('atlasPage') : `+${coins(m.coins)}`) + (paid ? ' ✓' : '');
      // Reached on this voyage: paid with the chart, so it prints in ink until then.
      set(p.marks[k], caption);
      p.marks[k].setColor(paid ? GREY : reached ? INK : MAGENTA);
      p.marks[k].setOrigin(m.pct === 100 ? 1 : 0.5, 0.5);
    });
    // Keep the two right-hand labels apart once they carry ticks.
    const [, second, last] = p.marks;
    const room = last.x - last.width - 6;
    second.setX(Math.min(PL + (bw * MILESTONES[1].pct) / 100, room - second.width / 2));

    // Turning back early: what the unused supplies would sell back for now.
    const back = s.phase === 'survey' ? chart.sellBack : 0;
    const capped = s.phase === 'survey' && back < s.supplies * SELL_BACK;
    p.tag.setVisible(back > 0);
    set(p.tagText, `+${coins(back)}`);
    set(
      p.turnBack,
      s.phase !== 'survey' || s.supplies === 0
        ? ''
        : back === 0
          ? t('sellBackNone', { each: SELL_BACK })
          : capped
          ? t('sellBackCapped', { n: s.supplies, each: SELL_BACK, worth: chart.base - chart.rivalLoss })
          : t('sellBack', { n: s.supplies, each: SELL_BACK }),
    );
    this.syncCampButton();
  }

  // ---- Overlays.

  /** Rebuilds the chart or harbor overlay when what it shows changes. */
  private syncOverlay() {
    const s = this.state;
    const pick = s.board.findIndex((_, n) => isPicked(s, n));
    const key = s.phase === 'survey' ? '' : `${s.phase}:${s.coins}:${JSON.stringify(s.ranks)}:${s.hand}:${pick}`;
    if (key === this.overlayKey) return;
    this.overlayKey = key;
    this.overlay?.destroy();
    this.overlay = null;
    for (const name of Object.keys(this.spots)) if (!['return', 'camp', 'theme'].includes(name)) delete this.spots[name];
    if (s.phase === 'chart') this.showChart();
    if (s.phase === 'atlas') this.showAtlas();
    if (s.phase === 'harbor') this.showHarbor();
  }

  private overlayBase(title: string) {
    const c = this.add.container(0, 0).setDepth(UI_DEPTH);
    // The dim covers the whole screen and swallows taps, so the map can't be surveyed behind it.
    const view = this.viewRect();
    const dim = this.add.rectangle(view.x, view.y, view.w, view.h, hex(DIM), DIM_ALPHA).setOrigin(0).setInteractive();
    const left = OVERLAY.x - OVERLAY.w / 2;
    const top = OVERLAY.y - OVERLAY.h / 2;
    const g = this.add.graphics();
    for (let k = 1; k <= 4; k++) g.fillStyle(0x000000, 0.05).fillRect(left - k, top + 2, OVERLAY.w + 2 * k, OVERLAY.h + 2 * k);
    g.fillStyle(hex(CARD)).fillRect(left, top, OVERLAY.w, OVERLAY.h);
    g.fillStyle(hex(INK)).fillRect(left, top, OVERLAY.w, 4);
    g.fillStyle(hex(RULE)).fillRect(left + 24, top + 44, OVERLAY.w - 48, 1);
    const heading = this.text(left + 24, top + 26, title.toUpperCase(), { size: 14, weight: 800, ls: 2 }).setOrigin(0, 0.5);
    const logo = this.add.image(left + OVERLAY.w - 33, top + 26, 'logo').setScale(1 / HI);
    c.add([dim, g, heading, logo]);
    this.overlay = c;
    return c;
  }

  private showChart() {
    const s = this.state;
    const chart = s.chart!;
    const c = this.overlayBase(t('chartTitle', { island: s.island, voyage: s.voyage }));
    const top = OVERLAY.y - OVERLAY.h / 2;
    const left = OVERLAY.x - OVERLAY.w / 2 + 60;
    const right = OVERLAY.x + OVERLAY.w / 2 - 60;
    type Row = { icon?: string; label: string; value: string; color?: string };
    const rows: Row[] = [];
    const kinds = CHART_ORDER.filter((t) => chart.counts[t]);
    if (kinds.length === 0) rows.push({ label: t('nothingCharted'), value: '0' });
    for (const terrain of kinds) {
      const n = chart.counts[terrain]!;
      const { name, value } = TERRAIN[terrain];
      rows.push({ icon: `swatch-${terrain}`, label: `${t(name)}   ${n} × ${value}`, value: `${n * value}` });
    }
    if (chart.rivalTiles > 0) {
      rows.push({ icon: 'claim', label: t('rivalFirst', { n: chart.rivalTiles }), value: `−${chart.rivalLoss}`, color: GREY });
    }
    if (chart.ink > 0) rows.push({ label: t('inkName'), value: `+${chart.ink}` });
    for (const f of chart.features) rows.push({ label: t('featureRow', { name: t(f.name) }), value: `+${f.bonus}`, color: GREEN });
    if (chart.artifacts > 0) {
      const each = artifactValue(s);
      const hand = s.hand === 'naturalist' ? ` (${t('naturalistName')})` : '';
      rows.push({ icon: 'artifact', label: t('artefactsRow', { n: chart.artifacts, each }) + hand, value: `+${chart.artifactCoins}`, color: GOLD_DARK });
    }
    if (chart.treasure > 0) rows.push({ icon: 'treasure', label: t('treasureRow'), value: `+${chart.treasure}`, color: GOLD_DARK });
    const com = s.commission;
    if (com) {
      const have = com.done + (chart.counts[com.terrain] ?? 0);
      const on = chart.bonus > 0 ? `+${chart.bonus}` : carriesOver(s, chart) ? t('moreVoyages', { have, need: com.need, n: com.left - 1 }) : t('missed');
      rows.push({ label: t('commissionRow', { text: commissionText(com, 'short') }), value: on, color: chart.bonus > 0 ? GREEN : GREY });
    }
    if (chart.unused > 0) {
      const capped = chart.sellBack < chart.unused * SELL_BACK;
      rows.push({
        label: t(capped ? 'unusedRowCapped' : 'unusedRow', { n: chart.unused, each: SELL_BACK }),
        value: `+${chart.sellBack}`,
        color: MAGENTA,
      });
    }
    MILESTONES.slice(s.milestones, s.milestones + chart.milestones).forEach((m) =>
      rows.push(
        m.atlas
          ? { icon: `atlas-${s.kind}`, label: t('atlasRow', { kind: t(KINDS[s.kind].name), island: s.island }), value: t('bound'), color: MAGENTA }
          : { label: t('milestoneRow', { island: s.island, pct: m.pct }), value: `+${m.coins}`, color: MAGENTA },
      ),
    );
    const room = OVERLAY_BUTTON.y - 60 - (top + 62);
    const rowH = Math.min(24, room / rows.length);
    let y = top + 62;
    for (const r of rows) {
      const color = r.color ?? INK;
      if (r.icon) c.add(this.add.image(left + 8, y + rowH / 2, r.icon).setScale((r.icon.startsWith('swatch') || r.icon.startsWith('atlas') ? 1 : 0.7) / HI));
      c.add(this.text(left + 24, y + rowH / 2, r.label, { size: 11.5, weight: 600, color }).setOrigin(0, 0.5));
      c.add(this.text(right, y + rowH / 2, r.value, { size: 11.5, weight: 700, color }).setOrigin(1, 0.5));
      y += rowH;
    }
    y += 6;
    const g = this.add.graphics();
    g.fillStyle(hex(INK)).fillRect(left, y, right - left, 1.5);
    c.add(g);
    y += 16;
    c.add(this.text(left, y, t('sellsFor'), { size: 15, weight: 800 }).setOrigin(0, 0.5));
    c.add(this.text(right, y, t('coinCount', { n: chart.total }), { size: 15, weight: 800 }).setOrigin(1, 0.5));
    c.add(
      makeButton(this, OVERLAY_BUTTON.x, OVERLAY_BUTTON.y, t('sellChart'), () => {
        if (!sellChart(this.state)) return;
        // The chart that completes the Royal Atlas sets a best if it is one.
        if (this.state.phase === 'atlas' && this.state.royal) this.newBest = saveBest(this.state.royal.voyage);
        saveGame(this.state);
        sfx('coins');
        // The Royal Atlas's fanfare, else a bound page's jingle, else a chime for a milestone.
        if (this.state.phase === 'atlas') playSting(SONG, 'royal');
        else if (chart.atlas) playSting(SONG, 'page');
        else if (chart.milestones > 0) sfx('milestone');
      }),
    );
    this.spots.sell = { ...OVERLAY_BUTTON };
  }

  /** The Royal Atlas: the win page, with the four pages, the voyages it took and the best. */
  private showAtlas() {
    const s = this.state;
    const c = this.overlayBase(t('royalTitle'));
    const top = OVERLAY.y - OVERLAY.h / 2;
    const left = OVERLAY.x - OVERLAY.w / 2 + 60;
    const right = OVERLAY.x + OVERLAY.w / 2 - 60;
    const voyages = s.royal?.voyage ?? s.voyage;
    const best = loadBest() ?? voyages;
    c.add(this.text(OVERLAY.x, top + 76, t('royalLine'), { size: 13, weight: 600, color: SLATE }).setOrigin(0.5));
    c.add(this.text(OVERLAY.x, top + 112, t('completedIn', { n: voyages }), { size: 22, weight: 900 }).setOrigin(0.5));
    const record = this.newBest ? t('newBest') : t('best', { n: best });
    c.add(this.text(OVERLAY.x, top + 138, record, { size: 11, weight: 700, color: this.newBest ? MAGENTA : GREY, ls: 1 }).setOrigin(0.5));
    // One page per kind, in the order the isles come, with the isle that bound it.
    const kinds = Object.keys(KINDS) as IsleKind[];
    const gap = (right - left) / kinds.length;
    kinds.forEach((kind, k) => {
      const page = s.atlas.find((pg) => pg.kind === kind);
      const x = left + gap * (k + 0.5);
      const y = top + 220;
      const g = this.add.graphics();
      g.fillStyle(hex(KINDS[kind].page)).fillRoundedRect(x - 36, y - 48, 72, 96, 3);
      g.fillStyle(hex(MAGENTA)).fillRect(x - 36, y - 48, 7, 96);
      g.lineStyle(1, hex(PAGE_TYPE), 0.7).strokeTriangle(x + 3, y - 14, x + 20, y + 14, x - 14, y + 14);
      c.add(g);
      const name = this.text(x + 3, y + 30, t(KINDS[kind].name).toUpperCase(), { size: 7, weight: 800, color: PAGE_TYPE, ls: 1 }).setOrigin(0.5);
      // A long name (Dschungelinsel) is squeezed to fit the page.
      c.add(name.setScale(Math.min(1, 62 / name.width), 1));
      if (page) {
        c.add(this.text(x, y + 66, t('isle', { n: page.island }), { size: 10.5, weight: 700 }).setOrigin(0.5));
        c.add(this.text(x, y + 80, t('voyages', { n: page.voyages }), { size: 9, weight: 600, color: GREY }).setOrigin(0.5));
      }
    });
    c.add(
      this.text(OVERLAY.x, top + 340, t('royalHint'), {
        size: 10,
        weight: 500,
        color: SLATE,
      }).setOrigin(0.5),
    );
    c.add(
      makeButton(this, OVERLAY_BUTTON.x - 110, OVERLAY_BUTTON.y, t('keepCharting'), () => {
        if (!closeAtlas(this.state)) return;
        ui('click');
        saveGame(this.state);
      }),
    );
    c.add(
      makeButton(this, OVERLAY_BUTTON.x + 110, OVERLAY_BUTTON.y, t('newAtlas'), () => {
        ui('click');
        this.state = newGame();
        saveGame(this.state);
        this.endSweep();
        this.walker = tileCentre(this.state.port.x, this.state.port.y);
      }),
    );
    this.spots.keep = { x: OVERLAY_BUTTON.x - 110, y: OVERLAY_BUTTON.y };
    this.spots.newAtlas = { x: OVERLAY_BUTTON.x + 110, y: OVERLAY_BUTTON.y };
  }

  private showHarbor() {
    const s = this.state;
    const c = this.overlayBase(t('harbourTitle'));
    const top = OVERLAY.y - OVERLAY.h / 2;
    const left = OVERLAY.x - OVERLAY.w / 2 + 34;
    const right = OVERLAY.x + OVERLAY.w / 2 - 34;
    const small = (x: number, y: number, caption: string, origin = 0) =>
      this.text(x, y, caption, { size: 8.5, weight: 700, color: GREY, ls: 1.5 }).setOrigin(origin, 0.5);
    c.add(this.text(left, top + 62, t('chartSold', { n: s.lastSale }), { size: 12, weight: 600, color: SLATE }).setOrigin(0, 0.5));
    c.add(this.text(right, top + 62, t('coinsHave', { n: s.coins }), { size: 15, weight: 800 }).setOrigin(1, 0.5));
    const g = this.add.graphics();
    c.add(g);
    // The upgrades, down the left.
    const shopRight = SHOP.buyX + SMALL_BUTTON.w / 2;
    UPGRADE_IDS.forEach((id, n) => {
      const y = SHOP.y + n * SHOP.gap;
      const up = UPGRADES[id];
      const rank = rankOf(s, id);
      const cost = nextCost(id, rank);
      g.fillStyle(hex(RULE)).fillRect(left, y - SHOP.gap / 2, shopRight - left, 1);
      c.add(this.add.image(left + 14, y, `icon-${id}`).setScale(1 / HI));
      const name = this.text(left + 36, y - 9, t(up.name), { size: 12.5, weight: 800 }).setOrigin(0, 0.5);
      c.add(name);
      up.costs.forEach((_, k) => {
        const px = left + 36 + name.width + 10 + k * 9;
        if (k < rank) g.fillStyle(hex(MAGENTA)).fillRect(px, y - 12.5, 6, 7);
        else g.lineStyle(1, hex(MAGENTA)).strokeRect(px + 0.5, y - 12, 5, 6);
      });
      c.add(this.text(left + 36, y + 8, t(up.text), { size: 10.5, weight: 500, color: SLATE }).setOrigin(0, 0.5));
      const label = cost === null ? t('max') : coins(cost);
      const can = cost !== null && s.coins >= cost;
      c.add(
        makeButton(
          this,
          SHOP.buyX,
          y,
          label,
          () => {
            if (!buy(this.state, id)) return ui('refuse');
            saveGame(this.state);
            sfx('buy');
          },
          SMALL_BUTTON,
          can,
        ),
      );
      this.spots[`buy-${id}`] = { x: SHOP.buyX, y };
    });
    // The hands, down the right: tap one to take them aboard, tap again to leave them ashore.
    const hx = HANDS_COLUMN.x;
    c.add(small(hx, HANDS_COLUMN.y - HANDS_COLUMN.h / 2 - 12, t('hireHead')));
    s.hands.forEach((id, n) => {
      const y = HANDS_COLUMN.y + n * HANDS_COLUMN.gap;
      const on = s.hand === id;
      c.add(this.card(hx, y, HANDS_COLUMN.w, HANDS_COLUMN.h, on, () => hire(this.state, on ? null : id), on ? 'click' : 'hire'));
      c.add(this.add.image(hx + 16, y, `hand-${id}`).setScale(0.9 / HI));
      c.add(this.text(hx + 32, y - 8, t(HANDS[id].name), { size: 11, weight: 800, color: on ? ON_INK : INK }).setOrigin(0, 0.5));
      c.add(this.text(hx + 32, y + 7, t(HANDS[id].text), { size: 8, weight: 500, color: on ? ON_INK_ACCENT : SLATE }).setOrigin(0, 0.5));
      this.spots[`hire-${id}`] = { x: hx + HANDS_COLUMN.w / 2, y };
    });
    if (s.hands.length === 0) c.add(this.text(hx, HANDS_COLUMN.y, t('noHands'), { size: 9.5, weight: 500, color: SLATE }).setOrigin(0, 0.5));
    // The commission board, across the bottom: the one picked is inked.
    const by = BOARD.y - BOARD.h / 2 - 14;
    g.fillStyle(hex(RULE)).fillRect(left, by - 12, right - left, 1);
    const com = s.commission;
    if (s.board.length > 0) {
      c.add(small(left, by, t('boardPick')));
      s.board.forEach((b, n) => {
        const y = BOARD.y + n * BOARD.gap;
        const on = isPicked(s, n);
        c.add(this.card(left, y, right - left, BOARD.h, on, () => pickCommission(this.state, n), 'flip'));
        c.add(this.add.image(left + 14, y, `swatch-${b.terrain}`).setScale(0.8 / HI));
        c.add(this.text(left + 28, y, commissionText(b), { size: 10.5, weight: on ? 800 : 600, color: on ? ON_INK : INK }).setOrigin(0, 0.5));
        if (b.voyages > 1) c.add(this.text(right - 10, y, t('long'), { size: 7.5, weight: 800, color: on ? ON_INK_ACCENT : MAGENTA, ls: 1.5 }).setOrigin(1, 0.5));
        this.spots[`pick-${n}`] = { x: OVERLAY.x, y };
      });
    } else if (com) {
      c.add(small(left, by, t('underWay')));
      c.add(this.text(left, BOARD.y, commissionText(com), { size: 11, weight: 700 }).setOrigin(0, 0.5));
      c.add(
        this.text(left, BOARD.y + 18, t('chartedSoFar', { done: com.done, need: com.need, left: voyagesLeft(com) }), {
          size: 10,
          weight: 500,
          color: SLATE,
        }).setOrigin(0, 0.5),
      );
    } else {
      c.add(small(left, by, t('boardHead')));
      c.add(this.text(left, BOARD.y, t('noNextCommission'), { size: 10.5, weight: 500, color: SLATE }).setOrigin(0, 0.5));
    }
    // The atlas: one bound page per isle charted in full, toward the Royal Atlas.
    const ay = OVERLAY_BUTTON.y;
    c.add(small(left, ay - 8, t('atlasHead')));
    const pages = s.atlas.length;
    if (pages === 0) {
      c.add(this.text(left, ay + 7, t('chartAnIsle'), { size: 9.5, weight: 500, color: SLATE }).setOrigin(0, 0.5));
    } else {
      s.atlas.slice(-6).forEach((page, k) => c.add(this.add.image(left + 8 + k * 14, ay + 8, `atlas-${page.kind}`).setScale(1 / HI)));
      const shown = Math.min(pages, 6);
      const kinds = atlasKinds(s).size;
      const royal = s.royal ? t('royalBound') : t('kindsOf', { n: kinds, total: ROYAL_KINDS });
      c.add(this.text(left + 4 + shown * 14, ay + 8, t('pages', { n: pages }) + royal, { size: 10, weight: 700 }).setOrigin(0, 0.5));
    }
    const { pct } = isleProgress(s);
    c.add(small(right, ay - 8, t('isleHead', { n: s.island }), 1));
    c.add(this.text(right, ay + 7, t('pctSurveyed', { n: pct }), { size: 10, weight: 700, color: pct === 100 ? MAGENTA : INK }).setOrigin(1, 0.5));
    const caption = islandCharted(s) ? t(KINDS[kindOf(s.island + 1)].sail) : t('setSail');
    c.add(
      makeButton(this, OVERLAY_BUTTON.x, OVERLAY_BUTTON.y, caption, () => {
        if (!setSail(this.state)) return;
        saveGame(this.state);
        sfx('swell');
        sfx('horn');
        this.endSweep();
        // The surveyor starts the voyage at the port, not walking back from the last tile.
        this.walker = tileCentre(this.state.port.x, this.state.port.y);
      }),
    );
    this.spots.sail = { ...OVERLAY_BUTTON };
  }

  /** A pick card: a card-coloured box with a rule, inked when picked; a tap calls `onPick` and saves. */
  private card(x: number, y: number, w: number, h: number, on: boolean, onPick: () => boolean, sound: 'click' | 'hire' | 'flip') {
    const box = this.add.rectangle(x, y, w, h, on ? hex(INK) : hex(CARD)).setOrigin(0, 0.5).setStrokeStyle(1, hex(on ? INK : RULE));
    box.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (!onPick()) return;
      saveGame(this.state);
      if (sound === 'click') ui('click');
      else sfx(sound);
    });
    return box;
  }
}

/** A commission in words: "Chart 3 forests this voyage: +12c", or "7 forests over 2 voyages" when short. */
function commissionText(c: Commission, form: 'full' | 'short' = 'full') {
  const count = t(TERRAIN[c.terrain].count, { n: c.need });
  const long = c.voyages > 1;
  if (form === 'short') return t(long ? 'commissionOverShort' : 'commissionThisShort', { count, voyages: c.voyages });
  return t(long ? 'commissionOver' : 'commissionThis', { count, voyages: c.voyages, n: c.bonus });
}

/** What is left of a long commission: "last voyage" or "2 voyages left". */
function voyagesLeft(c: Commission) {
  return c.left === 1 ? t('lastVoyage') : t('voyagesLeft', { n: c.left });
}

/** A riddle clue in words: "Two tiles west of a peak", "on a meadow", "by the water". */
function clueText(c: Clue) {
  switch (c.kind) {
    case 'from':
      return t('clueFrom', { tiles: t(CLUE_TILES[c.tiles]), dir: t(c.dir), mark: t(CLUE_MARKS[c.mark]) });
    case 'ground':
      return t(CLUE_GROUND[c.ground]);
    case 'water':
      return t('byWater');
    case 'inland':
      return t('inland');
    case 'river':
      return t('byRiver');
  }
}

const CLUE_TILES: TextKey[] = ['oneTile', 'oneTile', 'twoTiles', 'threeTiles'];
const CLUE_MARKS: Record<Extract<Clue, { kind: 'from' }>['mark'], TextKey> = {
  mountain: 'markPeak',
  village: 'markVillage',
  ruins: 'markRuins',
  port: 'markPort',
};
const CLUE_GROUND: Record<Ground, TextKey> = { grass: 'onMeadow', forest: 'inForest', beach: 'onSand', hills: 'onHills' };

/** Strokes a rectangle in dashes, in the graphics' current line style. */
function dashedRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, dash: number, gap: number) {
  const edge = (x1: number, y1: number, x2: number, y2: number) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    for (let d = 0; d < len; d += dash + gap) {
      const e = Math.min(len, d + dash);
      g.lineBetween(x1 + ((x2 - x1) * d) / len, y1 + ((y2 - y1) * d) / len, x1 + ((x2 - x1) * e) / len, y1 + ((y2 - y1) * e) / len);
    }
  };
  edge(x, y, x + w, y);
  edge(x + w, y, x + w, y + h);
  edge(x + w, y + h, x, y + h);
  edge(x, y + h, x, y);
}

/** What a survey turned up that has a sound; `NEWS_ORDER` puts the most important first. */
type News = 'riddle' | 'rival' | 'feature' | 'cave' | 'wreck' | 'storm';
const NEWS_ORDER: News[] = ['riddle', 'rival', 'feature', 'cave', 'wreck', 'storm'];

function playNews(news: News) {
  switch (news) {
    case 'wreck':
      sfx('wreck');
      sfx('chime');
      return;
    case 'cave':
      return sfx('sparkle');
    case 'storm':
      return sfx('thunder');
    default:
      return sfx(news);
  }
}
