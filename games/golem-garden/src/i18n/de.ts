import type { Translation } from '../../../../shared/i18n';
import type en from './en';

/** Golem Garden's texts in German. */
const de: Translation<typeof en> = {
  // Golems: name, name inside a sentence, the tall seed card's two lines and what it does
  pebbleName: 'Kieselgolem',
  pebbleLower: 'Kieselgolem',
  pebbleCard: 'Kiesel-\ngolem',
  pebbleBlurb: 'Wirft Steine',
  mossName: 'Moosgolem',
  mossLower: 'Moosgolem',
  mossCard: 'Moos-\ngolem',
  mossBlurb: 'Verlangsamt',
  thornName: 'Dorngolem',
  thornLower: 'Dorngolem',
  thornCard: 'Dorn-\ngolem',
  thornBlurb: 'Sticht ringsum',
  hedgeName: 'Hecke',

  // Level 3 forms: name and what it does
  boulderName: 'Brocken',
  boulderBlurb: 'doppelter Schaden, spritzt, langsamer',
  slingName: 'Schleuder',
  slingBlurb: 'schnelle Würfe, große Reichweite',
  bogName: 'Moor',
  bogBlurb: 'bremst 3 s lang fast völlig',
  sporeName: 'Sporen',
  sporeBlurb: 'bremst jeden Schädling in Reichweite',
  brambleName: 'Ranke',
  brambleBlurb: 'reicht 60 px weiter',
  barbName: 'Stachel',
  barbBlurb: 'tiefere Stiche, durchdringt Panzer',

  // Targeting: the Aim chip's name and what the golem aims at
  firstName: 'Vorne',
  firstBlurb: 'den vordersten Schädling',
  strongestName: 'Stärkste',
  strongestBlurb: 'den gesündesten Schädling',
  weakestName: 'Schwache',
  weakestBlurb: 'den schwächsten Schädling',
  flyersName: 'Flieger',
  flyersBlurb: 'zuerst auf Krähen',

  // Boons: name and card text
  longMossName: 'Langes Moos',
  longMossBlurb: 'Jede Verlangsamung hält anderthalbmal so lange',
  sunnyRowName: 'Sonnige Reihe',
  sunnyRowBlurb: 'Golems in einer Reihe reichen 20 px weiter',
  newGrowthName: 'Neuer Trieb',
  newGrowthBlurb: 'Zwei Blätter des Herzholzes wachsen nach',
  thickHedgesName: 'Dichte Hecken',
  thickHedgesBlurb: 'Ab jetzt gepflanzte Hecken halten anderthalbmal so viel aus',
  sharpRocksName: 'Scharfe Steine',
  sharpRocksBlurb: 'Kieselgolems machen 20 % mehr Schaden',
  richCompostName: 'Reicher Kompost',
  richCompostBlurb: 'Kompost bringt bis zu 15 Saft mehr',

  // Thorny twists
  noHedgesName: 'Keine Hecken',
  doubleCrowsName: 'Doppelte Krähen',
  leanStartName: 'Magerer Start',

  // Gardens: name and card text
  meadowName: 'Wiese',
  meadowBlurb: 'Ein gewundener Weg',
  forkedBrookName: 'Gabelbach',
  forkedBrookBlurb: 'Der Weg teilt sich um ein Beet und trifft sich wieder',
  twoGatesName: 'Zwei Tore',
  twoGatesBlurb: 'Schädlinge kommen durch zwei Tore',

  // HUD
  title: 'Golem Garden',
  gardenTag: '{garden}  ·  Gärten',
  gardenTagThorny: '{garden}  ·  dornig',
  waveTag: 'Welle {n}',
  harvestAt: 'Ernte bei {wave}',
  laurelAt: 'Lorbeer bei {wave}',
  harvested: 'geerntet {stars}',
  best: 'Rekord: {n}',
  bloomFull: 'Herzholz in Blüte',
  bloomCount: 'Herzholz-Blüte {n}/{goal}',
  thornUnlocked: 'Dorngolem freigeschaltet',
  unlocksThorn: 'schaltet Dorngolem frei',

  // Seed panel, preview and wave button
  seeds: 'Samen',
  bloomsAfter: 'Blüht nach',
  bloomWaves: { one: '{n} Welle', other: '{n} Wellen' },
  previewNext: 'Nächste: Welle {n}',
  previewQueen: 'Welle {n}: Königin!',
  startWave: 'Welle {n} starten',
  callWave: 'Welle {n} rufen',
  earlyBonus: '+{n} früher',
  harvestWave: 'Erntewelle',
  squashEvery: 'alle zerquetschen',
  waveComing: 'Welle {n} …',
  stillComing: 'kommt noch',
  squashQueen: 'Königin lebt noch',
  gardenLost: 'Garten verloren',

  // Golem menu chips
  formChip: '{form}\n{cost} Saft',
  back: 'Zurück',
  raiseGrowing: 'Stärken\nwächst',
  raiseTop: 'Stärken\n{top}',
  maxLevel: 'max.',
  raiseChip: 'Stärken\n{cost} Saft',
  formPickChip: 'Form\n{cost} Saft',
  aimAll: 'Ziel\nalle nahen',
  aimChip: 'Ziel\n{target}',
  moveChip: 'Umsetzen\n{cost} Saft',
  uprootChip: 'Ausreißen\n+{n} Saft',

  // Hints
  hintMove: 'Tippe auf Erde, um den {golem} für {cost} Saft dorthin zu setzen',
  hintForm: '{form}: {blurb}',
  hintFormPick: 'Stufe 3 legt die Form für immer fest: {a} oder {b}',
  hintFormed: '{golem} ({form}): {blurb}',
  hintGrowing: '{golem}, wächst noch',
  hintLevel: '{golem}, Stufe {n}',
  hintComboSlowed: '{golem} St. {n}: Moos-Kombo, härter gegen gebremste',
  hintComboPricks: '{golem} St. {n}: Moos-Kombo, sticht doppelt',
  hintAims: '{level}, zielt auf {target}',
  hintPicksForm: '{level}. Stufe 3 wählt eine Form: {a} oder {b}',
  hintTapAgain: '{level}. Nochmal tippen zum Schließen',
  hintTapGolem: '{level}. Antippen für das Golem-Menü',
  hintHedge: 'Eine Hecke: Schädlinge halten und nagen daran ({n} übrig)',
  hintNoHedges: 'Dorniger Garten: hier keine Hecken',
  hintPlantHedge: 'Tippe auf ein Wegfeld für eine Hecke; Schädlinge nagen sich durch',
  hintAllLeaves: 'Das Herzholz hat alle Blätter',
  hintRegrowLater: 'Blätter wachsen zwischen den Wellen nach',
  hintRegrow: 'Tippe aufs Herzholz für ein neues Blatt: {n} Saft',
  hintRegrowPoor: 'Tippe aufs Herzholz für ein neues Blatt: {n} Saft (zu wenig)',
  hintQueen: 'Die Schneckenkönigin verschleimt Golems an ihrer Spur',
  hintCompost: 'Kompost: eine Welle bringt {pct} % des übrigen Safts (bis {cap})',
  hintCombo: 'Golems neben einem Moosgolem bilden eine Kombo',
  hintPlant: 'Tippe auf Erde, um zu pflanzen',

  // Banners
  waveCleared: 'Welle {n} geschafft!  +{sap} Saft',
  waveCalled: 'Welle {n} früher gerufen!',
  calledPending: '+{sap} Saft, wenn Welle {n} weg ist',
  compostBonus: ', +{n} Kompost',
  harvestBanner: { one: 'Ernte! {stars} mit {n} Blatt', other: 'Ernte! {stars} mit {n} Blättern' },
  bloomBanner: 'Das Herzholz blüht: Dorngolem freigeschaltet!',
  budBanner: 'Eine Knospe öffnet sich am Herzholz ({n}/{goal})',
  queenComing: 'Die Schneckenkönigin kommt!',
  queenWave: 'Welle {n}: Die Schneckenkönigin kommt!',
  boonBanner: 'Gabe: {name}!',

  // Garden picker, harvest and game over
  overTitle: 'Das Herzholz ist gefallen',
  overText: 'Schädlinge fraßen das Herzholz in Welle {wave}. {kills} Schädlinge zerquetscht.\nRekord: {best} Wellen geschafft. Wähle einen Garten zum Neupflanzen.',
  thornyHarvestTitle: 'Dornige Ernte: Lorbeer gewonnen!',
  thornyHarvestText:
    'Welle {wave} im dornigen Garten {garden} geschafft, {heart} von {max} Blättern behalten.\nSein Lorbeer krönt nun die Karte des Gartens. Die Wellen gehen weiter: mach weiter oder pflanze einen anderen Garten.',
  harvestTitle: 'Ernte: {stars}',
  harvestCleared: {
    one: 'Welle {wave} geschafft, {heart} von {max} Blättern behalten: {n} Stern für {garden}.',
    other: 'Welle {wave} geschafft, {heart} von {max} Blättern behalten: {n} Sterne für {garden}.',
  },
  harvestThornyOpen: 'Seine dornige Variante ist offen.',
  harvestNext: '{garden} öffnet bei {need} Sternen; du hast {stars}.',
  harvestAllOpen: 'Jeder Garten ist offen.',
  harvestGoOn: 'Die Wellen gehen weiter: mach weiter oder pflanze einen anderen Garten.',
  chooseTitle: 'Wähle einen Garten',
  chooseText:
    'Ein neuer Garten beginnt bei Welle 1; dieser bleibt zurück. Dein Rekord ({best} Wellen),\ndeine Sterne und die Blüte des Herzholzes bleiben. {thorny} Sterne öffnen die dornige Variante eines Gartens.',
  thornyTag: 'Dornig · {twist}',
  thornyTagWon: 'Dornig · {twist} · Lorbeer',
  plantHere: '{stars}  Hier pflanzen',
  replantHere: '{stars}  Neu pflanzen',
  needsStars: { one: 'Braucht {n} Stern (du hast {have})', other: 'Braucht {n} Sterne (du hast {have})' },
  keepGoing: 'Weiter',

  // Boon pick
  boonTitle: 'Die Schneckenkönigin ist zerquetscht!',
  boonText: 'Wähle eine Gabe für diesen Garten; sie hält, bis du einen anderen pflanzt.',
  boonsTaken: 'Bisher genommen: {list}.',
  boonSun: 'Scheint auf Reihe {row}',
  boonLeaves: 'Jetzt {heart} von {max} Blättern',
  boonMoss: 'Bremsdauer {pct} %',
  boonHedge: 'Hecken halten {hp} aus',
  boonPebble: 'Kieselschaden +{pct} %',
  boonCompost: 'Kompost bis {cap}',
  boonTaken: '{detail} (schon {n}x)',
};

/** Texts that stay the same in German. */
export const keepEnglish: (keyof typeof en)[] = ['title', 'hintForm'];

export default de;
