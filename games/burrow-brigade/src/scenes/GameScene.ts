import Phaser from 'phaser';
import { playMusic, playSting, ui } from '../../../../shared/audio';
import { viewSize } from '../../../../shared/scaling';
import { byDifficulty, settings } from '../../../../shared/settings';
import { award } from '../../../../shared/trophies';
import { aiLog, mountWatch, watching, watchSteps } from '../../../../shared/watch';
import { SFX, SONG } from '../audio';
import { planTurn, type Plan } from '../game/ai';
import { loadPrefs, loadStats, savePrefs, saveStats, type Stats } from '../game/save';
import { DT, flight, generate, spawnPoints, Terrain, THEMES, WATER_GAP, WIND_ACC, type Theme } from '../game/terrain';
import { CRATE_WEAPONS, GROUPS, startingAmmo, WEAPON_IDS, WEAPONS, type WeaponId } from '../game/weapons';
import { MAX_HP, World, windFactor, type Mole, type Pop, type Sfx } from '../game/world';
import { t } from '../i18n';
import { trophies } from '../trophies';
import {
  drawBalloon, drawBeam, drawBee, drawBolt, drawCrate, drawFlame, drawMole, drawMound, drawParticle, drawShot, drawWeaponIcon, INK, pts, TEAM_COLORS,
} from './draw';
import { paintSky, TerrainArt } from './terrainArt';

type Spot = { x: number; y: number; w: number; h: number };
type Screen = 'menu' | 'play' | 'over';
type Phase = 'aim' | 'retreat' | 'settle' | 'over';

interface Team {
  index: number;
  ai: boolean;
  ammo: Record<WeaponId, number>;
  weapon: WeaponId;
  next: number;
  moles: Mole[];
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
  mode: 'ai' | 'duo' | 'watch' = 'ai';
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
  dragging = false;
  shots = 0;
  winner: number | null = null;
  arsenalOpen = false;
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
  private ai: { stage: 'think' | 'walk' | 'turn' | 'charge' | 'mark' | 'done'; t: number; plan: Plan | null; walked: boolean; from: number } = {
    stage: 'done', t: 0, plan: null, walked: false, from: 0,
  };
  private stats: Stats = loadStats();
  private size = loadPrefs().size;
  private hover = { x: 0, y: 0 };
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private lostMole = false;

  constructor() {
    super('Game');
  }

  create() {
    ({ width: this.W, height: this.H } = viewSize(this));
    this.skyG = this.add.graphics().setDepth(1);
    this.g = this.add.graphics().setDepth(5);
    this.fx = this.add.graphics().setDepth(6);
    this.waterG = this.add.graphics().setDepth(7);
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
      view: { w: this.W, h: this.H },
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

  /** Builds a fresh map and world; `demo` puts a few idle moles on it for the menu. */
  private buildWorld(teamSize: number) {
    this.theme = THEMES[Math.floor(Math.random() * THEMES.length)];
    this.terrain = generate(Math.ceil(this.W), Math.ceil(this.H));
    const th = this.theme;
    const dirt = [th.dirt, th.dirtDark, th.dirtLight].map((c) => parseInt(c.slice(1), 16));
    this.world = new World(this.terrain, this.H - WATER_GAP, { sound: (n) => this.sfx(n), shake: (p) => this.shake(p) }, dirt);
    this.objs.push(paintSky(this, this.W, this.H, th));
    this.art = new TerrainArt(this, this.terrain, th, 2);
    const spots = spawnPoints(this.terrain, teamSize, this.world.water);
    const names = NAMES.map((n) => n.slice().sort(() => Math.random() - 0.5));
    this.teams = [0, 1].map((i) => ({
      index: i, ai: false, ammo: startingAmmo(), weapon: 'rocket' as WeaponId, next: 0,
      moles: spots[i].map((p, k) => this.world.addMole(i, names[i][k], p.x, p.y)),
    }));
    this.world.onCollect = (m, c) => this.onCrate(m, c.weapon);
    this.clouds = Array.from({ length: 6 }, () => ({ x: Math.random() * this.W, y: 30 + Math.random() * this.H * 0.25, s: 0.6 + Math.random() * 0.7 }));
    this.specks = Array.from({ length: 18 }, () => ({ x: Math.random() * this.W, y: Math.random() * this.H * 0.7, ph: Math.random() * 6 }));
    for (const m of this.world.moles) {
      const label = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', color: '#ffffff', fontStyle: 'bold', backgroundColor: hex(TEAM_COLORS[m.team]), padding: { x: 3, y: 1 } })
        .setOrigin(0.5, 1).setDepth(8);
      this.labels.set(m, label);
    }
  }

  showMenu() {
    this.clearAll();
    this.screen = 'menu';
    this.phase = 'over';
    this.active = null;
    this.winner = null;
    playMusic(SONG, 'calm');
    this.buildWorld(3);
    this.drawMenu();
  }

  private drawMenu() {
    this.clearUi();
    const cx = this.W / 2;
    const top = Math.max(20, this.H / 2 - 230);
    const panel = this.add.rectangle(cx, top + 200, 420, 380, C.panel, 0.94).setStrokeStyle(3, C.panelEdge).setDepth(150);
    this.uiObjs.push(panel);
    this.uiObjs.push(this.add.text(cx, top + 44, t('title'), { fontFamily: FONT, fontSize: '46px', color: hex(C.ink), fontStyle: 'bold' }).setOrigin(0.5).setDepth(151));
    this.uiObjs.push(this.add.text(cx, top + 98, t('tagline'), { fontFamily: FONT, fontSize: '15px', color: hex(C.dim), align: 'center', wordWrap: { width: 380 } }).setOrigin(0.5).setDepth(151));
    this.button('play-ai', cx, top + 158, 300, 46, t('playAi'), () => this.startMatch('ai'), true);
    this.button('play-duo', cx, top + 212, 300, 46, t('playDuo'), () => this.startMatch('duo'));
    this.button('size-down', cx - 120, top + 262, 40, 36, '◀', () => this.setSize(-1));
    this.button('size-up', cx + 120, top + 262, 40, 36, '▶', () => this.setSize(1));
    this.texts.size = this.add.text(cx, top + 262, t('teamSize', { n: this.size }), { fontFamily: FONT, fontSize: '17px', color: hex(C.ink), fontStyle: 'bold' }).setOrigin(0.5).setDepth(151);
    this.uiObjs.push(this.texts.size);
    const used = this.stats.used.length;
    this.uiObjs.push(
      this.add.text(cx, top + 312, t('statsLine', { wins: this.stats.wins, games: this.stats.games, used, all: WEAPON_IDS.length }), {
        fontFamily: FONT, fontSize: '14px', color: hex(C.dim), align: 'center', wordWrap: { width: 380 },
      }).setOrigin(0.5).setDepth(151),
    );
    this.uiObjs.push(this.add.text(cx, top + 350, t('menuHint'), { fontFamily: FONT, fontSize: '13px', color: hex(C.dim), align: 'center', wordWrap: { width: 380 } }).setOrigin(0.5).setDepth(151));
  }

  private setSize(d: number) {
    this.size = Math.max(2, Math.min(5, this.size + d));
    savePrefs({ size: this.size });
    this.texts.size?.setText(t('teamSize', { n: this.size }));
  }

  startMatch(mode: 'ai' | 'duo' | 'watch') {
    this.clearAll();
    this.mode = mode;
    this.screen = 'play';
    this.winner = null;
    this.turns = 0;
    this.shots = 0;
    this.lostMole = false;
    playMusic(SONG, 'battle');
    this.buildWorld(this.size);
    this.teams[1].ai = mode !== 'duo';
    this.teams[0].ai = mode === 'watch';
    this.turn = Math.random() < 0.5 && mode === 'watch' ? 1 : 0;
    this.buildHud();
    if (mode === 'watch')
      mountWatch({
        title: t('title'),
        sides: { blue: { name: t('teamBlue'), color: hex(TEAM_COLORS[0]) }, amber: { name: t('teamAmber'), color: hex(TEAM_COLORS[1]) } },
        time: () => this.world.time * 1000,
      });
    else {
      this.stats.games++;
      saveStats(this.stats);
    }
    this.beginTurn();
  }

  private beginTurn() {
    const team = this.teams[this.turn];
    const alive = team.moles.filter((m) => m.alive);
    if (!alive.length) return this.finish();
    // The next mole in the rotation that is still standing.
    let m = team.moles[team.next % team.moles.length];
    for (let i = 0; i < team.moles.length && !m.alive; i++) {
      team.next++;
      m = team.moles[team.next % team.moles.length];
    }
    team.next++;
    this.active = m;
    this.world.turnTeam = this.turn;
    this.world.log = World.freshLog();
    const calm = Math.random() < 0.15;
    this.world.wind = calm ? 0 : Math.round((Math.random() * 2 - 1) * 10);
    this.phase = 'aim';
    this.timer = TURN_TIME;
    this.aimAngle = m.facing > 0 ? -Math.PI / 4 : (-3 * Math.PI) / 4;
    this.power = 0;
    this.charging = false;
    this.dragging = false;
    this.walkTarget = null;
    this.banner = 2.2;
    if (team.ammo[team.weapon] === 0) team.weapon = 'rocket';
    this.ai = { stage: team.ai ? 'think' : 'done', t: 0.8, plan: null, walked: false, from: 0 };
    this.refreshHud();
  }

  private finish() {
    this.phase = 'over';
    this.screen = 'over';
    const alive = this.teams.map((tm) => tm.moles.some((m) => m.alive));
    this.winner = alive[0] && !alive[1] ? 0 : alive[1] && !alive[0] ? 1 : -1;
    if (this.winner >= 0) for (const m of this.teams[this.winner].moles) if (m.alive) m.act = { kind: 'cheer', t: 0, dur: 99 };
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
        if (settings.difficulty === 'hard') this.trophy('hardWin');
        playSting(SONG, 'win');
      } else playSting(SONG, 'lose');
    } else playSting(SONG, 'win');
    saveStats(this.stats);
    this.showResult();
  }

  private showResult() {
    this.clearUi();
    this.buildHud();
    const cx = this.W / 2;
    const cy = this.H / 2 - 20;
    this.uiObjs.push(this.add.rectangle(cx, cy, 400, 200, C.panel, 0.95).setStrokeStyle(3, C.panelEdge).setDepth(150));
    const title = this.winner! < 0 ? t('draw') : t('wins', { team: this.teamName(this.winner!) });
    this.uiObjs.push(
      this.add.text(cx, cy - 60, title, { fontFamily: FONT, fontSize: '30px', color: hex(this.winner! >= 0 ? TEAM_COLORS[this.winner!] : C.ink), fontStyle: 'bold', stroke: hex(INK), strokeThickness: 3 })
        .setOrigin(0.5).setDepth(151),
    );
    this.uiObjs.push(this.add.text(cx, cy - 20, t('resultLine', { turns: this.turns, shots: this.shots }), { fontFamily: FONT, fontSize: '15px', color: hex(C.dim) }).setOrigin(0.5).setDepth(151));
    this.button('rematch', cx, cy + 30, 260, 42, t('rematch'), () => this.startMatch(this.mode === 'duo' ? 'duo' : 'ai'), true);
    this.button('menu', cx, cy + 78, 260, 36, t('menu'), () => this.showMenu());
  }

  private teamName(i: number) {
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

  private buildHud() {
    this.clearUi();
    const W = this.W;
    const H = this.H;
    const mk = (key: string, x: number, y: number, size: number, color: number, origin = 0.5) => {
      const tx = this.add.text(x, y, '', { fontFamily: FONT, fontSize: `${size}px`, color: hex(color), fontStyle: 'bold' }).setOrigin(origin, 0.5).setDepth(166);
      this.texts[key] = tx;
      this.uiObjs.push(tx);
      return tx;
    };
    mk('team0', LEFT_PANEL + 14, 22, 14, C.ink, 0);
    mk('team1', W - 30, 22, 14, C.ink, 1);
    mk('wind', W / 2, 22, 13, C.ink);
    mk('timer', W / 2, 62, 16, C.ink);
    mk('banner', W / 2, 108, 22, C.ink).setStroke('#ffffff', 5);
    mk('hint', W / 2, H - 84, 13, C.ink).setStroke('#ffffff', 4);
    if (this.screen !== 'play' || this.mode === 'watch') return;
    const y = H - 34;
    // The weapon button opens the arsenal.
    const wb = this.add.rectangle(122, y, 210, 50, C.button).setStrokeStyle(2, C.panelEdge).setDepth(160).setInteractive({ useHandCursor: true });
    wb.on('pointerdown', () => {
      ui('click');
      if (this.arsenalOpen) this.closeArsenal();
      else this.openArsenal();
    });
    this.buttons.weapon = { x: 122, y, w: 210, h: 50 };
    this.uiObjs.push(wb);
    mk('weaponName', 66, y - 8, 14, C.ink, 0);
    mk('weaponAmmo', 66, y + 11, 12, C.dim, 0);
    this.button('left', W - 300, y, 50, 44, '◀', () => undefined, false, (d) => (this.hold.left = d));
    this.button('right', W - 244, y, 50, 44, '▶', () => undefined, false, (d) => (this.hold.right = d));
    this.button('jump', W - 188, y, 50, 44, '⤴', () => this.humanTurn() && this.active && this.world.jump(this.active));
    const fire = this.button('fire', W - 88, y, 130, 46, t('fire'), () => this.onFireButton(), true);
    fire.box.setFillStyle(C.fire);
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
    this.texts.hint?.setText(this.phase === 'aim' && this.turns < 4 ? hint : '');
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
    const cy = Math.min(this.H / 2, this.H - 70 - ph / 2);
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
    if (over.length || this.arsenalOpen || !this.humanTurn() || !this.active) return;
    const x = p.worldX;
    const y = p.worldY;
    const m = this.active;
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

  private onFireButton() {
    if (!this.humanTurn() || this.phase !== 'aim') return;
    const w = WEAPONS[this.teams[this.turn].weapon];
    if (w.mode === 'target') {
      this.texts.hint?.setText(t('hintTarget'));
      return;
    }
    if (w.mode === 'aim' && this.power < 0.1) this.power = 0.6;
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
      if (c.x > this.W + 80) c.x = -80;
      if (c.x < -80) c.x = this.W + 80;
    }
    for (const s of this.specks) {
      s.x += this.world.wind * 9 * DT + Math.sin(this.world.time * 2 + s.ph) * 0.2;
      s.y += Math.sin(this.world.time + s.ph) * 0.15 + 0.1;
      if (s.x > this.W + 10) s.x = -10;
      if (s.x < -10) s.x = this.W + 10;
      if (s.y > this.world.water) s.y = 0;
    }
    if (this.banner > 0) this.banner -= DT;
    if (this.screen !== 'play') return;
    const m = this.active;
    const team = this.teams[this.turn];
    switch (this.phase) {
      case 'aim':
        this.timer -= DT;
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
        ai.plan = planTurn(this.world, m, team.ammo, byDifficulty(2.4, 1, 0.35), !ai.walked);
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
    this.turns++;
    const alive = this.teams.map((tm) => tm.moles.some((m) => m.alive));
    if (!alive[0] || !alive[1]) return this.finish();
    // Sudden death: the water rises.
    if (this.turns >= SUDDEN_DEATH_TURN) this.world.water -= 8;
    // Now and then a crate floats down.
    if (Math.random() < 0.4) {
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
    const time = w.time;
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
    const fx = this.fx.clear();
    for (const p of w.particles) drawParticle(fx, p);
    this.drawWater();
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
    if (this.banner > 0) {
      const by = m.y - 50 - Math.abs(Math.sin(this.world.time * 5)) * 6;
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
        const seconds = team.ai ? 0 : byDifficulty(3, 0.75, 0);
        if (seconds > 0) {
          const p = World.muzzle(m, this.aimAngle);
          const sp = w.speed * Math.max(0.05, this.power);
          const ax = this.world.wind * WIND_ACC * windFactor(id);
          const f = flight(this.terrain, p.x, p.y, Math.cos(this.aimAngle) * sp, Math.sin(this.aimAngle) * sp, ax, this.world.water, seconds, [], 4);
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
      g.strokeCircle(tx, ty - 10, 10 + Math.sin(this.world.time * 10) * 2);
    }
  }

  private drawWater() {
    const g = this.waterG.clear();
    const top = this.world.water;
    const time = this.world.time;
    const wave: { x: number; y: number }[] = [];
    for (let x = 0; x <= this.W + 8; x += 8) wave.push({ x, y: top + Math.sin(x / 22 + time * 2) * 3 });
    g.fillStyle(this.theme.water, 0.88);
    g.fillPoints(pts([...wave, { x: this.W + 8, y: this.H + 10 }, { x: 0, y: this.H + 10 }]), true);
    g.lineStyle(3, this.theme.waterTop, 0.9);
    g.strokePoints(pts(wave), false);
    g.fillStyle(0xffffff, 0.3);
    for (let i = 0; i < 8; i++) {
      const x = ((i * 157 + time * 20) % (this.W + 40)) - 20;
      g.fillEllipse(x, top + 12 + (i % 3) * 7, 22, 2, 6);
    }
  }

  private drawLabels() {
    for (const [m, label] of this.labels) {
      const show = m.alive && !m.hidden && (m.act?.kind !== 'die');
      label.setVisible(show);
      if (!show) continue;
      label.setText(m === this.active && this.screen === 'play' ? `${m.name} ${Math.ceil(m.hp)}` : String(Math.ceil(m.hp)));
      label.setPosition(m.x, m.y - 34);
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
    // Team panels: name and the team's health together.
    this.teams.forEach((tm, i) => {
      const x = i === 0 ? LEFT_PANEL : W - 236;
      h.fillStyle(C.panel, 0.92);
      h.fillRoundedRect(x, 8, 220, 44, 10);
      h.lineStyle(2, INK, 1);
      h.strokeRoundedRect(x, 8, 220, 44, 10);
      const total = tm.moles.reduce((s, m) => s + (m.alive ? m.hp : 0), 0);
      const full = tm.moles.length * MAX_HP;
      h.fillStyle(0xe5ddd2, 1);
      h.fillRoundedRect(x + 12, 34, 196, 10, 5);
      h.fillStyle(TEAM_COLORS[i], 1);
      if (total > 0) h.fillRoundedRect(x + 12, 34, Math.max(10, (196 * total) / full), 10, 5);
      if (i === this.turn && this.screen === 'play') {
        h.lineStyle(3, TEAM_COLORS[i], 1);
        h.strokeRoundedRect(x - 3, 5, 226, 50, 12);
      }
      this.texts[`team${i}`]?.setText(`${this.teamName(i)}${tm.ai ? ' · ' + t('aiTag') : ''}  ${tm.moles.filter((m) => m.alive).length}/${tm.moles.length}`);
    });
    // Wind.
    h.fillStyle(C.panel, 0.92);
    h.fillRoundedRect(W / 2 - 90, 8, 180, 44, 10);
    h.lineStyle(2, INK, 1);
    h.strokeRoundedRect(W / 2 - 90, 8, 180, 44, 10);
    const wind = this.world.wind;
    this.texts.wind?.setText(wind === 0 ? t('windCalm') : t('wind'));
    if (wind) {
      const len = (Math.abs(wind) / 10) * 70;
      const dir = Math.sign(wind);
      const cy = 40;
      h.lineStyle(4, 0x3d8be0, 1);
      h.lineBetween(W / 2 - dir * len, cy, W / 2 + dir * len, cy);
      h.fillStyle(0x3d8be0, 1);
      h.fillTriangle(W / 2 + dir * (len + 9), cy, W / 2 + dir * len, cy - 6, W / 2 + dir * len, cy + 6);
    }
    // Turn timer.
    if (this.screen === 'play') {
      const shown = this.phase === 'aim' ? Math.ceil(Math.max(0, this.timer)) : this.phase === 'retreat' ? Math.ceil(Math.max(0, this.retreat)) : 0;
      h.fillStyle(this.phase === 'aim' && this.timer < 6 ? 0xffd6c2 : C.panel, 0.92);
      h.fillRoundedRect(W / 2 - 30, 50, 60, 26, 8);
      h.lineStyle(2, INK, 1);
      h.strokeRoundedRect(W / 2 - 30, 50, 60, 26, 8);
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
      drawWeaponIcon(ig, this.teams[this.turn].weapon, b.x - b.w / 2 + 26, b.y, 0.95, this.world.time);
    }
  }
}
