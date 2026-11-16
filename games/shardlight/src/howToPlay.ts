import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: 'Restore the old chapel windows: keep the lantern orb bouncing off your brass bar and break every dull pane, until the light shines through the picture behind.',
  controls: [
    { input: 'Move the mouse, or drag along the screen', action: 'Move the bar' },
    { input: 'A / D or ← / →', action: 'Move the bar' },
    { input: 'Click, tap or Space', action: 'Launch the orb, or let a caught one go' },
    { input: 'Escape', action: 'Leave the window for the map' },
    { input: 'Map: tap a window', action: 'Play it; each restored window opens the next' },
  ],
  loop: [
    'Pick the next window on the map.',
    'Launch the orb and keep it off the floor with the bar.',
    'Break every pane but the lead ones. Catch the beads that fall for help.',
    'Restore the window to earn stars and lead, then spend the lead in the workshop.',
  ],
  tips: [
    'Where the orb hits the bar sets where it goes: the middle sends it straight up, the ends send it off to the side.',
    'Thick panes take two hits, and lead panes only break to a fire orb. The heart of a rose window takes three.',
    'Good beads: wide bar, three orbs, sticky bar, fire orb, slow orb and an extra orb. Watch out for the dark ones, which shorten the bar or speed the orb up.',
    'Breaking many panes before the orb comes back to the bar builds a chain, worth more points with each pane.',
    'Lose no orb for three stars. A daily window, the same for everyone, opens once a day.',
  ],
};

const de: HowToPlay = {
  goal: 'Erneuere die alten Kapellenfenster: Lass die Laternenkugel von deiner Messingleiste abprallen und zerbrich jede trübe Scheibe, bis das Licht durch das Bild dahinter scheint.',
  controls: [
    { input: 'Maus bewegen oder über den Bildschirm ziehen', action: 'Die Leiste bewegen' },
    { input: 'A / D oder ← / →', action: 'Die Leiste bewegen' },
    { input: 'Klicken, tippen oder Leertaste', action: 'Die Kugel loschicken oder eine gefangene loslassen' },
    { input: 'Escape', action: 'Das Fenster verlassen und zur Karte gehen' },
    { input: 'Karte: ein Fenster antippen', action: 'Es spielen; jedes erneuerte Fenster öffnet das nächste' },
  ],
  loop: [
    'Wähle auf der Karte das nächste Fenster.',
    'Schick die Kugel los und halte sie mit der Leiste vom Boden fern.',
    'Zerbrich jede Scheibe außer den bleiernen. Fange die fallenden Perlen, sie helfen dir.',
    'Erneuere das Fenster für Sterne und Blei, und gib das Blei in der Werkstatt aus.',
  ],
  tips: [
    'Wo die Kugel die Leiste trifft, bestimmt ihre Richtung: Die Mitte schickt sie gerade nach oben, die Enden zur Seite.',
    'Dicke Scheiben brauchen zwei Treffer, bleierne zerbrechen nur an einer Feuerkugel. Das Herz einer Rosette braucht drei.',
    'Gute Perlen: breite Leiste, drei Kugeln, klebrige Leiste, Feuerkugel, langsame Kugel und eine Extrakugel. Vorsicht vor den dunklen, sie kürzen die Leiste oder machen die Kugel schneller.',
    'Viele Scheiben, bevor die Kugel zur Leiste zurückkommt, bilden eine Kette, die mit jeder Scheibe mehr Punkte bringt.',
    'Verliere keine Kugel für drei Sterne. Ein Tagesfenster, für alle gleich, öffnet sich einmal am Tag.',
  ],
};

export const howToPlay = byLanguage({ en, de });
