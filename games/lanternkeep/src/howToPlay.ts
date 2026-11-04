import type { HowToPlay } from '../../../shared/howToPlay';
import { byLanguage } from '../../../shared/i18n';

const en: HowToPlay = {
  goal: 'Light enough lanterns by nightfall to keep the hearths burning. Keep ten nights for the Great Festival; lose all three hearths and the keep falls.',
  controls: [
    {
      input: 'Click or tap a lantern',
      action: "Send an idle moth to light it, or to refill a lit one's oil",
    },
    {
      input: 'Click or tap a bat',
      action: 'Send an idle moth to chase it off',
    },
    {
      input: 'Click or tap an upgrade',
      action: 'Between nights: buy its next level, put a fill in the cask or rekindle a hearth',
    },
    {
      input: 'Click or tap an idle moth on its jar',
      action: 'With the second jar bought: move it to rest at the other jar',
    },
    {
      input: 'Click or tap a district',
      action: 'At every fifth nightfall: move the keep there, or stay',
    },
    {
      input: 'Click or tap a curse / Go on',
      action: 'At every nightfall from the tenth: take a curse for more pay, or take none',
    },
    { input: 'Next dusk', action: "Start the next night's dusk" },
    {
      input: 'Village',
      action: 'On the night panel: build a smithy, a chandler or a chapel, kept for every game after',
    },
    {
      input: 'Keep going / Set sail / Climb / New keep',
      action: 'Play on after the Great Festival, sail to the harbour or climb to the monastery, or start again after a loss',
    },
    {
      input: 'Daily night',
      action: "On the night panel or after a loss: play today's daily night, once a day",
    },
  ],
  loop: [
    'Tap a lantern and a moth flies out from the jar to light it, then flies home.',
    'Lit lanterns burn oil and go dark when it runs out, so tap them again to refill.',
    'Watch for the gust warning and keep a moth sitting on the lantern it names.',
    'At nightfall each lit lantern pays 5 coins, and all of them lit pays 10 more.',
    'Spend your coins on upgrades, then start the next dusk with one more lantern.',
  ],
  tips: [
    "Dusk lasts 45 seconds, and a full lantern burns for 20 on Normal, so don't light them all too early.",
    'Fewer than three in five lanterns lit at nightfall puts out one of your three hearths.',
    'Saving a lantern with under 15% oil left is a close call and pays 2 coins at once.',
    "Meet the herald's order on the card under the HUD for 15 more coins at nightfall.",
    'A tap while every moth is busy waits in line, up to two taps.',
    'From night 3 bats come to snuff lanterns, and refills draw on the oil cask.',
    'Lanterns side by side form chains that pay 8 coins when all of them burn at nightfall.',
    'From night 6 a moth rests 6 seconds after its fourth flight of a dusk; Nectar shortens it.',
    'Lost a hearth? The Hearth card rekindles it between nights for 40, then 80, then 120 coins.',
    'From the tenth nightfall each curse you take makes the nights harder and every nightfall pay 25% more.',
    'In the harbour the tide floods the low quay twice a dusk, and ships pay 6 coins if their lantern is lit when they arrive.',
    'The Harbour Festival gives a boon you keep in every later game.',
    'Moths grow traits from the flights they fly, kept from game to game: swift, frugal and gust-proof.',
    'Every night kept adds a house to the village below the keep; with enough houses, coins build a smithy (cheaper cask fills), a chandler (a spare moth) or a chapel (it spares the first hearth a game loses).',
    'The nights turn through the seasons, three nights each: summer dusks are short and stormy, autumn brings fog, and winter dusks are long but snow slows the moths.',
    'In the monastery avalanches bury the low path twice a dusk: a moth sitting on a path lantern keeps it, and a buried one takes 2 seconds to dig out. Ring the named bell tower before the snow comes to warn a pilgrim for 6 coins.',
  ],
};

const de: HowToPlay = {
  goal: 'Zünde bis zum Einbruch der Nacht genug Laternen an, damit die Herdfeuer weiterbrennen. Halte zehn Nächte für das Große Fest; erlöschen alle drei Herdfeuer, fällt die Burg.',
  controls: [
    {
      input: 'Eine Laterne anklicken oder antippen',
      action: 'Eine freie Motte schicken, um sie anzuzünden oder das Öl einer brennenden nachzufüllen',
    },
    {
      input: 'Eine Fledermaus anklicken oder antippen',
      action: 'Eine freie Motte schicken, um sie zu verjagen',
    },
    {
      input: 'Eine Verbesserung anklicken oder antippen',
      action: 'Zwischen den Nächten: die nächste Stufe kaufen, das Fass füllen oder ein Herdfeuer entfachen',
    },
    {
      input: 'Eine freie Motte an ihrem Glas anklicken oder antippen',
      action: 'Mit dem zweiten Glas: sie zum Ruhen ans andere Glas schicken',
    },
    {
      input: 'Ein Viertel anklicken oder antippen',
      action: 'In jeder fünften Nacht: die Burg dorthin bringen oder bleiben',
    },
    {
      input: 'Einen Fluch anklicken oder antippen / Weiter',
      action: 'Bei jedem Einbruch der Nacht ab der zehnten: einen Fluch für mehr Lohn nehmen oder keinen',
    },
    { input: 'Nächste Nacht', action: 'Die Dämmerung der nächsten Nacht beginnen' },
    {
      input: 'Dorf',
      action: 'Im Nachtfenster: eine Schmiede, einen Kerzler oder eine Kapelle bauen, die für jedes spätere Spiel bleiben',
    },
    {
      input: 'Weiterspielen / In See stechen / Aufsteigen / Neue Burg',
      action: 'Nach dem Großen Fest weiterspielen, zum Hafen segeln oder zum Kloster aufsteigen, oder nach einer Niederlage neu beginnen',
    },
    {
      input: 'Nacht des Tages',
      action: 'Im Nachtfenster oder nach einer Niederlage: die heutige Nacht des Tages spielen, einmal am Tag',
    },
  ],
  loop: [
    'Tippe auf eine Laterne, und eine Motte fliegt aus dem Glas, zündet sie an und fliegt heim.',
    'Brennende Laternen verbrauchen Öl und gehen aus, wenn es leer ist, also tippe sie zum Nachfüllen erneut an.',
    'Achte auf die Böenwarnung und lass eine Motte auf der Laterne sitzen, die sie nennt.',
    'Bei Einbruch der Nacht bringt jede brennende Laterne 5 Münzen, und brennen alle, gibt es 10 mehr.',
    'Gib deine Münzen für Verbesserungen aus und beginne die nächste Dämmerung mit einer Laterne mehr.',
  ],
  tips: [
    'Die Dämmerung dauert 45 Sekunden, und eine volle Laterne brennt auf Normal 20, also zünde nicht alle zu früh an.',
    'Brennen bei Einbruch der Nacht weniger als drei von fünf Laternen, erlischt eines deiner drei Herdfeuer.',
    'Eine Laterne mit weniger als 15 % Öl zu retten, ist knapp und bringt sofort 2 Münzen.',
    'Erfülle den Auftrag des Herolds auf der Karte unter der Leiste für 15 Münzen mehr bei Einbruch der Nacht.',
    'Ein Tippen, während alle Motten unterwegs sind, wartet in der Reihe, bis zu zwei Mal.',
    'Ab Nacht 3 kommen Fledermäuse, um Laternen zu löschen, und Nachfüllen zehrt vom Ölfass.',
    'Laternen nebeneinander bilden Ketten, die 8 Münzen bringen, wenn alle bei Einbruch der Nacht brennen.',
    'Ab Nacht 6 ruht eine Motte nach ihrem vierten Flug einer Dämmerung 6 Sekunden; Nektar verkürzt das.',
    'Ein Herdfeuer verloren? Die Herd-Karte entfacht es zwischen den Nächten für 40, dann 80, dann 120 Münzen.',
    'Ab dem zehnten Einbruch der Nacht macht jeder genommene Fluch die Nächte schwerer, und jede Nacht zahlt 25 % mehr.',
    'Im Hafen überspült die Flut zweimal je Dämmerung den Kai, und Schiffe zahlen 6 Münzen, wenn ihre Laterne bei der Ankunft brennt.',
    'Das Hafenfest schenkt eine Gunst, die du in jedem späteren Spiel behältst.',
    'Motten bekommen durch ihre Flüge Eigenschaften, die von Spiel zu Spiel bleiben: flink, sparsam und windfest.',
    'Jede gehaltene Nacht baut ein Haus im Dorf unter der Burg; mit genug Häusern bauen Münzen eine Schmiede (billigere Fassfüllungen), einen Kerzler (eine Ersatzmotte) oder eine Kapelle (sie rettet das erste Herdfeuer eines Spiels).',
    'Die Nächte folgen den Jahreszeiten, je drei Nächte: Sommerdämmerungen sind kurz und stürmisch, der Herbst bringt Nebel, und Winterdämmerungen sind lang, doch Schnee bremst die Motten.',
    'Im Kloster begraben Lawinen zweimal je Dämmerung den unteren Pfad: eine Motte auf einer Pfadlaterne hält sie, und eine verschüttete braucht 2 Sekunden zum Freigraben. Läute vor dem Schnee den genannten Glockenturm, um einen Pilger für 6 Münzen zu warnen.',
  ],
};

/** US English spells the harbour's texts the US way. */
const enUS: HowToPlay = JSON.parse(JSON.stringify(en).replaceAll('harbour', 'harbor').replaceAll('Harbour', 'Harbor'));

export const howToPlay: HowToPlay = byLanguage({ en, 'en-US': enUS, de });
