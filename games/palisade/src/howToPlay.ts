import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

/** British English; US English reads the same, so it falls back to this. */
const en: HowToPlay = {
  goal: 'Hold the barricade against waves of foes and lift the siege on wave 30 to win. The run ends if a foe reaches your ranger.',
  controls: [
    {
      input: 'Drag Arrow Rain onto the field, or R / Space',
      action: 'Loose a volley on the gold ring once it reads READY',
    },
    { input: 'Drag Caltrops onto the road, or C', action: 'Strew spikes that slow and hurt foes, once it reads READY' },
    { input: 'Aim toggle, or T', action: 'Choose who the ranger shoots first: Nearest, Strongest, Flyers or Healers' },
    {
      input: 'Tap a Hire slot on the barricade',
      action: 'Hire a spearman or a mage with coins, or train one you have',
    },
    { input: 'Fortify button, during a break', action: 'Buy a stake line, an oil pot or a lookout, one per break' },
    {
      input: 'Siege engine button, during a break',
      action: 'Build a ballista or a catapult on the wall, upgrade it and set its aim',
    },
    { input: 'Repair button, during a break', action: 'Mend 15% of the barricade for coins, a little dearer each time' },
    { input: 'Accept or Refuse an omen', action: 'From wave 4, take on a harder wave for 30% more experience' },
    { input: 'Tap a card', action: 'Take that upgrade at a level-up, or that road after a boss' },
    { input: '1x / 2x button', action: 'Switch the battle between normal and double speed' },
    { input: 'Skill book button', action: 'See every upgrade and relic you have found' },
    { input: 'Daily siege button, after a fall', action: 'Play today’s seeded run with a fresh ranger, once a day' },
  ],
  loop: [
    'Foes march in from the right and hack at the barricade while your ranger shoots on their own.',
    'Each kill gives experience, coins and charge for Arrow Rain and Caltrops.',
    'A full experience bar pauses the battle on three upgrades to pick from.',
    'Between waves, spend coins on guards or a fortification, and the barricade mends a little.',
    'Wave 10 brings a boss; beat it to open a relic chest and pick your next road.',
  ],
  tips: [
    'Your hero keeps their level, upgrades and relics from run to run.',
    'Kills in quick succession build a streak that gives up to 50% more experience.',
    'Harpies fly over the barricade straight at your ranger, so shoot them first.',
    'Shield bearers shrug off arrows; Arrow Rain, caltrops and guards get through.',
    'Shamans heal the foes around them, so aim at Healers when they show up.',
    'A level-up picks a card at random after 10 seconds unless you untick Auto-pick.',
    'Lifting the siege unlocks a harder heat for your next run.',
    'Once a boss has fallen, the next run can start at the following road with a stake of coins.',
    'A hero who knows every skill or lifted the siege can retire: the next hero keeps a legacy.',
    'Lifting the siege opens the frozen pass, a second map with its own foes and boss for the same hero.',
    'Retiring a hero opens the mage, who casts bolts through shields and has a skill tree of their own.',
    'A second retirement opens the warden, who slams foes back from the barricade with a hound at their side.',
    'The ballista pierces a whole line of foes; the catapult lobs stones into the back ranks.',
    'After lifting the siege, Endless siege keeps the waves coming, stronger each time, for a best wave per map.',
  ],
};

const de: HowToPlay = {
  goal: 'Halte die Barrikade gegen Wellen von Feinden und brich in Welle 30 die Belagerung, um zu gewinnen. Der Lauf endet, wenn ein Feind deinen Waldläufer erreicht.',
  controls: [
    {
      input: 'Pfeilregen aufs Feld ziehen, oder R / Leertaste',
      action: 'Eine Salve auf den goldenen Ring schießen, sobald BEREIT dasteht',
    },
    { input: 'Krähenfüße auf den Weg ziehen, oder C', action: 'Stacheln streuen, die Feinde bremsen und verletzen, sobald BEREIT dasteht' },
    { input: 'Ziel-Schalter, oder T', action: 'Wählen, auf wen zuerst geschossen wird: Nächste, Stärkste, Flieger oder Heiler' },
    {
      input: 'Einen Anheuern-Platz auf der Barrikade antippen',
      action: 'Einen Speerträger oder Magier für Münzen anheuern, oder eine Wache ausbilden',
    },
    { input: 'Befestigen, in einer Pause', action: 'Eine Pfahlreihe, einen Öltopf oder einen Ausguck kaufen, einen pro Pause' },
    {
      input: 'Geschütz, in einer Pause',
      action: 'Eine Balliste oder ein Katapult auf der Mauer bauen, verbessern und sein Ziel wählen',
    },
    { input: 'Reparieren, in einer Pause', action: '15 % der Barrikade für Münzen reparieren, jedes Mal etwas teurer' },
    { input: 'Ein Omen annehmen oder ablehnen', action: 'Ab Welle 4 eine härtere Welle für 30 % mehr Erfahrung wagen' },
    { input: 'Eine Karte antippen', action: 'Diese Verbesserung beim Stufenaufstieg nehmen, oder diesen Weg nach einem Boss' },
    { input: '1x / 2x', action: 'Den Kampf zwischen normaler und doppelter Geschwindigkeit wechseln' },
    { input: 'Fertigkeiten-Taste', action: 'Jede gefundene Verbesserung und Reliquie ansehen' },
    { input: 'Tagesbelagerung, nach einem Fall', action: 'Den heutigen Lauf mit einem frischen Waldläufer spielen, einmal am Tag' },
  ],
  loop: [
    'Feinde marschieren von rechts heran und hacken auf die Barrikade ein, während dein Waldläufer von selbst schießt.',
    'Jeder Sieg bringt Erfahrung, Münzen und Ladung für Pfeilregen und Krähenfüße.',
    'Ein voller Erfahrungsbalken hält den Kampf an, und du wählst aus drei Verbesserungen.',
    'Zwischen den Wellen gibst du Münzen für Wachen oder eine Befestigung aus, und die Barrikade heilt ein wenig.',
    'Welle 10 bringt einen Boss; besiege ihn, um eine Reliquientruhe zu öffnen und den nächsten Weg zu wählen.',
  ],
  tips: [
    'Dein Held behält Stufe, Verbesserungen und Reliquien von Lauf zu Lauf.',
    'Schnell aufeinanderfolgende Siege bauen eine Serie auf, die bis zu 50 % mehr Erfahrung bringt.',
    'Harpyien fliegen über die Barrikade direkt auf deinen Waldläufer zu, also schieß sie zuerst ab.',
    'Schildträger trotzen Pfeilen; Pfeilregen, Krähenfüße und Wachen kommen durch.',
    'Schamanen heilen die Feinde um sich herum, also ziele auf Heiler, wenn sie auftauchen.',
    'Ein Stufenaufstieg wählt nach 10 Sekunden eine zufällige Karte, außer du nimmst den Haken bei Auto-Wahl weg.',
    'Eine gebrochene Belagerung schaltet für den nächsten Lauf eine härtere Hitze frei.',
    'Ist ein Boss gefallen, kann der nächste Lauf mit einem Münzeinsatz beim folgenden Weg beginnen.',
    'Ein Held, der jede Fertigkeit kennt oder die Belagerung gebrochen hat, kann sich zur Ruhe setzen: der nächste Held behält ein Vermächtnis.',
    'Eine gebrochene Belagerung öffnet den Eispass, eine zweite Karte mit eigenen Feinden und eigenem Boss für denselben Helden.',
    'Der erste Ruhestand öffnet den Magier, der Bolzen durch Schilde zaubert und eigene Fertigkeiten hat.',
    'Der zweite Ruhestand öffnet den Wächter, der Feinde mit einem Hund an seiner Seite von der Barrikade zurückschlägt.',
    'Die Balliste durchbohrt eine ganze Reihe Feinde; das Katapult wirft Steine in die hinteren Reihen.',
    'Nach der gebrochenen Belagerung lässt Endlos weiter die Wellen immer stärker kommen, mit einer besten Welle pro Karte.',
  ],
};

export const howToPlay: HowToPlay = byLanguage({ en, de });
