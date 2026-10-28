import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

/** British English; US English spells it the same, so it falls back to this. */
const en: HowToPlay = {
  goal: 'Build a squad of junk robots and outlast seven rival commanders. Every lost fight costs your commander health; the last one standing wins.',
  controls: [
    { input: 'Click or tap a shop card', action: 'Buy that robot onto your bench' },
    { input: 'Drag a robot, or tap it and then a tile', action: 'Place it on your half of the board, or swap two robots' },
    { input: 'Drag a part onto a robot, or tap the part and then the robot', action: 'Bolt it on; two parts on one robot build a finished item' },
    { input: 'Drag a robot onto the shop, or E', action: 'Sell the robot (the selected one with E)' },
    { input: 'R, or Reroll', action: 'New robots in the shop for 2 gold' },
    { input: 'L, or Lock', action: 'Keep this shop for the next round (a reroll unlocks it)' },
    { input: 'Tap a rival in the list on the right', action: 'Scout its board on the far half while you plan' },
    { input: 'Tap the panel under the list', action: 'Switch between the last fight’s damage and your power cards' },
    { input: 'X, or Buy XP', action: '4 XP for 4 gold; each level lets one more robot fight' },
    { input: 'Space, or FIGHT!', action: 'Start the fight; during a fight, use your commander’s skill' },
    { input: 'T, or Speed', action: 'Watch fights at 1x or 2x' },
    { input: '1, 2 or 3', action: 'Pick a power card when one is offered' },
  ],
  loop: [
    'Pick a commander, a season (or this week’s), and whether the board has terrain tiles.',
    'Buy robots from the shop with your gold.',
    'Place them on your half of the board: tanks in front, shooters behind.',
    'Press FIGHT! and watch them battle on their own.',
    'Earn gold and XP each round, merge three copies into a stronger robot, and repeat.',
  ],
  tips: [
    'Robots that share an origin or class unlock trait bonuses at 2, 4 and 6; tap a trait for details.',
    'Three copies of a robot merge into a 2-star; three 2-stars make a 3-star.',
    'Saving gold pays interest: 1 gold for every 10 you hold, up to 5 a round.',
    'Monster rounds drop parts; your commander walks over to pick them up.',
    'In draft rounds the weakest commanders pick first from the ring.',
    'Gilded robots in the shop count for two origins but never merge.',
    'Pick up a part to see what it would build on each robot before you bolt it on.',
    'On the Scrap Rat round, tap the rat to zap gold out of it before it escapes.',
    'Five more commanders unlock through deeds, like a top-four finish or a 3-star robot; pick a locked one on the menu to see how.',
    'Top-four finishes earn rank points; each new rank makes the rivals play a little harder.',
    'The third season card is this week’s: its season and terrain change every Monday, and it keeps its own best place.',
  ],
};

const de: HowToPlay = {
  goal: 'Baue einen Trupp aus Schrottrobotern und überlebe sieben rivalisierende Kommandanten. Jeder verlorene Kampf kostet deinen Kommandanten Leben; wer zuletzt steht, gewinnt.',
  controls: [
    { input: 'Eine Shopkarte anklicken oder antippen', action: 'Diesen Roboter auf deine Bank kaufen' },
    { input: 'Einen Roboter ziehen, oder ihn und dann ein Feld antippen', action: 'Ihn auf deine Bretthälfte stellen oder zwei Roboter tauschen' },
    { input: 'Ein Teil auf einen Roboter ziehen, oder das Teil und dann den Roboter antippen', action: 'Es anschrauben; zwei Teile an einem Roboter ergeben einen fertigen Gegenstand' },
    { input: 'Einen Roboter auf den Shop ziehen, oder E', action: 'Den Roboter verkaufen (mit E den ausgewählten)' },
    { input: 'R, oder Würfeln', action: 'Neue Roboter im Shop für 2 Gold' },
    { input: 'L, oder Halten', action: 'Diesen Shop für die nächste Runde behalten (neu würfeln hebt das auf)' },
    { input: 'Einen Rivalen in der Liste rechts antippen', action: 'Sein Brett auf der fernen Hälfte ansehen, während du planst' },
    { input: 'Das Feld unter der Liste antippen', action: 'Zwischen dem Schaden des letzten Kampfs und deinen Machtkarten wechseln' },
    { input: 'X, oder XP für 4', action: '4 XP für 4 Gold; jede Stufe lässt einen Roboter mehr kämpfen' },
    { input: 'Leertaste, oder KAMPF!', action: 'Den Kampf starten; im Kampf die Fähigkeit deines Kommandanten nutzen' },
    { input: 'T, oder Tempo', action: 'Kämpfe mit 1x oder 2x ansehen' },
    { input: '1, 2 oder 3', action: 'Eine Machtkarte wählen, wenn eine angeboten wird' },
  ],
  loop: [
    'Wähle einen Kommandanten, eine Saison (oder die der Woche) und ob das Brett Geländefelder hat.',
    'Kaufe mit deinem Gold Roboter im Shop.',
    'Stelle sie auf deine Bretthälfte: Tanks nach vorn, Schützen nach hinten.',
    'Drücke KAMPF! und sieh zu, wie sie von selbst kämpfen.',
    'Verdiene jede Runde Gold und XP, verschmelze drei Kopien zu einem stärkeren Roboter und wiederhole.',
  ],
  tips: [
    'Roboter mit gleicher Herkunft oder Klasse schalten bei 2, 4 und 6 Merkmalsboni frei; tippe ein Merkmal für Details an.',
    'Drei Kopien eines Roboters verschmelzen zu 2 Sternen; drei mit 2 Sternen ergeben 3 Sterne.',
    'Gespartes Gold bringt Zinsen: 1 Gold je 10, die du hast, bis zu 5 pro Runde.',
    'Monsterrunden lassen Teile fallen; dein Kommandant läuft hin und sammelt sie ein.',
    'In Auswahlrunden wählen die schwächsten Kommandanten zuerst aus dem Ring.',
    'Vergoldete Roboter im Shop zählen für zwei Herkünfte, verschmelzen aber nie.',
    'Nimm ein Teil auf, um zu sehen, was es an jedem Roboter bauen würde, bevor du es anschraubst.',
    'Tippe in der Schrottratten-Runde die Ratte an, um Gold aus ihr zu schocken, bevor sie entkommt.',
    'Fünf weitere Kommandanten schaltest du mit Taten frei, etwa einem Platz unter den ersten vier oder einem Roboter mit 3 Sternen; wähle im Menü einen gesperrten, um zu sehen, wie.',
    'Plätze unter den ersten vier bringen Rangpunkte; jeder neue Rang lässt die Rivalen etwas härter spielen.',
    'Die dritte Saisonkarte ist die der Woche: Saison und Gelände wechseln jeden Montag, und sie hat ihren eigenen besten Platz.',
  ],
};

export const howToPlay: HowToPlay = byLanguage({ en, de });
