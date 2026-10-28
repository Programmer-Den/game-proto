import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: 'Stack swinging stones into a temple and finish tier 12 to crown the shrine. The run ends when a stone misses the temple.',
  controls: [
    {
      input: 'Click or tap a patron card',
      action: 'Start the temple under that patron',
    },
    { input: 'Click or tap anywhere', action: 'Drop the swinging stone' },
    {
      input: 'Swap button or R',
      action: 'From tier 2: hold the stone in reserve, or trade it with the held one',
    },
    {
      input: 'Click or tap a blessing card',
      action: 'Keep that blessing after a balanced tier',
    },
    { input: 'Reroll', action: 'Spend 5 favour for a new set of blessings' },
    {
      input: 'Shop buttons',
      action: "Between tiers: buy a Slow drop, a Wider stone or Mason's Grace with favour",
    },
    {
      input: 'Build on / Keep building',
      action: 'Go back to stacking after a break, or past the crown',
    },
  ],
  loop: [
    'Pick one of two patrons; their boon and bane last the whole run.',
    'Drop the stone while it hangs over the one below; any overhang breaks off.',
    'Three stones make a tier, and each tier swings a little faster.',
    'A balanced tier earns 5 favour and lets you pick a blessing.',
    'Spend favour in the shop if you like, then build the next tier.',
  ],
  tips: [
    'A drop within 5 pixels of the stone below is perfect: it keeps its full width and earns 2 extra favour.',
    'A tier is balanced when every stone in it kept at least three quarters of its width.',
    'Heavy stones swing slower but crack more off; light stones swing faster and earn 1 more favour.',
    'From tier 3 off-centre drops make the temple lean, and past 60 pixels the tier topples, losing its favour, and starts over.',
    'From tier 3, three perfect drops in a row start growing the stone back.',
    'Ticking a curse before you choose a blessing doubles everything the next tier earns.',
    'Tier 10 is gilded for double favour, and after the crown you can keep building into a windy sky, where every tenth tier is a sky altar with double favour and a blessing.',
  ],
};

/** US English only changes the spelling. */
const us = (text: string) => text.replace(/favour/g, 'favor').replace(/centre/g, 'center');
const enUS: HowToPlay = {
  goal: us(en.goal),
  controls: en.controls.map((c) => ({ input: us(c.input), action: us(c.action) })),
  loop: en.loop.map(us),
  tips: en.tips.map(us),
};

const de: HowToPlay = {
  goal: 'Stapele schwingende Steine zu einem Tempel und vollende Ebene 12, um den Schrein zu krönen. Der Lauf endet, wenn ein Stein den Tempel verfehlt.',
  controls: [
    {
      input: 'Eine Schutzherrnkarte anklicken oder antippen',
      action: 'Den Tempel unter diesem Schutzherrn beginnen',
    },
    { input: 'Irgendwo klicken oder tippen', action: 'Den schwingenden Stein fallen lassen' },
    {
      input: 'Tausch-Taste oder R',
      action: 'Ab Ebene 2: den Stein in Reserve halten oder gegen den gehaltenen tauschen',
    },
    {
      input: 'Eine Segenskarte anklicken oder antippen',
      action: 'Diesen Segen nach einer ausgewogenen Ebene behalten',
    },
    { input: 'Würfeln', action: '5 Gunst für neue Segen ausgeben' },
    {
      input: 'Laden-Tasten',
      action: 'Zwischen Ebenen: Langsamen Fall, Breiteren Stein oder Steinmetzgnade mit Gunst kaufen',
    },
    {
      input: 'Weiterbauen',
      action: 'Nach einer Pause oder über die Krone hinaus weiterstapeln',
    },
  ],
  loop: [
    'Wähle einen von zwei Schutzherren; Segen und Bürde gelten den ganzen Lauf.',
    'Lass den Stein fallen, solange er über dem darunter hängt; jeder Überhang bricht ab.',
    'Drei Steine ergeben eine Ebene, und jede Ebene schwingt etwas schneller.',
    'Eine ausgewogene Ebene bringt 5 Gunst und lässt dich einen Segen wählen.',
    'Gib Gunst im Laden aus, wenn du willst, und baue dann die nächste Ebene.',
  ],
  tips: [
    'Ein Wurf bis 5 Pixel neben dem Stein darunter ist perfekt: er behält seine volle Breite und bringt 2 Extra-Gunst.',
    'Eine Ebene ist ausgewogen, wenn jeder Stein darin mindestens drei Viertel seiner Breite behalten hat.',
    'Schwere Steine schwingen langsamer, brechen aber mehr ab; leichte schwingen schneller und bringen 1 Gunst mehr.',
    'Ab Ebene 3 neigen Würfe neben der Mitte den Tempel, und ab 60 Pixeln stürzt die Ebene ein, verliert ihre Gunst und beginnt von vorn.',
    'Ab Ebene 3 lassen drei perfekte Würfe in Folge den Stein wieder wachsen.',
    'Ein angekreuzter Fluch vor der Segenswahl verdoppelt alles, was die nächste Ebene bringt.',
    'Ebene 10 ist vergoldet und bringt doppelte Gunst, und nach der Krone kannst du in einen windigen Himmel weiterbauen, wo jede zehnte Ebene ein Himmelsaltar mit doppelter Gunst und einem Segen ist.',
  ],
};

export const howToPlay: HowToPlay = byLanguage({ en, 'en-US': enUS, de });
