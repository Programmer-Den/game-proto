// The whole game in one scene: the map the knight is in, the knight, the people and foes in it,
// the night's light and the HUD. Changing place swaps the map's sprites but keeps the scene.

import Phaser from 'phaser';
import { paintAll, texScale } from '../art/paint';
import { paintGround, groundKey } from '../art/ground';
import { BREAKABLE, buildMap, centre, CUTTABLE, DUNGEONS, LOW, MAP_IDS, setTile, SOLID, TILE, tileAt, underBoulder, type Door, type Facing, type ItemId, type MapDef, type MapId, type NpcId, type Prop, type PropKind } from '../game/maps';
import { findPath, type Step } from '../game/path';
import { advance, buy, CHAPTER_ONE_STONES, clearSave, clock, give, hasFlag, hasUpgrade, load, maxSeeds, MOONSTONES, newState, reached, save, setFlag, stonesToFind, UPGRADES, type GameState, type Seller } from '../game/state';
import { talk, type TalkEffect } from '../game/talk';
import { t, type TextKey } from '../i18n';
import { settings } from '../../../../shared/settings';
import { renderScale, scrollingCamera, splitHudCamera, viewPoint, viewSize } from '../../../../shared/scaling';
import { playMusic, playSting, ui } from '../../../../shared/audio';
import { sfx } from '../audio/sounds';
import { BOSS, DEEP, STINGS, VILLAGE, WILDS } from '../audio/music';
import { Hud } from './hud';
import { NightLight, type Light } from './light';
import {
  BELL_DOWN_MS, BULB_DOWN_MS, BULB_EVERY_MS, BULB_HP, BULB_UP_MS, BURST_PX, DROP_MS, EXPOSED_MS, FOES, foeFree, FROG_LEAP_MS, FROG_WAIT_MS, FUSE_MS, HOVER_MS, HOVER_SPEED,
  makeFoe, SEED_SPEED, SLAM_PX, SUMMON_MS, THORNLING_SHOT_MS, TRIAL, VOLLEY_MS, WRAITH_HP,
  type Bomb, type Boss, type Foe, type Seed, type Wraith,
} from './foes';
import {
  BOOTS, HURT_MS, LANTERN, LONG_VINE, LANTERN_OIL, PICKUP_PX, PLANT_REACH, PULL_SPEED, ROLL_COOLDOWN_MS, ROLL_MS, ROLL_SPEED, STICK, SWING_COOLDOWN_MS, SWING_MS, SWING_RADIUS, SWING_REACH, VINE_RANGE, VINE_SPEED,
  WALK_SPEED,
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
};

/** Moonstones that only show once a boss is beaten, and the flag that beats it. */
const AFTER_BOSS: Record<string, string> = { 's-boss': 'boss', 'b-bell': 'wraith' };
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
  | { kind: 'cut' | 'dig' | 'block' | 'door' | 'ring' | 'plant' | 'hourglass'; tx: number; ty: number }
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
  /** The bells rung so far, in order, toward the belfry's tune. */
  private bellSeq: number[] = [];
  /** Short bursts of light: a bellseed going off, a bell ringing. */
  private flashes: (Light & { t: number })[] = [];
  private glows: Light[] = [];
  private wisp: { i: number; sprite: Phaser.GameObjects.Image; hop: number } | null = null;
  private dug = new Set<string>();
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
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ENTER,J,SHIFT,K,Q,E,L,B,X', false) as Record<string, Phaser.Input.Keyboard.Key>;
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
    this.wisp = null;
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
          const key = map.theme === 'fen' ? 'tree-fen' : (tx * 7 + ty * 3) % 3 === 0 ? 'tree-b' : 'tree';
          this.addWorld(this.add.image(tx * TILE + 16, ty * TILE + 30, key).setOrigin(0.5, 64 / 72), (ty + 1) * TILE - 2);
        } else if (t === 'bush' || t === 'thorns') {
          const img = this.add.image(tx * TILE + 16, ty * TILE + 28, t).setOrigin(0.5, t === 'bush' ? 25 / 30 : 29 / 34);
          this.addWorld(img, (ty + 1) * TILE - 4);
          this.bushSprites.set(ty * map.w + tx, img);
        } else if (t === 'boulder') {
          const img = this.add.image(tx * TILE + 16, ty * TILE + 28, 'boulder').setOrigin(0.5, 27 / 32);
          this.addWorld(img, (ty + 1) * TILE - 4);
          this.bushSprites.set(ty * map.w + tx, img);
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
    }
    map.enemies.forEach((e, i) => {
      if (DUNGEONS.has(id) && hasFlag(s, this.foeFlag(i)) && !trial) return;
      const c = centre(e);
      this.spawnFoe(e.kind, c.x, c.y, i, e.room);
    });
    if (id === 'shrine' && map.boss && (!hasFlag(s, 'boss') || trial)) this.makeBoss(map.boss);
    if (id === 'belfry' && map.boss && (!hasFlag(s, 'wraith') || trial)) this.makeWraith(map.boss);
    // The hourglass by a dungeon's entry turns up once chapter two is done.
    if (map.hourglass && reached(s, 'end')) {
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
    switch (this.map.theme) {
      case 'village':
        return playMusic(VILLAGE, 'calm');
      case 'woods':
      case 'fen':
        return playMusic(WILDS, this.map.theme);
      case 'shrine':
      case 'belfry':
        return playMusic(DEEP, this.map.theme);
    }
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
    if (d.room === 'boss') return !!this.boss || !!this.wraith;
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

  /** Whether the knight can't walk onto a tile. */
  solidTile(tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= this.map.w || ty >= this.map.h) return true;
    const k = ty * this.map.w + tx;
    return SOLID.has(tileAt(this.map, tx, ty)) || this.blockers.has(k) || this.closedDoors.has(k) || this.blocks.some((b) => b.x === tx && b.y === ty);
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
    const code = e.code;
    if (this.hud.shopOpen) {
      const i = Number(code.replace('Digit', '')) - 1;
      if (code.startsWith('Digit') && i >= 0) this.hud.pressShop(i);
      else if (code === 'Escape' || code === 'Space' || code === 'Enter' || code === 'KeyN') this.hud.closeShop();
      return;
    }
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
    if (this.hud.plateAt(viewPoint(pointer))) return this.toggleStones();
    const btn = this.hud.buttonAt(viewPoint(pointer), this.state);
    if (btn === 'sword') return this.act();
    if (btn === 'roll') return this.startRoll();
    if (btn === 'vine') return this.fireVine();
    if (btn === 'seed') return this.plantSeed();
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
    const foe = this.foes.find((f) => f.alive && Math.hypot(f.x - wx, f.y - 10 - wy) < 26);
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
    else this.interactAt(at.x, at.y);
  }

  /** Space, J or the sword button: talk to or use what is in front, else swing the sword. */
  private act() {
    const s = this.state;
    const d = DIRS[s.facing];
    const tx = Math.floor((s.x + d.x * 22) / TILE);
    const ty = Math.floor((s.y - 4 + d.y * 22) / TILE);
    if (this.interactAt(tx, ty)) return;
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
    return !!h && h.x === tx && h.y === ty && reached(this.state, 'end');
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
    const s = this.state;
    const two = reached(s, 'bell');
    const rows = MAP_IDS.map((id) => buildMap(id))
      .map((m) => {
        const ids = m.stones.filter((st) => two || st.chapter !== 2).map((st) => st.id);
        return { name: m.name, found: ids.filter((i) => s.moonstones.includes(i)).length, total: ids.length };
      })
      .filter((r) => r.total > 0);
    const trials = reached(s, 'end') ? (['shrine', 'belfry'] as const).map((id) => ({ place: t(id), ms: s.trials[id] })) : [];
    ui('click');
    this.route = null;
    this.target = null;
    this.stick = null;
    this.hud.showStones(rows, trials);
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
    };
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
      case 'trial':
        this.startTrial();
        return;
    }
    this.persist();
  }

  private chapterEnd(chapter: 1 | 2) {
    const s = this.state;
    const n = s.moonstones.length;
    const total = chapter === 1 ? CHAPTER_ONE_STONES : MOONSTONES;
    const ending =
      chapter === 1
        ? n >= total
          ? t('endOneAll')
          : n >= 4
            ? t('endOneSome')
            : t('endOneFew')
        : n >= total
          ? t('endTwoAll')
          : n >= 10
            ? t('endTwoSome')
            : t('endTwoFew');
    const many = chapter === 1 ? 4 : 10;
    playSting(STINGS, n >= total ? 'endAll' : n >= many ? 'endSome' : 'endFew');
    this.hud.showEnd(
      chapter === 1 ? t('chapterOne') : t('chapterTwo'),
      [t('endStats', { n, total, beaten: s.beaten, falls: s.falls }), ending],
      () => {
        clearSave();
        this.state = newState();
        this.enterMap(this.state.map, this.state.x, this.state.y, this.state.facing, false);
      },
    );
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
    const hx = s.x + d.x * SWING_REACH;
    const hy = s.y - 10 + d.y * SWING_REACH;
    // Foes and the Thornmother's bulbs in reach.
    for (const f of this.foes) if (f.alive && Math.hypot(f.x - hx, f.y - 8 - hy) < SWING_RADIUS + 12) this.hitFoe(f, d);
    if (this.boss) for (const b of this.boss.bulbs) if (b.state === 'down' && Math.hypot(b.x - hx, b.y - 10 - hy) < SWING_RADIUS + 14) this.hitBulb(b);
    const w = this.wraith;
    if (w && (w.state === 'tipped' || w.state === 'down') && Math.hypot(w.x - hx, w.y - 12 - hy) < SWING_RADIUS + 26) this.hitWraith();
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
        ((Math.floor(s.x / TILE) === st.x && Math.floor(s.y / TILE) === st.y) || Math.hypot((st.x + 0.5) * TILE - hx, (st.y + 0.5) * TILE - hy) <= 32)
      ) {
        this.dug.add(st.id);
        this.stoneSprites.get(st.id)?.setVisible(true);
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
    if (!s.items.seeds || this.roll || this.hook || this.bombs.length >= 2) return;
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
    this.rollCd = ROLL_COOLDOWN_MS * (hasUpgrade(s, 'boots') ? BOOTS.cooldown : 1);
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
    if (!s.items.hookvine || this.hook || this.roll) return;
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
    const rows = UPGRADES.filter((u) => u.seller === seller).map((u) => ({
      id: u.id,
      cost: u.cost,
      state: hasUpgrade(s, u.id) ? ('owned' as const) : u.needs && !s.items[u.needs] ? ('locked' as const) : ('buy' as const),
    }));
    this.route = null;
    this.target = null;
    this.stick = null;
    this.hud.showShop(t(seller === 'baker' ? 'bakerName' : 'hermitName'), s.coins, rows, (id) => {
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
      this.invuln = Math.max(0, this.invuln - dt);
      this.movePlayer(dt);
      this.updateHook(dt);
      this.updateFoes(dt);
      this.updateSeeds(dt);
      this.updateBombs(dt);
      this.updateBoss(dt);
      this.updateWraith(dt);
      this.updateWisp(dt);
      this.pickups();
      this.updateDoors();
      this.checkExits();
    }
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
      this.tryMove(this.roll.dx * ROLL_SPEED * sec, this.roll.dy * ROLL_SPEED * sec);
      if (this.roll.t >= this.rollMs()) this.roll = null;
      return;
    }
    if (this.hook?.phase === 'pull') return;
    let mv = this.moveInput();
    if (mv.x || mv.y) {
      this.route = null;
      this.target = null;
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
      const foe = this.foes.find((f) => f.alive && Math.hypot(f.x - h.x, f.y - 10 - h.y) < 16);
      if (foe) {
        foe.stun = 1600;
        sfx('latch');
        h.phase = 'back';
        return;
      }
      const tx = Math.floor(h.x / TILE);
      const ty = Math.floor((h.y + 12) / TILE);
      const t = tileAt(this.map, tx, ty);
      const blocked = (SOLID.has(t) && !LOW.has(t)) || this.blockers.has(ty * this.map.w + tx) || this.closedDoors.has(ty * this.map.w + tx);
      if (blocked || h.dist >= VINE_RANGE * (hasUpgrade(s, 'vine') ? LONG_VINE : 1)) h.phase = 'back';
    }
  }

  private hurt(damage: number, from: { x: number; y: number }) {
    const s = this.state;
    if (this.invuln > 0 || this.roll || this.hook?.phase === 'pull') return;
    s.hp = Math.max(0, s.hp - damage);
    this.invuln = HURT_MS;
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
    const exit = this.map.exits.find((e) => tx >= e.x && tx < e.x + e.w && ty >= e.y && ty < e.y + e.h && (!e.flag || hasFlag(s, e.flag)));
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
  }

  // ---------------------------------------------------------------- foes

  private spawnFoe(kind: Foe['kind'], x: number, y: number, index: number, room?: string) {
    const f = makeFoe(this, kind, x, y, index, room);
    this.world.push(f.sprite);
    this.foes.push(f);
    return f;
  }

  private hitFoe(f: Foe, d: { x: number; y: number }) {
    if (f.hurt > 0) return;
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
    this.puff(f.x, f.y - 10, f.kind === 'moth' ? 0xc8bce0 : 0x6a8a4a);
    f.sprite.destroy();
    if (DUNGEONS.has(this.map.id) && f.index >= 0) setFlag(this.state, this.foeFlag(f.index));
    // Every foe leaves a coin, and sometimes a heart or a seed pod beside it.
    this.dropCoin(f.x, f.y);
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
      if (f.kind === 'slug') {
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
      } else if (f.kind === 'moth') {
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
      const nx = f.x + vx * sec;
      const ny = f.y + vy * sec;
      // A foe that bumps into something turns at once; a frog just ends its leap.
      if (foeFree(this.map, this.standing, nx, f.y, info.flies)) f.x = nx;
      else if (f.kind === 'frog') f.leap = 0;
      else f.t = 0;
      if (foeFree(this.map, this.standing, f.x, ny, info.flies)) f.y = ny;
      else if (f.kind === 'frog') f.leap = 0;
      else f.t = 0;
      if (Math.hypot(s.x - f.x, s.y - f.y) < 18) this.hurt(info.damage, f);
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

  private shoot(x: number, y: number, dx: number, dy: number) {
    const sprite = this.add.image(x, y, 'seed').setScale(texScale('seed'));
    this.seeds.push({ x, y, vx: dx * SEED_SPEED, vy: dy * SEED_SPEED, sprite, life: 4000 });
  }

  private updateSeeds(dt: number) {
    const s = this.state;
    const sec = dt / 1000;
    this.seeds = this.seeds.filter((sd) => {
      sd.x += sd.vx * sec;
      sd.y += sd.vy * sec;
      sd.life -= dt;
      const t = tileAt(this.map, Math.floor(sd.x / TILE), Math.floor((sd.y + 12) / TILE));
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
        next.t = BULB_UP_MS * (this.trial ? TRIAL.bulbUp : 1);
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
      boss.volleyT = (VOLLEY_MS[3 - left] ?? VOLLEY_MS[2]) * (this.trial ? TRIAL.volley : 1);
      sfx('volley');
      const turn = (this.now / 1000) % 1;
      const shots = this.trial ? TRIAL.volleyShots : 8;
      for (let i = 0; i < shots; i++) {
        const a = ((i + turn) / shots) * Math.PI * 2;
        this.shoot(boss.x + Math.cos(a) * 30, boss.y + Math.sin(a) * 20, Math.cos(a), Math.sin(a));
      }
    }
    boss.summonT -= dt;
    if (boss.summonT <= 0) {
      boss.summonT = SUMMON_MS * (this.trial ? TRIAL.summon : 1);
      if (this.foes.filter((f) => f.alive && f.room === 'boss').length < (this.trial ? TRIAL.summoned : 2)) {
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
    this.wraith = { x, y, lift: BELL_LIFT, state: 'hover', t: HOVER_MS, hp: this.trial ? TRIAL.wraithHp : WRAITH_HP, bell, ghost, shadow, summonT: SUMMON_MS, podT: 3000, awake: false };
  }

  private tipBell() {
    const w = this.wraith!;
    w.state = 'tipped';
    w.t = EXPOSED_MS * (this.trial ? TRIAL.exposed : 1);
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
      const step = Math.min(dist, (HOVER_SPEED * (this.trial ? TRIAL.hoverSpeed : 1) * dt) / 1000);
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
        w.t = HOVER_MS * (this.trial ? TRIAL.hover : 1);
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
      const key = f.kind === 'moth' ? (Math.floor(this.now / 120 + f.index) % 2 ? 'moth-a' : 'moth-b') : f.kind;
      const lift = f.kind === 'moth' ? 12 : f.kind === 'frog' && f.leap > 0 ? Math.sin((1 - f.leap / FROG_LEAP_MS) * Math.PI) * 10 : 0;
      f.sprite.setTexture(key).setScale(texScale(key)).setPosition(f.x, f.y - lift).setDepth(f.y);
      f.sprite.setAlpha(f.stun > 0 ? 0.6 : 1);
      if (f.hurt > 0 && !settings.reduceMotion) f.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else f.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      if ((f.kind === 'slug' || f.kind === 'frog') && f.dir.x) f.sprite.setFlipX(f.kind === 'slug' ? s.x < f.x : f.dir.x < 0);
    }
    for (const [id, img] of this.stoneSprites) {
      const st = this.map.stones.find((x) => x.id === id);
      if (!st) continue;
      if (AFTER_BOSS[id]) img.setVisible(hasFlag(s, AFTER_BOSS[id]));
      const c = centre(st);
      img.setY(c.y - 4 + (settings.reduceMotion ? 0 : Math.sin(this.now / 350 + c.x) * 2));
    }
    // Lights: the map's own, the knight's lantern, moonstones, the wisp and the queen's lit bulbs.
    const lights = [...this.glows];
    lights.push({ x: s.x, y: s.y - 16, r: s.items.oil ? LANTERN_OIL : LANTERN, col: [255, 210, 150], power: 0.9 });
    for (const [, img] of this.stoneSprites) if (img.visible) lights.push({ x: img.x, y: img.y, r: 40, col: [170, 210, 255], power: 0.6 });
    if (this.wisp) lights.push({ x: this.wisp.sprite.x, y: this.wisp.sprite.y, r: 110, col: [170, 230, 255], power: 0.9 });
    if (this.boss) {
      lights.push({ x: this.boss.x, y: this.boss.y, r: 150, col: [200, 90, 160], power: 0.5 });
      for (const b of this.boss.bulbs) if (b.state === 'raised' || b.state === 'down') lights.push({ x: b.x, y: b.y - 14, r: 80, col: [220, 255, 140], power: 0.8 });
    }
    for (const sd of this.seeds) lights.push({ x: sd.x, y: sd.y, r: 24, col: [230, 120, 200], power: 0.5 });
    for (const b of this.bombs) lights.push({ x: b.x, y: b.y - 10, r: 46, col: [210, 255, 150], power: 0.7 });
    for (const p of this.pods) lights.push({ x: p.x, y: p.y, r: 30, col: [210, 255, 150], power: 0.5 });
    for (const c of this.coins) lights.push({ x: c.x, y: c.y, r: 26, col: [255, 220, 120], power: 0.5 });
    const w = this.wraith;
    if (w) {
      lights.push({ x: w.x, y: w.y - w.lift - 30, r: 110, col: [150, 210, 255], power: 0.55 });
      if (w.state === 'tipped') lights.push({ x: w.x, y: w.y - 30, r: 120, col: [170, 230, 255], power: 0.9 });
    }
    for (const f of this.flashes) lights.push({ ...f, power: f.power * Math.min(1, f.t / 200) });
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
