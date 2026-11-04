import Phaser from 'phaser';
import { ui } from '../../../../shared/audio';
import { iconTexture, relicTexture } from '../art/icons';
import { fit } from '../art/lowpoly';
import { GOLD, SLATE } from '../art/palette';
import { SKILL_BOOK, SEEN, UI_DEPTH, VIEW } from '../scenes/layout';
import { RELIC_IDS, RELICS, SETS, setComplete, setRelics, type RelicId } from '../game/relics';
import { UPGRADES, bookOrder, type UpgradeId } from '../game/upgrades';
import type { HeroClass } from '../game/hero';
import { drawPanel, makeButton, textStyle } from './panel';
import { t } from '../i18n';

/**
 * The skill book: a "Skill book" button in the top bar opens a page with a slot for every upgrade.
 * A slot is an empty placeholder until that upgrade is first offered on a level-up; then it shows
 * the upgrade's icon, name, what a rank does and the hero's rank. Along the bottom are the relics
 * won from the relic chests. The battle (and any auto-pick countdown) waits while it is open.
 */
export class SkillBook {
  /** Whether the book is open; the scene holds the battle still while it is. */
  open = false;
  private button: Phaser.GameObjects.Container;
  private buttonText: Phaser.GameObjects.Text;
  private root: Phaser.GameObjects.Container;
  private slots: Phaser.GameObjects.Container;
  private relics: Phaser.GameObjects.Container;
  private shown = '';
  /** The tooltip shown while the pointer is over a relic along the bottom. */
  private relicTip: Phaser.GameObjects.Container;
  private relicTipBg: Phaser.GameObjects.Graphics;
  private relicTipText: Phaser.GameObjects.Text;

  constructor(private scene: Phaser.Scene) {
    const { x, y, w, h } = SKILL_BOOK.button;
    const bg = scene.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      drawPanel(bg, -w / 2, -h / 2, w, h, { c: 6, fill: hover ? 0x4a4260 : SLATE.light, alpha: 1, edge: hover ? GOLD.light : GOLD.mid });
    };
    draw(false);
    const icon = fit(scene.add.image(-w / 2 + 18, 0, 'hud-book'));
    this.buttonText = scene.add.text(9, 0, '', textStyle(14, '#ffe7a0')).setOrigin(0.5);
    const hit = scene.add.zone(0, 0, w, h);
    hit
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => draw(true))
      .on('pointerout', () => draw(false))
      .on('pointerdown', () => {
        ui('click');
        this.setOpen(true);
      });
    // Above the level-up overlay, so the book can be checked while choosing the next upgrade.
    this.button = scene.add.container(x, y, [bg, icon, this.buttonText, hit]).setDepth(UI_DEPTH + 15);

    const p = SKILL_BOOK.panel;
    const dim = scene.add
      .rectangle(VIEW.w / 2, VIEW.h / 2, SEEN.w, SEEN.h, 0x0e1218, 0.7)
      .setInteractive()
      .on('pointerdown', () => this.setOpen(false));
    const panel = scene.add.graphics();
    drawPanel(panel, VIEW.w / 2 - p.w / 2, VIEW.h / 2 - p.h / 2, p.w, p.h, { c: 18, fill: SLATE.mid, alpha: 1, lw: 3 });
    // The page swallows taps so only taps beside it close it.
    const page = scene.add.zone(VIEW.w / 2, VIEW.h / 2, p.w, p.h).setInteractive();
    const top = VIEW.h / 2 - p.h / 2;
    const title = scene.add.text(VIEW.w / 2, top + 26, t('skillBook'), textStyle(24, '#ffcf4a', 4)).setOrigin(0.5);
    const note = scene.add
      .text(VIEW.w / 2, top + 50, t('bookNote'), {
        ...textStyle(11, '#c9c3b6'),
        fontStyle: 'normal',
      })
      .setOrigin(0.5);
    this.slots = scene.add.container(0, 0);
    this.relics = scene.add.container(0, 0);
    const close = makeButton(scene, VIEW.w / 2 + p.w / 2 - 100, VIEW.h / 2 + p.h / 2 - 28, 150, 34, t('back'), () => this.setOpen(false));
    this.relicTipBg = scene.add.graphics();
    this.relicTipText = scene.add.text(0, 0, '', { ...textStyle(12, '#e9e4d8'), fontStyle: 'normal', lineSpacing: 3 }).setOrigin(0);
    this.relicTip = scene.add.container(0, 0, [this.relicTipBg, this.relicTipText]).setVisible(false);
    this.root = scene.add
      .container(0, 0, [dim, panel, page, title, note, this.slots, this.relics, close, this.relicTip])
      .setDepth(UI_DEPTH + 30)
      .setVisible(false);
  }

  /**
   * Updates the button's count, hides it for `hidden`, and redraws the slots and relics when what
   * has been found, taken or won changes.
   */
  show(found: ReadonlySet<UpgradeId>, ranks: Partial<Record<UpgradeId, number>>, relics: Partial<Record<RelicId, number>>, hidden: boolean, hero: HeroClass = 'ranger') {
    // Each class has its own book: the skills it learns, found or not yet.
    const order = bookOrder(hero);
    this.buttonText.setText(t('skillBookCount', { found: order.filter((id) => found.has(id)).length, total: order.length }));
    this.button.setVisible(!hidden);
    if (hidden) this.setOpen(false);
    const key = order.map((id) => (found.has(id) ? ranks[id] ?? 0 : '-')).join() + '|' + RELIC_IDS.map((id) => relics[id] ?? 0).join();
    if (key === this.shown) return;
    this.shown = key;
    this.slots.removeAll(true);
    const { cols, colW, rowH, top } = SKILL_BOOK;
    const left = VIEW.w / 2 - (cols * colW) / 2;
    order.forEach((id, i) => {
      const x = left + (i % cols) * colW;
      const y = top + Math.floor(i / cols) * rowH;
      this.addSlot(id, x, y, found.has(id), ranks[id] ?? 0);
    });
    this.showRelics(relics);
  }

  /** The relics won so far, along the bottom of the book. */
  private showRelics(relics: Partial<Record<RelicId, number>>) {
    this.relics.removeAll(true);
    this.relicTip.setVisible(false);
    const scene = this.scene;
    const y = VIEW.h / 2 + SKILL_BOOK.panel.h / 2 - 28;
    let x = VIEW.w / 2 - SKILL_BOOK.panel.w / 2 + 24;
    const label = scene.add.text(x, y, t('relics'), textStyle(14, '#ffcf4a')).setOrigin(0, 0.5);
    this.relics.add(label);
    x += label.width + 12;
    const owned = RELIC_IDS.filter((id) => (relics[id] ?? 0) > 0);
    if (owned.length === 0) {
      const none = t('relicsNone');
      this.relics.add(scene.add.text(x, y, none, { ...textStyle(12, '#c9c3b6'), fontStyle: 'normal' }).setOrigin(0, 0.5));
      return;
    }
    // A relic whose set is complete shows in green, and the set's bonus follows the list.
    for (const id of owned) {
      const n = relics[id] ?? 0;
      const done = setComplete(relics, RELICS[id].set);
      this.relics.add(fit(scene.add.image(x + 12, y, relicTexture(id)), 0.45));
      const name = scene.add
        .text(x + 28, y, n > 1 ? t('relicCount', { name: t(RELICS[id].name), n }) : t(RELICS[id].name), { ...textStyle(11, done ? '#8fdc6a' : '#e9e4d8'), fontStyle: done ? 'bold' : 'normal' })
        .setOrigin(0, 0.5);
      this.relics.add(name);
      const zone = scene.add.zone(x, y - 14, 30 + name.width, 28).setOrigin(0).setInteractive();
      const left = x;
      zone.on('pointerover', () => this.showRelicTip(id, relics, left, y - 20)).on('pointerout', () => this.relicTip.setVisible(false));
      this.relics.add(zone);
      x += 38 + name.width;
    }
    const sets = Object.entries(SETS).filter(([id]) => setComplete(relics, id as keyof typeof SETS));
    if (sets.length > 0) {
      const line = sets.map(([, set]) => t('setBonus', { set: t(set.name), text: t(set.text) })).join('   ');
      this.relics.add(scene.add.text(VIEW.w / 2 - SKILL_BOOK.panel.w / 2 + 24, y - 22, line, textStyle(11, '#8fdc6a')).setOrigin(0, 0.5));
    }
  }

  /** The relic's name, what it does, how many are held and its set, in a box above it. */
  private showRelicTip(id: RelicId, relics: Partial<Record<RelicId, number>>, x: number, bottom: number) {
    const relic = RELICS[id];
    const n = relics[id] ?? 0;
    const set = SETS[relic.set];
    const others = setRelics(relic.set).filter((other) => other !== id).map((other) => t(RELICS[other].name));
    const done = setComplete(relics, relic.set);
    this.relicTipText.setText([
      n > 1 ? t('relicStacks', { name: t(relic.name), n }) : t(relic.name),
      t(relic.text),
      t(done ? 'setWithDone' : 'setWith', { set: t(set.name), others: others.reduce((a, b) => t('and', { a, b })), text: t(set.text) }),
    ]);
    const w = this.relicTipText.width + 16;
    const h = this.relicTipText.height + 12;
    // Kept inside the book's page.
    const right = VIEW.w / 2 + SKILL_BOOK.panel.w / 2 - 12;
    const left = Math.min(x, right - w);
    this.relicTipBg.clear();
    drawPanel(this.relicTipBg, left, bottom - h, w, h, { c: 6, fill: 0x1e222c, alpha: 0.97, lw: 1.5 });
    this.relicTipText.setPosition(left + 8, bottom - h + 6);
    this.relicTip.setVisible(true);
  }

  private addSlot(id: UpgradeId, x: number, y: number, found: boolean, rank: number) {
    const { colW, rowH } = SKILL_BOOK;
    const scene = this.scene;
    const u = UPGRADES[id];
    const back = scene.add.graphics();
    drawPanel(back, x + 2, y - 4, colW - 8, rowH - 4, { c: 6, fill: found ? SLATE.light : SLATE.panel, alpha: 1, edge: found ? GOLD.dark : 0x3a404c, lw: 1 });
    const iconBack = scene.add.rectangle(x + 22, y + 18, 34, 34, SLATE.dark).setStrokeStyle(1, 0x4a5060);
    if (!found) {
      // An empty placeholder: a blank icon frame and a line where the name will go.
      this.slots.add([
        back,
        iconBack,
        scene.add.text(x + 22, y + 18, '?', textStyle(18, '#4a5060')).setOrigin(0.5),
        scene.add.rectangle(x + 46, y + 8, 110, 6, 0x343a48).setOrigin(0, 0.5),
        scene.add.rectangle(x + 46, y + 24, 170, 4, 0x2c313c).setOrigin(0, 0.5),
        scene.add.rectangle(x + 46, y + 32, 130, 4, 0x2c313c).setOrigin(0, 0.5),
      ]);
      return;
    }
    const taken = rank > 0;
    // A base skill taken past its max (once every skill is learned) shows its rank alone.
    const rankText = u.filler ? `${rank}x` : rank > u.maxRank ? `${rank}` : `${rank}/${u.maxRank}`;
    this.slots.add([
      back,
      iconBack,
      fit(scene.add.image(x + 22, y + 18, iconTexture(u.icon)), 0.58).setAlpha(taken ? 1 : 0.55),
      scene.add.text(x + 46, y, t(u.name), textStyle(14, taken ? '#ffcf4a' : '#c9c3b6')),
      scene.add
        .text(x + colW - 14, y + 1, rankText, textStyle(13, !u.filler && rank >= u.maxRank ? '#8fdc6a' : taken ? '#e9e4d8' : '#7a8294'))
        .setOrigin(1, 0),
      scene.add
        .text(x + 46, y + 18, t(u.text), { ...textStyle(11, '#e9e4d8'), fontStyle: 'normal', wordWrap: { width: colW - 60 } })
        .setAlpha(taken ? 1 : 0.7),
    ]);
  }

  private setOpen(open: boolean) {
    this.open = open;
    this.root.setVisible(open);
  }
}
