import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: 'Solve the puzzles the deck deals you, nine kinds in all: logic, numbers, space and memory. In Endless Medley, keep going until your three hearts run out.',
  controls: [
    { input: 'Click or tap', action: 'Fill a cell, pick an island, flip a tile, press a key' },
    { input: 'Drag', action: 'Slide a block (Unjam) or draw a path (Path Link)' },
    { input: 'Keys 1-9, Backspace', action: 'Write or clear a number; pick a glyph in Code Breaker' },
    { input: 'Enter', action: 'Make the guess in Code Breaker' },
    { input: 'S and D, or the arrow keys', action: 'Same or different in Memory Echo' },
    { input: 'H, U', action: 'Use a hint, undo a move' },
  ],
  loop: [
    'Pick a mode card on the menu: Endless Medley, Daily Five, Blitz, Draft Run, Pass and Play or Practice.',
    'Each puzzle shows its rule under its name; solve it before its clock runs out.',
    'A solved puzzle scores points for its level and the time left, more on a streak.',
    'A lost, skipped or timed-out puzzle costs a heart in Endless and Draft, or time in Blitz.',
    'Puzzles get harder every few cards. Records keeps your fastest time for each one.',
  ],
  tips: [
    'Practice any puzzle with no clock first, and its hints are free.',
    'In a Draft Run every third solve offers a relic: a hint, a heart, more time, more cards to choose from, or a charm that helps one kind of puzzle.',
    'The Daily Five is the same for everyone on the same day, and you get one try.',
    'Pass and Play deals both players the same three puzzles; skips and hints add time.',
  ],
};

const de: HowToPlay = {
  goal: 'Löse die Rätsel, die dir das Deck austeilt, neun Arten insgesamt: Logik, Zahlen, Raum und Gedächtnis. In der Endlosen Mischung spielst du weiter, bis deine drei Herzen verbraucht sind.',
  controls: [
    { input: 'Klicken oder tippen', action: 'Ein Feld füllen, eine Insel wählen, ein Licht drehen, eine Taste drücken' },
    { input: 'Ziehen', action: 'Einen Block schieben (Freischieben) oder einen Pfad zeichnen (Pfadfinder)' },
    { input: 'Tasten 1-9, Rücktaste', action: 'Eine Zahl schreiben oder löschen; im Codeknacker ein Zeichen wählen' },
    { input: 'Eingabe', action: 'Im Codeknacker raten' },
    { input: 'S und D oder die Pfeiltasten', action: 'Gleich oder anders im Gedächtnisecho' },
    { input: 'H, U', action: 'Einen Tipp nutzen, einen Zug zurücknehmen' },
  ],
  loop: [
    'Wähle im Menü eine Modus-Karte: Endlose Mischung, Tagesfünf, Blitz, Kartenwahl, Weitergeben oder Üben.',
    'Jedes Rätsel zeigt seine Regel unter seinem Namen; löse es, bevor seine Uhr abläuft.',
    'Ein gelöstes Rätsel bringt Punkte für seine Stufe und die übrige Zeit, mehr in einer Serie.',
    'Ein verlorenes, übersprungenes oder abgelaufenes Rätsel kostet ein Herz in Endlos und Kartenwahl oder Zeit im Blitz.',
    'Alle paar Karten werden die Rätsel schwerer. Die Bestwerte halten deine schnellste Zeit für jedes fest.',
  ],
  tips: [
    'Übe jedes Rätsel zuerst ohne Uhr, dort sind die Tipps frei.',
    'In der Kartenwahl bietet jedes dritte gelöste Rätsel ein Relikt: einen Tipp, ein Herz, mehr Zeit, mehr Karten zur Wahl oder einen Talisman, der einer Rätselart hilft.',
    'Die Tagesfünf ist am selben Tag für alle gleich, und du hast einen Versuch.',
    'Beim Weitergeben bekommen beide Spieler dieselben drei Rätsel; Überspringen und Tipps kosten Zeit.',
  ],
};

export const howToPlay = byLanguage({ en, 'en-US': en, de });
