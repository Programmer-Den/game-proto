/**
 * Anvilheart's texts in British English, the source `de.ts` and `en-US.ts` translate (see
 * `shared/i18n.ts`). The tables in `game/` name their texts by these keys.
 */
const en = {
  title: 'Anvilheart',

  // Swords, tier 1 up: name, and plural for the banner's counts
  rustyDagger: 'Rusty Dagger',
  rustyDaggers: 'Rusty Daggers',
  ironShortsword: 'Iron Shortsword',
  ironShortswords: 'Iron Shortswords',
  steelSword: 'Steel Sword',
  steelSwords: 'Steel Swords',
  knightsBlade: "Knight's Blade",
  knightsBlades: "Knight's Blades",
  silverSaber: 'Silver Saber',
  silverSabers: 'Silver Sabers',
  goldenClaymore: 'Golden Claymore',
  goldenClaymores: 'Golden Claymores',
  runeblade: 'Runeblade',
  runeblades: 'Runeblades',
  dragonslayer: 'Dragonslayer',
  dragonslayers: 'Dragonslayers',
  anvilheart: 'Anvilheart',
  anvilhearts: 'Anvilhearts',

  // Bucklers, tier 1 up
  woodenBuckler: 'Wooden Buckler',
  ironBuckler: 'Iron Buckler',
  steelBuckler: 'Steel Buckler',
  silverBuckler: 'Silver Buckler',
  goldenBuckler: 'Golden Buckler',

  // Upgrades: name and what it does
  bellowsName: 'Bellows',
  bellowsBlurb: 'forge faster',
  oreName: 'Fine Ore',
  oreBlurb: 'better blades',
  autoName: 'Auto Forge',
  autoBlurb: 'forges by itself',
  rowName: 'Fifth row',
  rowBlurb: 'four more anvils',
  barrelName: 'Quench barrel',
  barrelBlurb: 'holds one sword',

  // Edicts: name, what it does, and in short for the plaque
  shortageName: 'Iron shortage',
  shortageBlurb: 'the forge is half again as slow, every sale pays 25% more',
  shortageShort: 'slow forge, +25% on sales',
  tournamentName: 'Tournament season',
  tournamentBlurb: 'twice the adventurers, with a third less patience',
  tournamentShort: '2x visitors, less patience',
  gemrushName: 'Gem rush',
  gemrushBlurb: 'three times the gems, but plain orders pay 25% less',
  gemrushShort: '3x gems, plain orders -25%',

  // Guild perks: name and what it does
  guildBarrelName: 'Guild barrel',
  guildBarrelBlurb: 'every smithy starts with the quench barrel',
  rustName: 'Oiled anvils',
  rustBlurb: 'swords take twice as long to rust',
  deskName: 'Fourth desk',
  deskBlurb: 'room for four adventurers at the counter',

  // Commissions
  crownBlade: 'The Crown Blade',
  gemmedCrownBlade: 'Gemmed Crown Blade',
  gemmed: 'Gemmed {sword}',

  // Guild reputation, a word per fifth of the meter
  shunned: 'Shunned',
  doubted: 'Doubted',
  known: 'Known',
  respected: 'Respected',
  renowned: 'Renowned',

  // The line under an adventurer's order
  haggler: 'Haggler: waits long, pays 70%',
  noble: 'Noble: pays triple, exact sword only',
  veteran: 'Veteran: takes one tier below too',
  setLine: 'Set: sword and buckler, +50%',
  backLine: 'Back from the quest',

  // The order card
  setCoins: '{n} coins +50%',
  orderCoins: '{n} coins',
  gemCoins: '{n} coins (×2)',
  withGem: '{sword} + gem',

  // The fit tag over a desk while a sword is held
  masterworkFit: 'Masterwork fit',
  masterwork: 'Masterwork',
  oneBelow: 'One below: taken',
  overkill: 'Overkill',
  exactNoble: 'Exact fit ×3',
  exactHaggled: 'Exact fit, haggled',
  exactFit: 'Exact fit +50%',
  setComplete: 'Set complete',
  setHalf: 'Set: 1 of 2',
  paysAtTwo: 'pays at 2/2',
  tagCoins: '{n}c',
  tagPays: 'pays {n}c',

  // Floating messages
  masterworkStruck: 'Masterwork! Pays +50%, never rusts',
  gemSet: 'Gem set!',
  repaired: 'Repaired! +{n}c',
  rusted: 'Rusted down to a {sword}',
  scrap: 'Scrap',
  scrapped: 'Scrapped',
  heroBack: 'Back from the quest! +{n}c trophy',
  battered: 'A battered {sword}',
  newCharter: {
    one: 'A new charter: {n} guild star, +{pct}% on every sale',
    other: 'A new charter: {n} guild stars, +{pct}% on every sale',
  },
  streak: 'Hammer streak ×{n}  +{coins}c',
  delivered: '{sword} delivered to the crown',
  soldExact: 'Exact fit! +{n} coins',
  soldLesser: '+{n} coins (one below)',
  soldOverkill: '+{n} coins (overkill)',
  leftUnhappy: 'Left unhappy: reputation down',
  halfBack: 'Their half set is back in the smithy',
  halfPaid: 'Their half set paid {n}c',
  bucklerTaken: 'Buckler taken: now the sword',
  swordTaken: 'Sword taken: now the buckler',
  byEdict: 'By edict: {name}',
  commissionDone: 'Royal commission done! +{n}c and a guild star',

  // The forge and its upgrades
  forge: 'Forge',
  boardFull: 'Board full',
  heating: 'Heating...',
  makingSwords: 'Making swords · switch',
  makingBucklers: 'Making bucklers · switch',
  autoOn: '{name}: on\ntap to pause',
  autoOff: '{name}: off\ntap to start',
  maxBellowsFirst: 'max Bellows first',
  upgradeMaxed: '{name} (max)\n{blurb}',
  upgradePrice: '{name}: {price}c\n{blurb}',
  buildRow: 'Build a fifth row of anvils: {n}c',
  barrelPrice: 'Quench\nbarrel\n{n}c',
  instructions: 'Merge matching swords, then sell them to adventurers.',

  // The win window
  winTitle: 'The Crown Blade is delivered!',
  winText: "The Anvilheart hangs in the throne room, and\nyours is the crown's own smithy.",
  keepSmithing: 'Keep smithing',
  foundSmithy: 'Found a new smithy',

  // The guild perks window
  perksTitle: 'Guild perks',
  perksText: 'Spend guild stars on perks kept in every charter.\nA spent star no longer raises prices.',
  close: 'Close',
  perkLink: { one: 'Guild perks: {n} star to spend', other: 'Guild perks: {n} stars to spend' },
  stars: { one: '{n} star', other: '{n} stars' },
  perkOwned: '{name}: yours\n{blurb}',
  perkCost: '{name}: {cost}\n{blurb}',

  // The edict window and plaque
  edictTitle: 'A new charter, a new edict',
  edictText: 'The crown offers two. The one you take rules\nthis smithy until the next charter.',
  edictPlaque: 'Edict: {name}',

  // The crown's offer
  offerTitle: 'The crown offers a commission',
  offerText: 'Take it as it stands, or the grand way: every\nsword gemmed, for a far bigger purse.',
  decideLater: 'Decide later',
  quickOffer: 'Quick: {title}\n+{n}c and a star',
  grandOffer: 'Grand: {title}\n+{n}c and a star',

  // The top bar, the reputation meter and the hint
  coins: 'Coins {n}',
  bestSword: 'Best sword: {name}',
  noneYet: 'none yet',
  sold: 'Sold {n}',
  starBonus: '{n} · +{pct}%',
  reputation: 'Guild reputation',
  onTheWay: 'An adventurer is on the way...',
  newSmithy: 'New smithy',
  newSmithyConfirm: 'Tap again to wipe stars and perks too',

  // The commission banner
  royalCommission: 'ROYAL COMMISSION',
  crownOffers: 'The crown offers two',
  crownsSmithy: "The crown's smithy",
  tapToChoose: 'Tap here to choose',
  tapToFound: 'Tap here to found a new smithy',
  ready: 'Ready: drag it here',
  given: 'Given {have}/{need}',
  givenGemmed: 'Given {have}/{need}, gemmed',
  givenReady: 'Given {have}/{need}: drag here',
  reward: '+{n}c',
};

export default en;
