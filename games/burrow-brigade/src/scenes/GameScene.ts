import Phaser from 'phaser';
import { playMusic, playSting, ui } from '../../../../shared/audio';
import { dailyRand, finishDaily, loadDaily, startDaily, type DailyRecord } from '../../../../shared/daily';
import { viewSize } from '../../../../shared/scaling';
import { settings } from '../../../../shared/settings';
import { award } from '../../../../shared/trophies';
import { aiLog, mountWatch, watching, watchSteps } from '../../../../shared/watch';
import { SFX, SONG } from '../audio';
import { planTurn, type Plan } from '../game/ai';
import { BATTLES, isOpen, starsFor, VETERAN } from '../game/campaign';
import { HATS, type HatId } from '../game/hats';
import { byLevel, CRATE_CHOICES, CRATE_ODDS, difficulty, DIFFICULTY_CHOICES, setDifficulty, TURN_CHOICES, type Options } from '../game/options';
import { boosts, reward, UPGRADE_COSTS, UPGRADE_IDS, type UpgradeId } from '../game/depot';
import {
  aiDraftPick, BLOCKS, BUILD_BLOCKS, DRAFT_ORDER, draftPool, FLAG_REACH, FLAG_WIN, GUNNER_POWER, KIND_IDS, MEDIC_EVERY, SCOUT_AHEAD, TRADE_ICON, TRADE_IDS, tradesFor,
  type BlockKind, type TradeId,
} from '../game/modes';
import { loadCampaign, loadPrefs, loadStats, saveCampaign, savePrefs, saveStats, type Stats } from '../game/save';
import { DT, flight, generate, spawnPoints, Terrain, THEMES, WATER_GAP, WIND_ACC, type Theme } from '../game/terrain';
import { CRATE_WEAPONS, GROUPS, startingAmmo, WEAPON_IDS, WEAPONS, type WeaponId } from '../game/weapons';
import { MAX_HP, World, windFactor, type Mole, type Pop, type Sfx } from '../game/world';
import { t } from '../i18n';
import { trophies } from '../trophies';
import {
  drawBalloon, drawBeam, drawBee, drawBolt, drawCrate, drawFlame, drawKeg, drawMole, drawMound, drawParticle, drawShot, drawWeaponIcon, INK, pts, TEAM_COLORS,
} from './draw';
import { paintSky, TerrainArt } from './terrainArt';

type Spot = { x: number; y: number; w: number; h: number };
type Screen = 'menu' | 'play' | 'over';
/** Before the first turn a quick match may hold a weapon draft (`draft`) and a fort build (`build`). */
type Phase = 'aim' | 'retreat' | 'settle' | 'over' | 'draft' | 'build';

interface Team {
  index: number;
  ai: boolean;
  ammo: Record<WeaponId, number>;
  weapon: WeaponId;
  next: number;
  moles: Mole[];
  /** Moles that have had a turn in this go round the team (each goes once before any goes twice). */
  went: Set<Mole>;
  /** The team's turns so far, for the Medic's Repair Kits. */
  taken: number;
}

/** Seconds to aim and fire in a turn, and to scramble away after. */
const TURN_TIME = 30;
const RETREAT_TIME = 3;
/** From this turn on, the water rises a little every turn. */
const SUDDEN_DEATH_TURN = 24;
/** The Storm Bolt's cloud hangs this low, under the HUD's top bar. */
const BOLT_CLOUD = 96;
/** The left team panel starts right of the corner buttons (full screen and pause). */
const LEFT_PANEL = 104;
/** The daily range: shots you get, straw moles to knock over, and the bonus for each one out. */
const DAILY_SHOTS = 5;
const DAILY_TARGETS = 4;
const DAILY_KO = 25;
/** The daily range's map is this size whatever the screen's shape, so everyone shoots the same range. */
const DAILY_W = 960;
const DAILY_H = 540;
/** How far the widest view (1296x720, `shared/scaling.ts`) reaches past the daily range's map. */
const DAILY_EDGE_X = (1296 - DAILY_W) / 2;
const DAILY_EDGE_Y = (720 - DAILY_H) / 2;
const GAME = 'burrow-brigade';
const FONT = '"Trebuchet MS", "Segoe UI", system-ui, sans-serif';
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const C = {
  panel: 0xfffaf2,
  panelEdge: INK,
  button: 0xf1ebe1,
  buttonHi: 0xffe7b8,
  fire: 0xff7a2f,
  ink: INK,
  dim: 0x6b5a4c,
};

const NAMES = [
  ['Pip', 'Moss', 'Tumble', 'Fern', 'Burl', 'Clover'],
  ['Rusk', 'Hazel', 'Pebble', 'Thistle', 'Dusk', 'Bramble'],
];

export class GameScene extends Phaser.Scene {
  W = 960;
  H = 540;
  screen: Screen = 'menu';
  buttons: Record<string, Spot> = {};
  world!: World;
  terrain!: Terrain;
  theme!: Theme;
  teams: Team[] = [];
  mode: 'ai' | 'duo' | 'watch' | 'daily' = 'ai';
  turn = 0;
  turns = 0;
  active: Mole | null = null;
  phase: Phase = 'aim';
  timer = 0;
  retreat = 0;
  settleT = 0;
  aimAngle = -Math.PI / 4;
  power = 0;
  charging = false;
  /** FIRE is held down, charging an aimed shot. */
  private fireHeld = false;
  dragging = false;
  shots = 0;
  winner: number | null = null;
  arsenalOpen = false;
  /** The campaign battle under way (its place in `BATTLES`), or null outside the campaign. */
  battle: number | null = null;
  /** Playing the campaign's Veteran tier. */
  veteran = false;
  /** Stars won by the battle that just ended, and whether they beat the best so far. */
  private earned = { stars: 0, best: false, acorns: 0 };
  private campaign = loadCampaign();
  private suddenDeath = SUDDEN_DEATH_TURN;
  /** The Quartermaster's upgrades for your side in this match (none outside the campaign). */
  private boost = boosts({});
  /** Damage each mole dealt to enemies this match, for the match report. */
  private dealt = new Map<Mole, number>();
  /** The daily range's winds, one a shot, from today's seed; and the record once it ends. */
  private dailyWinds: number[] = [];
  private daily: DailyRecord | null = null;
  private walkTarget: number | null = null;
  private walkTimer = 0;
  private hold = { left: false, right: false };
  private acc = 0;
  private art: TerrainArt | null = null;
  private g!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private waterG!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private skyG!: Phaser.GameObjects.Graphics;
  private iconG!: Phaser.GameObjects.Graphics;
  private objs: Phaser.GameObjects.GameObject[] = [];
  private uiObjs: Phaser.GameObjects.GameObject[] = [];
  private labels = new Map<Mole, Phaser.GameObjects.Text>();
  private popTexts = new Map<Pop, Phaser.GameObjects.Text>();
  private texts: Record<string, Phaser.GameObjects.Text> = {};
  private clouds: { x: number; y: number; s: number }[] = [];
  private specks: { x: number; y: number; ph: number }[] = [];
  private banner = 0;
  private ai: { stage: 'think' | 'walk' | 'flag' | 'turn' | 'charge' | 'mark' | 'done'; t: number; plan: Plan | null; walked: boolean; from: number } = {
    stage: 'done', t: 0, plan: null, walked: false, from: 0,
  };
  private stats: Stats = loadStats();
  private prefs = loadPrefs();
  private size = this.prefs.size;
  /** This match's weather: clear, rain (flames burn out twice as fast), fog (a short aim preview) or gusts (the wind shifts mid-turn). */
  weather: 'clear' | 'rain' | 'fog' | 'gusts' = 'clear';
  private gustT = 0;
  private fogG!: Phaser.GameObjects.Graphics;
  private hover = { x: 0, y: 0 };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private lostMole = false;
  /** The winds of the next turns, rolled ahead while a Scout can see them. */
  private windAhead: number[] = [];
  /** Flag hill's flag: where it stands, each side's points and who scored last. */
  flag: { x: number; y: number; score: [number, number]; last: number } | null = null;
  /** The weapon draft under way: the pool, each side's picks and the pick it is on. */
  draft: { pool: WeaponId[]; picks: [WeaponId[], WeaponId[]]; step: number; t: number } | null = null;
  private draftObjs: Phaser.GameObjects.GameObject[] = [];
  /** Forts' build phase: blocks the building side has left, and the kind it places. */
  private buildLeft = 0;
  private buildKind: BlockKind = 'stone';
  /** Where the active mole stood when its turn began: it can be swapped for another until it moves. */
  private startX = 0;
  /** The trades being picked on the Trades screen. */
  private tradePick: TradeId[] = [];
  /** The browser's own `Math.random` while the daily range's seeded one stands in for it, else null. */
  private realRandom: (() => number) | null = null;
  /** How far the daily range's fixed map sits from the view's top-left (0 outside the daily). */
  private ox = 0;
  private oy = 0;

  constructor() {
    super('Game');
  }

  create() {
    ({ width: this.W, height: this.H } = viewSize(this));
    this.skyG = this.add.graphics().setDepth(1);
    this.g = this.add.graphics().setDepth(5);
    this.fx = this.add.graphics().setDepth(6);
    this.waterG = this.add.graphics().setDepth(7);
    this.fogG = this.add.graphics().setDepth(7.5);
    setDifficulty(this.prefs.options.difficulty);
    this.hud = this.add.graphics().setDepth(100);
    this.iconG = this.add.graphics().setDepth(165);
    this.keys = this.input.keyboard!.addKeys('LEFT,RIGHT,UP,DOWN,A,D,W,S,SPACE,ENTER,BACKSPACE,TAB,Q,E,ESC') as Record<string, Phaser.Input.Keyboard.Key>;
    this.input.keyboard!.addCapture('TAB,SPACE,UP,DOWN,LEFT,RIGHT');
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => this.onDown(p, over));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', () => this.onUp());
    this.keys.SPACE.on('down', () => this.onSpace(true));
    this.keys.SPACE.on('up', () => this.onSpace(false));
    this.keys.ENTER.on('down', () => this.humanTurn() && this.active && this.world.jump(this.active));
    this.keys.BACKSPACE.on('down', () => this.humanTurn() && this.active && this.world.jump(this.active, true));
    this.keys.TAB.on('down', () => this.cycleWeapon(1));
    this.keys.E.on('down', () => this.cycleWeapon(1));
    this.keys.Q.on('down', () => this.cycleWeapon(-1));
    this.keys.ESC.on('down', () => this.arsenalOpen && this.closeArsenal());
    if (watching) this.startMatch('watch');
    else this.showMenu();
  }

  /** What the playthrough test reads. */
  get state() {
    const a = this.active;
    return {
      screen: this.screen,
      phase: this.phase,
      mode: this.mode,
      turn: this.turn,
      turns: this.turns,
      wind: this.world?.wind ?? 0,
      weapon: this.teams[this.turn]?.weapon ?? null,
      active: a ? { id: a.id, team: a.team, x: a.x, y: a.y, hp: a.hp, alive: a.alive } : null,
      craters: this.world?.craters ?? 0,
      shots: this.shots,
      busy: this.world?.busy() ?? false,
      teams: this.teams.map((tm) => ({ alive: tm.moles.filter((m) => m.alive).length, hp: tm.moles.reduce((s, m) => s + (m.alive ? m.hp : 0), 0) })),
      winner: this.winner,
      arsenal: this.arsenalOpen,
      battle: this.battle,
      stars: this.campaign.stars.slice(),
      veteran: this.veteran,
      vstars: this.campaign.vstars.slice(),
      acorns: this.campaign.acorns,
      dailyScore: this.daily?.score ?? null,
      offset: { x: this.ox, y: this.oy },
      weather: this.weather,
      difficulty: difficulty(),
      hat: this.prefs.hat,
      kind: this.prefs.options.kind,
      flag: this.flag ? { x: this.flag.x, y: this.flag.y, score: this.flag.score.slice() } : null,
      draft: this.draft ? { pool: this.draft.pool.slice(), picks: this.draft.picks.map((p) => p.slice()), step: this.draft.step } : null,
      buildLeft: this.buildLeft,
      trades: this.teams[0]?.moles.map((m) => m.trade ?? null) ?? [],
      windAhead: this.windAhead.slice(),
      ammo: this.teams.map((tm) => ({ ...tm.ammo })),
      view: { w: viewSize(this).width, h: viewSize(this).height },
    };
  }

  // ------------------------------------------------------------ screens

  private clearAll() {
    for (const o of [...this.objs, ...this.uiObjs]) o.destroy();
    this.objs = [];
    this.uiObjs = [];
    for (const l of this.labels.values()) l.destroy();
    this.labels.clear();
    for (const p of this.popTexts.values()) p.destroy();
    this.popTexts.clear();
    this.texts = {};
    this.buttons = {};
    this.arsenalOpen = false;
    this.art?.images.forEach((i) => i.destroy());
    this.art = null;
    this.tweens.killAll();
  }

  private clearUi() {
    for (const o of this.uiObjs) o.destroy();
    this.uiObjs = [];
    this.buttons = {};
    this.texts = {};
  }

  /** Builds a fresh map and world with `size` moles a team (or `[left, right]`), on a set theme or a random one. */
  private buildWorld(size: number | [number, number], themeId?: Theme['id'], hp: [number, number] = [MAX_HP, MAX_HP]) {
    const pick = THEMES[Math.floor(Math.random() * THEMES.length)];
    this.theme = THEMES.find((th) => th.id === themeId) ?? pick;
    this.terrain = generate(Math.ceil(this.W), Math.ceil(this.H));
    const th = this.theme;
    const dirt = [th.dirt, th.dirtDark, th.dirtLight].map((c) => parseInt(c.slice(1), 16));
    this.world = new World(this.terrain, this.H - WATER_GAP, { sound: (n) => this.sfx(n), shake: (p) => this.shake(p) }, dirt);
    // The sky fills the whole view, also round the daily range's smaller map.
    const view = viewSize(this);
    this.objs.push(this.looks(() => paintSky(this, view.width, view.height, th)).setPosition(-this.ox, -this.oy));
    this.art = this.looks(() => new TerrainArt(this, this.terrain, th, 2));
    const spots = spawnPoints(this.terrain, size, this.world.water);
    const names = this.looks(() => NAMES.map((n) => n.slice().sort(() => Math.random() - 0.5)));
    this.teams = [0, 1].map((i) => ({
      index: i, ai: false, ammo: startingAmmo(), weapon: 'rocket' as WeaponId, next: 0, went: new Set<Mole>(), taken: 0,
      moles: spots[i].map((p, k) => this.world.addMole(i, names[i][k], p.x, p.y, hp[i])),
    }));
    this.world.onCollect = (m, c) => this.onCrate(m, c.weapon);
    this.looks(() => {
      this.clouds = Array.from({ length: 6 }, () => ({ x: -this.ox + Math.random() * view.width, y: 30 + Math.random() * this.H * 0.25, s: 0.6 + Math.random() * 0.7 }));
      this.specks = Array.from({ length: 18 }, () => ({ x: -this.ox + Math.random() * view.width, y: Math.random() * this.H * 0.7, ph: Math.random() * 6 }));
    });
    if (th.id === 'ember') this.world.splash = 0xffb04d;
    this.placeKegs(2 + Math.floor(Math.random() * 2));
    for (const m of this.world.moles) {
      const label = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', color: '#ffffff', fontStyle: 'bold', backgroundColor: hex(TEAM_COLORS[m.team]), padding: { x: 3, y: 1 } })
        .setOrigin(0.5, 1).setDepth(8);
      this.labels.set(m, label);
    }
  }

  /**
   * Runs `fn` on the browser's own `Math.random` during the daily range, so the looks of the map
   * (sky, earth, names, clouds), whose draws vary with the screen and the browser, never shift the
   * day's seeded draws for the map, the kegs and the winds. Outside the daily it just runs `fn`.
   */
  private looks<T>(fn: () => T): T {
    if (!this.realRandom) return fn();
    const seeded = Math.random;
    Math.random = this.realRandom;
    try {
      return fn();
    } finally {
      Math.random = seeded;
    }
  }

  /**
   * Sizes the world: the whole view, or for the daily range a fixed DAILY_W by DAILY_H map in the
   * middle of the view (the camera moved to frame it), the same on every screen.
   */
  private fitWorld(daily: boolean) {
    const view = viewSize(this);
    this.W = daily ? DAILY_W : view.width;
    this.H = daily ? DAILY_H : view.height;
    this.ox = (view.width - this.W) / 2;
    this.oy = (view.height - this.H) / 2;
    this.cameras.main.setScroll(-this.ox, -this.oy);
  }

  /** Stands `n` powder kegs on dry ground, clear of every mole and of each other. */
  private placeKegs(n: number) {
    const w = this.world;
    for (let i = 0; i < n; i++)
      for (let tries = 0; tries < 30; tries++) {
        const x = this.W * (0.1 + Math.random() * 0.8);
        const y = this.terrain.groundBelow(x, 0);
        if (y < 40 || y > w.water - 20) continue;
        if (w.moles.some((m) => Math.hypot(m.x - x, m.y - y) < 60) || w.kegs.some((k) => Math.abs(k.x - x) < 50)) continue;
        w.addKeg(x, y);
        break;
      }
  }

  showMenu() {
    this.clearAll();
    this.fitWorld(false);
    this.screen = 'menu';
    this.phase = 'over';
    this.active = null;
    this.winner = null;
    this.battle = null;
    playMusic(SONG, 'calm');
    this.buildWorld(3);
    this.drawMenu();
  }

  private drawMenu() {
    this.clearUi();
    const cx = this.W / 2;
    const top = Math.max(20, this.H / 2 - 230);
    const panel = this.add.rectangle(cx, top + 240, 420, 468, C.panel, 0.94).setStrokeStyle(3, C.panelEdge).setDepth(150);
    this.uiObjs.push(panel);
    this.uiObjs.push(this.add.text(cx, top + 44, t('title'), { fontFamily: FONT, fontSize: '46px', color: hex(C.ink), fontStyle: 'bold' }).setOrigin(0.5).setDepth(151));
    this.uiObjs.push(this.add.text(cx, top + 98, t('tagline'), { fontFamily: FONT, fontSize: '15px', color: hex(C.dim), align: 'center', wordWrap: { width: 380 } }).setOrigin(0.5).setDepth(151));
    this.button('play-ai', cx, top + 158, 300, 46, t('playAi'), () => this.startMatch('ai'), true);
    this.button('campaign', cx, top + 210, 300, 46, t('campaign'), () => this.showCampaign(), true);
    this.button('play-duo', cx - 77, top + 262, 146, 46, t('playDuo'), () => this.startMatch('duo'));
    const today = loadDaily(GAME);
    const d = this.button('daily', cx + 77, top + 262, 146, 46, t('daily'), () => this.startDaily(), !today.played);
    if (today.played) d.txt.setColor(hex(0xa09080));
    // Two steppers side by side: moles a team, and the match kind of quick matches.
    this.button('size-down', cx - 182, top + 310, 34, 36, '◀', () => this.setSize(-1));
    this.button('size-up', cx - 48, top + 310, 34, 36, '▶', () => this.setSize(1));
    this.texts.size = this.add.text(cx - 115, top + 310, t('teamSize', { n: this.size }), { fontFamily: FONT, fontSize: '15px', color: hex(C.ink), fontStyle: 'bold' }).setOrigin(0.5).setDepth(151);
    this.button('kind-left', cx + 48, top + 310, 34, 36, '◀', () => this.setKind(-1));
    this.button('kind-right', cx + 182, top + 310, 34, 36, '▶', () => this.setKind(1));
    this.texts.kind = this.add.text(cx + 115, top + 310, t(`kind_${this.prefs.options.kind}`), { fontFamily: FONT, fontSize: '15px', color: hex(C.ink), fontStyle: 'bold' }).setOrigin(0.5).setDepth(151);
    this.uiObjs.push(this.texts.size, this.texts.kind);
    const used = this.stats.used.length;
    this.uiObjs.push(
      this.add.text(cx, top + 396, t('statsLine', { wins: this.stats.wins, games: this.stats.games, used, all: WEAPON_IDS.length }) + '\n' + (today.score !== null
        ? t('dailyDone', { score: today.score, best: today.best, streak: t('streak', { n: today.streak }) })
        : t('dailyLine', { best: today.best, streak: t('streak', { n: today.streak }) })), {
        fontFamily: FONT, fontSize: '14px', color: hex(C.dim), align: 'center', wordWrap: { width: 380 },
      }).setOrigin(0.5).setDepth(151),
    );
    this.button('options', cx, top + 352, 200, 34, t('options'), () => this.showOptions());
    this.uiObjs.push(this.add.text(cx, top + 442, t('menuHint'), { fontFamily: FONT, fontSize: '13px', color: hex(C.dim), align: 'center', wordWrap: { width: 380 } }).setOrigin(0.5).setDepth(151));
  }

  /** The Options panel: the game's own difficulty, and turn time, crates and weather for quick matches. */
  showOptions() {
    this.clearUi();
    const cx = this.W / 2;
    const cy = this.H / 2;
    const o = this.prefs.options;
    const rows: { key: keyof Options; label: string; value: string; step: (d: number) => void }[] = [
      {
        key: 'difficulty', label: t('optDifficulty'),
        value: o.difficulty === 'hub' ? t('optHub', { level: t(`level_${settings.difficulty}`) }) : t(`level_${o.difficulty}`),
        step: (d) => (o.difficulty = DIFFICULTY_CHOICES[(DIFFICULTY_CHOICES.indexOf(o.difficulty) + d + 4) % 4]),
      },
      {
        key: 'turn', label: t('optTurn'), value: t('seconds', { n: o.turn }),
        step: (d) => (o.turn = TURN_CHOICES[Math.max(0, Math.min(TURN_CHOICES.length - 1, TURN_CHOICES.indexOf(o.turn) + d))]),
      },
      {
        key: 'crates', label: t('optCrates'), value: t(`crates_${o.crates}`),
        step: (d) => (o.crates = CRATE_CHOICES[Math.max(0, Math.min(CRATE_CHOICES.length - 1, CRATE_CHOICES.indexOf(o.crates) + d))]),
      },
      { key: 'weather', label: t('optWeather'), value: o.weather ? t('on') : t('off'), step: () => (o.weather = !o.weather) },
      { key: 'draft', label: t('optDraft'), value: o.draft ? t('on') : t('off'), step: () => (o.draft = !o.draft) },
    ];
    const pw = 520;
    const ph = rows.length * 56 + 150;
    const top = cy - ph / 2;
    this.uiObjs.push(this.add.rectangle(cx, cy, pw, ph, C.panel, 0.96).setStrokeStyle(3, C.panelEdge).setDepth(150));
    this.uiObjs.push(this.add.text(cx, top + 28, t('options'), { fontFamily: FONT, fontSize: '26px', color: hex(C.ink), fontStyle: 'bold' }).setOrigin(0.5).setDepth(151));
    rows.forEach((r, i) => {
      const y = top + 84 + i * 56;
      const change = (d: number) => {
        r.step(d);
        setDifficulty(o.difficulty);
        savePrefs(this.prefs);
        this.showOptions();
      };
      this.uiObjs.push(this.add.text(cx - pw / 2 + 24, y, r.label, { fontFamily: FONT, fontSize: '16px', color: hex(C.ink), fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(151));
      this.button(`opt-${r.key}-left`, cx + 20, y, 38, 34, '◀', () => change(-1));
      this.uiObjs.push(this.add.text(cx + 120, y, r.value, { fontFamily: FONT, fontSize: '15px', color: hex(C.ink) }).setOrigin(0.5).setDepth(151));
      this.button(`opt-${r.key}-right`, cx + 220, y, 38, 34, '▶', () => change(1));
    });
    this.uiObjs.push(this.add.text(cx, top + ph - 70, t('optNote'), { fontFamily: FONT, fontSize: '12px', color: hex(C.dim), align: 'center', wordWrap: { width: pw - 40 } }).setOrigin(0.5).setDepth(151));
    this.button('back', cx, top + ph - 30, 200, 36, t('back'), () => this.drawMenu());
  }

  /** Hats for your moles, opened by the campaign's stars. */
  showHats() {
    this.clearUi();
    const cx = this.W / 2;
    const cy = this.H / 2;
    const total = this.campaign.stars.reduce((a, n) => a + n, 0) + this.campaign.vstars.reduce((a, n) => a + n, 0);
    const choices: (HatId | null)[] = [null, ...HATS.map((h) => h.id)];
    const tw = 112;
    const th = 112;
    const cols = 4;
    const pw = cols * tw + 40;
    const ph = Math.ceil(choices.length / cols) * th + 140;
    const top = cy - ph / 2;
    this.uiObjs.push(this.add.rectangle(cx, cy, pw, ph, C.panel, 0.96).setStrokeStyle(3, C.panelEdge).setDepth(150));
    this.uiObjs.push(
      this.add.text(cx, top + 26, t('hats'), { fontFamily: FONT, fontSize: '26px', color: hex(C.ink), fontStyle: 'bold' }).setOrigin(0.5).setDepth(151),
      this.add.text(cx, top + 54, t('hatsStars', { n: total }), { fontFamily: FONT, fontSize: '14px', color: hex(C.dim) }).setOrigin(0.5).setDepth(151),
    );
    const g = this.add.graphics().setDepth(153);
    this.uiObjs.push(g);
    choices.forEach((id, i) => {
      const x = cx - pw / 2 + 20 + (i % cols) * tw + tw / 2;
      const y = top + 76 + Math.floor(i / cols) * th + th / 2;
      const need = id ? HATS.find((h) => h.id === id)!.stars : 0;
      const open = total >= need;
      const picked = this.prefs.hat === id;
      const tile = this.add.rectangle(x, y, tw - 8, th - 8, picked ? C.buttonHi : C.button, open ? 1 : 0.5).setStrokeStyle(2, picked ? C.fire : 0xc9b8a3).setDepth(151);
      this.uiObjs.push(tile, this.add.text(x, y + 38, open ? t(id ? `hat_${id}` : 'hatNone') : `★ ${need}`, { fontFamily: FONT, fontSize: '12px', color: hex(open ? C.ink : 0xa09080), fontStyle: 'bold' }).setOrigin(0.5).setDepth(152));
      drawMole(g, this.fakeMole(x, y + 22, id), { time: 0, aim: null, weapon: null });
      if (!open) g.fillStyle(C.panel, 0.55).fillRect(x - tw / 2 + 4, y - th / 2 + 4, tw - 8, th - 28);
      this.buttons[`hat-${id ?? 'none'}`] = { x, y, w: tw - 8, h: th - 8 };
      tile.setInteractive({ useHandCursor: true });
      tile.on('pointerdown', () => {
        if (!open) return ui('refuse');
        ui('click');
        this.prefs.hat = id;
        savePrefs(this.prefs);
        this.showHats();
      });
    });
    this.button('back', cx, top + ph - 30, 200, 36, t('back'), () => this.showCampaign());
  }

  /** A mole for a picture only (the hat picker), never added to the world. */
  private fakeMole(x: number, y: number, hat: string | null): Mole {
    return {
      id: 0, team: 0, name: '', x, y, vx: 0, vy: 0, hp: MAX_HP, maxHp: MAX_HP, alive: true, grounded: true, facing: 1, walk: 0, walkT: 0,
      hurtT: 0, shield: false, act: null, hat, hidden: false, drowned: false, fallFrom: y, blink: 1,
    };
  }

  private setSize(d: number) {
    this.size = Math.max(2, Math.min(5, this.size + d));
    this.prefs.size = this.size;
    savePrefs(this.prefs);
    this.texts.size?.setText(t('teamSize', { n: this.size }));
  }

  /** The match kind of quick matches: Classic, Forts or Flag hill. */
  private setKind(d: number) {
    const o = this.prefs.options;
    o.kind = KIND_IDS[(KIND_IDS.indexOf(o.kind) + d + KIND_IDS.length) % KIND_IDS.length];
    savePrefs(this.prefs);
    this.texts.kind?.setText(t(`kind_${o.kind}`));
  }

  /** The Trades screen before a campaign battle: a trade for each of your moles, in the order they go. */
  showTrades(i: number) {
    this.clearUi();
    const bt = BATTLES[i];
    const n = bt.mine + boosts(this.campaign.levels).moles;
    if (this.tradePick.length !== n) this.tradePick = tradesFor(this.campaign.trades, n);
    const cx = this.W / 2;
    const cy = this.H / 2;
    const rh = 52;
    const pw = 560;
    const ph = n * rh + 150;
    const top = cy - ph / 2;
    this.uiObjs.push(this.add.rectangle(cx, cy, pw, ph, C.panel, 0.96).setStrokeStyle(3, C.panelEdge).setDepth(150));
    this.uiObjs.push(
      this.add.text(cx, top + 26, t('trades'), { fontFamily: FONT, fontSize: '26px', color: hex(C.ink), fontStyle: 'bold' }).setOrigin(0.5).setDepth(151),
      this.add.text(cx, top + 54, t('tradesHint', { battle: t(`c_${bt.id}`) }), { fontFamily: FONT, fontSize: '13px', color: hex(C.dim) }).setOrigin(0.5).setDepth(151),
    );
    this.tradePick.forEach((id, k) => {
      const y = top + 76 + k * rh + rh / 2;
      const x0 = cx - pw / 2 + 22;
      const step = (d: number) => {
        this.tradePick[k] = TRADE_IDS[(TRADE_IDS.indexOf(id) + d + TRADE_IDS.length) % TRADE_IDS.length];
        this.showTrades(i);
      };
      this.uiObjs.push(
        this.add.text(x0, y, t('tradeSlot', { n: k + 1 }), { fontFamily: FONT, fontSize: '13px', color: hex(C.dim), fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(151),
        this.add.text(x0 + 100, y - 10, `${TRADE_ICON[id]} ${t(`trade_${id}`)}`, { fontFamily: FONT, fontSize: '16px', color: hex(C.ink), fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(151),
        this.add.text(x0 + 100, y + 11, t(`tradeDesc_${id}`), { fontFamily: FONT, fontSize: '12px', color: hex(C.dim) }).setOrigin(0, 0.5).setDepth(151),
      );
      this.button(`trade-${k}-left`, cx + pw / 2 - 86, y, 36, 34, '◀', () => step(-1));
      this.button(`trade-${k}-right`, cx + pw / 2 - 40, y, 36, 34, '▶', () => step(1));
    });
    this.button('back', cx - 110, top + ph - 30, 190, 38, t('back'), () => this.showCampaign());
    this.button('fight', cx + 110, top + ph - 30, 190, 38, t('fight'), () => {
      this.campaign.trades = this.tradePick.slice();
      saveCampaign(this.campaign);
      this.startMatch('ai', i);
    }, true);
  }

  /** The campaign: every battle as a card with its rival, team sizes, twist and best stars. */
  showCampaign() {
    this.clearUi();
    this.screen = 'menu';
    const cx = this.W / 2;
    const cols = 2;
    const cw = 318;
    const ch = 72;
    const rows = Math.ceil(BATTLES.length / cols);
    const pw = cols * (cw + 10) + 30;
    const ph = rows * (ch + 8) + 120;
    const cy = this.H / 2;
    const top = cy - ph / 2;
    this.uiObjs.push(this.add.rectangle(cx, cy, pw, ph, C.panel, 0.96).setStrokeStyle(3, C.panelEdge).setDepth(150));
    const total = this.tierStars().reduce((a, n) => a + n, 0);
    if (!(this.campaign.stars[BATTLES.length - 1] > 0)) this.veteran = false;
    this.uiObjs.push(this.add.text(cx, top + 26, this.veteran ? t('campaignVeteran') : t('campaign'), { fontFamily: FONT, fontSize: '26px', color: hex(this.veteran ? 0x8a3bb0 : C.ink), fontStyle: 'bold' }).setOrigin(0.5).setDepth(151));
    if (this.campaign.stars[BATTLES.length - 1] > 0)
      this.button('tier', cx + pw / 2 - 80, top + 26, 136, 32, this.veteran ? t('tierNormal') : t('tierVeteran'), () => {
        this.veteran = !this.veteran;
        this.showCampaign();
      }, !this.veteran);
    this.uiObjs.push(this.add.text(cx, top + 54, t('campaignStars', { n: total, all: BATTLES.length * 3, acorns: this.campaign.acorns }), { fontFamily: FONT, fontSize: '14px', color: hex(C.dim) }).setOrigin(0.5).setDepth(151));
    const swatch: Record<string, number> = { meadow: 0x59c14a, autumn: 0xd98a2b, frost: 0x9fc0ea, canyon: 0xc9773f, ember: 0xe0501c };
    BATTLES.forEach((bt, i) => {
      const x = cx - pw / 2 + 15 + (i % cols) * (cw + 10) + cw / 2;
      const y = top + 76 + Math.floor(i / cols) * (ch + 8) + ch / 2;
      const open = isOpen(this.tierStars(), i);
      const stars = this.tierStars()[i] ?? 0;
      const card = this.add.rectangle(x, y, cw, ch, open ? C.button : 0xe2dbd0, open ? 1 : 0.7).setStrokeStyle(2, stars ? C.fire : 0xc9b8a3).setDepth(151);
      this.uiObjs.push(card, this.add.rectangle(x - cw / 2 + 5, y, 6, ch - 10, swatch[bt.theme], open ? 1 : 0.4).setDepth(152));
      const ink = hex(open ? C.ink : 0xa09080);
      this.uiObjs.push(
        this.add.text(x - cw / 2 + 16, y - 22, `${i + 1}. ${t(`c_${bt.id}`)}`, { fontFamily: FONT, fontSize: '15px', color: ink, fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(152),
        this.add.text(x - cw / 2 + 16, y, open ? t(`cd_${bt.id}`) : t('locked'), { fontFamily: FONT, fontSize: '12px', color: hex(open ? C.dim : 0xa09080), wordWrap: { width: cw - 30 } }).setOrigin(0, 0.5).setDepth(152),
        this.add.text(x - cw / 2 + 16, y + 22, t('versus', { mine: bt.mine, foes: bt.foes + (this.veteran ? VETERAN.foes : 0) }), { fontFamily: FONT, fontSize: '12px', color: ink, fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(152),
        this.add.text(x + cw / 2 - 10, y + 22, '★'.repeat(stars) + '☆'.repeat(3 - stars), { fontFamily: FONT, fontSize: '16px', color: hex(stars ? 0xf0a020 : 0xb9a994) }).setOrigin(1, 0.5).setDepth(152),
      );
      if (open) {
        card.setInteractive({ useHandCursor: true });
        card.on('pointerover', () => card.setFillStyle(C.buttonHi));
        card.on('pointerout', () => card.setFillStyle(C.button));
        card.on('pointerdown', () => {
          ui('click');
          this.showTrades(i);
        });
      }
      this.buttons[`battle-${i}`] = { x, y, w: cw, h: ch };
    });
    this.button('back', cx - 216, top + ph - 26, 196, 36, t('back'), () => this.drawMenu());
    this.button('hats', cx, top + ph - 26, 196, 36, t('hats'), () => this.showHats(), true);
    this.button('depot', cx + 216, top + ph - 26, 196, 36, t('depot'), () => this.showDepot(), true);
  }

  /** The Quartermaster: a row per upgrade with its level and the price of the next one. */
  showDepot() {
    this.clearUi();
    const cx = this.W / 2;
    const rh = 50;
    const pw = 600;
    const ph = UPGRADE_IDS.length * rh + 130;
    const cy = this.H / 2;
    const top = cy - ph / 2;
    this.uiObjs.push(this.add.rectangle(cx, cy, pw, ph, C.panel, 0.96).setStrokeStyle(3, C.panelEdge).setDepth(150));
    this.uiObjs.push(this.add.text(cx, top + 26, t('depot'), { fontFamily: FONT, fontSize: '26px', color: hex(C.ink), fontStyle: 'bold' }).setOrigin(0.5).setDepth(151));
    this.uiObjs.push(this.add.text(cx, top + 54, t('acorns', { n: this.campaign.acorns }), { fontFamily: FONT, fontSize: '15px', color: hex(0x9a5a1a), fontStyle: 'bold' }).setOrigin(0.5).setDepth(151));
    UPGRADE_IDS.forEach((id, i) => {
      const y = top + 74 + i * rh + rh / 2;
      const x0 = cx - pw / 2 + 20;
      const lv = this.campaign.levels[id] ?? 0;
      const costs = UPGRADE_COSTS[id];
      this.uiObjs.push(
        this.add.text(x0, y - 10, t(`u_${id}`), { fontFamily: FONT, fontSize: '15px', color: hex(C.ink), fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(151),
        this.add.text(x0, y + 10, t(`ud_${id}`), { fontFamily: FONT, fontSize: '12px', color: hex(C.dim) }).setOrigin(0, 0.5).setDepth(151),
        this.add.text(cx + 120, y, '●'.repeat(lv) + '○'.repeat(costs.length - lv), { fontFamily: FONT, fontSize: '14px', color: hex(C.fire) }).setOrigin(0.5).setDepth(151),
      );
      if (lv >= costs.length) {
        this.uiObjs.push(this.add.text(cx + pw / 2 - 70, y, t('maxed'), { fontFamily: FONT, fontSize: '13px', color: hex(C.dim), fontStyle: 'bold' }).setOrigin(0.5).setDepth(151));
        return;
      }
      const cost = costs[lv];
      const btn = this.button(`buy-${id}`, cx + pw / 2 - 70, y, 110, 34, t('buy', { n: cost }), () => this.buy(id), this.campaign.acorns >= cost);
      if (this.campaign.acorns < cost) btn.txt.setColor(hex(0xa09080));
    });
    this.button('back', cx, top + ph - 28, 200, 36, t('back'), () => this.showCampaign());
  }

  private buy(id: UpgradeId) {
    const lv = this.campaign.levels[id] ?? 0;
    const cost = UPGRADE_COSTS[id][lv];
    if (cost === undefined || this.campaign.acorns < cost) {
      ui('refuse');
      return;
    }
    this.campaign.acorns -= cost;
    this.campaign.levels[id] = lv + 1;
    saveCampaign(this.campaign);
    ui('coin');
    this.showDepot();
  }

  /** Today's range: one mole, a few straw moles, five shots, on a map and winds the same for everyone today. */
  startDaily() {
    if (loadDaily(GAME).played) {
      ui('refuse');
      return;
    }
    startDaily(GAME);
    this.startMatch('daily');
  }

  startMatch(mode: 'ai' | 'duo' | 'watch' | 'daily', battle: number | null = null) {
    this.clearAll();
    this.mode = mode;
    this.battle = mode === 'ai' ? battle : null;
    const bt = this.battle === null ? null : BATTLES[this.battle];
    if (!bt) this.veteran = false;
    this.suddenDeath = bt?.suddenDeath ?? SUDDEN_DEATH_TURN;
    this.boost = boosts(bt ? this.campaign.levels : {});
    this.screen = 'play';
    this.winner = null;
    this.turns = 0;
    this.shots = 0;
    this.lostMole = false;
    this.dealt.clear();
    this.daily = null;
    this.active = null;
    this.phase = 'over';
    this.flag = null;
    this.draft = null;
    this.windAhead = [];
    this.buildLeft = 0;
    this.fitWorld(mode === 'daily');
    playMusic(SONG, 'battle');
    if (mode === 'daily') {
      // Today's map, kegs and winds come from the day's seed, on a map of one size for every screen,
      // so every player shoots the same range.
      const rand = dailyRand(GAME);
      const real = Math.random;
      this.realRandom = real;
      Math.random = rand;
      try {
        this.buildWorld([1, DAILY_TARGETS]);
        this.world.edgeX = DAILY_EDGE_X;
        this.world.edgeY = DAILY_EDGE_Y;
        this.dailyWinds = Array.from({ length: DAILY_SHOTS }, () => Math.round((rand() * 2 - 1) * 10));
      } finally {
        Math.random = real;
        this.realRandom = null;
      }
    } else this.buildWorld(bt ? [bt.mine + this.boost.moles, bt.foes + (this.veteran ? VETERAN.foes : 0)] : this.size, bt?.theme, [MAX_HP + this.boost.hp, MAX_HP]);
    if (bt) for (const [id, n] of Object.entries(bt.bonus) as [WeaponId, number][]) this.teams[1].ammo[id] += n + (this.veteran ? VETERAN.ammo : 0);
    if (bt?.boss) {
      // The rival's leader leads in person: the first mole, with a crown and far more health.
      const boss = this.teams[1].moles[0];
      boss.hp = boss.maxHp = Math.round(bt.boss * (this.veteran ? VETERAN.boss : 1));
      boss.hat = 'crown';
      boss.name = t('bossName');
    }
    for (const [id, n] of Object.entries(this.boost.ammo) as [WeaponId, number][]) this.teams[0].ammo[id] += n;
    // Campaign moles carry the trades picked on the Trades screen, in the order they go.
    if (bt) {
      const trades = tradesFor(this.campaign.trades, this.teams[0].moles.length);
      this.teams[0].moles.forEach((m, k) => (m.trade = trades[k]));
    }
    const kind = this.quick() ? this.prefs.options.kind : 'classic';
    if (kind === 'forts') for (const tm of this.teams) this.buildFort(tm);
    if (kind === 'flag') this.plantFlag();
    this.teams[1].ai = mode !== 'duo' && mode !== 'daily';
    // Your moles wear your hat (both sides in two players), never in Watch AI.
    if (mode !== 'watch') for (const tm of mode === 'duo' ? this.teams : [this.teams[0]]) for (const m of tm.moles) if (!m.hat) m.hat = this.prefs.hat;
    const roll = Math.random();
    this.weather = mode === 'daily' || !this.prefs.options.weather ? 'clear' : roll < 0.6 ? 'clear' : roll < 0.75 ? 'rain' : roll < 0.9 ? 'fog' : 'gusts';
    // Gusts would undo a battle's calm or howling wind, so those battles stay clear instead.
    if (this.weather === 'gusts' && bt && bt.wind !== 'normal') this.weather = 'clear';
    this.world.rain = this.weather === 'rain';
    this.gustT = 5;
    this.teams[0].ai = mode === 'watch';
    this.turn = Math.random() < 0.5 && mode === 'watch' ? 1 : 0;
    this.buildHud();
    this.windAhead = [];
    if (mode === 'watch')
      mountWatch({
        title: t('title'),
        sides: { blue: { name: t('teamBlue'), color: hex(TEAM_COLORS[0]) }, amber: { name: t('teamAmber'), color: hex(TEAM_COLORS[1]) } },
        time: () => this.world.time * 1000,
      });
    else if (mode !== 'daily') {
      this.stats.games++;
      saveStats(this.stats);
    }
    if (this.quick() && this.prefs.options.draft) this.startDraft();
    else this.afterDraft();
  }

  // ------------------------------------------------------------ before the first turn

  /** The weapon draft: both sides take turns picking from one pool of weapons that run out. */
  private startDraft() {
    this.draft = { pool: draftPool(), picks: [[], []], step: 0, t: 0.8 };
    this.phase = 'draft';
    this.turn = DRAFT_ORDER[0];
    this.showDraft();
  }

  private showDraft() {
    for (const o of this.draftObjs) o.destroy();
    this.uiObjs = this.uiObjs.filter((o) => !this.draftObjs.includes(o));
    for (const id of WEAPON_IDS) delete this.buttons[`d-${id}`];
    this.draftObjs = [];
    const d = this.draft;
    if (!d) return;
    const cols = 6;
    const tw = 84;
    const th = 78;
    const pw = cols * tw + 24;
    const ph = Math.ceil(d.pool.length / cols) * th + 120;
    const cx = this.W / 2;
    const cy = this.H / 2 - 10;
    const objs: Phaser.GameObjects.GameObject[] = [];
    objs.push(this.add.rectangle(cx, cy, pw, ph, C.panel, 0.97).setStrokeStyle(3, C.panelEdge).setDepth(170).setInteractive());
    const who = this.teams[this.turn];
    const left = DRAFT_ORDER.slice(d.step).filter((x) => x === this.turn).length;
    objs.push(
      this.add.text(cx, cy - ph / 2 + 22, t('draftTitle', { team: this.teamName(this.turn), n: left }), { fontFamily: FONT, fontSize: '18px', color: hex(TEAM_COLORS[this.turn]), fontStyle: 'bold', stroke: hex(INK), strokeThickness: 2 })
        .setOrigin(0.5).setDepth(171),
    );
    const desc = this.add.text(cx - pw / 2 + 16, cy + ph / 2 - 30, who.ai ? t('draftWait') : t('draftHint'), { fontFamily: FONT, fontSize: '13px', color: hex(C.ink), wordWrap: { width: pw - 32 } }).setOrigin(0, 0.5).setDepth(171);
    objs.push(desc);
    const icons = this.add.graphics().setDepth(172);
    objs.push(icons);
    d.pool.forEach((id, i) => {
      const x = cx - pw / 2 + 12 + (i % cols) * tw + tw / 2;
      const y = cy - ph / 2 + 46 + Math.floor(i / cols) * th + th / 2;
      const owner = d.picks[0].includes(id) ? 0 : d.picks[1].includes(id) ? 1 : -1;
      const tile = this.add.rectangle(x, y, tw - 6, th - 6, owner < 0 ? C.button : TEAM_COLORS[owner], owner < 0 ? 1 : 0.35).setStrokeStyle(owner < 0 ? 2 : 3, owner < 0 ? 0xc9b8a3 : TEAM_COLORS[owner]).setDepth(171);
      tile.setInteractive({ useHandCursor: owner < 0 });
      tile.on('pointerover', () => desc.setText(`${t(`w_${id}`)}: ${t(`d_${id}`)}`));
      tile.on('pointerdown', () => this.draftPick(id, false));
      this.buttons[`d-${id}`] = { x, y, w: tw - 6, h: th - 6 };
      objs.push(tile);
      drawWeaponIcon(icons, id, x, y - 12, 1.15, 0);
      objs.push(this.add.text(x, y + 20, t(`w_${id}`), { fontFamily: FONT, fontSize: '10px', color: hex(C.ink), fontStyle: 'bold', align: 'center', wordWrap: { width: tw - 10 } }).setOrigin(0.5).setDepth(173));
    });
    this.draftObjs = objs;
    this.uiObjs.push(...objs);
  }

  /** A pick in the draft: by the side whose pick it is (the AI's own picks come with `ai`). */
  private draftPick(id: WeaponId, ai: boolean) {
    const d = this.draft;
    if (!d || this.phase !== 'draft') return;
    if (this.teams[this.turn].ai !== ai || d.picks.some((p) => p.includes(id))) {
      if (!ai) ui('refuse');
      return;
    }
    if (!ai) ui('click');
    d.picks[this.turn].push(id);
    d.step++;
    d.t = 0.8;
    if (d.step >= DRAFT_ORDER.length || d.step >= d.pool.length) {
      // Each side keeps the weapons that never run out, and only the ones it drafted of the rest.
      this.teams.forEach((tm, i) => {
        for (const w of WEAPON_IDS) if (WEAPONS[w].ammo >= 0) tm.ammo[w] = d.picks[i].includes(w) ? WEAPONS[w].ammo : 0;
      });
      this.draft = null;
      this.showDraft();
      this.afterDraft();
      return;
    }
    this.turn = DRAFT_ORDER[d.step];
    this.showDraft();
  }

  /** After the draft: the forts' build phase, or the first turn. */
  private afterDraft() {
    if (this.quick() && this.prefs.options.kind === 'forts') this.startBuild(0);
    else {
      this.turn = this.mode === 'watch' ? this.turn : 0;
      this.beginTurn();
    }
  }

  /**
   * Forts: each side's starting fort, a stone wall in front of every mole with a wooden plank along
   * its top, low enough to lob over. Blocks are earth to everything that moves, so they break like
   * the hills do.
   */
  private buildFort(tm: Team) {
    const dir = tm.index === 0 ? 1 : -1;
    for (const m of tm.moles) {
      const wx = m.x + dir * 30;
      const ground = this.terrain.groundBelow(wx, m.y - 40);
      if (ground < 0 || ground > this.world.water - 10) continue;
      for (let k = 1; k <= 2; k++) this.placeBlock(wx - 8, ground - k * 16, 16, 16, 'stone');
      this.placeBlock(wx - 16, ground - 39, 32, 7, 'wood');
    }
  }

  /** Puts a block (top-left x, y) where it covers no mole, keg or crate; returns whether it went in. */
  private placeBlock(x: number, y: number, w: number, h: number, kind: BlockKind) {
    if (y < 20 || y + h > this.world.water - 4 || x < 0 || x + w > this.W) return false;
    const hits = (bx: number, by: number, bw: number, bh: number) => bx + bw > x && bx < x + w && by + bh > y && by < y + h;
    if (this.world.moles.some((m) => m.alive && hits(m.x - 10, m.y - 32, 20, 32))) return false;
    if (this.world.kegs.some((k) => !k.gone && hits(k.x - 10, k.y - 20, 20, 20))) return false;
    if (this.world.crates.some((c) => !c.gone && hits(c.x - 12, c.y - 20, 24, 20))) return false;
    this.terrain.addBlock(x, y, w, h, kind);
    return true;
  }

  /** The build phase of Forts: a human side places its blocks; the AI's are placed for it at once. */
  private startBuild(side: number): void {
    if (side > 1) {
      this.buildLeft = 0;
      this.turn = 0;
      this.buildHud();
      return this.beginTurn();
    }
    this.turn = side;
    this.phase = 'build';
    this.buildLeft = BUILD_BLOCKS;
    if (this.teams[side].ai) {
      this.aiBuild(this.teams[side]);
      return this.startBuild(side + 1);
    }
    this.buildKind = 'stone';
    this.buildHud();
    this.banner = 0;
    const e = this.edges();
    const kindBtn = this.button('build-kind', this.W / 2 - 76, e.b - 34, 140, 44, t(`block_${this.buildKind}`), () => {
      this.buildKind = this.buildKind === 'stone' ? 'wood' : 'stone';
      kindBtn.txt.setText(t(`block_${this.buildKind}`));
    });
    this.button('build-done', this.W / 2 + 76, e.b - 34, 140, 44, t('buildDone'), () => this.startBuild(side + 1), true);
    this.refreshHud();
  }

  /** The AI's blocks: stone stacked a little in front of its front mole, two high. */
  private aiBuild(tm: Team) {
    const dir = tm.index === 0 ? 1 : -1;
    const alive = tm.moles.filter((m) => m.alive);
    if (!alive.length) return;
    const front = alive.reduce((a, m) => (m.x * dir > a.x * dir ? m : a));
    for (let i = 0; i < BUILD_BLOCKS; i++) {
      const x = front.x + dir * (58 + Math.floor(i / 2) * 18);
      const top = this.surface(x, front.y - 60);
      if (top > 0) this.placeBlock(x - 8, top - 16, 16, 16, 'stone');
    }
  }

  /** The top of whatever stands at column x, looking down from y (or up out of the earth). */
  private surface(x: number, y: number) {
    let yy = y;
    while (yy > 0 && this.terrain.solid(x, yy)) yy--;
    const g = this.terrain.groundBelow(x, yy);
    return g;
  }

  /** A tap in the build phase: a block on the building side's half, resting on what is below. */
  private placeBuild(x: number, y: number) {
    if (this.buildLeft <= 0) return;
    const half = this.turn === 0 ? x < this.W / 2 - 40 : x > this.W / 2 + 40;
    const size = BLOCKS[this.buildKind];
    const top = this.surface(x, y);
    if (!half || top < 0 || !this.placeBlock(x - size.w / 2, top - size.h, size.w, size.h, this.buildKind)) {
      ui('refuse');
      return;
    }
    SFX('thud');
    this.buildLeft--;
    if (this.buildLeft <= 0) this.startBuild(this.turn + 1);
    else this.refreshHud();
  }

  /** Flag hill: the flag goes on the highest dry ground of the hills near the middle (never a floating ledge). */
  private plantFlag() {
    let best: { x: number; y: number } | null = null;
    const tr = this.terrain;
    for (let x = Math.round(this.W * 0.4); x <= this.W * 0.6; x += 4) {
      // The hills' own top here (from before the caves and ledges), then the ground as it is now.
      let top = 0;
      while (top < tr.h && !(tr.back ?? tr.mask)[top * tr.w + x]) top++;
      const y = tr.groundBelow(x, top - 2);
      if (y > 0 && y < this.world.water - 20 && (!best || y < best.y)) best = { x, y };
    }
    const at = best ?? { x: this.W / 2, y: this.world.water - 20 };
    this.flag = { x: at.x, y: at.y, score: [0, 0], last: -1 };
  }

  /** The flag stays on the ground: it drops into a crater, and moves to dry ground if the water takes it. */
  private settleFlag() {
    const f = this.flag;
    if (!f || this.terrain.solid(f.x, f.y + 1)) return;
    const y = this.terrain.groundBelow(f.x, f.y);
    if (y > 0 && y < this.world.water - 4) f.y = y;
    else {
      const { score, last } = f;
      this.plantFlag();
      this.flag!.score = score;
      this.flag!.last = last;
    }
  }

  /** At the end of a side's turn: a point to it if it has a mole by the flag and the other side has none. */
  private scoreFlag() {
    const f = this.flag;
    if (!f) return;
    const near = this.teams.map((tm) => tm.moles.some((m) => m.alive && Math.abs(m.x - f.x) < FLAG_REACH && Math.abs(m.y - f.y) < 40));
    const side = this.turn;
    if (!near[side] || near[1 - side]) return;
    f.score[side]++;
    f.last = side;
    this.world.pops.push({ x: f.x, y: f.y - 84, text: `⚑ ${f.score[side]}`, color: TEAM_COLORS[side], t: 0 });
    SFX('collect');
    if (this.mode === 'watch') aiLog(side ? 'amber' : 'blue', t('flagPoint', { n: f.score[side] }));
  }

  private beginTurn() {
    const team = this.teams[this.turn];
    const alive = team.moles.filter((m) => m.alive);
    if (!alive.length) return this.finish();
    // A player's side picks its next mole from those that have not gone yet this time round.
    const pick = !team.ai && this.mode !== 'watch';
    if (pick && alive.every((m) => team.went.has(m))) team.went.clear();
    // The next mole in the rotation that is still standing (and, for a player, has not gone yet).
    let m = team.moles[team.next % team.moles.length];
    for (let i = 0; i < team.moles.length * 2 && (!m.alive || (pick && team.went.has(m))); i++) {
      team.next++;
      m = team.moles[team.next % team.moles.length];
    }
    team.next++;
    team.taken++;
    this.world.turnTeam = this.turn;
    this.world.log = World.freshLog();
    this.setActive(m);
    // A Medic hands its team a Repair Kit every few turns.
    const medic = team.moles.find((o) => o.alive && o.trade === 'medic');
    if (medic && team.taken % MEDIC_EVERY === 0) {
      team.ammo.repair = Math.max(0, team.ammo.repair) + 1;
      this.world.pops.push({ x: medic.x, y: medic.y - 50, text: `+1 ${TRADE_ICON.medic}`, color: TEAM_COLORS[team.index], t: 0 });
    }
    // The wind: today's in the daily range, else the next one rolled (some ahead, while a Scout looks out).
    const wind = this.windAhead.length ? this.windAhead.shift()! : this.rollWind();
    this.world.wind = this.mode === 'daily' ? this.dailyWinds[Math.min(this.turns, DAILY_SHOTS - 1)] : wind;
    if (this.mode !== 'daily' && this.teams.some((tm) => tm.moles.some((o) => o.alive && o.trade === 'scout')))
      while (this.windAhead.length < SCOUT_AHEAD) this.windAhead.push(this.rollWind());
    this.phase = 'aim';
    this.timer = (this.quick() ? this.prefs.options.turn : TURN_TIME) + (this.turn === 0 ? this.boost.time : 0);
    if (team.ammo[team.weapon] === 0) team.weapon = 'rocket';
    this.ai = { stage: team.ai ? 'think' : 'done', t: 0.8, plan: null, walked: false, from: 0 };
    this.refreshHud();
  }

  /** A turn's wind: a battle's strong or calm one, or anything from -10 to 10 (calm 15% of the time). */
  private rollWind() {
    const calm = Math.random() < 0.15;
    const kind = this.battle === null ? 'normal' : BATTLES[this.battle].wind;
    if (kind === 'strong') return (Math.random() < 0.5 ? -1 : 1) * Math.round(6 + Math.random() * 4);
    if (kind === 'calm') return Math.round((Math.random() * 2 - 1) * 3);
    return calm ? 0 : Math.round((Math.random() * 2 - 1) * 10);
  }

  /** Hands the turn to mole `m`: its aim, the arrow over it and a Gunner's harder blasts. */
  private setActive(m: Mole) {
    this.active = m;
    this.startX = m.x;
    this.world.gunner = m.trade === 'gunner' ? GUNNER_POWER : 1;
    this.aimAngle = m.facing > 0 ? -Math.PI / 4 : (-3 * Math.PI) / 4;
    this.power = 0;
    this.charging = false;
    this.dragging = false;
    this.walkTarget = null;
    this.banner = 2.2;
  }

  /** Whether the player may swap the active mole for `m`: one of theirs that has not gone yet, before the active one moves. */
  private canSwap(m: Mole) {
    const a = this.active;
    const team = this.teams[this.turn];
    if (!a || !this.humanTurn() || this.phase !== 'aim' || this.mode === 'daily' || m === a || !m.alive || m.team !== this.turn) return false;
    return !team.went.has(m) && !a.act && a.grounded && Math.abs(a.x - this.startX) < 6;
  }

  private finish() {
    this.phase = 'over';
    this.screen = 'over';
    const alive = this.teams.map((tm) => tm.moles.some((m) => m.alive));
    this.winner = alive[0] && !alive[1] ? 0 : alive[1] && !alive[0] ? 1 : -1;
    // Flag hill: the first to the points wins, whoever is left standing.
    if (this.flagWinner() >= 0) this.winner = this.flagWinner();
    if (this.winner >= 0) for (const m of this.teams[this.winner].moles) if (m.alive) m.act = { kind: 'cheer', t: 0, dur: 99 };
    if (this.mode === 'daily') {
      this.daily = finishDaily(GAME, this.dailyScore());
      playSting(SONG, 'win');
      this.showResult();
      return;
    }
    if (this.mode === 'watch') {
      aiLog(this.winner === 1 ? 'amber' : 'blue', this.winner < 0 ? t('draw') : t('wins', { team: this.teamName(this.winner) }));
      this.time.delayedCall(4000, () => this.startMatch('watch'));
      return;
    }
    if (this.mode === 'ai') {
      if (this.winner === 0) {
        this.stats.wins++;
        this.trophy('firstWin');
        if (!this.lostMole) this.trophy('flawless');
        if (difficulty() === 'hard') this.trophy('hardWin');
        if (this.battle !== null) {
          const stars = starsFor(BATTLES[this.battle], this.turns, this.lostMole);
          const tier = this.tierStars();
          const before = tier[this.battle] ?? 0;
          this.earned = { stars, best: stars > before, acorns: 0 };
          while (tier.length <= this.battle) tier.push(0);
          tier[this.battle] = Math.max(before, stars);
          saveCampaign(this.campaign);
        }
        playSting(SONG, 'win');
      } else playSting(SONG, 'lose');
      if (this.battle !== null) {
        const paid = reward(this.winner === 0, this.winner === 0 ? starsFor(BATTLES[this.battle], this.turns, this.lostMole) : 0);
        this.earned.acorns = Math.round(paid * (this.veteran ? VETERAN.acorns : 1));
        this.campaign.acorns += this.earned.acorns;
        saveCampaign(this.campaign);
      }
    } else playSting(SONG, 'win');
    saveStats(this.stats);
    this.showResult();
  }

  /** Flag hill's winner once a side has the points, else -1. */
  private flagWinner() {
    return this.flag ? this.flag.score.findIndex((n) => n >= FLAG_WIN) : -1;
  }

  /** The range's score: the damage done to the straw moles, plus a bonus for each one knocked out. */
  private dailyScore() {
    const straw = this.teams[1]?.moles ?? [];
    return straw.reduce((s, m) => s + (m.maxHp - (m.alive ? m.hp : 0)) + (m.alive ? 0 : DAILY_KO), 0);
  }

  /** The mole that dealt the most damage to enemies this match, if any did. */
  private star() {
    let best: Mole | null = null;
    for (const [m, n] of this.dealt) if (n > 0 && (!best || n > this.dealt.get(best)!)) best = m;
    return best;
  }

  private showResult() {
    this.clearUi();
    this.buildHud();
    const cx = this.W / 2;
    const cy = this.H / 2 - 20;
    if (this.mode === 'daily') return this.showDailyResult(cx, cy);
    const tall = this.battle !== null;
    this.uiObjs.push(this.add.rectangle(cx, tall ? cy + 54 : cy + 12, 400, tall ? 348 : 224, C.panel, 0.95).setStrokeStyle(3, C.panelEdge).setDepth(150));
    const star = this.star();
    if (star)
      this.uiObjs.push(
        this.add.text(cx, cy + 4, t('starMole', { name: star.name, n: this.dealt.get(star)! }), { fontFamily: FONT, fontSize: '14px', color: hex(TEAM_COLORS[star.team]), fontStyle: 'bold' })
          .setOrigin(0.5).setDepth(151),
      );
    const title = this.winner! < 0 ? t('draw') : t('wins', { team: this.teamName(this.winner!) });
    this.uiObjs.push(
      this.add.text(cx, cy - 60, title, { fontFamily: FONT, fontSize: '30px', color: hex(this.winner! >= 0 ? TEAM_COLORS[this.winner!] : C.ink), fontStyle: 'bold', stroke: hex(INK), strokeThickness: 3 })
        .setOrigin(0.5).setDepth(151),
    );
    const flagLine = this.flag ? ` · ⚑ ${this.flag.score[0]}–${this.flag.score[1]}` : '';
    this.uiObjs.push(this.add.text(cx, cy - 20, t('resultLine', { turns: this.turns, shots: this.shots }) + flagLine, { fontFamily: FONT, fontSize: '15px', color: hex(C.dim) }).setOrigin(0.5).setDepth(151));
    if (this.battle !== null) return this.showBattleResult(cx, cy + 22);
    this.button('rematch', cx, cy + 50, 260, 42, t('rematch'), () => this.startMatch(this.mode === 'duo' ? 'duo' : 'ai'), true);
    this.button('menu', cx, cy + 98, 260, 36, t('menu'), () => this.showMenu());
  }

  /** The daily range's result: today's score, the best and the streak; one try a day. */
  private showDailyResult(cx: number, cy: number) {
    const d = this.daily!;
    const out = this.teams[1].moles.filter((m) => !m.alive).length;
    this.uiObjs.push(this.add.rectangle(cx, cy + 10, 400, 230, C.panel, 0.95).setStrokeStyle(3, C.panelEdge).setDepth(150));
    this.uiObjs.push(
      this.add.text(cx, cy - 70, t('daily'), { fontFamily: FONT, fontSize: '22px', color: hex(C.ink), fontStyle: 'bold' }).setOrigin(0.5).setDepth(151),
      this.add.text(cx, cy - 32, t('dailyScore', { n: d.score ?? 0 }), { fontFamily: FONT, fontSize: '30px', color: hex(TEAM_COLORS[0]), fontStyle: 'bold', stroke: hex(INK), strokeThickness: 3 }).setOrigin(0.5).setDepth(151),
      this.add.text(cx, cy + 6, t('dailyOut', { n: out, all: this.teams[1].moles.length }), { fontFamily: FONT, fontSize: '14px', color: hex(C.dim) }).setOrigin(0.5).setDepth(151),
      this.add.text(cx, cy + 30, t('dailyBest', { best: d.best, streak: t('streak', { n: d.streak }) }), { fontFamily: FONT, fontSize: '14px', color: hex(C.ink), fontStyle: 'bold' }).setOrigin(0.5).setDepth(151),
    );
    this.button('menu', cx, cy + 82, 260, 40, t('dailyBack'), () => this.showMenu(), true);
  }

  /** A campaign battle's result: the three stars and what each asks, then on to the next battle. */
  private showBattleResult(cx: number, cy: number) {
    const i = this.battle!;
    const bt = BATTLES[i];
    const won = this.winner === 0;
    const got = [won, won && this.turns <= bt.par, won && !this.lostMole];
    const asks = [t('starWin'), t('starPar', { n: bt.par }), t('starFlawless')];
    got.forEach((ok, k) => {
      const y = cy + 12 + k * 24;
      this.uiObjs.push(
        this.add.text(cx - 150, y, ok ? '★' : '☆', { fontFamily: FONT, fontSize: '20px', color: hex(ok ? 0xf0a020 : 0xb9a994) }).setOrigin(0.5).setDepth(151),
        this.add.text(cx - 132, y, asks[k], { fontFamily: FONT, fontSize: '14px', color: hex(ok ? C.ink : C.dim) }).setOrigin(0, 0.5).setDepth(151),
      );
    });
    if (won && this.earned.best) this.uiObjs.push(this.add.text(cx + 170, cy + 12, t('newBest'), { fontFamily: FONT, fontSize: '13px', color: hex(C.fire), fontStyle: 'bold' }).setOrigin(1, 0.5).setDepth(151));
    this.uiObjs.push(this.add.text(cx + 170, cy + 60, t('acornsWon', { n: this.earned.acorns }), { fontFamily: FONT, fontSize: '14px', color: hex(0x9a5a1a), fontStyle: 'bold' }).setOrigin(1, 0.5).setDepth(151));
    const next = won && i + 1 < BATTLES.length;
    this.button('rematch', cx - 70, cy + 104, 130, 38, t('retry'), () => this.startMatch('ai', i), !next);
    if (next) this.button('next', cx + 70, cy + 104, 130, 38, t('nextBattle'), () => this.startMatch('ai', i + 1), true);
    else this.button('campaign', cx + 70, cy + 104, 130, 38, t('campaign'), () => this.showMenuCampaign());
    this.button('menu', cx, cy + 148, 200, 32, t('menu'), () => this.showMenu());
  }

  private showMenuCampaign() {
    this.showMenu();
    this.showCampaign();
  }

  /** A quick match (against the AI or two players), where the Options panel's turn time and crates apply. */
  private quick() {
    return (this.mode === 'ai' || this.mode === 'duo') && this.battle === null;
  }

  /** The best stars of the campaign tier being played. */
  private tierStars() {
    return this.veteran ? this.campaign.vstars : this.campaign.stars;
  }

  private teamName(i: number) {
    if (i === 1 && this.mode === 'daily') return t('strawMoles');
    if (i === 1 && this.battle !== null) return t(`c_${BATTLES[this.battle].id}`);
    return i === 0 ? t('teamBlue') : t('teamAmber');
  }

  // ------------------------------------------------------------ HUD

  private button(id: string, x: number, y: number, w: number, h: number, label: string, onTap: () => void, primary = false, hold?: (down: boolean) => void) {
    const base = primary ? C.buttonHi : C.button;
    const box = this.add.rectangle(x, y, w, h, base).setStrokeStyle(2, C.panelEdge).setDepth(160);
    const txt = this.add.text(x, y, label, { fontFamily: FONT, fontSize: `${Math.round(Math.min(18, h * 0.42))}px`, color: hex(C.ink), fontStyle: 'bold' }).setOrigin(0.5).setDepth(161);
    box.setInteractive({ useHandCursor: true });
    box.on('pointerover', () => box.setFillStyle(C.buttonHi));
    box.on('pointerout', () => {
      box.setFillStyle(base);
      hold?.(false);
    });
    box.on('pointerdown', () => {
      ui('click');
      if (hold) hold(true);
      else onTap();
    });
    if (hold) box.on('pointerup', () => hold(false));
    this.buttons[id] = { x, y, w, h };
    this.uiObjs.push(box, txt);
    return { box, txt };
  }

  /** The view's edges in world pixels: the world's own, except round the daily range's smaller map. */
  private edges() {
    return { l: -this.ox, r: this.W + this.ox, t: -this.oy, b: this.H + this.oy };
  }

  private buildHud() {
    this.clearUi();
    const W = this.W;
    const e = this.edges();
    const mk = (key: string, x: number, y: number, size: number, color: number, origin = 0.5) => {
      const tx = this.add.text(x, y, '', { fontFamily: FONT, fontSize: `${size}px`, color: hex(color), fontStyle: 'bold' }).setOrigin(origin, 0.5).setDepth(166);
      this.texts[key] = tx;
      this.uiObjs.push(tx);
      return tx;
    };
    mk('team0', e.l + LEFT_PANEL + 14, e.t + 22, 14, C.ink, 0);
    mk('team1', e.r - 30, e.t + 22, 14, C.ink, 1);
    mk('wind', W / 2, e.t + 22, 13, C.ink);
    mk('forecast', W / 2 + 98, e.t + 30, 13, C.ink, 0).setStroke('#ffffff', 4);
    mk('timer', W / 2, e.t + 62, 16, C.ink);
    mk('banner', W / 2, e.t + 108, 22, C.ink).setStroke('#ffffff', 5);
    mk('hint', W / 2, e.b - 84, 13, C.ink).setStroke('#ffffff', 4);
    if (this.screen !== 'play' || this.mode === 'watch') return;
    const y = e.b - 34;
    // The weapon button opens the arsenal.
    const wb = this.add.rectangle(e.l + 122, y, 210, 50, C.button).setStrokeStyle(2, C.panelEdge).setDepth(160).setInteractive({ useHandCursor: true });
    wb.on('pointerdown', () => {
      ui('click');
      if (this.arsenalOpen) this.closeArsenal();
      else this.openArsenal();
    });
    this.buttons.weapon = { x: e.l + 122, y, w: 210, h: 50 };
    this.uiObjs.push(wb);
    mk('weaponName', e.l + 66, y - 8, 14, C.ink, 0);
    mk('weaponAmmo', e.l + 66, y + 11, 12, C.dim, 0);
    this.button('left', e.r - 300, y, 50, 44, '◀', () => undefined, false, (d) => (this.hold.left = d));
    this.button('right', e.r - 244, y, 50, 44, '▶', () => undefined, false, (d) => (this.hold.right = d));
    this.button('jump', e.r - 188, y, 50, 44, '⤴', () => this.humanTurn() && this.active && this.world.jump(this.active));
    const fire = this.button('fire', e.r - 88, y, 130, 46, t('fire'), () => undefined, true, (d) => this.onFireButton(d));
    fire.box.setFillStyle(C.fire);
    fire.box.on('pointerover', () => fire.box.setFillStyle(C.fire));
    fire.box.on('pointerout', () => fire.box.setFillStyle(C.fire));
    fire.txt.setColor('#ffffff').setFontSize(16);
    this.texts.fire = fire.txt;
    this.refreshHud();
  }

  private refreshHud() {
    if (!this.teams.length) return;
    const team = this.teams[this.turn];
    const w = WEAPONS[team.weapon];
    this.texts.weaponName?.setText(t(`w_${team.weapon}`));
    const ammo = team.ammo[team.weapon];
    this.texts.weaponAmmo?.setText(ammo < 0 ? t('ammoEndless') : t('ammoLeft', { n: ammo }));
    this.texts.fire?.setText(w.mode === 'aim' || w.mode === 'angle' ? t('fire') : w.mode === 'target' ? t('pick') : t('use'));
    const hint = this.humanTurn()
      ? t(w.mode === 'aim' ? 'hintAim' : w.mode === 'angle' ? 'hintAngle' : w.mode === 'target' ? 'hintTarget' : 'hintUse')
      : '';
    this.texts.hint?.setText(
      this.phase === 'build' ? t('buildHint', { team: this.teamName(this.turn), n: this.buildLeft })
        : this.phase === 'aim' && this.turns < 4 ? hint : '',
    );
  }

  private openArsenal() {
    if (!this.humanTurn() || this.phase !== 'aim') return;
    this.arsenalOpen = true;
    this.charging = false;
    this.dragging = false;
    const team = this.teams[this.turn];
    const cols = 7;
    const tw = 76;
    const th = 62;
    const pw = cols * tw + 24;
    const rows = Math.ceil(WEAPON_IDS.length / cols);
    const ph = rows * th + 104;
    const cx = this.W / 2;
    const cy = Math.min(this.H / 2, this.edges().b - 70 - ph / 2);
    const panel = this.add.rectangle(cx, cy, pw, ph, C.panel, 0.97).setStrokeStyle(3, C.panelEdge).setDepth(170).setInteractive();
    const objs: Phaser.GameObjects.GameObject[] = [panel];
    objs.push(this.add.text(cx - pw / 2 + 16, cy - ph / 2 + 18, t('arsenal'), { fontFamily: FONT, fontSize: '18px', color: hex(C.ink), fontStyle: 'bold' }).setOrigin(0, 0.5).setDepth(171));
    const icons = this.add.graphics().setDepth(172);
    objs.push(icons);
    const desc = this.add.text(cx - pw / 2 + 16, cy + ph / 2 - 30, '', { fontFamily: FONT, fontSize: '13px', color: hex(C.ink), wordWrap: { width: pw - 32 } }).setOrigin(0, 0.5).setDepth(171);
    objs.push(desc);
    const show = (id: WeaponId) => desc.setText(`${t(`w_${id}`)}: ${t(`d_${id}`)}`);
    show(team.weapon);
    const order = GROUPS.flatMap((gr) => WEAPON_IDS.filter((id) => WEAPONS[id].group === gr));
    order.forEach((id, i) => {
      const x = cx - pw / 2 + 12 + (i % cols) * tw + tw / 2;
      const y = cy - ph / 2 + 44 + Math.floor(i / cols) * th + th / 2;
      const ammo = team.ammo[id];
      const tile = this.add.rectangle(x, y, tw - 6, th - 6, id === team.weapon ? C.buttonHi : C.button, ammo === 0 ? 0.45 : 1).setStrokeStyle(2, id === team.weapon ? C.fire : 0xc9b8a3).setDepth(171);
      tile.setInteractive({ useHandCursor: true });
      tile.on('pointerover', () => show(id));
      tile.on('pointerdown', () => this.pickWeapon(id));
      this.buttons[`w-${id}`] = { x, y, w: tw - 6, h: th - 6 };
      objs.push(tile);
      icons.save();
      drawWeaponIcon(icons, id, x, y - 6, 1.15, 0);
      icons.restore();
      objs.push(this.add.text(x, y + 19, ammo < 0 ? '∞' : `×${ammo}`, { fontFamily: FONT, fontSize: '11px', color: hex(ammo === 0 ? 0xa09080 : C.ink), fontStyle: 'bold' }).setOrigin(0.5).setDepth(173));
    });
    this.arsenalObjs = objs;
    this.uiObjs.push(...objs);
  }

  private arsenalObjs: Phaser.GameObjects.GameObject[] = [];

  private closeArsenal() {
    this.arsenalOpen = false;
    for (const o of this.arsenalObjs) o.destroy();
    this.uiObjs = this.uiObjs.filter((o) => !this.arsenalObjs.includes(o));
    for (const id of WEAPON_IDS) delete this.buttons[`w-${id}`];
    this.arsenalObjs = [];
  }

  private pickWeapon(id: WeaponId) {
    const team = this.teams[this.turn];
    if (team.ammo[id] === 0) {
      ui('refuse');
      return;
    }
    team.weapon = id;
    this.closeArsenal();
    this.refreshHud();
  }

  private cycleWeapon(d: number) {
    if (!this.humanTurn() || this.phase !== 'aim' || this.arsenalOpen) return;
    const team = this.teams[this.turn];
    let i = WEAPON_IDS.indexOf(team.weapon);
    for (let k = 0; k < WEAPON_IDS.length; k++) {
      i = (i + d + WEAPON_IDS.length) % WEAPON_IDS.length;
      if (team.ammo[WEAPON_IDS[i]] !== 0) break;
    }
    team.weapon = WEAPON_IDS[i];
    ui('click');
    this.refreshHud();
  }

  // ------------------------------------------------------------ input

  private humanTurn() {
    return this.screen === 'play' && !!this.teams[this.turn] && !this.teams[this.turn].ai && (this.phase === 'aim' || this.phase === 'retreat');
  }

  private onDown(p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) {
    if (over.length || this.arsenalOpen) return;
    if (this.screen === 'play' && this.phase === 'build' && !this.teams[this.turn]?.ai) return this.placeBuild(p.worldX, p.worldY);
    if (!this.humanTurn() || !this.active) return;
    const x = p.worldX;
    const y = p.worldY;
    const m = this.active;
    // A tap on another of your moles that has not gone yet hands it the turn (before the active one moves).
    const other = Math.hypot(x - m.x, y - (m.y - 10)) < 44 ? null : this.world.moles.find((o) => Math.abs(o.x - x) < 16 && y > o.y - 36 && y < o.y + 6 && this.canSwap(o));
    if (other) {
      ui('click');
      this.setActive(other);
      this.refreshHud();
      return;
    }
    const w = WEAPONS[this.teams[this.turn].weapon];
    if (this.phase === 'aim' && (w.mode === 'aim' || w.mode === 'angle') && Math.hypot(x - m.x, y - (m.y - 10)) < 44) {
      this.dragging = true;
      this.walkTarget = null;
      this.power = 0;
      return;
    }
    if (this.phase === 'aim' && w.mode === 'target') {
      this.fire(x, y);
      return;
    }
    this.walkTarget = x;
    this.walkTimer = 4;
  }

  private onMove(p: Phaser.Input.Pointer) {
    this.hover = { x: p.worldX, y: p.worldY };
    if (!this.dragging || !this.active) return;
    const dx = this.active.x - p.worldX;
    const dy = this.active.y - 10 - p.worldY;
    const len = Math.hypot(dx, dy);
    if (len < 8) return;
    this.aimAngle = Math.atan2(dy, dx);
    this.active.facing = dx >= 0 ? 1 : -1;
    this.power = Math.min(1, len / 140);
  }

  private onUp() {
    this.hold.left = false;
    this.hold.right = false;
    this.onFireButton(false);
    if (!this.dragging) return;
    this.dragging = false;
    if (this.power > 0.08 && this.phase === 'aim') this.fire();
    else this.power = 0;
  }

  private onSpace(down: boolean) {
    if (!this.humanTurn() || this.phase !== 'aim' || this.arsenalOpen) return;
    const w = WEAPONS[this.teams[this.turn].weapon];
    if (w.mode === 'aim') {
      if (down && !this.charging) {
        this.charging = true;
        this.power = 0;
      } else if (!down && this.charging) {
        this.charging = false;
        this.fire();
      }
    } else if (down && w.mode !== 'target') this.fire();
  }

  /**
   * FIRE, held like Space: an aimed weapon charges while it is held and fires when it is let go (or
   * at full power); a quick tap fires at 60%. Other weapons go off as it is pressed.
   */
  private onFireButton(down: boolean) {
    if (!down) {
      if (!this.fireHeld) return;
      this.fireHeld = false;
      if (!this.charging) return;
      this.charging = false;
      if (this.power < 0.1) this.power = 0.6;
      this.fire();
      return;
    }
    if (!this.humanTurn() || this.phase !== 'aim' || this.arsenalOpen) return;
    const w = WEAPONS[this.teams[this.turn].weapon];
    if (w.mode === 'target') {
      this.texts.hint?.setText(t('hintTarget'));
      return;
    }
    if (w.mode === 'aim') {
      this.fireHeld = true;
      this.charging = true;
      this.power = 0;
      return;
    }
    this.fire();
  }

  /** Uses the team's weapon with the current aim, or at (tx, ty) for a target weapon. */
  private fire(tx = 0, ty = 0) {
    const m = this.active;
    if (!m || !m.alive || this.phase !== 'aim' || m.act) return;
    const team = this.teams[this.turn];
    const id = team.weapon;
    if (team.ammo[id] === 0) {
      ui('refuse');
      return;
    }
    const w = WEAPONS[id];
    if ((id === 'pound' || id === 'swipe' || id === 'burrow') && !m.grounded) {
      ui('refuse');
      return;
    }
    if (team.ammo[id] > 0) team.ammo[id]--;
    m.walk = 0;
    this.walkTarget = null;
    this.charging = false;
    this.shots++;
    if (!team.ai && this.mode !== 'watch') {
      if (!this.stats.used.includes(id)) this.stats.used.push(id);
      saveStats(this.stats);
      if (this.stats.used.length >= 15) this.trophy('arsenal');
      if (this.stats.used.length >= WEAPON_IDS.length) this.trophy('allWeapons');
    }
    if (w.mode === 'aim') this.world.fire(m, id, this.aimAngle, this.power);
    else this.world.use(m, id, this.aimAngle, tx, ty);
    this.phase = id === 'skip' ? 'settle' : 'retreat';
    this.retreat = id === 'skip' ? 0 : RETREAT_TIME;
    this.settleT = 0;
    this.texts.hint?.setText('');
    this.refreshHud();
  }

  // ------------------------------------------------------------ the loop

  update(_time: number, delta: number) {
    if (!this.world) return;
    this.acc += (Math.min(delta, 100) / 1000) * watchSteps();
    let n = 0;
    while (this.acc >= DT && n < 40) {
      this.acc -= DT;
      this.tick();
      n++;
    }
    this.render();
  }

  private tick() {
    this.world.step();
    for (const c of this.clouds) {
      c.x += (4 + this.world.wind * 3) * DT * c.s;
      // Across the whole view, also round the daily range's smaller map.
      if (c.x > this.W + this.ox + 80) c.x = -this.ox - 80;
      if (c.x < -this.ox - 80) c.x = this.W + this.ox + 80;
    }
    for (const s of this.specks) {
      s.x += this.world.wind * 9 * DT + Math.sin(this.world.time * 2 + s.ph) * 0.2;
      s.y += Math.sin(this.world.time + s.ph) * 0.15 + 0.1;
      if (s.x > this.W + this.ox + 10) s.x = -this.ox - 10;
      if (s.x < -this.ox - 10) s.x = this.W + this.ox + 10;
      if (s.y > this.world.water) s.y = 0;
    }
    if (this.banner > 0) this.banner -= DT;
    if (this.screen !== 'play') return;
    this.settleFlag();
    const m = this.active;
    const team = this.teams[this.turn];
    switch (this.phase) {
      case 'draft':
        // The AI takes a moment over each pick.
        if (this.draft && team.ai && (this.draft.t -= DT) <= 0) this.draftPick(aiDraftPick(this.draft.pool.filter((id) => !this.draft!.picks.some((p) => p.includes(id)))), true);
        break;
      case 'aim':
        this.timer -= DT;
        if (this.weather === 'gusts') {
          this.gustT -= DT;
          if (this.gustT <= 0) {
            // A gust: the wind swings a few points, mid-turn.
            this.gustT = 4 + Math.random() * 3;
            const d = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.floor(Math.random() * 3));
            this.world.wind = Math.max(-10, Math.min(10, this.world.wind + d));
            SFX('whoosh');
          }
        }
        if (team.ai) this.aiTick();
        else this.controlTick();
        if (this.charging) {
          this.power = Math.min(1, this.power + DT / 1.6);
          if (this.power >= 1) {
            this.charging = false;
            this.fire();
          }
        }
        if (this.timer <= 0 || !m?.alive) {
          if (m) m.walk = 0;
          this.phase = 'settle';
          this.settleT = 0;
          this.dragging = false;
          this.charging = false;
          if (this.arsenalOpen) this.closeArsenal();
        }
        break;
      case 'retreat':
        this.retreat -= DT;
        if (!team.ai) this.controlTick();
        else if (m) m.walk = 0;
        if (this.retreat <= 0 || !m?.alive) {
          if (m) m.walk = 0;
          this.phase = 'settle';
          this.settleT = 0;
        }
        break;
      case 'settle':
        if (m) m.walk = 0;
        if (this.world.busy()) {
          this.settleT = 0;
          break;
        }
        this.settleT += DT;
        if (this.settleT < 0.5) break;
        if (this.world.startDeaths()) {
          this.settleT = 0;
          break;
        }
        this.endTurn();
        break;
    }
  }

  /** The human's walking, from the arrow keys, the ◀ ▶ buttons or a tapped spot, and the angle keys. */
  private controlTick() {
    const m = this.active;
    if (!m || !m.alive) return;
    const k = this.keys;
    let dir = 0;
    if (!this.arsenalOpen && !this.dragging && !this.charging) {
      if (k.LEFT.isDown || k.A.isDown || this.hold.left) dir = -1;
      else if (k.RIGHT.isDown || k.D.isDown || this.hold.right) dir = 1;
      if (dir) this.walkTarget = null;
      else if (this.walkTarget !== null) {
        this.walkTimer -= DT;
        if (Math.abs(this.walkTarget - m.x) < 3 || this.walkTimer <= 0) this.walkTarget = null;
        else dir = Math.sign(this.walkTarget - m.x);
      }
    }
    const turnedTo = dir;
    m.walk = m.act ? 0 : dir;
    if (turnedTo && turnedTo !== Math.sign(Math.cos(this.aimAngle))) this.aimAngle = Math.atan2(Math.sin(this.aimAngle), -Math.cos(this.aimAngle));
    if (this.phase === 'aim' && !this.arsenalOpen) {
      // Up raises the barrel, whichever way the mole faces.
      const up = k.UP.isDown || k.W.isDown ? 1 : k.DOWN.isDown || k.S.isDown ? -1 : 0;
      if (up) {
        const facing = Math.cos(this.aimAngle) >= 0 ? 1 : -1;
        let elev = Math.atan2(-Math.sin(this.aimAngle), Math.abs(Math.cos(this.aimAngle)));
        elev = Math.max(-1.5, Math.min(1.55, elev + up * 1.3 * DT));
        this.aimAngle = Math.atan2(-Math.sin(elev), Math.cos(elev) * facing);
      }
    }
  }

  private aiTick() {
    const m = this.active!;
    const team = this.teams[this.turn];
    const ai = this.ai;
    ai.t -= DT;
    switch (ai.stage) {
      case 'think':
        if (ai.t > 0) return;
        if (this.flag && !ai.walked && this.flagWalk(m)) {
          ai.stage = 'flag';
          ai.t = 9;
          ai.walked = true;
          ai.from = m.x;
          return;
        }
        const rival = this.battle === null ? null : BATTLES[this.battle];
        ai.plan = planTurn(this.world, m, team.ammo, byLevel(2.4, 1, 0.35) * (rival?.aim ?? 1) * (rival && this.veteran ? VETERAN.aim : 1), !ai.walked, rival?.habit ?? null);
        if (ai.plan.walk) {
          ai.stage = 'walk';
          ai.t = 1.3;
          ai.walked = true;
          m.walk = ai.plan.walk;
          return;
        }
        team.weapon = ai.plan.weapon;
        this.refreshHud();
        aiLog(this.side(), `${m.name}: ${t(`w_${ai.plan.weapon}`)}${ai.plan.target ? ` → ${ai.plan.target.name}` : ''} (${Math.round(ai.plan.miss)} px)`);
        ai.from = this.aimAngle;
        ai.stage = WEAPONS[ai.plan.weapon].mode === 'target' ? 'mark' : 'turn';
        ai.t = WEAPONS[ai.plan.weapon].mode === 'target' ? 0.8 : 0.7;
        return;
      case 'flag': {
        // Walk to the flag, hopping up steps too tall to walk, then plan a shot from there.
        const dx = this.flag!.x - m.x;
        if (Math.abs(dx) > 8 && ai.t > 0) {
          m.walk = m.grounded && !m.act ? Math.sign(dx) : 0;
          if (m.grounded && Math.abs(m.x - ai.from) < 0.2) {
            m.facing = dx > 0 ? 1 : -1;
            this.world.jump(m);
          }
          ai.from = m.x;
          return;
        }
        m.walk = 0;
        if (!m.grounded) return;
        ai.stage = 'think';
        ai.t = 0.3;
        return;
      }
      case 'walk':
        if (ai.t > 0 && m.grounded) return;
        m.walk = 0;
        if (!m.grounded) return;
        ai.stage = 'think';
        ai.t = 0.3;
        return;
      case 'mark':
        if (ai.t > 0) return;
        ai.stage = 'done';
        this.fire(ai.plan!.tx, ai.plan!.ty);
        return;
      case 'turn': {
        const p = ai.plan!;
        const k = Math.max(0, Math.min(1, 1 - ai.t / 0.7));
        let d = p.angle - ai.from;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        this.aimAngle = ai.from + d * k;
        m.facing = Math.cos(this.aimAngle) >= 0 ? 1 : -1;
        if (ai.t > 0) return;
        const mode = WEAPONS[p.weapon].mode;
        if (mode === 'aim') {
          ai.stage = 'charge';
          this.power = 0;
        } else {
          ai.stage = 'done';
          this.fire();
        }
        return;
      }
      case 'charge':
        this.power = Math.min(ai.plan!.power, this.power + DT / 1.4);
        if (this.power >= ai.plan!.power) {
          ai.stage = 'done';
          this.fire();
        }
        return;
      case 'done':
        return;
    }
  }

  /** Whether this AI mole should walk to the flag: its side's nearest, not there yet, with dry ground all the way. */
  private flagWalk(m: Mole) {
    const f = this.flag!;
    const mine = this.teams[m.team].moles.filter((o) => o.alive);
    const nearest = mine.reduce((a, o) => (Math.abs(o.x - f.x) < Math.abs(a.x - f.x) ? o : a));
    if (nearest !== m || Math.abs(f.x - m.x) < FLAG_REACH * 0.6 || Math.abs(f.x - m.x) > 380) return false;
    const dir = Math.sign(f.x - m.x);
    for (let x = m.x; Math.abs(x - f.x) > 4; x += dir * 4) {
      const y = this.terrain.groundBelow(x, Math.min(m.y, f.y) - 80);
      if (y < 0 || y > this.world.water - 12) return false;
    }
    return true;
  }

  private side() {
    return this.turn === 0 ? 'blue' : 'amber';
  }

  private endTurn() {
    const log = this.world.log;
    const team = this.teams[this.turn];
    const human = !team.ai && this.mode !== 'watch';
    if (human) {
      if (log.enemiesHurt.size) this.trophy('firstHit');
      if (log.enemiesHurt.size >= 3) this.trophy('triple');
      if (log.drownedEnemies) this.trophy('splash');
      if (log.longShot) this.trophy('longShot');
    }
    if (this.mode === 'ai' && this.teams[0].moles.some((m) => !m.alive)) this.lostMole = true;
    if (this.mode === 'watch' && log.damage) aiLog(this.side(), t('logDamage', { n: log.damage }));
    if (this.active && log.damage) this.dealt.set(this.active, (this.dealt.get(this.active) ?? 0) + log.damage);
    if (this.active) team.went.add(this.active);
    this.turns++;
    this.scoreFlag();
    const alive = this.teams.map((tm) => tm.moles.some((m) => m.alive));
    if (!alive[0] || !alive[1] || this.flagWinner() >= 0) return this.finish();
    if (this.mode === 'daily') {
      // The straw moles never shoot back: the next shot is yours again, until the shots run out.
      if (this.turns >= DAILY_SHOTS) return this.finish();
      this.world.turnTeam = -1;
      return this.beginTurn();
    }
    // Sudden death: the water rises.
    if (this.turns >= this.suddenDeath) this.world.water -= 8;
    // Now and then a crate floats down.
    if (Math.random() < (this.quick() ? CRATE_ODDS[this.prefs.options.crates] : 0.4) + this.boost.crates) {
      const x = 40 + Math.random() * (this.W - 80);
      const health = Math.random() < 0.3;
      this.world.dropCrate(x, health ? 'health' : 'weapon', health ? null : CRATE_WEAPONS[Math.floor(Math.random() * CRATE_WEAPONS.length)]);
    }
    this.world.turnTeam = -1;
    this.turn = 1 - this.turn;
    this.phase = 'settle';
    // Wait for the crate to land before the next turn starts.
    if (this.world.busy()) {
      this.phase = 'over';
      const wait = () => {
        if (this.screen !== 'play') return;
        if (this.world.busy()) this.time.delayedCall(100, wait);
        else this.beginTurn();
      };
      this.time.delayedCall(100, wait);
    } else this.beginTurn();
  }

  private onCrate(m: Mole, weapon: WeaponId | null) {
    const team = this.teams[m.team];
    if (weapon) {
      if (team.ammo[weapon] >= 0) team.ammo[weapon]++;
      this.world.pops.push({ x: m.x, y: m.y - 44, text: t(`w_${weapon}`), color: TEAM_COLORS[m.team], t: 0 });
    }
    if (!team.ai && this.mode !== 'watch') this.trophy('crate');
    this.refreshHud();
  }

  private trophy(id: string) {
    if (this.mode === 'watch') return;
    award(trophies, id);
  }

  private sfx(name: Sfx) {
    SFX(name);
  }

  private shake(power: number) {
    if (settings.reduceMotion) return;
    this.cameras.main.shake(140, Math.min(0.012, power * 0.0009));
  }

  // ------------------------------------------------------------ drawing

  private render() {
    const w = this.world;
    // Reduced motion holds every blink, flicker and wobble still.
    const time = this.still() ? 0 : w.time;
    this.art?.sync();
    // Clouds and the specks the wind blows.
    const s = this.skyG.clear();
    for (const c of this.clouds) {
      s.fillStyle(0xffffff, 0.85);
      for (const [dx, dy, r] of [[0, 0, 16], [18, -8, 20], [38, 0, 15], [20, 5, 14]] as const) s.fillCircle(c.x + dx * c.s, c.y + dy * c.s, r * c.s);
    }
    for (const p of this.specks) {
      s.fillStyle(this.theme.speck, 0.8);
      s.fillEllipse(p.x, p.y, 4, 2, 6);
    }
    const g = this.g.clear();
    for (const m of w.mounds) drawMound(g, m);
    for (const c of w.crates) drawCrate(g, c, time);
    for (const k of w.kegs) drawKeg(g, k, time);
    if (this.flag) this.drawFlag(g, time);
    const team = this.teams[this.turn];
    for (const m of w.moles) {
      const isActive = m === this.active && this.screen === 'play' && this.phase === 'aim';
      const weapon = isActive ? team.weapon : null;
      const shows = isActive && (WEAPONS[weapon!].mode !== 'use' || weapon === 'shield' || weapon === 'repair' || weapon === 'mine' || weapon === 'dynamite');
      drawMole(g, m, { time, aim: shows ? this.aimAngle : null, weapon });
    }
    for (const sh of w.shots) drawShot(g, sh, time);
    for (const f of w.flames) drawFlame(g, f, time);
    for (const b of w.bees) drawBee(g, b, time);
    for (const b of w.balloons) drawBalloon(g, b, time);
    for (const b of w.bolts) drawBolt(g, b, time, BOLT_CLOUD - 40);
    for (const b of w.beams) drawBeam(g, b);
    this.drawAim(g);
    // A small ring over each of your moles that could take this turn instead.
    if (this.screen === 'play' && this.phase === 'aim')
      for (const m of w.moles)
        if (this.canSwap(m)) {
          g.lineStyle(2, 0xffffff, 0.9);
          const y = m.y - (m.hat === 'crown' ? 52 : m.hat ? 44 : 34) - 24;
          g.strokeCircle(m.x, y, 5);
          g.fillStyle(TEAM_COLORS[m.team], 0.9);
          g.fillCircle(m.x, y, 2.5);
        }
    const fx = this.fx.clear();
    // Reduced motion also skips the flash of each blast.
    for (const p of w.particles) if (!(p.kind === 'flash' && this.still())) drawParticle(fx, p);
    this.drawWater();
    this.drawWeather();
    this.drawLabels();
    this.drawHud();
  }

  private drawAim(g: Phaser.GameObjects.Graphics) {
    const m = this.active;
    if (!m || !m.alive || this.screen !== 'play' || this.phase !== 'aim' || m.act) return;
    const team = this.teams[this.turn];
    const id = team.weapon;
    const w = WEAPONS[id];
    const col = TEAM_COLORS[m.team];
    // A bouncing arrow over the mole whose turn it is.
    const time = this.still() ? 0 : this.world.time;
    if (this.banner > 0) {
      const by = m.y - 50 - Math.abs(Math.sin(time * 5)) * 6;
      g.fillStyle(INK, 1);
      g.fillTriangle(m.x - 9, by - 2, m.x + 9, by - 2, m.x, by + 11);
      g.fillStyle(col, 1);
      g.fillTriangle(m.x - 6, by, m.x + 6, by, m.x, by + 8);
    }
    if (w.mode === 'aim' || w.mode === 'angle') {
      // Aim ring: white with a dot in the team's colour (never a crosshair).
      const rx = m.x + Math.cos(this.aimAngle) * 52;
      const ry = m.y - 12 + Math.sin(this.aimAngle) * 52;
      g.lineStyle(2, 0xffffff, 0.95);
      g.strokeCircle(rx, ry, 7);
      g.fillStyle(col, 1);
      g.fillCircle(rx, ry, 2.5);
      if (this.power > 0 && w.mode === 'aim') {
        // The power wedge grows along the aim.
        const n = Math.ceil(this.power * 10);
        for (let i = 0; i < n; i++) {
          const d = 18 + i * 4;
          const c = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.ValueToColor(0xffe066), Phaser.Display.Color.ValueToColor(0xff5a2f), 10, i,
          );
          g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
          g.fillCircle(m.x + Math.cos(this.aimAngle) * d, m.y - 12 + Math.sin(this.aimAngle) * d, 1.5 + i * 0.35);
        }
        // The first part of the path, as the difficulty allows.
        const seconds = team.ai ? 0 : byLevel(3, 0.75, 0) * (this.weather === 'fog' ? 0.5 : 1);
        if (seconds > 0) {
          const p = World.muzzle(m, this.aimAngle);
          const sp = w.speed * Math.max(0.05, this.power);
          const ax = this.world.wind * WIND_ACC * windFactor(id);
          const f = flight(this.terrain, p.x, p.y, Math.cos(this.aimAngle) * sp, Math.sin(this.aimAngle) * sp, ax, this.world.water, seconds, [], 4, this.world.edgeX);
          f.points.forEach((pt, i) => {
            g.fillStyle(0xffffff, 0.9 - (i / f.points.length) * 0.7);
            g.fillCircle(pt.x, pt.y, 2.2);
          });
        }
      }
    } else if (w.mode === 'target' && !team.ai) {
      const { x, y } = this.hover;
      g.lineStyle(2, 0xffffff, 0.9);
      g.strokeCircle(x, y, 10);
      g.fillStyle(col, 1);
      g.fillTriangle(x - 5, y - 18, x + 5, y - 18, x, y - 11);
    }
    if (team.ai && this.ai.stage === 'mark' && this.ai.plan) {
      const { tx, ty } = this.ai.plan;
      g.lineStyle(2, 0xffffff, 0.9);
      g.strokeCircle(tx, ty - 10, 10 + Math.sin(time * 10) * 2);
    }
  }

  /** Flag hill's flag: a pole with a pennant in the colour of the side that scored last, and its reach on the ground. */
  private drawFlag(g: Phaser.GameObjects.Graphics, time: number) {
    const f = this.flag!;
    g.fillStyle(0xffffff, 0.22);
    g.fillEllipse(f.x, f.y, FLAG_REACH * 2, 10, 24);
    g.lineStyle(1.5, 0xffffff, 0.7);
    g.strokeEllipse(f.x, f.y, FLAG_REACH * 2, 10, 24);
    g.fillStyle(INK, 1);
    // Tall enough for the pennant to fly above the moles' labels.
    const top = f.y - 72;
    g.fillRect(f.x - 2, top, 4, 72);
    g.fillCircle(f.x, top - 1, 3.5);
    const col = f.last < 0 ? 0xf6f1e6 : TEAM_COLORS[f.last];
    const wave = Math.sin(time * 4) * 3;
    g.fillStyle(INK, 1);
    g.fillTriangle(f.x + 1, top, f.x + 1, top + 22, f.x + 30 + wave, top + 11);
    g.fillStyle(col, 1);
    g.fillTriangle(f.x + 3, top + 3, f.x + 3, top + 19, f.x + 26 + wave, top + 11);
  }

  /** Whether the hub's reduced motion is on: blinking and flickering then hold still. */
  private still() {
    return settings.reduceMotion;
  }

  /** Rain streaks blown by the wind, or banks of fog drifting over the hills. Held still with reduced motion. */
  private drawWeather() {
    const g = this.fogG.clear();
    if (this.screen === 'menu') return;
    const time = settings.reduceMotion ? 0 : this.world.time;
    if (this.weather === 'rain') {
      const slant = this.world.wind * 1.4;
      g.lineStyle(1.5, 0xc8dcf0, 0.55);
      for (let i = 0; i < 90; i++) {
        const x = ((i * 97.3 + time * (slant * 20)) % (this.W + 40) + this.W + 40) % (this.W + 40) - 20;
        const y = (i * 53.7 + time * 520) % this.H;
        g.lineBetween(x, y, x + slant, y + 14);
      }
    } else if (this.weather === 'fog') {
      for (let i = 0; i < 7; i++) {
        const x = ((i * 211 + time * 12) % (this.W + 300)) - 150;
        const y = this.H * (0.35 + (i % 3) * 0.12);
        g.fillStyle(0xf2f0ea, 0.22);
        g.fillEllipse(x, y, 380, 90, 24);
      }
      g.fillStyle(0xf2f0ea, 0.12);
      g.fillRect(0, 0, this.W, this.H);
    }
  }

  private drawWater() {
    const g = this.waterG.clear();
    const top = this.world.water;
    const time = this.world.time;
    const wave: { x: number; y: number }[] = [];
    // Across the whole view, also round the daily range's smaller map.
    const x0 = -this.ox - 8;
    const x1 = this.W + this.ox + 8;
    const bottom = this.H + this.oy + 10;
    for (let x = x0; x <= x1; x += 8) wave.push({ x, y: top + Math.sin(x / 22 + time * 2) * 3 });
    g.fillStyle(this.theme.water, 0.88);
    g.fillPoints(pts([...wave, { x: x1, y: bottom }, { x: x0, y: bottom }]), true);
    g.lineStyle(3, this.theme.waterTop, 0.9);
    g.strokePoints(pts(wave), false);
    g.fillStyle(0xffffff, 0.3);
    for (let i = 0; i < 8; i++) {
      const x = ((i * 157 + time * 20) % (x1 - x0 + 24)) + x0 - 12;
      g.fillEllipse(x, top + 12 + (i % 3) * 7, 22, 2, 6);
    }
  }

  private drawLabels() {
    for (const [m, label] of this.labels) {
      const show = m.alive && !m.hidden && (m.act?.kind !== 'die');
      label.setVisible(show);
      if (!show) continue;
      const badge = m.trade ? TRADE_ICON[m.trade] + ' ' : '';
      label.setText(badge + (m === this.active && this.screen === 'play' ? `${m.name} ${Math.ceil(m.hp)}` : String(Math.ceil(m.hp))));
      label.setPosition(m.x, m.y - (m.hat === 'crown' ? 52 : m.hat ? 44 : 34));
    }
    for (const p of this.world.pops) {
      let tx = this.popTexts.get(p);
      if (!tx) {
        tx = this.add.text(p.x, p.y, p.text, { fontFamily: FONT, fontSize: '16px', color: hex(p.color), fontStyle: 'bold', stroke: '#ffffff', strokeThickness: 4 }).setOrigin(0.5).setDepth(9);
        this.popTexts.set(p, tx);
      }
      tx.setPosition(p.x, p.y - p.t * 26).setAlpha(Math.min(1, (1.3 - p.t) * 2));
    }
    for (const [p, tx] of this.popTexts)
      if (!this.world.pops.includes(p)) {
        tx.destroy();
        this.popTexts.delete(p);
      }
  }

  private drawHud() {
    const h = this.hud.clear();
    if (this.screen === 'menu') {
      this.iconG.clear();
      return;
    }
    const W = this.W;
    const e = this.edges();
    // Team panels: name and the team's health together, pinned to the view's top corners.
    this.teams.forEach((tm, i) => {
      const x = i === 0 ? e.l + LEFT_PANEL : e.r - 236;
      h.fillStyle(C.panel, 0.92);
      h.fillRoundedRect(x, e.t + 8, 220, 44, 10);
      h.lineStyle(2, INK, 1);
      h.strokeRoundedRect(x, e.t + 8, 220, 44, 10);
      const total = tm.moles.reduce((s, m) => s + (m.alive ? m.hp : 0), 0);
      const full = tm.moles.reduce((s, m) => s + m.maxHp, 0);
      h.fillStyle(0xe5ddd2, 1);
      h.fillRoundedRect(x + 12, e.t + 34, 196, 10, 5);
      h.fillStyle(TEAM_COLORS[i], 1);
      if (total > 0) h.fillRoundedRect(x + 12, e.t + 34, Math.max(10, (196 * total) / full), 10, 5);
      if (i === this.turn && this.screen === 'play') {
        h.lineStyle(3, TEAM_COLORS[i], 1);
        h.strokeRoundedRect(x - 3, e.t + 5, 226, 50, 12);
      }
      const count = this.mode === 'daily' && i === 0
        ? t('shotOf', { n: Math.min(this.turns + 1, DAILY_SHOTS), all: DAILY_SHOTS })
        : `${tm.moles.filter((m) => m.alive).length}/${tm.moles.length}` + (this.flag ? `  ⚑ ${this.flag.score[i]}/${FLAG_WIN}` : '');
      this.texts[`team${i}`]?.setText(`${this.teamName(i)}${tm.ai && this.battle === null ? ' · ' + t('aiTag') : ''}  ${count}`);
    });
    // Wind.
    h.fillStyle(C.panel, 0.92);
    h.fillRoundedRect(W / 2 - 90, e.t + 8, 180, 44, 10);
    h.lineStyle(2, INK, 1);
    h.strokeRoundedRect(W / 2 - 90, e.t + 8, 180, 44, 10);
    const wind = this.world.wind;
    const sky = this.weather === 'clear' ? '' : ' · ' + t(`weather_${this.weather}`);
    this.texts.wind?.setText((wind === 0 ? t('windCalm') : t('wind')) + sky);
    // A Scout on the side whose turn it is (a player's) sees the next winds.
    const scout = this.screen === 'play' && !this.teams[this.turn]?.ai && this.teams[this.turn]?.moles.some((m) => m.alive && m.trade === 'scout');
    const ahead = scout ? this.windAhead.slice(0, SCOUT_AHEAD).map((n) => (n === 0 ? '·0' : (n > 0 ? '→' : '←') + Math.abs(n))).join(' ') : '';
    this.texts.forecast?.setText(ahead ? `${TRADE_ICON.scout} ${ahead}` : '');
    if (wind) {
      const len = (Math.abs(wind) / 10) * 70;
      const dir = Math.sign(wind);
      const cy = e.t + 40;
      h.lineStyle(4, 0x3d8be0, 1);
      h.lineBetween(W / 2 - dir * len, cy, W / 2 + dir * len, cy);
      h.fillStyle(0x3d8be0, 1);
      h.fillTriangle(W / 2 + dir * (len + 9), cy, W / 2 + dir * len, cy - 6, W / 2 + dir * len, cy + 6);
    }
    // Turn timer.
    if (this.screen === 'play') {
      const shown = this.phase === 'aim' ? Math.ceil(Math.max(0, this.timer)) : this.phase === 'retreat' ? Math.ceil(Math.max(0, this.retreat)) : 0;
      h.fillStyle(this.phase === 'aim' && this.timer < 6 ? 0xffd6c2 : C.panel, 0.92);
      h.fillRoundedRect(W / 2 - 30, e.t + 50, 60, 26, 8);
      h.lineStyle(2, INK, 1);
      h.strokeRoundedRect(W / 2 - 30, e.t + 50, 60, 26, 8);
      this.texts.timer?.setText(shown ? String(shown) : '…');
      if (this.phase === 'aim' && this.timer < 5 && Math.floor(this.timer) !== Math.floor(this.timer + DT * 4)) SFX('tick');
    }
    if (this.texts.banner) {
      const m = this.active;
      const show = this.banner > 0 && m && this.screen === 'play';
      this.texts.banner.setVisible(!!show);
      if (show) {
        this.texts.banner.setText(t('turnOf', { name: m.name }));
        this.texts.banner.setColor(hex(TEAM_COLORS[m.team]));
        this.texts.banner.setAlpha(Math.min(1, this.banner));
      }
    }
    const ig = this.iconG.clear();
    if (this.buttons.weapon && this.screen === 'play') {
      const b = this.buttons.weapon;
      ig.fillStyle(0xffffff, 1);
      ig.fillCircle(b.x - b.w / 2 + 26, b.y, 20);
      drawWeaponIcon(ig, this.teams[this.turn].weapon, b.x - b.w / 2 + 26, b.y, 0.95, this.still() ? 0 : this.world.time);
    }
  }
}
