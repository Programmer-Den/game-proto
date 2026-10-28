# Beehive Baron: guide for agents

How Beehive Baron is built and where things stand, for agents about to change it. `README.md`
covers how to play and lists the prices. Keep this file up to date with any change to the game, as
the root `AGENTS.md` asks.

## Current state

Beehive Baron is an idle beehive drawn in cut paper. The player builds comb cells on a 5x4 hex
grid, sends foragers to the meadow for nectar, full cells ripen into capped honey, a tap harvests a
capped cell into a jar (and a piece of wax), and jars sell for coins. Each open meadow gives its
own kind of honey, a market shifts which kind sells best, village orders pay a premium, wasps raid
capped cells, and brood cells hatch the bees. Coins and wax buy cells; coins buy four upgrades.
The year turns through four seasons (the bees eat honey in winter), casks age jars into mead, a
farmer borrows bees for the orchard, a crowded hive swarms into a second hive under a queen the
player picks, meadows foraged without a break wilt, and the county honey fair, held every late
summer, is the ending and then a ladder of harder fairs.

Implemented today:

- The full loop: build a cell (the first is free), send every bee at home on a trip, nectar
  delivered into filling cells in slot order (what does not fit is lost and counted as
  `spilled`), a full cell ripening for `ripenTime` and then capped, harvest, sell all jars at
  their kind's `jarPrice`.
- Honey kinds (`src/game/honey.ts`): clover (open from the start, the flowers by the hive),
  lavender (Lavender Field, meadow 1) and heather (Heather Moor, meadow 3), each with its own jar
  price (15, 18, 22). `state.forage` is where the foragers go; a bee takes that kind when sent
  (`Bee.kind`) and delivers into empty cells or cells of its kind, which take the kind
  (`HoneyCell.kind`, null while empty). Jars are kept per kind (`jars: Record<Kind, number>`).
  Lavender and heather foragers fly to a spot on their meadow strip (`forageSpot`).
- Market: the board under the hive (`MARKET`, shown once `sold > 0`, in the hint's place) lists
  each kind's jar price now; tapping an open kind calls `forage`. With two or more kinds open,
  `demand` picks one in turn every `MARKET_MS` (60s of game time, `marketMs`, not saved) whose
  base price is multiplied by `DEMAND` (1.5); a `demand` event floats a message when it moves
  (`tick` samples it before the year turns, so a meadow shutting or opening with the season is announced too, and `sell` compares it
  before and after a meadow it unlocks).
- Village orders (`src/game/orders.ts`): from `ORDERS_FROM` (3) jars sold, an order for 3 to 5
  jars of an open kind comes `ORDER_GAP_MS` (20s) after the last one ended and lapses after
  `ORDER_MS` (2 min), or sooner when its meadow shuts (`openLeft`; a kind is only ordered while its
  meadow stays open at least `ORDER_MIN_MS`, 60s, so no lavender order comes late in summer). `sell` counts that kind's jars toward it and pays `premium` (8 a jar) once it
  is complete. The order card sits in the shop's seventh spot (`ORDER`). Not saved.
- Wasp raids (`src/game/wasps.ts`): from `WASPS_FROM` (8) jars sold, while a cell is capped and no
  wasp is raiding, `waspIn` counts down (40s, then 40 to 80s at random) and a wasp flies in to a
  random capped cell (`WASP_IN_MS`), sits on it for `WASP_STEAL_MS` (an orange bar over the cell)
  and then empties it, then flies off (`WASP_OUT_MS`). A tap within `SWAT_RADIUS` of it calls
  `swat`; a harvest of its cell sends it off empty-handed; Guard Bees (`ranks.guards`) drive it off
  as it lands. Not saved.
- Brood cells: `BroodCell` (`type: 'brood'`, `hatchMs`) holds no nectar, hatches a bee every
  `BROOD_MS` (45s) while there are fewer than `maxBees` (`MAX_BEES` per hive) and it is not winter, and counts for the comb bonus. The Brood
  cell shop button arms `placing` in the scene; the next tap on an empty spot calls `buildBrood`
  (price `broodPrice`: `cellPrice` plus `BROOD_EXTRA`, 30). Bees are no longer bought.
- Wax: `harvest` adds one to `wax`; `withWax` lets wax pay `WAX_COINS` (3) each for up to half of
  a cell's price, and `build`/`buildBrood` spend it. The HUD shows it; cell labels and the Brood
  cell button show the coins left to pay; the build preview names the wax used.
- Comb bonus: every edge two built cells share adds 1 coin to each jar sold (`combBonus`). Shared
  edges glow gold, the roof plaque shows "Comb bonus +Nc a jar", a "+N touching" tag pops over a
  cell built next to others, and pointing at an empty spot shows a green build preview with its
  price, "+N touching" and the would-be edges lit green. A tap on an empty spot still builds at
  once (touch screens have no hover).
- Goals unlock meadows: `MEADOWS` in `src/game/meadows.ts` is a chain of three goals of jars sold
  (10, 30, 80) unlocking Lavender Field (+1 nectar a trip), Sunflower Ridge (+5 coins a jar) and
  Heather Moor (ripening twice as fast). A goal card shows the next goal, its meadow and benefit,
  and a progress bar; the next locked meadow shows faded on the far hill with a padlock tag, and
  open meadows show in full colour with blooms.
- Capped offline nectar: on load, `gatherAway` adds one drop per bee not lent to the orchard per
  `AWAY_MS_PER_DROP` (30s) since the saved `seen` time, capped at `AWAY_CAP` (20) and at the comb's room, into the filling
  cells. A chip under the hive says "While you were away: +N nectar" with "cap 20" and a bar; it
  fades after 12s of game time or when tapped.
- Purchases: comb cells (price rises per cell built), brood cells, Guard Bees, Pollen Baskets
  (more nectar a trip), Clover Patch (shorter trips) and Waggle Dance (the idle upgrade: `dance` sends bees at
  home out on their own, only as many as the comb has room for beyond what the foragers out already
  carry, and while an orchard offer stands it leaves that many bees at home to take it).
- Seasons (`src/game/seasons.ts`): `seasonMs` runs through the year (`YEAR_MS`, four seasons of
  `SEASON_MS`, 2 min each); `season(s)` names the one now and `seasonLeft` its time left. Summer
  adds `SUMMER_NECTAR` to `carry`; in autumn `isOpen` shuts lavender (the market, orders and
  `openKinds` follow, and `tick` sends foragers of a shut kind back to clover); in winter
  (`isWinter`) `send` refuses, the Waggle Dance does nothing, `gatherAway` adds nothing, no
  contracts come, brood rests, and every `WINTER_EAT_MS` (20s, `eatIn`) the bees have one meal per
  `BEES_PER_MEAL` (4) bees, at least one: each `eat` takes a jar (`EAT_ORDER`, cheapest first),
  else empties a capped cell, else removes a bee (never the last; bees at home first, lent bees last, and `recountLent` lowers
  the contract's `bees` to match).
  `years` counts the years come through; a `year` event marks each. The HUD stats show "Year N ·
  Season m:ss"; `SEASON_TINT` in `src/art/palette.ts` tints the scenery (a rectangle over it at
  depth 0.5). A new hive starts at `seasonMs` 0.
- Mead casks (`src/game/mead.ts`): the Mead cask shop button calls `cask`, which takes
  `CASK_JARS` (3) jars of `caskKind` (the kind with the most jars, the dearest on a tie) into a
  `Cask` (`kind`, `agingMs` from `CASK_MS`, 90s, `value`) in `casks`, up to `MAX_CASKS` (3). The
  value is fixed when the jars go in: `MEAD_MULT[kind]` (1.5, 1.6, 1.8) times what they would sell
  for then (`meadValue`). `tick` ages casks (a `mead` event when one is ready); `sell` sells the
  ready ones (`meadReady`, `cellarValue`) and counts `CASK_JARS` jars sold each. The casks stand on
  the right end of the shelf (`CASK`, `caskSpot`; `SHELF.jars` is now 7) with an arc while aging
  and a glow when ready. Saved.
- Tired meadows (`src/game/tired.ts`): while `openKinds` has two or more kinds, `tire` (in `tick`)
  grows `tired[kind]` by `dt` while any bee is out on that kind and shrinks it `REST_RATE` (2)
  times as fast while none is; at `TIRE_MS` (60s) the kind is `wilted` until the season turns
  (`turn` resets both) and pushes `wilted`. `beeCarry` halves (rounding up) what a bee of a wilted
  kind brings. The market draws a strip under each open kind's price for its strain and adds
  "wilted". Saved.
- Swarming (`src/game/swarm.ts`): `crowded` is one hive, every spot built and `maxBees` bees.
  While it holds, `swarmIn` counts down from `SWARM_MS` (45s; a `swarm-ready` event when it
  starts) and the swarm chip (`SWARM`, over the meadow's foot just above the button board, clear of the
  market) shows it; at 0 half the bees leave
  (`swarmed`, bees at home first; lent bees stay first, and `recountLent` keeps the contract's
  `bees` right) and it restarts. A tap on the chip calls `catchSwarm`
  (`CATCH_PRICE`, 180 coins): `hives` becomes 2 (`MAX_HIVES`), `cells` grows by `SLOTS` nulls, and
  `maxBees` is `MAX_BEES` per hive. The chip opens the queen card (`createQueenCard`, the
  `queen-card` texture), whose three buttons call `catchSwarm(state, queen)`: `queen` (`Queen`,
  `QUEENS`) is set and half the bees (at home first) get `Bee.hive` 1, as do bees hatched from the
  second comb's brood. Gentle: `raid` never targets the second comb. Hardy: in winter her bees
  have one meal per `2 * BEES_PER_MEAL`. Busy: `beeCarry` adds `BUSY_NECTAR` (1) for her bees. The
  plaque names her while her comb is shown. Spots `SLOTS` to `2 * SLOTS - 1` are the second comb:
  `hiveOf`, `localSlot` and `hiveSlots` split them, `neighbours` never crosses combs, `cellPrice`
  and `broodPrice` take a hive (each comb's first cell is free), and `combBonus` adds both combs.
  The scene shows one comb at a time (`hive`), switched by the roof tabs (`hiveTab`, `HIVE_TAB`,
  shown once `hives > 1`); taps map `cellAt`'s local spot to `hive * SLOTS + local`, the gold edges
  and wasp bars are drawn for the comb shown, a wasp's `wasp` event brings its comb to the front,
  and wasps on the other comb are hidden. `hives`, `queen` and `queenBees` (her bees' count) are
  saved; `swarmIn` is not.
- Orchard contracts (`src/game/contracts.ts`): from `CONTRACTS_FROM` (5) jars sold, outside winter
  and with more than `CONTRACT_BEES.min` bees, an offer comes `CONTRACT_GAP_MS` (50s) after the last
  contract ended: `Contract` (`bees` 2 to 6, never all the bees, `pay` `CONTRACT_COINS_PER_BEE` (25)
  each, `phase` `offer`, `leftMs` `OFFER_MS` 40s). A tap on the contract card (`CONTRACT`, the
  shop's eighth spot) calls `acceptContract`: with that many bees `atHome` it marks them `lent`
  (`Bee.lent`), pays up front, and `phase` becomes `lent` for `CONTRACT_MS` (90s); then they are
  home again (`returned`). Lent bees are home but never sent, and the scene hides their sprites;
  the HUD counts them. An offer not taken lapses (`contract-lapsed`). A contract whose bees are
  away is saved (`Progress.lent`: bees and time left) and `newHive` marks that many bees lent
  again, so a reload can't bring paid-for bees home early; offers are not saved.
- The county fair (`src/game/fair.ts`): once `fairOpen` (every meadow open) the goal card is the
  fair's. It is on (`fairOn`) for the last `FAIR_MS` (60s) of every summer; `fairIn` counts down to
  it, and `turn` pushes `fair-open` as it opens (or `sell`, when the jar that opens the last meadow
  is sold during the fair's minute) and calls `closeFair` as autumn comes (a
  `fair-closed` event, `fairs` + 1, entries cleared). The classes are `classesFor(fairs)`: the
  three kinds, plus `mead` from the second fair and `fresh` from the third; gold needs
  `fairGold(fairs)` (`FAIR_GOLD` 14, plus `FAIR_STEP` 3 a fair, at most `FAIR_MAX` 28). While it is
  on a tap on the card toggles `entering`; the next tap on a capped cell calls `enterFair`, which
  scores `fairScore(slot)` (neighbours capped with honey of the same kind, up to 6), takes the honey
  (wax, no jar) and keeps the best score for its kind's class and, if `HoneyCell.since` is this
  `seasonNo`, the fresh class too; a tap on a ready cask calls `enterMead` (`MEAD_POINTS` by kind).
  With every class entered `enter` judges: `fairGold` or more (`fairWon`) adds to `golds` and
  pushes `gold`, and the first gold sets `baron` and pushes `baron`, which shows the end card
  (`END_CARD`, a tap on it or its shade keeps playing); less pushes `judged`. A won fair takes no more entries. While
  `entering`, capped cells and ready casks show their points. `fair` (`FairEntries`, per
  `FairClass`), `fairs`, `golds` and `baron` are saved; entries are cleared on load outside the fair.
- One screen (`GameScene`) with a scalloped HUD strip, the goal card, a hint line for the first
  jar, bees flying to and from the flowers with dotted trails, a shelf of jars, and a "New hive"
  reset link in the bottom right corner.
- Persistence of the comb (honey cells with their kind, brood cells with their hatch time), coins,
  jars per kind, wax, jars sold, bee count, upgrade ranks, unlocked meadows, the kind foraged, the
  season and years, the casks, the hives and queen, the fair entries, fairs and golds, the tired
  and wilted meadows and the last-seen time in
  `localStorage`.
- Trophies (`src/trophies/`, `shared/trophies.ts`): ten, listed on the start and pause screens
  and on the hub (see the file map). The first round earns First jar.

Missing or rough:

- No title or win screen and no in-game settings (they are on the hub page). No ambience (hive hum,
  birdsong) yet.
- Bees out foraging are home again on load with their nectar lost (the away nectar stands in).
- The build preview needs a pointer that hovers; on a phone a tap builds without one.
- "New hive" resets at once with no confirmation.
- `spilled` is not saved and only shows as floating text.
- Brood cells do not hatch while the page is closed, casks do not age, the bees do not eat, lent
  bees' contract time does not run, and the market timer, wasps, orders, contract offers and a
  gathering swarm start afresh on load.
- Lent bees are drawn nowhere (the orchard is off screen); the contract card and HUD count them.
- A wasp raiding the comb not shown is hidden until its `wasp` event brings that comb to the
  front; a tab switch while it sits there hides it again (it still steals).
- The swarm keeps counting down while the queen card is open; if it leaves first, the card closes.
- `room` only counts the kind being foraged, so a comb of half-filled clover cells can show "No
  room for lavender nectar" until a cell is empty.

## Architecture

File map (`src/`):

- `howToPlay.ts`: the How to play screen's text (goal, controls, core loop and tips) in British
  English (which US English shares) and German, picked with `byLanguage` and handed to
  `setupGame(game, { howToPlay })` in `main.ts`; update every language when the controls or the
  first round change.
- `i18n.ts` and `i18n/`: the game's texts (`shared/i18n.ts`). `i18n/en.ts` is the British English
  source, `i18n/de.ts` the German (with `keepEnglish` for the game's name, Winter and the texts
  made only of other texts) and `i18n/en-US.ts` the US spellings, none so far. `t(key, vars)`
  shows a text in the hub's language; `TextKey` types the keys. Every text on screen goes through
  `t`; each honey kind has its name (`clover`), `<kind>Honey`, `<kind>Nectar`, `<kind>Jars` and
  `<kind>Meadow` keys, the seasons and fair classes are keyed by their id, and the tables in
  `game/` hold keys, not text. Prices show as `price` ("15c", "15 T" for Taler in German).
- `audio.ts`: the sound table (`sfx`, `SoundName`) and the song (`SONG`); see "Sound" below.
- `main.ts`: creates the `Phaser.Game` (960x540, `Scale.FIT`, `pixelArt: false` since the art is
  smooth) with `BootScene` and `GameScene`, calls `setupGame(game)` and `setupScaling(game, { fill: true })`, and
  exposes `game` on window in dev builds.
- `game/state.ts`: types (`GameState`, `Cell` = `HoneyCell | BroodCell`, `Bee`, `GameEvent`,
  `Progress`), the grid and balance constants, `hiveOf`, `localSlot`, `hiveSlots`, `freshProgress`,
  `emptyCell`, `newHive` (which also checks saved cells and moves old ones to clover), `progressOf`
  (stamps `seen` with `Date.now()`), and the formulas `isHoney`, `isBrood`, `isOpen`, `openKinds`,
  `demand`, `marketLeft`, `season`, `seasonLeft`, `isWinter`, `maxBees`, `atHome`, `crowded`,
  `meadValue`, `meadReady`, `cellarValue`, `caskDone`, `fairTotal`, `fairOpen`, `fairOn`, `fairIn`,
  `fairWon`, `seasonNo`, `openLeft`, `carry`, `beeCarry`,
  `ripenTime`, `cellPrice` and `broodPrice` (per hive), `withWax`, `room` (per kind), `jarCount`,
  `neighbours`, `touching`, `fairScore`, `sharedEdges`, `combBonus`, `jarPrice` (per kind) and `shelfValue`
  (jars and ready mead).
- `game/sim.ts`: the rules as pure functions on `GameState`: `tick`, `build`, `buildBrood`,
  `canPay`, `send`, `forage`, `harvest`, `sell` (which also sells ready mead, fills the order and
  unlocks meadows), `buy`, `swat`, `gatherAway`, `tripMs` (trip length with clover and
  difficulty), `caskKind`, `cask`, `catchSwarm`, `acceptContract`, `enterFair`, `enterMead`, plus
  the private `turn`, `tire`, `eat`, `deliver`, `place`, `hatch`, `raid`, `orders`, `contracts`,
  `swarm`, `dance`, `fly`, `recountLent`, `enter` and `closeFair`.
- `game/honey.ts`: the `HONEY` table (name key, meadows needed, price), `KINDS`, `MARKET_MS`,
  `DEMAND`, `noJars`. `game/wasps.ts`: the `Wasp` type and raid timings. `game/orders.ts`: the
  `Order` type and order numbers. `game/seasons.ts`: `Season`, `SEASONS`, the
  season and eating timings. `game/mead.ts`: `Cask` and the cask numbers. `game/swarm.ts`: the
  swarm timing, catch price, `MAX_HIVES` and the queens (`Queen`, `QUEENS` with name and blurb keys, `QUEEN_IDS`,
  `BUSY_NECTAR`). `game/contracts.ts`: `Contract` and the contract numbers. `game/fair.ts`:
  `FairClass`, `FAIR_CLASSES`, `classesFor`, `FairEntries`, `noEntries`, `FAIR_GOLD`,
  `FAIR_STEP`, `FAIR_MAX`, `fairGold`, `FAIR_MS`, `MEAD_POINTS`. `game/tired.ts`: `TIRE_MS`,
  `REST_RATE`, `rested`, `unwilted`.
- `game/meadows.ts`: the `MEADOWS` goal chain (name key, jars sold needed, benefit key) and
  `SUNFLOWER_COINS`.
- `game/upgrades.ts`: the `UPGRADES` table (name and blurb keys, price per rank), `UPGRADE_IDS`,
  `nextPrice`.
- `game/save.ts`: `loadProgress` (checks every number, clamps ranks and meadows), `saveProgress`,
  `clearProgress`.
- `trophies/`: the game's ten trophies (`shared/trophies.ts`). `index.ts` lists them (`trophies`:
  id, tier, icon, `hidden` for Blue-ribbon keeper) with their texts in `trophies/i18n/` (`en.ts` and
  `de.ts`: the name keyed by the id, what earns it by `<id>Text`), and imports nothing else from the
  game, since the hub loads it for its trophy shelf. `main.ts` hands `trophies` to `setupGame`.
  `check.ts` holds each trophy's condition (`EARNED`: first jar sold, the Lavender Field open, a
  `swatted` event, a contract's bees lent, a ready cask, a second hive, every meadow open, 100 jars
  sold, `baron`, and `THREE_GOLDS` fair golds) and `checkTrophies(state)`, which `GameScene.update`
  calls every frame right after `tick` and before `drawEvents` empties the events (a swat pushes
  its event between frames). The first call after the page loads is quiet, so a loaded save and the
  away nectar earn theirs without a toast. A new trophy is an entry in `index.ts`, its two texts in
  each language file and its condition in `EARNED`.
- `scenes/BootScene.ts`: bakes all textures, then starts `Game`.
- `scenes/GameScene.ts`: draws the hive (the comb shown, with the roof tabs), the wasps, the
  season tint, the casks, the market (with the meadows' strain), the order and contract cards, the
  swarm chip and queen card, the fair on the goal card and the end card, turns taps and hovers into sim calls and the build preview,
  animates events, saves, shows the away chip, and offers `spots()` for the test.
- `scenes/layout.ts`: every screen position (`VIEW`, `viewEdges` (the whole view in layout
  coordinates), `COMB`, `HIVE`, `PLAQUE`, `HIVE_TAB` and
  `hiveTab`, `ENTRANCE`, `FLOWER_GROUND`, `FAR_RIDGE` and `farY`, `GOAL`, `MEADOW_SPOTS`,
  `MEADOW_TAG`, `AWAY`, `SWARM`, `HINT`, `MARKET` and `marketEntry`, `SHELF`, `CASK` and
  `caskSpot`, `BOARD`, `SEND_BUTTON`, `SELL_BUTTON`, `SHOP_BUTTONS` and `shopSpot`, `ORDER`,
  `CONTRACT`, `END_CARD`, `WASP_FROM`, `WASP_TO`), the hex helpers `cellCentre` (which takes a
  spot of either comb), `hexPoints` and `cellAt` (a local spot), `homeSpot`, `flowerSpot`,
  `forageSpot`, and `FONT` (a system font stack).
- `ui/Button.ts`: a paper card button (cream, golden "hot" for Send and Sell, flat when disabled)
  with a bold first line and a lighter second line; it bakes its card textures on first use. A tap
  on a disabled button plays the shared refusal buzz.
- `art/paper.ts`: the cut-paper toolkit: `cut` (a card shape with a hand-cut wobble, drop shadow,
  multiplied grain and a light rim), shape helpers (`rect`, `rr`, `circ`, `hex`, `smooth`),
  `outline`, `sketch`, `addTexture` and the `seeded` RNG. `sketch(w, h)` makes a canvas `sharpRes`
  times bigger with its context scaled, so art is painted in game pixels; `addTexture` sets the
  texture's `resolution` and trims its frame to the game-pixel size, so images show at that size.
- `art/palette.ts`: card colours (`CARD`, `PETALS`, `MEADOW_CARD`, `KIND_CARD` per honey kind,
  `WASP_CARD`, `NOTE_CARD`, `ORCHARD_CARD`, `MEAD_CARD`, `BROOD_CARD`, `WAX_CARD`), the season
  tints (`SEASON_TINT`) and the numbers the scene draws with each frame (`LIVE`).
- `art/scenery.ts`: `bakeScenery` and the texture layouts it exports (`FLOWER_TEX`, `JAR_TEX`,
  `CELL_TEX`, `CARD_PAD`, `meadowOrigin`). `art/bees.ts`: the bee and the wasp in two wing frames
  each (`BEE_TEX`, `WASP_TEX`).

Shared code the game imports (repo root, outside `src/`): `shared/audio.ts` (`sounds`, `ui`,
`playMusic`, `playSting`), `shared/setupGame.ts` (`setupGame`),
`shared/settings.ts` (`settings`, `byDifficulty`), `shared/scaling.ts` (`setupScaling`,
`sharpRes`) and `shared/i18n.ts` (`translator`, `byLanguage`, `Translation`). See "Hub settings" and "Screens" below.

How it runs:

- Boot: `BootScene.create` calls `bakeScenery`, `bakeBees` and `bakeWasps`, which paint 2D
  canvases and add them with `textures.addCanvas`. Keys: `bg-back` (sky, sun, clouds, far hill),
  `meadow-<i>` and `meadow-<i>-blooms`, `bg-front` (near hills, the button board and the jar
  shelf), `hive`, `flower-<0..5>`, `jar-<kind>`, `cell-empty`, `cell-fill-<0..4>-<kind>`,
  `cell-ripe-<kind>`, `cell-capped-<kind>`, `cell-brood`, `cell-preview`, `hud`, `coin`,
  `honey-icon-<kind>`, `wax-icon`, `goal-card`, `meadow-icon-<i>`, `lock`, `meadow-tag`,
  `away-chip`, `swarm-chip`, `market-card`, `order-card`, `contract-card`, `cask`,
  `hive-tab-on/off`, `end-card`, `queen-card`, `tag-build`, `tag-touching`, `bee-0/1`, `wasp-0/1`, and the
  buttons' `button-<w>x<h>-<look>`. There are no asset files.
- Load: `create` loads the progress, builds the state, calls `gatherAway(state, Date.now() -
  seen)` when a `seen` time was saved, shows the chip if any nectar came in, and saves at once so a
  reload does not count the same time twice.
- Tick: `GameScene.update(time)` takes `dt` from the frame timestamp (clamped to `MAX_STEP_MS`,
  250ms), adds it to `clock`, and calls `tick(state, dt)`, which turns the year, moves the bees on
  (delivering nectar when a trip ends), ripens full cells, hatches brood, ages casks, moves the
  market on, runs wasp raids, village orders, orchard contracts and the swarm, opens and closes the
  fair, tires and rests the meadows, feeds the bees in winter, and with the Waggle Dance calls
  `dance`. The scene saves if that pushed a `nectar`, `capped`, `hatched`, `stolen`, `season`,
  `ate`, `mead`, `swarmed`, `returned`, `wilted` or `fair-closed` event, and at
  least every `SAVE_EVERY_MS` (5s) so `seen` stays fresh; it also saves on `pagehide` and when
  the tab is hidden. Then it draws.
- Input: the scene's `pointerdown` calls `tapComb`, which does nothing when the tap is on an
  interactive object (a card or button, so a tap on the queen card never reaches the comb under
  it), else swats a wasp near the pointer
  (`waspAt`, filled when the wasps are drawn), else builds on an empty spot of the comb shown (a
  brood cell while `placing`) or harvests a capped cell under the pointer (`cellAt`; enters it in
  the fair while `entering`). `pointermove` sets `hover`, which drives the build preview;
  `gameout` clears it. The Send, Sell and upgrade buttons call `send`, `sell` and `buy`; the Brood
  cell button toggles `placing` (dropped when the comb shown has no free spot or it can't be
  paid); the Mead cask button calls `cask`; a market entry calls `forage`; the contract card calls
  `acceptContract`; the swarm chip opens the queen card, whose buttons call `catchSwarm` (a tap on
  its shade closes it); a ready cask calls `enterMead` while `entering`; the goal card toggles
  `entering` while the fair is on; the roof tabs set `hive`; the end card hides itself (its shade takes the taps around it too). Each successful action
  saves.
- Rendering: one image per comb spot takes its state's cell texture each frame; the `comb`
  graphics draws the gold shared edges, the green preview edges, the ripening arcs and the capped
  cells' pulsing rim. Bee sprites (`bees`, keyed by bee id) are placed every frame by `tripSpot`,
  from how far along its trip a bee is (`OUT` of the trip flying out, `AT_FLOWER` at the flower,
  the rest flying home), with a dotted trail in `trails`, or at `homeSpot(index)` when home. Jar
  sprites are a fixed pool of `SHELF.jars`, given each kind's jar texture in `KINDS` order. Wasp
  sprites (`wasps`) are placed by `waspSpot` from their phase. `drawMarket` and `drawOrder` update
  the market board and the order card. `drawGoal` updates the goal card and the meadows'
  visibility. Sim functions push `GameEvent`s onto `state.events`; `drawEvents` drains them for
  flashes, the "+N touching" pop, the unlock message and floating text.

State model (`src/game/state.ts`):

- `GameState.cells` is `SLOTS` (20) entries per hive (`hives` times), each `null` (no cell
  built), a `HoneyCell` (`type: 'honey'`, `nectar` 0 to `CELL_CAP`, `phase`
  `filling`/`ripening`/`capped`, `ripenMs`, `kind`, and `since` once its first drop is in) or a `BroodCell` (`type: 'brood'`,
  `hatchMs`). A honey cell leaves `filling` only when full. Harvesting (or a wasp's theft, the
  bees eating it in winter, or a fair entry) resets it to `emptyCell()`.
- Neighbours: odd rows sit half a cell right, so spot `(col,row)` touches `col±1` on its row and,
  on the rows above and below, `col-1,col` (even rows) or `col,col+1` (odd rows). `sharedEdges`
  lists each touching pair of built cells once; `combBonus` is their count.
- `meadows` counts the unlocked entries of `MEADOWS`, in order. `sell` unlocks every meadow whose
  `need` the new `sold` reaches and pushes an `unlocked` event for each.
- `bees` holds one `Bee` per bee owned: `tripMs` (0 while home), `trip` (the whole trip's length),
  `flower`, `kind`, `lent` and `hive`. Only the count, the second hive's count (`queenBees`) and the
  lent contract are saved; `newHive` rebuilds them all at home with the last `queenBees` in hive 1,
  then marks the saved contract's bees lent.
- `room` is the nectar of the foraged kind the filling cells can still take; `send` refuses when it
  is 0 or no bee is home, and `gatherAway` never adds more than it.
- `wasps`, `waspIn`, `order`, `orderIn`, `contractIn`, `swarmIn` and `marketMs` live
  only in the running state, and `contract` too while it is an offer.
- Only `src/game/sim.ts` changes rules state; the scene replaces `state` wholesale only on load and
  on "New hive".

Persistence: one key of its own, `beehive-baron-progress`, holding `Progress` as JSON (`coins`,
`cells`, `bees`, `jars` per kind, `wax`, `sold`, `ranks`, `meadows`, `forage`, `seasonMs`,
`eatIn` (the time to the bees' next winter meal, clamped to 1 to `WINTER_EAT_MS`, so a reload
can't put a meal off), `years`, `casks`, `hives`, `queen`, `queenBees`, `fair`, `fairs`, `golds`, `baron`, `tired`, `wilted`,
`lent`, `seen`). Saves from before the yearly fair load with `fairs` and `golds` 1 for a Baron. `seen` is the `Date.now()` of the last save, 0
for a hive never saved (no away nectar then). Bee trips, `spilled`, wasps, orders, contract offers, the
swarm, the market's clock and events are not saved. Saves from before the honey kinds load with
`jars` as a number (taken as clover), cells without `type`/`kind` (honey cells of clover) and no
`wax`/`forage`; saves from before the seasons have none of the new fields and start in spring with
one hive; `loadProgress` and `cellOf` take care of that. The trophies earned are a second key,
`beehive-baron-trophies` (`shared/trophies.ts`, each id with the time), which "New hive" keeps.

Randomness and timing:

- `Math.random` is used in `src/game/sim.ts`: in `send`, once per bee sent, to pick its flower
  (it only changes where the bee flies), in `raid` for a new wasp's gap and target cell, in
  `orders` for a new order's kind and size, and in `contracts` for an offer's bees. Raids, orders
  and contracts only start after the first round (8, 3 and 5 jars sold), so the playthrough only
  draws for the bees. The seasons are deterministic, and spring (2 min) outlasts the playthrough.
- Art uses `seeded()` from `src/art/paper.ts`, not `Math.random`.
- Game time comes only from the `time` Phaser passes to `update`; tweens use Phaser's clock.
  `Date.now()` is read only to stamp `seen` and to measure the time away on load.

Data tables: balance constants (`CELL_CAP`, `RIPEN_MS`, `TRIP_MS`, `HONEY_PRICE` (clover's
price), `START_BEES`, `MAX_BEES`, `BROOD_MS`, `BROOD_EXTRA`, `WAX_COINS`, `FLOWERS`,
`AWAY_MS_PER_DROP`, `AWAY_CAP`) and the price formulas in `src/game/state.ts`; the honey kinds and
market in `src/game/honey.ts`; raid timings in `src/game/wasps.ts`; order numbers in
`src/game/orders.ts`; the goal chain in `src/game/meadows.ts`, with its benefits in `carry`
(Lavender), `jarPrice` (Sunflower) and `ripenTime` (Heather); upgrade prices and blurbs in
`src/game/upgrades.ts`, with their effects in `carry` (baskets), `tripMs` (clover) and `tick`
(dance), and `raid` (guards); the seasons in `src/game/seasons.ts`, the casks in
`src/game/mead.ts`, the swarm in `src/game/swarm.ts`, the contracts in `src/game/contracts.ts` and
the fair's gold in `src/game/fair.ts`.

### Sound

All sound is made in code by `shared/audio.ts`; `src/audio.ts` holds the game's table and song, and
only `GameScene` (and the refusal buzz in `ui/Button.ts`) plays them, so the sim has no audio.

- Song `SONG`: lilting folk-pop at 104 BPM in C major, a square lead, triangle bass and soft
  drums, eight bars a part. `playSeasonMusic` (each frame, on a change only) plays the season's
  part: `spring` (bright), `summer` (full, arpeggios), `autumn` (mellow, D Dorian), `winter` (sparse,
  A minor at half time), and `fair`, a jig, while the fair is on (`fairOn`). Stings: `unlock` (a
  meadow unlocked), `gold` (a gold after the first) and `baron` (the first gold, with the end card).
  "New hive" goes back to spring; there is no game over.
- Effects (`sfx`), all played from `GameScene.playEvents` on the drained `GameEvent`s unless noted:
  `build` (`built`, a step higher per touching edge), `send` (Send button), `nectar` (`nectar`, at
  most one per 100ms), `capped`, `harvest` (`harvested`), `sell` (`sold`), `orderDone`, `buy` (an
  upgrade bought, from the button), `sad` (`spilled`, `stolen`, `ate` a jar or cell,
  `order-failed`, `contract-lapsed`, `judged`), `starve` (`ate` a bee), `wasp` (`wasp`, and every
  `WASP_BUZZ_MS` while a wasp sits on the comb shown, `buzzWasps`), `swat` (`swatted`), `zap`
  (`guarded`), `hatched`, `demand` (once a jar is sold), `wilted`, `ding` (`order`, `contract`),
  `season`, `year`, `casked`, `mead`, `swarmReady` (`swarm-ready`), `swarmed`, `caught`, `returned`,
  `fairOpen` (`fair-open`) and `stamp` (`entered`). `fair-closed` has no sound of its own, since the
  autumn chime comes in the same step. `lent` plays the shared `ui('coin')`.
- Shared `ui('click')`: the Brood cell toggle, a market pick, the fair card, a hive tab, the swarm
  chip, closing the queen card or the end card, and "New hive". `ui('refuse')`: any action `act`
  is told failed (build, harvest of a cell not capped, sell or send with nothing to do, an upgrade
  or cask not affordable), a tap on a disabled button, a fair entry refused, and the swarm chip
  without the coins to catch it.
- Cell sounds (`nectar`, `capped`, `hatched`, `stolen`, `ate` a cell) play only for the comb
  shown. The events of loading (the away nectar from `gatherAway`) are drained silently
  (`hushed`). The Waggle Dance's own sends make no whoosh, only their nectar blips.

### Screens

- `setupScaling` draws the canvas at the screen's resolution (`renderScale` canvas pixels per game
  pixel, up to 4 on a 4K screen, 2 with the canvas renderer) and zooms the one camera to match.
- The game fills every screen shape (`setupScaling(game, { fill: true })`): the view is 960x540 at
  its smallest and grows wider (up to 1296x540) or taller (up to 960x720) to the screen's shape,
  picked once at start. Layout stays in the 960x540 coordinates of `layout.ts`: `GameScene.create`
  scrolls the camera once by `viewEdges(this)` so that rectangle sits in the middle of the view
  (`viewFrame`), and `this.edges` holds the whole view in those coordinates (`x`/`y` are negative
  when the view is bigger). Reaching out to the edges: `bg-back` and `bg-front` are baked at the
  view's size (the sky over all of it, the hills' ridges run on level past their ends via `widen`
  and down past the bottom), the season tint covers the view, the HUD strip is baked as wide as the
  view and pinned to its top (title and counts at the left edge, stats at the right), New hive sits
  in the bottom-right corner, and wasps fly in from and off past the view's right edge. The cards,
  shades and floats stay centred on `VIEW`, which is the view's centre. At 960x540 the edges are
  `VIEW` and nothing moves. `cut`'s paper grain reaches back to the canvas's corner when the
  context is shifted, so the bigger backgrounds are grained all over.
- Pointer handlers read `pointer.worldX/Y`, not `pointer.x/y`, which are canvas pixels.
- Textures are painted at `sharpRes` through `sketch`, so the cut-paper art is as sharp as text.
  Read a texture's size from its frame's `realWidth`/`realHeight` (game pixels), never from
  `getSourceImage()` (canvas pixels).
- Canvas shadows ignore the context's scale, so `cut` and any hand-set `shadowBlur` or
  `shadowOffset` multiply them by `resOfCtx(ctx)`.
- `e2e/screens.spec.ts` at the root opens the game on two phones, a tablet, a laptop and a 4K
  screen; on an upright phone the shared scaling turns the game to fill the screen.

### Hub settings

- `src/main.ts` calls `setupGame(game)` from `shared/setupGame.ts` right after creating the game.
  It applies the frame cap, the FPS readout, reduced motion and full screen (camera shake and flash become
  no-ops; this game uses neither).
- Difficulty scales one number: trip length (the seasons and the rest are the same on every
  difficulty). `tripMs` in `src/game/sim.ts` multiplies
  `TRIP_MS * 0.8^clover` by `byDifficulty(0.75, 1, 1.3)` (easy, normal, hard) from
  `shared/settings.ts`. `TRIP_MS` in `src/game/state.ts` is unchanged.
- Reduced motion: `GameScene` skips the white flash when a cell is built or capped and the blooms'
  fade-in on unlock, holds the pulsing rim on capped cells steady, keeps floating text and the
  "+N touching" tag from drifting (they only fade), and stops the bees' wing flap, bobbing and
  circling.
- Normal must stay exactly as designed, since the playthrough runs on Normal.
- Keep the README's difficulty line in sync ("foraging trips take 25% less time on Easy and 30%
  more on Hard"), and the game's row in the root README's difficulty table.
- The settings are read once at load from the `hub-settings` storage key, which the hub owns. They
  are not part of `beehive-baron-progress`, and "New hive" does not touch them.

## Testing hooks

- `src/main.ts` puts `game` (the `Phaser.Game`) on window in dev builds only.
- `e2e/playthrough.spec.ts` reads `game.scene.getScene('Game')`: its `state` (copied without
  `events`) and `spots()`, which returns the Send and Sell button centres, each cell's centre
  (`cellCentre`, of the comb shown), each shop button's centre by item (`brood`, `guards`,
  `baskets`, `clover`, `dance`, `cask`), each market entry's centre by kind, each flying wasp's
  position by id, the order and contract cards, the swarm chip, the goal card and the two hive
  tabs. Positions therefore follow `layout.ts`. The test uses only Send, Sell and the cells.
- Inputs: mouse clicks only, mapped from the 960x540 view to the canvas's size on the page (not
  its pixels, which are `renderScale` times more). The click on slot 7
  moves the mouse there first, so the build preview shows for a moment before the cell is built.
- The test mirrors these values; change them together: `VIEW` (960x540), `CELL_CAP` (4),
  `START_BEES` (2), `HONEY_PRICE` (15) and the spot it builds on (slot 7). It also expects: the
  first cell free; Send doing nothing with no cell; one trip of two bees bringing 2 drops; each
  trip and the ripening finishing within 10s; nothing spilled; `meadows` 0 and `forage` `clover`
  at the start; the new cell equal to `emptyCell()` and filling with `kind` `clover`; the harvest
  giving `jars.clover` 1 and `wax` 1; and `coins` (15: a lone clover cell has no comb bonus and no
  market demand), `jars`, `wax`, `sold` exact after the sale, with `meadows` still 0. It fails on
  any page error. After the sale `beehive-baron-trophies` holds exactly `firstJar`, so a trophy a
  first round can reach in another way changes that expectation. It plays well inside the first spring, so no season touches it; keep
  `SEASON_MS` well above the first round's length (about 15s of game time).
- The test starts with empty storage, so `seen` is 0 and no away nectar is added. It owns the
  clock (`page.clock`), so `Date.now()` is controlled too.
- It seeds `Math.random`, so adding random calls changes which flowers the bees visit but must not
  change the first round.

## Making common changes

- Add or change a text: its key in `i18n/en.ts`, the German in `i18n/de.ts` (the build fails
  without it) and, where US spelling differs, `i18n/en-US.ts`; run
  `node scripts/check-translations.mjs`. German runs longer than English: the Send button, the
  order and contract cards, the queen buttons' second line and the meadow tag are
  the tightest spots, so check a new text with `?lang=de`. A new honey kind needs its five keys
  (see `i18n.ts` above), a new upgrade, meadow or queen its name and blurb keys.
- Add an upgrade: add the id to `UpgradeId` and `UPGRADES` in `src/game/upgrades.ts`, its rank 0
  in `freshProgress` in `src/game/state.ts`, its effect where the rule lives, and it to `SHOP` in
  `GameScene.ts`. The shop is a 2x4 grid (`SHOP_BUTTONS`, `shopSpot` in `layout.ts`) with the
  order and contract cards in the last two spots, so it is full: a new button needs a card moved
  or smaller buttons.
- Retune the seasons: `SEASON_MS`, `SUMMER_NECTAR`, `WINTER_EAT_MS`, `BEES_PER_MEAL` and `EAT_ORDER` in
  `src/game/seasons.ts`; what each season does lives in `carry`, `isOpen` (`state.ts`) and `turn`,
  `eat`, `send`, `gatherAway`, `contracts` (`sim.ts`); the tints in `SEASON_TINT`. A season's
  message is its `<season>Came` text in `i18n/`. Update the README's season table.
- Retune mead: `CASK_MS`, `CASK_JARS`, `MAX_CASKS`, `MEAD_MULT` in `src/game/mead.ts`; more casks
  need `CASK`/`caskSpot` in `layout.ts` to fit the shelf (and fewer `SHELF.jars`).
- Retune the swarm: `SWARM_MS`, `CATCH_PRICE` in `src/game/swarm.ts` and `crowded` in `state.ts`.
  `MAX_HIVES` is 2 by design: the scene has two tabs, and `hiveTab` places them left of the
  plaque.
- Retune contracts: `src/game/contracts.ts`. Keep `CONTRACTS_FROM` above 1 like the raids and
  orders.
- Retune the fair: `FAIR_GOLD`, `FAIR_STEP`, `FAIR_MAX`, `FAIR_MS`, `MEAD_POINTS` and `classesFor` in
  `src/game/fair.ts`; the score is `fairScore` in `state.ts`. Update the README's fair table.
- Retune tired meadows: `TIRE_MS` and `REST_RATE` in `src/game/tired.ts`; the halving is in
  `beeCarry`. Keep it off while only one kind is open, so the first round never meets it.
- Add or retune a queen: `QUEENS` in `src/game/swarm.ts` and her rule (`raid`, `turn`, `beeCarry`);
  the queen card fits three buttons. Update the README's queen table.
- Add a honey kind: add it to `Kind` and `HONEY` in `src/game/honey.ts` (and `noJars`), a
  `KIND_CARD` entry in `src/art/palette.ts`, a meadow strip for it in `KIND_MEADOW` in
  `layout.ts`, and room for a fourth entry on the market (`MARKET.entry`).
- Retune raids, orders or the market: `src/game/wasps.ts`, `src/game/orders.ts` and `MARKET_MS`,
  `DEMAND` in `src/game/honey.ts`. Keep `WASPS_FROM` and `ORDERS_FROM` above 1 so the first round
  stays free of them.
- Add or retune a goal: edit `MEADOWS` in `src/game/meadows.ts` (keep the first goal above 1 jar
  so the playthrough's sale unlocks nothing), give its benefit a rule in `state.ts`, and add a
  `MEADOW_SPOTS` entry in `layout.ts` (a stretch of the far ridge and its tag spot) and a
  `MEADOW_CARD` entry in `src/art/palette.ts`; `bakeMeadow` and the goal icon in
  `src/art/scenery.ts` draw a bloom shape per index. Update the README's goal table.
- Retune the comb bonus: `combBonus` and `jarPrice` in `state.ts`. Keep a lone cell at 0 bonus or
  update the test's sale price.
- Retune away nectar: `AWAY_MS_PER_DROP` and `AWAY_CAP` in `state.ts` (the chip reads the cap).
- Retune balance: edit the constants above. Check the test still holds (two bees fill half a cell
  per trip, trips and ripening under 10s, first cell free).
- Change the comb: `GRID` in `state.ts` and `COMB` in `layout.ts`. The comb must stay inside the
  hive's recess (x 70 to 397, y 102 to 324), and the cell textures are cut for `COMB.r`.
- Add a flower: raise `FLOWERS`, add a colour to `PETALS` in `src/art/palette.ts` (one per flower)
  and make sure `flowerSpot` still fits the meadow.
- Add an effect for a new rule: push a new `GameEvent` kind from `src/game/sim.ts` and handle it in
  `GameScene.drawEvents`.

## Gotchas

- Flowers are cut with six petals in a ring around a golden middle; keep them that way (and never
  red with four petals), since no game may show a red cross.
- Depths: `bg-back` 0, meadows 0.01 to 0.02, `bg-front` 0.05, flowers about 0.1, the season
  tint 0.5, hive 1, hive tabs and plaque 1.5, cells 2, comb graphics 2.5, casks 3 to 4, goal card
  20, buttons and the order and contract cards 30 to 31, bees 50, wasps 51, the market
  `UI_DEPTH - 2`, HUD, the away chip and the swarm chip near `UI_DEPTH`, the end card
  `UI_DEPTH + 5`. The away chip covers the market while it shows (a tap hides it); the swarm
  chip sits above the button board, so the market stays in reach while a swarm gathers. Anything new on the board or meadow must sit above `bg-front` (and below the season tint
  if the season should colour it).
- `homeSpot` fits a row of `MAX_BEES` (12) bees along the entrance and puts the second hive's row
  in front of it on the landing board, both below the comb (its bottom tips end at y 319) and
  above the market (y 384). A third row would cover one or the other, so a third hive needs a new
  place for its bees.
- `Cell` is a union: check `type` (or `isHoney`/`isBrood`) before reading `phase` or `nectar`.
- `cellAt` hits the nearest centre within half a hex width, so taps right on a corner between
  cells may miss.
- The button board and jar shelf are baked into `bg-front`; moving `BOARD` or `SHELF` in
  `layout.ts` also needs `bakeFrontBackground` in `src/art/scenery.ts` changed. Anything new pinned
  to the screen's edge goes at `this.edges`, not at `VIEW`'s edge. The hive texture
  is drawn in screen coordinates inside `HIVE`.
- The scene saves on `pagehide`, so a script that writes `beehive-baron-progress` and then reloads
  the page sees its write overwritten; set the save from an init script on a fresh page instead.
- All browser storage must stay prefixed `beehive-baron-`, since every game shares the hub's
  origin.
