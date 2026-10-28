import Phaser from 'phaser';
import {
  ABILITY_KEYS,
  ACTIVES,
  ActiveDef,
  BEAST,
  BUFFS,
  BUSHES,
  AbilityDef,
  AbilityKey,
  BASE,
  CHAMPIONS,
  FOUNTAIN,
  ChampionDef,
  ITEMS,
  MASTERY_WINS,
  ELIXIR,
  ELIXIR_COLOR,
  ItemDef,
  LANES,
  RIVER,
  RUNE,
  RUNES,
  MAX_LEVEL,
  SIDE_COLOR,
  STREAK,
  Team,
  TOWERS,
  Vec,
  LaneId,
  WORLD,
  XP_FOR_LEVEL,
  MAX_ITEMS,
  SIGHT,
  WARD,
  WATCH,
  bountyOf,
  SPELLS,
  SpellId,
  spellById,
  upgradeById,
  ultRank,
  ULT_RANK_LEVELS,
  bushAt,
  UpgradeDef,
  SIEGE,
  PING,
  PINGS,
  RECAP,
  PLATING,
  CAMP_KINDS,
  DRAKE,
  DRAKES,
  COMEBACK,
  PING_KINDS,
  PingKind,
} from '../game/data';
import { Fx, GameState, ObjectiveTitle, Phase, Unit, createGame, dist, getUnit } from '../game/state';
import { loadMastery, masteryRank, recordWin } from '../game/mastery';
import { loadQuick, loadSpell, saveQuick, saveSpell } from '../game/spellChoice';
import { abilityFor, atFountain, atShop, buy, buyBack, buybackCost, cast, castSpell, chooseUpgrade, commandAttack, commandMove, hiddenFrom, invulnerable, priceFor, sendPing, startRecall, stealthed, nightness, behind, callSurrender, tick, useActive, viewers } from '../game/sim';
import { FxLayers, drawAura, drawProjectile, drawSkill, drawZone, skillMs } from './skillFx';
import { shortName } from '../game/names';
import { t, type TextKey } from '../i18n';
import { formatNumber } from '../../../../shared/i18n';
import {
  BEAST_CELL,
  BEAST_KEY,
  ELDER_KEY,
  INHIB_CELL,
  BOAR,
  BOAR_CELL,
  MERC_CELL,
  MERC_KEY,
  DRAKE_CELL,
  drakeKey,
  bakeDrake,
  BRUTE_CELL,
  CHAMP_CELL,
  COIN,
  MINION_CELL,
  MINION_OUTLINE,
  NEXUS_CELL,
  RES,
  RUBBLE,
  RUBBLE_CELL,
  TOWER_CELL,
  WATCH_CELL,
  WOLF,
  WOLF_CELL,
  bakeChampions,
  bakeElder,
  bakeUnits,
  bruteKey,
  champKey,
  dirFor,
  frameName,
  inhibKey,
  minionKey,
  nexusKey,
  pickKey,
  towerKey,
  watchKey,
} from '../art/bake';
import { MAP_KEY, MAP_RES, paintMap } from '../art/map';
import { PoseName } from '../art/models';
import { byDifficulty, settings } from '../../../../shared/settings';
import { sharpRes, splitHudCamera, viewPoint, viewSize } from '../../../../shared/scaling';
import { mountWatch, watching, watchSteps } from '../../../../shared/watch';
import { playMusic, playSting, ui } from '../../../../shared/audio';
import { BUSY, SONG, sfx } from '../audio';
import {
  BOTTOM_BAR,
  END_PANEL,
  FONT,
  MINIMAP,
  OBJECTIVE_CARD,
  PLAY_AGAIN,
  PORTRAIT,
  RECALL_BUTTON,
  SPELL_BUTTON,
  SPELL_PICK,
  MODE_PICK,
  SCORE_CHIP,
  SCORE_PANEL,
  surrenderButton,
  SHOP_BUTTON,
  SHOP_PANEL,
  STREAK_CHIP,
  TOP_BAR,
  UPGRADE_PANEL,
  FRAME,
  SCREEN,
  abilityBox,
  activeButton,
  buffChip,
  buffStrip,
  fitLayout,
  pickCard,
  pingButton,
  shopRow,
  upgradeCard,
} from './layout';

/** Simulation step in ms. Each frame runs as many steps as the time since the last frame needs. */
const STEP = 16;
/**
 * The floating touch stick, in view pixels: rim and knob radius, the dead zone, how far a finger
 * drags before a touch steers instead of walking to where it landed, and how far ahead of the
 * champion (in world pixels) it walks for.
 */
/** The keys for the pings, in `PING_KINDS` order. */
const PING_KEYS = ['Z', 'N', 'C'] as const;
const STICK = { r: 60, knob: 24, dead: 8, drag: 14, ahead: 60 };
/** Red's units deal this much damage, by difficulty. */
const ENEMY_DAMAGE = byDifficulty(0.8, 1, 1.25);

/** The slate and gold of the HUD. */
const UI = {
  slate: '#2b3344',
  slateLight: '#465169',
  slateDark: '#161b25',
  edge: '#0c0f15',
  card: '#343e53',
  gold: '#f2c14e',
  goldDeep: '#b8862f',
  text: '#f4f1e8',
  dim: '#a7b1c4',
  muted: '#6e7a8f',
  green: '#7fe08a',
  red: '#ff7a66',
  blue: '#7fb6ff',
};

interface Zone {
  x: number;
  y: number;
  w: number;
  h: number;
  run: () => void;
}

/** A visual still on screen, with the ms it has left. */
interface LiveFx {
  f: Fx;
  left: number;
  /** How long it lasts in all. */
  ms: number;
}

/** The images that draw one unit: its figure, the last-hit outline behind it and a hit flash over it. */
interface UnitSprite {
  main: Phaser.GameObjects.Image;
  outline: Phaser.GameObjects.Image;
  flash: Phaser.GameObjects.Image;
  lastWalk: number;
  movedAt: number;
}

/** Where a unit's feet are drawn, below the centre of its hitbox, by kind. */
const FOOT = { champion: 9, minion: 5, camp: 8, beast: 10, tower: 12, inhibitor: 10, nexus: 16, watchstone: 10, ward: 4 } as const;
/** How far above the feet the top of each kind's figure is, for bars and markers. */
const HEAD = { champion: 56, minion: 32, camp: 34, beast: 84, tower: 104, inhibitor: 62, nexus: 104, watchstone: 62, ward: 44 } as const;
/** The top of a unit's figure above its feet: a brute stands taller than a boar, a pup lower. */
function headOf(u: Unit): number {
  if (u.kind !== 'camp') return HEAD[u.kind];
  return u.campKind === 'ember' || u.campKind === 'moss' ? 70 : u.campKind === 'pup' ? 22 : HEAD.camp;
}
/** The fog of war's grid: one cell per this many world pixels. */
const FOG_CELL = 20;
const FOG_COLS = Math.ceil(WORLD.w / FOG_CELL);
const FOG_ROWS = Math.ceil(WORLD.h / FOG_CELL);
/** How dark the fog is where blue sees nothing (0..1), and the shades it is drawn in. */
const FOG_ALPHA = 0.72;
const FOG_STEPS = 10;
/** How dark the blue of full night lies over the world (0..1). */
const NIGHT_ALPHA = 0.42;

const noop = () => undefined;

/** Texts kept over one unit, keyed by its id; dropped once the unit is gone. */
const UNIT_TEXT = /^(?:lvl|cname|bounty|recall|stun)-(\d+)$/;

/** The size of the map's tiles, in pixels. */
const MAP_TILE = 400;

/** A CSS hex colour as a number Phaser's Graphics take. */
function col(hex: string): number {
  return parseInt(hex.slice(1), 16);
}

function describe(item: ItemDef): string {
  const parts: string[] = [];
  const active = ACTIVES.find((a) => a.id === item.active);
  if (item.dmg) parts.push(t('statDamage', { n: item.dmg }));
  if (item.armor) parts.push(t('statArmour', { n: item.armor }));
  if (item.hp) parts.push(t('statHealth', { n: item.hp }));
  if (item.speed) parts.push(t('statSpeed', { n: item.speed }));
  if (item.atk) parts.push(t('statAttackSpeed', { n: item.atk }));
  if (item.cdr) parts.push(t('statCooldowns', { n: item.cdr }));
  if (item.ward) parts.push(t('statWard', { range: SIGHT.ward, s: WARD.ms / 1000, hits: WARD.hits }));
  const e = item.elixir;
  if (e?.dmg) parts.push(t('statDamagePct', { n: e.dmg }));
  if (e?.armor) parts.push(t('statArmour', { n: e.armor }));
  if (e?.regen) parts.push(t('statRegen', { n: e.regen }));
  if (e?.speed) parts.push(t('statSpeedPct', { n: e.speed }));
  if (e?.atk) parts.push(t('statAttackSpeed', { n: e.atk }));
  if (active) parts.push(active.id === 'dash' ? t('statDash', { key: active.key, range: active.range ?? 0 }) : t('statHeal', { key: active.key, n: active.heal ?? 0 }));
  return parts.join(', ');
}

/** What an upgrade does, worded from its one effect and the name of the ability it changes. */
function upgradeText(u: UpgradeDef, champ: ChampionDef): string {
  const ab = champ.abilities.find((a) => a.key === u.key)!;
  const ability = t(ab.name);
  if (u.stun) return t(ab.stun ? 'upStunLonger' : 'upStun', { ability, s: u.stun / 1000 });
  if (u.slow) return t('upSlow', { ability, s: u.slow / 1000 });
  if (u.count) return t('upCount', { ability, n: u.count });
  if (u.ms) return t('upLasts', { ability, n: u.ms });
  if (u.cd) return t('upCooldown', { ability, n: -u.cd });
  if (u.heal) return t('upHeal', { ability, n: u.heal });
  if (u.shield) return t('upShield', { ability, n: u.shield });
  if (u.range) return t('upRange', { ability, n: u.range });
  if (u.radius) return t('upRadius', { ability, n: u.radius });
  return t('upDamage', { ability, n: u.damage ?? 0 });
}

/** An objective's title in the player's language. */
function objectiveTitle(o: { title: ObjectiveTitle }): string {
  return t(o.title.key, { name: o.title.name ? t(o.title.name) : '' });
}

/** The gem colour of an item, by what it gives. */
function itemTint(item: ItemDef): string {
  if (item.active === 'flask') return '#62d86f';
  if (item.ward) return '#9fd8ff';
  if (item.elixir) return ELIXIR_COLOR[item.id] ?? '#c49bff';
  return item.dmg ? '#ff8a5c' : item.armor ? '#b9c3cf' : item.hp ? '#e0556f' : item.speed ? '#7fb6ff' : item.atk ? '#f2c14e' : '#c49bff';
}

/** Graphics' point lists are typed as vectors but take any {x, y}. */
function pts2(p: { x: number; y: number }[]): Phaser.Math.Vector2[] {
  return p as Phaser.Math.Vector2[];
}

/** A circle drawn as `n` dashes, for ranges. */
function dashedCircle(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, w: number, color: number, alpha: number, n: number) {
  g.lineStyle(w, color, alpha);
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    g.beginPath();
    g.arc(x, y, r, a0, a0 + (Math.PI / n) * 1.1, false);
    g.strokePath();
  }
}

function clock(ms: number) {
  const t = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
}

export class GameScene extends Phaser.Scene {
  /** The match in progress, or null on the pick screen. Read by the playthrough test. */
  state: GameState | null = null;
  private shopOpen = false;
  private acc = 0;
  private lastWorld: Vec = { x: BASE.blue.x, y: BASE.blue.y };
  /** Whether the pointer has been over the canvas, so the world point under it can follow the camera. */
  private pointerSeen = false;
  /** The ability whose key is held down: it shows its range and is cast where the cursor is when the key comes up. */
  private aiming: AbilityKey | null = null;
  /** The ability box under the pointer, whose range shows too. */
  private hoverAbility: AbilityKey | null = null;
  private zones: Zone[] = [];
  private zoneKey = '';
  private liveFx: LiveFx[] = [];
  private groundG!: Phaser.GameObjects.Graphics;
  private topG!: Phaser.GameObjects.Graphics;
  private hudG!: Phaser.GameObjects.Graphics;
  /**
   * A finger on the map, in view pixels: where it went down and where it is now. Dragged past
   * `STICK.drag` it goes `live` and steers the champion like a joystick; until then it was a tap.
   */
  private stick: { id: number; ox: number; oy: number; x: number; y: number; live: boolean } | null = null;
  private sprites = new Map<number, UnitSprite>();
  private mapTiles: Phaser.GameObjects.Image[] = [];
  private portrait!: Phaser.GameObjects.Image;
  private pickImages: Phaser.GameObjects.Image[] = [];
  private pickBg!: Phaser.GameObjects.Image;
  private texts = new Map<string, Phaser.GameObjects.Text>();
  /** The pick card under the pointer, or -1. */
  private hoverPick = -1;
  /** Whether the pointer is on the pick screen's battle spell button. */
  private hoverSpell = false;
  /** The ping a press of its button armed: the next press on the map places it. */
  private pingArmed: PingKind | null = null;
  /** The battle spell the player takes into the next match (`loadSpell`). */
  private spell: SpellId = 'blink';
  /** Whether the next match is a quick one (`loadQuick`). */
  private quick = false;
  /** Whether the pointer is over the match kind button on the pick screen. */
  private hoverMode = false;
  /** The objective target's damage as blue last saw it, for the card while it is out of sight. */
  private objSeen = { id: -1, progress: 0 };
  /** The fog of war: how much each cell is hidden from blue (0 clear, 1 hidden), and its images. */
  private fog = new Float32Array(FOG_COLS * FOG_ROWS);
  private fogG!: Phaser.GameObjects.Graphics;
  private fogMini!: Phaser.GameObjects.Graphics;
  private used = new Set<string>();
  private keys!: Record<AbilityKey | 'B' | 'D' | 'H' | 'V' | 'T' | 'X' | 'G' | 'Z' | 'N' | 'C' | 'ESC' | 'ONE' | 'TWO' | 'THREE' | 'TAB', Phaser.Input.Keyboard.Key>;
  /** The scoreboard, held open by Tab or opened by a tap on the kill score. */
  private scoreTapped = false;
  /** The player's wins per class (`loadMastery`), read when the pick screen shows. */
  private mastery: Record<string, number> = {};
  /** Whether this match's win was counted toward mastery yet, and the class's wins after it. */
  private winCounted: number | null = null;
  /** Music: the phase last seen, blue's structures' health last frame, and the time the tense part lasts to. */
  private musicPhase: Phase = 'pick';
  private structureHp = new Map<number, number>();
  private tenseUntil = 0;

  constructor() {
    super('Game');
  }

  create() {
    // The view fills the screen's shape (picked once at start); the HUD keeps to its edges.
    const view = viewSize(this);
    fitLayout(view.width, view.height);
    const t0 = performance.now();
    const unitsMs = bakeUnits(this);
    paintMap(this);
    if (import.meta.env.DEV) console.info(`Lane Brawl art baked in ${Math.round(performance.now() - t0)} ms (units ${Math.round(unitsMs)} ms)`);
    this.paintPickBackdrop();
    this.mastery = loadMastery();
    this.spell = loadSpell();
    this.quick = loadQuick();
    // The world camera follows the champion; the HUD (scroll factor 0) gets a fixed camera.
    splitHudCamera(this);
    this.cameras.main.setBounds(0, 0, WORLD.w, WORLD.h);
    // The map in tiles, so only the ones in view are drawn.
    for (let y = 0; y < WORLD.h; y += MAP_TILE) {
      for (let x = 0; x < WORLD.w; x += MAP_TILE) {
        const frame = `${x},${y}`;
        const w = Math.min(MAP_TILE, WORLD.w - x);
        const h = Math.min(MAP_TILE, WORLD.h - y);
        this.textures.get(MAP_KEY).add(frame, 0, Math.round(x * MAP_RES), Math.round(y * MAP_RES), Math.round(w * MAP_RES), Math.round(h * MAP_RES));
        this.mapTiles.push(this.add.image(x, y, MAP_KEY, frame).setOrigin(0, 0).setDisplaySize(w, h).setDepth(0));
      }
    }
    this.groundG = this.add.graphics().setDepth(1);
    this.topG = this.add.graphics().setDepth(4);
    this.hudG = this.add.graphics().setDepth(10).setScrollFactor(0);
    this.pickBg = this.add.image(0, 0, 'lb-pick-bg').setOrigin(0, 0).setDisplaySize(SCREEN.w, SCREEN.h).setScrollFactor(0).setDepth(9);
    this.portrait = this.add.image(0, 0, pickKey('warden'), frameName(2, 'idle')).setScrollFactor(0).setDepth(11).setVisible(false);
    CHAMPIONS.forEach((c, i) => {
      const r = pickCard(i);
      this.pickImages.push(
        this.add
          .image(r.x + r.w / 2, r.y + 56, pickKey(c.id), frameName(2, 'idle'))
          .setOrigin(0.5, CHAMP_CELL.footY / CHAMP_CELL.h)
          .setScale(0.85 / RES)
          .setScrollFactor(0)
          .setDepth(11),
      );
    });
    // The fog of war, over the world (above the figures, under the bars) and over the minimap.
    this.fogG = this.add.graphics().setDepth(3.6);
    this.fogMini = this.add.graphics().setScrollFactor(0).setDepth(10.5);

    this.keys = this.input.keyboard!.addKeys('Q,W,E,R,B,D,H,V,T,X,G,Z,N,C,ESC,ONE,TWO,THREE,TAB') as typeof this.keys;
    // Watching the AI, the keys play no champion.
    if (!watching) {
      // Holding an ability's key aims it (its range shows); letting go casts it at the cursor.
      for (const k of ABILITY_KEYS) {
        this.keys[k].on('down', () => this.aim(k));
        this.keys[k].on('up', () => this.release(k));
      }
      for (const a of ACTIVES) this.keys[a.key].on('down', () => this.activeAtCursor(a));
      this.keys.B.on('down', () => this.toggleShop());
      this.keys.T.on('down', () => this.recall());
      this.keys.X.on('down', () => this.buyBack());
      this.keys.G.on('down', () => this.spellAtCursor());
      PING_KINDS.forEach((kind, i) => this.keys[PING_KEYS[i]].on('down', () => this.ping(kind, this.lastWorld)));
      this.keys.ESC.on('down', () => {
        this.aiming = null;
        this.pingArmed = null;
        this.setShop(false);
        this.scoreTapped = false;
      });
      this.keys.ONE.on('down', () => this.pickUpgrade(0));
      this.keys.TWO.on('down', () => this.pickUpgrade(1));
      this.keys.THREE.on('down', () => this.pickUpgrade(2));
    }

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.lastWorld = this.worldAt(p);
      this.pointerSeen = true;
      const v = viewPoint(p);
      const box = this.phase === 'playing' ? ABILITY_KEYS.findIndex((_, i) => {
        const r = abilityBox(i);
        return v.x >= r.x && v.x <= r.x + r.w && v.y >= r.y && v.y <= r.y + r.h;
      }) : -1;
      this.hoverAbility = box >= 0 ? ABILITY_KEYS[box] : null;
      this.hoverPick = CHAMPIONS.findIndex((_, i) => {
        const r = pickCard(i);
        return v.x >= r.x && v.x <= r.x + r.w && v.y >= r.y && v.y <= r.y + r.h;
      });
      const sb = SPELL_PICK;
      this.hoverSpell = this.phase === 'pick' && v.x >= sb.x && v.x <= sb.x + sb.w && v.y >= sb.y && v.y <= sb.y + sb.h;
      const mb = MODE_PICK;
      this.hoverMode = this.phase === 'pick' && v.x >= mb.x && v.x <= mb.x + mb.w && v.y >= mb.y && v.y <= mb.y + mb.h;
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    // A second touch pointer, so one thumb can press an ability while the other steers.
    if (this.input.manager.pointersTotal < 3) this.input.addPointer(1);
    this.stick = null;
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.dragStick(p));
    // A finger let go over the page's buttons, outside the canvas, also ends the stick.
    for (const ev of ['pointerup', 'pointerupoutside']) {
      this.input.on(ev, (p: Phaser.Input.Pointer) => {
        if (this.stick?.id === p.id) this.endStick();
      });
    }
    this.cameras.main.centerOn(BASE.blue.x + 300, BASE.blue.y - 200);
    // Watching the AI skips the pick screen: a random champion plays for blue like the rest.
    if (watching) this.watchMatch();
    else this.startMusic('pick');
    this.refreshZones();
  }

  update() {
    // Everything runs on the frame's own clock time, not Phaser's smoothed delta: Phaser clamps the
    // delta for its first 120 frames, so how long the page took to start would otherwise change how
    // fast a match begins, where the camera is and so where a click lands.
    const frameMs = Math.min(this.game.loop.rawDelta, 250);
    const s = this.state;
    this.steer();
    if (s && s.phase === 'playing') {
      // Watching the AI, the panel's speed runs more steps per frame (none while it holds the match).
      this.acc += frameMs * watchSteps();
      while (this.acc >= STEP) {
        tick(s, STEP);
        this.acc -= STEP;
      }
    }
    // The match is over: the shop closes, so it never covers the end panel.
    if (s && s.phase !== 'playing' && this.shopOpen) this.setShop(false);
    if (s) this.updateFog(s);
    if (s) this.collectFx(s, frameMs);
    if (s) this.playSounds(s);
    if (s) this.updateMusic(s);
    this.followPlayer(frameMs);
    // The camera moves under a still pointer, so the world point under it is read again each frame.
    if (this.pointerSeen) this.lastWorld = this.worldAt(this.input.activePointer);
    // A key let go while the page was away never sends its up: the aim is dropped.
    if (this.aiming && !this.keys[this.aiming].isDown) this.aiming = null;
    this.used.clear();
    this.drawWorld();
    this.drawHud();
    this.refreshZones();
  }

  /** Watch AI: a new match with a random champion for blue, which the AI plays like the other nine. */
  private watchMatch() {
    this.startMatch(CHAMPIONS[Math.floor(Math.random() * CHAMPIONS.length)]);
    mountWatch({
      title: 'Watching AI · Lane Brawl',
      sides: { blue: { name: 'Blue', color: SIDE_COLOR.blue }, red: { name: 'Red', color: SIDE_COLOR.red } },
      time: () => this.state?.time ?? 0,
    });
  }

  private startMatch(def: ChampionDef) {
    // Watching, neither side gets the difficulty's damage, so the match is even.
    this.state = createGame(def, watching ? 1 : ENEMY_DAMAGE, { watch: watching, mastery: masteryRank(this.mastery[def.id] ?? 0), spell: this.spell, quick: this.quick });
    this.winCounted = null;
    // Each champion in the match gets its sheet in its team's colours, once.
    const ms = bakeChampions(
      this,
      this.state.units.filter((u) => u.champ).map((u) => ({ id: u.champ!.id, team: u.side === 'red' ? ('red' as const) : ('blue' as const) })),
    );
    if (import.meta.env.DEV) console.info(`Lane Brawl champions baked in ${Math.round(ms)} ms`);
    this.shopOpen = false;
    this.objSeen = { id: -1, progress: 0 };
    this.liveFx = [];
    this.structureHp.clear();
    this.tenseUntil = 0;
    this.startMusic('lane');
    this.lastWorld = { x: BASE.blue.x + 70, y: BASE.blue.y - 40 };
    this.cameras.main.centerOn(BASE.blue.x + 70, BASE.blue.y - 40);
  }

  private resetToPick() {
    this.state = null;
    this.startMusic('pick');
    this.mastery = loadMastery();
    this.shopOpen = false;
    this.liveFx = [];
    this.cameras.main.centerOn(WORLD.w / 2, WORLD.h / 2);
  }

  /** Whether a unit is hidden from the view: from blue's sight, or never while watching the AI. */
  private hidden(s: GameState, u: Unit): boolean {
    return !watching && hiddenFrom(s, 'blue', u);
  }

  private get phase(): Phase {
    return this.state ? this.state.phase : 'pick';
  }

  private player(): Unit | null {
    return this.state ? getUnit(this.state, this.state.player) : null;
  }

  private setShop(open: boolean) {
    this.shopOpen = open;
  }

  private toggleShop() {
    if (this.phase !== 'playing') return;
    ui('click');
    this.scoreTapped = false;
    this.setShop(!this.shopOpen);
  }

  /** Whether the scoreboard shows: Tab held, or opened with a tap on the kill score. */
  private get scoreOpen(): boolean {
    return !!this.state && this.state.phase === 'playing' && (this.scoreTapped || !!this.keys?.TAB.isDown);
  }

  /** The scoreboard's Surrender: calls a vote for blue, or buzzes while it can't be called yet. */
  private surrenderVote() {
    if (this.state && callSurrender(this.state)) ui('click');
    else ui('refuse');
  }

  private toggleScore() {
    ui('click');
    this.scoreTapped = !this.scoreTapped;
    if (this.scoreTapped) this.setShop(false);
  }

  private aim(key: AbilityKey) {
    if (this.phase === 'playing') this.aiming = key;
  }

  private release(key: AbilityKey) {
    if (this.aiming !== key) return;
    this.aiming = null;
    this.castAtCursor(key);
  }

  private castAtCursor(key: AbilityKey) {
    const p = this.player();
    if (this.state && p && !cast(this.state, p, key, this.lastWorld)) ui('refuse');
  }

  private activeAtCursor(a: ActiveDef) {
    const p = this.player();
    if (this.state && p && !useActive(this.state, p, a.id, this.lastWorld)) ui('refuse');
  }

  /** The pick screen's spell button: the next battle spell, kept for later matches. */
  private nextSpell() {
    ui('click');
    this.spell = SPELLS[(SPELLS.findIndex((sp) => sp.id === this.spell) + 1) % SPELLS.length].id;
    saveSpell(this.spell);
  }

  /** G: the battle spell, aimed at the cursor. */
  private spellAtCursor() {
    const p = this.player();
    if (this.state && p && !castSpell(this.state, p, this.lastWorld)) ui('refuse');
  }

  /** Z, N or C (or a ping button, then the map; Alt and a click for attack): a ping for the allies. */
  private ping(kind: PingKind, at: Vec) {
    this.pingArmed = null;
    const p = this.player();
    if (!this.state || !p) return;
    if (!sendPing(this.state, p, kind, at)) ui('refuse');
  }

  /** A ping button arms its ping for the next press on the map, or drops it when pressed again. */
  private armPing(kind: PingKind) {
    ui('click');
    this.pingArmed = this.pingArmed === kind ? null : kind;
  }

  private pickUpgrade(choice: number) {
    if (this.state && this.phase === 'playing' && chooseUpgrade(this.state, choice)) sfx('upgrade');
  }

  /** T: the champion channels its way home. */
  private recall() {
    const p = this.player();
    if (this.state && p) {
      if (startRecall(this.state, p)) sfx('recall');
      else ui('refuse');
    }
  }

  /** X: a dead champion pays to respawn at once. */
  private buyBack() {
    const p = this.player();
    if (this.state && p && !buyBack(this.state, p)) ui('refuse');
  }

  /** The zones the pointer can press, rebuilt when the screen they belong to changes. */
  private refreshZones() {
    const offer = this.state?.upgradeOffers[0]?.options.length ?? 0;
    const key = `${this.phase}|${this.shopOpen}|${offer}|${this.scoreOpen}`;
    if (key === this.zoneKey) return;
    this.zoneKey = key;
    this.zones = [];
    const phase = this.phase;
    if (phase === 'pick') {
      CHAMPIONS.forEach((def, i) => this.zones.push({ ...pickCard(i), run: () => (sfx('pick'), this.startMatch(def)) }));
      this.zones.push({ ...SPELL_PICK, run: () => this.nextSpell() });
      this.zones.push({ ...MODE_PICK, run: () => (ui('click'), (this.quick = !this.quick), saveQuick(this.quick)) });
      return;
    }
    if (phase === 'won' || phase === 'lost') {
      this.zones.push({ ...PLAY_AGAIN, run: () => (ui('click'), watching ? this.watchMatch() : this.resetToPick()) });
      return;
    }
    // Watching the AI, nothing on the HUD takes a press.
    if (watching) return;
    // The bars and the objective card block presses so a click on the HUD never walks the champion.
    this.zones.push({ ...TOP_BAR, run: noop }, { ...BOTTOM_BAR, run: noop });
    // The open shop hides the objective card, so the card only blocks while it shows.
    if (!this.shopOpen && !this.scoreOpen) this.zones.push({ ...OBJECTIVE_CARD, run: noop });
    this.zones.push({ ...SCORE_CHIP, run: () => this.toggleScore() });
    this.zones.push({ ...SHOP_BUTTON, run: () => this.toggleShop() });
    // One button in the top bar: Recall while alive, Buy back while dead.
    this.zones.push({ ...RECALL_BUTTON, run: () => (this.player()?.dead ? this.buyBack() : this.recall()) });
    this.zones.push({ ...SPELL_BUTTON, run: () => this.spellAtCursor() });
    PING_KINDS.forEach((kind, i) => this.zones.push({ ...pingButton(i), run: () => this.armPing(kind) }));
    ABILITY_KEYS.forEach((k, i) => this.zones.push({ ...abilityBox(i), run: () => this.castAtCursor(k) }));
    ACTIVES.forEach((a, i) => this.zones.push({ ...activeButton(i), run: () => this.activeAtCursor(a) }));
    for (let i = 0; i < offer; i++) this.zones.push({ ...upgradeCard(i, offer), run: () => this.pickUpgrade(i) });
    if (this.scoreOpen) this.zones.push({ ...SCORE_PANEL, run: () => this.toggleScore() }, { ...surrenderButton(), run: () => this.surrenderVote() });
    else if (this.shopOpen) {
      this.zones.push({ ...SHOP_PANEL, run: noop });
      ITEMS.forEach((item, i) => this.zones.push({ ...shopRow(i), run: () => this.buyItem(item.id) }));
    }
  }

  /** Buys an item from the shop: coins when it is bought, the buzz when it can't be. */
  private buyItem(id: string) {
    const p = this.player();
    if (!p || !this.state) return;
    if (buy(p, id)) ui('coin');
    else ui('refuse');
  }

  /** The world point under a pointer, through the world camera (the HUD camera sits on top). */
  private worldAt(pointer: Phaser.Input.Pointer) {
    const w = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    return { x: w.x, y: w.y };
  }

  /** The part of the world in view, in world pixels, where the camera will show it this frame. */
  private viewRect() {
    const mid = this.cameras.main.midPoint;
    const x = Phaser.Math.Clamp(mid.x - SCREEN.w / 2, 0, WORLD.w - SCREEN.w);
    const y = Phaser.Math.Clamp(mid.y - SCREEN.h / 2, 0, WORLD.h - SCREEN.h);
    return { x, y, w: SCREEN.w, h: SCREEN.h };
  }

  private onPointerDown(pointer: Phaser.Input.Pointer) {
    const p = viewPoint(pointer);
    // The zones are searched newest first, so a card over a bar wins.
    const hit = [...this.zones].reverse().find((z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h);
    if (hit) {
      hit.run();
      this.refreshZones();
      return;
    }
    if (this.phase !== 'playing' || !this.state || watching) return;
    const w = this.worldAt(pointer);
    this.lastWorld = w;
    const me = this.player();
    if (!me) return;
    // An armed ping, or Alt held, pings the point instead of walking there.
    const alt = (pointer.event as MouseEvent | undefined)?.altKey;
    if (this.pingArmed || alt) return this.ping(this.pingArmed ?? 'attack', w);
    let foe: Unit | null = null;
    let best = Infinity;
    for (const u of this.state.units) {
      // A watchstone can't be hit: clicking one walks to it, to take it.
      if (u.dead || u.side === me.side || u.kind === 'watchstone' || hiddenFrom(this.state, me.side, u)) continue;
      const d = dist(u, w);
      if (d <= u.radius + 12 && d < best) {
        foe = u;
        best = d;
      }
    }
    if (foe) commandAttack(this.state, foe.id);
    else commandMove(this.state, w);
    // A touch may also turn into the floating stick, if the finger drags on from here.
    if (pointer.wasTouch && !this.stick) this.stick = { id: pointer.id, ox: p.x, oy: p.y, x: p.x, y: p.y, live: false };
  }

  /** Moves the stick's knob to the finger; past the rim the base is dragged along behind it. */
  private dragStick(pointer: Phaser.Input.Pointer) {
    const st = this.stick;
    if (!st || st.id !== pointer.id || !pointer.isDown) return;
    const v = viewPoint(pointer);
    st.x = v.x;
    st.y = v.y;
    const d = Math.hypot(st.x - st.ox, st.y - st.oy);
    if (d > STICK.drag) st.live = true;
    if (d > STICK.r) {
      const k = (d - STICK.r) / d;
      st.ox += (st.x - st.ox) * k;
      st.oy += (st.y - st.oy) * k;
    }
  }

  /** Letting go stops the champion where it stands, rather than at the point it steered for. */
  private endStick() {
    const me = this.player();
    if (this.stick?.live && this.state && me && !me.dead) commandMove(this.state, me);
    this.stick = null;
  }

  /** While the stick steers, the champion walks for a point a little ahead the way it points. */
  private steer() {
    const st = this.stick;
    // A release the scene never heard (it was paused, or the tab was left) still ends the stick.
    if (st && !this.input.manager.pointers.find((p) => p.id === st.id)?.isDown) return this.endStick();
    const me = this.player();
    if (!st?.live || !this.state || this.phase !== 'playing' || !me || me.dead) return;
    const dx = st.x - st.ox;
    const dy = st.y - st.oy;
    const d = Math.hypot(dx, dy);
    if (d <= STICK.dead) return;
    commandMove(this.state, { x: me.x + (dx / d) * STICK.ahead, y: me.y + (dy / d) * STICK.ahead });
  }

  /** The stick under a steering finger: a faint ring and a gold knob. */
  private drawStick(g: Phaser.GameObjects.Graphics) {
    const st = this.stick;
    if (!st?.live) return;
    const d = Math.hypot(st.x - st.ox, st.y - st.oy);
    const k = d > STICK.r ? STICK.r / d : 1;
    const kx = st.ox + (st.x - st.ox) * k;
    const ky = st.oy + (st.y - st.oy) * k;
    g.fillStyle(0x0d111a, 0.35).fillCircle(st.ox, st.oy, STICK.r);
    g.lineStyle(3, col(UI.gold), 0.55).strokeCircle(st.ox, st.oy, STICK.r);
    g.fillStyle(col(UI.gold), 0.7).fillCircle(kx, ky, STICK.knob);
    g.lineStyle(2, 0xffffff, 0.6).strokeCircle(kx, ky, STICK.knob);
  }

  /** Takes the visuals the sim raised this frame and ages the ones on screen. */
  private collectFx(s: GameState, delta: number) {
    // Reduced motion drops the rings and lines but keeps the last-hit coins, which carry the gold.
    // Effects out in the fog stay unseen, like the units that raised them.
    for (const f of s.fx) {
      if ((settings.reduceMotion && f.kind !== 'coin') || this.fogged(f.x, f.y)) continue;
      const ms = f.kind === 'skill' ? skillMs(f.look) : f.ms;
      this.liveFx.push({ f, left: ms, ms });
    }
    s.fx.length = 0;
    for (const l of this.liveFx) l.left -= delta;
    this.liveFx = this.liveFx.filter((l) => l.left > 0);
  }

  /**
   * Plays the sounds the rules raised since last frame: the player's own always, the rest only
   * where the camera shows them and blue sees them (watching, the busy combat ones not at all).
   */
  private playSounds(s: GameState) {
    if (!s.sounds.length) return;
    const v = this.viewRect();
    const margin = 60;
    for (const e of s.sounds) {
      if (watching && BUSY.has(e.id)) continue;
      if (!e.mine && e.x !== undefined && e.y !== undefined) {
        if (e.x < v.x - margin || e.x > v.x + v.w + margin || e.y < v.y - margin || e.y > v.y + v.h + margin) continue;
        if (this.fogged(e.x, e.y)) continue;
      }
      // Someone else's blows sound a little softer than the player's own.
      sfx(e.id, !e.mine && BUSY.has(e.id) ? { volume: 0.55 } : undefined);
    }
    s.sounds.length = 0;
  }

  /** Starts a part of the song, or switches to it at the next bar. */
  private startMusic(part: 'pick' | 'lane' | 'tense') {
    this.musicPhase = part === 'pick' ? 'pick' : 'playing';
    playMusic(SONG, part);
  }

  /**
   * The march while the match runs, the tense part while one of blue's structures takes damage
   * (for 8 s after) or the guardian beast is being fought, and the end sting when a Nexus falls.
   */
  private updateMusic(s: GameState) {
    if (s.phase !== 'playing') {
      if (this.musicPhase === 'playing') {
        this.musicPhase = s.phase;
        playMusic(SONG, 'pick');
        playSting(SONG, watching ? 'end' : s.phase === 'won' ? 'win' : 'lose');
      }
      return;
    }
    for (const u of s.units) {
      if (u.side !== 'blue' || (u.kind !== 'tower' && u.kind !== 'inhibitor' && u.kind !== 'nexus')) continue;
      const before = this.structureHp.get(u.id);
      if (before !== undefined && u.hp < before) this.tenseUntil = s.time + 8000;
      this.structureHp.set(u.id, u.hp);
    }
    const beast = getUnit(s, s.beast);
    const beastFight = !!beast && !beast.dead && beast.lastHitBy !== null;
    playMusic(SONG, beastFight || s.time < this.tenseUntil ? 'tense' : 'lane');
  }

  /**
   * Works out the fog of war over blue's view from the sight of every blue unit, into `fog`: one
   * value per cell, 1 where blue sees nothing, with soft edges (`paintFog` draws it).
   */
  private updateFog(s: GameState) {
    // Watching the AI, the whole map is in view.
    if (watching) return void this.fog.fill(0);
    const cols = FOG_COLS, rows = FOG_ROWS;
    const edge = new Float32Array(cols * rows).fill(1e9);
    for (const v of viewers(s, 'blue')) {
      const c0 = Math.max(0, Math.floor((v.x - v.r) / FOG_CELL) - 1), c1 = Math.min(cols - 1, Math.ceil((v.x + v.r) / FOG_CELL) + 1);
      const r0 = Math.max(0, Math.floor((v.y - v.r) / FOG_CELL) - 1), r1 = Math.min(rows - 1, Math.ceil((v.y + v.r) / FOG_CELL) + 1);
      for (let r = r0; r <= r1; r++) {
        const dy = (r + 0.5) * FOG_CELL - v.y;
        for (let c = c0; c <= c1; c++) {
          const dx = (c + 0.5) * FOG_CELL - v.x;
          const d = Math.sqrt(dx * dx + dy * dy) - v.r;
          if (d < edge[r * cols + c]) edge[r * cols + c] = d;
        }
      }
    }
    // Clear inside sight, fully fogged a little past its edge, a soft ramp between.
    for (let i = 0; i < edge.length; i++) this.fog[i] = Math.max(0, Math.min(1, (edge[i] + 30) / 90));
  }

  /** The fog at a world point, blended smoothly between the cells around it. */
  private fogAt(x: number, y: number): number {
    const fx = Math.max(0, Math.min(FOG_COLS - 1.001, x / FOG_CELL - 0.5));
    const fy = Math.max(0, Math.min(FOG_ROWS - 1.001, y / FOG_CELL - 0.5));
    const c = Math.floor(fx), r = Math.floor(fy), tx = fx - c, ty = fy - r;
    const f = this.fog, i = r * FOG_COLS + c;
    const top = f[i] + (f[i + 1] - f[i]) * tx;
    const bottom = f[i + FOG_COLS] + (f[i + FOG_COLS + 1] - f[i + FOG_COLS]) * tx;
    return top + (bottom - top) * ty;
  }

  /**
   * Paints the fog over a rectangle of the world in squares of `step` world pixels, onto `g` at
   * `scale` px per world pixel from (ox, oy): one rectangle per run of squares of the same shade.
   */
  private paintFog(g: Phaser.GameObjects.Graphics, x0: number, y0: number, w: number, h: number, step: number, ox: number, oy: number, scale: number) {
    const cols = Math.ceil(w / step), rows = Math.ceil(h / step);
    for (let r = 0; r < rows; r++) {
      const y = y0 + r * step;
      let start = 0;
      let shade = -1;
      for (let c = 0; c <= cols; c++) {
        const k = c < cols ? Math.round(this.fogAt(x0 + (c + 0.5) * step, y + step / 2) * FOG_STEPS) : -1;
        if (k === shade) continue;
        if (shade > 0) {
          g.fillStyle(0x0a101c, (shade / FOG_STEPS) * FOG_ALPHA);
          g.fillRect(ox + (x0 + start * step) * scale, oy + y * scale, (c - start) * step * scale, step * scale);
        }
        start = c;
        shade = k;
      }
    }
  }

  /** Whether a world point lies in the fog for blue. */
  private fogged(x: number, y: number): boolean {
    if (!this.state) return false;
    const c = Math.floor(x / FOG_CELL), r = Math.floor(y / FOG_CELL);
    return (this.fog[r * FOG_COLS + c] ?? 0) > 0.6;
  }

  private followPlayer(delta: number) {
    const me = this.player();
    if (!me) return;
    const cam = this.cameras.main;
    const v = this.viewRect();
    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2;
    const k = settings.reduceMotion ? 1 : Math.min(1, delta / 120);
    cam.centerOn(cx + (me.x - cx) * k, cy + (me.y - cy) * k);
  }

  /** The pick screen's backdrop: faceted slate, painted once. */
  private paintPickBackdrop() {
    if (this.textures.exists('lb-pick-bg')) return;
    const res = sharpRes(SCREEN.w, SCREEN.h);
    const c = document.createElement('canvas');
    c.width = Math.round(SCREEN.w * res);
    c.height = Math.round(SCREEN.h * res);
    const ctx = c.getContext('2d')!;
    ctx.scale(c.width / SCREEN.w, c.height / SCREEN.h);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const cell = 60;
    for (let y = 0; y < SCREEN.h + cell; y += cell) {
      for (let x = 0; x < SCREEN.w + cell; x += cell) {
        for (const half of [0, 1]) {
          const k = 0.85 + rnd() * 0.3 - (y / SCREEN.h) * 0.25;
          const v = Math.round(36 * k), g = Math.round(44 * k), b = Math.round(60 * k);
          ctx.fillStyle = `rgb(${v},${g},${b})`;
          ctx.strokeStyle = ctx.fillStyle;
          ctx.beginPath();
          if (half) {
            ctx.moveTo(x, y);
            ctx.lineTo(x + cell, y);
            ctx.lineTo(x + cell, y + cell);
          } else {
            ctx.moveTo(x, y);
            ctx.lineTo(x + cell, y + cell);
            ctx.lineTo(x, y + cell);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    }
    this.textures.addCanvas('lb-pick-bg', c);
  }

  // -------------------------------------------------------------------------------------------
  // The world: shadows and rings on the ground, figures sorted by depth, bars and effects on top.

  private drawWorld() {
    const v = this.viewRect();
    for (const tile of this.mapTiles) {
      tile.setVisible(tile.x < v.x + v.w && tile.x + MAP_TILE > v.x && tile.y < v.y + v.h && tile.y + MAP_TILE > v.y);
    }
    const g = this.groundG;
    const top = this.topG;
    g.clear();
    top.clear();
    const s = this.state;
    const seen = new Set<number>();
    this.fogG.clear();
    this.fogMini.clear();
    if (s) {
      const step = 10;
      const x0 = Math.floor(v.x / step) * step, y0 = Math.floor(v.y / step) * step;
      // Night: a deep blue dusk over the whole view, under the fog.
      const dark = nightness(s.time);
      if (dark > 0 && s.phase === 'playing') this.fogG.fillStyle(0x0b1638, NIGHT_ALPHA * dark).fillRect(v.x, v.y, v.w, v.h);
      this.paintFog(this.fogG, x0, y0, v.x + v.w - x0, v.y + v.h - y0, step, 0, 0, 1);
      if (s.phase === 'playing') this.paintFog(this.fogMini, 0, 0, WORLD.w, WORLD.h, FOG_CELL, MINIMAP.x, MINIMAP.y, MINIMAP.w / WORLD.w);
    }
    if (s) {
      const me = this.player();
      const layers: FxLayers = { ground: g, top };
      this.drawFountains(g, s);
      this.drawRunes(g, s);
      for (const z of s.zones) if (!this.fogged(z.x, z.y)) drawZone(layers, z, s.time, settings.reduceMotion);
      if (me) this.drawRanges(g, s, me);
      for (const u of s.units) {
        if (u.dead && u.kind !== 'tower' && u.kind !== 'inhibitor') continue;
        // A red champion hiding in a bush is not drawn at all.
        if (this.hidden(s, u)) continue;
        this.drawGround(g, u, s);
        // Wards are drawn with the Graphics, not a baked sheet.
        if (u.kind === 'ward') continue;
        seen.add(u.id);
        this.placeSprite(u, s);
      }
      for (const u of s.units) if (!u.dead && !this.hidden(s, u)) this.drawBar(top, u, s, me);
      // The objective is the player's own errand, so watching the AI leaves it out.
      if (!watching) this.drawObjectiveMarker(top, s);
      for (const p of s.projectiles) {
        if (this.fogged(p.x, p.y)) continue;
        drawProjectile(top, p, s.time, p.look ? getUnit(s, p.owner) : null);
      }
      // Champions healing at their Nexus give off green motes.
      for (const u of s.units) {
        if (u.kind !== 'champion' || u.dead || u.hp >= u.maxHp || !atFountain(u) || this.hidden(s, u)) continue;
        for (let i = 0; i < 3; i++) {
          // Reduced motion holds them still, spaced up the rise.
          const k = settings.reduceMotion ? (i + 0.5) / 3 : (s.time / 900 + i / 3 + u.id * 0.37) % 1;
          const x = u.x + Math.sin(i * 2.3 + u.id) * 16, y = u.y - 20 - k * 40;
          const a = Math.sin(k * Math.PI);
          top.lineStyle(2.5, 0x62d86f, a).lineBetween(x - 5, y, x + 5, y).lineBetween(x, y - 5, x, y + 5);
        }
      }
      this.drawFx(top);
      this.drawPings(top, s);
    }
    for (const [id, sp] of this.sprites) {
      if (seen.has(id)) continue;
      sp.main.destroy();
      sp.outline.destroy();
      sp.flash.destroy();
      this.sprites.delete(id);
    }
  }

  /** Blue's pings on the map: a ring that pulses out from the point and the ping's sign over it. */
  private drawPings(g: Phaser.GameObjects.Graphics, s: GameState) {
    for (const p of s.pings) {
      if (p.side !== 'blue') continue;
      const age = s.time - p.at;
      const color = PINGS[p.kind].color;
      const fade = Math.min(1, (PING.showMs - age) / 500);
      // Two pulses in the first two seconds; reduced motion holds one ring still.
      const k = settings.reduceMotion ? 0.6 : (age % 1000) / 1000;
      if (settings.reduceMotion || age < 2000) g.lineStyle(3, col(color), (1 - k) * fade).strokeCircle(p.x, p.y, 12 + k * 44);
      g.lineStyle(2, col(color), 0.8 * fade).strokeEllipse(p.x, p.y, 34, 14);
      this.pingSign(g, p.kind, p.x, p.y - 34, 14, color, fade);
    }
  }

  /** A ping's sign: an arrow down for attack, a flag for gather, a warning triangle for danger. */
  private pingSign(g: Phaser.GameObjects.Graphics, kind: PingKind, x: number, y: number, r: number, color: string, alpha: number) {
    const v = (dx: number, dy: number) => new Phaser.Math.Vector2(x + dx * r, y + dy * r);
    const c = col(color);
    if (kind === 'attack') {
      const arrow = [v(-0.3, -1), v(0.3, -1), v(0.3, 0), v(0.75, 0), v(0, 0.95), v(-0.75, 0), v(-0.3, 0)];
      g.fillStyle(col(UI.edge), alpha).fillPoints(arrow.map((p) => new Phaser.Math.Vector2(x + (p.x - x) * 1.25, y + (p.y - y) * 1.25)), true);
      g.fillStyle(c, alpha).fillPoints(arrow, true);
    } else if (kind === 'gather') {
      g.lineStyle(r * 0.32, col(UI.edge), alpha).lineBetween(x - r * 0.5, y + r, x - r * 0.5, y - r);
      g.lineStyle(r * 0.16, 0xe8e8e8, alpha).lineBetween(x - r * 0.5, y + r, x - r * 0.5, y - r);
      g.fillStyle(col(UI.edge), alpha).fillTriangle(x - r * 0.45, y - r * 1.1, x + r * 0.95, y - r * 0.5, x - r * 0.45, y + r * 0.1);
      g.fillStyle(c, alpha).fillTriangle(x - r * 0.4, y - r * 0.95, x + r * 0.75, y - r * 0.5, x - r * 0.4, y - r * 0.05);
    } else {
      g.fillStyle(col(UI.edge), alpha).fillTriangle(x, y - r * 1.15, x + r * 1.15, y + r * 0.9, x - r * 1.15, y + r * 0.9);
      g.fillStyle(c, alpha).fillTriangle(x, y - r * 0.9, x + r * 0.92, y + r * 0.75, x - r * 0.92, y + r * 0.75);
      g.fillStyle(col(UI.edge), alpha).fillRect(x - r * 0.1, y - r * 0.4, r * 0.2, r * 0.65).fillCircle(x, y + r * 0.5, r * 0.12);
    }
  }

  /** The rune spots on the river: a stone ring, and a rune hovering over it while one waits there (if blue sees it). */
  private drawRunes(g: Phaser.GameObjects.Graphics, s: GameState) {
    RUNE.spots.forEach((p, i) => {
      g.fillStyle(0x6f7a86, 0.9).fillEllipse(p.x, p.y + 5, 60, 28);
      g.fillStyle(0x9aa6b2, 1).fillEllipse(p.x, p.y + 2, 54, 24);
      g.lineStyle(1.5, col(UI.edge), 0.6).strokeEllipse(p.x, p.y + 2, 54, 24);
      const r = s.runes[i];
      if (!r || this.fogged(r.x, r.y)) return;
      const def = RUNES[r.kind];
      const c = col(def.color);
      const bob = settings.reduceMotion ? 0 : Math.sin(s.time / 380 + i) * 3;
      const y = p.y - 30 + bob;
      g.fillStyle(c, 0.3).fillEllipse(p.x, p.y + 2, 46, 18);
      g.fillStyle(c, 0.22).fillCircle(p.x, y, 24);
      const gem = (rad: number) => pts2(Array.from({ length: 6 }, (_, k) => new Phaser.Math.Vector2(p.x + Math.cos((k * Math.PI) / 3 + Math.PI / 6) * rad, y + Math.sin((k * Math.PI) / 3 + Math.PI / 6) * rad)));
      g.fillStyle(col(UI.edge), 1).fillPoints(gem(17), true);
      g.fillStyle(c, 1).fillPoints(gem(14.5), true);
      g.fillStyle(0xffffff, 0.45).fillTriangle(p.x, y - 14.5, p.x - 12.5, y - 7, p.x, y);
      // The kind's mark on the gem: a blade, a wing, a coin or a leaf.
      const ink = col('#1d2330');
      if (r.kind === 'might') g.fillStyle(ink, 0.85).fillTriangle(p.x, y - 9, p.x - 3.5, y + 4, p.x + 3.5, y + 4).fillRect(p.x - 6, y + 4, 12, 3).fillRect(p.x - 1.5, y + 7, 3, 4);
      else if (r.kind === 'haste') g.fillStyle(ink, 0.85).fillTriangle(p.x - 8, y - 6, p.x + 6, y, p.x - 8, y + 6).fillTriangle(p.x - 2, y - 6, p.x + 10, y, p.x - 2, y + 6);
      else if (r.kind === 'fortune') g.lineStyle(2.5, ink, 0.85).strokeCircle(p.x, y, 6.5);
      else g.fillStyle(ink, 0.85).fillEllipse(p.x, y, 7, 15);
    });
  }

  /** The healing ground round each Nexus: a soft ring in the team's colour. */
  private drawFountains(g: Phaser.GameObjects.Graphics, s: GameState) {
    for (const team of ['blue', 'red'] as const) {
      const b = BASE[team];
      const c = col(SIDE_COLOR[team]);
      const pulse = settings.reduceMotion ? 0 : Math.sin(s.time / 500) * 0.03;
      g.fillStyle(0x62d86f, 0.06 + pulse).fillCircle(b.x, b.y, FOUNTAIN.radius);
      dashedCircle(g, b.x, b.y, FOUNTAIN.radius, 4, c, 0.85, 56);
      dashedCircle(g, b.x, b.y, FOUNTAIN.radius - 8, 2, 0x62d86f, 0.6, 56);
    }
  }

  /**
   * Range indicators on the ground: the player's attack reach always, the reach of a champion under
   * the cursor, and the range and shape of an ability while its key is held or its box hovered.
   */
  private drawRanges(g: Phaser.GameObjects.Graphics, s: GameState, me: Unit) {
    if (watching || s.phase !== 'playing') return;
    const key = this.aiming ?? this.hoverAbility;
    const hover = !key && s.units.find((u) => u.kind === 'champion' && u !== me && !u.dead && !this.hidden(s, u) && dist(u, this.lastWorld) <= u.radius + 12);
    if (hover) dashedCircle(g, hover.x, hover.y, hover.range, 2, col(hover.side === 'red' ? '#ff9a8a' : '#9fc8ff'), 0.7, 40);
    if (me.dead) return;
    dashedCircle(g, me.x, me.y, me.range, 2, 0xffffff, 0.55, 40);
    const ab = key && abilityFor(me, key);
    if (!key || !ab) return;
    const ready = me.level >= ab.level && me.cds[key] <= 0 && me.stunMs <= 0;
    const c = !ready ? 0x9aa3b4 : ab.kind === 'ally' || ab.kind === 'buff' ? 0x8ff0a8 : 0x9fd8ff;
    const aim = this.lastWorld;
    const d = Math.max(dist(me, aim), 1);
    const dir = { x: (aim.x - me.x) / d, y: (aim.y - me.y) / d };
    const reach = (range: number) => (d <= range ? { x: aim.x, y: aim.y } : { x: me.x + dir.x * range, y: me.y + dir.y * range });
    const area = (x: number, y: number, r: number) => {
      g.fillStyle(c, 0.22).fillCircle(x, y, r);
      g.lineStyle(3, c, 1).strokeCircle(x, y, r);
      g.lineStyle(1.5, 0xffffff, 0.7).strokeCircle(x, y, r - 4);
    };
    if (ab.range > 0) dashedCircle(g, me.x, me.y, ab.range, 2, c, 0.7, 64);
    switch (ab.kind) {
      case 'burst':
      case 'ally':
      case 'zone': {
        const at = ab.range > 0 ? reach(ab.range) : me;
        area(at.x, at.y, ab.radius ?? 100);
        break;
      }
      case 'bolt': {
        const count = ab.count ?? 1;
        const w = ab.width ?? 24;
        for (let i = 0; i < count; i++) {
          const a = (i - (count - 1) / 2) * (ab.spread ?? 0);
          const vx = Math.cos(a) * dir.x - Math.sin(a) * dir.y, vy = Math.sin(a) * dir.x + Math.cos(a) * dir.y;
          const px = -vy * w, py = vx * w;
          const ex = me.x + vx * ab.range, ey = me.y + vy * ab.range;
          const pts = [
            { x: me.x + px, y: me.y + py },
            { x: ex + px, y: ey + py },
            { x: ex + vx * w, y: ey + vy * w },
            { x: ex - px, y: ey - py },
            { x: me.x - px, y: me.y - py },
          ];
          g.fillStyle(c, 0.14).fillPoints(pts2(pts), true);
          g.lineStyle(2, c, 0.85).strokePoints(pts2(pts), true);
        }
        break;
      }
      case 'dash': {
        const to = reach(ab.range);
        g.lineStyle(3, c, 0.85).lineBetween(me.x, me.y, to.x, to.y);
        if (ab.radius) area(to.x, to.y, ab.radius);
        else g.lineStyle(2.5, c, 0.9).strokeCircle(to.x, to.y, me.radius + 4);
        break;
      }
      case 'buff':
        area(me.x, me.y, me.radius + 26);
        break;
    }
  }

  private drawGround(g: Phaser.GameObjects.Graphics, u: Unit, s: GameState) {
    if (u.dead) return;
    if (u.kind === 'ward') return this.drawWard(g, u, s);
    if (u.kind === 'watchstone') {
      // The ring a team takes it within, and how far along a capture is.
      const color = u.side === 'neutral' ? SIDE_COLOR.neutral : SIDE_COLOR[u.side];
      g.lineStyle(2, col(color), 0.5).strokeEllipse(u.x, u.y + 8, WATCH.radius * 2 * 0.98, WATCH.radius * 2 * 0.58);
      if (u.capture) {
        const k = Math.min(1, u.capture.ms / WATCH.captureMs);
        g.lineStyle(5, col(SIDE_COLOR[u.capture.team]), 1).beginPath();
        g.arc(u.x, u.y - 72, 14, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2, false);
        g.strokePath();
      }
      return;
    }
    const fy = u.y + FOOT[u.kind];
    const r = u.kind === 'tower' ? 30 : u.kind === 'nexus' ? 54 : u.kind === 'inhibitor' ? 26 : u.radius;
    // A soft shadow cast to the bottom right.
    g.fillStyle(0x0b1a0e, 0.18).fillEllipse(u.x + r * 0.35, fy + r * 0.12, r * 2.5, r * 1.2);
    g.fillStyle(0x0b1a0e, 0.18).fillEllipse(u.x + r * 0.25, fy + r * 0.08, r * 1.9, r * 0.9);
    if (u.kind === 'champion' || u.kind === 'minion' || u.kind === 'camp' || u.kind === 'beast') {
      // The team ring under the feet: blue, red, or gold for the jungle.
      const color = col(SIDE_COLOR[u.side]);
      // Minions the beast empowered glow violet; super minions get a wider gold-trimmed ring.
      if (u.kind === 'minion' && u.side !== 'neutral' && s.beastBuff[u.side] > s.time) g.fillStyle(0xb98cff, 0.35).fillEllipse(u.x, fy, r * 3.4, r * 1.9);
      if (u.kind === 'minion' && u.power > 1) g.fillStyle(col(UI.gold), 0.3).fillEllipse(u.x, fy, r * 3.2, r * 1.8).lineStyle(2.5, col(UI.gold), 1).strokeEllipse(u.x, fy, r * 3.2, r * 1.8);
      const w = r * 2.2, h = r * 1.25;
      g.lineStyle(u.kind === 'minion' ? 2 : 3, color, 0.95).strokeEllipse(u.x, fy, w, h);
      g.fillStyle(color, 0.16).fillEllipse(u.x, fy, w, h);
      if (u.player) g.lineStyle(1.5, 0xffffff, 0.9).strokeEllipse(u.x, fy, w + 10, h + 6);
      // A jungle buff or an ability's buff glows round the feet in its colour.
      // An ability's buff glows in that ability's look.
      u.buffs.forEach((b, i) => {
        if (b.look) drawAura({ ground: g, top: this.topG }, b.look, u.x, u.y, s.time, b.color, settings.reduceMotion);
        else g.lineStyle(2, col(b.color), 0.85).strokeEllipse(u.x, fy, w + 16 + i * 8, h + 10 + i * 5);
      });
    }
    if (invulnerable(s, u)) {
      // A shimmering ward round a structure that can't be hurt yet.
      const rr = u.kind === 'nexus' ? 70 : 34;
      g.lineStyle(2, col(SIDE_COLOR[u.side]), 0.55).strokeEllipse(u.x, fy - 2, rr * 2, rr * 1.15);
      g.fillStyle(col(SIDE_COLOR[u.side]), 0.08).fillEllipse(u.x, fy - 2, rr * 2, rr * 1.15);
    }
    if (s.lastHitMark === u.id) g.lineStyle(2.5, col(UI.gold), 1).strokeEllipse(u.x, fy, r * 3, r * 1.75);
  }

  /** A vision ward: a stake with a gem eye in its team's colour, pips for the hits it has left, and (blue's) its sight. */
  private drawWard(g: Phaser.GameObjects.Graphics, u: Unit, s: GameState) {
    const color = col(SIDE_COLOR[u.side]);
    const fy = u.y + FOOT.ward;
    if (u.side === 'blue' && !watching) dashedCircle(g, u.x, u.y, SIGHT.ward, 1.5, color, 0.22, 48);
    g.fillStyle(0x0b1a0e, 0.18).fillEllipse(u.x + 3, fy + 1, 24, 10);
    g.fillStyle(color, 0.16).fillEllipse(u.x, fy, 26, 13);
    g.lineStyle(2, color, 0.9).strokeEllipse(u.x, fy, 26, 13);
    // The stake.
    g.fillStyle(0x5a3b1e, 1).fillRect(u.x - 3, fy - 30, 6, 30);
    g.fillStyle(0x8a5d36, 1).fillRect(u.x - 3, fy - 30, 2.5, 30);
    // The eye: a gem with a glint, pulsing unless motion is reduced.
    const ey = fy - 35;
    const pulse = settings.reduceMotion ? 0 : Math.sin(s.time / 300 + u.id) * 0.5;
    const diamond = (r: number) => [new Phaser.Math.Vector2(u.x, ey - r), new Phaser.Math.Vector2(u.x + r * 0.8, ey), new Phaser.Math.Vector2(u.x, ey + r), new Phaser.Math.Vector2(u.x - r * 0.8, ey)];
    g.fillStyle(color, 0.25).fillCircle(u.x, ey, 12 + pulse * 2);
    g.fillStyle(col(UI.edge), 1).fillPoints(diamond(10), true);
    g.fillStyle(color, 1).fillPoints(diamond(8), true);
    g.fillStyle(0xffffff, 0.85).fillCircle(u.x - 1, ey - 1, 2.4);
    if (u.flash > 0 && !settings.reduceMotion) g.lineStyle(2, 0xffffff, u.flash / 120).strokeCircle(u.x, ey, 13);
    // The hits it has left.
    for (let i = 0; i < WARD.hits; i++) g.fillStyle(i < u.hp ? color : 0x2a2f3a, 1).fillRect(u.x - 7 + i * 5, fy - 50, 4, 3);
  }

  private spriteFor(u: Unit): UnitSprite {
    let sp = this.sprites.get(u.id);
    if (!sp) {
      const mk = () => this.add.image(0, 0, COIN).setScale(1 / RES);
      sp = { main: mk(), outline: mk().setVisible(false), flash: mk().setBlendMode(Phaser.BlendModes.ADD).setVisible(false), lastWalk: u.walk, movedAt: -1e9 };
      this.sprites.set(u.id, sp);
    }
    return sp;
  }

  private placeSprite(u: Unit, s: GameState) {
    const sp = this.spriteFor(u);
    const fy = u.y + FOOT[u.kind];
    let key: string;
    let frame = 'idle';
    let cell: { w: number; h: number; footY: number };
    if (u.walk !== sp.lastWalk) {
      sp.lastWalk = u.walk;
      sp.movedAt = s.time;
    }
    const pose = (step: number): PoseName => {
      if (u.castMs > 0) return 'c0';
      if (u.swing > 0) return u.swing > 120 ? 'a0' : 'a1';
      if (s.time - sp.movedAt < 120 && u.stunMs <= 0) return `w${Math.floor(u.walk / step) % 4}` as PoseName;
      return 'idle';
    };
    const team = u.side === 'red' ? 'red' : 'blue';
    switch (u.kind) {
      case 'champion':
        key = champKey(u.champ!.id, team);
        frame = frameName(dirFor(u.facing), pose(11));
        cell = CHAMP_CELL;
        break;
      case 'minion':
        key = minionKey(team);
        frame = frameName(dirFor(u.facing), pose(8));
        cell = MINION_CELL;
        break;
      case 'camp': {
        const brute = u.campKind === 'ember' || u.campKind === 'moss';
        const wolf = u.campKind === 'wolf' || u.campKind === 'pup';
        const merc = u.campKind === 'merc';
        const drake = u.campKind === 'drake';
        // A drake's sheet is baked the first time a drake of its element shows.
        if (drake) bakeDrake(this, s.drakeElement);
        key = brute ? bruteKey(u.campKind as 'ember' | 'moss') : wolf ? WOLF : merc ? MERC_KEY : drake ? drakeKey(s.drakeElement) : BOAR;
        frame = frameName(dirFor(u.facing), pose(10) === 'c0' ? 'idle' : pose(10));
        cell = brute ? BRUTE_CELL : wolf ? WOLF_CELL : merc ? MERC_CELL : drake ? DRAKE_CELL : BOAR_CELL;
        break;
      }
      case 'watchstone':
        key = watchKey(u.side);
        cell = WATCH_CELL;
        break;
      case 'beast':
        // The elder form's sheet is baked the first time it shows.
        if (s.beastElder) bakeElder(this);
        key = s.beastElder ? ELDER_KEY : BEAST_KEY;
        frame = frameName(dirFor(u.facing), pose(14) === 'c0' ? 'idle' : pose(14));
        cell = BEAST_CELL;
        break;
      case 'inhibitor':
        key = u.dead ? RUBBLE : inhibKey(team);
        cell = u.dead ? RUBBLE_CELL : INHIB_CELL;
        break;
      case 'tower':
        key = u.dead ? RUBBLE : towerKey(team);
        cell = u.dead ? RUBBLE_CELL : TOWER_CELL;
        break;
      default:
        key = nexusKey(team);
        cell = NEXUS_CELL;
    }
    const depth = 2 + fy / WORLD.h;
    // Super minions stand taller; the player's allies in a bush show through the grass.
    const scale = (u.kind === 'minion' && u.power > 1 ? 1.5 : u.kind === 'inhibitor' && u.dead ? 0.7 : u.campKind === 'pup' ? 0.72 : u.kind === 'beast' && s.beastElder ? 1.12 : 1) / RES;
    const inBush = u.kind === 'champion' && u.side === 'blue' && bushAt(u) >= 0;
    // Blue's champions in a bush or in stealth show through, half seen.
    const ghost = u.kind === 'champion' && u.side === 'blue' && stealthed(u) ? 0.38 : inBush ? 0.6 : 1;
    sp.main.setTexture(key, frame).setOrigin(0.5, cell.footY / cell.h).setPosition(u.x, fy).setDepth(depth).setScale(scale).setAlpha(ghost).setVisible(true);
    const marked = s.lastHitMark === u.id && u.kind === 'minion' && u.side === 'red';
    sp.outline.setVisible(marked);
    if (marked) sp.outline.setTexture(MINION_OUTLINE, frame).setOrigin(0.5, cell.footY / cell.h).setPosition(u.x, fy).setDepth(depth - 0.0001);
    const flash = !settings.reduceMotion && u.flash > 0 && !u.dead;
    sp.flash.setVisible(flash);
    if (flash) sp.flash.setTexture(key, frame).setOrigin(0.5, cell.footY / cell.h).setPosition(u.x, fy).setDepth(depth + 0.0001).setScale(scale).setAlpha(0.4 * (u.flash / 120));
  }

  /** A health bar above a unit. Shield shows as a pale strip over the health. */
  private drawBar(g: Phaser.GameObjects.Graphics, u: Unit, s: GameState, me: Unit | null) {
    if (u.kind === 'minion' && u.hp >= u.maxHp) return;
    const w = u.kind === 'nexus' ? 90 : u.kind === 'tower' || u.kind === 'beast' ? 64 : u.kind === 'inhibitor' ? 50 : u.kind === 'minion' ? 30 : 50;
    const h = u.kind === 'minion' ? 4 : 6;
    const x = u.x - w / 2;
    if (u.kind === 'watchstone' || u.kind === 'ward') return;
    const y = u.y + FOOT[u.kind] - headOf(u) - 10;
    const ratio = Math.max(0, u.hp / u.maxHp);
    const own = me !== null && u.side === me.side;
    g.fillStyle(col(UI.edge), 0.9).fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(0x2a2f3a, 1).fillRect(x, y, w, h);
    const fill = invulnerable(s, u) ? '#8a93a6' : own ? '#62d86f' : u.side === 'neutral' ? SIDE_COLOR.neutral : '#ec5a48';
    g.fillStyle(col(fill), 1).fillRect(x, y, w * ratio, h);
    g.fillStyle(0xffffff, 0.25).fillRect(x, y, w * ratio, 1.5);
    if (u.shield > 0) g.fillStyle(0xd6efff, 1).fillRect(x, y - 3, Math.min(w, (u.shield / u.maxHp) * w), 2);
    // An outer tower's plates, early on: gold pips over the bar, one per plate still on.
    if (u.plates > 0) {
      for (let i = 0; i < PLATING.count; i++) {
        const px = x + (i + 0.5) * (w / PLATING.count) - 4;
        g.fillStyle(col(UI.edge), 0.9).fillRect(px - 1, y - 7, 10, 5);
        g.fillStyle(col(i < u.plates ? UI.gold : '#3a4256'), 1).fillRect(px, y - 6, 8, 3);
      }
    }
    if (u.kind === 'champion') {
      // The level in a small slate badge at the bar's left.
      g.fillStyle(col(UI.slateDark), 1).fillRect(x - 13, y - 3, 12, 12);
      this.t(`lvl-${u.id}`, x - 7, y - 3, String(u.level), 9, UI.text, 'center', true, true);
      // The champion's own name over its bar.
      this.t(`cname-${u.id}`, u.x, y - 15, shortName(u.name), 10, u.side === 'red' ? '#ffb4a8' : '#cfe1ff', 'center', true, true);
      // A price on its head, from a kill streak.
      const bounty = bountyOf(u.killStreak);
      if (bounty) {
        g.fillStyle(col(UI.edge), 0.9).fillRect(u.x - 36, y - 30, 72, 13);
        g.fillStyle(col('#6b4f17'), 1).fillRect(u.x - 35, y - 29, 70, 11);
        this.t(`bounty-${u.id}`, u.x, y - 30, t('bountyLabel', { gold: bounty }), 9, UI.gold, 'center', true, true);
      }
      // The recall channel, filling under the bar.
      if (u.recallMs > 0) {
        g.fillStyle(col(UI.edge), 0.9).fillRect(x - 1, y + h + 2, w + 2, 5);
        const port = u.portTo !== 0, color = port ? spellById('teleport').color : '#9fd8ff';
        g.fillStyle(col(color), 1).fillRect(x, y + h + 3, w * (1 - u.recallMs / u.recallFull), 3);
        this.t(`recall-${u.id}`, u.x, y + h + 7, t(port ? 'teleportingLabel' : 'recallingLabel'), 9, color, 'center', true, true);
      }
    }
    if (u.stunMs > 0) this.t(`stun-${u.id}`, u.x, y - (u.kind === 'champion' ? 28 : 16), t('stunLabel'), 9, UI.gold, 'center', true, true);
  }

  /** A gold marker over the objective's target, with the reward, and a dashed ring round it. */
  private drawObjectiveMarker(g: Phaser.GameObjects.Graphics, s: GameState) {
    const o = s.objective;
    const tgt = o && getUnit(s, o.target);
    if (!o || !tgt || tgt.dead || this.hidden(s, tgt)) return;
    const fy = tgt.y + FOOT[tgt.kind];
    const bob = settings.reduceMotion ? 0 : Math.sin(s.time / 220) * 3;
    const y = fy - headOf(tgt) - (tgt.kind === 'champion' ? 30 : 18) + bob;
    const label = t('objectiveMarker', { gold: o.gold });
    const w = 128;
    g.fillStyle(col(UI.slateDark), 0.92).fillRect(tgt.x - w / 2, y - 22, w, 18);
    g.lineStyle(1.5, col(UI.gold), 1).strokeRect(tgt.x - w / 2, y - 22, w, 18);
    g.fillStyle(col(UI.gold), 1).fillTriangle(tgt.x - 6, y - 4, tgt.x + 6, y - 4, tgt.x, y + 4);
    this.t('obj-marker', tgt.x, y - 20, label, 11, UI.gold, 'center', true, true);
    const r = tgt.kind === 'tower' ? 44 : tgt.kind === 'nexus' ? 70 : tgt.kind === 'beast' ? 62 : tgt.radius + 14;
    const n = 16;
    g.lineStyle(2, col(UI.gold), 0.9);
    for (let i = 0; i < n; i += 1) {
      const a0 = (i / n) * Math.PI * 2 + s.time / (settings.reduceMotion ? Infinity : 1500);
      const a1 = a0 + Math.PI / n;
      g.beginPath();
      g.moveTo(tgt.x + Math.cos(a0) * r, fy + Math.sin(a0) * r * 0.58);
      g.lineTo(tgt.x + Math.cos(a1) * r, fy + Math.sin(a1) * r * 0.58);
      g.strokePath();
    }
  }

  private drawFx(g: Phaser.GameObjects.Graphics) {
    let coins = 0;
    for (const { f, left, ms } of this.liveFx) {
      const alpha = Math.max(0, left / ms);
      if (f.kind === 'skill') {
        drawSkill({ ground: this.groundG, top: g }, f, 1 - alpha);
      } else if (f.kind === 'ring') {
        g.lineStyle(4, col(f.color), alpha).strokeEllipse(f.x, f.y, f.r * 2, f.r * 1.2);
      } else if (f.kind === 'line') {
        g.lineStyle(4, col(f.color), alpha).lineBetween(f.x, f.y - 20, f.x2, f.y2 - 20);
      } else if (f.kind === 'arc') {
        g.lineStyle(5, col(f.color), alpha).beginPath();
        g.arc(f.x, f.y - 18, f.r, f.a - 0.9, f.a + 0.9, false);
        g.strokePath();
      } else {
        // The last-hit coin: it pops up and fades, with the gold it paid.
        const k = 1 - left / f.ms;
        const rise = settings.reduceMotion ? 18 : 14 + k * 30;
        const x = f.x;
        const y = f.y - rise - 18;
        this.coin(g, x - 16, y + 7, 7, Math.min(1, alpha * 2));
        this.t(`coin-${coins++}`, x - 6, y - 2, t('coinGold', { gold: f.gold }), 15, UI.gold, 'left', true, true, Math.min(1, alpha * 2));
      }
    }
  }

  /** A faceted gold coin drawn with the Graphics. */
  private coin(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, alpha = 1) {
    const pts = (rr: number) => Array.from({ length: 8 }, (_, i) => new Phaser.Math.Vector2(x + Math.cos((i * Math.PI) / 4 + Math.PI / 8) * rr, y + Math.sin((i * Math.PI) / 4 + Math.PI / 8) * rr));
    g.fillStyle(0x7a5418, alpha).fillPoints(pts2(pts(r + 1.2)), true);
    g.fillStyle(col(UI.goldDeep), alpha).fillPoints(pts2(pts(r)), true);
    g.fillStyle(col(UI.gold), alpha).fillPoints(pts2(pts(r * 0.68)), true);
    g.fillStyle(0xfff0b0, alpha * 0.9).fillTriangle(x - r * 0.6, y - r * 0.2, x - r * 0.2, y - r * 0.6, x, y);
  }

  // -------------------------------------------------------------------------------------------
  // The HUD: bevelled slate panels, gold trim, a system font.

  private t(key: string, x: number, y: number, str: string, size: number, color = UI.text, align: 'left' | 'center' | 'right' = 'left', bold = false, world = false, alpha = 1) {
    let obj = this.texts.get(key);
    if (!obj) {
      obj = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' });
      obj.setScrollFactor(world ? 1 : 0).setDepth(world ? 6 : 12);
      if (world) obj.setStroke('#1a1408', 3);
      this.texts.set(key, obj);
    }
    const xo = align === 'center' ? 0.5 : align === 'right' ? 1 : 0;
    // Only touch what changed: a new colour or string re-renders the text's canvas.
    if (obj.originX !== xo) obj.setOrigin(xo, 0);
    obj.setPosition(x, y).setVisible(true).setAlpha(alpha);
    if (obj.style.color !== color) obj.setColor(color);
    // A key shown at another size or weight than before (the upgrade cards, two or three).
    if (obj.style.fontSize !== `${size}px`) obj.setFontSize(size);
    if (obj.style.fontStyle !== (bold ? 'bold' : 'normal')) obj.setFontStyle(bold ? 'bold' : 'normal');
    if (obj.text !== str) obj.setText(str);
    this.used.add(key);
  }

  /** A bevelled panel: a dark rim, a lit top-left edge and a shaded bottom-right edge. */
  private panel(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill = UI.slate, alpha = 1) {
    g.fillStyle(col(UI.edge), alpha).fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(col(UI.slateDark), alpha).fillRect(x, y, w, h);
    g.fillStyle(col(UI.slateLight), alpha).fillRect(x, y, w - 2, h - 2);
    g.fillStyle(col(fill), alpha).fillRect(x + 2, y + 2, w - 4, h - 4);
  }

  /** A gold-framed box, as round the abilities and the upgrade badges. */
  private goldFrame(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, bright: boolean) {
    g.fillStyle(col(UI.edge), 1).fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(col(bright ? UI.gold : UI.goldDeep), 1).fillRect(x, y, w, h);
    g.fillStyle(col('#7a5418'), 1).fillRect(x + 2, y + 2, w - 2, h - 2);
    g.fillStyle(col('#1d2330'), 1).fillRect(x + 3, y + 3, w - 6, h - 6);
  }

  private drawHud() {
    const g = this.hudG;
    g.clear();
    const pick = this.phase === 'pick';
    this.pickBg.setVisible(pick);
    this.pickImages.forEach((img) => img.setVisible(pick));
    this.portrait.setVisible(false);
    if (pick) this.drawPick(g);
    else if (this.state) this.drawPlaying(g, this.state);
    if (!pick) this.drawStick(g);
    for (const [key, obj] of this.texts) {
      if (this.used.has(key)) continue;
      // A label over a unit that is gone (a minion stunned once, last match's champions) goes too.
      const id = UNIT_TEXT.exec(key)?.[1];
      if (id !== undefined && !(this.state && getUnit(this.state, Number(id)))) {
        obj.destroy();
        this.texts.delete(key);
      } else obj.setVisible(false);
    }
  }

  private drawPick(g: Phaser.GameObjects.Graphics) {
    this.t('title', SCREEN.w / 2, FRAME.y + 12, t('gameTitle'), 32, UI.gold, 'center', true);
    this.t('sub', SCREEN.w / 2, FRAME.y + 52, t(this.quick ? 'pickSubQuick' : 'pickSub'), 12, UI.dim, 'center');
    CHAMPIONS.forEach((c, i) => {
      const r = pickCard(i);
      const hover = this.hoverPick === i;
      this.panel(g, r.x, r.y, r.w, r.h, hover ? '#3a4660' : UI.card);
      g.fillStyle(col(c.color), 1).fillRect(r.x + 2, r.y + 2, r.w - 4, 4);
      g.fillStyle(col('#3b7be8'), 0.25).fillEllipse(r.x + r.w / 2, r.y + 56, 50, 14);
      g.lineStyle(2, col('#3b7be8'), 0.9).strokeEllipse(r.x + r.w / 2, r.y + 56, 50, 14);
      this.t(`pick-name-${i}`, r.x + r.w / 2, r.y + 60, t(c.hero), t(c.hero).length > 18 ? 11 : 12, UI.text, 'center', true);
      this.t(`pick-role-${i}`, r.x + r.w / 2, r.y + 75, `${t(c.name)} · ${t(c.role)}`.toUpperCase(), 9, c.color, 'center', true);
      this.t(`pick-pas-${i}`, r.x + r.w / 2, r.y + 87, t(c.passive.name), 10, UI.gold, 'center', true);
      this.t(`pick-desc-${i}`, r.x + r.w / 2, r.y + 100, t(c.passive.desc), 9, UI.dim, 'center');
      // Mastery: one gold diamond per rank in the card's top right corner.
      const rank = masteryRank(this.mastery[c.id] ?? 0);
      for (let k = 0; k < rank; k++) {
        const dx = r.x + r.w - 10 - k * 11, dy = r.y + 15;
        g.fillStyle(col(UI.goldDeep), 1).fillPoints(pts2([{ x: dx, y: dy - 5 }, { x: dx + 5, y: dy }, { x: dx, y: dy + 5 }, { x: dx - 5, y: dy }]), true);
        g.fillStyle(col(UI.gold), 1).fillPoints(pts2([{ x: dx, y: dy - 3.5 }, { x: dx + 3.5, y: dy }, { x: dx, y: dy + 3.5 }, { x: dx - 3.5, y: dy }]), true);
      }
    });
    // The champion under the pointer: who they are and what they play like, then why they fight.
    const h = CHAMPIONS[this.hoverPick];
    // A spell chip under the pointer: its name and what it does, in the champion's two lines.
    const hs = this.hoverSpell ? spellById(this.spell) : null;
    if (this.hoverMode) {
      this.t('pick-blurb', SCREEN.w / 2, FRAME.y + 444, t(this.quick ? 'pickModeQuick' : 'pickModeFull'), 12, UI.gold, 'center', true);
      this.t('pick-motive', SCREEN.w / 2, FRAME.y + 464, t(this.quick ? 'pickModeQuickDesc' : 'pickModeFullDesc'), 12, UI.text, 'center', true);
    } else if (hs) {
      this.t('pick-blurb', SCREEN.w / 2, FRAME.y + 444, t(hs.name), 12, hs.color, 'center', true);
      this.t('pick-motive', SCREEN.w / 2, FRAME.y + 464, t(hs.desc), 12, UI.text, 'center', true);
    } else {
      const line = h && t('pickBlurb', { hero: t(h.hero), title: t(h.title), class: t(h.name), blurb: t(h.blurb) });
      this.t('pick-blurb', SCREEN.w / 2, FRAME.y + 444, h ? (h.perk ? t('pickPerk', { line, perk: t(h.perk.desc) }) : line) : t('pickPoint'), 12, h ? h.color : UI.muted, 'center', true);
      this.t('pick-motive', SCREEN.w / 2, FRAME.y + 464, h ? t(h.motive) : t('pickSetting'), 12, h ? UI.text : UI.dim, 'center', true);
    }
    // The battle spell to take along, one button: a click picks the next. One text, like the line it
    // replaced, so the pick screen makes as many texts (and Math.random draws) as before.
    const sb = SPELL_PICK;
    const chosen = spellById(this.spell);
    this.panel(g, sb.x, sb.y, sb.w, sb.h, this.hoverSpell ? '#3a4660' : UI.card);
    g.lineStyle(1.5, col(UI.goldDeep), 1).strokeRect(sb.x + 1, sb.y + 1, sb.w - 2, sb.h - 2);
    g.fillStyle(col(chosen.color), 1).fillCircle(sb.x + 12, sb.y + sb.h / 2, 5);
    this.t('pick-spell', sb.x + sb.w / 2 + 6, sb.y + 4, t('pickSpellLine', { spell: t(chosen.name) }), 10, UI.gold, 'center', true);
    // The match kind, full or quick. The two hint lines share one text, so the pick screen still
    // makes as many texts as before.
    const mb = MODE_PICK;
    this.panel(g, mb.x, mb.y, mb.w, mb.h, this.hoverMode ? '#3a4660' : UI.card);
    g.lineStyle(1.5, col(UI.goldDeep), 1).strokeRect(mb.x + 1, mb.y + 1, mb.w - 2, mb.h - 2);
    this.t('pick-mode', mb.x + mb.w / 2, mb.y + 4, t(this.quick ? 'pickModeQuick' : 'pickModeFull'), 10, UI.gold, 'center', true);
    this.t('hint', SCREEN.w / 2, FRAME.y + 509, `${t('pickHint1')}\n${t('pickHint2')}`, 11, UI.dim, 'center');
    this.texts.get('hint')?.setAlign('center').setLineSpacing(1);
  }

  private drawPlaying(g: Phaser.GameObjects.Graphics, s: GameState) {
    const me = this.player();
    if (!me || !me.champ) return;
    // Once the match is over only the end panel shows: the bars' texts and the portrait sit above
    // the HUD graphics, so they would stay lit through the panel's dimming.
    if (s.phase !== 'playing') return this.drawEnd(g, s);
    this.drawTopBar(g, s, me);
    // The shop panel and the scoreboard cover the objective card, so the card steps aside while one is open.
    const score = this.scoreOpen;
    if (!this.shopOpen && !score) {
      if (!watching) this.drawObjectiveCard(g, s);
      this.drawBuffs(g, s);
      this.drawNotice(g, s);
      if (!watching && me.dead) this.drawRecap(g, s);
    }
    this.drawBottomBar(g, s, me);
    this.drawMinimap(g, s, me);
    if (score) this.drawScoreboard(g, s);
    else if (this.shopOpen) this.drawShop(g, me);
  }

  /** The scoreboard: every champion's level, kills, deaths and assists, last hits and items, by team. */
  private drawScoreboard(g: Phaser.GameObjects.Graphics, s: GameState) {
    const p = SCORE_PANEL;
    this.panel(g, p.x, p.y, p.w, p.h, UI.slate);
    g.fillStyle(col(UI.gold), 1).fillRect(p.x + 2, p.y + 2, p.w - 4, 3);
    this.t('score-title', p.x + 16, p.y + 8, t('scoreboard'), 18, UI.gold, 'left', true);
    this.t('score-hint', p.x + p.w - 16, p.y + 14, t('scoreHint'), 11, UI.dim, 'right');
    if (!watching) {
      // Surrender: when it may be called, else from when.
      const b = surrenderButton();
      const ready = s.time >= s.voteReadyAt;
      this.panel(g, b.x, b.y, b.w, b.h, ready ? '#5a3a3a' : UI.card);
      const label = ready ? t('surrenderCall') : s.vote ? t('surrenderAgainIn', { time: clock(s.voteReadyAt - s.time) }) : t('surrenderIn', { time: clock(s.voteReadyAt) });
      this.t('score-surrender', b.x + b.w / 2, b.y + 5, label, 11, ready ? UI.text : UI.muted, 'center', true);
    }
    const cols = { name: p.x + 26, level: p.x + 262, kda: p.x + 352, cs: p.x + 440, items: p.x + 494, state: p.x + 632 };
    (['blue', 'red'] as const).forEach((team, ti) => {
      const champs = s.units.filter((u) => u.kind === 'champion' && u.side === team);
      const y0 = p.y + 40 + ti * 164;
      const kills = champs.reduce((n, u) => n + u.kills, 0);
      this.t(`score-team-${team}`, cols.name - 10, y0, t(team === 'blue' ? 'scoreBlue' : 'scoreRed', { kills: t('kills', { n: kills }) }), 12, SIDE_COLOR[team], 'left', true);
      this.t(`score-hl-${team}`, cols.level, y0 + 1, t('scoreLevel'), 10, UI.muted, 'center');
      this.t(`score-hk-${team}`, cols.kda, y0 + 1, t('scoreKda'), 10, UI.muted, 'center');
      this.t(`score-hc-${team}`, cols.cs, y0 + 1, t('scoreCs'), 10, UI.muted, 'center');
      this.t(`score-hi-${team}`, cols.items, y0 + 1, t('scoreItems'), 10, UI.muted);
      champs.forEach((u, i) => {
        const y = y0 + 20 + i * 27;
        const me = u.id === s.player;
        this.panel(g, p.x + 12, y, p.w - 24, 24, me ? '#3a4660' : UI.card);
        g.fillStyle(col(u.champ!.color), 1).fillRect(p.x + 14, y + 2, 4, 20);
        const name = `${shortName(u.name)} · ${t(u.champ!.name)}`;
        this.t(`score-name-${u.id}`, cols.name, y + 5, me && !watching ? t('scoreYou', { name }) : name, 12, u.dead ? UI.muted : me ? UI.gold : UI.text, 'left', me);
        this.t(`score-lv-${u.id}`, cols.level, y + 5, String(u.level), 12, UI.gold, 'center', true);
        this.t(`score-kda-${u.id}`, cols.kda, y + 5, `${u.kills} / ${u.deaths} / ${u.assists}`, 12, UI.text, 'center', true);
        this.t(`score-cs-${u.id}`, cols.cs, y + 5, String(u.cs), 12, UI.dim, 'center');
        for (let k = 0; k < MAX_ITEMS; k++) {
          const x = cols.items + k * 20, iy = y + 4;
          g.fillStyle(col(UI.edge), 1).fillRect(x, iy, 17, 17);
          g.fillStyle(col('#1d2330'), 1).fillRect(x + 1, iy + 1, 15, 15);
          const item = ITEMS.find((it) => it.id === u.items[k]);
          if (!item) continue;
          const cx = x + 8.5, cy = iy + 8.5;
          g.fillStyle(col(itemTint(item)), 1).fillPoints([new Phaser.Math.Vector2(cx, cy - 6), new Phaser.Math.Vector2(cx + 6, cy), new Phaser.Math.Vector2(cx, cy + 6), new Phaser.Math.Vector2(cx - 6, cy)], true);
          if (item.from) g.lineStyle(1, col(UI.gold), 1).strokeRect(x + 1, iy + 1, 15, 15);
        }
        const bounty = bountyOf(u.killStreak);
        const state = u.dead ? t('respawnIn', { n: Math.max(0, Math.ceil((u.respawnAt - s.time) / 1000)) }) : bounty ? t('bountyLabel', { gold: bounty }) : '';
        this.t(`score-state-${u.id}`, cols.state, y + 6, state, 11, u.dead ? UI.red : UI.gold, 'left', true);
      });
    });
  }

  private drawTopBar(g: Phaser.GameObjects.Graphics, s: GameState, me: Unit) {
    this.panel(g, TOP_BAR.x, TOP_BAR.y, TOP_BAR.w, TOP_BAR.h);
    this.coin(g, 20, 17, 8);
    this.t('gold', 34, 8, formatNumber(Math.floor(me.gold)), 16, UI.gold, 'left', true);
    // The last-hit streak chip.
    if (s.streak > 0) {
      const c = STREAK_CHIP;
      const hot = s.streak >= STREAK.at;
      g.fillStyle(col(UI.edge), 1).fillRect(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
      g.fillStyle(col(hot ? '#6b4f17' : '#3a4256'), 1).fillRect(c.x, c.y, c.w, c.h);
      g.lineStyle(1, col(hot ? UI.gold : UI.goldDeep), 1).strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
      g.fillStyle(col(UI.gold), 1).fillPoints(
        [[6, 0], [1, 9], [5, 9], [3, 16], [10, 6], [6, 6], [8, 0]].map(([x, y]) => new Phaser.Math.Vector2(c.x + 6 + x, c.y + 3 + y)),
        true,
      );
      this.t('streak', c.x + 22, c.y + 4, hot ? t('streakHot', { n: s.streak, pct: Math.round(STREAK.bonus * 100) }) : t('streak', { n: s.streak }), 11, hot ? UI.gold : UI.text, 'left', true);
    }
    if (!watching) this.drawRecallButton(g, s, me);
    if (!watching) this.drawSpellButton(g, me);
    // The kill score, blue against red; a tap opens the scoreboard.
    const kills = (team: Team) => s.units.reduce((n, u) => n + (u.kind === 'champion' && u.side === team ? u.kills : 0), 0);
    const k = SCORE_CHIP;
    g.fillStyle(col(UI.edge), 1).fillRect(k.x, k.y, k.w, k.h);
    g.fillStyle(col(this.scoreOpen ? '#33405a' : '#1b212d'), 1).fillRect(k.x + 1, k.y + 1, k.w - 2, k.h - 2);
    this.t('kills-blue', k.x + k.w / 2 - 7, k.y + 5, String(kills('blue')), 14, UI.blue, 'right', true);
    this.t('kills-dash', k.x + k.w / 2, k.y + 5, ':', 14, UI.dim, 'center', true);
    this.t('kills-red', k.x + k.w / 2 + 7, k.y + 5, String(kills('red')), 14, UI.red, 'left', true);
    const nexus = (team: Team) => s.units.find((u) => u.kind === 'nexus' && u.side === team)!;
    const pct = (u: Unit) => Math.max(0, Math.ceil((u.hp / u.maxHp) * 100));
    this.t('nexus-blue', 232, 9, t('blueNexus', { pct: pct(nexus('blue')) }), 14, UI.blue, 'left', true);
    this.t('nexus-red', SCREEN.w - 12, 9, t('redNexus', { pct: pct(nexus('red')) }), 14, UI.red, 'right', true);
    // The clock in its own sunken box.
    g.fillStyle(col(UI.edge), 1).fillRect(SCREEN.w / 2 - 38, 3, 76, 28);
    g.fillStyle(col('#1b212d'), 1).fillRect(SCREEN.w / 2 - 37, 4, 74, 26);
    const mins = Math.floor(s.time / 60000);
    const secs = Math.floor((s.time % 60000) / 1000);
    this.drawSky(g, SCREEN.w / 2 - 28, 17, nightness(s.time));
    this.t('clock', SCREEN.w / 2 + 5, 8, `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`, 16, UI.text, 'center', true);
  }

  /** A small sun by day and a crescent moon by night, at (x, y), beside the clock. */
  private drawSky(g: Phaser.GameObjects.Graphics, x: number, y: number, dark: number) {
    if (dark < 0.5) {
      g.fillStyle(col('#f2c14e'), 1).fillCircle(x, y, 4);
      g.lineStyle(1.5, col('#f2c14e'), 1);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.lineBetween(x + Math.cos(a) * 6, y + Math.sin(a) * 6, x + Math.cos(a) * 8, y + Math.sin(a) * 8);
      }
    } else {
      g.fillStyle(col('#cfd8ff'), 1).fillCircle(x, y, 6);
      g.fillStyle(col('#1b212d'), 1).fillCircle(x + 3, y - 2, 5);
    }
  }

  /** Recall home while alive (filling as it channels); while dead, buy back at a price, or when it is next allowed. */
  private drawRecallButton(g: Phaser.GameObjects.Graphics, s: GameState, me: Unit) {
    const b = RECALL_BUTTON;
    if (me.dead) {
      const cost = buybackCost(me);
      const ready = s.time >= me.buybackReadyAt;
      const can = ready && me.gold >= cost;
      this.panel(g, b.x, b.y, b.w, b.h, can ? '#6b4f17' : '#3a4256');
      if (can) this.coin(g, b.x + 12, b.y + b.h / 2, 6);
      this.t('recall', b.x + b.w / 2 + (can ? 6 : 0), b.y + 6, ready ? t('buyBack', { gold: cost }) : t('buyBackIn', { time: clock(me.buybackReadyAt - s.time) }), 11, can ? UI.gold : UI.muted, 'center', true);
      return;
    }
    const on = me.recallMs > 0;
    this.panel(g, b.x, b.y, b.w, b.h, on ? '#2f4f6b' : '#33405a');
    if (on) g.fillStyle(col(me.portTo ? spellById('teleport').color : '#9fd8ff'), 0.45).fillRect(b.x + 2, b.y + 2, (b.w - 4) * (1 - me.recallMs / me.recallFull), b.h - 4);
    const secs = formatNumber(me.recallMs / 1000, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    this.t('recall', b.x + b.w / 2, b.y + 6, on ? t(me.portTo ? 'teleportingFor' : 'recallingFor', { s: secs }) : t('recallHome'), 11, on ? UI.text : UI.dim, 'center', true);
  }

  /** The battle spell: its colour, name and key while ready, the time left while it cools down. */
  private drawSpellButton(g: Phaser.GameObjects.Graphics, me: Unit) {
    if (!me.spell) return;
    const b = SPELL_BUTTON;
    const def = spellById(me.spell);
    const ready = me.spellCd <= 0 && !me.dead;
    this.panel(g, b.x, b.y, b.w, b.h, ready ? '#33405a' : '#262d3b');
    if (me.spellCd > 0) g.fillStyle(col(def.color), 0.25).fillRect(b.x + 2, b.y + 2, (b.w - 4) * (1 - me.spellCd / def.cd), b.h - 4);
    g.fillStyle(col(def.color), ready ? 1 : 0.45).fillCircle(b.x + 12, b.y + b.h / 2, 5);
    const label = me.spellCd > 0 ? t('spellIn', { spell: t(def.name), time: clock(me.spellCd) }) : t('spellReady', { spell: t(def.name) });
    this.t('spell', b.x + b.w / 2 + 8, b.y + 6, label, 11, ready ? UI.text : UI.muted, 'center', true);
  }

  private drawObjectiveCard(g: Phaser.GameObjects.Graphics, s: GameState) {
    const c = OBJECTIVE_CARD;
    this.panel(g, c.x, c.y, c.w, c.h, UI.slate, 0.94);
    g.fillStyle(col(UI.gold), 1).fillRect(c.x + 3, c.y + 4, 3, c.h - 8);
    const o = s.objective;
    if (o) {
      const target = getUnit(s, o.target);
      // Out of blue's sight, the bar keeps the damage last seen.
      if (!target || !this.hidden(s, target)) this.objSeen = { id: o.target, progress: target ? 1 - Math.max(0, target.hp) / target.maxHp : 1 };
      const progress = this.objSeen.id === o.target ? this.objSeen.progress : 0;
      this.t('obj-head', c.x + 14, c.y + 6, t('objectiveHead'), 10, UI.gold, 'left', true);
      this.t('obj-time', c.x + c.w - 10, c.y + 6, t('objectiveLeft', { time: clock(o.endsAt - s.time) }), 10, UI.dim, 'right', true);
      this.t('obj-title', c.x + 14, c.y + 20, objectiveTitle(o), 14, UI.text, 'left', true);
      g.fillStyle(0x151a24, 1).fillRect(c.x + 14, c.y + 46, 92, 6);
      g.fillStyle(col(UI.gold), 1).fillRect(c.x + 14, c.y + 46, 92 * progress, 6);
      this.t('obj-reward', c.x + c.w - 10, c.y + 42, t(o.banner ? 'objectiveRewardBanner' : 'objectiveReward', { gold: o.gold }), 11, UI.gold, 'right', true);
    } else {
      const last = s.lastObjective;
      this.t('obj-head', c.x + 14, c.y + 6, t(last ? (last.done ? 'objectiveDone' : 'objectiveMissed') : 'objectiveHead'), 10, last && !last.done ? UI.muted : UI.green, 'left', true);
      this.t('obj-title', c.x + 14, c.y + 20, last ? objectiveTitle(last) : '', 14, UI.dim, 'left', true);
      this.t('obj-reward', c.x + 14, c.y + 42, last?.done ? t('nextGoalPaid', { time: clock(s.nextObjectiveAt - s.time), gold: last.gold }) : t('nextGoal', { time: clock(s.nextObjectiveAt - s.time) }), 11, UI.dim, 'left');
    }
    if (s.time < s.siegeUntil) {
      const y = c.y + c.h + 6;
      g.fillStyle(col(UI.edge), 1).fillRect(c.x - 1, y - 1, 182, 20);
      g.fillStyle(col('#6b4f17'), 1).fillRect(c.x, y, 180, 18);
      g.fillStyle(col(UI.gold), 1).fillTriangle(c.x + 8, y + 3, c.x + 18, y + 3, c.x + 8, y + 10);
      g.fillStyle(col(UI.goldDeep), 1).fillRect(c.x + 7, y + 3, 1.5, 13);
      this.t('siege', c.x + 24, y + 3, t('siegeBanner', { pct: Math.round((SIEGE.mult - 1) * 100), time: clock(s.siegeUntil - s.time) }), 10, UI.gold, 'left', true);
    }
  }

  /** A chip for each team whose minions the guardian beast empowered, and one for each team with the elder blessing, with the time left. */
  private drawBuffs(g: Phaser.GameObjects.Graphics, s: GameState) {
    let i = 0;
    for (const team of ['blue', 'red'] as Team[]) {
      const left = s.beastBuff[team] - s.time;
      if (left <= 0) continue;
      const c = buffChip(i++);
      g.fillStyle(col(UI.edge), 1).fillRect(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
      g.fillStyle(col('#3b2f5c'), 1).fillRect(c.x, c.y, c.w, c.h);
      g.lineStyle(1, col(SIDE_COLOR[team]), 1).strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
      // A small violet crystal, the beast's.
      const cx = c.x + 12, cy = c.y + c.h / 2;
      g.fillStyle(0xb98cff, 1).fillPoints([new Phaser.Math.Vector2(cx, cy - 7), new Phaser.Math.Vector2(cx + 5, cy), new Phaser.Math.Vector2(cx, cy + 7), new Phaser.Math.Vector2(cx - 5, cy)], true);
      g.fillStyle(0xffffff, 0.45).fillTriangle(cx, cy - 7, cx - 5, cy, cx, cy);
      this.t(`buff-${team}`, c.x + 24, c.y + 4, t(team === 'blue' ? 'minionsEmpoweredBlue' : 'minionsEmpoweredRed', { time: clock(left) }), 10, team === 'blue' ? UI.blue : UI.red, 'left', true);
    }
    // Comeback help: while blue is behind, its kills pay more.
    if (!watching && behind(s, 'blue', COMEBACK.gap)) {
      const c = buffChip(i++);
      g.fillStyle(col(UI.edge), 1).fillRect(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
      g.fillStyle(col('#1f3346'), 1).fillRect(c.x, c.y, c.w, c.h);
      g.lineStyle(1, col(SIDE_COLOR.blue), 1).strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
      // An arrow climbing back up.
      const cx = c.x + 12, cy = c.y + c.h / 2;
      g.fillStyle(col('#9fd8ff'), 1).fillTriangle(cx, cy - 7, cx - 5, cy - 1, cx + 5, cy - 1);
      g.fillRect(cx - 2, cy - 1, 4, 7);
      this.t('comeback', c.x + 24, c.y + 4, t('comebackChip', { gold: COMEBACK.gold }), 10, '#9fd8ff', 'left', true);
    }
    // Each team's drake stacks: a gem per drake in its element's colour, and the soul once it has it.
    for (const team of ['blue', 'red'] as Team[]) {
      const stacks = s.drakeStacks[team];
      if (!stacks.length) continue;
      const c = buffChip(i++);
      const soul = stacks.length >= DRAKE.soul;
      g.fillStyle(col(UI.edge), 1).fillRect(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
      g.fillStyle(col(soul ? '#4a3a1c' : '#23303f'), 1).fillRect(c.x, c.y, c.w, c.h);
      g.lineStyle(1, col(SIDE_COLOR[team]), 1).strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
      stacks.forEach((e, k) => {
        const cx = c.x + 10 + k * 11, cy = c.y + c.h / 2;
        g.fillStyle(col(DRAKES[e].color), 1).fillPoints([new Phaser.Math.Vector2(cx, cy - 6), new Phaser.Math.Vector2(cx + 4, cy), new Phaser.Math.Vector2(cx, cy + 6), new Phaser.Math.Vector2(cx - 4, cy)], true);
      });
      const key = soul ? (team === 'blue' ? 'drakeSoulBlue' : 'drakeSoulRed') : team === 'blue' ? 'drakesBlue' : 'drakesRed';
      this.t(`drakes-${team}`, c.x + 12 + stacks.length * 11, c.y + 4, t(key, { n: stacks.length }), 10, soul ? UI.gold : team === 'blue' ? UI.blue : UI.red, 'left', true);
    }
    // The elder's blessing, in gold.
    for (const team of ['blue', 'red'] as Team[]) {
      const left = s.elderBuff[team] - s.time;
      if (left <= 0) continue;
      const c = buffChip(i++);
      g.fillStyle(col(UI.edge), 1).fillRect(c.x - 1, c.y - 1, c.w + 2, c.h + 2);
      g.fillStyle(col('#4a3a1c'), 1).fillRect(c.x, c.y, c.w, c.h);
      g.lineStyle(1, col(SIDE_COLOR[team]), 1).strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
      const cx = c.x + 12, cy = c.y + c.h / 2;
      g.fillStyle(0xffc93d, 1).fillPoints([new Phaser.Math.Vector2(cx, cy - 7), new Phaser.Math.Vector2(cx + 5, cy), new Phaser.Math.Vector2(cx, cy + 7), new Phaser.Math.Vector2(cx - 5, cy)], true);
      g.fillStyle(0xffffff, 0.45).fillTriangle(cx, cy - 7, cx - 5, cy, cx, cy);
      this.t(`elder-${team}`, c.x + 24, c.y + 4, t(team === 'blue' ? 'elderBlessingBlue' : 'elderBlessingRed', { time: clock(left) }), 10, UI.gold, 'left', true);
    }
  }

  /** The newest notice (the beast woke, an inhibitor fell, a gank), for four seconds. */
  private drawNotice(g: Phaser.GameObjects.Graphics, s: GameState) {
    const n = s.notices[s.notices.length - 1];
    if (!n || s.time - n.at > 4000) return;
    const alpha = Math.min(1, (4000 - (s.time - n.at)) / 500);
    const w = Math.min(440, 40 + n.text.length * 6.4);
    const x = SCREEN.w / 2 - w / 2, y = 42;
    g.fillStyle(col(UI.edge), 0.9 * alpha).fillRect(x - 1, y - 1, w + 2, 24);
    g.fillStyle(col(UI.slateDark), 0.92 * alpha).fillRect(x, y, w, 22);
    g.fillStyle(col(n.color), alpha).fillRect(x, y, 3, 22);
    g.fillStyle(col(n.color), alpha).fillRect(x + w - 3, y, 3, 22);
    this.t('notice', SCREEN.w / 2, y + 4, n.text, 12, UI.text, 'center', true, false, alpha);
  }

  /** Who a unit is in the death recap: a champion by its first name, anything else by what it is. */
  private recapName(s: GameState, id: number, kind: Unit['kind']): string {
    const u = id >= 0 ? getUnit(s, id) : undefined;
    if (u?.kind === 'champion') return shortName(u.name);
    if (u?.kind === 'camp' && u.campKind) return t(CAMP_KINDS[u.campKind].name);
    const k = u?.kind ?? kind;
    return t(k === 'tower' ? 'recapTower' : k === 'beast' ? 'recapBeast' : k === 'camp' ? 'recapCamp' : 'recapMinions');
  }

  /**
   * The death recap, while the player's champion is dead: who slew it, the damage it took in its
   * last seconds, and the biggest parts of it by attacker and hit, each with a bar.
   */
  private drawRecap(g: Phaser.GameObjects.Graphics, s: GameState) {
    const r = s.recap;
    if (!r) return;
    const w = 330, x = SCREEN.w / 2 - w / 2, y = 72, h = 46 + r.rows.length * 24;
    this.panel(g, x, y, w, h, UI.slate, 0.94);
    g.fillStyle(col(UI.red), 1).fillRect(x + 2, y + 2, w - 4, 3);
    const killer = getUnit(s, r.killer);
    this.t('recap-title', x + 12, y + 9, t('recapTitle', { name: this.recapName(s, r.killer, killer?.kind ?? 'minion') }), 14, UI.text, 'left', true);
    this.t('recap-total', x + w - 12, y + 11, t('recapTotal', { n: formatNumber(Math.round(r.total)), s: RECAP.windowMs / 1000 }), 10, UI.dim, 'right');
    r.rows.forEach((row, i) => {
      const ry = y + 34 + i * 24;
      const src = row.src >= 0 ? getUnit(s, row.src) : undefined;
      const side = src?.side ?? 'red';
      const how =
        row.how === 'attack' ? t('recapAttacks')
        : row.how === 'spell' ? (src?.spell ? t(spellById(src.spell).name) : t('recapAttacks'))
        : t(src ? abilityFor(src, row.how)?.name ?? 'recapAttacks' : 'recapAttacks');
      const share = r.total > 0 ? row.amount / r.total : 0;
      g.fillStyle(col(UI.edge), 1).fillRect(x + 10, ry, w - 20, 20);
      g.fillStyle(col(UI.card), 1).fillRect(x + 11, ry + 1, w - 22, 18);
      g.fillStyle(col(SIDE_COLOR[side]), 0.35).fillRect(x + 11, ry + 1, (w - 22) * share, 18);
      g.fillStyle(col(SIDE_COLOR[side]), 1).fillRect(x + 11, ry + 1, 3, 18);
      this.t(`recap-row-${i}`, x + 20, ry + 3, `${this.recapName(s, row.src, row.kind)} · ${how}`, 11, UI.text, 'left', true);
      this.t(`recap-amt-${i}`, x + w - 18, ry + 3, formatNumber(Math.round(row.amount)), 11, UI.gold, 'right', true);
    });
  }

  /** The ping buttons: each ping's sign and key; an armed one lights up until the map is pressed. */
  private drawPingButtons(g: Phaser.GameObjects.Graphics) {
    PING_KINDS.forEach((kind, i) => {
      const b = pingButton(i);
      const armed = this.pingArmed === kind;
      if (armed) this.goldFrame(g, b.x, b.y, b.w, b.h, true);
      else this.panel(g, b.x, b.y, b.w, b.h, UI.card);
      this.pingSign(g, kind, b.x + b.w / 2 - 2, b.y + b.h / 2 - 2, 9, PINGS[kind].color, 1);
      this.t(`ping-key-${i}`, b.x + b.w - 3, b.y + b.h - 12, PING_KEYS[i], 9, UI.dim, 'right', true);
    });
  }

  private drawBottomBar(g: Phaser.GameObjects.Graphics, s: GameState, me: Unit) {
    const c = me.champ!;
    this.panel(g, BOTTOM_BAR.x, BOTTOM_BAR.y, BOTTOM_BAR.w, BOTTOM_BAR.h);
    if (!watching) this.drawPingButtons(g);
    // The champion: a portrait figure, name, level, health and experience.
    const P = PORTRAIT;
    this.panel(g, P.x, P.y, P.w, P.h, UI.card);
    g.fillStyle(col('#3b7be8'), 0.25).fillEllipse(P.x + 40, P.y + 92, 56, 18);
    g.lineStyle(2, col('#3b7be8'), 0.9).strokeEllipse(P.x + 40, P.y + 92, 56, 18);
    this.portrait
      .setTexture(champKey(c.id, 'blue'), frameName(2, me.castMs > 0 ? 'c0' : me.swing > 0 ? 'a1' : 'idle'))
      .setOrigin(0.5, CHAMP_CELL.footY / CHAMP_CELL.h)
      .setPosition(P.x + 40, P.y + 92)
      .setScale(1.2 / RES)
      .setAlpha(me.dead ? 0.4 : 1)
      .setVisible(true);
    const bx = P.x + 82;
    const bw = P.w - 92;
    this.t('name', bx, P.y + 6, shortName(me.name), 15, UI.text, 'left', true);
    this.t('lv', P.x + P.w - 10, P.y + 8, t('level', { n: me.level }), 12, UI.gold, 'right', true);
    g.fillStyle(0x151a24, 1).fillRect(bx, P.y + 28, bw, 11);
    g.fillStyle(col('#62d86f'), 1).fillRect(bx, P.y + 28, bw * Math.max(0, me.hp / me.maxHp), 11);
    g.fillStyle(0xffffff, 0.25).fillRect(bx, P.y + 28, bw * Math.max(0, me.hp / me.maxHp), 2);
    this.t('hp', bx + bw / 2, P.y + 28, `${formatNumber(Math.max(0, Math.ceil(me.hp)))} / ${formatNumber(me.maxHp)}`, 9, UI.text, 'center', true);
    const xpFloor = XP_FOR_LEVEL[me.level - 1] ?? 0;
    const xpNext = XP_FOR_LEVEL[me.level] ?? XP_FOR_LEVEL[MAX_LEVEL - 1];
    const xpRatio = me.level >= MAX_LEVEL ? 1 : (me.xp - xpFloor) / (xpNext - xpFloor);
    g.fillStyle(0x151a24, 1).fillRect(bx, P.y + 43, bw, 5);
    g.fillStyle(col(UI.gold), 1).fillRect(bx, P.y + 43, bw * Math.max(0, Math.min(1, xpRatio)), 5);
    // The bag: six slots, each owned item a gem in its colour.
    for (let i = 0; i < MAX_ITEMS; i++) {
      const x = bx + i * 20, y = P.y + 52;
      g.fillStyle(col(UI.edge), 1).fillRect(x, y, 17, 17);
      g.fillStyle(col('#1d2330'), 1).fillRect(x + 1, y + 1, 15, 15);
      const item = ITEMS.find((it) => it.id === me.items[i]);
      if (!item) continue;
      const cx = x + 8.5, cy = y + 8.5;
      g.fillStyle(col(itemTint(item)), 1).fillPoints([new Phaser.Math.Vector2(cx, cy - 6), new Phaser.Math.Vector2(cx + 6, cy), new Phaser.Math.Vector2(cx, cy + 6), new Phaser.Math.Vector2(cx - 6, cy)], true);
      g.fillStyle(0xffffff, 0.4).fillTriangle(cx, cy - 6, cx - 6, cy, cx, cy);
      if (item.from) g.lineStyle(1, col(UI.gold), 1).strokeRect(x + 1, y + 1, 15, 15);
    }
    this.t('dead', bx, P.y + 72, me.dead ? t('respawnIn', { n: Math.ceil((me.respawnAt - s.time) / 1000) }) : t('classPassive', { class: t(c.name), passive: t(c.passive.name) }), 11, me.dead ? UI.red : UI.dim, 'left', true);
    this.t('lasthits', bx, P.y + 89, t('scoreLine', { kills: me.kills, deaths: me.deaths, assists: me.assists, lastHits: s.lastHits }), 10, UI.muted);
    this.drawBuffStrip(g, me);

    // Q, W, E, R.
    const offer = s.upgradeOffers[0];
    const offered = offer ? offer.options.map((id) => upgradeById(id)?.key) : [];
    ABILITY_KEYS.forEach((k, i) => {
      const ab = c.abilities[i];
      const box = abilityBox(i);
      const locked = me.level < ab.level;
      const marked = offered.includes(k);
      this.goldFrame(g, box.x, box.y, box.w, box.h, marked);
      if (locked) g.fillStyle(0x0d1018, 0.7).fillRect(box.x + 3, box.y + 3, box.w - 6, box.h - 6);
      this.abilityIcon(g, ab, box.x + box.w / 2, box.y + box.h / 2 - 2, locked ? 0.35 : 1, c.color);
      const cd = me.cds[k];
      if (cd > 0) g.fillStyle(0x000000, 0.6).fillRect(box.x + 3, box.y + 3, box.w - 6, (box.h - 6) * Math.min(1, cd / me.cdFull[k]));
      this.t(`ab-${k}`, box.x + 6, box.y + 4, k, 12, locked ? UI.muted : UI.text, 'left', true);
      const name = t(ab.name);
      this.t(`abn-${k}`, box.x + box.w / 2, box.y + box.h - 15, name.length > 10 ? name.split(' ')[0] : name, 9, UI.dim, 'center', true);
      const label = locked ? t('abilityLocked', { n: ab.level }) : cd > 0 ? `${Math.ceil(cd / 1000)}` : '';
      this.t(`abcd-${k}`, box.x + box.w / 2, box.y + 14, label, 18, UI.text, 'center', true);
      // Chosen upgrades as gold pips, and a gold diamond on an ability the offer would change.
      const pips = me.upgrades.filter((id) => upgradeById(id)?.key === k).length + (k === 'R' ? ultRank(me.level) : 0);
      for (let p = 0; p < pips; p++) g.fillStyle(col(UI.gold), 1).fillRect(box.x + box.w - 9 - p * 6, box.y + box.h - 9, 4, 4);
      if (marked) {
        const dx = box.x + box.w - 6, dy = box.y - 2;
        g.fillStyle(col(UI.edge), 1).fillPoints([new Phaser.Math.Vector2(dx, dy - 9), new Phaser.Math.Vector2(dx + 9, dy), new Phaser.Math.Vector2(dx, dy + 9), new Phaser.Math.Vector2(dx - 9, dy)], true);
        g.fillStyle(col(UI.gold), 1).fillPoints([new Phaser.Math.Vector2(dx, dy - 7), new Phaser.Math.Vector2(dx + 7, dy), new Phaser.Math.Vector2(dx, dy + 7), new Phaser.Math.Vector2(dx - 7, dy)], true);
        g.fillStyle(0x7a5418, 1).fillTriangle(dx - 3, dy + 2, dx + 3, dy + 2, dx, dy - 3);
      }
    });

    // The shop button.
    const sb = SHOP_BUTTON;
    this.panel(g, sb.x, sb.y, sb.w, sb.h, this.shopOpen ? '#4a5876' : '#33405a');
    this.coin(g, sb.x + 20, sb.y + 23, 10);
    this.t('shop-label', sb.x + 36, sb.y + 10, t('shop'), 16, UI.text, 'left', true);
    this.t('shop-key', sb.x + 36, sb.y + 31, '[B]', 11, UI.dim, 'left', true);

    // The item actives: Dash (Phase Boots) on D, Flask on H (F is the hub's full screen key), the ward on V.
    ACTIVES.forEach((a, i) => {
      const r = activeButton(i);
      const owned = a.id === 'ward' ? me.wards > 0 : me.items.some((id) => ITEMS.find((it) => it.id === id)?.active === a.id);
      const cd = me.activeCds[a.id] ?? 0;
      this.goldFrame(g, r.x, r.y, r.w, r.h, false);
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2 + 4;
      const alpha = owned ? 1 : 0.3;
      if (a.id === 'ward') {
        // A stake with an eye, and how many are carried.
        g.fillStyle(col('#8a5d36'), alpha).fillRect(cx - 2, cy - 2, 4, 12);
        g.fillStyle(col('#cfe9ff'), alpha).fillEllipse(cx, cy - 5, 17, 10);
        g.fillStyle(col(UI.blue), alpha).fillCircle(cx, cy - 5, 4);
        g.fillStyle(0x0d1018, alpha).fillCircle(cx, cy - 5, 2);
        if (owned) this.t('act-wards', r.x + r.w - 3, r.y + r.h - 13, `x${me.wards}`, 9, UI.gold, 'right', true);
      } else if (a.id === 'dash') {
        g.fillStyle(col(UI.blue), alpha).fillPoints([new Phaser.Math.Vector2(cx - 9, cy - 3), new Phaser.Math.Vector2(cx + 1, cy - 3), new Phaser.Math.Vector2(cx + 1, cy - 8), new Phaser.Math.Vector2(cx + 10, cy), new Phaser.Math.Vector2(cx + 1, cy + 8), new Phaser.Math.Vector2(cx + 1, cy + 3), new Phaser.Math.Vector2(cx - 9, cy + 3)], true);
      } else {
        // A round flask of green tonic with a cork.
        g.fillStyle(col('#cfe9ff'), alpha * 0.8).fillCircle(cx, cy + 2, 8);
        g.fillStyle(col('#62d86f'), alpha).fillCircle(cx, cy + 3, 6.5);
        g.fillStyle(col('#cfe9ff'), alpha * 0.8).fillRect(cx - 2.5, cy - 9, 5, 6);
        g.fillStyle(col('#8a5d36'), alpha).fillRect(cx - 3, cy - 11, 6, 3);
      }
      if (owned && cd > 0) g.fillStyle(0x000000, 0.6).fillRect(r.x + 3, r.y + 3, r.w - 6, (r.h - 6) * (cd / a.cd));
      this.t(`act-${a.id}`, r.x + 4, r.y + 2, a.key, 10, owned ? UI.text : UI.muted, 'left', true);
      if (owned && cd > 0) this.t(`actcd-${a.id}`, r.x + r.w / 2, r.y + 12, `${Math.ceil(cd / 1000)}`, 13, UI.text, 'center', true);
    });

    // The upgrade choice, or what the next level brings.
    const up = UPGRADE_PANEL;
    if (offer) {
      this.goldFrame(g, up.x, up.y, up.w, up.h, true);
      this.t('up-head', up.x + 8, up.y + 6, t('chooseUpgrade', { level: offer.level }), 9, UI.gold, 'left', true);
      const n = offer.options.length;
      offer.options.forEach((id, i) => {
        const u = upgradeById(id)!;
        const r = upgradeCard(i, n);
        // A third card, from the class's mastery, has a gold edge.
        this.panel(g, r.x, r.y, r.w, r.h, i === 2 ? '#4a4630' : '#3a4660');
        if (n === 3) {
          // Three slim cards: a small key box, the name and the effect on two short lines.
          g.fillStyle(col(UI.goldDeep), 1).fillRect(r.x + 4, r.y + 5, 19, 19);
          g.fillStyle(col(UI.gold), 1).fillRect(r.x + 5, r.y + 6, 17, 17);
          this.t(`up-key-${i}`, r.x + 13.5, r.y + 7, u.key, 11, '#3a2a08', 'center', true);
          this.t(`up-name-${i}`, r.x + 28, r.y + 2, t(u.name), 11, UI.text, 'left', true);
          this.t(`up-desc-${i}`, r.x + 28, r.y + 16, upgradeText(u, c), 9, UI.dim);
        } else {
          g.fillStyle(col(UI.goldDeep), 1).fillRect(r.x + 5, r.y + 8, 24, 26);
          g.fillStyle(col(UI.gold), 1).fillRect(r.x + 6, r.y + 9, 22, 24);
          this.t(`up-key-${i}`, r.x + 17, r.y + 13, u.key, 14, '#3a2a08', 'center', true);
          this.t(`up-name-${i}`, r.x + 36, r.y + 6, t(u.name), 12, UI.text, 'left', true);
          this.t(`up-desc-${i}`, r.x + 36, r.y + 23, upgradeText(u, c), 9, UI.dim);
        }
        this.t(`up-num-${i}`, r.x + r.w - 6, r.y + (n === 3 ? 3 : 6), String(i + 1), 9, i === 2 ? UI.gold : UI.muted, 'right', true);
      });
    } else {
      this.panel(g, up.x, up.y, up.w, up.h, UI.slate);
      const nextLevel = me.level + 1;
      this.t('up-head', up.x + 10, up.y + 8, t('upgradesHead'), 9, UI.goldDeep, 'left', true);
      const chosen = me.upgrades.map((id) => { const u = upgradeById(id); return u ? t(u.name) : id; });
      this.t('up-chosen', up.x + 10, up.y + 26, chosen.length ? chosen.join('\n') : t('noneYet'), 10, chosen.length ? UI.text : UI.muted, 'left', true);
      const nextText = me.level >= MAX_LEVEL ? t('allLevels') : t(ULT_RANK_LEVELS.includes(nextLevel) ? 'nextRanksR' : 'nextAt', { level: nextLevel });
      this.t('up-next', up.x + 10, up.y + up.h - 18, nextText, 9, UI.muted);
    }
  }

  /** The buffs the player's champion carries, as chips above the portrait with the time left. */
  private drawBuffStrip(g: Phaser.GameObjects.Graphics, me: Unit) {
    me.buffs.slice(0, 4).forEach((b, i) => {
      const r = buffStrip(i);
      g.fillStyle(col(UI.edge), 0.9).fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
      g.fillStyle(col(UI.slateDark), 0.92).fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle(col(b.color), 1).fillRect(r.x, r.y, 4, r.h);
      const label = t(b.id === 'ember' || b.id === 'moss' ? BUFFS[b.id].name : (b.id as TextKey));
      this.t(`bstrip-${i}`, r.x + 8, r.y + 3, t('buffTime', { buff: label.length > 9 ? label.split(' ')[0] : label, s: Math.ceil(b.ms / 1000) }), 10, UI.text, 'left', true);
    });
  }

  /** A small icon for an ability, by what it does. */
  private abilityIcon(g: Phaser.GameObjects.Graphics, ab: AbilityDef, x: number, y: number, alpha: number, color: string) {
    const c = col(color);
    const V = (px: number, py: number) => new Phaser.Math.Vector2(x + px, y + py);
    switch (ab.kind) {
      case 'burst': {
        for (let i = 0; i < 8; i++) {
          const a = (i * Math.PI) / 4;
          g.fillStyle(i % 2 ? col(UI.gold) : c, alpha).fillTriangle(x + Math.cos(a - 0.25) * 6, y + Math.sin(a - 0.25) * 6, x + Math.cos(a + 0.25) * 6, y + Math.sin(a + 0.25) * 6, x + Math.cos(a) * 15, y + Math.sin(a) * 15);
        }
        g.fillStyle(c, alpha).fillCircle(x, y, 6);
        g.fillStyle(0xffffff, alpha * 0.5).fillCircle(x - 2, y - 2, 2.5);
        break;
      }
      case 'ally':
        g.fillStyle(col('#cfe9ff'), alpha).fillPoints(pts2([V(0, -13), V(11, -8), V(9, 5), V(0, 13), V(-9, 5), V(-11, -8)]), true);
        g.fillStyle(c, alpha).fillPoints(pts2([V(0, -10), V(8, -6), V(6.5, 4), V(0, 10), V(-6.5, 4), V(-8, -6)]), true);
        g.fillStyle(0xffffff, alpha * 0.4).fillPoints(pts2([V(0, -10), V(-8, -6), V(-6.5, 4), V(0, 10)]), true);
        break;
      case 'dash':
        g.fillStyle(col(UI.gold), alpha).fillPoints(pts2([V(-13, -4), V(2, -4), V(2, -11), V(14, 0), V(2, 11), V(2, 4), V(-13, 4)]), true);
        g.fillStyle(c, alpha).fillPoints(pts2([V(-13, 0), V(2, 0), V(2, 4), V(-13, 4)]), true);
        break;
      case 'buff':
        // Three rising chevrons.
        for (let i = 0; i < 3; i++) {
          const yy = y + 9 - i * 8;
          g.fillStyle(i === 2 ? col(UI.gold) : c, alpha).fillPoints(pts2([V(-11, yy + 3 - y), V(0, yy - 5 - y), V(11, yy + 3 - y), V(11, yy + 7 - y), V(0, yy - 1 - y), V(-11, yy + 7 - y)]), true);
        }
        break;
      case 'zone':
        // A patch on the ground with motes rising from it.
        g.fillStyle(c, alpha * 0.45).fillEllipse(x, y + 6, 30, 14);
        g.lineStyle(2, c, alpha).strokeEllipse(x, y + 6, 30, 14);
        for (const [dx, dy, r] of [[-6, -4, 2.5], [3, -10, 3], [8, -2, 2], [-1, -15, 2]]) g.fillStyle(dx < 0 ? c : col(UI.gold), alpha).fillCircle(x + dx, y + dy, r);
        break;
      case 'bolt':
        if (ab.pull) {
          // A barbed hook on a line.
          g.lineStyle(2, col('#d9c79a'), alpha).lineBetween(x - 12, y + 12, x + 4, y - 4);
          g.lineStyle(3, c, alpha).beginPath();
          g.arc(x + 4, y + 2, 7, -Math.PI / 2, Math.PI * 0.6, false);
          g.strokePath();
          g.fillStyle(c, alpha).fillTriangle(x + 2, y - 11, x + 9, y - 3, x - 1, y - 2);
          break;
        }
        g.lineStyle(3, col('#d9c79a'), alpha).lineBetween(x - 11, y + 11, x + 7, y - 7);
        g.fillStyle(c, alpha).fillTriangle(x + 13, y - 13, x + 2, y - 8, x + 8, y - 2);
        g.fillStyle(col(UI.gold), alpha).fillTriangle(x - 12, y + 12, x - 12, y + 5, x - 5, y + 12);
        break;
    }
  }

  private drawMinimap(g: Phaser.GameObjects.Graphics, s: GameState, me: Unit) {
    const m = MINIMAP;
    this.panel(g, m.x - 4, m.y - 4, m.w + 8, m.h + 8, UI.slate);
    const k = m.w / WORLD.w;
    const mx = (x: number) => m.x + x * k;
    const my = (y: number) => m.y + y * k;
    g.fillStyle(col('#3f7a3a'), 1).fillRect(m.x, m.y, m.w, m.h);
    g.lineStyle(4, col('#3a7ea3'), 0.95).lineBetween(mx(RIVER.from.x), my(RIVER.from.y), mx(RIVER.to.x), my(RIVER.to.y));
    for (const [id, lane] of Object.entries(LANES) as [LaneId, Vec[]][]) {
      // A quick match's closed lanes are faint.
      g.lineStyle(3, col('#d2b483'), s.lanes.includes(id) ? 0.95 : 0.3);
      g.beginPath();
      g.moveTo(mx(lane[0].x), my(lane[0].y));
      for (const p of lane.slice(1)) g.lineTo(mx(p.x), my(p.y));
      g.strokePath();
    }
    for (const t of TOWERS) {
      const tower = s.units.find((u) => u.kind === 'tower' && u.x === t.x && u.y === t.y);
      if (tower && !tower.dead) {
        g.fillStyle(col(UI.edge), 1).fillRect(mx(t.x) - 3, my(t.y) - 3, 6, 6);
        g.fillStyle(col(SIDE_COLOR[t.team]), 1).fillRect(mx(t.x) - 2, my(t.y) - 2, 4, 4);
      }
    }
    // Bushes as dark patches, and the beast's pit.
    for (const b of BUSHES) g.fillStyle(col('#24481f'), 0.9).fillEllipse(mx(b.x), my(b.y), b.rx * 2 * k, b.ry * 2 * k);
    g.lineStyle(1, 0xb98cff, 0.6).strokeCircle(mx(BEAST.x), my(BEAST.y), 5);
    for (const u of s.units) {
      if (u.dead || this.hidden(s, u)) continue;
      if (u.kind === 'beast') {
        const cx = mx(u.x), cy = my(u.y);
        g.fillStyle(col(UI.edge), 1).fillPoints([new Phaser.Math.Vector2(cx, cy - 6), new Phaser.Math.Vector2(cx + 6, cy), new Phaser.Math.Vector2(cx, cy + 6), new Phaser.Math.Vector2(cx - 6, cy)], true);
        g.fillStyle(0xb98cff, 1).fillPoints([new Phaser.Math.Vector2(cx, cy - 4.5), new Phaser.Math.Vector2(cx + 4.5, cy), new Phaser.Math.Vector2(cx, cy + 4.5), new Phaser.Math.Vector2(cx - 4.5, cy)], true);
      } else if (u.kind === 'inhibitor') {
        g.fillStyle(col(UI.edge), 1).fillCircle(mx(u.x), my(u.y), 3);
        g.fillStyle(col(SIDE_COLOR[u.side as Team]), 1).fillCircle(mx(u.x), my(u.y), 2);
      } else if (u.kind === 'nexus') g.fillStyle(col(SIDE_COLOR[u.side as Team]), 1).fillCircle(mx(u.x), my(u.y), 5);
      else if (u.kind === 'champion') g.fillStyle(col(SIDE_COLOR[u.side as Team]), 1).fillCircle(mx(u.x), my(u.y), u.player ? 3.5 : 2.5);
      else if (u.kind === 'minion') g.fillStyle(col(SIDE_COLOR[u.side as Team]), 0.85).fillRect(mx(u.x) - 0.75, my(u.y) - 0.75, 1.5, 1.5);
      else if (u.kind === 'camp' && u.campKind !== 'pup') g.fillStyle(col(u.campKind === 'ember' ? BUFFS.ember.color : u.campKind === 'moss' ? BUFFS.moss.color : u.campKind === 'merc' ? '#d8b878' : u.campKind === 'drake' ? DRAKES[s.drakeElement].color : SIDE_COLOR.neutral), 0.9).fillCircle(mx(u.x), my(u.y), 2);
      else if (u.kind === 'ward') {
        const cx = mx(u.x), cy = my(u.y);
        g.fillStyle(col(UI.edge), 1).fillPoints([new Phaser.Math.Vector2(cx, cy - 4), new Phaser.Math.Vector2(cx + 3, cy), new Phaser.Math.Vector2(cx, cy + 4), new Phaser.Math.Vector2(cx - 3, cy)], true);
        g.fillStyle(col(SIDE_COLOR[u.side as Team]), 1).fillPoints([new Phaser.Math.Vector2(cx, cy - 2.5), new Phaser.Math.Vector2(cx + 2, cy), new Phaser.Math.Vector2(cx, cy + 2.5), new Phaser.Math.Vector2(cx - 2, cy)], true);
      } else if (u.kind === 'watchstone') {
        const cx = mx(u.x), cy = my(u.y);
        g.fillStyle(col(UI.edge), 1).fillRect(cx - 3, cy - 3, 6, 6);
        g.fillStyle(col(u.side === 'neutral' ? SIDE_COLOR.neutral : SIDE_COLOR[u.side]), 1).fillRect(cx - 2, cy - 2, 4, 4);
      }
    }
    // Runes waiting on the river.
    s.runes.forEach((r) => {
      if (!r || this.fogged(r.x, r.y)) return;
      g.fillStyle(col(UI.edge), 1).fillCircle(mx(r.x), my(r.y), 3.5);
      g.fillStyle(col(RUNES[r.kind].color), 1).fillCircle(mx(r.x), my(r.y), 2.5);
    });
    // Blue's pings, as rings in their colour.
    for (const p of s.pings) {
      if (p.side !== 'blue') continue;
      g.lineStyle(2, col(UI.edge), 1).strokeCircle(mx(p.x), my(p.y), 5);
      g.lineStyle(1.5, col(PINGS[p.kind].color), 1).strokeCircle(mx(p.x), my(p.y), 5);
    }
    // The view and the player.
    const v = this.viewRect();
    g.lineStyle(1, 0xffffff, 0.7).strokeRect(mx(v.x), my(v.y), SCREEN.w * k, SCREEN.h * k);
    g.lineStyle(1, 0xffffff, 0.9).strokeCircle(mx(me.x), my(me.y), 5);
    // A gold star on the objective.
    const o = s.objective;
    const t = o && getUnit(s, o.target);
    if (t && !t.dead && !this.hidden(s, t)) {
      const cx = mx(t.x), cy = my(t.y);
      const star = (r: number) =>
        Array.from({ length: 10 }, (_, i) => {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 ? r * 0.45 : r;
          return new Phaser.Math.Vector2(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
        });
      g.fillStyle(col(UI.edge), 1).fillPoints(pts2(star(8)), true);
      g.fillStyle(col(UI.gold), 1).fillPoints(pts2(star(6.5)), true);
    }
  }

  private drawShop(g: Phaser.GameObjects.Graphics, me: Unit) {
    const p = SHOP_PANEL;
    this.panel(g, p.x, p.y, p.w, p.h, UI.slate);
    g.fillStyle(col(UI.gold), 1).fillRect(p.x + 2, p.y + 2, p.w - 4, 3);
    this.t('shop-title', p.x + 16, p.y + 8, t('shop'), 18, UI.gold, 'left', true);
    const open = me.dead || atShop(me);
    const note = !open
      ? t('shopClosed')
      : t(me.dead ? 'shopDead' : 'shopOpen', { gold: Math.floor(me.gold), items: me.items.length, maxItems: MAX_ITEMS, wards: me.wards, maxWards: WARD.carry });
    this.t('shop-note', p.x + 90, p.y + 14, note, 11, open ? UI.dim : UI.red);
    ITEMS.forEach((item, i) => {
      const r = shopRow(i);
      const has = !item.ward && !item.elixir && me.items.includes(item.id);
      const drinking = item.elixir ? me.buffs.find((b) => b.elixir && b.id === item.name) : undefined;
      const price = priceFor(me, item);
      const parts = (item.from ?? []).filter((id) => me.items.includes(id));
      const fits = item.elixir ? true : item.ward ? me.wards < WARD.carry : me.items.length - parts.length < MAX_ITEMS;
      const afford = me.gold >= price;
      this.panel(g, r.x, r.y, r.w, r.h, has ? '#2a3140' : item.from ? '#41496a' : '#3a4660');
      // Items that build from parts get a gold top edge.
      if (item.from) g.fillStyle(col(has ? UI.goldDeep : UI.gold), 1).fillRect(r.x + 2, r.y + 2, r.w - 4, 2);
      const cx = r.x + 18, cy = r.y + 18;
      g.fillStyle(col(UI.edge), 1).fillPoints([new Phaser.Math.Vector2(cx, cy - 12), new Phaser.Math.Vector2(cx + 11, cy), new Phaser.Math.Vector2(cx, cy + 12), new Phaser.Math.Vector2(cx - 11, cy)], true);
      g.fillStyle(col(itemTint(item)), has ? 0.4 : 1).fillPoints([new Phaser.Math.Vector2(cx, cy - 10), new Phaser.Math.Vector2(cx + 9, cy), new Phaser.Math.Vector2(cx, cy + 10), new Phaser.Math.Vector2(cx - 9, cy)], true);
      g.fillStyle(0xffffff, has ? 0.15 : 0.4).fillTriangle(cx, cy - 10, cx - 9, cy, cx, cy);
      this.t(`shop-name-${i}`, r.x + 34, r.y + 5, t(item.name), 12, has ? UI.muted : UI.text, 'left', true);
      const label = has ? t('owned') : !fits ? (item.ward ? t('carrying', { n: WARD.carry }) : t('bagFull')) : t('price', { gold: price });
      this.t(`shop-price-${i}`, r.x + 34, r.y + 20, label, 11, has || !fits ? UI.muted : afford ? UI.gold : UI.red, 'left', true);
      if (!has && parts.length) this.t(`shop-save-${i}`, r.x + r.w - 8, r.y + 20, t('partsOff', { gold: item.cost - price }), 9, UI.green, 'right', true);
      this.t(`shop-desc-${i}`, r.x + 10, r.y + 37, describe(item), 10, UI.dim);
      const into = ITEMS.filter((it) => it.from?.includes(item.id));
      const recipe = drinking
        ? t('elixirActive', { time: clock(drinking.ms) })
        : item.elixir
          ? t('elixirNote', { n: ELIXIR.ms / 60_000 })
          : item.ward
            ? t('wardNote', { n: me.wards, max: WARD.carry })
            : item.from
              ? t('buildsFrom', { parts: item.from.map((id) => { const part = ITEMS.find((it) => it.id === id); return part ? t(part.name) : id; }).join(' + ') })
              : into.length === 1
                ? t('buildsInto', { item: t(into[0].name) })
                : into.length
                  ? t('buildsIntoMany', { n: into.length })
                  : t('activeItem');
      this.t(`shop-recipe-${i}`, r.x + 10, r.y + 54, recipe, 9, item.from ? UI.gold : UI.muted, 'left', !!item.from);
    });
  }

  private drawEnd(g: Phaser.GameObjects.Graphics, s: GameState) {
    g.fillStyle(0x000000, 0.6).fillRect(0, 0, SCREEN.w, SCREEN.h);
    const p = END_PANEL;
    this.panel(g, p.x, p.y, p.w, p.h, UI.slate);
    g.fillStyle(col(UI.gold), 1).fillRect(p.x + 2, p.y + 2, p.w - 4, 3);
    const won = s.winner === 'blue';
    if (watching) {
      this.t('end-title', SCREEN.w / 2, p.y + 22, t(won ? 'blueWins' : 'redWins'), 34, won ? SIDE_COLOR.blue : SIDE_COLOR.red, 'center', true);
      const why = s.surrendered ? (s.surrendered === 'red' ? 'redSurrendered' : 'blueSurrenderedWatch') : won ? 'redNexusFell' : 'blueNexusFell';
      this.t('end-sub', SCREEN.w / 2, p.y + 72, t(why), 13, UI.dim, 'center');
    } else {
      this.t('end-title', SCREEN.w / 2, p.y + 22, t(won ? 'victory' : 'defeat'), 34, won ? UI.green : UI.red, 'center', true);
      const why = s.surrendered ? (s.surrendered === 'red' ? 'redSurrendered' : 'blueSurrendered') : won ? 'redNexusFell' : 'yourNexusFell';
      this.t('end-sub', SCREEN.w / 2, p.y + 72, t(why), 13, UI.dim, 'center');
    }
    this.t('end-stats', SCREEN.w / 2, p.y + 94, t('endStats', { kills: t('kills', { n: this.player()?.kills ?? 0 }), deaths: t('deaths', { n: this.player()?.deaths ?? 0 }), objectives: s.objectivesDone, lastHits: s.lastHits, streak: s.bestStreak, beasts: s.beastKills.blue }), 11, UI.muted, 'center');
    // A win counts toward the class's mastery, once per match.
    const me = this.player();
    if (!watching && won && me?.champ) {
      if (this.winCounted === null) {
        this.winCounted = recordWin(me.champ.id);
        this.mastery = loadMastery();
      }
      const wins = this.winCounted;
      const rank = masteryRank(wins);
      const next = MASTERY_WINS[rank];
      const winsLine = t('mastery', { name: me.champ.short, rank, n: wins });
      const line = next ? t('masteryNext', { line: winsLine, rank: rank + 1, n: next }) : t('masteryFull', { line: winsLine });
      this.t('end-mastery', SCREEN.w / 2, p.y + 112, line, 11, UI.gold, 'center', true);
    }
    this.panel(g, PLAY_AGAIN.x, PLAY_AGAIN.y, PLAY_AGAIN.w, PLAY_AGAIN.h, '#4a5876');
    this.t('again-label', PLAY_AGAIN.x + PLAY_AGAIN.w / 2, PLAY_AGAIN.y + 12, t(watching ? 'watchAnother' : 'playAgain'), 16, UI.text, 'center', true);
  }
}
