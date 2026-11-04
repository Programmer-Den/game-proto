// The whole game in one scene: the map the knight is in, the knight, the people and foes in it,
// the night's light and the HUD. Changing place swaps the map's sprites but keeps the scene.

import Phaser from 'phaser';
import { paintAll, texScale } from '../art/paint';
import { paintGround, groundKey } from '../art/ground';
import { AFTER_BOSS, BOSS_FLAG, BREAKABLE, buildMap, centre, CUTTABLE, DUNGEONS, LOW, MAP_IDS, setTile, SOLID, TILE, tileAt, underBoulder, type Door, type EnemyKind, type Facing, type FishId, type ItemId, type MapDef, type MapId, type NpcId, type Prop, type PropKind, type RequestId } from '../game/maps';
import { findPath, type Step } from '../game/path';
import { plusStones } from '../game/plus';
import {
  advance, buy, CHAPTER_ONE_STONES, CHAPTER_THREE_STONES, CHAPTER_TWO_STONES, clearSave, clock, cook, endMeal, FISH_MAX, found, give, hasFlag, hasUpgrade, load, maxSeeds, MEALS, MOONSTONES, newPlus, newState, reached, REQUESTS, reward, save, setFlag, stoneCounts, stonesToFind, UPGRADES,
  type GameState, type Seller,
} from '../game/state';
import { talk, type TalkEffect } from '../game/talk';
import { t, type TextKey } from '../i18n';
import { settings } from '../../../../shared/settings';
import { renderScale, scrollingCamera, splitHudCamera, viewPoint, viewSize } from '../../../../shared/scaling';
import { playMusic, playSting, ui } from '../../../../shared/audio';
import { sfx } from '../audio/sounds';
import { BOSS, DEEP, STINGS, VILLAGE, WILDS } from '../audio/music';
import { Hud } from './hud';
import { awardNow, checkTrophies } from '../trophies/check';
import { NightLight, type Light } from './light';
import {
  ARMOURED, BELL_DOWN_MS, BRINE, BULB_DOWN_MS, FAMILIES, familyDone, familyOf, GULL_SWOOP_MS, GULL_SWOOP_SPEED, PAGE_AT, DOWN_MS, LANTERN_KEEP, LANTERN_LIFT, LANTERN_SHOT_MS, BULB_EVERY_MS, BULB_HP, BULB_UP_MS, BURST_PX, DROP_MS, EXPOSED_MS, FOES, foeFree, FROG_LEAP_MS, FROG_WAIT_MS, FUSE_MS, GLOAM, HOVER_MS, HOVER_SPEED,
  makeFoe, PLUS, SEED_SPEED, SHADE_SEEN_PX, SLAM_PX, SUMMON_MS, THORNLING_SHOT_MS, TRIAL, VOLLEY_MS, WRAITH_HP,
  type Bomb, type Boss, type Brine, type Foe, type Gloam, type Seed, type Wraith,
} from './foes';
import {
  BITE_MS, BOOTS, CHARM, CHOWDER, FISH_WAIT_MS, GLIMMER_PX, GUST, SKEWER, HURT_MS, LANTERN, LONG_VINE, LANTERN_OIL, PICKUP_PX, PLANT_REACH, PULL_SPEED, ROLL_COOLDOWN_MS, ROLL_MS, ROLL_SPEED, STICK, SWING_COOLDOWN_MS, SWING_MS, SWING_RADIUS, SWING_REACH, VEIL_PX, VINE_RANGE, VINE_SPEED,
  WALK_SPEED, WHETSTONE,
} from './layout';

/** Where each prop's art touches the ground, as a share of its texture's height, and whether it blocks. */
const PROP_ART: Record<PropKind, { key: string; foot: number; solid: boolean }> = {
  house: { key: 'house', foot: 172 / 184, solid: true },
  shed: { key: 'shed', foot: 122 / 132, solid: true },
  hut: { key: 'hut', foot: 128 / 140, solid: true },
  well: { key: 'well', foot: 84 / 100, solid: true },
  lamp: { key: 'lamp', foot: 66 / 70, solid: true },
  brazier: { key: 'brazier', foot: 40 / 44, solid: true },
  shroom: { key: 'shroom', foot: 21 / 24, solid: false },
  bench: { key: 'bench', foot: 26 / 30, solid: true },
  rock: { key: 'rock', foot: 23 / 28, solid: true },
  arch: { key: 'arch', foot: 96 / 104, solid: true },
  statue: { key: 'statue-right', foot: 58 / 64, solid: true },
  tower: { key: 'tower', foot: 148 / 152, solid: true },
  bell: { key: 'bell-1', foot: 44 / 48, solid: true },
  candle: { key: 'candle', foot: 26 / 28, solid: false },
  cave: { key: 'cave', foot: 96 / 104, solid: true },
  crystal: { key: 'crystal', foot: 28 / 30, solid: true },
  campfire: { key: 'campfire', foot: 27 / 30, solid: true },
  mill: { key: 'mill', foot: 104 / 112, solid: true },
  pinwheel: { key: 'pinwheel', foot: 37 / 40, solid: true },
};

/** Each kind of foe's name and picture on the bestiary page. */
const FOE_PAGE: Record<EnemyKind, { key: string; name: TextKey }> = {
  slug: { key: 'slug', name: 'slugName' },
  moth: { key: 'moth-a', name: 'mothName' },
  thornling: { key: 'thornling', name: 'thornlingName' },
  frog: { key: 'frog', name: 'frogName' },
  beetle: { key: 'beetle', name: 'beetleName' },
  lantern: { key: 'lantern-a', name: 'lanternName' },
  shade: { key: 'shade', name: 'shadeName' },
  crab: { key: 'crab', name: 'crabName' },
  gull: { key: 'gull-a', name: 'gullName' },
};

/** What each request's things look like where they lie, and the text that names one. */
const FIND_ART: Record<RequestId, { key: string; name: TextKey; reward: TextKey }> = {
  lilies: { key: 'find-lilies', name: 'findLilies', reward: 'foundHeart' },
  boat: { key: 'find-boat', name: 'findBoat', reward: 'gotWhetstone' },
  glowcaps: { key: 'find-glowcaps', name: 'findGlowcaps', reward: 'gotPockets' },
  specs: { key: 'find-specs', name: 'findSpecs', reward: 'gotCharm' },
  goatbells: { key: 'find-goatbells', name: 'findGoatbells', reward: 'foundHeart' },
};
/** A request's name on the journal page and in its toasts. */
export const REQUEST_NAME: Record<RequestId, TextKey> = { lilies: 'reqLilies', boat: 'reqBoat', glowcaps: 'reqGlowcaps', specs: 'reqSpecs', goatbells: 'reqGoatbells' };
const NPC_NAME: Record<NpcId, TextKey> = { elder: 'elderName', pip: 'pipName', baker: 'bakerName', cat: 'catName', hermit: 'hermitName', herder: 'herderName', fisher: 'fisherName' };
/** The order the belfry's bells must ring in, by voice (0 is the deepest). */
const BELL_ORDER = [0, 2, 1];
const BELL_SOUND: TextKey[] = ['bellLow', 'bellMid', 'bellHigh'];
/** Each bell's pitch, against the bell sound's C: G, C and E, so the right tune is a falling chord. */
const BELL_PITCH = [0.75, 1, 1.26];
/** How high the Bellwraith's bell hangs while it hunts. */
const BELL_LIFT = 72;

const DIRS: Record<Facing, { x: number; y: number }> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
const WARM: [number, number, number] = [255, 190, 110];
/** The corners of the knight's feet box, offset from their position. */
const FEET: [number, number][] = [[-8, -6], [8, -6], [-8, 4], [8, 4]];

/** What a tap asked the knight to do once they get there. */
type Target =
  | { kind: 'npc'; id: NpcId }
  | { kind: 'chest'; id: string }
  | { kind: 'sign'; i: number }
  | { kind: 'cut' | 'dig' | 'block' | 'door' | 'ring' | 'plant' | 'hourglass' | 'fish' | 'cook'; tx: number; ty: number }
  | { kind: 'foe'; foe: Foe };

interface Dialog {
  speaker: string;
  lines: string[];
  i: number;
  then?: TalkEffect;
}

export class GameScene extends Phaser.Scene {
  state!: GameState;
  map!: MapDef;
  player!: Phaser.GameObjects.Image;
  dialog: Dialog | null = null;
  /** The tiles a tap is walking the knight along, and what to do at the end. */
  route: Step[] | null = null;
  target: Target | null = null;
  foes: Foe[] = [];
  boss: Boss | null = null;
  wraith: Wraith | null = null;
  gloam: Gloam | null = null;
  brine: Brine | null = null;
  /** The line in the water: counting down to a bite, or the bite itself, which a pull must catch. */
  fishing: { t: number; bite: boolean; fish: FishId; x: number; y: number; bobber: Phaser.GameObjects.Image } | null = null;
  /** Bellseeds planted and swelling. */
  bombs: Bomb[] = [];
  /**
   * The hourglass trial under way: its dungeon and the play time since it started. While it runs the
   * dungeon's foes are back and its boss wakes again, harder (`TRIAL`); leaving or falling ends it.
   */
  trial: { map: MapId; ms: number } | null = null;

  private hud!: Hud;
  private night!: NightLight;
  private world: Phaser.GameObjects.GameObject[] = [];
  private ground!: Phaser.GameObjects.Image;
  private blockers = new Set<number>();
  private bushSprites = new Map<number, Phaser.GameObjects.Image>();
  private npcSprites = new Map<NpcId, Phaser.GameObjects.Image>();
  private chestSprites = new Map<string, Phaser.GameObjects.Image>();
  private doorSprites = new Map<string, Phaser.GameObjects.Image[]>();
  private stoneSprites = new Map<string, Phaser.GameObjects.Image>();
  private blocks: { x: number; y: number; sprite: Phaser.GameObjects.Image }[] = [];
  private seeds: Seed[] = [];
  private hearts: { x: number; y: number; sprite: Phaser.GameObjects.Image }[] = [];
  private pods: { x: number; y: number; sprite: Phaser.GameObjects.Image }[] = [];
  private coins: { x: number; y: number; sprite: Phaser.GameObjects.Image }[] = [];
  private bells: { note: number; x: number; y: number; sprite: Phaser.GameObjects.Image }[] = [];
  /** The windmill and pinwheels here, the point a gust must reach, their turning heads, and whether they turn. */
  private mills: { prop: Prop; cx: number; cy: number; head: Phaser.GameObjects.Image; turned: boolean }[] = [];
  private hornCd = 0;
  /** Which side of the journal is open: the journal itself or the bestiary. */
  private pageTab: 'journal' | 'bestiary' = 'journal';
  /** The bells rung so far, in order, toward the belfry's tune. */
  private bellSeq: number[] = [];
  /** Short bursts of light: a bellseed going off, a bell ringing. */
  private flashes: (Light & { t: number })[] = [];
  private glows: Light[] = [];
  private wisp: { i: number; sprite: Phaser.GameObjects.Image; hop: number } | null = null;
  private dug = new Set<string>();
  /** The hidden bridges' stones (by tile), shown where the Moonlantern's light falls. */
  private veilSprites = new Map<number, Phaser.GameObjects.Image>();
  /** A request's things lying here, by `<request>-<index>` in the map's `finds`. */
  private findSprites = new Map<string, Phaser.GameObjects.Image>();
  /** The glimmer over each moonstone a new game+ buried, by stone id. */
  private glimmers = new Map<string, Phaser.GameObjects.Image>();
  /** Whether the knight stands on a way out the story has not opened yet, so its toast shows once. */
  private onShutWay = false;
  private sword!: Phaser.GameObjects.Image;
  private vine!: Phaser.GameObjects.Graphics;
  private hookTip!: Phaser.GameObjects.Image;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  /**
   * A finger on the world: where it went down and where it is now, in view pixels, and the world
   * point it went down on. It steers as a floating stick once dragged past `STICK.drag`; lifted
   * before that, it was a tap.
   */
  stick: { id: number; ox: number; oy: number; x: number; y: number; wx: number; wy: number; live: boolean } | null = null;
  private swing: { t: number; dir: Facing } | null = null;
  private swingCd = 0;
  private roll: { t: number; dx: number; dy: number } | null = null;
  private rollCd = 0;
  /** The hookvine in flight: going out, coming back, or pulling the knight to a post. */
  hook: { x: number; y: number; dx: number; dy: number; dist: number; phase: 'out' | 'back' | 'pull'; to?: { x: number; y: number } } | null = null;
  /** A save asked for while the hookvine pulls the knight, written once they land (`persist`). */
  private saveAfterPull = false;
  private invuln = 0;
  private walkT = 0;
  private pushT = 0;
  private chaseT = 0;
  private fading = false;
  private now = 0;
  /** Whether each door was shut last frame, so a room's door sounds as it slams or opens. */
  private doorWas = new Map<string, boolean>();
  /** Hints already shown since the page opened, for the armoured foes (a shell turning the blade, one knocked down). */
  private hinted = new Set<string>();
  /** When each bellseed's fuse ticks next, in ms left on its fuse. */
  private ticks = new WeakMap<Bomb, number>();

  constructor() {
    super('Game');
  }

  create() {
    paintAll(this);
    this.state = load();
    this.hud = new Hud(this);
    this.night = new NightLight(this);
    scrollingCamera(this.cameras.main);
    splitHudCamera(this);
    this.player = this.add.image(0, 0, 'hero-down').setOrigin(0.5, 41 / 44).setScale(texScale('hero-down'));
    this.sword = this.add.image(0, 0, 'sword').setOrigin(0.5, 0.95).setScale(texScale('sword')).setVisible(false);
    this.vine = this.add.graphics();
    this.hookTip = this.add.image(0, 0, 'hook').setScale(texScale('hook')).setVisible(false);
    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ENTER,J,SHIFT,K,Q,E,L,B,X,N', false) as Record<string, Phaser.Input.Keyboard.Key>;
    kb.on('keydown', this.onKey, this);
    this.input.on('pointerdown', this.onPointer, this);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('pointerupoutside', this.onPointerUp, this);
    // A paused scene never hears the finger lift, so a pause drops the stick.
    this.events.on(Phaser.Scenes.Events.PAUSE, () => (this.stick = null));
    // A second touch pointer, so one thumb can swing or roll while the other steers.
    this.input.addPointer(1);
    this.enterMap(this.state.map, this.state.x, this.state.y, this.state.facing, false);
  }

  // ---------------------------------------------------------------- the map

  /** Builds the map `id` around the knight, standing at (x, y) facing `facing`. */
  private enterMap(id: MapId, x: number, y: number, facing: Facing, keepSpawn: boolean) {
    for (const o of this.world) o.destroy();
    this.world = [];
    for (const s of this.seeds) s.sprite.destroy();
    for (const h of this.hearts) h.sprite.destroy();
    for (const p of this.pods) p.sprite.destroy();
    for (const c of this.coins) c.sprite.destroy();
    for (const b of this.bombs) b.sprite.destroy();
    this.seeds = [];
    this.hearts = [];
    this.pods = [];
    this.coins = [];
    this.bombs = [];
    this.bells = [];
    this.bellSeq = [];
    this.flashes = [];
    this.foes = [];
    this.boss = null;
    this.wraith = null;
    this.gloam = null;
    this.brine = null;
    this.fishing = null;
    this.mills = [];
    this.wisp = null;
    this.veilSprites.clear();
    this.findSprites.clear();
    this.glimmers.clear();
    this.blocks = [];
    this.blockers.clear();
    this.bushSprites.clear();
    this.npcSprites.clear();
    this.chestSprites.clear();
    this.doorSprites.clear();
    this.stoneSprites.clear();
    this.dug.clear();
    this.doorWas.clear();
    this.route = null;
    this.target = null;
    this.hook = null;
    this.saveAfterPull = false;
    this.roll = null;
    this.swing = null;

    const s = this.state;
    if (this.trial && this.trial.map !== id) {
      this.trial = null;
      this.hud.toast(t('trialLost'));
    }
    const trial = !!this.trial;
    const map = buildMap(id);
    this.map = map;
    plusStones(map, s.cycle);
    // Fallen rock shuts the pass to the peaks until chapter three.
    if (id === 'woods' && !reached(s, 'peaks')) map.props.push({ kind: 'rock', x: 24, y: 1, w: 1, h: 1 }, { kind: 'rock', x: 25, y: 1, w: 1, h: 1 });
    // And the way east from the fen to the coast until chapter four.
    if (id === 'fen' && !reached(s, 'coast')) map.props.push({ kind: 'rock', x: 34, y: 8, w: 1, h: 1 }, { kind: 'rock', x: 34, y: 9, w: 1, h: 1 });
    // The coast's inlet, once its windmill has pumped it dry.
    if (map.drain && map.millFlag && hasFlag(s, map.millFlag)) this.drain(map);
    // What the knight has already changed here.
    if (id === 'village' && hasFlag(s, 'gate-cut')) for (const i of [19, 20]) setTile(map, i, 3, 'path');
    if (id === 'woods' && hasFlag(s, 'woods-thorns')) for (const i of [42, 43]) setTile(map, i, 10, 'path');
    if (id === 'shrine' && hasFlag(s, 'boss') && !trial) map.tiles = map.tiles.map((t) => (t === 'ring' ? 'floor' : t));
    const broke = `broke-${id}-`;
    for (const f of s.flags)
      if (f.startsWith(broke)) {
        const [tx, ty] = f.slice(broke.length).split('-').map(Number);
        this.clearRock(map, tx, ty);
      }

    paintGround(this, map);
    this.ground = this.add.image(0, 0, groundKey(map)).setOrigin(0).setScale(texScale(groundKey(map))).setDepth(-10000);
    this.world.push(this.ground);
    const cam = this.cameras.main;
    cam.setBounds(0, 0, map.w * TILE, map.h * TILE);
    // A view wider or taller than the map (the Fen on an ultrawide) zooms in just enough to fill.
    const view = viewSize(this);
    cam.setZoom(renderScale * Math.max(1, view.width / (map.w * TILE), view.height / (map.h * TILE)));
    cam.setBackgroundColor(DUNGEONS.has(id) ? '#05050a' : '#0b1020');
    this.glows = [];

    for (let ty = 0; ty < map.h; ty++)
      for (let tx = 0; tx < map.w; tx++) {
        const t = tileAt(map, tx, ty);
        if (t === 'tree' || t === 'faketree') {
          // Trees right at the edge of the map are left off where nobody can see behind them.
          const key = map.theme === 'fen' ? 'tree-fen' : map.theme === 'peaks' ? 'tree-pine' : map.theme === 'coast' ? 'tree-coast' : (tx * 7 + ty * 3) % 3 === 0 ? 'tree-b' : 'tree';
          this.addWorld(this.add.image(tx * TILE + 16, ty * TILE + 30, key).setOrigin(0.5, 64 / 72), (ty + 1) * TILE - 2);
        } else if (t === 'bush' || t === 'thorns') {
          const img = this.add.image(tx * TILE + 16, ty * TILE + 28, t).setOrigin(0.5, t === 'bush' ? 25 / 30 : 29 / 34);
          this.addWorld(img, (ty + 1) * TILE - 4);
          this.bushSprites.set(ty * map.w + tx, img);
        } else if (t === 'boulder') {
          const img = this.add.image(tx * TILE + 16, ty * TILE + 28, 'boulder').setOrigin(0.5, 27 / 32);
          this.addWorld(img, (ty + 1) * TILE - 4);
          this.bushSprites.set(ty * map.w + tx, img);
        } else if (t === 'veil') {
          const img = this.addWorld(this.add.image(tx * TILE + 16, ty * TILE + 16, 'veil-stone'), -4999).setAlpha(0);
          this.veilSprites.set(ty * map.w + tx, img);
        }
      }

    for (const p of map.props) this.addProp(p);
    for (const n of map.npcs) {
      const c = centre(n);
      const img = this.add.image(c.x, c.y + 10, n.id).setOrigin(0.5, n.id === 'cat' ? 21 / 24 : (n.id === 'pip' ? 33 : 41) / (n.id === 'pip' ? 36 : 44));
      this.addWorld(img, c.y + 10);
      this.npcSprites.set(n.id, img);
      this.block(n.x, n.y);
    }
    for (const ch of map.chests) {
      const c = centre(ch);
      const open = hasFlag(s, `chest-${ch.id}`);
      const img = this.add.image(c.x, c.y + 12, open ? 'chest-open' : 'chest').setOrigin(0.5, 28 / 32);
      this.addWorld(img, c.y + 12);
      this.chestSprites.set(ch.id, img);
      this.block(ch.x, ch.y);
    }
    map.signs.forEach((sg) => {
      const c = centre(sg);
      this.addWorld(this.add.image(c.x, c.y + 12, 'sign').setOrigin(0.5, 29 / 32), c.y + 12);
      this.block(sg.x, sg.y);
    });
    for (const p of map.posts) {
      const c = centre(p);
      this.addWorld(this.add.image(c.x, c.y + 10, 'post').setOrigin(0.5, 36 / 40), c.y + 10);
      this.glows.push({ x: c.x, y: c.y - 8, r: 40, col: [255, 220, 120], power: 0.4 });
    }
    for (const pl of map.plates) {
      const c = centre(pl);
      this.addWorld(this.add.image(c.x, c.y, 'plate'), -5000);
    }
    for (const b of map.blocks) {
      const at = hasFlag(s, 'plate') && map.plates[0] ? map.plates[0] : b;
      const c = centre(at);
      const img = this.add.image(c.x, c.y + 16, 'block').setOrigin(0.5, 38 / 42);
      this.addWorld(img, c.y + 16);
      this.blocks.push({ x: at.x, y: at.y, sprite: img });
    }
    for (const d of map.doors) {
      const imgs: Phaser.GameObjects.Image[] = [];
      for (let j = 0; j < d.h; j++)
        for (let i = 0; i < d.w; i++) {
          const key = d.kind === 'key' ? 'door-key' : d.kind === 'bars' ? 'door-bars' : 'door-shut';
          const img = this.add.image((d.x + i) * TILE + 16, (d.y + j + 1) * TILE + 6, key).setOrigin(0.5, 1);
          this.addWorld(img, (d.y + j + 1) * TILE);
          imgs.push(img);
        }
      this.doorSprites.set(d.id, imgs);
    }
    for (const st of map.stones) {
      if (st.x < 0 || s.moonstones.includes(st.id)) continue;
      const c = centre(st);
      const img = this.add.image(c.x, c.y, 'moonstone');
      this.addWorld(img, c.y);
      img.setVisible(st.hidden !== 'buried');
      this.stoneSprites.set(st.id, img);
      if (st.glimmer) this.glimmers.set(st.id, this.addWorld(this.add.image(c.x, c.y + 4, 'glimmer'), -4990).setAlpha(0).setScale(texScale('glimmer') * 1.4));
    }
    // A request's things show once it is asked for, until they are picked up.
    map.finds.forEach((f, i) => {
      if (s.requests[f.req] !== 'taken' || hasFlag(s, `find-${f.req}-${i}`)) return;
      const c = centre(f);
      const key = FIND_ART[f.req].key;
      this.findSprites.set(`${f.req}-${i}`, this.addWorld(this.add.image(c.x, c.y + 4, key).setOrigin(0.5, 0.8), c.y + 4));
    });
    map.enemies.forEach((e, i) => {
      if (DUNGEONS.has(id) && hasFlag(s, this.foeFlag(i)) && !trial) return;
      const c = centre(e);
      this.spawnFoe(e.kind, c.x, c.y, i, e.room);
    });
    if (id === 'shrine' && map.boss && (!hasFlag(s, 'boss') || trial)) this.makeBoss(map.boss);
    if (id === 'belfry' && map.boss && (!hasFlag(s, 'wraith') || trial)) this.makeWraith(map.boss);
    if (id === 'caverns' && map.boss && (!hasFlag(s, 'gloam') || trial)) this.makeGloam(map.boss);
    if (id === 'grotto' && map.pool && (!hasFlag(s, 'brine') || trial)) this.makeBrine(map);
    // The hourglass by a dungeon's entry turns up once chapter two is done and its boss is beaten.
    if (map.hourglass && this.hourglassUp()) {
      const c = centre(map.hourglass);
      this.addWorld(this.add.image(c.x, c.y + 14, 'hourglass').setOrigin(0.5, 45 / 48), c.y + 14);
      this.glows.push({ x: c.x, y: c.y - 6, r: 70, col: [170, 220, 255], power: 0.7 });
      this.block(map.hourglass.x, map.hourglass.y);
    }
    if (map.wisp && !s.moonstones.includes('f-wisp')) {
      const c = centre(map.wisp[0]);
      const img = this.add.image(c.x, c.y, 'wisp');
      this.addWorld(img, c.y + 40);
      this.wisp = { i: 0, sprite: img, hop: 0 };
    }

    s.map = id;
    s.x = x;
    s.y = y;
    s.facing = facing;
    if (!keepSpawn) s.spawn = { map: id, x, y, facing };
    this.player.setPosition(x, y);
    this.applyFacing();
    cam.startFollow(this.player, true, 0.2, 0.2);
    cam.centerOn(x, y);
    this.hud.showPlace(map.name);
    this.updateDoors();
    this.playAreaMusic();
    save(s);
  }

  /** The area's song, or the boss loop while a boss is awake. */
  /**
   * Saves the game, unless the hookvine is pulling the knight: then the save waits until they land
   * on the post, so a reload never puts them (and their spawn) over water or a pit.
   */
  private persist() {
    if (this.hook?.phase === 'pull') this.saveAfterPull = true;
    else save(this.state);
  }

  private playAreaMusic() {
    if (this.boss?.awake) return playMusic(BOSS, 'thornmother');
    if (this.wraith?.awake) return playMusic(BOSS, 'bellwraith');
    if (this.gloam?.awake) return playMusic(BOSS, 'gloamwing');
    if (this.brine?.awake) return playMusic(BOSS, 'brinewyrm');
    switch (this.map.theme) {
      case 'village':
        return playMusic(VILLAGE, 'calm');
      case 'woods':
      case 'fen':
      case 'peaks':
      case 'coast':
        return playMusic(WILDS, this.map.theme);
      case 'shrine':
      case 'belfry':
      case 'caverns':
      case 'grotto':
        return playMusic(DEEP, this.map.theme);
    }
  }

  /** Whether the bosses fight harder: in an hourglass trial and all through a new game+. */
  private get hard() {
    return !!this.trial || this.state.cycle > 0;
  }

  private addWorld<T extends Phaser.GameObjects.Image>(img: T, depth: number) {
    img.setScale(texScale(img.texture.key)).setDepth(depth);
    this.world.push(img);
    return img;
  }

  private addProp(p: Prop) {
    const art = PROP_ART[p.kind];
    const key = p.kind === 'statue' ? `statue-${p.facing ?? 'down'}` : p.kind === 'bell' ? `bell-${p.note ?? 1}` : art.key;
    const x = (p.x + p.w / 2) * TILE;
    const bottom = (p.y + p.h) * TILE;
    const img = this.addWorld(this.add.image(x, bottom, key).setOrigin(0.5, art.foot), bottom - 1);
    if (p.kind === 'bell') this.bells.push({ note: p.note ?? 1, x: p.x, y: p.y, sprite: img });
    if (p.kind === 'mill' || p.kind === 'pinwheel') {
      // The sails (or the pinwheel's head) are their own image, turning once the horn has blown on them.
      const mill = p.kind === 'mill';
      const head = this.addWorld(this.add.image(x, bottom - (mill ? 78 : 25), mill ? 'mill-sails' : 'pinwheel-head'), bottom + 1);
      this.mills.push({ prop: p, cx: x, cy: (p.y + p.h - 0.5) * TILE, head, turned: hasFlag(this.state, this.millKey(p)) });
    }
    if (art.solid) for (let j = 0; j < p.h; j++) for (let i = 0; i < p.w; i++) this.block(p.x + i, p.y + j);
    const top = bottom - this.textures.get(key).getSourceImage().height * texScale(key) * art.foot;
    switch (p.kind) {
      case 'lamp':
        this.glows.push({ x, y: bottom - 54, r: 140, col: WARM, power: 0.95 });
        break;
      case 'brazier':
        this.glows.push({ x, y: bottom - 26, r: 130, col: [255, 160, 80], power: 1 });
        break;
      case 'shroom':
        this.glows.push({ x, y: bottom - 8, r: 70, col: [120, 230, 255], power: 0.7 });
        break;
      case 'candle':
        this.glows.push({ x, y: bottom - 20, r: 90, col: WARM, power: 0.8 });
        break;
      case 'tower':
        this.glows.push({ x, y: top + 60, r: 60, col: [150, 200, 255], power: 0.5 });
        break;
      case 'house':
        for (const dx of [-45, 45]) this.glows.push({ x: x + dx, y: bottom - 45, r: 80, col: WARM, power: 0.75 });
        break;
      case 'hut':
        this.glows.push({ x: x - 28, y: bottom - 30, r: 70, col: WARM, power: 0.7 });
        break;
      case 'arch':
        this.glows.push({ x, y: top + 30, r: 70, col: [150, 200, 240], power: 0.5 });
        break;
      case 'cave':
        this.glows.push({ x, y: top + 50, r: 110, col: [170, 220, 255], power: 0.6 });
        break;
      case 'crystal':
        this.glows.push({ x, y: bottom - 16, r: 90, col: [150, 210, 255], power: 0.75 });
        break;
      case 'campfire':
        this.glows.push({ x, y: bottom - 14, r: 130, col: [255, 160, 80], power: 1 });
        break;
      case 'mill':
        this.glows.push({ x, y: bottom - 56, r: 60, col: WARM, power: 0.6 });
        break;
    }
  }

  /** Marks a tile as blocked by something standing on it. */
  private block(tx: number, ty: number) {
    this.blockers.add(ty * this.map.w + tx);
  }

  private doorClosed(d: Door) {
    const s = this.state;
    if (d.kind === 'key') return !hasFlag(s, `door-${d.id}`);
    if (d.kind === 'bars') return !hasFlag(s, d.flag!);
    // A shut door closes behind the knight while its room still has foes (or its queen) in it.
    const room = this.map.rooms.find((r) => r.id === d.room);
    if (!room) return false;
    // Only once the knight's whole feet box is in the room, so the door never shuts on their feet.
    const inside = FEET.every(([dx, dy]) => {
      const tx = Math.floor((s.x + dx) / TILE);
      const ty = Math.floor((s.y + dy) / TILE);
      return tx >= room.x && tx < room.x + room.w && ty >= room.y && ty < room.y + room.h;
    });
    if (!inside) return false;
    if (d.room === 'boss') return !!this.boss || !!this.wraith || !!this.gloam || !!this.brine;
    return this.foes.some((f) => f.alive && f.room === d.room);
  }

  private closedDoors = new Set<number>();

  private updateDoors() {
    this.closedDoors.clear();
    let slam = false;
    for (const d of this.map.doors) {
      const closed = this.doorClosed(d);
      // Room doors only: a key door and bars have their own sounds (unlock, the solved chime).
      if (d.kind === 'shut' && this.doorWas.has(d.id) && this.doorWas.get(d.id) !== closed) slam = true;
      this.doorWas.set(d.id, closed);
      for (const img of this.doorSprites.get(d.id) ?? []) img.setVisible(closed);
      if (closed) for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) this.closedDoors.add((d.y + j) * this.map.w + d.x + i);
    }
    if (slam) sfx('door');
  }

  /** Whether the knight can't walk onto a tile. A hidden bridge holds only where the Moonlantern shines. */
  solidTile(tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) return true;
    const k = ty * this.map.w + tx;
    const tile = tileAt(this.map, tx, ty);
    const solid = tile === 'veil' ? !this.lit(tx, ty) : SOLID.has(tile);
    return solid || this.blockers.has(k) || this.closedDoors.has(k) || this.blocks.some((b) => b.x === tx && b.y === ty);
  }

  /** How strongly the Moonlantern lights a tile, 0 to 1 (0 without it). */
  private moonlight(x: number, y: number, reach: number) {
    if (!this.state.items.moonlantern) return 0;
    return Phaser.Math.Clamp(1.4 - Math.hypot(x - this.state.x, y - (this.state.y - 6)) / reach, 0, 1);
  }

  /** Whether the Moonlantern's light reaches a hidden bridge's tile. */
  private lit(tx: number, ty: number) {
    return this.moonlight((tx + 0.5) * TILE, (ty + 0.5) * TILE, VEIL_PX) > 0;
  }

  /** Things that stand on tiles, for foes (which can't walk through people or blocks either). */
  private standing = (tx: number, ty: number) => {
    const k = ty * this.map.w + tx;
    return this.blockers.has(k) || this.closedDoors.has(k) || this.blocks.some((b) => b.x === tx && b.y === ty);
  };

  /** Whether the knight's feet fit at (x, y). */
  private free(x: number, y: number) {
    for (const [dx, dy] of FEET) if (this.solidTile(Math.floor((x + dx) / TILE), Math.floor((y + dy) / TILE))) return false;
    return true;
  }

  // ---------------------------------------------------------------- input

  private onKey(e: KeyboardEvent) {
    if (e.repeat) return; // a held key acts once
    const code = e.code;
    if (this.hud.shopOpen) {
      const i = Number(code.replace('Digit', '')) - 1;
      if (code.startsWith('Digit') && i >= 0) this.hud.pressShop(i);
      else if (code === 'Escape' || code === 'Space' || code === 'Enter' || code === 'KeyN') this.hud.closeShop();
      return;
    }
    if (this.hud.pageOpen && ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Tab'].includes(code)) return this.turnPage();
    if (code === 'KeyN' || (this.hud.pageOpen && (code === 'Escape' || code === 'Space' || code === 'Enter'))) return this.toggleStones();
    if (this.hud.covered || this.fading) return;
    if (this.dialog) {
      if (code === 'Space' || code === 'Enter' || code === 'KeyJ') this.nextLine();
      return;
    }
    if (code === 'Space' || code === 'Enter' || code === 'KeyJ') this.act();
    else if (code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyK') this.startRoll();
    else if (code === 'KeyQ' || code === 'KeyE' || code === 'KeyL') this.fireVine();
    else if (code === 'KeyB' || code === 'KeyX') this.plantSeed();
    else if (code === 'KeyH' || code === 'KeyC') this.blowHorn();
  }

  private onPointer(pointer: Phaser.Input.Pointer) {
    if (this.hud.pageOpen) return this.toggleStones();
    // A tap off the shop's buttons closes it (a button stops the tap from getting here).
    if (this.hud.shopOpen) return this.hud.closeShop();
    if (this.hud.covered || this.fading) return;
    if (this.dialog) {
      this.nextLine();
      return;
    }
    // A tap anywhere pulls in a line in the water.
    if (this.fishing) return this.reel();
    if (this.hud.plateAt(viewPoint(pointer))) return this.toggleStones();
    const btn = this.hud.buttonAt(viewPoint(pointer), this.state);
    if (btn === 'sword') return this.act();
    if (btn === 'roll') return this.startRoll();
    if (btn === 'vine') return this.fireVine();
    if (btn === 'seed') return this.plantSeed();
    if (btn === 'horn') return this.blowHorn();
    const w = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    if (!pointer.wasTouch) return this.tapWorld(w.x, w.y);
    // A touch waits to see whether it is a tap or the start of a steering drag.
    if (this.stick) return;
    const v = viewPoint(pointer);
    this.stick = { id: pointer.id, ox: v.x, oy: v.y, x: v.x, y: v.y, wx: w.x, wy: w.y, live: false };
  }

  /** Moves the stick's knob to the finger; past the rim the base is dragged along behind it. */
  private onPointerMove(pointer: Phaser.Input.Pointer) {
    const st = this.stick;
    if (!st || st.id !== pointer.id) return;
    const v = viewPoint(pointer);
    st.x = v.x;
    st.y = v.y;
    const d = Math.hypot(st.x - st.ox, st.y - st.oy);
    if (!st.live && d > STICK.drag) {
      st.live = true;
      this.route = null;
      this.target = null;
    }
    if (d > STICK.r) {
      const k = (d - STICK.r) / d;
      st.ox += (st.x - st.ox) * k;
      st.oy += (st.y - st.oy) * k;
    }
  }

  private onPointerUp(pointer: Phaser.Input.Pointer) {
    const st = this.stick;
    if (!st || st.id !== pointer.id) return;
    this.stick = null;
    if (!st.live && !this.dialog && !this.hud.covered && !this.fading) this.tapWorld(st.wx, st.wy);
  }

  /** Where a tap in the world sends the knight, and what they do there. */
  tapWorld(wx: number, wy: number) {
    const s = this.state;
    const tx = Math.floor(wx / TILE);
    const ty = Math.floor(wy / TILE);
    const foe = this.foes.find((f) => f.alive && Math.hypot(f.x - wx, f.y - (f.kind === 'lantern' && f.down <= 0 ? LANTERN_LIFT + 6 : 10) - wy) < 26);
    if (foe && s.items.sword) return this.goTo({ kind: 'foe', foe }, Math.floor(foe.x / TILE), Math.floor(foe.y / TILE));
    for (const n of this.map.npcs) {
      const c = centre(n);
      if (Math.hypot(c.x - wx, c.y - 6 - wy) < 24) return this.goTo({ kind: 'npc', id: n.id }, n.x, n.y);
    }
    const chest = this.map.chests.find((c) => c.x === tx && c.y === ty);
    if (chest) return this.goTo({ kind: 'chest', id: chest.id }, tx, ty);
    const sign = this.map.signs.findIndex((g) => g.x === tx && g.y === ty);
    if (sign >= 0) return this.goTo({ kind: 'sign', i: sign }, tx, ty);
    if (this.blocks.some((b) => b.x === tx && b.y === ty)) return this.goTo({ kind: 'block', tx, ty }, tx, ty);
    if (this.closedDoors.has(ty * this.map.w + tx)) return this.goTo({ kind: 'door', tx, ty }, tx, ty);
    if (this.hourglassAt(tx, ty)) return this.goTo({ kind: 'hourglass', tx, ty }, tx, ty);
    if (s.items.sword && this.bells.some((b) => b.x === tx && b.y === ty)) return this.goTo({ kind: 'ring', tx, ty }, tx, ty);
    if (s.items.seeds && BREAKABLE.has(tileAt(this.map, tx, ty))) return this.goTo({ kind: 'plant', tx, ty }, tx, ty);
    if (s.items.sword && CUTTABLE.has(tileAt(this.map, tx, ty))) return this.goTo({ kind: 'cut', tx, ty }, tx, ty);
    const buried = this.map.stones.find((st) => st.hidden === 'buried' && st.x === tx && st.y === ty && !this.dug.has(st.id));
    if (buried && s.items.sword) return this.goTo({ kind: 'dig', tx, ty }, tx, ty, true);
    if (this.map.props.some((p) => p.kind === 'campfire' && p.x === tx && p.y === ty)) return this.goTo({ kind: 'cook', tx, ty }, tx, ty);
    if (this.fishable(tx, ty)) return this.goTo({ kind: 'fish', tx, ty }, tx, ty);
    this.target = null;
    this.walkTo(tx, ty);
  }

  /** Walks to a free tile and returns whether there is a way. */
  private walkTo(tx: number, ty: number) {
    const s = this.state;
    const from = { x: Math.floor(s.x / TILE), y: Math.floor(s.y / TILE) };
    const path = findPath(this.map.w, this.map.h, (x, y) => (x === from.x && y === from.y ? false : this.solidTile(x, y)), from, { x: tx, y: ty });
    this.route = path ? path.slice(1) : null;
    return !!path;
  }

  /** Walks next to a target tile (or onto it, for digging) and then acts on it. */
  private goTo(target: Target, tx: number, ty: number, onto = false) {
    const s = this.state;
    const here = { x: Math.floor(s.x / TILE), y: Math.floor(s.y / TILE) };
    this.target = target;
    if (onto) {
      if (here.x === tx && here.y === ty) return this.arrive();
      if (!this.walkTo(tx, ty)) this.target = null;
      return;
    }
    if (Math.abs(here.x - tx) + Math.abs(here.y - ty) === 1) return this.arrive();
    let best: Step[] | null = null;
    for (const d of Object.values(DIRS)) {
      const nx = tx + d.x;
      const ny = ty + d.y;
      if (this.solidTile(nx, ny) && !(nx === here.x && ny === here.y)) continue;
      const path = findPath(this.map.w, this.map.h, (x, y) => (x === here.x && y === here.y ? false : this.solidTile(x, y)), here, { x: nx, y: ny });
      if (path && (!best || path.length < best.length)) best = path;
    }
    if (!best) {
      this.target = null;
      return;
    }
    this.route = best.slice(1);
    if (!this.route.length) this.arrive();
  }

  /** At the end of a tap's walk: face the target and act on it. */
  private arrive() {
    const t = this.target;
    this.route = null;
    if (!t) return;
    const s = this.state;
    if (t.kind === 'foe') return;
    this.target = null;
    const at =
      t.kind === 'npc' ? this.map.npcs.find((n) => n.id === t.id)! : t.kind === 'chest' ? this.map.chests.find((c) => c.id === t.id)! : t.kind === 'sign' ? this.map.signs[t.i] : { x: t.tx, y: t.ty };
    const dx = at.x + 0.5 - s.x / TILE;
    const dy = at.y + 0.5 - s.y / TILE;
    if (t.kind !== 'dig') s.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    this.applyFacing();
    if (t.kind === 'cut' || t.kind === 'dig' || t.kind === 'ring') this.startSwing();
    else if (t.kind === 'plant') this.plantSeed();
    else if (t.kind === 'fish') this.startFishing(t.tx, t.ty);
    else this.interactAt(at.x, at.y);
  }

  /** Space, J or the sword button: talk to or use what is in front, else swing the sword. */
  private act() {
    const s = this.state;
    if (this.fishing) return this.reel();
    const d = DIRS[s.facing];
    const tx = Math.floor((s.x + d.x * 22) / TILE);
    const ty = Math.floor((s.y - 4 + d.y * 22) / TILE);
    if (this.interactAt(tx, ty)) return;
    // Facing water with the rod, the knight casts, unless a foe is close enough to swing at.
    const foeNear = this.foes.some((f) => f.alive && Math.hypot(f.x - (s.x + d.x * SWING_REACH), f.y - s.y - d.y * SWING_REACH) < 44);
    if (this.fishable(tx, ty) && !foeNear) return this.startFishing(tx, ty);
    this.startSwing();
  }

  /** Talks to, opens, reads or pushes what is on a tile. Returns whether there was anything. */
  private interactAt(tx: number, ty: number): boolean {
    const s = this.state;
    const npc = this.map.npcs.find((n) => n.x === tx && n.y === ty);
    if (npc) {
      const said = talk(npc.id, s);
      this.openDialog(npc.name, said.lines, said.then);
      return true;
    }
    const chest = this.map.chests.find((c) => c.x === tx && c.y === ty);
    if (chest) {
      if (!hasFlag(s, `chest-${chest.id}`)) this.openChest(chest.id, chest.item);
      else {
        ui('refuse');
        this.hud.toast(t('empty'));
      }
      return true;
    }
    if (this.map.props.some((p) => p.kind === 'campfire' && p.x === tx && p.y === ty)) {
      this.openCook();
      return true;
    }
    if (this.hourglassAt(tx, ty)) {
      if (this.trial) {
        ui('refuse');
        this.hud.toast(t('trialBusy'));
        return true;
      }
      const best = s.trials[this.map.id];
      const lines = [t('hourglassRead')];
      if (best !== undefined) lines.push(t('hourglassBest', { time: clock(best) }));
      this.openDialog('', lines, 'trial');
      return true;
    }
    const sign = this.map.signs.find((g) => g.x === tx && g.y === ty);
    if (sign) {
      this.openDialog(t('sign'), [sign.text]);
      return true;
    }
    if (this.blocks.some((b) => b.x === tx && b.y === ty)) {
      this.push(tx, ty);
      return true;
    }
    const door = this.map.doors.find((d) => tx >= d.x && tx < d.x + d.w && ty >= d.y && ty < d.y + d.h);
    if (door && this.closedDoors.has(ty * this.map.w + tx)) {
      if (door.kind === 'key' && s.keys > 0) {
        s.keys--;
        setFlag(s, `door-${door.id}`);
        sfx('unlock');
        this.hud.toast(t('unlocked'));
        this.updateDoors();
        this.persist();
      } else {
        ui('refuse');
        if (door.kind === 'key') this.hud.toast(t('locked'));
        else if (door.kind === 'bars') this.hud.toast(t('barred'));
        else this.hud.toast(t('thornyDoor'));
      }
      return true;
    }
    return false;
  }

  /** Whether the dungeon's hourglass stands on a tile (it is there only after chapter two). */
  private hourglassAt(tx: number, ty: number) {
    const h = this.map.hourglass;
    return !!h && h.x === tx && h.y === ty && this.hourglassUp();
  }

  /** Whether this map's hourglass has turned up: after chapter two, once its own boss is beaten. */
  private hourglassUp() {
    const flag = BOSS_FLAG[this.map.id];
    return reached(this.state, 'end') && (!flag || hasFlag(this.state, flag));
  }

  /** Turns the hourglass: the dungeon is built again with its foes and its boss back, and the clock runs. */
  private startTrial() {
    const s = this.state;
    this.trial = { map: this.map.id, ms: 0 };
    sfx('swell');
    this.fadeTo(() => {
      this.enterMap(s.map, s.x, s.y, s.facing, true);
      this.hud.toast(t('trialStart'));
    });
  }

  /** The trial's boss is down: the clock stops and a best time is kept. */
  private trialWon() {
    const s = this.state;
    const ms = this.trial!.ms;
    const id = this.map.id;
    this.trial = null;
    const best = s.trials[id];
    const record = best === undefined || ms < best;
    if (record) s.trials[id] = ms;
    this.openDialog('', [t('trialDone', { time: clock(ms) }), record ? t('trialRecord') : t('trialBestIs', { time: clock(best!) })]);
    this.persist();
  }

  /** Opens the moonstone page, or closes it. */
  private toggleStones() {
    if (this.hud.pageOpen) {
      this.hud.closeStones();
      return;
    }
    if (this.hud.covered || this.dialog) return;
    this.pageTab = 'journal';
    ui('click');
    this.showPage();
  }

  private showJournal() {
    const s = this.state;
    const rows = MAP_IDS.map((id) => buildMap(id))
      .map((m) => {
        const ids = m.stones.filter((st) => stoneCounts(s, st.chapter)).map((st) => st.id);
        return { name: m.name, found: ids.filter((i) => s.moonstones.includes(i)).length, total: ids.length };
      })
      .filter((r) => r.total > 0);
    const trials = reached(s, 'end')
      ? (['shrine', 'belfry', 'caverns', 'grotto'] as const)
          .filter((id) => (id !== 'caverns' || hasFlag(s, 'gloam')) && (id !== 'grotto' || hasFlag(s, 'brine')))
          .map((id) => ({ place: t(id), ms: s.trials[id] }))
      : [];
    const requests = REQUESTS.filter((r) => s.requests[r.id]).map((r) => ({
      text: t('requestRow', { giver: t(NPC_NAME[r.giver]), name: t(REQUEST_NAME[r.id]) }),
      state: s.requests[r.id] === 'done' ? t('requestDone') : t('requestProgress', { n: Math.min(r.count, found(s, r.id)), total: r.count }),
      done: s.requests[r.id] === 'done',
    }));
    // The creel and the meal, once there is a rod.
    const larder = s.items.rod
      ? `${t('creel', { perch: s.fish.perch, eel: s.fish.eel, bream: s.fish.bream })}   ·   ${s.meal ? t('mealNow', { meal: t(s.meal) }) : t('mealNone')}`
      : '';
    this.hud.showStones(rows, trials, requests, s.cycle > 0 ? t('plusLevel', { n: s.cycle }) : '', larder, () => this.turnPage());
  }

  /** The bestiary: each family's kinds, named once one is beaten, with how many, and whether the family's perk is earned. */
  private showBestiary() {
    const b = this.state.bestiary;
    const families = FAMILIES.map((fam) => ({
      name: t(fam.id),
      done: familyDone(b, fam.id),
      kinds: fam.kinds.map((k) => ({ key: FOE_PAGE[k].key, name: b[k] ? t(FOE_PAGE[k].name) : t('unknownFoe'), n: b[k] ?? 0 })),
    }));
    this.hud.showBestiary(families, PAGE_AT, () => this.turnPage());
  }

  /** Opens the journal's open side. */
  private showPage() {
    this.route = null;
    this.target = null;
    this.stick = null;
    if (this.pageTab === 'bestiary') this.showBestiary();
    else this.showJournal();
  }

  /** Turns from the journal to the bestiary or back. */
  private turnPage() {
    if (!this.hud.pageOpen) return;
    this.hud.closeStones();
    this.pageTab = this.pageTab === 'journal' ? 'bestiary' : 'journal';
    ui('click');
    this.showPage();
  }

  private openChest(id: string, item: ItemId) {
    const s = this.state;
    setFlag(s, `chest-${id}`);
    this.chestSprites.get(id)?.setTexture('chest-open').setScale(texScale('chest-open'));
    give(s, item);
    sfx('creak');
    playSting(STINGS, 'item');
    const text: Record<ItemId, string> = {
      sword: t('foundSword'),
      hookvine: t('foundHookvine'),
      key: t('foundKey'),
      heart: t('foundHeart'),
      oil: t('foundOil'),
      seeds: t('foundSeeds', { n: s.seeds }),
      moonlantern: t('foundMoonlantern'),
      horn: t('foundHorn'),
      rod: t('foundRod'),
    };
    // The Moonlantern is chapter three's tool: finding it points the story at the caverns. The gust horn does the same for the sea cave.
    if (item === 'moonlantern' && s.quest === 'peaks') advance(s, 'caverns');
    if (item === 'horn' && s.quest === 'coast') advance(s, 'seacave');
    this.openDialog('', [text[item]]);
    this.persist();
  }

  private openDialog(speaker: string, lines: string[], then?: Dialog['then']) {
    this.dialog = { speaker, lines, i: 0, then };
    this.route = null;
    this.target = null;
    this.blip();
  }

  /** A line of talk's blip, pitched by who is speaking (the same speaker always sounds the same). */
  private blip() {
    const speaker = this.dialog?.speaker ?? '';
    let hash = 0;
    for (const ch of speaker) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
    sfx('blip', { pitch: speaker ? 0.75 + (hash % 11) * 0.06 : 1 });
  }

  private nextLine() {
    const d = this.dialog;
    if (!d) return;
    d.i++;
    if (d.i < d.lines.length) return this.blip();
    this.dialog = null;
    if (d.then) this.effect(d.then);
  }

  private effect(e: TalkEffect) {
    const s = this.state;
    if (e.startsWith('take-')) return this.takeRequest(e.slice(5) as RequestId);
    if (e.startsWith('reward-')) return this.handIn(e.slice(7) as RequestId);
    switch (e) {
      case 'quest-blade':
        advance(s, 'blade');
        this.hud.toast(t('newQuestBlade'));
        break;
      case 'quest-thorns':
        advance(s, 'thorns');
        // The gate may already be cut, if the knight went there before coming back.
        if (hasFlag(s, 'gate-cut')) advance(s, 'shrine');
        this.hud.toast(t('doneQuestBlade'));
        break;
      case 'cat-pet':
        setFlag(s, hasFlag(s, 'cat-1') ? 'cat-2' : 'cat-1');
        break;
      case 'cat-stone':
        setFlag(s, 'cat-3');
        this.gainStone('v-cat');
        break;
      case 'finish':
        advance(s, 'done');
        this.chapterEnd(1);
        break;
      case 'quest-bell':
        advance(s, 'bell');
        this.hud.toast(t('newQuestBell'));
        break;
      case 'seeds':
        advance(s, 'belfry');
        give(s, 'seeds');
        this.openDialog('', [t('gotSeeds', { n: s.seeds })]);
        break;
      case 'refill':
        s.seeds = maxSeeds(s);
        sfx('pod');
        this.hud.toast(t('seedsRefilled', { n: s.seeds }));
        this.openShop('hermit');
        break;
      case 'shop-baker':
        this.openShop('baker');
        break;
      case 'shop-hermit':
        this.openShop('hermit');
        break;
      case 'finish-two':
        advance(s, 'end');
        this.chapterEnd(2);
        break;
      case 'quest-peaks':
        advance(s, 'peaks');
        this.hud.toast(t('newQuestPeaks'));
        break;
      case 'finish-three':
        advance(s, 'final');
        this.chapterEnd(3);
        break;
      case 'quest-coast':
        advance(s, 'coast');
        this.hud.toast(t('newQuestCoast'));
        break;
      case 'finish-four':
        advance(s, 'after');
        this.chapterEnd(4);
        break;
      case 'plus-offer':
        this.offerPlus();
        return;
      case 'trial':
        this.startTrial();
        return;
    }
    this.persist();
  }

  /** A villager's request taken: its things show where they lie. */
  private takeRequest(id: RequestId) {
    const s = this.state;
    s.requests[id] = 'taken';
    this.hud.toast(t('newRequest', { name: t(REQUEST_NAME[id]) }));
    this.persist();
    // Things of this request lying on this map show at once.
    this.map.finds.forEach((f, i) => {
      if (f.req !== id || hasFlag(s, `find-${id}-${i}`)) return;
      const c = centre(f);
      this.findSprites.set(`${id}-${i}`, this.addWorld(this.add.image(c.x, c.y + 4, FIND_ART[id].key).setOrigin(0.5, 0.8), c.y + 4));
    });
  }

  /** A request's things handed in: it is done and pays its reward. */
  private handIn(id: RequestId) {
    const s = this.state;
    reward(s, id);
    ui('coin');
    playSting(STINGS, 'item');
    this.hud.toast(t('doneRequest', { name: t(REQUEST_NAME[id]) }));
    this.openDialog('', [t(FIND_ART[id].reward)]);
    this.persist();
  }

  /** Elder Wren's offer to begin again, kept from the first night with the tools. */
  private offerPlus() {
    this.route = null;
    this.target = null;
    this.stick = null;
    this.hud.showEnd(t('plusTitle'), [t('plusText')], [{ label: t('plusNotYet') }, { label: t('plusBegin'), fn: () => this.startPlus() }]);
  }

  /** New game+: the kingdom starts over, the knight keeps their tools, and the foes and moonstones change. */
  private startPlus() {
    this.trial = null;
    this.state = newPlus(this.state);
    save(this.state);
    this.enterMap(this.state.map, this.state.x, this.state.y, this.state.facing, false);
    this.hud.toast(t('plusStart', { n: this.state.cycle }));
  }

  /** Each chapter's end card: its title, its moonstones, how many make the middle ending, and the three endings. */
  private static readonly ENDS = {
    1: { title: 'chapterOne', total: CHAPTER_ONE_STONES, many: 4, all: 'endOneAll', some: 'endOneSome', few: 'endOneFew' },
    2: { title: 'chapterTwo', total: CHAPTER_TWO_STONES, many: 10, all: 'endTwoAll', some: 'endTwoSome', few: 'endTwoFew' },
    3: { title: 'chapterThree', total: CHAPTER_THREE_STONES, many: 14, all: 'endThreeAll', some: 'endThreeSome', few: 'endThreeFew' },
    4: { title: 'chapterFour', total: MOONSTONES, many: 18, all: 'endFourAll', some: 'endFourSome', few: 'endFourFew' },
  } as const;

  private chapterEnd(chapter: 1 | 2 | 3 | 4) {
    const s = this.state;
    const n = s.moonstones.length;
    const end = GameScene.ENDS[chapter];
    const ending = n >= end.total ? t(end.all) : n >= end.many ? t(end.some) : t(end.few);
    playSting(STINGS, n >= end.total ? 'endAll' : n >= end.many ? 'endSome' : 'endFew');
    const buttons: { label: string; fn?: () => void }[] = [
      { label: t('keepExploring') },
      {
        label: t('newGame'),
        fn: () => {
          clearSave();
          this.trial = null;
          this.state = newState();
          this.enterMap(this.state.map, this.state.x, this.state.y, this.state.facing, false);
        },
      },
    ];
    // After the last chapter the knight can also begin again, keeping their tools.
    if (chapter === 4) buttons.push({ label: t('newGamePlus'), fn: () => this.startPlus() });
    this.hud.showEnd(t(end.title), [t('endStats', { n, total: end.total, beaten: s.beaten, falls: s.falls }), ending], buttons);
  }

  private gainStone(id: string) {
    const s = this.state;
    if (s.moonstones.includes(id)) return;
    s.moonstones.push(id);
    this.stoneSprites.get(id)?.destroy();
    this.stoneSprites.delete(id);
    sfx('stone');
    this.hud.toast(t('moonstone', { n: s.moonstones.length, total: stonesToFind(s) }));
    this.persist();
  }

  // ---------------------------------------------------------------- actions

  private startSwing() {
    const s = this.state;
    if (!s.items.sword || this.swingCd > 0 || this.roll || this.hook) return;
    this.swing = { t: 0, dir: s.facing };
    this.swingCd = SWING_COOLDOWN_MS;
    sfx('swing');
    const d = DIRS[s.facing];
    // Pip's whetstone makes the blade reach farther.
    const sharp = hasUpgrade(s, 'whetstone') ? WHETSTONE : 1;
    const hx = s.x + d.x * SWING_REACH * sharp;
    const hy = s.y - 10 + d.y * SWING_REACH * sharp;
    const reach = SWING_RADIUS * sharp;
    // Foes and the Thornmother's bulbs in reach.
    for (const f of this.foes) if (f.alive && Math.hypot(f.x - hx, f.y - 8 - hy) < reach + 12) this.hitFoe(f, d);
    if (this.boss) for (const b of this.boss.bulbs) if (b.state === 'down' && Math.hypot(b.x - hx, b.y - 10 - hy) < SWING_RADIUS + 14) this.hitBulb(b);
    const w = this.wraith;
    if (w && (w.state === 'tipped' || w.state === 'down') && Math.hypot(w.x - hx, w.y - 12 - hy) < SWING_RADIUS + 26) this.hitWraith();
    const g = this.gloam;
    if (g && (g.state === 'down' || g.state === 'low') && Math.hypot(g.x - hx, g.y - g.lift - 10 - hy) < reach + 26) this.hitGloam();
    const bw = this.brine;
    if (bw && (bw.state === 'beached' || bw.state === 'up') && Math.hypot(bw.x - hx, bw.y - 12 - hy) < reach + 30) this.hitBrine();
    // The belfry's bells, one at a time.
    const bell = this.bells.find((b) => Math.hypot((b.x + 0.5) * TILE - hx, (b.y + 0.5) * TILE - hy) < SWING_RADIUS + 14);
    if (bell) this.ringBell(bell);
    // Bushes and thorns: the tile in front, and the one the blade's tip reaches.
    const tiles = new Set<string>();
    for (const r of [16, SWING_REACH + 8]) tiles.add(`${Math.floor((s.x + d.x * r) / TILE)},${Math.floor((s.y - 4 + d.y * r) / TILE)}`);
    for (const k of tiles) {
      const [tx, ty] = k.split(',').map(Number);
      if (CUTTABLE.has(tileAt(this.map, tx, ty))) this.cut(tx, ty);
    }
    // A swing on a buried moonstone's spot digs it up.
    for (const st of this.map.stones)
      if (
        st.hidden === 'buried' &&
        !this.dug.has(st.id) &&
        !s.moonstones.includes(st.id) &&
        ((Math.floor(s.x / TILE) === st.x && Math.floor(s.y / TILE) === st.y) || Math.hypot((st.x + 0.5) * TILE - hx, (st.y + 0.5) * TILE - hy) <= 32)
      ) {
        this.dug.add(st.id);
        this.stoneSprites.get(st.id)?.setVisible(true);
        this.glimmers.get(st.id)?.destroy();
        this.glimmers.delete(st.id);
        sfx('glint');
        this.hud.toast(t('glint'));
      }
  }

  private cut(tx: number, ty: number) {
    const s = this.state;
    const tile = tileAt(this.map, tx, ty);
    const thorns = tile === 'thorns';
    setTile(this.map, tx, ty, thorns ? 'path' : 'grass');
    const k = ty * this.map.w + tx;
    const img = this.bushSprites.get(k);
    sfx('cut', { pitch: thorns ? 0.8 : 1 });
    if (img) {
      this.puff(img.x, img.y - 10, thorns ? 0x7a3f5a : 0x4a8c44);
      img.destroy();
      this.bushSprites.delete(k);
    }
    if (thorns) {
      // Thorns grow in pairs across a way; cutting one clears its twin.
      for (const dx of [-1, 1]) if (tileAt(this.map, tx + dx, ty) === 'thorns') this.cut(tx + dx, ty);
      if (this.map.id === 'village' && ty === 3) {
        setFlag(s, 'gate-cut');
        if (s.quest === 'thorns') {
          advance(s, 'shrine');
          this.hud.toast(t('gateOpen'));
        }
      }
      if (this.map.id === 'woods') setFlag(s, 'woods-thorns');
      this.persist();
    } else if (Math.random() < 0.2) this.dropHeart((tx + 0.5) * TILE, (ty + 0.5) * TILE);
    else if (s.items.seeds && Math.random() < 0.3) this.dropPod((tx + 0.5) * TILE, (ty + 0.5) * TILE);
    else if (Math.random() < 0.4) this.dropCoin((tx + 0.5) * TILE, (ty + 0.5) * TILE);
  }

  private ringBell(bell: GameScene['bells'][number]) {
    const s = this.state;
    const c = centre(bell);
    sfx('bell', { pitch: BELL_PITCH[bell.note] });
    this.hud.toast(t(BELL_SOUND[bell.note]));
    if (!settings.reduceMotion) {
      this.tweens.add({ targets: bell.sprite, angle: { from: -14, to: 14 }, duration: 160, yoyo: true, repeat: 1, onComplete: () => bell.sprite.setAngle(0) });
      this.flashes.push({ x: c.x, y: c.y - 14, r: 90, col: [255, 210, 130], power: 0.8, t: 500 });
    }
    if (hasFlag(s, 'bells')) return;
    this.bellSeq.push(bell.note);
    const i = this.bellSeq.length - 1;
    if (this.bellSeq[i] !== BELL_ORDER[i]) {
      this.bellSeq = [];
      this.time.delayedCall(500, () => {
        sfx('wrong');
        this.hud.toast(t('bellsWrong'));
      });
      return;
    }
    if (this.bellSeq.length < BELL_ORDER.length) return;
    setFlag(s, 'bells');
    this.time.delayedCall(500, () => {
      sfx('chime');
      this.hud.toast(t('bellsRight'));
    });
    this.persist();
  }

  // ---------------------------------------------------------------- bellseeds

  /** Plants a bellseed in front of the knight; it bursts after FUSE_MS. */
  private plantSeed() {
    const s = this.state;
    if (!s.items.seeds || this.roll || this.hook || this.fishing || this.bombs.length >= 2) return;
    if (s.seeds <= 0) {
      ui('refuse');
      this.hud.toast(t('noSeeds'));
      return;
    }
    const d = DIRS[s.facing];
    let x = s.x + d.x * PLANT_REACH;
    let y = s.y + d.y * PLANT_REACH;
    const tx = Math.floor(x / TILE);
    const ty = Math.floor(y / TILE);
    // Against a plain wall the seed drops at the knight's feet; against cracked stone it sits right on it.
    if (this.solidTile(tx, ty) && !BREAKABLE.has(tileAt(this.map, tx, ty))) {
      x = s.x;
      y = s.y + 2;
    }
    s.seeds--;
    const sprite = this.add.image(x, y, 'bellseed').setOrigin(0.5, 19 / 22).setScale(texScale('bellseed')).setDepth(y);
    this.world.push(sprite);
    const bomb = { x, y, t: FUSE_MS, sprite };
    this.bombs.push(bomb);
    this.ticks.set(bomb, FUSE_MS - 300);
    sfx('plant');
    this.route = null;
    this.target = null;
  }

  private updateBombs(dt: number) {
    for (const b of this.bombs) {
      b.t -= dt;
      // The fuse ticks every 300ms, then quickly once it starts to flicker.
      if (b.t > 0 && b.t <= (this.ticks.get(b) ?? 0)) {
        sfx('tick', { pitch: b.t < 450 ? 1.3 : 1 });
        this.ticks.set(b, b.t - (b.t < 450 ? 100 : 300));
      }
      const grow = 1 + (1 - b.t / FUSE_MS) * 0.45;
      b.sprite.setScale(texScale('bellseed') * grow);
      // It flickers just before it bursts; held steady with reduce motion on.
      const flick = b.t < 450 && !settings.reduceMotion && Math.floor(b.t / 70) % 2 === 0;
      if (flick) b.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else b.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
    }
    const done = this.bombs.filter((b) => b.t <= 0);
    if (!done.length) return;
    this.bombs = this.bombs.filter((b) => b.t > 0);
    for (const b of done) {
      b.sprite.destroy();
      this.burst(b.x, b.y);
    }
  }

  /** A bellseed goes off: it breaks rock, cuts bushes, hurts foes (and the knight) and tips the Bellwraith's bell. */
  private burst(x: number, y: number) {
    const s = this.state;
    sfx('boom');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const dot = this.add.circle(x, y - 6, 4, i % 2 ? 0xd8f08a : 0xf0d070).setDepth(y + 2);
      this.tweens.add({ targets: dot, x: x + Math.cos(a) * BURST_PX, y: y - 6 + Math.sin(a) * BURST_PX * 0.7, alpha: 0, duration: 380, onComplete: () => dot.destroy() });
    }
    if (!settings.reduceMotion) {
      this.cameras.main.shake(160, 0.006);
      this.flashes.push({ x, y: y - 8, r: 140, col: [230, 255, 160], power: 1, t: 350 });
    }
    const tx0 = Math.floor(x / TILE);
    const ty0 = Math.floor(y / TILE);
    for (let ty = ty0 - 2; ty <= ty0 + 2; ty++)
      for (let tx = tx0 - 2; tx <= tx0 + 2; tx++) {
        const t = tileAt(this.map, tx, ty);
        if (Math.hypot((tx + 0.5) * TILE - x, (ty + 0.5) * TILE - y) > BURST_PX + 8) continue;
        if (BREAKABLE.has(t)) this.breakRock(tx, ty);
        else if (t === 'bush') this.cut(tx, ty);
      }
    for (const f of this.foes)
      if (f.alive && Math.hypot(f.x - x, f.y - y) < BURST_PX + 8) {
        const d = { x: Math.sign(f.x - x), y: Math.sign(f.y - y) };
        if (ARMOURED.has(f.kind)) this.knockDown(f);
        this.hitFoe(f, d);
        f.hurt = 0;
        if (f.alive) this.hitFoe(f, d);
      }
    if (Math.hypot(s.x - x, s.y - y) < BURST_PX * 0.8) this.hurt(1, { x, y });
    const w = this.wraith;
    if (w && w.state === 'down' && Math.hypot(w.x - x, w.y - y) < BURST_PX + 30) this.tipBell();
  }

  /** Clears a boulder or cracked wall from a map's tiles. */
  private clearRock(map: MapDef, tx: number, ty: number) {
    const t = tileAt(map, tx, ty);
    if (t === 'crack') setTile(map, tx, ty, 'floor');
    else if (t === 'boulder') setTile(map, tx, ty, underBoulder(map, tx, ty));
  }

  private breakRock(tx: number, ty: number) {
    const s = this.state;
    const crack = tileAt(this.map, tx, ty) === 'crack';
    this.clearRock(this.map, tx, ty);
    setFlag(s, `broke-${this.map.id}-${tx}-${ty}`);
    const k = ty * this.map.w + tx;
    this.bushSprites.get(k)?.destroy();
    this.bushSprites.delete(k);
    this.puff((tx + 0.5) * TILE, (ty + 0.5) * TILE, 0x8a8c94);
    sfx('crumble');
    // A cracked wall is part of the ground's picture, so the ground is painted again.
    if (crack) {
      paintGround(this, this.map);
      this.ground.setTexture(groundKey(this.map));
    }
    this.persist();
  }

  private dropPod(x: number, y: number) {
    const sprite = this.add.image(x, y, 'pickup-seed').setScale(texScale('pickup-seed')).setDepth(y);
    this.pods.push({ x, y, sprite });
  }

  private startRoll() {
    const s = this.state;
    if (this.roll || this.rollCd > 0 || this.hook) return;
    const mv = this.moveInput();
    const d = mv.x || mv.y ? mv : DIRS[s.facing];
    const len = Math.hypot(d.x, d.y) || 1;
    this.roll = { t: 0, dx: d.x / len, dy: d.y / len };
    this.rollCd = ROLL_COOLDOWN_MS * (hasUpgrade(s, 'boots') ? BOOTS.cooldown : 1) * (s.meal === 'skewer' ? SKEWER.cooldown : 1);
    sfx('roll');
    this.route = null;
    this.target = null;
  }

  /** How long a roll lasts: longer in Marla's boots. */
  private rollMs() {
    return ROLL_MS * (hasUpgrade(this.state, 'boots') ? BOOTS.roll : 1);
  }

  private fireVine() {
    const s = this.state;
    if (!s.items.hookvine || this.hook || this.roll || this.fishing) return;
    const d = DIRS[s.facing];
    this.hook = { x: s.x, y: s.y - 12, dx: d.x, dy: d.y, dist: 0, phase: 'out' };
    sfx('vine');
    this.route = null;
    this.target = null;
  }

  private push(tx: number, ty: number) {
    const s = this.state;
    const b = this.blocks.find((bl) => bl.x === tx && bl.y === ty);
    // A block on a plate sinks in and stays.
    if (!b || this.map.plates.some((p) => p.x === tx && p.y === ty)) return;
    const d = DIRS[s.facing];
    const nx = tx + d.x;
    const ny = ty + d.y;
    if (this.solidTile(nx, ny) || this.foes.some((f) => f.alive && Math.floor(f.x / TILE) === nx && Math.floor(f.y / TILE) === ny)) return;
    b.x = nx;
    b.y = ny;
    const c = centre(b);
    this.tweens.add({ targets: b.sprite, x: c.x, y: c.y + 16, duration: 200 });
    b.sprite.setDepth(c.y + 16);
    sfx('scrape');
    const plate = this.map.plates.find((p) => p.x === nx && p.y === ny);
    if (plate && !hasFlag(s, plate.flag)) {
      setFlag(s, plate.flag);
      sfx('chime');
      this.hud.toast(t('barsOpen'));
      this.persist();
    }
  }

  private dropCoin(x: number, y: number) {
    const sprite = this.add.image(x, y, 'pickup-coin').setScale(texScale('pickup-coin')).setDepth(y);
    this.coins.push({ x, y, sprite });
  }

  /** Opens a seller's wares: each upgrade with its price, or that it is bought. */
  private openShop(seller: Seller) {
    const s = this.state;
    const wares = UPGRADES.filter((u) => u.seller === seller);
    const rows = wares.map((u) => {
      const state = hasUpgrade(s, u.id) ? 'owned' : u.needs && !s.items[u.needs] ? 'locked' : 'buy';
      return { name: t(u.id), text: t(`${u.id}Text`), label: state === 'owned' ? t('owned') : state === 'locked' ? t('notYet') : t('price', { n: u.cost }), live: state === 'buy' };
    });
    this.route = null;
    this.target = null;
    this.stick = null;
    this.hud.showShop(t('shopTitle', { name: t(seller === 'baker' ? 'bakerName' : 'hermitName') }), null, s.coins, rows, (i) => {
      const id = wares[i].id;
      if (!buy(s, id)) {
        ui('refuse');
        this.hud.toast(t('tooPoor'));
        return;
      }
      ui('coin');
      this.hud.toast(t('bought', { item: t(id) }));
      this.persist();
      this.hud.closeShop();
      this.openShop(seller);
    });
  }

  private dropHeart(x: number, y: number) {
    const sprite = this.add.image(x, y, 'pickup-heart').setScale(texScale('pickup-heart')).setDepth(y);
    this.hearts.push({ x, y, sprite });
  }

  private puff(x: number, y: number, colour: number) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const dot = this.add.circle(x, y, 3, colour).setDepth(y + 1);
      this.tweens.add({ targets: dot, x: x + Math.cos(a) * 20, y: y + Math.sin(a) * 14, alpha: 0, duration: 350, onComplete: () => dot.destroy() });
    }
  }

  // ---------------------------------------------------------------- the gust horn

  /** The flag that remembers a mill or pinwheel turned. */
  private millKey(p: Prop) {
    return `mill-${this.map.id}-${p.x}-${p.y}`;
  }

  /** The windmill's pump empties the coast's inlet: its water turns to wet sand (path). */
  private drain(map: MapDef) {
    const d = map.drain!;
    for (let ty = d.y; ty < d.y + d.h; ty++) for (let tx = d.x; tx < d.x + d.w; tx++) if (tileAt(map, tx, ty) === 'water') setTile(map, tx, ty, 'path');
  }

  /**
   * Blows the gust horn: a cone of wind in front of the knight shoves foes back and makes them reel
   * (it brings a lantern moth down), blows shots away, turns mills and pinwheels, and blows a
   * surfaced Brinewyrm ashore.
   */
  private blowHorn() {
    const s = this.state;
    if (!s.items.horn || this.hornCd > 0 || this.roll || this.hook || this.fishing) return;
    this.hornCd = GUST.cooldownMs;
    sfx('gust');
    this.route = null;
    this.target = null;
    const d = DIRS[s.facing];
    const ox = s.x;
    const oy = s.y - 10;
    const inGust = (x: number, y: number) => {
      const along = (x - ox) * d.x + (y - oy) * d.y;
      const side = Math.abs((x - ox) * d.y - (y - oy) * d.x);
      return along >= -8 && along <= GUST.range && side <= GUST.width + Math.max(0, along) * GUST.spread;
    };
    for (let i = 0; i < 7; i++) {
      const off = (i - 3) * 7;
      const sx = ox - d.y * off;
      const sy = oy + d.x * off;
      const streak = this.add.rectangle(sx, sy, d.x ? 12 : 2, d.y ? 12 : 2, 0xe8f4ff, 0.8).setDepth(s.y + 2);
      this.tweens.add({ targets: streak, x: sx + d.x * GUST.range, y: sy + d.y * GUST.range, alpha: 0, duration: 280 + Math.abs(off) * 3, onComplete: () => streak.destroy() });
    }
    for (const f of this.foes) {
      if (!f.alive || !inGust(f.x, f.y - 8)) continue;
      if (f.kind === 'lantern') this.knockDown(f);
      else f.stun = Math.max(f.stun, GUST.stunMs);
      f.leap = 0;
      for (let k = 0; k < GUST.push / 4; k++)
        if (foeFree(this.map, this.standing, f.x + d.x * 4, f.y + d.y * 4, FOES[f.kind].flies)) {
          f.x += d.x * 4;
          f.y += d.y * 4;
        }
    }
    this.seeds = this.seeds.filter((sd) => {
      if (!inGust(sd.x, sd.y)) return true;
      sd.sprite.destroy();
      return false;
    });
    for (const m of this.mills) if (!m.turned && inGust(m.cx, m.cy)) this.turnMill(m);
    const b = this.brine;
    if (b && b.state === 'up' && inGust(b.x, b.y - 10)) this.beachBrine();
  }

  /** A gust turns a mill or a pinwheel; once all of them on the map turn, the map's `millFlag` is set. */
  private turnMill(m: GameScene['mills'][number]) {
    const s = this.state;
    m.turned = true;
    setFlag(s, this.millKey(m.prop));
    sfx('whirr');
    const flag = this.map.millFlag;
    if (flag && !hasFlag(s, flag) && this.mills.every((x) => x.turned)) {
      setFlag(s, flag);
      sfx('chime');
      if (this.map.drain) {
        this.drain(this.map);
        paintGround(this, this.map);
        this.ground.setTexture(groundKey(this.map));
        this.hud.toast(t('drained'));
      } else {
        this.hud.toast(t('gustsOpen'));
        this.updateDoors();
      }
    } else this.hud.toast(t(m.prop.kind === 'mill' ? 'millTurns' : 'pinwheelTurns'));
    this.persist();
  }

  // ---------------------------------------------------------------- fishing and cooking

  /** Whether the knight can cast into a tile: water on a map with fish, with the rod. */
  private fishable(tx: number, ty: number) {
    return this.state.items.rod && !!this.map.fish && tileAt(this.map, tx, ty) === 'water';
  }

  /** Casts into the water tile: a bite comes after a while, and must be pulled in time. */
  private startFishing(tx: number, ty: number) {
    const s = this.state;
    if (this.fishing || this.roll || this.hook || this.swing || !this.fishable(tx, ty)) return;
    const fish = this.map.fish!;
    if (s.fish[fish] >= FISH_MAX) {
      ui('refuse');
      this.hud.toast(t('fishFull', { fish: t(`${fish}Name`) }));
      return;
    }
    const c = centre({ x: tx, y: ty });
    const bobber = this.addWorld(this.add.image(c.x, c.y, 'bobber'), -4000);
    const [lo, hi] = FISH_WAIT_MS;
    this.fishing = { t: lo + Math.random() * (hi - lo), bite: false, fish, x: c.x, y: c.y, bobber };
    sfx('cast');
    this.route = null;
    this.target = null;
  }

  /** Pulls the line in: a fish if it was biting, else nothing. */
  private reel() {
    const f = this.fishing;
    if (!f) return;
    const s = this.state;
    if (f.bite) {
      s.fish[f.fish] = Math.min(FISH_MAX, s.fish[f.fish] + 1);
      sfx('catch');
      this.hud.toast(t('fishCaught', { fish: t(f.fish), n: s.fish[f.fish] }));
      this.persist();
    } else this.hud.toast(t('fishTooSoon'));
    this.endFishing();
  }

  private endFishing() {
    this.fishing?.bobber.destroy();
    this.fishing = null;
  }

  private updateFishing(dt: number) {
    const f = this.fishing;
    if (!f) return;
    f.t -= dt;
    if (!f.bite && f.t <= 0) {
      f.bite = true;
      f.t = BITE_MS;
      sfx('bite');
      this.hud.toast(t('fishBite'));
    } else if (f.bite && f.t <= 0) {
      this.hud.toast(t('fishLost'));
      return this.endFishing();
    }
    // The float bobs on the water, and dips under when a fish bites.
    const bob = settings.reduceMotion ? 0 : Math.sin(this.now / (f.bite ? 60 : 300)) * (f.bite ? 2 : 1.5);
    f.bobber.setY(f.y + (f.bite ? 5 : 0) + bob);
  }

  /** The campfire: cook a meal from the creel's fish. */
  private openCook() {
    const s = this.state;
    const rows = MEALS.map((m) => ({
      name: t(m.id),
      text: t(`${m.id}Text`),
      label: s.meal === m.id ? t('eating') : s.fish[m.fish] >= m.n ? t('cook') : t('needFish', { fish: t(`${m.fish}Name`), n: m.n }),
      live: s.meal !== m.id && s.fish[m.fish] >= m.n,
    }));
    this.route = null;
    this.target = null;
    this.stick = null;
    const note = s.meal ? t('cookNow', { meal: t(s.meal) }) : t('cookNone');
    this.hud.showShop(t('campfire'), note, null, rows, (i) => {
      const m = MEALS[i];
      if (!cook(s, m.id)) {
        ui('refuse');
        return;
      }
      sfx('sizzle');
      this.hud.toast(t('ate', { meal: t(m.id) }));
      this.persist();
      this.hud.closeShop();
    });
  }

  // ---------------------------------------------------------------- the loop

  private moveInput() {
    const k = this.keys;
    const x = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const y = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    const st = this.stick;
    if (x || y || !st?.live) return { x, y };
    // The stick walks at full speed past its dead zone; close to an axis it snaps to it, so the
    // knight can lean straight into a block to push it.
    const dx = st.x - st.ox;
    const dy = st.y - st.oy;
    const d = Math.hypot(dx, dy);
    if (d <= STICK.dead) return { x: 0, y: 0 };
    if (Math.abs(dy) < Math.abs(dx) * STICK.snap) return { x: Math.sign(dx), y: 0 };
    if (Math.abs(dx) < Math.abs(dy) * STICK.snap) return { x: 0, y: Math.sign(dy) };
    return { x: dx / d, y: dy / d };
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 100);
    this.now += dt;
    const s = this.state;
    if (!this.dialog && !this.hud.covered && !this.fading) {
      if (this.trial) this.trial.ms += dt;
      this.swingCd = Math.max(0, this.swingCd - dt);
      this.rollCd = Math.max(0, this.rollCd - dt);
      this.hornCd = Math.max(0, this.hornCd - dt);
      this.invuln = Math.max(0, this.invuln - dt);
      this.movePlayer(dt);
      this.updateHook(dt);
      this.updateFoes(dt);
      this.updateSeeds(dt);
      this.updateBombs(dt);
      this.updateBoss(dt);
      this.updateWraith(dt);
      this.updateGloam(dt);
      this.updateBrine(dt);
      this.updateFishing(dt);
      this.updateWisp(dt);
      this.pickups();
      this.updateDoors();
      this.checkExits();
    }
    checkTrophies(s);
    this.flashes = this.flashes.filter((f) => (f.t -= dt) > 0);
    this.drawPlayer();
    this.drawWorld();
    this.hud.update(dt, s, this.dialog ? { speaker: this.dialog.speaker, text: this.dialog.lines[this.dialog.i] } : null, DUNGEONS.has(this.map.id), this.trial?.ms ?? null);
    this.hud.drawStick(this.stick?.live ? this.stick : null);
  }

  private movePlayer(dt: number) {
    const s = this.state;
    const sec = dt / 1000;
    if (this.swing) {
      this.swing.t += dt;
      if (this.swing.t >= SWING_MS) this.swing = null;
    }
    if (this.roll) {
      this.roll.t += dt;
      const speed = ROLL_SPEED * (s.meal === 'skewer' ? SKEWER.speed : 1);
      this.tryMove(this.roll.dx * speed * sec, this.roll.dy * speed * sec);
      if (this.roll.t >= this.rollMs()) this.roll = null;
      return;
    }
    if (this.hook?.phase === 'pull') return;
    let mv = this.moveInput();
    if (mv.x || mv.y) {
      this.route = null;
      this.target = null;
      // Walking off pulls the line in.
      if (this.fishing) this.endFishing();
    } else if (this.target?.kind === 'foe') {
      mv = this.chase(dt);
    } else if (this.route?.length) {
      const next = centre(this.route[0]);
      const dx = next.x - s.x;
      const dy = next.y + 4 - s.y;
      const dist = Math.hypot(dx, dy);
      // A long frame would step past the tile's middle and back again, so the last bit is one step.
      if (dist < 4 || dist <= WALK_SPEED * sec) {
        if (dist >= 4) this.tryMove(dx, dy);
        this.route.shift();
        if (!this.route.length) {
          this.route = null;
          if (this.target) this.arrive();
        }
        return;
      }
      mv = { x: dx / dist, y: dy / dist };
    }
    if (!mv.x && !mv.y) {
      this.walkT = 0;
      this.pushT = 0;
      return;
    }
    if (this.swing) return;
    const len = Math.hypot(mv.x, mv.y);
    const vx = (mv.x / len) * WALK_SPEED * sec;
    const vy = (mv.y / len) * WALK_SPEED * sec;
    if (Math.abs(mv.x) > Math.abs(mv.y) + 0.01) s.facing = mv.x > 0 ? 'right' : 'left';
    else if (mv.y) s.facing = mv.y > 0 ? 'down' : 'up';
    this.walkT += dt;
    const moved = this.tryMove(vx, vy);
    // Leaning into a block for a moment pushes it.
    if (!moved && (mv.x === 0) !== (mv.y === 0)) {
      const d = DIRS[s.facing];
      const tx = Math.floor((s.x + d.x * 14) / TILE);
      const ty = Math.floor((s.y - 2 + d.y * 14) / TILE);
      if (this.blocks.some((b) => b.x === tx && b.y === ty)) {
        this.pushT += dt;
        if (this.pushT > 350) {
          this.pushT = 0;
          this.push(tx, ty);
        }
      }
    } else this.pushT = 0;
    // A tap's route that has stopped moving (a foe in the way) gives up rather than walking on the spot.
    if (!moved && this.route && !this.keysDown()) this.route = null;
  }

  private keysDown() {
    const m = this.moveInput();
    return m.x !== 0 || m.y !== 0;
  }

  /** Moves the knight, sliding along walls; returns whether they moved at all. */
  private tryMove(vx: number, vy: number) {
    const s = this.state;
    let moved = false;
    if (vx && this.free(s.x + vx, s.y)) {
      s.x += vx;
      moved = true;
    }
    if (vy && this.free(s.x, s.y + vy)) {
      s.y += vy;
      moved = true;
    }
    return moved;
  }

  /** Walks at a tapped foe and swings whenever it is in reach. */
  private chase(dt: number) {
    const s = this.state;
    const t = this.target;
    if (t?.kind !== 'foe' || !t.foe.alive) {
      this.target = null;
      return { x: 0, y: 0 };
    }
    const f = t.foe;
    const dx = f.x - s.x;
    const dy = f.y - s.y;
    const dist = Math.hypot(dx, dy);
    if (dist < SWING_REACH + 16) {
      s.facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
      this.startSwing();
      return { x: 0, y: 0 };
    }
    this.chaseT -= dt;
    if (this.chaseT <= 0 || !this.route?.length) {
      this.chaseT = 400;
      const keep = this.target;
      this.walkTo(Math.floor(f.x / TILE), Math.floor(f.y / TILE));
      this.target = keep;
    }
    if (this.route?.length) {
      const next = centre(this.route[0]);
      const nx = next.x - s.x;
      const ny = next.y + 4 - s.y;
      const nd = Math.hypot(nx, ny);
      if (nd < Math.max(4, (WALK_SPEED * dt) / 1000)) {
        this.route.shift();
        return { x: 0, y: 0 };
      }
      return { x: nx / nd, y: ny / nd };
    }
    return { x: dx / dist, y: dy / dist };
  }

  private updateHook(dt: number) {
    const h = this.hook;
    if (!h) return;
    const s = this.state;
    const sec = dt / 1000;
    if (h.phase === 'pull' && h.to) {
      const dx = h.to.x - s.x;
      const dy = h.to.y - s.y;
      const dist = Math.hypot(dx, dy);
      const step = PULL_SPEED * sec;
      if (dist <= step) {
        s.x = h.to.x;
        s.y = h.to.y;
        this.hook = null;
        if (this.saveAfterPull) {
          this.saveAfterPull = false;
          save(s);
        }
      } else {
        s.x += (dx / dist) * step;
        s.y += (dy / dist) * step;
      }
      h.x = h.to.x;
      h.y = h.to.y - 12;
      return;
    }
    if (h.phase === 'back') {
      const dx = s.x - h.x;
      const dy = s.y - 12 - h.y;
      const dist = Math.hypot(dx, dy);
      const step = VINE_SPEED * 1.4 * sec;
      if (dist <= step) this.hook = null;
      else {
        h.x += (dx / dist) * step;
        h.y += (dy / dist) * step;
      }
      return;
    }
    // Flying out, a few pixels at a time so nothing is skipped.
    let left = VINE_SPEED * sec;
    while (left > 0 && h.phase === 'out') {
      const step = Math.min(6, left);
      left -= step;
      h.x += h.dx * step;
      h.y += h.dy * step;
      h.dist += step;
      // The post the knight stands on doesn't count, so they can throw on from it.
      const post = this.map.posts.find((p) => Math.hypot(centre(p).x - h.x, centre(p).y - 12 - h.y) < 16 && Math.hypot(centre(p).x - s.x, centre(p).y - s.y) > 20);
      if (post) {
        const c = centre(post);
        h.phase = 'pull';
        h.to = { x: c.x, y: c.y + 4 };
        sfx('latch');
        sfx('pull');
        this.route = null;
        return;
      }
      const bulb = this.boss?.bulbs.find((b) => b.state === 'raised' && Math.hypot(b.x - h.x, b.y - 14 - h.y) < 20);
      if (bulb) {
        this.yank(bulb);
        h.phase = 'back';
        return;
      }
      const g = this.gloam;
      if (g && g.state === 'low' && Math.hypot(g.x - h.x, g.y - g.lift - 10 - h.y) < 24) {
        this.pullGloam();
        h.phase = 'back';
        return;
      }
      const foe = this.foes.find((f) => f.alive && Math.hypot(f.x - h.x, f.y - 10 - h.y) < 16);
      if (foe) {
        if (ARMOURED.has(foe.kind)) this.knockDown(foe);
        else foe.stun = 1600;
        sfx('latch');
        h.phase = 'back';
        return;
      }
      const tx = Math.floor(h.x / TILE);
      const ty = Math.floor((h.y + 12) / TILE);
      const t = tileAt(this.map, tx, ty);
      const blocked = (SOLID.has(t) && !LOW.has(t)) || this.blockers.has(ty * this.map.w + tx) || this.closedDoors.has(ty * this.map.w + tx);
      if (blocked || h.dist >= VINE_RANGE * (hasUpgrade(s, 'vine') ? LONG_VINE : 1) * (s.meal === 'chowder' ? CHOWDER : 1)) h.phase = 'back';
    }
  }

  private hurt(damage: number, from: { x: number; y: number }) {
    const s = this.state;
    if (this.invuln > 0 || this.roll || this.hook?.phase === 'pull') return;
    if (this.fishing) this.endFishing();
    s.hp = Math.max(0, s.hp - damage);
    // Sedge's moon charm keeps harm off a while longer.
    this.invuln = HURT_MS * (hasUpgrade(s, 'charm') ? CHARM : 1);
    sfx('hurt');
    const dx = s.x - from.x;
    const dy = s.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = 0; i < 4; i++) this.tryMove((dx / len) * 6, (dy / len) * 6);
    if (!settings.reduceMotion) this.cameras.main.shake(120, 0.004);
    if (s.hp <= 0) this.fall();
  }

  /** Out of hearts: wake at the place the knight last came in, healed. */
  private fall() {
    const s = this.state;
    s.falls++;
    // A meal lasts until the next fall.
    endMeal(s);
    s.hp = s.maxHp;
    const sp = s.spawn;
    const lost = !!this.trial;
    this.trial = null;
    playSting(STINGS, 'fall');
    this.fadeTo(() => {
      this.enterMap(sp.map, sp.x, sp.y, sp.facing, true);
      sfx('wake');
      this.hud.toast(t(lost ? 'trialLost' : 'wake'));
    });
  }

  private fadeTo(then: () => void) {
    // A fall and an exit can both start a fade in the same frame; the first one wins.
    if (this.fading) return;
    this.fading = true;
    const cam = this.cameras.main;
    cam.fadeOut(220, 5, 8, 20);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      then();
      cam.fadeIn(260, 5, 8, 20);
      this.fading = false;
    });
  }

  private checkExits() {
    if (this.fading) return;
    const s = this.state;
    const tx = Math.floor(s.x / TILE);
    const ty = Math.floor(s.y / TILE);
    const on = this.map.exits.filter((e) => tx >= e.x && tx < e.x + e.w && ty >= e.y && ty < e.y + e.h && (!e.flag || hasFlag(s, e.flag)));
    const exit = on.find((e) => !e.quest || reached(s, e.quest));
    // A way the story has not opened yet (a new game+ knight has the tools for it early) says so once.
    const shut = !exit && on.length > 0;
    if (shut && !this.onShutWay) {
      ui('refuse');
      this.hud.toast(t('wayShut'));
    }
    this.onShutWay = shut;
    if (!exit) return;
    this.route = null;
    this.target = null;
    sfx('swell');
    this.fadeTo(() => this.enterMap(exit.to, (exit.tx + 0.5) * TILE, (exit.ty + 0.5) * TILE + 4, exit.facing, false));
  }

  private pickups() {
    const s = this.state;
    this.hearts = this.hearts.filter((h) => {
      if (Math.hypot(h.x - s.x, h.y - s.y) > PICKUP_PX + 4) return true;
      s.hp = Math.min(s.maxHp, s.hp + 2);
      sfx('heart');
      h.sprite.destroy();
      return false;
    });
    this.coins = this.coins.filter((c) => {
      if (Math.hypot(c.x - s.x, c.y - s.y) > PICKUP_PX + 4) return true;
      s.coins++;
      ui('coin');
      c.sprite.destroy();
      return false;
    });
    this.pods = this.pods.filter((p) => {
      if (Math.hypot(p.x - s.x, p.y - s.y) > PICKUP_PX + 4) return true;
      s.seeds = Math.min(maxSeeds(s), s.seeds + 1);
      sfx('pod');
      p.sprite.destroy();
      return false;
    });
    for (const st of this.map.stones) {
      if (st.x < 0 || s.moonstones.includes(st.id)) continue;
      if (st.hidden === 'buried' && !this.dug.has(st.id)) continue;
      if (AFTER_BOSS[st.id] && !hasFlag(s, AFTER_BOSS[st.id])) continue;
      const c = centre(st);
      if (Math.hypot(c.x - s.x, c.y - s.y) < PICKUP_PX) this.gainStone(st.id);
    }
    // A villager's thing, picked up by walking over it.
    for (const [key, img] of this.findSprites) {
      const i = Number(key.slice(key.lastIndexOf('-') + 1));
      const f = this.map.finds[i];
      const c = centre(f);
      if (Math.hypot(c.x - s.x, c.y - s.y) >= PICKUP_PX + 4) continue;
      img.destroy();
      this.findSprites.delete(key);
      setFlag(s, `find-${f.req}-${i}`);
      sfx('find');
      const req = REQUESTS.find((r) => r.id === f.req)!;
      const name = t(FIND_ART[f.req].name);
      this.hud.toast(req.count > 1 ? t('findGot', { item: name, n: Math.min(req.count, found(s, f.req)), total: req.count }) : t('findGotOne', { item: name }));
      this.persist();
    }
  }

  // ---------------------------------------------------------------- foes

  private spawnFoe(kind: Foe['kind'], x: number, y: number, index: number, room?: string) {
    const f = makeFoe(this, kind, x, y, index, room);
    if (this.state.cycle > 0) f.hp = Math.ceil(f.hp * PLUS.hp);
    this.world.push(f.sprite);
    this.foes.push(f);
    return f;
  }

  /** The hookvine or a burst knocks an armoured foe down: a beetle flips over, a lantern moth falls. */
  private knockDown(f: Foe) {
    if (f.down <= 0) sfx('thud');
    f.down = DOWN_MS;
    f.leap = 0;
    this.hint(f.kind === 'beetle' ? 'beetleFlipped' : 'lanternDown');
  }

  /** A toast that shows once since the page opened, to teach the armoured foes. */
  private hint(key: 'beetleFlipped' | 'lanternDown' | 'shellHard' | 'gloamHigh' | 'brineSlick') {
    if (this.hinted.has(key)) return;
    this.hinted.add(key);
    this.hud.toast(t(key));
  }

  private hitFoe(f: Foe, d: { x: number; y: number }) {
    if (f.hurt > 0) return;
    // A beetle's shell turns the blade, and a lantern moth flies above it, until knocked down.
    if (f.kind === 'beetle' && f.down <= 0) {
      f.hurt = 250;
      sfx('tink');
      this.hint('shellHard');
      return;
    }
    if (f.kind === 'lantern' && f.down <= 0) return;
    f.hp--;
    f.hurt = 250;
    // Only the knight hits foes (the sword and their own bellseeds), so every hit is theirs.
    sfx(f.hp > 0 ? 'hit' : 'pop');
    for (let i = 0; i < 5; i++) if (foeFree(this.map, this.standing, f.x + d.x * 6, f.y + d.y * 6, FOES[f.kind].flies)) {
      f.x += d.x * 6;
      f.y += d.y * 6;
    }
    if (f.hp > 0) return;
    f.alive = false;
    this.state.beaten++;
    if (f.kind === 'beetle') awardNow('bellyUp');
    // The bestiary: a page fills at PAGE_AT, a family with every page filled drops an extra coin.
    const book = this.state.bestiary;
    const family = familyOf(f.kind);
    const had = familyDone(book, family);
    book[f.kind] = (book[f.kind] ?? 0) + 1;
    if (book[f.kind] === PAGE_AT) this.hud.toast(!had && familyDone(book, family) ? t('familyFull', { family: t(family) }) : t('pageFilled', { name: t(FOE_PAGE[f.kind].name) }));
    if (familyDone(book, family)) this.dropCoin(f.x + 4, f.y - 10);
    this.puff(f.x, f.y - 10, f.kind === 'moth' ? 0xc8bce0 : f.kind === 'lantern' ? 0xf0c070 : f.kind === 'beetle' ? 0x3a7a8a : f.kind === 'shade' ? 0x40466a : f.kind === 'crab' ? 0xc8603a : f.kind === 'gull' ? 0xe8eef4 : 0x6a8a4a);
    f.sprite.destroy();
    if (DUNGEONS.has(this.map.id) && f.index >= 0) setFlag(this.state, this.foeFlag(f.index));
    // Every foe leaves a coin (two with Wren's deep purse), and sometimes a heart or a seed pod beside it.
    this.dropCoin(f.x, f.y);
    if (hasUpgrade(this.state, 'pockets')) this.dropCoin(f.x - 10, f.y + 4);
    if (Math.random() < 0.3) this.dropHeart(f.x + 10, f.y + 4);
    else if (this.state.items.seeds && Math.random() < 0.35) this.dropPod(f.x + 10, f.y + 4);
  }

  /** The flag that remembers a beaten dungeon foe (the shrine's kept their first name). */
  private foeFlag(i: number) {
    return this.map.id === 'shrine' ? `foe-${i}` : `${this.map.id}-foe-${i}`;
  }

  private updateFoes(dt: number) {
    const s = this.state;
    const sec = dt / 1000;
    for (const f of this.foes) {
      if (!f.alive) continue;
      const info = FOES[f.kind];
      f.hurt = Math.max(0, f.hurt - dt);
      // Knocked down, it lies still and harmless until it rights itself.
      if (f.down > 0) {
        f.down -= dt;
        continue;
      }
      if (f.stun > 0) {
        f.stun -= dt;
        continue;
      }
      const dx = s.x - f.x;
      const dy = s.y - f.y;
      const dist = Math.hypot(dx, dy);
      const sees = dist < info.sees && (!f.room || this.inRoom(f.room));
      f.t -= dt;
      let vx = 0;
      let vy = 0;
      if (f.kind === 'slug' || f.kind === 'beetle') {
        if (sees) {
          vx = (dx / dist) * info.speed * 1.4;
          vy = (dy / dist) * info.speed * 1.4;
        } else {
          if (f.t <= 0) {
            const a = Math.random() * Math.PI * 2;
            f.dir = Math.random() < 0.3 ? { x: 0, y: 0 } : { x: Math.cos(a), y: Math.sin(a) };
            f.t = 1500 + Math.random() * 1500;
          }
          vx = f.dir.x * info.speed;
          vy = f.dir.y * info.speed;
        }
      } else if (f.kind === 'crab') {
        // A crab scuttles sideways at the knight, and only creeps up or down.
        if (sees) {
          vx = Math.sign(dx) * info.speed * 1.6 * Math.min(1, Math.abs(dx) / 24);
          vy = (dy / dist) * info.speed * 0.5;
        } else {
          if (f.t <= 0) {
            f.dir = { x: Math.random() < 0.3 ? 0 : Math.random() < 0.5 ? -1 : 1, y: 0 };
            f.t = 1200 + Math.random() * 1200;
          }
          vx = f.dir.x * info.speed;
        }
      } else if (f.kind === 'gull') {
        // A gull wheels round the knight, then swoops through where they stand.
        if (f.leap > 0) {
          f.leap -= dt;
          vx = f.dir.x * GULL_SWOOP_SPEED;
          vy = f.dir.y * GULL_SWOOP_SPEED;
        } else if (sees) {
          const k = (dist - 90) / dist;
          vx = dx * k * 1.2 + (-dy / dist) * 60;
          vy = dy * k * 1.2 + (dx / dist) * 60;
          if (f.t <= 0) {
            f.t = GULL_SWOOP_MS + Math.random() * 800;
            f.dir = { x: dx / dist, y: dy / dist };
            f.leap = 650;
            sfx('caw');
          }
        } else {
          vx = f.home.x + Math.cos(this.now / 1000 + f.index) * 60 - f.x;
          vy = f.home.y + Math.sin(this.now / 800 + f.index) * 30 - f.y;
        }
      } else if (f.kind === 'moth' || f.kind === 'shade') {
        const wob = Math.sin(this.now / 220 + f.index);
        if (sees) {
          vx = (dx / dist) * info.speed + (-dy / dist) * wob * 50;
          vy = (dy / dist) * info.speed + (dx / dist) * wob * 50;
        } else {
          const hx = f.home.x + Math.cos(this.now / 900 + f.index) * 40 - f.x;
          const hy = f.home.y + Math.sin(this.now / 700 + f.index) * 30 - f.y;
          vx = hx;
          vy = hy;
        }
      } else if (f.kind === 'lantern') {
        // It keeps its distance up high, circling, and drops embers at the knight.
        if (sees) {
          const k = (dist - LANTERN_KEEP) / dist;
          vx = dx * k * 1.5 + (-dy / dist) * 40;
          vy = dy * k * 1.5 + (dx / dist) * 40;
          const v = Math.hypot(vx, vy);
          if (v > info.speed) {
            vx *= info.speed / v;
            vy *= info.speed / v;
          }
          if (f.t <= 0) {
            f.t = LANTERN_SHOT_MS;
            sfx('spit', { pitch: 1.4 });
            // Aimed at the knight's body, 14 px above the feet, where an ember hits. It sinks
            // from LANTERN_LIFT to 14 over its flight, so its ground point runs from the moth's
            // feet straight to the knight's.
            const fly = Math.hypot(dx, dy + LANTERN_LIFT - 14) || 1;
            this.shoot(f.x, f.y - LANTERN_LIFT, dx, dy + LANTERN_LIFT - 14, 'ember', LANTERN_LIFT, ((LANTERN_LIFT - 14) * SEED_SPEED) / fly);
          }
        } else {
          vx = f.home.x + Math.cos(this.now / 1100 + f.index) * 50 - f.x;
          vy = f.home.y + Math.sin(this.now / 900 + f.index) * 36 - f.y;
        }
      } else if (f.kind === 'frog') {
        // A frog sits, then leaps: at the knight when it sees them, a short hop anywhere when not.
        if (f.leap > 0) {
          f.leap -= dt;
          vx = f.dir.x * info.speed;
          vy = f.dir.y * info.speed;
        } else if (f.t <= 0) {
          f.t = FROG_WAIT_MS + Math.random() * 400;
          const a = Math.random() * Math.PI * 2;
          f.dir = sees ? { x: dx / dist, y: dy / dist } : { x: Math.cos(a) * 0.5, y: Math.sin(a) * 0.5 };
          f.leap = FROG_LEAP_MS;
        }
      } else if (f.kind === 'thornling' && sees && f.t <= 0) {
        f.t = THORNLING_SHOT_MS;
        sfx('spit');
        this.shoot(f.x, f.y - 16, dx / dist, dy / dist);
      }
      // New game+ foes move faster.
      const quick = s.cycle > 0 ? PLUS.speed : 1;
      const nx = f.x + vx * sec * quick;
      const ny = f.y + vy * sec * quick;
      // A foe that bumps into something turns at once; a frog or a swooping gull just ends its leap.
      if (foeFree(this.map, this.standing, nx, f.y, info.flies)) f.x = nx;
      else if (f.kind === 'frog' || f.kind === 'gull') f.leap = 0;
      else f.t = 0;
      if (foeFree(this.map, this.standing, f.x, ny, info.flies)) f.y = ny;
      else if (f.kind === 'frog' || f.kind === 'gull') f.leap = 0;
      else f.t = 0;
      // A lantern moth flies too high to bump into.
      if (f.kind !== 'lantern' && Math.hypot(s.x - f.x, s.y - f.y) < 18) this.hurt(info.damage * (s.cycle > 0 ? PLUS.damage : 1), f);
    }
    this.foes = this.foes.filter((f) => f.alive);
  }

  private inRoom(id: string) {
    const r = this.map.rooms.find((room) => room.id === id);
    if (!r) return true;
    const tx = this.state.x / TILE;
    const ty = this.state.y / TILE;
    return tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h;
  }

  /**
   * `lift` is how far above its ground point the shot flies; walls are checked at that ground.
   * `drop` shrinks the lift by that many px a second, down to 14.
   */
  private shoot(x: number, y: number, dx: number, dy: number, key = 'seed', lift = 16, drop = 0) {
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    const sprite = this.add.image(x, y, key).setScale(texScale(key));
    this.seeds.push({ x, y, vx: dx * SEED_SPEED, vy: dy * SEED_SPEED, sprite, life: 4000, lift, drop });
  }

  private updateSeeds(dt: number) {
    const s = this.state;
    const sec = dt / 1000;
    this.seeds = this.seeds.filter((sd) => {
      sd.x += sd.vx * sec;
      sd.y += sd.vy * sec;
      sd.life -= dt;
      if (sd.drop > 0) sd.lift = Math.max(14, sd.lift - sd.drop * sec);
      const t = tileAt(this.map, Math.floor(sd.x / TILE), Math.floor((sd.y + sd.lift - 4) / TILE));
      const gone = sd.life <= 0 || (SOLID.has(t) && !LOW.has(t));
      if (!gone && Math.hypot(sd.x - s.x, sd.y - (s.y - 14)) < 13) {
        this.hurt(1, sd);
        sd.sprite.destroy();
        return false;
      }
      if (gone) sd.sprite.destroy();
      else sd.sprite.setPosition(sd.x, sd.y).setDepth(sd.y + 12);
      return !gone;
    });
  }

  // ---------------------------------------------------------------- the Thornmother

  private makeBoss(at: { x: number; y: number }) {
    const x = at.x * TILE;
    const y = at.y * TILE;
    const sprite = this.add.image(x, y + 30, 'boss').setOrigin(0.5, 128 / 140).setScale(texScale('boss')).setDepth(y + 30);
    this.world.push(sprite);
    const homes = [
      { x: x - 4.4 * TILE, y: y + 8 },
      { x: x + 4.4 * TILE, y: y + 8 },
      { x, y: y + 3.9 * TILE },
    ];
    const bulbs = homes.map((h) => {
      const img = this.add.image(h.x, h.y, 'bulb').setOrigin(0.5, 36 / 40).setScale(texScale('bulb')).setDepth(h.y);
      this.world.push(img);
      return { home: h, x: h.x, y: h.y, state: 'hidden' as const, t: 0, hp: BULB_HP, sprite: img };
    });
    this.boss = { x, y, sprite, bulbs, raiseT: 2000, volleyT: 2500, summonT: SUMMON_MS, awake: false };
  }

  private yank(b: Boss['bulbs'][number]) {
    const s = this.state;
    const dx = s.x - b.home.x;
    const dy = s.y - b.home.y;
    const len = Math.hypot(dx, dy) || 1;
    b.state = 'down';
    b.t = BULB_DOWN_MS;
    b.x = b.home.x + (dx / len) * Math.min(44, len - 20);
    b.y = b.home.y + (dy / len) * Math.min(44, len - 20);
    sfx('latch');
    sfx('twang');
    this.hud.toast(t('bulbDown'));
  }

  private hitBulb(b: Boss['bulbs'][number]) {
    b.hp--;
    sfx('squelch', { pitch: b.hp > 0 ? 1 : 0.8 });
    this.puff(b.x, b.y - 12, 0xd8e86a);
    if (b.hp > 0) return;
    b.state = 'gone';
    b.sprite.setVisible(false);
    const boss = this.boss!;
    if (boss.bulbs.every((x) => x.state === 'gone')) this.bossDown();
  }

  private bossDown() {
    const s = this.state;
    const boss = this.boss!;
    this.puff(boss.x, boss.y, 0x8a3f62);
    this.tweens.add({ targets: boss.sprite, alpha: 0, scaleX: boss.sprite.scaleX * 0.6, scaleY: boss.sprite.scaleY * 0.6, duration: 900 });
    this.boss = null;
    playSting(STINGS, 'victory');
    this.playAreaMusic();
    for (const sd of this.seeds) sd.sprite.destroy();
    this.seeds = [];
    for (const f of this.foes) if (f.room === 'boss') {
      f.alive = false;
      f.sprite.destroy();
    }
    this.map.tiles = this.map.tiles.map((t) => (t === 'ring' ? 'floor' : t));
    // The ring's floor is painted anew; the ground picks up the new texture.
    paintGround(this, this.map);
    this.ground.setTexture(groundKey(this.map));
    if (this.trial) return this.trialWon();
    setFlag(s, 'boss');
    advance(s, 'return');
    give(s, 'heart');
    const st = this.stoneSprites.get('s-boss');
    st?.setVisible(true);
    this.openDialog('', [
      t('thornmotherBeaten'),
      t('foundHeart'),
      t('thornmotherWayOut'),
    ]);
    this.persist();
  }

  private updateBoss(dt: number) {
    const boss = this.boss;
    if (!boss) return;
    if (!boss.awake) {
      if (!this.inRoom('boss')) return;
      boss.awake = true;
      this.playAreaMusic();
      this.hud.showPlace(t('thornmother'));
    }
    const left = boss.bulbs.filter((b) => b.state !== 'gone').length;
    boss.raiseT -= dt;
    if (boss.raiseT <= 0 && !boss.bulbs.some((b) => b.state === 'raised' || b.state === 'down')) {
      const next = boss.bulbs.find((b, i) => b.state === 'hidden' && i === (3 - left) % 3) ?? boss.bulbs.find((b) => b.state === 'hidden');
      if (next) {
        next.state = 'raised';
        next.t = BULB_UP_MS * (this.hard ? TRIAL.bulbUp : 1);
      }
      boss.raiseT = BULB_EVERY_MS;
    }
    for (const b of boss.bulbs) {
      if (b.state === 'raised' || b.state === 'down') {
        b.t -= dt;
        if (b.t <= 0) {
          b.state = 'hidden';
          b.x = b.home.x;
          b.y = b.home.y;
          b.hp = BULB_HP;
        }
      }
      const key = b.state === 'hidden' ? 'bulb' : 'bulb-lit';
      b.sprite.setTexture(key).setScale(texScale(key)).setPosition(b.x, b.y).setDepth(b.y).setVisible(b.state !== 'gone');
    }
    boss.volleyT -= dt;
    if (boss.volleyT <= 0) {
      boss.volleyT = (VOLLEY_MS[3 - left] ?? VOLLEY_MS[2]) * (this.hard ? TRIAL.volley : 1);
      sfx('volley');
      const turn = (this.now / 1000) % 1;
      const shots = this.hard ? TRIAL.volleyShots : 8;
      for (let i = 0; i < shots; i++) {
        const a = ((i + turn) / shots) * Math.PI * 2;
        this.shoot(boss.x + Math.cos(a) * 30, boss.y + Math.sin(a) * 20, Math.cos(a), Math.sin(a));
      }
    }
    boss.summonT -= dt;
    if (boss.summonT <= 0) {
      boss.summonT = SUMMON_MS * (this.hard ? TRIAL.summon : 1);
      if (this.foes.filter((f) => f.alive && f.room === 'boss').length < (this.hard ? TRIAL.summoned : 2)) {
        const room = this.map.rooms.find((r) => r.id === 'boss')!;
        const side = Math.random() < 0.5 ? room.x + 2 : room.x + room.w - 3;
        const c = centre({ x: side, y: room.y + 2 + Math.floor(Math.random() * (room.h - 4)) });
        this.spawnFoe('slug', c.x, c.y, -1, 'boss');
      }
    }
    if (!settings.reduceMotion) boss.sprite.setScale(texScale('boss') * (1 + Math.sin(this.now / 400) * 0.02));
  }

  // ---------------------------------------------------------------- the Bellwraith

  private makeWraith(at: { x: number; y: number }) {
    const x = at.x * TILE;
    const y = at.y * TILE;
    const shadow = this.add.image(x, y, 'bell-shadow').setScale(texScale('bell-shadow')).setDepth(-4000);
    const ghost = this.add.image(x, y, 'wraith').setOrigin(0.5, 0.9).setScale(texScale('wraith')).setVisible(false);
    const bell = this.add.image(x, y, 'bigbell').setOrigin(0.5, 78 / 88).setScale(texScale('bigbell'));
    this.world.push(shadow, ghost, bell);
    this.wraith = { x, y, lift: BELL_LIFT, state: 'hover', t: HOVER_MS, hp: this.hard ? TRIAL.wraithHp : WRAITH_HP, bell, ghost, shadow, summonT: SUMMON_MS, podT: 3000, awake: false };
  }

  private tipBell() {
    const w = this.wraith!;
    w.state = 'tipped';
    w.t = EXPOSED_MS * (this.hard ? TRIAL.exposed : 1);
    sfx('topple');
    this.hud.toast(t('bellTipped'));
  }

  private hitWraith() {
    const w = this.wraith!;
    if (w.state !== 'tipped') {
      sfx('bell', { pitch: 0.5, volume: 0.6 });
      this.hud.toast(t('clang'));
      return;
    }
    w.hp--;
    sfx('wail', { pitch: w.hp > 0 ? 1 : 0.8 });
    this.puff(w.x, w.y - 24, 0xc8e8ff);
    if (!settings.reduceMotion) this.flashes.push({ x: w.x, y: w.y - 30, r: 160, col: [190, 230, 255], power: 1, t: 400 });
    if (w.hp <= 0) return this.wraithDown();
    this.hud.toast(t('wraithFlees'));
    w.state = 'rise';
    w.t = 600;
  }

  private wraithDown() {
    const s = this.state;
    const w = this.wraith!;
    this.puff(w.x, w.y - 20, 0xc8e8ff);
    this.tweens.add({ targets: [w.ghost, w.bell, w.shadow], alpha: 0, duration: 900 });
    this.wraith = null;
    playSting(STINGS, 'victory');
    this.playAreaMusic();
    for (const f of this.foes)
      if (f.room === 'boss') {
        f.alive = false;
        f.sprite.destroy();
      }
    if (this.trial) return this.trialWon();
    setFlag(s, 'wraith');
    advance(s, 'home');
    give(s, 'heart');
    this.stoneSprites.get('b-bell')?.setVisible(true);
    this.openDialog('', [
      t('wraithBeaten'),
      t('foundHeart'),
      t('wraithQuiet'),
    ]);
    this.persist();
  }

  private updateWraith(dt: number) {
    const w = this.wraith;
    if (!w) return;
    const s = this.state;
    if (!w.awake) {
      if (!this.inRoom('boss')) return;
      w.awake = true;
      this.playAreaMusic();
      this.hud.showPlace(t('bellwraith'));
    }
    const room = this.map.rooms.find((r) => r.id === 'boss')!;
    w.t -= dt;
    if (w.state === 'hover') {
      // The bell drifts after the knight, high up, its shadow on the floor below.
      const dx = s.x - w.x;
      const dy = s.y - w.y;
      const dist = Math.hypot(dx, dy);
      const step = Math.min(dist, (HOVER_SPEED * (this.hard ? TRIAL.hoverSpeed : 1) * dt) / 1000);
      if (dist > 1) {
        w.x = Phaser.Math.Clamp(w.x + (dx / dist) * step, (room.x + 1.5) * TILE, (room.x + room.w - 1.5) * TILE);
        w.y = Phaser.Math.Clamp(w.y + (dy / dist) * step, (room.y + 1.5) * TILE, (room.y + room.h - 0.5) * TILE);
      }
      w.lift = BELL_LIFT;
      if (w.t <= 0) {
        w.state = 'drop';
        w.t = DROP_MS;
        sfx('rattle');
      }
    } else if (w.state === 'drop') {
      // It shudders, then falls.
      w.lift = BELL_LIFT + 10 * (1 - w.t / DROP_MS);
      if (w.t <= 0) {
        w.state = 'down';
        w.t = BELL_DOWN_MS;
        w.lift = 0;
        sfx('clang');
        this.puff(w.x, w.y - 4, 0x8a8c94);
        if (!settings.reduceMotion) this.cameras.main.shake(200, 0.008);
        if (Math.hypot(s.x - w.x, s.y - w.y) < SLAM_PX) this.hurt(Math.hypot(s.x - w.x, s.y - w.y) < 26 ? 2 : 1, w);
      }
    } else if (w.state === 'down' || w.state === 'tipped') {
      if (w.t <= 0) {
        w.state = 'rise';
        w.t = 600;
      }
    } else if (w.state === 'rise') {
      w.lift = BELL_LIFT * (1 - Math.max(0, w.t) / 600);
      if (w.t <= 0) {
        w.state = 'hover';
        w.t = HOVER_MS * (this.hard ? TRIAL.hover : 1);
      }
    }
    // The bell on the floor is in the way: the knight can't stand inside it.
    if (w.lift < 20) {
      const dx = s.x - w.x;
      const dy = s.y - w.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 30) {
        const len = dist || 1;
        this.tryMove(((dx || 1) / len) * (30 - dist), (dy / len) * (30 - dist));
      }
    }
    // Moths when the knight is alone with it, and seed pods when they run short.
    w.summonT -= dt;
    if (w.summonT <= 0) {
      w.summonT = SUMMON_MS;
      if (this.foes.filter((f) => f.alive && f.room === 'boss').length < 2) {
        const c = centre({ x: Math.random() < 0.5 ? room.x + 2 : room.x + room.w - 3, y: room.y + 2 });
        this.spawnFoe('moth', c.x, c.y, -1, 'boss');
      }
    }
    w.podT -= dt;
    if (w.podT <= 0) {
      w.podT = 4000;
      if (s.seeds < 2 && this.pods.length < 2) {
        const c = centre({ x: room.x + 2 + Math.floor(Math.random() * (room.w - 4)), y: room.y + room.h - 2 });
        this.dropPod(c.x, c.y);
      }
    }
    // Drawing: the bell at its height, tipped on its side when the wraith is out.
    const tipped = w.state === 'tipped';
    const shake = w.state === 'drop' && !settings.reduceMotion ? Math.sin(this.now / 25) * 2 : 0;
    w.bell
      .setPosition(w.x + shake + (tipped ? 40 : 0), w.y - w.lift + (tipped ? 6 : 0))
      .setAngle(tipped ? 80 : 0)
      .setDepth(w.lift > 20 ? w.y + 200 : w.y);
    w.ghost.setVisible(tipped).setPosition(w.x, w.y - 6 - (settings.reduceMotion ? 0 : Math.sin(this.now / 200) * 3)).setDepth(w.y + 1);
    const near = 1 - w.lift / (BELL_LIFT + 10);
    w.shadow.setPosition(w.x, w.y).setScale(texScale('bell-shadow') * (0.6 + near * 0.5)).setAlpha(w.state === 'drop' ? 1 : 0.6 + near * 0.4);
  }

  // ---------------------------------------------------------------- the Gloamwing

  private makeGloam(at: { x: number; y: number }) {
    const x = at.x * TILE;
    const y = at.y * TILE;
    const shadow = this.add.image(x, y, 'bell-shadow').setScale(texScale('bell-shadow')).setDepth(-4000);
    const sprite = this.add.image(x, y, 'gloam').setOrigin(0.5, 0.8).setScale(texScale('gloam'));
    this.world.push(shadow, sprite);
    const hp = this.hard ? TRIAL.gloamHp : GLOAM.hp;
    this.gloam = { x, y, lift: GLOAM.lift, state: 'circle', t: GLOAM.circleMs, hp, home: { x, y }, angle: Math.PI / 2, mark: { x, y }, from: { x, y }, sprite, shadow, shotT: GLOAM.shotMs, summonT: SUMMON_MS, awake: false };
  }

  /** The hookvine catches the Gloamwing while it hangs low after a dive and pulls it to the ground. */
  private pullGloam() {
    const g = this.gloam!;
    g.state = 'down';
    g.t = GLOAM.downMs;
    g.lift = 0;
    sfx('latch');
    sfx('thud');
    this.hud.toast(t('gloamDown'));
  }

  private hitGloam() {
    const g = this.gloam!;
    if (g.state !== 'down') {
      this.hint('gloamHigh');
      return;
    }
    g.hp--;
    sfx('screech', { pitch: g.hp > 0 ? 1 : 0.8 });
    this.puff(g.x, g.y - 16, 0x40466a);
    if (!settings.reduceMotion) this.flashes.push({ x: g.x, y: g.y - 20, r: 150, col: [190, 210, 255], power: 1, t: 400 });
    if (g.hp <= 0) return this.gloamDown();
    this.hud.toast(t('gloamFlees'));
    g.state = 'rise';
    g.t = GLOAM.riseMs;
  }

  private gloamDown() {
    const s = this.state;
    const g = this.gloam!;
    this.puff(g.x, g.y - 20, 0x8a90c0);
    this.tweens.add({ targets: [g.sprite, g.shadow], alpha: 0, duration: 900 });
    this.gloam = null;
    playSting(STINGS, 'victory');
    this.playAreaMusic();
    for (const sd of this.seeds) sd.sprite.destroy();
    this.seeds = [];
    for (const f of this.foes)
      if (f.room === 'boss') {
        f.alive = false;
        f.sprite.destroy();
      }
    if (this.trial) return this.trialWon();
    setFlag(s, 'gloam');
    advance(s, 'homeward');
    give(s, 'heart');
    this.stoneSprites.get('c-boss')?.setVisible(true);
    this.openDialog('', [t('gloamBeaten'), t('foundHeart'), t('gloamQuiet')]);
    this.persist();
  }

  private updateGloam(dt: number) {
    const g = this.gloam;
    if (!g) return;
    const s = this.state;
    if (!g.awake) {
      if (!this.inRoom('boss')) return;
      g.awake = true;
      this.playAreaMusic();
      this.hud.showPlace(t('gloamwing'));
    }
    const room = this.map.rooms.find((r) => r.id === 'boss')!;
    g.t -= dt;
    if (g.state === 'circle') {
      // High over the hall's middle, round and round, shedding rings of frost.
      g.angle += (GLOAM.turn * dt) / 1000;
      const tx = g.home.x + Math.cos(g.angle) * GLOAM.ring * 1.6;
      const ty = g.home.y + Math.sin(g.angle) * GLOAM.ring * 0.6;
      g.x += (tx - g.x) * Math.min(1, dt / 300);
      g.y += (ty - g.y) * Math.min(1, dt / 300);
      g.lift = GLOAM.lift;
      g.shotT -= dt;
      if (g.shotT <= 0) {
        g.shotT = GLOAM.shotMs * (this.hard ? TRIAL.volley : 1);
        sfx('volley', { pitch: 1.3 });
        const shots = this.hard ? GLOAM.shots + 4 : GLOAM.shots;
        const turn = (this.now / 1000) % 1;
        for (let i = 0; i < shots; i++) {
          const a = ((i + turn) / shots) * Math.PI * 2;
          this.shoot(g.x + Math.cos(a) * 20, g.y + Math.sin(a) * 14, Math.cos(a), Math.sin(a), 'shard');
        }
      }
      if (g.t <= 0) {
        g.state = 'mark';
        g.t = GLOAM.markMs;
        g.mark = { x: s.x, y: s.y };
        sfx('rattle', { pitch: 1.6 });
      }
    } else if (g.state === 'mark') {
      // Its shadow settles on the knight's spot, then it drops on it.
      g.x += (g.mark.x - g.x) * Math.min(1, dt / 500);
      g.y += (g.mark.y - g.y) * Math.min(1, dt / 500);
      if (g.t <= 0) {
        g.state = 'dive';
        g.t = GLOAM.diveMs;
        g.from = { x: g.x, y: g.y };
        sfx('swoop');
      }
    } else if (g.state === 'dive') {
      const k = 1 - Math.max(0, g.t) / GLOAM.diveMs;
      g.x = g.from.x + (g.mark.x - g.from.x) * k;
      g.y = g.from.y + (g.mark.y - g.from.y) * k;
      g.lift = GLOAM.lift * (1 - k) + 10 * k;
      if (g.t <= 0) {
        g.state = 'low';
        g.t = GLOAM.lowMs * (this.hard ? TRIAL.gloamLow : 1);
        this.puff(g.x, g.y - 4, 0x8a90c0);
        if (!settings.reduceMotion) this.cameras.main.shake(160, 0.006);
        if (Math.hypot(s.x - g.x, s.y - g.y) < GLOAM.hitPx) this.hurt(2, g);
      }
    } else if (g.state === 'low') {
      g.lift = 12 + (settings.reduceMotion ? 0 : Math.sin(this.now / 140) * 3);
      if (g.t <= 0) {
        g.state = 'rise';
        g.t = GLOAM.riseMs;
      }
    } else if (g.state === 'down') {
      g.lift = 0;
      if (g.t <= 0) {
        g.state = 'rise';
        g.t = GLOAM.riseMs;
      }
    } else if (g.state === 'rise') {
      g.lift = GLOAM.lift * (1 - Math.max(0, g.t) / GLOAM.riseMs);
      if (g.t <= 0) {
        g.state = 'circle';
        g.t = GLOAM.circleMs * (this.hard ? TRIAL.gloamCircle : 1);
        g.shotT = GLOAM.shotMs / 2;
        g.angle = Math.atan2((g.y - g.home.y) / 0.6, (g.x - g.home.x) / 1.6);
      }
    }
    g.x = Phaser.Math.Clamp(g.x, (room.x + 1.5) * TILE, (room.x + room.w - 1.5) * TILE);
    g.y = Phaser.Math.Clamp(g.y, (room.y + 1.5) * TILE, (room.y + room.h - 0.5) * TILE);
    // Shades out of the dark while the knight fights it.
    g.summonT -= dt;
    if (g.summonT <= 0) {
      g.summonT = SUMMON_MS * (this.hard ? TRIAL.summon : 1);
      if (this.foes.filter((f) => f.alive && f.room === 'boss').length < 2) {
        const c = centre({ x: Math.random() < 0.5 ? room.x + 2 : room.x + room.w - 3, y: room.y + 2 });
        this.spawnFoe('shade', c.x, c.y, -1, 'boss');
      }
    }
    // Drawing: the moth at its height, folded flat while it lies on the floor.
    const down = g.state === 'down';
    const flap = settings.reduceMotion || down ? 1 : 0.85 + Math.abs(Math.sin(this.now / 120)) * 0.15;
    g.sprite
      .setPosition(g.x, g.y - g.lift)
      .setScale(texScale('gloam') * (down ? 0.9 : 1), texScale('gloam') * (down ? 0.6 : flap))
      .setDepth(g.lift > 20 ? g.y + 200 : g.y);
    if (g.state === 'mark') g.shadow.setPosition(g.mark.x, g.mark.y).setScale(texScale('bell-shadow') * (0.5 + (1 - g.t / GLOAM.markMs) * 0.6)).setAlpha(0.9);
    else g.shadow.setPosition(g.x, g.y).setScale(texScale('bell-shadow') * (0.6 + (1 - g.lift / GLOAM.lift) * 0.4)).setAlpha(0.6);
  }

  // ---------------------------------------------------------------- the Brinewyrm

  private makeBrine(map: MapDef) {
    const p = map.pool!;
    const left = p.x * TILE;
    const right = (p.x + p.w) * TILE;
    const top = p.y * TILE;
    const bottom = (p.y + p.h) * TILE;
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    // Where it rises at each edge of the pool, and the shore a gust blows it onto.
    const spots = [
      { wx: cx, wy: top + 18, sx: cx, sy: top - 22 },
      { wx: right - 18, wy: cy, sx: right + 24, sy: cy },
      { wx: cx, wy: bottom - 14, sx: cx, sy: bottom + 22 },
      { wx: left + 18, wy: cy, sx: left - 24, sy: cy },
    ];
    const ripple = this.addWorld(this.add.image(cx, cy, 'ripple'), -4000);
    const sprite = this.add.image(cx, cy, 'wyrm').setOrigin(0.5, 0.95).setScale(texScale('wyrm')).setVisible(false);
    this.world.push(sprite);
    this.brine = { x: cx, y: cy, state: 'under', t: BRINE.underMs, hp: this.hard ? TRIAL.brineHp : BRINE.hp, spot: 2, spots, sprite, ripple, shotT: BRINE.spitMs, summonT: SUMMON_MS, awake: false };
  }

  /** A gust blows the surfaced Brinewyrm onto the shore beside it, where it flops and can be struck. */
  private beachBrine() {
    const b = this.brine!;
    const sp = b.spots[b.spot];
    b.state = 'beached';
    b.t = BRINE.beachedMs * (this.hard ? TRIAL.brineBeached : 1);
    b.x = sp.sx;
    b.y = sp.sy;
    sfx('splash');
    sfx('thud');
    this.puff(sp.wx, sp.wy - 10, 0xc8f4ea);
    this.hud.toast(t('brineBeached'));
  }

  /** It slips back under the water from wherever it is. */
  private sinkBrine() {
    const b = this.brine!;
    const sp = b.spots[b.spot];
    b.x = sp.wx;
    b.y = sp.wy;
    b.state = 'sink';
    b.t = BRINE.sinkMs;
    sfx('splash', { pitch: 0.8 });
  }

  private hitBrine() {
    const b = this.brine!;
    if (b.state !== 'beached') {
      this.hint('brineSlick');
      return;
    }
    b.hp--;
    sfx('squelch', { pitch: 0.7 });
    sfx('wail', { pitch: b.hp > 0 ? 0.6 : 0.5 });
    this.puff(b.x, b.y - 16, 0x6aa898);
    if (!settings.reduceMotion) this.flashes.push({ x: b.x, y: b.y - 20, r: 140, col: [160, 250, 220], power: 1, t: 400 });
    if (b.hp <= 0) return this.brineDown();
    this.hud.toast(t('brineFlees'));
    this.sinkBrine();
  }

  private brineDown() {
    const s = this.state;
    const b = this.brine!;
    this.puff(b.x, b.y - 20, 0x6aa898);
    this.tweens.add({ targets: [b.sprite, b.ripple], alpha: 0, duration: 900 });
    this.brine = null;
    playSting(STINGS, 'victory');
    this.playAreaMusic();
    for (const sd of this.seeds) sd.sprite.destroy();
    this.seeds = [];
    for (const f of this.foes)
      if (f.room === 'boss') {
        f.alive = false;
        f.sprite.destroy();
      }
    if (this.trial) return this.trialWon();
    setFlag(s, 'brine');
    advance(s, 'tidings');
    give(s, 'heart');
    this.stoneSprites.get('g-boss')?.setVisible(true);
    this.openDialog('', [t('brineBeaten'), t('foundHeart'), t('brineQuiet')]);
    this.persist();
  }

  private updateBrine(dt: number) {
    const b = this.brine;
    if (!b) return;
    const s = this.state;
    if (!b.awake) {
      if (!this.inRoom('boss')) return;
      b.awake = true;
      this.playAreaMusic();
      this.hud.showPlace(t('brinewyrm'));
    }
    const room = this.map.rooms.find((r) => r.id === 'boss')!;
    const sp = b.spots[b.spot];
    b.t -= dt;
    if (b.state === 'under') {
      // A ripple glides under the water to where it will rise.
      b.x += (sp.wx - b.x) * Math.min(1, dt / 400);
      b.y += (sp.wy - b.y) * Math.min(1, dt / 400);
      if (b.t <= 0) {
        b.state = 'rise';
        b.t = BRINE.riseMs;
        b.x = sp.wx;
        b.y = sp.wy;
        sfx('splash');
      }
    } else if (b.state === 'rise') {
      if (b.t <= 0) {
        b.state = 'up';
        b.t = BRINE.upMs * (this.hard ? TRIAL.brineUp : 1);
        b.shotT = BRINE.spitMs * 0.6;
      }
    } else if (b.state === 'up') {
      b.shotT -= dt;
      if (b.shotT <= 0) {
        b.shotT = BRINE.spitMs;
        sfx('spit', { pitch: 0.7 });
        // A fan of brine at the knight's body, sinking from its mouth on the way like an ember.
        const lift = 40;
        const dx = s.x - b.x;
        const dy = s.y - 14 - (b.y - lift);
        const fly = Math.hypot(dx, dy) || 1;
        const shots = BRINE.shots + (this.hard ? 2 : 0);
        for (let i = 0; i < shots; i++) {
          const a = Math.atan2(dy, dx) + (i - (shots - 1) / 2) * BRINE.spread;
          this.shoot(b.x, b.y - lift, Math.cos(a), Math.sin(a), 'brine', lift, ((lift - 14) * SEED_SPEED) / fly);
        }
      }
      if (b.t <= 0) this.sinkBrine();
    } else if (b.state === 'beached') {
      if (b.t <= 0) this.sinkBrine();
      // It lies in the way on the shore: the knight can't stand inside it.
      const dx = s.x - b.x;
      const dy = s.y - b.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 28) this.tryMove(((dx || 1) / (dist || 1)) * (28 - dist), (dy / (dist || 1)) * (28 - dist));
    } else if (b.state === 'sink') {
      if (b.t <= 0) {
        b.state = 'under';
        b.t = BRINE.underMs;
        // It rises next at another edge of the pool.
        b.spot = (b.spot + 1 + Math.floor(Math.random() * 3)) % 4;
      }
    }
    // Crabs out of the deep while the knight fights it.
    b.summonT -= dt;
    if (b.summonT <= 0) {
      b.summonT = SUMMON_MS * (this.hard ? TRIAL.summon : 1);
      if (this.foes.filter((f) => f.alive && f.room === 'boss').length < 2) {
        const c = centre({ x: Math.random() < 0.5 ? room.x + 2 : room.x + room.w - 3, y: room.y + room.h - 2 });
        this.spawnFoe('crab', c.x, c.y, -1, 'boss');
      }
    }
    // Drawing: its neck rising out of the water, or lying on the shore.
    const shown = b.state !== 'under';
    const k = b.state === 'rise' ? 1 - Math.max(0, b.t) / BRINE.riseMs : b.state === 'sink' ? Math.max(0, b.t) / BRINE.sinkMs : 1;
    const beached = b.state === 'beached';
    const sway = settings.reduceMotion ? 0 : Math.sin(this.now / 260) * (beached ? 6 : 3);
    b.sprite
      .setVisible(shown)
      .setPosition(b.x, b.y + (beached ? 10 : 0))
      .setScale(texScale('wyrm'), texScale('wyrm') * Math.max(0.05, k))
      .setAngle((beached ? (sp.sx < sp.wx ? -80 : 80) : 0) + sway)
      .setDepth(b.y + 2);
    const ripple = settings.reduceMotion ? 1 : 1 + Math.sin(this.now / 180) * 0.12;
    b.ripple.setVisible(!beached).setPosition(b.state === 'under' ? b.x : sp.wx, (b.state === 'under' ? b.y : sp.wy) + 2).setScale(texScale('ripple') * ripple);
  }

  private updateWisp(dt: number) {
    const w = this.wisp;
    const path = this.map.wisp;
    if (!w || !path) return;
    const s = this.state;
    w.hop = Math.max(0, w.hop - dt);
    const bob = settings.reduceMotion ? 0 : Math.sin(this.now / 300) * 3;
    const c = centre(path[w.i]);
    if (w.hop <= 0) w.sprite.setPosition(c.x, c.y - 10 + bob);
    if (Math.hypot(w.sprite.x - s.x, w.sprite.y + 10 - s.y) > 70 || w.hop > 0) return;
    if (w.i < path.length - 1) {
      w.i++;
      w.hop = 700;
      sfx('wisp');
      const n = centre(path[w.i]);
      this.tweens.add({ targets: w.sprite, x: n.x, y: n.y - 10, duration: 650, ease: 'Sine.easeInOut' });
      return;
    }
    if (Math.hypot(w.sprite.x - s.x, w.sprite.y + 10 - s.y) < 26) {
      w.sprite.destroy();
      this.wisp = null;
      this.gainStone('f-wisp');
      this.openDialog(t('wisp'), [t('wispVoice')]);
    }
  }

  // ---------------------------------------------------------------- drawing

  private applyFacing() {
    const f = this.state.facing;
    const key = f === 'up' ? 'hero-up' : f === 'down' ? 'hero-down' : 'hero-side';
    this.player.setTexture(key).setScale(texScale(key)).setFlipX(f === 'left');
  }

  private drawPlayer() {
    const s = this.state;
    this.applyFacing();
    const bob = this.walkT > 0 && !settings.reduceMotion ? Math.abs(Math.sin(this.walkT / 90)) * 2 : 0;
    this.player.setPosition(s.x, s.y - bob).setDepth(s.y);
    let angle = 0;
    if (this.roll && !settings.reduceMotion) angle = (this.roll.t / this.rollMs()) * 360 * (this.roll.dx < 0 ? -1 : 1);
    this.player.setAngle(angle);
    // Blink while it can't be hurt, or just fade a little with reduce motion on.
    const blink = this.invuln > 0 && (settings.reduceMotion ? true : Math.floor(this.invuln / 80) % 2 === 0);
    this.player.setAlpha(blink ? 0.55 : 1);
    if (this.swing) {
      const base = { up: 0, right: 90, down: 180, left: 270 }[this.swing.dir];
      const p = this.swing.t / SWING_MS;
      this.sword.setVisible(true).setPosition(s.x, s.y - 14).setAngle(base - 60 + p * 120).setDepth(s.y + (this.swing.dir === 'up' ? -1 : 1));
    } else this.sword.setVisible(false);
    this.vine.clear();
    const h = this.hook;
    this.hookTip.setVisible(!!h);
    if (h) {
      const sx = s.x;
      const sy = s.y - 14;
      this.vine.lineStyle(3, 0x6fb84a, 1);
      this.vine.beginPath();
      this.vine.moveTo(sx, sy);
      const n = 8;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        const wob = Math.sin(t * Math.PI * 3 + this.now / 60) * 3 * (1 - t);
        this.vine.lineTo(sx + (h.x - sx) * t + -h.dy * wob, sy + (h.y - sy) * t + h.dx * wob);
      }
      this.vine.strokePath();
      this.vine.setDepth(Math.max(s.y, h.y + 12) + 1);
      this.hookTip.setPosition(h.x, h.y).setDepth(h.y + 13);
    }
  }

  private drawWorld() {
    const s = this.state;
    for (const f of this.foes) {
      if (!f.alive) continue;
      const flap = Math.floor(this.now / 120 + f.index) % 2;
      const key =
        f.kind === 'moth' ? (flap ? 'moth-a' : 'moth-b')
        : f.kind === 'lantern' ? (f.down > 0 || !flap ? 'lantern-b' : 'lantern-a')
        : f.kind === 'beetle' && f.down > 0 ? 'beetle-back'
        : f.kind === 'shade' ? (flap ? 'shade' : 'shade-b')
        : f.kind === 'gull' ? (flap ? 'gull-a' : 'gull-b')
        : f.kind;
      const lift =
        f.kind === 'moth' || f.kind === 'shade' ? 12
        : f.kind === 'gull' ? (f.down > 0 || f.stun > 0 ? 4 : f.leap > 0 ? 8 : 16)
        : f.kind === 'lantern' ? (f.down > 0 ? 2 : LANTERN_LIFT + (settings.reduceMotion ? 0 : Math.sin(this.now / 300 + f.index) * 3))
        : f.kind === 'frog' && f.leap > 0 ? Math.sin((1 - f.leap / FROG_LEAP_MS) * Math.PI) * 10
        : 0;
      f.sprite.setTexture(key).setScale(texScale(key)).setPosition(f.x, f.y - lift).setDepth(f.y);
      // A shade shows only in the knight's light, most of all the Moonlantern's.
      const seen = f.kind === 'shade' ? Phaser.Math.Clamp(1.3 - Math.hypot(f.x - s.x, f.y - s.y) / SHADE_SEEN_PX, 0.12, 1) : 1;
      f.sprite.setAlpha((f.stun > 0 ? 0.6 : 1) * seen);
      if (f.hurt > 0 && !settings.reduceMotion) f.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else f.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      if ((f.kind === 'slug' || f.kind === 'beetle' || f.kind === 'frog') && f.dir.x) f.sprite.setFlipX(f.kind === 'frog' ? f.dir.x < 0 : s.x < f.x);
    }
    for (const [id, img] of this.stoneSprites) {
      const st = this.map.stones.find((x) => x.id === id);
      if (!st) continue;
      if (AFTER_BOSS[id]) img.setVisible(hasFlag(s, AFTER_BOSS[id]));
      const c = centre(st);
      img.setY(c.y - 4 + (settings.reduceMotion ? 0 : Math.sin(this.now / 350 + c.x) * 2));
    }
    // The hidden bridges fade in where the Moonlantern shines; a moved moonstone glimmers in the knight's light.
    for (const [, img] of this.veilSprites) img.setAlpha(this.moonlight(img.x, img.y, VEIL_PX));
    // A mill or pinwheel the horn has blown on keeps turning.
    for (const m of this.mills) if (m.turned) m.head.setAngle((this.now / (m.prop.kind === 'mill' ? 30 : 6)) % 360);
    for (const [, img] of this.glimmers) {
      const near = Phaser.Math.Clamp(1.2 - Math.hypot(img.x - s.x, img.y - s.y) / GLIMMER_PX, 0, 1);
      img.setAlpha(near * (settings.reduceMotion ? 0.9 : 0.65 + Math.sin(this.now / 160 + img.x) * 0.35));
    }
    // Lights: the map's own, the knight's lantern, moonstones, the wisp and the queen's lit bulbs.
    const lights = [...this.glows];
    const moon = s.items.moonlantern;
    lights.push({ x: s.x, y: s.y - 16, r: s.items.oil ? LANTERN_OIL : LANTERN, col: moon ? [215, 230, 255] : [255, 210, 150], power: 0.9 });
    for (const [, img] of this.findSprites) lights.push({ x: img.x, y: img.y - 6, r: 34, col: [255, 240, 200], power: 0.5 });
    const g = this.gloam;
    if (g) lights.push({ x: g.x, y: g.y - g.lift - 10, r: 130, col: [160, 170, 255], power: 0.6 });
    const bw = this.brine;
    if (bw && bw.awake) lights.push({ x: bw.x, y: bw.y - 30, r: 120, col: [140, 240, 210], power: bw.state === 'under' ? 0.3 : 0.6 });
    if (this.fishing) lights.push({ x: this.fishing.x, y: this.fishing.y, r: 30, col: [255, 230, 170], power: 0.5 });
    for (const [, img] of this.stoneSprites) if (img.visible) lights.push({ x: img.x, y: img.y, r: 40, col: [170, 210, 255], power: 0.6 });
    if (this.wisp) lights.push({ x: this.wisp.sprite.x, y: this.wisp.sprite.y, r: 110, col: [170, 230, 255], power: 0.9 });
    if (this.boss) {
      lights.push({ x: this.boss.x, y: this.boss.y, r: 150, col: [200, 90, 160], power: 0.5 });
      for (const b of this.boss.bulbs) if (b.state === 'raised' || b.state === 'down') lights.push({ x: b.x, y: b.y - 14, r: 80, col: [220, 255, 140], power: 0.8 });
    }
    for (const sd of this.seeds) lights.push({ x: sd.x, y: sd.y, r: 24, col: [230, 120, 200], power: 0.5 });
    for (const f of this.foes) if (f.alive && f.kind === 'lantern') lights.push({ x: f.x, y: f.sprite.y - 8, r: 90, col: [255, 190, 110], power: 0.8 });
    for (const b of this.bombs) lights.push({ x: b.x, y: b.y - 10, r: 46, col: [210, 255, 150], power: 0.7 });
    for (const p of this.pods) lights.push({ x: p.x, y: p.y, r: 30, col: [210, 255, 150], power: 0.5 });
    for (const c of this.coins) lights.push({ x: c.x, y: c.y, r: 26, col: [255, 220, 120], power: 0.5 });
    const w = this.wraith;
    if (w) {
      lights.push({ x: w.x, y: w.y - w.lift - 30, r: 110, col: [150, 210, 255], power: 0.55 });
      if (w.state === 'tipped') lights.push({ x: w.x, y: w.y - 30, r: 120, col: [170, 230, 255], power: 0.9 });
    }
    for (const f of this.flashes) lights.push({ ...f, power: f.power * Math.min(1, f.t / 200) });
    for (const [, img] of this.glimmers) if (img.alpha > 0.1) lights.push({ x: img.x, y: img.y, r: 36, col: [190, 220, 255], power: 0.6 * img.alpha });
    for (const [, img] of this.veilSprites) if (img.alpha > 0.3) lights.push({ x: img.x, y: img.y, r: 30, col: [180, 210, 255], power: 0.35 * img.alpha });
    this.night.draw(this.cameras.main.worldView, lights, this.map.dark);
  }

  // ---------------------------------------------------------------- for the playthrough test

  /** Where a point in the world is on the screen, in view pixels. */
  screenOf(x: number, y: number) {
    const v = this.cameras.main.worldView;
    const k = viewSize(this).width / v.width;
    return { x: (x - v.x) * k, y: (y - v.y) * k };
  }

  /** Where to tap to reach a person or a chest, in the world. */
  spot(kind: 'npc' | 'chest', id: string) {
    if (kind === 'npc') {
      const n = this.map.npcs.find((x) => x.id === id)!;
      const c = centre(n);
      return { x: c.x, y: c.y - 6 };
    }
    const ch = this.map.chests.find((x) => x.id === id)!;
    return centre(ch);
  }
}
