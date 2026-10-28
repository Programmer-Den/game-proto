import type { Translation } from '../../../../shared/i18n';
import type en from './en';

/** Shrine Stack's texts in German. */
const de: Translation<typeof en> = {
  // Blessings: name and card text
  broadName: 'Breite Steine',
  broadText: 'Der oberste Stein wird 40 breiter, bis zur Breite des Sockels.',
  calmName: 'Stille Winde',
  calmText: 'Steine schwingen ab jetzt 15 % langsamer.',
  steadyName: 'Ruhige Hände',
  steadyText: 'Perfekte Würfe fallen leichter: 6 Pixel mehr Spielraum.',
  goldenName: 'Goldene Gabe',
  goldenText: 'Jeder gesetzte Stein bringt 1 Gunst mehr.',
  graceName: 'Steinmetzgnade',
  graceText: 'Der nächste Stein, der danebengeht, wird aufgefangen statt verloren.',

  // Shop
  slowName: 'Langsamer Fall',
  widerName: 'Breiterer Stein',

  // Stone kinds: name, short name and what it does
  normalName: 'Normaler Stein',
  normalShort: 'Normal',
  heavyName: 'Schwerer Stein',
  heavyShort: 'Schwer',
  lightName: 'Leichter Stein',
  lightShort: 'Leicht',

  // Trials
  perfectTrial: '3 perfekte',
  keepTrial: '80 % halten',

  // Curses
  hasteName: 'Hast',
  hasteText: 'Steine schwingen 30 % schneller',
  brittleName: 'Spröde',
  brittleText: 'jeder Schnitt bricht 6 mehr ab',
  dimName: 'Dämmer',
  dimText: 'keine Falllinie',

  // Materials: name and button text
  limestoneName: 'Kalkstein',
  limestoneShort: 'schlicht',
  marbleName: 'Marmor',
  marbleShort: 'knapp, x2 Gunst',
  sandstoneName: 'Sandstein',
  sandstoneShort: 'leicht, 1/2 Gunst',
  basaltName: 'Basalt',
  basaltShort: 'schwer, x2 Prüfung',

  // Patrons: name, boon and bane
  gildedName: 'Die Goldene Hand',
  gildedBoon: 'Jeder Stein bringt 1 Gunst mehr.',
  gildedBane: 'Keine Steinmetzgnade: ein Fehlwurf beendet immer den Lauf.',
  handsName: 'Der Vielhändige',
  handsBoon: 'Ausgewogene Ebenen bieten vier Segen.',
  handsBane: 'Steine schwingen 10 % schneller.',
  patientName: 'Der Geduldige Steinmetz',
  patientBoon: 'Steine schwingen 10 % langsamer.',
  patientBane: 'Perfekte Würfe bringen keine Extra-Gunst.',
  stormName: 'Der Sturmrufer',
  stormBoon: 'Perfekte Würfe haben 3 Pixel mehr Spielraum.',
  stormBane: 'Böen wehen ab Ebene 6, nicht erst nach der Krone.',

  // Panel
  hint: 'Tippe irgendwo, um den Stein fallen zu lassen',
  title: 'Shrine Stack',
  swap: 'Tausch (R)',
  lean: 'Neigung',
  leanFrom: 'Neigung ab Ebene {tier}',
  blessings: 'Segen',
  goal: 'Ziel: Ebene {tier} krönen',
  gildedGoal: 'Ebene {tier} vergoldet: x{mult} Gunst',
  rules: 'Tippen lässt einen Stein fallen.\nÜberhänge brechen ab.\n3/4 aufsetzen für Balance.',
  tier: 'Ebene {tier}',
  tierSky: 'Ebene {tier}  Himmel',
  favour: 'Gunst {n}',
  built: 'Gebaut {built}  Rekord {best}',
  next: 'Nächster: {kind}',
  trial: 'Prüfung: {trial} {done}/{of}',
  trialFailed: 'Verfehlt: {trial}',
  trialsFrom: 'Prüfungen ab Ebene {tier}',
  curse: 'Fluch: {curse} x{mult}',
  materialTier: 'Ebene aus {material}',
  patron: '{patron}',
  choosePatron: 'Wähle einen Schutzherrn',
  hold: 'Halten: {kind}',
  holdNothing: 'Halten: nichts',
  reserveFrom: 'Reserve ab Ebene {tier}',
  gust: 'Böe {arrows} {n}',
  calmAir: 'Windstille',
  blessingCount: '{blessing} x{n}',
  graceHeld: '{blessing} ({n} bereit)',
  graceBought: 'Gnade gekauft ({n} bereit)',
  noBlessings: 'Noch keine',

  // Popups and banners
  perfectPopup: 'Perfekt! +{n}',
  caught: 'Der Stein ist aufgefangen: versuch es noch einmal',
  trialPassed: 'Prüfung bestanden! +{n}',
  trialFailedPopup: 'Prüfung verfehlt',
  toppled: 'Die Ebene stürzt ein!',
  toppledFavourLeft: 'Zu weit nach links geneigt: -{n} Gunst',
  toppledFavourRight: 'Zu weit nach rechts geneigt: -{n} Gunst',
  regrown: 'Nachgewachsen +{n}',
  inHand: '{kind} in der Hand',
  watchesOver: '{patron} wacht über dich',
  crowned: 'Der Schrein ist gekrönt!',
  tierStands: 'Ebene {tier} steht',
  gildedTier: 'Ebene {tier} ist vergoldet',
  gildedFavour: 'x{mult} Gunst',
  gildedTierFavour: 'Ebene {tier} ist vergoldet: x{mult} Gunst',
  altarTier: 'Ebene {tier} ist ein Himmelsaltar',
  altarFavour: 'x{mult} Gunst und ein Segen',
  altarTierFavour: 'Ebene {tier} ist ein Himmelsaltar: x{mult} Gunst',
  altarGoal: 'Nächster Himmelsaltar: Ebene {tier}, x{mult}',
  cursedWith: 'Verflucht mit {curse}: x{mult} Gunst',
  blessingYours: '{blessing} gehört dir',
  intoSky: 'In den endlosen Himmel',
  mindGusts: 'Achte auf die Böen',

  // Breaks between tiers
  skyPick: 'In den endlosen Himmel: wähle einen Stein',
  wobbly: 'Ebene {tier} wackelt: diesmal kein Segen',
  balanced: 'Ebene {tier} ausgewogen: wähle einen Segen',
  altarBlessing: 'Himmelsaltar {tier}: wähle einen Segen',
  reroll: 'Würfeln',
  spendFavour: 'Gunst ausgeben (du hast {n})',
  bought: 'ok',
  stoneFor: 'Stein für Ebene {tier}: {material}',
  patronTitle: 'Wähle einen Schutzherrn für diesen Tempel',
  patronSub: 'Seine Regel gilt für den ganzen Lauf',
  takeCurse: 'Fluch auf Ebene {tier}: {curse}, {text}. x{mult} Gunst.',
  buildOn: 'Weiterbauen',

  // End panel
  buildAgain: 'Neu bauen',
  keepBuilding: 'Weiterbauen',
  fallen: 'Der Stein ist gefallen',
  fallenSky: 'Dein gekrönter Schrein stieg in den Himmel,\nauf {tiers} Ebenen, für {favour} Gunst.',
  fallenStood: {
    one: 'Dein Schrein stand {n} Ebene hoch,\n{balanced} davon ausgewogen, für {favour} Gunst.',
    other: 'Dein Schrein stand {n} Ebenen hoch,\n{balanced} davon ausgewogen, für {favour} Gunst.',
  },
  bestTiers: { one: 'Rekord {n} Ebene.', other: 'Rekord {n} Ebenen.' },
  crownedText: 'Alle {tiers} Ebenen stehen,\n{balanced} davon ausgewogen, für {favour} Gunst.\n\nWeiter in den windigen Himmel bauen?',
};

export default de;

/** Texts that are the same in German, so the translation check doesn't flag them. */
export const keepEnglish: (keyof typeof en)[] = ['title', 'basaltName', 'blessingCount', 'bought'];
