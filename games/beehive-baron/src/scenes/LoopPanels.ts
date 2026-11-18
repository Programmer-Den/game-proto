import Phaser from 'phaser';
import { ui } from '../../../../shared/audio';
import { formatNumber } from '../../../../shared/i18n';
import { CARD_PAD } from '../art/scenery';
import { bid, bidMult } from '../game/auction';
import { CITIES } from '../game/book';
import { FED_MS } from '../game/jelly';
import { acceptBid, feedQueens, sellJelly } from '../game/sim';
import { isJelly, jellyPrice, type GameState } from '../game/state';
import { DAY_MS, WEATHER_FROM, type Weather } from '../game/weather';
import { t, type TextKey } from '../i18n';
import { Button } from '../ui/Button';
import { AUCTION, BOOK, END_CARD, FONT, FORECAST_CARD, JELLY, UI_DEPTH, VIEW } from './layout';

// The round 5 loop's pieces on screen: the weather forecast in the sky, the buyer's note that bids
// at a season's end, and the royal jelly chip with the card that sells it or feeds it to the queens.

const style = (size: number, color: string, weight = '800'): Phaser.Types.GameObjects.Text.TextStyle => ({ fontFamily: FONT, fontSize: `${size}px`, fontStyle: weight, color });
const clockText = (ms: number) => {
  const sec = Math.ceil(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

const WEATHER_NAME: Record<Weather, TextKey> = { fair: 'weatherFair', rain: 'weatherRain', warm: 'weatherWarm', frost: 'weatherFrost' };

/** A button's centre, for tests. */
const at = (b: Button) => ({ x: b.root.x, y: b.root.y });

export class LoopPanels {
  private forecast!: { root: Phaser.GameObjects.Container; icons: Phaser.GameObjects.Image[]; days: Phaser.GameObjects.Text[] };
  private auction!: { root: Phaser.GameObjects.Container; title: Phaser.GameObjects.Text; detail: Phaser.GameObjects.Text; bid: Phaser.GameObjects.Text };
  private chip!: { root: Phaser.GameObjects.Container; detail: Phaser.GameObjects.Text };
  private card!: { root: Phaser.GameObjects.Container; sub: Phaser.GameObjects.Text; sell: Button; feed: Button };

  constructor(
    private scene: Phaser.Scene,
    private state: () => GameState,
    private act: (done: boolean) => void,
  ) {
    this.createForecast();
    this.createAuction();
    this.createJelly();
  }

  private createForecast() {
    const s = this.scene;
    const parts: Phaser.GameObjects.GameObject[] = [
      s.add.image(-CARD_PAD, -CARD_PAD, 'forecast-card').setOrigin(0),
      s.add.text(FORECAST_CARD.w / 2, 14, t('forecast'), { ...style(11.5, '#4a2c10', '900'), align: 'center' }).setOrigin(0.5),
    ];
    const icons: Phaser.GameObjects.Image[] = [];
    const days: Phaser.GameObjects.Text[] = [];
    for (let i = 0; i < 4; i++) {
      const y = FORECAST_CARD.top + 12 + i * FORECAST_CARD.row;
      icons.push(s.add.image(18, y, 'weather-fair'));
      days.push(s.add.text(32, y, '', style(i === 0 ? 10 : 10.5, '#6a4a28', i === 0 ? '900' : '700')).setOrigin(0, 0.5));
    }
    parts.push(...icons, ...days);
    const root = s.add.container(FORECAST_CARD.x, FORECAST_CARD.y, parts).setDepth(UI_DEPTH - 1).setVisible(false);
    this.forecast = { root, icons, days };
  }

  private createAuction() {
    const s = this.scene;
    const card = s.add.image(-CARD_PAD, -CARD_PAD, 'auction-card').setOrigin(0).setInteractive({ useHandCursor: true });
    const title = s.add.text(42, 13, '', style(12, '#4a2c10', '900')).setOrigin(0, 0.5);
    const detail = s.add.text(42, 28, '', style(10, '#6a4a28', '700')).setOrigin(0, 0.5);
    const price = s.add.text(AUCTION.w - 12, AUCTION.h / 2, '', style(17, '#a85a10', '900')).setOrigin(1, 0.5);
    const root = s.add.container(AUCTION.x, AUCTION.y, [card, title, detail, price]).setDepth(UI_DEPTH - 1).setVisible(false);
    card.on('pointerdown', () => this.act(acceptBid(this.state())));
    this.auction = { root, title, detail, bid: price };
  }

  private createJelly() {
    const s = this.scene;
    const chipCard = s.add.image(-CARD_PAD, -CARD_PAD, 'book-chip').setOrigin(0).setInteractive({ useHandCursor: true });
    const icon = s.add.image(14, 12, 'jelly-icon');
    const name = s.add.text(25, 12, t('royalJelly'), style(10.5, '#4a2c10', '900')).setOrigin(0, 0.5);
    const detail = s.add.text(8, 27, '', style(10, '#6a4a28', '700')).setOrigin(0, 0.5);
    const chip = s.add.container(JELLY.x, JELLY.y, [chipCard, icon, name, detail]).setDepth(UI_DEPTH - 1).setVisible(false);
    // Shrink the name to fit the chip, for longer languages.
    for (let size = 10; size >= 7 && name.width > BOOK.w - 30; size -= 0.5) name.setFontSize(size);

    const shade = s.add.rectangle(0, 0, VIEW.w * 2, VIEW.h * 2, 0x2a1808, 0.45).setInteractive();
    const big = s.add.image(0, 0, 'queen-card').setInteractive();
    const head = s.add.text(0, -END_CARD.h / 2 + 30, t('royalJelly'), { ...style(19, '#4a2c10', '900'), align: 'center' }).setOrigin(0.5);
    const sub = s.add.text(0, -END_CARD.h / 2 + 54, '', { ...style(10.5, '#6a4a28', '700'), align: 'center' }).setOrigin(0.5);
    const note = s.add.text(0, END_CARD.h / 2 - 32, t('jellyNote'), { ...style(9.5, '#8a6a40', '600'), align: 'center' }).setOrigin(0.5).setWordWrapWidth(END_CARD.w - 50);
    const root = s.add.container(END_CARD.x, END_CARD.y, [shade, big, head, sub, note]).setDepth(UI_DEPTH + 5).setVisible(false);
    shade.on('pointerdown', () => {
      ui('click');
      root.setVisible(false);
    });
    chipCard.on('pointerdown', () => {
      ui('click');
      root.setVisible(true);
    });
    const sell = new Button(s, END_CARD.x - 96, END_CARD.y + 2, 180, 56, () => this.act(sellJelly(this.state())));
    const feed = new Button(s, END_CARD.x + 96, END_CARD.y + 2, 180, 56, () => this.act(feedQueens(this.state())));
    for (const b of [sell, feed]) b.root.setDepth(UI_DEPTH + 6).setVisible(false);
    this.chip = { root: chip, detail };
    this.card = { root, sub, sell, feed };
  }

  /** Hides the jelly card (a new hive). */
  close() {
    this.card.root.setVisible(false);
  }

  /** The forecast, the buyer's note, the jelly chip and the jelly card's buttons, for tests. */
  spots() {
    const mid = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    return { forecast: mid(FORECAST_CARD), auction: mid(AUCTION), jelly: mid(JELLY), jellySell: at(this.card.sell), jellyFeed: at(this.card.feed) };
  }

  draw() {
    const s = this.state();
    this.drawForecast(s);
    this.drawAuction(s);
    this.drawJelly(s);
  }

  private drawForecast(s: GameState) {
    const f = this.forecast;
    const on = s.sold >= WEATHER_FROM;
    f.root.setVisible(on);
    if (!on) return;
    const left = DAY_MS - (s.seasonMs % DAY_MS);
    s.weather.forEach((w, i) => {
      if (f.icons[i].texture.key !== `weather-${w}`) f.icons[i].setTexture(`weather-${w}`);
      f.days[i].setText(i === 0 ? `${t(WEATHER_NAME[w])}\n${clockText(left)}` : t(WEATHER_NAME[w]));
      const colour = w === 'rain' ? '#2f5a9a' : w === 'warm' ? '#b05a10' : '#6a4a28';
      if (f.days[i].style.color !== colour) f.days[i].setColor(colour);
      f.icons[i].setAlpha(i === 0 ? 1 : 0.85);
    });
  }

  private drawAuction(s: GameState) {
    const a = s.auction;
    const n = this.auction;
    n.root.setVisible(!!a);
    if (!a) return;
    const price = bid(a);
    n.title.setText(t('auctionFor', { city: t(CITIES[a.city]), jars: t(`${a.kind}Jars`, { n: a.jars }) }));
    n.detail.setText(t('auctionBid', { price: t('price', { n: price }), mult: formatNumber(Math.round(bidMult(a) * 10) / 10), total: t('price', { n: price * a.jars }) }));
    n.bid.setText(t('price', { n: price * a.jars }));
    // Shrink the lines to stay clear of the bid at the right.
    const room = AUCTION.w - 54 - n.bid.width - 10;
    for (const [text, size] of [[n.title, 12], [n.detail, 10]] as const) {
      if (text.style.fontSize !== `${size}px`) text.setFontSize(size);
      for (let k = size - 0.5; k >= 7.5 && text.width > room; k -= 0.5) text.setFontSize(k);
    }
  }

  private drawJelly(s: GameState) {
    const on = s.jelly > 0 || s.fedMs > 0 || s.cells.some(isJelly);
    this.chip.root.setVisible(on);
    if (!on) this.card.root.setVisible(false);
    const detail = s.fedMs > 0 ? t('jellyFed', { time: clockText(s.fedMs) }) : t('jellyKept', { n: s.jelly });
    if (this.chip.detail.text !== detail) {
      this.chip.detail.setFontSize(10).setText(detail);
      for (let size = 9.5; size >= 7 && this.chip.detail.width > BOOK.w - 12; size -= 0.5) this.chip.detail.setFontSize(size);
    }
    const colour = s.jelly > 0 ? '#a85a10' : '#6a4a28';
    if (this.chip.detail.style.color !== colour) this.chip.detail.setColor(colour);
    const c = this.card;
    const open = c.root.visible;
    c.sell.root.setVisible(open);
    c.feed.root.setVisible(open);
    if (!open) return;
    const sub = t('jellySub', { n: s.jelly });
    if (c.sub.text !== sub) {
      // One line, shrunk to fit the card in longer languages.
      c.sub.setFontSize(10.5).setText(sub);
      for (let size = 10; size >= 8 && c.sub.width > END_CARD.w - 30; size -= 0.5) c.sub.setFontSize(size);
    }
    c.sell.set(t('jellySell', { price: t('price', { n: jellyPrice(s) }) }), s.jelly > 0);
    c.feed.set(s.fedMs > 0 ? t('jellyFedFor', { time: clockText(s.fedMs) }) : t('jellyFeed', { time: clockText(FED_MS) }), s.jelly > 0);
  }
}
