import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: 'Lead one of five factions, build a fleet and destroy all four rival hubs. If your own hub falls, you lose.',
  controls: [
    { input: 'Tap a faction card', action: 'Pick the faction you command before the battle' },
    { input: 'Tap an open sector under the cards', action: 'Pick the campaign sector to fight in' },
    { input: 'The Galaxy, Scenarios and Tech tabs', action: 'Conquer a star map, play a hand-made scenario, or spend salvage on lasting tech' },
    { input: 'Tap a card on the contract board', action: 'Take that contract as your next goal' },
    { input: 'Tap a ship, or drag a box over ships', action: 'Select your combat ships' },
    { input: 'The army count on the top bar, or Q', action: 'Select every warship you have' },
    { input: 'Tap empty space or an enemy', action: 'Move the selected ships there, or attack that target' },
    { input: 'Build button, then tap the map', action: 'Place a building near one of your hubs' },
    { input: 'Train and research buttons', action: 'Queue ships at your Barracks or hub, or research upgrades' },
    { input: 'Fall back button, or B', action: 'Send the selected ships home to repair' },
    { input: 'Rally point button, or R, then tap the map', action: 'Plant the spot new warships fly to; tap the flag again to take it down' },
    { input: 'Space, or the arrow on the map edge', action: 'Jump to the latest attack on your ships or base' },
    { input: 'Flagship button', action: 'Build your one flagship at the hub, once three contracts are done' },
    { input: 'Rivals on the top bar, or T', action: 'Open the rivals panel to accept truces or pay tribute' },
    { input: 'Arrow keys / WASD, or drag with two fingers', action: 'Scroll the map' },
    { input: 'Tap or drag on the minimap', action: 'Move the view there' },
    { input: 'H', action: 'Centre the map on your hub' },
  ],
  loop: [
    'Your harvesters mine crystal on their own and carry it back to your hub.',
    'Spend crystal on a Barracks to finish the first contract.',
    'Train warships at your Barracks and select them as a wing.',
    'Send scouts into the fog to find the relay beacon and hold it for crystal.',
    'Destroy enemy ships for salvage, then push into the rival bases.',
  ],
  tips: [
    'After the first contract, the board offers two at a time: tap one, or the first is taken after 15 s. Each pays crystal and a rank perk for the rest of the battle.',
    'The third contract done unlocks a flagship: a slow capital ship with a stronger faction ability. Lose it and it is gone for the battle.',
    'When only two rivals are left, or you hold over a third of the hubs, they sign a pact and raid you together on a countdown.',
    'Each victory opens the next, harder campaign sector and lets you keep one perk from that battle for the sectors after it.',
    'In galaxy conquest each battle won takes a rival sector beside yours; a battle lost costs you a sector beside it. Hold all twelve to win the galaxy.',
    'Salvage you collect is banked when a battle ends. On the Tech tab it buys lasting tech for one faction, which every later battle with it starts with.',
    'Scenarios are hand-made maps with goals of their own: escort a carrier to its dock, hold out for ten minutes, or win the race for the relay beacon.',
    'A warship alone on the relay beacon takes it, and the owner earns 3 crystal a second while one stays there.',
    'Every enemy ship you destroy drops a gold shard worth 8 crystal.',
    'Ships inside a nebula fly slower but stay hidden until they fire or an enemy comes close.',
    'A ship with 3 kills becomes a Veteran and with 8 an Ace, hitting harder each time.',
    'Ships repair slowly beside a hub, outpost or Depot.',
    'Rivals hold off for about a minute and a quarter, then attack whoever last hit them.',
  ],
};

/** US English only changes the spelling. */
const enUS: HowToPlay = {
  goal: en.goal,
  controls: en.controls.map((c) => ({ input: c.input, action: c.action.replace(/Centre/g, 'Center') })),
  loop: en.loop,
  tips: en.tips,
};

const de: HowToPlay = {
  goal: 'Führe eine von fünf Fraktionen, baue eine Flotte und zerstöre alle vier rivalisierenden Basen. Fällt deine eigene Basis, verlierst du.',
  controls: [
    { input: 'Eine Fraktionskarte antippen', action: 'Vor der Schlacht die Fraktion wählen, die du führst' },
    { input: 'Einen offenen Sektor unter den Karten antippen', action: 'Den Feldzugssektor wählen, in dem du kämpfst' },
    { input: 'Die Reiter Galaxis, Szenarien und Technik', action: 'Eine Sternkarte erobern, ein Szenario spielen oder Bergegut für bleibende Technik ausgeben' },
    { input: 'Eine Karte auf dem Vertragsbrett antippen', action: 'Diesen Vertrag als nächstes Ziel annehmen' },
    { input: 'Ein Schiff antippen oder einen Rahmen über Schiffe ziehen', action: 'Deine Kampfschiffe wählen' },
    { input: 'Die Flottenzahl in der oberen Leiste oder Q', action: 'Alle deine Kriegsschiffe wählen' },
    { input: 'Freien Raum oder einen Feind antippen', action: 'Die gewählten Schiffe dorthin fliegen lassen oder das Ziel angreifen' },
    { input: 'Bau-Taste, dann auf die Karte tippen', action: 'Ein Gebäude nahe einer deiner Basen setzen' },
    { input: 'Bau- und Forschungstasten', action: 'Schiffe an Kaserne oder Basis einreihen oder Verbesserungen erforschen' },
    { input: 'Rückzug-Taste oder B', action: 'Die gewählten Schiffe zur Reparatur heimschicken' },
    { input: 'Sammelpunkt-Taste oder R, dann auf die Karte tippen', action: 'Den Ort setzen, zu dem neue Kriegsschiffe fliegen; ein Tipp auf die Flagge entfernt ihn' },
    { input: 'Leertaste oder der Pfeil am Kartenrand', action: 'Zum letzten Angriff auf deine Schiffe oder Basis springen' },
    { input: 'Flaggschiff-Taste', action: 'Dein einziges Flaggschiff an der Basis bauen, sobald drei Verträge erfüllt sind' },
    { input: 'Rivalen in der oberen Leiste oder T', action: 'Die Rivalenliste öffnen, um Waffenruhen anzunehmen oder Tribut zu zahlen' },
    { input: 'Pfeiltasten / WASD oder mit zwei Fingern ziehen', action: 'Die Karte verschieben' },
    { input: 'Auf die Minikarte tippen oder darauf ziehen', action: 'Die Ansicht dorthin bewegen' },
    { input: 'H', action: 'Die Karte auf deine Basis zentrieren' },
  ],
  loop: [
    'Deine Sammler bauen von selbst Kristall ab und bringen es zu deiner Basis.',
    'Gib Kristall für eine Kaserne aus, um den ersten Vertrag zu erfüllen.',
    'Baue Kriegsschiffe an deiner Kaserne und wähle sie als Staffel.',
    'Schicke Späher ins Unerkundete, um das Relaisfeuer zu finden, und halte es für Kristall.',
    'Zerstöre feindliche Schiffe für Bergegut und stoße dann in die rivalisierenden Basen vor.',
  ],
  tips: [
    'Nach dem ersten Vertrag bietet das Brett immer zwei an: tippe einen an, sonst gilt nach 15 s der erste. Jeder bringt Kristall und einen Rangbonus für den Rest der Schlacht.',
    'Der dritte erfüllte Vertrag schaltet ein Flaggschiff frei: ein langsames Großkampfschiff mit einer stärkeren Fraktionsfähigkeit. Geht es verloren, ist es für die Schlacht weg.',
    'Sind nur noch zwei Rivalen übrig oder hältst du mehr als ein Drittel der Basen, schließen sie einen Pakt und greifen dich nach einem Countdown gemeinsam an.',
    'Jeder Sieg öffnet den nächsten, schwereren Feldzugssektor und lässt dich einen Bonus aus dieser Schlacht für die folgenden Sektoren behalten.',
    'Beim Galaxis-Erobern nimmt jede gewonnene Schlacht einen Rivalensektor neben deinen; eine verlorene kostet dich einen Sektor daneben. Halte alle zwölf, um die Galaxis zu gewinnen.',
    'Gesammeltes Bergegut wird am Ende einer Schlacht eingelagert. Im Reiter Technik kauft es bleibende Technik für eine Fraktion, mit der jede spätere Schlacht mit ihr beginnt.',
    'Szenarien sind handgebaute Karten mit eigenen Zielen: einen Träger zum Dock geleiten, zehn Minuten durchhalten oder das Rennen um die Relaisbake gewinnen.',
    'Ein Kriegsschiff allein am Relaisfeuer erobert es, und der Besitzer verdient 3 Kristall pro Sekunde, solange eins dort bleibt.',
    'Jedes zerstörte feindliche Schiff lässt einen goldenen Splitter im Wert von 8 Kristall fallen.',
    'Schiffe in einem Nebel fliegen langsamer, bleiben aber verborgen, bis sie feuern oder ein Feind nahe kommt.',
    'Ein Schiff mit 3 Abschüssen wird Veteran, mit 8 ein Ass, und trifft jedes Mal härter.',
    'Schiffe reparieren sich langsam neben einer Basis, einem Außenposten oder Lager.',
    'Rivalen halten sich etwa eineinviertel Minuten zurück und greifen dann den an, der sie zuletzt getroffen hat.',
  ],
};

export const howToPlay: HowToPlay = byLanguage({ en, 'en-US': enUS, de });
