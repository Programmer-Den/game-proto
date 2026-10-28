/**
 * Shrine Stack's texts in British English, the source `de.ts` and `en-US.ts` translate (see
 * `shared/i18n.ts`). The catalogues in `game/` name their texts by these keys.
 */
const en = {
  // Blessings: name and card text
  broadName: 'Broad Stones',
  broadText: 'The top stone grows 40 wider, up to the plinth.',
  calmName: 'Calm Winds',
  calmText: 'Stones swing 15% slower from now on.',
  steadyName: 'Steady Hands',
  steadyText: 'Perfect drops are easier: 6 more pixels of leeway.',
  goldenName: 'Golden Offering',
  goldenText: 'Every stone you place earns 1 more favour.',
  graceName: "Mason's Grace",
  graceText: 'The next stone that misses is caught, not lost.',

  // Shop
  slowName: 'Slow drop',
  widerName: 'Wider stone',

  // Stone kinds: name, short name and what it does
  normalName: 'Ordinary stone',
  normalShort: 'Ordinary',
  heavyName: 'Heavy stone',
  heavyShort: 'Heavy',
  lightName: 'Light stone',
  lightShort: 'Light',

  // Trials
  perfectTrial: '3 perfect',
  keepTrial: 'keep 80%',

  // Curses
  hasteName: 'Haste',
  hasteText: 'stones swing 30% faster',
  brittleName: 'Brittle',
  brittleText: 'every cut cracks 6 more off',
  dimName: 'Dimness',
  dimText: 'no drop guide',

  // Materials: name and button text
  limestoneName: 'Limestone',
  limestoneShort: 'plain',
  marbleName: 'Marble',
  marbleShort: 'tight, x2 favour',
  sandstoneName: 'Sandstone',
  sandstoneShort: 'easy, 1/2 favour',
  basaltName: 'Basalt',
  basaltShort: 'heavy, x2 trial',

  // Patrons: name, boon and bane
  gildedName: 'The Gilded Hand',
  gildedBoon: 'Every stone earns 1 more favour.',
  gildedBane: "No Mason's Grace: a miss always ends the run.",
  handsName: 'The Many-Handed',
  handsBoon: 'Balanced tiers offer four blessings.',
  handsBane: 'Stones swing 10% faster.',
  patientName: 'The Patient Mason',
  patientBoon: 'Stones swing 10% slower.',
  patientBane: 'Perfect drops earn no extra favour.',
  stormName: 'The Storm Caller',
  stormBoon: 'Perfect drops get 3 more pixels of leeway.',
  stormBane: 'Gusts blow from tier 6, not only past the crown.',

  // Panel
  hint: 'Tap anywhere to drop the stone',
  title: 'Shrine Stack',
  swap: 'Swap (R)',
  lean: 'Lean',
  leanFrom: 'Lean from tier {tier}',
  blessings: 'Blessings',
  goal: 'Goal: crown tier {tier}',
  gildedGoal: 'Tier {tier} gilded: x{mult} favour',
  rules: 'Tap to drop a stone.\nOverhangs break off.\nLand 3/4 on to balance.',
  tier: 'Tier {tier}',
  tierSky: 'Tier {tier}  Sky',
  favour: 'Favour {n}',
  built: 'Built {built}  Best {best}',
  next: 'Next: {kind}',
  trial: 'Trial: {trial} {done}/{of}',
  trialFailed: 'Failed: {trial}',
  trialsFrom: 'Trials from tier {tier}',
  curse: 'Curse: {curse} x{mult}',
  materialTier: '{material} tier',
  patron: 'Patron: {patron}',
  choosePatron: 'Choose a patron',
  hold: 'Hold: {kind}',
  holdNothing: 'Hold: nothing',
  reserveFrom: 'Reserve from tier {tier}',
  gust: 'Gust {arrows} {n}',
  calmAir: 'Calm air',
  blessingCount: '{blessing} x{n}',
  graceHeld: '{blessing} ({n} held)',
  graceBought: 'Grace bought ({n} held)',
  noBlessings: 'None yet',

  // Popups and banners
  perfectPopup: 'Perfect! +{n}',
  caught: 'The stone is caught: try again',
  trialPassed: 'Trial passed! +{n}',
  trialFailedPopup: 'Trial failed',
  toppled: 'The tier topples!',
  toppledFavourLeft: 'Leaned too far left: -{n} favour',
  toppledFavourRight: 'Leaned too far right: -{n} favour',
  regrown: 'Regrown +{n}',
  inHand: '{kind} in hand',
  watchesOver: '{patron} watches over you',
  crowned: 'The shrine is crowned!',
  tierStands: 'Tier {tier} stands',
  gildedTier: 'Tier {tier} is gilded',
  gildedFavour: 'x{mult} favour',
  gildedTierFavour: 'Tier {tier} is gilded: x{mult} favour',
  altarTier: 'Tier {tier} is a sky altar',
  altarFavour: 'x{mult} favour and a blessing',
  altarTierFavour: 'Tier {tier} is a sky altar: x{mult} favour',
  altarGoal: 'Next sky altar: tier {tier}, x{mult}',
  cursedWith: 'Cursed with {curse}: x{mult} favour',
  blessingYours: '{blessing} is yours',
  intoSky: 'Into the endless sky',
  mindGusts: 'Mind the gusts',

  // Breaks between tiers
  skyPick: 'Into the endless sky: pick a stone',
  wobbly: 'Tier {tier} is wobbly: no blessing this time',
  balanced: 'Tier {tier} balanced: choose a blessing',
  altarBlessing: 'Sky altar {tier}: choose a blessing',
  reroll: 'Reroll',
  spendFavour: 'Spend favour (you have {n})',
  bought: 'ok',
  stoneFor: 'Stone for tier {tier}: {material}',
  patronTitle: 'Choose a patron for this temple',
  patronSub: 'Their rule holds for the whole run',
  takeCurse: 'Take a curse on tier {tier}: {curse}, {text}. Earn x{mult} favour.',
  buildOn: 'Build on',

  // End panel
  buildAgain: 'Build again',
  keepBuilding: 'Keep building',
  fallen: 'The stone has fallen',
  fallenSky: 'Your crowned shrine climbed the sky\nto {tiers} tiers, for {favour} favour.',
  fallenStood: {
    one: 'Your shrine stood {n} tier tall,\n{balanced} of them balanced, for {favour} favour.',
    other: 'Your shrine stood {n} tiers tall,\n{balanced} of them balanced, for {favour} favour.',
  },
  bestTiers: { one: 'Best {n} tier.', other: 'Best {n} tiers.' },
  crownedText: 'All {tiers} tiers stand,\n{balanced} of them balanced, for {favour} favour.\n\nKeep building into the windy sky?',
};

export default en;
