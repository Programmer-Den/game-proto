import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: 'Explore Mossford, the woods and the fen by lamplight, beat what grows the thorns, then find what rings the bell under the fen. Moonstones are hidden everywhere; how many you find changes the ending.',
  controls: [
    { input: 'WASD or arrow keys', action: 'Walk' },
    { input: 'Click or tap the ground', action: 'Walk there' },
    { input: 'Touch: put a finger down anywhere and drag', action: 'A steering stick appears under it; walk the way you drag' },
    { input: 'Click or tap a person, chest, sign or foe', action: 'Walk over and talk, open, read or attack' },
    { input: 'Space, J or the sword button', action: 'Talk to or open what is in front, else swing the sword' },
    { input: 'Shift, K or the roll button', action: 'Roll out of the way; nothing hits you mid-roll' },
    { input: 'Q, L or the vine button', action: 'Throw the hookvine (once found): pulls you to golden posts' },
    { input: 'B, X or the seed button', action: 'Plant a bellseed (once given): it bursts, breaking boulders and cracked walls' },
    { input: 'Space or a tap', action: 'Read on while someone is talking' },
    { input: 'N or a tap on the moonstone counter', action: 'Open the moonstone page: what each place still hides' },
  ],
  loop: [
    'Talk to Elder Wren in the square: she sends you for the old blade.',
    'Open the chest by the shed to take the blade, then bring it back to her.',
    'Cut the thorns at the north gate and head into Bramble Woods.',
    'Find the Sunken Shrine, its key, its puzzle and the tool hidden inside.',
    'Face the Thornmother: pull her glowing bulbs down with the hookvine, then strike them.',
    'Chapter two: ask about the bell in the night, get bellseeds from the fen hermit and find the Drowned Belfry.',
    'After the end: turn the hourglass by each dungeon door to race it again, its foes back and its boss stronger, for your best time.',
  ],
  tips: [
    'Your journal line, top right, always says what to do next.',
    'Swing at bushes: some hide moonstones, some drop hearts or coins.',
    'Spend coins on upgrades: Marla sells a pie and boots, Old Sedge a bigger pouch and a longer vine.',
    'People drop hints. Listen to the baker, Pip and the hermit, and read the signs.',
    'Step back from a planted bellseed: its burst hurts you too.',
    'Shelled beetles and lantern moths shrug off the sword: knock them down with the hookvine or a bellseed first.',
    'Fall in a fight and you wake where you last came in, healed.',
    'Your progress saves whenever you change place.',
  ],
};

const de: HowToPlay = {
  goal: 'Erkunde Moosfurt, den Wald und das Moor im Laternenlicht, besiege, was die Dornen wachsen lässt, und finde dann, was die Glocke unter dem Moor läutet. Überall sind Mondsteine versteckt; wie viele du findest, ändert das Ende.',
  controls: [
    { input: 'WASD oder Pfeiltasten', action: 'Gehen' },
    { input: 'Den Boden anklicken oder antippen', action: 'Dorthin gehen' },
    { input: 'Touch: einen Finger irgendwo aufsetzen und ziehen', action: 'Darunter erscheint ein Steuerknüppel; du gehst in die Zugrichtung' },
    { input: 'Eine Person, Truhe, ein Schild oder einen Feind anklicken oder antippen', action: 'Hingehen und reden, öffnen, lesen oder angreifen' },
    { input: 'Leertaste, J oder die Schwerttaste', action: 'Mit dem Gegenüber reden oder es öffnen, sonst das Schwert schwingen' },
    { input: 'Umschalt, K oder die Rolltaste', action: 'Ausweichen; mitten in der Rolle trifft dich nichts' },
    { input: 'Q, L oder die Rankentaste', action: 'Die Hakenranke werfen (sobald gefunden): zieht dich zu goldenen Pfosten' },
    { input: 'B, X oder die Samentaste', action: 'Einen Glockensamen pflanzen (sobald erhalten): er platzt und bricht Felsbrocken und rissige Wände' },
    { input: 'Leertaste oder Tippen', action: 'Weiterlesen, während jemand spricht' },
    { input: 'N oder Tippen auf den Mondsteinzähler', action: 'Die Mondsteinseite öffnen: was jeder Ort noch verbirgt' },
  ],
  loop: [
    'Sprich mit der Ältesten Wren auf dem Platz: Sie schickt dich nach der alten Klinge.',
    'Öffne die Truhe am Schuppen, nimm die Klinge und bring sie ihr.',
    'Schneide die Dornen am Nordtor weg und zieh in den Brombeerwald.',
    'Finde den Versunkenen Schrein, seinen Schlüssel, sein Rätsel und das Werkzeug darin.',
    'Stell dich der Dornenmutter: Zieh ihre leuchtenden Knollen mit der Hakenranke herunter und schlag dann zu.',
    'Kapitel zwei: Frag nach der Glocke in der Nacht, hol dir Glockensamen vom Einsiedler im Moor und finde den Ertrunkenen Glockenturm.',
    'Nach dem Ende: Dreh die Sanduhr an jeder Verliestür und lauf es noch einmal, mit seinen Feinden zurück und seinem Herrn stärker, auf Bestzeit.',
  ],
  tips: [
    'Deine Tagebuchzeile oben rechts sagt immer, was als Nächstes zu tun ist.',
    'Schlag nach Büschen: Manche verstecken Mondsteine, manche lassen Herzen oder Münzen fallen.',
    'Gib Münzen für Verbesserungen aus: Marla verkauft eine Pastete und Stiefel, der alte Sedge einen größeren Beutel und eine längere Ranke.',
    'Die Leute geben Hinweise. Hör der Bäckerin, Pip und dem Einsiedler zu und lies die Schilder.',
    'Tritt von einem gepflanzten Glockensamen zurück: Sein Platzen trifft auch dich.',
    'Panzerkäfer und Laternenmotten trotzen dem Schwert: Wirf sie erst mit der Hakenranke oder einem Glockensamen um.',
    'Fällst du im Kampf, erwachst du geheilt dort, wo du zuletzt hereingekommen bist.',
    'Dein Fortschritt wird bei jedem Ortswechsel gespeichert.',
  ],
};

export const howToPlay: HowToPlay = byLanguage({ en, de });
