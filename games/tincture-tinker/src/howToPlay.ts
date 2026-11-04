import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: 'Fill each potion order by matching its ingredients before the moves run out. A filled order sells for coins and stars.',
  controls: [
    { input: 'Tap a tile, then a neighbour, or drag a tile onto it', action: 'Swap the two tiles' },
    { input: 'Tap the picked tile again', action: 'Let it go' },
    { input: 'Tap Stir', action: 'Spend 40 coins on 3 more moves for this order' },
    { input: 'Tap Sift, then a tile', action: "Spend 25 coins to reroll that tile's row" },
    { input: 'Tap Pestle, then a tile', action: 'Spend 30 coins to smash that tile, without a move' },
    { input: 'Tap Funnel, then two tiles', action: 'Spend 35 coins to swap any two tiles, without a move' },
    {
      input: 'Tap Modest order or Rich order',
      action: 'After a sale: the next order as usual, or for more coins and more risk',
    },
    {
      input: 'Tap Try again, Workbench or Herbalist',
      action: 'After an order: retry it, buy lasting upgrades, or stock the pantry',
    },
    {
      input: "Tap Journey map, then a town, its guest's medallion, Daily, Weekly or Endless orders",
      action: "After a sale: a town's own board, its guest, today's order, the week's order, or a run of orders",
    },
  ],
  loop: [
    'Read the order label: the ingredients the potion needs, the moves you have and what it pays.',
    'Swap two neighbouring tiles to line up three or more of a kind.',
    'Matched ingredients the order needs fly to the label, and the tiles above fall into the gaps.',
    'Gather everything on the label before the moves run out and the potion sells.',
    'Spend your coins at the Workbench or the Herbalist, then pick the next order, modest or rich.',
  ],
  tips: [
    'A swap that makes no match slides back and costs no move, and cascades after a swap are free.',
    'A match of four leaves a Catalyst that clears its whole row when matched.',
    'An L or T shape leaves a Bloom that clears the 3x3 around it when matched.',
    'Swap two specials together: a Catalyst and a Bloom clear three rows, two Blooms a 5x5.',
    'Each move left pays 5 more coins, and 8 or more left earns three stars.',
    'Stars raise your Tinker rank, and each rank unlocks a new recipe.',
    'Corked jars, resin and creeping mould block the board; match right next to them to free the tiles.',
    'Every fifth order is a royal commission: three potions in a row on one board.',
    'Once Royal Apothecary, pass guild examinations on fixed boards to fill the ribbon with seals.',
    "Each town on the journey map has a board of its own shape: tiles fall past its walls. A town's first star opens the next.",
    'Each town grows a rare ingredient found nowhere else; its order and its guest ask for it.',
    "A town's first star brings a guest with a rule: the witch turns a tile to a toad each move, the knight gives ten moves, the miser pays only for cascades.",
    'The daily order is the same for everyone each day, with one try; endless orders open once every seal is earned.',
    "The weekly order keeps one board all week: play it as often as you like, every match scores and each cascade step counts once more.",
  ],
};

/** US English only changes the spelling. */
const us = (text: string) => text.replace(/neighbour/g, 'neighbor').replace(/mould/g, 'mold');
const enUS: HowToPlay = {
  goal: us(en.goal),
  controls: en.controls.map((c) => ({ input: us(c.input), action: us(c.action) })),
  loop: en.loop.map(us),
  tips: en.tips.map(us),
};

const de: HowToPlay = {
  goal: 'Erfülle jeden Trankauftrag, indem du seine Zutaten kombinierst, bevor die Züge ausgehen. Ein erfüllter Auftrag bringt Münzen und Sterne.',
  controls: [
    { input: 'Ein Feld antippen, dann ein Nachbarfeld, oder ein Feld darauf ziehen', action: 'Die beiden Felder tauschen' },
    { input: 'Das gewählte Feld noch einmal antippen', action: 'Es loslassen' },
    { input: 'Rühren antippen', action: '40 Münzen für 3 Züge mehr in diesem Auftrag ausgeben' },
    { input: 'Sieben antippen, dann ein Feld', action: '25 Münzen ausgeben, um die Reihe des Felds neu zu würfeln' },
    { input: 'Stößel antippen, dann ein Feld', action: '30 Münzen ausgeben, um das Feld ohne Zug zu zerstoßen' },
    { input: 'Trichter antippen, dann zwei Felder', action: '35 Münzen ausgeben, um zwei beliebige Felder ohne Zug zu tauschen' },
    {
      input: 'Schlichter Auftrag oder Reicher Auftrag antippen',
      action: 'Nach einem Verkauf: der nächste Auftrag wie gewohnt, oder für mehr Münzen und mehr Risiko',
    },
    {
      input: 'Noch einmal, Werkbank oder Kräuterladen antippen',
      action: 'Nach einem Auftrag: ihn wiederholen, dauerhafte Verbesserungen kaufen oder den Vorrat auffüllen',
    },
    {
      input: 'Reisekarte antippen, dann eine Stadt, das Medaillon ihres Gasts, Tages-, Wochen- oder Endlose Aufträge',
      action: 'Nach einem Verkauf: das eigene Brett einer Stadt, ihr Gast, der Auftrag von heute, der Wochenauftrag oder eine Serie',
    },
  ],
  loop: [
    'Lies das Auftragsetikett: welche Zutaten der Trank braucht, wie viele Züge du hast und was er bringt.',
    'Tausche zwei benachbarte Felder, um drei oder mehr Gleiche in eine Reihe zu bringen.',
    'Kombinierte Zutaten, die der Auftrag braucht, fliegen zum Etikett, und die Felder darüber fallen in die Lücken.',
    'Sammle alles auf dem Etikett, bevor die Züge ausgehen, dann wird der Trank verkauft.',
    'Gib deine Münzen in der Werkbank oder im Kräuterladen aus und wähle den nächsten Auftrag, schlicht oder reich.',
  ],
  tips: [
    'Ein Tausch ohne Treffer gleitet zurück und kostet keinen Zug, und Kettenreaktionen nach einem Tausch sind gratis.',
    'Vier in einer Reihe hinterlassen einen Katalysator, der beim Kombinieren seine ganze Reihe räumt.',
    'Eine L- oder T-Form hinterlässt eine Blüte, die beim Kombinieren die 3x3 Felder um sich räumt.',
    'Tausche zwei Spezialfelder miteinander: ein Katalysator und eine Blüte räumen drei Reihen, zwei Blüten ein 5x5.',
    'Jeder übrige Zug bringt 5 Münzen mehr, und ab 8 übrigen Zügen gibt es drei Sterne.',
    'Sterne heben deinen Tüftlerrang, und jeder Rang schaltet ein neues Rezept frei.',
    'Verkorkte Gläser, Harz und wuchernder Schimmel blockieren das Brett; kombiniere direkt daneben, um die Felder zu befreien.',
    'Jeder fünfte Auftrag ist ein königlicher Auftrag: drei Tränke nacheinander auf einem Brett.',
    'Als Hofapotheker bestehst du Gildenprüfungen auf festen Brettern und füllst das Band mit Siegeln.',
    'Jede Stadt auf der Reisekarte hat ein Brett in eigener Form: Felder fallen an ihren Mauern vorbei. Der erste Stern einer Stadt öffnet die nächste.',
    'Jede Stadt hat eine seltene Zutat, die es nur dort gibt; ihr Auftrag und ihr Gast verlangen sie.',
    'Der erste Stern einer Stadt bringt einen Gast mit eigener Regel: Die Hexe macht jeden Zug ein Feld zur Kröte, der Ritter gibt zehn Züge, der Geizhals zahlt nur für Kettenreaktionen.',
    'Der Tagesauftrag ist jeden Tag für alle gleich, mit einem Versuch; endlose Aufträge öffnen, wenn jedes Siegel verdient ist.',
    'Der Wochenauftrag behält eine Woche lang dasselbe Brett: Spiel ihn, so oft du willst; jeder Treffer zählt, jede Stufe einer Kettenreaktion einmal mehr.',
  ],
};

export const howToPlay: HowToPlay = byLanguage({ en, 'en-US': enUS, de });
