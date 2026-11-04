import Phaser from 'phaser';
import { ui } from '../../../../shared/audio';
import { formatNumber } from '../../../../shared/i18n';
import { engineTexture } from '../art/characters';
import { fit } from '../art/lowpoly';
import { GOLD, SLATE } from '../art/palette';
import { ENGINE, SEEN, UI_DEPTH, VIEW } from '../scenes/layout';
import { ENGINES, ENGINE_AIMS, ENGINE_KINDS, ENGINE_RANKS, ENGINE_UPGRADES, engineRank, engineUpgradeCost, type Engine, type EngineKind, type EngineUpgradeId } from '../game/engines';
import { drawPanel, textStyle } from './panel';
import { t } from '../i18n';

/** A row's button: where it is, for tests and taps. */
export interface EngineSpot {
  id: string;
  x: number;
  y: number;
}

/**
 * The panel the "Siege engine" button opens. With no engine yet, a row to build each kind (in a
 * break, for coins); with one built, its picture, its aim (tap to switch, at any time) and a row
 * for each of its two upgrades, bought in a break. The battle waits while it is open; a tap beside
 * it closes it.
 */
export class EnginePanel {
  open = false;
  /** The buttons on the panel, by id (an engine kind, an upgrade or `aim`); for tests. */
  buttons: EngineSpot[] = [];
  private root: Phaser.GameObjects.Container;
  private body: Phaser.GameObjects.Container;

  constructor(
    private scene: Phaser.Scene,
    private onBuild: (kind: EngineKind) => void,
    private onUpgrade: (id: EngineUpgradeId) => void,
    private onAim: () => void,
  ) {
    const dim = scene.add
      .rectangle(VIEW.w / 2, VIEW.h / 2, SEEN.w, SEEN.h, 0x0e1218, 0.35)
      .setInteractive()
      .on('pointerdown', () => this.close());
    this.body = scene.add.container(0, 0);
    this.root = scene.add.container(0, 0, [dim, this.body]).setDepth(UI_DEPTH + 25).setVisible(false);
  }

  close() {
    this.open = false;
    this.root.setVisible(false);
  }

  /**
   * Opens (or redraws) the panel with the engine (or none), the coins to spend and whether building
   * and upgrading is open now (a break).
   */
  show(engine: Engine | null, coins: number, inBreak: boolean) {
    this.open = true;
    this.root.setVisible(true);
    this.body.removeAll(true);
    this.buttons = [];
    const scene = this.scene;
    const { w, h } = ENGINE.panel;
    const left = VIEW.w / 2 - w / 2;
    const top = VIEW.h / 2 - h / 2;
    const page = scene.add.zone(VIEW.w / 2, VIEW.h / 2, w, h).setInteractive();
    const g = scene.add.graphics();
    drawPanel(g, left, top, w, h, { c: 14, fill: SLATE.mid, alpha: 0.98, lw: 2.5 });
    const coinIcon = fit(scene.add.image(left + w - 70, top + 24, 'hud-coin'));
    const coinText = scene.add.text(left + w - 58, top + 24, formatNumber(coins), textStyle(14, '#ffe07a')).setOrigin(0, 0.5);
    const title = scene.add.text(left + 18, top + 24, engine ? t(ENGINES[engine.kind].name) : t('engineTitle'), textStyle(17, '#ffcf4a', 3)).setOrigin(0, 0.5);
    const note = !inBreak ? t('engineNoteWave') : engine ? t('engineNoteUpgrade') : t('engineNoteBuild');
    const sub = scene.add
      .text(left + 18, top + 46, note, { ...textStyle(12, '#c9c3b6'), fontStyle: 'normal', wordWrap: { width: w - 110 } })
      .setOrigin(0, 0.5);
    this.body.add([page, g, coinIcon, coinText, title, sub]);
    if (!engine) {
      ENGINE_KINDS.forEach((kind, i) => {
        const type = ENGINES[kind];
        this.addRow(kind, left, top + 66 + i * 92, w, 86, engineTexture(kind), t(type.name), '', t(type.text), type.cost, inBreak && coins >= type.cost, () => this.onBuild(kind));
      });
      return;
    }
    // The aim toggle under the title: tap to switch.
    const ax = left + w / 2;
    const ay = top + 82;
    const aimBg = scene.add.graphics();
    drawPanel(aimBg, ax - 110, ay - 13, 220, 26, { c: 5, fill: SLATE.light, alpha: 1, edge: GOLD.mid, lw: 1.5 });
    const aimText = scene.add.text(ax, ay, t('aim', { mode: t(ENGINE_AIMS[engine.aim]) }), textStyle(12, '#ffe7a0')).setOrigin(0.5);
    const aimHit = scene.add
      .zone(ax, ay, 220, 26)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onAim());
    this.buttons.push({ id: 'aim', x: ax, y: ay });
    this.body.add([aimBg, aimText, aimHit]);
    ENGINES[engine.kind].upgrades.forEach((id, i) => {
      const up = ENGINE_UPGRADES[id];
      const rank = engineRank(engine, id);
      const done = rank >= ENGINE_RANKS;
      const cost = engineUpgradeCost(rank);
      this.addRow(id, left, top + 104 + i * 86, w, 80, null, t(up.name), done ? t('engineDone') : t('engineRank', { n: rank, max: ENGINE_RANKS }), t(up.text), done ? null : cost, inBreak && !done && coins >= cost, () => this.onUpgrade(id));
    });
  }

  /** A row: a picture (an engine) or none, a name, what is held, its text, and a button with its cost (none when maxed). */
  private addRow(id: string, left: number, y: number, w: number, h: number, key: string | null, name: string, held: string, text: string, cost: number | null, afford: boolean, buy: () => void) {
    const scene = this.scene;
    const back = scene.add.graphics();
    drawPanel(back, left + 10, y, w - 20, h, { c: 6, fill: SLATE.light, alpha: 1, edge: GOLD.dark, lw: 1 });
    const parts: Phaser.GameObjects.GameObject[] = [back];
    const tx = key ? left + 96 : left + 24;
    if (key) parts.push(fit(scene.add.image(left + 52, y + h / 2 + 4, key), 1.1));
    const title = scene.add.text(tx, y + 14, name, textStyle(14, '#ffe7a0')).setOrigin(0, 0.5);
    const state = scene.add.text(tx + title.width + 10, y + 14, held, textStyle(11, '#8fdc6a')).setOrigin(0, 0.5);
    const desc = scene.add.text(tx, y + 26, text, { ...textStyle(11, '#e9e4d8'), fontStyle: 'normal', wordWrap: { width: left + w - 110 - tx } });
    parts.push(title, state, desc);
    this.body.add(parts);
    if (cost === null) return;
    const bx = left + w - 56;
    const by = y + h / 2;
    const bg = scene.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      drawPanel(bg, bx - 40, by - 20, 80, 40, { c: 6, fill: !afford ? SLATE.panel : hover ? 0x4a4260 : SLATE.mid, alpha: 1, edge: afford ? (hover ? GOLD.light : GOLD.mid) : 0x4a5060, lw: 2 });
    };
    draw(false);
    const color = afford ? '#ffe7a0' : '#7a8294';
    const caption = scene.add.text(bx, by - 8, t('buy'), textStyle(13, color)).setOrigin(0.5);
    const coinIcon = fit(scene.add.image(bx - 12, by + 9, 'hud-coin'), 0.75).setAlpha(afford ? 1 : 0.5);
    const price = scene.add.text(bx - 3, by + 9, formatNumber(cost), textStyle(12, color)).setOrigin(0, 0.5);
    const hit = scene.add.zone(bx, by, 80, 40);
    if (afford) {
      hit
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => draw(true))
        .on('pointerout', () => draw(false))
        .on('pointerdown', buy);
    } else hit.setInteractive().on('pointerdown', () => ui('refuse'));
    this.buttons.push({ id, x: bx, y: by });
    this.body.add([bg, caption, coinIcon, price, hit]);
  }
}
