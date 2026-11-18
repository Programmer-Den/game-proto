import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: 'Checkmate the other king with your army of living statues: trap it so it is attacked and has no safe square left. Every capture breaks a statue in its own way.',
  controls: [
    { input: 'Click or tap one of your statues', action: 'Pick it up and show where it can go' },
    { input: 'Click or tap a marked square', action: 'Move there; a ring marks a statue you can take' },
    { input: 'Escape', action: 'Put the picked statue down again' },
    { input: 'Undo button, U', action: 'Take back your last move (and the Stone AI’s reply) while the game is on' },
    { input: 'Captures button, Q', action: 'Switch between full capture scenes and quick ones' },
    { input: 'Capture gallery (menu)', action: 'Watch any of the 30 capture pairs whenever you like' },
    { input: 'Hint button (puzzles)', action: 'Mark the statue the solution moves next' },
    { input: 'Review button, ← and →', action: 'After a game, step through it with each move marked' },
  ],
  loop: [
    'Pick Play White, Play Black, Two players, a rival sculptor or a statue puzzle on the menu.',
    'Move a statue: tap it, then tap one of the marked squares.',
    'Take an enemy statue by moving onto it: the attacker strikes and the victim breaks apart.',
    'The Stone AI answers with its own move.',
    'Keep your king safe, and checkmate theirs to win.',
  ],
  tips: [
    'Each kind of statue has its own blow (a sword chop, a hoof stomp, a staff blast, a body slam, a rune beam, a sceptre smite) and its own way of breaking.',
    'Eight pairs have a scene of their own, like a pawn toppling a queen or two knights jousting: the gallery marks them with a star.',
    'A pawn on the far row becomes a queen, rook, bishop or knight of your choice.',
    'Castle by moving your king two squares towards a rook that has not moved yet.',
    'Pick the Stone AI’s level with the arrows on the menu, from Beginner to Grandmaster. The first three are open; beat a level to unlock the next.',
    'A game is saved after every move, so Continue on the menu picks it up again.',
    'Rival sculptors are eight opponents with styles of their own; the first ones start without a knight or two. Beat one to meet the next, and watch their favourite statue break.',
    'Statue puzzles are mate in one, two or three: find the moves and the defence answers. A wrong move is taken back, and each puzzle opens the next.',
    'The daily puzzle is the same for everyone each day, with one try: solve it without a miss or hint for 3 points, and keep your streak going.',
    'After a game, Review marks each of your moves as good, doubtful or a blunder, and shows a better move with an arrow.',
    'Back row: shuffled shuffles the knights, bishops and queen behind the pawns, the same for both sides; the king and rooks stay home, so castling works as usual.',
    'Clock gives each side 5, 10 or 15 minutes, with a few seconds added after every move; a side whose time runs out loses.',
  ],
};

const de: HowToPlay = {
  goal: 'Setze den gegnerischen König mit deiner Armee lebender Statuen matt: Er steht im Schach und hat kein sicheres Feld mehr. Jeder Schlag zerbricht eine Statue auf eigene Art.',
  controls: [
    { input: 'Eine deiner Statuen klicken oder tippen', action: 'Sie aufnehmen und zeigen, wohin sie ziehen kann' },
    { input: 'Ein markiertes Feld klicken oder tippen', action: 'Dorthin ziehen; ein Ring markiert eine Statue, die du schlagen kannst' },
    { input: 'Escape', action: 'Die aufgenommene Statue wieder abstellen' },
    { input: 'Knopf Zurück, U', action: 'Deinen letzten Zug zurücknehmen (und die Antwort der Stein-KI), solange die Partie läuft' },
    { input: 'Knopf Schläge, Q', action: 'Zwischen ganzen und kurzen Schlagszenen wechseln' },
    { input: 'Schlag-Galerie (Menü)', action: 'Jedes der 30 Schlagpaare ansehen, wann du willst' },
    { input: 'Knopf Tipp (Rätsel)', action: 'Die Statue markieren, die die Lösung als Nächstes zieht' },
    { input: 'Knopf Analyse, ← und →', action: 'Nach einer Partie durch sie blättern, jeder Zug bewertet' },
  ],
  loop: [
    'Wähle im Menü Als Weiß spielen, Als Schwarz spielen, Zu zweit, einen rivalisierenden Bildhauer oder ein Statuen-Rätsel.',
    'Ziehe eine Statue: tippe sie an, dann eines der markierten Felder.',
    'Schlage eine gegnerische Statue, indem du auf ihr Feld ziehst: Der Angreifer schlägt zu, das Opfer zerbricht.',
    'Die Stein-KI antwortet mit ihrem eigenen Zug.',
    'Halte deinen König sicher und setze ihren matt, um zu gewinnen.',
  ],
  tips: [
    'Jede Statue hat ihren eigenen Schlag (Schwerthieb, Hufstampfer, Stabblitz, Rammstoß, Runenstrahl, Zepterschlag) und zerbricht auf eigene Art.',
    'Acht Paare haben eine eigene Szene, etwa ein Bauer, der eine Dame stürzt, oder zwei Springer im Tjost: Die Galerie markiert sie mit einem Stern.',
    'Ein Bauer auf der letzten Reihe wird zu Dame, Turm, Läufer oder Springer deiner Wahl.',
    'Rochiere, indem du den König zwei Felder auf einen Turm zu ziehst, der noch nicht gezogen hat.',
    'Wähle die Stufe der Stein-KI mit den Pfeilen im Menü, vom Anfänger bis zum Großmeister. Die ersten drei sind offen; besiege eine Stufe, um die nächste freizuschalten.',
    'Eine Partie wird nach jedem Zug gespeichert, also setzt Fortsetzen im Menü sie wieder fort.',
    'Die rivalisierenden Bildhauer sind acht Gegner mit eigenem Stil; die ersten beginnen ohne einen oder zwei Springer. Besiege einen, um den nächsten zu treffen, und sieh zu, wie seine Lieblingsstatue zerbricht.',
    'Statuen-Rätsel sind Matt in eins, zwei oder drei: Finde die Züge, die Verteidigung antwortet. Ein falscher Zug wird zurückgenommen, und jedes Rätsel öffnet das nächste.',
    'Das Tagesrätsel ist jeden Tag für alle gleich, mit einem Versuch: Löse es ohne Fehler oder Tipp für 3 Punkte und halte deine Serie.',
    'Nach einer Partie bewertet die Analyse jeden deiner Züge als gut, zweifelhaft oder groben Fehler und zeigt einen besseren Zug mit einem Pfeil.',
    'Grundreihe: gemischt mischt Springer, Läufer und Dame hinter den Bauern, für beide Seiten gleich; König und Türme bleiben stehen, also funktioniert die Rochade wie immer.',
    'Die Uhr gibt jeder Seite 5, 10 oder 15 Minuten, mit ein paar Sekunden mehr nach jedem Zug; wessen Zeit abläuft, verliert.',
  ],
};

/** US English: the same, with "scepter" for "sceptre". */
const enUS: HowToPlay = { ...en, tips: en.tips.map((tip) => tip.replace('sceptre', 'scepter')) };

export const howToPlay = byLanguage({ en, 'en-US': enUS, de });
