import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: 'Destroy the enemy Town Centre (both of them in a three-way match), hold a Monument for three minutes, or finish a Wonder in Age IV. If your own Town Centre falls, you lose. The campaign has five scenarios, each with its own goal.',
  controls: [
    { input: 'Left click, or drag a box', action: 'Select units or a building; Shift adds to the selection' },
    { input: 'Right click', action: 'Gather, build, attack or walk; with buildings selected, set their rally flag (on the building, take it down)' },
    { input: 'Rally flag button', action: 'Then click where new units gather; on a tree, bush, mine, farm or camp, new villagers work there' },
    { input: 'Space, or a red marker at the edge', action: 'Jump to where you are under attack' },
    { input: 'Tap, on a touch screen', action: 'With units selected, give the right click order; tap your own unit or building to select it' },
    { input: 'A, then left click', action: 'Attack-move: walk there and fight on the way' },
    { input: 'S', action: 'Stop the selected units' },
    { input: 'B, or the bottom panel', action: 'Open the build list with villagers selected, then click a spot' },
    { input: '1 to 9 (Ctrl to save)', action: 'Select a control group, or save the selection to one' },
    { input: 'Arrow keys, screen edge or minimap', action: 'Scroll the map' },
    { input: 'Right click, with ships selected', action: 'Sail there; a transport on the shore puts its troops ashore, a warship attacks what you click' },
    { input: 'Right click your transport', action: 'Send the selected land units aboard' },
    { input: "A rival's banner, top right", action: 'In a three-way match, open talks: offer a truce, send tribute or ask it to join you' },
    { input: 'Esc', action: 'Cancel placing a building or attack-moving' },
  ],
  loop: [
    'Pick the map kind and one or two AI rivals, then a faction on the menu.',
    'Send villagers to chop wood, gather food and mine ore.',
    'Build houses for population, then train more villagers and soldiers.',
    'Research Age II at the Town Centre and pick your boon.',
    'Complete the three deeds to reach Age III, pick its edge, then march on the enemy Town Centre.',
    'In Age III, hold a relic, raise your champion and get a soldier to Veteran to reach Age IV and build a Wonder.',
  ],
  tips: [
    'Villagers carry ten at a time to the Town Centre, or to a Lumber or Mining Camp.',
    "The enemy's first raid comes no sooner than six minutes in, and a horn warns you.",
    'When your villagers, soldiers or buildings are hit out of sight, a toast says so and a red arrow at the edge points the way.',
    'Each AI is a Raider, a Builder or a Warden; scout its Town Centre to learn which.',
    'Ring the bell at the Town Centre to shelter villagers; press Back to work when the raid is over.',
    'Kill the guards at a camp to claim its cart of ore or food, or hold its relic for a bonus.',
    'Soldiers earn ranks from kills, adding health and damage.',
    'Rams break buildings and walls but cannot hurt units, so give them an escort.',
    'Each faction has its own building, shown last on the first page of the build list.',
    'Two wins with a faction master it: its card then trains a second unique unit (Torchbearer, Harpooner, Briar Warden or Horse Archer).',
    'On the Islands map, build a Harbour on the shore: transports carry eight units across, warships fight at sea and shell the shore. Shallow fords join the islands too.',
    'Diplomacy: a Raider rarely makes peace, a Warden keeps its word longest, and tribute raises any rival\'s goodwill. Attacking a rival at peace breaks the pact.',
    'The Steppe Horde packs its Yurts and camps into wagons and pitches them again near fresh trees and mines; its chieftain speeds up nearby soldiers.',
    'A Wonder wins the moment it is finished, but only four builders can work on it at once, and every rival sees it.',
    'In the campaign, each win opens the next scenario; beat its two star goals for three stars.',
  ],
};

/** US English only changes the spelling. */
const us = (text: string) => text.replace(/Town Centre/g, 'Town Center').replace(/Harbour/g, 'Harbor');
const enUS: HowToPlay = {
  goal: us(en.goal),
  controls: en.controls.map((c) => ({ input: us(c.input), action: us(c.action) })),
  loop: en.loop.map(us),
  tips: en.tips.map(us),
};

const de: HowToPlay = {
  goal: 'Zerstöre das feindliche Stadtzentrum (beide in einem Spiel zu dritt), halte ein Denkmal drei Minuten lang oder vollende in Zeitalter IV ein Weltwunder. Fällt dein eigenes Stadtzentrum, verlierst du. Der Feldzug hat fünf Szenarien mit je eigenem Ziel.',
  controls: [
    { input: 'Linksklick oder Rahmen ziehen', action: 'Einheiten oder ein Gebäude wählen; Umschalt fügt zur Auswahl hinzu' },
    { input: 'Rechtsklick', action: 'Sammeln, bauen, angreifen oder laufen; mit gewählten Gebäuden ihre Sammelflagge setzen (aufs Gebäude: einholen)' },
    { input: 'Knopf Sammelflagge', action: 'Dann klicken, wo sich neue Einheiten sammeln; auf Baum, Busch, Mine, Feld oder Lager arbeiten neue Dorfbewohner dort' },
    { input: 'Leertaste oder roter Pfeil am Rand', action: 'Dorthin springen, wo du angegriffen wirst' },
    { input: 'Tippen, auf einem Touchscreen', action: 'Mit gewählten Einheiten den Rechtsklick-Befehl geben; eigene Einheit oder eigenes Gebäude antippen, um es zu wählen' },
    { input: 'A, dann Linksklick', action: 'Angriffsmarsch: dorthin laufen und unterwegs kämpfen' },
    { input: 'S', action: 'Die gewählten Einheiten anhalten' },
    { input: 'B oder die untere Leiste', action: 'Mit gewählten Dorfbewohnern die Bauliste öffnen, dann einen Platz anklicken' },
    { input: '1 bis 9 (Strg zum Speichern)', action: 'Eine Gruppe wählen oder die Auswahl darin speichern' },
    { input: 'Pfeiltasten, Bildschirmrand oder Minikarte', action: 'Die Karte verschieben' },
    { input: 'Rechtsklick, mit gewählten Schiffen', action: 'Dorthin segeln; ein Transporter am Ufer setzt seine Truppen ab, ein Kriegsschiff greift das Angeklickte an' },
    { input: 'Rechtsklick auf deinen Transporter', action: 'Die gewählten Landeinheiten an Bord schicken' },
    { input: 'Banner eines Rivalen, oben rechts', action: 'In einem Spiel zu dritt verhandeln: Waffenruhe anbieten, Tribut schicken oder ein Bündnis erbitten' },
    { input: 'Esc', action: 'Setzen eines Gebäudes oder Angriffsmarsch abbrechen' },
  ],
  loop: [
    'Wähle im Menü die Kartenart und eine oder zwei KI-Gegner, dann ein Volk.',
    'Schick Dorfbewohner zum Holzfällen, Nahrungsammeln und Erzabbau.',
    'Baue Häuser für mehr Bevölkerung, dann bilde weitere Dorfbewohner und Soldaten aus.',
    'Erforsche Zeitalter II im Stadtzentrum und wähle deine Gabe.',
    'Vollbringe die drei Taten für Zeitalter III, wähle dessen Vorzug und zieh dann gegen das feindliche Stadtzentrum.',
    'Halte in Zeitalter III ein Relikt, bilde deinen Helden aus und bring einen Soldaten auf Altgedient, um Zeitalter IV zu erreichen und ein Weltwunder zu bauen.',
  ],
  tips: [
    'Dorfbewohner tragen je zehn zum Stadtzentrum oder zu einem Holz- oder Erzlager.',
    'Der erste feindliche Überfall kommt frühestens nach sechs Minuten, und ein Horn warnt dich.',
    'Werden deine Dorfbewohner, Soldaten oder Gebäude außer Sicht getroffen, meldet es eine Nachricht, und ein roter Pfeil am Rand zeigt die Richtung.',
    'Jede KI ist Plünderer, Baumeister oder Wächter; erkunde ihr Stadtzentrum, um es herauszufinden.',
    'Läute die Glocke im Stadtzentrum, damit Dorfbewohner Schutz suchen; drück An die Arbeit, wenn der Überfall vorbei ist.',
    'Besiege die Wachen eines Lagers, um seinen Vorrat an Erz oder Nahrung zu holen, oder halte sein Relikt für einen Bonus.',
    'Soldaten steigen durch Siege im Rang auf und gewinnen Leben und Schaden.',
    'Rammböcke zerschlagen Gebäude und Mauern, können Einheiten aber nichts tun, also gib ihnen Geleitschutz.',
    'Jedes Volk hat ein eigenes Gebäude, als letztes auf der ersten Seite der Bauliste.',
    'Zwei Siege mit einem Volk meistern es: Dann bildet es eine zweite eigene Einheit aus (Fackelträger, Harpunier, Dornwächter oder Berittener Bogenschütze).',
    'Auf der Inselkarte baust du einen Hafen am Ufer: Transporter bringen acht Einheiten hinüber, Kriegsschiffe kämpfen auf See und beschießen das Ufer. Seichte Furten verbinden die Inseln ebenfalls.',
    'Diplomatie: Ein Plünderer schließt selten Frieden, ein Wächter hält sein Wort am längsten, und Tribut hebt bei jedem Rivalen das Wohlwollen. Wer einen befriedeten Rivalen angreift, bricht den Pakt.',
    'Die Steppenhorde packt ihre Jurten und Lager auf Wagen und schlägt sie bei frischen Bäumen und Minen wieder auf; ihr Häuptling macht Soldaten in der Nähe schneller.',
    'Ein Weltwunder gewinnt, sobald es fertig ist, aber nur vier Bauleute können zugleich daran arbeiten, und jeder Rivale sieht es.',
    'Im Feldzug öffnet jeder Sieg das nächste Szenario; erfüll seine zwei Sternziele für drei Sterne.',
  ],
};

export const howToPlay: HowToPlay = byLanguage({ en, 'en-US': enUS, de });
