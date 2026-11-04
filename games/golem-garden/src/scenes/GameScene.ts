import Phaser from 'phaser';
import { playMusic, playSting, ui } from '../../../../shared/audio';
import { dailyRand, finishDaily, loadDaily, startDaily, today } from '../../../../shared/daily';
import { formatNumber } from '../../../../shared/i18n';
import { settings } from '../../../../shared/settings';
import { viewFrame, viewSize } from '../../../../shared/scaling';
import { CALM, STINGS, WAVES, sfx } from '../audio';
import { TREE_FLOWERS, bakeGarden, bakePlot, bakeTable, gardenBg } from '../art/textures';
import { GARDENS, cellAt, drawingOk, drawnGarden, editDrawing, pathPoint, type Drawing, type Garden } from '../game/board';
import {
  BLOOM_GOAL,
  BOON,
  BOON_INFO,
  COMPOST,
  DAILY,
  EARLY_BONUS,
  FAST,
  FORM_INFO,
  GARDEN_TWISTS,
  GOLEMS,
  GOLEM_INFO,
  GRAFTS,
  GRAFT_INFO,
  HARVEST_WAVE,
  HEDGE,
  MAX_LEVEL,
  MOVE_FEE,
  PEST_INFO,
  PESTS,
  PLOT,
  SEEDS,
  STAR_LEAVES,
  TARGET_INFO,
  THORNY_STARS,
  TWIST_INFO,
  dailyPlot,
  isBossWave,
  weekOf,
  weeklyGarden,
  waveBonus,
  waveCounts,
  wildScale,
  type Boon,
  type Graft,
  type PestKind,
  type SeedKind,
} from '../game/data';
import {
  loadBest,
  loadBloom,
  loadGarden,
  loadGrafts,
  loadLaurels,
  loadStars,
  loadThorny,
  loadPlots,
  loadWeekly,
  loadWild,
  saveBest,
  saveBloom,
  saveGarden,
  saveGrafts,
  saveLaurels,
  saveStars,
  saveThorny,
  savePlots,
  saveWeekly,
  saveWild,
  type SavedPlot,
} from '../game/save';
import {
  RING_MS,
  SHOT_MS,
  barred,
  boonCount,
  compostCap,
  boonedStats,
  canCallEarly,
  canGraft,
  canMove,
  canPlant,
  canRegrow,
  comboAt,
  dailyScore,
  formsFor,
  gardenOf,
  gardenOpen,
  golemAt,
  hedgeAt,
  lastWave,
  laurelsFree,
  move,
  newGame,
  nextTarget,
  nextWave,
  ordinary,
  picksForm,
  plant,
  queenOnPath,
  regrow,
  regrowPrice,
  seedCost,
  select,
  setTarget,
  startWave,
  statsOf,
  sunRow,
  takeBoon,
  thornyOpen,
  tick,
  totalStars,
  twistOf,
  unlocked,
  upgrade,
  upgradeCost,
  uproot,
  uprootValue,
  type GameState,
  type Golem,
  type Pop,
} from '../game/state';
import { t } from '../i18n';
import { makeButton } from '../ui/Button';
import { award } from '../../../../shared/trophies';
import { trophies } from '../trophies';
import { checkTrophies } from '../trophies/check';
import {
  BUTTON,
  EDITOR,
  FONT,
  GARDEN_CARD,
  GOLEM_MENU,
  GRAFT_CARD,
  GRID,
  HINT,
  HUD,
  PANEL,
  PREVIEW,
  SEED_BUTTONS,
  SPEED_BUTTON,
  UI_DEPTH,
  VIEW,
  WAVE_BUTTON,
  cellCentre,
} from './layout';

/** The longest frame the rules play in one go, in ms; a longer pause (a hidden tab) plays as this. */
const MAX_STEP_MS = 100;
/** How long the "Wave cleared" banner shows, in ms. */
const BANNER_MS = 2200;
/** Where a golem's or ghost's feet are, below its cell's centre, and the anchor of its texture. */
const FEET = 25;
const GOLEM_ORIGIN = { x: 0.5, y: 78 / 88 };
const PEST_ORIGIN = { x: 0.5, y: 34 / 60 };
const QUEEN_ORIGIN = { x: 84 / 160, y: 62 / 90 };
/** How far above where a pest stands its health bar sits. */
const PEST_TOP: Partial<Record<PestKind, number>> = { crow: 37, aphid: 15, queen: 54 };
/** How long a sap droplet takes to fly to the counter, in ms. */
const DROP_MS = 650;
/** The Heartwood's leaves at the start, the most a harvest can keep (three stars). */
const START_HEART = STAR_LEAVES[STAR_LEAVES.length - 1];
/** The preview's pests, without the Queen Slug, who is named in its title instead. */
const PREVIEW_PESTS = PESTS.filter((kind) => kind !== 'queen');

/** The game's name for its daily record (`shared/daily.ts`). */
const GAME = 'golem-garden';
/** The garden picker's modes: from the garden tag, after the Heartwood falls, at the harvest, at the daily plot's end. */
type PickerMode = 'choose' | 'over' | 'harvest' | 'daily';
/**
 * What the scene is started with: whether to plant today's daily plot or this week's garden, or
 * which drawn plot to plant. Every restart passes all three, since Phaser keeps the last data.
 */
type StartData = { daily?: boolean; weekly?: boolean; plot?: number | null };
/** The garden editor's tools: drawing the path, or soil beds. */
type Tool = 'path' | 'soil';

type Rect = { x: number; y: number; w: number; h: number };
type Text = Phaser.GameObjects.Text;
type Image = Phaser.GameObjects.Image;
type Chip = { bg: Image; text: Text };

export class GameScene extends Phaser.Scene {
  state!: GameState;
  /**
   * The designed 960x560 frame (`VIEW`) in the middle of the view (moved off the corner buttons by
   * `clearCorner`): the camera scrolls so the board, panel and overlays laid out for it sit there,
   * while the table and the HUD strip fill the whole view.
   */
  private frame = new Phaser.Geom.Rectangle(0, 0, VIEW.w, VIEW.h);
  /**
   * What is placed from the view's top-left rather than in the frame (the table, the edge strip and
   * an open overlay's dim), and the HUD's objects (moved up by the frame's y), which `relayout`
   * moves against the frame when it changes.
   */
  private viewObjects = new Set<Phaser.GameObjects.Components.Transform>();
  private hudObjects: Phaser.GameObjects.Components.Transform[] = [];
  private table!: Image;
  private edge!: Image;
  /** Where the seed cards are, in view pixels; read by the playthrough test. */
  seedButtons: (Rect & { kind: SeedKind })[] = [];
  /** Where the wave button is, in view pixels; read by the playthrough test. */
  waveButton: Rect = { x: WAVE_BUTTON.x, y: WAVE_BUTTON.y, w: WAVE_BUTTON.w, h: WAVE_BUTTON.h };
  /** What the wave button says, on one line; read by the playthrough test. */
  waveLabel = '';

  private lastFrame: number | null = null;
  private hover: { col: number; row: number } | null = null;
  /** The golem whose menu (Raise, Move, Uproot) is open. */
  private picked: number | null = null;
  /** The golem being moved: the next tap on free soil moves it there. */
  private moving: number | null = null;
  /** Whether the open menu shows the level-3 forms to pick from instead of Raise, Aim, Move and Uproot. */
  private formMenu = false;
  /** The menu chip under the pointer, so the hint can say what a form does. */
  private chipHover: number | null = null;
  private savedBest = 0;
  private savedBloom = 0;
  private savedStars = '';
  private savedLaurels = '';
  private savedWild = '';
  /** The weekly garden's or drawn plot's best wave as last saved. */
  private savedOwn = 0;
  /** The drawn plot being played, as saved when it was planted, so an edit since stops its best being written over the new drawing. */
  private playedDrawing = '';
  /** The plots overlay and the garden editor, while one is open. */
  private plotBox: Phaser.GameObjects.Container | null = null;
  private golems = new Map<number, Image>();
  private hedges = new Map<number, Image>();
  private pests = new Map<number, { body: Image; slow: Image; mound: Image }>();
  private shots = new Map<number, Image>();
  private slimes = new Map<string, Image>();
  private spores = new Map<number, Image>();
  private tree!: Image;
  private treeFlowers: Image[] = [];
  private bars!: Phaser.GameObjects.Graphics;
  private hoverGfx!: Phaser.GameObjects.Graphics;
  private ghost!: Image;
  private hud!: { wave: Text; waveSub: Text; heart: Text; regrow: Text; sap: Text; best: Text; stars: Text; bloom: Text; bloomSub: Text; flowers: Image[]; glow: Image };
  private speed!: { bg: Image; text: Text };
  private cards: { kind: SeedKind; rim: Image; card: Image; open: Phaser.GameObjects.Container; cost?: Text; locked?: Phaser.GameObjects.Container }[] = [];
  private lockPips!: Phaser.GameObjects.Graphics;
  private preview!: { title: Text; icons: Record<PestKind, Image>; counts: Record<PestKind, Text> };
  /** The wave (and twist) the preview last showed, so it is only counted and laid out again when it changes. */
  private previewKey = '';
  private hint!: Text;
  private waveBg!: Image;
  private waveText!: Text;
  private waveSub!: Text;
  private waveDrop!: Image;
  private menu!: { box: Phaser.GameObjects.Container; chips: Chip[] };
  private banner!: Text;
  private picker: Phaser.GameObjects.Container | null = null;
  /** The boon pick after a Queen Slug wave, while it is open. */
  private boonBox: Phaser.GameObjects.Container | null = null;
  /** The golem grafts overlay, opened from the garden picker, while it is open. */
  private graftBox: Phaser.GameObjects.Container | null = null;
  /** The warm stripes on the rows the Sunny row boons shine on. */
  private sunGfx!: Phaser.GameObjects.Graphics;
  /** The music part playing: calm between waves, battle or boss while pests come. */
  private musicPart: 'calm' | 'battle' | 'boss' | null = null;

  constructor() {
    super('Game');
  }

  create(data: StartData = {}) {
    const daily = data.daily ? dailyPlot(dailyRand(GAME), GARDENS.length) : null;
    const weekly = data.weekly ? weeklyGarden(weekOf(today()), GARDENS.length) : null;
    const drawn = data.plot === undefined || data.plot === null ? null : loadPlots()[data.plot];
    const plot = drawn && drawingOk(drawn, PLOT.minPath, PLOT.soil) ? { slot: data.plot!, garden: drawnGarden(drawn) } : null;
    this.state = newGame(loadBest(), loadBloom(), loadGarden(), loadStars(), loadThorny(), loadLaurels(), {
      wild: loadWild(),
      grafts: loadGrafts(),
      daily,
      weekly,
      plot,
    });
    this.playedDrawing = drawn ? this.drawingKey(drawn) : '';
    this.savedOwn = this.ownBest();
    this.savedWild = this.state.wild.join(',');
    this.savedBest = this.state.best;
    this.savedBloom = this.state.bloom;
    this.savedStars = this.state.stars.join(',');
    this.savedLaurels = this.state.laurels.join(',');
    this.lastFrame = null;
    // A restart (a new garden) reuses this scene object, so start these afresh.
    this.hover = null;
    this.picked = null;
    this.moving = null;
    this.formMenu = false;
    this.picker = null;
    this.boonBox = null;
    this.graftBox = null;
    this.plotBox = null;
    this.previewKey = '';
    this.cards = [];
    this.treeFlowers = [];
    this.golems.clear();
    this.hedges.clear();
    this.pests.clear();
    this.shots.clear();
    this.slimes.clear();
    this.spores.clear();
    this.viewObjects.clear();

    // Everything is laid out in the designed frame, which the camera centres in the view (unless the
    // corner buttons would cover the board); the table fills the whole view and the HUD (moved up by
    // the frame's y) sits at its top edge.
    const view = viewSize(this);
    const frame = (this.frame = this.clearCorner(viewFrame(this), view.width, view.height));
    this.cameras.main.setScroll(-frame.x, -frame.y);
    bakeTable(this, view.width, view.height, frame.x, frame.y);
    this.table = this.add.image(-frame.x, -frame.y, 'table').setOrigin(0);
    this.viewObjects.add(this.table);
    let bg = gardenBg(this.state.garden);
    if (this.state.plot) bg = bakePlot(this, this.state.plot.garden);
    else bakeGarden(this, this.state.garden);
    this.add.image(0, 0, bg).setOrigin(0);
    this.sunGfx = this.add.graphics().setDepth(1);
    this.createBoard();
    this.bars = this.add.graphics().setDepth(UI_DEPTH - 20);
    this.hoverGfx = this.add.graphics().setDepth(UI_DEPTH - 30);
    this.ghost = this.add
      .image(0, 0, 'golem-pebble')
      .setAlpha(0.6)
      .setOrigin(GOLEM_ORIGIN.x, GOLEM_ORIGIN.y)
      .setVisible(false)
      .setDepth(UI_DEPTH - 31);
    const hudFrom = this.children.length;
    this.createHud();
    this.hudObjects = this.children.list.slice(hudFrom) as unknown as Phaser.GameObjects.Components.Transform[];
    for (const obj of this.hudObjects) obj.y -= frame.y;
    this.createPanel();
    this.waveButton = { x: WAVE_BUTTON.x + frame.x, y: WAVE_BUTTON.y + frame.y, w: WAVE_BUTTON.w, h: WAVE_BUTTON.h };
    this.createMenu();
    this.banner = this.add
      .text(GRID.x + (GRID.cols * GRID.cell) / 2, GRID.y + 36, '', {
        fontFamily: FONT,
        fontStyle: 'bold',
        fontSize: '24px',
        color: '#ffd27a',
        stroke: '#5a2e08',
        strokeThickness: 6,
        align: 'center',
      })
      .setOrigin(0.5)
      .setDepth(UI_DEPTH)
      .setAlpha(0);
    this.refresh();
    if (daily) this.announceDaily();
    else if (this.state.weekly) {
      const { twist } = this.state.weekly;
      this.announce([t('weeklyBanner', { garden: t(gardenOf(this.state).name) }), t('weeklyTwist', { twist: t(TWIST_INFO[twist].name) }), t('weeklyRules')], 2);
    } else if (this.state.plot) this.announce([t('plotBanner', { n: this.state.plot.slot + 1 })]);
    this.musicPart = null;
    this.syncMusic();
    // The corner buttons keep their CSS size, so a window resized or a phone turned after the start
    // can bring them over the board again: place the frame afresh then.
    this.scale.on(Phaser.Scale.Events.RESIZE, this.relayout, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, this.relayout, this));
  }

  /**
   * Places the frame again for the window as it is now (see `clearCorner`), and moves what hangs
   * on it: the camera, the table (painted again, since its HUD tags sit over the frame), the edge
   * strip, an open overlay's dim, the HUD and the seed cards' and wave button's rectangles.
   */
  private relayout() {
    const view = viewSize(this);
    const next = this.clearCorner(viewFrame(this), view.width, view.height);
    const [dx, dy] = [next.x - this.frame.x, next.y - this.frame.y];
    if (!dx && !dy) return;
    this.frame = next;
    this.cameras.main.setScroll(-next.x, -next.y);
    bakeTable(this, view.width, view.height, next.x, next.y);
    this.table.setTexture('table');
    this.edge.setTexture('edge');
    for (const obj of this.viewObjects) obj.setPosition(obj.x - dx, obj.y - dy);
    for (const obj of this.hudObjects) obj.y -= dy;
    for (const button of this.seedButtons) [button.x, button.y] = [button.x + dx, button.y + dy];
    this.waveButton = { ...this.waveButton, x: this.waveButton.x + dx, y: this.waveButton.y + dy };
  }

  update(time: number) {
    // Game time from the frame's own timestamp rather than Phaser's smoothed delta.
    const dt = this.lastFrame === null ? 0 : Phaser.Math.Clamp(time - this.lastFrame, 0, MAX_STEP_MS);
    this.lastFrame = time;
    const s = this.state;
    const { wave, heart, phase, bloom, harvest } = s;
    const before = this.soundWatch();
    // The garden picker (and the harvest and game-over screens) and a boon pick waiting to be made
    // hold the game still behind them.
    tick(s, this.overlayOpen() || s.offer.length ? 0 : dt * (s.fast ? FAST : 1));
    this.tickSounds(before);
    checkTrophies(s);
    if (s.heart < heart) this.heartHit();
    // Waves called early that are done now, then a wave cleared.
    let budsBefore = bloom;
    for (const { wave: n, clean } of s.settled) {
      if (clean) award(trophies, 'boldCall');
      this.waveDone(n, budsBefore, true);
      budsBefore = Math.min(BLOOM_GOAL, budsBefore + 1);
    }
    s.settled = [];
    if (s.wave > wave) this.waveDone(wave, budsBefore, false);
    // The music changes first, so a sting ducks the song that plays on under it.
    this.syncMusic();
    if (s.harvest && !harvest) {
      playSting(STINGS, `harvest${s.harvest}`);
      this.showPicker('harvest');
    }
    if (s.phase === 'over' && phase !== 'over') {
      if (s.daily) {
        // The daily plot is over: its last wave cleared, or the Heartwood fallen.
        finishDaily(GAME, dailyScore(s));
        playSting(STINGS, s.heart > 0 ? 'harvest3' : 'lose');
        this.showPicker('daily');
      } else {
        playSting(STINGS, 'lose');
        this.showPicker('over');
      }
    }
    // The boon pick waits for the harvest screen (and the plots, editor or grafts opened from it) to close.
    if (s.offer.length && !this.overlayOpen()) this.showBoons();
    for (const pop of s.pops) this.sapPop(pop);
    s.pops = [];
    this.bars.clear();
    this.drawSun();
    this.drawSlime();
    this.drawSpores();
    this.drawHedges();
    this.drawGolems();
    this.drawPests();
    this.drawShots();
    this.drawHover();
    this.refresh();
  }

  /** What the frame's sounds are told from: the next id, seeds still growing, hedges and armoured pests' golem hits. */
  /**
   * Moves the frame off the shared corner buttons when they would cover the board's bottom-left
   * cell, as on a short window (a phone on its side), where the buttons keep their CSS size and so
   * grow in game pixels: first up, as far as the view's top, then right, as far as the view's right
   * edge. A frame the buttons already miss stays centred.
   */
  private clearCorner(frame: Phaser.Geom.Rectangle, w: number, h: number) {
    const corner = this.cornerSize(w, h);
    const bottom = GRID.y + GRID.rows * GRID.cell;
    if (frame.y + bottom <= h - corner.h) return frame;
    frame.y = Math.max(0, Math.min(frame.y, Math.floor(h - corner.h - bottom)));
    if (frame.y + bottom > h - corner.h) frame.x = Math.min(w - frame.width, Math.max(frame.x, Math.ceil(corner.w - GRID.x)));
    return frame;
  }

  /**
   * The shared corner buttons' footprint in view pixels, measured from the view's bottom-left, with
   * the view shown as big as fits the page, plus a 4-pixel gap. The row (`shared/corner.ts`: two
   * 30px buttons 6px apart, 12px from the edges) may not be on the page yet when the scene starts,
   * so its size is taken from there unless it is.
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
    return { w: (right - left) / k + 4, h: (bottom - top) / k + 4 };
  }

  private soundWatch() {
    const s = this.state;
    return {
      nextId: s.nextId,
      growing: new Set(s.golems.filter((g) => g.growMs > 0).map((g) => g.id)),
      hedges: new Set(s.hedges.map((h) => h.id)),
      armoured: new Map(s.pests.filter((p) => PEST_INFO[p.kind].armour).map((p) => [p.id, p.hits])),
    };
  }

  /**
   * The sounds of what the rules just did, at most one of each a frame: throws (one per golem
   * kind), seeds grown, pests coming in, armour clinks, hedges chewed through and pests squashed.
   */
  private tickSounds(before: ReturnType<GameScene['soundWatch']>) {
    const s = this.state;
    const thrown = new Set(s.shots.filter((shot) => shot.id >= before.nextId).map((shot) => shot.kind));
    for (const kind of thrown) sfx(kind);
    if (s.golems.some((g) => before.growing.has(g.id) && g.growMs === 0)) sfx('grown');
    const come = new Set(s.pests.filter((p) => p.id >= before.nextId).map((p) => p.kind));
    if (come.has('crow')) sfx('caw');
    if (come.has('mole')) sfx('dig');
    if (come.has('queen')) sfx('groan');
    // A throw on armour, not spore damage (which takes health off every step).
    if (s.pests.some((p) => p.hits > (before.armoured.get(p.id) ?? Infinity))) sfx('clink');
    if ([...before.hedges].some((id) => !s.hedges.some((h) => h.id === id))) sfx('snap');
    if (s.pops.length) {
      sfx('squash');
      sfx('sap');
    }
  }

  /** Plays the calm part between waves, battle while pests come, and boss on a Queen Slug wave. */
  private syncMusic() {
    const s = this.state;
    const part = s.phase === 'wave' ? (isBossWave(s.wave) ? 'boss' : 'battle') : 'calm';
    if (part === this.musicPart) return;
    this.musicPart = part;
    playMusic(part === 'calm' ? CALM : WAVES, part);
  }

  /** Whether an overlay (the picker, plots or editor, grafts or boon pick) is up. */
  private overlayOpen() {
    return !!(this.picker || this.graftBox || this.plotBox || this.boonBox);
  }

  /** The dark cover behind an overlay, over the whole view, taking the taps behind it. */
  private dim() {
    const view = viewSize(this);
    const dim = this.add.rectangle(-this.frame.x, -this.frame.y, view.width, view.height, 0x1a0e06, 0.76).setOrigin(0).setInteractive();
    this.viewObjects.add(dim);
    dim.once(Phaser.GameObjects.Events.DESTROY, () => this.viewObjects.delete(dim));
    return dim;
  }

  /** A pressed clay label: bold text with a light lower edge, as if stamped into the clay. */
  private press(x: number, y: number, text: string, size: number, color: string, origin: [number, number] = [0, 0.5]) {
    return this.add
      .text(x, y, text, { fontFamily: FONT, fontStyle: 'bold', fontSize: `${size}px`, color })
      .setOrigin(...origin)
      .setShadow(1, 1, 'rgba(255,240,210,0.35)', 0);
  }

  private createBoard() {
    const { col, row } = gardenOf(this.state).heart;
    const heart = cellCentre(col, row);
    this.tree = this.add.image(heart.x, heart.y, 'tree').setOrigin(65 / 130, 70 / 120).setDepth(heart.y + 32);
    this.treeFlowers = TREE_FLOWERS.map(([dx, dy]) => this.add.image(heart.x + dx, heart.y + dy, 'bud').setDepth(heart.y + 33));
    // The table strip left of the board hides pests until they step onto the garden.
    this.edge = this.add.image(-this.frame.x, -this.frame.y, 'edge').setOrigin(0).setDepth(UI_DEPTH - 40);
    this.viewObjects.add(this.edge);

    const zone = this.add.zone(GRID.x, GRID.y, GRID.cols * GRID.cell, GRID.rows * GRID.cell).setOrigin(0).setInteractive();
    zone.on('pointermove', (p: Phaser.Input.Pointer) => (this.hover = cellAt(p.worldX, p.worldY)));
    zone.on('pointerout', () => (this.hover = null));
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.hover = cellAt(p.worldX, p.worldY);
      if (this.hover) this.tapCell(this.hover.col, this.hover.row);
    });
  }

  /**
   * A tap on the board: moves the golem being moved there, or opens (or closes) the menu of the
   * golem on the cell, or regrows a leaf on the Heartwood, or plants the picked seed.
   */
  private tapCell(col: number, row: number) {
    const s = this.state;
    const moving = this.golemById(this.moving);
    this.moving = null;
    this.formMenu = false;
    if (moving) {
      if (move(s, moving, col, row)) sfx('move');
      else ui('refuse');
      this.picked = null;
    } else {
      const golem = golemAt(s, col, row);
      if (golem) {
        this.picked = this.picked === golem.id ? null : golem.id;
        ui('click');
      } else if (this.picked !== null) this.picked = null;
      else if (gardenOf(s).map[row][col] === 'heart') this.regrowLeaf();
      else {
        const kind = s.selected;
        if (plant(s, col, row)) sfx(kind === 'hedge' ? 'rustle' : 'plant');
        else ui('refuse');
      }
    }
    this.refresh();
  }

  /** Regrows a Heartwood leaf (a tap on the tree or the leaf tag), or buzzes when it can't. */
  private regrowLeaf() {
    if (regrow(this.state)) {
      sfx('rustle');
      sfx('chime');
    } else ui('refuse');
  }

  private golemById(id: number | null) {
    return id === null ? undefined : this.state.golems.find((g) => g.id === id);
  }

  private createHud() {
    const ink = '#4a2e18';
    this.press(HUD.title.x, HUD.title.y, t('title'), 19, '#f2c44a');
    const garden = this.add.image(HUD.garden.x, HUD.garden.y, 'pill');
    garden.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      ui('click');
      this.showPicker('choose');
    });
    const s = this.state;
    const tagKey = s.daily ? 'gardenTagDaily' : s.weekly ? 'gardenTagWeekly' : s.thorny ? 'gardenTagThorny' : 'gardenTag';
    const tagText = s.plot ? t('gardenTagPlot', { n: s.plot.slot + 1 }) : t(tagKey, { garden: t(gardenOf(s).name) });
    this.press(HUD.garden.x, HUD.garden.y, tagText, 10.5, this.state.thorny ? '#7a2a4a' : '#4a2e18', [0.5, 0.5]);
    // The leaf tag regrows a leaf too, like a tap on the Heartwood.
    this.add
      .zone(HUD.leaf.x, HUD.y - 18, HUD.leaf.w, 36)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.regrowLeaf();
        this.refresh();
      });
    const flowers = Array.from({ length: BLOOM_GOAL }, (_, i) => this.add.image(HUD.bloom.flowers + i * HUD.bloom.gap, HUD.y, 'bud').setScale(0.92));
    const glow = this.add.image(HUD.sap.icon, HUD.y, 'glow').setAlpha(0).setDepth(UI_DEPTH - 2);
    this.add.image(HUD.leaf.icon, HUD.y, 'leaf');
    this.add.image(HUD.sap.icon, HUD.y - 1, 'sap').setDepth(UI_DEPTH - 1);
    this.hud = {
      wave: this.press(HUD.wave.x + HUD.wave.w / 2, HUD.y - 5, '', 18, ink, [0.5, 0.5]),
      waveSub: this.press(HUD.wave.x + HUD.wave.w / 2, HUD.y + 11, '', 8.5, '#6a4a2a', [0.5, 0.5]),
      heart: this.press(HUD.leaf.text, HUD.y, '', 20, ink),
      regrow: this.press(HUD.leaf.x + HUD.leaf.w - 11, HUD.y - 1, '+', 16, '#3e8c3e', [0.5, 0.5]),
      sap: this.press(HUD.sap.text, HUD.y, '', 20, ink).setDepth(UI_DEPTH - 1),
      bloom: this.press(HUD.bloom.text, HUD.y - 7, '', 10.5, '#3a3014'),
      bloomSub: this.press(HUD.bloom.text, HUD.y + 7, '', 9, '#4a6a24'),
      best: this.press(HUD.best.x, HUD.y - 7, '', 11, '#e8d6a8', [1, 0.5]),
      stars: this.press(HUD.best.x, HUD.y + 7, '', 11, '#f2c44a', [1, 0.5]),
      flowers,
      glow,
    };
    const bg = this.add.image(SPEED_BUTTON.x, SPEED_BUTTON.y, 'speed');
    bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      ui('click');
      this.state.fast = !this.state.fast;
      this.refresh();
    });
    this.speed = { bg, text: this.press(SPEED_BUTTON.x + 9, SPEED_BUTTON.y, '', 14, '#4a2a08', [0.5, 0.5]) };
  }

  private createPanel() {
    this.press(PANEL.x + PANEL.w / 2, PANEL.y + 9, t('seeds'), 14, '#f2c44a', [0.5, 0.5]);
    const ink = '#3a2a18';
    this.seedButtons = SEEDS.map((kind, i) => {
      const x = SEED_BUTTONS.x;
      const y = SEED_BUTTONS.ys[i];
      const h = SEED_BUTTONS.hs[i];
      const rim = this.add.image(x, y, `rim-${h}`).setVisible(false);
      const card = this.add.image(x, y, `card-${h}`);
      card.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (select(this.state, kind)) sfx('select');
        else ui('refuse');
        this.moving = null;
        this.picked = null;
        this.formMenu = false;
        this.refresh();
      });
      const left = x - SEED_BUTTONS.w / 2;
      let face: Phaser.GameObjects.GameObject[];
      let cost: Text | undefined;
      let locked: Phaser.GameObjects.Container | undefined;
      if (kind === 'hedge') {
        // The hedge strip: the hedge, its name and its cost; the hint says what it does.
        face = [
          this.add.image(left + 28, y + 13, 'hedge').setOrigin(0.5, 54 / 64).setScale(0.46),
          this.press(left + 55, y - 8, t(HEDGE.name), 10.5, ink),
          this.add.image(left + 62, y + 6, 'sap').setScale(0.5),
          this.press(left + 70, y + 7, formatNumber(HEDGE.cost), 12, ink),
        ];
      } else {
        const info = GOLEM_INFO[kind];
        // In the daily plot a card names the form its golem grows into at level 3 instead.
        const daily = this.state.daily;
        const blurb = daily ? t('dailyForm', { form: t(FORM_INFO[daily.forms[kind]].name) }) : t(info.blurb);
        // The card's face: the golem, its name, its cost in sap and what it does.
        cost = this.press(left + 70, y + 1, formatNumber(info.cost), 12, ink);
        // Names and lines too long for the card (in German, say) shrink to fit it.
        const fit = (text: Text) => {
          for (let size = Number.parseFloat(String(text.style.fontSize)); text.width > SEED_BUTTONS.w - 59 && size > 7; size -= 0.5) text.setFontSize(size);
          return text;
        };
        face = [
          this.add.image(left + 26, y + 18, `golem-${kind}`).setOrigin(GOLEM_ORIGIN.x, GOLEM_ORIGIN.y).setScale(0.42),
          fit(this.press(left + 53, y - 12, t(info.name), 10.5, ink)),
          this.add.image(left + 61, y, 'sap').setScale(0.5),
          cost,
          fit(this.press(left + 53, y + 13, blurb, 9, daily ? '#7a2a4a' : '#7a5a34')),
        ];
        // A golem still to unlock shows a padlock card: the Thorn golem with the Heartwood's buds,
        // the Fungus and Bell golems with the wave to clear.
        if (info.locked || info.unlockBest) {
          const lines = info.locked
            ? [fit(this.press(left + 53, y + 1, t('bloomsAfter'), 9, '#4a6a24'))]
            : [
                fit(this.press(left + 53, y + 1, t('lockedWave', { n: info.unlockBest! }), 9, '#4a6a24')),
                fit(this.press(left + 53, y + 12, t('lockedToUnlock'), 9, '#4a6a24')),
              ];
          locked = this.add.container(0, 0, [this.add.image(x, y, 'card-locked'), fit(this.press(left + 53, y - 12, t(info.name), 10.5, ink)), ...lines]);
          if (info.locked) {
            this.lockPips = this.add.graphics();
            locked.add(this.lockPips);
          }
        }
      }
      const open = this.add.container(0, 0, face);
      this.cards.push({ kind, rim, card, open, cost, locked });
      return { kind, x: x + this.frame.x, y: y + this.frame.y, w: SEED_BUTTONS.w, h };
    });

    this.preview = {
      title: this.press(PREVIEW.x + 8, PREVIEW.y + 13, '', 11, '#fbefd6'),
      icons: {} as Record<PestKind, Image>,
      counts: {} as Record<PestKind, Text>,
    };
    for (const kind of PREVIEW_PESTS) {
      this.preview.icons[kind] = this.add.image(0, 0, `pest-${kind}`);
      this.preview.counts[kind] = this.press(0, 0, '', 11, '#f0e2bc');
    }

    this.hint = this.press(PANEL.x + PANEL.w / 2, HINT.y, '', 8.5, '#d8c79e', [0.5, 0.5]).setAlign('center').setWordWrapWidth(PANEL.w - 8);

    this.waveBg = this.add.image(WAVE_BUTTON.x, WAVE_BUTTON.y, 'btn-wave');
    this.waveBg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      const s = this.state;
      const { wave } = s;
      const did = startWave(s);
      if (did === 'start') sfx('horn');
      else if (did === 'early') sfx('whistle');
      else ui('refuse');
      if (did === 'early') this.waveCalled(wave);
      else if (did === 'start' && isBossWave(s.wave)) this.announce([t('queenWave', { n: s.wave })]);
      else if (did === 'start' && s.wave === HARVEST_WAVE + 1 && !s.daily) this.announce([t('wildBanner')]);
      this.refresh();
    });
    this.waveText = this.press(WAVE_BUTTON.x, WAVE_BUTTON.y - 8, '', 13, '#4a2a08', [0.5, 0.5]);
    this.waveSub = this.press(WAVE_BUTTON.x + 4, WAVE_BUTTON.y + 11, '', 11, '#5a3410', [0.5, 0.5]);
    this.waveDrop = this.add.image(WAVE_BUTTON.x - 23, WAVE_BUTTON.y + 10, 'sap').setScale(0.55);
  }

  /**
   * The menu a tapped golem opens: four chips, Raise it a level, Aim (its targeting), Move it for
   * a fee and Uproot it for sap back. Raising to level 3 turns the chips into its two forms and Back.
   */
  private createMenu() {
    const { chip } = GOLEM_MENU;
    const step = chip.w + chip.gap;
    const chips = [0, 1, 2, 3].map((i): Chip => {
      const dx = (i - 1.5) * step;
      const bg = this.add.image(dx, 0, 'chip');
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => (this.chipHover = i))
        .on('pointerout', () => (this.chipHover = null))
        .on('pointerdown', () => {
          const g = this.golemById(this.picked);
          if (g) this.menuTap(g, i);
          this.refresh();
        });
      const text = this.add
        .text(dx, 0, '', { fontFamily: FONT, fontStyle: 'bold', fontSize: '10.5px', color: '#3a2a18', align: 'center' })
        .setOrigin(0.5)
        .setLineSpacing(-1)
        .setShadow(1, 1, 'rgba(255,240,210,0.35)', 0);
      return { bg, text };
    });
    const box = this.add
      .container(0, 0, [this.add.image(0, 0, 'menu'), ...chips.flatMap((c) => [c.bg, c.text])])
      .setDepth(UI_DEPTH + 2)
      .setVisible(false);
    this.menu = { box, chips };
  }

  /** A tap on the open golem's menu chip `i`. */
  private menuTap(g: Golem, i: number) {
    const s = this.state;
    if (this.formMenu) {
      const forms = formsFor(s, g.kind);
      if (i < forms.length) {
        if (upgrade(s, g, forms[i])) {
          this.formMenu = false;
          sfx('form');
        } else ui('refuse');
      } else if (i === forms.length) {
        this.formMenu = false;
        ui('click');
      }
      return;
    }
    if (i === 0) {
      if (picksForm(g)) {
        this.formMenu = upgradeCost(g) !== null && s.sap >= upgradeCost(g)!;
        if (this.formMenu) ui('click');
        else ui('refuse');
      } else if (upgrade(s, g)) sfx('raise', { pitch: 2 ** ((g.level - 2) * 4 / 12) });
      else ui('refuse');
    } else if (i === 1) {
      if (setTarget(s, g, nextTarget(g))) sfx('aim');
      else ui('refuse');
    } else if (i === 2) {
      if (s.sap < MOVE_FEE) return ui('refuse');
      ui('click');
      this.moving = g.id;
      this.picked = null;
    } else {
      if (uproot(s, g)) {
        sfx('uproot');
        ui('coin');
      }
      this.picked = null;
    }
  }

  /**
   * The garden picker, built afresh each time it opens: a card per garden with its harvest stars
   * (and its best wild wave), each planted fresh when tapped if enough stars have unlocked it, and
   * the Daily plot and Grafts buttons.
   */
  private createPicker(mode: PickerMode) {
    const s = this.state;
    const dim = this.dim();
    const title = this.add
      .text(VIEW.w / 2, 104, '', { fontFamily: FONT, fontStyle: 'bold', fontSize: '30px', color: '#f2c44a', stroke: '#3a2008', strokeThickness: 6 })
      .setOrigin(0.5);
    const text = this.add
      .text(VIEW.w / 2, 164, '', { fontFamily: FONT, fontStyle: 'bold', fontSize: '15px', color: '#fbefd6', align: 'center' })
      .setOrigin(0.5)
      .setLineSpacing(5)
      .setWordWrapWidth(VIEW.w - 60);
    const stars = totalStars(s);
    if (mode === 'daily') {
      const record = loadDaily(GAME);
      title.setText(t(s.heart > 0 ? 'dailyWonTitle' : 'dailyLostTitle'));
      text.setText(
        t('dailyText', { waves: s.cleared, total: DAILY.waves, n: s.heart, score: dailyScore(s), best: record.best, streak: record.streak }),
      );
    } else if (mode === 'over') {
      title.setText(t('overTitle'));
      const key = s.weekly ? 'overTextWeekly' : s.plot ? 'overTextPlot' : 'overText';
      text.setText(t(key, { wave: s.wave, kills: s.kills, best: s.weekly || s.plot ? this.savedOwn : s.best }));
    } else if (mode === 'harvest' && s.thorny) {
      title.setText(t('thornyHarvestTitle'));
      text.setText(t('thornyHarvestText', { wave: HARVEST_WAVE, garden: t(gardenOf(s).name), heart: s.heart, max: START_HEART }));
    } else if (mode === 'harvest') {
      const n = s.harvest;
      title.setText(t('harvestTitle', { stars: this.starText(n) }));
      const next = GARDENS.find((g) => g.unlockStars > stars);
      const after = [
        s.stars[s.garden] >= THORNY_STARS ? t('harvestThornyOpen') : '',
        next ? t('harvestNext', { garden: t(next.name), need: next.unlockStars, stars }) : t('harvestAllOpen'),
        t('harvestGoOn', { wave: HARVEST_WAVE }),
      ];
      text.setText(
        t('harvestCleared', { wave: HARVEST_WAVE, heart: s.heart, max: START_HEART, n, garden: t(gardenOf(s).name) }) +
          '\n' +
          after.filter(Boolean).join(' '),
      );
    } else {
      title.setText(t('chooseTitle'));
      text.setText(t('chooseText', { best: s.best, thorny: THORNY_STARS }));
    }
    const parts: Phaser.GameObjects.GameObject[] = [dim, title, text];
    const { y, w, gap } = GARDEN_CARD;
    GARDENS.forEach((garden, i) => {
      const x = VIEW.w / 2 + (i - (GARDENS.length - 1) / 2) * (w + gap);
      const open = gardenOpen(s, i);
      const here = i === s.garden && !s.thorny && ordinary(s);
      if (here) parts.push(this.add.image(x, y, 'gcard-rim'));
      const card = this.add.image(x, y, open ? 'gcard' : 'gcard-locked');
      const plantIt = (thorny: boolean) => {
        ui('click');
        this.leaveDaily();
        saveGarden(i);
        saveThorny(thorny);
        this.scene.restart({ daily: false, weekly: false, plot: null } satisfies StartData);
      };
      if (open) card.setInteractive({ useHandCursor: true }).on('pointerdown', () => plantIt(false));
      if (thornyOpen(s, i)) {
        // Three stars open the garden's thorny variant: a tag under its card, with its twist and laurel.
        const twist = TWIST_INFO[GARDEN_TWISTS[i]];
        const ty = y + GARDEN_CARD.h / 2 + 24;
        if (i === s.garden && s.thorny && ordinary(s)) parts.push(this.add.image(x, ty, 'pill').setScale(1.42, 1.9).setTint(0xf2c44a));
        const tag = this.add.image(x, ty, 'pill').setScale(1.3, 1.6);
        tag.setInteractive({ useHandCursor: true }).on('pointerdown', () => plantIt(true));
        const label = t(s.laurels[i] ? 'thornyTagWon' : 'thornyTag', { twist: t(twist.name) });
        parts.push(tag, this.press(x, ty, label, 10.5, '#7a2a4a', [0.5, 0.5]));
      }
      parts.push(card, this.press(x, y - 80, t(garden.name), 18, '#3a2a18', [0.5, 0.5]), this.miniMap(garden, x, y - 18, open));
      parts.push(this.press(x, y + 50, t(garden.blurb), 10, '#7a5a34', [0.5, 0.5]).setAlign('center').setWordWrapWidth(w - 24));
      // A garden kept going past its harvest shows its best wild wave under the caption.
      const wild = s.wild[i];
      const caption = this.press(x, y + (wild ? 72 : 78), '', 12.5, open ? '#4a6a24' : '#5a4a34', [0.5, 0.5]);
      caption.setText(
        open
          ? t(here ? 'replantHere' : 'plantHere', { stars: this.starText(s.stars[i]) })
          : t('needsStars', { n: garden.unlockStars, have: stars }),
      );
      parts.push(caption);
      if (wild) parts.push(this.press(x, y + 88, t('wildBest', { n: wild }), 10, '#7a3a14', [0.5, 0.5]));
    });
    // A row of buttons along the bottom, each with its note under it: Daily plot, Plots, then Back
    // (or Keep going) and Grafts where they show.
    const row: ((x: number) => Phaser.GameObjects.GameObject[])[] = [(x) => this.dailyButton(x, 492), (x) => this.plotsButton(x, 492, mode)];
    if (mode === 'choose' || mode === 'harvest') {
      row.push((x) => [
        makeButton(this, x, 492, t(mode === 'harvest' ? 'keepGoing' : 'back'), () => {
          ui('click');
          this.closePicker();
        }),
      ]);
    }
    // Grafts show once a laurel has been won.
    if (laurelsFree(s.laurels, []) > 0) {
      row.push((x) => [
        makeButton(this, x, 492, t('graftsButton'), () => {
          ui('click');
          this.showGrafts(mode);
        }),
        this.press(x, 527, t('laurelsLeft', { n: laurelsFree(s.laurels, loadGrafts()), total: laurelsFree(s.laurels, []) }), 10.5, '#e8d6a8', [0.5, 0.5]),
      ]);
    }
    row.forEach((make, i) => parts.push(...make(VIEW.w / 2 + (i - (row.length - 1) / 2) * (BUTTON.w + 16))));
    return this.add.container(0, 0, parts).setDepth(UI_DEPTH + 10);
  }

  /**
   * The Daily plot button and the note under it: plants today's daily plot (once a day, which uses
   * up the try), or shows today's score once it has been played.
   */
  private dailyButton(x: number, y: number) {
    const record = loadDaily(GAME);
    const caption = record.played ? t('dailyPlayed', { score: record.score === null ? '–' : formatNumber(record.score) }) : t('dailyButton');
    const button = makeButton(this, x, y, caption, () => {
      if (loadDaily(GAME).played) return ui('refuse');
      ui('click');
      this.leaveDaily();
      startDaily(GAME);
      this.scene.restart({ daily: true, weekly: false, plot: null } satisfies StartData);
    });
    if (record.played) button.setAlpha(0.7);
    const note = record.best || record.streak ? t('dailyNote', { best: record.best, n: record.streak }) : t('dailyNew');
    return [button, this.press(x, y + 35, note, 10.5, '#e8d6a8', [0.5, 0.5])];
  }

  /** The Plots button and the note under it (this week's best): opens the plots overlay. */
  private plotsButton(x: number, y: number, back: PickerMode) {
    const best = loadWeekly(weekOf(today()));
    const button = makeButton(this, x, y, t('plotsButton'), () => {
      ui('click');
      this.showPlots(back);
    });
    return [button, this.press(x, y + 35, best ? t('plotsNote', { n: best }) : t('plotsNew'), 10.5, '#e8d6a8', [0.5, 0.5])];
  }

  /** The weekly garden's or drawn plot's own best wave, as saved (0 in any other garden). */
  private ownBest() {
    const s = this.state;
    if (s.weekly) return loadWeekly(s.weekly.week);
    if (s.plot) return loadPlots()[s.plot.slot]?.best ?? 0;
    return 0;
  }

  /** Saves the weekly garden's or drawn plot's best wave (not over a plot drawn again since it was planted). */
  private saveOwnBest(best: number) {
    const s = this.state;
    if (s.weekly) saveWeekly(s.weekly.week, best);
    if (!s.plot) return;
    const plots = loadPlots();
    const plot = plots[s.plot.slot];
    if (!plot || this.drawingKey(plot) !== this.playedDrawing) return;
    plot.best = best;
    savePlots(plots);
  }

  /** A drawing as text, to tell whether it changed. */
  private drawingKey(d: Drawing) {
    return JSON.stringify([d.path, d.soil]);
  }

  /** Plants this week's garden (`weekly`) or the drawn plot in `slot`, afresh. */
  private plantPlot(weekly: boolean, slot: number | null) {
    ui('click');
    this.leaveDaily();
    this.scene.restart({ daily: false, weekly, plot: slot } satisfies StartData);
  }

  /**
   * The plots overlay (GG18, GG19), opened from the garden picker: the weekly garden's card and a
   * card per drawn plot, each with its own best wave. A drawn plot's card plants it and its Edit
   * tag opens the editor; an empty or unfinished one opens the editor. Back opens the picker again.
   */
  private showPlots(back: PickerMode) {
    this.hideBanner();
    this.closePicker();
    this.plotBox?.destroy();
    const parts: Phaser.GameObjects.GameObject[] = [this.dim()];
    parts.push(
      this.add
        .text(VIEW.w / 2, 104, t('plotsTitle'), { fontFamily: FONT, fontStyle: 'bold', fontSize: '30px', color: '#f2c44a', stroke: '#3a2008', strokeThickness: 6 })
        .setOrigin(0.5),
      this.add
        .text(VIEW.w / 2, 164, t('plotsText'), { fontFamily: FONT, fontStyle: 'bold', fontSize: '15px', color: '#fbefd6', align: 'center' })
        .setOrigin(0.5)
        .setLineSpacing(5)
        .setWordWrapWidth(VIEW.w - 60),
    );
    const { y, h } = GARDEN_CARD;
    const { w, gap } = GRAFT_CARD;
    const at = (i: number) => VIEW.w / 2 + (i - (PLOT.slots + 1 - 1) / 2) * (w + gap);
    const s = this.state;

    // The weekly garden.
    const week = weeklyGarden(weekOf(today()), GARDENS.length);
    const best = loadWeekly(week.week);
    const wx = at(0);
    if (s.weekly) parts.push(this.add.image(wx, y, 'graft-rim'));
    const weekly = this.add.image(wx, y, 'graft');
    weekly.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.plantPlot(true, null));
    parts.push(weekly, this.press(wx, y - 80, t('weeklyName'), 16, '#3a2a18', [0.5, 0.5]), this.miniMap(GARDENS[week.garden], wx, y - 18, true));
    parts.push(
      this.press(wx, y + 40, t(GARDENS[week.garden].name), 12.5, '#3a2a18', [0.5, 0.5]),
      this.press(wx, y + 57, t('weeklyTwist', { twist: t(TWIST_INFO[week.twist].name) }), 10.5, '#7a2a4a', [0.5, 0.5]),
      this.press(wx, y + 80, best ? t('weeklyBest', { n: best }) : t('weeklyNone'), 11, '#4a6a24', [0.5, 0.5]),
    );

    // The drawn plots.
    loadPlots().forEach((plot, slot) => {
      const x = at(slot + 1);
      const ok = !!plot && drawingOk(plot, PLOT.minPath, PLOT.soil);
      if (s.plot?.slot === slot) parts.push(this.add.image(x, y, 'graft-rim'));
      const card = this.add.image(x, y, ok ? 'graft' : 'graft-dim');
      card.setInteractive({ useHandCursor: true }).on('pointerdown', () => (ok ? this.plantPlot(false, slot) : this.openEditor(slot, back)));
      parts.push(card, this.press(x, y - 80, t('slotName', { n: slot + 1 }), 16, '#3a2a18', [0.5, 0.5]));
      if (ok) {
        parts.push(this.miniMap(drawnGarden(plot), x, y - 18, true));
        parts.push(this.press(x, y + 48, t('plantIt'), 13, '#3a2a18', [0.5, 0.5]));
        parts.push(this.press(x, y + 74, plot.best ? t('plotBest', { n: plot.best }) : t('plotNoBest'), 11, '#4a6a24', [0.5, 0.5]));
        // The Edit tag under the card opens the editor on it.
        const ty = y + h / 2 + 24;
        const tag = this.add.image(x, ty, 'pill').setScale(0.8, 1.6);
        tag.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openEditor(slot, back));
        parts.push(tag, this.press(x, ty, t('editTag'), 11, '#4a2e18', [0.5, 0.5]));
      } else {
        parts.push(this.press(x, y, t(plot ? 'slotUnfinished' : 'slotEmpty'), 11.5, '#5a4a34', [0.5, 0.5]).setAlign('center').setWordWrapWidth(w - 30));
      }
    });
    parts.push(
      makeButton(this, VIEW.w / 2, 492, t('back'), () => {
        ui('click');
        this.closePlots();
        this.showPicker(back);
      }),
    );
    this.plotBox = this.add.container(0, 0, parts).setDepth(UI_DEPTH + 10);
  }

  private closePlots() {
    this.plotBox?.destroy();
    this.plotBox = null;
  }

  private openEditor(slot: number, back: PickerMode) {
    ui('click');
    this.showEditor(slot, back);
  }

  /**
   * The garden editor (GG18): a blank plot of grass to draw a path on, cell by cell from the first
   * column to the Heartwood, and soil beds beside it. Plant it saves the drawing and plants it; Back
   * saves it and goes back to the plots. A changed drawing starts its best wave afresh.
   */
  private showEditor(slot: number, back: PickerMode) {
    this.closePlots();
    const saved = loadPlots()[slot];
    const d: Drawing = { path: saved ? [...saved.path] : [], soil: saved ? [...saved.soil] : [] };
    const before = this.drawingKey(d);
    let tool: Tool = 'path';
    const { x: gx, y: gy, cell } = EDITOR;
    const parts: Phaser.GameObjects.GameObject[] = [this.dim()];
    parts.push(
      this.add
        .text(VIEW.w / 2, 72, t('editorTitle', { n: slot + 1 }), { fontFamily: FONT, fontStyle: 'bold', fontSize: '26px', color: '#f2c44a', stroke: '#3a2008', strokeThickness: 6 })
        .setOrigin(0.5),
    );
    const help = this.add
      .text(VIEW.w / 2, 118, '', { fontFamily: FONT, fontStyle: 'bold', fontSize: '13px', color: '#fbefd6', align: 'center' })
      .setOrigin(0.5)
      .setWordWrapWidth(VIEW.w - 140);
    const grid = this.add.graphics();
    const zone = this.add.zone(gx, gy, GRID.cols * cell, GRID.rows * cell).setOrigin(0).setInteractive({ useHandCursor: true });
    const status = this.press(VIEW.w / 2, 458, '', 12, '#fbefd6', [0.5, 0.5]);
    parts.push(help, grid, zone, status);

    // The tool tags: Path, Soil and Clear.
    const tags = (['path', 'soil', 'clear'] as const).map((id, i) => {
      const x = VIEW.w / 2 + (i - 1) * 150;
      const bg = this.add.image(x, EDITOR.tools, 'pill').setScale(0.8, 1.7);
      const label = this.press(x, EDITOR.tools, t(id === 'path' ? 'toolPath' : id === 'soil' ? 'toolSoil' : 'toolClear'), 13, '#4a2e18', [0.5, 0.5]);
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        ui('click');
        if (id === 'clear') d.path.length = d.soil.length = 0;
        else tool = id;
        draw();
      });
      parts.push(bg, label);
      return { id, bg };
    });

    const draw = () => {
      const ok = drawingOk(d, PLOT.minPath, PLOT.soil);
      help.setText(t(tool === 'path' ? 'editorPathHelp' : 'editorSoilHelp'));
      for (const tag of tags) tag.bg.setTint(tag.id === tool ? 0xf2c44a : 0xffffff);
      status.setText(t('editorStatus', { path: d.path.length, min: PLOT.minPath, soil: d.soil.length, max: PLOT.soil })).setColor(ok ? '#b8e890' : '#fbefd6');
      grid.clear();
      grid.fillStyle(0x1a0e06, 0.35).fillRoundedRect(gx - 4, gy - 1, GRID.cols * cell + 10, GRID.rows * cell + 10, 10);
      grid.fillStyle(0x6fae4a).fillRoundedRect(gx - 6, gy - 6, GRID.cols * cell + 12, GRID.rows * cell + 12, 10);
      for (let r = 0; r < GRID.rows; r++) {
        for (let c = 0; c < GRID.cols; c++) {
          grid.lineStyle(1, 0x3e7a2c, 0.5).strokeRect(gx + c * cell, gy + r * cell, cell, cell);
        }
      }
      for (const [c, r] of d.soil) grid.fillStyle(0x7a4c2c).fillRoundedRect(gx + c * cell + 3, gy + r * cell + 3, cell - 6, cell - 6, 5);
      for (const [c, r] of d.path) grid.fillStyle(0xd8b27a).fillRect(gx + c * cell, gy + r * cell, cell, cell);
      if (d.path.length) {
        // Where pests come in, the way the path runs, and the Heartwood at its end.
        const r0 = d.path[0][1];
        grid.fillStyle(0xd8b27a).fillRect(gx - 14, gy + r0 * cell + 4, 14, cell - 8);
        grid.lineStyle(3, 0x8a6a3a, 0.8).beginPath();
        grid.moveTo(gx - 10, gy + r0 * cell + cell / 2);
        for (const [c, r] of d.path) grid.lineTo(gx + c * cell + cell / 2, gy + r * cell + cell / 2);
        grid.strokePath();
        const [hc, hr] = d.path[d.path.length - 1];
        grid.fillStyle(0x3e8c3e).fillCircle(gx + hc * cell + cell / 2, gy + hr * cell + cell / 2, cell * 0.36);
        this.bead(grid, gx + hc * cell + cell / 2 - 3, gy + hr * cell + cell / 2 - 4, 3.5, 0xf2c44a);
      }
    };
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      const col = Math.floor((p.worldX - gx) / cell);
      const row = Math.floor((p.worldY - gy) / cell);
      if (editDrawing(d, tool, col, row, PLOT.soil)) sfx(tool === 'path' ? 'select' : 'rustle');
      else ui('refuse');
      draw();
    });
    draw();

    // Keeps the drawing in its slot; a changed one starts its best afresh, and an empty one empties the slot.
    const keep = () => {
      const plots = loadPlots();
      const same = this.drawingKey(d) === before;
      const plot: SavedPlot | null = d.path.length || d.soil.length ? { ...d, best: same ? (plots[slot]?.best ?? 0) : 0 } : null;
      plots[slot] = plot;
      savePlots(plots);
    };
    const bx = BUTTON.w / 2 + 8;
    parts.push(
      makeButton(this, VIEW.w / 2 - bx, 500, t('plantIt'), () => {
        if (!drawingOk(d, PLOT.minPath, PLOT.soil)) return ui('refuse');
        keep();
        this.plantPlot(false, slot);
      }),
      makeButton(this, VIEW.w / 2 + bx, 500, t('back'), () => {
        ui('click');
        keep();
        this.showPlots(back);
      }),
    );
    this.plotBox = this.add.container(0, 0, parts).setDepth(UI_DEPTH + 10);
  }

  /** Leaving a daily plot half way through ends today's try with the score so far. */
  private leaveDaily() {
    const s = this.state;
    if (s.daily && s.phase !== 'over') finishDaily(GAME, dailyScore(s));
  }

  /** The daily plot's banner as it starts: its garden, the forms its seeds grow into and the scoring. */
  private announceDaily() {
    const s = this.state;
    const plot = s.daily!;
    const forms = this.joinOr(GOLEMS.map((kind) => t(FORM_INFO[plot.forms[kind]].name)));
    this.announce([
      t(plot.thorny ? 'dailyBannerThorny' : 'dailyBanner', { garden: t(gardenOf(s).name) }),
      t('dailySeeds', { forms }),
      t('dailyRules', { waves: DAILY.waves, perWave: DAILY.perWave, perLeaf: DAILY.perLeaf }),
    ], 2.5);
  }

  /** A list of names as "A, B or C". */
  private joinOr(names: string[]) {
    if (names.length <= 1) return names[0] ?? '';
    return t('formsOr', { a: names.slice(0, -1).join(', '), b: names[names.length - 1] });
  }

  /**
   * The golem grafts (GG15), opened from the garden picker: a card per graft, bought for good with
   * a laurel each. Back opens the picker again in the mode it was in.
   */
  private showGrafts(back: PickerMode) {
    this.closePicker();
    this.graftBox?.destroy();
    const s = this.state;
    const owned = loadGrafts();
    const total = laurelsFree(s.laurels, []);
    const parts: Phaser.GameObjects.GameObject[] = [this.dim()];
    parts.push(
      this.add
        .text(VIEW.w / 2, 104, t('graftsTitle'), { fontFamily: FONT, fontStyle: 'bold', fontSize: '30px', color: '#f2c44a', stroke: '#3a2008', strokeThickness: 6 })
        .setOrigin(0.5),
      this.add
        .text(VIEW.w / 2, 164, `${t('graftsText')}\n${t('laurelsLeft', { n: laurelsFree(s.laurels, owned), total })}`, {
          fontFamily: FONT,
          fontStyle: 'bold',
          fontSize: '15px',
          color: '#fbefd6',
          align: 'center',
        })
        .setOrigin(0.5)
        .setLineSpacing(5),
    );
    const { y } = GARDEN_CARD;
    const { w, gap } = GRAFT_CARD;
    GRAFTS.forEach((graft, i) => {
      const x = VIEW.w / 2 + (i - (GRAFTS.length - 1) / 2) * (w + gap);
      const have = owned.includes(graft);
      const can = canGraft(s.laurels, owned, graft);
      if (have) parts.push(this.add.image(x, y, 'graft-rim'));
      const card = this.add.image(x, y, have || can ? 'graft' : 'graft-dim');
      card.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.buyGraft(graft, back));
      const info = GRAFT_INFO[graft];
      parts.push(card, this.press(x, y - 78, t(info.name), 16, '#3a2a18', [0.5, 0.5]), ...this.graftIcon(graft, x, y - 22));
      parts.push(this.press(x, y + 40, t(info.blurb), 10, '#7a5a34', [0.5, 0.5]).setAlign('center').setWordWrapWidth(w - 22));
      const caption = t(have ? 'graftOwned' : can ? 'graftBuy' : 'graftNeeds');
      parts.push(this.press(x, y + 82, caption, 12, have ? '#3e8c3e' : can ? '#4a6a24' : '#5a4a34', [0.5, 0.5]));
    });
    parts.push(
      makeButton(this, VIEW.w / 2, 492, t('back'), () => {
        ui('click');
        this.graftBox?.destroy();
        this.graftBox = null;
        this.showPicker(back);
      }),
    );
    this.graftBox = this.add.container(0, 0, parts).setDepth(UI_DEPTH + 10);
  }

  /** A graft card's picture: the golem with its third form's bead, or a sprout for the Seedling. */
  private graftIcon(graft: Graft, x: number, y: number): Phaser.GameObjects.GameObject[] {
    if (graft === 'seedling') return [this.add.image(x, y + 8, 'sprout').setScale(1.5)];
    const form = FORM_INFO[graft];
    const bead = this.add.graphics();
    this.bead(bead, x + 20, y - 22, 6, form.colour);
    return [this.add.image(x, y + 26, `golem-${form.of}`).setOrigin(GOLEM_ORIGIN.x, GOLEM_ORIGIN.y), bead];
  }

  /** Buys a graft with a laurel, for good; it counts at once outside the daily plot. */
  private buyGraft(graft: Graft, back: PickerMode) {
    const s = this.state;
    const owned = loadGrafts();
    if (!canGraft(s.laurels, owned, graft)) return ui('refuse');
    owned.push(graft);
    saveGrafts(owned);
    if (!s.daily) {
      s.grafts = [...owned];
      // A Seedling bought before this garden's first golem frees its first seed too.
      if (graft === 'seedling' && !s.golems.length && s.wave === 1 && s.phase === 'build') s.freeSeed = true;
    }
    sfx('boon');
    ui('coin');
    this.showGrafts(back);
    this.refresh();
  }

  /**
   * The boon pick after a Queen Slug wave: three cards, one taken for the rest of the garden. The
   * game stands still until one is picked.
   */
  private showBoons() {
    const s = this.state;
    this.picked = null;
    this.moving = null;
    this.formMenu = false;
    // The wave's banner would show through behind the title; the pick's own banner follows it.
    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(0);
    const dim = this.dim();
    const title = this.add
      .text(VIEW.w / 2, 104, t('boonTitle'), { fontFamily: FONT, fontStyle: 'bold', fontSize: '30px', color: '#f2c44a', stroke: '#3a2008', strokeThickness: 6 })
      .setOrigin(0.5);
    const taken = s.boons.length ? `\n${t('boonsTaken', { list: s.boons.map((b) => t(BOON_INFO[b].name)).join(', ') })}` : '';
    const text = this.add
      .text(VIEW.w / 2, 166, t('boonText') + taken, {
        fontFamily: FONT,
        fontStyle: 'bold',
        fontSize: '15px',
        color: '#fbefd6',
        align: 'center',
      })
      .setOrigin(0.5)
      .setLineSpacing(5);
    const parts: Phaser.GameObjects.GameObject[] = [dim, title, text];
    const { y, w, gap } = GARDEN_CARD;
    s.offer.forEach((boon, i) => {
      const x = VIEW.w / 2 + (i - (s.offer.length - 1) / 2) * (w + gap);
      const card = this.add.image(x, y, 'gcard');
      card.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (takeBoon(s, boon)) sfx('boon');
        this.boonBox?.destroy();
        this.boonBox = null;
        this.announce([t('boonBanner', { name: t(BOON_INFO[boon].name) }), t(BOON_INFO[boon].blurb)]);
        this.refresh();
      });
      const info = BOON_INFO[boon];
      parts.push(card, this.press(x, y - 76, t(info.name), 18, '#3a2a18', [0.5, 0.5]), this.boonIcon(boon, x, y - 22));
      parts.push(this.press(x, y + 36, t(info.blurb), 11, '#7a5a34', [0.5, 0.5]).setAlign('center').setWordWrapWidth(w - 28));
      parts.push(this.press(x, y + 76, this.boonDetail(boon), 12.5, '#4a6a24', [0.5, 0.5]));
    });
    this.boonBox = this.add.container(0, 0, parts).setDepth(UI_DEPTH + 10);
    this.refresh();
  }

  /** A boon card's picture: the golem, hedge, flower, leaf or sap drop it is about. */
  private boonIcon(boon: Boon, x: number, y: number) {
    if (boon === 'moss' || boon === 'pebble') return this.add.image(x, y + 26, `golem-${boon}`).setOrigin(GOLEM_ORIGIN.x, GOLEM_ORIGIN.y);
    if (boon === 'hedge') return this.add.image(x, y + 22, 'hedge').setOrigin(0.5, 54 / 64);
    return this.add.image(x, y, boon === 'sun' ? 'bloom' : boon === 'leaf' ? 'leaf' : 'sap').setScale(2);
  }

  /** What a boon would do in this garden now, under its blurb. */
  private boonDetail(boon: Boon) {
    const s = this.state;
    const times = boonCount(s, boon);
    const again = (detail: string) => (times ? t('boonTaken', { detail, n: times }) : detail);
    if (boon === 'sun') return t('boonSun', { row: sunRow(s) + 1 });
    if (boon === 'leaf') return t('boonLeaves', { heart: s.heart, max: START_HEART });
    if (boon === 'moss') return again(t('boonMoss', { pct: Math.round((1 + BOON.mossSlow * (times + 1)) * 100) }));
    if (boon === 'hedge') return again(t('boonHedge', { hp: Math.round(HEDGE.hp * (1 + BOON.hedgeHp * (times + 1))) }));
    if (boon === 'pebble') return again(t('boonPebble', { pct: Math.round(BOON.pebbleDamage * (times + 1) * 100) }));
    return again(t('boonCompost', { cap: compostCap(s) + BOON.compostCap }));
  }

  /** A warm stripe along each row a Sunny row boon shines on. */
  private drawSun() {
    const g = this.sunGfx.clear();
    for (const row of this.state.sunRows) {
      g.fillStyle(0xffe08a, 0.14).fillRect(GRID.x, GRID.y + row * GRID.cell, GRID.cols * GRID.cell, GRID.cell);
    }
  }

  /** `n` of three stars, as filled and empty stars. */
  private starText(n: number) {
    return '★'.repeat(n) + '☆'.repeat(3 - n);
  }

  /** Hides the banner: one still showing would run through an overlay's title. */
  private hideBanner() {
    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(0);
  }

  private closePicker() {
    this.picker?.destroy();
    this.picker = null;
  }

  /** A garden's map in miniature: grass, its soil beds, its paths and the Heartwood. */
  private miniMap(garden: Garden, x: number, y: number, open: boolean) {
    const { map, heart } = garden;
    const c = 12;
    const left = x - (GRID.cols * c) / 2;
    const top = y - (GRID.rows * c) / 2;
    const g = this.add.graphics().setAlpha(open ? 1 : 0.55);
    g.fillStyle(0x1a0e06, 0.3).fillRoundedRect(left - 3, top - 1, GRID.cols * c + 8, GRID.rows * c + 8, 7);
    g.fillStyle(0x6fae4a).fillRoundedRect(left - 4, top - 4, GRID.cols * c + 8, GRID.rows * c + 8, 7);
    for (let r = 0; r < GRID.rows; r++) {
      for (let col = 0; col < GRID.cols; col++) {
        if (map[r][col] === 'soil') g.fillStyle(0x7a4c2c, 0.55).fillRoundedRect(left + col * c + 2, top + r * c + 2, c - 4, c - 4, 2);
        else if (map[r][col] !== 'grass') g.fillStyle(0xd8b27a).fillRect(left + col * c, top + r * c, c, c);
      }
    }
    for (const route of garden.routes) {
      const [, row] = route.corners[0];
      g.fillStyle(0xd8b27a).fillRect(left - 4, top + row * c, 4, c);
    }
    g.fillStyle(0x3e8c3e).fillCircle(left + heart.col * c + c / 2, top + heart.row * c + c / 2, c * 0.62);
    g.fillStyle(0xf2c44a).fillCircle(left + heart.col * c + c / 2 - 2, top + heart.row * c + c / 2 - 2, 2);
    return g;
  }

  /**
   * Opens the garden picker: from the garden tag ('choose', with a Back button), at the harvest
   * ('harvest', with a Keep going button) or when the Heartwood falls ('over').
   */
  private showPicker(mode: PickerMode) {
    this.hideBanner();
    this.picked = null;
    this.moving = null;
    this.formMenu = false;
    this.closePicker();
    this.refresh();
    this.picker = this.createPicker(mode);
  }

  /** Rewrites the HUD and panel from the state. */
  private refresh() {
    const s = this.state;
    if (s.best > this.savedBest) saveBest((this.savedBest = s.best));
    if (s.bloom > this.savedBloom) saveBloom((this.savedBloom = s.bloom));
    if (s.stars.join(',') !== this.savedStars) {
      this.savedStars = s.stars.join(',');
      saveStars(s.stars);
    }
    if (s.laurels.join(',') !== this.savedLaurels) {
      this.savedLaurels = s.laurels.join(',');
      saveLaurels(s.laurels);
    }
    if (s.wild.join(',') !== this.savedWild) {
      this.savedWild = s.wild.join(',');
      saveWild(s.wild);
    }
    // The weekly garden and drawn plots keep their own best wave.
    if (s.cleared > this.savedOwn) this.saveOwnBest((this.savedOwn = s.cleared));
    this.hud.wave.setText(t('waveTag', { n: s.wave }));
    this.hud.waveSub.setText(
      s.daily
        ? t('dailyAt', { wave: DAILY.waves })
        : s.weekly
          ? t('weeklySub', { best: this.savedOwn })
          : s.plot
            ? t('plotSub', { best: this.savedOwn })
            : s.wave > HARVEST_WAVE
          ? t('wildSub', { best: s.wild[s.garden] })
          : s.harvest
            ? t('harvested', { stars: this.starText(s.harvest) })
            : t(s.thorny ? 'laurelAt' : 'harvestAt', { wave: HARVEST_WAVE }),
    );
    this.hud.heart.setText(formatNumber(s.heart));
    this.hud.regrow.setVisible(canRegrow(s));
    const sap = formatNumber(s.sap);
    if (sap !== this.hud.sap.text) {
      // Thousands of sap shrink to stay on the sap tag, clear of the bloom tag beside it.
      this.hud.sap.setFontSize(20).setText(sap);
      for (let size = 19; size >= 11 && this.hud.sap.width > HUD.sap.x + HUD.sap.w - 6 - HUD.sap.text; size--) this.hud.sap.setFontSize(size);
    }
    this.hud.best.setText(t('best', { n: s.best }));
    this.hud.stars.setText(`${totalStars(s)} ★`);
    const full = s.bloom >= BLOOM_GOAL;
    this.hud.bloom.setText(full ? t('bloomFull') : t('bloomCount', { n: s.bloom, goal: BLOOM_GOAL }));
    this.hud.bloomSub.setText(t(full ? 'thornUnlocked' : 'unlocksThorn'));
    this.hud.flowers.forEach((f, i) => f.setTexture(i < s.bloom ? 'bloom' : 'bud'));
    this.treeFlowers.forEach((f, i) => f.setTexture(i < s.bloom ? 'bloom' : 'bud'));
    this.speed.bg.setTexture(s.fast ? 'speed-on' : 'speed');
    this.speed.text.setText(`${s.fast ? FAST : 1}x`);

    for (const { kind, rim, card, open, cost, locked } of this.cards) {
      const h = SEED_BUTTONS.hs[SEEDS.indexOf(kind)];
      const isOpen = unlocked(s, kind);
      rim.setVisible(isOpen && s.selected === kind);
      // A seed the twist takes away (the hedge strip of a garden without hedges, every golem but
      // Moss and Thorn in a weekly garden with only those) stays, faded, and picks nothing.
      const faded = barred(s, kind);
      const price = seedCost(s, kind);
      card.setVisible(isOpen || faded).setTexture(isOpen && s.sap >= price ? `card-${h}` : `card-${h}-dim`);
      // The Seedling graft's free seed shows on every golem card until it is planted.
      cost?.setText(price ? formatNumber(price) : t('free'));
      open.setVisible(isOpen || faded).setAlpha(faded ? 0.35 : 1);
      locked?.setVisible(!isOpen && !faded);
    }
    if (this.lockPips) {
      const left = SEED_BUTTONS.x - SEED_BUTTONS.w / 2;
      const y = SEED_BUTTONS.ys[SEEDS.indexOf('thorn')] + 13;
      this.lockPips.clear();
      for (let i = 0; i < BLOOM_GOAL; i++) this.bead(this.lockPips, left + 58 + i * 13, y, 4, i < s.bloom ? 0xf2c44a : 0x8a8070);
    }

    this.refreshPreview();

    const early = canCallEarly(s);
    const lit = s.phase === 'build' || early;
    const n = nextWave(s);
    this.waveBg.setTexture(lit ? 'btn-wave' : 'btn-wave-off');
    const [line1, line2] =
      s.phase === 'build'
        ? [t('startWave', { n }), '']
        : early
          ? [t('callWave', { n }), t('earlyBonus', { n: EARLY_BONUS })]
          : s.phase === 'wave' && s.wave === HARVEST_WAVE && s.queue.length === 0 && ordinary(s)
            ? [t('harvestWave'), t('squashEvery')]
            : s.phase === 'wave' && s.wave === lastWave(s) && s.queue.length === 0
            ? [t('dailyLastWave'), t('squashEvery')]
            : s.phase === 'wave' && s.queue.length === 0 && queenOnPath(s)
            ? [t('waveComing', { n: s.wave }), t('squashQueen')]
            : s.phase === 'wave'
            ? [t('waveComing', { n: s.wave }), t('stillComing')]
            : [t('gardenLost'), ''];
    this.waveLabel = line2 ? `${line1}, ${line2}` : line1;
    this.waveText.setText(line1).setY(WAVE_BUTTON.y + (line2 ? -9 : 0)).setFontSize(line2 ? 13 : 15);
    this.waveSub.setText(line2).setX(WAVE_BUTTON.x + (early ? 6 : 0));
    this.waveDrop.setVisible(early);

    this.refreshMenu();
    this.hint.setText(this.hintText());
  }

  /** The next wave's preview: its pests and how many of each, and the Queen Slug in the title. */
  private refreshPreview() {
    const n = nextWave(this.state);
    const twist = twistOf(this.state);
    const key = `${n},${twist}`;
    if (key === this.previewKey) return;
    this.previewKey = key;
    const counts = waveCounts(n, twist);
    const boss = counts.queen > 0;
    this.preview.title.setText(t(boss ? 'previewQueen' : 'previewNext', { n })).setColor(boss ? '#ffd27a' : '#fbefd6');
    const kinds = PREVIEW_PESTS.filter((kind) => counts[kind] > 0);
    // Up to three kinds sit in one row; more go in two rows of three, smaller.
    const big = kinds.length <= 3;
    const scale = big ? 0.5 : 0.36;
    for (const kind of PREVIEW_PESTS) {
      const i = kinds.indexOf(kind);
      const shown = i >= 0;
      this.preview.icons[kind].setVisible(shown);
      this.preview.counts[kind].setVisible(shown);
      if (!shown) continue;
      const x = PREVIEW.x + (big ? 16 + i * 44 : 12 + (i % 3) * 43);
      const y = PREVIEW.y + (big ? 42 : 32 + Math.floor(i / 3) * 19);
      this.preview.icons[kind].setPosition(x, y + (kind === 'crow' ? 6 * scale : 0)).setScale(scale);
      this.preview.counts[kind]
        .setText(`x${counts[kind]}`)
        .setFontSize(big ? 11 : 10)
        .setPosition(x + (kind === 'slug' || kind === 'snail' ? 26 : 20) * scale, y);
    }
  }

  /** Shows the open golem's menu above it (below it near the top) with what each choice costs. */
  private refreshMenu() {
    const s = this.state;
    const g = s.phase === 'over' ? undefined : this.golemById(this.picked);
    if (!g) this.picked = null;
    this.menu.box.setVisible(!!g);
    if (!g) return;
    const { x, y } = cellCentre(g.col, g.row);
    const half = GOLEM_MENU.w / 2;
    const mx = Phaser.Math.Clamp(x, GRID.x + half, GRID.x + GRID.cols * GRID.cell - half);
    const my = g.row < 2 ? y + 62 : y - 84;
    this.menu.box.setPosition(mx, my);
    const set = (i: number, text: string, ok: boolean) => {
      const chip = this.menu.chips[i];
      chip.bg.setVisible(true).setTexture(ok ? 'chip' : 'chip-off');
      chip.text.setVisible(true).setText(text).setAlpha(ok ? 1 : 0.7);
    };
    const cost = upgradeCost(g);
    if (this.formMenu && cost !== null) {
      // Raising to level 3: pick the golem's form (one, two or, grafted, three of them), then Back.
      const forms = formsFor(s, g.kind);
      forms.forEach((form, i) => set(i, t('formChip', { form: t(FORM_INFO[form].name), cost }), s.sap >= cost));
      set(forms.length, t('back'), true);
      for (let i = forms.length + 1; i < this.menu.chips.length; i++) {
        this.menu.chips[i].bg.setVisible(false);
        this.menu.chips[i].text.setVisible(false);
      }
      return;
    }
    this.formMenu = false;
    const top = t(g.form ? FORM_INFO[g.form].name : 'maxLevel');
    const raise = cost === null ? (g.growMs > 0 ? t('raiseGrowing') : t('raiseTop', { top })) : t(picksForm(g) ? 'formPickChip' : 'raiseChip', { cost });
    set(0, raise, cost !== null && s.sap >= cost);
    const area = statsOf(s, g).area;
    set(1, area ? t('aimAll') : t('aimChip', { target: t(TARGET_INFO[g.target].name) }), !area);
    set(2, t('moveChip', { cost: MOVE_FEE }), s.sap >= MOVE_FEE);
    set(3, t('uprootChip', { n: uprootValue(g) }), true);
  }

  private hintText() {
    const s = this.state;
    const moving = this.golemById(this.moving);
    if (moving) return t('hintMove', { golem: t(GOLEM_INFO[moving.kind].lower), cost: MOVE_FEE });
    const picked = this.golemById(this.picked);
    const hovered = picked ?? (this.hover && golemAt(s, this.hover.col, this.hover.row));
    if (hovered) {
      const info = GOLEM_INFO[hovered.kind];
      const golem = t(info.name);
      // The forms a golem can take here, by name: "Boulder or Sling".
      const forms = (kind: typeof hovered.kind) => ({ forms: this.joinOr(formsFor(s, kind).map((f) => t(FORM_INFO[f].name))) });
      if (picked && this.formMenu) {
        const over = this.chipHover !== null && formsFor(s, picked.kind)[this.chipHover];
        if (over) return t('hintForm', { form: t(FORM_INFO[over].name), blurb: t(FORM_INFO[over].blurb) });
        return t('hintFormPick', forms(picked.kind));
      }
      const combo = hovered.growMs === 0 ? comboAt(s, hovered.kind, hovered.col, hovered.row) : null;
      if (hovered.form) return t('hintFormed', { form: t(FORM_INFO[hovered.form].name), golem: t(info.lower), blurb: t(FORM_INFO[hovered.form].blurb) });
      const level = hovered.growMs > 0 ? t('hintGrowing', { golem }) : t('hintLevel', { golem, n: hovered.level });
      if (combo) return t(combo === 'slowed' ? 'hintComboSlowed' : 'hintComboPricks', { golem, n: hovered.level });
      if (picked && !statsOf(s, picked).area) return t('hintAims', { level, target: t(TARGET_INFO[picked.target].blurb) });
      if (picked && picksForm(picked)) return t('hintPicksForm', { level, ...forms(picked.kind) });
      return t(picked ? 'hintTapAgain' : 'hintTapGolem', { level });
    }
    const hedge = this.hover && hedgeAt(s, this.hover.col, this.hover.row);
    if (hedge) return t('hintHedge', { n: Math.ceil(hedge.hp) });
    const twist = twistOf(s);
    if (twist === 'hedges' && this.hover && gardenOf(s).map[this.hover.row][this.hover.col] === 'path') return t(s.weekly ? 'hintNoHedgesWeek' : 'hintNoHedges');
    if (s.selected === 'hedge') return t('hintPlantHedge');
    const onHeart = this.hover && gardenOf(s).map[this.hover.row][this.hover.col] === 'heart';
    const lost = s.heart < START_HEART;
    if (onHeart || (lost && s.phase === 'build')) {
      if (!lost) return t('hintAllLeaves');
      if (s.phase !== 'build') return t('hintRegrowLater');
      return t(s.sap < regrowPrice(s) ? 'hintRegrowPoor' : 'hintRegrow', { n: regrowPrice(s) });
    }
    if (s.freeSeed) return t('hintFreeSeed');
    if (s.phase === 'build' && isBossWave(nextWave(s))) return t('hintQueen');
    if (s.phase === 'build' && s.wave >= COMPOST.fromWave) return t('hintCompost', { pct: Math.round(COMPOST.rate * 100), cap: compostCap(s) });
    return t(s.golems.length ? 'hintCombo' : 'hintPlant');
  }

  /** A little clay bead: a soft shadow, the colour and a glint. */
  private bead(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number) {
    g.fillStyle(0x1a0e06, 0.35).fillCircle(x + 1, y + 1.5, r);
    g.fillStyle(color).fillCircle(x, y, r);
    g.fillStyle(0xffffff, 0.45).fillCircle(x - r * 0.35, y - r * 0.35, r * 0.35);
  }

  /** A rounded clay bar, `done` of it filled. */
  private bar(x: number, y: number, w: number, done: number, color: number) {
    this.bars.fillStyle(0x2a1a10).fillRoundedRect(x - w / 2, y, w, 7, 3.5);
    if (done > 0) this.bars.fillStyle(color).fillRoundedRect(x - w / 2 + 1.5, y + 1.5, Math.max(4, (w - 3) * done), 4, 2);
  }

  /** A clay vine between two golems side by side that combo, with a bead in the combo's colour. */
  private vine(g: Phaser.GameObjects.Graphics, a: { col: number; row: number }, b: { col: number; row: number }, color: number) {
    const p = cellCentre(a.col, a.row);
    const q = cellCentre(b.col, b.row);
    const mx = (p.x + q.x) / 2;
    const my = (p.y + q.y) / 2 + 16;
    const along = a.row === b.row;
    const dx = along ? 18 : 0;
    const dy = along ? 0 : 18;
    g.lineStyle(5, 0x1a0e06, 0.3).lineBetween(mx - dx + 1, my - dy + 2, mx + dx + 1, my + dy + 2);
    g.lineStyle(4, 0x457a30).lineBetween(mx - dx, my - dy, mx + dx, my + dy);
    g.fillStyle(0x80c050).fillEllipse(mx - dx / 2 - (along ? 0 : 5), my - dy / 2 - (along ? 5 : 0), 9, 6);
    g.fillStyle(0x80c050).fillEllipse(mx + dx / 2 + (along ? 0 : 5), my + dy / 2 + (along ? 5 : 0), 9, 6);
    this.bead(g, mx, my, 4.5, color);
  }

  private drawGolems() {
    const s = this.state;
    const seen = new Set<number>();
    for (const g of s.golems) {
      seen.add(g.id);
      const { x, y } = cellCentre(g.col, g.row);
      let image = this.golems.get(g.id);
      if (!image) {
        image = this.add.image(x, y + FEET, 'sprout');
        this.golems.set(g.id, image);
      }
      image.setX(x).setDepth(y + FEET).setAlpha(this.moving === g.id ? 0.45 : 1);
      if (g.growMs > 0) {
        image.setTexture('sprout').setOrigin(0.5, 40 / 50).setY(y + 21);
        this.bar(x, y + 28, 40, 1 - g.growMs / GOLEM_INFO[g.kind].growMs, 0x8cd05a);
      } else {
        image.setTexture(`golem-${g.kind}`).setOrigin(GOLEM_ORIGIN.x, GOLEM_ORIGIN.y).setY(y + FEET);
        for (let i = 0; i < MAX_LEVEL; i++) this.bead(this.bars, x - 11 + i * 11, y + 31, 3.6, i < g.level ? 0xf2c44a : 0x4a5a3a);
        // A level-3 golem wears a bead in its form's colour on its shoulder.
        if (g.form) this.bead(this.bars, x + 20, y - 22, 5, FORM_INFO[g.form].colour);
        // Combos: a vine to each grown moss golem beside a pebble or thorn golem.
        if (g.kind !== 'pebble' && g.kind !== 'thorn') continue;
        for (const o of s.golems) {
          if (o.kind === 'moss' && o.growMs === 0 && Math.abs(o.col - g.col) + Math.abs(o.row - g.row) === 1) {
            this.vine(this.bars, g, o, g.kind === 'pebble' ? 0xf2c44a : 0xf2a6c8);
          }
        }
      }
    }
    for (const [id, image] of this.golems) if (!seen.has(id)) (image.destroy(), this.golems.delete(id));
  }

  /** Hedges on the path, each with its health bar as pests chew it down. */
  private drawHedges() {
    const seen = new Set<number>();
    for (const h of this.state.hedges) {
      seen.add(h.id);
      const { x, y } = cellCentre(h.col, h.row);
      let image = this.hedges.get(h.id);
      if (!image) {
        image = this.add.image(x, y + 22, 'hedge').setOrigin(0.5, 54 / 64).setDepth(y + 22);
        this.hedges.set(h.id, image);
      }
      if (h.hp < h.maxHp) this.bar(x, y - 34, 40, Math.max(0, h.hp / h.maxHp), 0x8cd05a);
    }
    for (const [id, image] of this.hedges) if (!seen.has(id)) (image.destroy(), this.hedges.delete(id));
  }

  private drawPests() {
    const s = this.state;
    const { routes } = gardenOf(s);
    const seen = new Set<number>();
    for (const p of s.pests) {
      seen.add(p.id);
      const pos = pathPoint(routes[p.route], p.dist);
      let art = this.pests.get(p.id);
      if (!art) {
        const origin = p.kind === 'queen' ? QUEEN_ORIGIN : PEST_ORIGIN;
        art = {
          // Pests in the wild garden stand bigger with every wave.
          body: this.add.image(pos.x, pos.y, `pest-${p.kind}`).setOrigin(origin.x, origin.y).setScale(wildScale(p.wave)),
          slow: this.add.image(pos.x, pos.y, 'slow').setVisible(false),
          mound: this.add.image(pos.x, pos.y, 'mound').setOrigin(35 / 70, 26 / 36).setVisible(false),
        };
        this.pests.set(p.id, art);
      }
      // A mole in its tunnel is only a heap of earth moving along the path.
      art.mound.setVisible(p.under).setPosition(pos.x, pos.y + 6).setDepth(pos.y);
      art.body.setVisible(!p.under);
      if (p.under) {
        art.slow.setVisible(false);
        continue;
      }
      // Crows hop up and down as they fly; held still with reduced motion.
      const bob = p.kind === 'crow' && !settings.reduceMotion ? Math.sin(p.dist / 8) * 3 : 0;
      const top = pos.y + bob - (PEST_TOP[p.kind] ?? 28);
      art.body.setPosition(pos.x, pos.y + bob).setDepth(pos.y).setFlipX(pos.facing < 0);
      art.slow.setVisible(p.slowMs > 0).setPosition(pos.x, top + 13).setDepth(pos.y + 1);
      if (p.hitMs > 0 && !settings.reduceMotion) art.body.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else if (p.slowMs > 0) art.body.setTint(0x9ae07a).setTintMode(Phaser.TintModes.MULTIPLY);
      else art.body.clearTint();
      if (p.hp < p.maxHp) this.bar(pos.x, top, p.kind === 'queen' ? 64 : p.kind === 'aphid' ? 18 : 30, Math.max(0, p.hp / p.maxHp), 0xf2c44a);
      // A pest stunned by a bell golem: three pale blue beads circle over it (held still with reduced motion).
      if (p.stunMs > 0) {
        const spin = settings.reduceMotion ? 0 : p.stunMs / 160;
        for (let k = 0; k < 3; k++) {
          const a = spin + (k / 3) * Math.PI * 2;
          this.bead(this.bars, pos.x + Math.cos(a) * 11, top - 7 + Math.sin(a) * 3, 3, 0xa8ecff);
        }
      }
    }
    for (const [id, art] of this.pests) {
      if (seen.has(id)) continue;
      art.body.destroy();
      art.slow.destroy();
      art.mound.destroy();
      this.pests.delete(id);
    }
  }

  /** The Queen Slug's slime on the cells she slimed, fading as it dries. */
  private drawSlime() {
    const seen = new Set<string>();
    for (const cell of this.state.slime) {
      if (cell.col < 0 || cell.row < 0 || cell.col >= GRID.cols || cell.row >= GRID.rows) continue;
      const key = `${cell.col},${cell.row}`;
      seen.add(key);
      let image = this.slimes.get(key);
      if (!image) {
        const { x, y } = cellCentre(cell.col, cell.row);
        image = this.add.image(x, y, 'slime').setDepth(3);
        this.slimes.set(key, image);
      }
      image.setAlpha(Math.min(1, cell.ms / 1500) * 0.85);
    }
    for (const [key, image] of this.slimes) if (!seen.has(key)) (image.destroy(), this.slimes.delete(key));
  }

  /** The fungus golems' spore patches on the path, fading as they wear off. */
  private drawSpores() {
    const seen = new Set<number>();
    for (const patch of this.state.spores) {
      seen.add(patch.id);
      let image = this.spores.get(patch.id);
      if (!image) {
        image = this.add.image(patch.x, patch.y, 'spores').setDepth(3).setScale(patch.r / 30);
        this.spores.set(patch.id, image);
      }
      image.setAlpha(Math.min(1, patch.ms / 600) * 0.9);
    }
    for (const [id, image] of this.spores) if (!seen.has(id)) (image.destroy(), this.spores.delete(id));
  }

  private drawShots() {
    const seen = new Set<number>();
    for (const shot of this.state.shots) {
      seen.add(shot.id);
      let image = this.shots.get(shot.id);
      if (shot.ring) {
        // A bell golem's ring spreads out to its reach and fades (only fades, with reduced motion).
        if (!image) {
          image = this.add.image(shot.from.x, shot.from.y - 10, 'shot-bell').setDepth(UI_DEPTH - 26);
          this.shots.set(shot.id, image);
        }
        const k = 1 - shot.ms / RING_MS;
        image.setScale((shot.ring / 46) * (settings.reduceMotion ? 1 : 0.3 + 0.7 * k)).setAlpha(1 - k);
        continue;
      }
      if (!image) {
        image = this.add.image(shot.from.x, shot.from.y, `shot-${shot.kind}`).setDepth(UI_DEPTH - 25);
        if (shot.kind === 'thorn') image.setRotation(Math.atan2(shot.to.y - shot.from.y, shot.to.x - shot.from.x));
        this.shots.set(shot.id, image);
      }
      // A thorn golem's second prick (a moss combo) leaves a moment after the first.
      const t = 1 - shot.ms / SHOT_MS;
      image.setVisible(t >= 0);
      const arc = shot.kind === 'thorn' ? 0 : Math.sin(t * Math.PI) * 20;
      image.setPosition(shot.from.x + (shot.to.x - shot.from.x) * t, shot.from.y + (shot.to.y - shot.from.y) * t - 6 - arc);
    }
    for (const [id, image] of this.shots) if (!seen.has(id)) (image.destroy(), this.shots.delete(id));
  }

  /**
   * Outlines the hovered cell and rings the reach of the seed it would plant, the golem on it or the
   * golem being moved there; the open golem keeps a gold outline.
   */
  private drawHover() {
    const g = this.hoverGfx.clear();
    this.ghost.setVisible(false);
    const s = this.state;
    if (s.phase === 'over') return;
    const outline = (x: number, y: number, color: number) => {
      g.lineStyle(3.5, 0x1e0e04, 0.25).strokeRoundedRect(x - 30, y - 28, 62, 62, 9);
      g.lineStyle(3, color).strokeRoundedRect(x - 31, y - 31, 62, 62, 9);
    };
    const reach = (x: number, y: number, range: number) => {
      g.fillStyle(0xfff8dc, 0.16).fillCircle(x, y, range);
      const beads = Math.round(range / 3.4);
      for (let k = 0; k < beads; k++) {
        const a = (k / beads) * Math.PI * 2;
        this.bead(g, x + Math.cos(a) * range, y + Math.sin(a) * range, 2.5, 0xfbefd6);
      }
    };
    const picked = this.golemById(this.picked) ?? this.golemById(this.moving);
    if (picked) {
      const at = cellCentre(picked.col, picked.row);
      if (this.picked !== null) reach(at.x, at.y, statsOf(s, picked).range);
      outline(at.x, at.y, 0xf2c44a);
    }
    if (!this.hover) return;
    const { col, row } = this.hover;
    const { x, y } = cellCentre(col, row);
    const golem = golemAt(s, col, row);
    if (golem) {
      if (golem !== picked) {
        reach(x, y, statsOf(s, golem).range);
        outline(x, y, 0xf2c44a);
      }
      return;
    }
    const moving = this.golemById(this.moving);
    const kind = moving?.kind ?? s.selected;
    if (kind === 'hedge') {
      // A hedge goes on the path: the ghost hedge, if the cell is a free path cell.
      if (hedgeAt(s, col, row) || gardenOf(s).map[row][col] !== 'path') return;
      const ok = this.picked === null && canPlant(s, col, row);
      if (ok) this.ghost.setTexture('hedge').setOrigin(0.5, 54 / 64).setPosition(x, y + 22).setVisible(true);
      outline(x, y, ok ? 0xfbefd6 : 0x8a7a6a);
      return;
    }
    if (gardenOf(s).map[row][col] !== 'soil') return;
    const ok = moving ? canMove(s, moving, col, row) : this.picked === null && canPlant(s, col, row);
    if (ok) {
      reach(x, y, boonedStats(s, kind, moving?.level ?? 1, moving?.form ?? null, row).range);
      this.ghost.setTexture(`golem-${kind}`).setOrigin(GOLEM_ORIGIN.x, GOLEM_ORIGIN.y).setPosition(x, y + FEET).setVisible(true);
    }
    outline(x, y, ok ? 0xfbefd6 : 0x8a7a6a);
  }

  /** A squashed pest: a splat on the path, a "+N" pop and sap droplets arcing to the sap counter. */
  private sapPop(pop: Pop) {
    const still = settings.reduceMotion;
    const splat = this.add.image(pop.x, pop.y + 5, 'splat').setDepth(2);
    this.tweens.add({ targets: splat, alpha: 0, delay: 700, duration: 700, onComplete: () => splat.destroy() });
    const label = this.add
      .text(pop.x + 12, pop.y - 21, `+${pop.sap}`, { fontFamily: FONT, fontStyle: 'bold', fontSize: '20px', color: '#ffd27a', stroke: '#5a2e08', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(UI_DEPTH - 5);
    this.tweens.add({ targets: label, alpha: 0, y: still ? label.y : label.y - 18, delay: 350, duration: 650, onComplete: () => label.destroy() });
    if (still) return;
    const from = { x: pop.x, y: pop.y - 5 };
    // The HUD's y is read as the drop flies, since `relayout` can move it meanwhile.
    const toY = () => HUD.y - this.frame.y;
    const to = { x: HUD.sap.icon };
    for (let k = 0; k < 3; k++) {
      const drop = this.add.image(from.x, from.y, 'sap').setScale(0.95 - k * 0.15).setDepth(UI_DEPTH - 4);
      this.tweens.addCounter({
        from: 0,
        to: 1,
        delay: k * 80,
        duration: DROP_MS,
        ease: 'Sine.easeIn',
        onUpdate: (tween) => {
          const t = tween.getValue() ?? 0;
          drop.setPosition(from.x + (to.x - from.x) * t, from.y + (toY() - from.y) * t - Math.sin(t * Math.PI) * 80);
        },
        onComplete: () => {
          drop.destroy();
          this.tweens.killTweensOf(this.hud.glow);
          this.hud.glow.setAlpha(1);
          this.tweens.add({ targets: this.hud.glow, alpha: 0, duration: 400 });
        },
      });
    }
  }

  /** Wave `n` was called early: the banner says its sap waits for its last pests. */
  private waveCalled(n: number) {
    const s = this.state;
    const lines = [t('waveCalled', { n: s.wave }), t('calledPending', { n, sap: waveBonus(n) + EARLY_BONUS })];
    if (isBossWave(s.wave)) lines.push(t('queenComing'));
    else if (s.wave === HARVEST_WAVE + 1 && !s.daily) lines.push(t('wildBanner'));
    this.announce(lines);
  }

  /**
   * Wave `n` is done (cleared, or called early and its last pests gone): the banner, and the
   * Heartwood's bloom if it just filled.
   */
  private waveDone(n: number, bloomBefore: number, early: boolean) {
    const s = this.state;
    const sap = waveBonus(n) + (early ? EARLY_BONUS : 0);
    const compost = s.compost ? t('compostBonus', { n: s.compost }) : '';
    const lines = [t('waveCleared', { n, sap }) + compost];
    if (n === HARVEST_WAVE && ordinary(s)) lines.push(t('harvestBanner', { stars: this.starText(s.harvest), n: s.heart }));
    // A golem that unlocks at this wave (Fungus at 10, Bell at 20), the first time it is reached.
    for (const kind of GOLEMS) {
      const at = GOLEM_INFO[kind].unlockBest;
      if (at === n && this.savedBest < at) lines.push(t('golemUnlocked', { golem: t(GOLEM_INFO[kind].name) }));
    }
    const buds = Math.min(BLOOM_GOAL, bloomBefore + 1);
    if (buds > bloomBefore) lines.push(buds >= BLOOM_GOAL ? t('bloomBanner') : t('budBanner', { n: buds, goal: BLOOM_GOAL }));
    this.announce(lines);
    // A clear jingles; a bud chimes higher for each one open, and the full bloom rings a chord.
    sfx('cleared');
    if (buds >= BLOOM_GOAL && bloomBefore < BLOOM_GOAL) sfx('bloom');
    else if (buds > bloomBefore) sfx('bud', { pitch: [1, 9 / 8, 5 / 4, 3 / 2, 5 / 3][buds - 1] ?? 1 });
  }

  /** Shows the banner over the garden for a moment. */
  private announce(lines: string[], length = 1) {
    this.banner.setText(lines.join('\n')).setFontSize(lines.length > 1 ? 22 : 24).setAlpha(1);
    this.tweens.killTweensOf(this.banner);
    this.tweens.add({ targets: this.banner, alpha: 0, delay: BANNER_MS * 0.6 * length, duration: BANNER_MS * 0.4 });
  }

  private heartHit() {
    sfx('bite');
    this.cameras.main.shake(160, 0.006);
    if (settings.reduceMotion) return;
    this.tree.setTint(0xffb08a);
    this.time.delayedCall(160, () => this.tree.clearTint());
  }
}
