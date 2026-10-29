import Phaser from 'phaser';
import { ADAPTS, CONDITIONS, HUD_HEIGHT, PERKS, VIEW, type Adapt, type Condition, type Perk, type Stats } from '../game/rules';
import type { ArtStyle } from '../game/save';
import { formatNumber } from '../../../../shared/i18n';
// `t` names this HUD's Text objects here, so the translator goes by `tr`.
import { t as tr, type TextKey } from '../i18n';
import { FIELD, GEOM, num, tex } from '../art/paint';
import { ACID_COLOR, CRATE_COLORS, THEMES, UPGRADE_COLORS, type Theme } from '../art/theme';

// The HUD: the top bar (wave, best wave, kills, stats and the art style switch), the wave progress
// strip under it, the frenzy meter beside the squad, and the kit panel on the squad's other side
// (sandbag walls to place, flame bursts, medkits, shotgun pairs and the perks earned), and the
// wave's condition under the progress strip. Drawn as comic caption boxes or as an amber overwatch
// overlay. Its Graphics are only redrawn when something on it changes.

export const HUD_DEPTH = 100;
/** The art style switch in the top bar's stats row, in game pixels; taps inside it switch style. */
export const STYLE_SWITCH = { x: 432, y: 33, w: 98, h: 19 };
/** The wave progress strip under the top bar. */
export const PROGRESS = { x: 10, y: HUD_HEIGHT + 4, w: VIEW.w - 20, h: 20 };
/** The frenzy meter, to the right of the squad, its bottom clear of the shared corner buttons below it. */
export const FRENZY_PANEL = { x: 384, y: 852, w: 140, h: 50 };
/**
 * The kit panel, to the left of the squad, over the shared corner buttons; tapping it while
 * holding sandbags readies a wall. A long list of supplies wraps, and the panel grows upward.
 */
export const KIT_PANEL = { x: 16, y: 852, w: 140, h: 50 };
/** The wave condition's chip, under the progress strip at the right; it drops below the boss bar while a boss is up. */
export const CONDITION_CHIP = { x: VIEW.w - 10, y: HUD_HEIGHT + 32, h: 16, bossDrop: 20 };

/**
 * Pins the HUD to the edges of the whole view (`FIELD`), which is wider or taller than the road on
 * a screen of another shape: the switch and the condition chip to the right, the progress strip
 * across, and the kit and frenzy panels to the bottom corners. At 540x960 nothing moves.
 */
function fitHud() {
  const right = FIELD.x + FIELD.w;
  STYLE_SWITCH.x = right - (VIEW.w - 432);
  PROGRESS.x = FIELD.x + 10;
  PROGRESS.w = FIELD.w - 20;
  KIT_PANEL.x = FIELD.x + 16;
  FRENZY_PANEL.x = right - 16 - FRENZY_PANEL.w;
  KIT_PANEL.y = FRENZY_PANEL.y = FIELD.h - (VIEW.h - 852);
  CONDITION_CHIP.x = right - 10;
}

export interface HudData {
  wave: number;
  kills: number;
  best: number;
  /** This run has gone past the best saved before it started. */
  newBest: boolean;
  stats: Stats;
  /** Zombies of this wave down, out of `total`. */
  fallen: number;
  total: number;
  bossWave: boolean;
  bossNext: boolean;
  /** The next wave with a boss. */
  nextBoss: number;
  streak: number;
  /** 0..1: the streak towards a frenzy, or the frenzy time left while it runs. */
  frenzyFill: number;
  frenzyOn: boolean;
  /** Sandbag walls in hand, and whether the next tap places one. */
  sandbags: number;
  placing: boolean;
  /** Supplies from the boss drops still in hand. */
  flames: number;
  medkits: number;
  pellets: number;
  /** The hero stands in acid: the squad fires slower. */
  inAcid: boolean;
  /** The perks earned from three crates of a kind. */
  perks: Perk[];
  /** This wave's condition, and whether a boss is on the road (its bar takes the chip's place). */
  condition: Condition;
  bossLive: boolean;
  /** What the horde answers the squad with this wave, shown on the condition's chip. */
  adapt: Adapt | null;
  /** The operation being played (null on the Open Road): its best chip reads waves cleared out of `waves`. */
  operation: { label: TextKey; waves: number } | null;
}

type Text = Phaser.GameObjects.Text;

/** Shots a second, to one decimal in the player's language (2.9 or 2,9). */
export const fireRate = (s: Stats) => formatNumber(1000 / s.fireInterval, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export class Hud {
  private bar: Phaser.GameObjects.Image;
  private g: Phaser.GameObjects.Graphics;
  private t: Record<
    'wave' | 'kills' | 'best' | 'comic' | 'nv' | 'count' | 'note' | 'frenzy' | 'streak' | 'hint' | 'kit' | 'kitHint' | 'kitList' | 'acid' | 'condition',
    Text
  >;
  private statLabels: Text[];
  private statValues: Text[];
  private style: ArtStyle = 'comic';
  private drawn = '';
  /** Whether the kit panel is drawn; a hidden panel takes no taps. */
  private kitShown = false;
  /** How far the kit panel has grown upward to hold a wrapped list. */
  private kitGrown = 0;

  constructor(scene: Phaser.Scene) {
    fitHud();
    this.bar = scene.add.image(FIELD.x, 0, '__DEFAULT').setOrigin(0).setDepth(HUD_DEPTH);
    this.g = scene.add.graphics().setDepth(HUD_DEPTH + 1);
    const text = () => scene.add.text(0, 0, '').setDepth(HUD_DEPTH + 2);
    this.t = {
      wave: text(), kills: text(), best: text(), comic: text(), nv: text(),
      count: text(), note: text(), frenzy: text(), streak: text(), hint: text(),
      kit: text(), kitHint: text(), kitList: text(), acid: text(), condition: text(),
    };
    this.statLabels = [text(), text(), text(), text()];
    this.statValues = [text(), text(), text(), text()];
  }

  /** Whether a tap at x, y (game pixels) lands on the art style switch. */
  onSwitch(x: number, y: number) {
    const s = STYLE_SWITCH;
    return x >= s.x - 6 && x <= s.x + s.w + 6 && y >= s.y - 6 && y <= s.y + s.h + 6;
  }

  /** Whether a tap at x, y lands on the kit panel (never while the panel is hidden). */
  onKit(x: number, y: number) {
    const k = KIT_PANEL;
    return this.kitShown && x >= k.x - 4 && x <= k.x + k.w + 4 && y >= k.y - this.kitGrown - 4 && y <= k.y + k.h + 4;
  }

  setStyle(style: ArtStyle) {
    this.style = style;
    this.bar.setTexture(tex(style, 'hudbar'));
    this.bar.setScale(GEOM.hudbar.w / this.bar.frame.width);
    this.drawn = '';
  }

  /** Redraws the HUD if anything on it changed. */
  update(d: HudData) {
    const key = JSON.stringify({ ...d, frenzyFill: Math.round(d.frenzyFill * 56), style: this.style });
    if (key === this.drawn) return;
    this.drawn = key;
    const th = THEMES[this.style];
    this.g.clear();
    if (this.style === 'comic') this.drawComic(d, th);
    else this.drawNv(d, th);
    this.drawKit(d, th);
    this.drawCondition(d, th);
  }

  /** The wave's condition on a chip under the progress strip (none when the wave is clear). */
  private drawCondition(d: HudData, th: Theme) {
    const t = this.t.condition, show = d.condition !== 'clear' || d.adapt !== null;
    t.setVisible(show);
    if (!show) return;
    const c = CONDITION_CHIP, comic = this.style === 'comic', y = c.y + (d.bossLive ? c.bossDrop : 0);
    const parts = [];
    if (d.condition !== 'clear') parts.push(`${tr(CONDITIONS[d.condition].label).toUpperCase()}: ${tr(CONDITIONS[d.condition].detail).toUpperCase()}`);
    if (d.adapt) parts.push(tr('adapted', { adapt: tr(ADAPTS[d.adapt].label).toUpperCase() }));
    const label = parts.join(' · ');
    if (comic) this.font(t, 9.5, th.ink, th).setText(label).setOrigin(1, 0.5).setPosition(c.x - 8, y + c.h / 2);
    else this.font(t, 9, th.warn, th, { glow: th.warn }).setText(label).setOrigin(1, 0.5).setPosition(c.x - 8, y + c.h / 2);
    const w = t.width + 16, x = c.x - w;
    if (comic) this.caption(x, y, w, c.h, '#e8c0e8', th.ink, 1.6);
    else {
      this.g.fillStyle(num('#140404'), 0.8).fillRoundedRect(x, y, w, c.h, 2);
      this.g.lineStyle(1, num(th.warn), 0.9).strokeRoundedRect(x, y, w, c.h, 2);
    }
    // Drawn after the chip, so the text sits on top of it.
    t.setDepth(HUD_DEPTH + 2);
  }

  /**
   * The kit panel: sandbag walls to place (tap the panel, then a lane) and the supplies in hand.
   * Hidden while the kit is empty. Also the warning that the hero stands in acid.
   */
  private drawKit(d: HudData, th: Theme) {
    const g = this.g, t = this.t, comic = this.style === 'comic';
    const list = [d.flames && tr('kitFlames', { n: d.flames }), d.medkits && tr('kitMedkits', { n: d.medkits }), d.pellets && tr('kitSpread', { n: d.pellets })].filter(Boolean).join(' · ');
    // The perks take the sandbag hint's line while there is no hint to show; with one, they join the supplies.
    const perks = d.perks.map((p) => tr(PERKS[p].label).toUpperCase()).join(' · ');
    const ready = d.sandbags > 0, hint = ready || d.placing;
    // Perks too long for the hint's line join the list, which wraps.
    const perksFit = !hint && this.font(t.kitHint, 8.5, '#c05a1a', th).setText(perks).width <= KIT_PANEL.w - 16;
    const line2 = perksFit ? perks : '', line3 = perksFit ? list : [perks, list].filter(Boolean).join(' · ');
    const show = hint || list !== '' || perks !== '';
    this.kitShown = show;
    [t.kit, t.kitHint, t.kitList].forEach((o) => o.setVisible(show));
    this.kitGrown = 0;
    if (show) {
      // The list wraps inside the panel; each line past the first grows the panel upward.
      const listFont = comic ? this.font(t.kitList, 8, '#5a4a6a', th) : this.font(t.kitList, 8.5, th.muted, th, { weight: 'normal' });
      listFont.setWordWrapWidth(KIT_PANEL.w - 16).setText(line3).setOrigin(0, 0.5);
      const lines = line3 ? t.kitList.getWrappedText().length : 1;
      // With the hint's line empty, the list moves up into it.
      const lineH = comic ? 10 : 11, up = hint || line2 ? 0 : 14, spread = (lines - 1) * lineH;
      this.kitGrown = Math.max(0, spread - up);
      const k = { ...KIT_PANEL, y: KIT_PANEL.y - this.kitGrown, h: KIT_PANEL.h + this.kitGrown };
      const bag = CRATE_COLORS.sandbag, title = ready ? tr(comic ? 'kitSandbags' : 'nvKitSandbags', { n: d.sandbags }) : tr(perks && !list ? 'kitPerks' : 'kit');
      if (comic) {
        this.caption(k.x, k.y, k.w, k.h, d.placing ? '#ffd23f' : '#fff8e8', th.ink, 2.2);
        if (ready) {
          g.fillStyle(num(bag)).fillRoundedRect(k.x + k.w - 30, k.y + 7, 22, 11, 5);
          g.lineStyle(1.3, num(th.ink)).strokeRoundedRect(k.x + k.w - 30, k.y + 7, 22, 11, 5);
        }
        this.font(t.kit, 12, th.ink, th).setText(title).setOrigin(0, 0.5).setPosition(k.x + 8, k.y + 13);
        this.font(t.kitHint, 8.5, d.placing ? th.warn : hint ? th.ink : '#c05a1a', th).setText(d.placing ? tr('kitPlacing') : ready ? tr('kitReady') : line2).setOrigin(0, 0.5).setPosition(k.x + 8, k.y + 28);
        t.kitList.setPosition(k.x + 8, k.y + 42 + spread / 2 - up);
      } else {
        g.fillStyle(num('#040c06'), 0.72).fillRoundedRect(k.x, k.y, k.w, k.h, 3);
        g.lineStyle(1, num(d.placing ? th.text : th.accent), 0.8).strokeRoundedRect(k.x, k.y, k.w, k.h, 3);
        if (ready) g.fillStyle(num(bag)).fillRect(k.x + k.w - 20, k.y + 8, 12, 6);
        this.font(t.kit, 11, th.accent, th, { glow: th.accent, weight: 'bold' }).setText(title).setOrigin(0, 0.5).setPosition(k.x + 8, k.y + 12);
        this.font(t.kitHint, 8.5, d.placing ? th.text : '#9fd8a4', th, { weight: 'normal' }).setText(d.placing ? tr('nvKitPlacing') : ready ? tr('nvKitReady') : line2).setOrigin(0, 0.5).setPosition(k.x + 8, k.y + 27);
        t.kitList.setPosition(k.x + 8, k.y + 41 + spread / 2 - up);
      }
    }
    t.acid.setVisible(d.inAcid);
    if (d.inAcid) {
      const col = comic ? ACID_COLOR : th.warn;
      this.font(t.acid, comic ? 13 : 12, col, th, comic ? { stroke: th.ink, sw: 4 } : { glow: col, weight: 'bold' })
        .setText(tr(comic ? 'inAcid' : 'nvInAcid')).setOrigin(0.5).setPosition(VIEW.w / 2, 820);
    }
  }

  private font(t: Text, size: number, color: string, th: Theme, o: { stroke?: string; sw?: number; glow?: string; weight?: string; ls?: number } = {}) {
    t.setFontFamily(th.font).setFontSize(`${size}px`).setFontStyle(o.weight ?? th.fontStyle).setColor(color);
    t.setStroke(o.stroke ?? '#000000', o.stroke ? (o.sw ?? 3) : 0);
    if (o.glow) t.setShadow(0, 0, o.glow, 6, false, true);
    else t.setShadow(0, 0, '#000000', 0, false, false);
    t.setLetterSpacing(o.ls ?? 0);
    return t;
  }

  /** A caption box: an ink drop shadow, a flat fill and an ink outline. */
  private caption(x: number, y: number, w: number, h: number, fill: string, ink: string, lw = 2) {
    this.g.fillStyle(num(ink)).fillRect(x + 3, y + 3, w, h);
    this.g.fillStyle(num(fill)).fillRect(x, y, w, h);
    this.g.lineStyle(lw, num(ink)).strokeRect(x, y, w, h);
  }

  /** The stats row; a stat that has evolved into a perk gets a star after its number. */
  private stats(d: HudData) {
    const s = d.stats, star = (p: Perk) => (d.perks.includes(p) ? '★' : '');
    return [
      { label: tr(this.style === 'comic' ? 'statDamage' : 'statDamageShort'), value: String(s.damage) + star('headshot'), color: UPGRADE_COLORS.damage },
      { label: tr('statRate'), value: `${fireRate(s)}/s${star('fire')}`, color: UPGRADE_COLORS.rate },
      { label: tr('statSquad'), value: String(s.companions + 1), color: UPGRADE_COLORS.companion },
      { label: tr('statPierce'), value: String(s.pierce) + star('ricochet'), color: UPGRADE_COLORS.pierce },
    ];
  }

  private drawComic(d: HudData, th: Theme) {
    const g = this.g, ink = th.ink, t = this.t;
    // Top bar: wave and kills in caption boxes, the best wave on a green chip between them.
    this.font(t.wave, 19, ink, th).setText(tr('wave', { wave: d.wave })).setOrigin(0.5).setPosition(0, 0);
    const ww = Math.max(102, t.wave.width + 18);
    const L = FIELD.x, R = FIELD.x + FIELD.w;
    this.caption(L + 8, 5, ww, 26, '#ffe04a', ink);
    t.wave.setPosition(L + 8 + ww / 2, 18);
    this.font(t.kills, 17, ink, th).setText(tr('kills', { kills: d.kills })).setOrigin(0.5);
    const kw = Math.max(104, t.kills.width + 18);
    this.caption(R - 8 - kw, 5, kw, 26, '#fff8e8', ink);
    t.kills.setPosition(R - 8 - kw / 2, 18.5);
    this.font(t.best, 10.5, ink, th).setText(this.bestText(d, ': ')).setOrigin(0.5);
    const bw = t.best.width + 16;
    this.caption(VIEW.w / 2 - bw / 2 - 4, 8, bw, 20, d.newBest ? '#ffd23f' : '#8cd05a', ink);
    t.best.setPosition(VIEW.w / 2 - 4, 18.5);
    // Stats: a colour chip, the name and the number.
    let x = L + 12;
    this.stats(d).forEach((s, i) => {
      g.fillStyle(num(s.color)).fillRect(x, 38, 9, 9);
      g.lineStyle(1.1, num(ink)).strokeRect(x, 38, 9, 9);
      x += 13;
      this.font(this.statLabels[i], 10.5, th.muted, th).setText(s.label).setOrigin(0, 0.5).setPosition(x, 43);
      x += this.statLabels[i].width + 4;
      this.font(this.statValues[i], 12, th.value, th).setText(s.value).setOrigin(0, 0.5).setPosition(x, 43);
      x += this.statValues[i].width + 13;
    });
    this.drawSwitch(th, '#fff8e8', '#ffe04a', ink);

    // Wave progress strip: blocks fill as the wave's zombies fall; the boss warning at its end.
    const p = PROGRESS;
    this.caption(p.x, p.y, p.w, p.h, '#fff8e8', ink);
    this.font(t.count, 11, ink, th).setText(`${d.fallen}/${d.total}`).setOrigin(0, 0.5).setPosition(p.x + 8, p.y + p.h / 2);
    // The blocks stretch with the strip; the boss note keeps its place at the strip's right end.
    const skull = p.x + p.w - 126, n = 10, bx = p.x + 50, bwid = skull - 24 - bx, on = Math.floor((d.fallen / d.total) * n);
    for (let i = 0; i < n; i++) {
      const cx = bx + (i * bwid) / n;
      g.fillStyle(num(i < on ? '#ffd23f' : '#d8d0c0')).fillRect(cx + 1, p.y + 5, bwid / n - 3, p.h - 10);
      g.lineStyle(1.1, num(ink)).strokeRect(cx + 1, p.y + 5, bwid / n - 3, p.h - 10);
    }
    this.skull(skull, p.y + p.h / 2, '#f4ecd8', ink, true);
    const note = d.bossWave ? tr('bossWave') : d.bossNext ? tr('bossNext') : tr('bossAt', { wave: d.nextBoss });
    this.font(t.note, 10, d.bossWave || d.bossNext ? th.warn : '#5a4a6a', th).setText(note).setOrigin(0, 0.5).setPosition(skull + 12, p.y + p.h / 2);

    // Frenzy meter.
    const f = FRENZY_PANEL;
    this.caption(f.x, f.y, f.w, f.h, '#fff8e8', ink, 2.2);
    this.font(t.frenzy, 13, '#ff8a2a', th, { stroke: ink, sw: 3.5 }).setText(tr(d.frenzyOn ? 'frenzyOn' : 'frenzy')).setOrigin(0, 0.5).setPosition(f.x + 8, f.y + 13);
    this.star(f.x + f.w - 18, f.y + 14, 9, 14, '#ffe24a', ink);
    this.font(t.streak, 9, ink, th).setText(`x${d.streak}`).setOrigin(0.5).setPosition(f.x + f.w - 18, f.y + 14.5);
    const mx = f.x + 8, my = f.y + 26, mw = f.w - 16, mh = 10;
    g.fillStyle(num('#d8d0c0')).fillRect(mx, my, mw, mh);
    g.fillStyle(num(d.frenzyOn ? '#ffd23f' : '#ff8a2a')).fillRect(mx, my, mw * d.frenzyFill, mh);
    g.lineStyle(1.4, num(ink)).strokeRect(mx, my, mw, mh);
    this.font(t.hint, 8, ink, th).setText(tr(d.frenzyOn ? 'frenzyOnHint' : 'frenzyHint')).setOrigin(0, 0.5).setPosition(f.x + 8, f.y + 43);
  }

  private drawNv(d: HudData, th: Theme) {
    const g = this.g, t = this.t, PH = th.text, AMB = th.accent;
    const glow = (c: string) => ({ glow: c, weight: 'bold' });
    const pad = (n: number, w: number) => String(n).padStart(w, '0');
    const L = FIELD.x, R = FIELD.x + FIELD.w;
    this.font(t.wave, 19, PH, th, { ...glow(PH), ls: 1 }).setText(tr('wave', { wave: pad(d.wave, 2) })).setOrigin(0, 0.5).setPosition(L + 14, 18);
    this.font(t.kills, 17, PH, th, glow(PH)).setText(tr('kills', { kills: pad(d.kills, 3) })).setOrigin(1, 0.5).setPosition(R - 14, 18);
    this.font(t.best, 11, AMB, th, glow(AMB)).setText(this.bestText(d, ' ')).setOrigin(0.5).setPosition(VIEW.w / 2 - 4, 18.5);
    const bw = t.best.width + 16;
    g.lineStyle(1, num(AMB)).strokeRoundedRect(VIEW.w / 2 - 4 - bw / 2, 9, bw, 18, 2);
    let x = L + 14;
    this.stats(d).forEach((s, i) => {
      g.fillStyle(num(s.color)).fillRect(x, 39, 6, 6);
      x += 11;
      this.font(this.statLabels[i], 11, th.muted, th, { weight: 'normal' }).setText(s.label).setOrigin(0, 0.5).setPosition(x, 42.5);
      x += this.statLabels[i].width + 5;
      this.font(this.statValues[i], 11.5, PH, th, glow(PH)).setText(s.value).setOrigin(0, 0.5).setPosition(x, 42.5);
      x += this.statValues[i].width + 13;
    });
    this.drawSwitch(th, '#020a05', AMB, AMB);

    const p = PROGRESS;
    g.fillStyle(num('#020a05'), 0.75).fillRoundedRect(p.x, p.y, p.w, p.h, 3);
    g.lineStyle(1, num(PH), 0.35).strokeRoundedRect(p.x, p.y, p.w, p.h, 3);
    this.font(t.count, 10.5, PH, th, glow(PH)).setText(`${d.fallen}/${d.total}`).setOrigin(0, 0.5).setPosition(p.x + 8, p.y + p.h / 2);
    const skull = p.x + p.w - 126, n = Math.min(d.total, 40), bx = p.x + 54, bwid = skull - 22 - bx, on = Math.floor((d.fallen / d.total) * n);
    for (let i = 0; i < n; i++) {
      g.fillStyle(num(i < on ? AMB : PH), i < on ? 1 : 0.16).fillRect(bx + (i * bwid) / n, p.y + 6, bwid / n - 2.5, p.h - 12);
    }
    const warn = d.bossWave || d.bossNext;
    this.skull(skull, p.y + p.h / 2, warn ? th.warn : th.muted, warn ? th.warn : th.muted, false);
    const note = d.bossWave ? tr('nvBossWave') : d.bossNext ? tr('nvBossNext') : tr('bossAt', { wave: pad(d.nextBoss, 2) });
    this.font(t.note, 9.5, warn ? th.warn : th.muted, th, glow(warn ? th.warn : th.muted)).setText(note).setOrigin(0, 0.5).setPosition(skull + 11, p.y + p.h / 2);

    const f = FRENZY_PANEL;
    g.fillStyle(num('#040c06'), 0.72).fillRoundedRect(f.x, f.y, f.w, f.h, 3);
    g.lineStyle(1, num(AMB), 0.8).strokeRoundedRect(f.x, f.y, f.w, f.h, 3);
    this.font(t.frenzy, 11, AMB, th, { ...glow(AMB), ls: 2 }).setText(tr(d.frenzyOn ? 'nvFrenzyOn' : 'nvFrenzy')).setOrigin(0, 0.5).setPosition(f.x + 8, f.y + 12);
    this.font(t.streak, 12, '#ffffff', th, glow('#ffffff')).setText(`x${d.streak}`).setOrigin(1, 0.5).setPosition(f.x + f.w - 8, f.y + 12);
    const segs = 14, mw = f.w - 16;
    for (let i = 0; i < segs; i++) {
      const lit = (i + 1) / segs <= d.frenzyFill + 0.001;
      g.fillStyle(num(AMB), lit ? 1 : 0.18).fillRect(f.x + 8 + (i * mw) / segs, f.y + 24, mw / segs - 2, 9);
    }
    this.font(t.hint, 8.5, '#9fd8a4', th, { weight: 'normal' }).setText(tr(d.frenzyOn ? 'nvFrenzyOnHint' : 'nvFrenzyHint')).setOrigin(0, 0.5).setPosition(f.x + 8, f.y + 42);
  }

  /** The best chip: the best wave reached on the Open Road, or an operation's waves cleared. */
  private bestText(d: HudData, sep: string) {
    const comic = this.style === 'comic', wave = comic ? tr('wave', { wave: d.best }) : String(d.best).padStart(2, '0');
    const best = tr(d.newBest ? 'newBest' : 'best');
    if (d.operation) return `${tr(d.operation.label).toUpperCase()}${sep}${best} ${d.best}/${d.operation.waves}`;
    return `${best}${sep}${wave}`;
  }

  /** The style switch: a pill with the two style names, the active one lit. */
  private drawSwitch(th: Theme, bg: string, on: string, line: string) {
    const s = STYLE_SWITCH, g = this.g, half = s.w / 2;
    const comic = this.style === 'comic';
    g.fillStyle(num(bg), comic ? 1 : 0.8).fillRoundedRect(s.x, s.y, s.w, s.h, comic ? 3 : 2);
    g.fillStyle(num(on), comic ? 1 : 0.9).fillRoundedRect(comic ? s.x : s.x + half, s.y, half, s.h, comic ? 3 : 2);
    g.lineStyle(comic ? 1.6 : 1, num(line)).strokeRoundedRect(s.x, s.y, s.w, s.h, comic ? 3 : 2);
    const label = (t: Text, text: string, cx: number, active: boolean) =>
      this.font(t, 9, comic ? th.ink : active ? '#020a05' : th.accent, th).setText(text).setOrigin(0.5).setPosition(cx, s.y + s.h / 2 + 0.5);
    label(this.t.comic, tr('styleComic'), s.x + half / 2, comic);
    label(this.t.nv, tr('styleNv'), s.x + half * 1.5, !comic);
  }

  private skull(x: number, y: number, fill: string, line: string, filled: boolean) {
    const g = this.g;
    if (filled) {
      g.fillStyle(num(fill)).fillEllipse(x, y - 1, 15, 14).fillRect(x - 4, y + 3, 8, 4);
    }
    g.lineStyle(1.3, num(line)).strokeEllipse(x, y - 1, 15, 14).strokeRect(x - 4, y + 3, 8, 4);
    g.fillStyle(num(filled ? THEMES.comic.ink : line)).fillCircle(x - 2.8, y - 1, 1.8).fillCircle(x + 2.8, y - 1, 1.8);
  }

  private star(x: number, y: number, r0: number, r1: number, fill: string, line: string) {
    const pts: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, r = i % 2 ? r0 : r1;
      pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * r, y + Math.sin(a) * r));
    }
    this.g.fillStyle(num(fill)).fillPoints(pts, true);
    this.g.lineStyle(1.4, num(line)).strokePoints(pts, true);
  }
}
