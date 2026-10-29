import Phaser from 'phaser';
import { formatNumber } from '../../../../shared/i18n';
import { playMusic, ui } from '../../../../shared/audio';
import { viewSize } from '../../../../shared/scaling';
import { settings } from '../../../../shared/settings';
import { SONG, sfx } from '../audio';
import { INK, PAPER, PAPER_NUM, SERIF, WASH, fit } from '../art/paint';
import { itemTexture } from '../art/items';
import { goodTexture, lotTexture } from '../art/town';
import { DISTRICTS, HOME_TIERS, districtFull, townIsCity, type Need } from '../game/districts';
import { loadState } from '../game/save';
import { tick } from '../game/sim';
import type { GameState } from '../game/state';
import { GOODS, SHOPS, SHOP_IDS, shopCost, shopKnows, type GoodId, type ShopId } from '../game/town';
import { buyShop, tickTown } from '../game/townSim';
import { t } from '../i18n';
import { coined } from '../ui/coins';
import { TOWN_HUD_H, TOWN_TEXT, TOWN_UI_DEPTH, keepSaving, leaveFor, townCard, townTopBar } from './townKit';
import { checkTrophies } from '../trophies/check';

// The town map: a page of the town with the apothecary and a lot for every shop, opened from the
// apothecary's top bar once the town grants its charter. A shop bought is walked into from its lot;
// one for sale is bought by tapping its lot with the coins in the purse. The apothecary and every
// shop keep working while the map is open, as they do while the player is away.

const LOT = { w: 270, h: 150, gap: 24 };
/** A district's card, and the gap above the row of them for its heading. */
const DISTRICT = { w: 270, h: 140, above: 34 };
/** Room kept free along the bottom for the corner buttons (full screen, pause). */
const CORNER_H = 50;
const HOME = { w: 18, gap: 7 };
const COLUMNS = 3;
const NOTE = { ...TOWN_TEXT, fontSize: '13px', fontStyle: 'normal' };

type Lot = 'apothecary' | ShopId;

export class TownScene extends Phaser.Scene {
  private state!: GameState;
  private views: (() => void)[] = [];
  /** The lot cards' height and the gap between them: shorter once the lots take two rows. */
  private lot = { h: LOT.h, gap: LOT.gap };

  constructor() {
    super('Town');
  }

  create(data?: { state?: GameState }) {
    // Entered only through `leaveFor`, which hands the state over and saved a moment ago, so there is
    // no time away to catch up on; the save is the fallback.
    this.state = data?.state ?? loadState();
    this.views = [];
    const { width, height } = viewSize(this);
    this.add.rectangle(0, 0, width, height, PAPER_NUM).setOrigin(0);
    const lots: Lot[] = ['apothecary', ...SHOP_IDS];
    const rows = Math.ceil(lots.length / COLUMNS);
    this.lot = rows > 1 ? { h: 116, gap: 16 } : { h: LOT.h, gap: LOT.gap };
    const block = rows * this.lot.h + (rows - 1) * this.lot.gap + DISTRICT.above + DISTRICT.h;
    const top = TOWN_HUD_H + Math.max(8, (height - TOWN_HUD_H - CORNER_H - block) / 2);
    this.drawRoads(width, height, top, rows, Math.min(COLUMNS, lots.length));
    lots.forEach((lot, i) => {
      const row = Math.floor(i / COLUMNS);
      const inRow = Math.min(COLUMNS, lots.length - row * COLUMNS);
      const col = i % COLUMNS;
      const x = width / 2 + (col - (inRow - 1) / 2) * (LOT.w + this.lot.gap);
      const y = top + row * (this.lot.h + this.lot.gap) + this.lot.h / 2;
      this.addLot(lot, x, y);
    });
    const districtsY = top + rows * this.lot.h + (rows - 1) * this.lot.gap + DISTRICT.above;
    // The second ending: once every district is full of castles, the heading says the town is a city.
    const heading = this.add.text(width / 2, districtsY - DISTRICT.above / 2 + 4, t('districts'), { ...TOWN_TEXT, color: PAPER }).setOrigin(0.5);
    this.views.push(() => heading.setText(townIsCity(this.state.town.districts) ? t('townCity') : t('districts')));
    DISTRICTS.forEach((_, i) => this.addDistrict(i, width / 2 + (i - (DISTRICTS.length - 1) / 2) * (DISTRICT.w + this.lot.gap), districtsY + DISTRICT.h / 2));
    const purse = townTopBar(this, () => this.state, t('townMap'), { label: t('apothecary'), onTap: () => this.enter('apothecary') });
    this.views.push(purse);
    playMusic(SONG, 'calm');
    keepSaving(this, () => this.state);
  }

  /** Roads between the lots, over the grass: one between and around the rows, and one between each two columns. */
  private drawRoads(width: number, height: number, top: number, rows: number, columns: number) {
    const roads = this.add.graphics();
    const road = Phaser.Display.Color.HexStringToColor(WASH.dirt).color;
    roads.fillStyle(Phaser.Display.Color.HexStringToColor(WASH.grass).color, 0.9).fillRect(0, TOWN_HUD_H, width, height - TOWN_HUD_H);
    roads.fillStyle(road, 0.85);
    for (let r = 0; r <= rows; r++) roads.fillRect(0, top + r * (this.lot.h + this.lot.gap) - this.lot.gap / 2 - 9, width, 18);
    for (let c = 0; c < columns - 1; c++) roads.fillRect(width / 2 + (c - (columns - 2) / 2) * (LOT.w + this.lot.gap) - 9, TOWN_HUD_H, 18, height - TOWN_HUD_H);
  }

  private addLot(lot: Lot, x: number, y: number) {
    const card = townCard(this, x, y, 'contract', LOT.w, this.lot.h).setInteractive({ useHandCursor: true });
    fit(this.add.image(x - LOT.w / 2 + 58, y + 4, lotTexture(lot)));
    const left = x - LOT.w / 2 + 112;
    const name = lot === 'apothecary' ? t('apothecary') : t(SHOPS[lot].name);
    // Two rows of lots make each card shorter, so its lines close up.
    const compact = this.lot.h < LOT.h;
    this.add.text(left, y - this.lot.h / 2 + (compact ? 10 : 16), name, { ...TOWN_TEXT, fontSize: '18px' });
    const makes = lot === 'apothecary' ? t('apothecaryMakes') : t(SHOPS[lot].makes);
    this.add.text(left, y - this.lot.h / 2 + (compact ? 34 : 42), makes, { ...NOTE, wordWrap: { width: LOT.w - 124 } });
    if (lot !== 'apothecary') {
      // The goods its study still has to teach are shown faint.
      (Object.keys(SHOPS[lot].sells) as GoodId[]).forEach((good, i) => {
        const icon = fit(this.add.image(left + 8 + i * 22, y + (compact ? 10 : 18), goodTexture(good)), 1.2);
        this.views.push(() => {
          const shop = this.state.town.shops[lot];
          icon.setAlpha(!SHOPS[lot].research.includes(good) || (shop && shopKnows(shop, SHOPS[lot], good)) ? 1 : 0.35);
        });
      });
    }
    const status = coined(this.add.text(left, y + this.lot.h / 2 - 32, '', { ...NOTE, fontStyle: 'bold', color: '#5a2c80' }));
    card.on('pointerdown', () => this.tapLot(lot, card, x));
    this.views.push(() => {
      if (lot === 'apothecary') return status.setText(t('walkIn'));
      const shop = this.state.town.shops[lot];
      if (shop) return status.setText(shop.till > 0 ? t('walkInTill', { n: formatNumber(shop.till) }) : t('walkIn'));
      status.setText(t('buyShop', { coins: formatNumber(shopCost(lot)) }));
      card.setAlpha(this.state.coins >= shopCost(lot) ? 1 : 0.8);
    });
  }

  /** A district's card: its homes drawn as little houses, how happy it is and what it asks for. */
  private addDistrict(i: number, x: number, y: number) {
    const card = townCard(this, x, y, 'contract', DISTRICT.w, DISTRICT.h);
    const left = x - DISTRICT.w / 2 + 16;
    const topY = y - DISTRICT.h / 2;
    this.add.text(left, topY + 10, t(DISTRICTS[i].name), { ...TOWN_TEXT, fontSize: '17px' });
    const homesText = this.add.text(x + DISTRICT.w / 2 - 16, topY + 13, '', NOTE).setOrigin(1, 0);
    const homes = this.add.graphics();
    const bar = this.add.graphics();
    const happy = this.add.text(left, topY + 68, '', NOTE);
    const status = this.add.text(left, topY + 86, '', { ...NOTE, fontStyle: 'bold', color: '#5a2c80' });
    const wants = this.add.text(left, topY + 118, t('districtWants'), NOTE).setOrigin(0, 0.5);
    const icons = new Map<Need, Phaser.GameObjects.Image>();
    for (const need of new Set(HOME_TIERS.flatMap((tier) => tier.needs))) {
      const key = need in GOODS ? goodTexture(need as GoodId) : itemTexture(need as never);
      icons.set(need, fit(this.add.image(0, topY + 118, key), 1.2).setVisible(false));
    }
    const locked = this.add.text(x, y + 8, '', { ...NOTE, align: 'center', wordWrap: { width: DISTRICT.w - 40 } }).setOrigin(0.5);
    let drawn = '';
    this.views.push(() => {
      const d = this.state.town.districts[i];
      const open = d.open;
      card.setAlpha(open ? 1 : 0.7);
      for (const part of [homesText, homes, bar, happy, status, wants]) part.setVisible(open);
      locked.setVisible(!open).setText(open ? '' : t('districtLocked', { district: t(DISTRICTS[i - 1]?.name ?? 'marketRow') }));
      if (!open) return icons.forEach((icon) => icon.setVisible(false));
      homesText.setText(t(HOME_TIERS[d.tier].name, { n: d.homes }));
      const look = `${d.homes}/${d.tier}/${d.happiness}`;
      if (look !== drawn) {
        drawn = look;
        this.drawHomes(homes, left, topY + 40, d.homes, d.tier);
        bar.clear().fillStyle(0x3b2a1a, 0.25).fillRect(left + 112, topY + 74, 110, 8);
        bar.fillStyle(d.happiness >= 50 ? 0x4f8a3a : 0xb8862e, 1).fillRect(left + 112, topY + 74, (110 * d.happiness) / 100, 8);
      }
      happy.setText(t('happiness', { n: d.happiness }));
      status.setText(districtFull(d) ? t('districtFull') : d.growth > 0 ? t('districtGrowing') : d.short.length && d.happiness < 50 ? t('districtShort') : t('districtSteady'));
      const needs = HOME_TIERS[d.tier].needs;
      icons.forEach((icon, need) => {
        const k = needs.indexOf(need);
        icon.setVisible(k >= 0);
        if (k < 0) return;
        // The icons close up, and shrink, as a tier asks for more kinds of goods.
        const step = Math.min(26, (DISTRICT.w - 32 - wants.width - 10) / needs.length);
        fit(icon, Math.min(1.2, step / 17));
        icon.setX(left + wants.width + 10 + step / 2 + k * step).setAlpha(d.short.includes(need) ? 0.35 : 1);
      });
    });
  }

  /** A row of little houses, one per home: thatched cottages, or tiled houses with a storey more. */
  private drawHomes(g: Phaser.GameObjects.Graphics, x: number, y: number, n: number, tier: number) {
    g.clear();
    const wall = tier > 0 ? 0xe6d3a8 : 0xd8c49a;
    const roof = tier > 0 ? 0x8a3f2c : 0x9a7a3a;
    const h = tier > 0 ? 16 : 11;
    for (let k = 0; k < n; k++) {
      const left = x + k * (HOME.w + HOME.gap);
      const base = y + 18;
      g.fillStyle(wall, 1).fillRect(left, base - h, HOME.w, h);
      // Castles, the last tier, are stone towers with battlements instead of a roof.
      if (tier === HOME_TIERS.length - 1) {
        g.fillStyle(0xb8b0a0, 1).fillRect(left, base - h, HOME.w, h);
        for (let m = 0; m < 3; m++) g.fillRect(left + m * (HOME.w / 2.5), base - h - 5, HOME.w / 5, 5);
      } else g.fillStyle(roof, 1).fillTriangle(left - 3, base - h, left + HOME.w + 3, base - h, left + HOME.w / 2, base - h - 10);
      g.fillStyle(0x5a3a22, 1).fillRect(left + HOME.w / 2 - 3, base - 7, 6, 7);
      g.lineStyle(1, 0x2a1c12, 0.8).strokeRect(left, base - h, HOME.w, h);
    }
  }

  /** `homeX` is where the card sits, so a shake started during another one still ends there. */
  private tapLot(lot: Lot, card: Phaser.GameObjects.Image, homeX: number) {
    if (lot === 'apothecary' || this.state.town.shops[lot]) {
      ui('click');
      this.enter(lot);
      return;
    }
    const bought = buyShop(this.state, lot);
    if (!bought) {
      ui('refuse');
      this.tweens.killTweensOf(card);
      card.x = homeX;
      if (!settings.reduceMotion) this.tweens.add({ targets: card, x: homeX + 4, duration: 50, yoyo: true, repeat: 2 });
      return;
    }
    sfx('upgrade');
    const note = this.add
      .text(card.x, card.y, bought[0], { fontFamily: SERIF, fontSize: '16px', fontStyle: 'bold', color: INK })
      .setOrigin(0.5)
      .setDepth(TOWN_UI_DEPTH);
    this.tweens.add({ targets: note, y: note.y - 24, alpha: 0, delay: 900, duration: 900, onComplete: () => note.destroy() });
  }

  private enter(lot: Lot) {
    if (lot === 'apothecary') leaveFor(this, this.state, 'Game');
    else leaveFor(this, this.state, 'Shop', { shop: lot });
  }

  update(_time: number, delta: number) {
    const dt = Math.min(delta, 250);
    // The apothecary and the shops run on their own while the map is open, as while away.
    tick(this.state, dt, null);
    tickTown(this.state, dt, null);
    checkTrophies(this.state);
    for (const view of this.views) view();
  }
}
