# TinctureTinker: guide for agents

How this game is built and where things stand, for agents about to change it. `README.md` covers how
to play and lists the orders. Keep this file up to date with any change to the game, as the root
`AGENTS.md` asks.

## Current state

A match-3 game: an 8x8 board of five ingredient kinds, where swapping two neighbours to line up
three or more gathers them towards a potion order with a move limit. It is drawn as an Art Nouveau
apothecary label (flat muted inks, bold sepia outlines, cream tiles, gold whiplash ornament on
bottle green, serif italics), all painted in code on 2D canvases. It shares no code with Apothecary.

- **Implemented:** tap-tap and drag swaps, invalid swaps sliding back for free, matches in rows and
  columns, gravity and refill, free cascades, only the order's ingredients counted (they fly to the
  label, the rest pop), Catalyst tiles (a run of four or more leaves one; a matched Catalyst clears
  its whole row), Bloom tiles (an L or T leaves one where its lines cross; matched, it clears the
  3x3 around it), two specials swapped together going off without a match (two Catalysts: a row and
  a column; a Catalyst and a Bloom: three rows; two Blooms: a 5x5), corked jars (from
  order 2: never match or swap, opened and gathered by a match next to them) and resin (from order
  3: holds a tile in place, the first match it is in only melts it) and creeping mould (from order
  5: holds its tile, never matches, spreads to a neighbour after every move unless a match touched
  some mould, and is scrubbed off by a match next to it), order twists from order 3
  (rush: 3 fewer moves, 20 more coins; forbidden ingredient: a swap whose own match has it costs a move; cascades and tools never do),
  royal commissions on every fifth order (three stages on one board, the moves carried over; the
  one played at Grand Master is the crown's last order, which ends the game with the title Royal
  Apothecary and a star total, after which play goes on), twin orders from Journeyman on every fifth
  order after the second (two customers' needs on one board and one pool of moves; the one filled
  first pays a speed bonus), a pantry (ingredients gathered over the needs, up to 5 a kind, pre-fill
  the next order or stage that needs them), an
  automatic shuffle when no move is left, an idle hint that swells two tiles (held still with
  reduced motion), an order label with progress bars, four bench tools bought with coins mid-order
  (Stir: +3 moves for 40; Sift: reroll a row for 25; Pestle: smash a tile for 30; Funnel: swap
  any two tiles for 35; tips in the caption on hover), a workbench of lasting upgrades bought
  between orders (Steady hands: +1 move per order, three levels; Potent Catalysts: a fired Catalyst
  clears its column too; Bloom starter: every board starts with a Bloom), a herbalist selling
  pantry ingredients between orders (8 coins each, up to the pantry's 5 a kind), 1-3
  stars per sale by moves left, a saved tinker rank on a ribbon above the board whose ranks unlock
  three more recipes, a caption cartouche along the bottom (right-aligned under the order label, clear of the corner buttons), and a result card ("Modest order" and
  "Rich order" after a sale, "Try again" after running out of moves, with links to the workbench,
  the herbalist and, once Royal Apothecary, the next guild examination) showing the stars and rank
  news. A rich order (from order 2, picked on the card) pays 50% more for 4 fewer moves (even
  orders) or 2 more jars and resin and one more mould patch if any (odd orders). Guild
  examinations, after the crown, are eight fixed boards (seeded starting layout) that must be sold
  with 2 or 3 stars; each pass adds a seal on the ribbon.
- **Progression:** `order`, `coins`, `sold`, `stars`, `pantry`, `upgrades`, `royal`, `seals` and
  `rich` carry over. Coins buy bench tools, workbench upgrades and pantry ingredients; stars set
  the rank (`src/game/ranks.ts`), and each rank's recipe joins the round of orders. The game has an
  ending (the crown's last order) but does not stop there: the guild examinations follow.
- **Screens:** one scene (`GameScene`) with the rank ribbon and board on the left, the order label
  on the right, a caption along the bottom and a result card over the board. No title screen, menu
  or in-game settings (the hub's settings apply, see Hub settings). Sound effects and a music-box
  waltz, see Sound.
- **Persistence:** progress is saved when an order sells, whenever a bench tool, a workbench
  upgrade or a pantry ingredient is bought and when the next order is picked. The
  board and moves left are not saved, so a reload restarts the current order on a fresh board (with
  the coins already spent gone); a reload during a guild examination goes back to the orders.
- **Rough edges:** tiles fall past a resin-held tile (hopping over its cell) rather than piling on
  it. A shuffle that gives up returns a fresh board without jars, resin or mould. Unlocking a recipe lengthens the round, so the potion for a given order number can shift after a
  rank-up, and a royal commission's stages come from the round too. The caption shows one tip at a
  time, so on a royal or twin order's board the mould tip only shows once a tool is hovered away.
  A mouldy tile falls like any other (only resin holds its cell). The hub card shows the cover with the hub's pixelated image style. There are no TODO
  comments in the code.

## Architecture

### File map

- `src/howToPlay.ts`: the How to play screen's text (goal, controls, core loop and tips) in British
  English, US English (the same with US spelling, made by `us`: neighbor, mold) and German, picked
  with `byLanguage` and handed to `setupGame(game, { howToPlay })` in `src/main.ts`; update every
  language when the controls or the first round change.
- `src/i18n.ts` and `src/i18n/`: the game's texts (`shared/i18n.ts`). `i18n/en.ts` is the British
  English source, `i18n/de.ts` the German and `i18n/en-US.ts` only the texts spelled differently in
  US English (the mould caption). `t(key, vars)` shows a text in the hub's language; `TextKey` types
  the keys. Every text on screen goes through `t`, numbers in texts are formatted for the language,
  and a new text gets its German entry (and a US one if its spelling differs) in the same PR.
- `src/trophies/`: the game's ten trophies (`shared/trophies.ts`). `index.ts` lists them
  (`trophies`: id, tier, icon, `hidden` for Fully fitted and Guild master) with their texts in
  `trophies/i18n/` (`en.ts` and `de.ts`: the name keyed by the id, what earns it by `<id>Text`),
  and imports nothing else from the game, since the hub loads it for its trophy shelf. `main.ts`
  hands `trophies` to `setupGame`, which lists them on the start and pause screens. `check.ts`
  holds each trophy's condition on the `GameState` (`EARNED`: first sale, a Catalyst fired
  (`fired`), a Bloom fired (`bloomsFired`), a three-star sale, a workbench upgrade, the Master
  Tinker rank, `FIFTY_SOLD` potions, every upgrade at its top level, `royal`, every seal) and
  `checkTrophies(state)`, which `GameScene.update` calls every frame; the first call after the page
  loads awards quietly, so a loaded save earns its trophies without a toast. A new trophy is an
  entry in `index.ts`, its two texts in each language file and its condition in `EARNED`.
- `src/main.ts`: creates the `Phaser.Game` (960x540, FIT scaling, `pixelArt: false`) with
  `BootScene` and `GameScene`, calls `setupGame(game)` and `setupScaling(game, { fill: true })` from
  `shared/scaling.ts` (the view takes the screen's shape, see Screens), and puts `game` on `window` in dev builds.
- `src/game/kinds.ts`: `KINDS`, the `Kind` type, `KIND_NAMES` and `KIND_COUNTS` (each kind's name
  and its count in a sentence, "3 wheat", as `TextKey`s) and `randomKind(rand?)`.
- `src/game/orders.ts`: `PotionId`, `POTION_NAMES` (`TextKey`s, the same as the ids), `Needs`, `Stage`, the `Order` type (with
  `rush`, `forbid`, `jars`, `resin`, `mould`, `stages`, `last`, `second`, `rich`, `exam`), `Risk`,
  the `ORDERS` table,
  `RANK_RECIPES` (the three unlockable recipes), `MOVE_BONUS`, the per-round growth
  (`ROUND_NEEDS`, `ROUND_PRICE`), `RUSH_MOVES`, `RUSH_COINS`, the royal and twin numbers
  (`ROYAL_EVERY`, `MOULD_FROM`, `ROYAL_SHARE`, `ROYAL_COINS`, `ROYAL_MOVES`, `TWIN_SHARE`,
  `TWIN_BONUS`, `TWIN_AT`, `TWIN_MOVES`), the rich numbers (`RICH_SHARE`, `RICH_MOVES`,
  `RICH_BLOCKERS`), `isRoyal`, `isTwin`, `twistFor`, `blockersFor`, `riskFor`, the
  `Standing` type and `orderFor(number, standing)`, which builds a commission's stages or a twin
  order's second customer and adds the workbench's and the difficulty's moves, the twist and a
  rich pick's risk and price.
- `src/game/exams.ts`: the `Exam` type, the `EXAMS` table, `seeded` (a mulberry32 generator),
  `examSeed(index)` and `examOrder(index, number)`, which turns an examination into an `Order` with
  `exam` set (and the difficulty's moves).
- `src/game/ranks.ts`: `STARS_3`, `STARS_2`, `starsFor(movesLeft)`, the `RANKS` table (titles as
  `TextKey`s), `rankOf` and `unlockedRecipes`.
- `src/game/upgrades.ts`: `UpgradeId`, `Upgrades`, the `UPGRADES` table (name and effect as `TextKey`s,
  the price of each level), `UPGRADE_ORDER`, `freshUpgrades`, `upgradeCost` and `buyUpgrade`.
- `src/game/board.ts`: the `Board`, `Tile` (with optional `catalyst`, `bloom`, `jar`, `resin`,
  `mould`), `Cell` and `Run` types and pure board logic: `matchKind`, `stuck`, `special`, `swapped`,
  `findRuns`, `findMatches`, `matchesAt`, `swapWorks`, `validMoves`, `collapse`, `freshBoard`,
  `shuffle`, `addBlockers`, `neighbours`, `spreadMould`, `adjacent`, `inBoard`.
- `src/game/state.ts`: `Progress`, `GameState`, `PANTRY_MAX`, `HERB_COST`, `freshProgress`,
  `progressOf`, `heldPantry`, `examOpen`, `buyHerb`, `standingOf`, `startOrder(progress, exam?)`
  (which also places the Bloom starter's Bloom and draws on the pantry, or lays an examination's
  seeded board), `tileMaker`, `wanted`, `filled(s, needs?)`, `firstNeeds`, `drawPantry`, `stockPantry`.
- `src/game/sim.ts`: `trySwap` (plays a swap out to completion through `resolve` and returns its
  `Step`s, brewing and firing specials, opening jars, melting resin and scrubbing mould in `gather`,
  then letting mould creep), `CATALYST_RUN`, the bench tools (`Tool`, `TOOLS` with price, name and tip, `TOOL_ORDER`,
  `STIR_MOVES`, `canUse`, `stir`, `sift`, `pestle`, `funnel`), `nextOrder` and `nextExam`.
- `src/game/save.ts`: `loadProgress` and `saveProgress` in `localStorage`.
- `src/scenes/BootScene.ts`: calls `bakeTextures`, then starts `Game`.
- `src/scenes/GameScene.ts`: draws everything, handles input and the tool buttons, animates steps
  and sifts, shows hints, the rank ribbon, the order's twist, stage or second-customer line, the
  caption, the pantry, the notes over the board (a served customer, a new stage), the result card
  (with its pair of buttons and its links), the workbench card and the herbalist card.
- `src/scenes/layout.ts`: `VIEW`, `BOARD`, `TRAY`, `RIBBON`, `PANEL`, `NEEDS` (with `twinY` and
  `twinRow` for a twin order's four rows), `PANTRY`, `TOOL`, `CAPTION`, `BUTTON`, `UI_DEPTH`,
  `SERIF`, `cellX`, `cellY`. It matches the approved mockup at half its 1920x1080 size.
- `src/art/nouveau.ts`: the painting toolkit: `bake` (paints in art units, twice the view, onto a
  canvas of `RES` canvas pixels per view pixel, and adds it with `textures.addCanvas`), `RES` (1, or
  up to 4 on a big screen, from `sharpRes` of the larger of the designed size and `viewSize`; the same for every texture), `shown(image, scale)` (sizes
  an image to `scale` times its texture's view size by setting its scale to `scale / RES`), the inks (`SEPIA`, `GOLD`,
  `CREAM`, `BOTTLE`...), shape helpers (`poly`, `rrect`, `whip`, `cornerOrn`, `doubleRule`,
  `goldStar`, `coin`) and `ingredient(kind, x, y, s)`, the five ingredient silhouettes.
- `src/art/textures.ts`: `bakeTextures` and the texture keys: `wall` (the bottle-green wall with its lily
  pattern and gold rules, painted at `viewSize` so it covers the whole view), `table` (the static
  960x540 layout over it: tray and cells, ribbon band, order label with its crest and "Bench tools"
  heading, painted in the hub's language at boot like the tool names), `kind-<kind>`, `catalyst-<kind>` (sunburst halo), `bloom-<kind>` (rose petal
  rosette), `jar-<kind>` (corked glass jar), `resin-<kind>` (amber coat), `mould-<kind>` (grey-green
  fuzz of spots), `need-<kind>`,
  `potion-<id>` (flask coloured from `BREWS`), `coin`, `star-on`, `star-off`,
  `tool-<tool>-<on|off|armed>`, `button`, `cursor`, `band` (a row), `band-col` (a column), `area`
  (a Bloom's 3x3), `sun`, `result-card`. Also `kindTexture`, `tileTexture`, `needTexture`,
  `potionTexture`, `toolTexture`, `POTION_ORIGIN`, `TOOL_PAD`.
- `src/audio.ts`: `SONG`, the waltz and its stings, and `sfx`, the sound table (see Sound).
- `src/ui/Button.ts`: `makeButton`, the bottle-green cartouche on the result card.
- `shared/setupGame.ts` and `shared/settings.ts` (outside the game folder): the hub's settings,
  imported by `src/main.ts`, `src/game/orders.ts` and `src/scenes/GameScene.ts`.
  `shared/scaling.ts`: `setupScaling` (from `src/main.ts`), `sharpRes` (from `nouveau.ts`) and
  `renderScale` (text resolution in `GameScene` and `Button.ts`). `shared/i18n.ts`: `translator`,
  `byLanguage`, `Translation` and `formatNumber` (the coins).

### How it runs

- **Boot:** `BootScene.create` paints every texture (see the file map). There are no asset files.
- **Start:** `GameScene.create` scrolls the camera by `-viewFrame(this)`'s x and y, so the designed
  960x540 layout sits in the middle of the view, adds the `wall` image at the view's top-left and the `table` image and the persistent UI (ribbon texts and bar,
  moves, stars and coins, the tool buttons, the caption, the result card), then
  `begin(startOrder(loadProgress()))`. `begin` replaces `state`, destroys and recreates one image per
  tile (keyed by tile `id` in `sprites`), rebuilds the order label (`buildPanel`) and hides the
  cards. The pantry line, the note over the board, the result card's workbench link and the
  workbench card are made the first time they are needed (see Gotchas: a Text costs a
  `Math.random` call).
- **Input:** the scene's `pointerdown` listener skips taps on a game object (a tool button or the
  result button), so the same tap doesn't also pick a tile. `pointerDown` maps the pointer to a cell
  with `cellAt`, from `pointer.worldX/Y` (game pixels; `pointer.x/y` are canvas pixels). While a tool is `armed`, the tap goes to it: Sift rerolls the cell's row, Pestle
  smashes the cell, Funnel picks `funnelFrom` and then swaps it with the next cell. Otherwise a tap on a jar, resin or
  mould tile plays `ui('refuse')` and changes nothing (no pick, and a pick already made stays), the first tap sets
  `selected`, a tap on a neighbour calls `swap`, a tap on the same tile clears it. `pointerMove`
  swaps once a drag goes half a cell. `swap` clears the drag start, so a held second tap of a
  tap-tap swap that drags after the board settles does not swap again. A swap (or drag) with a jar, resin or
  mould tile does nothing but play `ui('refuse')`, and keeps `selected`. Input is ignored while `busy` or when `state.phase` is not `play`.
- **Rules then animation:** `swap` calls `trySwap`, which mutates `state` right away (board, moves,
  `got` and the counters, phase, coins, stars). The scene then queues `Anim`s: a slide, the slide
  back if there was no match, or for each `Step` a pop of the cleared tiles (wanted ones fly to
  their need row, by the step's own `needs`; the fired rows', columns' and Bloom squares' bands
  blink; brewed, melted and scrubbed tiles swap texture; a step that clears nothing (a Pestle
  that only melts or scrubs, or a run whose other tiles were all resin-held) swaps the brewed, melted
  and scrubbed tiles' texture with its brew, sizzle or scrub) and a `moveTo` of the new board; a step
  with `spread` swells the tile mould crept onto, one with `served` or `stage` shows a note over the
  board (and a new stage rebuilds the label); then `settle`.
- **Catalysts:** `gather` in `sim.ts` takes `findRuns`, adds the whole row of every matched
  Catalyst, then for each run of `CATALYST_RUN` (4) or more keeps one tile on the board as a
  Catalyst: on the swap's own match the moved tile if it is in the run, otherwise the middle of the
  run's free tiles (not special, not resin, not in a cleared row or square). Before that, every
  pair of an across and a down run of one kind that share a cell brews a Bloom on that cell (if it
  is free) and those two runs brew no Catalyst. A matched Bloom adds the 3x3 around it. Specials
  match by `kind` like any tile, and only fire when they are in a run (or smashed by the Pestle);
  ones swept up by a row or square are just gathered. A swap of two specials (`swapWorks` allows
  it without a match) passes `trySwap` the `Extra` from `mixed`: two Catalysts the row and column
  through the moved one's cell, a Catalyst and a Bloom that row and its neighbours, two Blooms the
  5x5 around it (`bursts`, which the scene lights with the `area` texture at 5/3 size). The two
  specials are swept, not fired, though one that also lands in a run fires as usual.
- **Blockers:** `startOrder` calls `addBlockers` with the order's `jars`, `resin` and `mould` (none
  on order 1, so its `Math.random` calls are unchanged). `matchKind` is null for jars and mould, so
  `findRuns` never matches them; `stuck` tiles (jar, resin or mould) can't be swapped, funnelled or
  shuffled. In `gather`, hit resin tiles leave the cleared set and lose `resin` (`melted`), every
  mouldy tile that is hit or next to a hit, brewed or melted cell leaves the cleared set and loses
  `mould` (`scrubbed`), then every jar next to such a cell (or itself hit) is added to the cleared
  set and its kind gathered. `collapse` keeps resin tiles in their cell and drops the others past
  them; mouldy tiles fall. After a swap's steps, if the order is still being played and no step
  scrubbed mould, `trySwap` calls `spreadMould`: one random mouldy tile grows onto a random plain
  neighbour (not held, not a special) that leaves a move on the board, as a last step with
  `spread`. Tools never spread mould.
- **Twists:** `twistFor` gives order 3, 6, 9... `rush` and 4, 7, 10... a `forbid` kind not in its
  needs (on a royal commission, not in any stage's needs; none if every kind is needed). `orderFor` takes `RUSH_MOVES` off and adds `RUSH_COINS` to the price. `resolve` takes one
  extra move (`penalties`) when called with `charge` (only `trySwap` does) and the swap's own first
  step matches the forbidden kind; cascade steps and tools (Pestle, Funnel) never cost one. The step
  that did it has `penalty`, and the scene pulses the moves (`penalised`, from `swap`).
- **Only wanted ingredients:** `gather` increments `got` only for kinds in the order's needs
  (`wanted`), so other kinds stay 0. `got` keeps counting past a need; the surplus goes to the
  pantry on a sale or stage change (`stockPantry`), up to `PANTRY_MAX` a kind, and the next order
  or stage that needs the kind starts with it (`drawPantry`, never within one of filling a need, so
  no order starts filled). `fromPantry` and `toPantry` on the state feed the caption and the result
  card.
- **Royal commissions:** `orderFor` gives every `ROYAL_EVERY`th order `stages` (the next three
  recipes of the round at `ROYAL_SHARE`), `needs` and `potion` of the first and `ROYAL_MOVES` more
  moves. After each swap or tool `resolve` moves `s.stage` on while the stage is filled: it stocks
  the pantry, sets `current.potion` and `current.needs` from the stage, zeroes `got`, draws on the
  pantry and pushes a step with `stage`. The sale comes once the last stage is filled. The
  commission played with every recipe unlocked (`unlocked.length === 3`) and `royal` false is
  `last`; its sale sets `royal`, which the ribbon and the result card show.
- **Twin orders:** `isTwin` from Journeyman on every `ROYAL_EVERY`th order after `TWIN_AT`.
  `needs` holds both customers' kinds (always different kinds, two each: the first customer's are
  `firstNeeds(order)`, the second's `order.second.needs`), so `gather` and `filled` work unchanged.
  `resolve` adds a customer to `served` once its kinds are filled, setting `speedBonus` to
  `TWIN_BONUS` when the other isn't yet (added to `coins` only with the sale, so a failed order
  banks nothing), and pushes a step with `served`. Twin orders get no
  twist.
- **Result card:** `showResult(title, text, rank, choices, stars)` shows the single `resultButton`
  (made in `create`) for one choice, or the `resultPair` (made the first time) for two.
  `orderChoice` offers Modest and Rich (`pick` sets `rich`, saves and starts the next order) and
  sets `resultCaption`, which `refreshCaption` shows while the card is up; `examRetry` offers a
  retry of the examination or the orders. `refreshLinks` lays out the Workbench, Herbalist and
  Guild examination links (the last only while `examOpen`).
- **Rich orders:** `orderFor` reads `standing.rich` (never on order 1) and `riskFor(number)`: it
  takes `RICH_MOVES` off or adds `RICH_BLOCKERS` jars and resin (and one mould when the order has
  mould), then adds `RICH_SHARE` of the price; `rich` on the order says which. The label's price
  line says "rich order" and the caption names the risk (`captionRichBlockersMould` and
  `captionPickRichBlockersMould` add the mould patch when that order has mould).
- **Herbalist:** `openHerbs` (the result card's link) shows a column per kind; `buyHerb` in
  `state.ts` adds one to `heldPantry(s)` (the pantry after a sale, `startPantry` after a failure,
  which is what `progressOf` saves) and the scene saves and redraws. Kinds the next order needs
  (from `orderFor` with the current standing) are marked.
- **Guild examinations:** `nextExam` starts `startOrder(progress, true)`: `examOrder(seals)` and a
  board laid by `freshBoard` and `addBlockers` from `seeded(examSeed(seals))`, with no Bloom starter
  and no pantry draw; refills use `Math.random` as usual. `resolve` sells a filled examination
  without touching `order`, `sold`, `stars` or the pantry: `passed` is `orderStars >=
  exam.stars`, which pays `price + moves * MOVE_BONUS` and adds a seal, otherwise `earned` is 0.
  `nextOrder` afterwards goes back to the orders. The ribbon draws one circle per `EXAMS` entry
  after "Guild seals", filled for each seal.
- **Workbench:** `openBench` (the result card's link) shows the workbench card with a row per
  `UPGRADE_ORDER` entry; `buy` calls `buyUpgrade`, saves and redraws. `standingOf` passes
  `upgrades.hands` to `orderFor` as `extraMoves`; `gather` reads `upgrades.catalyst` to sweep a
  fired Catalyst's column (`cols`); `startOrder` reads `upgrades.bloom` to brew one Bloom on a
  random free tile of the new board.
- **Bench tools:** four buttons in `TOOL_ORDER`, `TOOL.gap` apart. `useTool` (a button's
  `pointerdown`) checks `canUse`; Stir calls `stir` and saves; the others toggle `armed`. Sift's
  board tap calls `siftRow`, which calls `sift` (new tiles for the row, specials, jars, resin and mould
  kept, rerolled until nothing matches and a move is left, else a shuffle; a row with nothing but kept
  tiles is refused and costs nothing), saves and animates the
  row fading out and growing back. Pestle's tap calls `pestle` and Funnel's second tap `funnel`
  (which refuses two plain tiles of one kind, a swap that changes nothing, and sets two specials off
  together with `mixed`, as `trySwap` does, adding the first cell to its area so both are used up even
  when the tiles are far apart); both go through `resolve` with no move spent (so a tool can sell the order) and the scene plays
  them in `playTool`. Buttons show `on`, `off` (not affordable or not playing) or `armed`; hovering
  one shows its `tip` in the caption (`refreshCaption`, which otherwise shows the armed tool's
  instruction or a tip for the order: forbidden kind, blockers, rush, then the specials).
- **Tick:** `update(time)` takes `dt` from Phaser's frame timestamp, clamped to `MAX_STEP_MS`, and
  feeds `runQueue` (plays queued `Anim`s in order, by game time) and `updateHint`.
- **Rendering:** tile sprites are long-lived and moved by animations, not redrawn. Depths: wall and table 0,
  bands 1.5, cursor 1.8, Catalysts and Blooms 1.9 (their halos sit under the neighbours), tiles 2,
  resin 2.1 (tiles fall behind it), panel 3, tiles flying to the label 4, result card `UI_DEPTH`. `refresh` redraws the need bars (`bars` graphics), moves, live stars and
  rule line, the rank ribbon, the tool looks, the coins, the caption and the cursor, and puts the
  Catalyst row bands back when not busy (`showBands`; they are hidden while tiles move). The bars
  follow `shown`, a copy of `got` that catches up as each pop finishes, so the panel lags `state`
  until `settle`. `settle` clears `busy`, saves on a sale and shows the result card.

### State model

- `Progress` (`order`, `coins`, `sold`, `stars`, `pantry`, `upgrades`, `royal`, `seals`, `rich`) is
  what is saved and carried between orders.
- `GameState` extends it with `current` (the `Order` from `orderFor`, whose `potion` and `needs`
  follow the stage on a royal commission), `got` (per-kind counts for this order or stage),
  `moves`, `phase` (`play`, `sold`, `failed`), `earned`, `orderStars` (0 until sold), `brewed` and
  `fired` (Catalysts this order), `bloomed` and `bloomsFired`, `opened` (jars), `melted` (resin),
  `scrubbed` (mould), `penalties` (moves lost to the forbidden kind; `fired`, `bloomsFired`, `opened`,
  `melted`, `scrubbed` and `penalties` are only kept for debugging and the test's log), `stage`, `served`,
  `speedBonus`, `fromPantry`, `toPantry`, `startPantry`, `passed` (an examination sold with its
  stars), `board` and `nextId`.
- `Board` is `Tile[][]`, rows from the top. Each `Tile` has a unique `id` from `nextId`, which
  restarts at 1 for every order; the scene relies on ids to track sprites through falls. A brewed
  Catalyst or Bloom keeps its tile's id and gains `catalyst` or `bloom`; a melted tile keeps its id
  and loses `resin`, a scrubbed one loses `mould` and one mould crept onto gains it.
- Only `trySwap`, `stir`, `sift`, `pestle`, `funnel`, `buyHerb`, `buyUpgrade` and `startOrder` /
  `nextOrder` / `nextExam` change the rules state (and `pick` sets `rich`); the scene owns only view state (`busy`, `selected`, `armed` (with the `sifting`
  getter), `funnelFrom`, `shown`, the queue, hints).
- Invariants: a new, shuffled or sifted board has no matches and at least one valid move; `trySwap`
  returns `null` and changes nothing for a swap that makes no match; on a sale `order` already
  points at the next order, `earned = price + moves * MOVE_BONUS`, `orderStars = starsFor(moves)`
  and `stars` includes it. A failed order keeps the same `order`, so "Try again" replays it on a new
  board. `progressOf` returns `startPantry` (the pantry as the order found it) until the order
  sells, so a retry or a reload after a tool purchase gives back what the order drew. The order's
  recipe list comes from `unlockedRecipes(stars)`, so order 1 with no stars is always the Healing
  Draught, with no pantry, no upgrade and no mould.

### Persistence

Two keys of its own. `tincture-tinker-trophies` holds the trophies earned (`shared/trophies.ts`),
each id with the time. `tincture-tinker-progress` holds the JSON `Progress`. `loadProgress` merges
it over `freshProgress()`, puts back the default of any field that is out of range (`order` and
`stars` must be whole numbers, from 1 and 0; `coins` and `sold` finite numbers from 0; `pantry`
keeps only known kinds with whole counts from 1, capped at `PANTRY_MAX`; `upgrades` only known
ids with whole levels capped at their top; `royal` must be exactly `true`; `seals` a whole number
from 0, capped at `EXAMS.length`; `rich` exactly `true` and only from order 2) and falls back to a
fresh start on any error. Saves from before stars, the pantry, the workbench, the royal title, the
seals or rich orders existed load with their defaults. The hub's settings are stored separately under `hub-settings`.

### Randomness and timing

- `Math.random` is used in `randomKind` (new tiles, the rerolls in `freshBoard` and `sift`), in
  `shuffle`, in `addBlockers` (only for orders with jars, resin or mould), in `spreadMould` (only
  when mould is on the board) and in `startOrder` for the Bloom starter (only once bought). A guild
  examination's starting board comes from its own `seeded` generator instead, passed to
  `randomKind`, `freshBoard` and `addBlockers` as `rand`. The order and number of calls decide the board the seeded test sees; a brewed Catalyst
  means one fewer new tile, and a fired row more. Phaser's `Text` objects also take one call each
  (their canvas texture's key), see Gotchas.
- Animation and hint timing use only the `time` argument of `update`; the hint swell, the mould
  creep and the notes over the board use the scene's own `clock` and queue. The Stir pulse and the result card's fade are Phaser tweens (game clock).
  Nothing uses `Date` or `setTimeout`. Textures are painted without randomness.
- The hint picks `validMoves(board)[0]`, so it is deterministic.

### Data tables

- Orders, unlockable recipes, prices, move limits, growth per round and `MOVE_BONUS`:
  `src/game/orders.ts`. Ranks and star thresholds: `src/game/ranks.ts`. Tool prices and Stir's
  moves: `TOOLS`, `STIR_MOVES` in `src/game/sim.ts`; Catalyst run length: `CATALYST_RUN`. Rush
  numbers, the twist cycle and the jars, resin and mould per order: `RUSH_MOVES`, `RUSH_COINS`,
  `twistFor`, `blockersFor` in `src/game/orders.ts`. Royal commissions and twin orders: `ROYAL_*`,
  `TWIN_*`, `MOULD_FROM` there too. Workbench upgrades and prices: `UPGRADES` in
  `src/game/upgrades.ts`. The pantry's cap and the herbalist's price: `PANTRY_MAX`, `HERB_COST` in
  `src/game/state.ts`. Rich orders: `RICH_*` and `riskFor` in `src/game/orders.ts`. Guild
  examinations: `EXAMS` in `src/game/exams.ts`.
- Ingredient kinds and names: `src/game/kinds.ts`. Board size: `ROWS`, `COLS` in
  `src/game/board.ts`.
- Animation and hint timings: `SWAP_MS`, `CLEAR_MS`, `FALL_MS`, `SHUFFLE_MS`, `SIFT_MS`, `HINT_MS`,
  `MOULD_MS`, `NOTE_MS`, `MAX_STEP_MS` at the top of `src/scenes/GameScene.ts`. Every text (captions,
  the label's lines, the result card, the royal title) is in `src/i18n/`.
- Positions and sizes: `src/scenes/layout.ts`. Text offsets in the order label, the footer, the
  result card, the workbench card and the herbalist card are inline in `GameScene` (`buildPanel`,
  `createFooter`, `createResult`, `createPair`, `refreshLinks`, `createBench`, `refreshBench`,
  `createHerbs`, `refreshHerbs`), taken from the mockup at half scale. Potion
  colours: `BREWS` in `src/art/textures.ts`.

### Hub settings

- `src/main.ts` calls `setupGame(game)` from `shared/setupGame.ts` right after creating the game,
  which applies the frame cap, the FPS readout, reduced motion and full screen (camera shake and flash become
  no-ops; this game uses neither).
- Difficulty scales one number: the moves of every order. `orderFor` in `src/game/orders.ts` adds
  `byDifficulty(5, 0, -3)` to the order's `moves` (before a rush order's cut, never below 5), so Easy gives 5 more, Normal the table's value
  and Hard 3 fewer. `examOrder` does the same for the guild examinations. `ORDERS`,
  `RANK_RECIPES` and `EXAMS` themselves are unchanged.
- `settings.reduceMotion` is read in `GameScene`: the hint tiles hold a fixed larger scale instead
  of swelling, a fired Catalyst's row band holds steady instead of blinking, brewed Catalysts don't
  bounce, a tile mould creeps onto doesn't swell, Stir doesn't pulse the moves and the result card
  appears without its fade.
- Keep Normal exactly as designed: the playthrough runs on Normal and expects `ORDER_1.moves`.
- Keep the TinctureTinker row of the difficulty table in the root `README.md` and the difficulty
  sentence in this game's `README.md` in sync with the values.
- The settings live under the `hub-settings` storage key, read once at page load, not in the
  game's own save.
- Screens: `setupScaling` draws the canvas at the screen's resolution (`renderScale` canvas pixels
  per game pixel, every camera zoomed to match) and asks to turn a phone held upright. With
  `fill: true` the view grows from 960x540 to the screen's shape (up to 1296x540 or 960x720): the
  whole layout keeps its 960x540 coordinates and the one camera's fixed scroll (`-viewFrame` x/y,
  set once in `create`) centres it, while the `wall` texture fills the view around it. Input reads
  `pointer.worldX/worldY`, so it follows the scroll; at exactly 960x540 the scroll is 0 and
  nothing moves. Textures are painted at `RES` (`sharpRes` of the view) and shown with
  `shown`, texts at `Math.max(2, renderScale)`. `e2e/screens.spec.ts` at the root checks the game
  on five screens.

## Testing hooks

- Dev builds expose `window.game`. The test reads `game.scene.getScene('Game')` and copies `state`,
  `busy` and `selected` from it as JSON. Keep those names and their meaning (`armed` and `sifting`
  are there too, for docs scripts).
- It seeds `Math.random`, owns the clock (64ms frames) and forces the canvas renderer.
- After the sale it checks that `tincture-tinker-trophies` holds First tincture, plus Chain
  reaction, In full bloom and Flawless when the order fired a Catalyst, fired a Bloom or earned
  three stars, and nothing else; a trophy a first order can reach in another way changes that
  expectation.
- Inputs are mouse clicks on cell centres, computed from its own copy of `VIEW` and `BOARD`
  (`x: 46, y: 46, cell: 56, size: 8`), and one click on the middle of Stir (`STIR`, from `TOOL`:
  `x: 560, y: 393, w: 80, h: 43`).
  It never drags.
- Steps: checks the first order (`ORDER_1`: healingDraught, ember 12 and sage 12, 15 moves, 30
  coins, no jars, resin, rush or forbidden kind, and no jar or resin tile on the board), that the
  new board has no matches and `got` is all zero; taps a horizontal swap that makes
  no match and checks `selected`, an unchanged board and unchanged moves; taps Stir with 0 coins and
  checks moves and coins are unchanged and no tile is picked; then repeatedly taps its `bestSwap`
  and waits for `busy` to clear, checking one move is spent, kinds the order doesn't need stay at
  0 in `got`, at least the first match's tiles of the needed kinds are gathered less one per Bloom
  (an across and a down run of a kind crossing) and per other run of four or more (the Catalyst it
  keeps) and, when no Catalyst or Bloom is in that match, `brewed` and `bloomed` grew by those
  counts; finally checks `phase: 'sold'`, `earned`,
  `coins`, `sold: 1`, `order: 2`, `orderStars = starsFor(moves)` and `stars = orderStars`. On the
  seeded board a Catalyst is brewed on swap 4 and fired on swap 6, and swap 8 brews a Bloom.
- Keep in sync: `ORDER_1` (Normal's moves, with no workbench upgrade), `MOVE_BONUS` and `starsFor`
  with `src/game/orders.ts` and `src/game/ranks.ts`; `STIR` with `TOOL` and `TOOLS.stir.cost`;
  `VIEW` and `BOARD` with `src/scenes/layout.ts` and `ROWS`/`COLS`; the `Kind`, `Tile` and
  `GameState` shapes declared at the top of the test; the game's URL path in the test's `page.goto`.
- Bench tools, the workbench, the herbalist, rich orders, guild examinations, mixed specials,
  ranks above Apprentice, blockers, mould, twists, royal commissions, twin orders and the pantry
  stay out of the playthrough (purchases are not part of the first
  round, and order 1 has no blockers or twist and starts with an empty pantry; what its sale puts
  in the pantry is not checked).

## Sound

All of it is made in code by `shared/audio.ts`; `GameScene` plays it and `src/game/` stays silent.
Nothing plays while a board is laid out (`begin`, a reload or a retry), and nothing at all under
browser automation, so the playthrough is unchanged.

**Song** (`SONG` in `src/audio.ts`): a music-box waltz in F major at 90 beats a minute in 3/4, with a
triangle lead, a thin `pulse12` arpeggio and a triangle bass. It is written at `bpm: 60` with
`steps: 3`, so a step is an eighth note and the engine's bar (12 steps) holds two waltz bars.
`refreshMoves` picks the part on every refresh with `playMusic`, which switches at the next bar:

| Part | When |
| --- | --- |
| `calm` | every order (sixteen bars, no drums) |
| `royal` | a royal commission or a guild examination: a statelier waltz with soft kick and hats |
| `tense` | three moves or fewer left while playing: D minor, running eighths and busier hats |
| `sold1`, `sold2`, `sold3` (stings) | a potion sold (`showSold`): a cadence and one chime per star |
| `rank` (sting) | a sale that reaches a new rank, or a guild examination passed |
| `crown` (sting) | the crown's last order sold: Royal Apothecary |
| `fail` (sting) | out of moves (`settle`), or an examination sold with too few stars |

**Effects** (`sfx` in `src/audio.ts`, plus the shared `ui`):

| Sound | Where |
| --- | --- |
| `pick` | a tile picked or let go (`pointerDown`), a Funnel tile picked (`pickFunnel`) |
| `swap` / `bonk` | every swap (`swap`) / the slide back of one that matches nothing |
| `pop` | each step that clears tiles, in its `start` (`stepSounds`), pitch up 12% per cascade step |
| `tink` | gathered ingredients reaching the label, at the end of the step |
| `brew` | a Catalyst or Bloom brewed in the step |
| `fire` / `burst` | a fired row, column or Bloom square / a 5x5 of two Blooms |
| `cork`, `sizzle`, `scrub` | a jar opened, resin melted, mould scrubbed in the step |
| `spread` | mould creeping onto a tile (the `spread` step) |
| `penalty` | a swap whose own match had the forbidden kind (`penalised`) |
| `shuffle` | a step whose board was shuffled |
| `served` / `stage` | a twin order's customer served / a royal commission's next stage |
| `stir`, `sift`, `pestle`, `funnel` | the bench tools, when they act (`useTool`, `siftRow`, `usePestle`, `pickFunnel`) |
| `stamp` | a guild seal won (`showSold`) |
| `hint` | the idle hint appearing (`updateHint`) |
| `ui('click')` | a tool picked up or put down, the result card's buttons and links, Back |
| `ui('coin')` | a workbench upgrade or a herb bought |
| `ui('refuse')` | a swap with a jar, resin or mould tile, a tool that can't be used or afforded, a Pestle or Funnel tap that can't act, a Sift that can't reroll (or a row with nothing to reroll), an upgrade not affordable |

## Making common changes

- **Add or change a text:** its key in `src/i18n/en.ts`, the German in `src/i18n/de.ts` (the build
  fails without it) and, when the US spelling differs (mould, neighbour), the US one in
  `src/i18n/en-US.ts`; run `node scripts/check-translations.mjs`. German runs longer than English:
  the rank ribbon's "Next" line, the twin order's second-customer line, the workbench's effect lines
  (beside their buttons), the herbalist's Buy links (76px apart) and the tool names on the buttons
  (painted at boot) are the tightest spots, so check a new text with `?lang=de`. Changing the number
  of Phaser Texts shifts the seeded boards (see Gotchas); swapping their strings does not.
- **Add or retune an order:** edit `ORDERS` in `src/game/orders.ts` (its `moves` are Normal's;
  `orderFor` adds the difficulty's). A new potion needs a `PotionId`, a `POTION_NAMES` entry (its name in the `src/i18n/` files) and a
  colour in `BREWS` in `src/art/textures.ts`. Changing the first entry means updating `ORDER_1` in
  the test and the README's table. Keep orders to three needs: the label has room for three rows
  above the bench tools.
- **Add a rank or an unlockable recipe:** add the recipe to `RANK_RECIPES` (and its potion as above)
  and a row to `RANKS` in `src/game/ranks.ts` with its star threshold; update the README's tables.
- **Retune a bench tool:** `TOOLS` / `STIR_MOVES` in `src/game/sim.ts` (the button texture prints
  the name and price from `TOOLS`; the caption shows its `tip`), plus `STIR.cost` in the test. A
  fifth tool needs a narrower `TOOL` in `layout.ts` (and the test's `STIR`), its icon in
  `paintTool` and its handling in `useTool` / `pointerDown`.
- **Retune blockers or twists:** `blockersFor` and `twistFor` in `src/game/orders.ts`. Keep order 1
  plain, or the playthrough's first board and its checks change.
- **Retune royal commissions or twin orders:** `ROYAL_*` and `TWIN_*` in `src/game/orders.ts`
  (`isRoyal` / `isTwin` say which orders they are; keep them off order 1). The stage and customer
  logic is in `resolve` in `src/game/sim.ts`; the label's lines and rows in `buildPanel`.
- **Add a workbench upgrade:** add its id to `UpgradeId`, `UPGRADES`, `UPGRADE_ORDER` and
  `freshUpgrades` in `src/game/upgrades.ts`, then read its level where it acts (`orderFor`,
  `gather` or `startOrder`). The workbench card lays its rows out 36px apart; a fourth row needs
  `refreshBench` and the card's title and button moved.
- **Retune the pantry:** `PANTRY_MAX` in `src/game/state.ts`; `drawPantry` decides how much an
  order may start with. The herbalist's price is `HERB_COST` there too.
- **Retune rich orders:** `RICH_SHARE`, `RICH_MOVES`, `RICH_BLOCKERS` and `riskFor` in
  `src/game/orders.ts`; the result card's caption and the label read them.
- **Add or retune a guild examination:** an entry in `EXAMS` in `src/game/exams.ts` (moves are
  Normal's). Its board follows from `examSeed(index)`, so inserting one changes the boards of
  those after it. The ribbon has room for about ten seals; update the README's table.
- **Add an ingredient kind:** add it to `KINDS`, `KIND_NAMES` and `KIND_COUNTS` in `src/game/kinds.ts` (with its texts in
  `src/i18n/`), its shape
  in `shapes` and colours in `COL` in `src/art/nouveau.ts`, and the `Kind` type in
  the test. More kinds change every seeded board, so rerun the playthrough and check order 1 still
  sells.
- **Add a special tile:** add its flag to `Tile` (and to `special` or `stuck` in `board.ts`),
  decide its effect in `gather` in `src/game/sim.ts`, record it in `Step`, paint its texture in
  `textures.ts` (and pick it in `tileTexture`) and animate it in `GameScene.playStep`. Mould is the
  model for a blocker that changes after the steps (`spreadMould`, a step with `spread`).
- **Add a sound:** an entry in `sfx` in `src/audio.ts` and a call where it happens in `GameScene`
  (for a board event, in `stepSounds` or the step's own `start`, so it plays in time with the
  animation; once per step, never per tile). Add it to the Sound table above.
- **Move or resize the board:** change `BOARD` and `TRAY` in `src/scenes/layout.ts` and the test's
  `BOARD`; the table texture paints from these.

## Gotchas

- Every image of a baked texture goes through `shown(image, scale)`, never `setScale` or a bare
  `add.image`: with `RES` above 1 the texture is that many times bigger than it is meant to look.
  Hit areas given in texture pixels (the tool buttons') are multiplied by `RES` too. Read pointers
  through `worldX/Y`, and lay anything new out with `viewSize(scene)`, not `scene.scale`.
- `trySwap` finishes the whole swap at once, so `state` is ahead of the screen while the animation
  plays. Wait for `busy` to be false before reading the result, as the test does.
- `moveTo` and the pop animation look sprites up by tile id when they start, because cascades clear
  tiles that only appear in an earlier step. Don't resolve sprites when queueing.
  `moveTo` also destroys sprites whose ids are not on its board, which only happens when `shuffle`
  gives up and returns a fresh board with new ids.
- Any change to how often `Math.random` is called (board generation, refills, shuffle, Catalysts)
  changes the seeded boards. The test plays a greedy `bestSwap`, so a different board might not
  fill order 1 in 15 moves. Rerun the playthrough after such a change. That includes creating a
  Phaser `Text`: each one takes a `Math.random` call for its canvas texture's key, so a Text made in
  `create` before `begin` shifts the first board, and one made between the first board and the sale
  (in `begin`, `refresh` or an animation) shifts the refills. The pantry line, the notes, the
  result card's pair of buttons and links, the workbench card and the herbalist card are
  therefore made the first time they are needed, which on
  a fresh save is after order 1 sells; `buildPanel` makes the same number of Texts for order 1 as
  before.
- The test's `deadSwap` looks only at horizontal neighbours of different kinds, and its `runs` and
  `matched` mirror `findRuns` / `findMatches`. Changing what counts as a match needs both updated.
- Don't rotate tile sprites: in headless Chromium's software WebGL, slightly rotated canvas
  textures render torn, which is why the hint swells instead of wiggling.
- Progress is saved in `settle` (after the sale animation), in `useTool` / `siftRow`, in `playTool`
  (Pestle and Funnel), in `buy`, `buyHerb` and `pick`, not in `trySwap`. A sale clears `rich`, so a
  rich pick lasts one order. A twin order's speed bonus is added to `coins` only on the sale.
- `got` counts only the kinds in `needs`; the pop animation uses the step's own `needs` (a royal
  commission's needs change between steps), so a tile of another kind never moves a bar.
- Mould never matches, so it can't be swapped into a run, but a Catalyst row, a Bloom square or the
  Pestle can hit it: it is scrubbed, never gathered. `spreadMould` only grows onto plain tiles and
  keeps a valid move on the board, so a board can't be mouldered shut; once every patch is scrubbed
  the order has no more mould.
- A resin tile in a run only melts, so the same run can match again on the next cascade step:
  `gather` loops until no run is left, and every run has at least one tile that isn't resin
  (resin never moves and starts on a board with no matches).
