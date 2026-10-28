# Tiny Kingdom: guide for agents

How Tiny Kingdom is built and where things stand, for agents changing it. README.md covers how to
play, the scoring table, decrees, gifts and the rounds. Keep this file up to date with any change
to the game, per the root AGENTS.md.

## Current state

Tiny Kingdom is a turn-based tile-placing puzzle on a 10x7 island. Each turn draws three tiles
from a pouch of farms, houses, towers and roads (and, once won as gifts, windmills, markets,
harbors and lumber camps); the player places one on grass and the others go back. Each building
scores from its neighbours and the score is the whole board's plus bonuses (decrees and seasons).
Two houses side by side can merge into a manor, a lumber camp can clear a wood, a market can trade
tiles. Each round has a royal decree (a side goal paying +8 and a crown) and a season; from round 3
an omen warns of a flood or storm the next round brings. Every island has a castle, and the
buildings joined to it by a chain of buildings and roads pay +1 each when the kingdom is finished.
Reaching the round's goal refills the pouch, raises the goal and offers a choice of two gifts. The
island is random, typed in by its number, the island of the day, or one of eight campaign levels
scored with stars.

Implemented today:

- The hand (`HAND` = 3): `drawHand` draws three tiles from the pouch (which still counts them)
  with a generator seeded by the island and `draws`, so a kingdom's hands never touch
  `Math.random` and an undone placement redraws the same hand; when no drawn tile has room but a
  pouch tile has, the first is swapped for one that has (a lumber camp counts as having room while
  a wood beside a camp could be cleared, `playable`). `hand` is sorted in `BUILDINGS` order.
  `select`, `previewPlacement` and `place` only take kinds in the hand (`inHand`); `place`, `clear`
  and `trade` draw the next hand; `merge` and `chooseGift` keep it unless none of it has room while
  a pouch tile has (`keepHandPlayable` then redraws, so a full board can't get stuck). `shownKinds` gives one tile button per
  kind in the hand and `handCount` how many of it the hand holds; the pouch line under the
  buttons lists what is left to draw.
- The castle (`src/game/castle.ts`): `islandMap` puts a `'C'` (`'castle'`, a `Terrain`) on a random
  grass cell after the lakes and woods, so islands lie as before with one cell taken.
  `joinedCells` walks the chain of built cells (`isBuilt`: buildings, manors and roads) from the
  castle along shared edges; `joinedCount` counts the ones that score (`scores`: everything built
  but roads). `end` (in `state.ts`) pays that count into `bonus` and `score` as `state.castle` when
  the kingdom finishes. `Preview.joins` is how many more a placement would join; the scene shows it
  as a navy "castle +N" pill under the ghost, a gold bead on every joined cell, and the count
  beside the score ("Castle joins N").
- Roads: `'road'` is the last of `BUILDINGS`, in `FIRST_POUCH` and `ROUND_POUCH` (1 each). It is a
  flat tile (`tile-road`, no prop) that scores nothing, counts for nothing (the market's kinds
  skip it) and only runs the chain on.
- Omens (`src/game/omens.ts`): from `OMEN_FROM` (3), `omenFor(island, round, grid)` draws the omen
  for the round after `round` when `round` begins, seeded by island and round: a `storm` on a
  tower with no home around it, or a `flood` on a grass or farm cell beside a named lake (the
  kinds are tried in a seeded order; null when neither fits). `state.omen` holds it; `settle`
  lets it `strike` as the next round begins (flood: the cell becomes a lake, whatever stood
  there; storm: the tower becomes grass if it is still alone), recomputes the score, then draws the
  decree and the next omen on the board as it stands. `Placed.struck` carries the cells for the
  scene's "Flooded" / "Toppled" popups. An omen holds no text: the scene's `omenLine` words it
  from `kind` and `place`, in a few words for the panel's omen strip (`OMEN`, coral) and in a line
  for the round banner, and `refreshBoardMarks` draws a coral dashed box with "Flood" or "Storm" on
  the threatened cell.
- Clearing a wood: with `'lumber'` selected and in the hand, a tap on a forest beside a lumber camp
  (`canClear`) calls `clear`, which turns it to grass, spends the lumber tile and settles like a
  placement (undoable). `previewClear` gives the (usually negative) change; the hover shows a
  grass ghost, the bubble and a "Clear the wood" hint.
- Market trades: `canTrade` needs the playing phase, a market on the board, no trade this round
  (`tradedIn !== round`) and a kind with `TRADE_GIVE` (2) in the pouch (`tradeGives`) to give
  for a different special won that has a use on the board (`tradeTakes`: `playable`, so a harbour
  with no lake shore left is never offered; a lone windmill pair with only the windmill won is no trade). A tap on a market (hover hint "Tap to trade") opens the trade card
  (`TRADE_CARD`, `createTradeCard` / `refreshTrade`): a row of chips to give two of, a row of the
  specials won to take one of (`tradeTakes`), and a Trade button once both are picked. `trade(s, give, take)`
  moves the tiles, sets `tradedIn`, clears the undo snapshot, draws a new hand and runs `checkEnd`
  (`makeTrade` calls `gameEnded` if the kingdom ended). The pouch line
  adds "Tap a market to trade." while one can be made.
- Random islands: each kingdom (the first and every "New kingdom") draws an island number from
  1 to `ISLANDS` (9999) with `Math.random`, and `islandMap` lays it out from that number with its
  own seeded generator: two or three lakes of 2 to 4 cells, then two or three woods of 1 to 3,
  each grown from a random grass cell, then the castle on a random grass cell. The same number
  always gives the same island. `fairIsland` checks each layout: some lake needs 3 grass cells on
  its shore (round 1's decree asks for 3 farms there) and the castle at least `CASTLE_ROOM` (6)
  grass cells joined to it, so it is never walled in by lakes and woods. A layout that fails is
  drawn again from the seed `island + attempt * (ISLANDS + 1)` (`layIsland`); 74 of the 9999 islands
  are redrawn, none of the campaign's and not the playthrough's 1990, and every other island lies
  as before. A greedy bot reaches round 1's goal on every island on Normal; on Hard it falls
  short on 16, where a beam search (40 boards, merges included) still reaches it.
- Islands card (`src/game/islands.ts`, `createIslandsCard` in the scene): opened by the island
  button on the panel's round line (`ISLAND_BUTTON`) or the game-over "Islands" button. It has
  the campaign's eight level plaques with their best stars (locked ones dimmed), a line with the
  hovered level's island and star scores, the island of the day (with today's best), a random
  island, and a keypad (plus keyboard digits, Backspace, Enter and Escape) for an island number
  from 1 to `ISLANDS`. Each starts a new kingdom through `start(island, kingdom)`, which passes a
  `Kingdom` (`mode` `'random'`, `'code'`, `'daily'` or `'campaign'`, with `level` or `day`) to
  `newGame`. The island button reads "Island N", "Daily N" or "Level N"; the panel's bottom line
  shows the best score, today's best or the level's star scores.
- Island of the day: `dailyIsland(today())` hashes the local date (YYYY-MM-DD, from `new Date()`)
  to an island number, the same for every player that day. Its best is saved per day.
- Campaign: `LEVELS` (eight islands, each with three star scores set from a greedy bot's final
  score on Normal at 0.75, 0.9 and 1.05 of it). `starScores(level)` scales them by
  `byDifficulty(1.01, 1, 0.94)`, the same bot's mean final score on Easy and Hard against Normal
  over 300 islands; `starsFor(level, score)` counts the stars against them, and the islands card
  and game over show them;
  `levelOpen` needs a star on the level before. The best stars per level are saved at game over.
- New buildings: the market (+1 per different kind of building around it, credited to the first
  one of each kind in `AROUND` order), the harbor (`canPlace` only allows it on grass with a lake
  beside; +2 per lake, +1 per house or manor beside) and the lumber camp (only beside a forest; +2
  per forest beside, and houses count it as +1). They are `SPECIALS` with the windmill:
  `state.unlocked` lists the ones won, in order, and `shownKinds` gives the tile buttons (the first
  three, then `unlocked`).
- Manors: `merge(s, from, to)` turns the house at `to` into a `'manor'` and the house at `from`
  (beside it) back into grass. A manor is a `Structure` but not a `Building` (it is never in the
  pouch). It scores 4, +3 per farm, +1 per house, manor or forest beside it; towers, houses,
  harbors and decrees count it as a house (`isHome`). In the scene, a tap on a `mergeable` house
  sets `mergeFrom` (teal outline), a tap on the house beside it merges, any other tap cancels; the
  hover shows "Tap to merge", and over the second house a manor ghost with `previewMerge`'s gain.
  A merge goes through `settle` like a placement: decree, rounds, undo snapshot and end check.
- Seasons (`src/game/seasons.ts`): `seasonFor(round)` cycles spring, summer, autumn, winter from
  round 1. Each doubles some buildings (`SEASON_INFO[...].double`): when one is placed,
  `seasonBonus` adds its worth again to `state.bonus`, so the board score never changes with the
  season. `Preview.season` and `Placed.season` carry it; the preview draws an "x2" pill by the
  bubble; the panel's season strip (`SEASON`) and the round banner show the season.
- One screen (`GameScene`): the decree banner above the board, the board in a walnut tray, a side
  panel (title plaque, round, island button, score and the castle's count, goal bar, the gift row,
  the season strip, one tile button per kind in the hand, the pouch line, the omen strip, undo,
  best score or star scores), a hover preview (ghost building, neighbour links, a "+N" bubble, a
  season "x2" and a "castle +N" pill), floating score popups for every building whose worth
  changed, a gift card and a trade card over the board, the islands card, a "Round N" banner (with
  the omen) and a game-over overlay (with the castle bonus) with "Islands" and "New kingdom"
  buttons.
- Royal decrees (`src/game/decree.ts`): one per round, from `decreeFor`. Three kinds: `shore`
  (farms beside a named lake), `wood` (houses beside a named wood) and `watch` (one tower with 3
  houses around it). For shore and wood, `need` is what the board already has plus `ASK` (3 farms,
  2 houses); a watch decree's `need` is a flat 3, offered only while no tower has 3 homes around
  it, so a decree never starts fulfilled. A decree is also checked against the pouch the round
  starts with (`decreeFor`'s `pouch`, the hand included): a shore or wood decree needs `ASK` farms
  or houses in it, and a watch decree a tower standing or in the pouch with room for the missing
  homes around it (`watchShort`) and that many houses, so every decree offered can be met. Round 1 always asks for 3 more farms on the lake with
  the most open shore; later rounds draw a kind and a place from a generator seeded by island and
  round, never repeating the last round's kind and place. Lakes and woods are named by
  `namedPlaces` from where their centre lies (North, South, East, West or Mid, plus mere / pool /
  tarn / water or wood / grove / holt / shaw for repeats). That English name is the place's id in
  `Decree.place` and `Omen.place`; `placeName` in `src/i18n.ts` shows it in the hub's language
  (Ostweiher, Nordwald). A decree holds no text either: the scene's `decreeLine` words it from
  `kind`, `place` and `need`. Progress (`decreeMarks`) is always
  counted from the board, and the lake or wood itself too: `decreeRegion` keeps only the
  `Decree.cells` that are still lake or forest, so a wood cell cleared by a lumber camp drops out of
  the outline and its edge. Fulfilling it pays `DECREE_BONUS` (8) into `state.bonus` and a crown
  (`state.crowns`, saved). An unfulfilled decree lapses when the round ends. The board outlines the
  lake or wood (or the best tower's 3x3) with a yellow dashed line, shows the name on a navy pill,
  ticks counted buildings and marks open grass spots with a dashed box holding a small farm or
  house.
- Royal gifts (`src/game/gifts.ts`): `state.gifts` is the pair on offer for reaching `goal`, shown
  in the panel's gift row as blue chips ("Gift at 20:"). `giftsFor` gives round 1 +2 Towers or
  Windmill, then the next special not won yet (in `SPECIALS` order) plus one of +2 Towers / +3
  Houses / +3 Farms, then, once all four are won, two of the tile packs and +2 of each special
  (seeded by island and round).
  Reaching the goal sets `phase` to `'gift'` and counts `giftsDue` (one per goal; one placement
  can reach several); `chooseGift` adds the gift's tiles, adds a new special to `unlocked`,
  offers the next pair and goes back to `'playing'` when none are due. The card's buttons and the
  panel's chips both choose.
- The windmill: a fourth building, `+1 per farm around it, and +1 to each farm beside it`. Like the
  other specials it reaches the hand once `chooseGift` has put its tiles in the pouch; the tile
  buttons (`TILE_BUTTONS`, up to three 60px plaques) always show the hand's kinds, not the
  pouch's.
- Neighbour links: `previewPlacement` returns the gain, the new building's own `base` (1 for a
  farm) and one `Share` per neighbour (its part of the new building's points plus what it gains
  itself); the shares plus `base` and `season` always equal `gained`, because `cellParts` splits each
  building's score into a base and per-neighbour parts and `cellScore` is their sum. The scene
  draws each as a dotted curve from a yellow "+N" pill (coral for a negative share) on the
  neighbour to the ghost, and the total in a bubble over it.
- Rounds with goals from `goalFor` and pouch refills from `ROUND_POUCH`, without end.
- Trophies (`src/trophies/`, `shared/trophies.ts`): ten, listed in `trophies/index.ts` and handed to
  `setupGame(game, { howToPlay, trophies })`. Bronze: `firstCrown` (a decree fulfilled, `crowns >= 1`),
  `firstManor` (a manor on the board), `firstTrade` (a market trade, `tradedIn > 0`) and `allGifts`
  (all four `SPECIALS` in `unlocked`). Silver: `roundEight` (round 8 reached), `longChain` (40
  buildings joined to the castle at once, `joinedCount`) and `tenCrowns` (10 crowns in all). Gold:
  `bigKingdom` (a kingdom finished with 350), `threeStars` (three stars on a campaign level) and
  `campaign` (hidden: a star on all eight levels), the last two read from `loadStars` with a
  campaign kingdom just finished folded in, so `threeStars` also works with storage blocked
  (`campaign` can't then: levels 2 to 8 open only from saved stars). A greedy player
  finishes with 210 to 340 and joins about 50, so the gold and silver numbers ask for more
  than it. `checkTrophies` in `trophies/check.ts` runs at the end of the scene's `refresh`, after
  every change; its first call on a page is quiet, so crowns and stars saved before trophies earn
  theirs without a toast. The playthrough's decree earns `firstCrown`.
- One undo per round: `state.undo` holds a snapshot taken in `place`, `clear` or `merge`; `undo`
  restores it (the hand and `draws` included) and records the round in `undoneIn`. A placement
  that fulfils a decree or starts a new round clears the snapshot, so it cannot be undone, and so
  does a trade. Undo is only offered while `phase` is `'playing'`.
- Art: a wooden toy set painted on 2D canvases at boot (`src/art/`), in art units twice the view
  (the approved mockup's scale, `.../next5/tiny-kingdom/style-wooden-toy.png` and its `woodtoy.js`),
  baked at `RES` texture pixels per view pixel (the screen's `renderScale`, up to 4 on a 4K
  screen) and shown at view size by `addArt`. Fonts are the system sans stack (`FONT`), weights 700 to 900.
- The game ends when the pouch is empty, or when no pouch tile has a use (`pouchPlayable`: room
  to go, or for a lumber camp a wood beside a camp to clear) and no two houses could merge
  (`housesCanMerge`, which ignores the phase). When no tile has room (`anyPlace`) but a merge or
  clearing is left and nothing can be undone, the undo button reads "No room: merge houses or
  finish" (or "No room: clear a wood or finish" when no houses can merge but `canClearAny`, else
  "No room: finish") and calls `finish`; while
  the last placement can still be undone, it stays Undo. A reached goal first gets its gift, unless
  the island is full and no two houses could merge nor a lumber camp tile clear a wood. `end` pays
  the castle bonus; the best final score, the crowns, the daily best and the campaign stars
  persist (`gameEnded`).

Missing or rough:

- No title screen or menu. The sound has not had a listen on real speakers yet; retune `src/audio.ts` by ear.
- The campaign's star scores come from a greedy bot (`previewPlacement(...).gained` for every kind in the hand and
  every cell, merging when it gains, taking the second gift, the castle bonus included), not from
  human play; retune `LEVELS` if they feel off. The bot never trades or clears woods.
- The castle bonus can be large on a crowded island (a greedy bot joins 40 to 50 buildings), since
  every building in one blob counts; the campaign's stars were set with it in.
- A decree only counts the tiles in the pouch when it is drawn, not the hands: an unlucky draw
  or the player's own building on its spots can still leave it unmet.
- The decree outline is drawn cell edge by cell edge (dashed, square corners), not as one rounded
  shape like the mockup.
- `start` does not clear running score popups (it does stop the round banner).
- The cover, `island-324.webp`, `island-7409.webp`, `windmill.webp` and `game-over.webp` are not
  made by the test: they were taken with a scratch Playwright script against the dev server (the
  cover and game-over set `state` fields through `window.game` to the mockup's round-3 board, then
  placed a tile by tapping; the islands called `newGame(0, 0, island)` from
  `/games/tiny-kingdom/src/game/state.ts` imported in the page). Refresh them the same way. The
  same goes for `new-buildings`, `season-harbor`, `season-lumber`, `merge-preview`, `manor`,
  `islands-card`, `no-room`, `campaign-over`, `castle-preview`, `road-chain`, `omen-flood`,
  `omen-struck`, `trade-card` and `clear-wood`: boards set up with `state.ts` imported in the
  page (greedy moves or hand-placed tiles, then `scene.state = s; scene.redrawCells();
  scene.refresh()`), then real hovers, taps and keys. The cover, the island shots, `windmill`,
  `new-buildings`, the season, manor and islands-card shots predate the hand, the castle and the
  omen strip, so their panels look older.
- `docs/screenshots/favicon.webp` is an older shot no README links.
- `docs/screenshots/german-links.webp` is the playthrough's `3-links` shot from a run with the
  browser's locale set to `de-DE` (a copy of `playwright.config.ts` with `locale: 'de-DE'`).

## Architecture

File map (`src/`):

- `howToPlay.ts`: the How to play screen's text (goal, controls, core loop and tips) in British
  English, US English (the same with US spelling, made by `us`) and German, picked with `byLanguage`
  and handed to `setupGame(game, { howToPlay })` in `main.ts`; update every language when the
  controls or the first round change.
- `i18n.ts` and `i18n/`: the game's texts (`shared/i18n.ts`). `i18n/en.ts` is the British English
  source (harbour, neighbours), `i18n/de.ts` the German and `i18n/en-US.ts` only the texts with
  "harbour" in them, spelled "harbor". `t(key, vars)` shows a text in the hub's language;
  `TextKey` types the keys; `placeName(id)` turns a lake's or wood's id into its name. Every text
  on screen goes through `t`, and a new one gets its German entry (and a US one if its spelling
  differs) in the same PR. In German a farm is an Acker, since Feld means a board cell.
- `audio.ts`: the song (`SONG`) and the effects (`sfx`, `PLACE_PITCH`), played by `GameScene`; see
  Sound below.
- `main.ts`: creates the `Phaser.Game` (960x540, `Phaser.Scale.FIT`, `pixelArt: false`) with
  `BootScene` and `GameScene`, calls `setupGame(game)` from `shared/setupGame.ts` and
  `setupScaling(game, { fill: true })` from `shared/scaling.ts`, and in dev builds puts `game` on
  `window`.
- `scenes/BootScene.ts`: calls `bakeTextures`, then starts `Game`.
- `scenes/GameScene.ts`: builds the board (tile and prop images per cell), the decree banner, the
  panel (island button, castle count, season strip, pouch line, omen strip), the gift card, the
  trade card, the islands card, the round banner and the game-over overlay; turns pointer events
  into `select`, `place`, `clear`, `merge`, `trade`, `undo`, `finish`, `chooseGift` and new
  kingdoms (`start`); draws the hover (ghost, links, bubble, season and castle pills, merge, clear
  and trade hints), the decree marks (`refreshDecree`), the omen mark and the chain's beads
  (`refreshBoardMarks`), popups and panel in `refresh`; saves at game over (`gameEnded`).
- `scenes/layout.ts`: `VIEW`, `GRID`, `TRAY`, `DECREE`, `PANEL`, `TITLE`, `ISLAND_BUTTON`,
  `GOAL_BAR`, `GIFT_ROW`, `SEASON`, `TILE_BUTTONS` (three 60px slots), `POUCH_LINE`, `OMEN`,
  `UNDO_BUTTON`, `GIFT_CARD`, `TRADE_CARD`, `BUTTON`, `ISLANDS_CARD`, `UI_DEPTH`, `FONT` and
  `cellCentre`.
- `game/tiles.ts`: `BUILDINGS` (farm, house, tower, windmill, market, harbor, lumber, road),
  `SPECIALS` (the four gift buildings), the `Building`, `Special`, `Structure` (a building or
  `'manor'`), `Terrain` (grass, lake, forest, castle) and `Cell` types, `INFO` (the `TextKey`s of
  each one's name, rule and count, such as "3 farms"), `isBuilding`, `isBuilt`, `scores`, `isHome`, `MAP_SIZE`, `ISLANDS`,
  `SIDES`, `AROUND`, `islandMap` (lakes, woods, then the castle, redrawn until `fairIsland`), `seeded` (mulberry32),
  `randomIsland` and `startingGrid`.
- `game/state.ts`: `GameState`, `Snapshot`, `Share`, `Preview`, `Placed`, `FIRST_POUCH`,
  `ROUND_POUCH`, `HAND`, `TRADE_GIVE`, `goalFor`, `season`, `newGame(best, crowns, island?,
  kingdom?)`, `inHand`, `cellParts`, `cellScore`, `boardScore`, `canPlace(s, col, row, kind?)`,
  `previewPlacement`, `select`, `place`, `canClear`, `previewClear`, `clear`,
  `canTrade`, `tradeGives`, `tradeTakes`, `trade`, `canClearAny`, `canMerge`, `mergeable`, `previewMerge`, `merge`, `anyPlace`,
  `finish`, `canUndo`, `undo`, `chooseGift`, `shownKinds` and `handCount`; `settle` is the shared
  tail of `place`, `clear` and `merge`, `drawHand` draws the next hand, `keepHandPlayable` redraws
  a stuck one after a merge or gift, `playable` and `pouchPlayable` tell whether a tile has a use
  (room, or a wood to clear), `housesCanMerge` (exported for the undo button's label) checks for a merge whatever the phase and
  `end` finishes the kingdom. No Phaser; `goalFor` reads `byDifficulty` from `shared/settings.ts`.
- `game/omens.ts`: `OMEN_FROM`, `OmenKind`, `Omen`, `Struck`, `omenFor` and `strike`.
- `game/castle.ts`: `castleAt`, `joinedCells` and `joinedCount`.
- `game/seasons.ts`: `SEASONS`, `Season`, `SEASON_INFO` (name, rule and short rule as `TextKey`s,
  doubled buildings, colour), `seasonFor` and `seasonBonus`.
- `game/islands.ts`: `Mode`, `Kingdom`, `Level`, `LEVELS`, `starScores` (reads `byDifficulty`), `starsFor`, `levelOpen`, `today`,
  `dailyIsland` and `parseIsland`.
- `game/decree.ts`: `DECREE_BONUS`, `Decree`, `DecreeMarks`, `At`, `regions`, `namedPlaces`,
  `decreeRegion`, `decreeMarks` and `decreeFor`.
- `game/gifts.ts`: `GIFTS`, `Gift`, `GIFT_INFO` (label and line as `TextKey`s, icon, tiles),
  `giftsFor` and `newSpecial`.
- `game/save.ts`: `loadBest`, `saveBest`, `loadCrowns`, `saveCrowns`, `loadDailyBest`,
  `saveDailyBest`, `loadStars` and `saveStars`.
- `art/wood.ts`: the toolkit: `RES` and `setArtRes` (texture pixels per view pixel, from
  `sharpRes`), `bake` (a canvas `RES` times its view size, painted in art units, added with
  `textures.addCanvas`), `addArt` (an image of a baked texture scaled by `1 / RES`, so it shows at
  view size), `shadow` (canvas shadows turned from art units into canvas pixels), `rrect`, `poly`,
  `circle`, `grain`, `tile` (a painted block), `walnut`, `shadowBlob`, `ball`, the palette `T`, the
  seeded `rnd` / `reseed`, and the painters `peg`, `house`, `tower`, `windmill`, `stripes` and
  `crown`, ported from the mockup's `woodtoy.js`, plus `manor`, `market`, `harbor` and `lumber`
  in the same style.
- `art/textures.ts`: `bakeTextures` (every texture, listed at the top of the file), `PROP` and
  `PROP_ORIGIN` (where a prop's cell centre sits), `tileKey(cell, col, row)` (grass picks one of
  `GRASS_VARIANTS` flower variants by position; lakes, farms and roads have tiles of their own;
  buildings, woods and the castle stand on `tile-plain`) and `propKey(cell)` (`prop-castle` among
  them; `castle` in `wood.ts` paints it). The table, the decree sign, the tray, the panel and the title plaque are the one
  `bg` texture.
- `ui/Button.ts`: `makeButton`, the beech plaque button used by the game-over overlay.
- `trophies/index.ts`: the trophy list (`trophySet`), loaded by the hub too, so it imports nothing
  else from the game; its texts are in `trophies/i18n/` (`en.ts`, `de.ts`, and `en-US.ts` for
  fulfill and favor). `trophies/check.ts`: `checkTrophies(state)` and each trophy's condition
  (`EARNED`) with its numbers (`ROUND`, `CHAIN`, `CROWNS`, `BIG`).

Shared code it imports (outside the game folder): `shared/audio.ts` (`sounds`, `ui`, `playMusic`,
`playSting`), `shared/setupGame.ts` (`setupGame`),
`shared/scaling.ts` (`setupScaling`, `sharpRes`, `viewSize`, `viewFrame`), `shared/settings.ts`
(`byDifficulty`, `settings`) and `shared/i18n.ts` (`translator`, `byLanguage`, `Translation`).

How it runs:

- Boot: `BootScene.create` paints every texture, then `GameScene.create` calls
  `newGame(loadBest(), loadCrowns())` (a random island) and builds all objects once.
- There is no `update` method and no tick. The game is event driven: state only changes on a
  tap. Phaser's tweens animate the popups (`POPUP_MS`), the decree's "+8" and the round banner
  (`BANNER_MS`), so the only time-dependent part is cosmetic. The popups and the "+8" sit at
  `POPUP_DEPTH`, above the gift card that opens on the same placement.
- Input: one interactive zone covers the board. `pointermove` calls `hoverPointer`, which turns
  the pointer into layout pixels with `cameras.main.getWorldPoint` and calls `hoverAt`, which sets
  `preview` from `previewPlacement` and redraws the hover. A touch has no hover, so a touch tap
  (`pointer.wasTouch`) on a cell that would place or clear only previews it and sets `touchAt`; a
  second touch tap on the same cell commits (any other tap, or any `refresh`, drops `touchAt`, and
  `pointerout` from a lifted finger keeps the preview shown). Mouse clicks place at once. `pointerdown` calls `tapAt`, which maps
  the point to a cell with `cellAt` and calls `merge` (second tap of a merge), picks a house to
  merge, calls `clear` on a wood that `canClear`, opens the trade card on a market while
  `canTrade`, or calls `place`. Each tile button's plaque calls `select`; the gift card's plaques
  and the panel's chips (enabled only while a gift is due) call `takeGift`; the trade card's chips
  pick `tradeGive` / `tradeTake` and its Trade button calls `makeTrade`. The gift and trade cards'
  dim rectangles over the tray, the game-over and the islands card's dim rectangles (`dimmer`,
  over the whole view) swallow taps
  to the board below. The islands card listens to `keydown` only while it is visible.
- Rendering is diffed objects, not a per-frame redraw: each cell has a tile image and a prop image
  (depth by row, so roofs and flags overlap the row above) whose textures are swapped by
  `redrawCells`; `refresh` rewrites the panel (pouch line, omen strip, castle count), rebuilds the
  tile buttons when the hand's kinds change, redraws the goal bar, the decree banner and marks
  (`refreshDecree`), the omen mark and chain beads (`refreshBoardMarks`) and the gift row and
  card (`refreshGifts`), and closes the trade card outside the playing phase. The undo button and
  the tile buttons (outside the trade card's dim) close the trade card first, so it never shows
  chips for a pouch that changed under it.

State model (`GameState` in `src/game/state.ts`):

- `grid` is `Cell[][]`, indexed `grid[row][col]`; cells are terrain or a building.
- `grid` cells can also be `'manor'`, which is never in the pouch.
- `pouch` counts tiles left per building, the hand's included (the specials 0 until their gift);
  `hand` is the three (or fewer) drawn this turn and `draws` how many hands have been drawn;
  `selected` is the building the next tap places, always one in the hand.
- `score` is `boardScore(grid) + bonus`, recomputed after each placement. It can fall: a tower
  next to another tower is worth 0, so a placement's gain or preview can be negative.
- `bonus` (decree, season and, at the end, castle points won this kingdom), `crowns` (all
  kingdoms; loaded and saved), `decree` (`Decree | null`, with `done`), `gifts` (the pair on
  offer), `giftsDue`, `unlocked` (the specials won, in order), `omen` (`Omen | null`, for the next
  round), `tradedIn` (the round of the last market trade, 0 for none) and `castle` (the bonus paid
  at the end, 0 before).
- `island`, `mode`, `level` (0 outside the campaign), `day` ('' unless daily), `round`, `goal`,
  `placed`, `phase` (`'playing'`, `'gift'` or `'over'`) and `best`. The season is not stored:
  `season(s)` derives it from `round`.
- `undo` (the `Snapshot` of grid, pouch, hand, draws, score, bonus, selected and placed before
  the last placement, clearing or merge, or null) and `undoneIn` (the round the undo was last used
  in, 0 for none).
- `place`, `clear` and `merge` all end in `settle`; order matters: snapshot, change the grid, add
  the season's bonus, then the decree (pays once, the first time `decreeMarks(...).have >= need`),
  then loop rounds while `score >= goal` (each adds `ROUND_POUCH` and a gift due), then, if a
  round began, let the omen strike and recompute the score, draw a new decree and the next omen on
  the board as it stands and set `phase = 'gift'`, keep the snapshot only if no round began and no
  decree paid, and check for the end only while playing (a gift due waits unless the island is
  full). `place` and `clear` then draw the next hand (which reselects if the picked kind left the
  hand).
- Buildings only go on `'grass'`; `canPlace` also requires `phase === 'playing'`, and for a harbor
  a lake beside, for a lumber camp a forest beside.

Persistence: `tiny-kingdom-best` (the best final score, written at game over),
`tiny-kingdom-crowns` (crowns won, written whenever a decree pays), `tiny-kingdom-daily`
(`{ day, best }`, the island of the day's best, replaced when a new day's game ends) and
`tiny-kingdom-stars` (a JSON array of the best stars per campaign level, 0 to 3) and
`tiny-kingdom-trophies` (the trophies earned, written by `award`). Board and round
are never saved. The hub's settings are read from the shared `hub-settings` key.

Randomness and timing: `randomIsland` makes the game's only `Math.random` call, once per random
kingdom; the island, its hands, its decrees, its omens and its gifts all follow from that number
(`seeded`). The only
date read is `today()` (`new Date()`) when the islands card opens or the daily island starts. The
game calls no `Date.now` or `performance.now`. The art uses its own seeded `rnd`, so textures are
identical every load. Only Phaser tweens use time, and the scene's `later` (a `this.time.delayedCall`)
that staggers sounds; `start` cancels the waiting ones with `this.time.removeAllEvents()`.

Data tables:

- Scoring rules: the cases in `cellParts`, with `SIDES` and `AROUND` for the neighbourhoods.
- Button rule text: the `<kind>Rule` texts in `src/i18n/` (keep every language matching `cellParts`).
- Pouches, the hand and goals: `FIRST_POUCH`, `ROUND_POUCH`, `HAND`, `TRADE_GIVE` and `goalFor`
  in `src/game/state.ts`. Omens: `OMEN_FROM` and the kinds in `omenFor` in `src/game/omens.ts`.
- Seasons: `SEASON_INFO` in `src/game/seasons.ts`. Campaign: `LEVELS` in `src/game/islands.ts`.
- Decrees: `DECREE_BONUS`, `ASK` and the kinds in `decreeFor` / `makeDecree`; names in
  `namedPlaces`.
- Gifts: `GIFT_INFO` and `giftsFor` in `src/game/gifts.ts`.
- Popup and banner timings: `POPUP_MS` and `BANNER_MS` in `src/scenes/GameScene.ts`.
- Positions and sizes: `src/scenes/layout.ts`. Colours: `T` in `src/art/wood.ts`, and the text
  and Graphics colours at the top of `GameScene.ts`.

### Hub settings

- `src/main.ts` calls `setupGame(game)` from `shared/setupGame.ts` right after creating the game,
  which applies the frame cap, the FPS readout, reduced motion and full screen (camera shake and flash become
  no-ops; this game uses neither), and then `setupScaling(game)` from `shared/scaling.ts`, which
  draws the canvas at the screen's resolution (`renderScale` canvas pixels per view pixel, every
  camera zoomed to match) and asks to turn a phone held upright. With `fill: true` the view also
  takes the screen's shape (960 to 1296 wide, 540 to 720 tall, picked once at start, see
  `viewSize`). Everything is still laid out for `VIEW` (960x540, in `layout.ts`): `GameScene.create`
  scrolls the one camera by `-viewFrame(scene)`'s x and y, so the whole layout (board, decree sign,
  panel, cards, banners) sits in the middle of the view, and the `bg` texture is baked at the view's
  size (`bakeTextures` reads `viewSize` and `viewFrame`) with the table's planks over all of it and
  the sign, tray and panel at the frame. The full-view dims (`dimmer`) cover the view, not just
  `VIEW`. Pointers go through `cameras.main.getWorldPoint` (never `pointer.x/y`, which are canvas
  pixels), so taps land in layout pixels. At 960x540 the frame is at 0,0 and nothing moves. The art
  is baked at `RES` (see Art), which `setArtRes` picks for the whole view. `e2e/screens.spec.ts` at the root checks
  the game on five screens.
- Difficulty scales the round goals and the campaign's star scores. `goalFor` in `src/game/state.ts` multiplies the
  base goal by `byDifficulty(0.8, 1, 1.2)` (Easy, Normal, Hard) and rounds it, so the goals are
  16, 36, 60, 88, ... on Easy, 20, 45, 75, 110, ... on Normal and 24, 54, 90, 132, ... on Hard.
  The campaign's star scores follow with `starScores` (`byDifficulty(1.01, 1, 0.94)`, measured from
  the greedy bot's mean final score over 300 islands), since stars save the same on every
  difficulty. Pouches, scoring, decrees, gifts and seasons do not change.
- `settings.reduceMotion`: the score popups and the decree's "+8" only fade in place (no rise or
  fall), and the crown count does not bump. The round banner only fades. Nothing blinks.
- Keep Normal exactly as designed: the playthrough runs on Normal and expects goals 20 and 45.
- Keep the Tiny Kingdom row of the difficulty table in the root README (and the line under the
  screenshots in this game's README) in sync with the `byDifficulty` values in `goalFor` and
  `starScores`.

## Sound

All of it is in `src/audio.ts` and made by `shared/audio.ts` (nothing plays under browser
automation, so the playthrough is unchanged). `GameScene` plays it; `src/game/` has no audio.

Song (`SONG`): a bouncy pastoral in G major at 100 BPM, with a music-box lead (`pulse12`), a quiet
square harmony, a triangle bass and light drums. Its looping parts are the seasons, so the part is
always `season(state)`:

- `spring` (eight bars, G C D G Em C Am-D G): the main tune; plays from `create` and `start`, since
  round 1 is spring.
- `summer` (four bars, brighter and busier), `autumn` (four bars, slower, Em C G D) and `winter`
  (four bars, a sparse music box up high): `announceRound` switches to the new round's season,
  which takes over at the next bar.
- Stings: `omen` (a falling E minor phrase, half a second after the round banner when the round
  brings an omen), `finished` (a cadence home, at the end of a kingdom) and `best` (a fanfare,
  instead of `finished` when the final score beats the best the kingdom started with,
  `bestAtStart`).

Effects (`sfx`), and where they play:

| Sound | Plays |
| --- | --- |
| `select` | a tile button picked, or a house picked to merge in `tapAt` (pitched down when a second tap cancels the merge) |
| `place` | a building placed in `tapAt`, pitched by kind with `PLACE_PITCH` |
| `gain` | after a placement, clearing or merge: one rising blip per building whose worth went up (at most six, 70ms apart, with the popups; `placedSounds`) |
| `loss` | once after a placement or clearing that lowered a building's worth (not for a merge's lost house) |
| `thunk`, `ding` | a merge into a manor, the ding 110ms after the thunk |
| `chop` | a wood cleared by a lumber camp |
| `jingle` | a market trade made (`makeTrade`) |
| `undo` | the undo button took a placement back |
| `decree` | the placement fulfilled the round's decree |
| `flood`, `storm` | the omen struck as the round began (`placed.struck`) |
| `goal` | the placement reached the goal (`placed.newRound`) |
| `gift` | a gift taken (`takeGift`) |
| `tick` | at the end of a kingdom (`endSounds`, from `gameEnded`), one per building the castle joined, at most ten |
| `star` | at the end of a campaign kingdom, one rising chime per star won |

Shared sounds: `ui('click')` for the island button, the trade card's chips and Close, a market
tapped to trade, the islands card's Close (and Escape), keypad digits and Del, and every new
kingdom (`start`); `ui('refuse')` for a tap where nothing can be placed, a tile button or gift
that can't be taken, undo when it isn't allowed, Trade before both picks are made and Play with no
valid island number. Hovering makes no sound. The game has no `?watch` mode.

## Testing hooks

- `src/main.ts` exposes `window.game` in dev builds. The test reads
  `game.scene.getScene('Game')` and its `state` (copied through JSON), `preview` (`{ col, row,
  gained, base, links, season, joins }` or null), `tileButtons` (`{ kind, x, y, w, h }` per shown
  button), `undoButton` (`{ x, y, w, h }`) and `giftButtons` (`{ gift, x, y, w, h }` while a gift
  is due), all in layout pixels (the 960x540 layout, which is the view at 960x540; see Hub
  settings for how it sits in a wider or taller view). `mergeFrom` and `islandButton` are public too but the test does not
  use them.
- Inputs: it clicks tile buttons, the undo button and a gift button at their centres, moves the
  mouse over cells to check `preview`, and clicks cell centres, scaling view pixels by the canvas
  bounding box. It reads `localStorage['tiny-kingdom-crowns']` to check the crown is saved, and
  `localStorage['tiny-kingdom-trophies']` to check the decree earned `firstCrown` and nothing else.
- The test mirrors these, so change them together: the `GameState` shape, `GRID`, `VIEW`,
  `islandMap` (as `ISLAND` and `MAP`, the castle included), `FIRST_POUCH`, `ROUND_POUCH`, `HAND`,
  the goals 20 and 45 (`GOALS`), `DECREE_BONUS`, round 1's decree (`FIRST_DECREE`: kind `shore`,
  place `Eastmere`, need 3; round 2's must differ in kind or place, compared by those ids, never by
  text), round 1's gifts (`FIRST_GIFTS`) and the windmill gift's tiles (`WINDMILLS`),
  the hands `drawHand` deals on island 1990 (`PLAN[].hand`, `ROUND_2_HAND`), the scene key
  `'Game'` and its public fields.
- The test seeds `Math.random`, so the game always picks island 1990. Changing `islandMap`,
  `ISLANDS`, `randomIsland`, or anything that calls `Math.random` before `GameScene.create`
  changes the island: take the new number and rows from the failure message and re-derive `PLAN`.
  Changing `drawHand`'s seed or draw, `FIRST_POUCH` or `BUILDINGS` changes the hands: re-derive
  `PLAN` (a hand only depends on the kinds placed so far, not where).
- `PLAN` is seven placements on `MAP`, each with the hand it is drawn from: a house at (0,5) (+1
  from the forest, beside the castle so it joins the chain), a farm at (2,5) (+2, by the castle),
  farms at (5,5) (+4) and (4,4) (+3), a house at (4,3) (+3: the farm pays 2 and the forest 1), a
  road at (2,4) (+0) and a farm at (7,5) (+3, the third farm on Eastmere's shore: the decree pays
  8, and 24 >= 20 begins round 2 in the same placement). Round 1 is Spring fair, which doubles
  only markets and harbors, so no step gets a season bonus (the links check adds `season`, which
  is 0). No two houses stand side by side, so no tap picks a house to merge. Before each
  placement it checks the hand and the tile buttons (one per kind in the hand). The first hover,
  the house at (0,5), expects a base of 0, a forest link of +1 and `joins` 1. Before the second
  house it hovers (4,3) and expects links +1 from the forest (5,3) and +2 from the farm (4,4)
  (`LINKED`); the road's preview expects +0, no links and no joins. After the farm by the castle
  it tests undo (the hand comes back with it). After the goal it checks the gift card, that a tap
  on grass places nothing, takes the Windmill and checks the pouch, the new hand's buttons and
  the new decree. Editing the island, a scoring rule, the decree choice for round 1, round 1's
  season, `FIRST_POUCH`, the hand's draw, `goalFor(1)` or round 1's gifts needs `PLAN`
  re-derived: a scratch Playwright script that imports `state.ts` in the page and searches
  placements (beam search over the hand's kinds and every cell) finds one quickly.
- It saves `0-start`, `1-preview`, `2-decree`, `3-links`, `4-gift` and `5-round-2` screenshots
  (under `test-results/`); copy them into `docs/screenshots/` as `playthrough-*.webp` when the look
  changes.

## Making common changes

- **Add or change a text**: its key in `i18n/en.ts`, the German in `i18n/de.ts` (the build fails
  without it) and, when it spells "harbour", the US spelling in `i18n/en-US.ts`; run
  `node scripts/check-translations.mjs`. German runs longer than English: the tile buttons' rules
  (two lines where English has two, three at most), the pouch line, the gift row and the omen strip
  are the tightest spots; `fit` in `GameScene.ts` shrinks a one-line text to its room, so check a
  new text with `?lang=de`.
- **Change a building's rule**: edit its case in `cellParts`, its `<kind>Rule` text in every `i18n/` file, the README
  scoring table, then recompute the `gained` values (and links) in the test's `PLAN`.
- **Add a building**: add it to `BUILDINGS`, `INFO` (with its name, rule and count in the `i18n/` files), `cellParts`, `FIRST_POUCH` / `ROUND_POUCH`
  (and to `SPECIALS` plus a new and a more gift in `gifts.ts` if it is won as a gift); paint it in
  `src/art/wood.ts`, add it to `PROPS` and `ICONS` in `textures.ts` (a flat tile like the road
  goes in `cellTile` and `tileKey` instead). The hand never shows more than `HAND` kinds, so the
  tile buttons need no new layout. Update the test's `Building` type and pouches, and re-derive
  its hands if the first pouch changed.
- **Change the hand**: `HAND` and `drawHand` in `state.ts`; the test's hands follow from them.
- **Add an omen kind**: add it to `OmenKind`, pick its cell and texts in `omenFor` and its effect
  in `strike`; its texts in the `i18n/` files, worded by the scene's `omenLine`, popup word
  (`tapAt`) and mark label (`refreshBoardMarks`).
- **Change the trade**: `TRADE_GIVE`, `canTrade`, `tradeGives`, `tradeTakes` and `trade` in `state.ts`; the
  card's chips come from `tradeGives` and `tradeTakes` (`refreshTrade`).
- **Add a season or change one**: `SEASONS` and `SEASON_INFO`; round 1's season must not double
  anything the playthrough places, or its `PLAN` changes.
- **Add a campaign level**: append to `LEVELS` (the card's row fits about eight plaques at
  `ISLANDS_CARD.level`); set its star scores from a greedy run.
- **Add a decree kind**: add it to `DecreeKind`, `ASK`, `decreeMarks` (what counts and the open
  spots), `makeDecree` (when it can be offered) and the shuffle in `decreeFor`; its text in the
  `i18n/` files and the scene's `decreeLine`; pick its spot texture in `refreshDecree`.
- **Add or change a trophy**: its row in `trophies/index.ts`, its name and `<id>Text` in every
  `trophies/i18n/` file and its condition in `EARNED` (`trophies/check.ts`); a trophy the first
  round earns changes the playthrough's trophy check.
- **Add a gift**: add it to `GIFTS` and `GIFT_INFO` (its label and line in the `i18n/` files) and to a pool in `giftsFor`; a gift that is not
  a tile pack also needs handling in `chooseGift`.
- **Retune rounds**: `FIRST_POUCH`, `ROUND_POUCH` and `goalFor` (keep its `byDifficulty` factor
  and the README difficulty rows in step); the round banner reads `ROUND_POUCH` itself. Update the
  test's constants and check the plan still reaches goal 1.
- **Change the art**: painters in `src/art/wood.ts`, textures and the static `bg` in
  `textures.ts`. A prop's texture is `PROP` (80x100) with the cell centre at `PROP_ORIGIN`; keep a
  building inside it. Tile buttons draw the cell's tile and prop in a scaled container.
- **Change the board size or islands**: `GRID` in `src/scenes/layout.ts` must match `MAP_SIZE`,
  `TRAY` frames it and `DECREE` sits above it; mirror `GRID` in the test.

## Gotchas

- `GRID.cols` and `GRID.rows` must equal `MAP_SIZE`; nothing checks it.
- `TILE_BUTTONS.ys` are indexed in the order of `shownKinds` (the hand's kinds in `BUILDINGS`
  order). `buildButtons` destroys and recreates them whenever the hand's kinds change, so
  `tileButtons` changes almost every placement; the count pill shows how many of the kind are in
  the hand, not the pouch.
- A `GameState` field a placement changes must be in `Snapshot` (the hand and `draws` are), or
  undo leaves it stale. `tradedIn` and `omen` are not: a trade clears the snapshot, and an omen only
  changes when a round begins, which clears it too.
- `drawHand` is called at the end of `place`, `clear` and `trade`, after `settle`, so a flood or
  storm that struck is already on the board when the hand is checked for room.
- Season bonuses are banked into `bonus` at placement, so they are in the undo `Snapshot`; a
  manor's merge never gets one.
- `checkEnd` runs after `settle`, `chooseGift` and `trade`. It counts a possible merge as a reason to go on (`housesCanMerge`, not `mergeable`, which
  needs the playing phase), and a possible clearing too (`pouchPlayable`); `finish` is the way out then.
- Canvas shadows ignore the canvas transform: use `shadow()` in `wood.ts`, which converts art
  units to canvas pixels (`RES / ART`).
- Show baked textures with `addArt`, never `this.add.image`: a texture is `RES` times its view
  size, so a plain image comes out up to 4 times too big on a big screen. An extra `setScale` on
  one is divided by `RES` (the tile button's tower icon is `0.85 / RES`); containers scale as usual.
- Read pointers with `cameras.main.getWorldPoint(p.x, p.y)` (or `worldX/Y`), never `pointer.x/y`
  or `viewPoint`: the camera is scrolled to centre the layout, so view pixels are not layout pixels
  on a wider or taller screen. Anything meant to cover the whole view goes at `-frame.x, -frame.y`
  with `viewSize`'s size, like `dimmer` and `bg`.
- `undo` restores the snapshot with `Object.assign`, so any field added to `GameState` must be
  added to `Snapshot` too if an undoable placement changes it. Decree payouts are never undoable
  for that reason (`bonus` and `crowns` are not in the snapshot).
- `state.best` is updated when the game ends but only written to storage by the scene;
  `start` keeps the higher of the stored and current best and crowns, so they survive blocked
  storage. A finished daily's "today's best" (game over and the panel's bottom line) also counts
  the kingdom's own score, since `saveDailyBest` fails silently then.
- `previewPlacement` returns null when the kind is not in the hand (or can't go on that cell), so
  the hover outline shows but no ghost.
- In the `'gift'` phase `round` and `goal` already show the next round; the card's title uses
  `round - giftsDue` for the round whose goal was reached.
