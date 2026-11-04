import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: 'Lead your hero through the Crypt and the Sunken Tombs to beat the Hollow Queen (and from depth 3, up the Bone Spire to the Marrow Tyrant). The run ends if your health reaches zero.',
  controls: [
    { input: 'Tap a hero', action: 'Set out as the Knight, the Hunter or the Hexer once unlocked (< and > pick the depth once one is open)' },
    { input: 'Tap Daily crypt', action: "Set out on the day's run, the same for everyone, once a day" },
    { input: 'Tap a lit room', action: 'Walk there and go in' },
    { input: 'Tap a card in hand', action: 'Play it, if you have the energy for it' },
    { input: 'Tap a flask', action: 'Drink it on your turn, for no energy' },
    { input: 'Tap End turn', action: 'Discard your hand and let the foes act' },
    { input: 'Tap a reward card or a ware', action: 'Add the card to your deck, or buy from the merchant' },
    { input: 'Tap a relic in the top bar', action: 'Show its name and what it does' },
  ],
  loop: [
    'Pick a hero and tap one of the lit rooms on the map.',
    'In a fight you draw five cards and have three energy to spend each turn.',
    'Play attacks to hit foes and skills to block, then end your turn.',
    'Win the fight to collect gold and pick a new card for your deck.',
    "Choose your next room along the forking paths, all the way to the act's boss.",
  ],
  tips: [
    'Each foe shows its intent: what it will do on its next turn, so you can block in time.',
    'Block soaks up damage until your next turn, but health carries over from room to room.',
    'Campfires let you rest to heal, temper a card to make it stronger, or burn one to thin the deck.',
    'The merchant sells cards, relics and flasks for gold, and removes a card for 40.',
    'Weak cuts attacks by a quarter, Vulnerable makes attacks hit harder, and Poison hurts each turn.',
    'Elites are tougher and can add curse cards to your deck, but drop rare cards and a flask.',
    'Beating the Hollow Queen opens the next depth, a harder run with one more rule.',
    'From depth 3 the Hollow Queen is not the end: climb the Bone Spire and beat the Marrow Tyrant to win.',
    'Win at depth 2 with both the Knight and the Hunter to unlock the Hexer, whose cards hit foes with a status harder.',
    'The daily crypt scores 10 for every room cleared, plus the health left if you beat the Hollow Queen.',
  ],
};

const de: HowToPlay = {
  goal: 'Führe deinen Helden durch die Gruft und die versunkenen Gräber und besiege die Hohle Königin (ab Tiefe 3 auch den Knochenturm hinauf bis zum Marktyrannen). Der Lauf endet, wenn dein Leben auf null fällt.',
  controls: [
    { input: 'Einen Helden antippen', action: 'Als Ritter, Jäger oder, sobald freigeschaltet, als Hexer aufbrechen (< und > wählen die Tiefe, sobald eine offen ist)' },
    { input: 'Tägliche Gruft antippen', action: 'Zum Lauf des Tages aufbrechen, für alle gleich, einmal am Tag' },
    { input: 'Einen leuchtenden Raum antippen', action: 'Dorthin gehen und eintreten' },
    { input: 'Eine Karte auf der Hand antippen', action: 'Sie spielen, wenn du genug Energie hast' },
    { input: 'Einen Trank antippen', action: 'Ihn in deinem Zug trinken, ohne Energie' },
    { input: 'Zug beenden antippen', action: 'Die Hand abwerfen und die Feinde handeln lassen' },
    { input: 'Eine Belohnungskarte oder Ware antippen', action: 'Die Karte ins Deck nehmen oder beim Händler kaufen' },
    { input: 'Ein Relikt in der oberen Leiste antippen', action: 'Seinen Namen und seine Wirkung zeigen' },
  ],
  loop: [
    'Wähle einen Helden und tippe einen der leuchtenden Räume auf der Karte an.',
    'Im Kampf ziehst du fünf Karten und hast jeden Zug drei Energie.',
    'Spiele Angriffe, um Feinde zu treffen, und Fertigkeiten zum Blocken, dann beende deinen Zug.',
    'Gewinne den Kampf, um Gold zu sammeln und eine neue Karte für dein Deck zu wählen.',
    'Wähle deinen nächsten Raum entlang der verzweigten Wege, bis zum Endgegner des Akts.',
  ],
  tips: [
    'Jeder Feind zeigt seine Absicht: was er in seinem nächsten Zug tut, damit du rechtzeitig blocken kannst.',
    'Block fängt Schaden bis zu deinem nächsten Zug ab, aber dein Leben bleibt von Raum zu Raum gleich.',
    'Am Lagerfeuer kannst du ruhen und heilen, eine Karte härten oder eine verbrennen, um das Deck auszudünnen.',
    'Der Händler verkauft Karten, Relikte und Tränke für Gold und entfernt eine Karte für 40.',
    'Schwäche senkt Angriffe um ein Viertel, Verwundbar lässt Angriffe härter treffen, und Gift schadet jeden Zug.',
    'Eliten sind zäher und können Fluchkarten in dein Deck legen, lassen aber seltene Karten und einen Trank fallen.',
    'Wer die Hohle Königin besiegt, öffnet die nächste Tiefe: einen härteren Lauf mit einer Regel mehr.',
    'Ab Tiefe 3 ist die Hohle Königin nicht das Ende: Steig den Knochenturm hinauf und besiege den Marktyrannen.',
    'Gewinne auf Tiefe 2 mit dem Ritter und mit dem Jäger, um den Hexer freizuschalten, dessen Karten Feinde mit Zustand härter treffen.',
    'Die tägliche Gruft gibt 10 Punkte für jeden geschafften Raum, dazu das übrige Leben, wenn du die Hohle Königin besiegst.',
  ],
};

/** US English spells every text the same as British English. */
export const howToPlay: HowToPlay = byLanguage({ en, 'en-US': en, de });
