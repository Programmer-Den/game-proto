import type { Translation } from '../../../../shared/i18n';
import type en from './en';

/** Bramblecrest's texts in German. */
const de: Translation<typeof en> = {
  // Places and the bosses' banners
  village: 'Moosfurt',
  woods: 'Brombeerwald',
  fen: 'Glimmermoor',
  shrine: 'Versunkener Schrein',
  belfry: 'Ertrunkener Glockenturm',
  thornmother: 'Die Dornenmutter',
  bellwraith: 'Der Glockengeist',

  // Speakers
  elderName: 'Älteste Wren',
  pipName: 'Pip',
  bakerName: 'Marla',
  catName: 'Keks',
  hermitName: 'Der alte Sedge',
  sign: 'Schild',
  wisp: 'Das Irrlicht',

  // Signs
  signGate: 'Norden: Brombeerwald. Die Dornen sind diesen Frühling wiedergekommen.',
  signWoods: 'Der Versunkene Schrein liegt im Nordosten. Nachts Vorsicht vor Schnecken.',
  signShrine: 'In den Stein gemeißelt: „Was der Dornbusch nimmt, gibt die Ranke zurück.“',
  signBells: 'Neben der Tür eingeritzt: „Zuerst die tiefste Stimme, dann die kleinste. Zuletzt die dazwischen.“',
  signWages: 'Notiz eines Glöckners: „Unseren Lohn bewahrten wir hinter den nassen Steinen auf, wo der Fluss nicht hinkommt.“',

  // The journal line, one per quest step
  objStart: 'Sprich mit der Ältesten Wren auf dem Platz',
  objBlade: 'Hol die alte Klinge aus dem Schuppen',
  objThorns: 'Schneide die Dornen am Nordtor weg',
  objShrine: 'Finde den Versunkenen Schrein im Brombeerwald',
  objReturn: 'Bring der Ältesten Wren die Neuigkeiten',
  objDone: 'Nachts läutet eine Glocke. Frag die Älteste Wren danach',
  objBell: 'Frag den alten Sedge im Glimmermoor nach der Glocke',
  objBelfry: 'Finde den Ertrunkenen Glockenturm im Glimmermoor',
  objHome: 'Sag der Ältesten Wren, dass die Glocke schweigt',
  objEnd: 'Finde alle Mondsteine oder bezwinge die Sanduhren',

  // Pip
  pipNook1: 'Hinter dem Schuppen steckt ein Felsen zwischen den Bäumen fest.',
  pipNook2: 'Ich hab mal mein Ohr drangelegt. Dahinter summt etwas, so wie die Leuchtsteine!',
  pipThanks: 'Du hast den Leuchtstein gefunden! Oma sagt, sie fallen vom Mond, wenn keiner hinsieht.',
  pipPond1: 'Mir ist ein Leuchtstein in die Büsche am Teich gefallen.',
  pipPond2: 'Die Büsche sind mir zu stachelig. Vielleicht hilft ein Schwert?',

  // Marla the baker
  bakerBread: 'Frisches Brot für die Nachtwache! Die Älteste Wren hat dich gesucht, Schätzchen.',
  bakerTrees1: 'Pass auf im Wald. Meine Mutter sagte, zwei der Bäume dort werfen nie einen Schatten.',
  bakerTrees2: 'Geh einfach durch sie hindurch, sagte sie. Niemand hat ihr geglaubt.',

  // Biscuit the cat
  catAsleep: 'Keks schläft, sehr zufrieden mit sich.',
  catGift: 'Keks legt dir etwas Glänzendes vor die Füße!',
  catStretch: 'Keks rollt sich herum und streckt sich.',
  catPurr: 'Keks, die Katze, schnurrt dich an.',

  // Old Sedge
  hermitBell1: 'Die Glocke? Ja, ich höre sie auch. Sie läutet unter dem Moor, im alten Glockenturm, den das Wasser verschluckt hat.',
  hermitBell2: 'Seine Tür liegt nördlich des Pfads, östlich vom großen Tümpel, voller Felsbrocken. Die bewegt keine Klinge.',
  hermitBell3: 'Nimm die hier. Glockensamen. Pflanz einen, tritt zurück, und er platzt so heftig, dass Stein bricht.',
  hermitRefill: 'Schon keine Glockensamen mehr? Hier, eine frische Handvoll. Schlag ab und zu Büsche; die Hülsen verstecken sich darin.',
  hermitQuiet1: 'Die Glocke schweigt. Ich habe eine ganze Nacht durchgeschlafen, zum ersten Mal seit Jahren.',
  hermitQuiet2: 'Felsen rollen nicht von allein in Baumringe, weißt du. Westlich vom Fluss gibt es einen.',
  hermitRingers1: 'Die Glöckner, die den Turm bauten, haben eingemauert, was der Fluss nicht kriegen sollte.',
  hermitRingers2: 'Hüte dich vor den Fröschen da unten. Die beißen.',
  hermitHello1: 'Hm. Ein Ritter, hier draußen? Heutzutage geht keiner mehr über den Fluss.',
  hermitHello2: 'Drei steinerne Wächter starren auf ein Stück Schlamm. Da grabe ich nie. Bringt Unglück, sag ich.',
  hermitHello3: 'Und das Irrlicht ... es flieht vor jedem, der ihm nachjagt. Folg ihm bis zum Ende und sieh selbst.',

  // Elder Wren
  elderStart1: 'Ah, da bist du ja. Die Laternen brennen, aber die Dornen sind wieder über das Nordtor gewachsen.',
  elderStart2: 'Die alte Klinge deines Großvaters liegt im Schuppen, die Straße entlang nach Osten. Holst du sie mir?',
  elderBlade1: 'Das ist sie. Sie erinnert sich noch an seine Hand.',
  elderBlade2: 'Schneide die Dornen am Nordtor weg. Irgendetwas im Wald ruft sie immer wieder zurück.',
  elderShed: 'Der Schuppen liegt die Straße entlang nach Osten, hinter Marlas Öfen. Die Truhe steht davor.',
  elderThorns: 'Das Tor ist oben an der Hauptstraße. Gib den Dornen einen ordentlichen Hieb.',
  elderShrine: 'Die Alten sagen, vor langer Zeit sei in diesem Wald ein Schrein versunken. Wenn die Dornen irgendwoher kommen, dann von dort.',
  elderReturn1: 'Du bist zurück! Und die Dornen am Tor welken schon, während wir reden.',
  elderReturn2: 'Eine Dornenkönigin, unter dem Schrein? Dann ist das erst der Anfang.',
  elderReturn3: 'Ruh dich jetzt aus. Das Dorf ist stolz auf dich.',
  elderDone1: 'Hörst du das? Eine Glocke, die um Mitternacht unter dem Moor läutet. Jetzt jede Nacht, und lauter.',
  elderDone2: 'Im Glimmermoor gab es keine Glocke mehr, seit das Wasser den alten Glockenturm genommen hat.',
  elderDone3: 'Der alte Sedge lebt dort draußen. Frag ihn, was er weiß.',
  elderBell: 'Der alte Sedge hat eine Hütte im Glimmermoor, auf der anderen Seite des Flusses vom Wald.',
  elderBelfry: 'Die Glocke hat wieder geläutet, als du weg warst. Alle Laternen haben gleichzeitig geflackert.',
  elderHome1: 'Ein Geist in der Glocke? Und du hast ihn hinausgeläutet. Hör nur: nichts als die Frösche.',
  elderHome2: 'Die Erbauer des Schreins haben auch ihre Fehler eingemauert, heißt es. Horch nach hohlem Stein nahe seiner Tür.',
  elderHome3: 'Ruh dich jetzt aus. Das Moor kann eine Nacht warten.',
  elderEnd: 'Die Nacht ist lang, und das Moor glimmt noch. Na los.',
  elderTrials: 'Man sagt, die alten Sanduhren an den Türen von Schrein und Glockenturm leuchten wieder. Dreh eine um, wenn du dich traust.',

  // Chests and doors
  empty: 'Leer.',
  unlocked: 'Das Schloss springt auf.',
  locked: 'Verschlossen. Ein kleiner Schlüssel fehlt.',
  barred: 'Eisengitter. Irgendetwas muss sie heben.',
  thornyDoor: 'Dornige Ranken halten sie verschlossen.',
  foundSword: 'Du hast die Alte Klinge gefunden! Leertaste, J oder die Schwerttaste schwingt sie. Sie schneidet auch Büsche und Dornen.',
  foundHookvine: 'Du hast die Hakenranke gefunden! Q, L oder die Rankentaste wirft sie. Sie zieht dich zu goldenen Pfosten, über Wasser und Gruben.',
  foundKey: 'Du hast einen kleinen Schlüssel gefunden. Er öffnet eine verschlossene Tür an diesem Ort.',
  foundHeart: 'Du hast ein Herzgefäß gefunden! Ein Herz mehr.',
  foundOil: 'Du hast Laternenöl gefunden. Deine Laterne leuchtet jetzt heller.',
  foundSeeds: 'Du hast {n} Glockensamen! B, X oder die Samentaste pflanzt einen. Tritt zurück: er platzt und bricht rissigen Stein.',
  gotSeeds:
    'Du hast {n} Glockensamen! B, X oder die Samentaste pflanzt einen vor dir. Tritt zurück: er platzt, bricht rissigen Stein und Felsbrocken und verletzt alles in der Nähe.',

  // Quests and toasts
  newQuestBlade: 'Neue Aufgabe: Die Alte Klinge',
  doneQuestBlade: 'Aufgabe erfüllt: Die Alte Klinge',
  newQuestBell: 'Neue Aufgabe: Die Ertrunkene Glocke',
  seedsRefilled: 'Glockensamen {n}',
  moonstone: 'Mondstein! {n} von {total}',
  glint: 'Etwas glitzert im Schlamm!',
  gateOpen: 'Das Nordtor ist offen',
  bellLow: 'BONG...',
  bellMid: 'DONG...',
  bellHigh: 'bim...',
  bellsWrong: 'Die Glocken klingen schief und verstummen.',
  bellsRight: 'Die Glocken klingen rein. Irgendwo knirschen Eisengitter nach oben.',
  noSeeds: 'Keine Glockensamen mehr. Schlag Büsche oder frag den alten Sedge.',
  barsOpen: 'Irgendwo knirschen Eisengitter nach oben.',
  wake: 'Du erwachst im Laternenlicht, ein wenig zerschrammt.',
  bulbDown: 'Die Knolle liegt am Boden. Schlag zu!',
  bellTipped: 'Die Glocke kippt um. Triff, was sich darin versteckt!',
  clang: 'Klong! Die Bronze ist zu dick.',
  wraithFlees: 'Der Glockengeist kreischt und flieht in seine Glocke!',
  wispVoice: 'Eine Stimme wie Wind im Schilf: „Du hast mich gefunden. Jetzt finde den Rest des Mondes.“',

  // Bosses beaten
  thornmotherBeaten: 'Die Dornenmutter welkt zu einem Haufen trockener Ranken.',
  thornmotherWayOut: 'Oben in der Halle hat sich ein Ausgang geöffnet. Die Älteste Wren sollte davon hören.',
  wraithBeaten: 'Der Glockengeist zerfasert zu Nebel, und die große Glocke springt entzwei.',
  wraithQuiet: 'Das Moor wird still. Die Älteste Wren will es sicher von dir hören.',

  // Chapter end cards
  chapterOne: 'Kapitel eins: Die Dornenmutter',
  chapterTwo: 'Kapitel zwei: Die Ertrunkene Glocke',
  endStats: 'Mondsteine {n} von {total}   ·   Besiegte Feinde {beaten}   ·   Stürze {falls}',
  endOneAll: 'Alle Mondsteine summen zugleich. Fern im Glimmermoor öffnet etwas Gewaltiges ein Auge und lächelt.',
  endOneSome: 'Ein kaltes Licht flackert über dem Glimmermoor. Ein Teil des Mondes fehlt noch.',
  endOneFew: 'In Moosfurt brennen die Laternen weiter. Im Wald ist es still, fürs Erste.',
  endTwoAll: 'Die Mondsteine klingen wie kleine Glocken, alle zusammen. Hoch über dem Moor klingt der Mond zurück.',
  endTwoSome: 'Endlich ist das Moor still. Irgendwo unter dem Wasser summen noch ein paar letzte Steine.',
  endTwoFew: 'Die Frösche singen über dem ertrunkenen Glockenturm. Die Nacht ist still, fürs Erste.',
  keepExploring: 'Weiter erkunden',
  newGame: 'Neues Spiel',

  // The hourglass trials
  hourglassRead: 'Eine alte Sanduhr voll leuchtendem Sand. Dreh sie um, und jeder Feind hier erwacht wieder, und der Herr dieses Ortes erhebt sich stärker. Besiege ihn so schnell du kannst.',
  hourglassBest: 'Deine Bestzeit hier: {time}.',
  trialStart: 'Der Sand rinnt!',
  trialBusy: 'Der Sand rinnt schon.',
  trialLost: 'Der Sand steht still. Die Prüfung ist vorbei.',
  trialDone: 'Prüfung geschafft in {time}!',
  trialRecord: 'Eine neue Bestzeit!',
  trialBestIs: 'Deine Bestzeit bleibt {time}.',

  // The moonstone page
  stonesTitle: 'Mondsteine',
  stonesTotal: '{n} von {total} gefunden',
  trialsTitle: 'Sanduhr-Prüfungen',
  trialBest: '{place}: {time}',
  trialNone: '{place}: noch nicht gelaufen',
  closePage: 'Tippen oder N zum Schließen',

  // HUD
  keys: 'Schlüssel {n}',
  seeds: 'Samen {n}',
  readOn: 'Tippen oder Leertaste',
};

/** Names and bell sounds that stay as they are in German. */
export const keepEnglish: (keyof typeof en)[] = ['pipName', 'bakerName', 'bellLow', 'bellMid', 'trialBest'];

export default de;
