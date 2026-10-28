import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

/** British English, which US English shares: nothing in it is spelled differently. */
const en: HowToPlay = {
  goal: 'Lead your team of five down the lanes and destroy the red Nexus. If your own Nexus falls first, you lose.',
  controls: [
    { input: 'Click or tap the ground', action: 'Walk there' },
    { input: 'Click or tap an enemy', action: 'Walk to it and attack it' },
    { input: 'Touch: put a finger down and drag', action: 'A steering stick appears under it; walk the way you drag' },
    { input: 'Hold Q, W, E or R, then let go', action: 'Aim an ability while held and cast it at the cursor' },
    { input: 'Click an ability box', action: 'Cast that ability at the cursor' },
    { input: 'D, H, V, or their buttons', action: 'Dash, drink the Healing Flask, or plant a Vision Ward' },
    { input: 'T, or Recall', action: 'Channel 4 seconds, then return to your Nexus' },
    { input: 'B, or Shop (Esc closes it)', action: 'Open the shop and buy items' },
    { input: 'G, or the spell button', action: 'Cast your battle spell (pick it on the champion screen)' },
    { input: 'X, or Buy back', action: 'While dead, pay to respawn at once (once every 2:30)' },
    { input: '1, 2 or 3, or click a card', action: 'Keep one of the upgrades a new level offers' },
    { input: 'Hold Tab, or tap the kill score', action: 'Show the scoreboard of all ten champions' },
    { input: 'Z, N or C at the cursor, or a ping button then the map (Alt and click: attack)', action: 'Ping attack, on my way or danger: allies come and fight, wait there for you or fall back' },
  ],
  loop: [
    'Pick a champion card to start the match.',
    'Walk down a lane and land last hits on red minions for gold.',
    'Fight red champions and complete the objective on the card under the top bar.',
    'Level up, pick an upgrade, and recall home to shop for items.',
    'Topple the towers and an inhibitor, then destroy the red Nexus.',
  ],
  tips: [
    'Standing still makes your champion attack whatever enemy comes in reach.',
    'The minion your next hit would kill gets a gold outline, and a streak of last hits pays more.',
    'Towers shoot minions first, but hitting an enemy champion under a tower draws its fire.',
    'Jungle camps give gold and XP, and the brutes give a 60-second buff.',
    'Your R ability unlocks at level 3.',
    'Wins with a champion raise its mastery, which adds a third upgrade card to its early levels.',
    'Tall grass hides you from enemies until you attack, and the fog hides what your team cannot see.',
    'Standing inside the ring round your own Nexus heals you quickly.',
    'Clear the sellswords camped by a lane and they march down it for your team.',
    'From 2:00, every two minutes two runes appear on the river: walk over one for more damage, speed, healing or gold.',
  ],
};

const de: HowToPlay = {
  goal: 'Führe dein Team aus fünf die Lanes hinunter und zerstöre den roten Nexus. Fällt dein eigener Nexus zuerst, verlierst du.',
  controls: [
    { input: 'Den Boden anklicken oder antippen', action: 'Dorthin laufen' },
    { input: 'Einen Feind anklicken oder antippen', action: 'Hinlaufen und angreifen' },
    { input: 'Touch: Finger aufsetzen und ziehen', action: 'Darunter erscheint ein Steuerknüppel; in Zugrichtung laufen' },
    { input: 'Q, W, E oder R halten, dann loslassen', action: 'Beim Halten eine Fähigkeit zielen und am Zeiger wirken' },
    { input: 'Ein Fähigkeitsfeld anklicken', action: 'Diese Fähigkeit am Zeiger wirken' },
    { input: 'D, H, V oder ihre Tasten', action: 'Sprinten, den Heiltrank trinken oder einen Sichtwächter setzen' },
    { input: 'T oder Heimkehren', action: '4 Sekunden kanalisieren, dann zum Nexus zurückkehren' },
    { input: 'B oder Laden (Esc schließt ihn)', action: 'Den Laden öffnen und Gegenstände kaufen' },
    { input: 'G oder die Zaubertaste', action: 'Deinen Kampfzauber wirken (gewählt auf der Championauswahl)' },
    { input: 'X oder Zurückkaufen', action: 'Im Tod sofort gegen Gold wiederkehren (alle 2:30 einmal)' },
    { input: '1, 2 oder 3, oder eine Karte anklicken', action: 'Eines der Upgrades einer neuen Stufe behalten' },
    { input: 'Tab halten oder auf den Kill-Stand tippen', action: 'Die Punktetafel aller zehn Champions zeigen' },
    { input: 'Z, N oder C am Zeiger, oder eine Signaltaste, dann die Karte (Alt und Klick: Angriff)', action: 'Signal Angriff, Bin unterwegs oder Gefahr: Verbündete kommen und kämpfen, warten dort auf dich oder ziehen sich zurück' },
  ],
  loop: [
    'Wähle eine Championkarte, um das Match zu beginnen.',
    'Lauf eine Lane hinunter und lande letzte Treffer an roten Vasallen für Gold.',
    'Kämpfe gegen rote Champions und erfülle das Ziel auf der Karte unter der oberen Leiste.',
    'Steige auf, wähle ein Upgrade und kehre heim, um Gegenstände zu kaufen.',
    'Stürze die Türme und einen Inhibitor, dann zerstöre den roten Nexus.',
  ],
  tips: [
    'Steht dein Champion still, greift er jeden Feind in Reichweite an.',
    'Der Vasall, den dein nächster Treffer erledigen würde, bekommt einen goldenen Umriss, und eine Serie letzter Treffer zahlt mehr.',
    'Türme schießen zuerst auf Vasallen, aber wer unter einem Turm einen feindlichen Champion trifft, zieht sein Feuer auf sich.',
    'Dschungellager geben Gold und Erfahrung, und die Brocken geben 60 Sekunden lang einen Buff.',
    'Deine R-Fähigkeit wird auf Stufe 3 frei.',
    'Siege mit einem Champion steigern seine Meisterschaft, die seinen frühen Stufen eine dritte Upgradekarte gibt.',
    'Hohes Gras verbirgt dich vor Feinden, bis du angreifst, und der Nebel verbirgt, was dein Team nicht sieht.',
    'Im Ring um deinen eigenen Nexus heilst du schnell.',
    'Besiege die Söldner, die an einer Lane lagern, dann ziehen sie für dein Team die Lane hinunter.',
    'Ab 2:00 erscheinen alle zwei Minuten zwei Runen am Fluss: Lauf über eine für mehr Schaden, Tempo, Heilung oder Gold.',
  ],
};

export const howToPlay: HowToPlay = byLanguage({ en, de });
