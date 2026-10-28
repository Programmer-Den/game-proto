import Phaser from 'phaser';
import { playMusic, playSting, ui } from '../../../../shared/audio';
import { formatNumber } from '../../../../shared/i18n';
import { viewFrame, viewSize } from '../../../../shared/scaling';
import { settings } from '../../../../shared/settings';
import { SFX, SONG } from '../audio';
import { CHARMS, KIND_COLOR, MODES, RELIC_COLOR, type Mode, type RelicId } from '../game/catalog';
import { DEFS, KINDS, LEVELS, SKILLS, SKILL_OF, type KindId, type Level } from '../game/kinds';
import type { Progress } from '../game/progress';
import {
  act, canHint, canTakeOmen, canUndo, dailyDone, draftPick, drag, hint, holdsCharm, next, omenFor, takeOmen, quit, skip, startRun, startSecondPlayer, takeRelic, tick, undo,
  BLITZ_PENALTY_S, DUEL_FAIL_S, PERIL_HEARTS, QUEUE, type Card, type Run,
} from '../game/run';
import { clearRun, loadProgress, loadRun, saveProgress, saveRun } from '../game/save';
import { t, type TextKey } from '../i18n';
import { drawGlyph, drawKindIcon, drawRelic, trace } from './glyphs';
import { layoutFor, UI_DEPTH, VIEW, WIDE, type Layout } from './layout';
import { Painter } from './painter';
import { C } from './theme';
import { resetUnjam, VIEWS } from './views';
import type { ViewCtx } from './views/types';

/** A spot the test can tap, by its centre in view pixels. */
type Spot = { x: number; y: number; w: number; h: number };

/** The longest step the clocks take in one frame, so a stalled tab doesn't jump. */
const MAX_STEP_MS = 100;
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

const timeText = (ms: number) => {
  const secs = Math.ceil(ms / 1000);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
};

/** A time to the tenth of a second, for pass and play's close finishes. */
const tenthsText = (ms: number) => {
  const tenths = Math.round(ms / 100);
  return `${Math.floor(tenths / 600)}:${String(Math.floor(tenths / 10) % 60).padStart(2, '0')}.${tenths % 10}`;
};

/**
 * Augury's only scene: the menu, the practice picker, the records and a run, drawn from scratch
 * by a `Painter` whenever something changes. It turns taps and keys into the moves of
 * `game/run.ts` and the puzzle views, and drains `run.events` for sound and saving.
 */
export class GameScene extends Phaser.Scene {
  progress!: Progress;
  run: Run | null = null;
  /** A run saved before the last reload, which the menu's Continue picks up. */
  saved: Run | null = null;
  screen: 'menu' | 'practice' | 'records' | 'run' = 'menu';
  practiceLevel: Level = 0;
  /** Spots for the test: every tappable thing on screen by id, centred, in view pixels. */
  buttons: Record<string, Spot> = {};

  /** The layout for the view's shape: wide or upright. */
  private L: Layout = WIDE;
  private fx = 0;
  private fy = 0;
  private vw = VIEW.w;
  private vh = VIEW.h;
  private backdrop!: Phaser.GameObjects.Graphics;
  private p!: Painter;
  private dirty = true;
  /** What the clocks show, so the screen redraws when a shown number or bar changes. */
  private clockKey = '';
  private dragging = false;
  private lastTime = 0;
  /** Where the run in play stood when it was last saved: it is saved again when this changes. */
  private saveKey = '';

  constructor() {
    super('Game');
  }

  create() {
    this.progress = loadProgress();
    this.saved = loadRun(this.progress);
    this.backdrop = this.add.graphics().setDepth(0);
    this.p = new Painter(this, UI_DEPTH);
    this.fitView();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onDown(p.worldX, p.worldY));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.dragging && this.onMove(p.worldX, p.worldY));
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onUp(p.worldX, p.worldY));
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => this.onKey(e));
    // A phone turned the other way round reshapes the view: lay everything out again.
    const onResize = () => this.fitView();
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  /** Reads the view's size, picks the layout for its shape and keeps its frame in the middle. */
  private fitView() {
    ({ width: this.vw, height: this.vh } = viewSize(this));
    ({ x: this.fx, y: this.fy } = viewFrame(this));
    this.L = layoutFor(this.vw, this.vh);
    this.cameras.main.setSize(this.scale.width, this.scale.height).setScroll(-this.fx, -this.fy);
    this.drawBackdrop();
    this.dirty = true;
  }

  update(time: number) {
    const dt = Math.min(MAX_STEP_MS, this.lastTime ? time - this.lastTime : 0);
    this.lastTime = time;
    const run = this.run;
    if (run && this.screen === 'run') {
      const step = run.current?.card.kind === 'echo' ? run.current.state.step : -1;
      tick(run, dt);
      if (run.current?.card.kind === 'echo' && run.current.state.step !== step && step >= 0) SFX('turn');
      this.drain();
      this.keepRun(run);
      const cur = run.current;
      const key = [run.phase, Math.floor((cur?.timeLeftMs ?? 0) / 100), Math.floor(run.clockMs / 100), cur?.card.kind === 'echo' ? Math.floor(cur.state.ms / 100) + cur.state.step * 100 : 0].join('|');
      if (key !== this.clockKey) (this.clockKey = key), (this.dirty = true);
    }
    const part = this.screen !== 'run' ? 'menu' : run?.mode === 'blitz' ? 'blitz' : 'calm';
    if (run?.phase !== 'over' || this.screen !== 'run') playMusic(SONG, part);
    if (this.dirty) {
      this.dirty = false;
      this.draw();
    }
  }

  // -------------------------------------------------------------------------------------------
  // Input

  private onDown(x: number, y: number) {
    const hits = this.p.hits;
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i];
      // A spot with a NaN edge would take every tap, so it takes none.
      if (!h.onTap || !Number.isFinite(h.x + h.y + h.w + h.h) || x < h.x || y < h.y || x >= h.x + h.w || y >= h.y + h.h) continue;
      if (h.enabled === false) ui('refuse');
      else h.onTap();
      this.dirty = true;
      return;
    }
    const run = this.run;
    if (this.screen === 'run' && run?.phase === 'playing' && run.current) {
      const view = VIEWS[run.current.card.kind];
      if (view.down) {
        view.down(this.ctx(), x, y);
        this.dragging = true;
        this.dirty = true;
      }
    }
  }

  private onMove(x: number, y: number) {
    const run = this.run;
    if (run?.phase !== 'playing' || !run.current) return;
    VIEWS[run.current.card.kind].move?.(this.ctx(), x, y);
  }

  private onUp(x: number, y: number) {
    if (!this.dragging) return;
    this.dragging = false;
    const run = this.run;
    if (run?.phase !== 'playing' || !run.current) return;
    VIEWS[run.current.card.kind].up?.(this.ctx(), x, y);
    this.dirty = true;
  }

  /** Keys: numbers for the pads and glyphs, Backspace, Enter, H for a hint, U to undo. */
  private onKey(e: KeyboardEvent) {
    const run = this.run;
    if (this.screen !== 'run' || run?.phase !== 'playing' || !run.current) return;
    const kind = run.current.card.kind;
    const press = (id: string) => {
      const h = this.p.hits.find((hit) => hit.id === id);
      if (!h?.onTap) return;
      if (h.enabled === false) ui('refuse');
      else h.onTap();
      this.dirty = true;
    };
    if (e.key === 'h' || e.key === 'H') press('hint');
    else if (e.key === 'u' || e.key === 'U' || (e.key === 'z' && (e.ctrlKey || e.metaKey))) press('undo');
    else if (kind === 'code') {
      if (/^[1-6]$/.test(e.key)) press(`glyph-${Number(e.key) - 1}`);
      else if (e.key === 'Backspace') press('code-back');
      else if (e.key === 'Enter') press('code-guess');
    } else if (kind === 'echo') {
      if (e.key === 's' || e.key === 'S' || e.key === 'ArrowLeft') press('echo-same');
      if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') press('echo-diff');
    } else if (kind === 'calc' || kind === 'sums') {
      if (/^[1-9]$/.test(e.key)) press(`key-${e.key}`);
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') press('key-0');
    }
  }

  /** What a puzzle view draws with and acts through. */
  private ctx(): ViewCtx {
    const run = this.run!;
    return {
      p: this.p,
      s: run.current!.state,
      r: this.L.board,
      act: (change, quiet, before) => {
        const moved = act(run, change, before);
        if (moved && !quiet) SFX('place');
        this.dirty = true;
        return moved;
      },
      drag: (change) => {
        const moved = drag(run, change);
        if (moved) this.dirty = true;
        return moved;
      },
      tap: () => SFX('tap'),
      place: () => SFX('place'),
      redraw: () => (this.dirty = true),
    };
  }

  // -------------------------------------------------------------------------------------------
  // Runs and events

  private start(mode: Mode, kind?: KindId) {
    if (mode === 'daily' && dailyDone(this.progress)) return ui('refuse');
    ui('click');
    // A new run ends the saved one there, its bests and its run recorded as if it was left.
    if (this.saved) quit(this.saved);
    this.saved = null;
    clearRun();
    resetUnjam();
    this.run = startRun(mode, this.progress, { kind, level: this.practiceLevel });
    this.screen = 'run';
    saveProgress(this.progress);
  }

  private toMenu() {
    ui('click');
    // Leaving mid-run ends the run: its bests, the daily five's score and the run are recorded.
    if (this.run) quit(this.run);
    this.run = null;
    this.screen = 'menu';
    this.saveKey = '';
    clearRun();
    saveProgress(this.progress);
  }

  /** Picks up the run saved before a reload where it was saved. */
  private resume() {
    if (!this.saved) return;
    ui('click');
    resetUnjam();
    this.run = this.saved;
    this.saved = null;
    this.screen = 'run';
  }

  /**
   * Saves the run (not Practice) each time it moves on: a puzzle dealt or ended, a draft or relic
   * offer, the hand-over. An ended run is cleared, as its records are already saved.
   */
  private keepRun(run: Run) {
    if (run.mode === 'practice') return;
    const key = [run.phase, run.dealt, run.results.length, run.relics.length, run.player].join('|');
    if (key === this.saveKey) return;
    this.saveKey = key;
    if (run.phase === 'over') clearRun();
    else saveRun(run);
  }

  private drain() {
    const run = this.run!;
    for (const e of run.events.splice(0)) {
      this.dirty = true;
      switch (e.type) {
        case 'start':
          resetUnjam();
          SFX('deal');
          break;
        case 'end':
          SFX(e.reason === 'solved' ? 'solved' : 'lost');
          saveProgress(this.progress);
          break;
        case 'heart':
          SFX('heart');
          break;
        case 'hint':
          SFX('hint');
          break;
        case 'warn':
          SFX('warn');
          break;
        case 'relic':
          SFX('relic');
          break;
        case 'omen':
          SFX('omen');
          break;
        case 'half':
          SFX('solved');
          saveProgress(this.progress);
          break;
        case 'over':
          playSting(SONG, 'over');
          saveProgress(this.progress);
          break;
      }
    }
  }

  // -------------------------------------------------------------------------------------------
  // Drawing

  /** The night sky over the whole view: a gradient, stars and two faint rings in a corner. */
  private drawBackdrop() {
    const g = this.backdrop.clear();
    const x0 = -this.fx;
    const y0 = -this.fy;
    g.fillGradientStyle(C.bgTop, C.bgTop, C.bgBottom, C.bgBottom, 1).fillRect(x0, y0, this.vw, this.vh);
    const rnd = new Phaser.Math.RandomDataGenerator(['augury']);
    for (let i = 0; i < 180; i++) g.fillStyle(0xffffff, rnd.realInRange(0.15, 0.8)).fillCircle(x0 + rnd.between(0, this.vw), y0 + rnd.between(0, this.vh), rnd.realInRange(0.3, 1.5));
    for (const r of [130, 100]) g.lineStyle(1, C.gold, 0.18).strokeCircle(x0 + this.vw - 50, y0 + this.vh - 30, r);
  }

  private draw() {
    const p = this.p;
    p.begin();
    if (this.screen === 'menu') this.drawMenu();
    else if (this.screen === 'practice') this.drawPractice();
    else if (this.screen === 'records') this.drawRecords();
    else this.drawRun();
    p.end();
    this.buttons = {};
    for (const h of p.hits) this.buttons[h.id] = { x: this.fx + h.x + h.w / 2, y: this.fy + h.y + h.h / 2, w: h.w, h: h.h };
  }

  /** A title in spaced capitals, as on a tarot card. */
  private heading(x: number, y: number, text: string, size: number, color: string = C.goldText, glow?: string) {
    return this.p.text(x, y, text.toLocaleUpperCase(), { size, color, spacing: Math.round(size / 6), glow });
  }

  private back(onTap: () => void) {
    const b = this.L.back;
    this.p.button('back', b.x, b.y, b.w, b.h, t('back'), onTap);
  }

  private drawMenu() {
    const p = this.p;
    const prog = this.progress;
    const MENU = this.L.menu;
    this.heading(MENU.title.x, MENU.title.y, t('title'), 54, C.goldText, settings.reduceMotion ? undefined : C.goldText);
    p.text(MENU.tagline.x, MENU.tagline.y, t('tagline'), { size: 16, color: C.inkDim, wrap: MENU.tagline.w });
    const { xs, ys, w, h } = MENU.cards;
    MODES.forEach((mode, k) => {
      const x = xs[k % xs.length];
      const y = ys[Math.floor(k / xs.length)];
      const done = mode === 'daily' && dailyDone(prog);
      p.frame(x - w / 2, y - h / 2, w, h, { alpha: done ? 0.6 : C.panelAlpha });
      p.text(x, y - h / 2 + 20, ROMAN[k], { size: 15, color: C.goldText, spacing: 2 });
      this.modeIcon(mode, x, y - 46, done);
      p.text(x, y + 8, t(`${mode}Name` as TextKey), { size: 16, color: C.goldText, bold: true, wrap: w - 16 });
      p.text(x, y + 52, t(`${mode}Text` as TextKey), { size: 11, color: C.inkDim, wrap: w - 18 });
      p.text(x, y + h / 2 - 16, this.modeBest(mode), { size: 11, color: C.cyanText, wrap: w - 12 });
      p.hit(`mode-${mode}`, x - w / 2, y - h / 2, w, h, () => (mode === 'practice' ? (ui('click'), (this.screen = 'practice')) : this.start(mode)), !done);
    });
    const saved = this.saved;
    const records = saved ? MENU.recordsAside : MENU.records;
    if (saved) p.button('resume', MENU.resume.x, MENU.resume.y, MENU.resume.w, MENU.resume.h, t('resume', { mode: t(`${saved.mode}Name` as TextKey) }), () => this.resume(), { accent: true, size: 14 });
    p.button('records', records.x, records.y, records.w, records.h, t('records'), () => {
      ui('click');
      this.screen = 'records';
    });
    p.text(MENU.line.x, MENU.line.y, t('runsLine', { n: prog.runs }), { size: 12, color: C.inkDim });
  }

  private modeBest(mode: Mode) {
    const b = this.progress.best;
    switch (mode) {
      case 'endless':
      case 'blitz':
        return b[mode] ? t('bestScore', { n: formatNumber(b[mode]) }) : '';
      case 'draft':
        return b.draft ? t('bestSolved', { n: b.draft }) : '';
      case 'daily':
        return dailyDone(this.progress) ? t('dailyToday', { n: formatNumber(this.progress.daily!.score) }) : t('dailyNew');
      default:
        return '';
    }
  }

  /** Each mode's emblem on its card. */
  private modeIcon(mode: Mode, x: number, y: number, dim: boolean) {
    const g = this.p.g;
    const a = dim ? 0.4 : 1;
    g.lineStyle(2, C.gold, a).fillStyle(C.gold, a);
    switch (mode) {
      case 'endless':
        g.strokeCircle(x - 13, y, 13).strokeCircle(x + 13, y, 13);
        drawGlyph(g, 2, x, y, 12, a);
        break;
      case 'daily':
        drawGlyph(g, 0, x, y, 48, a);
        break;
      case 'blitz':
        drawRelic(g, 'hourglass', x, y, dim ? 0x6a5a3a : C.cyan);
        break;
      case 'draft':
        g.fillStyle(C.deep, 1);
        for (const [dx, rot] of [[-12, -0.25], [12, 0.25]] as const) {
          const pts = [[-12, -18], [12, -18], [12, 18], [-12, 18]].map(([px, py]) => ({ x: x + dx + px * Math.cos(rot) - py * Math.sin(rot), y: y + px * Math.sin(rot) + py * Math.cos(rot) }));
          trace(g, pts).fillPath();
          g.lineStyle(2, C.gold, a);
          trace(g, pts).strokePath();
        }
        drawGlyph(g, 4, x + 12, y, 14, a);
        break;
      case 'duel':
        drawGlyph(g, 0, x - 16, y, 26, a);
        drawGlyph(g, 1, x + 16, y, 26, a);
        break;
      case 'practice':
        drawGlyph(g, 5, x, y, 44, a);
        break;
    }
  }

  private drawPractice() {
    const p = this.p;
    this.back(() => {
      ui('click');
      this.screen = 'menu';
    });
    const PRACTICE = this.L.practice;
    this.heading(PRACTICE.title.x, PRACTICE.title.y, t('practiceName'), 28);
    const lv = PRACTICE.levels;
    LEVELS.forEach((level, k) => {
      p.button(`level-${level}`, lv.xs[k % lv.xs.length], lv.ys[Math.floor(k / lv.xs.length)], lv.w, lv.h, `${ROMAN[k]} · ${t(`level${level}` as TextKey)}`, () => {
        ui('click');
        this.practiceLevel = level;
      }, { accent: this.practiceLevel === level, size: 14 });
    });
    const cards = PRACTICE.cards;
    KINDS.forEach((kind, k) => {
      const x = cards.xs[k % cards.xs.length];
      const y = cards.ys[Math.floor(k / cards.xs.length)];
      p.frame(x - cards.w / 2, y - cards.h / 2, cards.w, cards.h);
      drawKindIcon(p.g, kind, x - cards.w / 2 + 46, y, 52, KIND_COLOR[kind]);
      const tx = x - cards.w / 2 + 86;
      p.text(tx, y - 24, t(`${kind}Name` as TextKey), { size: 17, color: C.goldText, bold: true, ox: 0 });
      p.text(tx, y + 2, t(SKILL_OF[kind]), { size: 12, color: C.inkDim, ox: 0 });
      const best = this.progress.kinds[kind].best[this.practiceLevel];
      p.text(tx, y + 26, best ? t('fastest', { time: timeText(best) }) : t('notYet'), { size: 12, color: C.cyanText, ox: 0 });
      p.hit(`kind-${kind}`, x - cards.w / 2, y - cards.h / 2, cards.w, cards.h, () => this.start('practice', kind));
    });
  }

  private drawRecords() {
    const p = this.p;
    const prog = this.progress;
    this.back(() => {
      ui('click');
      this.screen = 'menu';
    });
    const R = this.L.records;
    this.heading(R.title.x, R.title.y, t('records'), 28);
    const { cols, top } = R;
    p.frame(R.frame.x, R.frame.y, R.frame.w, R.frame.h);
    [t('colPuzzle'), t('colSkill'), t('colSolved')].forEach((h, i) => cols[i] >= 0 && p.text(cols[i], top, h, { size: 13, color: C.goldText, ox: 0 }));
    LEVELS.forEach((l) => p.text(cols[3 + l] + 30, top, `${ROMAN[l]}`, { size: 13, color: C.goldText }));
    // Upright, the table has no room for the label before the fastest times.
    if (cols[1] >= 0) p.text(cols[3] - 16, top, t('colBest'), { size: 13, color: C.goldText, ox: 1 });
    KINDS.forEach((kind, k) => {
      const y = top + R.step + k * R.step;
      const rec = prog.kinds[kind];
      drawKindIcon(p.g, kind, cols[0] + 10, y, 22, KIND_COLOR[kind]);
      p.text(cols[0] + 30, y, t(`${kind}Name` as TextKey), { size: 15, ox: 0 });
      if (cols[1] >= 0) p.text(cols[1], y, t(SKILL_OF[kind]), { size: 13, color: C.inkDim, ox: 0 });
      p.text(cols[2], y, String(rec.solved), { size: 15, ox: 0 });
      LEVELS.forEach((l) => p.text(cols[3 + l] + 30, y, rec.best[l] ? timeText(rec.best[l]) : '–', { size: 14, color: rec.best[l] ? C.cyanText : C.inkDim }));
    });
    const skills = SKILLS.map((sk) => `${t(sk)} ${KINDS.filter((k) => SKILL_OF[k] === sk).reduce((n, k) => n + prog.kinds[k].solved, 0)}`).join('   ·   ');
    p.text(R.skills.x, R.skills.y, skills, { size: 14, color: C.goldText });
    const b = prog.best;
    p.text(R.bests.x, R.bests.y, t('bestsLine', { endless: formatNumber(b.endless), blitz: formatNumber(b.blitz), daily: formatNumber(b.daily), draft: b.draft }), { size: 13, color: C.inkDim, wrap: R.bests.w });
  }

  // -------------------------------------------------------------------------------------------
  // The run screen

  private drawRun() {
    const run = this.run!;
    const p = this.p;
    const cur = run.current;
    const { stage: STAGE, tools: TOOLS } = this.L;
    this.drawTop(run);
    // A boss in play is framed in rose.
    const boss = !!(cur && run.phase === 'playing' && (cur.pair || cur.card.boss));
    p.frame(STAGE.x, STAGE.y, STAGE.w, STAGE.h, boss ? { line: C.rose } : {});
    if (cur && run.phase !== 'draft' && run.phase !== 'relic' && run.phase !== 'handover') {
      const kind = cur.card.kind;
      this.heading(STAGE.x + STAGE.w / 2, STAGE.y + 28, t(`${kind}Name` as TextKey), 22);
      p.text(STAGE.x + STAGE.w / 2, STAGE.y + 54, t(`${kind}Rule` as TextKey), { size: 12, color: C.inkDim, wrap: STAGE.w - 160 });
      p.text(STAGE.x + STAGE.w - 16, STAGE.y + 22, `${ROMAN[cur.card.level]} · ${t(`level${cur.card.level}` as TextKey)}`, { size: 12, color: C.cyanText, ox: 1 });
      p.text(STAGE.x + 16, STAGE.y + 22, t(SKILL_OF[kind]), { size: 12, color: C.inkDim, ox: 0 });
      VIEWS[kind].draw(this.ctx());
      const def = DEFS[kind];
      p.button('undo', TOOLS.xs[0], TOOLS.y, TOOLS.w, TOOLS.h, t('undo'), () => undo(run) && SFX('tap'), { enabled: def.undo && canUndo(run) });
      const hintLabel = cur.freeHints > 0 ? t('hintFree') : Number.isFinite(run.hints) ? t('hintButton', { n: run.hints }) : t('hint');
      p.button('hint', TOOLS.xs[1], TOOLS.y, TOOLS.w, TOOLS.h, hintLabel, () => hint(run) || ui('refuse'), { enabled: canHint(run) });
      p.button('skip', TOOLS.xs[2], TOOLS.y, TOOLS.w, TOOLS.h, run.mode === 'practice' ? t('newPuzzle') : t('skip'), () => skip(run), { enabled: run.phase === 'playing' });
    }
    this.drawSide(run);
    p.layer(1);
    if (run.phase === 'between') this.drawBetween(run);
    if (run.phase === 'draft') this.drawDeal(run.draftOffer.map((c) => ({ kind: c.kind, card: c })), t('draftTitle'), (i) => draftPick(run, i) && ui('click'), 'draft');
    if (run.phase === 'relic') this.drawDeal(run.relicOffer.map((r) => ({ relic: r })), t('relicTitle'), (i) => takeRelic(run, i), 'relic');
    if (run.phase === 'handover') this.drawHandover(run);
    if (run.phase === 'over') this.drawOver(run);
  }

  private drawTop(run: Run) {
    const p = this.p;
    const g = p.g;
    const TOP = this.L.top;
    p.frame(TOP.x, TOP.y, TOP.w, TOP.h, { inner: false });
    let cy = TOP.title.y;
    p.text(TOP.title.x, cy - 9, t(`${run.mode}Name` as TextKey).toLocaleUpperCase(), { size: 15, color: C.goldText, ox: 0, bold: true, spacing: 2 });
    p.text(TOP.title.x, cy + 11, this.topLine(run), { size: 12, color: C.inkDim, ox: 0 });
    // The middle: hearts, the Blitz clock, the daily five or whose turn it is.
    const mid = TOP.mid.x;
    cy = TOP.mid.y;
    if (run.mode === 'endless' || run.mode === 'draft') {
      const hearts = '♥'.repeat(Math.max(0, run.hearts));
      p.text(mid, cy, hearts || '♡', { size: 22, color: C.roseText, spacing: 3 });
    } else if (run.mode === 'blitz') {
      p.text(mid, cy, timeText(run.clockMs), { size: 26, color: run.clockMs <= 10_000 ? C.roseText : C.goldText, bold: true });
    } else if (run.mode === 'daily') {
      run.queue.forEach((_, i) => {
        const res = run.results[i];
        const x = mid - 48 + i * 24;
        g.fillStyle(res ? (res.reason === 'solved' ? C.cyan : C.rose) : i === run.results.length ? C.goldBright : C.deep, 1).fillRect(x - 7, cy - 7, 14, 14);
        g.lineStyle(1, C.gold, 1).strokeRect(x - 7, cy - 7, 14, 14);
      });
    } else if (run.mode === 'duel') {
      p.text(mid, cy, t('playerN', { n: run.player + 1 }), { size: 20, color: run.player ? C.cyanText : C.goldText, bold: true });
    }
    // The puzzle's own clock: a bar that runs down, and its seconds.
    const cur = run.current;
    const { x: bx, y: by, w: bw } = TOP.clock;
    if (cur && cur.timeLeftMs !== null && run.phase === 'playing') {
      const share = cur.timeTotalMs ? cur.timeLeftMs / cur.timeTotalMs : 0;
      g.fillStyle(C.deep, 1).fillRect(bx, by - 5, bw, 10);
      g.fillStyle(cur.timeLeftMs <= 10_000 ? C.rose : C.cyan, 1).fillRect(bx, by - 5, bw * share, 10);
      g.lineStyle(1, C.gold, 0.8).strokeRect(bx, by - 5, bw, 10);
      p.text(bx + bw + 10, by, timeText(cur.timeLeftMs), { size: 14, color: C.ink, ox: 0 });
    } else if (cur && run.mode === 'practice') p.text(bx + bw / 2, by, t('noClock'), { size: 13, color: C.inkDim });
    // The omen on offer is a button with what it does under its name; once taken it stays as a label.
    const OMEN = this.L.omen;
    const offer = cur && canTakeOmen(run);
    const omen = offer ? omenFor(cur.card) : run.phase === 'playing' ? cur?.omen : null;
    if (omen) {
      const ox = OMEN.x - OMEN.w / 2;
      const oy = OMEN.y - OMEN.h / 2;
      if (offer) g.fillStyle(C.key, 1).fillRect(ox, oy, OMEN.w, OMEN.h);
      g.lineStyle(1.5, C.rose, offer ? 1 : 0.5).strokeRect(ox, oy, OMEN.w, OMEN.h);
      const name = t(`${omen}Name` as TextKey);
      p.text(OMEN.x, OMEN.y - 8, offer ? t('omenOffer', { name }) : t('omenTaken', { name }), { size: 13, color: offer ? C.goldText : C.roseText, bold: true, spacing: 1 });
      p.text(OMEN.x, OMEN.y + 9, t(`${omen}Text` as TextKey), { size: 11, color: C.roseText });
      if (offer) p.hit('omen', ox, oy, OMEN.w, OMEN.h, () => takeOmen(run));
    }
    const LEAVE = this.L.leave;
    p.button('leave', LEAVE.x, LEAVE.y, LEAVE.w, LEAVE.h, t('leave'), () => this.toMenu(), { size: 13 });
  }

  private topLine(run: Run) {
    const cur = run.current;
    const boss = cur && run.phase === 'playing' && (cur.pair || cur.card.boss) ? ` · ${t('bossPart', { n: cur.pair ? 2 : 1 })}` : '';
    switch (run.mode) {
      case 'endless':
        return t('puzzleN', { n: run.dealt }) + boss;
      case 'blitz':
        return t('puzzleN', { n: run.dealt });
      case 'daily':
        return t('cardN', { n: Math.min(run.results.length + 1, run.queue.length), of: run.queue.length });
      case 'draft':
        return t('floorN', { n: run.solved + 1 }) + boss;
      case 'duel':
        return t('cardN', { n: Math.min(run.results.length - run.player * run.queue.length + 1, run.queue.length), of: run.queue.length });
      case 'practice':
        return t('practiceLine');
    }
  }

  /** A puzzle card in the side panel or the daily list: icon, name and level (on one line when short). */
  private smallCard(card: Card, x: number, y: number, w: number, h: number, line: string, outline = false) {
    const p = this.p;
    const rad = Math.min(21, h / 2 - 4);
    p.frame(x, y, w, h, { inner: false, line: outline ? C.cyan : C.gold });
    p.g.fillStyle(C.deep, 1).fillCircle(x + 10 + rad, y + h / 2, rad);
    drawKindIcon(p.g, card.kind, x + 10 + rad, y + h / 2, rad * 1.33, KIND_COLOR[card.kind]);
    const tx = x + 2 * rad + 20;
    if (h < 44) {
      p.text(tx, y + h / 2, t(`${card.kind}Name` as TextKey), { size: 13, color: C.goldText, ox: 0, bold: true });
      p.text(x + w - 10, y + h / 2, line, { size: 11, color: C.inkDim, ox: 1 });
      return;
    }
    p.text(tx, y + h / 2 - 9, t(`${card.kind}Name` as TextKey), { size: 14, color: C.goldText, ox: 0, bold: true });
    p.text(tx, y + h / 2 + 10, line, { size: 11, color: C.inkDim, ox: 0 });
  }

  private drawSide(run: Run) {
    const p = this.p;
    const { list, score } = this.L.side;
    const { x, y, w } = list;
    /** Where the n-th of `count` cards in the list sits, and how tall it is: up to `most` apart. */
    const slot = (i: number, count: number, most: number) => {
      const step = Math.min(most, Math.floor((list.h - 24) / count));
      return { top: y + 24 + i * step, h: step - (step > 60 ? 10 : 6) };
    };
    const scoreBox = (lines: [string, string][]) => {
      const h = 34 + lines.length * 22;
      const top = score.bottom - h;
      p.frame(score.x, top, score.w, h);
      lines.forEach(([label, value], i) => {
        p.text(score.x + 16, top + 26 + i * 22, label, { size: 13, color: C.inkDim, ox: 0 });
        // The big first number shrinks where a narrow box holds a long value (pass and play's times).
        const big = i === 0 && (score.w > 250 || value.length <= 8);
        p.text(score.x + score.w - 16, top + 26 + i * 22, value, { size: big ? 20 : 14, color: i === 0 ? C.goldText : C.ink, ox: 1, bold: i === 0 });
      });
    };
    const label = (text: string) => p.text(x + 4, y + 8, text.toLocaleUpperCase(), { size: 12, color: C.inkDim, ox: 0, spacing: 3 });
    switch (run.mode) {
      case 'endless':
      case 'blitz':
        label(t('upNext'));
        run.queue.slice(0, QUEUE).forEach((card, i) => {
          const { top, h } = slot(i, QUEUE, 72);
          const level = t(`level${card.level}` as TextKey);
          const line = card.boss ? t('bossWith', { name: t(`${card.boss.kind}Name` as TextKey) }) : i === 0 ? t('nextLevel', { level }) : level;
          this.smallCard(card, x, top, w, h, line, i === 0);
        });
        if (run.mode === 'endless') this.relicRow(run, score.x, score.bottom - 122, score.w);
        scoreBox([
          [t('score'), formatNumber(run.score)],
          [t('streak'), `×${run.streak}`],
          [t('solvedLabel'), String(run.solved)],
        ]);
        break;
      case 'daily':
        label(t('todaysFive'));
        run.queue.forEach((card, i) => {
          const res = run.results[i];
          const line = res ? (res.reason === 'solved' ? t('pointsLine', { n: res.points }) : t(`res_${res.reason}` as TextKey)) : t(`level${card.level}` as TextKey);
          const { top, h } = slot(i, run.queue.length, 56);
          this.smallCard(card, x, top, w, h, line, i === run.results.length);
        });
        scoreBox([[t('score'), formatNumber(run.score)]]);
        break;
      case 'draft': {
        label(t('relicsTitle'));
        const counts = new Map<RelicId, number>();
        for (const r of run.relics) counts.set(r, (counts.get(r) ?? 0) + 1);
        if (!counts.size) p.text(x + 4, y + 36, t('noRelics'), { size: 13, color: C.inkDim, ox: 0, wrap: w - 8, align: 'left' });
        [...counts].forEach(([relic, n], i) => {
          const { top, h } = slot(i, Math.max(3, counts.size), 56);
          const cy = top + h / 2;
          const name = n > 1 ? `${t(`${relic}Name` as TextKey)} ×${n}` : t(`${relic}Name` as TextKey);
          p.frame(x, top, w, h, { inner: false });
          p.g.fillStyle(C.deep, 1).fillCircle(x + 30, cy, Math.min(21, h / 2 - 4));
          drawRelic(p.g, relic, x + 30, cy, RELIC_COLOR[relic], Math.min(0.55, (h - 8) / 76));
          // A short slot has room for the name only.
          if (h < 44) p.text(x + 60, cy, name, { size: 14, color: C.goldText, ox: 0, bold: true });
          else {
            p.text(x + 60, cy - 9, name, { size: 14, color: C.goldText, ox: 0, bold: true });
            p.text(x + 60, cy + 10, t(`${relic}Text` as TextKey), { size: 11, color: C.inkDim, ox: 0, wrap: w - 70, align: 'left' });
          }
        });
        scoreBox([
          [t('score'), formatNumber(run.score)],
          [t('solvedLabel'), String(run.solved)],
          [t('streak'), `×${run.streak}`],
        ]);
        break;
      }
      case 'duel':
        label(t('duelCards'));
        run.queue.forEach((card, i) => {
          const done = run.results.length - run.player * run.queue.length;
          const { top, h } = slot(i, run.queue.length, 56);
          this.smallCard(card, x, top, w, h, t(`level${card.level}` as TextKey), i === done);
        });
        scoreBox([0, 1].map((pl) => [t('playerN', { n: pl + 1 }), `${timeText(run.totals[pl])} · ${t('solvedCount', { n: run.duelSolved[pl] })}`] as [string, string]));
        break;
      case 'practice': {
        const card = run.current?.card;
        if (!card) break;
        this.smallCard(card, x, y, w, 62, `${ROMAN[card.level]} · ${t(`level${card.level}` as TextKey)}`);
        const best = this.progress.kinds[card.kind].best[card.level];
        p.text(x + 4, y + 90, best ? t('fastest', { time: timeText(best) }) : t('notYet'), { size: 13, color: C.cyanText, ox: 0 });
        p.text(x + 4, y + 120, t('practiceSide'), { size: 13, color: C.inkDim, ox: 0, wrap: w - 8, align: 'left' });
        scoreBox([[t('solvedLabel'), String(run.solved)]]);
        break;
      }
    }
  }

  /** Endless: the relics bosses gave, a row of small emblems over the score box. */
  private relicRow(run: Run, x: number, y: number, w: number) {
    const relics = [...new Set(run.relics)];
    const step = Math.min(30, Math.floor(w / Math.max(1, relics.length)));
    relics.forEach((r, i) => drawRelic(this.p.g, r, x + 14 + i * step, y, RELIC_COLOR[r], 0.4));
  }

  /** Dims the whole view and swallows taps under a card or banner. */
  private dim(alpha = 0.55) {
    const p = this.p;
    p.g.fillStyle(0x05030d, alpha).fillRect(-this.fx, -this.fy, this.vw, this.vh);
    p.hit('dim', -this.fx, -this.fy, this.vw, this.vh, () => {});
  }

  private drawBetween(run: Run) {
    const p = this.p;
    const last = run.last!;
    const solved = last.reason === 'solved';
    const STAGE = this.L.stage;
    const bx = STAGE.x + 60;
    const practice = run.mode === 'practice';
    const h = practice ? 170 : 120;
    const by = Math.round(STAGE.y + STAGE.h / 2 - 72);
    p.hit('dim', STAGE.x, STAGE.y, STAGE.w, STAGE.h, practice ? () => {} : () => next(run));
    p.frame(bx, by, STAGE.w - 120, h, { alpha: 0.97, line: solved ? C.cyan : C.rose });
    this.heading(bx + (STAGE.w - 120) / 2, by + 40, last.boss && solved ? t('bossBeaten') : t(`res_${last.reason}` as TextKey), 26, solved ? C.cyanText : C.roseText);
    const points = t('pointsLine', { n: last.points }) + (last.omen ? ` · ${t('omenLine')}` : '');
    const heart = last.omen === 'peril' ? t('heartsLost', { n: PERIL_HEARTS }) : t('heartLost');
    const line = practice || run.mode === 'duel' ? t('timeLine', { time: timeText(last.ms) }) : solved ? points : run.mode === 'endless' || run.mode === 'draft' ? heart : run.mode === 'blitz' ? t('timeLost', { n: BLITZ_PENALTY_S }) : '';
    p.text(bx + (STAGE.w - 120) / 2, by + 80, line, { size: 16, color: C.ink });
    if (practice) {
      p.button('next', bx + (STAGE.w - 120) / 2 - 95, by + 130, 170, 40, t('nextPuzzle'), () => (ui('click'), next(run)), { accent: true });
      p.button('done', bx + (STAGE.w - 120) / 2 + 95, by + 130, 170, 40, t('menu'), () => this.toMenu());
    }
  }

  /** Cards dealt for a pick: puzzle cards in a draft, relics after a few solves. */
  private drawDeal(items: { kind?: KindId; card?: Card; relic?: RelicId }[], title: string, pick: (i: number) => unknown, id: string) {
    const p = this.p;
    const DEAL = this.L.deal;
    this.dim();
    this.heading(DEAL.title.x, DEAL.title.y, title, 26);
    const xs = items.length === 2 ? DEAL.xs2 : DEAL.xs3;
    items.forEach((item, i) => {
      const x = xs[i];
      const { y, w, h } = DEAL;
      p.frame(x - w / 2, y - h / 2, w, h, { alpha: 0.98, ...(item.card?.boss ? { line: C.rose } : {}) });
      p.text(x, y - h / 2 + 22, ROMAN[i], { size: 14, color: C.goldText, spacing: 2 });
      if (item.card) {
        const c = item.card;
        p.g.fillStyle(C.deep, 1).fillCircle(x, y - 40, 44);
        drawKindIcon(p.g, c.kind, x, y - 40, 58, KIND_COLOR[c.kind]);
        p.text(x, y + 26, t(`${c.kind}Name` as TextKey), { size: 18, color: C.goldText, bold: true, wrap: w - 20 });
        p.text(x, y + 54, `${ROMAN[c.level]} · ${t(`level${c.level}` as TextKey)}`, { size: 13, color: C.cyanText });
        // A boss names its second puzzle; a held charm marks the cards it helps.
        if (c.boss) p.text(x, y + 80, t('bossWith', { name: t(`${c.boss.kind}Name` as TextKey) }), { size: 12, color: C.roseText, wrap: w - 16 });
        else if (holdsCharm(this.run!, c.kind)) p.text(x, y + 80, `✦ ${t(`${CHARMS[c.kind]}Name` as TextKey)}`, { size: 12, color: C.cyanText, wrap: w - 16 });
        else p.text(x, y + 80, t(SKILL_OF[c.kind]), { size: 12, color: C.inkDim });
      } else if (item.relic) {
        const r = item.relic;
        p.g.fillStyle(C.deep, 1).fillCircle(x, y - 40, 44);
        drawRelic(p.g, r, x, y - 40, RELIC_COLOR[r]);
        p.text(x, y + 26, t(`${r}Name` as TextKey), { size: 18, color: C.goldText, bold: true });
        p.text(x, y + 66, t(`${r}Text` as TextKey), { size: 13, color: C.ink, wrap: w - 28 });
      }
      p.hit(`${id}-${i}`, x - w / 2, y - h / 2, w, h, () => pick(i));
    });
  }

  private drawHandover(run: Run) {
    const p = this.p;
    const { end: END, endButtons: END_BUTTONS } = this.L;
    this.dim();
    p.frame(END.x - END.w / 2, END.y - END.h / 2, END.w, END.h, { alpha: 0.98 });
    this.heading(END.x, END.y - 110, t('handoverTitle'), 26);
    p.text(END.x, END.y - 50, t('handoverLine', { time: timeText(run.totals[0]), n: run.duelSolved[0], of: run.queue.length }), { size: 16, wrap: END.w - 60 });
    p.button('start2', END.x, END_BUTTONS.y, 200, END_BUTTONS.h, t('startTurn'), () => (ui('click'), startSecondPlayer(run)), { accent: true });
  }

  private drawOver(run: Run) {
    const p = this.p;
    const { end: END, endButtons: END_BUTTONS } = this.L;
    this.dim();
    p.frame(END.x - END.w / 2, END.y - END.h / 2, END.w, END.h, { alpha: 0.98 });
    const lines: string[] = [];
    let title: string;
    if (run.mode === 'duel') {
      // Compared in tenths, as shown, so two equal times on the card are a tie.
      const [a, b] = run.totals.map((ms) => Math.round(ms / 100));
      title = a === b ? t('duelTie') : t('duelWin', { n: a < b ? 1 : 2 });
      for (const pl of [0, 1]) lines.push(t('duelLine', { n: pl + 1, time: tenthsText(run.totals[pl]), solved: run.duelSolved[pl] }));
      lines.push(t('duelRule', { n: DUEL_FAIL_S }));
    } else {
      title = run.mode === 'blitz' ? t('blitzOver') : run.mode === 'daily' ? t('dailyOver') : t('runOver');
      lines.push(t('overScore', { n: formatNumber(run.score) }));
      lines.push(t('overSolved', { n: run.solved, of: run.results.length }));
      if (run.newBest) lines.push(t('newBest'));
    }
    this.heading(END.x, END.y - 120, title, 28);
    lines.forEach((line, i) => p.text(END.x, END.y - 66 + i * 30, line, { size: i === 0 ? 20 : 16, color: line === t('newBest') ? C.cyanText : C.ink, wrap: END.w - 60 }));
    const again = run.mode !== 'daily';
    if (again) p.button('again', END_BUTTONS.xs[0], END_BUTTONS.y, END_BUTTONS.w, END_BUTTONS.h, t('again'), () => this.start(run.mode), { accent: true });
    p.button('done', again ? END_BUTTONS.xs[1] : END.x, END_BUTTONS.y, END_BUTTONS.w, END_BUTTONS.h, t('menu'), () => this.toMenu());
  }
}

