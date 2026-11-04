import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: 'Solve the puzzles the deck deals you, eleven kinds in all: logic, numbers, space and memory. In Endless Medley, keep going until your three hearts run out.',
  controls: [
    { input: 'Click or tap', action: 'Fill a cell, pick an island, flip or slide a tile, press a key' },
    { input: 'Drag', action: 'Slide a block (Unjam) or draw a path (Path Link)' },
    { input: 'Keys 1-9, Backspace', action: 'Write or clear a number; pick a glyph in Code Breaker' },
    { input: 'Enter', action: 'Make the guess in Code Breaker' },
    { input: 'S and D, or the arrow keys', action: 'Same or different in Memory Echo' },
    { input: 'H, U', action: 'Use a hint, undo a move' },
  ],
  loop: [
    'Pick a mode card on the menu: Journey, Endless Medley, Daily Five, Blitz, Draft Run, Weekly League, Pass and Play or Practice.',
    'Each puzzle shows its rule under its name; solve it before its clock runs out.',
    'A solved puzzle scores points for its level and the time left, more on a streak.',
    'A lost, skipped or timed-out puzzle costs a heart in Endless and Draft, or time in Blitz.',
    'Puzzles get harder every few cards. Records keeps your fastest time for each one.',
  ],
  tips: [
    'Practice any puzzle with no clock first, and its hints are free.',
    'In a Draft Run every third solve offers a relic: a hint, a heart, more time, more cards to choose from, or a charm that helps one kind of puzzle.',
    'Before your first move, tempt the omen in the top bar for double points: half the time, no undo or hints, or two hearts for a loss.',
    'Every fifth puzzle of Endless and Draft is a boss: two puzzles on one clock, for double points and a relic.',
    'The Daily Five is the same for everyone on the same day, and you get one try.',
    'Pass and Play deals both players the same three puzzles; skips and hints add time.',
    'The Journey walks five temples of eight set steps; up to three stars a step, and 12 stars in a temple open the next.',
    'The Weekly League is the same Draft Run for everyone all week: play it as often as you like, and your best score sets your rank, from Novice to Seer.',
  ],
};

const de: HowToPlay = {
  goal: 'Löse die Rätsel, die dir das Deck austeilt, elf Arten insgesamt: Logik, Zahlen, Raum und Gedächtnis. In der Endlosen Mischung spielst du weiter, bis deine drei Herzen verbraucht sind.',
  controls: [
    { input: 'Klicken oder tippen', action: 'Ein Feld füllen, eine Insel wählen, ein Licht drehen oder ein Feld schieben, eine Taste drücken' },
    { input: 'Ziehen', action: 'Einen Block schieben (Freischieben) oder einen Pfad zeichnen (Pfadfinder)' },
    { input: 'Tasten 1-9, Rücktaste', action: 'Eine Zahl schreiben oder löschen; im Codeknacker ein Zeichen wählen' },
    { input: 'Eingabe', action: 'Im Codeknacker raten' },
    { input: 'S und D oder die Pfeiltasten', action: 'Gleich oder anders im Gedächtnisecho' },
    { input: 'H, U', action: 'Einen Tipp nutzen, einen Zug zurücknehmen' },
  ],
  loop: [
    'Wähle im Menü eine Modus-Karte: Reise, Endlose Mischung, Tagesfünf, Blitz, Kartenwahl, Wochenliga, Weitergeben oder Üben.',
    'Jedes Rätsel zeigt seine Regel unter seinem Namen; löse es, bevor seine Uhr abläuft.',
    'Ein gelöstes Rätsel bringt Punkte für seine Stufe und die übrige Zeit, mehr in einer Serie.',
    'Ein verlorenes, übersprungenes oder abgelaufenes Rätsel kostet ein Herz in Endlos und Kartenwahl oder Zeit im Blitz.',
    'Alle paar Karten werden die Rätsel schwerer. Die Bestwerte halten deine schnellste Zeit für jedes fest.',
  ],
  tips: [
    'Übe jedes Rätsel zuerst ohne Uhr, dort sind die Tipps frei.',
    'In der Kartenwahl bietet jedes dritte gelöste Rätsel ein Relikt: einen Tipp, ein Herz, mehr Zeit, mehr Karten zur Wahl oder einen Talisman, der einer Rätselart hilft.',
    'Wage vor deinem ersten Zug das Omen oben für doppelte Punkte: halbe Zeit, kein Zurücknehmen und keine Tipps, oder zwei Herzen für einen Verlust.',
    'Jedes fünfte Rätsel in der Endlosen Mischung und der Kartenwahl ist ein Boss: zwei Rätsel auf einer Uhr, für doppelte Punkte und ein Relikt.',
    'Die Tagesfünf ist am selben Tag für alle gleich, und du hast einen Versuch.',
    'Beim Weitergeben bekommen beide Spieler dieselben drei Rätsel; Überspringen und Tipps kosten Zeit.',
    'Die Reise führt durch fünf Tempel mit je acht festen Schritten; bis zu drei Sterne pro Schritt, und 12 Sterne in einem Tempel öffnen den nächsten.',
    'Die Wochenliga ist die ganze Woche dieselbe Kartenwahl für alle: Spiel sie so oft du willst, dein bester Punktestand bestimmt deinen Rang, vom Novizen bis zum Seher.',
  ],
};

export const howToPlay = byLanguage({ en, 'en-US': en, de });
