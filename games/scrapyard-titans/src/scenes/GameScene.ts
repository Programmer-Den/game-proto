import Phaser from 'phaser';
import { settings } from '../../../../shared/settings';
import { viewFrame, viewPoint, viewSize } from '../../../../shared/scaling';
import { aiLog, mountWatch, watching, watchSteps } from '../../../../shared/watch';
import { playMusic, playSting, stopMusic, ui, type PlayOptions } from '../../../../shared/audio';
import { FIGHT_SONG, PLAN_SONG, play, type Sfx } from '../audio';
import {
  AUGMENT_BY_ID, CLASS_STATS, COST_COLOR, DRAFT_PICK_S, ECONOMY, ITEM_BENCH, ITEMS, MAX_LEVEL, ORIGIN_COLOR, PLAN_S, PLAYER_COMMANDERS, RANKS, RIVALS, SETS,
  PARTS, RAT, SCRAP_TOKENS_PER_PART, SKILLS, TERRAIN, TRAITS, UNIT_BY_ID, comboOf, isPart,
  type CommanderDef, type DeedId, type PartId, type SetId, type TraitId,
} from '../game/data';
import { addRankPoints, doDeeds, fullOrigin, isUnlocked, loadProgress, planDeeds, rankOf, saveProgress } from '../progress';
import { STEP_S, traitValue, type BEvent } from '../game/battle';
import {
  advance, boardCount, boardUnits, buy, buyXp, countTraits, draftPick, endFight, equip, equipPreview, matchOver, moveUnit, newDrops, newMatch,
  pickAugment, player, rerollCost, reroll, roundLabel, sell, sellValue, startDraft, startFight, startPlan, unitAt, unitCost,
  xpToNext, allUnits,
  toggleShopLock,
  type Match, type MeterRow, type Owned, type Player, type Spot,
} from '../game/match';
import { aiDraft, aiPickAugment, aiPlan } from '../game/ai';
import { ordinal, t } from '../i18n';
import { CMD_TEX, INK, UNIT_TEX, bakeAll, cmdKey, itemKey, monsterKey, textureRes, unitKey } from '../art/paint';
import {
  BENCH, BUTTONS, COMMANDER_HOME, DRAFT_RING, INFO_PANEL, ITEMS_PANEL, PLAYERS_PANEL, RIVAL_HOME, SELL_ZONE, SHOP,
  LEFT_BOTTOM, TERRAIN_LEGEND, TRAITS_PANEL, UNIT_SCALE, VIEWPORT as VIEW, benchX, placeLayout, boardPoint, project, shopCardX, tileAt,
} from './layout';

const C = {
  bg: 0x0d0b1f,
  panel: 0x15122e,
  panelLine: 0x3b3478,
  cyan: 0x7cf3ff,
  text: '#e8f6ff',
  dim: '#8f8cc0',
  gold: '#ffd166',
  good: 0x4ccf6a,
  bad: 0xe85d4a,
  mana: 0x5aa9ff,
  tileA: 0x2f3b7a,
  tileB: 0x283368,
  foeA: 0x4a2a6a,
  foeB: 0x3f235c,
};
const FONT = 'Verdana, Arial, sans-serif';
const reduced = settings.reduceMotion;
/** Fight sounds left out of a watched match, which plays a thinner, quieter battle. */
const WATCH_QUIET = new Set<Sfx>(['hit', 'punch', 'shot', 'heal', 'shield', 'dodge', 'tick']);
const CAST_SOUND: Record<string, Sfx> = { shield: 'castShield', slam: 'castSlam', barrage: 'castBarrage', snipe: 'castSnipe', backstab: 'blink', repair: 'castRepair' };
const PROJ_SOUND: Record<string, Sfx> = { shot: 'shot', shell: 'shell', snipe: 'snipe' };

interface View {
  key: string;
  box: Phaser.GameObjects.Container;
  body: Phaser.GameObjects.Image;
  icons: Phaser.GameObjects.Image[];
  itemsKey: string;
  x: number;
  y: number;
  s: number;
  team: 0 | 1;
  star: number;
  gilded: boolean;
  lunge: { dx: number; dy: number; at: number } | null;
  castAt: number;
  flashAt: number;
  diedAt: number;
}

interface Fx {
  kind: 'proj' | 'lightning' | 'ring' | 'bubble' | 'sparks' | 'stun' | 'zap' | 'puff';
  at: number;
  dur: number;
  from?: number;
  to?: number;
  toList?: number[];
  x?: number;
  y?: number;
  color?: number;
  proj?: 'shot' | 'shell' | 'snipe';
  crit?: boolean;
  /** For sparks: fixed offsets so the burst looks the same every time. */
  seed?: number;
}

interface Orb {
  x: number;
  y: number;
  item?: string;
  gold?: number;
  at: number;
}

interface Button {
  x: number;
  y: number;
  w: number;
  h: number;
  run: () => void;
}

type Held = { kind: 'unit'; spot: Spot } | { kind: 'item'; index: number };

/** Parts are bolted onto these points of a robot's texture (game px from its feet). */
const ATTACH: Record<PartId, { x: number; y: number }> = {
  saw: { x: 20, y: -26 },
  servo: { x: -16, y: -34 },
  plate: { x: 0, y: -26 },
  cell: { x: -18, y: -18 },
  cap: { x: 12, y: -50 },
  scope: { x: -10, y: -52 },
};

export class GameScene extends Phaser.Scene {
  /** The match, or null on the menu. Read by the playthrough test. */
  state: Match | null = null;
  /** The menu's choices. */
  menu = { commander: 0, set: 'scrap' as SetId, terrain: false };
  /** The fight's playback speed (1 or 2). */
  speed = 1;
  private t = 0;
  private acc = 0;
  private bgG!: Phaser.GameObjects.Graphics;
  private boardG!: Phaser.GameObjects.Graphics;
  private underG!: Phaser.GameObjects.Graphics;
  private barsG!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Container;
  private hudG!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Container;
  private topText!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private views = new Map<string, View>();
  private fx: Fx[] = [];
  private numbers: { text: Phaser.GameObjects.Text; at: number; x: number; y: number; dur: number }[] = [];
  private orbs: Orb[] = [];
  private avatar!: Phaser.GameObjects.Image;
  private avatarPos = { ...COMMANDER_HOME };
  private avatarHop = 0;
  /** `t` when the avatar last walked, so it walks by game time rather than by frame. */
  private avatarT = 0;
  /** Item orbs this fight that still fit on the player's item bench. */
  private orbRoom = 0;
  private rivalImg!: Phaser.GameObjects.Image;
  private bubble!: Phaser.GameObjects.Text;
  private draftImgs: { body: Phaser.GameObjects.Image; icon: Phaser.GameObjects.Image }[] = [];
  private buttons: Button[] = [];
  private overlayButtons: Button[] = [];
  private dirty = true;
  private boardDirty = true;
  private held: Held | null = null;
  private selected: Held | null = null;
  private down: { x: number; y: number } | null = null;
  private dragging = false;
  private pointer = { x: 0, y: 0 };
  private infoTrait: TraitId | null = null;
  /** The rival whose board is shown on the far half during the plan phase. */
  scout: number | null = null;
  /** What the info panel shows when nothing is selected: the damage meter or the power cards and season. */
  private infoPage: 'meter' | 'cards' = 'meter';
  private infoRect: { x: number; y: number; w: number; h: number } | null = null;
  private phaseShown = '';
  private zapReadyAt = 0;
  private resultUntil = 0;
  private fightDoneAt = 0;
  private progress = loadProgress();
  /** Commanders unlocked during this match, listed on the end screen. */
  private unlockedNow: CommanderDef[] = [];
  /** The rank points the finished match won, for the end screen. */
  private rankGain: { gained: number; before: number; after: number } | null = null;
  private recorded = false;

  constructor() {
    super('Game');
  }

  create() {
    const view = viewSize(this);
    const frame = viewFrame(this);
    placeLayout(view.width, view.height, frame.x, frame.y);
    bakeAll(this);
    this.bgG = this.add.graphics().setDepth(0);
    this.boardG = this.add.graphics().setDepth(1);
    this.underG = this.add.graphics().setDepth(2);
    this.barsG = this.add.graphics().setDepth(900);
    this.fxG = this.add.graphics().setDepth(950);
    this.hud = this.add.container(0, 0).setDepth(1000);
    this.hudG = this.add.graphics();
    this.hud.add(this.hudG);
    this.overlay = this.add.container(0, 0).setDepth(2000);
    this.topText = this.add.text(12, 8, '', { fontFamily: FONT, fontSize: '13px', color: C.text, fontStyle: 'bold' }).setDepth(1001);
    this.banner = this.add.text(VIEW.w / 2, VIEW.fy + 206, '', { fontFamily: FONT, fontSize: '34px', color: '#ffffff', fontStyle: 'bold', stroke: INK, strokeThickness: 6 }).setOrigin(0.5).setDepth(1500);
    this.avatar = this.add.image(0, 0, cmdKey(PLAYER_COMMANDERS[0].name)).setOrigin(0.5, CMD_TEX.footY / CMD_TEX.h).setVisible(false);
    this.rivalImg = this.add.image(RIVAL_HOME.x, RIVAL_HOME.y, cmdKey(RIVALS[0].name)).setOrigin(0.5, CMD_TEX.footY / CMD_TEX.h).setVisible(false);
    this.bubble = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '11px', color: '#1a1438', backgroundColor: '#e8f6ff', padding: { x: 6, y: 4 }, wordWrap: { width: 150 } }).setOrigin(1, 1).setDepth(1400).setVisible(false);
    this.drawBackground();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onMove(p));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p));
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    playMusic(PLAN_SONG, 'calm');
    if (watching) this.startMatch();
  }

  /** Plays a sound effect; a watched match drops the small fight sounds and plays the rest softer. */
  private sfx(name: Sfx, options: PlayOptions = {}) {
    if (watching) {
      if (WATCH_QUIET.has(name)) return;
      options = { ...options, volume: (options.volume ?? 1) * 0.6 };
    }
    play(name, options);
  }

  // ------------------------------------------------------------------ match flow

  startMatch() {
    const commander = watching ? Math.floor(Math.random() * PLAYER_COMMANDERS.length) : this.menu.commander;
    const set = watching ? (Math.random() < 0.5 ? 'scrap' : 'neon') : this.menu.set;
    const terrain = watching ? Math.random() < 0.5 : this.menu.terrain;
    this.state = newMatch({ set, commander, terrain, watch: watching, rank: watching ? 0 : rankOf(this.progress.points) });
    this.recorded = false;
    this.unlockedNow = [];
    this.rankGain = null;
    this.avatar.setTexture(cmdKey(PLAYER_COMMANDERS[commander].name)).setVisible(true);
    this.avatarPos = { ...COMMANDER_HOME };
    this.orbs = [];
    this.infoTrait = null;
    this.clearViews();
    if (watching) {
      mountWatch({
        title: 'Watching AI: Scrapyard Titans',
        sides: Object.fromEntries(this.state.players.map((p) => [`p${p.seat}`, { name: p.seat === 0 ? `Seat 1 (${t(p.commander.name)})` : t(p.name), color: `#${p.commander.color.toString(16).padStart(6, '0')}` }])),
        time: () => (this.state?.time ?? 0) * 1000,
      });
    }
    this.beginPlan();
  }

  private beginPlan() {
    const m = this.state!;
    const level = player(m).level;
    startPlan(m, watching ? 3 : PLAN_S);
    if (player(m).human && player(m).level > level) this.sfx('levelUp');
    this.lastTick = 0;
    playMusic(PLAN_SONG, 'calm');
    this.scout = null;
    this.infoPage = 'meter';
    for (const p of m.players) if (p.alive && !p.human && p.seat !== 0) aiPlan(m, p);
    this.selected = null;
    this.held = null;
    this.clearViews();
    this.dirty = true;
    this.boardDirty = true;
  }

  private goFight() {
    const m = this.state!;
    if (m.phase !== 'plan') return;
    const me = player(m);
    if (me.augmentOffer) pickAugment(m, me, 0);
    this.selected = null;
    this.held = null;
    this.dragging = false;
    this.scout = null;
    startFight(m);
    this.orbRoom = ITEM_BENCH - me.items.length;
    this.clearViews();
    this.fightDoneAt = 0;
    this.acc = 0;
    this.zapReadyAt = 0;
    const rival = m.opponent >= 0 ? m.players[m.opponent] : null;
    this.rivalImg.setVisible(!!rival);
    if (rival) this.rivalImg.setTexture(cmdKey(rival.commander.name));
    aiLog('p0', `fights ${rival ? t(rival.name) : 'the monsters'}`);
    this.sfx('fight');
    playMusic(FIGHT_SONG, m.round.kind === 'rat' ? 'rat' : 'battle');
    this.dirty = true;
    this.boardDirty = true;
  }

  private finishFight() {
    const m = this.state!;
    endFight(m);
    if (player(m).human && m.result?.outcome === 'win' && fullOrigin(m)) this.noteDeeds(['fullOrigin']);
    for (const o of this.orbs) o.at = Math.min(o.at, this.t);
    const r = m.result;
    if (r) {
      const text = t(r.outcome === 'win' ? 'victory' : r.outcome === 'draw' ? 'draw' : 'defeat');
      const extra = r.damage ? t('lostHp', { n: r.damage }) : r.gold ? t('wonGold', { n: r.gold }) : '';
      this.banner.setText(text + extra).setColor(r.outcome === 'win' ? '#7cf3ff' : r.outcome === 'draw' ? '#ffd166' : '#ff8a7a');
      playSting(FIGHT_SONG, r.outcome === 'win' ? 'roundWin' : r.outcome === 'draw' ? 'roundDraw' : 'roundLoss');
    }
    this.resultUntil = m.time + 2;
    this.dirty = true;
  }

  private afterResult() {
    const m = this.state!;
    this.banner.setText('');
    this.rivalImg.setVisible(false);
    const over = matchOver(m);
    if (over) {
      m.phase = over;
      this.record(over === 'won' ? 1 : player(m).place);
      stopMusic();
      playSting(FIGHT_SONG, watching ? 'watchEnd' : over === 'won' ? 'matchWon' : 'eliminated');
      this.clearViews();
      this.dirty = true;
      return;
    }
    advance(m);
    if (m.round.kind === 'draft') {
      startDraft(m, m.time);
      playMusic(PLAN_SONG, 'draft');
      this.clearViews();
      this.makeDraftImages();
      this.dirty = true;
    } else this.beginPlan();
  }

  private record(place: number) {
    // Watched matches are the AI's, not the player's: they never count.
    if (this.recorded || watching) return;
    this.recorded = true;
    this.progress.played++;
    if (place === 1) this.progress.wins++;
    this.progress.best = this.progress.best ? Math.min(this.progress.best, place) : place;
    this.rankGain = addRankPoints(this.progress, place);
    saveProgress(this.progress);
    this.noteDeeds(place <= 4 ? (place === 1 ? ['topFour', 'champion'] : ['topFour']) : []);
  }

  /** Saves deeds the player has done and calls out the commanders they unlock. */
  private noteDeeds(deeds: DeedId[]) {
    if (watching || !deeds.length) return;
    for (const c of doDeeds(this.progress, deeds)) {
      this.unlockedNow.push(c);
      this.number({ x: VIEW.w / 2, y: VIEW.fy + 230, s: 1 }, t('unlockedCall', { name: t(c.name) }), '#ffd166', 18, 2.6);
      ui('coin');
      this.dirty = true;
    }
  }

  // ------------------------------------------------------------------ update

  update() {
    // The frame's own clock time, not Phaser's smoothed delta, which is clamped for a while after boot.
    const dt = Math.min(this.game.loop.rawDelta, 100) / 1000;
    const m = this.state;
    const steps = m ? watchSteps() : 1;
    for (let i = 0; i < steps; i++) this.tick(dt);
    this.render();
  }

  private tick(dt: number) {
    const m = this.state;
    if (!m) {
      this.t += dt;
      return;
    }
    const fighting = m.phase === 'fight';
    this.t += dt * (fighting ? this.speed : 1);
    m.time += dt;
    if (m.phase === 'plan') {
      const me = player(m);
      // A tick for each of the plan phase's last three seconds.
      const left = Math.ceil(m.phaseEnds - m.time);
      if (me.human && left <= 3 && left > 0 && left !== this.lastTick) {
        this.lastTick = left;
        this.sfx('tick');
      }
      if (me.human) this.noteDeeds(planDeeds(m));
      if (!me.human && me.augmentOffer) aiPickAugment(m, me);
      if (!me.human && m.phaseEnds - m.time < 2.5 && !this.watchPlanned) {
        this.watchPlanned = true;
        aiPlan(m, me);
        this.dirty = true;
      }
      if (m.time >= m.phaseEnds) {
        this.watchPlanned = false;
        this.goFight();
      }
    } else if (fighting) {
      const b = m.battle!;
      this.acc += dt * this.speed;
      while (this.acc >= STEP_S && !b.done) {
        this.acc -= STEP_S;
        if (b.time >= 4 && !b.skillUsed[1]) b.useSkill(1);
        if (!player(m).human && b.time >= 3 && !b.skillUsed[0]) b.useSkill(0);
        b.step();
        this.consume(b.events.splice(0));
        for (const d of newDrops(m)) this.dropOrb(d.monsterId, d.item, d.gold);
      }
      if (b.done) {
        if (!this.fightDoneAt) {
          this.fightDoneAt = m.time;
          this.dirty = true;
        }
        if (m.time - this.fightDoneAt > 1.1) this.finishFight();
      }
    } else if (m.phase === 'result') {
      if (m.time >= this.resultUntil) this.afterResult();
    } else if (m.phase === 'draft') this.tickDraft();
  }
  private watchPlanned = false;
  private lastTick = 0;

  private tickDraft() {
    const m = this.state!;
    const d = m.draft!;
    if (d.turn >= d.order.length) {
      if (m.time >= d.turnEnds + 0.8) {
        m.draft = null;
        for (const img of this.draftImgs) {
          img.body.destroy();
          img.icon.destroy();
        }
        this.draftImgs = [];
        advance(m);
        this.beginPlan();
      }
      return;
    }
    const seat = d.order[d.turn];
    const p = m.players[seat];
    if (m.time < d.turnEnds) return;
    if (!p.human) {
      aiDraft(m, p);
      d.turnEnds = m.time + 0.7;
      this.dirty = true;
    } else if (m.time >= d.turnEnds + DRAFT_PICK_S) {
      const free = d.options.findIndex((o) => o.takenBy === null);
      if (draftPick(m, 0, free)) this.sfx('draft');
      d.turnEnds = m.time + 0.7;
      this.dirty = true;
    }
  }

  // ------------------------------------------------------------------ battle events to effects

  private consume(events: BEvent[]) {
    const m = this.state!;
    for (const e of events) {
      const at = this.t;
      switch (e.t) {
        case 'attack': {
          const v = this.views.get(`b${e.id}`);
          const target = this.views.get(`b${e.target}`);
          if (v && target) {
            const dx = target.x - v.x;
            const dy = target.y - v.y;
            const len = Math.hypot(dx, dy) || 1;
            const k = e.ranged ? -4 : 16;
            v.lunge = { dx: (dx / len) * k, dy: (dy / len) * k, at };
            // Ranged shots sound with their projectile.
            if (!e.ranged) this.sfx('punch');
          }
          break;
        }
        case 'proj':
          this.fx.push({ kind: 'proj', at, dur: e.dur, from: e.from, to: e.to, proj: e.kind, crit: e.crit });
          this.sfx(PROJ_SOUND[e.kind]);
          break;
        case 'dmg': {
          const v = this.views.get(`b${e.id}`);
          if (v) {
            if (!reduced) v.flashAt = at;
            this.number(v, `${e.amount}`, e.crit ? '#ffb703' : e.ability ? '#c78bff' : '#ffffff', e.crit ? 18 : 13);
            this.sfx(e.crit ? 'crit' : 'hit');
          }
          break;
        }
        case 'heal': {
          const v = this.views.get(`b${e.id}`);
          if (v) {
            this.number(v, `+${e.amount}`, '#4ccf6a', 12);
            this.sfx('heal');
          }
          break;
        }
        case 'shield': {
          const v = this.views.get(`b${e.id}`);
          if (v) {
            this.fx.push({ kind: 'bubble', at, dur: 0.5, from: e.id });
            this.sfx('shield');
          }
          break;
        }
        case 'cast': {
          const v = this.views.get(`b${e.id}`);
          if (v) {
            v.castAt = at;
            this.fx.push({ kind: 'ring', at, dur: 0.45, from: e.id, color: e.ability === 'slam' ? 0xffb703 : 0x7cf3ff });
            if (e.ability === 'slam') this.fx.push({ kind: 'ring', at, dur: 0.6, from: e.id, color: 0xff8a2a, x: 2 });
            if (!reduced && e.ability === 'slam') this.cameras.main.shake(120, 0.004);
            this.sfx(CAST_SOUND[e.ability]);
          }
          break;
        }
        case 'death': {
          const v = this.views.get(`b${e.id}`);
          if (v) {
            v.diedAt = at;
            this.fx.push({ kind: 'sparks', at, dur: 0.7, x: v.x, y: v.y - 20 * v.s, seed: e.id, color: v.team === 0 ? 0x7cf3ff : 0xff8a7a });
            this.sfx('death');
          }
          break;
        }
        case 'stun':
          this.fx.push({ kind: 'stun', at, dur: 1, from: e.id });
          this.sfx('stun');
          break;
        case 'lightning':
          this.fx.push({ kind: 'lightning', at, dur: 0.3, from: e.from, toList: e.to });
          this.sfx('lightning');
          break;
        case 'blink': {
          const v = this.views.get(`b${e.id}`);
          if (v) {
            this.fx.push({ kind: 'puff', at, dur: 0.4, x: v.x, y: v.y, color: 0xc78bff });
            this.sfx('blink');
          }
          break;
        }
        case 'dodge': {
          const v = this.views.get(`b${e.id}`);
          if (v) {
            this.number(v, t('miss'), '#8f8cc0', 11);
            this.sfx('dodge');
          }
          break;
        }
        case 'revive': {
          const v = this.views.get(`b${e.id}`);
          if (v) {
            this.fx.push({ kind: 'ring', at, dur: 0.6, from: e.id, color: 0x4ccf6a });
            this.sfx('revive');
          }
          break;
        }
        case 'gold': {
          const v = this.views.get(`b${e.id}`);
          if (v && e.team === 0) {
            this.number(v, t('plusG', { n: e.amount }), C.gold, 13);
            this.fx.push({ kind: 'puff', at, dur: 0.3, x: v.x, y: v.y - 20, color: 0xffd166 });
            if (!watching) ui('coin');
          }
          break;
        }
        case 'skill': {
          const allies = m.battle!.alive(e.team);
          if (e.skill === 'overclock') for (const a of allies) this.fx.push({ kind: 'ring', at, dur: 0.7, from: a.id, color: 0xffb703 });
          if (e.skill === 'bulwark') for (const a of allies) this.fx.push({ kind: 'bubble', at, dur: 0.8, from: a.id });
          if (e.skill === 'zap' && e.target) this.fx.push({ kind: 'zap', at, dur: 0.4, to: e.target, x: e.team === 0 ? 0 : 1 });
          if (e.skill === 'mend') for (const u of allies) this.fx.push({ kind: 'ring', at, dur: 0.7, from: u.id, color: 0x4ccf6a });
          if (e.skill === 'surge') for (const u of allies) this.fx.push({ kind: 'ring', at, dur: 0.7, from: u.id, color: 0x5aa9ff });
          if (e.skill === 'rally') for (const u of allies) this.fx.push({ kind: 'ring', at, dur: 0.7, from: u.id, color: 0xff8a2a });
          if (e.skill === 'emp') for (const u of m.battle!.alive(e.team === 0 ? 1 : 0)) this.fx.push({ kind: 'ring', at, dur: 0.7, from: u.id, color: 0x9b5cff });
          if (e.skill === 'airstrike') for (const u of m.battle!.alive(e.team === 0 ? 1 : 0)) this.fx.push({ kind: 'zap', at, dur: 0.4, to: u.id, x: e.team === 0 ? 0 : 1 });
          if (e.team === 0) this.avatarHop = at;
          // The rival's skill is seen too, a little softer than the player's own.
          this.sfx('skill', { volume: e.team === 0 ? 1 : 0.6 });
          const skill = t(SKILLS[e.skill].name);
          const label = t('skillCall', { name: e.team === 0 ? t(player(m).commander.name) : m.opponent >= 0 ? t(m.players[m.opponent].name) : t('rival'), skill });
          this.number({ x: e.team === 0 ? COMMANDER_HOME.x + 60 : RIVAL_HOME.x - 60, y: e.team === 0 ? COMMANDER_HOME.y - 20 : RIVAL_HOME.y + 40, s: 1 } as View, label, e.team === 0 ? '#7cf3ff' : '#ff8a7a', 13, 1.4);
          this.dirty = true;
          break;
        }
        case 'escape': {
          const v = this.views.get(`b${e.id}`);
          if (v) {
            v.diedAt = at;
            this.number(v, t('escaped'), '#ffd166', 14, 1.2);
            this.sfx('escape');
            this.fx.push({ kind: 'puff', at, dur: 0.5, x: v.x, y: v.y - 10, color: 0xd0b060 });
          }
          break;
        }
        case 'move':
          break;
      }
    }
  }

  private number(v: { x: number; y: number; s: number }, text: string, color: string, size: number, dur = 0.8) {
    let n = this.numbers.find((x) => this.t - x.at > x.dur);
    if (!n) {
      if (this.numbers.length > 48) return;
      const obj = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '13px', color: '#fff', fontStyle: 'bold', stroke: INK, strokeThickness: 4 }).setOrigin(0.5).setDepth(1300);
      n = { text: obj, at: 0, x: 0, y: 0, dur: 0 };
      this.numbers.push(n);
    }
    n.text.setText(text).setColor(color).setFontSize(size).setVisible(true);
    n.at = this.t;
    n.dur = dur;
    n.x = v.x + ((this.numbers.indexOf(n) * 7) % 15) - 7;
    n.y = v.y - 80 * v.s;
  }

  private dropOrb(monsterId: number, item?: string, gold?: number) {
    const v = this.views.get(`b${monsterId}`);
    const x = v?.x ?? VIEW.fx + 480;
    const y = v?.y ?? VIEW.fy + 160;
    this.orbs.push({ x, y, item, gold, at: this.t });
  }

  // ------------------------------------------------------------------ views

  private clearViews() {
    for (const v of this.views.values()) v.box.destroy();
    this.views.clear();
    this.fx = [];
  }

  private makeView(key: string, tex: string, team: 0 | 1, star: number, gilded: boolean): View {
    const res = textureRes.get(tex) ?? 2;
    const body = this.add.image(0, 0, tex).setOrigin(0.5, tex.startsWith('mon:crusher') || tex.startsWith('mon:golem') ? 84 / 90 : UNIT_TEX.footY / UNIT_TEX.h).setScale(1 / res);
    if (gilded) body.setTint(0xffe08a);
    const box = this.add.container(0, 0, [body]);
    const v: View = { key, box, body, icons: [], itemsKey: '', x: 0, y: 0, s: 1, team, star, gilded, lunge: null, castAt: -9, flashAt: -9, diedAt: -9 };
    this.views.set(key, v);
    return v;
  }

  private setItems(v: View, items: string[]) {
    const key = items.join(',');
    if (key === v.itemsKey) return;
    v.itemsKey = key;
    for (const i of v.icons) i.destroy();
    v.icons = [];
    for (const id of items) {
      const parts = (isPart(id) ? [id] : ITEMS[id].from) as PartId[];
      for (const part of parts) {
        const a = ATTACH[part];
        const icon = this.add.image(a.x, a.y, itemKey(part)).setScale((1 / (textureRes.get(itemKey(part)) ?? 3)) * 0.78);
        v.icons.push(icon);
        v.box.add(icon);
      }
    }
  }

  /** Makes the views match what should be on the board: the player's robots, or the fight's units. */
  private syncViews() {
    const m = this.state;
    const seen = new Set<string>();
    if (m && (m.phase === 'plan' || m.phase === 'draft')) {
      const me = player(m);
      const place = (o: Owned, x: number, y: number, s: number) => {
        const key = `o${o.uid}`;
        seen.add(key);
        let v = this.views.get(key);
        if (v && v.star !== o.star) {
          this.fx.push({ kind: 'sparks', at: this.t, dur: 0.8, x, y: y - 20, seed: o.uid, color: 0xffd166 });
          v.star = o.star;
        }
        v ??= this.makeView(key, unitKey(o.defId), 0, o.star, !!o.gilded);
        v.x = x;
        v.y = y;
        v.s = s;
        this.setItems(v, o.items);
      };
      for (const [k, o] of Object.entries(me.board)) {
        if (m.phase === 'draft') break;
        const [col, row] = k.split(',').map(Number);
        const p = project(col, row);
        place(o, p.x, p.y, p.s);
      }
      me.bench.forEach((o, i) => o && place(o, benchX(i), BENCH.y + 20, 0.6));
      // A scouted rival's board, mirrored onto the far half the way it would line up in a fight.
      const rival = this.scout !== null && m.phase === 'plan' ? m.players[this.scout] : null;
      if (rival) for (const [k, o] of Object.entries(rival.board)) {
        const [col, row] = k.split(',').map(Number);
        const p = project(7 - col, 7 - row);
        const key = `s${o.uid}`;
        seen.add(key);
        const v = this.views.get(key) ?? this.makeView(key, unitKey(o.defId), 1, o.star, !!o.gilded);
        v.x = p.x;
        v.y = p.y;
        v.s = p.s;
        this.setItems(v, o.items);
      }
      if (this.dragging && this.held?.kind === 'unit') {
        const o = unitAt(me, this.held.spot);
        const v = o && this.views.get(`o${o.uid}`);
        if (v) {
          v.x = this.pointer.x;
          v.y = this.pointer.y + 22;
        }
      }
    } else if (m?.battle && (m.phase === 'fight' || m.phase === 'result')) {
      for (const u of m.battle.units) {
        const key = `b${u.id}`;
        let v = this.views.get(key);
        if (!u.alive && (!v || this.t - v.diedAt > 0.7)) continue;
        seen.add(key);
        v ??= this.makeView(key, u.monster ? monsterKey(u.monster) : unitKey(u.defId!), u.team, u.star, false);
        if (u.defId) this.setItems(v, u.items);
        const e = u.moveDur > 0 ? Phaser.Math.Easing.Sine.InOut(u.moveT) : 1;
        const col = u.fromCol + (u.col - u.fromCol) * e;
        const row = u.fromRow + (u.row - u.fromRow) * e;
        const p = project(col, row);
        v.x = p.x;
        v.y = p.y;
        v.s = p.s;
        if (u.moveDur > 0) v.y -= Math.sin(Math.PI * u.moveT) * 7 * p.s;
      }
    }
    for (const [k, v] of this.views) if (!seen.has(k)) {
      v.box.destroy();
      this.views.delete(k);
    }
  }

  private makeDraftImages() {
    const d = this.state!.draft!;
    for (const o of d.options) {
      const body = this.add.image(0, 0, unitKey(o.defId)).setOrigin(0.5, UNIT_TEX.footY / UNIT_TEX.h).setScale(1 / (textureRes.get(unitKey(o.defId)) ?? 2));
      const icon = this.add.image(0, 0, itemKey(o.item)).setScale(1 / (textureRes.get(itemKey(o.item)) ?? 3));
      this.draftImgs.push({ body, icon });
    }
  }

  private draftSpot(i: number, n: number) {
    const a = (i / n) * Math.PI * 2 + (reduced ? 0 : this.t * 0.25);
    const x = DRAFT_RING.cx + Math.cos(a) * DRAFT_RING.rx;
    const y = DRAFT_RING.cy + Math.sin(a) * DRAFT_RING.ry;
    return { x, y, s: 0.75 + 0.2 * ((Math.sin(a) + 1) / 2) };
  }

  // ------------------------------------------------------------------ drawing

  private drawBackground() {
    const g = this.bgG;
    g.fillStyle(C.bg).fillRect(0, 0, VIEW.w, VIEW.h);
    const { fx, fy } = VIEW;
    // The sky runs down to the shop row (380 on the designed view), its stars to 40 above that.
    const sky = VIEW.h - 160;
    g.fillGradientStyle(0x120e2a, 0x120e2a, 0x2d1f5c, 0x2d1f5c, 1).fillRect(0, 0, VIEW.w, sky);
    // The stars repeat in 960x340 tiles, so a wider or taller view gets more of them.
    for (let ty = 0; ty < sky - 40; ty += 340) for (let tx = 0; tx < VIEW.w; tx += 960) for (let i = 0; i < 90; i++) {
      const x = tx + ((i * 157) % 960);
      const y = ty + ((i * 61) % 340);
      if (x < VIEW.w && y < sky - 40) g.fillStyle(0xffffff, 0.25 + ((i * 37) % 10) / 20).fillRect(x, y, (i % 7) === 0 ? 2 : 1.4, (i % 7) === 0 ? 2 : 1.4);
    }
    g.lineStyle(2, C.cyan, 0.22).strokeEllipse(fx + 480, fy + 220, 860, 330);
    g.lineStyle(1, C.cyan, 0.12).strokeEllipse(fx + 480, fy + 220, 940, 380);
  }

  private drawBoard() {
    const g = this.boardG;
    g.clear();
    const m = this.state;
    if (!m) return;
    const bl = boardPoint(0, 8);
    const br = boardPoint(8, 8);
    g.fillStyle(0x151b40).fillPoints([{ x: bl.x, y: bl.y }, { x: br.x, y: br.y }, { x: br.x, y: br.y + 14 }, { x: bl.x, y: bl.y + 14 }] as Phaser.Math.Vector2[], true);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const pts = [boardPoint(c, r), boardPoint(c + 1, r), boardPoint(c + 1, r + 1), boardPoint(c, r + 1)] as Phaser.Math.Vector2[];
      const foe = r < 4;
      const terr = m.terrain[`${c},${r}`];
      g.fillStyle(terr ? TERRAIN[terr].color : foe ? ((c + r) % 2 ? C.foeA : C.foeB) : (c + r) % 2 ? C.tileA : C.tileB, terr ? 0.75 : 1);
      g.fillPoints(pts, true);
      g.lineStyle(1.2, C.cyan, 0.4).strokePoints(pts, true);
      if (terr) {
        const ctr = project(c, r);
        g.lineStyle(1.5, terr === 'furnace' ? 0xffd34d : 0xffffff, 0.6);
        if (terr === 'furnace') for (let k = -1; k <= 1; k++) g.lineBetween(ctr.x - 14 * ctr.s, ctr.y + k * 5 * ctr.s, ctr.x + 14 * ctr.s, ctr.y + k * 5 * ctr.s);
        if (terr === 'charger') g.strokeCircle(ctr.x, ctr.y, 8 * ctr.s);
        if (terr === 'plate') for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.fillStyle(0x2b2d42).fillCircle(ctr.x + dx * 14 * ctr.s, ctr.y + dy * 6 * ctr.s, 1.6);
        if (terr === 'oil') g.fillStyle(0x6a6aa0, 0.6).fillEllipse(ctr.x - 6, ctr.y - 2, 10 * ctr.s, 4 * ctr.s);
      }
    }
    // The bench slots, under the benched robots (the HUD would cover them).
    for (let i = 0; i < BENCH.count; i++) {
      g.fillStyle(0x15122e, 0.85).fillRoundedRect(benchX(i) - BENCH.w / 2, BENCH.y - BENCH.h / 2, BENCH.w, BENCH.h, 7);
      g.lineStyle(1, C.panelLine, 1).strokeRoundedRect(benchX(i) - BENCH.w / 2, BENCH.y - BENCH.h / 2, BENCH.w, BENCH.h, 7);
    }
    const ml = boardPoint(0, 4);
    const mr = boardPoint(8, 4);
    g.lineStyle(2, C.cyan, 0.75).lineBetween(ml.x, ml.y, mr.x, mr.y);
  }

  private render() {
    const m = this.state;
    if (this.boardDirty) {
      this.boardDirty = false;
      this.drawBoard();
    }
    const phaseKey = m ? `${m.phase}|${m.round.stage}-${m.round.index}|${m.phase === 'plan' && player(m).augmentOffer ? 'aug' : ''}` : 'menu';
    if (phaseKey !== this.phaseShown) {
      this.phaseShown = phaseKey;
      this.dirty = true;
    }
    this.syncViews();
    this.drawUnits();
    this.drawFx();
    this.drawDraft();
    this.drawCommanders();
    this.drawNumbers();
    if (this.dirty) {
      this.dirty = false;
      this.buildHud();
      this.buildOverlay();
    }
    this.drawLive();
  }

  private drawUnits() {
    const u = this.underG;
    const b = this.barsG;
    u.clear();
    b.clear();
    const m = this.state;
    const battle = m?.battle && (m.phase === 'fight' || m.phase === 'result') ? m.battle : null;
    const hl = this.highlight();
    if (hl) {
      for (const t of hl.tiles) {
        const pts = [boardPoint(t.col, t.row), boardPoint(t.col + 1, t.row), boardPoint(t.col + 1, t.row + 1), boardPoint(t.col, t.row + 1)] as Phaser.Math.Vector2[];
        u.fillStyle(C.cyan, t.strong ? 0.35 : 0.12).fillPoints(pts, true);
      }
    }
    for (const v of this.views.values()) {
      let x = v.x;
      let y = v.y;
      if (v.lunge) {
        const k = (this.t - v.lunge.at) / 0.2;
        if (k >= 1) v.lunge = null;
        else {
          const f = Math.sin(Math.PI * k);
          x += v.lunge.dx * f * v.s;
          y += v.lunge.dy * f * v.s * 0.6;
        }
      }
      const castK = (this.t - v.castAt) / 0.45;
      const lift = castK >= 0 && castK < 1 ? Math.sin(Math.PI * castK) * 8 * v.s : 0;
      const idle = reduced ? 0 : Math.sin(this.t * 3 + v.x * 0.05) * 1.2;
      const deadK = v.diedAt > 0 ? Math.min(1, (this.t - v.diedAt) / 0.6) : 0;
      const sc = v.s * UNIT_SCALE * (1 + (v.star - 1) * 0.12);
      v.box.setPosition(x, y - lift + idle * v.s).setScale(sc).setDepth(100 + y);
      v.box.setAngle(deadK * (v.team === 0 ? -70 : 70)).setAlpha(1 - deadK);
      const flash = this.t - v.flashAt < 0.08;
      if (flash) v.body.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      else if (v.gilded) v.body.setTint(0xffe08a).setTintMode(Phaser.TintModes.MULTIPLY);
      else v.body.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      if (deadK >= 1) continue;
      // The shadow and team ring under the robot.
      u.fillStyle(0x000000, 0.35).fillEllipse(v.x, v.y + 1, 40 * sc, 12 * sc);
      u.lineStyle(2, v.gilded ? 0xffd166 : v.team === 0 ? C.cyan : 0xff6b8a, 0.9).strokeEllipse(v.x, v.y + 1, 34 * sc, 10 * sc);
      const sel = this.selected?.kind === 'unit' && m && unitAt(player(m), this.selected.spot);
      if (sel && v.key === `o${sel.uid}`) u.lineStyle(2.5, 0xffd166, 1).strokeEllipse(v.x, v.y + 1, 44 * sc, 14 * sc);
      // Bars and stars over the robot.
      const by = y - lift - 58 * sc;
      const bw = 34 * sc;
      const bu = battle?.units.find((q) => `b${q.id}` === v.key);
      if (battle && bu) {
        if (!bu.alive) continue;
        b.fillStyle(0x000000, 0.7).fillRect(v.x - bw / 2 - 1, by - 1, bw + 2, 8);
        b.fillStyle(v.team === 0 ? C.good : C.bad).fillRect(v.x - bw / 2, by, bw * Math.max(0, bu.hp / bu.maxHp), 4);
        if (bu.shield > 0) b.fillStyle(0xffffff, 0.85).fillRect(v.x - bw / 2, by, Math.min(bw, (bw * bu.shield) / bu.maxHp), 2);
        if (bu.maxMana > 0) b.fillStyle(C.mana).fillRect(v.x - bw / 2, by + 5, bw * Math.min(1, bu.mana / bu.maxMana), 2);
      }
      if (!bu?.monster) for (let i = 0; i < v.star; i++) this.star(b, v.x - (v.star - 1) * 5 + i * 10, by - 7, v.star === 3 ? 0xffd166 : v.star === 2 ? 0xd0d8e8 : 0xc08a4a);
    }
  }

  private star(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number) {
    const pts: { x: number; y: number }[] = [];
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const r = k % 2 ? 1.8 : 4.2;
      pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
    }
    g.fillStyle(color).fillPoints(pts as Phaser.Math.Vector2[], true);
    g.lineStyle(1, INK_NUM, 1).strokePoints(pts as Phaser.Math.Vector2[], true);
  }

  private viewPos(id: number | undefined) {
    const v = id != null ? this.views.get(`b${id}`) : undefined;
    return v ? { x: v.x, y: v.y - 34 * v.s, s: v.s } : null;
  }

  private drawFx() {
    const g = this.fxG;
    g.clear();
    this.fx = this.fx.filter((f) => this.t - f.at < f.dur);
    for (const f of this.fx) {
      const k = (this.t - f.at) / f.dur;
      switch (f.kind) {
        case 'proj': {
          const a = this.viewPos(f.from);
          const b = this.viewPos(f.to);
          if (!a || !b) break;
          const x = a.x + (b.x - a.x) * k;
          const arc = f.proj === 'shell' ? 60 : f.proj === 'shot' ? 12 : 0;
          const y = a.y + (b.y - a.y) * k - Math.sin(Math.PI * k) * arc;
          if (f.proj === 'snipe') {
            g.lineStyle(3, 0xff5cf0, 1 - k * 0.5).lineBetween(a.x, a.y, x, y);
            g.lineStyle(1, 0xffffff, 1).lineBetween(a.x, a.y, x, y);
          } else {
            g.fillStyle(0x000000, 0.3).fillEllipse(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k + 26, 8, 3);
            g.fillStyle(f.proj === 'shell' ? 0xff9a3c : f.crit ? 0xffd166 : 0xe8f6ff).fillCircle(x, y, f.proj === 'shell' ? 4.5 : 2.6);
            if (f.proj === 'shell') g.lineStyle(2, 0xff9a3c, 0.4).lineBetween(x, y, x - (b.x - a.x) * 0.06, y + 4);
          }
          break;
        }
        case 'lightning': {
          const a = this.viewPos(f.from);
          if (!a) break;
          for (const id of f.toList ?? []) {
            const b = this.viewPos(id);
            if (b) this.bolt(g, a.x, a.y - 10, b.x, b.y, 0x7cf3ff, 1 - k);
          }
          break;
        }
        case 'zap': {
          const b = this.viewPos(f.to);
          const from = f.x === 0 ? { x: this.avatarPos.x, y: this.avatarPos.y - 40 } : { x: RIVAL_HOME.x, y: RIVAL_HOME.y - 40 };
          if (b) this.bolt(g, from.x, from.y, b.x, b.y, 0xffd34d, 1 - k);
          break;
        }
        case 'ring': {
          const p = this.viewPos(f.from) ?? (f.x != null && f.y != null ? { x: f.x, y: f.y, s: 1 } : null);
          if (!p) break;
          const r = (14 + k * (f.x === 2 ? 70 : 34)) * p.s;
          g.lineStyle(3, f.color ?? C.cyan, 1 - k).strokeEllipse(p.x, p.y + 24 * p.s, r * 2, r * 0.7);
          break;
        }
        case 'bubble': {
          const p = this.viewPos(f.from);
          if (!p) break;
          g.lineStyle(2, 0x9fd8ff, 0.9 * (1 - k)).fillStyle(0x9fd8ff, 0.18 * (1 - k)).fillCircle(p.x, p.y, 24 * p.s).strokeCircle(p.x, p.y, 24 * p.s);
          break;
        }
        case 'sparks': {
          for (let i = 0; i < 10; i++) {
            const a = ((f.seed ?? 0) * 1.7 + i * 0.63) % (Math.PI * 2);
            const d = 6 + k * (20 + (i % 3) * 8);
            g.fillStyle(f.color ?? 0xffffff, 1 - k).fillCircle(f.x! + Math.cos(a) * d, f.y! + Math.sin(a) * d * 0.7 - k * 10, 2.2 - k);
          }
          break;
        }
        case 'puff':
          g.fillStyle(f.color ?? 0xffffff, 0.5 * (1 - k)).fillCircle(f.x!, f.y! - 10, 8 + k * 16);
          break;
        case 'stun': {
          const p = this.viewPos(f.from);
          if (!p) break;
          for (let i = 0; i < 3; i++) {
            const a = (reduced ? 0 : this.t * 5) + (i * Math.PI * 2) / 3;
            g.fillStyle(0xffd34d, 1 - k * 0.5).fillCircle(p.x + Math.cos(a) * 10 * p.s, p.y - 40 * p.s + Math.sin(a) * 3, 2);
          }
          break;
        }
      }
    }
    // Item and gold orbs dropped by monsters.
    for (const o of this.orbs) {
      const bob = reduced ? 0 : Math.sin((this.t - o.at) * 4) * 2;
      g.fillStyle(0x000000, 0.3).fillEllipse(o.x, o.y + 4, 14, 5);
      g.fillStyle(o.item ? 0xc78bff : 0xffd166, 0.95).fillCircle(o.x, o.y - 8 + bob, 7);
      g.lineStyle(2, 0xffffff, 0.9).strokeCircle(o.x, o.y - 8 + bob, 7);
    }
  }

  private bolt(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, color: number, alpha: number) {
    const pts: { x: number; y: number }[] = [{ x: x1, y: y1 }];
    for (let i = 1; i < 6; i++) {
      const k = i / 6;
      const off = ((i * 7919) % 11) - 5;
      pts.push({ x: x1 + (x2 - x1) * k + off, y: y1 + (y2 - y1) * k + off * 0.6 });
    }
    pts.push({ x: x2, y: y2 });
    g.lineStyle(4, color, alpha * 0.4).strokePoints(pts as Phaser.Math.Vector2[]);
    g.lineStyle(1.6, 0xffffff, alpha).strokePoints(pts as Phaser.Math.Vector2[]);
  }

  private drawDraft() {
    const m = this.state;
    if (!m?.draft) return;
    const d = m.draft;
    const n = d.options.length;
    d.options.forEach((o, i) => {
      const img = this.draftImgs[i];
      if (!img) return;
      const p = this.draftSpot(i, n);
      const taken = o.takenBy !== null;
      img.body.setPosition(p.x, p.y).setScale((p.s * 0.95) / (textureRes.get(unitKey(o.defId)) ?? 2)).setDepth(100 + p.y).setAlpha(taken ? 0.25 : 1);
      img.icon.setPosition(p.x, p.y - 74 * p.s).setDepth(101 + p.y).setAlpha(taken ? 0.25 : 1);
      this.underG.fillStyle(0x000000, 0.35).fillEllipse(p.x, p.y + 1, 40 * p.s, 12 * p.s);
      this.underG.lineStyle(2, COST_COLOR[UNIT_BY_ID[o.defId].cost], taken ? 0.2 : 0.9).strokeEllipse(p.x, p.y + 1, 36 * p.s, 11 * p.s);
    });
  }

  private drawCommanders() {
    const m = this.state;
    this.avatar.setVisible(!!m && m.phase !== 'won' && m.phase !== 'lost');
    const walkDt = this.t - this.avatarT;
    this.avatarT = this.t;
    // Play again clears the match while a rival's taunt may still be showing.
    if (!m) {
      this.bubble.setVisible(false);
      return;
    }
    // Walk to the oldest orb, pick it up, then back home.
    const orb = this.orbs[0];
    const goal = orb ? { x: orb.x, y: orb.y + 6 } : COMMANDER_HOME;
    const dx = goal.x - this.avatarPos.x;
    const dy = goal.y - this.avatarPos.y;
    const dist = Math.hypot(dx, dy);
    // `t` already runs at the fight's playback speed and once per watch step.
    const step = 130 * walkDt;
    let walking = false;
    if (dist > 3) {
      walking = true;
      this.avatarPos.x += (dx / dist) * Math.min(step, dist);
      this.avatarPos.y += (dy / dist) * Math.min(step, dist);
    } else if (orb) {
      this.orbs.shift();
      this.sfx('orb');
      this.fx.push({ kind: 'sparks', at: this.t, dur: 0.6, x: orb.x, y: orb.y - 8, seed: 3, color: orb.item ? 0xc78bff : 0xffd166 });
      // An item that no longer fits on the full item bench is lost when the fight is settled.
      const label = !orb.item ? t('plusGold', { n: orb.gold ?? 0 }) : this.orbRoom-- > 0 ? t(ITEMS[orb.item].name) : t('partsFull');
      this.number({ x: orb.x, y: orb.y + 30, s: 1 }, label, orb.item ? '#c78bff' : C.gold, 12, 1.2);
    }
    const hopK = (this.t - this.avatarHop) / 0.5;
    const hop = reduced ? 0 : walking ? Math.abs(Math.sin(this.t * 10)) * 4 : hopK >= 0 && hopK < 1 ? Math.sin(Math.PI * hopK) * 12 : 0;
    this.avatar.setPosition(this.avatarPos.x, this.avatarPos.y - hop).setScale(1 / (textureRes.get(this.avatar.texture.key) ?? 2)).setDepth(100 + this.avatarPos.y).setFlipX(dx < -3);
    this.rivalImg.setScale(1 / (textureRes.get(this.rivalImg.texture.key) ?? 2)).setDepth(90);
    const taunt = m.taunt && m.time < m.taunt.until ? m.taunt : null;
    this.bubble.setVisible(!!taunt);
    if (taunt) {
      const row = PLAYERS_PANEL.y + taunt.seat * PLAYERS_PANEL.rowH;
      const onBoard = this.rivalImg.visible && m.opponent === taunt.seat;
      this.bubble.setText(t('taunt', { name: t(m.players[taunt.seat].name), text: t(taunt.text) }));
      if (onBoard) this.bubble.setOrigin(1, 1).setPosition(RIVAL_HOME.x - 14, RIVAL_HOME.y - 36);
      else this.bubble.setOrigin(1, 0.5).setPosition(PLAYERS_PANEL.x - 6, row + 14);
    }
  }

  private drawNumbers() {
    for (const n of this.numbers) {
      const k = (this.t - n.at) / n.dur;
      if (k >= 1) {
        n.text.setVisible(false);
        continue;
      }
      n.text.setPosition(n.x, n.y - k * 22).setAlpha(k > 0.7 ? (1 - k) / 0.3 : 1);
    }
  }

  // ------------------------------------------------------------------ HUD

  private txt(x: number, y: number, s: string, size = 12, color = C.text, opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) {
    const t = this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, ...opts });
    this.hud.add(t);
    return t;
  }

  private button(g: Phaser.GameObjects.Graphics, r: { x: number; y: number; w: number; h: number }, label: string, run: () => void, opts: { on?: boolean; color?: number; size?: number; list?: Button[]; container?: Phaser.GameObjects.Container } = {}) {
    const on = opts.on ?? true;
    const color = opts.color ?? C.cyan;
    g.fillStyle(on ? 0x1d1846 : 0x15122e, 1).fillRoundedRect(r.x, r.y, r.w, r.h, 7);
    g.lineStyle(2, color, on ? 0.95 : 0.3).strokeRoundedRect(r.x, r.y, r.w, r.h, 7);
    const t = this.add.text(r.x + r.w / 2, r.y + r.h / 2, label, { fontFamily: FONT, fontSize: `${opts.size ?? 12}px`, color: on ? '#ffffff' : '#6a6890', fontStyle: 'bold', align: 'center' }).setOrigin(0.5);
    (opts.container ?? this.hud).add(t);
    // A tap on a greyed-out button gets the refusal buzz rather than nothing.
    (opts.list ?? this.buttons).push({ ...r, run: on ? run : () => ui('refuse') });
  }

  private buildHud() {
    for (const child of [...this.hud.list]) if (child !== this.hudG) child.destroy();
    this.hudG.clear();
    this.buttons = [];
    const m = this.state;
    if (!m) return;
    const g = this.hudG;
    const me = player(m);
    // Top bar.
    g.fillStyle(0x0a0818, 0.75).fillRect(0, 0, VIEW.w, 30);
    // Left: traits.
    const traits = countTraits(boardUnits(me));
    const shownTraits = (Object.entries(traits) as [TraitId, number][]).sort((a, b) => {
      const ta = traitValue(traits, a[0]) ? 1 : 0;
      const tb = traitValue(traits, b[0]) ? 1 : 0;
      return tb - ta || b[1] - a[1];
    }).slice(0, TRAITS_PANEL.maxRows);
    this.txt(TRAITS_PANEL.x + 4, TRAITS_PANEL.y - 2, t('traits'), 10, C.dim, { fontStyle: 'bold' });
    shownTraits.forEach(([id, n], i) => {
      const def = TRAITS[id];
      const y = TRAITS_PANEL.y + 12 + i * TRAITS_PANEL.rowH;
      const active = traitValue(traits, id) > 0;
      const next = def.tiers.find((tier) => tier > n) ?? def.tiers[def.tiers.length - 1];
      g.fillStyle(active ? 0x2a2360 : C.panel, 0.92).fillRoundedRect(TRAITS_PANEL.x, y, 150, TRAITS_PANEL.rowH - 3, 5);
      if (active) g.lineStyle(1.5, def.kind === 'origin' ? ORIGIN_COLOR[id as keyof typeof ORIGIN_COLOR] : C.cyan, 0.9).strokeRoundedRect(TRAITS_PANEL.x, y, 150, TRAITS_PANEL.rowH - 3, 5);
      g.fillStyle(def.kind === 'origin' ? ORIGIN_COLOR[id as keyof typeof ORIGIN_COLOR] : 0xd0d8e8).fillCircle(TRAITS_PANEL.x + 10, y + 9, 4.5);
      this.txt(TRAITS_PANEL.x + 20, y + 2, t(def.name), 11, active ? '#ffffff' : C.dim, { fontStyle: active ? 'bold' : 'normal' });
      this.txt(TRAITS_PANEL.x + 112, y + 2, `${n}/${next}`, 11, active ? C.gold : C.dim);
      this.buttons.push({ x: TRAITS_PANEL.x, y, w: 150, h: TRAITS_PANEL.rowH - 3, run: () => {
        this.infoTrait = this.infoTrait === id ? null : id;
        this.selected = null;
        this.dirty = true;
      } });
    });
    // Left: parts and items.
    this.txt(ITEMS_PANEL.x, ITEMS_PANEL.y - 16, t(me.items.length ? 'partsHint' : 'parts'), 10, C.dim, { fontStyle: 'bold' });
    for (let i = 0; i < ITEM_BENCH; i++) {
      const x = ITEMS_PANEL.x + (i % ITEMS_PANEL.cols) * (ITEMS_PANEL.size + 3);
      const y = ITEMS_PANEL.y + Math.floor(i / ITEMS_PANEL.cols) * (ITEMS_PANEL.size + 3);
      const sel = this.selected?.kind === 'item' && this.selected.index === i;
      g.fillStyle(C.panel, 0.9).fillRoundedRect(x, y, ITEMS_PANEL.size, ITEMS_PANEL.size, 5);
      g.lineStyle(sel ? 2 : 1, sel ? 0xffd166 : C.panelLine, 1).strokeRoundedRect(x, y, ITEMS_PANEL.size, ITEMS_PANEL.size, 5);
      const id = me.items[i];
      if (id) this.hud.add(this.add.image(x + ITEMS_PANEL.size / 2, y + ITEMS_PANEL.size / 2, itemKey(id)).setScale(1.15 / (textureRes.get(itemKey(id)) ?? 3)));
    }
    // Left bottom: gold, level and buttons.
    const lb = LEFT_BOTTOM.y;
    g.fillStyle(C.panel, 0.92).fillRoundedRect(LEFT_BOTTOM.x, lb, 152, 108, 8);
    this.txt(16, lb + 4, `${me.gold}`, 20, C.gold, { fontStyle: 'bold' });
    this.txt(16 + 12 * String(me.gold).length + 4, lb + 10, t('gold'), 11, C.dim);
    this.txt(92, lb + 2, t('level', { n: me.level }), 13, '#ffffff', { fontStyle: 'bold' });
    const need = xpToNext(me);
    g.fillStyle(0x000000, 0.6).fillRect(92, lb + 20, 60, 5);
    g.fillStyle(C.mana).fillRect(92, lb + 20, need ? (60 * me.xp) / need : 60, 5);
    this.txt(92, lb + 25, need ? t('xp', { xp: me.xp, need }) : t('maxLevel'), 9, C.dim);
    const planning = m.phase === 'plan';
    this.button(g, BUTTONS.reroll, me.freeRolls > 0 ? t('rerollFree', { n: me.freeRolls }) : t('reroll', { n: rerollCost(me) }), () => this.doReroll(), { on: planning && me.human && me.gold >= rerollCost(me), size: 11 });
    this.button(g, BUTTONS.xp, t('buyXp', { n: ECONOMY.xpCost }), () => this.doXp(), { on: planning && me.human && me.gold >= ECONOMY.xpCost && me.level < MAX_LEVEL, size: 11 });
    const selUnit = this.selected?.kind === 'unit' ? unitAt(me, this.selected.spot) : null;
    if (selUnit && planning) this.button(g, BUTTONS.sell, t('sellFor', { n: sellValue(selUnit) }), () => this.doSell(), { color: 0xffb703, size: 11 });
    else this.txt(80, lb + 82, t('boardCount', { n: boardCount(me), max: me.level }), 11, boardCount(me) > me.level ? '#ff8a7a' : C.dim);
    // The shop.
    me.shop.forEach((s, i) => {
      const x = shopCardX(i);
      const y = SHOP.y;
      g.fillStyle(C.panel, 0.95).fillRoundedRect(x, y, SHOP.cardW, SHOP.h, 8);
      if (!s) {
        g.lineStyle(1, C.panelLine, 0.6).strokeRoundedRect(x, y, SHOP.cardW, SHOP.h, 8);
        return;
      }
      const def = UNIT_BY_ID[s.defId];
      const cost = unitCost(s);
      const can = planning && me.gold >= cost;
      g.lineStyle(2.5, s.gilded ? 0xffd166 : COST_COLOR[def.cost], can ? 1 : 0.4).strokeRoundedRect(x, y, SHOP.cardW, SHOP.h, 8);
      g.fillStyle(ORIGIN_COLOR[def.origin], 0.16).fillRoundedRect(x + 3, y + 3, SHOP.cardW - 6, 58, 6);
      const img = this.add.image(x + 30, y + 62, unitKey(def.id)).setOrigin(0.5, UNIT_TEX.footY / UNIT_TEX.h).setScale(1.05 / (textureRes.get(unitKey(def.id)) ?? 2)).setAlpha(can ? 1 : 0.55);
      if (s.gilded) img.setTint(0xffe08a);
      this.hud.add(img);
      this.txt(x + 58, y + 6, `${cost}`, 14, `#${COST_COLOR[def.cost].toString(16)}`, { fontStyle: 'bold' });
      this.txt(x + 72, y + 9, t('gold'), 9, C.dim);
      this.txt(x + 58, y + 26, t(TRAITS[def.origin].name) + (s.gilded ? `\n+${t(TRAITS[s.gilded].name)}` : ''), 9, s.gilded ? C.gold : `#${ORIGIN_COLOR[def.origin].toString(16)}`);
      this.txt(x + 58, y + (s.gilded ? 50 : 40), t(TRAITS[def.cls].name), 9, '#d0d8e8');
      this.txt(x + 6, y + 66, s.gilded ? t('gilded', { name: t(def.name) }) : t(def.name), 11, '#ffffff', { fontStyle: 'bold', wordWrap: { width: SHOP.cardW - 10 } });
      if (!me.human) return;
      if (can) this.buttons.push({ x, y, w: SHOP.cardW, h: SHOP.h, run: () => this.doBuy(i) });
      else if (planning) this.buttons.push({ x, y, w: SHOP.cardW, h: SHOP.h, run: () => ui('refuse') });
    });
    // Right: the players.
    m.players.forEach((p, i) => {
      const y = PLAYERS_PANEL.y + i * PLAYERS_PANEL.rowH;
      const opp = m.opponent === p.seat && (m.phase === 'fight' || m.phase === 'result');
      g.fillStyle(p.seat === 0 ? 0x1d2a5a : C.panel, p.alive ? 0.92 : 0.4).fillRoundedRect(PLAYERS_PANEL.x, y, PLAYERS_PANEL.w, PLAYERS_PANEL.rowH - 3, 6);
      if (opp) g.lineStyle(2, 0xff6b8a, 1).strokeRoundedRect(PLAYERS_PANEL.x, y, PLAYERS_PANEL.w, PLAYERS_PANEL.rowH - 3, 6);
      this.hud.add(this.add.image(PLAYERS_PANEL.x + 13, y + 26, cmdKey(p.commander.name)).setOrigin(0.5, 1).setScale(0.5 / (textureRes.get(cmdKey(p.commander.name)) ?? 2)).setAlpha(p.alive ? 1 : 0.4));
      this.txt(PLAYERS_PANEL.x + 26, y + 2, t(p.name), 10, p.alive ? '#ffffff' : C.dim, { fontStyle: p.seat === 0 ? 'bold' : 'normal' });
      const hpW = 80;
      g.fillStyle(0x000000, 0.6).fillRect(PLAYERS_PANEL.x + 26, y + 17, hpW, 5);
      g.fillStyle(p.seat === 0 ? C.cyan : C.good).fillRect(PLAYERS_PANEL.x + 26, y + 17, Math.min(hpW, (hpW * Math.max(0, p.hp)) / p.maxHp), 5);
      this.txt(PLAYERS_PANEL.x + 110, y + 11, p.alive ? `${Math.max(0, p.hp)}` : `#${p.place}`, 11, p.alive ? '#ffffff' : C.dim, { fontStyle: 'bold' });
      if (p.last && p.alive) g.fillStyle(p.last === 'win' ? C.good : p.last === 'loss' ? C.bad : 0xffd166).fillCircle(PLAYERS_PANEL.x + PLAYERS_PANEL.w - 6, y + 6, 3);
      if (this.scout === p.seat) g.lineStyle(2, 0xffd166, 1).strokeRoundedRect(PLAYERS_PANEL.x, y, PLAYERS_PANEL.w, PLAYERS_PANEL.rowH - 3, 6);
      // Tap a rival during planning to scout its board.
      if (planning && p.alive && p.seat !== 0) this.buttons.push({ x: PLAYERS_PANEL.x, y, w: PLAYERS_PANEL.w, h: PLAYERS_PANEL.rowH - 3, run: () => {
        this.scout = this.scout === p.seat ? null : p.seat;
        ui('click');
        this.selected = null;
        this.infoTrait = null;
        this.dirty = true;
      } });
    });
    this.buildInfo(g);
    // Right bottom: fight, skill and speed.
    if (m.phase === 'plan') this.button(g, BUTTONS.fight, t('fight'), () => this.goFight(), { size: 15, color: 0xffb703, on: me.human });
    else if (m.phase === 'fight' && m.battle) {
      const skill = SKILLS[me.commander.skill];
      const used = m.battle.skillUsed[0] || m.battle.done;
      this.button(g, BUTTONS.skill, t(used ? 'skillUsed' : 'skillKey', { skill: t(skill.name) }), () => this.doSkill(), { on: !used && me.human, size: 13, color: 0xff5cf0 });
    }
    if (m.phase === 'fight' || m.phase === 'result' || m.phase === 'plan') this.button(g, BUTTONS.speed, t('speed', { n: this.speed }), () => this.toggleSpeed(), { size: 11 });
    if (m.opts.terrain) this.txt(TERRAIN_LEGEND.x, TERRAIN_LEGEND.y, t('terrainLegend'), 9, C.dim);
    if (planning) {
      const locked = me.shopLocked;
      this.button(g, BUTTONS.lock, t(locked ? 'locked' : 'lock'), () => this.toggleLock(), { on: me.human, size: 10, color: locked ? 0xffd166 : C.panelLine });
    }
    this.buildPreview(me);
  }

  /** With a part or item picked up, a tag over each robot names what bolting it on would give. */
  private buildPreview(me: Player) {
    const held = this.dragging ? this.held : this.selected;
    if (this.state?.phase !== 'plan' || held?.kind !== 'item') return;
    const id = me.items[held.index];
    if (!id) return;
    const tag = (o: Owned, x: number, y: number) => {
      const out = equipPreview(id, o);
      const label = out === null ? t('previewFull') : out === id ? `+ ${t(ITEMS[id].name)}` : t(ITEMS[out].name);
      const tag = this.txt(x, y, label, 9, out === null ? C.dim : out === id ? '#d0d8e8' : '#c78bff', { fontStyle: 'bold', backgroundColor: '#0a0818cc', padding: { x: 3, y: 1 } });
      tag.setOrigin(0.5, 1);
    };
    for (const [k, o] of Object.entries(me.board)) {
      const [col, row] = k.split(',').map(Number);
      const p = project(col, row);
      tag(o, p.x, p.y - 96 * p.s);
    }
    me.bench.forEach((o, i) => o && tag(o, benchX(i), BENCH.y - BENCH.h / 2 - 1));
  }

  private buildInfo(g: Phaser.GameObjects.Graphics) {
    const m = this.state!;
    const me = player(m);
    const r = INFO_PANEL;
    this.infoRect = null;
    const unit = this.selected?.kind === 'unit' ? unitAt(me, this.selected.spot) : null;
    const item = this.selected?.kind === 'item' ? me.items[this.selected.index] : null;
    const rival = this.scout !== null && m.phase === 'plan' ? m.players[this.scout] : null;
    const meter = (m.phase === 'plan' || m.phase === 'result') && m.meter.length ? m.meter : null;
    let title = '';
    let body = '';
    if (unit) {
      const def = UNIT_BY_ID[unit.defId];
      const cs = CLASS_STATS[def.cls];
      title = `${unit.gilded ? t('gilded', { name: t(def.name) }) : t(def.name)} ${'★'.repeat(unit.star)}`;
      const traitNames = `${t(TRAITS[def.origin].name)}${unit.gilded ? ` + ${t(TRAITS[unit.gilded].name)}` : ''}`;
      body = t('unitInfo', { traits: traitNames, cls: t(TRAITS[def.cls].name), ability: t(cs.abilityName), range: cs.range, cost: unitCost(unit) });
      if (unit.items.length) body += `\n${unit.items.map((i) => t(ITEMS[i].name)).join(', ')}`;
    } else if (item) {
      const def = ITEMS[item];
      title = t(def.name);
      if (def.from.length) body = `${t(def.text)}\n${def.from.map((p) => t(ITEMS[p].text)).join(', ')}`;
      else {
        const recipes = PARTS.filter((p) => p !== item).map((p) => `${t(ITEMS[p].name)}: ${t(comboOf(item as PartId, p).name)}`);
        recipes.push(`${t('anotherPart', { name: t(def.name) })}: ${t(comboOf(item as PartId, item as PartId).name)}`);
        body = `${t(def.text)}\n${t('recipes', { list: recipes.join('; ') })}`;
      }
    } else if (this.infoTrait) {
      const def = TRAITS[this.infoTrait];
      title = `${t(def.name)} (${def.tiers.join(' / ')})`;
      body = t(def.text, { v: def.values.join('/') });
    } else if (rival) {
      const traits = countTraits(boardUnits(rival));
      const active = (Object.keys(traits) as TraitId[]).filter((id) => traitValue(traits, id) > 0).map((id) => `${t(TRAITS[id].name)} ${traits[id]}`);
      title = t('rivalBoard', { name: t(rival.name) });
      body = `${t('rivalInfo', { level: rival.level, gold: rival.gold, n: boardCount(rival) })}\n${active.length ? active.join(', ') : t('noTraits')}${rival.augments.length ? `\n${rival.augments.map((a) => t(AUGMENT_BY_ID[a].name)).join(', ')}` : ''}`;
    } else if (meter && this.infoPage === 'meter') {
      return this.buildMeter(g, meter, m.phase === 'plan');
    } else if (m.phase === 'plan') {
      const set = SETS.find((s) => s.id === m.opts.set)!;
      title = t(me.augments.length ? 'powerCards' : set.name);
      body = me.augments.length ? me.augments.map((a) => t(AUGMENT_BY_ID[a].name)).join('\n') : `${t(set.blurb)}${m.opts.set === 'scrap' ? `\n${t('tokens', { n: me.scrapTokens, max: SCRAP_TOKENS_PER_PART })}` : ''}`;
      if (meter) this.infoRect = r;
    } else return;
    g.fillStyle(C.panel, 0.95).fillRoundedRect(r.x, r.y, r.w, r.h, 8);
    g.lineStyle(1, C.panelLine, 1).strokeRoundedRect(r.x, r.y, r.w, r.h, 8);
    this.txt(r.x + 8, r.y + 6, title, 11, C.gold, { fontStyle: 'bold', wordWrap: { width: r.w - 14 } });
    this.txt(r.x + 8, r.y + 24, body, item && !ITEMS[item].from.length ? 9 : 10, C.text, { wordWrap: { width: r.w - 14 }, lineSpacing: 2 });
    if (this.infoRect) this.txt(r.x + r.w - 8, r.y + r.h - 16, t('tapDamage'), 9, C.dim).setOrigin(1, 0);
  }

  /** The damage meter: the player's robots in the last fight, by damage dealt (bar) and taken (number). */
  private buildMeter(g: Phaser.GameObjects.Graphics, rows: MeterRow[], toggles: boolean) {
    const r = INFO_PANEL;
    g.fillStyle(C.panel, 0.95).fillRoundedRect(r.x, r.y, r.w, r.h, 8);
    g.lineStyle(1, C.panelLine, 1).strokeRoundedRect(r.x, r.y, r.w, r.h, 8);
    this.txt(r.x + 8, r.y + 6, t('lastFight'), 11, C.gold, { fontStyle: 'bold' });
    const max = Math.max(1, ...rows.map((x) => x.dealt));
    const n = Math.min(rows.length, Math.floor((r.h - 40) / 19));
    rows.slice(0, n).forEach((row, i) => {
      const y = r.y + 24 + i * 19;
      const name = t(UNIT_BY_ID[row.defId].name);
      this.txt(r.x + 8, y, `${name.length > 12 ? `${name.slice(0, 11)}.` : name}${'★'.repeat(row.star - 1)}`, 9, row.alive ? '#ffffff' : C.dim);
      this.txt(r.x + r.w - 8, y, `${row.dealt}`, 9, C.gold, { fontStyle: 'bold' }).setOrigin(1, 0);
      g.fillStyle(0x000000, 0.5).fillRect(r.x + 8, y + 12, r.w - 16, 3);
      g.fillStyle(ORIGIN_COLOR[UNIT_BY_ID[row.defId].origin]).fillRect(r.x + 8, y + 12, ((r.w - 16) * row.dealt) / max, 3);
    });
    const tanked = [...rows].sort((a, b) => b.taken - a.taken)[0];
    if (tanked) this.txt(r.x + 8, r.y + r.h - 16, t('tookMost', { name: t(UNIT_BY_ID[tanked.defId].name), n: tanked.taken }), 9, C.dim);
    if (toggles) this.infoRect = r;
  }

  /** Text that changes every frame: the top bar. */
  private drawLive() {
    const m = this.state;
    if (!m) {
      this.topText.setText('');
      return;
    }
    const label = roundLabel(m);
    const kind = t(m.round.kind === 'pvp' ? 'vsRival' : m.round.kind === 'draft' ? 'draft' : m.round.kind === 'rat' ? 'ratChase' : 'vsMonsters');
    let phase = '';
    if (m.phase === 'plan') phase = t('planPhase', { n: Math.max(0, Math.ceil(m.phaseEnds - m.time)) });
    else if (m.phase === 'fight') {
      const rival = m.opponent >= 0 ? t(m.players[m.opponent].name) : '';
      const opp = rival ? (m.ghost ? t('ghost', { name: rival }) : rival) : t(m.round.kind === 'rat' ? 'tapRat' : 'monsters');
      phase = t('fightPhase', { opp, n: m.battle ? Math.floor(m.battle.time) : 0 });
    } else if (m.phase === 'result') phase = t('resultPhase');
    else if (m.phase === 'draft') {
      const d = m.draft;
      const turn = d && d.turn < d.order.length ? m.players[d.order[d.turn]] : null;
      phase = turn ? (turn.seat === 0 && turn.human ? t('yourPick') : t('draftPicks', { name: t(turn.seat === 0 ? 'yourSeat' : turn.name) })) : t('draft');
    }
    this.topText.setText(t('round', { round: label, kind, phase }));
  }

  // ------------------------------------------------------------------ overlays

  private buildOverlay() {
    for (const c of [...this.overlay.list]) c.destroy();
    this.overlayButtons = [];
    const m = this.state;
    const g = this.add.graphics();
    this.overlay.add(g);
    const say = (x: number, y: number, s: string, size: number, color = C.text, opts: Partial<Phaser.Types.GameObjects.Text.TextStyle> = {}) => {
      const o = this.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color, ...opts });
      this.overlay.add(o);
      return o;
    };
    if (!m) return this.buildMenu(g, say);
    const me = player(m);
    if (m.phase === 'plan' && me.human && me.augmentOffer) {
      g.fillStyle(0x05040f, 0.72).fillRect(0, 0, VIEW.w, VIEW.h);
      say(VIEW.w / 2, VIEW.fy + 70, t('pickCard'), 24, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5);
      say(VIEW.w / 2, VIEW.fy + 100, t('pickCardHint'), 12, C.dim).setOrigin(0.5);
      me.augmentOffer.forEach((id, i) => {
        const a = AUGMENT_BY_ID[id];
        const r = { x: VIEW.w / 2 - 330 + i * 230, y: VIEW.fy + 130, w: 200, h: 250 };
        // A rare card is gold-edged and tagged.
        const edge = a.rare ? 0xffd166 : 0xff5cf0;
        g.fillStyle(a.rare ? 0x2a2140 : 0x1d1846, 1).fillRoundedRect(r.x, r.y, r.w, r.h, 14);
        g.lineStyle(3, edge, 1).strokeRoundedRect(r.x, r.y, r.w, r.h, 14);
        if (a.rare) say(r.x + r.w / 2, r.y + 22, t('rareCard'), 12, C.gold, { fontStyle: 'bold' }).setOrigin(0.5);
        g.lineStyle(1.5, C.cyan, 0.6).strokeRoundedRect(r.x + 8, r.y + 8, r.w - 16, r.h - 16, 10);
        g.fillStyle(edge, 0.18).fillCircle(r.x + r.w / 2, r.y + 80, 44);
        say(r.x + r.w / 2, r.y + 80, `${i + 1}`, 40, a.rare ? C.gold : '#ff5cf0', { fontStyle: 'bold' }).setOrigin(0.5);
        say(r.x + r.w / 2, r.y + 150, t(a.name), 17, '#ffffff', { fontStyle: 'bold' }).setOrigin(0.5);
        say(r.x + r.w / 2, r.y + 180, t(a.text), 12, C.text, { align: 'center', wordWrap: { width: r.w - 30 } }).setOrigin(0.5, 0);
        this.overlayButtons.push({ ...r, run: () => this.doAugment(i) });
      });
    } else if (m.phase === 'won' || m.phase === 'lost') {
      g.fillStyle(0x05040f, 0.8).fillRect(0, 0, VIEW.w, VIEW.h);
      const place = m.phase === 'won' ? 1 : me.place;
      say(VIEW.w / 2, VIEW.fy + 150, t(m.phase === 'won' ? 'won' : 'lost'), 34, m.phase === 'won' ? '#7cf3ff' : '#ff8a7a', { fontStyle: 'bold', stroke: INK, strokeThickness: 6 }).setOrigin(0.5);
      say(VIEW.w / 2, VIEW.fy + 200, t(watching ? 'seatFinished' : 'youFinished', { place: ordinal(place), round: roundLabel(m) }), 16, '#ffffff').setOrigin(0.5);
      const rg = this.rankGain;
      if (rg) {
        const rankText = rg.after > rg.before ? t('rankUp', { rank: t(RANKS[rg.after].name) }) : t('rankPoints', { n: rg.gained, rank: t(RANKS[rg.after].name), points: this.progress.points });
        say(VIEW.w / 2, VIEW.fy + 104, rankText, 15, rg.after > rg.before ? C.gold : C.text, { fontStyle: 'bold' }).setOrigin(0.5);
      }
      if (this.unlockedNow.length) say(VIEW.w / 2, VIEW.fy + 248, t('unlockedList', { names: this.unlockedNow.map((c) => t(c.name)).join(', ') }), 12, C.gold, { fontStyle: 'bold' }).setOrigin(0.5);
      say(VIEW.w / 2, VIEW.fy + 228, t('endStats', { played: this.progress.played, wins: this.progress.wins, best: this.progress.best ? ordinal(this.progress.best) : '-' }), 12, C.dim).setOrigin(0.5);
      this.button(g, { x: VIEW.w / 2 - 90, y: VIEW.fy + 270, w: 180, h: 44 }, t(watching ? 'watchAnother' : 'playAgain'), () => {
        ui('click');
        playMusic(PLAN_SONG, 'calm');
        this.state = null;
        this.clearViews();
        this.orbs = [];
        this.rivalImg.setVisible(false);
        this.boardDirty = true;
        this.dirty = true;
        if (watching) this.startMatch();
      }, { list: this.overlayButtons, container: this.overlay, size: 15, color: 0xffb703 });
    }
  }

  private buildMenu(g: Phaser.GameObjects.Graphics, say: (x: number, y: number, s: string, size: number, color?: string, opts?: Partial<Phaser.Types.GameObjects.Text.TextStyle>) => Phaser.GameObjects.Text) {
    g.fillStyle(0x05040f, 0.55).fillRect(0, 0, VIEW.w, VIEW.h);
    say(VIEW.w / 2, VIEW.fy + 46, t('title'), 38, '#7cf3ff', { fontStyle: 'bold', stroke: INK, strokeThickness: 7 }).setOrigin(0.5);
    say(VIEW.w / 2, VIEW.fy + 82, t('tagline'), 13, C.text).setOrigin(0.5);
    say(VIEW.w / 2, VIEW.fy + 112, t('pickCommander'), 14, C.gold, { fontStyle: 'bold' }).setOrigin(0.5);
    // Eight small cards; the picked one's skill (or what unlocks it) is spelled out under them.
    const n = PLAYER_COMMANDERS.length;
    const cw = 104;
    const gap = 8;
    PLAYER_COMMANDERS.forEach((c, i) => {
      const r = { x: VIEW.w / 2 - (n * cw + (n - 1) * gap) / 2 + i * (cw + gap), y: VIEW.fy + 126, w: cw, h: 104 };
      const on = this.menu.commander === i;
      const open = isUnlocked(this.progress, c);
      g.fillStyle(on ? 0x2a2360 : C.panel, 0.95).fillRoundedRect(r.x, r.y, r.w, r.h, 10);
      g.lineStyle(on ? 3 : 1.5, on ? 0xffb703 : C.panelLine, 1).strokeRoundedRect(r.x, r.y, r.w, r.h, 10);
      this.overlay.add(this.add.image(r.x + r.w / 2, r.y + 70, cmdKey(c.name)).setOrigin(0.5, 1).setScale(1.2 / (textureRes.get(cmdKey(c.name)) ?? 2)).setAlpha(open ? 1 : 0.35));
      if (!open) this.padlock(g, r.x + r.w - 16, r.y + 16);
      say(r.x + r.w / 2, r.y + 74, t(c.name), 11, open ? '#ffffff' : C.dim, { fontStyle: 'bold', align: 'center', wordWrap: { width: r.w - 8 } }).setOrigin(0.5, 0);
      this.overlayButtons.push({ ...r, run: () => {
        this.menu.commander = i;
        ui('click');
        this.dirty = true;
      } });
    });
    const pickedC = PLAYER_COMMANDERS[this.menu.commander];
    const pickedOpen = isUnlocked(this.progress, pickedC);
    const skill = SKILLS[pickedC.skill];
    if (pickedOpen) {
      say(VIEW.w / 2, VIEW.fy + 240, `${t(pickedC.name)}: ${t(skill.name)}`, 13, '#ff5cf0', { fontStyle: 'bold' }).setOrigin(0.5, 0);
      say(VIEW.w / 2, VIEW.fy + 260, `${t(skill.text)} ${t('skillHint')}`, 11, C.text, { align: 'center', wordWrap: { width: 640 } }).setOrigin(0.5, 0);
    } else {
      say(VIEW.w / 2, VIEW.fy + 240, t('lockedCommander', { name: t(pickedC.name), skill: t(skill.name) }), 13, C.dim, { fontStyle: 'bold' }).setOrigin(0.5, 0);
      say(VIEW.w / 2, VIEW.fy + 260, t(`${pickedC.unlock!}Unlock`), 11, C.gold, { align: 'center', wordWrap: { width: 640 } }).setOrigin(0.5, 0);
    }
    say(VIEW.w / 2, VIEW.fy + 296, t('season'), 13, C.gold, { fontStyle: 'bold' }).setOrigin(0.5);
    SETS.forEach((s, i) => {
      const r = { x: VIEW.w / 2 - 300 + i * 310, y: VIEW.fy + 312, w: 290, h: 58 };
      const on = this.menu.set === s.id;
      g.fillStyle(on ? 0x2a2360 : C.panel, 0.95).fillRoundedRect(r.x, r.y, r.w, r.h, 10);
      g.lineStyle(on ? 2.5 : 1.2, on ? C.cyan : C.panelLine, 1).strokeRoundedRect(r.x, r.y, r.w, r.h, 10);
      say(r.x + 12, r.y + 8, t(s.name), 13, '#ffffff', { fontStyle: 'bold' });
      say(r.x + 12, r.y + 28, t(s.blurb), 10, C.text, { wordWrap: { width: r.w - 24 } });
      this.overlayButtons.push({ ...r, run: () => {
        this.menu.set = s.id;
        ui('click');
        this.dirty = true;
      } });
    });
    const tr = { x: VIEW.w / 2 - 300, y: VIEW.fy + 384, w: 290, h: 40 };
    g.fillStyle(this.menu.terrain ? 0x2a2360 : C.panel, 0.95).fillRoundedRect(tr.x, tr.y, tr.w, tr.h, 10);
    g.lineStyle(this.menu.terrain ? 2.5 : 1.2, this.menu.terrain ? 0x39e58c : C.panelLine, 1).strokeRoundedRect(tr.x, tr.y, tr.w, tr.h, 10);
    say(tr.x + 12, tr.y + 6, t(this.menu.terrain ? 'terrainOn' : 'terrainOff'), 13, '#ffffff', { fontStyle: 'bold' });
    say(tr.x + 12, tr.y + 24, t('terrainKinds'), 9, C.dim);
    this.overlayButtons.push({ ...tr, run: () => {
      this.menu.terrain = !this.menu.terrain;
      ui('click');
      this.dirty = true;
    } });
    this.button(g, { x: VIEW.w / 2 + 10, y: VIEW.fy + 384, w: 290, h: 40 }, t('startMatch'), () => {
      ui('click');
      this.startMatch();
    }, { list: this.overlayButtons, container: this.overlay, size: 16, color: 0xffb703, on: pickedOpen });
    const rank = rankOf(this.progress.points);
    const next = RANKS[rank + 1];
    say(VIEW.w / 2, VIEW.fy + 466, `${t('rankLine', { rank: t(RANKS[rank].name), points: this.progress.points })}${next ? t('rankNext', { rank: t(next.name), points: next.points }) : ''} · ${t(RANKS[rank].text)}`, 11, C.gold).setOrigin(0.5);
    if (this.progress.played) say(VIEW.w / 2, VIEW.fy + 446, t('menuStats', { played: this.progress.played, wins: this.progress.wins, best: ordinal(this.progress.best) }), 11, C.dim).setOrigin(0.5);
  }

  /** A small padlock on a locked commander's card. */
  private padlock(g: Phaser.GameObjects.Graphics, x: number, y: number) {
    g.lineStyle(2.5, 0xa8b2c8, 1).beginPath().arc(x, y - 3, 5, Math.PI, 0).strokePath();
    g.fillStyle(0xa8b2c8, 1).fillRoundedRect(x - 7, y - 3, 14, 11, 2);
    g.fillStyle(0x15122e, 1).fillCircle(x, y + 2, 1.8);
  }

  // ------------------------------------------------------------------ actions

  private doBuy(i: number) {
    const m = this.state!;
    if (m.phase !== 'plan') return;
    const me = player(m);
    const before = allUnits(me).length;
    if (buy(m, me, i)) {
      // Fewer robots than one more means three copies merged into a star-up.
      this.sfx(allUnits(me).length <= before ? 'starUp' : 'buy');
      this.dirty = true;
    } else ui('refuse');
  }

  private doReroll() {
    const m = this.state!;
    if (m.phase !== 'plan') return;
    if (reroll(m, player(m))) {
      this.sfx('reroll');
      this.dirty = true;
    } else ui('refuse');
  }

  private doXp() {
    const m = this.state!;
    if (m.phase !== 'plan') return;
    const me = player(m);
    const level = me.level;
    if (buyXp(me)) {
      this.sfx(me.level > level ? 'levelUp' : 'xp');
      this.dirty = true;
    } else ui('refuse');
  }

  /** Moves a robot with the player's own hand: a clank, or the buzz when the board is full. */
  private doMove(me: Player, from: Spot, to: Spot) {
    if (moveUnit(me, from, to)) this.sfx('place');
    else ui('refuse');
  }

  /** Bolts a part on: a ratchet, a chime when it builds a finished item, or the buzz when the robot is full. */
  private doEquip(me: Player, index: number, o: Owned) {
    const builds = isPart(me.items[index]) && o.items.some((i) => isPart(i));
    if (equip(me, index, o)) this.sfx(builds ? 'itemBuilt' : 'bolt');
    else ui('refuse');
  }

  private doSellUnit(me: Player, o: Owned) {
    const lost = o.items.length - (ITEM_BENCH - me.items.length);
    sell(me, o);
    this.sfx('sell');
    // Its items go to the item bench; what doesn't fit there is scrapped.
    if (lost > 0) this.number({ x: ITEMS_PANEL.x + 70, y: ITEMS_PANEL.y + 108, s: 1 }, t('partsFull'), '#ff8a7a', 12, 1.2);
  }

  private doSell() {
    const m = this.state!;
    if (m.phase !== 'plan' || this.selected?.kind !== 'unit') return;
    const me = player(m);
    const o = unitAt(me, this.selected.spot);
    if (o) this.doSellUnit(me, o);
    this.selected = null;
    this.dirty = true;
  }

  private doSkill() {
    const m = this.state;
    if (m?.phase !== 'fight' || !m.battle) return;
    if (m.battle.useSkill(0)) this.dirty = true;
    else ui('refuse');
  }

  private doAugment(i: number) {
    const m = this.state!;
    pickAugment(m, player(m), i);
    this.sfx('augment');
    this.dirty = true;
  }

  private toggleLock() {
    const m = this.state;
    if (m?.phase !== 'plan' || !player(m).human) return;
    toggleShopLock(player(m));
    this.sfx('latch');
    this.dirty = true;
  }

  private toggleSpeed() {
    this.speed = this.speed === 1 ? 2 : 1;
    this.sfx('latch');
    this.dirty = true;
  }

  // ------------------------------------------------------------------ input

  /** What is under a point during the plan phase: a bench slot, a board tile, or an item slot. */
  private spotAt(x: number, y: number): Spot | null {
    for (let i = 0; i < BENCH.count; i++) {
      if (Math.abs(x - benchX(i)) <= BENCH.w / 2 && y >= BENCH.y - BENCH.h / 2 && y <= BENCH.y + BENCH.h / 2) return { where: 'bench', i };
    }
    // A robot is hit on its body, which stands above its tile.
    const me = this.state && player(this.state);
    if (me) {
      for (const [k] of Object.entries(me.board).sort((a, b) => Number(b[0].split(',')[1]) - Number(a[0].split(',')[1]))) {
        const [col, row] = k.split(',').map(Number);
        const p = project(col, row);
        if (Math.abs(x - p.x) < 22 * p.s && y < p.y + 6 && y > p.y - 76 * p.s) return { where: 'board', col, row };
      }
    }
    const tile = tileAt(x, y);
    if (tile && tile.row >= 4) return { where: 'board', col: tile.col, row: tile.row };
    return null;
  }

  private itemAt(x: number, y: number): number | null {
    for (let i = 0; i < ITEM_BENCH; i++) {
      const ix = ITEMS_PANEL.x + (i % ITEMS_PANEL.cols) * (ITEMS_PANEL.size + 3);
      const iy = ITEMS_PANEL.y + Math.floor(i / ITEMS_PANEL.cols) * (ITEMS_PANEL.size + 3);
      if (x >= ix && x <= ix + ITEMS_PANEL.size && y >= iy && y <= iy + ITEMS_PANEL.size) return i;
    }
    return null;
  }

  private highlight(): { tiles: { col: number; row: number; strong: boolean }[] } | null {
    const m = this.state;
    if (!m || m.phase !== 'plan' || (!this.selected && !this.dragging)) return null;
    const held = this.dragging ? this.held : this.selected;
    if (held?.kind !== 'unit') return null;
    const tiles: { col: number; row: number; strong: boolean }[] = [];
    const hover = tileAt(this.pointer.x, this.pointer.y);
    for (let r = 4; r < 8; r++) for (let c = 0; c < 8; c++) tiles.push({ col: c, row: r, strong: !!hover && hover.col === c && hover.row === r });
    return { tiles };
  }

  private onDown(p: Phaser.Input.Pointer) {
    const v = viewPoint(p);
    this.pointer = v;
    this.down = v;
    this.dragging = false;
    this.held = null;
    const hit = (list: Button[]) => list.find((b) => v.x >= b.x && v.x <= b.x + b.w && v.y >= b.y && v.y <= b.y + b.h);
    const ob = hit(this.overlayButtons);
    if (ob) {
      ob.run();
      this.down = null;
      return;
    }
    if (this.overlayButtons.length) return;
    const m = this.state;
    if (!m) return;
    const me = player(m);
    if (m.phase === 'draft' && m.draft && me.human) {
      const d = m.draft;
      if (d.order[d.turn] === 0 && m.time >= d.turnEnds) {
        const n = d.options.length;
        for (let i = 0; i < n; i++) {
          const s = this.draftSpot(i, n);
          if (d.options[i].takenBy === null && Math.abs(v.x - s.x) < 22 && v.y < s.y + 8 && v.y > s.y - 64) {
            if (draftPick(m, 0, i)) this.sfx('draft');
            d.turnEnds = m.time + 0.7;
            this.dirty = true;
            this.down = null;
            return;
          }
        }
      }
    }
    if (m.phase === 'fight' && m.battle && m.round.kind === 'rat' && me.human && m.time >= this.zapReadyAt) {
      const rat = m.battle.units.find((u) => u.monster === 'rat' && u.alive);
      const rv = rat && this.views.get(`b${rat.id}`);
      if (rat && rv && Math.hypot(v.x - rv.x, v.y - (rv.y - 12)) < 30) {
        m.battle.zapRat(rat.id);
        this.sfx('zap');
        this.consume(m.battle.events.splice(0));
        this.fx.push({ kind: 'zap', at: this.t, dur: 0.3, to: rat.id, x: 0 });
        this.zapReadyAt = m.time + RAT.zapCooldownS;
        this.down = null;
        return;
      }
    }
    const ir = this.infoRect;
    if (ir && m.phase === 'plan' && v.x >= ir.x && v.x <= ir.x + ir.w && v.y >= ir.y && v.y <= ir.y + ir.h) {
      this.infoPage = this.infoPage === 'meter' ? 'cards' : 'meter';
      ui('click');
      this.dirty = true;
      this.down = null;
      return;
    }
    const b = hit(this.buttons);
    if (b) {
      b.run();
      this.down = null;
      return;
    }
    if (m.phase !== 'plan' || !me.human) return;
    const item = this.itemAt(v.x, v.y);
    if (item !== null && me.items[item]) {
      this.held = { kind: 'item', index: item };
      return;
    }
    const spot = this.spotAt(v.x, v.y);
    if (spot && unitAt(me, spot)) this.held = { kind: 'unit', spot };
  }

  private onMove(p: Phaser.Input.Pointer) {
    this.pointer = viewPoint(p);
    if (this.down && this.held && !this.dragging && Math.hypot(this.pointer.x - this.down.x, this.pointer.y - this.down.y) > 8) {
      this.dragging = true;
      this.selected = null;
      this.dirty = true;
    }
  }

  private onUp(p: Phaser.Input.Pointer) {
    const v = viewPoint(p);
    this.pointer = v;
    const m = this.state;
    if (!this.down || !m || m.phase !== 'plan') {
      this.down = null;
      this.dragging = false;
      this.held = null;
      return;
    }
    const me = player(m);
    const spot = this.spotAt(v.x, v.y);
    const inSell = v.x >= SELL_ZONE.x && v.x <= SELL_ZONE.x + SELL_ZONE.w && v.y >= SELL_ZONE.y && v.y <= SELL_ZONE.y + SELL_ZONE.h;
    if (this.dragging && this.held) {
      if (this.held.kind === 'unit') {
        const o = unitAt(me, this.held.spot);
        if (inSell && o) this.doSellUnit(me, o);
        else if (spot) this.doMove(me, this.held.spot, spot);
      } else if (spot) {
        const o = unitAt(me, spot);
        if (o) this.doEquip(me, this.held.index, o);
      }
      this.selected = null;
    } else if (this.held) {
      // A tap on a robot or part: select it, or act with what was selected.
      const sel = this.selected;
      if (sel?.kind === 'item' && this.held.kind === 'unit') {
        const o = unitAt(me, this.held.spot);
        if (o) this.doEquip(me, sel.index, o);
        this.selected = null;
      } else if (sel?.kind === 'unit' && this.held.kind === 'unit' && !sameSpot(sel.spot, this.held.spot)) {
        this.doMove(me, sel.spot, this.held.spot);
        this.selected = null;
      } else if (sel && sameHeld(sel, this.held)) this.selected = null;
      else this.selected = this.held;
      this.infoTrait = null;
    } else if (spot && this.selected?.kind === 'unit') {
      this.doMove(me, this.selected.spot, spot);
      this.selected = null;
    } else if (this.selected) this.selected = null;
    this.down = null;
    this.held = null;
    this.dragging = false;
    this.dirty = true;
  }

  private onKey(e: KeyboardEvent) {
    if (e.repeat) return;
    const m = this.state;
    if (!m) {
      if (e.key === 'Enter') this.startMatch();
      return;
    }
    const me = player(m);
    if (m.phase === 'plan' && me.human && me.augmentOffer && ['1', '2', '3'].includes(e.key)) return this.doAugment(Number(e.key) - 1);
    if (this.overlayButtons.length) return;
    const k = e.key.toLowerCase();
    if (k === ' ') {
      e.preventDefault();
      if (m.phase === 'plan' && me.human && !me.augmentOffer) this.goFight();
      else if (m.phase === 'fight' && me.human) this.doSkill();
    } else if (k === 'r' && me.human) this.doReroll();
    else if (k === 'x' && me.human) this.doXp();
    else if (k === 'e' && me.human) this.doSell();
    else if (k === 't') this.toggleSpeed();
    else if (k === 'l' && me.human) this.toggleLock();
  }
}

const INK_NUM = 0x0a0818;
const sameSpot = (a: Spot, b: Spot) => (a.where === 'bench' && b.where === 'bench' && a.i === b.i) || (a.where === 'board' && b.where === 'board' && a.col === b.col && a.row === b.row);
const sameHeld = (a: Held, b: Held) => (a.kind === 'item' && b.kind === 'item' && a.index === b.index) || (a.kind === 'unit' && b.kind === 'unit' && sameSpot(a.spot, b.spot));
