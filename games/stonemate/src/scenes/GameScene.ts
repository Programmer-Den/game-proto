import Phaser from 'phaser';
import { playMusic, playSting, stopMusic, ui } from '../../../../shared/audio';
import { viewSize } from '../../../../shared/scaling';
import { settings } from '../../../../shared/settings';
import { award } from '../../../../shared/trophies';
import { SFX, SONG } from '../audio';
import { chooseMove } from '../game/ai';
import { KINDS, type Kind, type Move, Flag, Position, type Result, type Side, VICTIMS, kindOf, moveText, sideOf } from '../game/chess';
import { HARD_LEVEL, LEVELS, PAIR_COUNT, QUICK_MATE, SIGNATURES, clampLevel, type LevelId, pairKey } from '../game/rules';
import { thinkDeep } from '../game/think';
import { type Mode, type Stats, loadGame, loadStats, saveGame, saveStats } from '../game/save';
import { t, type TextKey } from '../i18n';
import { trophies } from '../trophies';
import { C, paintPieces, paintPuff, pieceKey } from './art';
import { FALLS, STRIKES, type Sfx, type Stage, playCapture, playMate, playMove, playPromote } from './captures';

type Screen = 'menu' | 'play' | 'gallery';
/** A button's middle and size, in view pixels, for the playthrough to tap. */
type Spot = { x: number; y: number; w: number; h: number };

const FONT = 'Georgia, "Times New Roman", serif';
const UI_FONT = '"Segoe UI", Arial, sans-serif';
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const PIECE_TEXT: Record<Kind, TextKey> = { p: 'pieceP', n: 'pieceN', b: 'pieceB', r: 'pieceR', q: 'pieceQ', k: 'pieceK' };
const PREFS_KEY = 'stonemate-prefs';
const LEVEL_TEXT: Record<LevelId, TextKey> = {
  beginner: 'levelBeginner',
  novice: 'levelNovice',
  casual: 'levelCasual',
  club: 'levelClub',
  expert: 'levelExpert',
  master: 'levelMaster',
  grandmaster: 'levelGrandmaster',
};
const LEVEL_BLURB: Record<LevelId, TextKey> = {
  beginner: 'blurbBeginner',
  novice: 'blurbNovice',
  casual: 'blurbCasual',
  club: 'blurbClub',
  expert: 'blurbExpert',
  master: 'blurbMaster',
  grandmaster: 'blurbGrandmaster',
};

export class GameScene extends Phaser.Scene {
  screen: Screen = 'menu';
  pos = new Position();
  mode: Mode = 'ai';
  player: Side = 'w';
  /** A move or capture is playing, or the AI is thinking. */
  busy = false;
  selected = -1;
  result: Result = null;
  /** The pawn move waiting for its promotion choice. */
  promo: Move[] | null = null;
  lastCapture: { pair: string; scene: string | null } | null = null;
  quick = false;
  /** The Stone AI level picked on the menu, 1 (Beginner) to 7 (Grandmaster). */
  level = 3;
  /** The level of the game in play, which a continued game keeps. */
  gameLevel = 3;
  stats: Stats = loadStats();
  buttons: Record<string, Spot> = {};
  /** The board's top-left corner and square size in view pixels, and whether Black is at the bottom. */
  board = { x: 0, y: 0, size: 60, flip: false };

  private W = 960;
  private H = 540;
  private panelX = 0;
  private panelW = 300;
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  private hl?: Phaser.GameObjects.Graphics;
  private statusText?: Phaser.GameObjects.Text;
  private subText?: Phaser.GameObjects.Text;
  private captureText?: Phaser.GameObjects.Text;
  private takenLayer?: Phaser.GameObjects.Container;
  /** Bumped on every screen change, so a late callback from the last screen does nothing. */
  private gen = 0;
  private gallerySize = 100;

  constructor() {
    super('Game');
  }

  create() {
    ({ width: this.W, height: this.H } = viewSize(this));
    const S = Math.floor(Math.min((this.H - 52) / 8, (this.W - 340) / 8));
    this.panelW = Math.min(340, this.W - 8 * S - 60);
    const content = 8 * S + 28 + this.panelW;
    this.board = { x: Math.round((this.W - content) / 2) + 6, y: Math.round((this.H - 8 * S) / 2), size: S, flip: false };
    this.panelX = this.board.x + 8 * S + 28;
    this.gallerySize = Math.min(110, Math.floor(this.H / 5));
    paintPuff(this);
    paintPieces(this, Math.max(S, this.gallerySize));
    let prefs: { quick?: unknown; level?: unknown } = {};
    try {
      prefs = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') ?? {};
    } catch {
      // Unreadable: the defaults.
    }
    this.quick = prefs.quick === true;
    // Until a level is picked on the menu, the hub's difficulty picks it.
    this.level = clampLevel(prefs.level);
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (!over.length) this.onBoardTap(p.worldX, p.worldY);
    });
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e.key));
    this.showMenu();
  }

  // ---- what the playthrough reads ---------------------------------------------------------------

  get state() {
    return {
      screen: this.screen,
      mode: this.mode,
      player: this.player,
      level: this.gameLevel,
      turn: this.pos.turn,
      plies: this.pos.history.length,
      busy: this.busy,
      selected: this.selected,
      result: this.result,
      inCheck: this.pos.inCheck(),
      captures: this.pos.history.filter((u) => u.move.captured).length,
      lastCapture: this.lastCapture,
      promo: !!this.promo,
      /** The legal moves as `e2e4` text while a person is to move. */
      legal: this.humanTurn() ? this.pos.legalMoves().map(moveText) : [],
    };
  }

  // ---- screens ---------------------------------------------------------------------------------

  private clear() {
    this.gen++;
    this.tweens.killAll();
    this.time.removeAllEvents();
    for (const obj of this.children.list.slice()) obj.destroy();
    this.sprites.clear();
    this.galleryActors = [];
    this.buttons = {};
    this.busy = false;
    const bg = this.add.graphics();
    bg.fillStyle(C.bg, 1).fillRect(0, 0, this.W, this.H);
    bg.fillStyle(C.bgTop, 0.6).fillRect(0, 0, this.W, this.H * 0.4);
    bg.fillStyle(C.bgTop, 0.4).fillRect(0, this.H * 0.4, this.W, this.H * 0.15);
  }

  private text(x: number, y: number, s: string, size: number, colour = C.ink, opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) {
    return this.add.text(x, y, s, { fontFamily: UI_FONT, fontSize: `${size}px`, color: hex(colour), ...opts });
  }

  private button(id: string, x: number, y: number, w: number, h: number, label: string, onTap: () => void, primary = false) {
    const box = this.add.rectangle(x, y, w, h, primary ? C.buttonHi : C.button).setStrokeStyle(2, primary ? C.amber : C.frameEdge).setDepth(200);
    const txt = this.text(x, y, label, Math.min(18, h * 0.42), C.ink, { fontStyle: 'bold' }).setOrigin(0.5).setDepth(201);
    box.setInteractive({ useHandCursor: true });
    box.on('pointerover', () => box.setFillStyle(C.buttonHi));
    box.on('pointerout', () => box.setFillStyle(primary ? C.buttonHi : C.button));
    box.on('pointerdown', () => {
      ui('click');
      onTap();
    });
    this.buttons[id] = { x, y, w, h };
    return [box, txt] as const;
  }

  private statue(kind: Kind, side: Side, x: number, y: number, size: number) {
    return this.add.image(x, y, pieceKey(kind, side)).setDisplaySize(size, size);
  }

  showMenu() {
    this.clear();
    this.screen = 'menu';
    playMusic(SONG, 'calm');
    const cx = this.W / 2;
    this.add.text(cx, 52, t('title'), { fontFamily: FONT, fontSize: '54px', color: hex(C.ink), fontStyle: 'bold' }).setOrigin(0.5).setShadow(0, 3, '#000', 6);
    this.text(cx, 96, t('tagline'), 16, C.dim).setOrigin(0.5);
    this.drawLevelPicker(cx, 128);
    // A parade of statues, White on the left and Black on the right.
    const size = 58;
    const order: Kind[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    order.forEach((k, i) => {
      this.statue(k, 'w', cx - 330 + i * 34, 196, size).setDepth(1);
      this.statue(order[7 - i], 'b', cx + 92 + i * 34, 196, size).setFlipX(true).setDepth(1);
    });
    const saved = loadGame();
    const ids: [string, string, () => void][] = [];
    if (saved && saved.moves.length) ids.push(['continue', t('continue', { n: Math.ceil(saved.moves.length / 2) }), () => this.startGame(saved.mode, saved.player, saved.moves, saved.level)]);
    ids.push(['play-white', t('playWhite'), () => this.startGame('ai', 'w')]);
    ids.push(['play-black', t('playBlack'), () => this.startGame('ai', 'b')]);
    ids.push(['two-players', t('twoPlayers'), () => this.startGame('duo', 'w')]);
    ids.push(['gallery', t('gallery'), () => this.showGallery()]);
    const gap = Math.min(54, (this.H - 290) / ids.length);
    ids.forEach(([id, label, fn], i) => this.button(id, cx, 262 + i * gap, 280, gap - 10, label, fn, i === 0));
    const s = this.stats;
    this.text(cx, this.H - 22, t('stats', { w: s.wins, d: s.draws, l: s.losses, pairs: s.pairs.length, scenes: s.scenes.length }), 13, C.dim).setOrigin(0.5);
  }

  // ---- a game ----------------------------------------------------------------------------------

  /** The ◀ level ▶ row on the menu, with a line on how the level plays below it. */
  private drawLevelPicker(cx: number, y: number) {
    const name = this.text(cx, y, '', 16, C.ink, { fontStyle: 'bold' }).setOrigin(0.5);
    const blurb = this.text(cx, y + 24, '', 12, C.dim).setOrigin(0.5);
    const show = () => {
      const id = LEVELS[this.level - 1].id;
      name.setText(t('levelLine', { level: t(LEVEL_TEXT[id]), n: this.level, of: LEVELS.length }));
      blurb.setText(t(LEVEL_BLURB[id]));
    };
    const step = (by: number) => {
      const next = this.level + by;
      if (next < 1 || next > LEVELS.length) {
        ui('refuse');
        return;
      }
      this.level = next;
      this.savePrefs();
      show();
    };
    this.button('level-down', cx - 190, y, 36, 28, '◀', () => step(-1));
    this.button('level-up', cx + 190, y, 36, 28, '▶', () => step(1));
    show();
  }

  private savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ quick: this.quick, level: this.level }));
    } catch {
      // Not saved; the choice still holds for this visit.
    }
  }

  startGame(mode: Mode, player: Side, moves: string[] = [], level = this.level) {
    this.screen = 'play';
    this.mode = mode;
    this.player = player;
    this.gameLevel = clampLevel(level);
    this.pos = new Position();
    for (const text of moves) {
      const m = this.pos.findMove(text);
      if (!m) break;
      this.pos.make(m);
    }
    this.result = this.pos.result();
    this.selected = -1;
    this.promo = null;
    this.lastCapture = null;
    this.board.flip = mode === 'ai' && player === 'b';
    this.buildPlay();
  }

  /** Draws the game in play afresh, from the position. */
  private buildPlay() {
    this.clear();
    this.selected = -1;
    this.promo = null;
    playMusic(SONG, 'battle');
    this.drawBoard();
    this.drawPanel();
    this.syncPieces();
    this.refresh();
    if (!this.result) this.save();
    this.maybeAi();
  }

  private humanTurn() {
    return this.screen === 'play' && !this.result && !this.busy && !this.promo && (this.mode === 'duo' || this.pos.turn === this.player);
  }

  /** A square's middle in view pixels. */
  private centre(sq: number) {
    const { x, y, size, flip } = this.board;
    const r = flip ? 7 - (sq >> 3) : sq >> 3;
    const c = flip ? 7 - (sq & 7) : sq & 7;
    return { x: x + (c + 0.5) * size, y: y + (r + 0.5) * size };
  }
  private squareAt(px: number, py: number) {
    const { x, y, size, flip } = this.board;
    const c = Math.floor((px - x) / size);
    const r = Math.floor((py - y) / size);
    if (c < 0 || c > 7 || r < 0 || r > 7) return -1;
    return flip ? (7 - r) * 8 + 7 - c : r * 8 + c;
  }

  private drawBoard() {
    const { x, y, size } = this.board;
    const g = this.add.graphics();
    g.fillStyle(C.frame, 1).fillRoundedRect(x - 16, y - 16, 8 * size + 32, 8 * size + 32, 10);
    g.lineStyle(2, C.frameEdge, 1).strokeRoundedRect(x - 16, y - 16, 8 * size + 32, 8 * size + 32, 10);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) g.fillStyle((r + c) % 2 ? C.dark : C.light, 1).fillRect(x + c * size, y + r * size, size, size);
    for (let i = 0; i < 8; i++) {
      const file = 'abcdefgh'[this.board.flip ? 7 - i : i];
      const rank = String(this.board.flip ? i + 1 : 8 - i);
      this.text(x + (i + 0.5) * size, y + 8 * size + 7, file, 11, C.dim).setOrigin(0.5);
      this.text(x - 8, y + (i + 0.5) * size, rank, 11, C.dim).setOrigin(0.5);
    }
    this.hl = this.add.graphics().setDepth(1);
  }

  private drawPanel() {
    const x = this.panelX;
    const w = this.panelW;
    const top = this.board.y - 8;
    this.add.text(x, top, t('title'), { fontFamily: FONT, fontSize: '28px', color: hex(C.ink), fontStyle: 'bold' });
    const level = t(LEVEL_TEXT[LEVELS[this.gameLevel - 1].id]);
    const mode = this.mode === 'ai' ? t('modeAi', { side: t(this.player === 'w' ? 'white' : 'black'), level }) : t('modeDuo');
    this.text(x, top + 38, mode, 13, C.dim, { wordWrap: { width: w } });
    this.statusText = this.text(x, top + 76, '', 22, C.ink, { fontStyle: 'bold', wordWrap: { width: w } });
    this.subText = this.text(x, top + 108, '', 16, C.amber, { fontStyle: 'bold' });
    this.text(x, top + 146, t('lastCapture'), 13, C.dim);
    this.captureText = this.text(x, top + 166, '', 15, C.ink, { wordWrap: { width: w }, lineSpacing: 4 });
    this.takenLayer = this.add.container(x, top + 232);
    const by = this.board.y + 8 * this.board.size - 18;
    const bw = (w - 16) / 3;
    this.button('undo', x + bw / 2, by, bw, 38, t('undo'), () => this.undo());
    this.button('quick', x + bw * 1.5 + 8, by, bw, 38, t(this.quick ? 'capturesQuick' : 'capturesFull'), () => this.toggleQuick());
    this.button('menu', x + bw * 2.5 + 16, by, bw, 38, t('menu'), () => this.showMenu());
  }

  private toggleQuick() {
    this.quick = !this.quick;
    this.savePrefs();
    const spot = this.buttons.quick;
    const label = this.children.list.find((o) => o instanceof Phaser.GameObjects.Text && o.x === spot.x && o.y === spot.y) as Phaser.GameObjects.Text | undefined;
    label?.setText(t(this.quick ? 'capturesQuick' : 'capturesFull'));
  }

  /** Puts a statue on every occupied square, fresh from the position. */
  private syncPieces() {
    for (const img of this.sprites.values()) img.destroy();
    this.sprites.clear();
    for (let sq = 0; sq < 64; sq++) {
      const p = this.pos.board[sq];
      if (!p) continue;
      const { x, y } = this.centre(sq);
      const img = this.statue(kindOf(p), sideOf(p), x, y - this.board.size * 0.03, this.board.size * 0.96);
      if (sideOf(p) === 'b') img.setFlipX(true);
      img.setDepth(10 + (y - this.board.y) / this.board.size);
      this.sprites.set(sq, img);
    }
  }

  /** Redraws the highlights and the panel's texts. */
  private refresh() {
    const g = this.hl!;
    const S = this.board.size;
    g.clear();
    const corner = (sq: number) => {
      const c = this.centre(sq);
      return { x: c.x - S / 2, y: c.y - S / 2 };
    };
    const last = this.pos.history[this.pos.history.length - 1]?.move;
    if (last) {
      for (const sq of [last.from, last.to]) {
        const p = corner(sq);
        g.fillStyle(C.last, 0.28).fillRect(p.x, p.y, S, S);
      }
    }
    if (this.pos.inCheck() && !(this.result?.kind === 'mate')) {
      const c = this.centre(this.pos.kingSquare(this.pos.turn));
      g.fillStyle(C.violet, 0.45).fillCircle(c.x, c.y, S * 0.5);
    }
    if (this.selected >= 0) {
      const p = corner(this.selected);
      g.fillStyle(C.select, 0.45).fillRect(p.x, p.y, S, S);
      for (const m of this.pos.legalMoves().filter((mv) => mv.from === this.selected)) {
        const c = this.centre(m.to);
        if (m.captured) g.lineStyle(S * 0.07, C.select, 0.9).strokeCircle(c.x, c.y, S * 0.42);
        else g.fillStyle(C.select, 0.85).fillCircle(c.x, c.y, S * 0.13);
      }
    }
    this.statusText?.setText(this.statusLine());
    this.subText?.setText(!this.result && this.pos.inCheck() ? t('check') : '');
    this.captureText?.setText(this.captureLine());
    this.drawTaken();
  }

  private statusLine() {
    const side = (s: Side) => t(s === 'w' ? 'white' : 'black');
    const r = this.result;
    if (r?.kind === 'mate') {
      if (this.mode === 'duo') return t('mateSide', { side: side(r.winner) });
      return t(r.winner === this.player ? 'mateYou' : 'mateAi');
    }
    if (r) return t(({ stalemate: 'drawStalemate', material: 'drawMaterial', fifty: 'drawFifty', repetition: 'drawRepetition' } as const)[r.reason]);
    if (this.mode === 'duo') return t('toMove', { side: side(this.pos.turn) });
    return t(this.pos.turn === this.player ? 'yourMove' : 'aiThinking');
  }

  private captureLine() {
    const c = this.lastCapture;
    if (!c) return t('noCapture');
    return pairLine(c.pair) + '\n' + (c.scene ? t('sceneLine', { name: t(c.scene as TextKey) }) : strikeLine(c.pair));
  }

  private drawTaken() {
    const layer = this.takenLayer;
    if (!layer) return;
    layer.removeAll(true);
    const size = Math.min(32, (this.panelW - 4) / 11);
    (['w', 'b'] as Side[]).forEach((by, i) => {
      const taken = this.pos.history.filter((u) => u.move.captured && sideOf(u.move.piece) === by).map((u) => kindOf(u.move.captured));
      taken.sort((a, b) => KINDS.indexOf(b) - KINDS.indexOf(a));
      layer.add(this.text(0, i * 52, t('takenBy', { side: t(by === 'w' ? 'white' : 'black') }), 12, C.dim));
      taken.forEach((k, j) => layer.add(this.statue(k, by === 'w' ? 'b' : 'w', size / 2 + j * size * 0.62, i * 52 + 16 + size / 2, size)));
    });
  }

  // ---- input -----------------------------------------------------------------------------------

  private onKey(key: string) {
    if (this.screen !== 'play') return;
    if (key === 'Escape') {
      this.selected = -1;
      this.refresh();
    } else if (key === 'u' || key === 'U') this.undo();
    else if (key === 'q' || key === 'Q') this.toggleQuick();
  }

  private onBoardTap(px: number, py: number) {
    if (this.screen !== 'play' || this.result || this.promo) return;
    const sq = this.squareAt(px, py);
    if (sq < 0) return;
    if (!this.humanTurn()) {
      ui('refuse');
      return;
    }
    if (this.selected >= 0) {
      const moves = this.pos.legalMoves().filter((m) => m.from === this.selected && m.to === sq);
      if (moves.length > 1) return this.askPromotion(moves);
      if (moves.length === 1) return void this.play(moves[0]);
    }
    const p = this.pos.board[sq];
    if (p && sideOf(p) === this.pos.turn && sq !== this.selected) {
      this.selected = sq;
      SFX('pick');
    } else {
      if (this.selected < 0 && p) ui('refuse');
      this.selected = -1;
    }
    this.refresh();
  }

  private askPromotion(moves: Move[]) {
    this.promo = moves;
    const S = this.board.size;
    const side = sideOf(moves[0].piece);
    const cx = this.board.x + 4 * S;
    const cy = this.board.y + 4 * S;
    const box = this.add.container(0, 0).setDepth(300);
    const bg = this.add.rectangle(cx, cy, S * 5.2, S * 2.4, C.panel, 0.96).setStrokeStyle(2, C.amber);
    box.add([bg, this.text(cx, cy - S * 0.85, t('promoteTitle'), 16, C.ink, { fontStyle: 'bold' }).setOrigin(0.5)]);
    (['q', 'r', 'b', 'n'] as Kind[]).forEach((k, i) => {
      const x = cx + (i - 1.5) * S * 1.15;
      const y = cy + S * 0.25;
      const [rect, label] = this.button(`promote-${k}`, x, y, S * 1.05, S * 1.15, '', () => {
        const m = moves.find((mv) => kindOf(mv.promo) === k)!;
        this.promo = null;
        box.destroy();
        void this.play(m);
      });
      rect.setDepth(301);
      label.setDepth(302);
      box.add([rect, label, this.statue(k, side, x, y, S * 0.95).setDepth(303)]);
    });

  }

  // ---- moves -----------------------------------------------------------------------------------

  private stage(): Stage {
    return {
      scene: this,
      size: this.board.size,
      quick: this.quick,
      still: settings.reduceMotion,
      depth: 50,
      sfx: (name: Sfx) => SFX(name),
    };
  }

  /** Plays a move on the board, then makes it. */
  async play(m: Move) {
    const gen = this.gen;
    this.busy = true;
    this.selected = -1;
    this.refresh();
    const stage = this.stage();
    const img = this.sprites.get(m.from)!;
    const to = this.centre(m.to);
    to.y -= this.board.size * 0.03;
    const mover = sideOf(m.piece);
    const human = this.mode === 'duo' || mover === this.player;
    let scene: string | null = null;
    if (m.captured) {
      const victim = this.sprites.get(m.capturedAt)!;
      scene = await playCapture(stage, { img, kind: kindOf(m.piece), side: mover }, { img: victim, kind: kindOf(m.captured), side: sideOf(m.captured) }, to);
    } else {
      const moves: Promise<void>[] = [playMove(stage, img, kindOf(m.piece), to)];
      if (m.flag === Flag.CastleKing || m.flag === Flag.CastleQueen) {
        const rookFrom = m.flag === Flag.CastleKing ? m.to + 1 : m.to - 2;
        const rookTo = this.centre(m.flag === Flag.CastleKing ? m.to - 1 : m.to + 1);
        rookTo.y -= this.board.size * 0.03;
        moves.push(playMove(stage, this.sprites.get(rookFrom)!, 'r', rookTo));
      }
      await Promise.all(moves);
    }
    if (gen !== this.gen) return;
    if (m.promo) {
      img.setTexture(pieceKey(kindOf(m.promo), mover));
      playPromote(stage, to, mover);
      SFX('promote');
      if (human) this.trophy('promotion');
    }
    this.pos.make(m);
    if (m.captured) this.noteCapture(kindOf(m.piece), kindOf(m.captured), scene, human);
    this.result = this.pos.result();
    this.syncPieces();
    if (this.result?.kind === 'mate') {
      const king = this.pos.kingSquare(this.pos.turn);
      this.refresh();
      await playMate(stage, { img: this.sprites.get(king)!, kind: 'k', side: this.pos.turn });
      if (gen !== this.gen) return;
    }
    if (!this.result && this.pos.inCheck()) SFX('check');
    this.busy = false;
    if (this.result) this.finish();
    else this.save();
    this.refresh();
    this.maybeAi();
  }

  private noteCapture(attacker: Kind, victim: Kind, scene: string | null, human: boolean) {
    const pair = pairKey(attacker, victim);
    this.lastCapture = { pair, scene };
    // The quick captures skip the scenes, but a pair still counts as seen.
    const s = this.stats;
    if (!s.pairs.includes(pair)) s.pairs.push(pair);
    if (scene && !s.scenes.includes(scene)) s.scenes.push(scene);
    saveStats(s);
    if (human) {
      this.trophy('firstCapture');
      if (pair === 'pq') this.trophy('upset');
      if (pair === 'nn') this.trophy('joust');
    }
    if (s.pairs.length >= PAIR_COUNT) this.trophy('allPairs');
    if (s.scenes.length >= Object.keys(SIGNATURES).length) this.trophy('allScenes');
  }

  private trophy(id: string) {
    award(trophies, id);
  }

  private finish() {
    saveGame(null);
    const r = this.result!;
    const s = this.stats;
    if (this.mode === 'ai') {
      if (r.kind === 'draw') s.draws++;
      else if (r.winner === this.player) {
        s.wins++;
        this.trophy('firstWin');
        const mine = this.pos.history.filter((u) => sideOf(u.move.piece) === this.player).length;
        if (mine <= QUICK_MATE) this.trophy('quickMate');
        if (this.gameLevel >= HARD_LEVEL) this.trophy('hardWin');
        if (this.gameLevel === LEVELS.length) this.trophy('grandmasterWin');
      } else s.losses++;
      saveStats(s);
    }
    stopMusic();
    playSting(SONG, r.kind === 'mate' && (this.mode === 'duo' || r.winner === this.player) ? 'win' : 'lose');
    const S = this.board.size;
    const cx = this.board.x + 4 * S;
    const cy = this.board.y + 4 * S;
    const bg = this.add.rectangle(cx, cy, S * 5.6, S * 2.2, C.panel, 0.94).setStrokeStyle(2, C.amber).setDepth(190);
    const txt = this.text(cx, cy - S * 0.5, this.statusLine(), 20, C.ink, { fontStyle: 'bold', align: 'center', wordWrap: { width: S * 5.2 } }).setOrigin(0.5).setDepth(191);
    this.add.container(0, 0, [bg, txt]).setDepth(190);
    this.button('new-game', cx - S * 1.3, cy + S * 0.5, S * 2.4, 40, t('newGame'), () => this.startGame(this.mode, this.player), true);
    this.button('result-menu', cx + S * 1.3, cy + S * 0.5, S * 2.4, 40, t('menu'), () => this.showMenu());
  }

  private save() {
    saveGame({ mode: this.mode, player: this.player, level: this.gameLevel, moves: this.pos.history.map((u) => moveText(u.move)) });
  }

  /** Lets the Stone AI move when it is its turn. */
  private maybeAi() {
    if (this.screen !== 'play' || this.mode !== 'ai' || this.result || this.busy || this.pos.turn === this.player) return;
    this.busy = true;
    this.refresh();
    const gen = this.gen;
    // A beat to show it thinking, then the search: the lower levels are fast enough to run in one
    // frame, the top three think in a web worker.
    this.time.delayedCall(450, async () => {
      if (gen !== this.gen) return;
      const level = LEVELS[this.gameLevel - 1];
      const m = level.deep ? await thinkDeep(this.pos, level.deep) : chooseMove(this.pos, level.shallow!);
      if (gen !== this.gen) return;
      this.busy = false;
      if (m) void this.play(m);
    });
  }

  private undo() {
    // Against the AI there must be one of the player's own moves to take back.
    const mine = this.mode === 'duo' || this.pos.history.some((u) => sideOf(u.move.piece) === this.player);
    if (this.busy || this.promo || !this.pos.history.length || !mine) {
      ui('refuse');
      return;
    }
    this.pos.unmake();
    // Against the AI, take back its reply too, so it is the player's move again.
    if (this.mode === 'ai' && this.pos.turn !== this.player && this.pos.history.length) this.pos.unmake();
    this.result = null;
    this.buildPlay();
  }

  // ---- the capture gallery ---------------------------------------------------------------------

  /** The capture gallery, playing `first` on its stage. */
  showGallery(first: [Kind, Kind] = ['n', 'b']) {
    this.clear();
    this.screen = 'gallery';
    playMusic(SONG, 'calm');
    const G = this.gallerySize;
    this.add.text(30, 22, t('gallery'), { fontFamily: FONT, fontSize: '30px', color: hex(C.ink), fontStyle: 'bold' });
    this.text(30, 62, t('galleryHint'), 13, C.dim, { wordWrap: { width: this.W - 60 } });
    const stageW = G * 3;
    const gridX = 92;
    const gridY = 120;
    const cw = Math.min(92, (this.W - stageW - 80 - gridX) / 5);
    const ch = Math.min(62, (this.H - gridY - 20) / 6);
    this.text(gridX - 64, gridY - 32, t('attacker'), 11, C.dim);
    VICTIMS.forEach((v, j) => this.statue(v, 'b', gridX + (j + 0.5) * cw, gridY - 18, 30).setFlipX(true));
    KINDS.forEach((a, i) => {
      const y = gridY + (i + 0.5) * ch;
      this.statue(a, 'w', gridX - 40, y, Math.min(44, ch - 6));
      VICTIMS.forEach((v, j) => {
        const key = pairKey(a, v);
        const x = gridX + (j + 0.5) * cw;
        const sig = SIGNATURES[key];
        const [rect] = this.button(`pair-${key}`, x, y, cw - 8, ch - 8, sig ? '★' : '', () => this.showGallery([a, v]));
        if (sig) rect.setFillStyle(0x6b4f22).setStrokeStyle(2, C.amber);
        this.statue(a, 'w', x - cw * 0.18, y, ch * 0.62).setDepth(202);
        this.statue(v, 'b', x + cw * 0.18, y, ch * 0.62).setFlipX(true).setDepth(202);
        if (this.stats.pairs.includes(key)) this.add.circle(x + cw / 2 - 12, y - ch / 2 + 12, 4, C.gold).setDepth(203);
      });
    });
    // The stage: three squares to play a pair on.
    const sx = this.W - stageW - 40;
    const sy = gridY + 40;
    const g = this.add.graphics();
    g.fillStyle(C.frame, 1).fillRoundedRect(sx - 12, sy - 12, stageW + 24, G + 24, 8);
    for (let i = 0; i < 3; i++) g.fillStyle(i % 2 ? C.dark : C.light, 1).fillRect(sx + i * G, sy, G, G);
    this.galleryStage = { x: sx, y: sy };
    this.galleryLabel = this.text(sx + stageW / 2, sy + G + 30, '', 18, C.ink, { fontStyle: 'bold', align: 'center' }).setOrigin(0.5, 0);
    this.galleryLine = this.text(sx + stageW / 2, sy + G + 58, '', 14, C.dim, { align: 'center', wordWrap: { width: stageW + 40 } }).setOrigin(0.5, 0);
    this.button('back', sx + stageW / 2, this.H - 40, 200, 40, t('back'), () => this.showMenu());
    void this.playPair(...first);
  }

  private galleryStage = { x: 0, y: 0 };
  private galleryLabel?: Phaser.GameObjects.Text;
  private galleryLine?: Phaser.GameObjects.Text;
  private galleryActors: Phaser.GameObjects.Image[] = [];

  /** Plays one capture pair on the gallery's stage. */
  async playPair(a: Kind, v: Kind) {
    const gen = this.gen;
    this.busy = true;
    const G = this.gallerySize;
    const { x, y } = this.galleryStage;
    this.galleryActors.forEach((img) => img.destroy());
    const ai = this.statue(a, 'w', x + G / 2, y + G / 2 - G * 0.03, G * 0.96).setDepth(20);
    const vi = this.statue(v, 'b', x + G * 2.5, y + G / 2 - G * 0.03, G * 0.96).setDepth(19).setFlipX(true);
    this.galleryActors = [ai, vi];
    const pair = pairKey(a, v);
    this.galleryLabel?.setText(pairLine(pair));
    const sig = SIGNATURES[pair];
    this.galleryLine?.setText(sig ? t('sceneLine', { name: t(sig as TextKey) }) : strikeLine(pair));
    const stage: Stage = { ...this.stage(), size: G, quick: false };
    await this.wait(250);
    if (gen !== this.gen) return;
    await playCapture(stage, { img: ai, kind: a, side: 'w' }, { img: vi, kind: v, side: 'b' }, { x: vi.x, y: vi.y });
    if (gen !== this.gen) return;
    this.busy = false;
  }

  private wait(ms: number) {
    return new Promise<void>((done) => this.time.delayedCall(ms, () => done()));
  }
}

/** "Knight takes Bishop". */
function pairLine(pair: string) {
  const [a, v] = pair.split('') as [Kind, Kind];
  return t('takes', { a: t(PIECE_TEXT[a]), v: t(PIECE_TEXT[v]) });
}
/** "Hoof stomp, then cracks open". */
function strikeLine(pair: string) {
  const [a, v] = pair.split('') as [Kind, Exclude<Kind, 'k'>];
  return t('strikeThen', { strike: t(STRIKES[a] as TextKey), fall: t(FALLS[v] as TextKey) });
}

