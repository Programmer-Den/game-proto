import Phaser from 'phaser';
import { playMusic, playSting, ui } from '../../../../shared/audio';
import { viewFrame, viewSize } from '../../../../shared/scaling';
import { formatNumber } from '../../../../shared/i18n';
import { settings } from '../../../../shared/settings';
import { SFX, SONG } from '../audio';
import { distances, route } from '../game/grid';
import { cellIndex, cellOf, MAPS, SEASON_STARS, SEASONS, type MapDef, type Season } from '../game/maps';
import { loadCalm, loadDuo, loadMode, loadPouch, loadRecords, loadReplays, loadShed, noteRecord, picksOf, pouchOf, saveCalm, saveDuo, saveMode, savePouch, saveReplay, saveShed, usable, type Records, type Replays, type Shed } from '../game/save';
import {
  beamCells, bestFace, build, hedgeUnder, LAWN, openGates, reachOf, cabbagesLeft, canStartWave, masterOpen, seedsFor, stars, totalWaves, newGame, nextUpgrade, goldAt, sideOf, replayGame, replayOf, replayStep, sell, sellValue, setAim, startWave, step, towerAt, turn, upgrade, wouldBlock,
  type Game, type GameEvent, type Refusal, type Replay, type Tower,
} from '../game/sim';
import { DIRS } from '../game/grid';
import { aims, ALWAYS, FREE, harms, MASTER, masterSeeds, SLOT_SEEDS, towerSeeds, COLS, FOE, MODES, ROWS, SANDBOX_GOLD, GATE_WAVES, TOWER, TOWERS, waveGroups, WAVES, type FoeKind, type Mode, type TowerKind, type TrapKind } from '../game/rules';
import { t, type TextKey } from '../i18n';
import * as art from './art';
import { C } from './art';
import { BACK_BUTTON, BAR_H, CARDS, CELL, CHIPS, DEPTH, GRID, PANEL, SPEED_BUTTON, TIP_X, TOOLS, VIEW, WAVE_BUTTON } from './layout';

/** A spot the test can tap, by its centre in view pixels. */
type Spot = { x: number; y: number; w: number; h: number };
type Hit = { x: number; y: number; w: number; h: number; onTap: () => void; enabled: boolean };
/** A gardener's tool: a tower to plant, or a mode where a tap on a tower upgrades or sells it. */
type Tool = TowerKind | ToolMode;
type ToolMode = 'upgrade' | 'sell';
const isMode = (tool: Tool): tool is ToolMode => tool === 'upgrade' || tool === 'sell';

/** The game runs in fixed steps of this many seconds, so it plays the same on every frame rate. */
const STEP = 1 / 60;
/** How long the Sell button waits for its second tap. */
const SELL_CONFIRM_MS = 2000;
/** The longest frame the game catches up on, so a stalled tab doesn't jump. */
const MAX_FRAME = 0.1;
const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';
const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;

/** Something drawn for a moment: a pulse, a boom, a hit, a bolt, a flame, a beam, spores, a coin or a note. */
interface Flash {
  kind: 'pulse' | 'sting' | 'shrink' | 'boom' | 'hit' | 'bolt' | 'flame' | 'beam' | 'puff' | 'coin' | 'note';
  x: number;
  y: number;
  r: number;
  /** A bolt's points; a flame's heading and half-width; a beam's far end. */
  points?: { x: number; y: number }[];
  angle?: number;
  cone?: number;
  x2?: number;
  y2?: number;
  age: number;
  life: number;
  text?: string;
  /** The text drawn for a coin or a note, made once and dropped with the flash. */
  label?: Phaser.GameObjects.Text;
}

/**
 * Mazewright's only scene: the garden picker and a game. It turns taps and keys into the actions
 * of `game/sim.ts`, steps the game in fixed steps, draws the board, the foes and the bars, and
 * drains `game.events` for sound, effects and records.
 */
export class GameScene extends Phaser.Scene {
  screen: 'menu' | 'play' | 'shed' = 'menu';
  state: Game | null = null;
  records!: Records;
  tool: Tool = 'hedge';
  /** The right-hand gardener's tool, with two gardeners. */
  tool2: Tool = 'hedge';
  /** Each gardener's tower tool from before upgrade mode, picked again when it is switched off. */
  private before: TowerKind[] = ['hedge', 'hedge'];
  /** The towers this run can plant, picked under the garden cards: hedge, bow and up to four more. */
  pouch: TowerKind[] = [];
  /** The tower whose panel is open, by its cell. */
  selected = -1;
  speed = 1;
  /** Waves wait to be started (no wave timer). */
  calm = false;
  /** Two gardeners share the screen, each with half the lawn. */
  duo = false;
  /** The way of play picked on the garden picker. */
  mode: Mode = 'classic';
  /** The season whose gardens the picker shows. */
  season: Season = 'spring';
  /** The potting shed, and the seeds the last finished game paid into it. */
  shed!: Shed;
  earned = 0;
  /** Each garden's latest win, and the one being watched (null while playing). */
  replays!: Replays;
  replay: Replay | null = null;
  /** Spots for the test: every button on screen by id, centred, in view pixels. */
  buttons: Record<string, Spot> = {};
  /** The grid's top-left corner and cell size in view pixels, for the test. */
  grid = { x: GRID.x, y: GRID.y, cell: CELL };

  private vw = VIEW.w;
  private vh = VIEW.h;
  private fx = 0;
  private fy = 0;
  private lawnG!: Phaser.GameObjects.Graphics;
  private boardG!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  private hudG!: Phaser.GameObjects.Graphics;
  private texts: Phaser.GameObjects.Text[] = [];
  /** The tower pictures on narrow tool buttons, made with the bars. */
  private icons: Phaser.GameObjects.Graphics[] = [];
  private hits: Hit[] = [];
  private boardDirty = true;
  private hudKey = '';
  private acc = 0;
  private lastTime = 0;
  private hover = -1;
  private painting = false;
  private lastPainted = -1;
  /** The route preview for the hovered cell, made once per cell and board. */
  private preview: { cell: number; version: number; walkers: string; tool: TowerKind; blocks: boolean; face: number; routes: number[][] } | null = null;
  private version = 0;
  private flashes: Flash[] = [];
  /** A Sell tapped once, waiting for the second tap until this time. */
  private sellArmed: { cell: number; until: number } | null = null;
  private banner: { text: string; left: number } | null = null;
  /** Foe kinds already met in this game, to name each new one once. */
  private seen = new Set<FoeKind>();
  /** The last wave's rush of kings has begun, so each king isn't named again. */
  private rushing = false;
  /** A foe has taken a cabbage this game, so the banner telling what to do is not shown again. */
  private grabbed = false;
  /** The season's weather has stopped a tower this game, so its banner is not shown again. */
  private weathered = false;
  /** How far into the watched replay's actions the game has got. */
  private ri = 0;

  constructor() {
    super('Game');
  }

  create() {
    this.records = loadRecords();
    this.calm = loadCalm();
    this.duo = loadDuo();
    this.mode = loadMode();
    this.shed = loadShed(this.records);
    this.pouch = loadPouch(this.shed);
    this.replays = loadReplays();
    this.lawnG = this.add.graphics().setDepth(DEPTH.lawn);
    this.boardG = this.add.graphics().setDepth(DEPTH.board);
    this.fxG = this.add.graphics().setDepth(DEPTH.fx);
    this.hudG = this.add.graphics().setDepth(DEPTH.hud);
    this.fit();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p.worldX, p.worldY));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p.worldX, p.worldY, p.isDown));
    this.input.on('pointerup', () => (this.painting = false));
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    const onResize = () => this.fit();
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  /** Reads the view's size and puts the grid in the middle of its frame. */
  private fit() {
    ({ width: this.vw, height: this.vh } = viewSize(this));
    ({ x: this.fx, y: this.fy } = viewFrame(this));
    this.grid = { x: this.fx + GRID.x, y: this.fy + GRID.y, cell: CELL };
    this.drawLawn();
    this.boardDirty = true;
    this.hudKey = '';
  }

  // -------------------------------------------------------------------------------------------
  // The loop

  update(time: number) {
    const dt = Math.min(MAX_FRAME, this.lastTime ? (time - this.lastTime) / 1000 : 0);
    this.lastTime = time;
    const g = this.state;
    if (g && this.screen === 'play') {
      this.acc += dt * this.speed;
      while (this.acc >= STEP) {
        this.acc -= STEP;
        if (this.replay) this.ri = replayStep(g, this.replay, this.ri);
        step(g, STEP);
        this.drain(g);
      }
      if (this.selected >= 0 && !towerAt(g, this.selected)) this.selected = -1;
    }
    for (const f of this.flashes) f.age += dt;
    for (const f of this.flashes) if (f.age >= f.life) f.label?.destroy();
    this.flashes = this.flashes.filter((f) => f.age < f.life);
    if (this.banner && (this.banner.left -= dt) <= 0) this.banner = null;
    if (this.sellArmed && (time > this.sellArmed.until || this.selected !== this.sellArmed.cell)) {
      this.sellArmed = null;
      this.hudKey = '';
    }
    playMusic(SONG, this.musicPart());
    if (this.boardDirty) this.drawBoard();
    this.drawFx();
    this.drawHud();
  }

  private musicPart() {
    const g = this.state;
    if (!g || this.screen !== 'play' || g.phase !== 'wave') return 'calm';
    return g.foes.some((f) => f.kind === 'queen' || f.king) || g.spawns.some((s) => s.kind === 'queen' || s.king) ? 'boss' : 'battle';
  }

  /** Sound, effects and records for what happened in the last step. */
  private drain(g: Game) {
    for (const e of g.events) this.onEvent(g, e);
    g.events.length = 0;
  }

  private onEvent(g: Game, e: GameEvent) {
    const px = (x: number) => this.grid.x + x * CELL;
    const py = (y: number) => this.grid.y + y * CELL;
    switch (e.type) {
      case 'built':
        SFX(e.kind === 'hedge' || TOWER[e.kind].trap ? 'plant' : 'build');
        this.changed();
        break;
      case 'refused':
        if (e.reason !== 'taken') this.refused(e.cell, e.reason);
        break;
      case 'upgraded':
        SFX('upgrade');
        this.changed();
        break;
      case 'sold':
        SFX('sell');
        this.changed();
        break;
      case 'shot':
        if (e.kind !== 'frost') SFX(e.kind as Exclude<TowerKind, 'hedge' | 'frost' | 'beehive' | 'apple' | 'honey' | 'snare'>);
        break;
      case 'bolt':
        this.flash({ kind: 'bolt', x: 0, y: 0, r: 0, life: 0.25, points: e.points.map((p) => ({ x: px(p.x), y: py(p.y) })) });
        break;
      case 'flame':
        this.flash({ kind: 'flame', x: px(e.x), y: py(e.y), r: e.r * CELL, angle: e.angle, cone: e.cone, life: 0.35 });
        break;
      case 'beam':
        this.flash({ kind: 'beam', x: px(e.x), y: py(e.y), x2: px(e.x2), y2: py(e.y2), r: 0, life: 0.3 });
        break;
      case 'puff':
        this.flash({ kind: 'puff', x: px(e.x), y: py(e.y), r: 9, life: 0.5 });
        break;
      case 'apples': {
        SFX('apples');
        const m = this.mid(e.cell);
        this.flash({ kind: 'coin', x: m.x, y: m.y, r: 0, life: 1.2, text: `+${e.gold}` });
        break;
      }
      case 'pulse':
        SFX('frost');
        this.flash({ kind: 'pulse', x: px(e.x), y: py(e.y), r: e.r * CELL, life: 0.4 });
        break;
      case 'lured':
        SFX('honey');
        break;
      case 'burst':
        SFX('cannon');
        this.flash({ kind: 'boom', x: px(e.x), y: py(e.y), r: e.r * CELL, life: 0.4 });
        break;
      case 'snared':
        SFX('snare');
        this.flash({ kind: 'hit', x: px(e.x), y: py(e.y), r: 12, life: 0.3 });
        break;
      case 'sting':
        this.flash({ kind: 'sting', x: px(e.x), y: py(e.y), r: e.r * CELL, life: 0.35 });
        break;
      case 'shrink':
        this.flash({ kind: 'shrink', x: px(e.x), y: py(e.y), r: 18, life: 0.45 });
        break;
      case 'boom':
        this.flash({ kind: 'boom', x: px(e.x), y: py(e.y), r: (e.r + 0.3) * CELL, life: 0.35 });
        break;
      case 'hit':
        this.flash({ kind: 'hit', x: px(e.x), y: py(e.y), r: 6, life: 0.15 });
        break;
      case 'kill':
        SFX('pop');
        this.flash({ kind: 'coin', x: px(e.x), y: py(e.y), r: 0, life: 0.8, text: `+${e.gold}` });
        break;
      case 'grab':
        SFX('leak');
        if (!this.grabbed) this.say(t('grabbed'));
        this.grabbed = true;
        break;
      case 'leak':
        SFX('lost');
        break;
      case 'drop':
        this.flash({ kind: 'hit', x: px(e.x), y: py(e.y), r: 10, life: 0.3 });
        break;
      case 'saved':
        SFX('saved');
        break;
      case 'chewing':
        SFX('chew');
        this.say(t('chewing'));
        this.changed();
        break;
      case 'chewed':
        SFX('chew');
        this.changed();
        break;
      case 'king':
        if (!this.rushing) this.say(t('kingComing', { name: t(`foe_${e.kind}` as TextKey) }));
        break;
      case 'rush':
        this.rushing = true;
        this.say(t('rush'));
        break;
      case 'split':
        this.flash({ kind: 'hit', x: px(e.x), y: py(e.y), r: 10, life: 0.25 });
        break;
      case 'egg':
        this.flash({ kind: 'hit', x: px(e.x), y: py(e.y), r: 8, life: 0.3 });
        break;
      case 'shell':
        this.say(t('empressShell', { shell: t(`shell_${e.shell}` as TextKey) }));
        break;
      case 'wilt':
      case 'frozen':
        SFX(e.type === 'wilt' ? 'wilt' : 'freeze');
        // Told once a game: what the weather did, and what keeps it off.
        if (!this.weathered) this.say(t(e.type === 'wilt' ? 'wiltFirst' : 'frostFirst'));
        this.weathered = true;
        break;
      case 'wave': {
        SFX('horn');
        const kinds = waveGroups(e.wave).map(([k]) => k);
        const fresh = kinds.find((k) => !this.seen.has(k));
        for (const k of kinds) this.seen.add(k);
        if (fresh) this.say(t(`new_${fresh}` as TextKey));
        const opens = GATE_WAVES.indexOf(e.wave) > 0 && GATE_WAVES.indexOf(e.wave) < g.gates.length;
        if (!fresh && opens) this.say(e.wave === GATE_WAVES[1] ? t('secondBurrow') : t('burrowOpens'));
        else if (!fresh) this.say(t('waveBanner', { n: e.wave }));
        if (opens) this.changed();
        break;
      }
      case 'cleared':
        SFX('cleared');
        if (g.phase !== 'won') this.say(t('cleared', { n: e.wave, gold: e.gold }));
        this.note(g, e.wave);
        break;
      case 'won':
        playSting(SONG, 'win');
        if (g.mode !== 'sandbox' && !this.replay) {
          noteRecord(this.records, g.map.id, { wave: g.wave, won: true, stars: stars(g), time: Math.round(g.clock) });
          saveReplay(this.replays, replayOf(g));
        }
        this.earn(g);
        break;
      case 'lost':
        playSting(SONG, 'lose');
        this.note(g, g.wave - 1);
        this.earn(g);
        break;
    }
  }

  /** Notes `waves` held in the garden's records: as its best wave, or its Endless best. Sandbox keeps none. */
  private note(g: Game, waves: number) {
    if (g.mode === 'sandbox' || this.replay) return;
    noteRecord(this.records, g.map.id, g.mode === 'endless' ? { endless: waves } : { wave: waves });
  }

  /** Pays a finished game's seeds into the potting shed. */
  private earn(g: Game) {
    if (this.replay) return;
    this.earned = seedsFor(g);
    if (!this.earned) return;
    this.shed.seeds += this.earned;
    saveShed(this.shed);
  }

  /** Buys from the potting shed, if the seeds are there. */
  private buy(price: number, apply: () => void) {
    if (this.shed.seeds < price) return ui('refuse');
    this.shed.seeds -= price;
    apply();
    saveShed(this.shed);
    ui('coin');
  }

  private changed() {
    this.version++;
    this.boardDirty = true;
  }

  private flash(f: Omit<Flash, 'age'>) {
    this.flashes.push({ ...f, age: 0 });
  }

  private clearFlashes() {
    for (const f of this.flashes) f.label?.destroy();
    this.flashes = [];
  }

  private say(text: string) {
    this.banner = { text, left: 3 };
  }

  private refused(cell: number, reason: Exclude<Refusal, 'taken'>) {
    ui('refuse');
    const [x, y] = cellOf(cell);
    for (const f of this.flashes) if (f.kind === 'note') f.label?.destroy();
    this.flashes = this.flashes.filter((f) => f.kind !== 'note');
    this.flash({ kind: 'note', x: this.grid.x + (x + 0.5) * CELL, y: this.grid.y + (y + 0.5) * CELL, r: 0, life: 1.8, text: t(`refuse_${reason}`) });
  }

  // -------------------------------------------------------------------------------------------
  // Input

  private onDown(x: number, y: number) {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const h = this.hits[i];
      if (x < h.x || y < h.y || x >= h.x + h.w || y >= h.y + h.h) continue;
      if (h.enabled) {
        ui('click');
        h.onTap();
      } else ui('refuse');
      this.hudKey = '';
      return;
    }
    const g = this.state;
    // A replay plays itself: the board takes no taps.
    if (!g || this.screen !== 'play' || g.phase === 'won' || g.phase === 'lost' || this.replay) return;
    const cell = this.cellAt(x, y);
    if (cell < 0) {
      this.selected = -1;
      return;
    }
    const tool = this.toolAt(cell);
    // Upgrade and sell mode upgrade or sell the tower tapped (and each one dragged over); a tower tool plants over a hedge.
    if (isMode(tool) || (towerAt(g, cell) && hedgeUnder(g, cell, tool))) {
      this.selected = -1;
      this.painting = true;
      this.lastPainted = cell;
      this.place(cell, true);
      return;
    }
    if (towerAt(g, cell)) {
      this.selected = this.selected === cell ? -1 : cell;
      this.hudKey = '';
      return;
    }
    if (this.selected >= 0) {
      this.selected = -1;
      this.hudKey = '';
      return;
    }
    this.painting = true;
    this.lastPainted = cell;
    this.place(cell);
  }

  private onMove(x: number, y: number, down: boolean) {
    const cell = this.cellAt(x, y);
    this.hover = cell;
    const g = this.state;
    if (!this.painting || !down || !g || this.replay || cell < 0 || cell === this.lastPainted) return;
    this.lastPainted = cell;
    const tool = this.toolAt(cell);
    if (isMode(tool) ? towerAt(g, cell) : !g.blocked[cell] || g.blocked[cell] === LAWN || hedgeUnder(g, cell, tool)) this.place(cell);
  }

  /** Plants the tool's tower on `cell`, or upgrades or sells the tower there in those modes (a tap that can't buzzes). */
  private place(cell: number, tapped = false) {
    const g = this.state!;
    const tool = this.toolAt(cell);
    if (!isMode(tool)) build(g, cell, tool);
    else if (!(tool === 'upgrade' ? upgrade(g, cell) : sell(g, cell)) && tapped) ui('refuse');
    this.drain(g);
  }

  private onKey(e: KeyboardEvent) {
    if (this.screen !== 'play' || !this.state) return;
    const n = Number(e.key);
    if (e.key.toLowerCase() === 'f') this.faster();
    else if (this.replay) return;
    else if (n >= 1 && n <= this.pouch.length) this.pickTool(this.pouch[n - 1]);
    else if (e.key.toLowerCase() === 'u') this.pickTool('upgrade');
    else if (e.key.toLowerCase() === 's') this.pickTool('sell');
    else if (e.key === ' ') this.sendWave();
    else if (e.key === 'Escape') this.selected = -1;
    else return;
    e.preventDefault();
    this.hudKey = '';
  }

  /** Speeds up: 1x and 2x in play, up to 4x while watching a replay. */
  private faster() {
    const most = this.replay ? 4 : 2;
    this.speed = this.speed >= most ? 1 : this.speed * 2;
  }

  /** Picks a gardener's tool; picking a mode while it is on goes back to the tower from before. */
  private pickTool(kind: Tool, side = 0) {
    const now = side ? this.tool2 : this.tool;
    if (isMode(kind) && now === kind) kind = this.before[side];
    else if (!isMode(now)) this.before[side] = now;
    if (side) this.tool2 = kind;
    else this.tool = kind;
    this.selected = -1;
  }

  /** The tool of the gardener whose half `cell` is on. */
  private toolAt(cell: number) {
    return this.state && sideOf(this.state, cell) ? this.tool2 : this.tool;
  }

  private sendWave() {
    const g = this.state;
    if (!g || !canStartWave(g)) return ui('refuse');
    startWave(g);
    this.drain(g);
  }

  /** The cell under a point in view pixels, or -1 off the grid. */
  private cellAt(x: number, y: number) {
    const cx = Math.floor((x - this.grid.x) / CELL);
    const cy = Math.floor((y - this.grid.y) / CELL);
    return cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS ? -1 : cy * COLS + cx;
  }

  /** Puts a tower into the pouch or takes it out; hedge and bow always stay. */
  private togglePouch(kind: TowerKind) {
    const picked = this.pouch.includes(kind);
    this.pouch = pouchOf(picked ? this.pouch.filter((k) => k !== kind) : [...this.pouch, kind], this.shed);
    savePouch(this.pouch);
  }

  /** Starts a game in `map`, or watches `replay` (at 2x). */
  private start(map: MapDef, replay: Replay | null = null) {
    this.state = replay ? replayGame(replay) : newGame(map.id, this.calm, this.mode, this.shed.masters, undefined, this.duo);
    this.replay = replay;
    this.ri = 0;
    this.earned = 0;
    this.screen = 'play';
    this.tool = 'hedge';
    this.tool2 = 'hedge';
    this.before = ['hedge', 'hedge'];
    this.selected = -1;
    this.speed = replay ? 2 : 1;
    this.acc = 0;
    this.clearFlashes();
    this.seen.clear();
    this.rushing = false;
    this.grabbed = false;
    this.weathered = false;
    this.banner = null;
    if (this.state.duo && !replay) this.say(t('duoStart'));
    this.changed();
    this.drawLawn();
  }

  private toMenu() {
    this.screen = 'menu';
    this.state = null;
    this.replay = null;
    this.clearFlashes();
    this.banner = null;
    this.changed();
    this.drawLawn();
  }

  // -------------------------------------------------------------------------------------------
  // Drawing

  private mid(cell: number) {
    const [x, y] = cellOf(cell);
    return { x: this.grid.x + (x + 0.5) * CELL, y: this.grid.y + (y + 0.5) * CELL };
  }

  private drawLawn() {
    const g = this.lawnG.clear();
    const map = this.screen === 'play' ? this.state?.map : undefined;
    g.fillStyle(map ? art.SEASON_LAWN[map.season].lawn : C.lawn, 1);
    g.fillRect(0, 0, this.vw, this.vh);
    if (map) {
      art.lawn(g, this.grid.x, this.grid.y, GRID.w, GRID.h, COLS, ROWS, CELL, map.season);
      art.flowers(g, this.grid.x + 6, this.grid.y + 6, GRID.w - 12, GRID.h - 12);
      // The garden's ground: its gravel path, water and raised banks.
      const corner = (c: [number, number]) => ({ x: this.grid.x + c[0] * CELL, y: this.grid.y + c[1] * CELL });
      if (map.path) for (const c of new Set([...map.path, map.goal, ...map.gates].map(cellIndex))) {
        const p = corner(cellOf(c));
        art.gravel(g, p.x, p.y, CELL);
      }
      for (const c of map.ponds ?? []) {
        const p = corner(c);
        art.pond(g, p.x, p.y, CELL, map.season === 'winter');
      }
      for (const c of map.banks ?? []) {
        const p = corner(c);
        art.bank(g, p.x, p.y, CELL);
      }
      // Two gardeners: a dashed line down the middle between their halves.
      if (this.state?.duo) {
        g.fillStyle(0xffffff, 0.45);
        for (let y = 4; y < GRID.h; y += 14) g.fillRect(this.grid.x + (COLS / 2) * CELL - 1.5, this.grid.y + y, 3, 7);
      }
    } else art.flowers(g, 8, 8, this.vw - 16, this.vh - 16);
  }

  /** Rocks, hedges, towers, burrows and the cottage: redrawn when the board changes. */
  private drawBoard() {
    this.boardDirty = false;
    const g = this.boardG.clear();
    const s = this.state;
    if (!s || this.screen !== 'play') return;
    for (const rock of s.map.rocks) {
      const m = this.mid(rock[1] * COLS + rock[0]);
      art.rock(g, m.x, m.y);
    }
    s.gates.forEach((cell, i) => {
      const m = this.mid(cell);
      art.burrow(g, m.x, m.y, i < openGates(s));
    });
    const goal = this.mid(s.goal);
    art.cottage(g, goal.x, goal.y);
  }

  /** Everything that moves, every frame: towers (they turn), routes, foes, shots and effects. */
  private drawFx() {
    const g = this.fxG.clear();
    const s = this.state;
    if (!s || this.screen !== 'play') return;
    const chewing = new Map<number, number>();
    for (const f of s.foes) if (f.chew) chewing.set(f.chew.cell, 1 - f.chew.left / 3);
    // Routes first, under everything.
    const pv = this.previewFor(s);
    const routes = pv && !pv.blocks ? pv.routes : s.gates.map((gate) => route(s.dist, gate));
    routes.forEach((cells, i) => {
      const live = i === 0 || s.wave >= GATE_WAVES[i] - 1;
      art.dotted(g, cells.map((c) => this.mid(c)), C.route, live ? 0.85 : 0.4);
    });
    // The moths' straight line, once moths have been met.
    if (this.seen.has('moth')) s.gates.forEach((gate) => art.dotted(g, [this.mid(gate), this.mid(s.goal)], C.moth, 0.45, 1.6, 8));
    for (const trap of s.traps) {
      const m = this.mid(trap.cell);
      art.trap(g, trap.kind, m.x, m.y, 1, trap.sprung);
      if (trap.sprung) art.dashedCircle(g, m.x, m.y, TOWER.honey.range * CELL, 0xffd24a, 0.8);
    }
    for (const tw of s.towers) {
      const m = this.mid(tw.cell);
      if (chewing.has(tw.cell)) art.chewedHedge(g, m.x, m.y, chewing.get(tw.cell)!);
      else if (tw.grow > 0) {
        // Still growing: faint, with a ring that fills as it grows.
        art.tower(g, tw.kind, m.x, m.y, tw.level, tw.aim, 0.5);
        g.lineStyle(3, C.gold, 1);
        g.beginPath();
        g.arc(m.x, m.y, 17, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - tw.grow / tw.growFull));
        g.strokePath();
      } else art.tower(g, tw.kind, m.x, m.y, tw.level, tw.aim);
      if (s.clock < tw.wiltUntil) art.wilted(g, m.x, m.y);
      else if (s.clock < tw.frozenUntil) art.frozen(g, m.x, m.y);
      // In upgrade mode a gold mark shows each tower its gardener can upgrade now; in sell mode a cream one points down on every tower.
      const mode = this.replay ? null : this.toolAt(tw.cell);
      const cost = mode === 'upgrade' ? nextUpgrade(tw, s) : null;
      if (cost !== null && goldAt(s, tw.cell) >= cost) {
        g.fillStyle(C.gold, 1);
        g.fillTriangle(m.x + 9, m.y - 9, m.x + 17, m.y - 9, m.x + 13, m.y - 17);
      } else if (mode === 'sell') {
        g.fillStyle(C.cream, 1);
        g.fillTriangle(m.x + 9, m.y - 17, m.x + 17, m.y - 17, m.x + 13, m.y - 9);
      }
    }
    // The hovered tile: a ghost of the tool, its reach, or the no-entry ring.
    if (pv) {
      const m = this.mid(pv.cell);
      if (pv.blocks) art.noEntry(g, m.x, m.y);
      else {
        if (TOWER[pv.tool].trap) art.trap(g, pv.tool as TrapKind, m.x, m.y, 0.5, false);
        else art.tower(g, pv.tool, m.x, m.y, 1, Math.atan2(DIRS[pv.face][1], DIRS[pv.face][0]), 0.45);
        this.drawReach(g, s, pv.tool, pv.cell, pv.face, 0.7, false);
      }
    }
    const picked = this.selected >= 0 ? towerAt(s, this.selected) : undefined;
    if (picked) {
      const m = this.mid(picked.cell);
      g.lineStyle(3, C.gold, 1);
      g.strokeRoundedRect(m.x - 20, m.y - 20, 40, 40, 8);
      this.drawReach(g, s, picked.kind, picked.cell, picked.face, 0.85, true);
    }
    for (const c of s.loose) art.cabbage(g, this.grid.x + c.x * CELL, this.grid.y + c.y * CELL, 7);
    // Ground foes, then moths above them.
    for (const flying of [false, true]) {
      for (const f of s.foes) {
        const def = FOE[f.kind];
        if (!!def.flies !== flying) continue;
        const x = this.grid.x + f.x * CELL;
        const y = this.grid.y + f.y * CELL;
        const r = f.body * CELL;
        art.foe(g, f.kind, x, y, f.angle, r, { chilled: s.clock < f.slowUntil, burning: s.clock < f.burnUntil, poisoned: s.clock < f.poisonUntil, heat: f.heat, king: f.king });
        if (f.carry > 0) art.cabbage(g, x, y, Math.min(r * 0.9, 8));
        if (f.hp < f.maxHp) art.healthBar(g, x, y - r - 9, f.hp / f.maxHp);
      }
    }
    for (const shot of s.shots) {
      const x = this.grid.x + shot.x * CELL;
      const y = this.grid.y + shot.y * CELL;
      if (shot.kind !== 'cannon') {
        const a = Math.atan2(shot.ty - shot.y, shot.tx - shot.x);
        const len = { bow: 7, crossbow: 10, whirligig: 4, swallow: 6 }[shot.kind];
        g.lineStyle(shot.kind === 'crossbow' ? 3 : 2, shot.kind === 'crossbow' ? 0x5a3417 : shot.kind === 'whirligig' ? 0xffe066 : shot.kind === 'swallow' ? 0x3a4a7a : 0xefe3c8, 1);
        g.lineBetween(x - Math.cos(a) * len, y - Math.sin(a) * len, x, y);
      } else {
        g.fillStyle(0x2b2b2b, 1);
        g.fillCircle(x, y, 4.5);
      }
    }
    this.drawFlashes(g);
  }

  /** A tower's reach: a circle, a bonfire's cone, a sunglass's line or a beehive's ring of tiles. */
  private drawReach(g: Phaser.GameObjects.Graphics, s: Game, kind: TowerKind, cell: number, face: number, alpha: number, fill: boolean) {
    const def = TOWER[kind];
    const range = reachOf(s, cell, kind);
    const m = this.mid(cell);
    const light = 0xfff3c4;
    if (kind === 'sunglass') {
      g.fillStyle(light, fill ? 0.22 : 0.16);
      for (const c of beamCells(s, cell, face)) {
        const b = this.mid(c);
        g.fillRect(b.x - CELL / 2 + 4, b.y - CELL / 2 + 4, CELL - 8, CELL - 8);
      }
    } else if (kind === 'bonfire') {
      const a = Math.atan2(DIRS[face][1], DIRS[face][0]);
      g.fillStyle(0xffb36b, fill ? 0.25 : 0.16);
      g.slice(m.x, m.y, range * CELL, a - def.cone!, a + def.cone!, false);
      g.fillPath();
      g.lineStyle(2, light, alpha);
      g.slice(m.x, m.y, range * CELL, a - def.cone!, a + def.cone!, false);
      g.strokePath();
    } else if (kind === 'beehive') {
      g.lineStyle(2, C.gold, alpha);
      g.strokeRoundedRect(m.x - CELL * 1.5, m.y - CELL * 1.5, CELL * 3, CELL * 3, 8);
    } else if (def.range) {
      if (fill) {
        g.fillStyle(light, 0.1);
        g.fillCircle(m.x, m.y, range * CELL);
      }
      art.dashedCircle(g, m.x, m.y, range * CELL, light, alpha);
    }
  }

  private drawFlashes(g: Phaser.GameObjects.Graphics) {
    const still = settings.reduceMotion;
    for (const f of this.flashes) {
      const k = f.age / f.life;
      if (f.kind === 'pulse' || f.kind === 'sting') {
        g.lineStyle(3, f.kind === 'pulse' ? C.frost : 0x7fc34a, 0.7 * (1 - k));
        g.strokeCircle(f.x, f.y, still ? f.r : f.r * (0.3 + 0.7 * k));
      } else if (f.kind === 'shrink') {
        g.lineStyle(2.5, 0xd98ad9, 0.8 * (1 - k));
        g.strokeCircle(f.x, f.y, still ? f.r * 0.6 : f.r * (1 - 0.6 * k));
      } else if (f.kind === 'boom') {
        g.fillStyle(0xffd27a, 0.5 * (1 - k));
        g.fillCircle(f.x, f.y, still ? f.r : f.r * (0.5 + 0.5 * k));
      } else if (f.kind === 'bolt') {
        const pts = f.points!;
        for (const [width, colour] of [[4, 0x6fd3ff], [1.6, 0xfffbe0]] as const) {
          g.lineStyle(width, colour, 0.9 * (1 - k));
          for (let i = 1; i < pts.length; i++) g.lineBetween(pts[i - 1].x, pts[i - 1].y, pts[i].x, pts[i].y);
        }
      } else if (f.kind === 'flame') {
        const r = still ? f.r : f.r * (0.5 + 0.5 * k);
        g.fillStyle(0xff8a2a, 0.45 * (1 - k));
        g.slice(f.x, f.y, r, f.angle! - f.cone!, f.angle! + f.cone!, false);
        g.fillPath();
        g.fillStyle(0xffd24a, 0.5 * (1 - k));
        g.slice(f.x, f.y, r * 0.6, f.angle! - f.cone! * 0.6, f.angle! + f.cone! * 0.6, false);
        g.fillPath();
      } else if (f.kind === 'beam') {
        g.lineStyle(6, 0xfff6b0, 0.45 * (1 - k));
        g.lineBetween(f.x, f.y, f.x2!, f.y2!);
        g.lineStyle(2, 0xffffff, 0.9 * (1 - k));
        g.lineBetween(f.x, f.y, f.x2!, f.y2!);
      } else if (f.kind === 'puff') {
        g.fillStyle(0xa6d96a, 0.55 * (1 - k));
        const r = still ? f.r : f.r * (0.6 + 0.6 * k);
        for (const [a, b] of [[-0.5, 0], [0.5, -0.3], [0, 0.5]]) g.fillCircle(f.x + a * r, f.y + b * r, r * 0.6);
      } else if (f.kind === 'hit') {
        g.fillStyle(0xffffff, 0.7 * (1 - k));
        g.fillCircle(f.x, f.y, f.r);
      } else if (f.kind === 'coin') {
        f.label ??= this.add.text(0, 0, f.text!, { fontFamily: FONT, fontSize: '13px', color: css(C.gold), fontStyle: 'bold', stroke: '#3e2a1a', strokeThickness: 3 }).setOrigin(0.5).setDepth(DEPTH.fx);
        f.label.setPosition(f.x, f.y - 14 - (still ? 0 : k * 16)).setAlpha(1 - k * k);
      } else {
        art.noEntry(g, f.x, f.y);
        if (!f.label) {
          const text = this.add.text(0, 0, f.text!, { fontFamily: FONT, fontSize: '14px', color: '#ffe2c2', fontStyle: 'bold', backgroundColor: '#140e08dd', padding: { x: 10, y: 6 } });
          const right = f.x + 30 + text.width < this.grid.x + GRID.w;
          f.label = text.setPosition(right ? f.x + 26 : f.x - 26 - text.width, Math.max(this.grid.y, f.y - text.height / 2)).setDepth(DEPTH.panel);
        }
      }
    }
  }

  /** The route preview for the hovered tile, when it is free and nothing else is picked (and never while watching a replay). */
  private previewFor(s: Game) {
    const cell = this.hover;
    if (cell < 0 || this.replay || this.selected >= 0 || cell === s.goal || s.gates.includes(cell) || s.phase === 'won' || s.phase === 'lost') return null;
    if (s.traps.some((t) => t.cell === cell)) return null;
    // Traps go where foes walk; in a path garden towers go only on the lawn beside the path.
    const tool = this.toolAt(cell);
    if (isMode(tool)) return null;
    const trap = !!TOWER[tool].trap;
    const overHedge = !!hedgeUnder(s, cell, tool);
    if (s.blocked[cell] && !(s.blocked[cell] === LAWN && !trap) && !overHedge) return null;
    if (s.map.path && !s.blocked[cell] && !trap) return null;
    // Whether a tile blocks also hangs on the cells the ground foes and loose cabbages are heading for, so the preview is made again when they move on.
    const walkers = s.foes.map((f) => (f.dead || FOE[f.kind].flies ? '' : f.to)).join() + '|' + s.loose.map((c) => c.to).join();
    if (this.preview?.cell === cell && this.preview.version === this.version && this.preview.walkers === walkers && this.preview.tool === tool) return this.preview;
    // A trap, a tower beside a path or one taking a hedge's place never blocks: the routes stay as they are.
    if (trap || s.blocked[cell] === LAWN || overHedge) {
      this.preview = { cell, version: this.version, walkers, tool, blocks: false, face: 0, routes: s.gates.map((gate) => route(s.dist, gate)) };
      return this.preview;
    }
    const blocks = wouldBlock(s, cell);
    let routes: number[][] = [];
    if (!blocks) {
      const blocked = s.blocked.slice();
      blocked[cell] = 2;
      const dist = distances(blocked, s.goal);
      routes = s.gates.map((gate) => route(dist, gate));
    }
    const face = TOWER[tool].faces ? bestFace(s, cell, tool) : 0;
    this.preview = { cell, version: this.version, walkers, tool, blocks, face, routes };
    return this.preview;
  }

  // -------------------------------------------------------------------------------------------
  // Bars, buttons and panels

  private text(x: number, y: number, s: string, size: number, colour: string, origin = 0, bold = true) {
    const text = this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color: colour, fontStyle: bold ? 'bold' : 'normal' });
    text.setOrigin(origin, 0.5).setDepth(DEPTH.panel);
    this.texts.push(text);
    return text;
  }

  private button(id: string, x: number, y: number, w: number, h: number, label: string, onTap: () => void, opts: { enabled?: boolean; on?: boolean; fill?: number; size?: number; sub?: string } = {}) {
    const enabled = opts.enabled ?? true;
    const g = this.hudG;
    g.fillStyle(opts.fill ?? 0xffffff, opts.fill !== undefined ? (enabled ? 1 : 0.45) : opts.on ? 0.2 : 0.08);
    g.fillRoundedRect(x, y, w, h, 7);
    if (opts.on) {
      g.lineStyle(2, C.gold, 1);
      g.strokeRoundedRect(x, y, w, h, 7);
    }
    const dark = opts.fill !== undefined;
    const colour = dark ? '#2b1d10' : css(C.cream);
    if (opts.sub) {
      this.text(x + w / 2, y + h / 2 - 7, label, opts.size ?? 13, colour, 0.5).setAlpha(enabled ? 1 : 0.6);
      this.text(x + w / 2, y + h / 2 + 8, opts.sub, 11, dark ? '#2b1d10' : css(C.gold), 0.5, false).setAlpha(enabled ? 1 : 0.6);
    } else this.text(x + w / 2, y + h / 2, label, opts.size ?? 14, colour, 0.5).setAlpha(enabled ? 1 : 0.6);
    this.hits.push({ x, y, w, h, onTap, enabled });
    this.buttons[id] = { x: x + w / 2, y: y + h / 2, w, h };
  }

  /** Redraws the bars, buttons, panels and banners when what they show has changed. */
  private drawHud() {
    const s = this.state;
    const key = JSON.stringify([
      this.screen, this.vw, this.vh, this.tool, this.tool2, this.duo, this.pouch, this.selected, this.sellArmed?.cell, this.speed, this.banner?.text, this.shed, this.earned, this.season, this.mode, !!this.replay,
      s && [s.wave, s.phase, s.gold, s.gold2, s.lives, s.spawns.length > 0, s.foes.length > 0, s.gates.map((gate) => s.dist[gate]), s.nextAt === null ? -1 : Math.ceil(s.nextAt - s.clock), this.version, (towerAt(s, this.selected)?.grow ?? 0) > 0], this.calm,
    ]);
    if (key === this.hudKey) return;
    this.hudKey = key;
    for (const t of this.texts) t.destroy();
    this.texts = [];
    for (const i of this.icons) i.destroy();
    this.icons = [];
    this.hits = [];
    this.buttons = {};
    this.hudG.clear();
    if (this.screen === 'shed') return this.drawShed();
    if (this.screen === 'menu' || !s) return this.drawMenu();
    this.drawBars(s);
    const picked = this.selected >= 0 ? towerAt(s, this.selected) : undefined;
    if (picked) this.drawPanel(s, picked);
    if (this.banner) {
      const text = this.text(this.vw / 2, this.grid.y + GRID.h - 22, this.banner.text, 16, css(C.cream), 0.5);
      text.setBackgroundColor('#3e2a1acc').setPadding(14, 7, 14, 7);
    }
    if (s.phase === 'won' || s.phase === 'lost') this.drawOver(s);
  }

  private drawBars(s: Game) {
    const g = this.hudG;
    const { vw, vh } = this;
    g.fillStyle(C.bar, 1);
    g.fillRect(0, 0, vw, BAR_H);
    g.fillRect(0, vh - BAR_H, vw, BAR_H);
    const cy = BAR_H / 2;
    this.text(16, cy, totalWaves(s) === Infinity ? t('waveEndless', { n: s.wave }) : t('wave', { n: s.wave, total: WAVES.length }), 16, css(C.cream));
    this.text(172, cy, `◆ ${s.gold}`, 16, css(C.gold));
    art.cabbage(g, 268, cy, 7);
    this.text(280, cy, `${s.lives}`, 16, css(C.life));
    // The routes in use, and the next one a wave before its burrow opens.
    const live = s.gates.filter((_, i) => i === 0 || s.wave >= GATE_WAVES[i] - 1).map((gate) => s.dist[gate]);
    const [a, b] = live;
    const routes = live.length === 1 ? t('routeOne', { n: a }) : live.length === 2 ? t('routeTwo', { a, b }) : t('routeMany', { n: live.length, s: Math.min(...live) });
    this.text(342, cy, routes, 13, css(C.cream), 0, false);
    const backX = vw - 16 - BACK_BUTTON.w;
    this.button('gardens', backX, (BAR_H - BACK_BUTTON.h) / 2, BACK_BUTTON.w, BACK_BUTTON.h, t('gardens'), () => this.toMenu(), { size: 13 });
    const by = vh - BAR_H + (BAR_H - TOOLS.h) / 2;
    const wx = vw - 16 - WAVE_BUTTON.w;
    // With two gardeners the wave and speed buttons go up into the top bar, by the second gardener's gold.
    const top = s.duo && !this.replay;
    const wave = { x: top ? backX - 12 - WAVE_BUTTON.w : wx, y: top ? (BAR_H - WAVE_BUTTON.h) / 2 : by };
    const speed = () => this.button('speed', wave.x - 8 - SPEED_BUTTON.w, wave.y, SPEED_BUTTON.w, SPEED_BUTTON.h, t('speed', { n: this.speed }), () => this.faster(), { on: this.speed > 1 });
    if (this.replay) {
      // Watching: no tools and no wave button, just what is shown and how fast, and the second gardener's gold.
      this.text(TOOLS.x, vh - BAR_H / 2, t('replayLabel', { stars: starText(this.replay.stars), t: clockText(this.replay.time) }), 15, css(C.gold));
      if (s.duo) this.text(backX - 12, cy, `◆ ${s.gold2}`, 16, css(C.gold), 1);
      return speed();
    }
    if (top) this.text(wave.x - 8 - SPEED_BUTTON.w - 12, cy, `◆ ${s.gold2}`, 16, css(C.gold), 1);
    else {
      // The picked tool's use, in the top bar.
      const tipX = this.fx + TIP_X;
      const tool = this.tool;
      const tip = tool === 'upgrade' ? t('upgradeModeText') : tool === 'sell' ? t('sellModeText') : !harms(tool) ? t(`${tool}Text` as TextKey) : `${t(`kind_${TOWER[tool].hits}` as TextKey)} · ${t(`${tool}Text` as TextKey)}`;
      if (backX - 12 - tipX > 120) this.text(tipX, cy, tip, 12, css(C.cream), 0, false).setWordWrapWidth(backX - 12 - tipX).setLineSpacing(-2);
    }
    if (s.duo) {
      // Each gardener's tools under their half of the lawn, as pictures when they are narrow.
      const room = Math.min(vw / 2 - 8 - TOOLS.x, vw / 2 - 8 - 16);
      const tw = Math.min(TOOLS.w, Math.floor(room / (this.pouch.length + 2)) - TOOLS.gap);
      g.fillStyle(C.cream, 0.3);
      g.fillRect(vw / 2 - 1, vh - BAR_H + 6, 2, BAR_H - 12);
      this.drawTools(s, 0, TOOLS.x, by, tw);
      this.drawTools(s, 1, vw / 2 + 8, by, tw);
    } else {
      // The tools and the upgrade and sell buttons share the room up to the speed button: narrower with a fifth or sixth pick.
      const room = wx - 8 - SPEED_BUTTON.w - 8 - TOOLS.x;
      this.drawTools(s, 0, TOOLS.x, by, Math.min(TOOLS.w, Math.floor(room / (this.pouch.length + 2)) - TOOLS.gap));
    }
    const ready = canStartWave(s);
    const label = !ready ? t('incoming') : s.foes.length > 0 ? t('nextEarly', { n: 5 }) : t('startWave', { n: s.wave + 1 });
    const sub = s.nextAt !== null ? t('timer', { n: Math.max(0, Math.ceil(s.nextAt - s.clock)) }) : undefined;
    this.button('wave', wave.x, wave.y, WAVE_BUTTON.w, WAVE_BUTTON.h, label, () => this.sendWave(), { enabled: ready, fill: C.gold, sub, size: sub ? 13 : undefined });
    speed();
  }

  /** A gardener's tool buttons (`tool-<kind>`, or `tool2-<kind>` for the second), `tw` wide from `x`, then the upgrade and sell mode buttons (`tool-upgrade`, `tool-sell`). */
  private drawTools(s: Game, side: number, x0: number, by: number, tw: number) {
    const tool = side ? this.tool2 : this.tool;
    const gold = side ? s.gold2 : s.gold;
    const pictures = tw < 64;
    this.pouch.forEach((kind, i) => {
      const x = x0 + i * (tw + TOOLS.gap);
      this.button(`tool${side ? 2 : ''}-${kind}`, x, by, tw, TOOLS.h, pictures ? '' : t(`${kind}Name` as TextKey), () => this.pickTool(kind, side), {
        on: tool === kind, sub: `◆ ${TOWER[kind].cost}`, enabled: gold >= TOWER[kind].cost || tool === kind, size: tw < 76 ? 10 : 12,
      });
      if (!pictures) return;
      const icon = this.add.graphics().setDepth(DEPTH.panel).setPosition(x + tw / 2, by + TOOLS.h / 2 - 6).setScale(0.48);
      if (TOWER[kind].trap) art.trap(icon, kind as TrapKind, 0, 0, 1, false);
      else art.tower(icon, kind, 0, 0, 1, -Math.PI / 2);
      this.icons.push(icon);
    });
    (['upgrade', 'sell'] as const).forEach((mode, i) => {
      const x = x0 + (this.pouch.length + i) * (tw + TOOLS.gap);
      const mark = mode === 'upgrade' ? '▲' : '▼';
      this.button(`tool${side ? 2 : ''}-${mode}`, x, by, tw, TOOLS.h, pictures ? mark : t(`${mode}Mode`), () => this.pickTool(mode, side), {
        on: tool === mode, sub: pictures ? undefined : mark, size: pictures ? 16 : tw < 76 ? 10 : 12,
      });
    });
  }

  private drawPanel(s: Game, tw: Tower) {
    const g = this.hudG;
    const m = this.mid(tw.cell);
    const faces = TOWER[tw.kind].faces;
    const aimed = aims(tw.kind);
    // From level 3 the panel tells the master level's trick.
    const trick = tw.kind !== 'hedge' && tw.level >= 3;
    const h = PANEL.h + (faces || aimed ? PANEL.row : 0) + (trick ? PANEL.trick : 0);
    const x = Phaser.Math.Clamp(m.x - PANEL.w / 2, 8, this.vw - PANEL.w - 8);
    const above = m.y - 24 - h > BAR_H + 4;
    const y = above ? m.y - 24 - h : m.y + 24;
    g.fillStyle(0x000000, 0.25);
    g.fillRoundedRect(x + 2, y + 3, PANEL.w, h, 9);
    g.fillStyle(C.bar, 0.96);
    g.fillRoundedRect(x, y, PANEL.w, h, 9);
    const name = t(`${tw.kind}Name` as TextKey);
    this.text(x + 12, y + 16, tw.kind === 'hedge' ? name : `${name} · ${tw.level === MASTER ? t('master') : t('level', { n: tw.level })}`, 14, css(C.cream));
    const cost = nextUpgrade(tw, s);
    const shut = tw.level === MASTER - 1 && !masterOpen(s, tw.kind);
    const bw = PANEL.w - 24;
    if (tw.kind !== 'hedge') {
      this.button('upgrade', x + 12, y + 32, bw, 28, shut ? t('masterInShed') : cost === null ? t('topLevel') : t(tw.level === MASTER - 1 ? 'toMaster' : 'upgrade', { n: `◆ ${cost}` }), () => {
        upgrade(s, tw.cell);
        this.drain(s);
      }, { enabled: cost !== null && goldAt(s, tw.cell) >= cost, fill: C.gold, size: 13 });
    } else this.text(x + 12, y + 46, t('hedgeText'), 12, css(C.cream), 0, false);
    // Selling takes a second tap within a couple of seconds.
    const armed = this.sellArmed?.cell === tw.cell;
    this.button('sell', x + 12, y + 64, bw, 28, t(armed ? 'sellSure' : 'sell', { n: `◆ ${sellValue(tw)}` }), () => {
      if (!armed) {
        this.sellArmed = { cell: tw.cell, until: this.lastTime + SELL_CONFIRM_MS };
        return;
      }
      this.sellArmed = null;
      sell(s, tw.cell);
      this.drain(s);
      this.selected = -1;
    }, { size: 13, on: armed });
    if (faces) this.button('turn', x + 12, y + 96, bw, 28, t('turn'), () => {
      turn(s, tw.cell);
      this.changed();
    }, { size: 13 });
    if (aimed) this.button('aim', x + 12, y + 96, bw, 28, t('aim', { how: t(`aim_${tw.target}` as TextKey) }), () => {
      setAim(s, tw.cell);
      this.changed();
    }, { size: 13 });
    if (trick) {
      const ty = y + h - PANEL.trick / 2 - 4;
      this.text(x + 12, ty, t(`${tw.kind}Master` as TextKey), 11, css(tw.level === MASTER ? C.gold : C.cream), 0, false).setWordWrapWidth(bw).setLineSpacing(-2);
    }
  }

  private drawOver(s: Game) {
    const g = this.hudG;
    g.fillStyle(0x1e140b, 0.55);
    g.fillRect(0, 0, this.vw, this.vh);
    const w = 440;
    const h = 200;
    const x = (this.vw - w) / 2;
    const y = (this.vh - h) / 2;
    g.fillStyle(C.bar, 1);
    g.fillRoundedRect(x, y, w, h, 14);
    const won = s.phase === 'won';
    this.text(this.vw / 2, y + 44, t(won ? 'won' : 'lost'), 26, css(won ? C.gold : C.cream), 0.5);
    const over = won ? t('wonText', { n: cabbagesLeft(s) }) : totalWaves(s) === Infinity ? t('endlessOver', { n: s.wave - 1 }) : t('lostText', { n: s.wave });
    this.text(this.vw / 2, y + 80, over, 15, css(C.cream), 0.5, false);
    const reward = this.earned ? t('seedsEarned', { n: this.earned }) : '';
    const replay = this.replay;
    if (replay) {
      // The end of a replay: watch it again, or back to the gardens.
      this.text(this.vw / 2, y + 104, [starText(stars(s)), t('time', { t: clockText(s.clock) })].join(' · '), 15, css(C.gold), 0.5);
      this.button('again', x + 40, y + 128, 170, 40, t('watchAgain'), () => this.start(s.map, replay), { fill: C.gold });
      this.button('gardens', x + w - 210, y + 128, 170, 40, t('gardens'), () => this.toMenu());
      return;
    }
    if (won) this.text(this.vw / 2, y + 104, [starText(stars(s)), t('time', { t: clockText(s.clock) }), reward].filter(Boolean).join(' · '), 15, css(C.gold), 0.5);
    else if (reward) this.text(this.vw / 2, y + 104, reward, 15, css(C.gold), 0.5);
    this.button('again', x + 40, y + 128, 170, 40, t('again'), () => this.start(s.map), { fill: C.gold });
    this.button('gardens', x + w - 210, y + 128, 170, 40, t('gardens'), () => this.toMenu());
  }

  private drawMenu() {
    const g = this.hudG;
    const { fx, fy } = this;
    this.text(this.vw / 2, fy + 62, t('title'), 44, css(C.cream), 0.5).setStroke('#2e6b2b', 8);
    this.text(this.vw / 2, fy + 112, t('tagline'), 16, '#2d3b1f', 0.5);
    // The four seasons, each opened by the stars won across all gardens.
    const won = Object.values(this.records).reduce((n, r) => n + r.stars, 0);
    const tw = 140;
    SEASONS.forEach((season, i) => {
      const need = SEASON_STARS[season];
      const x = this.vw / 2 - (SEASONS.length * (tw + 8) - 8) / 2 + i * (tw + 8);
      g.fillStyle(C.bar, 1);
      g.fillRoundedRect(x, fy + 132, tw, 30, 7);
      const label = won >= need ? t(`season_${season}` as TextKey) : `${t(`season_${season}` as TextKey)} · ★ ${need}`;
      this.button(`season-${season}`, x, fy + 132, tw, 30, label, () => (this.season = season), { on: this.season === season, size: 13 });
    });
    const locked = won < SEASON_STARS[this.season];
    MAPS.filter((map) => map.season === this.season).forEach((map, i) => {
      const cx = fx + CARDS.xs[i];
      const x = cx - CARDS.w / 2;
      const y = fy + CARDS.y - CARDS.h / 2 + 40;
      g.fillStyle(C.shadow, 0.25);
      g.fillRoundedRect(x + 3, y + 5, CARDS.w, CARDS.h, 14);
      g.fillStyle(C.bar, 1);
      g.fillRoundedRect(x, y, CARDS.w, CARDS.h, 14);
      // A small plan of the garden: its path, water, banks, rocks, burrows and cottage.
      const cell = 10;
      const mx = cx - (COLS * cell) / 2;
      const my = y + 16;
      const look = art.SEASON_LAWN[map.season];
      g.fillStyle(look.lawn, 1);
      g.fillRoundedRect(mx - 4, my - 4, COLS * cell + 8, ROWS * cell + 8, 6);
      const square = (cells: [number, number][], colour: number, alpha = 1) => {
        g.fillStyle(colour, alpha);
        for (const [cx2, cy2] of cells) g.fillRect(mx + cx2 * cell, my + cy2 * cell, cell, cell);
      };
      square(map.path ?? [], 0xd9c79f);
      square(map.ponds ?? [], map.season === 'winter' ? 0xd6ecf6 : 0x4f9fd1);
      square(map.banks ?? [], 0xfff3c4, 0.5);
      g.fillStyle(C.rock, 1);
      for (const [rx, ry] of map.rocks) g.fillRoundedRect(mx + rx * cell + 1, my + ry * cell + 1, cell - 2, cell - 2, 2);
      g.fillStyle(C.soil, 1);
      for (const [gx, gy] of map.gates) g.fillCircle(mx + (gx + 0.5) * cell, my + (gy + 0.5) * cell, 5);
      g.fillStyle(0xc2573f, 1);
      g.fillTriangle(mx + map.goal[0] * cell, my + (map.goal[1] + 0.9) * cell, mx + (map.goal[0] + 0.5) * cell, my + map.goal[1] * cell - 2, mx + (map.goal[0] + 1) * cell, my + (map.goal[1] + 0.9) * cell);
      this.text(cx, my + ROWS * cell + 26, t(`${map.id}Name` as TextKey), 20, css(C.cream), 0.5);
      this.text(cx, my + ROWS * cell + 56, t(`${map.id}Text` as TextKey), 13, css(C.cream), 0.5, false).setWordWrapWidth(CARDS.w - 28).setAlign('center');
      const r = this.records[map.id];
      const best =
        this.mode === 'sandbox' ? t('sandboxCard')
        : this.mode === 'endless' ? (r.endless > 0 ? t('bestEndless', { n: r.endless }) : t('notPlayed'))
        : r.won ? `${starText(r.stars)}${r.time ? ` · ${clockText(r.time)}` : ''}`
        : r.wave > 0 ? t('best', { n: r.wave }) : t('notPlayed');
      if (locked) {
        // A season still shut: the card dims and says how many stars open it.
        g.fillStyle(C.bar, 0.6);
        g.fillRoundedRect(x, y, CARDS.w, CARDS.h, 14);
        this.text(cx, y + CARDS.h - 22, t('seasonLocked', { n: SEASON_STARS[this.season], have: won }), 13, css(C.cream), 0.5);
      } else this.text(cx, y + CARDS.h - 22, best, 13, css(C.gold), 0.5);
      this.hits.push({ x, y, w: CARDS.w, h: CARDS.h, onTap: () => (locked ? ui('refuse') : this.start(map)), enabled: true });
      this.buttons[`map-${map.id}`] = { x: cx, y: y + CARDS.h / 2, w: CARDS.w, h: CARDS.h };
      // The garden's latest win, to watch again: on top of the card, so it takes its own tap.
      const replay = this.replays[map.id];
      if (replay && !locked) this.button(`watch-${map.id}`, x + CARDS.w - 74, y + CARDS.h - 36, 64, 26, t('watch'), () => this.start(map, replay), { size: 12 });
    });
    // The way of play, at the top left; Calm or the wave timer, at the top right.
    const mw = 200;
    g.fillStyle(C.bar, 1);
    g.fillRoundedRect(fx + 16, fy + 16, mw, 32, 7);
    this.button('mode', fx + 16, fy + 16, mw, 32, t(`mode_${this.mode}` as TextKey, { n: formatNumber(SANDBOX_GOLD) }), () => {
      this.mode = MODES[(MODES.indexOf(this.mode) + 1) % MODES.length];
      saveMode(this.mode);
    }, { on: this.mode !== 'classic', size: 13 });
    const cw = 168;
    g.fillStyle(C.bar, 1);
    g.fillRoundedRect(fx + VIEW.w - 16 - cw, fy + 16, cw, 32, 7);
    this.button('calm', fx + VIEW.w - 16 - cw, fy + 16, cw, 32, this.calm ? t('calmOn') : t('calmOff'), () => {
      this.calm = !this.calm;
      saveCalm(this.calm);
    }, { on: this.calm, size: 13 });
    // The pouch: hedge and bow always come, and up to four of these.
    const kinds = TOWERS.filter((k) => !ALWAYS.includes(k));
    const picks = this.pouch.length - ALWAYS.length;
    const most = picksOf(this.shed);
    this.text(this.vw / 2, fy + CHIPS.labelY, t('pouch', { n: most, left: most - picks }), 13, '#2d3b1f', 0.5);
    kinds.forEach((kind, i) => {
      const on = this.pouch.includes(kind);
      const row = Math.floor(i / CHIPS.perRow);
      const inRow = Math.min(CHIPS.perRow, kinds.length - row * CHIPS.perRow);
      const rowW = inRow * (CHIPS.w + CHIPS.gap) - CHIPS.gap;
      const x = (this.vw - rowW) / 2 + (i % CHIPS.perRow) * (CHIPS.w + CHIPS.gap);
      const y = fy + CHIPS.y + row * (CHIPS.h + CHIPS.gap);
      // A tower not bought yet shows its price in seeds on a darker chip, and the shed sells it.
      const open = usable(this.shed, kind);
      g.fillStyle(open ? C.bar : C.locked, 1);
      g.fillRoundedRect(x, y, CHIPS.w, CHIPS.h, 7);
      this.button(`pouch-${kind}`, x, y, CHIPS.w, CHIPS.h, t(`${kind}Name` as TextKey), () => (open ? this.togglePouch(kind) : this.toShed()), {
        on, enabled: open ? on || picks < most : true, sub: open ? `◆ ${TOWER[kind].cost}` : t('seedPrice', { n: towerSeeds(kind) }), size: 12,
      });
    });
    // One gardener or two, under the way of play.
    g.fillStyle(C.bar, 1);
    g.fillRoundedRect(fx + 16, fy + 56, mw, 32, 7);
    this.button('duo', fx + 16, fy + 56, mw, 32, this.duo ? t('duoOn') : t('duoOff'), () => {
      this.duo = !this.duo;
      saveDuo(this.duo);
    }, { on: this.duo, size: 13 });
    // The potting shed, under the wave timer.
    const sw = 168;
    g.fillStyle(C.bar, 1);
    g.fillRoundedRect(fx + VIEW.w - 16 - sw, fy + 56, sw, 32, 7);
    this.button('shed', fx + VIEW.w - 16 - sw, fy + 56, sw, 32, t('shedButton', { n: this.shed.seeds }), () => this.toShed(), { size: 13 });
  }

  private toShed() {
    this.screen = 'shed';
    this.hudKey = '';
  }

  /** The potting shed: towers, master levels and pouch slots for seeds. */
  private drawShed() {
    const g = this.hudG;
    const { fx, fy } = this;
    g.fillStyle(0x1e140b, 0.35);
    g.fillRect(0, 0, this.vw, this.vh);
    this.text(this.vw / 2, fy + 40, t('shedTitle'), 30, css(C.cream), 0.5).setStroke('#2e6b2b', 6);
    this.text(this.vw / 2, fy + 76, t('shedSeeds', { n: this.shed.seeds }), 15, css(C.gold), 0.5);
    g.fillStyle(C.bar, 1);
    g.fillRoundedRect(fx + 16, fy + 16, 120, 32, 7);
    this.button('back', fx + 16, fy + 16, 120, 32, t('back'), () => {
      this.screen = 'menu';
      this.hudKey = '';
    }, { size: 13 });
    const kinds = TOWERS.filter((k) => k !== 'hedge');
    const cols = 4;
    const w = 214;
    const h = 88;
    const gap = 6;
    const x0 = (this.vw - (cols * (w + gap) - gap)) / 2;
    kinds.forEach((kind, i) => {
      const x = x0 + (i % cols) * (w + gap);
      const y = fy + 96 + Math.floor(i / cols) * (h + gap);
      g.fillStyle(C.bar, 0.96);
      g.fillRoundedRect(x, y, w, h, 9);
      this.text(x + 12, y + 13, t(`${kind}Name` as TextKey), 13, css(C.cream));
      const owned = usable(this.shed, kind);
      const mastered = this.shed.masters.includes(kind);
      const noMaster = !!TOWER[kind].trap;
      // What the buy brings: the tower's use while it is still to buy, then its master level's trick.
      const info = !owned || noMaster ? `◆ ${TOWER[kind].cost} · ${t(`${kind}Text` as TextKey)}` : t(`${kind}Master` as TextKey);
      this.text(x + 12, y + 32, info, 10, css(mastered || (owned && noMaster) ? C.gold : C.cream), 0, false).setWordWrapWidth(w - 24).setLineSpacing(-3);
      let label: string;
      let price = 0;
      let apply: (() => void) | null = null;
      if (!owned) {
        price = towerSeeds(kind);
        label = t('buyTower', { n: price });
        apply = () => this.shed.owned.push(kind);
      } else if (noMaster) label = FREE.includes(kind) ? t('free') : t('bought');
      else if (!mastered) {
        price = masterSeeds(kind);
        label = t('buyMaster', { n: price });
        apply = () => this.shed.masters.push(kind);
      } else label = t('mastered');
      this.button(`buy-${kind}`, x + 12, y + 52, w - 24, 28, label, () => apply && this.buy(price, apply), {
        enabled: !!apply && this.shed.seeds >= price, fill: apply ? C.gold : undefined, size: 12,
      });
    });
    // The fifth and sixth pouch slots.
    const sy = fy + 96 + Math.ceil(kinds.length / cols) * (h + gap) + 2;
    SLOT_SEEDS.forEach((price, i) => {
      const x = this.vw / 2 - 220 + i * 228;
      const got = this.shed.slots > i;
      const next = this.shed.slots === i;
      g.fillStyle(C.bar, 0.96);
      g.fillRoundedRect(x - 4, sy - 4, 220, 38, 9);
      this.button(`slot-${i + 5}`, x, sy, 212, 30, got ? t('slotBought', { n: i + 5 }) : t('buySlot', { n: i + 5, price }), () => this.buy(price, () => this.shed.slots++), {
        enabled: next && this.shed.seeds >= price, fill: next ? C.gold : undefined, size: 12,
      });
    });
    this.text(this.vw / 2, sy + 42, t('slotInfo'), 11, css(C.cream), 0.5, false);
  }
}

/** Stars as a row of ★, with ☆ for the ones still to win (three, or four once a fourth is won). */
const starText = (n: number) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));

/** Seconds as m:ss. */
const clockText = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
