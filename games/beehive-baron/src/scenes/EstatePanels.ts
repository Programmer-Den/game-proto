import Phaser from 'phaser';
import { ui } from '../../../../shared/audio';
import { formatNumber } from '../../../../shared/i18n';
import { GARDEN_LIVE } from '../art/palette';
import { CARD_PAD } from '../art/scenery';
import { BEDS, BED_COLS, BED_PRICE, BLOOMS, GARDEN_GOLDS, GARDEN_MS, RARES, RARE_CAP, RARE_KINDS, rarePairs, type Bloom } from '../game/garden';
import { canGift, enterRare, fulfil, giveRoyal, make, plant } from '../game/sim';
import { fairClasses, fairOn, fairWon, isWinter, rareCount, rarePrice, seasonLeft, type GameState } from '../game/state';
import { SEASONS, SEASON_MS, YEAR_MS } from '../game/seasons';
import { WARE, WARES, WORKSHOP_FROM } from '../game/workshop';
import { WARRANT_GOLDS, WARRANT_MAX, WARRANT_STEP, warrantBonus } from '../game/warrant';
import { t, type TextKey } from '../i18n';
import { Button } from '../ui/Button';
import { BOOK, ESTATE_CARD, FONT, GARDEN, UI_DEPTH, VIEW, WARRANT, WORKSHOP } from './layout';

// The estate's three late-game cards, each opened by a chip in the column under the buyer's book:
// the flower garden (its beds and rare honey), the candle workshop (wax into candles and polish for
// the church and the manor) and the royal warrant (the crown's autumn gift).

const style = (size: number, color: string, weight = '800'): Phaser.Types.GameObjects.Text.TextStyle => ({ fontFamily: FONT, fontSize: `${size}px`, fontStyle: weight, color, align: 'center' });
const clockText = (ms: number) => {
  const sec = Math.ceil(ms / 1000);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
};

interface Panel {
  chip: Phaser.GameObjects.Container;
  detail: Phaser.GameObjects.Text;
  card: Phaser.GameObjects.Container;
  head: Phaser.GameObjects.Text;
  sub: Phaser.GameObjects.Text;
  buttons: Button[];
}

/** A button's centre, for the playthrough-style tests. */
const at = (b: Button) => ({ x: b.root.x, y: b.root.y });

export class EstatePanels {
  private panels: Panel[] = [];
  private garden!: Panel & { blooms: Button[]; beds: Button[]; enter: Button; links: Phaser.GameObjects.Graphics; recipe: Phaser.GameObjects.Text };
  private workshop!: Panel & { makes: Button[]; rows: Button[] };
  private warrant!: Panel & { gift: Button; note: Phaser.GameObjects.Text };
  /** The flower the next tap on a bed plants. */
  private bloom: Bloom = 'lavender';

  constructor(
    private scene: Phaser.Scene,
    private state: () => GameState,
    private act: (done: boolean) => void,
  ) {
    this.createGarden();
    this.createWorkshop();
    this.createWarrant();
  }

  /** A chip in the column under the book, and the card it opens (hidden until tapped). */
  private panel(spot: { x: number; y: number }, title: TextKey): Panel {
    const s = this.scene;
    const chipCard = s.add.image(-CARD_PAD, -CARD_PAD, 'book-chip').setOrigin(0).setInteractive({ useHandCursor: true });
    const name = s.add.text(8, 12, t(title), { ...style(11.5, '#4a2c10', '900'), align: 'left' }).setOrigin(0, 0.5);
    const detail = s.add.text(8, 27, '', { ...style(10, '#6a4a28', '700'), align: 'left' }).setOrigin(0, 0.5);
    const chip = s.add.container(spot.x, spot.y, [chipCard, name, detail]).setDepth(UI_DEPTH - 1).setVisible(false);
    const shade = s.add.rectangle(0, 0, VIEW.w * 2, VIEW.h * 2, 0x2a1808, 0.45).setInteractive();
    const big = s.add.image(0, 0, 'estate-card').setInteractive();
    const head = s.add.text(0, -ESTATE_CARD.h / 2 + 26, '', style(18, '#4a2c10', '900')).setOrigin(0.5);
    const sub = s.add.text(0, -ESTATE_CARD.h / 2 + 46, '', style(10.5, '#6a4a28', '700')).setOrigin(0.5);
    const close = s.add.text(ESTATE_CARD.w / 2 - 22, ESTATE_CARD.h / 2 - 34, t('tapOutside'), style(10.5, '#8a6a40', '600')).setOrigin(1, 0.5);
    const card = s.add.container(ESTATE_CARD.x, ESTATE_CARD.y, [shade, big, head, sub, close]).setDepth(UI_DEPTH + 5).setVisible(false);
    shade.on('pointerdown', () => {
      ui('click');
      card.setVisible(false);
    });
    chipCard.on('pointerdown', () => {
      ui('click');
      this.close();
      card.setVisible(true);
    });
    const p: Panel = { chip, detail, card, head, sub, buttons: [] };
    this.panels.push(p);
    return p;
  }

  /** A button on a panel's card, at a point relative to the card's centre. */
  private button(p: Panel, x: number, y: number, w: number, h: number, onClick: () => void) {
    const b = new Button(this.scene, ESTATE_CARD.x + x, ESTATE_CARD.y + y, w, h, onClick);
    b.root.setDepth(UI_DEPTH + 6).setVisible(false);
    p.buttons.push(b);
    return b;
  }

  private createGarden() {
    const p = this.panel(GARDEN, 'garden');
    const xs = [...Array(BED_COLS).keys()].map((i) => (i - (BED_COLS - 1) / 2) * 122);
    const blooms = BLOOMS.map((b, i) =>
      this.button(p, xs[i], -74, 116, 28, () => {
        if (this.bloom !== b) ui('click');
        this.bloom = b;
      }),
    );
    const beds = [...Array(BEDS).keys()].map((i) => this.button(p, xs[i % BED_COLS], -26 + Math.floor(i / BED_COLS) * 48, 116, 40, () => this.act(plant(this.state(), i, this.bloom))));
    const enter = this.button(p, -95, ESTATE_CARD.h / 2 - 34, 240, 36, () => this.act(enterRare(this.state())));
    const links = this.scene.add.graphics().setDepth(UI_DEPTH + 7).setVisible(false);
    const recipe = this.scene.add.text(0, 66, t('rareRecipes'), style(9.5, '#6a4a28', '700')).setOrigin(0.5).setWordWrapWidth(ESTATE_CARD.w - 50);
    p.card.add(recipe);
    this.garden = { ...p, blooms, beds, enter, links, recipe };
  }

  private createWorkshop() {
    const p = this.panel(WORKSHOP, 'workshop');
    const makes = WARES.map((w, i) => this.button(p, (i - 0.5) * 224, -50, 216, 40, () => this.act(make(this.state(), w))));
    const rows = WARES.map((_, i) => this.button(p, 0, 2 + i * 48, ESTATE_CARD.w - 50, 40, () => this.act(fulfil(this.state(), i))));
    this.workshop = { ...p, makes, rows };
  }

  private createWarrant() {
    const p = this.panel(WARRANT, 'royalWarrant');
    const gift = this.button(p, 0, -40, ESTATE_CARD.w - 50, 48, () => this.act(giveRoyal(this.state())));
    const note = this.scene.add.text(0, 30, '', style(10.5, '#6a4a28', '700')).setOrigin(0.5).setWordWrapWidth(ESTATE_CARD.w - 60);
    p.card.add(note);
    this.warrant = { ...p, gift, note };
  }

  /** Hides every card (another card opened, or a new hive). */
  close() {
    for (const p of this.panels) p.card.setVisible(false);
  }

  /** The chips and the controls on the cards, for tests. */
  spots() {
    const chip = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    return {
      garden: chip(GARDEN),
      workshop: chip(WORKSHOP),
      warrant: chip(WARRANT),
      blooms: Object.fromEntries(BLOOMS.map((b, i) => [b, at(this.garden.blooms[i])])),
      beds: this.garden.beds.map(at),
      enterRare: at(this.garden.enter),
      makes: Object.fromEntries(WARES.map((w, i) => [w, at(this.workshop.makes[i])])),
      commissions: this.workshop.rows.map(at),
      gift: at(this.warrant.gift),
    };
  }

  draw() {
    const s = this.state();
    const unlocked = [s.golds >= GARDEN_GOLDS, s.sold >= WORKSHOP_FROM, s.golds >= WARRANT_GOLDS];
    this.panels.forEach((p, i) => {
      p.chip.setVisible(unlocked[i]);
      if (!unlocked[i]) p.card.setVisible(false);
      for (const b of p.buttons) b.root.setVisible(p.card.visible);
    });
    this.drawGarden(s);
    this.drawWorkshop(s);
    this.drawWarrant(s);
  }

  private chipDetail(p: Panel, text: string, hot: boolean) {
    // Shrink a line too long for the chip (two-digit counts, longer words) so it stays off the button board.
    if (p.detail.text !== text) {
      p.detail.setFontSize(10).setText(text);
      for (let size = 9.5; size >= 7 && p.detail.width > BOOK.w - 12; size -= 0.5) p.detail.setFontSize(size);
    }
    const colour = hot ? '#a85a10' : '#6a4a28';
    if (p.detail.style.color !== colour) p.detail.setColor(colour);
  }

  private drawGarden(s: GameState) {
    const g = this.garden;
    const pairs = rarePairs(s.garden);
    const jars = rareCount(s);
    const canEnter = fairOn(s) && !fairWon(s) && fairClasses(s).includes('rare') && jars > 0;
    this.chipDetail(g, pairs.length === 0 ? t('plantBeds') : t('rareJars', { n: jars }), canEnter);
    g.links.setVisible(g.card.visible);
    if (!g.card.visible) return;
    g.head.setText(t('gardenTitle'));
    const kept = RARE_KINDS.filter((r) => s.rare[r] > 0).map((r) => `${formatNumber(s.rare[r])} ${t(RARES[r].name)}`);
    const growth =
      pairs.length === 0 ? t('noRareBloom') : isWinter(s) ? t('gardenWinter') : jars >= RARE_CAP ? t('gardenFull', { n: RARE_CAP }) : t('gardenNext', { time: clockText(GARDEN_MS - s.gardenMs) });
    g.sub.setText(`${t('rareKept', { what: kept.length ? kept.join(', ') : t('noComb') })} · ${growth}`);
    BLOOMS.forEach((b, i) => g.blooms[i].set(t(b), true, this.bloom === b));
    s.garden.forEach((bed, i) => {
      const name = bed ? t(bed) : t('emptyBed');
      const action = bed === this.bloom ? t('planted') : t(bed ? 'replant' : 'plant', { price: t('price', { n: BED_PRICE }) });
      g.beds[i].set(`${name}\n${action}`, bed !== this.bloom && s.coins >= BED_PRICE);
    });
    // A dot of each bed's flower in its corner, and a bar of the rare honey's colour between two beds that give one.
    g.links.clear();
    s.garden.forEach((bed, i) => {
      if (!bed) return;
      const b = g.beds[i].root;
      g.links.fillStyle(GARDEN_LIVE.bloom[bed], 1).fillCircle(b.x - 50, b.y - 11, 4);
    });
    for (const { a, b, rare } of pairs) {
      const [p, q] = [g.beds[a].root, g.beds[b].root];
      const [mx, my] = [(p.x + q.x) / 2, (p.y + q.y) / 2];
      const across = p.y === q.y;
      g.links.fillStyle(GARDEN_LIVE.rare[rare], 1).lineStyle(1.5, 0xffffff, 0.9);
      const [w, h] = across ? [10, 26] : [40, 10];
      g.links.fillRoundedRect(mx - w / 2, my - h / 2, w, h, 4).strokeRoundedRect(mx - w / 2, my - h / 2, w, h, 4);
    }
    const best = [...RARE_KINDS].sort((a, b) => RARES[b].points - RARES[a].points).find((r) => s.rare[r] > 0);
    const why = !fairClasses(s).includes('rare') ? t(fairOn(s) && pairs.length > 0 ? 'rareClassNext' : 'rareClassNone') : !fairOn(s) ? t('rareClassLater') : fairWon(s) ? t('fairWonShort') : best ? t('rareScores', { honey: t(RARES[best].name), n: RARES[best].points }) : t('noRareJar');
    g.enter.set(`${t('enterRare')}\n${why}`, canEnter);
    const prices = RARE_KINDS.map((r) => t('rarePrice', { honey: t(RARES[r].name), price: t('price', { n: rarePrice(s, r) }) })).join(' · ');
    g.recipe.setText(`${t('rareRecipes')}\n${prices}`);
  }

  private drawWorkshop(s: GameState) {
    const w = this.workshop;
    const open = s.commissions.filter((c) => !c.done);
    this.chipDetail(w, t('waresMade', { candles: s.wares.candle, polish: s.wares.polish }), open.some((c) => s.wares[c.ware] >= c.count));
    if (!w.card.visible) return;
    w.head.setText(t('workshopTitle'));
    w.sub.setText(t('workshopSub', { wax: s.wax, candles: s.wares.candle, polish: s.wares.polish, time: clockText(seasonLeft(s)) }));
    WARES.forEach((ware, i) => w.makes[i].set(`${t(ware === 'candle' ? 'dipCandle' : 'mixPolish')}\n${t('waxCost', { n: WARE[ware].wax })}`, s.wax >= WARE[ware].wax));
    w.rows.forEach((row, i) => {
      const c = s.commissions[i];
      if (!c) return row.set(t('noCommission'), false);
      const head = t(c.ware === 'candle' ? 'churchWants' : 'manorWants', { n: c.count });
      const price = t('price', { n: c.price });
      const ready = !c.done && s.wares[c.ware] >= c.count;
      const winter = c.ware === 'candle' && isWinter(s) ? ` · ${t('winterCandles')}` : '';
      const detail = c.done ? t('delivered') : ready ? t('askPay', { price, total: t('price', { n: c.price * c.count }) }) : t('askHave', { price, n: s.wares[c.ware] });
      row.set(`${head}\n${detail}${winter}`, ready);
    });
  }

  private drawWarrant(s: GameState) {
    const w = this.warrant;
    const r = s.royal;
    const pct = Math.round(warrantBonus(s.warrant) * 100);
    this.chipDetail(w, r && !r.done ? t('giftWanted') : s.warrant > 0 ? t('warrantChip', { n: pct }) : t('warrantNone'), canGift(s));
    if (!w.card.visible) return;
    w.head.setText(t('royalWarrant'));
    w.sub.setText(s.warrant > 0 ? t('warrantKept', { n: s.warrant, pct }) : t('warrantNotHeld'));
    if (!r) {
      w.gift.set(`${t('royalLater')}\n${t('royalIn', { time: clockText(untilAutumn(s)) })}`, false);
    } else {
      const what = r.grade === 'pure' ? t('askPure', { n: r.count, kind: t(r.kind) }) : t('askComb', { n: r.count, kind: t(r.kind) });
      const have = (r.grade === 'pure' ? s.jars : s.combs)[r.kind];
      const detail = r.done ? t('giftGiven') : canGift(s) ? t('giftNow', { time: clockText(seasonLeft(s)) }) : t('giftHave', { time: clockText(seasonLeft(s)), n: have });
      w.gift.set(`${t('crownAsks', { what })}\n${detail}`, canGift(s));
    }
    w.note.setText(t('warrantNote', { step: Math.round(WARRANT_STEP * 100), max: Math.round(WARRANT_MAX * 100) }));
  }
}

/** Game time until the next autumn begins. */
const untilAutumn = (s: GameState) => (SEASONS.indexOf('autumn') * SEASON_MS - s.seasonMs + YEAR_MS) % YEAR_MS || YEAR_MS;
