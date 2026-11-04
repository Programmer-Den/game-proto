import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

/** British English and US English spell everything here the same. */
const en: HowToPlay = {
  goal:
    'Plant golems beside the garden path to squash the pests before they eat the Heartwood. ' +
    'You lose when its 10 leaves are gone.',
  controls: [
    { input: 'Click or tap a seed card', action: 'Pick the seed to plant' },
    { input: 'Click or tap a soil cell', action: 'Plant the picked seed there, if you have the sap' },
    { input: 'Hedge card, then a path cell', action: 'Plant a hedge that blocks pests until they chew through it' },
    { input: 'Click or tap a golem', action: 'Open its menu: Raise, Aim, Move or Uproot' },
    { input: 'Start wave / Call wave now', action: 'Send the next wave, or call it early for bonus sap' },
    { input: '1x / 2x button', action: 'Play at double speed, or back to normal' },
    { input: 'Garden tag under the title', action: 'Pick a garden to plant, or its thorny variant' },
    { input: 'Click or tap the Heartwood', action: 'Between waves, regrow a lost leaf for sap' },
    { input: 'Daily plot (garden picker)', action: "Play today's seeded garden, once a day" },
    { input: 'Grafts (garden picker)', action: 'Spend laurels on golem grafts that last for good' },
  ],
  loop: [
    'Pick the Pebble golem seed and plant it on soil next to the path.',
    'Wait a few seconds while the seed grows into a golem that fights.',
    'Tap Start wave to send the pests down the path.',
    'Your golems squash pests, and each one drops sap.',
    'Clearing the wave pays bonus sap and opens a bud on the Heartwood.',
    'Spend the sap on more seeds and levels, then start the next wave.',
  ],
  tips: [
    'Golems only throw at pests within their reach; hover a soil cell to see how far that is.',
    'Moss golems slow pests, and golems side by side with one get a combo.',
    'At level 3 each golem picks one of two forms for good.',
    'Open all five Heartwood buds to unlock the Thorn golem, which pricks every pest in reach.',
    'From wave 3, unspent sap earns a little compost interest each wave.',
    'Crows fly over hedges, moles tunnel out of reach, and snails shrug off small hits.',
    'Wave 30 is the harvest: stars for the leaves you kept unlock new gardens.',
    'After every Queen Slug you squash you pick one of three boons for the rest of the garden.',
    'Three stars on a garden open its thorny variant; harvest it to win a laurel.',
    'Past wave 30 the garden grows wild: pests get tougher every wave and a Queen Slug comes every fifth.',
    'Laurels buy grafts: a third form for a golem, or a free first seed in every garden.',
    "The daily plot gives everyone the same garden and seeds for a day: hold 15 waves for the best score.",
  ],
};

const de: HowToPlay = {
  goal:
    'Pflanze Golems neben den Gartenweg, die die Schädlinge zerquetschen, bevor sie das Herzholz fressen. ' +
    'Du verlierst, wenn seine 10 Blätter weg sind.',
  controls: [
    { input: 'Eine Samenkarte anklicken oder antippen', action: 'Den Samen zum Pflanzen wählen' },
    { input: 'Ein Erdfeld anklicken oder antippen', action: 'Den gewählten Samen dort pflanzen, wenn du genug Saft hast' },
    { input: 'Heckenkarte, dann ein Wegfeld', action: 'Eine Hecke pflanzen, die Schädlinge aufhält, bis sie sich durchgenagt haben' },
    { input: 'Einen Golem anklicken oder antippen', action: 'Sein Menü öffnen: Stärken, Ziel, Umsetzen oder Ausreißen' },
    { input: 'Welle starten / Welle rufen', action: 'Die nächste Welle schicken oder sie für Bonussaft früher rufen' },
    { input: 'Taste 1x / 2x', action: 'Doppelt so schnell spielen oder zurück zu normal' },
    { input: 'Garten-Schild unter dem Titel', action: 'Einen Garten zum Pflanzen wählen oder seine dornige Variante' },
    { input: 'Das Herzholz anklicken oder antippen', action: 'Zwischen den Wellen ein verlorenes Blatt für Saft nachwachsen lassen' },
    { input: 'Tagesbeet (Gartenauswahl)', action: 'Den heutigen Garten mit festen Samen spielen, einmal am Tag' },
    { input: 'Pfropfen (Gartenauswahl)', action: 'Lorbeeren für Golem-Pfropfen ausgeben, die für immer bleiben' },
  ],
  loop: [
    'Wähle den Samen des Kieselgolems und pflanze ihn auf Erde neben dem Weg.',
    'Warte ein paar Sekunden, bis aus dem Samen ein kämpfender Golem wächst.',
    'Tippe auf Welle starten, um die Schädlinge den Weg entlang zu schicken.',
    'Deine Golems zerquetschen Schädlinge, und jeder lässt Saft fallen.',
    'Eine geschaffte Welle bringt Bonussaft und öffnet eine Knospe am Herzholz.',
    'Gib den Saft für weitere Samen und Stufen aus und starte dann die nächste Welle.',
  ],
  tips: [
    'Golems werfen nur auf Schädlinge in ihrer Reichweite; fahre über ein Erdfeld, um zu sehen, wie weit sie reicht.',
    'Moosgolems bremsen Schädlinge, und Golems direkt neben einem bilden eine Kombo.',
    'Auf Stufe 3 wählt jeder Golem für immer eine von zwei Formen.',
    'Öffne alle fünf Knospen des Herzholzes, um den Dorngolem freizuschalten, der jeden Schädling in Reichweite sticht.',
    'Ab Welle 3 bringt übriger Saft mit jeder Welle ein wenig Kompostzins.',
    'Krähen fliegen über Hecken, Maulwürfe graben sich außer Reichweite, und Schnecken stecken kleine Treffer weg.',
    'Welle 30 ist die Ernte: Sterne für die behaltenen Blätter schalten neue Gärten frei.',
    'Nach jeder zerquetschten Schneckenkönigin wählst du eine von drei Gaben für den Rest des Gartens.',
    'Drei Sterne auf einem Garten öffnen seine dornige Variante; ernte sie, um einen Lorbeer zu gewinnen.',
    'Nach Welle 30 verwildert der Garten: Schädlinge werden mit jeder Welle zäher, und jede fünfte bringt eine Schneckenkönigin.',
    'Lorbeeren kaufen Pfropfen: eine dritte Form für einen Golem oder einen freien ersten Samen in jedem Garten.',
    'Das Tagesbeet gibt allen für einen Tag denselben Garten und dieselben Samen: halte 15 Wellen für die beste Punktzahl.',
  ],
};

export const howToPlay: HowToPlay = byLanguage({ en, de });
