import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal:
    'Grow your hive, sell honey and win gold at the county honey fair to become the Beehive Baron. ' +
    'There is no way to lose.',
  controls: [
    { input: 'Click or tap an empty spot in the comb', action: 'Build a comb cell there (the first is free)' },
    { input: 'Send foragers', action: 'Send every bee at home out for nectar' },
    { input: 'Click or tap a capped cell', action: 'Harvest its honey into a jar, plus a piece of wax' },
    { input: 'Sell', action: 'Sell every jar on the shelf for coins' },
    { input: 'Shop buttons', action: 'Buy brood cells, mead casks and upgrades' },
    { input: 'Click or tap a honey on the market', action: 'Send the foragers to that meadow' },
    { input: 'Click or tap a wasp', action: 'Swat it away before it steals the honey' },
    { input: "Buyer's book (on the hill)", action: 'Supply town buyers, or arm Cut comb honey and tap a capped cell' },
    { input: 'Garden, Workshop and Royal warrant (under the book)', action: 'Plant beds, make candles and polish, and give the crown its gift' },
    { input: 'New hive (bottom right)', action: 'Start over from scratch, at once' },
  ],
  loop: [
    'Tap an empty spot in the comb to build your first cell.',
    'Tap Send foragers so the bees bring nectar back to the cell.',
    'A full cell ripens into honey and is capped with pale wax.',
    'Tap the capped cell to fill a jar of honey.',
    'Tap Sell to turn your jars into coins, then build more cells.',
  ],
  tips: [
    'Every edge two built cells share adds 1 coin to every jar you sell, so build them touching.',
    'Goals of jars sold unlock new meadows, each with its own honey and a lasting benefit.',
    'Bees are not bought: brood cells hatch them.',
    "Wax from each harvest pays part of a new cell's price.",
    'In winter the bees stay home and eat a jar for every 4 bees, so keep some jars or capped cells back.',
    'The Waggle Dance upgrade sends the bees out on their own.',
    'A meadow foraged for a minute without a break wilts and gives half the nectar until the season turns: switch kinds on the market now and then.',
    'Catching the swarm lets you pick the second hive\'s queen: Gentle (no wasps on her comb), Hardy (eats half in winter) or Busy (+1 nectar a trip).',
    'Once every meadow is open, the county fair is held at the end of every summer: a cell scores 1 point per touching capped cell of its kind, and 14 points win the first gold. Each year after needs more and adds a class.',
    "From 20 jars sold, the buyer's book pays a premium for mixed, pure and comb honey, with new buyers and prices every season.",
    'Every gold at the fair breeds a trait into the queen line, kept from year to year, and after the first gold you can buy plots for a third and a fourth hive, each with its own season quirks.',
    'After the first gold, plant the garden: clover beside lavender, clover beside sunflower and lavender beside heather cross-pollinate into rare honeys that sell dear and score in the fair\'s Rare class.',
    'From 50 jars sold, the candle workshop turns spare wax into candles and polish for the church\'s and the manor\'s commissions, new every season.',
    'After three golds the crown asks for a gift of honey each autumn: give it before winter to keep the royal warrant, which raises every price 10% a year, up to 50%.',
  ],
};

const de: HowToPlay = {
  goal:
    'Lass dein Volk wachsen, verkaufe Honig und gewinne Gold bei der Honigschau, um der Beehive Baron zu werden. ' +
    'Verlieren kannst du nicht.',
  controls: [
    { input: 'Einen freien Platz in der Wabe anklicken oder antippen', action: 'Dort eine Wabenzelle bauen (die erste ist gratis)' },
    { input: 'Sammlerinnen senden', action: 'Jede Biene daheim nach Nektar ausschicken' },
    { input: 'Eine verdeckelte Zelle anklicken oder antippen', action: 'Ihren Honig in ein Glas füllen, dazu ein Stück Wachs' },
    { input: 'Verkaufen', action: 'Alle Gläser im Regal für Taler verkaufen' },
    { input: 'Laden-Tasten', action: 'Brutzellen, Metfässer und Verbesserungen kaufen' },
    { input: 'Einen Honig auf dem Markt anklicken oder antippen', action: 'Die Sammlerinnen auf diese Wiese schicken' },
    { input: 'Eine Wespe anklicken oder antippen', action: 'Sie verscheuchen, bevor sie den Honig stiehlt' },
    { input: 'Käuferbuch (auf dem Hügel)', action: 'Käufer aus der Stadt beliefern, oder Wabenhonig schneiden und eine verdeckelte Zelle antippen' },
    { input: 'Garten, Werkstatt und Hoflieferant (unter dem Buch)', action: 'Beete pflanzen, Kerzen und Politur machen und der Krone ihre Gabe geben' },
    { input: 'Neuer Stock (unten rechts)', action: 'Sofort ganz von vorn beginnen' },
  ],
  loop: [
    'Tipp auf einen freien Platz in der Wabe, um deine erste Zelle zu bauen.',
    'Tipp auf Sammlerinnen senden, damit die Bienen Nektar in die Zelle bringen.',
    'Eine volle Zelle reift zu Honig und wird mit hellem Wachs verdeckelt.',
    'Tipp auf die verdeckelte Zelle, um ein Glas Honig abzufüllen.',
    'Tipp auf Verkaufen, um deine Gläser in Taler zu verwandeln, und baue dann mehr Zellen.',
  ],
  tips: [
    'Jede Kante, die sich zwei gebaute Zellen teilen, bringt 1 Taler mehr für jedes verkaufte Glas, also baue sie aneinander.',
    'Ziele für verkaufte Gläser öffnen neue Wiesen, jede mit eigenem Honig und einem bleibenden Vorteil.',
    'Bienen kann man nicht kaufen: Brutzellen brüten sie aus.',
    'Das Wachs jeder Ernte bezahlt einen Teil des Preises einer neuen Zelle.',
    'Im Winter bleiben die Bienen daheim und essen ein Glas für je 4 Bienen, also halte ein paar Gläser oder verdeckelte Zellen zurück.',
    'Die Verbesserung Schwänzeltanz schickt die Bienen von allein los.',
    'Eine Wiese, die eine Minute ohne Pause beflogen wird, welkt und gibt halb so viel Nektar, bis die Jahreszeit wechselt: Wechsle ab und zu die Sorte auf dem Markt.',
    'Fängst du den Schwarm ein, wählst du die Königin des zweiten Stocks: Sanft (keine Wespen auf ihrer Wabe), Zäh (isst im Winter halb so viel) oder Fleißig (+1 Nektar pro Flug).',
    'Sobald jede Wiese offen ist, findet am Ende jedes Sommers die Honigschau statt: Eine Zelle bringt 1 Punkt für jede angrenzende verdeckelte Zelle ihrer Sorte, und 14 Punkte gewinnen das erste Gold. Jedes Jahr danach braucht mehr und bringt eine Klasse dazu.',
    'Ab 20 verkauften Gläsern zahlt das Käuferbuch einen Aufpreis für gemischten, reinen und Wabenhonig, mit neuen Käufern und Preisen in jeder Jahreszeit.',
    'Jedes Gold bei der Honigschau züchtet eine Eigenschaft in die Königinnenlinie, die Jahr für Jahr bleibt, und nach dem ersten Gold kannst du Grund für einen dritten und vierten Stock kaufen, jeder mit eigenen Eigenheiten der Jahreszeiten.',
    'Pflanze nach dem ersten Gold den Garten: Klee neben Lavendel, Klee neben Sonnenblume und Lavendel neben Heide bestäuben sich zu seltenem Honig, der teuer verkauft und in der Klasse Selten der Honigschau punktet.',
    'Ab 50 verkauften Gläsern macht die Kerzenwerkstatt aus übrigem Wachs Kerzen und Politur für die Aufträge von Kirche und Gut, neu in jeder Jahreszeit.',
    'Nach dreimal Gold bittet die Krone jeden Herbst um eine Gabe Honig: Gib sie vor dem Winter, um Hoflieferant zu bleiben, was jeden Preis um 10\u00a0% im Jahr hebt, bis 50\u00a0%.',
  ],
};

/** US English spells every text the same as British English. */
export const howToPlay: HowToPlay = byLanguage({ en, de });
