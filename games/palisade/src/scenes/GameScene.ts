import { settings } from '../../../../shared/settings';
import Phaser from 'phaser';
import { ui } from '../../../../shared/audio';
import { formatNumber } from '../../../../shared/i18n';
import { sfx } from '../audio/sfx';
import { FIGURES, foeTexture, guardTexture } from '../art/characters';
import { bossNodeTexture, relicTexture } from '../art/icons';
import { fit } from '../art/lowpoly';
import { BAR, BOSS_BARS, FIRE, GOLD, SLATE, STORM, XP } from '../art/palette';
import { AIMS, nextAim } from '../game/aim';
import { TRAITS } from '../game/elites';
import { ENEMIES } from '../game/enemies';
import { STAKE_FRONT, STAKE_HP, repairCost, type FortId } from '../game/forts';
import { GUARDS, type GuardKind } from '../game/guards';
import { HEAT_UNLOCKED, MAX_HEAT, WIN_WAVE } from '../game/heat';
import type { LegacyId } from '../game/legacy';
import { MARCH_STARTS, canMarch } from '../game/march';
import { OMENS, omenEffects } from '../game/omens';
import { RELICS, SETS, setComplete, type RelicId } from '../game/relics';
import { ROADS, type RoadId } from '../game/roads';
import { clearProgress, loadAim, loadAutoPick, loadFound, loadProgress, loadSpeed, saveAim, saveAutoPick, saveFound, saveProgress, saveSpeed } from '../game/save';
import {
  CALTROP_PATCH,
  RAIN_FALL_MS,
  RAIN_RING,
  canBuyFort,
  canFortify,
  canRepair,
  canRetire,
  crowdSpot,
  decideOmen,
  fieldSpot,
  fightAgain,
  fortify,
  held,
  hire,
  keepFighting,
  loose,
  pick,
  pickRoad,
  rainRingOf,
  reoffer,
  repair,
  retire,
  rollLegacyRelic,
  setAim,
  startHeat,
  strew,
  tick,
  train,
} from '../game/sim';
import {
  BARRICADE_FRONT,
  FIELD,
  GUARD_SLOTS,
  SPAWN_X,
  freshProgress,
  newRun,
  progressOf,
  stats,
  streakBonus,
  xpToNext,
  type Enemy,
  type GameState,
} from '../game/state';
import { FILLERS, UPGRADES, type UpgradeId } from '../game/upgrades';
import { isBossWave, waveTrack } from '../game/waves';
import { FortifyPanel } from '../ui/FortifyPanel';
import { HirePanel } from '../ui/HirePanel';
import { LegacyPanel } from '../ui/LegacyPanel';
import { LevelUp } from '../ui/LevelUp';
import { OmenCard } from '../ui/OmenCard';
import { RoadChoice } from '../ui/RoadChoice';
import { chamferPts, drawPanel, makeButton, textStyle } from '../ui/panel';
import { t } from '../i18n';
import { SkillBook } from '../ui/SkillBook';
import { BattleSounds } from './BattleSounds';
import { checkTrophies } from '../trophies/check';
import { trophies } from '../trophies';
import { award } from '../../../../shared/trophies';
import { viewFrame } from '../../../../shared/scaling';
import { AIM, BARRICADE, BARRICADE_BAR, BARRICADE_TIP_W, BOSS_BAR, CALTROPS, FORTIFY, GUARD_HIT, HEAT, HERO_FEET, HUD_HEIGHT, MARCH, OMEN_CHIP, RAIN, RAIN_HINT, REPAIR, ROAR_CHIP, SEEN, SPEED, STREAK, TRACK, UI_DEPTH, VIEW, XP_BAR, placeHud } from './layout';

/** Longest simulated step, so a backgrounded tab doesn't jump the battle forward. */
const MAX_STEP_MS = 250;
/** How long a foe takes for one stride of its walk, in milliseconds. */
const STRIDE_MS = 360;
const HP_BAR_W = 32;
/** How far a foe walks from where it comes on before it is fully seen. */
const SPAWN_FADE = 36;
/** Where the aiming arc leaves each button. */
const ARC_FROM = { rain: { x: RAIN.x + 20, y: RAIN.y - 16 }, caltrops: { x: CALTROPS.x + 16, y: CALTROPS.y - 12 } };
/** How high a harpy flies over its shadow on the road. */
const FLY_HEIGHT = 60;

type V = Phaser.Math.Vector2;
const v = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

export class GameScene extends Phaser.Scene {
  /** The run being played; read by the playthrough test. */
  state!: GameState;
  /** The level-up cards; the playthrough test reads where they are to tap one. */
  levelUp!: LevelUp;
  /** The skill book, behind a button in the top bar. */
  skillBook!: SkillBook;
  /** Every upgrade a level-up has offered at least once: the skill book's filled pages. */
  found = new Set<UpgradeId>();
  /** The road of ten waves shown on the wave track; read by the playthrough test. */
  track = waveTrack(1);
  /** Where the Arrow Rain button is, to drag it from; read by the playthrough test. */
  rainSpot = { x: RAIN.x, y: RAIN.y };
  /** Where Arrow Rain (or the caltrops, see `aimKind`) is being dragged to, or null while neither is aimed. */
  aim: { x: number; y: number } | null = null;
  /** Which active is being dragged. */
  aimKind: 'rain' | 'caltrops' = 'rain';
  /** Where the caltrops button is, to drag it from. */
  caltropsSpot = { x: CALTROPS.x, y: CALTROPS.y };
  /** The road cards after a boss. */
  roadChoice!: RoadChoice;
  /** The panel a guard slot opens to hire or train a guard. */
  hirePanel!: HirePanel;
  /** The panel the "Fortify" button opens during a break. */
  fortifyPanel!: FortifyPanel;
  /** The omen card during a break from wave 4. */
  omenCard!: OmenCard;
  /** The legacy cards when the hero retires. */
  legacyPanel!: LegacyPanel;
  /** The wave the next run starts on, picked on the game-over panel's "Start at" row (a forced march). */
  startWave = 1;
  /** The relic the "A first relic" legacy card offers, rolled when the retire panel opens. */
  private legacyRelic: RelicId = 'crown';
  private repairBg!: Phaser.GameObjects.Graphics;
  private repairText!: Phaser.GameObjects.Text;
  private omenText!: Phaser.GameObjects.Text;
  private nightG!: Phaser.GameObjects.Graphics;
  private marchPicks: { bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Zone }[] = [];
  private retireButtons: Phaser.GameObjects.Container[] = [];
  private retireNote!: Phaser.GameObjects.Text;
  private eliteLabels = new Map<number, Phaser.GameObjects.Text>();
  private aimBg!: Phaser.GameObjects.Graphics;
  private aimText!: Phaser.GameObjects.Text;
  private fortifyBg!: Phaser.GameObjects.Graphics;
  private fortifyText!: Phaser.GameObjects.Text;
  private heatText!: Phaser.GameObjects.Text;
  private roarText!: Phaser.GameObjects.Text;
  private fortG!: Phaser.GameObjects.Graphics;
  private fortLabel!: Phaser.GameObjects.Text;
  private won!: Phaser.GameObjects.Container;
  private wonText!: Phaser.GameObjects.Text;
  private wonNext!: Phaser.GameObjects.Container;
  private wonNextText!: Phaser.GameObjects.Text;
  private heatPicks: { bg: Phaser.GameObjects.Graphics; text: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Zone }[] = [];
  private foes = new Map<number, Phaser.GameObjects.Image>();
  private missiles = new Map<number, Phaser.GameObjects.Image>();
  private pops = new Map<number, Phaser.GameObjects.Text[]>();
  private rainArrows = new Map<number, Phaser.GameObjects.Image[]>();
  private hero!: Phaser.GameObjects.Image;
  private barricade!: Phaser.GameObjects.Image;
  private bars!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private glow!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  /** The tooltip shown while the pointer is over the barricade's health bar. */
  private barricadeTip!: Phaser.GameObjects.Container;
  private barricadeTipText!: Phaser.GameObjects.Text;
  private trackG!: Phaser.GameObjects.Graphics;
  private aimG!: Phaser.GameObjects.Graphics;
  private waveText!: Phaser.GameObjects.Text;
  private foesText!: Phaser.GameObjects.Text;
  private slainText!: Phaser.GameObjects.Text;
  private bestText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private xpText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private bossName!: Phaser.GameObjects.Text;
  private trackTitle!: Phaser.GameObjects.Text;
  private trackNote!: Phaser.GameObjects.Text;
  private trackNumber!: Phaser.GameObjects.Text;
  private trackBoss!: Phaser.GameObjects.Image;
  private trackChest!: Phaser.GameObjects.Image;
  private rainButton!: Phaser.GameObjects.Image;
  private rainBadge!: Phaser.GameObjects.Text;
  private rainHint!: Phaser.GameObjects.Text;
  private caltropsButton!: Phaser.GameObjects.Image;
  private caltropsBadge!: Phaser.GameObjects.Text;
  private caltropPieces = new Map<number, Phaser.GameObjects.Image[]>();
  private guardSprites: Phaser.GameObjects.Image[] = [];
  private slotLabels: Phaser.GameObjects.Text[] = [];
  private slotG!: Phaser.GameObjects.Graphics;
  private guardFlash: number[] = [];
  private lastGuardCd: number[] = [];
  private coinsText!: Phaser.GameObjects.Text;
  private relicIcon2!: Phaser.GameObjects.Image;
  private relicSet!: Phaser.GameObjects.Text;
  private streakText!: Phaser.GameObjects.Text;
  private streakBonusText!: Phaser.GameObjects.Text;
  private streakFlame!: Phaser.GameObjects.Image;
  private relicPanel!: Phaser.GameObjects.Container;
  private relicIcon!: Phaser.GameObjects.Image;
  private relicName!: Phaser.GameObjects.Text;
  private relicText!: Phaser.GameObjects.Text;
  private gameOver!: Phaser.GameObjects.Container;
  /** "New hero" wipes the save, so its first tap only arms it and a second one confirms. */
  private newHeroArmed = false;
  private newHeroCaption!: Phaser.GameObjects.Text;
  private newHeroNote!: Phaser.GameObjects.Text;
  private gameOverText!: Phaser.GameObjects.Text;
  private lastArrowCooldown = 0;
  private clock = 0;
  private lastFrame: number | null = null;
  /** How many times faster than real time the battle plays: 1 or 2, switched in the bottom bar. */
  speed = 1;
  private speedBg!: Phaser.GameObjects.Graphics;
  private speedText!: Phaser.GameObjects.Text;
  /** Plays the battle's sounds and picks the music, from what each tick changed. */
  private sounds = new BattleSounds();

  constructor() {
    super('Game');
  }

  create() {
    this.foes.clear();
    this.missiles.clear();
    this.pops.clear();
    this.rainArrows.clear();
    this.caltropPieces.clear();
    this.aim = null;
    this.eliteLabels.clear();
    const progress = loadProgress();
    this.state = newRun(progress, loadAim());
    // A pending level-up comes back with the cards it had up before the reload.
    reoffer(this.state, progress.choices);
    saveProgress(progressOf(this.state));

    // The view may be wider or taller than 960x540: the camera keeps the designed battlefield in
    // its middle, the background is painted over all of it and the HUD is pinned to its edges.
    const frame = viewFrame(this);
    placeHud(frame);
    this.cameras.main.setScroll(-frame.x, -frame.y);
    fit(this.add.image(SEEN.x, SEEN.y, 'background')).setOrigin(0);
    const hero = FIGURES.hero!;
    this.hero = fit(this.add.image(HERO_FEET.x, HERO_FEET.y, 'hero')).setOrigin(hero.originX, hero.originY).setDepth(HERO_FEET.y);
    this.barricade = fit(this.add.image(BARRICADE.x, BARRICADE.y, 'barricade-0')).setOrigin(0).setDepth(1);
    this.bars = this.add.graphics().setDepth(UI_DEPTH - 20);
    this.fx = this.add.graphics().setDepth(UI_DEPTH - 30);
    this.glow = this.add.graphics().setDepth(UI_DEPTH - 29).setBlendMode(Phaser.BlendModes.ADD);
    this.aimG = this.add.graphics().setDepth(UI_DEPTH - 8);
    // The dark of a Night wave lies over the foes, under their bars and the effects.
    this.nightG = this.add.graphics().setDepth(UI_DEPTH - 40);
    this.createHud();
    this.createTrack();
    this.createRain();
    this.createGuards();
    this.createForts();
    this.createRelicPanel();
    this.createGameOver();
    this.createWon();
    this.levelUp = new LevelUp(this, (id) => this.pick(id), loadAutoPick(), saveAutoPick);
    this.roadChoice = new RoadChoice(this, (id) => this.pickRoad(id));
    this.hirePanel = new HirePanel(
      this,
      (slot, kind) => this.hire(slot, kind),
      (slot) => this.train(slot),
    );
    this.fortifyPanel = new FortifyPanel(this, (id) => this.fortify(id));
    this.omenCard = new OmenCard(this, (accept) => {
      if (decideOmen(this.state, accept) && accept) sfx('omen');
    });
    this.legacyPanel = new LegacyPanel(this, (id) => this.retire(id));
    this.createAimToggle();
    this.found = new Set(loadFound());
    this.skillBook = new SkillBook(this);
    this.createSpeedSwitch();
  }

  update(time: number) {
    // Game time from the frame's own timestamp rather than Phaser's smoothed delta, which holds
    // every step to 16ms while the page is not in focus.
    const dt = this.lastFrame === null ? 0 : Phaser.Math.Clamp(time - this.lastFrame, 0, MAX_STEP_MS);
    this.lastFrame = time;
    const s = this.state;
    const phase = s.phase;
    const wave = s.wave;
    const levelUps = s.levelUps;
    const level = s.level;
    // Everything, the auto-pick countdown included, waits while the skill book, a hire panel or the
    // fortify panel is open.
    if (s.choices || held(s)) this.hirePanel.close();
    if (s.choices || held(s)) this.fortifyPanel.close();
    this.sounds.mark(s);
    let ticked = 0;
    if (!this.skillBook.open && !this.hirePanel.open && !this.fortifyPanel.open) {
      // The battle plays at the chosen speed; the level-up's and the road choice's auto-pick
      // countdowns and the break with an undecided omen card stay in real seconds.
      const realTime = s.choices || s.roadChoices || (s.phase === 'break' && s.omen && !s.omen.accepted);
      const game = realTime ? dt : dt * this.speed;
      tick(s, game, this.levelUp.autoPick);
      if (!s.choices && !held(s)) this.clock += game;
      ticked = game;
    }
    this.sounds.play(s, ticked);
    checkTrophies(s);
    if (s.phase !== phase || s.wave !== wave || s.levelUps !== levelUps || s.level !== level) saveProgress(progressOf(s));
    // A level-up or a fall drops Arrow Rain from the hand.
    if (s.choices || held(s) || this.skillBook.open || this.hirePanel.open || this.fortifyPanel.open) this.aim = null;

    this.track = waveTrack(s.wave);
    this.drawFoes();
    this.drawMissiles();
    this.drawEffects();
    this.drawHero();
    this.drawHud();
    this.drawTrack();
    this.drawRain();
    this.drawCaltrops();
    this.drawGuards();
    this.drawForts();
    this.drawAimToggle();
    this.roadChoice.show(s.phase === 'break' ? s.roadChoices : null, s.roadMs);
    const omen = s.phase === 'break' && s.omen && !s.omen.accepted && !s.choices && !this.hirePanel.open && !this.fortifyPanel.open ? s.omen.id : null;
    this.omenCard.show(omen, s.wave);
    this.levelUp.show(held(s) ? null : s.choices, s.ranks, s.level - s.levelUps + 1, s.levelUps, s.pickMs);
    this.discover();
    this.skillBook.show(this.found, s.ranks, s.relics, held(s));
    this.gameOver.setVisible(s.phase === 'over');
    if (s.phase !== 'over' && this.newHeroArmed) this.armNewHero(false);
    if (!held(s)) this.legacyPanel.close();
    // Retiring needs every skill learned or the siege lifted; until then the button stays dim.
    for (const b of this.retireButtons) b.setAlpha(canRetire(s) ? 1 : 0.45);
    this.retireNote.setText(canRetire(s) ? '' : t('retireNote'));
    if (s.phase === 'over') {
      this.gameOverText.setText(
        t(s.heat > 0 ? 'fallenHeat' : 'fallen', { wave: s.wave, heat: s.heat, kills: s.kills, streak: s.streak.best, best: s.bestWave, level: s.level }),
      );
      this.drawHeatPicks();
      this.drawMarchPicks();
    }
    this.won.setVisible(s.phase === 'won');
    if (s.phase === 'won') {
      const next = s.heat + 1;
      this.wonText.setText(
        t(s.heat > 0 ? 'wonHeat' : 'won', { wave: WIN_WAVE, heat: s.heat, kills: s.kills, streak: s.streak.best }) +
          '\n\n' +
          t(next <= MAX_HEAT ? HEAT_UNLOCKED[next - 1] : 'wonAll'),
      );
      this.wonNext.setVisible(next <= MAX_HEAT);
      this.wonNextText.setText(t('heat', { n: next }));
    }
  }

  /** Fills the skill book's page for each upgrade offered (or held) for the first time. */
  private discover() {
    const s = this.state;
    // A hero with every skill learned has been offered every filler on the way (an older save may
    // have missed Second Wind), so the book is complete.
    const seen = [...(s.choices ?? []), ...(Object.keys(s.ranks) as UpgradeId[]), ...(s.mastered ? FILLERS : [])];
    const fresh = seen.filter((id) => !this.found.has(id));
    if (fresh.length === 0) return;
    for (const id of fresh) this.found.add(id);
    saveFound([...this.found]);
  }

  private pick(id: UpgradeId) {
    if (!pick(this.state, id)) return;
    sfx('pick');
    saveProgress(progressOf(this.state));
  }

  private pickRoad(id: RoadId) {
    if (pickRoad(this.state, id)) sfx('pick');
  }

  /** The hammer and the coins for something bought, or the buzz when it was refused. */
  private bought(done: boolean) {
    if (!done) return ui('refuse');
    sfx('build');
    ui('coin');
  }

  private hire(slot: number, kind: GuardKind) {
    const done = hire(this.state, slot, kind);
    this.bought(done);
    if (done) this.hirePanel.close();
  }

  private train(slot: number) {
    const done = train(this.state, slot);
    this.bought(done);
    if (done) this.hirePanel.show(slot, this.state.guards[slot], this.state.coins);
  }

  private fortify(id: FortId) {
    const done = fortify(this.state, id);
    this.bought(done);
    if (done) this.fortifyPanel.close();
  }

  /** Cycles the aim priority, and keeps it for the next run and the next visit. */
  private cycleAim() {
    if (this.skillBook.open || this.hirePanel.open || this.fortifyPanel.open) return;
    setAim(this.state, nextAim(this.state.aimMode));
    saveAim(this.state.aimMode);
    ui('click');
  }

  /** Blinks on and off every `ms`, or holds still with reduced motion. */
  private blink(ms: number) {
    return settings.reduceMotion ? 0 : Math.floor(this.clock / ms) % 2;
  }

  /** A gentle 0..1 pulse for glows, held at its middle with reduced motion. */
  private pulse(ms: number) {
    return settings.reduceMotion ? 0.5 : 0.5 + 0.5 * Math.sin((this.clock / ms) * Math.PI * 2);
  }

  // ---- The battle.

  private drawFoes() {
    const seen = new Set<number>();
    this.bars.clear();
    // On a Night wave the field beyond mid-field lies in the dark, and the foes in it are unseen.
    const sight = omenEffects(this.state.omen).sight;
    const night = this.nightG.clear();
    if (sight < Infinity && !held(this.state)) {
      const top = SEEN.y + HUD_HEIGHT;
      const h = XP_BAR.y - 10 - top;
      night.fillStyle(0x08101e, 0.3).fillRect(SEEN.x, top, SEEN.w, h);
      // Strips that overlap towards the right darken it from mid-field on, with a soft edge.
      for (let i = 0; i < 6; i++) night.fillStyle(0x08101e, 0.16).fillRect(sight + i * 8, top, SEEN.x + SEEN.w - sight, h);
    }
    for (const e of this.state.enemies) {
      seen.add(e.id);
      let sprite = this.foes.get(e.id);
      if (!sprite) {
        sprite = this.add.image(e.x, e.y, foeTexture(e.kind, 0));
        this.foes.set(e.id, sprite);
      }
      const hidden = e.x >= sight;
      sprite.setVisible(!hidden);
      this.eliteLabels.get(e.id)?.setVisible(!hidden);
      if (hidden) continue;
      const type = ENEMIES[e.kind];
      const pace = e.slowMs > 0 ? 1 - e.slow : 1;
      // Walk in two frames with a bob; at the barricade, lunge at it in time with the blows.
      const phase = ((this.clock * pace) / STRIDE_MS + e.id * 0.37) % 1;
      const frame = phase < 0.5 ? 0 : 1;
      const lunge = e.attacking ? -Math.max(0, Math.sin(phase * Math.PI * 2)) * 6 : 0;
      const bob = e.attacking ? 0 : -Math.abs(Math.sin(phase * Math.PI * 2)) * 2;
      const feet = e.y + type.radius * 0.6;
      // A harpy beats its wings instead of walking, with its shadow on the road below.
      const key = foeTexture(e.kind, e.attacking ? 0 : frame);
      if (type.flying) this.fx.fillStyle(0x2a1808, 0.22).fillEllipse(e.x + 6, feet + FLY_HEIGHT, 30, 9);
      const fig = FIGURES[key]!;
      fit(sprite.setTexture(key)).setOrigin(fig.originX, fig.originY).setPosition(e.x + lunge, feet + bob).setDepth(feet);
      // A foe fades in over its first steps, which a view wider than 960 shows (off screen at 960).
      const fade = Phaser.Math.Clamp((SPAWN_X + type.radius - e.x) / SPAWN_FADE, 0, 1);
      sprite.setAlpha(fade);
      this.eliteLabels.get(e.id)?.setAlpha(fade);
      // A hit flashes white, in blinks so a foe under steady fire still shows; with reduced motion
      // there is no flash and the burn's flicker holds still.
      if (e.hitMs > 0 && !settings.reduceMotion && this.blink(50) === 0) sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else if (e.burnMs > 0) sprite.setTint(this.blink(120) ? 0xffb070 : 0xffd8a0).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (e.slowMs > 0) sprite.setTint(0xa8dcf8).setTintMode(Phaser.TintModes.MULTIPLY);
      else if (e.trait === 'enraged' && e.hp < e.maxHp / 2) sprite.setTint(0xffb0a0).setTintMode(Phaser.TintModes.MULTIPLY);
      else sprite.clearTint();
      if (!type.boss) this.drawHpBar(e, feet - fig.height - 8);
      if (e.burnMs > 0) this.drawFlames(e, feet - fig.height / 2);
      if (e.trait) this.drawElite(e, feet - fig.height - 8);
    }
    for (const [id, sprite] of this.foes) {
      if (seen.has(id)) continue;
      sprite.destroy();
      this.foes.delete(id);
    }
    for (const [id, label] of this.eliteLabels) {
      if (seen.has(id)) continue;
      label.destroy();
      this.eliteLabels.delete(id);
    }
  }

  /** An elite's trait: a coloured hexagon over its health bar, its name beside it, and a Warded foe's rune ring on the road. */
  private drawElite(e: Enemy, y: number) {
    const trait = TRAITS[e.trait!];
    const g = this.bars;
    const x = Math.round(e.x - HP_BAR_W / 2) - 8;
    g.fillStyle(0x141820).fillPoints(this.hexPts(x, y + 2, 7), true);
    g.fillStyle(trait.color).fillPoints(this.hexPts(x, y + 2, 5), true);
    let label = this.eliteLabels.get(e.id);
    if (!label) {
      label = this.add.text(0, 0, t(trait.name), textStyle(9, trait.css, 2)).setOrigin(0.5, 1).setDepth(UI_DEPTH - 20);
      this.eliteLabels.set(e.id, label);
    }
    label.setPosition(e.x, y - 2);
    if (e.trait === 'warded') {
      const r = ENEMIES[e.kind].radius;
      const feet = e.y + r * 0.6 + (ENEMIES[e.kind].flying ? FLY_HEIGHT : 0);
      this.glow.lineStyle(2, trait.color, 0.5 + 0.3 * this.pulse(900)).strokeEllipse(e.x, feet, r * 2.4, r * 0.9);
    }
  }

  private drawHpBar(e: Enemy, y: number) {
    if (e.hp >= e.maxHp) return;
    const x = Math.round(e.x - HP_BAR_W / 2);
    const fill = Math.round((HP_BAR_W - 2) * Phaser.Math.Clamp(e.hp / e.maxHp, 0, 1));
    this.bars.fillStyle(BAR.back).fillPoints(chamferPts(x - 1, y - 1, HP_BAR_W + 2, 7, 2), true);
    this.bars.fillStyle(BAR.hp).fillRect(x + 1, y + 1, fill, 4);
    this.bars.fillStyle(BAR.hpShine).fillRect(x + 1, y + 1, fill, 1.5);
  }

  private drawFlames(e: Enemy, y: number) {
    for (let i = 0; i < 3; i++) {
      const t = (this.clock / 300 + i / 3 + e.id * 0.13) % 1;
      const fx = e.x + Math.sin(e.id * 7 + i * 2.1) * 10;
      const fy = y - t * 22;
      const s = 5 * (1 - t * 0.5);
      this.fx.fillStyle(t < 0.5 ? FIRE.light : FIRE.mid, 1 - t).fillTriangle(fx - s, fy + s, fx + s, fy + s, fx, fy - s * 1.6);
    }
  }

  private drawMissiles() {
    const seen = new Set<number>();
    const s = stats(this.state);
    const arrowKey = s.burn ? 'arrow-fire' : s.chill ? 'arrow-frost' : 'arrow';
    for (const m of this.state.missiles) {
      seen.add(m.id);
      let sprite = this.missiles.get(m.id);
      if (!sprite) {
        sprite = fit(this.add.image(m.x, m.y, m.kind === 'arrow' ? arrowKey : m.kind === 'magic' ? 'magic-bolt' : m.kind === 'rock' ? 'rock' : 'fireball')).setDepth(UI_DEPTH - 40);
        if (m.kind === 'arrow') sprite.setOrigin(30 / 44, 0.5);
        else if (m.kind === 'magic') sprite.setOrigin(28 / 40, 0.5);
        else if (m.kind === 'fireball') sprite.setOrigin(34 / 48, 0.5);
        this.missiles.set(m.id, sprite);
      }
      if (m.kind === 'rock') {
        // A rock tumbles along a high arc over the foes, with its shadow on the road.
        const total = Math.max(1, Math.hypot(m.to!.x - m.from!.x, m.to!.y - m.from!.y));
        const u = Phaser.Math.Clamp(1 - Math.hypot(m.to!.x - m.x, m.to!.y - m.y) / total, 0, 1);
        const lift = Math.sin(u * Math.PI) * 110;
        this.fx.fillStyle(0x2a1808, 0.2).fillEllipse(m.x, m.y + 10, 24, 8);
        sprite.setPosition(m.x, m.y - lift).setRotation(m.x * 0.05);
      } else sprite.setPosition(m.x, m.y).setRotation(Math.atan2(m.vy, m.vx));
    }
    for (const [id, sprite] of this.missiles) {
      if (seen.has(id)) continue;
      sprite.destroy();
      this.missiles.delete(id);
    }
  }

  private drawEffects() {
    const g = this.fx;
    const glow = this.glow;
    g.clear();
    glow.clear();
    const seen = new Set<number>();
    let inFlight = 0;
    // Nothing in the dark of a Night wave shows: no puff or pop from a kill by a blast's edge or a
    // volley, no spark, burst or healing mote over a hidden foe.
    const sight = omenEffects(this.state.omen).sight;
    for (const e of this.state.effects) {
      if (e.x >= sight) continue;
      const life = 1 - e.ms / e.total;
      if (e.kind === 'blast' || e.kind === 'fireblast') {
        // A faceted starburst that swells and fades.
        const r = (e.radius ?? 40) * (0.4 + 0.6 * life);
        const star = Array.from({ length: 16 }, (_, i) => {
          const a = (i / 16) * Math.PI * 2 + e.id;
          const rr = i % 2 ? r * 0.6 : r;
          return v(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr * 0.75);
        });
        g.fillStyle(e.kind === 'fireblast' ? FIRE.dark : FIRE.mid, 0.6 * (1 - life)).fillPoints(star, true);
        g.fillStyle(FIRE.light, 0.7 * (1 - life)).fillPoints(star.map((p) => v(e.x + (p.x - e.x) * 0.55, e.y + (p.y - e.y) * 0.55)), true);
        glow.lineStyle(3, FIRE.white, 0.7 * (1 - life)).strokeEllipse(e.x, e.y, r * 2, r * 1.5);
      } else if (e.kind === 'bolt' && e.points) {
        // A jagged bolt down from the sky to the first foe, then on from foe to foe.
        const path = this.jag([{ x: e.points[0].x - 30, y: SEEN.y + HUD_HEIGHT + 10 }, ...e.points], e.id);
        for (const [width, color, alpha] of [[10, STORM.mid, 0.45], [4, STORM.light, 0.9], [1.5, STORM.white, 1]] as const) {
          glow.lineStyle(width, color, alpha * (1 - life)).strokePoints(path, false);
        }
        for (const p of e.points) glow.fillStyle(STORM.mid, 0.4 * (1 - life)).fillEllipse(p.x, p.y, 34, 20);
      } else if (e.kind === 'death') {
        // A puff of faceted dust shards where the foe fell.
        const r = (e.radius ?? 16) * (0.8 + 1.2 * life);
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2 + e.id;
          const cx = e.x + Math.cos(a) * r;
          const cy = e.y + Math.sin(a) * r * 0.6 - 6 - life * 10;
          const s = 6 * (1 - life * 0.5);
          g.fillStyle(0xe8e2d8, 0.6 * (1 - life)).fillTriangle(cx - s, cy, cx, cy - s, cx + s * 0.4, cy + s * 0.4);
          g.fillStyle(0x9a9080, 0.6 * (1 - life)).fillTriangle(cx, cy - s, cx + s, cy, cx + s * 0.4, cy + s * 0.4);
        }
      } else if (e.kind === 'rain') {
        // The volley lands: a gold ring bursts outwards and the shafts stand in the road.
        const k = 1 + 0.25 * life;
        const { rx, ry } = this.ring();
        glow.lineStyle(4, GOLD.light, 0.8 * (1 - life)).strokeEllipse(e.x, e.y, rx * 2 * k, ry * 2 * k);
        g.fillStyle(GOLD.mid, 0.25 * (1 - life)).fillEllipse(e.x, e.y, rx * 2, ry * 2);
        for (let i = 0; i < 12; i++) {
          const [dx, dy] = this.scatter(e.id, i);
          const x = e.x + dx * rx * 0.9;
          const y = e.y + dy * ry * 0.9;
          g.lineStyle(2, 0xfff2c4, 1 - life).lineBetween(x - 3, y - 12, x, y);
        }
      } else if (e.kind === 'block') {
        // An arrow glances off a shield: a burst of steel sparks.
        for (let k = 0; k < 5; k++) {
          const a = Math.PI * (0.6 + (k / 4) * 0.8) + e.id;
          const r = 6 + life * 14;
          glow.lineStyle(2, 0xfff2c4, 1 - life).lineBetween(e.x + Math.cos(a) * r * 0.4, e.y + Math.sin(a) * r * 0.4, e.x + Math.cos(a) * r, e.y + Math.sin(a) * r);
        }
        glow.fillStyle(0xd8e8ff, 0.6 * (1 - life)).fillCircle(e.x, e.y, 5);
      } else if (e.kind === 'heal' && e.points) {
        // The shaman's healing: a green ring swells round it and motes rise from the foes it mends.
        const r = (e.radius ?? 100) * (0.3 + 0.7 * life);
        glow.lineStyle(3, 0x5ad07a, 0.6 * (1 - life)).strokeEllipse(e.x, e.y, r * 2, r * 1.2);
        for (const p of e.points) {
          if (p.x >= sight) continue;
          for (let k = 0; k < 3; k++) {
            const my = p.y - 10 - life * 30 - k * 8;
            const mx = p.x + Math.sin(e.id + k * 2.3) * 9;
            g.fillStyle(0x8ff0a8, 0.9 * (1 - life)).fillTriangle(mx - 3, my, mx, my - 4, mx + 3, my);
            g.fillStyle(0x3a9a5a, 0.9 * (1 - life)).fillTriangle(mx - 3, my, mx, my + 4, mx + 3, my);
          }
        }
      } else if (e.kind === 'stab' && e.points) {
        // The spearman's thrust: a bright streak along the spear to the foe.
        const [a, b] = e.points;
        glow.lineStyle(4, 0xfff2c4, 0.8 * (1 - life)).lineBetween(a.x, a.y, b.x, b.y);
        glow.fillStyle(0xffffff, 0.8 * (1 - life)).fillCircle(b.x, b.y, 6 * (1 - life) + 2);
      } else if (e.kind === 'rockHit') {
        // A rock comes down: dust and stone chips fly.
        const r = (e.radius ?? 20) * (0.5 + 1.5 * life);
        g.fillStyle(0xb8ab98, 0.5 * (1 - life)).fillEllipse(e.x, e.y + 6, r * 2.2, r * 0.9);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + e.id;
          const cx = e.x + Math.cos(a) * r;
          const cy = e.y + Math.sin(a) * r * 0.5 - life * 24;
          g.fillStyle(0x7d7872, 1 - life).fillTriangle(cx - 4, cy + 3, cx, cy - 4, cx + 4, cy + 3);
        }
      } else if (e.kind === 'call') {
        // The Ogre Warlord's call: rings of sound roll out from it.
        for (let k = 0; k < 3; k++) {
          const u = Math.max(0, life - k * 0.15);
          glow.lineStyle(3, 0xffb08a, 0.7 * (1 - u)).strokeEllipse(e.x, e.y - 30, 40 + u * 220, 24 + u * 120);
        }
      } else if (e.kind === 'roar') {
        // The Frost Giant's roar: a frosty shockwave towards the hero.
        const r = (e.radius ?? 160) * life;
        glow.lineStyle(5, 0xa8dcf8, 0.8 * (1 - life)).strokeEllipse(e.x - r * 0.4, e.y, r * 2.4, r * 1.2);
        glow.lineStyle(2, 0xffffff, 0.6 * (1 - life)).strokeEllipse(e.x - r * 0.4, e.y, r * 1.6, r * 0.8);
      } else if (e.kind === 'split') {
        // A Splitting foe falls apart: green shards burst sideways.
        const r = (e.radius ?? 16) * (0.6 + 1.4 * life);
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * Math.PI * 2 + e.id;
          const cx = e.x + Math.cos(a) * r * 1.3;
          const cy = e.y + Math.sin(a) * r * 0.5 - 8;
          glow.fillStyle(0x8fdc6a, 0.9 * (1 - life)).fillTriangle(cx - 4, cy + 3, cx, cy - 5, cx + 4, cy + 3);
        }
      } else if (e.kind === 'arcane') {
        // The mage's bolt bursts: a teal starburst.
        const r = (e.radius ?? 40) * (0.4 + 0.6 * life);
        const star = Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2 + e.id;
          const rr = i % 2 ? r * 0.55 : r;
          return v(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr * 0.75);
        });
        g.fillStyle(0x2a9a9a, 0.5 * (1 - life)).fillPoints(star, true);
        glow.lineStyle(3, 0x9ffff0, 0.7 * (1 - life)).strokeEllipse(e.x, e.y, r * 2, r * 1.5);
      } else if (e.kind === 'crit' || e.kind === 'xp') {
        seen.add(e.id);
        let texts = this.pops.get(e.id);
        if (!texts) {
          texts =
            e.kind === 'crit'
              ? [this.add.text(e.x, e.y, t('crit'), textStyle(15, '#ffd84a', 4)).setOrigin(0.5)]
              : [this.add.text(e.x, e.y, t('xpPop', { n: Math.round(e.amount ?? 0) }), textStyle(17, '#ffe07a', 4)).setOrigin(0.5)];
          if (e.kind === 'xp' && (e.streak ?? 0) >= 2) texts.push(this.add.text(e.x, e.y, `x${e.streak}`, textStyle(13, '#ff9b3a', 4)).setOrigin(0, 0.5));
          for (const text of texts) text.setDepth(UI_DEPTH - 10);
          this.pops.set(e.id, texts);
        }
        const rise = e.kind === 'crit' ? 20 + life * 18 : 4 + life * 26;
        const alpha = life < 0.7 ? 1 : 1 - (life - 0.7) / 0.3;
        texts[0].setPosition(e.x, e.y - rise).setAlpha(alpha);
        texts[1]?.setPosition(e.x + texts[0].width / 2 + 2, e.y - rise - 10).setAlpha(alpha);
      } else if (e.kind === 'autoPick' && e.upgrade) {
        // The countdown took a card: name it, with its new rank, rising over the battle.
        seen.add(e.id);
        let texts = this.pops.get(e.id);
        if (!texts) {
          const u = UPGRADES[e.upgrade];
          const rank = this.state.ranks[e.upgrade] ?? 0;
          const name = u.filler ? t(u.name) : t('autoPickedRank', { name: t(u.name), n: rank });
          texts = [
            this.add.text(e.x, e.y, t('autoPicked'), textStyle(15, '#c9c3b6', 4)).setOrigin(0.5),
            this.add.text(e.x, e.y, name, textStyle(22, '#ffcf4a', 5)).setOrigin(0.5),
          ];
          for (const text of texts) text.setDepth(UI_DEPTH - 10);
          this.pops.set(e.id, texts);
        }
        const rise = Math.min(1, life * 6) * 12 + life * 10;
        const alpha = life < 0.8 ? 1 : 1 - (life - 0.8) / 0.2;
        texts[0].setPosition(e.x, e.y - rise - 16).setAlpha(alpha);
        texts[1].setPosition(e.x, e.y - rise + 6).setAlpha(alpha);
      } else if (e.kind === 'orb') {
        inFlight += e.amount ?? 0;
        this.drawOrbs(e.x, e.y, life);
      }
    }
    for (const [id, texts] of this.pops) {
      if (seen.has(id)) continue;
      for (const text of texts) text.destroy();
      this.pops.delete(id);
    }
    this.inFlight = inFlight;
  }

  /** Experience in orbs still flying to the bar: shown as the bar's gold preview segment. */
  private inFlight = 0;

  /** Where the experience bar's blue fill ends: where the orbs fly to. */
  private xpEnd() {
    const s = this.state;
    const have = Math.max(0, s.xp - this.inFlight);
    return { x: XP_BAR.x + 2 + (XP_BAR.w - 4) * Math.min(1, have / xpToNext(s.level)), y: XP_BAR.y + XP_BAR.h / 2 };
  }

  /** A string of gold diamonds arcing from where a foe fell into the experience bar. */
  private drawOrbs(x: number, y: number, t: number) {
    const to = this.xpEnd();
    const ctrl = { x: (x + to.x) / 2 + 90, y: Math.min(y, to.y) - 70 };
    for (let i = 0; i < 4; i++) {
      const u = Phaser.Math.Clamp(t * 1.25 - i * 0.08, 0, 1);
      if (u <= 0 || u >= 1) continue;
      const px = (1 - u) * (1 - u) * x + 2 * (1 - u) * u * ctrl.x + u * u * to.x;
      const py = (1 - u) * (1 - u) * y + 2 * (1 - u) * u * ctrl.y + u * u * to.y;
      const s = 5 - i * 0.6;
      this.glow.fillStyle(GOLD.light, 0.35).fillCircle(px, py, s * 1.8);
      this.fx.fillStyle(0xfff1b0).fillTriangle(px - s, py, px, py - s, px + s, py);
      this.fx.fillStyle(0xe2a628).fillTriangle(px - s, py, px, py + s, px + s, py);
    }
  }

  /** A path through `pts` with jagged kinks between them, the same each frame for one bolt. */
  private jag(pts: { x: number; y: number }[], seed: number): V[] {
    const out: V[] = [v(pts[0].x, pts[0].y)];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const n = Math.max(2, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 28));
      for (let k = 1; k < n; k++) {
        const t = k / n;
        const amp = 14 * Math.sin(seed * 3.1 + i * 7.7 + k * 5.3);
        out.push(v(a.x + (b.x - a.x) * t + amp, a.y + (b.y - a.y) * t + amp * 0.3));
      }
      out.push(v(b.x, b.y));
    }
    return out;
  }

  /** A fixed scatter of points in the unit disc, for volley `seed`'s arrow `i`. */
  private scatter(seed: number, i: number): [number, number] {
    const a = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
    const b = Math.sin(seed * 39.3468 + i * 11.135) * 24634.6345;
    const ang = (a - Math.floor(a)) * Math.PI * 2;
    const r = Math.sqrt(b - Math.floor(b));
    return [Math.cos(ang) * r, Math.sin(ang) * r];
  }

  private drawHero() {
    // The bow kicks back a little with each shot.
    const cd = this.state.cooldown.arrow;
    if (cd > this.lastArrowCooldown) this.hero.setX(HERO_FEET.x - 3);
    else this.hero.setX(Math.min(HERO_FEET.x, this.hero.x + 0.5));
    this.lastArrowCooldown = cd;
    const barricade = this.state.barricade;
    const health = barricade.hp / barricade.max;
    fit(this.barricade.setTexture(barricade.hp <= 0 ? 'barricade-3' : health > 0.66 ? 'barricade-0' : health > 0.33 ? 'barricade-1' : 'barricade-2'));
  }

  // ---- The HUD: top bar, experience bar, banners and the boss's bars.

  private createHud() {
    fit(this.add.image(SEEN.x, SEEN.y, 'hud-top')).setOrigin(0).setDepth(UI_DEPTH);
    fit(this.add.image(SEEN.x, XP_BAR.y - 10, 'hud-bottom')).setOrigin(0).setDepth(UI_DEPTH);
    this.hud = this.add.graphics().setDepth(UI_DEPTH);
    // The top bar's items keep to the view's left and right edges.
    const left = SEEN.x;
    const right = SEEN.x + SEEN.w - VIEW.w;
    const top = (x: number, text: string, color = '#e9e4d8', size = 14) =>
      this.add.text(x, SEEN.y + 19, text, textStyle(size, color)).setOrigin(0, 0.5).setDepth(UI_DEPTH + 1);
    this.waveText = top(left + 18, '', '#ffcf4a', 20).setStroke('#141820', 3);
    top(left + 140, t('barricade'));
    this.createBarricadeTip();
    this.foesText = top(right + 612, '');
    this.slainText = top(right + 716, '');
    fit(this.add.image(right + 796, SEEN.y + 19, 'hud-coin')).setDepth(UI_DEPTH + 1);
    this.coinsText = top(right + 808, '', '#ffe07a');
    this.bestText = top(right + 944, '').setOrigin(1, 0.5);
    // The level rides the left end of the experience bar, clear of the corner buttons (full screen,
    // sound, pause) in the bottom left.
    this.levelText = this.add
      .text(XP_BAR.x + 8, XP_BAR.y + XP_BAR.h / 2, '', textStyle(12, '#cfe8ff', 3))
      .setOrigin(0, 0.5)
      .setDepth(UI_DEPTH + 1);
    this.xpText = this.add
      .text(XP_BAR.x + XP_BAR.w / 2, XP_BAR.y + XP_BAR.h / 2, '', textStyle(12, '#ffffff', 3))
      .setOrigin(0.5)
      .setDepth(UI_DEPTH + 1);
    this.banner = this.add.text(VIEW.w / 2, 170, '', { ...textStyle(40, '#ffcf4a', 6), align: 'center' }).setOrigin(0.5).setDepth(UI_DEPTH + 1);
    this.bossName = this.add.text(BOSS_BAR.x, BOSS_BAR.y - 3, '', textStyle(14, '#ffb0a0', 3)).setOrigin(0.5, 1).setDepth(UI_DEPTH + 1);
    // The kill streak chip, riding the top edge of the experience bar.
    this.streakFlame = fit(this.add.image(STREAK.x - STREAK.w / 2 + 14, STREAK.y, 'hud-flame')).setDepth(UI_DEPTH + 2);
    this.streakText = this.add.text(STREAK.x - STREAK.w / 2 + 26, STREAK.y, '', textStyle(12, '#ffcf8a')).setOrigin(0, 0.5).setDepth(UI_DEPTH + 2);
    this.streakBonusText = this.add.text(STREAK.x + STREAK.w / 2 - 8, STREAK.y, '', textStyle(12, '#ffe07a')).setOrigin(1, 0.5).setDepth(UI_DEPTH + 2);
  }

  /**
   * Hovering over the barricade's health bar (or tapping it) shows its health, what Stout Timber
   * adds and how much it is repaired after each wave, under the bar.
   */
  private createBarricadeTip() {
    const { x, w } = BARRICADE_BAR;
    const bg = this.add.graphics();
    const y = SEEN.y;
    drawPanel(bg, x - 3, y + 34, BARRICADE_TIP_W, 70, { c: 6, fill: 0x1e222c, alpha: 0.95, lw: 1.5 });
    this.barricadeTipText = this.add
      .text(x + 7, y + 41, '', { ...textStyle(13, '#e9e4d8'), fontStyle: 'normal', lineSpacing: 3 })
      .setOrigin(0);
    this.barricadeTip = this.add.container(0, 0, [bg, this.barricadeTipText]).setDepth(UI_DEPTH + 9).setVisible(false);
    this.add
      .zone(x - 3, y + 10, w + 6, 20)
      .setOrigin(0)
      .setDepth(UI_DEPTH + 1)
      .setInteractive()
      .on('pointerover', () => this.barricadeTip.setVisible(true))
      .on('pointerout', () => this.barricadeTip.setVisible(false));
  }

  private drawBarricadeTip() {
    if (!this.barricadeTip.visible) return;
    const s = this.state;
    const st = stats(s);
    const timber = s.ranks.timber ?? 0;
    this.barricadeTipText.setText([
      t('tipHealth', { hp: Math.ceil(Math.max(0, s.barricade.hp)), max: s.barricade.max }),
      timber > 0 ? t('tipTimber', { n: timber, bonus: timber * 25 }) : t('tipTimberNone'),
      t('tipRepair', { n: Math.round(st.repair * 100) }),
    ]);
  }

  private drawHud() {
    const s = this.state;
    const g = this.hud;
    g.clear();
    this.waveText.setText(t('wave', { n: s.wave }));
    this.drawBarricadeTip();

    // The barricade's health in the top bar.
    const { x: bx, w: bw } = BARRICADE_BAR;
    const hp = Phaser.Math.Clamp(s.barricade.hp / s.barricade.max, 0, 1);
    const by = SEEN.y;
    g.fillStyle(SLATE.dark).fillPoints(chamferPts(bx - 3, by + 10, bw + 6, 20, 4), true);
    g.fillStyle(BAR.empty).fillRect(bx, by + 13, bw, 14);
    const fw = Math.round(bw * hp);
    g.fillStyle(BAR.barricade).fillRect(bx, by + 13, fw, 14);
    g.fillStyle(BAR.barricadeShine).fillRect(bx, by + 13, fw, 6);
    g.lineStyle(1.5, 0x5a3214, 0.35);
    for (let x = bx + 15; x < bx + fw; x += 22) g.lineBetween(x, by + 14, x - 4, by + 26);
    this.foesText.setText(t('foesLeft', { n: s.toSpawn.length + s.enemies.length }));
    this.slainText.setText(t('slain', { n: s.kills }));
    this.coinsText.setText(formatNumber(s.coins));
    this.bestText.setText(t('bestWave', { n: s.bestWave }));

    // Experience along the bottom: the blue fill, and a gold preview of the experience still
    // flying in as orbs.
    const need = xpToNext(s.level);
    const X = XP_BAR;
    const inner = X.w - 4;
    const have = Math.max(0, s.xp - this.inFlight);
    const blue = Math.round(inner * Math.min(1, have / need));
    const gold = Math.round(inner * Math.min(1, s.xp / need)) - blue;
    g.fillStyle(SLATE.dark).fillPoints(chamferPts(X.x - 2, X.y - 2, X.w + 4, X.h + 4, 4), true);
    g.fillStyle(XP.back).fillRect(X.x + 2, X.y + 2, inner, X.h - 4);
    g.fillStyle(XP.fill).fillRect(X.x + 2, X.y + 2, blue, X.h - 4);
    g.fillStyle(XP.facet);
    for (let x = X.x + 2; x < X.x + 2 + blue - 14; x += 28) g.fillTriangle(x, X.y + 2, x + 28, X.y + 2, x + 14, X.y + X.h - 2);
    g.fillStyle(XP.shine).fillRect(X.x + 2, X.y + 2, blue, 2);
    if (gold > 0) {
      g.fillStyle(GOLD.light, 0.9).fillRect(X.x + 2 + blue, X.y + 2, gold, X.h - 4);
      g.lineStyle(1.5, 0xffffff, 0.5);
      for (let x = X.x + 2 + blue; x < X.x + blue + gold - 2; x += 7) g.lineBetween(x + 2, X.y + X.h - 2, x + 6, X.y + 2);
    }
    this.levelText.setText(t('level', { n: s.level }));
    this.xpText.setText(t('xp', { xp: Math.floor(s.xp), need }));

    // The kill streak chip, while a streak of two or more runs.
    const streak = s.streak.count >= 2 && !held(s);
    this.streakFlame.setVisible(streak);
    this.streakText.setVisible(streak).setText(t('streak', { n: s.streak.count }));
    this.streakBonusText.setVisible(streak).setText(t('streakBonus', { n: Math.round(streakBonus(s.streak.count) * 100) }));
    if (streak) {
      const { x, y, w, h } = STREAK;
      g.fillStyle(0xff8a2a, 0.15 + 0.25 * this.pulse(700)).fillPoints(chamferPts(x - w / 2 - 4, y - h / 2 - 4, w + 8, h + 8, 7), true);
      drawPanel(g, x - w / 2, y - h / 2, w, h, { c: 5, fill: 0x3a2414, alpha: 1, edge: 0xff9b3a, lw: 1.5 });
      // The bar under the chip empties as the time for the next kill runs out.
      const left = s.streak.ms / stats(s).streakMs;
      g.fillStyle(0xff9b3a, 0.8).fillRect(x - w / 2 + 6, y + h / 2 - 3, (w - 12) * left, 2);
    }

    // The wave's banner during the break before it.
    const breaking = s.phase === 'break' && !s.choices && !s.relicFound && !s.roadChoices && !this.hirePanel.open && !this.fortifyPanel.open;
    this.banner
      .setVisible(breaking)
      .setText(isBossWave(s.wave) ? t('bossComes', { n: s.wave, boss: t(ENEMIES[this.track.boss].name) }) : t('wave', { n: s.wave }))
      .setAlpha(breaking ? Math.min(1, s.breakMs / 500) : 0);

    // The boss's stacked health bars: the bar in front empties to show the next one's colour.
    const boss = s.enemies.find((e) => ENEMIES[e.kind].boss);
    this.bossName.setVisible(!!boss);
    if (boss) {
      const per = boss.maxHp / boss.bars;
      const left = Math.max(0, Math.ceil(boss.hp / per) - 1);
      const fill = (boss.hp - left * per) / per;
      const x = BOSS_BAR.x - BOSS_BAR.w / 2;
      g.fillStyle(SLATE.dark).fillPoints(chamferPts(x - 3, BOSS_BAR.y - 3, BOSS_BAR.w + 6, BOSS_BAR.h + 6, 4), true);
      g.fillStyle(left > 0 ? BOSS_BARS[(left - 1) % BOSS_BARS.length] : BAR.empty).fillRect(x, BOSS_BAR.y, BOSS_BAR.w, BOSS_BAR.h);
      g.fillStyle(BOSS_BARS[left % BOSS_BARS.length]).fillRect(x, BOSS_BAR.y, Math.round(BOSS_BAR.w * fill), BOSS_BAR.h);
      g.fillStyle(0xffffff, 0.3).fillRect(x, BOSS_BAR.y, Math.round(BOSS_BAR.w * fill), 4);
      g.lineStyle(1.5, GOLD.mid).strokePoints(chamferPts(x - 3, BOSS_BAR.y - 3, BOSS_BAR.w + 6, BOSS_BAR.h + 6, 4), true);
      this.bossName.setText(t('bossBars', { boss: t(ENEMIES[boss.kind].name), n: left + 1 }));
    }

    // The relic chest's reward, during the break after a boss: one relic, or two after a Hardened
    // Road, and the set bonus when a relic completes its set.
    const found = s.relicFound;
    this.relicPanel.setVisible(!!found && s.phase === 'break' && !s.choices);
    if (found) {
      const [a, b] = found;
      fit(this.relicIcon.setTexture(relicTexture(a)), 0.7).setPosition(b ? -188 : -168, b ? -14 : -18);
      this.relicIcon2.setVisible(!!b);
      if (b) fit(this.relicIcon2.setTexture(relicTexture(b)), 0.7);
      this.relicName.setText(b ? t('and', { a: t(RELICS[a].name), b: t(RELICS[b].name) }) : t(RELICS[a].name));
      this.relicText.setText(b ? t('twoRelics') : t('relicFromNow', { text: t(RELICS[a].text) }));
      const set = found.map((id) => RELICS[id].set).find((id) => setComplete(s.relics, id));
      this.relicSet.setText(set ? t('setComplete', { set: t(SETS[set].name), text: t(SETS[set].text) }) : '');
    }
  }

  // ---- The road to the boss: ten marks for ten waves, the boss's mark and the relic chest.

  private createTrack() {
    this.trackG = this.add.graphics().setDepth(UI_DEPTH - 5);
    const depth = UI_DEPTH - 4;
    this.trackTitle = this.add.text(TRACK.x + 12, TRACK.y + 12, '', textStyle(12, '#ffe7a0')).setOrigin(0, 0.5).setDepth(depth);
    this.trackNote = this.add
      .text(TRACK.x + TRACK.w - 10, TRACK.y + 12, '', { ...textStyle(11, '#c9c3b6'), fontStyle: 'normal' })
      .setOrigin(1, 0.5)
      .setDepth(depth);
    this.trackNumber = this.add.text(0, 0, '', textStyle(11, '#ffe7a0')).setOrigin(0.5).setDepth(depth + 1);
    this.trackBoss = fit(this.add.image(0, TRACK.markY, bossNodeTexture('troll')), 0.62).setDepth(depth);
    this.trackChest = fit(this.add.image(0, TRACK.markY, 'chest'), 0.62).setDepth(depth);
  }

  private drawTrack() {
    const s = this.state;
    // During the break after a boss, the road just finished stays up with its chest open.
    const tr = s.relicFound || s.roadChoices ? waveTrack(s.wave - 1) : this.track;
    const g = this.trackG;
    g.clear();
    drawPanel(g, TRACK.x, TRACK.y, TRACK.w, TRACK.h, { c: 8, fill: 0x222630, alpha: 0.9, edge: GOLD.mid, lw: 1.5 });
    const boss = t(ENEMIES[tr.boss].name);
    // The road's twist names the road ("Golden Road to the Ogre Warlord").
    const finished = !!(s.relicFound || s.roadChoices);
    this.trackTitle.setText(s.road && !finished ? t('roadToTwist', { road: t(ROADS[s.road].name), boss }) : t('roadTo', { boss }));
    const step = finished ? 11 : tr.step;
    this.trackNote.setText(
      s.relicFound
        ? s.relicFound.length > 1 ? t('trackRelics', { n: s.relicFound.length }) : t('trackChest', { name: t(RELICS[s.relicFound[0]].name) })
        : s.roadChoices
          ? t('chooseRoad')
          : tr.step === 10
            ? t('trackBossWave')
            : s.road
              ? t('trackBoss', { n: tr.last })
              : t('trackBossChest', { n: tr.last }),
    );
    const y = TRACK.markY;
    const x0 = TRACK.x + TRACK.markX;
    const at = (i: number) => x0 + (i - 1) * TRACK.step;
    g.lineStyle(3, 0x454c5c).lineBetween(at(1), y, at(10), y);
    g.lineStyle(3, GOLD.dark).lineBetween(at(1), y, at(Math.min(10, step)), y);
    for (let i = 1; i <= 9; i++) {
      const x = at(i);
      if (i < step) {
        g.fillStyle(0xffe48a).fillTriangle(x - 5, y, x, y - 5, x + 5, y);
        g.fillStyle(0xc98f2c).fillTriangle(x - 5, y, x, y + 5, x + 5, y);
      } else if (i === step) {
        g.fillStyle(GOLD.light, 0.35 + 0.3 * this.pulse(900)).fillPoints(this.hexPts(x, y, 13), true);
        g.fillStyle(GOLD.light).fillPoints(this.hexPts(x, y, 11), true);
        g.fillStyle(0x2b3242).fillPoints(this.hexPts(x, y, 9), true);
      } else {
        g.fillStyle(0x5a6274).fillTriangle(x - 4, y, x, y - 4, x + 4, y);
        g.fillStyle(0x3e4454).fillTriangle(x - 4, y, x, y + 4, x + 4, y);
      }
    }
    const current = step <= 9;
    this.trackNumber.setVisible(current).setPosition(at(step), y).setText(formatNumber(s.wave));
    fit(this.trackBoss.setTexture(bossNodeTexture(tr.boss)), 0.62).setPosition(at(10), y).setAlpha(step > 10 ? 0.6 : 1);
    if (step === 10) g.lineStyle(2, GOLD.light, 0.5 + 0.5 * this.pulse(700)).strokePoints(this.hexPts(at(10), y, 13), true);
    fit(this.trackChest.setTexture(finished ? 'chest-open' : 'chest'), 0.62).setPosition(at(10) + 30, y - 1);
    // A few gold glints round the chest.
    for (const [dx, dy] of [[-13, -9], [12, -10], [14, 3]]) g.fillStyle(0xfff1b0, 0.7).fillTriangle(at(10) + 30 + dx - 2, y + dy, at(10) + 30 + dx, y + dy - 2, at(10) + 30 + dx + 2, y + dy);
  }

  private hexPts(x: number, y: number, r: number) {
    return Array.from({ length: 6 }, (_, i) => v(x + Math.cos(Math.PI / 6 + (i * Math.PI) / 3) * r, y + Math.sin(Math.PI / 6 + (i * Math.PI) / 3) * r));
  }

  private createRelicPanel() {
    const g = this.add.graphics();
    drawPanel(g, -240, -58, 480, 116, { c: 14, fill: 0x222630, alpha: 0.95, lw: 2.5 });
    const chest = fit(this.add.image(-168, 12, 'chest-open'), 1.4);
    this.relicIcon = fit(this.add.image(-168, -18, 'relic-crown'), 0.7);
    this.relicIcon2 = fit(this.add.image(-148, -22, 'relic-crown'), 0.7).setVisible(false);
    const title = this.add.text(-112, -38, t('relicChest'), textStyle(20, '#ffcf4a', 4)).setOrigin(0, 0.5);
    this.relicName = this.add.text(-112, -12, '', textStyle(15, '#ffe7a0')).setOrigin(0, 0.5);
    this.relicText = this.add.text(-112, 12, '', { ...textStyle(13, '#e9e4d8'), fontStyle: 'normal', wordWrap: { width: 340 } }).setOrigin(0, 0.5);
    this.relicSet = this.add.text(-112, 36, '', textStyle(12, '#8fdc6a')).setOrigin(0, 0.5);
    this.relicPanel = this.add
      .container(VIEW.w / 2, 164, [g, chest, this.relicIcon, this.relicIcon2, title, this.relicName, this.relicText, this.relicSet])
      .setDepth(UI_DEPTH + 1)
      .setVisible(false);
  }

  // ---- Arrow Rain: the button above the ranger, dragged onto the field along a dashed arc.

  private createRain() {
    const depth = UI_DEPTH - 6;
    this.rainButton = fit(this.add.image(RAIN.x, RAIN.y, 'rain-charging')).setDepth(depth);
    this.add.text(RAIN.x, RAIN.y - RAIN.r - 17, t('arrowRain'), textStyle(10, '#ffe7a0')).setOrigin(0.5).setDepth(depth + 1);
    this.rainBadge = this.add.text(RAIN.x + RAIN.r + 27, RAIN.y, '', textStyle(9, '#2b2010')).setOrigin(0.5).setDepth(depth + 1);
    this.rainHint = this.add.text(RAIN_HINT.x, RAIN_HINT.y, t('rainHint'), textStyle(11, '#fff3d0')).setOrigin(0.5).setDepth(depth + 1);
    const hit = this.add.circle(RAIN.x, RAIN.y, RAIN.r + 6, 0x000000, 0.001).setDepth(depth + 2);
    hit.setInteractive({ useHandCursor: true }).on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.rainReady()) return ui('refuse');
      this.aimKind = 'rain';
      this.aim = { x: p.worldX, y: p.worldY };
    });
    // The caltrops button above it is dragged onto the road the same way.
    this.caltropsButton = fit(this.add.image(CALTROPS.x, CALTROPS.y, 'caltrops-charging')).setDepth(depth);
    this.add.text(CALTROPS.x, CALTROPS.y - CALTROPS.r - 15, t('caltrops'), textStyle(10, '#ffe7a0')).setOrigin(0.5).setDepth(depth + 1);
    this.caltropsBadge = this.add.text(CALTROPS.x + CALTROPS.r + 27, CALTROPS.y, '', textStyle(9, '#2b2010')).setOrigin(0.5).setDepth(depth + 1);
    const hitC = this.add.circle(CALTROPS.x, CALTROPS.y, CALTROPS.r + 6, 0x000000, 0.001).setDepth(depth + 2);
    hitC.setInteractive({ useHandCursor: true }).on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.caltropsReady()) return ui('refuse');
      this.aimKind = 'caltrops';
      this.aim = { x: p.worldX, y: p.worldY };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.aim) this.aim = { x: p.worldX, y: p.worldY };
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (!this.aim) return;
      this.aim = { x: p.worldX, y: p.worldY };
      // Let go off the road, the active stays in hand for another try.
      if (!this.onField(this.aim)) ui('refuse');
      else if (this.aimKind === 'rain') this.loose(this.aim.x, this.aim.y);
      else this.strew(this.aim.x, this.aim.y);
      this.aim = null;
    };
    this.input.on('pointerup', release);
    this.input.on('pointerupoutside', release);
    // From the keyboard, R or Space looses Arrow Rain on the thickest crowd.
    const key = () => {
      const spot = this.rainReady() ? crowdSpot(this.state) : null;
      if (spot) this.loose(spot.x, spot.y);
      else ui('refuse');
    };
    this.input.keyboard?.on('keydown-R', key);
    this.input.keyboard?.on('keydown-SPACE', key);
    // C strews the caltrops in front of the thickest crowd, and T cycles the aim priority.
    this.input.keyboard?.on('keydown-C', () => {
      const spot = this.caltropsReady() ? crowdSpot(this.state) : null;
      if (spot) this.strew(spot.x - 40, spot.y);
      else ui('refuse');
    });
    this.input.keyboard?.on('keydown-T', () => this.cycleAim());
  }

  private loose(x: number, y: number) {
    // Cloud of arrows is awarded here: a long frame can land the volley within the same tick.
    if (loose(this.state, x, y)) {
      sfx('rainLoose');
      award(trophies, 'firstRain');
    } else ui('refuse');
  }

  private strew(x: number, y: number) {
    if (strew(this.state, x, y)) sfx('caltrops');
    else ui('refuse');
  }

  // ---- The aim priority toggle, the Fortify button and the fortifications on the field.

  private createAimToggle() {
    const { x, y, w, h } = AIM;
    this.aimBg = this.add.graphics().setDepth(UI_DEPTH - 6);
    this.aimText = this.add.text(x, y, '', textStyle(11, '#ffe7a0')).setOrigin(0.5).setDepth(UI_DEPTH - 5);
    this.add
      .zone(x, y, w, h)
      .setDepth(UI_DEPTH - 4)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.cycleAim());
    const f = FORTIFY;
    this.fortifyBg = this.add.graphics().setDepth(UI_DEPTH - 6);
    this.fortifyText = this.add.text(f.x, f.y, t('fortify'), textStyle(12, '#ffe7a0')).setOrigin(0.5).setDepth(UI_DEPTH - 5);
    this.add
      .zone(f.x, f.y, f.w, f.h)
      .setDepth(UI_DEPTH - 4)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        const s = this.state;
        if (held(s) || s.choices || this.aim || this.skillBook.open || this.hirePanel.open) return;
        ui('click');
        // During a wave one is bought ahead, and set up when the next break starts.
        const note =
          s.phase !== 'break'
            ? s.forts.queued
              ? t('noteQueued')
              : t('noteAhead')
            : canFortify(s)
              ? t('noteOpen')
              : t('noteBought');
        this.fortifyPanel.show(s.forts, s.coins, note, (id) => canBuyFort(s, id));
      });
    // Paid repairs, right of the Fortify button: lit during a break while the coins are there.
    this.repairBg = this.add.graphics().setDepth(UI_DEPTH - 6);
    this.repairText = this.add.text(REPAIR.x, REPAIR.y, '', textStyle(12, '#ffe7a0')).setOrigin(0.5).setDepth(UI_DEPTH - 5);
    this.add
      .zone(REPAIR.x, REPAIR.y, REPAIR.w, REPAIR.h)
      .setDepth(UI_DEPTH - 4)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.aim || this.skillBook.open || this.hirePanel.open || this.fortifyPanel.open) return;
        this.bought(repair(this.state));
      });
    this.omenText = this.add.text(OMEN_CHIP.x, OMEN_CHIP.y, '', textStyle(10, '#e6ccff')).setOrigin(0.5).setDepth(UI_DEPTH - 5);
    this.heatText = this.add.text(HEAT.x, HEAT.y, '', textStyle(11, '#ffb08a')).setOrigin(0.5).setDepth(UI_DEPTH - 4);
    this.roarText = this.add.text(ROAR_CHIP.x, ROAR_CHIP.y, t('chilledBow'), textStyle(10, '#d8f0ff')).setOrigin(0.5).setDepth(UI_DEPTH - 5);
  }

  private drawAimToggle() {
    const s = this.state;
    const g = this.aimBg;
    g.clear();
    const { x, y, w, h } = AIM;
    drawPanel(g, x - w / 2, y - h / 2, w, h, { c: 5, fill: 0x1e222c, alpha: 0.92, edge: s.aimMode === 'nearest' ? GOLD.dark : GOLD.light, lw: 1.5 });
    this.aimText.setText(t('aim', { mode: t(AIMS[s.aimMode].name) }));
    // The Fortify button is always there; lit while one can still be bought (in a break, or queued
    // during a wave for the next one).
    const f = FORTIFY;
    const fg = this.fortifyBg;
    fg.clear();
    const open = canFortify(s);
    this.fortifyText.setColor(open ? '#ffe7a0' : '#9aa0ac').setText(open ? t('fortify') : s.forts.queued ? t('fortifyQueued') : t('fortified'));
    drawPanel(fg, f.x - f.w / 2, f.y - f.h / 2, f.w, f.h, { c: 5, fill: open ? SLATE.light : 0x1e222c, alpha: 0.95, edge: open ? GOLD.light : 0x4a5060, lw: open ? 2 : 1 });
    if (open) fg.fillStyle(GOLD.light, 0.1 + 0.15 * this.pulse(900)).fillPoints(chamferPts(f.x - f.w / 2, f.y - f.h / 2, f.w, f.h, 5), true);
    // The Repair button: 15% of the barricade for coins, dearer with each repair of the run.
    const rg = this.repairBg;
    rg.clear();
    const fix = canRepair(s);
    this.repairText.setColor(fix ? '#ffe7a0' : '#9aa0ac').setText(t('repair', { n: repairCost(s.repairs) }));
    drawPanel(rg, REPAIR.x - REPAIR.w / 2, REPAIR.y - REPAIR.h / 2, REPAIR.w, REPAIR.h, { c: 5, fill: fix ? SLATE.light : 0x1e222c, alpha: 0.95, edge: fix ? GOLD.light : 0x4a5060, lw: fix ? 2 : 1 });
    // The accepted omen's chip, over the ranger, until its wave is cleared.
    const omen = s.omen?.accepted && !held(s) ? s.omen.id : null;
    this.omenText.setVisible(!!omen).setText(omen ? t('omenChip', { omen: t(OMENS[omen].name) }) : '');
    if (omen) drawPanel(g, OMEN_CHIP.x - OMEN_CHIP.w / 2, OMEN_CHIP.y - OMEN_CHIP.h / 2, OMEN_CHIP.w, OMEN_CHIP.h, { c: 5, fill: 0x2a2036, alpha: 0.95, edge: 0xc59af0, lw: 1.5 });
    // The heat chip beside the wave track, and the chilled-bow chip while the Frost Giant's roar lasts.
    const heat = s.heat > 0;
    this.heatText.setVisible(heat).setText(t('heat', { n: s.heat }));
    if (heat) drawPanel(g, HEAT.x - HEAT.w / 2, HEAT.y - HEAT.h / 2, HEAT.w, HEAT.h, { c: 5, fill: 0x3a2414, alpha: 0.95, edge: 0xff9b3a, lw: 1.5 });
    const roar = s.roarMs > 0 && !held(s);
    this.roarText.setVisible(roar);
    if (roar) drawPanel(g, ROAR_CHIP.x - ROAR_CHIP.w / 2, ROAR_CHIP.y - ROAR_CHIP.h / 2, ROAR_CHIP.w, ROAR_CHIP.h, { c: 5, fill: 0x1a2a3a, alpha: 0.95, edge: 0xa8dcf8, lw: 1.5 });
  }

  private createForts() {
    this.fortG = this.add.graphics().setDepth(2);
    this.fortLabel = this.add.text(BARRICADE.x + 70, BARRICADE.y - 4, '', textStyle(10, '#ffe7a0', 2)).setOrigin(0.5, 1).setDepth(UI_DEPTH - 7);
  }

  /** The stake line behind the barricade, the oil pot on top of it and the lookout's banner. */
  private drawForts() {
    const f = this.state.forts;
    const g = this.fortG;
    g.clear();
    if (f.stakeHp > 0) {
      // A row of sharpened stakes leaning towards the foes, from the top of the road to the bottom.
      for (let y = FIELD.top + 6; y <= FIELD.bottom; y += 18) {
        g.fillStyle(0x3a2412, 0.3).fillEllipse(STAKE_FRONT - 4, y + 3, 16, 5);
        g.fillStyle(0x7a4e26).fillTriangle(STAKE_FRONT - 10, y + 2, STAKE_FRONT - 2, y + 2, STAKE_FRONT + 10, y - 20);
        g.fillStyle(0xc9955a).fillTriangle(STAKE_FRONT - 10, y + 2, STAKE_FRONT - 6, y + 2, STAKE_FRONT + 10, y - 20);
      }
      // Its health as a short bar over its top.
      const w = 40;
      const x = STAKE_FRONT - 16;
      const y = FIELD.top - 24;
      g.fillStyle(BAR.back).fillPoints(chamferPts(x - 1, y - 1, w + 2, 7, 2), true);
      g.fillStyle(0xc9955a).fillRect(x + 1, y + 1, Math.round((w - 2) * Math.min(1, f.stakeHp / STAKE_HP)), 4);
    }
    if (f.oil) {
      // An oil pot with a lit wick, standing on the barricade's top log.
      const x = BARRICADE.x + 96;
      const y = BARRICADE.y + 18;
      g.fillStyle(0x4a3a2a).fillEllipse(x, y + 2, 18, 16);
      g.fillStyle(0x6a5038).fillEllipse(x - 3, y - 1, 8, 10);
      g.fillStyle(0x2a2018).fillRect(x - 6, y - 10, 12, 4);
      const flick = this.blink(140) ? 1 : 0.8;
      g.fillStyle(FIRE.mid).fillTriangle(x - 3, y - 10, x + 3, y - 10, x, y - 10 - 10 * flick);
      g.fillStyle(FIRE.light).fillTriangle(x - 1.5, y - 10, x + 1.5, y - 10, x, y - 16 * flick);
    }
    if (f.lookout > 0) {
      // The lookout's post and pennant on the barricade.
      const x = BARRICADE.x + 40;
      const y = BARRICADE.y + 8;
      g.fillStyle(0x6a4424).fillRect(x - 2, y - 26, 4, 34);
      g.fillStyle(GOLD.mid).fillTriangle(x + 2, y - 26, x + 20 + 2 * this.pulse(600), y - 21, x + 2, y - 15);
    }
    this.fortLabel.setText(f.lookout > 0 ? t('lookoutLeft', { n: f.lookout }) : '');
  }

  private caltropsReady() {
    const s = this.state;
    return s.caltrops.charge >= s.caltrops.need && !s.choices && !held(s) && !this.skillBook.open && !this.hirePanel?.open && !this.fortifyPanel?.open;
  }

  private rainReady() {
    const s = this.state;
    return s.rain.charge >= s.rain.need && !s.choices && !held(s) && !this.skillBook.open && !this.hirePanel?.open && !this.fortifyPanel?.open;
  }

  /** Whether a release here looses the volley: on the road in front of the barricade. */
  private onField(p: { x: number; y: number }) {
    return p.x > BARRICADE_FRONT + 10 && p.y > FIELD.top - 40 && p.y < FIELD.bottom + 20;
  }

  private drawRain() {
    const s = this.state;
    const ready = this.rainReady();
    const g = this.aimG;
    g.clear();
    const charge = Math.min(1, s.rain.charge / s.rain.need);
    const grow = ready && !this.aim ? 1 + 0.05 * this.pulse(800) : 1;
    fit(this.rainButton.setTexture(ready ? 'rain-ready' : 'rain-charging'), grow);
    // The label above, and a READY badge or the kills still needed beside it.
    drawPanel(g, RAIN.x - 36, RAIN.y - RAIN.r - 25, 72, 16, { c: 4, fill: 0x1e222c, alpha: 0.9, edge: GOLD.mid, lw: 1 });
    drawPanel(g, RAIN.x + RAIN.r + 5, RAIN.y - 8, 44, 16, { c: 4, fill: ready ? GOLD.mid : 0x1e222c, alpha: ready ? 1 : 0.9, edge: GOLD.mid, lw: 1 });
    this.rainBadge.setText(ready ? t('ready') : `${s.rain.charge}/${s.rain.need}`).setColor(ready ? '#2b2010' : '#ffe7a0');
    // The charge fills the octagon's rim, edge by edge.
    if (!ready) {
      const ring = Array.from({ length: 8 }, (_, i) => v(RAIN.x + Math.cos(Math.PI / 8 + (i * Math.PI) / 4) * 27, RAIN.y + Math.sin(Math.PI / 8 + (i * Math.PI) / 4) * 27));
      const edges = charge * 8;
      for (let i = 0; i < 8; i++) {
        const a = ring[(i + 5) % 8];
        const b = ring[(i + 6) % 8];
        const f = Phaser.Math.Clamp(edges - i, 0, 1);
        if (f <= 0) continue;
        g.lineStyle(4, GOLD.light, 1).lineBetween(a.x, a.y, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
      }
    }
    // The hint over the field, for Arrow Rain first, else for the caltrops.
    const hint = ready || this.caltropsReady();
    this.rainHint.setVisible(hint).setText(ready ? t('rainHint') : t('caltropsHint'));
    if (hint) drawPanel(g, RAIN_HINT.x - 118, RAIN_HINT.y - 12, 236, 24, { c: 6, fill: 0x1e222c, alpha: 0.88, edge: GOLD.mid, lw: 1.5 });

    // While dragged: a dashed arc from the button up over the field to a gold ring on the road,
    // where the volley or patch will land (kept short of the dark on a Night wave).
    if (this.aim) {
      const on = this.onField(this.aim);
      const to = on ? fieldSpot(s, this.aim.x, this.aim.y) : { x: this.aim.x, y: this.aim.y };
      const from = ARC_FROM[this.aimKind];
      const ctrl = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 150 };
      const pts: V[] = [];
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        pts.push(v((1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * ctrl.x + t * t * to.x, (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * ctrl.y + t * t * (to.y - 20)));
      }
      const color = on ? GOLD.light : 0x9aa4ae;
      for (let i = 1; i < pts.length - 1; i += 2) {
        g.lineStyle(6, 0x281a08, 0.45).lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
        g.lineStyle(3, color).lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      }
      const end = pts[pts.length - 1];
      const prev = pts[pts.length - 3];
      const ang = Math.atan2(end.y - prev.y, end.x - prev.x);
      g.fillStyle(color).fillTriangle(
        end.x + Math.cos(ang) * 11, end.y + Math.sin(ang) * 11,
        end.x + Math.cos(ang + 2.5) * 10, end.y + Math.sin(ang + 2.5) * 10,
        end.x + Math.cos(ang - 2.5) * 10, end.y + Math.sin(ang - 2.5) * 10,
      );
      if (this.aimKind === 'rain') this.drawRing(g, to.x, to.y, color, 1);
      else this.drawPatch(g, to.x, to.y, color, 1);
    }
    // Volleys in the air: the ring they will land on, and the shafts coming down.
    const seen = new Set<number>();
    for (const vol of s.rain.volleys) {
      seen.add(vol.id);
      const fall = Phaser.Math.Clamp(vol.ms / RAIN_FALL_MS, 0, 1);
      this.drawRing(g, vol.x, vol.y, GOLD.light, 1 - fall * 0.5);
      let arrows = this.rainArrows.get(vol.id);
      if (!arrows) {
        arrows = Array.from({ length: 14 }, () => fit(this.add.image(0, 0, 'rain-arrow')).setOrigin(0.5, 1).setDepth(UI_DEPTH - 35));
        this.rainArrows.set(vol.id, arrows);
      }
      const { rx, ry } = this.ring();
      arrows.forEach((img, i) => {
        const [dx, dy] = this.scatter(vol.id, i);
        const lag = (i % 4) * 0.08;
        const f = Phaser.Math.Clamp(fall + lag, 0, 1);
        img.setPosition(vol.x + dx * rx * 0.9 - f * 40, vol.y + dy * ry * 0.9 - f * 260).setRotation(0.15).setAlpha(f < 1 ? 1 : 0);
      });
    }
    for (const [id, arrows] of this.rainArrows) {
      if (seen.has(id)) continue;
      for (const img of arrows) img.destroy();
      this.rainArrows.delete(id);
    }
  }

  /** Half the width and height of Arrow Rain's ring, wider with Cloudburst and a lookout. */
  private ring() {
    const k = rainRingOf(this.state);
    return { rx: RAIN_RING.rx * k, ry: RAIN_RING.ry * k };
  }

  /** The Arrow Rain target ring lying on the road: a dashed gold ellipse round a soft fill. */
  private drawRing(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha: number) {
    const { rx, ry } = this.ring();
    g.fillStyle(color, 0.22 * alpha).fillEllipse(x, y, rx * 2, ry * 2);
    for (let k = 0; k < 16; k += 2) {
      const a0 = (k / 16) * Math.PI * 2;
      const a1 = ((k + 1) / 16) * Math.PI * 2;
      g.fillStyle(color, alpha).fillPoints(
        [
          v(x + Math.cos(a0) * rx, y + Math.sin(a0) * ry),
          v(x + Math.cos(a1) * rx, y + Math.sin(a1) * ry),
          v(x + Math.cos(a1) * (rx - 6), y + Math.sin(a1) * (ry - 4)),
          v(x + Math.cos(a0) * (rx - 6), y + Math.sin(a0) * (ry - 4)),
        ],
        true,
      );
    }
    g.lineStyle(1.5, color, 0.8 * alpha).strokePoints(
      Array.from({ length: 8 }, (_, i) => v(x + Math.cos((i / 8) * Math.PI * 2) * rx * 0.36, y + Math.sin((i / 8) * Math.PI * 2) * ry * 0.36)),
      true,
    );
  }

  /** A caltrops patch outline lying on the road: a dashed ellipse with spikes round its rim. */
  private drawPatch(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number, alpha: number) {
    const { rx, ry } = CALTROP_PATCH;
    g.fillStyle(color, 0.16 * alpha).fillEllipse(x, y, rx * 2, ry * 2);
    for (let k = 0; k < 20; k += 2) {
      const a0 = (k / 20) * Math.PI * 2;
      const a1 = ((k + 1) / 20) * Math.PI * 2;
      g.lineStyle(3, color, alpha).lineBetween(x + Math.cos(a0) * rx, y + Math.sin(a0) * ry, x + Math.cos(a1) * rx, y + Math.sin(a1) * ry);
    }
  }

  // ---- Caltrops: the button above Arrow Rain's and the patches strewn on the road.

  private drawCaltrops() {
    const s = this.state;
    const c = s.caltrops;
    const ready = this.caltropsReady();
    const g = this.aimG;
    const grow = ready && !this.aim ? 1 + 0.05 * this.pulse(800) : 1;
    fit(this.caltropsButton.setTexture(ready ? 'caltrops-ready' : 'caltrops-charging'), grow);
    drawPanel(g, CALTROPS.x - 32, CALTROPS.y - CALTROPS.r - 23, 64, 16, { c: 4, fill: 0x1e222c, alpha: 0.9, edge: GOLD.mid, lw: 1 });
    drawPanel(g, CALTROPS.x + CALTROPS.r + 5, CALTROPS.y - 8, 44, 16, { c: 4, fill: ready ? GOLD.mid : 0x1e222c, alpha: ready ? 1 : 0.9, edge: GOLD.mid, lw: 1 });
    this.caltropsBadge.setText(ready ? t('ready') : `${c.charge}/${c.need}`).setColor(ready ? '#2b2010' : '#ffe7a0');
    if (!ready) {
      // The charge fills the octagon's rim, edge by edge, as on Arrow Rain's button.
      const ring = Array.from({ length: 8 }, (_, i) => v(CALTROPS.x + Math.cos(Math.PI / 8 + (i * Math.PI) / 4) * 21, CALTROPS.y + Math.sin(Math.PI / 8 + (i * Math.PI) / 4) * 21));
      const edges = Math.min(1, c.charge / c.need) * 8;
      for (let i = 0; i < 8; i++) {
        const a = ring[(i + 5) % 8];
        const b = ring[(i + 6) % 8];
        const f = Phaser.Math.Clamp(edges - i, 0, 1);
        if (f > 0) g.lineStyle(3, GOLD.light, 1).lineBetween(a.x, a.y, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
      }
    }
    // Each patch: a faint ring and caltrops scattered over it, fading in as it lands and dimmed on its last wave.
    const seen = new Set<number>();
    for (const p of c.patches) {
      seen.add(p.id);
      const fade = Math.min(1, p.ms / 150 + 0.2) * (p.waves > 1 ? 1 : 0.55);
      this.fx.fillStyle(0x3a2a1a, 0.18 * fade).fillEllipse(p.x, p.y, CALTROP_PATCH.rx * 2, CALTROP_PATCH.ry * 2);
      let pieces = this.caltropPieces.get(p.id);
      if (!pieces) {
        pieces = Array.from({ length: 16 }, (_, i) => {
          const [dx, dy] = this.scatter(p.id, i);
          return fit(this.add.image(p.x + dx * CALTROP_PATCH.rx * 0.9, p.y + dy * CALTROP_PATCH.ry * 0.9, 'caltrop')).setDepth(2);
        });
        this.caltropPieces.set(p.id, pieces);
      }
      for (const img of pieces) img.setAlpha(fade);
    }
    for (const [id, pieces] of this.caltropPieces) {
      if (seen.has(id)) continue;
      for (const img of pieces) img.destroy();
      this.caltropPieces.delete(id);
    }
  }

  // ---- Hired guards: two slots on the barricade, three with the legacy.

  private createGuards() {
    this.slotG = this.add.graphics().setDepth(3);
    GUARD_SLOTS.forEach((slot, i) => {
      this.guardSprites.push(fit(this.add.image(slot.x, slot.y, guardTexture('spear'))).setVisible(false));
      this.slotLabels.push(this.add.text(slot.x, slot.y - 30, '', textStyle(11, '#ffe7a0', 3)).setOrigin(0.5).setDepth(UI_DEPTH - 7));
      this.guardFlash.push(0);
      this.lastGuardCd.push(0);
      this.add
        .zone(slot.x, slot.y - GUARD_HIT.h / 2 + GUARD_HIT.below, GUARD_HIT.w, GUARD_HIT.h)
        .setDepth(UI_DEPTH - 3)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          const s = this.state;
          if (i >= s.guards.length || s.choices || held(s) || this.aim || this.fortifyPanel.open) return;
          ui('click');
          this.hirePanel.show(i, s.guards[i], s.coins);
        });
    });
  }

  private drawGuards() {
    const s = this.state;
    const g = this.slotG;
    g.clear();
    const cheapest = Math.min(...Object.values(GUARDS).map((t) => t.cost));
    GUARD_SLOTS.forEach((slot, i) => {
      const guard = s.guards[i];
      const sprite = this.guardSprites[i];
      const label = this.slotLabels[i];
      // The third slot is only there for a hero with its legacy.
      label.setVisible(i < s.guards.length);
      if (i >= s.guards.length) {
        sprite.setVisible(false);
        return;
      }
      // A wooden platform lashed to the barricade under each slot.
      g.fillStyle(0x5e3f24).fillEllipse(slot.x + 2, slot.y + 2, 46, 14);
      g.fillStyle(0x93653a).fillEllipse(slot.x, slot.y, 44, 12);
      g.lineStyle(1, 0x4c3020, 0.8).strokeEllipse(slot.x, slot.y, 44, 12);
      if (!guard) {
        sprite.setVisible(false);
        // An empty slot: a dashed gold ring that glows once a guard can be afforded.
        const afford = s.coins >= cheapest && !held(s);
        const alpha = afford ? 0.55 + 0.45 * this.pulse(900) : 0.45;
        for (let k = 0; k < 12; k += 2) {
          const a0 = (k / 12) * Math.PI * 2;
          const a1 = ((k + 1) / 12) * Math.PI * 2;
          g.lineStyle(2, afford ? GOLD.light : 0x9aa0ac, alpha).lineBetween(slot.x + Math.cos(a0) * 20, slot.y - 22 + Math.sin(a0) * 20, slot.x + Math.cos(a1) * 20, slot.y - 22 + Math.sin(a1) * 20);
        }
        label.setText(t('hire')).setPosition(slot.x, slot.y - 22).setColor(afford ? '#ffe07a' : '#c9c3b6');
        return;
      }
      // A guard lunges a little each time it strikes.
      if (guard.cd > this.lastGuardCd[i]) this.guardFlash[i] = 1;
      this.lastGuardCd[i] = guard.cd;
      this.guardFlash[i] = Math.max(0, this.guardFlash[i] - 0.08);
      const fig = FIGURES[guardTexture(guard.kind)]!;
      fit(sprite.setVisible(true).setTexture(guardTexture(guard.kind)))
        .setOrigin(fig.originX, fig.originY)
        .setPosition(slot.x + this.guardFlash[i] * 5, slot.y)
        .setDepth(slot.y);
      // Its level as gold pips over its head, and a ring of stars while it is stunned.
      label.setText(guard.stunMs > 0 ? t('stunned') : '').setPosition(slot.x, slot.y - fig.height - 20).setColor('#ffe7a0');
      if (guard.stunMs > 0) {
        for (let k = 0; k < 4; k++) {
          const a = (this.clock / 500 + k / 4) * Math.PI * 2;
          const sx = slot.x + Math.cos(a) * 16;
          const sy = slot.y - fig.height - 6 + Math.sin(a) * 5;
          g.fillStyle(0xfff1b0).fillTriangle(sx - 3, sy, sx, sy - 4, sx + 3, sy);
          g.fillStyle(0xe2a628).fillTriangle(sx - 3, sy, sx, sy + 4, sx + 3, sy);
        }
      }
      for (let k = 0; k < guard.level; k++) {
        const px = slot.x - (guard.level - 1) * 5 + k * 10;
        const py = slot.y - fig.height - 8;
        g.fillStyle(0xffe48a).fillTriangle(px - 4, py, px, py - 4, px + 4, py);
        g.fillStyle(0xc98f2c).fillTriangle(px - 4, py, px, py + 4, px + 4, py);
      }
    });
  }

  // ---- After a fall, and the speed switch.

  private createGameOver() {
    const cx = VIEW.w / 2;
    const cy = VIEW.h / 2;
    const dim = this.add.rectangle(cx, cy, SEEN.w, SEEN.h, 0x0e1218, 0.7).setInteractive();
    const panel = this.add.graphics();
    drawPanel(panel, cx - 300, cy - 180, 600, 360, { c: 18, fill: SLATE.mid, alpha: 1, lw: 3 });
    const title = this.add.text(cx, cy - 145, t('fallenTitle'), textStyle(30, '#ff9a7a', 5)).setOrigin(0.5);
    this.gameOverText = this.add
      .text(cx, cy - 62, '', { ...textStyle(15, '#e9e4d8'), fontStyle: 'normal', align: 'center' })
      .setOrigin(0.5);
    const again = makeButton(this, cx - 195, cy + 112, 170, 40, t('fightAgain'), () => this.restart(false));
    const reset = makeButton(this, cx, cy + 112, 170, 40, t('newHero'), () => {
      if (this.newHeroArmed) this.restart(true);
      else this.armNewHero(true);
    });
    this.newHeroCaption = reset.list[1] as Phaser.GameObjects.Text;
    this.newHeroNote = this.add.text(cx, cy + 140, '', { ...textStyle(10, '#ff9a7a'), fontStyle: 'normal', align: 'center', wordWrap: { width: 180 } }).setOrigin(0.5, 0);
    const retire = makeButton(this, cx + 195, cy + 112, 170, 40, t('retire'), () => this.openRetire());
    this.retireButtons.push(retire);
    this.retireNote = this.add.text(cx + 195, cy + 150, '', { ...textStyle(10, '#9aa0ac'), fontStyle: 'normal', align: 'center', wordWrap: { width: 190 } }).setOrigin(0.5, 0);
    // The heat the next run plays at: one button per heat, the locked ones dimmed.
    const heatLabel = this.add.text(cx - 260, cy + 14, t('nextRunAt'), textStyle(13, '#c9c3b6')).setOrigin(0, 0.5);
    const picks: Phaser.GameObjects.GameObject[] = [];
    for (let h = 0; h <= MAX_HEAT; h++) {
      const x = cx - 110 + h * 92;
      const y = cy + 14;
      const bg = this.add.graphics();
      const text = this.add.text(x, y, t('heat', { n: h }), textStyle(12, '#ffe7a0')).setOrigin(0.5);
      const zone = this.add.zone(x, y, 84, 26).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (h <= this.state.heatUnlocked) this.restartAt(h, this.startWave);
        else ui('refuse');
      });
      this.heatPicks.push({ bg, text, zone });
      picks.push(bg, text, zone);
    }
    // Forced march: the wave the next run starts on, wave 11 or 21 once the boss before it is beaten.
    const marchLabel = this.add.text(cx - 260, cy + 52, t('startAt'), textStyle(13, '#c9c3b6')).setOrigin(0, 0.5);
    MARCH_STARTS.forEach((m, i) => {
      const x = cx - 105 + i * MARCH.step;
      const y = cy + 52;
      const bg = this.add.graphics();
      const text = this.add.text(x, y, '', textStyle(11, '#ffe7a0')).setOrigin(0.5);
      const zone = this.add.zone(x, y, MARCH.w, MARCH.h).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        if (!canMarch(this.state.bestWave, m.wave)) return ui('refuse');
        this.armNewHero(false);
        this.startWave = m.wave;
        ui('click');
      });
      this.marchPicks.push({ bg, text, zone });
      picks.push(bg, text, zone);
    });
    this.gameOver = this.add
      .container(0, 0, [dim, panel, title, this.gameOverText, heatLabel, marchLabel, ...picks, again, reset, retire, this.retireNote, this.newHeroNote])
      .setDepth(UI_DEPTH + 20)
      .setVisible(false);
  }

  /** The "Start at" buttons on the game-over panel: the chosen start lit gold, the earned ones tappable with their coin stake, the rest dim. */
  private drawMarchPicks() {
    const s = this.state;
    if (!canMarch(s.bestWave, this.startWave)) this.startWave = 1;
    this.marchPicks.forEach(({ bg, text, zone }, i) => {
      const m = MARCH_STARTS[i];
      const open = canMarch(s.bestWave, m.wave);
      const current = m.wave === this.startWave;
      bg.clear();
      drawPanel(bg, zone.x - MARCH.w / 2, zone.y - MARCH.h / 2, MARCH.w, MARCH.h, { c: 5, fill: current ? GOLD.mid : open ? SLATE.light : SLATE.panel, alpha: 1, edge: open ? GOLD.mid : 0x4a5060, lw: 1.5 });
      text
        .setColor(current ? '#2b2010' : open ? '#ffe7a0' : '#7a8294')
        .setText(m.coins === 0 ? t('marchWave', { n: m.wave }) : open ? t('marchCoins', { n: m.wave, coins: m.coins }) : t('marchLocked', { n: m.wave, before: m.wave - 1 }));
    });
  }

  /** Arms "New hero" (its caption asks for a second tap and a note says what is lost) or disarms it. */
  private armNewHero(armed: boolean) {
    this.newHeroArmed = armed;
    this.newHeroCaption.setText(t(armed ? 'newHeroConfirm' : 'newHero'));
    this.newHeroNote.setText(armed ? t('newHeroNote') : '');
  }

  /** Opens the legacy cards, with a first relic rolled for the relic card. */
  private openRetire() {
    this.armNewHero(false);
    if (!held(this.state) || !canRetire(this.state)) return ui('refuse');
    this.legacyRelic = rollLegacyRelic();
    this.legacyPanel.show(this.state.legacy, this.legacyRelic);
  }

  /** Retires the hero for a legacy: the next hero starts from scratch on wave 1, keeping it. */
  private retire(id: LegacyId) {
    const next = retire(this.state, id, this.legacyRelic);
    if (!next) return ui('refuse');
    sfx('pick');
    this.legacyPanel.close();
    this.state = next;
    this.startWave = 1;
    saveProgress(progressOf(this.state));
    this.clearSprites();
  }

  /** The heat buttons on the game-over panel: the current heat lit gold, the unlocked ones tappable, the rest dim. */
  private drawHeatPicks() {
    const s = this.state;
    this.heatPicks.forEach(({ bg, text, zone }, h) => {
      const x = zone.x;
      const y = zone.y;
      const unlocked = h <= s.heatUnlocked;
      const current = h === s.heat;
      bg.clear();
      drawPanel(bg, x - 42, y - 13, 84, 26, { c: 5, fill: current ? GOLD.mid : unlocked ? SLATE.light : SLATE.panel, alpha: 1, edge: unlocked ? GOLD.mid : 0x4a5060, lw: 1.5 });
      text.setColor(current ? '#2b2010' : unlocked ? '#ffe7a0' : '#7a8294').setText(unlocked ? t('heat', { n: h }) : t('heatLocked', { n: h }));
    });
  }

  /** The victory panel after wave 30: the siege is lifted, the next heat is unlocked. */
  private createWon() {
    const dim = this.add.rectangle(VIEW.w / 2, VIEW.h / 2, SEEN.w, SEEN.h, 0x0e1218, 0.7).setInteractive();
    const panel = this.add.graphics();
    drawPanel(panel, VIEW.w / 2 - 290, VIEW.h / 2 - 150, 580, 300, { c: 18, fill: SLATE.mid, alpha: 1, lw: 3 });
    const title = this.add.text(VIEW.w / 2, VIEW.h / 2 - 110, t('wonTitle'), textStyle(30, '#ffcf4a', 5)).setOrigin(0.5);
    this.wonText = this.add
      .text(VIEW.w / 2, VIEW.h / 2 - 25, '', { ...textStyle(15, '#e9e4d8'), fontStyle: 'normal', align: 'center', wordWrap: { width: 520 } })
      .setOrigin(0.5);
    const on = makeButton(this, VIEW.w / 2 - 195, VIEW.h / 2 + 100, 170, 40, t('keepFighting'), () => keepFighting(this.state));
    this.wonNext = makeButton(this, VIEW.w / 2, VIEW.h / 2 + 100, 170, 40, t('heat', { n: 1 }), () => this.restartAt(this.state.heat + 1));
    this.wonNextText = this.wonNext.getAt(1) as Phaser.GameObjects.Text;
    // Lifting the siege earns the right to retire for a legacy.
    const retire = makeButton(this, VIEW.w / 2 + 195, VIEW.h / 2 + 100, 170, 40, t('retire'), () => this.openRetire());
    this.retireButtons.push(retire);
    this.won = this.add.container(0, 0, [dim, panel, title, this.wonText, on, this.wonNext, retire]).setDepth(UI_DEPTH + 20).setVisible(false);
  }

  /** A new run at an unlocked heat, from wave 1 (or a forced march's start) with the hero kept. */
  private restartAt(heat: number, start = 1) {
    this.state = startHeat(this.state, heat, start);
    this.startWave = 1;
    saveProgress(progressOf(this.state));
    this.clearSprites();
  }

  /** The 1x/2x switch in the bottom bar; the choice is kept in its own storage key. */
  private createSpeedSwitch() {
    this.speed = loadSpeed();
    const { x, y, w, h } = SPEED;
    this.speedBg = this.add.graphics().setDepth(UI_DEPTH + 1);
    this.speedText = this.add.text(x, y, '', textStyle(14, '#ffe7a0')).setOrigin(0.5).setDepth(UI_DEPTH + 2);
    this.add
      .zone(x, y, w, h)
      .setDepth(UI_DEPTH + 3)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.speed = this.speed === 2 ? 1 : 2;
        saveSpeed(this.speed);
        ui('click');
        this.showSpeed();
      });
    this.showSpeed();
  }

  /** The switch reads the speed it plays at, lit gold at 2x. */
  private showSpeed() {
    const { x, y, w, h } = SPEED;
    this.speedText.setText(`${this.speed}x`).setColor(this.speed === 2 ? '#2b2010' : '#ffe7a0');
    this.speedBg.clear();
    drawPanel(this.speedBg, x - w / 2, y - h / 2, w, h, { c: 5, fill: this.speed === 2 ? GOLD.mid : SLATE.light, alpha: 1, edge: GOLD.mid });
  }

  /**
   * A new run: with the hero's level and upgrades (from the chosen start), or with a new hero from
   * scratch on wave 1, who keeps what retired heroes left.
   */
  private restart(newHero: boolean) {
    this.armNewHero(false);
    if (newHero) clearProgress();
    this.state = newHero ? newRun(freshProgress(this.state.legacy), this.state.aimMode) : fightAgain(this.state, this.startWave);
    this.startWave = 1;
    saveProgress(progressOf(this.state));
    this.clearSprites();
  }

  private clearSprites() {
    for (const sprite of [...this.foes.values(), ...this.missiles.values(), ...this.eliteLabels.values(), ...[...this.caltropPieces.values()].flat()]) sprite.destroy();
    this.foes.clear();
    this.missiles.clear();
    this.eliteLabels.clear();
    this.caltropPieces.clear();
  }
}
