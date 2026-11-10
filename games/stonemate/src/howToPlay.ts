import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: 'Checkmate the other king with your army of living statues: trap it so it is attacked and has no safe square left. Every capture breaks a statue in its own way.',
  controls: [
    { input: 'Click or tap one of your statues', action: 'Pick it up and show where it can go' },
    { input: 'Click or tap a marked square', action: 'Move there; a ring marks a statue you can take' },
    { input: 'Escape', action: 'Put the picked statue down again' },
    { input: 'Undo button, U', action: 'Take back your last move (and the Stone AI’s reply)' },
    { input: 'Captures button, Q', action: 'Switch between full capture scenes and quick ones' },
    { input: 'Capture gallery (menu)', action: 'Watch any of the 30 capture pairs whenever you like' },
  ],
  loop: [
    'Pick Play White, Play Black or Two players on the menu.',
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
  ],
};

const de: HowToPlay = {
  goal: 'Setze den gegnerischen König mit deiner Armee lebender Statuen matt: Er steht im Schach und hat kein sicheres Feld mehr. Jeder Schlag zerbricht eine Statue auf eigene Art.',
  controls: [
    { input: 'Eine deiner Statuen klicken oder tippen', action: 'Sie aufnehmen und zeigen, wohin sie ziehen kann' },
    { input: 'Ein markiertes Feld klicken oder tippen', action: 'Dorthin ziehen; ein Ring markiert eine Statue, die du schlagen kannst' },
    { input: 'Escape', action: 'Die aufgenommene Statue wieder abstellen' },
    { input: 'Knopf Zurück, U', action: 'Deinen letzten Zug zurücknehmen (und die Antwort der Stein-KI)' },
    { input: 'Knopf Schläge, Q', action: 'Zwischen ganzen und kurzen Schlagszenen wechseln' },
    { input: 'Schlag-Galerie (Menü)', action: 'Jedes der 30 Schlagpaare ansehen, wann du willst' },
  ],
  loop: [
    'Wähle im Menü Als Weiß spielen, Als Schwarz spielen oder Zu zweit.',
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
  ],
};

export const howToPlay = byLanguage({ en, 'en-US': en, de });
