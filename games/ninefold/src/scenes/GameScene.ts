import Phaser from 'phaser';
import { playMusic, playSting, ui } from '../../../../shared/audio';
import { viewFrame, viewSize } from '../../../../shared/scaling';
import { settings } from '../../../../shared/settings';
import { ASCENSION_RULES, LEVELS, MONTH_STYLE, RELIC_INFO, STYLES, STYLE_INFO, TWIST_INFO, type Level, type RelicId, type StyleId, type Twist } from '../game/catalog';
import { LESSONS } from '../game/lessons';
import { loadBoard, loadProgress, saveBoard, saveProgress } from '../game/save';
import {
  ascensionOpen, beginLesson, canEnter, canUndo, chooseStyle, clockLeft, dailyStreakNow, daysIn, undoMove, digitsLeft, enter, erase, GAUNTLET, hasTwist, hint, HINT_NOTE_MS, isRight, lessonOf, newGame,
  notesLocked, select, stampedDays, startClassic, startDaily, startDelve, startLesson, startWeekly, takeRelic, tick, toggleNotes, toMenu, weekDay, weekScores, type FloorPlan, type GameState,
} from '../game/state';
import { boxOf, dailySeed, peersOf, units, type Puzzle } from '../game/sudoku';
import type { Technique } from '../game/techniques';
import { SFX, SONG } from '../audio';
import { formatDate, formatNumber } from '../../../../shared/i18n';
import { t, type TextKey } from '../i18n';
import { checkTrophies } from '../trophies/check';
import { layoutFor, UI_DEPTH, WIDE, type Layout } from './layout';
import { hex, THEMES, type Theme } from './themes';

/** A spot the test can tap, in view pixels. */
type Spot = { x: number; y: number; w: number; h: number };
type Part = Phaser.GameObjects.GameObject & { destroy(): void };

/** The longest step the board's clock takes in one frame, so a stalled tab doesn't jump. */
const MAX_STEP_MS = 100;
/** A board in play is saved at least this often (game time), besides after every move. */
const SAVE_EVERY_MS = 5_000;

/**
 * Ninefold's only scene: the menu, the style picker, the board with its panel and the end cards,
 * all drawn in the worn style (`THEMES`). It turns taps and keys into the actions of
 * `game/state.ts`, drains `state.events` for sound and flashes, and redraws whatever changed.
 */
export class GameScene extends Phaser.Scene {
  state!: GameState;
  /** Spots for the test: the cells, the pad's digits and every button on screen, by id. */
  cellSpots: (Spot & { cell: number })[] = [];
  buttons: Record<string, Spot> = {};
  /** The screen being shown: the menu, the style picker, the technique school, the calendar or a board. */
  screen: 'menu' | 'styles' | 'school' | 'calendar' | 'board' = 'menu';
  /** The month the calendar shows, as year * 12 + month (from 0). */
  calMonth = 0;

  private vw = 960;
  private vh = 540;
  private fx = 0;
  private fy = 0;
  /** Where things go: the wide or the upright layout, whichever fits the view. */
  private L: Layout = WIDE;
  private theme!: Theme;
  private backdrop!: Phaser.GameObjects.Graphics;
  private boardG!: Phaser.GameObjects.Graphics;
  private flashG!: Phaser.GameObjects.Graphics;
  private digits: Phaser.GameObjects.Text[] = [];
  private noteTexts: Phaser.GameObjects.Text[] = [];
  /** The Killer cages' sums, one text per cage. */
  private sumTexts: Phaser.GameObjects.Text[] = [];
  /** The Sandwich sums outside the board: the rows' on the left, then the columns' on top. */
  private clueTexts: Phaser.GameObjects.Text[] = [];
  /** The ascension the menu's Delve button starts at. */
  private pickAscent = 0;
  /** Everything drawn for the current screen and overlay, rebuilt when `layerKey` changes. */
  private parts: Part[] = [];
  private layerKey = '';
  private dirty = true;
  private panelTexts: Record<string, Phaser.GameObjects.Text> = {};
  private padTexts: Phaser.GameObjects.Text[] = [];
  private flashes: { cells: number[]; age: number; color: number }[] = [];
  private lastTime = 0;
  /** The puzzle on the board, its units and each cell's peers, worked out once per board. */
  private shapeOf: { puzzle: Puzzle; units: number[][]; peers: number[][] } | null = null;
  /** The board's clock when it was last saved, so a board left alone is saved every few seconds. */
  private savedAt = 0;

  constructor() {
    super('Game');
  }

  create() {
    this.fitView();
    this.state = newGame(loadProgress());
    // A board left in play (or a relic offer between Delve floors) comes back where it stood.
    loadBoard(this.state);
    checkTrophies(this.state.progress);
    this.backdrop = this.add.graphics();
    this.boardG = this.add.graphics();
    this.flashG = this.add.graphics();
    for (let i = 0; i < 81; i++) {
      this.digits.push(this.add.text(0, 0, '', {}).setOrigin(0.5));
      this.noteTexts.push(this.add.text(0, 0, '', {}).setOrigin(0, 0));
      this.sumTexts.push(this.add.text(0, 0, '', {}).setOrigin(0, 0));
    }
    for (let i = 0; i < 18; i++) this.clueTexts.push(this.add.text(0, 0, '', {}).setOrigin(0.5));
    const now = new Date();
    this.calMonth = now.getFullYear() * 12 + now.getMonth();
    this.pickAscent = ascensionOpen(this.state.progress);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onBoardTap(p.worldX, p.worldY));
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    // A phone turned the other way round reshapes the view: lay everything out again.
    const onResize = () => {
      this.fitView();
      this.applyTheme();
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
    this.applyTheme();
  }

  /** Reads the view's size, picks the layout for its shape and keeps its frame in the middle. */
  private fitView() {
    ({ width: this.vw, height: this.vh } = viewSize(this));
    ({ x: this.fx, y: this.fy } = viewFrame(this));
    this.L = layoutFor(this.vw, this.vh);
    // The designed frame sits in the middle of the view; everything is laid out in its coordinates.
    this.cameras.main.setSize(this.scale.width, this.scale.height).setScroll(-this.fx, -this.fy);
  }

  /** The board's square: the layout's, made room in for the Sandwich sums along its top and left. */
  private get B() {
    const b = this.L.board;
    if (!this.state.puzzle?.sandwich) return b;
    const m = Math.round(b.size * 0.075);
    return { x: b.x + m, y: b.y + m, size: b.size - m, margin: m };
  }

  /** Wears the progress's style: redraws the backdrop and restyles the digits and the screen. */
  private applyTheme() {
    this.theme = THEMES[this.state.progress.style];
    this.drawDeco();
    this.layerKey = '';
    this.dirty = true;
  }

  update(time: number) {
    const dt = Math.min(MAX_STEP_MS, this.lastTime ? time - this.lastTime : 0);
    this.lastTime = time;
    tick(this.state, dt);
    this.drain();
    const key = this.currentKey();
    if (key !== this.layerKey) {
      this.layerKey = key;
      this.buildLayer();
      this.dirty = true;
    }
    if (this.dirty || Math.abs(this.state.timeMs - this.savedAt) > SAVE_EVERY_MS) {
      saveBoard(this.state);
      this.savedAt = this.state.timeMs;
    }
    if (this.dirty) {
      this.dirty = false;
      this.drawBoard();
    }
    this.updatePanel();
    this.drawFlashes(dt);
  }

  // -------------------------------------------------------------------------------------------
  // Input

  private onBoardTap(x: number, y: number) {
    const s = this.state;
    if (this.screen !== 'board' || s.phase !== 'playing' || !s.puzzle) return;
    const size = s.puzzle.size;
    const B = this.B;
    const cs = B.size / size;
    const c = Math.floor((x - B.x) / cs);
    const r = Math.floor((y - B.y) / cs);
    if (c < 0 || r < 0 || c >= size || r >= size) return;
    select(s, r * size + c);
    SFX('tap');
    this.dirty = true;
  }

  private onKey(e: KeyboardEvent) {
    const s = this.state;
    if (this.screen !== 'board' || s.phase !== 'playing' || !s.puzzle) return;
    // A browser shortcut (Ctrl/Cmd/Alt plus a key) is the browser's, not a move.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const size = s.puzzle.size;
    if (/^[1-9]$/.test(e.key)) this.enterDigit(Number(e.key));
    else if (e.key === 'n' || e.key === 'N') this.onNotes();
    else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') this.onErase();
    else if (e.key === 'h' || e.key === 'H') this.onHint();
    else if (e.key === 'u' || e.key === 'U' || e.key === 'z' || e.key === 'Z') this.onUndo();
    else if (e.key.startsWith('Arrow')) {
      const at = s.selected < 0 ? 0 : s.selected;
      let r = Math.floor(at / size);
      let c = at % size;
      if (s.selected >= 0) {
        if (e.key === 'ArrowUp') r = (r + size - 1) % size;
        if (e.key === 'ArrowDown') r = (r + 1) % size;
        if (e.key === 'ArrowLeft') c = (c + size - 1) % size;
        if (e.key === 'ArrowRight') c = (c + 1) % size;
      }
      select(s, r * size + c);
    } else return;
    this.dirty = true;
  }

  private enterDigit(d: number) {
    const s = this.state;
    if (!canEnter(s) || !s.puzzle || d > s.puzzle.size) return ui('refuse');
    if (!enter(s, d)) return ui('refuse');
    if (s.notesMode) SFX('note');
    this.dirty = true;
  }

  private onNotes() {
    if (!toggleNotes(this.state)) return ui('refuse');
    ui('click');
    this.dirty = true;
  }

  private onErase() {
    if (!erase(this.state)) return ui('refuse');
    SFX('erase');
    this.dirty = true;
  }

  private onUndo() {
    if (!canUndo(this.state) || !undoMove(this.state)) return ui('refuse');
    SFX('erase');
    this.dirty = true;
  }

  private onHint() {
    if (!hint(this.state)) ui('refuse');
    this.dirty = true;
  }

  // -------------------------------------------------------------------------------------------
  // Events: sound, flashes and saving

  private drain() {
    const s = this.state;
    for (const e of s.events.splice(0)) {
      this.dirty = true;
      switch (e.type) {
        case 'board':
          this.screen = 'board';
          break;
        case 'placed':
          SFX('place');
          break;
        case 'hint':
          SFX('hint');
          this.flashes.push({ cells: [e.cell], age: 0, color: hex(this.theme.accent) });
          break;
        case 'wrong':
          SFX(e.heart ? 'heart' : e.warded ? 'ward' : 'wrong');
          break;
        case 'clock':
          SFX('heart');
          break;
        case 'phoenix':
          SFX('relic');
          this.flashes.push({ cells: s.values.map((_, i) => i), age: 0, color: 0xf08a3c });
          break;
        case 'heal':
          SFX('unlock');
          break;
        case 'gift':
          SFX('hint');
          break;
        case 'unit':
          SFX('unit');
          this.flashes.push({ cells: e.cells, age: 0, color: 0xffffff });
          break;
        case 'solved':
          playSting(SONG, 'solved');
          this.flashes.push({ cells: s.values.map((_, i) => i), age: 0, color: 0xffffff });
          saveProgress(s.progress);
          break;
        case 'unlocked':
          SFX('unlock');
          saveProgress(s.progress);
          break;
        case 'ascended':
          SFX('unlock');
          this.pickAscent = e.ascent;
          saveProgress(s.progress);
          break;
        case 'over':
          playSting(SONG, 'over');
          saveProgress(s.progress);
          break;
        case 'relic':
          SFX('relic');
          break;
        case 'learned':
          playSting(SONG, 'solved');
          SFX('unlock');
          saveProgress(s.progress);
          break;
      }
    }
    if (this.dirty) checkTrophies(s.progress);
    const part = this.screen !== 'board' ? 'menu' : s.mode === 'delve' ? 'delve' : 'calm';
    playMusic(SONG, part);
  }

  /** Fades a light over finished rows, columns and boxes; held still with reduced motion. */
  private drawFlashes(dt: number) {
    const g = this.flashG;
    g.clear();
    const s = this.state;
    if (!s.puzzle || this.screen !== 'board') return (this.flashes = []), undefined;
    const B = this.B;
    const cs = B.size / s.puzzle.size;
    this.flashes = this.flashes.filter((f) => (f.age += dt) < 600);
    if (settings.reduceMotion) return;
    for (const f of this.flashes) {
      g.fillStyle(f.color, 0.45 * (1 - f.age / 600));
      for (const cell of f.cells) {
        const r = Math.floor(cell / s.puzzle.size);
        const c = cell % s.puzzle.size;
        g.fillRect(B.x + c * cs, B.y + r * cs, cs, cs);
      }
    }
  }

  // -------------------------------------------------------------------------------------------
  // Drawing

  /** Paints the style's backdrop over the whole view. */
  private drawDeco() {
    const g = this.backdrop.clear();
    const th = this.theme;
    const x0 = -this.fx;
    const y0 = -this.fy;
    const w = this.vw;
    const h = this.vh;
    g.fillGradientStyle(th.bg[0], th.bg[0], th.bg[1], th.bg[1], 1);
    g.fillRect(x0, y0, w, h);
    const rnd = new Phaser.Math.RandomDataGenerator(['ninefold']);
    const style = this.state.progress.style;
    switch (style) {
      case 'paper':
        g.fillStyle(0xffd27a, 0.6).fillCircle(x0 + w - 40, y0 + 20, 70);
        for (const [dy, color] of [[90, 0xe8b8a0], [50, 0xdda088]] as const) {
          g.fillStyle(color, 1).beginPath().moveTo(x0, y0 + h);
          for (let x = 0; x <= w; x += 16) g.lineTo(x0 + x, y0 + h - dy + Math.sin(x / 120 + dy) * 16);
          g.lineTo(x0 + w, y0 + h).closePath().fillPath();
        }
        break;
      case 'garden':
        g.fillStyle(0xffe25a, 1).fillCircle(x0 + w - 30, y0 + 24, 26);
        g.fillStyle(0x4f8a34, 1);
        for (let x = 0; x < w; x += 12) g.fillTriangle(x0 + x, y0 + h, x0 + x + 5, y0 + h - 22 - rnd.between(0, 14), x0 + x + 10, y0 + h);
        for (let i = 0; i < 14; i++) {
          const fx = x0 + rnd.between(0, w);
          const fy = y0 + h - rnd.between(4, 26);
          g.fillStyle([0xff5a6a, 0xffffff, 0xffd84a][i % 3], 1).fillCircle(fx, fy, 4);
        }
        break;
      case 'chalk':
        for (let i = 0; i < 160; i++) g.fillStyle(0xffffff, rnd.realInRange(0.02, 0.07)).fillCircle(x0 + rnd.between(0, w), y0 + rnd.between(0, h), rnd.between(6, 40));
        g.lineStyle(14, 0x8a5a30, 1).strokeRect(x0 + 7, y0 + 7, w - 14, h - 14);
        g.fillStyle(0xf4f2e8, 0.9).fillRoundedRect(x0 + w - 270, y0 + h - 32, 44, 9, 3);
        g.fillStyle(0xf7d96a, 0.9).fillRoundedRect(x0 + w - 210, y0 + h - 31, 30, 8, 3);
        break;
      case 'parchment':
        for (let i = 0; i < 900; i++) g.fillStyle(0x6b4a20, rnd.realInRange(0.03, 0.12)).fillRect(x0 + rnd.between(0, w), y0 + rnd.between(0, h), 2, 2);
      {
        const { board } = this.L;
        g.fillStyle(0x8a1a1a, 1).fillCircle(board.x + board.size - 6, board.y + board.size + 2, 22);
        g.lineStyle(2, 0xb33a3a, 1).strokeCircle(board.x + board.size - 6, board.y + board.size + 2, 15);
      }
        break;
      case 'pixel':
        g.fillStyle(th.bg[1], 1);
        for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 16 : 0; x < w; x += 32) g.fillRect(x0 + x, y0 + y, 16, 16);
        g.fillStyle(th.bg[0], 1).fillRect(x0, y0, 0, 0);
        break;
      case 'stars': {
        for (let i = 0; i < 240; i++) g.fillStyle(0xffffff, rnd.realInRange(0.3, 1)).fillCircle(x0 + rnd.between(0, w), y0 + rnd.between(0, h), rnd.realInRange(0.4, 1.6));
        // A constellation in the bottom right corner of the view.
        const pts = [[-360, -25], [-300, -45], [-240, -35], [-180, -60], [-100, -45]].map(([dx, dy]) => [x0 + w + dx, y0 + h + dy]);
        g.lineStyle(1.2, 0xffd76a, 0.5).beginPath().moveTo(pts[0][0], pts[0][1]);
        for (const [x, y] of pts) g.lineTo(x, y);
        g.strokePath();
        for (const [x, y] of pts) g.fillStyle(0xffd76a, 1).fillCircle(x, y, 3);
        break;
      }
      case 'stone':
        for (let i = 0; i < 1400; i++) g.fillStyle(rnd.pick([0x000000, 0xffffff]), rnd.realInRange(0.02, 0.06)).fillRect(x0 + rnd.between(0, w), y0 + rnd.between(0, h), 3, 3);
        // Lamps on the left wall and, wide, over the gap between board and panel or, upright, on the right wall.
        const lamps = this.L === WIDE ? [[x0 + 14, 270], [520, y0 + 14]] : [[x0 + 14, y0 + h / 2], [x0 + w - 14, y0 + h / 2]];
        for (const [x, y] of lamps) {
          for (let r = 140; r > 0; r -= 14) g.fillStyle(0xffb84a, 0.05).fillCircle(x, y, r);
          g.fillStyle(0xffcf5a, 1).fillTriangle(x - 6, y + 8, x, y - 14, x + 6, y + 8);
        }
        break;
      case 'neon':
        g.lineStyle(1, 0x7a2aff, 0.45);
        for (let x = -w; x < 2 * w; x += 80) g.lineBetween(x0 + w / 2 + (x - w / 2) * 0.2, y0 + h - 160, x0 + x, y0 + h);
        for (const dy of [150, 135, 115, 88, 50, 0]) g.lineBetween(x0, y0 + h - dy, x0 + w, y0 + h - dy);
        break;
      case 'almanac':
        // A wall calendar: faint day squares over the wall and a spiral binding along the top.
        g.lineStyle(1, 0x2c3e50, 0.08);
        for (let x = 0; x < w; x += 48) g.lineBetween(x0 + x, y0, x0 + x, y0 + h);
        for (let y = 0; y < h; y += 48) g.lineBetween(x0, y0 + y, x0 + w, y0 + y);
        for (let x = 24; x < w; x += 36) {
          g.fillStyle(0x2c3e50, 0.25).fillCircle(x0 + x, y0 + 12, 4);
          g.lineStyle(2.5, 0x7a8a98, 1).strokeEllipse(x0 + x, y0 + 6, 9, 18);
        }
        break;
      case 'glass':
        g.lineStyle(2, 0x6a4a20, 0.5);
        for (const spread of [0, 60]) {
          const curve = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(x0 - spread, y0 + h), new Phaser.Math.Vector2(x0 + w / 2, y0 - 120 - spread), new Phaser.Math.Vector2(x0 + w + spread, y0 + h));
          curve.draw(g, 48);
        }
        break;
    }
  }

  /** Redraws the board, its digits and notes, and the pad's counts. */
  private drawBoard() {
    const g = this.boardG.clear();
    const s = this.state;
    const th = this.theme;
    const p = s.puzzle;
    for (let i = 0; i < 81; i++) {
      this.digits[i].setVisible(false);
      this.noteTexts[i].setVisible(false);
      this.sumTexts[i].setVisible(false);
    }
    for (const clue of this.clueTexts) clue.setVisible(false);
    this.cellSpots = [];
    if (!p || this.screen !== 'board') return;
    const size = p.size;
    const B = this.B;
    const cs = B.size / size;
    const { x, y } = B;
    const f = th.frame;
    if (th.shadow) g.fillStyle(th.shadow.color, 1).fillRoundedRect(x - f + (th.shadow.dx ?? 0), y - f + th.shadow.dy, B.size + 2 * f, B.size + 2 * f, th.radius);
    g.fillStyle(th.line, 1).fillRoundedRect(x - f, y - f, B.size + 2 * f, B.size + 2 * f, th.radius);
    if (th.glow && this.state.progress.style === 'neon') {
      for (let k = 1; k <= 4; k++) g.lineStyle(k * 3, th.line, 0.12).strokeRoundedRect(x - f, y - f, B.size + 2 * f, B.size + 2 * f, th.radius);
    }
    const sel = s.selected;
    const selValue = sel >= 0 && isRight(s, sel) ? s.values[sel] : 0;
    if (this.shapeOf?.puzzle !== p) this.shapeOf = { puzzle: p, units: units(p), peers: peersOf(p) };
    const peers = new Set<number>(sel >= 0 ? this.shapeOf.peers[sel] : []);
    const done = new Set<number>();
    for (const u of s.doneUnits) for (const c of this.shapeOf.units[u]) done.add(c);
    const fontSize = Math.round(cs * (size === 9 ? 0.62 : 0.56));
    // Killer: each cage's first cell carries its sum in the top-left corner, so notes sit lower there.
    const cageOf = new Map<number, number>();
    p.cages?.forEach((cage, k) => cage.cells.forEach((c) => cageOf.set(c, k)));
    const sumAt = new Map<number, number>((p.cages ?? []).map((cage) => [cage.cells[0], cage.sum]));
    const sumSize = Math.round(cs * 0.22);
    // A lesson marks the cells that show its technique and rings the cell it unlocks.
    const lesson = lessonOf(s);
    const marks = new Set<number>(lesson && s.phase !== 'solved' ? lesson.marks : []);
    for (let i = 0; i < size * size; i++) {
      const r = Math.floor(i / size);
      const c = i % size;
      // Thick lines between boxes, thin ones elsewhere: each cell is inset from its edges.
      const left = c === 0 ? 0 : c % p.boxW === 0 ? th.thick / 2 : th.thin / 2;
      const right = c === size - 1 ? 0 : (c + 1) % p.boxW === 0 ? th.thick / 2 : th.thin / 2;
      const top = r === 0 ? 0 : r % p.boxH === 0 ? th.thick / 2 : th.thin / 2;
      const bottom = r === size - 1 ? 0 : (r + 1) % p.boxH === 0 ? th.thick / 2 : th.thin / 2;
      const cx = x + c * cs + left;
      const cy = y + r * cs + top;
      const w = cs - left - right;
      const h = cs - top - bottom;
      const wrong = s.values[i] !== 0 && !isRight(s, i);
      const base = th.boxes ? th.boxes[boxOf(p, i) % th.boxes.length] : th.cell;
      g.fillStyle(base, 1).fillRoundedRect(cx, cy, w, h, th.cellRadius);
      const tint = wrong ? th.wrongBg : i === sel ? th.sel : selValue && s.values[i] === selValue ? th.same : peers.has(i) ? th.peer : done.has(i) ? th.done : -1;
      if (tint >= 0) {
        const alpha = th.boxes && i !== sel && !wrong ? (done.has(i) && !peers.has(i) ? 0.3 : 0.22) : 1;
        g.fillStyle(tint, alpha).fillRoundedRect(cx, cy, w, h, th.cellRadius);
      }
      if (th.boxes) g.fillStyle(0xffffff, 0.08).fillRect(cx, cy, w, h / 3);
      if (marks.has(i) && !wrong && i !== sel) g.fillStyle(hex(th.accent), 0.28).fillRoundedRect(cx, cy, w, h, th.cellRadius);
      // Parity: an even cell carries a round mark behind its digit.
      if (p.even?.[i]) g.fillStyle(hex(th.note), 0.22).fillCircle(cx + w / 2, cy + h / 2, Math.min(w, h) * 0.4);
      // A wrong digit keeps its warning colour when picked; a ring in the selection colour marks it.
      if (wrong && i === sel) g.lineStyle(4, th.sel, 1).strokeRect(cx + 2, cy + 2, w - 4, h - 4);
      const v = s.values[i];
      const text = this.digits[i];
      if (v) {
        const color = wrong ? th.wrong : i === sel && th.selText ? th.selText : p.givens[i] ? th.given : th.player;
        const fontStyle = th.bold ? 'bold' : th.italicPlayer && !p.givens[i] ? 'italic' : '';
        const glowColor = th.glow === 'auto' ? color : th.glow ?? '#000';
        const blur = th.glow && !(i === sel && th.selText) ? 10 : 0;
        // Restyling re-renders the text's canvas, so only do it when the style really changed.
        const styleKey = `${th.font}|${fontSize}|${fontStyle}|${color}|${glowColor}|${blur}`;
        text.setText(String(v)).setPosition(cx + w / 2, cy + h / 2 + (th.font.includes('Courier') ? 1 : 0)).setVisible(true);
        if (text.getData('styleKey') !== styleKey) {
          text.setStyle({ fontFamily: th.font, fontSize: `${fontSize}px`, fontStyle, color }).setShadow(0, 0, glowColor, blur, false, true);
          text.setData('styleKey', styleKey);
        }
      } else if (s.notes[i]) {
        const marks: string[] = [];
        for (let d = 1; d <= size; d++) if (s.notes[i] & (1 << d)) marks.push(String(d));
        const note = this.noteTexts[i];
        const noteSize = Math.round(cs * 0.24);
        const noteColor = i === sel && th.selText ? th.selText : th.note;
        const noteKey = `${th.font}|${noteSize}|${noteColor}|${w - 6}`;
        note.setText(marks.join(' ')).setPosition(cx + 4, cy + 3 + (sumAt.has(i) ? sumSize : 0)).setVisible(true);
        if (note.getData('styleKey') !== noteKey) {
          note.setStyle({ fontFamily: th.font, fontSize: `${noteSize}px`, color: noteColor, wordWrap: { width: w - 6 } });
          note.setData('styleKey', noteKey);
        }
      }
      if (p.cages) this.drawCage(g, i, cageOf, cx, cy, w, h, x + c * cs, y + r * cs, cs);
      const sum = sumAt.get(i);
      if (sum !== undefined) {
        const label = this.sumTexts[cageOf.get(i)!];
        const sumKey = `${th.font}|${sumSize}|${th.given}`;
        label.setText(String(sum)).setPosition(cx + 3, cy + 1).setVisible(true);
        if (label.getData('styleKey') !== sumKey) {
          label.setStyle({ fontFamily: th.font, fontSize: `${sumSize}px`, color: th.given, fontStyle: 'bold' });
          label.setData('styleKey', sumKey);
        }
      }
      this.cellSpots.push({ cell: i, x: this.fx + x + c * cs + cs / 2, y: this.fy + y + r * cs + cs / 2, w: cs, h: cs });
    }
    // Thermo: a bulb on each line's first cell and a tube through the rest, under the digits.
    for (const line of p.thermos ?? []) {
      const centre = (cell: number) => [x + (cell % size) * cs + cs / 2, y + Math.floor(cell / size) * cs + cs / 2] as const;
      // Opaque, mixed from the cell and note colours, so the tube's joints don't darken where they overlap.
      const mix = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(th.cell), Phaser.Display.Color.ValueToColor(hex(th.note)), 100, 45);
      const tube = Phaser.Display.Color.GetColor(mix.r, mix.g, mix.b);
      g.fillStyle(tube, 1).lineStyle(cs * 0.26, tube, 1);
      const [bx, by] = centre(line[0]);
      g.fillCircle(bx, by, cs * 0.34);
      for (let k = 1; k < line.length; k++) {
        const [ax, ay] = centre(line[k - 1]);
        const [ex, ey] = centre(line[k]);
        g.lineBetween(ax, ay, ex, ey);
        g.fillCircle(ex, ey, cs * 0.13);
      }
    }
    // Arrow: a ring on each circle and a line from it through the arrow's cells, ending in a head.
    for (const arrow of p.arrows ?? []) {
      const centre = (cell: number) => [x + (cell % size) * cs + cs / 2, y + Math.floor(cell / size) * cs + cs / 2] as const;
      const color = hex(th.note);
      const [ox, oy] = centre(arrow.circle);
      const ring = cs * 0.4;
      g.lineStyle(Math.max(2, cs * 0.06), color, 0.85).strokeCircle(ox, oy, ring);
      const path = [centre(arrow.circle), ...arrow.cells.map(centre)];
      // The line leaves the circle at its edge.
      const [nx, ny] = path[1];
      const len = Math.hypot(nx - ox, ny - oy);
      path[0] = [ox + ((nx - ox) * ring) / len, oy + ((ny - oy) * ring) / len];
      g.lineStyle(Math.max(2, cs * 0.05), color, 0.85);
      for (let k = 1; k < path.length; k++) g.lineBetween(path[k - 1][0], path[k - 1][1], path[k][0], path[k][1]);
      const [ax, ay] = path[path.length - 2];
      const [ex, ey] = path[path.length - 1];
      const ang = Math.atan2(ey - ay, ex - ax);
      const head = cs * 0.2;
      for (const turn of [-2.5, 2.5]) g.lineBetween(ex, ey, ex + Math.cos(ang + turn) * head, ey + Math.sin(ang + turn) * head);
    }
    // Kropki: a dot on the line between two cells, white or black, each ringed in the other colour.
    for (const dot of p.dots ?? []) {
      const ra = Math.floor(dot.a / size);
      const ca = dot.a % size;
      const across = dot.b === dot.a + 1;
      const dx = x + (across ? (ca + 1) * cs : ca * cs + cs / 2);
      const dy = y + (across ? ra * cs + cs / 2 : (ra + 1) * cs);
      const rad = Math.max(4, cs * 0.11);
      g.fillStyle(dot.black ? 0x1c1c22 : 0xffffff, 1).fillCircle(dx, dy, rad);
      g.lineStyle(Math.max(1.5, cs * 0.03), dot.black ? 0xffffff : 0x1c1c22, 0.9).strokeCircle(dx, dy, rad);
    }
    // Sandwich: each row's sum at its left and each column's on top, in the margin `B` keeps.
    if (p.sandwich) {
      const m = (B as { margin?: number }).margin ?? 0;
      const clueSize = Math.round(Math.min(m * 0.62, cs * 0.4));
      const clueKey = `${th.font}|${clueSize}|${th.text}`;
      const sums = [...p.sandwich.rows, ...p.sandwich.cols];
      const off = (m - th.frame) / 2 + th.frame;
      sums.forEach((sum, k) => {
        const label = this.clueTexts[k];
        const row = k < size;
        const at = (row ? k : k - size) * cs + cs / 2;
        label.setText(String(sum)).setPosition(row ? x - off : x + at, row ? y + at : y - off).setVisible(true).setDepth(2);
        if (label.getData('styleKey') !== clueKey) {
          label.setStyle({ fontFamily: th.font, fontSize: `${clueSize}px`, color: th.text, fontStyle: 'bold' });
          label.setData('styleKey', clueKey);
        }
      });
    }
    // A lesson's target cell is ringed in the accent colour.
    if (lesson && s.phase !== 'solved') {
      const t0 = lesson.target;
      g.lineStyle(Math.max(3, cs * 0.07), hex(th.accent), 1).strokeRoundedRect(x + (t0 % size) * cs + 3, y + Math.floor(t0 / size) * cs + 3, cs - 6, cs - 6, Math.min(th.cellRadius + 2, cs / 4));
    }
    // Diagonal: both long diagonals are drawn as faint lines across the board.
    if (p.diagonal) {
      const side = B.size;
      g.lineStyle(Math.max(2, th.thick), hex(th.accent), 0.35);
      g.lineBetween(x + 4, y + 4, x + side - 4, y + side - 4).lineBetween(x + side - 4, y + 4, x + 4, y + side - 4);
    }
    const left = digitsLeft(s);
    this.padTexts.forEach((pt, k) => {
      const d = k + 1;
      const key = pt.getData('key') as Phaser.GameObjects.Graphics | undefined;
      const usable = d <= size;
      pt.setText(usable && left[d] > 0 ? String(left[d]) : '');
      key?.setAlpha(usable && left[d] > 0 ? 1 : 0.35);
    });
  }

  /**
   * Draws a Killer cage's dashed edge inside one cell (`cx`, `cy`, `w`, `h`; `ox`, `oy` is the
   * cell's outer corner, past the grid line): a side whose neighbour is in another cage gets a line
   * just inside it, and the line runs on across the grid line where the cage goes on.
   */
  private drawCage(g: Phaser.GameObjects.Graphics, cell: number, cageOf: Map<number, number>, cx: number, cy: number, w: number, h: number, ox: number, oy: number, cs: number) {
    const size = this.state.puzzle!.size;
    const r = Math.floor(cell / size);
    const c = cell % size;
    const same = (dr: number, dc: number) => {
      const rr = r + dr;
      const cc = c + dc;
      return rr >= 0 && cc >= 0 && rr < size && cc < size && cageOf.get(rr * size + cc) === cageOf.get(cell);
    };
    const d = Math.max(3, cs * 0.08);
    const x0 = same(0, -1) ? ox : cx + d;
    const x1 = same(0, 1) ? ox + cs : cx + w - d;
    const y0 = same(-1, 0) ? oy : cy + d;
    const y1 = same(1, 0) ? oy + cs : cy + h - d;
    g.lineStyle(Math.max(1.5, cs * 0.035), hex(this.theme.given), 0.85);
    const dash = (ax: number, ay: number, bx: number, by: number) => {
      const len = Math.hypot(bx - ax, by - ay);
      const step = Math.max(6, cs * 0.12);
      for (let k = 0; k < len; k += step) {
        const e = Math.min(len, k + step * 0.55);
        g.lineBetween(ax + ((bx - ax) * k) / len, ay + ((by - ay) * k) / len, ax + ((bx - ax) * e) / len, ay + ((by - ay) * e) / len);
      }
    };
    if (!same(-1, 0)) dash(x0, cy + d, x1, cy + d);
    if (!same(1, 0)) dash(x0, cy + h - d, x1, cy + h - d);
    if (!same(0, -1)) dash(cx + d, y0, cx + d, y1);
    if (!same(0, 1)) dash(cx + w - d, y0, cx + w - d, y1);
  }

  /** Sets the panel's changing texts: hearts or mistakes, the clock, hints and notes mode. */
  private updatePanel() {
    const s = this.state;
    const pt = this.panelTexts;
    if (this.screen !== 'board' || !pt.clock) return;
    const secs = Math.floor(s.timeMs / 1000);
    if (hasTwist(s, 'clock')) {
      // A Clock floor counts down to the next heart it takes.
      const left = Math.ceil(clockLeft(s) / 1000);
      pt.clock.setText(`⌛ ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`);
    } else pt.clock.setText(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`);
    pt.status.setText(
      s.mode === 'delve'
        ? '♥'.repeat(Math.max(0, s.hearts)) + '♡'.repeat(Math.max(0, s.maxHearts - s.hearts))
        : t('mistakes', { n: s.mistakes }),
    );
    pt.hint.setText(hasTwist(s, 'sealed') ? t('hintSealed') : t('hintButton', { n: s.hintsLeft }));
    pt.notes.setText(notesLocked(s) ? t('notesLocked') : s.notesMode ? t('notesOn') : t('notesOff'));
    // The relics row: the hint's technique for a few seconds, else a lesson's task or the run's relics.
    const lesson = lessonOf(s);
    const note = s.hintNote && s.timeMs - s.hintAt < HINT_NOTE_MS ? t('hintUsed', { technique: s.hintNote === 'revealed' ? t('revealed') : this.techniqueName(s.hintNote) }) : '';
    pt.relics?.setText(note || (lesson ? t(lesson.task) : s.mode === 'delve' ? this.relicLine() : ''));
  }

  private techniqueName(technique: Technique) {
    return t(`${technique}Name` as const);
  }

  private relicLine() {
    const counts = new Map<RelicId, number>();
    for (const r of this.state.relics) counts.set(r, (counts.get(r) ?? 0) + 1);
    return [...counts].map(([r, n]) => (n > 1 ? `${t(RELIC_INFO[r].name)} ×${n}` : t(RELIC_INFO[r].name))).join(' · ');
  }

  // -------------------------------------------------------------------------------------------
  // Screens and overlays

  private currentKey() {
    const s = this.state;
    // The menu's daily button depends on today's date, so the menu is rebuilt when the date changes.
    const today = this.screen === 'menu' ? dailySeed(new Date()) : 0;
    return `${this.screen}|${s.phase}|${s.progress.style}|${s.puzzle?.size ?? 0}|${s.floor}|${s.relicOffer.join()}|${s.mode}|${today}|${this.pickAscent}|${s.lesson}|${this.calMonth}`;
  }

  private buildLayer() {
    for (const part of this.parts) part.destroy();
    this.parts = [];
    this.panelTexts = {};
    this.padTexts = [];
    this.buttons = {};
    if (this.screen === 'menu') this.buildMenu();
    else if (this.screen === 'styles') this.buildStyles();
    else if (this.screen === 'school') this.buildSchool();
    else if (this.screen === 'calendar') this.buildCalendar();
    else {
      this.buildPanel();
      const phase = this.state.phase;
      if (phase === 'lesson') this.buildLessonIntro();
      if (phase === 'solved') (this.state.mode === 'lesson' ? this.buildLearned() : this.buildSolved());
      if (phase === 'relic') this.buildRelics();
      if (phase === 'over') this.buildOver();
    }
  }

  private add_<T extends Part>(part: T): T {
    this.parts.push(part);
    return part;
  }

  private text(x: number, y: number, content: string, size: number, color?: string, extra: Phaser.Types.GameObjects.Text.TextStyle = {}) {
    const th = this.theme;
    return this.add_(
      this.add
        .text(x, y, content, { fontFamily: th.font, fontSize: `${size}px`, color: color ?? th.text, fontStyle: th.bold ? 'bold' : '', align: 'center', ...extra })
        .setOrigin(0.5)
        .setDepth(UI_DEPTH + 2),
    );
  }

  /** A panel in the style's colours, with its shadow; `x`, `y` is its top-left. */
  private box(x: number, y: number, w: number, h: number, depth = UI_DEPTH, fill?: number, alpha?: number) {
    const th = this.theme;
    const g = this.add_(this.add.graphics().setDepth(depth));
    if (th.shadow && (alpha ?? th.panelAlpha) > 0.5) g.fillStyle(th.shadow.color, 1).fillRoundedRect(x + (th.shadow.dx ?? 0), y + th.shadow.dy, w, h, th.radius);
    g.fillStyle(fill ?? th.panel, alpha ?? th.panelAlpha).fillRoundedRect(x, y, w, h, th.radius);
    g.lineStyle(this.state.progress.style === 'pixel' ? 6 : 2, th.panelLine, 1).strokeRoundedRect(x, y, w, h, th.radius);
    if (this.state.progress.style === 'neon') for (let k = 1; k <= 3; k++) g.lineStyle(k * 3, th.panelLine, 0.12).strokeRoundedRect(x, y, w, h, th.radius);
    return g;
  }

  /** A key-like button centred on (x, y) that calls `onTap`; registered for the test as `id`. */
  private button(id: string, x: number, y: number, w: number, h: number, caption: string, onTap: () => void, size = 18, enabled = true) {
    const th = this.theme;
    const g = this.add_(this.add.graphics().setDepth(UI_DEPTH + 1));
    const draw = (hover: boolean) => {
      g.clear();
      const r = Math.min(th.radius, 12);
      if (th.shadow) g.fillStyle(th.shadow.color, 1).fillRoundedRect(x - w / 2 + (th.shadow.dx ?? 0) / 2, y - h / 2 + th.shadow.dy / 2, w, h, r);
      g.fillStyle(hover ? Phaser.Display.Color.ValueToColor(th.key).brighten(12).color : th.key, th.key === th.cell && th.panelAlpha === 0 ? 0 : 1);
      g.fillRoundedRect(x - w / 2, y - h / 2, w, h, r);
      g.lineStyle(this.state.progress.style === 'pixel' ? 4 : 2, th.keyLine, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, r);
    };
    draw(false);
    g.setAlpha(enabled ? 1 : 0.4);
    const label = this.text(x, y, caption, size, th.keyText);
    label.setAlpha(enabled ? 1 : 0.5);
    if (th.glow === 'auto') label.setShadow(0, 0, th.keyText, 8, false, true);
    const zone = this.add_(this.add.zone(x, y, w, h).setDepth(UI_DEPTH + 3).setInteractive({ useHandCursor: true }));
    zone.on('pointerover', () => draw(true)).on('pointerout', () => draw(false));
    zone.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      if (!enabled) return ui('refuse');
      onTap();
      this.dirty = true;
    });
    this.buttons[id] = { x: this.fx + x, y: this.fy + y, w, h };
    return { g, label, zone };
  }

  private buildMenu() {
    const p = this.state.progress;
    const th = this.theme;
    const title = this.text(this.L.menu.title.x, this.L.menu.title.y, t('title'), 58, th.accent);
    if (th.glow) title.setShadow(0, 0, th.glow === 'auto' ? th.accent : th.glow, 16, false, true);
    this.text(this.L.menu.title.x, this.L.menu.title.y + 44, t('tagline'), 17, undefined, { wordWrap: { width: this.L.menu.box.w } });
    this.box(this.L.menu.box.x, this.L.menu.box.y, this.L.menu.box.w, this.L.menu.box.h, UI_DEPTH, undefined, Math.min(th.panelAlpha, 0.85));
    const m = this.L.menu;
    const now = new Date();
    const today = dailySeed(now);
    const dailyDone = p.daily === today;
    this.button('daily', m.daily.x, m.daily.y, m.daily.w, m.daily.h, dailyDone ? t('dailyDone') : t('daily'), () => {
      ui('click');
      startDaily(this.state, new Date());
    }, m.topFont, !dailyDone);
    // The weekly gauntlet: today's board, once, and the week's total so far.
    const scores = weekScores(p, now);
    const day = weekDay(now);
    const total = formatNumber(scores.reduce((sum, v) => sum + Math.max(0, v), 0));
    const played = scores[day] >= 0;
    const weeklyCaption = `${t('weekly')}
${played ? t('weeklyDone', { total }) : t('weeklyLine', { day: day + 1, total })}`;
    const weekly = this.button('weekly', m.weekly.x, m.weekly.y, m.weekly.w, m.weekly.h, weeklyCaption, () => {
      ui('click');
      if (startWeekly(this.state, new Date())) saveProgress(this.state.progress);
    }, m.topFont, !played);
    weekly.label.setLineSpacing(2).setFontSize(m.topFont - 1);
    this.text(m.delve.x, m.levels.ys[0] - 44, t('classic'), 15);
    LEVELS.forEach((level, k) => {
      const cols = m.levels.xs.length;
      this.button(level, m.levels.xs[k % cols], m.levels.ys[Math.floor(k / cols)], m.levels.w, m.levels.h, t(level), () => {
        ui('click');
        startClassic(this.state, level as Level);
      }, m.levels.font);
    });
    const open = ascensionOpen(p);
    const ascent = Math.min(this.pickAscent, open);
    this.button('delve', m.delve.x, m.delve.y, m.delve.w, m.delve.h, ascent ? t('delveAscent', { n: ascent }) : t('delve'), () => {
      ui('click');
      startDelve(this.state, ascent);
    }, 20);
    // Once an ascension is open, the arrows either side of Delve pick where the next run starts.
    if (open) {
      this.button('ascent-down', m.ascentDown.x, m.ascentDown.y, m.ascentDown.w, m.ascentDown.h, '‹', () => {
        ui('click');
        this.pickAscent = ascent - 1;
      }, 26, ascent > 0);
      this.button('ascent-up', m.ascentUp.x, m.ascentUp.y, m.ascentUp.w, m.ascentUp.h, '›', () => {
        ui('click');
        this.pickAscent = ascent + 1;
      }, 26, ascent < open);
    }
    const delveLine = ascent ? t('ascentLine', { n: ascent, rule: t(ASCENSION_RULES[ascent - 1]) }) : p.bestFloor ? t('bestFloor', { n: p.bestFloor }) : t('delveBlurb');
    this.text(m.delve.x, m.delve.y + 40, delveLine, 13, undefined, { wordWrap: { width: m.box.w - 30 } });
    this.button('school', m.school.x, m.school.y, m.school.w, m.school.h, `${t('school')} ${p.lessons.length}/${LESSONS.length}`, () => {
      ui('click');
      this.screen = 'school';
    }, m.bottomFont);
    this.button('styles', m.styles.x, m.styles.y, m.styles.w, m.styles.h, t('stylesButton', { n: p.unlocked.length, of: STYLES.length }), () => {
      ui('click');
      this.screen = 'styles';
    }, m.bottomFont);
    this.button('calendar', m.calendar.x, m.calendar.y, m.calendar.w, m.calendar.h, t('calendar'), () => {
      ui('click');
      this.calMonth = now.getFullYear() * 12 + now.getMonth();
      this.screen = 'calendar';
    }, m.bottomFont);
    const streak = dailyStreakNow(p, today);
    const stats = t('stats', { solved: p.solved, flawless: p.flawless }) + (streak ? ` · ${t('streak', { n: streak })}` : '');
    this.text(this.L.menu.stats.x, this.L.menu.stats.y, stats, 14);
  }

  private buildStyles() {
    const p = this.state.progress;
    this.text(this.L.stylesTitle.x, this.L.stylesTitle.y, t('stylesTitle'), 30, this.theme.accent);
    this.backButton();
    STYLES.forEach((style, k) => {
      const cols = this.L.styleCards.xs.length;
      const x = this.L.styleCards.xs[k % cols];
      const y = this.L.styleCards.ys[Math.floor(k / cols)];
      const { w, h } = this.L.styleCards;
      const open = p.unlocked.includes(style);
      const worn = p.style === style;
      this.styleCard(style, x, y, w, h, open, worn);
      const zone = this.add_(this.add.zone(x, y, w, h).setDepth(UI_DEPTH + 3).setInteractive({ useHandCursor: open }));
      zone.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        if (!chooseStyle(this.state, style)) return ui('refuse');
        SFX('unlock');
        saveProgress(this.state.progress);
        this.applyTheme();
      });
      this.buttons[`style-${style}`] = { x: this.fx + x, y: this.fy + y, w, h };
    });
  }

  /** A card showing a style in its own colours: a 3x3 corner of a board, its name and its goal. */
  private styleCard(style: StyleId, x: number, y: number, w: number, h: number, open: boolean, worn: boolean) {
    const th = THEMES[style];
    const g = this.add_(this.add.graphics().setDepth(UI_DEPTH));
    g.fillStyle(th.bg[style === 'stars' || style === 'glass' || style === 'stone' ? 1 : 0], 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, 12);
    g.lineStyle(worn ? 4 : 2, worn ? hex(this.theme.accent) : 0x000000, worn ? 1 : 0.4).strokeRoundedRect(x - w / 2, y - h / 2, w, h, 12);
    const cs = this.L.styleCards.cell;
    const bx = x - w / 2 + 14;
    const by = y - (3 * cs) / 2;
    g.fillStyle(th.line, 1).fillRect(bx - 3, by - 3, 3 * cs + 6, 3 * cs + 6);
    const sample = [5, 3, 0, 6, 0, 0, 0, 9, 8];
    for (let i = 0; i < 9; i++) {
      const cx = bx + (i % 3) * cs;
      const cy = by + Math.floor(i / 3) * cs;
      g.fillStyle(th.boxes ? th.boxes[i] : i === 4 ? th.sel : th.cell, 1).fillRect(cx + 1, cy + 1, cs - 2, cs - 2);
      if (sample[i]) {
        const color = i === 7 ? th.player : th.given;
        const d = this.add_(this.add.text(cx + cs / 2, cy + cs / 2, String(sample[i]), { fontFamily: th.font, fontSize: '18px', color, fontStyle: th.bold ? 'bold' : '' }).setOrigin(0.5).setDepth(UI_DEPTH + 1));
        if (th.glow) d.setShadow(0, 0, th.glow === 'auto' ? color : th.glow, 6, false, true);
      }
    }
    // A locked style is dimmed under its name and goal, which stay readable, with a Locked tag.
    if (!open) {
      const dim = this.add_(this.add.graphics().setDepth(UI_DEPTH + 1.5));
      dim.fillStyle(0x000000, 0.5).fillRoundedRect(x - w / 2, y - h / 2, w, h, 12);
      this.add_(this.add.text(x + w / 2 - 10, y + h / 2 - 10, t('locked'), { fontFamily: th.font, fontSize: '12px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 6, y: 3 } }).setOrigin(1, 1).setDepth(UI_DEPTH + 3));
    }
    const tx = bx + 3 * cs + 16;
    const textColor = !open ? '#ffffff' : THEMES[style].panelAlpha > 0.5 && style !== 'parchment' ? th.text : th.given;
    const room = w - (tx - x + w / 2) - 10;
    const name = this.add_(this.add.text(tx, y - 30, t(STYLE_INFO[style].name), { fontFamily: th.font, fontSize: w < 260 ? '16px' : '18px', color: textColor, fontStyle: 'bold', wordWrap: { width: room } }).setOrigin(0, 0.5).setDepth(UI_DEPTH + 2));
    // A single long word (German names on the narrow cards) can't wrap, so it shrinks to fit.
    if (name.width > room) name.setScale(room / name.width);
    const line = worn ? t('worn') : open ? t('wear') : t(STYLE_INFO[style].goal);
    const goal = this.add_(this.add.text(tx, y + 14, line, { fontFamily: th.font, fontSize: '13px', color: textColor, wordWrap: { width: w - (tx - x + w / 2) - 10 } }).setOrigin(0, 0.5).setDepth(UI_DEPTH + 2));
    // A long goal on a locked card rises so its foot stays above the Locked tag (its top is about h / 2 - 30 down),
    // but never into the name above it.
    if (!open) {
      const floor = y - 30 + name.displayHeight / 2 + 2 + goal.height / 2;
      goal.setY(Math.max(floor, Math.min(y + 14, y + h / 2 - 32 - goal.height / 2)));
    }
  }

  /** A stamp: two rings and a tick, in one colour. */
  private drawStamp(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number) {
    g.lineStyle(Math.max(2, r * 0.12), color, 0.9).strokeCircle(x, y, r);
    g.lineStyle(Math.max(1, r * 0.05), color, 0.9).strokeCircle(x, y, r * 0.78);
    g.lineStyle(Math.max(2, r * 0.16), color, 0.95).beginPath().moveTo(x - r * 0.38, y + r * 0.02).lineTo(x - r * 0.1, y + r * 0.32).lineTo(x + r * 0.42, y - r * 0.32).strokePath();
  }

  private backButton() {
    this.button('back', this.L.back.x, this.L.back.y, this.L.back.w, this.L.back.h, t('back'), () => {
      ui('click');
      this.screen = 'menu';
    }, 17);
  }

  /** The technique school: a card per lesson, stamped once learned; a tap opens it. */
  private buildSchool() {
    const p = this.state.progress;
    const th = this.theme;
    const S = this.L.school;
    this.text(S.title.x, S.title.y, t('schoolTitle'), 30, th.accent);
    this.backButton();
    this.text(S.line.x, S.line.y, t('schoolLine', { n: p.lessons.length, of: LESSONS.length }), 15, undefined, { wordWrap: { width: this.L.view.w - 80 } });
    LESSONS.forEach((lesson, k) => {
      const cols = S.cards.xs.length;
      const x = S.cards.xs[k % cols];
      const y = S.cards.ys[Math.floor(k / cols)];
      const { w, h } = S.cards;
      const done = p.lessons.includes(lesson.id);
      this.box(x - w / 2, y - h / 2, w, h, UI_DEPTH, undefined, Math.max(0.9, th.panelAlpha));
      const textW = w - 150;
      this.add_(this.add.text(x - w / 2 + 20, y - 26, this.techniqueName(lesson.id), { fontFamily: th.font, fontSize: '21px', color: th.accent, fontStyle: 'bold', wordWrap: { width: textW } }).setOrigin(0, 0.5).setDepth(UI_DEPTH + 2));
      this.add_(this.add.text(x - w / 2 + 20, y + 20, t(`${lesson.id}Blurb` as TextKey), { fontFamily: th.font, fontSize: '14px', color: th.text, wordWrap: { width: textW } }).setOrigin(0, 0.5).setDepth(UI_DEPTH + 2));
      const g = this.add_(this.add.graphics().setDepth(UI_DEPTH + 1));
      const sx = x + w / 2 - 66;
      if (done) this.drawStamp(g, sx, y - 10, 34, hex(th.accent));
      else g.lineStyle(2, hex(th.text), 0.35).strokeCircle(sx, y - 10, 34);
      this.text(sx, y + 44, done ? t('lessonStamped') : t('lessonOpen'), 12, th.text).setAlpha(done ? 1 : 0.75);
      const zone = this.add_(this.add.zone(x, y, w, h).setDepth(UI_DEPTH + 3).setInteractive({ useHandCursor: true }));
      zone.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        ui('click');
        startLesson(this.state, k);
      });
      this.buttons[`lesson-${k}`] = { x: this.fx + x, y: this.fy + y, w, h };
    });
  }

  /** The calendar: a month of days, each solved daily stamped, with arrows to earlier months. */
  private buildCalendar() {
    const p = this.state.progress;
    const th = this.theme;
    const C = this.L.calendar;
    this.text(C.title.x, C.title.y, t('calendar'), 30, th.accent);
    this.backButton();
    const year = Math.floor(this.calMonth / 12);
    const month = this.calMonth % 12;
    const now = new Date();
    const thisMonth = now.getFullYear() * 12 + now.getMonth();
    const firstDay = p.dailyDays[0];
    const first = firstDay ? Math.floor(firstDay / 10_000) * 12 + (Math.floor(firstDay / 100) % 100) - 1 : thisMonth;
    this.text(C.month.x, C.month.y, formatDate(new Date(year, month, 1), { month: 'long', year: 'numeric' }), 22);
    this.button('month-prev', C.prev.x, C.prev.y, C.prev.w, C.prev.h, '‹', () => {
      ui('click');
      this.calMonth--;
    }, 24, this.calMonth > Math.min(first, thisMonth));
    this.button('month-next', C.next.x, C.next.y, C.next.w, C.next.h, '›', () => {
      ui('click');
      this.calMonth++;
    }, 24, this.calMonth < thisMonth);
    const G = C.grid;
    const head = 26;
    this.box(G.x - 12, G.y - 8, 7 * G.w + 24, head + 6 * G.h + 18, UI_DEPTH, undefined, Math.max(0.9, th.panelAlpha));
    // 1 January 2024 was a Monday, so its week names the weekdays from Monday.
    for (let k = 0; k < 7; k++) this.text(G.x + k * G.w + G.w / 2, G.y + head / 2, formatDate(new Date(2024, 0, 1 + k), { weekday: 'short' }), 13).setAlpha(0.75);
    const stamps = stampedDays(p, year, month);
    const days = daysIn(year, month);
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const today = now.getFullYear() * 12 + now.getMonth() === this.calMonth ? now.getDate() : 0;
    const g = this.add_(this.add.graphics().setDepth(UI_DEPTH + 1));
    for (let d = 1; d <= days; d++) {
      const at = offset + d - 1;
      const cx = G.x + (at % 7) * G.w;
      const cy = G.y + head + Math.floor(at / 7) * G.h;
      g.fillStyle(th.key, 1).fillRoundedRect(cx + 3, cy + 3, G.w - 6, G.h - 6, 6);
      g.lineStyle(d === today ? 3 : 1, d === today ? hex(th.accent) : th.keyLine, d === today ? 1 : 0.5).strokeRoundedRect(cx + 3, cy + 3, G.w - 6, G.h - 6, 6);
      this.add_(this.add.text(cx + 9, cy + 7, String(d), { fontFamily: th.font, fontSize: '12px', color: th.keyText }).setOrigin(0, 0).setDepth(UI_DEPTH + 2));
      if (stamps.has(d)) this.drawStamp(g, cx + G.w / 2 + 5, cy + G.h / 2 + 4, Math.min(G.w, G.h) * 0.3, hex(th.accent));
    }
    this.text(C.line.x, C.line.y, t('calendarLine', { n: stamps.size, of: days }), 16, th.accent);
    const earned = p.unlocked.includes(MONTH_STYLE);
    this.text(C.goal.x, C.goal.y, earned ? t('calendarDone') : t('calendarGoal'), 14, undefined, { wordWrap: { width: this.L.view.w - 80 } });
  }

  /** A lesson's opening card: what its technique is, and Start. */
  private buildLessonIntro() {
    const lesson = lessonOf(this.state)!;
    const th = this.theme;
    const E = this.L.end;
    this.dim();
    const from = this.parts.length;
    this.box(E.x - E.w / 2, E.y - E.h / 2, E.w, E.h, UI_DEPTH, undefined, Math.max(0.95, th.panelAlpha));
    this.text(E.x, E.y - E.h / 2 + 36, this.techniqueName(lesson.id), 28, th.accent);
    this.text(E.x, E.y - 12, t(lesson.text), 15, undefined, { wordWrap: { width: E.w - 48 } });
    this.button('start', E.x, this.L.endButtons.y, this.L.endButtons.w, this.L.endButtons.h, t('start'), () => {
      ui('click');
      beginLesson(this.state);
    });
    this.raise(from);
  }

  /** A learned lesson's card: its stamp, and on to the next lesson or back to the school. */
  private buildLearned() {
    const s = this.state;
    const lesson = lessonOf(s)!;
    const th = this.theme;
    const E = this.L.end;
    this.dim();
    const from = this.parts.length;
    this.box(E.x - E.w / 2, E.y - E.h / 2, E.w, E.h, UI_DEPTH, undefined, Math.max(0.95, th.panelAlpha));
    this.text(E.x, E.y - 100, t('learned'), 32, th.accent);
    const g = this.add_(this.add.graphics().setDepth(UI_DEPTH + 1));
    this.drawStamp(g, E.x, E.y - 38, 28, hex(th.accent));
    this.text(E.x, E.y + 22, t('learnedLine', { technique: this.techniqueName(lesson.id) }), 15, undefined, { wordWrap: { width: E.w - 48 } });
    const next = s.lesson + 1 < LESSONS.length;
    const B = this.L.endButtons;
    if (next) {
      this.button('next', B.xs[0], B.y, B.w, B.h, t('nextLesson'), () => {
        ui('click');
        startLesson(this.state, this.state.lesson + 1);
      }, 17);
    }
    this.button('done', next ? B.xs[1] : E.x, B.y, B.w, B.h, t('school'), () => {
      ui('click');
      toMenu(this.state);
      this.screen = 'school';
    });
    this.raise(from);
  }

  private buildPanel() {
    const s = this.state;
    const th = this.theme;
    const p = s.puzzle!;
    const { panel, rows, pad, dock } = this.L;
    this.box(panel.x, panel.y, panel.w, panel.h, 5);
    if (dock) this.box(dock.x, dock.y, dock.w, dock.h, 5);
    const left = (x: number, y: number, content: string, size: number, color?: string) =>
      this.add_(this.add.text(x, y, content, { fontFamily: th.font, fontSize: `${size}px`, color: color ?? th.text, fontStyle: th.bold ? 'bold' : '' }).setOrigin(0, 0.5).setDepth(UI_DEPTH + 2));
    const twistIds: Twist[] = s.mode === 'delve' ? (s.plan?.twists ?? []) : s.mode === 'weekly' && GAUNTLET[s.weekDay]?.twist ? [GAUNTLET[s.weekDay].twist!] : [];
    const modeName = { delve: t('delve'), daily: t('daily'), weekly: t('weekly'), classic: t('classic'), lesson: t('schoolTitle') }[s.mode];
    const ascent = s.mode === 'delve' && s.ascent ? [t('ascentTag', { n: s.ascent })] : [];
    const kicker = [modeName, ...ascent, ...twistIds.map((tw) => t(TWIST_INFO[tw].name))].join(' · ');
    const kickerText = left(panel.x + 24, panel.y + rows.kicker, kicker.toUpperCase(), 13).setAlpha(0.75);
    // A long kicker shrinks to stay clear of the Menu button.
    const room = this.L.menuButton.x - this.L.menuButton.w / 2 - 10 - (panel.x + 24);
    if (kickerText.width > room) kickerText.setScale(room / kickerText.width);
    const lesson = lessonOf(s);
    const heading = lesson ? this.techniqueName(lesson.id) : s.mode === 'weekly' ? t('weeklyHeading', { day: s.weekDay + 1 })
      : s.mode !== 'delve' ? t(s.level) : s.plan?.boss ? t('bossFloor', { n: s.floor }) : t('floor', { n: s.floor, size: p.size });
    const h1 = left(panel.x + 24, panel.y + rows.heading, heading, 28, th.accent);
    if (th.glow) h1.setShadow(0, 0, th.glow === 'auto' ? th.accent : th.glow, 10, false, true);
    this.button('menu', this.L.menuButton.x, this.L.menuButton.y, this.L.menuButton.w, this.L.menuButton.h, t('menu'), () => {
      ui('click');
      toMenu(this.state);
      this.screen = 'menu';
    }, 15);
    this.panelTexts.status = left(panel.x + 24, panel.y + rows.status, '', s.mode === 'delve' ? 26 : 17, s.mode === 'delve' ? th.heart : th.text);
    this.panelTexts.clock = this.add_(this.add.text(panel.x + panel.w - 24, panel.y + rows.status, '', { fontFamily: th.font, fontSize: '20px', color: th.text }).setOrigin(1, 0.5).setDepth(UI_DEPTH + 2));
    // The relics row also names a hint's technique and a lesson's task, so every board has it.
    this.panelTexts.relics = left(panel.x + 24, panel.y + rows.relics, '', 12);
    this.panelTexts.relics.setWordWrapWidth(panel.w - 48).setLineSpacing(-2);
    for (let d = 1; d <= 9; d++) {
      const k = d - 1;
      const x = pad.x + (k % pad.cols) * (pad.w + pad.gap) + pad.w / 2;
      const y = pad.y + Math.floor(k / pad.cols) * (pad.h + pad.gap) + pad.h / 2;
      const usable = d <= p.size;
      const { g } = this.button(`key-${d}`, x, y, pad.w, pad.h, String(d), () => this.enterDigit(d), 32, usable);
      const count = this.add_(this.add.text(x + pad.w / 2 - 8, y + pad.h / 2 - 5, '', { fontFamily: th.font, fontSize: '12px', color: th.keyText }).setOrigin(1, 1).setDepth(UI_DEPTH + 2).setAlpha(0.7));
      count.setData('key', g);
      this.padTexts.push(count);
    }
    const tool = this.L.tools;
    const notes = this.button('notes', tool.xs[0], tool.y, tool.w, tool.h, '', () => this.onNotes(), tool.font);
    this.panelTexts.notes = notes.label;
    this.button('erase', tool.xs[1], tool.y, tool.w, tool.h, t('erase'), () => this.onErase(), tool.font);
    this.button('undo', tool.xs[2], tool.y, tool.w, tool.h, t('undo'), () => this.onUndo(), tool.font);
    const hintButton = this.button('hint', tool.xs[3], tool.y, tool.w, tool.h, '', () => this.onHint(), tool.font);
    this.panelTexts.hint = hintButton.label;
    this.add_(this.add.text(this.L.keysHint.x, this.L.keysHint.y, t('keysHint'), { fontFamily: th.font, fontSize: '11px', color: th.text }).setOrigin(0.5).setDepth(UI_DEPTH + 2).setAlpha(0.6));
  }

  /** A dim over the whole view that swallows taps, under an end card. */
  private dim() {
    const g = this.add_(this.add.graphics().setDepth(UI_DEPTH + 10));
    g.fillStyle(0x000000, 0.45).fillRect(-this.fx, -this.fy, this.vw, this.vh);
    const zone = this.add_(this.add.zone(-this.fx, -this.fy, this.vw, this.vh).setOrigin(0).setDepth(UI_DEPTH + 10).setInteractive());
    zone.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => e.stopPropagation());
  }

  /** Raises the parts made since `from` above the dim. */
  private raise(from: number) {
    for (const part of this.parts.slice(from)) (part as unknown as Phaser.GameObjects.Components.Depth).setDepth?.(((part as unknown as { depth: number }).depth ?? 0) + 20);
  }

  private unlockedLine() {
    const fresh = this.state.newStyles;
    return fresh.length ? t('unlocked', { styles: fresh.map((st) => t(STYLE_INFO[st].name)).join(', ') }) : '';
  }

  private buildSolved() {
    const s = this.state;
    this.dim();
    const from = this.parts.length;
    this.box(this.L.end.x - this.L.end.w / 2, this.L.end.y - this.L.end.h / 2, this.L.end.w, this.L.end.h, UI_DEPTH, undefined, Math.max(0.95, this.theme.panelAlpha));
    this.text(this.L.end.x, this.L.end.y - 92, t('solved'), 34, this.theme.accent);
    const secs = Math.floor(s.timeMs / 1000);
    this.text(this.L.end.x, this.L.end.y - 46, t('solvedLine', { time: `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, mistakes: s.mistakes, hints: s.hintsUsed }), 16);
    // A gauntlet board shows its score and the week's total so far.
    const weekly = s.mode === 'weekly';
    if (weekly) this.text(this.L.end.x, this.L.end.y - 12, t('weeklyScore', { score: formatNumber(s.score), total: formatNumber(s.weekTotal) }), 20, this.theme.accent);
    // A daily stamps the calendar: say how far this month has come.
    if (s.mode === 'daily' && s.dailyDate) {
      const year = Math.floor(s.dailyDate / 10_000);
      const month = (Math.floor(s.dailyDate / 100) % 100) - 1;
      const line = t('calendarStamp', { n: stampedDays(s.progress, year, month).size, of: daysIn(year, month) });
      this.text(this.L.end.x, this.L.end.y + 22, line, 14, undefined, { wordWrap: { width: this.L.end.w - 40 } });
    }
    this.text(this.L.end.x, this.L.end.y + (weekly ? 24 : -12), this.unlockedLine(), weekly ? 14 : 16, this.theme.accent, { wordWrap: { width: this.L.end.w - 40 } });
    if (s.mode === 'classic') {
      this.button('next', this.L.endButtons.xs[0], this.L.endButtons.y, this.L.endButtons.w, this.L.endButtons.h, t('next'), () => {
        ui('click');
        startClassic(this.state, this.state.level);
      });
    }
    this.button('done', s.mode === 'classic' ? this.L.endButtons.xs[1] : this.L.end.x, this.L.endButtons.y, this.L.endButtons.w, this.L.endButtons.h, t('menu'), () => {
      ui('click');
      toMenu(this.state);
      this.screen = 'menu';
    });
    this.raise(from);
  }

  private buildRelics() {
    const s = this.state;
    this.dim();
    const from = this.parts.length;
    const th = this.theme;
    const box = this.L.relicBox;
    this.box(box.x, box.y, box.w, box.h, UI_DEPTH, undefined, Math.max(0.95, th.panelAlpha));
    this.text(box.x + box.w / 2, box.title, s.plan?.boss ? t('bossCleared', { n: s.floor }) : t('floorCleared', { n: s.floor }), 30, th.accent);
    const news = [s.ascended ? t('ascentOpened', { n: s.ascended }) : '', this.unlockedLine()].filter(Boolean).join(' ');
    const line = news || (s.plan?.boss ? `${t('heartsRestored')} ${t('takeRelic')}` : t('takeRelic'));
    this.text(box.x + box.w / 2, box.line, line, 15, news ? th.accent : th.text, { wordWrap: { width: box.w - 40 } });
    if (s.upcoming) this.text(box.x + box.w / 2, box.next, this.nextLine(s.upcoming), 14, th.text, { wordWrap: { width: box.w - 40 } });
    s.relicOffer.forEach((relic, k) => {
      // Two cards (Ascension 5) sit between the three spots.
      const xs = this.L.relicCards.xs;
      const x = s.relicOffer.length === xs.length ? xs[k] : (xs[k] + xs[k + 1]) / 2;
      const y = this.L.relicCards.y;
      const { w, h } = this.L.relicCards;
      const info = RELIC_INFO[relic];
      const g = this.add_(this.add.graphics().setDepth(UI_DEPTH + 1));
      g.fillStyle(th.key, 1).fillRoundedRect(x - w / 2, y - h / 2, w, h, Math.min(th.radius, 12));
      g.lineStyle(3, info.color, 1).strokeRoundedRect(x - w / 2, y - h / 2, w, h, Math.min(th.radius, 12));
      this.drawRelicIcon(g, relic, x, y - 50, info.color);
      this.text(x, y + 6, t(info.name), 18, th.keyText);
      this.text(x, y + 52, t(info.text), 13, th.keyText, { wordWrap: { width: w - 24 } });
      const zone = this.add_(this.add.zone(x, y, w, h).setDepth(UI_DEPTH + 3).setInteractive({ useHandCursor: true }));
      zone.on('pointerdown', (_p: unknown, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        takeRelic(this.state, relic);
      });
      this.buttons[`relic-${k}`] = { x: this.fx + x, y: this.fy + y, w, h };
    });
    this.raise(from);
  }

  /** What the next floor will be: its number and size, and each twist with its rule. */
  private nextLine(plan: FloorPlan) {
    const head = plan.boss ? t('nextBoss', { n: plan.floor }) : t('nextFloor', { n: plan.floor, size: plan.size });
    return [head, ...plan.twists.map((tw) => `${t(TWIST_INFO[tw].name)}: ${t(TWIST_INFO[tw].rule)}`)].join(' ');
  }

  /** A relic's emblem: a lantern, a heart-cut gem, an eye, a shield, two eyes, a die, a feather, a sandglass, a ring or a keystone. */
  private drawRelicIcon(g: Phaser.GameObjects.Graphics, relic: RelicId, x: number, y: number, color: number) {
    g.fillStyle(color, 1).lineStyle(3, 0x000000, 0.5);
    switch (relic) {
      case 'lantern':
        g.fillRoundedRect(x - 14, y - 16, 28, 32, 6).strokeRoundedRect(x - 14, y - 16, 28, 32, 6);
        g.fillStyle(0xfff3c0, 1).fillCircle(x, y, 7);
        g.lineStyle(3, color, 1).strokeCircle(x, y - 22, 6);
        break;
      case 'heartstone':
        g.fillCircle(x - 9, y - 6, 11).fillCircle(x + 9, y - 6, 11).fillTriangle(x - 19, y - 1, x + 19, y - 1, x, y + 20);
        break;
      case 'seer':
        g.fillEllipse(x, y, 46, 26).strokeEllipse(x, y, 46, 26);
        g.fillStyle(0x10203a, 1).fillCircle(x, y, 9);
        g.fillStyle(0xffffff, 1).fillCircle(x + 3, y - 3, 3);
        break;
      case 'ward':
        g.beginPath().moveTo(x - 18, y - 18).lineTo(x + 18, y - 18).lineTo(x + 16, y + 4).lineTo(x, y + 20).lineTo(x - 16, y + 4).closePath().fillPath().strokePath();
        break;
      case 'twin':
        for (const dx of [-13, 13]) {
          g.fillStyle(color, 1).fillEllipse(x + dx, y, 24, 16).strokeEllipse(x + dx, y, 24, 16);
          g.fillStyle(0x2a1840, 1).fillCircle(x + dx, y, 5);
        }
        break;
      case 'gambler':
        g.fillRoundedRect(x - 18, y - 18, 36, 36, 7).strokeRoundedRect(x - 18, y - 18, 36, 36, 7);
        g.fillStyle(0x2a2a2a, 1);
        for (const [dx, dy] of [[-9, -9], [0, 0], [9, 9], [9, -9], [-9, 9]]) g.fillCircle(x + dx, y + dy, 3.5);
        break;
      case 'phoenix':
        g.beginPath().moveTo(x - 6, y + 20).lineTo(x - 14, y - 4).lineTo(x - 2, y - 22).lineTo(x + 12, y - 8).lineTo(x + 8, y + 10).closePath().fillPath().strokePath();
        g.lineStyle(2, 0xffe08a, 1).lineBetween(x - 6, y + 20, x + 2, y - 14);
        break;
      case 'sandglass':
        g.fillTriangle(x - 14, y - 18, x + 14, y - 18, x, y).fillTriangle(x - 14, y + 18, x + 14, y + 18, x, y);
        g.strokeTriangle(x - 14, y - 18, x + 14, y - 18, x, y).strokeTriangle(x - 14, y + 18, x + 14, y + 18, x, y);
        g.fillStyle(0x6a4a20, 1).fillRect(x - 17, y - 21, 34, 4).fillRect(x - 17, y + 17, 34, 4);
        break;
      case 'vow':
        g.lineStyle(7, color, 1).strokeCircle(x, y + 4, 14);
        g.fillStyle(0xd8e0ea, 1).fillCircle(x, y - 12, 6);
        break;
      case 'keystone':
        g.beginPath().moveTo(x - 18, y - 16).lineTo(x + 18, y - 16).lineTo(x + 10, y + 18).lineTo(x - 10, y + 18).closePath().fillPath().strokePath();
        g.lineStyle(2, 0x000000, 0.35).lineBetween(x - 4, y - 16, x - 2, y + 18).lineBetween(x + 4, y - 16, x + 2, y + 18);
        break;
    }
  }

  private buildOver() {
    const s = this.state;
    this.dim();
    const from = this.parts.length;
    this.box(this.L.end.x - this.L.end.w / 2, this.L.end.y - this.L.end.h / 2, this.L.end.w, this.L.end.h, UI_DEPTH, undefined, Math.max(0.95, this.theme.panelAlpha));
    this.text(this.L.end.x, this.L.end.y - 92, t('runOver'), 34, this.theme.heart);
    this.text(this.L.end.x, this.L.end.y - 46, t('overLine', { n: s.floor }), 17);
    if (s.progress.bestFloor) this.text(this.L.end.x, this.L.end.y - 14, t('bestFloor', { n: s.progress.bestFloor }), 15);
    this.button('again', this.L.endButtons.xs[0], this.L.endButtons.y, this.L.endButtons.w, this.L.endButtons.h, t('delveAgain'), () => {
      ui('click');
      startDelve(this.state);
    });
    this.button('done', this.L.endButtons.xs[1], this.L.endButtons.y, this.L.endButtons.w, this.L.endButtons.h, t('menu'), () => {
      ui('click');
      toMenu(this.state);
      this.screen = 'menu';
    });
    this.raise(from);
  }
}
