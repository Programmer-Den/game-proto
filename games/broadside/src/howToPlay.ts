import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: "Sink wave after wave of enemy ships, and the admiral's flagship at wave 20 to win. Then sail on into the Storm Reaches, 20 more waves ending with the Tempest. The run ends when your hull is sunk.",
  controls: [
    { input: 'Hold the Port wheel, or Left arrow / A', action: 'Turn to the left (the ship always sails on)' },
    { input: 'Hold the Starboard wheel, or Right arrow / D', action: 'Turn to the right' },
    { input: 'Hold Port guns or Q, then let go', action: 'Aim and charge the port broadside, then fire it' },
    { input: 'Hold Starboard guns or E, then let go', action: 'Aim and charge the starboard broadside, then fire it' },
    { input: 'Tap Scuttle the prize', action: 'Sink your newest prize at once for twice her loot' },
    {
      input: 'Tap a card or a row at the harbour',
      action: 'Keep a perk, buy an upgrade, patch the hull, hire sailors or keep a prize as a consort',
    },
    { input: 'Tap Port or Starboard under the ledger', action: "Load that side's guns with the next kind of shot" },
    { input: 'Tap Set sail, or from wave 6 a course', action: 'Leave the harbour for the next wave: the Merchant lane or a Hunter patrol' },
    { input: 'Tap Daily voyage on the end card', action: "Sail today's voyage: the same ship, perks and sea for everyone, once a day" },
  ],
  loop: [
    "Read the captain's order and the wind for the wave, then steer to close on an enemy.",
    "Turn side-on, hold that side's fire control to charge, and let go when the arc reaches the foe.",
    'Sail over the barrels of plunder that sunk ships leave behind, or board a crippled ship as a prize.',
    'Sink every ship of the wave and the ship puts into harbour.',
    'Keep one of three perks, spend your gold on upgrades and repairs, load your shot and set sail.',
  ],
  tips: [
    'A longer hold fires further and harder: a full one-second charge reaches the full range and hits 50% harder.',
    'Each side reloads on its own, so swing round and fire the other side while one reloads.',
    'Chain shot slows a ship, and grapeshot fires a fan that slows its reload and kills its crew.',
    'Sail alongside a ship under a fifth of its hull for a moment to take her as a prize that fights for you.',
    "Running onto an island's sand costs you 8 hull, but islands also make cover to fight round.",
    'The sea has no edge: sail off one side and you come back in on the other.',
    'Keep a prize as a consort at the harbour and she sails on with you from wave to wave, for a wage.',
    'On a convoy wave, see the merchantman safe to her island for her cargo: the sloops and fireships hunt her.',
    'Medals from each run buy a head start for the next one on the "Sunk!" panel.',
    "Named captains sail from wave 4. One who runs for it comes back three waves later, sturdier and with a bounty: sink all five over any runs to fill the captain's log for the lasting Renown.",
    'In the Storm Reaches squalls swing the wind round (the wind rose shows the next one coming) and reefs tear 30 off a hull, so steer clear of the rocks.',
  ],
};

// The same, with US spelling.
const enUS: HowToPlay = {
  ...en,
  controls: en.controls.map((c) => ({ input: c.input.replace('harbour', 'harbor'), action: c.action.replace('harbour', 'harbor') })),
  loop: en.loop.map((line) => line.replace('harbour', 'harbor')),
  tips: en.tips.map((line) => line.replace('harbour', 'harbor')),
};

const de: HowToPlay = {
  goal: 'Versenke Welle um Welle feindlicher Schiffe, und in Welle 20 das Flaggschiff des Admirals zum Sieg. Dann segle weiter in die Sturmsee, 20 weitere Wellen bis zur Sturmbraut. Der Lauf endet, wenn dein Rumpf sinkt.',
  controls: [
    { input: 'Backbord-Steuerrad halten, oder Pfeil links / A', action: 'Nach links drehen (das Schiff segelt immer weiter)' },
    { input: 'Steuerbord-Steuerrad halten, oder Pfeil rechts / D', action: 'Nach rechts drehen' },
    { input: 'Backbord-Kanonen oder Q halten, dann loslassen', action: 'Die Backbord-Breitseite zielen und laden, dann feuern' },
    { input: 'Steuerbord-Kanonen oder E halten, dann loslassen', action: 'Die Steuerbord-Breitseite zielen und laden, dann feuern' },
    { input: 'Prise versenken tippen', action: 'Deine neueste Prise sofort für doppelte Beute versenken' },
    {
      input: 'Im Hafen eine Karte oder Zeile tippen',
      action: 'Einen Vorteil behalten, eine Verbesserung kaufen, den Rumpf flicken, Seeleute anheuern oder eine Prise als Begleitschiff behalten',
    },
    { input: 'Backbord oder Steuerbord unter dem Hauptbuch tippen', action: 'Die Kanonen dieser Seite mit der nächsten Munition laden' },
    { input: 'Segel setzen tippen, oder ab Welle 6 eine Route', action: 'Den Hafen zur nächsten Welle verlassen: die Handelsroute oder eine Jagdpatrouille' },
    { input: 'Auf der Endtafel Tagesfahrt tippen', action: 'Die heutige Fahrt segeln: dasselbe Schiff, dieselben Vorteile und dieselbe See für alle, einmal am Tag' },
  ],
  loop: [
    'Lies den Befehl des Kapitäns und den Wind der Welle, dann steuere auf einen Feind zu.',
    'Dreh dich längsseits, halte die Feuertaste dieser Seite zum Laden und lass los, wenn der Bogen den Feind erreicht.',
    'Segle über die Beutefässer versenkter Schiffe, oder entere ein kampfunfähiges Schiff als Prise.',
    'Versenke jedes Schiff der Welle, dann läuft dein Schiff in den Hafen ein.',
    'Behalte einen von drei Vorteilen, gib dein Gold für Verbesserungen und Reparaturen aus, lade deine Munition und setze Segel.',
  ],
  tips: [
    'Längeres Halten feuert weiter und härter: eine volle Ladung von einer Sekunde erreicht die volle Reichweite und trifft 50 % härter.',
    'Jede Seite lädt für sich nach, also schwenk herum und feuere die andere Seite, während eine nachlädt.',
    'Kettenkugeln bremsen ein Schiff, und Kartätschen feuern einen Fächer, der das Nachladen bremst und die Crew tötet.',
    'Segle einen Moment längsseits eines Schiffs unter einem Fünftel seines Rumpfs, um es als Prise zu nehmen, die für dich kämpft.',
    'Auf den Sand einer Insel zu laufen kostet dich 8 Rumpf, aber Inseln bieten auch Deckung im Kampf.',
    'Das Meer hat keinen Rand: segle an einer Seite hinaus und du kommst auf der anderen wieder herein.',
    'Behalte im Hafen eine Prise als Begleitschiff, dann segelt sie gegen Heuer von Welle zu Welle mit dir.',
    'Bring auf einer Geleitwelle das Handelsschiff sicher zu seiner Insel, für seine Fracht: die Schaluppen und Brander jagen es.',
    'Medaillen aus jedem Lauf kaufen auf der Tafel „Versenkt!“ einen Vorsprung für den nächsten.',
    'Ab Welle 4 segeln benannte Kapitäne. Wer flieht, kehrt drei Wellen später stärker und mit Kopfgeld zurück: versenke alle fünf, über beliebig viele Läufe, um das Logbuch zu füllen und dauerhaft Ruhm zu erlangen.',
    'In der Sturmsee drehen Böen den Wind (die Windrose zeigt die nächste schon an), und Riffe reißen 30 aus einem Rumpf, also halte dich von den Felsen fern.',
  ],
};

export const howToPlay: HowToPlay = byLanguage({ en, 'en-US': enUS, de });
