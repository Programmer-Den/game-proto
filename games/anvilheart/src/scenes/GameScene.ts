import { playMusic, playSting, ui } from '../../../../shared/audio';
import { settings } from '../../../../shared/settings';
import { viewFrame, viewSize } from '../../../../shared/scaling';
import Phaser from 'phaser';
import { ADVENTURER, adventurerTexture } from '../art/characters';
import { SONG, sfx } from '../audio';
import { itemTexture, shieldTexture, swordScale, swordTexture } from '../art/swords';
import { fit, shown } from '../art/glass';
import { EMBLEMS, emblemTexture } from '../art/ui';
import { EDICTS, PERKS, PERK_IDS, type Edict, type Perk } from '../game/charter';
import { commissionTitle } from '../game/commissions';
import { combine, isMaster, isShield, isSword, tierOf } from '../game/items';
import { clearProgress, loadProgress, saveProgress } from '../game/save';
import { shieldOf } from '../game/shields';
import {
  buy,
  buyPerk,
  chooseCommission,
  chooseEdict,
  deliver,
  deliverable,
  drop,
  edictOffers,
  forge,
  foundCharter,
  itemAt,
  offers,
  sell,
  standing,
  takes,
  tick,
  toggleAutoForge,
  toggleShieldMode,
  scrap,
  touch,
} from '../game/sim';
import {
  BARREL as BARREL_PLACE,
  MASTER_MS,
  MAX_DESKS,
  MAX_SLOTS,
  REP_MAX,
  STAR_PRICE,
  STREAK_MS,
  desksOf,
  dull,
  forgeMs,
  freeStars,
  freshProgress,
  newShop,
  orderPrice,
  payFor,
  progressOf,
  rustLeft,
  setPay,
  shieldPrice,
  shieldsAbout,
  type Adventurer,
  type Fit,
  type GameState,
  type Trait,
} from '../game/state';
import { MAX_TIER, swordOf } from '../game/swords';
import { FORGE_UPGRADES, UPGRADES, locked, nextPrice, type UpgradeId } from '../game/upgrades';
import { t, type TextKey } from '../i18n';
import { checkTrophies } from '../trophies/check';
import { Button } from '../ui/Button';
import {
  BANNER,
  BARREL,
  CELL_SCALE,
  DESK,
  EDICT_PLAQUE,
  FONT,
  FORGE_BUTTON,
  FURNACE_WINDOW,
  HEAT_BAR,
  MODE_BUTTON,
  ORDER,
  PERK_LINK,
  PATIENCE,
  REPUTATION,
  ROW_BOX,
  ROW_BUTTON,
  SCRAP,
  TAG,
  UI_DEPTH,
  UPGRADE_BUTTONS,
  VIEW,
  WIN,
  deskAt,
  deskBox,
  deskCentre,
  deskScale,
  discoveredCentre,
  onBanner,
  onScrap,
  placeAt,
  slotCentre,
} from './layout';

/** Longest simulated step, so a backgrounded tab doesn't jump the shop forward. */
const MAX_STEP_MS = 250;
/** How long "New smithy" waits for the second tap that confirms the wipe. */
const RESET_CONFIRM_MS = 3000;
/** How far up from an anvil's centre a sword lies on it. */
const SWORD_LIFT = Math.round(11 * CELL_SCALE);
/** How a sword lies on the barrel's mouth. */
const BARREL_LIFT = 24;
const BARREL_SCALE = 0.72;
/** What guild reputation reads as, from the bottom up, a word per fifth of the meter. */
const STANDING: TextKey[] = ['shunned', 'doubted', 'known', 'respected', 'renowned'];
const LEAD = 0x17131c;
/** The line under an adventurer's order that says what their trait does. */
const TRAIT_LINES: Record<Exclude<Trait, 'none'>, TextKey> = { haggler: 'haggler', noble: 'noble', veteran: 'veteran' };
const TRAIT_COLOURS: Record<Trait, string> = { none: '#d8c8a8', haggler: '#9ad0ff', noble: '#ffd36a', veteran: '#b8e8a0' };

const textStyle = (size: number, color = '#fff1d0', stroke = 3): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: FONT,
  fontStyle: 'bold',
  fontSize: `${size}px`,
  color,
  stroke: '#17131c',
  strokeThickness: stroke,
});

/** A charter's number as the smithy's name carries it: II, III, IV and so on. */
function roman(n: number) {
  const parts: [number, string][] = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let out = '';
  for (const [v, s] of parts) while (n >= v) (out += s), (n -= v);
  return out;
}

/** The fit tag's first line: how the held sword fits the order, and what the buyer's trait makes of it. */
function tagLine(fit: Fit, trait: Trait, master: boolean) {
  if (master) return t(fit === 'exact' ? 'masterworkFit' : 'masterwork');
  if (fit === 'lesser') return t('oneBelow');
  if (fit !== 'exact') return t('overkill');
  return t(trait === 'noble' ? 'exactNoble' : trait === 'haggler' ? 'exactHaggled' : 'exactFit');
}

/** Where the player picked a sword up (an anvil or `BARREL_PLACE`), and the sword following the pointer. */
interface Held {
  slot: number;
  sprite: Phaser.GameObjects.Image;
}

/** What is drawn for one adventurer at the counter, and the tag that shows what they would pay. */
interface Visitor {
  root: Phaser.GameObjects.Container;
  /** For a set order, the sword and buckler on the card, dimmed and ticked once handed over. */
  setSword: Phaser.GameObjects.Image | null;
  setShield: Phaser.GameObjects.Image | null;
  ticks: Phaser.GameObjects.Image[];
  /** The order card's price, kept up to date since spending guild stars lowers it. */
  price: Phaser.GameObjects.Text;
  tag: Phaser.GameObjects.Container;
  tagImage: Phaser.GameObjects.Image;
  tagTop: Phaser.GameObjects.Text;
  tagBottom: Phaser.GameObjects.Text;
}

/** The royal commission's banner in the top bar. */
interface Banner {
  root: Phaser.GameObjects.Container;
  kicker: Phaser.GameObjects.Text;
  title: Phaser.GameObjects.Text;
  sword: Phaser.GameObjects.Image;
  progress: Phaser.GameObjects.Text;
  pips: Phaser.GameObjects.Image[];
  reward: Phaser.GameObjects.Text;
  /** The guild star the commission pays, just left of its coins. */
  star: Phaser.GameObjects.Image;
}

export class GameScene extends Phaser.Scene {
  /** The shop being played; read by the playthrough test. */
  state!: GameState;
  private swords: (Phaser.GameObjects.Image | null)[] = [];
  private visitors = new Map<number, Visitor>();
  private held: Held | null = null;
  private furnace!: Phaser.GameObjects.Image;
  private forgeButton!: Button;
  private upgradeButtons = new Map<UpgradeId, Button>();
  /** The fifth row's smoky cover, its line of instructions and build button, until it is bought. */
  private rowCover!: Phaser.GameObjects.Container;
  private rowButton!: Button;
  /** The quench barrel, its price before it is bought, the sword in it and its merge outline. */
  private barrel!: Phaser.GameObjects.Image;
  private barrelPrice!: Phaser.GameObjects.Text;
  private barrelSword: Phaser.GameObjects.Image | null = null;
  private barrelFrame!: Phaser.GameObjects.Image;
  /** The scrap bin and its outline while something is held. */
  private scrapFrame!: Phaser.GameObjects.Image;
  private bannerFrame!: Phaser.GameObjects.Image;
  private repWord!: Phaser.GameObjects.Text;
  private win!: Phaser.GameObjects.Container;
  /** The crown's two offers for the next commission, and the button for each. */
  private chooser!: Phaser.GameObjects.Container;
  private chooserButtons: Button[] = [];
  /** The guild perks window and its button per perk, and the link that opens it. */
  private perkWindow!: Phaser.GameObjects.Container;
  private perkButtons = new Map<Perk, Button>();
  private perkLink!: Phaser.GameObjects.Text;
  /** The new charter's edict window, its two buttons, and the plaque naming the edict in force. */
  private edictWindow!: Phaser.GameObjects.Container;
  private edictButtons: Button[] = [];
  private edictName!: Phaser.GameObjects.Text;
  private edictLine!: Phaser.GameObjects.Text;
  /** The counter's desk frames, three or four, and how many the visitors were drawn for. */
  private counter!: Phaser.GameObjects.Image;
  private drawnDesks = 0;
  /** The switch between forging swords and bucklers. */
  private modeButton!: Button;
  private emblems = new Map<UpgradeId, Phaser.GameObjects.Image>();
  private marks!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  /** The glowing frames round matching anvils and buying desks while a sword is held. */
  private mergeFrames: Phaser.GameObjects.Image[] = [];
  private buyerFrames: Phaser.GameObjects.Image[] = [];
  /** The game's name in the top bar, numbered from the second charter on. */
  private titleText!: Phaser.GameObjects.Text;
  private coinsText!: Phaser.GameObjects.Text;
  private soldText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private star!: Phaser.GameObjects.Image;
  private starsText!: Phaser.GameObjects.Text;
  private banner!: Banner;
  private hint!: Phaser.GameObjects.Text;
  /** The frame and picture of each sword tier in the discovered row, shown once that tier has been made. */
  private discovered: { frame: Phaser.GameObjects.Image; sword: Phaser.GameObjects.Image }[] = [];
  private clock = 0;
  private lastFrame: number | null = null;
  /** The part of the song playing: calm, a hammer streak's busier groove, or tense while the crown or a charter waits on a choice. */
  private musicPart = '';

  /**
   * The view's edges in world coordinates. The camera is scrolled so the 960x540 layout of
   * `layout.ts` sits in `viewFrame`, the middle of a view that can be wider or taller; the top bar
   * and the corner links are pinned to these edges instead.
   */
  private edge = { left: 0, top: 0, right: VIEW.w, bottom: VIEW.h };

  constructor() {
    super('Game');
  }

  /** Whether a world point is on the commission banner, which sits in the top bar. */
  private onBanner(x: number, y: number) {
    return onBanner(x, y - this.edge.top);
  }

  /** Where the controls are on screen, so the playthrough test can tap and drag like a player. */
  spots() {
    // In view pixels from the view's top left, which is the world's at 960x540.
    const { left, top } = this.edge;
    const at = (p: { x: number; y: number }) => ({ x: p.x - left, y: p.y - top });
    return {
      forge: at(FORGE_BUTTON),
      slots: [...Array(MAX_SLOTS).keys()].map((slot) => at({ x: slotCentre(slot).x, y: slotCentre(slot).y - SWORD_LIFT })),
      desks: [...Array(desksOf(this.state)).keys()].map((d) => at(deskCentre(d, desksOf(this.state)))),
      banner: { x: BANNER.x + BANNER.w / 2 - left, y: BANNER.y + BANNER.h / 2 },
      barrel: at(BARREL),
      scrap: at(SCRAP),
      row: at(ROW_BUTTON),
      mode: at(MODE_BUTTON),
    };
  }

  /** An image of a baked texture at `scale` times its size in view pixels (see `fit`). */
  private image(x: number, y: number, key: string, scale = 1) {
    return fit(this.add.image(x, y, key), scale);
  }

  create() {
    this.swords = new Array(MAX_SLOTS).fill(null);
    this.barrelSword = null;
    this.visitors.clear();
    this.held = null;
    this.state = newShop(loadProgress());

    // The layout sits in the middle of the view; the lancets and the top bar span all of it.
    const frame = viewFrame(this);
    const view = viewSize(this);
    this.cameras.main.setScroll(-frame.x, -frame.y);
    this.edge = { left: -frame.x, top: -frame.y, right: view.width - frame.x, bottom: view.height - frame.y };
    this.image(this.edge.left, this.edge.top, 'backdrop').setOrigin(0);
    this.image(0, 0, 'background').setOrigin(0);
    this.image(this.edge.left, this.edge.top, 'hudbar').setOrigin(0);
    this.drawnDesks = 0;
    this.counter = this.image(DESK.x, DESK.y, `counter-${desksOf(this.state)}`).setOrigin(0).setDepth(1);
    this.furnace = this.image(FURNACE_WINDOW.x, FURNACE_WINDOW.y, 'furnace-0').setOrigin(0);
    this.marks = this.add.graphics().setDepth(5);
    this.mergeFrames = [...Array(MAX_SLOTS).keys()].map((slot) => {
      const c = slotCentre(slot);
      return this.image(c.x, c.y, 'frame-gold').setDepth(6).setVisible(false);
    });
    this.barrel = this.image(BARREL.x, BARREL.y, 'barrel').setDepth(4);
    this.barrelFrame = this.image(BARREL.x, BARREL.y, 'frame-barrel').setDepth(6).setVisible(false);
    this.barrelPrice = this.add
      .text(BARREL.x, BARREL.y + 8, '', { ...textStyle(12.5, '#fff1d0', 3.5), align: 'center' })
      .setOrigin(0.5)
      .setDepth(7);
    this.image(SCRAP.x, SCRAP.y, 'scrap').setDepth(4);
    this.scrapFrame = this.image(SCRAP.x, SCRAP.y, 'frame-scrap').setDepth(6).setVisible(false);
    this.add
      .text(SCRAP.x, SCRAP.y + SCRAP.h / 2 + 2, t('scrap'), { ...textStyle(12, '#fff1d0', 3.5), align: 'center' })
      .setOrigin(0.5)
      .setDepth(7);
    this.createRowCover();
    this.buyerFrames = [...Array(MAX_DESKS).keys()].map(() => this.image(0, 0, 'frame-green').setDepth(25).setVisible(false));

    this.forgeButton = new Button(this, FORGE_BUTTON.x, FORGE_BUTTON.y, 'forge', t('forge'), () => this.forge());
    this.modeButton = new Button(this, MODE_BUTTON.x, MODE_BUTTON.y, 'mode', '', () => this.switchMode());
    FORGE_UPGRADES.forEach((id, i) => {
      const b = UPGRADE_BUTTONS;
      const button = new Button(this, b.x, b.ys[i], 'upgrade', '', () => this.buy(id), 13);
      const emblem = this.image(-b.w / 2 + 22, 0, emblemTexture(i));
      button.root.add(emblem);
      this.emblems.set(id, emblem);
      this.upgradeButtons.set(id, button);
    });
    this.createDiscovered();
    this.createHud();
    this.createReset();
    this.createWin();
    this.createChooser();
    this.createPerks();
    this.createEdicts();
    // An offer still waiting from the last visit opens at once.
    this.chooser.setVisible(this.state.choosing);

    // A press on a button or link is that control's own, even one that just closed its window and
    // left a sword under the pointer.
    this.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length === 0) this.pickUp(p);
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.held?.sprite.setPosition(p.worldX, p.worldY));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.putDown(p));
    this.input.on('gameout', () => this.putDown(null));
    // The release of a drag that the shared pause interrupted never arrives, so the sword goes back.
    this.events.on('pause', () => this.putDown(null));
    this.musicPart = '';
    this.playPart();
  }

  /** Keeps the song's part in step with the shop: tense while a choice waits, busier during a hammer streak. */
  private playPart() {
    const part = this.chooser.visible || this.edictWindow.visible ? 'tense' : this.state.streak >= 2 ? 'streak' : 'calm';
    if (part === this.musicPart) return;
    this.musicPart = part;
    playMusic(SONG, part);
  }

  update(time: number) {
    // Game time from the frame's own timestamp rather than Phaser's smoothed delta, which holds
    // every step to 16ms while the page is not in focus.
    const dt = this.lastFrame === null ? 0 : Phaser.Math.Clamp(time - this.lastFrame, 0, MAX_STEP_MS);
    this.lastFrame = time;
    this.clock += dt;
    // The smithy stands still while a window covers the board, as it does under the edict window.
    if (!this.windowOpen) tick(this.state, dt);
    // Forging (the Forge button's or the Auto Forge's inside tick), rust dropping tiers, heroes
    // bringing swords back and walk-offs costing reputation are kept here.
    if (this.state.events.some((e) => e.kind === 'forged' || e.kind === 'rusted' || e.kind === 'returned' || e.kind === 'left')) this.save();
    checkTrophies(this.state);

    this.drawSwords();
    this.drawVisitors();
    this.drawEvents();
    this.drawMarks();
    this.drawHud();
    this.drawForge();
    this.drawChooser();
    this.drawEdicts();
    this.playPart();
  }

  /** Forges from the button; `update` saves on the `forged` event. */
  private forge() {
    if (this.windowOpen) return;
    if (!forge(this.state)) ui('refuse');
  }

  private switchMode() {
    if (this.windowOpen) return;
    if (!toggleShieldMode(this.state)) return ui('refuse');
    ui('click');
    this.save();
  }

  /** Where a place's sword lies on screen: on its anvil, or on the barrel's mouth. */
  private placeSpot(place: number) {
    if (place === BARREL_PLACE) return { x: BARREL.x, y: BARREL.y - BARREL_LIFT };
    const c = slotCentre(place);
    return { x: c.x, y: c.y - SWORD_LIFT };
  }

  /** Whether a window (the win, the crown's offer, the guild perks or the edicts) is open over the board. */
  private get windowOpen() {
    return this.win.visible || this.chooser.visible || this.perkWindow.visible || this.edictWindow.visible;
  }

  /** Buys an upgrade; a bought Auto Forge's button switches it on and off instead. */
  private buy(id: UpgradeId) {
    if (this.windowOpen) return;
    const toggle = id === 'auto' && this.state.ranks.auto > 0;
    const done = toggle ? toggleAutoForge(this.state) : buy(this.state, id);
    if (!done) return ui('refuse');
    if (toggle) ui('click');
    else sfx('buy');
    this.save();
  }

  private save() {
    saveProgress(progressOf(this.state));
  }

  private pickUp(p: Phaser.Input.Pointer) {
    const place = placeAt(p.worldX, p.worldY);
    if (this.held || this.windowOpen) return;
    // Tapping the banner opens the crown's offer while one waits, or the win window once won.
    if (place === null) {
      if (!this.onBanner(p.worldX, p.worldY)) return;
      if (this.state.choosing) this.chooser.setVisible(true);
      else if (this.state.won) this.win.setVisible(true);
      else return;
      ui('click');
      return;
    }
    // Tapping the barrel before it is bought buys it.
    if (place === BARREL_PLACE && this.state.ranks.barrel === 0) return this.buy('barrel');
    const item = itemAt(this.state, place);
    if (item === null) return;
    // A sword in hand is tended, so rust can't lower it under the held picture.
    touch(this.state, place);
    this.spriteAt(place)?.setVisible(false);
    const sprite = this.image(p.worldX, p.worldY, itemTexture(item), swordScale(1.35)).setDepth(UI_DEPTH - 1);
    this.held = { slot: place, sprite };
    sfx('pick');
  }

  private spriteAt(place: number) {
    return place === BARREL_PLACE ? this.barrelSword : this.swords[place];
  }

  /** Lets go of the held sword: onto an anvil, onto an adventurer, or back where it came from. */
  private putDown(p: Phaser.Input.Pointer | null) {
    const held = this.held;
    if (!held) return;
    this.held = null;
    held.sprite.destroy();
    this.spriteAt(held.slot)?.setVisible(true);
    if (!p) return;
    const place = placeAt(p.worldX, p.worldY);
    const desk = deskAt(p.worldX, p.worldY, desksOf(this.state));
    const buyer = desk === null ? undefined : this.state.adventurers.find((a) => a.desk === desk);
    let done = false;
    const before = this.state.events.length;
    if (place !== null) done = drop(this.state, held.slot, place);
    else if (this.onBanner(p.worldX, p.worldY)) done = deliver(this.state, held.slot);
    else if (onScrap(p.worldX, p.worldY)) done = scrap(this.state, held.slot);
    else if (buyer) done = sell(this.state, held.slot, buyer.id);
    if (done) this.save();
    // A move or swap clunks (a merge, gem or repair sounds in drawEvents); a sword the anvil, the
    // crown or the buyer won't take buzzes; one let go anywhere else goes back with a clunk.
    const tried = place !== null ? place !== held.slot : this.onBanner(p.worldX, p.worldY) || onScrap(p.worldX, p.worldY) || !!buyer;
    if (done ? place !== null && this.state.events.length === before : !tried) sfx('place');
    else if (!done) ui('refuse');
  }

  private drawSwords() {
    const s = this.state;
    for (let slot = 0; slot < MAX_SLOTS; slot++) this.swords[slot] = this.drawItem(this.swords[slot], s.slots[slot] ?? null, slot, CELL_SCALE);
    this.barrelSword = this.drawItem(this.barrelSword, s.barrel, BARREL_PLACE, BARREL_SCALE);
  }

  /** Keeps one place's sprite in step with what lies there: made, changed, hidden while held or gone. */
  private drawItem(sprite: Phaser.GameObjects.Image | null, item: number | null, place: number, scale: number) {
    if (item === null) {
      sprite?.destroy();
      return null;
    }
    const at = this.placeSpot(place);
    if (!sprite) sprite = this.image(at.x, at.y, itemTexture(item), scale).setDepth(10);
    if (sprite.texture.key !== itemTexture(item)) sprite.setTexture(itemTexture(item));
    sprite.setVisible(this.held?.slot !== place);
    // A dulled sword, rusting on its anvil, fades.
    sprite.setAlpha(place !== BARREL_PLACE && dull(this.state, place) ? 0.55 : 1);
    return sprite;
  }

  private drawVisitors() {
    // A fourth desk redraws the counter smaller, with every visitor in their new place.
    const desks = desksOf(this.state);
    const redraw = desks !== this.drawnDesks;
    if (redraw) {
      this.drawnDesks = desks;
      this.counter.setTexture(`counter-${desks}`);
      fit(this.counter);
      for (const v of this.visitors.values()) v.root.destroy();
      this.visitors.clear();
      this.buyerFrames.forEach((frame, desk) => {
        const c = deskCentre(desk, desks);
        frame.setPosition(c.x, c.y);
        fit(frame, deskScale(desks));
      });
      const hint = deskCentre(0, desks);
      this.hint.setPosition(hint.x, hint.y);
    }
    const here = new Set(this.state.adventurers.map((a) => a.id));
    for (const [id, v] of this.visitors) {
      if (here.has(id)) continue;
      v.root.destroy();
      this.visitors.delete(id);
    }
    for (const a of this.state.adventurers) {
      if (this.visitors.has(a.id)) continue;
      this.visitors.set(a.id, this.makeVisitor(a));
      // A returning hero has their own motif (the `returned` event).
      if (!redraw && !a.returned) sfx('bell');
    }
  }

  private makeVisitor(a: Adventurer): Visitor {
    const desks = desksOf(this.state);
    const b = deskBox(a.desk, desks);
    const sword = swordOf(a.wants);
    const set = a.shield > 0;
    const mid = ORDER.x + ORDER.w / 2;
    const body = this.image(ADVENTURER.x, ADVENTURER.y, adventurerTexture(a.look)).setOrigin(0);
    const card = this.image(ORDER.x - 13, ORDER.y - 2, 'order-card').setOrigin(0);
    // A gem order shows the gemmed sword, a loose gem beside it and the doubled price; a set order
    // shows the sword and the buckler side by side, and what the two pay before the set bonus.
    const price = this.add.text(mid, ORDER.y + 17, this.orderCoins(a), { fontFamily: FONT, fontStyle: 'bold', fontSize: '14px', color: '#9a5a10' }).setOrigin(0.5);
    const wants = this.image(set ? mid - 30 : mid, ORDER.y + 49, swordTexture(a.wants, a.gem), swordScale(set ? 0.7 : 0.82));
    const gem = this.image(mid + 50, ORDER.y + 52, 'gem', 0.5).setVisible(a.gem);
    const buckler = set ? this.image(mid + 34, ORDER.y + 50, shieldTexture(a.shield), 0.5) : null;
    const ticks = set ? [mid - 30, mid + 34].map((x) => this.image(x, ORDER.y + 50, 'tick').setVisible(false)) : [];
    const label = a.gem ? t('withGem', { sword: t(sword.name) }) : set ? `${t(sword.name)} + ${t(shieldOf(a.shield).name)}` : t(sword.name);
    const name = this.add
      .text(mid, ORDER.y + 86, label, { fontFamily: FONT, fontStyle: 'bold', fontSize: label.length > 28 ? '9px' : label.length > 24 ? '10.5px' : a.gem || set ? '12px' : '13px', color: '#2a1a14' })
      .setOrigin(0.5);
    // Between the order card and the patience bar: the trait, that this is a set order, or that this hero is back from a quest.
    const line = a.trait !== 'none' ? t(TRAIT_LINES[a.trait]) : set ? t('setLine') : a.returned ? t('backLine') : '';
    const trait = this.add.text(mid, ORDER.y + ORDER.h + 8.5, line, textStyle(11, set ? '#ffd36a' : TRAIT_COLOURS[a.trait], 2.5)).setOrigin(0.5);
    const tagImage = this.image(0, 0, 'tag-exact').setOrigin(0);
    const tagTop = this.add.text(TAG.w / 2 + 1, 11.5, '', textStyle(10, '#eaffd8', 2)).setOrigin(0.5);
    const tagBottom = this.add.text(TAG.w / 2 + 1, 23.5, '', textStyle(11, '#ffe27a', 2)).setOrigin(0.5);
    const tag = this.add.container(TAG.x, TAG.y, [tagImage, tagTop, tagBottom]).setVisible(false);
    const parts = [body, card, price, wants, gem, ...(buckler ? [buckler] : []), ...ticks, name, trait, tag];
    const root = this.add.container(b.x, b.y, parts).setDepth(20).setScale(deskScale(desks));
    root.setAlpha(0);
    this.tweens.add({ targets: root, alpha: 1, duration: 300 });
    return { root, setSword: set ? wants : null, setShield: buckler, ticks, price, tag, tagImage, tagTop, tagBottom };
  }

  /** The order card's price: what the asked-for sword (and buckler, for a set) pays at today's prices. */
  private orderCoins(a: Adventurer) {
    const s = this.state;
    return a.shield > 0 ? t('setCoins', { n: orderPrice(a, s) + shieldPrice(a, s) }) : t(a.gem ? 'gemCoins' : 'orderCoins', { n: orderPrice(a, s) });
  }

  /**
   * Little flourishes for what just happened: a pop for a new sword, a flash for a merge or a set
   * gem, a burst of sparks for a hammer streak, coins for a sale and a halo for a delivery and a
   * finished commission.
   */
  private drawEvents() {
    const events = this.state.events.splice(0);
    // A delivery that completes the commission only shows the commission's message.
    const done = events.some((e) => e.kind === 'commission');
    this.playEvents(events, done);
    for (const e of events) {
      if (e.kind === 'forged' || e.kind === 'merged' || e.kind === 'set' || e.kind === 'repaired') {
        if (e.kind === 'merged' && e.master) {
          const at = this.placeSpot(e.slot);
          this.float(at.x, at.y + 62, t('masterworkStruck'), '#ffe27a', 1800);
        }
        const sprite = this.spriteAt(e.slot);
        const at = this.placeSpot(e.slot);
        if (!sprite) continue;
        const scale = e.slot === BARREL_PLACE ? BARREL_SCALE : CELL_SCALE;
        fit(sprite, scale * (e.kind === 'forged' ? 0.4 : 1.5));
        this.tweens.add({ targets: sprite, scale: shown(sprite.texture.key, scale), duration: 250, ease: 'Back.Out' });
        if (e.kind !== 'forged' && !settings.reduceMotion) {
          const flash = this.image(at.x, at.y, 'halo', 0.6).setDepth(9);
          this.tweens.add({ targets: flash, scale: shown('halo', 1.2), alpha: 0, duration: 350, onComplete: () => flash.destroy() });
        }
        if (e.kind === 'set') this.float(at.x, at.y - 20, t('gemSet'), '#8af0c8');
        if (e.kind === 'repaired') this.float(at.x, at.y - 20, t('repaired', { n: e.coins }), '#8af0c8');
      } else if (e.kind === 'rusted') {
        const at = this.placeSpot(e.slot);
        this.float(at.x, at.y - 20, t('rusted', { sword: t(swordOf(e.tier).name) }), '#e08a5a', 1800);
      } else if (e.kind === 'scrapped') {
        this.float(SCRAP.x, SCRAP.y - SCRAP.h / 2 - 8, t('scrapped'), '#d8d0e0');
      } else if (e.kind === 'returned') {
        const c = deskCentre(e.desk, desksOf(this.state));
        this.float(c.x, c.y + 24, t('heroBack', { n: e.trophy }), '#9ad0ff', 2000);
        const at = this.placeSpot(e.slot);
        this.float(at.x, at.y - 20, t('battered', { sword: t(swordOf(e.tier).name) }), '#9ad0ff', 2000);
      } else if (e.kind === 'charter') {
        this.float(VIEW.w / 2, VIEW.h / 2 - 170, t('newCharter', { n: freeStars(this.state), pct: Math.round(STAR_PRICE * 100 * freeStars(this.state)) }), '#ffd36a', 2600);
      } else if (e.kind === 'streak') {
        this.hammerStreak(e.slot, e.streak, e.coins);
      } else if (e.kind === 'delivered') {
        if (!done) this.float(BANNER.x + BANNER.w / 2, this.edge.top + BANNER.y + 80, t('delivered', { sword: t(swordOf(e.tier).name) }), '#ffe7a8');
      } else if (e.kind === 'commission') {
        this.commissionDone(e.reward, e.won);
      } else if (e.kind === 'sold') {
        const c = deskCentre(e.desk, desksOf(this.state));
        const message = t(e.fit === 'exact' ? 'soldExact' : e.fit === 'lesser' ? 'soldLesser' : 'soldOverkill', { n: e.coins });
        this.float(c.x + 40, c.y, message, e.fit === 'exact' ? '#ffd36a' : '#d8d0e0');
      } else if (e.kind === 'left') {
        const c = deskCentre(e.desk, desksOf(this.state));
        this.float(c.x, c.y, t('leftUnhappy'), '#ff8a6a');
        if (e.back) this.float(c.x, c.y + 26, e.back.coins > 0 ? t('halfPaid', { n: e.back.coins }) : t('halfBack'), '#ffe7a8');
      } else if (e.kind === 'handed') {
        const c = deskCentre(e.desk, desksOf(this.state));
        this.float(c.x, c.y, t(e.shield ? 'bucklerTaken' : 'swordTaken'), '#ffe7a8');
      } else if (e.kind === 'perk') {
        // Under the perk window, which stays open, and above its depth, so the message shows.
        this.float(WIN.x, WIN.y + WIN.tallH / 2 + 30, `${t(PERKS[e.perk].name)}: ${t(PERKS[e.perk].blurb)}`, '#ffd36a', 2200, UI_DEPTH + 6);
      } else if (e.kind === 'edict') {
        this.float(VIEW.w / 2, VIEW.h / 2, t('byEdict', { name: t(EDICTS[e.edict].name) }), '#ffd36a', 2200);
      }
    }
  }

  /**
   * One sound per kind of event this frame. Everything here is the player's own smithy and on
   * screen; the Auto Forge's forging plays at half volume, since it forges every second or so.
   */
  private playEvents(events: GameState['events'], done: boolean) {
    const s = this.state;
    const auto = s.ranks.auto > 0 && s.autoForge;
    const heard = new Set<string>();
    for (const e of events) {
      if (heard.has(e.kind)) continue;
      heard.add(e.kind);
      switch (e.kind) {
        case 'forged':
          sfx('hiss', { volume: auto ? 0.5 : 1 });
          sfx('clink', { volume: auto ? 0.5 : 1 });
          break;
        case 'merged':
          // The clang climbs two semitones a tier; a Masterwork rings its bell over it.
          sfx('clang', { pitch: 2 ** ((Math.min(e.tier, MAX_TIER) - 2) / 6) });
          if (e.master) sfx('master');
          break;
        case 'streak':
          sfx('streak', { pitch: 2 ** ((Math.min(e.streak, 6) - 2) / 12) });
          break;
        case 'set':
          sfx('gem');
          break;
        case 'repaired':
          sfx('tap');
          this.time.delayedCall(110, () => sfx('tap', { pitch: 1.12 }));
          this.time.delayedCall(220, () => ui('coin'));
          break;
        case 'rusted':
          sfx('rust');
          break;
        case 'scrapped':
          sfx('scrap');
          break;
        case 'sold':
          if (e.fit === 'exact') sfx('exact');
          else ui('coin');
          break;
        case 'handed':
          sfx('handed');
          break;
        case 'returned':
          sfx('hero');
          break;
        case 'left':
          sfx('grumble');
          break;
        case 'delivered':
          if (!done) sfx('chime');
          break;
        case 'commission':
          if (e.won) playSting(SONG, 'win');
          else {
            sfx('fanfare');
            ui('coin');
          }
          break;
        case 'charter':
          playSting(SONG, 'charter');
          break;
        case 'perk':
          sfx('buy');
          break;
        case 'edict':
          sfx('seal');
          break;
      }
    }
  }

  /** A rose of amber shards and flying sparks round the anvil, and the streak's tag above it. */
  private hammerStreak(slot: number, streak: number, coins: number) {
    const c = this.placeSpot(slot);
    const y = c.y;
    const burst = this.image(c.x, y, 'burst').setDepth(8);
    if (settings.reduceMotion) {
      this.tweens.add({ targets: burst, alpha: 0, delay: 500, duration: 500, onComplete: () => burst.destroy() });
    } else {
      fit(burst, 0.5);
      this.tweens.add({ targets: burst, scale: shown('burst', 1.15), duration: 500, ease: 'Back.Out' });
      this.tweens.add({ targets: burst, alpha: 0, delay: 450, duration: 450, onComplete: () => burst.destroy() });
      for (let k = 0; k < 12; k++) {
        const t = (k / 12) * Math.PI * 2 + 0.2;
        const spark = this.image(c.x, y, 'spark').setDepth(UI_DEPTH - 2).setRotation(t);
        const r = 50 + (k % 3) * 12;
        this.tweens.add({
          targets: spark,
          x: c.x + Math.cos(t) * r,
          y: y + Math.sin(t) * r,
          alpha: 0,
          duration: 450 + (k % 4) * 60,
          ease: 'Cubic.Out',
          onComplete: () => spark.destroy(),
        });
      }
    }
    const tagY = c.y - 48;
    const tag = this.add.container(c.x, tagY, [
      this.image(0, 0, 'streak-tag'),
      this.add.text(0, 0, t('streak', { n: streak, coins }), textStyle(13, '#fff1d0', 2.5)).setOrigin(0.5),
    ]);
    tag.setDepth(UI_DEPTH + 2);
    this.tweens.add({ targets: tag, y: tagY - 16, alpha: 0, delay: 900, duration: 500, onComplete: () => tag.destroy() });
  }

  /** The banner lights up and the purse and star float off it; the Crown Blade opens the win window. */
  private commissionDone(reward: number, won: boolean) {
    const bx = BANNER.x + BANNER.w / 2;
    const by = this.edge.top + BANNER.y + BANNER.h / 2;
    if (!settings.reduceMotion) {
      const halo = this.image(bx, by, 'halo').setDepth(UI_DEPTH + 1).setScale(shown('halo', 2.4), shown('halo', 0.8));
      this.tweens.add({ targets: halo, alpha: 0, delay: 400, duration: 900, onComplete: () => halo.destroy() });
      this.tweens.add({ targets: this.banner.root, scale: 1.06, duration: 160, yoyo: true });
    }
    this.float(bx, by + 70, t('commissionDone', { n: reward }), '#ffd36a', 2400);
    if (won) this.win.setVisible(true);
    else if (this.state.choosing) this.chooser.setVisible(true);
  }

  private float(x: number, y: number, message: string, color: string, duration = 1200, depth = UI_DEPTH + 3) {
    const text = this.add.text(x, y, message, textStyle(17, color, 4)).setOrigin(0.5).setDepth(depth);
    // Keep it on screen.
    text.x = Phaser.Math.Clamp(x, this.edge.left + text.width / 2 + 6, this.edge.right - text.width / 2 - 6);
    this.tweens.add({ targets: text, y: y - 50, alpha: 0, duration, ease: 'Sine.In', onComplete: () => text.destroy() });
  }

  /**
   * Patience bars and the hammer streak's ring, and where the held sword can go: matching swords
   * to merge, and buyers who will take it, with the tag saying what each would pay.
   */
  private drawMarks() {
    const g = this.marks;
    const s = this.state;
    g.clear();
    const desks = desksOf(s);
    const k = deskScale(desks);
    for (const a of s.adventurers) {
      const b = deskBox(a.desk, desks);
      const left = Math.max(0, a.patienceMs / a.patience);
      const n = PATIENCE.segments;
      const on = Math.ceil(n * left);
      const col = left > 0.5 ? 0x4ac060 : left > 0.2 ? 0xf0c040 : 0xe05040;
      const w = (PATIENCE.w / n) * k;
      const h = PATIENCE.h * k;
      for (let j = 0; j < n; j++) {
        const x = b.x + PATIENCE.x * k + j * w;
        const y = b.y + PATIENCE.y * k;
        g.fillStyle(j < on ? col : 0x2a2436).fillRect(x, y, w, h);
        if (j < on) g.fillStyle(0xffffff, 0.25).fillRect(x + 1, y + 1, w - 2, 3 * k);
        g.lineStyle(1.5, LEAD).strokeRect(x, y, w, h);
      }
    }
    if (s.streakMs > 0) {
      // The streak's timer ring round the anvil of the last merge, draining until the chain breaks;
      // it turns gold for its last second, when a merge strikes a Masterwork.
      const c = this.placeSpot(s.streakSlot);
      const r = 40;
      const start = -Math.PI / 2;
      g.lineStyle(8, LEAD).strokeCircle(c.x, c.y + 4, r);
      g.lineStyle(4.5, s.streakMs <= MASTER_MS ? 0xffe27a : 0xff8a2a);
      g.beginPath();
      g.arc(c.x, c.y + 4, r, start, start + Math.PI * 2 * (s.streakMs / STREAK_MS));
      g.strokePath();
    }
    // A rust-brown ring round each dulled sword's anvil, draining until it drops a tier.
    for (let slot = 0; slot < s.slots.length; slot++) {
      if (!dull(s, slot)) continue;
      const c = this.placeSpot(slot);
      const start = -Math.PI / 2;
      g.lineStyle(7, LEAD).strokeCircle(c.x, c.y + 4, 38);
      g.lineStyle(4, 0xb8642a);
      g.beginPath();
      g.arc(c.x, c.y + 4, 38, start, start + Math.PI * 2 * rustLeft(s, slot));
      g.strokePath();
    }

    const held = this.held;
    const item = held ? itemAt(s, held.slot) : null;
    // The outlines pulse, or hold steady with reduce motion.
    const pulse = settings.reduceMotion ? 1 : 0.8 + 0.2 * Math.sin(this.clock / 120);
    const joins = (place: number) => {
      const there = itemAt(s, place);
      return item !== null && there !== null && place !== held?.slot && combine(item, there) !== null;
    };
    this.mergeFrames.forEach((frame, slot) => frame.setVisible(joins(slot)).setAlpha(pulse));
    this.barrelFrame.setVisible(s.ranks.barrel > 0 && joins(BARREL_PLACE)).setAlpha(pulse);
    this.bannerFrame.setVisible(deliverable(s, item)).setAlpha(pulse);
    this.scrapFrame.setVisible(item !== null).setAlpha(pulse);
    const buyers = new Set<number>();
    for (const a of s.adventurers) {
      const v = this.visitors.get(a.id);
      const fit = takes(a, item);
      const buys = fit !== 'short';
      if (buys) buyers.add(a.desk);
      if (!v) continue;
      const coins = this.orderCoins(a);
      if (v.price.text !== coins) v.price.setText(coins);
      // A set order ticks off the half already handed over.
      v.setSword?.setAlpha(a.given.sword !== null ? 0.35 : 1);
      v.setShield?.setAlpha(a.given.shield !== null ? 0.35 : 1);
      v.ticks.forEach((tick, j) => tick.setVisible((j === 0 ? a.given.sword : a.given.shield) !== null));
      v.tag.setVisible(buys);
      if (!buys || item === null) continue;
      if (a.shield > 0) {
        // The second half completes the set and shows what it pays; the first only promises it.
        const swordItem = isShield(item) ? a.given.sword : item;
        const completes = swordItem !== null && (isShield(item) || a.given.shield !== null);
        v.tagImage.setTexture(completes ? 'tag-exact' : 'tag-overkill');
        v.tagTop.setText(t(completes ? 'setComplete' : 'setHalf')).setFontSize(10).setColor(completes ? '#eaffd8' : '#d8d0e0');
        v.tagBottom.setText(completes ? t('tagCoins', { n: setPay(swordItem!, a, s) }) : t('paysAtTwo')).setColor(completes ? '#ffe27a' : '#b8acc4');
        continue;
      }
      const exact = fit === 'exact';
      const pay = payFor(item, a, s);
      v.tagImage.setTexture(exact ? 'tag-exact' : 'tag-overkill');
      const line = tagLine(fit, a.trait, isMaster(item));
      v.tagTop.setText(line).setFontSize(line.length > 13 ? 9 : 10).setColor(exact ? '#eaffd8' : '#d8d0e0');
      v.tagBottom.setText(t(exact ? 'tagCoins' : 'tagPays', { n: pay })).setColor(exact ? '#ffe27a' : '#b8acc4');
    }
    this.buyerFrames.forEach((frame, desk) => frame.setVisible(buyers.has(desk)).setAlpha(pulse));
  }

  private drawForge() {
    const s = this.state;
    const hot = s.heatMs <= 0;
    // The fire flickers between two frames, held on the first with reduce motion, and dims while it heats.
    this.furnace.setTexture(`furnace-${settings.reduceMotion ? 0 : Math.floor(this.clock / 180) % 2}`);
    this.furnace.setAlpha(hot ? 1 : 0.6);
    const full = !s.slots.includes(null);
    this.drawReputation();
    this.forgeButton.set(t(full ? 'boardFull' : hot ? 'forge' : 'heating'), hot && !full, full || !hot ? 20 : 25);
    // Once bucklers are about, a switch under the furnace says what the forge makes.
    this.modeButton.root.setVisible(shieldsAbout(s));
    this.modeButton.set(t(s.shieldMode ? 'makingBucklers' : 'makingSwords'), true, 12);
    // The heat bar: six jewel panes that light up as the forge gets hot again.
    const g = this.hud;
    const fill = Phaser.Math.Clamp(1 - s.heatMs / forgeMs(s), 0, 1);
    const n = 6;
    const w = HEAT_BAR.w / n;
    g.fillStyle(0x2a2030).fillRect(HEAT_BAR.x - 2, HEAT_BAR.y - 2, HEAT_BAR.w + 4, HEAT_BAR.h + 4);
    for (let k = 0; k < n; k++) {
      const x = HEAT_BAR.x + k * w;
      const lit = Phaser.Math.Clamp(fill * HEAT_BAR.w - k * w, 0, w);
      const col = hot ? (k % 2 ? 0xffc040 : 0xffd86a) : k % 2 ? 0xe8862a : 0xf09a3a;
      if (lit > 0) g.fillStyle(col).fillRect(x, HEAT_BAR.y, lit, HEAT_BAR.h);
      g.lineStyle(1.5, LEAD).strokeRect(x, HEAT_BAR.y, w, HEAT_BAR.h);
    }
    g.lineStyle(2, LEAD).strokeRect(HEAT_BAR.x - 2, HEAT_BAR.y - 2, HEAT_BAR.w + 4, HEAT_BAR.h + 4);
    FORGE_UPGRADES.forEach((id, i) => {
      const rank = s.ranks[id];
      const price = nextPrice(id, rank);
      const u = UPGRADES[id];
      const button = this.upgradeButtons.get(id)!;
      const isLocked = locked(id, s.ranks);
      const emblem = emblemTexture(i % EMBLEMS.length, isLocked);
      const image = this.emblems.get(id)!;
      if (image.texture.key !== emblem) image.setTexture(emblem);
      if (id === 'auto' && rank > 0) {
        button.set(t(s.autoForge ? 'autoOn' : 'autoOff', { name: t(u.name) }), true, 12.5);
        return;
      }
      const name = u.prices.length > 1 ? `${t(u.name)} ${rank + 1}` : t(u.name);
      const blurb = isLocked ? t('maxBellowsFirst') : t(u.blurb);
      const caption = price === null ? t('upgradeMaxed', { name: t(u.name), blurb: t(u.blurb) }) : t('upgradePrice', { name, price, blurb });
      button.set(caption, price !== null && s.coins >= price && !isLocked, 12.5);
    });
    // The fifth row and the barrel are bought where they go.
    const rowPrice = nextPrice('row', s.ranks.row);
    this.rowCover.setVisible(rowPrice !== null);
    if (rowPrice !== null) this.rowButton.set(t('buildRow', { n: rowPrice }), s.coins >= rowPrice, 14);
    const barrelPrice = nextPrice('barrel', s.ranks.barrel);
    const barrelKey = barrelPrice === null ? 'barrel' : 'barrel-off';
    if (this.barrel.texture.key !== barrelKey) this.barrel.setTexture(barrelKey);
    this.barrelPrice.setText(barrelPrice === null ? '' : t('barrelPrice', { n: barrelPrice })).setColor(barrelPrice !== null && s.coins >= barrelPrice ? '#ffe27a' : '#c8bcd8');
  }

  /** The guild reputation meter: its word and ten jewels, green when high, amber, then red when low. */
  private drawReputation() {
    const g = this.hud;
    const r = REPUTATION;
    const rep = this.state.reputation;
    this.repWord.setText(t(STANDING[Math.min(STANDING.length - 1, Math.floor((rep / REP_MAX) * STANDING.length))]));
    const n = r.segments;
    const w = (r.w - 24) / n;
    const x0 = r.x + 12;
    const y = r.y + 27;
    const on = Math.round((rep / REP_MAX) * n);
    const col = rep >= 60 ? 0x4ac060 : rep >= 30 ? 0xf0c040 : 0xe05040;
    for (let k = 0; k < n; k++) {
      const x = x0 + k * w;
      g.fillStyle(k < on ? col : 0x2a2436).fillRect(x, y, w, 11);
      if (k < on) g.fillStyle(0xffffff, 0.25).fillRect(x + 1, y + 1, w - 2, 3);
      g.lineStyle(1.5, LEAD).strokeRect(x, y, w, 11);
    }
  }

  /** Smoky glass over the fifth row until it is bought, with the instructions and the build button. */
  private createRowCover() {
    const b = ROW_BOX;
    const cover = this.image(b.x, b.y, 'row-locked').setOrigin(0);
    const text = this.add
      .text(b.x + b.w / 2, b.y + 22, t('instructions'), { ...textStyle(12.5, '#fff4d8', 3.5), fontStyle: 'normal' })
      .setOrigin(0.5);
    this.rowButton = new Button(this, ROW_BUTTON.x, ROW_BUTTON.y, 'row', '', () => this.buy('row'));
    this.rowCover = this.add.container(0, 0, [cover, text, this.rowButton.root]).setDepth(12);
  }

  /** The window that opens when the Crown Blade is delivered, with a button to keep smithing. */
  private createWin() {
    const items = [
      this.image(0, 0, 'win-panel'),
      this.add.text(0, -36, t('winTitle'), textStyle(24, '#ffd36a', 4)).setOrigin(0.5),
      this.add
        .text(0, 6, t('winText'), { ...textStyle(15, '#fff1d0', 3), align: 'center', fontStyle: 'normal' })
        .setOrigin(0.5),
    ];
    const keep = new Button(this, -100, 70, 'forge', t('keepSmithing'), () => (ui('click'), this.win.setVisible(false)));
    keep.set(t('keepSmithing'), true, 16);
    const found = new Button(this, 100, 70, 'forge', t('foundSmithy'), () => this.found(), 0);
    found.set(t('foundSmithy'), true, 16);
    this.win = this.add.container(WIN.x, WIN.y, [...items, keep.root, found.root]).setDepth(UI_DEPTH + 5).setVisible(false);
  }

  /** Founds a new smithy under a new charter: the board is cleared, the guild stars stay. */
  private found() {
    if (!foundCharter(this.state)) return ui('refuse');
    this.clearBoard();
    this.win.setVisible(false);
    this.save();
  }

  /** The window where guild stars buy lasting perks, opened from the link at the bottom or the stars in the top bar. */
  private createPerks() {
    const items = [
      this.image(0, 0, 'tall-panel'),
      this.add.text(0, -80, t('perksTitle'), textStyle(22, '#ffd36a', 4)).setOrigin(0.5),
      this.add
        .text(0, -50, t('perksText'), { ...textStyle(13, '#fff1d0', 3), align: 'center', fontStyle: 'normal' })
        .setOrigin(0.5),
    ];
    PERK_IDS.forEach((id, i) => this.perkButtons.set(id, new Button(this, 0, -2 + i * 50, 'wide', '', () => this.buyPerk(id))));
    const close = this.add
      .text(0, 134, t('close'), { ...textStyle(13, '#fff6e0', 3.5), fontStyle: 'normal' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on('pointerdown', () => (ui('click'), this.perkWindow.setVisible(false)));
    this.perkWindow = this.add
      .container(WIN.x, WIN.y, [...items, ...[...this.perkButtons.values()].map((b) => b.root), close])
      .setDepth(UI_DEPTH + 5)
      .setVisible(false);
    this.perkLink = this.add
      .text(this.edge.right - (VIEW.w - PERK_LINK.x), this.edge.bottom - (VIEW.h - PERK_LINK.y), '', { ...textStyle(12, '#ffe27a', 3.5), fontStyle: 'normal' })
      .setOrigin(0, 0.5)
      .setDepth(UI_DEPTH + 1)
      .setInteractive({ useHandCursor: true });
    this.perkLink.on('pointerdown', () => this.openPerks());
  }

  private openPerks() {
    if (this.windowOpen) return;
    ui('click');
    this.perkWindow.setVisible(true);
  }

  private buyPerk(perk: Perk) {
    if (buyPerk(this.state, perk)) this.save();
    else ui('refuse');
  }

  /** Fills the perk buttons: what each does, what it costs, and whether it is bought. */
  private drawPerks() {
    const s = this.state;
    const free = freeStars(s);
    this.perkLink.setText(s.stars > 0 ? t('perkLink', { n: free }) : '');
    if (!this.perkWindow.visible) return;
    for (const id of PERK_IDS) {
      const p = PERKS[id];
      const text = { name: t(p.name), blurb: t(p.blurb) };
      const caption = s.perks[id] ? t('perkOwned', text) : t('perkCost', { ...text, cost: t('stars', { n: p.stars }) });
      this.perkButtons.get(id)!.set(caption, !s.perks[id] && free >= p.stars, 13);
    }
  }

  /** The window where a new charter takes one of its two edicts; it stays open until one is chosen. */
  private createEdicts() {
    const items = [
      this.image(0, 0, 'tall-panel'),
      this.add.text(0, -80, t('edictTitle'), textStyle(22, '#ffd36a', 4)).setOrigin(0.5),
      this.add
        .text(0, -50, t('edictText'), { ...textStyle(13, '#fff1d0', 3), align: 'center', fontStyle: 'normal' })
        .setOrigin(0.5),
    ];
    this.edictButtons = [0, 1].map((k) => new Button(this, 0, 6 + k * 56, 'wide', '', () => this.chooseEdict(k)));
    this.edictWindow = this.add
      .container(WIN.x, WIN.y, [...items, ...this.edictButtons.map((b) => b.root)])
      .setDepth(UI_DEPTH + 5)
      .setVisible(false);
    this.edictName = this.add.text(EDICT_PLAQUE.x, EDICT_PLAQUE.y - 9, '', textStyle(13, '#ffd36a', 3.5)).setOrigin(0.5).setDepth(UI_DEPTH + 1);
    this.edictLine = this.add
      .text(EDICT_PLAQUE.x, EDICT_PLAQUE.y + 9, '', { ...textStyle(11.5, '#fff1d0', 3.5), fontStyle: 'normal' })
      .setOrigin(0.5)
      .setDepth(UI_DEPTH + 1);
  }

  private chooseEdict(k: number) {
    const two = edictOffers(this.state);
    if (two && chooseEdict(this.state, two[k])) this.save();
  }

  /** Shows the edict window while a new charter waits for its edict, and the plaque with the one in force. */
  private drawEdicts() {
    const s = this.state;
    const two = edictOffers(s);
    this.edictWindow.setVisible(two !== null && !this.win.visible);
    two?.forEach((id: Edict, k) => this.edictButtons[k].set(`${t(EDICTS[id].name)}\n${t(EDICTS[id].blurb)}`, true, 13));
    const rule = s.edict ? EDICTS[s.edict] : null;
    this.edictName.setText(rule ? t('edictPlaque', { name: t(rule.name) }) : '');
    this.edictLine.setText(rule ? t(rule.short) : '');
    this.drawPerks();
  }

  /** The window with the crown's two offers for the next commission: as it stands, or grand (gemmed) for much more. */
  private createChooser() {
    const items = [
      this.image(0, 0, 'win-panel'),
      this.add.text(0, -40, t('offerTitle'), textStyle(22, '#ffd36a', 4)).setOrigin(0.5),
      this.add
        .text(0, -6, t('offerText'), { ...textStyle(14, '#fff1d0', 3), align: 'center', fontStyle: 'normal' })
        .setOrigin(0.5),
    ];
    this.chooserButtons = [false, true].map((grand) => new Button(this, grand ? 100 : -100, 58, 'forge', '', () => this.choose(grand)));
    const later = this.add
      .text(0, 98, t('decideLater'), { ...textStyle(12, '#fff6e0', 3.5), fontStyle: 'normal' })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    later.on('pointerdown', () => (ui('click'), this.chooser.setVisible(false)));
    this.chooser = this.add
      .container(WIN.x, WIN.y, [...items, ...this.chooserButtons.map((b) => b.root), later])
      .setDepth(UI_DEPTH + 5)
      .setVisible(false);
  }

  private choose(grand: boolean) {
    if (!chooseCommission(this.state, grand)) return ui('refuse');
    sfx('seal');
    this.chooser.setVisible(false);
    this.save();
  }

  /** Fills the chooser's buttons with the two offers while a choice waits. */
  private drawChooser() {
    const two = offers(this.state);
    if (!two) {
      this.chooser.setVisible(false);
      return;
    }
    two.forEach((c, k) => this.chooserButtons[k].set(t(k === 0 ? 'quickOffer' : 'grandOffer', { title: commissionTitle(c), n: c.reward }), true, 13));
  }

  /** The row of discovered swords under the board: a dark frame per tier, lit with its sword once it is made. */
  private createDiscovered() {
    this.discovered = [];
    for (let tier = 1; tier <= MAX_TIER; tier++) {
      const c = discoveredCentre(tier, MAX_TIER);
      const frame = this.image(c.x, c.y, 'disc-off');
      const sword = this.image(c.x, c.y, swordTexture(tier), swordScale(0.5)).setVisible(false);
      this.discovered.push({ frame, sword });
    }
  }

  private createHud() {
    this.hud = this.add.graphics().setDepth(UI_DEPTH);
    // The top bar is pinned to the view's top: the name and coins to its left edge, the banner in
    // the middle and the rest to its right edge.
    const { left, top: y0, right } = this.edge;
    const top = (n: number) => this.add.text(0, y0 + 21, '', textStyle(n, '#efe2c4')).setOrigin(0, 0.5).setDepth(UI_DEPTH + 1);
    this.titleText = top(21).setText(t('title')).setColor('#ffd36a').setX(left + 17);
    this.coinsText = top(16).setColor('#ffd36a').setX(left + 220);
    // Right to left from the corner: the best sword, the swords sold and the guild stars.
    this.bestText = top(14.5).setOrigin(1, 0.5).setX(right - 17);
    this.soldText = top(14.5).setOrigin(1, 0.5);
    this.starsText = top(15).setOrigin(1, 0.5);
    this.star = this.image(0, y0 + 20, 'star').setDepth(UI_DEPTH + 1);
    // Tapping the stars opens the guild perks too.
    this.star.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.openPerks());
    this.createBanner();
    this.bannerFrame = this.image(BANNER.x + BANNER.w / 2, y0 + BANNER.y + BANNER.h / 2, 'frame-banner').setDepth(UI_DEPTH + 2).setVisible(false);
    const r = REPUTATION;
    this.add.text(r.x + 12, r.y + 14, t('reputation'), textStyle(13, '#efe2c4')).setOrigin(0, 0.5).setDepth(UI_DEPTH + 1);
    this.repWord = this.add.text(r.x + r.w - 12, r.y + 14, '', textStyle(12, '#ffe27a')).setOrigin(1, 0.5).setDepth(UI_DEPTH + 1);
    // In the first desk, which is empty while the hint shows.
    const desk = deskCentre(0);
    this.hint = this.add.text(desk.x, desk.y, '', textStyle(13, '#e8d8b8')).setOrigin(0.5).setDepth(UI_DEPTH + 1);
  }

  private createBanner() {
    const { x, y, w, h } = BANNER;
    const small = (s: string, tx: number, ty: number, col: string) =>
      this.add.text(tx, ty, s, { ...textStyle(9.5, col, 2), fontStyle: 'normal' }).setOrigin(0, 0.5);
    const kicker = this.add.text(36, 10.5, t('royalCommission'), textStyle(8, '#ffe7a8', 3)).setOrigin(0, 0.5);
    kicker.setLetterSpacing(1);
    const title = this.add.text(36, 22.5, '', textStyle(13, '#fff2dc', 2.5)).setOrigin(0, 0.5);
    const sword = this.image(165, h / 2, swordTexture(6), swordScale(0.42));
    const progress = small('', 192, 10, '#ffffff');
    const pips = [...Array(4).keys()].map((k) => this.image(198 + k * 17, 23, 'pip-off'));
    const reward = this.add.text(w - 9, 22.5, '', textStyle(13.5, '#ffe27a', 2.5)).setOrigin(1, 0.5);
    const star = this.image(w - 9, 22, 'star', 0.65);
    // The container's origin is the banner's centre, so it can pulse in place.
    const items = [this.image(0, 0, 'banner').setOrigin(0), kicker, title, sword, progress, ...pips, reward, star];
    for (const item of items) item.setPosition(item.x - w / 2, item.y - h / 2);
    const root = this.add.container(x + w / 2, this.edge.top + y + h / 2, items).setDepth(UI_DEPTH + 1);
    this.banner = { root, kicker, title, sword, progress, pips, reward, star };
  }

  private drawHud() {
    const s = this.state;
    this.hud.clear();
    this.titleText.setText(s.charter > 0 ? `${t('title')} ${roman(s.charter + 1)}` : t('title'));
    const coins = t('coins', { n: s.coins });
    if (this.coinsText.text !== coins) {
      // A long count (or language) shrinks to stay clear of the banner.
      this.coinsText.setText(coins).setFontSize(16);
      const room = BANNER.x - 8 - this.coinsText.x;
      if (this.coinsText.width > room) this.coinsText.setFontSize(Math.floor((16 * room) / this.coinsText.width));
    }
    this.bestText.setText(t('bestSword', { name: s.bestTier > 0 ? t(swordOf(s.bestTier).name) : t('noneYet') }));
    this.soldText.setText(t('sold', { n: s.sold })).setX(this.bestText.x - this.bestText.width - 16);
    // The stars still raising prices; the edict's price change is on its plaque.
    const free = freeStars(s);
    this.starsText.setText(s.stars > 0 ? t('starBonus', { n: free, pct: Math.round(STAR_PRICE * 100 * free) }) : '').setX(this.soldText.x - this.soldText.width - 12);
    this.star.setVisible(s.stars > 0).setX(this.starsText.x - this.starsText.width - 12);
    this.hint.setText(s.adventurers.length === 0 && s.sold === 0 ? t('onTheWay') : '');
    this.discovered.forEach(({ frame, sword }, i) => {
      const made = i + 1 <= s.bestTier;
      sword.setVisible(made);
      if (frame.texture.key !== (made ? 'disc-on' : 'disc-off')) frame.setTexture(made ? 'disc-on' : 'disc-off');
    });

    // The commission: one great sword needs two of the tier below, or is ready once it is made;
    // past that, a count of Dragonslayers delivered.
    const c = standing(s);
    const b = this.banner;
    if (!c || s.choosing) {
      b.title.setText(t(c ? 'crownOffers' : 'crownsSmithy')).setFontSize(13);
      b.progress.setText(t(c ? 'tapToChoose' : 'tapToFound'));
      b.pips.forEach((pip) => pip.setVisible(false));
      b.reward.setText('');
      b.star.setX(b.reward.x - 8);
      const key = swordTexture(c ? c.tier : MAX_TIER);
      if (b.sword.texture.key !== key) b.sword.setTexture(key);
      return;
    }
    const items = [...s.slots, s.barrel];
    const ready = items.some((item) => item !== null && deliverable(s, item));
    let have: number;
    let need: number;
    const title = commissionTitle(c);
    b.title.setText(title).setFontSize(title.length > 14 ? 11.5 : 13);
    if (c.count === 1 && !c.gem) {
      need = 2;
      have = ready ? need : Math.min(need, items.filter((item) => item !== null && isSword(item) && tierOf(item) === c.tier - 1).length);
      b.progress.setText(ready ? t('ready') : `${t(swordOf(c.tier - 1).plural)} ${have}/${need}`);
    } else {
      need = c.count;
      have = s.commission.made;
      b.progress.setText(t(ready ? 'givenReady' : c.gem ? 'givenGemmed' : 'given', { have, need }));
    }
    if (b.sword.texture.key !== swordTexture(c.tier, c.gem)) b.sword.setTexture(swordTexture(c.tier, c.gem));
    b.pips.forEach((pip, k) => {
      pip.setVisible(k < need && need <= b.pips.length);
      const key = k < have ? 'pip-on' : 'pip-off';
      if (pip.texture.key !== key) pip.setTexture(key);
    });
    b.reward.setText(t('reward', { n: c.reward }));
    b.star.setX(b.reward.x - b.reward.width - 11);
  }

  /** A small button in the corner that throws the board and coins away for a fresh smithy. */
  private createReset() {
    const text = this.add
      .text(this.edge.right - 17, this.edge.bottom - 13, t('newSmithy'), { ...textStyle(12, '#fff6e0', 3.5), fontStyle: 'normal' })
      .setOrigin(1, 0.5)
      .setDepth(UI_DEPTH + 1)
      .setInteractive({ useHandCursor: true });
    // The first tap only asks; a second tap within RESET_CONFIRM_MS wipes everything, stars and perks too.
    let confirm: Phaser.Time.TimerEvent | null = null;
    const settle = () => {
      confirm?.remove();
      confirm = null;
      text.setText(t('newSmithy'));
      this.perkLink.setVisible(true);
    };
    text.on('pointerdown', () => {
      if (this.windowOpen) return;
      ui('click');
      if (!confirm) {
        text.setText(t('newSmithyConfirm'));
        // The longer question would run into the perk link beside it.
        this.perkLink.setVisible(false);
        confirm = this.time.delayedCall(RESET_CONFIRM_MS, settle);
        return;
      }
      settle();
      clearProgress();
      this.state = newShop(freshProgress());
      this.clearBoard();
    });
  }

  /** Throws away every sword sprite and visitor, after the state was replaced or the board cleared. */
  private clearBoard() {
    for (const v of this.visitors.values()) v.root.destroy();
    for (const sprite of this.swords) sprite?.destroy();
    this.barrelSword?.destroy();
    this.barrelSword = null;
    this.visitors.clear();
    this.swords.fill(null);
    this.win.setVisible(false);
    this.chooser.setVisible(false);
    this.perkWindow.setVisible(false);
  }
}
