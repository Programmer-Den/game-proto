# Shrine Stack: guide for agents

How Shrine Stack is built and where things stand, for agents changing it. README.md covers how to
play and the blessings. Keep this file up to date with any change to the game, per the root
AGENTS.md.

## Current state

Shrine Stack is a one-button stacking game. A temple starts with the pick of one of two patrons,
whose boon and bane hold for the run. A stone swings left and right above the temple; a tap
drops it, the part hanging over the stone below breaks off, and the next stone is as wide as what
is left. Every three stones make a tier; a balanced tier (every stone kept at least `BALANCE` of
its width) earns favor and offers three blessings, one of which the player keeps; favor rerolls
the offer or buys one-time help, and a curse taken with the blessing doubles the next tier's
favor. From tier 2 stones come heavy or light, each tier sets a trial and a stone can be held in
reserve. From tier 3 the temple leans with every off-centre drop (too far and the tier topples), a
chain of perfect drops grows the stone back, and each break picks the next tier's material. Tier 10
is gilded (double favor) and finishing tier 12 crowns the shrine and wins; the player can then keep
building into an endless, gusty sky, where every tenth tier is a sky altar (double favor and a
blessing even when wobbly).

Implemented today:

- One screen (`GameScene`): a dusk sky with stars, moon, parallax mountains and clouds; the hill
  and the stepped plinth; the temple, with a camera that follows its top up; the swinging stone
  and a dotted drop guide; a left panel with the patron, the tier, tier pips, favor, built and
  best, the next stone's kind, the reserve ("Hold:" and a Swap button), the trial, the curse in
  force and the material of the tier, the lean meter, blessings, the goal box (a pip per tier up to
  `GOAL_TIER`, the gilded one framed) and a rules blurb; popups ("+1", "Perfect! +3", "Regrown +12",
  the kind swapped in); tumbling debris for cut pieces, missed stones and toppled tiers; gold trim
  and lanterns on balanced tiers; a banner for the patron, wobbly tiers, chosen blessings, Mason's
  Grace, a topple, the gilded tier and the crown; the patron pick before the first stone (two cards
  over a dim); the break between tiers (blessing cards, three or four, with a Reroll button, the
  material row from tier 3, the curse toggle and the favor shop; with no blessing only the material
  row, the shop and "Build on"); heavy (darker, iron-strapped) and light (pale, porous) stones;
  marble (pale, veined), sandstone (warm, grained) and basalt (dark, pitted) stones; gilded stones
  (leaf gold, `GILT`) on tier `GILDED_TIER`; a gold crown on the finished shrine; gust streaks by
  the stone and a gust readout at the top when a gust blows; and an end panel (fallen or crowned,
  the crowned one with "Keep building") with "Build again".
- Five blessings (`BLESSINGS` in `src/game/blessings.ts`), offered three at a time (four under the
  Many-Handed, never Mason's Grace under the Gilded Hand), repeatable.
- Swing speed rises 5% per tier (`TIER_SPEEDUP`); `swingSpeed` adds the stone's kind, Basalt, a slow
  drop and Haste on top of `speed`, which stays the tier's speed (with the patron's pace in it).
- Reroll: `reroll` spends `REROLL_COST` (5) favor for a new offer (and a new curse, untaken:
  `cursed` resets) while choosing.
- Favor shop (SS1): `buy` spends favor during a break on `SHOP` items (`src/game/catalog.ts`),
  each once per break (`bought`): `slow` (the stone in hand swings at `SLOW_MULT`, cleared when it
  lands), `wider` (top stone grows `WIDER_PX`, up to `PLINTH_W`) and `grace` (+1 grace). `shopFor`
  lists the items the patron allows. A wobbly tier opens a break with an empty `offer` when
  `favor >= CHEAPEST`, and from `MATERIAL_FROM_TIER` every tier does; `buildOn` ends it.
- Stone kinds (SS2): from tier `KINDS_FROM_TIER` (2) a stone is `heavy` (`HEAVY_CHANCE`, swings at
  `KIND_SPEED.heavy`, a non-perfect drop cracks `HEAVY_CRACK` more off) or `light`
  (`LIGHT_CHANCE`, `KIND_SPEED.light`, `LIGHT_FAVOR` more favor); `nextKind` is rolled in `spawn`.
- Trials (SS3): from tier `TRIALS_FROM_TIER` (2) every tier gets a `trial` (`perfect`: three
  perfect drops, or `keep`: every stone keeps `TRIAL_KEEP`), rolled when the tier before finishes;
  meeting it adds `TRIAL_FAVOR` (times `favorMult`).
- Endless sky (SS4): `keepBuilding` after the crown sets `endless` and spawns the next stone; each
  stone then gets a `wind` from `gust` (chance `GUST_CHANCE`, strength `WIND_BASE` +
  `WIND_PER_TIER` per tier past 13, up to `WIND_MAX`) that pushes it sideways while it falls.
- Sky altars: every `ALTAR_EVERY`th (10th) tier past `GOAL_TIER` (22, 32, ...; `isAltar`,
  `nextAltar`) earns `ALTAR_MULT` (2) times the favor (in `gild`, like the gilded tier) and, when
  finished, counts in `altars`, pushes an `altar` event and rolls `offer` and `curseOffer` even when
  wobbly (`blessed` in `land`). The scene draws its stones cloud-silver (`ALTAR_STONE`, with a
  silver line and two stars), trims it like a balanced tier on `altar` (with a `gong`), plays the
  `gilded` part while it is built, titles the break `altarBlessing`, announces the tier when it
  starts (`tierNotice`, `altarTierFavour`) and, in the sky, swaps the goal box's last line
  (`goalNote`) for the next altar (`altarGoal`).
- The temple leans (SS6): from `LEAN_FROM_TIER` (3) `land` adds each placed stone's offset from the
  one below to `lean` (+ right; a perfect drop adds 0). Past `LEAN_MAX` (60) `topple` removes the
  tier's stones placed so far (`inTier` of them), takes back the favor they earned (`tierFavor`,
  which a tier end resets), pushes a `toppled` event (with that favor), resets `inTier`, `wobbly`,
  `lean`, `chain` and the trial's progress, and the tier starts over. A
  finished tier keeps `LEAN_SETTLE` (half) of its lean, truncated.
- Perfect chains (SS7): `chain` counts perfect drops in a row (a cut or a miss resets it; it carries
  across tiers). From `CHAIN_FROM_TIER` (3) the `CHAIN_LEN`th (3rd) perfect drop and each one after
  widen the stone just placed by `REGROW_PX` (12) with `widenTop` and push a `regrown` event.
- Materials (SS8): from `MATERIAL_FROM_TIER` (3) every tier end opens a break, and `chooseMaterial`
  (`canPickMaterial`) sets `material` for the tier being started (`MATERIAL_PICKS` on buttons; the
  same pick again goes back to `limestone`, the default a tier end sets). `Stone` and `Moving`
  carry a `material`. Marble halves `perfectWindow` and doubles the tier's favor (`materialMult`,
  in `favorMult`); Sandstone doubles the window and halves favor (favor is `Math.ceil`ed after the
  multipliers); Basalt swings at `BASALT_SPEED`, cracks `BASALT_CRACK` more off each cut and its
  trial pays `BASALT_TRIAL_MULT`. `keepBuilding` now opens such a break for the first sky tier.
- Reserve (SS9): from `RESERVE_FROM_TIER` (2) `swapReserve` (`canSwap`; the panel's Swap button or
  the R key) puts the kind in hand into `reserve` and takes `nextKind` (rolling a new one) while the
  reserve is empty, or swaps the two and sets `swapped`, which a tier end clears; a `swapped` event
  shows the kind now in hand. The stone's position, width and wind stay.
- Patrons (SS10): `newGame` starts in phase `patron` with `patronOffer` (`PATRON_OFFER` (2) of
  `PATRONS`); `choosePatron` sets `patron`, applies its start effect and moves to `swinging`. The
  Gilded Hand (`gilded`) adds `PATRON_FAVOR` to `favorPerStone` and drops `grace` from `blessingsFor`
  and `shopFor`; the Many-Handed (`hands`) offers `HANDS_OFFER` (4) blessings (`offerSize`) and
  swings at `HANDS_SPEED`; the Patient Mason (`patient`) swings at `PATIENT_SPEED` and earns no
  `PERFECT_FAVOR`; the Storm Caller (`storm`) adds `STORM_PERFECT` to `perfectPx` and gets gusts
  from `STORM_FROM_TIER` (`gusty`, `gustFor`, whose ladder climbs on from there into the sky rather
  than starting over at `GOAL_TIER`); the gust readout shows whenever `gusty` is true. `speedFor` takes the patron (`patronSpeed`).
- Curses (SS5): a balanced tier's break offers `curseOffer` (`haste`, `brittle`, `dim`);
  `toggleCurse` sets `cursed`, and `chooseBlessing` then puts `curse` on the tier being started.
  `curseNow` says if it is in force; `favorMult` doubles (`CURSE_MULT`) every favor of that tier.
  Haste multiplies `swingSpeed` by `HASTE`, Brittle cracks `BRITTLE_CRACK` more off each cut, and
  Dimness hides the drop guide (scene only).
- Gilded tier: stones placed on tier `GILDED_TIER` (10), and its balance bonus, earn
  `GILDED_MULT` (2) times the favor (`gild`, `stoneFavor`).
- Goal: finishing tier `GOAL_TIER` (12) sets phase `crowned`, the win. A balanced crowning tier
  still rolls its `offer` and `curseOffer`, and `keepBuilding` opens the break with them (the
  material row and shop too); a wobbly one opens it with an empty offer.
  In the endless sky the run ends only on a miss; `best` keeps counting tiers.
- The game ends on a miss (a stone keeping less than `MIN_W`) unless Mason's Grace catches it; a
  caught stone still marks the tier `wobbly` and fails its trial (with a `trial` event), then is
  replayed.

Missing or rough:

- The title, pause and sound buttons are the shared ones from `setupGame`. Only the best height persists; a reload starts a new temple.
- Past tier 23 gusts stop growing (`WIND_MAX`); the sky altars are the only milestones after that.
- A tap is ignored while a stone falls; a tap during the blessing choice lands on the dim.
- The clouds stop about 16000 pixels up (`createBackdrop`), roughly 190 tiers.
- `docs/screenshots/game-over.webp`, `gilded.webp`, `crowned.webp`, `wobbly-break.webp`,
  `shop-bought.webp`, `curse-taken.webp`, `stone-kinds.webp`, `endless-gust.webp`, `four-blessings.webp`,
  `material-pick.webp`, `reserve.webp`, `lean-meter.webp`, `toppled.webp`, `regrown.webp`,
  `storm-gust.webp`, `crowned-blessing.webp`, `sky-altar.webp`, `sky-altar-blessing.webp`, `trophy-earned.webp`, `trophies.webp`, `fill-ultrawide.webp`, `fill-tablet.webp` (the play scene filling a 2560x1080 and a 1024x768 screen) and `cover.png` (a copy of `gilded.webp`) are not produced by the test; refresh
  them by hand (play several tiers in the dev build, or drive it with a Playwright script that taps
  like the test does) if the look changes.

## Architecture

File map (`src/`):

- `howToPlay.ts`: the How to play screen's text (goal, controls, core loop and tips) in British
  English, US English (the same with US spelling, made by `us`) and German, picked with `byLanguage`
  and handed to `setupGame(game, { howToPlay })` in `main.ts`; update every language when the
  controls or the first round change.
- `i18n.ts` and `i18n/`: the game's texts (`shared/i18n.ts`). `i18n/en.ts` is the British English
  source (favour, centre), `i18n/de.ts` the German and `i18n/en-US.ts` only the texts with
  "favour" in them, spelled "favor". `t(key, vars)` shows a text in the hub's language; `TextKey`
  types the keys. Every text on screen goes through `t`, and a new one gets its German entry (and
  a US one if its spelling differs) in the same PR.
- `audio.ts`: the game's sound (see Sound below): `SONG`, the `sfx` table and `bellPitch`.
- `main.ts`: creates the `Phaser.Game` (960x540 from `VIEW`, `Phaser.Scale.FIT`,
  `pixelArt: true`) with `GameScene` only, calls `setupGame(game)` from `shared/setupGame.ts` and
  then `setupScaling(game, { fill: true })` from `shared/scaling.ts`, and in dev builds puts `game` on `window`.
- `game/state.ts`: the tuning constants (`TOWER_X`, `PLINTH_W`, `START_W`, `STONE_H`, `DROP_GAP`,
  `SWING`, `BASE_SPEED`, `TIER_SPEEDUP`, `CALM`, `GRAVITY`, `PERFECT_PX`, `STEADY_PX`, `BROAD_PX`,
  `STONES_PER_TIER`, `BALANCE`, `PERFECT_FAVOR`, `TIER_FAVOR`, `OFFER_SIZE`, `MIN_W`,
  `REROLL_COST`, `GILDED_TIER`, `GILDED_MULT`, `GOAL_TIER`, `ALTAR_EVERY`, `ALTAR_MULT`, `SLOW_MULT`, `WIDER_PX`,
  `KINDS_FROM_TIER`, `HEAVY_CHANCE`, `LIGHT_CHANCE`, `KIND_SPEED`, `HEAVY_CRACK`, `LIGHT_FAVOR`,
  `TRIALS_FROM_TIER`, `TRIAL_KEEP`, `TRIAL_FAVOR`, `CURSE_MULT`, `HASTE`, `BRITTLE_CRACK`,
  `GUST_CHANCE`, `WIND_BASE`, `WIND_PER_TIER`, `WIND_MAX`, `LEAN_FROM_TIER`, `LEAN_MAX`,
  `LEAN_SETTLE`, `CHAIN_FROM_TIER`, `CHAIN_LEN`, `REGROW_PX`, `MATERIAL_FROM_TIER`,
  `MARBLE_PERFECT`, `MARBLE_MULT`, `SANDSTONE_PERFECT`, `SANDSTONE_MULT`, `BASALT_SPEED`,
  `BASALT_CRACK`, `BASALT_TRIAL_MULT`, `RESERVE_FROM_TIER`, `PATRON_OFFER`, `PATRON_FAVOR`,
  `HANDS_OFFER`, `HANDS_SPEED`, `PATIENT_SPEED`, `STORM_PERFECT`, `STORM_FROM_TIER`), the types
  (`Phase`, `Stone`, `Moving`, `Trial`, `Drop`, `GameEvent`, `GameState`) and the rules
  (`patronSpeed`, `speedFor`, `newGame`, `choosePatron`, `offerSize`, `blessingsFor`, `shopFor`,
  `stackHeight`, `topOf`, `curseNow`, `swingSpeed`, `perfectWindow`, `canSwap`, `swapReserve`,
  `tick`, `drop`, `canPickMaterial`, `chooseMaterial`, `chooseBlessing`, `canReroll`, `reroll`,
  `canBuy`, `buy`, `toggleCurse`, `buildOn`, `keepBuilding`, `isAltar`, `nextAltar`, `gild`, `materialMult`, `favorMult`,
  `stoneFavor`, `gusty`; `pickPatrons`, `spawn`, `gustFor`, `kindFor`, `gust`, `land`, `topple`,
  `pickOffer`, `pickCurse`, `widenTop` and `endBreak` are private). No Phaser; `speedFor` reads
  `byDifficulty` from `shared/settings.ts`.
- `game/blessings.ts`: `BLESSINGS`, `BlessingId` and `BLESSING_INFO` (name and card text as
  `TextKey`s, colour).
- `game/catalog.ts`: `SHOP`/`ShopId`/`SHOP_INFO` (name, cost, colour) and `CHEAPEST`,
  `KINDS`/`StoneKind`/`KIND_INFO` (name, short name for the reserve, colour),
  `TRIALS`/`TrialId`/`TRIAL_INFO` (short text), `CURSES`/`CurseId`/`CURSE_INFO`,
  `MATERIALS`/`MaterialId`/`MATERIAL_INFO` (name, short button text, colour) with `MATERIAL_PICKS`
  (the three on buttons) and `PATRONS`/`PatronId`/`PATRON_INFO` (name, boon, bane, colour). Every
  name and text is a `TextKey` of `i18n/en.ts`, which the scene shows with `t`.
- `game/save.ts`: `loadBest` and `saveBest`.
- `trophies/`: the game's eight trophies (`shared/trophies.ts`). `index.ts` lists them (`trophies`:
  id, tier, icon, `hidden` for the two sky altar ones) with their texts in `trophies/i18n/` (`en.ts`,
  `de.ts` and `en-US.ts` for "favor": the name keyed by the id, what earns it by `<id>Text`), and
  imports nothing else from the game, since the hub loads it for its trophy shelf. `main.ts` hands
  `trophies` to `setupGame`, which lists them on the start and pause screens. `check.ts` holds each
  trophy's condition on a `GameEvent` and the state after it (`EARNED`): First course (any `tier`),
  Grown back (`regrown`), Bound by a curse (a `tier` with `cursed`), Leaf gold (`tier`
  `GILDED_TIER`), Crowned shrine (`tier` `GOAL_TIER`), Flawless shrine (the same with
  `balancedTiers === GOAL_TIER`), Altar in the clouds (`altar`) and Stairway of altars (`altar` with
  `altars >= THREE_ALTARS`, 3). `GameScene.update` calls `checkTrophies(state, event)` for every
  event it shows; nothing restores a run, so no award is quiet. A new trophy is an entry in
  `index.ts`, its two texts in each language file and its condition in `EARNED`.
- `scenes/GameScene.ts`: everything drawn, plus `setFitted`, `drawStone`, `materialColor`, `tierColor`,
  `blend`, `shade`, `seeded`, `pin` and `place` helpers and the `UiPart` type.
- `scenes/layout.ts`: `VIEW`, `PLINTH_Y`, `TOP_SCREEN_Y`, `PANEL`, `CARDS`, `CARDS_FOUR`,
  `PATRON_TITLE`, `PATRON_CARDS`, `BUTTON`, `OFFER_TITLE`, `REROLL`, `MATERIAL_TITLE`,
  `MATERIAL_ROW`, `CURSE`, `SHOP_TITLE`, `SHOP_ROW`, `BUILD_ON`, `RESERVE_BUTTON`, `LEAN_BAR`,
  `GOAL`, `UI_DEPTH`, `FONT`.
- `ui/Button.ts`: `makeButton`, the captioned buttons on the end panel (returned as loose parts).

Shared code it imports (outside the game folder): `shared/setupGame.ts` (`setupGame`),
`shared/scaling.ts` (`setupScaling`), `shared/audio.ts` (`sounds`, `playMusic`, `playSting`, `ui`), `shared/settings.ts` (`byDifficulty`, `settings`) and
`shared/i18n.ts` (`translator`, `byLanguage`, `Translation`).

How it runs:

- Coordinates: stone `x` values are world pixels, the same as view pixels inside the designed frame (the temple's middle is `TOWER_X`); heights are
  pixels above the plinth's top. The scene turns a height into a world y with
  `PLINTH_Y - h`. The camera only scrolls vertically: `update` eases `scrollY` towards keeping
  the temple's top at `TOP_SCREEN_Y`.
- Time: `GameScene.update(time)` takes `dt` from the frame timestamp, clamped to `MAX_STEP_MS`,
  and calls `tick(state, dt)`; the scene's `resume` and `wake` events clear `lastFrame`, so the
  first frame after the shared pause steps nothing (their listeners come off on `shutdown`, so
  "Build again" doesn't pile them up). `tick` moves the swinging stone at `swingSpeed` (bouncing at
  `TOWER_X ± SWING`) or makes the falling one fall under `GRAVITY`, pushed by `wind`, until it
  reaches the temple's top, then `land` runs.
- `land` decides perfect (within `perfectWindow`, and only when the overlap would also reach
  `MIN_W`: snap to the stone below, keep the full width), cut (keep the overlap,
  centred on it, less any heavy, Basalt or Brittle crack) or miss (overlap under `MIN_W`), adds
  favor, marks the tier wobbly when the share kept is under `BALANCE`, counts the perfect chain and
  regrows the stone, adds the lean and topples the tier if it is too far (then spawns and returns),
  updates the trial, and on the third stone of a tier finishes it: a met trial adds `TRIAL_FAVOR`
  and a balanced tier `TIER_FAVOR` (both times `favorMult`, rounded up), `tier` goes up, the curse
  ends, the swap, material and `tierFavor` reset, the lean settles and the next trial is rolled. A
  balanced tier rolls `offer` and `curseOffer`. The goal tier then moves to `crowned` and stops
  (unless `endless`); otherwise a balanced tier moves to the `blessing` phase, and a wobbly one does too, with an empty
  offer, when favor reaches `CHEAPEST` or from `MATERIAL_FROM_TIER`. Then it spawns the next stone
  from the side opposite the last.
- Events: the rules push `GameEvent`s (`placed` with a copy of the stone, its row and the favor it
  earned, `missed` with the stone's tier, kind and material, `tier` (balanced, and whether a curse
  was in force), `trial` (failed mid-tier, or passed with its favor), `rerolled`, `bought`, `toppled` (how many
  stones, the lean and the favor lost), `regrown`, `swapped` (the kind now in hand), `patron`, `altar`) onto
  `state.events`; the scene drains them each frame in `show`, which draws the new
  stone, debris, popups, glow, lanterns, the crown and banners, and on `toppled` sends the last
  stone views tumbling (`tumble`). Nothing else in the scene changes state.
- Input: one interactive zone over the whole view calls `drop`; the panel's Swap button and the R
  key call `swapReserve`. The patron layer (`patronParts`, built by `buildPatrons` while the phase
  is `patron`), the break layer (an interactive dim, the cards, the Reroll button, the material
  row, the curse toggle, the shop buttons, or "Build on") and the end layer (with "Build again"
  and "Keep building") sit above it and swallow taps. A reroll, a buy, a material pick or the curse
  toggle sets `offerKey` to `'#'`, so `refresh` rebuilds the layer on the next frame, not inside
  the button's own tap (`offerKey` also carries the material). The end panel waits `CROWN_MS` of game time after
  the crown so the crowned shrine shows first. Everything on
  screen that stays put has scroll factor 0. Anything tappable is a loose game object, never
  inside a container: the break's parts live in `offerParts` (added with `addOffer`, buttons
  positioned with `place`) and the end panel's in `gameOver`, `againButton`, `againBeside` and
  `keepBuildingButton`; `makeButton` returns its parts. Only the banner, which takes no taps, is a
  container (fixed with `pin`); `announce` wraps its text at `BANNER_WRAP` and grows its backdrop
  (`bannerBack`, at least `BANNER_MIN`) to fit, plus `BANNER_PAD`. The end panel's text is
  `fallenStood` or `fallenSky` plus a `bestTiers` line, each pluralised by its own number.
- Screens: `setupScaling` draws the canvas at the screen's resolution (`renderScale` canvas pixels
  per game pixel, a whole number, so `pixelArt` stays crisp) and zooms the camera to match from its
  top-left corner. The game fills the screen's shape (`fill: true`): the view is 960x540 or wider
  (up to 1296) or taller (up to 720). `create` reads `vw`/`vh` from `viewSize` and `fx`/`fy` from
  `viewFrame` (the designed 960x540 frame in the middle of the view) and starts the camera at
  `scroll(-fx, -fy)`, so the world (rule coordinates such as `TOWER_X` and `PLINTH_Y` unchanged)
  sits in that frame; `update` keeps `scrollX` and eases `scrollY` towards its target minus `fy`.
  The sky, stars and parallax mountains and clouds are painted over the whole view (each parallax
  layer starts `fy * (1 - factor)` down), the hill grows by `fx` each side, the panel is pinned to
  the left edge and stretched to the view's height, the hint sits on the bottom edge, the banner and
  gust readout follow the tower (`fx + TOWER_X`), the tap zone and the dims cover the view, the
  patron and break layers are laid out with the `layout.ts` constants and then moved by
  (`fx`, `fy`) (`buildOffer` moves the parts `fillOffer` made, and the test spots with them), and
  the end panel is centred in the view. The panel's popups (reroll, buy, swap) are fixed on screen.
  At 960x540 `fx` and `fy` are 0 and nothing moves. The camera only ever scrolls, so it keeps that
  top-left origin and needs no `splitHudCamera`: scroll-factor-0 objects stay where they were placed. Anything new that reads
  `this.scale`, `pointer.x/y` or follows with `startFollow`/`setBounds` must go through the helpers
  in `shared/scaling.ts` instead. `index.html` has the shared `100dvh` and `touch-action: none` styles.
- Rendering: placed stones are one `Graphics` each in `stoneViews`, drawn once (redrawn only by
  Broad Stones, the Wider stone and a regrowth, in `redrawTop`; a topple removes the last views);
  ornaments are one `Graphics` per balanced tier in `ornaments`. The swinging stone is redrawn only
  when its width, tier, kind or material changes; the drop guide, gust streaks and the lean meter
  (`drawLean`) are redrawn every frame. The break layer is rebuilt when the offer changes (`offerKey`). The crown
  is one `Graphics`, destroyed by "Keep building". Panel texts are set every frame (Phaser skips unchanged text).
  Texts whose length depends on the language (the panel's patron, curse and blessings lines, the
  blessing cards' names, the shop's labels and the curse toggle) go through `setFitted`, which
  shrinks the font (down to `MIN_FONT`) until the text fits its box (`PANEL_TEXT_W` in the panel);
  with a curse in force the panel shows the tier's material by name after it on the same line.

State model (`GameState`): `phase` (`patron`, `swinging`, `falling`, `blessing`, `over`,
`crowned`), `stones` (bottom first), `moving`, `tier` and `inTier`, `wobbly`, `tiersBuilt`,
`balancedTiers`, `favor`, `tierFavor`, `blessings` (in the order chosen) and `offer`, the blessing-driven
`speed`, `perfectPx`, `favorPerStone` and `grace`, `dropped` (misses included), `lastDrop`, `best`,
`nextKind`, `slow`, `bought`, `trial`, `curseOffer`, `cursed`, `curse` (`{ id, tier }`), `endless`,
`wind`, `altars`, `lean`, `chain`, `material`, `reserve` and `swapped`, `patronOffer` and `patron`, and
`events`. `Stone` and `Moving` carry a `kind` and a `material`. Only
`src/game/state.ts` mutates it. `moving` exists in every phase; it simply does not move outside
`swinging`/`falling`.

Persistence: `shrine-stack-best` in `localStorage` holds the most tiers built in one temple, and
`shrine-stack-trophies` the trophies earned (`shared/trophies.ts`), each id with the time. The scene writes it when a tier finishes and on game over. The hub's settings are read
from the shared `hub-settings` key, not from this game's save.

Randomness and timing: `Math.random` is used only in the rules: `pickPatrons`, `pickOffer`,
`pickCurse`, `kindFor` (from the third stone, and when the reserve takes a stone), the trial roll
in `land` and `gust`. Stars, mountains and clouds use `seeded` in `GameScene.ts`. All rule timing is game time
from `tick`; tweens are cosmetic only.

### Hub settings

- `src/main.ts` calls `setupGame(game)` right after creating the game, which applies the frame cap, the FPS readout, reduced motion and full screen (camera shake and flash become no-ops; the miss and topple shakes
  are the only ones here).
- Difficulty scales one number: the swing speed. `speedFor` multiplies `BASE_SPEED` by
  `byDifficulty(0.8, 1, 1.25)` (Easy, Normal, Hard). Nothing else changes (the patron's pace is a
  separate factor in `speedFor`).
- `settings.reduceMotion` also stops the blessing card icons' gentle pulse in
  `drawBlessingIcon`. Debris, popups and the glow are single, non-blinking tweens and stay.
- Keep Normal exactly as designed: the playthrough runs on Normal and expects a speed of 230 times
  the chosen patron's pace.
- Keep the Shrine Stack row of the root README's difficulty table, and the difficulty line in this
  game's README, in sync with the `byDifficulty` values.

## Sound

All sound is made in code by `shared/audio.ts`; `src/audio.ts` holds the song and the effects,
and only `GameScene` plays them (the rules in `src/game/` have no sound). Nothing plays under
browser automation, so the playthrough is unchanged.

Music, `SONG`: 80 BPM in D Dorian, a soft pulse lead with its own echo on the square voice (the
lead three sixteenths later, made by `echo`), a triangle drone and light drums. `updateSound` picks
the part each frame from the phase and switches only when it changes (the engine waits for the next
bar):

- `calm` (8 bars): stacking (`swinging`/`falling`) on every tier but the gilded one.
- `gilded` (4 bars, D major, busier beat): stacking on tier `GILDED_TIER` and on a sky altar.
- `sky` (4 bars, high and sparse): stacking in the endless sky between altars.
- `break` (4 bars, harp-like arpeggios over held notes): the patron pick, the breaks between tiers
  and the end panels.
- Stings: `crown` in `crownTemple`, `fall` on the `missed` event that ends the run.

Effects, `sfx` (all from `GameScene`):

| Sound | Where |
| --- | --- |
| `whoosh` | the tap zone, when `drop` lets the stone go |
| `thud` | every `placed` event, lower for heavy and higher for light stones |
| `bell` | a perfect `placed`, a pentatonic step higher with each perfect in a row (`bellPitch(chain)`) |
| `crack` | a `placed` event that cut pieces off |
| `shimmer` | `regrown` |
| `chime` / `meh` | `tier`, balanced / wobbly (not on the crowning tier, which has the sting) |
| `sparkle` / `blip` | `trial`, passed / failed |
| `rumble` + `tumble` | `toppled` |
| `saved` / `crash` | `missed`, caught by Mason's Grace / not |
| `swish` | `swapped` |
| `gong` | `patron`, `altar` |
| `choir` | `onChosen` (a blessing taken) |
| `shuffle` | `rerolled` |
| `stone` | a material button that changed the pick |
| `pluck` | the curse toggle taking the curse (`ui('click')` when untaking it) |
| `rise` | "Build on" and "Keep building" |
| `gust` | `updateSound`, once per stone in hand (keyed by `dropped`) that has a non-zero `wind` |

Shared sounds: `ui('coin')` on `bought`, `ui('click')` on "Build again", and `ui('refuse')` for a
Reroll or shop button that can't be used, and for the Swap button or R while stacking when
`canSwap` is false.

## Testing hooks

- `src/main.ts` exposes `window.game` in dev builds. The test reads `game.scene.getScene('Game')`
  and its `state` (copied through JSON, without `events`), `patronCards` (`{ id, x, y, w, h }` per
  card while a patron is chosen), `blessingCards` (`{ id, x, y, w, h }` per card, in view pixels),
  `rerollButton` (`{ x, y, w, h }` while choosing, else null), `shopButtons` (`{ id, x, y, w, h }`),
  `materialButtons` (`{ id, x, y, w, h }`, from tier 3), `curseToggle` and `buildOnButton`
  (`{ x, y, w, h }` or null) during a break, `reserveButton` (`{ x, y, w, h }` while a swap is
  allowed, else null) and `keepButton` while the crowned panel shows.
- Inputs: it taps the first patron card's centre from `patronCards` (after checking nothing moves
  before that), then taps the sky at (860, 200) to drop, waiting frame by frame until the swinging
  stone's middle is within 12 pixels (`AIM_PX`) of the middle of what it lands on; it taps a
  card's centre from `blessingCards`, taps the centre of `rerollButton` once before choosing,
  and taps (480, 520) on the dim to check it does nothing (keep the shop row above it). It checks
  the curse toggle and the shop buttons the patron allows are there but takes neither, and leaves
  the reserve alone: purchases and swaps stay out of the first round.
  The sky point must stay clear of the panel; the cards are not shown when it is tapped.
- Mirrored in `e2e/playthrough.spec.ts`, so change them together: the `GameState` field names,
  `VIEW`, `TOWER_X`, `PLINTH_W`, `START_W`, `STONE_H`, `DROP_GAP` (as the literal 120), the Normal
  speed 230, `STONES_PER_TIER`, `BALANCE`, `PERFECT_FAVOR`, `TIER_FAVOR`, `BROAD_PX`, `CALM`,
  `TIER_SPEEDUP`, `STEADY_PX`, `REROLL_COST`, favor per stone starting at 1, `SHOP` order,
  ordinary limestone stones and no trial, lean or reserve on tier 1 (`KINDS_FROM_TIER`,
  `TRIALS_FROM_TIER`, `RESERVE_FROM_TIER` at 2, `LEAN_FROM_TIER`, `MATERIAL_FROM_TIER` at 3), each
  patron's first-round rule in `PATRON_RULES` (pace, favor per stone and per perfect drop, offer
  size, shop items, perfect window), two patrons offered, the scene key `'Game'`, the save key
  `shrine-stack-best`, and `shrine-stack-trophies` holding only `firstTier` after the first tier
  (a trophy a first round can earn goes into that assertion).
- It saves `playthrough-0-patrons`, `-0-start`, `-1-first-stone`, `-2-blessing` and `-3-tier-2`
  screenshots; copy them into `docs/screenshots/` when the look changes.

## Making common changes

- **Add or change a text**: its key in `i18n/en.ts`, the German in `i18n/de.ts` (the build fails
  without it) and, when it spells "favour", the US spelling in `i18n/en-US.ts`; run
  `node scripts/check-translations.mjs`. German runs longer than English: the panel's "Next:" line
  and the Reroll button are the tightest spots, so check a new text with `?lang=de`.
- **Add a blessing**: add its id to `BLESSINGS` and its `BLESSING_INFO` (with its name and text in
  the `i18n/` files), its effect in
  `chooseBlessing`, its emblem in `GameScene.drawBlessingIcon`, a README row, and a case in the
  test's `switch` (the seeded offer may change which card is first).
- **Retune**: the constants at the top of `src/game/state.ts` (shop prices in
  `src/game/catalog.ts`); mirror the changed ones in the test.
- **Add a shop item, curse or trial**: its id and info in `catalog.ts`, its effect in `buy`,
  `land`/`swingSpeed` or the trial check in `land`, and an icon in `drawShopIcon` for a shop item
  (a fourth shop button needs `SHOP_ROW.xs` widened).
- **Add a patron**: its id and `PATRON_INFO` in `catalog.ts`, its start effect in `choosePatron`
  and its rule where it bites (`speedFor`/`patronSpeed`, `offerSize`, `blessingsFor`, `shopFor`,
  `stoneFavor`, `gustFor`), an emblem in `drawPatronIcon`, a README row, and its row in the
  test's `PATRON_RULES` (the seeded offer may change which two are shown).
- **Add a material**: its id and `MATERIAL_INFO` in `catalog.ts` and `MATERIAL_PICKS` (a fourth
  button needs `MATERIAL_ROW.xs` widened), its effect in `perfectWindow`, `materialMult`,
  `swingSpeed` or `land`, its look in `materialColor`/`drawStone`, and a README row.
- **Retune the lean**: `LEAN_MAX` and `LEAN_SETTLE` in `state.ts`; the meter in `drawLean` scales
  to `LEAN_MAX` on its own.
  Moving `GOAL_TIER` past 13 needs a wider goal box (`GOAL` in layout); the first round must keep
  enough favor for one reroll, or the test's reroll step fails.
  Changing `STONES_PER_TIER` also changes the panel pips and the test's loop.
- **Change the look of stones**: `drawStone` (which also draws the kinds) and `TIER_COLORS` in
  `GameScene.ts`. Stones are drawn
  with their bottom middle at the graphics' origin.
- **Move things**: `src/scenes/layout.ts` for the panel, cards, plinth and camera; `TOWER_X` lives in
  `state.ts` because the rules use it.

## Gotchas

- Phaser registers new interactive objects on the next frame, so the blessing cards ignore a tap
  in the same frame the tier finished. Real taps never come that fast; a test should play a frame.
- Phaser misplaces taps on interactive objects inside a container once the camera has scrolled,
  even with scroll factor 0 all the way down: the blessing cards and "Build again" used to stop
  working from about tier 5. Keep tappable things out of containers.
- Broad Stones, the Wider stone and a perfect chain's regrowth widen the top stone in the rules;
  the scene redraws it (and its tier's lanterns, if it has them) in `redrawTop`. Anything new that
  changes a placed stone needs the same; a topple removes the last `stoneViews` instead.
- `favorMult` only knows the material of the tier being built, so the tier bonuses are added
  before `tier` goes up in `land`; keep that order.
- `land` spawns the next stone even when the phase becomes `blessing`, so `moving.w` already
  matches the top stone while choosing; Broad Stones updates it again.
- Never use a red cross in any art (root AGENTS.md).
