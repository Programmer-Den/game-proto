import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

/** British English, which US English uses as it is: none of it is spelled differently. */
const en: HowToPlay = {
  goal: 'Grow herbs, brew potions and sell them to grow your apothecary. You win by brewing the Panacea that cures the town of the plague.',
  controls: [
    { input: 'Tap or click the ground, or WASD / arrow keys', action: 'Walk the plague doctor there' },
    { input: 'Touch: put a finger down and drag', action: 'A steering stick appears under it; walk the way you drag' },
    { input: 'Walk past ripe plants', action: 'Harvest every ripe bed within reach of the sickle' },
    {
      input: 'Stand on a floor marker',
      action: 'Green drops items off, blue works the station, gold picks goods or coins up',
    },
    { input: 'Stand still on a purple marker', action: 'Pay coins towards an upgrade, a craftsman or a new building' },
    { input: 'Mouse wheel, + / - keys or pinch', action: 'Zoom the map in and out' },
    { input: 'Recipes button', action: 'Show what each station makes and what each potion sells for' },
    { input: 'Tap a slot in the hands bar at the bottom', action: 'Throw that item away' },
    { input: "Tap a waiting customer's order bubble", action: 'From inside the shop, hand them what they want from the shelf' },
    { input: 'Cogwheel button', action: 'Open the settings' },
    {
      input: 'Tap a sign',
      action: 'Replant a garden, set what a station makes first, set a shelf to Cheap, Fair or Dear, or pick what the herb market sells',
    },
  ],
  loop: [
    'Walk through the wheat field and mandrake patch to harvest the ripe plants.',
    'Drop them at the refining table and stand on its work spot to refine them.',
    'Carry the refined goods to the cauldron and stand on its work spot to brew potions.',
    'Drop the potions outside the shop, then stand behind the counter or tap a customer\'s order bubble to serve them.',
    'Pick up the coins and spend them on upgrades, craftsmen and pixies.',
  ],
  tips: [
    'Step off the cauldron in the gold part of the brewing bar and pick the potion up for a Fine one, worth half again as much.',
    'Customers tip more the faster you serve them, and a happy customer comes back as a regular.',
    'Keep the daily contract on the top card by dusk to earn its reward.',
    'The study teaches new recipes, and the shade garden grows nightshade for them.',
    'Craftsmen and pixies keep the shop running without you, even while the game is closed.',
    'Rain can blight a bed; walk past it to clear it before it spreads.',
    'From day five the plague asks for potions in three stages; meet them all to unlock the Panacea.',
    'After the cure a new sickness comes each season; every season cured earns a town seal that raises all prices.',
    'Keep 5 or fewer of a potion on its shelf: past that an overstocked shop sells it cheaper, down to half price when full.',
    'Some days a merchant wagon across the street buys a whole crate of one potion at a premium: tap it to sell.',
    'The herb market below the outfitter buys and sells plants and refined goods at prices that change with the weather.',
    'Once the town is cured its Town map opens: buy a bakery and more shops, each ten times dearer than the last, and supply the whole town.',
    'Every town shop runs like the apothecary: tips, regulars and its own reputation, the weather, market-day crowds, the blight and a daily contract.',
    'The districts on the Town map buy from your shelves every half minute: keep them supplied and their homes grow from cottages into houses and on up to castles. Fill every district with castles and the town becomes a city.',
    'Once the town is a city, tap the heading over its districts to found the next town down the road: fresh districts whose homes pay more, and a town seal more.',
    'Every seventh day a royal courier waits on the green right of the guild for three days, asking for a few of up to three potions: tap it to hand over what the shelf holds, for a royal reward.',
    'Hired craftsmen grow into masters the longer they work a refining table or cauldron: each star makes it work faster.',
  ],
};

const de: HowToPlay = {
  goal: 'Baue Kräuter an, braue Tränke und verkaufe sie, um deine Apotheke wachsen zu lassen. Du gewinnst, wenn du das Allheilmittel braust, das die Stadt von der Seuche heilt.',
  controls: [
    { input: 'Boden antippen oder anklicken, oder WASD / Pfeiltasten', action: 'Den Pestdoktor dorthin gehen lassen' },
    { input: 'Touch: Finger aufsetzen und ziehen', action: 'Darunter erscheint ein Steuerknüppel; der Doktor geht in Zugrichtung' },
    { input: 'An reifen Pflanzen vorbeigehen', action: 'Jedes reife Beet in Reichweite der Sichel ernten' },
    {
      input: 'Auf einer Bodenmarke stehen',
      action: 'Grün legt Waren ab, Blau bedient die Station, Gold hebt Waren oder Münzen auf',
    },
    { input: 'Auf einer lila Marke stillstehen', action: 'Münzen für ein Upgrade, einen Handwerker oder ein neues Gebäude zahlen' },
    { input: 'Mausrad, Tasten + / - oder zwei Finger', action: 'Die Karte heran- und wegzoomen' },
    { input: 'Taste Rezepte', action: 'Zeigen, was jede Station herstellt und was jeder Trank einbringt' },
    { input: 'Ein Feld der Hände-Leiste unten antippen', action: 'Diese Ware wegwerfen' },
    { input: 'Die Bestellblase einer wartenden Kundschaft antippen', action: 'Im Laden das Gewünschte aus dem Regal überreichen' },
    { input: 'Zahnradtaste', action: 'Die Einstellungen öffnen' },
    {
      input: 'Ein Schild antippen',
      action: 'Einen Garten neu bepflanzen, festlegen, was eine Station zuerst macht, ein Regal auf Billig, Fair oder Teuer stellen oder wählen, was der Kräutermarkt verkauft',
    },
  ],
  loop: [
    'Geh durch das Weizenfeld und das Alraunenbeet, um die reifen Pflanzen zu ernten.',
    'Leg sie am Mahltisch ab und stell dich auf seinen Arbeitsplatz, um sie zu verarbeiten.',
    'Trag die verarbeiteten Waren zum Kessel und stell dich auf seinen Arbeitsplatz, um Tränke zu brauen.',
    'Leg die Tränke vor dem Laden ab und stell dich hinter den Ladentisch oder tippe die Bestellblase an, um die Kundschaft zu bedienen.',
    'Heb die Münzen auf und gib sie für Upgrades, Handwerker und Feen aus.',
  ],
  tips: [
    'Tritt im goldenen Teil des Braubalkens vom Kessel und heb den Trank auf: so wird er ein Feiner Trank, der die Hälfte mehr wert ist.',
    'Kundschaft gibt mehr Trinkgeld, je schneller du sie bedienst, und zufriedene Kundschaft kommt als Stammkundschaft wieder.',
    'Erfülle den Tagesauftrag auf der oberen Karte bis zur Dämmerung, um seinen Lohn zu verdienen.',
    'Die Studierstube lehrt neue Rezepte, und der Schattengarten liefert den Nachtschatten dafür.',
    'Handwerker und Feen halten den Laden ohne dich am Laufen, sogar während das Spiel geschlossen ist.',
    'Regen kann ein Beet mit Fäule befallen; geh daran vorbei, um sie zu beseitigen, bevor sie sich ausbreitet.',
    'Ab Tag fünf verlangt die Seuche Tränke in drei Stufen; erfülle alle, um das Allheilmittel freizuschalten.',
    'Nach der Heilung kommt jede Saison eine neue Krankheit; jede geheilte Saison bringt ein Stadtsiegel, das alle Preise hebt.',
    'Halte 5 oder weniger von einem Trank im Regal: darüber verkauft ein überfüllter Laden ihn billiger, bis zum halben Preis, wenn es voll ist.',
    'An manchen Tagen kauft ein Händlerwagen gegenüber eine ganze Kiste eines Tranks zu einem Aufpreis: tipp ihn an, um zu verkaufen.',
    'Der Kräutermarkt unter dem Ausstatter kauft und verkauft Pflanzen und verarbeitete Waren zu Preisen, die sich mit dem Wetter ändern.',
    'Ist die Stadt geheilt, öffnet sich ihr Stadtplan: kauf eine Bäckerei und weitere Läden, jeder zehnmal teurer als der letzte, und beliefere die ganze Stadt.',
    'Jeder Laden in der Stadt läuft wie die Apotheke: Trinkgeld, Stammkundschaft und ein eigener Ruf, das Wetter, Andrang an Markttagen, die Fäule und ein täglicher Auftrag.',
    'Die Viertel auf dem Stadtplan kaufen jede halbe Minute aus deinen Regalen: versorge sie, und ihre Hütten wachsen zu Häusern und weiter bis zu Burgen. Sind alle Viertel voller Burgen, wird die Stadt zur Großstadt.',
    'Ist die Stadt eine Großstadt, tipp auf die Überschrift über ihren Vierteln, um die nächste Stadt die Straße hinab zu gründen: neue Viertel, deren Häuser mehr zahlen, und ein Stadtsiegel mehr.',
    'Jeden siebten Tag wartet ein königlicher Bote drei Tage lang auf der Wiese rechts der Gilde und will einige von bis zu drei Tränken: tipp ihn an, um zu geben, was im Regal steht, für eine königliche Belohnung.',
    'Angestellte Handwerker werden zu Meistern, je länger sie an einem Arbeitstisch oder Kessel arbeiten: Jeder Stern lässt ihn schneller arbeiten.',
  ],
};

export const howToPlay: HowToPlay = byLanguage({ en, de });
