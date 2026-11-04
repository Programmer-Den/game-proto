// What sits on the screen over the world: hearts, moonstones, keys and bellseeds, the journal line, the
// name of the place, the touch buttons, the talk box, short toasts, the trial's clock, the journal
// and bestiary pages, the shops and campfires, and the chapter's end card.
// Everything here has a scroll factor of 0, so `splitHudCamera` draws it with the fixed camera.

import Phaser from 'phaser';
import { texScale } from '../art/paint';
import { clock, OBJECTIVES, stonesToFind, type GameState } from '../game/state';
import { t } from '../i18n';
import { formatNumber } from '../../../../shared/i18n';
import { ui } from '../../../../shared/audio';
import { BUTTONS, STICK, VIEW } from './layout';
import { viewFrame, viewSize } from '../../../../shared/scaling';

const FONT = 'Georgia, "Times New Roman", serif';
const DEPTH = 10000;

export interface DialogView {
  speaker: string;
  text: string;
}

export class Hud {
  private hearts: Phaser.GameObjects.Image[] = [];
  private plate: Phaser.GameObjects.Graphics;
  private plateW = 0;
  private stones: Phaser.GameObjects.Text;
  private keys: Phaser.GameObjects.Text;
  private seeds: Phaser.GameObjects.Text;
  private coinIcon: Phaser.GameObjects.Image;
  private coins: Phaser.GameObjects.Text;
  /** A seller's wares or a campfire's meals, while they are open, and what pressing each row's button does. */
  private shop: Phaser.GameObjects.Container | null = null;
  private shopPress: (() => void)[] = [];
  private objective: Phaser.GameObjects.Text;
  private place: Phaser.GameObjects.Text;
  private toastText: Phaser.GameObjects.Text;
  private buttons: Record<keyof typeof BUTTONS, Phaser.GameObjects.Image>;
  private box: Phaser.GameObjects.Graphics;
  private stick: Phaser.GameObjects.Graphics;
  private speaker: Phaser.GameObjects.Text;
  private line: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private placeMs = 0;
  private toastMs = 0;
  private endCard: Phaser.GameObjects.Container | null = null;
  /** The moonstone page, while it is open. */
  private page: Phaser.GameObjects.Container | null = null;
  /** The hourglass trial's clock, top middle. */
  private timer: Phaser.GameObjects.Text;
  /** The view's size: the hearts sit top left, the journal top right, the buttons bottom right. */
  private vw: number;
  private vh: number;
  /** How far the view is wider and taller than the designed 960x540. */
  private dx: number;
  private dy: number;

  constructor(private scene: Phaser.Scene) {
    const add = scene.add;
    ({ width: this.vw, height: this.vh } = viewSize(scene));
    this.dx = this.vw - VIEW.w;
    this.dy = this.vh - VIEW.h;
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(o: T) => o.setScrollFactor(0).setDepth(DEPTH);
    this.plate = fixed(add.graphics());
    fixed(add.image(24, 46, 'moonstone').setScale(texScale('moonstone')));
    this.stones = fixed(add.text(36, 37, '', { fontFamily: FONT, fontSize: '16px', color: '#dff2ff' }));
    this.keys = fixed(add.text(108, 37, '', { fontFamily: FONT, fontSize: '16px', color: '#f0d890' }));
    this.seeds = fixed(add.text(178, 37, '', { fontFamily: FONT, fontSize: '16px', color: '#c8f0a0' }));
    this.coinIcon = fixed(add.image(0, 46, 'ui-coin').setScale(texScale('ui-coin')));
    this.coins = fixed(add.text(0, 37, '', { fontFamily: FONT, fontSize: '16px', color: '#f0d070' }));
    this.objective = fixed(
      add.text(this.vw - 12, 12, '', { fontFamily: FONT, fontSize: '15px', color: '#f3ead2', align: 'right', backgroundColor: 'rgba(10,14,36,0.55)', padding: { x: 10, y: 6 } }).setOrigin(1, 0),
    );
    this.place = fixed(add.text(this.vw / 2, 84, '', { fontFamily: FONT, fontSize: '30px', color: '#f3ead2', stroke: '#0a0e24', strokeThickness: 5 }).setOrigin(0.5).setAlpha(0));
    this.timer = fixed(add.text(this.vw / 2, 14, '', { fontFamily: FONT, fontSize: '22px', color: '#cfe8ff', stroke: '#0a0e24', strokeThickness: 4 }).setOrigin(0.5, 0));
    this.toastText = fixed(add.text(this.vw / 2, 130, '', { fontFamily: FONT, fontSize: '18px', color: '#dff2ff', stroke: '#0a0e24', strokeThickness: 4 }).setOrigin(0.5).setAlpha(0));
    this.buttons = {
      sword: fixed(add.image(this.btn('sword').x, this.btn('sword').y, 'btn-sword').setScale(texScale('btn-sword') * (BUTTONS.sword.r / 30))),
      roll: fixed(add.image(this.btn('roll').x, this.btn('roll').y, 'btn-roll').setScale(texScale('btn-roll') * (BUTTONS.roll.r / 30))),
      vine: fixed(add.image(this.btn('vine').x, this.btn('vine').y, 'btn-vine').setScale(texScale('btn-vine') * (BUTTONS.vine.r / 30))),
      seed: fixed(add.image(this.btn('seed').x, this.btn('seed').y, 'btn-seed').setScale(texScale('btn-seed') * (BUTTONS.seed.r / 30))),
      horn: fixed(add.image(this.btn('horn').x, this.btn('horn').y, 'btn-horn').setScale(texScale('btn-horn') * (BUTTONS.horn.r / 30))),
    };
    this.stick = fixed(add.graphics());
    this.box = fixed(add.graphics()).setDepth(DEPTH + 1);
    this.speaker = fixed(add.text(150 + this.dx / 2, 398 + this.dy, '', { fontFamily: FONT, fontSize: '17px', color: '#f0d890', fontStyle: 'bold' })).setDepth(DEPTH + 2);
    this.line = fixed(add.text(150 + this.dx / 2, 424 + this.dy, '', { fontFamily: FONT, fontSize: '19px', color: '#f3ead2', wordWrap: { width: 650 }, lineSpacing: 4 })).setDepth(DEPTH + 2);
    this.hint = fixed(add.text(810 + this.dx / 2, 500 + this.dy, '', { fontFamily: FONT, fontSize: '13px', color: '#a8b0d0' }).setOrigin(1, 0.5)).setDepth(DEPTH + 2);
  }

  /** A touch button's place, kept at the same distance from the view's bottom-right corner. */
  private btn(id: keyof typeof BUTTONS) {
    const b = BUTTONS[id];
    return { x: b.x + this.dx, y: b.y + this.dy, r: b.r };
  }

  /** The floating stick under a steering finger: a faint ring with a gold knob, or nothing. */
  drawStick(st: { ox: number; oy: number; x: number; y: number } | null) {
    const g = this.stick;
    g.clear();
    if (!st) return;
    const d = Math.hypot(st.x - st.ox, st.y - st.oy);
    const k = d > STICK.r ? STICK.r / d : 1;
    const kx = st.ox + (st.x - st.ox) * k;
    const ky = st.oy + (st.y - st.oy) * k;
    g.fillStyle(0x0a0e24, 0.35).fillCircle(st.ox, st.oy, STICK.r);
    g.lineStyle(3, 0xc8b070, 0.55).strokeCircle(st.ox, st.oy, STICK.r);
    g.fillStyle(0xf0d890, 0.7).fillCircle(kx, ky, STICK.knob);
    g.lineStyle(2, 0xf3ead2, 0.7).strokeCircle(kx, ky, STICK.knob);
  }

  /** Which touch button, if any, is at a point on the screen. */
  buttonAt(p: { x: number; y: number }, s: GameState): keyof typeof BUTTONS | null {
    for (const id of Object.keys(BUTTONS) as (keyof typeof BUTTONS)[]) {
      const b = this.btn(id);
      if (!this.buttons[id].visible) continue;
      if (id === 'vine' && !s.items.hookvine) continue;
      if (id === 'seed' && !s.items.seeds) continue;
      if (id === 'horn' && !s.items.horn) continue;
      if (Math.hypot(p.x - b.x, p.y - b.y) <= b.r) return id;
    }
    return null;
  }

  showPlace(name: string) {
    this.place.setText(name).setAlpha(1);
    this.placeMs = 2200;
  }

  toast(text: string) {
    this.toastText.setText(text).setAlpha(1);
    this.toastMs = 1800;
  }

  /** Whether a view point is on the counters' plate, top left, which opens the moonstone page. */
  plateAt(p: { x: number; y: number }) {
    return p.x >= 8 && p.x <= 8 + this.plateW && p.y >= 8 && p.y <= 60;
  }

  update(dt: number, s: GameState, dialog: DialogView | null, inDungeon: boolean, trialMs: number | null) {
    this.timer.setText(trialMs === null ? '' : `⌛ ${clock(trialMs)}`);
    // Hearts: one image per two half hearts of the most the knight can have.
    const want = Math.ceil(s.maxHp / 2);
    while (this.hearts.length < want) this.hearts.push(this.scene.add.image(24 + this.hearts.length * 22, 22, 'ui-heart').setScrollFactor(0).setDepth(DEPTH));
    this.hearts.forEach((h, i) => {
      const left = s.hp - i * 2;
      const key = left >= 2 ? 'ui-heart' : left === 1 ? 'ui-heart-half' : 'ui-heart-empty';
      h.setTexture(key).setScale(texScale(key)).setVisible(i < want);
    });
    this.stones.setText(`${s.moonstones.length} / ${stonesToFind(s)}`);
    this.keys.setText(inDungeon || s.keys > 0 ? t('keys', { n: s.keys }) : '');
    this.seeds.setText(s.items.seeds ? t('seeds', { n: s.seeds }) : '');
    // The counters sit side by side, so a longer word (German Schlüssel) pushes the next one along.
    this.keys.x = Math.max(108, this.stones.x + this.stones.width + 16);
    this.seeds.x = this.keys.text ? Math.max(178, this.keys.x + this.keys.width + 16) : 178;
    // Coins show once the first is picked up, after the last counter shown.
    const showCoins = s.coins > 0 || s.upgrades.length > 0;
    this.coins.setText(showCoins ? formatNumber(s.coins) : '');
    const last = this.seeds.text ? this.seeds.x + this.seeds.width : this.keys.text ? this.keys.x + this.keys.width : this.stones.x + this.stones.width;
    const coinsX = Math.max(this.seeds.text ? 0 : 178, last + 16);
    this.coinIcon.setVisible(showCoins).setX(coinsX + 9);
    this.coins.setX(coinsX + 22);
    const plateW = Math.max(262, (showCoins ? this.coins.x + this.coins.width : this.seeds.text ? this.seeds.x + this.seeds.width : this.keys.x + this.keys.width) + 4);
    if (plateW !== this.plateW) {
      this.plateW = plateW;
      this.plate.clear().fillStyle(0x0a0e24, 0.55).fillRoundedRect(8, 8, plateW, 52, 10);
    }
    this.objective.setText(t(OBJECTIVES[s.quest]));
    this.buttons.sword.setVisible(s.items.sword && !dialog);
    this.buttons.vine.setVisible(s.items.hookvine && !dialog);
    this.buttons.roll.setVisible(!dialog);
    this.buttons.seed.setVisible(s.items.seeds && !dialog).setAlpha(s.seeds > 0 ? 1 : 0.4);
    this.buttons.horn.setVisible(s.items.horn && !dialog);
    if (this.placeMs > 0) {
      this.placeMs -= dt;
      this.place.setAlpha(Math.min(1, this.placeMs / 600));
    }
    if (this.toastMs > 0) {
      this.toastMs -= dt;
      this.toastText.setAlpha(Math.min(1, this.toastMs / 500));
    }
    this.box.clear();
    this.speaker.setText(dialog?.speaker ?? '');
    this.line.setText(dialog?.text ?? '');
    this.hint.setText(dialog ? t('readOn') : '');
    if (dialog) {
      this.box.fillStyle(0x0a0e24, 0.86).fillRoundedRect(130 + this.dx / 2, 388 + this.dy, 700, 132, 14);
      this.box.lineStyle(2, 0xc8b070, 0.8).strokeRoundedRect(130 + this.dx / 2, 388 + this.dy, 700, 132, 14);
    }
  }

  /** Whether a card, the journal page or a shop covers the game, which then stands still. */
  get covered() {
    return this.endCard !== null || this.page !== null || this.shop !== null;
  }

  get shopOpen() {
    return this.shop !== null;
  }

  /**
   * A seller's wares or a campfire's meals: each row's name, what it does and a button (a price,
   * Cook, or why not), with the coins or a note under the title. The rows' live buttons, or 1 to 9
   * on the keyboard, pick; a dead one buzzes.
   */
  showShop(title: string, note: string | null, coins: number | null, rows: { name: string; text: string; label: string; live: boolean }[], onPick: (i: number) => void) {
    const add = this.scene.add;
    const f = viewFrame(this.scene);
    const c = add.container(f.x, f.y).setScrollFactor(0).setDepth(DEPTH + 10);
    const h = 150 + rows.length * 80;
    const top = (VIEW.h - h) / 2;
    const g = add.graphics();
    g.fillStyle(0x05081a, 0.7).fillRect(-f.x, -f.y, this.vw, this.vh);
    g.fillStyle(0x10163a, 0.95).fillRoundedRect(220, top, 520, h, 18);
    g.lineStyle(2, 0xc8b070, 0.9).strokeRoundedRect(220, top, 520, h, 18);
    c.add(g);
    c.add(add.text(VIEW.w / 2, top + 30, title, { fontFamily: FONT, fontSize: '26px', color: '#f0d890' }).setOrigin(0.5));
    if (coins !== null) {
      c.add(add.image(VIEW.w / 2 - 30, top + 64, 'ui-coin').setScale(texScale('ui-coin')));
      c.add(add.text(VIEW.w / 2 - 16, top + 64, formatNumber(coins), { fontFamily: FONT, fontSize: '18px', color: '#f0d070' }).setOrigin(0, 0.5));
    }
    if (note) c.add(add.text(VIEW.w / 2, top + 64, note, { fontFamily: FONT, fontSize: '15px', color: '#cfe8ff' }).setOrigin(0.5));
    this.shopPress = [];
    rows.forEach((r, i) => {
      const y = top + 112 + i * 80;
      c.add(add.text(250, y - 12, `${i + 1}. ${r.name}`, { fontFamily: FONT, fontSize: '19px', color: '#f3ead2' }).setOrigin(0, 0.5));
      c.add(add.text(250, y + 14, r.text, { fontFamily: FONT, fontSize: '14px', color: '#a8b0d0', wordWrap: { width: 330 } }).setOrigin(0, 0.5));
      const live = r.live;
      const b = add.text(650, y, r.label, { fontFamily: FONT, fontSize: '17px', color: '#10163a', backgroundColor: live ? '#f0d890' : '#6a6e86', padding: { x: 12, y: 6 } }).setOrigin(0.5);
      const press = () => (live ? onPick(i) : ui('refuse'));
      b.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        press();
      });
      c.add(b);
      this.shopPress.push(press);
    });
    c.add(add.text(VIEW.w / 2, top + h - 24, t('closeShop'), { fontFamily: FONT, fontSize: '13px', color: '#a8b0d0' }).setOrigin(0.5));
    this.shop = c;
  }

  /** Presses a shop row's button, by its place in the list. */
  pressShop(i: number) {
    this.shopPress[i]?.();
  }

  closeShop() {
    this.shop?.destroy();
    this.shop = null;
    this.shopPress = [];
  }

  get pageOpen() {
    return this.page !== null;
  }

  /**
   * The journal page: on the left each map's moonstones, found ones lit, so the player knows where
   * to look again without being told where; on the right the villagers' requests taken and done,
   * then the best time of each hourglass trial once they open. `plus` names the new game+ cycle,
   * `larder` the creel and the meal along the bottom, and its corner button turns to the bestiary.
   */
  showStones(
    rows: { name: string; found: number; total: number }[],
    trials: { place: string; ms?: number }[],
    requests: { text: string; state: string; done: boolean }[],
    plus: string,
    larder: string,
    onTurn: () => void,
  ) {
    const add = this.scene.add;
    const f = viewFrame(this.scene);
    const c = add.container(f.x, f.y).setScrollFactor(0).setDepth(DEPTH + 10);
    const left = rows.length * 34;
    const right = 30 + Math.max(1, requests.length) * 26 + (trials.length ? 44 + trials.length * 26 : 0);
    const h = 140 + Math.max(left, right) + (larder ? 26 : 0);
    const top = (VIEW.h - h) / 2;
    const g = add.graphics();
    g.fillStyle(0x05081a, 0.7).fillRect(-f.x, -f.y, this.vw, this.vh);
    g.fillStyle(0x10163a, 0.95).fillRoundedRect(100, top, 760, h, 18);
    g.lineStyle(2, 0xc8b070, 0.9).strokeRoundedRect(100, top, 760, h, 18);
    g.lineStyle(1, 0xc8b070, 0.35).lineBetween(480, top + 84, 480, top + h - 44);
    c.add(g);
    const found = rows.reduce((n, r) => n + r.found, 0);
    const total = rows.reduce((n, r) => n + r.total, 0);
    const stones = t('stonesTotal', { n: found, total });
    c.add(add.text(VIEW.w / 2, top + 30, t('journalTitle'), { fontFamily: FONT, fontSize: '26px', color: '#f0d890' }).setOrigin(0.5));
    c.add(add.text(VIEW.w / 2, top + 62, plus ? t('stonesPlus', { stones, plus }) : stones, { fontFamily: FONT, fontSize: '16px', color: '#a8b0d0' }).setOrigin(0.5));
    rows.forEach((r, i) => {
      const y = top + 104 + i * 34;
      c.add(add.text(128, y, r.name, { fontFamily: FONT, fontSize: '18px', color: r.found === r.total ? '#dff2ff' : '#f3ead2' }).setOrigin(0, 0.5));
      for (let k = 0; k < r.total; k++)
        c.add(add.image(388 + k * 28, y, 'moonstone').setScale(texScale('moonstone') * 1.15).setAlpha(k < r.found ? 1 : 0.22));
    });
    let y = top + 104;
    c.add(add.text(670, y, t('requestsTitle'), { fontFamily: FONT, fontSize: '19px', color: '#f0d890' }).setOrigin(0.5));
    y += 30;
    if (!requests.length) c.add(add.text(670, y, t('requestsNone'), { fontFamily: FONT, fontSize: '14px', color: '#a8b0d0', align: 'center', wordWrap: { width: 340 } }).setOrigin(0.5));
    requests.forEach((r, i) => {
      const ry = y + i * 26;
      const col = r.done ? '#cfe8ff' : '#f3ead2';
      c.add(add.text(508, ry, r.text, { fontFamily: FONT, fontSize: '15px', color: col }).setOrigin(0, 0.5));
      c.add(add.text(836, ry, r.state, { fontFamily: FONT, fontSize: '15px', color: r.done ? '#9ad86a' : '#f0d070' }).setOrigin(1, 0.5));
    });
    y += Math.max(1, requests.length) * 26 + 18;
    if (trials.length) {
      c.add(add.text(670, y, t('trialsTitle'), { fontFamily: FONT, fontSize: '19px', color: '#f0d890' }).setOrigin(0.5));
      trials.forEach((tr, i) => {
        const text = tr.ms === undefined ? t('trialNone', { place: tr.place }) : t('trialBest', { place: tr.place, time: clock(tr.ms) });
        c.add(add.text(670, y + 30 + i * 26, text, { fontFamily: FONT, fontSize: '16px', color: '#cfe8ff' }).setOrigin(0.5));
      });
    }
    if (larder) c.add(add.text(VIEW.w / 2, top + h - 50, larder, { fontFamily: FONT, fontSize: '14px', color: '#cfe8ff' }).setOrigin(0.5));
    c.add(add.text(VIEW.w / 2, top + h - 24, t('pageHint'), { fontFamily: FONT, fontSize: '13px', color: '#a8b0d0' }).setOrigin(0.5));
    this.turnButton(c, 840, top + 30, t('bestiaryOpen'), onTurn, 1);
    this.page = c;
  }

  /** The button in a page's top corner that turns to the other page. */
  private turnButton(c: Phaser.GameObjects.Container, x: number, y: number, label: string, fn: () => void, originX: number) {
    const b = this.scene.add.text(x, y, label, { fontFamily: FONT, fontSize: '15px', color: '#10163a', backgroundColor: '#c8b070', padding: { x: 10, y: 5 } }).setOrigin(originX, 0.5);
    b.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
      e.stopPropagation();
      fn();
    });
    c.add(b);
  }

  /**
   * The bestiary: a row per family, each kind's picture (dark until one is beaten), its name and how
   * many are beaten against `pageAt`, and what a full family gives.
   */
  showBestiary(families: { name: string; done: boolean; kinds: { key: string; name: string; n: number }[] }[], pageAt: number, onTurn: () => void) {
    const add = this.scene.add;
    const f = viewFrame(this.scene);
    const c = add.container(f.x, f.y).setScrollFactor(0).setDepth(DEPTH + 10);
    const h = 150 + families.length * 112;
    const top = (VIEW.h - h) / 2;
    const g = add.graphics();
    g.fillStyle(0x05081a, 0.7).fillRect(-f.x, -f.y, this.vw, this.vh);
    g.fillStyle(0x10163a, 0.95).fillRoundedRect(100, top, 760, h, 18);
    g.lineStyle(2, 0xc8b070, 0.9).strokeRoundedRect(100, top, 760, h, 18);
    c.add(g);
    c.add(add.text(VIEW.w / 2, top + 30, t('bestiaryTitle'), { fontFamily: FONT, fontSize: '26px', color: '#f0d890' }).setOrigin(0.5));
    c.add(add.text(VIEW.w / 2, top + 62, t('bestiaryIntro', { n: pageAt }), { fontFamily: FONT, fontSize: '15px', color: '#a8b0d0' }).setOrigin(0.5));
    families.forEach((fam, i) => {
      const y = top + 104 + i * 112;
      c.add(add.text(128, y, fam.name, { fontFamily: FONT, fontSize: '19px', color: fam.done ? '#cfe8ff' : '#f0d890' }).setOrigin(0, 0.5));
      c.add(add.text(836, y, fam.done ? t('familyPerk') : t('familyWant'), { fontFamily: FONT, fontSize: '14px', color: fam.done ? '#9ad86a' : '#a8b0d0' }).setOrigin(1, 0.5));
      fam.kinds.forEach((k, j) => {
        const x = 200 + j * 240;
        const img = add.image(x, y + 46, k.key);
        img.setScale(texScale(k.key) * Math.min(1.3, 44 / (img.height * texScale(k.key))));
        if (!k.n) img.setTint(0x000000).setAlpha(0.6);
        c.add(img);
        c.add(add.text(x + 34, y + 34, k.name, { fontFamily: FONT, fontSize: '16px', color: k.n ? '#f3ead2' : '#6a6e86' }).setOrigin(0, 0.5));
        const full = k.n >= pageAt;
        c.add(add.text(x + 34, y + 58, t('bestiaryCount', { n: Math.min(k.n, pageAt), total: pageAt }), { fontFamily: FONT, fontSize: '14px', color: full ? '#9ad86a' : '#f0d070' }).setOrigin(0, 0.5));
      });
    });
    c.add(add.text(VIEW.w / 2, top + h - 24, t('pageHint'), { fontFamily: FONT, fontSize: '13px', color: '#a8b0d0' }).setOrigin(0.5));
    this.turnButton(c, 120, top + 30, t('journalOpen'), onTurn, 0);
    this.page = c;
  }

  closeStones() {
    this.page?.destroy();
    this.page = null;
  }

  /**
   * A card over the game: a chapter's end, with how the night went and the ways on (keep exploring
   * just closes it, a new game, and after the last chapter new game+), or the new game+ offer.
   */
  showEnd(title: string, lines: string[], buttons: { label: string; fn?: () => void }[]) {
    const add = this.scene.add;
    // The card is laid out for 960x540 and sits in the middle of the view, its shade over all of it.
    const f = viewFrame(this.scene);
    const c = add.container(f.x, f.y).setScrollFactor(0).setDepth(DEPTH + 10);
    const g = add.graphics();
    g.fillStyle(0x05081a, 0.82).fillRect(-f.x, -f.y, this.vw, this.vh);
    g.fillStyle(0x10163a, 0.95).fillRoundedRect(180, 90, 600, 360, 18);
    g.lineStyle(2, 0xc8b070, 0.9).strokeRoundedRect(180, 90, 600, 360, 18);
    c.add(g);
    c.add(add.text(VIEW.w / 2, 130, title, { fontFamily: FONT, fontSize: '28px', color: '#f0d890' }).setOrigin(0.5));
    c.add(add.text(VIEW.w / 2, 250, lines.join('\n\n'), { fontFamily: FONT, fontSize: '18px', color: '#f3ead2', align: 'center', wordWrap: { width: 520 } }).setOrigin(0.5));
    const three = buttons.length > 2;
    const button = (x: number, label: string, fn?: () => void) => {
      const b = add.text(x, 400, label, { fontFamily: FONT, fontSize: three ? '18px' : '20px', color: '#10163a', backgroundColor: '#f0d890', padding: { x: three ? 12 : 16, y: 8 } }).setOrigin(0.5);
      b.setInteractive({ useHandCursor: true }).on('pointerdown', (_p: unknown, _x: unknown, _y: unknown, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        ui('click');
        c.destroy();
        this.endCard = null;
        fn?.();
      });
      c.add(b);
    };
    const xs = three ? [290, 480, 670] : [370, 590];
    buttons.forEach((b, i) => button(xs[i], b.label, b.fn));
    this.endCard = c;
  }
}
