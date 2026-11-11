import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: 'Knock out every mole of the other team. Blasts hurt and throw moles about, digging the ground away; a mole that falls into the water is out.',
  controls: [
    { input: 'Drag back from your mole, let go', action: 'Aim and set the power like a slingshot, then fire' },
    { input: '← → or A D, the ◀ ▶ buttons, or tap the ground', action: 'Walk' },
    { input: '↑ ↓ or W S', action: 'Raise or lower your aim' },
    { input: 'Hold and release Space', action: 'Charge the power and fire' },
    { input: 'Enter, the ⤴ button / Backspace', action: 'Jump forwards / flip backwards' },
    { input: 'Weapon button, Tab or Q E', action: 'Open the arsenal / pick the next or previous weapon' },
    { input: 'Tap the map', action: 'Aim Balloon Drop, Storm Bolt and Tunnel Hop' },
  ],
  loop: [
    'Each turn one mole of your team gets 30 seconds: walk, aim and use one weapon.',
    'Watch the wind at the top: it pushes rockets and the Balloon Drop, but not thrown things.',
    'After you fire you have 3 seconds to scramble away from your own blast.',
    'Then the other team’s next mole takes its turn.',
    'The Campaign is eight battles against rival burrows, each with its own habit. Win one to open the next, and earn up to three stars: the win, a quick win and losing no mole.',
    'The Daily range is one try a day, the same for everyone: five shots at four straw moles. Every point of damage counts, and each one knocked out adds 25.',
    'Campaign battles pay acorns. Spend them at the Quartermaster on helmets, longer turns, extra weapons, more crates and a new recruit.',
  ],
  tips: [
    'There are 26 weapons in five groups: rockets, throwing weapons, strikes, close moves and tools.',
    'Acorn Rockets, Pebble Grenades, Paw Swipes and Burrow never run out; the rest come in small numbers.',
    'Crates float down between turns: walk into one for a weapon, or to heal with a green-cross crate.',
    'Moles are diggers: Burrow and the Drill Rocket reach moles hiding in caves.',
    'Powder kegs go off when a blast or a flame reaches them: hit one next to an enemy for a second bang.',
    'From turn 24 the water rises a little every turn.',
    'On Easy you see the whole flight path while aiming, on Normal its start, on Hard none.',
  ],
};

const de: HowToPlay = {
  goal: 'Schalte jeden Maulwurf des anderen Teams aus. Explosionen verletzen und schleudern Maulwürfe herum und graben den Boden weg; wer ins Wasser fällt, ist raus.',
  controls: [
    { input: 'Von deinem Maulwurf wegziehen, loslassen', action: 'Wie mit einer Schleuder zielen und die Stärke wählen, dann feuern' },
    { input: '← → oder A D, die Knöpfe ◀ ▶ oder auf den Boden tippen', action: 'Laufen' },
    { input: '↑ ↓ oder W S', action: 'Höher oder tiefer zielen' },
    { input: 'Leertaste halten und loslassen', action: 'Kraft aufladen und feuern' },
    { input: 'Enter, der Knopf ⤴ / Rücktaste', action: 'Nach vorn springen / Rückwärtssalto' },
    { input: 'Waffenknopf, Tab oder Q E', action: 'Waffenkammer öffnen / nächste oder vorige Waffe' },
    { input: 'Auf die Karte tippen', action: 'Ballonabwurf, Sturmblitz und Tunnelsprung zielen' },
  ],
  loop: [
    'In jeder Runde hat ein Maulwurf deines Teams 30 Sekunden: laufen, zielen und eine Waffe einsetzen.',
    'Achte oben auf den Wind: Er treibt Raketen und den Ballonabwurf ab, aber keine Wurfwaffen.',
    'Nach dem Schuss hast du 3 Sekunden, um vor deiner eigenen Explosion zu fliehen.',
    'Dann ist der nächste Maulwurf des anderen Teams dran.',
    'Der Feldzug sind acht Schlachten gegen rivalisierende Baue, jeder mit seiner Eigenart. Gewinne eine, um die nächste zu öffnen, und hol bis zu drei Sterne: den Sieg, einen schnellen Sieg und keinen verlorenen Maulwurf.',
    'Das Tagesziel ist ein Versuch am Tag, für alle gleich: fünf Schüsse auf vier Strohmaulwürfe. Jeder Schadenspunkt zählt, und jeder umgeworfene bringt 25 dazu.',
    'Schlachten im Feldzug bringen Eicheln. Gib sie beim Quartiermeister für Helme, längere Züge, Extrawaffen, mehr Kisten und einen neuen Rekruten aus.',
  ],
  tips: [
    'Es gibt 26 Waffen in fünf Gruppen: Raketen, Wurfwaffen, Angriffe, Nahkampf und Werkzeuge.',
    'Eichelraketen, Kieselgranaten, Pfotenhiebe und Graben gehen nie aus; der Rest kommt in kleiner Zahl.',
    'Zwischen den Runden schweben Kisten herab: Lauf hinein für eine Waffe oder, bei einer Kiste mit grünem Kreuz, zum Heilen.',
    'Maulwürfe sind Gräber: Graben und die Bohrrakete erreichen Maulwürfe in Höhlen.',
    'Pulverfässer gehen hoch, wenn eine Explosion oder eine Flamme sie erreicht: Triff eins neben einem Gegner für einen zweiten Knall.',
    'Ab Runde 24 steigt das Wasser jede Runde ein Stück.',
    'Auf Leicht siehst du beim Zielen die ganze Flugbahn, auf Normal ihren Anfang, auf Schwer keine.',
  ],
};

export const howToPlay = byLanguage({ en, 'en-US': en, de });
