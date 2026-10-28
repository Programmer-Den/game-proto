# Mapmaker: guide for agents

How this game is built and where it stands, for agents about to change it. `README.md` covers how
to play, the tile values and the upgrades. Per the root `AGENTS.md`, keep this file up to date in
the same PR as any change to the game.

## Current state

A fog-of-war charting game on a 15x11 tile island, drawn as a modern topographic survey sheet.
Each voyage the player has a number of supplies; tapping a blank tile next to a charted land tile
surveys it for its terrain's cost (1, 2 for forests and peaks, 0 for rivers and roads). Hills and
peaks reveal tiles around them for free, with a viewshed animation that tallies their values.
Charted tiles can hold finds (a wreck's +3 supplies, a cave's artifact, a storm that blocks a tile
for the voyage). Camp pitches a base camp (3 supplies) that lets the surveyor survey two steps out
from it. Charting the ruins gives the isle's treasure riddle, whose tile is dug up by tapping
charted ground (1 supply a dig). Every river, road and wood (3+ forest tiles) is a named feature;
the chart that charts its last tile pays 2 coins a tile on top. When nothing more can be paid for,
or the player taps Return to port, the voyage's revealed tiles become a chart that sells for coins
at the port (half for tiles the rival charted first), plus feature bonuses, a commission bonus,
artifacts and treasure, plus 3 coins for each unused supply (capped at what the tiles pay), plus any
isle milestones reached (50%: +20, 75%: +40, 100%: an atlas page). The harbor lays out a
commission board (up to three, one of them long, over two or three voyages) and three of four hands
(free, for the next voyage: Woodsman, Climber, Naturalist, Boatman) and sells four upgrades, then
Set sail starts the next voyage; once nothing more can be surveyed, the next voyage goes to a new
island, of the next kind (green, archipelago, volcanic, jungle). From the third isle a rival
surveyor charts one tile for every two surveys, heading for ruins and high ground, and can dig the
treasure first. An atlas with a page of every kind completes the Royal Atlas: a win page with the
voyages it took and a saved best, then Keep charting or New atlas.

- Implemented: island generation in four kinds (with rivers, a road, finds and a riddle),
  surveying with a walking surveyor and per-terrain costs, lookouts (hills and peaks) with the
  viewshed tally, sea as a dead end, finds (wrecks, caves, storms), base camps, the treasure riddle
  and digging, charts with per-terrain rows, artifacts and treasure, features that pay once charted
  whole, the commission board with long commissions, hands for a voyage, sell-back of unused
  supplies, the isle completion goal with milestones and the atlas (pages coloured by isle kind),
  the rival surveyor, the Royal Atlas ending with a saved best, the harbor with four upgrades, new
  islands, a full save after every action.
- Art style: a survey sheet on a drafting table. Charted ground has hypsometric tints, contour
  lines, hillshade, black map symbols and italic place names; uncharted ground is blank gridded
  paper with a dashed survey limit; rivers are blue lines and roads cased ink lines; finds, storms,
  dug tiles and the treasure are small map marks; survey stations (with their cost), base camps,
  values, notices and the viewshed are magenta; the sheet
  has a header with a scale bar and north arrow; the panel is a crisp white card. All painted in
  code (`src/art/`), `pixelArt: false`.
- Two themes: the white survey sheet and a dark night sheet (dark paper and cards, light ink,
  deeper hypsometric tints, softer hillshade highlights, lighter contours). The first visit follows
  the device's `prefers-color-scheme`; the moon or sun button beside the panel's logo switches it
  and saves the pick.
- One scene does everything: no title screen, pause or menu of its own (only the theme button);
  the shared start and pause screens and the sound button come from `setupGame`. Sound effects and
  music are made in code (see Sound below). The hub's shared settings apply; see Hub settings below.
- No TODOs or FIXMEs in the code.

## Architecture

### File map

- `src/howToPlay.ts`: the How to play screen's text (goal, controls, core loop and tips) in British
  English, US English (the same with US spelling, made by `us`) and German, picked with `byLanguage`
  and handed to `setupGame(game, { howToPlay })` in `src/main.ts`; update every language when the
  controls or the first round change.
- `src/i18n.ts` and `src/i18n/`: the game's texts (`shared/i18n.ts`). `i18n/en.ts` is the British
  English source (harbour, artefact), `i18n/de.ts` the German and `i18n/en-US.ts` only the texts
  spelled differently in US English (harbor, artifact). `t(key, vars)` shows a text in the hub's
  language, `coins(n)` prints a coin amount (12c, 12 M in German) and `TextKey` types the keys.
  Every text on screen goes through `t`; the data tables name their texts by key.
- `src/audio.ts`: the sound table `sfx` (`sounds` from `shared/audio.ts`) and the song `SONG`; see
  Sound below.
- `src/trophies/`: the game's ten trophies (`shared/trophies.ts`). `index.ts` lists them
  (`trophies`: id, tier, icon, `hidden` for One step ahead and Fully equipped) with their texts in
  `trophies/i18n/` (`en.ts`, `de.ts` and `en-US.ts` for artifact: the name keyed by the id, what
  earns it by `<id>Text`), and imports nothing else from the game, since the hub loads it for its
  trophy shelf. `main.ts` hands `trophies` to `setupGame`, which lists them on the start and pause
  screens. `check.ts` holds each trophy's condition on the `GameState` (`EARNED`: first chart sold,
  a feature charted whole, a cave's artefact, first upgrade, the treasure dug up, `FULL_PURSE` 300
  coins at once, the first atlas page, the Royal Atlas, the treasure dug up on an isle with a
  rival, every upgrade at its last rank) and `checkTrophies(state)`, which `GameScene.update` calls
  every frame; the first call after the page loads awards quietly, so a loaded save earns its
  trophies without a toast. A new trophy is an entry in `index.ts`, its two texts in each language
  file and its condition in `EARNED`.
- `src/main.ts`: creates the `Phaser.Game` (960x540, `Scale.FIT`, smooth art) with `BootScene`
  then `GameScene`, calls `setupGame(game, { howToPlay, trophies })` and `setupScaling(game, { fill: true })`, and puts `game` on `window`
  in dev builds.
- `src/game/state.ts`: `GameState`, `Tile`, `Find`, `Riddle`, `Clue`, `Ground`, `Commission`, `Feature`, `Rival`,
  `Chart`, `Milestone`, `AtlasPage`, `Phase`, `Point`; `GRID`, `BASE_SUPPLIES`, `PROVISIONS_STEP`,
  `INK_STEP`, `SELL_BACK`, `WRECK_SUPPLIES`, `ARTIFACT_VALUE`, `CAMP_COST`, `CAMP_REACH`,
  `DIG_COST`, `TREASURE_VALUE`, `FEATURE_BONUS`, `WOOD_MIN`, `RIVAL_FROM`, `RIVAL_PACE`,
  `RIVAL_STEPS`, `ROYAL_KINDS`, `MILESTONES`; helpers `rankOf`, `maxSupplies`, `inkBonus`,
  `indexOf`, `inGrid`, `tileAt`, `neighbours`.
- `src/game/hands.ts`: `Hand`, the `HANDS` table (name and card text as `TextKey`s), `HAND_IDS`, `HANDS_OFFERED`.
- `src/game/terrain.ts`: `Terrain`, the `TERRAIN` table (name and tile count as `TextKey`s, value, cost, sight, shape),
  `CHART_ORDER`, `isLandmark`.
- `src/game/kinds.ts`: `IsleKind`, the `KINDS` table (name and Set sail caption as `TextKey`s, noise cell and roughness, shore,
  `minLand`, hills and peak thresholds, volcanic `lift`, woods, rivers, roads, atlas page colour)
  and `kindOf(island)` (green, archipelago, volcanic, jungle in turn).
- `src/game/upgrades.ts`: `UpgradeId`, the `UPGRADES` table (name and text as `TextKey`s, costs), `UPGRADE_IDS`,
  `nextCost`.
- `src/game/island.ts`: `makeIsland(number, seed?)` rolls an island of `kindOf(number)` from a
  seed (`newSeed()` from `Math.random` when none is given; `seeded` is a mulberry32 that every roll
  inside draws from, so the same number and seed roll the same isle, `seed` on the `Island`) (value noise for
  height, relief and woods), joins an archipelago's islets with sandbars (`joinIslets`), keeps the
  biggest landmass (four-way connected), rings it with beach, places the port, runs rivers from the
  high ground to the sea (`addRivers`), places villages, lays a road from the port to the nearest
  village (`addRoad`), places ruins, hides the `FINDS`, builds the riddle (`makeRiddle`: a
  tile and the fewest `Clue`s that pick it out among every tile you could dig, landmark clues tried
  in `TILES_ORDER`, `DIR_ORDER` and `MARK_ORDER`) and finds the features (`findFeatures`: each
  four-way stretch of river, road or forest, named from `RIVER_NAMES`, `ROAD_NAMES` and
  `WOOD_NAMES`, keys of `i18n/en.ts`, by the island number, in reading order).
- `src/game/sim.ts`: the rules. `newGame`, `canSurvey`, `frontier`, `costOf`, `canAfford`,
  `sightOf`, `survey`, `canAct`, `canCamp`, `pitchCamp`, `diggable`, `dig`, `claimed`,
  `valueOf`, `returnToPort`, `featuresDone`, `featureAt`, `artifactValue`, `chartOf`,
  `sellBackOf`, `chartable`, `isleProgress`, `milestonesDue`, `atlasKinds`, `royalComplete`,
  `sellChart`, `carriesOver`, `closeAtlas`, `pickCommission`, `isPicked`, `hire`, `buy`, `islandCharted`,
  `setSail`, and the private `reveal` (turns up finds), `landRival` and `rivalTurn`, `fogged`,
  `rollCommission` and `rollBoard` with the `COMMISSIONS` table, and `rollHands`.
- `src/game/save.ts`: `loadGame` (fills the new fields on older saves, and turns English feature
  names and riddle clues from before the translations into keys and `Clue`s) and `saveGame`; `loadBest`
  and `saveBest` for the Royal Atlas's fewest voyages; `loadTheme` (the saved theme, else the
  device's `prefers-color-scheme`) and `saveTheme`.
- `src/scenes/BootScene.ts`: sets the art's resolution (`sharpenArt`) and the theme
  (`applyTheme(data?.theme ?? loadTheme())`), bakes the surveyor and the icons, then starts `Game`. The theme
  switch comes back through it.
- `src/scenes/GameScene.ts`: owns the `GameState`, takes taps, paints the island into two canvas
  textures, draws the sheet, survey stations with their costs, the map marks, surveyor and rival,
  value chips and notices, the viewshed, the side panel (with the riddle box and the Camp button)
  and the chart, Royal Atlas and harbor overlays; exposes `spots`. `commissionText`, `voyagesLeft`
  and `clueText` put commissions and riddle clues into words.
- `src/scenes/layout.ts`: screen constants (`VIEW`, `MAP`, `PANEL`, `CAMP_BUTTON`, `RETURN_BUTTON`, `OVERLAY`,
  `OVERLAY_BUTTON`, `SHOP`, `HANDS_COLUMN`, `BOARD`, `BUTTON`, `SMALL_BUTTON`, `UI_DEPTH`, `FONT`) and `tileCentre`.
- `src/ui/Button.ts`: `makeButton`, a flat ink button with an optional size, disabled look (a tap
  on a disabled one plays `ui('refuse')`) and left-aligned caption.
- `src/art/paint.ts`: the palette, `PALETTES.light` and `PALETTES.dark` (`INK`, `ON_INK`,
  `MAGENTA`, `SHEET`, `VELLUM`, `CARD`, `TABLE`, `RULE`, the fog's colours, the overlay `DIM`...)
  exported as `let`s that `applyTheme(theme)` swaps (read them when drawing, never copy them into
  a module-level constant), `theme`, the fixed colours (`GOLD`, `OUTLINE` for the surveyors,
  `ON_MAGENTA`, `SKIN`...), `HI` (textures
  are painted at HI times their size and shown at 1 / HI; 2, or `renderScale` when that is bigger,
  set by `sharpenArt`), `bake` (paint a canvas and add it as a texture),
  `rng`, `hex` and drawing helpers.
- `src/art/map.ts`: `paintTerrain` (tints, hillshade, contours by marching squares, coastline,
  rivers, roads and symbols for the whole island), `paintFog` (blank paper over uncharted tiles, translated UNSURVEYED lettering
  and the dashed survey limit), `placeNames` (village, ruin, bay and harbour names and peak
  heights, picked from the island number and tile spots, and every wood's and river's feature
  name; villages keep their names in every language, the rest are translated) and `nameColor`, `tintOf` (a flat colour per terrain for the live chart and swatches, per
  theme) and `TERRAINS`, the per-theme `BANDS`, `FOREST_TINT`, `ROAD_FILL`, `CONTOUR` and `SHINE`,
  `CANVAS` and `TS` (80 units a tile; both painters draw in these units
  onto a canvas `HI / 2` times CANVAS, and paint the tints pixel by pixel at the canvas's own size).
- `src/art/surveyor.ts`: `surveyor` and `surveyor-step`, the bear in a pith helmet behind a
  theodolite, and the rival's grey `rival` and `rival-step` (the `LOOKS` table); `SURVEYOR_ORIGIN`.
- `src/art/icons.ts`: `icon-<upgrade>`, `hand-<hand>`, `swatch-<terrain>`, `landmark-hint` (the
  compass rose), `logo`, `atlas-<kind>` and `atlas-empty`, and the `MARKS`: `find-wreck`,
  `find-cave`, `artifact`, `storm`, `camp`, `dug`, `treasure`, `claim` (the rival's pennant) and
  `riddle`.
- `shared/setupGame.ts`, `shared/settings.ts` and `shared/i18n.ts` (outside the game folder): the
  hub's settings. `main.ts` imports `setupGame`; `state.ts` imports `byDifficulty`; `GameScene`
  reads `settings.reduceMotion`; `i18n.ts` and `howToPlay.ts` use `translator` and `byLanguage`.

### How it runs

- Boot: `BootScene.create` calls `bakeSurveyor` and `bakeIcons`. No asset files.
- `GameScene.create` loads the save or calls `newGame`, draws the sheet (table, header, scale bar,
  north arrow, grid labels), creates the `island-terrain` and `island-fog` canvas textures (CANVAS
  times `HI / 2`, 1200x880 at HI 2, shown at 1 / HI over `MAP`), the station graphics, the viewshed graphics, the surveyor and the
  side panel.
- Input: a `pointerdown` with nothing interactive under it is turned into a tile (from
  `pointer.worldX/Y`, since `pointer.x/y` are canvas pixels) and passed to
  `survey`, or else to `dig`; the scene slices `state.surveyed` before and after to know which
  tiles the survey charted and calls `announce`, `announceFinds` (notices for wrecks, caves,
  storms ("blocks" for each storm `survey` returns as `settled`, taken from its result rather than
  `state.storms` since a storm that ends the voyage is cleared at once, and "storm passes" for each
  storm find it returns as `passed`, having no tile to settle on)
  and the riddle chart; a dig gets "Nothing here" or "Treasure!"), `announceFeatures` (a
  feature charted whole) and `announceRival` (the rival read the riddle or dug the treasure).
  Buttons call `pitchCamp`, `returnToPort`, `sellChart` (then `saveBest` when the Royal Atlas
  page opens; it returns whether the voyages set a new best, which the page shows, kept in
  `newBest`, so a reload or a tie shows the best instead), `closeAtlas`, `newGame` (New atlas), `pickCommission` and `hire` (the harbor's
  `card`s), `buy` and `setSail`. Every successful action calls `saveGame`. The theme button
  (`makeThemeButton`, above the overlays' dim) calls `saveTheme` with the other theme and starts
  `Boot` with `{ state, theme }`, which applies that theme (`loadTheme()` only when none is handed
  over, so the switch works with storage blocked or full), bakes the icons again and restarts
  `Game` with that running state (`create(data)`, falling back to the save only when none is
  handed over), painting everything anew. The overlay's full-screen dim is interactive, so it swallows taps on the map.
- `update(time)` computes `dt` from the frame time (clamped to 100 ms) and only animates:
  - `syncIsland` repaints the terrain and place names when `state.tiles` is a new array (a load or
    a new isle), repaints the fog when tiles are charted (laying a `vellum` tile over each that
    fades out, and marking it fresh for the live chart), and adds or removes compass roses.
  - `moveSurveyor` walks the sprite toward `state.surveyor` at 260 px/s (snapping when more than 6
    tiles away; Set sail also snaps it to the port); `moveRival` walks the rival's the same way,
    and hides it while there is no rival.
  - `drawGlow` draws a magenta survey station on every `frontier` tile (dashed square, triangle,
    "−2" or "FREE" under it when the cost isn't 1, grey when the supplies can't pay; the one under
    the pointer is solid with a cost pill, which also names the feature the tile would finish,
    from `featureAt`), and once the riddle is known a dashed dig square and
    pill on charted ground under the pointer. Cost labels come from a reused pool of texts.
  - `syncMarks` keeps an image per map mark (finds on charted tiles, storms, camps, dug tiles,
    the treasure chest for the player's own find, a dug mark on the riddle's tile once charted when
    the rival dug it, the rival's claims) and adds or removes them as the state changes.
  - `agePopups` floats the value chips of ordinary surveys and the notices.
  - `ageSweep` plays a lookout's viewshed: the dotted ring grows over `RING_MS`, a chip appears on
    each tile as the ring passes, from `GATHER_AT` the chips fly into the magenta tally ("VIEWSHED
    n tiles +v") which counts up, and everything fades after `HOLD_MS`.
  - `updatePanel` refreshes the texts (the header names the hand aboard) and redraws the panel
    graphics: supply pips with the unused bracket (pips past the maximum, from wrecks, in magenta),
    the live chart (15x11 at 3 px, fresh tiles magenta for `FRESH_MS`), the commission progress
    (swatches up to four tiles, in words beyond, with the voyages left of a long one), the riddle
    box (hidden, clues, found, taken by the rival), the isle goal bar with its milestone marks, the
    Return to port badge, and rebuilds the Camp button when `canCamp` changes.
  - `syncOverlay` rebuilds the chart, Royal Atlas or harbor overlay when its key (phase, coins,
    ranks, the hand and the commission picked) changes.
- The rules never depend on time: everything happens on taps.

### State model

- `phase`: `'survey'` (on the island), `'chart'` (at port, `chart` set, not sold), `'atlas'` (the
  Royal Atlas page, after the sale that completed it), `'harbor'` (sold; picking, buying and
  setting sail).
- `kind` is the isle's kind (`kindOf(island)`).
- `tiles` is row-major, `GRID.w` x `GRID.h`; each has `terrain`, `revealed` and maybe a `find`
  (kept after it is revealed, which is how the map draws wrecks and caves). The port starts
  revealed. A tile is surveyable when unrevealed, not in `storms`, and next to (four-way) a
  revealed non-sea tile or chartable and within `CAMP_REACH` steps of a camp. Surveying it costs
  `TERRAIN[terrain].cost` and needs that many supplies.
- Finds turn up in `reveal`, for tapped and lookout tiles alike: a wreck adds `WRECK_SUPPLIES`
  (supplies can pass `maxSupplies`), a cave adds to `artifacts`, a storm settles on the nearest
  fogged chartable tile within two steps after the lookout's reveal (`storms`, cleared by
  `returnToPort`); `survey` returns the storms it `settled` and the storm finds that found no tile, which `passed`. Charting a ruins tile sets `riddle.known`.
- `camps` (the isle's base camps) are pitched on the surveyor's tile by `pitchCamp` for
  `CAMP_COST`; not on the port or sea, not twice. They reset on a new isle.
- `riddle` (null when no tile could be told apart) holds the hidden tile `at`, its `clues` (each a
  `Clue`: so many tiles one way from a landmark, the ground, by the water, out of sight of the sea
  or beside a river, put into words by `clueText`),
  `known` and `found`. `diggable` is every charted non-sea, non-port tile not in `dug`, once the
  riddle is known and not found and a supply is left; `dig` costs `DIG_COST`, walks the surveyor
  there, and on `at` sets `found` and adds `TREASURE_VALUE` to `treasure`. `dug` resets on a new
  isle; `artifacts` and `treasure` are this voyage's and reset by `sellChart`.
- `surveyor` is a tile: the surveyed tile, or for sea the revealed shore beside it nearest the
  surveyor. It returns to `port` on `setSail`.
- `surveyed` lists the tiles revealed this voyage (lookout reveals included); `chartOf` counts them.
  `sellChart` clears it.
- `survey`, `pitchCamp` and `dig` end the voyage (`returnToPort`) once `canAct` is false: no
  `frontier` tile the supplies can pay for, and nothing to dig.
- `chart` (set by `returnToPort`): `counts`, `base` (the tiles' full value), `rivalTiles` and
  `rivalLoss` (tiles the rival `claims` first, and half their value, floored, taken off), `ink`
  (on `base - rivalLoss`), `features` and `featureCoins` (`featuresDone`: every feature whose
  tiles are all revealed with at least one in `surveyed`, so it pays once), `bonus` (the
  commission's, when `done` plus this voyage's count reaches `need`), `artifacts`, `artifactCoins`
  (`artifactValue`: double with a Naturalist), `treasure`, `unused` and `sellBack`
  (`min(unused * SELL_BACK, base - rivalLoss)`, so turning back at once earns nothing), `milestones` and
  `milestoneCoins` (the `MILESTONES` reached and not yet paid), `atlas` (100% reached), `total`.
  Supplies are left as they are until `setSail` refills them.
- `features` (from `makeIsland`, or `findFeatures` on a load): each with `kind`, `name` (a `TextKey`), `tiles`
  and `bonus` (`FEATURE_BONUS` a tile). They never change on an isle.
- `hand` is the hand aboard (`null` for none): `costOf` (Woodsman: forests 1, Climber: peaks 1,
  Boatman: sea 0), `sightOf` (Climber: +1), `canSurvey` and `survey` (Boatman: a charted sea tile
  counts as a place to survey chartable tiles from, and the surveyor stands on the sea tile) and
  `artifactValue` read it. `sellChart` clears it and rolls `hands` (`HANDS_OFFERED` of `HAND_IDS`);
  `hire` sets it at the harbor. The first voyage has none.
- `rival` (`null` before `RIVAL_FROM`, set by `setSail` on a new isle with `landRival`: the beach
  farthest from the port, claimed): `at`, `claims`, `due` and `ruins`. `survey` counts `due` up and
  every `RIVAL_PACE` surveys calls `rivalTurn`: a breadth-first walk over land from `at` scores
  every tile blank on both charts by its steps less a pull (ruins 6, peaks 3, hills 2, the riddle's
  tile 8 once `ruins` is set and the treasure not found), and the rival walks up to `RIVAL_STEPS`
  steps along the path to the best, claiming the first blank tile it reaches (setting `ruins` on
  the ruins) or, on the riddle's tile, setting `riddle.found` and `riddle.rival`. Lookout reveals
  and digs give the rival no turn. The rival stays on the isle between voyages.
- `royal` is set by `sellChart` (`{ voyage }`) the first time `royalComplete` holds (a page of
  `ROYAL_KINDS` kinds in `atlas`); that sale opens `'atlas'` instead of the harbor, and
  `closeAtlas` goes on to it. `GameScene` calls `saveBest` then. New atlas calls `newGame`.
- The isle goal: `chartable` is every land tile plus every sea tile beside land (the land is one
  four-way patch, so all of it can be reached). `isleProgress` gives the share revealed as a whole
  percent, 100 only when all are. `milestones` counts the `MILESTONES` already paid on this isle;
  `sellChart` adds the chart's, and on `atlas` pushes an `AtlasPage` (island, voyages it took,
  tiles, kind) onto `atlas`. `isleStart` is the voyage the isle began on. `setSail` to a new isle
  resets `milestones`, `camps` and `dug`, sets `isleStart` and takes the new isle's `kind` and
  `riddle` (all from `next`, or a fresh `makeIsland` for a save from before it).
- `ranks` maps upgrade ids to ranks; `maxSupplies`, `inkBonus` and `sightOf` derive their effects.
  The compass is read by `GameScene` only.
- `commission` has `terrain`, `need`, `bonus`, `voyages`, `done` (tiles counted on earlier voyages)
  and `left` (voyages left, this one included). `newGame` rolls a one-voyage one (`rollCommission`)
  from terrains the fog still hides enough of (for sea, only unrevealed sea beside land, since open
  sea can't be surveyed); it can be null. `sellChart` ends it unless `carriesOver` holds (not paid,
  `left` above 1 and, on a new isle, that isle's fog can still fill `need - done`), else
  adds the voyage's count to `done` and counts `left` down; with none running it lays out `board`
  (`rollBoard`: up to `BOARD_SIZE` open commissions shuffled, the last made long when at least two
  are open and the fog holds `need * voyages + 1` tiles: two or three voyages for `LONG_PAY` times
  the pay a voyage) and picks `board[0]`; `pickCommission` swaps the pick at the harbor and
  `isPicked` tells the UI which row it is. When `returnToPort` finds the isle charted in full it rolls
  the next isle into `next` (so the chart's commission row can say "missed" when it won't carry
  over, from `carriesOver`), and the sale works the board out from that isle's fog; `setSail` lands
  on `next` and clears it. `setSail` rolls a one-voyage commission only when none is set, which only a
  save from before `next` can reach.
- All mutation is in `src/game/sim.ts`. `GameScene` only calls those functions.

### Persistence

`localStorage` key `mapmaker-save` holds the `GameState` as JSON (the atlas included),
written after every successful action and read once in `GameScene.create`. `saveGame` packs it
(`pack`): the isle is kept as its `seed`, without `kind`, `tiles`, `port` and `features`, with the
charted tiles as `revealed` (one bit a tile, row by row, in base64) and the riddle as only its
`known`, `found` and `rival` flags; `next` is kept as its seed alone. `loadGame` (`unpack`) rolls both
isles again with `makeIsland(island, seed)` (and `island + 1` for `next`) and lays the bits and flags
over them, which takes a save from about 11 KB to about 0.5 KB. So a change to `makeIsland`, `KINDS`
or `FINDS` reshapes the isles of existing saves (the charted bits stay on the same grid squares). An
isle loaded from a save made before seeds has no `seed` and keeps saving in full, as does an old
`next` without one. A save whose tile count
doesn't match `GRID` is ignored, saved supplies are clamped to `maxSupplies` (a save from an easier
difficulty can hold more; this voyage's wrecks are allowed on top), and saves from before the isle
goal get `milestones: 0`, `isleStart: voyage`, `atlas: []` and zeroed new chart fields. Saves from
before isle kinds and finds get `kind: 'green'` (atlas pages too), no camps, storms, dug tiles or
riddle, and zero artifacts and treasure. Saves from before features, the board, hands, the rival
and the Royal Atlas get their `features` from `findFeatures`, an empty board and hands, no hand,
no rival, no `royal`, one-voyage commissions and zeroed new chart fields. Saves from before the
next isle was rolled get `next: null` (a save in the chart phase from before it was rolled at the
port rolls it at the sale). Saves from before the translations get their
feature names turned into keys and their riddle clues into `Clue`s. `mapmaker-best` holds
the fewest voyages a Royal Atlas took, kept across New atlas. `mapmaker-theme` holds `'light'` or
`'dark'` once the theme button has been used; until then the device's preference decides. The hub's settings live under the
shared `hub-settings` key. `mapmaker-trophies` holds the trophies earned (`shared/trophies.ts`),
each id with the time; New atlas keeps them.

### Randomness and timing

- `Math.random` is used only in `newSeed` in `src/game/island.ts` (one draw per isle; the noise
  lattices, landmark and find spots and the riddle's first candidate tile come from the seed) and in `rollCommission`, `rollBoard` and `rollHands` (called by
  `sellChart`; `returnToPort` also calls `makeIsland` for the next isle once this one is charted in full). Rivers, the road, features and their
  names, storms' targets, the rival's every move and the riddle's clues are worked out from the
  tiles, without randomness. The art uses `rng()` and a sine hash; place names come from the island number
  and tile spots.
- Animation time comes only from the `time` argument of `GameScene.update`. No timers or tweens.

### Data tables

- `src/game/terrain.ts`: tile values, survey costs, lookout sight and shape.
- `src/game/kinds.ts`: each isle kind's terrain mix and atlas colour.
- `src/game/upgrades.ts`: upgrade costs and text keys.
- `src/game/hands.ts`: the hands' names and card texts (as keys).
- `src/i18n/`: every text on screen, in British English, German and US English.
- `src/game/state.ts`: `GRID`, `BASE_SUPPLIES`, `PROVISIONS_STEP`, `INK_STEP`, `SELL_BACK`,
  `WRECK_SUPPLIES`, `ARTIFACT_VALUE`, `CAMP_COST`, `CAMP_REACH`, `DIG_COST`, `TREASURE_VALUE`,
  `FEATURE_BONUS`, `WOOD_MIN`, `RIVAL_FROM`, `RIVAL_PACE`, `RIVAL_STEPS`, `ROYAL_KINDS`,
  `MILESTONES`.
- `src/game/island.ts`: `FINDS` (how many of each, on what, how far from the port), landmark
  counts per island, the riddle's clue tables and order (`DIRS`, `MARKS`, `GROUND`, `TILES_ORDER`, `DIR_ORDER`,
  `MARK_ORDER`), the feature name keys
  (`RIVER_NAMES`, `ROAD_NAMES`, `WOOD_NAMES`).
- `src/game/sim.ts`: `COMMISSIONS`, `BOARD_SIZE`, `LONG_PAY`.
- `src/art/map.ts`: terrain heights (`ELEV`), tint bands (`BANDS`), name lists.

### Sound

All sound is in `src/audio.ts` and played by `GameScene` (and `makeButton`), only from the player's
own taps, so nothing plays while a save is loaded or the theme switch restarts the scene. The sim
has no audio imports.

- `SONG`, F Lydian at 92 BPM in eighth notes (`steps: 2`), pulse lead, square harmony, triangle
  bass. `syncMusic` (end of `update`) picks the part: while surveying, the isle kind's own part
  (`green`, `archipelago` (airier), `volcanic` (D Dorian, driving) or `jungle` (syncopated)), or
  `rival` (an uneasy motif over D minor and E) once a rival is on the isle; at port, on the Royal
  Atlas page and at the harbor, `harbor` (a bustling loop with a walking bass). Stings, played on
  Sell chart: `royal` when the sale completes the Royal Atlas, else `page` when it binds an atlas
  page.
- `sfx`, by where it plays:
  - `scratch` and `blip` on every survey, the blip at 1.26x pitch for a free tile and 0.8x for a
    dear one (cost 2); a tap on fogged ground that can't be surveyed, or on ground that can't be
    dug while the riddle is open, plays `ui('refuse')`.
  - `sweep` when a lookout's viewshed starts (`startSweep`), `tick` as the ring reaches each tile
    and `tally` when the values are added up (`ageSweep`); with reduced motion only `tally`.
  - One news sound a survey, the most important of `NEWS_ORDER`: `riddle` (the ruins charted),
    `rival` (the rival read the riddle or dug the treasure), `feature` (charted whole), `sparkle`
    (a cave's artifact), `wreck` with `chime` (a wreck's stores), `thunder` (a storm settles).
  - `dig`, then `treasure` or `thud`, on a dig; `flap` and `peg` on Camp.
  - `horn` when the voyage ends (Return to port, or the last supplies spent); `swell` and `horn` on
    Set sail.
  - `coins` on Sell chart, plus `milestone` when the chart pays a milestone without binding a page.
  - `buy` for an upgrade, `hire` for a hand taken aboard (`ui('click')` for one left ashore),
    `flip` for a commission picked, `ui('click')` for the theme button, Keep charting and New
    atlas. A tap on a disabled button (Camp, an upgrade too dear) plays `ui('refuse')`.

### Hub settings

- `src/main.ts` calls `setupGame(game)` right after creating the game (frame cap, FPS readout, reduced motion and full screen; Mapmaker uses no camera shake or flash).
- `setupScaling(game, { fill: true })` from `shared/scaling.ts` draws the canvas at the screen's
  resolution (`renderScale` canvas pixels per game pixel, every camera zoomed to match), asks to
  turn a phone held upright and grows the view to the screen's shape (960x540 up to 1296x540 wide or
  960x720 tall). The whole layout stays in the 960x540 coordinates of `layout.ts`: `GameScene.create`
  scrolls the main camera by `-viewFrame(this)` once, which centres the sheet and panel in the view,
  and `viewRect()` (the whole view in world coordinates, from `viewSize`) sizes the drafting table
  in `drawSheet` and the overlays' dim. At 960x540 the scroll is 0 and nothing moves. The camera
  keeps its top-left origin and never follows or zooms, so no `scrollingCamera` is needed. Art is
  painted at `HI` (at least `renderScale`) and texts at `Math.max(2, renderScale)`.
  `e2e/screens.spec.ts` at the root checks the game on five screens.
- Difficulty scales one number: `BASE_SUPPLIES` in `src/game/state.ts` is `byDifficulty(16, 12, 9)`,
  read at module load. Normal must stay 12: the playthrough expects it.
- With `settings.reduceMotion` on, the survey stations stop pulsing, value chips and notices don't float, and
  the viewshed shows its full ring, chips and total at once without the sweep or the gathering.
- Keep the README's difficulty line and the root README's difficulty row in sync.

## Testing hooks

- `src/main.ts` sets `window.game` in dev builds only.
- `e2e/playthrough.spec.ts` reads `game.scene.getScene('Game')`: its `state` (JSON-copied) and
  `spots` (button centres by name: `return`, `camp`, `theme`, `sell`, `sail`, `buy-<upgrade>`,
  `hire-<hand>`, `pick-<n>` for the board's rows, `keep` and `newAtlas` on the Royal Atlas page).
- It seeds `Math.random`, owns the clock with 64 ms frames, and blocks WebGL so Phaser uses canvas.
- It taps tile centres (from `MAP` 24,64 and 40px tiles) of `frontier` tiles the supplies can pay
  for, nearest the surveyor, until none is left; if the voyage is still open (a known riddle keeps
  it open while a supply is left) it taps `return`, then `sell` and `sail`. It pitches no camp,
  digs nothing, hires nobody, picks no commission (the board's first stays picked), buys nothing
  and never turns back early; the rival only lands from the third isle, so it never meets one.
- Values the test copies and that must stay in sync: `VIEW`, `GRID` 15x11, `MAP`, `SUPPLIES` 12, the
  tile values in `VALUE`, the survey costs in `COST`, `WRECK_SUPPLIES`, `ARTIFACT_VALUE`,
  `SELL_BACK`, `FEATURE_BONUS`, `WOOD_MIN`, `HANDS_OFFERED`, `MILESTONES`, the surveyable rule in
  its `frontier` (storms block, no camps, no Boatman) and the chartable rule in its `islePercent`.
  It asserts the isle's features (a river and a road at least, each all of its terrain, named,
  paying `FEATURE_BONUS` a tile), each survey's cost and finds (wreck supplies, cave artifacts,
  storms off the frontier), that only hills and peaks reveal more than the tapped tile, that a
  chart's rows, features charted whole (and only those), commission, artifacts, sell-back and
  milestones add up, that selling records the milestones and lays out a board (its first picked)
  and three hands, and that the second voyage keeps the charted tiles, the picked commission and
  no hand, and refills the supplies.
- At the harbor the test checks that `mapmaker-trophies` holds First chart, plus Named on the map
  when the voyage charted a feature whole and Cave finds when it found an artefact, and nothing
  else; a trophy a first voyage can reach in another way changes that expectation.

## Making common changes

- Add or change a text: its key in `i18n/en.ts` (British spelling), the German in `i18n/de.ts`
  (the build fails without it) and, when US spelling differs, the US text in `i18n/en-US.ts`; run
  `node scripts/check-translations.mjs`. German runs longer than English: the hand cards, the
  harbour's upgrade texts and the chart rows are the tightest spots, so check a new text with
  `?lang=de`.
- Add a terrain: add it to `Terrain` and `TERRAIN` in `terrain.ts` (and `CHART_ORDER`), give it a
  height in `ELEV` and a colour in `TINTS` (both themes, `light` and `dark`) in `src/art/map.ts` (the `Record`s force this) and a
  symbol in `paintTerrain` and `swatch` (`icons.ts`), place it in `island.ts`, and add it to the
  test's `VALUE` and `COST` and the README table.
- Add a find: add it to `Find` in `state.ts`, a row in `FINDS` in `island.ts`, its effect in
  `reveal` in `sim.ts`, a mark in `MARKS` (`icons.ts`) drawn by `syncMarks`, a notice in
  `announceFinds`, the test's per-survey check and the README's finds table.
- Add an isle kind: add it to `IsleKind` and `KINDS` in `kinds.ts` (its name and Set sail caption in
  the `i18n/` files) and to `ORDER` there; the atlas icon is baked from `KINDS` on its own.
- Add an upgrade: add it to `UpgradeId` and `UPGRADES`, draw `icon-<id>` in `UPGRADE_ICONS` in
  `icons.ts`, apply it where it acts (`state.ts` helpers or `sim.ts`). Four rows fill the harbor's
  left column; a fifth needs `SHOP`, `BOARD` and `OVERLAY` in `layout.ts` adjusted.
- Add a hand: add it to `Hand` and `HANDS` in `hands.ts` (name and card text of about 26 characters
  in the `i18n/` files), draw
  `hand-<id>` in `HAND_ICONS` in `icons.ts`, apply it in `sim.ts` (`costOf`, `sightOf`,
  `canSurvey`, `artifactValue`...) and add it to the README's table. `HANDS_OFFERED` cards fill the
  right column (`HANDS_COLUMN`).
- Add a feature kind: add it to `Feature['kind']` and `findFeatures` in `island.ts` (with a name
  list of keys, their names in the `i18n/` files), label it in `placeNames` if it should print, and add it to the test's feature check and
  the README's table.
- Change the rival: `RIVAL_FROM`, `RIVAL_PACE` and `RIVAL_STEPS` in `state.ts`, the pulls in
  `rivalTurn`, the half in `chartOf`.
- Change a commission's reach: `COMMISSIONS`, `BOARD_SIZE` and `LONG_PAY` in `sim.ts`; the long
  one's need is `need * voyages + 1`.
- Change supplies, values or costs: `state.ts` and `terrain.ts`, then the test's `SUPPLIES`,
  `VALUE`, `COST`, `WRECK_SUPPLIES` and `ARTIFACT_VALUE`.
- Change the sell-back or the milestones: `SELL_BACK` and `MILESTONES` in `state.ts`, then the
  test's `MILESTONES` and the README. The panel lays out up to three milestone marks.
- Move the map: `MAP` in `layout.ts`, then the test's `MAP`.
- Add or change a colour: give it a row in both `PALETTES` in `paint.ts` (and a `let` and its
  place in `applyTheme`), or a per-theme table like `BANDS` in `map.ts`; check both themes. The
  playthrough runs in the browser's light scheme.

## Gotchas

- The island shape depends on the draws `makeIsland` takes from its seeded random; changing them
  changes the seeded island the playthrough plays (it reads the state, so it adapts, but its
  screenshots change) and the isles of every seeded save.
- `makeIsland` loops until an island has its kind's `minLand` land tiles; keep it reachable.
- The first isle is always green; changing the green row of `KINDS` changes the playthrough's isle.
- `findFeatures` draws no random numbers, so adding or renaming features never moves the seeded
  island; `sellChart`'s rolls (hands, board) come after everything the playthrough's first voyage
  asserts.
- Riddle clues only hold if the terrain they name stays put: rivers, roads, landmarks and finds are
  all placed before `makeRiddle` runs.
- Landmarks fall back to any meadow, forest or beach tile when no tile fits their rule.
- Read taps through `pointer.worldX/Y` (the camera is scrolled to centre the layout) and lay out in
  game pixels (`VIEW`, with `viewRect()` for anything that covers the whole screen), never `this.scale`
  or `pointer.x/y`, which are canvas pixels once `renderScale` is above 1.
- The island art is painted once per isle (about a million pixels at HI 2, four million at 4K); keep per-frame work in
  `update` to graphics and texts, and repaint the fog canvas only when tiles are charted.
- The compass rose is gold, and the survey overprint is magenta triangles and dashed squares, never
  a cross; the treasure is a chest, never an X; never draw a red cross (root `AGENTS.md`).
