import Phaser from 'phaser';
import { BUILDINGS, eliteFor, FACTION_IDS, FACTIONS, MAP_KIND_IDS, MAP_KINDS, MASTERY_WINS, UNIQUE, UNIQUE_EFFECT, unitFor, type FactionId, type MapKind } from '../game/data';
import { SCENARIOS, starText } from '../game/campaign';
import { loadMastery, loadStars, mastered, scenarioOpen } from '../progress';
import { stitchStars } from './hud';
import { t } from '../i18n';
import { FEET, FRAME, WOOL } from '../art/figures';
import { hexNum, SERIF, T } from '../art/stitch';
import { figKey } from './BootScene';
import { MENU_CARDS, MENU_MODE, MENU_OPTS, MENU_SCENARIOS } from './layout';
import { viewFrame } from '../../../../shared/scaling';
import { playMusic, ui } from '../../../../shared/audio';
import { COLONY } from '../audio/music';

/** The menu's options, kept for the session so a new match starts with the last ones. */
const options = { kind: 'lowlands' as MapKind, rivals: 1 as 1 | 2, mode: 'skirmish' as 'skirmish' | 'campaign', scenario: 0 };

/**
 * Starts a match: a skirmish (pick the map kind, one rival or two, a three-way match) or a campaign
 * scenario (pick one of the five; each opens once the one before it is won), then a faction; the AI
 * plays the next faction along, and the second AI the one after. Each card shows the faction's
 * mastery: its wins towards its second unique unit.
 */
export class MenuScene extends Phaser.Scene {
  private against: { text: Phaser.GameObjects.Text; id: FactionId }[] = [];
  private opts: { img: Phaser.GameObjects.Image | Phaser.GameObjects.Text; on: () => boolean; parts: Phaser.GameObjects.GameObject[]; mode: 'skirmish' | 'campaign' | null; base: string }[] = [];
  private optText!: Phaser.GameObjects.Text;
  private controls!: Phaser.GameObjects.Text;
  /** The scenario tiles' star rows, redrawn when the pick changes. */
  private starG!: Phaser.GameObjects.Graphics;
  /** The menu is laid out for 960x540 and sits in the middle of the view (`viewFrame`). */
  private ox = 0;
  private oy = 0;

  constructor() {
    super('Menu');
  }

  create() {
    playMusic(COLONY, 'calm');
    this.add.image(0, 0, 'backdrop').setOrigin(0, 0);
    const frame = viewFrame(this);
    this.ox = frame.x;
    this.oy = frame.y;
    const { ox, oy } = this;
    this.add.text(ox + 480, oy + 78, t('title').toUpperCase(), { fontFamily: SERIF, fontSize: '46px', fontStyle: 'bold', color: T.red, stroke: T.linen, strokeThickness: 2 }).setOrigin(0.5);
    this.add
      .text(ox + 480, oy + 120, t('menuIntro'), { fontFamily: SERIF, fontSize: '15px', color: T.ink })
      .setOrigin(0.5);

    this.against = [];
    this.opts = [];
    FACTION_IDS.forEach((id, i) => this.card(id, ox + MENU_CARDS.x + i * MENU_CARDS.dx, oy + MENU_CARDS.y));

    // Skirmish or campaign, as a toggle over the cards.
    (['skirmish', 'campaign'] as const).forEach((mode, i) => {
      const x = 480 - MENU_MODE.w - MENU_MODE.gap / 2 + i * (MENU_MODE.w + MENU_MODE.gap);
      this.option(x, MENU_MODE.y, MENU_MODE.w, MENU_OPTS.h, 'mode', t(mode === 'skirmish' ? 'modeSkirmish' : 'modeCampaign'), null, () => options.mode === mode, () => (options.mode = mode));
    });
    // The map kind and the number of rivals, as two rows of toggles under the cards.
    const label = (x: number, words: string) => this.add.text(ox + x - 10, oy + MENU_OPTS.y, words, { fontFamily: SERIF, fontSize: '12px', fontStyle: 'bold', color: T.red }).setOrigin(1, 0.5);
    const kindLabel = label(MENU_OPTS.kindX, t('mapLabel').toUpperCase());
    MAP_KIND_IDS.forEach((kind, i) => this.option(MENU_OPTS.kindX + i * (MENU_OPTS.w + MENU_OPTS.gap), MENU_OPTS.y, MENU_OPTS.w, MENU_OPTS.h, 'opt', t(MAP_KINDS[kind].name), 'skirmish', () => options.kind === kind, () => (options.kind = kind)));
    const rivalsLabel = label(MENU_OPTS.rivalsX, t('rivalsLabel').toUpperCase());
    ([1, 2] as const).forEach((n, i) => this.option(MENU_OPTS.rivalsX + i * (MENU_OPTS.w + MENU_OPTS.gap), MENU_OPTS.y, MENU_OPTS.w, MENU_OPTS.h, 'opt', t(n === 1 ? 'oneAi' : 'twoAis'), 'skirmish', () => options.rivals === n, () => (options.rivals = n)));
    this.opts.push({ img: kindLabel, on: () => false, parts: [rivalsLabel], mode: 'skirmish', base: '' });
    // The campaign's five scenarios, each with its number, name and stars; a locked one can't be picked.
    const stars = loadStars();
    const total = SCENARIOS.length * MENU_SCENARIOS.w + (SCENARIOS.length - 1) * MENU_SCENARIOS.gap;
    SCENARIOS.forEach((sc, i) => {
      const x = 480 - total / 2 + i * (MENU_SCENARIOS.w + MENU_SCENARIOS.gap);
      const open = scenarioOpen(i, stars);
      const name = `${i + 1}. ${t(sc.name)}`;
      this.option(x, MENU_SCENARIOS.y, MENU_SCENARIOS.w, MENU_SCENARIOS.h, 'scn', open ? name : t('scnLocked', { n: i + 1 }), 'campaign', () => options.scenario === i, () => {
        if (open) options.scenario = i;
        else ui('refuse');
      }, -7);
    });
    this.starG = this.add.graphics();
    this.optText = this.add.text(ox + 480, oy + 470, '', { fontFamily: SERIF, fontSize: '12.5px', fontStyle: 'italic', color: T.ink, align: 'center' }).setOrigin(0.5);
    if (!scenarioOpen(options.scenario, stars)) options.scenario = 0;

    this.controls = this.add
      .text(ox + 480, oy + 490, t('menuControls'), {
        fontFamily: SERIF,
        fontSize: '13px',
        color: T.faded,
        wordWrap: { width: 820 },
        align: 'center',
      })
      .setOrigin(0.5);
    this.refresh();
  }

  /**
   * A toggle button of the `base` texture set (`opt`, `mode` or `scn`) at (fx, fy) in the menu's
   * frame: `on` says whether it is the chosen one, `pick` chooses it, and it shows only in its `mode`
   * (null: always). `dy` lifts the words, for a tile with a row of stars under them.
   */
  private option(fx: number, fy: number, w: number, h: number, base: string, words: string, mode: 'skirmish' | 'campaign' | null, on: () => boolean, pick: () => void, dy = 0) {
    const x = this.ox + fx;
    const y = this.oy + fy;
    const img = this.add.image(x - 2, y - h / 2 - 2, `${base}-off`).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    const label = this.add.text(x + w / 2, y + 0.5 + dy, words.toUpperCase(), { fontFamily: SERIF, fontSize: '11px', fontStyle: 'bold', color: T.ink }).setOrigin(0.5);
    if (label.width > w - 8) label.setScale((w - 8) / label.width, 1);
    img.on('pointerover', () => !on() && img.setTexture(`${base}-hot`));
    img.on('pointerout', () => img.setTexture(on() ? `${base}-on` : `${base}-off`));
    img.on('pointerdown', () => {
      ui('click');
      pick();
      this.refresh();
    });
    this.opts.push({ img, on, parts: [label], mode, base });
  }

  /**
   * Shows the chosen mode and options: in a skirmish what the map kind is like, in the campaign the
   * scenario's goal, rule and stars; and whom each faction would play against.
   */
  private refresh() {
    const campaign = options.mode === 'campaign';
    for (const o of this.opts) {
      const shown = o.mode === null || (o.mode === 'campaign') === campaign;
      for (const part of [o.img, ...o.parts]) (part as Phaser.GameObjects.Image).setVisible(shown);
      if (o.base) (o.img as Phaser.GameObjects.Image).setTexture(o.on() ? `${o.base}-on` : `${o.base}-off`);
    }
    const g = this.starG.clear();
    const sc = SCENARIOS[options.scenario];
    if (campaign) {
      const stars = loadStars();
      const total = SCENARIOS.length * MENU_SCENARIOS.w + (SCENARIOS.length - 1) * MENU_SCENARIOS.gap;
      SCENARIOS.forEach((s, i) => {
        if (scenarioOpen(i, stars)) stitchStars(g, this.ox + 480 - total / 2 + i * (MENU_SCENARIOS.w + MENU_SCENARIOS.gap) + MENU_SCENARIOS.w / 2, this.oy + MENU_SCENARIOS.y + 8, stars[s.id], 5.5, 3, i === options.scenario ? T.red : T.ochre);
      });
      this.optText.setText(t('menuScenario', { goal: t(sc.goal), rule: t(sc.rule) }));
      const [two, three] = sc.stars.map((c) => {
        const { key, vars } = starText(c);
        return t(key, vars);
      });
      this.controls.setText(t('menuStars', { two, three }));
    } else {
      const kind = MAP_KINDS[options.kind];
      this.optText.setText(t('menuOptions', { kind: t(kind.name), text: t(kind.text), rivals: t(options.rivals === 2 ? 'rivalsTwo' : 'rivalsOne') }));
      this.controls.setText(t('menuControls'));
    }
    const two = campaign ? sc.rivals.length > 1 : options.rivals === 2;
    for (const { text, id } of this.against) {
      const [ai, ai2] = rivalsFor(id);
      text.setScale(1).setText(two ? t('playsAgainstTwo', { a: t(FACTIONS[ai].name), b: t(FACTIONS[ai2].name) }) : t('playsAgainst', { a: t(FACTIONS[ai].name) }));
      fit(text);
    }
  }

  private card(id: FactionId, x: number, y: number) {
    const f = FACTIONS[id];
    const box = this.add.image(x, y, 'card-faction').setInteractive({ useHandCursor: true });
    const top = y - 115;
    this.add.rectangle(x, top + 12, MENU_CARDS.w - 30, 6, hexNum(WOOL[id].cloth)).setOrigin(0.5);
    // The faction's three soldiers, in profile.
    (['melee', 'ranged', 'cavalry'] as const).forEach((role, k) => {
      const type = unitFor(id, role).id;
      this.add
        .image(x - 62 + k * 62, top + 96, figKey(type, id), 'idle-0')
        .setOrigin(FEET.x / FRAME, FEET.y / FRAME)
        .setScale(1.3);
    });
    fit(this.add.text(x, top + 122, t(f.name).toUpperCase(), { fontFamily: SERIF, fontSize: '20px', fontStyle: 'bold', color: WOOL[id].cloth }).setOrigin(0.5));
    this.add
      .text(x, top + 156, t(f.blurb), { fontFamily: SERIF, fontSize: '13px', color: T.ink, wordWrap: { width: MENU_CARDS.w - 26 }, align: 'center' })
      .setOrigin(0.5, 0.5);
    fit(this.add.text(x, top + 184, t('uniqueLine', { building: t(BUILDINGS[UNIQUE[id]].name), effect: t(UNIQUE_EFFECT[id]) }), { fontFamily: SERIF, fontSize: '12px', fontStyle: 'bold', color: WOOL[id].cloth }).setOrigin(0.5));
    this.against.push({ id, text: this.add.text(x, top + 200, '', { fontFamily: SERIF, fontSize: '12px', fontStyle: 'italic', color: T.faded }).setOrigin(0.5) });
    // Faction mastery: wins with the faction towards its second unique unit, or the unit once unlocked.
    const wins = loadMastery();
    const unit = t(eliteFor(id).name);
    const mastery = mastered(id, wins) ? t('masteryDone', { unit }) : t('masteryLine', { n: wins[id], total: MASTERY_WINS, unit });
    const line = this.add.text(x, top + 217, mastery, { fontFamily: SERIF, fontSize: '11.5px', fontStyle: 'bold', color: mastered(id, wins) ? T.green : T.indigo }).setOrigin(0.5);
    fit(line);
    box.on('pointerover', () => box.setTexture('card-faction-hot'));
    box.on('pointerout', () => box.setTexture('card-faction'));
    box.on('pointerdown', () => {
      ui('click');
      const [ai, ai2] = rivalsFor(id);
      if (options.mode === 'campaign') {
        const sc = SCENARIOS[options.scenario];
        this.scene.start('Game', { faction: id, aiFaction: ai, rival2: sc.rivals.length > 1 ? ai2 : null, scenario: sc.id });
        return;
      }
      this.scene.start('Game', { faction: id, aiFaction: ai, rival2: options.rivals === 2 ? ai2 : null, kind: options.kind });
    });
  }
}

/** Squeezes a card's line that would run past the card's edge. */
function fit(text: Phaser.GameObjects.Text) {
  const max = MENU_CARDS.w - 14;
  if (text.width > max) text.setScale(max / text.width, 1);
  return text;
}

/** The AI's faction and the second AI's for a player's faction: the next two along. */
function rivalsFor(id: FactionId): [FactionId, FactionId] {
  const i = FACTION_IDS.indexOf(id);
  return [FACTION_IDS[(i + 1) % FACTION_IDS.length], FACTION_IDS[(i + 2) % FACTION_IDS.length]];
}
