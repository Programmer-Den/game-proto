import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal:
    'Lay track and fly the wyrm to carry goods between villages before orders run out. ' +
    'A late order costs a heart, and losing all three ends the game.',
  controls: [
    { input: 'Click, tap or drag over tiles next to the line', action: 'Lay track there' },
    { input: 'Click or tap an order', action: 'Send the wyrm to fetch and deliver it' },
    { input: 'Click or tap a junction', action: 'Throw its switch to steer the wyrm' },
    { input: 'Click or tap a village', action: 'Send a free wyrm with gifts (5 coins) to cheer it (from round 2)' },
    { input: 'Remove', action: 'Toggle: tap track to take it up for half what it cost' },
    { input: 'Plain', action: 'Toggle: lay track that joins only the piece it continues' },
    { input: 'Upgrade buttons', action: 'Buy Swift wings, Golden hoard or a Second wyrm' },
    { input: 'Depot, then a village', action: 'Build a depot there: its goods wait at half speed and load at once' },
    { input: 'A charter card', action: 'Pick the rules for the round (from round 3)' },
    { input: 'A trait card', action: 'Pick a lasting trait when the wyrm moults (rounds 4 and 7)' },
    { input: 'Keep, after a won festival', action: 'Fly on to the next valley with that upgrade' },
    { input: 'Daily valley', action: "Play today's valley, the same for everyone (one try a day)" },
  ],
  loop: [
    'Lay track from the Roost to Millbrook and Ashford.',
    'Tap the grain order to send the wyrm to Millbrook.',
    'The wyrm loads the grain and carries it to Ashford.',
    'The delivery pays coins and finishes the round.',
    'A new village joins each round, so stretch the line to reach it.',
  ],
  tips: [
    'Track costs 2 coins on grass, 4 in forest, 6 for a bridge and 20 for a tunnel through a mountain.',
    'The wyrm pulls two wagons, so it can carry two orders at once.',
    'A switch bars one arm of a junction, and the wyrm never goes through a barred arm.',
    'The wyrm gets hungry as it flies and goes home to the Roost to eat.',
    'Villages sulk if you ignore them, and a bitter village costs you a heart.',
    'From round 3, washouts and rockfalls can take a bridge or mountainside track; tunnels are safe.',
    'Round 9 is the festival at Kettlecross: ten deliveries win the game.',
    'The festival earns a medal for its time and hearts left; your best medal gives the next game a boon.',
    'After a won festival, fly on to a snowy valley, a marsh or a canyon, each with its own hazards and goods.',
    'The wyrm keeps its moulted traits in every valley it flies on to.',
  ],
};

const de: HowToPlay = {
  goal:
    'Lege Gleise und lass den Lindwurm Waren zwischen Dörfern tragen, bevor die Aufträge ablaufen. ' +
    'Ein verspäteter Auftrag kostet ein Herz, und wer alle drei verliert, hat verloren.',
  controls: [
    { input: 'Felder neben der Strecke anklicken, antippen oder überziehen', action: 'Dort Gleise legen' },
    { input: 'Einen Auftrag anklicken oder antippen', action: 'Den Lindwurm schicken, ihn abzuholen und zu liefern' },
    { input: 'Eine Weiche anklicken oder antippen', action: 'Sie umstellen, um den Lindwurm zu lenken' },
    { input: 'Ein Dorf anklicken oder antippen', action: 'Einen freien Lindwurm mit Geschenken (5 Münzen) schicken, um es aufzuheitern (ab Runde 2)' },
    { input: 'Abbauen', action: 'Umschalter: Gleise antippen, um sie für die Hälfte ihrer Kosten abzubauen' },
    { input: 'Schlicht', action: 'Umschalter: Gleise legen, die nur ans Stück davor anschließen' },
    { input: 'Ausbau-Tasten', action: 'Flinke Flügel, Goldhort oder einen zweiten Lindwurm kaufen' },
    { input: 'Depot, dann ein Dorf', action: 'Dort ein Depot bauen: Waren warten halb so schnell und laden sofort' },
    { input: 'Eine Freibriefkarte', action: 'Die Regeln der Runde wählen (ab Runde 3)' },
    { input: 'Eine Gabenkarte', action: 'Eine bleibende Gabe wählen, wenn sich der Lindwurm häutet (Runden 4 und 7)' },
    { input: 'Behalten, nach einem gewonnenen Fest', action: 'Mit diesem Ausbau ins nächste Tal fliegen' },
    { input: 'Tagestal', action: 'Das Tal des Tages spielen, für alle gleich (ein Versuch am Tag)' },
  ],
  loop: [
    'Lege Gleise vom Horst nach Millbrook und Ashford.',
    'Tippe den Getreideauftrag an, um den Lindwurm nach Millbrook zu schicken.',
    'Der Lindwurm lädt das Getreide und trägt es nach Ashford.',
    'Die Lieferung bringt Münzen und beendet die Runde.',
    'Jede Runde kommt ein neues Dorf dazu, also verlängere die Strecke bis dorthin.',
  ],
  tips: [
    'Gleise kosten 2 Münzen auf Wiese, 4 im Wald, 6 für eine Brücke und 20 für einen Tunnel durch einen Berg.',
    'Der Lindwurm zieht zwei Wagen und kann also zwei Aufträge zugleich tragen.',
    'Eine Weiche sperrt einen Arm einer Abzweigung, und der Lindwurm fährt nie durch einen gesperrten Arm.',
    'Der Lindwurm wird beim Fliegen hungrig und kehrt zum Fressen in den Horst zurück.',
    'Dörfer schmollen, wenn du sie vernachlässigst, und ein verbittertes Dorf kostet dich ein Herz.',
    'Ab Runde 3 können Fluten und Steinschläge Gleise auf Brücken und an Berghängen zerstören; Tunnel sind sicher.',
    'Runde 9 ist das Fest in Kettlecross: zehn Lieferungen gewinnen das Spiel.',
    'Das Fest bringt eine Medaille für Zeit und übrige Herzen; deine beste Medaille gibt dem nächsten Spiel einen Bonus.',
    'Nach einem gewonnenen Fest geht es weiter in ein Schneetal, ein Moor oder eine Schlucht, jedes mit eigenen Gefahren und Waren.',
    'Der Lindwurm behält seine Gaben aus jeder Häutung in jedem Tal, in das er weiterfliegt.',
  ],
};

/** US English spells every text here the same as British English. */
export const howToPlay: HowToPlay = byLanguage({ en, 'en-US': en, de });
