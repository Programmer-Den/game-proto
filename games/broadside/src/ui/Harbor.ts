import Phaser from 'phaser';
import { locale } from '../../../../shared/i18n';
import { renderScale } from '../../../../shared/scaling';
import { SHEET_RES } from '../art/art';
import { BOUNTIES } from '../game/bounties';
import { CAPTAIN_IDS, CAPTAINS } from '../game/captains';
import { CONSORT_MAX, consortWage } from '../game/consorts';
import { COURSE_IDS, COURSES, coursesFor, HUNTER_CARDS, type CourseId } from '../game/courses';
import { HULLS } from '../game/hulls';
import { DRAFT_SIZE, perkRank, PERKS, type PerkId } from '../game/perks';
import { ENEMIES, type EnemyKind } from '../game/ships';
import { keepBlocked, keepCost } from '../game/sim';
import { SHOTS } from '../game/shot';
import { ISLANDS, rank, type GameState, type Side } from '../game/state';
import { inReaches, reachWave } from '../game/waves';
import { costOf, HIRE, REPAIR_COST, UPGRADE_IDS, UPGRADES, type UpgradeId } from '../game/upgrades';
import { BEAST_KINDS } from '../game/beasts';
import { CARGO, CARGO_IDS, cargoPrice, cargoSale, HOLD_MAX, type CargoId } from '../game/trade';
import { COURSE, DRAFT, FONT, HARBOR, UI_DEPTH, VIEW } from '../scenes/layout';
import { t } from '../i18n';
import { makeButton } from './Button';
import { fitWidth, pinToScreen } from './screen';

export type HarborAction = UpgradeId | 'repair' | 'hire' | 'keep' | 'sail' | `sail-${CourseId}` | `load-${Side}` | `draft-${PerkId}` | `trade-${CargoId}`;
export interface HarborButton {
  id: HarborAction;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Row {
  id: UpgradeId | 'repair' | 'hire' | 'keep';
  bg: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  desc: Phaser.GameObjects.Text;
  cost: Phaser.GameObjects.Text;
}

const ROW = 0xf6ecd2;
const ROW_LIT = 0xebd29a;
const INK = 0x2b2118;
const style = (size: number, color: string, fontStyle = 'normal') => ({ fontFamily: FONT, fontSize: `${size}px`, color, fontStyle, resolution: Math.max(2, renderScale) });

/** A card of the prize draft. */
interface Card {
  bg: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  desc: Phaser.GameObjects.Text;
  /** Everything drawn for the card, hidden together when the draft has fewer cards. */
  parts: (Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text)[];
  head: Phaser.GameObjects.Text;
  rule: Phaser.GameObjects.Rectangle;
  foot: Phaser.GameObjects.Text;
  /** Which perk the card shows right now; the draft changes every wave. */
  perk: PerkId | null;
}

/** The most cards a draft can have: one more after a Hunter patrol. */
const MAX_CARDS = DRAFT_SIZE + HUNTER_CARDS;

/**
 * The harbor between waves, as a ledger on a sheet of parchment: spend the plunder on the ship,
 * patch the hull, hire sailors, keep a prize as a consort, and set sail (from wave 6 on one of two
 * courses). While the wave's prize draft is on offer, its cards cover the ledger instead, and one
 * must be picked.
 */
export class Harbor {
  /**
   * Where each button is on screen; the playthrough test reads it to tap one. The draft's cards
   * are listed as `draft-<perk>` for the perks on offer.
   */
  buttons: HarborButton[] = [];
  private ledgerButtons: HarborButton[] = [];
  private container: Phaser.GameObjects.Container;
  private draftContainer: Phaser.GameObjects.Container;
  private title: Phaser.GameObjects.Text;
  private gold: Phaser.GameObjects.Text;
  private bounty: Phaser.GameObjects.Text;
  private perks: Phaser.GameObjects.Text;
  private sail: { button: Phaser.GameObjects.Container; hit: HarborButton };
  private courses: { button: Phaser.GameObjects.Container; hit: HarborButton }[] = [];
  private draftTitle: Phaser.GameObjects.Text;
  private cards: Card[] = [];
  private rows: Row[] = [];
  /** The two loading buttons, one per side, each with what that side is loaded with. */
  private loads: { side: Side; name: Phaser.GameObjects.Text; desc: Phaser.GameObjects.Text; swap: Phaser.GameObjects.Text }[] = [];
  /**
   * The trade row, made the first time the harbor opens (see
   * `makeTrade`): every Phaser text draws on Math.random as it is made, and more at the start would
   * change the first wave the playthrough plays.
   */
  private trade: {
    name: Phaser.GameObjects.Text;
    desc: Phaser.GameObjects.Text;
    goods: { id: CargoId; bg: Phaser.GameObjects.Rectangle; name: Phaser.GameObjects.Text; sells: Phaser.GameObjects.Text }[];
  } | null = null;
  private scene: Phaser.Scene;
  private onAction: (id: HarborAction) => void;

  constructor(scene: Phaser.Scene, onAction: (id: HarborAction) => void) {
    this.scene = scene;
    this.onAction = onAction;
    const dim = scene.add.rectangle(VIEW.w / 2, VIEW.h / 2, VIEW.w, VIEW.h, 0x3a2a18, 0.45).setInteractive();
    const panel = scene.add.image(HARBOR.x, HARBOR.y, 'panel-harbor').setScale(1 / SHEET_RES);
    const top = HARBOR.y - HARBOR.h / 2;
    this.title = scene.add.text(HARBOR.x, top + 26, '', style(26, '#2b2118', 'bold')).setOrigin(0.5);
    this.gold = scene.add.text(HARBOR.x, top + 50, '', style(16, '#6a4410', 'italic')).setOrigin(0.5);
    this.bounty = scene.add.text(HARBOR.x, top + 68, '', style(12, '#3f6e48', 'bold italic')).setOrigin(0.5);
    this.perks = scene.add.text(HARBOR.x, top + 84, '', style(12, '#5a4a38', 'italic')).setOrigin(0.5);
    const rule = scene.add.rectangle(HARBOR.x, top + 96, HARBOR.rowW, 1, INK, 0.6);
    const parts: Phaser.GameObjects.GameObject[] = [dim, panel, this.title, this.gold, this.bounty, this.perks, rule];

    const ids: (UpgradeId | 'repair' | 'hire' | 'keep')[] = [...UPGRADE_IDS, 'repair', 'hire', 'keep'];
    ids.forEach((id, i) => {
      const y = HARBOR.firstRowY + i * HARBOR.rowGap;
      const left = HARBOR.x - HARBOR.rowW / 2;
      const bg = scene.add.rectangle(HARBOR.x, y, HARBOR.rowW, HARBOR.rowH, ROW, 0.9).setStrokeStyle(1.5, INK);
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => bg.setFillStyle(ROW_LIT, 0.95))
        .on('pointerout', () => bg.setFillStyle(ROW, 0.9))
        .on('pointerdown', () => onAction(id));
      const name = scene.add.text(left + 14, y - 8, '', style(15, '#2b2118', 'bold')).setOrigin(0, 0.5);
      const desc = scene.add.text(left + 14, y + 8, '', style(11, '#5a4a38', 'italic')).setOrigin(0, 0.5);
      const cost = scene.add.text(left + HARBOR.rowW - 14, y, '', style(17, '#6a4410', 'bold italic')).setOrigin(1, 0.5);
      this.rows.push({ id, bg, name, desc, cost });
      this.ledgerButtons.push({ id, x: HARBOR.x, y, w: HARBOR.rowW, h: HARBOR.rowH });
      parts.push(bg, name, desc, cost);
    });

    // Below the ledger, what each side's guns are loaded with; a tap loads the next kind of shot.
    const loadW = (HARBOR.rowW - 12) / 2;
    (['port', 'starboard'] as Side[]).forEach((side, i) => {
      const x = HARBOR.x + (i === 0 ? -1 : 1) * (loadW / 2 + 6);
      const y = HARBOR.loadY;
      const id = `load-${side}` as const;
      const bg = scene.add.rectangle(x, y, loadW, HARBOR.rowH, ROW, 0.9).setStrokeStyle(1.5, INK);
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => bg.setFillStyle(ROW_LIT, 0.95))
        .on('pointerout', () => bg.setFillStyle(ROW, 0.9))
        .on('pointerdown', () => onAction(id));
      const name = scene.add.text(x - loadW / 2 + 12, y - 8, '', style(15, '#2b2118', 'bold')).setOrigin(0, 0.5);
      const desc = scene.add.text(x - loadW / 2 + 12, y + 10, '', style(11, '#5a4a38', 'italic')).setOrigin(0, 0.5);
      const swap = scene.add.text(x + loadW / 2 - 12, y, '⟳', style(20, '#6a4410', 'bold')).setOrigin(1, 0.5);
      this.loads.push({ side, name, desc, swap });
      this.ledgerButtons.push({ id, x, y, w: loadW, h: HARBOR.rowH });
      parts.push(bg, name, desc, swap);
    });
    const loadLabel = scene.add.text(HARBOR.x, HARBOR.loadY - HARBOR.rowH / 2 - 10, t('loadGuns'), style(12, '#6a4410', 'italic')).setOrigin(0.5);
    parts.push(loadLabel);

    const sailY = HARBOR.y + HARBOR.h / 2 - 34;
    const sail = makeButton(scene, HARBOR.x, sailY, t('setSail'), () => onAction('sail'));
    this.sail = { button: sail.button, hit: { id: 'sail', x: HARBOR.x, y: sailY, w: sail.bg.width, h: sail.bg.height } };
    parts.push(sail.button);
    // From wave 6, two sail buttons instead, one per charted course, each with what it brings.
    COURSE_IDS.forEach((course, i) => {
      const x = HARBOR.x + (i === 0 ? -1 : 1) * (COURSE.w / 2 + COURSE.gap / 2);
      const id = `sail-${course}` as const;
      const b = makeButton(scene, x, sailY, `${t(COURSES[course].name)}\n${t(COURSES[course].desc)}`, () => onAction(id), COURSE.w, COURSE.h);
      b.text.setFontSize(15).setAlign('center').setLineSpacing(1);
      parts.push(b.button);
      this.courses.push({ button: b.button, hit: { id, x, y: sailY, w: COURSE.w, h: COURSE.h } });
    });
    this.container = pinToScreen(scene.add.container(0, 0, parts)).setDepth(UI_DEPTH + 10).setVisible(false);

    // The prize draft: three or four cards over the dimmed chart, one to be picked before the ledger opens.
    const draftDim = scene.add.rectangle(VIEW.w / 2, VIEW.h / 2, VIEW.w, VIEW.h, 0x3a2a18, 0.45).setInteractive();
    this.draftTitle = scene.add.text(DRAFT.x, DRAFT.titleY, '', style(24, '#f6ecd2', 'bold')).setOrigin(0.5).setStroke('#2b2118', 5);
    const hint = scene.add.text(DRAFT.x, DRAFT.titleY + 30, t('draftHint'), style(13, '#f6ecd2', 'italic')).setOrigin(0.5).setStroke('#2b2118', 4);
    const draftParts: Phaser.GameObjects.GameObject[] = [draftDim, this.draftTitle, hint];
    for (let i = 0; i < MAX_CARDS; i++) {
      // Placed in `show`, centred by how many cards the draft has.
      const x = DRAFT.x;
      const y = DRAFT.y;
      const bg = scene.add.rectangle(x, y, DRAFT.w, DRAFT.h, ROW, 0.97).setStrokeStyle(2, INK);
      const rule = scene.add.rectangle(x, y, DRAFT.w - 14, DRAFT.h - 14).setStrokeStyle(1, INK, 0.5);
      const head = scene.add.text(x, y - DRAFT.h / 2 + 26, t('prize'), style(12, '#6a4410', 'bold italic')).setOrigin(0.5);
      const name = scene.add.text(x, y - DRAFT.h / 2 + 62, '', { ...style(18, '#2b2118', 'bold'), align: 'center', wordWrap: { width: DRAFT.w - 30 } }).setOrigin(0.5);
      const desc = scene.add.text(x, y + 10, '', { ...style(13, '#5a4a38', 'italic'), align: 'center', wordWrap: { width: DRAFT.w - 30 }, lineSpacing: 3 }).setOrigin(0.5);
      const foot = scene.add.text(x, y + DRAFT.h / 2 - 24, t('keepThis'), style(13, '#6a4410', 'bold italic')).setOrigin(0.5);
      const card: Card = { bg, name, desc, head, rule, foot, parts: [bg, rule, head, name, desc, foot], perk: null };
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => bg.setFillStyle(ROW_LIT, 0.98))
        .on('pointerout', () => bg.setFillStyle(ROW, 0.97))
        .on('pointerdown', () => card.perk && onAction(`draft-${card.perk}`));
      this.cards.push(card);
      draftParts.push(bg, rule, head, name, desc, foot);
    }
    this.draftContainer = pinToScreen(scene.add.container(0, 0, draftParts)).setDepth(UI_DEPTH + 10).setVisible(false);
  }

  /**
   * The trade row under the ledger's last row: a label with the hold, then a button per cargo
   * that buys a crate at this harbor's price and says what it fetches at the next port.
   */
  private makeTrade() {
    const scene = this.scene;
    const y = HARBOR.firstRowY + (UPGRADE_IDS.length + 3) * HARBOR.rowGap;
    const left = HARBOR.x - HARBOR.rowW / 2;
    const labelBg = scene.add.rectangle(left + HARBOR.tradeLabelW / 2, y, HARBOR.tradeLabelW, HARBOR.rowH, ROW, 0.6).setStrokeStyle(1, INK, 0.6);
    const name = scene.add.text(left + 12, y - 8, '', style(15, '#2b2118', 'bold')).setOrigin(0, 0.5);
    const desc = scene.add.text(left + 12, y + 8, t('tradeDesc'), style(10, '#5a4a38', 'italic')).setOrigin(0, 0.5);
    fitWidth(desc, HARBOR.tradeLabelW - 16);
    const parts: Phaser.GameObjects.GameObject[] = [labelBg, name, desc];
    const gap = 6;
    const goodW = (HARBOR.rowW - HARBOR.tradeLabelW - gap * CARGO_IDS.length) / CARGO_IDS.length;
    const goods = CARGO_IDS.map((id, i) => {
      const x = left + HARBOR.tradeLabelW + gap + goodW / 2 + i * (goodW + gap);
      const bg = scene.add.rectangle(x, y, goodW, HARBOR.rowH, ROW, 0.9).setStrokeStyle(1.5, INK);
      bg.setInteractive({ useHandCursor: true })
        .on('pointerover', () => bg.setFillStyle(ROW_LIT, 0.95))
        .on('pointerout', () => bg.setFillStyle(ROW, 0.9))
        .on('pointerdown', () => this.onAction(`trade-${id}`));
      const label = scene.add.text(x, y - 7, '', style(14, '#2b2118', 'bold')).setOrigin(0.5);
      const sells = scene.add.text(x, y + 9, '', style(11, '#6a4410', 'italic')).setOrigin(0.5);
      this.ledgerButtons.push({ id: `trade-${id}`, x, y, w: goodW, h: HARBOR.rowH });
      parts.push(bg, label, sells);
      return { id, bg, name: label, sells };
    });
    this.container.add(parts);
    pinToScreen(this.container);
    this.trade = { name, desc, goods };
  }

  show(s: GameState | null) {
    if (s && !this.trade) this.makeTrade();
    const drafting = !!s && s.draft.length > 0;
    this.container.setVisible(!!s && !drafting);
    this.draftContainer.setVisible(drafting);
    if (!s) return;
    if (drafting) {
      this.draftTitle.setText(t('draftTitle', { wave: s.wave }));
      this.cards.forEach((card, i) => {
        const perk = s.draft[i] ?? null;
        card.perk = perk;
        // A perk already held is offered at its second rank.
        const second = !!perk && perkRank(s.perks, perk) > 0;
        card.head.setText(t(second ? 'prizeRank2' : 'prize'));
        card.name.setText(perk ? `${t(PERKS[perk].name)}${second ? ' II' : ''}` : '');
        card.desc.setText(perk ? t(second ? PERKS[perk].desc2 : PERKS[perk].desc) : '');
        for (const part of card.parts) part.setVisible(!!perk);
        const x = DRAFT.x + (i - (s.draft.length - 1) / 2) * (DRAFT.w + DRAFT.gap);
        for (const part of card.parts) part.setX(x);
      });
      this.buttons = this.cards.filter((c) => c.perk).map((c) => ({ id: `draft-${c.perk!}` as const, x: c.bg.x, y: c.bg.y, w: DRAFT.w, h: DRAFT.h }));
      return;
    }
    // The haven's harbor and those before wave 6 have one "Set sail"; later ones a button per course.
    const choose = coursesFor(s.wave + 1);
    this.sail.button.setVisible(!choose);
    for (const c of this.courses) c.button.setVisible(choose);
    this.buttons = [...this.ledgerButtons, ...(choose ? this.courses.map((c) => c.hit) : [this.sail.hit])];
    this.title.setText(inReaches(s.wave) ? t('reachesHarborTitle', { wave: reachWave(s.wave) }) : t('harborTitle', { wave: s.wave }));
    this.gold.setText(t('harborGold', { gold: s.gold, hp: Math.ceil(s.player.hp), max: s.player.maxHp, crew: s.player.crew, maxCrew: s.player.maxCrew }));
    const held = s.perks.filter((id, i) => s.perks.indexOf(id) === i).map((id) => `${t(PERKS[id].name)}${perkRank(s.perks, id) > 1 ? ' II' : ''}`);
    // The harbor wall, once a sea beast has been sunk, after the perks.
    const wall = s.wall.kraken + s.wall.serpent ? `   ❦   ${t('beastWall', { kraken: s.wall.kraken, serpent: s.wall.serpent })}` : '';
    fitWidth(this.perks.setText((held.length ? t('perksHeld', { perks: held.join(', ') }) : t('noPerks')) + wall), HARBOR.w - 40);
    const news: string[] = [];
    if (s.bounty) {
      // In the middle of the sentence, so with a small first letter.
      const bounty = BOUNTIES[s.bounty];
      const asked = t(bounty.desc, bounty.vars?.(s));
      news.push(s.bountyPaid ? t('bountyMet', { bounty: asked.charAt(0).toLocaleLowerCase(locale()) + asked.slice(1), gold: s.bountyPaid }) : t('bountyMissed'));
    }
    if (s.convoy) news.push(s.convoy.state === 'arrived' ? t('convoySafe', { island: t(ISLANDS[s.convoy.island].name), gold: s.convoy.cargo }) : t('convoyLost'));
    if (s.wages) news.push(t('wages', { gold: s.wages }));
    if (s.cargoSold) news.push(t('cargoSold', { gold: s.cargoSold }));
    for (const beast of BEAST_KINDS) if (s.waveSunk.includes(beast)) news.push(t(beast === 'kraken' ? 'krakenHung' : 'serpentHung'));
    // The named captains who sailed this wave: sunk into the log, or got away to come back.
    for (const { id, fate, gold } of s.waveCaptains) {
      const name = t(CAPTAINS[id].name);
      if (fate === 'escaped') news.push(t('captainEscaped', { name, wave: s.captains[id].due }));
      else news.push(t(gold ? 'captainSunkPaid' : 'captainSunk', { name, gold, n: s.log.length, total: CAPTAIN_IDS.length }));
    }
    fitWidth(this.bounty.setText(news.join('   ❦   ')), HARBOR.w - 40);
    for (const row of this.rows) {
      if (row.id === 'repair') {
        const needed = s.player.hp < s.player.maxHp;
        row.name.setText(t('patchHull'));
        row.desc.setText(t(needed ? 'repairFull' : 'hullSound'));
        row.cost.setText(needed ? t('goldCost', { gold: REPAIR_COST }) : '-');
        row.bg.setAlpha(needed && s.gold >= REPAIR_COST ? 1 : 0.5);
        continue;
      }
      if (row.id === 'keep') {
        // The richest prize sold here can be bought back and kept as a consort.
        const prize = s.moored[0];
        const why = keepBlocked(s);
        const ship = prize ? t(ENEMIES[prize.kind as EnemyKind].called) : '';
        row.name.setText(t('keepConsort', { n: s.consorts.length, max: CONSORT_MAX }));
        row.desc.setText(
          why === 'none' ? t('keepNone')
          : why === 'full' ? t('keepFull')
          : why === 'crew' ? t('keepCrew', { ship })
          : t('keepShip', { ship, wage: consortWage(prize!.kind as EnemyKind) }),
        );
        row.cost.setText(prize && why !== 'full' ? t('goldCost', { gold: keepCost(s, prize) }) : '-');
        row.bg.setAlpha(why ? 0.5 : 1);
        continue;
      }
      if (row.id === 'hire') {
        const short = s.player.maxCrew - s.player.crew;
        row.name.setText(t('hireSailors', { crew: s.player.crew, max: s.player.maxCrew }));
        row.desc.setText(short > 0 ? t('hireMore', { n: Math.min(HIRE.crew, short) }) : t('fullCrew'));
        row.cost.setText(short > 0 ? t('goldCost', { gold: HIRE.cost }) : '-');
        row.bg.setAlpha(short > 0 && s.gold >= HIRE.cost ? 1 : 0.5);
        continue;
      }
      const u = UPGRADES[row.id];
      const r = rank(s, row.id);
      const cost = costOf(row.id, r);
      row.name.setText(t('upgradeRank', { name: t(u.name), rank: r, max: u.maxRank }));
      row.desc.setText(t(u.desc));
      row.cost.setText(cost === null ? t('maxed') : t('goldCost', { gold: cost }));
      row.bg.setAlpha(cost !== null && s.gold >= cost ? 1 : 0.5);
    }
    for (const load of this.loads) {
      const side = t(load.side === 'port' ? 'sidePort' : 'sideStarboard');
      // A Bomb Ketch's mortar side carries no guns to load.
      const mortar = HULLS[s.hull].mortarSide === load.side;
      const shot = SHOTS[s.loadout[load.side]];
      load.name.setText(t('loadSide', { side, shot: t(mortar ? 'mortar' : shot.name) }));
      load.desc.setText(t(mortar ? 'mortarLoad' : shot.desc));
      load.swap.setVisible(!mortar);
    }
    const trade = this.trade!;
    trade.name.setText(t('tradeRow', { n: s.hold.length, max: HOLD_MAX }));
    for (const good of trade.goods) {
      const price = cargoPrice(good.id, s.wave);
      good.name.setText(t('tradeGood', { name: t(CARGO[good.id].name), gold: price }));
      good.sells.setText(t('tradeSells', { gold: cargoSale(good.id, price) }));
      good.bg.setAlpha(s.hold.length < HOLD_MAX && s.gold >= price ? 1 : 0.5);
    }
  }
}
