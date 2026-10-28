# Apothecary: guide for agents

How Apothecary is built and where things stand, for agents about to change it. README.md covers how
to play and lists the prices and upgrades. Keep this file up to date in the same PR as any change
to the game, as the root AGENTS.md asks.

## Current state

Apothecary is a top-down automation game: a plague doctor walks a yard laid out in two rows either
side of the shop, harvests wheat, mandrake and (once a shade garden is planted) nightshade, refines
them at a table, brews potions in a cauldron and sells them to customers from shelves along the
shop's walls. Coins buy upgrades, craftsmen,
pixies that carry goods between stations (the sim and code still call them belts), recipes at the
study, shade gardens and a mirrored second production line.

- Implemented: the full loop on both lines, auto-harvest with a spinning sickle, floor markers
  (dashed rings: drop, work, pick up, and purple pay markers with an icon for each kind of thing
  bought), pallets that show station stock (only for items available yet), storage that starts
  small and grows with the guild's Storage upgrade, customers served only at the counter, a walled
  shop in the middle that faces the street at the bottom and that the doctor enters by a north door, station upgrades (5 levels), outfitter and
  guild upgrades, two craftsmen per station (the second opens a second pipe at a table or
  cauldron; craftsmen rock to and fro while their pipe works), a priority choice per crafting
  station once the study has taught the crafting order, six pixie routes (belts) with one lane per item kind, six potions of which two are
  known from the start and four are learned at the study, one shop shelf per potion learned, the
  expansion, a row of order cards always on screen, weather drawn over the yard,
  a Recipes panel and a Settings panel, a daily contract card, tips that shrink while a customer
  waits (a coin ring on each order bubble), and an autopilot that plays the time away (up to 2h)
  on load and shows a "While you were away" chip. Progress autosaves to localStorage.
- Round two: a price sign on each shelf (Cheap, Fair, Dear) once the study has taught them, blight on the beds from day 3 and the
  guild's herbalist against it, replanting a garden from its sign, a rival shop across the street
  from day 4 that undercuts one potion a day and closes after ten days outsold, and the plague
  from day 5, three stages on a card under the town card, ending in the Panacea: brewing it cures
  the town and wins the game, with "Keep trading" after. The game's first ending.
- Round three: contracts from every potion customers ask for from day 3, with two-potion bundles;
  seasons of sickness after the cure, each cured one earning a town seal that raises prices; the
  merchant wagon across the street on wagon days; the herb market below the outfitter; an
  overstock cut that starts past 5 of a potion on its shelf; cauldrons that brew what the shop is
  shortest of, and gardens that grow at close to the same pace.
- The town (the first of a planned series of PRs): once `state.seals > 0` (`townOpen`) a Town
  button left of Recipes opens the `Town` scene, a map of lot cards: the apothecary and one per shop
  in `SHOPS`. A shop costs `shopCost` (1,000 for the bakery, then ten times more each `tier`) and is
  walked into as its own `Shop` scene, a yard laid out by its own hand-placed `YardPlan` with
  scenery of its own (a village green, hillside terraces, a river, a forge yard, a lake): gardens of
  16 beds, stations with drop, work and pick-up markers, and a small storefront whose shelves
  customers buy from, served by the doctor or up to two shopkeepers.
  Stations, the counter and pixie routes have purple markers; their costs grow by `TIER_STEP` (3)
  a tier. The shops so far are the Bakery (wheat and honeycomb, mill and oven, bread and honey
  cake) the Chandlery (honeycomb and flax, wax press, spinning wheel and dipping vat, candles
  and tapers) the Dye house (flax and woad, loom, dye mill and dye vat, blue cloth and
  cloaks), the Smithy (coppice and ore pit, charcoal kiln, bloomery and anvil, horseshoes and
  iron pots) and the Tavern (barley field and hop garden, maltings, oast and brew kettle, ale and
  stout). Each shop also has a third garden and two recipes its study teaches (apple tart and
  fruit cake, lavender soap and scented candle, red cloth and gown with madder and red dye, copper
  pot and lantern, cider and apple ale). Each shop has a guild of its own too: growth, pixies, storage, prices, slots, customers and the herbalist. Every
  good a shop sells can come out Fine in the last quarter of its station's work, and from day 4
  each shop has a daily contract for one of its goods, for two on the apothecary's bundle days.
  Each shop's day runs on the apothecary's rules: customers tip, the shop has a reputation of its
  own and up to four regulars, the almanac weather speeds its beds or brings customers, every
  fourth day brings a market crowd at midday, the blight takes its beds on rainy days (cleared by
  the sickle, or kept off by the herbalist) and an overstocked shelf sells cheaper. A town card at
  the top right of the shop shows the weather, the reputation and the market day. A second line, bought once per shop, adds
  a copy of each station in a row below the guild, with its own pixie routes. With more than three lots the map lays them in two rows of shorter cards (`lot`), and
  keeps `CORNER_H` free at the bottom for the corner buttons. Below the lots, a card per district (`DISTRICTS`: Market Row, Riverside, Hilltop) shows its
  households: every `SUPPLY_MS` each home asks for one need of its tier (`HOME_TIERS`: cottages,
  then houses, manors, which want candles and tapers, mansions, which want blue cloth and cloaks, palaces, which want horseshoes and iron pots, and castles, drawn as battlemented towers, which want ale and stout) and buys it off a shop's shelf (potions
  off the apothecary's), and happy districts grow homes and then tiers (see `runDistrict`). Once
  every district is full at the last tier (`townIsCity`), the districts heading on the map turns
  into the city note (`townCity`), the second ending. A further shop needs a new `HOME_TIERS` entry
  too, and `drawHomes` then draws only the new last tier as castles.
- Gardens have nine beds each, three by three edge to edge (`PLOTS_PER_GARDEN`, `plotPosition`).
  Two shade gardens grow nightshade for the Shadow Elixir, Moonlight Salve and Witch's Brew. A brew's last quarter
  is its fine window: picked up then by hand, it becomes a Fine potion (its own item kind) worth
  `FINE_BONUS` times as much. Customers can come back as regulars, the street keeps a reputation,
  each day has almanac weather, and every fourth day is a market day with a crowd at midday. The
  town card right of the contract shows the weather, reputation and the market day.
- Look: an ink-and-watercolour herbalist's almanac. Every texture is painted on a canvas at load
  (`textures.addCanvas`), with no image files; `pixelArt` is off; all text is serif (`SERIF`).
  The palette is kept dark and muted (deep greens, dark earth and floor boards, aged-paper cards
  under dark ink): keep new ground, card and surface colours in that range, and only items, markers
  and the brew bright.
- There is no title or lose screen; the only win screen is the cure's panel
  (`showWin`). Sound effects and chiptune music are made in code (see Sound). A customer who runs out of patience leaves and lowers the reputation.
- Leftovers: `GAME_WIDTH`/`GAME_HEIGHT` in `src/main.ts` are only used there. `DOCTOR_W`/`DOCTOR_H`
  in `src/art/doctor.ts` are exported but unused.

## Architecture

### File map

- `src/howToPlay.ts`: the How to play screen's text (goal, controls, core loop and tips) in British
  English (which US English uses as it is) and German, picked with `byLanguage` and handed to
  `setupGame(game, { howToPlay })` in `src/main.ts`; update both languages when the controls or the
  first round change.
- `src/i18n.ts` and `src/i18n/`: the game's texts (`shared/i18n.ts`). `i18n/en.ts` is the British
  English source, `i18n/de.ts` the German and `i18n/en-US.ts`
  only the Vigour Tonic, spelled Vigor. No text names the currency: an amount is the number and
  `{coin}`, which `t` fills with `COIN` (an em space) and `coined(text)` (`src/ui/coins.ts`) covers
  with the painted `coin` texture, kept on the text's place, visibility, alpha and container; wrap
  every text that can show `{coin}` in `coined`. The top bar shows the purse as a coin and the bare
  number, and the till's pick-up marker is captioned with a coin. `t(key, vars)` shows a text in the hub's language and
  `TextKey` types the keys. An item's name is the text keyed by its id (`itemName(id)`), and
  `potionCount(potion, n)` gives "3 Healing Draughts" from the `<potion>Count` plural forms. Every
  text on screen and every `Feedback` line goes through `t`; the tables in `game/` hold `TextKey`s
  (`UPGRADES[id].name`, `WEATHER[w].name` and `.today`, `GARDEN_NAMES`, `GARDEN_NAMES_IN` for a
  garden inside a sentence, `SIGN_NAMES`, `SIGN_SET`), as do `GARDEN_AREAS` in layout. A new text
  gets its German entry (and a US one if its spelling differs) in the same PR.
- `src/trophies/`: the game's ten trophies (`shared/trophies.ts`). `index.ts` lists them
  (`trophies`: id, tier, icon, `hidden` for Merchant of the town and From village to city) with
  their texts in `trophies/i18n/` (`en.ts` and `de.ts`: the name keyed by the id, what earns it by
  `<id>Text`), and imports nothing else from the game, since the hub loads it for its trophy shelf.
  `main.ts` hands `trophies` to `setupGame`, which lists them on the start and pause screens.
  `check.ts` holds each trophy's condition on the `GameState` (`EARNED`: first potion sold, first
  upgrade, first craftsman, first pixie route, 100 sold, `FULL_PURSE` 1,000 coins at once, every
  recipe learned, the cure, a town shop bought, the city) and `checkTrophies(state)`, which
  `GameScene`, `ShopScene` and `TownScene` call every frame after the tick; the first call after the
  page loads awards quietly, so a loaded save and the time away earn theirs without a toast. A new
  trophy is an entry in `index.ts`, its two texts in each language file and its condition in
  `EARNED`.
- `src/main.ts`: creates the `Phaser.Game` (960x540, FIT scaling, arcade physics with
  `fixedStep: false`, `pixelArt: false`, aged-paper background `PAPER`), registers `BootScene`, `GameScene`, `TownScene` and `ShopScene`, calls `setupGame(game)`
  from `shared/setupGame.ts` and `setupScaling(game, { fill: true })` from `shared/scaling.ts`, and puts `game` on window in dev.
- `src/audio.ts`: the game's sound (`shared/audio.ts`): `SONG`, `RUSH_SONG` and the `sfx` table
  (see Sound).
- `src/game/items.ts`: item ids and defs (`ITEMS`: kind and colour; names are in `i18n/`), `GROW_MS`, `REFINE`, `RECIPES`,
  `POTION_PRICE`, the `isPlant`/`isRefined`/`isPotion`/`isFine`/`isSellable` guards, the ordered
  lists `PLANTS`, `REFINED`, `POTIONS`, and the fine potions (`FineId`, `FINE`, `plainOf`; a
  `SellableId` is a plain or fine potion).
- `src/game/state.ts`: every state type, `createInitialState`, the layout versions (`LAYOUT`,
  `FEEDERS_LAYOUT`, `COLUMNS_LAYOUT`, `HEART_LAYOUT`), the
  upgrade, belt (`BELT_MS`, and `COLUMNS_BELT_MS` and `U_BELT_MS` from older layouts), expansion and pallet tables (`PALLET_SIZE`, and `storage`, what a pallet
  or shelf holds now: `STORAGE_START` 10 plus `STORAGE_STEP` 10 a Storage level), and small derived helpers (`carryCapacity`,
  `walkSpeed`, `potionPrice`, `stationBuilt`, `anyFieldBuilt`, `beltBuildable`, ...). Also the tip
  rules (`TIP_SHARE`, `maxTip`, `tipLeft`, `tipNow`) and the contract (`Contract`, `DAY_MS`,
  `MAX_CONTRACT`, `contractFor`). Also the gardens (`GARDENS`, `GARDEN_LINE`, `SHADE_GARDEN`,
  `SHADE_COST`, `gardenBuilt`, `shadeGrown`, `orderable`), the study (`KNOWN_RECIPES`,
  `RESEARCH_ORDER`, `researched`; its level is the `research` upgrade; `studied` says whether its
  `craftOrder` and `priceSigns` lessons, one-level upgrades, are learned), the fine window (`FINE_SHARE`,
  `FINE_BONUS`, `inFineWindow`), reputation and regulars (`START_REPUTATION`,
  `REPUTATION_SERVED`, `REPUTATION_WALKED_OFF`, `reputationFactor`, `nudgeReputation`,
  `REGULAR_TIP_LEFT`, `MAX_REGULARS`, `REGULAR_CHANCE`, `REGULAR_BONUS`), the weather (`Weather`,
  `WEATHER`, `weatherFor`) and market days (`MARKET_EVERY`, `isMarketDay`, `RUSH_SIZE`,
  `RUSH_BONUS`, `RUSH_EXTRA`). Also the plague (`Plague`, `PLAGUE_DAY`, `PLAGUE_STAGES`,
  `PLAGUE_STAGE_MS`, `PLAGUE_RELAPSE_EXTRA`, `PLAGUE_RELAPSE_REPUTATION`, `MAX_PLAGUE_NEED`,
  `plagueStage`, `panaceaUnlocked`, `plagueAt`), the price signs (`PriceSign`, `PRICE_SIGNS`,
  `SIGN_NAMES`, `SIGN_PAY`, `SIGN_DEMAND`, `SIGN_REPUTATION`, `SIGN_PATIENCE`, `signOf`,
  `patienceRate`), the blight (`BLIGHT_DAY`, `BLIGHT_EVERY_MS`, `BLIGHT_SPREAD_MS`, `blightImmune`,
  `plotNeighbours`), the rival (`Rival`, `RIVAL_DAY`, `RIVAL_CUT`, `RIVAL_SALES`,
  `RIVAL_MONTH_DAYS`, `rivalUndercuts`, `rivalPotionFor`), the overstock cut (`STOCK_FREE`,
  `MAX_STOCK_CUT`, `stockFactor`, `stockedPay`), book contracts (`BOOK_CONTRACT_DAY`,
  `BUNDLE_EVERY`, `CONTRACT_SHARE`, `NIGHTSHADE_CONTRACT_SHARE`, `contractWants`), seasons
  (`SEASON_GAP`, `SEASON_EXTRA`, `SEAL_PRICE`, `SEASON_STAGES`, `stagesFor`), the wagon (`Wagon`,
  `WAGON_DAY`, `WAGON_EVERY`, `WAGON_CRATE`, `WAGON_PREMIUM`, `WAGON_MS`, `WAGON_ARRIVES`,
  `isWagonDay`, `wagonFor`, `wagonHere`), the herb market (`HerbId`, `HERBS`, `HERB_PRICE`,
  `herbBuyPrice`, `herbSellPrice`, `marketOpen`) and replanting (`GARDEN_RUN`,
  `LINE_GARDENS`, `GARDEN_NAMES`, `gardenPlant`, `plantChoices`). `items.ts` also holds the
  Panacea (`PANACEA`, `PANACEA_RECIPE`, `BrewOut`: what a brew can be, a potion or the Panacea).
- `src/game/sim.ts`: the rules, free of Phaser. `tick` advances the world; marker actions
  (`dropAtRefiner`, `pickUpFromCauldron`, `stockShelf`, `collectTill`, `payUpgrade`,
  `payCraftsman`, `payBelt`, `payExpansion`, `payShade`, `joinGuild`, `dropItem`, `serveOrder`, `cyclePriority`,
  `cycleSign`, `replantGarden`, `clearBlight`, `sellToWagon`, `cycleMarketPick`, `buyHerb`,
  `sellHerb`) and `harvest` each change
  state and return `Feedback` lines, already translated with `t`. Also `refining`, `hasRoom`, `doneByHand` and `isBlighted`.
- `src/game/save.ts`: `loadState`, `saveState` (stamps `lastSeen` with `Date.now()` and writes
  `thinSave`), `clearSave` (key `apothecary-save`), `grantLessons` (lessons an old save was already
  using), and the `ontoOwnRuns`, `ontoColumns` and `ontoHeart` belt migrations.
- `src/game/away.ts`: the autopilot. `catchUp(state, now, rand)` plays the time since `lastSeen`
  (capped at `AWAY_CAP_MS`, 2h; nothing under `AWAY_MIN_MS`, 60s) through `tick` in 500ms steps
  with nobody on a work spot and every customer at the counter, and returns an `AwaySummary`
  (`ms`, `coins`, `potions`) or null. `hasAutomation`: any craftsman hired or belt built.
  It also runs `tickTown` each step, and counts the shops' tills into `coins`; `hasAutomation`
  also holds for `townAutomated` (a town worker, shopkeeper or pixie route).
- `src/game/town.ts`: the town's data, free of Phaser: `GoodId` and `GOODS`, the shop defs
  (`ShopDef`: gardens, stations with recipes, pixie `routes`, `sells` with base prices, `tier`) in
  `SHOPS`, the cost helpers (`shopCost`, `tierCost`, `levelCost`, `workerCost`, `routeCost`), the
  limits (`MAX_LEVEL`, `MAX_WORKERS`, `MAX_SHOPKEEPERS` (two at each counter), `BEDS` (16 a garden;
  `normalizeTown` spreads a save's three-by-three gardens onto them), `SHOP_STORAGE`, `SHOP_PLACES`) and
  timings, the state types (`TownState`: `shops`, a `ShopState` per shop bought, and `hands`, the
  doctor's hands in town, kept apart from `carrying`), `createTown`, `normalizeTown` and `townOpen`.
  Each shop's market: its outfitter (`OUTFITTER_GEAR`, `Gear`, `GEAR_COST`, `gearCost`; one level each
  in `ShopState.outfitter`, which `gearLevel` in `state.ts` adds to the apothecary's for
  `carryCapacity`, `walkSpeed` and `harvestReach`, so `MAX_CARRY` is 4 + 2 + one a shop) and its
  study (`LESSONS`, `Lesson`, `LESSON_COST`, `lessonCost`, `ShopState.study`, `shopStudied`), which
  turns on `ShopState.priority` (a station's first product, `priorityChoices`: only stations with
  more than one recipe) and `ShopState.signs` (`shopSignOf`, reusing the apothecary's `PriceSign`
  numbers). The study also teaches the shop's `ShopDef.research`, two products learned in order
  (`ShopState.recipes`, a level a recipe, `RECIPE_COST`, `recipeCost`): `shopKnows` says whether a
  product is known (not in `research`, or learned), `shopMakes` whether a good is in use yet (known,
  and taken by a known recipe if any takes it), `shopSells` what customers ask for. The third garden
  (index `OPEN_GARDENS`) grows, ripens and feeds its pixies only once `gardenOpen` (a recipe learned).
  Each shop's guild (`ShopState.guild`: `join`, then one `Upgrade` per `SHOP_GUILD` id;
  `SHOP_GUILD_UPGRADES` for levels and costs, `GUILD_JOIN_COST`, `guildJoinCost`, `guildCost`) feeds
  `shopStorage` (pallets and shelves, in place of `SHOP_STORAGE`), `shopPlaces` (up to
  `MAX_SHOP_PLACES`), `shopGrowth`, `shopRouteSpeed`, `shopPriceBoost`, `shopFootfall` and
  `shopBlightImmune` (the herbalist).
  A shop's day: `ShopState.reputation` (0 to 100, from 50), `regulars` (`ShopRegular`: `face` and
  `wants`, up to `MAX_REGULARS`), `rush` (`ShopRush`: the market day's crowd, `day`, `size`,
  `waiting`, `served`, `lost`, `paid` and its `bonus`) and `blight` (`{ bed, ms }` per blighted bed;
  `isBlightedBed`, `bedNeighbours` four by four). A `ShopOrder` also carries its `tip`, the goods it
  `asked` for, and whether it is a `regular` or one of the `rush`; `SHOP_TIP`, `SHOP_REGULAR_BONUS`
  and `SHOP_RUSH_BONUS` set what they are worth. `town.ts` can't import values from `state.ts` (it
  imports `town.ts`), so the shared numbers are read in `townSim.ts`.
  Fine goods are their own kind, `FineGood` (`<good>-fine`; `fineOf`, `isFineGood`, `plainGood`);
  `Held` (a good or a fine good) is what `TownState.hands` and `ShopState.shelf` hold. A shop's
  contract (`ShopState.contract`, a `ShopContract`: `day`, `good`, `need`, `made`, `reward`, and on a
  bundle day a `bundle` with a second `good`, `need` and `made`) starts
  on `SHOP_CONTRACT_START`; `ShopState.kept` counts the ones kept (it picks the next good and need,
  up to `MAX_SHOP_CONTRACT`; the reward is `SHOP_CONTRACT_SHARE` of the goods' base price).
  The second line (`ShopState.line2`, bought for `LINE2_COST`, `line2Cost`) copies every station
  and route under the id `<id>2` (`line2Id`, `isLine2`, `line1Id`): `shopStations(def)` and
  `shopRoutes(def)` list both lines' (`stationDef`, `routeDef` look one up), and `ShopState.stations`,
  `routes` and `priority` hold both from the start; `lineOpen(shop, id)` says whether one stands yet.
- `src/game/districts.ts`: the households' data, free of Phaser: `Need` (a good or a potion),
  `DISTRICTS`, `HOME_TIERS` (each tier's name and needs), the growth numbers (`START_HOMES`,
  `MAX_HOMES`, `SUPPLY_MS`, `HAPPY_PULL`, `HAPPY`, `UNHAPPY`, `GROW_ROUNDS`), `DistrictState`
  (`open`, `homes`, `tier`, `happiness`, `growth`, `next`, `rounds`, `short`), `createDistricts`,
  `districtAsks` (home `h` asks for need `(rounds + h) % needs`) and `districtFull`.
- `src/game/townSim.ts`: the town's rules. `tickTown(state, dt, working, rand)` grows the beds,
  runs every station (crew: its workers plus the doctor on its work spot), pixie route, counter and
  customers of every shop bought; it calls `rand` only for a shop bought, so a game without one uses
  the same randomness as before. Once `townOpen`, it also runs each district (`runDistrict`: opening it
  once the one before has houses, then a supply round every `SUPPLY_MS` through `supplyNeed`, which
  takes a good off a bought shop's shelf or a potion, plain first, off `state.counter.shelf`, and
  pays the price into that till: for a potion `potionPrice` times its sign's `SIGN_PAY` and
  `FINE_BONUS` for a fine one, as a customer pays). Districts use no randomness. Marker actions (`buyShop`, `harvestBed`, `dropAtStation`,
  `pickUpFromStation`, `stockShopShelf`, `collectShopTill`, `tossGood`, `payStationLevel`,
  `payWorker`, `payCounterLevel`, `payShopkeeper`, `payRoute`, `payGear`, `payLesson`, `payRecipe`, `payLine2`, `payGuildJoin`, `payGuildUpgrade`,
  `cycleShopPriority`, `cycleShopSign`) return `Feedback` like the sim's. `nextRecipe` skips recipes
  not learned yet and takes the station's priority first when it is ready. A shop's day reuses the
  apothecary's rules and numbers from `state.ts`: `newShopOrder` brings back a regular now and then
  (`REGULAR_CHANCE`, paying `SHOP_REGULAR_BONUS` more) or draws wants by `SIGN_DEMAND`, pays
  `shopPrice` (counter level, guild prices and sign) and sets the tip; `runOrders` runs patience down
  by `SIGN_PATIENCE`, lets a walk-off lower the reputation (`REPUTATION_WALKED_OFF`) and lose the
  crowd, seats a market crowd first and spaces customers by `reputationFactor`, `shopFootfall` and
  the weather's `customers`; `runRush` brings the crowd at midday on `isMarketDay` and loses those
  still waiting when the day changes; `spreadShopBlight` blights beds on rainy days from
  `BLIGHT_DAY` and spreads them, and `clearShopBlight` is the sickle's. Beds grow by the weather's
  `growth`, and a blighted one neither grows, ripens (`isRipeBed`) nor feeds a route.
  `serveOne` hands a fine good first, at `FINE_BONUS` times the price, cut by `shopStockedPay`
  (the apothecary's `stockedPay` overstock cut, counting the one sold), nudges the reputation by
  `SIGN_REPUTATION`, and counts what it hands for the contract (`deliverForShopContract` pays the
  reward into the till once `shopContractKept`, both parts of a bundle met; `shopContractWants`
  says whether a good still counts). A filled order pays its tip (`tipNow`), and `orderFilled`
  raises the reputation, keeps a customer served with `REGULAR_TIP_LEFT` of the tip left as a
  regular and pays the crowd's bonus once all of it is served. `supplyNeed` takes a plain good
  first. `tickTown` rolls each shop's contract (`shopContractFor`, a bundle every `BUNDLE_EVERY`th
  day from `BOOK_CONTRACT_DAY`, as at the apothecary) when the apothecary's contract day changes. `inShopFineWindow(def, station)`
  is true from `1 - FINE_SHARE` of a sold good's work to its end, and `pickUpFromStation` then takes
  the work out by hand as its fine good. Drops skip fine goods; `stockShopShelf` stocks both kinds.
  `dropAtStation` and `payRoute` refuse a second-line station or route until the line is bought.
- `src/scenes/shopLayout.ts`: where everything stands in a shop's yard, from its hand-placed
  `YardPlan` in `YARD_PLANS`: its size (the fence `STREET_H` above its bottom, `shopFence`), each
  garden's corner and the side its route markers stand on (`right`, `left` or `below`), the first and
  second line's station spots (`line1`, `line2`, any shape: rows, columns, a diagonal, a Y), the
  outfitter's and study's signs, the guild's join spot and shape (`row`, or a `grid` of rows of
  three with the last row centred), the second line's sign, the storefront's left edge, the doctor's
  `start` (beside the first station, clear of its markers), and its
  `YardScenery` (`earth` polygons, `paths`, `cobbles`, `water`, `bridges`, painted `props`, `plants`
  and the `blocks` the doctor can't walk through). The bakery is a village green with a duck pond,
  the chandlery hillside terraces, the dye house a river with three bridges, the smithy woods and
  mines round a cobbled forge yard, the tavern a lake. The pieces are laid out the same way
  everywhere: `gardenLayout(id, g)` (beds, sign, `route` and `route2` markers, `routeStart`),
  `bedPosition(id, bed)` (four by four, `BED_COLS`), `marketLayout(id)`, `stationLayout` (its
  purple markers `COINS_GAP` apart, a caption's width), `guildLayout`, `line2Layout`, `counterLayout`
  for the small storefront (`STORE`): its shelves with their `priceSign`s along the back wall, its
  drop, level and hire markers in the yard outside that wall, its work spot and till either end of
  the counter (far enough up that the customers' tips clear the Work caption) and its two
  `shopkeepers` behind it; and `routePath`, `routeMs`. `SHOP_HUD` is the yard's top band, under the top bar. Phaser-free, since the
  sim reads route lengths from it. A new shop needs its own plan: keep every piece's footprint clear
  of the others' (a station takes about 280x270 around its spot, a garden with side markers 314x204)
  and every marker reachable, and check the yard fresh and fully unlocked, in English and German.
- `src/scenes/townKit.ts`: what the town's scenes share: `townTopBar`, `townCard`, `leaveFor`
  (saves, then starts another scene with the live `GameState` as its scene data, `{ state }`, so a
  save that could not be written never loses the session) and `keepSaving`.
- `TownScene` lays the lots out in rows of three (`LOT`) with the districts' cards in a row below
  (`DISTRICT`, `addDistrict`, homes drawn as little houses by `drawHomes`), all centred in the view.
- `src/scenes/TownScene.ts` (`Town`) and `src/scenes/ShopScene.ts` (`Shop`, started with
  `{ shop }`): both take the state from their scene data on create and fall back to `loadState`
  (not `catchUp`: they are only entered through `leaveFor`, which hands the state over and saves
  first, so there is no time away), and run the apothecary with
  `tick(state, dt, null)` (as while away) next to `tickTown`; `GameScene` runs `tickTown(state, dt,
  null)` after its own `tick`. `src/art/town.ts` paints the goods, the beds (`bedTexture`: hives, flax, woad, coppice, ore pit, orchard, lavender, madder, copper pit), each
  shop's stations (mill, oven, wax press, spinning wheel, dipping vat, loom, dye mill, dye vat,
  charcoal kiln, bloomery, anvil), a shop's yard (`bakeYard`)
  and the lot houses (`bakeTown`, called by `BootScene`). `drawYard` paints a yard's grass, earth,
  paths, cobbles, water, bridges and props (`PROPS`: well, beer garden table, drying line of dyed
  cloth, rocks, jetty, terrace wall, reeds), the street, the storefront's floor and the fence;
  `ShopScene.createScenery` stands the trees and bushes (the apothecary's `tree-*` and `bush-*`
  textures) and walls off the `blocks`. `ShopScene` also draws a shop's day: its customers' tip
  rings and coins, the regular's star and the tip each pays, blighted beds in `BLIGHT_TINT` (the
  sickle, `autoHarvest`, clears them before it cuts), the shelf price with the overstock cut (orange
  when cut), a bundle contract with both goods' icons, and the town card (`createTownCard`:
  weather, reputation bar, tomorrow or the crowd, and a note when the blight strikes or the crowd
  comes, is served or walks off). It passes `HUD_BAND` to `setupZoom`, so at the top the camera
  scrolls past the yard and the yard below `SHOP_HUD` shows below the top bar and the cards.
- `src/scenes/weather.ts`: `addWeather(scene, world, depth, state)`, the weather over a yard, used
  by `GameScene` and `ShopScene`: a world-sized tint per weather (`TINTS`), rain streaks
  (`RAIN_STREAKS`) or heat waves (`HEAT_WAVES`), and the evening light (`DUSK_FROM`, `DUSK_ALPHA`).
  Returns a view.
- `src/scenes/BootScene.ts`: bakes all textures and animations, then starts `Game`.
- `src/scenes/GameScene.ts`: builds the world, markers and HUD, reads input, walks the doctor
  around stations and through the shop door, calls the sim each frame and updates views. Also
  `walkTowards` for customer sprites.
- `src/scenes/layout.ts`: every world position (gardens, plots, yards, stations, markers, pallets,
  priority signs, craftsmen, guild, outfitter, shop, its walls and doors, customer spots), plus the belt geometry:
  `BELT_PATHS` (main run first, then feeders; each runs from a station's out pallets to the next
  station's in pallets), `runLength`, `beltSpan` and `BELT_BUILD`. It imports no Phaser, since
  `sim.ts` and `save.ts` use it.
- `src/art/`: canvas-painted art, one `bake*` function per file. `paint.ts` holds the shared kit:
  the ink and paper colours (`INK`, `PAPER`, `WASH`, `ITEM_COL`), `SERIF`, the seeded art random
  (`seeded`, `reseed`, `rr`, `chance`), `paint(scene, key, w, h, draw, res)` which paints a texture at
  `res` times its size, `fit(image, scale)` which shows it at its logical size, and the brushes
  (`wash`, `ink`, `hatch`, `wob`, `both`, `shadow`, `paper`, `itemIcon`, `coinIcon`). `ground.ts`
  paints the whole world as one `ground-world` texture (grass, with each of `YARDS` as compressed
  earth, `WASH.dirt`), plus the expansion yard, the shop's walls
  (`ground-walls`, laid above the expansion yard so its edge doesn't cover the right wall), each garden and
  the scattered trees and bushes and the clumps of the `HEDGES` either side of the ground below the
  shop, which the doctor can't walk (`sceneryLayout`, the `hedge` texture). `ui.ts` paints parchment cards on demand
  (`cardTexture(scene, kind, w, h)`: bar, button, contract, town, chip, bubble, sign, small, panel) and
  `signTexture`, plus the `weather-<kind>` icons, the Settings button's `cog`, the hand slots' `bin`, the day bar's `moon`, the regular's `regular` star (`sparkle` in
  `paint.ts`, also on fine potions' icons), the plague card's `bell` and the `rival-stall`. `pixies.ts` paints the pixie (`PIXIE_FRAMES`, two wing
  beats) and the built routes' fairy-dust trails as one image (`drawFairyPaths`, re-painted when the
  set of built belts changes), and `pointAlong`/`laneOffset` place pixies on them. `stations.ts`
  also paints the study's desk (`study`) and the shop shelf (`shelf`); `TABLE_TOP` and
  `PALLET_DECK` are the light woods of the refining table and the pallets. `markers.ts` paints the
  floor markers (`pad-in`, `pad-out`, `pad-work`, `pad-up`) and one purple marker per
  `UPGRADE_ICONS` entry (`upgradePad(icon)`, `pad-up-<icon>`), and the pick-up markers that show what
  they give beside the arrow (`pickUpPad(what)`, `pad-out-<sack|bottle|coin>`: the refining tables',
  the cauldrons' and the till's). The counter's front panels each carry the shop's sign, Apothecary's
  favicon (`shopSign` in `stations.ts`, drawn from the favicon's own shapes).
- `src/ui/`: `BackStack` (items piled on the doctor), `IconRow` (customer wants), `Pallet` (crate
  stacks, exposes `item` and `count`, `setVisible`), `Shelf` (a shop shelf of one potion, up to six bottles, fine
  ones first; exposes `item` and `count`), `ProgressBar` (redraws only when its fill changes;
  an optional last argument sets its height, 6 by default; `setZone` marks a golden end zone, used for the cauldron's fine window;
  `setScrollFactor` pins it to the screen, as the shop's town card does;
  `destroy` removes it, as `ShopScene` does when a customer leaves),
  `RecipeBook` (exposes `lines`, in the game's language), `coins` (`coined`: gold coins over the
  `{coin}` slots of a text), `Settings` (read-only view of the hub's
  settings, the difficulty named by the shared texts, and New game).

- HUD: the top bar holds the purse (coin and number), Recipes (right edge at the bar's middle
  minus 230, which the test clicks), the day bar (`createDayBar`, at `DAY_BAR` from the middle:
  "Day 3", a dawn-to-dusk sky, the sun at the share of `DAY_MS` gone, the moon at its end, and a big
  "Day N" across the screen when `contract.day` changes), the hint, and the Settings cogwheel
  (`HUD_ICON_BUTTON`). `addWeather` (`weather.ts`) also lays the evening light. The
  hands bar (`HANDS_BAR`) sits at the bottom middle of the screen: a slot per `MAX_CARRY`, a `bin`
  on each full one, and a tap on a slot calls `dropItem`. Both bars stop taps from walking.
- Selling by hand: the doctor on the counter's work spot serves everyone, or a tap on a waiting
  customer's order bubble calls `serveOrder` for that order, only while the doctor's feet are in the
  shop (`inShop`), else "Step into the shop to serve".

### How it runs

- `BootScene.create` calls the `bake*` functions (doctor, items, garden, stations, markers,
  pixies, townsfolk, ground, ui); none load asset files. Then `GameScene.create` takes the state
  from its scene data (back from the town) or calls `loadState`, and runs the `create*` builders in
  order. "New game" restarts the scene with `{}`, since a restart without data keeps the old scene
  data and would bring the old state back.
- `GameScene.update(time, delta)`: sets `frameMs` (delta clamped to `MAX_STEP_MS`, 250), finds
  `workingAt` (the work spot under the feet), calls `tick(state, frameMs, workingAt, atCounter)`,
  then `movePlayer`, `standOnMarkers`, `autoHarvest` and `spinSickle`, copies the sprite position
  into `state.player`, and runs every function in `views`.
- Rendering is retained objects, not redraws: each builder creates its Phaser objects once and
  pushes a closure onto `views` that syncs them from `state` every frame. `once(ready, create)`
  defers creating things that appear when bought (second-line stations, fields, expansion yard).
  The belt network is redrawn only when the set of built belts changes.
- Depths: ground -1000 to -990 (scenery sorts by y like standing things), signs -910, belts -600, riding goods -550, plots -500, markers
  -400, till -300; standing things sort by y (the doctor by his feet); `WORLD_UI_DEPTH` (9999) for
  bars, order bubbles and feedback, `UI_DEPTH` (10000) for the top bar, the contract card, the town
  card (`TOWN_CARD`, `createTown`) and the away chip (below the town card), `UI_DEPTH + 1` for panels.
  The cards over the world (contract, town, plague, the order strip's and the hands bar, and the
  town shops' hands bar) are drawn at `HUD_CARD_ALPHA` (0.72), so the yard shows through; their
  text and icons stay opaque. The top bar, the hands bar and these cards are interactive and stop
  a tap (`stopTaps`), so it never falls through to a sign or walk target in the world under them.
- Walking: arcade physics steps once per drawn frame; WASD/arrows set velocity directly, and
  `limitWalkStep` (on `PRE_UPDATE`) caps a step at `MAX_WALK_STEP_PX` (20) so a long frame can't
  carry the feet through a station or wall (static obstacles from `addObstacle` and `SHOP_BLOCKS`).
- Taps: `reachable` moves a tapped spot out of any station or wall area into `pointerTarget`;
  `routeAround` picks a `waypoint`: the back door (`SHOP_DOORWAY`) into or out of the shop,
  otherwise a corner of the nearest `blockedAreas` rectangle (or the whole shop) in the way. Taps
  close an open panel instead of walking; HUD buttons, the top bar itself and the Recipes and
  Settings panels' backgrounds stop propagation (Phaser falls through to the main camera when
  nothing under the tap on the UI camera is interactive, which would reach a priority sign), and
  a tap on the Recipes panel closes it. A priority sign tapped while a panel is open only closes
  the panel. The tapped spot comes from
  `cameras.main.getWorldPoint`, since the pointer's own `worldX/Y` may be the UI camera's.
- Touch stick: a touch on the map (`pointer.wasTouch`, never the mouse) walks to where it landed
  like a tap and also starts `stick` (screen pixels, from `viewPoint`). Dragged past `STICK.drag`
  it goes `live`, drops the tap's target and steers: `movePlayer` takes knob minus base after the
  keys, nothing inside `STICK.dead`; the base is dragged along past `STICK.r`. Lifting the finger
  or a second finger (`pinching`) ends it. `drawStick` draws it at `UI_DEPTH` on the UI camera.
- Zoom: two cameras. The main camera follows the doctor and zooms (`MIN_ZOOM` 0.62 to `MAX_ZOOM`
  2, by the mouse wheel, + and - keys, or a two-finger pinch on `pointer1`/`pointer2`; all of it in
  `setupZoom(scene, world, hud)` in `src/scenes/zoom.ts`, which `ShopScene` calls too, so every shop's
  yard zooms between the same levels and keeps the zoom when the doctor walks between yards; `hud`
  (screen band covered, world band meant to be under it) lets the camera scroll above the world so
  nothing walkable stays under the HUD at the top. The
  pinch also
  cancels the walk when the second finger lands on the map, the top bar, a top-bar button or a
  priority sign; `pinching` checks it, so that finger doesn't change the sign or press the button.
  The open Recipes and Settings panels stop taps without this check). The camera's own zoom is
  the player's zoom times `renderScale` (`setupZoom`'s `zoom` reads the player's part back), and
  `followPlayer` gives it back Phaser's middle origin with `scrollingCamera`. `uiCamera`
  never moves or zooms beyond `renderScale` and draws everything from `UI_DEPTH` up: `splitCameras` sets each object's
  `cameraFilter` by its depth every frame, so later objects sort themselves. `setZoom` clamps,
  never zooming out past the world's width or height (`WORLD`, or the shop's `shopWorld`, so no
  paper shows at the sides, nor below the world on a 4:3 view), and stores the zoom
  under `apothecary-zoom`, one key for the apothecary and every shop.
- Map (`WORLD` 1680x900): two rows of production either side of the shop (line one on the left,
  line two mirrored on the right with `mirror`), each running east along `LINE_Y` from its gardens
  (wheat, mandrake and shade stacked at the far edge) through `REFINER` and `CAULDRON` into the
  shop's side wall. A station's drop and pick-up markers stand north of it either side (`IN_X`,
  `OUT_X`, at `HANDS_Y`), its work spot just above it (`WORK_Y`), its label, priority sign and
  upgrade, craftsman and belt markers in a row below it (`SIGN_Y`, `PRIORITY_Y`, `COINS_Y`,
  `COINS_GAP` apart). Its in pallets are left of it and its out pallets right of it (`acrossRoute`).
  The market below holds `OUTFITTER`, `STUDY` (left) and `GUILD` (right), with `EXPANSION_LAND`
  beside the shop. The shop (`SHOP`) stands in the middle, facing the street (`STREET`) along the
  bottom edge of the world; outside its north door are the counter's drop-off and Lv and Hire
  markers. `YARDS` are the earth patches the ground paints.
- Shop walls: `SHOP_WALLS` are drawn, with gaps for `SHOP_DOOR` (the back door in the top wall,
  the doctor's), `SHOP_STREET_DOOR` (in the bottom wall, the customers') and the belt holes in the
  side walls at `LINE_Y`. `SHOP_BLOCKS` are what the doctor collides with: the top wall pieces,
  the side walls, and the bottom wall with the street below it as one block, so only customers use
  the street door. `measureShop` and `inShop` read the shop's bounds from them.
- Markers: `addMarker`, `addLevelMarker` and `addBuildMarker` push a `Marker` (44x44 zone, `act`,
  `shown`). `standOnMarkers` runs the first shown marker under the feet once every
  `MARKER_INTERVAL_MS` (200); each call moves one item or pays at most 5 coins (`UPGRADE_STEP`).
  Purple markers (`pays`) take coins only once the doctor's body has stood still for `STILL_MS`
  (400, tracked in `stillSince`), so walking over one buys nothing. The longer the doctor then stays
  on the same marker (`lastMarker`, `markerSince`), the more each payment takes: the scene sets
  `payment.boost` (`state.ts`) to `payBoost(held)`, doubling every `PAY_DOUBLE_MS` (1s) up to
  `MAX_PAY_BOOST` (64), around `act` and back to 1 after; `pay` in `sim.ts` and `payTowards` in
  `townSim.ts` multiply their step by it, and `ShopScene` does the same; their captions show the coins
  still to pay (cost minus `paid`), with no bar.
  A level marker sets `paused` after a level completes until the doctor steps off, and is hidden
  (marker and caption) once its last level is bought. Each purple marker gets the `UpgradeIcon` of
  what it buys (`upgradeIcon(id)` for an upgrade: the station's own icon for a station's level),
  passed to `addLevelMarker` and `addBuildMarker`.
- Unlocks: every purchase has an `Unlock` key (`level-<upgrade>`, `hire-<station>`,
  `belt-<belt>`, `guild`, `land`). `UNLOCKED_BY` in `src/game/state.ts` names what must be bought
  first (its first level or build): one chain at the start, then branches from the garden belt.
  `unlocked` also holds once the thing itself has a level or coins paid in, so old saves keep what
  they started. The pay functions in the sim refuse a locked thing, and the scene's purple markers
  are shown only while it is unlocked. Entry to the guild is `state.guild` (a `Build`, `GUILD_COST`
  50), paid by `joinGuild` at a marker on `GUILD.join`, which shows until the customers
  upgrade can.
- Belts, shown as pixies: each route starts below a station's out pallets (or in the gardens) and
  ends above the next station's in pallets, or above the shop's shelves. The sim still takes from
  the station's `output` and hands to its tray; the pallets are those trays drawn. `createBelts`
  draws a pixie and the item's icon for each riding item, a lane's `laneOffset` to the side of the
  route; in its last `PIXIE_APPROACH_MS` the pixie flies over to `dropSpot` (its kind's pallet at
  `BELT_TARGET`, or its shelf). Wings beat and pixies bob on `this.time.now`; with reduced motion
  they glide on their first frame. Pixies are drawn at `PIXIE_DEPTH`, above everything standing. A built belt hides its pick-up marker, and its drop marker
  unless the doctor carries that kind; the counter's drop stays until `doneByHand` is false for
  both cauldron belts. Goods get on at `beltSpan(id, kind).start` (mandrakes on their patch's
  feeder) and join the main run at `join`. Each cauldron belt runs on its own into its side of the
  shop. `payBelt` loads matching goods from the
  doctor's hands, unless `doneByHand` says the other line's twin is still by hand.
- Priority: once `studied(state, 'craftOrder')`, `addPrioritySign` shows a tappable "First:" sign at `PRIORITY_SIGNS[id]` by each
  table's and cauldron's label; a tap calls `cyclePriority` (none, then each plant, or each
  researched potion, in `PLANTS`/`POTIONS` order) and stops propagation so the doctor doesn't walk. The sign shows the
  item's icon, or "any".
- Stock pricing: `serveFromShelf` pays `stockedPay(pay, stocked, storage(state))`, where
  `stocked` is how many of that potion (plain or fine) stood on the shelf, the one sold included;
  `stockFactor` (no cut up to `STOCK_FREE` 5, then even steps to `MAX_STOCK_CUT` 50% on a full
  shelf) is in `src/game/state.ts`. A fine one of the wanted potion goes first and pays
  `FINE_BONUS` times as much before the cut. The scene shows the next sale's cut under each shelf.
- Shelves: `createShopfront` builds a `Shelf` per potion at `shelfPosition(i)`, three on each side
  wall, each in its fixed spot, and shows those `researched`. They are not obstacles.
  `pallets.counter.in` holds the shelves standing, in `POTIONS` order, for the test. The shelf
  holds `storage(state)` of each potion, plain and fine together (`hasRoom`). The counter's drop
  marker is outside the north door; its work spot is right behind the counter, the coins beside it.
- Pallets: `addPallets` builds a `Pallet` for every kind with a spot in `PALLETS` but shows only
  those `available`: plants (nightshade once `shadeGrown`), a refined good once its plant is
  available, a potion once `researched`. `this.pallets[id]` holds only the standing ones, which is
  what the test reads.
- Study: `createStudy` puts the desk (an obstacle) under its sign at `STUDY` and a level marker for
  the `research` upgrade, captioned with the next recipe in `RESEARCH_ORDER`; it unlocks with the
  garden belt. Around the desk, `STUDY.replant`, `STUDY.priceSigns` and `STUDY.craftOrder` sell the
  study's `LESSONS` (`Lesson`, `studied`): `replant` (30), `craftOrder` (40) and `priceSigns` (60),
  also unlocked by the garden belt, which let the garden signs replant and show the priority signs
  and the price signs; until learned, `replantGarden` only says where to learn it, `cyclePriority`
  and `cycleSign` do nothing and `signOf` reads Fair. `loadState` grants each lesson to an older save
  already using it (a garden replanted, a priority or a sign set).
  `payUpgrade` says "Learned <potion>!". `startBrew` skips recipes not `researched`,
  `orderable` leaves them out of orders, and `RecipeBook` fades them with "Study" for a price.
- Orders: `createOrderStrip` shows a `chip` card per order (`ORDER_STRIP`, up to
  `MAX_ORDER_SLOTS`) under the top bar on the left, with the wants still owed and, once at the
  counter, a patience bar.
- Weather: `addWeather` (`src/scenes/weather.ts`, also used by every shop) lays a world-sized tint
  rectangle and a `Graphics` at the depth it is given (`WEATHER_DEPTH`, under the bubbles and bars)
  and, each frame, draws `RAIN_STREAKS` rain streaks or `HEAT_WAVES` heat waves across
  `cameras.main.worldView`, placed by a fixed `scatter` so it never calls `Math.random`. Mild days
  draw nothing; reduced motion keeps only the tint.
- Fine window: `inFineWindow(brew)` holds from `1 - FINE_SHARE` (75%) of a brew to its end.
  `pickUpFromCauldron` takes such a brew (`brewing` first, then `brewing2`) out as its `FINE` potion before anything on the out
  pallets. A brew only moves while worked, so stepping off the work spot holds it in the window.
  The brewing bar's zone (`setZone`) and fill turn gold there. Each station has a second bar
  below the first for its second pipe, shown only while that pipe works. The refining table's bars
  are amber (`REFINING_BAR`) and 8px tall (`REFINING_BAR_H`), so they read against the cream track.
- Reputation and regulars: `tick` lowers `reputation` by `REPUTATION_WALKED_OFF` for each order
  whose patience runs out (and marks a running rush lost); `orderFilled` raises it by
  `REPUTATION_SERVED`, and a customer filled with `tipLeft` at least `REGULAR_TIP_LEFT` joins
  `regulars` (oldest dropped past `MAX_REGULARS`). `newOrder` rolls `REGULAR_CHANCE` only while
  there are regulars, so a new game's first orders use the same randomness as before. A regular's
  order has their `face`, `regular: true`, their old `asked` potions and `REGULAR_BONUS` more pay
  each. `orderInterval` is scaled by `reputationFactor` (1 at 50).
- Weather and market days follow `contract.day` (which also rolls when a contract is kept):
  `weatherFor(day)` is mild on day 1 and then cycles `FORECAST`; `growthSpeed` and
  `orderInterval` apply it. On a market day, once `dayLeft` is under half, `tick` calls
  `startRush` once (`rush.day`): up to `RUSH_SIZE` orders flagged `rush`, filling the counter's
  places and `RUSH_EXTRA` more (`MAX_ORDER_SLOTS` includes them). Filling all of them with none
  lost pays `RUSH_BONUS` each into `coins`.
- Customers: the scene walks each order's sprite (`customerTexture(order.face ?? order.id)`) from `STREET` to `customerPosition(i)` and adds
  the order to its `atCounter` set once it arrives. `tick` serves, and counts down patience for,
  only orders `atCounter` accepts (default: all). Wants and patience show only once arrived.
- Harvest is automatic: plots within `displayHeight * harvestReach(state)` of the doctor's centre,
  nearest first, one per `HARVEST_INTERVAL_MS` (150). Blighted plots in reach are cleared first
  (`clearBlight`, hands full or not), and the sickle spins for them too.
- Price signs: `addPriceSign` puts a tappable small sign beside each shelf at `shelfSignPosition(i)`,
  shown with the shelf once `studied(state, 'priceSigns')`; a tap calls `cycleSign` and stops propagation. `serveFromShelf` scales a
  potion's pay by `SIGN_PAY`, adds `SIGN_REPUTATION` and takes the rival's `RIVAL_CUT` off a plain
  one the rival undercuts (a fine one beats it); `tick` drains patience by `patienceRate` (dear
  wants); `newOrder` draws from a hat with each potion in it `SIGN_DEMAND` times (all signs Fair
  leaves the draw as it was, so the playthrough's orders repeat). The cut text under a shelf shows
  the combined factor: stock, sign and rival.
- Book contracts: `contractFor` keeps days 1 and 2 as Sleeping Tonics then Healing Draughts; from
  `BOOK_CONTRACT_DAY` it picks from `orderable` by the day (no randomness), and every
  `BUNDLE_EVERY`th day from there (4, 7, 10, ...) splits the potions into a `bundle` of a second
  potion. `serveFromShelf` counts a sale while `contractWants` holds; `deliverForContract` keeps it
  once both parts are met. The card titles both parts and colours each part's pips.
- Seasons: `brew` cures the plague once (`cured`, `curedDay`, `seals++`); `tick` starts
  `plagueAt(0, 0, 0, season + 1)` `SEASON_GAP` days after `curedDay` (set on the spot for a cured
  save without it). `stagesFor(season)` gives the stages (`SEASON_STAGES` plus `SEASON_EXTRA` a
  season), and `plagueStage` takes any potion for a stage whose potion isn't `orderable`.
  `potionPrice` rises by `SEAL_PRICE` per seal. Only the first cure opens `showWin`; later ones
  say so under the plague card.
- Wagon: `tick` sets `state.wagon = wagonFor(state, day)` on an `isWagonDay` once `dayLeft` is
  under `WAGON_ARRIVES` of the day, and counts its `left` down. `createWagon` draws it at `WAGON`
  (out of the doctor's reach, a tappable image that stops propagation) while `wagonHere`; a tap
  calls `sellToWagon`, which takes a full crate off the shelf, plain first, for `crate * pay` coins
  into the purse. The scenery leaves trees off the street's right for it.
- Herb market: `createHerbMarket` lays its stall, a sell marker (`pad-in`) and a buy marker
  (`pad-out`) at `HERB_MARKET`, both with `pays` so walking over them trades nothing, and a
  tappable sign that calls `cycleMarketPick`; all shown once `marketOpen` (the garden pixies
  built). Captions show today's `herbBuyPrice` and `herbSellPrice`.
- Blight: `spreadBlight` in `tick` rolls `rand` only when the blight can strike (from `BLIGHT_DAY`
  on a rainy day, not immune) or a blighted bed can spread, so day 1 uses the same randomness as
  before. A blighted plot (`blighted`, `blightMs`) doesn't grow and `isRipe` is false, so the
  sickle and the pixies leave it; its plant is tinted `BLIGHT_TINT` and its bar hidden. The
  herbalist clears every bed at once. The town card's note names the garden struck.
- Replanting: `addGardenSign` makes each garden's sign tappable (`GARDEN_SIGN_W`, the plant's
  name from `GARDEN_NAMES` and its icon); a tap calls `replantGarden`, which changes every plot
  of the garden in place (the scene's plot closures keep their plot objects). Goods picked by a
  garden belt carry `run` (`GARDEN_RUN` of their garden) so pixies fly them from the garden they
  came from: `beltSpan(id, kind, run)` and `takeForBelt` return it.
- Rival: `tick` calls `rivalNewDay` whenever `rival.day` falls behind `contract.day`: yesterday's
  `sold` against `RIVAL_SALES` (times `dayShare`, the part of the day that went by, which
  `deliverForContract` sets when a kept contract ends the day early) moves `streak` on or resets it, `RIVAL_MONTH_DAYS` closes the
  rival, and `rivalPotionFor(day)` picks today's potion (none before `RIVAL_DAY`). `createRival`
  draws the stall at `RIVAL` once there is anything to say, boarded (faded) when closed.
- Plague: `tick` starts it at `PLAGUE_DAY` (`plagueAt(0)`), counts the stage's `left` down and
  calls `relapse` at 0. `serveFromShelf` calls `deliverForPlague` for every potion sold; enough
  moves to the next stage, and past the last `panaceaUnlocked` holds. `startBrew` then brews the
  Panacea first whenever `PANACEA_RECIPE.inputs` are in; `brew` sets `plague.cured` instead of
  putting it out, and `pickUpFromCauldron` never takes it out fine. `createPlague` draws the card
  at `PLAGUE_CARD` (under the town card, clear of the shelves when the doctor is at the counter)
  with notes for each change (starting from `plagueSaved`, the plague as loaded before `catchUp`
  played the time away, so a stage, relapse or cure while away is told too), and `showWin` opens the cure's panel, closed like the others by
  `closePanels` (any tap).

### State model

`GameState` in `src/game/state.ts` is plain JSON (`version: 3`, `layout`). Key parts: `carrying`
(bottom to top), `player` (starts at 630,620, in the market), `plots` (3 per garden, gardens in `GARDENS` order,
two per line), `refiner`/`refiner2` (`queue`, `progress`, `output`, and `second`: the second
pipe's plant and progress, or null), `cauldron`/`cauldron2` (`contents`, `brewing`, `brewing2`,
the second pipe's brew, and `output`), `counter` (`shelf`, `till`, `serving`), `orders` (each with fixed
per-potion `pay`, and `patience` that counts down only at the counter), `upgrades`, `craftsmen` (an
`Upgrade` whose `level` is the number hired), `belts` (a `Build` plus riding `items`, each `at` ms
along the main run), `priority` (per `CraftingId`, a `PlantId` or `PotionId` to make first, or
null), `guild` (a `Build`: entry to the guild), `expansion` (land, two fields, refiner, cauldron as
`Build`s), `shade` (the two shade gardens as `Build`s), `contract` (`day`, `potion`, `need`, `made`, `reward`, `dayLeft`, `kept`), `sold` (potions
handed over at the counter, ever), `tips` (tip coins ever), `lastSeen` (wall-clock ms of the last
save or load, 0 in a new game), `reputation` (0 to 100), `regulars` (`face`, `wants`), `rush`
(`day`, `size`, `served`, `lost`, `paid`, or null), `plague` (`stage`, `need`, `made`, `left`,
`relapses`, `cured`, or null before day 5), `signs` (a `PriceSign` per potion, Fair when missing),
`rival` (`open`, `day`, `potion`, `sold`, `streak`, and `dayShare` once a kept contract ended the day early),
`seals` (town seals), `wagon` (`day`, `potion`, `crate`, `pay`, `left`, `sold`, or null) and
`marketPick` (the herb market's good to buy). `town` (`TownState`) holds the shops bought, the
doctor's hands in town and the `districts`; `loadState` fills it through `normalizeTown`, which merges each shop, station
and route per key and each district by index, so new shops, stations and districts load into old saves. The contract may have a `bundle` (`potion`, `need`,
`made`); the plague may have `season` and `curedDay`. Each order also has `tip`, its full tip (`maxTip`
of its size), and may have `asked`, `face`, `regular` and `rush`. `counter.shelf` and `carrying`
can hold fine potions. A plot may be `blighted` with `blightMs`; a belt item may carry `run`; a
brew's `out` may be `PANACEA`.

- Tips: when an order's last potion is handed over, `serveFromShelf` adds `tipNow(order)` to the
  till and `state.tips`: `tip` scaled by `tipLeft`, which falls from 1 at the counter to 0 once
  `TIP_SHARE` (60%) of its patience is gone. `pay` (price plus the counter bonus, `2 * (counter
  level + 1)`) is unchanged and paid per potion as before.
- Contract: `tick` counts `contract.dayLeft` down by `dt` and at 0 rolls to `contractFor(day + 1,
  kept)`. Each potion of `contract.potion` handed over calls `deliverForContract`, which at `need`
  pays `reward` into `coins` and rolls to `contractFor(day + 1, kept + 1)` at once. Odd days ask for
  Sleeping Tonics, even days Healing Draughts; `need` is `3 + kept` up to 12; `reward` is 45% of
  what they sell for, rounded to 5. The scene's card notes "Contract kept!" or "Dusk: contract
  missed" when `contract.day` changes under it.
- Only `src/game/sim.ts` changes rules state, mutating in place. The scene writes only
  `state.player` and passes `workingAt` and `atCounter`; it never edits stock directly.
- Every tray holds at most `storage(state)` of each item kind (10, plus 10 a level of the guild's
  Storage upgrade, up to `PALLET_SIZE` 40); `palletHasRoom(state, tray, item)` guards every add,
  and `hasRoom` counts a shelf's plain and fine potions together.
- Second-line stations and fields exist in state from the start; `stationBuilt` and `gardenBuilt`
  gate them. A station works only with `crew` > 0: its craftsmen, or the doctor on its work spot.
- Second pipe: with two craftsmen (`secondPipe`) a table or cauldron works two things at once, each
  at the speed one pair of hands works, rather than one twice as fast. A table's first pipe works
  the front of `queue` as before; `refineSecond` takes the next plant to start on from behind it
  (same priority rules) into `second`, and a finished one waits there while its pallet is full. A
  cauldron runs `brew` on `brewing`, then on `brewing2`. `second` and `brewing2` are optional, so
  old saves load with both empty.
- The refiner moves the plant it works on to the front of `queue`, resetting `progress` when that
  is a different plant (a started plant whose pallet filled up loses its work rather than handing
  it to the newcomer); `refining` keeps a started plant
  there while its pallet has room and otherwise picks the priority plant first (`firstToRefine`), also right after finishing
  one, so leftover work goes onto the priority plant; without one, the plant whose good has the
  fewest on the output pallets (`onPallet`), ties to the front of the queue. Work past the end of a plant,
  brew or served potion carries over to the next, so slow frame rates lose nothing.
- `startBrew` (called by `brew` for either pipe) picks the recipe when work starts: the cauldron's priority potion if its inputs are
  in and its pallet has room, otherwise the potion with the fewest on the cauldron's output pallets
  and the shop's shelf together (a fine one counts as its plain potion); ties go in `RECIPES`
  order. A potion `BREW_LEAD` (6) or more ahead of the shortest `orderable` potion is skipped, so
  its ingredients wait for the short one. A priority never makes a station wait.
- Picking up (`pickUpOne`, for both pick-up markers) takes a mix: each time the kind the doctor
  carries fewest of, then the kind with the most waiting, then the first.

### Persistence

- `apothecary-save`: the `GameState` (with `lastSeen` stamped by `saveState`), saved every `AUTOSAVE_MS` (3s), on tab hide and on
  `pagehide` (not after "New game" is confirmed). It is saved thin (`thinSave`, marked `thin: true`)
  to keep progress codes short: every entry of `upgrades`, `craftsmen`, `belts` and `expansion`
  still at its start (`untouched`: only `0`, `false` or `[]` inside, so `{ level: 0, paid: 0 }` or
  `{ built: false, paid: 0 }`) is left out, and so is each town shop's in `routes`, `counter`,
  `outfitter`, `study`, `guild`, `recipes` and `line2`; the load's per-key merges fill them back in.
  `loadState` discards saves whose `version`
  differs or that lack `plots`, shallow-merges top-level fields, merges `upgrades`, `craftsmen`,
  `belts`, `expansion` and `priority` per key, appends new plots (or, when a saved plot's plant doesn't match
  its garden, as in saves from three beds a garden, starts every plot fresh: `keepsPlots`) and
  drops orders without `pay`. `keepsPlots` now asks that every bed of a garden grows the same
  plant (a replanted garden switches all nine), not that it grows `GARDENS`' plant. A save without
  `guild` counts as having joined if it bought or paid into any guild upgrade. A save that isn't
  thin, written before the study, gets `grantLessons`: a missing `research`, `craftOrder`,
  `priceSigns` or `replant` is granted when the save already uses it (in a thin save a missing
  upgrade is just one never bought). `e2e/save.spec.ts` loads an old whole save and checks the thin
  one written back. A save from before
  `COLUMNS_LAYOUT` (5) first gets `ontoColumns`, which scales each belt item's `at` by its belt's
  new `BELT_MS` over the old `U_BELT_MS`, so it keeps its place along the shorter run; then a save
  from before `HEART_LAYOUT` (6) gets `ontoHeart`, which scales each belt item's `at` by `BELT_MS`
  over `COLUMNS_BELT_MS` for the rows; last, a save from before `FEEDERS_LAYOUT` (3) gets
  `ontoOwnRuns`, which moves belt items up to their run's join on today's belts (so the U goes to
  columns, then to the heart, then onto its own runs). A new layout migration that rescales goes
  before `ontoOwnRuns`. A save
  whose `layout` differs from `LAYOUT` (6, the rows) gets the fresh `player` spot.
- Away: `GameScene.create` calls `catchUp(state, Date.now())` right after `loadState` and keeps the
  result in the public `away` field; `createAwayChip` shows it (top right, `AWAY_CHIP`) until tapped.
  The new fields (`contract`, `sold`, `tips`, `lastSeen`, `shade`, `reputation`, `regulars`,
  `rush`, `plague`, `signs`, `rival`, `seals`, `wagon`, `marketPick`) come from `fresh` through the shallow merge, so `version` was
  not bumped; old orders without `tip` tip nothing, and an old save's rival picks its potion on
  the next tick.
- `apothecary-zoom`: the main camera's zoom in the apothecary and every shop, a view preference that "New game" keeps.
- `apothecary-trophies`: the trophies earned (`shared/trophies.ts`), each id with the time; "New
  game" keeps them.
- "New game" (`clearSave` + `scene.restart`) removes only `apothecary-save`. The old
  `apothecary-fps` key is no longer used; the frame rate comes from the hub.

### Randomness and timing

- `Math.random` is used only by `tick` (its default `rand`, now the fifth argument): `orderInterval`,
  `newOrder` (a returning regular, only once there are any; one or two potions, which ones,
  patience), `startRush` and `spreadBlight` (only from day 3 in the rain, or while a bed is
  blighted), also when `catchUp` plays time away. The weather, the rival's potion and the plague
  are not random: they come from the day.
  Art noise uses `seeded`/`reseed` from `src/art/paint.ts`, reseeded per texture, so painting never
  touches `Math.random`.
- `Date.now()` is used only for `lastSeen` and `catchUp`; the test starts with empty storage, so
  `catchUp` returns null before using any randomness.
- Sim time and customer walking use `frameMs`, the clamped Phaser `delta`. Marker, harvest and
  feedback pacing use `this.time.now` and `delayedCall`; autosave uses `this.time.addEvent`. The
  sickle spins with the raw `delta`.

### Data tables

- Items, grow, refine and brew times, base prices: `src/game/items.ts`.
- Upgrade caps and costs (`UPGRADES`, `upgradeCost`), craftsmen (`MAX_CRAFTSMEN`,
  `craftsmanCost`), belts (`BELT_COST`, `BELT_MS`, `BELT_LANES`, `BELT_GAP_MS`, `BELT_ENDS`),
  `EXPANSION_COST`, `SERVE_MS`, `MAX_ORDERS`, pallet size, and effect formulas (`speedAt`,
  `growthSpeed`, `beltSpeed`, `potionPrice`, `orderInterval`, `carryCapacity`, `walkSpeed`,
  `harvestReach`): `src/game/state.ts`. Order size, tip, patience and difficulty are in
  `newOrder` in `src/game/sim.ts`; the customers level raises the two-potion chance and divides
  patience by `1 + 0.5 * level`, alongside `orderInterval`.
- Walk speed `SPEED` (160), `MAX_WALK_STEP_PX`, `CUSTOMER_SPEED` and the scene's interval constants:
  top of `src/scenes/GameScene.ts`.

### Hub settings

- `src/main.ts` calls `setupGame(game)` from `shared/setupGame.ts` right after creating the game,
  which applies the hub's frame cap, the FPS readout, reduced motion and full screen, and then
  `setupScaling(game, { fill: true })` from `shared/scaling.ts`, which draws the canvas at the screen's resolution
  (`renderScale` canvas pixels per game pixel, zooming every camera to match) and asks to turn a
  phone held upright. With `fill` the view takes the screen's shape (960 to 1296 wide, 540 to 720
  tall, picked at start) with no bars: the scrolling world just shows more of itself, the top bar
  centres Recipes, the day bar and hint on the view and pins the purse and cog to its edges, the
  order strip stays at the left edge, the hands bar at the bottom middle, and the contract, town,
  plague cards and away chip keep their designed spots shifted by `viewFrame(this).x`, so they stay
  under the day bar. At exactly 960x540 nothing moves. `paint` multiplies each texture's `res` through `sharpRes`, so art stays
  crisp on big screens. The top bar and panels lay out with `viewSize(scene)`, not `scene.scale`,
  which is in canvas pixels. `e2e/screens.spec.ts` at the root checks the game on five screens.
- Difficulty scales one number, customer patience: `newOrder` in `src/game/sim.ts` multiplies
  `maxPatience` by `byDifficulty(1.5, 1, 0.7)` from `shared/settings.ts` (Easy 1.5, Normal 1,
  Hard 0.7). Keep Normal exactly as designed: the playthrough runs on Normal.
- Reduced motion: the game has no camera shake or flash. `GameScene` reads
  `settings.reduceMotion` (imported as `hubSettings`, since the scene has its own `settings`
  panel): `addCauldron` leaves the cauldron on its still frame instead of playing the
  `cauldron-boil` flicker, the craftsmen at the stations stop rocking while they work, the belt
  pixies glide on their first frame without bobbing, and `addWeather` keeps only the tint (no
  rain or heat waves), in the shops too. `ShopScene` holds its route pixies still the same way, and `TownScene` skips
  the shake of a lot card the player can't afford.
- The game's Settings panel only shows the difficulty and frame rate ("Change these on the hub
  page") and has "New game". Settings are read once at page load.
- A change to what the difficulty scales updates the Apothecary row of the difficulty table in the
  root README.md and the Settings paragraph in this game's README.md.
- Shared settings live under the `hub-settings` key, not in `apothecary-save`; "New game" keeps
  them.

## Sound

Everything plays from `GameScene`, never from `src/game/`, so the sim stays free of audio and
`catchUp` (the time away) is silent: `createSound` starts comparing from the state as loaded, after
`catchUp`, and the plague card's first frame (which tells what changed while away) plays nothing.
Under browser automation the engine is a no-op, so the playthrough is unchanged.

- Music, `SONG` in `src/audio.ts`: modal folk in D Dorian at 84 BPM (recorder-like pulse lead,
  plucked square arpeggio, triangle bass, light shakers). Parts: `calm` (eight bars, a normal day)
  and `plague` (D minor with Bb and A major over a heartbeat, while `state.plague` spreads and isn't
  cured). `RUSH_SONG` (96 BPM, a jig over a driving bass, part `rush`) plays while any order of a
  market day's crowd (`rush`) is waiting. `createSound` picks the part each frame (rush, then plague,
  then calm) and calls `playMusic` only when it changes; a New game's `create` starts over from calm.
- Stings (parts of `SONG`, played with `playSting`): `day` (a soft bell) when the day rolls over
  without a kept contract, after the `missed` effect; `kept` (a fanfare) when a contract is kept
  (both in `createContract`'s day change); `relapse` (a low toll) when the plague starts, a new
  season starts or a stage relapses, and `win` (D major) when the town is cured (`createPlague`).
- Effects, `sfx` (each with its own `gap`; soft volumes):

| Sound | Where it plays |
| --- | --- |
| `swish` + `pluck` | `autoHarvest`, a ripe bed cut |
| `rasp` | `autoHarvest`, a blighted bed cleared |
| `drop` | drop markers at a table, a cauldron and the counter (`sounded`) |
| `pickUp` | pick-up markers at a table, or a cauldron's pallet (`pickUpPotion`) |
| `fine` | `pickUpPotion`, a brew taken out in its fine window |
| `bubble` | `createSound`, a station on screen puts out a good or potion (one per frame) |
| `pay` | purple markers (`addLevelMarker`, `addBuildMarker`) and the herb market's buy marker, pitched up as the price fills |
| `upgrade` | a level, craftsman, recipe, pixie route or build fully paid |
| `toss` | a hands slot tapped (`dropItem`) |
| `sell` / `served` | `createSound`: `state.sold` went up / an order left with nothing more to want |
| `cascade` | the till collected, the herb market's sell marker, a crate sold to the wagon |
| `hmph` | `createSound`, an order gone with wants left and no patience |
| `missed` | `createContract`, a day ended with its contract missed |
| `rush` | `createSound`, a market day's crowd arrives |
| `blight` | `createSound`, more beds blighted than last frame |
| `plagueUp` | `createPlague`, a stage beaten or the Panacea unlocked |

- Shared sounds: `ui('click')` for the Recipes and Settings buttons, price signs, priority signs,
  the herb market's sign and a garden sign that replants; `ui('refuse')` for a garden sign with nothing else to plant, a tap on an order bubble
  that hands nothing over (out of the shop or not on the shelf), a wagon tap without a full crate,
  and a purple or herb market marker that takes nothing (no coins, nothing to trade), once a visit
  (`refusedMarker`, reset on stepping off).
- The town's scenes play the `calm` part, and `ShopScene` the `rush` part while a market crowd is
  at the counter or waiting. `ShopScene` plays `swish` + `pluck` for a bed cut, `rasp` for a
  blighted bed cleared, `blight` when a bed is blighted and `rush` when the crowd comes,
  `drop`, `pickUp`, `pay`, `cascade` (the till) and `upgrade` at its markers as the apothecary does,
  `toss` for a hands slot, `bubble`, `sell`, `served` and `hmph` from what changed in its shop each
  frame, `fine` for a pick-up in a station's fine window, the `kept` sting when its contract is
  kept (`createContract`), and `ui('refuse')` for a marker that takes nothing. `TownScene` plays `ui('click')` for a
  lot walked into, `upgrade` for a shop bought and `ui('refuse')` for one the purse can't pay.
- Not done: no ambience (cauldron bubble loop, rain) and no sound per pixie, as the plan says.

## Testing hooks

- The dev build sets `window.game`. The test reads the `Game` scene's `state`,
  `player.body.center` (feet), `pointerTarget`, `away` (null on a fresh game), `pallets[id].in/out` (each `Pallet`'s `item` and
  `count`), `recipes.visible` and `recipes.lines`, `customers` (id, x, y, `arrived`) and
  `cameras.main.worldView.x/y` (not `scrollX/Y`, which differ once `renderScale` zooms the
  camera). The game runs in British English, the default language, so the recipe lines spell "Vigour Tonic". Several of these are private in TypeScript; renaming them breaks the
  test without a type error.
- Inputs: canvas clicks only (walking, the Recipes button at screen 219,22, a tap on the panel to
  close it). It
  watches the first customer walk in from `STREET`, and walks into the shop by the door routing.
  Its taps must not land on a garden sign or a shelf's price sign either, which take the tap like
  a priority sign. Day 1 has no blight, rival or plague, and every sign is Fair, so none of them
  changes the first round.
- It seeds `Math.random`, owns `page.clock`, makes `requestAnimationFrame` a 64ms timer and forces
  the canvas renderer. It starts with empty storage, so it expects a fresh state on Normal, with
  every priority left at "any"; its taps must not land on a priority sign, which takes the tap.
- Mirrored in `e2e/playthrough.spec.ts` (update together): every spot in its constants block
  (refiner, cauldron and counter markers, `LEAVE_SHOP`, `STREET`, `FIRST_CUSTOMER` =
  `customerPosition(0)`, the counter's drop outside the north door), `WALK_SPEED`,
  `POTION_PRICE`, the counter bonus in `potionPay` (it assumes one of each potion on the shelf, so
  no stock cut, and asserts it), grow times 24000/30000, the bed layout
  (`BESIDE_GARDENS`, `BETWEEN_GARDENS`, `WHEAT_CUT`, `MANDRAKE_CUT`: walking left along the line
  between the wheat field and the mandrake patch below it, the sickle's 72px reach from the
  doctor's middle takes the right-hand and middle beds of the rows either side, two wheat and two
  mandrakes), the first brew (both cauldron pallets empty, so Sleeping Tonic on the tie), the mixed
  pick-up (a flour and a seed first), the recipe
  line text and order (all six, learned or not), the recipes known from the start (Healing Draught
  and Sleeping Tonic: two flour and two seeds make one of each), the tip rules (`maxTip`, `TIP_SHARE`, `tipNow`), the fine window
  (`FINE_SHARE`, `FINE_BONUS`, `FINE`), the reputation numbers, `DAY_MS` and the first
  contract (`FIRST_CONTRACT`: 3 Sleeping Tonics for 20), carry capacity 4, the camera scrolling along the row, and which pallets
  each station shows (only what is available: wheat and mandrake in and flour and seeds out at
  the table, flour and seeds in and the two known potions out at the cauldron, and a shelf for
  each of the two potions known at the start).
- The first round takes the first brew out in its fine window: it waits for 75% of the brew, walks
  to the pick-up marker and expects the fine potion; the second brew finishes plain. Day 1 is
  mild, so the weather changes nothing in it, and it ends long before a market day.
- The first potion sold earns the First customer trophy, and the test checks that
  `apothecary-trophies` then holds only `firstSale`; a trophy a first round can reach in another
  way changes that expectation.

## Making common changes

- Add or change a text: its key in `src/i18n/en.ts`, the German in `src/i18n/de.ts` (the build
  fails without it) and, when the US spelling differs, `src/i18n/en-US.ts`; run
  `node scripts/check-translations.mjs`. German runs longer than English: a station's row of
  purple markers and the outfitter's are the tightest spots (their captions pass a `room` to
  `fitCaption` in `GameScene.ts`, which sets one a size or two smaller rather than let it run into
  its neighbour), then the top bar's buttons and hint and the contract card's title (which
  shrinks its font to fit), so keep German short and check a new text with `?lang=de`. Never compare a translated text in game logic; compare ids.

- Tune a number: edit the table in `src/game/items.ts` or `src/game/state.ts`; if it is a grow
  time, price, tip, carry size or recipe, update the matching expectation in the playthrough.
- Add a potion recipe: add the `PotionId`, an `ITEMS` entry, a `RECIPES` entry (order breaks ties),
  `POTION_PRICE`, its colour in `ITEM_COL` and a flask shape in `itemIcon` (`POTION_SHAPES`) in
  `src/art/paint.ts`, a cauldron out pallet position in `PALLETS` (one per potion, in `POTIONS`
  order), and either `KNOWN_RECIPES` or a place in `RESEARCH_ORDER` (raising the `research`
  upgrade's `max`), plus `NEEDS_NIGHTSHADE` if it does. Shelves and pixie lanes follow on their own.
  Give it a name, a `<potion>Count` and a fine name in each `src/i18n/` file. Update the recipe
  lines in the test.
- Add a plant: `PlantId`, `ITEMS`, `GROW_MS`, `REFINE` (and its refined item), plant art in
  `src/art/garden.ts` (`bakeGarden` and `plantTexture`), item art in `itemIcon`, gardens appended
  to `GARDENS` and `GARDEN_LINE` plus `GARDEN_AREAS` and `gardenBuilt`, new in and out pallet spots
  for the tables and cauldrons in `PALLETS` (`acrossBelt`), and a feeder run in each garden belt's
  `BELT_PATHS` with the plant in `GARDEN_RUNS` (runs follow that list). New plots append, so old
  saves keep working.
- Add a potion: also give it a `FineId` in `FINE` and `ITEMS` (kind `fine`); `itemIcon` draws a
  fine potion as its plain one with a sparkle.
- Add an upgrade: an `UpgradeId` and `UPGRADES` entry, add it to `DOCTOR_UPGRADES` or
  `GUILD_UPGRADES` (the guild also needs a spot in `GUILD` in layout), an icon in `UPGRADE_ICONS`
  and `ICONS` in `src/art/markers.ts` (and in `upgradeIcon` if it isn't its id), give it a row in
  `UNLOCKED_BY` unless it is for sale from the start, and apply its level in a helper in
  `src/game/state.ts` used by the sim or scene (the herbalist: `blightImmune`).
- Add a plague stage: a row in `PLAGUE_STAGES` (potion or null for any, need); the card (titled by
  the `plagueStage`/`seasonPlagueStage` texts) and the counting follow. The Panacea's recipe is `PANACEA_RECIPE` in `src/game/items.ts`; it is not
  in `RECIPES` or the Recipes panel, whose `lines` the test checks.
- Move a station, marker or wall: edit `src/scenes/layout.ts` (a station's pallets and the belt
  ends at them move with it, and `BELT_MS` stays about 100 pixels a second), bump `LAYOUT` in
  `src/game/state.ts`, update the test's coordinates, and refresh
  `docs/screenshots/playthrough-*.webp`. If belt paths change where goods ride, add a migration in
  `loadState` keyed on the saved `layout`, like `ontoOwnRuns`.
- Change the save shape incompatibly: bump `version` in `GameState` and `createInitialState`;
  otherwise make `loadState` fill the new field from `fresh`.

## Gotchas

- `loadState` only merges `upgrades`, `craftsmen`, `belts` and `priority` per key. A new field nested in
  `expansion`, `counter` or a station is missing from old saves unless handled there.
- Marker zones must not overlap: `standOnMarkers` takes the first shown one in creation order.
  Test walks must also avoid stopping on purple markers; the test asserts nothing was bought.
- Pallet positions in `PALLETS` are matched by index to `PLANTS`, `REFINED` and `POTIONS`; a new
  kind without a position gets no pallet.
- `layout.ts` mirrors line two with `mirror`; moving a line-one spot moves its twin. It must stay
  free of Phaser, since the sim and save import it.
- Pallet columns mirror left to right only (`mirrorPallets`), so both lines stack wheat, mandrake,
  nightshade from the top. Heading west a belt's first lane would be on its south side, so
  `createBelts` negates `laneOffset` for `LINE2_BELTS` to keep every kind at the end of its lane.
- `atCounter` lives only in the scene; `tick` called without it serves every customer at once.
- Garden belt build spots sit outside a maxed sickle's reach on purpose, so hands a new belt empties
  do not refill from the patch.
- Anything at `UI_DEPTH` or above is drawn by the unzoomed `uiCamera` at screen positions, so world
  objects must stay below it (`WORLD_UI_DEPTH` is the highest).
- `tick` runs before `movePlayer`, so `workingAt` uses last frame's feet position.
- Healing Draught art is red; keep any cross shapes off red (root rule on red crosses).
- `replantGarden` must change plots in place: `createPlots` keeps each plot object in a closure.
- New randomness in `tick` must stay behind a condition that is false on day 1 (like the blight's),
  or the playthrough's seeded orders change.
- The town's randomness (`tickTown`'s customers) runs only for a shop bought, which needs the
  cure, so the playthrough never reaches it. A new shop is a `SHOPS` entry (at most three gardens,
  which is what the yard has room for, the third opened by its `research`) with its goods in `GoodId`, `GOODS` and art in
  `src/art/town.ts` (a `good-<id>` icon, a station texture per station, `bedTexture` for a new
  garden good, and a lot house in `bakeTown`), its texts, and its goods in a `HOME_TIERS` need list;
  the scenes lay it out from its def.
- `state.ts` imports `town.ts`, so `town.ts` can only import types from `state.ts`: a shop rule that
  reuses an apothecary number (tips, reputation, regulars, weather, market day, blight, overstock,
  bundles) reads it in `townSim.ts`. New `ShopState` fields come from `createShop` through
  `normalizeTown`'s spread, so older saves get them.
- `rival.open` starts true and `rival.day` 0, so the rival exists in every save; it only does
  anything from `RIVAL_DAY`. `rival.potion` is null until then and once closed.
- Fine potions are not in `POTIONS`, so they have no pallets, shelves, belt lanes or orders of their
  own. Anything that counts potions on the shelf or in hands goes through `plainOf` (`hasRoom`,
  `startBrew`, `canFill`, stock cuts, the shelves).
- Belt lanes each run at half the belt's speed (`LANE_SHARE` in `runBelt`), however many there are.
- Lay out the top bar, panels and anything else on screen with `viewSize(this)` (and `viewFrame(this)` for
  designed-size spots), never `GAME_WIDTH` or `this.scale.width`: the view can be wider or taller than 960x540, and with
  `renderScale` above 1 `scale.width` is the canvas size, so the button lands off screen. `pointer.x/y` are canvas pixels too; go through `getWorldPoint`.
- Textures are painted at `res` times their logical size, `res` raised by `sharpRes` on big screens (the `RES` map in `paint.ts`, per key), so
  show them with `fit(image, scale)` rather than `setScale`, and give arcade bodies on them
  (`setSize`/`setOffset`, in texture pixels) sizes multiplied by `resOf(key)`.
- `cardTexture` keys cards by kind and size; a card of a new size paints a new texture, so build
  cards once rather than every frame. The away chip widens to the left to fit its text.
