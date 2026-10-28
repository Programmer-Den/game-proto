import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: 'Fill the board so every row, column and box holds each digit once. In Delve, clear floor after floor before your hearts run out.',
  controls: [
    { input: 'Click or tap a cell, or the arrow keys', action: 'Pick a cell' },
    { input: 'Number pad or keys 1-9', action: 'Write that digit in the picked cell' },
    { input: 'Notes or N', action: 'Switch to pencil marks: digits then toggle small notes' },
    { input: 'Erase or Backspace', action: 'Clear a wrong digit, or an empty cell\'s notes' },
    { input: 'Undo, U or Z', action: 'Take back the latest note, wrong digit or erase' },
    { input: 'Hint or H', action: 'Fill in the picked cell (or the first open one)' },
    { input: 'Menu', action: 'Leave the board for the menu' },
  ],
  loop: [
    'Pick the daily puzzle, a Classic level or a Delve run.',
    'Pick a cell and write a digit; a right one stays, a wrong one shows in red and counts a mistake.',
    'Finish every row, column and box to solve the board.',
    'In Delve a mistake costs a heart; a cleared floor offers three relics, and the next floor is bigger.',
    'Solved boards unlock new art styles under Styles.',
  ],
  tips: [
    'Picking a digit highlights every place it already stands, and the pad shows how many of each are left.',
    'Delve starts on a 4×4 board, then 6×6, then 9×9 floors with fewer and fewer givens.',
    'From floor 4 each Delve floor has a twist (Diagonal, Parity, Clock or Sealed), and every 5th is a boss floor with two; beating one restores your hearts.',
    'The daily puzzle is the same for everyone on the same day; solve it on days in a row for a daily streak.',
    'A board in play is saved as you go, so you can close the page and carry on later.',
    'Hard puzzles, flawless solves and fast solves each unlock a style of their own.',
  ],
};

const de: HowToPlay = {
  goal: 'Fülle das Feld so, dass jede Zeile, Spalte und jedes Kästchen jede Ziffer genau einmal enthält. Im Abstieg schaffst du Ebene um Ebene, bevor dir die Herzen ausgehen.',
  controls: [
    { input: 'Feld klicken oder antippen, oder Pfeiltasten', action: 'Ein Feld wählen' },
    { input: 'Ziffernfeld oder Tasten 1-9', action: 'Die Ziffer ins gewählte Feld schreiben' },
    { input: 'Notizen oder N', action: 'Zu Bleistiftnotizen wechseln: Ziffern setzen dann kleine Notizen' },
    { input: 'Löschen oder Rücktaste', action: 'Eine falsche Ziffer oder die Notizen einer leeren Zelle löschen' },
    { input: 'Zurück, U oder Z', action: 'Die letzte Notiz, falsche Ziffer oder Löschung zurücknehmen' },
    { input: 'Tipp oder H', action: 'Das gewählte (oder erste offene) Feld ausfüllen' },
    { input: 'Menü', action: 'Das Rätsel verlassen und zum Menü gehen' },
  ],
  loop: [
    'Wähle das Tagesrätsel, eine klassische Stufe oder einen Abstieg.',
    'Wähle ein Feld und schreibe eine Ziffer; eine richtige bleibt, eine falsche wird rot und zählt als Fehler.',
    'Vervollständige jede Zeile, Spalte und jedes Kästchen, um das Rätsel zu lösen.',
    'Im Abstieg kostet ein Fehler ein Herz; eine geschaffte Ebene bietet drei Relikte, und die nächste ist größer.',
    'Gelöste Rätsel schalten unter Stile neue Grafikstile frei.',
  ],
  tips: [
    'Eine gewählte Ziffer leuchtet überall dort auf, wo sie schon steht, und das Ziffernfeld zeigt, wie viele noch fehlen.',
    'Der Abstieg beginnt auf einem 4×4-Feld, dann 6×6, dann 9×9-Ebenen mit immer weniger Vorgaben.',
    'Ab Ebene 4 hat jede Ebene eine Wendung (Diagonale, Gerade, Uhr oder Versiegelt), und jede 5. ist eine Bossebene mit zweien; wer sie schafft, bekommt alle Herzen zurück.',
    'Das Tagesrätsel ist am selben Tag für alle gleich; löse es an aufeinanderfolgenden Tagen für eine Tagesserie.',
    'Ein laufendes Rätsel wird laufend gespeichert, du kannst die Seite schließen und später weitermachen.',
    'Schwere Rätsel, fehlerfreie und schnelle Lösungen schalten jeweils einen eigenen Stil frei.',
  ],
};

export const howToPlay = byLanguage({ en, 'en-US': en, de });
