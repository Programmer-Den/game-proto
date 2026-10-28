import Phaser from 'phaser';
import { settings } from '../../../../shared/settings';
import { splitHudCamera, viewFrame, viewPoint, viewSize } from '../../../../shared/scaling';
import { HEROES, HERO_IDS, isKnight, schemeOf, type HeroId } from '../game/heroes';
import { HERO_R, POWER_UPS, RUN_MS, clock, freshState, isStructure, statsOf, type GameState, type PowerUp } from '../game/state';
import { choose, inRingGap, phalanxSpots, prepare, shieldHalf, startRun, suppressorHalf, suppressorLength } from '../game/sim';
import { bladeColor, dreadRadius, heroVariant, orbitBlades } from '../game/blades';
import { bubble, rebuildTime } from '../game/squad';
import { buy, chooseEvent, chooseNode, chooseWorld, chartOptions, frame, leave, nextPlanet, reroll } from '../game/voyage';
import { heatOpen } from '../game/heat';
import { ARMOURY, salvage, type ArmouryId } from '../game/armoury';
import { reseed, unseed, weekOf, weekSeed, weeklyOf, type MutatorId } from '../game/weekly';
import { ARENA_MS, BOSSES, CHAMPION, PLANETS, SIEGE, STRIKE, VENT, planetLabel } from '../game/planets';
import { UPGRADES, MAX_TIER } from '../game/upgrades';
import {
  clearRun, isBetweenWorlds, isUnlocked, loadProgress, loadRun, buyArmoury, recordCharted, recordRun, recordWeekly, recordUnlocks, saveRun, unlockedHeroes, type Progress,
} from '../game/save';
import { C, hex } from '../art/glow';
import { heroKey } from '../art/sprites';
import { t } from '../i18n';
import { bladeKey } from '../art/knights';
import { bakeWorlds } from '../art/worlds';
import { ui } from '../../../../shared/audio';
import { OBJ_COLOR, drawObjectiveGround, drawPowerUp, drawStructure, objectiveTarget } from './objectiveArt';
import { objectiveHint, objectiveName, OBJ_MISC } from '../game/objectives';
import { SoundCues } from '../audio/cues';
import { sfx } from '../audio/sfx';
import { Panel, armouryPanel, weeklyPanel, endScreen, eventPanel, heroSelect, levelUp, spaceMap, starMap, trader, unlockPanel } from '../ui/panels';
import {
  BOSS_BAR, CENTER, CREDITS_TAG, OBJECTIVE_HUD, DEPTH, FONT, HP_BAR, KIT, LEVEL, PLANET_TAG, SIG_BUTTON, STICK, TIMER, SCREEN, FRAME, VIEW, XP_BAR, fitLayout, inside,
} from './layout';

/** A pool of images for one kind of thing on the field, reused frame to frame. */
class Pool {
  private items: Phaser.GameObjects.Image[] = [];
  private used = 0;
  constructor(private scene: Phaser.Scene, private depth: number, private add = false) {}

  begin() {
    this.used = 0;
  }

  next(key: string, x: number, y: number) {
    let im = this.items[this.used];
    if (!im) {
      im = this.scene.add.image(x, y, key).setDepth(this.depth);
      // Glowing things add their light, so overlapping halos never darken each other.
      if (this.add) im.setBlendMode(Phaser.BlendModes.ADD);
      this.items.push(im);
    } else {
      if (im.texture.key !== key) im.setTexture(key);
      im.setPosition(x, y).setVisible(true).setRotation(0).setScale(1).setAlpha(1).setFlipX(false).setOrigin(0.5).clearTint();
    }
    this.used += 1;
    return im;
  }

  end() {
    for (let i = this.used; i < this.items.length; i++) this.items[i].setVisible(false);
  }
}

/** The texture of each kind of ally. */
const ALLY_KEYS: Record<GameState['allies'][number]['kind'], string> = {
  trooper: 'rb-trooper', legionary: 'rb-legionary', brother: 'rb-brother', escort: 'rb-escort', drone: 'rb-drone',
  fighter: 'rb-fighter', squadron: 'rb-fighter', copilot: 'rb-copilot', spirit: 'rb-spirit', puppet: 'rb-puppet',
  commando: 'rb-commando', bike: 'rb-bike', medic: 'rb-medic', shieldbot: 'rb-shieldbot', command: 'rb-command', spare: 'rb-bot', thawed: 'rb-trooper',
};
/** Allies drawn from the hero art (small soldiers), placed by its origin. */
const HERO_LIKE: readonly GameState['allies'][number]['kind'][] = ['trooper', 'legionary', 'brother', 'commando', 'medic', 'thawed'];

/** The hero art's centre within its texture (see HERO_BOX in sprites.ts). */
const HERO_ORIGIN = { x: 0.5, y: 52 / 120 };

/** Cheap repeatable noise for the ground's decorations (Math.random is left to the rules). */
function hash(x: number, y: number, k = 0) {
  const n = Math.sin(x * 127.1 + y * 311.7 + k * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

export class GameScene extends Phaser.Scene {
  /** The run (read by the playthrough test). */
  state: GameState = freshState();
  /** The panel showing (hero select, level-up or end of run) and where its cards are. */
  panel: Panel | null = null;
  /** What the panel showing was built from, so it is rebuilt when any of it changes. */
  private shown = '';
  private progress: Progress = loadProgress();
  /** Whether `bakeWorlds` has run (see `draw`). */
  private worldsBaked = false;
  /** The hero chosen on the select screen (kept between runs), and deeds already saved this run. */
  chosen: HeroId = 'tr9';
  /** The rift heat picked on the select screen for each hero (the highest open until changed). */
  private heatPick: Partial<Record<HeroId, number>> = {};
  /** Whether the Armoury is open over the hero select, and the credits the run that ended banked. */
  armouryOpen = false;
  private banked = 0;
  /** Whether the weekly run's panel is open, this week's number, and the bonus the weekly win banked. */
  weeklyOpen = false;
  private week = weekOf(Date.now());
  private bonus = 0;
  private savedDeeds = 0;
  /** Heroes just unlocked, waiting to be shown (the game stands still while one is). */
  unlocking: HeroId[] = [];
  /** Whether the run that ended has been saved. */
  private recorded = false;
  /** Plays the run's sounds and music by watching the state frame to frame. */
  private cues = new SoundCues();

  private ground!: Phaser.GameObjects.Graphics;
  private under!: Phaser.GameObjects.Graphics;
  private over!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private pools!: Record<'pickups' | 'enemies' | 'allies' | 'bolts', Pool>;
  private hero!: Phaser.GameObjects.Image;
  private popTexts: Phaser.GameObjects.Text[] = [];
  /** The side objective's two HUD lines, made when the first objective starts. */
  private objTexts: { name: Phaser.GameObjects.Text; hint: Phaser.GameObjects.Text } | null = null;
  private texts!: Record<'timer' | 'level' | 'planet' | 'credits' | 'hp' | 'kit' | 'sig' | 'sigKey' | 'boss', Phaser.GameObjects.Text>;

  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  /** Whether a pointer is held on the field to walk, and the signature asked for this frame. */
  private walking = false;
  private sigQueued = false;
  /** The floating stick of a touch: where the finger first went down and where it is now, in view pixels. */
  private stick: { id: number; ox: number; oy: number; x: number; y: number } | null = null;

  constructor() {
    super('Game');
  }

  create() {
    this.state = freshState();
    this.panel = null;
    this.shown = '';
    this.unlocking = [];
    this.progress = loadProgress();
    this.cues = new SoundCues();
    // The view takes the screen's shape: pin the HUD to its edges and centre the panels in it.
    const view = viewSize(this);
    const frame = viewFrame(this);
    fitLayout(view.width, view.height, frame.x, frame.y);
    // The world camera follows the hero; the HUD (scroll factor 0) gets a fixed camera.
    splitHudCamera(this);
    this.ground = this.add.graphics().setDepth(DEPTH.ground);
    this.under = this.add.graphics().setDepth(DEPTH.under);
    this.over = this.add.graphics().setDepth(DEPTH.over);
    this.pools = {
      pickups: new Pool(this, DEPTH.pickups),
      enemies: new Pool(this, DEPTH.enemies, true),
      allies: new Pool(this, DEPTH.allies),
      bolts: new Pool(this, DEPTH.bolts, true),
    };
    this.hero = this.add.image(0, 0, heroKey('rook')).setOrigin(HERO_ORIGIN.x, HERO_ORIGIN.y).setDepth(DEPTH.hero).setVisible(false);
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(DEPTH.hud);
    const text = (x: number, y: number, size: number, color: string, origin: [number, number], bold = false) =>
      this.add
        .text(x, y, '', { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' })
        .setOrigin(...origin)
        .setScrollFactor(0)
        .setDepth(DEPTH.hud + 1);
    this.texts = {
      timer: text(TIMER.x, TIMER.y, 28, C.text, [0.5, 0.5], true),
      level: text(LEVEL.x, LEVEL.y, 18, C.text, [1, 0.5], true),
      planet: text(PLANET_TAG.x, PLANET_TAG.y, 13, C.muted, [1, 0.5], true),
      credits: text(CREDITS_TAG.x, CREDITS_TAG.y, 13, C.credits, [1, 0.5], true),
      hp: text(HP_BAR.x, HP_BAR.y + HP_BAR.h + 4, 12, C.muted, [0, 0]),
      kit: text(KIT.x, KIT.y, 11.5, C.muted, [0, 0]).setLineSpacing(2),
      sig: text(SIG_BUTTON.x, SIG_BUTTON.y - 6, 11, C.text, [0.5, 0.5], true),
      sigKey: text(SIG_BUTTON.x, SIG_BUTTON.y + 10, 10, C.muted, [0.5, 0.5]),
      boss: text(BOSS_BAR.x + BOSS_BAR.w / 2, BOSS_BAR.y - 9, 12, C.boss, [0.5, 0.5], true),
    };
    this.texts.timer.setShadow(0, 0, '#5fa8ff', 8, false, true);

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT,NINE,ZERO,MINUS,PLUS,ENTER') as Record<string, Phaser.Input.Keyboard.Key>;
    this.keys.SPACE.on('down', () => {
      if (this.unlocking.length) this.closeUnlock();
      else this.sigQueued = true;
    });
    // 1-9 and 0 pick the first ten heroes, - and = the last two.
    ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'ZERO', 'MINUS', 'PLUS'].forEach((key, i) => {
      this.keys[key].on('down', () => {
        const s = this.state;
        if (this.unlocking.length) return;
        if (s.phase === 'select' && this.weeklyOpen) return;
        if (s.phase === 'select' && this.armouryOpen) {
          if (ARMOURY[i]) this.buyArmoury(ARMOURY[i].id);
        } else if (s.phase === 'select') {
          if (HERO_IDS[i]) this.choose(HERO_IDS[i]);
        } else if (s.phase === 'levelup') {
          if (i < (s.choices?.length ?? 0)) this.pickIndex(i);
        } else if (i === 3) this.reroll();
        else if (i < 3) this.pickIndex(i);
      });
    });
    // Left and right step the rift heat on the hero select.
    for (const [key, dir] of [['LEFT', -1], ['RIGHT', 1], ['A', -1], ['D', 1]] as const) {
      this.keys[key].on('down', () => {
        if (this.state.phase === 'select' && !this.unlocking.length && !this.armouryOpen && !this.weeklyOpen) this.stepHeat(dir);
      });
    }
    this.keys.ENTER.on('down', () => {
      if (this.unlocking.length) this.closeUnlock();
      else if (this.state.phase === 'won' || this.state.phase === 'lost') this.backToSelect();
      else if (this.state.phase === 'select' && this.armouryOpen) this.closeArmoury();
      else if (this.state.phase === 'select' && this.weeklyOpen) this.beginWeekly();
      else if (this.state.phase === 'select') this.begin(this.chosen);
      else this.leave();
    });
    this.setUpSaving();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.pointerDown(p));
    // A second touch pointer, so a thumb can hit the signature button while the other steers.
    this.input.addPointer(1);
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.stick?.id === p.id) this.stick = null;
      else if (!p.wasTouch) this.walking = false;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.stick?.id === p.id) this.dragStick(viewPoint(p));
      else this.panel?.hover(viewPoint(p));
    });
    const saved = loadRun();
    try {
      if (saved) this.resume(saved);
      this.syncPanel();
    } catch (err) {
      // A saved run the panels can't show (hand-edited or from another version) is dropped, so the
      // game still opens, on the hero select.
      console.warn('Riftblade: dropping the saved run', err);
      clearRun();
      this.state = freshState();
      this.savedDeeds = 0;
      this.cues = new SoundCues();
      this.hero.setVisible(false);
      this.syncPanel();
    }
  }

  /** Saves the run between worlds when the page is hidden or closed (panels save as they open). */
  private setUpSaving() {
    const save = () => this.saveRun();
    const onHide = () => {
      if (document.visibilityState === 'hidden') save();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
    });
  }

  private saveRun() {
    if (!isBetweenWorlds(this.state)) return;
    saveRun(this.state);
  }

  /** Picks up a run saved when the game was closed, where it stood. */
  private resume(s: GameState) {
    // The screen may have another shape now: the spawn ring follows the view's corners.
    s.ringOut = (Math.hypot(SCREEN.w, SCREEN.h) - Math.hypot(VIEW.w, VIEW.h)) / 2;
    this.state = s;
    prepare(s);
    this.chosen = s.hero!;
    this.savedDeeds = s.deeds.length;
    this.recorded = false;
    this.hero.setTexture(heroKey(s.hero!, heroVariant(s))).setVisible(true);
    this.cues.resume(s);
    if (s.week >= 0) reseed(weekSeed(s.week) + 7919 * s.stage + 17);
  }

  // -------------------------------------------------------------------------------------------
  // Input

  private pointerDown(pointer: Phaser.Input.Pointer) {
    const v = viewPoint(pointer);
    const s = this.state;
    if (s.phase === 'run' && !this.unlocking.length) {
      const d = Math.hypot(v.x - SIG_BUTTON.x, v.y - SIG_BUTTON.y);
      if (d <= SIG_BUTTON.r) this.sigQueued = true;
      else if (pointer.wasTouch) {
        // A touch puts a stick under the finger; dragging from there steers.
        if (!this.stick) this.stick = { id: pointer.id, ox: v.x, oy: v.y, x: v.x, y: v.y };
      } else this.walking = true;
      return;
    }
    const spot = this.panel?.spots.find((r) => inside(v, r));
    if (!spot) return;
    if (this.unlocking.length) {
      if (spot.id === 'continue') this.closeUnlock();
      return;
    }
    if (s.phase === 'select' && this.weeklyOpen) {
      if (spot.id === 'start') this.beginWeekly();
      else if (spot.id === 'back') {
        this.weeklyOpen = false;
        ui('click');
      }
    } else if (s.phase === 'select' && this.armouryOpen) {
      if (spot.id === 'back') this.closeArmoury();
      else this.buyArmoury(spot.id as ArmouryId);
    } else if (s.phase === 'select') {
      if (spot.id === 'fight') this.begin(this.chosen);
      else if (spot.id === 'armoury') {
        this.armouryOpen = true;
        ui('click');
      } else if (spot.id === 'weekly') {
        this.week = weekOf(Date.now());
        this.weeklyOpen = true;
        ui('click');
      }
      else if (spot.id === 'heat-down') this.stepHeat(-1);
      else if (spot.id === 'heat-up') this.stepHeat(1);
      else this.choose(spot.id as HeroId);
    }
    else if (s.phase === 'won' || s.phase === 'lost') this.backToSelect();
    else if (spot.id === 'reroll') this.reroll();
    else if (spot.id === 'leave') this.leave();
    else this.pickIndex(this.panel!.spots.indexOf(spot));
  }

  /** Moves the stick's knob to the finger; past the rim the base is dragged along behind it. */
  private dragStick(v: { x: number; y: number }) {
    const st = this.stick!;
    st.x = v.x;
    st.y = v.y;
    const d = Math.hypot(st.x - st.ox, st.y - st.oy);
    if (d > STICK.r) {
      const k = (d - STICK.r) / d;
      st.ox += (st.x - st.ox) * k;
      st.oy += (st.y - st.oy) * k;
    }
  }

  /** Shows a hero's details on the select screen (locked ones too, with their deed). */
  private choose(id: HeroId) {
    if (isUnlocked(this.progress, id)) ui('click');
    else ui('refuse');
    this.chosen = id;
  }

  /** This week's hero and mutators, from the heroes open now. */
  private weekly() {
    return weeklyOf(this.week, unlockedHeroes(this.progress));
  }

  /** Starts this week's weekly run. */
  private beginWeekly() {
    const { hero, mutators } = this.weekly();
    this.weeklyOpen = false;
    this.chosen = hero;
    this.begin(hero, { week: this.week, mutators });
  }

  /** Buys the next rank of an Armoury piece, if the bank holds enough. */
  private buyArmoury(id: ArmouryId) {
    const progress = buyArmoury(id);
    if (!progress) {
      ui('refuse');
      return;
    }
    this.progress = progress;
    ui('coin');
  }

  private closeArmoury() {
    this.armouryOpen = false;
    ui('click');
  }

  /** The rift heat the chosen hero would fight at: the one picked, else the highest open. */
  private heatFor(id: HeroId) {
    const open = isUnlocked(this.progress, id) ? heatOpen(this.progress.heat[id]) : 0;
    return Math.min(open, this.heatPick[id] ?? open);
  }

  /** Steps the chosen hero's rift heat down or up, within what is open. */
  private stepHeat(dir: -1 | 1) {
    const id = this.chosen;
    const open = isUnlocked(this.progress, id) ? heatOpen(this.progress.heat[id]) : 0;
    const next = this.heatFor(id) + dir;
    if (open === 0 || next < 0 || next > open) {
      if (open > 0) ui('refuse');
      return;
    }
    this.heatPick[id] = next;
    ui('click');
  }

  private closeUnlock() {
    this.unlocking.shift();
    ui('click');
  }

  private reroll() {
    if (this.state.phase !== 'trader') return;
    if (reroll(this.state)) sfx('reroll');
    else ui('refuse');
  }

  private leave() {
    if (this.state.phase !== 'trader') return;
    leave(this.state);
    ui('click');
    this.settle();
  }

  /**
   * Jumps at once when a choice ended in `travel`: `travel` is not saved, so a save in the frame
   * before `frame` would still hold the panel with the reward not yet taken, and repeat it.
   */
  private settle() {
    if (this.state.phase === 'travel') nextPlanet(this.state);
  }

  /** The card, node, offer or answer at `i` (a tap or the 1/2/3 keys). */
  private pickIndex(i: number) {
    const s = this.state;
    if (s.phase === 'levelup') {
      if (s.choices?.[i]) sfx('card');
      choose(s, i);
    } else if (s.phase === 'chart') {
      if (chartOptions(s)[i] !== undefined) sfx('node');
      chooseWorld(s, i);
    } else if (s.phase === 'map') {
      if (s.nodes[i]) sfx('node');
      chooseNode(s, i);
    } else if (s.phase === 'trader') {
      if (buy(s, i)) ui('coin');
      else ui('refuse');
    } else if (s.phase === 'event') {
      if (s.event?.options[i]) sfx('event');
      chooseEvent(s, i);
    }
    this.settle();
  }

  private begin(id: HeroId, weekly?: { week: number; mutators: MutatorId[] }) {
    if (!isUnlocked(this.progress, id)) {
      ui('refuse');
      return;
    }
    ui('click');
    unseed();
    // A weekly run is fought at heat 0 without the Armoury, and seeds Math.random (`startRun`).
    const ringOut = (Math.hypot(SCREEN.w, SCREEN.h) - Math.hypot(VIEW.w, VIEW.h)) / 2;
    startRun(this.state, id, unlockedHeroes(this.progress), ringOut, weekly ?? { heat: this.heatFor(id), perks: this.progress.armoury });
    this.savedDeeds = 0;
    this.recorded = false;
    // A new run is first saved once its first world is cleared.
    clearRun();
    this.hero.setTexture(heroKey(id)).setVisible(true);
    this.walking = false;
    this.stick = null;
    this.sigQueued = false;
  }

  private backToSelect() {
    ui('click');
    unseed();
    this.state = freshState();
    this.hero.setVisible(false);
  }

  /** The way to walk: the keys, else toward a pointer held on the field. */
  private moveInput() {
    const k = this.keys;
    let mx = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    let my = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    if (mx || my) {
      const len = Math.hypot(mx, my);
      return { mx: mx / len, my: my / len };
    }
    if (this.stick) {
      // The stick: full speed at the rim, slower nearer the middle, nothing inside the dead zone.
      const dx = this.stick.x - this.stick.ox;
      const dy = this.stick.y - this.stick.oy;
      const d = Math.hypot(dx, dy);
      if (d <= STICK.dead) return { mx: 0, my: 0 };
      const k2 = Math.min(1, d / STICK.r) / d;
      return { mx: dx * k2, my: dy * k2 };
    }
    const pointer = this.input.activePointer;
    if (this.walking && pointer.isDown) {
      const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const p = this.state.player;
      const dx = world.x - p.x;
      const dy = world.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 10) {
        // Full speed from 40 px out; closer, slower, so a tap just next to the hero nudges.
        const k2 = Math.min(1, d / 40) / d;
        mx = dx * k2;
        my = dy * k2;
      }
    } else this.walking = false;
    return { mx, my };
  }

  // -------------------------------------------------------------------------------------------
  // The frame

  update(_time: number, delta: number) {
    const s = this.state;
    // A new hero's panel holds the game still until it is closed.
    if (!this.unlocking.length) {
      const move = s.phase === 'run' ? this.moveInput() : { mx: 0, my: 0 };
      const asked = s.phase === 'run' && this.sigQueued;
      const used = s.signatures;
      frame(s, delta, { ...move, signature: asked });
      // A press the sim could not take (a level-up or a panel) is dropped, not saved for later.
      this.sigQueued = false;
      // The signature still cooling down (or a knight's with nothing to act on).
      if (asked && s.signatures === used) ui('refuse');
    }
    // A deed done this run unlocks a hero at once, even if the run is lost later, and is shown.
    if (s.deeds.length > this.savedDeeds) {
      this.unlocking.push(...s.deeds.slice(this.savedDeeds));
      this.savedDeeds = s.deeds.length;
      this.progress = recordUnlocks(s.deeds);
      this.cues.unlock();
      this.walking = false;
      this.stick = null;
    }
    this.cues.update(this.state);
    // A planet landed on is charted in the save: the space map names its faction from then on.
    const here = this.state.hero ? PLANETS[this.state.planet].id : null;
    if (here && this.state.phase === 'run' && !this.progress.charted.includes(here)) this.progress = recordCharted(here);
    if (this.panelKey() !== this.shown) this.syncPanel();
    this.draw();
  }

  /** Everything the panel showing depends on. */
  private panelKey() {
    const s = this.state;
    if (this.unlocking.length) return `unlock|${this.unlocking[0]}`;
    if (s.phase === 'run') return 'run';
    if (s.phase === 'select' && this.weeklyOpen) return `weekly|${this.week}|${JSON.stringify(this.progress.weekly)}`;
    if (s.phase === 'select' && this.armouryOpen) return `armoury|${this.progress.bank}|${JSON.stringify(this.progress.armoury)}`;
    return [s.phase, this.chosen, this.progress.bank, this.heatFor(this.chosen), s.choices?.join(), s.offers.join(), s.credits, s.event?.id, s.nodes.join(), s.rewardPicks].join('|');
  }

  /** Shows the panel for the phase the run is in. */
  private syncPanel() {
    const s = this.state;
    this.panel?.destroy();
    this.panel = null;
    if ((s.phase === 'won' || s.phase === 'lost') && !this.recorded) {
      this.recorded = true;
      this.banked = salvage(s.credits, s.stage + 1);
      this.bonus = 0;
      unseed();
      this.progress = recordRun(s.hero!, s.runMs, s.phase === 'won', s.stage + 1, s.route.map((i) => PLANETS[i].id), s.heat, this.banked);
      if (s.week >= 0) this.bonus = recordWeekly(s.week, s.stage + 1, s.phase === 'won').bonus;
      this.progress = loadProgress();
      clearRun();
    }
    // Every other panel saves the run as it opens, if it is between worlds (the maps, the trader,
    // an event, the cards after a clear).
    else this.saveRun();
    // The panel is kept before it is built, so one that throws half-built (a corrupt saved run) is
    // still destroyed by the next call.
    const build = (fill: (p: Panel) => void) => {
      const p = (this.panel = new Panel(this));
      fill(p);
      p.place(FRAME.x, FRAME.y);
    };
    if (this.unlocking.length) build((p) => unlockPanel(p, this.unlocking[0]));
    else if (s.phase === 'select' && this.weeklyOpen) build((p) => weeklyPanel(p, this.progress, this.week, this.weekly().hero, this.weekly().mutators));
    else if (s.phase === 'select' && this.armouryOpen) build((p) => armouryPanel(p, this.progress));
    else if (s.phase === 'select') build((p) => heroSelect(p, this.progress, this.chosen, this.heatFor(this.chosen), this.week));
    else if (s.phase === 'levelup') build((p) => levelUp(p, s));
    else if (s.phase === 'chart') build((p) => spaceMap(p, s, this.progress.charted));
    else if (s.phase === 'map') build((p) => starMap(p, s));
    else if (s.phase === 'trader') build((p) => trader(p, s));
    else if (s.phase === 'event') build((p) => eventPanel(p, s));
    else if (s.phase === 'won' || s.phase === 'lost') build((p) => endScreen(p, s, this.progress, this.banked, this.bonus));
    this.shown = this.panelKey();
    this.walking = false;
    this.stick = null;
  }

  private draw() {
    const s = this.state;
    const p = s.player;
    // The four later planets' textures are painted the first time a run gets past the Dune world, not
    // at boot: Phaser draws on Math.random for each texture's id, and the first minute's seeded draws
    // (the playthrough's) stay as they were.
    if (!this.worldsBaked && s.hero && (s.phase === 'chart' || s.planet !== 0)) {
      bakeWorlds(this);
      this.worldsBaked = true;
    }
    const cam = this.cameras.main;
    cam.centerOn(p.x, p.y);
    this.drawGround(p.x, p.y, s.hero ? s.planet : 0);
    this.under.clear();
    this.over.clear();
    for (const pool of Object.values(this.pools)) pool.begin();
    if (s.hero) this.drawRun(s);
    for (const pool of Object.values(this.pools)) pool.end();
    this.drawHud(s);
  }

  /**
   * The planet's ground, endless in every way: a field in its colour with a faint grid, and its
   * scenery from a hash: dune ridges and rocks, reeds and pools, ice cracks and shards, or glowing
   * lava cracks and ash.
   */
  private drawGround(cx: number, cy: number, planet: number) {
    const g = this.ground;
    g.clear();
    const def = PLANETS[planet];
    const x0 = cx - SCREEN.w / 2 - 40;
    const y0 = cy - SCREEN.h / 2 - 40;
    const x1 = cx + SCREEN.w / 2 + 40;
    const y1 = cy + SCREEN.h / 2 + 40;
    if (def.id !== 'dune') g.fillStyle(hex(def.ground.field), 1).fillRect(x0, y0, x1 - x0, y1 - y0);
    const step = 48;
    g.lineStyle(1, hex(def.ground.grid), 0.07);
    for (let x = Math.floor(x0 / step) * step; x <= x1; x += step) g.lineBetween(x, y0, x, y1);
    for (let y = Math.floor(y0 / step) * step; y <= y1; y += step) g.lineBetween(x0, y, x1, y);
    const cell = 320;
    const deco = hex(def.ground.deco);
    for (let gx = Math.floor(x0 / cell); gx <= Math.floor(x1 / cell); gx++) {
      for (let gy = Math.floor(y0 / cell); gy <= Math.floor(y1 / cell); gy++) {
        const bx = gx * cell;
        const by = gy * cell;
        if (def.id === 'swamp') this.swampCell(g, gx, gy, bx, by, cell, deco);
        else if (def.id === 'ice') this.iceCell(g, gx, gy, bx, by, cell, deco);
        else if (def.id === 'lava') this.lavaCell(g, gx, gy, bx, by, cell, deco);
        else if (def.id === 'spore') this.sporeCell(g, gx, gy, bx, by, cell, deco);
        else if (def.id === 'scrap') this.scrapCell(g, gx, gy, bx, by, cell, deco);
        else if (def.id === 'crystal') this.crystalCell(g, gx, gy, bx, by, cell, deco);
        else if (def.id === 'storm') this.stormCell(g, gx, gy, bx, by, cell, deco);
        else this.duneCell(g, gx, gy, bx, by, cell, deco);
      }
    }
  }

  /** A closed wobbly loop (a pool, a rock, a lava pool), as a path to stroke or fill. */
  private blob(g: Phaser.GameObjects.Graphics, gx: number, gy: number, x: number, y: number, r: number, squash: number, k: number) {
    g.beginPath();
    for (let i = 0; i <= 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const w = 0.75 + hash(gx + (i % 8), gy, k) * 0.35;
      const px = x + Math.cos(a) * r * w;
      const py = y + Math.sin(a) * r * w * squash;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
  }

  /** A jagged line from a point: a crack in ice or a glowing seam in lava rock. */
  private crack(g: Phaser.GameObjects.Graphics, gx: number, gy: number, x: number, y: number, len: number, k: number) {
    const a0 = hash(gx, gy, k) * Math.PI * 2;
    g.beginPath();
    g.moveTo(x, y);
    let px = x;
    let py = y;
    for (let i = 1; i <= 6; i++) {
      const a = a0 + (hash(gx + i, gy, k + 1) - 0.5) * 1.4;
      px += Math.cos(a) * (len / 6);
      py += Math.sin(a) * (len / 6);
      g.lineTo(px, py);
    }
    g.strokePath();
  }

  private swampCell(g: Phaser.GameObjects.Graphics, gx: number, gy: number, bx: number, by: number, cell: number, deco: number) {
    // Murky pools, reed clumps and floating specks.
    for (let k = 0; k < 2; k++) {
      if (hash(gx, gy, k + 50) < 0.35) continue;
      const x = bx + hash(gx, gy, k + 51) * cell;
      const y = by + hash(gx, gy, k + 52) * cell;
      const r = 30 + hash(gx, gy, k + 53) * 40;
      g.fillStyle(0x0c2a20, 0.55);
      this.blob(g, gx, gy, x, y, r, 0.6, k + 54);
      g.fillPath();
      g.lineStyle(1.5, deco, 0.16);
      this.blob(g, gx, gy, x, y, r, 0.6, k + 54);
      g.strokePath();
    }
    for (let k = 0; k < 3; k++) {
      const x = bx + hash(gx, gy, k + 60) * cell;
      const y = by + hash(gx, gy, k + 63) * cell;
      g.lineStyle(1.5, deco, 0.2);
      for (let i = 0; i < 4; i++) {
        const lean = (hash(gx, gy, k * 4 + i + 66) - 0.5) * 10;
        const h = 10 + hash(gx, gy, k * 4 + i + 70) * 12;
        g.lineBetween(x + i * 4, y, x + i * 4 + lean, y - h);
      }
    }
    g.fillStyle(deco, 0.14);
    for (let k = 0; k < 7; k++) g.fillCircle(bx + hash(gx, gy, k + 80) * cell, by + hash(gx, gy, k + 88) * cell, 1.4);
  }

  private iceCell(g: Phaser.GameObjects.Graphics, gx: number, gy: number, bx: number, by: number, cell: number, deco: number) {
    // Cracks in the ice, the odd shard sticking up, and snow.
    g.lineStyle(1.5, deco, 0.12);
    for (let k = 0; k < 2; k++) this.crack(g, gx, gy, bx + hash(gx, gy, k + 100) * cell, by + hash(gx, gy, k + 103) * cell, 90 + hash(gx, gy, k + 106) * 110, k * 10 + 110);
    if (hash(gx, gy, 130) > 0.45) {
      const x = bx + hash(gx, gy, 131) * cell;
      const y = by + hash(gx, gy, 132) * cell;
      const h = 14 + hash(gx, gy, 133) * 16;
      g.fillStyle(deco, 0.08);
      g.fillTriangle(x - 8, y, x + 8, y, x + 2, y - h);
      g.lineStyle(1.5, deco, 0.28);
      g.strokeTriangle(x - 8, y, x + 8, y, x + 2, y - h);
    }
    g.fillStyle(0xffffff, 0.22);
    for (let k = 0; k < 9; k++) g.fillCircle(bx + hash(gx, gy, k + 140) * cell, by + hash(gx, gy, k + 150) * cell, 1.1);
  }

  private lavaCell(g: Phaser.GameObjects.Graphics, gx: number, gy: number, bx: number, by: number, cell: number, deco: number) {
    // Glowing seams, cooled lava pools and ash.
    for (let k = 0; k < 2; k++) {
      const x = bx + hash(gx, gy, k + 200) * cell;
      const y = by + hash(gx, gy, k + 203) * cell;
      const len = 80 + hash(gx, gy, k + 206) * 120;
      g.lineStyle(5, deco, 0.07);
      this.crack(g, gx, gy, x, y, len, k * 10 + 210);
      g.lineStyle(1.5, 0xffb347, 0.3);
      this.crack(g, gx, gy, x, y, len, k * 10 + 210);
    }
    if (hash(gx, gy, 230) > 0.5) {
      const x = bx + hash(gx, gy, 231) * cell;
      const y = by + hash(gx, gy, 232) * cell;
      const r = 22 + hash(gx, gy, 233) * 26;
      g.fillStyle(0x3a0f08, 0.8);
      this.blob(g, gx, gy, x, y, r, 0.65, 234);
      g.fillPath();
      g.lineStyle(2, deco, 0.3);
      this.blob(g, gx, gy, x, y, r, 0.65, 234);
      g.strokePath();
    }
    g.fillStyle(0xd0b8b0, 0.12);
    for (let k = 0; k < 8; k++) g.fillCircle(bx + hash(gx, gy, k + 240) * cell, by + hash(gx, gy, k + 250) * cell, 1.2);
  }

  private sporeCell(g: Phaser.GameObjects.Graphics, gx: number, gy: number, bx: number, by: number, cell: number, deco: number) {
    // Threads of mycelium, mushroom caps on short stems, and drifting spores.
    g.lineStyle(1.2, 0xd36bff, 0.12);
    for (let k = 0; k < 2; k++) this.crack(g, gx, gy, bx + hash(gx, gy, k + 300) * cell, by + hash(gx, gy, k + 303) * cell, 70 + hash(gx, gy, k + 306) * 90, k * 10 + 310);
    for (let k = 0; k < 3; k++) {
      if (hash(gx, gy, k + 330) < 0.4) continue;
      const x = bx + hash(gx, gy, k + 331) * cell;
      const y = by + hash(gx, gy, k + 334) * cell;
      const r = 6 + hash(gx, gy, k + 337) * 9;
      g.lineStyle(1.5, deco, 0.22).lineBetween(x, y, x, y + r * 1.1);
      g.fillStyle(0x3a0f3a, 0.7).slice(x, y, r, Math.PI, 0, false).fillPath();
      g.lineStyle(1.5, deco, 0.32).beginPath().arc(x, y, r, Math.PI, 0, false).strokePath();
      g.fillStyle(deco, 0.25).fillCircle(x - r * 0.4, y - r * 0.45, 1.5).fillCircle(x + r * 0.3, y - r * 0.6, 1.2);
    }
    g.fillStyle(deco, 0.16);
    for (let k = 0; k < 8; k++) g.fillCircle(bx + hash(gx, gy, k + 350) * cell, by + hash(gx, gy, k + 360) * cell, 1.3);
  }

  private scrapCell(g: Phaser.GameObjects.Graphics, gx: number, gy: number, bx: number, by: number, cell: number, deco: number) {
    // Scrap plates half sunk in the dirt, coiled cables and bolts.
    for (let k = 0; k < 3; k++) {
      if (hash(gx, gy, k + 400) < 0.35) continue;
      const x = bx + hash(gx, gy, k + 401) * cell;
      const y = by + hash(gx, gy, k + 404) * cell;
      const w = 18 + hash(gx, gy, k + 407) * 30;
      const h = 8 + hash(gx, gy, k + 410) * 14;
      g.fillStyle(0x2a1d14, 0.75).fillRect(x, y, w, h);
      g.lineStyle(1.5, deco, 0.25).strokeRect(x, y, w, h);
      g.fillStyle(deco, 0.3).fillCircle(x + 4, y + 4, 1.4).fillCircle(x + w - 4, y + 4, 1.4);
    }
    const cx = bx + hash(gx, gy, 420) * cell;
    const cy = by + hash(gx, gy, 421) * cell;
    g.lineStyle(1.5, 0x7fb8b0, 0.16).beginPath();
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI * 3;
      const r = 6 + i * 1.6;
      if (i === 0) g.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6);
      else g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.6);
    }
    g.strokePath();
    g.fillStyle(deco, 0.14);
    for (let k = 0; k < 7; k++) g.fillRect(bx + hash(gx, gy, k + 430) * cell, by + hash(gx, gy, k + 440) * cell, 2.2, 2.2);
  }

  private crystalCell(g: Phaser.GameObjects.Graphics, gx: number, gy: number, bx: number, by: number, cell: number, deco: number) {
    // Clusters of crystal spikes, faint facet lines and glints.
    g.lineStyle(1, 0x9c7cff, 0.1);
    for (let k = 0; k < 2; k++) this.crack(g, gx, gy, bx + hash(gx, gy, k + 500) * cell, by + hash(gx, gy, k + 503) * cell, 60 + hash(gx, gy, k + 506) * 80, k * 10 + 510);
    for (let k = 0; k < 2; k++) {
      if (hash(gx, gy, k + 530) < 0.4) continue;
      const x = bx + hash(gx, gy, k + 531) * cell;
      const y = by + hash(gx, gy, k + 534) * cell;
      for (let i = 0; i < 3; i++) {
        const h = 12 + hash(gx, gy, k * 3 + i + 540) * 18;
        const lean = (i - 1) * 7;
        const px = x + (i - 1) * 9;
        g.fillStyle(0x1b1640, 0.75).fillTriangle(px - 5, y, px + 5, y, px + lean, y - h);
        g.lineStyle(1.5, deco, 0.32).strokeTriangle(px - 5, y, px + 5, y, px + lean, y - h);
      }
    }
    g.fillStyle(0xffffff, 0.24);
    for (let k = 0; k < 6; k++) g.fillCircle(bx + hash(gx, gy, k + 560) * cell, by + hash(gx, gy, k + 570) * cell, 1);
  }

  private stormCell(g: Phaser.GameObjects.Graphics, gx: number, gy: number, bx: number, by: number, cell: number, deco: number) {
    // Rain puddles, scorched lightning scars and wind streaks.
    for (let k = 0; k < 2; k++) {
      if (hash(gx, gy, k + 600) < 0.45) continue;
      const x = bx + hash(gx, gy, k + 601) * cell;
      const y = by + hash(gx, gy, k + 604) * cell;
      const r = 18 + hash(gx, gy, k + 607) * 26;
      g.fillStyle(0x141c2c, 0.7);
      this.blob(g, gx, gy, x, y, r, 0.55, k + 610);
      g.fillPath();
      g.lineStyle(1, 0x9fb8ff, 0.18);
      this.blob(g, gx, gy, x, y, r, 0.55, k + 610);
      g.strokePath();
    }
    g.lineStyle(2, deco, 0.13);
    this.crack(g, gx, gy, bx + hash(gx, gy, 620) * cell, by + hash(gx, gy, 621) * cell, 70 + hash(gx, gy, 622) * 70, 630);
    g.lineStyle(1, 0xcfe0ff, 0.1);
    for (let k = 0; k < 5; k++) {
      const x = bx + hash(gx, gy, k + 640) * cell;
      const y = by + hash(gx, gy, k + 650) * cell;
      g.lineBetween(x, y, x + 14, y + 6);
    }
  }

  /** The Dune world: amber dune ridges, sand specks and the odd rock. */
  private duneCell(g: Phaser.GameObjects.Graphics, gx: number, gy: number, bx: number, by: number, cell: number, dune: number) {
    // Two dune ridges per cell, as gentle waves.
    for (let k = 0; k < 2; k++) {
      const sx = bx + hash(gx, gy, k) * cell * 0.6;
      const sy = by + hash(gx, gy, k + 3) * cell;
      const len = 120 + hash(gx, gy, k + 5) * 140;
      const amp = 8 + hash(gx, gy, k + 7) * 14;
      g.lineStyle(2, dune, 0.09 + hash(gx, gy, k + 9) * 0.05);
      g.beginPath();
      for (let i = 0; i <= 12; i++) {
        const x = sx + (len * i) / 12;
        const y = sy + Math.sin((i / 12) * Math.PI * 1.6 + k) * amp;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
    }
    // Sand specks and the odd rock.
    g.fillStyle(dune, 0.16);
    for (let k = 0; k < 6; k++) g.fillCircle(bx + hash(gx, gy, k + 11) * cell, by + hash(gx, gy, k + 17) * cell, 1.2);
    if (hash(gx, gy, 23) > 0.55) {
      const rx = bx + hash(gx, gy, 29) * cell;
      const ry = by + hash(gx, gy, 31) * cell;
      const rr = 8 + hash(gx, gy, 37) * 14;
      g.lineStyle(1.5, dune, 0.22);
      g.beginPath();
      for (let i = 0; i <= 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const k2 = 0.7 + hash(gx + i, gy, 41) * 0.4;
        const x = rx + Math.cos(a) * rr * k2;
        const y = ry + Math.sin(a) * rr * k2 * 0.7;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokePath();
    }
  }

  private drawRun(s: GameState) {
    const p = s.player;
    const sch = schemeOf(s.hero!);
    const accent = hex(sch.accent);
    const u = this.under;
    const o = this.over;
    const still = settings.reduceMotion;
    const stats = statsOf(s);

    // Under everything: pickup reach, fire, cones, bomb markers and shadows.
    u.lineStyle(1, hex(C.shard), 0.08).strokeCircle(p.x, p.y, stats.pickup);
    for (const f of s.fires) {
      const k = Math.min(1, f.ms / 600);
      u.fillStyle(0xff7a2e, 0.18 * k).fillCircle(f.x, f.y, f.r);
      u.fillStyle(0xffd36b, 0.22 * k).fillCircle(f.x, f.y, f.r * 0.5);
    }
    // Ground hazards: bog pools, embers, and warning rings that fill before a blast.
    for (const h of s.hazards) {
      if (h.kind === 'spore') {
        const k = Math.min(1, h.ms / 800);
        u.fillStyle(0x6a1f6a, 0.3 * k).fillCircle(h.x, h.y, h.r);
        u.lineStyle(1.5, 0xff7ad9, 0.3 * k).strokeCircle(h.x, h.y, h.r);
        u.fillStyle(0xff7ad9, 0.25 * k).fillCircle(h.x - h.r * 0.3, h.y - h.r * 0.1, 2).fillCircle(h.x + h.r * 0.35, h.y + h.r * 0.2, 1.6);
      } else if (h.kind === 'bog') {
        const k = Math.min(1, h.ms / 800);
        u.fillStyle(0x2f5a12, 0.35 * k).fillCircle(h.x, h.y, h.r);
        u.lineStyle(2, hex(C.beast), 0.35 * k).strokeCircle(h.x, h.y, h.r);
        u.fillStyle(hex(C.beast), 0.1 * k).fillCircle(h.x - h.r * 0.3, h.y - h.r * 0.2, h.r * 0.3);
      } else if (h.kind === 'ember') {
        const k = h.ms / h.maxMs;
        u.fillStyle(0xff7a2e, 0.28 * k).fillCircle(h.x, h.y, h.r);
        u.fillStyle(hex(C.ember), 0.4 * k).fillCircle(h.x, h.y, h.r * 0.45);
      } else if (h.warnMs > 0) {
        const total = h.kind === 'vent' ? VENT.warnMs : h.kind === 'stomp' ? SIEGE.stompWarn : h.kind === 'strike' ? STRIKE.warnMs : SIEGE.warnMs;
        const prog = Math.max(0, Math.min(1, 1 - h.warnMs / total));
        const color = h.kind === 'vent' ? 0xff6a3c : h.kind === 'shell' ? hex(C.ironLight) : h.kind === 'strike' ? 0xfff08a : 0xd6efff;
        u.lineStyle(2, color, 0.4 + 0.5 * prog).strokeCircle(h.x, h.y, h.r);
        u.fillStyle(color, 0.08 + 0.16 * prog).fillCircle(h.x, h.y, h.r * prog);
      }
    }
    // The side objective: its zone, spots, structures and the pilgrim; power-ups on the ground.
    drawObjectiveGround(u, s, still);
    for (const e of s.enemies) if (isStructure(e.kind)) drawStructure(u, e, s.time, still);
    for (const k of s.pickups) if (POWER_UPS.includes(k.kind as PowerUp)) drawPowerUp(u, k, s.time, still);
    // The knights: Vharn's Dread aura, Corvin's platform, foes turned to the hero's side.
    const dread = dreadRadius(s);
    if (dread > 0) {
      u.fillStyle(accent, 0.05).fillCircle(p.x, p.y, dread);
      u.lineStyle(1.5, accent, 0.3).strokeCircle(p.x, p.y, dread);
    }
    if (s.platform) {
      const pl = s.platform;
      u.fillStyle(0x1c2740, 0.85).fillCircle(pl.x, pl.y, pl.r);
      u.lineStyle(3, accent, 0.55).strokeCircle(pl.x, pl.y, pl.r);
      u.lineStyle(1, accent, 0.3).strokeCircle(pl.x, pl.y, pl.r - 8);
    }
    for (const e of s.enemies) if (e.charmMs > 0) u.lineStyle(2, accent, 0.75).strokeCircle(e.x, e.y, e.r + 5);
    // Elara Voss: her signal flag (a pole and a pennant in her colour) and the Diplomat's shield bubble.
    const bub = bubble(s);
    if (bub) {
      u.fillStyle(0x8fd0ff, 0.07).fillCircle(bub.x, bub.y, bub.r);
      u.lineStyle(2, 0x8fd0ff, 0.45).strokeCircle(bub.x, bub.y, bub.r);
    }
    if (s.flag) {
      const f = s.flag;
      const wave = still ? 0 : Math.sin(s.time / 160) * 2;
      u.lineStyle(2.5, 0xe6dac2, 0.95).lineBetween(f.x, f.y + 8, f.x, f.y - 30);
      u.fillStyle(accent, 0.95).fillTriangle(f.x, f.y - 30, f.x + 20, f.y - 24 + wave, f.x, f.y - 17);
      u.fillStyle(0xffd36b, 1).fillCircle(f.x, f.y - 31, 2.5);
      u.lineStyle(1, accent, 0.3 * (f.ms / f.maxMs)).strokeCircle(f.x, f.y, 160);
    }
    const coneLen = suppressorLength(s);
    if (coneLen > 0) {
      const half = suppressorHalf(s);
      u.fillStyle(accent, 0.1);
      u.slice(p.x, p.y, coneLen, p.aim - half, p.aim + half, false).fillPath();
      u.lineStyle(1.5, accent, 0.35);
      u.slice(p.x, p.y, coneLen, p.aim - half, p.aim + half, false).strokePath();
    }
    for (const b of s.bombs) {
      const prog = 1 - b.ms / b.maxMs;
      const color = b.kind === 'crate' || b.kind === 'orbital' ? hex(C.heal) : b.kind === 'wreck' || b.kind === 'ship' ? accent : 0xffb347;
      u.lineStyle(1.5, color, 0.25 + 0.4 * prog).strokeCircle(b.x, b.y, b.r);
      u.fillStyle(color, 0.06 + 0.1 * prog).fillCircle(b.x, b.y, b.r * prog);
    }

    // Pickups and shards.
    const pk = this.pools.pickups;
    for (const sh of s.shards) pk.next(sh.value >= 5 ? 'rb-shard-big' : 'rb-shard', sh.x, sh.y);
    for (const k of s.pickups) {
      if (POWER_UPS.includes(k.kind as PowerUp)) continue;
      pk.next(k.kind === 'chest' ? 'rb-chest' : k.kind === 'credits' ? 'rb-credits' : 'rb-medkit', k.x, k.y);
    }
    // The objective's props: the wreck Oom lifts, the escorted bot, the frozen troopers.
    const ob = s.objective;
    if (ob?.id === 'lift') pk.next('rb-wreck', ob.x, ob.y - 16 * Math.min(1, ob.done / ob.goal)).setScale(1.6);
    if (ob?.id === 'escort' && ob.ward) pk.next('rb-escort', ob.ward.x, ob.ward.y).setScale(1.2);
    if (ob?.id === 'thaw') {
      for (const q of ob.points) {
        if (q.ms > OBJ_MISC.standMs.thaw) continue;
        pk.next('rb-trooper', q.x, q.y).setOrigin(HERO_ORIGIN.x, HERO_ORIGIN.y).setTint(0x9fd8ff).setAlpha(0.85);
      }
    }
    for (const b of s.bombs) {
      if (b.kind === 'charge') pk.next('rb-charge', b.x, b.y);
      else if (b.kind === 'grenade' || b.kind === 'frag') {
        const t = 1 - b.ms / b.maxMs;
        const arc = Math.sin(Math.min(1, t * 1.4) * Math.PI) * 40;
        const k = Math.min(1, t * 1.4);
        pk.next('rb-grenade', b.fromX + (b.x - b.fromX) * k, b.fromY + (b.y - b.fromY) * k - arc).setScale(b.kind === 'frag' ? 1.4 : 1);
      } else if (b.kind === 'crate' || b.kind === 'orbital' || b.kind === 'ship') {
        const t = b.ms / b.maxMs;
        pk.next(b.kind === 'ship' ? 'rb-ship' : b.kind === 'orbital' ? 'rb-pod' : 'rb-crate', b.x, b.y - t * 260).setAlpha(1 - t * 0.5);
      } else if (b.kind === 'wreck') {
        // Wreckage Oom lifts and throws: up off the ground, then down on the swarm.
        const t = 1 - b.ms / b.maxMs;
        pk.next('rb-wreck', b.fromX + (b.x - b.fromX) * t, b.fromY + (b.y - b.fromY) * t - Math.sin(t * Math.PI) * 70).setRotation(still ? 0 : t * 4);
      }
    }

    // Bots.
    const en = this.pools.enemies;
    const bossId = PLANETS[s.planet].boss;
    for (const e of s.enemies) {
      if (isStructure(e.kind)) continue;
      let key = `rb-${e.kind}${e.elite ? '-elite' : ''}`;
      if (e.kind === 'boss') key = bossId === 'grinder' ? 'rb-boss' : `rb-boss-${bossId}${e.phase2 && bossId === 'champion' ? '-burning' : ''}`;
      else if (e.kind === 'rollerbomb') key = `rb-roller${e.elite ? '-elite' : ''}${e.mode !== 'walk' ? '-armed' : ''}`;
      const im = en.next(key, e.x, e.y);
      const toHero = Math.atan2(p.y - e.y, p.x - e.x);
      if (e.kind === 'boss' && (bossId === 'grinder' || bossId === 'siege' || bossId === 'scrapking')) im.setRotation(toHero);
      else if (e.kind === 'rollerbomb' && e.mode === 'rush' && !still) im.setRotation(s.time / 80);
      else if (e.kind !== 'clanker' && e.kind !== 'rollerbomb') im.setFlipX(Math.cos(e.kind === 'knight' ? e.facing : toHero) < 0);
      if (e.flashMs > 0 && !still) im.setScale(1.15);
      if (e.stunMs > 0) im.setAlpha(0.6);
      // Held in a Grip: lifted off the ground.
      if (e.gripMs > 0) im.setY(e.y - 12).setAlpha(0.9);
    }

    // Allies.
    const al = this.pools.allies;
    for (const a of s.allies) {
      const key = ALLY_KEYS[a.kind];
      const im = al.next(key, a.x, a.y);
      if (a.kind === 'fighter' || a.kind === 'squadron') im.setRotation(a.aim);
      else if (a.kind === 'spirit') im.setAlpha(0.8).setFlipX(Math.cos(a.aim) < 0);
      else if (a.kind === 'puppet') {
        im.setFlipX(Math.cos(a.aim) < 0).setScale(a.elite ? 1.5 : 1);
        if (a.lifeMs < 1500) im.setAlpha(0.4 + 0.6 * (a.lifeMs / 1500));
      }
      if (HERO_LIKE.includes(a.kind)) im.setOrigin(HERO_ORIGIN.x, HERO_ORIGIN.y).setFlipX(Math.cos(a.aim) < 0);
      else if (a.kind === 'escort' || a.kind === 'command') im.setFlipX(Math.cos(a.aim) < 0);
      else if (a.kind === 'bike') im.setRotation(a.aim);
      else if (a.kind === 'shieldbot') im.setRotation(still ? 0 : s.time / 120);
      else if (a.kind === 'spare') {
        im.setFlipX(Math.cos(a.aim) < 0);
        if (a.lifeMs < 1500) im.setAlpha(0.4 + 0.6 * (a.lifeMs / 1500));
      }
    }

    const bob = p.moving && !still ? Math.sin(s.time / 90) * 1.5 : 0;
    if (s.hero === 'triad') {
      // Triad-77 is its bots: each on its shadow, a fallen one as a wreck with its rebuild ring.
      this.hero.setVisible(false);
      for (const d of s.bots) {
        this.pools.pickups.next('rb-shadow', d.x, d.y + 15).setScale(0.55);
        const im = al.next(d.hp > 0 ? 'rb-bot' : 'rb-bot-down', d.x, d.y + (d.hp > 0 ? bob : 0));
        im.setFlipX(Math.cos(d.aim) < 0);
        if (d.hp <= 0) {
          const k = Math.max(0, Math.min(1, 1 - d.rebuildMs / rebuildTime(s)));
          o.lineStyle(2, accent, 0.8).beginPath().arc(d.x, d.y, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k).strokePath();
        }
      }
    } else {
      // The hero, on its shadow.
      this.pools.pickups.next('rb-shadow', p.x, p.y + 27);
      const face = p.moving ? p.facing : p.aim;
      const look = heroKey(s.hero!, heroVariant(s));
      if (this.hero.texture.key !== look) this.hero.setTexture(look);
      this.hero.setVisible(true).setPosition(p.x, p.y + bob).setFlipX(Math.cos(face) < 0).setAlpha(p.dashMs > 0 ? 0.6 : 1);
    }

    // Bolts.
    const bo = this.pools.bolts;
    for (const b of s.bullets) {
      if (b.spin) {
        // A thrown blade spins as it flies.
        bo.next(bladeKey(b.color as HeroId), b.x, b.y).setRotation(still ? Math.atan2(b.vy, b.vx) : s.time / 45);
        continue;
      }
      const im = bo.next(`rb-bolt-${b.color}`, b.x, b.y);
      im.setRotation(Math.atan2(b.vy, b.vx));
    }

    // Over everything: shields, blasts and rings.
    if (s.hero === 'tr9' && (s.ranks['riot-shield'] ?? 0) > 0) {
      const half = shieldHalf(s);
      o.lineStyle(5, accent, 0.25).beginPath().arc(p.x, p.y, HERO_R + 12, p.facing - half, p.facing + half).strokePath();
      o.lineStyle(2.5, accent, 0.9).beginPath().arc(p.x, p.y, HERO_R + 12, p.facing - half, p.facing + half).strokePath();
    }
    if (s.capstones.includes('phalanx')) {
      for (const spot of phalanxSpots(s)) {
        o.lineStyle(3, accent, 0.9).beginPath().arc(spot.x, spot.y, 14, spot.a - 1, spot.a + 1).strokePath();
      }
    }
    if (p.sigActiveMs > 0) {
      const color = s.hero === 'tr9' ? accent : hex(sch.bolt);
      o.lineStyle(6, color, 0.15).strokeCircle(p.x, p.y, 30);
      o.lineStyle(2, color, 0.8).strokeCircle(p.x, p.y, 30);
    }
    if (p.hurtMs > 0) o.lineStyle(2, hex(C.danger), Math.min(1, p.hurtMs / 450) * 0.8).strokeCircle(p.x, p.y, 24);
    if (isKnight(s.hero!)) this.drawKnight(s);
    // Triad-77's Uplink: thin lines from the command bot to every standing bot.
    if (s.hero === 'triad') {
      const cmd = s.allies.find((a) => a.kind === 'command');
      if (cmd) for (const d of s.bots) if (d.hp > 0) o.lineStyle(1, 0x9fe8ff, 0.45).lineBetween(cmd.x, cmd.y, d.x, d.y);
    }
    // Slowed: a lime ring at the feet.
    if (p.slowMs > 0) o.lineStyle(2, hex(C.beast), 0.6).strokeCircle(p.x, p.y + 20, 15);
    // Knights' shields, and the dash lines of knights and the Champion about to strike.
    for (const e of s.enemies) {
      if (e.kind === 'knight') {
        if (e.mode === 'walk' && e.guardMs <= 0) {
          o.lineStyle(3, hex(C.hollow), 0.9).beginPath().arc(e.x, e.y, e.r + 6, e.facing - 1.05, e.facing + 1.05).strokePath();
        } else if (e.mode === 'arm') {
          o.lineStyle(2, hex(C.ember), 0.5).lineBetween(e.x, e.y, e.x + Math.cos(e.facing) * 180, e.y + Math.sin(e.facing) * 180);
        }
      } else if (e.kind === 'boss' && BOSSES[bossId].mech === 'champion' && e.mode === 'arm') {
        const a = Math.atan2(e.aimY - e.y, e.aimX - e.x);
        const len = Math.hypot(e.aimX - e.x, e.aimY - e.y) + 140;
        const c = bossId === 'champion' ? 0xff8a3c : 0xfff08a;
        o.lineStyle(10, c, 0.12).lineBetween(e.x, e.y, e.x + Math.cos(a) * len, e.y + Math.sin(a) * len);
        o.lineStyle(2, c, 0.8).lineBetween(e.x, e.y, e.x + Math.cos(a) * len, e.y + Math.sin(a) * len);
      }
    }
    // Rings of fire (or of sparks, from the Storm Herald): burning arcs with gaps to slip through.
    const spark = bossId === 'stormherald';
    for (const h of s.hazards) {
      if (h.kind !== 'ring') continue;
      const seg = Math.PI / CHAMPION.ringGaps;
      const k = Math.min(1, h.ms / 500);
      for (let i = 0; i < CHAMPION.ringGaps * 2; i++) {
        const a0 = h.angle + i * seg;
        if (inRingGap(h, a0 + seg / 2)) continue;
        o.lineStyle(12, spark ? 0xffe45c : 0xff6a3c, 0.15 * k).beginPath().arc(h.x, h.y, h.r, a0, a0 + seg).strokePath();
        o.lineStyle(4, spark ? 0xfff8c8 : 0xffb347, 0.9 * k).beginPath().arc(h.x, h.y, h.r, a0, a0 + seg).strokePath();
      }
    }
    for (const b of s.blasts) {
      const t = 1 - b.ms / b.maxMs;
      const r = b.r * (0.35 + 0.65 * Math.min(1, t * 1.6));
      const c = hex(b.color);
      // A bomb's screen-wide flash is left out with reduced motion; its ring stays.
      if (!(still && b.r >= 500)) o.fillStyle(c, 0.16 * (1 - t)).fillCircle(b.x, b.y, r);
      o.lineStyle(8, c, 0.18 * (1 - t)).strokeCircle(b.x, b.y, r);
      o.lineStyle(2.5, c, 0.9 * (1 - t)).strokeCircle(b.x, b.y, r);
    }

    // Floating words: unlocks, chests, the boss (only while fighting, so they never cross a panel).
    const pops = s.phase === 'run' ? s.pops : [];
    pops.forEach((pop, i) => {
      let t = this.popTexts[i];
      if (!t) {
        t = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '15px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5).setDepth(DEPTH.pops);
        this.popTexts.push(t);
      }
      const age = 2200 - pop.ms;
      t.setText(pop.text).setColor(pop.color).setVisible(true);
      t.setPosition(p.x, p.y - 44 - i * 20 - (still ? 0 : age * 0.012)).setAlpha(Math.min(1, pop.ms / 400));
    });
    for (let i = pops.length; i < this.popTexts.length; i++) this.popTexts[i].setVisible(false);
  }

  /** The knights' blades in the air: orbits, swings, lightning, grips, marks, the barrier and Kresh's legs. */
  private drawKnight(s: GameState) {
    const o = this.over;
    const p = s.player;
    const blade = hex(bladeColor(s));
    for (const b of orbitBlades(s)) {
      o.lineStyle(8, blade, 0.22).lineBetween(b.x1, b.y1, b.x2, b.y2);
      o.lineStyle(3.5, blade, 0.95).lineBetween(b.x1, b.y1, b.x2, b.y2);
      o.lineStyle(1.2, 0xffffff, 0.9).lineBetween(b.x1, b.y1, b.x2, b.y2);
    }
    for (const f of s.slashes) {
      const k = f.ms / f.maxMs;
      const c = hex(f.color);
      const r = f.r * (1.08 - 0.08 * k);
      if (f.half >= Math.PI) {
        o.lineStyle(10, c, 0.14 * k).strokeCircle(f.x, f.y, r);
        o.lineStyle(2.5, c, 0.85 * k).strokeCircle(f.x, f.y, r);
      } else {
        o.lineStyle(12, c, 0.16 * k).beginPath().arc(f.x, f.y, r * 0.85, f.a - f.half, f.a + f.half).strokePath();
        o.lineStyle(3, c, 0.9 * k).beginPath().arc(f.x, f.y, r, f.a - f.half, f.a + f.half).strokePath();
        o.lineStyle(1.2, 0xffffff, 0.8 * k).beginPath().arc(f.x, f.y, r, f.a - f.half * 0.7, f.a + f.half * 0.7).strokePath();
      }
    }
    for (const z of s.zaps) {
      // A jagged bolt between the points, its kinks from a hash so drawing never touches Math.random.
      const k = z.ms / z.maxMs;
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i + 3 < z.pts.length; i += 2) {
        const [x1, y1, x2, y2] = [z.pts[i], z.pts[i + 1], z.pts[i + 2], z.pts[i + 3]];
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
        const nx = -(y2 - y1) / len;
        const ny = (x2 - x1) / len;
        const n = Math.max(2, Math.round(len / 22));
        for (let j = 0; j < n; j++) {
          const t = j / n;
          const off = j === 0 ? 0 : (hash(z.id, i * 10 + j) - 0.5) * 18;
          pts.push(new Phaser.Math.Vector2(x1 + (x2 - x1) * t + nx * off, y1 + (y2 - y1) * t + ny * off));
        }
        if (i + 4 >= z.pts.length) pts.push(new Phaser.Math.Vector2(x2, y2));
      }
      const c = hex(z.color);
      o.lineStyle(7, c, 0.2 * k).strokePoints(pts);
      o.lineStyle(2.5, c, 0.95 * k).strokePoints(pts);
      o.lineStyle(1, 0xffffff, 0.9 * k).strokePoints(pts);
    }
    const apex = s.capstones.includes('apex-predator');
    for (const e of s.enemies) {
      if (e.gripMs > 0) o.lineStyle(2, blade, 0.8).strokeCircle(e.x, e.y - 12, e.r + 6);
      if (e.id === s.mark || (apex && (e.elite || e.kind === 'boss'))) {
        // The Hunt's mark: a ring with four ticks, in Kresh's violet.
        const r = e.r + 10;
        o.lineStyle(2, blade, 0.9).strokeCircle(e.x, e.y, r);
        for (let i = 0; i < 4; i++) {
          const a = (i * Math.PI) / 2 + Math.PI / 4;
          o.lineBetween(e.x + Math.cos(a) * (r + 3), e.y + Math.sin(a) * (r + 3), e.x + Math.cos(a) * (r + 9), e.y + Math.sin(a) * (r + 9));
        }
      }
    }
    if (p.barrier > 0) {
      o.lineStyle(6, blade, 0.12).strokeCircle(p.x, p.y, 27);
      o.lineStyle(1.5, blade, 0.6).strokeCircle(p.x, p.y, 27);
    }
    if (s.hero === 'kresh' && p.rises > 0) {
      // Rebuilt: mechanical legs.
      o.lineStyle(2.5, 0xc9ccd6, 0.95);
      for (const side of [-1, 1]) {
        o.lineBetween(p.x + side * 5, p.y + 18, p.x + side * 14, p.y + 24);
        o.lineBetween(p.x + side * 14, p.y + 24, p.x + side * 10, p.y + 32);
      }
    }
  }

  private drawHud(s: GameState) {
    const g = this.hud;
    g.clear();
    const playing = s.hero !== null;
    for (const t of Object.values(this.texts)) t.setVisible(playing);
    if (!playing) {
      this.objTexts?.name.setVisible(false);
      this.objTexts?.hint.setVisible(false);
      return;
    }
    const p = s.player;
    const sch = schemeOf(s.hero!);
    // XP across the top.
    g.fillStyle(0x0d1426, 0.9).fillRect(XP_BAR.x, XP_BAR.y, XP_BAR.w, XP_BAR.h);
    g.fillStyle(hex(C.xp), 1).fillRect(XP_BAR.x, XP_BAR.y, XP_BAR.w * Math.min(1, s.xp / s.xpNext), XP_BAR.h);
    // Health.
    const hpK = Math.max(0, p.hp / p.maxHp);
    g.fillStyle(0x0d1426, 0.85).fillRoundedRect(HP_BAR.x - 2, HP_BAR.y - 2, HP_BAR.w + 4, HP_BAR.h + 4, 4);
    g.fillStyle(hpK > 0.35 ? hex(C.hp) : hex(C.danger), 1).fillRoundedRect(HP_BAR.x, HP_BAR.y, Math.max(2, HP_BAR.w * hpK), HP_BAR.h, 3);
    g.lineStyle(1, hex(C.hp), 0.5).strokeRoundedRect(HP_BAR.x - 2, HP_BAR.y - 2, HP_BAR.w + 4, HP_BAR.h + 4, 4);
    // The knights' meters: Kael's Temper under the bar, a barrier over it, Joren's Edge count.
    let extra = '';
    if (s.hero === 'kael') {
      g.fillStyle(hex(bladeColor(s)), 1).fillRect(HP_BAR.x, HP_BAR.y + HP_BAR.h + 1, HP_BAR.w * (p.temper / 100), 3);
      extra = `   ·   ${t('hudTemper', { n: Math.round(p.temper) })}`;
    } else if (s.hero === 'joren') {
      const every = s.capstones.includes('royal-fury') ? 5 : 10;
      extra = `   ·   ${t('hudEdge', { n: p.hits % every, of: every })}`;
    }
    if (s.hero === 'triad') extra = `   ·   ${t('hudBots', { n: s.bots.filter((d) => d.hp > 0).length, of: s.bots.length })}`;
    if (p.barrier > 0) {
      g.fillStyle(hex(sch.accent), 0.9).fillRect(HP_BAR.x, HP_BAR.y, HP_BAR.w * Math.min(1, p.barrier / p.maxHp), 4);
      extra += `   ·   ${t('hudBarrier', { n: Math.ceil(p.barrier) })}`;
    }
    // Power-ups running.
    if (s.lureMs > 0) extra += `   ·   ${t('buffLure', { n: Math.ceil(s.lureMs / 1000) })}`;
    if (s.overdriveMs > 0) extra += `   ·   ${t('buffOverdrive', { n: Math.ceil(s.overdriveMs / 1000) })}`;
    if (s.shieldHits > 0) extra += `   ·   ${t('buffShield', { n: s.shieldHits })}`;
    this.texts.hp.setText(`${Math.ceil(p.hp)} / ${p.maxHp}   ·   ${t(PLANETS[s.planet].foes, { n: s.kills })}${extra}`);
    // The kit held.
    const lines = Object.entries(s.ranks).map(([id, rank]) => {
      const pips = '●'.repeat(rank) + '○'.repeat(MAX_TIER - rank);
      return `${pips}  ${t(UPGRADES[id].name)}`;
    });
    this.texts.kit.setText(lines.join('\n'));
    if (lines.length) {
      const b = this.texts.kit.getBounds();
      g.fillStyle(0x070b16, 0.6).fillRoundedRect(KIT.x - 6, KIT.y - 4, b.width + 12, b.height + 8, 6);
    }
    // Clock and level.
    const boss = s.enemies.find((e) => e.kind === 'boss');
    if (s.arena) this.texts.timer.setText(clock(ARENA_MS - s.time)).setColor(C.elite);
    else this.texts.timer.setText(s.bossSpawned ? t('bossTimer') : clock(Math.min(s.time, RUN_MS))).setColor(s.bossSpawned ? C.boss : C.text);
    this.texts.level.setText(t('levelTag', { n: s.level }));
    const where = s.arena ? t('eliteArena') : planetLabel(s.stage, s.planet);
    const tag = s.week >= 0 ? t('weeklyTag', { label: where }) : s.heat > 0 ? t('heatTag', { label: where, n: s.heat }) : where;
    this.texts.planet.setText(tag).setColor(s.arena ? C.elite : PLANETS[s.planet].ground.deco);
    this.texts.credits.setText(t('credits', { n: s.credits }));
    this.texts.boss.setVisible(!!boss);
    if (boss) {
      this.texts.boss.setText(t(BOSSES[PLANETS[s.planet].boss].bar));
      g.fillStyle(0x0d1426, 0.9).fillRect(BOSS_BAR.x, BOSS_BAR.y, BOSS_BAR.w, BOSS_BAR.h);
      g.fillStyle(hex(C.boss), 1).fillRect(BOSS_BAR.x, BOSS_BAR.y, BOSS_BAR.w * Math.max(0, boss.hp / boss.maxHp), BOSS_BAR.h);
      g.lineStyle(1, hex(C.boss), 0.6).strokeRect(BOSS_BAR.x, BOSS_BAR.y, BOSS_BAR.w, BOSS_BAR.h);
    }
    this.drawObjectiveHud(s);
    // The signature button: a ring that fills as it charges.
    const hero = HEROES[s.hero!];
    const accent = hex(sch.accent);
    const total = hero.signature.cooldownMs * statsOf(s).sigCooldown;
    const charge = 1 - Math.min(1, p.sigMs / total);
    const ready = p.sigMs <= 0;
    const { x, y, r } = SIG_BUTTON;
    g.fillStyle(0x0d1426, 0.8).fillCircle(x, y, r);
    g.lineStyle(4, 0x2a3550, 1).strokeCircle(x, y, r - 4);
    g.lineStyle(4, accent, ready ? 1 : 0.7).beginPath().arc(x, y, r - 4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * charge).strokePath();
    if (ready) g.lineStyle(10, accent, 0.18).strokeCircle(x, y, r - 2);
    this.texts.sig.setText(t(hero.signature.name)).setColor(ready ? C.text : C.muted);
    // Longer names (German) shrink to stay inside the ring.
    this.texts.sig.setScale(Math.min(1, (2 * r - 18) / this.texts.sig.width));
    this.texts.sigKey.setText(ready ? t('spaceKey') : t('seconds', { n: Math.ceil(p.sigMs / 1000) }));
    // The floating stick under a steering finger: a faint ring and a knob in the hero's accent.
    const st = this.stick;
    if (st) {
      const d = Math.hypot(st.x - st.ox, st.y - st.oy);
      const k = d > STICK.r ? STICK.r / d : 1;
      const kx = st.ox + (st.x - st.ox) * k;
      const ky = st.oy + (st.y - st.oy) * k;
      g.fillStyle(0x0d1426, 0.35).fillCircle(st.ox, st.oy, STICK.r);
      g.lineStyle(3, accent, 0.45).strokeCircle(st.ox, st.oy, STICK.r);
      g.fillStyle(accent, 0.7).fillCircle(kx, ky, STICK.knob);
      g.lineStyle(2, 0xffffff, 0.6).strokeCircle(kx, ky, STICK.knob);
    }
  }

  /** The side objective: its name, progress and time left under the clock, its hint, and an arrow at the edge toward it. */
  private drawObjectiveHud(s: GameState) {
    const o = s.objective;
    const on = !!o && s.phase === 'run';
    this.objTexts?.name.setVisible(on);
    this.objTexts?.hint.setVisible(on);
    if (!o || !on) return;
    // Made when the first objective comes: a text makes a texture, and Phaser draws on Math.random
    // for its id, which would shift the seeded first minute the playthrough plays.
    this.objTexts ??= {
      name: this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '14px', color: '#7fe3ff', fontStyle: 'bold' }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1),
      hint: this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11.5px', color: C.muted }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH.hud + 1),
    };
    const { name, hint } = this.objTexts;
    name.setPosition(OBJECTIVE_HUD.x, OBJECTIVE_HUD.y);
    hint.setPosition(OBJECTIVE_HUD.x, OBJECTIVE_HUD.y + 19);
    const g = this.hud;
    const timed = ['defend', 'dropzone', 'lift', 'pilgrim', 'zone'].includes(o.id);
    let progress = timed
      ? t('objSeconds', { n: Math.floor(o.done / 1000), of: Math.round(o.goal / 1000) })
      : o.goal > 1 && o.id !== 'unbroken'
        ? t('objCount', { n: Math.min(o.done, o.goal), of: o.goal })
        : '';
    if (o.ward) progress = [progress, t('objHealth', { n: Math.max(0, Math.round((100 * o.ward.hp) / o.ward.maxHp)) })].filter(Boolean).join('  ·  ');
    if (o.id === 'unbroken') progress = t('objCount', { n: Math.round(Math.max(0, s.damageTaken - o.base)), of: o.goal });
    const parts = [t(objectiveName(o.id)), progress, t('objTime', { n: Math.max(0, Math.ceil(o.ms / 1000)) })].filter(Boolean);
    name.setText(parts.join('   ·   '));
    hint.setText(t(objectiveHint(o.id), { n: o.goal }));
    const w = Math.max(name.width, hint.width) + 24;
    g.fillStyle(0x070b16, 0.6).fillRoundedRect(OBJECTIVE_HUD.x - w / 2, OBJECTIVE_HUD.y - 4, w, 46, 8);
    g.fillStyle(OBJ_COLOR, 0.8).fillRect(OBJECTIVE_HUD.x - w / 2 + 8, OBJECTIVE_HUD.y + 37, (w - 16) * Math.max(0, o.ms / o.maxMs), 2);
    // The arrow at the screen's edge when the marker is off screen.
    const to = objectiveTarget(s);
    if (!to) return;
    const dx = to.x - s.player.x;
    const dy = to.y - s.player.y;
    const hw = SCREEN.w / 2 - 36;
    // Clear of the objective's lines at the top and the signature button's corner.
    const hh = SCREEN.h / 2 - (dy < 0 ? 110 : 60);
    if (Math.abs(dx) < hw && Math.abs(dy) < hh) return;
    const k = Math.min(hw / Math.max(1, Math.abs(dx)), hh / Math.max(1, Math.abs(dy)));
    const ax = CENTER.x + dx * k;
    const ay = CENTER.y + dy * k;
    const a = Math.atan2(dy, dx);
    const tip = (d: number, off: number) => [ax + Math.cos(a + off) * d, ay + Math.sin(a + off) * d] as const;
    const [x1, y1] = tip(14, 0);
    const [x2, y2] = tip(10, 2.4);
    const [x3, y3] = tip(10, -2.4);
    g.fillStyle(0x070b16, 0.6).fillCircle(ax, ay, 16);
    g.fillStyle(OBJ_COLOR, 0.95).fillTriangle(x1, y1, x2, y2, x3, y3);
  }
}
