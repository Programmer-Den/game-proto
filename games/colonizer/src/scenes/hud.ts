// The HUD pieces that sit outside the panel's buttons: the top bar with its three-pip age track,
// the deeds card, the horn toast and the minimap. Each is a small class the GameScene updates every
// frame; all of them are fixed to the screen (scroll factor 0).
import Phaser from 'phaser';
import { AGE3_DAMAGE, AGE4_DAMAGE, ARMY_DEED, BUILDINGS, DEEDS, DEEDS4, RANK_NAMES, VETERAN_RANK, FACTIONS, MAP_SIZE, RELICS, RESOURCES, TEMPERAMENTS, TILE, type FactionId, type RelicId } from '../game/data';
import { DIRT, ROCK, SHALLOW, WATER } from '../game/map';
import { deed4Count, deedCount, monumentLeft, NEUTRAL, PLAYER, popCap, popUsed, rivalsOf, type GameState, type Player } from '../game/sim';
import type { Scenario } from '../game/campaign';
import { WOOL } from '../art/figures';
import { hexNum, mix, SERIF, T } from '../art/stitch';
import { settings } from '../../../../shared/settings';
import { formatNumber } from '../../../../shared/i18n';
import { t } from '../i18n';
import { AGE_PIPS, DEED_CARD, MINI, MISSION_CARD, STATUS_CARD, TOAST, TOP_RIGHT, TOP_SLOTS } from './layout';

const HUD_DEPTH = 9990;
const ink = (size: number, color: string = T.ink, bold = true): Phaser.Types.GameObjects.Text.TextStyle => ({
  fontFamily: SERIF,
  fontSize: `${size}px`,
  fontStyle: bold ? 'bold' : 'normal',
  color,
});

/** Thread-like dashes along a line in a Graphics: a run of short stitches. */
export function stitchLine(g: Phaser.GameObjects.Graphics, x0: number, y0: number, x1: number, y1: number, width: number, col: number, alpha = 1) {
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len < 0.5) return;
  const n = Math.max(1, Math.round(len / 2.75));
  g.lineStyle(width, col, alpha);
  for (let i = 0; i < n; i++) {
    const a = i / n;
    const b = Math.min(1, (i + 0.8) / n);
    g.lineBetween(x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b);
  }
}

/** A row of `of` stars centred at (x, y), the first `n` filled (in ochre unless told), the rest left as outlines. */
export function stitchStars(g: Phaser.GameObjects.Graphics, x: number, y: number, n: number, r: number, of = 3, fill: string = T.ochre) {
  const gap = r * 2.4;
  for (let k = 0; k < of; k++) {
    const cx = x + (k - (of - 1) / 2) * gap;
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.45 : r;
      pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * rr, y + Math.sin(a) * rr));
    }
    if (k < n) g.fillStyle(hexNum(fill), 1).fillPoints(pts, true);
    g.lineStyle(Math.max(0.8, r / 9), hexNum(T.ink), 1).strokePoints(pts, true);
  }
}

/** A dashed (chain-stitch) ellipse. */
export function stitchEllipse(g: Phaser.GameObjects.Graphics, x: number, y: number, rx: number, ry: number, width: number, col: number, alpha = 1) {
  const n = Math.max(12, Math.round((rx + ry) * 1.2));
  g.lineStyle(width, col, alpha);
  for (let i = 0; i < n; i += 2) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = ((i + 1.4) / n) * Math.PI * 2;
    g.lineBetween(x + Math.cos(a0) * rx, y + Math.sin(a0) * ry, x + Math.cos(a1) * rx, y + Math.sin(a1) * ry);
  }
}

const fixed = <G extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: G, d = 1) => o.setScrollFactor(0).setDepth(HUD_DEPTH + d);

/** The top border: resources, population, the age track, the clock and the faction. */
export class TopBar {
  private values: Partial<Record<string, Phaser.GameObjects.Text>> = {};
  private labels: Partial<Record<string, Phaser.GameObjects.Text>> = {};
  private pips: Phaser.GameObjects.Graphics;
  private pipText: Phaser.GameObjects.Text[] = [];
  private boonIcon: Phaser.GameObjects.Image;
  private edgeIcon: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, faction: FactionId) {
    fixed(scene.add.image(0, 0, 'topbar').setOrigin(0, 0), 0);
    const slots: [string, number, string][] = [['wood', TOP_SLOTS.wood, t('woodLabel')], ['food', TOP_SLOTS.food, t('foodLabel')], ['ore', TOP_SLOTS.ore, t('oreLabel')], ['pop', TOP_SLOTS.pop, t('popLabel')]];
    for (const [key, x, label] of slots) {
      fixed(scene.add.image(x + 8, 15, `icon-${key}`), 2);
      this.values[key] = fixed(scene.add.text(x + 19, 15, '', ink(14)).setOrigin(0, 0.5), 2);
      this.labels[key] = fixed(scene.add.text(x + 60, 16, label.toUpperCase(), ink(8.5, T.faded)).setOrigin(0, 0.5), 2);
    }
    fixed(scene.add.text(TOP_SLOTS.age, 15, t('ageLabel').toUpperCase(), ink(10)).setOrigin(0, 0.5), 2);
    this.pips = fixed(scene.add.graphics(), 2);
    ['I', 'II', 'III', 'IV'].forEach((p, k) => this.pipText.push(fixed(scene.add.text(AGE_PIPS.x + k * AGE_PIPS.gap, AGE_PIPS.y, p, ink(7, T.ink)).setOrigin(0.5, 0.5), 3)));
    fixed(scene.add.image(TOP_SLOTS.clock + 8, 15, 'icon-clock'), 2);
    this.values.clock = fixed(scene.add.text(TOP_SLOTS.clock + 19, 15, '', ink(14)).setOrigin(0, 0.5), 2);
    fixed(scene.add.image(TOP_SLOTS.faction + 8, 15, `icon-banner-${faction}`), 2);
    fixed(scene.add.text(TOP_SLOTS.faction + 20, 15, t(FACTIONS[faction].name).toUpperCase(), ink(12.5, WOOL[faction].cloth)).setOrigin(0, 0.5), 2);
    this.boonIcon = fixed(scene.add.image(TOP_RIGHT.boon, 15, 'icon-shield').setVisible(false), 2);
    this.edgeIcon = fixed(scene.add.image(TOP_RIGHT.edge, 15, 'icon-stone').setVisible(false), 2);
  }

  update(s: GameState) {
    const p = s.players[PLAYER];
    for (const r of RESOURCES) this.set(r, formatNumber(Math.floor(p.res[r])));
    this.set('pop', `${formatNumber(popUsed(s, PLAYER))}/${formatNumber(popCap(s, PLAYER))}`);
    const secs = Math.floor(s.time / 1000);
    this.values.clock!.setText(`${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`);
    // The age track: a pip per age, filled when reached; the next one fills as its deeds are done.
    const g = this.pips.clear();
    const part = p.age === 1 ? 0 : p.age === 2 ? deedCount(p) / 3 : p.age === 3 ? deed4Count(p) / 3 : 1;
    for (let k = 0; k < 4; k++) {
      const x = AGE_PIPS.x + k * AGE_PIPS.gap;
      const done = k < p.age;
      g.fillStyle(hexNum(done ? T.ochre : T.card), 1).fillCircle(x, AGE_PIPS.y, AGE_PIPS.r);
      if (k === p.age && part > 0) {
        g.lineStyle(2.4, hexNum(mix(T.ochre, T.card, 0.2)), 1);
        g.beginPath();
        g.arc(x, AGE_PIPS.y, AGE_PIPS.r - 1.4, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * part);
        g.strokePath();
      }
      stitchEllipse(g, x, AGE_PIPS.y, AGE_PIPS.r, AGE_PIPS.r, 0.9, hexNum(T.ink));
      this.pipText[k].setColor(done ? T.ink : T.faded);
    }
    if (p.boon) this.boonIcon.setTexture(p.boon === 'shieldwall' ? 'icon-shield' : 'icon-wheat').setVisible(true);
    if (p.edge) this.edgeIcon.setTexture(p.edge === 'masonry' ? 'icon-stone' : 'icon-drum').setVisible(true);
  }

  private set(key: string, v: string) {
    const t = this.values[key]!;
    t.setText(v);
    this.labels[key]?.setX(t.x + t.width + 3);
  }
}

/** The deeds for Age III, and from Age III on those for Age IV, as a stitched card under the top bar. */
export class DeedCard {
  private title: Phaser.GameObjects.Text;
  private count: Phaser.GameObjects.Text;
  private rows: { name: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text }[] = [];
  private foot: Phaser.GameObjects.Text;
  private g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    const { x, y, w } = DEED_CARD;
    fixed(scene.add.image(x - 2, y - 2, 'card-deeds').setOrigin(0, 0), 0);
    this.g = fixed(scene.add.graphics(), 1);
    this.title = fixed(scene.add.text(x + 9, y + 12, t('deedsTitle').toUpperCase(), ink(11.5, T.red)).setOrigin(0, 0.5), 2);
    this.count = fixed(scene.add.text(x + w - 9, y + 12, '', ink(12)).setOrigin(1, 0.5), 2);
    DEEDS.forEach((d, i) => {
      const ry = y + 32 + i * 16;
      this.rows.push({
        name: fixed(scene.add.text(x + 26, ry, t(d.name, { n: ARMY_DEED }), ink(11)).setOrigin(0, 0.5), 2),
        sub: fixed(scene.add.text(x + w - 9, ry + 0.5, '', ink(9, T.faded, false)).setOrigin(1, 0.5), 2),
      });
    });
    this.foot = fixed(scene.add.text(x + 9, y + DEED_CARD.h - 11, '', { ...ink(9.5, T.indigo, false), fontStyle: 'italic' }).setOrigin(0, 0.5), 2);
  }

  update(s: GameState) {
    const p: Player = s.players[PLAYER];
    const { x, y, w } = DEED_CARD;
    const g = this.g.clear();
    stitchLine(g, x + 4, y + 22, x + w - 4, y + 22, 0.8, hexNum(T.ochre));
    const raid = s.raid && s.raid.target === PLAYER ? s.raid : null;
    // From Age III the card turns to the Age IV deeds: a relic, the champion, a Veteran.
    const four = p.age >= 3;
    DEEDS4.forEach((d, i) => this.rows[i].name.setText(t(four ? d.name : DEEDS[i].name, { n: ARMY_DEED, rank: t(RANK_NAMES[VETERAN_RANK - 1]) })));
    const best = Math.max(0, ...[...s.units.values()].filter((u) => u.owner === PLAYER).map((u) => u.rank));
    const rows: { done: boolean; frac: number; sub: string }[] = four ? [
      { done: p.deeds4.relic, frac: -1, sub: t('noneYet') },
      { done: p.deeds4.champion, frac: -1, sub: t('noneYet') },
      { done: p.deeds4.veteran, frac: Math.min(1, best / VETERAN_RANK), sub: t('deedProgress', { n: Math.min(best, VETERAN_RANK), total: VETERAN_RANK }) },
    ] : [
      { done: p.deeds.age2, frac: p.age >= 2 ? 1 : 0, sub: '' },
      { done: p.deeds.army >= ARMY_DEED, frac: Math.min(1, p.deeds.army / ARMY_DEED), sub: t('deedProgress', { n: Math.min(p.deeds.army, ARMY_DEED), total: ARMY_DEED }) },
      { done: p.deeds.raid, frac: raid ? raid.routed / raid.size : 0, sub: raid ? t('deedRouted', { n: raid.routed, total: raid.size }) : t('noneYet') },
    ];
    rows.forEach((r, i) => {
      const ry = y + 32 + i * 16;
      g.fillStyle(hexNum(r.done ? T.green : T.card), 1).fillCircle(x + 15, ry, 5.5);
      stitchEllipse(g, x + 15, ry, 5.5, 5.5, 0.8, hexNum(T.ink));
      if (r.done) {
        g.lineStyle(1.5, hexNum(T.card), 1);
        g.beginPath();
        g.moveTo(x + 12, ry);
        g.lineTo(x + 14.5, ry + 2.5);
        g.lineTo(x + 18.5, ry - 2.5);
        g.strokePath();
      }
      this.rows[i].name.setColor(r.done ? '#5a5040' : T.ink);
      this.rows[i].sub.setText(r.done || (i === 0 && !four) ? '' : r.sub);
      if (!r.done && (i > 0 || four) && r.frac >= 0) {
        stitchLine(g, x + 128, ry, x + 160, ry, 3, hexNum('#c8b890'));
        if (r.frac > 0) stitchLine(g, x + 128, ry, x + 128 + 32 * r.frac, ry, 3, hexNum(T.red));
      }
    });
    const n = four ? deed4Count(p) : deedCount(p);
    this.count.setText(`${n} / 3`);
    this.title.setText(t(four ? 'deeds4Title' : 'deedsTitle').toUpperCase());
    if (p.age >= 4) {
      this.title.setText(t('age4Reached').toUpperCase());
      this.foot.setText(t('age4Foot', { n: AGE3_DAMAGE + AGE4_DAMAGE }));
    } else if (four && n === 3) this.foot.setText(t('researchAge4'));
    else if (four && p.edgePending) this.foot.setText(t('age3FootPick', { n: AGE3_DAMAGE }));
    else if (four) this.foot.setText(t('thenAge4', { n: AGE4_DAMAGE }));
    else if (n === 3) this.foot.setText(t('researchAge3'));
    else this.foot.setText(t('thenAge3', { n: AGE3_DAMAGE }));
  }

  contains(px: number, py: number) {
    return px >= DEED_CARD.x && px <= DEED_CARD.x + DEED_CARD.w && py >= DEED_CARD.y && py <= DEED_CARD.y + DEED_CARD.h;
  }
}

/**
 * A campaign scenario's card, at the top left under the top bar: its name, the goal and how far it
 * has come (time left, trips home, the relic's hold, rivals left or the Wonder's progress).
 */
export class MissionCard {
  private line: Phaser.GameObjects.Text;
  private g: Phaser.GameObjects.Graphics;
  /** The progress line on show, for the test and the screenshots. */
  shown = '';

  constructor(scene: Phaser.Scene, sc: Scenario) {
    const { x, y, w } = MISSION_CARD;
    fixed(scene.add.image(x - 2, y - 2, 'card-mission').setOrigin(0, 0), 0);
    this.g = fixed(scene.add.graphics(), 1);
    fixed(scene.add.text(x + 9, y + 12, t(sc.name).toUpperCase(), ink(11.5, T.red)).setOrigin(0, 0.5), 2);
    fixed(scene.add.text(x + 9, y + 31, t(sc.goal), { ...ink(10, T.ink, false), wordWrap: { width: w - 18 } }).setOrigin(0, 0.5), 2);
    this.line = fixed(scene.add.text(x + 9, y + MISSION_CARD.h - 11, '', { ...ink(10, T.indigo), fontStyle: 'bold italic' }).setOrigin(0, 0.5), 2);
  }

  update(s: GameState) {
    const { x, y, w } = MISSION_CARD;
    const m = s.mission!;
    const g = this.g.clear();
    stitchLine(g, x + 4, y + 22, x + w - 4, y + 22, 0.8, hexNum(T.ochre));
    const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
    const goal = m.goal;
    let line = '';
    let frac = 0;
    if (goal.t === 'survive') {
      line = t('missionSurvive', { time: clock(Math.max(0, goal.ms - s.time)) });
      frac = s.time / goal.ms;
    } else if (goal.t === 'escort') {
      line = t('missionEscort', { n: m.trips, total: goal.trips });
      frac = m.trips / goal.trips;
    } else if (goal.t === 'hold') {
      const held = m.heldSince === null ? 0 : s.time - m.heldSince;
      line = m.heldSince === null ? t('missionNotHeld', { relic: t(RELICS[goal.relic].name) }) : t('missionHeld', { time: clock(held), total: clock(goal.ms) });
      frac = held / goal.ms;
    } else if (goal.t === 'conquest') {
      line = t('missionRivals', { n: rivalsOf(s, PLAYER).length });
    } else {
      const wonder = [...s.buildings.values()].find((b) => b.owner === PLAYER && b.type === 'wonder');
      const pct = wonder ? Math.floor((1 - wonder.buildLeft / BUILDINGS.wonder.time) * 100) : 0;
      line = wonder ? t('missionWonder', { pct }) : t(s.players[PLAYER].age >= 4 ? 'missionWonderPlace' : 'missionWonderAge');
      frac = pct / 100;
    }
    this.shown = line;
    this.line.setText(line);
    if (frac > 0) {
      stitchLine(g, x + w - 52, y + MISSION_CARD.h - 11, x + w - 10, y + MISSION_CARD.h - 11, 3, hexNum('#c8b890'));
      stitchLine(g, x + w - 52, y + MISSION_CARD.h - 11, x + w - 52 + 42 * Math.min(1, frac), y + MISSION_CARD.h - 11, 3, hexNum(T.green));
    }
  }

  contains(px: number, py: number) {
    return px >= MISSION_CARD.x && px <= MISSION_CARD.x + MISSION_CARD.w && py >= MISSION_CARD.y && py <= MISSION_CARD.y + MISSION_CARD.h;
  }
}

const RELIC_ICON: Record<RelicId, string> = { plenty: 'icon-wheat', valor: 'icon-sword', haste: 'icon-feather' };

/**
 * Who holds each relic (a green ring for yours, the holder's colour for a rival's), each rival's
 * temperament once its Town Center has been seen, and a standing Monument's count.
 */
export class StatusCard {
  private bg: Phaser.GameObjects.Image;
  private g: Phaser.GameObjects.Graphics;
  private icons: Phaser.GameObjects.Image[] = [];
  private held: Phaser.GameObjects.Text;
  private monument: Phaser.GameObjects.Text;
  private rivals: { id: number; name: Phaser.GameObjects.Text; x: number }[] = [];
  private relics = Object.keys(RELICS) as RelicId[];
  /** The Monument line on show, for the test and the screenshots. */
  shown = '';
  /** Each rival's temperament as the card shows it ('?' until scouted), for the test and the screenshots. */
  temperaments: string[] = [];

  constructor(scene: Phaser.Scene, s: GameState) {
    const { x, y } = STATUS_CARD;
    this.bg = fixed(scene.add.image(x - 2, y - 2, 'card-status').setOrigin(0, 0), 0);
    this.g = fixed(scene.add.graphics(), 1);
    fixed(scene.add.text(x + 9, y + 15, t('relicsLabel').toUpperCase(), ink(11.5, T.red)).setOrigin(0, 0.5), 2);
    this.relics.forEach((r, i) => this.icons.push(fixed(scene.add.image(x + 84 + i * 26, y + 15, RELIC_ICON[r]), 2)));
    this.held = fixed(scene.add.text(x + STATUS_CARD.w - 9, y + 15.5, '', ink(9, T.faded, false)).setOrigin(1, 0.5), 2);
    fixed(scene.add.text(x + 9, y + 37, t('rivalsLabel').toUpperCase(), ink(11.5, T.red)).setOrigin(0, 0.5), 2);
    s.players
      .filter((p) => p.id !== PLAYER && p.id !== NEUTRAL)
      .forEach((p, k) => {
        const rx = x + 74 + k * 82;
        fixed(scene.add.image(rx, y + 37, `icon-banner-${p.faction}`).setScale(0.8), 2);
        this.rivals.push({ id: p.id, x: rx, name: fixed(scene.add.text(rx + 10, y + 37.5, '', ink(10, T.faded)).setOrigin(0, 0.5), 2) });
      });
    this.monument = fixed(scene.add.text(x + 9, y + 60, '', ink(11, T.red)).setOrigin(0, 0.5), 2);
  }

  update(s: GameState) {
    const { x, y } = STATUS_CARD;
    const g = this.g.clear();
    let mine = 0;
    this.relics.forEach((r, i) => {
      const holder = s.camps.find((c) => c.relic === r)?.holder ?? null;
      if (holder === PLAYER) mine++;
      const col = holder === PLAYER ? T.green : holder === null ? '#c8b890' : WOOL[s.players[holder].faction].cloth;
      stitchEllipse(g, x + 84 + i * 26, y + 15, 10, 10, holder === null ? 0.9 : 1.8, hexNum(col));
    });
    this.held.setText(t('relicsHeld', { n: mine }));
    stitchLine(g, x + 4, y + 26, x + STATUS_CARD.w - 4, y + 26, 0.8, hexNum(T.ochre));
    // A rival's temperament shows once its Town Center has been seen; one that has fallen says so.
    this.temperaments = this.rivals.map(({ id, name, x: rx }) => {
      const p = s.players[id];
      // A truce rings the rival's banner in green; an alliance rings it twice.
      const pact = s.pacts[id];
      if (pact && !p.out && (pact.truceUntil > s.time || pact.allyUntil > s.time)) {
        stitchEllipse(g, rx, y + 37, 9, 9, 1.4, hexNum(T.green));
        if (pact.allyUntil > s.time) stitchEllipse(g, rx, y + 37, 12, 12, 1.1, hexNum(T.green));
      }
      const word = p.out ? t('rivalFallen') : p.scouted && p.temperament ? t(TEMPERAMENTS[p.temperament].name) : '?';
      name.setText(word.toUpperCase()).setColor(p.scouted && !p.out ? WOOL[p.faction].cloth : T.faded);
      return word;
    });
    const own = monumentLeft(s, PLAYER);
    const left = this.rivals.map((r) => monumentLeft(s, r.id)).filter((ms): ms is number => ms !== null);
    const foe = left.length > 0 ? Math.min(...left) : null;
    const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}`;
    const ours = own !== null && (foe === null || own <= foe);
    const line = (ours ? t('monumentOwn', { time: clock(own) }) : foe !== null ? t('monumentFoe', { time: clock(foe) }) : '').toUpperCase();
    this.shown = line;
    this.monument.setText(line).setColor(ours ? T.green : T.red);
    this.bg.setTexture(line ? 'card-status-tall' : 'card-status');
    if (line) stitchLine(g, x + 4, y + 48, x + STATUS_CARD.w - 4, y + 48, 0.8, hexNum(T.ochre));
  }

  /** The rival whose banner and temperament sit under a point on the Rivals row, if any. */
  rivalAt(px: number, py: number): number | null {
    const { y } = STATUS_CARD;
    if (py < y + 27 || py > y + 48) return null;
    return this.rivals.find((r) => px >= r.x - 12 && px <= r.x + 70)?.id ?? null;
  }

  contains(px: number, py: number) {
    const h = this.shown ? STATUS_CARD.hMonument : STATUS_CARD.h;
    return px >= STATUS_CARD.x && px <= STATUS_CARD.x + STATUS_CARD.w && py >= STATUS_CARD.y && py <= STATUS_CARD.y + h;
  }
}

/** The horn toast: names a raid and points towards it; also carries short notices. */
export class Toast {
  private bg: Phaser.GameObjects.Image;
  private horn: Phaser.GameObjects.Image;
  private text: Phaser.GameObjects.Text;
  private arrow: Phaser.GameObjects.Graphics;
  /** The text on show, for the test. */
  shown = '';

  constructor(scene: Phaser.Scene) {
    this.bg = fixed(scene.add.image(TOAST.x, TOAST.y + TOAST.h / 2, 'card-toast'), 0);
    this.horn = fixed(scene.add.image(TOAST.x - TOAST.w / 2 + 18, TOAST.y + TOAST.h / 2, 'icon-horn'), 1);
    this.text = fixed(scene.add.text(TOAST.x, TOAST.y + TOAST.h / 2 + 0.5, '', ink(11, T.red)).setOrigin(0.5, 0.5), 1);
    this.arrow = fixed(scene.add.graphics({ x: TOAST.x + TOAST.w / 2 - 16, y: TOAST.y + TOAST.h / 2 }), 1);
    this.arrow.fillStyle(hexNum(T.red), 1).fillTriangle(-5, -6, 7, 0, -5, 6);
    this.arrow.lineStyle(0.8, hexNum(T.ink), 1).strokeTriangle(-5, -6, 7, 0, -5, 6);
    this.hide();
  }

  /** Shows a line; `pointAt` is the screen angle to the raid, or null for a plain notice. */
  show(text: string, pointAt: number | null) {
    this.shown = text;
    this.text.setText(text);
    this.bg.setVisible(true);
    this.text.setVisible(true);
    this.horn.setVisible(pointAt !== null);
    this.arrow.setVisible(pointAt !== null);
    if (pointAt !== null) this.arrow.setRotation(pointAt);
  }

  hide() {
    this.shown = '';
    this.bg.setVisible(false);
    this.text.setVisible(false);
    this.horn.setVisible(false);
    this.arrow.setVisible(false);
  }

  contains(px: number, py: number) {
    return this.bg.visible && Math.abs(px - TOAST.x) <= TOAST.w / 2 && py >= TOAST.y && py <= TOAST.y + TOAST.h;
  }
}

const MINI_COLOURS: Record<number, [number, number, number]> = {
  0: [207, 194, 154],
  [WATER]: [74, 95, 140],
  [ROCK]: [154, 154, 140],
  [DIRT]: [184, 149, 94],
  [SHALLOW]: [140, 170, 160],
};

const rgb = (c: string): [number, number, number] => {
  const n = hexNum(c);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** The minimap in the panel: the land as embroidered, fog, buildings, units, the view and raid pings. */
export class Minimap {
  private tex: Phaser.Textures.CanvasTexture;
  private small: HTMLCanvasElement;
  private data: ImageData;
  private g: Phaser.GameObjects.Graphics;
  private hints: Phaser.GameObjects.Text[] = [];
  private clock = 1e9;

  constructor(scene: Phaser.Scene, private terrain: Uint8Array, s: GameState) {
    if (scene.textures.exists('minimap')) scene.textures.remove('minimap');
    this.tex = scene.textures.createCanvas('minimap', MINI.s, MINI.s)!;
    fixed(scene.add.image(MINI.x, MINI.y, 'minimap').setOrigin(0, 0), 1);
    this.small = document.createElement('canvas');
    this.small.width = MAP_SIZE;
    this.small.height = MAP_SIZE;
    this.data = new ImageData(MAP_SIZE, MAP_SIZE);
    this.g = fixed(scene.add.graphics(), 2);
    for (let k = 0; k < s.players.length; k++) this.hints.push(fixed(scene.add.text(0, 0, '?', ink(10, T.indigo)).setOrigin(0.5, 0.5).setVisible(false), 3));
    this.colours = s.players.map((p) => rgb(WOOL[p.faction].cloth));
  }

  /** Each side's colour, by its index. */
  private colours: [number, number, number][];

  update(s: GameState, dt: number, view: Phaser.Geom.Rectangle, alerts: { x: number; y: number }[]) {
    this.clock += dt;
    if (this.clock >= 300) {
      this.clock = 0;
      this.paint(s);
    }
    const k = MINI.s / MAP_SIZE;
    const g = this.g.clear();
    // The camera's view, in ink thread.
    const vx = MINI.x + (view.x / TILE) * k;
    const vy = MINI.y + (view.y / TILE) * k;
    const vw = (view.width / TILE) * k;
    const vh = (view.height / TILE) * k;
    stitchLine(g, vx, vy, vx + vw, vy, 0.8, hexNum(T.ink));
    stitchLine(g, vx + vw, vy, vx + vw, vy + vh, 0.8, hexNum(T.ink));
    stitchLine(g, vx + vw, vy + vh, vx, vy + vh, 0.8, hexNum(T.ink));
    stitchLine(g, vx, vy + vh, vx, vy, 0.8, hexNum(T.ink));
    // Each rival's corner, marked until it has been seen.
    for (const hint of this.hints) hint.setVisible(false);
    for (const town of s.buildings.values()) {
      if (town.type !== 'town' || town.owner === PLAYER || s.sight[town.ty * MAP_SIZE + town.tx] > 0) continue;
      const hx = MINI.x + (town.tx + 2) * k;
      const hy = MINI.y + (town.ty + 2) * k;
      stitchEllipse(g, hx, hy, 8, 8, 1, hexNum(T.indigo));
      this.hints[town.owner].setPosition(hx, hy + 0.5).setVisible(true);
    }
    // A raid pulses rings of running stitch where it is, and each attack alert smaller ones.
    const r = s.raid;
    if (r && r.target === PLAYER) this.ping(g, s, r.x * k, r.y * k, 3, 18);
    for (const a of alerts) this.ping(g, s, a.x * k, a.y * k, 2, 10);
  }

  /** Rings of red running stitch spreading from a point on the minimap. */
  private ping(g: Phaser.GameObjects.Graphics, s: GameState, x: number, y: number, rings: number, spread: number) {
    const px = MINI.x + x;
    const py = MINI.y + y;
    const step = spread / rings;
    for (let i = 0; i < rings; i++) {
      const rad = settings.reduceMotion ? 4 + i * 4 : 3 + ((s.time / 60 + i * step) % spread);
      const a = settings.reduceMotion ? 1 : 1 - (rad - 3) / spread;
      g.lineStyle(1.3, hexNum(T.red), a);
      const n = 14;
      for (let j = 0; j < n; j += 2) g.lineBetween(px + Math.cos((j / n) * 6.283) * rad, py + Math.sin((j / n) * 6.283) * rad, px + Math.cos(((j + 1.3) / n) * 6.283) * rad, py + Math.sin(((j + 1.3) / n) * 6.283) * rad);
    }
    g.fillStyle(hexNum(T.red), 1).fillCircle(px, py, 1.6);
  }

  private paint(s: GameState) {
    const d = this.data.data;
    const fog = rgb(T.fog);
    for (let i = 0; i < MAP_SIZE * MAP_SIZE; i++) {
      const v = s.sight[i];
      let [r, g, b] = MINI_COLOURS[this.terrain[i]] ?? MINI_COLOURS[0];
      if (v === 0) [r, g, b] = fog;
      else if (v === 1) [r, g, b] = [(r + fog[0]) / 2, (g + fog[1]) / 2, (b + fog[2]) / 2];
      d[i * 4] = r;
      d[i * 4 + 1] = g;
      d[i * 4 + 2] = b;
      d[i * 4 + 3] = 255;
    }
    const put = (x: number, y: number, c: [number, number, number]) => {
      if (x < 0 || y < 0 || x >= MAP_SIZE || y >= MAP_SIZE) return;
      const i = (y * MAP_SIZE + x) * 4;
      d[i] = c[0];
      d[i + 1] = c[1];
      d[i + 2] = c[2];
    };
    const green: [number, number, number] = [78, 102, 64];
    const gold: [number, number, number] = [201, 154, 58];
    for (const n of s.nodes.values()) {
      if (s.sight[n.ty * MAP_SIZE + n.tx] === 0) continue;
      for (let j = 0; j < n.h; j++) for (let i = 0; i < n.w; i++) put(n.tx + i, n.ty + j, n.kind === 'mine' ? gold : green);
    }
    const wild: [number, number, number] = [122, 85, 48];
    const pale: [number, number, number] = [239, 228, 198];
    for (const c of s.camps) {
      if (c.claimed || s.sight[c.ty * MAP_SIZE + c.tx] === 0) continue;
      const col = c.holder === null ? (c.kind === 'relic' ? pale : gold) : this.colours[c.holder];
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) put(c.tx + i, c.ty + j, col);
    }
    // The trading posts are marked for everyone, like a landmark on a chart.
    for (const p of s.posts) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) put(p.tx + i, p.ty + j, [122, 85, 48]);
    for (const b of s.buildings.values()) {
      // A Monument shows on every map once it is begun, as it does in the fog for everyone.
      if (b.owner !== PLAYER && b.type !== 'monument' && b.type !== 'wonder' && s.sight[b.ty * MAP_SIZE + b.tx] === 0) continue;
      const def = BUILDINGS[b.type];
      for (let j = 0; j < def.h; j++) for (let i = 0; i < def.w; i++) put(b.tx + i, b.ty + j, this.colours[b.owner]);
    }
    for (const u of s.units.values()) {
      const tx = Math.floor(u.x);
      const ty = Math.floor(u.y);
      if (u.owner !== PLAYER && s.sight[ty * MAP_SIZE + tx] !== 2) continue;
      const c = u.owner === NEUTRAL ? wild : this.colours[u.owner];
      put(tx, ty, c);
      put(tx + 1, ty, c);
      put(tx, ty + 1, c);
      put(tx + 1, ty + 1, c);
    }
    this.small.getContext('2d')!.putImageData(this.data, 0, 0);
    const c = this.tex.getContext();
    c.imageSmoothingEnabled = true;
    c.clearRect(0, 0, MINI.s, MINI.s);
    c.drawImage(this.small, 0, 0, MINI.s, MINI.s);
    this.tex.refresh();
  }

  contains(px: number, py: number) {
    return px >= MINI.x && px < MINI.x + MINI.s && py >= MINI.y && py < MINI.y + MINI.s;
  }

  /** The world tile under a point on the minimap. */
  toTile(px: number, py: number) {
    return { x: ((px - MINI.x) / MINI.s) * MAP_SIZE, y: ((py - MINI.y) / MINI.s) * MAP_SIZE };
  }
}
