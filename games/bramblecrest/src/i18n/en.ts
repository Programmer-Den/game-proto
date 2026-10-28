/**
 * Bramblecrest's texts in British English, the source `de.ts` and `en-US.ts` translate (see
 * `shared/i18n.ts`). Maps, talk and the scene ask for them by these keys.
 */
const en = {
  // Places and the bosses' banners
  village: 'Mossford',
  woods: 'Bramble Woods',
  fen: 'Glimmer Fen',
  shrine: 'Sunken Shrine',
  belfry: 'Drowned Belfry',
  thornmother: 'The Thornmother',
  bellwraith: 'The Bellwraith',

  // Speakers
  elderName: 'Elder Wren',
  pipName: 'Pip',
  bakerName: 'Marla',
  catName: 'Biscuit',
  hermitName: 'Old Sedge',
  sign: 'Sign',
  wisp: 'The wisp',

  // Signs
  signGate: 'North: Bramble Woods. The thorns came back again this spring.',
  signWoods: 'The Sunken Shrine lies northeast. Mind the slugs after dark.',
  signShrine: 'Carved into the stone: "What the bramble takes, the vine gives back."',
  signBells: 'Scratched by the door: "First the deepest voice, then the smallest. Last, the one between."',
  signWages: 'A ringer\'s note: "We kept our wages behind the wet stones, where the river cannot reach."',

  // The journal line, one per quest step
  objStart: 'Talk to Elder Wren in the square',
  objBlade: 'Fetch the old blade from the shed',
  objThorns: 'Cut the thorns at the north gate',
  objShrine: 'Find the Sunken Shrine in Bramble Woods',
  objReturn: 'Bring the news back to Elder Wren',
  objDone: 'A bell tolls in the night. Ask Elder Wren about it',
  objBell: 'Ask Old Sedge in Glimmer Fen about the bell',
  objBelfry: 'Find the Drowned Belfry in Glimmer Fen',
  objHome: 'Tell Elder Wren the bell is quiet',
  objEnd: "Find every moonstone, or race the dungeons' hourglasses",

  // Pip
  pipNook1: 'Behind the shed there is a rock stuck between the trees.',
  pipNook2: 'I put my ear to it once. Something behind it hums, like the glowy stones do!',
  pipThanks: 'You found the glowy stone! Grandma says they fall from the moon when nobody is looking.',
  pipPond1: 'I dropped a glowy stone in the bushes by the pond.',
  pipPond2: 'The bushes are too prickly for me. Maybe a sword could help?',

  // Marla the baker
  bakerBread: 'Fresh bread for the night watch! Elder Wren was looking for you, dear.',
  bakerTrees1: 'Mind the woods. My mother said two of the trees there never cast a shadow.',
  bakerTrees2: 'Walk right through them, she said. Nobody believed her.',
  bakerShop: "Got coins from the woods, dear? I've a pie and a pair of boots for a brave knight.",

  // Biscuit the cat
  catAsleep: 'Biscuit is asleep, very pleased with herself.',
  catGift: 'Biscuit drops something shiny at your feet!',
  catStretch: 'Biscuit rolls over and stretches.',
  catPurr: 'Biscuit the cat purrs at you.',

  // Old Sedge
  hermitBell1: 'The bell? Aye, I hear it too. It rings from under the fen, from the old belfry the water swallowed.',
  hermitBell2: 'Its door is north of the path, east of the big pool, choked with rocks. No blade will shift those.',
  hermitBell3: 'Take these. Bellseeds. Plant one, step back, and it bursts hard enough to crack stone.',
  hermitRefill: 'Out of bellseeds already? Here, a fresh handful. Cut bushes now and then; the pods hide in them.',
  hermitQuiet1: 'The bell is quiet. I slept a whole night through, first time in years.',
  hermitQuiet2: "Rocks don't roll into rings of trees by themselves, you know. West of the river, there is one.",
  hermitRingers1: "The ringers who built that belfry walled up what they didn't want the river to take.",
  hermitRingers2: 'Mind the frogs down there. They bite.',
  hermitShop: "Coins, have you? I'll part with a bigger pouch, or a longer vine.",
  hermitHello1: 'Hm. A knight, out here? Nobody crosses the river these days.',
  hermitHello2: 'Three stone watchers stare at one patch of mud. I never dig there. Bad luck, I say.',
  hermitHello3: 'And that wisp... it flees anyone who chases it. Follow it to the end and see.',

  // Elder Wren
  elderStart1: 'Ah, there you are. The lamps are lit, but the thorns crept over the north gate again.',
  elderStart2: "Your grandfather's old blade is in the shed, east along the street. Fetch it for me, would you?",
  elderBlade1: "That's the one. It still remembers his hand.",
  elderBlade2: 'Cut the thorns at the north gate. Something in the woods keeps calling them back.',
  elderShed: "The shed is east along the street, past Marla's ovens. The chest is in front.",
  elderThorns: 'The gate is at the top of the main street. Give those thorns a good swing.',
  elderShrine: 'Old folk say a shrine sank in those woods long ago. If the thorns come from anywhere, it is there.',
  elderReturn1: 'You came back! And the thorns at the gate are withering as we speak.',
  elderReturn2: 'A queen of thorns, under the shrine? Then this is only the start of it.',
  elderReturn3: 'Rest now. You have done the village proud.',
  elderDone1: 'Do you hear it? A bell, tolling under the fen at midnight. Every night now, and louder.',
  elderDone2: 'There has been no bell in Glimmer Fen since the water took the old belfry.',
  elderDone3: 'Old Sedge lives out there. Ask him what he knows.',
  elderBell: 'Old Sedge has a hut in Glimmer Fen, across the river from the woods.',
  elderBelfry: 'The bell tolled again while you were gone. The lamps all flickered at once.',
  elderHome1: 'A wraith in the bell? And you rang it out of there. Listen: nothing but the frogs.',
  elderHome2: 'The shrine builders walled up their mistakes too, I hear. Listen for hollow stone near its door.',
  elderHome3: 'Rest now. The fen will keep for another night.',
  elderEnd: 'The night is long, and the fen still glimmers. Off you go.',
  elderTrials: 'They say the old hourglasses by the shrine and belfry doors glow again. Turn one, if you dare.',

  // Chests and doors
  empty: 'Empty.',
  unlocked: 'The lock clicks open.',
  locked: 'Locked. It needs a small key.',
  barred: 'Iron bars. Something must lift them.',
  thornyDoor: 'Thorny vines hold it shut.',
  foundSword: 'You found the Old Blade! Space, J or the sword button swings it. It cuts bushes and thorns too.',
  foundHookvine: 'You found the Hookvine! Q, L or the vine button throws it. It pulls you to golden posts, over water and pits.',
  foundKey: 'You found a small key. It opens one locked door in this place.',
  foundHeart: 'You found a Heart Vessel! One more heart.',
  foundOil: 'You found lantern oil. Your lantern burns brighter now.',
  foundSeeds: 'You got {n} bellseeds! B, X or the seed button plants one. Step back: it bursts and breaks cracked stone.',
  gotSeeds:
    'You got {n} bellseeds! B, X or the seed button plants one in front of you. Step back: it bursts, breaks cracked stone and boulders, and hurts anything close.',

  // Quests and toasts
  newQuestBlade: 'New quest: The Old Blade',
  doneQuestBlade: 'Quest done: The Old Blade',
  newQuestBell: 'New quest: The Drowned Bell',
  seedsRefilled: 'Bellseeds {n}',
  moonstone: 'Moonstone! {n} of {total}',
  glint: 'Something glints in the mud!',
  gateOpen: 'The north gate is open',
  bellLow: 'BONG...',
  bellMid: 'DONG...',
  bellHigh: 'ting...',
  bellsWrong: 'The bells clash, and fall silent.',
  bellsRight: 'The bells ring true. Somewhere, iron bars grind open.',
  noSeeds: 'No bellseeds left. Cut bushes, or ask Old Sedge.',
  barsOpen: 'Somewhere, iron bars grind open.',
  wake: 'You wake by the lamplight, a little bruised.',
  bulbDown: 'The bulb is down. Strike it!',
  bellTipped: 'The bell tips over. Strike what hides inside!',
  clang: 'Clang! The bronze is too thick.',
  wraithFlees: 'The Bellwraith shrieks and flees into its bell!',
  wispVoice: 'A voice like wind in reeds: "You found me. Now find the rest of the moon."',

  // Bosses beaten
  thornmotherBeaten: 'The Thornmother withers into a heap of dry bramble.',
  thornmotherWayOut: 'A way out has opened at the top of the hall. Elder Wren should hear of this.',
  wraithBeaten: 'The Bellwraith frays into mist, and the great bell cracks in two.',
  wraithQuiet: 'The fen falls quiet. Elder Wren will want to hear it from you.',

  // Chapter end cards
  chapterOne: 'Chapter One: The Thornmother',
  chapterTwo: 'Chapter Two: The Drowned Bell',
  endStats: 'Moonstones {n} of {total}   ·   Foes beaten {beaten}   ·   Falls {falls}',
  endOneAll: 'Every moonstone hums at once. Far off in Glimmer Fen, something vast opens one eye, and smiles.',
  endOneSome: 'A cold light flickers over Glimmer Fen. Some of the moon is still missing.',
  endOneFew: 'The lamps burn on in Mossford. The woods are quiet, for now.',
  endTwoAll: 'The moonstones ring like little bells, all together. High above the fen, the moon rings back.',
  endTwoSome: 'The fen is still at last. Somewhere under the water, a last few stones keep humming.',
  endTwoFew: 'The frogs sing over the drowned belfry. The night is quiet, for now.',
  keepExploring: 'Keep exploring',
  newGame: 'New game',

  // The hourglass trials
  hourglassRead: 'An old hourglass full of glowing sand. Turn it, and every foe here wakes again, and the master of this place rises stronger. Beat it as fast as you can.',
  hourglassBest: 'Your best time here: {time}.',
  trialStart: 'The sand runs!',
  trialBusy: 'The sand is already running.',
  trialLost: 'The sand stops. The trial is over.',
  trialDone: 'Trial done in {time}!',
  trialRecord: 'A new best time!',
  trialBestIs: 'Your best is still {time}.',

  // The moonstone page
  stonesTitle: 'Moonstones',
  stonesTotal: '{n} of {total} found',
  trialsTitle: 'Hourglass trials',
  trialBest: '{place}: {time}',
  trialNone: '{place}: not run yet',
  closePage: 'Tap or N to close',

  // The shops
  shopTitle: "{name}'s wares",
  price: '{n} coins',
  owned: 'Yours',
  notYet: 'Not yet',
  closeShop: 'Tap outside, Space or Esc to close',
  tooPoor: 'Not enough coins.',
  bought: 'Bought: {item}!',
  pie: 'Hearty pie',
  pieText: 'One more heart, for good.',
  boots: 'Light boots',
  bootsText: 'Roll farther, and roll again sooner.',
  pouch: 'Bigger pouch',
  pouchText: 'Carry 15 bellseeds instead of 10.',
  vine: 'Long vine',
  vineText: 'The hookvine reaches much farther.',

  // HUD
  keys: 'Keys {n}',
  seeds: 'Seeds {n}',
  readOn: 'Tap or Space',
};

export default en;
