import Phaser from 'phaser';
import { playMusic, playSting, ui } from '../../../../shared/audio';
import { renderScale, viewFrame } from '../../../../shared/scaling';
import { settings } from '../../../../shared/settings';
import { BROWN, GOLD, MOSS, num, OCHRE, RES, RUST, SEPIA, shown } from '../art/nouveau';
import { needTexture, POTION_ORIGIN, potionTexture, tileTexture, TOOL_PAD, toolTexture } from '../art/textures';
import { adjacent, COLS, inBoard, ROWS, special, stuck, validMoves, type Board, type Cell, type Tile } from '../game/board';
import { EXAMS } from '../game/exams';
import { formatNumber } from '../../../../shared/i18n';
import { KIND_COUNTS, KIND_NAMES, KINDS, type Kind } from '../game/kinds';
import { blockersFor, MOVE_BONUS, orderFor, POTION_NAMES, RICH_BLOCKERS, RICH_MOVES, RICH_SHARE, riskFor, RUSH_COINS, RUSH_MOVES, TWIN_BONUS } from '../game/orders';
import { RANKS, rankOf, starsFor, STARS_2, STARS_3 } from '../game/ranks';
import { loadProgress, saveProgress } from '../game/save';
import { canUse, funnel, nextExam, nextOrder, pestle, sift, stir, TOOL_ORDER, TOOLS, trySwap, type Step, type Tool } from '../game/sim';
import { checkTrophies } from '../trophies/check';
import { buyHerb, examOpen, heldPantry, HERB_COST, PANTRY_MAX, progressOf, standingOf, startOrder, type GameState } from '../game/state';
import { buyUpgrade, UPGRADE_ORDER, upgradeCost, UPGRADES, type UpgradeId } from '../game/upgrades';
import { sfx, SONG } from '../audio';
import { t } from '../i18n';
import { makeButton } from '../ui/Button';
import { BOARD, CAPTION, cellX, cellY, NEEDS, PANEL, PANTRY, RIBBON, SERIF, TOOL, UI_DEPTH } from './layout';

/** Longest frame step, so a backgrounded tab doesn't skip the animations. */
const MAX_STEP_MS = 250;
const SWAP_MS = 140;
const CLEAR_MS = 200;
const FALL_MS = 240;
const SHUFFLE_MS = 400;
/** How long a sifted row takes to fade out and grow back. */
const SIFT_MS = 220;
/** How long the board sits idle before two tiles that would match swell as a hint. */
const HINT_MS = 6000;
/** How long mould takes to creep onto a tile, and a served customer's or a new stage's note to show. */
const MOULD_MS = 260;
const NOTE_MS = 700;

/**
 * Draw order: the table, catalyst row bands, the cursor, specials (whose rays and petals sit under
 * their neighbours), tiles, the panel, and gathered tiles flying to the label.
 */
const DEPTH = { band: 1.5, cursor: 1.8, catalyst: 1.9, tile: 2, resin: 2.1, panel: 3, flying: 4 };

/** A result card button: its caption and what a tap does. */
interface Choice {
  label: string;
  act: () => void;
}

/** A serif text style in the label's inks. */
const ink = (size: number, color = SEPIA, fontStyle = '') => ({ fontFamily: SERIF, fontSize: `${size}px`, fontStyle, color, resolution: Math.max(2, renderScale) });

/** One piece of an animation, played in order: `step` gets 0 to 1 over `ms` of game time. */
interface Anim {
  ms: number;
  start?: () => void;
  step?: (k: number) => void;
  end?: () => void;
}

const ease = (k: number) => 1 - (1 - k) * (1 - k);

export class GameScene extends Phaser.Scene {
  /** The order being played; read by the playthrough test. */
  state!: GameState;
  /** True while a swap and its matches are being shown; taps wait until it is over. */
  busy = false;
  /** The tile picked by the first tap of a swap; read by the playthrough test. */
  selected: Cell | null = null;
  /** The bench tool picked up and waiting for a tap on the board (Sift, Pestle or Funnel), if any. */
  armed: Tool | null = null;
  /** True while Sift is picked up and waiting for a tap on the row to reroll. */
  get sifting() {
    return this.armed === 'sift';
  }
  /** The first tile picked for the Funnel. */
  private funnelFrom: Cell | null = null;
  /** The bench tool under the pointer, whose tip the caption shows. */
  private hoverTool: Tool | null = null;
  private sprites = new Map<number, Phaser.GameObjects.Image>();
  private queue: Anim[] = [];
  private animAt = 0;
  private started = false;
  private clock = 0;
  private lastFrame: number | null = null;
  private idleMs = 0;
  private hint: number[] = [];
  private dragFrom: { cell: Cell; x: number; y: number } | null = null;
  /** The ingredient counts the panel shows, which catch up with the state as matches are shown. */
  private shown: Record<string, number> = {};
  private cursor!: Phaser.GameObjects.Image;
  private bands: Phaser.GameObjects.Image[] = [];
  private bars!: Phaser.GameObjects.Graphics;
  private panel!: Phaser.GameObjects.Container;
  private needTexts = new Map<Kind, Phaser.GameObjects.Text>();
  private movesText!: Phaser.GameObjects.Text;
  private starIcons: Phaser.GameObjects.Image[] = [];
  private ruleText!: Phaser.GameObjects.Text;
  private coinsText!: Phaser.GameObjects.Text;
  private coinIcon!: Phaser.GameObjects.Image;
  private tools = new Map<Tool, Phaser.GameObjects.Image>();
  private rankBar!: Phaser.GameObjects.Graphics;
  private rankTitle!: Phaser.GameObjects.Text;
  private rankCount!: Phaser.GameObjects.Text;
  private rankNext!: Phaser.GameObjects.Text;
  private caption!: Phaser.GameObjects.Graphics;
  private captionText!: Phaser.GameObjects.Text;
  private captionSun!: Phaser.GameObjects.Image;
  private result!: Phaser.GameObjects.Container;
  private resultTitle!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private resultRank!: Phaser.GameObjects.Text;
  private resultStars: Phaser.GameObjects.Image[] = [];
  private resultButton!: Phaser.GameObjects.Container;
  /** What the result card's single button does. */
  private resultAct: () => void = () => {};
  // Made when first needed: every Text takes a Math.random call (its texture's key), and one more
  // before or during the first order would change the seeded playthrough's board and refills.
  /** The result card's two buttons (the next order modest or rich, or an examination's retry). */
  private resultPair?: Phaser.GameObjects.Container[];
  private pairActs: (() => void)[] = [];
  /** The result card's links: the workbench, the herbalist and the next guild examination. */
  private resultBench?: Phaser.GameObjects.Text;
  private resultHerbs?: Phaser.GameObjects.Text;
  private resultExam?: Phaser.GameObjects.Text;
  /** What the caption says while the result card is up, if anything. */
  private resultCaption: string | null = null;
  private herbs?: Phaser.GameObjects.Container;
  private herbRows?: Phaser.GameObjects.Container;
  private herbCoins?: Phaser.GameObjects.Text;
  private bench?: Phaser.GameObjects.Container;
  private benchRows?: Phaser.GameObjects.Container;
  private benchCoins?: Phaser.GameObjects.Text;
  private pantry?: Phaser.GameObjects.Container;
  private pantryShown = '';
  private note?: Phaser.GameObjects.Text;
  /** The ingredients the label's rows show, from the top: the first customer's, then the second's. */
  private rows: Kind[] = [];
  /** How many of each the rows ask for: kept from `buildPanel`, since a royal commission's needs move on before its label is rebuilt. */
  private rowNeeds: Partial<Record<Kind, number>> = {};

  constructor() {
    super('Game');
  }

  create() {
    // The view can be wider or taller than the designed 960x540 (fill mode): the camera puts the
    // designed layout in the middle of the view, and the wall behind it covers the whole view.
    const frame = viewFrame(this);
    this.cameras.main.setScroll(-frame.x, -frame.y);
    shown(this.add.image(-frame.x, -frame.y, 'wall').setOrigin(0));
    shown(this.add.image(0, 0, 'table').setOrigin(0));
    this.cursor = shown(this.add.image(0, 0, 'cursor')).setDepth(DEPTH.cursor).setVisible(false);
    this.bars = this.add.graphics().setDepth(DEPTH.panel);
    this.createRibbon();
    this.createFooter();
    this.createTools();
    this.createCaption();
    this.createResult();
    this.begin(startOrder(loadProgress()));

    // A tap on a button (a bench tool or the result card's) is the button's alone, not also a tap on the board.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.pointerDown(p);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.pointerMove(p));
    this.input.on('pointerup', () => (this.dragFrom = null));
  }

  update(time: number) {
    // Game time from the frame's own timestamp, so animations follow the browser's clock.
    const dt = this.lastFrame === null ? 0 : Phaser.Math.Clamp(time - this.lastFrame, 0, MAX_STEP_MS);
    this.lastFrame = time;
    this.clock += dt;
    this.runQueue(dt);
    this.updateHint(dt);
    checkTrophies(this.state);
  }

  // ---- Playing an order ----

  /** Shows a new order on a new board. */
  private begin(state: GameState) {
    this.state = state;
    for (const sprite of this.sprites.values()) sprite.destroy();
    this.sprites.clear();
    this.queue = [];
    this.busy = false;
    this.selected = null;
    this.armed = null;
    this.funnelFrom = null;
    this.hint = [];
    this.idleMs = 0;
    this.shown = { ...state.got };
    state.board.forEach((row, r) => row.forEach((tile, c) => this.sprites.set(tile.id, this.tileSprite(tile, cellX(c), cellY(r)))));
    this.result.setVisible(false);
    this.bench?.setVisible(false);
    this.herbs?.setVisible(false);
    this.note?.setVisible(false);
    this.resultCaption = null;
    this.buildPanel();
    this.refresh();
  }

  private tileSprite(tile: Tile, x: number, y: number) {
    // Tiles fall past resin, behind it.
    return shown(this.add.image(x, y, tileTexture(tile))).setDepth(special(tile) ? DEPTH.catalyst : tile.resin ? DEPTH.resin : DEPTH.tile);
  }

  private cellAt(x: number, y: number): Cell | null {
    const cell = { col: Math.floor((x - BOARD.x) / BOARD.cell), row: Math.floor((y - BOARD.y) / BOARD.cell) };
    return inBoard(cell) ? cell : null;
  }

  /** A tap picks a tile, and a tap on its neighbour swaps the two. Tapping it again lets it go. */
  private pointerDown(p: Phaser.Input.Pointer) {
    const cell = this.cellAt(p.worldX, p.worldY);
    if (!cell || this.busy || this.state.phase !== 'play') return;
    if (this.armed === 'sift') return this.siftRow(cell.row);
    if (this.armed === 'pestle') return this.usePestle(cell);
    if (this.armed === 'funnel') return this.pickFunnel(cell);
    const picked = this.selected;
    // Jars, resin and mould hold their tiles: they can't be picked up, and a pick survives a tap on one.
    if (stuck(this.state.board[cell.row][cell.col])) return ui('refuse');
    this.dragFrom = { cell, x: p.worldX, y: p.worldY };
    if (picked && adjacent(picked, cell)) this.swap(picked, cell);
    else {
      this.selected = picked && picked.row === cell.row && picked.col === cell.col ? null : cell;
      sfx('pick');
    }
    this.drawCursor();
  }

  /** Dragging a tile half a cell towards a neighbour swaps them too. */
  private pointerMove(p: Phaser.Input.Pointer) {
    if (!this.dragFrom || !p.isDown || this.busy || this.state.phase !== 'play') return;
    const dx = p.worldX - this.dragFrom.x;
    const dy = p.worldY - this.dragFrom.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < BOARD.cell / 2) return;
    const from = this.dragFrom.cell;
    const to = Math.abs(dx) > Math.abs(dy)
      ? { row: from.row, col: from.col + Math.sign(dx) }
      : { row: from.row + Math.sign(dy), col: from.col };
    this.dragFrom = null;
    if (inBoard(to)) this.swap(from, to);
  }

  private swap(a: Cell, b: Cell) {
    // A held second tap of a tap-tap swap must not drag a second swap once the board settles.
    this.dragFrom = null;
    this.clearHint();
    const ta = this.state.board[a.row][a.col];
    const tb = this.state.board[b.row][b.col];
    // Jars, resin and mould hold their tiles: they don't move at all, and the pick stays.
    if (stuck(ta) || stuck(tb)) {
      ui('refuse');
      return this.drawCursor();
    }
    this.selected = null;
    const steps = trySwap(this.state, a, b);
    this.busy = true;
    this.showBands(false);
    sfx('swap');
    this.queue.push(this.slide([{ id: ta.id, from: a, to: b }, { id: tb.id, from: b, to: a }]));
    if (!steps) {
      // No match: the tiles slide back with a bonk and no move is spent.
      this.queue.push({ ...this.slide([{ id: ta.id, from: b, to: a }, { id: tb.id, from: a, to: b }]), start: () => sfx('bonk') });
    } else {
      this.refreshMoves();
      this.penalised(steps);
      this.playSteps(steps);
    }
    this.queue.push({ ms: 0, end: () => this.settle() });
  }

  /** Plays out what a Pestle or Funnel set off, after its own opening animation. */
  private playTool(steps: Step[], opening?: Anim) {
    this.armed = null;
    this.funnelFrom = null;
    saveProgress(progressOf(this.state));
    this.clearHint();
    this.busy = true;
    this.showBands(false);
    this.refresh();
    if (opening) this.queue.push(opening);
    this.playSteps(steps);
    this.queue.push({ ms: 0, end: () => this.settle() });
  }

  /** The forbidden ingredient was matched: the moves pulse, with a buzz. */
  private penalised(steps: Step[]) {
    if (!steps.some((st) => st.penalty)) return;
    this.pulse(this.movesText);
    sfx('penalty');
  }

  /** Queues a swap's or tool's steps, each match's pop a little higher than the one before. */
  private playSteps(steps: Step[]) {
    let cascade = 0;
    for (const step of steps) this.playStep(step, step.cleared.length > 0 ? cascade++ : cascade);
  }

  /** Pestle: the tapped tile is smashed and the board plays out, without a move. */
  private usePestle(cell: Cell) {
    const steps = pestle(this.state, cell);
    if (!steps) {
      ui('refuse');
      return this.putAway();
    }
    sfx('pestle');
    this.playTool(steps);
  }

  /** Funnel: the first tap picks a tile, the second swaps it with any other. */
  private pickFunnel(cell: Cell) {
    const from = this.funnelFrom;
    if (!from) {
      if (stuck(this.state.board[cell.row][cell.col])) ui('refuse');
      else {
        this.funnelFrom = cell;
        sfx('pick');
      }
    } else if (from.row === cell.row && from.col === cell.col) {
      this.funnelFrom = null;
      sfx('pick');
    } else {
      const ta = this.state.board[from.row][from.col];
      const tb = this.state.board[cell.row][cell.col];
      const steps = funnel(this.state, from, cell);
      if (steps) {
        sfx('funnel');
        return this.playTool(steps, this.slide([{ id: ta.id, from, to: cell }, { id: tb.id, from: cell, to: from }]));
      }
      ui('refuse');
    }
    this.refresh();
  }

  private putAway() {
    this.armed = null;
    this.funnelFrom = null;
    this.refresh();
  }

  /** Slides tiles from one cell to another, all at once. */
  private slide(tiles: { id: number; from: Cell; to: Cell }[]): Anim {
    return {
      ms: SWAP_MS,
      step: (k) => {
        for (const { id, from, to } of tiles) {
          this.sprites.get(id)!.setPosition(
            Phaser.Math.Linear(cellX(from.col), cellX(to.col), ease(k)),
            Phaser.Math.Linear(cellY(from.row), cellY(to.row), ease(k)),
          );
        }
      },
    };
  }

  /**
   * Shows one round of a swap: a fired Catalyst's row lights up, the matched tiles pop while any
   * brewed Catalyst gets its halo, then the rest fall and new ones drop in.
   */
  private playStep(step: Step, cascade: number) {
    if (step.cleared.length > 0) {
      // Looked up when it starts: a cascade can match tiles that only drop in on an earlier step.
      let popping: Phaser.GameObjects.Image[] = [];
      let flying: { sprite: Phaser.GameObjects.Image; x0: number; y0: number; x1: number; y1: number }[] = [];
      let brewing: Phaser.GameObjects.Image[] = [];
      let flash: Phaser.GameObjects.Image[] = [];
      const needs = step.needs;
      const big = step.rows.length + step.cols.length + step.areas.length + step.bursts.length > 0;
      this.queue.push({
        ms: big ? CLEAR_MS * 1.5 : CLEAR_MS,
        start: () => {
          // Ingredients the order needs fly to their row on the label; the rest just pop.
          popping = [];
          flying = [];
          for (const t of step.cleared) {
            const sprite = this.sprites.get(t.id)!;
            const row = needs.indexOf(t.kind);
            if (row < 0) popping.push(sprite);
            else flying.push({ sprite: sprite.setDepth(DEPTH.flying), x0: sprite.x, y0: sprite.y, x1: NEEDS.x, y1: this.rowY(row) });
          }
          this.stepSounds(step, cascade);
          brewing = [...step.brewed, ...step.melted, ...step.scrubbed].map((t) => this.sprites.get(t.id)!.setTexture(tileTexture(t)).setDepth(special(t) ? DEPTH.catalyst : DEPTH.tile));
          flash = [
            ...step.rows.map((row) => this.bandAt(row)),
            ...step.cols.map((col) => shown(this.add.image(BOARD.x + col * BOARD.cell - 1, BOARD.y - 1, 'band-col').setOrigin(0)).setDepth(DEPTH.band)),
            ...step.areas.map((a) => shown(this.add.image(cellX(a.col), cellY(a.row), 'area')).setDepth(DEPTH.band)),
            // Two Blooms swapped together light the 5x5 around them: the 3x3 square, grown.
            ...step.bursts.map((a) => shown(this.add.image(cellX(a.col), cellY(a.row), 'area'), 5 / 3).setDepth(DEPTH.band)),
          ];
        },
        step: (k) => {
          popping.forEach((s) => shown(s, 1 + 0.3 * k - 1.3 * k * k).setAlpha(1 - k));
          for (const f of flying) {
            f.sprite.setPosition(Phaser.Math.Linear(f.x0, f.x1, ease(k)), Phaser.Math.Linear(f.y0, f.y1, ease(k)));
            shown(f.sprite, 1 - 0.45 * k).setAlpha(1 - k * k);
          }
          brewing.forEach((s) => shown(s, settings.reduceMotion ? 1 : 1 + 0.25 * Math.sin(Math.PI * k)));
          // With reduced motion the lit row holds steady instead of blinking.
          flash.forEach((b) => b.setAlpha(settings.reduceMotion ? 1 : 0.4 + 0.6 * Math.abs(Math.sin(k * Math.PI * 2))));
        },
        end: () => {
          if (flying.length > 0) sfx('tink');
          flash.forEach((b) => b.destroy());
          for (const t of step.cleared) {
            this.sprites.get(t.id)?.destroy();
            this.sprites.delete(t.id);
            if (needs.includes(t.kind)) this.shown[t.kind] = (this.shown[t.kind] ?? 0) + 1;
          }
          this.refreshNeeds();
        },
      });
    } else if (step.brewed.length + step.melted.length + step.scrubbed.length > 0) {
      // A Pestle on a resin or mould tile with nothing beside it to gather, or a run whose other tiles are all
      // resin-held: the coat or fuzz comes off in place, and a special the run brewed shows.
      let freeing: Phaser.GameObjects.Image[] = [];
      this.queue.push({
        ms: CLEAR_MS,
        start: () => {
          freeing = [...step.brewed, ...step.melted, ...step.scrubbed].map((t) => this.sprites.get(t.id)!.setTexture(tileTexture(t)).setDepth(special(t) ? DEPTH.catalyst : DEPTH.tile));
          if (step.brewed.length > 0) sfx('brew');
          if (step.melted.length > 0) sfx('sizzle');
          if (step.scrubbed.length > 0) sfx('scrub');
        },
        step: (k) => freeing.forEach((s) => shown(s, settings.reduceMotion ? 1 : 1 + 0.25 * Math.sin(Math.PI * k))),
      });
    }
    if (step.spread) {
      // Mould creeps onto a tile: it swells a little as its fuzz appears (held still with reduced motion).
      const grown = step.spread;
      let sprite: Phaser.GameObjects.Image | undefined;
      this.queue.push({
        ms: MOULD_MS,
        start: () => {
          sprite = this.sprites.get(grown.id)?.setTexture(tileTexture(grown)).setDepth(DEPTH.tile);
          sfx('spread');
        },
        step: (k) => sprite && shown(sprite, settings.reduceMotion ? 1 : 1 + 0.2 * Math.sin(Math.PI * k)),
      });
      return;
    }
    if (step.served) {
      // A customer is served: a note over the board, and their rows finish.
      const potion = step.served;
      const bonus = this.state.served[0] === potion && this.state.speedBonus > 0;
      this.queue.push({ ms: 0, start: () => sfx('served') });
      this.queue.push(this.showNote(t(bonus ? 'servedFast' : 'served', { potion: t(POTION_NAMES[potion]), coins: TWIN_BONUS })));
      return;
    }
    if (step.stage) {
      // A royal commission moves on: the label is rebuilt for the next potion and the moves stay.
      const stage = step.stage;
      this.queue.push({ ms: 0, end: () => ((this.shown = { ...this.state.got }), this.buildPanel(), this.refreshNeeds(), sfx('stage')) });
      this.queue.push(this.showNote(t('nextStage', { stage: stage + 1, potion: t(POTION_NAMES[this.state.current.stages![stage].potion]) })));
      return;
    }
    if (step.shuffled) this.queue.push({ ms: 0, start: () => sfx('shuffle') });
    this.queue.push(this.moveTo(step.board, step.shuffled ? SHUFFLE_MS : FALL_MS));
  }

  /** One match's sounds as it pops: a pop rising with the cascade, then what it brewed, fired or freed. */
  private stepSounds(step: Step, cascade: number) {
    sfx('pop', { pitch: 1.12 ** Math.min(cascade, 6) });
    if (step.bursts.length > 0) sfx('burst');
    else if (step.rows.length + step.cols.length + step.areas.length > 0) sfx('fire');
    if (step.brewed.length > 0) sfx('brew');
    if (step.cleared.some((t) => t.jar)) sfx('cork');
    if (step.melted.length > 0) sfx('sizzle');
    if (step.scrubbed.length > 0) sfx('scrub');
  }

  /** A line over the board for a moment: a served customer or a commission's next stage. */
  private showNote(text: string): Anim {
    return {
      ms: NOTE_MS,
      start: () => {
        const size = BOARD.cell * COLS;
        this.note ??= this.add
          .text(BOARD.x + size / 2, BOARD.y + size / 2, '', { ...ink(20, '#f1e6c8', 'italic bold'), backgroundColor: '#2e1d14', padding: { x: 14, y: 8 } })
          .setOrigin(0.5)
          .setDepth(DEPTH.flying);
        this.note.setText(text).setVisible(true).setAlpha(1);
      },
      step: (k) => this.note?.setAlpha(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3),
      end: () => this.note?.setVisible(false),
    };
  }

  /** Moves every tile to its cell on `board`; new tiles drop in from above the board. */
  private moveTo(board: Board, ms: number): Anim {
    const moves: { sprite: Phaser.GameObjects.Image; x0: number; y0: number; x1: number; y1: number }[] = [];
    return {
      ms,
      start: () => {
        // A shuffle that falls back to a fresh board replaces every tile, so drop the old sprites.
        const ids = new Set(board.flat().map((t) => t.id));
        for (const [id, sprite] of this.sprites) if (!ids.has(id)) (sprite.destroy(), this.sprites.delete(id));
        for (let col = 0; col < COLS; col++) {
          const fresh = board.filter((row) => !this.sprites.has(row[col].id)).length;
          for (let row = 0; row < ROWS; row++) {
            const tile = board[row][col];
            let sprite = this.sprites.get(tile.id);
            if (!sprite) {
              sprite = this.tileSprite(tile, cellX(col), cellY(row - fresh));
              this.sprites.set(tile.id, sprite);
            }
            moves.push({ sprite, x0: sprite.x, y0: sprite.y, x1: cellX(col), y1: cellY(row) });
          }
        }
      },
      step: (k) => {
        for (const m of moves) {
          m.sprite.setPosition(Phaser.Math.Linear(m.x0, m.x1, ease(k)), Phaser.Math.Linear(m.y0, m.y1, ease(k)));
          // Tiles above the board stay hidden until they drop onto it.
          m.sprite.setVisible(m.sprite.y > BOARD.y);
        }
      },
    };
  }

  /** Once a swap has played out: the panel catches up, and a filled order is sold. */
  private settle() {
    this.busy = false;
    this.shown = { ...this.state.got };
    this.refresh();
    const s = this.state;
    if (s.phase === 'sold') {
      saveProgress(progressOf(s));
      this.showSold();
    } else if (s.current.exam && s.phase === 'failed') {
      playSting(SONG, 'fail');
      this.showResult(t('outOfMoves'), t('potionUnfinished', { potion: t(POTION_NAMES[s.current.potion]) }), t('noSeal'), this.examRetry(), 0);
    } else if (s.phase === 'failed') {
      playSting(SONG, 'fail');
      const what = s.current.stages ? t('royalUnfinished') : s.current.second ? t('twinUnfinished') : t('potionUnfinished', { potion: t(POTION_NAMES[s.current.potion]) });
      this.showResult(t('outOfMoves'), what, t('noStars'), [{ label: t('tryAgain'), act: () => this.begin(nextOrder(this.state)) }], 0);
    }
  }

  private runQueue(dt: number) {
    let left = dt;
    while (this.queue.length > 0) {
      const anim = this.queue[0];
      if (!this.started) {
        anim.start?.();
        this.started = true;
        this.animAt = 0;
      }
      const need = anim.ms - this.animAt;
      if (left < need) {
        this.animAt += left;
        anim.step?.(this.animAt / anim.ms);
        return;
      }
      left -= need;
      anim.step?.(1);
      this.queue.shift();
      this.started = false;
      anim.end?.();
    }
  }

  // ---- Bench tools ----

  private useTool(tool: Tool) {
    if (this.busy) return;
    if (this.state.phase !== 'play') return ui('refuse');
    if (this.armed === tool) {
      this.armed = null;
      this.funnelFrom = null;
      ui('click');
    } else if (!canUse(this.state, tool)) {
      return ui('refuse');
    } else if (tool === 'stir') {
      stir(this.state);
      saveProgress(progressOf(this.state));
      this.pulse(this.movesText);
      sfx('stir');
    } else {
      ui('click');
      this.armed = tool;
      this.funnelFrom = null;
      this.selected = null;
    }
    this.clearHint();
    this.refresh();
  }

  /** Sift: the row's tiles fade out and new ones grow in their place. */
  private siftRow(row: number) {
    const before = this.state.board.map((r) => r.map((t) => t.id));
    const old = sift(this.state, row);
    this.armed = null;
    if (!old) {
      ui('refuse');
      return this.refresh();
    }
    sfx('sift');
    saveProgress(progressOf(this.state));
    this.clearHint();
    this.busy = true;
    this.showBands(false);
    this.refresh();
    const board = this.state.board;
    let fading: Phaser.GameObjects.Image[] = [];
    let growing: Phaser.GameObjects.Image[] = [];
    this.queue.push({
      ms: SIFT_MS,
      start: () => (fading = old.map((t) => this.sprites.get(t.id)!).filter(Boolean)),
      step: (k) => fading.forEach((s) => shown(s, 1 - 0.6 * k).setAlpha(1 - k)),
      end: () => old.forEach((t) => (this.sprites.get(t.id)?.destroy(), this.sprites.delete(t.id))),
    });
    this.queue.push({
      ms: SIFT_MS,
      start: () => {
        board[row].forEach((tile, col) => {
          if (this.sprites.has(tile.id)) return;
          const sprite = shown(this.tileSprite(tile, cellX(col), cellY(row)), 0);
          this.sprites.set(tile.id, sprite);
          growing.push(sprite);
        });
      },
      step: (k) => growing.forEach((s) => shown(s, ease(k))),
    });
    // If the reroll had to shuffle the board to leave a move, the other tiles move too.
    if (board.some((r, i) => i !== row && r.some((t, c) => t.id !== before[i][c]))) this.queue.push(this.moveTo(board, SHUFFLE_MS));
    this.queue.push({ ms: 0, end: () => this.settle() });
  }

  /** A little swell on a piece of text that just changed (held still with reduced motion). */
  private pulse(target: Phaser.GameObjects.Text) {
    if (settings.reduceMotion) return;
    this.tweens.add({ targets: target, scale: { from: 1.25, to: 1 }, duration: 260, ease: 'Quad.easeOut' });
  }

  // ---- Hints ----

  private updateHint(dt: number) {
    if (this.busy || this.armed || this.state.phase !== 'play') return;
    this.idleMs += dt;
    if (this.idleMs < HINT_MS) return;
    if (this.hint.length === 0) {
      const [a, b] = validMoves(this.state.board)[0] ?? [];
      if (!a) return;
      this.hint = [this.state.board[a.row][a.col].id, this.state.board[b.row][b.col].id];
      sfx('hint');
    }
    // The two tiles swell and settle; with reduced motion they hold still, a little larger.
    const swell = settings.reduceMotion ? 1.14 : 1.08 + Math.sin(this.clock / 110) * 0.08;
    for (const id of this.hint) {
      const sprite = this.sprites.get(id);
      if (sprite) shown(sprite, swell);
    }
  }

  private clearHint() {
    for (const id of this.hint) {
      const sprite = this.sprites.get(id);
      if (sprite) shown(sprite);
    }
    this.hint = [];
    this.idleMs = 0;
  }

  // ---- Drawing ----

  /** The rank ribbon above the board: the rank, a bar of stars towards the next and what it unlocks. */
  private createRibbon() {
    const y = RIBBON.y + RIBBON.h / 2;
    this.rankTitle = this.add.text(RIBBON.x + 29, y, '', ink(13, SEPIA, 'italic bold')).setOrigin(0, 0.5).setDepth(DEPTH.panel);
    this.rankBar = this.add.graphics().setDepth(DEPTH.panel);
    this.rankCount = this.add.text(0, y, '', ink(11, RUST, 'bold')).setOrigin(0, 0.5).setDepth(DEPTH.panel);
    this.rankNext = this.add.text(0, y, '', ink(10, BROWN, 'italic')).setOrigin(0, 0.5).setDepth(DEPTH.panel);
  }

  /** Moves, the stars they are worth now, and the coins, along the bottom of the order panel. */
  private createFooter() {
    this.movesText = this.add.text(560, 464, '', ink(25, SEPIA, 'bold')).setOrigin(0, 0.5).setDepth(DEPTH.panel);
    for (let k = 0; k < 3; k++) this.starIcons.push(shown(this.add.image(709 + k * 25, 462, 'star-off')).setDepth(DEPTH.panel));
    this.ruleText = this.add.text(560, 490, '', ink(11, RUST, 'italic')).setOrigin(0, 0.5).setDepth(DEPTH.panel);
    this.coinIcon = shown(this.add.image(852, 465, 'coin')).setDepth(DEPTH.panel);
    this.coinsText = this.add.text(906, 466, '', ink(21, SEPIA, 'bold')).setOrigin(1, 0.5).setDepth(DEPTH.panel);
  }

  private createTools() {
    TOOL_ORDER.forEach((tool, i) => {
      const button = shown(this.add.image(TOOL.x + i * TOOL.gap - TOOL_PAD, TOOL.y - TOOL_PAD, toolTexture(tool, 'on')))
        .setOrigin(0)
        .setDepth(DEPTH.panel)
        .setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(TOOL_PAD * RES, TOOL_PAD * RES, TOOL.w * RES, TOOL.h * RES), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
      button.on('pointerdown', () => this.useTool(tool));
      button.on('pointerover', () => ((this.hoverTool = tool), this.refreshCaption()));
      button.on('pointerout', () => ((this.hoverTool = null), this.refreshCaption()));
      this.tools.set(tool, button);
    });
  }

  private createCaption() {
    this.caption = this.add.graphics().setDepth(DEPTH.panel);
    this.captionSun = shown(this.add.image(0, CAPTION.y + CAPTION.h / 2, 'sun')).setDepth(DEPTH.panel);
    this.captionText = this.add.text(0, CAPTION.y + CAPTION.h / 2, '', ink(11, SEPIA, 'italic')).setOrigin(0, 0.5).setDepth(DEPTH.panel);
  }

  /** The order card: the potion asked for and a row for each ingredient it needs. */
  private buildPanel() {
    this.panel?.destroy();
    this.needTexts.clear();
    const s = this.state;
    const o = s.current;
    const mid = PANEL.x + PANEL.w / 2;
    const title = o.exam
      ? t('examTitle', { n: o.exam.index + 1 })
      : o.stages
        ? o.last
          ? t('crownsLast')
          : t('royalCommission')
        : o.second
          ? t('twinTitle', { n: o.number })
          : t('orderTitle', { n: o.number });
    const items: Phaser.GameObjects.GameObject[] = [
      this.add.text(mid, 62, title, ink(o.stages || o.second || o.exam ? 24 : 28, SEPIA, 'bold')).setOrigin(0.5),
      shown(this.add.image(606, 145, potionTexture(o.potion))).setOrigin(POTION_ORIGIN.x, POTION_ORIGIN.y),
      this.add.text(606, 164.5, t('potionNumber', { n: o.number }), ink(9, RUST, 'italic bold')).setOrigin(0.5),
      this.add.text(666, 124, t(POTION_NAMES[o.potion]), ink(22, SEPIA, 'italic bold')).setOrigin(0, 0.5),
      this.add.text(666, 152, t(o.exam ? 'paysPass' : o.rich ? 'paysRich' : 'pays', { price: o.price }), ink(15, BROWN)).setOrigin(0, 0.5),
      this.add.text(666, 174, t('perMove', { n: MOVE_BONUS }), ink(15, BROWN)).setOrigin(0, 0.5),
    ];
    // The order's twist, stage or second customer, under the price.
    const line = o.exam
      ? t('examLine', { stars: o.exam.stars, moves: o.exam.stars === 3 ? STARS_3 : STARS_2 })
      : o.stages
      ? t('stageLine', { stage: s.stage + 1, stages: o.stages.length })
      : o.second
        ? t('twinLine', { potion: t(POTION_NAMES[o.second.potion]) })
        : o.rush
          ? t('rushLine', { moves: RUSH_MOVES, coins: RUSH_COINS })
          : o.forbid
            ? t('forbidLine', { kind: t(KIND_NAMES[o.forbid]) })
            : '';
    if (line) items.push(this.add.text(666, 196, line, ink(13, RUST, 'italic bold')).setOrigin(0, 0.5));
    this.rows = Object.keys(o.needs) as Kind[];
    this.rowNeeds = { ...o.needs };
    const second = o.second ? Object.keys(o.second.needs) : [];
    this.rows.forEach((kind, i) => {
      const y = this.rowY(i);
      items.push(shown(this.add.image(NEEDS.x, y, needTexture(kind))));
      const name = t(KIND_NAMES[kind]);
      const label = o.second ? t('needFor', { kind: name, potion: t(POTION_NAMES[second.includes(kind) ? o.second.potion : o.potion]) }) : name;
      items.push(this.add.text(NEEDS.barX, y - 17, label, ink(o.second ? 11 : 13, BROWN, 'italic bold')).setOrigin(0, 0.5));
      const text = this.add.text(906, y + 2, '', ink(18, SEPIA, 'bold')).setOrigin(1, 0.5);
      this.needTexts.set(kind, text);
      items.push(text);
    });
    this.panel = this.add.container(0, 0, items).setDepth(DEPTH.panel);
  }

  /** Where row `i` of the label's ingredients sits: a twin order's four rows are closer together. */
  private rowY(i: number) {
    return this.state.current.second ? NEEDS.twinY + i * NEEDS.twinRow : NEEDS.y + i * NEEDS.row;
  }

  private refresh() {
    this.refreshNeeds();
    this.refreshMoves();
    this.refreshRank();
    this.refreshTools();
    this.coinsText.setText(formatNumber(this.state.coins));
    this.coinIcon.setX(this.coinsText.x - this.coinsText.width - 18);
    this.refreshPantry();
    this.refreshCaption();
    this.drawCursor();
    if (!this.busy) this.showBands(true);
  }

  /** The moves left, lit with the stars a sale would earn now, and what keeps the next star. */
  private refreshMoves() {
    const s = this.state;
    // The waltz: statelier for a royal commission or an examination, tense with three moves or fewer left.
    playMusic(SONG, s.phase === 'play' && s.moves <= 3 ? 'tense' : s.current.stages || s.current.exam ? 'royal' : 'calm');
    this.movesText.setText(t('moves', { n: s.moves })).setColor(s.moves <= 3 && s.phase === 'play' ? '#a8352a' : SEPIA);
    const lit = s.phase === 'sold' ? s.orderStars : s.phase === 'failed' ? 0 : starsFor(s.moves);
    this.starIcons.forEach((icon, k) => icon.setTexture(k < lit ? 'star-on' : 'star-off'));
    this.ruleText.setText(
      lit === 3 ? t('stars3', { n: STARS_3 }) : lit === 2 ? t('stars2', { n: STARS_2 }) : t('stars1'),
    );
  }

  private refreshNeeds() {
    this.bars.clear();
    this.rows.forEach((kind, i) => {
      const n = this.rowNeeds[kind] ?? 0;
      const have = Math.min(this.shown[kind] ?? 0, n);
      const y = this.rowY(i);
      const done = have >= n;
      this.needTexts.get(kind)?.setText(`${formatNumber(have)}/${formatNumber(n)}`).setColor(done ? '#3d6a32' : SEPIA);
      this.bar(NEEDS.barX - 1.5, y - 5.5, NEEDS.barW + 3, NEEDS.barH + 3, have / n, done ? MOSS : OCHRE, this.bars);
    });
  }

  /** What the pantry holds, at the foot of the label: a small icon and count per kind (nothing when it is empty). */
  private refreshPantry() {
    const pantry = this.state.phase === 'play' ? this.state.pantry : heldPantry(this.state);
    const held = Object.entries(pantry).filter(([, n]) => n > 0) as [Kind, number][];
    const key = held.map(([k, n]) => `${k}${n}`).join();
    if (key === this.pantryShown) return;
    this.pantryShown = key;
    this.pantry?.destroy();
    this.pantry = undefined;
    if (held.length === 0) return;
    const items: Phaser.GameObjects.GameObject[] = [];
    let x = 0;
    for (const [kind, n] of [...held].reverse()) {
      items.push(this.add.text(x, 0, formatNumber(n), ink(12, SEPIA, 'bold')).setOrigin(1, 0.5));
      x -= 14;
      items.push(shown(this.add.image(x - 9, 0, needTexture(kind)), 0.45));
      x -= 24;
    }
    items.push(this.add.text(x - 2, 0, t('pantry'), ink(11, BROWN, 'italic')).setOrigin(1, 0.5));
    this.pantry = this.add.container(PANTRY.x, PANTRY.y, items).setDepth(DEPTH.panel);
  }

  /** A rounded progress bar: a pale track with a sepia rim and a fill with a light streak. */
  private bar(x: number, y: number, w: number, h: number, f: number, fill: string, g: Phaser.GameObjects.Graphics) {
    g.fillStyle(0xe3d3ad).fillRoundedRect(x, y, w, h, h / 2);
    g.lineStyle(1.5, num(SEPIA)).strokeRoundedRect(x, y, w, h, h / 2);
    if (f <= 0) return;
    const fw = Math.max(h - 3, (w - 3) * Math.min(1, f));
    g.fillStyle(num(fill)).fillRoundedRect(x + 1.5, y + 1.5, fw, h - 3, (h - 3) / 2);
    if (fw > 10) g.fillStyle(0xfffae6, 0.55).fillRoundedRect(x + 5, y + h * 0.3, fw - 8, Math.max(1.5, h * 0.15), 1);
  }

  private refreshRank() {
    const stars = this.state.stars;
    const at = rankOf(stars);
    const next = RANKS[at + 1];
    this.rankTitle.setText(t(this.state.royal ? 'royalTitle' : RANKS[at].title));
    const barX = Math.max(RIBBON.barX, this.rankTitle.x + this.rankTitle.width + 10);
    this.rankBar.clear();
    this.bar(barX, RIBBON.y + 7.5, RIBBON.barW, 8, next ? stars / next.stars : 1, OCHRE, this.rankBar);
    this.rankCount.setText(next ? `${formatNumber(stars)}/${formatNumber(next.stars)}` : formatNumber(stars)).setX(barX + RIBBON.barW + 7);
    this.rankNext
      .setText(next ? t('nextRank', { rank: t(next.title) }) : t(this.state.royal ? 'guildSeals' : 'allRecipes'))
      .setX(this.rankCount.x + this.rankCount.width + 9);
    // Once Royal Apothecary, a wax seal per guild examination, filled in as each is passed.
    if (!this.state.royal) return;
    const y = RIBBON.y + RIBBON.h / 2;
    EXAMS.forEach((_, k) => {
      const x = this.rankNext.x + this.rankNext.width + 10 + k * 11;
      if (k < this.state.seals) this.rankBar.fillStyle(num(RUST)).fillCircle(x, y, 4.5);
      this.rankBar.lineStyle(1.25, num(k < this.state.seals ? GOLD : BROWN)).strokeCircle(x, y, 4.5);
    });
  }

  private refreshTools() {
    for (const [tool, button] of this.tools) {
      const look = this.armed === tool ? 'armed' : canUse(this.state, tool) ? 'on' : 'off';
      button.setTexture(toolTexture(tool, look));
    }
  }

  /** The caption: what a picked-up tool wants, a hovered tool's tip, or a tip for this order. */
  private refreshCaption() {
    const s = this.state;
    const blockers = s.board.some((row) => row.some((t) => t.jar || t.resin));
    const mould = s.board.some((row) => row.some((t) => t.mould));
    const forbid = s.current.forbid;
    const given = Object.entries(s.fromPantry);
    let text = t('captionTip');
    if (this.herbs?.visible) text = t('captionHerbs', { cost: HERB_COST, max: PANTRY_MAX });
    else if (this.resultCaption && s.phase !== 'play') text = this.resultCaption;
    else if (this.armed === 'sift') text = t('captionSift', { cost: TOOLS.sift.cost });
    else if (this.armed === 'pestle') text = t('captionPestle', { cost: TOOLS.pestle.cost });
    else if (this.armed === 'funnel') text = this.funnelFrom ? t('captionFunnelTo') : t('captionFunnel', { cost: TOOLS.funnel.cost });
    else if (this.hoverTool) text = t('toolTip', { tip: t(TOOLS[this.hoverTool].tip), cost: TOOLS[this.hoverTool].cost });
    else if (given.length > 0 && Object.values(s.got).every((n, i) => n === (s.fromPantry[Object.keys(s.got)[i] as Kind] ?? 0)))
      text = t('captionPantry', { list: given.map(([k, n]) => t(KIND_COUNTS[k as Kind], { n })).reduce((a, b) => t('and', { a, b })) });
    else if (s.current.exam) text = t('captionExam', { stars: s.current.exam.stars });
    else if (s.current.rich)
      text = s.current.rich === 'moves'
        ? t('captionRichMoves', { share: RICH_SHARE * 100, moves: RICH_MOVES })
        : t(s.current.mould > 0 ? 'captionRichBlockersMould' : 'captionRichBlockers', { share: RICH_SHARE * 100, blockers: RICH_BLOCKERS });
    else if (s.current.stages) text = t('captionRoyal');
    else if (s.current.second) text = t('captionTwin', { coins: TWIN_BONUS });
    else if (forbid) text = t('captionForbid', { kind: t(KIND_NAMES[forbid]) });
    else if (mould) text = t('captionMould');
    else if (blockers) text = t('captionBlockers');
    else if (s.current.rush) text = t('captionRush', { moves: RUSH_MOVES, coins: RUSH_COINS });
    this.setCaption(text);
  }

  private setCaption(text: string) {
    if (this.captionText.text === text) return;
    this.captionText.setText(text);
    const w = this.captionText.width + 38;
    // Right-aligned, so it grows to the left, away from the corner buttons.
    const x = CAPTION.right - w;
    this.captionSun.setX(x + 13);
    this.captionText.setX(x + 25);
    this.caption.clear();
    this.caption.fillStyle(0xf1e6c8).fillRoundedRect(x, CAPTION.y, w, CAPTION.h, CAPTION.h / 2);
    this.caption.lineStyle(1.25, num(SEPIA)).strokeRoundedRect(x, CAPTION.y, w, CAPTION.h, CAPTION.h / 2);
  }

  private drawCursor() {
    const cell = this.funnelFrom ?? this.selected;
    this.cursor.setVisible(!!cell);
    if (cell) this.cursor.setPosition(cellX(cell.col), cellY(cell.row));
  }

  /** A gold band behind a row, the one a Catalyst on it will clear. */
  private bandAt(row: number) {
    return shown(this.add.image(BOARD.x - 1, BOARD.y + row * BOARD.cell - 1, 'band').setOrigin(0)).setDepth(DEPTH.band);
  }

  /** Marks every row that holds a Catalyst; hidden while tiles move. */
  private showBands(on: boolean) {
    for (const band of this.bands) band.destroy();
    this.bands = [];
    if (!on) return;
    const rows = this.state.board.flatMap((row, r) => (row.some((t) => t.catalyst) ? [r] : []));
    this.bands = rows.map((row) => this.bandAt(row));
  }

  // ---- After an order ----

  private createResult() {
    const size = BOARD.cell * COLS;
    const card = shown(this.add.image(0, 0, 'result-card'));
    this.resultTitle = this.add.text(0, -82, '', ink(24, SEPIA, 'italic bold')).setOrigin(0.5);
    for (let k = 0; k < 3; k++) this.resultStars.push(shown(this.add.image((k - 1) * 34, -48, 'star-off'), 1.15));
    this.resultText = this.add.text(0, -16, '', ink(13, BROWN)).setOrigin(0.5).setWordWrapWidth(340).setAlign('center');
    this.resultRank = this.add.text(0, 22, '', ink(13, RUST, 'italic bold')).setOrigin(0.5).setWordWrapWidth(340).setAlign('center');
    this.resultButton = makeButton(this, 0, 56, '', () => (ui('click'), this.resultAct()));
    this.result = this.add
      .container(BOARD.x + size / 2, BOARD.y + size / 2, [card, this.resultTitle, ...this.resultStars, this.resultText, this.resultRank, this.resultButton])
      .setDepth(UI_DEPTH);
  }

  // ---- The workbench ----

  /** A link on the result card, under its buttons. */
  private link(text: string, onClick: () => void) {
    const link = this.add.text(0, 92, text, ink(12, RUST, 'italic bold')).setOrigin(0.5).setInteractive({ useHandCursor: true });
    link.on('pointerdown', () => (ui('click'), onClick())).on('pointerover', () => link.setAlpha(0.7)).on('pointerout', () => link.setAlpha(1));
    this.result.add(link);
    return link;
  }

  /**
   * The result card's links, made the first time the card shows: the workbench, the herbalist and,
   * once Royal Apothecary, the next guild examination. They sit in a row, centred.
   */
  private refreshLinks() {
    this.resultBench ??= this.link(t('workbench'), () => this.openBench());
    this.resultHerbs ??= this.link(t('herbalist'), () => this.openHerbs());
    const exam = examOpen(progressOf(this.state));
    if (exam) this.resultExam ??= this.link('', () => this.begin(nextExam(this.state)));
    this.resultExam?.setText(t('examTitle', { n: this.state.seals + 1 })).setVisible(exam);
    const links = [this.resultBench, this.resultHerbs, ...(exam && this.resultExam ? [this.resultExam] : [])];
    const gap = 26;
    let x = -(links.reduce((w, l) => w + l.width, 0) + gap * (links.length - 1)) / 2;
    for (const l of links) {
      l.setX(x + l.width / 2);
      x += l.width + gap;
    }
  }

  /** The two buttons after a sale: the next order, modest or rich (and, after a failed examination, a retry or back to the orders). */
  private createPair() {
    this.resultPair = [0, 1].map((k) => makeButton(this, (k - 0.5) * 176, 56, '', () => (ui('click'), this.pairActs[k]())).setScale(0.82));
    this.result.add(this.resultPair);
  }

  /** The next order, picked modest or rich; the pick is saved so a reload or a retry keeps it. */
  private pick(rich: boolean) {
    this.state.rich = rich;
    saveProgress(progressOf(this.state));
    this.begin(nextOrder(this.state));
  }

  /** The result card's choice of the next order, and the caption that says what a rich one risks. */
  private orderChoice(): Choice[] {
    const risk = riskFor(this.state.order);
    this.resultCaption = risk === 'moves'
      ? t('captionPickRichMoves', { share: RICH_SHARE * 100, moves: RICH_MOVES })
      : t(blockersFor(this.state.order).mould > 0 ? 'captionPickRichBlockersMould' : 'captionPickRichBlockers', { share: RICH_SHARE * 100, blockers: RICH_BLOCKERS });
    return [
      { label: t('modestOrder'), act: () => this.pick(false) },
      { label: t('richOrder'), act: () => this.pick(true) },
    ];
  }

  /** After a failed examination: try it again on the same board, or go back to the orders. */
  private examRetry(): Choice[] {
    this.resultCaption = t('captionExamRetry');
    return [
      { label: t('tryAgain'), act: () => this.begin(nextExam(this.state)) },
      { label: t('backToOrders'), act: () => this.begin(nextOrder(this.state)) },
    ];
  }

  // ---- The herbalist ----

  /** The herbalist's card over the board: a column per ingredient with what the pantry holds and a way to buy one more. */
  private createHerbs() {
    const size = BOARD.cell * COLS;
    const card = shown(this.add.image(0, 0, 'result-card'));
    const title = this.add.text(0, -92, t('herbalist'), ink(24, SEPIA, 'italic bold')).setOrigin(0.5);
    this.herbCoins = this.add.text(0, -68, '', ink(13, BROWN, 'italic')).setOrigin(0.5);
    this.herbRows = this.add.container(0, 0);
    const back = makeButton(this, 0, 86, t('back'), () => (ui('click'), this.closeHerbs()));
    this.herbs = this.add.container(BOARD.x + size / 2, BOARD.y + size / 2, [card, title, this.herbCoins, this.herbRows, back]).setDepth(UI_DEPTH);
  }

  private openHerbs() {
    if (!this.herbs) this.createHerbs();
    this.result.setVisible(false);
    this.herbs!.setVisible(true);
    this.refreshHerbs();
    this.refreshCaption();
  }

  private closeHerbs() {
    this.herbs?.setVisible(false);
    this.result.setVisible(true);
    this.refreshCaption();
  }

  private buyHerb(kind: Kind) {
    if (!buyHerb(this.state, kind)) return ui('refuse');
    ui('coin');
    saveProgress(progressOf(this.state));
    this.refresh();
    this.refreshHerbs();
  }

  /** One column per ingredient: its icon and name, the pantry's count, a Buy link and whether the next order wants it. */
  private refreshHerbs() {
    if (!this.herbRows || !this.herbCoins) return;
    this.herbRows.removeAll(true);
    this.herbCoins.setText(t('coinsToSpend', { n: this.state.coins }));
    const pantry = heldPantry(this.state);
    const next = orderFor(this.state.order, standingOf(progressOf(this.state)));
    const wanted = Object.keys(next.stages ? Object.assign({}, ...next.stages.map((st) => st.needs)) : next.needs);
    KINDS.forEach((kind, i) => {
      const x = (i - 2) * 76;
      const have = pantry[kind] ?? 0;
      this.herbRows!.add(shown(this.add.image(x, -34, needTexture(kind)), 0.8));
      this.herbRows!.add(this.add.text(x, -8, t(KIND_NAMES[kind]), ink(11, BROWN, 'italic bold')).setOrigin(0.5));
      this.herbRows!.add(this.add.text(x, 10, `${formatNumber(have)}/${formatNumber(PANTRY_MAX)}`, ink(15, SEPIA, 'bold')).setOrigin(0.5));
      const can = have < PANTRY_MAX && this.state.coins >= HERB_COST;
      const buy = this.add.text(x, 32, have < PANTRY_MAX ? t('buyHerb', { cost: HERB_COST }) : t('full'), ink(12, RUST, 'italic bold')).setOrigin(0.5);
      if (can) buy.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.buyHerb(kind));
      else buy.setAlpha(0.45);
      this.herbRows!.add(buy);
      if (wanted.includes(kind)) this.herbRows!.add(this.add.text(x, 50, t('nextOrder'), ink(10, MOSS, 'italic bold')).setOrigin(0.5));
    });
  }

  /** The workbench card over the board: one row per lasting upgrade, each with its price, and a way back. */
  private createBench() {
    const size = BOARD.cell * COLS;
    const card = shown(this.add.image(0, 0, 'result-card'));
    const title = this.add.text(0, -92, t('workbench'), ink(24, SEPIA, 'italic bold')).setOrigin(0.5);
    this.benchCoins = this.add.text(0, -68, '', ink(13, BROWN, 'italic')).setOrigin(0.5);
    this.benchRows = this.add.container(0, 0);
    const back = makeButton(this, 0, 86, t('back'), () => (ui('click'), this.closeBench()));
    this.bench = this.add.container(BOARD.x + size / 2, BOARD.y + size / 2, [card, title, this.benchCoins, this.benchRows, back]).setDepth(UI_DEPTH);
  }

  private openBench() {
    if (!this.bench) this.createBench();
    this.result.setVisible(false);
    this.bench!.setVisible(true);
    this.refreshBench();
  }

  private closeBench() {
    this.bench?.setVisible(false);
    this.result.setVisible(true);
  }

  private buy(id: UpgradeId) {
    if (!buyUpgrade(this.state, id)) return ui('refuse');
    ui('coin');
    saveProgress(progressOf(this.state));
    this.refresh();
    this.refreshBench();
  }

  /** One row per upgrade: its name and effect, a pip per level and a button with the next level's price. */
  private refreshBench() {
    if (!this.benchRows || !this.benchCoins) return;
    this.benchRows.removeAll(true);
    const u = this.state.upgrades;
    this.benchCoins.setText(t('coinsToSpend', { n: this.state.coins }));
    UPGRADE_ORDER.forEach((id, i) => {
      const y = -42 + i * 36;
      const level = u[id];
      const top = UPGRADES[id].costs.length;
      const cost = upgradeCost(u, id);
      const pips = Array.from({ length: top }, (_, k) => (k < level ? '●' : '○')).join('');
      this.benchRows!.add(this.add.text(-172, y - 9, `${t(UPGRADES[id].name)}  ${pips}`, ink(14, SEPIA, 'italic bold')).setOrigin(0, 0.5));
      this.benchRows!.add(this.add.text(-172, y + 8, t(UPGRADES[id].what), ink(11, BROWN)).setOrigin(0, 0.5));
      const button = makeButton(this, 118, y, cost === null ? t('bought') : t('buyFor', { cost }), () => this.buy(id)).setScale(0.6);
      if (cost === null || this.state.coins < cost) button.setAlpha(0.45);
      this.benchRows!.add(button);
    });
  }

  private showSold() {
    const s = this.state;
    const o = s.current;
    if (o.exam) {
      const need = o.exam.stars === 3 ? STARS_3 : STARS_2;
      if (!s.passed) {
        playSting(SONG, 'fail');
        this.showResult(t('examFailed'), t('examFailedText', { n: s.moves, stars: o.exam.stars, need }), t('noSeal'), this.examRetry(), s.orderStars);
        return;
      }
      const rank = t(s.seals === EXAMS.length ? 'allSeals' : 'seal', { seals: s.seals, exams: EXAMS.length });
      sfx('stamp');
      playSting(SONG, 'rank');
      this.showResult(t('examPassed'), t('earned', { price: o.price, bonus: s.earned - o.price, n: s.moves }), rank, this.orderChoice(), s.orderStars);
      return;
    }
    const before = rankOf(s.stars - s.orderStars);
    const at = rankOf(s.stars);
    // The crown's last order is a fanfare, a new rank a short one, any other sale a cadence with a chime per star.
    playSting(SONG, o.last ? 'crown' : at > before ? 'rank' : `sold${Math.max(1, Math.min(3, s.orderStars))}`);
    const next = RANKS[at + 1];
    const royalTitle = t('royalTitle');
    const rank = o.last
      ? t('crownedRank', { title: royalTitle, n: s.stars })
      : at > before
        ? t('newRank', { rank: t(RANKS[at].title), potion: t(POTION_NAMES[RANKS[at].recipe!]) })
        : next
          ? t('moreToRank', { n: s.stars, more: next.stars - s.stars, rank: t(next.title) })
          : s.royal
            ? t('royalStars', { n: s.stars, title: royalTitle })
            : t('everyRecipe', { n: s.stars });
    const kept = Object.entries(s.toPantry).map(([k, n]) => t(KIND_COUNTS[k as Kind], { n }));
    const lines = [t('earned', { price: o.price, bonus: s.earned - o.price, n: s.moves })];
    if (s.speedBonus > 0) lines.push(t('speedBonus', { n: s.speedBonus, potion: t(POTION_NAMES[s.served[0]]) }));
    if (kept.length > 0) lines.push(t('keptInPantry', { list: kept.join(', ') }));
    const title = o.last ? t('crownFilled') : o.stages ? t('royalFilled') : o.second ? t('twinFilled') : t('sold', { potion: t(POTION_NAMES[o.potion]) });
    this.showResult(title, lines.join('\n'), rank, this.orderChoice(), s.orderStars);
  }

  /** Shows the result card with one button, or two side by side. */
  private showResult(title: string, text: string, rank: string, choices: Choice[], stars: number) {
    this.resultTitle.setText(title);
    this.resultText.setText(text);
    this.resultRank.setText(rank);
    this.resultStars.forEach((icon, k) => icon.setTexture(k < stars ? 'star-on' : 'star-off'));
    const pair = choices.length > 1;
    this.resultButton.setVisible(!pair);
    if (pair && !this.resultPair) this.createPair();
    this.resultPair?.forEach((b) => b.setVisible(pair));
    if (pair) {
      this.pairActs = choices.map((c) => c.act);
      choices.forEach((c, k) => (this.resultPair![k].list[1] as Phaser.GameObjects.Text).setText(c.label));
    } else {
      this.resultAct = choices[0].act;
      (this.resultButton.list[1] as Phaser.GameObjects.Text).setText(choices[0].label);
    }
    this.refreshLinks();
    this.refreshCaption();
    this.result.setVisible(true);
    if (!settings.reduceMotion) this.tweens.add({ targets: this.result, scale: { from: 0.92, to: 1 }, alpha: { from: 0, to: 1 }, duration: 220 });
  }
}
