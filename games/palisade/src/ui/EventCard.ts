import Phaser from 'phaser';
import { OMEN, UI_DEPTH } from '../scenes/layout';
import { RELICS } from '../game/relics';
import { BLESSINGS, CURSES, EVENTS, SCOUT_WEAKEN, SHRINE_WAVES, peddlerPrice, type WaysideEvent } from '../game/wayside';
import { drawPanel, makeButton, textStyle } from './panel';
import { t } from '../i18n';

/**
 * A wayside event named during a break from wave 6, in the omen card's place: what it is, the
 * choice and two buttons (take it, or leave it). Left alone, it passes by when the break ends. Made
 * the first time an event comes, so its texts take no random calls before then.
 */
export class EventCard {
  private root: Phaser.GameObjects.Container;
  private title: Phaser.GameObjects.Text;
  private text: Phaser.GameObjects.Text;
  private takeText: Phaser.GameObjects.Text;
  private leaveText: Phaser.GameObjects.Text;
  private shown: string | null = null;
  /** Where the take and leave buttons are, by their centres, for tests to read. */
  buttons = {
    take: { x: OMEN.x - 90, y: OMEN.y + 42, w: 160, h: 32 },
    leave: { x: OMEN.x + 90, y: OMEN.y + 42, w: 160, h: 32 },
  };

  constructor(scene: Phaser.Scene, onDecide: (take: boolean) => void) {
    const { x, y, w } = OMEN;
    const h = OMEN.h + 14;
    const g = scene.add.graphics();
    drawPanel(g, x - w / 2, y - h / 2, w, h, { c: 14, fill: 0x22301e, alpha: 0.96, edge: 0x9ad07a, lw: 2.5 });
    this.title = scene.add.text(x, y - h / 2 + 20, '', textStyle(17, '#d8f5b8', 3)).setOrigin(0.5);
    this.text = scene.add
      .text(x, y - 12, '', { ...textStyle(12, '#e9e4d8'), fontStyle: 'normal', align: 'center', wordWrap: { width: w - 36 } })
      .setOrigin(0.5);
    const left = scene.add.text(x, y + 18, t('eventLeft'), { ...textStyle(10, '#a9b49a'), fontStyle: 'normal' }).setOrigin(0.5);
    const { take, leave } = this.buttons;
    const yes = makeButton(scene, take.x, take.y, take.w, take.h, '', () => onDecide(true));
    const no = makeButton(scene, leave.x, leave.y, leave.w, leave.h, '', () => onDecide(false));
    this.takeText = yes.list[1] as Phaser.GameObjects.Text;
    this.leaveText = no.list[1] as Phaser.GameObjects.Text;
    this.root = scene.add.container(0, 0, [g, this.title, this.text, left, yes, no]).setDepth(UI_DEPTH + 4).setVisible(false);
  }

  get open() {
    return this.root.visible;
  }

  /** Shows this break's event before `wave` with the hero's coins (the peddler's price), or hides the card for null. */
  show(event: WaysideEvent | null, wave: number, coins: number) {
    this.root.setVisible(!!event);
    if (!event) return;
    const price = peddlerPrice(coins);
    const key = `${event.id}-${wave}-${event.id === 'peddler' ? price : ''}`;
    if (key === this.shown) return;
    this.shown = key;
    const e = EVENTS[event.id];
    this.title.setText(t('eventTitle', { wave, event: t(e.name) }));
    if (event.id === 'scout') this.text.setText(t('scoutText', { n: Math.round((1 - SCOUT_WEAKEN) * 100) }));
    else if (event.id === 'peddler') this.text.setText(t('peddlerText', { relic: t(RELICS[event.relic].name), text: t(RELICS[event.relic].text) }));
    else {
      const b = BLESSINGS[event.blessing];
      const c = CURSES[event.curse];
      this.text.setText(t('shrineText', { n: SHRINE_WAVES, blessing: t(b.name), blessingText: t(b.text), curse: t(c.name), curseText: t(c.text) }));
    }
    this.takeText.setText(event.id === 'peddler' ? t('peddlerTake', { n: price }) : t(e.take));
    this.leaveText.setText(t(e.leave));
  }
}
