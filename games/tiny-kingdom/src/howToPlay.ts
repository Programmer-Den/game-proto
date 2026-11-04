import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: 'Place buildings on your island to score as many points as you can. The kingdom ends when the pouch is empty or nothing fits.',
  controls: [
    {
      input: 'Click or tap a tile button',
      action: 'Pick one of the three tiles drawn this turn',
    },
    {
      input: 'Hover a grass cell',
      action: 'Preview what the building would score there, and from which neighbours',
    },
    {
      input: 'Click or tap a grass cell',
      action: 'Place the building; the other two tiles go back to the pouch',
    },
    {
      input: 'On a touchscreen, tap a grass cell once',
      action: 'Preview it there; tap the same cell again to place it (clearing a wood works the same way)',
    },
    {
      input: 'Tap a house, then a house beside it',
      action: 'Merge the two into a manor',
    },
    {
      input: 'Pick the lumber camp, then tap a wood beside a camp',
      action: 'Clear the wood to grass, freeing a cell',
    },
    {
      input: 'Tap a market',
      action: 'Trade two tiles of one kind for a gift building, once a round',
    },
    {
      input: 'Undo last tile',
      action: 'Take back the last placement, clearing or merge, once per round',
    },
    {
      input: 'Island button',
      action: 'Pick a campaign level, the island of the day, or type an island number; Feats there shows the feats and tile skins',
    },
    {
      input: 'Sail on',
      action: 'Once a kingdom is finished, settle the next island of its chain',
    },
  ],
  loop: [
    'Each turn draws three tiles from the pouch, and you pick one.',
    'Place it on grass where its neighbours make it score the most.',
    'Work towards the royal decree, a side goal that pays +8 points and a crown.',
    'Reach the round goal (20 points in round 1) to refill the pouch.',
    'Choose one of the two royal gifts, such as more towers or a new building.',
  ],
  tips: [
    'Buildings only go on grass, but lakes and forests next to them add points.',
    'A placement also changes what the buildings beside it score, so the whole board counts.',
    'Farms like lakes, houses like farms, and a tower scores houses around it but hates another tower beside it.',
    'Buildings joined to the castle by a chain of buildings and roads pay +1 each when the kingdom is finished.',
    'Each season doubles the score of some buildings when you place them, like farms at the Harvest festival.',
    'From round 3 an omen warns of a flood or a storm next round, so you have a round to prepare.',
    'Out of room? Merging two houses into a manor frees a cell.',
    'Harbours also go on the coast and score each side facing the sea; a temple scores more the further it stands from towers.',
    'Sail on after a kingdom to a neighbouring island with the sea cut into its shape and a building found only there. Your harbours ship tiles to it, and its harbours pay +2 each at the end.',
    'Kingdom feats, like a farm with 3 lakes beside it, unlock new paints for the tiles.',
  ],
};

/** US English only changes the spelling. */
const us = (text: string) => text.replace(/neighbour/g, 'neighbor').replace(/arbour/g, 'arbor');
const enUS: HowToPlay = {
  goal: us(en.goal),
  controls: en.controls.map((c) => ({ input: us(c.input), action: us(c.action) })),
  loop: en.loop.map(us),
  tips: en.tips.map(us),
};

const de: HowToPlay = {
  goal: 'Setze Gebäude auf deine Insel und sammle so viele Punkte wie möglich. Das Königreich endet, wenn der Beutel leer ist oder nichts mehr passt.',
  controls: [
    {
      input: 'Ein Plättchen anklicken oder antippen',
      action: 'Eines der drei Plättchen wählen, die in diesem Zug gezogen wurden',
    },
    {
      input: 'Über ein Grasfeld fahren',
      action: 'Zeigen, was das Gebäude dort bringen würde, und von welchen Nachbarn',
    },
    {
      input: 'Ein Grasfeld anklicken oder antippen',
      action: 'Das Gebäude setzen; die anderen beiden Plättchen gehen zurück in den Beutel',
    },
    {
      input: 'Auf einem Touchscreen ein Grasfeld einmal antippen',
      action: 'Die Vorschau dort zeigen; dasselbe Feld noch einmal antippen, um zu setzen (Roden geht genauso)',
    },
    {
      input: 'Ein Haus antippen, dann ein Haus daneben',
      action: 'Die beiden zu einem Herrenhaus vereinen',
    },
    {
      input: 'Das Holzfällerlager wählen, dann einen Wald neben einem Lager antippen',
      action: 'Den Wald zu Gras roden und so ein Feld frei machen',
    },
    {
      input: 'Einen Markt antippen',
      action: 'Einmal pro Runde zwei Plättchen einer Art gegen ein Geschenkgebäude tauschen',
    },
    {
      input: 'Letztes Plättchen zurück',
      action: 'Das letzte Setzen, Roden oder Vereinen zurücknehmen, einmal pro Runde',
    },
    {
      input: 'Insel-Taste',
      action: 'Ein Kampagnenlevel, die Insel des Tages oder eine Inselnummer wählen; dort zeigt Taten die Taten und Plättchenfarben',
    },
    {
      input: 'Weitersegeln',
      action: 'Nach einem fertigen Königreich die nächste Insel seiner Kette besiedeln',
    },
  ],
  loop: [
    'Jeder Zug zieht drei Plättchen aus dem Beutel, und du wählst eines.',
    'Setze es auf Gras, wo seine Nachbarn ihm die meisten Punkte bringen.',
    'Arbeite auf den königlichen Erlass hin, ein Nebenziel, das +8 Punkte und eine Krone bringt.',
    'Erreiche das Rundenziel (20 Punkte in Runde 1), um den Beutel aufzufüllen.',
    'Wähle eines der zwei königlichen Geschenke, etwa mehr Türme oder ein neues Gebäude.',
  ],
  tips: [
    'Gebäude stehen nur auf Gras, aber Seen und Wälder daneben bringen Punkte.',
    'Ein neues Gebäude ändert auch, was die Gebäude daneben bringen, also zählt das ganze Brett.',
    'Äcker mögen Seen, Häuser mögen Äcker, und ein Turm zählt die Häuser ringsum, verträgt aber keinen Turm neben sich.',
    'Gebäude, die über eine Kette aus Gebäuden und Wegen mit der Burg verbunden sind, bringen am Ende je +1.',
    'Jede Jahreszeit verdoppelt die Punkte mancher Gebäude beim Setzen, etwa Äcker beim Erntefest.',
    'Ab Runde 3 warnt ein Omen vor einer Flut oder einem Sturm in der nächsten Runde, so bleibt dir eine Runde zur Vorbereitung.',
    'Kein Platz mehr? Zwei Häuser zu einem Herrenhaus zu vereinen macht ein Feld frei.',
    'Häfen stehen auch an der Küste und zählen jede Seite zum Meer; ein Tempel bringt mehr, je weiter er von Türmen steht.',
    'Segle nach einem Königreich weiter zu einer Nachbarinsel, in die das Meer schneidet, mit einem Gebäude, das es nur dort gibt. Deine Häfen schicken ihr Plättchen, und ihre Häfen bringen am Ende je +2.',
    'Taten des Königreichs, etwa ein Acker mit 3 Seen daneben, schalten neue Farben für die Plättchen frei.',
  ],
};

export const howToPlay: HowToPlay = byLanguage({ en, 'en-US': enUS, de });
