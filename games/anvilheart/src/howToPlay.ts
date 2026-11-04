import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: 'Forge and merge swords, sell them to adventurers and deliver great swords to the crown. The Crown Blade wins the smithy.',
  controls: [
    {
      input: 'Click or tap Forge',
      action: 'Make a Rusty Dagger on the first empty anvil, once the forge is hot',
    },
    {
      input: 'Drag a sword onto its twin',
      action: 'Merge the two into one sword of the next tier',
    },
    {
      input: 'Drag a sword onto an anvil or sword',
      action: 'Move it there, or swap the two',
    },
    {
      input: 'Drag a sword onto an adventurer',
      action: 'Sell it, if it is at least as good as the one they asked for',
    },
    {
      input: 'Drag a sword onto the commission banner',
      action: 'Deliver it to the crown',
    },
    { input: 'Drag a gem onto a plain sword', action: 'Set the gem in it' },
    { input: 'Drag anything onto the scrap bin', action: 'Throw it away to free its anvil' },
    {
      input: 'Tap the switch under the furnace',
      action: 'Forge bucklers instead of swords, once you have made a Knight\'s Blade',
    },
    {
      input: 'Tap Guild perks or the stars',
      action: 'Spend guild stars on lasting perks',
    },
    {
      input: 'Tap an upgrade, the barrel or the fifth row',
      action: 'Buy it with your coins',
    },
    {
      input: 'Tap Hire, or an ore at the ore cart',
      action: 'Hire the apprentice, or buy silver or starmetal for a few minutes, in the column beside the board',
    },
  ],
  loop: [
    'Tap Forge to make Rusty Daggers on the anvils.',
    'Drag two matching swords together to make a better one.',
    'Sell each adventurer the sword they ask for, shown on their order card.',
    'Spend your coins on forge upgrades and more room.',
    'Build the great sword the royal commission asks for and drag it onto the banner.',
  ],
  tips: [
    'The exact sword an adventurer asked for pays 50% more; a better one only pays what they asked.',
    'Merges within 4 seconds of each other build a hammer streak that pays bonus coins.',
    "A merge while the streak's ring glows gold, in its last second, makes a Masterwork: it pays 50% more and never rusts.",
    'Adventurers leave if they wait too long, and that lowers your guild reputation.',
    'A good reputation brings adventurers more often and makes them wait longer.',
    'A sword left alone on an anvil for 3 minutes dulls and then drops a tier; the quench barrel keeps it safe.',
    'Two Dragonslayers merge into the Anvilheart, which the Crown Blade commission asks for.',
    'Some adventurers order a sword and buckler set: hand over both, in either order, for a 50% bonus.',
    'Each new charter after the win makes you choose one of two edicts that change its rules.',
    'Each new charter also raises one guild hall a level for good: more swords to start with, more gems or more patient adventurers.',
    'From the second charter a rival smithy sells across the street: outsell it over its three-minute day for a prize. Adventurers you keep waiting go to it.',
    'The Daily forge at the bottom is a ten-minute shift that starts the same for everyone today (edict and seed); what comes after follows how you play. Earn as many coins as you can. One try a day.',
    "Once you have made a Knight's Blade, a tourney comes every four minutes: three knights each want a sword within a minute and joust with it. Tier, gem and Masterwork decide where your best knight places; a win hangs a banner, and banners unlock blade finishes.",
    'An apprentice, hired once you have made a Steel Sword, merges the lowest matching pair on the anvils every 20 seconds, quicker in every charter. They leave Masterworks and the sword in your hand alone.',
    'Now and then an ore cart stops for 45 seconds: silver makes the forge find three times the gems, starmetal makes it forge Steel Swords, each for three minutes.',
  ],
};

const de: HowToPlay = {
  goal: 'Schmiede und verschmilz Schwerter, verkaufe sie an Abenteurer und liefere große Schwerter an die Krone. Die Kronklinge gewinnt die Schmiede.',
  controls: [
    {
      input: 'Schmieden klicken oder tippen',
      action: 'Einen Rostigen Dolch auf den ersten freien Amboss legen, sobald die Esse heiß ist',
    },
    {
      input: 'Ein Schwert auf seinen Zwilling ziehen',
      action: 'Beide zu einem Schwert der nächsten Stufe verschmelzen',
    },
    {
      input: 'Ein Schwert auf einen Amboss oder ein Schwert ziehen',
      action: 'Es dorthin legen oder die beiden tauschen',
    },
    {
      input: 'Ein Schwert auf einen Abenteurer ziehen',
      action: 'Es verkaufen, wenn es mindestens so gut ist wie das gewünschte',
    },
    {
      input: 'Ein Schwert auf das Auftragsbanner ziehen',
      action: 'Es an die Krone liefern',
    },
    { input: 'Ein Juwel auf ein schlichtes Schwert ziehen', action: 'Das Juwel darin fassen' },
    { input: 'Etwas auf den Schrotteimer ziehen', action: 'Es wegwerfen, um seinen Amboss freizumachen' },
    {
      input: 'Den Schalter unter dem Ofen tippen',
      action: 'Schilde statt Schwerter schmieden, sobald du eine Ritterklinge gemacht hast',
    },
    {
      input: 'Gildenvorteile oder die Sterne tippen',
      action: 'Gildensterne für bleibende Vorteile ausgeben',
    },
    {
      input: 'Eine Verbesserung, das Fass oder die fünfte Reihe tippen',
      action: 'Sie mit deinen Münzen kaufen',
    },
    {
      input: 'Anheuern oder ein Erz am Erzkarren tippen',
      action: 'Den Lehrling anheuern oder Silber oder Sternmetall für ein paar Minuten kaufen, in der Spalte neben den Ambossen',
    },
  ],
  loop: [
    'Tippe auf Schmieden, um Rostige Dolche auf die Ambosse zu legen.',
    'Zieh zwei gleiche Schwerter zusammen, um ein besseres zu machen.',
    'Verkaufe jedem Abenteurer das Schwert, das auf seiner Bestellkarte steht.',
    'Gib deine Münzen für Verbesserungen der Esse und mehr Platz aus.',
    'Schmiede das große Schwert, das der königliche Auftrag verlangt, und zieh es auf das Banner.',
  ],
  tips: [
    'Genau das gewünschte Schwert bringt 50 % mehr; ein besseres zahlt nur den gewünschten Preis.',
    'Verschmelzungen innerhalb von 4 Sekunden bilden eine Hammerserie, die Bonusmünzen bringt.',
    'Eine Verschmelzung, während der Ring der Serie in seiner letzten Sekunde golden leuchtet, macht ein Meisterwerk: Es bringt 50 % mehr und rostet nie.',
    'Abenteurer gehen, wenn sie zu lange warten, und das senkt den Ruf deiner Gilde.',
    'Ein guter Ruf bringt öfter Abenteurer, und sie warten länger.',
    'Ein Schwert, das 3 Minuten unberührt auf einem Amboss liegt, wird stumpf und fällt dann eine Stufe; im Löschfass ist es sicher.',
    'Zwei Drachentöter verschmelzen zum Anvilheart, das der Auftrag für die Kronklinge verlangt.',
    'Manche Abenteurer bestellen ein Set aus Schwert und Schild: Gib beides, in beliebiger Reihenfolge, für 50 % Bonus.',
    'Jeder neue Freibrief nach dem Sieg lässt dich einen von zwei Erlassen wählen, die seine Regeln ändern.',
    'Jeder neue Freibrief baut außerdem eine Gildenhalle für immer aus: mehr Schwerter zum Start, mehr Juwelen oder geduldigere Abenteurer.',
    'Ab dem zweiten Freibrief verkauft eine Rivalenschmiede gegenüber: Verkaufe in ihrem dreiminütigen Tag mehr als sie und gewinne einen Preis. Abenteurer, die du warten lässt, gehen zu ihr.',
    'Die Tagesschicht unten sind zehn Minuten, die heute für alle gleich beginnen (Edikt und Startwert); was danach kommt, hängt von deinem Spiel ab. Verdiene so viele Münzen wie möglich. Ein Versuch pro Tag.',
    'Sobald du eine Ritterklinge gemacht hast, kommt alle vier Minuten ein Turnier: Drei Ritter wollen je binnen einer Minute ein Schwert und tjostieren damit. Stufe, Juwel und Meisterwerk entscheiden, welchen Platz dein bester Ritter belegt; ein Sieg hängt ein Banner auf, und Banner schalten Klingenschliffe frei.',
    'Ein Lehrling, anzuheuern sobald du ein Stahlschwert gemacht hast, verschmilzt alle 20 Sekunden das niedrigste gleiche Paar auf den Ambossen, in jedem Freibrief schneller. Meisterwerke und das Schwert in deiner Hand lässt er in Ruhe.',
    'Ab und zu hält ein Erzkarren für 45 Sekunden: Mit Silber findet die Esse dreimal so viele Juwelen, mit Sternmetall schmiedet sie Stahlschwerter, jeweils drei Minuten lang.',
  ],
};

/** US English spells every text the same as British English. */
export const howToPlay = byLanguage({ en, de });
