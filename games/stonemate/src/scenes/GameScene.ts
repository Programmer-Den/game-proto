import Phaser from 'phaser';
import { playMusic, playSting, stopMusic, ui } from '../../../../shared/audio';
import { viewSize } from '../../../../shared/scaling';
import { settings } from '../../../../shared/settings';
import { dailyRand, finishDaily, loadDaily, startDaily } from '../../../../shared/daily';
import { award } from '../../../../shared/trophies';
import { SFX, SONG } from '../audio';
import { chooseMove } from '../game/ai';
import { KING, KINDS, type Kind, type Move, Flag, Position, type Result, START, type Side, VICTIMS, kindOf, moveText, sideOf, squareAt, squareName, startWith } from '../game/chess';
import { CLOCKS, HARD_LEVEL, LEVELS, PAIR_COUNT, QUICK_MATE, SIGNATURES, clampLevel, type LevelId, pairKey, shuffledRank, unlockedLevel } from '../game/rules';
import { LADDER, PUZZLES, type Puzzle, dailyPuzzle } from '../game/puzzles';
import { RIVALS, rivalPlayer, rivalStart, styleBias } from '../game/rivals';
import { analyse, thinkDeep } from '../game/think';
import { type Clock, type Mode, type Stats, loadGame, loadPuzzles, loadRivals, loadStats, saveGame, savePuzzles, saveRivals, saveStats } from '../game/save';
import { t, type TextKey } from '../i18n';
import { trophies } from '../trophies';
import { C, paintPieces, paintPuff, pieceKey } from './art';
import { FALLS, STRIKES, type Sfx, type Stage, playCapture, playDefeat, playMate, playMove, playPromote } from './captures';

type Screen = 'menu' | 'play' | 'gallery' | 'rivals' | 'puzzles' | 'review';
/** How the review marks a move. */
type Mark = 'best' | 'good' | 'doubtful' | 'blunder';
/** The review's search: a few hundredths of a second a position. */
const REVIEW_LEVEL = { depth: 8, nodes: 30_000 };
/** A move that loses this many points (a pawn is 100) against the best is doubtful, and this many a blunder. */
const DOUBTFUL = 60;
const BLUNDER = 200;
const DAILY = 'stonemate';
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
const RIVAL_TEXT = (id: string, part: 'rival' | 'style' | 'line') => (part + id[0].toUpperCase() + id.slice(1)) as TextKey;
/** A clock's time as `4:05`. */
const clockText = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
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
  /** The menu's back row (classic or shuffled) and clock (0 for none, else a row of `CLOCKS`). */
  shuffled = false;
  clockPick = 0;
  /** The clocks of the game in play, or null. */
  clock: Clock | null = null;
  /** The rival being played, or -1; and how many rivals are beaten. */
  rival = -1;
  rivalsBeaten = loadRivals();
  /** The puzzle in play, whether it is today's, and the misses and hints so far. */
  puzzle: Puzzle | null = null;
  daily = false;
  misses = 0;
  /** The game under review: its start and moves, the side reviewed (null for both), and what the search found so far. */
  review: { start: string; moves: string[]; side: Side | null; ply: number; best: (string | null)[]; scores: number[] } | null = null;
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
  private clockLabel?: Phaser.GameObjects.Text;
  /** A move is being animated: the clocks stand still meanwhile. */
  private moving = false;
  private hintSquare = -1;
  /** The puzzle's last try was the wrong move, taken back. */
  private wrongMove = false;
  private promoBox?: Phaser.GameObjects.Container;
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
    let prefs: { quick?: unknown; level?: unknown; shuffled?: unknown; clock?: unknown } = {};
    try {
      prefs = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') ?? {};
    } catch {
      // Unreadable: the defaults.
    }
    this.quick = prefs.quick === true;
    this.shuffled = prefs.shuffled === true;
    this.clockPick = typeof prefs.clock === 'number' && prefs.clock >= 0 && prefs.clock <= CLOCKS.length ? Math.floor(prefs.clock) : 0;
    // Until a level is picked on the menu, the hub's difficulty picks it.
    // A locked level can't be the pick (the hub's Hard picks 4 before 3 is beaten).
    this.level = Math.min(clampLevel(prefs.level), unlockedLevel(this.stats.best));
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
      /** The highest level open to play: 3, then one past the strongest level beaten. */
      unlocked: unlockedLevel(this.stats.best),
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
      /** The start as FEN, the clocks left (ms), the rival, and the puzzle in play. */
      start: this.pos.start,
      clock: this.clock ? { w: this.clock.w, b: this.clock.b } : null,
      rival: this.rival,
      rivalsBeaten: this.rivalsBeaten,
      puzzle: this.puzzle ? { id: this.puzzle.id, daily: this.daily, misses: this.misses } : null,
      review: this.review ? { ply: this.review.ply, plies: this.review.moves.length, done: this.review.scores.length > this.review.moves.length, marks: this.marks() } : null,
    };
  }

  // ---- clocks ----------------------------------------------------------------------------------

  /** Runs the clock of the side to move; a clock that reaches nought ends the game. */
  update(_time: number, delta: number) {
    const c = this.clock;
    if (!c || this.screen !== 'play' || this.result || this.moving) return;
    const side = this.pos.turn;
    c[side] = Math.max(0, c[side] - delta);
    this.clockLabel?.setText(this.clockLine());
    if (c[side] === 0) this.outOfTime(side);
  }

  private clockLine() {
    const c = this.clock!;
    return t('clockLine', { w: clockText(c.w), b: clockText(c.b) });
  }

  /** `side`'s clock ran out: the other side wins, unless it has only its king left (a draw). */
  private outOfTime(side: Side) {
    const winner: Side = side === 'w' ? 'b' : 'w';
    const own = winner === 'b' ? 8 : 0;
    const alone = this.pos.board.every((p) => !p || (p & 8) !== own || (p & 7) === KING);
    this.result = alone ? { kind: 'draw', reason: 'timeout' } : { kind: 'time', winner };
    this.gen++;
    this.busy = false;
    this.selected = -1;
    this.promo = null;
    this.promoBox?.destroy();
    const unlocked = this.record();
    this.refresh();
    void this.finish(unlocked);
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
    const left: [string, string, () => void][] = [];
    if (saved && saved.moves.length) left.push(['continue', t('continue', { n: Math.ceil(saved.moves.length / 2) }), () => this.continueGame()]);
    left.push(['play-white', t('playWhite'), () => this.startAi('w')]);
    left.push(['play-black', t('playBlack'), () => this.startAi('b')]);
    left.push(['two-players', t('twoPlayers'), () => this.newGame('duo', 'w')]);
    const right: [string, string, () => void][] = [
      ['rivals', t('rivalsButton'), () => this.showRivals()],
      ['puzzles', t('puzzlesButton'), () => this.showPuzzles()],
      ['daily', t('dailyButton'), () => this.startDaily()],
      ['gallery', t('gallery'), () => this.showGallery()],
    ];
    const gap = Math.min(54, (this.H - 340) / 4);
    const bw = Math.min(280, (this.W - 60) / 2 - 10);
    left.forEach(([id, label, fn], i) => this.button(id, cx - bw / 2 - 10, 262 + i * gap, bw, gap - 10, label, fn, i === 0));
    right.forEach(([id, label, fn], i) => this.button(id, cx + bw / 2 + 10, 262 + i * gap, bw, gap - 10, label, fn));
    // The back row and the clock, for games against the Stone AI and two-player games.
    const oy = 262 + 4 * gap + 4;
    const [, variant] = this.button('variant', cx - bw / 2 - 10, oy, bw, 32, '', () => {
      this.shuffled = !this.shuffled;
      this.savePrefs();
      showOptions();
    });
    const [, clock] = this.button('clock', cx + bw / 2 + 10, oy, bw, 32, '', () => {
      this.clockPick = (this.clockPick + 1) % (CLOCKS.length + 1);
      this.savePrefs();
      showOptions();
    });
    const showOptions = () => {
      variant.setText(t(this.shuffled ? 'variantShuffled' : 'variantClassic'));
      const c = CLOCKS[this.clockPick - 1];
      clock.setText(c ? t('clockOn', { m: c.minutes, s: c.plus }) : t('clockOff'));
    };
    showOptions();
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
      const locked = this.level > unlockedLevel(this.stats.best);
      name.setText(t(locked ? 'levelLocked' : 'levelLine', { level: t(LEVEL_TEXT[id]), n: this.level, of: LEVELS.length }));
      name.setColor(hex(locked ? C.dim : C.ink));
      blurb.setText(locked ? t('unlockHint', { level: t(LEVEL_TEXT[LEVELS[this.level - 2].id]) }) : t(LEVEL_BLURB[id]));
      blurb.setColor(hex(locked ? C.amber : C.dim));
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
      localStorage.setItem(PREFS_KEY, JSON.stringify({ quick: this.quick, level: this.level, shuffled: this.shuffled, clock: this.clockPick }));
    } catch {
      // Not saved; the choice still holds for this visit.
    }
  }

  /** A new game against the Stone AI at the menu's level, unless that level is still locked. */
  private startAi(player: Side) {
    if (this.level > unlockedLevel(this.stats.best)) {
      ui('refuse');
      return;
    }
    this.newGame('ai', player);
  }

  /** A new game against the AI or for two, with the menu's back row and clock. */
  private newGame(mode: Mode, player: Side, level = this.level) {
    const c = CLOCKS[this.clockPick - 1];
    const clock = c ? { minutes: c.minutes, plus: c.plus, w: c.minutes * 60_000, b: c.minutes * 60_000 } : undefined;
    this.startGame(mode, player, [], level, { start: this.shuffled ? startWith(shuffledRank(Math.random)) : START, clock });
  }

  private continueGame() {
    const saved = loadGame();
    if (!saved) return;
    const rival = saved.mode === 'rival' ? Math.min(RIVALS.length - 1, Math.max(0, saved.rival ?? 0)) : -1;
    this.startGame(saved.mode, saved.player, saved.moves, rival >= 0 ? RIVALS[rival].level : saved.level, { start: saved.start, rival, clock: saved.clock });
  }

  startGame(mode: Mode, player: Side, moves: string[] = [], level = this.level, opts: { start?: string; rival?: number; clock?: Clock; puzzle?: Puzzle } = {}) {
    this.screen = 'play';
    this.mode = mode;
    this.player = player;
    this.gameLevel = clampLevel(level);
    this.rival = opts.rival ?? -1;
    this.puzzle = opts.puzzle ?? null;
    if (!this.puzzle) this.daily = false;
    this.clock = opts.clock ? { ...opts.clock } : null;
    this.misses = 0;
    this.hintSquare = -1;
    this.pos = new Position(opts.start ?? START);
    for (const text of moves) {
      const m = this.pos.findMove(text);
      if (!m) break;
      this.pos.make(m);
    }
    this.result = this.pos.result();
    this.selected = -1;
    this.promo = null;
    this.lastCapture = null;
    this.board.flip = mode !== 'duo' && player === 'b';
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
    const side = t(this.player === 'w' ? 'white' : 'black');
    let mode = t('modeDuo');
    if (this.mode === 'ai') mode = t('modeAi', { side, level });
    else if (this.mode === 'rival') mode = t('modeRival', { side, name: this.rivalName(), level });
    else if (this.puzzle) mode = t(this.daily ? 'modeDaily' : 'modePuzzle', { n: LADDER.indexOf(this.puzzle.id) + 1, side, m: this.puzzle.mateIn });
    if (this.pos.start !== START && this.mode !== 'rival' && this.mode !== 'puzzle') mode += `\n${t('modeShuffled')}`;
    this.text(x, top + 38, mode, 13, C.dim, { wordWrap: { width: w } });
    // The clocks take a line under the status, and push the rest down.
    const dy = this.clock ? 26 : 0;
    this.statusText = this.text(x, top + 76, '', 22, C.ink, { fontStyle: 'bold', wordWrap: { width: w } });
    this.subText = this.text(x, top + 108, '', 16, C.amber, { fontStyle: 'bold' });
    this.clockLabel = this.clock ? this.text(x, top + 134, this.clockLine(), 16, C.ink, { fontStyle: 'bold' }) : undefined;
    this.text(x, top + 146 + dy, t('lastCapture'), 13, C.dim);
    this.captureText = this.text(x, top + 166 + dy, '', 15, C.ink, { wordWrap: { width: w }, lineSpacing: 4 });
    this.takenLayer = this.add.container(x, top + 232 + dy);
    const by = this.board.y + 8 * this.board.size - 18;
    const bw = (w - 16) / 3;
    if (this.mode === 'puzzle') this.button('hint', x + bw / 2, by, bw, 38, t('hint'), () => this.showHint());
    else this.button('undo', x + bw / 2, by, bw, 38, t('undo'), () => this.undo());
    this.button('quick', x + bw * 1.5 + 8, by, bw, 38, t(this.quick ? 'capturesQuick' : 'capturesFull'), () => this.toggleQuick());
    this.button('menu', x + bw * 2.5 + 16, by, bw, 38, t('menu'), () => (this.mode === 'puzzle' && !this.daily ? this.showPuzzles() : this.mode === 'rival' ? this.showRivals() : this.showMenu()));
  }

  private rivalName(i = this.rival) {
    return t(RIVAL_TEXT(RIVALS[i].id, 'rival'));
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
    if (this.hintSquare >= 0 && this.selected < 0) {
      const c = this.centre(this.hintSquare);
      g.lineStyle(S * 0.06, C.gold, 0.95).strokeRect(c.x - S / 2 + 2, c.y - S / 2 + 2, S - 4, S - 4);
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
    this.clockLabel?.setText(this.clock ? this.clockLine() : '');
    this.subText?.setText(!this.result && this.pos.inCheck() ? t('check') : '');
    this.captureText?.setText(this.captureLine());
    this.drawTaken();
  }

  private statusLine() {
    const side = (s: Side) => t(s === 'w' ? 'white' : 'black');
    const r = this.result;
    if (this.puzzle) {
      if (r?.kind === 'mate' && r.winner === this.player) return t('puzzleSolved');
      if (this.wrongMove) return t('puzzleWrong');
      return t(this.pos.turn === this.player ? 'puzzleFind' : 'puzzleReply');
    }
    if (r?.kind === 'mate' || r?.kind === 'time') {
      const mate = r.kind === 'mate';
      if (this.mode === 'duo') return t(mate ? 'mateSide' : 'timeSide', { side: side(r.winner) });
      if (r.winner === this.player) return t(mate ? 'mateYou' : 'timeYou');
      if (this.mode === 'rival') return t(mate ? 'mateRival' : 'timeRival', { name: this.rivalName() });
      return t(mate ? 'mateAi' : 'timeAi');
    }
    if (r) return t(({ stalemate: 'drawStalemate', material: 'drawMaterial', fifty: 'drawFifty', repetition: 'drawRepetition', timeout: 'drawTimeout' } as const)[r.reason]);
    if (this.mode === 'duo') return t('toMove', { side: side(this.pos.turn) });
    if (this.pos.turn === this.player) return t('yourMove');
    return this.mode === 'rival' ? t('rivalThinking', { name: this.rivalName() }) : t('aiThinking');
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
    if (this.screen === 'review') {
      if (key === 'ArrowLeft') this.reviewStep(-1);
      else if (key === 'ArrowRight') this.reviewStep(1);
      return;
    }
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
    this.promoBox = box;
    const bg = this.add.rectangle(cx, cy, S * 5.2, S * 2.4, C.panel, 0.96).setStrokeStyle(2, C.amber);
    box.add([bg, this.text(cx, cy - S * 0.85, t('promoteTitle'), 16, C.ink, { fontStyle: 'bold' }).setOrigin(0.5)]);
    (['q', 'r', 'b', 'n'] as Kind[]).forEach((k, i) => {
      const x = cx + (i - 1.5) * S * 1.15;
      const y = cy + S * 0.25;
      const [rect, label] = this.button(`promote-${k}`, x, y, S * 1.05, S * 1.15, '', () => {
        if (this.result || !this.promo) return;
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
    this.moving = true;
    this.wrongMove = false;
    this.hintSquare = -1;
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
    this.moving = false;
    if (m.promo) {
      img.setTexture(pieceKey(kindOf(m.promo), mover));
      playPromote(stage, to, mover);
      SFX('promote');
      if (human && this.mode !== 'puzzle') this.trophy('promotion');
    }
    this.pos.make(m);
    if (this.clock) this.clock[mover] += this.clock.plus * 1000;
    if (m.captured) this.noteCapture(kindOf(m.piece), kindOf(m.captured), scene, human);
    this.result = this.pos.result();
    // A puzzle's wrong move is taken back after a beat, and doesn't end anything.
    if (this.puzzle && human && !this.puzzleRight(m)) {
      this.result = null;
      this.wrongMove = true;
      this.misses++;
      this.syncPieces();
      ui('refuse');
      this.refresh();
      await this.wait(900);
      if (gen !== this.gen) return;
      this.pos.unmake();
      this.syncPieces();
      this.busy = false;
      this.refresh();
      return;
    }
    this.syncPieces();
    // A finished game is counted before the mate scene plays, so leaving for the menu during the
    // scene can't skip the result (or leave the save from before the last move to continue).
    const unlocked = this.result ? this.record() : '';
    if (this.result?.kind === 'mate') {
      const king = this.pos.kingSquare(this.pos.turn);
      this.refresh();
      await playMate(stage, { img: this.sprites.get(king)!, kind: 'k', side: this.pos.turn });
      if (gen !== this.gen) return;
    }
    if (!this.result && this.pos.inCheck()) SFX('check');
    this.busy = false;
    if (this.result) {
      this.refresh();
      await this.finish(unlocked);
      return;
    }
    this.save();
    this.refresh();
    this.maybeAi();
  }

  /** Whether the solver's move `m`, just made, keeps to the puzzle: the line's move, or any mate. */
  private puzzleRight(m: Move) {
    const p = this.puzzle!;
    if (this.result?.kind === 'mate') return true;
    const ply = this.pos.history.length - 1;
    return ply < p.line.length - 1 && moveText(m) === p.line[ply];
  }

  /** The end of a game or puzzle: a beaten rival's scene, then the result box. */
  private async finish(unlocked: string) {
    const gen = this.gen;
    const r = this.result;
    if (this.mode === 'rival' && r && r.kind !== 'draw' && r.winner === this.player) {
      await this.playRivalDefeat();
      if (gen !== this.gen) return;
    }
    this.showResult(unlocked);
  }

  /** The beaten rival's own scene: their favourite statue rises over the board, speaks and breaks. */
  private async playRivalDefeat() {
    const rival = RIVALS[this.rival];
    const S = this.board.size;
    const cx = this.board.x + 4 * S;
    const cy = this.board.y + 4 * S;
    const shade = this.add.rectangle(cx, cy, 8 * S, 8 * S, 0x000000, 0.45).setDepth(150);
    const size = S * 2.6;
    const img = this.statue(rival.emblem, this.player === 'w' ? 'b' : 'w', cx, cy + S * 0.4, size).setDepth(160);
    if (this.player === 'w') img.setFlipX(true);
    const line = this.text(cx, cy - S * 2.3, t(RIVAL_TEXT(rival.id, 'line')), 18, C.ink, { fontStyle: 'italic', align: 'center', wordWrap: { width: S * 7 } })
      .setOrigin(0.5)
      .setDepth(161);
    await this.wait(1400);
    await playDefeat({ ...this.stage(), size, depth: 160 }, { img, kind: rival.emblem, side: this.player === 'w' ? 'b' : 'w' }, rival.breaks);
    await this.wait(500);
    shade.destroy();
    line.destroy();
  }

  private noteCapture(attacker: Kind, victim: Kind, scene: string | null, human: boolean) {
    const pair = pairKey(attacker, victim);
    this.lastCapture = { pair, scene };
    // A puzzle's captures play their scenes, but only games count towards the pairs and trophies.
    if (this.mode === 'puzzle') return;
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

  /**
   * Counts the game that just ended: removes its save and, against the AI, adds it to the stats,
   * awards the win trophies and opens the next level. Returns the name of the level a win opened.
   */
  private record() {
    /** The level (or rival) this win just opened, by name. */
    let unlocked = '';
    const r = this.result!;
    const s = this.stats;
    if (this.mode === 'puzzle') {
      if (r.kind === 'mate' && r.winner === this.player) this.puzzleSolved();
      return '';
    }
    saveGame(null);
    if (this.mode === 'rival') {
      if (r.kind === 'draw') s.draws++;
      else if (r.winner === this.player) {
        s.wins++;
        this.trophy('firstWin');
        // Beating the next rival on the ladder opens the one after.
        if (this.rival === this.rivalsBeaten) {
          this.rivalsBeaten++;
          saveRivals(this.rivalsBeaten);
          unlocked = this.rivalsBeaten < RIVALS.length ? t('rivalNext', { name: this.rivalName(this.rivalsBeaten) }) : t('rivalsDone');
        }
      } else s.losses++;
      saveStats(s);
    } else if (this.mode === 'ai') {
      if (r.kind === 'draw') s.draws++;
      else if (r.winner === this.player) {
        s.wins++;
        this.trophy('firstWin');
        const mine = this.pos.history.filter((u) => sideOf(u.move.piece) === this.player).length;
        if (mine <= QUICK_MATE && r.kind === 'mate') this.trophy('quickMate');
        if (this.gameLevel >= HARD_LEVEL) this.trophy('hardWin');
        if (this.gameLevel === LEVELS.length) this.trophy('grandmasterWin');
        // Beating a level opens the next one (from level 3 up).
        const before = unlockedLevel(s.best);
        s.best = Math.max(s.best, this.gameLevel);
        const now = unlockedLevel(s.best);
        if (now > before) {
          unlocked = t('unlockedNow', { level: t(LEVEL_TEXT[LEVELS[now - 1].id]) });
          // The menu's arrows move on to the new level too.
          if (this.level < now) {
            this.level = now;
            this.savePrefs();
          }
        }
      } else s.losses++;
      saveStats(s);
    }
    return unlocked;
  }

  /** A puzzle solved: the ladder opens the next one, today's puzzle keeps its score. */
  private puzzleSolved() {
    const p = this.puzzle!;
    if (this.daily) {
      finishDaily(DAILY, Math.max(1, 3 - this.misses));
      return;
    }
    const solved = loadPuzzles();
    if (!solved.includes(p.id)) savePuzzles([...solved, p.id]);
  }

  /** The result box, with the sting, once the last move has played out. */
  private showResult(unlocked: string) {
    const r = this.result!;
    stopMusic();
    const won = r.kind !== 'draw' && (this.mode === 'duo' || r.winner === this.player);
    playSting(SONG, won ? 'win' : 'lose');
    const S = this.board.size;
    const cx = this.board.x + 4 * S;
    const cy = this.board.y + 4 * S;
    const bg = this.add.rectangle(cx, cy, S * 6.4, S * 2.2, C.panel, 0.94).setStrokeStyle(2, C.amber).setDepth(190);
    let line = this.statusLine();
    if (this.mode === 'rival' && won) line = t('rivalBeaten', { name: this.rivalName() });
    if (this.daily) line = t('puzzleScore', { score: Math.max(1, 3 - this.misses) });
    if (unlocked) line += `\n${unlocked}`;
    const txt = this.text(cx, cy - S * 0.5, line, unlocked ? 17 : 20, C.ink, { fontStyle: 'bold', align: 'center', wordWrap: { width: S * 6 } }).setOrigin(0.5).setDepth(191);
    this.add.container(0, 0, [bg, txt]).setDepth(190);
    const bw = S * 1.9;
    const y = cy + S * 0.5;
    if (this.mode === 'puzzle') {
      // The next puzzle on the ladder, if there is one left; today's puzzle has only the menu.
      const next = LADDER[LADDER.indexOf(this.puzzle!.id) + 1];
      if (!this.daily && next !== undefined) this.button('next-puzzle', cx - S * 1.1, y, S * 2, 40, t('nextPuzzle'), () => this.startPuzzle(PUZZLES[next], false), true);
      this.button('result-menu', this.daily ? cx : cx + S * 1.1, y, S * 2, 40, t(this.daily ? 'menu' : 'puzzles'), () => (this.daily ? this.showMenu() : this.showPuzzles()));
      return;
    }
    if (this.mode === 'rival') {
      // The same rival again, or the next one once this one is beaten.
      const i = Math.min(this.rivalsBeaten, RIVALS.length - 1);
      this.button('new-game', cx - S * 2.05, y, bw, 40, t('newGame'), () => this.startRival(won ? i : this.rival), true);
    } else {
      // The menu's pick may be a locked level the arrows stepped onto: play the highest open one then.
      const next = Math.min(this.level, unlockedLevel(this.stats.best));
      this.button('new-game', cx - S * 2.05, y, bw, 40, t('newGame'), () => this.newGame(this.mode, this.player, next), true);
    }
    this.button('review', cx, y, bw, 40, t('review'), () => this.showReview());
    this.button('result-menu', cx + S * 2.05, y, bw, 40, t('menu'), () => (this.mode === 'rival' ? this.showRivals() : this.showMenu()));
  }

  private save() {
    if (this.mode === 'puzzle') return;
    saveGame({
      mode: this.mode,
      player: this.player,
      level: this.gameLevel,
      moves: this.pos.history.map((u) => moveText(u.move)),
      ...(this.pos.start !== START ? { start: this.pos.start } : {}),
      ...(this.rival >= 0 ? { rival: this.rival } : {}),
      ...(this.clock ? { clock: { ...this.clock } } : {}),
    });
  }

  /** Lets the Stone AI move when it is its turn. */
  private maybeAi() {
    if (this.screen !== 'play' || this.mode === 'duo' || this.result || this.busy || this.pos.turn === this.player) return;
    this.busy = true;
    this.refresh();
    const gen = this.gen;
    // A beat to show it thinking, then the search: the lower levels are fast enough to run in one
    // frame, the top three think in a web worker.
    this.time.delayedCall(450, async () => {
      if (gen !== this.gen) return;
      let m: Move | undefined;
      if (this.puzzle) m = this.pos.findMove(this.puzzle.line[this.pos.history.length]);
      else {
        const level = LEVELS[this.gameLevel - 1];
        const style = this.rival >= 0 ? RIVALS[this.rival].style : undefined;
        const pos = this.pos;
        const bias = style ? (mv: Move) => styleBias(style, pos, mv) : undefined;
        m = level.deep ? await thinkDeep(pos, level.deep, style) : chooseMove(pos, level.shallow!, bias);
      }
      if (gen !== this.gen || this.result) return;
      this.busy = false;
      if (m) void this.play(m);
    });
  }

  private undo() {
    // Against the AI there must be one of the player's own moves to take back, and a finished game
    // stays finished: its result is already in the stats. Two players, whose games aren't counted,
    // may take back the last move even after it ended the game.
    if (this.mode === 'puzzle') {
      ui('refuse');
      return;
    }
    const mine = this.mode === 'duo' || this.pos.history.some((u) => sideOf(u.move.piece) === this.player);
    if (this.busy || this.promo || (this.result && this.mode !== 'duo') || !this.pos.history.length || !mine) {
      ui('refuse');
      return;
    }
    this.pos.unmake();
    // Against the AI, take back its reply too, so it is the player's move again.
    if (this.mode !== 'duo' && this.pos.turn !== this.player && this.pos.history.length) this.pos.unmake();
    this.result = null;
    this.buildPlay();
  }

  // ---- rival sculptors ------------------------------------------------------------------------

  /** The ladder of rivals: each row plays one; the ones past the next rival are locked. */
  showRivals() {
    this.clear();
    this.screen = 'rivals';
    playMusic(SONG, 'calm');
    this.rivalsBeaten = loadRivals();
    this.add.text(30, 22, t('rivalsButton'), { fontFamily: FONT, fontSize: '30px', color: hex(C.ink), fontStyle: 'bold' });
    this.text(30, 62, t('rivalsHint'), 13, C.dim, { wordWrap: { width: this.W - 60 } });
    const top = 100;
    const rowH = Math.min(52, (this.H - top - 70) / RIVALS.length);
    const w = Math.min(720, this.W - 60);
    const x = this.W / 2;
    RIVALS.forEach((rival, i) => {
      const y = top + (i + 0.5) * rowH;
      const open = i <= this.rivalsBeaten;
      const [rect] = this.button(`rival-${i}`, x, y, w, rowH - 6, '', () => this.startRival(i), i === Math.min(this.rivalsBeaten, RIVALS.length - 1));
      if (!open) rect.setFillStyle(C.bg);
      this.statue(rival.emblem, 'b', x - w / 2 + rowH * 0.6, y, rowH - 8).setFlipX(true).setDepth(202);
      const mark = i < this.rivalsBeaten ? '✓ ' : open ? '' : '🔒 ';
      this.text(x - w / 2 + rowH * 1.2, y - 1, mark + t('rivalRow', { n: i + 1, name: this.rivalName(i) }), 16, open ? C.ink : C.dim, { fontStyle: 'bold' })
        .setOrigin(0, 0.5)
        .setDepth(202);
      const odds = rival.odds.length === 2 ? t('oddsTwo') : rival.odds.length === 1 ? t('oddsOne') : '';
      const about = t('rivalAbout', { level: t(LEVEL_TEXT[LEVELS[rival.level - 1].id]), style: t(RIVAL_TEXT(rival.id, 'style')) }) + (odds ? `, ${odds}` : '');
      this.text(x + w / 2 - 12, y, about, 12, C.dim).setOrigin(1, 0.5).setDepth(202);
    });
    this.button('back', x, this.H - 34, 200, 40, t('back'), () => this.showMenu());
  }

  /** A game against rival `i`, if the ladder has reached it. */
  startRival(i: number) {
    if (i > this.rivalsBeaten) {
      ui('refuse');
      return;
    }
    this.daily = false;
    this.startGame('rival', rivalPlayer(i), [], RIVALS[i].level, { start: rivalStart(i), rival: i });
  }

  // ---- statue puzzles -------------------------------------------------------------------------

  /** The puzzle ladder (mate in one, two and three, five each) and today's puzzle. */
  showPuzzles() {
    this.clear();
    this.screen = 'puzzles';
    playMusic(SONG, 'calm');
    const solved = loadPuzzles();
    this.add.text(30, 22, t('puzzlesButton'), { fontFamily: FONT, fontSize: '30px', color: hex(C.ink), fontStyle: 'bold' });
    this.text(30, 62, t('puzzlesHint'), 13, C.dim, { wordWrap: { width: this.W - 60 } });
    const cx = this.W / 2;
    const size = Math.min(64, (this.H - 290) / 3);
    // The ladder opens in order: the first unsolved puzzle is the next one.
    const next = LADDER.findIndex((id) => !solved.includes(id));
    for (let row = 0; row < 3; row++) {
      const y = 130 + row * (size + 14) + size / 2;
      this.text(cx - 3 * (size + 12) - 30, y, t('mateIn', { n: row + 1 }), 15, C.ink, { fontStyle: 'bold' }).setOrigin(1, 0.5);
      for (let col = 0; col < 5; col++) {
        const k = row * 5 + col;
        const id = LADDER[k];
        const done = solved.includes(id);
        const open = done || k <= next || next < 0;
        const x = cx + (col - 2) * (size + 12);
        const [rect] = this.button(`puzzle-${k}`, x, y, size, size, done ? '✓' : open ? String(k + 1) : '🔒', () => (open ? this.startPuzzle(PUZZLES[id], false) : ui('refuse')), k === next);
        if (done) rect.setFillStyle(0x3d5a3a);
      }
    }
    this.drawDaily(cx, 130 + 3 * (size + 14) + 26);
    this.button('back', cx, this.H - 34, 200, 40, t('back'), () => this.showMenu());
  }

  /** Today's puzzle: its length, the streak, and a button to play it while today's try is open. */
  private drawDaily(cx: number, y: number) {
    const rec = loadDaily(DAILY);
    const p = dailyPuzzle(dailyRand(DAILY));
    this.text(cx, y, t('dailyLine', { n: p.mateIn, streak: rec.streak, best: rec.best }), 14, C.dim).setOrigin(0.5);
    if (rec.score !== null) this.text(cx, y + 32, t('dailySolved', { score: rec.score }), 16, C.gold, { fontStyle: 'bold' }).setOrigin(0.5);
    else if (rec.played) this.text(cx, y + 32, t('dailyUsed'), 15, C.amber).setOrigin(0.5);
    else this.button('daily-play', cx, y + 34, 280, 40, t('dailyPlay'), () => this.startDaily(), true);
  }

  /** Today's puzzle, which uses up today's one try; once tried, the menu's button shows the puzzles. */
  private startDaily() {
    const rec = loadDaily(DAILY);
    if (rec.played) {
      this.showPuzzles();
      return;
    }
    startDaily(DAILY);
    this.startPuzzle(dailyPuzzle(dailyRand(DAILY)), true);
  }

  startPuzzle(p: Puzzle, daily: boolean) {
    this.daily = daily;
    const player: Side = p.fen.split(' ')[1] === 'b' ? 'b' : 'w';
    this.startGame('puzzle', player, [], this.level, { start: p.fen, puzzle: p });
  }

  /** Marks the statue the solution moves next; on today's puzzle it costs a point. */
  private showHint() {
    const p = this.puzzle;
    if (!p || !this.humanTurn() || this.hintSquare >= 0) {
      ui('refuse');
      return;
    }
    this.hintSquare = squareAt(p.line[this.pos.history.length].slice(0, 2));
    this.misses++;
    this.refresh();
  }

  // ---- game review ----------------------------------------------------------------------------

  /** Steps through the game just played, marking each move by the deep search. */
  showReview() {
    const moves = this.pos.history.map((u) => moveText(u.move));
    this.review = { start: this.pos.start, moves, side: this.mode === 'duo' ? null : this.player, ply: moves.length, best: [], scores: [] };
    this.screen = 'review';
    this.drawReview();
    void this.runReview();
  }

  /** Searches every position of the game in turn, best move and score, redrawing as it goes. */
  private async runReview() {
    const gen = this.gen;
    const r = this.review!;
    const pos = new Position(r.start);
    for (let ply = 0; ply <= r.moves.length; ply++) {
      if (ply > 0) pos.make(pos.findMove(r.moves[ply - 1])!);
      const { move, score } = await analyse(pos, REVIEW_LEVEL);
      if (gen !== this.gen || this.review !== r) return;
      r.best[ply] = move;
      r.scores[ply] = score;
      this.reviewPanel();
    }
  }

  /** Each move's mark (null while not yet searched, or for the Stone AI's moves). */
  marks(): (Mark | null)[] {
    const r = this.review;
    if (!r) return [];
    return r.moves.map((text, i) => {
      const side: Side = (r.start.split(' ')[1] === 'b') !== (i % 2 === 1) ? 'b' : 'w';
      if (r.side && side !== r.side) return null;
      if (r.scores[i + 1] === undefined) return null;
      if (r.best[i] === text) return 'best';
      // Lost against the best: what the best kept, less what the move left (the score after is the other side's).
      const loss = r.scores[i] + r.scores[i + 1];
      return loss >= BLUNDER ? 'blunder' : loss >= DOUBTFUL ? 'doubtful' : 'good';
    });
  }

  /** The board at the review's ply and its panel. */
  private drawReview() {
    const r = this.review!;
    this.clear();
    this.screen = 'review';
    playMusic(SONG, 'calm');
    this.pos = new Position(r.start);
    for (const text of r.moves.slice(0, r.ply)) this.pos.make(this.pos.findMove(text)!);
    this.result = null;
    this.clock = null;
    this.drawBoard();
    this.syncPieces();
    this.arrow = this.add.graphics().setDepth(60);
    const x = this.panelX;
    const w = this.panelW;
    const top = this.board.y - 8;
    this.add.text(x, top, t('reviewTitle'), { fontFamily: FONT, fontSize: '28px', color: hex(C.ink), fontStyle: 'bold' });
    this.reviewTexts = [
      this.text(x, top + 40, '', 13, C.dim, { wordWrap: { width: w } }),
      this.text(x, top + 76, '', 16, C.ink, { fontStyle: 'bold', wordWrap: { width: w } }),
      this.text(x, top + 104, '', 20, C.ink, { fontStyle: 'bold' }),
      this.text(x, top + 136, '', 15, C.amber, { wordWrap: { width: w } }),
      this.text(x, top + 186, '', 13, C.dim, { wordWrap: { width: w } }),
    ];
    const by = this.board.y + 8 * this.board.size - 64;
    const bw = (w - 24) / 4;
    const step = (to: number) => () => this.reviewStep(to);
    this.button('review-first', x + bw / 2, by, bw, 38, '⏮', step(-Infinity));
    this.button('review-prev', x + bw * 1.5 + 8, by, bw, 38, '◀', step(-1));
    this.button('review-next', x + bw * 2.5 + 16, by, bw, 38, '▶', step(1));
    this.button('review-last', x + bw * 3.5 + 24, by, bw, 38, '⏭', step(Infinity));
    this.button('menu', x + w / 2, by + 46, w, 38, t('menu'), () => (this.mode === 'rival' ? this.showRivals() : this.showMenu()));
    this.reviewPanel();
  }

  private reviewTexts: Phaser.GameObjects.Text[] = [];
  /** The review's arrow for the better move, over the statues. */
  private arrow?: Phaser.GameObjects.Graphics;

  /** Moves the review by `by` plies (or to an end), and redraws the board there. */
  private reviewStep(by: number) {
    const r = this.review;
    if (!r) return;
    const ply = Math.max(0, Math.min(r.moves.length, by === Infinity ? r.moves.length : by === -Infinity ? 0 : r.ply + by));
    if (ply === r.ply) {
      ui('refuse');
      return;
    }
    r.ply = ply;
    // The board is redrawn without clearing, so the search keeps going.
    this.pos = new Position(r.start);
    for (const text of r.moves.slice(0, ply)) this.pos.make(this.pos.findMove(text)!);
    this.syncPieces();
    this.reviewPanel();
  }

  /** The review's texts and the board's marks: the move that led here, its mark and the better move. */
  private reviewPanel() {
    const r = this.review;
    const [progress, moveLine, markLine, betterLine, summary] = this.reviewTexts;
    if (!r || !progress?.active) return;
    const searched = Math.min(r.scores.length, r.moves.length + 1);
    progress.setText(searched > r.moves.length ? t('reviewDone') : t('reviewWorking', { n: searched, of: r.moves.length + 1 }));
    const marks = this.marks();
    const g = this.hl!;
    const S = this.board.size;
    g.clear();
    const arrow = this.arrow!;
    arrow.clear();
    betterLine.setText('');
    if (r.ply === 0) {
      moveLine.setText(t('reviewStart'));
      markLine.setText('');
    } else {
      const i = r.ply - 1;
      const m = this.pos.history[i].move;
      const side = sideOf(m.piece);
      moveLine.setText(t('reviewMove', { n: Math.floor(i / 2) + 1, side: t(side === 'w' ? 'white' : 'black'), piece: t(PIECE_TEXT[kindOf(m.piece)]), from: squareName(m.from), to: squareName(m.to) }));
      for (const sq of [m.from, m.to]) {
        const c = this.centre(sq);
        g.fillStyle(C.last, 0.28).fillRect(c.x - S / 2, c.y - S / 2, S, S);
      }
      const mark = marks[i];
      const MARK_TEXT: Record<Mark, TextKey> = { best: 'markBest', good: 'markGood', doubtful: 'markDoubtful', blunder: 'markBlunder' };
      const MARK_COLOUR: Record<Mark, number> = { best: C.gold, good: C.ink, doubtful: C.amber, blunder: C.violet };
      if (r.side && side !== r.side) markLine.setText(this.mode === 'rival' ? t('markRival', { name: this.rivalName() }) : t('markTheirs')).setColor(hex(C.dim));
      else if (!mark) markLine.setText(t('markWaiting')).setColor(hex(C.dim));
      else markLine.setText(t(MARK_TEXT[mark])).setColor(hex(MARK_COLOUR[mark]));
      // A doubtful move or a blunder shows the better move, as an arrow on the board.
      const best = r.best[i];
      if ((mark === 'doubtful' || mark === 'blunder') && best) {
        const from = squareAt(best.slice(0, 2));
        const to = squareAt(best.slice(2, 4));
        const before = new Position(r.start);
        for (const text of r.moves.slice(0, i)) before.make(before.findMove(text)!);
        betterLine.setText(t('better', { piece: t(PIECE_TEXT[kindOf(before.board[from])]), from: best.slice(0, 2), to: best.slice(2, 4) }));
        const a = this.centre(from);
        const b = this.centre(to);
        arrow.lineStyle(S * 0.12, C.select, 0.85).lineBetween(a.x, a.y, b.x, b.y);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        arrow.fillStyle(C.select, 0.9).fillTriangle(
          b.x,
          b.y,
          b.x - Math.cos(ang - 0.5) * S * 0.38,
          b.y - Math.sin(ang - 0.5) * S * 0.38,
          b.x - Math.cos(ang + 0.5) * S * 0.38,
          b.y - Math.sin(ang + 0.5) * S * 0.38,
        );
      }
    }
    const count = (k: Mark) => marks.filter((m) => m === k).length;
    summary.setText(t('reviewSummary', { good: count('best') + count('good'), doubtful: count('doubtful'), blunder: count('blunder') }));
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

