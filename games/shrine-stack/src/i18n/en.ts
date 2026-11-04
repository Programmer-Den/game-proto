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

  // Patron favour: a ranked patron's stronger boon, and the rank on the card
  gildedBoonRank: 'Every stone earns 1 more favour, every balanced tier {n} more.',
  handsBoonRank: {
    one: 'Balanced tiers offer four blessings, and {n} reroll is free.',
    other: 'Balanced tiers offer four blessings, and {n} rerolls are free.',
  },
  patientBoonRank: 'Stones swing {n}% slower.',
  stormBoonRank: 'Perfect drops get {n} more pixels of leeway.',
  rank: 'Favour rank {rank}/{max}',
  rankUp: '{patron} rises to rank {rank}.',

  // Shrine sites: name, the banner line on arrival, and the button's note
  hillName: 'Hill',
  hillText: 'A quiet hilltop',
  cliffName: 'Cliff',
  cliffText: 'The sea wind blows from the right from tier 2',
  lakeName: 'Lake',
  lakeText: 'The raft bobs from side to side',
  siteNote: 'Crown {tier} · best {best}',
  siteLocked: 'Opens after {site}',
  siteOpened: 'New site: {site}. Build again to build there.',

  // The daily shrine
  dailyName: 'Daily shrine',
  dailyReady: 'Same patron and stones for all today · best {best} · streak {streak}',
  dailyUnfinished: 'Played today: come back tomorrow',
  dailyDone: { one: 'Today: {n} tier · streak {streak}: come back tomorrow', other: 'Today: {n} tiers · streak {streak}: come back tomorrow' },
  dailyBest: 'Daily best {best} · streak {streak}',

  // Panel
  hint: 'Tap anywhere to drop the stone',
  title: 'Shrine Stack',
  swap: 'Swap (R)',
  lean: 'Lean',
  leanFrom: 'Lean from tier {tier}',
  blessings: 'Blessings',
  goalSite: '{site}: crown tier {tier}',
  goalDaily: 'Daily: crown tier {tier}',
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
  patronRanked: 'Patron: {patron}, rank {rank}',
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
  free: 'free',
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
  bestOn: { one: 'Best ({site}): {n} tier.', other: 'Best ({site}): {n} tiers.' },
  crownedText: 'All {tiers} tiers stand,\n{balanced} of them balanced, for {favour} favour.',
  keepAsk: 'Keep building into the windy sky?',
};

export default en;
