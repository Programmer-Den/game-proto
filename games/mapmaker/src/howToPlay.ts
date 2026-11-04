import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: 'Survey uncharted islands with a sack of supplies, sell your charts at the port, and bind every isle into your atlas.',
  controls: [
    {
      input: 'Click or tap a magenta survey station',
      action: 'Survey that tile for its cost; the surveyor walks there',
    },
    {
      input: 'Camp',
      action: 'Pitch a base camp where the surveyor stands, for 3 supplies',
    },
    {
      input: 'Click or tap charted ground',
      action: 'Once you hold the riddle chart, dig there for 1 supply',
    },
    {
      input: 'Return to port',
      action: 'End the voyage early and draw the chart',
    },
    {
      input: 'Sell chart',
      action: "Sell the voyage's chart for coins at the port",
    },
    {
      input: 'Commission, hand or Buy',
      action: 'At the harbour: pick a commission, take a hand aboard or buy an upgrade',
    },
    { input: 'Set sail', action: 'Start the next voyage with full supplies' },
    { input: 'Daily isle', action: "At the harbour: one voyage on today's isle, the same for everyone, scored by coins" },
    { input: 'Wonders', action: 'At the harbour: the gallery of the wonders you have seen' },
    { input: 'Expeditions', action: 'At the harbour, once the Royal Atlas is bound: one voyage to a far isle, scored by how much you chart' },
    { input: 'Moon or sun beside the logo', action: 'Switch between the white sheet and the dark night sheet' },
  ],
  loop: [
    'Tap survey stations next to charted land to push inland from the port.',
    'Climb hills and peaks to see the tiles around them for free.',
    'When the supplies run out, or you turn back, the surveyor draws a chart.',
    'Sell the chart at the port for the value of every tile on it.',
    'Spend the coins at the harbour, then set sail to chart more of the isle.',
  ],
  tips: [
    'Most tiles cost 1 supply, forests and peaks cost 2, and rivers and roads are free to follow.',
    "Sea tiles can be charted, but you can't survey on from them.",
    'Villages and ruins are worth the most, and the ruins hold a treasure riddle worth 60 coins.',
    'Each supply left when you return to port sells back for 3 coins.',
    'Charting a whole river, road or wood pays 2 extra coins for each of its tiles.',
    'Charting all of an isle binds it into your atlas, and the next voyage sails to a new isle.',
    'From the third isle a rival surveyor charts too, and tiles they reach first sell for half.',
    'Every isle hides a wonder that shows once its tile and every tile beside it are charted.',
    'The daily isle and the expeditions have one sack of supplies for the whole isle and no restocking.',
  ],
};

/** US English only changes the spelling. */
const us = (text: string) => text.replace(/harbour/g, 'harbor');
const enUS: HowToPlay = {
  goal: us(en.goal),
  controls: en.controls.map((c) => ({ input: us(c.input), action: us(c.action) })),
  loop: en.loop.map(us),
  tips: en.tips.map(us),
};

const de: HowToPlay = {
  goal: 'Vermiss unbekannte Inseln mit einem Sack voller Vorräte, verkaufe deine Karten im Hafen und binde jede Insel in deinen Atlas.',
  controls: [
    {
      input: 'Eine magentafarbene Messstation anklicken oder antippen',
      action: 'Dieses Feld für seine Kosten vermessen; der Vermesser läuft hin',
    },
    {
      input: 'Lager',
      action: 'Für 3 Vorräte ein Basislager aufschlagen, wo der Vermesser steht',
    },
    {
      input: 'Kartiertes Gelände anklicken oder antippen',
      action: 'Sobald du die Rätselkarte hast, dort für 1 Vorrat graben',
    },
    {
      input: 'Zurück zum Hafen',
      action: 'Die Reise früh beenden und die Karte zeichnen',
    },
    {
      input: 'Karte verkaufen',
      action: 'Die Karte der Reise im Hafen für Münzen verkaufen',
    },
    {
      input: 'Auftrag, Helfer oder Kaufen',
      action: 'Im Hafen: einen Auftrag wählen, einen Helfer an Bord nehmen oder eine Verbesserung kaufen',
    },
    { input: 'In See stechen', action: 'Die nächste Reise mit vollen Vorräten beginnen' },
    { input: 'Tagesinsel', action: 'Im Hafen: eine Reise zur heutigen Insel, für alle gleich, gewertet nach Münzen' },
    { input: 'Wunder', action: 'Im Hafen: die Galerie der Wunder, die du gesehen hast' },
    { input: 'Expeditionen', action: 'Im Hafen, sobald der Königliche Atlas gebunden ist: eine Reise zu einer fernen Insel, gewertet nach dem kartierten Anteil' },
    { input: 'Mond oder Sonne neben dem Logo', action: 'Zwischen dem weißen Blatt und dem dunklen Nachtblatt wechseln' },
  ],
  loop: [
    'Tippe Messstationen neben kartiertem Land an, um vom Hafen ins Inland vorzudringen.',
    'Besteige Hügel und Gipfel, um die Felder um sie herum kostenlos zu sehen.',
    'Wenn die Vorräte ausgehen oder du umkehrst, zeichnet der Vermesser eine Karte.',
    'Verkaufe die Karte im Hafen für den Wert jedes Feldes darauf.',
    'Gib die Münzen im Hafen aus und stich dann in See, um mehr von der Insel zu kartieren.',
  ],
  tips: [
    'Die meisten Felder kosten 1 Vorrat, Wälder und Gipfel kosten 2, und Flüssen und Straßen folgst du kostenlos.',
    'Meerfelder lassen sich kartieren, aber von dort aus kannst du nicht weitervermessen.',
    'Dörfer und Ruinen sind am meisten wert, und die Ruinen bergen ein Schatzrätsel, das 60 Münzen wert ist.',
    'Jeder Vorrat, der bei der Rückkehr zum Hafen übrig ist, bringt 3 Münzen.',
    'Einen ganzen Fluss, eine Straße oder einen Wald zu kartieren bringt 2 Münzen extra für jedes seiner Felder.',
    'Eine ganz kartierte Insel wird in deinen Atlas gebunden, und die nächste Reise geht zu einer neuen Insel.',
    'Ab der dritten Insel kartiert auch ein rivalisierender Vermesser, und Felder, die er zuerst erreicht, bringen nur die Hälfte.',
    'Jede Insel birgt ein Wunder, das sich zeigt, sobald sein Feld und alle Felder daneben kartiert sind.',
    'Die Tagesinsel und die Expeditionen haben einen Sack Vorräte für die ganze Insel und keinen Nachschub.',
  ],
};

export const howToPlay: HowToPlay = byLanguage({ en, 'en-US': enUS, de });
