/**
 * The full-screen panels drawn over the field: the hero select screen, the level-up cards and the
 * end of a run. Each is a list of HUD objects (scroll factor 0) the scene destroys when done, and
 * reports where its tappable rectangles are so the scene (and the playthrough test) can use them.
 */
import Phaser from 'phaser';
import { HEROES, HERO_IDS, schemeOf, type HeroDef, type HeroId } from '../game/heroes';
import { clock, type GameState } from '../game/state';
import { CAPSTONES, FILLER, MAX_TIER, POOL_NAMES, UPGRADES, capstoneFor, crossoverFor } from '../game/upgrades';
import { BOSSES, NODE_INFO, PLANETS, STAGES, TRADE, planetLabel, planetsAt, type NodeKind } from '../game/planets';
import { chartOptions, priceOf } from '../game/voyage';
import { isUnlocked, type Progress } from '../game/save';
import { HEAT_RULES, heatOpen } from '../game/heat';
import type { Vars } from '../../../../shared/i18n';
import { t } from '../i18n';
import { C, hex } from '../art/glow';
import { portraitKey } from '../art/sprites';
import {
  AGAIN, CHART, CONTINUE, DEPTH, FIGHT, FONT, HEAT_DOWN, HEAT_ROW, HEAT_UP, HERO_DETAIL, LEAVE, MAP, REROLL, SCREEN, UNLOCK, VIEW, chartRect, chartSpot, eventOptionRect, heroCardRect,
  levelCardRect, mapNodeRect, mapNodeSpot, tradeCardRect, type Rect,
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
export function heroSelect(p: Panel, progress: Progress, chosen: HeroId, heat = 0) {
  const scene = p.scene;
  p.dim(0.55);
  p.text(VIEW.w / 2, 12, 'RIFTBLADE', 32, '#9fd8ff', { bold: true, origin: [0.5, 0], glow: true });
  p.text(VIEW.w / 2, 54, t('selectSubtitle'), 14, C.muted, { origin: [0.5, 0] });
  HERO_IDS.forEach((id, i) => heroCard(p, scene, id, i, progress, id === chosen));
  heroDetail(p, scene, chosen, progress, heat);
  const best = progress.bestMs > 0 ? `${t('longestRun', { time: clock(progress.bestMs) })}  ·  ` : '';
  p.text(VIEW.w / 2, VIEW.h - 22, `${best}${t('selectHelp')}`, 13, C.muted, { origin: [0.5, 0.5] });
  return p;
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
  p.add(scene.add.image(cx, r.y + 62, portraitKey(id)).setScale(0.44), 2);
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
  p.add(scene.add.image(cx, r.y + 58, portraitKey(id)).setScale(0.8), 2);
  fit(p.text(cx, r.y + 112, t(hero.name), 21, C.text, { bold: true, origin: [0.5, 0] }), r.w - 20);
  p.text(cx, r.y + 140, `${t(hero.weapon)}  ·  ${sideOf(hero)}`, 13, sch.accent, { origin: [0.5, 0] });
  p.text(cx, r.y + 160, t('heroStats', { hp: hero.maxHp, speed: hero.speed }), 12.5, C.muted, { origin: [0.5, 0] });
  // The lines flow down, since German runs longer.
  const lines = [
    [t(hero.blurb), C.text],
    [t('signatureFull', { name: t(hero.signature.name), text: t(hero.signature.text) }), sch.accent],
    [t('pathsLine', { paths: hero.paths.map((pid) => t(UPGRADES[pid].name)).join(', ') }), C.text],
  ].map(([text, color]) => p.text(left, 0, text, 12.5, color, { wrap }));
  // With the heat row up, the lines shrink until they end above it.
  const open = heatOpen(progress.heat[id]);
  const bottom = open > 0 ? HEAT_ROW.y - 4 : FIGHT.y - 4;
  for (let size = 12.5; ; size -= 0.5) {
    let y = r.y + 182;
    for (const line of lines) {
      line.setFontSize(size).setY(y);
      y += line.height + 6;
    }
    if (y - 6 <= bottom || size <= 10) break;
  }
  if (open > 0) heatRow(p, scene, heat, open, sch.accent);
  p.frame(FIGHT, sch.accent, '#14244a');
  p.spots.push({ id: 'fight', ...FIGHT });
  p.text(FIGHT.x + FIGHT.w / 2, FIGHT.y + FIGHT.h / 2, t('fightAs', { name: t(hero.short) }), 18, C.text, { bold: true, origin: [0.5, 0.5] });
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
  const def = UPGRADES[id];
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
    const def = UPGRADES[id];
    const rank = s.ranks[id] ?? 0;
    const kind = t(def.kind === 'path' ? HEROES[s.hero!].pathKind : def.kind === 'pool' ? POOL_NAMES[def.pool!] : 'gearKind');
    p.text(cx, r.y + 18, kind, 11, color, { bold: true, origin: [0.5, 0] });
    fit(p.text(cx, r.y + 40, t(def.name), 21, C.text, { bold: true, origin: [0.5, 0] }), r.w - 20);
    // Tier pips: held tiers filled, the one this card gives ringed.
    const pips = scene.add.graphics();
    for (let t = 0; t < MAX_TIER; t++) {
      const x = cx - 44 + t * 22;
      const y = r.y + 80;
      if (t < rank) pips.fillStyle(hex(color), 1).fillCircle(x, y, 5);
      else if (t === rank) pips.lineStyle(2, hex(color), 1).strokeCircle(x, y, 5).fillStyle(hex(color), 0.35).fillCircle(x, y, 5);
      else pips.lineStyle(1, hex(C.muted), 0.6).strokeCircle(x, y, 5);
    }
    p.add(pips, 2);
    p.text(cx, r.y + 94, rank === 0 ? t('newUpgrade') : t('tier', { n: rank + 1 }), 12, rank === 0 ? C.elite : C.muted, { bold: true, origin: [0.5, 0] });
    // The lines flow down, so a long tier line (German, or a narrow card of four) never runs into the next.
    const four = choices.length > 3;
    const tier = p.text(left, r.y + 118, t(def.tiers[rank]), four ? 14 : 15, C.text, { bold: true, wrap });
    const blurb = p.text(left, Math.max(r.y + 160, tier.y + tier.height + 8), t(def.blurb), four ? 12 : 12.5, C.muted, { wrap });
    const cross = crossoverFor(id, s.hero!);
    const partner = cross ? (cross.path === id ? cross.pool : cross.path) : null;
    let y = Math.max(r.y + 206, blurb.y + blurb.height + 8);
    if (cross && partner) {
      // A crossover: a link icon and what the pair does.
      const done = s.crossovers.includes(cross.id);
      const held = (s.ranks[partner] ?? 0) > 0;
      const color = held || done ? '#e7d8ff' : '#c9b2ff';
      linkIcon(p, scene, left, y, color);
      const key = done ? 'crossoverDone' : held ? 'crossoverCompletes' : 'crossoverWith';
      const line = p.text(left + 24, y, t(key, { partner: t(UPGRADES[partner].name), text: t(cross.text) }), 11.5, color, { wrap: wrap - 24, bold: held && !done });
      y += line.height + 4;
    }
    const cap = capstoneFor(id, s.hero!);
    if (cap && !s.capstones.includes(cap.id)) p.text(left, y, t('capstoneHint', { name: t(cap.name), path: t(UPGRADES[cap.path].name), n: MAX_TIER, gear: t(UPGRADES[cap.gear].name) }), 11.5, '#c9b2ff', { wrap });
    p.text(r.x + 12, r.y + 10, String(i + 1), 12, C.muted);
  });
  return p;
}

/** The end of a run: won or fallen, with the numbers and a button to go again. */
export function endScreen(p: Panel, s: GameState, progress: Progress) {
  p.dim(0.7);
  const won = s.phase === 'won';
  const color = won ? C.elite : C.danger;
  p.text(VIEW.w / 2, 120, t(won ? 'victory' : 'fallen'), 46, color, { bold: true, origin: [0.5, 0], glow: true });
  const hero = HEROES[s.hero!];
  const planet = PLANETS[s.planet];
  const vars = { hero: t(hero.name), planet: t(planet.name), n: s.stage + 1, of: STAGES };
  p.text(VIEW.w / 2, 182, t(won ? BOSSES[planet.boss].beaten : s.arena ? 'fellArena' : 'fellOn', vars), 17, C.text, { origin: [0.5, 0] });
  const caps = s.capstones.map((id) => t(CAPSTONES.find((c) => c.id === id)!.name));
  const lines = [
    t('runStats', { time: clock(s.runMs), level: s.level, kills: s.kills, elites: s.elitesKilled }),
    caps.length ? t('capstonesLine', { names: caps.join(', ') }) : '',
    s.heat > 0 ? t('endHeat', { n: s.heat }) : '',
    won && heatOpen(s.heat) > s.heat ? t('heatOpened', { n: s.heat + 1, hero: t(hero.short) }) : '',
    t('longestRun', { time: clock(progress.bestMs) }),
  ].filter(Boolean);
  p.text(VIEW.w / 2, 226, lines.join('\n'), 15, C.muted, { origin: [0.5, 0], align: 'center' });
  p.frame(AGAIN, color);
  p.spots.push({ id: 'again', ...AGAIN });
  p.text(AGAIN.x + AGAIN.w / 2, AGAIN.y + AGAIN.h / 2, t('runAgain'), 19, C.text, { bold: true, origin: [0.5, 0.5] });
  p.text(VIEW.w / 2, AGAIN.y + AGAIN.h + 20, t('orEnter'), 12, C.muted, { origin: [0.5, 0] });
  return p;
}

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
  p.text(MAP.to.x, MAP.to.y + 74, t('nextPlanet', { planet: planetLabel(s.stage + 1, next) }), 14, C.text, { bold: true, origin: [0.5, 0], align: 'center' });
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
  p.text(VIEW.w / 2, 26, t('spaceMap'), 30, '#9fd8ff', { bold: true, origin: [0.5, 0], glow: true });
  p.text(VIEW.w / 2, 64, t('spaceMapSubtitle', { planet: t(PLANETS[s.planet].name), keys: options.map((_, i) => i + 1).join(', ') }), 14, C.muted, { origin: [0.5, 0] });
  const g = p.add(scene.add.graphics(), 1);
  const spotOf = (planet: number) => {
    const col = PLANETS[planet].stage;
    const list = planetsAt(col);
    return chartSpot(col, list.indexOf(planet), list.length);
  };
  // Lanes between every planet of one jump and the next; the route flown so far, and the jumps on offer, lit.
  for (let col = 0; col < STAGES - 1; col++) {
    for (const a of planetsAt(col)) {
      for (const b of planetsAt(col + 1)) {
        const from = spotOf(a);
        const to = spotOf(b);
        const flown = s.route[col] === a && s.route[col + 1] === b;
        const offered = col === s.stage && a === s.planet;
        g.lineStyle(flown ? 3 : 1.5, flown ? 0x9fd8ff : offered ? hex(PLANETS[b].ground.deco) : 0x8ea0c4, flown ? 0.85 : offered ? 0.5 : 0.12);
        g.lineBetween(from.x, from.y, to.x, to.y);
      }
    }
  }
  // Every planet: the ones behind and ahead as small discs, the one the hero is on ringed.
  for (let col = 0; col < STAGES; col++) {
    const list = planetsAt(col);
    list.forEach((planet, i) => {
      if (col === s.stage + 1) return;
      const c = chartSpot(col, i, list.length);
      const past = col <= s.stage;
      const visited = s.route[col] === planet;
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
    planetDisc(disc, c.x, c.y - 18, CHART.r, planet, false);
    p.text(r.x + 10, r.y + 8, String(i + 1), 12, C.muted);
    p.text(c.x, c.y + 8, t(def.name), 15, C.text, { bold: true, origin: [0.5, 0] });
    const known = charted.includes(def.id);
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
    const def = UPGRADES[id];
    const rank = s.ranks[id] ?? 0;
    const price = priceOf(s, id);
    const can = s.credits >= price;
    const color = kindColor(s, id);
    p.frame(r, can ? color : C.muted);
    p.spots.push({ id, ...r });
    const kind = t(def.kind === 'path' ? 'pathKind' : def.kind === 'pool' ? POOL_NAMES[def.pool!] : 'gearKind');
    p.text(cx, r.y + 16, kind, 11, color, { bold: true, origin: [0.5, 0] });
    p.text(cx, r.y + 36, t(def.name), 19, C.text, { bold: true, origin: [0.5, 0] });
    p.text(cx, r.y + 64, rank === 0 ? t('newUpgrade') : t('tier', { n: rank + 1 }), 12, rank === 0 ? C.elite : C.muted, { bold: true, origin: [0.5, 0] });
    p.text(r.x + 14, r.y + 88, t(def.tiers[rank]), 14, C.text, { bold: true, wrap: r.w - 28 });
    p.text(r.x + 14, r.y + 132, t(def.blurb), 12, C.muted, { wrap: r.w - 28 });
    p.text(cx, r.y + r.h - 30, t('credits', { n: price }), 16, can ? NODE_INFO.trader.color : C.danger, { bold: true, origin: [0.5, 0] });
    p.text(r.x + 10, r.y + 8, String(i + 1), 12, C.muted);
  });
  button(p, REROLL, 'reroll', t('reroll', { n: TRADE.reroll }), NODE_INFO.trader.color, s.credits >= TRADE.reroll);
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
