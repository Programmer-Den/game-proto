import { settings } from '../../../../shared/settings';
import { viewFrame, viewSize } from '../../../../shared/scaling';
import Phaser from 'phaser';
import { ui } from '../../../../shared/audio';
import { Cues } from '../audio/cues';
import { sfx, type SoundName } from '../audio/sounds';
import { foeTexture, heroTexture } from '../art/characters';
import { cardIcon, flaskIcon, relicIcon } from '../art/icons';
import { BLUE, GOLD, INK, PURPLE, RED, STONE } from '../art/palette';
import { artImage } from '../art/paint';
import { backdrop } from '../art/scenery';
import { canBeTempered, card, cardName, describePower, kindOf, tempered, type CardId } from '../game/cards';
import { depthText } from '../game/depth';
import { ENEMIES, type StatusKind } from '../game/enemies';
import { FLASKS, FLASK_SLOTS } from '../game/flasks';
import { HEROES } from '../game/heroes';
import { COLUMNS, ENTRANCE, reachable } from '../game/map';
import { RELICS, relicText, type RelicId } from '../game/relics';
import { t, type TextKey } from '../i18n';
import {
  actName,
  buyCard,
  buyFlask,
  buyRelic,
  buyRemoval,
  canBuyFlask,
  canBuyRemoval,
  canChoose,
  canPlay,
  canRemove,
  canTemper,
  canUseFlask,
  chooseEvent,
  chooseHero,
  descend,
  endTurn,
  eventHere,
  foeHit,
  leaveShop,
  newRun,
  playCard,
  removeCard,
  rest,
  restHeal,
  setDepth,
  takeReward,
  temperCard,
  tick,
  useFlask,
  walkTo,
} from '../game/sim';
import { ENERGY, HAND_SIZE, POP_MS, WALK_MS, type Enemy, type GameState, type Status } from '../game/state';
import { checkTrophies } from '../trophies/check';
import { makeButton } from '../ui/Button';
import { makeCard } from '../ui/CardView';
import {
  BUTTON,
  END_TURN,
  ENERGY_ORB,
  EVENT_BUTTONS,
  FLASKS as FLASK_ROW,
  FOE_FEET_Y,
  FOE_XS,
  FONT,
  HAND,
  HERO_PANEL,
  HERO_FEET,
  HP_BAR,
  HUD,
  HUD_HEIGHT,
  PANEL_BUTTON,
  PICKER,
  PILES_Y,
  POWERS,
  REST_BUTTONS,
  REWARD,
  ROOM_RADIUS,
  SHOP,
  SKIP,
  STATUS_GAP,
  UI_DEPTH,
  VIEW,
} from './layout';

/** Longest simulated step, so a backgrounded tab doesn't jump the game forward. */
const MAX_STEP_MS = 250;
/** How long a relic's name and text stay up after tapping its icon in the top bar. */
const TIP_MS = 2500;

/** Where a card is on screen; read by the playthrough test to tap it. */
export interface CardSpot {
  id: CardId;
  x: number;
  y: number;
  w: number;
  h: number;
}

const textStyle = (size: number, color = '#f3e9d2') => ({
  fontFamily: FONT,
  fontSize: `${size}px`,
  color,
  stroke: '#141018',
  strokeThickness: 4,
});

const STATUS_KINDS: StatusKind[] = ['weak', 'vulnerable', 'poison'];
const STATUS_COLORS: Record<StatusKind, string> = { weak: '#d8c7a6', vulnerable: '#8ab8e8', poison: '#a8e070' };

/** A fighter's statuses, each an icon and its number, in a row centred on a point. */
class StatusRow {
  private parts: { kind: StatusKind; icon: Phaser.GameObjects.Image; text: Phaser.GameObjects.Text }[];

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container) {
    this.parts = STATUS_KINDS.map((kind) => {
      const icon = artImage(scene, 0, 0, `status-${kind}`).setVisible(false);
      const text = scene.add.text(0, 0, '', textStyle(15, STATUS_COLORS[kind])).setOrigin(0, 0.5).setVisible(false);
      layer.add([icon, text]);
      return { kind, icon, text };
    });
  }

  draw(status: Status | undefined, x: number, y: number) {
    const shown = this.parts.filter((p) => (status?.[p.kind] ?? 0) > 0);
    for (const p of this.parts) {
      const i = shown.indexOf(p);
      p.icon.setVisible(i >= 0);
      p.text.setVisible(i >= 0);
      if (i < 0) continue;
      const cx = x + (i - (shown.length - 1) / 2) * STATUS_GAP;
      p.icon.setPosition(cx - 9, y);
      p.text.setPosition(cx + 5, y).setText(String(status![p.kind]));
    }
  }

  destroy() {
    for (const p of this.parts) {
      p.icon.destroy();
      p.text.destroy();
    }
  }
}

/** What is drawn for one foe. */
interface Foe {
  sprite: Phaser.GameObjects.Image;
  intent: Phaser.GameObjects.Image;
  intentText: Phaser.GameObjects.Text;
  /** The status an intent puts on the hero, after its number. */
  intentExtra: Phaser.GameObjects.Image;
  hp: Phaser.GameObjects.Text;
  statuses: StatusRow;
  x: number;
}

/** What the card picker is for: burning or tempering at a campfire, or the merchant's removal. */
type PickMode = 'burn' | 'temper' | 'sell';

const PICK_TITLES: Record<PickMode, TextKey> = { burn: 'burnPick', temper: 'temperPick', sell: 'sellPick' };

/** A flask's name and rules in the hub's language. */
const flaskTip = (id: keyof typeof FLASKS) => ({ name: t(FLASKS[id].name), text: t(FLASKS[id].text, { n: FLASKS[id].n }) });

const POP_COLORS = { damage: '#f4a08a', block: '#8ab8e8', heal: '#8cd060', status: '#c49ae8' };

export class GameScene extends Phaser.Scene {
  /** The run being played; read by the playthrough test. */
  state!: GameState;
  /** Plays what the run does each frame, and its music. */
  private cues!: Cues;
  /** The cards in hand, in order; read by the playthrough test. */
  hand: CardSpot[] = [];
  /** The reward cards on offer; read by the playthrough test. */
  rewards: CardSpot[] = [];

  private mapLayer!: Phaser.GameObjects.Container;
  private mapBg!: Phaser.GameObjects.Image;
  private paths!: Phaser.GameObjects.Graphics;
  private roomRings!: Phaser.GameObjects.Graphics;
  /** The room icons and their tap circles, rebuilt for each act's map. */
  private roomLayer!: Phaser.GameObjects.Container;
  private roomsBuilt: GameState['rooms'] | null = null;
  private token!: Phaser.GameObjects.Image;
  private mapHint!: Phaser.GameObjects.Text;

  private fightLayer!: Phaser.GameObjects.Container;
  private roomBg!: Phaser.GameObjects.Image;
  private hero!: Phaser.GameObjects.Image;
  private heroStatuses!: StatusRow;
  private foes = new Map<number, Foe>();
  private heroHp!: Phaser.GameObjects.Text;
  private bars!: Phaser.GameObjects.Graphics;
  private handLayer!: Phaser.GameObjects.Container;
  private handKey = '';
  private energyText!: Phaser.GameObjects.Text;
  private drawText!: Phaser.GameObjects.Text;
  private discardText!: Phaser.GameObjects.Text;
  private endTurnButton!: Phaser.GameObjects.Container;
  private turnBanner!: Phaser.GameObjects.Text;
  /** The flask slots down the left of a fight, rebuilt when the flasks or the phase change. */
  private flaskLayer!: Phaser.GameObjects.Container;
  private flaskKey = '';
  /** The powers in play, under the top bar. */
  private powerLayer!: Phaser.GameObjects.Container;
  private powerKey = '';

  private rewardLayer!: Phaser.GameObjects.Container;
  private rewardTitle!: Phaser.GameObjects.Text;
  private rewardKey = '';
  private panel!: Phaser.GameObjects.Container;
  private panelTitle!: Phaser.GameObjects.Text;
  private panelText!: Phaser.GameObjects.Text;
  private panelButton!: Phaser.GameObjects.Container;
  private panelAction: () => void = () => {};
  /** The campfire's other choices, next to Rest. */
  private temperButton!: Phaser.GameObjects.Container;
  private removeButton!: Phaser.GameObjects.Container;
  /** A mystery room's two choices, and the hero choice's two heroes. */
  private choiceButtons: Phaser.GameObjects.Container[] = [];
  /** On the hero panel: the two heroes, the depth's arrows and label. */
  private heroPics: Phaser.GameObjects.Image[] = [];
  private depthButtons: Phaser.GameObjects.Container[] = [];
  private depthText!: Phaser.GameObjects.Text;
  /** The deck laid out to pick a card to burn, temper or sell. */
  private pickLayer!: Phaser.GameObjects.Container;
  private pickTitle!: Phaser.GameObjects.Text;
  private picking: PickMode | null = null;
  private pickKey = '';

  private shopLayer!: Phaser.GameObjects.Container;
  private shopKey = '';

  private hud!: Phaser.GameObjects.Graphics;
  private hpText!: Phaser.GameObjects.Text;
  private deckText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private roomText!: Phaser.GameObjects.Text;
  private relicLayer!: Phaser.GameObjects.Container;
  /** The top bar's room text and relic count it was last laid out for. */
  private barKey = '';
  private relicKey = '';
  private tip!: Phaser.GameObjects.Text;
  private tipMs = 0;
  private pops = new Map<number, Phaser.GameObjects.Text>();
  private lastFrame: number | null = null;
  private clock = 0;
  /** The view's size, and where the designed 960x540 frame sits in it; picked once in `create`. */
  private W: number = VIEW.w;
  private H: number = VIEW.h;
  private fx = 0;
  private fy = 0;

  constructor() {
    super('Game');
  }

  create() {
    // The map, the fight and the panels are laid out for 960x540 in containers placed at the
    // view's frame; backdrops and dimmers stretch over the whole view, and the top bar, the
    // fight's orb, End turn, hand and flasks are pinned to the view's edges.
    const view = viewSize(this);
    const frame = viewFrame(this);
    this.W = view.width;
    this.H = view.height;
    this.fx = frame.x;
    this.fy = frame.y;
    this.state = newRun();
    this.cues = new Cues(this.state);
    this.foes.clear();
    this.pops.clear();
    this.handKey = '';
    this.rewardKey = '';
    this.picking = null;
    this.pickKey = '';
    this.shopKey = '';
    this.relicKey = '';
    this.barKey = '';
    this.flaskKey = '';
    this.powerKey = '';
    this.roomsBuilt = null;
    this.tipMs = 0;
    this.choiceButtons = [];
    this.createMap();
    this.createFight();
    this.createReward();
    this.createShop();
    this.createPanel();
    this.createPicker();
    this.createHud();
  }

  /** Plays `sound` when the sim took the hero's action, the refusal buzz when it didn't; returns whether it was taken. */
  private act(done: boolean, sound: SoundName | 'click') {
    if (!done) ui('refuse');
    else if (sound === 'click') ui('click');
    else sfx(sound);
    return done;
  }

  update(time: number) {
    // Game time from the frame's own timestamp rather than Phaser's smoothed delta.
    const dt = this.lastFrame === null ? 0 : Phaser.Math.Clamp(time - this.lastFrame, 0, MAX_STEP_MS);
    this.lastFrame = time;
    this.clock += dt;
    this.tipMs = Math.max(0, this.tipMs - dt);
    tick(this.state, dt);
    checkTrophies(this.state);
    this.cues.hear(this.state, dt);

    const s = this.state;
    const roomKind = s.at === null ? null : s.rooms[s.at]?.kind;
    const inFight = roomKind === 'fight' || roomKind === 'elite' || roomKind === 'boss';
    const onMap = ['hero', 'map', 'walk', 'rest', 'shop', 'event'].includes(s.phase) || (s.phase === 'reward' && !inFight);
    this.mapLayer.setVisible(onMap);
    this.fightLayer.setVisible(!onMap);
    // Pops first, so a killing blow's number still finds its foe before drawFight drops it.
    this.drawPops(onMap);
    if (onMap) this.drawMap();
    else this.drawFight(dt);
    this.drawReward();
    this.drawShop();
    this.drawPanel();
    this.drawHud();
  }

  // The map

  private createMap() {
    this.mapBg = artImage(this, -this.fx, -this.fy, 'map-bg').setOrigin(0);
    this.paths = this.add.graphics();
    this.roomRings = this.add.graphics();
    this.roomLayer = this.add.container(0, 0);
    this.token = artImage(this, ENTRANCE.x, ENTRANCE.y, heroTexture('knight', true)).setOrigin(0.5, 1);
    this.mapHint = this.add
      .text(VIEW.w / 2, VIEW.h - 34 + this.fy, '', { ...textStyle(18, '#e6c766'), align: 'center', wordWrap: { width: VIEW.w - 80 } })
      .setOrigin(0.5);
    this.mapLayer = this.add.container(this.fx, this.fy, [this.mapBg, this.paths, this.roomRings, this.roomLayer, this.token, this.mapHint]);
  }

  /** The room icons and their tap circles, made again whenever a new act brings a new map. */
  private buildRooms() {
    const s = this.state;
    if (this.roomsBuilt === s.rooms) return;
    this.roomsBuilt = s.rooms;
    this.roomLayer.removeAll(true);
    s.rooms.forEach((room, i) => {
      const icon = artImage(this, room.x, room.y, `room-${room.kind}`);
      // Taps land anywhere in the room's circle.
      const hit = this.add.circle(room.x, room.y, ROOM_RADIUS, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        if (!walkTo(this.state, i) && this.state.phase === 'map') ui('refuse');
      });
      this.roomLayer.add([icon, hit]);
    });
    this.mapBg.setTexture(backdrop('map', s.act));
    this.roomBg.setTexture(backdrop('room', s.act));
  }

  private drawMap() {
    this.buildRooms();
    const s = this.state;
    const rooms = s.rooms;
    const next = s.phase === 'map' ? reachable(rooms, s.at) : [];
    const g = this.paths.clear();
    // Dotted paths between rooms; the ones walked are lit.
    const walked = new Set(s.cleared.map((r, i) => `${i === 0 ? -1 : s.cleared[i - 1]}>${r}`));
    const dots = (ax: number, ay: number, bx: number, by: number, lit: boolean) => {
      const n = Math.floor(Math.hypot(bx - ax, by - ay) / 12);
      for (let i = 1; i < n; i++) {
        const t = i / n;
        g.fillStyle(lit ? GOLD.light : STONE.shine, lit ? 1 : 0.6).fillRect(ax + (bx - ax) * t - 2, ay + (by - ay) * t - 2, 4, 4);
      }
    };
    for (const i of reachable(rooms, null)) dots(ENTRANCE.x, ENTRANCE.y, rooms[i].x, rooms[i].y, walked.has(`-1>${i}`));
    rooms.forEach((room, i) => room.next.forEach((j) => dots(room.x, room.y, rooms[j].x, rooms[j].y, walked.has(`${i}>${j}`))));

    // Each room in a ring: gold and pulsing when it can be entered (held still when motion is
    // reduced), dim once passed by. Elites and the boss have a red ring until passed.
    const r = this.roomRings.clear();
    const pulse = settings.reduceMotion ? 1 : 0.5 + 0.5 * Math.sin(this.clock / 200);
    rooms.forEach((room, i) => {
      const done = s.cleared.includes(i);
      const open = next.includes(i);
      const danger = room.kind === 'elite' || room.kind === 'boss';
      r.fillStyle(INK, 0.85).fillCircle(room.x, room.y, ROOM_RADIUS);
      r.lineStyle(4, open ? GOLD.light : done ? GOLD.dark : danger ? RED.mid : STONE.light, open ? 0.6 + 0.4 * pulse : 1).strokeCircle(room.x, room.y, ROOM_RADIUS);
      if (open) r.lineStyle(2, GOLD.light, 0.4 * (1 - pulse)).strokeCircle(room.x, room.y, ROOM_RADIUS + 6 + 4 * pulse);
    });

    // The hero stands just above their room, and walks along the path to the next one at the same height.
    const spot = (at: number | null) => (at === null ? ENTRANCE : { x: rooms[at].x, y: rooms[at].y });
    let pos = spot(s.at);
    if (s.walk) {
      const a = spot(s.walk.from);
      const b = spot(s.walk.to);
      const t = Math.min(1, s.walk.ms / WALK_MS);
      pos = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t - Math.abs(Math.sin(t * Math.PI * 4)) * 4 };
    }
    this.token.setTexture(heroTexture(s.hero, true)).setPosition(pos.x, pos.y - (ROOM_RADIUS - 6));
    const hint = t(s.at === null ? 'enterHint' : 'goOnHint');
    this.mapHint.setText(s.phase === 'map' ? s.notice || hint : '');
  }

  // The fight

  private createFight() {
    this.roomBg = artImage(this, -this.fx, -this.fy, 'room-bg').setOrigin(0);
    this.hero = artImage(this, HERO_FEET.x, HERO_FEET.y, heroTexture('knight')).setOrigin(0.5, 1);
    this.bars = this.add.graphics();
    this.heroHp = this.add.text(HERO_FEET.x, FOE_FEET_Y + HP_BAR.dy + HP_BAR.h / 2, '', textStyle(13)).setOrigin(0.5);
    // The hand sits on the view's bottom edge, the orb and draw pile in its bottom left corner,
    // End turn and the discard pile in its bottom right (positions inside the fight's frame).
    this.handLayer = this.add.container(0, this.fy);
    const left = -this.fx;
    const right = this.W - VIEW.w - this.fx;
    const bottom = this.H - VIEW.h - this.fy;
    const orbX = ENERGY_ORB.x + left;
    const orbY = ENERGY_ORB.y + bottom;
    const orb = this.add.graphics();
    orb.fillStyle(INK).fillCircle(orbX, orbY, ENERGY_ORB.r + 4);
    orb.fillStyle(GOLD.dark).fillCircle(orbX, orbY, ENERGY_ORB.r);
    orb.fillStyle(GOLD.mid).fillCircle(orbX - 3, orbY - 3, ENERGY_ORB.r - 6);
    orb.fillStyle(0xffffff, 0.35).fillCircle(orbX - 12, orbY - 14, 7);
    this.energyText = this.add.text(orbX, orbY, '', textStyle(24)).setOrigin(0.5);
    // The draw pile's count sits over the orb, clear of the corner buttons under it.
    this.drawText = this.add.text(orbX, orbY - ENERGY_ORB.r - 18, '', textStyle(14, '#d8c7a6')).setOrigin(0.5);
    this.discardText = this.add.text(END_TURN.x + right, PILES_Y + bottom, '', textStyle(14, '#d8c7a6')).setOrigin(0.5);
    this.endTurnButton = makeButton(this, END_TURN.x + right, END_TURN.y + bottom, t('endTurn'), () => this.act(endTurn(this.state), 'endTurn'), END_TURN.w);
    this.turnBanner = this.add.text(VIEW.w / 2, 150, '', textStyle(30, '#e6c766')).setOrigin(0.5);
    this.flaskLayer = this.add.container(left, 0);
    this.powerLayer = this.add.container(left, 0);
    this.fightLayer = this.add.container(this.fx, this.fy, [this.roomBg, this.hero, this.bars, this.heroHp, orb, this.energyText, this.endTurnButton, this.handLayer, this.drawText, this.discardText, this.turnBanner, this.flaskLayer, this.powerLayer]);
    this.heroStatuses = new StatusRow(this, this.fightLayer);
  }

  private drawFight(dt: number) {
    this.buildRooms();
    const s = this.state;
    const f = s.fight;
    const enemies = f?.enemies ?? [];
    const xs = FOE_XS[Math.max(1, enemies.length)] ?? FOE_XS[3];

    // The hero shakes and flashes red when hit, unless motion is reduced.
    const shake = s.heroHitMs > 0 && !settings.reduceMotion ? Math.sin(this.clock / 20) * 4 : 0;
    this.hero.setTexture(heroTexture(s.hero)).setPosition(HERO_FEET.x + shake, HERO_FEET.y);
    if (s.heroHitMs > 0 && !settings.reduceMotion) this.hero.setTint(0xff8080);
    else this.hero.clearTint();

    this.bars.clear();
    this.drawHpBar(HERO_FEET.x, s.hp, s.maxHp, f?.block ?? 0, this.heroHp);
    this.heroStatuses.draw(f?.status, HERO_FEET.x, HERO_FEET.y - this.hero.displayHeight - 16);

    // Foes, each with its intent and statuses over its head; one that falls fades away.
    const seen = new Set<number>();
    enemies.forEach((e, i) => {
      seen.add(e.id);
      let foe = this.foes.get(e.id);
      if (!foe) {
        const sprite = artImage(this, xs[i], FOE_FEET_Y, foeTexture(e.kind)).setOrigin(0.5, 1);
        const intent = artImage(this, 0, 0, 'intent-attack');
        const intentText = this.add.text(0, 0, '', textStyle(18)).setOrigin(0, 0.5);
        const intentExtra = artImage(this, 0, 0, 'status-weak');
        const hp = this.add.text(0, FOE_FEET_Y + HP_BAR.dy + HP_BAR.h / 2, '', textStyle(13)).setOrigin(0.5);
        this.fightLayer.addAt(sprite, 2);
        this.fightLayer.addAt([intent, intentText, intentExtra, hp], this.fightLayer.getIndex(this.bars) + 1);
        foe = { sprite, intent, intentText, intentExtra, hp, statuses: new StatusRow(this, this.fightLayer), x: xs[i] };
        this.foes.set(e.id, foe);
      }
      // Slide into place when the one in front falls: a fifth of the way per 60th of a second, at any frame rate.
      foe.x += (xs[i] - foe.x) * (1 - Math.pow(0.8, dt / (1000 / 60)));
      const lunge = e.actMs > 0 ? -Math.sin((e.actMs / 300) * Math.PI) * 30 : 0;
      const bob = settings.reduceMotion ? 0 : Math.sin(this.clock / 400 + e.id) * 2;
      foe.sprite.setPosition(foe.x + lunge, FOE_FEET_Y + bob);
      if (e.hitMs > 0 && !settings.reduceMotion) foe.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else foe.sprite.clearTint();
      this.drawHpBar(foe.x, e.hp, e.maxHp, e.block, foe.hp);
      const top = FOE_FEET_Y - foe.sprite.displayHeight;
      this.drawIntent(e, foe, foe.x, top - 22);
      foe.statuses.draw(e.status, foe.x, top - 52);
    });
    for (const [id, foe] of this.foes) {
      if (seen.has(id)) continue;
      this.foes.delete(id);
      foe.intent.destroy();
      foe.intentText.destroy();
      foe.intentExtra.destroy();
      foe.hp.destroy();
      foe.statuses.destroy();
      this.tweens.add({ targets: foe.sprite, alpha: 0, y: foe.sprite.y + 10, duration: 400, onComplete: () => foe.sprite.destroy() });
    }

    // Hand, energy, piles, flasks and powers.
    this.drawHand();
    this.drawFlasks();
    this.drawPowers();
    this.energyText.setText(f ? `${f.energy}/${ENERGY}` : '');
    this.drawText.setText(f ? t('drawPile', { n: f.draw.length }) : '');
    this.discardText.setText(f ? t('discardPile', { n: f.discard.length }) : '');
    this.endTurnButton.setVisible(s.phase === 'player').setAlpha(s.phase === 'player' ? 1 : 0.4);
    const opening = f && f.turn === 1 && s.phase === 'player' && f.discard.length === 0 && f.hand.length === HAND_SIZE;
    const banner = s.phase === 'enemy' ? t('foesTurn') : s.phase === 'cleared' ? t('victory') : opening ? t('yourTurn') : '';
    this.turnBanner.setText(banner);
  }

  /** A health bar under the feet, blue while there is block, with the numbers under it. */
  private drawHpBar(x: number, hp: number, max: number, block: number, text: Phaser.GameObjects.Text) {
    const g = this.bars;
    const left = Math.round(x - HP_BAR.w / 2);
    const y = FOE_FEET_Y + HP_BAR.dy;
    g.fillStyle(INK).fillRect(left, y, HP_BAR.w, HP_BAR.h);
    g.fillStyle(0x3a2818).fillRect(left + 2, y + 2, HP_BAR.w - 4, HP_BAR.h - 4);
    g.fillStyle(block > 0 ? BLUE.mid : RED.mid).fillRect(left + 2, y + 2, Math.round((HP_BAR.w - 4) * Phaser.Math.Clamp(hp / max, 0, 1)), HP_BAR.h - 4);
    text.setX(x).setText(block > 0 ? `${hp}/${max}  +${block}` : `${hp}/${max}`);
  }

  /** The foe's next move over its head: the real damage of an attack, the block, the strength or the status it puts on the hero. */
  private drawIntent(e: Enemy, foe: Foe, x: number, y: number) {
    const intent = e.intent;
    foe.intent.setTexture(`intent-${intent.kind}`).setPosition(x - 12, y);
    const text =
      intent.kind === 'attack'
        ? `${foeHit(this.state, e, intent.damage)}${intent.hits ? `x${intent.hits}` : ''}`
        : intent.kind === 'block'
          ? `${intent.block}`
          : intent.kind === 'buff'
            ? `+${intent.strength}`
            : intent.kind === 'curse'
              ? cardName(intent.curse)
              : `${intent.amount}`;
    const color = { attack: '#f4a08a', block: '#8ab8e8', buff: '#e6c766', debuff: '#c49ae8', curse: '#9a6ac0' }[intent.kind];
    foe.intentText.setText(text).setPosition(x + 2, y).setColor(color);
    const extra = intent.kind === 'debuff' ? intent.status : intent.kind === 'attack' ? intent.apply?.status : undefined;
    if (extra) foe.intentExtra.setTexture(`status-${extra}`).setPosition(x + 2 + foe.intentText.width + 14, y);
    const show = this.state.phase === 'player';
    foe.intent.setVisible(show);
    foe.intentText.setVisible(show);
    foe.intentExtra.setVisible(show && !!extra);
  }

  /** Lays out the hand along the bottom; rebuilt only when the hand or the energy changes. */
  private drawHand() {
    const s = this.state;
    const f = s.fight;
    const hand = s.phase === 'player' && f ? f.hand : [];
    const key = `${hand.join()}|${f?.energy}`;
    if (key === this.handKey) return;
    this.handKey = key;
    this.handLayer.removeAll(true);
    const gap = hand.length > 1 ? Math.min(HAND.gap, HAND.span / (hand.length - 1)) : 0;
    this.hand = hand.map((id, i) => {
      const x = HAND.x + (i - (hand.length - 1) / 2) * gap;
      const { view, bg } = makeCard(this, id, x, HAND.y);
      const playable = canPlay(s, i);
      view.setAlpha(playable ? 1 : 0.55);
      bg.setInteractive({ useHandCursor: playable })
        .on('pointerover', () => playable && view.setY(HAND.y - 14))
        .on('pointerout', () => view.setY(HAND.y))
        .on('pointerdown', () => this.act(playCard(this.state, i), kindOf(id) === 'power' ? 'power' : kindOf(id) === 'attack' ? 'attack' : 'skill'));
      this.handLayer.add(view);
      return { id, x: x + this.fx, y: HAND.y + 2 * this.fy, w: HAND.w, h: HAND.h };
    });
  }

  /** The three flask slots down the left: a filled one is lit and drinkable on the hero's turn, an empty one a dark ring. */
  private drawFlasks() {
    const s = this.state;
    const usable = s.phase === 'player';
    const key = `${s.flasks.join()}|${usable}`;
    if (key === this.flaskKey) return;
    this.flaskKey = key;
    this.flaskLayer.removeAll(true);
    for (let i = 0; i < FLASK_SLOTS; i++) {
      const x = FLASK_ROW.x;
      const y = FLASK_ROW.y + i * FLASK_ROW.gap;
      const id = s.flasks[i];
      const ring = this.add.circle(x, y, FLASK_ROW.r, INK, 0.85).setStrokeStyle(3, id ? GOLD.mid : STONE.light);
      this.flaskLayer.add(ring);
      if (!id) continue;
      const pic = artImage(this, x, y, flaskIcon(id)).setAlpha(usable ? 1 : 0.5);
      this.flaskLayer.add(pic);
      ring
        .setInteractive({ useHandCursor: usable })
        .on('pointerover', () => this.showTip(usable ? t('drinkTip', flaskTip(id)) : `${flaskTip(id).name}: ${flaskTip(id).text}`))
        .on('pointerdown', () => {
          this.showTip(`${flaskTip(id).name}: ${flaskTip(id).text}`);
          this.act(canUseFlask(this.state, i) && useFlask(this.state, i), 'flask');
        });
    }
  }

  /**
   * The powers in play, as their icons in purple rings under the top bar, one ring per kind with a
   * count when copies stack (so the row never reaches the hero); hover or tap for the text.
   */
  private drawPowers() {
    const s = this.state;
    const powers = s.fight?.powers ?? [];
    const key = powers.join();
    if (key === this.powerKey) return;
    this.powerKey = key;
    this.powerLayer.removeAll(true);
    const kinds = new Map<string, { id: CardId; n: number }>();
    for (const id of powers) {
      const kind = card(id).power!;
      const seen = kinds.get(kind);
      if (seen) seen.n++;
      else kinds.set(kind, { id, n: 1 });
    }
    [...kinds.values()].forEach(({ id, n }, i) => {
      const x = POWERS.x + i * POWERS.gap;
      const ring = this.add.circle(x, POWERS.y, POWERS.r, PURPLE.mid).setStrokeStyle(2, PURPLE.light);
      const pic = artImage(this, x, POWERS.y, cardIcon(card(id).icon), 0.5);
      const tip = () => this.showTip(t('powerTip', { name: cardName(id), text: describePower(id) }));
      ring.setInteractive({ useHandCursor: true }).on('pointerover', tip).on('pointerdown', tip);
      this.powerLayer.add([ring, pic]);
      if (n > 1) this.powerLayer.add(this.add.text(x + POWERS.r, POWERS.y + POWERS.r, `×${n}`, textStyle(13)).setOrigin(0.5));
    });
  }

  // Rewards, the merchant, rests, events and the end of an act or a run

  private createReward() {
    const dim = this.dimmer(0.7);
    this.rewardTitle = this.add.text(VIEW.w / 2, 100, '', textStyle(28, '#e6c766')).setOrigin(0.5);
    const skip = makeButton(this, SKIP.x, SKIP.y, t('skip'), () => this.act(takeReward(this.state, null), 'click'));
    this.rewardLayer = this.add.container(this.fx, this.fy, [dim, this.rewardTitle, skip]).setDepth(UI_DEPTH + 10).setVisible(false);
  }

  private drawReward() {
    const s = this.state;
    const choices = s.phase === 'reward' ? s.reward : null;
    this.rewardLayer.setVisible(!!choices);
    const key = choices?.join() ?? '';
    if (key === this.rewardKey) return;
    this.rewardKey = key;
    this.rewardLayer.each((child: Phaser.GameObjects.GameObject) => {
      if (child.getData('card')) child.destroy();
    });
    this.rewards = [];
    if (!choices) return;
    const kind = s.rooms[s.at!]?.kind;
    const gold = !s.goldWon ? '' : s.flaskWon ? t('goldAndFlask', { n: s.goldWon, flask: t(FLASKS[s.flaskWon].name) }) : t('goldWon', { n: s.goldWon });
    this.rewardTitle.setText(
      kind === 'treasure' ? t('treasureReward') : kind === 'event' ? t('altarReward') : t(s.rewardRare ? 'eliteReward' : 'cardReward', { gold }),
    );
    choices.forEach((id, i) => {
      const x = REWARD.xs[i];
      const { view, bg } = makeCard(this, id, x, REWARD.y, REWARD.scale);
      view.setData('card', true);
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => bg.setStrokeStyle(4, GOLD.light))
        .on('pointerout', () => bg.setStrokeStyle(3, INK))
        .on('pointerdown', () => this.act(takeReward(this.state, i), 'pick'));
      this.rewardLayer.add(view);
      this.rewards.push({ id, x: x + this.fx, y: REWARD.y + this.fy, w: HAND.w * REWARD.scale, h: HAND.h * REWARD.scale });
    });
  }

  /** A dark veil over the whole view that takes the taps, for an overlay placed at the view's frame. */
  private dimmer(alpha: number) {
    return this.add.rectangle(-this.fx, -this.fy, this.W, this.H, 0x0e0a08, alpha).setOrigin(0).setInteractive();
  }

  private createShop() {
    const dim = this.dimmer(0.78);
    const title = this.add.text(VIEW.w / 2, 72, t('merchant'), textStyle(28, '#e6c766')).setOrigin(0.5);
    const leave = makeButton(this, SHOP.leave.x, SHOP.leave.y, t('leave'), () => this.act(leaveShop(this.state), 'click'));
    this.shopLayer = this.add.container(this.fx, this.fy, [dim, title, leave]).setDepth(UI_DEPTH + 10).setVisible(false);
  }

  /** The merchant's cards with their prices, and boxes for the relics and the removal; rebuilt when a ware sells or the gold changes. */
  private drawShop() {
    const s = this.state;
    const shop = s.phase === 'shop' && !this.picking ? s.shop : null;
    this.shopLayer.setVisible(!!shop);
    const key = shop ? JSON.stringify([shop, s.gold, s.deck.length]) : '';
    if (key === this.shopKey) return;
    this.shopKey = key;
    this.shopLayer.each((child: Phaser.GameObjects.GameObject) => {
      if (child.getData('ware')) child.destroy();
    });
    if (!shop) return;
    const ware = (...items: Phaser.GameObjects.GameObject[]) => {
      for (const item of items) item.setData('ware', true);
      this.shopLayer.add(items);
    };
    const price = (x: number, y: number, amount: number, sold: boolean) => {
      const coin = artImage(this, x - 22, y, 'coin');
      const text = this.add
        .text(x - 6, y, sold ? t('sold') : String(amount), textStyle(17, sold ? '#8a8070' : s.gold >= amount ? '#e6c766' : '#e0584f'))
        .setOrigin(0, 0.5);
      coin.setVisible(!sold);
      if (sold) text.setX(x).setOrigin(0.5);
      ware(coin, text);
    };
    shop.cards.forEach((w, i) => {
      const x = SHOP.cardXs[i];
      const { view, bg } = makeCard(this, w.id, x, SHOP.cardY);
      view.setAlpha(w.sold ? 0.25 : s.gold >= w.price ? 1 : 0.6);
      if (!w.sold) {
        bg.setInteractive({ useHandCursor: true })
          .on('pointerover', () => bg.setStrokeStyle(4, GOLD.light))
          .on('pointerout', () => bg.setStrokeStyle(3, INK))
          .on('pointerdown', () => this.act(buyCard(this.state, i), 'buy'));
      }
      ware(view);
      price(x, SHOP.cardY + SHOP.priceDy, w.price, w.sold);
    });
    const box = (y: number, icon: string, name: string, text: string, cost: number, sold: boolean, can: boolean, onBuy: () => void) => {
      const { x, w, h } = SHOP.box;
      const bg = this.add.rectangle(x, y, w, h, 0x2a2632, sold ? 0.5 : 1).setStrokeStyle(3, can ? GOLD.mid : 0x5a5366);
      const pic = artImage(this, x - w / 2 + 34, y, icon).setAlpha(sold ? 0.3 : 1);
      const title = this.add.text(x - w / 2 + 66, y - 26, name, textStyle(16, '#f3e9d2'));
      const rules = this.add
        .text(x - w / 2 + 66, y - 6, text, { fontFamily: FONT, fontSize: '13px', color: '#d8c7a6', wordWrap: { width: w - 150 } })
        .setAlpha(sold ? 0.5 : 1);
      ware(bg, pic, title, rules);
      price(x + w / 2 - 34, y, cost, sold);
      // A ware not sold but out of reach still takes the tap, to buzz.
      if (!sold) bg.setInteractive({ useHandCursor: can }).on('pointerdown', () => (can ? onBuy() : ui('refuse')));
    };
    shop.relics.forEach((w, i) => {
      const r = RELICS[w.id];
      box(SHOP.box.ys[i], relicIcon(w.id, true), t(r.name), relicText(w.id), w.price, w.sold, !w.sold && s.gold >= w.price, () => this.act(buyRelic(this.state, i), 'buy'));
    });
    box(SHOP.box.ys[2], 'room-rest', t('removeTitle'), t('removeText'), shop.removePrice, shop.removed, canBuyRemoval(s), () => {
      if (this.act(canBuyRemoval(this.state), 'click')) this.picking = 'sell';
    });
    // Flasks under the cards, with how many slots are free.
    shop.flasks.forEach((w, i) => {
      const { xs, y, w: bw, h } = SHOP.flasks;
      const x = xs[i];
      const can = canBuyFlask(s, i);
      const fl = FLASKS[w.id];
      const bg = this.add.rectangle(x, y, bw, h, 0x2a2632, w.sold ? 0.5 : 1).setStrokeStyle(3, can ? GOLD.mid : 0x5a5366);
      const pic = artImage(this, x - bw / 2 + 24, y, flaskIcon(w.id)).setAlpha(w.sold ? 0.3 : 1);
      const title = this.add.text(x - bw / 2 + 46, y - 24, t(fl.name), textStyle(13, '#f3e9d2'));
      const rules = this.add.text(x - bw / 2 + 46, y - 4, t(fl.text, { n: fl.n }), { fontFamily: FONT, fontSize: '12px', color: '#d8c7a6', wordWrap: { width: bw - 56 } }).setAlpha(w.sold ? 0.5 : 1);
      ware(bg, pic, title, rules);
      price(x + bw / 2 - 20, y - 14, w.price, w.sold);
      if (!w.sold) bg.setInteractive({ useHandCursor: can }).on('pointerdown', () => this.act(buyFlask(this.state, i), 'buy'));
    });
    const slots = this.add.text(SHOP.flasks.xs[0] - SHOP.flasks.w / 2, SHOP.flasks.y - SHOP.flasks.h / 2 - 18, t('flaskSlots', { n: s.flasks.length, slots: FLASK_SLOTS }), textStyle(14, '#d8c7a6'));
    ware(slots);
  }

  private createPanel() {
    const dim = this.dimmer(0.7);
    const box = this.add.rectangle(VIEW.w / 2, VIEW.h / 2, 580, 290, 0x2a2632).setStrokeStyle(4, 0x7a7288);
    this.panelTitle = this.add.text(VIEW.w / 2, VIEW.h / 2 - 100, '', textStyle(30)).setOrigin(0.5);
    this.panelText = this.add
      .text(VIEW.w / 2, VIEW.h / 2 - 26, '', { fontFamily: FONT, fontSize: '16px', color: '#f1e3c6', align: 'center', wordWrap: { width: 520 } })
      .setOrigin(0.5);
    this.panelButton = makeButton(this, PANEL_BUTTON.x, PANEL_BUTTON.y, t('continue'), () => this.panelAction());
    this.temperButton = makeButton(this, PANEL_BUTTON.x, PANEL_BUTTON.y, t('temperButton'), () => this.act(canTemper(this.state), 'click') && (this.picking = 'temper'), REST_BUTTONS.w);
    this.removeButton = makeButton(this, PANEL_BUTTON.x + REST_BUTTONS.dx, PANEL_BUTTON.y, t('removeButton'), () => this.act(canRemove(this.state), 'click') && (this.picking = 'burn'), REST_BUTTONS.w);
    // The two choices of a mystery room double as the hero choice before the first room.
    this.choiceButtons = [0, 1].map((i) =>
      makeButton(this, VIEW.w / 2, EVENT_BUTTONS.y + i * EVENT_BUTTONS.gap, '', () => (this.state.phase === 'hero' ? this.act(chooseHero(this.state, i === 0 ? 'knight' : 'hunter'), 'select') : this.act(chooseEvent(this.state, i), 'mystery')), EVENT_BUTTONS.w),
    );
    this.heroPics = [
      artImage(this, HERO_PANEL.knightX, HERO_PANEL.feetY, heroTexture('knight')).setOrigin(0.5, 1),
      artImage(this, HERO_PANEL.hunterX, HERO_PANEL.feetY, heroTexture('hunter')).setOrigin(0.5, 1),
    ];
    this.depthButtons = [-1, 1].map((d) => makeButton(this, VIEW.w / 2 + d * HERO_PANEL.depthDx, HERO_PANEL.depthY, d < 0 ? '<' : '>', () => this.act(setDepth(this.state, this.state.depth + d), 'ratchet'), 44));
    this.depthText = this.add.text(VIEW.w / 2, HERO_PANEL.depthY, '', textStyle(20, '#e6c766')).setOrigin(0.5);
    this.panel = this.add
      .container(this.fx, this.fy, [dim, box, this.panelTitle, this.panelText, this.panelButton, this.temperButton, this.removeButton, ...this.choiceButtons, ...this.heroPics, ...this.depthButtons, this.depthText])
      .setDepth(UI_DEPTH + 20)
      .setVisible(false);
  }

  private drawPanel() {
    const s = this.state;
    if (s.phase !== 'rest' && s.phase !== 'shop') this.picking = null;
    const ev = eventHere(s);
    const heroes = s.phase === 'hero';
    const show = heroes || (s.phase === 'rest' && !this.picking) || !!ev || s.phase === 'descend' || s.phase === 'over' || s.phase === 'won';
    this.panel.setVisible(show);
    this.drawPicker();
    if (!show) return;
    const caption = this.panelButton.list[1] as Phaser.GameObjects.Text;
    const camp = s.phase === 'rest';
    this.panelButton.setVisible(!ev && !heroes);
    this.temperButton.setVisible(camp).setAlpha(canTemper(s) ? 1 : 0.45);
    this.removeButton.setVisible(camp).setAlpha(canRemove(s) ? 1 : 0.45);
    for (const pic of this.heroPics) pic.setVisible(heroes);
    const ladder = heroes && s.bestDepth > 0;
    this.depthText.setVisible(ladder).setText(t('depth', { n: s.depth }));
    this.depthButtons.forEach((b, i) => b.setVisible(ladder).setAlpha((i === 0 ? s.depth > 0 : s.depth < s.bestDepth) ? 1 : 0.4));
    this.panelText.setWordWrapWidth(heroes ? 300 : 520).setY(heroes ? HERO_PANEL.rulesY : VIEW.h / 2 - 26);
    if (heroes) {
      this.panelTitle.setText(t('chooseHero')).setColor('#e6c766');
      this.panelText.setText(ladder ? depthText(s.depth) : s.bestDepth > 0 ? '' : t('openDepths'));
      this.choiceButtons.forEach((b, i) => {
        const h = HEROES[i === 0 ? 'knight' : 'hunter'];
        b.setVisible(true).setAlpha(1);
        (b.list[1] as Phaser.GameObjects.Text).setText(`${t(h.name)}: ${t(h.text, { hp: h.hp })}`);
      });
      return;
    }
    this.panelButton.setX(camp ? PANEL_BUTTON.x - REST_BUTTONS.dx : PANEL_BUTTON.x);
    (this.panelButton.list[0] as Phaser.GameObjects.Rectangle).setSize(camp ? REST_BUTTONS.w : BUTTON.w, BUTTON.h).setOrigin(0.5);
    this.choiceButtons.forEach((b, i) => {
      b.setVisible(!!ev);
      if (!ev) return;
      (b.list[1] as Phaser.GameObjects.Text).setText(t(ev.choices[i], { n: ev.amounts[i] }));
      b.setAlpha(canChoose(s, i) ? 1 : 0.45);
    });
    if (ev) {
      this.panelTitle.setText(t(ev.title)).setColor('#c49ae8');
      this.panelText.setText(t(ev.text));
    } else if (camp) {
      this.panelTitle.setText(t('campfire')).setColor('#f09a3a');
      this.panelText.setText(t('campfireText', { heal: restHeal(s), hp: s.hp, max: s.maxHp, deck: s.deck.length }));
      caption.setText(t('restButton', { n: restHeal(s) }));
      this.panelAction = () => this.act(rest(this.state), 'rest');
    } else if (s.phase === 'descend') {
      this.panelTitle.setText(t('boneKingFalls')).setColor('#e6c766');
      this.panelText.setText(t('stairDown', { notice: s.notice }));
      caption.setText(t('descend'));
      this.panelAction = () => this.act(descend(this.state), 'descend');
    } else {
      const won = s.phase === 'won';
      const where = s.at === null ? 1 : s.rooms[s.at].col + 1;
      this.panelTitle.setText(t(won ? 'hollowQueenFalls' : 'fallen')).setColor(won ? '#e6c766' : '#e0584f');
      const deep = s.depth > 0 ? t('atDepth', { n: s.depth }) : '';
      this.panelText.setText(
        won
          ? t('wonText', { deep, hp: s.hp, gold: s.gold, deck: s.deck.length, next: s.depth + 1, rules: depthText(s.depth + 1) })
          : t('fellText', { act: actName(s), deep, room: where, rooms: COLUMNS, deck: s.deck.length }),
      );
      caption.setText(t('delveAgain'));
      this.panelAction = () => {
        ui('click');
        this.scene.restart();
      };
    }
  }

  private createPicker() {
    const dim = this.dimmer(0.85);
    this.pickTitle = this.add.text(VIEW.w / 2, 80, '', textStyle(24, '#f09a3a')).setOrigin(0.5);
    const back = makeButton(this, PICKER.back.x + this.W - VIEW.w - this.fx, PICKER.back.y, t('back'), () => {
      ui('click');
      this.picking = null;
    });
    this.pickLayer = this.add.container(this.fx, this.fy, [dim, this.pickTitle, back]).setDepth(UI_DEPTH + 21).setVisible(false);
  }

  /**
   * The deck's different cards, one of each, to pick the one to burn, temper or sell. Tempering
   * shows the cards not yet tempered, as they will be once tempered.
   */
  private drawPicker() {
    const s = this.state;
    const mode = this.picking;
    this.pickLayer.setVisible(!!mode);
    const ids = mode ? [...new Set(s.deck)].filter((id) => mode !== 'temper' || canBeTempered(id)) : [];
    const key = `${mode}|${ids.join()}`;
    if (key === this.pickKey) return;
    this.pickKey = key;
    this.pickLayer.each((child: Phaser.GameObjects.GameObject) => {
      if (child.getData('card')) child.destroy();
    });
    if (!mode) return;
    this.pickTitle.setText(t(PICK_TITLES[mode])).setColor(mode === 'temper' ? '#a8e070' : '#f09a3a');
    const L = ids.length > PICKER.tight.perRow * 3 ? PICKER.packed : ids.length > PICKER.roomy.perRow * 2 ? PICKER.tight : PICKER.roomy;
    const perRow = Math.min(ids.length, L.perRow);
    ids.forEach((id, i) => {
      const row = Math.floor(i / L.perRow);
      const inRow = Math.min(perRow, ids.length - row * L.perRow);
      const x = VIEW.w / 2 + ((i % L.perRow) - (inRow - 1) / 2) * L.gap;
      const y = L.y + row * L.rowGap;
      const { view, bg } = makeCard(this, mode === 'temper' ? tempered(id) : id, x, y, L.scale);
      const copies = s.deck.filter((d) => d === id).length;
      const count = this.add.text(x, y + (HAND.h * L.scale) / 2 + 10, `x${copies}`, textStyle(14, '#e6c766')).setOrigin(0.5);
      view.setData('card', true);
      count.setData('card', true);
      bg.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        const done = mode === 'burn' ? removeCard(this.state, id) : mode === 'temper' ? temperCard(this.state, id) : buyRemoval(this.state, id);
        if (this.act(done, mode === 'burn' ? 'burn' : mode === 'temper' ? 'temper' : 'buy')) this.picking = null;
      });
      this.pickLayer.add([view, count]);
    });
  }

  // Floating numbers and the top bar

  /** The floating numbers, over the fighters, or over the map's hero token while the map is shown. */
  private drawPops(onMap: boolean) {
    const s = this.state;
    const seen = new Set<number>();
    const heroX = onMap ? this.token.x : HERO_FEET.x;
    const heroTop = onMap ? this.token.y - this.token.displayHeight : HERO_FEET.y - this.hero.displayHeight;
    for (const p of s.pops) {
      seen.add(p.id);
      let text = this.pops.get(p.id);
      const foe = p.on === 'hero' ? null : this.foes.get(p.on);
      const x = p.on === 'hero' ? heroX : foe?.x ?? text?.x ?? VIEW.w / 2;
      const top = p.on === 'hero' ? heroTop : foe ? FOE_FEET_Y - foe.sprite.displayHeight : (text?.getData('top') ?? 200);
      if (!text) {
        // Several numbers on the same target at once fan out a little.
        const spread = (s.pops.filter((q) => q.on === p.on && q.id < p.id).length % 3) * 22;
        text = this.add.text(this.fx + x + spread - 22, 0, p.text, textStyle(22, POP_COLORS[p.kind])).setOrigin(0.5).setDepth(UI_DEPTH + 5);
        this.pops.set(p.id, text);
      }
      text.setData('top', top);
      const t = 1 - p.ms / POP_MS;
      text.setY(this.fy + top - 44 - t * 40).setAlpha(Math.min(1, (1 - t) * 3));
    }
    for (const [id, text] of this.pops) {
      if (seen.has(id)) continue;
      text.destroy();
      this.pops.delete(id);
    }
  }

  private createHud() {
    this.hud = this.add.graphics().setDepth(UI_DEPTH);
    artImage(this, 26, HUD_HEIGHT / 2, 'heart').setDepth(UI_DEPTH + 1);
    this.hpText = this.add.text(46, 10, '', textStyle(18, '#f4a08a')).setDepth(UI_DEPTH + 1);
    this.deckText = this.add.text(HUD.deckX, 12, '', textStyle(15)).setDepth(UI_DEPTH + 1);
    artImage(this, HUD.coinX, HUD_HEIGHT / 2, 'coin').setDepth(UI_DEPTH + 1);
    this.goldText = this.add.text(HUD.goldX, 10, '', textStyle(18, '#e6c766')).setDepth(UI_DEPTH + 1);
    this.relicLayer = this.add.container(0, 0).setDepth(UI_DEPTH + 1);
    this.roomText = this.add.text(this.W - 16, 12, '', textStyle(15, '#e6c766')).setOrigin(1, 0).setDepth(UI_DEPTH + 1);
    this.tip = this.add
      .text(this.W / 2, HUD_HEIGHT + 22, '', { ...textStyle(16, '#f3e9d2'), backgroundColor: '#2a2632', padding: { x: 10, y: 6 } })
      .setOrigin(0.5)
      .setDepth(UI_DEPTH + 30)
      .setVisible(false);
  }

  /** Shows a line of text (a relic's, flask's or power's name and text) under the top bar for a moment. */
  private showTip(text: string) {
    this.tip.setText(text);
    this.tipMs = TIP_MS;
  }

  private relicTip(id: RelicId) {
    this.showTip(`${t(RELICS[id].name)}: ${relicText(id)}`);
  }

  private drawHud() {
    const s = this.state;
    const g = this.hud.clear();
    g.fillStyle(0x1e1a24, 0.92).fillRect(0, 0, this.W, HUD_HEIGHT);
    g.fillStyle(0x5a5366).fillRect(0, HUD_HEIGHT - 3, this.W, 3);
    this.hpText.setText(`${s.hp}/${s.maxHp}`);
    this.deckText.setText(t('deck', { n: s.deck.length }));
    this.goldText.setText(String(s.gold));
    const relicKey = s.relics.join();
    if (relicKey !== this.relicKey) {
      this.relicKey = relicKey;
      this.relicLayer.removeAll(true);
      s.relics.forEach((id, i) => {
        const icon = artImage(this, HUD.relicX + i * HUD.relicGap, HUD_HEIGHT / 2, relicIcon(id)).setInteractive({ useHandCursor: true });
        icon.on('pointerdown', () => this.relicTip(id)).on('pointerover', () => this.relicTip(id));
        this.relicLayer.add(icon);
      });
    }
    this.tip.setVisible(this.tipMs > 0);
    const room = s.at === null ? null : s.rooms[s.at];
    const depth = room ? room.col + 1 : 0;
    const names: Record<string, TextKey> = { rest: 'campfireRoom', treasure: 'treasureRoom', shop: 'merchantRoom', event: 'mysteryRoom' };
    const name = room?.foes ? room.foes.map((k) => t(ENEMIES[k].name)).reduce((a, b) => t('and', { a, b })) : t(room ? names[room.kind] : 'entrance');
    const where = s.phase === 'map' || s.phase === 'walk' || s.phase === 'hero' ? '' : name;
    const deep = s.depth > 0 ? `${t('depth', { n: s.depth })}   ` : '';
    const bar = `${deep}${actName(s)}   ${t('roomOf', { n: depth, rooms: COLUMNS })}`;
    const barKey = `${bar}   ${where}|${s.relics.length}`;
    if (barKey !== this.barKey) {
      this.barKey = barKey;
      this.roomText.setText(where ? `${bar}   ${where}` : bar);
      // The foes' names (already over their heads) leave the bar when it would run into the relic row.
      if (where && this.W - 16 - this.roomText.width < HUD.relicX + s.relics.length * HUD.relicGap) this.roomText.setText(bar);
    }
  }
}
