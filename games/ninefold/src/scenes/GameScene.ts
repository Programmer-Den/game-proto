import Phaser from 'phaser';
import { playMusic, playSting, ui } from '../../../../shared/audio';
import { viewFrame, viewSize } from '../../../../shared/scaling';
import { settings } from '../../../../shared/settings';
import { LEVELS, RELIC_INFO, STYLES, STYLE_INFO, TWIST_INFO, type Level, type RelicId, type StyleId } from '../game/catalog';
import { loadProgress, saveProgress } from '../game/save';
import {
  canEnter, chooseStyle, clockLeft, digitsLeft, enter, erase, hasTwist, hint, isRight, newGame, select, startClassic,
  startDaily, startDelve, takeRelic, tick, toggleNotes, toMenu, type FloorPlan, type GameState,
} from '../game/state';
import { boxOf, dailySeed, peersOf, units, type Puzzle } from '../game/sudoku';
import { SFX, SONG } from '../audio';
import { t } from '../i18n';
import { layoutFor, UI_DEPTH, WIDE, type Layout } from './layout';
import { hex, THEMES, type Theme } from './themes';

/** A spot the test can tap, in view pixels. */
type Spot = { x: number; y: number; w: number; h: number };
type Part = Phaser.GameObjects.GameObject & { destroy(): void };

/** The longest step the board's clock takes in one frame, so a stalled tab doesn't jump. */
const MAX_STEP_MS = 100;

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
  /** The screen being shown: the menu, the style picker or a board. */
  screen: 'menu' | 'styles' | 'board' = 'menu';

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

  constructor() {
    super('Game');
  }

  create() {
    this.fitView();
    this.state = newGame(loadProgress());
    this.backdrop = this.add.graphics();
    this.boardG = this.add.graphics();
    this.flashG = this.add.graphics();
    for (let i = 0; i < 81; i++) {
      this.digits.push(this.add.text(0, 0, '', {}).setOrigin(0.5));
      this.noteTexts.push(this.add.text(0, 0, '', {}).setOrigin(0, 0));
    }
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
    const cs = this.L.board.size / size;
    const c = Math.floor((x - this.L.board.x) / cs);
    const r = Math.floor((y - this.L.board.y) / cs);
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
    toggleNotes(this.state);
    ui('click');
    this.dirty = true;
  }

  private onErase() {
    if (!erase(this.state)) return ui('refuse');
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
        case 'over':
          playSting(SONG, 'over');
          saveProgress(s.progress);
          break;
        case 'relic':
          SFX('relic');
          break;
      }
    }
    const part = this.screen !== 'board' ? 'menu' : s.mode === 'delve' ? 'delve' : 'calm';
    playMusic(SONG, part);
  }

  /** Fades a light over finished rows, columns and boxes; held still with reduced motion. */
  private drawFlashes(dt: number) {
    const g = this.flashG;
    g.clear();
    const s = this.state;
    if (!s.puzzle || this.screen !== 'board') return (this.flashes = []), undefined;
    const cs = this.L.board.size / s.puzzle.size;
    this.flashes = this.flashes.filter((f) => (f.age += dt) < 600);
    if (settings.reduceMotion) return;
    for (const f of this.flashes) {
      g.fillStyle(f.color, 0.45 * (1 - f.age / 600));
      for (const cell of f.cells) {
        const r = Math.floor(cell / s.puzzle.size);
        const c = cell % s.puzzle.size;
        g.fillRect(this.L.board.x + c * cs, this.L.board.y + r * cs, cs, cs);
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
    }
    this.cellSpots = [];
    if (!p || this.screen !== 'board') return;
    const size = p.size;
    const cs = this.L.board.size / size;
    const { x, y } = this.L.board;
    const f = th.frame;
    if (th.shadow) g.fillStyle(th.shadow.color, 1).fillRoundedRect(x - f + (th.shadow.dx ?? 0), y - f + th.shadow.dy, this.L.board.size + 2 * f, this.L.board.size + 2 * f, th.radius);
    g.fillStyle(th.line, 1).fillRoundedRect(x - f, y - f, this.L.board.size + 2 * f, this.L.board.size + 2 * f, th.radius);
    if (th.glow && this.state.progress.style === 'neon') {
      for (let k = 1; k <= 4; k++) g.lineStyle(k * 3, th.line, 0.12).strokeRoundedRect(x - f, y - f, this.L.board.size + 2 * f, this.L.board.size + 2 * f, th.radius);
    }
    const sel = s.selected;
    const selValue = sel >= 0 && isRight(s, sel) ? s.values[sel] : 0;
    if (this.shapeOf?.puzzle !== p) this.shapeOf = { puzzle: p, units: units(p), peers: peersOf(p) };
    const peers = new Set<number>(sel >= 0 ? this.shapeOf.peers[sel] : []);
    const done = new Set<number>();
    for (const u of s.doneUnits) for (const c of this.shapeOf.units[u]) done.add(c);
    const fontSize = Math.round(cs * (size === 9 ? 0.62 : 0.56));
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
        note.setText(marks.join(' ')).setPosition(cx + 4, cy + 3).setVisible(true);
        if (note.getData('styleKey') !== noteKey) {
          note.setStyle({ fontFamily: th.font, fontSize: `${noteSize}px`, color: noteColor, wordWrap: { width: w - 6 } });
          note.setData('styleKey', noteKey);
        }
      }
      this.cellSpots.push({ cell: i, x: this.fx + x + c * cs + cs / 2, y: this.fy + y + r * cs + cs / 2, w: cs, h: cs });
    }
    // Diagonal: both long diagonals are drawn as faint lines across the board.
    if (p.diagonal) {
      const B = this.L.board.size;
      g.lineStyle(Math.max(2, th.thick), hex(th.accent), 0.35);
      g.lineBetween(x + 4, y + 4, x + B - 4, y + B - 4).lineBetween(x + B - 4, y + 4, x + 4, y + B - 4);
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
    pt.notes.setText(s.notesMode ? t('notesOn') : t('notesOff'));
    pt.relics?.setText(this.relicLine());
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
    return `${this.screen}|${s.phase}|${s.progress.style}|${s.puzzle?.size ?? 0}|${s.floor}|${s.relicOffer.join()}|${s.mode}|${today}`;
  }

  private buildLayer() {
    for (const part of this.parts) part.destroy();
    this.parts = [];
    this.panelTexts = {};
    this.padTexts = [];
    this.buttons = {};
    if (this.screen === 'menu') this.buildMenu();
    else if (this.screen === 'styles') this.buildStyles();
    else {
      this.buildPanel();
      const phase = this.state.phase;
      if (phase === 'solved') this.buildSolved();
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
    const today = dailySeed(new Date());
    const dailyDone = p.daily === today;
    this.button('daily', this.L.menu.daily.x, this.L.menu.daily.y, this.L.menu.daily.w, this.L.menu.daily.h, dailyDone ? t('dailyDone') : t('daily'), () => {
      ui('click');
      startDaily(this.state, new Date());
    }, 20, !dailyDone);
    this.text(this.L.menu.levels.xs[1], this.L.menu.levels.y - 44, t('classic'), 15);
    LEVELS.forEach((level, k) => {
      this.button(level, this.L.menu.levels.xs[k], this.L.menu.levels.y, this.L.menu.levels.w, this.L.menu.levels.h, t(level), () => {
        ui('click');
        startClassic(this.state, level as Level);
      }, 19);
    });
    this.button('delve', this.L.menu.delve.x, this.L.menu.delve.y, this.L.menu.delve.w, this.L.menu.delve.h, t('delve'), () => {
      ui('click');
      startDelve(this.state);
    }, 20);
    this.text(this.L.menu.delve.x, this.L.menu.delve.y + 40, p.bestFloor ? t('bestFloor', { n: p.bestFloor }) : t('delveBlurb'), 13);
    this.button('styles', this.L.menu.styles.x, this.L.menu.styles.y, this.L.menu.styles.w, this.L.menu.styles.h, t('stylesButton', { n: p.unlocked.length, of: STYLES.length }), () => {
      ui('click');
      this.screen = 'styles';
    }, 18);
    this.text(this.L.menu.stats.x, this.L.menu.stats.y, t('stats', { solved: p.solved, flawless: p.flawless }), 14);
  }

  private buildStyles() {
    const p = this.state.progress;
    this.text(this.L.stylesTitle.x, this.L.stylesTitle.y, t('stylesTitle'), 30, this.theme.accent);
    this.button('back', this.L.back.x, this.L.back.y, this.L.back.w, this.L.back.h, t('back'), () => {
      ui('click');
      this.screen = 'menu';
    }, 17);
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
    this.add_(this.add.text(tx, y - 30, t(STYLE_INFO[style].name), { fontFamily: th.font, fontSize: w < 260 ? '16px' : '18px', color: textColor, fontStyle: 'bold', wordWrap: { width: w - (tx - x + w / 2) - 10 } }).setOrigin(0, 0.5).setDepth(UI_DEPTH + 2));
    const line = worn ? t('worn') : open ? t('wear') : t(STYLE_INFO[style].goal);
    this.add_(this.add.text(tx, y + 14, line, { fontFamily: th.font, fontSize: '13px', color: textColor, wordWrap: { width: w - (tx - x + w / 2) - 10 } }).setOrigin(0, 0.5).setDepth(UI_DEPTH + 2));
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
    const twists = s.mode === 'delve' ? (s.plan?.twists ?? []).map((tw) => t(TWIST_INFO[tw].name)) : [];
    const kicker = [s.mode === 'delve' ? t('delve') : s.mode === 'daily' ? t('daily') : t('classic'), ...twists].join(' · ');
    left(panel.x + 24, panel.y + rows.kicker, kicker.toUpperCase(), 13).setAlpha(0.75);
    const heading = s.mode !== 'delve' ? t(s.level) : s.plan?.boss ? t('bossFloor', { n: s.floor }) : t('floor', { n: s.floor, size: p.size });
    const h1 = left(panel.x + 24, panel.y + rows.heading, heading, 28, th.accent);
    if (th.glow) h1.setShadow(0, 0, th.glow === 'auto' ? th.accent : th.glow, 10, false, true);
    this.button('menu', this.L.menuButton.x, this.L.menuButton.y, this.L.menuButton.w, this.L.menuButton.h, t('menu'), () => {
      ui('click');
      toMenu(this.state);
      this.screen = 'menu';
    }, 15);
    this.panelTexts.status = left(panel.x + 24, panel.y + rows.status, '', s.mode === 'delve' ? 26 : 17, s.mode === 'delve' ? th.heart : th.text);
    this.panelTexts.clock = this.add_(this.add.text(panel.x + panel.w - 24, panel.y + rows.status, '', { fontFamily: th.font, fontSize: '20px', color: th.text }).setOrigin(1, 0.5).setDepth(UI_DEPTH + 2));
    if (s.mode === 'delve') this.panelTexts.relics = left(panel.x + 24, panel.y + rows.relics, '', 12);
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
    const notes = this.button('notes', this.L.tools.xs[0], this.L.tools.y, this.L.tools.w, this.L.tools.h, '', () => this.onNotes(), 15);
    this.panelTexts.notes = notes.label;
    this.button('erase', this.L.tools.xs[1], this.L.tools.y, this.L.tools.w, this.L.tools.h, t('erase'), () => this.onErase(), 15);
    const hintButton = this.button('hint', this.L.tools.xs[2], this.L.tools.y, this.L.tools.w, this.L.tools.h, '', () => this.onHint(), 15);
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
    this.text(this.L.end.x, this.L.end.y - 10, this.unlockedLine(), 16, this.theme.accent, { wordWrap: { width: this.L.end.w - 40 } });
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
    const line = this.unlockedLine() || (s.plan?.boss ? `${t('heartsRestored')} ${t('takeRelic')}` : t('takeRelic'));
    this.text(box.x + box.w / 2, box.line, line, 15, this.unlockedLine() ? th.accent : th.text, { wordWrap: { width: box.w - 40 } });
    if (s.upcoming) this.text(box.x + box.w / 2, box.next, this.nextLine(s.upcoming), 14, th.text, { wordWrap: { width: box.w - 40 } });
    s.relicOffer.forEach((relic, k) => {
      const x = this.L.relicCards.xs[k];
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
