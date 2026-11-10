/**
 * The full-screen panels drawn over the field: the hero select screen, the level-up cards and the
 * end of a run. Each is a list of HUD objects (scroll factor 0) the scene destroys when done, and
 * reports where its tappable rectangles are so the scene (and the playthrough test) can use them.
 */
import Phaser from 'phaser';
import { HEROES, HERO_IDS, schemeOf, type HeroDef, type HeroId } from '../game/heroes';
import { clock, type GameState } from '../game/state';
import { BASE_TIER, BRANCHES, CAPSTONES, FILLER, FUSIONS, FUSION_BY_ID, FUSION_NEEDS, FUSION_PREFIX, POOL_NAMES, UPGRADES, branchesOf, capstoneFor, cardTiers, crossoverFor, fusionCard, fusionShuts, lockedOf, parseCard } from '../game/upgrades';
import { cardName, gainsText, tierText } from '../game/cardText';
import { BRANCH_PREFIX, SKILL_ENTRIES, SKILL_PAGES, branchOf, type SkillPageId } from '../game/skills';
import { BOSSES, NODE_INFO, PLANETS, STAGES, planetLabel, planetsAt, type NodeKind } from '../game/planets';
import { chartOptions, nextStage, priceOf, rerollPrice } from '../game/voyage';
import { DAILY, stagesOf } from '../game/daily';
import { CODEX_PAGES, pageCount, type CodexPageId } from '../game/codex';
import type { DailyRecord } from '../../../../shared/daily';
import { isUnlocked, type Progress } from '../game/save';
import { HEAT_RULES, heatOpen } from '../game/heat';
import { ARMOURY, nextPrice, perkAmount } from '../game/armoury';
import { MUTATORS, WEEKLY_BONUS, type MutatorId } from '../game/weekly';
import { formatDate, type Vars } from '../../../../shared/i18n';
import { t } from '../i18n';
import { C, hex } from '../art/glow';
import { bakeMastery, masteryPortraitKey, masteryScheme, portraitKey } from '../art/sprites';
import { MASTERY, MASTERY_REWARDS, MAX_MASTERY, masteryLevel, masteryNext } from '../game/mastery';
import { RUSH, rushPlanets } from '../game/rush';
import {
  FIGHT_SHORT, MASTERY_ROW, RUSH_BUTTON, AGAIN, AGAIN_SIDE, CODEX_BUTTON, CODEX_GRID, CODEX_BACK, SKILLS_BUTTON, SKILL_DETAIL, SKILL_LIST, skillTabRect, DAILY_BUTTON, ENDLESS_BUTTON, codexTabRect, ARMOURY_BUTTON, BACK, CHART, MUTATOR_CARD, WEEKLY_BACK, WEEKLY_BUTTON, WEEKLY_START, armouryCardRect, CONTINUE, DEPTH, FIGHT, FONT, HEAT_DOWN, HEAT_ROW, HEAT_UP, HERO_DETAIL, LEAVE, MAP, REROLL, SCREEN, UNLOCK, VIEW, chartRect, chartSpot, eventOptionRect, heroCardRect,
  CHART4, levelCardRect, mapNodeRect, mapNodeSpot, tradeCardRect, type Rect,
} from '../scenes/layout';

/** A tappable rectangle and what it stands for; a hero card whose deed is not done yet is `locked`. */
export interface Spot extends Rect {
  id: string;
  locked?: boolean;
}

type Obj = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth;

export class Panel {
  objects: Obj[] = [];
  spots: Spot[] = [];
  private frames: { g: Phaser.GameObjects.Graphics; rect: Rect; color: string; fill: string }[] = [];
  /** Objects drawn over the whole view (the dimming, the stars), which `place` leaves where they are. */
  private backdrop = new Set<Obj>();
  /** How far `place` moved the panel from its designed 960x540 layout. */
  private offset = { x: 0, y: 0 };

  constructor(readonly scene: Phaser.Scene) {}

  add<T extends Obj>(o: T, depth = 0): T {
    o.setScrollFactor(0).setDepth(DEPTH.overlay + depth);
    this.objects.push(o);
    return o;
  }

  text(x: number, y: number, s: string, size: number, color: string, opts: { bold?: boolean; origin?: [number, number]; wrap?: number; align?: string; glow?: boolean } = {}) {
    const t = this.scene.add.text(x, y, s, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: opts.bold ? 'bold' : 'normal',
      color,
      align: opts.align ?? 'left',
      wordWrap: opts.wrap ? { width: opts.wrap } : undefined,
    });
    t.setOrigin(...(opts.origin ?? [0, 0]));
    if (opts.glow) t.setShadow(0, 0, color, 10, false, true);
    return this.add(t, 2);
  }

  dim(alpha = 0.72) {
    const g = this.scene.add.graphics();
    g.fillStyle(hex(C.night), alpha).fillRect(0, 0, SCREEN.w, SCREEN.h);
    this.backdrop.add(g);
    return this.add(g);
  }

  /** Marks an object as drawn over the whole view, so `place` does not move it. */
  fixed<T extends Obj>(o: T): T {
    this.backdrop.add(o);
    return o;
  }

  /**
   * Moves the panel, laid out for the designed 960x540 view, by `dx`, `dy` (into the frame in the
   * middle of a wider or taller view), with its tappable spots. The backdrop stays over the view.
   */
  place(dx: number, dy: number) {
    if (!dx && !dy) return this;
    for (const o of this.objects) {
      if (this.backdrop.has(o)) continue;
      const m = o as unknown as Phaser.GameObjects.Components.Transform;
      m.setPosition(m.x + dx, m.y + dy);
    }
    this.spots = this.spots.map((r) => ({ ...r, x: r.x + dx, y: r.y + dy }));
    this.offset = { x: this.offset.x + dx, y: this.offset.y + dy };
    return this;
  }

  /** A glowing card frame that brightens while hovered. */
  frame(rect: Rect, color: string, fill = C.panel) {
    const g = this.add(this.scene.add.graphics(), 1);
    this.frames.push({ g, rect, color, fill });
    this.drawFrame(this.frames.length - 1, false);
    return g;
  }

  private drawFrame(i: number, hot: boolean) {
    const { g, rect, color, fill } = this.frames[i];
    const c = hex(color);
    g.clear();
    // A soft halo: a few widening, fading strokes.
    for (let k = 3; k >= 1; k--) {
      g.lineStyle(2 + k * 4, c, (hot ? 0.12 : 0.05) * (4 - k));
      g.strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 14);
    }
    g.fillStyle(hex(fill), 0.94).fillRoundedRect(rect.x, rect.y, rect.w, rect.h, 14);
    g.lineStyle(hot ? 2.5 : 1.5, c, hot ? 1 : 0.7).strokeRoundedRect(rect.x, rect.y, rect.w, rect.h, 14);
  }

  /** Highlights the frame under a point on the view. */
  hover(v: { x: number; y: number }) {
    const p = { x: v.x - this.offset.x, y: v.y - this.offset.y };
    this.frames.forEach((f, i) => {
      const hot = p.x >= f.rect.x && p.x <= f.rect.x + f.rect.w && p.y >= f.rect.y && p.y <= f.rect.y + f.rect.h;
      this.drawFrame(i, hot);
    });
  }

  destroy() {
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.spots = [];
    this.frames = [];
    this.backdrop.clear();
  }
}

/** "Blaster", or a knight's "Blade · the Current". */
function sideOf(hero: HeroDef) {
  const side = hero.pools.find((p) => p === 'current' || p === 'hollow');
  return t(side === 'current' ? 'sideCurrent' : side === 'hollow' ? 'sideHollow' : 'sideBlaster');
}

/**
 * The hero select screen: twelve small cards (a hero still locked shows only a dark placeholder:
 * no art, name or colour, and never its deed) and the chosen hero's details with the Fight button.
 */
export function heroSelect(p: Panel, progress: Progress, chosen: HeroId, heat = 0, week = -1, daily: DailyRecord | null = null) {
  const scene = p.scene;
  p.dim(0.55);
  p.text(VIEW.w / 2, 12, 'RIFTBLADE', 32, '#9fd8ff', { bold: true, origin: [0.5, 0], glow: true });
  p.text(VIEW.w / 2, 54, t('selectSubtitle'), 14, C.muted, { origin: [0.5, 0] });
  HERO_IDS.forEach((id, i) => heroCard(p, scene, id, i, progress, id === chosen));
  heroDetail(p, scene, chosen, progress, heat);
  const best = progress.bestMs > 0 ? `${t('longestRun', { time: clock(progress.bestMs) })}  ·  ` : '';
  p.text(VIEW.w / 2, VIEW.h - 22, `${best}${t('selectHelp')}`, 13, C.muted, { origin: [0.5, 0.5] });
  // The Armoury opens once a run has banked credits (a fresh save's screen stays as it was).
  if (progress.bank > 0 || Object.keys(progress.armoury).length) {
    p.frame(ARMOURY_BUTTON, ARMOURY_COLOR, '#1d1a10');
    p.spots.push({ id: 'armoury', ...ARMOURY_BUTTON });
    fit(p.text(ARMOURY_BUTTON.x + ARMOURY_BUTTON.w / 2, ARMOURY_BUTTON.y + ARMOURY_BUTTON.h / 2, t('armouryButton', { n: progress.bank }), 14, ARMOURY_COLOR, { bold: true, origin: [0.5, 0.5] }), ARMOURY_BUTTON.w - 16);
  }
  // The weekly run opens once a first run has ended.
  if (progress.bestMs > 0) {
    const won = progress.weekly?.week === week && progress.weekly.won;
    p.frame(WEEKLY_BUTTON, WEEKLY_COLOR, '#101c2a');
    p.spots.push({ id: 'weekly', ...WEEKLY_BUTTON });
    fit(p.text(WEEKLY_BUTTON.x + WEEKLY_BUTTON.w / 2, WEEKLY_BUTTON.y + WEEKLY_BUTTON.h / 2, t(won ? 'weeklyButtonWon' : 'weeklyButton'), 14, WEEKLY_COLOR, { bold: true, origin: [0.5, 0.5] }), WEEKLY_BUTTON.w - 16);
    // The daily run beside it, from the same first run on.
    p.frame(DAILY_BUTTON, DAILY_COLOR, '#1a1028');
    p.spots.push({ id: 'daily', ...DAILY_BUTTON });
    const label = daily?.played ? t('dailyButtonDone') : t('dailyButton');
    fit(p.text(DAILY_BUTTON.x + DAILY_BUTTON.w / 2, DAILY_BUTTON.y + DAILY_BUTTON.h / 2, label, 14, DAILY_COLOR, { bold: true, origin: [0.5, 0.5] }), DAILY_BUTTON.w - 16);
  }
  // The codex opens once a run has met anything.
  if (progress.codex.seen.length) {
    p.frame(CODEX_BUTTON, CODEX_COLOR, '#0f2018');
    p.spots.push({ id: 'codex', ...CODEX_BUTTON });
    const seen = new Set(progress.codex.seen);
    const done = CODEX_PAGES.filter((pg) => pageCount(pg, seen) === pg.entries.length).length;
    fit(p.text(CODEX_BUTTON.x + CODEX_BUTTON.w / 2, CODEX_BUTTON.y + CODEX_BUTTON.h / 2, t('codexButton', { n: done, of: CODEX_PAGES.length }), 14, CODEX_COLOR, { bold: true, origin: [0.5, 0.5] }), CODEX_BUTTON.w - 16);
  }
  return p;
}

const DAILY_COLOR = '#d7a2ff';
const CODEX_COLOR = '#7dffa0';

/** The daily run: today's hero and mutator, today's score, the best and the streak, Start and Back. */
export function dailyPanel(p: Panel, record: DailyRecord, hero: HeroId, mutators: readonly MutatorId[]) {
  const scene = p.scene;
  p.dim(0.85);
  stars(p, scene);
  p.text(VIEW.w / 2, 30, t('dailyTitle'), 30, DAILY_COLOR, { bold: true, origin: [0.5, 0], glow: true });
  p.text(VIEW.w / 2, 72, t('dailySubtitle', { day: dayLabel(record.day) }), 13, C.muted, { origin: [0.5, 0], align: 'center', wrap: VIEW.w - 80 });
  const sch = schemeOf(hero);
  const hx = 300;
  p.text(hx, MUTATOR_CARD.y, t('dailyHero'), 13, C.muted, { origin: [0.5, 0] });
  p.add(scene.add.image(hx, MUTATOR_CARD.y + 80, portraitKey(hero)).setScale(0.8), 2);
  fit(p.text(hx, MUTATOR_CARD.y + 130, t(HEROES[hero].name), 19, sch.accent, { bold: true, origin: [0.5, 0] }), 300);
  mutators.forEach((id) => {
    const r = { x: 520, y: MUTATOR_CARD.y, w: MUTATOR_CARD.w, h: MUTATOR_CARD.h };
    p.frame(r, DAILY_COLOR);
    p.text(r.x + r.w / 2, r.y + 22, t(MUTATORS[id].name), 18, DAILY_COLOR, { bold: true, origin: [0.5, 0] });
    p.text(r.x + r.w / 2, r.y + 58, t(MUTATORS[id].text), 14, C.text, { origin: [0.5, 0], align: 'center', wrap: r.w - 28 });
  });
  const today = record.score !== null ? t('dailyScore', { n: record.score }) : record.played ? t('dailyUnderway') : t('dailyNotYet');
  p.text(VIEW.w / 2, 322, today, 17, record.played ? C.elite : C.text, { bold: true, origin: [0.5, 0] });
  const best = [record.best > 0 ? t('dailyBest', { n: record.best }) : '', record.streak > 0 ? t('dailyStreak', { n: record.streak }) : ''].filter(Boolean).join('  ·  ');
  p.text(VIEW.w / 2, 352, best || t('dailyReward', { n: DAILY.bonus }), 14, C.muted, { origin: [0.5, 0] });
  if (best) p.text(VIEW.w / 2, 374, t('dailyReward', { n: DAILY.bonus }), 13, C.muted, { origin: [0.5, 0] });
  button(p, WEEKLY_BACK, 'back', t('armouryBack'), C.muted);
  button(p, WEEKLY_START, 'start', t(record.played ? 'dailyPlayed' : 'weeklyStart'), DAILY_COLOR, !record.played);
  p.text(VIEW.w / 2, WEEKLY_START.y + WEEKLY_START.h + 16, t(record.played ? 'dailyHelpDone' : 'weeklyHelp'), 12, C.muted, { origin: [0.5, 0] });
  return p;
}

/** A daily's day (`YYYY-MM-DD`) in the player's language. */
function dayLabel(day: string) {
  const [y, m, d] = day.split('-').map(Number);
  return formatDate(new Date(y, m - 1, d), { dateStyle: 'long' });
}

/** The codex: a tab per page (with its count, and its pay until full), the open page's entries and Back. */
export function codexPanel(p: Panel, progress: Progress, open: CodexPageId) {
  const scene = p.scene;
  p.dim(0.88);
  stars(p, scene);
  p.text(VIEW.w / 2, 26, t('codexTitle'), 30, CODEX_COLOR, { bold: true, origin: [0.5, 0], glow: true });
  p.text(VIEW.w / 2, 66, t('codexSubtitle'), 13, C.muted, { origin: [0.5, 0], align: 'center', wrap: VIEW.w - 80 });
  const seen = new Set(progress.codex.seen);
  CODEX_PAGES.forEach((pg, i) => {
    const r = codexTabRect(i, CODEX_PAGES.length);
    const n = pageCount(pg, seen);
    const full = n === pg.entries.length;
    p.frame(r, pg.id === open ? CODEX_COLOR : full ? C.elite : C.muted, pg.id === open ? '#12261c' : C.panel);
    p.spots.push({ id: `page-${pg.id}`, ...r });
    p.text(r.x + 8, r.y + 5, String(i + 1), 11, C.muted);
    fit(p.text(r.x + r.w / 2, r.y + 17, t(pg.name), 15, pg.id === open ? C.text : C.muted, { bold: true, origin: [0.5, 0.5] }), r.w - 30);
    const line = full ? t('codexPaid') : t('codexCount', { n, of: pg.entries.length, pay: pg.pay });
    fit(p.text(r.x + r.w / 2, r.y + 38, line, 12, full ? C.elite : C.muted, { origin: [0.5, 0.5] }), r.w - 12);
  });
  const page = CODEX_PAGES.find((pg) => pg.id === open) ?? CODEX_PAGES[0];
  const rows = Math.ceil(page.entries.length / CODEX_GRID.cols);
  page.entries.forEach((e, i) => {
    const col = Math.floor(i / rows);
    const row = i % rows;
    const known = seen.has(e.id);
    fit(p.text(CODEX_GRID.x + col * CODEX_GRID.col, CODEX_GRID.y + row * CODEX_GRID.row, known ? t(e.name) : '? ? ?', 13, known ? C.text : '#3d4a66', { bold: known }), CODEX_GRID.col - 14);
  });
  button(p, CODEX_BACK, 'back', t('armouryBack'), CODEX_COLOR);
  button(p, SKILLS_BUTTON, 'skills', t('skillsButton', { n: progress.skills.length, of: SKILL_ENTRIES.size }), SKILLS_COLOR);
  p.text(VIEW.w / 2, BACK.y + BACK.h + 16, t('codexHelp'), 12, C.muted, { origin: [0.5, 0] });
  return p;
}

const SKILLS_COLOR = '#ffd36b';

/**
 * The skill overview: a tab per page (with how many of it a run has taken), the page's names (a
 * skill never taken shows as "? ? ?") and, on the right, the one picked: its kind, text and every
 * tier.
 */
export function skillsPanel(p: Panel, progress: Progress, open: SkillPageId, picked: string | null) {
  const scene = p.scene;
  p.dim(0.9);
  stars(p, scene);
  p.text(VIEW.w / 2, 24, t('skillsTitle'), 30, SKILLS_COLOR, { bold: true, origin: [0.5, 0], glow: true });
  p.text(VIEW.w / 2, 64, t('skillsSubtitle'), 13, C.muted, { origin: [0.5, 0], align: 'center', wrap: VIEW.w - 80 });
  const known = new Set(progress.skills);
  SKILL_PAGES.forEach((pg, i) => {
    const r = skillTabRect(i, SKILL_PAGES.length);
    const n = pg.entries.filter((e) => known.has(e)).length;
    const on = pg.id === open;
    p.frame(r, on ? SKILLS_COLOR : n === pg.entries.length ? C.elite : C.muted, on ? '#2a2210' : C.panel);
    p.spots.push({ id: `page-${pg.id}`, ...r });
    fit(p.text(r.x + r.w / 2, r.y + 15, t(pg.name), 13, on ? C.text : C.muted, { bold: true, origin: [0.5, 0.5] }), r.w - 10);
    p.text(r.x + r.w / 2, r.y + 32, `${n}/${pg.entries.length}`, 11, C.muted, { origin: [0.5, 0.5] });
  });
  const page = SKILL_PAGES.find((pg) => pg.id === open) ?? SKILL_PAGES[0];
  const cols = page.entries.length > 24 ? 3 : 2;
  const rows = Math.ceil(page.entries.length / cols);
  const col = SKILL_LIST.w / cols;
  const row = Math.min(24, SKILL_LIST.h / rows);
  page.entries.forEach((id, i) => {
    const x = SKILL_LIST.x + Math.floor(i / rows) * col;
    const y = SKILL_LIST.y + (i % rows) * row;
    if (!known.has(id)) {
      p.text(x + 6, y, '? ? ?', 13, '#3d4a66');
      return;
    }
    const r = { x, y: y - 2, w: col - 8, h: row };
    if (id === picked) p.frame(r, SKILLS_COLOR, '#2a2210');
    p.spots.push({ id: `skill-${id}`, ...r });
    fit(p.text(x + 6, y, skillName(id), 13, id === picked ? SKILLS_COLOR : C.text, { bold: true }), col - 20);
  });
  // The one picked, described.
  const d = SKILL_DETAIL;
  p.frame(d, SKILLS_COLOR, C.panel);
  if (!picked || !known.has(picked)) {
    p.text(d.x + d.w / 2, d.y + d.h / 2, t(known.size ? 'skillsPick' : 'skillsNone'), 14, C.muted, { origin: [0.5, 0.5], align: 'center', wrap: d.w - 40 });
  } else {
    const left = d.x + 16;
    const wrap = d.w - 32;
    let y = d.y + 12;
    const line = (text: string, size: number, color: string, bold = false) => {
      const o = p.text(left, y, text, size, color, { wrap, bold });
      y += o.height + 4;
    };
    p.text(left, y, skillKind(picked), 11, SKILLS_COLOR, { bold: true });
    y += 18;
    line(skillName(picked), 19, C.text, true);
    for (const [text, color] of skillLines(picked)) line(text, 12.5, color);
  }
  button(p, BACK, 'back', t('armouryBack'), SKILLS_COLOR);
  p.text(VIEW.w / 2, BACK.y + BACK.h + 16, t('skillsHelp'), 12, C.muted, { origin: [0.5, 0] });
  return p;
}

/** An overview entry's name. */
function skillName(id: string) {
  if (id.startsWith(BRANCH_PREFIX)) return t(BRANCHES[branchOf(id)].name);
  if (id.startsWith(FUSION_PREFIX)) return t(FUSION_BY_ID[id.slice(FUSION_PREFIX.length)].name);
  return t(UPGRADES[id].name);
}

/** An overview entry's kind line: whose path, which pool, gear, specialisation or fusion. */
function skillKind(id: string) {
  if (id.startsWith(BRANCH_PREFIX)) return t('branchKind');
  if (id.startsWith(FUSION_PREFIX)) return t('fusionKind');
  const def = UPGRADES[id];
  if (def.kind === 'path') return t('skillsPathOf', { hero: t(HEROES[def.hero!].name).toUpperCase() });
  return t(def.kind === 'pool' ? POOL_NAMES[def.pool!] : 'gearKind');
}

/** An overview entry's description and tiers, each with its colour. */
function skillLines(id: string): [string, string][] {
  const tier = (n: number, text: string): [string, string] => [t('skillsTier', { n, text }), C.text];
  if (id.startsWith(BRANCH_PREFIX)) {
    const b = BRANCHES[branchOf(id)];
    return [[t('skillsBranchText'), C.muted], ...b.tiers.map((g, i) => tier(BASE_TIER + 1 + i, gainsText(g)))];
  }
  if (id.startsWith(FUSION_PREFIX)) {
    const f = FUSION_BY_ID[id.slice(FUSION_PREFIX.length)];
    return [
      [t(f.blurb), C.muted],
      [t('fusionNeeds', { a: t(UPGRADES[f.needs[0]].name), b: t(UPGRADES[f.needs[1]].name) }) + ` (${t('skillsFusionTier', { n: FUSION_NEEDS })})`, '#ff9de2'],
      [t('fusionLocks', { names: f.locks.map((u) => t(UPGRADES[u].name)).join(', ') }), '#ffb86b'],
      ...f.tiers.map((g, i) => tier(i + 1, gainsText(g))),
    ];
  }
  const def = UPGRADES[id];
  const branches = branchesOf(id).map((b) => t(BRANCHES[b].name)).join(', ');
  return [[t(def.blurb), C.muted], ...def.tiers.map((k, i) => tier(i + 1, t(k))), [t('skillsBranchesOf', { names: branches }), '#ffe066']];
}

const ARMOURY_COLOR = '#ffb347';
const WEEKLY_COLOR = '#7fe3ff';

/** The weekly run: the week's hero, its two mutators, how far it went this week, Start and Back. */
export function weeklyPanel(p: Panel, progress: Progress, week: number, hero: HeroId, mutators: readonly MutatorId[]) {
  const scene = p.scene;
  p.dim(0.85);
  stars(p, scene);
  p.text(VIEW.w / 2, 30, t('weeklyTitle'), 30, WEEKLY_COLOR, { bold: true, origin: [0.5, 0], glow: true });
  p.text(VIEW.w / 2, 72, t('weeklySubtitle', { n: week }), 13, C.muted, { origin: [0.5, 0], align: 'center', wrap: VIEW.w - 80 });
  const sch = schemeOf(hero);
  const hx = 220;
  p.text(hx, MUTATOR_CARD.y, t('weeklyHero'), 13, C.muted, { origin: [0.5, 0] });
  p.add(scene.add.image(hx, MUTATOR_CARD.y + 80, portraitKey(hero)).setScale(0.8), 2);
  fit(p.text(hx, MUTATOR_CARD.y + 130, t(HEROES[hero].name), 19, sch.accent, { bold: true, origin: [0.5, 0] }), 300);
  mutators.forEach((id, i) => {
    const r = { x: MUTATOR_CARD.x + i * MUTATOR_CARD.gap, y: MUTATOR_CARD.y, w: MUTATOR_CARD.w, h: MUTATOR_CARD.h };
    p.frame(r, WEEKLY_COLOR);
    p.text(r.x + r.w / 2, r.y + 22, t(MUTATORS[id].name), 18, WEEKLY_COLOR, { bold: true, origin: [0.5, 0] });
    p.text(r.x + r.w / 2, r.y + 58, t(MUTATORS[id].text), 14, C.text, { origin: [0.5, 0], align: 'center', wrap: r.w - 28 });
  });
  const mine = progress.weekly?.week === week ? progress.weekly : null;
  const best = !mine ? t('weeklyBestNone') : mine.won ? t('weeklyWon') : t('weeklyBest', { n: mine.best, of: STAGES });
  p.text(VIEW.w / 2, 330, best, 17, mine?.won ? C.elite : C.text, { bold: true, origin: [0.5, 0] });
  if (!mine?.won) p.text(VIEW.w / 2, 360, t('weeklyReward', { n: WEEKLY_BONUS }), 14, C.muted, { origin: [0.5, 0] });
  button(p, WEEKLY_BACK, 'back', t('armouryBack'), C.muted);
  button(p, WEEKLY_START, 'start', t('weeklyStart'), WEEKLY_COLOR);
  p.text(VIEW.w / 2, WEEKLY_START.y + WEEKLY_START.h + 16, t('weeklyHelp'), 12, C.muted, { origin: [0.5, 0] });
  return p;
}

/** The Armoury: a card per piece with its rank and the next rank's price, and Back. */
export function armouryPanel(p: Panel, progress: Progress) {
  const scene = p.scene;
  p.dim(0.85);
  stars(p, scene);
  p.text(VIEW.w / 2, 30, t('armouryTitle'), 30, ARMOURY_COLOR, { bold: true, origin: [0.5, 0], glow: true });
  p.text(VIEW.w / 2, 72, t('armourySubtitle'), 13, C.muted, { origin: [0.5, 0], align: 'center', wrap: VIEW.w - 80 });
  p.text(VIEW.w / 2, 112, t('armouryBank', { n: progress.bank }), 17, C.elite, { bold: true, origin: [0.5, 0] });
  ARMOURY.forEach((def, i) => {
    const r = armouryCardRect(i, ARMOURY.length);
    const rank = progress.armoury[def.id] ?? 0;
    const price = nextPrice(def.id, rank);
    const afford = price !== null && progress.bank >= price;
    p.frame(r, price === null ? C.elite : afford ? ARMOURY_COLOR : C.muted);
    p.spots.push({ id: def.id, ...r });
    const cx = r.x + r.w / 2;
    p.text(r.x + 8, r.y + 7, String(i + 1), 12, C.muted);
    fit(p.text(cx, r.y + 30, t(def.name), 17, C.text, { bold: true, origin: [0.5, 0] }), r.w - 16);
    const g = p.add(scene.add.graphics(), 2);
    const max = def.prices.length;
    for (let k = 0; k < max; k++) {
      const x = cx + (k - (max - 1) / 2) * 22;
      g.fillStyle(hex(k < rank ? ARMOURY_COLOR : '#2a3550'), 1).fillCircle(x, r.y + 70, 7);
    }
    p.text(cx, r.y + 86, t('armRank', { n: rank, of: max }), 12, C.muted, { origin: [0.5, 0] });
    p.text(cx, r.y + 112, t(def.text, { n: perkAmount(def.id, Math.max(1, price === null ? rank : rank + 1)) }), 13.5, C.text, { origin: [0.5, 0], align: 'center', wrap: r.w - 20 });
    p.text(cx, r.y + r.h - 16, price === null ? t('armMaxed') : t('armPrice', { n: price }), 15, price === null ? C.elite : afford ? ARMOURY_COLOR : C.muted, { bold: true, origin: [0.5, 1] });
  });
  button(p, BACK, 'back', t('armouryBack'), ARMOURY_COLOR);
  p.text(VIEW.w / 2, BACK.y + BACK.h + 16, t('armouryHelp'), 12, C.muted, { origin: [0.5, 0] });
  return p;
}

/** Whether a hero wears its mastery colours: open at its mastery level and not switched back. */
export const wearsColours = (progress: Progress, id: HeroId) =>
  masteryLevel(progress.mastery[id]) >= MASTERY.colourAt && !progress.plain.includes(id);

/** A hero's portrait key and accent as the select screen shows them (in its mastery colours when worn). */
function looks(p: Panel, progress: Progress, id: HeroId) {
  if (!wearsColours(progress, id)) return { portrait: portraitKey(id), accent: schemeOf(id).accent };
  bakeMastery(p.scene, id);
  return { portrait: masteryPortraitKey(id), accent: masteryScheme(id).accent };
}

/** The key that picks the hero card at `i`: 1-9 and 0, then - and =. */
export const heroKeyLabel = (i: number) => (i < 10 ? String((i + 1) % 10) : i === 10 ? '-' : '=');

/** The colours of a locked hero's placeholder. */
const LOCKED = { frame: '#2a3550', fill: '#0b1222' };

function heroCard(p: Panel, scene: Phaser.Scene, id: HeroId, i: number, progress: Progress, chosen: boolean) {
  const hero = HEROES[id];
  const sch = schemeOf(id);
  const open = isUnlocked(progress, id);
  const r = heroCardRect(i);
  const color = open ? sch.accent : LOCKED.frame;
  p.frame(r, color, chosen ? '#1a2a4a' : open ? C.panel : LOCKED.fill);
  p.spots.push({ id, ...r, locked: !open });
  const cx = r.x + r.w / 2;
  if (chosen) {
    const g = p.add(scene.add.graphics(), 2);
    g.lineStyle(3, hex(open ? sch.accent : C.muted), 1).strokeRoundedRect(r.x, r.y, r.w, r.h, 14);
  }
  p.text(r.x + 8, r.y + 7, heroKeyLabel(i), 12, C.muted);
  if (!open) {
    p.add(scene.add.image(cx, r.y + r.h / 2 - 4, 'rb-locked'), 2);
    return;
  }
  p.add(scene.add.image(cx, r.y + 62, looks(p, progress, id).portrait).setScale(0.44), 2);
  p.text(cx, r.y + 104, t(hero.name), 12.5, C.text, { bold: true, origin: [0.5, 0], align: 'center', wrap: r.w - 10 });
  p.text(cx, r.y + 142, sideOf(hero), 11, sch.accent, { origin: [0.5, 0], align: 'center', wrap: r.w - 8 });
  const wins = progress.wins[id] ?? 0;
  const furthest = progress.furthest[id] ?? 0;
  const best = progress.heat[id] ?? 0;
  const status = wins > 0 ? `${t('wins', { n: wins })}${best > 0 ? `  ·  ${t('cardHeat', { n: best })}` : ''}` : furthest > 0 ? t('reached', { n: furthest, of: STAGES }) : '';
  if (status) p.text(cx, r.y + r.h - 6, status, 10.5, wins > 0 ? C.elite : C.muted, { origin: [0.5, 1] });
}

/** The chosen hero in full: weapon, numbers, signature and paths; a locked one shows only its placeholder. */
function heroDetail(p: Panel, scene: Phaser.Scene, id: HeroId, progress: Progress, heat: number) {
  const hero = HEROES[id];
  const sch = schemeOf(id);
  const r = HERO_DETAIL;
  const cx = r.x + r.w / 2;
  if (!isUnlocked(progress, id)) {
    p.frame(r, LOCKED.frame, LOCKED.fill);
    p.add(scene.add.image(cx, r.y + 150, 'rb-locked').setScale(1.8), 2);
    p.text(cx, r.y + 270, t('locked'), 22, C.muted, { bold: true, origin: [0.5, 0] });
    return;
  }
  p.frame(r, sch.accent);
  const left = r.x + 18;
  const wrap = r.w - 36;
  p.add(scene.add.image(cx, r.y + 58, looks(p, progress, id).portrait).setScale(0.8), 2);
  fit(p.text(cx, r.y + 112, t(hero.name), 21, C.text, { bold: true, origin: [0.5, 0] }), r.w - 20);
  p.text(cx, r.y + 140, `${t(hero.weapon)}  ·  ${sideOf(hero)}`, 13, sch.accent, { origin: [0.5, 0] });
  p.text(cx, r.y + 160, t('heroStats', { hp: hero.maxHp, speed: hero.speed }), 12.5, C.muted, { origin: [0.5, 0] });
  // The lines flow down, since German runs longer.
  const lines = [
    [t(hero.blurb), C.text],
    [t('signatureFull', { name: t(hero.signature.name), text: t(hero.signature.text) }), sch.accent],
    [t('pathsLine', { paths: hero.paths.map((pid) => t(UPGRADES[pid].name)).join(', ') }), C.text],
  ].map(([text, color]) => p.text(left, 0, text, 12.5, color, { wrap }));
  // With the heat row up (and the mastery row over it), the lines shrink until they end above it.
  const open = heatOpen(progress.heat[id]);
  const xp = progress.mastery[id] ?? 0;
  const masteryY = (open > 0 ? HEAT_ROW.y : FIGHT.y) - MASTERY_ROW.h - 6;
  const bottom = xp > 0 ? masteryY - 4 : open > 0 ? HEAT_ROW.y - 4 : FIGHT.y - 4;
  for (let size = 12.5; ; size -= 0.5) {
    let y = r.y + 182;
    for (const line of lines) {
      line.setFontSize(size).setY(y);
      y += line.height + 6;
    }
    if (y - 6 <= bottom || size <= 10) break;
  }
  if (open > 0) heatRow(p, scene, heat, open, sch.accent);
  if (xp > 0) masteryRow(p, progress, id, masteryY);
  // Once a boss rush is open, its button sits beside Fight.
  const rush = rushPlanets(progress.codex.seen).length >= RUSH.minBosses;
  const fight = rush ? FIGHT_SHORT : FIGHT;
  p.frame(fight, sch.accent, '#14244a');
  p.spots.push({ id: 'fight', ...fight });
  fit(p.text(fight.x + fight.w / 2, fight.y + fight.h / 2, t('fightAs', { name: t(hero.short) }), 18, C.text, { bold: true, origin: [0.5, 0.5] }), fight.w - 16);
  if (rush) {
    p.frame(RUSH_BUTTON, RUSH_COLOR, '#24120c');
    p.spots.push({ id: 'rush', ...RUSH_BUTTON });
    p.text(RUSH_BUTTON.x + RUSH_BUTTON.w / 2, RUSH_BUTTON.y + RUSH_BUTTON.h / 2, t('rushButton'), 13, RUSH_COLOR, { bold: true, origin: [0.5, 0.5], align: 'center', wrap: RUSH_BUTTON.w - 10 });
  }
}

const RUSH_COLOR = '#ff9a3c';
const MASTERY_COLOR = '#ffd36b';

/** The hero's mastery: its level and XP toward the next, and from its colours' level a toggle between them and the usual ones. */
function masteryRow(p: Panel, progress: Progress, id: HeroId, y: number) {
  const xp = progress.mastery[id] ?? 0;
  const level = masteryLevel(xp);
  const next = masteryNext(xp);
  const r = { x: MASTERY_ROW.x, y, w: MASTERY_ROW.w, h: MASTERY_ROW.h };
  const g = p.add(p.scene.add.graphics(), 2);
  g.fillStyle(hex('#0b1222'), 0.9).fillRoundedRect(r.x, r.y, r.w, r.h, 8);
  // The bar toward the next level.
  const from = MASTERY.levels[level - 1];
  const k = next === null ? 1 : (xp - from) / (next - from);
  g.fillStyle(hex(MASTERY_COLOR), 0.25).fillRoundedRect(r.x, r.y, Math.max(8, r.w * k), r.h, 8);
  g.lineStyle(1.5, hex(MASTERY_COLOR), 0.7).strokeRoundedRect(r.x, r.y, r.w, r.h, 8);
  const label = next === null ? t('masteryMax', { n: level }) : t('masteryLevel', { n: level, xp, next });
  const colours = level >= MASTERY.colourAt;
  fit(p.text(r.x + 10, r.y + r.h / 2, label, 12, MASTERY_COLOR, { bold: true, origin: [0, 0.5] }), r.w - 20 - (colours ? MASTERY_ROW.colourW : 0));
  if (!colours) return;
  const b = { x: r.x + r.w - MASTERY_ROW.colourW, y: r.y, w: MASTERY_ROW.colourW, h: r.h };
  const on = wearsColours(progress, id);
  p.spots.push({ id: 'colour', ...b });
  g.fillStyle(hex(on ? masteryScheme(id).accent : schemeOf(id).accent), 1).fillCircle(b.x + 12, b.y + b.h / 2, 5);
  fit(p.text(b.x + 22, b.y + b.h / 2, t(on ? 'masteryColours' : 'usualColours'), 11, C.text, { origin: [0, 0.5] }), b.w - 26);
}

/**
 * The boss rush: every boss met so far, one after another with a set kit, for a best time. Shows
 * the hero, the bosses in order, the best rush, Start and Back.
 */
export function rushPanel(p: Panel, progress: Progress, hero: HeroId) {
  const scene = p.scene;
  p.dim(0.85);
  stars(p, scene);
  p.text(VIEW.w / 2, 30, t('rushTitle'), 30, RUSH_COLOR, { bold: true, origin: [0.5, 0], glow: true });
  p.text(VIEW.w / 2, 72, t('rushSubtitle', { level: RUSH.level, tier: RUSH.tiers }), 13, C.muted, { origin: [0.5, 0], align: 'center', wrap: VIEW.w - 80 });
  const look = looks(p, progress, hero);
  const hx = 200;
  p.text(hx, MUTATOR_CARD.y, t('rushHero'), 13, C.muted, { origin: [0.5, 0] });
  p.add(scene.add.image(hx, MUTATOR_CARD.y + 80, look.portrait).setScale(0.8), 2);
  fit(p.text(hx, MUTATOR_CARD.y + 130, t(HEROES[hero].name), 19, look.accent, { bold: true, origin: [0.5, 0] }), 300);
  const planets = rushPlanets(progress.codex.seen);
  const half = Math.ceil(planets.length / 2);
  planets.forEach((planet, i) => {
    const def = PLANETS[planet];
    const x = 400 + Math.floor(i / half) * 270;
    const y = 130 + (i % half) * 34;
    p.text(x, y, `${i + 1}.  ${t(BOSSES[def.boss].name)}`, 15, C.text, { bold: true });
    p.text(x + 22, y + 18, t(def.name), 11, def.ground.deco);
  });
  const best = progress.rush;
  p.text(VIEW.w / 2, 330, best ? t('rushBest', { n: best.bosses, time: clock(best.ms) }) : t('rushBestNone'), 17, best ? C.elite : C.text, { bold: true, origin: [0.5, 0] });
  p.text(VIEW.w / 2, 360, t('rushRules'), 13, C.muted, { origin: [0.5, 0], align: 'center', wrap: VIEW.w - 120 });
  button(p, WEEKLY_BACK, 'back', t('armouryBack'), C.muted);
  button(p, WEEKLY_START, 'start', t('weeklyStart'), RUSH_COLOR);
  p.text(VIEW.w / 2, WEEKLY_START.y + WEEKLY_START.h + 16, t('weeklyHelp'), 12, C.muted, { origin: [0.5, 0] });
  return p;
}

/** The end screen's lines on the hero's mastery: the XP the run gave and any level it reached. */
export function masteryLines(hero: HeroId, xp: number, before: number, after: number) {
  if (xp <= 0) return [];
  const lines = [t('masteryGain', { n: xp, hero: t(HEROES[hero].short), level: masteryLevel(after) })];
  for (let level = masteryLevel(before) + 1; level <= Math.min(MAX_MASTERY, masteryLevel(after)); level++) {
    const reward = MASTERY_REWARDS[level];
    if (reward) lines.push(t('masteryUp', { n: level, reward: t(reward) }));
  }
  return lines;
}

/**
 * The rift heat to fight at, from 0 to the highest open: the arrows step it down and up, and the
 * line under it names the rule that heat adds (each heat keeps the rules below it).
 */
function heatRow(p: Panel, scene: Phaser.Scene, heat: number, open: number, accent: string) {
  const g = p.add(scene.add.graphics(), 2);
  const hot = heat > 0 ? '#ff7a3c' : C.muted;
  g.fillStyle(hex('#0b1222'), 0.9).fillRoundedRect(HEAT_ROW.x, HEAT_ROW.y, HEAT_ROW.w, HEAT_ROW.h, 10);
  g.lineStyle(2, hex(hot), 0.8).strokeRoundedRect(HEAT_ROW.x, HEAT_ROW.y, HEAT_ROW.w, HEAT_ROW.h, 10);
  for (const [r, dir, on] of [[HEAT_DOWN, -1, heat > 0], [HEAT_UP, 1, heat < open]] as const) {
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    g.fillStyle(hex(on ? accent : C.muted), on ? 1 : 0.3).fillTriangle(cx + dir * 8, cy, cx - dir * 6, cy - 9, cx - dir * 6, cy + 9);
    p.spots.push({ id: dir < 0 ? 'heat-down' : 'heat-up', ...r });
  }
  const cx = HEAT_ROW.x + HEAT_ROW.w / 2;
  p.text(cx, HEAT_ROW.y + 4, t('heatLevel', { n: heat }), 14, hot, { bold: true, origin: [0.5, 0] });
  fit(p.text(cx, HEAT_ROW.y + 23, t(HEAT_RULES[heat]), 11, C.text, { origin: [0.5, 0] }), HEAT_ROW.w - 84);
}

/** Shrinks a one-line text to fit a width. */
function fit(text: Phaser.GameObjects.Text, width: number) {
  if (text.width > width) text.setScale(width / text.width);
  return text;
}

/**
 * A hero unlocked mid-run: the game stands still behind this panel, with the hero's art and name,
 * until Continue (a tap, Enter or Space).
 */
export function unlockPanel(p: Panel, id: HeroId) {
  const scene = p.scene;
  p.dim(0.75);
  const hero = HEROES[id];
  const sch = schemeOf(id);
  const r = UNLOCK;
  p.frame(r, sch.accent);
  const cx = r.x + r.w / 2;
  p.text(cx, r.y + 22, t('newHero'), 24, C.elite, { bold: true, origin: [0.5, 0], glow: true });
  p.add(scene.add.image(cx, r.y + 130, portraitKey(id)), 2);
  fit(p.text(cx, r.y + 204, t(hero.name), 22, C.text, { bold: true, origin: [0.5, 0] }), r.w - 30);
  p.text(cx, r.y + 236, `${t(hero.weapon)}  ·  ${sideOf(hero)}`, 13, sch.accent, { origin: [0.5, 0] });
  p.frame(CONTINUE, sch.accent, '#14244a');
  p.spots.push({ id: 'continue', ...CONTINUE });
  p.text(CONTINUE.x + CONTINUE.w / 2, CONTINUE.y + CONTINUE.h / 2, t('continueButton'), 18, C.text, { bold: true, origin: [0.5, 0.5] });
  p.text(cx, CONTINUE.y + CONTINUE.h + 10, t('continueHelp'), 12, C.muted, { origin: [0.5, 0] });
  return p;
}

/** Colour of a card by kind. */
function kindColor(s: GameState, id: string) {
  if (id === FILLER.id) return C.heal;
  const card = parseCard(id);
  if (card?.kind === 'fusion') return '#ff9de2';
  const def = UPGRADES[card?.id ?? id];
  if (def.kind === 'path') return schemeOf(s.hero!).accent;
  return def.kind === 'pool' ? POOL_COLORS[def.pool!] : '#b48cff';
}

const POOL_COLORS = { blaster: '#7df9ff', blade: '#e6ecff', current: '#8fd0ff', hollow: '#c08aff' } as const;

/** The small chain-link icon of a crossover hint. */
function linkIcon(p: Panel, scene: Phaser.Scene, x: number, y: number, color: string) {
  const g = p.add(scene.add.graphics(), 2);
  g.lineStyle(2, hex(color), 1);
  g.strokeRoundedRect(x, y + 2, 11, 7, 3.5);
  g.strokeRoundedRect(x + 7, y + 6, 11, 7, 3.5);
}

/** The level-up: three cards (four for Elara Voss) over the paused run. */
export function levelUp(p: Panel, s: GameState) {
  const scene = p.scene;
  p.dim(0.6);
  const reward = s.rewardPicks > 0;
  p.text(VIEW.w / 2, 70, reward ? t(s.after === 'run' ? 'objectiveReward' : 'arenaReward') : t('levelTitle', { n: s.level }), 30, reward ? C.elite : C.shard, { bold: true, origin: [0.5, 0], glow: true });
  const choices = s.choices ?? [];
  p.text(VIEW.w / 2, 108, `${reward ? t('freeTier') : t('chooseUpgrade')}  ·  ${t(choices.length > 3 ? 'tapCard4' : 'tapCard')}`, 14, C.muted, { origin: [0.5, 0] });
  choices.forEach((id, i) => {
    const r = levelCardRect(i, choices.length);
    const color = kindColor(s, id);
    p.frame(r, color);
    p.spots.push({ id, ...r });
    const cx = r.x + r.w / 2;
    const left = r.x + 16;
    const wrap = r.w - 32;
    if (id === FILLER.id) {
      p.text(cx, r.y + 22, t('supplies'), 11, color, { bold: true, origin: [0.5, 0] });
      p.text(cx, r.y + 48, t(FILLER.name), 22, C.text, { bold: true, origin: [0.5, 0] });
      p.text(left, r.y + 100, t(FILLER.text), 14, C.text, { wrap });
      return;
    }
    const card = parseCard(id)!;
    const fusion = card.kind === 'fusion' ? FUSION_BY_ID[card.id] : null;
    const def = fusion ? null : UPGRADES[card.id];
    const { held, max } = cardTiers(s, card);
    const kind = fusion ? t('fusionKind') : card.kind === 'branch' ? t('branchKind') : t(def!.kind === 'path' ? HEROES[s.hero!].pathKind : def!.kind === 'pool' ? POOL_NAMES[def!.pool!] : 'gearKind');
    p.text(cx, r.y + 18, kind, 11, color, { bold: true, origin: [0.5, 0] });
    fit(p.text(cx, r.y + 40, cardName(id), 21, C.text, { bold: true, origin: [0.5, 0] }), r.w - 20);
    // Tier pips: held tiers filled, the one this card gives ringed (the last two are the specialisation's).
    const pips = scene.add.graphics();
    const gap = max > 5 ? 17 : 22;
    for (let t = 0; t < max; t++) {
      const x = cx - (gap * (max - 1)) / 2 + t * gap;
      const y = r.y + 80;
      const c = !fusion && t >= BASE_TIER ? '#ffe066' : color;
      if (t < held) pips.fillStyle(hex(c), 1).fillCircle(x, y, 5);
      else if (t === held) pips.lineStyle(2, hex(c), 1).strokeCircle(x, y, 5).fillStyle(hex(c), 0.35).fillCircle(x, y, 5);
      else pips.lineStyle(1, hex(C.muted), 0.6).strokeCircle(x, y, 5);
    }
    p.add(pips, 2);
    p.text(cx, r.y + 94, held === 0 ? t('newUpgrade') : t('tier', { n: held + 1 }), 12, held === 0 ? C.elite : C.muted, { bold: true, origin: [0.5, 0] });
    // The lines flow down, so a long tier line (German, or a narrow card of four) never runs into the next.
    const four = choices.length > 3;
    const tier = p.text(left, r.y + 118, tierText(s, id), four ? 14 : 15, C.text, { bold: true, wrap });
    const blurbKey = fusion ? fusion.blurb : card.kind === 'branch' ? 'branchBlurb' : def!.blurb;
    const blurb = p.text(left, Math.max(r.y + 160, tier.y + tier.height + 8), t(blurbKey, { name: t(def?.name ?? 'branchKind') }), four ? 12 : 12.5, C.muted, { wrap });
    let y = Math.max(r.y + 206, blurb.y + blurb.height + 8);
    if (card.kind === 'branch' && !s.branches[card.id]) {
      // A specialisation shuts out the upgrade's other two.
      const others = branchesOf(card.id).filter((b) => b !== card.branch).map((b) => t(BRANCHES[b].name));
      p.text(left, y, t('branchLocks', { names: others.join(', ') }), 11.5, '#ffb86b', { wrap, bold: true });
      return number(p, r, i);
    }
    if (fusion) {
      // A fusion: what it fuses and what taking it shuts out.
      linkIcon(p, scene, left, y, '#ff9de2');
      const needs = p.text(left + 24, y, t('fusionNeeds', { a: t(UPGRADES[fusion.needs[0]].name), b: t(UPGRADES[fusion.needs[1]].name) }), 11.5, '#ff9de2', { wrap: wrap - 24 });
      y += needs.height + 4;
      if (!s.fusions[fusion.id]) {
        const shut = fusionShuts(fusion, s.hero!, s);
        const names = [...shut.upgrades.map((u) => t(UPGRADES[u].name)), ...shut.fusions.map((f) => t(FUSION_BY_ID[f].name))];
        p.text(left, y, t('fusionLocks', { names: names.join(', ') }), 11.5, '#ffb86b', { wrap, bold: true });
      }
      return number(p, r, i);
    }
    if (card.kind !== 'upgrade') return number(p, r, i);
    const cross = crossoverFor(id, s.hero!);
    const partner = cross ? (cross.path === id ? cross.pool : cross.path) : null;
    if (cross && partner) {
      // A crossover: a link icon and what the pair does.
      const done = s.crossovers.includes(cross.id);
      const has = (s.ranks[partner] ?? 0) > 0;
      const color = has || done ? '#e7d8ff' : '#c9b2ff';
      linkIcon(p, scene, left, y, color);
      const key = done ? 'crossoverDone' : has ? 'crossoverCompletes' : 'crossoverWith';
      const line = p.text(left + 24, y, t(key, { partner: t(UPGRADES[partner].name), text: t(cross.text) }), 11.5, color, { wrap: wrap - 24, bold: has && !done });
      y += line.height + 4;
    }
    const cap = capstoneFor(id, s.hero!);
    if (cap && !s.capstones.includes(cap.id)) {
      const line = p.text(left, y, t('capstoneHint', { name: t(cap.name), path: t(UPGRADES[cap.path].name), n: BASE_TIER, gear: t(UPGRADES[cap.gear].name) }), 11.5, '#c9b2ff', { wrap });
      y += line.height + 4;
    }
    // A fusion this upgrade is half of, once it is held.
    const fuse = FUSIONS.find((f) => f.needs.includes(id) && (s.ranks[id] ?? 0) > 0 && !lockedOf(s).has(fusionCard(f.id)) && !s.fusions[f.id] && f.needs.every((n) => n === id || (s.ranks[n] ?? 0) > 0));
    if (fuse) p.text(left, y, t('fusionHint', { name: t(fuse.name), n: FUSION_NEEDS }), 11.5, '#ff9de2', { wrap });
    number(p, r, i);
  });
  return p;
}

/** A card's key number in its top left corner. */
function number(p: Panel, r: { x: number; y: number }, i: number) {
  p.text(r.x + 12, r.y + 10, String(i + 1), 12, C.muted);
}

/** The end of a run: won or fallen, with the numbers and a button to go again. */
export function endScreen(p: Panel, s: GameState, progress: Progress, banked = 0, bonus = 0, daily: DailyRecord | null = null, extra: readonly string[] = []) {
  p.dim(0.7);
  const won = s.phase === 'won';
  // A won crusade (not a weekly, daily or boss rush) can go on into the endless rift.
  const endless = won && s.seed < 0 && !s.daily && !s.endless && !s.rush;
  const color = won ? C.elite : C.danger;
  p.text(VIEW.w / 2, 120, t(won ? 'victory' : 'fallen'), 46, color, { bold: true, origin: [0.5, 0], glow: true });
  const hero = HEROES[s.hero!];
  const planet = PLANETS[s.planet];
  const vars = { hero: t(hero.name), planet: t(planet.name), n: s.stage + 1, of: stagesOf(s) };
  const line = s.rush ? (won ? 'rushWon' : 'rushFell') : won ? (s.daily ? 'dailyWon' : BOSSES[planet.boss].beaten) : s.arena ? 'fellArena' : 'fellOn';
  const boss = t(BOSSES[planet.boss].name);
  p.text(VIEW.w / 2, 182, t(line, s.rush ? { ...vars, boss, n: s.rushBeaten, of: s.rushTotal } : { ...vars, boss }), 17, C.text, { origin: [0.5, 0] });
  const caps = s.capstones.map((id) => t(CAPSTONES.find((c) => c.id === id)!.name));
  const lines = [
    t('runStats', { time: clock(s.runMs), level: s.level, kills: s.kills, elites: s.elitesKilled }),
    caps.length ? t('capstonesLine', { names: caps.join(', ') }) : '',
    s.heat > 0 ? t('endHeat', { n: s.heat }) : '',
    won && !s.daily && !s.rush && heatOpen(s.heat) > s.heat ? t('heatOpened', { n: s.heat + 1, hero: t(hero.short) }) : '',
    s.week >= 0 ? t('weeklyEnd', { mutators: s.mutators.map((id) => t(MUTATORS[id].name)).join(' + ') }) : '',
    s.daily && daily?.score != null ? t('dailyEnd', { n: daily.score, best: daily.best }) : '',
    s.endless ? t('endlessEnd', { n: s.endlessCleared, best: progress.endless }) : '',
    banked > 0 ? t('banked', { n: banked }) : '',
    bonus > 0 ? t(s.daily ? 'dailyBonus' : 'weeklyBonus', { n: bonus }) : '',
    ...extra,
    s.rush ? '' : t('longestRun', { time: clock(progress.bestMs) }),
  ].filter(Boolean);
  p.text(VIEW.w / 2, 226, lines.join('\n'), 15, C.muted, { origin: [0.5, 0], align: 'center' });
  const again = endless ? AGAIN_SIDE : AGAIN;
  if (endless) {
    p.frame(ENDLESS_BUTTON, ENDLESS_COLOR, '#1d0f24');
    p.spots.push({ id: 'endless', ...ENDLESS_BUTTON });
    fit(p.text(ENDLESS_BUTTON.x + ENDLESS_BUTTON.w / 2, ENDLESS_BUTTON.y + ENDLESS_BUTTON.h / 2, t('endlessButton'), 19, ENDLESS_COLOR, { bold: true, origin: [0.5, 0.5] }), ENDLESS_BUTTON.w - 16);
  }
  p.frame(again, color);
  p.spots.push({ id: 'again', ...again });
  p.text(again.x + again.w / 2, again.y + again.h / 2, t('runAgain'), 19, C.text, { bold: true, origin: [0.5, 0.5] });
  p.text(VIEW.w / 2, AGAIN.y + AGAIN.h + 20, t(endless ? 'endlessHelp' : 'orEnter'), 12, C.muted, { origin: [0.5, 0], align: 'center' });
  return p;
}

const ENDLESS_COLOR = '#ff7de9';

/** A faint field of stars over the whole view behind the map, from a fixed pattern. */
function stars(p: Panel, scene: Phaser.Scene) {
  const g = p.fixed(p.add(scene.add.graphics(), 1));
  // As many stars per area as on the designed view.
  const count = Math.round((90 * SCREEN.w * SCREEN.h) / (VIEW.w * VIEW.h));
  for (let i = 0; i < count; i++) {
    const n = Math.sin(i * 127.1) * 43758.5453;
    const m = Math.sin(i * 311.7) * 24634.6345;
    const x = (n - Math.floor(n)) * SCREEN.w;
    const y = (m - Math.floor(m)) * SCREEN.h;
    g.fillStyle(0xcfe0ff, 0.15 + ((i * 37) % 10) / 25).fillCircle(x, y, i % 7 === 0 ? 1.6 : 1);
  }
  return g;
}

/** A planet on the map: a glowing disc in its own colours. */
function planetDisc(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, i: number, dim: boolean) {
  const def = PLANETS[i];
  const rim = hex(def.ground.deco);
  for (let k = 3; k >= 1; k--) g.lineStyle(2 + k * 5, rim, (dim ? 0.03 : 0.06) * (4 - k)).strokeCircle(x, y, r);
  g.fillStyle(hex(def.ground.field), 1).fillCircle(x, y, r);
  g.fillStyle(rim, dim ? 0.1 : 0.2).fillCircle(x - r * 0.25, y - r * 0.2, r * 0.55);
  g.lineStyle(2, rim, dim ? 0.5 : 0.95).strokeCircle(x, y, r);
}

/** A node's icon: a coin for the trader, a crown for the arena, a green cross for rest, a spark for events. */
function nodeIcon(g: Phaser.GameObjects.Graphics, kind: NodeKind, x: number, y: number) {
  const c = hex(NODE_INFO[kind].color);
  g.lineStyle(3, c, 1);
  if (kind === 'trader') {
    g.strokeCircle(x, y, 11);
    g.lineBetween(x, y - 6, x, y + 6);
  } else if (kind === 'elite') {
    // A crown.
    const crown = [[-12, 8], [-12, -6], [-6, 1], [0, -10], [6, 1], [12, -6], [12, 8]];
    g.beginPath();
    crown.forEach(([dx, dy], i) => (i === 0 ? g.moveTo(x + dx, y + dy) : g.lineTo(x + dx, y + dy)));
    g.closePath();
    g.strokePath();
  } else if (kind === 'rest') {
    g.fillStyle(c, 1).fillRect(x - 3, y - 11, 6, 22).fillRect(x - 11, y - 3, 22, 6);
  } else {
    g.lineBetween(x, y - 12, x, y + 12);
    g.lineBetween(x - 12, y, x + 12, y);
    g.lineBetween(x - 7, y - 7, x + 7, y + 7);
    g.lineBetween(x + 7, y - 7, x - 7, y + 7);
  }
}

/** The star map between planets: two or three nodes to choose from. */
export function starMap(p: Panel, s: GameState) {
  const scene = p.scene;
  p.dim(0.9);
  stars(p, scene);
  const next = s.next >= 0 ? s.next : chartOptions(s)[0];
  p.text(VIEW.w / 2, 26, t('starMap'), 30, '#9fd8ff', { bold: true, origin: [0.5, 0], glow: true });
  p.text(VIEW.w / 2, 64, t('mapSubtitle', { planet: t(PLANETS[s.planet].name), n: s.credits, keys: s.nodes.map((_, i) => i + 1).join(', ') }), 14, C.muted, { origin: [0.5, 0] });
  const g = p.add(scene.add.graphics(), 1);
  const n = s.nodes.length;
  // The routes: from the cleared planet through each node to the next.
  for (let i = 0; i < n; i++) {
    const spot = mapNodeSpot(i, n);
    g.lineStyle(2, hex(NODE_INFO[s.nodes[i]].color), 0.35);
    g.lineBetween(MAP.from.x + 50, MAP.from.y, spot.x - MAP.node.r, spot.y);
    g.lineBetween(spot.x + MAP.node.r + 210, spot.y, MAP.to.x - 60, MAP.to.y);
  }
  planetDisc(g, MAP.from.x, MAP.from.y, 50, s.planet, true);
  planetDisc(g, MAP.to.x, MAP.to.y, 60, next, false);
  p.text(MAP.from.x, MAP.from.y + 64, t('planetCleared', { planet: t(PLANETS[s.planet].name) }), 13, C.muted, { origin: [0.5, 0], align: 'center' });
  p.text(MAP.to.x, MAP.to.y + 74, t('nextPlanet', { planet: planetLabel(nextStage(s), next, stagesOf(s)) }), 14, C.text, { bold: true, origin: [0.5, 0], align: 'center' });
  p.text(MAP.to.x, MAP.to.y + 94, t(PLANETS[next].faction), 12.5, PLANETS[next].ground.deco, { origin: [0.5, 0] });
  s.nodes.forEach((kind, i) => {
    const info = NODE_INFO[kind];
    const r = mapNodeRect(i, n);
    const spot = mapNodeSpot(i, n);
    p.frame(r, info.color);
    p.spots.push({ id: kind, ...r });
    const icon = p.add(scene.add.graphics(), 2);
    icon.fillStyle(0x070b16, 1).fillCircle(spot.x, spot.y, MAP.node.r);
    icon.lineStyle(2, hex(info.color), 1).strokeCircle(spot.x, spot.y, MAP.node.r);
    nodeIcon(icon, kind, spot.x, spot.y);
    p.text(spot.x + MAP.node.r + 14, spot.y - 22, t(info.name), 18, C.text, { bold: true });
    p.text(spot.x + MAP.node.r + 14, spot.y + 2, t(info.text), 12, C.muted, { wrap: r.x + r.w - (spot.x + MAP.node.r + 14) - 10 });
    p.text(r.x + 10, r.y + 8, String(i + 1), 12, C.muted);
  });
  return p;
}

/**
 * The space map: the crusade's four jumps as columns, the route flown so far lit, and the planets of
 * the next jump as cards to tap (their faction shows once the save has charted them).
 */
export function spaceMap(p: Panel, s: GameState, charted: readonly string[]) {
  const scene = p.scene;
  p.dim(0.92);
  stars(p, scene);
  const options = chartOptions(s);
  // The jumps of this run (three for a daily), and the planets landed on in this loop of it.
  const stages = stagesOf(s);
  const route = s.route.slice(-(s.stage + 1));
  p.text(VIEW.w / 2, 26, t('spaceMap'), 30, '#9fd8ff', { bold: true, origin: [0.5, 0], glow: true });
  p.text(VIEW.w / 2, 64, t('spaceMapSubtitle', { planet: t(PLANETS[s.planet].name), keys: options.map((_, i) => i + 1).join(', ') }), 14, C.muted, { origin: [0.5, 0] });
  const g = p.add(scene.add.graphics(), 1);
  const spotOf = (planet: number) => {
    const col = PLANETS[planet].stage;
    const list = planetsAt(col);
    return chartSpot(col, list.indexOf(planet), list.length);
  };
  // Lanes between every planet of one jump and the next; the route flown so far, and the jumps on offer, lit.
  for (let col = 0; col < stages - 1; col++) {
    for (const a of planetsAt(col)) {
      for (const b of planetsAt(col + 1)) {
        const from = spotOf(a);
        const to = spotOf(b);
        const flown = route[col] === a && route[col + 1] === b;
        const offered = col === s.stage && a === s.planet;
        g.lineStyle(flown ? 3 : 1.5, flown ? 0x9fd8ff : offered ? hex(PLANETS[b].ground.deco) : 0x8ea0c4, flown ? 0.85 : offered ? 0.5 : 0.12);
        g.lineBetween(from.x, from.y, to.x, to.y);
      }
    }
  }
  // Every planet: the ones behind and ahead as small discs, the one the hero is on ringed.
  for (let col = 0; col < stages; col++) {
    const list = planetsAt(col);
    list.forEach((planet, i) => {
      if (col === s.stage + 1) return;
      const c = chartSpot(col, i, list.length);
      const past = col <= s.stage;
      const visited = route[col] === planet;
      const r = visited ? CHART.r : 18;
      planetDisc(g, c.x, c.y, r, planet, !visited);
      if (planet === s.planet) g.lineStyle(2, 0x9fd8ff, 0.9).strokeCircle(c.x, c.y, r + 8);
      p.text(c.x, c.y + r + 8, t(PLANETS[planet].name), 12, visited ? C.text : C.muted, { origin: [0.5, 0], bold: visited });
      if (planet === s.planet) p.text(c.x, c.y + r + 24, t('youAreHere'), 11, '#9fd8ff', { origin: [0.5, 0] });
      else if (past && !visited) p.text(c.x, c.y + r + 24, t('notTaken'), 11, C.muted, { origin: [0.5, 0] });
    });
  }
  // The jumps on offer.
  options.forEach((planet, i) => {
    const def = PLANETS[planet];
    const col = s.stage + 1;
    const r = chartRect(col, i, options.length);
    const c = chartSpot(col, i, options.length);
    p.frame(r, def.ground.deco);
    p.spots.push({ id: def.id, ...r });
    const disc = p.add(scene.add.graphics(), 2);
    const known = charted.includes(def.id);
    if (options.length > 3) {
      // Four to a column: the disc to the left of the name and faction, the hint below.
      planetDisc(disc, r.x + 24, r.y + 26, CHART4.r, planet, false);
      p.text(r.x + r.w - 8, r.y + 6, String(i + 1), 12, C.muted, { origin: [1, 0] });
      fit(p.text(r.x + 46, r.y + 10, t(def.name), 15, C.text, { bold: true }), r.w - 66);
      fit(p.text(r.x + 46, r.y + 30, known ? t(def.faction) : t('uncharted'), 11.5, known ? def.ground.deco : C.muted), r.w - 54);
      p.text(c.x, r.y + 52, t(def.hint), 11, C.muted, { origin: [0.5, 0], align: 'center', wrap: r.w - 16 });
      return;
    }
    planetDisc(disc, c.x, c.y - 18, CHART.r, planet, false);
    p.text(r.x + 10, r.y + 8, String(i + 1), 12, C.muted);
    p.text(c.x, c.y + 8, t(def.name), 15, C.text, { bold: true, origin: [0.5, 0] });
    p.text(c.x, c.y + 27, known ? t(def.faction) : t('uncharted'), 11.5, known ? def.ground.deco : C.muted, { origin: [0.5, 0] });
    p.text(c.x, c.y + 43, t(def.hint), 11, C.muted, { origin: [0.5, 0], align: 'center', wrap: CHART.w - 16 });
  });
  return p;
}

/** A plain button. */
function button(p: Panel, r: Rect, id: string, label: string, color: string, enabled = true) {
  p.frame(r, enabled ? color : C.muted);
  p.spots.push({ id, ...r });
  p.text(r.x + r.w / 2, r.y + r.h / 2, label, 16, enabled ? C.text : C.muted, { bold: true, origin: [0.5, 0.5] });
}

/** The trader: three offers bought with credits, a reroll and the way out. */
export function trader(p: Panel, s: GameState) {
  const scene = p.scene;
  p.dim(0.85);
  stars(p, scene);
  p.text(VIEW.w / 2, 40, t('traderTitle'), 30, NODE_INFO.trader.color, { bold: true, origin: [0.5, 0], glow: true });
  p.text(VIEW.w / 2, 80, t('traderSubtitle', { n: s.credits }), 14, C.muted, { origin: [0.5, 0] });
  s.offers.forEach((id, i) => {
    const r = tradeCardRect(i);
    const cx = r.x + r.w / 2;
    if (!id) {
      p.frame(r, C.muted, '#0b1222');
      p.spots.push({ id: 'sold', ...r });
      p.text(cx, r.y + r.h / 2, t('sold'), 18, C.muted, { origin: [0.5, 0.5] });
      return;
    }
    const card = parseCard(id)!;
    const def = card.kind === 'fusion' ? null : UPGRADES[card.id];
    const rank = cardTiers(s, card).held;
    const price = priceOf(s, id);
    const can = s.credits >= price;
    const color = kindColor(s, id);
    p.frame(r, can ? color : C.muted);
    p.spots.push({ id, ...r });
    const kind = !def ? t('fusionKind') : card.kind === 'branch' ? t('branchKind') : t(def.kind === 'path' ? 'pathKind' : def.kind === 'pool' ? POOL_NAMES[def.pool!] : 'gearKind');
    p.text(cx, r.y + 16, kind, 11, color, { bold: true, origin: [0.5, 0] });
    fit(p.text(cx, r.y + 36, cardName(id), 19, C.text, { bold: true, origin: [0.5, 0] }), r.w - 16);
    p.text(cx, r.y + 64, rank === 0 ? t('newUpgrade') : t('tier', { n: rank + 1 }), 12, rank === 0 ? C.elite : C.muted, { bold: true, origin: [0.5, 0] });
    p.text(r.x + 14, r.y + 88, tierText(s, id), 14, C.text, { bold: true, wrap: r.w - 28 });
    const blurb = card.kind === 'fusion' ? FUSION_BY_ID[card.id].blurb : card.kind === 'branch' ? 'branchBlurb' : def!.blurb;
    p.text(r.x + 14, r.y + 132, t(blurb, { name: t(def?.name ?? 'branchKind') }), 12, C.muted, { wrap: r.w - 28 });
    p.text(cx, r.y + r.h - 30, t('credits', { n: price }), 16, can ? NODE_INFO.trader.color : C.danger, { bold: true, origin: [0.5, 0] });
    p.text(r.x + 10, r.y + 8, String(i + 1), 12, C.muted);
  });
  const price = rerollPrice(s);
  button(p, REROLL, 'reroll', price > 0 ? t('reroll', { n: price }) : t('rerollFree'), NODE_INFO.trader.color, s.credits >= price);
  button(p, LEAVE, 'leave', t('leave'), '#9fd8ff');
  return p;
}

/** An event: what happened and two ways to answer it. */
export function eventPanel(p: Panel, s: GameState) {
  const scene = p.scene;
  p.dim(0.85);
  stars(p, scene);
  const ev = s.event!;
  p.text(VIEW.w / 2, 70, t('eventTitle'), 14, NODE_INFO.event.color, { bold: true, origin: [0.5, 0] });
  p.text(VIEW.w / 2, 92, t(ev.title), 30, C.text, { bold: true, origin: [0.5, 0], glow: true });
  p.text(VIEW.w / 2, 150, t(ev.text), 15, C.muted, { origin: [0.5, 0], align: 'center', wrap: 600 });
  p.text(VIEW.w / 2, 252, t('tapAnswer'), 13, C.muted, { origin: [0.5, 0] });
  // The shrine's trade names the two abilities.
  const names: Vars = ev.lose && ev.gain ? { lose: t(UPGRADES[ev.lose].name), gain: t(UPGRADES[ev.gain].name) } : {};
  ev.options.forEach((o, i) => {
    const r = eventOptionRect(i);
    p.frame(r, i === 0 ? NODE_INFO.event.color : '#9fd8ff');
    p.spots.push({ id: `option-${i}`, ...r });
    p.text(r.x + 18, r.y + 14, `${i + 1}   ${t(o.label)}`, 18, C.text, { bold: true });
    p.text(r.x + 40, r.y + 44, t(o.text, names), 13.5, C.muted, { wrap: r.w - 60 });
  });
  return p;
}
